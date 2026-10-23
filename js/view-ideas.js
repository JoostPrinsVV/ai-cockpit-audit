/* ==========================================================================
   Ideeënhub (#/ideeen, of #/ideeen/<soort> met de soort alvast gekozen)
   --------------------------------------------------------------------------
   - Insturen: idee, vraag, verzoek of een prompt delen. Gaat direct naar
     de centrale opslag; op dit apparaat bewaren we alleen titel, soort en
     een willekeurige referentie (voor 'Jouw inzendingen').
   - Uit de hub: inzendingen die een beheerder heeft gepubliceerd, met
     status, antwoord en 'Ik ook'-stemmen. Nooit met naam of e-mailadres.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, chip, toast, storage, accentClass, pageHeader, toggleGroup, copyText, formatDate } = ns.ui;

  const KINDS = [
    {
      id: 'idee', label: 'Idee', icon: 'bulb', accent: 'teal',
      text: 'Een toepassing of usecase die je graag zou zien.',
      titleHint: 'Bijv. "Copilot bij het beoordelen van de vpb-aangifte"',
      bodyHint: 'Bij welke werkzaamheden? Wat zou Copilot moeten doen, en wat levert het op?'
    },
    {
      id: 'vraag', label: 'Vraag', icon: 'question', accent: 'steel',
      text: 'Iets wat je niet lukt of wat je wilt weten.',
      titleHint: 'Bijv. "Hoe laat ik Copilot een PDF met tabellen goed lezen?"',
      bodyHint: 'Wat probeerde je, wat ging er mis en wat had je verwacht? Noem geen klantgegevens.'
    },
    {
      id: 'verzoek', label: 'Verzoek', icon: 'flag', accent: 'rose',
      text: 'Een demo, prompt, training of sessie voor je team.',
      titleHint: 'Bijv. "Demo van Analyst voor ons team"',
      bodyHint: 'Wat wil je, voor wie en wanneer zou het mooi zijn?'
    },
    {
      id: 'prompt', label: 'Prompt delen', icon: 'chat', accent: 'crimson',
      text: 'Een prompt die goed werkt en die anderen ook kunnen gebruiken.',
      titleHint: 'Bijv. "Prompt voor het vergelijken van twee proefsaldibalansen"',
      bodyHint: 'Plak de prompt en vertel kort waarvoor je hem gebruikt. Vervang klantnamen door [KLANTNAAM].'
    }
  ];
  const KIND_BY_ID = new Map(KINDS.map((kind) => [kind.id, kind]));

  const STATUSES = {
    'nieuw': { label: 'Ontvangen', tone: 'neutral' },
    'in-behandeling': { label: 'In behandeling', tone: 'info' },
    'gepland': { label: 'Opgepakt', tone: 'info' },
    'gerealiseerd': { label: 'Gerealiseerd', tone: 'success' },
    'beantwoord': { label: 'Beantwoord', tone: 'success' },
    'afgewezen': { label: 'Niet opgepakt', tone: 'muted' }
  };

  // BSN (9 cijfers) of Nederlands IBAN: waarschuwen vóór versturen
  const SENSITIVE = /\b\d{9}\b|\bNL\d{2}\s?[A-Z]{4}(\s?\d){10}\b/i;
  const listState = { kind: 'all', sort: 'new' };

  function statusBadge(status) {
    const info = STATUSES[status] || STATUSES.nieuw;
    return el('span', { className: 'status status--' + info.tone, text: info.label });
  }

  function kindChip(kindId) {
    const kind = KIND_BY_ID.get(kindId) || KINDS[0];
    return el('span', { className: 'chip chip--accent ' + accentClass(kind.accent) }, [icon(kind.icon), kind.label]);
  }

  /* ---- Eigen inzendingen (alleen op dit apparaat) ---------------------------------- */
  function mySubmissions() {
    const value = storage.get('submissions', []);
    return Array.isArray(value) ? value : [];
  }

  function rememberSubmission(entry) {
    const list = mySubmissions();
    list.unshift(entry);
    storage.set('submissions', list.slice(0, 50));
  }

  function voterId() {
    let id = storage.get('voterId', '');
    if (!id) {
      id = ns.ui.randomId();
      storage.set('voterId', id);
    }
    return id;
  }

  function myVotes() {
    const value = storage.get('votes', []);
    return Array.isArray(value) ? value : [];
  }

  /* ---- Formulier --------------------------------------------------------------------- */
  function buildForm(config, preselect, onSent) {
    const maxBody = Number(config.ideaMaxLength) || 2000;
    let kind = KIND_BY_ID.has(preselect) ? preselect : 'idee';
    let confirmSensitive = false;

    const kindPicker = el('fieldset', { className: 'kind-picker' }, [
      el('legend', { className: 'field__label', text: 'Wat wil je insturen?' }),
      el('div', { className: 'kind-picker__grid' }, KINDS.map((item) => {
        const input = el('input', { className: 'kind-picker__input', attrs: { type: 'radio', name: 'kind', value: item.id, id: 'kind-' + item.id, checked: item.id === kind } });
        input.addEventListener('change', () => {
          kind = item.id;
          applyKind();
        });
        return el('div', { className: 'kind-picker__item ' + accentClass(item.accent) }, [
          input,
          el('label', { className: 'kind-picker__label', attrs: { for: 'kind-' + item.id } }, [
            el('span', { className: 'kind-picker__icon', attrs: { 'aria-hidden': 'true' } }, [icon(item.icon)]),
            el('span', { className: 'kind-picker__name', text: item.label }),
            el('span', { className: 'kind-picker__text', text: item.text })
          ])
        ]);
      }))
    ]);

    const title = el('input', { className: 'field__input', attrs: { id: 'idea-title', name: 'title', type: 'text', maxlength: '120', required: true, autocomplete: 'off', 'aria-describedby': 'idea-title-error' } });
    const titleError = el('p', { className: 'field__error', attrs: { id: 'idea-title-error' } });
    const bodyHint = el('p', { className: 'field__hint', attrs: { id: 'idea-body-hint' } });
    const body = el('textarea', { className: 'field__input field__textarea', attrs: { id: 'idea-body', name: 'body', rows: '7', maxlength: String(maxBody), required: true, 'aria-describedby': 'idea-body-hint idea-body-error idea-body-counter' } });
    const bodyError = el('p', { className: 'field__error', attrs: { id: 'idea-body-error' } });
    const counter = el('p', { className: 'field__counter', attrs: { id: 'idea-body-counter' }, text: `0/${maxBody}` });
    body.addEventListener('input', () => {
      counter.textContent = `${body.value.length}/${maxBody}`;
      confirmSensitive = false;
    });
    title.addEventListener('input', () => {
      confirmSensitive = false;
    });

    const phase = el('select', { className: 'field__input', attrs: { id: 'idea-phase', name: 'phase' } }, [
      el('option', { attrs: { value: '' }, text: 'Geen specifieke fase' }),
      ...ns.content.phases.map((p) => el('option', { attrs: { value: p.id }, text: p.label }))
    ]);
    const name = el('input', { className: 'field__input', attrs: { id: 'idea-name', name: 'name', type: 'text', maxlength: '100', autocomplete: 'name' } });
    const email = el('input', { className: 'field__input', attrs: { id: 'idea-email', name: 'email', type: 'email', maxlength: '254', autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'idea-email-hint idea-email-error' } });
    const emailError = el('p', { className: 'field__error', attrs: { id: 'idea-email-error' } });
    const allowPublic = el('input', { attrs: { id: 'idea-public', type: 'checkbox', checked: true } });

    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const submit = el('button', { className: 'btn btn--primary btn--lg', attrs: { type: 'submit' } }, [icon('send'), el('span', { text: 'Versturen' })]);

    const form = el('form', { className: 'idea-form', attrs: { novalidate: true } }, [
      kindPicker,
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Titel', attrs: { for: 'idea-title' } }), title, titleError]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Toelichting', attrs: { for: 'idea-body' } }), bodyHint, body, el('div', { className: 'field__meta' }, [bodyError, counter])]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'idea-phase' } }, ['Fase ', el('span', { className: 'field__optional', text: '(optioneel)' })]), phase]),
      el('div', { className: 'field-row' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'idea-name' } }, ['Naam ', el('span', { className: 'field__optional', text: '(optioneel)' })]), name]),
        el('div', { className: 'field' }, [
          el('label', { className: 'field__label', attrs: { for: 'idea-email' } }, ['E-mailadres ', el('span', { className: 'field__optional', text: '(optioneel)' })]),
          email,
          el('p', { className: 'field__hint', attrs: { id: 'idea-email-hint' }, text: 'Alleen als je persoonlijk antwoord wilt.' }),
          emailError
        ])
      ]),
      el('label', { className: 'check', attrs: { for: 'idea-public' } }, [allowPublic, el('span', { text: 'Mijn inzending mag zichtbaar worden in de hub, zonder naam en e-mailadres, zodat collega\'s het antwoord ook zien.' })]),
      el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Noem geen klantnamen, dossier- of persoonsgegevens. Je naam en e-mailadres ziet alleen het AI-team.' })]),
      formError,
      submit
    ]);

    function applyKind() {
      const info = KIND_BY_ID.get(kind);
      title.placeholder = info.titleHint;
      bodyHint.textContent = info.bodyHint;
      body.placeholder = kind === 'prompt' ? 'Plak hier je prompt…' : '';
    }
    applyKind();

    function setError(input, node, message) {
      node.textContent = message;
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function validate() {
      let first = null;
      const t = title.value.trim();
      const b = body.value.trim();
      const e = email.value.trim();
      setError(title, titleError, t.length < 3 ? 'Geef je inzending een korte titel (minimaal 3 tekens).' : '');
      if (t.length < 3) first = first || title;
      setError(body, bodyError, b.length < 10 ? 'Vertel iets meer (minimaal 10 tekens).' : '');
      if (b.length < 10) first = first || body;
      const emailOk = !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
      setError(email, emailError, emailOk ? '' : 'Dit lijkt geen geldig e-mailadres.');
      if (!emailOk) first = first || email;
      return first;
    }

    function showFailure(result, payload) {
      const message = result === 'missing'
        ? 'De ideeënhub is nog niet aangesloten op de centrale opslag.'
        : result === 'off'
          ? 'De centrale opslag staat uit in de instellingen.'
          : 'Versturen lukte niet. Controleer je internetverbinding en probeer het nog eens.';
      const text = `${KIND_BY_ID.get(payload.kind).label}: ${payload.title}\n\n${payload.body}`;
      const actions = [
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: async () => {
          const ok = await copyText(text);
          toast(ok ? 'Je tekst staat op het klembord' : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
        } } }, [icon('copy'), el('span', { text: 'Kopieer je tekst' })])
      ];
      if (config.ideaFallbackEmail) {
        const href = 'mailto:' + encodeURIComponent(config.ideaFallbackEmail) +
          '?subject=' + encodeURIComponent('Ideeënhub: ' + payload.title) +
          '&body=' + encodeURIComponent(text);
        actions.unshift(el('a', { className: 'btn btn--secondary btn--sm', attrs: { href } }, [icon('mail'), el('span', { text: 'Stuur per e-mail' })]));
      }
      formError.replaceChildren(
        el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: message })]),
        el('p', { text: 'Je tekst staat nog in het formulier.' + (config.ideaFallbackEmail ? ' Je kunt hem ook per e-mail sturen.' : ' Kopieer hem eventueel, dan raak je niets kwijt.') }),
        el('div', { className: 'form-error__actions' }, actions)
      );
      formError.hidden = false;
      formError.scrollIntoView({ block: 'nearest' });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.hidden = true;
      const invalid = validate();
      if (invalid) {
        invalid.focus();
        return;
      }
      const payload = {
        ref: ns.ui.randomId(),
        kind,
        title: title.value.trim(),
        body: body.value.trim(),
        phase: phase.value,
        name: name.value.trim(),
        email: email.value.trim(),
        allowPublic: allowPublic.checked
      };
      if (!confirmSensitive && SENSITIVE.test(payload.title + ' ' + payload.body)) {
        confirmSensitive = true;
        formError.replaceChildren(
          el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Staat hier een BSN of rekeningnummer in?' })]),
          el('p', { text: 'Je tekst bevat een reeks cijfers die op een BSN of IBAN lijkt. Haal persoons- en klantgegevens weg. Weet je zeker dat het goed is? Klik dan nog een keer op Versturen.' })
        );
        formError.hidden = false;
        return;
      }
      submit.disabled = true;
      submit.querySelector('span').textContent = 'Versturen…';
      const result = await ns.central.submitIdea(payload);
      submit.disabled = false;
      submit.querySelector('span').textContent = 'Versturen';
      if (result === 'ok') {
        rememberSubmission({ ref: payload.ref, kind: payload.kind, title: payload.title, at: new Date().toISOString() });
        form.reset();
        counter.textContent = `0/${maxBody}`;
        allowPublic.checked = true;
        const radio = form.querySelector(`input[value="${kind}"]`);
        if (radio) radio.checked = true;
        onSent(payload);
      } else {
        showFailure(result, payload);
      }
    });

    return form;
  }

  /* ---- Lijst met gepubliceerde inzendingen --------------------------------------------- */
  function ideaItem(item, mine) {
    const kind = KIND_BY_ID.get(item.kind) || KINDS[0];
    const voted = myVotes().includes(item.id);
    const bodyNode = el('p', { className: 'idea__body', text: item.body });
    const long = item.body && item.body.length > 320;
    let more = null;
    if (long) {
      bodyNode.classList.add('is-clamped');
      more = el('button', { className: 'idea__more', attrs: { type: 'button', 'aria-expanded': 'false' }, text: 'Lees meer' });
      more.addEventListener('click', () => {
        const open = bodyNode.classList.toggle('is-clamped') === false;
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? 'Minder' : 'Lees meer';
      });
    }
    const phase = item.phase ? ns.content.phaseById.get(item.phase) : null;

    let voteButton = null;
    if (ns.config.enableVotes !== false) {
      let count = Number(item.votes) || 0;
      const countNode = el('span', { className: 'vote__count', text: String(count) });
      voteButton = el('button', { className: 'vote', attrs: { type: 'button', 'aria-pressed': String(voted), 'aria-label': `Ik ook: ${item.title} (${count} stemmen)` } }, [icon('thumb'), el('span', { text: 'Ik ook' }), countNode]);
      voteButton.addEventListener('click', async () => {
        if (voteButton.getAttribute('aria-pressed') === 'true') {
          toast('Je hebt hier al voor gestemd');
          return;
        }
        voteButton.disabled = true;
        const result = await ns.central.vote(item.id, voterId());
        voteButton.disabled = false;
        if (result === 'ok' || result === 'duplicate') {
          if (result === 'ok') count += 1;
          countNode.textContent = String(count);
          voteButton.setAttribute('aria-pressed', 'true');
          voteButton.setAttribute('aria-label', `Ik ook: ${item.title} (${count} stemmen)`);
          storage.set('votes', myVotes().concat(item.id));
          if (result === 'ok') toast('Bedankt! Je stem is meegeteld.', { tone: 'success' });
        } else {
          toast('Stemmen lukte niet. Probeer het later nog eens.', { tone: 'warning' });
        }
      });
    }

    return el('article', { className: 'idea ' + accentClass(kind.accent), attrs: { id: 'idea-' + item.id } }, [
      el('div', { className: 'idea__head' }, [
        kindChip(item.kind),
        statusBadge(item.status),
        mine ? el('span', { className: 'badge badge--mine' }, [icon('star-filled'), 'Jouw inzending']) : null,
        el('span', { className: 'idea__date', text: formatDate(item.created_at) })
      ]),
      el('h3', { className: 'idea__title', text: item.title }),
      bodyNode,
      more,
      item.answer ? el('div', { className: 'idea__answer' }, [
        el('p', { className: 'idea__answer-label' }, [icon('chat'), el('span', { text: 'Reactie van het AI-team' + (item.answered_at ? ' · ' + formatDate(item.answered_at) : '') })]),
        el('p', { className: 'idea__answer-text', text: item.answer })
      ]) : null,
      el('div', { className: 'idea__foot' }, [
        phase ? chip(phase.short, { icon: phase.icon }) : el('span'),
        voteButton
      ])
    ]);
  }

  function hubList(mineList) {
    const wrap = el('section', { className: 'section section--tight hub', attrs: { 'aria-labelledby': 'hub-title' } });
    const listNode = el('div', { className: 'hub__list', attrs: { 'aria-busy': 'true' } });
    const status = el('div', { className: 'hub__status' }, [el('p', { className: 'loading', text: 'Inzendingen laden…' })]);
    let items = [];
    let loaded = false;

    function update() {
      if (!loaded) return;
      const mineRefs = new Set(mySubmissions().map((s) => s.ref));
      const filtered = items.filter((item) => listState.kind === 'all' || item.kind === listState.kind);
      filtered.sort((a, b) => listState.sort === 'votes'
        ? (b.votes || 0) - (a.votes || 0) || (a.created_at < b.created_at ? 1 : -1)
        : (a.created_at < b.created_at ? 1 : -1));
      listNode.replaceChildren(...filtered.map((item) => ideaItem(item, mineRefs.has(item.ref))));
      if (!filtered.length) {
        listNode.append(ns.ui.emptyState(items.length ? 'Nog niets in deze categorie' : 'Nog niets gepubliceerd',
          'Zodra het AI-team inzendingen beantwoordt of oppakt, verschijnen ze hier. Stuur gerust de eerste in!', null, 'message-plus'));
      }
    }

    // Na filteren alleen het aantal voorlezen, niet de hele lijst
    const announceCount = () => ns.ui.announce(listNode.querySelectorAll('.idea').length + ' inzendingen');
    const kindGroup = toggleGroup('Filter op soort', [{ value: 'all', label: 'Alles' }].concat(KINDS.map((k) => ({ value: k.id, label: k.label, icon: k.icon }))), listState.kind, (value) => {
      listState.kind = value;
      update();
      announceCount();
    }, { className: 'toggles--compact', animate: false });
    const sort = el('select', { className: 'field__input field__input--sm', attrs: { id: 'hub-sort', 'aria-label': 'Sorteren' } }, [
      el('option', { attrs: { value: 'new' }, text: 'Nieuwste eerst' }),
      el('option', { attrs: { value: 'votes' }, text: 'Meeste stemmen' })
    ]);
    sort.value = listState.sort;
    sort.addEventListener('change', () => {
      listState.sort = sort.value;
      update();
    });

    wrap.append(
      el('div', { className: 'section__head' }, [el('h2', { className: 'section__title', text: 'Uit de hub', attrs: { id: 'hub-title' } })]),
      el('p', { className: 'section__lead', text: 'Ideeën, vragen en verzoeken van collega\'s, met de reactie van het AI-team. Herken je iets? Stem met "Ik ook", dan weten we wat het meest leeft.' }),
      el('div', { className: 'filters filters--inline' }, [kindGroup, el('label', { className: 'sr-only', text: 'Sorteren', attrs: { for: 'hub-sort' } }), sort]),
      status,
      listNode
    );

    // Ophalen; bij 'Opnieuw' alleen deze lijst (een half ingevuld formulier blijft staan)
    function load() {
      listNode.setAttribute('aria-busy', 'true');
      status.replaceChildren(el('p', { className: 'loading', text: 'Inzendingen laden…' }));
      ns.central.listIdeas().then((result) => {
        listNode.setAttribute('aria-busy', 'false');
        if (result.status === 'ok') {
          items = result.items;
          loaded = true;
          status.replaceChildren();
          update();
          mineList.updateStatuses(items);
          return;
        }
        const message = result.status === 'missing'
          ? ['De ideeënhub wordt nog aangesloten', 'Zodra de centrale opslag klaarstaat, zie je hier de inzendingen van collega\'s. (Beheer: voer setup/supabase-audit.sql uit.)']
          : result.status === 'off'
            ? ['Centrale opslag staat uit', 'In de instellingen (js/config.js) is geen centrale opslag ingesteld.']
            : ['Inzendingen laden lukte niet', 'Controleer je internetverbinding en probeer het opnieuw.'];
        status.replaceChildren(el('div', { className: 'notice' }, [
          icon('info'),
          el('div', {}, [el('p', { className: 'notice__title', text: message[0] }), el('p', { text: message[1] })]),
          result.status === 'failed' ? el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Opnieuw' })]) : null
        ]));
      });
    }
    load();

    return wrap;
  }

  /** 'Jouw inzendingen' op dit apparaat, met status zodra ze gepubliceerd zijn. */
  function mineBlock() {
    const wrap = el('section', { className: 'side-card', attrs: { 'aria-labelledby': 'mine-title' } });
    let published = new Map();

    function render() {
      const list = mySubmissions();
      wrap.hidden = list.length === 0;
      if (!list.length) return;
      wrap.replaceChildren(
        el('h2', { className: 'side-card__title', attrs: { id: 'mine-title' } }, [icon('star'), el('span', { text: 'Jouw inzendingen' })]),
        el('p', { className: 'side-card__text', text: 'Op dit apparaat. Zodra het AI-team reageert en je inzending publiceert, zie je hier de status.' }),
        el('ul', { className: 'mine', attrs: { role: 'list' } }, list.slice(0, 8).map((entry) => {
          const item = published.get(entry.ref);
          return el('li', { className: 'mine__item' }, [
            kindChip(entry.kind),
            el('span', { className: 'mine__title' }, [item ? el('a', { attrs: { href: '#idea-' + item.id }, text: entry.title, on: { click: (event) => {
              event.preventDefault();
              const target = document.getElementById('idea-' + item.id);
              if (target) target.scrollIntoView({ behavior: ns.motion.calm() ? 'auto' : 'smooth', block: 'center' });
            } } }) : entry.title]),
            item ? statusBadge(item.status) : el('span', { className: 'status status--neutral', text: 'Ontvangen' }),
            el('span', { className: 'mine__date', text: formatDate(entry.at) })
          ]);
        })),
        el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' }, on: { click: () => {
          storage.remove('submissions');
          render();
          toast('Lijst gewist van dit apparaat. Je inzendingen zelf blijven bewaard.');
        } } }, [icon('trash'), el('span', { text: 'Vergeet deze lijst' })])
      );
    }

    render();
    return {
      node: wrap,
      render,
      updateStatuses(items) {
        published = new Map(items.filter((item) => item.ref).map((item) => [item.ref, item]));
        render();
      }
    };
  }

  function render(params, config) {
    const preselect = params[0] || '';
    const mine = mineBlock();
    const formCard = el('section', { className: 'form-card', attrs: { 'aria-labelledby': 'idea-form-title' } });
    const done = el('div', { className: 'done', attrs: { hidden: true, tabindex: '-1' } });

    function showForm() {
      done.hidden = true;
      form.hidden = false;
      const title = form.querySelector('#idea-title');
      if (title) title.focus();
    }

    const form = config.enableIdeas === false
      ? el('p', { text: 'Insturen staat op dit moment uit.' })
      : buildForm(config, preselect, (payload) => {
        form.hidden = true;
        done.replaceChildren(
          el('span', { className: 'done__icon', attrs: { 'aria-hidden': 'true' } }, [icon('check-circle')]),
          el('h3', { className: 'done__title', text: 'Dank je wel, je inzending is ontvangen!' }),
          el('p', { text: payload.allowPublic
            ? 'Het AI-team bekijkt alles. Een antwoord of opgepakt idee verschijnt hieronder in de hub' + (payload.email ? ', en je krijgt persoonlijk bericht.' : '.')
            : 'Het AI-team bekijkt alles. Je inzending blijft privé' + (payload.email ? '; je krijgt persoonlijk bericht.' : '.') }),
          el('button', { className: 'btn btn--secondary', attrs: { type: 'button' }, on: { click: showForm } }, [icon('message-plus'), el('span', { text: 'Nog iets insturen' })])
        );
        done.hidden = false;
        done.focus();
        mine.render();
      });

    formCard.append(
      el('h2', { className: 'form-card__title', text: 'Stuur iets in', attrs: { id: 'idea-form-title' } }),
      form,
      done
    );

    const how = el('section', { className: 'side-card', attrs: { 'aria-labelledby': 'how-title' } }, [
      el('h2', { className: 'side-card__title', attrs: { id: 'how-title' } }, [icon('info'), el('span', { text: 'Zo werkt het' })]),
      ns.blocks.stepsList([
        'Je stuurt een idee, vraag, verzoek of prompt in.',
        'Het AI-team bekijkt iedere inzending en reageert.',
        'Goede ideeën worden een usecase, prompt of tip op dit platform.',
        'Antwoorden die voor iedereen nuttig zijn, zetten we (zonder naam) in de hub.'
      ], 'small')
    ]);

    const node = el('div', { className: 'page container' }, [
      pageHeader({
        eyebrow: 'Ideeënhub',
        title: 'Jouw ideeën, vragen en verzoeken',
        lead: 'Dit platform groeit met wat jullie inbrengen. Heb je een idee voor een usecase, loop je ergens tegenaan, wil je een demo voor je team of heb je een prompt die goed werkt? Laat het weten.'
      }),
      el('div', { className: 'ideas-layout' }, [formCard, el('div', { className: 'ideas-layout__side' }, [how, mine.node])]),
      hubList(mine)
    ]);
    return { node, title: 'Ideeënhub' };
  }

  ns.ideas = { KINDS, KIND_BY_ID, STATUSES, statusBadge, kindChip };
  ns.views = ns.views || {};
  ns.views.ideas = { render };
})(window.AIAudit);
