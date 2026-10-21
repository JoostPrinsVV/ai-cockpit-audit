/* ==========================================================================
   Promptdatabase (#/prompts) en één prompt (#/prompt/<id>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, licenseBadge, newBadge, accentClass, pageHeader, toggleGroup, emptyState, copyButton, favoriteButton, matches } = ns.ui;

  // Zoekterm en filters blijven staan zolang de pagina open is
  const filters = { query: '', phase: 'all', license: 'all', demo: false, favorites: false };

  /** withTask: false als de taak al bovenaan de kaart staat. */
  function chipsFor(prompt, withTask) {
    return [
      ns.ui.draftBadge(prompt),
      prompt.tool ? chip(prompt.tool, { icon: 'robot' }) : null,
      prompt.task && withTask !== false ? chip(prompt.task) : null,
      licenseBadge(prompt.license, { short: true }),
      prompt.usecase && prompt.usecase.hasDemo ? el('span', { className: 'badge badge--demo' }, [icon('play-circle'), 'Met demo']) : null,
      newBadge(prompt.added)
    ].filter(Boolean);
  }

  /** Bovenregel van een kaart: in een fasegroep de soort taak (de fase staat dan al in de kop), elders de fase. */
  function eyebrow(prompt, grouped) {
    const usecaseLabel = prompt.usecase ? (prompt.steps > 1 ? `Usecase · stap ${prompt.step}/${prompt.steps}` : 'Usecase') : '';
    if (grouped) return [el('span', { text: usecaseLabel || prompt.task || prompt.phase.short })];
    return [el('span', { text: prompt.phase.short }), usecaseLabel ? el('span', { className: 'p-card__step', text: usecaseLabel }) : null];
  }

  /** Kaart in de lijst: titel, omschrijving, direct kopiëren, prompt uitklappen. */
  function card(prompt, headingTag, onFavoriteChange, grouped) {
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

    return el('article', { className: 'p-card ' + accentClass(prompt.accent) }, [
      el('div', { className: 'p-card__head' }, [
        el('p', { className: 'p-card__phase' }, eyebrow(prompt, grouped)),
        favoriteButton(prompt.id, prompt.title, onFavoriteChange)
      ]),
      el(headingTag || 'h2', { className: 'p-card__title' }, [el('a', { attrs: { href: '#/prompt/' + prompt.id }, text: prompt.title })]),
      prompt.description ? el('p', { className: 'p-card__desc', text: prompt.description }) : null,
      el('div', { className: 'chips' }, chipsFor(prompt, !grouped)),
      el('div', { className: 'p-card__actions' }, [
        copyButton(() => prompt.prompt, { label: 'Kopieer', className: 'btn--sm', onCopy: () => ns.central.track('copy_prompt', prompt.id) }),
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
    const count = el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });
    const empty = emptyState('Geen prompts gevonden', 'Probeer een ander zoekwoord of zet de filters terug op Alle.');
    const favCount = el('span', { className: 'toggle__count' });

    function update() {
      const favs = ns.ui.favorites.list();
      favCount.textContent = String(favs.filter((id) => ns.content.promptById.has(id)).length);
      const items = all.filter((p) =>
        (filters.phase === 'all' || p.phase.id === filters.phase) &&
        (filters.license === 'all' || (filters.license === 'yes' ? p.license === true : p.license === false)) &&
        (!filters.demo || (p.usecase && p.usecase.hasDemo)) &&
        (!filters.favorites || favs.includes(p.id)) &&
        matches(p.haystack, filters.query)
      );
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
          el('ul', { className: 'p-grid', attrs: { role: 'list' } }, group.items.map((p) => el('li', {}, [card(p, 'h3', () => {
            if (filters.favorites) update();
            else favCount.textContent = String(ns.ui.favorites.list().filter((id) => ns.content.promptById.has(id)).length);
          }, true)])))
        ])
      ));
      count.textContent = items.length === 1 ? '1 prompt' : items.length + ' prompts';
      empty.hidden = items.length > 0;
    }

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

    const phaseItems = ns.content.phases
      .map((phase) => ({ value: phase.id, label: phase.short, accent: phase.accent, count: all.filter((p) => p.phase.id === phase.id).length }))
      .filter((item) => item.count > 0);
    const phaseGroup = toggleGroup('Filter op fase', [{ value: 'all', label: 'Alle fasen', count: all.length }].concat(phaseItems), filters.phase, (value) => {
      filters.phase = value;
      update();
    });
    const licenseGroup = toggleGroup('Filter op licentie', [
      { value: 'all', label: 'Alle' },
      { value: 'no', label: 'Zonder licentie', icon: 'check' },
      { value: 'yes', label: 'Met licentie', icon: 'key' }
    ], filters.license, (value) => {
      filters.license = value;
      update();
    }, { className: 'toggles--compact' });

    function switchButton(label, iconName, key, extra) {
      const btn = el('button', { className: 'toggle toggle--switch', attrs: { type: 'button', 'aria-pressed': String(filters[key]) } }, [icon(iconName), el('span', { text: label }), extra || null]);
      btn.addEventListener('click', () => {
        filters[key] = !filters[key];
        btn.setAttribute('aria-pressed', String(filters[key]));
        update();
      });
      return btn;
    }

    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Promptdatabase',
        title: 'Prompts die je direct kunt gebruiken',
        lead: 'Kopieer een prompt, plak hem in Copilot en vul de [PLAATSHOUDERS] in. Of vul ze hier alvast in via "Invullen". Prompts met een demo horen bij een usecase.'
      }),
      el('div', { className: 'filters' }, [
        search,
        el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: 'Fase' }), phaseGroup]),
        el('div', { className: 'filters__row' }, [
          el('span', { className: 'filters__label', text: 'Toon' }),
          licenseGroup,
          el('div', { className: 'toggles toggles--compact', attrs: { role: 'group', 'aria-label': 'Extra filters' } }, [
            switchButton('Met demo', 'play-circle', 'demo'),
            switchButton('Mijn favorieten', 'star', 'favorites', favCount)
          ]),
          count
        ])
      ]),
      list,
      empty
    ]);
    update();
    return { node, title: 'Promptdatabase' };
  }

  /* ---- Eén prompt ------------------------------------------------------------------ */
  function renderDetail(id) {
    const prompt = ns.content.promptById.get(id);
    if (!prompt) return null;

    const usecase = prompt.usecase;
    const others = ns.content.prompts.filter((p) => p.phase === prompt.phase && p !== prompt && (!usecase || p.usecase !== usecase)).slice(0, 4);
    const siblings = usecase ? usecase.promptIds.filter((pid) => pid !== prompt.id).map((pid) => ns.content.promptById.get(pid)).filter(Boolean) : [];

    const node = el('article', { className: 'page container detail detail--narrow ' + accentClass(prompt.accent) }, [
      el('header', { className: 'detail__header' }, [
        el('a', { className: 'btn btn--back btn--sm', attrs: { href: '#/prompts' } }, [icon('arrow-left'), el('span', { text: 'Alle prompts' })]),
        el('p', { className: 'detail__eyebrow' }, [icon(prompt.phase.icon), el('span', { text: prompt.phase.label })]),
        el('div', { className: 'detail__title-row' }, [
          el('h1', { className: 'detail__title', text: prompt.title, attrs: { tabindex: '-1' } }),
          favoriteButton(prompt.id, prompt.title)
        ]),
        prompt.description ? el('p', { className: 'detail__subtitle', text: prompt.description }) : null,
        el('div', { className: 'chips' }, chipsFor(prompt))
      ]),

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
      prompt.note ? el('p', { className: 'takeaway__note' }, [icon('info'), el('span', { text: prompt.note })]) : null,
      prompt.tip ? el('div', { className: 'tip' }, [
        el('span', { className: 'tip__icon', attrs: { 'aria-hidden': 'true' } }, [icon('bulb')]),
        el('p', {}, [el('strong', { text: 'Tip ' }), prompt.tip])
      ]) : null,
      prompt.author ? el('p', { className: 'detail__credit', text: 'Aangedragen door ' + prompt.author }) : null,

      siblings.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'pr-steps' } }, [
        el('h2', { className: 'related__title', text: 'De andere stappen', attrs: { id: 'pr-steps' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, siblings.map((p) =>
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: '#/prompt/' + p.id } }, [icon('chat'), el('span', { text: `Stap ${p.step}: ${p.title}` }), icon('arrow-right', { className: 'related__go' })])])
        ))
      ]) : null,
      others.length ? el('section', { className: 'related', attrs: { 'aria-labelledby': 'pr-more' } }, [
        el('h2', { className: 'related__title', text: 'Meer in ' + prompt.phase.label, attrs: { id: 'pr-more' } }),
        el('ul', { className: 'related__list', attrs: { role: 'list' } }, others.map((p) =>
          el('li', {}, [el('a', { className: 'related__link', attrs: { href: '#/prompt/' + p.id } }, [icon('chat'), el('span', { text: p.title }), icon('arrow-right', { className: 'related__go' })])])
        ))
      ]) : null
    ]);
    return { node, title: prompt.title };
  }

  ns.views = ns.views || {};
  ns.views.prompts = { renderList, renderDetail, card };
})(window.AIAudit);
