/* ==========================================================================
   Radar: wat er nieuw is sinds je vorige bezoek (startpagina)
   --------------------------------------------------------------------------
   Op de kompasroos in de hero verschijnen stipjes bij het onderdeel waar iets
   nieuws staat (een veeg van de radar 'vindt' ze bij het openen); onder het
   zoekvak staat hetzelfde als lijstje met links (ook op een telefoon en voor
   toetsenbord en schermlezer). Op een smal scherm, waar de roos niet staat,
   draait er een klein radartje in die strook.
   Wat je kent, bewaart deze browser per discipline (lokale opslag
   'radar:<discipline>': alleen adressen van items). Dit bezoek houdt het
   beginpunt vast (sessionStorage), zodat de stipjes bij verversen blijven
   staan. Bij je allereerste bezoek: wat recent is toegevoegd (het label Nieuw).
   Wat je opent of wegklikt, verdwijnt van de radar.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage } = ns.ui;
  const MAX_KEYS = 3000;
  // Bij welk koerspunt van de roos een soort hoort (js/instruments.js)
  const HEADINGS = { usecase: 30, prompt: 90, tip: 150, training: 210, agent: 270 };
  // Waar de stipjes van één soort komen: naast de koers van het onderdeel (daar staat het label) en op
  // een andere afstand, zodat ze niet overlappen
  const SPREAD = [-15, 15, -27, 27, -9, 9, -21];
  const RADII = [160, 135, 185, 150, 175, 120, 195];

  const storeKey = () => 'radar:' + ns.cockpit.activeId();
  const sessionKey = () => (ns.app.config().storageNamespace || 'ai-snackbar-audit') + ':radar:' + ns.cockpit.activeId();

  function readSession() {
    try {
      return JSON.parse(window.sessionStorage.getItem(sessionKey()) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeSession(value) {
    try {
      window.sessionStorage.setItem(sessionKey(), JSON.stringify(value));
    } catch (error) {
      /* geen opslag: dan alleen zolang de pagina open is */
    }
  }

  /** Alles wat een collega kan openen (geen concepten of tips op slot): [{ kind, item, key }]. */
  function everything() {
    const c = ns.content;
    const out = [];
    const add = (kind, list) => list.forEach((item) => {
      if (!item.draft && !item.change && !item.locked) out.push({ kind, item, key: kind + ':' + item.id });
    });
    add('usecase', c.usecases);
    add('prompt', c.prompts.filter((item) => !item.usecase)); // een prompt uit een usecase hoort bij die usecase
    add('tip', c.openTips);
    add('training', c.trainings.filter((item) => item.available));
    add('agent', c.agents.filter((item) => !item.stopped));
    return out;
  }

  /**
   * Wat nieuw is (nieuwste eerst). { first: true } bij je allereerste bezoek: dan wat recent is toegevoegd.
   * Legt ook vast wat je nu kent, voor je volgende bezoek.
   */
  function fresh() {
    const all = everything();
    let session = readSession();
    const stored = storage.get(storeKey(), null);
    const storedKeys = stored && Array.isArray(stored.keys) ? stored.keys : null;
    if (!session) {
      session = { first: !storedKeys, known: storedKeys || [], seen: [] };
      writeSession(session);
    }
    // Wat je kent: ook wat er tijdens dit bezoek bij kwam (de nieuwste achteraan, de oudste vallen eraf)
    const keys = Array.from(new Set((storedKeys || []).concat(all.map((entry) => entry.key))));
    storage.set(storeKey(), { at: new Date().toISOString(), keys: keys.slice(-MAX_KEYS) });

    const known = new Set(session.known);
    const gone = new Set(session.seen.concat(ns.ui.viewed.list()));
    const isFresh = session.first ? (entry) => ns.ui.isNew(entry.item.added) : (entry) => !known.has(entry.key);
    const list = all.filter((entry) => isFresh(entry) && !gone.has(entry.key))
      .sort((a, b) => ((a.item.added || '') < (b.item.added || '') ? 1 : (a.item.added || '') > (b.item.added || '') ? -1 : 0));
    return { first: session.first, list };
  }

  /** Weggeklikt: deze items verdwijnen van de radar (dit bezoek; je kende ze daarna al). */
  function dismiss(keys) {
    const session = readSession() || { first: false, known: [], seen: [] };
    session.seen = Array.from(new Set(session.seen.concat(keys)));
    writeSession(session);
  }

  /** Stipjes voor de kompasroos: [{ heading, radius, href, label, kind }] (hooguit max). */
  function blips(list, max) {
    const perKind = {};
    return list.slice(0, max || 8).map((entry) => {
      const n = perKind[entry.kind] = (perKind[entry.kind] || 0) + 1;
      const index = (n - 1) % SPREAD.length;
      return {
        heading: HEADINGS[entry.kind] + SPREAD[index],
        radius: RADII[index],
        href: ns.kinds.href(entry.kind, entry.item.id),
        label: entry.item.title,
        kind: ns.kinds.label(entry.kind)
      };
    });
  }

  /**
   * Klein radartje voor de strook (versiering): op een smal scherm, waar de kompasroos niet staat. Een draaiende
   * veeg en een stipje per nieuw item (hooguit drie) dat oplicht als de veeg langskomt.
   */
  function miniRadar(count) {
    const SVG = 'http://www.w3.org/2000/svg';
    const make = (tag, attrs) => {
      const node = document.createElementNS(SVG, tag);
      Object.keys(attrs).forEach((key) => node.setAttribute(key, attrs[key]));
      return node;
    };
    const root = make('svg', { class: 'radar-mini', viewBox: '-12 -12 24 24', 'aria-hidden': 'true', focusable: 'false' });
    root.append(make('circle', { class: 'radar-mini__ring', r: 10.5 }), make('circle', { class: 'radar-mini__ring', r: 5.5 }));
    // De veeg: een taartpunt van 40 graden met de voorrand bovenaan, draait rond het midden
    const sweep = make('g', { class: 'radar-mini__sweep' });
    sweep.append(make('path', { class: 'radar-mini__fill', d: 'M 0 0 L -6.75 -8.04 A 10.5 10.5 0 0 1 0 -10.5 Z' }), make('line', { class: 'radar-mini__edge', x1: 0, y1: 0, x2: 0, y2: -10.5 }));
    root.append(sweep);
    [[60, 7], [200, 4.5], [300, 8.5]].slice(0, Math.min(count, 3)).forEach(([deg, r]) => {
      const angle = (deg - 90) * Math.PI / 180;
      const blip = make('circle', { class: 'radar-mini__blip', cx: (r * Math.cos(angle)).toFixed(2), cy: (r * Math.sin(angle)).toFixed(2), r: 1.7 });
      blip.style.setProperty('--delay', (2.4 * deg / 360).toFixed(2) + 's');
      root.append(blip);
    });
    root.append(make('circle', { class: 'radar-mini__hub', r: 1.2 }));
    return root;
  }

  /** De strook onder het zoekvak in de hero, of null als er niets nieuws is. */
  function strip(state, onDismiss) {
    const list = state.list;
    if (!list.length) return null;
    const SHOW = 3;
    const link = (entry) => el('li', {}, [
      el('a', { className: 'radar-strip__item', attrs: { href: ns.kinds.href(entry.kind, entry.item.id) } }, [
        icon(ns.kinds.get(entry.kind).icon),
        el('span', { className: 'sr-only', text: ns.kinds.label(entry.kind) + ': ' }),
        el('span', { className: 'radar-strip__title', text: entry.item.title })
      ])
    ]);
    const items = el('ul', { className: 'radar-strip__list', attrs: { role: 'list', id: 'radar-list' } }, list.slice(0, SHOW).map(link));
    const rest = list.slice(SHOW);
    const more = rest.length ? el('button', { className: 'radar-strip__more', attrs: { type: 'button', 'aria-controls': 'radar-list', 'aria-expanded': 'false' } }, [el('span', { text: `+${rest.length} meer` })]) : null;
    if (more) {
      more.addEventListener('click', () => {
        rest.forEach((entry) => items.append(link(entry)));
        more.remove();
        const added = items.children[SHOW];
        if (added) added.querySelector('a').focus();
      });
    }
    const close = el('button', { className: 'radar-strip__close', attrs: { type: 'button', 'aria-label': 'Gezien: van de radar halen', title: 'Gezien' } }, [icon('close')]);
    const node = el('div', { className: 'radar-strip', attrs: { role: 'region', 'aria-label': state.first ? 'Nieuw in de cockpit' : 'Nieuw sinds je vorige bezoek' } }, [
      // Lampje naast de kompasroos; op een smal scherm (zonder roos) het radartje
      el('span', { className: 'radar-strip__lamp', attrs: { 'aria-hidden': 'true' } }),
      miniRadar(list.length),
      el('p', { className: 'radar-strip__label' }, [
        el('strong', { text: `${list.length} nieuw` }),
        el('span', { text: state.first ? ' in de cockpit' : ' sinds je vorige bezoek' })
      ]),
      items,
      more,
      close
    ]);
    close.addEventListener('click', () => {
      dismiss(list.map((entry) => entry.key));
      node.remove();
      if (onDismiss) onDismiss();
      ns.ui.announce('Van de radar gehaald');
    });
    return node;
  }

  ns.radar = { fresh, dismiss, blips, strip, everything };
})(window.AIAudit);
