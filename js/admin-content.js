/* ==========================================================================
   Beheer → Inhoud en Gedeelde basis
   (#/beheer/inhoud/<soort>/<id|nieuw> en #/beheer/basis/<soort>/<id|nieuw>)
   --------------------------------------------------------------------------
   Alle inhoud aanpassen, toevoegen en verwijderen: usecases, prompts, tips,
   trainingen, agents & tools, fasen en de teksten van de site. Alles staat in
   de tabel audit_content in Supabase (zie setup/supabase-audit.sql).

   Twee omgevingen (scope):
   - Inhoud: de eigen inhoud van de discipline waarin je zit (naamruimte
     'ai-<id>'). Wissel van discipline bovenaan Beheer.
   - Gedeelde basis: wat in de cockpit van iedere discipline staat
     ('ai-algemeen'). Eenmalig inrichten vanuit Audit: je kiest welke items
     daarheen verhuizen.

   - Eerste keer (Audit): 'Overzetten' zet de bestanden uit data/ in de database.
     Daarna is de database leidend en zijn de bestanden alleen nog terugval.
   - Een nieuwe discipline begint leeg of met voorbeeldinhoud (data/voorbeelden/).
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

  // Omgeving waarin je werkt (zie render): { kind: 'discipline'|'basis', namespace, base, name, id, files }
  let scope = { kind: 'discipline', namespace: '', base: '#/beheer/inhoud', name: '', id: '', files: true };

  // In de gedeelde basis alleen de gedeelde fasen: die bestaan in iedere cockpit
  const phaseOptions = () => ns.content.phases.filter((phase) => scope.kind !== 'basis' || phase.shared).map((phase) => ({ value: phase.id, label: phase.label }));
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
        { key: 'why', label: 'Waarom handig in de praktijk', type: 'textarea' },
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
        { key: 'added', label: 'Toegevoegd op', type: 'date', hint: 'Leeg = de datum van de training.' },
        // Naslagwerk (allemaal optioneel; uitleg per veld in data/trainings.js)
        { key: '_naslag', label: 'Naslagwerk', type: 'heading', hint: 'Alles hieronder is optioneel. Afbeeldingen van slides kun je hier niet uploaden: zet ze via de repository in assets/trainingen/<adres van de training>/ (zie README.md) en vul hier het pad in. De site is openbaar bereikbaar: geen interne of klantinformatie, geen namen van deelnemers.' },
        { key: 'slides', label: 'Slides', type: 'group', itemLabel: 'Slide', fields: [
          { key: 'image', label: 'Afbeelding', type: 'path', placeholder: 'assets/trainingen/…/slide-01.jpg', half: true },
          { key: 'title', label: 'Titel', type: 'text', half: true }
        ] },
        { key: 'takeaways', label: 'Wat je meeneemt (3 tot 5 kaarten)', type: 'group', itemLabel: 'Kaart', fields: [
          { key: 'title', label: 'Kop', type: 'text' },
          { key: 'text', label: 'Tekst', type: 'textarea' },
          { key: 'warning', label: 'Waarschuwing (rode kaart met een uitroepteken)', type: 'bool' }
        ] },
        { key: 'actions', label: 'Aan de slag (afvinklijst)', type: 'group', itemLabel: 'Actie', fields: [
          { key: 'title', label: 'Kop', type: 'text', hint: 'Het vinkje van een collega hoort bij deze kop: pas hem na publiceren liever niet meer aan.' },
          { key: 'text', label: 'Tekst', type: 'textarea' },
          { key: 'slide', label: 'Link naar slide (nummer)', type: 'text', placeholder: 'bijv. 14', half: true, hint: 'De hoeveelste slide in de lijst hierboven.' },
          { key: 'more', label: 'Kop van het uitklapblok', type: 'text', placeholder: 'Zo pak je het aan', half: true, hint: 'Boven de stappen en prompts.' },
          { key: 'howto', label: 'Stappen', type: 'group', itemLabel: 'Stappenlijst', fields: [
            { key: 'title', label: 'Kop', type: 'text', placeholder: 'bijv. Direct instellen' },
            { key: 'steps', label: 'Stappen', type: 'list', hint: 'Eén stap per regel' }
          ] },
          { key: 'note', label: 'Kleine letters onder de stappen', type: 'textarea' },
          { key: 'prompts', label: 'Prompts en sjablonen', type: 'group', itemLabel: 'Prompt', fields: [
            { key: 'label', label: 'Kop', type: 'text', placeholder: 'bijv. Sjabloon voor je persoonlijke instructies' },
            { key: 'text', label: 'Tekst', type: 'code', hint: 'Plaatshouders in hoofdletters tussen blokhaken: [NAAM], [TEAM, bijv. audit]' }
          ] }
        ] },
        { key: 'ideas', label: 'Uit de zaal: ideeën', type: 'group', itemLabel: 'Idee', fields: [
          { key: 'title', label: 'Kop', type: 'text' },
          { key: 'text', label: 'Tekst', type: 'textarea' }
        ] },
        { key: 'questions', label: 'Uit de zaal: open vragen', type: 'list', hint: 'Eén vraag per regel' },
        { key: 'timelineIntro', label: 'Vervolg: inleiding', type: 'textarea', hint: 'Bijv. hoe vaak de reeks terugkomt.' },
        { key: 'timeline', label: 'Vervolg: tijdlijn', type: 'group', itemLabel: 'Sessie', fields: [
          { key: 'month', label: 'Maand', type: 'text', placeholder: 'bijv. December', half: true },
          { key: 'title', label: 'Titel', type: 'text', half: true },
          { key: 'text', label: 'Tekst', type: 'text' },
          { key: 'training', label: 'Link naar de training', type: 'select', options: () => ns.content.trainings.map((t) => ({ value: t.id, label: t.title })), half: true },
          { key: 'current', label: 'Dit is deze training', type: 'bool' }
        ] }
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
        { key: 'phases', label: 'Fasen', type: 'refs', ref: 'phase' },
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
      note: 'De naam van de discipline (turquoise, achter de naam) pas je aan bij Beheer → Disciplines. Leeg = de tekst uit de gedeelde basis of uit js/config.js.',
      fields: [
        { key: 'applicationTitle', label: 'Naam van het platform', type: 'text', half: true },
        { key: 'tagline', label: 'Slogan onder de titel', type: 'text', placeholder: 'Jij bepaalt de koers, Copilot navigeert mee.' },
        { key: 'applicationSubtitle', label: 'Uitleg onder de slogan op de startpagina', type: 'textarea' },
        { key: 'rules', label: 'Gouden regels (onderaan iedere pagina)', type: 'list', hint: 'Eén regel per regel' }
      ]
    }
  };
  const ORDER = ['usecase', 'prompt', 'tip', 'training', 'agent', 'phase', 'setting'];
  const view = { type: '', status: 'live', query: '' }; // filters in de lijst

  /* ---- Rijen uit de database ------------------------------------------------------- */
  // Alle opgehaalde rijen: de eigen inhoud van deze cockpit én de gedeelde basis
  const everywhere = () => (Array.isArray(ns.content.adminRows) ? ns.content.adminRows : []);
  // Alleen de rijen van de omgeving waarin je werkt
  function allRows() {
    return everywhere().filter((row) => row.namespace === scope.namespace);
  }
  const rowsOf = (type) => allRows().filter((row) => row.type === type).sort((a, b) => (a.position || 0) - (b.position || 0) || (a.id < b.id ? -1 : 1));
  const findRow = (type, id) => allRows().find((row) => row.type === type && row.id === id) || null;
  const isSeeded = () => allRows().some((row) => row.type === 'meta' && row.id === 'bron');

  async function afterChange(message) {
    await ns.app.reloadContent();
    if (message) toast(message, { tone: 'success' });
  }

  /* ---- Werkversies (js/editor.js) ------------------------------------------------------ */
  // Met stap 7 slaat Opslaan een werkversie op; Publiceren zet hem live. Zonder: direct live, zoals vroeger.
  const drafting = () => ns.editor.available();
  const may = (action, type) => !drafting() || ns.rights.can(action, scope.namespace, type);
  /** De stand die je bewerkt: de opgeslagen werkversie als die er is, anders de gepubliceerde. */
  const stateOf = (row) => (drafting() ? ns.editor.savedState(row) : { data: row.data || {}, position: row.position || 0, status: row.status });
  const draftLabel = (row) => (!row.draft ? '' : row.draft.status === 'trash' ? 'Wordt verwijderd' : row.publish_at ? 'Gepland' : row.draft_kind === 'voorstel' ? 'Voorstel' : row.status === 'draft' ? 'Nieuw' : 'Gewijzigd');

  /** Werkversie opslaan voor één item in deze omgeving. */
  function stage(type, id, data, position, status) {
    return ns.editor.saveOne({ namespace: scope.namespace, type, id, draft: { data, position: position || 0, status: status || 'published' } });
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

  // Leeg veld (ook een lege lijst): niet bewaren
  const isEmpty = (value) => value === '' || value == null || (Array.isArray(value) && !value.length);

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
              if (!isEmpty(v)) result[f.key] = v;
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
            const name = `${field.itemLabel || 'Item'} ${index + 1}`;
            item.title.textContent = name;
            item.up.disabled = index === 0;
            item.down.disabled = index === items.length - 1;
            // Met naam, want binnen een groep kunnen weer groepen staan (bijv. prompts bij een actie)
            item.up.setAttribute('aria-label', name + ' omhoog');
            item.down.setAttribute('aria-label', name + ' omlaag');
            item.remove.setAttribute('aria-label', name + ' verwijderen');
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
          const item = { node, sub, title, up, down, remove };
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
                if (!isEmpty(v)) obj[f.key] = v;
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
      case 'heading': {
        // Tussenkop in het formulier (geen veld: er wordt niets bewaard)
        return {
          node: el('div', { className: 'field form-section' }, [el('h3', { className: 'form-section__title', text: field.label }), field.hint ? el('p', { className: 'field__hint', text: field.hint }) : null]),
          get: () => undefined,
          validate: () => null
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
    const data = existing ? Object.assign({}, stateOf(existing).data, schema.single ? {} : { id: existing.id }) : {};
    const canEdit = may('bewerken', type);
    const canDelete = may('verwijderen', type);
    const canPublish = drafting() && ns.rights.can('publiceren', scope.namespace, type);
    let saving = false;
    let publishAfterSave = false;

    const ctx = {
      idTaken: (value) => {
        if (existing && value === existing.id) return false;
        // Ook niet hetzelfde adres als een item in de andere omgeving (basis of discipline)
        if (everywhere().some((row) => row.type === type && row.id === value)) return true;
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
        if (isEmpty(v)) return;
        result[field.key] = v;
      });
      return result;
    }
    const snapshot = () => JSON.stringify([collect(), idCtl ? idCtl.get() : '', statusSelect.value]);
    let initial = '';

    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const save = el('button', { className: drafting() && canPublish ? 'btn btn--secondary' : 'btn btn--primary', attrs: { type: 'submit', disabled: !canEdit } }, [icon('check'), el('span', { text: drafting() ? (canPublish ? 'Opslaan' : 'Opslaan als voorstel') : 'Opslaan' })]);
    const saveAndPublish = canPublish ? el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('send'), el('span', { text: 'Opslaan en publiceren' })]) : null;
    const cancel = el('a', { className: 'btn btn--secondary', attrs: { href: schema.single ? scope.base : `${scope.base}/${type}` } }, [el('span', { text: schema.single ? 'Terug' : 'Terug naar de lijst' })]);
    const viewLink = existing && schema.route && existing.status !== 'trash'
      ? el('a', { className: 'btn btn--quiet', attrs: { href: `#/${schema.route}/${existing.id}` } }, [icon('eye'), el('span', { text: 'Bekijk op de site' })])
      : null;
    const trash = existing && !schema.single && canDelete && existing.status !== 'trash'
      ? el('button', { className: 'btn btn--danger', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: drafting() ? 'Verwijderen' : 'Naar de prullenbak' })])
      : null;

    const form = el('form', { className: 'cms-form', attrs: { novalidate: true } }, [
      el('div', { className: 'form-grid' }, controls.map((c) => c.ctl.node)),
      // Met werkversies regelt Publiceren wat live staat; zonder kies je hier de status
      schema.single || drafting() ? null : el('div', { className: 'field field--half' }, [el('label', { className: 'field__label', text: 'Status', attrs: { for: statusId } }), statusSelect]),
      formError,
      el('div', { className: 'cms-form__actions' }, [saveAndPublish, save, cancel, viewLink, el('span', { className: 'cms-form__spacer' }), trash])
    ]);
    if (saveAndPublish) {
      saveAndPublish.addEventListener('click', () => {
        publishAfterSave = true;
        form.requestSubmit();
      });
    }
    if (!canEdit) form.querySelectorAll('input, textarea, select, button[type="button"]').forEach((input) => { input.disabled = true; });

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
      const position = existing ? stateOf(existing).position : Math.max(0, ...rowsOf(type).map((row) => row.position || 0)) + 10;
      const publishNow = publishAfterSave;
      publishAfterSave = false;
      if (drafting() && renamed && !canDelete) {
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Het adres wijzigen kan alleen iemand die ook mag verwijderen. Laat het adres staan.' })]));
        formError.hidden = false;
        return;
      }
      saving = true;
      save.disabled = true;
      try {
        if (drafting()) {
          // Werkversie: pas live na publiceren
          if (!(await stage(type, newId, record, position, 'published'))) return;
          if (renamed) await stage(type, existing.id, existing.data, existing.position, 'trash');
          if (publishNow) {
            const items = [{ namespace: scope.namespace, type, id: newId }].concat(renamed ? [{ namespace: scope.namespace, type, id: existing.id }] : []);
            await ns.editor.publish(items);
          }
        } else {
          await ns.central.saveContent([{ type, id: newId, data: record, position, status: schema.single ? 'published' : statusSelect.value }], scope.namespace);
          if (renamed) await ns.central.deleteContent(type, existing.id, scope.namespace);
        }
        initial = snapshot();
        const target = schema.single ? `${scope.base}/setting` : `${scope.base}/${type}/${newId}`;
        if (window.location.hash !== target) window.history.replaceState(window.history.state, '', target);
        if (drafting() && publishNow) await ns.app.reloadContent();
        else await afterChange(drafting() ? (canPublish ? 'Opgeslagen. Nog niet live: publiceer via de bewerkbalk.' : 'Voorstel opgeslagen. Een beheerder publiceert het.') : isNew ? 'Toegevoegd' : 'Opgeslagen');
      } catch (error) {
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Opslaan mislukt: ' + error.message })]));
        formError.hidden = false;
      } finally {
        saving = false;
        save.disabled = !canEdit;
      }
    }
    form.addEventListener('submit', onSubmit);

    if (trash) {
      trash.addEventListener('click', async () => {
        if (type === 'phase' && usageOfPhase(existing.id)) {
          toast(`Deze fase wordt nog gebruikt door ${usageOfPhase(existing.id)} usecase(s), prompt(s) of agent(s). Kies daar eerst een andere fase.`, { tone: 'warning', duration: 6000 });
          return;
        }
        if (drafting()) {
          if (!(await confirm(`"${data.title || data.label || existing.id}" wordt verwijderd zodra je publiceert. Tot die tijd zien collega's hem nog.`, { title: 'Verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
        } else if (!(await confirm(`"${data.title || data.label || existing.id}" gaat naar de prullenbak. Collega's zien hem dan niet meer; je kunt hem terugzetten.`, { title: 'Naar de prullenbak?', confirmLabel: 'Naar de prullenbak', danger: true }))) return;
        try {
          if (drafting()) {
            const current = stateOf(existing);
            await stage(type, existing.id, current.data, current.position, 'trash');
          } else await ns.central.patchContent(type, existing.id, { status: 'trash' }, scope.namespace);
          initial = snapshot();
          window.location.hash = `${scope.base}/${type}`;
          await afterChange(drafting() ? 'Klaar om te verwijderen: publiceer via de bewerkbalk' : 'In de prullenbak gezet');
        } catch (error) {
          toast('Mislukt: ' + error.message, { tone: 'warning', duration: 6000 });
        }
      });
    }

    const stamp = (value) => new Date(value).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
    const draftNotice = existing && existing.draft && drafting()
      ? el('div', { className: 'notice' }, [icon('pencil-line'), el('div', {}, [
        el('p', { className: 'notice__title', text: `${draftLabel(existing)}: opgeslagen, nog niet live` }),
        el('p', { text: `Door ${existing.draft_by || 'onbekend'} op ${stamp(existing.draft_at)}${existing.publish_at ? `, gepland voor ${stamp(existing.publish_at)}` : ''}. Hieronder staat die versie; collega's zien nog de gepubliceerde. Publiceren of weggooien doe je via Publiceren in de bewerkbalk.` })
      ])])
      : null;
    const node = el('div', { className: 'cms-editor' }, [
      el('div', { className: 'cms-editor__head' }, [
        el('h2', { className: 'cms-editor__title', text: schema.single ? 'Teksten van de site' : isNew ? schema.add : `${schema.one.charAt(0).toUpperCase() + schema.one.slice(1)} bewerken` }),
        existing && existing.updated_at ? el('p', { className: 'field__hint', text: 'Laatst gepubliceerd: ' + stamp(existing.updated_at) + (existing.updated_by ? ' door ' + existing.updated_by : '') }) : null,
        type === 'prompt' || schema.single ? el('p', { className: 'field__hint', text: schema.note }) : null
      ]),
      !canEdit ? el('div', { className: 'notice notice--warning' }, [icon('lock'), el('div', {}, [el('p', { text: 'Je mag dit onderdeel bekijken, maar niet bewerken. Vraag een hoofdbeheerder om meer rechten.' })])]) : null,
      draftNotice,
      warningNotice(schema),
      form
    ]);
    // Melding als een andere beheerder dit item ook open heeft
    if (existing && drafting()) ns.editor.watch(scope.namespace, type, existing.id, node);
    // Na opbouw: beginstand vastleggen (voor 'niet-opgeslagen wijzigingen')
    window.setTimeout(() => {
      initial = snapshot();
    }, 0);
    return { node, canLeave: () => saving || !initial || snapshot() === initial };
  }

  /* ---- Zijpaneel in de bewerkmodus (js/editmode.js) ------------------------------------------ */
  /**
   * Hetzelfde formulier als in Beheer, maar Toepassen zet de wijziging klaar (niet opgeslagen):
   * je ziet hem meteen op de pagina en slaat op met Opslaan in de bewerkbalk.
   * id leeg = nieuw item. onClose(): het paneel sluiten.
   */
  function quickForm(type, namespace, id, onClose) {
    const schema = SCHEMAS[type];
    const general = namespace === ns.cockpit.GENERAL_NAMESPACE;
    const discipline = ns.cockpit.active();
    scope = general
      ? { kind: 'basis', namespace, base: '#/beheer/basis', name: 'de gedeelde basis', id: 'algemeen', files: false }
      : { kind: 'discipline', namespace, base: '#/beheer/inhoud', name: discipline.name, id: discipline.id, files: false };
    const isNew = !id;
    const current = isNew ? null : ns.editor.effective(namespace, type, id);
    const data = current ? Object.assign({}, current.data, schema.single ? {} : { id }) : {};
    const ctx = {
      idTaken: (value) => {
        if (!isNew && value === id) return false;
        if (ns.editor.effective(namespace, type, value)) return true;
        if (everywhere().some((row) => row.type === type && row.id === value)) return true;
        if (type === 'prompt' && ns.content.usecaseById.has(value.replace(/-\d+$/, ''))) return true;
        return false;
      }
    };
    const controls = schema.fields.map((field) => ({ field, ctl: control(field, data[field.key], ctx) }));
    const byKey = (key) => (controls.find((c) => c.field.key === key) || {}).ctl;
    const idCtl = byKey('id');
    if (idCtl && isNew) {
      const titleCtl = byKey(schema.fields.find((f) => f.key === 'id').titleKey || 'title');
      let touched = false;
      idCtl.input.addEventListener('input', () => {
        touched = true;
      });
      if (titleCtl && titleCtl.input) titleCtl.input.addEventListener('input', () => {
        if (!touched) idCtl.input.value = slugify(titleCtl.input.value);
      });
    }
    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const apply = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('check'), el('span', { text: 'Toepassen' })]);
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Annuleren' })]);
    cancel.addEventListener('click', onClose);
    const form = el('form', { className: 'cms-form cms-form--panel', attrs: { novalidate: true } }, [
      el('p', { className: 'field__hint', text: 'Toepassen zet je wijziging klaar op de pagina. Sla daarna op met Opslaan in de bewerkbalk; collega\'s zien het pas na Publiceren.' }),
      el('div', { className: 'form-grid' }, controls.map((c) => c.ctl.node)),
      formError,
      el('div', { className: 'cms-form__actions' }, [apply, cancel])
    ]);
    form.addEventListener('submit', (event) => {
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
      const record = {};
      controls.forEach(({ field, ctl }) => {
        const v = ctl.get();
        if (field.key !== 'id' && !isEmpty(v)) record[field.key] = v;
      });
      const newId = schema.single ? schema.single : idCtl.get();
      const renamed = !isNew && !schema.single && newId !== id;
      if (renamed && !ns.rights.can('verwijderen', namespace, type)) {
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Het adres wijzigen kan alleen iemand die ook mag verwijderen. Laat het adres staan.' })]));
        formError.hidden = false;
        return;
      }
      const position = current ? current.position : Math.max(0, ...rowsOf(type).map((row) => ns.editor.savedState(row).position || 0)) + 10;
      if (renamed) ns.editor.change(namespace, type, id, { status: 'trash' });
      ns.editor.change(namespace, type, newId, { data: record, position, status: 'published' });
      onClose();
      toast(isNew ? 'Toegevoegd op de pagina. Vergeet niet op te slaan.' : 'Toegepast. Vergeet niet op te slaan.', { duration: 5000 });
    });
    const node = el('div', { className: 'cms-editor cms-editor--panel' }, [warningNotice(schema), form]);
    if (!isNew) ns.editor.watch(namespace, type, id, node);
    return node;
  }

  /* ---- Lijst per soort ---------------------------------------------------------------- */
  const STATUS_LABEL = { published: 'Gepubliceerd', draft: 'Concept', trash: 'Prullenbak' };

  // Over beide omgevingen: ook items van de discipline kunnen een gedeelde fase gebruiken
  function usageOfPhase(phaseId) {
    return everywhere().filter((row) => row.status !== 'trash' && row.data && (
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
        const data = stateOf(row).data || {};
        const index = live.indexOf(row);
        const actions = [];
        if (canMove && may('bewerken', type)) {
          const up = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omhoog: ' + (data.title || data.label || row.id), disabled: index <= 0 } }, [icon('arrow-up')]);
          const down = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Omlaag: ' + (data.title || data.label || row.id), disabled: index >= live.length - 1 } }, [icon('arrow-down')]);
          const swap = (other) => act(async () => {
            // Gelijke posities eerst uit elkaar trekken, dan wisselen
            const a = stateOf(row).position || 0;
            let b = stateOf(other).position || 0;
            if (a === b) b = a + (live.indexOf(other) > index ? 1 : -1);
            if (drafting()) {
              await stage(type, row.id, stateOf(row).data, b, stateOf(row).status);
              await stage(type, other.id, stateOf(other).data, a, stateOf(other).status);
            } else {
              await ns.central.patchContent(type, row.id, { position: b }, scope.namespace);
              await ns.central.patchContent(type, other.id, { position: a }, scope.namespace);
            }
          });
          up.addEventListener('click', () => swap(live[index - 1]));
          down.addEventListener('click', () => swap(live[index + 1]));
          actions.push(up, down);
        }
        if (row.status === 'trash') {
          if (may('bewerken', type)) {
            const restore = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Terugzetten' })]);
            restore.addEventListener('click', () => act(
              () => (drafting() ? stage(type, row.id, row.data, row.position, 'published') : ns.central.patchContent(type, row.id, { status: 'draft' }, scope.namespace)),
              drafting() ? 'Teruggezet: publiceer om hem weer live te zetten' : 'Teruggezet als concept'
            ));
            actions.push(restore);
          }
          // Definitief verwijderen: alleen een hoofdbeheerder
          if (!drafting() || ns.rights.isOwner()) {
            const destroy = el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Definitief verwijderen' })]);
            destroy.addEventListener('click', async () => {
              if (!(await confirm(`"${data.title || data.label || row.id}" wordt definitief verwijderd. Herstellen kan dan alleen nog via de geschiedenis in Supabase.`, { title: 'Definitief verwijderen?', confirmLabel: 'Definitief verwijderen', danger: true }))) return;
              act(() => ns.central.deleteContent(type, row.id, scope.namespace), 'Definitief verwijderd');
            });
            actions.push(destroy);
          }
        } else {
          actions.push(el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: `${scope.base}/${type}/${row.id}` } }, [icon('pencil-line'), el('span', { text: may('bewerken', type) ? 'Bewerken' : 'Bekijken' })]));
          if (schema.route) actions.push(el('a', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { href: `#/${schema.route}/${row.id}`, 'aria-label': 'Bekijk op de site: ' + (data.title || row.id), title: 'Bekijk op de site' } }, [icon('eye')]));
          if (may('verwijderen', type) && !(row.draft && row.draft.status === 'trash')) {
            const toTrash = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Verwijderen: ' + (data.title || data.label || row.id), title: drafting() ? 'Verwijderen (na publiceren)' : 'Naar de prullenbak' } }, [icon('trash')]);
            toTrash.addEventListener('click', async () => {
              if (type === 'phase' && usageOfPhase(row.id)) {
                toast(`Deze fase wordt nog gebruikt door ${usageOfPhase(row.id)} usecase(s), prompt(s) of agent(s). Kies daar eerst een andere fase.`, { tone: 'warning', duration: 6000 });
                return;
              }
              if (drafting()) {
                if (!(await confirm(`"${data.title || data.label || row.id}" wordt verwijderd zodra je publiceert.`, { title: 'Verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
                act(() => stage(type, row.id, stateOf(row).data, stateOf(row).position, 'trash'), 'Klaar om te verwijderen: publiceer via de bewerkbalk');
                return;
              }
              if (!(await confirm(`"${data.title || data.label || row.id}" gaat naar de prullenbak. Collega's zien hem dan niet meer; je kunt hem terugzetten.`, { title: 'Naar de prullenbak?', confirmLabel: 'Naar de prullenbak', danger: true }))) return;
              act(() => ns.central.patchContent(type, row.id, { status: 'trash' }, scope.namespace), 'In de prullenbak gezet');
            });
            actions.push(toTrash);
          }
        }
        const pendingLabel = drafting() ? draftLabel(row) : '';
        return el('div', { className: 'cms-row' + (row.status === 'draft' ? ' cms-row--draft' : '') }, [
          el('div', { className: 'cms-row__main' }, [
            el('a', { className: 'cms-row__title', attrs: { href: row.status === 'trash' ? null : `${scope.base}/${type}/${row.id}` }, text: data.title || data.label || row.id }),
            el('p', { className: 'cms-row__meta' }, [
              el('code', { text: row.id }),
              schema.meta && schema.meta(data) ? ' · ' + schema.meta(data) : '',
              row.updated_at ? ' · ' + formatDate(row.updated_at) : '',
              row.draft_by ? ' · wijziging van ' + row.draft_by.split('@')[0] : ''
            ])
          ]),
          pendingLabel ? el('span', { className: 'badge badge--change', text: pendingLabel }) : null,
          el('span', { className: 'status status--' + (row.status === 'published' ? 'success' : row.status === 'draft' ? 'info' : 'muted'), text: row.status === 'draft' && row.draft ? 'Nog niet live' : STATUS_LABEL[row.status] || row.status }),
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
        may('bewerken', type) ? el('a', { className: 'btn btn--primary btn--sm', attrs: { href: `${scope.base}/${type}/nieuw` } }, [icon('message-plus'), el('span', { text: schema.add })]) : null
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
        await ns.central.saveContent(rows, scope.namespace);
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
    // Ook niet als de soort al in de gedeelde basis staat (bijv. agents na het inrichten van de basis)
    return ns.content.TYPES.filter((type) => SCHEMAS[type] && !everywhere().some((row) => row.type === type)).map((type) => {
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
          await ns.central.saveContent(rows, scope.namespace);
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

  /* ---- Nieuwe discipline: leeg beginnen of met voorbeeldinhoud ----------------------------- */
  // Met deze rij is de database leidend voor een omgeving (zie fromRows in js/content.js)
  const startRow = () => ({ type: 'meta', id: 'bron', data: { gestart: new Date().toISOString() }, position: 0, status: 'published' });
  const EXAMPLE_KEYS = { phase: 'phases', usecase: 'usecases', prompt: 'prompts', tip: 'tips', training: 'trainings', agent: 'agents' };

  /** Laadt de voorbeeldinhoud van een discipline (data/voorbeelden/<id>.js, zie data/disciplines.js), of null. */
  function loadExample(id) {
    const path = (ns.disciplineExamples || {})[id];
    if (!path) return Promise.resolve(null);
    if (ns.examples && ns.examples[id]) return Promise.resolve(ns.examples[id]);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = path;
      script.onload = () => resolve((ns.examples || {})[id] || null);
      script.onerror = () => resolve(null);
      document.head.append(script);
    });
  }

  function exampleRows(example) {
    const rows = [];
    ns.content.TYPES.forEach((type) => {
      (Array.isArray(example[EXAMPLE_KEYS[type]]) ? example[EXAMPLE_KEYS[type]] : []).forEach((item, index) => {
        if (!item || !ID_PATTERN.test(item.id || '')) return;
        const data = Object.assign({}, item);
        delete data.id;
        rows.push({ type, id: item.id, data, position: (index + 1) * 10, status: 'published' });
      });
    });
    return rows;
  }

  function newDisciplinePanel() {
    const discipline = ns.cockpit.active();
    const empty = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('message-plus'), el('span', { text: 'Begin met een lege cockpit' })]);
    const fromExample = el('button', { className: 'btn btn--primary', attrs: { type: 'button', hidden: true } }, [icon('download'), el('span', { text: 'Voorbeeldinhoud overnemen' })]);
    const exampleText = el('p', { attrs: { hidden: true } });
    let rows = [];
    loadExample(discipline.id).then((example) => {
      rows = example ? exampleRows(example) : [];
      if (!rows.length) return;
      const count = (type) => rows.filter((row) => row.type === type).length;
      exampleText.textContent = `Er is voorbeeldinhoud klaargezet: ${count('phase')} fasen, ${count('usecase')} usecases, ${count('prompt')} losse prompts en ${count('tip')} tip. Neem die over en pas hem daarna hier aan.`;
      exampleText.hidden = false;
      fromExample.hidden = false;
    });

    async function start(withExample) {
      const list = (withExample ? rows : []).concat([startRow()]);
      const what = withExample ? `de voorbeeldinhoud (${list.length - 1} items)` : 'een lege omgeving';
      if (!(await confirm(`${discipline.name} begint met ${what}. Daarna voeg je hier inhoud toe en pas je die aan.${discipline.status === 'open' ? '' : ' Collega\'s zien er niets van zolang de discipline op slot staat.'}`, { title: 'Discipline inrichten?', confirmLabel: 'Inrichten' }))) return;
      empty.disabled = true;
      fromExample.disabled = true;
      try {
        await ns.central.saveContent(list, scope.namespace);
        await afterChange(`${discipline.name} heeft nu een eigen omgeving`);
      } catch (error) {
        empty.disabled = false;
        fromExample.disabled = false;
        toast('Inrichten mislukt: ' + error.message, { tone: 'warning', duration: 8000 });
      }
    }
    empty.addEventListener('click', () => start(false));
    fromExample.addEventListener('click', () => start(true));

    return el('div', { className: 'notice notice--cta seed' }, [
      icon('info'),
      el('div', {}, [
        el('p', { className: 'notice__title', text: `${discipline.name} heeft nog geen eigen inhoud` }),
        el('p', { text: 'De gedeelde basis (tips, agents, trainingen) staat er vanzelf in zodra die is ingericht. Begin leeg en voeg zelf fasen, usecases en prompts toe (eerst de fasen), of neem de voorbeeldinhoud over.' }),
        exampleText
      ]),
      el('div', { className: 'seed__actions' }, [fromExample, empty])
    ]);
  }

  /* ---- Gedeelde basis eenmalig inrichten (vanuit Audit) -------------------------------------- */
  const BASIS_ORDER = ['tip', 'agent', 'training', 'usecase', 'prompt', 'phase'];

  function basisPanel() {
    const filesId = ns.cockpit.FILES_ID;
    const source = ns.cockpit.namespace(filesId);
    const filesName = (ns.cockpit.find(filesId) || { name: 'Audit' }).name;
    if (ns.cockpit.activeId() !== filesId) {
      return el('div', { className: 'notice' }, [icon('info'), el('div', {}, [
        el('p', { className: 'notice__title', text: 'De gedeelde basis is nog niet ingericht' }),
        el('p', {}, [
          `Dat doe je eenmalig vanuit de cockpit van ${filesName}: daar kies je welke items voor iedereen zijn. `,
          el('a', { attrs: { href: ns.cockpit.href(filesId, '#/beheer/basis') }, text: `Naar Beheer in ${filesName}` })
        ])
      ])]);
    }
    const fromDatabase = everywhere().filter((row) => row.namespace === source && SCHEMAS[row.type] && !SCHEMAS[row.type].single && row.status !== 'trash');
    // Een soort die nog helemaal niet in de database staat (bijv. agents): uit de bestanden
    const fromFiles = ns.content.toRows()
      .filter((row) => SCHEMAS[row.type] && !SCHEMAS[row.type].single && !everywhere().some((r) => r.type === row.type))
      .map((row) => Object.assign({}, row, { namespace: '' }));
    const candidates = fromDatabase.concat(fromFiles);
    const basis = ns.sharedBasis || {};
    const proposed = (row) => basis[row.type] === '*' || (Array.isArray(basis[row.type]) && basis[row.type].includes(row.id));
    const groups = BASIS_ORDER.map((type) => {
      const rows = candidates.filter((row) => row.type === type).sort((a, b) => (a.position || 0) - (b.position || 0));
      if (!rows.length) return null;
      return el('fieldset', { className: 'field field--wide refs' }, [
        el('legend', { className: 'field__label', text: SCHEMAS[type].label }),
        el('div', { className: 'refs__list' }, rows.map((row) => {
          const id = nextId();
          return el('label', { className: 'check check--compact', attrs: { for: id } }, [
            el('input', { attrs: { id, type: 'checkbox', checked: proposed(row) }, dataset: { type, item: row.id } }),
            el('span', { text: ((row.data && (row.data.title || row.data.label)) || row.id) + (row.namespace ? '' : ' (uit de bestanden)') })
          ]);
        }))
      ]);
    }).filter(Boolean);

    const button = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('globe'), el('span', { text: 'Gedeelde basis inrichten' })]);
    const panel = el('div', { className: 'notice notice--cta seed basis-setup' }, [
      icon('globe'),
      el('div', {}, [
        el('p', { className: 'notice__title', text: 'Richt de gedeelde basis in' }),
        el('p', { text: `Kies welke items voor iedereen zijn. Die verhuizen van ${filesName} naar de gedeelde basis en staan straks in de cockpit van iedere discipline. In ${filesName} blijft alles gewoon zichtbaar. Het voorstel komt uit data/disciplines.js: vink aan of uit wat je wilt.` }),
        groups.length ? el('div', { className: 'basis-setup__groups' }, groups) : el('p', { text: `${filesName} heeft nog geen inhoud in de database.` }),
        el('div', { className: 'seed__actions' }, [button])
      ])
    ]);

    button.addEventListener('click', async () => {
      const picked = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'))
        .map((box) => candidates.find((row) => row.type === box.dataset.type && row.id === box.dataset.item))
        .filter(Boolean);
      // Gedeelde usecases en prompts hebben hun fase ook in de basis nodig
      const phaseIds = new Set(picked.filter((row) => (row.type === 'usecase' || row.type === 'prompt') && row.data && row.data.phase).map((row) => row.data.phase));
      candidates.filter((row) => row.type === 'phase' && phaseIds.has(row.id) && !picked.includes(row)).forEach((row) => picked.push(row));
      if (!picked.length) {
        toast('Kies minimaal één item.', { tone: 'warning' });
        return;
      }
      const count = (type) => picked.filter((row) => row.type === type).length;
      const summary = BASIS_ORDER.filter(count).map((type) => `${count(type)} ${count(type) === 1 ? SCHEMAS[type].one : SCHEMAS[type].many}`).join(', ');
      if (!(await confirm(`${summary} verhuizen van ${filesName} naar de gedeelde basis. In ${filesName} blijft alles zichtbaar; zodra je een andere discipline openzet, staat het daar ook in. Daarna pas je deze items aan bij Gedeelde basis.`, { title: 'Gedeelde basis inrichten?', confirmLabel: 'Inrichten' }))) return;
      button.disabled = true;
      const label = button.querySelector('span');
      let copied = false;
      try {
        label.textContent = 'Bezig met kopiëren…';
        await ns.central.saveContent(picked.map((row) => ({ type: row.type, id: row.id, data: row.data, position: row.position || 0, status: row.status })).concat([startRow()]), ns.cockpit.GENERAL_NAMESPACE);
        copied = true;
        // Wat uit Audit kwam, daar weghalen (wat uit de bestanden kwam, stond nog nergens)
        const moved = picked.filter((row) => row.namespace === source);
        for (let index = 0; index < moved.length; index++) {
          label.textContent = `Bezig met verhuizen (${index + 1} van ${moved.length})…`;
          await ns.central.deleteContent(moved[index].type, moved[index].id, source);
        }
        window.history.replaceState(window.history.state, '', '#/beheer/basis');
        await afterChange('De gedeelde basis staat klaar');
      } catch (error) {
        button.disabled = false;
        label.textContent = 'Gedeelde basis inrichten';
        await afterChange();
        // Kopiëren gaat in één keer: mislukt dat, dan is er niets verhuisd. Daarna gaat het weghalen per item.
        toast(copied
          ? `Inrichten deels mislukt: ${error.message}. Alles staat in de gedeelde basis; een deel staat ook nog in ${filesName}. Haal dat daar weg via Inhoud.`
          : `Inrichten mislukt: ${error.message}. Er is niets verhuisd: alles staat nog in ${filesName}.`, { tone: 'warning', duration: 10000 });
      }
    });
    return panel;
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
      download(`ai-cockpit-${scope.id}-inhoud-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported_at: new Date().toISOString(), namespace: scope.namespace, rows }, null, 2));
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
        if (!(await confirm(`${rows.length} items uit de back-up worden teruggezet in ${scope.name}. Items met hetzelfde adres worden overschreven; andere items blijven staan.`, { title: 'Back-up terugzetten?', confirmLabel: 'Terugzetten' }))) return;
        await ns.central.saveContent(rows.map((row) => ({ type: row.type, id: row.id, data: row.data, position: row.position || 0, status: ['published', 'draft', 'trash'].includes(row.status) ? row.status : 'draft' })), scope.namespace);
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
   * @param {object} where     de omgeving: { kind: 'discipline'|'basis', namespace, base, name, id, files }
   */
  function render(params, state, where) {
    if (where) scope = where;
    // Met een rol voor bepaalde onderdelen zie je alleen die onderdelen
    const owner = !drafting() || ns.rights.isOwner();
    const allowed = ORDER.filter((key) => owner || ns.rights.can('bewerken', scope.namespace, key));
    if (!allowed.length) {
      return { node: el('div', { className: 'notice notice--warning' }, [icon('lock'), el('div', {}, [el('p', { text: 'Je hebt hier geen bewerkrechten. Vraag een hoofdbeheerder om een rol voor deze discipline.' })])]), canLeave: null };
    }
    const type = SCHEMAS[params[0]] && allowed.includes(params[0]) ? params[0] : allowed[0];
    const seeded = isSeeded();
    const tabs = el('nav', { className: 'toggles cms-tabs', attrs: { 'aria-label': 'Soort inhoud' } }, allowed.map((key) => {
      const count = SCHEMAS[key].single ? null : rowsOf(key).filter((row) => row.status !== 'trash').length;
      return el('a', { className: 'toggle', attrs: { href: `${scope.base}/${key}`, 'aria-current': key === type ? 'page' : null } }, [
        el('span', { text: SCHEMAS[key].label }),
        count != null && seeded ? el('span', { className: 'toggle__count', text: String(count) }) : null
      ]);
    }));
    const intro = el('p', { className: 'cms__scope' }, [
      icon(scope.kind === 'basis' ? 'globe' : 'pencil-line'),
      el('span', { text: scope.kind === 'basis'
        ? 'Gedeelde basis: wat je hier aanpast, staat in de cockpit van iedere discipline.'
        : `Inhoud van ${scope.name}: alleen in deze cockpit. Wat voor iedereen is, pas je aan bij Gedeelde basis.` })
    ]);

    if (!seeded) {
      if (!owner) return { node: el('div', { className: 'cms' }, [intro, el('p', { className: 'section__lead', text: 'Deze omgeving is nog niet ingericht. Dat doet een hoofdbeheerder.' })]), canLeave: null };
      const status = state && state.status;
      const panel = status === 'missing' || scope.files ? seedPanel(status) : scope.kind === 'basis' ? basisPanel() : newDisciplinePanel();
      return { node: el('div', { className: 'cms' }, [intro, panel]), canLeave: null };
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
        intro,
        ...(editing || !scope.files || !owner ? [] : missingTypePanels()),
        el('div', { className: 'cms__bar' }, [tabs, owner ? backupTools() : null]),
        body
      ]),
      canLeave
    };
  }

  ns.adminContent = { render, quickForm, SCHEMAS };
})(window.AIAudit);
