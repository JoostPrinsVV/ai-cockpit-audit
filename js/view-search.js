/* ==========================================================================
   Zoeken op het hele platform (#/zoeken/<zoekwoorden>)
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, pageHeader, emptyState } = ns.ui;

  function render(params) {
    const initial = params[0] || ''; // al gedecodeerd (js/app.js)
    // Alleen het aantal wordt voorgelezen, niet de hele lijst bij iedere toetsaanslag
    const count = el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });
    const results = el('div', { className: 'search-results' });
    const input = el('input', {
      className: 'search__input',
      attrs: { id: 'global-search', type: 'search', placeholder: 'Bijv. "transcriptie", "materialiteit" of "Facilitator"', autocomplete: 'off', enterkeyhint: 'search' }
    });
    input.value = initial;

    function group(title, items, renderItem) {
      if (!items.length) return null;
      return el('section', { className: 'section section--tight', attrs: { 'aria-label': title } }, [
        el('div', { className: 'section__head' }, [
          el('h2', { className: 'section__title' }, [el('span', { text: title }), el('span', { className: 'section__count', text: String(items.length) })])
        ]),
        el('ul', { className: 'card-grid', attrs: { role: 'list' } }, items.map((item) => el('li', {}, [renderItem(item)])))
      ]);
    }

    function update() {
      const query = input.value.trim();
      // Adres bijwerken zonder de pagina opnieuw op te bouwen (deelbare zoeklink)
      const hash = '#/zoeken' + (query ? '/' + encodeURIComponent(query) : '');
      if (window.location.hash !== hash) window.history.replaceState(window.history.state, '', hash);
      if (!query) {
        count.textContent = '';
        results.replaceChildren(el('p', { className: 'section__lead', text: 'Typ een of meer woorden. Je zoekt tegelijk in usecases, prompts, tips, trainingen en agents & tools.' }));
        return;
      }
      const found = ns.content.search(query);
      const total = found.usecases.length + found.prompts.length + found.tips.length + found.trainings.length + found.agents.length;
      count.textContent = total === 1 ? '1 resultaat' : total + ' resultaten';
      if (!total) {
        results.replaceChildren(emptyState(`Niets gevonden voor "${query}"`, 'Probeer een ander woord. Of laat het ons weten: misschien is dit precies een goed idee voor een nieuwe usecase of prompt.',
          ns.blocks.linkButton('#/ideeen/verzoek', 'message-plus', 'Doe een verzoek', 'btn--primary')));
        return;
      }
      results.replaceChildren(...[
        group('Usecases', found.usecases, (u) => ns.views.usecases.card(u, 'h3')),
        group('Prompts', found.prompts, (p) => ns.views.prompts.card(p, 'h3')),
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
      count,
      results
    ]);
    update();
    return {
      node,
      title: initial ? 'Zoeken: ' + initial : 'Zoeken',
      // Weg van deze pagina vlak na typen: het adres van de nieuwe pagina niet meer overschrijven
      destroy: () => window.clearTimeout(timer),
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
