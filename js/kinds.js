/* ==========================================================================
   Soorten inhoud: één plek voor naam, adres, icoon en vindplaats
   --------------------------------------------------------------------------
   Alles wat de site, de bewerkmodus en Beheer over een soort moeten weten.
   Een nieuwe soort (zoals eerder de agents) begint hier.

     label    'Usecase'            één item, met hoofdletter
     one      'usecase'            één item, in een zin
     many     'usecases'           meer items, in een zin
     title    'Usecases'           kop in het menu, Beheer en rechten
     subject  'Deze usecase'       begin van een zin over dit item
     route    'usecase'            #/usecase/<id>
     list     'usecases'           #/usecases (het overzicht en het menu-item)
     map      'usecaseById'        waar het in js/content.js staat
     icon     'play-circle'
     textKey  'subtitle'           de korte tekst op de kaart (bewerkmodus)
     ordered  true                 volgorde zelf te kiezen (verslepen, pijltjes)
     track    'view_usecase'       teller 'bekeken' (js/central.js); een prompt telt bij kopiëren
     add      'Nieuwe usecase'
   Fasen en teksten hebben geen eigen pagina; die staan alleen in Beheer.
   ========================================================================== */
(function (ns) {
  'use strict';

  const PAGES = {
    usecase: { label: 'Usecase', one: 'usecase', many: 'usecases', title: 'Usecases', subject: 'Deze usecase', route: 'usecase', list: 'usecases', map: 'usecaseById', icon: 'play-circle', textKey: 'subtitle', ordered: true, track: 'view_usecase', add: 'Nieuwe usecase' },
    prompt: { label: 'Prompt', one: 'prompt', many: 'prompts', title: 'Prompts', subject: 'Deze prompt', route: 'prompt', list: 'prompts', map: 'promptById', icon: 'chat', textKey: 'description', ordered: true, track: '', add: 'Nieuwe prompt' },
    tip: { label: 'Tip', one: 'tip', many: 'tips', title: 'Tips', subject: 'Deze tip', route: 'tip', list: 'tips', map: 'tipById', icon: 'bulb', textKey: 'summary', ordered: true, track: 'view_tip', add: 'Nieuwe tip' },
    training: { label: 'Training', one: 'training', many: 'trainingen', title: 'Trainingen', subject: 'Deze training', route: 'training', list: 'trainingen', map: 'trainingById', icon: 'cap', textKey: 'subtitle', ordered: false, track: 'view_training', add: 'Nieuwe training' },
    agent: { label: 'Agent', one: 'agent', many: 'agents', title: 'Agents & tools', subject: 'Deze agent', route: 'agent', list: 'agents', map: 'agentById', icon: 'robot', textKey: 'summary', ordered: true, track: 'view_agent', add: 'Nieuwe agent' }
  };
  const ADMIN_ONLY = {
    phase: { label: 'Fase', one: 'fase', many: 'fasen', title: 'Fasen', ordered: true, add: 'Nieuwe fase' },
    setting: { label: 'Teksten', one: 'teksten', many: 'teksten', title: 'Teksten' }
  };
  const ALL = Object.assign({}, PAGES, ADMIN_ONLY);
  Object.keys(ALL).forEach((type) => { ALL[type].type = type; });

  const own = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);
  const byList = Object.fromEntries(Object.values(PAGES).map((kind) => [kind.list, kind]));

  ns.kinds = {
    /** De soorten met een eigen pagina, in de volgorde van het menu. */
    pages: Object.values(PAGES),
    /** Een soort (ook fase en teksten), of null. */
    get: (type) => own(ALL, type),
    /** De soort van een detailpagina (#/usecase/…), of null. */
    byRoute: (name) => own(PAGES, name),
    /** De soort van een overzicht (#/usecases), of null. */
    byList: (name) => own(byList, name),
    /** Het menu-item bij een adres: het overzicht zelf of de soort van een detailpagina ('ideeen' heeft geen soort). */
    navFor(name) {
      const kind = own(PAGES, name) || own(byList, name);
      return kind ? kind.list : name === 'ideeen' ? 'ideeen' : '';
    },
    /** Het item zelf (uit js/content.js), of null. */
    item(type, id) {
      const kind = own(PAGES, type);
      return kind && ns.content ? ns.content[kind.map].get(id) || null : null;
    },
    /** Adres van een item. */
    href: (type, id) => `#/${PAGES[type].route}/${id}`,
    /** 'Usecase', 'Fase', …; een onbekende soort zoals hij is. */
    label: (type) => (own(ALL, type) ? ALL[type].label : type)
  };
})(window.AIAudit);
