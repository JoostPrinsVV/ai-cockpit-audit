/* ==========================================================================
   Usecases (#/usecases) en één usecase met demo (#/usecase/<id>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, switchButton, emptyState, saveButton } = ns.ui;

  // Filters en volgorde blijven staan zolang de pagina open is
  const filters = { phase: 'all', license: 'all', saved: false, sort: 'default' };

  /** Id's van de bewaarde usecases */
  const savedIds = () => ns.ui.saved.list().filter((key) => key.startsWith('usecase:')).map((key) => key.slice(8)).filter((id) => ns.content.usecaseById.has(id));

  /**
   * Kaart voor een usecase (ook op de startpagina en bij zoeken). De hele kaart is klikbaar
   * via de titel; de bewaarknop ligt erboven.
   */
  function card(usecase, headingTag) {
    const meta = [];
    if (usecase.hasDemo) meta.push(el('span', { className: 'meta' }, [icon(usecase.video ? 'film' : 'play-circle'), el('span', { text: (usecase.duration ? usecase.duration + ' ' : '') + 'demo' })]));
    else meta.push(el('span', { className: 'meta meta--muted' }, [icon('clock'), el('span', { text: 'Demo volgt' })]));
    if (usecase.level) meta.push(el('span', { className: 'meta' }, [icon('sparkle'), el('span', { text: usecase.level })]));
    const rating = ns.reviews.ratingChip('usecase', usecase.id);
    if (rating) meta.push(rating);

    return el('article', { className: 'uc-card ' + accentClass(usecase.accent) }, [
      el('div', { className: 'uc-card__top' }, [
        el('span', { className: 'uc-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon(usecase.icon)]),
        el('div', { className: 'uc-card__badges' }, [ns.ui.draftBadge(usecase), ns.cockpit.sharedBadge(usecase), newBadge(usecase.added), licenseBadge(usecase.license, { short: true })]),
        saveButton('usecase', usecase.id, usecase.title)
      ]),
      el('div', { className: 'uc-card__body' }, [
        el('p', { className: 'uc-card__phase', text: usecase.phase.label }),
        el(headingTag || 'h2', { className: 'uc-card__title' }, [el('a', { className: 'uc-card__link', attrs: { href: '#/usecase/' + usecase.id }, text: usecase.title })]),
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
    // Een lege catalogus (nieuwe discipline) is iets anders dan niets vinden met deze filters
    const empty = all.length
      ? emptyState('Geen usecases met deze filters', 'Kies een andere fase of zet de filters terug op Alle.')
      : emptyState('De eerste usecases komen eraan', `Hier verschijnen de usecases voor Copilot in ${ns.cockpit.active().label}, met een demo en de prompts erbij.`, null, 'play-circle');
    const savedCount = el('span', { className: 'toggle__count' });
    // Iedere kaart één keer bouwen; filteren zet alleen de bestaande kaarten op hun plek
    const cards = new Map();
    const cardFor = (u) => {
      if (!cards.has(u.id)) cards.set(u.id, el('li', {}, [card(u, 'h2')]));
      return cards.get(u.id);
    };

    function update() {
      const saved = savedIds();
      savedCount.textContent = String(saved.length);
      let items = all.filter((u) =>
        (filters.phase === 'all' || u.phase.id === filters.phase) &&
        (filters.license === 'all' || (filters.license === 'yes' ? u.license === true : u.license === false)) &&
        (!filters.saved || saved.includes(u.id))
      );
      if (filters.sort === 'rating') items = ns.reviews.rank(items, 'usecase');
      grid.replaceChildren(...items.map(cardFor));
      count.textContent = items.length === 1 ? '1 usecase' : items.length + ' usecases';
      empty.hidden = items.length > 0;
      grid.hidden = items.length === 0;
    }
    // Bewaren of niet meer bewaren: de telling, en met 'Bewaard' aan ook de lijst
    const stopSaved = ns.ui.onSaved('usecase', grid, () => {
      if (filters.saved) update();
      else savedCount.textContent = String(savedIds().length);
    });

    // De fasen als route: genummerde waypoints (01 Planning, 02 …) op een stippellijn
    const phases = ns.content.phases
      .map((phase, index) => ({ value: phase.id, label: phase.short, accent: phase.accent, step: String(index + 1).padStart(2, '0'), count: all.filter((u) => u.phase.id === phase.id).length }))
      .filter((item) => item.count > 0);
    // Een fase die er (na een wijziging) niet meer is: terug naar Alle fasen
    if (filters.phase !== 'all' && !phases.some((item) => item.value === filters.phase)) filters.phase = 'all';
    const phaseGroup = toggleGroup('Filter op fase', [{ value: 'all', label: 'Alle fasen', count: all.length }].concat(phases), filters.phase, (value) => {
      filters.phase = value;
      update();
    }, { className: 'toggles--route' });
    const licenseGroup = toggleGroup('Filter op licentie', [
      { value: 'all', label: 'Alle' },
      { value: 'no', label: 'Zonder licentie', icon: 'check' },
      { value: 'yes', label: 'Met licentie', icon: 'key' }
    ], filters.license, (value) => {
      filters.license = value;
      update();
    }, { className: 'toggles--compact' });

    // Volgorde: standaard, of best beoordeeld door collega's (de gemiddelden komen uit de database)
    const sortGroup = ns.reviews.enabled() ? toggleGroup('Volgorde', [
      { value: 'default', label: 'Standaard' },
      { value: 'rating', label: 'Best beoordeeld', icon: 'star' }
    ], filters.sort, (value) => {
      filters.sort = value;
      update();
    }, { className: 'toggles--compact' }) : null;
    // De gemiddelden komen later binnen: dan de kaarten opnieuw bouwen (met de sterren erop)
    if (ns.reviews.enabled() && ns.reviews.cached() === undefined) {
      ns.reviews.stats().then(() => {
        if (!grid.isConnected) return;
        cards.clear();
        update();
      });
    }

    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Usecases',
        title: `Copilot in de praktijk van ${ns.cockpit.active().label}`,
        lead: `Per fase van ${ns.cockpit.active().phases}: wat je met Copilot kunt doen, hoe het eruitziet in een demo en welke prompts je direct kunt gebruiken. Alle demo's werken met fictieve gegevens.`
      }),
      el('div', { className: 'filters' }, [
        el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Fase' }), phaseGroup]),
        el('div', { className: 'filters__row' }, [
          el('span', { className: 'filters__label', text: 'Toon' }),
          licenseGroup,
          el('div', { className: 'toggles toggles--compact', attrs: { role: 'group', 'aria-label': 'Extra filters' } }, [
            switchButton('Bewaard', 'bookmark', filters.saved, (on) => {
              filters.saved = on;
              update();
            }, savedCount)
          ]),
          count
        ]),
        sortGroup ? el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Volgorde' }), sortGroup]) : null
      ]),
      grid,
      empty
    ]);
    update();
    return { node, title: 'Usecases', destroy: stopSaved };
  }

  /* ---- Eén usecase --------------------------------------------------------------- */
  function renderDetail(id) {
    const usecase = ns.content.usecaseById.get(id);
    if (!usecase) return null;
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
      ]) : null,
      ns.reviews.block('usecase', usecase)
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
        el('div', { className: 'detail__title-row' }, [
          el('h1', { className: 'detail__title', text: usecase.title, attrs: { tabindex: '-1' } }),
          saveButton('usecase', usecase.id, usecase.title)
        ]),
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
