/* ==========================================================================
   AI-brevetten: AI-miles en brevetten (Cadet, Co-pilot, CaptAIn, Commander)
   --------------------------------------------------------------------------
   Wie meedoet (opt-in), bouwt een logboek op met feiten: "gebruikte prompt X",
   "het AI-team nam je voorstel over", "was bij training Y". Miles en brevetten
   worden daaruit berekend (compute), met de regels hieronder. Namen, drempels
   en miles pas je aan in Beheer → Gedeelde basis → Teksten (instelling 'brevet').
   Een brevet = genoeg miles én de checkride van dat brevet (en van de vorige),
   zoals een piloot vlieguren én een examen nodig heeft.

   Tegen sparen met klikken:
   - gebruik telt per uniek ding (elke prompt, demo of beoordeling één keer),
     en hoogstens 25 miles per dag;
   - insturen levert weinig op (hoogstens 3 keer per week); het grootste deel
     komt pas als het AI-team je bijdrage overneemt (dat legt beheer vast);
   - royalty's: collega's die jouw prompt gebruiken, elk één keer en nooit jijzelf,
     hoogstens 100 miles per maand.

   Opslag: js/brevet-data.js (demo in deze browser, of Supabase stap 12); wie je
   bent: js/account.js; schermen: js/brevet-ui.js en js/view-logbook.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  const LEVELS = [
    { id: 'cadet', name: 'Cadet', stripes: 1, miles: 0, perks: ['Je eigen logboek met miles', 'Bewijs dat je veilig vliegt'] },
    { id: 'copilot', name: 'Co-pilot', stripes: 3, miles: 250, perks: ['Upgrade: voorrang op een licentie', 'Priority boarding voor je aanvragen'] },
    { id: 'captain', name: 'CaptAIn', stripes: 4, miles: 1000, perks: ['Testpiloot voor nieuwe agents', 'Stemrecht over wat we bouwen', 'Lounge met het AI-team', 'Cockpitcheck: 1-op-1 sessie'] },
    { id: 'commander', name: 'Commander', stripes: 4, miles: 2500, insignia: true, perks: ['Een agent op maat voor je team', 'Een plek in het AI-panel', 'Aanspreekpunt voor AI in je team'] }
  ];

  // Wat een deelnemer zelf laat vastleggen; de rest legt beheer vast (zie setup/supabase-audit-brevetten.sql)
  const SELF_KINDS = ['active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done', 'profile_done', 'policy_check', 'idea_sent', 'recording_watched'];
  const ADMIN_KINDS = ['contribution_adopted', 'training_registered', 'training_attended', 'session_given', 'nominated', 'prompt_author', 'bonus'];
  // Gebruik: samen hoogstens caps.usagePerDay per dag
  const USAGE = ['prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong'];

  const MILES = {
    prompt_used: 5, demo_watched: 10, prompt_rated: 3, builder_strong: 5,
    tour_done: 5, profile_done: 5, policy_check: 10, idea_sent: 10, recording_watched: 10,
    training_attended: 25, session_given: 50, royalty: 5, rhythm: 15,
    // Overgenomen bijdrage, per soort inzending
    adopted: { prompt: 100, verbetering: 50, idee: 150, usecase: 250, verzoek: 20, vraag: 0 }
  };
  const CAPS = { usagePerDay: 25, sentPerWeek: 3, royaltyPerMonth: 100 };
  const RECENCY_DAYS = 90; // zoals piloten: wie de laatste 90 dagen is geweest, is 'actief'

  // De checkride per brevet: stat = welk getal uit compute().stats, need = hoeveel
  const CHECKS = {
    cadet: [
      { stat: 'tour', need: 1, label: 'Rondleiding door de cockpit' },
      { stat: 'profile', need: 1, label: 'Mijn gegevens ingevuld' },
      { stat: 'policy', need: 1, label: 'Check "Veilig vliegen" gehaald' }
    ],
    copilot: [
      { stat: 'prompts', need: 10, label: 'verschillende prompts gebruikt' },
      { stat: 'demos', need: 3, label: 'demo\'s bekeken' },
      { stat: 'trainings', need: 1, label: 'training gevolgd (live of opname)' },
      { stat: 'weeks', need: 4, label: 'weken actief in de cockpit' }
    ],
    captain: [
      { stat: 'adopted', need: 1, label: 'bijdrage overgenomen door het AI-team' },
      { stat: 'live', need: 1, label: 'live training bijgewoond' },
      { stat: 'trainings', need: 2, label: 'trainingen gevolgd' },
      { stat: 'prompts', need: 25, label: 'verschillende prompts gebruikt' }
    ],
    commander: [
      { stat: 'colleagues', need: 25, label: 'keer dat een collega jouw prompt gebruikte' },
      { stat: 'sessions', need: 1, label: 'sessie gegeven in je team' },
      { stat: 'nominated', need: 1, label: 'voorgedragen door het AI-team' }
    ]
  };

  // Wat er in het logboek staat bij een feit
  const LABELS = {
    prompt_used: 'Prompt voor het eerst gebruikt',
    demo_watched: 'Demo bekeken',
    prompt_rated: 'Beoordeeld met sterren',
    builder_strong: 'Sterke prompt gebouwd (90+)',
    tour_done: 'Rondleiding gedaan',
    profile_done: 'Mijn gegevens ingevuld',
    policy_check: 'Check "Veilig vliegen" gehaald',
    idea_sent: 'Ingestuurd in de ideeënhub',
    recording_watched: 'Opname van een training bekeken',
    training_attended: 'Training bijgewoond',
    contribution_adopted: 'Bijdrage overgenomen door het AI-team',
    session_given: 'Sessie gegeven in je team',
    nominated: 'Voorgedragen door het AI-team',
    bonus: 'Miles van het AI-team',
    rhythm: 'Vliegritme: 3 dagen actief in één week',
    royalty: 'Royalty\'s: collega\'s gebruikten jouw prompts'
  };

  /* ---- Regels (standaard, met wat er in Beheer is aangepast) ------------------------- */
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const num = (value, fallback) => {
    const n = Number(value);
    return value !== '' && value != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };
  const list = (value) => (Array.isArray(value) && value.some((line) => text(line)) ? value.map(text).filter(Boolean) : null);

  /** De regels: de standaard hierboven, met de instelling 'brevet' uit Beheer (of custom) eroverheen. */
  function rules(custom) {
    const c = custom || (ns.content && ns.content.settings && ns.content.settings.brevet) || {};
    const levels = LEVELS.map((level) => Object.assign({}, level, {
      name: text(c[level.id + 'Name']) || level.name,
      miles: level.id === 'cadet' ? 0 : num(c[level.id + 'Miles'], level.miles),
      perks: list(c[level.id + 'Perks']) || level.perks.slice()
    }));
    const adopted = Object.assign({}, MILES.adopted, {
      prompt: num(c.milesAdoptedPrompt, MILES.adopted.prompt),
      verbetering: num(c.milesAdoptedImprovement, MILES.adopted.verbetering),
      idee: num(c.milesAdoptedIdea, MILES.adopted.idee),
      usecase: num(c.milesAdoptedUsecase, MILES.adopted.usecase)
    });
    const miles = Object.assign({}, MILES, {
      prompt_used: num(c.milesPrompt, MILES.prompt_used),
      demo_watched: num(c.milesDemo, MILES.demo_watched),
      training_attended: num(c.milesTraining, MILES.training_attended),
      royalty: num(c.milesRoyalty, MILES.royalty),
      adopted
    });
    return {
      levels,
      miles,
      caps: { usagePerDay: num(c.usagePerDay, CAPS.usagePerDay), sentPerWeek: CAPS.sentPerWeek, royaltyPerMonth: num(c.royaltyPerMonth, CAPS.royaltyPerMonth) },
      checks: CHECKS,
      recencyDays: num(c.recencyDays, RECENCY_DAYS) || RECENCY_DAYS
    };
  }

  /* ---- Datums ------------------------------------------------------------------------ */
  const pad = (n) => String(n).padStart(2, '0');
  /** 'JJJJ-MM-DD' in de tijdzone van de browser ('' als het geen datum is). */
  function dayOf(at) {
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  const utc = (day) => {
    const [y, m, d] = String(day).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  /** ISO-week van een dag: 'JJJJ-Www' (maandag tot en met zondag). */
  function weekOf(day) {
    const date = new Date(utc(day));
    const weekday = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - weekday);
    const week = Math.ceil(((date - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${pad(week)}`;
  }
  const daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 86400000);
  const today = () => (ns.content && ns.content.today ? ns.content.today() : dayOf(new Date()));

  /* ---- Berekenen --------------------------------------------------------------------- */
  /**
   * Miles en brevet uit de feiten. facts: [{ kind, item, detail, at }]; options: { rules, royalties:
   * [{ item, month, users }], today: 'JJJJ-MM-DD' }. Geeft { miles, entries (oudste eerst), stats,
   * level (index, -1 = nog geen brevet), levelInfo, next, active, lastActive, monthMiles, rules }.
   */
  function compute(facts, options) {
    const opts = options || {};
    const r = opts.rules || rules();
    const now = opts.today || today();
    const seen = new Set();
    const all = (facts || [])
      .filter((fact) => fact && fact.kind)
      .map((fact) => ({ kind: fact.kind, item: fact.item == null ? '' : String(fact.item), detail: fact.detail || {}, at: fact.at, day: dayOf(fact.at) }))
      .filter((fact) => fact.day)
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      // Hetzelfde feit telt één keer (de database bewaakt dat ook)
      .filter((fact) => {
        const key = fact.kind + '|' + fact.item;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    const stats = { prompts: 0, demos: 0, rated: 0, trainings: 0, live: 0, weeks: 0, adopted: 0, colleagues: 0, sessions: 0, nominated: 0, tour: 0, profile: 0, policy: 0, registered: [] };
    const entries = [];
    const usage = {}; // miles uit gebruik per dag
    const sent = {}; // insturen per week
    const days = new Set();
    const trainings = new Set();
    const live = new Set();
    let lastActive = '';

    all.forEach((fact) => {
      if (SELF_KINDS.includes(fact.kind) && fact.day > lastActive) lastActive = fact.day;
      let miles = 0;
      let capped = false;
      switch (fact.kind) {
        case 'active_day': days.add(fact.day); return; // telt mee voor het vliegritme en de weken
        case 'prompt_used': stats.prompts += 1; miles = r.miles.prompt_used; break;
        case 'demo_watched': stats.demos += 1; miles = r.miles.demo_watched; break;
        case 'prompt_rated': stats.rated += 1; miles = r.miles.prompt_rated; break;
        case 'builder_strong': miles = r.miles.builder_strong; break;
        case 'tour_done': stats.tour = 1; miles = r.miles.tour_done; break;
        case 'profile_done': stats.profile = 1; miles = r.miles.profile_done; break;
        case 'policy_check': stats.policy = 1; miles = r.miles.policy_check; break;
        case 'idea_sent': {
          const week = weekOf(fact.day);
          sent[week] = (sent[week] || 0) + 1;
          capped = sent[week] > r.caps.sentPerWeek;
          miles = capped ? 0 : r.miles.idea_sent;
          break;
        }
        case 'recording_watched': trainings.add(fact.item); miles = r.miles.recording_watched; break;
        case 'training_attended': trainings.add(fact.item); live.add(fact.item); miles = r.miles.training_attended; break;
        case 'training_registered': stats.registered.push(fact.item); return;
        case 'contribution_adopted': {
          stats.adopted += 1;
          const kind = fact.detail.kind;
          miles = Object.prototype.hasOwnProperty.call(r.miles.adopted, kind) ? r.miles.adopted[kind] : r.miles.adopted.idee;
          break;
        }
        case 'session_given': stats.sessions += 1; miles = r.miles.session_given; break;
        case 'nominated': stats.nominated = 1; break;
        case 'bonus': miles = Math.max(0, Math.round(Number(fact.detail.miles) || 0)); break;
        default: return; // prompt_author (voor de royalty's) en onbekende soorten
      }
      if (USAGE.includes(fact.kind)) {
        const used = usage[fact.day] || 0;
        const room = Math.max(0, r.caps.usagePerDay - used);
        if (miles > room) {
          capped = true;
          miles = room;
        }
        usage[fact.day] = used + miles;
      }
      entries.push({ kind: fact.kind, item: fact.item, detail: fact.detail, at: fact.at, day: fact.day, miles, capped });
    });
    stats.trainings = trainings.size;
    stats.live = live.size;
    stats.registered = stats.registered.filter((id) => !live.has(id));

    // Vliegritme: een week met minstens 3 actieve dagen
    const perWeek = {};
    Array.from(days).sort().forEach((day) => {
      const week = weekOf(day);
      (perWeek[week] = perWeek[week] || []).push(day);
    });
    Object.keys(perWeek).forEach((week) => {
      const inWeek = perWeek[week];
      if (inWeek.length >= 3) entries.push({ kind: 'rhythm', item: week, detail: {}, at: inWeek[2] + 'T23:59:00', day: inWeek[2], miles: r.miles.rhythm, capped: false });
    });
    stats.weeks = Object.keys(perWeek).length;

    // Royalty's per maand (met een plafond)
    const perMonth = {};
    (opts.royalties || []).forEach((row) => {
      const month = String(row.month || '').slice(0, 7);
      const users = Math.max(0, Math.round(Number(row.users) || 0));
      if (!/^\d{4}-\d{2}$/.test(month) || !users) return;
      perMonth[month] = (perMonth[month] || 0) + users;
      stats.colleagues += users;
    });
    Object.keys(perMonth).sort().forEach((month) => {
      const full = perMonth[month] * r.miles.royalty;
      const miles = Math.min(full, r.caps.royaltyPerMonth);
      entries.push({ kind: 'royalty', item: month, detail: { users: perMonth[month] }, at: month + '-01T00:00:00', day: month + '-01', miles, capped: full > miles });
    });
    entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

    const miles = entries.reduce((total, entry) => total + entry.miles, 0);
    const monthMiles = entries.filter((entry) => entry.day.slice(0, 7) === now.slice(0, 7)).reduce((total, entry) => total + entry.miles, 0);
    const checksOf = (level) => (r.checks[level.id] || []).map((check) => Object.assign({}, check, { have: stats[check.stat] || 0, ok: (stats[check.stat] || 0) >= check.need }));
    let level = -1;
    for (let index = 0; index < r.levels.length; index++) {
      const candidate = r.levels[index];
      if (miles >= candidate.miles && checksOf(candidate).every((check) => check.ok)) level = index;
      else break;
    }
    const upcoming = r.levels[level + 1] || null;
    let next = null;
    if (upcoming) {
      const from = level >= 0 ? r.levels[level].miles : 0;
      const checks = checksOf(upcoming);
      const milesPart = upcoming.miles > from ? Math.min(1, Math.max(0, (miles - from) / (upcoming.miles - from))) : 1;
      const checksPart = checks.length ? checks.filter((check) => check.ok).length / checks.length : 1;
      next = { index: level + 1, level: upcoming, milesNeeded: Math.max(0, upcoming.miles - miles), checks, progress: (milesPart + checksPart) / 2 };
    }
    return {
      miles,
      monthMiles,
      entries,
      stats,
      level,
      levelInfo: r.levels[level] || null,
      next,
      lastActive,
      active: Boolean(lastActive) && daysBetween(lastActive, now) <= r.recencyDays,
      rules: r
    };
  }

  /**
   * Royalty's uit alle feiten (demo en Beheer; in Supabase rekent de database ze uit voor jezelf):
   * per prompt waarvan je auteur bent en per maand het aantal collega's dat hem voor het eerst gebruikte.
   * facts: [{ email, kind, item, at }].
   */
  function royaltiesFrom(facts, email) {
    const me = String(email || '').toLowerCase();
    const mine = new Set(facts.filter((fact) => fact.email === me && fact.kind === 'prompt_author').map((fact) => String(fact.item)));
    const first = new Map();
    facts.forEach((fact) => {
      if (fact.kind !== 'prompt_used' || fact.email === me || !mine.has(String(fact.item))) return;
      const key = fact.item + '|' + fact.email;
      if (!first.has(key) || fact.at < first.get(key)) first.set(key, fact.at);
    });
    const rows = new Map();
    first.forEach((at, key) => {
      const item = key.slice(0, key.lastIndexOf('|'));
      const month = dayOf(at).slice(0, 7);
      const id = item + '|' + month;
      rows.set(id, { item, month, users: (rows.has(id) ? rows.get(id).users : 0) + 1 });
    });
    return Array.from(rows.values());
  }

  const levelIndex = (id) => LEVELS.findIndex((level) => level.id === id);

  /* ---- Jouw logboek (zolang de cockpit open is) --------------------------------------- */
  const EVENT = 'ai:brevet';
  const state = { status: 'idle', account: null, facts: [], royalties: [], result: null, loadedAt: 0 };
  const pending = new Set();
  let loading = null;

  const config = () => ((ns.app && ns.app.config ? ns.app.config() : ns.config) || {}).brevet || {};
  const enabled = () => config().enabled !== false;
  const joined = () => Boolean(state.account && state.account.joined_at);
  const emit = () => document.dispatchEvent(new CustomEvent(EVENT, { detail: { status: state.status } }));

  /** Opnieuw ophalen en berekenen; let op een promotie. */
  function load() {
    if (!enabled()) return Promise.resolve(state);
    if (loading) return loading;
    state.status = state.status === 'ready' ? 'ready' : 'loading';
    loading = (async () => {
      try {
        const data = ns.brevetData;
        state.account = await data.account();
        if (joined()) {
          const [facts, royalties] = await Promise.all([data.facts(), data.royalties()]);
          state.facts = facts;
          state.royalties = royalties;
        } else {
          state.facts = [];
          state.royalties = [];
        }
        state.result = joined() ? compute(state.facts, { royalties: state.royalties }) : null;
        state.status = 'ready';
        state.loadedAt = Date.now();
      } catch (error) {
        console.warn('[AI Cockpit] Logboek laden mislukt', error);
        state.status = 'failed';
      } finally {
        loading = null;
      }
      emit();
      if (joined()) await checkPromotion();
      return state;
    })();
    return loading;
  }

  /** Een promotie sinds de vorige keer: één keer het venster (js/brevet-ui.js), in welk tabblad ook. */
  async function checkPromotion() {
    const result = state.result;
    if (!result) return;
    const account = state.account;
    const id = result.levelInfo ? result.levelInfo.id : '';
    const seenIndex = levelIndex(account.level_seen);
    if (result.level > seenIndex) {
      // Eerst vastleggen dat je hem gezien hebt, dan pas het venster (geen dubbele vensters)
      state.account = Object.assign({}, account, await ns.brevetData.saveAccount({ level: id, level_seen: id }));
      if (ns.brevetUi) ns.brevetUi.promote(result);
    } else if ((account.level || '') !== id) {
      state.account = Object.assign({}, account, await ns.brevetData.saveAccount({ level: id }));
    }
  }

  /**
   * Een feit uit de cockpit vastleggen (alleen als je meedoet, en alleen soorten die je zelf mag).
   * Geeft 'ok', 'duplicate', 'off' of een fout van de opslag.
   */
  async function record(kind, item, detail) {
    if (!enabled() || !joined() || !SELF_KINDS.includes(kind)) return 'off';
    const id = String(item == null ? '' : item).slice(0, 80);
    const key = kind + '|' + id;
    if (pending.has(key) || state.facts.some((fact) => fact.kind === kind && String(fact.item) === id)) return 'duplicate';
    pending.add(key);
    try {
      const before = state.result ? state.result.miles : 0;
      const outcome = await ns.brevetData.add({ kind, item: id, detail: detail || null, namespace: (ns.app && ns.app.config().namespace) || null });
      if (outcome === 'ok') {
        await load();
        const gained = state.result ? state.result.miles - before : 0;
        if (gained > 0 && kind !== 'active_day') ns.ui.toast(`+${gained} AI-miles · ${LABELS[kind] || 'Logboek'}`, { tone: 'success' });
      }
      return outcome;
    } finally {
      pending.delete(key);
    }
  }

  /** Wat je al deed voordat je meedeed (rondleiding, gegevens) alsnog in je logboek; en vandaag actief. */
  async function sync() {
    if (!joined()) return;
    await record('active_day', today());
    const tour = ns.tour && ns.tour.seen && ns.tour.seen();
    if (tour) await record('tour_done', '');
    if (ns.profile && ns.profile.get().naam) await record('profile_done', '');
  }

  /** Meedoen: je account met je naam (uit Mijn gegevens) en je keuze om je brevet te delen. */
  async function join(options) {
    const opts = options || {};
    const me = ns.profile ? ns.profile.get() : {};
    state.account = await ns.brevetData.saveAccount({
      name: opts.name || me.naam || '',
      team: me.team || '',
      vestiging: me.vestiging || '',
      joined_at: new Date().toISOString(),
      share_brevet: opts.share === true
    });
    await load();
    await sync();
    return state.account;
  }

  /** Stoppen: je account en je hele logboek worden gewist. */
  async function leave() {
    await ns.brevetData.removeAccount();
    state.account = null;
    state.facts = [];
    state.result = null;
    emit();
  }

  /** Delen met collega's aan of uit. */
  async function setShare(on) {
    state.account = Object.assign({}, state.account, await ns.brevetData.saveAccount({ share_brevet: on === true }));
    emit();
  }

  function onChange(handler) {
    document.addEventListener(EVENT, handler);
    return () => document.removeEventListener(EVENT, handler);
  }

  /* ---- Haakjes in de rest van de cockpit ----------------------------------------------- */
  function listen() {
    // Tellers (js/central.js): kopiëren en demo's; een video telt pas als hij helemaal is bekeken (js/player.js)
    document.addEventListener('ai:track', (event) => {
      const { kind, id } = event.detail || {};
      if (kind === 'copy_prompt') record('prompt_used', id);
      if (kind === 'play_demo') {
        const usecase = ns.content.usecaseById && ns.content.usecaseById.get(id);
        if (!usecase || !usecase.video) record('demo_watched', id);
      }
    });
    document.addEventListener('ai:demo-af', (event) => record('demo_watched', (event.detail || {}).id));
    document.addEventListener('ai:ingestuurd', (event) => record('idea_sent', (event.detail || {}).ref));
    document.addEventListener('ai:beoordeeld', (event) => {
      const detail = event.detail || {};
      record('prompt_rated', detail.type + ':' + detail.id);
    });
    // Terug in het tabblad: misschien heeft het AI-team iets toegekend
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && joined() && Date.now() - state.loadedAt > 120000) load();
    });
    if (ns.profile) ns.profile.onChange(() => {
      if (joined() && ns.profile.get().naam) record('profile_done', '');
    });
  }

  let started = false;
  /** Bij het opstarten (js/app.js): wacht op de inhoud (voor de regels uit Beheer), dan je logboek. */
  function init() {
    if (started || !enabled()) return;
    started = true;
    listen();
    let first = true;
    document.addEventListener('ai:inhoud', () => {
      if (!first) {
        if (state.result) {
          state.result = compute(state.facts, { royalties: state.royalties });
          emit();
        }
        return;
      }
      first = false;
      load().then(sync);
    });
  }

  ns.brevet = {
    LEVELS,
    SELF_KINDS,
    ADMIN_KINDS,
    LABELS,
    CHECKS,
    rules,
    compute,
    royaltiesFrom,
    dayOf,
    weekOf,
    levelIndex,
    init,
    load,
    record,
    join,
    leave,
    setShare,
    onChange,
    enabled,
    joined,
    state: () => state
  };
})(window.AIAudit);
