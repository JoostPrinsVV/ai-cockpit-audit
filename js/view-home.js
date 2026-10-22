/* ==========================================================================
   Startpagina (#/)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip } = ns.ui;

  function hero(config) {
    const input = el('input', {
      className: 'search__input',
      attrs: { id: 'home-search', type: 'search', name: 'q', placeholder: 'Zoek een usecase, prompt, tip, training of agent, bijv. "notulen"', autocomplete: 'off', enterkeyhint: 'search' }
    });
    const form = el('form', { className: 'search search--hero', attrs: { role: 'search', novalidate: true } }, [
      el('label', { className: 'sr-only', text: 'Zoeken op het hele platform', attrs: { for: 'home-search' } }),
      icon('search', { className: 'search__icon' }),
      input,
      el('button', { className: 'btn btn--primary search__submit', attrs: { type: 'submit' } }, [el('span', { text: 'Zoeken' })])
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = input.value.trim();
      window.location.hash = '#/zoeken' + (query ? '/' + encodeURIComponent(query) : '');
    });

    return el('section', { className: 'hero on-dark', attrs: { 'aria-labelledby': 'home-title' } }, [
      ns.instruments.rose(),
      el('div', { className: 'hero__inner container' }, [
        el('p', { className: 'hero__eyebrow', text: `${config.organizationName} · ${ns.cockpit.active().eyebrow}` }),
        el('h1', { className: 'hero__title', attrs: { id: 'home-title', tabindex: '-1' } }, [
          el('span', { text: config.applicationTitle + ' ' }),
          el('span', { className: 'hero__discipline', text: config.discipline })
        ]),
        config.tagline ? el('p', { className: 'hero__tagline', text: config.tagline }) : null,
        config.applicationSubtitle ? el('p', { className: 'hero__subtitle', text: config.applicationSubtitle }) : null,
        form
      ]),
      ns.instruments.heroTape()
    ]);
  }

  function tiles() {
    const c = ns.content;
    const withDemo = c.usecases.filter((u) => u.hasDemo).length;
    const items = [
      { href: '#/usecases', icon: 'play-circle', accent: 'crimson', title: 'Usecases', count: c.usecases.length, text: `Praktische toepassingen per fase van ${ns.cockpit.active().phases}, ${withDemo} met een demo.` },
      { href: '#/prompts', icon: 'chat', accent: 'teal', title: 'Promptdatabase', count: c.prompts.length, text: 'Direct te gebruiken prompts. Vul de plaatshouders in en kopieer.' },
      { href: '#/tips', icon: 'bulb', accent: 'steel', title: 'Tips & tricks', count: c.openTips.length, text: 'Iedere vrijdag een nieuwe tip, plus de basis: instructies, Facilitator en meer.' },
      { href: '#/trainingen', icon: 'cap', accent: 'deepteal', title: 'Trainingen', count: c.trainings.filter((t) => t.available).length || null, text: 'Opnames en naslagwerk van trainingen en sessies om terug te kijken.' },
      { href: '#/agents', icon: 'robot', accent: 'navy', title: 'Agents & tools', count: c.agents.filter((a) => !a.stopped).length || null, text: 'Welke AI-agents en tools er zijn, waarvoor je ze gebruikt en hoe je toegang krijgt.' },
      { href: '#/ideeen', icon: 'message-plus', accent: 'rose', title: 'Ideeënhub', count: null, text: 'Stuur een idee, vraag of verzoek in en zie wat collega\'s aandragen.' }
    ];
    return el('section', { className: 'section container', attrs: { 'aria-label': 'Onderdelen' } }, [
      el('ul', { className: 'tiles', attrs: { role: 'list' } }, items.map((item) =>
        el('li', { className: 'tiles__item' }, [
          el('a', { className: 'tile ' + ns.ui.accentClass(item.accent), attrs: { href: item.href } }, [
            el('span', { className: 'tile__icon', attrs: { 'aria-hidden': 'true' } }, [icon(item.icon)]),
            el('span', { className: 'tile__body' }, [
              el('span', { className: 'tile__title' }, [
                el('span', { text: item.title }),
                // Uitleesvenster met twee cijfers (09); een schermlezer hoort gewoon het getal
                item.count != null ? el('span', { className: 'tile__count' }, [
                  el('span', { text: String(item.count).padStart(2, '0'), attrs: { 'aria-hidden': 'true' } }),
                  el('span', { className: 'sr-only', text: String(item.count) })
                ]) : null
              ]),
              el('span', { className: 'tile__text', text: item.text })
            ]),
            el('span', { className: 'tile__go', attrs: { 'aria-hidden': 'true' } }, [icon('arrow-right')])
          ])
        ])
      ))
    ]);
  }

  function sectionHead(title, id, link) {
    return el('div', { className: 'section__head' }, [
      el('h2', { className: 'section__title', text: title, attrs: { id } }),
      link ? el('a', { className: 'section__link', attrs: { href: link.href } }, [el('span', { text: link.label }), icon('arrow-right')]) : null
    ]);
  }

  function featuredUsecases() {
    const items = ns.content.usecases.filter((u) => u.featured).slice(0, 4);
    if (!items.length) return null;
    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-featured' } }, [
      sectionHead('Uitgelichte usecases', 'home-featured', { href: '#/usecases', label: 'Alle usecases' }),
      el('ul', { className: 'card-grid' + (items.length === 4 ? ' card-grid--4' : ''), attrs: { role: 'list' } }, items.map((u) => el('li', {}, [ns.views.usecases.card(u, 'h3')])))
    ]);
  }

  function featuredTips() {
    const items = ns.content.openTips.filter((t) => t.featured);
    if (!items.length) return null;
    return el('section', { className: 'section section--band', attrs: { 'aria-labelledby': 'home-tips' } }, [
      el('div', { className: 'container' }, [
        sectionHead('In een paar minuten ingesteld', 'home-tips', { href: '#/tips', label: 'Alle tips & tricks' }),
        el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } }, items.map((t) => el('li', {}, [ns.views.tips.card(t, 'h3', true)])))
      ])
    ]);
  }

  /* ---- Lijstjes: één regel per item (bewaard, recent bekeken, favoriet, toegevoegd) ---- */
  const KIND = {
    usecase: { label: 'Usecase', href: '#/usecase/', icon: 'play-circle', map: 'usecaseById' },
    prompt: { label: 'Prompt', href: '#/prompt/', icon: 'chat', map: 'promptById' },
    tip: { label: 'Tip', href: '#/tip/', icon: 'bulb', map: 'tipById' },
    training: { label: 'Training', href: '#/training/', icon: 'cap', map: 'trainingById' },
    agent: { label: 'Agent', href: '#/agent/', icon: 'robot', map: 'agentById' }
  };
  const MIN_REVIEWS = 3; // 'Favoriet bij collega's' vanaf zoveel beoordelingen

  /** 'prompt:notulen' → { kind, item }; null als het item er niet (meer) is of op slot zit. */
  function resolve(key) {
    const split = key.indexOf(':');
    const kind = key.slice(0, split);
    const info = KIND[kind];
    const item = info ? ns.content[info.map].get(key.slice(split + 1)) : null;
    return item && !item.locked ? { kind, item } : null;
  }

  /** Eén regel: icoon, soort (eventueel met extra's), titel en pijltje. */
  function itemRow(kind, item, kicker) {
    const info = KIND[kind];
    return el('li', {}, [
      el('a', { className: 'recent__item ' + ns.ui.accentClass(item.accent), attrs: { href: info.href + item.id } }, [
        el('span', { className: 'recent__icon', attrs: { 'aria-hidden': 'true' } }, [icon(info.icon)]),
        el('span', { className: 'recent__body' }, [
          el('span', { className: 'recent__kind' }, kicker || [info.label]),
          el('span', { className: 'recent__title', text: item.title })
        ]),
        icon('arrow-right', { className: 'recent__go' })
      ])
    ]);
  }

  /** Voor jou: wat je bewaard hebt en wat je laatst bekeek (alleen in deze browser). */
  function personal() {
    const saved = ns.ui.saved.list().map(resolve).filter(Boolean).slice(0, 6);
    const viewed = ns.ui.viewed.list().map(resolve).filter(Boolean).slice(0, 4);
    if (!saved.length && !viewed.length) return null;
    const block = (title, id, iconName, entries, hint) => el('div', { className: 'personal__block', attrs: { role: 'group', 'aria-labelledby': id } }, [
      el('h2', { className: 'personal__title', attrs: { id } }, [icon(iconName), el('span', { text: title })]),
      entries.length
        ? el('ul', { className: 'recent recent--stack', attrs: { role: 'list' } }, entries.map((entry) => itemRow(entry.kind, entry.item)))
        : el('p', { className: 'personal__hint', text: hint })
    ]);
    return el('section', { className: 'section container personal', attrs: { 'aria-label': 'Voor jou' } }, [
      block('Jouw bewaarde items', 'home-saved', 'bookmark', saved, 'Zie je een prompt, usecase of tip die je vaker nodig hebt? Bewaar hem met de bladwijzer, dan staat hij hier.'),
      viewed.length ? block('Recent bekeken', 'home-viewed', 'clock', viewed) : null
    ]);
  }

  /** Favoriet bij collega's: de best beoordeelde prompts en usecases (verschijnt zodra er genoeg beoordelingen zijn). */
  function colleagues() {
    if (!ns.reviews.enabled()) return null;
    const list = el('ul', { className: 'recent', attrs: { role: 'list' } });
    const node = el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-rated', hidden: true } }, [
      sectionHead('Favoriet bij collega\'s', 'home-rated'),
      el('p', { className: 'section__lead', text: `Het best beoordeeld door collega's, vanaf ${MIN_REVIEWS} beoordelingen.` }),
      list
    ]);
    ns.reviews.stats().then((map) => {
      if (!map) return;
      const entries = ns.content.prompts.map((item) => ({ kind: 'prompt', item }))
        .concat(ns.content.usecases.map((item) => ({ kind: 'usecase', item })))
        .map((entry) => Object.assign(entry, { stats: map.get(entry.kind + ':' + entry.item.id) }))
        .filter((entry) => entry.stats && entry.stats.reviews >= MIN_REVIEWS)
        .sort((a, b) => b.stats.average - a.stats.average || b.stats.reviews - a.stats.reviews)
        .slice(0, 4);
      if (!entries.length) return;
      list.replaceChildren(...entries.map((entry) => itemRow(entry.kind, entry.item, [
        KIND[entry.kind].label + ' · ',
        el('span', { className: 'recent__stars', attrs: { 'aria-hidden': 'true' } }, [
          ns.reviews.starRow(entry.stats.average),
          ` ${ns.reviews.averageText(entry.stats.average)} (${entry.stats.reviews})`
        ]),
        el('span', { className: 'sr-only', text: `${ns.reviews.averageText(entry.stats.average)} gemiddeld uit ${entry.stats.reviews} beoordelingen` })
      ])));
      node.hidden = false;
    });
    return node;
  }

  function recent() {
    const entries = ns.content.recent(6);
    if (!entries.length) return null;
    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-recent' } }, [
      sectionHead('Recent toegevoegd', 'home-recent'),
      el('ul', { className: 'recent', attrs: { role: 'list' } }, entries.map((entry) =>
        itemRow(entry.kind, entry.item, [KIND[entry.kind].label + ' · ' + ns.ui.formatDate(entry.added)])
      ))
    ]);
  }

  function ideasCta() {
    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-ideas' } }, [
      el('div', { className: 'cta on-dark' }, [
        el('div', { className: 'cta__text' }, [
          el('h2', { className: 'cta__title', text: 'Mis je iets? Laat het weten.', attrs: { id: 'home-ideas' } }),
          el('p', { className: 'cta__lead', text: 'Een idee voor een usecase, een vraag over Copilot, een verzoek voor een demo of een prompt die je wilt delen: de ideeënhub is van ons allemaal.' }),
          el('ul', { className: 'chips', attrs: { role: 'list' } }, [
            el('li', {}, [chip('Idee', { icon: 'bulb', className: 'chip--dark' })]),
            el('li', {}, [chip('Vraag', { icon: 'question', className: 'chip--dark' })]),
            el('li', {}, [chip('Verzoek', { icon: 'flag', className: 'chip--dark' })]),
            el('li', {}, [chip('Prompt delen', { icon: 'chat', className: 'chip--dark' })])
          ])
        ]),
        el('a', { className: 'btn btn--primary btn--lg', attrs: { href: '#/ideeen' } }, [icon('message-plus'), el('span', { text: 'Naar de ideeënhub' })])
      ])
    ]);
  }

  function render(params, config) {
    const node = el('div', { className: 'home' }, [hero(config), tiles(), personal(), featuredUsecases(), colleagues(), featuredTips(), recent(), ideasCta()]);
    return { node, title: '' };
  }

  ns.views = ns.views || {};
  ns.views.home = { render };
})(window.AIAudit);
