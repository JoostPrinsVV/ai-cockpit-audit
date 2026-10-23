/* ==========================================================================
   Promptdatabase (#/prompts) en één prompt (#/prompt/<id>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, switchButton, emptyState, copyButton, copilotButton, saveButton, matches } = ns.ui;
  const B = ns.blocks;
  const { detailHeader, relatedList, infoNote, tipCallout } = B;

  // Zoekterm, filters en volgorde blijven staan zolang de site open is
  const filters = { query: '', phase: 'all', license: 'all', demo: false, saved: false, sort: 'phase' };

  /** withTask: false als de taak al bovenaan de kaart staat. */
  function chipsFor(prompt, withTask) {
    return [
      ns.ui.draftBadge(prompt),
      ns.cockpit.sharedBadge(prompt),
      prompt.tool ? chip(prompt.tool, { icon: 'robot' }) : null,
      prompt.task && withTask !== false ? chip(prompt.task) : null,
      licenseBadge(prompt.license, { short: true }),
      prompt.usecase && prompt.usecase.hasDemo ? el('span', { className: 'badge badge--demo' }, [icon('play-circle'), 'Met demo']) : null,
      ns.reviews.ratingChip('prompt', prompt.id),
      newBadge(prompt.added)
    ].filter(Boolean);
  }

  /** Bovenregel van een kaart: in een fasegroep de soort taak (de fase staat dan al in de kop), elders de fase. */
  function eyebrow(prompt, grouped) {
    const usecaseLabel = prompt.usecase ? (prompt.steps > 1 ? `Usecase · stap ${prompt.step}/${prompt.steps}` : 'Usecase') : '';
    if (grouped) return [el('span', { text: usecaseLabel || prompt.task || prompt.phase.short })];
    return [el('span', { text: prompt.phase.short }), usecaseLabel ? el('span', { className: 'p-card__step', text: usecaseLabel }) : null];
  }

  /** Kaart in de lijst: titel, omschrijving, direct kopiëren, prompt uitklappen, bewaren. */
  function card(prompt, headingTag, grouped) {
    const previewId = 'prev-' + prompt.id;
    const preview = el('div', { className: 'p-card__preview', attrs: { id: previewId, hidden: true } });
    const toggle = el('button', { className: 'btn btn--quiet btn--sm p-card__toggle', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': previewId } }, [
      el('span', { text: 'Bekijk' }),
      icon('chevron-down')
    ]);
    toggle.addEventListener('click', () => {
      const open = preview.hidden;
      if (open && !preview.firstChild) {
        preview.append(el('pre', { className: 'prompt-box__text prompt-box__text--plain', attrs: { tabindex: '0' } }, ns.ui.promptNodes(prompt.prompt)));
      }
      preview.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('span').textContent = open ? 'Verberg' : 'Bekijk';
    });

    return el('article', { className: 'p-card ' + accentClass(prompt.accent), dataset: { kind: 'prompt', id: prompt.id } }, [
      el('div', { className: 'p-card__head' }, [
        el('p', { className: 'p-card__phase' }, eyebrow(prompt, grouped)),
        saveButton('prompt', prompt.id, prompt.title)
      ]),
      el(headingTag || 'h2', { className: 'p-card__title' }, [el('a', { attrs: { href: '#/prompt/' + prompt.id }, text: prompt.title })]),
      prompt.description ? el('p', { className: 'p-card__desc', text: prompt.description }) : null,
      el('div', { className: 'chips' }, chipsFor(prompt, !grouped)),
      el('div', { className: 'p-card__actions' }, [
        copyButton(() => prompt.prompt, { label: 'Kopieer', className: 'btn--sm', onCopy: () => ns.central.track('copy_prompt', prompt.id) }),
        copilotButton(() => prompt.prompt, { label: 'Copilot', className: 'btn--sm', onCopy: () => ns.central.track('copy_prompt', prompt.id) }),
        toggle,
        el('a', { className: 'btn btn--quiet btn--sm', attrs: { href: '#/prompt/' + prompt.id, 'aria-label': 'Invullen en details: ' + prompt.title } }, [icon('pencil-line'), el('span', { text: 'Invullen' })])
      ]),
      preview
    ]);
  }

  /* ---- Overzicht ---------------------------------------------------------------- */
  function renderList() {
    const all = ns.content.prompts;
    const list = el('div', { className: 'p-list' });
    const count = B.resultCount();
    // Een lege catalogus (nieuwe discipline) is iets anders dan niets vinden met deze filters
    const empty = all.length
      ? emptyState('Geen prompts gevonden', 'Probeer een ander zoekwoord of zet de filters terug op Alle.')
      : emptyState('De eerste prompts komen eraan', `Hier verschijnen prompts voor Copilot in ${ns.cockpit.active().label} die je direct kunt kopiëren.`, null, 'chat');
    // In een fasegroep een iets andere kaart (de fase staat dan al in de kop)
    const cardFor = B.cardCache((p, variant) => card(p, variant === 'groep' ? 'h3' : 'h2', variant === 'groep'));
    const saved = B.savedFilter('prompt', filters, update, (id) => ns.content.promptById.has(id));

    function update() {
      const savedIds = saved.ids();
      let items = all.filter((p) =>
        (filters.phase === 'all' || p.phase.id === filters.phase) &&
        B.licenseMatch(filters.license, p.license) &&
        (!filters.demo || (p.usecase && p.usecase.hasDemo)) &&
        (!filters.saved || savedIds.includes(p.id)) &&
        matches(p.haystack, filters.query)
      );
      if (filters.sort === 'rating') {
        // Best beoordeeld: één lijst, zonder kopjes per fase
        items = ns.reviews.rank(items, 'prompt');
        list.replaceChildren(el('ul', { className: 'p-grid', attrs: { role: 'list' } }, items.map((p) => cardFor(p, 'lijst'))));
      } else {
        // Per fase gegroepeerd, met een kop per fase
        const groups = [];
        items.forEach((p) => {
          let group = groups[groups.length - 1];
          if (!group || group.phase !== p.phase) {
            group = { phase: p.phase, items: [] };
            groups.push(group);
          }
          group.items.push(p);
        });
        list.replaceChildren(...groups.map((group) =>
          el('section', { className: 'p-group ' + accentClass(group.phase.accent), attrs: { 'aria-labelledby': 'pg-' + group.phase.id } }, [
            el('h2', { className: 'p-group__title', attrs: { id: 'pg-' + group.phase.id } }, [
              el('span', { className: 'p-group__icon', attrs: { 'aria-hidden': 'true' } }, [icon(group.phase.icon)]),
              el('span', {}, [group.phase.label + ' ', el('span', { className: 'p-group__count', text: String(group.items.length) })])
            ]),
            el('ul', { className: 'p-grid', attrs: { role: 'list' } }, group.items.map((p) => cardFor(p, 'groep')))
          ])
        ));
      }
      count.textContent = B.countText(items.length, 'prompt', 'prompts');
      empty.hidden = items.length > 0;
    }
    const stopSaved = saved.watch(list);

    // Zoeken (direct tijdens het typen)
    const input = el('input', {
      className: 'search__input',
      attrs: { id: 'prompt-search', type: 'search', placeholder: 'Zoek op woord, bijv. "contract", "Excel" of "bevestiging"', autocomplete: 'off', enterkeyhint: 'search' }
    });
    input.value = filters.query;
    let timer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        filters.query = input.value;
        update();
      }, 120);
    });
    const search = el('form', { className: 'search', attrs: { role: 'search', novalidate: true } }, [
      el('label', { className: 'sr-only', text: 'Zoek in de prompts', attrs: { for: 'prompt-search' } }),
      icon('search', { className: 'search__icon' }),
      input
    ]);
    search.addEventListener('submit', (event) => event.preventDefault());

    const withDemo = switchButton('Met demo', 'play-circle', filters.demo, (on) => {
      filters.demo = on;
      update();
    });
    // De gemiddelden komen later binnen: dan de kaarten opnieuw bouwen (met de sterren erop)
    ns.reviews.whenLoaded(() => {
      if (!list.isConnected) return;
      cardFor.reset();
      update();
    });
    const sort = B.ratingSort(filters, update, { value: 'phase', label: 'Per fase' });

    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Promptdatabase',
        title: 'Prompts die je direct kunt gebruiken',
        lead: 'Kopieer een prompt, plak hem in Copilot en vul de [PLAATSHOUDERS] in. Of vul ze hier alvast in via "Invullen". Prompts met een demo horen bij een usecase.'
      }),
      el('div', { className: 'filters' }, [
        search,
        B.filterRow('Fase', B.phaseFilter(all, filters, update)),
        B.filterRow('Toon', B.licenseFilter(filters, update), B.extraFilters(withDemo, saved.button), count),
        sort ? B.filterRow('Volgorde', sort) : null
      ]),
      list,
      empty
    ]);
    update();
    return {
      node,
      title: 'Promptdatabase',
      destroy: () => {
        stopSaved();
        window.clearTimeout(timer);
      }
    };
  }

  /* ---- Eén prompt ------------------------------------------------------------------ */
  function renderDetail(id) {
    const prompt = ns.content.promptById.get(id);
    if (!prompt) return null;

    const usecase = prompt.usecase;
    const others = ns.content.prompts.filter((p) => p.phase === prompt.phase && p !== prompt && (!usecase || p.usecase !== usecase)).slice(0, 4);
    const siblings = usecase ? usecase.promptIds.filter((pid) => pid !== prompt.id).map((pid) => ns.content.promptById.get(pid)).filter(Boolean) : [];

    const promptLink = (p, text) => ({ href: ns.kinds.href('prompt', p.id), icon: 'chat', text });
    const node = el('article', { className: 'page container detail detail--narrow ' + accentClass(prompt.accent) }, [
      detailHeader({
        back: ['#/prompts', 'Alle prompts'],
        icon: prompt.phase.icon,
        eyebrow: prompt.phase.label,
        title: prompt.title,
        save: ['prompt', prompt.id],
        subtitle: prompt.description,
        chips: chipsFor(prompt)
      }),

      usecase ? el('a', { className: 'usecase-link', attrs: { href: '#/usecase/' + usecase.id } }, [
        el('span', { className: 'usecase-link__icon', attrs: { 'aria-hidden': 'true' } }, [icon(usecase.hasDemo ? 'play' : 'grid')]),
        el('span', { className: 'usecase-link__body' }, [
          el('span', { className: 'usecase-link__eyebrow', text: prompt.steps > 1 ? `Stap ${prompt.step} van ${prompt.steps} uit de usecase` : 'Uit de usecase' }),
          el('span', { className: 'usecase-link__title', text: usecase.title }),
          usecase.hasDemo ? el('span', { className: 'usecase-link__text', text: 'Bekijk de demo en de andere stappen' }) : null
        ]),
        icon('arrow-right', { className: 'usecase-link__go' })
      ]) : null,

      ns.promptBox.create({ text: prompt.prompt, label: 'De prompt', headingTag: 'h2', onCopy: () => ns.central.track('copy_prompt', prompt.id) }),
      infoNote(prompt.note),
      tipCallout(prompt.tip),
      prompt.author ? el('p', { className: 'detail__credit', text: 'Aangedragen door ' + prompt.author }) : null,
      ns.reviews.block('prompt', prompt),
      relatedList('pr-steps', 'De andere stappen', siblings.map((p) => promptLink(p, `Stap ${p.step}: ${p.title}`))),
      relatedList('pr-more', 'Meer in ' + prompt.phase.label, others.map((p) => promptLink(p, p.title)))
    ]);
    return { node, title: prompt.title };
  }

  ns.views = ns.views || {};
  ns.views.prompts = { renderList, renderDetail, card };
})(window.AIAudit);
