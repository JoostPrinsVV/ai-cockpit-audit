/* ==========================================================================
   Rondleiding door de cockpit (eerste bezoek)
   --------------------------------------------------------------------------
   Wie de cockpit voor het eerst opent, krijgt op de startpagina een korte
   rondleiding: een lichtbundel over het onderdeel en een kaartje met uitleg,
   die vloeiend van stap naar stap gaan. Vorige en volgende met de knoppen of
   de pijltjes, Esc of het kruisje stopt. Daarna nooit meer vanzelf (lokale
   opslag 'rondleiding'); opnieuw starten kan onderaan iedere pagina, met
   Ctrl+K ('rondleiding') of met ?rondleiding in het adres.
   Niet vanzelf voor een ingelogde beheerder, en pas na het slot met pincode.
   Een stap waarvan het onderdeel er niet is (bijv. de kompasroos op een smal
   scherm), slaat de rondleiding over.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage } = ns.ui;
  const KEY = 'rondleiding';
  const VERSION = 1; // ophogen = iedereen krijgt een nieuwe rondleiding één keer te zien
  const START_DELAY = 2300; // na het opstarten van de instrumenten op de startpagina
  const PAD = 10;
  const GAP = 16;

  /**
   * De stappen. target: wat er oplicht (de eerste die zichtbaar is); zonder target een kaartje in het
   * midden. Teksten mogen een functie zijn (dan pas bij het tonen ingevuld).
   */
  function steps() {
    const discipline = ns.cockpit.active();
    return [
      {
        kind: 'welcome',
        eyebrow: 'Rondleiding · 1 minuut',
        title: 'Welkom in de AI Cockpit',
        text: `Hier vind je alles over Copilot in ${discipline.label}: usecases met demo, prompts, tips, trainingen en agents. In een minuut laten we zien waar alles staat.`
      },
      { target: ['.search--hero'], title: 'Zoek alles op één plek', text: 'Typ een woord als "notulen" of "materialiteit". Tip: met Ctrl+K zoek je vanaf iedere pagina, en kopieer je een prompt zonder hem te openen.' },
      { target: ['.nav'], title: 'De zes onderdelen', text: 'Usecases met demo, de promptdatabase, tips & tricks, trainingen, agents & tools en de ideeënhub. Het lampje brandt bij het onderdeel waar je bent.' },
      { target: ['.hero__rose', '.radar-strip'], title: 'De radar', text: 'Wat nieuw is sinds je vorige bezoek, verschijnt als rood stipje bij het onderdeel. Wijs het aan voor de titel, klik om het te openen.' },
      { target: ['.compass'], title: 'Wat speelt er nu?', text: 'Het seizoenskompas laat zien wat er nu speelt in het jaar, met de usecases en prompts die daar het handigst bij zijn.' },
      { target: ['#me-button'], title: 'Maak het persoonlijk', text: 'Vul één keer je naam, functie en boekjaar in. Dan staan ze voortaan al in iedere prompt, en blijven klantgegevens gewoon open om zelf in te vullen.' },
      { target: ['#rules-section'], title: 'Veilig werken', text: 'De gouden regels, het AI-beleid van V&V en "Mag dit?": in drie vragen weet je of iets mag in Copilot.' },
      {
        kind: 'finish',
        eyebrow: 'Klaar voor vertrek',
        title: 'Jij bepaalt de koers',
        text: 'Begin bij de prompts, of bouw je eigen prompt. De rondleiding vind je altijd terug onderaan de pagina en met Ctrl+K.'
      }
    ];
  }

  let state = null; // { dialog, spot, card, list, index, … } zolang de rondleiding loopt

  const seen = () => {
    const value = storage.get(KEY, null);
    return Boolean(value && value.version >= VERSION);
  };
  const remember = (how) => storage.set(KEY, { version: VERSION, how, at: new Date().toISOString() });
  const calm = () => (ns.motion && ns.motion.calm ? ns.motion.calm() : window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /** Het eerste zichtbare element van een stap (of null). */
  function targetOf(step) {
    if (!step.target) return null;
    for (const selector of step.target) {
      const node = document.querySelector(selector);
      if (node && node.getClientRects().length && node.getBoundingClientRect().width > 0) return node;
    }
    return null;
  }

  /* ---- Tekenen ---------------------------------------------------------------------- */
  function build() {
    const spot = el('div', { className: 'tour__spot', attrs: { 'aria-hidden': 'true' } });
    const eyebrow = el('p', { className: 'tour__eyebrow' });
    const title = el('h2', { className: 'tour__title', attrs: { id: 'tour-title' } });
    const text = el('p', { className: 'tour__text', attrs: { id: 'tour-text' } });
    const dots = el('ol', { className: 'tour__dots', attrs: { 'aria-hidden': 'true' } });
    const count = el('span', { className: 'tour__count' });
    const back = el('button', { className: 'btn btn--quiet btn--sm tour__back', attrs: { type: 'button' } }, [icon('arrow-left'), el('span', { text: 'Vorige' })]);
    const next = el('button', { className: 'btn btn--primary btn--sm tour__next', attrs: { type: 'button' } }, [el('span', { text: 'Volgende' }), icon('arrow-right')]);
    const skip = el('button', { className: 'btn btn--quiet btn--icon tour__close', attrs: { type: 'button', 'aria-label': 'Rondleiding sluiten' } }, [icon('close')]);
    const extra = el('div', { className: 'tour__extra' });
    const logo = el('img', { className: 'tour__logo', attrs: { src: 'assets/branding/logo.svg', alt: '', width: '56', height: '56' } });
    const body = el('div', { className: 'tour__body' }, [logo, eyebrow, title, text, extra]);
    const card = el('div', { className: 'tour__card' }, [
      skip,
      body,
      el('div', { className: 'tour__foot' }, [el('div', { className: 'tour__progress' }, [dots, count]), el('div', { className: 'tour__buttons' }, [back, next])])
    ]);
    const dialog = el('dialog', { className: 'tour', attrs: { 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-text' } }, [spot, card]);

    back.addEventListener('click', () => go(state.index - 1, -1));
    next.addEventListener('click', () => (state.index >= state.list.length - 1 ? stop('klaar') : go(state.index + 1, 1)));
    skip.addEventListener('click', () => stop('overgeslagen'));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      stop('overgeslagen');
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.target.closest('a, input, textarea')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next.click();
      } else if (event.key === 'ArrowLeft' && !back.hidden) {
        event.preventDefault();
        back.click();
      }
    });
    // Klik naast het kaartje (op het donkere vlak): niets, zodat je niet per ongeluk stopt
    return { dialog, spot, card, body, logo, eyebrow, title, text, extra, dots, count, back, next, skip };
  }

  /** Lichtbundel en kaartje naar het onderdeel (of naar het midden). */
  function place() {
    if (!state) return;
    const { spot, card } = state;
    const step = state.list[state.index];
    const node = targetOf(step);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let x;
    let y;
    if (!node) {
      // Midden: de bundel krimpt tot niets (het hele scherm gedimd), het kaartje in het midden
      spot.style.cssText = '';
      spot.style.setProperty('--x', vw / 2 + 'px');
      spot.style.setProperty('--y', vh / 2 + 'px');
      spot.style.setProperty('--w', '0px');
      spot.style.setProperty('--h', '0px');
      spot.classList.add('is-empty');
      x = (vw - cw) / 2;
      y = Math.max(GAP, (vh - ch) / 2);
    } else {
      const r = node.getBoundingClientRect();
      const box = { left: Math.max(4, r.left - PAD), top: Math.max(4, r.top - PAD), right: Math.min(vw - 4, r.right + PAD), bottom: Math.min(vh - 4, r.bottom + PAD) };
      spot.classList.remove('is-empty');
      spot.style.setProperty('--x', box.left + 'px');
      spot.style.setProperty('--y', box.top + 'px');
      spot.style.setProperty('--w', box.right - box.left + 'px');
      spot.style.setProperty('--h', box.bottom - box.top + 'px');
      const clampX = (value) => Math.min(Math.max(GAP, value), vw - cw - GAP);
      const clampY = (value) => Math.min(Math.max(GAP, value), vh - ch - GAP);
      if (vh - box.bottom >= ch + GAP * 2) {
        x = clampX(box.left + (box.right - box.left) / 2 - cw / 2);
        y = box.bottom + GAP;
      } else if (box.top >= ch + GAP * 2) {
        x = clampX(box.left + (box.right - box.left) / 2 - cw / 2);
        y = box.top - ch - GAP;
      } else if (box.left >= cw + GAP * 2) {
        x = box.left - cw - GAP;
        y = clampY(box.top + (box.bottom - box.top) / 2 - ch / 2);
      } else if (vw - box.right >= cw + GAP * 2) {
        x = box.right + GAP;
        y = clampY(box.top + (box.bottom - box.top) / 2 - ch / 2);
      } else {
        x = clampX((vw - cw) / 2);
        y = vh - ch - GAP;
      }
    }
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /** Naar stap index (dir: 1 vooruit, -1 terug); een stap zonder zichtbaar onderdeel wordt overgeslagen. */
  function go(index, dir) {
    if (!state) return;
    let target = index;
    while (target > 0 && target < state.list.length - 1 && state.list[target].target && !targetOf(state.list[target])) target += dir || 1;
    target = Math.min(Math.max(target, 0), state.list.length - 1);
    state.index = target;
    const step = state.list[target];
    const node = targetOf(step);
    const { card } = state;
    card.classList.add('is-changing');
    const show = () => {
      fill(step);
      card.classList.remove('is-changing');
      place();
      state.next.focus({ preventScroll: true });
    };
    // Eerst het onderdeel rustig in beeld schuiven, dan pas de bundel erheen
    if (node) {
      const r = node.getBoundingClientRect();
      const inView = r.top >= 70 && r.bottom <= window.innerHeight - 40;
      if (!inView) {
        node.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
        afterScroll(show);
        return;
      }
    }
    window.setTimeout(show, calm() ? 0 : 160);
  }

  /** Verder na het scrollen (of hooguit 0,7 seconde). */
  function afterScroll(next) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('scrollend', finish);
      next();
    };
    window.addEventListener('scrollend', finish);
    window.setTimeout(finish, 700);
  }

  /** De tekst en knoppen van een stap. */
  function fill(step) {
    const { list, index } = state;
    const center = !step.target;
    state.card.classList.toggle('is-center', center);
    state.logo.hidden = step.kind !== 'welcome';
    state.eyebrow.textContent = step.eyebrow || '';
    state.eyebrow.hidden = !step.eyebrow;
    state.title.textContent = step.title;
    state.text.textContent = step.text;
    // Alleen de stappen met een onderdeel tellen mee (welkom en einde niet)
    const real = list.filter((item) => item.target && targetOf(item));
    const position = real.indexOf(step);
    state.dots.replaceChildren(...real.map((item, n) => el('li', { className: n === position ? 'is-on' : n < position ? 'is-done' : '' })));
    state.count.textContent = position >= 0 ? `${position + 1} van ${real.length}` : '';
    state.back.hidden = index === 0 || step.kind === 'finish';
    const nextLabel = state.next.querySelector('span');
    nextLabel.textContent = step.kind === 'welcome' ? 'Laat zien' : step.kind === 'finish' ? 'Sluiten' : 'Volgende';
    state.next.querySelector('svg').style.display = step.kind === 'finish' ? 'none' : '';
    // Welkom: ook 'Zelf ontdekken'; einde: door naar de prompts of de promptbouwer
    const actions = [];
    if (step.kind === 'welcome') {
      actions.push(el('button', { className: 'tour__link', attrs: { type: 'button' }, on: { click: () => stop('overgeslagen') } }, [el('span', { text: 'Liever zelf ontdekken' })]));
    }
    if (step.kind === 'finish') {
      actions.push(
        el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/prompts' }, on: { click: () => stop('klaar') } }, [icon('chat'), el('span', { text: 'Naar de prompts' })]),
        el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/promptbouwer' }, on: { click: () => stop('klaar') } }, [icon('blocks'), el('span', { text: 'Bouw een prompt' })])
      );
    }
    state.extra.replaceChildren(...actions);
    state.extra.hidden = !actions.length;
  }

  /* ---- Starten en stoppen ----------------------------------------------------------- */
  function start() {
    if (state || !document.querySelector('.home')) return;
    const parts = build();
    state = Object.assign(parts, { list: steps(), index: 0 });
    document.body.append(parts.dialog);
    parts.dialog.showModal();
    document.documentElement.classList.add('has-tour');
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    go(0, 1);
  }

  function stop(how) {
    if (!state) return;
    remember(how);
    const { dialog } = state;
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place);
    state = null;
    document.documentElement.classList.remove('has-tour');
    dialog.classList.add('is-leaving');
    const done = () => {
      if (dialog.open) dialog.close();
      dialog.remove();
    };
    if (calm()) done();
    else window.setTimeout(done, 260);
  }

  /** Opnieuw (onderaan de pagina, Ctrl+K): eerst naar de startpagina als je daar niet bent. */
  function restart() {
    if (window.location.hash.replace(/^#\/?/, '') === '' && document.querySelector('.home')) {
      window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
      window.setTimeout(start, calm() ? 0 : 450);
      return;
    }
    const begin = () => {
      window.removeEventListener('hashchange', begin);
      window.setTimeout(start, 900);
    };
    window.addEventListener('hashchange', begin);
    window.location.hash = '#/';
  }

  let scheduled = 0;
  /**
   * Op de startpagina (js/view-home.js): bij het eerste bezoek de rondleiding, even na het opstarten.
   * Niet voor een ingelogde beheerder (behalve met ?rondleiding), en pas na het slot met pincode.
   */
  function maybeStart() {
    const forced = new URLSearchParams(window.location.search).has('rondleiding');
    if (state || scheduled || (!forced && (seen() || ns.central.signedIn()))) return;
    const later = () => {
      scheduled = window.setTimeout(() => {
        scheduled = 0;
        if (window.location.hash.replace(/^#\/?/, '') !== '' || !document.querySelector('.home')) return;
        // Staat er net een ander venster open (zoeken, Mag dit?): even later nog eens
        if (document.querySelector('dialog[open]')) later();
        else start();
      }, START_DELAY);
    };
    if (ns.lock && ns.lock.isShown()) {
      scheduled = -1;
      document.addEventListener('ai:ontgrendeld', () => {
        scheduled = 0;
        later();
      }, { once: true });
      return;
    }
    later();
  }

  /** Onderaan iedere pagina: 'Rondleiding'. */
  function footerLink() {
    const button = el('button', { className: 'footer__tour', attrs: { type: 'button' } }, [icon('plane'), el('span', { text: 'Rondleiding' })]);
    button.addEventListener('click', restart);
    return button;
  }

  ns.tour = { maybeStart, start, restart, stop, footerLink, seen, steps };
})(window.AIAudit);
