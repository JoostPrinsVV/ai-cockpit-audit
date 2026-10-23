/* ==========================================================================
   Disciplines: per discipline een eigen cockpit, op één gedeelde basis
   --------------------------------------------------------------------------
   - Welke disciplines er zijn en welke open zijn: Beheer → Disciplines (in de
     database, naamruimte 'ai-algemeen'), anders data/disciplines.js.
   - Welke discipline je ziet: ?d=<id> in het adres, anders de laatst gekozen,
     anders de eerste open discipline. Een discipline op slot kunnen alleen
     beheerders openen; zij zien bovenaan een balk 'Op slot'.
   - De inhoud van een cockpit = de gedeelde basis ('ai-algemeen') plus de
     eigen inhoud ('ai-<id>'), zie js/content.js. Inzendingen en tellers gaan
     naar de discipline waarin je zit.
   - De wisselaar achter 'AI Cockpit' in de kopbalk, en de indeling van de
     kopbalk: iconen en lange labels vallen pas weg als het echt niet past.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass, storage, ACCENTS } = ns.ui;
  const PREFIX = 'ai-';
  const GENERAL = 'algemeen';
  const REGISTRY_ID = 'disciplines';
  const FILES_ID = 'audit'; // de discipline waarvan de eigen inhoud in data/ staat
  const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

  const text = (value) => (typeof value === 'string' ? value.trim() : '');

  /** Lijst uit data/disciplines.js of de database → nette lijst (null als er niets bruikbaars in staat). */
  function normalize(list) {
    if (!Array.isArray(list)) return null;
    const seen = new Set();
    const result = list.map((item) => {
      const id = text(item && item.id);
      if (!ID_PATTERN.test(id) || id === GENERAL || seen.has(id)) return null;
      seen.add(id);
      const name = text(item.name) || id;
      return {
        id,
        name,
        description: text(item.description),
        status: item.status === 'open' ? 'open' : 'locked',
        icon: text(item.icon) || 'grid',
        accent: ACCENTS.includes(item.accent) ? item.accent : 'navy',
        eyebrow: text(item.eyebrow) || 'Copilot bij ' + name,
        label: text(item.label) || name.toLowerCase(),
        phases: text(item.phases) || 'je werk'
      };
    }).filter(Boolean);
    return result.length ? result : null;
  }

  let registry = normalize(ns.disciplines) || normalize([{ id: FILES_ID, name: 'Audit', status: 'open' }]);
  let activeId = FILES_ID;
  let admin = false;

  const find = (id) => registry.find((discipline) => discipline.id === id) || null;
  const openOnes = () => registry.filter((discipline) => discipline.status === 'open');
  const defaultId = () => (openOnes()[0] || registry[0]).id;
  const namespace = (id) => PREFIX + (id || activeId);
  // Op slot: alleen beheerders. Staat (per ongeluk) alles op slot, dan blijft de eerste open.
  const allowed = (id) => {
    const discipline = find(id);
    return Boolean(discipline && (discipline.status === 'open' || admin || (!openOnes().length && id === defaultId())));
  };

  function active() {
    return find(activeId) || normalize([{ id: activeId, name: activeId }])[0];
  }

  /** Adres van een pagina in een (andere) cockpit. */
  function href(id, hash) {
    return window.location.pathname + '?d=' + encodeURIComponent(id) + (hash || '#/');
  }

  /* ---- Opstarten ----------------------------------------------------------------- */
  /**
   * Kiest de discipline vóór het ophalen van de inhoud (lijst: laatst bekende uit de database,
   * anders de bestanden). Geeft de naamruimte van die discipline.
   */
  function init(options) {
    admin = Boolean(options.admin);
    const cached = storage.get('disciplines', null);
    registry = (cached && normalize(cached.list)) || registry;
    const requested = text(new URLSearchParams(window.location.search).get('d'));
    activeId = [requested, storage.get('discipline', '')].find(allowed) || defaultId();
    if (requested && requested === activeId) storage.set('discipline', activeId);
    if (requested && requested !== activeId) {
      // Op slot of onbekend: het adres laat zien waar je wél bent
      window.history.replaceState(window.history.state, '', href(activeId, window.location.hash));
      if (find(requested)) window.setTimeout(() => ns.ui.toast(`${find(requested).name} staat nog op slot. Je bent in de cockpit van ${active().name}.`, { duration: 6000 }), 800);
    }
    setupSwitcher();
    setupFit();
    return namespace(activeId);
  }

  /** Na inloggen of uitloggen (zonder de pagina te herladen). */
  function setAdmin(value) {
    if (admin === Boolean(value)) return;
    admin = Boolean(value);
    renderSwitcher();
  }

  /**
   * Na het ophalen: de lijst uit de database (als die er is). Geeft false als je deze
   * cockpit niet (meer) mag zien; dan ga je naar de standaard.
   */
  function updateRegistry(rows) {
    const row = (rows || []).find((r) => r.namespace === namespace(GENERAL) && r.type === 'setting' && r.id === REGISTRY_ID && r.status === 'published');
    const list = row && row.data ? normalize(row.data.list) : null;
    if (list) {
      registry = list;
      storage.set('disciplines', { list: row.data.list });
    } else {
      registry = normalize(ns.disciplines) || registry;
      storage.remove('disciplines');
    }
    if (!allowed(activeId)) {
      window.location.replace(href(defaultId(), '#/'));
      return false;
    }
    renderSwitcher();
    return true;
  }

  /* ---- Gedeeld en op slot ----------------------------------------------------------- */
  /** Label 'Voor iedereen' tonen: zodra er meer dan één cockpit open is, en altijd voor beheerders. */
  const showShared = () => admin || openOnes().length > 1;

  function sharedBadge(item) {
    if (!item || !item.shared || !showShared()) return null;
    return el('span', { className: 'badge badge--shared', attrs: { title: 'Gedeelde basis: staat in de cockpit van iedere discipline' } }, [icon('globe'), 'Voor iedereen']);
  }

  /** Regel uitleg op de detailpagina van een gedeeld item. */
  function sharedNote(item, what) {
    if (!item || !item.shared || item.locked || !showShared()) return null;
    return el('p', { className: 'shared-note' }, [icon('globe'), el('span', { text: `${what} hoort bij de gedeelde basis en staat in de cockpit van iedere discipline.` })]);
  }

  /** Balk bovenaan als een beheerder een discipline op slot bekijkt. */
  function lockBar() {
    if (active().status === 'open') return null;
    return el('div', { className: 'edit-bar edit-bar--lock' }, [
      el('div', { className: 'container edit-bar__inner' }, [
        el('span', { className: 'edit-bar__label' }, [icon('lock'), el('span', { text: 'Op slot' })]),
        el('span', { className: 'edit-bar__text', text: `${active().name} staat op slot: alleen beheerders zien deze cockpit.` }),
        el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/beheer/disciplines' } }, [icon('settings'), el('span', { text: 'Openzetten in Beheer' })])
      ])
    ]);
  }

  /* ---- Wisselaar in de kopbalk -------------------------------------------------------- */
  /** Waar je in een andere cockpit uitkomt: dezelfde pagina; een detailpagina alleen als het item gedeeld is. */
  function targetHash() {
    const hash = window.location.hash && window.location.hash.startsWith('#/') ? window.location.hash : '#/';
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const kind = ns.kinds.byRoute((parts[0] || '').toLowerCase());
    if (!kind) return hash;
    const item = ns.kinds.item(kind.type, parts[1]);
    return item && item.shared ? hash : '#/' + kind.list;
  }

  let switcher = null;
  let button = null;
  let panel = null;
  let fittedName = null; // de naam waarvoor de kopbalk passend is gemaakt

  function item(discipline) {
    const current = discipline.id === activeId;
    const locked = discipline.status !== 'open';
    const state = current
      ? el('span', { className: 'switcher__state switcher__state--current' }, [icon('check'), el('span', { className: 'sr-only', text: '(huidige)' })])
      : locked ? el('span', { className: 'switcher__state' }, [icon('lock'), el('span', { text: admin ? 'Op slot · beheer' : 'Op slot' })]) : null;
    const children = [
      el('span', { className: 'switcher__icon ' + accentClass(discipline.accent), attrs: { 'aria-hidden': 'true' } }, [icon(discipline.icon)]),
      el('span', { className: 'switcher__body' }, [
        el('span', { className: 'switcher__name', text: discipline.name }),
        discipline.description ? el('span', { className: 'sr-only', text: ', ' }) : null,
        discipline.description ? el('span', { className: 'switcher__desc', text: discipline.description }) : null
      ]),
      state
    ];
    if (locked && !admin && !current) {
      return el('li', {}, [el('span', { className: 'switcher__item is-locked', attrs: { 'aria-disabled': 'true' } }, children)]);
    }
    const link = el('a', {
      className: 'switcher__item' + (current ? ' is-current' : '') + (locked ? ' is-locked' : ''),
      attrs: { href: href(discipline.id, targetHash()), 'aria-current': current ? 'true' : null }
    }, children);
    if (current) link.addEventListener('click', (event) => {
      event.preventDefault();
      close(true);
    });
    return el('li', {}, [link]);
  }

  function build() {
    const several = openOnes().length > 1;
    panel.replaceChildren(
      el('p', { className: 'switcher__title', text: 'Kies een discipline' }),
      el('ul', { className: 'switcher__list', attrs: { role: 'list' } }, registry.map(item)),
      el('p', { className: 'switcher__foot' }, [
        icon(several ? 'globe' : 'info'),
        el('span', {}, [
          several ? 'Tips, agents en trainingen voor iedereen zie je in elke cockpit.' : 'De andere disciplines volgen. Tot die tijd staan ze op slot.',
          admin ? ' ' : null,
          admin ? el('a', { attrs: { href: '#/beheer/disciplines' }, text: 'Disciplines beheren' }) : null
        ])
      ])
    );
  }

  /** Naam en lijst bijwerken (na het ophalen, inloggen of uitloggen). */
  function renderSwitcher() {
    if (!button) return;
    const name = active().name;
    const label = button.querySelector('#brand-discipline');
    if (label) label.textContent = name;
    button.setAttribute('aria-label', `Discipline: ${name}. Wissel van discipline`);
    if (!panel.hidden) build();
    // Passend maken meet de kopbalk (dat dwingt de browser tot rekenen): alleen als de naam anders
    // is; een andere breedte of een geladen lettertype regelt setupFit
    if (name !== fittedName) {
      fittedName = name;
      fit();
    }
  }

  function open() {
    build();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    switcher.classList.add('is-open');
    const first = panel.querySelector('.switcher__item.is-current') || panel.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  }

  function close(returnFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    switcher.classList.remove('is-open');
    if (returnFocus) button.focus({ preventScroll: true });
  }

  function setupSwitcher() {
    switcher = document.getElementById('switcher');
    button = document.getElementById('switcher-button');
    panel = document.getElementById('switcher-panel');
    if (!switcher || !button || !panel) return;
    button.addEventListener('click', () => (panel.hidden ? open() : close(false)));
    panel.addEventListener('click', (event) => {
      if (event.target.closest('a[href^="#/"]')) close(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) close(true);
    });
    document.addEventListener('click', (event) => {
      if (!panel.hidden && !switcher.contains(event.target)) close(false);
    });
    switcher.addEventListener('focusout', (event) => {
      if (!panel.hidden && event.relatedTarget && !switcher.contains(event.relatedTarget)) close(false);
    });
    window.addEventListener('hashchange', () => close(false));
    renderSwitcher();
  }

  /* ---- Kopbalk passend maken ---------------------------------------------------------------
     Desktop (data-fit): 0 alles ruim (iconen en volledige labels) · 1 zonder iconen · 2 ook korte
     labels ('Tips', 'Agents') · 3 het menu onder de naam. Telefoon (data-squeeze): de naamregel
     eerst zonder vliegtuigje, dan iets kleiner. Zo past ook een lange naam als 'Accountancy',
     en blijft er tussen alles ruimte (de tussenruimtes in de opmaak). Zonder JavaScript gelden
     de vaste breekpunten uit css/audit.css. */
  function fit() {
    const topbar = document.getElementById('topbar');
    if (!topbar) return;
    const nav = topbar.querySelector('.nav');
    const list = topbar.querySelector('.nav__list');
    const brand = topbar.querySelector('.brand-group');
    const actions = topbar.querySelector('.topbar__actions');
    if (!nav || !list || !brand || !actions) return;
    if (window.matchMedia('(max-width: 600px)').matches) {
      delete topbar.dataset.fit;
      for (let level = 0; level <= 2; level++) {
        topbar.dataset.squeeze = String(level);
        if (actions.offsetTop <= brand.offsetTop + 4) break;
      }
      return;
    }
    delete topbar.dataset.squeeze;
    for (let level = 0; level <= 3; level++) {
      topbar.dataset.fit = String(level);
      if (level === 3 || list.scrollWidth <= nav.clientWidth) break;
    }
  }

  function setupFit() {
    // Met een korte vertraging (niet per beeldje): werkt ook als het tabblad op de achtergrond staat
    let timer = 0;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 60);
    };
    window.addEventListener('resize', later);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    // Ook als alleen de breedte van de kopbalk verandert (zoomen, schuifbalk, lettertype)
    const topbar = document.getElementById('topbar');
    if (topbar && 'ResizeObserver' in window) {
      let width = 0;
      new window.ResizeObserver((entries) => {
        const next = Math.round(entries[0].contentRect.width);
        if (next === width) return;
        width = next;
        later();
      }).observe(topbar);
    }
    later();
  }

  ns.cockpit = {
    FILES_ID,
    GENERAL_NAMESPACE: PREFIX + GENERAL,
    REGISTRY_ID,
    ID_PATTERN,
    init,
    setAdmin,
    updateRegistry,
    activeId: () => activeId,
    active,
    find,
    registry: () => registry.slice(),
    namespace,
    href,
    sharedBadge,
    sharedNote,
    lockBar,
    renderSwitcher
  };
})(window.AIAudit);
