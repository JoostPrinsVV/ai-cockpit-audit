/* ==========================================================================
   Agents & tools (#/agents) en één agent of tool (#/agent/<id>)
   --------------------------------------------------------------------------
   Catalogus van AI-agents en -producten, vanuit de gebruiker bekeken: wat
   is het, waarvoor gebruik je het (en waarvoor niet) en hoe krijg je
   toegang. De formele registratie staat in het AI-register (registerUrl).
   Iedere agent staat één keer op de pagina: eerst wat beschikbaar is, dan
   wat in testfase is. Fase en status zijn keuzelijsten (filters), geen
   koppen, zodat een agent die in meer fasen past niet steeds terugkomt.
   groups() en broad() blijven beschikbaar voor andere onderdelen.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, emptyState } = ns.ui;
  const { detailHeader, relatedList, itemLinks, warningList, askCard, notice, linkButton, statusPanel, openButton, resultCount, countText } = ns.blocks;

  // Filters blijven staan zolang de pagina open is
  const filters = { status: 'all', phase: 'all' };

  /** In (bijna) elke fase: geen fasen, of hooguit één fase niet. Die staat één keer, niet in iedere groep. */
  const broad = (agent) => !agent.phases.length || agent.phases.length >= Math.max(2, ns.content.phases.length - 1);
  /** Hoort bij een fase (voor het filter): die fase gekozen, of in (bijna) elke fase. */
  const inPhase = (agent, phaseId) => broad(agent) || agent.phases.some((phase) => phase.id === phaseId);

  /**
   * De groepen bij 'Alle fasen': eerst de fasen van het seizoen (uitgelicht), dan 'In elke fase', dan de
   * andere fasen in de volgorde uit Beheer. Een agent met een paar fasen staat in elk daarvan.
   * [{ phase (null = in elke fase), items, season }]
   */
  function groups(items, season) {
    const now = season || [];
    const order = now.map((entry) => entry.phase).concat(ns.content.phases.filter((phase) => !now.some((entry) => entry.phase === phase)));
    const out = [];
    order.forEach((phase) => {
      const members = items.filter((agent) => !broad(agent) && agent.phases.includes(phase));
      if (!members.length) return;
      const match = now.find((entry) => entry.phase === phase);
      out.push({ phase, items: members, season: match ? match.season : null });
    });
    const wide = items.filter(broad);
    if (wide.length) out.splice(out.filter((group) => group.season).length, 0, { phase: null, items: wide, season: null });
    return out;
  }

  const KIND_INFO = {
    'Microsoft-standaard': 'Onderdeel van Microsoft 365, gemaakt door Microsoft.',
    'Eigen agent': 'Gemaakt door of voor Visser & Visser.',
    'Extern product': 'AI-product van een andere leverancier.'
  };
  const STATUS_INFO = {
    Beschikbaar: { tone: 'success', text: 'Te gebruiken, met de juiste licentie of toegang.' },
    Testfase: { tone: 'warning', text: 'Nog geen geaccepteerde agent: we testen hem en halen eerst feedback op.', open: 'In testfase: probeer hem en deel je ervaring' },
    'In ontwikkeling': { tone: 'neutral', text: 'Wordt voorbereid; nog niet te gebruiken.', open: 'In ontwikkeling: nog niet te gebruiken' },
    Gestopt: { tone: 'muted', text: 'Niet meer in gebruik.' }
  };

  function statusBadge(agent) {
    const info = STATUS_INFO[agent.status] || STATUS_INFO.Beschikbaar;
    if (agent.testing) return el('span', { className: 'status status--test', attrs: { title: info.text } }, [icon('flask'), el('span', { text: 'Testfase' })]);
    return el('span', { className: 'status status--' + info.tone, text: agent.status, attrs: { title: info.text } });
  }

  /** Licentie: bij Microsoft en eigen agents de Copilot-licentie, bij een extern product een eigen licentie. */
  function agentLicense(agent, short) {
    if (agent.kind !== 'Extern product') return licenseBadge(agent.license, { short });
    if (agent.license === true) return el('span', { className: 'badge badge--license', attrs: { title: 'Voor dit product is een eigen licentie of account nodig' } }, [icon('key'), short ? 'Licentie' : 'Eigen licentie nodig']);
    if (agent.license === false) return el('span', { className: 'badge badge--free', attrs: { title: 'Geen aparte licentie nodig' } }, [icon('check'), short ? 'Zonder licentie' : 'Geen licentie nodig']);
    return null;
  }

  /**
   * Kaart voor een agent (ook gebruikt bij zoeken). Klikbaar via de titel, die over de hele kaart
   * reikt: een schermlezer hoort dan de naam als link, niet de hele kaart.
   */
  function card(agent, headingTag, options) {
    const showNew = !options || options.showNew !== false;
    // In testfase: een gele rand en het label Testfase onderaan; de uitleg staat één keer boven het blok
    return el('article', { className: 'uc-card ag-card ' + accentClass(agent.accent) + (agent.stopped ? ' is-stopped' : '') + (agent.testing ? ' is-testing' : ''), dataset: { kind: 'agent', id: agent.id } }, [
      el('div', { className: 'uc-card__top' }, [
        el('span', { className: 'uc-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon(agent.icon)]),
        el('div', { className: 'uc-card__badges' }, [ns.ui.draftBadge(agent), ns.ui.dutchBadge(agent), showNew ? newBadge(agent.added) : null, agentLicense(agent, true)])
      ]),
      el('div', { className: 'uc-card__body' }, [
        el('p', { className: 'uc-card__phase', text: agent.kind }),
        el(headingTag || 'h2', { className: 'uc-card__title' }, [el('a', { className: 'uc-card__link', attrs: { href: ns.kinds.href('agent', agent.id) }, text: agent.title })]),
        agent.summary ? el('p', { className: 'uc-card__subtitle', text: agent.summary }) : null
      ]),
      el('div', { className: 'uc-card__footer' }, [
        el('div', { className: 'uc-card__meta' }, [statusBadge(agent), ...(agent.stopped ? [] : ns.check.levelChip(agent))]),
        el('span', { className: 'uc-card__go', attrs: { 'aria-hidden': 'true' } }, [icon('arrow-right')])
      ])
    ]);
  }

  const questionCta = () => notice({
    tone: 'cta',
    icon: 'question',
    title: 'Mis je een agent of tool, of twijfel je of je iets mag gebruiken?',
    text: 'Vraag het na voordat je een andere AI-tool voor je werk gebruikt. Stel je vraag in de ideeënhub; het antwoord helpt vaak ook anderen.',
    action: linkButton('#/ideeen/vraag', 'message-plus', 'Stel een vraag', 'btn--secondary btn--sm')
  });

  /** Keuzelijst als filter: compacter dan een rij knoppen. */
  function selectFilter(label, options, key, onChange) {
    const select = el('select', { className: 'field__input ag-filter__select', attrs: { 'aria-label': 'Filter op ' + label.toLowerCase() } },
      options.map((option) => el('option', { attrs: { value: option.value }, text: option.label + (option.count != null ? ` (${option.count})` : '') })));
    select.value = filters[key];
    select.addEventListener('change', () => {
      filters[key] = select.value;
      onChange();
    });
    return el('label', { className: 'ag-filter' }, [el('span', { className: 'ag-filter__label', text: label }), select]);
  }

  // De blokken op de pagina, in deze volgorde; iedere agent staat in precies één blok
  const SECTIONS = [
    { status: 'Beschikbaar', title: 'Beschikbaar', icon: 'check-circle' },
    { status: 'Testfase', title: 'In testfase', icon: 'flask', text: 'Nog niet geaccepteerd. Probeer ze uit en deel je ervaring op de pagina van de agent: zo bepalen we samen of ze blijven.' },
    { status: 'In ontwikkeling', title: 'In ontwikkeling', icon: 'settings' },
    { status: 'Gestopt', title: 'Gestopt', icon: 'close' }
  ];

  /* ---- Overzicht ---------------------------------------------------------------- */
  function renderList() {
    const all = ns.content.agents;
    const head = pageHeader({
      eyebrow: 'Agents & tools',
      title: 'AI-agents en tools',
      lead: 'Welke AI-agents en -producten kun je gebruiken, waarvoor (en waarvoor niet), en hoe krijg je toegang? Per agent of tool vind je ook de usecases, tips en trainingen die erbij horen.'
    });

    if (!all.length) {
      const node = el('div', { className: 'page container' }, [
        head,
        emptyState('De catalogus wordt gevuld', `Hier komen de AI-agents en tools die je in ${ns.cockpit.active().label} kunt gebruiken, met waarvoor ze bedoeld zijn en hoe je toegang krijgt.`,
          linkButton('#/ideeen/vraag', 'message-plus', 'Stel een vraag', 'btn--primary'), 'robot')
      ]);
      return { node, title: 'Agents & tools' };
    }

    // Filters van een vorige keer die nu niets meer opleveren: terug naar 'Alle'
    if (!all.some((agent) => agent.status === filters.status)) filters.status = 'all';
    if (filters.phase !== 'all' && !all.some((agent) => inPhase(agent, filters.phase))) filters.phase = 'all';

    // 'Nieuw' zegt alleen iets als niet alles nieuw is
    const showNew = !all.every((agent) => ns.ui.isNew(agent.added));

    const list = el('div', { className: 'ag-sections' });
    const count = resultCount();
    const empty = emptyState('Geen agents of tools met deze filters', 'Kies een andere fase of status.');

    function update() {
      const items = all.filter((agent) =>
        (filters.phase === 'all' || inPhase(agent, filters.phase)) &&
        (filters.status === 'all' || agent.status === filters.status)
      );
      list.replaceChildren(...SECTIONS.map((section) => {
        const members = items.filter((agent) => agent.status === section.status || (section.status === 'Beschikbaar' && !SECTIONS.some((s) => s.status === agent.status)));
        if (!members.length) return null;
        const titleId = 'ag-' + section.status.toLowerCase().replace(/\s+/g, '-');
        return el('section', { className: 'ag-section' + (section.status === 'Testfase' ? ' is-testing' : ''), attrs: { 'aria-labelledby': titleId } }, [
          el('h2', { className: 'ag-section__title', attrs: { id: titleId } }, [
            el('span', { className: 'ag-section__icon', attrs: { 'aria-hidden': 'true' } }, [icon(section.icon)]),
            el('span', { text: section.title }),
            el('span', { className: 'p-group__count', text: String(members.length) })
          ]),
          section.text ? el('p', { className: 'ag-section__text', text: section.text }) : null,
          el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } }, members.map((agent) => el('li', {}, [card(agent, 'h3', { showNew })])))
        ]);
      }).filter(Boolean));
      count.textContent = countText(items.length, 'agent of tool', 'agents en tools');
      empty.hidden = items.length > 0;
      list.hidden = items.length === 0;
    }

    const phaseOptions = [{ value: 'all', label: 'Alle fasen' }].concat(ns.content.phases
      .map((phase) => ({ value: phase.id, label: phase.short, count: all.filter((agent) => inPhase(agent, phase.id)).length }))
      .filter((option) => option.count > 0));
    const statusOptions = [{ value: 'all', label: 'Alle' }].concat(ns.content.AGENT_STATUSES
      .map((status) => ({ value: status, label: status, count: all.filter((agent) => agent.status === status).length }))
      .filter((option) => option.count > 0));

    const node = el('div', { className: 'page container' }, [
      head,
      el('div', { className: 'ag-filters' }, [
        selectFilter('Fase', phaseOptions, 'phase', update),
        selectFilter('Status', statusOptions, 'status', update),
        count
      ]),
      list,
      empty,
      el('div', { className: 'section' }, [questionCta()])
    ]);
    update();
    return { node, title: 'Agents & tools' };
  }

  /* ---- Eén agent of tool ----------------------------------------------------------- */
  function openBlock(agent) {
    if (agent.stopped) {
      return statusPanel({ accent: agent.accent, icon: 'close', pending: true, title: 'Gestopt', text: 'Deze agent of tool is niet meer in gebruik. Zoek je een alternatief? Kijk bij de andere agents en tools of stel een vraag in de ideeënhub.' });
    }
    const title = (STATUS_INFO[agent.status] || {}).open || 'Aan de slag met ' + agent.title;
    if (!agent.link) {
      return statusPanel({ accent: agent.accent, icon: agent.icon, pending: true, title, text: agent.access ? 'Hieronder staat hoe je toegang krijgt.' : 'Er is (nog) geen link om dit te openen.' });
    }
    return statusPanel({
      accent: agent.accent,
      icon: agent.icon,
      title,
      text: agent.kind === 'Extern product' ? 'Opent in een nieuw tabblad.' : 'Opent in een nieuw tabblad. Log in met je Visser & Visser-account.',
      action: openButton(agent.link, 'Openen', { onOpen: () => ns.central.track('open_agent', agent.id) })
    });
  }

  const allPhases = (agent) => agent.phases.length > 1 && agent.phases.length === ns.content.phases.length;

  /** Tekst met lege regels als alinea's. */
  function paragraphs(value, className) {
    return value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => el('p', { className, text: part }));
  }

  function facts(agent) {
    const rows = [
      ['Soort', agent.kind + '. ' + KIND_INFO[agent.kind]],
      ['Status', agent.status + '. ' + (STATUS_INFO[agent.status] || {}).text],
      agent.license === true || agent.license === false ? ['Licentie', agent.license
        ? (agent.kind === 'Extern product' ? 'Er is een eigen licentie of account nodig.' : 'Werkt met een Microsoft 365 Copilot-licentie.')
        : (agent.kind === 'Extern product' ? 'Geen aparte licentie nodig.' : 'Ook te gebruiken zonder Copilot-licentie.')] : null,
      agent.phases.length ? ['Fasen', allPhases(agent) ? `Alle fasen van ${ns.cockpit.active().phases}` : agent.phases.map((phase) => phase.label).join(', ')] : null,
      agent.owner ? ['Aanspreekpunt', agent.owner] : null
    ].filter(Boolean);
    return el('section', { className: 'side-card', attrs: { 'aria-labelledby': 'ag-facts' } }, [
      el('h2', { className: 'side-card__title', attrs: { id: 'ag-facts' } }, [icon('info'), el('span', { text: 'In het kort' })]),
      el('dl', { className: 'facts' }, rows.map(([term, value]) => el('div', { className: 'facts__row' }, [el('dt', { text: term }), el('dd', { text: value })])))
    ]);
  }

  function renderDetail(id) {
    const agent = ns.content.agentById.get(id);
    if (!agent) return null;

    const aside = el('aside', { className: 'detail__aside', attrs: { 'aria-label': 'Bij deze agent' } }, [
      facts(agent),
      relatedList('ag-related', 'Zie het in de praktijk', [
        ...itemLinks('usecase', agent.usecases),
        ...itemLinks('training', agent.trainings),
        ...itemLinks('tip', agent.tips)
      ]),
      agent.registerUrl ? relatedList('ag-register', 'Formele registratie', [{ href: agent.registerUrl, icon: 'shield', text: 'Bekijk in het AI-register', external: true }],
        el('p', { className: 'field__hint', text: 'Afgeschermde omgeving: alleen te openen met je kantooraccount en de juiste rechten.' })) : null,
      askCard('deze agent')
    ]);

    const node = el('article', { className: 'page container detail ' + accentClass(agent.accent) }, [
      detailHeader({
        back: ['#/agents', 'Alle agents & tools'],
        icon: 'robot',
        eyebrow: agent.kind,
        title: agent.title,
        subtitle: agent.summary,
        chips: [
          statusBadge(agent),
          agentLicense(agent),
          ...(allPhases(agent) ? [chip('Alle fasen', { icon: 'grid' })] : agent.phases.map((phase) => chip(phase.short, { icon: phase.icon }))),
          newBadge(agent.added)
        ]
      }),
      el('div', { className: 'detail__layout' }, [
        el('div', { className: 'detail__main' }, [
          // In testfase: eerst het testblok (wat getest wordt, vaktechniek, 'Deel je testervaring')
          agent.testing ? ns.agentTest.block(agent) : null,
          openBlock(agent),
          agent.description ? el('div', { className: 'detail__text' }, paragraphs(agent.description, 'detail__intro')) : null,
          agent.access && !agent.stopped ? el('section', { className: 'why', attrs: { 'aria-labelledby': 'ag-access' } }, [
            el('h2', { className: 'why__title', attrs: { id: 'ag-access' } }, [icon('key'), el('span', { text: 'Zo krijg je toegang' })]),
            ...paragraphs(agent.access)
          ]) : null,
          // Wat mag erin, wel en niet geschikt voor, het AI-beleid en 'Mag dit?' (js/check.js)
          agent.stopped ? warningList('ag-notfor', 'Niet gebruiken voor', agent.notFor) : ns.check.agentBlock(agent)
        ]),
        aside
      ])
    ]);
    return { node, title: agent.title };
  }

  ns.views = ns.views || {};
  ns.views.agents = { renderList, renderDetail, card, groups, broad };
})(window.AIAudit);
