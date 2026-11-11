/* ==========================================================================
   AI-specialist invliegen
   --------------------------------------------------------------------------
   Een team heeft een klantcasus en wil weten wat Copilot daar kan doen. Vanuit
   de cockpit vraag je de AI-specialist van je discipline om mee te denken: in
   een venster, zonder klantnaam. Het verzoek komt binnen in Beheer → Invliegen
   (js/admin-specialist.js) en wordt nooit gepubliceerd.

   Wie de specialist is (naam, e-mail voor Teams, reactietijd, beschikbaar),
   stel je per discipline in bij Beheer → Disciplines. Zonder naam heet hij hier
   gewoon 'de AI-specialist'.

   Opslag: een inzending van de soort 'invliegen' in de ideeënhub, met de
   details (fase, soort klant, data, wanneer, hoe) in de kolom 'details'
   (stap 13, setup/supabase-audit-invliegen.sql). Je eigen verzoeken en hun
   status staan bij 'Jouw inzendingen' in de ideeënhub.
   Knoppen: bij een usecase, in de ideeënhub, met Ctrl+K en op de startpagina.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, copyText } = ns.ui;
  const KIND = 'invliegen';

  // Wanneer: de volgorde is ook de urgentie
  const WHEN = [
    { id: 'week', label: 'Deze week' },
    { id: 'twee-weken', label: 'Binnen twee weken' },
    { id: 'geen-haast', label: 'Geen haast' }
  ];
  const HOW = [
    { id: 'meekijken', label: 'Even meekijken in Teams', hint: 'Een half uur, met het team' },
    { id: 'langskomen', label: 'Langskomen bij het team', hint: 'Op kantoor of bij de klant' },
    { id: 'chat', label: 'Een antwoord via chat is genoeg', hint: 'Of per mail' }
  ];
  // De statussen van de ideeënhub, met namen die hier passen
  const STATUS = {
    'nieuw': { label: 'Ontvangen', tone: 'neutral' },
    'in-behandeling': { label: 'In behandeling', tone: 'info' },
    'gepland': { label: 'Ingepland', tone: 'info' },
    'gerealiseerd': { label: 'Afgerond', tone: 'success' },
    'beantwoord': { label: 'Afgerond', tone: 'success' },
    'afgewezen': { label: 'Niet opgepakt', tone: 'muted' }
  };
  const OPEN = ['nieuw', 'in-behandeling', 'gepland'];

  /** De specialist van de discipline waarin je zit: { name, email, response, availability, label }. */
  function current() {
    const discipline = ns.cockpit.active();
    const name = discipline.specialist || '';
    // In het Engels: de Engelse tekst uit Beheer → Disciplines; zonder die vertaalt js/i18n-en.js de gangbare zinnen
    const english = Boolean(ns.i18n && ns.i18n.english());
    return {
      name,
      email: discipline.specialistEmail || '',
      response: (english && discipline.specialistResponseEn) || discipline.specialistResponse || '',
      availability: (english && discipline.specialistAvailabilityEn) || discipline.specialistAvailability || '',
      // Al Engels (niet nog eens laten vertalen)
      ownEnglish: { response: english && Boolean(discipline.specialistResponseEn), availability: english && Boolean(discipline.specialistAvailabilityEn) },
      // In een zin: 'Joost' of 'de AI-specialist'
      label: name ? name.split(/\s+/)[0] : 'de AI-specialist',
      discipline: discipline.name
    };
  }

  /** Een chat in Teams met dit adres, met een bericht alvast ingevuld. */
  function teamsLink(email, message) {
    return 'https://teams.microsoft.com/l/chat/0/0?users=' + encodeURIComponent(email) + (message ? '&message=' + encodeURIComponent(message) : '');
  }

  function initials(name) {
    const words = String(name || '').split(/\s+/).filter(Boolean);
    if (!words.length) return 'AI';
    return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  }

  const whenRank = (id) => {
    const index = WHEN.findIndex((w) => w.id === id);
    return index < 0 ? WHEN.length : index;
  };

  /**
   * Volgorde in Beheer: eerst wat nog open staat (nieuw, dan ingepland), dan hoe snel het moet, dan
   * de datum (vroegste eerst; zonder datum achteraan), en bij gelijke stand het nieuwste verzoek eerst.
   */
  function sort(items) {
    const openRank = (status) => {
      const index = OPEN.indexOf(status);
      return index < 0 ? OPEN.length : index;
    };
    return items.slice().sort((a, b) => {
      const da = a.details || {};
      const db = b.details || {};
      return openRank(a.status) - openRank(b.status)
        || whenRank(da.wanneer) - whenRank(db.wanneer)
        || String(da.datum || '9999').localeCompare(String(db.datum || '9999'))
        || String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  const labelOf = (list, id) => (list.find((item) => item.id === id) || {}).label || '';
  const dataLabel = (id) => labelOf(ns.check.DATA, id);

  /** Het kaartje van de specialist (bovenin het venster). */
  function person(who) {
    return el('div', { className: 'flyin-person' }, [
      el('span', { className: 'flyin-person__avatar', attrs: { 'aria-hidden': 'true' }, text: initials(who.name) }),
      el('div', { className: 'flyin-person__text' }, [
        el('p', { className: 'flyin-person__name', text: who.name || 'De AI-specialist van ' + who.discipline }),
        // Reactietijd en beschikbaarheid elk apart, zodat js/i18n.js ze los kan vertalen
        who.response || who.availability
          ? el('p', { className: 'flyin-person__meta' }, [
            who.response ? el('span', { text: who.response, attrs: { translate: who.ownEnglish && who.ownEnglish.response ? 'no' : null } }) : null,
            who.response && who.availability ? ' · ' : null,
            who.availability ? el('span', { text: who.availability, attrs: { translate: who.ownEnglish && who.ownEnglish.availability ? 'no' : null } }) : null
          ].filter(Boolean))
          : el('p', { className: 'flyin-person__meta', text: 'Denkt mee over Copilot bij jouw klantcasus' })
      ])
    ]);
  }

  /** Keuze uit een paar opties als knoppen (radio's). */
  function choices(id, name, list, value) {
    return el('div', { className: 'flyin-choices', attrs: { role: 'radiogroup', 'aria-labelledby': id + '-label' } }, list.map((item) => {
      const inputId = id + '-' + item.id;
      return el('label', { className: 'flyin-choice', attrs: { for: inputId } }, [
        el('input', { attrs: { id: inputId, type: 'radio', name: id + '-' + name, value: item.id, checked: item.id === value } }),
        el('span', { className: 'flyin-choice__label', text: item.label }),
        item.hint ? el('span', { className: 'flyin-choice__hint', text: item.hint }) : null
      ]);
    }));
  }

  let count = 0;
  /**
   * Het venster. options: { usecase (object), phase (id), title } om alvast in te vullen.
   */
  function open(options) {
    const opts = options || {};
    const who = current();
    const id = 'flyin-' + (++count);
    const opener = document.activeElement;
    const me = ns.profile ? ns.profile.get() : {};
    const usecase = opts.usecase || null;

    const title = el('input', { className: 'field__input', attrs: { id: id + '-title', type: 'text', maxlength: '120', autocomplete: 'off', placeholder: 'Bijv. "Contracten doorlichten op leaseverplichtingen"', 'aria-describedby': id + '-title-error' } });
    title.value = String(opts.title || '').slice(0, 120);
    const body = el('textarea', { className: 'field__input field__textarea', attrs: { id: id + '-body', rows: '4', maxlength: '2000', 'aria-describedby': id + '-body-hint ' + id + '-body-error' } });
    const phase = el('select', { className: 'field__input', attrs: { id: id + '-phase' } }, [
      el('option', { attrs: { value: '' }, text: 'Geen specifieke fase' }),
      ...ns.content.phases.map((p) => el('option', { attrs: { value: p.id }, text: p.label }))
    ]);
    phase.value = usecase && usecase.phase ? usecase.phase.id : ns.content.phaseById.has(opts.phase) ? opts.phase : '';
    const client = el('input', { className: 'field__input', attrs: { id: id + '-client', type: 'text', maxlength: '80', autocomplete: 'off', placeholder: 'Bijv. groothandel, mkb' } });
    const data = choices(id, 'data', ns.check.DATA.map((item) => ({ id: item.id, label: item.label })), '');
    const highRisk = el('p', { className: 'flyin-warning', attrs: { role: 'note', hidden: true } }, [icon('alert'), el('span', { text: 'Hoog-risico-data mag niet in Copilot. ' + (who.name ? who.label : 'De AI-specialist') + ' denkt wel mee over wat er kan zonder die gegevens.' })]);
    data.addEventListener('change', () => {
      const chosen = data.querySelector('input:checked');
      highRisk.hidden = !(chosen && chosen.value === 'hoog');
    });
    const when = el('select', { className: 'field__input', attrs: { id: id + '-when' } }, WHEN.map((w) => el('option', { attrs: { value: w.id }, text: w.label })));
    when.value = 'twee-weken';
    const date = el('input', { className: 'field__input', attrs: { id: id + '-date', type: 'date', min: ns.content.today() } });
    const how = choices(id, 'how', HOW, 'meekijken');
    const name = el('input', { className: 'field__input', attrs: { id: id + '-name', type: 'text', maxlength: '100', autocomplete: 'name' } });
    name.value = me.naam || '';
    const email = el('input', { className: 'field__input', attrs: { id: id + '-email', type: 'email', maxlength: '254', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', 'aria-describedby': id + '-email-error' } });
    const account = ns.account ? ns.account.current() : null;
    if (account) email.value = account.email;
    const titleError = el('p', { className: 'field__error', attrs: { id: id + '-title-error' } });
    const bodyError = el('p', { className: 'field__error', attrs: { id: id + '-body-error' } });
    const emailError = el('p', { className: 'field__error', attrs: { id: id + '-email-error' } });
    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Annuleren' })]);
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('plane'), el('span', { text: 'Vlieg ' + who.label + ' in' })]);
    const optional = (text) => el('span', { className: 'field__optional', text: text || '(optioneel)' });
    let confirmSensitive = false;
    [title, body, client].forEach((input) => input.addEventListener('input', () => {
      confirmSensitive = false;
    }));

    const form = el('form', { className: 'improve__panel flyin__panel', attrs: { novalidate: true } }, [
      el('div', { className: 'improve__head' }, [
        el('span', { className: 'improve__icon flyin__icon', attrs: { 'aria-hidden': 'true' } }, [icon('plane')]),
        el('div', {}, [
          el('h2', { className: 'improve__title', attrs: { id: id + '-heading' }, text: 'AI-specialist invliegen' }),
          el('p', { className: 'improve__subject', text: 'Een klantcasus waarbij je wilt weten wat Copilot kan? Vertel kort wat er speelt; ' + who.label + ' denkt met je team mee.' })
        ])
      ]),
      person(who),
      usecase ? el('p', { className: 'flyin-about' }, [icon('play-circle'), el('span', {}, ['Naar aanleiding van de usecase ', el('strong', { text: usecase.title })])]) : null,
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-title' }, text: 'Wat wil je bereiken?' }), title, titleError]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: id + '-body' }, text: 'De casus' }),
        el('p', { className: 'field__hint', attrs: { id: id + '-body-hint' }, text: 'Wat speelt er, welke stukken zijn er, wat heb je al geprobeerd? Geen klantnaam of dossiernummer.' }),
        body,
        bodyError
      ]),
      el('div', { className: 'field-row' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-phase' } }, ['Fase ', optional()]), phase]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-client' } }, ['Soort klant ', optional()]), client])
      ]),
      el('div', { className: 'field' }, [
        el('p', { className: 'field__label', attrs: { id: id + '-data-label' } }, ['Welke data gaat erin? ', optional('(kies de zwaarste)')]),
        data,
        highRisk
      ]),
      el('div', { className: 'field-row' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-when' }, text: 'Wanneer?' }), when]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-date' } }, ['Uiterlijk op ', optional()]), date])
      ]),
      el('div', { className: 'field' }, [el('p', { className: 'field__label', attrs: { id: id + '-how-label' }, text: 'Hoe wil je geholpen worden?' }), how]),
      el('div', { className: 'field-row' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-name' }, text: 'Je naam' }), name]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-email' }, text: 'Je e-mailadres' }), email, emailError])
      ]),
      el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Noem geen klantnamen, dossier- of persoonsgegevens. Je verzoek ziet alleen het AI-team; het komt nooit in de ideeënhub.' })]),
      ns.promises.line('flyin'),
      formError,
      el('div', { className: 'improve__actions' }, [cancel, send])
    ]);
    const dialog = el('dialog', { className: 'improve quick flyin', attrs: { 'aria-labelledby': id + '-heading' } }, [form]);
    const close = () => {
      if (dialog.open) dialog.close();
    };
    cancel.addEventListener('click', close);
    dialog.append(ns.ui.closeButton(close));
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });

    const chosen = (group) => {
      const input = group.querySelector('input:checked');
      return input ? input.value : '';
    };
    function summary() {
      const lines = [
        'Verzoek: AI-specialist invliegen (' + who.discipline + ')',
        'Wat: ' + title.value.trim(),
        'Casus: ' + body.value.trim(),
        phase.value ? 'Fase: ' + ns.content.phaseById.get(phase.value).label : '',
        client.value.trim() ? 'Soort klant: ' + client.value.trim() : '',
        chosen(data) ? 'Data: ' + dataLabel(chosen(data)) : '',
        'Wanneer: ' + labelOf(WHEN, when.value) + (date.value ? ', uiterlijk ' + date.value : ''),
        'Hoe: ' + labelOf(HOW, chosen(how)),
        usecase ? 'Usecase: ' + usecase.title : '',
        'Van: ' + [name.value.trim(), email.value.trim()].filter(Boolean).join(', ')
      ];
      return lines.filter(Boolean).join('\n');
    }

    /** Na versturen (of als versturen niet lukt): wat nu. */
    function done(sent) {
      const message = 'Hoi ' + (who.name ? who.label : '') + ', ik heb net in de AI-cockpit een verzoek ingestuurd om je in te vliegen: ' + title.value.trim();
      const teams = who.email ? el('a', { className: 'btn btn--secondary', attrs: { href: teamsLink(who.email, message), target: '_blank', rel: 'noopener noreferrer' } }, [icon('chat'), el('span', { text: 'Chat ' + (sent ? 'alvast ' : '') + 'in Teams' })]) : null;
      const copy = sent ? null : el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('copy'), el('span', { text: 'Kopieer je verzoek' })]);
      if (copy) copy.addEventListener('click', async () => {
        if (await copyText(summary())) toast('Gekopieerd: plak het in een chat of mail', { tone: 'success' });
      });
      const ok = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [el('span', { text: 'Sluiten' })]);
      ok.addEventListener('click', close);
      form.replaceChildren(el('div', { className: 'flyin-done' + (sent ? ' is-sent' : '') }, [
        el('span', { className: 'flyin-done__mark', attrs: { 'aria-hidden': 'true' } }, [icon(sent ? 'plane' : 'alert')]),
        el('h2', { className: 'flyin-done__title', attrs: { id: id + '-heading' }, text: sent ? (who.name ? who.label + ' vliegt in' : 'De AI-specialist vliegt in') : 'Versturen lukte niet' }),
        el('p', { className: 'flyin-done__text', text: sent
          // De belofte van het AI-team gaat voor de reactietijd bij de specialist (Beheer → Disciplines)
          ? (ns.promises.sentence('flyin')
            ? 'Je verzoek is binnen. ' + ns.promises.sentence('flyin')
            : 'Je verzoek is binnen' + (who.response ? ': ' + who.response.charAt(0).toLowerCase() + who.response.slice(1) : '') + '.') + ' De status zie je in de ideeënhub, bij Jouw inzendingen.'
          : 'Je verzoek is niet bewaard. Kopieer het en stuur het ' + (who.email ? 'in Teams' : 'via chat of mail') + ' naar ' + (who.name || 'de AI-specialist') + '.' }),
        el('div', { className: 'improve__actions flyin-done__actions' }, [copy, teams, ok].filter(Boolean))
      ]));
      dialog.scrollTop = 0;
      ok.focus();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.hidden = true;
      const what = title.value.trim();
      const text = body.value.trim();
      const address = email.value.trim();
      titleError.textContent = what.length < 3 ? 'Vul kort in wat je wilt bereiken (minimaal 3 tekens).' : '';
      bodyError.textContent = text.length < 10 ? 'Vertel iets meer over de casus (minimaal 10 tekens).' : '';
      emailError.textContent = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? '' : 'Vul je e-mailadres in, zodat ' + who.label + ' kan reageren.';
      const firstError = [titleError, bodyError, emailError].find((node) => node.textContent);
      if (firstError) {
        const field = { [titleError.id]: title, [bodyError.id]: body, [emailError.id]: email }[firstError.id];
        field.focus();
        return;
      }
      if (ns.ideas.SENSITIVE.test(what + ' ' + text + ' ' + client.value) && !confirmSensitive) {
        confirmSensitive = true;
        formError.replaceChildren(el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Dit lijkt op een BSN of rekeningnummer' })]), el('p', { text: 'Haal persoonsgegevens weg. Weet je zeker dat het mag, klik dan nog een keer op versturen.' }));
        formError.hidden = false;
        return;
      }
      if (!ns.central.isEnabled()) {
        done(false);
        return;
      }
      send.disabled = true;
      const ref = ns.ui.randomId();
      const details = {
        klant: client.value.trim().slice(0, 80) || undefined,
        data: chosen(data) || undefined,
        wanneer: when.value,
        datum: date.value || undefined,
        vorm: chosen(how) || undefined,
        usecase: usecase ? usecase.id : undefined,
        team: (me.team || '').slice(0, 80) || undefined,
        vestiging: (me.vestiging || '').slice(0, 80) || undefined
      };
      const result = await ns.central.submitIdea({ ref, kind: KIND, title: what, body: text, phase: phase.value || null, name: name.value.trim() || null, email: address, allowPublic: false, details: JSON.parse(JSON.stringify(details)) });
      if (result === 'ok') {
        ns.ideas.rememberSubmission({ ref, kind: KIND, title: what, at: new Date().toISOString() });
        done(true);
        return;
      }
      send.disabled = false;
      done(false);
    });

    document.body.append(dialog);
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  /** Kaart met een knop (bij een usecase): 'Wil je dit inzetten bij jouw klant?'. */
  function card(options) {
    const opts = options || {};
    const who = current();
    const button = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('plane'), el('span', { text: 'AI-specialist invliegen' })]);
    button.addEventListener('click', () => open(opts));
    return el('section', { className: 'flyin-card', attrs: { 'aria-labelledby': 'flyin-card-title' } }, [
      el('div', { className: 'flyin-card__head' }, [
        el('span', { className: 'flyin-person__avatar', attrs: { 'aria-hidden': 'true' }, text: initials(who.name) }),
        el('div', {}, [
          el('h2', { className: 'flyin-card__title', attrs: { id: 'flyin-card-title' }, text: opts.title || 'Wil je dit inzetten bij jouw klant?' }),
          el('p', { className: 'flyin-card__text', text: (who.name ? who.label : 'De AI-specialist') + ' denkt mee over je klantcasus: wat kan Copilot, en hoe pak je het aan.' })
        ])
      ]),
      button
    ]);
  }

  ns.specialist = { KIND, WHEN, HOW, STATUS, OPEN, current, teamsLink, initials, sort, open, card, dataLabel, labelOf };
})(window.AIAudit);
