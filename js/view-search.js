/* ==========================================================================
   Zoeken op het hele platform (#/zoeken/<zoekwoorden>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, pageHeader } = ns.ui;
  const LIMIT = 12;

  function render(params) {
    const initial = params[0] ? decodeURIComponent(params[0]) : '';
    const results = el('div', { className: 'search-results', attrs: { 'aria-live': 'polite' } });
    const input = el('input', {
      className: 'search__input',
      attrs: { id: 'global-search', type: 'search', placeholder: 'Bijv. "transcriptie", "materialiteit" of "Facilitator"', autocomplete: 'off', enterkeyhint: 'search' }
    });
    input.value = initial;

    function group(title, items, renderItem, moreHref) {
      if (!items.length) return null;
      return el('section', { className: 'section section--tight', attrs: { 'aria-label': title } }, [
        el('div', { className: 'section__head' }, [
          el('h2', { className: 'section__title' }, [el('span', { text: title }), el('span', { className: 'section__count', text: String(items.length) })]),
          moreHref && items.length > LIMIT ? el('a', { className: 'section__link', attrs: { href: moreHref } }, [el('span', { text: 'Alles bekijken' }), icon('arrow-right')]) : null
        ]),
        el('ul', { className: 'card-grid', attrs: { role: 'list' } }, items.slice(0, LIMIT).map((item) => el('li', {}, [renderItem(item)])))
      ]);
    }

    function update() {
      const query = input.value.trim();
      // Adres bijwerken zonder de pagina opnieuw op te bouwen (deelbare zoeklink)
      const hash = '#/zoeken' + (query ? '/' + encodeURIComponent(query) : '');
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
      if (!query) {
        results.replaceChildren(el('p', { className: 'section__lead', text: 'Typ een of meer woorden. Je zoekt tegelijk in usecases, prompts, tips, trainingen en agents & tools.' }));
        return;
      }
      const found = ns.content.search(query);
      const total = found.usecases.length + found.prompts.length + found.tips.length + found.trainings.length + found.agents.length;
      if (!total) {
        results.replaceChildren(el('div', { className: 'empty' }, [
          el('span', { className: 'empty__icon', attrs: { 'aria-hidden': 'true' } }, [icon('search')]),
          el('p', { className: 'empty__title', text: `Niets gevonden voor "${query}"` }),
          el('p', { className: 'empty__text', text: 'Probeer een ander woord. Of laat het ons weten: misschien is dit precies een goed idee voor een nieuwe usecase of prompt.' }),
          el('a', { className: 'btn btn--primary', attrs: { href: '#/ideeen/verzoek' } }, [icon('message-plus'), el('span', { text: 'Doe een verzoek' })])
        ]));
        return;
      }
      results.replaceChildren(...[
        el('p', { className: 'results-count', text: total === 1 ? '1 resultaat' : total + ' resultaten' }),
        group('Usecases', found.usecases, (u) => ns.views.usecases.card(u, 'h3')),
        group('Prompts', found.prompts, (p) => ns.views.prompts.card(p, 'h3'), '#/prompts'),
        group('Tips & tricks', found.tips, (t) => ns.views.tips.card(t, 'h3')),
        group('Trainingen', found.trainings, (t) => ns.views.trainings.card(t, 'h3')),
        group('Agents & tools', found.agents, (a) => ns.views.agents.card(a, 'h3'))
      ].filter(Boolean));
    }

    let timer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 150);
    });
    const form = el('form', { className: 'search search--large', attrs: { role: 'search', novalidate: true } }, [
      el('label', { className: 'sr-only', text: 'Zoeken', attrs: { for: 'global-search' } }),
      icon('search', { className: 'search__icon' }),
      input
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      update();
    });

    const node = el('div', { className: 'page container' }, [
      pageHeader({ eyebrow: 'Zoeken', title: 'Zoek op het hele platform' }),
      form,
      results
    ]);
    update();
    return {
      node,
      title: initial ? 'Zoeken: ' + initial : 'Zoeken',
      // Na het openen meteen in het zoekveld (in plaats van op de kop)
      focus: () => {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
      }
    };
  }

  ns.views = ns.views || {};
  ns.views.search = { render };
})(window.AIAudit);
