/* ==========================================================================
   Usecases (#/usecases) en één usecase met demo (#/usecase/<id>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, emptyState, saveButton } = ns.ui;
  const B = ns.blocks;
  const { detailHeader, relatedList, itemLinks, stepsList, infoNote, tipCallout, warningList } = B;

  // Filters en volgorde blijven staan zolang de site open is
  const filters = { phase: 'all', license: 'all', saved: false, sort: 'default' };

  /**
   * Kaart voor een usecase (ook op de startpagina en bij zoeken). De hele kaart is klikbaar
   * via de titel; de bewaarknop ligt erboven.
   */
  function card(usecase, headingTag) {
    const meta = [];
    if (usecase.hasDemo) meta.push(el('span', { className: 'meta' }, [icon(usecase.video ? 'film' : 'play-circle'), el('span', { text: (usecase.duration ? usecase.duration + ' ' : '') + 'demo' })]));
    else meta.push(el('span', { className: 'meta meta--muted' }, [icon('clock'), el('span', { text: 'Demo volgt' })]));
    if (usecase.level) meta.push(el('span', { className: 'meta' }, [icon('sparkle'), el('span', { text: usecase.level })]));
    // Tijdwinst: de schatting van het AI-team (js/tijdwinst.js)
    if (usecase.saves) meta.push(el('span', { className: 'meta meta--saves', attrs: { title: 'Schatting van het AI-team, per keer dat je de usecase doorloopt' } }, [icon('clock'), el('span', { text: 'Scheelt ±' + ns.tijdwinst.format(usecase.saves) })]));
    const rating = ns.reviews.ratingChip('usecase', usecase.id);
    if (rating) meta.push(rating);

    return el('article', { className: 'uc-card ' + accentClass(usecase.accent), dataset: { kind: 'usecase', id: usecase.id } }, [
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
    const list = el('div', { className: 'p-list' });
    const count = B.resultCount();
    // Een lege catalogus (nieuwe discipline) is iets anders dan niets vinden met deze filters
    const empty = all.length
      ? emptyState('Geen usecases met deze filters', 'Kies een andere fase of zet de filters terug op Alle.')
      : emptyState('De eerste usecases komen eraan', `Hier verschijnen de usecases voor Copilot in ${ns.cockpit.active().label}, met een demo en de prompts erbij.`, null, 'play-circle');
    // Onder een tussenkop (seizoen en de rest) is de titel van een kaart een h3
    const cardFor = B.cardCache((u, variant) => card(u, variant ? 'h3' : 'h2'));
    const grid = (items, variant) => el('ul', { className: 'card-grid', attrs: { role: 'list' } }, items.map((u) => cardFor(u, variant)));
    const saved = B.savedFilter('usecase', filters, update, (id) => ns.content.usecaseById.has(id));
    // De fasen van wat nu speelt (seizoenskompas): die usecases bovenaan, uitgelicht
    const now = ns.compass.nowPhases(ns.app.config());
    const seasonRank = (u) => now.findIndex((entry) => entry.phase === u.phase);

    function update() {
      const savedIds = saved.ids();
      let items = all.filter((u) =>
        (filters.phase === 'all' || u.phase.id === filters.phase) &&
        B.licenseMatch(filters.license, u.license) &&
        (!filters.saved || savedIds.includes(u.id))
      );
      if (filters.sort === 'rating') items = ns.reviews.rank(items, 'usecase');
      // Alle fasen in de gewone volgorde: eerst die van het seizoen (zijn het alle usecases, dan geen tweedeling)
      const seasonal = filters.phase === 'all' && filters.sort !== 'rating' ? items.filter((u) => seasonRank(u) >= 0) : [];
      if (!seasonal.length || seasonal.length === items.length) {
        list.replaceChildren(grid(items, ''));
      } else {
        seasonal.sort((a, b) => seasonRank(a) - seasonRank(b));
        const rest = items.filter((u) => seasonRank(u) < 0);
        const phases = now.filter((entry) => seasonal.some((u) => u.phase === entry.phase));
        const seasons = Array.from(new Set(phases.map((entry) => entry.season.title)));
        list.replaceChildren(
          el('section', { className: 'p-group is-season ' + accentClass(phases[0].phase.accent), attrs: { 'aria-labelledby': 'uc-season' } }, [
            el('div', { className: 'p-group__head' }, [
              el('h2', { className: 'p-group__title', attrs: { id: 'uc-season' } }, [
                el('span', { className: 'p-group__icon', attrs: { 'aria-hidden': 'true' } }, [icon(phases[0].phase.icon)]),
                el('span', {}, [phases.map((entry) => entry.phase.label).join(' en ') + ' ', el('span', { className: 'p-group__count', text: String(seasonal.length) })])
              ]),
              ns.compass.badge(seasons)
            ]),
            grid(seasonal, 'seizoen')
          ]),
          el('section', { className: 'p-group', attrs: { 'aria-labelledby': 'uc-rest' } }, [
            el('h2', { className: 'p-group__title', attrs: { id: 'uc-rest' } }, [el('span', {}, ['Alle andere usecases ', el('span', { className: 'p-group__count', text: String(rest.length) })])]),
            grid(rest, 'rest')
          ])
        );
      }
      count.textContent = B.countText(items.length, 'usecase', 'usecases');
      empty.hidden = items.length > 0;
      list.hidden = items.length === 0;
    }
    const stopSaved = saved.watch(list);
    // De gemiddelden komen later binnen: dan de kaarten opnieuw bouwen (met de sterren erop)
    ns.reviews.whenLoaded(() => {
      if (!list.isConnected) return;
      cardFor.reset();
      update();
    });
    const sort = B.ratingSort(filters, update, { value: 'default', label: 'Standaard' });

    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Usecases',
        title: `Copilot in de praktijk van ${ns.cockpit.active().label}`,
        lead: `Per fase van ${ns.cockpit.active().phases}: wat je met Copilot kunt doen, hoe het eruitziet in een demo en welke prompts je direct kunt gebruiken. Alle demo's werken met fictieve gegevens.`
      }),
      el('div', { className: 'filters' }, [
        B.filterRow('Fase', B.phaseFilter(all, filters, update)),
        B.filterRow('Toon', B.licenseFilter(filters, update), B.extraFilters(saved.button), count),
        sort ? B.filterRow('Volgorde', sort) : null
      ]),
      list,
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

    const main = el('div', { className: 'detail__main' }, [
      player.node,
      usecase.intro ? el('p', { className: 'detail__intro', text: usecase.intro }) : null,
      usecase.steps.length ? el('section', { className: 'block', attrs: { 'aria-labelledby': 'uc-steps' } }, [
        el('h2', { className: 'block__title', text: 'Zo pak je het aan', attrs: { id: 'uc-steps' } }),
        stepsList(usecase.steps)
      ]) : null,
      warningList('uc-watch', 'Let op', usecase.watchOut),
      ns.reviews.block('usecase', usecase)
    ]);

    const promptBoxes = usecase.prompts.map((prompt, index) =>
      ns.promptBox.create({
        text: prompt.text,
        label: prompt.label,
        collapsed: true,
        onCopy: () => ns.central.track('copy_prompt', usecase.promptIds[index] || usecase.id),
        improve: ns.improve.target('usecase', usecase, { field: 'prompts', index, label: prompt.label })
      })
    );

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
        infoNote(usecase.promptNote),
        tipCallout(usecase.tip)
      ]),
      // Bij je eigen klant inzetten: de AI-specialist invliegen (js/specialist.js)
      ns.specialist.card({ usecase }),
      relatedList('uc-related', 'Handige tips hierbij', itemLinks('tip', usecase.relatedTips, true))
    ]);

    const node = el('article', { className: 'page container detail ' + accentClass(usecase.accent) }, [
      detailHeader({
        back: ['#/usecases', 'Alle usecases'],
        icon: usecase.phase.icon,
        eyebrow: usecase.phase.label,
        title: usecase.title,
        save: ['usecase', usecase.id],
        subtitle: usecase.subtitle,
        chips: [
          licenseBadge(usecase.license),
          ...usecase.tools.map((tool) => chip(tool, { icon: 'robot' })),
          usecase.level ? chip(usecase.level, { icon: 'sparkle' }) : null,
          usecase.hasDemo && usecase.duration ? chip(usecase.duration + ' demo', { icon: 'film' }) : null,
          ns.tijdwinst.chip(usecase, { usecase: true }),
          newBadge(usecase.added)
        ]
      }),
      el('div', { className: 'detail__layout' }, [main, aside])
    ]);
    return { node, title: usecase.title, destroy: player.destroy };
  }

  ns.views = ns.views || {};
  ns.views.usecases = { renderList, renderDetail, card };
})(window.AIAudit);
