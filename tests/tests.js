/* ==========================================================================
   Tests voor de kern: placeholders, zoeken, controles op adressen en paden,
   inhoud laden, rechten, het soortenregister, de verzoeken naar Supabase
   (fetch nagebootst), de werkversies, het gereedschap van Beheer en het
   inlezen van het Copilot-gebruik (met een verzonnen bestand uit
   fixture-copilot.js) en de route van een idee per discipline.
   Draait in de browser (tests/index.html), zonder build of npm.
   ========================================================================== */
(function (ns) {
  'use strict';

  const results = [];
  let group = '';

  /* ---- Klein testraamwerk ---------------------------------------------------------- */
  const describe = (name) => {
    group = name;
  };

  async function test(name, run) {
    try {
      await run();
      results.push({ group, name, ok: true });
    } catch (error) {
      results.push({ group, name, ok: false, message: error && error.message ? error.message : String(error) });
    }
  }

  const show = (value) => JSON.stringify(value);

  function equal(actual, expected, what) {
    if (show(actual) !== show(expected)) throw new Error(`${what ? what + ': ' : ''}${show(actual)}, verwacht ${show(expected)}`);
  }

  function ok(value, what) {
    if (!value) throw new Error((what || 'verwacht waar') + `: ${show(value)}`);
  }

  /** fetch nabootsen: ieder verzoek wordt bewaard, het antwoord komt uit de lijst (of 200 []). */
  function fakeFetch(replies) {
    const calls = [];
    const real = window.fetch;
    window.fetch = async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      const next = replies.shift();
      if (next instanceof Error) throw next;
      const [status, body] = next || [200, []];
      return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    };
    return { calls, restore: () => { window.fetch = real; } };
  }

  async function run() {
    /* ---- ui: tekst, zoeken en plaatshouders ---- */
    describe('Tekst en zoeken (js/ui.js)');
    await test('normalize: kleine letters, zonder accenten, één spatie', () => {
      equal(ns.ui.normalize('  Continuïteit   ÉÉN  '), 'continuiteit een');
    });
    await test('matches: alle zoekwoorden moeten voorkomen, in elke volgorde', () => {
      const haystack = ns.ui.normalize('Risico-inventarisatie voor de planningsfase');
      ok(ns.ui.matches(haystack, 'planning risico'), 'beide woorden');
      ok(!ns.ui.matches(haystack, 'planning excel'), 'één woord ontbreekt');
      ok(ns.ui.matches(haystack, 'Plánning'), 'accent in de zoekterm');
    });
    await test('formatDate: Nederlandse korte datum; onzin geeft niets', () => {
      equal(ns.ui.formatDate('2026-10-23'), '23 okt. 2026');
      equal(ns.ui.formatDate('geen datum'), '');
    });
    await test('countWord: woord aan het begin van een zin, vanaf 11 het getal', () => {
      equal([1, 4, 10, 11].map(ns.ui.countWord), ['Eén', 'Vier', 'Tien', '11']);
    });

    describe('Plaatshouders in prompts (js/ui.js)');
    const prompt = 'Voor [KLANTNAAM] in het [PROCES, bijv. inkoopproces]: kies [JA / NEE]. [PLAK HIER DE NOTULEN] en nog eens [KLANTNAAM].';
    await test('parsePlaceholders: label, voorbeeld, keuzes, lang veld; dubbele één keer', () => {
      const fields = ns.ui.parsePlaceholders(prompt);
      equal(fields.map((f) => f.label), ['KLANTNAAM', 'PROCES', 'JA / NEE', 'PLAK HIER DE NOTULEN']);
      equal(fields[1].hint, 'bijv. inkoopproces', 'voorbeeld');
      equal(fields[2].options, ['JA', 'NEE'], 'keuzes');
      equal(fields.map((f) => f.long), [false, false, false, true], 'lang veld');
    });
    await test('fillPlaceholders: alleen wat is ingevuld, overal; de rest blijft staan', () => {
      const filled = ns.ui.fillPlaceholders(prompt, { KLANTNAAM: ' Bakkerij Jansen ', 'JA / NEE': '   ' });
      equal(filled, 'Voor Bakkerij Jansen in het [PROCES, bijv. inkoopproces]: kies [JA / NEE]. [PLAK HIER DE NOTULEN] en nog eens Bakkerij Jansen.');
    });

    /* ---- content: controles en laden ---- */
    describe('Controles op adressen en paden (js/content.js)');
    const { ID_PATTERN, LOCAL_PATH, HTTPS_URL } = ns.content.patterns;
    await test('adres (id): kleine letters, cijfers en streepjes, tot 80 tekens', () => {
      ok(ID_PATTERN.test('notulen-review-2'), 'goed adres');
      ['Notulen', 'met spatie', 'a/b', 'x'.repeat(81), ''].forEach((id) => ok(!ID_PATTERN.test(id), `fout adres '${id.slice(0, 12)}'`));
    });
    await test('eigen pad: wel een bestand op de site, geen ander schema of domein', () => {
      ['assets/videos/demo.mp4', 'demos/player.html#notulen'].forEach((path) => ok(LOCAL_PATH.test(path), path));
      ['javascript:alert(1)', 'https://elders.nl/x', '//elders.nl/x', '/\\elders.nl', 'data:text/html,x', 'a b.png'].forEach((path) => ok(!LOCAL_PATH.test(path), path));
    });
    await test('link: alleen https://', () => {
      ok(HTTPS_URL.test('https://visservisser.sharepoint.com/x'), 'https');
      ['http://x.nl', 'javascript:x', 'https://x.nl/"onmouseover'].forEach((url) => ok(!HTTPS_URL.test(url), url));
    });

    describe('Inhoud laden (js/content.js)');
    const rows = [
      { namespace: 'ai-test', type: 'meta', id: 'bron', data: {}, position: 0, status: 'published' },
      { namespace: 'ai-test', type: 'phase', id: 'planning', data: { label: 'Planning', short: 'Plan', accent: 'teal', icon: 'map' }, position: 10, status: 'published' },
      { namespace: 'ai-test', type: 'usecase', id: 'notulen', data: { title: 'Notulen', phase: 'planning', intro: 'x', video: 'javascript:alert(1)', prompts: [{ label: 'Stap 1 · Lezen', text: 'Lees [STUK]' }, { text: 'Vat samen' }] }, position: 10, status: 'published' },
      { namespace: 'ai-test', type: 'prompt', id: 'los', data: { title: 'Losse prompt', phase: 'onbekend', prompt: 'Tekst' }, position: 10, status: 'published' },
      { namespace: 'ai-test', type: 'prompt', id: 'Fout Adres', data: { title: 'X', phase: 'planning', prompt: 'Y' }, position: 20, status: 'published' },
      { namespace: 'ai-test', type: 'prompt', id: 'weg', data: { title: 'In de prullenbak', phase: 'planning', prompt: 'Z' }, position: 30, status: 'trash' },
      { namespace: 'ai-test', type: 'setting', id: 'site', data: { tagline: 'Concept' }, position: 0, status: 'draft' }
    ];
    await test('fromRows: zonder rij meta/bron is de database (nog) niet leidend', () => {
      equal(ns.content.fromRows(rows.filter((row) => row.type !== 'meta')), null);
    });
    await test('load: prullenbak en ongeldige adressen eruit, prompts uit de usecase erbij', () => {
      ns.content.load(ns.content.fromRows(rows));
      equal(ns.content.usecases.map((u) => u.id), ['notulen']);
      equal(ns.content.prompts.map((p) => p.id).sort(), ['los', 'notulen-1', 'notulen-2']);
      equal(ns.content.usecaseById.get('notulen').promptIds, ['notulen-1', 'notulen-2']);
    });
    await test('load: een pad met een ander schema wordt genegeerd, met een melding', () => {
      equal(ns.content.usecaseById.get('notulen').video, '');
      ok(ns.content.issues.some((issue) => issue.includes('javascript:')), 'melding over het pad');
    });
    await test('load: onbekende fase wordt de eerste, met een melding', () => {
      equal(ns.content.promptById.get('los').phase.id, 'planning');
      ok(ns.content.issues.some((issue) => issue.includes("onbekende fase 'onbekend'")), 'melding over de fase');
    });
    await test('load: alleen gepubliceerde teksten van de site', () => {
      equal(ns.content.settings.tagline, undefined);
    });
    await test('search: vindt usecases en prompts op een woord uit de tekst', () => {
      const found = ns.content.search('notulen');
      equal(found.usecases.map((u) => u.id), ['notulen']);
      ok(found.prompts.length >= 2, 'de prompts uit de usecase');
    });
    await test('losse prompt: vervolgstappen en een versie zonder licentie (alleen bij licentie)', () => {
      const extra = rows.concat([
        { namespace: 'ai-test', type: 'prompt', id: 'twee-stappen', data: { title: 'Mail beantwoorden', phase: 'planning', license: true, prompt: 'Zoek de mail [ONDERWERP]', promptBasic: 'Lees de geplakte mail', noteBasic: 'Plak de mail', followUps: [{ label: 'Stap 2 · Antwoord', text: 'Schrijf een antwoord' }, { label: 'Leeg', text: ' ' }, { text: 'Korter' }] }, position: 40, status: 'published' },
        { namespace: 'ai-test', type: 'prompt', id: 'gratis', data: { title: 'Gratis', phase: 'planning', license: false, prompt: 'Tekst', promptBasic: 'Overbodig' }, position: 50, status: 'published' }
      ]);
      ns.content.load(ns.content.fromRows(extra));
      const prompt = ns.content.promptById.get('twee-stappen');
      equal([prompt.promptLabel, prompt.followUps, prompt.promptBasic, prompt.noteBasic], ['Stap 1', [{ label: 'Stap 2 · Antwoord', text: 'Schrijf een antwoord' }, { label: 'Stap 3', text: 'Korter' }], 'Lees de geplakte mail', 'Plak de mail']);
      equal(ns.content.promptById.get('gratis').promptBasic, '', 'geen versie zonder licentie bij een gratis prompt');
      equal(ns.content.promptById.get('notulen-1').followUps, [], 'prompt uit een usecase');
      equal(ns.content.search('geplakte').prompts.map((p) => p.id), ['twee-stappen'], 'zoeken in de versie zonder licentie');
    });
    await test('licenseMatch: een prompt met ook een versie zonder licentie past bij ieder filter', () => {
      equal(['all', 'no', 'yes'].map((wanted) => ns.blocks.licenseMatch(wanted, 'both')), [true, true, true]);
      equal(['no', 'yes'].map((wanted) => ns.blocks.licenseMatch(wanted, true)), [false, true]);
    });

    /* ---- kinds ---- */
    describe('Soortenregister (js/kinds.js)');
    await test('adres en menu bij een soort', () => {
      equal(ns.kinds.href('agent', 'copilot-chat'), '#/agent/copilot-chat');
      equal(ns.kinds.byRoute('training').type, 'training');
      equal([ns.kinds.navFor('usecase'), ns.kinds.navFor('prompts'), ns.kinds.navFor('ideeen'), ns.kinds.navFor('beheer')], ['usecases', 'prompts', 'ideeen', '']);
    });

    /* ---- rights ---- */
    describe('Rechten (js/rights.js, zelfde regels als de database)');
    const realRights = ns.central.rights;
    const as = (rights) => {
      ns.central.rights = () => rights;
    };
    await test('hoofdbeheerder mag alles', () => {
      as({ owner: true, roles: [] });
      ok(ns.rights.can('verwijderen', 'ai-audit', 'tip') && ns.rights.can('publiceren', 'ai-algemeen'), 'alles');
    });
    await test('redacteur voor alleen tips: bewerken en publiceren, niet verwijderen, niets anders', () => {
      as({ owner: false, roles: [{ namespace: 'ai-audit', role: 'redacteur', sections: ['tip'] }] });
      equal(['bewerken', 'publiceren', 'verwijderen'].map((action) => ns.rights.can(action, 'ai-audit', 'tip')), [true, true, false]);
      ok(!ns.rights.can('bewerken', 'ai-audit', 'prompt'), 'geen prompts');
      ok(!ns.rights.can('bewerken', 'ai-algemeen', 'tip'), 'niet in de gedeelde basis');
      equal(ns.rights.describe('ai-audit'), 'Redacteur · Tips');
    });
    await test('meerdere rollen tellen samen; meta mag niemand', () => {
      as({ owner: false, roles: [{ namespace: '*', role: 'bijdrager', sections: [] }, { namespace: 'ai-audit', role: 'beheerder', sections: ['tip'] }] });
      ok(ns.rights.can('publiceren', 'ai-audit', 'tip'), 'beheerder van tips');
      ok(!ns.rights.can('publiceren', 'ai-audit', 'prompt'), 'bijdrager publiceert niet');
      ok(ns.rights.can('bewerken', 'ai-accountancy', 'prompt'), 'bijdrager overal');
      ok(!ns.rights.can('bewerken', 'ai-audit', 'meta'), 'meta');
    });
    ns.central.rights = realRights;

    /* ---- central ---- */
    describe('Verzoeken naar Supabase (js/central.js, fetch nagebootst)');
    ns.central.init({ config: { centralUrl: 'https://voorbeeld.supabase.co/', centralKey: 'sb_publishable_test', namespace: 'ai-test' } });
    await test('lezen: elke waarde gecodeerd, geen sessie, geen Authorization bij een publishable sleutel', async () => {
      const net = fakeFetch([[200, [{ id: 1 }]]]);
      try {
        const result = await ns.central.listReviews('prompt', 'a b&c=d');
        equal(result, { status: 'ok', items: [{ id: 1 }] });
        const url = new URL(net.calls[0].url);
        equal(url.origin + url.pathname, 'https://voorbeeld.supabase.co/rest/v1/audit_reviews');
        equal(url.searchParams.get('item_id'), 'eq.a b&c=d', 'item_id');
        equal(url.searchParams.get('namespace'), 'eq.ai-test', 'naamruimte');
        ok(!net.calls[0].url.includes('+'), 'een spatie is %20, geen +');
        equal(net.calls[0].init.headers.Authorization, undefined, 'Authorization');
        equal(net.calls[0].init.credentials, 'omit', 'geen cookies');
      } finally {
        net.restore();
      }
    });
    await test('lezen: tabel ontbreekt, server weigert of geen verbinding geeft een status (geen fout)', async () => {
      const net = fakeFetch([[404, { code: 'PGRST205' }], [500, { code: 'XX000' }], new TypeError('offline')]);
      const warn = console.warn;
      console.warn = () => {}; // de melding bij 500 hoort erbij
      try {
        equal((await ns.central.listIdeas()).status, 'missing');
        equal((await ns.central.listIdeas()).status, 'failed');
        equal((await ns.central.listIdeas()).status, 'failed');
      } finally {
        console.warn = warn;
        net.restore();
      }
    });
    await test('stemmen: twee keer vanaf hetzelfde apparaat geeft "duplicate"', async () => {
      const net = fakeFetch([[201], [409, { code: '23505' }]]);
      try {
        equal(await ns.central.vote(5, 'apparaat'), 'ok');
        equal(await ns.central.vote(5, 'apparaat'), 'duplicate');
        equal(JSON.parse(net.calls[0].init.body), [{ idea_id: 5, voter: 'apparaat' }]);
      } finally {
        net.restore();
      }
    });
    await test('zonder adres of sleutel staat de centrale opslag uit', async () => {
      ns.central.init({ config: {} });
      equal(await ns.central.listIdeas(), { status: 'off', items: [] });
      equal(await ns.central.vote(1, 'x'), 'off');
    });

    /* ---- editor ---- */
    describe('Werkversies (js/editor.js)');
    await test('changeOf: wat er bij publiceren gebeurt', () => {
      const of = (row) => ns.editor.changeOf(row);
      equal([
        of({ status: 'published' }),
        of({ status: 'published', draft: { status: 'trash' }, publish_at: '2026-11-01' }),
        of({ status: 'published', draft: {}, publish_at: '2026-11-01' }),
        of({ status: 'published', draft: {}, draft_kind: 'voorstel' }),
        of({ status: 'draft', draft: {} }),
        of({ status: 'published', draft: {} })
      ], ['', 'verwijderen', 'gepland', 'voorstel', 'nieuw', 'gewijzigd']);
    });
    await test('savedState: de werkversie gaat voor, met de gepubliceerde positie als die ontbreekt', () => {
      equal(ns.editor.savedState({ data: { title: 'Oud' }, position: 30, status: 'published', draft: { data: { title: 'Nieuw' } } }), { data: { title: 'Nieuw' }, position: 30, status: 'published' });
      equal(ns.editor.savedState({ data: { title: 'Weg' }, position: 5, status: 'trash' }).status, 'trash');
    });

    /* ---- admin-kit ---- */
    describe('Gereedschap van Beheer (js/admin-kit.js)');
    await test('slug: adres uit een titel, zonder streepje aan het eind', () => {
      equal(ns.adminKit.slug('Één & ander: test-tip!'), 'een-ander-test-tip');
      equal(ns.adminKit.slug('Notulen samenvatten', 8), 'notulen');
    });
    await test('fileName: veilige bestandsnaam met extensie', () => {
      equal(ns.adminKit.fileName('Rapport Q3 (definitief).PDF'), 'rapport-q3-definitief.pdf');
      equal(ns.adminKit.fileName('…'), 'bestand');
    });

    /* ---- admin-sheets ---- */
    describe('Spreadsheets lezen (js/admin-sheets.js, verzonnen bestand)');
    const sheets = ns.adminSheets;
    const fixture = window.AIAuditTest;
    const small = {
      people: [
        { id: 'p1', licence: 'Basic', basicTotal: 100, premiumTotal: 0, total: 100, recent: 10, activeWeeks: 4 },
        { id: 'p2', licence: 'Basic', basicTotal: 50, premiumTotal: 0, total: 50, recent: 0, activeWeeks: 1 },
        { id: 'p3', licence: 'Basic', basicTotal: 0, premiumTotal: 0, total: 0, recent: 0, activeWeeks: 0 },
        { id: 'p4', licence: 'Premium', basicTotal: 0, premiumTotal: 300, total: 300, recent: 40, activeWeeks: 8 },
        { id: 'p5', licence: 'Premium', basicTotal: 20, premiumTotal: 180, total: 200, recent: 20, activeWeeks: 3 },
        { id: 'p6', licence: undefined, basicTotal: 5, premiumTotal: 0, total: 5, recent: 5, activeWeeks: 1 }
      ],
      weekly: [1, 1, 1, 1, 2, 2, 1, 1].map((basic, w) => ({
        week: new Date(Date.UTC(2026, 0, 4 + w * 7)).toISOString().slice(0, 10),
        active: { basic, premium: 2 },
        volume: { basic: w < 4 ? 5 : 10, premium: w < 4 ? 20 : 30 }
      })),
      channels: [{ name: 'Copilot-app', volume: 8 }, { name: 'Teams', volume: 2 }]
    };
    const fileOf = (bytes, name) => new File([bytes], name || 'test.xlsx');
    await test('readXlsx: tabbladen (ook verborgen), gedeelde en losse teksten, opmaak per stukje, getallen', async () => {
      const book = await sheets.read(fileOf(await fixture.copilotWorkbook(small)));
      equal(book.sheets.map((sheet) => [sheet.name, sheet.hidden]), [['Analyse', false], ['Gebruikers', false], ['Chart Data', true]]);
      equal(book.sheets[0].rows[0][0], 'COPILOT-GEBRUIK (VERZONNEN TESTBESTAND)', 'losse tekst');
      equal(book.sheets[1].rows[0].slice(0, 2), ['PersonId', 'Huidige licentie'], 'tekst met opmaak');
      equal(book.sheets[1].rows[4][4], 300, 'getal');
    });
    await test('findTable: op de namen van de kolommen, ook met tabellen naast elkaar; tot de eerste lege rij', async () => {
      const book = await sheets.read(fileOf(await fixture.copilotWorkbook(small)));
      const weeks = sheets.findTable(book, ['week', 'Basic-prompts']);
      equal([weeks.sheet, weeks.rows.length, weeks.rows[0]['Basic-prompts']], ['Chart Data', 8, 5]);
      equal(sheets.findTable(book, ['Basic-kanaal', 'Prompts laatste 4 weken']).rows.length, 2, 'kortere tabel ernaast');
      equal(sheets.findTable(book, ['Bestaat niet']), null);
    });
    await test('excelDate en number: Excel-getal, ISO en dag-maand-jaar; onzin geeft niets', () => {
      equal([sheets.excelDate(46089), sheets.excelDate('2026-03-08'), sheets.excelDate('8-3-2026'), sheets.excelDate('31-2-2026'), sheets.excelDate('morgen')], ['2026-03-08', '2026-03-08', '2026-03-08', '', '']);
      equal([sheets.number(12), sheets.number(' 12,5 '), sheets.number('12.5')], [12, 12.5, 12.5]);
      ok(Number.isNaN(sheets.number('twaalf')), 'geen getal');
    });
    await test('readCsv: puntkomma, aanhalingstekens, puntkomma en regeleinde in een veld', () => {
      const book = sheets.readCsv('﻿Naam;Tekst;Aantal\r\n"A";"met ; en ""quote""";3\r\n"B";"twee\nregels";\r\n', 'x.csv');
      equal(book.sheets[0].rows, [['Naam', 'Tekst', 'Aantal'], ['A', 'met ; en "quote"', '3'], ['B', 'twee\nregels', undefined]]);
    });
    await test('geen Excel-bestand of een oud .xls: een duidelijke fout', async () => {
      const fails = async (file) => {
        try {
          await sheets.read(file);
          return '';
        } catch (error) {
          return error.message;
        }
      };
      ok((await fails(fileOf(new TextEncoder().encode('geen zip')))).includes('geen Excel'), 'geen zip');
      ok((await fails(fileOf(new Uint8Array(4), 'oud.xls'))).includes('.xlsx'), '.xls');
      const onlyText = await fixture.zip({ 'leesmij.txt': 'hallo' });
      ok((await fails(fileOf(onlyText))).includes('werkmap'), 'zip zonder werkmap');
    });

    /* ---- admin-copilot ---- */
    describe('Copilot-gebruik (js/admin-copilot.js)');
    const copilot = ns.adminCopilot;
    let snapshot = null;
    await test('readExport: totalen per licentie en week; rij zonder licentie overgeslagen', async () => {
      snapshot = await copilot.readExport(fileOf(await fixture.copilotWorkbook(small)));
      equal([snapshot.periodStart, snapshot.periodEnd, snapshot.weeks, snapshot.people, snapshot.skipped], ['2026-01-04', '2026-02-22', 8, 5, 1]);
      equal(snapshot.licences.basic, { people: 3, active4w: 1, volume4w: 10, volumeTotal: 150, frequency: { wekelijks: 0, regelmatig: 1, soms: 1, nooit: 1 } });
      equal(snapshot.licences.premium, { people: 2, active4w: 2, volume4w: 60, volumeTotal: 500, frequency: { wekelijks: 1, regelmatig: 1, soms: 0, nooit: 0 } });
      equal(snapshot.channels, [{ name: 'Copilot-app', volume4w: 8 }, { name: 'Teams', volume4w: 2 }]);
      equal(snapshot.top10Share, 1, 'top 10 bij minder dan 10 personen');
    });
    await test('readExport: niets per persoon in wat wordt opgeslagen', () => {
      const stored = JSON.stringify(snapshot);
      ok(!/p[1-6]"|PersonId/.test(stored), 'geen id of kolom per persoon');
      equal(Object.keys(snapshot).sort(), ['channels', 'licences', 'people', 'periodEnd', 'periodStart', 'skipped', 'source', 'top10Share', 'version', 'weekly', 'weeks']);
    });
    await test('measures: adoptie, per actieve gebruiker, actief per week en groei t.o.v. de 4 weken ervoor', () => {
      const m = copilot.measures(snapshot);
      equal([m.basic.adoption, m.basic.perActive, m.basic.wau, m.basic.growth], [1 / 3, 10, 1.5, 1]);
      equal([m.premium.adoption, m.premium.perActive, m.premium.wau, m.premium.growth], [1, 30, 2, 0.5]);
      equal([m.total.people, m.total.active, m.total.volume, m.total.growth], [5, 3, 70, 160 / 100 - 1]);
    });
    await test('readExport: onbekende licentie of onbekend bestand geeft uitleg', async () => {
      const wrong = { people: [{ id: 'x', licence: 'Gratis', basicTotal: 1, premiumTotal: 0, total: 1, recent: 1, activeWeeks: 1 }], weekly: small.weekly, channels: [] };
      const message = async (file) => {
        try {
          await copilot.readExport(file);
          return '';
        } catch (error) {
          return error.message;
        }
      };
      ok((await message(fileOf(await fixture.copilotWorkbook(wrong)))).includes("onbekende licentie 'Gratis'"), 'licentie');
      ok((await message(fileOf(new TextEncoder().encode('Naam;Aantal\nA;1'), 'x.csv'))).includes('herken ik niet'), 'onbekend bestand');
    });
    await test('timeline: weken van alle imports op een rij; de nieuwste import telt bij een overlap', () => {
      const older = { weekly: [{ week: '2026-01-04', n: 1 }, { week: '2026-01-11', n: 1 }] };
      const newer = { weekly: [{ week: '2026-01-11', n: 2 }, { week: '2026-01-18', n: 2 }] };
      equal(copilot.timeline([older, newer]).map((week) => week.week + ':' + week.n), ['2026-01-04:1', '2026-01-11:2', '2026-01-18:2']);
    });
    await test('niceTicks (js/admin-chart.js): ronde stappen tot minstens het maximum', () => {
      equal(ns.adminChart.niceTicks(57), [0, 20, 40, 60]);
      equal(ns.adminChart.niceTicks(2021), [0, 500, 1000, 1500, 2000, 2500]);
      equal(ns.adminChart.niceTicks(0), [0]);
    });
    await test('verzonnen voorbeeld: altijd dezelfde cijfers, en goed te lezen', async () => {
      const sample = fixture.copilotSample({ seed: 3 });
      equal(sample, fixture.copilotSample({ seed: 3 }), 'zelfde seed');
      const read = await copilot.readExport(fileOf(await fixture.copilotWorkbook(sample)));
      equal([read.weeks, read.people, read.licences.premium.people], [27, 104, 24]);
    });

    /* ---- portfolio ---- */
    describe('Portfolio: AI Value Matrix (js/admin-portfolio.js)');
    const P = ns.adminPortfolio;
    const scored = (A, B, C, D, extra) => Object.assign({ scores: { A, B, C, D }, risk: 'midden' }, extra);
    await test('outcome: de ijkpunten van de matrix komen in het goede kwadrant', () => {
      const of = (a) => { const r = P.outcome(a); return [r.value, r.feasibility, r.quadrant.id, r.borderline]; };
      equal(of(scored(3, 3, 5, 5)), [6, 10, 'direct', false], 'verwerking klantinterviews');
      equal(of(scored(5, 3, 2, 2)), [8, 4, 'strategisch', true], 'documentanalyse contracten en notulen');
      equal(of(scored(3, 2, 4, 4)), [5, 8, 'quickwin', true], 'conceptmemo bedrijfsbeschrijving');
      equal(of(scored(1, 0, 1, 1)), [1, 2, 'stoppen', false], 'stoppen');
    });
    await test('outcome: een knock-out gaat voor; zonder vier scores geen kwadrant', () => {
      const ko = P.outcome(scored(5, 5, 5, 5, { knockouts: ['K2', 'X9'] }));
      equal([ko.knockouts, ko.quadrant], [['K2'], null]);
      equal(P.outcome({ scores: { A: 3, B: 2, C: 6, D: 1 } }).complete, false, 'score 6 bestaat niet');
      equal(P.outcome(null), null);
    });
    await test('hoursScore: uren per jaar naar score B', () => {
      equal([0, 49, 50, 149, 150, 400, 799, 800, 1500, 1501].map(P.hoursScore), [0, 0, 1, 1, 2, 3, 3, 4, 4, 5]);
    });
    await test('ranked en registerRow: volgorde van de kwadranten, nummers en de registerregel', () => {
      const ideas = [
        { id: 1, title: 'Quick', kind: 'idee', status: 'nieuw', assessment: scored(3, 2, 4, 4) },
        { id: 2, title: 'Direct', kind: 'idee', status: 'nieuw', assessment: scored(3, 3, 5, 5, { hours: 300, decision: 'Uitvoeren', assessedAt: '2026-10-28T10:00:00Z' }) },
        { id: 3, title: 'Knock-out', kind: 'idee', status: 'nieuw', assessment: scored(3, 3, 5, 5, { knockouts: ['K1'] }) },
        { id: 4, title: 'Open', kind: 'verzoek', status: 'nieuw', assessment: null }
      ];
      equal(P.ranked(ideas).map((entry) => entry.number + ':' + entry.idea.title), ['1:Direct', '2:Quick']);
      const row = P.registerRow(ideas[1]);
      equal(row.length, P.REGISTER.length);
      equal(row.slice(5, 17), [3, 3, 5, 5, 6, 10, 'Direct uitvoeren', 'midden', '', 300, 'Uitvoeren', '2026-10-28']);
      equal(P.registerRow(ideas[2])[11], 'Knock-out K1');
      equal(ideas.filter(P.isCandidate).length, 4);
    });

    /* ---- overzicht ---- */
    describe('Overzicht (js/admin-overview.js)');
    const O = ns.adminOverview;
    await test('weekOf: de maandag van de week', () => {
      equal([O.weekOf(Date.parse('2026-10-28T09:00:00Z')), O.weekOf(Date.parse('2026-10-26T00:00:00Z')), O.weekOf(Date.parse('2026-11-01T23:00:00Z'))], ['2026-10-26', '2026-10-26', '2026-10-26']);
    });
    await test('countEvents: 30 dagen, de 30 dagen ervoor, per discipline en per volle week', () => {
      const now = Date.parse('2026-10-28T12:00:00Z');
      const at = (days) => new Date(now - days * 86400000).toISOString();
      const result = O.countEvents([
        { namespace: 'ai-audit', kind: 'view_usecase', occurred_at: at(1) },
        { namespace: 'ai-audit', kind: 'copy_prompt', occurred_at: at(3) },
        { namespace: 'ai-accountancy', kind: 'play_demo', occurred_at: at(9) },
        { namespace: 'ai-audit', kind: 'copy_tip', occurred_at: at(40) },
        { namespace: 'ai-audit', kind: 'onbekend', occurred_at: at(2) }
      ], now);
      equal([result.recent, result.before, result.perNamespace.get('ai-audit'), result.weeks.length], [{ viewed: 2, copied: 1 }, { viewed: 0, copied: 1 }, 2, 12]);
      // 25 oktober is een zondag: die hoort bij de week van maandag 19 oktober
      equal(result.weeks[11], { week: '2026-10-19', values: { viewed: 1, copied: 1 } }, 'de laatste volle week');
    });
    await test('countContent: usecases met demo, prompts met de stappen uit de usecases', () => {
      const counts = O.countContent([
        { namespace: 'ai-audit', type: 'usecase', video: 'assets/videos/x.mp4', prompts: [{}, {}] },
        { namespace: 'ai-audit', type: 'usecase', demo: null, prompts: [{}] },
        { namespace: 'ai-audit', type: 'prompt' },
        { namespace: 'ai-algemeen', type: 'tip' },
        { namespace: 'ai-audit', type: 'meta' }
      ]);
      equal(counts.get('ai-audit'), { usecases: 2, demos: 1, prompts: 4, tips: 0, trainings: 0 });
      equal(counts.get('ai-algemeen').tips, 1);
    });

    /* ---- voorbeeldinhoud ---- */
    describe('Voorbeeldinhoud Accountancy (data/voorbeelden/accountancy.js)');
    await test('de zes snacks met demo, 35 prompts, het naslagwerk en geen fouten in fasen of adressen', () => {
      const example = ns.examples.accountancy;
      ns.content.load({ phase: example.phases, usecase: example.usecases, prompt: example.prompts, tip: example.tips, training: example.trainings || [], agent: [], setting: {} });
      const training = ns.content.trainingById.get('van-ai-hype-naar-toepassing');
      equal([training.slides.length, training.takeaways.length, training.actions.length, training.actions.filter((a) => a.slide).length, training.hasNaslag], [19, 5, 6, 5, true], 'naslagwerk');
      ok(training.usecases.every((id) => ns.content.usecaseById.has(id)), 'de snacks bij de training bestaan');
      const usecases = ns.content.usecases;
      equal(usecases.length, 6, 'usecases');
      ok(usecases.every((u) => u.hasDemo), 'iedere usecase heeft een demo');
      const standalone = ns.content.prompts.filter((p) => !p.usecase);
      equal([standalone.length, standalone.filter((p) => p.promptBasic).length, standalone.filter((p) => p.followUps.length).length], [35, 17, 5]);
      // Alleen de gedeelde tips ontbreken hier (die komen uit de basis)
      equal(ns.content.issues.filter((issue) => !/tip/i.test(issue)), []);
    });

    /* ---- route van een idee ---- */
    describe('Route van een idee (js/view-ideas.js, data/disciplines.js)');
    const realCockpit = ns.cockpit;
    const inDiscipline = (id, config) => {
      ns.cockpit = { activeId: () => id };
      try {
        return ns.ideas.routeOf(config || {});
      } finally {
        ns.cockpit = realCockpit;
      }
    };
    await test('standaard per discipline: Audit via team AI of team dAtA, een andere discipline zonder', () => {
      const audit = inDiscipline('audit');
      const other = inDiscipline('belastingadvies');
      equal([audit.steps.length, other.steps.length], [8, 8]);
      ok(audit.steps.some((step) => /team dAtA/.test(step.who)), 'Audit noemt team dAtA');
      ok(!other.steps.some((step) => /dAtA/.test(step.who + step.text)) && !other.roles.some((role) => /dAtA/.test(role.name)), 'een andere discipline niet');
      equal(audit.intro, ns.ideaRoutes.standaard.intro, 'de inleiding komt uit de standaard');
    });
    await test('Beheer gaat voor, per onderdeel; lege velden, stappen zonder titel en een link zonder https tellen niet', () => {
      const route = inDiscipline('audit', { route: [{ title: 'Eigen stap', who: 'Wij' }, { who: 'zonder titel' }], routeRoles: [], routeIntro: '  ', routeLink: 'http://intranet/organogram' });
      equal(route.steps, [{ title: 'Eigen stap', who: 'Wij' }]);
      equal([route.roles.length, route.intro === ns.ideaRoutes.standaard.intro, route.link], [ns.ideaRoutes.audit.roles.length, true, '']);
      equal(inDiscipline('audit', { routeLink: 'https://serviceplein.example/organogram' }).link, 'https://serviceplein.example/organogram');
    });

    describe('Copilot-gebruik opslaan (js/central.js, fetch nagebootst)');
    const SESSION = 'ai-snackbar-audit:sessie';
    const before = window.sessionStorage.getItem(SESSION);
    window.sessionStorage.setItem(SESSION, JSON.stringify({ token: 'test-token', refresh: 'r', email: 'test@example.nl', expiresAt: Date.now() + 3600000, isAdmin: true, rights: { owner: true, roles: [] } }));
    ns.central.init({ config: { centralUrl: 'https://voorbeeld.supabase.co', centralKey: 'sb_publishable_test', namespace: 'ai-test' } });
    try {
      await test('opslaan: één rij per naamruimte en einddatum (vervangt), met de sessie van de beheerder', async () => {
        const net = fakeFetch([[201, [{ id: 7, period_end: '2026-02-22' }]]]);
        try {
          const row = await ns.central.saveCopilotUsage(snapshot);
          equal(row.id, 7);
          const url = new URL(net.calls[0].url);
          equal([url.pathname, url.searchParams.get('on_conflict')], ['/rest/v1/audit_copilot_usage', 'namespace,period_end']);
          equal(net.calls[0].init.headers.Prefer, 'resolution=merge-duplicates,return=representation');
          equal(net.calls[0].init.headers.Authorization, 'Bearer test-token');
          const body = JSON.parse(net.calls[0].init.body);
          equal([body.namespace, body.period_start, body.period_end, body.source], ['ai-test', '2026-01-04', '2026-02-22', 'analyse']);
        } finally {
          net.restore();
        }
      });
      await test('Overzicht: alle disciplines (namespace like ai-*) en de velden die het telt', async () => {
        const net = fakeFetch([[200, []], [200, []]]);
        try {
          await ns.central.adminListIdeas({ all: true });
          await ns.central.contentOverview();
          const ideas = new URL(net.calls[0].url).searchParams;
          const content = new URL(net.calls[1].url).searchParams;
          equal([ideas.get('namespace'), content.get('namespace'), content.get('status')], ['like.ai-*', 'like.ai-*', 'eq.published']);
          ok(content.get('select').includes('video:data->>video'), 'alleen de velden die het telt');
        } finally {
          net.restore();
        }
      });
      await test('lezen: zonder tabel (stap 9 nog niet uitgevoerd) null, geen fout', async () => {
        const net = fakeFetch([[404, { code: 'PGRST205' }], [200, [{ id: 1 }]]]);
        try {
          equal(await ns.central.listCopilotUsage(), null);
          equal(await ns.central.listCopilotUsage(), [{ id: 1 }]);
          equal(new URL(net.calls[1].url).searchParams.get('namespace'), 'eq.ai-test', 'alleen deze discipline');
        } finally {
          net.restore();
        }
      });
    } finally {
      if (before === null) window.sessionStorage.removeItem(SESSION);
      else window.sessionStorage.setItem(SESSION, before);
      ns.central.init({ config: {} });
    }

    render();
  }

  /* ---- Uitslag ------------------------------------------------------------------- */
  function render() {
    const failed = results.filter((result) => !result.ok);
    const summary = document.getElementById('summary');
    summary.textContent = failed.length ? `${failed.length} van ${results.length} tests mislukt` : `Alle ${results.length} tests geslaagd`;
    summary.className = 'tests__summary ' + (failed.length ? 'is-failed' : 'is-ok');
    document.title = (failed.length ? '✗ ' : '✓ ') + document.title;
    const list = document.getElementById('results');
    let last = '';
    results.forEach((result) => {
      if (result.group !== last) {
        last = result.group;
        const heading = document.createElement('li');
        heading.className = 'tests__group';
        heading.textContent = result.group;
        list.append(heading);
      }
      const item = document.createElement('li');
      item.className = 'tests__item' + (result.ok ? '' : ' tests__item--failed');
      item.textContent = (result.ok ? '✓ ' : '✗ ') + result.name;
      if (!result.ok) {
        const message = document.createElement('p');
        message.className = 'tests__message';
        message.textContent = result.message;
        item.append(message);
      }
      list.append(item);
    });
    // Voor wie de tests automatisch draait
    window.testResults = { passed: results.length - failed.length, failed: failed.length, results };
  }

  run();
})(window.AIAudit);
