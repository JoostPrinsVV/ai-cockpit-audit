/* ==========================================================================
   Centrale opslag (Supabase)
   --------------------------------------------------------------------------
   Hetzelfde Supabase-project als de AI Snackbar, met eigen tabellen
   (setup/supabase-audit.sql):

     audit_content      de inhoud: usecases, prompts, tips, trainingen, agents, fasen, teksten
     audit_ideas        inzendingen uit de ideeënhub
     audit_idea_votes   'Ik ook'-stemmen (één per apparaat per inzending)
     audit_events       anonieme tellers: bekeken, afgespeeld, gekopieerd

   Rechten (Row Level Security):
   - Iedereen mag gepubliceerde inhoud lezen.
   - Iedereen mag een inzending, stem of teller tóévoegen.
   - Iedereen mag alleen inzendingen lezen die een beheerder heeft
     gepubliceerd, en dan zonder naam en e-mailadres.
   - Inhoud aanpassen en alles lezen, beantwoorden, publiceren en wissen kan
     alleen een beheerder die inlogt (e-mailadres in de tabel audit_admins).

   Inloggen: de sessie staat in sessionStorage (alleen dit tabblad; weg zodra
   je het tabblad sluit) en wordt automatisch verlengd zolang je bezig bent.

   Geen bibliotheek: alleen fetch() naar de REST- en Auth-adressen van Supabase.
   ========================================================================== */
(function (ns) {
  'use strict';

  const TABLES = { ideas: 'audit_ideas', votes: 'audit_idea_votes', events: 'audit_events', content: 'audit_content' };
  // Kolommen die iedereen mag lezen (geen naam of e-mailadres).
  const PUBLIC_COLUMNS = 'id,ref,created_at,kind,title,body,phase,status,answer,answered_at,votes';
  const CONTENT_COLUMNS = 'type,id,data,position,status,updated_at';
  const PAGE_SIZE = 1000;
  const SESSION_KEY = 'ai-snackbar-audit:sessie';

  let config = {};
  let base = '';
  let key = '';
  let enabled = false;
  let trackingOff = false;
  let admin = null; // { token, refresh, email, expiresAt, isAdmin }

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
  /**
   * Alle inhoudsrijen. Met een beheerderssessie ook concepten en de prullenbak.
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', rows: object[] }>}
   */
  async function fetchContent(options) {
    if (!enabled) return { status: 'off', rows: [] };
    const asAdmin = options && options.admin && signedIn();
    const query = `?select=${CONTENT_COLUMNS}&namespace=eq.${encodeURIComponent(config.namespace)}&order=type.asc,position.asc,id.asc&limit=5000`;
    try {
      const response = await request('/rest/v1/' + TABLES.content + query, { headers: asAdmin ? await adminHeaders() : headers(null) });
      if (response.ok) return { status: 'ok', rows: await response.json() };
      if (await isMissingTable(response)) return { status: 'missing', rows: [] };
      return { status: 'failed', rows: [] };
    } catch (error) {
      return { status: 'failed', rows: [] };
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
      isAdmin: admin ? admin.isAdmin : null
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
   * @returns {Promise<'ok'|'not-admin'|'failed'>} not-admin = ingelogd, maar niet in audit_admins
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
      admin.isAdmin = await checkAdmin();
      writeSession();
      return admin.isAdmin === false ? 'not-admin' : 'ok';
    } catch (error) {
      signOut();
      return 'failed';
    }
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
    if (response.status === 403) return new Error('geen beheerdersrechten (staat je e-mailadres in audit_admins?)');
    if (await isMissingTable(response)) return new Error('de tabellen ontbreken nog: voer setup/supabase-audit.sql uit');
    let detail = '';
    try {
      const data = await response.json();
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

  /* ---- Beheer: inhoud --------------------------------------------------------------- */
  const contentFilter = (type, id) => `?namespace=eq.${encodeURIComponent(config.namespace)}&type=eq.${encodeURIComponent(type)}&id=eq.${encodeURIComponent(id)}`;

  /** Eén of meer rijen opslaan (nieuw of bestaand). rows: [{ type, id, data, position, status }] */
  async function saveContent(rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((row) => ({
      namespace: config.namespace,
      type: row.type,
      id: row.id,
      data: row.data,
      position: Number.isFinite(row.position) ? row.position : 0,
      status: row.status || 'published'
    }));
    for (let start = 0; start < list.length; start += 200) {
      const response = await request('/rest/v1/' + TABLES.content + '?on_conflict=namespace,type,id', {
        method: 'POST',
        headers: await adminHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(list.slice(start, start + 200))
      });
      if (!response.ok) throw await failure(response, 'opslaan');
    }
    return true;
  }

  /** Alleen bepaalde kolommen aanpassen, bijv. { status } of { position }. */
  async function patchContent(type, id, patch) {
    const response = await request('/rest/v1/' + TABLES.content + contentFilter(type, id), {
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
  async function deleteContent(type, id) {
    const response = await request('/rest/v1/' + TABLES.content + contentFilter(type, id), {
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

  ns.central = {
    init,
    isEnabled,
    fetchContent,
    submitIdea,
    listIdeas,
    vote,
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
    adminEvents
  };
})(window.AIAudit);
