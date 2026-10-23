/* ==========================================================================
   Inhoud inlezen en controleren
   --------------------------------------------------------------------------
   De inhoud komt uit de database (Beheer → Inhoud) of, zolang die nog niet
   is ingericht of even niet bereikbaar is, uit de bestanden in data/.
   Een cockpit toont de gedeelde basis (naamruimte 'ai-algemeen') plus de
   eigen inhoud van de discipline; items uit de basis krijgen 'shared'.
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

  /* Alleen eigen bestanden (relatief pad, geen 'javascript:' of ander schema) of https://.
     Geen backslash: browsers lezen '/\host' als '//host', een ander domein. */
  const LOCAL_PATH = /^(?![a-z][a-z0-9+.-]*:)(?!\/\/)[^\s<>"'`\\]+$/i;
  const HTTPS_URL = /^https:\/\/[^\s<>"'`]+$/i;
  /* Het platform stond eerst in de map audit/ van de AI Snackbar. Paden uit die tijd ('../assets/…')
     staan nog in de database; die bestanden staan nu in assets/ van deze site. */
  const LEGACY_ASSETS = /^\.\.\/assets\//;
  function localPath(value, where) {
    const path = text(value).replace(LEGACY_ASSETS, 'assets/');
    if (!path) return '';
    if (LOCAL_PATH.test(path)) return path;
    // Geüpload via Beheer (Supabase Storage, map cockpit-media)
    if (ns.central && ns.central.isMediaUrl && ns.central.isMediaUrl(path)) return path;
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
        icon: text(item.icon) || 'grid',
        shared: item._shared === true
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
        draft: item._draft === true,
        change: item._change || '',
        shared: item._shared === true
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
        draft: item._draft === true,
        change: item._change || '',
        shared: item._shared === true
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
          draft: usecase.draft,
          change: usecase.change,
          shared: usecase.shared
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
        draft: item._draft === true,
        change: item._change || '',
        shared: item._shared === true
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

  const objects = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);

  /** Sleutel van een actie voor het afvinken: uit de kop, uniek binnen de training. */
  function actionKey(title, taken) {
    const base = normalize(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'actie';
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    taken.add(key);
    return key;
  }

  /**
   * Naslagwerk bij een training (allemaal optioneel): slides, wat je meeneemt, acties om af te vinken,
   * ideeën en vragen uit de zaal en het vervolg. Zie data/trainings.js voor de velden.
   */
  function loadNaslag(item, id) {
    const where = `Training '${id}'`;
    const slides = objects(item.slides)
      .map((slide, n) => ({ image: localPath(slide.image, `${where} (slide ${n + 1})`), title: text(slide.title) }))
      .filter((slide) => slide.image)
      .map((slide, n) => Object.assign(slide, { number: n + 1, title: slide.title || 'Slide ' + (n + 1) }));

    const takeaways = objects(item.takeaways)
      .map((card) => ({ title: text(card.title), text: text(card.text), warning: card.warning === true }))
      .filter((card) => card.title || card.text);

    const keys = new Set();
    const actions = objects(item.actions).map((action, n) => {
      const title = text(action.title);
      if (!title) {
        warn(`${where}: actie ${n + 1} heeft geen kop; overgeslagen.`);
        return null;
      }
      // Slidenummer: getal of tekst ('14'), binnen het aantal slides
      let slide = 0;
      const rawSlide = typeof action.slide === 'number' ? String(action.slide) : text(action.slide);
      if (rawSlide) {
        const number = /^\d+$/.test(rawSlide) ? Number(rawSlide) : 0;
        if (number >= 1 && number <= slides.length) slide = number;
        else warn(`${where}: actie '${title}' verwijst naar slide '${rawSlide}', maar er zijn ${slides.length} slides; link weggelaten.`);
      }
      return {
        key: actionKey(title, keys),
        title,
        text: text(action.text),
        slide,
        more: text(action.more),
        howto: objects(action.howto).map((part) => ({ title: text(part.title), steps: list(part.steps) })).filter((part) => part.steps.length),
        note: text(action.note),
        prompts: objects(action.prompts)
          .map((prompt, p) => ({ label: text(prompt.label) || 'Prompt ' + (p + 1), text: text(prompt.text) }))
          .filter((prompt) => prompt.text)
      };
    }).filter(Boolean);

    const ideas = objects(item.ideas)
      .map((idea) => ({ title: text(idea.title), text: text(idea.text) }))
      .filter((idea) => idea.title || idea.text);

    const timeline = objects(item.timeline)
      .map((step) => ({ month: text(step.month), title: text(step.title), text: text(step.text), current: step.current === true, training: text(step.training) }))
      .filter((step) => step.title || step.month);

    return { slides, takeaways, actions, ideas, questions: list(item.questions), timeline, timelineIntro: text(item.timelineIntro) };
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
        draft: item._draft === true,
        change: item._change || '',
        shared: item._shared === true
      };
      Object.assign(training, loadNaslag(item, id));
      training.hasRecording = Boolean(training.link || training.video);
      training.hasNaslag = ['slides', 'takeaways', 'actions', 'ideas', 'questions', 'timeline'].some((key) => training[key].length > 0);
      // Iets om te bekijken: een opname of een naslagwerk (anders: 'Gepland' of 'Opname volgt')
      training.available = training.hasRecording || training.hasNaslag;
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
          // Een gedeelde agent mag fasen noemen die alleen in een andere cockpit bestaan
          if (item._shared !== true) warn(`Agent '${id}': onbekende fase '${pid}' (zie data/phases.js); overgeslagen.`);
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
        draft: item._draft === true,
        change: item._change || '',
        shared: item._shared === true
      };
      agent.stopped = agent.status === 'Gestopt';
      state.agents.push(agent);
      state.agentById.set(id, agent);
    });
    // Gestopte agents onderaan (verder de volgorde uit het bestand of Beheer)
    state.agents.sort((a, b) => Number(a.stopped) - Number(b.stopped) || a.order - b.order);
  }

  /* ---- Verwijzingen controleren ------------------------------------------------------ */
  // Een gedeeld item mag verwijzen naar iets dat alleen in een andere cockpit staat: dan stil weglaten
  const missing = (item, message) => {
    if (!item.shared) warn(message);
    return false;
  };

  function checkReferences() {
    state.trainings.forEach((training) => {
      training.usecases = training.usecases.filter((uid) => state.usecaseById.has(uid) || missing(training, `Training '${training.id}' verwijst naar onbekende usecase '${uid}'.`));
      training.tips = training.tips.filter((tid) => state.tipById.has(tid) || missing(training, `Training '${training.id}' verwijst naar onbekende tip '${tid}'.`));
      // Vervolg: een stap mag naar een andere training linken (die zelf geen link krijgt)
      training.timeline.forEach((step) => {
        if (!step.training) return;
        if (!state.trainingById.has(step.training)) warn(`Training '${training.id}': het vervolg verwijst naar onbekende training '${step.training}'.`);
        if (!state.trainingById.has(step.training) || step.training === training.id) step.training = '';
      });
    });
    state.usecases.forEach((usecase) => {
      usecase.relatedTips = usecase.relatedTips.filter((id) => state.tipById.has(id) || missing(usecase, `Usecase '${usecase.id}' verwijst naar onbekende tip '${id}'.`));
    });
    state.tips.forEach((tip) => {
      tip.usecases = tip.usecases.filter((id) => state.usecaseById.has(id) || missing(tip, `Tip '${tip.id}' verwijst naar onbekende usecase '${id}'.`));
    });
    const known = { usecases: ['usecaseById', 'usecase'], trainings: ['trainingById', 'training'], tips: ['tipById', 'tip'] };
    state.agents.forEach((agent) => {
      Object.entries(known).forEach(([field, [map, label]]) => {
        agent[field] = agent[field].filter((id) => state[map].has(id) || missing(agent, `Agent '${agent.id}' verwijst naar onbekende ${label} '${id}'.`));
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
      training.haystack = normalize([
        training.title, training.subtitle, training.category, training.trainer, training.description, training.chapters.map((c) => c.title).join(' '),
        // Naslagwerk
        training.slides.map((s) => s.title).join(' '),
        training.takeaways.map((t) => t.title + ' ' + t.text).join(' '),
        training.actions.map((a) => [a.title, a.text, a.more, a.note, a.howto.map((h) => h.title + ' ' + h.steps.join(' ')).join(' '), a.prompts.map((p) => p.label + ' ' + p.text).join(' ')].join(' ')).join(' '),
        training.ideas.map((i) => i.title + ' ' + i.text).join(' '),
        training.questions.join(' '),
        training.timelineIntro,
        training.timeline.map((t) => [t.month, t.title, t.text].join(' ')).join(' ')
      ].join(' '));
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
      .concat(entries('training', state.trainings.filter((item) => item.available)))
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
  // Teksten die je in Beheer kunt aanpassen (de rest van de instellingen blijft in js/config.js;
  // de naam van de discipline komt uit Beheer → Disciplines)
  const SETTING_KEYS = ['applicationTitle', 'tagline', 'applicationSubtitle', 'rules'];
  // Bij het samenvoegen: eigen fasen, usecases en prompts vóór die van de basis; tips, trainingen en agents erna
  const OWN_FIRST = { phase: true, usecase: true, prompt: true };
  const filesId = () => (ns.cockpit ? ns.cockpit.FILES_ID : 'audit');

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

  const emptySource = () => ({ phase: [], usecase: [], prompt: [], tip: [], training: [], agent: [], setting: {}, updatedAt: '' });

  /**
   * De inhoud uit de bestanden in data/ (startinhoud, en terugval als de database niet bereikbaar is).
   * Die bestanden zijn van Audit. Voor een andere discipline: alleen de gedeelde basis daaruit
   * (zie sharedBasis in data/disciplines.js).
   */
  function fromFiles(disciplineId) {
    const id = disciplineId || (ns.cockpit ? ns.cockpit.activeId() : filesId());
    const setting = {};
    SETTING_KEYS.forEach((name) => {
      if (ns.config && ns.config[name] != null) setting[name] = ns.config[name];
    });
    const files = { phase: ns.phases || [], usecase: ns.usecases || [], prompt: ns.prompts || [], tip: ns.tips || [], training: ns.trainings || [], agent: ns.agents || [], setting };
    if (id === filesId()) return files;
    const basis = ns.sharedBasis || {};
    const shared = (type, itemId) => basis[type] === '*' || (Array.isArray(basis[type]) && basis[type].includes(itemId));
    const source = emptySource();
    TYPES.forEach((type) => {
      source[type] = files[type].filter((item) => item && shared(type, item.id)).map((item) => Object.assign({}, item, { _shared: true }));
    });
    // De uitleg onder de slogan gaat over de audit: die niet
    source.setting = Object.assign({}, setting);
    delete source.setting.applicationSubtitle;
    return source;
  }

  /**
   * Databaserijen → bron. Geeft null zolang de database nog niet leidend is (geen rij meta/bron):
   * dan blijven de bestanden gelden. Prullenbak telt niet mee; concepten (alleen voor beheerders) krijgen _draft,
   * met options.shared krijgt alles _shared (de gedeelde basis).
   */
  function fromRows(rows, options) {
    if (!Array.isArray(rows) || !rows.some((row) => row.type === 'meta' && row.id === 'bron')) return null;
    const shared = Boolean(options && options.shared);
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
        // Bewerkmodus (js/editor.js): 'nieuw', 'gewijzigd' of 'niet opgeslagen'
        if (row._change) item._change = row._change;
        if (shared) item._shared = true;
        source[row.type].push(item);
      });
    return source;
  }

  /** Gedeelde basis + eigen inhoud tot één bron. Teksten: die van de discipline gaan voor. */
  function merge(general, own) {
    if (!general) return own;
    const source = {
      setting: Object.assign({}, general.setting, own.setting),
      updatedAt: general.updatedAt > own.updatedAt ? general.updatedAt : own.updatedAt
    };
    TYPES.forEach((type) => {
      source[type] = OWN_FIRST[type] ? own[type].concat(general[type]) : general[type].concat(own[type]);
    });
    return source;
  }

  /**
   * De rijen van één cockpit → bron: de gedeelde basis plus de eigen inhoud van de discipline.
   * options: { own, general } (naamruimtes) en discipline (id). Geeft null als geen van beide al in
   * de database staat; dan gelden de bestanden. Staat alleen de basis er al, dan is de eigen inhoud
   * die uit de bestanden (Audit) of leeg (andere discipline).
   */
  function fromCockpitRows(rows, options) {
    const list = Array.isArray(rows) ? rows : [];
    const own = fromRows(list.filter((row) => row.namespace === options.own));
    const general = fromRows(list.filter((row) => row.namespace === options.general), { shared: true });
    if (!own && !general) return null;
    return merge(general, own || (options.discipline === filesId() ? fromFiles(filesId()) : emptySource()));
  }

  /** De bestanden van Audit als databaserijen (Beheer → Inhoud → Overzetten). */
  function toRows() {
    const files = fromFiles(filesId());
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

  ns.content = Object.assign(state, { load, fromFiles, fromRows, fromCockpitRows, toRows, search, recent, today, daysUntil, TYPES, SETTING_KEYS, AGENT_KINDS, AGENT_STATUSES });
})(window.AIAudit);
