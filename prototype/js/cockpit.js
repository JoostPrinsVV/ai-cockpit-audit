/* ==========================================================================
   AI COCKPIT · PROTOTYPE — WISSELAAR EN GEDEELDE BASIS (weergave)
   --------------------------------------------------------------------------
   - De disciplinewisselaar achter 'AI Cockpit' in de kopbalk. Je komt in
     dezelfde pagina van de andere cockpit; een detailpagina alleen als het
     item gedeeld is (anders het overzicht).
   - Het label 'Voor iedereen' op kaarten van de gedeelde basis, en een
     regel uitleg op de detailpagina van een gedeeld item.
   - Vaste zinnen over de audit in de pagina's van de live cockpit, in de
     woorden van de gekozen discipline (zie wording in disciplines.js).
   Draait na js/ui.js en js/content.js en vóór prototype/js/app.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass } = ns.ui;
  const cockpit = ns.cockpit;
  const active = cockpit.active;

  /* ---- Gedeeld of eigen ------------------------------------------------------------- */
  function markShared(state) {
    state.usecases.forEach((usecase) => { usecase.shared = cockpit.isShared('usecase', usecase.id); });
    state.prompts.forEach((prompt) => { prompt.shared = prompt.usecase ? prompt.usecase.shared : cockpit.isShared('prompt', prompt.id); });
    state.tips.forEach((tip) => { tip.shared = cockpit.isShared('tip', tip.id); });
    state.trainings.forEach((training) => { training.shared = cockpit.isShared('training', training.id); });
    state.agents.forEach((agent) => { agent.shared = cockpit.isShared('agent', agent.id); });
  }

  const load = ns.content.load;
  ns.content.load = function (source) {
    const state = load(source);
    markShared(state);
    return state;
  };

  function sharedBadge() {
    return el('span', { className: 'badge badge--shared', attrs: { title: 'Gedeelde basis: staat in de cockpit van iedere discipline' } }, [icon('globe'), 'Voor iedereen']);
  }

  // Ieder kaartje vraagt al om een conceptlabel: daar komt 'Voor iedereen' bij
  const draftBadge = ns.ui.draftBadge;
  ns.ui.draftBadge = function (item) {
    const draft = draftBadge(item);
    if (!item || !item.shared) return draft;
    if (!draft) return sharedBadge();
    const both = document.createDocumentFragment();
    both.append(draft, sharedBadge());
    return both;
  };

  /* ---- Detailpagina's en woordkeus ---------------------------------------------------- */
  const DETAIL = {
    usecase: { map: 'usecaseById', list: '#/usecases', what: 'Deze usecase' },
    prompt: { map: 'promptById', list: '#/prompts', what: 'Deze prompt' },
    tip: { map: 'tipById', list: '#/tips', what: 'Deze tip' },
    training: { map: 'trainingById', list: '#/trainingen', what: 'Deze training' },
    agent: { map: 'agentById', list: '#/agents', what: 'Deze agent' }
  };

  function currentRoute() {
    const parts = (window.location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: (parts[0] || '').toLowerCase(), id: parts[1] || '' };
  }

  function currentItem() {
    const route = currentRoute();
    const info = DETAIL[route.name];
    return info ? { info, item: ns.content[info.map].get(route.id) || null } : null;
  }

  function hasOverride(type, id) {
    const own = (ns.disciplineData || {})[active.id];
    return Boolean(own && own.overrides && own.overrides[type] && own.overrides[type][id]);
  }

  function sharedNote(node) {
    const found = currentItem();
    if (!found || !found.item || !found.item.shared || found.item.locked) return;
    const heading = node.querySelector('h1');
    if (!heading) return;
    const type = currentRoute().name;
    const own = hasOverride(type, found.item.id) ? ` In ${active.name} met een eigen voorbeeld.` : '';
    heading.insertAdjacentElement('afterend', el('p', { className: 'shared-note' }, [
      icon('globe'),
      el('span', { text: `${found.info.what} hoort bij de gedeelde basis en staat in de cockpit van iedere discipline.${own}` })
    ]));
  }

  function adaptWording(node) {
    if (!cockpit.wording.length) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      let value = text.nodeValue;
      cockpit.wording.forEach(([from, to]) => {
        if (value.includes(from)) value = value.split(from).join(to);
      });
      if (value !== text.nodeValue) text.nodeValue = value;
    }
  }

  /** Na het opbouwen van iedere pagina (prototype/js/app.js). */
  cockpit.decorate = function (node) {
    if (!node) return;
    adaptWording(node);
    sharedNote(node);
  };

  /* ---- Wisselaar ----------------------------------------------------------------------- */
  const switcher = document.getElementById('switcher');
  const button = document.getElementById('switcher-button');
  const panel = document.getElementById('switcher-panel');

  /** Waar je in een andere cockpit uitkomt: dezelfde pagina, of het overzicht als het item daar niet is. */
  function targetHash() {
    const hash = window.location.hash && window.location.hash.startsWith('#/') ? window.location.hash : '#/';
    const found = currentItem();
    if (!found) return hash;
    return found.item && found.item.shared ? hash : found.info.list;
  }

  const STATUS = { voorbeeld: 'Voorbeeld', gepland: 'In voorbereiding' };

  function item(discipline) {
    const current = discipline.id === active.id;
    const planned = discipline.status === 'gepland';
    const children = [
      el('span', { className: 'switcher__icon ' + accentClass(discipline.accent), attrs: { 'aria-hidden': 'true' } }, [icon(discipline.icon || 'grid')]),
      el('span', { className: 'switcher__body' }, [
        el('span', { className: 'switcher__name', text: discipline.name }),
        el('span', { className: 'sr-only', text: ', ' }),
        el('span', { className: 'switcher__desc', text: discipline.description })
      ]),
      current
        ? el('span', { className: 'switcher__state switcher__state--current' }, [icon('check'), el('span', { className: 'sr-only', text: '(huidige)' })])
        : STATUS[discipline.status] ? el('span', { className: 'switcher__state', text: STATUS[discipline.status] }) : null
    ];
    if (planned) {
      return el('li', {}, [el('span', { className: 'switcher__item is-planned', attrs: { 'aria-disabled': 'true' } }, children)]);
    }
    const link = el('a', {
      className: 'switcher__item' + (current ? ' is-current' : ''),
      attrs: { href: cockpit.href(discipline.id, targetHash()), 'aria-current': current ? 'true' : null }
    }, children);
    if (current) link.addEventListener('click', (event) => { event.preventDefault(); close(true); });
    return el('li', {}, [link]);
  }

  function build() {
    panel.replaceChildren(
      el('p', { className: 'switcher__title', text: 'Kies een discipline' }),
      el('ul', { className: 'switcher__list', attrs: { role: 'list' } }, cockpit.disciplines.map(item)),
      el('p', { className: 'switcher__foot' }, [
        icon('globe'),
        el('span', {}, [
          'Tips, agents en trainingen voor iedereen zie je in elke cockpit. ',
          el('a', { attrs: { href: '#/zo-werkt-het' }, text: 'Zo werkt het' })
        ])
      ])
    );
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
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    switcher.classList.remove('is-open');
    if (returnFocus) button.focus({ preventScroll: true });
  }

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
})(window.AIAudit);
