/* ==========================================================================
   Tests voor de kern: placeholders, zoeken, controles op adressen en paden,
   inhoud laden, rechten, het soortenregister, de verzoeken naar Supabase
   (fetch nagebootst), de werkversies, het gereedschap van Beheer en het
   inlezen van het Copilot-gebruik (met een verzonnen bestand uit
   fixture-copilot.js), de route van een idee per discipline, Mijn gegevens,
   het seizoenskompas, de promptbouwer, het verbetervoorstel bij een prompt en
   de AI-brevetten (miles, plafonds, checkrides, royalty's en de demo), de tijdwinst, de Kickstart en de
   termijnen van de beloftes van het AI-team.
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
    // De tests gaan uit van het Nederlands, ook als in deze browser English gekozen is (js/i18n.js)
    if (ns.i18n) ns.i18n.use('nl');

    /* ---- taal ---- */
    describe('Taal: Nederlands en Engels (js/i18n.js, js/i18n-en.js)');
    await test('vertalen: vaste teksten, patronen met een getal of naam, en Nederlands als er geen vertaling is', () => {
      const I = ns.i18n;
      try {
        I.use('en');
        equal([I.t('Kopieer prompt'), I.t('Mijn logboek'), I.t('Dit staat nergens')], ['Copy prompt', 'My logbook', 'Dit staat nergens']);
        equal([I.t('Dag 3 van 14'), I.t('Ja, ±20 min'), I.t('Voor managers en partners'), I.t('Usecase · Planning en interimcontroles')], ['Day 3 of 14', 'Yes, ±20 min', 'For managers and partners', 'Use case · Planning and interim audits']);
        equal(I.t('Hallo {naam}', { naam: 'Sanne' }), 'Hallo Sanne', 'invullen werkt ook zonder vertaling');
        equal(I.locale(), 'en-GB');
        I.use('nl');
        equal([I.t('Kopieer prompt'), I.t('Hallo {naam}', { naam: 'Sanne' }), I.locale()], ['Kopieer prompt', 'Hallo Sanne', 'nl-NL'], 'in het Nederlands verandert er niets');
      } finally {
        I.use('nl');
      }
    });
    await test('de pagina vertalen: tekst en aria-label wel, prompts, code, invoer en translate="no" niet', () => {
      const I = ns.i18n;
      const box = document.createElement('div');
      box.innerHTML = '<p> Sluiten </p><button aria-label="Zoeken" title="Mijn logboek">Annuleren</button><pre>Sluiten</pre><code>Sluiten</code><span translate="no">Sluiten</span><textarea placeholder="Zoeken">Sluiten</textarea><input placeholder="Zoeken">';
      try {
        I.use('en');
        I.translateTree(box);
        const [p, button, pre, code, span, textarea, input] = box.children;
        equal([p.textContent, button.textContent, button.getAttribute('aria-label'), button.getAttribute('title')], [' Close ', 'Cancel', 'Search', 'My logbook'], 'tekst (met de spaties eromheen) en attributen');
        equal([pre.textContent, code.textContent, span.textContent, textarea.value], ['Sluiten', 'Sluiten', 'Sluiten', 'Sluiten'], 'prompts, code, translate="no" en wat je typt blijven');
        equal([textarea.getAttribute('placeholder'), input.getAttribute('placeholder')], ['Search', 'Search'], 'een placeholder wel');
      } finally {
        I.use('nl');
      }
    });
    await test('vertaallijst: geen sleutels met spaties eromheen, en elk patroon is een geldig paar', () => {
      const keys = Object.keys(ns.i18nEn.words);
      equal(keys.filter((key) => key !== key.trim()), [], 'sleutels zonder spaties eromheen (zo wordt er gezocht)');
      ok(keys.length > 300, 'een flinke lijst: ' + keys.length);
      ok(ns.i18nEn.patterns.every(([pattern, out]) => pattern instanceof RegExp && (typeof out === 'string' || typeof out === 'function')), 'patronen: [RegExp, tekst of functie]');
    });

    /* ---- Engelse versie van de inhoud ---- */
    describe('Inhoud in het Engels (js/content-en.js, js/admin-english.js)');
    const usecaseNl = {
      id: 'risico', title: 'Risico\'s in kaart', phase: 'planning', video: 'assets/videos/a.mp4', steps: ['Open de jaarrekening', 'Plak de prompt'],
      prompts: [{ label: 'Stap 1', text: 'Maak een risicotabel voor [KLANTNAAM].' }, { label: 'Stap 2', text: 'Vat samen voor [NAAM].' }]
    };
    const usecaseEn = { title: 'Mapping the risks', steps: ['Open the financial statements'], prompts: [{}, { text: 'Summarise for [NAME].' }], video: 'evil.mp4' };
    await test('apply: Engels over het Nederlands, onderdelen op volgorde, plaatjes en links uit het Nederlands', () => {
      const E = ns.contentEn;
      const out = E.apply('usecase', Object.assign({}, usecaseNl, { en: usecaseEn }));
      equal([out.title, out.phase, out.video], ['Mapping the risks', 'planning', 'assets/videos/a.mp4'], 'titel vertaald, fase en video uit het Nederlands');
      equal(out.steps, ['Open the financial statements'], 'een lijst met regels: de Engelse lijst');
      equal(out.prompts, [{ label: 'Stap 1', text: 'Maak een risicotabel voor [KLANTNAAM].' }, { label: 'Stap 2', text: 'Summarise for [NAME].' }], 'het tweede Engelse onderdeel hoort bij het tweede Nederlandse');
      ok(!out._dutchOnly, 'vertaald');
      equal(E.apply('usecase', usecaseNl)._dutchOnly, true, 'zonder Engelse versie: Dutch only');
      equal(E.apply('usecase', Object.assign({}, usecaseNl, { en: { title: '  ' } }))._dutchOnly, true, 'een lege Engelse versie telt niet');
      const training = E.apply('training', { title: 'T', actions: [{ title: 'Stel je instructies in', slide: '3' }], en: { actions: [{ title: 'Set your instructions' }] } });
      equal([training.actions[0].title, training.actions[0].slide, training.actions[0]._key], ['Set your instructions', '3', 'Stel je instructies in'], 'het vinkje bij een actie hoort bij de Nederlandse kop');
    });
    await test('extract, vingerafdruk en status: bijwerken als het Nederlands verandert', () => {
      const E = ns.contentEn;
      const nl = E.extract('usecase', usecaseNl);
      equal(Object.keys(nl), ['title', 'steps', 'prompts'], 'alleen de teksten (geen fase, video of id)');
      const en = E.clean('usecase', usecaseEn, usecaseNl);
      equal(en.video, undefined, 'opschonen: geen video in de Engelse versie');
      equal(en.prompts, [{}, { text: 'Summarise for [NAME].' }], 'een leeg onderdeel blijft staan voor de volgorde');
      const saved = Object.assign({}, usecaseNl, { en });
      equal(E.status('usecase', saved), 'ok');
      equal(E.status('usecase', Object.assign({}, saved, { phase: 'afronding', video: 'b.mp4' })), 'ok', 'fase of video veranderen: de vertaling klopt nog');
      equal(E.status('usecase', Object.assign({}, saved, { title: 'Risico\'s in beeld' })), 'verouderd', 'tekst veranderd: bijwerken');
      equal(E.status('usecase', usecaseNl), '', 'niet vertaald');
    });
    await test('inhoud laden in het Engels: vertaalde items, Dutch only, en het Nederlands blijft de bron', () => {
      const C = ns.content;
      const source = {
        phase: [{ id: 'planning', label: 'Planning', en: { label: 'Planning stage' } }],
        usecase: [Object.assign({}, usecaseNl, { en: usecaseEn })],
        prompt: [{ id: 'mail', title: 'Mail aan de klant', phase: 'planning', prompt: 'Schrijf een mail.' }],
        tip: [], training: [], agent: [],
        setting: { tagline: 'Jij bepaalt de koers', en: { tagline: 'You set the course' } }
      };
      try {
        ns.i18n.use('en');
        C.load(source);
        const usecase = C.usecaseById.get('risico');
        equal([usecase.title, usecase.dutchOnly, usecase.phase.label, C.settings.tagline], ['Mapping the risks', false, 'Planning stage', 'You set the course']);
        equal([C.promptById.get('risico-2').prompt, C.promptById.get('risico-2').dutchOnly], ['Summarise for [NAME].', false], 'prompt uit de usecase');
        equal([C.promptById.get('mail').title, C.promptById.get('mail').dutchOnly], ['Mail aan de klant', true], 'niet vertaald: Nederlands met Dutch only');
        ns.i18n.use('nl');
        C.load(source);
        equal([C.usecaseById.get('risico').title, C.promptById.get('mail').dutchOnly, C.settings.tagline], ['Risico\'s in kaart', false, 'Jij bepaalt de koers'], 'in het Nederlands: niets veranderd');
      } finally {
        ns.i18n.use('nl');
        C.load();
      }
    });
    await test('Engelse plaatshouders: [NAME], [ROLE] en [YEAR] uit Mijn gegevens, e.g. als voorbeeld', () => {
      const P = ns.profile;
      const saved = ns.ui.storage.get('profiel', null);
      try {
        P.set({ naam: 'Sanne de Vries', functie: 'Senior auditor', boekjaar: '2026' });
        equal(P.fill('[NAME], [ROLE], [FINANCIAL YEAR], [PREVIOUS YEAR], [CLIENT NAME]'), 'Sanne de Vries, Senior auditor, 2026, 2025, [CLIENT NAME]');
        const fields = ns.ui.parsePlaceholders('[PROCESS, e.g. purchasing process] [PASTE THE MINUTES HERE]');
        equal([fields[0].label, fields[0].hint, fields[1].long], ['PROCESS', 'e.g. purchasing process', true]);
      } finally {
        P.clear();
        if (saved) P.set(saved);
      }
    });
    await test('Copilot-antwoord inlezen: JSON uit een codeblok, alleen bekende velden, en aandachtspunten', () => {
      const A = ns.adminEnglish;
      const answer = 'Hier is de vertaling:\n```json\n{ "title": "Mapping the risks", "prompts": [{ "label": "Step 1", "text": "Make a risk table." }, { "label": "Step 2", "text": "Summarise for [NAME]." }], "phase": "afronding" }\n```';
      const parsed = A.parse(answer, 'usecase', usecaseNl);
      equal(parsed.en.phase, undefined, 'geen fase uit Copilot');
      equal(parsed.en.title, 'Mapping the risks');
      ok(parsed.warnings.some((warning) => /plaatshouders/.test(warning)), 'een plaatshouder kwijt: ' + show(parsed.warnings));
      let message = '';
      try {
        A.parse('Sorry, dat kan ik niet.', 'usecase', usecaseNl);
      } catch (error) {
        message = error.message;
      }
      ok(/geen JSON/.test(message), 'zonder JSON: uitleg');
      const file = A.parseFile('{ "items": [ { "type": "prompt", "id": "mail", "en": { "title": "Email" } }, { "type": "onzin", "id": "x", "en": {} }, { "id": "y" } ] }');
      equal([file.items.length, file.skipped], [1, 2], 'bestand: bruikbare items en overgeslagen regels');
      ok(/Vertaal/.test(A.prompt('prompt', { title: 'Mail', prompt: 'Schrijf [NAAM]', phase: 'x' })) && !/"phase"/.test(A.prompt('prompt', { title: 'Mail', phase: 'x' })), 'de vertaalprompt bevat alleen de teksten');
    });
    await test('Engels veld in Beheer: een groep heeft net zoveel onderdelen als het Nederlands, met het Nederlands als voorbeeld', () => {
      const A = ns.adminEnglish;
      const group = { key: 'prompts', label: 'Prompts', type: 'group', min: 1, fields: [{ key: 'label', type: 'text' }, { key: 'text', type: 'code', required: true, placeholders: true }] };
      const copy = A.mirror(group, usecaseNl.prompts, ns.contentEn.SPEC.usecase.prompts);
      equal([copy.fixed, copy.keepEmpty, copy.min, copy.dutch.length], [true, true, undefined, 2]);
      const text = copy.mirror(group.fields[1], usecaseNl.prompts[1]);
      equal([text.placeholder, text.required], ['Vat samen voor [NAAM].', false], 'het Nederlandse onderdeel als grijze tekst, niet verplicht');
    });

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
      equal([ns.kinds.navFor('mijn'), ns.kinds.navFor('promptbouwer'), ns.kinds.navFor('constructor')], ['mijn', 'prompts', ''], 'mijn gegevens, promptbouwer');
    });

    /* ---- mijn gegevens ---- */
    describe('Mijn gegevens (js/profile.js, opslag nagebootst)');
    // Niets in de echte opslag van deze browser: get/set even in het geheugen
    const realGet = ns.ui.storage.get;
    const realSet = ns.ui.storage.set;
    const realRemove = ns.ui.storage.remove;
    const memory = {};
    Object.assign(ns.ui.storage, {
      get: (key, fallback) => (key in memory ? JSON.parse(memory[key]) : fallback),
      set: (key, value) => { memory[key] = JSON.stringify(value); return true; },
      remove: (key) => { delete memory[key]; }
    });
    try {
      await test('vult precies die plaatshouders: [NAAM] en [FUNCTIE] wel, [NAAM AFZENDER] en [NAAM EN FUNCTIE] niet', () => {
        ns.profile.set({ naam: ' Sanne de Vries ', functie: 'Senior auditor', boekjaar: '' });
        equal(['NAAM', 'FUNCTIE, bijv. senior auditor', 'naam', 'NAAM AFZENDER', 'NAAM EN FUNCTIE', 'KLANTNAAM'].map((key) => ns.profile.valueFor(key)), ['Sanne de Vries', 'Senior auditor', 'Sanne de Vries', '', '', '']);
        equal([ns.profile.firstName(), ns.profile.initials()], ['Sanne', 'SV']);
      });
      await test('boekjaar: alleen als je dat wilt; automatisch tot en met juni het vorige jaar; [VORIG JAAR] één eerder', () => {
        equal(ns.profile.valueFor('JAAR'), '', 'niet invullen');
        ns.profile.set({ boekjaar: 'auto' });
        equal([ns.profile.valueFor('JAAR', '2026-03-15'), ns.profile.valueFor('VORIG JAAR', '2026-03-15'), ns.profile.valueFor('JAAR', '2026-10-31')], ['2025', '2024', '2026']);
        ns.profile.set({ boekjaar: '2027' });
        equal(ns.profile.valueFor('BOEKJAAR'), '2027', 'vast jaar');
      });
      await test('fill: je gegevens erin, klantgegevens blijven [PLAATSHOUDER]; canFill zegt of er iets te halen is', () => {
        const text = 'Mail aan [KLANTNAAM] over [JAAR]. Onderteken met [NAAM], [FUNCTIE].';
        equal(ns.profile.fill(text), 'Mail aan [KLANTNAAM] over 2027. Onderteken met Sanne de Vries, Senior auditor.');
        ok(ns.profile.canFill('Groet, [NAAM]') && !ns.profile.canFill('Voor [KLANTNAAM]'), 'canFill');
      });
      await test('wissen: niets meer bewaard, prompts tonen weer de plaatshouders', () => {
        ns.profile.clear();
        equal([Object.keys(memory).length, ns.profile.fill('Groet, [NAAM]'), ns.profile.filled()], [0, 'Groet, [NAAM]', false]);
      });
    } finally {
      ns.profile.clear(); // nog in het geheugen: je echte gegevens in deze browser blijven staan
      Object.assign(ns.ui.storage, { get: realGet, set: realSet, remove: realRemove });
    }

    /* ---- seizoenskompas ---- */
    describe('Seizoenskompas (js/compass.js, data/seizoenen.js)');
    const auditSeasons = ns.compass.seasons({}, 'audit');
    await test('zonder seizoenen in Beheer: de startwaarden van de discipline; onzin valt weg', () => {
      equal(auditSeasons.length, 4, 'audit');
      equal(ns.compass.seasons({ seasons: [{ title: 'Eigen', months: [13, 0, 3, '4'] }, { title: '', months: [1] }, { months: [2] }] }, 'audit').map((s) => [s.title, s.months]), [['Eigen', [3, 4]]]);
      equal(ns.compass.seasons({}, 'bestaat-niet'), [], 'geen kompas');
    });
    await test('wat nu speelt: het langst lopende seizoen eerst (december: interim, dan de voorraad)', () => {
      equal(ns.compass.active(auditSeasons, '2026-12-05').map((s) => s.title), ['Planning en interimcontroles', 'Voorraadinventarisaties']);
      equal(ns.compass.active(auditSeasons, '2027-03-01').map((s) => s.title), ['Risico-inschatting, controle en afronding']);
    });
    await test('wat hierna komt: een seizoen dat nog niet speelt, met de maand waarin het begint', () => {
      const coming = ns.compass.next(auditSeasons, '2026-11-10');
      equal([coming.season.title, coming.month], ['Voorraadinventarisaties', 12]);
      equal(ns.compass.next(auditSeasons, '2026-06-20').season.title, 'Planning en jaarovergang dossier');
    });
    await test('fasen van nu: uit de seizoenen die spelen, het belangrijkste eerst, alleen bestaande fasen', () => {
      const realCockpit = ns.cockpit;
      const realPhases = ns.content.phaseById;
      ns.cockpit = { activeId: () => 'audit' };
      ns.content.phaseById = new Map(['planning', 'beheersing', 'gegevensgericht'].map((id) => [id, { id }]));
      try {
        const now = ns.compass.nowPhases({}, '2026-12-05');
        equal(now.map((entry) => [entry.phase.id, entry.season.title]), [
          ['beheersing', 'Planning en interimcontroles'],
          ['planning', 'Planning en interimcontroles'],
          ['gegevensgericht', 'Voorraadinventarisaties']
        ]);
      } finally {
        ns.cockpit = realCockpit;
        ns.content.phaseById = realPhases;
      }
    });
    await test('maanden als tekst: aaneengesloten als bereik, ook over de jaarwisseling', () => {
      equal([ns.compass.monthsText([11, 12, 1]), ns.compass.monthsText([1, 4, 7, 10]), ns.compass.monthsText([7, 8, 9]), ns.compass.monthsText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], ['nov – jan', 'jan, apr, jul, okt', 'jul – sep', 'het hele jaar']);
    });

    /* ---- agents per fase ---- */
    describe('Agents & tools per fase (js/view-agents.js)');
    await test('groepen: eerst de fasen van het seizoen, dan "In elke fase", dan de rest in de volgorde van de fasen', () => {
      const realPhases = ns.content.phases;
      const [a, b, c, d] = ['planning', 'beheersing', 'gegevensgericht', 'afronding'].map((id) => ({ id, label: id }));
      ns.content.phases = [a, b, c, d];
      try {
        const agents = [
          { id: 'breed', phases: [a, b, c] }, // hooguit één fase niet: in elke fase
          { id: 'geen', phases: [] },
          { id: 'twee', phases: [a, c] },
          { id: 'een', phases: [b] }
        ];
        const result = ns.views.agents.groups(agents, [{ phase: c, season: { title: 'Voorraad' } }]);
        equal(result.map((g) => [g.phase ? g.phase.id : 'elke', g.items.map((x) => x.id), g.season ? g.season.title : '']), [
          ['gegevensgericht', ['twee'], 'Voorraad'],
          ['elke', ['breed', 'geen'], ''],
          ['planning', ['twee'], ''],
          ['beheersing', ['een'], '']
        ]);
      } finally {
        ns.content.phases = realPhases;
      }
    });

    /* ---- mag dit? ---- */
    describe('Mag dit? (js/check.js, volgens het AI-beleid)');
    const tool = (dataLevel, extra) => Object.assign({ title: 'Tool', kind: 'Eigen agent', status: 'Beschikbaar', dataLevel, web: false, useFor: [], notFor: [] }, extra);
    await test('ChatGPT, Claude of een andere tool via de browser: voor je werk altijd nee (ook met algemene data)', () => {
      const answer = ns.check.verdict(ns.check.OTHER, 'algemeen');
      equal(answer.tone, 'nee');
      ok(answer.reasons.some((line) => /persoonlijk|Buiten je werk/.test(line)), 'de uitzondering voor persoonlijk gebruik staat erbij');
    });
    await test('de tabel uit het beleid: Copilot t/m klantdata (persoonsgegevens: mits), hoog-risico alleen in-house na de CTO', () => {
      const copilot = tool('vertrouwelijk', { kind: 'Microsoft-standaard' });
      equal(['algemeen', 'persoon', 'klant', 'hoog'].map((data) => ns.check.verdict(copilot, data).tone), ['ja', 'mits', 'ja', 'nee'], 'Copilot');
      equal(['algemeen', 'persoon', 'klant', 'hoog'].map((data) => ns.check.verdict(tool('hoog'), data).tone), ['ja', 'mits', 'ja', 'mits'], 'in-house');
      equal(['algemeen', 'persoon', 'klant'].map((data) => ns.check.verdict(tool('algemeen'), data).tone), ['ja', 'nee', 'nee'], 'alleen algemeen');
      equal(['algemeen', 'klant'].map((data) => ns.check.verdict(tool('', { kind: '' }), data).tone), ['ja', 'onbekend'], 'geen soort en niets vastgelegd');
      ok(ns.check.verdict(copilot, 'klant').reasons.some((line) => /Werk-modus/.test(line) && /licentie/.test(line)), 'Copilot: ingelogd en de Werk-modus, licentie maakt niet uit');
    });
    await test('niets vastgelegd: het beleid per soort (Copilot met of zonder licentie t/m klantdata, extern alleen algemeen)', () => {
      const ms = tool('', { kind: 'Microsoft-standaard', title: 'Microsoft 365 Copilot (met licentie)' });
      equal(['algemeen', 'persoon', 'klant', 'hoog'].map((data) => ns.check.verdict(ms, data).tone), ['ja', 'mits', 'ja', 'nee'], 'Microsoft-standaard');
      equal(['klant', 'persoon'].map((data) => ns.check.verdict(tool('', { kind: 'Extern product' }), data).tone), ['nee', 'nee'], 'extern product');
      equal([ns.check.verdict(tool(''), 'klant').tone, ns.check.verdict(tool('', { web: true }), 'klant').tone], ['ja', 'nee'], 'eigen agent, met webtoegang alleen algemeen');
      equal(ns.check.verdict(tool('hoog', { kind: 'Extern product' }), 'klant').tone, 'ja', 'wat het AI-team vastlegt gaat voor');
    });
    await test('status, Work + Web en twijfel', () => {
      equal([ns.check.verdict(tool('vertrouwelijk', { status: 'Pilot' }), 'algemeen').tone, ns.check.verdict(tool('vertrouwelijk', { status: 'In ontwikkeling' }), 'algemeen').tone], ['mits', 'nee'], 'status');
      ok(ns.check.verdict(tool('vertrouwelijk', { web: true }), 'algemeen').reasons.some((line) => /webbronnen/.test(line)), 'webbronnen extra controleren');
      ok(/Bij twijfel/.test(ns.check.verdict(tool('', { kind: '' }), 'klant').doubt) && !ns.check.verdict(tool('vertrouwelijk'), 'klant').doubt, 'twijfel alleen bij mits of niet vastgesteld');
    });
    await test('naar de klant: harde feiten aan de bron, niet letterlijk overnemen, het oordeel blijft van jou (niet bij nee)', () => {
      ok(ns.check.verdict(tool('vertrouwelijk'), 'klant', 'klant').reasons.some((line) => /oordeel/.test(line) && /eigen woorden/.test(line)), 'advies');
      ok(!ns.check.verdict(ns.check.OTHER, 'klant', 'klant').reasons.some((line) => /oordeel/.test(line)), 'niet bij nee');
    });

    /* ---- promptbouwer ---- */
    describe('Promptbouwer (js/view-builder.js)');
    await test('opbouw: rol, doel, context, bron en verwachting, lege stappen vallen weg', () => {
      const text = ns.views.builder.compose({ role: 'Je bent een ervaren auditor', goal: 'Vat de notulen samen', source: 'het bijgevoegde document', onlySource: true, formats: ['een tabel', 'maximaal 200 woorden'], extras: ['Stel me eerst vragen als iets onduidelijk is.'] });
      equal(text, 'Je bent een ervaren auditor.\n\nVat de notulen samen.\n\nGebruik het bijgevoegde document. Gebruik alleen deze bron; staat iets er niet in, zeg dat dan.\n\nLever het op als een tabel en maximaal 200 woorden.\n\nStel me eerst vragen als iets onduidelijk is.');
    });
    await test('meter: leeg 0, alles ingevuld 100, een kort doel of korte context telt half', () => {
      const full = { role: 'Je bent een auditor', goal: 'Vat de notulen samen in besluiten, acties en open punten', context: 'Het overleg ging over de planning van de controle bij een klant', source: 'de Teams-vergadering', formats: ['een tabel'], extras: ['x'] };
      equal([ns.views.builder.score({}).score, ns.views.builder.score(full).score], [0, 100]);
      equal(ns.views.builder.score({ goal: 'Vat samen', context: 'Voor het team' }).score, 30);
    });
    /* ---- AI-brevetten ---- */
    describe('AI-brevetten (js/brevet.js, js/brevet-data.js, js/account.js)');
    const B = ns.brevet;
    // Een moment om 12 uur 's middags (lokale tijd), zodat de dag vast ligt
    const noon = (day, hour) => {
      const [y, m, d] = day.split('-').map(Number);
      return new Date(y, m - 1, d, hour || 12, 0, 0).toISOString();
    };
    const fact = (kind, item, day, detail) => ({ kind, item, at: noon(day), detail });
    const cadetFacts = (day) => [fact('tour_done', '', day), fact('profile_done', '', day), fact('policy_check', '', day)];
    await test('gebruik telt per uniek ding, en hoogstens 25 miles per dag', () => {
      const facts = ['a', 'b', 'c', 'd', 'e', 'f', 'a'].map((id) => fact('prompt_used', id, '2026-10-05'));
      const result = B.compute(facts, { today: '2026-10-05' });
      equal([result.stats.prompts, result.miles], [6, 25]);
      ok(result.entries.some((entry) => entry.capped), 'de zesde prompt staat als plafond in het logboek');
      equal(B.compute(facts.concat(fact('prompt_used', 'g', '2026-10-06')), { today: '2026-10-06' }).miles, 30, 'een nieuwe dag, nieuwe ruimte');
    });
    await test('een brevet = genoeg miles én de checkride (ook van de vorige)', () => {
      equal(B.compute(cadetFacts('2026-10-01'), { today: '2026-10-01' }).level, 0, 'Cadet');
      equal(B.compute(cadetFacts('2026-10-01').slice(0, 2), { today: '2026-10-01' }).level, -1, 'zonder check nog geen brevet');
      const rich = cadetFacts('2026-10-01').concat(fact('bonus', 'b1', '2026-10-02', { miles: 900, reason: 'test' }));
      const result = B.compute(rich, { today: '2026-10-02' });
      equal([result.level, result.next.level.id, result.next.milesNeeded], [0, 'copilot', 0], 'veel miles, maar zonder checkride geen Co-pilot');
      equal(result.next.checks.map((check) => check.stat), ['prompts', 'demos', 'trainings', 'weeks']);
    });
    await test('insturen hoogstens 3 keer per week; vliegritme bij 3 actieve dagen in een week', () => {
      const sent = ['r1', 'r2', 'r3', 'r4'].map((ref) => fact('idea_sent', ref, '2026-10-06'));
      equal(B.compute(sent, { today: '2026-10-06' }).miles, 30);
      const days = ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-13', '2026-10-14'].map((day) => fact('active_day', day, day));
      const result = B.compute(days, { today: '2026-10-14' });
      equal([result.miles, result.stats.weeks, result.lastActive], [15, 2, '2026-10-14'], 'één week met 3 dagen, twee weken actief');
    });
    await test('royalty\'s: collega\'s die jouw prompt gebruiken (elk één keer, nooit jijzelf), met een maandplafond', () => {
      const all = [
        { email: 'a@x.nl', kind: 'prompt_author', item: 'p1', at: noon('2026-09-01') },
        { email: 'a@x.nl', kind: 'prompt_used', item: 'p1', at: noon('2026-09-02') },
        { email: 'b@x.nl', kind: 'prompt_used', item: 'p1', at: noon('2026-09-03') },
        { email: 'b@x.nl', kind: 'prompt_used', item: 'p1', at: noon('2026-10-03') },
        { email: 'c@x.nl', kind: 'prompt_used', item: 'p1', at: noon('2026-10-04') },
        { email: 'c@x.nl', kind: 'prompt_used', item: 'p2', at: noon('2026-10-04') }
      ];
      equal(B.royaltiesFrom(all, 'a@x.nl').sort((x, y) => x.month.localeCompare(y.month)), [{ item: 'p1', month: '2026-09', users: 1 }, { item: 'p1', month: '2026-10', users: 1 }]);
      const result = B.compute([], { today: '2026-10-10', royalties: [{ item: 'p1', month: '2026-10', users: 30 }] });
      equal([result.miles, result.stats.colleagues, result.entries[0].capped], [100, 30, true]);
    });
    await test('regels uit Beheer: namen, drempels en miles; onzin valt terug op de standaard', () => {
      const r = B.rules({ copilotName: 'First Officer', copilotMiles: 300, milesPrompt: 7, captainMiles: 'veel', cadetPerks: ['', 'Eigen logboek'] });
      equal([r.levels[1].name, r.levels[1].miles, r.miles.prompt_used, r.levels[2].miles, r.levels[0].perks], ['First Officer', 300, 7, 1000, ['Eigen logboek']]);
      equal(B.compute([fact('prompt_used', 'a', '2026-10-01')], { rules: r, today: '2026-10-01' }).miles, 7);
    });
    await test('regels in lagen: standaard, dan alle disciplines, dan de eigen discipline (leeg = de laag eronder)', () => {
      const saved = { settings: ns.content.settings, brevetRules: ns.content.brevetRules };
      try {
        ns.content.settings = {};
        ns.content.brevetRules = {
          basis: { levels: { copilot: { name: 'First Officer', miles: 300, perks: ['Voorrang op een licentie'] } }, miles: { prompt_used: 6, adopted: { idee: 200 } }, checks: { copilot: { prompts: 12 } } },
          own: { levels: { copilot: { miles: 200 } }, miles: { prompt_used: 8 }, caps: { usagePerDay: 40 }, checks: { copilot: { prompts: '' } } }
        };
        const r = B.rules();
        equal([r.levels[1].name, r.levels[1].miles, r.levels[1].perks, r.miles.prompt_used, r.miles.adopted.idee, r.caps.usagePerDay, r.checks.copilot[0].need],
          ['First Officer', 200, ['Voorrang op een licentie'], 8, 200, 40, 12]);
        const basisOnly = B.rules(null, { basisOnly: true });
        equal([basisOnly.levels[1].miles, basisOnly.miles.prompt_used, basisOnly.caps.usagePerDay], [300, 6, 25], 'zonder de eigen laag');
        equal(B.rules({ checks: { copilot: { prompts: 0 } } }).checks.copilot[0].need, 1, 'een checkride vraagt minstens 1');
        equal(B.defaults().checks.copilot[0].need, 10, 'de standaard verandert niet mee');
      } finally {
        ns.content.settings = saved.settings;
        ns.content.brevetRules = saved.brevetRules;
      }
    });
    await test('actief = de laatste 90 dagen; ISO-weken', () => {
      equal(B.compute(cadetFacts('2026-06-01'), { today: '2026-10-01' }).active, false);
      equal(B.compute(cadetFacts('2026-08-01'), { today: '2026-10-01' }).active, true);
      equal([B.weekOf('2026-01-01'), B.weekOf('2024-12-30'), B.weekOf('2026-11-02')], ['2026-W01', '2025-W01', '2026-W45']);
    });
    await test('demo: de fictieve collega\'s komen op het bedoelde brevet uit', () => {
      const data = ns.brevetData.seed();
      const levelOf = (name) => {
        const account = data.accounts.find((row) => row.name === name);
        const own = data.facts.filter((row) => row.email === account.email);
        return B.compute(own, { royalties: B.royaltiesFrom(data.facts, account.email) });
      };
      equal(['Fatima El Amrani', 'Sanne de Vries', 'Eva Smit', 'Mark Jansen', 'Lotte Mulder', 'Daan Meijer', 'Thomas Bakker', 'Ruben de Jong'].map((name) => levelOf(name).level), [3, 2, 2, 1, 1, 1, 0, -1]);
      equal(levelOf('Daan Meijer').active, false, 'Daan is al een tijd niet geweest');
      ok(data.accounts.every((row) => row.email.endsWith('@demo.cockpit')), 'alleen verzonnen adressen');
      const keys = data.facts.map((row) => row.email + '|' + row.kind + '|' + row.item);
      equal(new Set(keys).size, keys.length, 'geen dubbele feiten');
    });
    await test('account: alleen V&V-adressen; het e-mailadres uit het token', () => {
      const part = window.btoa(JSON.stringify({ email: 'Jan.Jansen@Visser-Visser.nl' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      equal(ns.account.emailOfToken('x.' + part + '.y'), 'jan.jansen@visser-visser.nl');
      equal([ns.account.allowed('jan@visser-visser.nl'), ns.account.allowed('jan@gmail.com'), ns.account.allowed('geen adres')], [true, false, false]);
    });
    /* ---- AI-specialist invliegen ---- */
    describe('AI-specialist invliegen (js/specialist.js)');
    await test('volgorde in Beheer: open eerst, dan urgentie, dan de vroegste datum, dan het nieuwste', () => {
      const item = (id, status, wanneer, datum, created) => ({ id, status, details: { wanneer, datum }, created_at: created });
      const sorted = ns.specialist.sort([
        item('klaar', 'gerealiseerd', 'week', '', '2026-11-01'),
        item('later', 'nieuw', 'geen-haast', '', '2026-11-03'),
        item('gepland', 'gepland', 'week', '', '2026-11-02'),
        item('week-laat', 'nieuw', 'week', '2026-11-20', '2026-11-03'),
        item('week-vroeg', 'nieuw', 'week', '2026-11-10', '2026-11-01'),
        item('week-zonder', 'nieuw', 'week', '', '2026-11-04')
      ]);
      equal(sorted.map((i) => i.id), ['week-vroeg', 'week-laat', 'week-zonder', 'later', 'gepland', 'klaar']);
    });
    await test('chat in Teams met het adres en een bericht; initialen van de specialist', () => {
      equal(ns.specialist.teamsLink('ai@voorbeeld.nl', 'Hoi & dag'), 'https://teams.microsoft.com/l/chat/0/0?users=ai%40voorbeeld.nl&message=Hoi%20%26%20dag');
      equal([ns.specialist.initials('Sanne de Vries'), ns.specialist.initials('Joost'), ns.specialist.initials('')], ['SV', 'J', 'AI']);
    });
    await test('kaart op de promptdatabase: een link naar de bouwer, met de meter als versiering', () => {
      const teaser = ns.views.builder.teaser();
      equal([teaser.tagName, teaser.getAttribute('href'), teaser.querySelector('.builder-teaser__meter').getAttribute('aria-hidden')], ['A', '#/promptbouwer', 'true']);
    });

    /* ---- Tijdwinst, Kickstart en beloftes ---- */
    describe('Tijdwinst, Kickstart en beloftes (js/tijdwinst.js, js/kickstart.js, js/promises.js)');
    const T = ns.tijdwinst;
    // Verzonnen inhoud: een usecase met tijdwinst (twee stappen), een losse prompt met en een zonder
    function withContent(run) {
      const c = ns.content;
      const saved = { promptById: c.promptById, usecaseById: c.usecaseById, prompts: c.prompts, usecases: c.usecases };
      const uc = { id: 'uc', title: 'Usecase', saves: 45, featured: true, hasDemo: false };
      const step1 = { id: 'uc-1', title: 'Stap 1', usecase: uc, step: 1, saves: 0 };
      const step2 = { id: 'uc-2', title: 'Stap 2', usecase: uc, step: 2, saves: 0 };
      const loose = { id: 'losse', title: 'Losse prompt', saves: 20 };
      const plain = { id: 'zonder', title: 'Zonder schatting', saves: 0 };
      try {
        c.prompts = [plain, step1, step2, loose];
        c.usecases = [uc];
        c.promptById = new Map(c.prompts.map((p) => [p.id, p]));
        c.usecaseById = new Map([[uc.id, uc]]);
        run({ uc, step1, loose, plain });
      } finally {
        Object.assign(c, saved);
      }
    }
    await test('tijdwinst: minuten en notatie', () => {
      equal([T.format(20), T.format(65), T.format(120), T.format(0)], ['20 min', '1 u 5 min', '2 uur', '0 min']);
      equal([T.minutes('30'), T.minutes(-5), T.minutes('veel'), T.minutes(900)], [30, 0, 0, 480]);
    });
    await test('tijdwinst: je teller per week (vanaf maandag), maand en jaar; een dag in de toekomst telt niet', () => {
      const log = [
        { key: 'prompt:a', minutes: 20, day: '2026-11-04' },
        { key: 'prompt:b', minutes: 30, day: '2026-11-02' },
        { key: 'prompt:c', minutes: 15, day: '2026-11-01' },
        { key: 'prompt:d', minutes: 60, day: '2026-10-20' },
        { key: 'prompt:e', minutes: 45, day: '2025-12-01' },
        { key: 'prompt:f', minutes: 10, day: '2026-11-05' }
      ];
      equal(T.totals(log, '2026-11-04'), { week: 50, month: 65, year: 125, all: 170, count: 5 });
      equal([T.mondayOf('2026-11-04'), T.mondayOf('2026-11-01'), T.mondayOf('2026-11-02')], ['2026-11-02', '2026-10-26', '2026-11-02']);
    });
    await test('tijdwinst: per prompt één keer per dag vragen, hoogstens vijf vragen per dag', () => {
      const asked = { day: '2026-11-04', keys: ['prompt:a'] };
      equal([T.canAsk('prompt:a', asked, '2026-11-04'), T.canAsk('prompt:b', asked, '2026-11-04'), T.canAsk('prompt:a', asked, '2026-11-05')], [false, true, true]);
      const full = { day: '2026-11-04', keys: ['1', '2', '3', '4', '5'] };
      equal(T.canAsk('prompt:nieuw', full, '2026-11-04'), false, 'na vijf vragen niet meer');
      const state = { asked: { day: '2026-11-03', keys: ['x'] } };
      T.noteAsked(state, 'y', '2026-11-04');
      equal(state.asked, { day: '2026-11-04', keys: ['y'] }, 'een nieuwe dag begint opnieuw');
    });
    await test('tijdwinst: een prompt uit een usecase telt bij de usecase; zonder schatting geen vraag', () => withContent(() => {
      equal(T.itemOf('uc-1'), { key: 'usecase:uc', minutes: 45, title: 'Usecase', kind: 'usecase' });
      equal(T.itemOf('losse'), { key: 'prompt:losse', minutes: 20, title: 'Losse prompt', kind: 'prompt' });
      equal([T.itemOf('zonder'), T.itemOf('bestaat-niet')], [null, null]);
      equal([T.minutesOf('usecase:uc'), T.minutesOf('prompt:losse'), T.minutesOf('prompt:uc-1'), T.minutesOf('prompt:weg')], [45, 20, 0, 0]);
      equal(T.chip({ saves: 0 }), null, 'geen kaartlabel zonder schatting');
      equal([T.chip({ saves: 90 }).textContent, T.chip({ saves: 60 }).textContent], ['Scheelt ±1 u 30 min', 'Scheelt ±1 uur']);
    }));
    await test('tijdwinst van collega\'s: pas vanaf vijf uur op de startpagina, eerst deze maand', () => {
      ok(/deze maand al ±7 uur/.test(T.proofText({ month: 400, total: 900 })), 'deze maand');
      ok(/al ±10 uur/.test(T.proofText({ month: 100, total: 600 })), 'in totaal');
      equal([T.proofText({ month: 10, total: 100 }), T.proofText(null)], ['', '']);
    });
    await test('beloftes: standaard, eigen tekst en termijn, uit met een streepje of helemaal', () => {
      const P = ns.promises;
      equal(P.get('flyin', {}), { text: 'Reactie binnen 1–2 werkdagen', days: 2 });
      equal(P.get('prompt', { promisePrompt: 'Binnen een week een prompt op maat', promisePromptDays: 5 }), { text: 'Binnen een week een prompt op maat', days: 5 });
      equal([P.get('request', { promiseRequest: '-' }), P.get('flyin', { promisesOff: true }), P.get('prompt', { promisePromptDays: 'snel' }).days], [null, null, 1]);
      equal([P.kindOf({ kind: 'invliegen' }), P.kindOf({ kind: 'verzoek', title: 'Prompt voor: huurcontract samenvatten' }), P.kindOf({ kind: 'verzoek', title: 'Demo voor ons team' }), P.kindOf({ kind: 'idee' })], ['flyin', 'prompt', 'request', null]);
    });
    await test('beloftes: termijn in werkdagen (weekend telt niet), verlopen en gehouden', () => {
      const P = ns.promises;
      const at = (y, m, d, h) => new Date(y, m - 1, d, h || 0, 0, 0);
      equal(P.addWorkdays(at(2026, 11, 6, 10), 1).getTime(), at(2026, 11, 9, 10).getTime(), 'vrijdag + 1 = maandag');
      equal(P.addWorkdays(at(2026, 11, 7, 10), 1).getTime(), at(2026, 11, 10, 0).getTime(), 'zaterdag: vóór het eind van maandag');
      equal(P.addWorkdays(at(2026, 11, 4, 14), 2).getTime(), at(2026, 11, 6, 14).getTime(), 'woensdag + 2 = vrijdag');
      const item = { kind: 'invliegen', status: 'nieuw', created_at: at(2026, 11, 4, 14).toISOString() };
      const soon = P.deadline(item, at(2026, 11, 5, 14), {});
      equal([soon.kind, Math.round(soon.hoursLeft), soon.late, P.leftText(soon)], ['flyin', 24, false, 'Nog 1 dag']);
      equal(P.deadline(item, at(2026, 11, 7, 9), {}).late, true, 'zaterdag is te laat');
      equal(P.deadline(Object.assign({}, item, { status: 'in-behandeling' }), at(2026, 11, 7, 9), {}), null, 'gereageerd = gehouden');
      const prompt = { kind: 'verzoek', title: 'Prompt voor: notulen', status: 'in-behandeling', created_at: at(2026, 11, 4, 9).toISOString() };
      ok(P.deadline(prompt, at(2026, 11, 4, 12), {}), 'een prompt op maat is pas gehouden als hij er is');
      equal([P.leftText({ late: true }), P.leftText({ hoursLeft: 5.5 }), P.leftText({ hoursLeft: 50 })], ['Belofte verlopen', 'Nog 5 uur', 'Nog 2 dagen']);
    });
    await test('kickstart: stappen, voortgang en dag zoveel van de veertien', () => {
      const K = ns.kickstart;
      const set = { prompts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], usecase: { id: 'uc' } };
      const half = K.progress({ started: '2026-11-01', prompts: ['a', 'b', 'x'], usecase: '', policy: false }, set, { tour: true, policy: false }, '2026-11-04');
      equal([half.steps.map((s) => s.id), half.done, half.day, half.complete, half.steps[2].have], [['tour', 'policy', 'prompts', 'usecase'], 1, 4, false, 2]);
      const full = K.progress({ started: '2026-11-01', prompts: ['a', 'b', 'c'], usecase: 'uc', policy: true }, set, { tour: true }, '2026-11-04');
      equal([full.done, full.complete], [4, true]);
      equal(K.progress({ prompts: [], policy: false }, { prompts: [{ id: 'a' }, { id: 'b' }], usecase: null }, { policy: true }, '2026-11-04').steps.map((s) => s.id + (s.need ? s.need : '')), ['tour', 'policy', 'prompts2'], 'twee startprompts, geen usecase');
      equal(K.progress({ prompts: [] }, set, {}, '2026-11-04').day, 0, 'nog niet gestart');
    });
    await test('kickstart: eigen startprompts uit Beheer, anders zelf gekozen (met tijdwinst eerst, één per usecase)', () => withContent(({ uc }) => {
      const K = ns.kickstart;
      const own = K.startSet({ kickstartPrompts: ['losse', 'weg', 'uc-1'], kickstartUsecase: ['uc'] });
      equal([own.prompts.map((p) => p.id), own.usecase.id], [['losse', 'uc-1'], 'uc']);
      const auto = K.startSet({});
      equal([auto.prompts.map((p) => p.id), auto.usecase === uc], [['uc-1', 'losse', 'zonder'], true]);
      equal([K.info({}).title, K.info({ kickstartTitle: 'Startweken', kickstartOff: true }).on], ['Kickstart voor assistenten', false]);
    }));
    await test('voorstellen voor de tijdwinst: eigen voorstel, anders per soort taak, anders de standaard', () => {
      const S = ns.adminSaves;
      equal(S.suggest('prompt', 'contract-doorlichten', {}), { minutes: 20, basis: 'eigen' });
      equal(S.suggest('prompt', 'iets-nieuws', { task: 'Plannen' }), { minutes: 10, basis: 'taak' });
      equal(S.suggest('prompt', 'iets-nieuws', { task: 'Onbekend' }), { minutes: 15, basis: 'standaard' });
      equal([S.suggest('usecase', 'risicoanalyse').minutes, S.suggest('usecase', 'nieuw').basis], [45, 'standaard']);
    });
    await test('voorstellen: iedere usecase en losse prompt van Audit (data/) heeft een eigen voorstel', async () => {
      const saved = { prompts: ns.prompts, usecases: ns.usecases };
      try {
        await ns.ui.loadScripts(['../data/prompts.js', '../data/usecases.js']);
        const missing = ns.prompts.filter((p) => !ns.adminSaves.SUGGESTIONS.prompt[p.id]).map((p) => p.id)
          .concat(ns.usecases.filter((u) => !ns.adminSaves.SUGGESTIONS.usecase[u.id]).map((u) => u.id));
        equal(missing, []);
        ok(Object.values(ns.adminSaves.SUGGESTIONS.prompt).concat(Object.values(ns.adminSaves.SUGGESTIONS.usecase)).every((n) => n >= 5 && n <= 60), 'voorzichtig: tussen 5 en 60 minuten');
      } finally {
        ns.prompts = saved.prompts;
        ns.usecases = saved.usecases;
      }
    });
    await test('livegangcheck: schattingen tellen alleen usecases en losse prompts; klaar vanaf 80%', () => {
      const L = ns.adminLaunch;
      const uc = { id: 'uc', saves: 30 };
      const content = { usecases: [uc, { id: 'uc2', saves: 0 }], prompts: [{ id: 'uc-1', usecase: uc, saves: 0 }, { id: 'p1', saves: 15 }, { id: 'p2', saves: 10 }, { id: 'p3', saves: 0, locked: true }] };
      equal(L.savesCount(content), { filled: 3, total: 4 });
      equal([L.savesState({ filled: 3, total: 4 }), L.savesState({ filled: 4, total: 5 }), L.savesState({ filled: 0, total: 0 })], ['todo', 'done', 'optional']);
      equal(L.STEPS.map((step) => step.id), ['step13', 'step14', 'step12']);
    });
    /* ---- Trainingen: voor wie, en naslagwerk met Copilot ---- */
    await test('rol: gekozen in Mijn gegevens, anders afgeleid uit je functie', () => {
      const P = ns.profile;
      equal(['Senior manager', 'Assistent-accountant', 'Senior auditor', 'Supervisor', 'Partner', 'Fiscalist', ''].map(P.roleOf), ['manager', 'assistent', 'senior', 'manager', 'partner', '', '']);
      const saved = ns.ui.storage.get('profiel', null);
      try {
        P.set({ functie: 'Junior auditor', rol: '' });
        equal(P.role(), 'assistent', 'afgeleid');
        P.set({ rol: 'manager' });
        equal([P.role(), P.get().rol], ['manager', 'manager'], 'gekozen gaat voor');
        P.set({ rol: 'directie' });
        equal(P.get().rol, '', 'een onbekende rol wordt niet bewaard');
      } finally {
        // Eerst alles leeg (ook het geheugen van profile.js), dan wat er stond terug
        P.clear();
        if (saved) P.set(saved);
      }
    });
    await test('training: voor wie alleen bekende rollen; leeg = voor iedereen', () => {
      // load() vervangt alle inhoud: daarna alles terugzetten zoals het was
      const saved = Object.assign({}, ns.content);
      try {
        ns.content.load({ phase: [], usecase: [], prompt: [], tip: [], agent: [], setting: {}, training: [
          { id: 't1', title: 'Voor managers', date: '2026-10-01', audience: ['manager', 'directie'] },
          { id: 't2', title: 'Voor iedereen', date: '2026-10-02' }
        ] });
        equal([ns.content.trainingById.get('t1').audience, ns.content.trainingById.get('t2').audience], [['manager'], []]);
      } finally {
        Object.assign(ns.content, saved);
      }
    });
    await test('naslagwerk uit Copilot: JSON uit het antwoord, alleen bekende velden, met waarschuwingen', () => {
      const N = ns.adminNaslag;
      const answer = 'Hier is het naslagwerk:\n```json\n' + JSON.stringify({
        title: 'Copilot voor managers',
        takeaways: [{ title: 'Review blijft nodig', text: 'Controleer de output.', warning: true }, { title: 'Geef context', text: 'Meer context, beter antwoord.', warning: false }],
        actions: [{ title: 'Stel instructies in', text: 'Scheelt herhalen.', slide: 4, howto: [{ title: 'Zo doe je het', steps: ['Open Copilot', 'Kies Instellingen'] }], prompts: [{ label: 'Sjabloon', text: 'Ik ben [FUNCTIE].' }, { label: 'Leeg', text: '' }] }, { text: 'zonder titel' }],
        chapters: [{ time: '02:15', title: 'Introductie' }, { time: 'begin', title: 'Fout' }],
        questions: ['Mag dit met klantdata?', ''],
        ideas: [{ title: 'Idee', text: 'Mail naar jan@voorbeeld.nl' }],
        onbekend: 'weg'
      }) + '\n```\nSucces!';
      const result = N.parse(answer);
      equal(Object.keys(result.data).sort(), ['actions', 'chapters', 'ideas', 'questions', 'takeaways', 'title']);
      equal(result.data.takeaways, [{ title: 'Review blijft nodig', text: 'Controleer de output.', warning: true }, { title: 'Geef context', text: 'Meer context, beter antwoord.' }]);
      equal(result.data.actions, [{ title: 'Stel instructies in', text: 'Scheelt herhalen.', slide: '4', howto: [{ title: 'Zo doe je het', steps: ['Open Copilot', 'Kies Instellingen'] }], prompts: [{ label: 'Sjabloon', text: 'Ik ben [FUNCTIE].' }] }]);
      equal([result.data.chapters, result.data.questions], [[{ time: '02:15', title: 'Introductie' }], ['Mag dit met klantdata?']]);
      equal(result.summary, { takeaways: 2, actions: 1, chapters: 1, ideas: 1, questions: 1 });
      ok(result.warnings.some((w) => /kernpunten/.test(w)) && result.warnings.some((w) => /hoofdstuk/.test(w)) && result.warnings.some((w) => /e-mailadres/.test(w)), 'waarschuwingen: te weinig kernpunten, hoofdstuk zonder tijd, e-mailadres');
      let message = '';
      try { N.parse('Sorry, dat kan ik niet.'); } catch (error) { message = error.message; }
      ok(/geen JSON/.test(message), 'zonder JSON een uitleg');
      try { N.parse('{ "title": "half'); } catch (error) { message = error.message; }
      ok(/geen JSON|geldige JSON/.test(message), 'kapotte JSON: een uitleg');
      ok(/takeaways/.test(N.PROMPT) && /Noem geen namen/.test(N.PROMPT), 'de prompt vraagt de velden en zegt: geen namen');
    });
    await test('kickstart afgerond: één keer AI-miles (instelbaar bij de regels)', () => {
      const facts = [fact('kickstart_done', '', '2026-11-04'), fact('kickstart_done', '', '2026-11-05')];
      equal(B.compute(facts, { today: '2026-11-05' }).miles, 50);
      equal(B.compute(facts, { today: '2026-11-05', rules: B.rules({ miles: { kickstart_done: 80 } }) }).miles, 80);
      ok(B.SELF_KINDS.includes('kickstart_done'), 'een deelnemer legt hem zelf vast');
    });

    /* ---- verbetervoorstel ---- */
    describe('Verbetervoorstel bij een prompt (js/improve.js)');
    const oldText = 'Schrijf een korte mail. Maximaal 150 woorden. Onderteken met [NAAM].';
    const newText = 'Schrijf een vriendelijke mail. Hooguit 150 woorden. Onderteken met [NAAM].\nSluit af met een vervolgstap.';
    await test('verschil per woord: alles overnemen geeft het voorstel, niets overnemen de oude tekst', () => {
      const parts = ns.improve.diff(oldText, newText);
      equal(parts.filter((p) => p.type === 'change').length, 3, 'drie wijzigingen');
      equal(ns.improve.merge(parts), newText, 'alles');
      parts.forEach((p) => { p.accepted = false; });
      equal(ns.improve.merge(parts), oldText, 'niets');
    });
    await test('deels overnemen: alleen de gekozen wijziging', () => {
      const parts = ns.improve.diff(oldText, newText);
      parts.filter((p) => p.type === 'change').forEach((p, i) => { p.accepted = i === 0; });
      equal(ns.improve.merge(parts), 'Schrijf een vriendelijke mail. Maximaal 150 woorden. Onderteken met [NAAM].');
    });
    await test('vingerafdruk: dezelfde tekst dezelfde, een andere tekst een andere', () => {
      equal(ns.improve.fingerprint(oldText), ns.improve.fingerprint(String(oldText)));
      ok(ns.improve.fingerprint(oldText) !== ns.improve.fingerprint(newText) && /^[0-9a-f]{8}$/.test(ns.improve.fingerprint(newText)), 'anders');
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
    await test('inzending: "target" alleen bij een verbetervoorstel (zonder stap 11 bestaat die kolom niet)', async () => {
      const net = fakeFetch([[201], [201]]);
      try {
        await ns.central.submitIdea({ ref: 'r1', kind: 'idee', title: 'Een idee', body: 'Toelichting bij het idee' });
        await ns.central.submitIdea({ ref: 'r2', kind: 'verbetering', title: 'Verbetering: x', body: 'Nieuwe tekst', allowPublic: false, target: { type: 'prompt', id: 'x', field: 'prompt', base: 'abc' } });
        const [first] = JSON.parse(net.calls[0].init.body);
        const [second] = JSON.parse(net.calls[1].init.body);
        ok(!('target' in first), 'gewone inzending zonder target');
        equal([second.kind, second.allow_public, second.target.id], ['verbetering', false, 'x']);
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
    const REGISTRY = [{ id: 'audit', name: 'Audit' }, { id: 'accountancy', name: 'Accountancy' }, { id: 'belastingadvies', name: 'Belastingadvies' }, { id: 'salarisadministratie', name: 'Salarisadministratie' }];
    const readOne = async (bytes) => {
      const { parts } = await copilot.readExport(fileOf(bytes), REGISTRY);
      equal([parts.length, parts[0].sheet, parts[0].discipline], [1, null, null], 'één deel, voor de discipline waarin je zit');
      return parts[0].summary;
    };
    await test('readExport: totalen per licentie en week; rij zonder licentie overgeslagen', async () => {
      snapshot = await readOne(await fixture.copilotWorkbook(small));
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
          await copilot.readExport(file, REGISTRY);
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
      const read = await readOne(await fixture.copilotWorkbook(sample));
      equal([read.weeks, read.people, read.licences.premium.people], [27, 104, 24]);
    });
    await test('disciplineOf: tabblad op naam of id, ook met een andere uitgang; anders null', () => {
      const of = (name) => copilot.disciplineOf(name, REGISTRY);
      equal(['Audit', 'Accountants', 'Belastingadviseurs', 'Fiscaal', 'salarisadministratie 2026', 'Overzicht', 'Analyse', ''].map(of),
        ['audit', 'accountancy', 'belastingadvies', 'belastingadvies', 'salarisadministratie', null, null, null]);
    });
    await test('readExport: een tabblad per discipline wordt per tabblad gelezen, met de discipline erbij', async () => {
      const bytes = await fixture.copilotDisciplineWorkbook({
        Audit: fixture.copilotSample({ seed: 1, basic: 70, premium: 30 }),
        Accountants: fixture.copilotSample({ seed: 2, basic: 120, premium: 50 }),
        Belastingadviseurs: fixture.copilotSample({ seed: 3, basic: 60, premium: 20 }),
        Toelichting: null
      });
      const { parts } = await copilot.readExport(fileOf(bytes), REGISTRY);
      equal(parts.map((part) => [part.sheet, part.discipline, part.summary.people, part.summary.licences.premium.people, part.summary.weeks]),
        [['Audit', 'audit', 100, 30, 27], ['Accountants', 'accountancy', 170, 50, 27], ['Belastingadviseurs', 'belastingadvies', 80, 20, 27]], 'ieder tabblad eigen cijfers; tabblad zonder tabellen overgeslagen');
      ok(!/PersonId|00000000-0000/.test(JSON.stringify(parts)), 'niets per persoon');
    });
    await test('readExport: een tabblad zonder herkenbare discipline krijgt null; twee tabbladen voor één discipline geeft een fout', async () => {
      const sample = fixture.copilotSample({ seed: 4, basic: 10, premium: 5, weeks: 8 });
      const { parts } = await copilot.readExport(fileOf(await fixture.copilotDisciplineWorkbook({ Audit: sample, Blad2: sample })), REGISTRY);
      equal(parts.map((part) => part.discipline), ['audit', null]);
      let message = '';
      try {
        await copilot.readExport(fileOf(await fixture.copilotDisciplineWorkbook({ Audit: sample, 'Audit oud': sample })), REGISTRY);
      } catch (error) {
        message = error.message;
      }
      ok(message.includes("'Audit' en 'Audit oud'"), message || 'geen fout');
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
      equal([training.hasRecording, training.chapters.length, training.chapters[5].seconds], [true, 6, 267], 'videosamenvatting met hoofdstukken');
      equal([training.videoTitle, training.slidesFirst], ['De sessie in 5 minuten', true], 'koptekst en volgorde');
      ok(training.usecases.every((id) => ns.content.usecaseById.has(id)), 'de snacks bij de training bestaan');
      const usecases = ns.content.usecases;
      equal(usecases.length, 6, 'usecases');
      ok(usecases.every((u) => u.hasDemo), 'iedere usecase heeft een demo');
      const standalone = ns.content.prompts.filter((p) => !p.usecase);
      equal([standalone.length, standalone.filter((p) => p.promptBasic).length, standalone.filter((p) => p.followUps.length).length], [35, 17, 5]);
      // Alleen de gedeelde tips ontbreken hier (die komen uit de basis)
      equal(ns.content.issues.filter((issue) => !/tip/i.test(issue)), []);
    });

    /* ---- momenten bij het Copilot-gebruik ---- */
    describe('Momenten bij het Copilot-gebruik (js/admin-copilot.js, js/admin-chart.js)');
    const momentWeeks = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']
      .map((week, i) => ({ week, active: i < 7 ? { basic: 10, premium: 2 } : { basic: 4, premium: 20 }, volume: i < 7 ? { basic: 100, premium: 50 } : { basic: 40, premium: 400 } }));
    await test('voor en na: de laatste 4 volle weken ervoor en de weken erna; de week van het moment telt niet mee', () => {
      const { before, after } = ns.adminCopilot.aroundMoment(momentWeeks, '2026-10-28');
      equal([before.weeks, after.weeks, before.active.total, after.active.total, after.active.premium], [4, 2, 12, 24, 20]);
      const text = ns.adminCopilot.momentInsight(momentWeeks, { date: '2026-10-28', title: 'Iedereen een licentie' });
      ok(/tegen 12 in de 4 weken ervoor/.test(text) && /\+100\s?%/.test(text) && /Premium 2 → 20/.test(text), text);
      ok(/nog geen weken/.test(ns.adminCopilot.momentInsight(momentWeeks.slice(0, 8), { date: '2026-10-28', title: 'x' })), 'nog geen weken erna');
      ok(/te weinig weken/.test(ns.adminCopilot.momentInsight(momentWeeks, { date: '2026-09-08', title: 'x' })), 'te weinig weken ervoor');
    });
    await test('grafiek: alleen momenten binnen de weken, op datum genummerd, ook in de tabel', () => {
      const chart = ns.adminChart.lineChart({
        title: 'Test', series: [{ id: 'a', label: 'A' }],
        points: momentWeeks.map((week) => ({ week: week.week, values: { a: week.active.basic } })),
        markers: [{ date: '2026-10-28', label: 'Licentie' }, { date: '2025-01-01', label: 'Buiten' }, { date: '2026-09-10', label: 'Training' }]
      });
      equal([...chart.querySelectorAll('.chart__moments li')].map((li) => li.textContent.replace(/^\d/, (n) => n + ' ')), ['1 10 sep. 2026: Training', '2 28 okt. 2026: Licentie']);
      equal(chart.querySelectorAll('tbody tr')[7].lastElementChild.textContent, '28 okt. 2026: Licentie');
    });

    /* ---- doelkoers ---- */
    describe('Doelkoers (js/admin-goals.js)');
    const G = ns.adminGoals;
    const goal = { target: 70, deadline: '2027-07-01', start: '2026-07-01', baseline: 30 };
    await test('de koers: een rechte lijn van de beginwaarde naar het doel', () => {
      const r = G.progress(goal, [{ date: '2026-07-01', value: 30 }, { date: '2027-01-01', value: 50 }], '2027-01-10');
      ok(Math.abs(r.at('2027-01-01') - (30 + 40 * (184 / 365))) < 0.01, 'halverwege de koers');
      equal([r.at('2026-01-01'), r.at('2028-01-01')], [30, 70], 'voor het begin de beginwaarde, na het eind het doel');
    });
    await test('de stand: op koers, iets achter, achter, gehaald, niet gehaald, geen gegevens', () => {
      const at = (value, today) => G.progress(goal, [{ date: '2026-07-01', value: 30 }, { date: '2027-01-01', value }], today || '2027-01-10').status;
      equal([at(52), at(48), at(40), at(71), at(60, '2027-08-01')], ['op-koers', 'bijna', 'achter', 'gehaald', 'gemist']);
      equal(G.progress(goal, [], '2027-01-10').status, 'geen');
    });
    await test('het tempo: bij dit tempo haal je het doel rond …; zonder groei geen datum', () => {
      const up = G.progress(goal, [{ date: '2026-07-01', value: 30 }, { date: '2026-10-01', value: 40 }, { date: '2027-01-01', value: 50 }], '2027-01-10');
      ok(up.slope > 0 && up.projected > '2027-01-01' && up.projected < '2027-12-31', 'datum: ' + up.projected);
      ok(/Bij dit tempo haal je het doel rond/.test(G.sentence(G.metricOf('adoptie'), goal, up)), 'zin');
      const flat = G.progress(goal, [{ date: '2026-07-01', value: 30 }, { date: '2027-01-01', value: 30 }], '2027-01-10');
      equal(flat.projected, null);
      ok(/niet bij het doel/.test(G.sentence(G.metricOf('adoptie'), goal, flat)), 'geen groei');
    });
    await test('kengetallen uit de imports en de tellers: adoptie per import, kopieën per volle week', () => {
      const data = G.dataFor([
        { period_start: '2026-08-31', period_end: '2026-09-27', summary: snapshot },
        { period_start: '1900-01-02', period_end: '1900-01-02', source: 'doelen', summary: { version: 'doelen', goals: [] } }
      ], [
        { kind: 'copy_prompt', occurred_at: '2026-10-05T09:00:00Z' }, { kind: 'copy_prompt', occurred_at: '2026-10-06T09:00:00Z' },
        { kind: 'view_tip', occurred_at: '2026-10-06T09:00:00Z' }, { kind: 'copy_tip', occurred_at: '2026-10-14T09:00:00Z' }
      ], '2026-10-21');
      equal(data.snapshots.length, 1, 'de rij met doelen is geen import');
      const adoption = G.pointsOf(G.metricOf('adoptie'), data);
      equal(adoption.length, 1);
      ok(adoption[0].value > 0 && adoption[0].value <= 100, 'percentage');
      equal(G.pointsOf(G.metricOf('kopieen'), data).map((p) => [p.date, p.value]), [['2026-10-05', 2], ['2026-10-12', 1.5]], 'per week, lopend gemiddelde, zonder de lopende week');
    });

    /* ---- slot met pincode ---- */
    describe('Slot met pincode (js/lock.js)');
    await test('de vingerafdruk in de config hoort bij de pincode van de snackbar; spaties tellen niet', async () => {
      equal(await ns.lock.hash('26102026'), ns.config.lockPinHash, 'pincode');
      equal(await ns.lock.hash(' 26102026 '), ns.config.lockPinHash, 'met spaties');
      ok((await ns.lock.hash('12345678')) !== ns.config.lockPinHash, 'andere pincode');
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
      await test('opslaan voor een andere discipline (een tabblad per discipline): die naamruimte', async () => {
        const net = fakeFetch([[201, [{ id: 8, period_end: '2026-02-22' }]]]);
        try {
          await ns.central.saveCopilotUsage(snapshot, 'ai-accountancy');
          equal(JSON.parse(net.calls[0].init.body).namespace, 'ai-accountancy');
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
