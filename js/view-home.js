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
      el('div', { className: 'hero__inner container' }, [
        el('p', { className: 'hero__eyebrow', text: `${config.organizationName} · Copilot in de controlepraktijk` }),
        el('h1', { className: 'hero__title', attrs: { id: 'home-title', tabindex: '-1' } }, [
          el('span', { text: config.applicationTitle + ' ' }),
          el('span', { className: 'hero__discipline', text: config.discipline })
        ]),
        config.tagline ? el('p', { className: 'hero__tagline', text: config.tagline }) : null,
        config.applicationSubtitle ? el('p', { className: 'hero__subtitle', text: config.applicationSubtitle }) : null,
        form
      ]),
      el('div', { className: 'awning-edge', attrs: { 'aria-hidden': 'true' } })
    ]);
  }

  function tiles() {
    const c = ns.content;
    const withDemo = c.usecases.filter((u) => u.hasDemo).length;
    const items = [
      { href: '#/usecases', icon: 'play-circle', accent: 'crimson', title: 'Usecases', count: c.usecases.length, text: `Praktische toepassingen per fase van de controle, ${withDemo} met een demo.` },
      { href: '#/prompts', icon: 'chat', accent: 'teal', title: 'Promptdatabase', count: c.prompts.length, text: 'Direct te gebruiken prompts. Vul de plaatshouders in en kopieer.' },
      { href: '#/tips', icon: 'bulb', accent: 'steel', title: 'Tips & tricks', count: c.openTips.length, text: 'Iedere vrijdag een nieuwe tip, plus de basis: instructies, Facilitator en meer.' },
      { href: '#/trainingen', icon: 'cap', accent: 'deepteal', title: 'Trainingen', count: c.trainings.filter((t) => t.hasRecording).length || null, text: 'Opnames van trainingen en sessies om terug te kijken.' },
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
                item.count != null ? el('span', { className: 'tile__count', text: String(item.count) }) : null
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

  function recent() {
    const entries = ns.content.recent(6);
    if (!entries.length) return null;
    const kindLabel = { usecase: 'Usecase', prompt: 'Prompt', tip: 'Tip', training: 'Training', agent: 'Agent' };
    const hrefFor = { usecase: '#/usecase/', prompt: '#/prompt/', tip: '#/tip/', training: '#/training/', agent: '#/agent/' };
    const iconFor = { usecase: 'play-circle', prompt: 'chat', tip: 'bulb', training: 'cap', agent: 'robot' };
    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-recent' } }, [
      sectionHead('Recent toegevoegd', 'home-recent'),
      el('ul', { className: 'recent', attrs: { role: 'list' } }, entries.map((entry) =>
        el('li', {}, [
          el('a', { className: 'recent__item ' + ns.ui.accentClass(entry.item.accent), attrs: { href: hrefFor[entry.kind] + entry.item.id } }, [
            el('span', { className: 'recent__icon', attrs: { 'aria-hidden': 'true' } }, [icon(iconFor[entry.kind])]),
            el('span', { className: 'recent__body' }, [
              el('span', { className: 'recent__kind', text: kindLabel[entry.kind] + ' · ' + ns.ui.formatDate(entry.added) }),
              el('span', { className: 'recent__title', text: entry.item.title })
            ]),
            icon('arrow-right', { className: 'recent__go' })
          ])
        ])
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
    const node = el('div', { className: 'home' }, [hero(config), tiles(), featuredUsecases(), featuredTips(), recent(), ideasCta()]);
    return { node, title: '' };
  }

  ns.views = ns.views || {};
  ns.views.home = { render };
})(window.AIAudit);
