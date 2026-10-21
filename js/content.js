/* ==========================================================================
   Inhoud inlezen en controleren
   --------------------------------------------------------------------------
   De inhoud komt uit de database (Beheer → Inhoud) of, zolang die nog niet
   is ingericht of even niet bereikbaar is, uit de bestanden in data/.
   Beide hebben dezelfde velden. Hier vullen we ontbrekende velden aan en
   melden fouten in de console, zonder dat de pagina stukgaat. De prompts
   uit de usecases komen automatisch in de promptdatabase.
   Links naar video's, demo's en bijlagen moeten een eigen bestand zijn
   (relatief pad) of beginnen met https://; al het andere wordt genegeerd.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { normalize } = ns.ui;
  const ID_PATTERN = /^[a-z0-9-]+$/;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const ACCENTS = ['teal', 'crimson', 'steel', 'rose', 'deepteal', 'navy'];
  const TIP_ACCENTS = ['crimson', 'teal', 'steel', 'deepteal', 'rose', 'navy'];

  const state = {
    phases: [],
    phaseById: new Map(),
    usecases: [],
    usecaseById: new Map(),
    prompts: [],
    promptById: new Map(),
    tips: [],
    tipById: new Map(),
    tipCategories: [],
    openTips: [],
    currentWeeklyTip: null,
    nextWeeklyTip: null,
    trainings: [],
    trainingById: new Map(),
    trainingCategories: [],
    agents: [],
    agentById: new Map(),
    settings: {},
    source: 'bestanden', // 'bestanden' | 'database' | 'cache'
    updatedAt: '',
    issues: []
  };

  function warn(message) {
    state.issues.push(message);
    console.warn('[AI Cockpit Audit] ' + message);
  }

  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const list = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);
  const bool = (value) => (value === true ? true : value === false ? false : null);

  /* Alleen eigen bestanden (relatief pad, geen 'javascript:' of ander schema) of https:// */
  const LOCAL_PATH = /^(?![a-z][a-z0-9+.-]*:)(?!\/\/)[^\s<>"'`]+$/i;
  const HTTPS_URL = /^https:\/\/[^\s<>"'`]+$/i;
  /* Het platform stond eerst in de map audit/ van de AI Snackbar. Paden uit die tijd ('../assets/…')
     staan nog in de database; die bestanden staan nu in assets/ van deze site. */
  const LEGACY_ASSETS = /^\.\.\/assets\//;
  function localPath(value, where) {
    const path = text(value).replace(LEGACY_ASSETS, 'assets/');
    if (!path) return '';
    if (LOCAL_PATH.test(path)) return path;
    warn(`${where}: '${path}' is geen eigen bestand (relatief pad) en wordt genegeerd.`);
    return '';
  }
  function linkOrPath(value, where) {
    const link = text(value).replace(LEGACY_ASSETS, 'assets/');
    if (!link) return '';
    if (HTTPS_URL.test(link) || LOCAL_PATH.test(link)) return link;
    warn(`${where}: '${link}' moet met https:// beginnen of een eigen bestand zijn; genegeerd.`);
    return '';
  }

  function checkId(id, kind, seen) {
    if (!id || !ID_PATTERN.test(id)) {
      warn(`${kind} zonder geldige id (alleen kleine letters, cijfers en '-'): ${JSON.stringify(id)}; overgeslagen.`);
      return false;
    }
    if (seen.has(id)) {
      warn(`${kind} '${id}' komt twee keer voor; de tweede is overgeslagen.`);
      return false;
    }
    return true;
  }

  /* ---- Fasen ----------------------------------------------------------------- */
  function loadPhases(raw) {
    (Array.isArray(raw) ? raw : []).forEach((item) => {
      const id = text(item && item.id);
      if (!checkId(id, 'Fase', state.phaseById)) return;
      const phase = {
        id,
        label: text(item.label) || id,
        short: text(item.short) || text(item.label) || id,
        accent: ACCENTS.includes(item.accent) ? item.accent : 'navy',
        icon: text(item.icon) || 'grid'
      };
      state.phases.push(phase);
      state.phaseById.set(id, phase);
    });
    if (!state.phases.length) {
      const phase = { id: 'algemeen', label: 'Algemeen', short: 'Algemeen', accent: 'navy', icon: 'grid' };
      state.phases.push(phase);
      state.phaseById.set(phase.id, phase);
    }
  }

  function phaseFor(id, where) {
    const phase = state.phaseById.get(id);
    if (phase) return phase;
    warn(`${where}: onbekende fase '${id}' (zie data/phases.js); de eerste fase is gebruikt.`);
    return state.phases[0];
  }

  /* ---- Usecases ----------------------------------------------------------------- */
  function loadUsecases(raw) {
    (Array.isArray(raw) ? raw : []).forEach((item, index) => {
      const id = text(item && item.id);
      if (!checkId(id, 'Usecase', state.usecaseById)) return;
      const title = text(item.title);
      if (!title) {
        warn(`Usecase '${id}' heeft geen titel; overgeslagen.`);
        return;
      }
      const phase = phaseFor(text(item.phase), `Usecase '${id}'`);
      const prompts = (Array.isArray(item.prompts) ? item.prompts : [])
        .map((prompt, n) => ({ label: text(prompt && prompt.label) || 'Prompt ' + (n + 1), text: text(prompt && prompt.text) }))
        .filter((prompt) => prompt.text);
      if (!prompts.length) warn(`Usecase '${id}' heeft geen prompts.`);
      const usecase = {
        id,
        order: index,
        title,
        subtitle: text(item.subtitle),
        phase,
        accent: phase.accent,
        level: text(item.level),
        duration: text(item.duration),
        license: bool(item.license),
        tools: list(item.tools),
        icon: text(item.icon) || phase.icon,
        featured: item.featured === true,
        added: text(item.added),
        intro: text(item.intro),
        video: localPath(item.video, `Usecase '${id}' (video)`),
        demo: localPath(item.demo, `Usecase '${id}' (demo)`),
        steps: list(item.steps),
        prompts,
        promptNote: text(item.promptNote),
        watchOut: list(item.watchOut),
        tip: text(item.tip),
        relatedTips: list(item.relatedTips),
        draft: item._draft === true
      };
      usecase.hasDemo = Boolean(usecase.video || usecase.demo);
      state.usecases.push(usecase);
      state.usecaseById.set(id, usecase);
    });
  }

  /* ---- Prompts -------------------------------------------------------------------- */
  function loadPrompts(raw) {
    const standalone = [];
    (Array.isArray(raw) ? raw : []).forEach((item, index) => {
      const id = text(item && item.id);
      if (!checkId(id, 'Prompt', state.promptById)) return;
      if (state.usecaseById.has(id)) {
        warn(`Prompt '${id}' heeft dezelfde id als een usecase; overgeslagen.`);
        return;
      }
      const prompt = text(item.prompt);
      if (!text(item.title) || !prompt) {
        warn(`Prompt '${id}' mist een titel of prompttekst; overgeslagen.`);
        return;
      }
      const phase = phaseFor(text(item.phase), `Prompt '${id}'`);
      const entry = {
        id,
        order: 1000 + index,
        title: text(item.title),
        description: text(item.description),
        phase,
        accent: phase.accent,
        task: text(item.task),
        tool: text(item.tool),
        license: bool(item.license),
        prompt,
        note: text(item.note),
        tip: text(item.tip),
        added: text(item.added),
        author: text(item.author),
        usecase: null,
        draft: item._draft === true
      };
      standalone.push(entry);
      state.promptById.set(id, entry);
    });

    // Prompts uit de usecases: één item per stap, met link naar de demo.
    const derived = [];
    state.usecases.forEach((usecase) => {
      usecase.promptIds = [];
      usecase.prompts.forEach((step, n) => {
        const id = `${usecase.id}-${n + 1}`;
        if (state.promptById.has(id)) {
          warn(`Prompt-id '${id}' bestaat al; de prompt uit usecase '${usecase.id}' is overgeslagen.`);
          return;
        }
        const label = step.label.replace(/^stap\s*\d+\s*[·:.-]\s*/i, '');
        const entry = {
          id,
          order: usecase.order * 10 + n,
          title: label,
          description: usecase.prompts.length > 1 ? `Stap ${n + 1} van ${usecase.prompts.length} uit de usecase "${usecase.title}".` : `Uit de usecase "${usecase.title}".`,
          phase: usecase.phase,
          accent: usecase.accent,
          task: '',
          tool: usecase.tools[0] || '',
          license: usecase.license,
          prompt: step.text,
          note: usecase.promptNote,
          tip: n === 0 ? usecase.tip : '',
          added: usecase.added,
          author: '',
          usecase,
          step: n + 1,
          steps: usecase.prompts.length,
          draft: usecase.draft
        };
        usecase.promptIds.push(id);
        derived.push(entry);
        state.promptById.set(id, entry);
      });
    });

    // Volgorde: per fase; binnen een fase eerst de usecase-prompts, dan de losse prompts.
    const phaseOrder = new Map(state.phases.map((phase, index) => [phase.id, index]));
    state.prompts = derived.concat(standalone).sort((a, b) => phaseOrder.get(a.phase.id) - phaseOrder.get(b.phase.id) || a.order - b.order);
  }

  /* ---- Tips ----------------------------------------------------------------------- */
  function loadTips(raw) {
    const categories = new Map();
    (Array.isArray(raw) ? raw : []).forEach((item, index) => {
      const id = text(item && item.id);
      if (!checkId(id, 'Tip', state.tipById)) return;
      if (!text(item.title) || !Array.isArray(item.steps)) {
        warn(`Tip '${id}' mist een titel of stappen; overgeslagen.`);
        return;
      }
      const categoryLabel = text(item.category) || 'Overig';
      if (!categories.has(categoryLabel)) {
        categories.set(categoryLabel, { label: categoryLabel, accent: TIP_ACCENTS[categories.size % TIP_ACCENTS.length], tips: [] });
      }
      const category = categories.get(categoryLabel);
      const example = item.example && text(item.example.text) ? { label: text(item.example.label) || 'Voorbeeld', text: text(item.example.text) } : null;
      const tip = {
        id,
        order: index,
        title: text(item.title),
        summary: text(item.summary),
        category,
        accent: category.accent,
        icon: text(item.icon) || 'bulb',
        license: bool(item.license),
        featured: item.featured === true,
        minutes: text(item.minutes),
        why: text(item.why),
        steps: list(item.steps),
        example,
        note: text(item.note),
        added: text(item.added),
        release: '',
        usecases: list(item.usecases),
        draft: item._draft === true
      };
      const release = text(item.release);
      if (release && !DATE.test(release)) warn(`Tip '${id}': release '${release}' is geen datum (JJJJ-MM-DD); de tip is altijd zichtbaar.`);
      else if (release) {
        tip.release = release;
        if (new Date(release + 'T12:00:00').getDay() !== 5) warn(`Tip '${id}': release ${release} is geen vrijdag.`);
      }
      // Tip van de week: op slot tot de vrijgavedatum. Vanaf dan telt die datum als 'toegevoegd'.
      tip.weekly = Boolean(tip.release);
      tip.locked = tip.weekly && tip.release > today();
      if (tip.weekly) tip.added = tip.release;
      category.tips.push(tip);
      state.tips.push(tip);
      state.tipById.set(id, tip);
    });
    state.tipCategories = Array.from(categories.values());
    state.openTips = state.tips.filter((tip) => !tip.locked);
    const weekly = state.tips.filter((tip) => tip.weekly).sort((a, b) => (a.release < b.release ? -1 : 1));
    // De tip van deze week = de laatst vrijgegeven; daarna de eerstvolgende die nog op slot zit.
    state.currentWeeklyTip = weekly.filter((tip) => !tip.locked).pop() || null;
    state.nextWeeklyTip = weekly.find((tip) => tip.locked) || null;
  }

  /**
   * Vandaag als JJJJ-MM-DD (lokale tijd). Alleen met debugMode: true in js/config.js
   * kun je een andere dag nabootsen met ?datum=JJJJ-MM-DD in het adres (om het slot te testen).
   */
  function today() {
    if (ns.config && ns.config.debugMode) {
      const fake = new URLSearchParams(window.location.search).get('datum');
      if (fake && DATE.test(fake)) return fake;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /** Aantal dagen van vandaag tot een datum (JJJJ-MM-DD). */
  function daysUntil(date) {
    return Math.round((new Date(date + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 86400000);
  }

  /* ---- Trainingen ----------------------------------------------------------------------- */
  const TIME = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

  /** '12:30' of '1:02:05' → seconden */
  function toSeconds(time) {
    return time.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }

  function loadTrainings(raw) {
    const categories = [];
    (Array.isArray(raw) ? raw : []).forEach((item, index) => {
      const id = text(item && item.id);
      if (!checkId(id, 'Training', state.trainingById)) return;
      if (!text(item.title) || !/^\d{4}-\d{2}-\d{2}$/.test(text(item.date))) {
        warn(`Training '${id}' mist een titel of een datum (JJJJ-MM-DD); overgeslagen.`);
        return;
      }
      const category = text(item.category) || 'Training';
      if (!categories.includes(category)) categories.push(category);
      const link = text(item.link);
      if (link && !HTTPS_URL.test(link)) warn(`Training '${id}': de link moet met https:// beginnen.`);
      const training = {
        id,
        order: index,
        title: text(item.title),
        subtitle: text(item.subtitle),
        date: text(item.date),
        duration: text(item.duration),
        trainer: text(item.trainer),
        category,
        accent: TIP_ACCENTS[categories.indexOf(category) % TIP_ACCENTS.length],
        level: text(item.level),
        license: bool(item.license),
        description: text(item.description),
        link: HTTPS_URL.test(link) ? link : '',
        video: localPath(item.video, `Training '${id}' (video)`),
        poster: localPath(item.poster, `Training '${id}' (poster)`),
        chapters: (Array.isArray(item.chapters) ? item.chapters : [])
          .map((chapter) => ({ time: text(chapter && chapter.time), title: text(chapter && chapter.title) }))
          .filter((chapter) => chapter.title && TIME.test(chapter.time))
          .map((chapter) => Object.assign(chapter, { seconds: toSeconds(chapter.time) })),
        materials: (Array.isArray(item.materials) ? item.materials : [])
          .map((material) => ({ label: text(material && material.label), href: linkOrPath(material && material.href, `Training '${id}' (materiaal)`) }))
          .filter((material) => material.label && material.href),
        usecases: list(item.usecases),
        tips: list(item.tips),
        added: text(item.added) || text(item.date),
        draft: item._draft === true
      };
      training.hasRecording = Boolean(training.link || training.video);
      state.trainings.push(training);
      state.trainingById.set(id, training);
    });
    // Nieuwste training bovenaan
    state.trainings.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.order - b.order));
    state.trainingCategories = categories;
  }

  /* ---- Agents & tools ------------------------------------------------------------------ */
  const AGENT_KINDS = ['Microsoft-standaard', 'Eigen agent', 'Extern product'];
  const AGENT_STATUSES = ['Beschikbaar', 'Pilot', 'In ontwikkeling', 'Gestopt'];
  const KIND_ACCENTS = { 'Microsoft-standaard': 'steel', 'Eigen agent': 'deepteal', 'Extern product': 'rose' };

  function loadAgents(raw) {
    (Array.isArray(raw) ? raw : []).forEach((item, index) => {
      const id = text(item && item.id);
      if (!checkId(id, 'Agent', state.agentById)) return;
      if (!text(item.title)) {
        warn(`Agent '${id}' heeft geen titel; overgeslagen.`);
        return;
      }
      let kind = text(item.kind);
      if (!AGENT_KINDS.includes(kind)) {
        warn(`Agent '${id}': onbekende soort '${kind}' (${AGENT_KINDS.join(', ')}); '${AGENT_KINDS[0]}' is gebruikt.`);
        kind = AGENT_KINDS[0];
      }
      let status = text(item.status);
      if (!AGENT_STATUSES.includes(status)) {
        warn(`Agent '${id}': onbekende status '${status}' (${AGENT_STATUSES.join(', ')}); '${AGENT_STATUSES[0]}' is gebruikt.`);
        status = AGENT_STATUSES[0];
      }
      const link = text(item.link);
      if (link && !HTTPS_URL.test(link)) warn(`Agent '${id}': de link moet met https:// beginnen.`);
      const registerUrl = text(item.registerUrl);
      if (registerUrl && !HTTPS_URL.test(registerUrl)) warn(`Agent '${id}': de link naar het AI-register moet met https:// beginnen.`);
      const agent = {
        id,
        order: index,
        title: text(item.title),
        kind,
        accent: KIND_ACCENTS[kind],
        summary: text(item.summary),
        description: text(item.description),
        phases: list(item.phases).filter((pid) => {
          if (state.phaseById.has(pid)) return true;
          warn(`Agent '${id}': onbekende fase '${pid}' (zie data/phases.js); overgeslagen.`);
          return false;
        }).map((pid) => state.phaseById.get(pid)),
        status,
        license: bool(item.license),
        access: text(item.access),
        link: HTTPS_URL.test(link) ? link : '',
        owner: text(item.owner),
        notFor: list(item.notFor),
        usecases: list(item.usecases),
        trainings: list(item.trainings),
        tips: list(item.tips),
        icon: text(item.icon) || 'robot',
        added: text(item.added),
        registerUrl: HTTPS_URL.test(registerUrl) ? registerUrl : '',
        draft: item._draft === true
      };
      agent.stopped = agent.status === 'Gestopt';
      state.agents.push(agent);
      state.agentById.set(id, agent);
    });
    // Gestopte agents onderaan (verder de volgorde uit het bestand of Beheer)
    state.agents.sort((a, b) => Number(a.stopped) - Number(b.stopped) || a.order - b.order);
  }

  /* ---- Verwijzingen controleren ------------------------------------------------------ */
  function checkReferences() {
    state.trainings.forEach((training) => {
      training.usecases = training.usecases.filter((uid) => {
        if (state.usecaseById.has(uid)) return true;
        warn(`Training '${training.id}' verwijst naar onbekende usecase '${uid}'.`);
        return false;
      });
      training.tips = training.tips.filter((tid) => {
        if (state.tipById.has(tid)) return true;
        warn(`Training '${training.id}' verwijst naar onbekende tip '${tid}'.`);
        return false;
      });
    });
    state.usecases.forEach((usecase) => {
      usecase.relatedTips = usecase.relatedTips.filter((id) => {
        if (state.tipById.has(id)) return true;
        warn(`Usecase '${usecase.id}' verwijst naar onbekende tip '${id}'.`);
        return false;
      });
    });
    state.tips.forEach((tip) => {
      tip.usecases = tip.usecases.filter((id) => {
        if (state.usecaseById.has(id)) return true;
        warn(`Tip '${tip.id}' verwijst naar onbekende usecase '${id}'.`);
        return false;
      });
    });
    const known = { usecases: ['usecaseById', 'usecase'], trainings: ['trainingById', 'training'], tips: ['tipById', 'tip'] };
    state.agents.forEach((agent) => {
      Object.entries(known).forEach(([field, [map, label]]) => {
        agent[field] = agent[field].filter((id) => {
          if (state[map].has(id)) return true;
          warn(`Agent '${agent.id}' verwijst naar onbekende ${label} '${id}'.`);
          return false;
        });
      });
    });
  }

  /* ---- Zoeken -------------------------------------------------------------------- */
  function buildSearchIndex() {
    state.usecases.forEach((usecase) => {
      usecase.haystack = normalize([usecase.title, usecase.subtitle, usecase.intro, usecase.phase.label, usecase.tools.join(' '), usecase.steps.join(' '), usecase.prompts.map((p) => p.label + ' ' + p.text).join(' ')].join(' '));
    });
    state.prompts.forEach((prompt) => {
      prompt.haystack = normalize([prompt.title, prompt.description, prompt.phase.label, prompt.task, prompt.tool, prompt.prompt, prompt.note, prompt.usecase ? prompt.usecase.title : ''].join(' '));
    });
    state.tips.forEach((tip) => {
      tip.haystack = normalize([tip.title, tip.summary, tip.category.label, tip.why, tip.steps.join(' '), tip.example ? tip.example.text : '', tip.note].join(' '));
    });
    state.trainings.forEach((training) => {
      training.haystack = normalize([training.title, training.subtitle, training.category, training.trainer, training.description, training.chapters.map((c) => c.title).join(' ')].join(' '));
    });
    state.agents.forEach((agent) => {
      agent.haystack = normalize([agent.title, agent.summary, agent.description, agent.kind, agent.status, agent.access, agent.owner, agent.notFor.join(' '), agent.phases.map((p) => p.label).join(' ')].join(' '));
    });
  }

  function search(query) {
    const { matches } = ns.ui;
    return {
      usecases: state.usecases.filter((item) => matches(item.haystack, query)),
      prompts: state.prompts.filter((item) => matches(item.haystack, query)),
      tips: state.openTips.filter((item) => matches(item.haystack, query)),
      trainings: state.trainings.filter((item) => matches(item.haystack, query)),
      agents: state.agents.filter((item) => matches(item.haystack, query))
    };
  }

  /**
   * Recent toegevoegd, over alle soorten heen (nieuwste eerst). Bij dezelfde
   * datum om en om een usecase, prompt en tip, en hooguit de helft van één soort
   * (zolang er genoeg andere is), zodat het lijstje gevarieerd blijft.
   */
  function recent(limit) {
    const KIND_ORDER = { training: 0, agent: 1, usecase: 2, prompt: 3, tip: 4 };
    const max = limit || 6;
    const entries = (kind, items) => items.filter((item) => item.added).map((item, rank) => ({ kind, item, added: item.added, rank }));
    const byDate = (a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : a.rank - b.rank || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const all = []
      .concat(entries('training', state.trainings.filter((item) => item.hasRecording)))
      .concat(entries('agent', state.agents.filter((item) => !item.stopped).sort((a, b) => b.order - a.order)))
      .concat(entries('usecase', state.usecases.slice().sort((a, b) => b.order - a.order)))
      .concat(entries('prompt', state.prompts.filter((item) => !item.usecase).sort((a, b) => b.order - a.order)))
      .concat(entries('tip', state.openTips.slice().sort((a, b) => b.order - a.order)))
      .sort(byDate);
    const perKind = {};
    const picked = all.filter((entry) => (perKind[entry.kind] = (perKind[entry.kind] || 0) + 1) <= Math.ceil(max / 2)).slice(0, max);
    return picked.concat(all.filter((entry) => !picked.includes(entry)).slice(0, max - picked.length)).sort(byDate);
  }

  /* ---- Bronnen: bestanden of database ------------------------------------------------ */
  const TYPES = ['phase', 'usecase', 'prompt', 'tip', 'training', 'agent'];
  // Teksten die je in Beheer kunt aanpassen (de rest van de instellingen blijft in js/config.js)
  const SETTING_KEYS = ['applicationTitle', 'discipline', 'tagline', 'applicationSubtitle', 'rules'];

  function reset() {
    Object.assign(state, {
      phases: [], phaseById: new Map(),
      usecases: [], usecaseById: new Map(),
      prompts: [], promptById: new Map(),
      tips: [], tipById: new Map(), tipCategories: [], openTips: [], currentWeeklyTip: null, nextWeeklyTip: null,
      trainings: [], trainingById: new Map(), trainingCategories: [],
      agents: [], agentById: new Map(),
      settings: {}, updatedAt: '', issues: []
    });
  }

  /** De inhoud uit de bestanden in data/ (startinhoud, en terugval als de database niet bereikbaar is). */
  function fromFiles() {
    const setting = {};
    SETTING_KEYS.forEach((name) => {
      if (ns.config && ns.config[name] != null) setting[name] = ns.config[name];
    });
    return { phase: ns.phases || [], usecase: ns.usecases || [], prompt: ns.prompts || [], tip: ns.tips || [], training: ns.trainings || [], agent: ns.agents || [], setting };
  }

  /**
   * Databaserijen → bron. Geeft null zolang de database nog niet leidend is (geen rij meta/bron):
   * dan blijven de bestanden gelden. Prullenbak telt niet mee; concepten (alleen voor beheerders) krijgen _draft.
   */
  function fromRows(rows) {
    if (!Array.isArray(rows) || !rows.some((row) => row.type === 'meta' && row.id === 'bron')) return null;
    const source = { phase: [], usecase: [], prompt: [], tip: [], training: [], agent: [], setting: {}, updatedAt: '' };
    rows.slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0) || (a.id < b.id ? -1 : 1))
      .forEach((row) => {
        if (row.updated_at && row.updated_at > source.updatedAt) source.updatedAt = row.updated_at;
        if (row.status === 'trash') return;
        if (row.type === 'setting') {
          if (row.id === 'site' && row.status === 'published') source.setting = row.data || {};
          return;
        }
        if (!TYPES.includes(row.type)) return;
        const item = Object.assign({}, row.data, { id: row.id });
        if (row.status === 'draft') item._draft = true;
        source[row.type].push(item);
      });
    return source;
  }

  /** De bestanden als databaserijen (Beheer → Inhoud → Overzetten). */
  function toRows() {
    const files = fromFiles();
    const rows = [];
    TYPES.forEach((type) => {
      (files[type] || []).forEach((item, index) => {
        if (!item || !item.id) return;
        const data = Object.assign({}, item);
        delete data.id;
        rows.push({ type, id: String(item.id), data, position: (index + 1) * 10, status: 'published' });
      });
    });
    rows.push({ type: 'setting', id: 'site', data: files.setting, position: 0, status: 'published' });
    rows.push({ type: 'meta', id: 'bron', data: { overgezet: new Date().toISOString() }, position: 0, status: 'published' });
    return rows;
  }

  /** Inhoud (opnieuw) inlezen. source: uit fromRows(); zonder: de bestanden. */
  function load(source) {
    const src = source || fromFiles();
    reset();
    state.settings = src.setting || {};
    state.updatedAt = src.updatedAt || '';
    loadPhases(src.phase);
    loadUsecases(src.usecase);
    loadPrompts(src.prompt);
    loadTips(src.tip);
    loadTrainings(src.training);
    loadAgents(src.agent);
    checkReferences();
    buildSearchIndex();
    return state;
  }

  ns.content = Object.assign(state, { load, fromFiles, fromRows, toRows, search, recent, today, daysUntil, TYPES, SETTING_KEYS, AGENT_KINDS, AGENT_STATUSES });
})(window.AIAudit);
