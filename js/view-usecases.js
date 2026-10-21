/* ==========================================================================
   Usecases (#/usecases) en één usecase met demo (#/usecase/<id>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, emptyState } = ns.ui;

  // Filters blijven staan zolang de pagina open is
  const filters = { phase: 'all', license: 'all' };

  /** Kaart voor een usecase (ook gebruikt op de startpagina en bij zoeken). */
  function card(usecase, headingTag) {
    const meta = [];
    if (usecase.hasDemo) meta.push(el('span', { className: 'meta' }, [icon(usecase.video ? 'film' : 'play-circle'), el('span', { text: (usecase.duration ? usecase.duration + ' ' : '') + 'demo' })]));
    else meta.push(el('span', { className: 'meta meta--muted' }, [icon('clock'), el('span', { text: 'Demo volgt' })]));
    if (usecase.level) meta.push(el('span', { className: 'meta' }, [icon('sparkle'), el('span', { text: usecase.level })]));

    return el('a', { className: 'uc-card ' + accentClass(usecase.accent), attrs: { href: '#/usecase/' + usecase.id } }, [
      el('div', { className: 'uc-card__top' }, [
        el('span', { className: 'uc-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon(usecase.icon)]),
        el('div', { className: 'uc-card__badges' }, [ns.ui.draftBadge(usecase), newBadge(usecase.added), licenseBadge(usecase.license, { short: true })])
      ]),
      el('div', { className: 'uc-card__body' }, [
        el('p', { className: 'uc-card__phase', text: usecase.phase.label }),
        el(headingTag || 'h2', { className: 'uc-card__title', text: usecase.title }),
        usecase.subtitle ? el('p', { className: 'uc-card__subtitle', text: usecase.subtitle }) : null
      ]),
      el('div', { className: 'uc-card__footer' }, [
        el('div', { className: 'uc-card__meta' }, meta),
        el('span', { className: 'uc-card__go', attrs: { 'aria-hidden': 'true' } }, [icon('arrow-right')])
      ])
    ]);
  }

  /* ---- Overzicht ------------------------------------------------------------- */
  function renderList() {
    const all = ns.content.usecases;
    const grid = el('ul', { className: 'card-grid', attrs: { role: 'list' } });
    const count = el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });
    const empty = emptyState('Geen usecases met deze filters', 'Kies een andere fase of zet het licentiefilter op Alle.');

    function update() {
      const items = all.filter((u) =>
        (filters.phase === 'all' || u.phase.id === filters.phase) &&
        (filters.license === 'all' || (filters.license === 'yes' ? u.license === true : u.license === false))
      );
      grid.replaceChildren(...items.map((u) => el('li', {}, [card(u)])));
      count.textContent = items.length === 1 ? '1 usecase' : items.length + ' usecases';
      empty.hidden = items.length > 0;
      grid.hidden = items.length === 0;
    }

    const phases = ns.content.phases
      .map((phase) => ({ value: phase.id, label: phase.short, accent: phase.accent, count: all.filter((u) => u.phase.id === phase.id).length }))
      .filter((item) => item.count > 0);
    const phaseGroup = toggleGroup('Filter op fase', [{ value: 'all', label: 'Alle fasen', count: all.length }].concat(phases), filters.phase, (value) => {
      filters.phase = value;
      update();
    });
    const licenseGroup = toggleGroup('Filter op licentie', [
      { value: 'all', label: 'Alle' },
      { value: 'no', label: 'Zonder licentie', icon: 'check' },
      { value: 'yes', label: 'Met licentie', icon: 'key' }
    ], filters.license, (value) => {
      filters.license = value;
      update();
    }, { className: 'toggles--compact' });

    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Usecases',
        title: 'Copilot in de praktijk van de audit',
        lead: 'Per fase van de controle: wat je met Copilot kunt doen, hoe het eruitziet in een demo en welke prompts je direct kunt gebruiken. Alle demo\'s werken met fictieve gegevens.'
      }),
      el('div', { className: 'filters' }, [
        el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Fase' }), phaseGroup]),
        el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Licentie' }), licenseGroup, count])
      ]),
      grid,
      empty
    ]);
    update();
    return { node, title: 'Usecases' };
  }

  /* ---- Eén usecase --------------------------------------------------------------- */
  function renderDetail(id) {
    const usecase = ns.content.usecaseById.get(id);
    if (!usecase) return null;
    ns.central.track('view_usecase', usecase.id);
    const player = ns.player.create(usecase);

    const chips = [
      licenseBadge(usecase.license),
      ...usecase.tools.map((tool) => chip(tool, { icon: 'robot' })),
      usecase.level ? chip(usecase.level, { icon: 'sparkle' }) : null,
      usecase.hasDemo && usecase.duration ? chip(usecase.duration + ' demo', { icon: 'clock' }) : null,
      newBadge(usecase.added)
    ].filter(Boolean);

    const main = el('div', { className: 'detail__main' }, [
      player.node,
      usecase.intro ? el('p', { className: 'detail__intro', text: usecase.intro }) : null,
      usecase.steps.length ? el('section', { className: 'block', attrs: { 'aria-labelledby': 'uc-steps' } }, [
        el('h2', { className: 'block__title', text: 'Zo pak je het aan', attrs: { id: 'uc-steps' } }),
        el('ol', { className: 'steps', attrs: { role: 'list' } }, usecase.steps.map((step, index) =>
          el('li', { className: 'steps__item' }, [el('span', { className: 'steps__number', text: String(index + 1) }), el('span', { text: step })])
        ))
      ]) : null,
      usecase.watchOut.length ? el('section', { className: 'callout callout--warning', attrs: { 'aria-labelledby': 'uc-watch' } }, [
        el('h2', { className: 'callout__title', attrs: { id: 'uc-watch' } }, [icon('alert'), el('span', { text: 'Let op' })]),
        el('ul', { className: 'callout__list' }, usecase.watchOut.map((item) => el('li', { text: item })))
      ]) : null
    ]);

    const promptBoxes = usecase.prompts.map((prompt, index) =>
      ns.promptBox.create({
        text: prompt.text,
        label: prompt.label,
        collapsed: true,
        onCopy: () => ns.central.track('copy_prompt', usecase.promptIds[index] || usecase.id)
      })
    );

    const related = usecase.relatedTips.map((tipId) => ns.content.tipById.get(tipId)).filter((tip) => tip && !tip.locked);
    const aside = el('aside', { className: 'detail__aside', attrs: { 'aria-labelledby': 'uc-prompts' } }, [
      el('div', { className: 'takeaway' }, [
        el('div', { className: 'takeaway__head' }, [
          el('span', { className: 'takeaway__icon', attrs: { 'aria-hidden': 'true' } }, [icon('chat')]),
          el('div', {}, [
            el('p', { className: 'takeaway__eyebrow', text: usecase.prompts.length > 1 ? usecase.prompts.length + ' prompts, na elkaar te gebruiken' : 'Direct te gebruiken' }),
            el('h2', { className: 'takeaway__title', text: 'De prompts', attrs: { id: 'uc-prompts' } })
          ])
        ]),
        ...promptBoxes,
        usecase.promptNote ? el('p', { className: 'takeaway__note' }, [icon('info'), el('span', { text: usecase.promptNote })]) : null,
        usecase.tip ? el('div', { className: 'tip' }, [
          el('span', { className: 'tip__icon', attrs: { 'aria-hidden': 'true' } }, [icon('bulb')]),
          el('p', {}, [el('strong', { text: 'Tip ' }), usecase.tip])
        ]) : null
      ]),
      related.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'uc-related' } }, [
        el('h2', { className: 'related__title', text: 'Handige tips hierbij', attrs: { id: 'uc-related' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, related.map((tip) =>
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: '#/tip/' + tip.id } }, [icon(tip.icon), el('span', { text: tip.title }), icon('arrow-right', { className: 'related__go' })])])
        ))
      ]) : null
    ]);

    const node = el('article', { className: 'page container detail ' + accentClass(usecase.accent) }, [
      el('header', { className: 'detail__header' }, [
        el('a', { className: 'btn btn--back btn--sm', attrs: { href: '#/usecases' } }, [icon('arrow-left'), el('span', { text: 'Alle usecases' })]),
        el('p', { className: 'detail__eyebrow' }, [icon(usecase.phase.icon), el('span', { text: usecase.phase.label })]),
        el('h1', { className: 'detail__title', text: usecase.title, attrs: { tabindex: '-1' } }),
        usecase.subtitle ? el('p', { className: 'detail__subtitle', text: usecase.subtitle }) : null,
        el('div', { className: 'chips' }, chips)
      ]),
      el('div', { className: 'detail__layout' }, [main, aside])
    ]);
    return { node, title: usecase.title, destroy: player.destroy };
  }

  ns.views = ns.views || {};
  ns.views.usecases = { renderList, renderDetail, card };
})(window.AIAudit);
