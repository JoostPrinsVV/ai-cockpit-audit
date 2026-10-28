/* ==========================================================================
   Grafieken voor Beheer (Copilot-gebruik, Overzicht, Portfolio)
   --------------------------------------------------------------------------
   lineChart: een lijngrafiek per week met één of twee reeksen. Een legenda
   (bij twee reeksen), de laatste waarde met naam aan het eind van iedere lijn,
   een draadkruis met uitleesvak (aanwijzen, of de pijltjestoetsen als de
   grafiek focus heeft) en dezelfde cijfers als tabel. Een gat van meer dan een
   week breekt de lijn. Kleuren: --series-1 en --series-2 (css/variables.css),
   getoetst op kleurenblindheid en contrast in beide thema's; tekst krijgt
   nooit de kleur van een reeks.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, formatDate } = ns.ui;
  const SVG = 'http://www.w3.org/2000/svg';
  const NUMBER = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const DAY = 86400000;
  const time = (week) => Date.parse(week + 'T00:00:00Z');

  function svg(tag, attrs, text) {
    const node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
    if (text != null) node.textContent = text;
    return node;
  }

  /** Ronde stappen voor de as: 0, 20, 40, 60 of 0, 500, …, 2.500 (de laatste is minstens max). */
  function niceTicks(max) {
    const rough = Math.max(max, 4) / 5;
    const power = 10 ** Math.floor(Math.log10(rough));
    const step = Math.max(1, [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((value) => value >= rough));
    const ticks = [0];
    while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }

  /** '8 mrt. t/m 6 sep. 2026' (met het jaar ook bij het begin als dat anders is). */
  function period(start, end) {
    const first = formatDate(start);
    return `${start.slice(0, 4) === end.slice(0, 4) ? first.replace(/ \d{4}$/, '') : first} t/m ${formatDate(end)}`;
  }

  /** Kort lijnstuk in de kleur van reeks n (1 of 2), voor legenda en uitleesvak. */
  const key = (n) => el('span', { className: 'chart__key chart__key--' + n });

  /**
   * points: [{ week: 'JJJJ-MM-DD', values: { <id>: getal } }], series: [{ id, label }] (één of twee),
   * title, sub (optioneel), pointLabel (kop van de eerste kolom en het uitleesvak, standaard 'Week van').
   */
  function lineChart({ title, sub, points, series, pointLabel }) {
    const HEIGHT = 250;
    const label = pointLabel || 'Week van';
    // Rechts ruimte voor de laatste waarden ('1.081 Premium': ongeveer 7,4px per teken bij 13px)
    const latest = points[points.length - 1].values;
    const endWidth = Math.max(...series.map((s) => `${NUMBER.format(latest[s.id])} ${s.label}`.length));
    const M = { top: 14, right: Math.ceil(endWidth * 7.4 + 24), bottom: 30, left: 52 };
    const plot = el('div', { className: 'chart__plot' });
    const readout = el('div', { className: 'chart__readout', attrs: { 'aria-live': 'polite', hidden: true } });
    const summary = series.map((s) => `${s.label} ${NUMBER.format(latest[s.id])}`).join(', ');
    const section = el('section', { className: 'chart' }, [
      el('h3', { className: 'chart__title', text: title }),
      sub ? el('p', { className: 'chart__sub', text: sub }) : null,
      // Eén reeks: geen legenda (de titel zegt al wat er staat)
      series.length > 1 ? el('ul', { className: 'chart__legend', attrs: { role: 'list' } }, series.map((s, n) =>
        el('li', {}, [key(n + 1), el('span', { text: s.label })]))) : null,
      plot,
      el('details', { className: 'chart__table' }, [
        el('summary', { text: 'Als tabel' }),
        el('div', { className: 'chart__table-scroll' }, [
          el('table', { className: 'table' }, [
            el('thead', {}, [el('tr', {}, [label, ...series.map((s) => s.label)].map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index ? 'num' : null } })))]),
            el('tbody', {}, points.map((point) => el('tr', {}, [
              el('th', { attrs: { scope: 'row' }, text: formatDate(point.week) }),
              ...series.map((s) => el('td', { className: 'num', text: NUMBER.format(point.values[s.id]) }))
            ])))
          ])
        ])
      ])
    ]);

    let width = 0;
    let active = -1;
    let parts = null;

    function draw() {
      const innerW = Math.max(40, width - M.left - M.right);
      const innerH = HEIGHT - M.top - M.bottom;
      const times = points.map((point) => time(point.week));
      const first = times[0];
      const last = times[times.length - 1];
      const xs = times.map((t) => M.left + (last === first ? innerW / 2 : ((t - first) / (last - first)) * innerW));
      const ticks = niceTicks(Math.max(...points.flatMap((point) => series.map((s) => point.values[s.id]))));
      const top = ticks[ticks.length - 1];
      const y = (value) => M.top + innerH - (value / top) * innerH;
      const root = svg('svg', {
        class: 'chart__svg', width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, tabindex: '0', role: 'img', focusable: 'true',
        'aria-label': `${title}, ${period(points[0].week, points[points.length - 1].week)}. Laatste week: ${summary}. Met de pijltjestoetsen per week; alle cijfers staan ook in de tabel eronder.`
      });

      // Raster en assen: dunne, rustige lijnen
      const grid = svg('g', { class: 'chart__grid' });
      ticks.forEach((value) => {
        grid.append(svg('line', { x1: M.left, x2: M.left + innerW, y1: y(value), y2: y(value), class: value === 0 ? 'chart__baseline' : '' }));
        grid.append(svg('text', { x: M.left - 8, y: y(value) + 4, 'text-anchor': 'end' }, NUMBER.format(value)));
      });
      // Maanden onder de as; bij een lange reeks om de paar maanden
      const months = [];
      const start = new Date(first);
      for (let month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + (start.getUTCDate() > 1 ? 1 : 0), 1)); month.getTime() <= last; month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))) months.push(month);
      const spacing = months.length > 1 ? innerW / ((last - first) / (30.4 * DAY)) : innerW;
      const every = Math.max(1, Math.ceil(54 / spacing));
      months.forEach((month, index) => {
        if (index % every) return;
        const x = xs[0] + ((month.getTime() - first) / Math.max(1, last - first)) * innerW;
        const text = MONTHS[month.getUTCMonth()] + (index === 0 || month.getUTCMonth() === 0 ? ' ' + month.getUTCFullYear() : '');
        grid.append(svg('line', { x1: x, x2: x, y1: M.top + innerH, y2: M.top + innerH + 4, class: 'chart__tick' }));
        grid.append(svg('text', { x, y: HEIGHT - 8, 'text-anchor': 'middle' }, text));
      });
      root.append(grid);

      // Lijnen (nieuw stuk na een gat), het punt aan het eind en de laatste waarde
      const ends = [];
      series.forEach((s, n) => {
        let d = '';
        points.forEach((point, index) => {
          const gap = index === 0 || times[index] - times[index - 1] > 8 * DAY;
          d += `${gap ? 'M' : 'L'}${xs[index].toFixed(1)} ${y(point.values[s.id]).toFixed(1)} `;
        });
        root.append(svg('path', { d: d.trim(), class: 'chart__line chart__line--' + (n + 1) }));
        const value = latest[s.id];
        ends.push({ n: n + 1, label: s.label, value, y: y(value) });
      });
      // Liggen de laatste waarden te dicht bij elkaar: uit elkaar, met een streepje naar de lijn
      ends.sort((a, b) => a.y - b.y);
      if (ends.length === 2 && ends[1].y - ends[0].y < 16) {
        const middle = (ends[0].y + ends[1].y) / 2;
        ends[0].labelY = middle - 8;
        ends[1].labelY = middle + 8;
      }
      const endX = xs[xs.length - 1];
      ends.forEach((end) => {
        const labelY = end.labelY == null ? end.y : end.labelY;
        if (end.labelY != null) root.append(svg('line', { x1: endX + 6, y1: end.y, x2: endX + 12, y2: labelY, class: 'chart__leader' }));
        root.append(svg('circle', { cx: endX, cy: end.y, r: 4, class: 'chart__dot chart__dot--' + end.n }));
        const text = svg('text', { x: endX + 14, y: labelY + 4, class: 'chart__end' });
        text.append(svg('tspan', { class: 'chart__end-value' }, NUMBER.format(end.value)), svg('tspan', { dx: 4 }, end.label));
        root.append(text);
      });

      // Draadkruis en punten bij aanwijzen (verborgen tot je aanwijst)
      const cross = svg('line', { y1: M.top, y2: M.top + innerH, class: 'chart__cross', visibility: 'hidden' });
      const dots = series.map((s, n) => svg('circle', { r: 4, class: 'chart__dot chart__dot--' + (n + 1), visibility: 'hidden' }));
      root.append(cross, ...dots, svg('rect', { x: M.left, y: M.top, width: innerW, height: innerH, class: 'chart__hit' }));

      parts = { xs, y, cross, dots };
      plot.replaceChildren(root, readout);
      wire(root);
      if (active >= 0) highlight(active);
    }

    function highlight(index) {
      active = index;
      const { xs, y, cross, dots } = parts;
      if (index < 0) {
        cross.setAttribute('visibility', 'hidden');
        dots.forEach((dot) => dot.setAttribute('visibility', 'hidden'));
        readout.hidden = true;
        return;
      }
      const point = points[index];
      cross.setAttribute('x1', xs[index]);
      cross.setAttribute('x2', xs[index]);
      cross.setAttribute('visibility', 'visible');
      series.forEach((s, n) => {
        dots[n].setAttribute('cx', xs[index]);
        dots[n].setAttribute('cy', y(point.values[s.id]));
        dots[n].setAttribute('visibility', 'visible');
      });
      // Eerst de waarde, dan de naam; een streepje in de kleur van de lijn
      readout.replaceChildren(
        el('p', { className: 'chart__readout-date', text: `${label} ${formatDate(point.week)}` }),
        ...series.map((s, n) => el('p', { className: 'chart__readout-row' }, [
          key(n + 1),
          el('strong', { text: NUMBER.format(point.values[s.id]) }),
          el('span', { text: s.label })
        ]))
      );
      readout.hidden = false;
      // Rechts van het draadkruis, of links als het daar niet past
      const room = xs[index] + 14 + readout.offsetWidth <= width;
      readout.style.setProperty('--x', `${Math.round(room ? xs[index] + 14 : Math.max(0, xs[index] - 14 - readout.offsetWidth))}px`);
    }

    function wire(root) {
      const nearest = (clientX) => {
        const px = clientX - root.getBoundingClientRect().left;
        let best = 0;
        parts.xs.forEach((x, index) => {
          if (Math.abs(x - px) < Math.abs(parts.xs[best] - px)) best = index;
        });
        return best;
      };
      root.addEventListener('pointermove', (event) => highlight(nearest(event.clientX)));
      root.addEventListener('pointerdown', (event) => highlight(nearest(event.clientX)));
      root.addEventListener('pointerleave', () => {
        if (document.activeElement !== root) highlight(-1);
      });
      root.addEventListener('focus', () => highlight(active >= 0 ? active : points.length - 1));
      root.addEventListener('blur', () => highlight(-1));
      root.addEventListener('keydown', (event) => {
        const steps = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
        if (event.key === 'Escape') {
          highlight(-1);
          return;
        }
        if (!(event.key in steps)) return;
        event.preventDefault();
        highlight(Math.max(0, Math.min(points.length - 1, (active < 0 ? points.length - 1 : active) + steps[event.key])));
      });
    }

    // Tekenen op de echte breedte (scherp en leesbaar, ook op een telefoon), en opnieuw als die verandert
    const observer = new ResizeObserver((entries) => {
      if (!section.isConnected) {
        observer.disconnect();
        return;
      }
      const next = Math.round(entries[0].contentRect.width);
      if (next && next !== width) {
        width = next;
        draw();
      }
    });
    observer.observe(plot);
    return section;
  }

  ns.adminChart = { lineChart, niceTicks, svg, period };
})(window.AIAudit);
