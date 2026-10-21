/* ==========================================================================
   Tips & tricks (#/tips) en één tip (#/tip/<id>)
   --------------------------------------------------------------------------
   Tip van de week: een tip met 'release' (data/tips.js) zit op slot tot die
   vrijdag. Bovenaan de pagina staan de tip van deze week en een blok met
   een slotje voor volgende week. Dichte tips staan verder nergens (niet in
   zoeken, niet bij usecases); via een directe link zie je een slotpagina.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, formatDate } = ns.ui;

  // Gekozen thema blijft staan zolang de pagina open is
  const filters = { category: 'all' };

  /** 'vrijdag 30 oktober' */
  function longDate(date) {
    try {
      return new Date(date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (error) {
      return formatDate(date);
    }
  }

  /** 'morgen' of 'over 3 dagen' */
  function countdown(date) {
    const days = ns.content.daysUntil(date);
    return days <= 1 ? 'morgen' : `over ${days} dagen`;
  }

  function weekBadge(tip) {
    return tip.weekly ? el('span', { className: 'badge badge--week', attrs: { title: 'Tip van de week van ' + longDate(tip.release) } }, [icon('calendar'), formatDate(tip.release).replace(/ \d{4}$/, '')]) : null;
  }

  /** Kaart voor een tip. large = uitgelichte variant. eyebrow = andere bovenregel (bijv. 'Deze week'). */
  function card(tip, headingTag, large, eyebrow) {
    return el('a', { className: 'tip-card ' + accentClass(tip.accent) + (large ? ' tip-card--large' : ''), attrs: { href: '#/tip/' + tip.id } }, [
      el('div', { className: 'tip-card__top' }, [
        el('span', { className: 'tip-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon(tip.icon)]),
        el('div', { className: 'tip-card__badges' }, [ns.ui.draftBadge(tip), weekBadge(tip), tip.weekly ? null : newBadge(tip.added), licenseBadge(tip.license, { short: true })])
      ]),
      el('p', { className: 'tip-card__category', text: eyebrow || tip.category.label }),
      el(headingTag || 'h3', { className: 'tip-card__title', text: tip.title }),
      el('p', { className: 'tip-card__summary', text: tip.summary }),
      el('div', { className: 'tip-card__footer' }, [
        tip.minutes ? el('span', { className: 'meta' }, [icon('clock'), el('span', { text: tip.minutes })]) : el('span'),
        el('span', { className: 'meta meta--strong' }, [el('span', { text: large && !tip.weekly ? 'Zo stel je het in' : 'Lees de tip' }), icon('arrow-right')])
      ])
    ]);
  }

  /** Blok voor de volgende tip: slotje, datum en (als teaser) alleen het thema. */
  function lockedCard(tip, headingTag) {
    return el('div', { className: 'tip-card tip-card--locked', attrs: { role: 'group', 'aria-label': `Volgende tip, op slot tot ${longDate(tip.release)}` } }, [
      el('div', { className: 'tip-card__top' }, [
        el('span', { className: 'tip-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon('lock')]),
        el('div', { className: 'tip-card__badges' }, [el('span', { className: 'badge badge--lock' }, [icon('clock'), 'Open ' + countdown(tip.release)])])
      ]),
      el('p', { className: 'tip-card__category', text: 'Volgende tip · ' + tip.category.label }),
      el(headingTag || 'h3', { className: 'tip-card__title', text: longDate(tip.release).replace(/^./, (c) => c.toUpperCase()) }),
      el('div', { className: 'tip-card__veil', attrs: { 'aria-hidden': 'true' } }, [el('span'), el('span'), el('span')]),
      el('p', { className: 'tip-card__summary', text: 'Dan gaat de volgende tip van het slot. Kom vrijdag terug!' })
    ]);
  }

  function weeklySection() {
    const { currentWeeklyTip: current, nextWeeklyTip: next } = ns.content;
    if (!current && !next) return null;
    // Langer dan een week geleden en niets meer gepland: dan is het niet meer 'deze week'
    const stale = current && !next && ns.content.daysUntil(current.release) <= -7;
    const lead = !current
      ? `De eerste tip van de week gaat open op ${longDate(next.release)}. Daarna iedere vrijdag een nieuwe.`
      : next
        ? 'Iedere vrijdag gaat er een nieuwe tip van het slot. Gemist? Bij Alle tips lees je ze allemaal terug.'
        : 'Alle geplande tips van de week zijn open. Bij Alle tips lees je ze terug; nieuwe tips volgen.';
    const currentLabel = (stale ? 'Laatste tip van de week · ' : 'Deze week · ') + (current ? current.category.label : '');
    return el('section', { className: 'section section--flush', attrs: { 'aria-labelledby': 'tips-week' } }, [
      el('h2', { className: 'section__title', text: 'Tip van de week', attrs: { id: 'tips-week' } }),
      el('p', { className: 'section__lead', text: lead }),
      el('ul', { className: 'weekly', attrs: { role: 'list' } }, [
        current ? el('li', {}, [card(current, 'h3', true, currentLabel)]) : null,
        next ? el('li', {}, [lockedCard(next, 'h3')]) : null
      ])
    ]);
  }

  /* ---- Overzicht ---------------------------------------------------------------- */
  function renderList() {
    // Alleen tips die open zijn: eerst de tips van de week (nieuwste bovenaan), dan de rest in vaste volgorde.
    const open = ns.content.openTips;
    const all = open.filter((tip) => tip.weekly).sort((a, b) => (a.release < b.release ? 1 : -1)).concat(open.filter((tip) => !tip.weekly));
    const featured = open.filter((t) => t.featured);
    const grid = el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } });
    const count = el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });

    function update() {
      const items = all.filter((tip) => filters.category === 'all' || tip.category.label === filters.category);
      grid.replaceChildren(...items.map((tip) => el('li', {}, [card(tip, 'h3')])));
      count.textContent = items.length === 1 ? '1 tip' : items.length + ' tips';
    }

    const categories = ns.content.tipCategories
      .map((category) => ({ value: category.label, label: category.label, accent: category.accent, count: all.filter((tip) => tip.category === category).length }))
      .filter((item) => item.count > 0);
    if (filters.category !== 'all' && !categories.some((item) => item.value === filters.category)) filters.category = 'all';
    const themeGroup = toggleGroup('Filter op thema', [{ value: 'all', label: 'Alle thema\'s', count: all.length }].concat(categories), filters.category, (value) => {
      filters.category = value;
      update();
    });

    const weekly = weeklySection();
    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Tips & tricks',
        title: 'Slimmer werken met Copilot',
        lead: 'Korte handleidingen voor de functies die het verschil maken. Iedere vrijdag komt er een nieuwe tip bij.'
      }),
      weekly,
      featured.length ? el('section', { className: weekly ? 'section' : 'section section--flush', attrs: { 'aria-labelledby': 'tips-featured' } }, [
        el('h2', { className: 'section__title', text: 'Begin hier', attrs: { id: 'tips-featured' } }),
        el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } }, featured.map((tip) => el('li', {}, [card(tip, 'h3', true)])))
      ]) : null,
      el('section', { className: 'section', attrs: { 'aria-labelledby': 'tips-all' } }, [
        el('h2', { className: 'section__title', text: 'Alle tips', attrs: { id: 'tips-all' } }),
        el('div', { className: 'filters' }, [
          el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Thema' }), themeGroup, count])
        ]),
        grid
      ])
    ]);
    update();
    return { node, title: 'Tips & tricks' };
  }

  /* ---- Tip die nog op slot zit (directe link) --------------------------------------- */
  function renderLocked(tip) {
    const node = el('div', { className: 'page container detail detail--narrow' }, [
      el('a', { className: 'btn btn--back btn--sm', attrs: { href: '#/tips' } }, [icon('arrow-left'), el('span', { text: 'Alle tips & tricks' })]),
      el('div', { className: 'lock-page' }, [
        el('span', { className: 'lock-page__icon', attrs: { 'aria-hidden': 'true' } }, [icon('lock')]),
        el('p', { className: 'lock-page__eyebrow', text: 'Tip van de week · ' + tip.category.label }),
        el('h1', { className: 'lock-page__title', text: 'Deze tip zit nog op slot', attrs: { tabindex: '-1' } }),
        el('p', { className: 'lock-page__text', text: `Hij gaat open op ${longDate(tip.release)} (${countdown(tip.release)}). Tot die tijd kun je alle tips lezen die al open zijn.` }),
        el('a', { className: 'btn btn--primary', attrs: { href: '#/tips' } }, [icon('bulb'), el('span', { text: 'Naar de tips' })])
      ])
    ]);
    return { node, title: 'Op slot' };
  }

  /* ---- Eén tip -------------------------------------------------------------------- */
  function renderDetail(id) {
    const tip = ns.content.tipById.get(id);
    if (!tip) return null;
    if (tip.locked) return renderLocked(tip);
    ns.central.track('view_tip', tip.id);
    const usecases = tip.usecases.map((uid) => ns.content.usecaseById.get(uid)).filter(Boolean);
    const others = tip.category.tips.filter((t) => t !== tip && !t.locked);

    const node = el('article', { className: 'page container detail detail--narrow ' + accentClass(tip.accent) }, [
      el('header', { className: 'detail__header' }, [
        el('a', { className: 'btn btn--back btn--sm', attrs: { href: '#/tips' } }, [icon('arrow-left'), el('span', { text: 'Alle tips & tricks' })]),
        el('p', { className: 'detail__eyebrow' }, [icon(tip.icon), el('span', { text: tip.weekly ? `Tip van de week · ${tip.category.label}` : tip.category.label })]),
        el('h1', { className: 'detail__title', text: tip.title, attrs: { tabindex: '-1' } }),
        tip.summary ? el('p', { className: 'detail__subtitle', text: tip.summary }) : null,
        el('div', { className: 'chips' }, [
          tip.weekly ? chip('Vrijdag ' + formatDate(tip.release), { icon: 'calendar' }) : null,
          licenseBadge(tip.license),
          tip.minutes ? chip(tip.minutes + ' om in te stellen', { icon: 'clock' }) : null,
          newBadge(tip.added)
        ].filter(Boolean))
      ]),
      tip.why ? el('section', { className: 'why', attrs: { 'aria-labelledby': 'tip-why' } }, [
        el('h2', { className: 'why__title', attrs: { id: 'tip-why' } }, [icon('sparkle'), el('span', { text: 'Waarom handig in de audit' })]),
        el('p', { text: tip.why })
      ]) : null,
      el('section', { className: 'block', attrs: { 'aria-labelledby': 'tip-steps' } }, [
        el('h2', { className: 'block__title', text: 'Zo doe je het', attrs: { id: 'tip-steps' } }),
        el('ol', { className: 'steps steps--large', attrs: { role: 'list' } }, tip.steps.map((step, index) =>
          el('li', { className: 'steps__item' }, [el('span', { className: 'steps__number', text: String(index + 1) }), el('span', { text: step })])
        ))
      ]),
      tip.example ? ns.promptBox.create({ text: tip.example.text, label: tip.example.label, headingTag: 'h2', copyLabel: 'Kopieer', onCopy: () => ns.central.track('copy_tip', tip.id) }) : null,
      tip.note ? el('p', { className: 'takeaway__note' }, [icon('info'), el('span', { text: tip.note })]) : null,
      usecases.length ? el('section', { className: 'section section--tight', attrs: { 'aria-labelledby': 'tip-usecases' } }, [
        el('h2', { className: 'section__title', text: 'Zie het in de praktijk', attrs: { id: 'tip-usecases' } }),
        el('ul', { className: 'card-grid card-grid--2', attrs: { role: 'list' } }, usecases.map((u) => el('li', {}, [ns.views.usecases.card(u, 'h3')])))
      ]) : null,
      others.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'tip-more' } }, [
        el('h2', { className: 'related__title', text: 'Meer over ' + tip.category.label.toLowerCase(), attrs: { id: 'tip-more' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, others.map((t) =>
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: '#/tip/' + t.id } }, [icon(t.icon), el('span', { text: t.title }), icon('arrow-right', { className: 'related__go' })])])
        ))
      ]) : null
    ]);
    return { node, title: tip.title };
  }

  ns.views = ns.views || {};
  ns.views.tips = { renderList, renderDetail, card };
})(window.AIAudit);
