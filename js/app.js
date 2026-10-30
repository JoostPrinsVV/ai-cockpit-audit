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
  let contentReady = false; // er staat inhoud klaar (uit de cache, de database of de bestanden)
  let rendered = false; // er staat een pagina
  let routeSeq = 0; // nummer van de laatste routering (een oudere overgang toont niets meer)
  let loadRun = 0; // nummer van de laatste keer ophalen (een oudere uitkomst telt niet meer)
  let leaveApproved = false; // 'Verlaten zonder opslaan' is bevestigd
  let scrollPositions = {};
  let currentScrollKey = '';
  let pendingScroll = null; // plek die nog niet te halen was (de pagina was nog niet compleet)

  // Opzoeken in een tabel zonder wat elk object erft (#/constructor is geen pagina)
  const own = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);

  let ROUTES = null;
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

  /** Een deel van het adres als tekst; een kapotte %-code (bijv. uit een verminkte link) blijft zoals hij is. */
  function decodePart(part) {
    try {
      return decodeURIComponent(part);
    } catch (error) {
      return part;
    }
  }

  function parseHash() {
    const raw = window.location.hash.replace(/^#\/?/, '');
    // Ankers binnen een pagina (bijv. #idea-3) zijn geen route
    if (raw && !window.location.hash.startsWith('#/')) return null;
    const parts = raw.split('/').filter(Boolean).map(decodePart);
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

  /** Op een detailpagina (#/tip/…): de soort en het item, of null. */
  function pageSubject(parsed) {
    const kind = ns.kinds.byRoute(parsed.name);
    const item = kind ? ns.kinds.item(kind.type, parsed.params[0]) : null;
    return item ? { kind, item } : null;
  }

  /* ---- Bewerkbalk voor beheerders (op detailpagina's) ---------------------------------- */
  /** Het item op deze pagina, voor 'Bewerk deze tip' in de bewerkbalk (js/editor.js). */
  function pageItem(parsed) {
    if (!ns.central.signedIn() || ns.content.source === 'bestanden') return null;
    const subject = pageSubject(parsed);
    if (!subject) return null;
    let { item } = subject;
    let type = subject.kind.type;
    let label = subject.kind.subject.toLowerCase();
    // Een prompt uit een usecase pas je aan in die usecase
    if (type === 'prompt' && item.usecase) {
      item = item.usecase;
      type = 'usecase';
      label = 'de usecase van deze prompt';
    }
    // Een item uit de gedeelde basis pas je aan bij Beheer → Gedeelde basis
    return { type, id: item.id, label: label + (item.shared ? ' (gedeelde basis)' : ''), shared: item.shared, namespace: item.shared ? ns.cockpit.GENERAL_NAMESPACE : ns.cockpit.namespace(ns.cockpit.activeId()) };
  }

  /** Detailpagina van een gedeeld item: een regel uitleg onder de titel. */
  function sharedNote(parsed, node) {
    const subject = pageSubject(parsed);
    const note = subject ? ns.cockpit.sharedNote(subject.item, subject.kind.subject) : null;
    if (!note) return;
    // Onder de kop; staat de kop in een rij met de bladwijzer, dan onder die rij
    const heading = node.querySelector('h1');
    const anchor = heading ? heading.closest('.detail__title-row') || heading : null;
    if (anchor) anchor.insertAdjacentElement('afterend', note);
  }

  /**
   * Een geopende usecase, prompt, tip, training of agent: onthouden voor 'Recent bekeken' op de
   * startpagina (alleen in deze browser) en één keer tellen (anoniem; een prompt telt bij kopiëren).
   * Niet bij opnieuw opbouwen van dezelfde pagina.
   */
  function rememberViewed(parsed) {
    const subject = pageSubject(parsed);
    if (!subject || subject.item.locked) return;
    ns.ui.viewed.add(subject.kind.type, subject.item.id);
    if (subject.kind.track) ns.central.track(subject.kind.track, subject.item.id);
  }

  /* ---- Focus bij opnieuw opbouwen ------------------------------------------------------
     Nieuwe inhoud of een wijziging in de bewerkmodus bouwt de pagina opnieuw op. Wie met het
     toetsenbord werkt, blijft dan op hetzelfde element (zelfde soort, zelfde volgnummer). */
  const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"], [contenteditable="plaintext-only"]';

  function focusMark(view) {
    const active = document.activeElement;
    if (!active || active === view || !view.contains(active)) return null;
    return { index: Array.from(view.querySelectorAll(FOCUSABLE)).indexOf(active), tag: active.tagName };
  }

  function restoreFocus(view, mark) {
    if (!mark) return;
    const target = Array.from(view.querySelectorAll(FOCUSABLE))[mark.index];
    const next = target && target.tagName === mark.tag ? target : view.querySelector('h1');
    if (next) next.focus({ preventScroll: true });
  }

  /* ---- Scrollpositie ------------------------------------------------------------------
     Terug (of vooruit) in de browser brengt je naar de plek waar je op die pagina was.
     Elke stap in de geschiedenis krijgt een sleutel (history.state.scroll); bij vertrek
     onthouden we hoe ver die pagina gescrold was, in sessionStorage (ook na verversen). */
  const SCROLL_LIMIT = 60;
  const scrollStore = () => (baseConfig.storageNamespace || 'ai-snackbar-audit') + ':scroll';

  function loadScrollPositions() {
    try {
      scrollPositions = JSON.parse(window.sessionStorage.getItem(scrollStore()) || '{}') || {};
    } catch (error) {
      scrollPositions = {};
    }
  }

  function rememberScroll() {
    if (!currentScrollKey) return;
    delete scrollPositions[currentScrollKey]; // nieuwste achteraan: de oudste vallen eraf
    scrollPositions[currentScrollKey] = Math.round(window.scrollY);
    const keys = Object.keys(scrollPositions);
    keys.slice(0, Math.max(0, keys.length - SCROLL_LIMIT)).forEach((key) => delete scrollPositions[key]);
    try {
      window.sessionStorage.setItem(scrollStore(), JSON.stringify(scrollPositions));
    } catch (error) {
      // Geen opslag (privévenster): dan alleen zolang de pagina open is
    }
  }

  /** De sleutel van deze stap in de geschiedenis; een nieuwe stap krijgt er nu een. */
  function historyKey() {
    const state = window.history.state;
    if (state && state.scroll) return { key: state.scroll, known: true };
    const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    window.history.replaceState(Object.assign({}, state, { scroll: key }), '');
    return { key, known: false };
  }

  /* ---- Routeren ----------------------------------------------------------------------- */
  function route(options) {
    const opts = options || {};
    // Zolang er nog geen inhoud is, blijft 'Inhoud laden…' staan; daarna volgt deze pagina vanzelf
    if (!contentReady) return;
    let parsed = parseHash();
    if (!parsed) {
      // Een anker binnen de pagina (bijv. #idea-3): niets te doen. Opent de site op zo'n adres
      // (verversen, een gedeelde link), dan op de startpagina.
      if (rendered) return;
      window.history.replaceState(window.history.state, '', '#/');
      parsed = parseHash();
    }

    // Niet-opgeslagen wijzigingen in Beheer: het formulier blijft staan bij verversen,
    // en bij weggaan eerst terug naar het formulier en vragen
    const unsaved = Boolean(current && current.canLeave && !current.canLeave());
    if (unsaved && opts.keepScroll) return;
    if (unsaved && !leaveApproved && window.location.hash !== currentHash) {
      const target = window.location.hash;
      window.history.replaceState(currentScrollKey ? { scroll: currentScrollKey } : null, '', currentHash);
      ns.ui.confirmDialog('Je hebt wijzigingen die nog niet zijn opgeslagen.', { title: 'Pagina verlaten?', confirmLabel: 'Verlaten zonder opslaan', cancelLabel: 'Blijven', danger: true }).then((ok) => {
        if (!ok) return;
        leaveApproved = true;
        window.location.hash = target;
      });
      return;
    }
    leaveApproved = false;
    // Hoe ver de pagina die je verlaat gescrold was (voor als je straks terugkomt)
    if (!opts.keepScroll) rememberScroll();

    // Beheer: eerst de beheercode erbij laden (bezoekers hebben die nooit nodig)
    if (parsed.name === 'beheer' && !ns.views.admin) {
      openAdmin(opts);
      return;
    }

    const handler = own(ROUTES || (ROUTES = routes()), parsed.name);
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
    const seq = ++routeSeq;

    // Nieuwe pagina tonen, met een overgang (js/motion.js); niet bij verversen van dezelfde pagina
    const mode = opts.keepScroll ? 'refresh' : firstRoute ? 'first' : 'page';
    ns.motion.swap(() => {
      // Intussen al een nieuwere pagina (de overgang tekent een beeld later): deze niet meer tonen
      if (seq !== routeSeq) return;
      const viewNode = document.getElementById('view');
      const scrollY = window.scrollY;
      const focus = opts.keepScroll ? focusMark(viewNode) : null;
      sharedNote(parsed, result.node);
      if (!opts.keepScroll) rememberViewed(parsed);
      viewNode.replaceChildren(...[ns.cockpit.lockBar(), result.node].filter(Boolean));
      document.documentElement.dataset.gestart = 'ja'; // het vangnet in js/vroeg.js hoeft niet meer
      // Beheerders (de beheercode is dan geladen): de bewerkbalk en de bewerkmodus
      if (ns.editor) ns.editor.setPageItem(pageItem(parsed));
      if (ns.editmode) ns.editmode.decorate(parsed);
      document.body.dataset.view = parsed.name || 'home';
      // Tabbladtitel volgt de naam uit Beheer → Teksten (of js/config.js)
      const siteTitle = [config.applicationTitle, config.discipline].filter(Boolean).join(' ') || SITE_TITLE;
      document.title = result.title ? `${result.title} · ${siteTitle}` : siteTitle;

      // Menu: huidige pagina markeren ('page' op het overzicht zelf, 'true' op een pagina daarbinnen)
      const navKey = ns.kinds.navFor(parsed.name);
      const onOverview = navKey === parsed.name;
      document.querySelectorAll('[data-nav]').forEach((link) => {
        if (link.dataset.nav === navKey) link.setAttribute('aria-current', onOverview ? 'page' : 'true');
        else link.removeAttribute('aria-current');
      });
      ns.instruments.update(); // koersband: het pijltje naar deze pagina

      if (opts.keepScroll) {
        // Was de vorige plek nog niet te halen (eerst alleen 'Inhoud laden…')? Dan nu alsnog
        window.scrollTo(0, pendingScroll !== null ? pendingScroll : scrollY);
        pendingScroll = null;
        restoreFocus(viewNode, focus);
        return;
      }
      const entry = historyKey();
      currentScrollKey = entry.key;
      const saved = entry.known ? scrollPositions[entry.key] : undefined;
      const heading = viewNode.querySelector('h1');
      if (typeof saved === 'number') {
        // Terug (of vooruit, of ververst): naar de plek waar je was, de focus blijft op die pagina
        window.scrollTo(0, saved);
        pendingScroll = window.scrollY < saved - 1 ? saved : null;
        if (heading) heading.focus({ preventScroll: true });
      } else {
        // Nieuwe pagina: naar boven en focus op de kop (schermlezers horen de nieuwe pagina)
        pendingScroll = null;
        if (!firstRoute) window.scrollTo(0, 0);
        if (result.focus) result.focus();
        else if (!firstRoute && heading) heading.focus({ preventScroll: true });
      }
      firstRoute = false;
    }, parsed, mode);
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
    contentReady = true;
    applySettings();
    if (config.debugMode && ns.content.issues.length) ns.ui.toast(ns.content.issues.length + ' melding(en) over de inhoud: zie de console', { tone: 'warning' });
  }

  /** De bestanden in data/ tonen (eerst laden; lukt dat niet, dan liever een lege site dan eeuwig 'laden'). */
  async function useFiles() {
    try {
      await ns.content.ensureFiles();
    } catch (error) {
      console.error('[AI Cockpit Audit]', error);
    }
    useSource(null);
  }

  /* ---- Beheer: pas laden als het nodig is ----------------------------------------------------
     Bezoekers laden de beheercode niet (ruim een derde van alle JavaScript, plus css/admin.css).
     Wie ingelogd is of naar #/beheer gaat, krijgt hem erbij, met de bestanden in data/ (voor
     Overzetten en inrichten). De volgorde van de scripts is belangrijk. */
  const ADMIN_SCRIPTS = ['js/admin-kit.js', 'js/rights.js', 'js/editor.js', 'js/admin-content.js', 'js/admin-disciplines.js', 'js/admin-newsletter.js', 'js/admin-sheets.js', 'js/admin-chart.js', 'js/admin-copilot.js', 'js/admin-portfolio.js', 'js/admin-overview.js', 'js/view-admin.js', 'js/editmode.js'];
  let adminLoading = null;

  function loadAdmin() {
    if (!adminLoading) {
      adminLoading = Promise.all([ns.ui.loadScripts(ADMIN_SCRIPTS), ns.ui.loadStyle('css/admin.css'), ns.content.ensureFiles()])
        .then(() => ns.editor.init())
        .catch((error) => {
          adminLoading = null; // de volgende keer opnieuw proberen
          throw error;
        });
    }
    return adminLoading;
  }

  /** Naar #/beheer terwijl de beheercode er nog niet is: even laden, dan de pagina alsnog tonen. */
  function openAdmin(opts) {
    const hash = window.location.hash;
    const view = document.getElementById('view');
    if (current && current.destroy) current.destroy();
    current = null;
    view.replaceChildren(el('div', { className: 'page container' }, [el('p', { className: 'loading', text: 'Beheer laden…' })]));
    loadAdmin().then(() => {
      if (window.location.hash === hash) route(opts);
    }, (error) => {
      console.error('[AI Cockpit Audit]', error);
      view.replaceChildren(el('div', { className: 'page container' }, [el('div', { className: 'notice notice--warning' }, [icon('alert'), el('div', {}, [
        el('p', { className: 'notice__title', text: 'Beheer kon niet worden geladen' }),
        el('p', { text: 'Controleer je verbinding en ververs de pagina.' })
      ])])]));
    });
  }

  const signature = (rows) => rows.length + '|' + rows.reduce((max, row) => (row.updated_at > max ? row.updated_at : max), '');

  /**
   * Haalt de inhoud (opnieuw) op en toont hem. Bezoekers: gepubliceerde inhoud, met cache.
   * Beheerders: ook concepten, zonder cache. Geen database of niet bereikbaar: de bestanden.
   */
  let latestLoad = null;
  function loadContent(options) {
    latestLoad = fetchAndShow(options);
    return latestLoad;
  }

  async function fetchAndShow(options) {
    const opts = options || {};
    // Wordt er intussen opnieuw opgehaald (bijv. na opslaan), dan gaat die nieuwere keer voor
    const run = ++loadRun;
    const superseded = () => run !== loadRun;
    const asAdmin = Boolean(ns.central.signedIn());
    ns.cockpit.setAdmin(asAdmin && ns.central.isAdmin());
    // Deze cockpit: de eigen inhoud van de discipline plus de gedeelde basis
    const space = cockpitSpace();
    const cacheKey = 'inhoud:' + space.discipline;
    let shownSignature = '';

    // Meteen de database vragen; een beheerder krijgt tegelijk de beheercode erbij
    const fetching = ns.central.fetchContent({ admin: asAdmin, namespaces: [space.own, space.general] });
    const adminReady = asAdmin ? loadAdmin().then(() => true, () => false) : Promise.resolve(false);
    // Rijen → bron: voor beheerders met hun werkversies erin (js/editor.js), met de bestanden erbij
    // als de eigen inhoud nog niet in de database staat
    const compose = async (rows, drafts) => {
      if (ns.content.needsFiles(rows, space)) await ns.content.ensureFiles().catch(() => null);
      return ns.content.fromCockpitRows(drafts ? ns.editor.overlay(rows) : rows, space);
    };

    // 1. Snel: de laatst bekende versie uit deze browser (alleen voor bezoekers)
    if (!contentReady && !asAdmin) {
      const cached = storage.get(cacheKey, null);
      const source = cached && Array.isArray(cached.rows) ? await compose(cached.rows, false) : null;
      if (source && !contentReady && !superseded()) {
        useSource(source, 'cache');
        shownSignature = signature(cached.rows);
        route();
      }
    }

    // 2. Actueel: de database (met een maximale wachttijd voor de eerste weergave)
    const timer = new Promise((resolve) => window.setTimeout(() => resolve(null), FETCH_TIMEOUT));
    let result = await Promise.race([fetching, timer]);
    if (superseded()) return latestLoad;
    if (!result && !contentReady) {
      await useFiles();
      if (superseded()) return latestLoad;
      route();
    }
    if (!result) result = await fetching;
    const drafts = await adminReady;
    if (superseded()) return latestLoad;
    const failed = result.status === 'failed';

    // Voor Beheer → Inhoud: alle rijen, ook concepten en prullenbak. Mislukt alleen het
    // verversen (netwerk), dan blijven de rijen van de vorige keer staan.
    if (!(failed && asAdmin && Array.isArray(ns.content.adminRows))) {
      ns.content.adminRows = asAdmin && result.status === 'ok' ? result.rows : null;
      ns.content.adminStatus = result.status;
    }
    // Niet-opgeslagen werk van een vorige keer terug, vóór het samenstellen
    if (ns.editor) ns.editor.contentLoaded();

    if (result.status === 'ok') {
      // Lijst met disciplines bijwerken; deze cockpit (inmiddels) op slot: naar de standaard
      if (!ns.cockpit.updateRegistry(result.rows)) return 'op slot';
      const source = await compose(result.rows, drafts);
      if (superseded()) return latestLoad;
      const sig = signature(result.rows);
      // Alleen bewaren als er iets veranderd is (scheelt bij elk bezoek een grote schrijfactie)
      if (!asAdmin && (sig !== shownSignature || !source)) storage.set(cacheKey, source ? { rows: result.rows } : null);
      if (source) {
        if (!contentReady || opts.force || sig !== shownSignature || ns.content.source === 'bestanden') {
          const wasShown = contentReady;
          useSource(source, 'database');
          route({ keepScroll: wasShown });
        }
        return 'database';
      }
    }
    // Database (nog) niet ingericht of niet in gebruik: de bestanden. Mislukt alleen het
    // ophalen terwijl er al inhoud staat, dan blijft die staan (bijv. even geen netwerk).
    if (!contentReady || (!failed && (opts.force || ns.content.source !== 'bestanden'))) {
      const wasShown = contentReady;
      await useFiles();
      if (superseded()) return latestLoad;
      route({ keepScroll: wasShown });
    } else if (failed && opts.force && asAdmin) {
      ns.ui.toast('De inhoud kon niet opnieuw worden opgehaald. Controleer je verbinding en ververs de pagina.', { tone: 'warning', duration: 8000 });
    }
    return result.status === 'ok' ? 'bestanden' : result.status;
  }

  /** De naamruimtes van deze cockpit: de eigen inhoud van de discipline en de gedeelde basis. */
  function cockpitSpace() {
    const discipline = ns.cockpit.activeId();
    return { own: ns.cockpit.namespace(discipline), general: ns.cockpit.GENERAL_NAMESPACE, discipline };
  }

  /** Opnieuw samenstellen na een niet-opgeslagen wijziging (js/editor.js), zonder de database te vragen. */
  function recompose() {
    if (!Array.isArray(ns.content.adminRows)) return;
    const source = ns.content.fromCockpitRows(ns.editor.overlay(ns.content.adminRows), cockpitSpace());
    if (!source) return;
    useSource(source, 'database');
    route({ keepScroll: true });
  }

  /**
   * fn() uitvoeren met alleen de gepubliceerde inhoud, zoals collega's hem zien (bijv. voor de
   * nieuwsbrief); daarna staat de inhoud met de werkversies weer zoals hij stond.
   */
  function withPublished(fn) {
    if (!Array.isArray(ns.content.adminRows)) return fn();
    const space = cockpitSpace();
    const published = ns.content.fromCockpitRows(ns.content.adminRows.filter((row) => row.status === 'published'), space);
    if (!published) return fn();
    ns.content.load(published);
    try {
      return fn();
    } finally {
      ns.content.load(ns.content.fromCockpitRows(ns.editor.overlay(ns.content.adminRows), space) || undefined);
    }
  }

  /* ---- Thema (licht/donker), per collega onthouden ------------------------------------ */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('theme-button');
    if (!button) return;
    // Een schakelknop houdt één naam ('Donker thema'); aan of uit zegt aria-pressed (en het icoon)
    const dark = theme === 'donker';
    button.setAttribute('aria-pressed', String(dark));
    ns.ui.setIcon(button.querySelector('svg'), dark ? 'sun' : 'moon');
  }

  function initTheme() {
    const saved = storage.get('theme', '');
    applyTheme(saved === 'licht' || saved === 'donker' ? saved : baseConfig.theme === 'donker' ? 'donker' : 'licht');
    const button = document.getElementById('theme-button');
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'donker' ? 'licht' : 'donker';
      // Het nieuwe thema groeit als een cirkel vanuit de knop (js/motion.js)
      ns.motion.reveal(button, () => applyTheme(next));
      storage.set('theme', next);
    });
    // Afdrukken altijd in het lichte thema (lichte tekst zou op wit papier wegvallen); daarna terug
    let printedFrom = '';
    window.addEventListener('beforeprint', () => {
      printedFrom = document.documentElement.dataset.theme;
      if (printedFrom === 'donker') applyTheme('licht');
    });
    window.addEventListener('afterprint', () => {
      if (printedFrom === 'donker') applyTheme('donker');
      printedFrom = '';
    });
  }

  /* ---- Kop en voet ----------------------------------------------------------------- */
  function fillChrome() {
    document.getElementById('brand-title').textContent = config.applicationTitle;
    ns.cockpit.renderSwitcher();
    // De gouden regels uit Beheer → Teksten; de kop telt mee (geen regels: geen blok)
    const rules = config.rules || [];
    document.getElementById('footer-rules').replaceChildren(...rules.map((rule, index) =>
      el('li', { className: 'rules__item' }, [el('span', { className: 'rules__number', text: String(index + 1) }), el('span', { text: rule })])
    ));
    document.getElementById('rules-heading').textContent = rules.length <= 10
      ? `${ns.ui.countWord(rules.length)} gouden ${rules.length === 1 ? 'regel' : 'regels'}`
      : 'Gouden regels';
    document.getElementById('rules-section').hidden = !rules.length;
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
        storageNamespace: 'ai-snackbar-audit'
      }, ns.config || {});
      ns.ui.init({ config: baseConfig });
      ns.central.init({ config: baseConfig });
      // Welke discipline: bepaalt de naamruimte van de inhoud, inzendingen en tellers (central leest die per verzoek)
      baseConfig.namespace = ns.cockpit.init({ admin: Boolean(ns.central.signedIn()) && ns.central.isAdmin() });
      // Slot met pincode over de hele cockpit (de rest laadt eronder alvast door)
      ns.lock.init({ config: baseConfig, admin: Boolean(ns.central.signedIn()) && ns.central.isAdmin() });
      config = Object.assign({}, baseConfig);
      initTheme();
      fillChrome();
      ns.instruments.init();
      // Scrollen bij terug en vooruit doen we zelf (zie Scrollpositie)
      if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
      loadScrollPositions();
      window.addEventListener('pagehide', rememberScroll);
      window.addEventListener('hashchange', () => route());
      window.addEventListener('beforeunload', (event) => {
        if (current && current.canLeave && !current.canLeave()) {
          event.preventDefault();
          event.returnValue = '';
        }
      });
      // 'Direct naar de inhoud' zet de focus op de inhoud zonder het adres te veranderen
      // (#main is geen pagina: na verversen zou de site anders op 'laden' blijven staan)
      document.getElementById('skip-link').addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById('main').focus();
      });
      loadContent().catch((error) => {
        console.error('[AI Cockpit Audit] Inhoud laden mislukt', error);
        if (!contentReady) useFiles().then(() => route());
      });
      // Gepland publiceren: is het moment van een geplande wijziging voorbij, dan gaat die nu live
      ns.central.publishDue().then((count) => {
        if (count > 0) loadContent({ force: true }).catch(() => null);
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
    /** Opnieuw samenstellen met de werkversies erin (na een niet-opgeslagen wijziging). */
    recompose,
    withPublished,
    config: () => config
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.AIAudit);
