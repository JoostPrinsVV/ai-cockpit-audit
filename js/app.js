/* ==========================================================================
   Opstarten en navigatie
   --------------------------------------------------------------------------
   Adressen (deelbaar, ook als link in Teams of een mail):
     #/                      startpagina
     #/usecases              alle usecases          #/usecase/<id>   één usecase met demo
     #/prompts               promptdatabase         #/prompt/<id>    één prompt
     #/tips                  tips & tricks          #/tip/<id>       één tip
     #/trainingen            trainingen             #/training/<id>  één training met opname
     #/agents                agents & tools         #/agent/<id>     één agent of tool
     #/ideeen                ideeënhub              #/ideeen/vraag   met 'Vraag' alvast gekozen
     #/zoeken/<woorden>      zoeken
     #/beheer                beheer (inloggen)      #/beheer/inhoud  inhoud aanpassen
   Andere discipline: ?d=<id> vóór de #, bijv. ?d=accountancy#/prompts (zie js/disciplines.js).

   Inhoud: uit de database (als die is ingericht via Beheer → Inhoud), anders
   uit de bestanden in data/. Bezoekers krijgen eerst de laatst bekende versie
   uit hun browser (snel), daarna de actuele uit de database. Een cockpit is de
   gedeelde basis plus de eigen inhoud van de discipline.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage } = ns.ui;
  const SITE_TITLE = 'AI Cockpit Audit';
  const FETCH_TIMEOUT = 3500;
  let baseConfig = {};
  let config = {};
  let current = null;
  let currentHash = '';
  let firstRoute = true;
  let rendered = false;
  let leaveApproved = false; // 'Verlaten zonder opslaan' is bevestigd

  function routes() {
    const v = ns.views;
    return {
      '': () => v.home.render([], config),
      usecases: () => v.usecases.renderList(),
      usecase: (params) => v.usecases.renderDetail(params[0]),
      prompts: () => v.prompts.renderList(),
      prompt: (params) => v.prompts.renderDetail(params[0]),
      tips: () => v.tips.renderList(),
      tip: (params) => v.tips.renderDetail(params[0]),
      trainingen: () => v.trainings.renderList(),
      training: (params) => v.trainings.renderDetail(params[0]),
      agents: () => v.agents.renderList(),
      agent: (params) => v.agents.renderDetail(params[0]),
      ideeen: (params) => v.ideas.render(params, config),
      zoeken: (params) => v.search.render(params),
      beheer: (params) => v.admin.render(params)
    };
  }

  // Bij welk menu-item hoort een route?
  const NAV_FOR = { usecases: 'usecases', usecase: 'usecases', prompts: 'prompts', prompt: 'prompts', tips: 'tips', tip: 'tips', trainingen: 'trainingen', training: 'trainingen', agents: 'agents', agent: 'agents', ideeen: 'ideeen' };

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    // Ankers binnen een pagina (bijv. #idea-3) zijn geen route
    if (raw && !window.location.hash.startsWith('#/')) return null;
    const parts = raw.split('/').filter(Boolean);
    return { name: (parts[0] || '').toLowerCase(), params: parts.slice(1) };
  }

  function notFound() {
    return {
      node: el('div', { className: 'page container' }, [
        el('div', { className: 'empty empty--page' }, [
          el('span', { className: 'empty__icon', attrs: { 'aria-hidden': 'true' } }, [icon('search')]),
          el('h1', { className: 'empty__title', text: 'Deze pagina bestaat niet (meer)', attrs: { tabindex: '-1' } }),
          el('p', { className: 'empty__text', text: 'Misschien is de usecase, prompt of tip hernoemd. Zoek hem op, of ga terug naar de startpagina.' }),
          el('div', { className: 'empty__actions' }, [
            el('a', { className: 'btn btn--primary', attrs: { href: '#/' } }, [icon('arrow-left'), el('span', { text: 'Naar de startpagina' })]),
            el('a', { className: 'btn btn--secondary', attrs: { href: '#/zoeken' } }, [icon('search'), el('span', { text: 'Zoeken' })])
          ])
        ])
      ]),
      title: 'Niet gevonden'
    };
  }

  /* ---- Bewerkbalk voor beheerders (op detailpagina's) ---------------------------------- */
  const EDITABLE = {
    usecase: { type: 'usecase', map: 'usecaseById', label: 'deze usecase' },
    prompt: { type: 'prompt', map: 'promptById', label: 'deze prompt' },
    tip: { type: 'tip', map: 'tipById', label: 'deze tip' },
    training: { type: 'training', map: 'trainingById', label: 'deze training' },
    agent: { type: 'agent', map: 'agentById', label: 'deze agent' }
  };

  function editBar(parsed) {
    if (!ns.central.signedIn() || ns.content.source === 'bestanden') return null;
    const info = EDITABLE[parsed.name];
    if (!info) return null;
    let item = ns.content[info.map].get(parsed.params[0]);
    if (!item) return null;
    let type = info.type;
    let label = info.label;
    // Een prompt uit een usecase pas je aan in die usecase
    if (parsed.name === 'prompt' && item.usecase) {
      item = item.usecase;
      type = 'usecase';
      label = 'de usecase van deze prompt';
    }
    // Een item uit de gedeelde basis pas je aan bij Beheer → Gedeelde basis
    const area = item.shared ? 'basis' : 'inhoud';
    return el('div', { className: 'edit-bar' }, [
      el('div', { className: 'container edit-bar__inner' }, [
        el('span', { className: 'edit-bar__label' }, [icon('lock'), el('span', { text: 'Beheer' })]),
        item.draft ? el('span', { className: 'badge badge--draft' }, [icon('pencil-line'), 'Concept: alleen zichtbaar voor beheerders']) : null,
        el('a', { className: 'btn btn--primary btn--sm', attrs: { href: `#/beheer/${area}/${type}/${item.id}` } }, [icon('pencil-line'), el('span', { text: 'Bewerk ' + label + (item.shared ? ' (gedeelde basis)' : '') })])
      ])
    ]);
  }

  /** Detailpagina van een gedeeld item: een regel uitleg onder de titel. */
  const NOTE_WHAT = { usecase: 'Deze usecase', prompt: 'Deze prompt', tip: 'Deze tip', training: 'Deze training', agent: 'Deze agent' };
  function sharedNote(parsed, node) {
    const info = EDITABLE[parsed.name];
    const item = info ? ns.content[info.map].get(parsed.params[0]) : null;
    const note = item ? ns.cockpit.sharedNote(item, NOTE_WHAT[parsed.name]) : null;
    const heading = note ? node.querySelector('h1') : null;
    if (heading) heading.insertAdjacentElement('afterend', note);
  }

  /* ---- Routeren ----------------------------------------------------------------------- */
  function route(options) {
    const opts = options || {};
    const parsed = parseHash();
    if (!parsed) return;

    // Niet-opgeslagen wijzigingen in Beheer: eerst terug naar het formulier en vragen
    if (!opts.keepScroll && !leaveApproved && current && current.canLeave && window.location.hash !== currentHash && !current.canLeave()) {
      const target = window.location.hash;
      window.history.replaceState(null, '', currentHash);
      ns.ui.confirmDialog('Je hebt wijzigingen die nog niet zijn opgeslagen.', { title: 'Pagina verlaten?', confirmLabel: 'Verlaten zonder opslaan', cancelLabel: 'Blijven', danger: true }).then((ok) => {
        if (!ok) return;
        leaveApproved = true;
        window.location.hash = target;
      });
      return;
    }
    leaveApproved = false;

    const handler = routes()[parsed.name];
    let result = null;
    try {
      result = handler ? handler(parsed.params) : null;
    } catch (error) {
      console.error('[AI Cockpit Audit]', error);
      showFatal(error);
      return;
    }
    if (!result) result = notFound();

    if (current && current.destroy) current.destroy();
    current = result;
    currentHash = window.location.hash || '#/';
    rendered = true;

    const viewNode = document.getElementById('view');
    const scrollY = window.scrollY;
    sharedNote(parsed, result.node);
    viewNode.replaceChildren(...[ns.cockpit.lockBar(), editBar(parsed), result.node].filter(Boolean));
    document.body.dataset.view = parsed.name || 'home';
    // Tabbladtitel volgt de naam uit Beheer → Teksten (of js/config.js)
    const siteTitle = [config.applicationTitle, config.discipline].filter(Boolean).join(' ') || SITE_TITLE;
    document.title = result.title ? `${result.title} · ${siteTitle}` : siteTitle;

    // Menu: huidige pagina markeren
    const navKey = NAV_FOR[parsed.name] || '';
    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === navKey) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (opts.keepScroll) {
      window.scrollTo(0, scrollY);
      return;
    }
    // Naar boven en focus op de kop (schermlezers horen de nieuwe pagina)
    if (!firstRoute) window.scrollTo(0, 0);
    if (result.focus) result.focus();
    else if (!firstRoute) {
      const heading = viewNode.querySelector('h1');
      if (heading) heading.focus({ preventScroll: true });
    }
    firstRoute = false;
  }

  /* ---- Inhoud laden ------------------------------------------------------------------- */
  /** Teksten uit Beheer (Inhoud → Teksten) gaan voor die in js/config.js. */
  function applySettings() {
    const settings = ns.content.settings || {};
    config = Object.assign({}, baseConfig);
    ns.content.SETTING_KEYS.forEach((name) => {
      const value = settings[name];
      if (Array.isArray(value) ? value.length : typeof value === 'string' && value.trim()) config[name] = value;
    });
    // De naam komt uit Beheer → Disciplines. De uitleg in js/config.js gaat over de audit:
    // een andere discipline zonder eigen uitleg krijgt een algemene.
    const discipline = ns.cockpit.active();
    config.discipline = discipline.name;
    if (!(settings.applicationSubtitle || '').trim() && discipline.id !== ns.cockpit.FILES_ID) {
      config.applicationSubtitle = `Usecases, prompts, tips, trainingen en agents: alles over Copilot in ${discipline.label} op één plek.`;
    }
    if (ns.content.source !== 'bestanden' && ns.content.updatedAt) {
      config.lastUpdated = new Date(ns.content.updatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    fillChrome();
  }

  function useSource(source, kind) {
    ns.content.load(source || undefined);
    ns.content.source = source ? kind : 'bestanden';
    applySettings();
    if (config.debugMode && ns.content.issues.length) ns.ui.toast(ns.content.issues.length + ' melding(en) over de inhoud: zie de console', { tone: 'warning' });
  }

  const signature = (rows) => rows.length + '|' + rows.reduce((max, row) => (row.updated_at > max ? row.updated_at : max), '');

  /**
   * Haalt de inhoud (opnieuw) op en toont hem. Bezoekers: gepubliceerde inhoud, met cache.
   * Beheerders: ook concepten, zonder cache. Geen database of niet bereikbaar: de bestanden.
   */
  async function loadContent(options) {
    const opts = options || {};
    const asAdmin = Boolean(ns.central.signedIn());
    ns.cockpit.setAdmin(asAdmin && ns.central.isAdmin());
    // Deze cockpit: de eigen inhoud van de discipline plus de gedeelde basis
    const discipline = ns.cockpit.activeId();
    const space = { own: ns.cockpit.namespace(discipline), general: ns.cockpit.GENERAL_NAMESPACE, discipline };
    const compose = (rows) => ns.content.fromCockpitRows(rows, space);
    const cacheKey = 'inhoud:' + discipline;
    let shownSignature = '';

    // 1. Snel: de laatst bekende versie uit deze browser (alleen voor bezoekers)
    if (!rendered && !asAdmin) {
      const cached = storage.get(cacheKey, null);
      const source = cached && Array.isArray(cached.rows) ? compose(cached.rows) : null;
      if (source) {
        useSource(source, 'cache');
        shownSignature = signature(cached.rows);
        route();
      }
    }
    if (!rendered) {
      document.getElementById('view').replaceChildren(el('div', { className: 'page container' }, [el('p', { className: 'loading', text: 'Inhoud laden…' })]));
    }

    // 2. Actueel: de database (met een maximale wachttijd voor de eerste weergave)
    const fetching = ns.central.fetchContent({ admin: asAdmin, namespaces: [space.own, space.general] });
    const timer = new Promise((resolve) => window.setTimeout(() => resolve(null), FETCH_TIMEOUT));
    let result = await Promise.race([fetching, timer]);
    if (!result && !rendered) {
      useSource(null);
      route();
    }
    if (!result) result = await fetching;

    // Voor Beheer → Inhoud: alle rijen, ook concepten en prullenbak
    ns.content.adminRows = asAdmin && result.status === 'ok' ? result.rows : null;
    ns.content.adminStatus = result.status;

    if (result.status === 'ok') {
      // Lijst met disciplines bijwerken; deze cockpit (inmiddels) op slot: naar de standaard
      if (!ns.cockpit.updateRegistry(result.rows)) return 'op slot';
      const source = compose(result.rows);
      if (!asAdmin) storage.set(cacheKey, source ? { at: Date.now(), rows: result.rows } : null);
      if (source) {
        if (!rendered || opts.force || signature(result.rows) !== shownSignature || ns.content.source === 'bestanden') {
          const wasRendered = rendered;
          useSource(source, 'database');
          route({ keepScroll: wasRendered });
        }
        return 'database';
      }
    }
    // Database (nog) niet leidend of niet bereikbaar: de bestanden
    if (!rendered || opts.force || (result.status === 'ok' && ns.content.source !== 'bestanden')) {
      const wasRendered = rendered;
      useSource(null);
      route({ keepScroll: wasRendered });
    }
    return result.status === 'ok' ? 'bestanden' : result.status;
  }

  /* ---- Thema (licht/donker), per collega onthouden ------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('theme-button');
    if (!button) return;
    const dark = theme === 'donker';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Licht thema' : 'Donker thema');
    button.title = dark ? 'Licht thema' : 'Donker thema';
    ns.ui.setIcon(button.querySelector('svg'), dark ? 'sun' : 'moon');
  }

  function initTheme() {
    const saved = storage.get('theme', '');
    applyTheme(saved === 'licht' || saved === 'donker' ? saved : baseConfig.theme === 'donker' ? 'donker' : 'licht');
    document.getElementById('theme-button').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'donker' ? 'licht' : 'donker';
      applyTheme(next);
      storage.set('theme', next);
    });
  }

  /* ---- Kop en voet ----------------------------------------------------------------- */
  function fillChrome() {
    document.getElementById('brand-title').textContent = config.applicationTitle;
    ns.cockpit.renderSwitcher();
    document.getElementById('footer-rules').replaceChildren(...(config.rules || []).map((rule, index) =>
      el('li', { className: 'rules__item' }, [el('span', { className: 'rules__number', text: String(index + 1) }), el('span', { text: rule })])
    ));
    document.getElementById('footer-updated').textContent = config.lastUpdated ? 'Laatst bijgewerkt: ' + config.lastUpdated : '';
    document.getElementById('footer-org').textContent = `${config.organizationName} · Alle demo's werken met fictieve gegevens. Copilot ondersteunt; het professionele oordeel blijft bij jou.`;
  }

  function showFatal(error) {
    const fatal = document.getElementById('fatal');
    if (!fatal) return;
    document.getElementById('fatal-detail').textContent = error && error.message ? error.message : '';
    fatal.hidden = false;
  }

  function boot() {
    try {
      baseConfig = Object.assign({
        applicationTitle: 'AI Cockpit',
        discipline: 'Audit',
        organizationName: 'Visser & Visser',
        theme: 'licht',
        namespace: 'ai-audit',
        storageNamespace: 'ai-snackbar-audit'
      }, ns.config || {});
      ns.ui.init({ config: baseConfig });
      ns.central.init({ config: baseConfig });
      // Welke discipline (zet ook de naamruimte voor inzendingen en tellers)
      ns.cockpit.init({ config: baseConfig, admin: Boolean(ns.central.signedIn()) && ns.central.isAdmin() });
      config = Object.assign({}, baseConfig);
      storage.remove('inhoud'); // bewaarplek van vóór de disciplines
      initTheme();
      fillChrome();
      window.addEventListener('hashchange', () => route());
      window.addEventListener('beforeunload', (event) => {
        if (current && current.canLeave && !current.canLeave()) {
          event.preventDefault();
          event.returnValue = '';
        }
      });
      document.documentElement.classList.remove('no-js');
      loadContent().catch((error) => {
        console.error('[AI Cockpit Audit] Inhoud laden mislukt', error);
        if (!rendered) {
          useSource(null);
          route();
        }
      });
    } catch (error) {
      console.error('[AI Cockpit Audit] Opstarten mislukt', error);
      showFatal(error);
    }
  }

  ns.app = {
    /** Na opslaan in Beheer: inhoud opnieuw ophalen en de huidige pagina vernieuwen. */
    reloadContent: () => loadContent({ force: true }),
    /** Huidige pagina opnieuw opbouwen (zelfde scrollpositie). */
    refresh: () => route({ keepScroll: true }),
    config: () => config
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.AIAudit);
