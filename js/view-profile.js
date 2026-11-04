/* ==========================================================================
   Mijn logboek (#/mijn): je AI-brevet en je gegevens
   --------------------------------------------------------------------------
   Bovenaan je logboek met AI-miles en brevetten (js/view-logbook.js), daaronder
   Mijn gegevens: één keer invullen, voortaan in iedere prompt. Die bewaart meteen
   (alleen in deze browser, zie js/profile.js). Rechts zie je hoe het in een prompt
   komt te staan, en hoeveel prompts het scheelt.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, pageHeader, toast } = ns.ui;

  // Voorbeeld: wat ingevuld wordt, en wat (klantgegevens) altijd open blijft
  const SAMPLE = 'Schrijf een korte e-mail aan [KLANTNAAM] met de planning voor boekjaar [JAAR] en de stukken die ik nog nodig heb; vergelijk waar nodig met [VORIG JAAR]. Onderteken met [NAAM], [FUNCTIE], [VESTIGING].';

  /** Prompts in deze cockpit waarin je gegevens iets invullen. */
  function coverage() {
    const all = ns.content.prompts;
    const texts = (prompt) => [prompt.prompt, prompt.promptBasic].concat(prompt.followUps.map((step) => step.text));
    return { count: all.filter((prompt) => texts(prompt).some(ns.profile.canFill)).length, total: all.length };
  }

  function render() {
    const values = ns.profile.get();
    const inputs = {};
    const status = el('p', { className: 'mine__status', attrs: { role: 'status' } });
    const sample = el('pre', { className: 'prompt-box__text mine__sample', attrs: { tabindex: '0', role: 'region', 'aria-label': 'Voorbeeld van een prompt' } });

    function showSample() {
      const mine = ns.profile.values(SAMPLE);
      sample.replaceChildren(...ns.ui.promptNodes(SAMPLE, mine, Object.keys(mine)));
    }

    const field = (def) => {
      const id = 'mine-' + def.id;
      const input = el('input', { className: 'field__input', attrs: { id, type: 'text', maxlength: '120', autocomplete: def.autocomplete, placeholder: def.hint, spellcheck: 'false', 'aria-describedby': id + '-hint' } });
      input.value = values[def.id];
      inputs[def.id] = input;
      const list = def.options ? el('datalist', { attrs: { id: id + '-list' } }, def.options.map((option) => el('option', { attrs: { value: option } }))) : null;
      if (list) input.setAttribute('list', id + '-list');
      const fills = def.placeholders.slice(0, 2).map((name) => '[' + name + ']').join(' en ');
      return el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: id } }, [def.label, ' ', el('span', { className: 'field__optional', text: '(optioneel)' })]),
        input,
        list,
        el('p', { className: 'field__hint', attrs: { id: id + '-hint' }, text: fills ? 'Vult ' + fills + ' in.' : 'Alleen als achtergrond in de promptbouwer. Geen klantnamen.' })
      ]);
    };

    // Boekjaar: niet invullen, automatisch, of een vast jaar
    const thisYear = Number(ns.content.today().slice(0, 4));
    const year = el('select', { className: 'field__input', attrs: { id: 'mine-boekjaar', 'aria-describedby': 'mine-boekjaar-hint' } }, [
      el('option', { attrs: { value: '' }, text: 'Niet invullen' }),
      el('option', { attrs: { value: 'auto' }, text: `Automatisch (nu ${ns.profile.autoYear()})` }),
      ...[thisYear + 1, thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map((y) => el('option', { attrs: { value: String(y) }, text: String(y) }))
    ]);
    year.value = values.boekjaar;
    inputs.boekjaar = year;

    // Rol: kiezen, of laten afleiden uit je functie (trainingen voor jouw rol staan dan bovenaan)
    const roleLabel = (id) => (ns.profile.ROLES.find((r) => r.id === id) || {}).label || '';
    const derivedOption = el('option', { attrs: { value: '' } });
    const role = el('select', { className: 'field__input', attrs: { id: 'mine-rol', 'aria-describedby': 'mine-rol-hint' } }, [
      derivedOption,
      ...ns.profile.ROLES.map((r) => el('option', { attrs: { value: r.id }, text: r.label }))
    ]);
    const syncDerived = () => {
      const derived = ns.profile.roleOf(inputs.functie ? inputs.functie.value : values.functie);
      derivedOption.textContent = derived ? `Uit je functie (${roleLabel(derived)})` : 'Niet opgeven';
    };
    role.value = values.rol;
    inputs.rol = role;

    let timer = 0;
    function store() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        ns.profile.set(Object.fromEntries(Object.entries(inputs).map(([id, input]) => [id, input.value])));
        status.replaceChildren(icon('check-circle'), el('span', { text: 'Bewaard op dit apparaat' }));
        showSample();
      }, 250);
    }
    const wipe = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Gegevens wissen' })]);
    wipe.addEventListener('click', async () => {
      if (!(await ns.ui.confirmDialog('Je naam, functie en de rest worden van dit apparaat gewist. Prompts tonen dan weer de plaatshouders.', { title: 'Gegevens wissen?', confirmLabel: 'Wissen', danger: true }))) return;
      ns.profile.clear();
      Object.values(inputs).forEach((input) => {
        input.value = '';
      });
      status.replaceChildren();
      showSample();
      toast('Gewist');
    });

    // Taal van de cockpit (js/i18n.js): wisselen laadt de pagina opnieuw. Tweetalig, zodat je hem altijd vindt.
    const language = el('select', { className: 'field__input', attrs: { id: 'mine-taal', 'aria-describedby': 'mine-taal-hint' } }, [
      el('option', { attrs: { value: 'nl', translate: 'no' }, text: 'Nederlands' }),
      el('option', { attrs: { value: 'en', translate: 'no' }, text: 'English' })
    ]);
    language.value = ns.i18n.lang();
    language.addEventListener('change', () => ns.i18n.set(language.value));

    const form = el('form', { className: 'form-card mine__form', attrs: { novalidate: true, 'aria-labelledby': 'mine-form-title' } }, [
      el('div', { className: 'field mine__language' }, [
        el('label', { className: 'field__label', attrs: { for: 'mine-taal', translate: 'no' }, text: 'Taal / Language' }),
        language,
        el('p', { className: 'field__hint', attrs: { id: 'mine-taal-hint' }, text: 'De knoppen en uitleg van de cockpit. Prompts en andere inhoud staan in het Engels zodra ze vertaald zijn.' })
      ]),
      el('h2', { className: 'form-card__title', attrs: { id: 'mine-form-title' }, text: 'Wie ben je?' }),
      el('div', { className: 'mine__fields' }, [
        ...ns.profile.FIELDS.map(field),
        el('div', { className: 'field' }, [
          el('label', { className: 'field__label', attrs: { for: 'mine-rol' } }, ['Je rol ', el('span', { className: 'field__optional', text: '(optioneel)' })]),
          role,
          el('p', { className: 'field__hint', attrs: { id: 'mine-rol-hint' }, text: 'Trainingen voor jouw rol staan bovenaan, met "Voor jou". Je ziet de andere gewoon ook.' })
        ]),
        el('div', { className: 'field' }, [
          el('label', { className: 'field__label', attrs: { for: 'mine-boekjaar' }, text: 'Boekjaar waar je mee bezig bent' }),
          year,
          el('p', { className: 'field__hint', attrs: { id: 'mine-boekjaar-hint' }, text: 'Vult [JAAR] en [VORIG JAAR] in. Automatisch: tot en met juni het vorige jaar, daarna dit jaar.' })
        ])
      ]),
      el('div', { className: 'mine__foot' }, [status, wipe])
    ]);
    form.addEventListener('submit', (event) => event.preventDefault());
    // Pas nu bestaan alle velden (de tekstvelden ontstaan bij het opbouwen van het formulier)
    Object.values(inputs).forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', store));
    syncDerived();
    inputs.functie.addEventListener('input', syncDerived);

    const reach = coverage();
    const aside = el('aside', { className: 'mine__aside', attrs: { 'aria-labelledby': 'mine-sample-title' } }, [
      el('h2', { className: 'mine__title', attrs: { id: 'mine-sample-title' } }, [icon('sparkle'), el('span', { text: 'Zo staat het in een prompt' })]),
      sample,
      el('p', { className: 'mine__legend' }, [
        el('mark', { className: 'ph ph--filled ph--mine', text: 'Groen' }), ' komt uit je gegevens. ',
        el('mark', { className: 'ph', text: '[KLANTNAAM]' }), ' blijft open: klantgegevens vul je per prompt in, en die worden nergens bewaard.'
      ]),
      reach.count ? el('p', { className: 'mine__reach' }, [
        el('strong', { text: `${reach.count} van de ${reach.total} prompts` }),
        ` in de cockpit van ${ns.cockpit.active().name} vullen je gegevens (deels) voor je in. Ook in de promptbouwer, bij kopiëren vanaf een kaart en in het zoekvenster (Ctrl+K).`
      ]) : null,
      el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Alleen in deze browser bewaard, nooit verstuurd. Op een ander apparaat vul je het opnieuw in.' })])
    ]);
    showSample();

    const logbook = ns.views.logbook.section();
    const withLogbook = Boolean(logbook.node);
    // Je tijdwinst (js/tijdwinst.js) en de Kickstart (js/kickstart.js), ook als je niet meedoet met de brevetten
    const time = ns.tijdwinst.card();
    const kickstart = ns.kickstart.card({ place: 'mijn' });
    kickstart.node.classList.remove('section', 'container');
    const node = el('div', { className: 'page container' }, [
      pageHeader(withLogbook
        ? { eyebrow: 'Persoonlijk', title: 'Mijn logboek', lead: 'Je tijdwinst, je AI-brevet en je AI-miles, en je gegevens: één keer invullen, daarna staan je naam, functie en boekjaar al in iedere prompt.' }
        : { eyebrow: 'Persoonlijk', title: 'Mijn gegevens', lead: 'Vul één keer in wie je bent. Daarna staan je naam, functie en boekjaar al in iedere prompt: onder een e-mail, in een rolomschrijving, bij de vergelijking met vorig jaar.' }),
      el('div', { className: 'mine-top' }, [time.node, kickstart.node]),
      logbook.node,
      withLogbook ? el('h2', { className: 'section__title mine__heading', text: 'Mijn gegevens' }) : null,
      el('div', { className: 'mine' }, [form, aside])
    ]);
    return {
      node,
      title: withLogbook ? 'Mijn logboek' : 'Mijn gegevens',
      // Weg vlak na typen: nog even bewaren
      destroy: () => {
        logbook.destroy();
        time.destroy();
        kickstart.destroy();
        if (!timer) return;
        window.clearTimeout(timer);
        ns.profile.set(Object.fromEntries(Object.entries(inputs).map(([id, input]) => [id, input.value])));
      }
    };
  }

  ns.views = ns.views || {};
  ns.views.profile = { render };
})(window.AIAudit);
