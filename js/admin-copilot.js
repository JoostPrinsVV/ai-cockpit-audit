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
   Een ander soort export? Voeg een lezer toe aan FORMATS, met een eigen summarize.

   De maandexport (versie 2, bron 'maandrapport'): de e-mail met Excel die IT
   (AFAS/Microsoft Graph) iedere 1e van de maand stuurt. Al opgeteld, alleen
   licentiehouders, één periode van ± 28 dagen zonder weken: tabbladen
   Samenvatting (discipline en periode), Per onderdeel, Per team en Intensiteit.
   De totalen rekenen we zelf uit de tabel Per team (op de Samenvatting staan
   ze als tekst, en daar vallen komma's weg: 2039 voor 203,9). Opgeslagen:
     { version: 2, source, periodStart, periodEnd, days, discipline, people,
       active, prompts, daysPerActive,
       intensity: { intensief, regelmatig, incidenteel, nietActief } | null,
       apps: [{ name, active }], teams: [{ name, people, active, prompts,
       daysPerActive, intensity | null }] }
   Versie 1 en 2 hebben andere maten: alleen binnen dezelfde versie vergelijken
   we met de vorige import (comparable); een nieuwe versie begint een nieuwe reeks.

   Een bestand met een tabblad per discipline (ieder tabblad met alle tabellen,
   bijv. 'Audit', 'Accountants', 'Belastingadviseurs'): ieder tabblad wordt apart
   gelezen en bij de discipline met die naam opgeslagen (disciplineOf), allemaal
   met één klik. Je ziet vooraf de cijfers van de discipline waarin je zit.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const sheets = ns.adminSheets;
  const { lineChart } = ns.adminChart;

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

  /* ---- Lezen ---------------------------------------------------------------------- */
  /** Aantal uit een kolom: leeg telt als 0, verder moet het een getal van 0 of meer zijn. */
  function count(row, column) {
    const value = row[column];
    if (value === undefined) return 0;
    const result = sheets.number(value);
    if (!Number.isFinite(result) || result < 0) throw new Error(`in de kolom '${column}' staat iets dat geen aantal is`);
    return result;
  }

  const text = (value) => String(value == null ? '' : value).trim().replace(/\s+/g, ' ');

  /** Heel aantal uit de maandexport: een getal, of tekst als '9014' of '9.014' (punt als duizendtal). Leeg telt als 0. */
  function whole(row, column) {
    const value = row[column];
    if (value === undefined || value === null || value === '') return 0;
    const result = typeof value === 'number' ? value : sheets.number(String(value).replace(/\s/g, '').replace(/^(\d{1,3})((?:\.\d{3})+)$/, (all, head, rest) => head + rest.replace(/\./g, '')));
    if (!Number.isFinite(result) || result < 0 || Math.abs(result - Math.round(result)) > 1e-9) throw new Error(`in de kolom '${column}' staat iets dat geen aantal is`);
    return Math.round(result);
  }

  /** Getal met decimalen ('12,1' of 12.1), 0 of meer. Leeg telt als 0. */
  function decimal(row, column) {
    const value = row[column];
    if (value === undefined || value === null || value === '') return 0;
    const result = sheets.number(value);
    if (!Number.isFinite(result) || result < 0) throw new Error(`in de kolom '${column}' staat iets dat geen getal is`);
    return result;
  }

  // Intensiteit in de maandexport: gemiddeld aantal actieve dagen per week in de periode
  const INTENSITY = [
    { id: 'intensief', column: 'Intensief', label: 'Intensief', text: '2,5 dagen per week of meer' },
    { id: 'regelmatig', column: 'Regelmatig', label: 'Regelmatig', text: '1 tot 2,5 dagen per week' },
    { id: 'incidenteel', column: 'Incidenteel', label: 'Incidenteel', text: 'minder dan 1 dag per week' },
    { id: 'nietActief', column: 'Niet actief', label: 'Niet actief', text: 'geen enkele dag' }
  ];

  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const DAY = 86400000;
  const dayOf = (value) => Date.parse(value + 'T00:00:00Z');

  /** Datum als 'JJJJ-MM-DD' uit '19 oktober 2026', '19 okt. 2026', '19-10-2026', '2026-10-19' of een Excel-getal; '' als het niet lukt. */
  function dutchDate(value, date1904) {
    const plain = sheets.excelDate(value, date1904);
    if (plain) return plain;
    const match = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i.exec(text(value));
    if (!match) return '';
    const word = match[2].toLowerCase();
    const month = word.length >= 3 ? MONTHS.findIndex((name) => name.startsWith(word) || (word === 'mrt' && name === 'maart')) : -1;
    return month < 0 ? '' : sheets.excelDate(`${match[3]}-${month + 1}-${match[1]}`);
  }

  /** De periode uit de Samenvatting: 'Periode' = '19 oktober 2026 t/m 15 november 2026 (28 dagen)', of losse begin- en einddatums. */
  function periodOf(facts, date1904) {
    const find = (pattern) => facts.find((fact) => pattern.test(fact.key.toLowerCase()));
    const both = find(/^periode$/);
    if (both) {
      const parts = text(both.value).replace(/\(.*\)/, '').split(/\s+(?:t\/m|tot en met|-|–)\s+/);
      if (parts.length === 2) {
        const start = dutchDate(parts[0], date1904);
        const end = dutchDate(parts[1], date1904);
        if (start && end) return { start, end };
      }
    }
    const start = find(/^(periode )?(start|begin)(datum)?$/);
    const end = find(/^(periode )?(eind|einde)(datum)?$/);
    if (start && end) return { start: dutchDate(start.value, date1904), end: dutchDate(end.value, date1904) };
    return null;
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
      },
      summarize: (input, source) => summarize(input, source)
    },
    {
      // De maandexport van IT (AFAS/Microsoft Graph): al opgeteld, per team, onderdeel en intensiteit
      id: 'maandrapport',
      expects: "de maandexport met een tabblad 'Samenvatting' (kolommen 'Onderdeel' en 'Waarde', met de periode) en een tabblad 'Per team' (kolommen 'Team', 'Licenties', 'Actief', 'Prompts totaal' en 'Gem. actieve dagen per actieve gebruiker')",
      read(book) {
        const teams = sheets.findTable(book, ['Team', 'Licenties', 'Actief', 'Prompts totaal', 'Gem. actieve dagen per actieve gebruiker']);
        const facts = sheets.findTable(book, ['Onderdeel', 'Waarde']);
        if (!teams || !facts) return null;
        const mix = sheets.findTable(book, ['Team', ...INTENSITY.map((band) => band.column)]);
        const apps = sheets.findTable(book, ['Onderdeel', 'Actieve gebruikers']);
        const intensity = sheets.findTable(book, ['Intensiteit', 'Gebruikers']);
        const mixOf = (name) => {
          const row = mix && mix.rows.find((other) => text(other.Team) === name);
          return row ? Object.fromEntries(INTENSITY.map((band) => [band.id, whole(row, band.column)])) : null;
        };
        let bands = null;
        if (intensity) {
          bands = Object.fromEntries(INTENSITY.map((band) => {
            const row = intensity.rows.find((other) => text(other.Intensiteit).toLowerCase() === band.column.toLowerCase());
            return [band.id, row ? whole(row, 'Gebruikers') : 0];
          }));
        }
        return {
          facts: facts.rows.map((row) => ({ key: text(row.Onderdeel), value: row.Waarde })).filter((fact) => fact.key),
          date1904: book.date1904,
          teams: teams.rows.filter((row) => text(row.Team)).map((row) => ({
            name: text(row.Team),
            people: whole(row, 'Licenties'),
            active: whole(row, 'Actief'),
            prompts: whole(row, 'Prompts totaal'),
            daysPerActive: decimal(row, 'Gem. actieve dagen per actieve gebruiker'),
            intensity: mixOf(text(row.Team))
          })),
          apps: apps ? apps.rows.filter((row) => text(row.Onderdeel)).map((row) => ({ name: text(row.Onderdeel), active: whole(row, 'Actieve gebruikers') })) : [],
          intensity: bands
        };
      },
      summarize: (input, source) => summarizeMonthly(input, source)
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

  /** Van de maandexport naar de totalen die worden opgeslagen (versie 2). */
  function summarizeMonthly(input, source) {
    const period = periodOf(input.facts, input.date1904);
    if (!period || !period.start || !period.end) throw new Error("de periode staat niet in het bestand (verwacht op het tabblad Samenvatting: 'Periode', bijv. '19 oktober 2026 t/m 15 november 2026')");
    if (period.end < period.start) throw new Error('de periode eindigt voordat hij begint');
    const days = Math.round((dayOf(period.end) - dayOf(period.start)) / DAY) + 1;
    if (days > 400) throw new Error('de periode is langer dan een jaar: dit klopt niet');
    const teams = input.teams;
    if (!teams.length) throw new Error('er staan geen teams in het bestand');
    if (teams.length > 100) throw new Error('meer dan 100 teams: dit klopt niet');
    const wrong = teams.find((team) => team.active > team.people);
    if (wrong) throw new Error(`bij '${wrong.name.slice(0, 40)}' zijn meer mensen actief dan er licenties zijn`);
    const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
    const people = sum(teams, (team) => team.people);
    const active = sum(teams, (team) => team.active);
    if (!people) throw new Error('er staan geen licenties in het bestand');
    // Intensiteit: het tabblad Intensiteit, anders opgeteld uit de teams (als die het hebben)
    let intensity = input.intensity;
    if (!intensity && teams.every((team) => team.intensity)) intensity = Object.fromEntries(INTENSITY.map((band) => [band.id, sum(teams, (team) => team.intensity[band.id])]));
    const discipline = input.facts.find((fact) => fact.key.toLowerCase() === 'discipline');
    const round = (value) => Math.round(value * 100) / 100;
    return {
      version: 2,
      source,
      periodStart: period.start,
      periodEnd: period.end,
      days,
      discipline: discipline ? text(discipline.value).slice(0, 60) : '',
      people,
      active,
      prompts: sum(teams, (team) => team.prompts),
      daysPerActive: active ? round(sum(teams, (team) => team.daysPerActive * team.active) / active) : null,
      intensity: intensity || null,
      apps: input.apps.slice(0, 30).map((app) => ({ name: app.name.slice(0, 40), active: app.active })),
      teams: teams.map((team) => ({ name: team.name.slice(0, 60), people: team.people, active: team.active, prompts: team.prompts, daysPerActive: round(team.daysPerActive), intensity: team.intensity }))
    };
  }

  /** Eerste lezer die (dit deel van) het boek herkent: { format, input } of null. */
  function recognize(book) {
    for (const format of FORMATS) {
      const input = format.read(book);
      if (input) return { format, input };
    }
    return null;
  }

  /* Een tabblad per discipline: de naam van het tabblad wijst de discipline aan. Lukt dat niet op
     naam of id (de eerste letters, zodat 'Accountants' bij Accountancy en 'Belastingadviseurs' bij
     Belastingadvies hoort), dan op een gangbare andere naam. */
  const ALIASES = { fiscaal: 'belastingadvies', fiscale: 'belastingadvies', fiscalisten: 'belastingadvies', payroll: 'salarisadministratie', salaris: 'salarisadministratie' };
  const letters = (value) => String(value == null ? '' : value).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

  /** Bij welke discipline (uit registry: [{ id, name }]) hoort dit tabblad? Het id, of null als het niet (eenduidig) te zeggen is. */
  function disciplineOf(sheetName, registry) {
    const key = letters(sheetName);
    if (!key) return null;
    const matches = registry.filter((discipline) => [discipline.name, discipline.id].some((name) => {
      const other = letters(name);
      const length = Math.min(6, other.length, key.length);
      return length >= 4 && key.slice(0, length) === other.slice(0, length);
    }));
    if (matches.length === 1) return matches[0].id;
    const alias = Object.keys(ALIASES).find((word) => key.startsWith(word));
    return alias && registry.some((discipline) => discipline.id === ALIASES[alias]) ? ALIASES[alias] : null;
  }

  /**
   * Een gekozen bestand lezen en samenvatten. Geeft { parts: [{ sheet, discipline, summary }] }:
   * - een bestand met een tabblad per discipline (ieder tabblad heeft alle tabellen): een deel per
   *   tabblad, met de discipline (id) die bij de naam van het tabblad hoort, of null;
   * - anders één deel uit het hele boek (de tabellen mogen dan over tabbladen verdeeld zijn), zonder
   *   sheet en discipline: dat hoort bij de discipline waarin je zit.
   * Een fout als geen lezer het bestand herkent, of als twee tabbladen bij dezelfde discipline horen.
   * registry: de disciplines ([{ id, name }]), standaard die van de cockpit.
   */
  async function readExport(file, registry) {
    const disciplines = registry || ns.cockpit.registry();
    const book = await sheets.read(file);
    const perSheet = book.sheets
      .map((sheet) => ({ sheet, found: recognize(Object.assign({}, book, { sheets: [sheet] })) }))
      .filter((item) => item.found);
    if (perSheet.length > 1) {
      const parts = perSheet.map(({ sheet, found }) => ({ sheet: sheet.name, discipline: disciplineOf(sheet.name, disciplines), summary: found.format.summarize(found.input, found.format.id) }));
      const seen = new Map();
      parts.filter((part) => part.discipline).forEach((part) => {
        if (seen.has(part.discipline)) throw new Error(`de tabbladen '${seen.get(part.discipline)}' en '${part.sheet}' horen allebei bij ${disciplines.find((d) => d.id === part.discipline).name}`);
        seen.set(part.discipline, part.sheet);
      });
      return { parts };
    }
    const found = recognize(book);
    if (!found) throw new Error('dit bestand herken ik niet. Verwacht: ' + FORMATS.map((format) => format.expects).join('; of ') + '.');
    const summary = found.format.summarize(found.input, found.format.id);
    // De maandexport noemt zijn discipline: die wint (anders: de discipline waarin je zit)
    return { parts: [{ sheet: null, discipline: summary.discipline ? disciplineOf(summary.discipline, disciplines) : null, summary }] };
  }

  /** Is dit een opgeslagen samenvatting die deze versie kan tonen? */
  const usable = (summary) => Boolean(summary && (
    (summary.version === 1 && Array.isArray(summary.weekly) && summary.weekly.length
      && summary.licences && LICENCES.every(({ id }) => summary.licences[id]) && Array.isArray(summary.channels))
    || (summary.version === 2 && Number.isFinite(summary.people) && Number.isFinite(summary.active) && Number.isFinite(summary.prompts)
      && Array.isArray(summary.teams) && Array.isArray(summary.apps))
  ));

  /** Zijn twee imports met elkaar te vergelijken (dezelfde soort export, dus dezelfde maten)? */
  const comparable = (a, b) => Boolean(a && b && a.version === b.version);
  const isMonthly = (summary) => Boolean(summary && summary.version === 2);

  /* ---- Kengetallen ------------------------------------------------------------------- */
  /** Per licentie en samen: personen, actief en volume (laatste 4 weken), adoptie, per actieve gebruiker, per week actief en groei. */
  function measures(snapshot) {
    if (isMonthly(snapshot)) {
      // Maandexport: alleen licentiehouders, één periode zonder weken (dus geen 'per week' en geen groei)
      const own = {
        people: snapshot.people,
        active: snapshot.active,
        volume: snapshot.prompts,
        adoption: snapshot.people ? snapshot.active / snapshot.people : null,
        perActive: snapshot.active ? snapshot.prompts / snapshot.active : null,
        daysPerActive: snapshot.daysPerActive,
        wau: null,
        growth: null
      };
      return { basic: null, premium: own, total: own };
    }
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
    snapshots.forEach((snapshot) => (snapshot.weekly || []).forEach((week) => weeks.set(week.week, week)));
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

  /* ---- Momenten -------------------------------------------------------------------------- */
  // Belangrijke data (een Boost & Learn, iedereen een licentie): een lijn in de grafieken, en bij
  // 'Wat valt op' het gemiddelde per week ervoor en erna. Opslag: central.listMoments/saveMoments.
  const MOMENT_WEEKS = 4; // zoveel volle weken ervoor en erna

  /**
   * Gemiddeld per week, ervoor (de laatste 4 weken die vóór het moment eindigen) en erna (de eerste 4
   * die op of na het moment beginnen); de week waarin het moment valt telt dus niet mee.
   * @returns {{ before, after }} elk { weeks, active: { basic, premium, total }, volume: { … } }
   */
  function aroundMoment(weeks, date) {
    const at = dayOf(date);
    const side = (list) => {
      const average = (field) => {
        const of = (id) => (list.length ? list.reduce((total, week) => total + week[field][id], 0) / list.length : null);
        const basic = of('basic');
        const premium = of('premium');
        return { basic, premium, total: basic == null ? null : basic + premium };
      };
      return { weeks: list.length, active: average('active'), volume: average('volume') };
    };
    return {
      before: side(weeks.filter((week) => dayOf(week.week) + 7 * DAY <= at).slice(-MOMENT_WEEKS)),
      after: side(weeks.filter((week) => dayOf(week.week) >= at).slice(0, MOMENT_WEEKS))
    };
  }

  /** De zin bij 'Wat valt op' voor één moment, of null als het ver buiten de weken in de gegevens valt. */
  function momentInsight(weeks, moment) {
    const { before, after } = aroundMoment(weeks, moment.date);
    const name = `'${moment.title}' (${shortDate(moment.date)})`;
    if (before.weeks < 2 && after.weeks < 2) return null;
    if (after.weeks < 2) return `Na ${name} ${after.weeks ? 'staat pas 1 week' : 'staan nog geen weken'} in de gegevens: na de volgende import zie je hier wat er veranderde.`;
    if (before.weeks < 2) return `Vóór ${name} staan te weinig weken in de gegevens om mee te vergelijken.`;
    const active = change('relative', after.active.total, before.active.total);
    const volume = change('relative', after.volume.total, before.volume.total);
    const perLicence = LICENCES.map(({ id, label }) => `${label} ${DECIMAL.format(before.active[id])} → ${DECIMAL.format(after.active[id])}`).join(', ');
    return `Rond ${name}: gemiddeld ${DECIMAL.format(after.active.total)} actieve gebruikers per week in de ${after.weeks} weken erna, tegen ${DECIMAL.format(before.active.total)} in de ${before.weeks} weken ervoor${active ? ` (${active.text})` : ''}; ${perLicence}.${volume ? ` Volume per week ${volume.text}.` : ''}`;
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

  function kpiRow(now, then, previous, list) {
    return el('div', { className: 'kpis copilot__kpis' }, (list || MEASURES).map((measure) => el('div', { className: 'kpi' }, [
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

  /* ---- Maandexport (versie 2) ------------------------------------------------------------ */
  const MONTHLY_MEASURES = [
    { id: 'people', label: 'Licenties', format: NUMBER, kind: 'absolute', neutral: true },
    { id: 'active', label: 'Actief in de periode', short: 'Actief', format: NUMBER, kind: 'absolute' },
    { id: 'adoption', label: 'Adoptie', format: PERCENT, kind: 'points' },
    { id: 'volume', label: 'Prompts in de periode', short: 'Prompts', format: NUMBER, kind: 'relative' },
    { id: 'perActive', label: 'Prompts per actieve gebruiker', short: 'Prompts p.p.', format: NUMBER, kind: 'relative' },
    { id: 'daysPerActive', label: 'Actieve dagen per actieve gebruiker', short: 'Dagen p.p.', format: DECIMAL, kind: 'absolute' }
  ];

  const share = (part, whole) => (whole ? part / whole : null);

  /* Het cluster bij de teamnamen uit de maandexport, per discipline (id). Alleen voor Audit; bij
     andere disciplines tonen we de teamnaam zoals hij in de export staat. Hoofdletters en dubbele
     spaties tellen niet mee bij het vergelijken. Geen namen van teamleiders: deze code is openbaar.
     Komt er een team bij of verandert een cluster: pas het hier aan. */
  const TEAM_INFO = {
    audit: [
      { team: 'Team 2', cluster: 'Goes' },
      { team: 'Team 3', cluster: 'Barneveld' },
      { team: 'Team 4', cluster: 'Dordrecht' },
      { team: 'Team 7', cluster: 'Zwolle' },
      { team: 'Team internationaal', cluster: 'Audit internationaal' },
      { team: 'Team Groene Hart', cluster: 'Gouda' }
    ]
  };

  const teamKey = (name) => text(name).toLowerCase().replace(/\s+/g, ' ');

  /** Het cluster bij een team uit de maandexport ({ team, cluster }), of null. discipline: het id. */
  function teamInfo(name, discipline) {
    return (TEAM_INFO[discipline] || []).find((info) => teamKey(info.team) === teamKey(name)) || null;
  }

  /** De teamnaam in lopende tekst: met het cluster erbij als we dat kennen. */
  function teamName(team, discipline) {
    const info = teamInfo(team.name, discipline);
    return info ? `${team.name} · ${info.cluster}` : team.name;
  }

  /**
   * Wat valt op bij een maandexport. previous: de vorige maandexport; other: de import ervoor als die
   * van een andere soort is; discipline: het id (voor de clusters bij de teams, zie TEAM_INFO).
   */
  function monthlyInsights(latest, previous, other, discipline) {
    const items = [];
    const now = measures(latest).total;
    const bands = latest.intensity;
    items.push(`${NUMBER.format(latest.active)} van de ${NUMBER.format(latest.people)} licentiehouders (${show(PERCENT, now.adoption)}) gebruikte Copilot in de periode van ${latest.days} dagen${bands ? `; ${show(PERCENT, share(bands.intensief, latest.people))} intensief (${INTENSITY[0].text})` : ''}.`);
    const unused = latest.people - latest.active;
    if (unused > 0) items.push(`${NUMBER.format(unused)} ${unused === 1 ? 'licentie is' : 'licenties zijn'} in de hele periode niet gebruikt.`);
    const teams = latest.teams.filter((team) => team.active);
    if (teams.length > 1) {
      const byPrompts = teams.slice().sort((a, b) => a.prompts / a.active - b.prompts / b.active);
      const low = byPrompts[0];
      const high = byPrompts[byPrompts.length - 1];
      items.push(`Per actieve gebruiker loopt het uiteen van ${NUMBER.format(low.prompts / low.active)} prompts (${teamName(low, discipline)}) tot ${NUMBER.format(high.prompts / high.active)} (${teamName(high, discipline)}).`);
    }
    const behind = latest.teams.filter((team) => team.people && team.active / team.people < 0.9);
    if (behind.length) items.push(`Onder de 90% actief: ${behind.map((team) => `${teamName(team, discipline)} (${PERCENT.format(team.active / team.people)})`).join(', ')}.`);
    // Onderdelen naast Copilot Chat: de twee meest gebruikte en het minst gebruikte
    const apps = latest.apps.filter((app) => !/^copilot chat/i.test(app.name)).sort((a, b) => b.active - a.active);
    if (apps.length >= 3) {
      const of = (app) => `${app.name} (${PERCENT.format(app.active / latest.people)})`;
      items.push(`Naast Copilot Chat wordt Copilot het meest gebruikt in ${of(apps[0])} en ${of(apps[1])}; het minst in ${of(apps[apps.length - 1])}.`);
    }
    if (previous) {
      const then = measures(previous).total;
      const prompts = change('relative', now.volume, then.volume);
      items.push(`Sinds de vorige maandexport (t/m ${formatDate(previous.periodEnd)}): ${SIGNED.format(now.active - then.active)} actieve gebruikers, adoptie van ${show(PERCENT, then.adoption)} naar ${show(PERCENT, now.adoption)}${prompts ? ', prompts ' + prompts.text : ''}.`);
    } else if (other) {
      items.push(`De import hiervoor (t/m ${formatDate(other.periodEnd)}) kwam uit het analysebestand, met andere maten: met deze maandexport begint een nieuwe reeks. Vanaf de volgende maandexport zie je hier het verschil.`);
    }
    return items;
  }

  /** Liggende balken: [{ label, note, value, of }] met de waarde en het deel van 'of' erachter. */
  function barList(rows) {
    const max = Math.max(1, ...rows.map((row) => row.value));
    return el('ul', { className: 'bars', attrs: { role: 'list' } }, rows.map((row) => {
      const bar = el('span', { className: 'bars__bar' });
      bar.style.setProperty('--share', String(row.value / max));
      return el('li', { className: 'bars__row' }, [
        el('span', { className: 'bars__label' }, [row.label, row.note ? el('span', { className: 'copilot__note', text: row.note }) : null]),
        el('span', { className: 'bars__track' }, [
          bar,
          el('span', { className: 'bars__value', text: NUMBER.format(row.value) + (row.of ? ' · ' + PERCENT.format(row.value / row.of) : '') })
        ])
      ]);
    }));
  }

  function intensityBlock(snapshot) {
    return el('section', { className: 'usage-table' }, [
      el('h3', { className: 'usage-table__title', text: 'Hoe intensief' }),
      el('p', { className: 'chart__sub', text: 'Gemiddeld aantal dagen per week waarop iemand Copilot gebruikte; het deel van alle licenties.' }),
      snapshot.intensity
        ? barList(INTENSITY.map((band) => ({ label: band.label, note: band.text, value: snapshot.intensity[band.id], of: snapshot.people })))
        : el('p', { className: 'section__lead', text: 'Niet in dit bestand.' })
    ]);
  }

  function appsBlock(snapshot) {
    return el('section', { className: 'usage-table' }, [
      el('h3', { className: 'usage-table__title', text: 'Per onderdeel' }),
      el('p', { className: 'chart__sub', text: 'Hoeveel licentiehouders het onderdeel minstens één keer gebruikten. Wie meer onderdelen gebruikte, telt bij elk ervan mee: niet optellen.' }),
      snapshot.apps.length
        ? barList(snapshot.apps.slice().sort((a, b) => b.active - a.active).map((app) => ({ label: app.name, value: app.active, of: snapshot.people })))
        : el('p', { className: 'section__lead', text: 'Niet in dit bestand.' })
    ]);
  }

  /** De intensiteit van een team als één gestapelde balk (delen van de licenties), met de tekst erbij voor schermlezers. */
  function mixBar(team) {
    if (!team.intensity || !team.people) return el('span', { text: '–' });
    const words = INTENSITY.filter((band) => team.intensity[band.id]).map((band) => `${band.label.toLowerCase()} ${PERCENT.format(team.intensity[band.id] / team.people)}`).join(', ');
    return el('span', { className: 'copilot__mix', attrs: { role: 'img', 'aria-label': words, title: words } }, INTENSITY.map((band, index) => {
      const part = el('span', { className: `copilot__mix-part copilot__mix-part--${index + 1}` });
      part.style.setProperty('--share', String(team.intensity[band.id] / team.people));
      return part;
    }));
  }

  /** De kop van een teamrij: de naam, met het cluster eronder als we dat kennen. */
  function teamCell(team, discipline) {
    const info = teamInfo(team.name, discipline);
    return el('th', { attrs: { scope: 'row' } }, [team.name, info ? el('span', { className: 'copilot__note', text: `Cluster ${info.cluster}` }) : null]);
  }

  function teamsBlock(snapshot, previous, discipline) {
    const before = previous && comparable(snapshot, previous) ? new Map(previous.teams.map((team) => [team.name, team])) : null;
    const columns = ['Team', 'Licenties', 'Actief', '% actief', 'Prompts', 'Prompts p.p.', 'Dagen p.p.', 'Intensiteit'];
    const percent = (team) => {
      const value = share(team.active, team.people);
      const old = before && before.get(team.name);
      const diff = old ? change('points', value, share(old.active, old.people)) : null;
      return show(PERCENT, value) + (diff && diff.value ? ` (${diff.text})` : '');
    };
    const hasMix = snapshot.teams.some((team) => team.intensity);
    return el('section', { className: 'usage-table' }, [
      el('h3', { className: 'usage-table__title', text: 'Per team' }),
      el('p', { className: 'chart__sub', text: 'Teams met minder dan 5 licentiehouders zijn al samengevoegd in de export. Prompts p.p. en Dagen p.p.: gemiddeld per actieve gebruiker.' }),
      el('table', { className: 'table' }, [
        before ? el('caption', { className: 'copilot__caption', text: `Tussen haakjes: het verschil in %-punt met de maandexport t/m ${formatDate(previous.periodEnd)}.` }) : null,
        el('thead', {}, [el('tr', {}, columns.slice(0, hasMix ? 8 : 7).map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index > 0 && index < 7 ? 'num' : null } })))]),
        el('tbody', {}, snapshot.teams.map((team) => el('tr', {}, [
          teamCell(team, discipline),
          el('td', { className: 'num', text: NUMBER.format(team.people) }),
          el('td', { className: 'num', text: NUMBER.format(team.active) }),
          el('td', { className: 'num', text: percent(team) }),
          el('td', { className: 'num', text: NUMBER.format(team.prompts) }),
          el('td', { className: 'num', text: show(NUMBER, share(team.prompts, team.active)) }),
          el('td', { className: 'num', text: show(DECIMAL, team.daysPerActive) }),
          hasMix ? el('td', {}, [mixBar(team)]) : null
        ])))
      ]),
      hasMix ? el('ul', { className: 'chart__legend copilot__mix-legend', attrs: { role: 'list' } }, INTENSITY.map((band, index) =>
        el('li', {}, [el('span', { className: `copilot__mix-key copilot__mix-part--${index + 1}`, attrs: { 'aria-hidden': 'true' } }), el('span', { text: band.label })]))) : null
    ]);
  }

  function monthlyDefinitions() {
    const items = [
      ['Bron', 'De maandexport van IT: het Microsoft 365 Copilot-gebruiksrapport (Microsoft Graph), gekoppeld aan AFAS. Alleen groepscijfers.'],
      ['Licenties', 'Collega\'s met een licentie voor Microsoft 365 Copilot. Gebruik van Copilot Chat zonder licentie staat niet in deze export.'],
      ['Actief', 'Minstens één Copilot-activiteit in de periode. Adoptie: het deel van de licenties.'],
      ['Intensiteit', 'Op basis van het gemiddeld aantal actieve dagen per week: intensief 2,5 of meer, regelmatig 1 tot 2,5, incidenteel minder dan 1.'],
      ['Prompts p.p.', 'Prompts in de periode, gedeeld door het aantal actieve gebruikers. Dagen p.p.: idem voor de actieve dagen.'],
      ['Vergelijking', 'Alleen met de vorige maandexport. Het analysebestand van daarvoor had andere maten (Basic en Premium, acties per week): die cijfers staan bij Alle imports, maar we zetten ze niet tegen elkaar af.']
    ];
    return el('details', { className: 'copilot__definitions' }, [
      el('summary', { text: 'Hoe lees je deze cijfers?' }),
      el('dl', {}, items.map(([term, value]) => el('div', {}, [el('dt', { text: term }), el('dd', { text: value })])))
    ]);
  }

  /* ---- Pagina ------------------------------------------------------------------------ */
  function render() {
    const node = el('div', { className: 'copilot' });
    const status = el('div', { className: 'copilot__status' });
    const body = el('div', { className: 'copilot__body' });
    let saved = [];   // rijen uit de database, oudste eerst
    let missing = false;
    let pending = null; // ingelezen voor deze discipline, nog niet opgeslagen
    let pendingName = '';
    let pendingParts = []; // een tabblad per discipline: alle tabbladen uit het bestand (anders leeg)
    let storedParts = [];  // daarvan al opgeslagen (als opslaan halverwege mislukte)
    let momentRows = [];   // momenten per discipline (en de gedeelde basis), uit de database
    const here = () => ns.cockpit.activeId();
    const nameOf = (id) => (ns.cockpit.find(id) || { name: id }).name;
    const names = (parts) => parts.map((part) => nameOf(part.discipline)).join(', ');

    // Momenten van deze discipline en die voor alle disciplines (de gedeelde basis), op datum
    const ownNamespace = () => ns.cockpit.namespace(here());
    const byDate = (a, b) => (a.date < b.date ? -1 : 1);
    const momentsOf = (namespace) => (momentRows.find((row) => row.namespace === namespace) || { moments: [] }).moments;
    const momentsHere = () => momentsOf(ownNamespace()).map((moment) => Object.assign({ general: false }, moment))
      .concat(momentsOf(ns.cockpit.GENERAL_NAMESPACE).map((moment) => Object.assign({ general: true }, moment)))
      .sort(byDate);
    const markers = () => momentsHere().map((moment) => ({ date: moment.date, label: moment.title }));

    /** Nieuwe lijst momenten opslaan voor één naamruimte en de pagina opnieuw opbouwen. */
    async function storeMoments(namespace, list) {
      await ns.central.saveMoments(list, namespace);
      momentRows = momentRows.filter((row) => row.namespace !== namespace).concat({ namespace, moments: list });
      update();
    }

    function momentsBlock() {
      const date = el('input', { className: 'field__input', attrs: { id: 'moment-date', type: 'date', required: true } });
      const title = el('input', { className: 'field__input', attrs: { id: 'moment-title', type: 'text', maxlength: '80', required: true, placeholder: 'Bijv. Boost & Learn met de AI Snackbar' } });
      const general = el('input', { attrs: { id: 'moment-general', type: 'checkbox' } });
      const error = el('p', { className: 'field__error', attrs: { id: 'moment-error', role: 'alert' } });
      const add = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'submit' } }, [icon('plus'), el('span', { text: 'Moment toevoegen' })]);
      const form = el('form', { className: 'moments__form', attrs: { novalidate: true, 'aria-describedby': 'moment-error' } }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'moment-date' }, text: 'Datum' }), date]),
        el('div', { className: 'field moments__what' }, [el('label', { className: 'field__label', attrs: { for: 'moment-title' }, text: 'Wat gebeurde er?' }), title]),
        el('label', { className: 'check moments__general', attrs: { for: 'moment-general' } }, [general, el('span', { text: 'Voor alle disciplines' })]),
        add,
        error
      ]);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = title.value.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value) || !text) {
          error.textContent = !text ? 'Vul in wat er gebeurde.' : 'Kies een datum.';
          (text ? date : title).focus();
          return;
        }
        error.textContent = '';
        const namespace = general.checked ? ns.cockpit.GENERAL_NAMESPACE : ownNamespace();
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const done = kit.busy(add, 'Opslaan…');
        try {
          await storeMoments(namespace, momentsOf(namespace).concat({ id, date: date.value, title: text.slice(0, 80) }).sort(byDate));
          toast('Moment toegevoegd', { tone: 'success' });
          const again = body.querySelector('#moment-date');
          if (again) again.focus();
        } catch (failure) {
          done();
          kit.failed('Opslaan', failure);
        }
      });

      const list = momentsHere();
      return el('section', { className: 'moments' }, [
        el('h3', { className: 'usage-table__title', text: 'Momenten' }),
        el('p', { className: 'field__hint', text: 'Belangrijke data, zoals een Boost & Learn of de dag dat iedereen een licentie kreeg. Ze staan als genummerde lijn in de grafieken, en bij Wat valt op zie je het gemiddelde per week ervoor en erna. Dat laat zien wát er veranderde, niet waardoor: ook vakanties en drukte spelen mee.' }),
        list.length ? el('ul', { className: 'moments__list' }, list.map((moment) => {
          const namespace = moment.general ? ns.cockpit.GENERAL_NAMESPACE : ownNamespace();
          const remove = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', 'aria-label': `Moment '${moment.title}' verwijderen` } }, [icon('trash'), el('span', { text: 'Verwijderen' })]);
          remove.addEventListener('click', async () => {
            if (!(await ns.ui.confirmDialog(`'${moment.title}' (${formatDate(moment.date)}) verdwijnt uit de grafieken${moment.general ? ' van alle disciplines' : ''}.`, { title: 'Moment verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
            remove.disabled = true;
            try {
              await storeMoments(namespace, momentsOf(namespace).filter((other) => other.id !== moment.id));
              toast('Verwijderd');
            } catch (failure) {
              remove.disabled = false;
              kit.failed('Verwijderen', failure);
            }
          });
          return el('li', { className: 'moments__item' }, [
            el('span', { className: 'moments__date', text: formatDate(moment.date) }),
            el('span', { className: 'moments__title', text: moment.title }),
            el('span', { className: 'badge', text: moment.general ? 'Alle disciplines' : nameOf(here()) }),
            remove
          ]);
        })) : null,
        form
      ]);
    }

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
        const { parts } = await readExport(chosen);
        // Eén deel dat zegt bij een andere discipline te horen: net als een tabblad per discipline daar opslaan
        const elsewhere = parts.length === 1 && parts[0].discipline && parts[0].discipline !== here();
        const multi = parts.length > 1 || Boolean(elsewhere);
        const mine = multi ? parts.find((part) => part.discipline === here()) : parts[0];
        pending = mine ? mine.summary : null;
        pendingParts = multi ? parts : [];
        storedParts = [];
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

    const factsOf = (summary) => {
      if (isMonthly(summary)) return [`${summary.days} dagen`, `${NUMBER.format(summary.people)} licenties`, `${summary.teams.length} ${summary.teams.length === 1 ? 'team' : 'teams'}`];
      const facts = [`${summary.weeks} weken`, `${NUMBER.format(summary.people)} personen`];
      if (summary.skipped) facts.push(`${NUMBER.format(summary.skipped)} ${summary.skipped === 1 ? 'rij' : 'rijen'} zonder licentie overgeslagen`);
      return facts;
    };

    function pendingNotice() {
      // Opslaan per discipline: een tabblad per discipline, of één bestand van een andere discipline
      const multi = pendingParts.length > 0;
      const single = pendingParts.length === 1 && !pendingParts[0].sheet;
      // Wat er bij Opslaan naar de database gaat: per discipline de totalen (een tabblad zonder discipline niet)
      const savable = multi ? pendingParts.filter((part) => part.discipline) : [{ discipline: here(), summary: pending }];
      const replaces = Boolean(pending) && saved.some((row) => row.period_end === pending.periodEnd);
      let label = replaces ? 'Opslaan en vervangen' : 'Opslaan';
      if (multi) label = `Opslaan voor ${savable.length === 1 ? nameOf(savable[0].discipline) : `${storedParts.length ? 'de overige' : 'alle'} ${savable.length} disciplines`}`;
      const save = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', disabled: missing || !savable.length } }, [icon('check'), el('span', { text: label })]);
      const discard = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('close'), el('span', { text: 'Niet opslaan' })]);
      const clear = () => {
        pending = null;
        pendingParts = [];
        storedParts = [];
      };
      save.addEventListener('click', async () => {
        const done = kit.busy([save, discard], 'Opslaan…');
        const stored = [];
        try {
          for (const part of savable) {
            const row = await ns.central.saveCopilotUsage(part.summary, multi ? ns.cockpit.namespace(part.discipline) : undefined);
            stored.push(part);
            if (part.discipline === here()) saved = saved.filter((other) => other.period_end !== row.period_end).concat(row).sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
          }
          toast(multi ? `Opgeslagen voor ${names(stored)}` : 'Opgeslagen: ' + period(pending), { tone: 'success' });
          clear();
          update();
          choose.focus(); // de knop waarmee je was begonnen (de melding met Opslaan is weg)
        } catch (error) {
          done();
          if (stored.length) {
            // Wat al is opgeslagen niet nog eens aanbieden
            pendingParts = pendingParts.filter((part) => !stored.includes(part));
            storedParts = storedParts.concat(stored);
            if (stored.some((part) => part.discipline === here())) pending = null;
            update();
          }
          kit.failed(stored.length ? `Opslaan (wel gelukt: ${names(stored)})` : 'Opslaan', error, 10000);
        }
      });
      discard.addEventListener('click', () => {
        clear();
        update();
        choose.focus();
      });
      const action = el('div', { className: 'copilot__actions' }, [save, discard]);

      if (!multi) {
        return notice({
          icon: 'table',
          className: 'copilot__pending',
          title: `Ingelezen uit ${pendingName}: ${period(pending)}`,
          text: `${factsOf(pending).join(' · ')}. Nog niet opgeslagen: hieronder zie je hoe het eruitziet. Bij opslaan gaan alleen de totalen naar de database${replaces ? '; de import met dezelfde einddatum wordt vervangen' : ''}.`,
          action
        });
      }
      const sheetList = el('ul', { className: 'copilot__sheets' }, pendingParts.map((part) => el('li', {}, [
        el('strong', { text: part.discipline ? nameOf(part.discipline) : 'Niet opgeslagen' }),
        `${part.sheet ? ` · tabblad '${part.sheet}'` : ''} · ${period(part.summary)} · ${factsOf(part.summary).join(' · ')}`,
        part.discipline ? null : el('span', { className: 'copilot__note', text: 'Bij geen enkele discipline te plaatsen: geef het tabblad de naam van een discipline.' })
      ])));
      const hereStored = storedParts.some((part) => part.discipline === here());
      const named = single ? pendingParts[0].summary.discipline : ''; // zoals het in het bestand staat
      const target = single ? nameOf(pendingParts[0].discipline) : '';
      let shown = single
        ? `Dit bestand is van ${target}${named && named !== target ? ` ('${named}')` : ''}, niet van ${nameOf(here())}: het wordt bij ${target} opgeslagen en hier verandert niets.`
        : `Er is geen tabblad voor ${nameOf(here())}, dus hier verandert niets.`;
      if (pending) shown = `Hieronder zie je hoe het eruitziet voor ${nameOf(here())}; de andere disciplines zie je daar na het opslaan.`;
      if (hereStored) shown = '';
      if (storedParts.length) shown = `${shown} Al opgeslagen: ${names(storedParts)}.`.trim();
      return notice({
        icon: 'table',
        className: 'copilot__pending',
        title: single ? `Ingelezen uit ${pendingName}: cijfers van ${nameOf(pendingParts[0].discipline)}` : `Ingelezen uit ${pendingName}: een tabblad per discipline`,
        text: `${storedParts.length ? 'Nog niet alles opgeslagen.' : 'Nog niet opgeslagen.'} ${shown} Bij opslaan gaan ${single ? '' : 'per discipline '}alleen de totalen naar de database; een import met dezelfde einddatum wordt vervangen.`,
        more: single ? [] : [sheetList],
        action
      });
    }

    function historyBlock(list) {
      const columns = ['Periode', 'Duur', 'Personen', 'Actief (4 wkn)', 'Adoptie', 'Volume (4 wkn)', 'Per actieve gebruiker', 'Ingelezen', ''];
      const mixed = list.some(isMonthly) && list.some((snapshot) => !isMonthly(snapshot));
      return el('section', { className: 'usage-table' }, [
        el('h3', { className: 'usage-table__title', text: list.length === 1 ? 'Import' : `Alle imports (${list.length})` }),
        mixed ? el('p', { className: 'chart__sub', text: 'Twee soorten export met andere maten: vergelijk alleen imports van dezelfde soort.' }) : null,
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
              el('th', { className: 'copilot__period', attrs: { scope: 'row' } }, [period(snapshot), mixed ? el('span', { className: 'copilot__note', text: isMonthly(snapshot) ? 'Maandexport (licenties, prompts)' : 'Analysebestand (Basic + Premium)' }) : null]),
              el('td', { className: 'num', text: isMonthly(snapshot) ? `${snapshot.days} dgn` : `${snapshot.weeks} wkn` }),
              ...[total.people, total.active].map((value) => el('td', { className: 'num', text: show(NUMBER, value) })),
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

    /** De maandexport: tegels, wat valt op, intensiteit, onderdelen, teams en (vanaf twee) het verloop per maand. */
    function monthlyDashboard(list, latest, previous, other) {
      const now = measures(latest);
      const then = previous ? measures(previous) : null;
      const months = list.filter(isMonthly);
      const facts = [`${latest.days} dagen`, `${NUMBER.format(latest.people)} licenties`];
      if (latest.discipline) facts.unshift(latest.discipline);
      facts.push(previous ? `vergeleken met de maandexport t/m ${formatDate(previous.periodEnd)}` : 'de eerste maandexport: bij de volgende zie je hier het verschil');
      if (latest.pending) facts.push('nog niet opgeslagen');
      const point = (snapshot) => {
        const m = measures(snapshot).total;
        return { week: snapshot.periodEnd, values: { active: m.active, people: m.people, perActive: Math.round(m.perActive || 0), daysPerActive: m.daysPerActive || 0 } };
      };
      return el('div', { className: 'copilot__dashboard' }, [
        el('div', { className: 'copilot__head' }, [
          el('h2', { className: 'section__title', text: 'Periode ' + period(latest) }),
          el('p', { className: 'copilot__meta', text: facts.join(' · ') })
        ]),
        kpiRow(now, then, previous, MONTHLY_MEASURES),
        el('section', { className: 'copilot__insights' }, [
          el('h3', { className: 'usage-table__title', text: 'Wat valt op' }),
          el('ul', {}, monthlyInsights(latest, previous, other, here()).map((value) => el('li', { text: value })))
        ]),
        el('div', { className: 'usage-grid' }, [intensityBlock(latest), appsBlock(latest)]),
        teamsBlock(latest, previous, here()),
        months.length > 1 ? el('div', { className: 'copilot__charts' }, [
          lineChart({ title: 'Licenties en actief, per maandexport', series: [{ id: 'active', label: 'Actief' }, { id: 'people', label: 'Licenties' }], pointLabel: 'Periode t/m', gapDays: 40, markers: markers(), points: months.map(point) }),
          lineChart({ title: 'Prompts per actieve gebruiker, per maandexport', series: [{ id: 'perActive', label: 'Prompts p.p.' }], pointLabel: 'Periode t/m', gapDays: 40, markers: markers(), points: months.map(point) })
        ]) : null,
        missing ? null : momentsBlock(),
        historyBlock(list),
        monthlyDefinitions()
      ]);
    }

    function dashboard(list) {
      const latest = list[list.length - 1];
      const earlier = list.slice(0, -1);
      // Vergelijken alleen met een import van dezelfde soort (dezelfde maten)
      const previous = earlier.filter((snapshot) => comparable(snapshot, latest)).pop() || null;
      if (isMonthly(latest)) return monthlyDashboard(list, latest, previous, previous ? null : earlier[earlier.length - 1] || null);
      const now = measures(latest);
      const then = previous ? measures(previous) : null;
      const weeks = timeline(list);
      const facts = [`${latest.weeks} weken`, `${NUMBER.format(latest.people)} personen`];
      facts.push(previous ? `vergeleken met de import t/m ${formatDate(previous.periodEnd)}` : 'de eerste import: bij de volgende zie je hier het verschil');
      if (latest.pending) facts.push('nog niet opgeslagen');
      const notes = insights(latest, now, then, previous).concat(momentsHere().map((moment) => momentInsight(weeks, moment)).filter(Boolean));
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
          lineChart({ title: 'Actieve gebruikers per week', sub: weeks.length > latest.weeks ? 'Alle weken uit alle imports.' : null, series: LICENCES, markers: markers(), points: weeks.map((week) => ({ week: week.week, values: week.active })) }),
          lineChart({ title: 'Volume per week', sub: 'Basic: prompts in Copilot Chat. Premium: alle Copilot-acties.', series: LICENCES, markers: markers(), points: weeks.map((week) => ({ week: week.week, values: week.volume })) })
        ]),
        missing ? null : momentsBlock(),
        el('div', { className: 'usage-grid' }, [channelsBlock(latest), frequencyBlock(latest)]),
        historyBlock(list),
        definitions()
      ]);
    }

    function update() {
      status.replaceChildren(...[
        missing ? notice({ tone: 'warning', title: 'Nog niet ingericht', text: 'De tabel voor het Copilot-gebruik ontbreekt: voer setup/supabase-audit-copilot.sql (stap 9) uit in Supabase. Een bestand inlezen en bekijken kan al wel, opslaan nog niet.' }) : null,
        pending || pendingParts.length ? pendingNotice() : null
      ].filter(Boolean));
      const list = snapshots();
      body.replaceChildren(...(list.length ? [dashboard(list)] : [notice({
        icon: 'chart',
        title: 'Nog geen imports',
        text: 'Kies Export inlezen en selecteer het Excel-bestand met het Copilot-gebruik. Je ziet eerst wat er is gelezen; pas bij Opslaan gaan de totalen naar de database.'
      }), missing ? null : momentsBlock()]).filter(Boolean));
    }

    async function load() {
      body.replaceChildren(el('p', { className: 'loading', text: 'Copilot-gebruik laden…' }));
      try {
        // Momenten niet lezen lukt: dan alleen geen lijnen in de grafieken
        const [rows, moments] = await Promise.all([ns.central.listCopilotUsage(), ns.central.listMoments().catch(() => [])]);
        missing = rows === null;
        saved = (rows || []).filter((row) => usable(row.summary));
        momentRows = moments || [];
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

  ns.adminCopilot = { render, readExport, disciplineOf, summarize, summarizeMonthly, measures, timeline, change, period, aroundMoment, momentInsight, monthlyInsights, teamInfo, isUsage: usable, isMonthly, comparable, FORMATS, LICENCES, INTENSITY, TEAM_INFO };
})(window.AIAudit);
