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

  /** Kaart voor een agent (ook gebruikt bij zoeken). */
  function card(agent, headingTag) {
    return el('a', { className: 'uc-card ag-card ' + accentClass(agent.accent) + (agent.stopped ? ' is-stopped' : ''), attrs: { href: '#/agent/' + agent.id } }, [
      el('div', { className: 'uc-card__top' }, [
        el('span', { className: 'uc-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon(agent.icon)]),
        el('div', { className: 'uc-card__badges' }, [ns.ui.draftBadge(agent), newBadge(agent.added), agentLicense(agent, true)])
      ]),
      el('div', { className: 'uc-card__body' }, [
        el('p', { className: 'uc-card__phase', text: agent.kind }),
        el(headingTag || 'h2', { className: 'uc-card__title', text: agent.title }),
        agent.summary ? el('p', { className: 'uc-card__subtitle', text: agent.summary }) : null
      ]),
      el('div', { className: 'uc-card__footer' }, [
        el('div', { className: 'uc-card__meta' }, [statusBadge(agent)]),
        el('span', { className: 'uc-card__go', attrs: { 'aria-hidden': 'true' } }, [icon('arrow-right')])
      ])
    ]);
  }

  function questionCta() {
    return el('div', { className: 'notice notice--cta' }, [
      icon('question'),
      el('div', {}, [
        el('p', { className: 'notice__title', text: 'Mis je een agent of tool, of twijfel je of je iets mag gebruiken?' }),
        el('p', { text: 'Vraag het na voordat je een andere AI-tool voor je werk gebruikt. Stel je vraag in de ideeënhub; het antwoord helpt vaak ook anderen.' })
      ]),
      el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/ideeen/vraag' } }, [icon('message-plus'), el('span', { text: 'Stel een vraag' })])
    ]);
  }

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
        el('div', { className: 'empty' }, [
          el('span', { className: 'empty__icon', attrs: { 'aria-hidden': 'true' } }, [icon('robot')]),
          el('p', { className: 'empty__title', text: 'De catalogus wordt gevuld' }),
          el('p', { className: 'empty__text', text: 'Hier komen de AI-agents en tools die je in de audit kunt gebruiken, met waarvoor ze bedoeld zijn en hoe je toegang krijgt.' }),
          el('a', { className: 'btn btn--primary', attrs: { href: '#/ideeen/vraag' } }, [icon('message-plus'), el('span', { text: 'Stel een vraag' })])
        ])
      ]);
      return { node, title: 'Agents & tools' };
    }

    // Filters van een vorige keer die nu niets meer opleveren: terug naar 'Alle'
    if (!all.some((agent) => agent.kind === filters.kind)) filters.kind = 'all';
    if (!all.some((agent) => agent.status === filters.status)) filters.status = 'all';

    const grid = el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } });
    const count = el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });
    const empty = emptyState('Geen agents of tools met deze filters', 'Kies een andere soort of status.');

    function update() {
      const items = all.filter((agent) =>
        (filters.kind === 'all' || agent.kind === filters.kind) &&
        (filters.status === 'all' || agent.status === filters.status)
      );
      grid.replaceChildren(...items.map((agent) => el('li', {}, [card(agent)])));
      count.textContent = items.length === 1 ? '1 agent of tool' : items.length + ' agents en tools';
      empty.hidden = items.length > 0;
      grid.hidden = items.length === 0;
    }

    const node = el('div', { className: 'page container' }, [
      head,
      el('div', { className: 'filters' }, [
        el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Soort' }), facet('soort', ns.content.AGENT_KINDS, all, 'kind', update)]),
        el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Status' }), facet('status', ns.content.AGENT_STATUSES, all, 'status', update), count])
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
      return el('div', { className: 'recording recording--pending ' + accentClass(agent.accent) }, [
        el('span', { className: 'recording__icon', attrs: { 'aria-hidden': 'true' } }, [icon('close')]),
        el('div', { className: 'recording__body' }, [
          el('p', { className: 'recording__title', text: 'Gestopt' }),
          el('p', { className: 'recording__text', text: 'Deze agent of tool is niet meer in gebruik. Zoek je een alternatief? Kijk bij de andere agents en tools of stel een vraag in de ideeënhub.' })
        ])
      ]);
    }
    const title = (STATUS_INFO[agent.status] || {}).open || 'Aan de slag met ' + agent.title;
    if (!agent.link) {
      return el('div', { className: 'recording recording--pending ' + accentClass(agent.accent) }, [
        el('span', { className: 'recording__icon', attrs: { 'aria-hidden': 'true' } }, [icon(agent.icon)]),
        el('div', { className: 'recording__body' }, [
          el('p', { className: 'recording__title', text: title }),
          el('p', { className: 'recording__text', text: agent.access ? 'Hieronder staat hoe je toegang krijgt.' : 'Er is (nog) geen link om dit te openen.' })
        ])
      ]);
    }
    const open = el('a', { className: 'btn btn--primary btn--lg', attrs: { href: agent.link, target: '_blank', rel: 'noopener noreferrer' } }, [
      el('span', { text: 'Openen' }),
      icon('external')
    ]);
    open.addEventListener('click', () => ns.central.track('open_agent', agent.id));
    return el('div', { className: 'recording ' + accentClass(agent.accent) }, [
      el('span', { className: 'recording__icon', attrs: { 'aria-hidden': 'true' } }, [icon(agent.icon)]),
      el('div', { className: 'recording__body' }, [
        el('p', { className: 'recording__title', text: title }),
        el('p', { className: 'recording__text', text: agent.kind === 'Extern product' ? 'Opent in een nieuw tabblad.' : 'Opent in een nieuw tabblad. Log in met je Visser & Visser-account.' })
      ]),
      open
    ]);
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
      agent.phases.length ? ['Fasen', allPhases(agent) ? 'Alle fasen van de controle' : agent.phases.map((phase) => phase.label).join(', ')] : null,
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
    ns.central.track('view_agent', agent.id);

    const usecases = agent.usecases.map((uid) => ns.content.usecaseById.get(uid)).filter(Boolean);
    const trainings = agent.trainings.map((tid) => ns.content.trainingById.get(tid)).filter(Boolean);
    const tips = agent.tips.map((tid) => ns.content.tipById.get(tid)).filter((tip) => tip && !tip.locked);
    const relatedLinks = [
      ...usecases.map((u) => ({ href: '#/usecase/' + u.id, icon: 'play-circle', text: u.title })),
      ...trainings.map((t) => ({ href: '#/training/' + t.id, icon: 'cap', text: t.title })),
      ...tips.map((t) => ({ href: '#/tip/' + t.id, icon: 'bulb', text: t.title }))
    ];

    const aside = el('aside', { className: 'detail__aside', attrs: { 'aria-label': 'Bij deze agent' } }, [
      facts(agent),
      relatedLinks.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'ag-related' } }, [
        el('h2', { className: 'related__title', text: 'Zie het in de praktijk', attrs: { id: 'ag-related' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, relatedLinks.map((link) =>
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: link.href } }, [icon(link.icon), el('span', { text: link.text }), icon('arrow-right', { className: 'related__go' })])])
        ))
      ]) : null,
      agent.registerUrl ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'ag-register' } }, [
        el('h2', { className: 'related__title', text: 'Formele registratie', attrs: { id: 'ag-register' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, [
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: agent.registerUrl, target: '_blank', rel: 'noopener noreferrer' } }, [
            icon('shield'), el('span', { text: 'Bekijk in het AI-register' }), icon('external', { className: 'related__go' })
          ])])
        ]),
        el('p', { className: 'field__hint', text: 'Afgeschermde omgeving: alleen te openen met je kantooraccount en de juiste rechten.' })
      ]) : null,
      el('div', { className: 'side-card' }, [
        el('h2', { className: 'side-card__title' }, [icon('question'), el('span', { text: 'Vraag over deze agent?' })]),
        el('p', { className: 'side-card__text', text: 'Stel hem in de ideeënhub. Het antwoord helpt vaak ook anderen.' }),
        el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/ideeen/vraag' } }, [icon('message-plus'), el('span', { text: 'Stel een vraag' })])
      ])
    ]);

    const node = el('article', { className: 'page container detail ' + accentClass(agent.accent) }, [
      el('header', { className: 'detail__header' }, [
        el('a', { className: 'btn btn--back btn--sm', attrs: { href: '#/agents' } }, [icon('arrow-left'), el('span', { text: 'Alle agents & tools' })]),
        el('p', { className: 'detail__eyebrow' }, [icon('robot'), el('span', { text: agent.kind })]),
        el('h1', { className: 'detail__title', text: agent.title, attrs: { tabindex: '-1' } }),
        agent.summary ? el('p', { className: 'detail__subtitle', text: agent.summary }) : null,
        el('div', { className: 'chips' }, [
          statusBadge(agent),
          agentLicense(agent),
          ...(allPhases(agent) ? [chip('Alle fasen', { icon: 'grid' })] : agent.phases.map((phase) => chip(phase.short, { icon: phase.icon }))),
          newBadge(agent.added)
        ].filter(Boolean))
      ]),
      el('div', { className: 'detail__layout' }, [
        el('div', { className: 'detail__main' }, [
          openBlock(agent),
          agent.description ? el('div', { className: 'detail__text' }, paragraphs(agent.description, 'detail__intro')) : null,
          agent.access && !agent.stopped ? el('section', { className: 'why', attrs: { 'aria-labelledby': 'ag-access' } }, [
            el('h2', { className: 'why__title', attrs: { id: 'ag-access' } }, [icon('key'), el('span', { text: 'Zo krijg je toegang' })]),
            ...paragraphs(agent.access)
          ]) : null,
          agent.notFor.length ? el('section', { className: 'callout callout--warning', attrs: { 'aria-labelledby': 'ag-notfor' } }, [
            el('h2', { className: 'callout__title', attrs: { id: 'ag-notfor' } }, [icon('alert'), el('span', { text: 'Niet gebruiken voor' })]),
            el('ul', { className: 'callout__list' }, agent.notFor.map((item) => el('li', { text: item })))
          ]) : null
        ]),
        aside
      ])
    ]);
    return { node, title: agent.title };
  }

  ns.views = ns.views || {};
  ns.views.agents = { renderList, renderDetail, card };
})(window.AIAudit);
