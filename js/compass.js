/* ==========================================================================
   Seizoenskompas: wat er nu speelt in het jaar (startpagina)
   --------------------------------------------------------------------------
   De seizoenen komen uit Beheer → Inhoud → Teksten (instelling 'seasons'),
   anders uit data/seizoenen.js voor deze discipline. Op de startpagina:
   - een wijzerplaat met de twaalf maanden, de seizoenen als bogen en een
     naald op vandaag (versiering; alles staat ook als tekst ernaast);
   - wat nu op koers ligt, wat er ook speelt en wat hierna komt;
   - de usecases, prompts en tips die nu het handigst zijn: eerst wat de
     zoekwoorden van een seizoen vinden, dan uit de fasen, om en om per
     seizoen zodat ieder seizoen dat nu speelt aan bod komt.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass, ACCENTS } = ns.ui;
  const SVG = 'http://www.w3.org/2000/svg';
  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const FALLBACK = ['teal', 'crimson', 'steel', 'deepteal', 'rose', 'navy'];

  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const words = (value) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

  /** Seizoenen controleren en aanvullen: alleen met een titel en minstens één geldige maand. */
  function tidy(raw) {
    return (Array.isArray(raw) ? raw : []).map((season, index) => {
      if (!season || typeof season !== 'object') return null;
      const months = Array.from(new Set((Array.isArray(season.months) ? season.months : []).map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))).sort((a, b) => a - b);
      const title = text(season.title);
      if (!title || !months.length) return null;
      const phases = words(season.phases);
      const firstPhase = ns.content && ns.content.phaseById ? phases.map((id) => ns.content.phaseById.get(id)).find(Boolean) : null;
      const accent = ACCENTS.includes(season.accent) ? season.accent : firstPhase ? firstPhase.accent : FALLBACK[index % FALLBACK.length];
      return { title, months, text: text(season.text), phases, keywords: words(season.keywords), accent, order: index };
    }).filter(Boolean);
  }

  /** De seizoenen van deze cockpit: uit Beheer, anders de startwaarden van de discipline. */
  function seasons(config, disciplineId) {
    const own = tidy(config && config.seasons);
    if (own.length) return own;
    return tidy((ns.seasons || {})[disciplineId] || []);
  }

  /** Maand van een datum (JJJJ-MM-DD): 1 … 12. */
  const monthOf = (day) => Number(String(day).slice(5, 7));

  /** Hoeveel maanden achter elkaar dit seizoen loopt rond deze maand (ook over de jaarwisseling). */
  function runLength(season, month) {
    if (!season.months.includes(month)) return 0;
    if (season.months.length === 12) return 12;
    let length = 1;
    for (let m = month - 1, n = 0; n < 11; m--, n++) {
      if (!season.months.includes(((m + 11) % 12) + 1)) break;
      length++;
    }
    for (let m = month + 1, n = 0; n < 11; m++, n++) {
      if (!season.months.includes(((m - 1) % 12) + 1)) break;
      length++;
    }
    return Math.min(length, 12);
  }

  /**
   * Wat er op een dag speelt: de seizoenen van deze maand, het belangrijkste eerst (het langst
   * aaneengesloten seizoen rond deze maand; bij gelijk de volgorde uit Beheer).
   */
  function active(list, day) {
    const month = monthOf(day);
    return list.filter((season) => season.months.includes(month))
      .sort((a, b) => runLength(b, month) - runLength(a, month) || a.order - b.order);
  }

  /**
   * De fasen van wat nu speelt (Fasen bij dit seizoen), het belangrijkste seizoen eerst: [{ phase, season }].
   * Alleen fasen die in deze cockpit bestaan. Die komen bovenaan bij prompts, usecases en agents & tools.
   */
  function nowPhases(config, day) {
    const out = [];
    active(seasons(config, ns.cockpit.activeId()), day || ns.content.today()).forEach((season) => season.phases.forEach((id) => {
      const phase = ns.content.phaseById.get(id);
      if (phase && !out.some((entry) => entry.phase === phase)) out.push({ phase, season });
    }));
    return out;
  }

  /** Label 'Nu in het seizoen: …' bij een uitgelichte groep. */
  function badge(titles) {
    return el('p', { className: 'p-group__season' }, [icon('compass'), el('span', { text: 'Nu in het seizoen: ' + [].concat(titles).join(' · ') })]);
  }

  /** Wat er hierna begint (een seizoen dat nu nog niet speelt): { season, month } of null. */
  function next(list, day) {
    const month = monthOf(day);
    const now = new Set(active(list, day));
    for (let step = 1; step <= 12; step++) {
      const m = ((month - 1 + step) % 12) + 1;
      const previous = ((m + 10) % 12) + 1;
      const starting = list.filter((season) => !now.has(season) && season.months.includes(m) && !season.months.includes(previous));
      if (starting.length) return { season: starting.sort((a, b) => a.order - b.order)[0], month: m };
    }
    return null;
  }

  /** 'jul – sep', 'dec', 'jan, apr, jul, okt' (aaneengesloten stukken als bereik). */
  function monthsText(months) {
    if (new Set(months).size === 12) return 'het hele jaar';
    return runs(months).map(([from, to]) => (from === to ? SHORT[from - 1] : `${SHORT[from - 1]} – ${SHORT[(to - 1) % 12]}`)).join(', ');
  }

  /**
   * Wat nu het handigst is: per seizoen eerst wat de zoekwoorden vinden, dan de usecases en losse
   * prompts uit de fasen (uitgelicht eerst); om en om per seizoen. [{ kind, item, season }]
   */
  function picks(list, limit) {
    const max = limit || 4;
    const seen = new Set();
    const queues = list.map((season) => {
      const found = [];
      season.keywords.forEach((word) => {
        const result = ns.content.search(word);
        result.usecases.forEach((item) => found.push({ kind: 'usecase', item }));
        result.prompts.filter((item) => !item.usecase).forEach((item) => found.push({ kind: 'prompt', item }));
        result.tips.forEach((item) => found.push({ kind: 'tip', item }));
      });
      const phases = new Set(season.phases);
      ns.content.usecases.filter((item) => phases.has(item.phase.id))
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order)
        .forEach((item) => found.push({ kind: 'usecase', item }));
      ns.content.prompts.filter((item) => !item.usecase && phases.has(item.phase.id)).forEach((item) => found.push({ kind: 'prompt', item }));
      return found.map((entry) => Object.assign(entry, { season }));
    });
    const out = [];
    for (let round = 0; out.length < max && queues.some((queue) => queue.length); round++) {
      queues.forEach((queue) => {
        while (queue.length && out.length < max) {
          const entry = queue.shift();
          const key = entry.kind + ':' + entry.item.id;
          if (seen.has(key) || entry.item.locked) continue;
          seen.add(key);
          out.push(entry);
          break;
        }
      });
    }
    return out;
  }

  /* ---- Wijzerplaat -------------------------------------------------------------- */
  function svg(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
    return node;
  }

  // 0 graden = boven (1 januari), met de klok mee
  const at = (deg, r) => {
    const angle = (deg - 90) * Math.PI / 180;
    return [r * Math.cos(angle), r * Math.sin(angle)];
  };

  function arcPath(fromDeg, toDeg, r) {
    const [x1, y1] = at(fromDeg, r);
    const [x2, y2] = at(toDeg, r);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  /** Aaneengesloten stukken van een seizoen: [[begin, eind], …] in maanden (eind > 12 over de jaarwisseling: 13 = januari). */
  function runs(months) {
    const set = new Set(months);
    if (set.size === 12) return [[1, 12]];
    const out = [];
    months.forEach((m) => {
      if (set.has(((m + 10) % 12) + 1)) return; // geen begin
      let end = m;
      while (set.has((end % 12) + 1) && end - m < 11) end++;
      out.push([m, end]);
    });
    return out;
  }

  /** Bogen op banen verdelen: seizoenen die overlappen komen op een andere baan. */
  function tracks(list) {
    const lanes = [];
    return list.map((season) => {
      let lane = lanes.findIndex((taken) => season.months.every((m) => !taken.has(m)));
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(new Set());
      }
      season.months.forEach((m) => lanes[lane].add(m));
      return lane;
    });
  }

  /** De wijzerplaat (versiering, aria-hidden): maanden, seizoensbogen en de naald op vandaag. */
  function dial(list, day) {
    const month = monthOf(day);
    const date = Number(String(day).slice(8, 10)) || 1;
    const length = new Date(Number(String(day).slice(0, 4)), month, 0).getDate();
    const now = new Set(active(list, day));
    const root = svg('svg', { class: 'compass__dial', viewBox: '-120 -120 240 240', 'aria-hidden': 'true', focusable: 'false' });
    root.append(svg('circle', { class: 'compass__face', r: 112 }));
    for (let m = 0; m < 12; m++) {
      const [x1, y1] = at(m * 30, 96);
      const [x2, y2] = at(m * 30, 103);
      root.append(svg('line', { class: 'compass__tick', x1, y1, x2, y2 }));
      const [lx, ly] = at(m * 30 + 15, 104);
      const label = svg('text', { class: 'compass__month' + (m + 1 === month ? ' is-now' : ''), x: lx.toFixed(1), y: (ly + 4).toFixed(1), 'text-anchor': 'middle' });
      label.textContent = LETTERS[m];
      root.append(label);
    }
    const lane = tracks(list);
    list.forEach((season, index) => {
      const r = 86 - lane[index] * 13;
      const group = svg('g', { class: 'compass__season ' + accentClass(season.accent) + (now.has(season) ? ' is-now' : '') });
      runs(season.months).forEach(([from, to]) => {
        group.append(svg('path', { class: 'compass__arc', d: arcPath((from - 1) * 30 + 2.5, to * 30 - 2.5, r) }));
      });
      root.append(group);
    });
    // De naald: vandaag, tussen het begin en het eind van de maand
    const deg = ((month - 1) + (date - 0.5) / length) * 30;
    const needle = svg('g', { class: 'compass__needle' });
    needle.style.setProperty('--sweep', deg.toFixed(1) + 'deg'); // draait bij het openen vanaf januari naar vandaag
    const [nx, ny] = at(deg, 99);
    needle.append(svg('line', { class: 'compass__hand', x1: 0, y1: 0, x2: nx.toFixed(2), y2: ny.toFixed(2) }));
    needle.append(svg('circle', { class: 'compass__tip', cx: nx.toFixed(2), cy: ny.toFixed(2), r: 4.5 }));
    needle.append(svg('circle', { class: 'compass__hub', r: 5 }));
    root.append(needle);
    return root;
  }

  /**
   * Het blok op de startpagina, of null zonder seizoenen. row(kind, item, kicker) maakt een regel
   * (dezelfde als 'Recent toegevoegd', uit js/view-home.js).
   */
  function section(config, row) {
    const list = seasons(config, ns.cockpit.activeId());
    if (!list.length) return null;
    const day = ns.content.today();
    const month = monthOf(day);
    const now = active(list, day);
    const coming = next(list, day);
    const main = now[0];
    const also = now.slice(1);
    const items = picks(now.length ? now : coming ? [coming.season] : [], 4);

    const whole = el('details', { className: 'compass__year' }, [
      el('summary', {}, [el('span', { text: 'Het hele jaar' }), icon('chevron-down')]),
      el('ul', { className: 'compass__seasons', attrs: { role: 'list' } }, list.map((season) => el('li', { className: accentClass(season.accent) + (now.includes(season) ? ' is-now' : '') }, [
        el('span', { className: 'compass__when', text: monthsText(season.months) }),
        el('span', { text: season.title })
      ])))
    ]);

    const panel = el('div', { className: 'compass__panel on-dark' }, [
      dial(list, day),
      el('div', { className: 'compass__now' }, [
        el('p', { className: 'compass__eyebrow' }, [icon('compass'), el('span', { text: `Seizoenskompas · ${ns.i18n.english() ? ns.i18n.month(month - 1) : MONTHS[month - 1]}` })]),
        main
          ? el('h2', { className: 'compass__title', attrs: { id: 'home-compass' } }, [el('span', { className: 'compass__label', text: 'Nu op koers: ' }), main.title])
          : el('h2', { className: 'compass__title', attrs: { id: 'home-compass' }, text: 'Rustig vaarwater' }),
        main && main.text ? el('p', { className: 'compass__text', text: main.text }) : null,
        also.length ? el('p', { className: 'compass__also' }, [
          el('span', { text: 'Ook nu: ' }),
          ...also.map((season) => el('span', { className: 'compass__chip ' + accentClass(season.accent), text: season.title }))
        ]) : null,
        coming ? el('p', { className: 'compass__next' }, [icon('arrow-right'), el('span', { text: `Hierna: ${coming.season.title} (vanaf ${ns.i18n.english() ? ns.i18n.month(coming.month - 1) : MONTHS[coming.month - 1]})` })]) : null,
        whole
      ])
    ]);

    const picksNode = items.length ? el('div', { className: 'compass__picks' }, [
      el('h3', { className: 'compass__picks-title', text: now.length ? 'Handig in deze periode' : 'Alvast handig' }),
      el('ul', { className: 'recent recent--stack', attrs: { role: 'list' } }, items.map((entry) => row(entry.kind, entry.item, [ns.kinds.label(entry.kind) + ' · ' + entry.season.title])))
    ]) : null;

    return el('section', { className: 'section container', attrs: { 'aria-labelledby': 'home-compass' } }, [
      el('div', { className: 'compass' + (picksNode ? '' : ' compass--solo') }, [panel, picksNode])
    ]);
  }

  ns.compass = { tidy, seasons, active, next, nowPhases, badge, picks, monthsText, runLength, section, MONTHS, SHORT };
})(window.AIAudit);
