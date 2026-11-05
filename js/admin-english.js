/* ==========================================================================
   Beheer → Inhoud: de Engelse versie (voor het team in Zuid-Afrika)
   --------------------------------------------------------------------------
   - In ieder formulier (usecase, prompt, tip, training, agent, fase en de
     teksten van de site) een uitklapblok 'Engelse versie': dezelfde teksten,
     met het Nederlands in grijs erin. Vertalen met Copilot: kopieer de prompt
     (met de Nederlandse teksten als JSON), plak het antwoord terug en de
     velden zijn ingevuld. Opslaan en publiceren zoals altijd.
   - Het tabblad 'Engels': wat er nog vertaald of bijgewerkt moet worden, en
     alles in één keer: exporteren voor vertaling en een vertaling importeren.
   Hoe de cockpit de Engelse versie gebruikt: js/content-en.js. Beheer zelf
   blijft Nederlands.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast } = ns.ui;
  const E = ns.contentEn;
  const confirm = (message, options) => ns.ui.confirmDialog(message, options);

  const KIND = { usecase: 'een usecase', prompt: 'een prompt', tip: 'een tip', training: 'een training met naslagwerk', agent: 'een AI-agent of tool', phase: 'een fase (naam van een stap in het werk)', setting: 'de teksten van de website' };
  const STATUS = {
    '': { text: 'Nog niet vertaald', tone: 'muted' },
    ok: { text: 'Vertaald', tone: 'success' },
    verouderd: { text: 'Nederlands gewijzigd: bijwerken', tone: 'warning' }
  };
  const SENSITIVE = /\b\d{9}\b|\bNL\d{2}\s?[A-Z]{4}(\s?\d){10}\b/i;
  const EMAIL = /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i;
  const PLACEHOLDERS = /\[[A-ZÀ-ÖØ-Þ][^[\]\n]{0,140}\]/g;
  // Woorden die in een Engelse tekst niet horen: dan is er waarschijnlijk iets niet vertaald
  const DUTCH = /\b(het|een|niet|voor|wordt|worden|jouw|bijvoorbeeld|controleer|klant|gegevens)\b/gi;

  const RULES = `Regels:
- Brits Engels (en-GB), helder en zakelijk. Spreek de lezer aan met "you".
- Houd precies dezelfde JSON-structuur en dezelfde sleutels; vertaal alleen de waarden. Een lijst houdt hetzelfde aantal onderdelen in dezelfde volgorde, ook een leeg onderdeel {}.
- Vertaal ook de plaatshouders tussen blokhaken, in hoofdletters en met de blokhaken: [KLANTNAAM] → [CLIENT NAME], [PROCES, bijv. inkoopproces] → [PROCESS, e.g. purchasing process], [KORT / UITGEBREID] → [SHORT / DETAILED], [PLAK HIER DE TEKST] → [PASTE THE TEXT HERE].
- Deze plaatshouders vult de cockpit zelf in; gebruik precies deze namen: [NAAM] → [NAME], [FUNCTIE] → [ROLE], [VESTIGING] → [OFFICE], [TEAM] → [TEAM], [JAAR] → [YEAR], [BOEKJAAR] → [FINANCIAL YEAR], [VORIG JAAR] → [PREVIOUS YEAR].
- Gebruik voor Microsoft 365 de namen van knoppen en menu's zoals ze in de Engelse versie heten (bijv. Werk-modus → Work mode).
- Vertaal Nederlandse wet- en regelgeving en standaarden niet (zoals NV COS, BW2 Titel 9, RJ, Wwft): laat de naam of afkorting staan.
- Vertaal betekenisgetrouw. Staat er in een prompt in welke taal het antwoord moet, dan laat je die taal staan.
- Voeg niets toe en laat niets weg.
- Geef alleen JSON terug, zonder uitleg ervoor of erna.`;

  /** De vertaalprompt voor Copilot bij één item. */
  function prompt(type, dutch) {
    return `Vertaal de teksten in het JSON-object hieronder van het Nederlands naar het Engels. Het is ${KIND[type] || 'een onderdeel'} uit de AI-cockpit van Visser & Visser (uitleg en prompts voor Microsoft Copilot), voor collega's in Zuid-Afrika die meewerken aan Nederlandse controles.

${RULES}

${JSON.stringify(E.extract(type, dutch), null, 2)}`;
  }

  /** De prompt voor een geëxporteerd bestand (tabblad Engels). */
  const FILE_PROMPT = `Het bijgevoegde JSON-bestand bevat teksten uit de AI-cockpit van Visser & Visser (uitleg en prompts voor Microsoft Copilot), voor collega's in Zuid-Afrika die meewerken aan Nederlandse controles. Vertaal per item de teksten onder "nl" van het Nederlands naar het Engels.

Geef één JSON-object terug in precies deze vorm, met hetzelfde "type" en "id" per item:
{ "items": [ { "type": "…", "id": "…", "en": { dezelfde sleutels als "nl", vertaald } } ] }

${RULES}
- Is het antwoord te lang, stop dan na een heel item en zeg welke items nog ontbreken; die vraag ik daarna.`;

  /* ---- Antwoord van Copilot inlezen ------------------------------------------------------- */
  /** Tekst → JSON (zonder ```-blok en tekst eromheen). Gooit een Error met uitleg. */
  function readJson(raw) {
    let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const start = text.search(/[[{]/);
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if (start < 0 || end <= start) throw new Error('Er staat geen JSON in. Kopieer het hele antwoord van Copilot, van de eerste { tot en met de laatste }.');
    text = text.slice(start, end + 1);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Dit is geen geldige JSON (misschien niet helemaal gekopieerd). Vraag Copilot: "Geef alleen het JSON-object, zonder uitleg", en plak het opnieuw.');
    }
  }

  const strings = (value) => {
    const out = [];
    const walk = (part) => {
      if (typeof part === 'string') out.push(part);
      else if (Array.isArray(part)) part.forEach(walk);
      else if (part && typeof part === 'object') Object.values(part).forEach(walk);
    };
    walk(value);
    return out;
  };
  const count = (value) => strings(value).reduce((total, text) => total + (text.match(PLACEHOLDERS) || []).length, 0);

  /** Aandachtspunten bij een vertaling (geen fouten: Beheer slaat hem toch op als je wilt). */
  function check(type, en, dutch) {
    const warnings = [];
    const nl = E.extract(type, dutch);
    Object.keys(nl).forEach((key) => {
      if (Array.isArray(nl[key]) && Array.isArray(en[key]) && typeof nl[key][0] === 'object' && en[key].length !== nl[key].length) {
        warnings.push(`Bij "${key}" heeft het Nederlands ${nl[key].length} onderdelen en het Engels ${en[key].length}. De cockpit koppelt ze op volgorde.`);
      }
    });
    const before = count(nl);
    const after = count(en);
    if (before !== after) warnings.push(`Het aantal plaatshouders [ZO] verschilt: ${before} in het Nederlands, ${after} in het Engels. Kijk de prompts na.`);
    const all = strings(en).join(' ');
    if ((all.match(DUTCH) || []).length > 3) warnings.push('Er lijkt nog Nederlands in te staan. Lees het na.');
    if (EMAIL.test(all)) warnings.push('Er staat een e-mailadres in. Haal namen en adressen weg voordat je publiceert.');
    if (SENSITIVE.test(all)) warnings.push('Er staat iets in dat op een BSN of rekeningnummer lijkt. Haal het weg.');
    return warnings;
  }

  /** Het antwoord van Copilot bij één item → { en, warnings }. Gooit een Error met uitleg. */
  function parse(raw, type, dutch) {
    const source = readJson(raw);
    const object = Array.isArray(source) ? null : source;
    // Copilot zet het soms in { "en": … } of { "items": [ … ] }: dat mag ook
    const candidate = object && object.items && Array.isArray(object.items) && object.items[0] ? object.items[0].en || object.items[0] : object && object.en && typeof object.en === 'object' ? object.en : object;
    const en = candidate ? E.pick(candidate, E.SPEC[type]) : null;
    if (!en) throw new Error('Er staat niets in dat de cockpit herkent. Gebruik de vertaalprompt: die geeft de sleutels die nodig zijn.');
    return { en, warnings: check(type, en, dutch) };
  }

  /** Een bestand met vertalingen (tabblad Engels) → { items: [{ type, id, en }], skipped }. */
  function parseFile(raw) {
    const source = readJson(raw);
    const list = Array.isArray(source) ? source : source && Array.isArray(source.items) ? source.items : null;
    if (!list) throw new Error('Geen lijst met items gevonden. Het bestand moet de vorm { "items": [ { "type", "id", "en" } ] } hebben.');
    let skipped = 0;
    const items = [];
    list.forEach((item) => {
      const type = item && String(item.type || '');
      const id = item && String(item.id || '');
      if (!E.SPEC[type] || !id || !item.en || typeof item.en !== 'object') {
        skipped += 1;
        return;
      }
      items.push({ type, id, en: item.en });
    });
    if (!items.length) throw new Error('Er staat geen enkel item in met een type, een id en een Engelse versie ("en").');
    return { items, skipped };
  }

  /* ---- Het blok 'Engelse versie' in het formulier --------------------------------------------- */
  const preview = (value) => {
    if (typeof value === 'string') return value.trim().slice(0, 400);
    if (Array.isArray(value)) return value.filter((line) => typeof line === 'string').join('\n').slice(0, 400);
    return '';
  };

  /**
   * Een veld uit het formulier als Engels veld: niet verplicht, het Nederlands als grijze tekst erin. Een
   * groep (bijv. de prompts van een usecase) heeft net zoveel onderdelen als het Nederlands, op volgorde.
   */
  function mirror(field, dutch, spec) {
    const copy = Object.assign({}, field, { required: false, hint: undefined, suggestions: undefined, upload: undefined, defaults: undefined, bulk: undefined, min: undefined });
    // Een groep die in het Nederlands leeg is (bijv. geen hoofdstukken): niets te vertalen, niet tonen
    if (field.type === 'group' && !(Array.isArray(dutch) && dutch.length)) return Object.assign(copy, { type: 'skip' });
    if (field.type === 'heading') return copy;
    if (field.type === 'group' || field.type === 'object') {
      copy.fields = field.fields.filter((sub) => spec && spec[sub.key]);
      copy.dutch = field.type === 'group' ? (Array.isArray(dutch) ? dutch : []) : dutch && typeof dutch === 'object' ? dutch : {};
      copy.mirror = (sub, parent) => mirror(sub, parent ? parent[sub.key] : undefined, spec[sub.key]);
      if (field.type === 'group') {
        copy.fixed = true;
        copy.keepEmpty = true;
      }
      return copy;
    }
    copy.placeholder = preview(dutch);
    if (field.type === 'code' && field.placeholders) copy.hint = 'Plaatshouders in het Engels, bijv. [CLIENT NAME]. [NAME], [ROLE] en [YEAR] vult de cockpit zelf in.';
    return copy;
  }

  let uid = 0;
  let scrolledFor = '';
  /**
   * Het veld 'Engelse versie' (type 'english' in js/admin-content.js). ctx: type, data (beginstand),
   * dutch() (de Nederlandse velden zoals ze nu in het formulier staan), focus (meteen openklappen).
   * helpers: control(), isEmpty() en fields (de velden van deze soort).
   */
  function control(field, value, ctx, helpers) {
    const type = ctx.type;
    const spec = E.SPEC[type];
    const id = 'en-box-' + (++uid);
    const start = ctx.data || {};
    // De teksten van deze soort, met de tussenkoppen erbij (zodat 'Titel' bij Kickstart herkenbaar is)
    const fields = helpers.fields.filter((f) => (f.type === 'heading' || (spec && spec[f.key])) && (!f.scope || f.scope === ctx.where.kind));
    let subs = [];
    let imported = false;
    const grid = el('div', { className: 'form-grid en-box__grid' });

    function build(values, dutch) {
      const reference = dutch || start;
      const mirrored = fields.map((f) => ({ f, field: mirror(f, reference[f.key], spec[f.key]) })).filter((item) => item.field.type !== 'skip');
      // Een tussenkop zonder velden eronder (tot de volgende kop) laten we weg
      const shown = mirrored.filter((item, index) => item.field.type !== 'heading' || (mirrored[index + 1] && mirrored[index + 1].field.type !== 'heading'));
      subs = shown.map(({ f, field }) => ({ f, ctl: helpers.control(field, values ? values[f.key] : undefined, ctx) }));
      grid.replaceChildren(...subs.map((sub) => sub.ctl.node));
    }
    function content() {
      const out = {};
      subs.forEach(({ f, ctl }) => {
        const v = ctl.get();
        if (!helpers.isEmpty(v)) out[f.key] = v;
      });
      return Object.keys(out).length ? out : null;
    }
    build(value);
    const initial = JSON.stringify(content());

    const state = E.status(type, Object.assign({}, start, { en: value }));
    const status = el('span', { className: `en-box__status status status--${STATUS[state].tone}`, text: STATUS[state].text });
    const refreshed = state === 'verouderd' ? el('input', { attrs: { id: id + '-fresh', type: 'checkbox' } }) : null;

    // Vertalen met Copilot
    const answer = el('textarea', { className: 'field__input field__textarea naslag-import__answer', attrs: { id: id + '-answer', rows: '5', spellcheck: 'false', placeholder: '{ "title": "…", … }' } });
    const fill = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('wand'), el('span', { text: 'Vertaling invullen' })]);
    const result = el('div', { className: 'naslag-import__result', attrs: { 'aria-live': 'polite' } });
    const getPrompt = () => prompt(type, ctx.dutch());
    fill.addEventListener('click', async () => {
      result.replaceChildren();
      let parsed;
      try {
        parsed = parse(answer.value, type, ctx.dutch());
      } catch (error) {
        result.replaceChildren(el('p', { className: 'naslag-import__error' }, [icon('alert'), el('span', { text: error.message })]));
        answer.focus();
        return;
      }
      if (content() && !(await confirm('Dit vervangt de Engelse teksten die er nu staan.', { title: 'Overschrijven?', confirmLabel: 'Vervangen' }))) return;
      build(parsed.en, ctx.dutch());
      imported = true;
      answer.value = '';
      result.replaceChildren(...[
        el('p', { className: 'naslag-import__ok' }, [icon('check-circle'), el('span', { text: 'Engelse versie ingevuld. Lees hem na en sla op.' })]),
        parsed.warnings.length ? el('ul', { className: 'naslag-import__warnings' }, parsed.warnings.map((warning) => el('li', {}, [icon('alert'), el('span', { text: warning })]))) : null
      ].filter(Boolean));
    });

    const clear = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Engelse versie wissen' })]);
    clear.addEventListener('click', async () => {
      if (!content()) return;
      if (!(await confirm('Alle Engelse teksten van dit item worden leeggemaakt. In het Engels staat het dan weer in het Nederlands, met het label "Dutch only". Pas na Opslaan.', { title: 'Engelse versie wissen?', confirmLabel: 'Wissen', danger: true }))) return;
      build(null);
      imported = true;
    });

    const box = el('details', { className: 'field field--wide en-box', attrs: { id } }, [
      el('summary', { className: 'en-box__head' }, [
        el('span', { className: 'en-box__icon', attrs: { 'aria-hidden': 'true' } }, [icon('globe')]),
        el('span', { className: 'en-box__heading' }, [
          el('span', { className: 'en-box__title', text: 'Engelse versie' }),
          el('span', { className: 'en-box__lead', text: 'Voor collega\'s die de cockpit in het Engels gebruiken (team Zuid-Afrika)' })
        ]),
        status,
        icon('chevron-down', { className: 'en-box__chevron' })
      ]),
      el('div', { className: 'en-box__body' }, [
        el('p', { className: 'field__hint', text: 'Leeg = in het Engels staat het Nederlands, met het label "Dutch only". In grijs zie je steeds de Nederlandse tekst. Afbeeldingen, tijden, links en keuzes komen altijd uit het Nederlands; bij een lijst (prompts, acties) hoort het eerste Engelse onderdeel bij het eerste Nederlandse.' }),
        el('ol', { className: 'naslag-import__steps en-box__steps' }, [
          el('li', {}, [
            el('p', {}, [el('strong', { text: 'Vertalen met Copilot.' }), ' De prompt bevat de Nederlandse teksten van dit item, zoals ze nu in het formulier staan. Plak hem in Copilot Chat met je werkaccount.']),
            el('div', { className: 'naslag-import__actions' }, [ns.ui.copilotButton(getPrompt, { label: 'Kopieer de prompt en open Copilot', className: 'btn--sm' }), ns.ui.copyButton(getPrompt, { label: 'Alleen kopiëren', className: 'btn--secondary btn--sm' })])
          ]),
          el('li', {}, [
            el('label', { attrs: { for: id + '-answer' } }, [el('strong', { text: 'Plak het antwoord hier' }), ' en klik op Vertaling invullen.']),
            answer,
            el('div', { className: 'naslag-import__actions' }, [fill]),
            result
          ])
        ]),
        grid,
        refreshed ? el('label', { className: 'check en-box__fresh', attrs: { for: id + '-fresh' } }, [refreshed, el('span', { text: 'Het Engels klopt weer met het Nederlands (ook zonder iets te veranderen)' })]) : null,
        el('div', { className: 'en-box__actions' }, [clear])
      ])
    ]);
    if (ctx.focus) {
      box.open = true;
      // Eén keer ernaartoe scrollen; na opslaan (dezelfde pagina opnieuw opgebouwd) blijft de plek waar je was
      if (window.location.hash !== scrolledFor) {
        scrolledFor = window.location.hash;
        window.setTimeout(() => {
          if (box.isConnected) box.scrollIntoView({ block: 'start', behavior: ns.motion && ns.motion.calm && ns.motion.calm() ? 'auto' : 'smooth' });
        }, 50);
      }
    }

    return {
      node: box,
      get: () => {
        const out = content();
        if (!out) return undefined;
        const fresh = imported || Boolean(refreshed && refreshed.checked) || JSON.stringify(out) !== initial || !(value && value._nl);
        out._nl = fresh ? E.fingerprint(type, ctx.dutch()) : value._nl;
        return out;
      },
      validate: () => subs.map(({ ctl }) => ctl.validate()).find(Boolean) || null
    };
  }

  /* ---- Tabblad 'Engels': overzicht, exporteren en importeren ----------------------------------- */
  let filter = 'todo'; // 'todo' (nog niet vertaald of bijwerken), 'ok' of 'all'

  /**
   * api (uit js/admin-content.js): types (soorten die je mag bewerken), rowsOf, stateOf, nameOf, label(type),
   * base, namespace, scopeId, drafting, canPublish, stage, publish, saveContent, afterChange, changeText, failed.
   */
  function view(api) {
    const entries = [];
    api.types.forEach((type) => api.rowsOf(type).forEach((row) => {
      const state = api.stateOf(row);
      if (row.status === 'trash' || !state || state.status === 'trash') return;
      const data = state.data || {};
      entries.push({ type, row, state, data, name: type === 'setting' ? 'Teksten van de site' : api.nameOf(row), status: E.status(type, data) });
    }));
    const counts = { '': 0, ok: 0, verouderd: 0 };
    entries.forEach((entry) => { counts[entry.status] += 1; });

    const listNode = el('div', { className: 'en-list' });
    const href = (entry) => (entry.type === 'setting' ? `${api.base}/setting/engels` : `${api.base}/${entry.type}/${entry.row.id}/engels`);
    function renderList() {
      const shown = entries.filter((entry) => (filter === 'all' ? true : filter === 'ok' ? entry.status === 'ok' : entry.status !== 'ok'));
      listNode.replaceChildren(...(shown.length ? api.types.map((type) => {
        const own = shown.filter((entry) => entry.type === type);
        if (!own.length) return null;
        return el('section', { className: 'en-list__group' }, [
          el('h3', { className: 'saves__title', text: api.label(type) }),
          el('ul', { className: 'en-list__items', attrs: { role: 'list' } }, own.map((entry) => {
            const pending = api.drafting() ? api.changeText(entry.row) : '';
            return el('li', { className: 'en-list__item' }, [
              el('a', { className: 'en-list__name', attrs: { href: href(entry) }, text: entry.name }),
              pending ? el('span', { className: 'badge badge--change', text: pending }) : null,
              el('span', { className: `status status--${STATUS[entry.status].tone}`, text: STATUS[entry.status].text }),
              el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: href(entry) } }, [icon('globe'), el('span', { text: entry.status === 'ok' ? 'Bekijken' : entry.status ? 'Bijwerken' : 'Vertalen' })])
            ]);
          }))
        ]);
      }).filter(Boolean) : [el('p', { className: 'section__lead', text: filter === 'ok' ? 'Nog niets vertaald.' : 'Alles is vertaald en bij.' })]));
    }
    const filterButtons = [['todo', `Te doen (${counts[''] + counts.verouderd})`], ['ok', `Vertaald (${counts.ok})`], ['all', `Alles (${entries.length})`]].map(([value, text]) => {
      const button = el('button', { className: 'toggle', attrs: { type: 'button', 'aria-pressed': String(filter === value) } }, [el('span', { text })]);
      button.addEventListener('click', () => {
        filter = value;
        filterButtons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        renderList();
      });
      return button;
    });
    renderList();

    /* Exporteren: de Nederlandse teksten van wat nog vertaald of bijgewerkt moet worden */
    const exportType = el('select', { className: 'field__input field__input--sm', attrs: { 'aria-label': 'Welke soort exporteren' } },
      [el('option', { attrs: { value: '' }, text: 'Alle soorten' })].concat(api.types.map((type) => el('option', { attrs: { value: type }, text: api.label(type) }))));
    const exportAll = el('input', { attrs: { id: 'en-export-all', type: 'checkbox' } });
    const exportButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('download'), el('span', { text: 'Exporteer voor vertaling (JSON)' })]);
    exportButton.addEventListener('click', () => {
      const chosen = entries.filter((entry) => (!exportType.value || entry.type === exportType.value) && (exportAll.checked || entry.status !== 'ok'));
      if (!chosen.length) {
        toast('Niets te exporteren: alles van deze soort is vertaald. Vink "Ook wat al vertaald is" aan om alles te exporteren.');
        return;
      }
      const file = { format: 'ai-cockpit-vertaling', namespace: api.namespace, exported_at: new Date().toISOString(), items: chosen.map((entry) => ({ type: entry.type, id: entry.row.id, title: entry.name, nl: E.extract(entry.type, entry.data) })) };
      ns.adminKit.download(`ai-cockpit-${api.scopeId || 'inhoud'}-voor-vertaling-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file, null, 2));
      toast(`${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} geëxporteerd.`, { tone: 'success' });
    });

    /* Importeren: een bestand of geplakt antwoord met { items: [{ type, id, en }] } */
    const fileInput = el('input', { className: 'sr-only', attrs: { type: 'file', accept: 'application/json,.json', tabindex: '-1' } });
    const pickFile = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('upload'), el('span', { text: 'Kies een bestand' })]);
    const pasted = el('textarea', { className: 'field__input field__textarea naslag-import__answer', attrs: { id: 'en-import-answer', rows: '5', spellcheck: 'false', placeholder: '{ "items": [ { "type": "prompt", "id": "…", "en": { … } } ] }' } });
    const checkButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Controleren' })]);
    const outcome = el('div', { className: 'en-import__outcome', attrs: { 'aria-live': 'polite' } });
    let pending = [];
    let busy = false;

    function showOutcome(parsed) {
      const byKey = new Map(entries.map((entry) => [entry.type + ':' + entry.row.id, entry]));
      const unknown = [];
      const notes = [];
      pending = [];
      parsed.items.forEach((item) => {
        const entry = byKey.get(item.type + ':' + item.id);
        if (!entry) {
          unknown.push(`${item.type} "${item.id}"`);
          return;
        }
        const en = E.clean(item.type, item.en, entry.data);
        if (!en) return;
        check(item.type, en, entry.data).forEach((warning) => notes.push(`${entry.name}: ${warning}`));
        pending.push({ entry, en });
      });
      const save = el('button', { className: api.canPublish ? 'btn btn--secondary' : 'btn btn--primary', attrs: { type: 'button' } }, [icon('check'), el('span', { text: api.drafting() && !api.canPublish ? 'Opslaan als voorstel' : 'Opslaan' })]);
      const saveAndPublish = api.canPublish ? el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('send'), el('span', { text: 'Opslaan en publiceren' })]) : null;
      save.addEventListener('click', () => persist(false, [save, saveAndPublish]));
      if (saveAndPublish) saveAndPublish.addEventListener('click', () => persist(true, [save, saveAndPublish]));
      const overwrite = pending.filter((item) => item.entry.status).length;
      outcome.replaceChildren(...[
        el('p', { className: pending.length ? 'naslag-import__ok' : 'naslag-import__error' }, [icon(pending.length ? 'check-circle' : 'alert'), el('span', { text: pending.length ? `${pending.length} ${pending.length === 1 ? 'item' : 'items'} herkend${overwrite ? `, waarvan ${overwrite} al een Engelse versie ${overwrite === 1 ? 'heeft' : 'hebben'} (die wordt vervangen)` : ''}.` : 'Geen enkel item herkend in deze omgeving.' })]),
        unknown.length || parsed.skipped ? el('p', { className: 'field__hint', text: [unknown.length ? `Niet gevonden in deze omgeving (overgeslagen): ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? ` en nog ${unknown.length - 8}` : ''}.` : '', parsed.skipped ? `${parsed.skipped} ${parsed.skipped === 1 ? 'regel' : 'regels'} zonder type, id of "en" overgeslagen.` : ''].filter(Boolean).join(' ') }) : null,
        notes.length ? el('ul', { className: 'naslag-import__warnings' }, notes.slice(0, 12).map((note) => el('li', {}, [icon('alert'), el('span', { text: note })]))) : null,
        pending.length ? el('div', { className: 'cms-form__actions' }, [saveAndPublish, save].filter(Boolean)) : null
      ].filter(Boolean));
    }

    async function persist(publishNow, buttons) {
      if (busy || !pending.length) return;
      busy = true;
      buttons.filter(Boolean).forEach((button) => { button.disabled = true; });
      const list = pending.map(({ entry, en }) => ({ entry, data: Object.assign({}, entry.data, { en }) }));
      try {
        if (api.drafting()) {
          const items = [];
          let concepts = 0;
          for (const { entry, data } of list) {
            const stored = await api.stage(entry.type, entry.row.id, data, entry.state.position, entry.state.status);
            if (!stored) continue;
            if (entry.row.status === 'published') items.push({ namespace: api.namespace, type: entry.type, id: entry.row.id, version: stored.version });
            else concepts += 1;
          }
          if (publishNow && items.length) {
            await api.publish(items);
            if (concepts) toast(`${concepts} ${concepts === 1 ? 'concept blijft' : 'concepten blijven'} nog niet live.`);
          } else {
            await api.afterChange(api.canPublish ? 'Opgeslagen. Nog niet live: publiceer via de bewerkbalk.' : 'Voorstel opgeslagen. Een beheerder publiceert het.');
          }
        } else {
          await api.saveContent(list.map(({ entry, data }) => ({ type: entry.type, id: entry.row.id, data, position: entry.state.position || 0, status: entry.row.status })));
          await api.afterChange(`Opgeslagen: ${list.length} Engelse ${list.length === 1 ? 'versie staat' : 'versies staan'} live.`);
        }
        pending = [];
      } catch (error) {
        api.failed('Opslaan', error);
        buttons.filter(Boolean).forEach((button) => { button.disabled = false; });
      } finally {
        busy = false;
      }
    }

    function read(text) {
      try {
        showOutcome(parseFile(text));
      } catch (error) {
        pending = [];
        outcome.replaceChildren(el('p', { className: 'naslag-import__error' }, [icon('alert'), el('span', { text: error.message })]));
      }
    }
    pickFile.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (file) read(await file.text());
    });
    checkButton.addEventListener('click', () => read(pasted.value));

    const total = entries.length;
    return {
      node: el('div', { className: 'saves en-tab' }, [
        el('div', { className: 'saves__intro' }, [
          el('p', { className: 'section__lead', text: 'Collega\'s die de cockpit in het Engels gebruiken (Mijn gegevens → Taal / Language), zien de Engelse versie van een item. Zonder Engelse versie zien ze het Nederlands, met het label "Dutch only". Knoppen en uitleg van de cockpit zijn al Engels.' }),
          el('p', { className: 'field__hint', text: `${counts.ok} van de ${total} vertaald${counts.verouderd ? `, ${counts.verouderd} bijwerken (het Nederlands is veranderd sinds de vertaling)` : ''}. Een item vertaal je in het blok "Engelse versie" onderaan het formulier, met Copilot.` })
        ]),
        el('div', { className: 'toggles en-tab__filters', attrs: { role: 'group', 'aria-label': 'Welke items' } }, filterButtons),
        listNode,
        el('details', { className: 'naslag-import en-import' }, [
          el('summary', { className: 'naslag-import__head' }, [
            el('span', { className: 'naslag-import__icon', attrs: { 'aria-hidden': 'true' } }, [icon('sparkle')]),
            el('span', { className: 'naslag-import__heading' }, [
              el('span', { className: 'naslag-import__title', text: 'Veel items in één keer vertalen' }),
              el('span', { className: 'naslag-import__lead', text: 'Exporteren, laten vertalen (Copilot of het AI-team) en weer importeren' })
            ]),
            icon('chevron-down', { className: 'naslag-import__chevron' })
          ]),
          el('ol', { className: 'naslag-import__steps' }, [
            el('li', {}, [
              el('p', {}, [el('strong', { text: 'Exporteer de Nederlandse teksten.' }), ' Standaard alleen wat nog vertaald of bijgewerkt moet worden.']),
              el('div', { className: 'naslag-import__actions' }, [exportType, el('label', { className: 'check check--compact', attrs: { for: 'en-export-all' } }, [exportAll, el('span', { text: 'Ook wat al vertaald is' })]), exportButton])
            ]),
            el('li', {}, [
              el('p', {}, [el('strong', { text: 'Laat het vertalen.' }), ' Voeg het bestand toe in Copilot Chat (werkaccount) en plak deze prompt. Bij veel items: per soort, anders kan het antwoord worden afgebroken.']),
              el('div', { className: 'naslag-import__actions' }, [ns.ui.copilotButton(() => FILE_PROMPT, { label: 'Kopieer de prompt en open Copilot', className: 'btn--sm' })])
            ]),
            el('li', {}, [
              el('label', { attrs: { for: 'en-import-answer' } }, [el('strong', { text: 'Importeer de vertaling:' }), ' kies het bestand, of plak het antwoord van Copilot en klik op Controleren. Je ziet eerst wat er verandert.']),
              el('div', { className: 'naslag-import__actions' }, [pickFile, fileInput]),
              pasted,
              el('div', { className: 'naslag-import__actions' }, [checkButton]),
              outcome
            ])
          ]),
          el('p', { className: 'field__hint' }, [icon('shield'), ' Lees een vertaling na voordat je publiceert: Copilot kan zich vergissen. Teksten over het AI-beleid laat je extra controleren.'])
        ])
      ]),
      canLeave: () => busy || !pending.length,
      counts: { done: counts.ok, total }
    };
  }

  /** Voor het tabblad: hoeveel er vertaald is ({ done, total }), zonder het hele scherm op te bouwen. */
  function tally(api) {
    let done = 0;
    let total = 0;
    api.types.forEach((type) => api.rowsOf(type).forEach((row) => {
      const state = api.stateOf(row);
      if (row.status === 'trash' || !state || state.status === 'trash') return;
      total += 1;
      if (E.status(type, state.data || {}) === 'ok') done += 1;
    }));
    return { done, total };
  }

  ns.adminEnglish = { RULES, FILE_PROMPT, prompt, parse, parseFile, check, mirror, control, view, tally, STATUS };
})(window.AIAudit);
