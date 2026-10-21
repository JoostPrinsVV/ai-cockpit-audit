/* ==========================================================================
   Trainingen (#/trainingen) en één training met opname (#/training/<id>)
   --------------------------------------------------------------------------
   Een opname staat bij voorkeur in Stream/SharePoint ('link': opent in een
   nieuw tabblad, Microsoft 365 regelt de toegang). Een korte MP4 ('video')
   speelt hier af; hoofdstukken springen dan naar het juiste moment.

   Naslagwerk (optioneel, per training): de slides om terug te kijken, wat je
   meeneemt, acties om af te vinken (alleen in deze browser bewaard), ideeën
   en vragen uit de zaal en het vervolg. Velden: zie data/trainings.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, formatDate, storage } = ns.ui;
  const filters = { category: 'all' };

  const isUpcoming = (training) => !training.available && training.date >= ns.content.today();
  const reduceMotion = () => Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

  /** Label rechtsonder op de kaart: duur van de opname, aantal slides, of de stand van zaken. */
  function cardLabel(training) {
    if (training.hasRecording) return training.duration || 'Opname';
    if (training.slides.length) return plural(training.slides.length, 'slide', 'slides');
    if (training.hasNaslag) return 'Naslagwerk';
    return isUpcoming(training) ? 'Gepland' : 'Opname volgt';
  }

  /** Kaart: 'miniatuur' met afspeelknop en duur, daaronder datum, titel en labels. */
  function card(training, headingTag) {
    const upcoming = isUpcoming(training);
    const thumb = el('div', { className: 'tr-card__thumb', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: 'tr-card__play' }, [icon(training.hasRecording ? 'play' : training.hasNaslag ? 'book' : upcoming ? 'calendar' : 'clock')]),
      el('span', { className: 'tr-card__category', text: training.category }),
      el('span', { className: 'tr-card__duration', text: cardLabel(training) })
    ]);
    // Geen afbeelding opgegeven: de eerste slide
    const poster = training.poster || (training.slides[0] && training.slides[0].image);
    if (poster) {
      const img = el('img', { className: 'tr-card__poster', attrs: { src: poster, alt: '', loading: 'lazy', decoding: 'async' } });
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
          training.hasNaslag ? chip('Naslagwerk', { icon: 'book' }) : null,
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
      lead: 'Opnames en naslagwerk van trainingen, webinars en lunchsessies over Copilot. Kijk terug wat je gemist hebt, of spring direct naar het onderdeel dat je nodig hebt.'
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
    // Geen opname, wel naslagwerk: dan geen 'Opname volgt' (de slides staan op die plek)
    if (training.hasNaslag) return { node: null };
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

  /* ---- Naslagwerk: slides ------------------------------------------------------------ */
  /**
   * Venster met de slides: vorige/volgende, pijltjestoetsen (ook Home, End, PageUp, PageDown),
   * vegen op een touchscreen en een teller. Escape, 'Sluiten' of naast het venster klikken sluit
   * het; de focus gaat dan terug naar de knop waarmee je het opende.
   */
  function slideViewer(training) {
    const slides = training.slides;
    let current = 0;
    let opener = null;

    const title = el('h2', { className: 'viewer__title' });
    const count = el('span', { className: 'viewer__count', attrs: { 'aria-hidden': 'true' } });
    const live = el('p', { className: 'sr-only', attrs: { 'aria-live': 'polite' } });
    const image = el('img', { className: 'viewer__image', attrs: { alt: '', decoding: 'async' } });
    const missing = el('p', { className: 'viewer__missing', text: 'Deze slide kon niet worden geladen.', attrs: { hidden: true } });
    const closeButton = el('button', { className: 'btn btn--ghost-dark btn--sm viewer__close', attrs: { type: 'button' } }, [icon('close'), el('span', { text: 'Sluiten' })]);
    const prev = el('button', { className: 'btn btn--ghost-dark viewer__step', attrs: { type: 'button', 'aria-label': 'Vorige slide' } }, [icon('arrow-left'), el('span', { className: 'viewer__step-label', text: 'Vorige' })]);
    const next = el('button', { className: 'btn btn--ghost-dark viewer__step', attrs: { type: 'button', 'aria-label': 'Volgende slide' } }, [el('span', { className: 'viewer__step-label', text: 'Volgende' }), icon('arrow-right')]);
    const stage = el('div', { className: 'viewer__stage' }, [image, missing]);
    const dialog = el('dialog', { className: 'viewer on-dark', attrs: { 'aria-label': 'Slides: ' + training.title } }, [
      el('div', { className: 'viewer__bar' }, [title, closeButton]),
      stage,
      el('div', { className: 'viewer__nav' }, [prev, count, next]),
      live
    ]);

    image.addEventListener('load', () => {
      missing.hidden = true;
    });
    image.addEventListener('error', () => {
      missing.hidden = false;
    });

    function show(index) {
      current = Math.max(0, Math.min(slides.length - 1, index));
      const slide = slides[current];
      missing.hidden = true;
      image.src = slide.image;
      image.alt = `Slide ${slide.number}: ${slide.title}`;
      title.textContent = slide.title;
      count.textContent = `${slide.number} / ${slides.length}`;
      live.textContent = `Slide ${slide.number} van ${slides.length}: ${slide.title}`;
      // aria-disabled in plaats van disabled: de focus blijft dan op de knop staan
      prev.setAttribute('aria-disabled', String(current === 0));
      next.setAttribute('aria-disabled', String(current === slides.length - 1));
      // De buren alvast laden, zodat bladeren direct gaat
      [slides[current - 1], slides[current + 1]].forEach((near) => {
        if (near) new Image().src = near.image;
      });
    }

    prev.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', (event) => {
      const steps = { ArrowLeft: -1, ArrowRight: 1, PageUp: -1, PageDown: 1 };
      if (event.key in steps) show(current + steps[event.key]);
      else if (event.key === 'Home') show(0);
      else if (event.key === 'End') show(slides.length - 1);
      else return;
      event.preventDefault();
    });
    let startX = null;
    stage.addEventListener('touchstart', (event) => {
      startX = event.touches[0].clientX;
    }, { passive: true });
    stage.addEventListener('touchend', (event) => {
      if (startX === null) return;
      const distance = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(distance) > 40) show(current + (distance < 0 ? 1 : -1));
    });
    dialog.addEventListener('close', () => {
      if (opener && opener.isConnected) opener.focus();
      opener = null;
    });

    function open(index, trigger) {
      opener = trigger || null;
      show(index);
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      next.focus();
    }

    return { node: dialog, open };
  }

  /** De eerste slide groot, met 'Bekijk de slides', en daaronder alle slides als miniatuur. */
  function slidesBlock(training, viewer, withHeading) {
    const slides = training.slides;
    const coverImage = el('img', { className: 'slides__cover-image', attrs: { src: slides[0].image, alt: '', decoding: 'async' } });
    coverImage.addEventListener('error', () => coverImage.remove(), { once: true });
    const cover = el('button', { className: 'slides__cover', attrs: { type: 'button' } }, [
      coverImage,
      el('span', { className: 'slides__cta' }, [icon('play'), el('span', { text: slides.length === 1 ? 'Bekijk de slide' : `Bekijk de ${slides.length} slides` })])
    ]);
    cover.addEventListener('click', () => viewer.open(0, cover));

    const strip = slides.length > 1 ? el('ol', { className: 'slides__strip', attrs: { role: 'list', 'aria-label': 'Ga direct naar een slide' } }, slides.map((slide, index) => {
      const thumb = el('img', { className: 'slides__thumb-image', attrs: { src: slide.image, alt: '', loading: 'lazy', decoding: 'async' } });
      thumb.addEventListener('error', () => thumb.remove(), { once: true });
      const button = el('button', { className: 'slides__thumb', attrs: { type: 'button', 'aria-label': `Slide ${slide.number}: ${slide.title}`, title: slide.title } }, [
        thumb,
        el('span', { className: 'slides__number', text: String(slide.number), attrs: { 'aria-hidden': 'true' } })
      ]);
      button.addEventListener('click', () => viewer.open(index, button));
      return el('li', {}, [button]);
    })) : null;

    const heading = el('h2', { className: withHeading ? 'block__title' : 'sr-only', text: 'Slides', attrs: { id: 'naslag-slides-title', tabindex: '-1' } });
    return { node: el('section', { className: 'slides', attrs: { id: 'naslag-slides', 'aria-labelledby': 'naslag-slides-title' } }, [heading, cover, strip]), heading };
  }

  /* ---- Naslagwerk: wat je meeneemt, aan de slag, uit de zaal, vervolg ------------------ */
  const KEYPOINT_ACCENTS = ['teal', 'steel', 'deepteal', 'navy'];
  const COUNT_WORDS = ['', 'Eén', 'Twee', 'Drie', 'Vier', 'Vijf', 'Zes', 'Zeven', 'Acht', 'Negen', 'Tien'];
  // 'December' → 'december' (maar 'Q1' blijft 'Q1')
  const lowerFirst = (value) => (/^[A-Z][a-z]/.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value);

  function naslagSection(id, title, intro, content) {
    const heading = el('h2', { className: 'naslag__title', text: title, attrs: { id: id + '-title', tabindex: '-1' } });
    const node = el('section', { className: 'naslag__section', attrs: { id, 'aria-labelledby': id + '-title' } }, [
      heading,
      intro ? el('p', { className: 'naslag__intro', text: intro }) : null
    ].concat(content));
    return { id, title, node, heading };
  }

  function keypointList(training) {
    let n = 0;
    return el('ul', { className: 'keypoints', attrs: { role: 'list' } }, training.takeaways.map((point) => {
      const accent = point.warning ? 'crimson' : KEYPOINT_ACCENTS[n++ % KEYPOINT_ACCENTS.length];
      return el('li', { className: 'keypoints__item ' + accentClass(accent) + (point.warning ? ' keypoints__item--warning' : '') }, [
        point.warning ? icon('alert', { className: 'keypoints__icon', label: 'Let op' }) : null,
        el('div', { className: 'keypoints__body' }, [
          point.title ? el('p', { className: 'keypoints__title', text: point.title }) : null,
          point.text ? el('p', { className: 'keypoints__text', text: point.text }) : null
        ])
      ]);
    }));
  }

  /** Uitklapblok bij een actie: stappen, kleine letters en prompts of sjablonen. */
  function actionDetails(action) {
    const summary = action.more || (action.howto.length ? 'Zo pak je het aan' : action.prompts.length === 1 ? 'Bekijk de prompt' : `Bekijk de ${action.prompts.length} prompts`);
    return el('details', { className: 'checklist__details' }, [
      el('summary', { className: 'checklist__summary' }, [el('span', { text: summary }), icon('chevron-down')]),
      el('div', { className: 'checklist__details-body' }, [
        ...action.howto.map((part) => el('div', { className: 'howto' }, [
          part.title ? el('p', { className: 'howto__title', text: part.title }) : null,
          el('ol', { className: 'steps steps--small', attrs: { role: 'list' } }, part.steps.map((step, index) =>
            el('li', { className: 'steps__item' }, [el('span', { className: 'steps__number', text: String(index + 1) }), el('span', { text: step })])
          ))
        ])),
        action.note ? el('p', { className: 'howto__note', text: action.note }) : null,
        ...action.prompts.map((prompt) => ns.promptBox.create({ text: prompt.text, label: prompt.label, headingTag: 'p', collapsed: true }))
      ])
    ]);
  }

  /** Afvinklijst. De vinkjes staan alleen in deze browser (lokale opslag, per training). */
  function actionList(training, viewer) {
    const storeKey = 'naslag:' + training.id;
    const saved = storage.get(storeKey, {});
    const done = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const total = training.actions.length;
    const bar = el('progress', { className: 'checklist__bar', attrs: { max: String(total), value: '0', 'aria-hidden': 'true' } });
    const status = el('p', { className: 'checklist__status', attrs: { 'aria-live': 'polite' } });
    const currentIndex = training.timeline.findIndex((step) => step.current);
    const nextStep = currentIndex >= 0 ? training.timeline[currentIndex + 1] : null;
    const boxes = [];

    function update() {
      const checked = boxes.filter((box) => box.checked).length;
      bar.value = checked;
      if (checked < total) status.textContent = `${checked} van ${plural(total, 'actie', 'acties')} gedaan`;
      else status.textContent = nextStep && nextStep.month ? `Alles afgevinkt. Tot de volgende sessie in ${lowerFirst(nextStep.month)}!` : 'Alles afgevinkt. Goed bezig!';
    }

    const list = el('ul', { className: 'checklist', attrs: { role: 'list' } }, training.actions.map((action, index) => {
      const boxId = 'actie-' + index;
      const box = el('input', { className: 'checklist__box', attrs: { id: boxId, type: 'checkbox', 'aria-labelledby': boxId + '-titel', 'aria-describedby': action.text ? boxId + '-tekst' : null } });
      box.checked = done[action.key] === true;
      box.addEventListener('change', () => {
        if (box.checked) done[action.key] = true;
        else delete done[action.key];
        if (Object.keys(done).length) storage.set(storeKey, done);
        else storage.remove(storeKey);
        update();
      });
      boxes.push(box);

      const extras = [];
      if (action.slide && viewer) {
        const slide = training.slides[action.slide - 1];
        const show = el('button', { className: 'checklist__slide', attrs: { type: 'button' } }, [icon('play-circle'), el('span', { text: `Bekijk slide ${slide.number}: ${slide.title}` })]);
        show.addEventListener('click', () => viewer.open(action.slide - 1, show));
        extras.push(show);
      }
      if (action.howto.length || action.prompts.length || action.note) extras.push(actionDetails(action));

      return el('li', { className: 'checklist__item' }, [
        el('div', { className: 'checklist__row' }, [
          box,
          el('label', { className: 'checklist__label', attrs: { for: boxId } }, [
            el('span', { className: 'checklist__title', text: action.title, attrs: { id: boxId + '-titel' } }),
            action.text ? el('span', { className: 'checklist__text', text: action.text, attrs: { id: boxId + '-tekst' } }) : null
          ])
        ]),
        extras.length ? el('div', { className: 'checklist__more' }, extras) : null
      ]);
    }));
    update();
    return [list, el('div', { className: 'checklist__progress' }, [bar, status])];
  }

  function roomBlock(training) {
    return [
      training.ideas.length ? el('ul', { className: 'room', attrs: { role: 'list' } }, training.ideas.map((idea) => el('li', { className: 'room__item' }, [
        idea.title ? el('p', { className: 'room__title', text: idea.title }) : null,
        idea.text ? el('p', { className: 'room__text', text: idea.text }) : null
      ]))) : null,
      training.questions.length ? el('div', { className: 'questions' }, [
        el('h3', { className: 'questions__title', text: 'Open vragen' }),
        el('ul', { className: 'questions__list', attrs: { role: 'list' } }, training.questions.map((question) => el('li', { className: 'questions__item', text: question })))
      ]) : null
    ].filter(Boolean);
  }

  function timelineList(training) {
    return el('ol', { className: 'timeline', attrs: { role: 'list' } }, training.timeline.map((step) => {
      const target = step.training ? ns.content.trainingById.get(step.training) : null;
      return el('li', { className: 'timeline__item' + (step.current ? ' is-current' : '') }, [
        step.month ? el('p', { className: 'timeline__month', text: step.month }) : null,
        step.title ? el('p', { className: 'timeline__title' }, [target ? el('a', { attrs: { href: '#/training/' + target.id }, text: step.title }) : step.title]) : null,
        step.text ? el('p', { className: 'timeline__text', text: step.text }) : null,
        step.current ? el('span', { className: 'badge timeline__badge' }, [icon('check'), 'Deze training']) : null
      ]);
    }));
  }

  /**
   * Het naslagwerk onder de training, met een inhoudsopgave (op een breed scherm blijft die
   * links in beeld). De links springen binnen de pagina; het adres (#/training/<id>) blijft gelijk.
   */
  function naslagBlock(training, viewer, slides) {
    const parts = [];
    const points = training.takeaways.length;
    if (points) {
      const intro = points === 1 ? 'Het belangrijkste om te onthouden, ook als je verder niets leest.' : `${COUNT_WORDS[points] || points} dingen om te onthouden, ook als je verder niets leest.`;
      parts.push(naslagSection('naslag-meenemen', 'Wat je meeneemt', intro, [keypointList(training)]));
    }
    if (training.actions.length) {
      parts.push(naslagSection('naslag-aan-de-slag', 'Aan de slag', 'De afspraken uit de training. Vink af wat je hebt gedaan; je voortgang wordt alleen in deze browser bewaard.', actionList(training, viewer)));
    }
    if (training.ideas.length || training.questions.length) {
      parts.push(naslagSection('naslag-uit-de-zaal', 'Uit de zaal', 'Ideeën en vragen die tijdens de training naar voren kwamen. Ze zijn nog niet uitgewerkt.', roomBlock(training)));
    }
    if (training.timeline.length) {
      parts.push(naslagSection('naslag-vervolg', 'Vervolg', training.timelineIntro, [timelineList(training)]));
    }
    if (!parts.length) return null;

    // Inhoudsopgave (vanaf twee onderdelen), met de slides bovenaan de pagina erbij
    const targets = (slides ? [{ id: 'naslag-slides', title: 'Slides', node: slides.node, heading: slides.heading }] : []).concat(parts);
    let observer = null;
    let toc = null;
    if (targets.length > 1) {
      const links = targets.map((target) => {
        const link = el('a', { className: 'naslag__link', text: target.title, attrs: { href: '#' + target.id } });
        link.addEventListener('click', (event) => {
          event.preventDefault();
          target.heading.focus({ preventScroll: true });
          target.node.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
        });
        return { id: target.id, link };
      });
      toc = el('nav', { className: 'naslag__toc', attrs: { 'aria-labelledby': 'naslag-toc-title' } }, [
        el('p', { className: 'naslag__toc-title', text: 'Op deze pagina', attrs: { id: 'naslag-toc-title' } }),
        el('ul', { className: 'naslag__links', attrs: { role: 'list' } }, links.map(({ link }) => el('li', {}, [link])))
      ]);
      // Het onderdeel dat nu in beeld is, staat gemarkeerd
      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach(({ id, link }) => {
              if (id === entry.target.id) link.setAttribute('aria-current', 'true');
              else link.removeAttribute('aria-current');
            });
          });
        }, { rootMargin: '-30% 0px -60% 0px' });
        targets.forEach((target) => observer.observe(target.node));
      }
    }

    return {
      node: el('div', { className: 'naslag' + (toc ? '' : ' naslag--single') }, [toc, el('div', { className: 'naslag__main' }, parts.map((part) => part.node))]),
      destroy: () => {
        if (observer) observer.disconnect();
      }
    };
  }

  function renderDetail(id) {
    const training = ns.content.trainingById.get(id);
    if (!training) return null;
    ns.central.track('view_training', training.id);
    const recording = recordingBlock(training);
    const viewer = training.slides.length ? slideViewer(training) : null;
    const slides = viewer ? slidesBlock(training, viewer, Boolean(recording.node)) : null;
    const naslag = naslagBlock(training, viewer, slides);

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
          slides ? slides.node : null,
          training.description ? el('p', { className: 'detail__intro', text: training.description }) : null,
          chapters
        ]),
        aside
      ]),
      naslag ? naslag.node : null,
      viewer ? viewer.node : null
    ]);
    return {
      node,
      title: training.title,
      destroy: () => {
        if (recording.destroy) recording.destroy();
        if (naslag) naslag.destroy();
      }
    };
  }

  ns.views = ns.views || {};
  ns.views.trainings = { renderList, renderDetail, card };
})(window.AIAudit);
