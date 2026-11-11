/* ==========================================================================
   AI-brevetten: AI-miles en brevetten (Cadet, Co-pilot, CaptAIn, Commander)
   --------------------------------------------------------------------------
   Wie meedoet (opt-in), bouwt een logboek op met feiten: "gebruikte prompt X",
   "het AI-team nam je voorstel over", "was bij training Y". Miles en brevetten
   worden daaruit berekend (compute), met de regels hieronder. Namen, drempels,
   voordelen, checkrides en miles pas je aan in Beheer → AI-brevetten → Regels:
   voor alle disciplines en per discipline (rules legt die lagen op elkaar).
   Een brevet = genoeg miles én de checkride van dat brevet (en van de vorige),
   zoals een piloot vlieguren én een examen nodig heeft.

   Tegen sparen met klikken:
   - gebruik telt per uniek ding (elke prompt, demo of beoordeling één keer),
     en hoogstens 25 miles per dag;
   - insturen levert weinig op (hoogstens 3 keer per week); het grootste deel
     komt pas als het AI-team je bijdrage overneemt (dat legt beheer vast);
   - royalty's: collega's die jouw prompt gebruiken, elk één keer en nooit jijzelf,
     hoogstens 100 miles per maand;
   - een testervaring bij een agent in testfase telt per agent één keer.

   Opslag: js/brevet-data.js (demo in deze browser, of Supabase stap 12); wie je
   bent: js/account.js; schermen: js/brevet-ui.js en js/view-logbook.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  // perks: wat een brevet oplevert. Een brevet zonder voordelen is 'nog geheim': collega's zien dan een vage
  // regel in plaats van de voordelen (js/brevet-ui.js). De voordelen van Co-pilot, CaptAIn en Commander worden
  // nog intern afgestemd; vul ze daarna in bij Beheer → AI-brevetten → Regels, dan staan ze er meteen.
  const LEVELS = [
    { id: 'cadet', name: 'Cadet', stripes: 1, miles: 0, perks: ['Je eigen logboek met miles', 'Bewijs dat je veilig vliegt'] },
    { id: 'copilot', name: 'Co-pilot', stripes: 3, miles: 250, perks: [] },
    { id: 'captain', name: 'CaptAIn', stripes: 4, miles: 1000, perks: [] },
    { id: 'commander', name: 'Commander', stripes: 4, miles: 2500, insignia: true, perks: [] }
  ];

  // Wat een deelnemer zelf laat vastleggen; de rest legt beheer vast (zie setup/supabase-audit-brevetten.sql).
  // 'activity': een automatisch puntenitem (ACTIVITIES); 'item_awarded': een eigen item van het AI-team (stap 15).
  // 'test_shared': een testervaring gedeeld bij een agent in testfase (js/agent-test.js), per agent één keer (stap 17).
  const SELF_KINDS = ['active_day', 'prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong', 'tour_done', 'profile_done', 'policy_check', 'idea_sent', 'recording_watched', 'kickstart_done', 'activity', 'test_shared'];
  const ADMIN_KINDS = ['contribution_adopted', 'training_registered', 'training_attended', 'session_given', 'nominated', 'prompt_author', 'bonus', 'item_awarded'];

  /* Automatische puntenitems: wat de cockpit al ziet en wat het AI-team per discipline aan kan zetten
     (Beheer → AI-brevetten → Regels; standaard uit = 0 miles). on: de teller uit js/central.js (of een eigen
     signaal), per item één keer. count/one: hoe hij in een checkride heet (meer dan één keer, of precies één). */
  const ACTIVITIES = [
    { id: 'usecase_viewed', label: 'Usecase bekeken', rule: 'per usecase één keer', on: 'view_usecase', count: 'usecases bekeken', one: 'Een usecase bekeken' },
    { id: 'tip_read', label: 'Tip gelezen', rule: 'per tip één keer', on: 'view_tip', count: 'tips gelezen', one: 'Een tip gelezen' },
    { id: 'weekly_tip', label: 'Tip van de week in zijn eigen week gelezen', rule: 'per tip één keer, in de week dat hij uitkomt', on: 'view_tip', weekly: true, count: 'tips van de week op tijd gelezen', one: 'Een tip van de week op tijd gelezen' },
    { id: 'tip_copied', label: 'Voorbeeld uit een tip gekopieerd', rule: 'per tip één keer', on: 'copy_tip', count: 'voorbeelden uit tips gekopieerd', one: 'Een voorbeeld uit een tip gekopieerd' },
    { id: 'training_viewed', label: 'Training bekeken', rule: 'per training één keer', on: 'view_training', count: 'trainingen bekeken', one: 'Een training bekeken' },
    { id: 'agent_viewed', label: 'Agent of tool bekeken', rule: 'per agent één keer', on: 'view_agent', count: 'agents en tools bekeken', one: 'Een agent of tool bekeken' },
    { id: 'agent_opened', label: 'Agent of tool geopend', rule: 'per agent één keer', on: 'open_agent', count: 'agents en tools geopend', one: 'Een agent of tool geopend' },
    { id: 'wrapped_viewed', label: 'Cockpit Wrapped bekeken', rule: 'per editie één keer', on: 'wrapped', count: 'edities van Wrapped bekeken', one: 'Cockpit Wrapped bekeken' }
  ];
  const ACTIVITY_IDS = ACTIVITIES.map((activity) => activity.id);
  const ITEM_ID = /^[a-z0-9-]{1,40}$/;

  // Wat je aan een checkride kunt toevoegen (naast de automatische en eigen items): [stat, meer dan één, precies één]
  const STATS = {
    prompts: ['verschillende prompts gebruikt', 'Een prompt gebruikt'],
    demos: ['demo\'s bekeken', 'Een demo bekeken'],
    rated: ['keer beoordeeld met sterren', 'Iets beoordeeld met sterren'],
    trainings: ['trainingen gevolgd (live of opname)', 'Een training gevolgd (live of opname)'],
    live: ['live trainingen bijgewoond', 'Een live training bijgewoond'],
    weeks: ['weken actief in de cockpit', 'Een week actief in de cockpit'],
    adopted: ['bijdragen overgenomen door het AI-team', 'Een bijdrage overgenomen door het AI-team'],
    colleagues: ['keer dat een collega jouw prompt gebruikte', 'Een collega gebruikte jouw prompt'],
    sessions: ['sessies gegeven in je team', 'Een sessie gegeven in je team'],
    tests: ['agents getest (testervaring gedeeld)', 'Een testervaring gedeeld bij een agent in testfase'],
    tour: [null, 'Rondleiding door de cockpit'],
    profile: [null, 'Mijn gegevens ingevuld'],
    policy: [null, 'Check "Veilig vliegen" gehaald'],
    kickstart: [null, 'Kickstart afgerond'],
    nominated: [null, 'Voorgedragen door het AI-team']
  };
  // Wat maar één keer kan: geen aantal om in te stellen
  const ONCE_STATS = ['tour', 'profile', 'policy', 'kickstart', 'nominated'];
  // Gebruik: samen hoogstens caps.usagePerDay per dag
  const USAGE = ['prompt_used', 'demo_watched', 'prompt_rated', 'builder_strong'];
  // Inzendingen die niet als 'ingestuurd in de ideeënhub' tellen (invliegen: pas bij een usecase; testervaring: test_shared)
  const NOT_SENT = ['invliegen', 'testfeedback'];

  const MILES = {
    prompt_used: 5, demo_watched: 10, prompt_rated: 3, builder_strong: 5,
    tour_done: 5, profile_done: 5, policy_check: 10, idea_sent: 10, recording_watched: 10, kickstart_done: 50, test_shared: 25,
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
    kickstart_done: 'Kickstart afgerond',
    test_shared: 'Testervaring gedeeld bij een agent in testfase',
    training_attended: 'Training bijgewoond',
    contribution_adopted: 'Bijdrage overgenomen door het AI-team',
    session_given: 'Sessie gegeven in je team',
    nominated: 'Voorgedragen door het AI-team',
    bonus: 'Miles van het AI-team',
    item_awarded: 'Van het AI-team',
    activity: 'Activiteit in de cockpit',
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

  /** De standaard (de waarden hierboven), als regels. */
  function defaults() {
    return {
      levels: LEVELS.map((level) => Object.assign({}, level, { perks: level.perks.slice() })),
      miles: Object.assign({}, MILES, { adopted: Object.assign({}, MILES.adopted) }),
      caps: Object.assign({}, CAPS),
      checks: Object.fromEntries(Object.entries(CHECKS).map(([id, list]) => [id, list.map((check) => Object.assign({}, check))])),
      recencyDays: RECENCY_DAYS,
      // Puntenitems: eigen namen in het logboek, automatische items (standaard uit) en eigen items van het AI-team
      labels: {},
      activities: Object.fromEntries(ACTIVITIES.map((activity) => [activity.id, { miles: 0, name: '' }])),
      items: []
    };
  }

  /** Hoe een onderdeel van een checkride heet ('3 van 5 …' als need > 1, anders één zin). */
  function statLabel(stat, need, r) {
    const many = need > 1;
    if (stat.startsWith('activity:')) {
      const activity = ACTIVITIES.find((a) => a.id === stat.slice(9));
      const own = r && r.activities[stat.slice(9)] && text(r.activities[stat.slice(9)].name);
      if (!activity) return stat;
      return own ? (many ? 'keer: ' + own : own) : (many ? activity.count : activity.one);
    }
    if (stat.startsWith('item:')) {
      const item = r && r.items.find((i) => i.id === stat.slice(5));
      const name = item ? item.name : stat.slice(5);
      return many ? 'keer: ' + name : name;
    }
    const known = STATS[stat];
    if (!known) return stat;
    return many && known[0] ? known[0] : known[1];
  }

  /**
   * Een instelling in de oude, platte vorm (Beheer → Teksten: cadetName, copilotMiles, milesPrompt …)
   * in de vorm van een regellaag hieronder.
   */
  function fromFlat(c) {
    const levels = {};
    LEVELS.forEach((level) => {
      levels[level.id] = { name: c[level.id + 'Name'], miles: c[level.id + 'Miles'], perks: c[level.id + 'Perks'] };
    });
    return {
      levels,
      miles: {
        prompt_used: c.milesPrompt, demo_watched: c.milesDemo, training_attended: c.milesTraining, royalty: c.milesRoyalty,
        adopted: { prompt: c.milesAdoptedPrompt, verbetering: c.milesAdoptedImprovement, idee: c.milesAdoptedIdea, usecase: c.milesAdoptedUsecase }
      },
      caps: { usagePerDay: c.usagePerDay, royaltyPerMonth: c.royaltyPerMonth },
      recencyDays: c.recencyDays
    };
  }
  const isFlat = (layer) => Object.keys(layer).some((key) => /^(cadet|copilot|captain|commander)(Name|Miles|Perks)$|^miles[A-Z]/.test(key));

  /**
   * Eén laag over de regels heen: alleen wat ingevuld en geldig is, telt (leeg = de laag eronder).
   * layer: { levels: { <id>: { name, miles, perks } }, miles: { <soort>: n, adopted: { <soort>: n } },
   * caps: { usagePerDay, sentPerWeek, royaltyPerMonth }, checks: { <id>: { <stat>: n } }, recencyDays }.
   */
  function apply(r, raw) {
    if (!raw || typeof raw !== 'object') return r;
    const layer = isFlat(raw) ? fromFlat(raw) : raw;
    const levels = layer.levels || {};
    r.levels.forEach((level) => {
      const own = levels[level.id] || {};
      level.name = text(own.name) || level.name;
      if (level.id !== 'cadet') level.miles = num(own.miles, level.miles);
      level.perks = list(own.perks) || level.perks;
    });
    const miles = layer.miles || {};
    Object.keys(MILES).forEach((kind) => {
      if (kind !== 'adopted') r.miles[kind] = num(miles[kind], r.miles[kind]);
    });
    Object.keys(MILES.adopted).forEach((kind) => {
      r.miles.adopted[kind] = num((miles.adopted || {})[kind], r.miles.adopted[kind]);
    });
    Object.keys(CAPS).forEach((cap) => {
      r.caps[cap] = num((layer.caps || {})[cap], r.caps[cap]);
    });
    r.recencyDays = num(layer.recencyDays, r.recencyDays) || r.recencyDays;
    // Eigen namen in het logboek (alleen voor de vaste soorten)
    const labels = layer.labels || {};
    Object.keys(LABELS).forEach((kind) => {
      if (text(labels[kind])) r.labels[kind] = text(labels[kind]).slice(0, 60);
    });
    // Automatische items: miles (0 = uit) en een eigen naam
    const activities = layer.activities || {};
    ACTIVITIES.forEach((activity) => {
      const own = activities[activity.id] || {};
      r.activities[activity.id].miles = Math.min(1000, num(own.miles, r.activities[activity.id].miles));
      if (text(own.name)) r.activities[activity.id].name = text(own.name).slice(0, 60);
    });
    // Eigen items van het AI-team: op id samengevoegd (de discipline kan ze aanpassen of uitzetten, en er bij maken)
    (Array.isArray(layer.items) ? layer.items : []).forEach((raw) => {
      const id = text(raw && raw.id);
      if (!ITEM_ID.test(id)) return;
      const existing = r.items.find((item) => item.id === id);
      const next = {
        id,
        name: text(raw.name).slice(0, 60) || (existing ? existing.name : ''),
        miles: Math.min(1000, num(raw.miles, existing ? existing.miles : 0)),
        repeat: typeof raw.repeat === 'boolean' ? raw.repeat : existing ? existing.repeat : false,
        off: raw.off === true
      };
      if (!next.name) return;
      if (existing) Object.assign(existing, next);
      else if (r.items.length < 40) r.items.push(next);
    });
    // Checkrides: een aantal per onderdeel; 0 = weghalen, een nieuw onderdeel = toevoegen
    Object.keys(r.checks).forEach((id) => {
      const own = (layer.checks || {})[id] || {};
      Object.keys(own).forEach((stat) => {
        const known = STATS[stat] || (stat.startsWith('activity:') && ACTIVITY_IDS.includes(stat.slice(9))) || (stat.startsWith('item:') && ITEM_ID.test(stat.slice(5)));
        const n = num(own[stat], null);
        if (!known || n == null) return;
        const existing = r.checks[id].find((check) => check.stat === stat);
        if (n === 0) r.checks[id] = r.checks[id].filter((check) => check.stat !== stat);
        else if (existing) existing.need = ONCE_STATS.includes(stat) ? 1 : Math.min(999, n);
        else if (r.checks[id].length < 8) r.checks[id].push({ stat, need: ONCE_STATS.includes(stat) ? 1 : Math.min(999, n), label: '', added: true });
      });
    });
    return r;
  }

  /** Na alle lagen: de namen van toegevoegde onderdelen van een checkride (een eigen item kan intussen hernoemd zijn). */
  function finish(r) {
    Object.keys(r.checks).forEach((id) => {
      r.checks[id].forEach((check) => {
        if (check.added || check.stat.startsWith('activity:') || check.stat.startsWith('item:')) check.label = statLabel(check.stat, check.need, r);
      });
    });
    return r;
  }

  /**
   * De regels die nu gelden: de standaard, dan de oude instelling uit Beheer → Teksten, dan de regels
   * voor alle disciplines en dan die van de discipline waarin je zit (Beheer → AI-brevetten → Regels;
   * js/content.js: brevetRules). Met custom alleen die ene laag over de standaard (tests, Beheer).
   */
  function rules(custom, options) {
    const opts = options || {};
    if (custom) return finish(apply(defaults(), custom));
    const content = ns.content || {};
    const stored = content.brevetRules || {};
    const layers = [content.settings && content.settings.brevet, stored.basis];
    if (!opts.basisOnly) layers.push(stored.own);
    return finish(layers.reduce(apply, defaults()));
  }

  /** Hoe een feit heet in het logboek: de eigen naam uit Beheer, of de standaard. */
  function label(entry, rules) {
    const r = rules || (state.result && state.result.rules) || ns.brevet.rules();
    const detail = (entry && entry.detail) || {};
    if (entry.kind === 'activity') {
      const id = text(detail.activity) || String(entry.item || '').split(':')[0];
      const activity = ACTIVITIES.find((a) => a.id === id);
      return text(r.activities[id] && r.activities[id].name) || (activity ? activity.label : LABELS.activity);
    }
    if (entry.kind === 'item_awarded') {
      const item = r.items.find((i) => i.id === text(detail.item));
      return (item && item.name) || text(detail.name) || LABELS.item_awarded;
    }
    return text(r.labels[entry.kind]) || LABELS[entry.kind] || entry.kind;
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

    // Ook 'activity:<id>' en 'item:<id>' (automatische en eigen items) komen erbij als ze voorkomen
    const stats = { prompts: 0, demos: 0, rated: 0, trainings: 0, live: 0, weeks: 0, adopted: 0, colleagues: 0, sessions: 0, tests: 0, nominated: 0, tour: 0, profile: 0, policy: 0, kickstart: 0, registered: [] };
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
        case 'kickstart_done': stats.kickstart = 1; miles = r.miles.kickstart_done || 0; break;
        // Een testervaring bij een agent in testfase: een bijdrage, dus niet onder het plafond voor gebruik
        case 'test_shared': stats.tests += 1; miles = r.miles.test_shared || 0; break;
        case 'activity': {
          // Een automatisch item: telt altijd mee voor een checkride; miles alleen als het AI-team hem aanzette
          const id = text(fact.detail.activity) || fact.item.split(':')[0];
          if (!ACTIVITY_IDS.includes(id)) return;
          stats['activity:' + id] = (stats['activity:' + id] || 0) + 1;
          miles = r.activities[id].miles || 0;
          if (!miles) return;
          break;
        }
        case 'item_awarded': {
          // Een eigen item van het AI-team: de miles van nu; bestaat het item niet meer, dan wat er toen gold
          const id = text(fact.detail.item);
          const item = r.items.find((i) => i.id === id);
          if (ITEM_ID.test(id)) stats['item:' + id] = (stats['item:' + id] || 0) + 1;
          miles = item ? (item.off ? 0 : item.miles) : num(fact.detail.miles, 0);
          break;
        }
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
      if (USAGE.includes(fact.kind) || fact.kind === 'activity') {
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
        console.warn('[AI-cockpit] Logboek laden mislukt', error);
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
        if (gained > 0 && kind !== 'active_day') ns.ui.toast(`+${gained} AI-miles · ${label({ kind, item: id, detail: detail || {} })}`, { tone: 'success' });
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

  /**
   * De automatische items die bij een signaal horen (on: de teller of 'wrapped') en die aan staan (miles > 0 of
   * een eis in een checkride):
   * [{ activity, item }]. Een tip van de week telt alleen in de week dat hij uitkomt.
   */
  function activitiesFor(on, id, r, day) {
    const rulesNow = r || rules();
    const now = day || today();
    // Aan = miles, of een eis in een checkride (dan telt hij mee, ook zonder miles)
    const inCheck = (id) => Object.values(rulesNow.checks).some((list) => list.some((check) => check.stat === 'activity:' + id));
    return ACTIVITIES.filter((activity) => activity.on === on && ((rulesNow.activities[activity.id].miles || 0) > 0 || inCheck(activity.id))).filter((activity) => {
      if (!activity.weekly) return true;
      const tip = ns.content && ns.content.tipById && ns.content.tipById.get(id);
      return Boolean(tip && tip.weekly && tip.release && now >= tip.release && daysBetween(tip.release, now) < 7);
    }).map((activity) => ({ activity: activity.id, item: (activity.id + ':' + String(id || '')).slice(0, 80) }));
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
      // Automatische puntenitems die het AI-team aanzette (Beheer → AI-brevetten → Regels)
      if (joined() && id) activitiesFor(kind, id).forEach((found) => record('activity', found.item, { activity: found.activity }));
    });
    // Cockpit Wrapped bekeken (js/wrapped.js)
    document.addEventListener('ai:wrapped', (event) => {
      const edition = (event.detail || {}).id;
      if (joined() && edition) activitiesFor('wrapped', edition).forEach((found) => record('activity', found.item, { activity: found.activity }));
    });
    document.addEventListener('ai:demo-af', (event) => record('demo_watched', (event.detail || {}).id));
    // Insturen in de ideeënhub; een verzoek om in te vliegen levert pas iets op als er een usecase van komt, en
    // een testervaring telt apart (hieronder, per agent één keer)
    document.addEventListener('ai:ingestuurd', (event) => {
      const detail = event.detail || {};
      if (!NOT_SENT.includes(detail.kind)) record('idea_sent', detail.ref);
    });
    document.addEventListener('ai:getest', (event) => {
      const id = String((event.detail || {}).id || '');
      if (id) record('test_shared', id);
    });
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
    MILES,
    CAPS,
    RECENCY_DAYS,
    defaults,
    SELF_KINDS,
    NOT_SENT,
    ADMIN_KINDS,
    LABELS,
    CHECKS,
    ACTIVITIES,
    STATS,
    ONCE_STATS,
    statLabel,
    label,
    activitiesFor,
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
