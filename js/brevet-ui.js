/* ==========================================================================
   AI-brevetten: wat je ziet (js/brevet.js rekent)
   --------------------------------------------------------------------------
   - insignia(): de strepen, zoals op de epaulet van een piloot (Cadet 1,
     Co-pilot 3, CaptAIn 4, Commander 4 met een ster);
   - promote(): bij een promotie één keer een venster met een korte animatie,
     wat het brevet betekent en wat de volgende checkride is;
   - join(): meedoen (opt-in), met eerlijk wie wat ziet; in de Supabase-modus
     eerst inloggen;
   - policyCheck(): de check "Veilig vliegen" (vijf vragen over het AI-beleid);
   - maybeInvite(): wie de rondleiding al had, krijgt één keer een uitnodiging;
   - de strepen op de knop rechtsboven, en "Opname bekeken" bij een training.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, storage } = ns.ui;
  const INVITE_KEY = 'brevet-uitnodiging';
  const calm = () => (ns.motion && ns.motion.calm ? ns.motion.calm() : window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Wat een brevet betekent (in het promotievenster)
  const MEANING = {
    cadet: 'Je kent de cockpit en de regels voor veilig werken met Copilot. Welkom aan boord.',
    copilot: 'Je gebruikt Copilot volop in je werk: prompts, demo\'s en een training. Op naar de volgende strepen.',
    captain: 'Je maakt de cockpit beter voor iedereen: het AI-team heeft jouw bijdrage overgenomen.',
    commander: 'Je neemt collega\'s mee: ze gebruiken jouw prompts, en je gaf een sessie in je team.'
  };

  /* ---- Strepen ---------------------------------------------------------------------- */
  /** De epaulet van een brevet (index in de regels; -1 = nog geen brevet). size: 'sm', 'md' of 'lg'. */
  function insignia(index, size, options) {
    const opts = options || {};
    const levels = (opts.rules || ns.brevet.rules()).levels;
    const level = levels[index];
    const board = el('span', { className: 'insignia__board' });
    if (level && level.insignia) board.append(icon('star-filled', { className: 'insignia__star' }));
    const stripes = el('span', { className: 'insignia__stripes' });
    for (let n = 0; n < (level ? level.stripes : 0); n++) {
      const stripe = el('span', { className: 'insignia__stripe' });
      stripe.style.setProperty('--i', String(n));
      stripes.append(stripe);
    }
    board.append(stripes);
    return el('span', {
      className: 'insignia insignia--' + (size || 'md') + (level ? ' insignia--' + level.id : ' insignia--none') + (opts.animate ? ' is-animating' : ''),
      attrs: { role: 'img', 'aria-label': level ? `${level.name}: ${level.stripes} ${level.stripes === 1 ? 'streep' : 'strepen'}${level.insignia ? ' en een ster' : ''}` : 'Nog geen brevet' }
    }, [el('span', { className: 'insignia__button', attrs: { 'aria-hidden': 'true' } }), board]);
  }

  /** De ladder: alle brevetten, met het jouwe gemarkeerd. */
  function ladder(current, rules) {
    const r = rules || ns.brevet.rules();
    return el('ol', { className: 'ladder', attrs: { role: 'list' } }, r.levels.map((level, index) => el('li', {
      className: 'ladder__step' + (index === current ? ' is-current' : '') + (index < current ? ' is-done' : '')
    }, [
      insignia(index, 'md', { rules: r }),
      el('div', { className: 'ladder__text' }, [
        el('p', { className: 'ladder__name' }, [
          el('span', { text: level.name }),
          index === current ? el('span', { className: 'ladder__badge', text: 'Jouw brevet' }) : null
        ]),
        el('p', { className: 'ladder__miles', text: index === 0 ? 'Na de eerste stappen' : `${level.miles.toLocaleString('nl-NL')} AI-miles en de checkride` }),
        el('ul', { className: 'ladder__perks', attrs: { role: 'list' } }, level.perks.map((perk) => el('li', { text: perk })))
      ])
    ])));
  }

  /** De checkride als lijst met vinkjes (checks uit compute().next). */
  function checklist(checks) {
    return el('ul', { className: 'checkride', attrs: { role: 'list' } }, checks.map((check) => el('li', { className: 'checkride__item' + (check.ok ? ' is-ok' : '') }, [
      icon(check.ok ? 'check-circle' : 'clock'),
      el('span', {}, check.need > 1
        ? [el('strong', { text: `${Math.min(check.have, check.need)} van ${check.need}` }), ' ' + check.label]
        : [check.label])
    ])));
  }

  /* ---- Vensters --------------------------------------------------------------------- */
  let dialogCount = 0;
  /** Een venster in de stijl van de cockpit (dezelfde opbouw als 'Stel een verbetering voor'). */
  function dialog(className, labelId, children) {
    const opener = document.activeElement;
    const node = el('dialog', { className: 'improve brevet-dialog ' + className, attrs: { 'aria-labelledby': labelId } }, children);
    node.addEventListener('close', () => {
      node.remove();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });
    document.body.append(node);
    node.showModal();
    // Bovenaan beginnen (showModal zet de focus op de eerste knop, en scrolt daar soms naartoe)
    node.scrollTop = 0;
    return node;
  }

  /** Wacht tot er geen ander venster (rondleiding, zoeken) open staat. */
  function whenFree(run) {
    if (!document.querySelector('dialog[open]')) run();
    else window.setTimeout(() => whenFree(run), 1500);
  }

  /** Promotie: een korte animatie van de strepen, wat het betekent en de volgende checkride. */
  function promote(result) {
    whenFree(() => {
      const r = result.rules;
      const level = result.levelInfo;
      if (!level) return;
      const id = 'promo-' + (++dialogCount);
      const account = ns.brevet.state().account || {};
      const share = account.share_brevet ? null : el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('users'), el('span', { text: 'Laat collega\'s het zien' })]);
      const close = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [el('span', { text: 'Naar mijn logboek' }), icon('arrow-right')]);
      const next = result.next;
      const node = dialog('promo', id + '-title', [
        el('div', { className: 'improve__panel promo__panel' }, [
          el('div', { className: 'promo__stage', attrs: { 'aria-hidden': 'true' } }, [insignia(result.level, 'lg', { rules: r, animate: !calm() })]),
          el('p', { className: 'promo__eyebrow', text: 'Promotie' }),
          el('h2', { className: 'promo__title', attrs: { id: id + '-title' }, text: `Je bent nu ${level.name}` }),
          el('p', { className: 'promo__text', text: MEANING[level.id] || '' }),
          el('div', { className: 'promo__block' }, [
            el('h3', { className: 'promo__label', text: 'Dit hoort erbij' }),
            el('ul', { className: 'promo__perks', attrs: { role: 'list' } }, level.perks.map((perk) => el('li', {}, [icon('check'), el('span', { text: perk })])))
          ]),
          next ? el('div', { className: 'promo__block' }, [
            el('h3', { className: 'promo__label', text: `Op weg naar ${next.level.name}` }),
            el('p', { className: 'promo__next', text: next.milesNeeded ? `Nog ${next.milesNeeded.toLocaleString('nl-NL')} AI-miles, en de checkride:` : 'Genoeg miles; nu nog de checkride:' }),
            checklist(next.checks)
          ]) : el('p', { className: 'promo__next', text: 'Hoger dan dit gaat het niet. Dank je wel dat je collega\'s meeneemt.' }),
          el('div', { className: 'improve__actions' }, [share, close])
        ])
      ]);
      close.focus({ preventScroll: true });
      node.scrollTop = 0;
      close.addEventListener('click', () => {
        node.close();
        if (window.location.hash !== '#/mijn') window.location.hash = '#/mijn';
      });
      if (share) share.addEventListener('click', async () => {
        share.disabled = true;
        try {
          await ns.brevet.setShare(true);
          toast('Collega\'s zien nu je brevet', { tone: 'success' });
          share.remove();
        } catch (error) {
          share.disabled = false;
          toast('Dat lukte niet: ' + error.message, { tone: 'warning' });
        }
      });
    });
  }

  /** Meedoen: in de Supabase-modus eerst inloggen; dan wie wat ziet, en je keuze om te delen. */
  function join() {
    if (!ns.brevet.enabled()) return;
    if (!ns.account.current()) {
      login();
      return;
    }
    const id = 'join-' + (++dialogCount);
    const name = el('input', { className: 'field__input', attrs: { id: id + '-name', type: 'text', maxlength: '100', autocomplete: 'name' } });
    name.value = ns.profile.get().naam;
    const share = el('input', { attrs: { id: id + '-share', type: 'checkbox' } });
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Niet nu' })]);
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('plane'), el('span', { text: 'Doe mee' })]);
    const error = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const form = el('form', { className: 'improve__panel', attrs: { novalidate: true } }, [
      el('div', { className: 'improve__head' }, [
        el('span', { className: 'improve__icon', attrs: { 'aria-hidden': 'true' } }, [icon('plane')]),
        el('div', {}, [
          el('h2', { className: 'improve__title', attrs: { id: id + '-title' }, text: 'Doe mee met de AI-brevetten' }),
          el('p', { className: 'improve__subject', text: 'Verdien AI-miles met wat je in de cockpit doet en deelt, en haal je brevetten: van Cadet tot Commander. Elk brevet geeft echte voordelen.' })
        ])
      ]),
      ladder(-1),
      el('div', { className: 'join__privacy' }, [
        el('h3', { className: 'join__label' }, [icon('shield'), el('span', { text: 'Wie ziet wat?' })]),
        el('ul', { attrs: { role: 'list' } }, [
          el('li', { text: 'Het AI-team (beheer) ziet je logboek: wat je gebruikt en wat je bijdraagt.' }),
          el('li', { text: 'Collega\'s zien alleen wat jij kiest te delen: je brevet, nooit je gebruik.' }),
          el('li', { text: 'Stoppen kan altijd, onder Mijn logboek. Dan wordt je logboek gewist.' })
        ])
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: id + '-name' }, text: 'Je naam' }),
        el('p', { className: 'field__hint', text: 'Zo herkent het AI-team je, bijvoorbeeld als het je bijdrage overneemt.' }),
        name
      ]),
      el('label', { className: 'check', attrs: { for: id + '-share' } }, [share, el('span', { text: 'Laat collega\'s mijn brevet zien (kan later nog aan of uit)' })]),
      error,
      el('div', { className: 'improve__actions' }, [cancel, send])
    ]);
    const node = dialog('join', id + '-title', [form]);
    cancel.addEventListener('click', () => node.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      send.disabled = true;
      error.hidden = true;
      try {
        const chosen = name.value.trim();
        if (chosen && !ns.profile.get().naam) ns.profile.set(Object.assign({}, ns.profile.get(), { naam: chosen }));
        await ns.brevet.join({ name: chosen, share: share.checked });
        // De uitnodiging is dan niet meer nodig
        storage.set(INVITE_KEY, { how: 'mee', at: new Date().toISOString() });
        const invite = document.querySelector('.brevet-invite');
        if (invite) invite.remove();
        node.close();
        toast('Welkom aan boord! Je eerste miles staan in je logboek.', { tone: 'success' });
        if (window.location.hash !== '#/mijn') window.location.hash = '#/mijn';
      } catch (err) {
        error.textContent = 'Meedoen lukte niet: ' + err.message;
        error.hidden = false;
        send.disabled = false;
      }
    });
  }

  /** Inloggen (Supabase-modus): een link naar je V&V-mailadres, of met Microsoft. */
  function login() {
    const id = 'login-' + (++dialogCount);
    const microsoft = ns.account.login() === 'microsoft';
    const email = el('input', { className: 'field__input', attrs: { id: id + '-email', type: 'email', maxlength: '254', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', placeholder: 'voornaam.achternaam@' + ns.account.domain() } });
    const status = el('p', { className: 'field__hint', attrs: { role: 'status' } });
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Annuleren' })]);
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon(microsoft ? 'key' : 'mail'), el('span', { text: microsoft ? 'Log in met Microsoft' : 'Stuur mij een inloglink' })]);
    const form = el('form', { className: 'improve__panel', attrs: { novalidate: true } }, [
      el('div', { className: 'improve__head' }, [
        el('span', { className: 'improve__icon', attrs: { 'aria-hidden': 'true' } }, [icon('key')]),
        el('div', {}, [
          el('h2', { className: 'improve__title', attrs: { id: id + '-title' }, text: 'Eerst even inloggen' }),
          el('p', { className: 'improve__subject', text: microsoft ? 'Met je Visser & Visser-account, zodat je logboek op elk apparaat hetzelfde is.' : 'Met je e-mailadres van Visser & Visser: je krijgt een link, daarmee ben je ingelogd. Geen wachtwoord nodig.' })
        ])
      ]),
      microsoft ? null : el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: id + '-email' }, text: 'Je e-mailadres' }), email, status]),
      el('div', { className: 'improve__actions' }, [cancel, send])
    ]);
    const node = dialog('login', id + '-title', [form]);
    cancel.addEventListener('click', () => node.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      send.disabled = true;
      const result = await ns.account.signIn(microsoft ? 'microsoft' : 'email', email.value);
      if (result === 'sent') {
        status.textContent = 'Verstuurd. Open de mail en klik op de link; daarna kun je meedoen.';
        send.hidden = true;
        return;
      }
      if (result === 'redirect') return;
      status.textContent = result === 'domain' ? `Gebruik je e-mailadres van ${ns.account.domain()}.` : 'Versturen lukte niet. Probeer het straks nog eens.';
      send.disabled = false;
    });
  }

  /* ---- Check "Veilig vliegen" -------------------------------------------------------- */
  // Vijf vragen over het AI-beleid van V&V (zoals het in de cockpit staat: js/check.js en de gouden regels)
  const QUESTIONS = [
    {
      q: 'Je wilt een conceptmail met klantgegevens laten herschrijven. Waar doe je dat?',
      options: ['In Copilot, ingelogd met je zakelijke account en in de Werk-modus', 'In ChatGPT of Claude, met een betaald account', 'In Copilot met webbronnen (Web) aan'],
      answer: 0,
      why: 'Klantgegevens alleen in Copilot met je zakelijke account (het schildje) in de Werk-modus, of in Ilse. Nooit in een andere AI-tool via de browser, ook niet betaald.'
    },
    {
      q: 'Copilot maakt een samenvatting met bedragen voor je dossier. Wat doe je?',
      options: ['Overnemen: Copilot rekent nauwkeurig', 'Bedragen en conclusies controleren tegen de bron', 'Alleen de bedragen boven de materialiteit controleren'],
      answer: 1,
      why: 'Wat Copilot maakt is een concept. Controleer bedragen en conclusies altijd tegen de bron; het professionele oordeel blijft van jou.'
    },
    {
      q: 'Welke gegevens horen nooit in Copilot?',
      options: ['Een geanonimiseerde casus', 'Een e-mail van een klant over de planning', 'Hoog-risico-data, zoals bijzondere persoonsgegevens, een BSN of stukken onder geheimhouding'],
      answer: 2,
      why: 'Deel niet meer dan nodig, en nooit hoog-risico-data. Een gewone klantmail mag in Copilot in de Werk-modus.'
    },
    {
      q: 'Je gebruikt in Copilot mails van twee verschillende klanten. Waar let je op?',
      options: ['Dat mag nooit', 'Dat er geen gegevens van de ene klant in je antwoord voor de andere klant komen', 'Nergens op: Copilot houdt ze uit elkaar'],
      answer: 1,
      why: 'Klanten door elkaar gebruiken is veilig in Copilot. Let er wel op dat je antwoord alleen over de juiste klant gaat.'
    },
    {
      q: 'Je twijfelt of iets mag in Copilot. Wat doe je?',
      options: ['Niet gebruiken, en eerst navragen bij de AI-specialist van je discipline, je leidinggevende of IT', 'Het gewoon proberen', 'Het in een andere AI-tool doen'],
      answer: 0,
      why: 'Bij twijfel niet gebruiken voordat je het hebt nagevraagd.'
    }
  ];

  function policyCheck() {
    const id = 'vv-' + (++dialogCount);
    const items = QUESTIONS.map((question, n) => {
      const name = id + '-q' + n;
      const feedback = el('p', { className: 'quiz__why', attrs: { hidden: true } });
      const fieldset = el('fieldset', { className: 'quiz__question' }, [
        el('legend', { className: 'quiz__legend' }, [el('span', { className: 'quiz__number', text: String(n + 1) }), el('span', { text: question.q })]),
        ...question.options.map((option, k) => el('label', { className: 'quiz__option', attrs: { for: name + '-' + k } }, [
          el('input', { attrs: { id: name + '-' + k, type: 'radio', name, value: String(k) } }),
          el('span', { text: option })
        ])),
        feedback
      ]);
      return { question, fieldset, feedback, name };
    });
    const status = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Sluiten' })]);
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('check'), el('span', { text: 'Controleer' })]);
    const form = el('form', { className: 'improve__panel', attrs: { novalidate: true } }, [
      el('div', { className: 'improve__head' }, [
        el('span', { className: 'improve__icon', attrs: { 'aria-hidden': 'true' } }, [icon('shield')]),
        el('div', {}, [
          el('h2', { className: 'improve__title', attrs: { id: id + '-title' }, text: 'Check "Veilig vliegen"' }),
          el('p', { className: 'improve__subject', text: 'Vijf vragen over veilig werken met Copilot, volgens het AI-beleid van V&V. Alles goed? Dan staat de check in je logboek.' })
        ])
      ]),
      ...items.map((item) => item.fieldset),
      status,
      el('div', { className: 'improve__actions' }, [cancel, send])
    ]);
    const node = dialog('quiz', id + '-title', [form]);
    cancel.addEventListener('click', () => node.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      let right = 0;
      let firstWrong = null;
      items.forEach((item) => {
        const chosen = form.querySelector(`input[name="${item.name}"]:checked`);
        const ok = Boolean(chosen) && Number(chosen.value) === item.question.answer;
        if (ok) right += 1;
        else if (!firstWrong) firstWrong = item.fieldset;
        item.fieldset.classList.toggle('is-right', ok);
        item.fieldset.classList.toggle('is-wrong', !ok);
        item.feedback.textContent = (ok ? 'Goed. ' : chosen ? 'Niet helemaal. ' : 'Nog niet beantwoord. ') + item.question.why;
        item.feedback.hidden = false;
      });
      if (right < items.length) {
        status.textContent = `${right} van de ${items.length} goed. Lees de uitleg en probeer het nog eens.`;
        status.hidden = false;
        if (firstWrong) firstWrong.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
        return;
      }
      send.disabled = true;
      await ns.brevet.record('policy_check', '');
      node.close();
      toast('Check "Veilig vliegen" gehaald', { tone: 'success' });
    });
  }

  /* ---- Uitnodiging, kopbalk en trainingen -------------------------------------------- */
  /**
   * Op de startpagina: wie de rondleiding al had en nog niet meedoet, krijgt één keer een kaartje
   * (nieuwe bezoekers krijgen de uitnodiging aan het eind van de rondleiding).
   */
  function maybeInvite() {
    if (!ns.brevet.enabled() || ns.brevet.joined() || storage.get(INVITE_KEY, null) || !ns.tour.seen() || ns.central.signedIn()) return;
    if (document.querySelector('.brevet-invite')) return;
    window.setTimeout(() => {
      if (ns.brevet.joined() || !document.querySelector('.home') || document.querySelector('dialog[open], .brevet-invite')) return;
      const later = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [el('span', { text: 'Later' })]);
      const go = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('plane'), el('span', { text: 'Doe mee' })]);
      const card = el('aside', { className: 'brevet-invite', attrs: { 'aria-labelledby': 'brevet-invite-title' } }, [
        insignia(2, 'md'),
        el('div', { className: 'brevet-invite__text' }, [
          el('p', { className: 'brevet-invite__eyebrow', text: 'Nieuw in de cockpit' }),
          el('h2', { className: 'brevet-invite__title', attrs: { id: 'brevet-invite-title' }, text: 'Haal je AI-brevetten' }),
          el('p', { text: 'Verdien AI-miles met wat je doet en deelt, en promoveer van Cadet tot Commander. Meedoen is vrijwillig.' }),
          el('div', { className: 'brevet-invite__actions' }, [go, later])
        ])
      ]);
      const done = (how) => {
        storage.set(INVITE_KEY, { how, at: new Date().toISOString() });
        card.classList.add('is-leaving');
        window.setTimeout(() => card.remove(), calm() ? 0 : 250);
      };
      later.addEventListener('click', () => done('later'));
      go.addEventListener('click', () => {
        done('mee');
        join();
      });
      // Weg van de startpagina: het kaartje gaat weg (en komt een volgende keer terug, tot je kiest)
      const away = () => {
        window.removeEventListener('hashchange', away);
        if (card.isConnected && !card.classList.contains('is-leaving')) card.remove();
      };
      window.addEventListener('hashchange', away);
      document.body.append(card);
    }, 2500);
  }

  /** De strepen op de knop rechtsboven (Mijn logboek). */
  function syncMeButton() {
    const button = document.getElementById('me-button');
    if (!button) return;
    let mark = button.querySelector('.topbar__stripes');
    const result = ns.brevet.joined() ? ns.brevet.state().result : null;
    const level = result ? result.levelInfo : null;
    if (!level) {
      if (mark) mark.remove();
      return;
    }
    if (!mark) {
      mark = el('span', { className: 'topbar__stripes', attrs: { 'aria-hidden': 'true' } });
      button.append(mark);
    }
    mark.replaceChildren(...Array.from({ length: level.stripes }, () => el('i', {})));
    mark.classList.toggle('has-star', Boolean(level.insignia));
    button.setAttribute('aria-label', `Mijn logboek (${level.name}, ${result.miles} AI-miles)`);
    button.title = `Mijn logboek · ${level.name}`;
  }

  /** Bij een opname van een training: 'Opname bekeken' voor je logboek (alleen als je meedoet). */
  function trainingButton(training) {
    if (!ns.brevet.enabled() || !ns.brevet.joined()) return null;
    const done = ns.brevet.state().facts.some((fact) => (fact.kind === 'recording_watched' || fact.kind === 'training_attended') && fact.item === training.id);
    const button = el('button', { className: 'btn btn--secondary btn--sm recording-log', attrs: { type: 'button', disabled: done } }, [icon(done ? 'check-circle' : 'plane'), el('span', { text: done ? 'Staat in je logboek' : 'Opname bekeken: zet in mijn logboek' })]);
    button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await ns.brevet.record('recording_watched', training.id);
      if (result === 'ok' || result === 'duplicate') button.replaceChildren(icon('check-circle'), el('span', { text: 'Staat in je logboek' }));
      else button.disabled = false;
    });
    return button;
  }

  function init() {
    if (!ns.brevet.enabled()) return;
    ns.brevet.onChange(syncMeButton);
    syncMeButton();
  }

  ns.brevetUi = { init, insignia, ladder, checklist, promote, join, login, policyCheck, maybeInvite, syncMeButton, trainingButton, QUESTIONS };
})(window.AIAudit);
