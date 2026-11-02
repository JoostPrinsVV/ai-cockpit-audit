/* ==========================================================================
   Beheer → Doelkoers (#/beheer/doelkoers)
   --------------------------------------------------------------------------
   Per discipline doelen stellen voor het Copilot-gebruik en de cockpit, en
   zien of je op koers ligt. Een doel: een kengetal (METRICS), een doelwaarde,
   een einddatum en een begin (standaard de eerste meting). De koers is een
   rechte lijn van de beginwaarde naar het doel; de laatste meting zet je
   daartegenover:
     Doel gehaald · Op koers · Iets achter (binnen 10% van de weg) · Achter op
     koers · Niet gehaald (einddatum voorbij) · Nog geen gegevens.
   Het tempo is een rechte lijn door de laatste metingen (hooguit 8): daarmee
   'Bij dit tempo haal je het doel rond …'.
   Bronnen: de imports van Copilot-gebruik (alleen totalen) en de anonieme
   tellers van de cockpit. Opslag: één rij per discipline in
   audit_copilot_usage (central.listGoals/saveGoals; stap 9, geen nieuwe SQL).
   Ook in Overzicht (alle disciplines) en als tegel op Start.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const { niceTicks, svg } = ns.adminChart;

  const DAY = 86400000;
  const time = (date) => Date.parse(date + 'T00:00:00Z');
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const NUMBER = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const DECIMAL = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
  const MONTH = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  /* ---- Gegevens --------------------------------------------------------------------- */
  /** Maandag van de week van een tijdstip (UTC), als JJJJ-MM-DD. */
  function weekOf(t) {
    const d = new Date(t);
    return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  }

  /** Lopend gemiddelde over n punten (de eerste punten over wat er is). */
  const rolling = (points, n) => points.map((point, index) => {
    const part = points.slice(Math.max(0, index - n + 1), index + 1);
    return { date: point.date, value: part.reduce((total, p) => total + p.value, 0) / part.length };
  });

  /** De weken uit de imports, met het aantal personen van die import (bij overlap de nieuwste). */
  function weeksOf(snapshots) {
    const map = new Map();
    snapshots.forEach((snapshot) => snapshot.weekly.forEach((week) => map.set(week.week, {
      date: week.week, active: week.active.basic + week.active.premium, volume: week.volume.basic + week.volume.premium, people: snapshot.people
    })));
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  /** Tellers van de cockpit per volle week (niet de lopende), vanaf de eerste week met een teller; een week zonder telt als 0. */
  function eventWeeks(events, kinds, today) {
    const counts = new Map();
    events.forEach((event) => {
      if (!kinds.test(event.kind)) return;
      const week = weekOf(Date.parse(event.occurred_at));
      counts.set(week, (counts.get(week) || 0) + 1);
    });
    if (!counts.size) return [];
    const current = weekOf(time(today));
    const out = [];
    for (let t = time(Array.from(counts.keys()).sort()[0]); iso(t) < current; t += 7 * DAY) out.push({ date: iso(t), value: counts.get(iso(t)) || 0 });
    return out;
  }

  /** Alles wat de kengetallen nodig hebben, uit de rijen van Copilot-gebruik en de tellers van één discipline. */
  function dataFor(rows, events, today) {
    const snapshots = (rows || []).filter((row) => ns.adminCopilot.isUsage(row.summary))
      .map((row) => Object.assign({}, row.summary, { periodStart: row.period_start, periodEnd: row.period_end }))
      .sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : 1));
    return { snapshots, events: events || [], today };
  }

  const share = (part, whole) => (whole ? (part / whole) * 100 : null);
  /* De kengetallen. Hoger is beter. unit '%' (procentpunten) of 'per week' (aantal keer per week). */
  const METRICS = [
    {
      id: 'adoptie', source: 'copilot', label: 'Adoptie', unit: '%',
      text: 'Deel van de collega\'s met Copilot dat in de laatste 4 weken actief was (per import).',
      points: (d) => d.snapshots.map((s) => ({ date: s.periodEnd, value: share(s.licences.basic.active4w + s.licences.premium.active4w, s.licences.basic.people + s.licences.premium.people) }))
    },
    {
      id: 'wekelijks', source: 'copilot', label: 'Wekelijks actief', unit: '%',
      text: 'Gemiddeld deel van de collega\'s dat per week actief is (lopend gemiddelde over 4 weken).',
      points: (d) => rolling(weeksOf(d.snapshots).filter((w) => w.people).map((w) => ({ date: w.date, value: share(w.active, w.people) })), 4)
    },
    {
      id: 'licenties', source: 'copilot', label: 'Licenties benut', unit: '%',
      text: 'Deel van de collega\'s met een Copilot-licentie (Premium) dat in de laatste 4 weken actief was (per import).',
      points: (d) => d.snapshots.filter((s) => s.licences.premium.people).map((s) => ({ date: s.periodEnd, value: share(s.licences.premium.active4w, s.licences.premium.people) }))
    },
    {
      id: 'intensiteit', source: 'copilot', label: 'Gebruik per actieve collega', unit: 'per week',
      text: 'Hoe vaak een actieve collega Copilot gemiddeld per week gebruikt (lopend gemiddelde over 4 weken).',
      points: (d) => rolling(weeksOf(d.snapshots).filter((w) => w.active).map((w) => ({ date: w.date, value: w.volume / w.active })), 4)
    },
    {
      id: 'kopieen', source: 'cockpit', label: 'Prompts gekopieerd', unit: 'per week',
      text: 'Hoe vaak per week een prompt of voorbeeld uit de cockpit wordt gekopieerd (lopend gemiddelde over 4 weken).',
      points: (d) => rolling(eventWeeks(d.events, /^copy_/, d.today), 4)
    },
    {
      id: 'bekeken', source: 'cockpit', label: 'Cockpit bekeken', unit: 'per week',
      text: 'Hoe vaak per week usecases, demo\'s, tips, trainingen en agents in de cockpit worden bekeken (lopend gemiddelde over 4 weken).',
      points: (d) => rolling(eventWeeks(d.events, /^(view_|play_|open_)/, d.today), 4)
    }
  ];
  const SOURCES = { copilot: 'Copilot-gebruik', cockpit: 'Gebruik van de cockpit' };
  const metricOf = (id) => METRICS.find((metric) => metric.id === id) || null;
  const valid = (point) => point && point.value != null && Number.isFinite(point.value);
  const pointsOf = (metric, data) => metric.points(data).filter(valid);

  /** '52%' of '12,5' (in een zin: '12,5 keer per week'). */
  const format = (metric, value) => (value == null || !Number.isFinite(value) ? '–' : metric.unit === '%' ? NUMBER.format(value) + '%' : DECIMAL.format(value));
  const withUnit = (metric, value) => (metric.unit === '%' ? format(metric, value) : `${format(metric, value)} keer per week`);
  const difference = (metric, value) => (metric.unit === '%' ? `${DECIMAL.format(value)} %-punt` : `${DECIMAL.format(value)} keer per week`);

  /* ---- Op koers? ---------------------------------------------------------------------- */
  const STATUS = {
    gehaald: { label: 'Doel gehaald', tone: 'good', icon: 'star-filled' },
    'op-koers': { label: 'Op koers', tone: 'good', icon: 'check-circle' },
    bijna: { label: 'Iets achter', tone: 'warn', icon: 'alert' },
    achter: { label: 'Achter op koers', tone: 'bad', icon: 'arrow-down' },
    gemist: { label: 'Niet gehaald', tone: 'bad', icon: 'close' },
    geen: { label: 'Nog geen gegevens', tone: 'none', icon: 'info' }
  };

  /**
   * Hoe een doel ervoor staat. goal: { target, deadline, start?, baseline? }, points: [{ date, value }] (oud naar nieuw).
   * { status, baseline, target, current, currentDate, planned, at(date), slope (per dag), projected, start, end }
   */
  function progress(goal, points, today) {
    const day = today || new Date().toISOString().slice(0, 10);
    const target = Number(goal.target);
    const start = goal.start || (points[0] && points[0].date) || day;
    const end = goal.deadline;
    const first = points.find((point) => point.date >= start) || points[points.length - 1] || null;
    const stored = goal.baseline != null && goal.baseline !== '' && Number.isFinite(Number(goal.baseline));
    const baseline = stored ? Number(goal.baseline) : first ? first.value : null;
    // De koers: van de beginwaarde op de begindatum naar het doel op de einddatum
    const at = (date) => {
      const span = time(end) - time(start);
      const done = span > 0 ? Math.min(1, Math.max(0, (time(date) - time(start)) / span)) : 1;
      return baseline + (target - baseline) * done;
    };
    if (!points.length || baseline == null) return { status: 'geen', baseline, target, at, start, end };
    const last = points[points.length - 1];
    const current = last.value;
    const planned = at(last.date);
    // Tempo: een rechte lijn door de laatste metingen (kleinste kwadraten, per dag)
    const recent = points.slice(-8);
    let slope = null;
    if (recent.length >= 2) {
      const xs = recent.map((point) => (time(point.date) - time(recent[0].date)) / DAY);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = recent.reduce((a, p) => a + p.value, 0) / recent.length;
      const top = xs.reduce((total, x, i) => total + (x - mx) * (recent[i].value - my), 0);
      const bottom = xs.reduce((total, x) => total + (x - mx) ** 2, 0);
      slope = bottom ? top / bottom : null;
    }
    let projected = null;
    if (current >= target) projected = last.date;
    else if (slope > 0 && (target - current) / slope < 5 * 365) projected = iso(time(last.date) + ((target - current) / slope) * DAY);
    const span = Math.abs(target - baseline) || Math.abs(target) || 1;
    let status;
    if (current >= target) status = 'gehaald';
    else if (day > end) status = 'gemist';
    else if (current >= planned - 1e-9) status = 'op-koers';
    else if (current >= planned - span * 0.1) status = 'bijna';
    else status = 'achter';
    return { status, baseline, target, current, currentDate: last.date, planned, at, slope, projected, start, end };
  }

  /** In één zin: waar je staat, en wat het tempo zegt. */
  function sentence(metric, goal, r) {
    const f = (value) => withUnit(metric, value);
    if (r.status === 'gehaald') return `Doel gehaald: ${f(r.current)}, het doel was ${f(r.target)}.`;
    if (r.status === 'gemist') return `De einddatum (${formatDate(goal.deadline)}) is voorbij: ${f(r.current)} van de ${f(r.target)}.`;
    const pace = r.slope == null
      ? 'Voor een tempo zijn minstens twee metingen nodig.'
      : r.projected
        ? `Bij dit tempo haal je het doel rond ${MONTH.format(new Date(time(r.projected)))}${r.projected <= goal.deadline ? ', op tijd' : ', na de einddatum'}.`
        : 'Bij dit tempo kom je niet bij het doel: het groeit niet.';
    if (r.status === 'op-koers') return `Op koers: ${f(r.current)}, de koers ligt nu op ${f(r.planned)}. ${pace}`;
    return `${difference(metric, r.planned - r.current)} achter op de koers: ${f(r.current)} tegen ${f(r.planned)}. ${pace}`;
  }

  /* ---- Tekenen ------------------------------------------------------------------------- */
  /** Van de beginwaarde naar het doel: hoe ver je bent (gevuld) en waar de koers nu ligt (streepje). */
  function band(metric, r) {
    const span = r.target - r.baseline || 1;
    const pos = (value) => Math.max(0, Math.min(1, (value - r.baseline) / span));
    const fill = el('span', { className: 'goal-band__fill' });
    fill.style.setProperty('--to', String(pos(r.current)));
    const course = el('span', { className: 'goal-band__course' });
    course.style.setProperty('--at', String(pos(r.planned)));
    return el('div', { className: 'goal-band' }, [
      el('div', { className: 'goal-band__track', attrs: { role: 'img', 'aria-label': `${NUMBER.format(pos(r.current) * 100)}% van de weg van ${format(metric, r.baseline)} naar ${format(metric, r.target)}; de koers ligt nu op ${NUMBER.format(pos(r.planned) * 100)}%.` } }, [fill, course]),
      el('div', { className: 'goal-band__scale', attrs: { 'aria-hidden': 'true' } }, [
        el('span', { text: 'Begin ' + format(metric, r.baseline) }),
        el('span', { text: 'Doel ' + format(metric, r.target) })
      ])
    ]);
  }

  /**
   * De grafiek: de metingen (lijn), de koers van begin naar doel (streepjes), het doel (vlag), vandaag en het tempo
   * (stippen). Met een draadkruis bij aanwijzen of met de pijltjes, en dezelfde cijfers als tabel.
   */
  function goalChart(metric, points, r, today) {
    const HEIGHT = 240;
    const plot = el('div', { className: 'chart__plot' });
    const readout = el('div', { className: 'chart__readout', attrs: { 'aria-live': 'polite', hidden: true } });
    const trend = r.slope > 0 && r.status !== 'gehaald' && r.status !== 'gemist';
    const section = el('div', { className: 'goal-chart' }, [
      el('ul', { className: 'chart__legend goal-chart__legend', attrs: { role: 'list' } }, [
        el('li', {}, [el('span', { className: 'goal-key goal-key--actual' }), el('span', { text: 'Gemeten' })]),
        el('li', {}, [el('span', { className: 'goal-key goal-key--course' }), el('span', { text: 'Koers naar het doel' })]),
        trend ? el('li', {}, [el('span', { className: 'goal-key goal-key--trend' }), el('span', { text: 'Bij dit tempo' })]) : null
      ]),
      plot,
      el('details', { className: 'chart__table' }, [
        el('summary', { text: 'Als tabel' }),
        el('div', { className: 'chart__table-scroll' }, [
          el('table', { className: 'table' }, [
            el('thead', {}, [el('tr', {}, ['Datum', 'Gemeten', 'Koers'].map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index ? 'num' : null } })))]),
            el('tbody', {}, points.map((point) => el('tr', {}, [
              el('th', { attrs: { scope: 'row' }, text: formatDate(point.date) }),
              el('td', { className: 'num', text: format(metric, point.value) }),
              el('td', { className: 'num', text: point.date >= r.start ? format(metric, r.at(point.date)) : '–' })
            ])))
          ])
        ])
      ])
    ]);

    let width = 0;
    let active = -1;
    let parts = null;
    function draw() {
      const M = { top: 22, right: 70, bottom: 30, left: 46 };
      const innerW = Math.max(60, width - M.left - M.right);
      const innerH = HEIGHT - M.top - M.bottom;
      const t0 = Math.min(time(points[0].date), time(r.start));
      const t1 = Math.max(time(points[points.length - 1].date), time(r.end));
      const x = (t) => M.left + ((t - t0) / Math.max(DAY, t1 - t0)) * innerW;
      const ticks = niceTicks(Math.max(r.target, ...points.map((point) => point.value)) * 1.08);
      const top = ticks[ticks.length - 1];
      const y = (value) => M.top + innerH - (Math.max(0, value) / top) * innerH;
      const label = (value) => (metric.unit === '%' ? NUMBER.format(value) + '%' : NUMBER.format(value));
      const root = svg('svg', {
        class: 'chart__svg', width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, tabindex: '0', role: 'img', focusable: 'true',
        'aria-label': `${metric.label}: laatste meting ${withUnit(metric, r.current)} (${formatDate(r.currentDate)}), koers ${withUnit(metric, r.planned)}, doel ${withUnit(metric, r.target)} op ${formatDate(r.end)}. Met de pijltjestoetsen per meting; alle cijfers staan ook in de tabel eronder.`
      });
      const grid = svg('g', { class: 'chart__grid' });
      ticks.forEach((value) => {
        grid.append(svg('line', { x1: M.left, x2: M.left + innerW, y1: y(value), y2: y(value), class: value === 0 ? 'chart__baseline' : '' }));
        grid.append(svg('text', { x: M.left - 8, y: y(value) + 4, 'text-anchor': 'end' }, label(value)));
      });
      // Maanden onder de as; bij een lange periode om de paar maanden
      const months = [];
      const begin = new Date(t0);
      for (let m = new Date(Date.UTC(begin.getUTCFullYear(), begin.getUTCMonth() + (begin.getUTCDate() > 1 ? 1 : 0), 1)); m.getTime() <= t1; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) months.push(m);
      const every = Math.max(1, Math.ceil(54 / (innerW / Math.max(1, (t1 - t0) / (30.4 * DAY)))));
      months.forEach((m, index) => {
        if (index % every) return;
        const text = MONTHS[m.getUTCMonth()] + (index === 0 || m.getUTCMonth() === 0 ? ' ' + m.getUTCFullYear() : '');
        grid.append(svg('line', { x1: x(m.getTime()), x2: x(m.getTime()), y1: M.top + innerH, y2: M.top + innerH + 4, class: 'chart__tick' }));
        grid.append(svg('text', { x: x(m.getTime()), y: HEIGHT - 8, 'text-anchor': 'middle' }, text));
      });
      root.append(grid);
      // Vandaag
      const now = time(today);
      if (now >= t0 && now <= t1) {
        root.append(svg('line', { x1: x(now), x2: x(now), y1: M.top, y2: M.top + innerH, class: 'goal-chart__today' }));
        root.append(svg('text', { x: x(now), y: M.top - 8, 'text-anchor': 'middle', class: 'goal-chart__today-label' }, 'Vandaag'));
      }
      // De koers en het doel
      root.append(svg('line', { x1: x(time(r.start)), y1: y(r.baseline), x2: x(time(r.end)), y2: y(r.target), class: 'goal-chart__course' }));
      root.append(svg('circle', { cx: x(time(r.end)), cy: y(r.target), r: 6, class: 'goal-chart__target' }));
      root.append(svg('text', { x: x(time(r.end)) + 10, y: y(r.target) + 4, class: 'chart__end' }, `Doel ${format(metric, r.target)}`));
      // Het tempo: van de laatste meting verder, tot het doel of de rand
      const lastT = time(r.currentDate);
      if (trend) {
        const reach = r.projected ? Math.min(time(r.projected), t1) : t1;
        root.append(svg('line', { x1: x(lastT), y1: y(r.current), x2: x(reach), y2: y(r.current + r.slope * ((reach - lastT) / DAY)), class: 'goal-chart__trend' }));
      }
      // De metingen
      const xs = points.map((point) => x(time(point.date)));
      let d = '';
      points.forEach((point, index) => {
        d += `${index ? 'L' : 'M'}${xs[index].toFixed(1)} ${y(point.value).toFixed(1)} `;
      });
      root.append(svg('path', { d: d.trim(), class: 'chart__line chart__line--1' }));
      if (points.length <= 14) points.forEach((point, index) => root.append(svg('circle', { cx: xs[index], cy: y(point.value), r: 3.5, class: 'chart__dot chart__dot--1' })));
      root.append(svg('circle', { cx: xs[xs.length - 1], cy: y(r.current), r: 5, class: 'chart__dot chart__dot--1' }));
      // Draadkruis bij aanwijzen
      const cross = svg('line', { y1: M.top, y2: M.top + innerH, class: 'chart__cross', visibility: 'hidden' });
      const dot = svg('circle', { r: 5, class: 'chart__dot chart__dot--1', visibility: 'hidden' });
      root.append(cross, dot, svg('rect', { x: M.left, y: M.top, width: innerW, height: innerH, class: 'chart__hit' }));
      parts = { xs, y, cross, dot };
      plot.replaceChildren(root, readout);
      wire(root);
      if (active >= 0) highlight(active);
    }
    function highlight(index) {
      active = index;
      const { xs, y, cross, dot } = parts;
      if (index < 0) {
        cross.setAttribute('visibility', 'hidden');
        dot.setAttribute('visibility', 'hidden');
        readout.hidden = true;
        return;
      }
      const point = points[index];
      cross.setAttribute('x1', xs[index]);
      cross.setAttribute('x2', xs[index]);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', xs[index]);
      dot.setAttribute('cy', y(point.value));
      dot.setAttribute('visibility', 'visible');
      readout.replaceChildren(
        el('p', { className: 'chart__readout-date', text: formatDate(point.date) }),
        el('p', { className: 'chart__readout-row' }, [el('span', { className: 'goal-key goal-key--actual' }), el('strong', { text: format(metric, point.value) }), el('span', { text: 'gemeten' })]),
        point.date >= r.start ? el('p', { className: 'chart__readout-row' }, [el('span', { className: 'goal-key goal-key--course' }), el('strong', { text: format(metric, r.at(point.date)) }), el('span', { text: 'koers' })]) : null
      );
      readout.hidden = false;
      const room = xs[index] + 14 + readout.offsetWidth <= width;
      readout.style.setProperty('--x', `${Math.round(room ? xs[index] + 14 : Math.max(0, xs[index] - 14 - readout.offsetWidth))}px`);
    }
    function wire(root) {
      const nearest = (clientX) => {
        const px = clientX - root.getBoundingClientRect().left;
        let best = 0;
        parts.xs.forEach((value, index) => {
          if (Math.abs(value - px) < Math.abs(parts.xs[best] - px)) best = index;
        });
        return best;
      };
      root.addEventListener('pointermove', (event) => highlight(nearest(event.clientX)));
      root.addEventListener('pointerleave', () => {
        if (document.activeElement !== root) highlight(-1);
      });
      root.addEventListener('focus', () => highlight(active >= 0 ? active : points.length - 1));
      root.addEventListener('blur', () => highlight(-1));
      root.addEventListener('keydown', (event) => {
        const steps = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
        if (event.key === 'Escape') highlight(-1);
        if (!(event.key in steps)) return;
        event.preventDefault();
        highlight(Math.max(0, Math.min(points.length - 1, (active < 0 ? points.length - 1 : active) + steps[event.key])));
      });
    }
    let shown = false;
    const observer = new ResizeObserver((entries) => {
      if (!section.isConnected) {
        if (shown) observer.disconnect();
        return;
      }
      shown = true;
      const next = Math.round(entries[0].contentRect.width);
      if (next && next !== width) {
        width = next;
        draw();
      }
    });
    observer.observe(plot);
    return section;
  }

  const statusBadge = (status) => {
    const info = STATUS[status];
    return el('span', { className: 'goal-status goal-status--' + info.tone }, [icon(info.icon), el('span', { text: info.label })]);
  };

  /** Eén doel: wat, de stand, de koersband, één zin en de grafiek. */
  function card(goal, data, today, actions) {
    const metric = metricOf(goal.metric);
    if (!metric) return null;
    const points = pointsOf(metric, data);
    const r = progress(goal, points, today);
    return el('article', { className: 'goal-card goal-card--' + STATUS[r.status].tone, attrs: { 'aria-labelledby': 'goal-' + goal.id } }, [
      el('div', { className: 'goal-card__head' }, [
        el('div', {}, [
          el('p', { className: 'goal-card__source', text: SOURCES[metric.source] }),
          el('h3', { className: 'goal-card__title', attrs: { id: 'goal-' + goal.id }, text: metric.label }),
          el('p', { className: 'goal-card__target' }, [icon('flag'), el('span', { text: `Doel: ${withUnit(metric, Number(goal.target))} op ${formatDate(goal.deadline)}` })])
        ]),
        el('div', { className: 'goal-card__side' }, [statusBadge(r.status), actions || null])
      ]),
      r.status === 'geen'
        ? el('p', { className: 'goal-card__empty', text: metric.source === 'copilot' ? 'Nog geen gegevens: lees een export in bij Copilot-gebruik.' : 'Nog geen tellers van de cockpit in deze periode.' })
        : el('div', { className: 'goal-card__body' }, [
          el('div', { className: 'goal-card__now' }, [
            el('p', { className: 'goal-card__value' }, [el('strong', { text: format(metric, r.current) }), metric.unit === '%' ? null : el('span', { text: ' per week' })]),
            el('p', { className: 'goal-card__when', text: `Laatste meting ${formatDate(r.currentDate)}` })
          ]),
          band(metric, r),
          el('p', { className: 'goal-card__line', text: sentence(metric, goal, r) }),
          goalChart(metric, points, r, today)
        ]),
      goal.note ? el('p', { className: 'goal-card__note' }, [icon('info'), el('span', { text: goal.note })]) : null
    ]);
  }

  /* ---- Het onderdeel in Beheer --------------------------------------------------------- */
  const EXAMPLES = [
    { metric: 'adoptie', target: 70, months: 9, label: 'Adoptie naar 70%' },
    { metric: 'wekelijks', target: 40, months: 6, label: 'Wekelijks actief naar 40%' },
    { metric: 'kopieen', target: 50, months: 6, label: '50 prompts per week gekopieerd' }
  ];

  function render() {
    const node = el('div', { className: 'goals' });
    const body = el('div', { className: 'goals__body' });
    const today = ns.content.today();
    const namespace = () => ns.cockpit.namespace(ns.cockpit.activeId());
    let goals = [];
    let data = null;
    let missing = false;
    let editing = null; // het doel in het formulier (null = nieuw)

    async function store(list) {
      await ns.central.saveGoals(list, namespace());
      goals = list;
      update();
    }

    function form(existing, preset) {
      const values = Object.assign({ metric: 'adoptie', target: '', deadline: '', start: '', note: '' }, preset || {}, existing || {});
      const metric = el('select', { className: 'field__input', attrs: { id: 'goal-metric' } }, Object.entries(SOURCES).map(([source, label]) =>
        el('optgroup', { attrs: { label } }, METRICS.filter((m) => m.source === source).map((m) => el('option', { attrs: { value: m.id }, text: m.label })))));
      metric.value = values.metric;
      const hint = el('p', { className: 'field__hint', attrs: { id: 'goal-metric-hint' } });
      const unit = el('span', { className: 'goals__unit' });
      const target = el('input', { className: 'field__input', attrs: { id: 'goal-target', type: 'number', min: '0', step: 'any', required: true, inputmode: 'decimal', 'aria-describedby': 'goal-target-unit' } });
      target.value = values.target;
      const deadline = el('input', { className: 'field__input', attrs: { id: 'goal-deadline', type: 'date', required: true } });
      deadline.value = values.deadline;
      const start = el('input', { className: 'field__input', attrs: { id: 'goal-start', type: 'date', 'aria-describedby': 'goal-start-hint' } });
      start.value = values.start;
      const note = el('input', { className: 'field__input', attrs: { id: 'goal-note', type: 'text', maxlength: '200', placeholder: 'Bijv. afgesproken in het innovatie-overleg' } });
      note.value = values.note;
      const error = el('p', { className: 'field__error', attrs: { role: 'alert' } });
      function describe() {
        const m = metricOf(metric.value);
        const points = data ? pointsOf(m, data) : [];
        const last = points[points.length - 1];
        hint.textContent = m.text + (last ? ` Nu: ${withUnit(m, last.value)} (${formatDate(last.date)}).` : ' Nog geen metingen.');
        unit.textContent = m.unit === '%' ? '%' : 'keer per week';
        unit.id = 'goal-target-unit';
        target.max = m.unit === '%' ? '100' : '';
      }
      metric.addEventListener('change', describe);
      describe();
      const save = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'submit' } }, [icon('check'), el('span', { text: existing ? 'Doel opslaan' : 'Doel toevoegen' })]);
      const cancel = existing ? el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: () => { editing = null; update(); } } }, [el('span', { text: 'Annuleren' })]) : null;
      const node = el('form', { className: 'goals__form', attrs: { novalidate: true, 'aria-labelledby': 'goal-form-title' } }, [
        el('h3', { className: 'usage-table__title', attrs: { id: 'goal-form-title' }, text: existing ? 'Doel aanpassen' : 'Doel toevoegen' }),
        el('div', { className: 'goals__fields' }, [
          el('div', { className: 'field goals__field--wide' }, [el('label', { className: 'field__label', attrs: { for: 'goal-metric' }, text: 'Waarop stuur je?' }), metric, hint]),
          el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'goal-target' }, text: 'Doel' }), el('div', { className: 'goals__with-unit' }, [target, unit])]),
          el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'goal-deadline' }, text: 'Uiterlijk op' }), deadline]),
          el('div', { className: 'field' }, [
            el('label', { className: 'field__label', attrs: { for: 'goal-start' } }, ['Koers vanaf ', el('span', { className: 'field__optional', text: '(optioneel)' })]),
            start,
            el('p', { className: 'field__hint', attrs: { id: 'goal-start-hint' }, text: 'Leeg = vanaf de eerste meting. De koers loopt van de waarde op die datum naar het doel.' })
          ]),
          el('div', { className: 'field goals__field--wide' }, [el('label', { className: 'field__label', attrs: { for: 'goal-note' } }, ['Toelichting ', el('span', { className: 'field__optional', text: '(optioneel)' })]), note])
        ]),
        error,
        el('div', { className: 'admin-item__actions' }, [save, cancel])
      ]);
      node.addEventListener('submit', async (event) => {
        event.preventDefault();
        const m = metricOf(metric.value);
        const value = Number(target.value);
        const problem = !(value > 0) ? 'Vul een doel in (groter dan 0).'
          : m.unit === '%' && value > 100 ? 'Een percentage kan niet hoger zijn dan 100.'
            : !/^\d{4}-\d{2}-\d{2}$/.test(deadline.value) ? 'Kies de datum waarop je het doel wilt halen.'
              : start.value && start.value >= deadline.value ? 'De koers moet beginnen vóór de einddatum.'
                : !existing && deadline.value <= today ? 'Kies een einddatum in de toekomst.' : '';
        error.textContent = problem;
        if (problem) return;
        // De beginwaarde vastleggen (dan verandert de koers niet als oude tellers wegvallen); bij aanpassen alleen als het begin of het kengetal verandert
        const same = existing && existing.metric === m.id && (existing.start || '') === start.value;
        const points = data ? pointsOf(m, data) : [];
        const begin = progress({ target: value, deadline: deadline.value, start: start.value || '' }, points, today);
        const goal = {
          id: existing ? existing.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          metric: m.id, target: value, deadline: deadline.value, start: start.value || (points[0] ? '' : today),
          baseline: same && existing.baseline != null ? existing.baseline : begin.baseline,
          note: note.value.trim().slice(0, 200), changedAt: new Date().toISOString()
        };
        const done = kit.busy(save, 'Opslaan…');
        try {
          await store(goals.filter((other) => other.id !== goal.id).concat(goal).sort((a, b) => (a.deadline < b.deadline ? -1 : 1)));
          editing = null;
          toast(existing ? 'Doel aangepast' : 'Doel toegevoegd', { tone: 'success' });
        } catch (failure) {
          done();
          kit.failed('Opslaan', failure);
        }
      });
      return node;
    }

    function update() {
      if (missing) {
        body.replaceChildren(notice({ tone: 'warning', title: 'Nog niet ingericht', text: 'Doelen staan bij het Copilot-gebruik: voer eerst setup/supabase-audit-copilot.sql (stap 9) uit.' }));
        return;
      }
      const results = goals.map((goal) => {
        const metric = metricOf(goal.metric);
        return metric ? progress(goal, pointsOf(metric, data), today) : null;
      }).filter(Boolean);
      const countOf = (...statuses) => results.filter((r) => statuses.includes(r.status)).length;
      const kpi = (value, label, tone) => el('div', { className: 'kpi goal-kpi goal-kpi--' + tone }, [el('span', { className: 'kpi__value', text: String(value) }), el('span', { className: 'kpi__label', text: label })]);
      const cards = goals.map((goal) => {
        if (editing === goal.id) return form(goal);
        const edit = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Doel aanpassen', title: 'Aanpassen' } }, [icon('pencil-line')]);
        edit.addEventListener('click', () => {
          editing = goal.id;
          update();
          const first = body.querySelector('#goal-metric');
          if (first) first.focus();
        });
        const remove = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Doel verwijderen', title: 'Verwijderen' } }, [icon('trash')]);
        remove.addEventListener('click', async () => {
          const metric = metricOf(goal.metric);
          if (!(await ns.ui.confirmDialog(`Het doel '${metric ? metric.label : goal.metric}: ${goal.target}' verdwijnt, ook uit het overzicht.`, { title: 'Doel verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
          try {
            await store(goals.filter((other) => other.id !== goal.id));
            toast('Verwijderd');
          } catch (failure) {
            kit.failed('Verwijderen', failure);
          }
        });
        return card(goal, data, today, el('span', { className: 'goal-card__actions' }, [edit, remove]));
      }).filter(Boolean);

      const examples = !goals.length ? el('div', { className: 'goals__examples' }, [
        el('p', { className: 'field__label', text: 'Begin met een voorbeeld:' }),
        ...EXAMPLES.map((example) => el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: () => {
          const end = new Date(time(today));
          end.setUTCMonth(end.getUTCMonth() + example.months);
          body.querySelector('.goals__form').replaceWith(form(null, { metric: example.metric, target: example.target, deadline: iso(end.getTime()) }));
          body.querySelector('#goal-target').focus();
        } } }, [el('span', { text: example.label })]))
      ]) : null;

      body.replaceChildren(...[
        goals.length ? el('div', { className: 'kpis goals__kpis' }, [
          kpi(countOf('op-koers', 'gehaald'), 'Op koers of gehaald', 'good'),
          kpi(countOf('bijna'), 'Iets achter', 'warn'),
          kpi(countOf('achter', 'gemist'), 'Achter op koers', 'bad'),
          kpi(goals.length, goals.length === 1 ? 'Doel' : 'Doelen', 'none')
        ]) : el('p', { className: 'section__lead goals__intro', text: `Stel doelen voor ${ns.cockpit.active().name}: bijvoorbeeld hoeveel collega's Copilot over een half jaar gebruiken, of hoe vaak prompts uit de cockpit worden gekopieerd. Dan zie je hier per doel of jullie op koers liggen.` }),
        cards.length ? el('div', { className: 'goals__list' }, cards) : null,
        examples,
        editing ? null : form(null),
        el('p', { className: 'field__hint', text: 'Bronnen: de imports van Copilot-gebruik (alleen totalen) en de anonieme tellers van de cockpit. De koers is een rechte lijn van de beginwaarde naar het doel; het tempo een rechte lijn door de laatste metingen. Doelen zie je ook in het Overzicht.' })
      ].filter(Boolean));
    }

    async function load() {
      body.replaceChildren(el('p', { className: 'loading', text: 'Doelen laden…' }));
      try {
        const [rows, goalRows] = await Promise.all([ns.central.listCopilotUsage(), ns.central.listGoals()]);
        missing = rows === null || goalRows === null;
        const own = (goalRows || []).find((row) => row.namespace === namespace());
        goals = own ? own.goals : [];
        // De tellers vanaf het vroegste begin (en minstens 4 maanden), voor de kengetallen van de cockpit
        const earliest = goals.map((goal) => goal.start).filter(Boolean).sort()[0];
        const days = Math.min(730, Math.max(120, earliest ? Math.ceil((time(today) - time(earliest)) / DAY) + 35 : 120));
        const events = await ns.central.adminEvents(days).catch(() => []);
        data = dataFor(rows || [], events, today);
        update();
      } catch (error) {
        body.replaceChildren(notice({ tone: 'warning', title: 'Laden mislukt', text: error.message }));
        if (!ns.central.signedIn()) node.dispatchEvent(new CustomEvent('signedout', { bubbles: true }));
      }
    }

    node.append(body);
    load();
    return { node };
  }

  /* ---- Overzicht en Start ------------------------------------------------------------ */
  /**
   * Alle doelen van alle disciplines met hun stand: [{ namespace, goal, metric, result }].
   * rows: alle rijen van Copilot-gebruik (ook die met de doelen), events: de tellers van alle disciplines.
   */
  function standings(rows, events, today) {
    return (rows || []).filter((row) => row.source === 'doelen' && row.summary && Array.isArray(row.summary.goals)).flatMap((row) => {
      const data = dataFor(rows.filter((other) => other.namespace === row.namespace), (events || []).filter((event) => event.namespace === row.namespace), today);
      return row.summary.goals.map((goal) => {
        const metric = metricOf(goal.metric);
        return metric ? { namespace: row.namespace, goal, metric, result: progress(goal, pointsOf(metric, data), today) } : null;
      }).filter(Boolean);
    });
  }

  /** Voor de tegel op Start: '2 van 3 doelen op koers' (due: er ligt iets achter). */
  async function startStatus() {
    const today = ns.content.today();
    const namespace = ns.cockpit.namespace(ns.cockpit.activeId());
    const [rows, goalRows, events] = await Promise.all([ns.central.listCopilotUsage(), ns.central.listGoals(), ns.central.adminEvents(120).catch(() => [])]);
    // De doelen als rij erbij (zoals in Overzicht, waar ze tussen de rijen van Copilot-gebruik staan)
    const goals = (goalRows || []).filter((row) => row.namespace === namespace).map((row) => ({ namespace, source: 'doelen', summary: { goals: row.goals } }));
    const own = standings((rows || []).filter((row) => row.source !== 'doelen').concat(goals), events, today);
    if (!own.length) return { text: 'Nog geen doelen: stel ze in', due: false };
    const good = own.filter((entry) => ['op-koers', 'gehaald'].includes(entry.result.status)).length;
    return { text: `${good} van ${own.length} ${own.length === 1 ? 'doel' : 'doelen'} op koers`, due: good < own.length };
  }

  ns.adminGoals = { render, METRICS, STATUS, metricOf, progress, sentence, dataFor, pointsOf, standings, startStatus, format, withUnit, statusBadge };
})(window.AIAudit);
