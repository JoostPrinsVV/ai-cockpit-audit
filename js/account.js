/* ==========================================================================
   Account: wie ben je? (voor de AI-brevetten)
   --------------------------------------------------------------------------
   De rest van de cockpit vraagt alleen ns.account.current() en token(); hoe je
   inlogt, staat alleen hier. Echte accounts in Supabase (stap 12), in te stellen
   in js/config.js (brevet.login):

     'microsoft'  inloggen met je Microsoft-account van V&V (de Azure-koppeling
                  van Supabase, alleen de V&V-tenant; zie README, 'AI-brevetten');
     'email'      een inloglink naar je V&V-mailadres.

   Wie voor het eerst inlogt, heeft nog geen logboek: meedoen begint altijd onderaan
   de ladder. Na de migratie naar de Microsoft-omgeving met SSO: alleen deze laag
   aanpassen (zie README, 'Migratie'). De sleutel van je logboek is je zakelijke
   e-mailadres; dat is in Supabase en in Microsoft hetzelfde.
   De sessie staat in de lokale opslag ('account'), zodat je ingelogd blijft.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { storage } = ns.ui;
  const KEY = 'account';
  const EVENT = 'ai:account';
  // Van de oude demo met fictieve collega's: bij het opstarten weg uit iedere browser
  const OLD_DEMO_KEYS = ['brevet-demo', 'brevet-demo-als'];

  let options = { login: 'microsoft', domain: 'visser-visser.nl' };
  let session = null; // { token, refresh, email, expiresAt }

  const domain = () => String(options.domain || '').toLowerCase();
  const emit = () => document.dispatchEvent(new CustomEvent(EVENT));

  /** Hoort dit adres bij V&V (het domein uit de instellingen)? */
  function allowed(email) {
    const address = String(email || '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && (!domain() || address.endsWith('@' + domain()));
  }

  /* ---- Supabase: sessie --------------------------------------------------------------- */
  function store() {
    if (session) storage.set(KEY, session);
    else storage.remove(KEY);
  }

  function fromAuth(data) {
    const email = String((data.user && data.user.email) || data.email || (session && session.email) || '').toLowerCase();
    return {
      token: data.access_token,
      refresh: data.refresh_token || (session && session.refresh) || '',
      email,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
    };
  }

  /** Het e-mailadres uit het token (de inhoud van een JWT is leesbaar; de database controleert het echt). */
  function emailOfToken(token) {
    try {
      const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const data = JSON.parse(decodeURIComponent(escape(window.atob(part))));
      return String(data.email || '').toLowerCase();
    } catch (error) {
      return '';
    }
  }

  /**
   * Terug van de inloglink of van Microsoft: de sessie staat in het adres (#access_token=…).
   * Meteen weghalen uit het adres (en uit de geschiedenis), en door naar je logboek.
   */
  function consumeRedirect() {
    const hash = window.location.hash.replace(/^#/, '');
    if (!/(^|&)(access_token|error)=/.test(hash)) return null;
    const params = new URLSearchParams(hash);
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + '#/mijn');
    if (params.get('error')) return { error: params.get('error_description') || params.get('error') };
    const token = params.get('access_token');
    const email = emailOfToken(token);
    if (!allowed(email)) return { error: 'Alleen met een e-mailadres van ' + (domain() || 'je organisatie') + '.' };
    session = fromAuth({ access_token: token, refresh_token: params.get('refresh_token'), expires_in: params.get('expires_in'), email });
    store();
    return { ok: true };
  }

  /* ---- Voor iedereen ------------------------------------------------------------------ */
  let notice = null; // melding na terugkomen van het inloggen (getoond op Mijn logboek)

  function init(config) {
    options = Object.assign(options, (config && config.brevet) || {});
    OLD_DEMO_KEYS.forEach((key) => storage.remove(key));
    session = storage.get(KEY, null);
    if (session && (!session.token || !allowed(session.email))) {
      session = null;
      store();
    }
    notice = consumeRedirect();
  }

  /** Wie ben je: { email, name } of null (niet ingelogd). */
  function current() {
    const name = ns.profile ? ns.profile.get().naam : '';
    if (!session) return null;
    // Zonder te verlengen kan het niet meer: uitgelogd
    if (!session.refresh && Date.now() > session.expiresAt - 30000) {
      signOut();
      return null;
    }
    return { email: session.email, name };
  }

  /** Een geldig token (verlengt zo nodig), of '' als je niet bent ingelogd. */
  async function token() {
    if (!session) return '';
    if (Date.now() < session.expiresAt - 60000) return session.token;
    const data = await ns.central.refreshParticipant(session.refresh);
    if (!data) {
      signOut();
      return '';
    }
    session = fromAuth(data);
    store();
    return session.token;
  }

  /**
   * Inloggen. method 'email': een link naar je V&V-mailadres; geeft 'sent',
   * 'domain' (geen V&V-adres) of 'failed'. method 'microsoft': door naar Microsoft (komt terug met #access_token);
   * geeft 'not-ready' zolang Microsoft of nieuwe accounts in Supabase nog uit staan (dan geen foutpagina).
   */
  async function signIn(method, email) {
    const back = window.location.origin + window.location.pathname + window.location.search;
    if (method === 'microsoft') {
      const settings = await ns.central.authSettings();
      if (settings && (!settings.providers.azure || !settings.signup)) return 'not-ready';
      window.location.assign(ns.central.authorizeUrl('azure', back));
      return 'redirect';
    }
    const address = String(email || '').trim().toLowerCase();
    if (!allowed(address)) return 'domain';
    return (await ns.central.sendLoginLink(address, back)) ? 'sent' : 'failed';
  }

  function signOut() {
    session = null;
    store();
    emit();
  }

  /** De melding van het terugkomen (één keer). */
  function takeNotice() {
    const result = notice;
    notice = null;
    return result;
  }

  function onChange(handler) {
    document.addEventListener(EVENT, handler);
    return () => document.removeEventListener(EVENT, handler);
  }

  ns.account = { init, login: () => options.login, domain, allowed, current, token, signIn, signOut, takeNotice, onChange, emailOfToken };
})(window.AIAudit);
