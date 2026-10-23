/* ==========================================================================
   Beweging: overgangen en kleine animaties
   --------------------------------------------------------------------------
   Subtiel en kort (0,2 tot 0,4 seconde, de opstart op de startpagina iets
   langer en één keer per bezoek). Vraagt je computer om minder beweging
   (Windows: Instellingen → Toegankelijkheid → Visuele effecten), dan staat
   alles uit. Werkt het mooist in Edge en Chrome; andere browsers krijgen
   dezelfde site zonder de overgangen.

   - Paginaovergang: de pagina faadt rustig in; de titel van de kaart loopt
     door naar de kop van de detailpagina (en terug).
   - Opstarten (startpagina): de ringen van de kompasroos tekenen zich, de
     naald zoekt het noorden, de koersband draait bij, de tellers lopen op en
     de lampjes in het menu doen een korte lampentest.
   - Kaarten komen kort na elkaar binnen; bij filteren en sorteren schuiven
     ze naar hun nieuwe plek.
   - Thema: licht/donker opent als een cirkel vanuit de knop.
   - Kleine reacties: kopiëren scant de prompt, de bladwijzer en de sterren
     veren even op.
   Uitklappers, zijpanelen en scrolleffecten staan in css/motion.css.
   ========================================================================== */
(function (ns) {
  'use strict';

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const calm = () => motionQuery.matches;
  const root = document.documentElement;
  const canTransition = () => typeof document.startViewTransition === 'function' && !calm();
  const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const BOOT_KEY = 'ai-snackbar-audit:opgestart';

  /* ---- Paginaovergang, met de kaart die doorloopt naar de detailpagina ------------------------- */
  const CARD = '.uc-card, .tip-card, .p-card, .tr-card, .recent__item';
  const TITLE = '.uc-card__title, .tip-card__title, .p-card__title, .tr-card__title, .recent__title';
  const ICON = '.uc-card__icon, .tip-card__icon, .recent__icon';
  const DETAIL = ['usecase', 'prompt', 'tip', 'training', 'agent'];
  let lastParsed = null;
  let clicked = null; // { href, card }: de kaart waarop je net klikte
  const named = new Set();

  document.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href^="#/"]');
    if (!link) return;
    const card = link.matches(CARD) ? link : link.closest(CARD);
    clicked = card ? { href: link.getAttribute('href'), card } : null;
  }, true);

  function nameIt(node, name) {
    if (!node) return;
    node.style.viewTransitionName = name;
    named.add(node);
  }

  function clearNames() {
    named.forEach((node) => {
      node.style.viewTransitionName = '';
    });
    named.clear();
  }

  const isDetail = (parsed) => Boolean(parsed && DETAIL.includes(parsed.name) && parsed.params[0]);

  function cardFor(href) {
    const link = document.querySelector(`#view a[href="${href}"]`);
    if (!link) return null;
    return link.matches(CARD) ? link : link.closest(CARD);
  }

  function nameCard(card) {
    nameIt(card.querySelector(TITLE), 'item-title');
    nameIt(card.querySelector(ICON), 'item-icon');
  }

  function nameDetail() {
    nameIt(document.querySelector('#view .detail__title'), 'item-title');
    nameIt(document.querySelector('#view .detail__eyebrow .icon'), 'item-icon');
  }

  /**
   * Nieuwe pagina tonen (js/app.js): commit() bouwt hem op.
   * mode: 'page' (navigatie), 'first' (eerste keer laden) of 'refresh' (dezelfde pagina opnieuw).
   */
  function swap(commit, parsed, mode) {
    const prev = lastParsed;
    lastParsed = parsed;
    if (mode === 'refresh') {
      commit();
      return;
    }
    if (mode === 'first' || !canTransition()) {
      commit();
      arrived(parsed);
      return;
    }
    clearNames();
    const fromCard = clicked && clicked.href === window.location.hash && isDetail(parsed) && clicked.card.isConnected ? clicked.card : null;
    const backFromDetail = isDetail(prev) && !isDetail(parsed);
    if (fromCard) nameCard(fromCard);
    else if (backFromDetail) nameDetail();
    clicked = null;
    root.classList.add('vt-page');
    const transition = document.startViewTransition(() => {
      clearNames();
      commit();
      if (fromCard) nameDetail();
      else if (backFromDetail) {
        const card = cardFor(`#/${prev.name}/${prev.params[0]}`);
        if (card) nameCard(card);
      }
      arrived(parsed);
    });
    // Overgeslagen (bijv. snel achter elkaar klikken): geen fout, de pagina staat er gewoon
    transition.ready.catch(() => null);
    transition.finished.finally(() => {
      clearNames();
      root.classList.remove('vt-page');
    });
  }

  /* ---- Kaarten komen binnen ------------------------------------------------------------- */
  function stagger(scope) {
    if (calm()) return;
    let index = 0;
    scope.querySelectorAll('.tiles, .card-grid, .p-grid, .recent, .weekly').forEach((list) => {
      Array.from(list.children).forEach((item) => {
        if (item.getBoundingClientRect().top > window.innerHeight + 200) return; // alleen wat je meteen ziet
        item.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: Math.min(index, 12) * 45, easing: EASE, fill: 'backwards' });
        index++;
      });
    });
  }

  function arrived(parsed) {
    const view = document.getElementById('view');
    if (view) stagger(view);
    if (parsed && parsed.name === '' && !calm()) {
      let done = false;
      try {
        done = window.sessionStorage.getItem(BOOT_KEY) === 'ja';
      } catch (error) {
        done = false;
      }
      if (!done) window.setTimeout(boot, 60);
    }
  }

  /* ---- Instrumenten opstarten (startpagina, één keer per bezoek) -------------------------------- */
  function boot() {
    try {
      window.sessionStorage.setItem(BOOT_KEY, 'ja');
    } catch (error) {
      /* dan de volgende keer opnieuw */
    }
    const rose = document.querySelector('.hero__rose');
    if (rose && rose.getBoundingClientRect().width) {
      // De ringen tekenen zich, de streepjes en cijfers verschijnen
      rose.querySelectorAll('.rose__ring').forEach((ring, i) => {
        const length = 2 * Math.PI * Number(ring.getAttribute('r'));
        ring.animate([{ strokeDasharray: `0 ${length}` }, { strokeDasharray: `${length} 0` }], { duration: 900, delay: i * 120, easing: EASE, fill: 'backwards' });
      });
      rose.querySelectorAll('.rose__tick, .rose__label').forEach((tick, i) => {
        tick.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 300 + (i % 24) * 18, fill: 'backwards' });
      });
      // De naald zoekt het noorden en komt tot rust
      const needle = rose.querySelector('.rose__needle');
      if (needle) {
        needle.animate([
          { transform: 'rotate(-70deg)', opacity: 0 },
          { transform: 'rotate(28deg)', opacity: 1, offset: 0.35 },
          { transform: 'rotate(-12deg)', offset: 0.58 },
          { transform: 'rotate(5deg)', offset: 0.78 },
          { transform: 'rotate(-1.5deg)', offset: 0.9 },
          { transform: 'rotate(0deg)' }
        ], { duration: 1900, delay: 250, easing: 'ease-out', fill: 'backwards' });
      }
      rose.querySelectorAll('.rose__marker').forEach((marker, i) => {
        marker.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.6)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420, delay: 1100 + i * 90, easing: EASE, fill: 'backwards' });
      });
    }
    // De koersband draait bij en komt tot rust op N
    const tape = document.querySelector('.hero .heading-tape');
    if (tape && ns.instruments && ns.instruments.steerHero) {
      const parts = tape.querySelectorAll('.heading-tape__band, .heading-tape__bug');
      tape.classList.remove('is-ready');
      ns.instruments.steerHero(-120);
      void tape.offsetWidth;
      parts.forEach((node) => { node.style.transition = `transform 1700ms ${EASE}`; });
      ns.instruments.steerHero(0);
      window.setTimeout(() => {
        parts.forEach((node) => { node.style.transition = ''; });
        tape.classList.add('is-ready');
      }, 1800);
    }
    // De tellers lopen op als een uitleesvenster
    document.querySelectorAll('.tile__count span[aria-hidden]').forEach((count, i) => {
      const target = parseInt(count.textContent, 10) || 0;
      const start = performance.now() + 250 + i * 120;
      const tick = (now) => {
        const t = Math.max(0, Math.min(1, (now - start) / 900));
        count.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3)))).padStart(2, '0');
        if (t < 1) window.requestAnimationFrame(tick);
      };
      count.textContent = '00';
      window.requestAnimationFrame(tick);
    });
    // Korte lampentest in het menu
    document.querySelectorAll('.nav__link').forEach((link, i) => {
      window.setTimeout(() => {
        link.classList.add('lamp-test');
        window.setTimeout(() => link.classList.remove('lamp-test'), 260);
      }, 400 + i * 110);
    });
  }

  /* ---- Filteren en sorteren: kaarten schuiven naar hun nieuwe plek ------------------------------ */
  function nameCards() {
    document.querySelectorAll('#view .card-grid > li, #view .p-grid > li').forEach((item) => {
      const link = item.querySelector('a[href^="#/"]');
      const href = link ? link.getAttribute('href') : '';
      if (/^#\/(usecase|prompt|tip|training|agent)\/[a-z0-9-]+$/.test(href)) nameIt(item, 'card-' + href.slice(2).replace('/', '-'));
    });
    document.querySelectorAll('#view .p-group__title[id]').forEach((title) => nameIt(title, 'grp-' + title.id));
  }

  /** Een filter of volgorde aanpassen (js/ui.js): change() bouwt de lijst opnieuw op. */
  function filter(change) {
    if (!canTransition()) {
      change();
      return;
    }
    clearNames();
    nameCards();
    root.classList.add('vt-filter');
    const transition = document.startViewTransition(() => {
      clearNames();
      change();
      nameCards();
    });
    transition.ready.catch(() => null);
    transition.finished.finally(() => {
      clearNames();
      root.classList.remove('vt-filter');
    });
  }

  /* ---- Thema: een cirkel vanuit de knop ---------------------------------------------------- */
  let themeBusy = false;
  document.addEventListener('click', (event) => {
    const button = event.target.closest && event.target.closest('#theme-button');
    if (!button || themeBusy || !canTransition()) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.classList.add('vt-theme');
    const transition = document.startViewTransition(() => {
      // De gewone knop (js/app.js) wisselt het thema
      themeBusy = true;
      button.click();
      themeBusy = false;
    });
    transition.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 650, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => null);
    transition.finished.finally(() => root.classList.remove('vt-theme'));
  }, true);

  /* ---- Kleine reacties ---------------------------------------------------------------------- */
  // In de vangfase: de kopieer- en bladwijzerknop geven hun klik niet door
  document.addEventListener('click', (event) => {
    if (calm() || !event.target.closest) return;
    // Kopiëren: een scanlijn gaat over de prompt
    const copy = event.target.closest('.btn--copy');
    const box = copy && copy.closest('.prompt-box, .p-card');
    if (box) {
      const scan = document.createElement('span');
      scan.className = 'motion-scan';
      scan.setAttribute('aria-hidden', 'true');
      scan.style.setProperty('--scan-to', box.offsetHeight + 'px');
      box.classList.add('motion-scan-host');
      box.append(scan);
      window.setTimeout(() => scan.remove(), 900);
    }
    // Bladwijzer, sterren en de wisselaar veren even op
    const pop = event.target.closest('.fav, .review__star, .switcher__button');
    if (pop) {
      window.setTimeout(() => {
        pop.classList.remove('motion-pop');
        void pop.offsetWidth;
        pop.classList.add('motion-pop');
      }, 0);
    }
  }, true);

  ns.motion = { swap, filter };
})(window.AIAudit);
