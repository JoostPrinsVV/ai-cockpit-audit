/* ==========================================================================
   Zoekvenster (Ctrl+K, of / buiten een tekstveld, of de zoekknop in de kopbalk)
   --------------------------------------------------------------------------
   Overal op de site: typ en ga met de pijltjes naar een usecase, prompt, tip,
   training, agent of een actie (promptbouwer, Mijn gegevens, een vraag
   stellen, het thema wisselen, …). Enter opent; bij een prompt kopieert
   Ctrl+Enter hem meteen, met je gegevens uit Mijn gegevens erin.
   Zonder zoekwoord: snel naar, en wat je laatst bekeek.
   Toegankelijk als combobox met een lijst (aria-activedescendant): de focus
   blijft in het zoekveld, de schermlezer hoort de gekozen regel.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, normalize, matches } = ns.ui;
  const PER_KIND = 4;
  const MAX = 14;
  let dialog = null;
  let input = null;
  let list = null;
  let status = null;
  let options = []; // [{ id, node, open(), copy? }]
  let active = -1;
  let returnFocus = null;

  /* ---- Wat je kunt kiezen ------------------------------------------------------------ */
  /** Acties en pagina's. quick: bij een leeg zoekveld. */
  function actions() {
    const weekly = ns.content.currentWeeklyTip;
    const list = [
      { label: 'Bouw je eigen prompt', meta: 'Promptbouwer', icon: 'blocks', href: '#/promptbouwer', words: 'prompt maken schrijven bouwer opbouwen', quick: true },
      { label: 'Mijn gegevens', meta: 'Naam, functie en boekjaar in iedere prompt', icon: 'user', href: '#/mijn', words: 'profiel naam functie boekjaar persoonlijk', quick: true },
      weekly ? { label: 'Tip van de week: ' + weekly.title, meta: 'Tip', icon: 'gift', href: ns.kinds.href('tip', weekly.id), words: 'tip week vrijdag', quick: true } : null,
      { label: 'Stel een vraag aan het AI-team', meta: 'Ideeënhub', icon: 'question', href: '#/ideeen/vraag', words: 'vraag hulp help ideeenhub', quick: true },
      { label: 'Mag dit? Check het in drie vragen', meta: 'AI-beleid', icon: 'shield', run: () => ns.check.open(), words: 'mag dit toegestaan beleid privacy klantgegevens persoonsgegevens bsn veilig tool' },
      ns.check.policyUrl() ? { label: 'Het AI-beleid van V&V', meta: 'Opent het Serviceplein', icon: 'book', run: () => window.open(ns.check.policyUrl(), '_blank', 'noopener,noreferrer'), words: 'beleid ai-beleid regels richtlijn informatiebeveiliging' } : null,
      { label: 'Deel een idee', meta: 'Ideeënhub', icon: 'bulb', href: '#/ideeen/idee', words: 'idee ideeenhub voorstel' },
      { label: 'Vraag een prompt aan', meta: 'Het AI-team maakt hem', icon: 'flag', run: () => ns.ideas.quick({ kind: 'verzoek' }), words: 'prompt aanvragen verzoek mis zoek nodig' },
      { label: 'Deel je prompt', meta: 'Voor in de cockpit', icon: 'chat', run: () => ns.ideas.quick({ kind: 'prompt' }), words: 'prompt delen ideeenhub voorstel' },
      { label: 'Rondleiding door de cockpit', meta: 'In een minuut waar alles staat', icon: 'plane', run: () => ns.tour.restart(), words: 'rondleiding uitleg tour help hulp begin wegwijs' },
      { label: 'Wissel tussen licht en donker', meta: 'Thema', icon: 'moon', run: () => document.getElementById('theme-button').click(), words: 'thema donker licht dark mode' },
      { label: 'Startpagina', meta: 'Pagina', icon: 'plane', href: '#/', words: 'home start begin' },
      ...ns.kinds.pages.map((kind) => ({ label: kind.title, meta: 'Pagina', icon: kind.icon, href: '#/' + kind.list, words: kind.many + ' overzicht' })),
      { label: 'Ideeënhub', meta: 'Pagina', icon: 'message-plus', href: '#/ideeen', words: 'ideeen hub inzendingen' },
      { label: 'Beheer', meta: 'Voor het AI-team', icon: 'settings', href: '#/beheer', words: 'beheer admin inloggen' }
    ];
    return list.filter(Boolean).map((action) => Object.assign(action, { haystack: normalize(action.label + ' ' + action.meta + ' ' + action.words) }));
  }

  /** Hoe goed een titel past: begint ermee 3, bevat het hele zoekwoord 2, alleen ergens in de tekst 1. */
  function rank(title, query) {
    const t = normalize(title);
    const q = normalize(query);
    return t.startsWith(q) ? 3 : t.includes(q) ? 2 : 1;
  }

  /** Zoekwoorden in de titel markeren (alleen als ze er letterlijk in staan). */
  function marked(title, query) {
    const terms = query.trim().split(/\s+/).filter((term) => term.length > 1).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!terms.length) return [title];
    const parts = title.split(new RegExp(`(${terms.join('|')})`, 'gi'));
    return parts.filter(Boolean).map((part) => (terms.some((term) => new RegExp(`^${term}$`, 'i').test(part)) ? el('mark', { text: part }) : part));
  }

  function itemEntry(kind, item) {
    const info = ns.kinds.get(kind);
    const meta = [info.label, item.phase ? item.phase.short : item.category && item.category.label ? item.category.label : item.kind || ''].filter(Boolean).join(' · ');
    const entry = { label: item.title, meta, icon: info.icon, href: ns.kinds.href(kind, item.id), kind, item };
    // Een prompt kun je meteen kopiëren (met je gegevens erin)
    if (kind === 'prompt') {
      entry.copy = () => {
        ns.ui.copyText(ns.profile.fill(item.prompt)).then((ok) => {
          ns.ui.toast(ok ? `Gekopieerd: ${item.title}` : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
          if (ok) ns.central.track('copy_prompt', item.id);
        });
      };
    }
    return entry;
  }

  /** De regels voor een zoekopdracht: [{ title: kop, entries }]. */
  function groups(query) {
    const q = query.trim();
    if (!q) {
      const recent = ns.ui.viewed.list().map((key) => {
        const split = key.indexOf(':');
        const kind = key.slice(0, split);
        const item = ns.kinds.item(kind, key.slice(split + 1));
        return item && !item.locked ? itemEntry(kind, item) : null;
      }).filter(Boolean).slice(0, 5);
      return [
        { title: 'Snel naar', entries: actions().filter((action) => action.quick) },
        { title: 'Recent bekeken', entries: recent }
      ];
    }
    const found = ns.content.search(q);
    const byRank = (items) => items.slice().sort((a, b) => rank(b.title, q) - rank(a.title, q));
    const items = []
      .concat(byRank(found.prompts).slice(0, PER_KIND).map((item) => itemEntry('prompt', item)))
      .concat(byRank(found.usecases).slice(0, PER_KIND).map((item) => itemEntry('usecase', item)))
      .concat(byRank(found.tips).slice(0, PER_KIND).map((item) => itemEntry('tip', item)))
      .concat(byRank(found.trainings).slice(0, 3).map((item) => itemEntry('training', item)))
      .concat(byRank(found.agents).slice(0, 3).map((item) => itemEntry('agent', item)))
      .sort((a, b) => rank(b.label, q) - rank(a.label, q))
      .slice(0, MAX);
    const total = found.prompts.length + found.usecases.length + found.tips.length + found.trainings.length + found.agents.length;
    return [
      { title: 'Acties', entries: actions().filter((action) => matches(action.haystack, q)).slice(0, 4) },
      { title: 'In de cockpit', entries: items },
      { title: '', entries: [
        { label: total > items.length ? `Alle ${total} resultaten voor "${q}"` : `Zoek "${q}" op de zoekpagina`, meta: 'Zoeken', icon: 'search', href: '#/zoeken/' + encodeURIComponent(q) },
        // Geen prompt gevonden: meteen aanvragen, met wat je zocht
        found.prompts.length ? null : { label: `Vraag een prompt aan: "${q}"`, meta: 'Het AI-team maakt hem', icon: 'flag', run: () => ns.ideas.quick({ kind: 'verzoek', title: q }) }
      ].filter(Boolean) }
    ];
  }

  /* ---- Lijst tekenen en kiezen --------------------------------------------------------- */
  function render() {
    const query = input.value;
    options = [];
    list.replaceChildren();
    groups(query).forEach((group, g) => {
      if (!group.entries.length) return;
      const titleId = 'pal-g' + g;
      const groupNode = el('li', { className: 'palette__group', attrs: { role: 'presentation' } }, [
        group.title ? el('p', { className: 'palette__group-title', attrs: { id: titleId, 'aria-hidden': 'true' }, text: group.title }) : null,
        el('ul', { className: 'palette__options', attrs: { role: 'group', 'aria-label': group.title || 'Zoeken' } }, group.entries.map((entry) => option(entry, query)))
      ]);
      list.append(groupNode);
    });
    const count = options.length;
    status.textContent = query.trim() ? (count ? `${count} ${count === 1 ? 'keuze' : 'keuzes'}` : 'Niets gevonden') : '';
    setActive(count ? 0 : -1);
  }

  function option(entry, query) {
    const index = options.length;
    const id = 'pal-opt-' + index;
    const copy = entry.copy ? el('button', { className: 'palette__copy', attrs: { type: 'button', tabindex: '-1', title: 'Kopieer de prompt (Ctrl+Enter)' } }, [icon('copy'), el('span', { text: 'Kopieer' })]) : null;
    const node = el('li', { className: 'palette__option', attrs: { id, role: 'option', 'aria-selected': 'false' } }, [
      el('span', { className: 'palette__icon', attrs: { 'aria-hidden': 'true' } }, [icon(entry.icon)]),
      el('span', { className: 'palette__body' }, [
        el('span', { className: 'palette__label' }, marked(entry.label, query)),
        entry.meta ? el('span', { className: 'palette__meta', text: entry.meta }) : null
      ]),
      copy,
      el('span', { className: 'palette__enter', attrs: { 'aria-hidden': 'true' } }, [icon('arrow-right')])
    ]);
    const open = () => {
      close();
      if (entry.run) entry.run();
      else if (entry.href) window.location.hash = entry.href;
    };
    node.addEventListener('mousemove', () => {
      if (active !== index) setActive(index, false);
    });
    node.addEventListener('click', (event) => {
      if (copy && copy.contains(event.target)) return;
      open();
    });
    if (copy) {
      copy.addEventListener('click', (event) => {
        event.stopPropagation();
        entry.copy();
        close();
      });
    }
    options.push({ id, node, open, copy: entry.copy || null });
    return node;
  }

  function setActive(index, scroll) {
    if (active >= 0 && options[active]) {
      options[active].node.classList.remove('is-active');
      options[active].node.setAttribute('aria-selected', 'false');
    }
    active = index;
    const current = options[active];
    if (!current) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    current.node.classList.add('is-active');
    current.node.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', current.id);
    if (scroll !== false) current.node.scrollIntoView({ block: 'nearest' });
  }

  function onKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!options.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((active + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = options[active];
      if (!current) return;
      if ((event.ctrlKey || event.metaKey) && current.copy) {
        current.copy();
        close();
      } else {
        current.open();
      }
    }
  }

  /* ---- Openen en sluiten -------------------------------------------------------------- */
  function build() {
    input = el('input', {
      className: 'palette__input',
      attrs: { type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list', 'aria-label': 'Zoek of kies een actie', placeholder: 'Zoek een prompt, usecase, tip… of typ wat je wilt doen', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go' }
    });
    list = el('ul', { className: 'palette__list', attrs: { id: 'palette-list', role: 'listbox', 'aria-label': 'Keuzes' } });
    status = el('p', { className: 'sr-only', attrs: { role: 'status', 'aria-live': 'polite' } });
    let timer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(render, 60);
    });
    input.addEventListener('keydown', onKey);
    dialog = el('dialog', { className: 'palette', attrs: { 'aria-label': 'Zoeken en snel naar' } }, [
      el('div', { className: 'palette__panel' }, [
        el('div', { className: 'palette__search' }, [icon('search'), input, el('kbd', { className: 'palette__esc', text: 'Esc' })]),
        list,
        status,
        el('p', { className: 'palette__foot', attrs: { 'aria-hidden': 'true' } }, [
          el('span', {}, [el('kbd', { text: '↑' }), el('kbd', { text: '↓' }), ' kiezen']),
          el('span', {}, [el('kbd', { text: 'Enter' }), ' openen']),
          el('span', {}, [el('kbd', { text: 'Ctrl' }), el('kbd', { text: 'Enter' }), ' prompt kopiëren']),
          el('span', {}, [el('kbd', { text: 'Esc' }), ' sluiten'])
        ])
      ])
    ]);
    // Klik naast het venster: dicht
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('has-palette');
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    });
    document.body.append(dialog);
  }

  function open(query) {
    if (!ns.content || !ns.content.prompts) return;
    if (!dialog) build();
    if (dialog.open) {
      input.select();
      return;
    }
    returnFocus = document.activeElement;
    input.value = query || '';
    render();
    dialog.showModal();
    document.documentElement.classList.add('has-palette');
    input.focus();
  }

  function close() {
    if (dialog && dialog.open) dialog.close();
  }

  const typing = (target) => Boolean(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)));

  function init() {
    document.addEventListener('keydown', (event) => {
      const key = event.key && event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'k') {
        event.preventDefault();
        if (dialog && dialog.open) close();
        else open();
      } else if (key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !typing(event.target) && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        open();
      }
    });
    // De zoekknop in de kopbalk opent het venster (met Ctrl of in een nieuw tabblad: gewoon de zoekpagina)
    const button = document.getElementById('search-button');
    if (button) {
      button.setAttribute('aria-haspopup', 'dialog');
      button.title = 'Zoeken (Ctrl+K)';
      button.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        open();
      });
    }
  }

  ns.palette = { init, open, close, groups };
})(window.AIAudit);
