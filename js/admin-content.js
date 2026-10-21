/* ==========================================================================
   Beheer → Inhoud (#/beheer/inhoud, #/beheer/inhoud/<soort>, #/beheer/inhoud/<soort>/<id|nieuw>)
   --------------------------------------------------------------------------
   Alle inhoud aanpassen, toevoegen en verwijderen: usecases, prompts, tips,
   trainingen, agents & tools, fasen en de teksten van de site. Alles staat in
   de tabel audit_content in Supabase (zie setup/supabase-audit.sql).

   - Eerste keer: 'Overzetten' zet de bestanden uit data/ in de database.
     Daarna is de database leidend en zijn de bestanden alleen nog terugval.
   - Een nieuwe soort in de bestanden (bijv. agents) waarvan de database nog
     geen enkele rij heeft: een melding biedt aan die items toe te voegen.
   - Status: Gepubliceerd (iedereen), Concept (alleen beheerders) of
     Prullenbak (nergens; terug te zetten of definitief te verwijderen).
   - Iedere wijziging bewaart de vorige versie in audit_content_history.
   - Back-up: exporteer alles als JSON; met Importeer zet je zo'n bestand terug.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate } = ns.ui;
  const confirm = (message, options) => ns.ui.confirmDialog(message, options);
  const ID_PATTERN = /^[a-z0-9-]{1,80}$/;
  const LOCAL_PATH = /^(?![a-z][a-z0-9+.-]*:)(?!\/\/)[^\s<>"'`]+$/i;
  const HTTPS_URL = /^https:\/\/[^\s<>"'`]+$/i;
  // Oude paden uit de tijd in de map audit/ van de snackbar (zie js/content.js); bij opslaan wordt het nieuwe pad bewaard
  const LEGACY_ASSETS = /^\.\.\/assets\//;

  /* ---- Keuzelijsten ----------------------------------------------------------- */
  const LEVELS = [{ value: '', label: '—' }, { value: 'Starter', label: 'Starter' }, { value: 'Gevorderd', label: 'Gevorderd' }];
  const TASKS = ['', 'Analyseren', 'Samenvatten', 'Schrijven', 'Controleren', 'Voorbereiden', 'Plannen'].map((value) => ({ value, label: value || '—' }));
  const ACCENTS = [
    { value: 'teal', label: 'Turquoise' }, { value: 'crimson', label: 'Rood' }, { value: 'steel', label: 'Staalblauw' },
    { value: 'rose', label: 'Roze' }, { value: 'deepteal', label: 'Donkerturquoise' }, { value: 'navy', label: 'Donkerblauw' }
  ];
  const KNOWN_MEDIA = [
    'demos/player.html#risicoanalyse', 'demos/player.html#walkthrough', 'demos/player.html#cijferanalyse',
    'demos/player.html#journaalposten', 'demos/player.html#notulen', 'demos/player.html#managementletter',
    'assets/demos/snack-01.html', 'assets/videos/snack-01.mp4', 'assets/videos/snack-02.mp4', 'assets/videos/snack-03.mp4'
  ];

  const phaseOptions = () => ns.content.phases.map((phase) => ({ value: phase.id, label: phase.label }));
  const unique = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'nl'));
  const asOptions = (values) => values.map((value) => ({ value, label: value }));
  // Lijsten waaruit je bij 'refs' kiest
  const REF_LISTS = { usecase: 'usecases', tip: 'tips', training: 'trainings', phase: 'phases' };
  const PUBLIC_WARNING = 'De site is openbaar bereikbaar: zet hier alleen informatie voor gebruikers. Geen configuratie, systeemprompts, technische instellingen of goedkeuringsdocumenten; voor de formele registratie link je naar het AI-register.';

  /* ---- Velden per soort ---------------------------------------------------------- */
  const SCHEMAS = {
    usecase: {
      label: 'Usecases', one: 'usecase', many: 'usecases', add: 'Nieuwe usecase', route: 'usecase', ordered: true,
      meta: (data) => (ns.content.phaseById.get(data.phase) || {}).label || data.phase || '',
      fields: [
        { key: 'title', label: 'Titel', type: 'text', required: true },
        { key: 'id', label: 'Adres (id)', type: 'id' },
        { key: 'subtitle', label: 'Ondertitel', type: 'text' },
        { key: 'phase', label: 'Fase', type: 'select', options: phaseOptions, required: true, half: true },
        { key: 'icon', label: 'Icoon', type: 'icon', half: true },
        { key: 'level', label: 'Niveau', type: 'select', options: LEVELS, half: true },
        { key: 'duration', label: 'Duur van de demo', type: 'text', placeholder: 'bijv. 2 min', half: true },
        { key: 'license', label: 'Licentie', type: 'license', half: true },
        { key: 'added', label: 'Toegevoegd op', type: 'date', half: true, hint: 'Na de lanceringsdatum krijgt hij een tijdje het label Nieuw.' },
        { key: 'featured', label: 'Uitlichten op de startpagina', type: 'bool' },
        { key: 'tools', label: 'Waar gebruik je het', type: 'list', hint: 'Eén per regel, bijv. Copilot Chat' },
        { key: 'intro', label: 'Introductie', type: 'textarea', required: true },
        { key: 'video', label: 'Opgenomen video (MP4)', type: 'path', suggestions: KNOWN_MEDIA.filter((m) => /\.mp4$/.test(m)), hint: 'Pad naar een bestand op de site, bijv. assets/videos/snack-02.mp4. Heeft voorrang op een demo.' },
        { key: 'demo', label: 'HTML-demo', type: 'path', suggestions: KNOWN_MEDIA.filter((m) => /\.html/.test(m)), hint: 'Bijv. demos/player.html#risicoanalyse. Leeg en geen video: "Demo volgt".' },
        { key: 'steps', label: 'Zo pak je het aan', type: 'list', hint: 'Eén stap per regel' },
        { key: 'prompts', label: 'Prompts', type: 'group', min: 1, itemLabel: 'Prompt', fields: [
          { key: 'label', label: 'Kop', type: 'text', placeholder: 'bijv. Stap 1 · Risico\'s in kaart' },
          { key: 'text', label: 'Prompttekst', type: 'code', required: true, hint: 'Plaatshouders in hoofdletters tussen blokhaken: [KLANTNAAM]' }
        ] },
        { key: 'promptNote', label: 'Toelichting onder de prompts', type: 'textarea' },
        { key: 'watchOut', label: 'Let op', type: 'list', hint: 'Eén aandachtspunt per regel' },
        { key: 'tip', label: 'Tip', type: 'textarea' },
        { key: 'relatedTips', label: 'Handige tips hierbij', type: 'refs', ref: 'tip' }
      ]
    },
    prompt: {
      label: 'Prompts', one: 'prompt', many: 'prompts', add: 'Nieuwe prompt', route: 'prompt', ordered: true,
      meta: (data) => (ns.content.phaseById.get(data.phase) || {}).label || data.phase || '',
      note: 'Prompts uit een usecase pas je aan bij die usecase.',
      fields: [
        { key: 'title', label: 'Titel', type: 'text', required: true },
        { key: 'id', label: 'Adres (id)', type: 'id' },
        { key: 'description', label: 'Omschrijving', type: 'text', hint: 'Eén zin: wat levert de prompt op?' },
        { key: 'phase', label: 'Fase', type: 'select', options: phaseOptions, required: true, half: true },
        { key: 'task', label: 'Soort taak', type: 'select', options: TASKS, half: true },
        { key: 'tool', label: 'Waar gebruik je hem', type: 'text', half: true, suggestions: () => unique(ns.content.prompts.map((p) => p.tool)) },
        { key: 'license', label: 'Licentie', type: 'license', half: true },
        { key: 'prompt', label: 'Prompttekst', type: 'code', required: true, hint: 'Plaatshouders in hoofdletters tussen blokhaken: [KLANTNAAM], [PROCES, bijv. inkoopproces]' },
        { key: 'note', label: 'Toelichting', type: 'textarea', hint: 'Waar en hoe gebruik je hem?' },
        { key: 'tip', label: 'Tip', type: 'textarea' },
        { key: 'added', label: 'Toegevoegd op', type: 'date', half: true },
        { key: 'author', label: 'Aangedragen door', type: 'text', half: true }
      ]
    },
    tip: {
      label: 'Tips', one: 'tip', many: 'tips', add: 'Nieuwe tip', route: 'tip', ordered: true,
      meta: (data) => [data.category, data.release ? 'vrijdag ' + formatDate(data.release) : 'altijd open'].filter(Boolean).join(' · '),
      fields: [
        { key: 'title', label: 'Titel', type: 'text', required: true },
        { key: 'id', label: 'Adres (id)', type: 'id' },
        { key: 'summary', label: 'Samenvatting', type: 'textarea', required: true },
        { key: 'category', label: 'Thema', type: 'text', required: true, half: true, suggestions: () => unique(ns.content.tipCategories.map((c) => c.label)) },
        { key: 'icon', label: 'Icoon', type: 'icon', half: true },
        { key: 'release', label: 'Tip van de week op', type: 'date', half: true, hint: 'Een vrijdag. Tot die dag zit de tip op slot. Leeg = altijd zichtbaar.' },
        { key: 'minutes', label: 'Tijd om in te stellen', type: 'text', placeholder: 'bijv. 2 min', half: true },
        { key: 'license', label: 'Licentie', type: 'license', half: true },
        { key: 'added', label: 'Toegevoegd op', type: 'date', half: true },
        { key: 'featured', label: 'Uitlichten bij "Begin hier" en op de startpagina', type: 'bool' },
        { key: 'why', label: 'Waarom handig in de audit', type: 'textarea' },
        { key: 'steps', label: 'Zo doe je het', type: 'list', required: true, hint: 'Eén stap per regel' },
        { key: 'example', label: 'Voorbeeld om te kopiëren', type: 'object', fields: [
          { key: 'label', label: 'Kop', type: 'text', placeholder: 'bijv. Voorbeeldinstructie voor auditors' },
          { key: 'text', label: 'Tekst', type: 'code' }
        ] },
        { key: 'note', label: 'Kleine lettertjes', type: 'textarea', hint: 'Beschikbaarheid, beleid, menunamen' },
        { key: 'usecases', label: 'Zie het in de praktijk (usecases)', type: 'refs', ref: 'usecase' }
      ]
    },
    training: {
      label: 'Trainingen', one: 'training', many: 'trainingen', add: 'Nieuwe training', route: 'training', ordered: false,
      meta: (data) => [data.date ? formatDate(data.date) : '', data.category].filter(Boolean).join(' · '),
      fields: [
        { key: 'title', label: 'Titel', type: 'text', required: true },
        { key: 'id', label: 'Adres (id)', type: 'id' },
        { key: 'subtitle', label: 'Ondertitel', type: 'text' },
        { key: 'date', label: 'Datum van de training', type: 'date', required: true, half: true },
        { key: 'duration', label: 'Duur', type: 'text', placeholder: 'bijv. 45 min', half: true },
        { key: 'trainer', label: 'Trainer', type: 'text', half: true },
        { key: 'category', label: 'Soort', type: 'text', half: true, suggestions: () => unique(['Basistraining', 'Verdieping', 'Lunchsessie', 'Webinar'].concat(ns.content.trainingCategories)) },
        { key: 'level', label: 'Niveau', type: 'select', options: LEVELS, half: true },
        { key: 'license', label: 'Licentie', type: 'license', half: true },
        { key: 'description', label: 'Omschrijving', type: 'textarea' },
        { key: 'link', label: 'Link naar de opname (Stream/SharePoint/Teams)', type: 'url', hint: 'Aanbevolen. Begint met https://. Opent in een nieuw tabblad; Microsoft 365 regelt wie hem mag zien.' },
        { key: 'video', label: 'Of: korte MP4 op de site', type: 'path', hint: 'Alleen openbaar materiaal; de site is openbaar bereikbaar.' },
        { key: 'poster', label: 'Afbeelding vóór het afspelen', type: 'path' },
        { key: 'chapters', label: 'Hoofdstukken', type: 'group', itemLabel: 'Hoofdstuk', fields: [
          { key: 'time', label: 'Tijd', type: 'text', placeholder: '12:30', half: true },
          { key: 'title', label: 'Titel', type: 'text', half: true }
        ] },
        { key: 'materials', label: 'Materiaal', type: 'group', itemLabel: 'Bijlage', fields: [
          { key: 'label', label: 'Naam', type: 'text', placeholder: 'Slides (PDF)', half: true },
          { key: 'href', label: 'Link of bestand', type: 'text', placeholder: 'https://…', half: true }
        ] },
        { key: 'usecases', label: 'Usecases uit de training', type: 'refs', ref: 'usecase' },
        { key: 'tips', label: 'Tips uit de training', type: 'refs', ref: 'tip' },
        { key: 'added', label: 'Toegevoegd op', type: 'date', hint: 'Leeg = de datum van de training.' }
      ]
    },
    agent: {
      label: 'Agents & tools', one: 'agent', many: 'agents', add: 'Nieuwe agent', route: 'agent', ordered: true,
      meta: (data) => [data.kind, data.status].filter(Boolean).join(' · '),
      warning: PUBLIC_WARNING,
      fields: [
        { key: 'title', label: 'Naam', type: 'text', required: true },
        { key: 'id', label: 'Adres (id)', type: 'id' },
        { key: 'kind', label: 'Soort', type: 'select', options: () => asOptions(ns.content.AGENT_KINDS), required: true, half: true },
        { key: 'status', label: 'Status', type: 'select', options: () => asOptions(ns.content.AGENT_STATUSES), required: true, half: true, hint: 'Gestopt: blijft vindbaar, onderaan en zonder Open-knop.' },
        { key: 'icon', label: 'Icoon', type: 'icon', half: true },
        { key: 'license', label: 'Licentie', type: 'license', half: true, choices: ['Geen licentie nodig (ook met de gratis Copilot Chat)', 'Licentie nodig (Microsoft 365 Copilot, of bij een extern product een eigen licentie)'] },
        { key: 'summary', label: 'Samenvatting', type: 'textarea', required: true, hint: 'Eén of twee zinnen: wat is het en wat heb je eraan?' },
        { key: 'description', label: 'Uitleg', type: 'textarea', hint: 'Waarvoor gebruik je het in de audit? Een lege regel begint een nieuwe alinea.' },
        { key: 'access', label: 'Zo krijg je toegang', type: 'textarea', hint: 'Waar vind je het en wie regelt de toegang of licentie?' },
        { key: 'link', label: 'Link om te openen', type: 'url', hint: 'Begint met https://. Opent in een nieuw tabblad.' },
        { key: 'owner', label: 'Aanspreekpunt', type: 'text', hint: 'Liever een afdeling of functie dan een naam, bijv. ICT of het AI-team.' },
        { key: 'notFor', label: 'Niet gebruiken voor', type: 'list', hint: 'Eén punt per regel' },
        { key: 'phases', label: 'Fasen van de controle', type: 'refs', ref: 'phase' },
        { key: 'usecases', label: 'Usecases hierbij', type: 'refs', ref: 'usecase' },
        { key: 'trainings', label: 'Trainingen hierover', type: 'refs', ref: 'training' },
        { key: 'tips', label: 'Tips hierbij', type: 'refs', ref: 'tip' },
        { key: 'added', label: 'Toegevoegd op', type: 'date', half: true },
        { key: 'registerUrl', label: 'Link naar het AI-register', type: 'url', half: true, hint: 'Optioneel. Alleen de link naar de registratie in de afgeschermde omgeving.' }
      ]
    },
    phase: {
      label: 'Fasen', one: 'fase', many: 'fasen', add: 'Nieuwe fase', ordered: true,
      meta: (data) => data.short || '',
      note: 'De volgorde van de fasen is de volgorde van de filters. Een fase die nog gebruikt wordt, kun je niet verwijderen.',
      fields: [
        { key: 'label', label: 'Naam', type: 'text', required: true },
        { key: 'id', label: 'Code (id)', type: 'id', titleKey: 'label' },
        { key: 'short', label: 'Korte naam (filters, mobiel)', type: 'text', half: true },
        { key: 'accent', label: 'Kleur', type: 'select', options: ACCENTS, half: true },
        { key: 'icon', label: 'Icoon', type: 'icon', half: true }
      ]
    },
    setting: {
      label: 'Teksten', one: 'teksten', single: 'site',
      fields: [
        { key: 'applicationTitle', label: 'Naam van het platform', type: 'text', half: true },
        { key: 'discipline', label: 'Achter de naam (turquoise)', type: 'text', half: true },
        { key: 'tagline', label: 'Slogan onder de titel', type: 'text', placeholder: 'Jij bepaalt de koers, Copilot navigeert mee.' },
        { key: 'applicationSubtitle', label: 'Uitleg onder de slogan op de startpagina', type: 'textarea' },
        { key: 'rules', label: 'Gouden regels (onderaan iedere pagina)', type: 'list', hint: 'Eén regel per regel' }
      ]
    }
  };
  const ORDER = ['usecase', 'prompt', 'tip', 'training', 'agent', 'phase', 'setting'];
  const view = { type: '', status: 'live', query: '' }; // filters in de lijst

  /* ---- Rijen uit de database ------------------------------------------------------- */
  function allRows() {
    return Array.isArray(ns.content.adminRows) ? ns.content.adminRows : [];
  }
  const rowsOf = (type) => allRows().filter((row) => row.type === type).sort((a, b) => (a.position || 0) - (b.position || 0) || (a.id < b.id ? -1 : 1));
  const findRow = (type, id) => allRows().find((row) => row.type === type && row.id === id) || null;
  const isSeeded = () => allRows().some((row) => row.type === 'meta' && row.id === 'bron');

  async function afterChange(message) {
    await ns.app.reloadContent();
    if (message) toast(message, { tone: 'success' });
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  /* ---- Formuliervelden ----------------------------------------------------------- */
  let uid = 0;
  const nextId = () => 'f' + (++uid);

  function labelNode(field, id) {
    return el('label', { className: 'field__label', attrs: { for: id } }, [field.label, field.required ? el('span', { className: 'field__required', text: ' *', attrs: { 'aria-hidden': 'true' } }) : null]);
  }

  function datalist(id, values) {
    return el('datalist', { attrs: { id } }, values.map((value) => el('option', { attrs: { value } })));
  }

  /** Bouwt één veld. Geeft { node, get(), validate() } terug. */
  function control(field, value, ctx) {
    const id = nextId();
    const hint = field.hint ? el('p', { className: 'field__hint', text: field.hint, attrs: { id: id + '-hint' } }) : null;
    const error = el('p', { className: 'field__error', attrs: { id: id + '-error' } });
    const described = [hint ? id + '-hint' : '', id + '-error'].filter(Boolean).join(' ');
    const wrap = (input, extra) => el('div', { className: 'field' + (field.half ? ' field--half' : '') + (field.type === 'code' ? ' field--wide' : '') }, [labelNode(field, id), input, extra || null, hint, error]);
    const setError = (message) => {
      error.textContent = message || '';
      const input = document.getElementById(id);
      if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
      return message || null;
    };
    const requiredCheck = (empty) => (field.required && empty ? setError(field.label + ' is verplicht.') : setError(''));

    switch (field.type) {
      case 'text':
      case 'id':
      case 'path':
      case 'url':
      case 'date': {
        const suggestions = typeof field.suggestions === 'function' ? field.suggestions() : field.suggestions;
        const input = el('input', {
          className: 'field__input' + (field.type === 'id' || field.type === 'path' || field.type === 'url' ? ' field__input--mono' : ''),
          attrs: {
            id, type: field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text', placeholder: field.placeholder || (field.type === 'url' ? 'https://' : null),
            autocomplete: 'off', spellcheck: field.type === 'text' ? null : 'false', 'aria-describedby': described,
            list: suggestions && suggestions.length ? id + '-list' : null
          }
        });
        input.value = value == null ? '' : field.type === 'path' ? String(value).replace(LEGACY_ASSETS, 'assets/') : String(value);
        const node = wrap(input, suggestions && suggestions.length ? datalist(id + '-list', suggestions) : null);
        return {
          node,
          input,
          get: () => input.value.trim(),
          validate: () => {
            const v = input.value.trim();
            if (field.required && !v) return setError(field.label + ' is verplicht.');
            if (field.type === 'id' && !ID_PATTERN.test(v)) return setError('Alleen kleine letters, cijfers en streepjes, bijv. notulen-review.');
            if (field.type === 'id' && ctx.idTaken(v)) return setError('Dit adres bestaat al. Kies een ander.');
            if (field.type === 'path' && v && !LOCAL_PATH.test(v)) return setError('Gebruik een pad naar een bestand op de site (zonder http:// of https://).');
            if (field.type === 'url' && v && !HTTPS_URL.test(v)) return setError('Een link moet met https:// beginnen.');
            if (field.type === 'date' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return setError('Kies een datum.');
            return setError('');
          }
        };
      }
      case 'textarea':
      case 'code':
      case 'list': {
        const input = el('textarea', {
          className: 'field__input field__textarea' + (field.type === 'code' ? ' field__input--mono field__textarea--code' : ''),
          attrs: { id, rows: field.type === 'code' ? '12' : field.type === 'list' ? '5' : '3', spellcheck: field.type === 'code' ? 'false' : null, 'aria-describedby': described }
        });
        input.value = field.type === 'list' ? (Array.isArray(value) ? value.join('\n') : '') : value == null ? '' : String(value);
        return {
          node: wrap(input),
          get: () => (field.type === 'list' ? input.value.split('\n').map((line) => line.trim()).filter(Boolean) : input.value.replace(/\s+$/, '')),
          validate: () => requiredCheck(!input.value.trim())
        };
      }
      case 'select': {
        const options = typeof field.options === 'function' ? field.options() : field.options;
        const input = el('select', { className: 'field__input', attrs: { id, 'aria-describedby': described } },
          (field.required ? [] : options.some((o) => o.value === '') ? [] : [{ value: '', label: '—' }]).concat(options).map((o) => el('option', { attrs: { value: o.value }, text: o.label })));
        input.value = value == null ? '' : String(value);
        if (field.required && !input.value && options[0]) input.value = options[0].value;
        return { node: wrap(input), get: () => input.value, validate: () => requiredCheck(!input.value) };
      }
      case 'license': {
        const labels = field.choices || ['Ook zonder licentie (gratis Copilot Chat)', 'Met Microsoft 365 Copilot-licentie'];
        const input = el('select', { className: 'field__input', attrs: { id, 'aria-describedby': described } }, [
          el('option', { attrs: { value: '' }, text: 'Niets tonen' }),
          el('option', { attrs: { value: 'false' }, text: labels[0] }),
          el('option', { attrs: { value: 'true' }, text: labels[1] })
        ]);
        input.value = value === true ? 'true' : value === false ? 'false' : '';
        return { node: wrap(input), get: () => (input.value === '' ? undefined : input.value === 'true'), validate: () => null };
      }
      case 'bool': {
        const input = el('input', { attrs: { id, type: 'checkbox', checked: value === true } });
        return {
          node: el('div', { className: 'field' }, [el('label', { className: 'check', attrs: { for: id } }, [input, el('span', { text: field.label })]), hint]),
          get: () => (input.checked ? true : undefined),
          validate: () => null
        };
      }
      case 'icon': {
        const names = Array.from(document.querySelectorAll('svg.sprite symbol')).map((symbol) => symbol.id.replace(/^i-/, '')).sort();
        const preview = el('span', { className: 'icon-preview', attrs: { 'aria-hidden': 'true' } }, [icon(value || 'bulb')]);
        const input = el('select', { className: 'field__input', attrs: { id, 'aria-describedby': described } },
          [el('option', { attrs: { value: '' }, text: 'Standaard' })].concat(names.map((name) => el('option', { attrs: { value: name }, text: name }))));
        input.value = value || '';
        input.addEventListener('change', () => ns.ui.setIcon(preview.querySelector('svg'), input.value || 'bulb'));
        return { node: wrap(el('div', { className: 'icon-select' }, [preview, input])), get: () => input.value || undefined, validate: () => null };
      }
      case 'refs': {
        const items = ns.content[REF_LISTS[field.ref]] || [];
        const selected = new Set(Array.isArray(value) ? value : []);
        const boxes = items.map((item) => {
          const boxId = nextId();
          const box = el('input', { attrs: { id: boxId, type: 'checkbox', value: item.id, checked: selected.has(item.id) } });
          return el('label', { className: 'check check--compact', attrs: { for: boxId } }, [box, el('span', { text: (item.title || item.label) + (item.locked ? ' (op slot)' : '') })]);
        });
        if (!boxes.length) boxes.push(el('p', { className: 'field__hint', text: 'Nog niets om te kiezen.' }));
        const group = el('fieldset', { className: 'field field--wide refs' }, [el('legend', { className: 'field__label', text: field.label }), el('div', { className: 'refs__list' }, boxes)]);
        return {
          node: group,
          get: () => {
            const ids = Array.from(group.querySelectorAll('input:checked')).map((box) => box.value);
            return ids.length ? ids : undefined;
          },
          validate: () => null
        };
      }
      case 'object': {
        const sub = field.fields.map((f) => control(f, value ? value[f.key] : '', ctx));
        return {
          node: el('fieldset', { className: 'field field--wide group-box' }, [el('legend', { className: 'field__label', text: field.label }), el('div', { className: 'form-grid' }, sub.map((s) => s.node))]),
          get: () => {
            const result = {};
            field.fields.forEach((f, index) => {
              const v = sub[index].get();
              if (v !== '' && v != null) result[f.key] = v;
            });
            return Object.keys(result).length ? result : undefined;
          },
          validate: () => sub.map((s) => s.validate()).find(Boolean) || null
        };
      }
      case 'group': {
        const listNode = el('div', { className: 'repeater__list' });
        const items = [];
        const groupError = el('p', { className: 'field__error' });
        function renumber() {
          items.forEach((item, index) => {
            item.title.textContent = `${field.itemLabel || 'Item'} ${index + 1}`;
            item.up.disabled = index === 0;
            item.down.disabled = index === items.length - 1;
          });
        }
        function addItem(itemValue) {
          const sub = field.fields.map((f) => control(f, itemValue ? itemValue[f.key] : '', ctx));
          const title = el('span', { className: 'repeater__title' });
          const up = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omhoog' } }, [icon('arrow-up')]);
          const down = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omlaag' } }, [icon('arrow-down')]);
          const remove = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Verwijderen' } }, [icon('trash')]);
          const node = el('div', { className: 'repeater__item' }, [
            el('div', { className: 'repeater__head' }, [title, el('span', { className: 'repeater__actions' }, [up, down, remove])]),
            el('div', { className: 'form-grid' }, sub.map((s) => s.node))
          ]);
          const item = { node, sub, title, up, down };
          up.addEventListener('click', () => move(item, -1));
          down.addEventListener('click', () => move(item, 1));
          remove.addEventListener('click', () => {
            items.splice(items.indexOf(item), 1);
            node.remove();
            renumber();
          });
          items.push(item);
          listNode.append(node);
          renumber();
          return item;
        }
        function move(item, delta) {
          const index = items.indexOf(item);
          const target = index + delta;
          if (target < 0 || target >= items.length) return;
          items.splice(index, 1);
          items.splice(target, 0, item);
          listNode.replaceChildren(...items.map((i) => i.node));
          renumber();
        }
        (Array.isArray(value) ? value : []).forEach((v) => addItem(v));
        if (!items.length && field.min) addItem(null);
        const add = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('message-plus'), el('span', { text: (field.itemLabel || 'Item') + ' toevoegen' })]);
        add.addEventListener('click', () => {
          const item = addItem(null);
          const first = item.node.querySelector('input, textarea, select');
          if (first) first.focus();
        });
        return {
          node: el('fieldset', { className: 'field field--wide repeater' }, [el('legend', { className: 'field__label', text: field.label }), listNode, add, groupError]),
          get: () => {
            const result = items.map((item) => {
              const obj = {};
              field.fields.forEach((f, index) => {
                const v = item.sub[index].get();
                if (v !== '' && v != null) obj[f.key] = v;
              });
              return obj;
            }).filter((obj) => Object.keys(obj).length);
            return result.length ? result : undefined;
          },
          validate: () => {
            const inner = items.map((item) => item.sub.map((s) => s.validate()).find(Boolean)).find(Boolean);
            const tooFew = field.min && items.filter((item) => item.sub.some((s) => s.get())).length < field.min;
            groupError.textContent = tooFew ? `Voeg minimaal ${field.min} toe.` : '';
            return inner || (tooFew ? groupError.textContent : null);
          }
        };
      }
      default:
        return { node: el('p', { text: 'Onbekend veldtype: ' + field.type }), get: () => undefined, validate: () => null };
    }
  }

  /* ---- Formulier voor één item ------------------------------------------------------ */
  function editor(type, id) {
    const schema = SCHEMAS[type];
    const isNew = id === 'nieuw';
    const existing = schema.single ? findRow(type, schema.single) : isNew ? null : findRow(type, id);
    if (!isNew && !schema.single && !existing) {
      return el('div', { className: 'notice notice--warning' }, [icon('alert'), el('div', {}, [
        el('p', { className: 'notice__title', text: 'Niet gevonden' }),
        el('p', { text: `Er is geen ${schema.one} met het adres "${id}".` })
      ])]);
    }
    const data = existing ? Object.assign({}, existing.data, schema.single ? {} : { id: existing.id }) : {};
    let saving = false;

    const ctx = {
      idTaken: (value) => {
        if (existing && value === existing.id) return false;
        if (findRow(type, value)) return true;
        if (type === 'prompt') {
          if (ns.content.usecaseById.has(value)) return true;
          const match = /^(.+)-(\d+)$/.exec(value);
          if (match && ns.content.usecaseById.has(match[1])) return true;
        }
        return false;
      }
    };

    const controls = schema.fields.map((field) => ({ field, ctl: control(field, data[field.key], ctx) }));
    const byKey = (key) => (controls.find((c) => c.field.key === key) || {}).ctl;

    // Nieuw: het adres volgt de titel, tot je het adres zelf aanpast
    const idCtl = byKey('id');
    if (idCtl && isNew) {
      const titleField = schema.fields.find((f) => f.key === 'id').titleKey || 'title';
      const titleCtl = byKey(titleField);
      let touched = false;
      idCtl.input.addEventListener('input', () => {
        touched = true;
      });
      if (titleCtl && titleCtl.input) {
        titleCtl.input.addEventListener('input', () => {
          if (!touched) idCtl.input.value = slugify(titleCtl.input.value);
        });
      }
    }

    const status = existing ? existing.status : 'published';
    const statusId = nextId();
    const statusSelect = el('select', { className: 'field__input', attrs: { id: statusId } }, [
      el('option', { attrs: { value: 'published' }, text: 'Gepubliceerd: zichtbaar voor iedereen' }),
      el('option', { attrs: { value: 'draft' }, text: 'Concept: alleen zichtbaar voor beheerders' })
    ]);
    statusSelect.value = status === 'draft' ? 'draft' : 'published';

    function collect() {
      const result = {};
      controls.forEach(({ field, ctl }) => {
        const v = ctl.get();
        if (field.key === 'id') return;
        if (v === '' || v == null || (Array.isArray(v) && !v.length)) return;
        result[field.key] = v;
      });
      return result;
    }
    const snapshot = () => JSON.stringify([collect(), idCtl ? idCtl.get() : '', statusSelect.value]);
    let initial = '';

    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const save = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
    const cancel = el('a', { className: 'btn btn--secondary', attrs: { href: schema.single ? '#/beheer/inhoud' : `#/beheer/inhoud/${type}` } }, [el('span', { text: schema.single ? 'Terug' : 'Terug naar de lijst' })]);
    const viewLink = existing && schema.route && existing.status !== 'trash'
      ? el('a', { className: 'btn btn--quiet', attrs: { href: `#/${schema.route}/${existing.id}` } }, [icon('eye'), el('span', { text: 'Bekijk op de site' })])
      : null;
    const trash = existing && !schema.single
      ? el('button', { className: 'btn btn--danger', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Naar de prullenbak' })])
      : null;

    const form = el('form', { className: 'cms-form', attrs: { novalidate: true } }, [
      el('div', { className: 'form-grid' }, controls.map((c) => c.ctl.node)),
      schema.single ? null : el('div', { className: 'field field--half' }, [el('label', { className: 'field__label', text: 'Status', attrs: { for: statusId } }), statusSelect]),
      formError,
      el('div', { className: 'cms-form__actions' }, [save, cancel, viewLink, el('span', { className: 'cms-form__spacer' }), trash])
    ]);

    async function onSubmit(event) {
      event.preventDefault();
      formError.hidden = true;
      const firstError = controls.map(({ ctl }) => ctl.validate()).find(Boolean);
      if (firstError) {
        const invalid = form.querySelector('[aria-invalid="true"]');
        if (invalid) invalid.focus();
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Controleer de gemarkeerde velden.' })]));
        formError.hidden = false;
        return;
      }
      const newId = schema.single ? schema.single : idCtl.get();
      const record = collect();
      if (type === 'tip' && record.release && new Date(record.release + 'T12:00:00').getDay() !== 5 &&
        !(await confirm('De datum voor "Tip van de week" is geen vrijdag. Toch opslaan?', { title: 'Geen vrijdag', confirmLabel: 'Toch opslaan' }))) return;
      const renamed = existing && !schema.single && newId !== existing.id;
      if (renamed && !(await confirm(`Het adres verandert van "${existing.id}" naar "${newId}". Links naar het oude adres werken dan niet meer.`, { title: 'Adres wijzigen?', confirmLabel: 'Adres wijzigen' }))) return;
      const position = existing ? existing.position : Math.max(0, ...rowsOf(type).map((row) => row.position || 0)) + 10;
      saving = true;
      save.disabled = true;
      try {
        await ns.central.saveContent([{ type, id: newId, data: record, position, status: schema.single ? 'published' : statusSelect.value }]);
        if (renamed) await ns.central.deleteContent(type, existing.id);
        initial = snapshot();
        const target = schema.single ? '#/beheer/inhoud/setting' : `#/beheer/inhoud/${type}/${newId}`;
        if (window.location.hash !== target) window.history.replaceState(null, '', target);
        await afterChange(isNew ? 'Toegevoegd' : 'Opgeslagen');
      } catch (error) {
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Opslaan mislukt: ' + error.message })]));
        formError.hidden = false;
      } finally {
        saving = false;
        save.disabled = false;
      }
    }
    form.addEventListener('submit', onSubmit);

    if (trash) {
      trash.addEventListener('click', async () => {
        if (type === 'phase' && usageOfPhase(existing.id)) {
          toast(`Deze fase wordt nog gebruikt door ${usageOfPhase(existing.id)} usecase(s), prompt(s) of agent(s). Kies daar eerst een andere fase.`, { tone: 'warning', duration: 6000 });
          return;
        }
        if (!(await confirm(`"${data.title || data.label || existing.id}" gaat naar de prullenbak. Collega's zien hem dan niet meer; je kunt hem terugzetten.`, { title: 'Naar de prullenbak?', confirmLabel: 'Naar de prullenbak', danger: true }))) return;
        try {
          await ns.central.patchContent(type, existing.id, { status: 'trash' });
          initial = snapshot();
          window.location.hash = `#/beheer/inhoud/${type}`;
          await afterChange('In de prullenbak gezet');
        } catch (error) {
          toast('Mislukt: ' + error.message, { tone: 'warning', duration: 6000 });
        }
      });
    }

    const node = el('div', { className: 'cms-editor' }, [
      el('div', { className: 'cms-editor__head' }, [
        el('h2', { className: 'cms-editor__title', text: schema.single ? 'Teksten van de site' : isNew ? schema.add : `${schema.one.charAt(0).toUpperCase() + schema.one.slice(1)} bewerken` }),
        existing && existing.updated_at ? el('p', { className: 'field__hint', text: 'Laatst opgeslagen: ' + new Date(existing.updated_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) }) : null,
        type === 'prompt' ? el('p', { className: 'field__hint', text: SCHEMAS.prompt.note }) : null
      ]),
      warningNotice(schema),
      form
    ]);
    // Na opbouw: beginstand vastleggen (voor 'niet-opgeslagen wijzigingen')
    window.setTimeout(() => {
      initial = snapshot();
    }, 0);
    return { node, canLeave: () => saving || !initial || snapshot() === initial };
  }

  /* ---- Lijst per soort ---------------------------------------------------------------- */
  const STATUS_LABEL = { published: 'Gepubliceerd', draft: 'Concept', trash: 'Prullenbak' };

  function usageOfPhase(phaseId) {
    return allRows().filter((row) => row.status !== 'trash' && row.data && (
      ((row.type === 'usecase' || row.type === 'prompt') && row.data.phase === phaseId) ||
      (row.type === 'agent' && Array.isArray(row.data.phases) && row.data.phases.includes(phaseId))
    )).length;
  }

  function listView(type) {
    const schema = SCHEMAS[type];
    // Andere soort: filters terug naar de standaard
    if (view.type !== type) Object.assign(view, { type, status: 'live', query: '' });
    const listNode = el('div', { className: 'cms-list' });
    const search = el('input', { className: 'field__input field__input--sm cms-toolbar__search', attrs: { type: 'search', placeholder: 'Zoek op titel of adres', 'aria-label': 'Zoeken in ' + schema.label.toLowerCase() } });
    search.value = view.query;
    const statusFilter = el('select', { className: 'field__input field__input--sm', attrs: { 'aria-label': 'Status' } }, [
      el('option', { attrs: { value: 'live' }, text: 'Gepubliceerd en concept' }),
      el('option', { attrs: { value: 'published' }, text: 'Alleen gepubliceerd' }),
      el('option', { attrs: { value: 'draft' }, text: 'Alleen concepten' }),
      el('option', { attrs: { value: 'trash' }, text: 'Prullenbak' })
    ]);
    statusFilter.value = view.status;

    async function act(fn, message) {
      try {
        await fn();
        await afterChange(message);
      } catch (error) {
        toast('Mislukt: ' + error.message, { tone: 'warning', duration: 6000 });
      }
    }

    function render() {
      const query = ns.ui.normalize(view.query);
      const all = rowsOf(type);
      const live = all.filter((row) => row.status !== 'trash');
      let rows = all.filter((row) => (view.status === 'live' ? row.status !== 'trash' : row.status === view.status));
      if (type === 'training') rows = rows.slice().sort((a, b) => ((a.data && a.data.date) < (b.data && b.data.date) ? 1 : -1));
      if (query) rows = rows.filter((row) => ns.ui.normalize([row.id, row.data && (row.data.title || row.data.label)].join(' ')).includes(query));
      const canMove = schema.ordered && view.status === 'live' && !query;

      listNode.replaceChildren(...(rows.length ? rows.map((row) => {
        const data = row.data || {};
        const index = live.indexOf(row);
        const actions = [];
        if (canMove) {
          const up = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omhoog: ' + (data.title || data.label || row.id), disabled: index <= 0 } }, [icon('arrow-up')]);
          const down = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omlaag: ' + (data.title || data.label || row.id), disabled: index >= live.length - 1 } }, [icon('arrow-down')]);
          const swap = (other) => act(async () => {
            // Gelijke posities eerst uit elkaar trekken, dan wisselen
            const a = row.position || 0;
            let b = other.position || 0;
            if (a === b) b = a + (live.indexOf(other) > index ? 1 : -1);
            await ns.central.patchContent(type, row.id, { position: b });
            await ns.central.patchContent(type, other.id, { position: a });
          });
          up.addEventListener('click', () => swap(live[index - 1]));
          down.addEventListener('click', () => swap(live[index + 1]));
          actions.push(up, down);
        }
        if (row.status === 'trash') {
          const restore = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Terugzetten' })]);
          restore.addEventListener('click', () => act(() => ns.central.patchContent(type, row.id, { status: 'draft' }), 'Teruggezet als concept'));
          const destroy = el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Definitief verwijderen' })]);
          destroy.addEventListener('click', async () => {
            if (!(await confirm(`"${data.title || data.label || row.id}" wordt definitief verwijderd. Herstellen kan dan alleen nog via de geschiedenis in Supabase.`, { title: 'Definitief verwijderen?', confirmLabel: 'Definitief verwijderen', danger: true }))) return;
            act(() => ns.central.deleteContent(type, row.id), 'Definitief verwijderd');
          });
          actions.push(restore, destroy);
        } else {
          actions.push(el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: `#/beheer/inhoud/${type}/${row.id}` } }, [icon('pencil-line'), el('span', { text: 'Bewerken' })]));
          if (schema.route) actions.push(el('a', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { href: `#/${schema.route}/${row.id}`, 'aria-label': 'Bekijk op de site: ' + (data.title || row.id), title: 'Bekijk op de site' } }, [icon('eye')]));
          const toTrash = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Naar de prullenbak: ' + (data.title || data.label || row.id), title: 'Naar de prullenbak' } }, [icon('trash')]);
          toTrash.addEventListener('click', async () => {
            if (type === 'phase' && usageOfPhase(row.id)) {
              toast(`Deze fase wordt nog gebruikt door ${usageOfPhase(row.id)} usecase(s), prompt(s) of agent(s). Kies daar eerst een andere fase.`, { tone: 'warning', duration: 6000 });
              return;
            }
            if (!(await confirm(`"${data.title || data.label || row.id}" gaat naar de prullenbak. Collega's zien hem dan niet meer; je kunt hem terugzetten.`, { title: 'Naar de prullenbak?', confirmLabel: 'Naar de prullenbak', danger: true }))) return;
            act(() => ns.central.patchContent(type, row.id, { status: 'trash' }), 'In de prullenbak gezet');
          });
          actions.push(toTrash);
        }
        return el('div', { className: 'cms-row' + (row.status === 'draft' ? ' cms-row--draft' : '') }, [
          el('div', { className: 'cms-row__main' }, [
            el('a', { className: 'cms-row__title', attrs: { href: row.status === 'trash' ? null : `#/beheer/inhoud/${type}/${row.id}` }, text: data.title || data.label || row.id }),
            el('p', { className: 'cms-row__meta' }, [
              el('code', { text: row.id }),
              schema.meta && schema.meta(data) ? ' · ' + schema.meta(data) : '',
              row.updated_at ? ' · ' + formatDate(row.updated_at) : ''
            ])
          ]),
          el('span', { className: 'status status--' + (row.status === 'published' ? 'success' : row.status === 'draft' ? 'info' : 'muted'), text: STATUS_LABEL[row.status] || row.status }),
          el('div', { className: 'cms-row__actions' }, actions)
        ]);
      }) : [el('p', { className: 'section__lead', text: view.status === 'trash' ? 'De prullenbak is leeg.' : 'Niets gevonden.' })]));
    }

    let timer = 0;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        view.query = search.value;
        render();
      }, 120);
    });
    statusFilter.addEventListener('change', () => {
      view.status = statusFilter.value;
      render();
    });
    render();

    return el('div', { className: 'cms-listview' }, [
      el('div', { className: 'cms-toolbar' }, [
        search,
        statusFilter,
        el('a', { className: 'btn btn--primary btn--sm', attrs: { href: `#/beheer/inhoud/${type}/nieuw` } }, [icon('message-plus'), el('span', { text: schema.add })])
      ]),
      schema.note ? el('p', { className: 'field__hint', text: schema.note }) : null,
      warningNotice(schema),
      listNode
    ]);
  }

  /** Waarschuwing bij een soort (bijv. agents: de site is openbaar). */
  function warningNotice(schema) {
    return schema.warning ? el('div', { className: 'notice notice--warning' }, [icon('alert'), el('div', {}, [el('p', { text: schema.warning })])]) : null;
  }

  /* ---- Overzetten, exporteren en importeren -------------------------------------------- */
  function seedPanel(status) {
    if (status === 'missing') {
      return el('div', { className: 'notice notice--warning' }, [icon('alert'), el('div', {}, [
        el('p', { className: 'notice__title', text: 'De tabel voor de inhoud ontbreekt nog' }),
        el('p', { text: 'Voer setup/supabase-audit.sql (opnieuw) uit in Supabase. Daarna kun je de inhoud hier overzetten en beheren.' })
      ])]);
    }
    const rows = ns.content.toRows();
    const counts = ['usecase', 'prompt', 'tip', 'training', 'agent', 'phase'].map((type) => `${rows.filter((r) => r.type === type).length} ${SCHEMAS[type].many}`).join(', ');
    const button = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('download'), el('span', { text: 'Overzetten naar de database' })]);
    button.addEventListener('click', async () => {
      if (!(await confirm('Alle inhoud uit de bestanden wordt in de database gezet. Vanaf dan pas je alles hier aan en tonen alle collega\'s de inhoud uit de database.', { title: 'Inhoud overzetten?', confirmLabel: 'Overzetten' }))) return;
      button.disabled = true;
      button.querySelector('span').textContent = 'Bezig met overzetten…';
      try {
        await ns.central.saveContent(rows);
        await afterChange('Overgezet: de database is nu leidend');
      } catch (error) {
        button.disabled = false;
        button.querySelector('span').textContent = 'Overzetten naar de database';
        toast('Overzetten mislukt: ' + error.message, { tone: 'warning', duration: 8000 });
      }
    });
    return el('div', { className: 'notice notice--cta seed' }, [
      icon('info'),
      el('div', {}, [
        el('p', { className: 'notice__title', text: 'De inhoud staat nog in de bestanden' }),
        el('p', { text: `Zet hem eenmalig over naar de database (${counts}). Daarna pas je alles hier aan, voeg je toe en verwijder je, zonder bestanden te bewerken.` })
      ]),
      button
    ]);
  }

  /**
   * De database is al leidend, dus 'Overzetten' draait niet opnieuw. Heeft een soort in de
   * bestanden wél items en in de database nog geen enkele rij (ook niet in de prullenbak),
   * bijvoorbeeld net na het toevoegen van agents, dan bied je aan die items toe te voegen.
   */
  function missingTypePanels() {
    const fileRows = ns.content.toRows();
    return ns.content.TYPES.filter((type) => SCHEMAS[type] && !rowsOf(type).length).map((type) => {
      const rows = fileRows.filter((row) => row.type === type);
      if (!rows.length) return null;
      const schema = SCHEMAS[type];
      const what = `${rows.length} ${rows.length === 1 ? schema.one : schema.many}`;
      const label = `${what} uit de bestanden toevoegen`;
      const button = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('download'), el('span', { text: label })]);
      button.addEventListener('click', async () => {
        if (!(await confirm(`De ${what} uit de bestanden (data/) komen in de database en zijn direct zichtbaar voor alle collega's. Daarna pas je ze hier aan, zet je ze op concept of in de prullenbak.`, { title: `${schema.label} toevoegen?`, confirmLabel: 'Toevoegen' }))) return;
        button.disabled = true;
        button.querySelector('span').textContent = 'Bezig met toevoegen…';
        try {
          await ns.central.saveContent(rows);
          await afterChange(`${what} toegevoegd`);
        } catch (error) {
          button.disabled = false;
          button.querySelector('span').textContent = label;
          toast('Toevoegen mislukt: ' + error.message, { tone: 'warning', duration: 8000 });
        }
      });
      return el('div', { className: 'notice notice--cta seed' }, [
        icon('info'),
        el('div', {}, [
          el('p', { className: 'notice__title', text: `Nieuw in de bestanden: ${schema.label.toLowerCase()}` }),
          el('p', { text: `In de bestanden staan ${what} die nog niet in de database staan. Voeg ze eenmalig toe; daarna beheer je ze hier.` })
        ]),
        button
      ]);
    }).filter(Boolean);
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = el('a', { attrs: { href: url, download: name } });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function backupTools() {
    const exportButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('download'), el('span', { text: 'Exporteer alles (JSON)' })]);
    exportButton.addEventListener('click', () => {
      const rows = allRows().map(({ type, id, data, position, status, updated_at: updatedAt }) => ({ type, id, data, position, status, updated_at: updatedAt }));
      download(`ai-cockpit-audit-inhoud-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported_at: new Date().toISOString(), rows }, null, 2));
    });
    const fileInput = el('input', { className: 'sr-only', attrs: { type: 'file', accept: 'application/json,.json', tabindex: '-1' } });
    const importButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Importeer back-up' })]);
    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const rows = (Array.isArray(parsed) ? parsed : parsed.rows || []).filter((row) =>
          row && ['meta', 'setting'].concat(ns.content.TYPES).includes(row.type) && ID_PATTERN.test(row.id) && row.data && typeof row.data === 'object');
        if (!rows.length) throw new Error('geen bruikbare inhoud in dit bestand');
        if (!(await confirm(`${rows.length} items uit de back-up worden teruggezet. Items met hetzelfde adres worden overschreven; andere items blijven staan.`, { title: 'Back-up terugzetten?', confirmLabel: 'Terugzetten' }))) return;
        await ns.central.saveContent(rows.map((row) => ({ type: row.type, id: row.id, data: row.data, position: row.position || 0, status: ['published', 'draft', 'trash'].includes(row.status) ? row.status : 'draft' })));
        await afterChange('Back-up teruggezet');
      } catch (error) {
        toast('Importeren mislukt: ' + error.message, { tone: 'warning', duration: 6000 });
      }
    });
    return el('div', { className: 'cms-backup' }, [exportButton, importButton, fileInput]);
  }

  /* ---- Pagina ------------------------------------------------------------------------- */
  /**
   * @param {string[]} params  [soort, id] uit het adres
   * @param {object} state     { status } van het laatste ophalen
   */
  function render(params, state) {
    const type = SCHEMAS[params[0]] ? params[0] : 'usecase';
    const seeded = isSeeded();
    const tabs = el('nav', { className: 'toggles cms-tabs', attrs: { 'aria-label': 'Soort inhoud' } }, ORDER.map((key) => {
      const count = SCHEMAS[key].single ? null : rowsOf(key).filter((row) => row.status !== 'trash').length;
      return el('a', { className: 'toggle', attrs: { href: `#/beheer/inhoud/${key}`, 'aria-current': key === type ? 'page' : null } }, [
        el('span', { text: SCHEMAS[key].label }),
        count != null && seeded ? el('span', { className: 'toggle__count', text: String(count) }) : null
      ]);
    }));

    if (!seeded) {
      return { node: el('div', { className: 'cms' }, [seedPanel(state && state.status)]), canLeave: null };
    }

    let body;
    let canLeave = null;
    const editing = Boolean(SCHEMAS[type].single || params[1]);
    if (editing) {
      const result = editor(type, SCHEMAS[type].single ? SCHEMAS[type].single : params[1]);
      body = result.node || result;
      canLeave = result.canLeave || null;
    } else {
      body = listView(type);
    }
    return {
      node: el('div', { className: 'cms' }, [
        ...(editing ? [] : missingTypePanels()),
        el('div', { className: 'cms__bar' }, [tabs, backupTools()]),
        body
      ]),
      canLeave
    };
  }

  ns.adminContent = { render, SCHEMAS };
})(window.AIAudit);
