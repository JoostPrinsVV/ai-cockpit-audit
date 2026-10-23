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
     audit_copilot_usage totalen van het Copilot-gebruik per periode (stap 9,
                        setup/supabase-audit-copilot.sql; alleen hoofdbeheerders)

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
   Twee soorten verzoeken:
   - voor bezoekers (read, add): een fout komt terug als status ('missing',
     'failed', 'off'), zodat de pagina gewoon verder kan;
   - voor beheerders (adminRead, readAll, changeOne, rpc): een fout wordt een
     Error met een uitleg die Beheer kan tonen.
   ========================================================================== */
(function (ns) {
  'use strict';

  const TABLES = { ideas: 'audit_ideas', votes: 'audit_idea_votes', events: 'audit_events', content: 'audit_content', reviews: 'audit_reviews', log: 'audit_log', history: 'audit_content_history', copilot: 'audit_copilot_usage' };
  const COPILOT_COLUMNS = 'id,period_start,period_end,source,summary,imported_at,imported_by';
  // Kolommen die iedereen mag lezen (geen naam of e-mailadres).
  const PUBLIC_COLUMNS = 'id,ref,created_at,kind,title,body,phase,status,answer,answered_at,votes';
  const CONTENT_COLUMNS = 'namespace,type,id,data,position,status,updated_at';
  // Voor beheerders ook de werkversie (stap 7 in setup/supabase-audit-bewerken.sql)
  const DRAFT_COLUMNS = CONTENT_COLUMNS + ',updated_by,draft,draft_kind,draft_by,draft_at,publish_at,publish_by,version';
  // Wat een wijziging teruggeeft: alleen het adres (meer kolommen mag een ingelogde gebruiker na stap 8 niet lezen)
  const KEY_COLUMNS = 'namespace,type,id';
  const MEDIA_BUCKET = 'cockpit-media';
  const PAGE_SIZE = 1000;
  const MAX_ROWS = 200000;
  const RPC = '/rest/v1/rpc/';
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

  /** POST met een JSON-body (token: met de sessie van de beheerder, anders als bezoeker). */
  const post = (body, token) => ({ method: 'POST', headers: headers(token || null), body: JSON.stringify(body || {}) });

  /**
   * Adres van een tabel met zoekparameters (PostgREST: kolom=operator.waarde), bijv.
   * { select: 'id,title', namespace: 'eq.ai-audit' }. Geen URLSearchParams: die maakt van een
   * spatie een '+', en dat leest PostgREST niet overal als spatie.
   */
  function tablePath(table, params) {
    const query = Object.keys(params).map((name) => name + '=' + encodeURIComponent(params[name])).join('&');
    return '/rest/v1/' + table + (query ? '?' + query : '');
  }

  const inNamespace = (namespace) => 'eq.' + (namespace || config.namespace);

  /** Filter op één waarde of op een lijst ervan. */
  const oneOf = (values) => (values.length === 1 ? 'eq.' + values[0] : `in.(${values.join(',')})`);

  /** Eén item in audit_content (of in de geschiedenis daarvan). */
  const itemFilter = (type, id, namespace) => ({ namespace: inNamespace(namespace), type: 'eq.' + type, id: 'eq.' + id });

  async function errorCode(response) {
    try {
      const data = await response.clone().json();
      return data && data.code ? String(data.code) : '';
    } catch (error) {
      return '';
    }
  }

  /** 404 = tabel of functie ontbreekt (SQL nog niet uitgevoerd); PGRST205 en 42P01 zijn dezelfde melding in nieuwere versies. */
  async function isMissingTable(response) {
    if (response.status === 404) return true;
    return response.status === 400 && ['PGRST205', '42P01'].includes(await errorCode(response));
  }

  /** 'ok', 'missing' (SQL nog niet uitgevoerd) of 'failed' (met een melding in de console). */
  async function outcome(response, what) {
    if (response.ok) return 'ok';
    if (await isMissingTable(response)) return 'missing';
    console.warn(`[AI Cockpit Audit] ${what} mislukt:`, response.status, await errorCode(response));
    return 'failed';
  }

  /**
   * Lezen als bezoeker (standaard een GET).
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', items: object[] }>}
   */
  async function read(path, what, init) {
    if (!enabled) return { status: 'off', items: [] };
    try {
      const response = await request(path, init || { headers: headers(null) });
      const status = await outcome(response, what);
      return { status, items: status === 'ok' ? await response.json() : [] };
    } catch (error) {
      return { status: 'failed', items: [] }; // geen verbinding
    }
  }

  /**
   * Eén rij toevoegen als bezoeker. 409: die bestaat al (zelfde apparaat, zelfde item).
   * @returns {Promise<'ok'|'duplicate'|'missing'|'failed'|'off'>}
   */
  async function add(table, row, what) {
    if (!enabled) return 'off';
    const body = JSON.stringify([row]);
    try {
      const response = await request('/rest/v1/' + table, {
        method: 'POST',
        headers: headers(null, { Prefer: 'return=minimal' }),
        body,
        keepalive: body.length < 60000
      });
      return response.status === 409 ? 'duplicate' : await outcome(response, what);
    } catch (error) {
      return 'failed'; // geen verbinding
    }
  }

  /* ---- Inhoud (voor iedereen: alleen gepubliceerd) -------------------------------- */
  /**
   * Alle inhoudsrijen (options.namespaces: welke naamruimtes, standaard die van de discipline).
   * Met een beheerderssessie ook concepten en de prullenbak.
   * @returns {Promise<{ status: 'ok'|'missing'|'failed'|'off', rows: object[] }>}
   */
  async function fetchContent(options) {
    if (!enabled) return { status: 'off', rows: [] };
    const opts = options || {};
    const namespaces = Array.isArray(opts.namespaces) && opts.namespaces.length ? opts.namespaces : [config.namespace];
    const query = (columns) => tablePath(TABLES.content, { select: columns, namespace: oneOf(namespaces), order: 'type.asc,position.asc,id.asc', limit: 5000 });
    try {
      const response = opts.admin && signedIn() ? await editorContent(namespaces, query) : await request(query(CONTENT_COLUMNS), { headers: headers(null) });
      const status = await outcome(response, 'Inhoud lezen');
      return { status, rows: status === 'ok' ? await response.json() : [] };
    } catch (error) {
      return { status: 'failed', rows: [] };
    }
  }

  /** Met een beheerderssessie: ook de werkversies, zolang de database die kent. */
  async function editorContent(namespaces, query) {
    await ensureSession();
    const auth = { headers: headers(admin.token) };
    if (drafting !== false) {
      // Met stap 8: werkversies alleen in de naamruimtes waar je een rol hebt
      let response = await request(RPC + 'audit_content_editor', post({ p_namespaces: namespaces }, admin.token));
      // Stap 8 nog niet uitgevoerd: de kolommen rechtstreeks, zoals daarvoor
      if (response.status === 404 || (!response.ok && (await errorCode(response)) === 'PGRST202')) response = await request(query(DRAFT_COLUMNS), auth);
      if (response.ok) drafting = true;
      // 42703: de kolommen van de werkversie bestaan nog niet (stap 7 nog niet uitgevoerd)
      if (response.ok || response.status !== 400 || (await errorCode(response)) !== '42703') return response;
      drafting = false;
    }
    return request(query(CONTENT_COLUMNS), auth);
  }

  /** Geplande publicaties uitvoeren waarvan het moment voorbij is (doet niets als er niets klaarstaat). */
  async function publishDue() {
    if (!enabled) return 0;
    try {
      const response = await request(RPC + 'audit_publish_due', post());
      return response.ok ? Number(await response.json()) || 0 : 0;
    } catch (error) {
      return 0;
    }
  }

  /* ---- Ideeënhub ------------------------------------------------------------- */
  /**
   * Nieuwe inzending. Gaat direct naar Supabase en wordt niet op het apparaat bewaard
   * (alleen titel, soort en referentie, voor 'Jouw inzendingen').
   */
  function submitIdea(idea) {
    return add(TABLES.ideas, {
      namespace: config.namespace,
      ref: idea.ref,
      kind: idea.kind,
      title: idea.title,
      body: idea.body,
      phase: idea.phase || null,
      name: idea.name || null,
      email: idea.email || null,
      allow_public: idea.allowPublic !== false
    }, 'Inzending versturen');
  }

  /** Gepubliceerde inzendingen (voor iedereen zichtbaar). */
  function listIdeas() {
    return read(tablePath(TABLES.ideas, { select: PUBLIC_COLUMNS, namespace: inNamespace(), is_public: 'eq.true', order: 'created_at.desc', limit: 500 }), 'Inzendingen lezen');
  }

  /** 'Ik ook'. Dubbel stemmen (zelfde apparaat) geeft 'duplicate': telt als al gestemd. */
  function vote(ideaId, voterId) {
    return add(TABLES.votes, { idea_id: ideaId, voter: voterId }, 'Stemmen');
  }

  /* ---- Reviews van usecases en prompts --------------------------------------------- */
  /**
   * Nieuwe review: { type: 'usecase'|'prompt', id, rating (1-5), comment?, voter }.
   * Twee keer hetzelfde item vanaf één apparaat geeft 'duplicate': telt als al beoordeeld.
   */
  function submitReview(review) {
    return add(TABLES.reviews, {
      namespace: config.namespace,
      item_type: review.type,
      item_id: String(review.id).slice(0, 80),
      voter: review.voter,
      rating: review.rating,
      comment: review.comment || null
    }, 'Review versturen');
  }

  /** Gemiddelde en aantal reviews per item in deze discipline: items [{ item_type, item_id, reviews, average }]. */
  function reviewStats() {
    return read(RPC + 'audit_review_stats', 'Sterren lezen', post({ p_namespace: config.namespace }));
  }

  /** Gepubliceerde toelichtingen bij één item (nieuwste eerst). */
  function listReviews(type, id) {
    return read(tablePath(TABLES.reviews, { select: 'id,rating,comment,created_at', namespace: inNamespace(), item_type: 'eq.' + type, item_id: 'eq.' + id, order: 'created_at.desc', limit: 20 }), 'Reviews lezen');
  }

  /* ---- Anonieme tellers ----------------------------------------------------------- */
  /** kind: 'view_usecase' | 'play_demo' | 'copy_prompt' | 'view_tip' | 'copy_tip' | 'view_training' | 'play_training' | 'view_agent' | 'open_agent'. Geen persoonsgegevens. */
  function track(kind, itemId) {
    if (!enabled || trackingOff || !config.enableUsageStats || signedIn()) return; // beheerders tellen niet mee
    add(TABLES.events, { namespace: config.namespace, kind, item_id: String(itemId || '').slice(0, 80) }, 'Tellen').then((result) => {
      if (result === 'missing') trackingOff = true; // geen tabel: niet bij elke klik opnieuw proberen
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
      const response = await request(RPC + 'audit_is_admin', post({}, admin.token));
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
      const response = await request(RPC + 'audit_me', post({}, admin.token));
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
      const response = await request('/auth/v1/token?grant_type=password', post({ email, password }));
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
    const response = await request('/auth/v1/token?grant_type=refresh_token', post({ refresh_token: admin.refresh }));
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

  /* ---- Beheer: verzoeken -------------------------------------------------------------- */
  async function adminRead(path, what) {
    const response = await request(path, { headers: await adminHeaders() });
    if (!response.ok) throw await failure(response, what);
    return response.json();
  }

  /** Alles van deze discipline, in pagina's (params: kolommen, volgorde en eventueel extra filters). */
  async function readAll(table, params, what) {
    const rows = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const page = await adminRead(tablePath(table, Object.assign({ namespace: inNamespace() }, params, { limit: PAGE_SIZE, offset })), what || 'lezen');
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return rows;
  }

  /**
   * Eén rij aanpassen (met patch) of verwijderen (zonder). Geen rij terug betekent: niet gevonden,
   * of geen rechten op die rij (Row Level Security geeft dan geen fout, maar een lege lijst).
   */
  async function changeOne(path, patch) {
    const response = await request(path, {
      method: patch ? 'PATCH' : 'DELETE',
      headers: await adminHeaders({ Prefer: 'return=representation' }),
      body: patch ? JSON.stringify(patch) : undefined
    });
    if (!response.ok) throw await failure(response, patch ? 'opslaan' : 'verwijderen');
    const rows = await response.json();
    if (!rows.length) throw new Error('niet gevonden, of je hebt geen rechten op dit item');
    return rows[0];
  }

  async function rpc(name, body, what) {
    await ensureSession();
    const response = await request(RPC + name, post(body, admin.token));
    if (!response.ok) throw await failure(response, what || 'opslaan');
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /* ---- Beheer: inhoud (namespace: standaard die van de discipline) ------------------------ */
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
      const response = await request(tablePath(TABLES.content, { on_conflict: KEY_COLUMNS }), {
        method: 'POST',
        headers: await adminHeaders({ Prefer: `resolution=${resolution},return=minimal` }),
        body: JSON.stringify(list.slice(start, start + 200))
      });
      if (!response.ok) throw await failure(response, 'opslaan');
    }
    return true;
  }

  const contentRow = (type, id, namespace) => tablePath(TABLES.content, Object.assign(itemFilter(type, id, namespace), { select: KEY_COLUMNS }));

  /** Alleen bepaalde kolommen aanpassen, bijv. { status } of { position }. */
  function patchContent(type, id, patch, namespace) {
    return changeOne(contentRow(type, id, namespace), patch);
  }

  /** Definitief verwijderen (de vorige versie blijft in de geschiedenis). */
  function deleteContent(type, id, namespace) {
    return changeOne(contentRow(type, id, namespace));
  }

  /* ---- Beheer: ideeënhub, reviews en tellers ------------------------------------------- */
  const rowById = (table, id) => tablePath(table, { id: 'eq.' + id });

  /** Alle inzendingen, met naam en e-mailadres. Alleen voor een beheerder. */
  function adminListIdeas() {
    return readAll(TABLES.ideas, { select: '*', order: 'created_at.desc' });
  }

  /** Status, antwoord en publicatie aanpassen; geeft de bijgewerkte inzending. */
  function adminUpdateIdea(id, patch) {
    return changeOne(rowById(TABLES.ideas, id), patch);
  }

  function adminDeleteIdea(id) {
    return changeOne(rowById(TABLES.ideas, id));
  }

  /** Alle reviews van deze discipline, ook de niet-gepubliceerde toelichtingen. */
  function adminListReviews() {
    return readAll(TABLES.reviews, { select: 'id,item_type,item_id,rating,comment,is_public,created_at', order: 'created_at.desc' });
  }

  /** Bijv. { is_public: true } om een toelichting te publiceren; geeft de bijgewerkte review. */
  function adminUpdateReview(id, patch) {
    return changeOne(rowById(TABLES.reviews, id), patch);
  }

  function adminDeleteReview(id) {
    return changeOne(rowById(TABLES.reviews, id));
  }

  /** Tellers van de afgelopen dagen. */
  function adminEvents(days) {
    const since = new Date(Date.now() - (days || 90) * 86400000).toISOString();
    return readAll(TABLES.events, { select: 'kind,item_id,occurred_at', occurred_at: 'gte.' + since, order: 'id.asc' }, 'tellers lezen');
  }

  /* ---- Beheer: Copilot-gebruik per periode (stap 9) ---------------------------------------- */
  /** De opgeslagen periodes van deze discipline, oudste eerst; null zolang stap 9 niet is uitgevoerd. */
  async function listCopilotUsage() {
    const response = await request(tablePath(TABLES.copilot, { select: COPILOT_COLUMNS, namespace: inNamespace(), order: 'period_end.asc', limit: 500 }), { headers: await adminHeaders() });
    if (await isMissingTable(response)) return null;
    if (!response.ok) throw await failure(response, 'Copilot-gebruik lezen');
    return response.json();
  }

  /** Totalen van één periode opslaan; een periode met dezelfde einddatum wordt vervangen. Geeft de rij. */
  async function saveCopilotUsage(snapshot) {
    const response = await request(tablePath(TABLES.copilot, { on_conflict: 'namespace,period_end', select: COPILOT_COLUMNS }), {
      method: 'POST',
      headers: await adminHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify({ namespace: config.namespace, period_start: snapshot.periodStart, period_end: snapshot.periodEnd, source: snapshot.source, summary: snapshot })
    });
    if (await isMissingTable(response)) throw new Error('de tabel ontbreekt nog: voer setup/supabase-audit-copilot.sql (stap 9) uit');
    if (!response.ok) throw await failure(response, 'opslaan');
    return (await response.json())[0];
  }

  function deleteCopilotUsage(id) {
    return changeOne(tablePath(TABLES.copilot, { id: 'eq.' + id, select: 'id' }));
  }

  /* ---- Beheer: werkversies, publiceren, logboek, beheerders, media (stap 7) ------------------ */
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

  /** De parameters van de functies die over één item gaan. */
  const itemArgs = (type, id, namespace) => ({ p_namespace: namespace || config.namespace, p_type: type, p_id: id });

  function discardDraft(type, id, namespace) {
    return rpc('audit_discard_draft', itemArgs(type, id, namespace), 'weggooien');
  }

  /** Publiceren (of plannen met at: Date in de toekomst). items: [{ namespace, type, id }] */
  function publish(items, at) {
    return rpc('audit_publish', { p_items: items, p_at: at ? new Date(at).toISOString() : null }, 'publiceren');
  }

  function unschedule(type, id, namespace) {
    return rpc('audit_unschedule', itemArgs(type, id, namespace), 'planning aanpassen');
  }

  /** Meld dat je dit item open hebt; geeft [{ editor, since }] van anderen die het ook open hebben. */
  async function ping(type, id, namespace) {
    try {
      return (await rpc('audit_ping', itemArgs(type, id, namespace), 'melden')) || [];
    } catch (error) {
      return [];
    }
  }

  function leave(type, id, namespace) {
    return rpc('audit_leave', itemArgs(type, id, namespace), 'afmelden').catch(() => null);
  }

  /** Logboek: de laatste wijzigingen in deze naamruimtes en die voor de hele site ('*'), nieuwste eerst. */
  function listLog(namespaces, limit) {
    const list = (namespaces && namespaces.length ? namespaces : [config.namespace]).concat('*');
    return adminRead(tablePath(TABLES.log, { select: 'id,at,actor,namespace,type,item_id,title,action,detail', namespace: oneOf(list), order: 'at.desc', limit: limit || 200 }), 'logboek lezen');
  }

  /** Eerdere gepubliceerde versies van één item (nieuwste eerst). */
  function listHistory(type, id, namespace) {
    return adminRead(tablePath(TABLES.history, Object.assign({ select: 'hist_id,data,status,action,changed_at,changed_by' }, itemFilter(type, id, namespace), { order: 'changed_at.desc', limit: 50 })), 'geschiedenis lezen');
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

  /** Pad in de map cockpit-media, per deel gecodeerd (de schuine strepen blijven staan). */
  const mediaPath = (path) => `${MEDIA_BUCKET}/${String(path).split('/').map(encodeURIComponent).join('/')}`;

  /**
   * Bestand uploaden naar de map cockpit-media (afbeelding, video of PDF).
   * path: '<naamruimte>/<soort>/<bestandsnaam>'. Geeft het openbare adres.
   */
  async function upload(file, path) {
    const response = await request('/storage/v1/object/' + mediaPath(path), {
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
    return `${base}/storage/v1/object/public/${mediaPath(path)}`;
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
    adminEvents,
    listCopilotUsage,
    saveCopilotUsage,
    deleteCopilotUsage
  };
})(window.AIAudit);
