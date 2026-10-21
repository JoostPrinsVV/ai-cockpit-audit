/* ==========================================================================
   Trainingen (#/trainingen) en één training met opname (#/training/<id>)
   --------------------------------------------------------------------------
   Een opname staat bij voorkeur in Stream/SharePoint ('link': opent in een
   nieuw tabblad, Microsoft 365 regelt de toegang). Een korte MP4 ('video')
   speelt hier af; hoofdstukken springen dan naar het juiste moment.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, formatDate } = ns.ui;
  const filters = { category: 'all' };

  const isUpcoming = (training) => !training.hasRecording && training.date >= ns.content.today();

  /** Kaart: 'miniatuur' met afspeelknop en duur, daaronder datum, titel en labels. */
  function card(training, headingTag) {
    const upcoming = isUpcoming(training);
    const thumb = el('div', { className: 'tr-card__thumb', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: 'tr-card__play' }, [icon(training.hasRecording ? 'play' : upcoming ? 'calendar' : 'clock')]),
      el('span', { className: 'tr-card__category', text: training.category }),
      el('span', { className: 'tr-card__duration', text: training.hasRecording ? training.duration || 'Opname' : upcoming ? 'Gepland' : 'Opname volgt' })
    ]);
    if (training.poster) {
      const img = el('img', { className: 'tr-card__poster', attrs: { src: training.poster, alt: '', loading: 'lazy', decoding: 'async' } });
      img.addEventListener('error', () => img.remove(), { once: true });
      thumb.prepend(img);
    }
    return el('a', { className: 'tr-card ' + accentClass(training.accent), attrs: { href: '#/training/' + training.id } }, [
      thumb,
      el('div', { className: 'tr-card__body' }, [
        el('p', { className: 'tr-card__meta', text: [formatDate(training.date), training.trainer].filter(Boolean).join(' · ') }),
        el(headingTag || 'h3', { className: 'tr-card__title', text: training.title }),
        training.subtitle ? el('p', { className: 'tr-card__subtitle', text: training.subtitle }) : null,
        el('div', { className: 'chips' }, [
          ns.ui.draftBadge(training),
          training.level ? chip(training.level, { icon: 'sparkle' }) : null,
          licenseBadge(training.license, { short: true }),
          newBadge(training.added)
        ].filter(Boolean))
      ])
    ]);
  }

  function requestCta() {
    return el('div', { className: 'notice notice--cta' }, [
      icon('cap'),
      el('div', {}, [
        el('p', { className: 'notice__title', text: 'Een training of sessie voor je team?' }),
        el('p', { text: 'Laat weten waar je behoefte aan hebt, bijvoorbeeld een demo van Analyst of een sessie over prompts voor de planning.' })
      ]),
      el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/ideeen/verzoek' } }, [icon('flag'), el('span', { text: 'Doe een verzoek' })])
    ]);
  }

  /* ---- Overzicht ---------------------------------------------------------------- */
  function renderList() {
    const all = ns.content.trainings;
    const head = pageHeader({
      eyebrow: 'Trainingen',
      title: 'Trainingen terugkijken',
      lead: 'Opnames van trainingen, webinars en lunchsessies over Copilot. Kijk terug wat je gemist hebt, of spring direct naar het onderdeel dat je nodig hebt.'
    });

    if (!all.length) {
      const node = el('div', { className: 'page container' }, [
        head,
        el('div', { className: 'empty' }, [
          el('span', { className: 'empty__icon', attrs: { 'aria-hidden': 'true' } }, [icon('cap')]),
          el('p', { className: 'empty__title', text: 'De eerste opnames komen eraan' }),
          el('p', { className: 'empty__text', text: 'Hier verschijnen de opnames van trainingen en sessies over Copilot in de audit, met de slides en de prompts die erin aan bod komen.' }),
          el('a', { className: 'btn btn--primary', attrs: { href: '#/ideeen/verzoek' } }, [icon('flag'), el('span', { text: 'Vraag een training aan' })])
        ])
      ]);
      return { node, title: 'Trainingen' };
    }

    const planned = all.filter(isUpcoming).sort((a, b) => (a.date > b.date ? 1 : -1));
    const archive = all.filter((training) => !isUpcoming(training));
    const grid = el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } });
    const count = el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });

    function update() {
      const items = archive.filter((training) => filters.category === 'all' || training.category === filters.category);
      grid.replaceChildren(...items.map((training) => el('li', {}, [card(training)])));
      count.textContent = items.length === 1 ? '1 training' : items.length + ' trainingen';
    }

    const categories = ns.content.trainingCategories.filter((category) => archive.some((training) => training.category === category));
    const filterBlock = categories.length > 1 ? el('div', { className: 'filters' }, [
      el('div', { className: 'filters__row' }, [
        el('span', { className: 'filters__label', text: 'Soort' }),
        toggleGroup('Filter op soort training', [{ value: 'all', label: 'Alles', count: archive.length }].concat(
          categories.map((category) => ({ value: category, label: category, count: archive.filter((training) => training.category === category).length }))
        ), filters.category, (value) => {
          filters.category = value;
          update();
        }),
        count
      ])
    ]) : null;

    const node = el('div', { className: 'page container' }, [
      head,
      planned.length ? el('section', { className: 'section section--flush', attrs: { 'aria-labelledby': 'tr-planned' } }, [
        el('h2', { className: 'section__title', text: 'Binnenkort', attrs: { id: 'tr-planned' } }),
        el('ul', { className: 'card-grid card-grid--3', attrs: { role: 'list' } }, planned.map((training) => el('li', {}, [card(training)])))
      ]) : null,
      archive.length ? el('section', { className: planned.length ? 'section' : 'section section--flush', attrs: { 'aria-labelledby': 'tr-archive' } }, [
        el('h2', { className: 'section__title', text: 'Terugkijken', attrs: { id: 'tr-archive' } }),
        filterBlock,
        grid
      ]) : null,
      el('div', { className: 'section' }, [requestCta()])
    ]);
    if (archive.length) update();
    return { node, title: 'Trainingen' };
  }

  /* ---- Eén training --------------------------------------------------------------- */
  function recordingBlock(training) {
    if (training.video) {
      const player = ns.player.create(training, { trackKind: 'play_training', note: 'Opname van de training', poster: training.poster });
      return { node: player.node, video: player.video, destroy: player.destroy };
    }
    if (training.link) {
      const open = el('a', { className: 'btn btn--primary btn--lg', attrs: { href: training.link, target: '_blank', rel: 'noopener noreferrer' } }, [
        icon('play'),
        el('span', { text: 'Open de opname' }),
        icon('external')
      ]);
      open.addEventListener('click', () => ns.central.track('play_training', training.id));
      return {
        node: el('div', { className: 'recording ' + accentClass(training.accent) }, [
          el('span', { className: 'recording__icon', attrs: { 'aria-hidden': 'true' } }, [icon('play-circle')]),
          el('div', { className: 'recording__body' }, [
            el('p', { className: 'recording__title', text: training.duration ? `Opname · ${training.duration}` : 'Opname' }),
            el('p', { className: 'recording__text', text: 'De opname staat in Microsoft 365 en opent in een nieuw tabblad. Log in met je Visser & Visser-account.' })
          ]),
          open
        ])
      };
    }
    const upcoming = isUpcoming(training);
    return {
      node: el('div', { className: 'recording recording--pending ' + accentClass(training.accent) }, [
        el('span', { className: 'recording__icon', attrs: { 'aria-hidden': 'true' } }, [icon(upcoming ? 'calendar' : 'clock')]),
        el('div', { className: 'recording__body' }, [
          el('p', { className: 'recording__title', text: upcoming ? 'Gepland op ' + formatDate(training.date) : 'Opname volgt' }),
          el('p', { className: 'recording__text', text: upcoming ? 'De opname verschijnt hier na de training.' : 'De opname wordt binnenkort toegevoegd.' })
        ])
      ])
    };
  }

  function renderDetail(id) {
    const training = ns.content.trainingById.get(id);
    if (!training) return null;
    ns.central.track('view_training', training.id);
    const recording = recordingBlock(training);

    const chapters = training.chapters.length ? el('section', { className: 'block', attrs: { 'aria-labelledby': 'tr-chapters' } }, [
      el('h2', { className: 'block__title', text: 'In deze training', attrs: { id: 'tr-chapters' } }),
      el('ol', { className: 'chapters', attrs: { role: 'list' } }, training.chapters.map((chapter) => {
        const inner = [el('span', { className: 'chapters__time', text: chapter.time }), el('span', { className: 'chapters__title', text: chapter.title })];
        if (!recording.video) return el('li', { className: 'chapters__item' }, inner);
        const jump = el('button', { className: 'chapters__jump', attrs: { type: 'button', 'aria-label': `Speel af vanaf ${chapter.time}: ${chapter.title}` } }, [...inner, icon('play')]);
        jump.addEventListener('click', () => {
          recording.video.currentTime = chapter.seconds;
          recording.video.play().catch(() => {});
          recording.video.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return el('li', { className: 'chapters__item' }, [jump]);
      }))
    ]) : null;

    const usecases = training.usecases.map((uid) => ns.content.usecaseById.get(uid)).filter(Boolean);
    const tips = training.tips.map((tid) => ns.content.tipById.get(tid)).filter((tip) => tip && !tip.locked);
    const relatedLinks = [
      ...usecases.map((u) => ({ href: '#/usecase/' + u.id, icon: 'play-circle', text: u.title })),
      ...tips.map((t) => ({ href: '#/tip/' + t.id, icon: 'bulb', text: t.title }))
    ];

    const aside = el('aside', { className: 'detail__aside', attrs: { 'aria-label': 'Bij deze training' } }, [
      training.materials.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'tr-materials' } }, [
        el('h2', { className: 'related__title', text: 'Materiaal', attrs: { id: 'tr-materials' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, training.materials.map((material) => {
          const external = /^https?:\/\//.test(material.href);
          return el('li', {}, [el('a', {
            className: 'related__link',
            attrs: external ? { href: material.href, target: '_blank', rel: 'noopener noreferrer' } : { href: material.href, download: true }
          }, [icon(external ? 'document' : 'download'), el('span', { text: material.label }), icon(external ? 'external' : 'arrow-right', { className: 'related__go' })])]);
        }))
      ]) : null,
      relatedLinks.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'tr-related' } }, [
        el('h2', { className: 'related__title', text: 'Zelf aan de slag', attrs: { id: 'tr-related' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, relatedLinks.map((link) =>
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: link.href } }, [icon(link.icon), el('span', { text: link.text }), icon('arrow-right', { className: 'related__go' })])])
        ))
      ]) : null,
      el('div', { className: 'side-card' }, [
        el('h2', { className: 'side-card__title' }, [icon('question'), el('span', { text: 'Vraag over deze training?' })]),
        el('p', { className: 'side-card__text', text: 'Stel hem in de ideeënhub. Het antwoord helpt vaak ook anderen.' }),
        el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/ideeen/vraag' } }, [icon('message-plus'), el('span', { text: 'Stel een vraag' })])
      ])
    ]);

    const node = el('article', { className: 'page container detail ' + accentClass(training.accent) }, [
      el('header', { className: 'detail__header' }, [
        el('a', { className: 'btn btn--back btn--sm', attrs: { href: '#/trainingen' } }, [icon('arrow-left'), el('span', { text: 'Alle trainingen' })]),
        el('p', { className: 'detail__eyebrow' }, [icon('cap'), el('span', { text: training.category })]),
        el('h1', { className: 'detail__title', text: training.title, attrs: { tabindex: '-1' } }),
        training.subtitle ? el('p', { className: 'detail__subtitle', text: training.subtitle }) : null,
        el('div', { className: 'chips' }, [
          chip(formatDate(training.date), { icon: 'calendar' }),
          training.duration ? chip(training.duration, { icon: 'clock' }) : null,
          training.trainer ? chip(training.trainer, { icon: 'users' }) : null,
          training.level ? chip(training.level, { icon: 'sparkle' }) : null,
          licenseBadge(training.license),
          newBadge(training.added)
        ].filter(Boolean))
      ]),
      el('div', { className: 'detail__layout' }, [
        el('div', { className: 'detail__main' }, [
          recording.node,
          training.description ? el('p', { className: 'detail__intro', text: training.description }) : null,
          chapters
        ]),
        aside
      ])
    ]);
    return { node, title: training.title, destroy: recording.destroy };
  }

  ns.views = ns.views || {};
  ns.views.trainings = { renderList, renderDetail, card };
})(window.AIAudit);
