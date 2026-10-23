/* ==========================================================================
   Beheer → Copilot-gebruik (#/beheer/copilot)
   --------------------------------------------------------------------------
   De export van het Copilot-gebruik periodiek inlezen en vergelijken met de
   vorige keer. Het bestand wordt in de browser gelezen (js/admin-sheets.js);
   alleen de totalen per periode gaan naar de database (audit_copilot_usage,
   setup/supabase-audit-copilot.sql, stap 9). Nooit gegevens per persoon: de
   PersonId's en de cijfers per persoon verlaten de browser niet.

   Soorten bestanden (FORMATS): iedere lezer herkent zijn bestand aan de namen
   van de kolommen en geeft dezelfde invoer:
     { people:   [{ licence: 'Basic'|'Premium', volumeTotal, volume4w, activeWeeks }],
       weekly:   [{ week: 'JJJJ-MM-DD', active: { basic, premium }, volume: { basic, premium } }],
       channels: [{ name, volume4w }] }
   summarize maakt daar de totalen van die worden opgeslagen (versie 1):
     { version, source, periodStart, periodEnd, weeks, people, skipped,
       licences: { basic|premium: { people, active4w, volume4w, volumeTotal,
                                    frequency: { wekelijks, regelmatig, soms, nooit } } },
       weekly, channels, top10Share }
   Een ander soort export? Voeg een lezer toe aan FORMATS; de rest blijft gelijk.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const sheets = ns.adminSheets;
  const SVG = 'http://www.w3.org/2000/svg';

  const LICENCES = [
    { id: 'basic', label: 'Basic' },
    { id: 'premium', label: 'Premium' }
  ];
  // Hoe vaak iemand actief was, als deel van de weken in de periode
  const BANDS = [
    { id: 'wekelijks', label: 'Bijna elke week', text: '75% van de weken of meer' },
    { id: 'regelmatig', label: 'Regelmatig', text: '25 tot 75% van de weken' },
    { id: 'soms', label: 'Af en toe', text: 'minder dan 25% van de weken' },
    { id: 'nooit', label: 'Niet actief', text: 'geen enkele week' }
  ];
  const bandOf = (share) => (share >= 0.75 ? 'wekelijks' : share >= 0.25 ? 'regelmatig' : share > 0 ? 'soms' : 'nooit');

  const NUMBER = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const DECIMAL = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });
  const PERCENT = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 0 });
  const SIGNED = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const SIGNED_PERCENT = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  const show = (format, value) => (value == null || !Number.isFinite(value) ? '–' : format.format(value));
  const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  /* ---- Lezen ---------------------------------------------------------------------- */
  /** Aantal uit een kolom: leeg telt als 0, verder moet het een getal van 0 of meer zijn. */
  function count(row, column) {
    const value = row[column];
    if (value === undefined) return 0;
    const result = sheets.number(value);
    if (!Number.isFinite(result) || result < 0) throw new Error(`in de kolom '${column}' staat iets dat geen aantal is`);
    return result;
  }

  const FORMATS = [
    {
      // Het analysebestand: een tabblad per persoon (Gebruikers) en een tabblad met de weken en kanalen
      id: 'analyse',
      expects: "een tabblad met de kolommen 'Huidige licentie', 'Totaal volume', 'Volume laatste 4 weken' en 'Actieve weken', en een met 'Week', 'Actieve gebruikers Basic', 'Actieve gebruikers Premium', 'Basic-prompts' en 'Premium-acties'",
      read(book) {
        const people = sheets.findTable(book, ['Huidige licentie', 'Totaal volume', 'Volume laatste 4 weken', 'Actieve weken']);
        const weekly = sheets.findTable(book, ['Week', 'Actieve gebruikers Basic', 'Actieve gebruikers Premium', 'Basic-prompts', 'Premium-acties']);
        if (!people || !weekly) return null;
        const channels = sheets.findTable(book, ['Basic-kanaal', 'Prompts laatste 4 weken']);
        return {
          people: people.rows.map((row) => ({
            licence: row['Huidige licentie'],
            volumeTotal: count(row, 'Totaal volume'),
            volume4w: count(row, 'Volume laatste 4 weken'),
            activeWeeks: count(row, 'Actieve weken')
          })),
          weekly: weekly.rows.map((row) => ({
            week: sheets.excelDate(row.Week, book.date1904),
            active: { basic: count(row, 'Actieve gebruikers Basic'), premium: count(row, 'Actieve gebruikers Premium') },
            volume: { basic: count(row, 'Basic-prompts'), premium: count(row, 'Premium-acties') }
          })),
          channels: channels ? channels.rows.map((row) => ({ name: String(row['Basic-kanaal'] == null ? '' : row['Basic-kanaal']).trim(), volume4w: count(row, 'Prompts laatste 4 weken') })) : []
        };
      }
    }
  ];

  const licenceOf = (value) => {
    const text = String(value == null ? '' : value).toLowerCase();
    return text.includes('premium') ? 'premium' : text.includes('basic') ? 'basic' : '';
  };

  /** Van de invoer van een lezer naar de totalen die worden opgeslagen (zonder iets per persoon). */
  function summarize(input, source) {
    if (input.weekly.some((week) => !week.week)) throw new Error("in de kolom 'Week' staat iets dat geen datum is");
    const byWeek = new Map(input.weekly.map((week) => [week.week, week]));
    const weekly = Array.from(byWeek.values()).sort((a, b) => (a.week < b.week ? -1 : 1));
    if (!weekly.length) throw new Error('er staan geen weken in het bestand');
    if (weekly.length > 520) throw new Error('meer dan tien jaar aan weken: dit klopt niet');
    const licences = {};
    LICENCES.forEach(({ id }) => {
      licences[id] = { people: 0, active4w: 0, volume4w: 0, volumeTotal: 0, frequency: Object.fromEntries(BANDS.map((b) => [b.id, 0])) };
    });
    let skipped = 0;
    const volumes = [];
    input.people.forEach((person) => {
      if (person.licence == null || String(person.licence).trim() === '') {
        skipped += 1; // geen licentie bekend: niet in te delen
        return;
      }
      const id = licenceOf(person.licence);
      if (!id) throw new Error(`onbekende licentie '${String(person.licence).slice(0, 30)}' (verwacht Basic of Premium)`);
      const totals = licences[id];
      totals.people += 1;
      if (person.volume4w > 0) totals.active4w += 1;
      totals.volume4w += person.volume4w;
      totals.volumeTotal += person.volumeTotal;
      totals.frequency[bandOf(Math.min(person.activeWeeks, weekly.length) / weekly.length)] += 1;
      volumes.push(person.volumeTotal);
    });
    if (!volumes.length) throw new Error('er staan geen personen met een licentie in het bestand');
    volumes.sort((a, b) => b - a);
    const sum = (list) => list.reduce((total, value) => total + value, 0);
    return {
      version: 1,
      source,
      periodStart: weekly[0].week,
      periodEnd: weekly[weekly.length - 1].week,
      weeks: weekly.length,
      people: volumes.length,
      skipped,
      licences,
      weekly: weekly.map((week) => ({ week: week.week, active: { basic: week.active.basic, premium: week.active.premium }, volume: { basic: week.volume.basic, premium: week.volume.premium } })),
      channels: input.channels.filter((channel) => channel.name).slice(0, 20).map((channel) => ({ name: channel.name.slice(0, 40), volume4w: channel.volume4w })),
      top10Share: sum(volumes) ? sum(volumes.slice(0, 10)) / sum(volumes) : null
    };
  }

  /** Een gekozen bestand lezen en samenvatten; een fout als geen lezer het bestand herkent. */
  async function readExport(file) {
    const book = await sheets.read(file);
    for (const format of FORMATS) {
      const input = format.read(book);
      if (input) return summarize(input, format.id);
    }
    throw new Error('dit bestand herken ik niet. Verwacht: ' + FORMATS.map((format) => format.expects).join('; of ') + '.');
  }

  /** Is dit een opgeslagen samenvatting die deze versie kan tonen? */
  const usable = (summary) => Boolean(summary && summary.version === 1 && Array.isArray(summary.weekly) && summary.weekly.length
    && summary.licences && LICENCES.every(({ id }) => summary.licences[id]) && Array.isArray(summary.channels));

  /* ---- Kengetallen ------------------------------------------------------------------- */
  /** Per licentie en samen: personen, actief en volume (laatste 4 weken), adoptie, per actieve gebruiker, per week actief en groei. */
  function measures(snapshot) {
    const recent = snapshot.weekly.slice(-4);
    const before = snapshot.weekly.slice(-8, -4);
    const sum = (list, pick) => list.reduce((total, week) => total + pick(week), 0);
    const of = (ids) => {
      const add = (field) => ids.reduce((total, id) => total + snapshot.licences[id][field], 0);
      const weekVolume = (week) => ids.reduce((total, id) => total + week.volume[id], 0);
      const people = add('people');
      const active = add('active4w');
      const volume = add('volume4w');
      const earlier = before.length === 4 ? sum(before, weekVolume) : 0;
      return {
        people,
        active,
        volume,
        adoption: people ? active / people : null,
        perActive: active ? volume / active : null,
        wau: recent.length ? sum(recent, (week) => ids.reduce((total, id) => total + week.active[id], 0)) / recent.length : null,
        growth: earlier ? sum(recent, weekVolume) / earlier - 1 : null
      };
    };
    return { basic: of(['basic']), premium: of(['premium']), total: of(['basic', 'premium']) };
  }

  /** Verschil tussen twee waarden: absoluut, in procentpunten of relatief. { value, text } of null. */
  function change(kind, now, then) {
    if (now == null || then == null || !Number.isFinite(now) || !Number.isFinite(then)) return null;
    if (kind === 'points') return { value: now - then, text: SIGNED.format(Math.round((now - then) * 100)) + ' %-punt' };
    if (kind === 'relative') return then ? { value: now / then - 1, text: SIGNED_PERCENT.format(now / then - 1) } : null;
    return { value: now - then, text: SIGNED.format(now - then) };
  }

  // De kengetallen in de tegels en tabellen. neutral: meer of minder is niet goed of slecht.
  const MEASURES = [
    { id: 'people', label: 'Personen', format: NUMBER, kind: 'absolute', neutral: true },
    { id: 'active', label: 'Actief in de laatste 4 weken', short: 'Actief (4 wkn)', format: NUMBER, kind: 'absolute' },
    { id: 'adoption', label: 'Adoptie', format: PERCENT, kind: 'points' },
    { id: 'wau', label: 'Gemiddeld actief per week', short: 'Actief per week', format: DECIMAL, kind: 'absolute' },
    { id: 'volume', label: 'Volume in de laatste 4 weken', short: 'Volume (4 wkn)', format: NUMBER, kind: 'relative' },
    { id: 'perActive', label: 'Volume per actieve gebruiker', short: 'Per actieve gebruiker', format: NUMBER, kind: 'relative' }
  ];

  /** Alle weken van alle imports op een rij; bij een week die in meer imports staat, telt de nieuwste. */
  function timeline(snapshots) {
    const weeks = new Map();
    snapshots.forEach((snapshot) => snapshot.weekly.forEach((week) => weeks.set(week.week, week)));
    return Array.from(weeks.values()).sort((a, b) => (a.week < b.week ? -1 : 1));
  }

  /** '8 mrt. t/m 6 sep. 2026' (met het jaar ook bij het begin als dat anders is). */
  function period(snapshot) {
    const sameYear = snapshot.periodStart.slice(0, 4) === snapshot.periodEnd.slice(0, 4);
    const start = formatDate(snapshot.periodStart);
    return `${sameYear ? start.replace(/ \d{4}$/, '') : start} t/m ${formatDate(snapshot.periodEnd)}`;
  }

  const shortDate = (value) => formatDate(value).replace(/ \d{4}$/, '');

  /** Wat valt op: zinnen bij de laatste periode, en het verschil met de vorige. */
  function insights(latest, now, then, previous) {
    const items = [];
    const { basic, premium } = now;
    if (basic.adoption != null && premium.adoption != null) {
      items.push(premium.adoption > basic.adoption
        ? `Premium-gebruikers zijn vaker actief: ${PERCENT.format(premium.adoption)} was actief in de laatste 4 weken, tegen ${PERCENT.format(basic.adoption)} van Basic.`
        : `Actief in de laatste 4 weken: ${PERCENT.format(basic.adoption)} van Basic en ${PERCENT.format(premium.adoption)} van Premium.`);
    }
    if (basic.perActive && premium.perActive) {
      items.push(`Een actieve Premium-gebruiker komt op ${DECIMAL.format(premium.perActive / basic.perActive)} keer het volume van een actieve Basic-gebruiker (${NUMBER.format(premium.perActive)} acties tegen ${NUMBER.format(basic.perActive)} prompts in 4 weken; geen gelijke maat, dus een indicatie).`);
    }
    const growing = LICENCES.filter(({ id }) => now[id].growth != null);
    if (growing.length) items.push(`Volume in de laatste 4 weken, vergeleken met de 4 weken daarvoor: ${growing.map(({ id, label }) => `${label} ${SIGNED_PERCENT.format(now[id].growth)}`).join(', ')}.`);
    if (latest.top10Share != null && latest.people > 10) items.push(`De 10 meest actieve personen zijn samen goed voor ${PERCENT.format(latest.top10Share)} van al het volume in de periode.`);
    const channels = latest.channels.filter((channel) => channel.volume4w > 0).sort((a, b) => b.volume4w - a.volume4w);
    const channelTotal = channels.reduce((total, channel) => total + channel.volume4w, 0);
    if (channels.length) {
      const share = (channel) => `${channel.name} (${PERCENT.format(channel.volume4w / channelTotal)})`;
      items.push(`Basic-gebruikers werken vooral via ${share(channels[0])}${channels[1] ? ', daarna ' + share(channels[1]) : ''}.`);
    }
    const idle = LICENCES.reduce((total, { id }) => total + latest.licences[id].frequency.nooit, 0);
    if (idle) items.push(`${NUMBER.format(idle)} van de ${NUMBER.format(latest.people)} personen ${idle === 1 ? 'was' : 'waren'} in de hele periode in geen enkele week actief.`);
    if (then) {
      const volume = change('relative', now.total.volume, then.total.volume);
      items.push(`Sinds de vorige import (t/m ${formatDate(previous.periodEnd)}): ${SIGNED.format(now.total.active - then.total.active)} actieve gebruikers in de laatste 4 weken, adoptie van ${show(PERCENT, then.total.adoption)} naar ${show(PERCENT, now.total.adoption)}${volume ? ', volume ' + volume.text : ''}.`);
    }
    return items;
  }

  /* ---- Grafiek ------------------------------------------------------------------------ */
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

  const DAY = 86400000;
  const time = (week) => Date.parse(week + 'T00:00:00Z');

  /**
   * Lijngrafiek per week met de twee licenties: legenda, de laatste waarde aan het eind van iedere
   * lijn, een draadkruis met uitleesvak (aanwijzen, of de pijltjestoetsen als de grafiek focus heeft)
   * en dezelfde cijfers als tabel. Een gat van meer dan een week (tussen twee imports) breekt de lijn.
   * points: [{ week: 'JJJJ-MM-DD', values: { basic, premium } }]
   */
  function lineChart({ title, sub, points }) {
    const HEIGHT = 250;
    // Rechts ruimte voor de laatste waarden ('1.081 Premium': ongeveer 7,4px per teken bij 13px)
    const latest = points[points.length - 1].values;
    const endWidth = Math.max(...LICENCES.map(({ id, label }) => `${NUMBER.format(latest[id])} ${label}`.length));
    const M = { top: 14, right: Math.ceil(endWidth * 7.4 + 24), bottom: 30, left: 52 };
    const plot = el('div', { className: 'chart__plot' });
    const readout = el('div', { className: 'chart__readout', attrs: { 'aria-live': 'polite', hidden: true } });
    const summary = LICENCES.map(({ id, label }) => `${label} ${NUMBER.format(latest[id])}`).join(', ');
    const section = el('section', { className: 'chart' }, [
      el('h3', { className: 'chart__title', text: title }),
      sub ? el('p', { className: 'chart__sub', text: sub }) : null,
      el('ul', { className: 'chart__legend', attrs: { role: 'list' } }, LICENCES.map(({ id, label }) =>
        el('li', {}, [el('span', { className: 'chart__key chart__key--' + id }), el('span', { text: label })]))),
      plot,
      el('details', { className: 'chart__table' }, [
        el('summary', { text: 'Als tabel' }),
        el('div', { className: 'chart__table-scroll' }, [
          el('table', { className: 'table' }, [
            el('thead', {}, [el('tr', {}, ['Week van', ...LICENCES.map((l) => l.label)].map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index ? 'num' : null } })))]),
            el('tbody', {}, points.map((point) => el('tr', {}, [
              el('th', { attrs: { scope: 'row' }, text: formatDate(point.week) }),
              ...LICENCES.map(({ id }) => el('td', { className: 'num', text: NUMBER.format(point.values[id]) }))
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
      const ticks = niceTicks(Math.max(...points.flatMap((point) => LICENCES.map(({ id }) => point.values[id]))));
      const top = ticks[ticks.length - 1];
      const y = (value) => M.top + innerH - (value / top) * innerH;
      const root = svg('svg', {
        class: 'chart__svg', width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, tabindex: '0', role: 'img', focusable: 'true',
        'aria-label': `${title}, ${period({ periodStart: points[0].week, periodEnd: points[points.length - 1].week })}. Laatste week: ${summary}. Met de pijltjestoetsen per week; alle cijfers staan ook in de tabel eronder.`
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
        const label = MONTHS[month.getUTCMonth()] + (index === 0 || month.getUTCMonth() === 0 ? ' ' + month.getUTCFullYear() : '');
        grid.append(svg('line', { x1: x, x2: x, y1: M.top + innerH, y2: M.top + innerH + 4, class: 'chart__tick' }));
        grid.append(svg('text', { x, y: HEIGHT - 8, 'text-anchor': 'middle' }, label));
      });
      root.append(grid);

      // Lijnen (nieuw stuk na een gat), het punt aan het eind en de laatste waarde
      const ends = [];
      LICENCES.forEach(({ id, label }) => {
        let d = '';
        points.forEach((point, index) => {
          const gap = index === 0 || times[index] - times[index - 1] > 8 * DAY;
          d += `${gap ? 'M' : 'L'}${xs[index].toFixed(1)} ${y(point.values[id]).toFixed(1)} `;
        });
        root.append(svg('path', { d: d.trim(), class: 'chart__line chart__line--' + id }));
        const value = points[points.length - 1].values[id];
        ends.push({ id, label, value, y: y(value) });
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
        root.append(svg('circle', { cx: endX, cy: end.y, r: 4, class: 'chart__dot chart__dot--' + end.id }));
        const text = svg('text', { x: endX + 14, y: labelY + 4, class: 'chart__end' });
        text.append(svg('tspan', { class: 'chart__end-value' }, NUMBER.format(end.value)), svg('tspan', { dx: 4 }, end.label));
        root.append(text);
      });

      // Draadkruis en punten bij aanwijzen (verborgen tot je aanwijst)
      const cross = svg('line', { y1: M.top, y2: M.top + innerH, class: 'chart__cross', visibility: 'hidden' });
      const dots = LICENCES.map(({ id }) => svg('circle', { r: 4, class: 'chart__dot chart__dot--' + id, visibility: 'hidden' }));
      root.append(cross, ...dots, svg('rect', { x: M.left, y: M.top, width: innerW, height: innerH, class: 'chart__hit' }));

      parts = { root, xs, y, cross, dots, innerH };
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
      LICENCES.forEach(({ id }, n) => {
        dots[n].setAttribute('cx', xs[index]);
        dots[n].setAttribute('cy', y(point.values[id]));
        dots[n].setAttribute('visibility', 'visible');
      });
      // Eerst de waarde, dan de naam; een streepje in de kleur van de lijn
      readout.replaceChildren(
        el('p', { className: 'chart__readout-date', text: 'Week van ' + formatDate(point.week) }),
        ...LICENCES.map(({ id, label }) => el('p', { className: 'chart__readout-row' }, [
          el('span', { className: 'chart__key chart__key--' + id }),
          el('strong', { text: NUMBER.format(point.values[id]) }),
          el('span', { text: label })
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

  /* ---- Onderdelen van de pagina -------------------------------------------------------- */
  /** Verschil met de vorige import, onder een tegel: pijltje en tekst (groen omhoog, rood omlaag). */
  function deltaNode(measure, now, then, previous) {
    const diff = change(measure.kind, now, then);
    if (!diff) return null;
    const direction = diff.value > 0 ? 'up' : diff.value < 0 ? 'down' : 'flat';
    return el('span', { className: 'kpi__delta kpi__delta--' + (measure.neutral ? 'flat' : direction) }, [
      direction === 'flat' ? null : icon(direction === 'up' ? 'arrow-up' : 'arrow-down'),
      el('span', { text: `${diff.text} t.o.v. ${shortDate(previous.periodEnd)}` })
    ]);
  }

  function kpiRow(now, then, previous) {
    return el('div', { className: 'kpis copilot__kpis' }, MEASURES.map((measure) => el('div', { className: 'kpi' }, [
      el('span', { className: 'kpi__value', text: show(measure.format, now.total[measure.id]) }),
      el('span', { className: 'kpi__label', text: measure.label }),
      then ? deltaNode(measure, now.total[measure.id], then.total[measure.id], previous) : null
    ])));
  }

  function licenceTable(now, then, previous) {
    const rows = [...LICENCES, { id: 'total', label: 'Samen' }];
    return el('section', { className: 'usage-table' }, [
      el('h3', { className: 'usage-table__title', text: 'Per licentie' }),
      el('table', { className: 'table' }, [
        then ? el('caption', { className: 'copilot__caption', text: `Tussen haakjes: het verschil met de import t/m ${formatDate(previous.periodEnd)}.` }) : null,
        el('thead', {}, [el('tr', {}, [
          el('th', { attrs: { scope: 'col' }, text: 'Licentie' }),
          ...MEASURES.map((measure) => el('th', { className: 'num', attrs: { scope: 'col' }, text: measure.short || measure.label })),
          el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Volume t.o.v. 4 weken ervoor' })
        ])]),
        el('tbody', {}, rows.map(({ id, label }) => el('tr', { className: id === 'total' ? 'copilot__total' : '' }, [
          el('th', { attrs: { scope: 'row' }, text: label }),
          ...MEASURES.map((measure) => {
            const diff = then ? change(measure.kind, now[id][measure.id], then[id][measure.id]) : null;
            return el('td', { className: 'num', text: show(measure.format, now[id][measure.id]) + (diff ? ` (${diff.text})` : '') });
          }),
          el('td', { className: 'num', text: show(SIGNED_PERCENT, now[id].growth) })
        ])))
      ])
    ]);
  }

  /** Basic per kanaal: liggende balken met de waarde erachter (één reeks, één kleur). */
  function channelsBlock(snapshot) {
    const list = snapshot.channels.slice().sort((a, b) => b.volume4w - a.volume4w);
    const total = list.reduce((sum, channel) => sum + channel.volume4w, 0);
    const max = Math.max(1, ...list.map((channel) => channel.volume4w));
    return el('section', { className: 'usage-table' }, [
      el('h3', { className: 'usage-table__title', text: 'Basic: prompts per kanaal' }),
      el('p', { className: 'chart__sub', text: 'Laatste 4 weken: waar collega\'s zonder licentie Copilot Chat gebruiken.' }),
      list.length ? el('ul', { className: 'bars', attrs: { role: 'list' } }, list.map((channel) => {
        const bar = el('span', { className: 'bars__bar' });
        bar.style.setProperty('--share', String(channel.volume4w / max));
        return el('li', { className: 'bars__row' }, [
          el('span', { className: 'bars__label', text: channel.name }),
          el('span', { className: 'bars__track' }, [
            bar,
            el('span', { className: 'bars__value', text: NUMBER.format(channel.volume4w) + (total ? ' · ' + PERCENT.format(channel.volume4w / total) : '') })
          ])
        ]);
      })) : el('p', { className: 'section__lead', text: 'Niet in dit bestand.' })
    ]);
  }

  function frequencyBlock(snapshot) {
    const cell = (id, band) => {
      const totals = snapshot.licences[id];
      return el('td', { className: 'num', text: NUMBER.format(totals.frequency[band]) + (totals.people ? ` (${PERCENT.format(totals.frequency[band] / totals.people)})` : '') });
    };
    return el('section', { className: 'usage-table' }, [
      el('h3', { className: 'usage-table__title', text: 'Hoe vaak actief' }),
      el('p', { className: 'chart__sub', text: `In hoeveel van de ${snapshot.weeks} weken van de periode iemand Copilot gebruikte.` }),
      el('table', { className: 'table' }, [
        el('thead', {}, [el('tr', {}, ['', ...LICENCES.map((l) => l.label)].map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index ? 'num' : null } })))]),
        el('tbody', {}, BANDS.map((band) => el('tr', {}, [
          el('th', { attrs: { scope: 'row' } }, [band.label, el('span', { className: 'copilot__note', text: band.text })]),
          ...LICENCES.map(({ id }) => cell(id, band.id))
        ])))
      ])
    ]);
  }

  function definitions() {
    const items = [
      ['Basic', 'Zonder licentie voor Microsoft 365 Copilot. Volume: prompts in Copilot Chat.'],
      ['Premium', 'Met een licentie voor Microsoft 365 Copilot. Volume: alle Copilot-acties (Teams, Outlook, Word, Excel, …).'],
      ['Volume', 'Prompts en acties zijn niet dezelfde maat: vergelijk de ontwikkeling, niet de hoogte. De cijfers geven een richting aan.'],
      ['Actief', 'Minstens één prompt of actie in de laatste 4 weken van de periode. Adoptie: het deel van alle personen met die licentie.'],
      ['Actief per week', 'Het gemiddelde aantal actieve gebruikers per week, over de laatste 4 weken.'],
      ['Licentie', 'Zoals bij de laatste meting in het bestand.'],
      ['Vergelijking', 'Met de vorige import: de 4 weken tot de einddatum daarvan.']
    ];
    return el('details', { className: 'copilot__definitions' }, [
      el('summary', { text: 'Hoe lees je deze cijfers?' }),
      el('dl', {}, items.map(([term, text]) => el('div', {}, [el('dt', { text: term }), el('dd', { text })])))
    ]);
  }

  /* ---- Pagina ------------------------------------------------------------------------ */
  function render() {
    const node = el('div', { className: 'copilot' });
    const status = el('div', { className: 'copilot__status' });
    const body = el('div', { className: 'copilot__body' });
    let saved = [];   // rijen uit de database, oudste eerst
    let missing = false;
    let pending = null; // ingelezen, nog niet opgeslagen
    let pendingName = '';

    const byEnd = (a, b) => (a.periodEnd < b.periodEnd ? -1 : 1);
    const fromRow = (row) => Object.assign({}, row.summary, { periodStart: row.period_start, periodEnd: row.period_end, id: row.id, importedAt: row.imported_at, importedBy: row.imported_by });
    const snapshots = () => saved.map(fromRow)
      .filter((snapshot) => !pending || snapshot.periodEnd !== pending.periodEnd)
      .concat(pending ? [Object.assign({}, pending, { pending: true })] : [])
      .sort(byEnd);

    const file = el('input', { className: 'sr-only', attrs: { type: 'file', accept: '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv', tabindex: '-1' } });
    const choose = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('upload'), el('span', { text: 'Export inlezen' })]);
    choose.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      file.value = '';
      if (!chosen) return;
      const done = kit.busy(choose, 'Inlezen…');
      try {
        pending = await readExport(chosen);
        pendingName = chosen.name;
        update();
        const save = status.querySelector('.btn--primary');
        if (save) save.focus();
      } catch (error) {
        kit.failed('Inlezen', error, 10000);
      } finally {
        done();
      }
    });

    function pendingNotice() {
      const replaces = saved.some((row) => row.period_end === pending.periodEnd);
      const save = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', disabled: missing } }, [icon('check'), el('span', { text: replaces ? 'Opslaan en vervangen' : 'Opslaan' })]);
      const discard = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('close'), el('span', { text: 'Niet opslaan' })]);
      save.addEventListener('click', async () => {
        const done = kit.busy([save, discard], 'Opslaan…');
        try {
          const row = await ns.central.saveCopilotUsage(pending);
          saved = saved.filter((other) => other.period_end !== row.period_end).concat(row).sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
          toast('Opgeslagen: ' + period(pending), { tone: 'success' });
          pending = null;
          update();
          choose.focus(); // de knop waarmee je was begonnen (de melding met Opslaan is weg)
        } catch (error) {
          done();
          kit.failed('Opslaan', error, 8000);
        }
      });
      discard.addEventListener('click', () => {
        pending = null;
        update();
        choose.focus();
      });
      const facts = [`${pending.weeks} weken`, `${NUMBER.format(pending.people)} personen`];
      if (pending.skipped) facts.push(`${NUMBER.format(pending.skipped)} ${pending.skipped === 1 ? 'rij' : 'rijen'} zonder licentie overgeslagen`);
      return notice({
        icon: 'table',
        className: 'copilot__pending',
        title: `Ingelezen uit ${pendingName}: ${period(pending)}`,
        text: `${facts.join(' · ')}. Nog niet opgeslagen: hieronder zie je hoe het eruitziet. Bij opslaan gaan alleen de totalen naar de database${replaces ? '; de import met dezelfde einddatum wordt vervangen' : ''}.`,
        action: el('div', { className: 'copilot__actions' }, [save, discard])
      });
    }

    function historyBlock(list) {
      const columns = ['Periode', 'Weken', 'Personen', 'Actief (4 wkn)', 'Adoptie', 'Volume (4 wkn)', 'Per actieve gebruiker', 'Ingelezen', ''];
      return el('section', { className: 'usage-table' }, [
        el('h3', { className: 'usage-table__title', text: list.length === 1 ? 'Import' : `Alle imports (${list.length})` }),
        el('table', { className: 'table' }, [
          el('thead', {}, [el('tr', {}, columns.map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index > 0 && index < 7 ? 'num' : null } })))]),
          el('tbody', {}, list.slice().reverse().map((snapshot) => {
            const total = measures(snapshot).total;
            let remove = null;
            if (!snapshot.pending) {
              remove = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', 'aria-label': `Import ${period(snapshot)} verwijderen` } }, [icon('trash'), el('span', { text: 'Verwijderen' })]);
              remove.addEventListener('click', async () => {
                if (!(await ns.ui.confirmDialog(`De totalen van ${period(snapshot)} worden verwijderd. Lees het bestand opnieuw in om ze terug te zetten.`, { title: 'Import verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
                remove.disabled = true;
                try {
                  await ns.central.deleteCopilotUsage(snapshot.id);
                  saved = saved.filter((row) => row.id !== snapshot.id);
                  toast('Verwijderd');
                  update();
                } catch (error) {
                  kit.failed('Verwijderen', error);
                  remove.disabled = false;
                }
              });
            }
            return el('tr', {}, [
              el('th', { className: 'copilot__period', attrs: { scope: 'row' }, text: period(snapshot) }),
              ...[snapshot.weeks, total.people, total.active].map((value) => el('td', { className: 'num', text: show(NUMBER, value) })),
              el('td', { className: 'num', text: show(PERCENT, total.adoption) }),
              el('td', { className: 'num', text: show(NUMBER, total.volume) }),
              el('td', { className: 'num', text: show(NUMBER, total.perActive) }),
              el('td', {}, snapshot.pending ? ['Nog niet opgeslagen'] : [kit.moment(snapshot.importedAt), snapshot.importedBy ? el('span', { className: 'copilot__note', text: snapshot.importedBy }) : null]),
              el('td', {}, [remove])
            ]);
          }))
        ])
      ]);
    }

    function dashboard(list) {
      const latest = list[list.length - 1];
      const previous = list.length > 1 ? list[list.length - 2] : null;
      const now = measures(latest);
      const then = previous ? measures(previous) : null;
      const weeks = timeline(list);
      const facts = [`${latest.weeks} weken`, `${NUMBER.format(latest.people)} personen`];
      facts.push(previous ? `vergeleken met de import t/m ${formatDate(previous.periodEnd)}` : 'de eerste import: bij de volgende zie je hier het verschil');
      if (latest.pending) facts.push('nog niet opgeslagen');
      const notes = insights(latest, now, then, previous);
      return el('div', { className: 'copilot__dashboard' }, [
        el('div', { className: 'copilot__head' }, [
          el('h2', { className: 'section__title', text: 'Periode ' + period(latest) }),
          el('p', { className: 'copilot__meta', text: facts.join(' · ') })
        ]),
        kpiRow(now, then, previous),
        notes.length ? el('section', { className: 'copilot__insights' }, [
          el('h3', { className: 'usage-table__title', text: 'Wat valt op' }),
          el('ul', {}, notes.map((text) => el('li', { text })))
        ]) : null,
        licenceTable(now, then, previous),
        el('div', { className: 'copilot__charts' }, [
          lineChart({ title: 'Actieve gebruikers per week', sub: weeks.length > latest.weeks ? 'Alle weken uit alle imports.' : null, points: weeks.map((week) => ({ week: week.week, values: week.active })) }),
          lineChart({ title: 'Volume per week', sub: 'Basic: prompts in Copilot Chat. Premium: alle Copilot-acties.', points: weeks.map((week) => ({ week: week.week, values: week.volume })) })
        ]),
        el('div', { className: 'usage-grid' }, [channelsBlock(latest), frequencyBlock(latest)]),
        historyBlock(list),
        definitions()
      ]);
    }

    function update() {
      status.replaceChildren(...[
        missing ? notice({ tone: 'warning', title: 'Nog niet ingericht', text: 'De tabel voor het Copilot-gebruik ontbreekt: voer setup/supabase-audit-copilot.sql (stap 9) uit in Supabase. Een bestand inlezen en bekijken kan al wel, opslaan nog niet.' }) : null,
        pending ? pendingNotice() : null
      ].filter(Boolean));
      const list = snapshots();
      body.replaceChildren(list.length ? dashboard(list) : notice({
        icon: 'chart',
        title: 'Nog geen imports',
        text: 'Kies Export inlezen en selecteer het Excel-bestand met het Copilot-gebruik. Je ziet eerst wat er is gelezen; pas bij Opslaan gaan de totalen naar de database.'
      }));
    }

    async function load() {
      body.replaceChildren(el('p', { className: 'loading', text: 'Copilot-gebruik laden…' }));
      try {
        const rows = await ns.central.listCopilotUsage();
        missing = rows === null;
        saved = (rows || []).filter((row) => usable(row.summary));
        update();
      } catch (error) {
        body.replaceChildren(notice({ tone: 'warning', title: 'Laden mislukt', text: error.message }));
        if (!ns.central.signedIn()) node.dispatchEvent(new CustomEvent('signedout', { bubbles: true }));
      }
    }

    node.append(
      el('div', { className: 'copilot__intro' }, [
        el('p', { className: 'field__hint', text: 'Lees iedere periode de export van het Copilot-gebruik in en zie hoe het zich ontwikkelt ten opzichte van de vorige keer. Het bestand wordt in je browser gelezen en nergens heen gestuurd; alleen de totalen per periode worden opgeslagen, nooit gegevens per persoon.' }),
        el('div', { className: 'copilot__choose' }, [choose, file])
      ]),
      status,
      body
    );
    load();
    return { node };
  }

  ns.adminCopilot = { render, readExport, summarize, measures, timeline, niceTicks, FORMATS };
})(window.AIAudit);
