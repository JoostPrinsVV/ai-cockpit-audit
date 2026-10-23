/* ==========================================================================
   Centrale opslag (Supabase)
   --------------------------------------------------------------------------
   Hetzelfde Supabase-project als de AI Snackbar, met eigen tabellen
   (setup/supabase-audit.sql):

     audit_content      de inhoud: usecases, prompts, tips, trainingen, agents, fasen, teksten
     audit_ideas        inzendingen uit de ideeënhub
     audit_idea_votes   'Ik ook'-stemmen (één per apparaat per inzending)
     audit_reviews      sterren en toelichting bij usecases en prompts (één per apparaat per item)
     audit_events       anonieme tellers: bekeken, afgespeeld, gekopieerd

   Rechten (Row Level Security):
   - Iedereen mag gepubliceerde inhoud lezen.
   - Iedereen mag een inzending, stem of teller tóévoegen.
   - Iedereen mag alleen inzendingen lezen die een beheerder heeft
     gepubliceerd, en dan zonder naam en e-mailadres.
   - Inhoud aanpassen en alles lezen, beantwoorden, publiceren en wissen kan
     alleen een beheerder die inlogt (e-mailadres in de tabel audit_admins).

   Naamruimte (kolom namespace): iedere discipline heeft er een eigen ('ai-audit',
   'ai-accountancy', ...), de gedeelde basis heeft 'ai-algemeen' (zie js/disciplines.js).
   Inzendingen en tellers gaan naar de discipline waarin je zit.

   Inloggen: de sessie staat in sessionStorage (alleen dit tabblad; weg zodra
   je het tabblad sluit) en wordt automatisch verlengd zolang je bezig bent.

   Geen bibliotheek: alleen fetch() naar de REST- en Auth-adressen van Supabase.
   ========================================================================== */
(function (ns) {
  'use strict';

  const TABLES = { ideas: 'audit_ideas', votes: 'audit_idea_votes', events: 'audit_events', content: 'audit_content', reviews: 'audit_reviews', log: 'audit_log', history: 'audit_content_history' };
  // Kolommen die iedereen mag lezen (geen naam of e-mailadres).
  const PUBLIC_COLUMNS = 'id,ref,created_at,kind,title,body,phase,status,answer,answered_at,votes';
  const CONTENT_COLUMNS = 'namespace,type,id,data,position,status,updated_at';
  // Voor beheerders ook de werkversie (stap 7 in setup/supabase-audit-bewerken.sql)
  const DRAFT_COLUMNS = CONTENT_COLUMNS + ',updated_by,draft,draft_kind,draft_by,draft_at,publish_at,publish_by,version';
  const MEDIA_BUCKET = 'cockpit-media';
  const PAGE_SIZE = 1000;
  const SESSION_KEY = 'ai-snackbar-audit:sessie';

  let config = {};
  let base = '';
  let key = '';
  let enabled = false;
  let trackingOff = false;
  let drafting = null; // true/false zodra bekend is of stap 7 (werkversies) is uitgevoerd
  let admin = null; // { token, refresh, email, expiresAt, isAdmin, rights: { owner, roles } }

  function init(options) {
    config = options.config || {};
    base = String(config.centralUrl || '').replace(/\/+$/, '');
    key = String(config.centralKey || '');
    enabled = Boolean(base && key);
    admin = readSession();
  }

  function isEnabled() {
    return enabled;
  }

  /* ---- Verzoeken ------------------------------------------------------------ */
  function headers(token, extra) {
    const result = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, extra);
    // Oude 'anon'-sleutels zijn een JWT en horen ook in Authorization; nieuwe 'publishable' sleutels niet.
    const bearer = token || (key.split('.').length === 3 ? key : '');
    if (bearer) result.Authorization = 'Bearer ' + bearer;
    return result;
  }

  async function request(path, init) {
    return fetch(base + path, Object.assign({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }, init));
  }

  function insert(table, rows, extra) {
    const body = JSON.stringify(rows);
    return request('/rest/v1/' + table, {
      method: 'POST',
      headers: headers(null, Object.assign({ Prefer: 'return=minimal' }, extra)),
      body,
      keepalive: body.length < 60000
    });
  }

  /** 404 = tabel ontbreekt (SQL nog niet uitgevoerd); PGRST205 is dezelfde melding in nieuwere versies. */
  async function isMissingTable(response) {
    if (response.status === 404) return true;
    if (response.status !== 400) return false;
    try {
      const data = await response.clone().json();
      return data && (data.code === 'PGRST205' || data.code === '42P01');
    } catch (error) {
      return false;
    }
  }

  /* ---- Inhoud (voor iedereen: alleen gepubliceerd) -------------------------------- */
  /** Filter op één naamruimte of op een lijst ervan. */
  function namespaceFilter(namespaces) {
    const list = (Array.isArray(namespaces) && namespaces.length ? namespaces : [config.namespace]).map(encodeURIComponent);
    return list.length === 1 ? 'namespace=eq.' + list[0] : 'namespace=in.(' + list.join(',') + ')';
  }

  /**
   * Alle inhoudsrijen (options.namespaces: welke naamruimtes, standaard die van de discipline).
   * Met een beheerderssessie ook concepten en de prullenbak.
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', rows: object[] }>}
   */
  async function fetchContent(options) {
    if (!enabled) return { status: 'off', rows: [] };
    const asAdmin = options && options.admin && signedIn();
    const query = (columns) => `?select=${columns}&${namespaceFilter(options && options.namespaces)}&order=type.asc,position.asc,id.asc&limit=5000`;
    try {
      let response;
      if (asAdmin && drafting !== false) {
        // Met stap 8: werkversies alleen in de naamruimtes waar je een rol hebt
        const namespaces = options && Array.isArray(options.namespaces) && options.namespaces.length ? options.namespaces : [config.namespace];
        response = await request('/rest/v1/rpc/audit_content_editor', { method: 'POST', headers: await adminHeaders(), body: JSON.stringify({ p_namespaces: namespaces }) });
        // Stap 8 nog niet uitgevoerd: de kolommen rechtstreeks, zoals daarvoor
        if (response.status === 404 || (!response.ok && (await errorCode(response)) === 'PGRST202')) {
          response = await request('/rest/v1/' + TABLES.content + query(DRAFT_COLUMNS), { headers: await adminHeaders() });
        }
        // 42703: de kolommen van de werkversie bestaan nog niet (stap 7 nog niet uitgevoerd)
        if (!response.ok && response.status === 400 && (await errorCode(response)) === '42703') drafting = false;
        else if (response.ok) drafting = true;
      }
      if (!response || drafting === false) {
        response = await request('/rest/v1/' + TABLES.content + query(CONTENT_COLUMNS), { headers: asAdmin ? await adminHeaders() : headers(null) });
      }
      if (response.ok) return { status: 'ok', rows: await response.json() };
      if (await isMissingTable(response)) return { status: 'missing', rows: [] };
      return { status: 'failed', rows: [] };
    } catch (error) {
      return { status: 'failed', rows: [] };
    }
  }

  async function errorCode(response) {
    try {
      const data = await response.clone().json();
      return data && data.code ? String(data.code) : '';
    } catch (error) {
      return '';
    }
  }

  /** Geplande publicaties uitvoeren waarvan het moment voorbij is (doet niets als er niets klaarstaat). */
  async function publishDue() {
    if (!enabled) return 0;
    try {
      const response = await request('/rest/v1/rpc/audit_publish_due', { method: 'POST', headers: headers(null), body: '{}' });
      return response.ok ? Number(await response.json()) || 0 : 0;
    } catch (error) {
      return 0;
    }
  }

  /* ---- Ideeënhub ------------------------------------------------------------- */
  /**
   * Nieuwe inzending. Gaat direct naar Supabase en wordt niet op het apparaat bewaard
   * (alleen titel, soort en referentie, voor 'Jouw inzendingen').
   * @returns {Promise<'ok'|'missing'|'failed'|'off'>}
   */
  async function submitIdea(idea) {
    if (!enabled) return 'off';
    const row = {
      namespace: config.namespace,
      ref: idea.ref,
      kind: idea.kind,
      title: idea.title,
      body: idea.body,
      phase: idea.phase || null,
      name: idea.name || null,
      email: idea.email || null,
      allow_public: idea.allowPublic !== false
    };
    try {
      const response = await insert(TABLES.ideas, [row]);
      if (response.ok) return 'ok';
      if (await isMissingTable(response)) return 'missing';
      console.warn('[AI Cockpit Audit] Inzending geweigerd:', response.status, await response.text());
      return 'failed';
    } catch (error) {
      console.warn('[AI Cockpit Audit] Inzending niet verstuurd (geen verbinding).');
      return 'failed';
    }
  }

  /**
   * Gepubliceerde inzendingen (voor iedereen zichtbaar).
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', items: object[] }>}
   */
  async function listIdeas() {
    if (!enabled) return { status: 'off', items: [] };
    const query = `?select=${PUBLIC_COLUMNS}&namespace=eq.${encodeURIComponent(config.namespace)}&is_public=eq.true&order=created_at.desc&limit=500`;
    try {
      const response = await request('/rest/v1/' + TABLES.ideas + query, { headers: headers(null) });
      if (response.ok) return { status: 'ok', items: await response.json() };
      if (await isMissingTable(response)) return { status: 'missing', items: [] };
      console.warn('[AI Cockpit Audit] Inzendingen lezen mislukt:', response.status, await response.text());
      return { status: 'failed', items: [] };
    } catch (error) {
      return { status: 'failed', items: [] };
    }
  }

  /** 'Ik ook'. Dubbel stemmen (zelfde apparaat) geeft 409: telt als al gestemd. */
  async function vote(ideaId, voterId) {
    if (!enabled) return 'off';
    try {
      const response = await insert(TABLES.votes, [{ idea_id: ideaId, voter: voterId }]);
      if (response.ok) return 'ok';
      if (response.status === 409) return 'duplicate';
      if (await isMissingTable(response)) return 'missing';
      return 'failed';
    } catch (error) {
      return 'failed';
    }
  }

  /* ---- Reviews van usecases en prompts --------------------------------------------- */
  /**
   * Nieuwe review: { type: 'usecase'|'prompt', id, rating (1-5), comment?, voter }.
   * Twee keer hetzelfde item vanaf één apparaat geeft 409: telt als al beoordeeld.
   * @returns {Promise<'ok'|'duplicate'|'missing'|'failed'|'off'>}
   */
  async function submitReview(review) {
    if (!enabled) return 'off';
    const row = {
      namespace: config.namespace,
      item_type: review.type,
      item_id: String(review.id).slice(0, 80),
      voter: review.voter,
      rating: review.rating,
      comment: review.comment || null
    };
    try {
      const response = await insert(TABLES.reviews, [row]);
      if (response.ok) return 'ok';
      if (response.status === 409) return 'duplicate';
      if (await isMissingTable(response)) return 'missing';
      console.warn('[AI Cockpit] Review geweigerd:', response.status, await response.text());
      return 'failed';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Gemiddelde en aantal reviews per item in deze discipline.
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', items: { item_type, item_id, reviews, average }[] }>}
   */
  async function reviewStats() {
    if (!enabled) return { status: 'off', items: [] };
    try {
      const response = await request('/rest/v1/rpc/audit_review_stats', { method: 'POST', headers: headers(null), body: JSON.stringify({ p_namespace: config.namespace }) });
      if (response.ok) return { status: 'ok', items: await response.json() };
      if (await isMissingTable(response)) return { status: 'missing', items: [] };
      return { status: 'failed', items: [] };
    } catch (error) {
      return { status: 'failed', items: [] };
    }
  }

  /**
   * Gepubliceerde toelichtingen bij één item (nieuwste eerst).
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', items: object[] }>}
   */
  async function listReviews(type, id) {
    if (!enabled) return { status: 'off', items: [] };
    const query = `?select=id,rating,comment,created_at&namespace=eq.${encodeURIComponent(config.namespace)}&item_type=eq.${encodeURIComponent(type)}&item_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=20`;
    try {
      const response = await request('/rest/v1/' + TABLES.reviews + query, { headers: headers(null) });
      if (response.ok) return { status: 'ok', items: await response.json() };
      if (await isMissingTable(response)) return { status: 'missing', items: [] };
      return { status: 'failed', items: [] };
    } catch (error) {
      return { status: 'failed', items: [] };
    }
  }

  /* ---- Anonieme tellers ----------------------------------------------------------- */
  /** kind: 'view_usecase' | 'play_demo' | 'copy_prompt' | 'view_tip' | 'copy_tip' | 'view_training' | 'play_training' | 'view_agent' | 'open_agent'. Geen persoonsgegevens. */
  function track(kind, itemId) {
    if (!enabled || trackingOff || !config.enableUsageStats || signedIn()) return; // beheerders tellen niet mee
    insert(TABLES.events, [{ namespace: config.namespace, kind, item_id: String(itemId || '').slice(0, 80) }])
      .then(async (response) => {
        if (!response.ok && (await isMissingTable(response))) trackingOff = true;
      })
      .catch(() => {
        /* even geen verbinding: deze telling vervalt */
      });
  }

  /* ---- Beheer: inloggen en sessie ---------------------------------------------------- */
  function readSession() {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeSession() {
    try {
      if (admin) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(admin));
      else window.sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      /* sessie alleen in het geheugen */
    }
  }

  function setSession(data, fallbackEmail) {
    admin = {
      token: data.access_token,
      refresh: data.refresh_token,
      email: (data.user && data.user.email) || fallbackEmail || (admin && admin.email) || '',
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      isAdmin: admin ? admin.isAdmin : null,
      rights: admin ? admin.rights : null
    };
    writeSession();
  }

  async function checkAdmin() {
    try {
      const response = await request('/rest/v1/rpc/audit_is_admin', { method: 'POST', headers: headers(admin.token), body: '{}' });
      if (!response.ok) return response.status === 404 ? null : false; // 404: SQL nog niet uitgevoerd
      return (await response.json()) === true;
    } catch (error) {
      return null;
    }
  }

  /**
   * Wat mag deze gebruiker? { owner: hoofdbeheerder, roles: [{ namespace, role, sections }] }.
   * Zonder stap 7 (audit_me bestaat nog niet): alleen hoofdbeheerders, zoals vroeger.
   */
  async function loadRights() {
    try {
      const response = await request('/rest/v1/rpc/audit_me', { method: 'POST', headers: headers(admin.token), body: '{}' });
      if (response.ok) {
        const me = await response.json();
        return { owner: me.owner === true, roles: Array.isArray(me.roles) ? me.roles : [] };
      }
      if (response.status !== 404) return { owner: false, roles: [] };
    } catch (error) {
      return null;
    }
    const owner = await checkAdmin();
    return owner === null ? null : { owner, roles: [] };
  }

  /**
   * @returns {Promise<'ok'|'not-admin'|'failed'>} not-admin = ingelogd, maar zonder beheerdersrol
   */
  async function signIn(email, password) {
    if (!enabled) return 'failed';
    try {
      const response = await request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: headers(null),
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        signOut();
        return 'failed';
      }
      admin = null;
      setSession(await response.json(), email);
      admin.rights = await loadRights();
      // null: rechten nog onbekend (geen verbinding of SQL nog niet uitgevoerd): toelaten, de database bewaakt
      admin.isAdmin = admin.rights ? admin.rights.owner || admin.rights.roles.length > 0 : null;
      writeSession();
      return admin.isAdmin === false ? 'not-admin' : 'ok';
    } catch (error) {
      signOut();
      return 'failed';
    }
  }

  /** Rechten opnieuw ophalen (na een wijziging in Beheer → Beheerders). */
  async function refreshRights() {
    if (!admin) return null;
    await ensureSession();
    const rights = await loadRights();
    if (rights) {
      admin.rights = rights;
      admin.isAdmin = rights.owner || rights.roles.length > 0;
      writeSession();
    }
    return admin.rights;
  }

  /** De rechten van de ingelogde gebruiker (of null als onbekend). */
  function rights() {
    return admin ? admin.rights || (admin.isAdmin ? { owner: true, roles: [] } : null) : null;
  }

  function signOut() {
    admin = null;
    writeSession();
  }

  /** E-mailadres van de ingelogde beheerder, of '' (ook als de sessie niet meer te verlengen is). */
  function signedIn() {
    if (admin && !admin.refresh && Date.now() > admin.expiresAt - 30000) signOut();
    return admin ? admin.email : '';
  }

  function isAdmin() {
    return Boolean(admin && admin.isAdmin !== false);
  }

  /** Verlengt de sessie als die (bijna) verlopen is. */
  async function ensureSession() {
    if (!admin) throw new Error('niet ingelogd');
    if (Date.now() < admin.expiresAt - 60000) return;
    const response = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: headers(null),
      body: JSON.stringify({ refresh_token: admin.refresh })
    });
    if (!response.ok) {
      signOut();
      throw new Error('je sessie is verlopen, log opnieuw in');
    }
    setSession(await response.json());
  }

  async function adminHeaders(extra) {
    await ensureSession();
    return headers(admin.token, extra);
  }

  async function failure(response, what) {
    if (response.status === 401) {
      signOut();
      return new Error('je sessie is verlopen, log opnieuw in');
    }
    if (await isMissingTable(response)) return new Error('de tabellen of functies ontbreken nog: voer setup/supabase-audit.sql en setup/supabase-audit-bewerken.sql uit');
    let detail = '';
    try {
      const data = await response.json();
      // Weigering uit de database (42501), met de reden erbij
      if (response.status === 403 || (data && data.code === '42501')) return new Error(data && data.message && data.code === '42501' ? data.message : 'geen beheerdersrechten voor deze actie');
      // 23514: de controle in de database kent deze soort nog niet (bijv. agents)
      if (data && data.code === '23514') return new Error('de database kent deze soort inhoud nog niet: voer setup/supabase-audit.sql opnieuw uit');
      detail = data && data.message ? ': ' + data.message : '';
    } catch (error) {
      /* geen details */
    }
    return new Error(`${what} mislukt (${response.status})${detail}`);
  }

  async function readAll(table, select, order) {
    const rows = [];
    for (let offset = 0; offset < 100000; offset += PAGE_SIZE) {
      const query = `?select=${select}&namespace=eq.${encodeURIComponent(config.namespace)}&order=${order}&limit=${PAGE_SIZE}&offset=${offset}`;
      const response = await request('/rest/v1/' + table + query, { headers: await adminHeaders() });
      if (!response.ok) throw await failure(response, 'lezen');
      const page = await response.json();
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  /* ---- Beheer: inhoud (namespace: standaard die van de discipline) ------------------------ */
  const contentFilter = (type, id, namespace) => `?namespace=eq.${encodeURIComponent(namespace || config.namespace)}&type=eq.${encodeURIComponent(type)}&id=eq.${encodeURIComponent(id)}`;

  /**
   * Eén of meer rijen opslaan (nieuw of bestaand). rows: [{ type, id, data, position, status }].
   * options.onlyNew: bestaande rijen met hetzelfde adres blijven zoals ze zijn (bij inrichten en
   * overzetten: nooit per ongeluk de database overschrijven met de bestanden).
   */
  async function saveContent(rows, namespace, options) {
    const resolution = options && options.onlyNew ? 'ignore-duplicates' : 'merge-duplicates';
    const list = (Array.isArray(rows) ? rows : [rows]).map((row) => ({
      namespace: namespace || config.namespace,
      type: row.type,
      id: row.id,
      data: row.data,
      position: Number.isFinite(row.position) ? row.position : 0,
      status: row.status || 'published'
    }));
    for (let start = 0; start < list.length; start += 200) {
      const response = await request('/rest/v1/' + TABLES.content + '?on_conflict=namespace,type,id', {
        method: 'POST',
        headers: await adminHeaders({ Prefer: `resolution=${resolution},return=minimal` }),
        body: JSON.stringify(list.slice(start, start + 200))
      });
      if (!response.ok) throw await failure(response, 'opslaan');
    }
    return true;
  }

  // Wat een wijziging teruggeeft: alleen het adres (meer kolommen mag een ingelogde gebruiker na stap 8 niet lezen)
  const RETURN_KEY = '&select=namespace,type,id';

  /** Alleen bepaalde kolommen aanpassen, bijv. { status } of { position }. */
  async function patchContent(type, id, patch, namespace) {
    const response = await request('/rest/v1/' + TABLES.content + contentFilter(type, id, namespace) + RETURN_KEY, {
      method: 'PATCH',
      headers: await adminHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch)
    });
    if (!response.ok) throw await failure(response, 'opslaan');
    const result = await response.json();
    if (!result.length) throw new Error('niet gevonden of geen beheerdersrechten');
    return result[0];
  }

  /** Definitief verwijderen (de vorige versie blijft in de geschiedenis). */
  async function deleteContent(type, id, namespace) {
    const response = await request('/rest/v1/' + TABLES.content + contentFilter(type, id, namespace) + RETURN_KEY, {
      method: 'DELETE',
      headers: await adminHeaders({ Prefer: 'return=representation' })
    });
    if (!response.ok) throw await failure(response, 'verwijderen');
    const result = await response.json();
    if (!result.length) throw new Error('niet gevonden of geen beheerdersrechten');
    return true;
  }

  /* ---- Beheer: ideeënhub ---------------------------------------------------------------- */
  /** Alle inzendingen, met naam en e-mailadres. Alleen voor een beheerder. */
  function adminListIdeas() {
    return readAll(TABLES.ideas, '*', 'created_at.desc');
  }

  /** Status, antwoord en publicatie aanpassen. */
  async function adminUpdateIdea(id, patch) {
    const response = await request(`/rest/v1/${TABLES.ideas}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: await adminHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch)
    });
    if (!response.ok) throw await failure(response, 'opslaan');
    const rows = await response.json();
    // Geen rij terug = geen rechten op deze rij (RLS): behandel als geweigerd.
    if (!rows.length) throw new Error('geen beheerdersrechten (staat je e-mailadres in audit_admins?)');
    return rows[0];
  }

  async function adminDeleteIdea(id) {
    const response = await request(`/rest/v1/${TABLES.ideas}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await adminHeaders({ Prefer: 'return=representation' })
    });
    if (!response.ok) throw await failure(response, 'verwijderen');
    const rows = await response.json();
    if (!rows.length) throw new Error('niet verwijderd (geen beheerdersrechten?)');
    return true;
  }

  /* ---- Beheer: reviews ------------------------------------------------------------------- */
  /** Alle reviews van deze discipline, ook de niet-gepubliceerde toelichtingen. */
  function adminListReviews() {
    return readAll(TABLES.reviews, 'id,item_type,item_id,rating,comment,is_public,created_at', 'created_at.desc');
  }

  /** Bijv. { is_public: true } om een toelichting te publiceren. */
  async function adminUpdateReview(id, patch) {
    const response = await request(`/rest/v1/${TABLES.reviews}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: await adminHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch)
    });
    if (!response.ok) throw await failure(response, 'opslaan');
    const rows = await response.json();
    if (!rows.length) throw new Error('geen beheerdersrechten (staat je e-mailadres in audit_admins?)');
    return rows[0];
  }

  async function adminDeleteReview(id) {
    const response = await request(`/rest/v1/${TABLES.reviews}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await adminHeaders({ Prefer: 'return=representation' })
    });
    if (!response.ok) throw await failure(response, 'verwijderen');
    const rows = await response.json();
    if (!rows.length) throw new Error('niet verwijderd (geen beheerdersrechten?)');
    return true;
  }

  /** Tellers van de afgelopen dagen. */
  async function adminEvents(days) {
    const since = new Date(Date.now() - (days || 90) * 86400000).toISOString();
    const rows = [];
    for (let offset = 0; offset < 200000; offset += PAGE_SIZE) {
      const query = `?select=kind,item_id,occurred_at&namespace=eq.${encodeURIComponent(config.namespace)}&occurred_at=gte.${encodeURIComponent(since)}&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`;
      const response = await request('/rest/v1/' + TABLES.events + query, { headers: await adminHeaders() });
      if (!response.ok) throw await failure(response, 'tellers lezen');
      const page = await response.json();
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  /* ---- Beheer: werkversies, publiceren, logboek, beheerders, media (stap 7) ------------------ */
  async function rpc(name, body, what) {
    const response = await request('/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify(body || {})
    });
    if (!response.ok) throw await failure(response, what || 'opslaan');
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /** Staan de werkversies in de database (stap 7 uitgevoerd)? null = nog onbekend. */
  const draftingAvailable = () => drafting;

  /**
   * Werkversie opslaan: { namespace, type, id, draft: { data, position, status }, version?, title? }.
   * @returns {Promise<{ ok, version, kind } | { conflict, version, draft_by, draft_at, updated_by, updated_at }>}
   */
  function saveDraft(item) {
    return rpc('audit_save_draft', {
      p_namespace: item.namespace || config.namespace,
      p_type: item.type,
      p_id: item.id,
      p_draft: item.draft,
      p_version: Number.isFinite(item.version) ? item.version : null,
      p_title: item.title || null
    });
  }

  function discardDraft(type, id, namespace) {
    return rpc('audit_discard_draft', { p_namespace: namespace || config.namespace, p_type: type, p_id: id }, 'weggooien');
  }

  /** Publiceren (of plannen met at: Date in de toekomst). items: [{ namespace, type, id }] */
  function publish(items, at) {
    return rpc('audit_publish', { p_items: items, p_at: at ? new Date(at).toISOString() : null }, 'publiceren');
  }

  function unschedule(type, id, namespace) {
    return rpc('audit_unschedule', { p_namespace: namespace || config.namespace, p_type: type, p_id: id }, 'planning aanpassen');
  }

  /** Meld dat je dit item open hebt; geeft [{ editor, since }] van anderen die het ook open hebben. */
  async function ping(type, id, namespace) {
    try {
      return (await rpc('audit_ping', { p_namespace: namespace || config.namespace, p_type: type, p_id: id }, 'melden')) || [];
    } catch (error) {
      return [];
    }
  }

  function leave(type, id, namespace) {
    return rpc('audit_leave', { p_namespace: namespace || config.namespace, p_type: type, p_id: id }, 'afmelden').catch(() => null);
  }

  /** Logboek: de laatste wijzigingen in deze naamruimtes (nieuwste eerst). */
  async function listLog(namespaces, limit) {
    const list = (namespaces && namespaces.length ? namespaces : [config.namespace]).map(encodeURIComponent).join(',');
    const query = `?select=id,at,actor,namespace,type,item_id,title,action,detail&namespace=in.(${list},*)&order=at.desc&limit=${limit || 200}`;
    const response = await request('/rest/v1/' + TABLES.log + query, { headers: await adminHeaders() });
    if (!response.ok) throw await failure(response, 'logboek lezen');
    return response.json();
  }

  /** Eerdere gepubliceerde versies van één item (nieuwste eerst). */
  async function listHistory(type, id, namespace) {
    const query = `?select=hist_id,data,status,action,changed_at,changed_by&namespace=eq.${encodeURIComponent(namespace || config.namespace)}&type=eq.${encodeURIComponent(type)}&id=eq.${encodeURIComponent(id)}&order=changed_at.desc&limit=50`;
    const response = await request('/rest/v1/' + TABLES.history + query, { headers: await adminHeaders() });
    if (!response.ok) throw await failure(response, 'geschiedenis lezen');
    return response.json();
  }

  function listAdmins() {
    return rpc('audit_list_admins', {}, 'beheerders lezen');
  }

  function setAdmin(email, namespace, role, sections) {
    return rpc('audit_set_admin', { p_email: email, p_namespace: namespace, p_role: role, p_sections: sections || [] }, 'opslaan');
  }

  function removeAdmin(email, namespace, role) {
    return rpc('audit_remove_admin', { p_email: email, p_namespace: namespace, p_role: role }, 'verwijderen');
  }

  /**
   * Bestand uploaden naar de map cockpit-media (afbeelding, video of PDF).
   * path: '<naamruimte>/<soort>/<bestandsnaam>'. Geeft het openbare adres.
   */
  async function upload(file, path) {
    const clean = String(path).split('/').map((part) => encodeURIComponent(part)).join('/');
    const response = await request(`/storage/v1/object/${MEDIA_BUCKET}/${clean}`, {
      method: 'POST',
      headers: await adminHeaders({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': 'max-age=31536000' }),
      body: file
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('de map voor bestanden ontbreekt nog: voer setup/supabase-audit-bewerken.sql uit');
      if (response.status === 413) throw new Error('het bestand is te groot (maximaal 50 MB)');
      throw await failure(response, 'uploaden');
    }
    return mediaUrl(path);
  }

  /** Openbaar adres van een bestand in cockpit-media. */
  function mediaUrl(path) {
    return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${String(path).split('/').map((part) => encodeURIComponent(part)).join('/')}`;
  }

  /** Is dit een adres van een geüpload bestand (in dit Supabase-project)? */
  function isMediaUrl(url) {
    return Boolean(base) && String(url || '').startsWith(`${base}/storage/v1/object/public/${MEDIA_BUCKET}/`);
  }

  ns.central = {
    init,
    isEnabled,
    fetchContent,
    publishDue,
    draftingAvailable,
    rights,
    refreshRights,
    saveDraft,
    discardDraft,
    publish,
    unschedule,
    ping,
    leave,
    listLog,
    listHistory,
    listAdmins,
    setAdmin,
    removeAdmin,
    upload,
    mediaUrl,
    isMediaUrl,
    submitIdea,
    listIdeas,
    vote,
    submitReview,
    reviewStats,
    listReviews,
    track,
    signIn,
    signOut,
    signedIn,
    isAdmin,
    saveContent,
    patchContent,
    deleteContent,
    adminListIdeas,
    adminUpdateIdea,
    adminDeleteIdea,
    adminListReviews,
    adminUpdateReview,
    adminDeleteReview,
    adminEvents
  };
})(window.AIAudit);
