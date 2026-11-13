/* ==========================================================================
   Startpagina (#/)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon } = ns.ui;
  // Vaste teksten die een beheerder in de bewerkmodus kan aanpassen (js/layout.js)
  const edit = (node, key, fallback, label, multiline) => ns.layout.editable(node, key, fallback, { label, multiline });

  /** radar: wat nieuw is sinds je vorige bezoek (js/radar.js), op de roos en als strook onder het zoekvak. */
  function hero(config, radar) {
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

    // Met je naam uit Mijn gegevens: eerst een begroeting
    const first = ns.profile.firstName();
    const hour = new Date().getHours();
    const greeting = first ? `${hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'}, ${first} · ` : '';
    const rose = ns.instruments.rose({ blips: ns.radar.blips(radar.list) });
    // Gezien: de stipjes van de roos halen en de focus terug op het zoekvak (de knop is weg)
    const strip = ns.radar.strip(radar, () => {
      const layer = rose.querySelector('.rose__radar');
      if (layer) layer.remove();
      input.focus();
    });
    return el('section', { className: 'hero on-dark', attrs: { 'aria-labelledby': 'home-title' } }, [
      rose,
      el('div', { className: 'hero__inner container' }, [
        el('p', { className: 'hero__eyebrow', text: `${greeting}${config.organizationName} · ${ns.cockpit.active().eyebrow}` }),
        el('h1', { className: 'hero__title', attrs: { id: 'home-title', tabindex: '-1' } }, [
          el('span', { text: config.applicationTitle + ' ' }),
          el('span', { className: 'hero__discipline', text: config.discipline })
        ]),
        config.tagline ? el('p', { className: 'hero__tagline', text: config.tagline }) : null,
        config.applicationSubtitle ? el('p', { className: 'hero__subtitle', text: config.applicationSubtitle }) : null,
        form,
        strip
      ]),
      ns.instruments.heroTape()
    ]);
  }

  function tiles() {
    const c = ns.content;
    const withDemo = c.usecases.filter((u) => u.hasDemo).length;
    const items = [
      { key: 'usecases', href: '#/usecases', icon: 'play-circle', accent: 'crimson', title: 'Usecases', count: c.usecases.length, text: `Praktische toepassingen per fase van ${ns.cockpit.active().phases}, ${withDemo} met een demo.` },
      { key: 'prompts', href: '#/prompts', icon: 'chat', accent: 'teal', title: 'Promptdatabase', count: c.prompts.length, text: 'Direct te gebruiken prompts. Vul de plaatshouders in en kopieer.' },
      { key: 'tips', href: '#/tips', icon: 'bulb', accent: 'steel', title: 'Tips & tricks', count: c.openTips.length, text: 'Iedere vrijdag een nieuwe tip, plus de basis: instructies, Facilitator en meer.' },
      { key: 'trainingen', href: '#/trainingen', icon: 'cap', accent: 'deepteal', title: 'Trainingen', count: c.trainings.filter((t) => t.available).length || null, text: 'Opnames en naslagwerk van trainingen en sessies om terug te kijken.' },
      { key: 'agents', href: '#/agents', icon: 'robot', accent: 'navy', title: 'Agents & tools', count: c.agents.filter((a) => !a.stopped).length || null, text: 'Welke AI-agents en tools er zijn, waarvoor je ze gebruikt en hoe je toegang krijgt.' },
      { key: 'ideeen', href: '#/ideeen', icon: 'message-plus', accent: 'rose', title: 'Ideeënhub', count: null, text: 'Stuur een idee, vraag of verzoek in en zie wat collega\'s aandragen.' }
    ];
    return el('section', { className: 'section container', attrs: { 'aria-label': 'Onderdelen' } }, [
      el('ul', { className: 'tiles', attrs: { role: 'list' } }, items.map((item) =>
        el('li', { className: 'tiles__item' }, [
          el('a', { className: 'tile ' + ns.ui.accentClass(item.accent), attrs: { href: item.href } }, [
            el('span', { className: 'tile__icon', attrs: { 'aria-hidden': 'true' } }, [icon(item.icon)]),
            el('span', { className: 'tile__body' }, [
              el('span', { className: 'tile__title' }, [
                edit(el('span'), 'home.tegel.' + item.key + '.titel', item.title, 'Titel van de tegel'),
                // Uitleesvenster met twee cijfers (09); een schermlezer hoort gewoon het getal
                item.count != null ? el('span', { className: 'tile__count' }, [
                  el('span', { text: String(item.count).padStart(2, '0'), attrs: { 'aria-hidden': 'true' } }),
                  el('span', { className: 'sr-only', text: String(item.count) })
                ]) : null
              ]),
              edit(el('span', { className: 'tile__text' }), 'home.tegel.' + item.key + '.tekst', item.text, 'Tekst van de tegel', true)
            ]),
            el('span', { className: 'tile__go', attrs: { 'aria-hidden': 'true' } }, [icon('arrow-right')])
          ])
        ])
      ))
    ]);
  }

  function sectionHead(title, id, link) {
    return el('div', { className: 'section__head' }, [
      edit(el('h2', { className: 'section__title', attrs: { id } }), 'home.' + id + '.titel', title, 'Kop'),
      link ? el('a', { className: 'section__link', attrs: { href: link.href } }, [edit(el('span'), 'home.' + id + '.link', link.label, 'Linktekst'), icon('arrow-right')]) : null
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
  const MIN_REVIEWS = 3; // 'Favoriet bij collega's' vanaf zoveel beoordelingen

  /** 'prompt:notulen' → { kind, item }; null als het item er niet (meer) is of op slot zit. */
  function resolve(key) {
    const split = key.indexOf(':');
    const kind = key.slice(0, split);
    const item = ns.kinds.item(kind, key.slice(split + 1));
    return item && !item.locked ? { kind, item } : null;
  }

  /** Eén regel: icoon, soort (eventueel met extra's), titel en pijltje. */
  function itemRow(kind, item, kicker) {
    const info = ns.kinds.get(kind);
    return el('li', {}, [
      el('a', { className: 'recent__item ' + ns.ui.accentClass(item.accent), attrs: { href: ns.kinds.href(kind, item.id) }, dataset: { kind, id: item.id } }, [
        el('span', { className: 'recent__icon', attrs: { 'aria-hidden': 'true' } }, [icon(info.icon)]),
        el('span', { className: 'recent__body' }, [
          el('span', { className: 'recent__kind' }, kicker || [info.label]),
          el('span', { className: 'recent__title', text: item.title }),
          // Een agent in testfase: ook hier zichtbaar dat hij nog niet geaccepteerd is (js/agent-test.js)
          kind === 'agent' && item.testing ? el('span', { className: 'status status--test recent__test' }, [icon('flask'), el('span', { text: 'Testfase' })]) : null
        ].filter(Boolean)),
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
      edit(el('p', { className: 'section__lead' }), 'home.home-rated.inleiding', `Het best beoordeeld door collega's, vanaf ${MIN_REVIEWS} beoordelingen.`, 'Inleiding', true),
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
        ns.kinds.label(entry.kind) + ' · ',
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

  /** radar: wat nieuw is voor jou (js/radar.js); dat krijgt hier een rood bolletje, net als de stipjes op de roos. */
  function recent(radar) {
    const entries = ns.content.recent(6);
    if (!entries.length) return null;
    const fresh = new Set(radar.list.map((entry) => entry.key));
    const label = radar.first ? 'Nieuw' : 'Nieuw sinds je vorige bezoek';
    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-recent' } }, [
      sectionHead('Recent toegevoegd', 'home-recent'),
      el('ul', { className: 'recent', attrs: { role: 'list' } }, entries.map((entry) =>
        itemRow(entry.kind, entry.item, [
          fresh.has(entry.kind + ':' + entry.item.id) ? el('span', { className: 'recent__new', attrs: { title: label } }) : null,
          fresh.has(entry.kind + ':' + entry.item.id) ? el('span', { className: 'sr-only', text: label + ': ' }) : null,
          ns.kinds.label(entry.kind) + ' · ' + ns.ui.formatDate(entry.added)
        ])
      ))
    ]);
  }

  function ideasCta() {
    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-ideas' } }, [
      el('div', { className: 'cta on-dark' }, [
        el('div', { className: 'cta__text' }, [
          edit(el('h2', { className: 'cta__title', attrs: { id: 'home-ideas' } }), 'home.ideeen.titel', 'Mis je iets? Laat het weten.', 'Kop'),
          edit(el('p', { className: 'cta__lead' }), 'home.ideeen.tekst', 'Een idee voor een usecase, een vraag over Copilot, een verzoek voor een demo of een prompt die je wilt delen: de ideeënhub is van ons allemaal.', 'Tekst', true),
          // Een klantcasus: de AI-specialist invliegen (js/specialist.js)
          el('p', { className: 'cta__flyin' }, [
            edit(el('span'), 'home.ideeen.specialist', 'Klantcasus waarbij je wilt weten wat Copilot kan?', 'Tekst'),
            el('button', { className: 'cta__flyin-button', attrs: { type: 'button', 'aria-haspopup': 'dialog' }, on: { click: () => ns.specialist.open() } }, [icon('plane'), el('span', { text: 'AI-specialist invliegen' }), icon('arrow-right')])
          ])
        ]),
        // Rustig omlijnd: de opvallendste kleur is voor de hoofdactie van een pagina (zoeken, kopiëren)
        el('a', { className: 'btn btn--ghost-dark btn--lg', attrs: { href: '#/ideeen' } }, [icon('message-plus'), edit(el('span'), 'home.ideeen.knop', 'Naar de ideeënhub', 'Knoptekst')])
      ])
    ]);
  }

  function render(params, config) {
    // 'Voor jou' werkt zichzelf bij als je hier iets bewaart (bij een uitgelichte usecase of tip)
    const mineOrMark = () => personal() || document.createComment('voor jou');
    let mine = mineOrMark();
    const stopSaved = ns.ui.onSaved(null, null, () => {
      const next = mineOrMark();
      mine.replaceWith(next);
      mine = next;
    });
    // Seizoenskompas (js/compass.js): wat er nu speelt, met dezelfde regels als 'Recent toegevoegd'
    const compass = ns.compass.section(config, itemRow);
    const radar = ns.radar.fresh();
    // De Kickstart (js/kickstart.js) en, zodra het er is, de tijdwinst van alle collega's (js/tijdwinst.js)
    const kickstart = ns.kickstart.card({ place: 'home' });
    const proof = el('div', { className: 'container tw-proof-wrap' }, [ns.tijdwinst.proof()]);
    // Cockpit Wrapped (js/wrapped.js): zolang het AI-team hem op de startpagina laat staan.
    // 'Recent toegevoegd' direct onder het kompas: wat nieuw is hoort bij wat er nu speelt, niet onderaan.
    // De secties onder de hero: een beheerder zet ze in de bewerkmodus in een andere volgorde of verbergt ze (js/layout.js)
    const node = el('div', { className: 'home' }, [hero(config, radar)].concat(ns.layout.arrange('home', [
      { key: 'tegels', label: 'Tegels naar de onderdelen', node: tiles() },
      { key: 'wrapped', label: 'Cockpit Wrapped', node: ns.wrapped.teaser() },
      // Open Cockpit (js/opencockpit.js): alleen in de week voor een sessie
      { key: 'opencockpit', label: 'Open Cockpit (in de week voor een sessie)', node: ns.openCockpit.teaser() },
      { key: 'tijdwinst', label: 'Tijdwinst van collega\'s', node: proof },
      { key: 'kickstart', label: 'Kickstart', node: kickstart.node },
      { key: 'kompas', label: 'Seizoenskompas', node: compass },
      { key: 'recent', label: 'Recent toegevoegd', node: recent(radar) },
      { key: 'voor-jou', label: 'Voor jou (bewaard en bekeken)', node: mine },
      { key: 'usecases', label: 'Uitgelichte usecases', node: featuredUsecases() },
      { key: 'favoriet', label: 'Favoriet bij collega\'s', node: colleagues() },
      // Standaard uit: dezelfde tips staan bovenaan Tips & tricks ('Begin hier'), en de startpagina is al lang.
      // Een beheerder zet de sectie in de bewerkmodus aan met het oogje.
      { key: 'tips', label: 'Uitgelichte tips', node: featuredTips(), optional: true },
      { key: 'ideeen', label: 'Oproep ideeënhub', node: ideasCta() }
    ])));
    // Eerste bezoek: de rondleiding (js/tour.js), even na het opstarten van de instrumenten
    ns.tour.maybeStart();
    return {
      node,
      title: '',
      destroy: () => {
        stopSaved();
        kickstart.destroy();
      }
    };
  }

  ns.views = ns.views || {};
  ns.views.home = { render };
})(window.AIAudit);
