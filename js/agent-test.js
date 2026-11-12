/* ==========================================================================
   Agents in testfase: testen en je ervaring delen
   --------------------------------------------------------------------------
   Een agent met de status 'Testfase' is nog geen geaccepteerde agent. Het
   AI-team haalt eerst testfeedback op, en raakt hij de kwaliteit, dan gaat hij
   ook langs vaktechniek (bijv. via een workflow in AFAS). In Beheer → Inhoud
   → Agents & tools: de testcriteria, tot wanneer, wie meetest en de stand bij
   vaktechniek.
   - Op de pagina van de agent: een opvallend blok met wat er getest wordt en
     de knop 'Deel je testervaring' (block).
   - Het formulier: per testcriterium een score van 1 tot 5, 'Zou je hem
     gebruiken?' en wat goed ging en beter kan (open). Dat wordt een inzending
     van de soort 'testfeedback' (stap 16): alleen het AI-team ziet hem, nooit
     openbaar. Op de pagina staat hoogstens hoe vaak er al getest is. Wie
     meedoet met de AI-brevetten, krijgt er AI-miles voor (per agent één keer,
     'test_shared' in js/brevet.js; signaal 'ai:getest').
   - In Beheer, bij de agent: de gemiddelden per criterium (summarize, js/admin-testfase.js).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage } = ns.ui;
  const KIND = 'testfeedback';
  const SHARED_KEY = 'testervaring'; // { <agent>: 'JJJJ-MM-DD' }: wanneer je voor het laatst je ervaring deelde
  const REVIEW = {
    '': { label: 'Nog niet bekeken door vaktechniek', tone: 'muted' },
    'niet-nodig': { label: 'Geen beoordeling nodig: raakt de kwaliteit niet', tone: 'neutral' },
    loopt: { label: 'De beoordeling door vaktechniek loopt', tone: 'info' },
    goedgekeurd: { label: 'Goedgekeurd door vaktechniek', tone: 'success' }
  };
  const USE = [{ id: 'ja', label: 'Ja' }, { id: 'misschien', label: 'Misschien' }, { id: 'nee', label: 'Nee' }];
  const SCORE_LABELS = ['', 'Slecht', 'Matig', 'Redelijk', 'Goed', 'Uitstekend'];
  const GENERAL = 'Hoe goed werkte hij, alles bij elkaar?';

  const longDate = (value) => new Date(value + 'T12:00:00').toLocaleDateString(ns.i18n ? ns.i18n.locale() : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  /** De vragen met een score: de testcriteria, of één algemene vraag als er geen zijn. */
  const criteriaOf = (agent) => (agent.testCriteria && agent.testCriteria.length ? agent.testCriteria : [GENERAL]);

  /**
   * Wat er bij een testervaring als details meegaat (stap 16): welke agent, 'zou je hem gebruiken' en per
   * criterium de score (null = niet beoordeeld). Kort gehouden: de database staat 2000 tekens toe.
   */
  function details(agent, scores, use) {
    return {
      agent: agent.id,
      use: USE.some((u) => u.id === use) ? use : 'misschien',
      scores: criteriaOf(agent).map((criterion, index) => {
        const s = Math.round(Number(scores[index]));
        return { c: String(criterion).slice(0, 80), s: s >= 1 && s <= 5 ? s : null };
      })
    };
  }

  /**
   * De testervaringen bij een agent samengevat (Beheer): { count, use: { ja, misschien, nee }, criteria:
   * [{ label, average (null zonder scores), n }] }. Een score hoort bij het criterium met dezelfde tekst; is
   * de tekst intussen aangepast, dan bij het criterium op dezelfde plek.
   */
  function summarize(agent, feedback) {
    const list = (Array.isArray(feedback) ? feedback : []).filter((item) => item && item.kind === KIND && item.details && item.details.agent === agent.id);
    const criteria = criteriaOf(agent).map((label) => ({ label, total: 0, n: 0 }));
    const use = { ja: 0, misschien: 0, nee: 0 };
    list.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(use, item.details.use)) use[item.details.use] += 1;
      (Array.isArray(item.details.scores) ? item.details.scores : []).forEach((score, index) => {
        const s = Number(score && score.s);
        if (!(s >= 1 && s <= 5)) return;
        const byText = criteria.find((c) => c.label.slice(0, 80) === String(score.c || ''));
        const target = byText || criteria[index];
        if (!target) return;
        target.total += s;
        target.n += 1;
      });
    });
    return {
      count: list.length,
      use,
      criteria: criteria.map((c) => ({ label: c.label, average: c.n ? Math.round((c.total / c.n) * 10) / 10 : null, n: c.n }))
    };
  }

  /* ---- Hoe vaak er al getest is (alleen het aantal) ------------------------------------- */
  let counts = null;
  function loadCounts() {
    if (!counts) {
      counts = ns.central.testerCounts().then((result) => new Map(result.status === 'ok'
        ? (result.items || []).map((row) => [String(row.agent_id), Number(row.testers) || 0])
        : []));
    }
    return counts;
  }

  const sharedOn = (id) => {
    const all = storage.get(SHARED_KEY, {});
    return all && typeof all === 'object' && typeof all[id] === 'string' ? all[id] : '';
  };
  function rememberShared(id) {
    const all = storage.get(SHARED_KEY, {}) || {};
    all[id] = ns.content.today();
    storage.set(SHARED_KEY, all);
  }

  /** Het label op de kaart: groot en duidelijk, zodat niemand denkt dat hij al geaccepteerd is. */
  function ribbon() {
    return el('p', { className: 'ag-test-ribbon' }, [icon('flask'), el('span', { text: 'Testfase · nog niet geaccepteerd' })]);
  }

  /** Hoeveel AI-miles een eerste testervaring bij een agent oplevert (js/brevet.js; 0 = geen brevetten of uitgezet). */
  function miles() {
    if (!ns.brevet || !ns.brevet.enabled()) return 0;
    try {
      return ns.brevet.rules().miles.test_shared || 0;
    } catch (error) {
      return 0;
    }
  }

  /* ---- Het blok op de pagina van de agent --------------------------------------------------- */
  function block(agent) {
    const review = REVIEW[agent.review] || REVIEW[''];
    const tested = el('div', { className: 'test-panel__fact', attrs: { hidden: true } });
    const facts = [
      el('div', { className: 'test-panel__fact' }, [el('dt', { text: 'Vaktechniek' }), el('dd', {}, [el('span', { className: 'status status--' + review.tone, text: review.label })])]),
      agent.testUntil ? el('div', { className: 'test-panel__fact' }, [el('dt', { text: 'Testen tot' }), el('dd', { attrs: { translate: 'no' }, text: longDate(agent.testUntil) })]) : null,
      el('div', { className: 'test-panel__fact' }, [el('dt', { text: 'Wie test mee' }), el('dd', { text: agent.testGroup || 'Iedereen die hem kan gebruiken' })]),
      tested
    ].filter(Boolean);
    loadCounts().then((map) => {
      const n = map.get(agent.id) || 0;
      if (!n) return;
      tested.replaceChildren(el('dt', { text: 'Gedeeld' }), el('dd', {}, [el('strong', { attrs: { translate: 'no' }, text: String(n) }), ' ', el('span', { text: n === 1 ? 'testervaring' : 'testervaringen' })]));
      tested.hidden = false;
    });
    const last = sharedOn(agent.id);
    const reward = last ? 0 : miles();
    const button = el('button', { className: 'btn btn--primary', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('flask'), el('span', { text: last ? 'Nog een testervaring delen' : 'Deel je testervaring' })]);
    button.addEventListener('click', () => open(agent));
    return el('section', { className: 'test-panel', attrs: { 'aria-labelledby': 'ag-test-title' } }, [
      el('div', { className: 'test-panel__head' }, [
        el('span', { className: 'test-panel__icon', attrs: { 'aria-hidden': 'true' } }, [icon('flask')]),
        el('div', {}, [
          el('p', { className: 'test-panel__eyebrow', text: 'Testfase' }),
          el('h2', { className: 'test-panel__title', attrs: { id: 'ag-test-title' }, text: 'Nog geen geaccepteerde agent' })
        ])
      ]),
      el('p', { className: 'test-panel__text', text: 'Het AI-team test deze agent nog met collega\'s. Je mag hem gebruiken om te testen, volgens wat er hieronder bij "Wat mag erin?" staat. Controleer de uitkomst extra en leg hem niet zonder meer vast in een dossier. Jouw ervaring helpt bepalen of hij geaccepteerd wordt.' }),
      el('dl', { className: 'test-panel__facts' }, facts),
      agent.testCriteria.length ? el('div', { className: 'test-panel__criteria' }, [
        el('h3', { className: 'test-panel__h', text: 'Waar we op letten' }),
        el('ul', { attrs: { role: 'list' } }, agent.testCriteria.map((criterion) => el('li', {}, [icon('checklist'), el('span', { text: criterion })])))
      ]) : null,
      el('div', { className: 'test-panel__actions' }, [
        button,
        last ? el('p', { className: 'test-panel__note' }, [icon('check-circle'), el('span', {}, ['Bedankt! Je deelde je ervaring op ', el('span', { attrs: { translate: 'no' }, text: longDate(last) }), '.'])]) : null,
        // AI-brevetten: een testervaring levert miles op (per agent één keer)
        reward ? el('p', { className: 'test-panel__miles' }, [icon('cap'), el('span', { text: `Doe je mee met de AI-brevetten? Je testervaring bij deze agent levert ${reward} AI-miles op.` })]) : null
      ].filter(Boolean))
    ].filter(Boolean));
  }

  /* ---- Het formulier --------------------------------------------------------------------------- */
  let uid = 0;
  function radios(name, options, labelledBy) {
    return el('div', { className: 'test-scale', attrs: { role: 'radiogroup', 'aria-labelledby': labelledBy } }, options.map((option) => {
      const id = name + '-' + option.value;
      return el('label', { className: 'test-scale__option', attrs: { for: id } }, [
        el('input', { attrs: { id, type: 'radio', name, value: option.value } }),
        el('span', { className: 'test-scale__value', text: option.label }),
        option.hint ? el('span', { className: 'test-scale__hint', text: option.hint }) : null
      ].filter(Boolean));
    }));
  }
  const picked = (group) => {
    const input = group.querySelector('input:checked');
    return input ? input.value : '';
  };

  function open(agent) {
    const id = 'test-' + (++uid);
    const opener = document.activeElement;
    const me = ns.profile ? ns.profile.get() : {};
    const criteria = criteriaOf(agent);
    const scoreGroups = criteria.map((criterion, index) => {
      const labelId = `${id}-c${index}`;
      const group = radios(`${id}-s${index}`, [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n), hint: n === 1 || n === 5 ? SCORE_LABELS[n] : '' })).concat([{ value: 'nvt', label: 'n.v.t.' }]), labelId);
      return { criterion, labelId, group };
    });
    const useGroup = radios(`${id}-use`, USE.map((u) => ({ value: u.id, label: u.label })), `${id}-use-label`);
    const good = el('textarea', { className: 'field__input field__textarea', attrs: { id: id + '-good', rows: '3', maxlength: '1500' } });
    const better = el('textarea', { className: 'field__input field__textarea', attrs: { id: id + '-better', rows: '3', maxlength: '1500' } });
    const name = el('input', { className: 'field__input', attrs: { id: id + '-name', type: 'text', maxlength: '100', autocomplete: 'name' } });
    name.value = me.naam || '';
    const email = el('input', { className: 'field__input', attrs: { id: id + '-email', type: 'email', maxlength: '254', autocomplete: 'email', inputmode: 'email', spellcheck: 'false' } });
    const account = ns.account ? ns.account.current() : null;
    if (account) email.value = account.email;
    const useError = el('p', { className: 'field__error', attrs: { id: id + '-use-error' } });
    const emailError = el('p', { className: 'field__error', attrs: { id: id + '-email-error' } });
    email.setAttribute('aria-describedby', id + '-email-error');
    email.addEventListener('input', () => {
      emailError.textContent = '';
      email.removeAttribute('aria-invalid');
    });
    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Annuleren' })]);
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('send'), el('span', { text: 'Versturen' })]);
    const optional = el('span', { className: 'field__optional', text: '(optioneel)' });
    let confirmSensitive = false;
    [good, better].forEach((input) => input.addEventListener('input', () => { confirmSensitive = false; }));

    const form = el('form', { className: 'improve__panel test-form', attrs: { novalidate: true } }, [
      el('div', { className: 'improve__head' }, [
        el('span', { className: 'improve__icon test-form__icon', attrs: { 'aria-hidden': 'true' } }, [icon('flask')]),
        el('div', {}, [
          el('h2', { className: 'improve__title', attrs: { id: id + '-heading' }, text: 'Deel je testervaring' }),
          el('p', { className: 'improve__subject', text: agent.title })
        ])
      ]),
      el('p', { className: 'test-form__intro', text: 'Hoe beviel het testen? Geef per punt een score van 1 (slecht) tot 5 (uitstekend), of n.v.t. als je het niet hebt kunnen beoordelen. Alleen het AI-team ziet je antwoorden.' }),
      ...scoreGroups.map((s) => el('fieldset', { className: 'field test-form__question' }, [
        el('legend', { className: 'field__label', attrs: { id: s.labelId }, text: s.criterion }),
        s.group
      ])),
      el('fieldset', { className: 'field test-form__question' }, [
        el('legend', { className: 'field__label', attrs: { id: id + '-use-label' }, text: 'Zou je hem gebruiken in je werk?' }),
        useGroup,
        useError
      ]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-good' } }, ['Wat ging goed? ', optional.cloneNode(true)]), good]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-better' } }, ['Wat kan beter, of ging mis? ', optional.cloneNode(true)]), better]),
      el('div', { className: 'field-row' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-name' } }, ['Je naam ', optional.cloneNode(true)]), name]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-email' } }, ['Je e-mailadres ', optional.cloneNode(true)]), email, emailError])
      ]),
      el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Noem geen klantnamen, dossier- of persoonsgegevens. Je ervaring ziet alleen het AI-team; hij komt nooit in de ideeënhub.' })]),
      formError,
      el('div', { className: 'improve__actions' }, [cancel, send])
    ]);
    const dialog = el('dialog', { className: 'improve quick test-dialog', attrs: { 'aria-labelledby': id + '-heading' } }, [form]);
    const close = () => {
      if (dialog.open) dialog.close();
    };
    cancel.addEventListener('click', close);
    dialog.append(ns.ui.closeButton(close));
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });

    function done() {
      const ok = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [el('span', { text: 'Sluiten' })]);
      ok.addEventListener('click', close);
      form.replaceChildren(el('div', { className: 'flyin-done is-sent' }, [
        el('span', { className: 'flyin-done__mark', attrs: { 'aria-hidden': 'true' } }, [icon('check-circle')]),
        el('h2', { className: 'flyin-done__title', attrs: { id: id + '-heading' }, text: 'Bedankt voor het testen' }),
        el('p', { className: 'flyin-done__text', text: 'Je ervaring is binnen bij het AI-team. Samen met die van andere testers bepaalt hij of de agent geaccepteerd wordt.' }),
        el('div', { className: 'improve__actions flyin-done__actions' }, [ok])
      ]));
      dialog.scrollTop = 0;
      ok.focus();
    }

    /** Versturen mislukt (geen verbinding, storing): het formulier blijft staan, je raakt niets kwijt. */
    function failed(text) {
      const copy = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('copy'), el('span', { text: 'Kopieer je ervaring' })]);
      copy.addEventListener('click', async () => {
        const ok = await ns.ui.copyText(text);
        ns.ui.toast(ok ? 'Je ervaring staat op het klembord' : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
      });
      formError.replaceChildren(
        el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Versturen lukte niet.' })]),
        el('p', { text: 'Je antwoorden staan er nog. Probeer het zo nog eens, of kopieer je ervaring en stuur hem via de ideeënhub.' }),
        el('div', { className: 'form-error__actions' }, [copy])
      );
      formError.hidden = false;
      formError.scrollIntoView({ block: 'nearest' });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.hidden = true;
      const use = picked(useGroup);
      useError.textContent = use ? '' : 'Kies of je hem zou gebruiken.';
      if (!use) {
        useGroup.querySelector('input').focus();
        return;
      }
      // Optioneel, maar als het er staat moet het een adres zijn (de database weigert de inzending anders)
      const address = email.value.trim();
      if (address && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
        emailError.textContent = 'Dit lijkt geen geldig e-mailadres.';
        email.setAttribute('aria-invalid', 'true');
        email.focus();
        return;
      }
      const goodText = good.value.trim();
      const betterText = better.value.trim();
      if (ns.ideas && ns.ideas.SENSITIVE.test(goodText + ' ' + betterText) && !confirmSensitive) {
        confirmSensitive = true;
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Dit lijkt op een BSN of rekeningnummer' })]), el('p', { text: 'Haal persoonsgegevens weg. Weet je zeker dat het mag, klik dan nog een keer op versturen.' }));
        formError.hidden = false;
        return;
      }
      const scores = scoreGroups.map((s) => picked(s.group));
      const info = details(agent, scores, use);
      const body = [
        'Testervaring: ' + agent.title,
        'Zou je hem gebruiken: ' + (USE.find((u) => u.id === use) || {}).label,
        ...info.scores.map((score) => `${score.c}: ${score.s ? score.s + ' van 5' : 'n.v.t.'}`),
        goodText ? 'Wat ging goed: ' + goodText : '',
        betterText ? 'Wat kan beter: ' + betterText : ''
      ].filter(Boolean).join('\n').slice(0, 4000);
      if (!ns.central.isEnabled()) {
        failed(body);
        return;
      }
      send.disabled = true;
      const ref = ns.ui.randomId();
      const title = ('Testervaring: ' + agent.title).slice(0, 140);
      const result = await ns.central.submitIdea({ ref, kind: KIND, title, body, phase: null, name: name.value.trim() || null, email: address || null, allowPublic: false, details: info });
      if (result === 'ok') {
        rememberShared(agent.id);
        // Voor je logboek (js/brevet.js): AI-miles, per agent één keer, als je meedoet
        document.dispatchEvent(new CustomEvent('ai:getest', { detail: { id: agent.id } }));
        if (ns.ideas) ns.ideas.rememberSubmission({ ref, kind: KIND, title, at: new Date().toISOString() });
        done();
        return;
      }
      send.disabled = false;
      failed(body);
    });

    document.body.append(dialog);
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  ns.agentTest = { KIND, REVIEW, USE, GENERAL, criteriaOf, details, summarize, loadCounts, miles, ribbon, block, open };
})(window.AIAudit);
