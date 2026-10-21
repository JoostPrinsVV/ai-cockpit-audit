/* ==========================================================================
   AI COCKPIT · PROTOTYPE — DISCIPLINES EN GEDEELDE BASIS
   --------------------------------------------------------------------------
   Eén cockpit, per discipline een eigen inhoud bovenop één gedeelde basis.

   - DISCIPLINES: de cockpits in de wisselaar. status 'live' en 'voorbeeld'
     zijn te openen; 'gepland' staat grijs in de lijst (nog geen inhoud).
   - SHARED: wat in iedere cockpit verschijnt ('Voor iedereen'). In het
     prototype komt die basis uit de auditbestanden in data/; de rest van
     die bestanden is de eigen inhoud van Audit.
   - De eigen inhoud van een andere discipline staat in
     prototype/data/<discipline>.js. Met 'overrides' past een discipline
     een gedeeld item aan (bijv. een eigen voorbeeld bij een gedeelde tip).

   Welke discipline je ziet: ?d=<id> in het adres, anders de laatst gekozen
   (onthouden in deze browser), anders Audit. Draait vóór js/content.js en
   zet de inhoud klaar zoals de bestanden in data/ dat doen.
   ========================================================================== */
(function (ns) {
  'use strict';

  const STORAGE_KEY = 'ai-cockpit-prototype:discipline';

  const BASE_RULES = [
    'Werk alleen in Copilot met je zakelijke account (het schildje), nooit in een gratis of privé-AI-tool.',
    'Deel niet meer dan nodig: geen BSN, privégegevens of stukken die niet bij de opdracht horen.'
  ];

  const DISCIPLINES = [
    {
      id: 'audit',
      name: 'Audit',
      status: 'live',
      icon: 'magnifier-doc',
      accent: 'teal',
      description: 'Controlepraktijk',
      eyebrow: 'Copilot in de controlepraktijk',
      subtitle: 'Usecases met demo, direct bruikbare prompts, tips, trainingen en agents: alles over Copilot in de audit op één plek.',
      phaseText: 'per fase van de controle',
      rules: [
        BASE_RULES[0],
        'Copilot ondersteunt, jij beoordeelt: het professionele oordeel en de handtekening blijven van jou.',
        'Controleer iedere uitkomst tegen de bron en leg vast in het dossier wat je met Copilot hebt gedaan.',
        BASE_RULES[1]
      ]
    },
    {
      id: 'accountancy',
      name: 'Accountancy',
      status: 'voorbeeld',
      icon: 'table',
      accent: 'crimson',
      description: 'Samenstellen, administratie en advies',
      eyebrow: 'Copilot in de samenstelpraktijk',
      subtitle: 'Usecases, prompts en tips voor samenstellen, administratie en advies, op dezelfde basis als de andere disciplines.',
      phaseText: 'per fase van je werk',
      label: 'accountancy', // in lopende tekst: 'in accountancy'
      // Voorbeelden in gedeelde tips die over auditors gaan
      wording: [['Ik ben auditor', 'Ik ben assistent-accountant'], ['voor auditors', 'voor accountancy']],
      rules: [
        BASE_RULES[0],
        'Copilot ondersteunt, jij beoordeelt: het professionele oordeel blijft van jou.',
        'Controleer iedere uitkomst tegen de bron, zeker bedragen in stukken voor de klant.',
        BASE_RULES[1]
      ]
    },
    { id: 'belastingadvies', name: 'Belastingadvies', status: 'gepland', icon: 'document', accent: 'steel', description: 'Aangiftes, fiscale vragen en advies' },
    { id: 'salarisadministratie', name: 'Salarisadministratie', status: 'gepland', icon: 'users', accent: 'deepteal', description: 'Loonverwerking en vragen van werkgevers' }
  ];

  // De gedeelde basis: per soort de id's uit data/ ('*' = alles van die soort)
  const SHARED = {
    phase: ['communicatie', 'eigen-werk'],
    usecase: ['klantoverleg', 'weekplanning'],
    prompt: ['herinnering-stukken', 'teams-bijpraten', 'urenoverzicht', 'afspraak-voorbereiden', 'regelgeving-begrijpen'],
    tip: [
      'instructies', 'schildje', 'facilitator', 'transcriptie', 'geplande-prompts', 'prompts-bewaren', 'prompt-opbouw',
      'doorvragen', 'bestanden-toevoegen', 'researcher-analyst', 'notebooks', 'excel-copilot', 'outlook-samenvatten', 'controleren'
    ],
    training: ['voorbeeld-naslagwerk-copilot-basis'],
    agent: '*'
  };

  const TYPES = ['phase', 'usecase', 'prompt', 'tip', 'training', 'agent'];
  const GLOBALS = { phase: 'phases', usecase: 'usecases', prompt: 'prompts', tip: 'tips', training: 'trainings', agent: 'agents' };
  // Eigen fasen en usecases vóór de gedeelde; eigen tips, trainingen en agents erna
  const OWN_FIRST = { phase: true, usecase: true, prompt: true };

  const byId = new Map(DISCIPLINES.map((discipline) => [discipline.id, discipline]));
  const isOpen = (id) => byId.has(id) && byId.get(id).status !== 'gepland';

  function isShared(type, id) {
    const list = SHARED[type];
    return list === '*' || (Array.isArray(list) && list.includes(id));
  }

  function remembered() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function remember(id) {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch (error) {
      /* niet onthouden is ook goed */
    }
  }

  const requested = new URLSearchParams(window.location.search).get('d') || '';
  const activeId = [requested, remembered(), 'audit'].find(isOpen);
  if (requested && requested === activeId) remember(activeId);
  const active = byId.get(activeId);

  /* ---- Inhoud per discipline ----------------------------------------------------------- */
  const files = {};
  TYPES.forEach((type) => {
    files[type] = Array.isArray(ns[GLOBALS[type]]) ? ns[GLOBALS[type]] : [];
  });
  const extra = ns.disciplineData || {};

  /** Gedeelde basis + eigen inhoud van één discipline (de items zelf blijven ongewijzigd). */
  function compose(id) {
    const own = id === 'audit' ? null : extra[id] || {};
    const overrides = (own && own.overrides) || {};
    const result = {};
    TYPES.forEach((type) => {
      const base = files[type]
        .filter((item) => !own || isShared(type, item && item.id))
        .map((item) => (overrides[type] && overrides[type][item.id] ? Object.assign({}, item, overrides[type][item.id]) : item));
      const mine = own && Array.isArray(own[GLOBALS[type]]) ? own[GLOBALS[type]] : [];
      result[type] = OWN_FIRST[type] ? mine.concat(base) : base.concat(mine);
    });
    return own ? withoutDanglingLinks(result) : result;
  }

  /** Verwijzingen naar items die in deze cockpit niet bestaan (bijv. een audit-usecase bij een gedeelde tip) weglaten. */
  function withoutDanglingLinks(source) {
    const ids = {};
    TYPES.forEach((type) => {
      ids[type] = new Set(source[type].map((item) => item && item.id));
    });
    const keep = (list, type) => (Array.isArray(list) ? list.filter((id) => ids[type].has(id)) : list);
    const links = {
      usecase: { relatedTips: 'tip' },
      tip: { usecases: 'usecase' },
      training: { usecases: 'usecase', tips: 'tip' },
      agent: { usecases: 'usecase', trainings: 'training', tips: 'tip', phases: 'phase' }
    };
    Object.entries(links).forEach(([type, fields]) => {
      source[type] = source[type].map((item) => {
        const copy = Object.assign({}, item);
        Object.entries(fields).forEach(([field, target]) => {
          copy[field] = keep(item[field], target);
        });
        return copy;
      });
    });
    return source;
  }

  // Gedeeld = in SHARED én afkomstig uit de basis (data/), niet uit de eigen bestanden van een discipline
  const baseIds = {};
  TYPES.forEach((type) => {
    baseIds[type] = new Set(files[type].map((item) => item && item.id));
  });
  const fromBase = (type, id) => isShared(type, id) && baseIds[type].has(id);

  /** Aantallen voor de uitleg: eigen inhoud en gedeelde basis van een discipline (tips op slot tellen niet mee). */
  function stats(id) {
    const source = compose(id);
    const today = ns.content ? ns.content.today() : '';
    const part = (shared) => {
      const pick = (type) => source[type].filter((item) => fromBase(type, item.id) === shared);
      const usecases = pick('usecase');
      return {
        phases: pick('phase').length,
        usecases: usecases.length,
        prompts: pick('prompt').length + usecases.reduce((total, usecase) => total + (Array.isArray(usecase.prompts) ? usecase.prompts.length : 0), 0),
        tips: pick('tip').filter((tip) => !(tip.release && tip.release > today)).length,
        trainings: pick('training').length,
        agents: pick('agent').length
      };
    };
    return { own: part(false), shared: part(true) };
  }

  const content = compose(activeId);
  TYPES.forEach((type) => {
    ns[GLOBALS[type]] = content[type];
  });

  // Teksten van deze discipline (de rest komt uit prototype/js/config.js)
  Object.assign(ns.config, {
    discipline: active.name,
    applicationSubtitle: active.subtitle,
    rules: active.rules,
    eyebrow: active.eyebrow,
    phaseText: active.phaseText
  });

  /** Vaste zinnen in de pagina's van de live cockpit die over de audit gaan, voor deze discipline. */
  const wording = active.label
    ? [
        ['van de audit', 'van ' + active.label],
        ['in de audit', 'in ' + active.label],
        ['fasen van de controle', 'fasen van je werk'],
        ['fase van de controle', 'fase van je werk']
      ].concat(active.wording || [])
    : [];

  ns.cockpit = {
    disciplines: DISCIPLINES,
    active,
    /** Hoort dit item bij de gedeelde basis? (type: 'usecase', 'prompt', 'tip', 'training' of 'agent') */
    isShared: fromBase,
    stats,
    wording,
    /** Adres van dezelfde pagina in een andere discipline. */
    href: (id, hash) => window.location.pathname + '?d=' + encodeURIComponent(id) + (hash || '#/')
  };
})(window.AIAudit);
