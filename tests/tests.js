/* ==========================================================================
   Tests voor de kern: placeholders, zoeken, controles op adressen en paden,
   inhoud laden, rechten, het soortenregister, de verzoeken naar Supabase
   (fetch nagebootst), de werkversies en het gereedschap van Beheer.
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
