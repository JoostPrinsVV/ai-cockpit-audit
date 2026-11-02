/* ==========================================================================
   Opslag van de AI-brevetten: accounts en het feitenlogboek
   --------------------------------------------------------------------------
   Eén set functies, twee opslagplekken (js/account.js bepaalt welke):

     demo      alles in deze browser (lokale opslag 'brevet-demo'), met fictieve
               collega's, zodat je Beheer, de ranglijst van brevetten en de
               promotie al kunt testen zonder echte persoonsgegevens;
     supabase  de tabellen audit_accounts en audit_brevet_facts (stap 12,
               setup/supabase-audit-brevetten.sql), via js/central.js.

   Een feit: { id, email, kind, item, detail, namespace, at, by }. Feiten worden
   nooit aangepast, alleen toegevoegd (of door beheer verwijderd); dezelfde soort
   met hetzelfde item bestaat hoogstens één keer per persoon.
   Na een migratie: alleen de supabase-kant hier vervangen (zie README).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { storage } = ns.ui;
  const DEMO_KEY = 'brevet-demo';
  const ACCOUNT_FIELDS = ['name', 'team', 'vestiging', 'joined_at', 'share_brevet', 'level', 'level_seen'];

  const isDemo = () => ns.account.mode() === 'demo';
  const me = () => {
    const account = ns.account.current();
    return account ? account.email : '';
  };
  const pick = (patch) => Object.fromEntries(Object.entries(patch || {}).filter(([name]) => ACCOUNT_FIELDS.includes(name)));

  /* ---- Demo: fictieve collega's ------------------------------------------------------- */
  // Namen zijn verzonnen; e-mailadressen eindigen op @demo.cockpit (geen echte adressen)
  const PEOPLE = [
    { name: 'Fatima El Amrani', team: 'Audit', vestiging: 'Rotterdam', weeks: 20, prompts: 34, demos: 10, recordings: 1, live: 2, adopted: ['usecase', 'prompt', 'prompt', 'idee'], authorOf: 2, sessions: 1, nominated: true, start: 1200, share: true },
    { name: 'Sanne de Vries', team: 'Audit', vestiging: 'Groningen', weeks: 16, prompts: 28, demos: 8, recordings: 1, live: 1, adopted: ['prompt', 'idee', 'verbetering'], authorOf: 1, start: 300, share: true },
    { name: 'Eva Smit', team: 'Audit', vestiging: 'Leeuwarden', weeks: 14, prompts: 26, demos: 7, recordings: 1, live: 1, adopted: ['usecase', 'verbetering'], start: 400 },
    { name: 'Mark Jansen', team: 'Audit', vestiging: 'Groningen', weeks: 10, prompts: 16, demos: 4, recordings: 1, live: 0, adopted: [], share: true },
    { name: 'Lotte Mulder', team: 'Audit', vestiging: 'Zwolle', weeks: 10, prompts: 14, demos: 3, recordings: 0, live: 1, adopted: [] },
    { name: 'Daan Meijer', team: 'Audit', vestiging: 'Assen', weeks: 11, prompts: 14, demos: 3, recordings: 1, live: 0, adopted: [], away: 120 },
    { name: 'Thomas Bakker', team: 'Audit', vestiging: 'Rotterdam', weeks: 2, prompts: 4, demos: 1, recordings: 0, live: 0, adopted: [] },
    { name: 'Ruben de Jong', team: 'Audit', vestiging: 'Groningen', weeks: 1, prompts: 2, demos: 0, recordings: 0, live: 0, adopted: [], noCheck: true }
  ];
  // Wat lichtere deelnemers, voor een realistisch overzicht (en royalty's voor de auteurs)
  const FIRST = ['Anouk', 'Bram', 'Charlotte', 'Dennis', 'Emma', 'Floris', 'Hanna', 'Jesse', 'Kim', 'Lars', 'Mila', 'Niels', 'Olivia', 'Pieter', 'Roos', 'Sven', 'Tess', 'Victor', 'Wouter', 'Yara', 'Zoë', 'Joris', 'Iris', 'Koen'];
  const LAST = ['Postma', 'Hoekstra', 'Dijkstra', 'Kuipers', 'Veenstra', 'Brouwer', 'Wierda', 'Hendriks', 'Peters', 'Bosma', 'Schouten', 'Kramer', 'Prins', 'Boer', 'Vos', 'Haan', 'Bos', 'Wolters', 'Huisman', 'Jonker', 'Koster', 'Smits', 'Sijbesma', 'Zwart'];
  const PLACES = ['Groningen', 'Rotterdam', 'Leeuwarden', 'Zwolle', 'Assen', 'Drachten'];

  const slug = (name) => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

  /** Vaste reeks 'willekeurige' getallen (elke keer dezelfde demo). */
  function random(seed) {
    let value = seed;
    return () => {
      value = (value * 1103515245 + 12345) % 2147483648;
      return value / 2147483648;
    };
  }

  function seed() {
    const now = new Date(ns.brevet.dayOf(new Date()) + 'T12:00:00');
    const at = (daysAgo, hour, minute) => {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(hour, minute || 0, 0, 0);
      return date.toISOString();
    };
    const ids = (items, count, prefix) => {
      const found = (items || []).map((item) => item.id);
      while (found.length < count) found.push(prefix + '-demo-' + (found.length + 1));
      return found;
    };
    const prompts = ids(ns.content.prompts, 40, 'prompt');
    const usecases = ids(ns.content.usecases, 12, 'usecase');
    const trainings = ids(ns.content.trainings, 4, 'training');
    const accounts = [];
    const facts = [];
    let id = 0;
    const keys = new Set();
    const add = (email, kind, item, when, detail, by) => {
      const key = email + '|' + kind + '|' + item;
      if (keys.has(key)) return;
      keys.add(key);
      facts.push({ id: ++id, email, kind, item: String(item), detail: detail || null, namespace: 'ai-audit', at: when, by: by || email });
    };
    const roll = random(42);
    const authored = []; // [{ email, prompt }]

    const person = (info, index) => {
      const email = slug(info.name) + '@demo.cockpit';
      const away = info.away || 0;
      const first = away + info.weeks * 7;
      accounts.push({ email, name: info.name, team: info.team || 'Audit', vestiging: info.vestiging, joined_at: at(first + 1, 9), share_brevet: Boolean(info.share), level: '', level_seen: '' });
      add(email, 'tour_done', '', at(first, 9, 5));
      add(email, 'profile_done', '', at(first, 9, 8));
      if (!info.noCheck) add(email, 'policy_check', '', at(first, 9, 15));
      // Actieve dagen: drie per week (de laatste week soms twee), met per dag een paar prompts
      const days = [];
      for (let week = 0; week < info.weeks; week++) {
        const perWeek = week === 0 && info.weeks > 1 ? 2 : 3;
        for (let day = 0; day < perWeek; day++) days.push(away + week * 7 + day * 2);
      }
      days.forEach((daysAgo) => add(email, 'active_day', ns.brevet.dayOf(at(daysAgo, 9)), at(daysAgo, 9, 1)));
      const order = days.slice().reverse(); // oudste eerst
      for (let n = 0; n < info.prompts; n++) add(email, 'prompt_used', prompts[(index * 7 + n) % prompts.length], at(order[Math.floor(n / 4) % order.length], 10 + (n % 4), n % 60));
      for (let n = 0; n < info.demos; n++) add(email, 'demo_watched', usecases[(index * 3 + n) % usecases.length], at(order[(n * 2 + 1) % order.length], 14, n));
      for (let n = 0; n < Math.min(info.prompts, 6); n++) if (roll() > 0.4) add(email, 'prompt_rated', 'prompt:' + prompts[(index * 7 + n) % prompts.length], at(order[n % order.length], 15, n));
      for (let n = 0; n < info.recordings; n++) add(email, 'recording_watched', trainings[(index + n) % trainings.length], at(order[Math.min(order.length - 1, 3 + n)], 16));
      for (let n = 0; n < info.live; n++) add(email, 'training_attended', trainings[(index + n + 2) % trainings.length], at(order[Math.min(order.length - 1, 6 + n * 3)], 13), null, 'ai-team@demo.cockpit');
      info.adopted.forEach((kind, n) => add(email, 'contribution_adopted', 'demo-' + index + '-' + n, at(order[Math.min(order.length - 1, 8 + n * 5)], 11), { kind, title: 'Bijdrage (demo)' }, 'ai-team@demo.cockpit'));
      for (let n = 0; n < (info.authorOf || 0); n++) {
        const prompt = prompts[(index * 11 + n * 5 + 3) % prompts.length];
        add(email, 'prompt_author', prompt, at(first - 10, 12, n), null, 'ai-team@demo.cockpit');
        authored.push({ email, prompt });
      }
      if (info.sessions) add(email, 'session_given', 'sessie-' + index, at(away + 20, 15), { title: 'Copilot in het controleteam (demo)' }, 'ai-team@demo.cockpit');
      if (info.nominated) add(email, 'nominated', '', at(away + 10, 9), null, 'ai-team@demo.cockpit');
      if (info.start) add(email, 'bonus', 'start-' + index, at(first + 1, 9, 30), { miles: info.start, reason: 'Startsaldo (demo): eerder verdiende miles' }, 'ai-team@demo.cockpit');
    };
    PEOPLE.forEach(person);
    // Lichtere deelnemers: een paar weken, en de prompts van de auteurs
    FIRST.forEach((first, n) => {
      const name = first + ' ' + LAST[n % LAST.length];
      const info = { name, vestiging: PLACES[n % PLACES.length], weeks: 1 + (n % 5), prompts: 3 + (n % 9), demos: n % 4, recordings: n % 3 === 0 ? 1 : 0, live: 0, adopted: [], noCheck: n % 6 === 5, away: n % 7 === 6 ? 100 : 0 };
      person(info, PEOPLE.length + n);
      const email = slug(name) + '@demo.cockpit';
      authored.forEach((author, k) => {
        if ((n + k) % 4 !== 3) add(email, 'prompt_used', author.prompt, at(info.away + (n * 3 + k * 5) % 70, 11, k));
      });
    });
    return { accounts, facts, seq: id, version: 1 };
  }

  let demoCache = null;
  function demo() {
    if (demoCache) return demoCache;
    let data = storage.get(DEMO_KEY, null);
    if (!data || data.version !== 1 || !Array.isArray(data.accounts) || !Array.isArray(data.facts)) {
      data = seed();
      storage.set(DEMO_KEY, data);
    }
    demoCache = data;
    return data;
  }
  const saveDemo = () => storage.set(DEMO_KEY, demoCache);

  /** Demo opnieuw beginnen: alle fictieve collega's opnieuw, jouw demo-logboek leeg. */
  function resetDemo() {
    demoCache = null;
    storage.remove(DEMO_KEY);
    demo();
  }

  function demoAdd(rows, by) {
    const data = demo();
    let added = 0;
    rows.forEach((row) => {
      const email = String(row.email || '').toLowerCase();
      const item = String(row.item == null ? '' : row.item);
      if (!email || data.facts.some((fact) => fact.email === email && fact.kind === row.kind && fact.item === item)) return;
      data.facts.push({ id: ++data.seq, email, kind: row.kind, item, detail: row.detail || null, namespace: row.namespace || null, at: new Date().toISOString(), by: by || email });
      added += 1;
    });
    saveDemo();
    return added;
  }

  /* ---- Voor de deelnemer --------------------------------------------------------------- */
  /** Jouw account (of null: nog geen account, of niet ingelogd). */
  async function account() {
    const email = me();
    if (!email) return null;
    if (isDemo()) {
      const found = demo().accounts.find((row) => row.email === email);
      return found ? Object.assign({}, found) : null;
    }
    return ns.central.brevetAccount(await ns.account.token(), email);
  }

  /** Je account aanmaken of bijwerken; geeft het account. */
  async function saveAccount(patch) {
    const email = me();
    if (!email) throw new Error('niet ingelogd');
    const fields = pick(patch);
    if (isDemo()) {
      const data = demo();
      let row = data.accounts.find((item) => item.email === email);
      if (!row) {
        row = { email, name: '', team: '', vestiging: '', joined_at: null, share_brevet: false, level: '', level_seen: '' };
        data.accounts.push(row);
      }
      Object.assign(row, fields);
      saveDemo();
      return Object.assign({}, row);
    }
    return ns.central.brevetSaveAccount(await ns.account.token(), Object.assign({ email }, fields));
  }

  /** Stoppen met meedoen: account en logboek weg. */
  async function removeAccount() {
    const email = me();
    if (!email) return;
    if (isDemo()) {
      const data = demo();
      data.accounts = data.accounts.filter((row) => row.email !== email);
      data.facts = data.facts.filter((fact) => fact.email !== email);
      saveDemo();
      return;
    }
    await ns.central.brevetRemoveAccount(await ns.account.token(), email);
  }

  /** Jouw feiten (oudste eerst). */
  async function facts() {
    const email = me();
    if (!email) return [];
    if (isDemo()) return demo().facts.filter((fact) => fact.email === email).map((fact) => Object.assign({}, fact));
    return ns.central.brevetFacts(await ns.account.token());
  }

  /** Een feit toevoegen dat je zelf mag vastleggen: 'ok', 'duplicate', 'missing' of 'failed'. */
  async function add(fact) {
    const email = me();
    if (!email) return 'failed';
    if (isDemo()) return demoAdd([Object.assign({ email }, fact)]) ? 'ok' : 'duplicate';
    return ns.central.brevetAddFact(await ns.account.token(), Object.assign({ email }, fact));
  }

  /** Je royalty's: [{ item, month, users }]. */
  async function royalties() {
    const email = me();
    if (!email) return [];
    if (isDemo()) return ns.brevet.royaltiesFrom(demo().facts, email);
    return ns.central.brevetRoyalties(await ns.account.token());
  }

  /* ---- Voor beheer (hoofdbeheerders) ----------------------------------------------------- */
  async function adminAccounts() {
    if (isDemo()) return demo().accounts.map((row) => Object.assign({}, row));
    return ns.central.adminBrevetAccounts();
  }

  async function adminFacts() {
    if (isDemo()) return demo().facts.map((fact) => Object.assign({}, fact));
    return ns.central.adminBrevetFacts();
  }

  /** Feiten toevoegen namens het AI-team (rows: [{ email, kind, item, detail, namespace }]); bestaande blijven staan. */
  async function adminAdd(rows) {
    if (!rows.length) return 0;
    if (isDemo()) return demoAdd(rows, 'ai-team@demo.cockpit');
    return ns.central.adminBrevetAdd(rows);
  }

  async function adminRemove(id) {
    if (isDemo()) {
      const data = demo();
      data.facts = data.facts.filter((fact) => fact.id !== id);
      saveDemo();
      return;
    }
    await ns.central.adminBrevetRemove(id);
  }

  ns.brevetData = { account, saveAccount, removeAccount, facts, add, royalties, adminAccounts, adminFacts, adminAdd, adminRemove, resetDemo, isDemo, seed };
})(window.AIAudit);
