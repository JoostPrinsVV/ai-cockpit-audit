/* ==========================================================================
   Agents & tools (#/agents) en één agent of tool (#/agent/<id>)
   --------------------------------------------------------------------------
   Catalogus van AI-agents en -producten, vanuit de gebruiker bekeken: wat
   is het, waarvoor gebruik je het (en waarvoor niet) en hoe krijg je
   toegang. De formele registratie staat in het AI-register (registerUrl).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, emptyState } = ns.ui;
  const { detailHeader, relatedList, itemLinks, warningList, askCard, notice, linkButton, statusPanel, openButton, filterRow, resultCount, countText, cardCache } = ns.blocks;

  // Filters blijven staan zolang de pagina open is
  const filters = { kind: 'all', status: 'all' };

  const KIND_INFO = {
    'Microsoft-standaard': 'Onderdeel van Microsoft 365, gemaakt door Microsoft.',
    'Eigen agent': 'Gemaakt door of voor Visser & Visser.',
    'Extern product': 'AI-product van een andere leverancier.'
  };
  const STATUS_INFO = {
    Beschikbaar: { tone: 'success', text: 'Te gebruiken, met de juiste licentie of toegang.' },
    Pilot: { tone: 'info', text: 'Wordt getest met een beperkte groep collega\'s.', open: 'In pilot bij een beperkte groep collega\'s' },
    'In ontwikkeling': { tone: 'neutral', text: 'Wordt voorbereid; nog niet te gebruiken.', open: 'In ontwikkeling: nog niet te gebruiken' },
    Gestopt: { tone: 'muted', text: 'Niet meer in gebruik.' }
  };

  function statusBadge(agent) {
    const info = STATUS_INFO[agent.status] || STATUS_INFO.Beschikbaar;
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
  function card(agent, headingTag) {
    return el('article', { className: 'uc-card ag-card ' + accentClass(agent.accent) + (agent.stopped ? ' is-stopped' : ''), dataset: { kind: 'agent', id: agent.id } }, [
      el('div', { className: 'uc-card__top' }, [
        el('span', { className: 'uc-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon(agent.icon)]),
        el('div', { className: 'uc-card__badges' }, [ns.ui.draftBadge(agent), ns.cockpit.sharedBadge(agent), newBadge(agent.added), agentLicense(agent, true)])
      ]),
      el('div', { className: 'uc-card__body' }, [
        el('p', { className: 'uc-card__phase', text: agent.kind }),
        el(headingTag || 'h2', { className: 'uc-card__title' }, [el('a', { className: 'uc-card__link', attrs: { href: ns.kinds.href('agent', agent.id) }, text: agent.title })]),
        agent.summary ? el('p', { className: 'uc-card__subtitle', text: agent.summary }) : null
      ]),
      el('div', { className: 'uc-card__footer' }, [
        el('div', { className: 'uc-card__meta' }, [statusBadge(agent)]),
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

  /** Schakelknoppen voor alle waarden, met aantallen; een waarde zonder agents staat uit. */
  function facet(label, values, all, key, onChange) {
    const group = toggleGroup('Filter op ' + label, [{ value: 'all', label: 'Alle', count: all.length }].concat(
      values.map((value) => ({ value, label: value, count: all.filter((agent) => agent[key] === value).length }))
    ), filters[key], (value) => {
      filters[key] = value;
      onChange();
    });
    group.querySelectorAll('.toggle').forEach((button) => {
      if (button.dataset.value !== 'all' && !all.some((agent) => agent[key] === button.dataset.value)) button.disabled = true;
    });
    return group;
  }

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
    if (!all.some((agent) => agent.kind === filters.kind)) filters.kind = 'all';
    if (!all.some((agent) => agent.status === filters.status)) filters.status = 'all';

    const grid = el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } });
    const count = resultCount();
    const empty = emptyState('Geen agents of tools met deze filters', 'Kies een andere soort of status.');

    const cardFor = cardCache((agent) => card(agent));

    function update() {
      const items = all.filter((agent) =>
        (filters.kind === 'all' || agent.kind === filters.kind) &&
        (filters.status === 'all' || agent.status === filters.status)
      );
      grid.replaceChildren(...items.map((agent) => cardFor(agent)));
      count.textContent = countText(items.length, 'agent of tool', 'agents en tools');
      empty.hidden = items.length > 0;
      grid.hidden = items.length === 0;
    }

    const node = el('div', { className: 'page container' }, [
      head,
      el('div', { className: 'filters' }, [
        filterRow('Soort', facet('soort', ns.content.AGENT_KINDS, all, 'kind', update)),
        filterRow('Status', facet('status', ns.content.AGENT_STATUSES, all, 'status', update), count)
      ]),
      grid,
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
          openBlock(agent),
          agent.description ? el('div', { className: 'detail__text' }, paragraphs(agent.description, 'detail__intro')) : null,
          agent.access && !agent.stopped ? el('section', { className: 'why', attrs: { 'aria-labelledby': 'ag-access' } }, [
            el('h2', { className: 'why__title', attrs: { id: 'ag-access' } }, [icon('key'), el('span', { text: 'Zo krijg je toegang' })]),
            ...paragraphs(agent.access)
          ]) : null,
          warningList('ag-notfor', 'Niet gebruiken voor', agent.notFor)
        ]),
        aside
      ])
    ]);
    return { node, title: agent.title };
  }

  ns.views = ns.views || {};
  ns.views.agents = { renderList, renderDetail, card };
})(window.AIAudit);
