/* ==========================================================================
   Instrumenten: koersband en kompasroos (de cockpitstijl)
   --------------------------------------------------------------------------
   Koersband: streepjes per 5 graden, labels per 30 graden (N 03 06 E …).
   - Groot onder de hero van de startpagina, met het pijltje op N.
   - Dun onder de kopbalk op de andere pagina's: het pijltje staat onder de
     pagina waar je bent en de band schuift mee naar de koers van dat onderdeel.
   Kompasroos: licht, rechts in de hero, met het logo in het midden.
   Alles is versiering (aria-hidden) en werkt zonder deze module ook prima.
   ========================================================================== */
(function (ns) {
  'use strict';

  const SVG = 'http://www.w3.org/2000/svg';
  const LABELS = { 0: 'N', 30: '03', 60: '06', 90: 'E', 120: '12', 150: '15', 180: 'S', 210: '21', 240: '24', 270: 'W', 300: '30', 330: '33' };
  const FIRST = -720; // de band beslaat ruim vijf rondjes: breed genoeg voor elk scherm
  const LAST = 1080;
  const SIZES = {
    large: { perDeg: 2.4, height: 36 },
    thin: { perDeg: 1.6, height: 14 }
  };
  // Elk onderdeel zijn eigen koers, rondom de kompasroos (N = de startpagina). Wisselen van
  // pagina is een beetje bijsturen; op de startpagina staan ze als koerspunten op de roos.
  // short: de korte naam op de roos (zoals in het telefoonmenu), label: voor schermlezers
  const WAYPOINTS = [
    { id: 'usecases', label: 'Usecases', short: 'Usecases', heading: 30 },
    { id: 'prompts', label: 'Prompts', short: 'Prompts', heading: 90 },
    { id: 'tips', label: 'Tips & tricks', short: 'Tips', heading: 150 },
    { id: 'trainingen', label: 'Trainingen', short: 'Training', heading: 210 },
    { id: 'agents', label: 'Agents & tools', short: 'Agents', heading: 270 },
    { id: 'ideeen', label: 'Ideeënhub', short: 'Ideeën', heading: 330 }
  ];
  const HEADINGS = Object.fromEntries(WAYPOINTS.map((w) => [w.id, w.heading]));

  const tapes = new Set();
  let observer = null;

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
    return node;
  }

  const normalize = (deg) => ((deg % 360) + 360) % 360;

  function band(size) {
    const { perDeg, height } = SIZES[size];
    const large = size === 'large';
    const width = (LAST - FIRST) * perDeg;
    const root = svg('svg', { class: 'heading-tape__band', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true', focusable: 'false' });
    for (let deg = FIRST; deg <= LAST; deg += 5) {
      const x = (deg - FIRST) * perDeg;
      const norm = normalize(deg);
      const major = norm % 30 === 0;
      const length = major ? (large ? 11 : 9) : norm % 10 === 0 ? (large ? 7 : 6) : (large ? 4 : 3.5);
      root.append(svg('line', { class: major ? 'heading-tape__tick heading-tape__tick--major' : 'heading-tape__tick', x1: x, x2: x, y1: height - length, y2: height }));
      if (large && major) {
        // Labels onder het pijltje (dat staat bovenin), boven de streepjes
        const label = svg('text', { class: norm === 0 ? 'heading-tape__label heading-tape__label--north' : 'heading-tape__label', x, y: 21, 'text-anchor': 'middle' });
        label.textContent = LABELS[norm];
        root.append(label);
      }
    }
    return root;
  }

  /** Vult een (lege) koersband; size is 'large' of 'thin'. */
  function fillTape(node, size, place) {
    node.replaceChildren(band(size), Object.assign(document.createElement('span'), { className: 'heading-tape__bug' }));
    node.dataset.size = size;
    node.placeTape = place;
    tapes.add(node);
    if (observer) observer.observe(node);
    // Eerst op zijn plek zetten, pas daarna mag hij (bij een volgende koers) schuiven
    window.requestAnimationFrame(() => {
      place(node);
      window.requestAnimationFrame(() => node.classList.add('is-ready'));
    });
    return node;
  }

  /** Zet 'heading' (graden) onder het pijltje, dat op x (pixels vanaf links) staat. */
  function steer(node, heading, x) {
    const strip = node.querySelector('.heading-tape__band');
    const bug = node.querySelector('.heading-tape__bug');
    if (!strip || !bug) return;
    const { perDeg } = SIZES[node.dataset.size];
    strip.style.transform = `translateX(${Math.round(x - (heading - FIRST) * perDeg)}px)`;
    bug.style.transform = `translateX(${Math.round(x)}px)`;
  }

  /** De grote band onder de hero: het pijltje in het midden, op N. */
  function heroTape() {
    const node = document.createElement('div');
    node.className = 'heading-tape heading-tape--large';
    node.setAttribute('aria-hidden', 'true');
    return fillTape(node, 'large', (tape) => steer(tape, 0, tape.clientWidth / 2));
  }

  /** De dunne band onder de kopbalk: het pijltje onder de pagina waar je bent. */
  function placeTopbar(tape) {
    const box = tape.getBoundingClientRect();
    if (!box.width) return;
    const active = document.querySelector('.nav__link[aria-current]');
    const anchor = active || document.querySelector('.brand__mark') || document.querySelector('.brand');
    const rect = anchor ? anchor.getBoundingClientRect() : null;
    const x = rect && rect.width ? rect.left + rect.width / 2 - box.left : 28;
    steer(tape, (active && HEADINGS[active.dataset.nav]) || 0, x);
  }

  /** Na elke pagina (js/app.js): het pijltje naar het juiste menu-item. */
  function update() {
    const tape = document.getElementById('topbar-tape');
    if (tape && tape.placeTape) tape.placeTape(tape);
  }

  /** De grote koersband onder de hero naar een koers sturen (0 = terug naar N). */
  function steerHero(heading) {
    const tape = document.querySelector('.hero .heading-tape');
    if (tape) steer(tape, heading, tape.clientWidth / 2);
  }

  const point = (deg, r) => {
    const angle = (deg - 90) * Math.PI / 180;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  };

  /**
   * Kompasroos voor de hero, met de zes onderdelen als koerspunten. Aanwijzen (of tabben):
   * de naald draait naar die koers, het punt licht op en de koersband stuurt mee. Klikken: erheen.
   */
  function rose() {
    const root = svg('svg', { class: 'hero__rose', viewBox: '-280 -280 560 560', role: 'group', 'aria-label': 'Kompas: kies een onderdeel', focusable: 'false' });
    const decor = svg('g', { 'aria-hidden': 'true' });
    [95, 175, 250].forEach((r) => decor.append(svg('circle', { class: 'rose__ring', r })));
    decor.append(svg('line', { class: 'rose__cross', x1: -250, x2: 250, y1: 0, y2: 0 }));
    decor.append(svg('line', { class: 'rose__cross', x1: 0, x2: 0, y1: -250, y2: 250 }));
    const taken = new Set(WAYPOINTS.map((w) => w.heading));
    for (let deg = 0; deg < 360; deg += 5) {
      const major = deg % 30 === 0;
      const a = point(deg, 250);
      const b = point(deg, major ? 266 : deg % 10 === 0 ? 260 : 256);
      decor.append(svg('line', { class: major ? 'rose__tick rose__tick--major' : 'rose__tick', x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
      // Cijfers alleen waar geen onderdeel staat
      if (major && !taken.has(deg)) {
        const at = point(deg, 230);
        const label = svg('text', { class: deg === 0 ? 'rose__label rose__label--north' : 'rose__label', x: at.x, y: at.y + 4.5, 'text-anchor': 'middle' });
        label.textContent = LABELS[deg];
        decor.append(label);
      }
    }
    root.append(decor);

    // De naald: koerslijn en logo, draaien samen naar het aangewezen onderdeel
    const needle = svg('g', { class: 'rose__needle', 'aria-hidden': 'true' });
    needle.append(svg('circle', { r: 250, fill: 'none', stroke: 'none' })); // midden van de roos = draaipunt
    needle.append(svg('line', { class: 'rose__course', x1: 0, y1: -60, x2: 0, y2: -214 }));
    needle.append(svg('image', { href: 'assets/branding/logo-dark.svg', x: -46, y: -46, width: 92, height: 92 }));

    const points = svg('g', { class: 'rose__waypoints' });
    WAYPOINTS.forEach((w) => {
      const marker = point(w.heading, 250);
      const text = point(w.heading, 222);
      const side = text.x > 20 ? 'end' : text.x < -20 ? 'start' : 'middle';
      const link = svg('a', { class: 'rose__waypoint', href: '#/' + w.id, 'aria-label': w.label });
      link.append(svg('circle', { class: 'rose__marker', cx: marker.x, cy: marker.y, r: 7 }));
      const label = svg('text', { class: 'rose__waypoint-label', x: text.x, y: text.y + 5, 'text-anchor': side, 'aria-hidden': 'true' });
      label.textContent = w.short;
      link.append(label);
      const on = () => {
        points.querySelectorAll('.is-active').forEach((node) => node.classList.remove('is-active'));
        link.classList.add('is-active');
        needle.style.transform = `rotate(${w.heading}deg)`;
        steerHero(w.heading);
      };
      const off = () => {
        link.classList.remove('is-active');
        if (points.querySelector('.is-active')) return;
        needle.style.transform = '';
        steerHero(0);
      };
      link.addEventListener('mouseenter', on);
      link.addEventListener('focus', on);
      link.addEventListener('mouseleave', off);
      link.addEventListener('blur', off);
      points.append(link);
    });
    root.append(points, needle);
    return root;
  }

  function init() {
    if ('ResizeObserver' in window) {
      observer = new window.ResizeObserver((entries) => entries.forEach((entry) => {
        if (entry.target.isConnected && entry.target.placeTape) entry.target.placeTape(entry.target);
        else { observer.unobserve(entry.target); tapes.delete(entry.target); }
      }));
    }
    const tape = document.getElementById('topbar-tape');
    if (tape) fillTape(tape, 'thin', placeTopbar);
    // Het menu verschuift als de kopbalk zich aanpast (js/disciplines.js) of het lettertype laadt
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    window.addEventListener('resize', update);
  }

  ns.instruments = { init, update, heroTape, rose, steerHero };
})(window.AIAudit);
