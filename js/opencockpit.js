/* ==========================================================================
   Open Cockpit, het inloopuur over Copilot (#/open-cockpit)
   --------------------------------------------------------------------------
   Iedere paar weken een vrijwillige sessie: op een vestiging en altijd online
   via Teams. Collega's dragen vooraf agendapunten aan; het AI-team zet ze op
   de agenda, geeft een update van het nieuws rond Copilot en schrijft na de
   sessie de reactie erbij.

   - De sessies (datum, tijd, vestiging, Teams-link, nieuws, samenvatting,
     opname) staan als instelling 'opencockpit' in audit_content, per
     discipline (Beheer → Open Cockpit, js/admin-opencockpit.js).
   - Een agendapunt is een inzending van de soort 'agendapunt' in audit_ideas,
     met in de kolom 'session' bij welke sessie (stap 19,
     setup/supabase-audit-opencockpit.sql). Op de agenda = gepubliceerd.
   - Deze link zet je in de uitnodiging: hij toont altijd de eerstvolgende
     sessie, dus ook bij een terugkerende afspraak hoeft hij nooit te wijzigen.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, copyText, formatDate, pageHeader, emptyState } = ns.ui;
  const edit = (node, key, fallback, label, multiline) => (ns.layout ? ns.layout.editable(node, key, fallback, { label, multiline }) : node);

  const NAME = 'Open Cockpit';
  const ROUTE = '#/open-cockpit';
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  // Een agendapunt zonder geplande sessie: hoort bij de eerstvolgende die het AI-team plant
  const NEXT = 'volgende';
  const KIND = 'agendapunt';
  const DEFAULT_START = '12:00';
  const DEFAULT_MINUTES = 60;
  // Hoeveel dagen vooraf de startpagina en de ideeënhub de sessie aankondigen
  const ANNOUNCE_DAYS = 7;
  const PAST_SHOWN = 4;

  // De statussen van een inzending, in de woorden van een agenda
  const STATUSES = {
    'nieuw': { label: 'Aangedragen', tone: 'neutral' },
    'in-behandeling': { label: 'Op de agenda', tone: 'info' },
    'gepland': { label: 'Op de agenda', tone: 'info' },
    'gerealiseerd': { label: 'Behandeld', tone: 'success' },
    'beantwoord': { label: 'Behandeld', tone: 'success' },
    'afgewezen': { label: 'Niet behandeld', tone: 'muted' }
  };
  const DONE = ['beantwoord', 'gerealiseerd', 'afgewezen'];

  /* ---- Instellingen en sessies -------------------------------------------------------- */
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const https = (value) => (/^https:\/\/\S+$/.test(text(value)) ? text(value) : '');
  const lines = (value) => (Array.isArray(value) ? value : text(value).split('\n')).map(text).filter(Boolean);

  function addMinutes(time, minutes) {
    const [h, m] = time.split(':').map(Number);
    const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  /**
   * De instelling, schoongemaakt: sessies op datum (één per dag), met een eindtijd en de Teams-link van de
   * reeks als een sessie geen eigen link heeft. data: zonder = wat er nu in de cockpit staat.
   */
  function settings(data) {
    const src = data && typeof data === 'object' ? data : (ns.content && ns.content.openCockpit) || {};
    const teams = https(src.teams);
    const seen = new Set();
    const sessions = (Array.isArray(src.sessions) ? src.sessions : [])
      .filter((s) => s && DATE.test(s.date) && !seen.has(s.date) && seen.add(s.date))
      .map((s) => {
        const start = TIME.test(s.start) ? s.start : DEFAULT_START;
        return {
          id: s.date,
          date: s.date,
          start,
          end: TIME.test(s.end) && s.end > start ? s.end : addMinutes(start, DEFAULT_MINUTES),
          location: text(s.location),
          teams: https(s.teams) || teams,
          news: lines(s.news),
          summary: text(s.summary),
          recording: https(s.recording),
          cancelled: Boolean(s.cancelled)
        };
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { intro: text(src.intro), teams, sessions, off: Boolean(src.off) };
  }

  const today = () => (ns.content ? ns.content.today() : new Date().toISOString().slice(0, 10));
  /** De sessies die nog komen (vandaag telt mee), zonder afgelaste. */
  const upcoming = (cfg, day) => cfg.sessions.filter((s) => s.date >= (day || today()) && !s.cancelled);
  /** De sessies die geweest zijn, de laatste eerst. */
  const past = (cfg, day) => cfg.sessions.filter((s) => s.date < (day || today()) && !s.cancelled).reverse();
  const next = (cfg, day) => upcoming(cfg, day)[0] || null;

  /**
   * Bij welke sessie een agendapunt hoort: die van de kolom 'session' als hij bestaat. Anders (nog geen
   * sessie gepland, of de sessie is afgelast of verplaatst) de eerste sessie vanaf die datum, of vanaf vandaag.
   * Is er geen, dan NEXT: de eerstvolgende die nog gepland wordt.
   */
  function sessionOf(item, cfg, day) {
    const value = item && item.session;
    const exact = DATE.test(value) ? cfg.sessions.find((s) => s.id === value && !s.cancelled) : null;
    if (exact) return exact.id;
    const from = DATE.test(value) && value > (day || today()) ? value : day || today();
    const later = upcoming(cfg, from)[0];
    return later ? later.id : NEXT;
  }

  /** Agendapunten per sessie: Map(id → [punten]); op de agenda eerst de meeste stemmen. */
  function bySession(items, cfg, day) {
    const groups = new Map();
    (items || []).forEach((item) => {
      const id = sessionOf(item, cfg, day);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(item);
    });
    groups.forEach((list) => list.sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0) || (a.created_at < b.created_at ? -1 : 1)));
    return groups;
  }

  /* ---- Datum en tijd in woorden ------------------------------------------------------- */
  const locale = () => (ns.i18n ? ns.i18n.locale() : 'nl-NL');
  const asDate = (date) => new Date(date + 'T12:00:00');

  /** 'donderdag 10 december' (met het jaar erbij als dat niet dit jaar is). */
  function longDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    if (date.slice(0, 4) !== today().slice(0, 4)) options.year = 'numeric';
    return asDate(date).toLocaleDateString(locale(), options);
  }

  /** 'Vandaag', 'Morgen' of 'Over 5 dagen'. */
  function countdown(date) {
    const days = ns.content ? ns.content.daysUntil(date) : 0;
    return days <= 0 ? 'Vandaag' : days === 1 ? 'Morgen' : `Over ${days} dagen`;
  }

  /** 'Leeuwarden en online via Teams', of 'Online via Teams'. */
  function where(session) {
    return session.location ? `${session.location} en online via Teams` : 'Online via Teams';
  }

  /** Het vaste adres van deze pagina, voor de uitnodiging en het agenda-item. */
  function pageUrl() {
    const relative = ns.cockpit ? ns.cockpit.href(ns.cockpit.activeId(), ROUTE) : ROUTE;
    try {
      return new URL(relative, window.location.href).href;
    } catch (error) {
      return window.location.href.split('#')[0] + ROUTE;
    }
  }

  /* ---- Agenda-item (.ics) -------------------------------------------------------------- */
  const icsText = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const icsStamp = (date, time) => date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';

  /** Regels van hoogstens 75 tekens (RFC 5545); een vervolgregel begint met een spatie. */
  function fold(line) {
    const parts = [];
    let rest = line;
    while (rest.length > 74) {
      parts.push(rest.slice(0, 74));
      rest = ' ' + rest.slice(74);
    }
    parts.push(rest);
    return parts.join('\r\n');
  }

  /**
   * Eén sessie als agenda-item, in Nederlandse tijd (met de zomer- en wintertijd erbij, zodat Outlook hem
   * goed zet). options: { url, namespace, now } (now alleen voor de tests).
   */
  function ics(session, options) {
    const opts = options || {};
    const url = opts.url || pageUrl();
    const now = (opts.now || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const description = [
      `${NAME}: het inloopuur over Copilot. Vrij binnenlopen, op de vestiging of online.`,
      session.teams ? 'Deelnemen via Teams: ' + session.teams : '',
      'Agendapunt aandragen: ' + url
    ].filter(Boolean).join('\n');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Visser & Visser//AI-cockpit//NL',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Amsterdam',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:opencockpit-${opts.namespace || 'cockpit'}-${session.date}@ai-cockpit`,
      'DTSTAMP:' + now,
      'DTSTART;TZID=Europe/Amsterdam:' + icsStamp(session.date, session.start),
      'DTEND;TZID=Europe/Amsterdam:' + icsStamp(session.date, session.end),
      'SUMMARY:' + icsText(`${NAME}: het inloopuur over Copilot`),
      'LOCATION:' + icsText(where(session)),
      'DESCRIPTION:' + icsText(description),
      'URL:' + url,
      'END:VEVENT',
      'END:VCALENDAR'
    ].map(fold).join('\r\n') + '\r\n';
  }

  function downloadIcs(session) {
    const namespace = ns.cockpit ? ns.cockpit.namespace(ns.cockpit.activeId()) : '';
    const blob = new Blob([ics(session, { namespace })], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { attrs: { href: url, download: `open-cockpit-${session.date}.ics` } });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Open het bestand om de sessie in je agenda te zetten', { tone: 'success' });
  }

  /* ---- Onderdelen van de pagina -------------------------------------------------------- */
  function dateBadge(date) {
    const d = asDate(date);
    return el('span', { className: 'oc-date', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: 'oc-date__month', text: d.toLocaleDateString(locale(), { month: 'short' }).replace('.', '') }),
      el('span', { className: 'oc-date__day', text: String(d.getDate()) })
    ]);
  }

  /** De volgende sessie: wanneer, waar, en meteen in je agenda of naar Teams. */
  function nextCard(cfg) {
    const session = next(cfg);
    if (!session) {
      return el('section', { className: 'oc-next oc-next--empty', attrs: { 'aria-labelledby': 'oc-next-title' } }, [
        el('span', { className: 'oc-next__icon', attrs: { 'aria-hidden': 'true' } }, [icon('calendar')]),
        el('div', { className: 'oc-next__body' }, [
          el('h2', { className: 'oc-next__title', attrs: { id: 'oc-next-title' }, text: 'De volgende sessie wordt gepland' }),
          el('p', { className: 'oc-next__meta', text: 'Je kunt nu al een agendapunt aandragen: het komt op de agenda van de eerstvolgende sessie.' })
        ])
      ]);
    }
    const later = upcoming(cfg).slice(1, 4);
    const isToday = session.date === today();
    return el('section', { className: 'oc-next', attrs: { 'aria-labelledby': 'oc-next-title' } }, [
      dateBadge(session.date),
      el('div', { className: 'oc-next__body' }, [
        el('p', { className: 'oc-next__eyebrow' }, [el('span', { text: 'Volgende sessie' }), el('span', { className: 'oc-next__count', text: countdown(session.date) })]),
        el('h2', { className: 'oc-next__title', attrs: { id: 'oc-next-title' } }, [longDate(session.date).replace(/^./, (c) => c.toUpperCase())]),
        el('ul', { className: 'oc-next__meta', attrs: { role: 'list' } }, [
          el('li', {}, [icon('clock'), el('span', { text: `${session.start} – ${session.end} uur` })]),
          el('li', {}, [icon('map-pin'), el('span', { text: where(session) })])
        ]),
        el('div', { className: 'oc-next__actions' }, [
          session.teams ? el('a', { className: 'btn ' + (isToday ? 'btn--primary' : 'btn--secondary'), attrs: { href: session.teams, target: '_blank', rel: 'noopener' } }, [icon('external'), el('span', { text: 'Deelnemen via Teams' })]) : null,
          el('button', { className: 'btn ' + (isToday ? 'btn--secondary' : 'btn--primary'), attrs: { type: 'button' }, on: { click: () => downloadIcs(session) } }, [icon('calendar'), el('span', { text: 'Zet in je agenda' })])
        ]),
        later.length ? el('p', { className: 'oc-next__later' }, [
          el('span', { className: 'oc-next__later-label', text: 'Daarna: ' }),
          later.map((s) => formatDate(s.date).replace(/ \d{4}$/, '') + (s.location ? ` (${s.location})` : '')).join(', ')
        ]) : null
      ])
    ]);
  }

  /** Agendapunt aandragen: titel, toelichting, voor welke sessie, en of hij zichtbaar mag worden. */
  function agendaForm(cfg, onSent) {
    const config = ns.app.config();
    const coming = upcoming(cfg);
    const title = el('input', { className: 'field__input', attrs: { id: 'oc-title', type: 'text', maxlength: '120', required: true, autocomplete: 'off', placeholder: 'Bijv. "Hoe gebruiken jullie Copilot bij de managementletter?"', 'aria-describedby': 'oc-title-error' } });
    const titleError = el('p', { className: 'field__error', attrs: { id: 'oc-title-error' } });
    const body = el('textarea', { className: 'field__input field__textarea', attrs: { id: 'oc-body', rows: '4', maxlength: '2000', 'aria-describedby': 'oc-body-hint' } });
    const session = coming.length > 1 ? el('select', { className: 'field__input', attrs: { id: 'oc-session' } }, coming.slice(0, 4).map((s) =>
      el('option', { attrs: { value: s.id }, text: longDate(s.date) + (s.location ? ' · ' + s.location : '') })
    )) : null;
    const name = el('input', { className: 'field__input', attrs: { id: 'oc-name', type: 'text', maxlength: '100', autocomplete: 'name', value: ns.profile ? ns.profile.get().naam || null : null } });
    const email = el('input', { className: 'field__input', attrs: { id: 'oc-email', type: 'email', maxlength: '254', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', 'aria-describedby': 'oc-email-error' } });
    const account = ns.account && ns.account.current();
    if (account) email.value = account.email;
    const emailError = el('p', { className: 'field__error', attrs: { id: 'oc-email-error' } });
    const allowPublic = el('input', { attrs: { id: 'oc-public', type: 'checkbox', checked: true } });
    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const submit = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('send'), el('span', { text: 'Aandragen' })]);
    const optional = (label) => el('span', { className: 'field__optional', text: label });
    let confirmSensitive = false;
    [title, body].forEach((input) => input.addEventListener('input', () => { confirmSensitive = false; }));

    const form = el('form', { className: 'idea-form', attrs: { novalidate: true } }, [
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'oc-title' }, text: 'Wat wil je bespreken?' }), title, titleError]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: 'oc-body' } }, ['Toelichting ', optional('(optioneel)')]),
        el('p', { className: 'field__hint', attrs: { id: 'oc-body-hint' }, text: 'Een vraag, iets wat je wilt laten zien, een ervaring om te delen of een onderwerp om samen over te brainstormen. Noem geen klantgegevens.' }),
        body
      ]),
      session ? el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'oc-session' }, text: 'Voor welke sessie?' }), session]) : null,
      el('div', { className: 'field-row' }, [
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'oc-name' } }, ['Naam ', optional('(optioneel)')]), name]),
        el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'oc-email' } }, ['E-mailadres ', optional('(optioneel)')]), email, emailError])
      ]),
      el('label', { className: 'check', attrs: { for: 'oc-public' } }, [allowPublic, edit(el('span'), 'opencockpit.formulier.openbaar', 'Mag op de agenda op deze pagina staan, zonder naam en e-mailadres, zodat collega\'s kunnen laten weten dat ze het ook willen bespreken.', 'Tekst bij het vinkje', true)]),
      el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Je naam en e-mailadres ziet alleen het AI-team.' })]),
      formError,
      submit
    ]);

    function failure(result, payload) {
      const message = result === 'off' ? 'De centrale opslag staat uit in de instellingen.' : 'Aandragen lukte niet. Controleer je internetverbinding en probeer het nog eens.';
      const copy = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('copy'), el('span', { text: 'Kopieer je tekst' })]);
      copy.addEventListener('click', async () => {
        const ok = await copyText(`${payload.title}\n\n${payload.body}`);
        toast(ok ? 'Je tekst staat op het klembord' : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
      });
      const actions = [copy];
      if (config.ideaFallbackEmail) {
        const href = 'mailto:' + encodeURIComponent(config.ideaFallbackEmail) + '?subject=' + encodeURIComponent(`${NAME}: ${payload.title}`) + '&body=' + encodeURIComponent(payload.body);
        actions.unshift(el('a', { className: 'btn btn--secondary btn--sm', attrs: { href } }, [icon('mail'), el('span', { text: 'Stuur per e-mail' })]));
      }
      formError.replaceChildren(
        el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: message })]),
        el('p', { text: 'Je tekst staat nog in het formulier.' }),
        el('div', { className: 'form-error__actions' }, actions)
      );
      formError.hidden = false;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.hidden = true;
      const what = title.value.trim();
      const mail = email.value.trim();
      titleError.textContent = what.length < 3 ? 'Geef je agendapunt een korte titel (minimaal 3 tekens).' : '';
      emailError.textContent = mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) ? 'Dit lijkt geen geldig e-mailadres.' : '';
      title.setAttribute('aria-invalid', String(Boolean(titleError.textContent)));
      email.setAttribute('aria-invalid', String(Boolean(emailError.textContent)));
      if (titleError.textContent || emailError.textContent) {
        (titleError.textContent ? title : email).focus();
        return;
      }
      const extra = body.value.trim();
      if (!confirmSensitive && ns.ideas.SENSITIVE.test(what + ' ' + extra)) {
        confirmSensitive = true;
        formError.replaceChildren(
          el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Staat hier een BSN of rekeningnummer in?' })]),
          el('p', { text: 'Haal persoons- en klantgegevens weg. Weet je zeker dat het goed is? Klik dan nog een keer op Aandragen.' })
        );
        formError.hidden = false;
        return;
      }
      const payload = {
        ref: ns.ui.randomId(),
        kind: KIND,
        title: what,
        // De database wil altijd een toelichting: zonder is het de titel
        body: extra || what,
        phase: '',
        name: name.value.trim(),
        email: mail,
        allowPublic: allowPublic.checked,
        session: session ? session.value : coming.length ? coming[0].id : NEXT
      };
      submit.disabled = true;
      const result = await ns.central.submitIdea(payload);
      submit.disabled = false;
      if (result !== 'ok') {
        failure(result, payload);
        return;
      }
      ns.ideas.rememberSubmission({ ref: payload.ref, kind: KIND, title: payload.title, at: new Date().toISOString() });
      title.value = '';
      body.value = '';
      onSent(payload);
    });
    return form;
  }

  /** Wat jij op dit apparaat hebt aangedragen, met de stand zodra het op de agenda staat. */
  function mineBlock() {
    const wrap = el('section', { className: 'side-card', attrs: { 'aria-labelledby': 'oc-mine-title', hidden: true } });
    let published = new Map();
    function render() {
      const list = ns.ideas.mySubmissions().filter((entry) => entry.kind === KIND).slice(0, 6);
      wrap.hidden = !list.length;
      if (!list.length) return;
      wrap.replaceChildren(
        el('h2', { className: 'side-card__title', attrs: { id: 'oc-mine-title' } }, [icon('star'), el('span', { text: 'Jouw agendapunten' })]),
        el('ul', { className: 'mine', attrs: { role: 'list' } }, list.map((entry) => {
          const item = published.get(entry.ref);
          return el('li', { className: 'mine__item' }, [
            el('span', { className: 'mine__title', text: entry.title }),
            ns.ideas.statusBadge(item ? item.status : 'nieuw', STATUSES),
            el('span', { className: 'mine__date', text: formatDate(entry.at) })
          ]);
        }))
      );
    }
    render();
    return {
      node: wrap,
      render,
      update(items) {
        published = new Map(items.filter((item) => item.ref).map((item) => [item.ref, item]));
        render();
      }
    };
  }

  function howBlock() {
    const steps = [
      'Draag een onderwerp aan: een vraag, een ervaring of iets om samen over te brainstormen.',
      'Het AI-team zet het op de agenda. Herken je een punt? Laat het weten met "Ik ook".',
      'In de sessie: eerst het nieuws rond Copilot van de afgelopen weken, dan de agendapunten.',
      'Na afloop staat de reactie bij ieder punt hieronder, bij Eerdere sessies.'
    ];
    const list = ns.blocks.stepsList(steps, 'small');
    list.querySelectorAll('.steps__item > span:last-child').forEach((span, index) =>
      edit(span, `opencockpit.zo-werkt-het.stap${index + 1}`, steps[index], `Stap ${index + 1}`, true));
    return el('section', { className: 'side-card', attrs: { 'aria-labelledby': 'oc-how-title' } }, [
      el('h2', { className: 'side-card__title', attrs: { id: 'oc-how-title' } }, [icon('info'), edit(el('span'), 'opencockpit.zo-werkt-het.titel', 'Zo werkt het', 'Kop')]),
      list
    ]);
  }

  /** Eén agendapunt, met de namen van een agenda en 'Uit de sessie' boven de reactie. */
  const agendaItem = (item, mine, votes) => ns.ideas.ideaItem(item, mine, { statuses: STATUSES, answerLabel: 'Uit de sessie', chip: false, votes, headingTag: 'h3' });

  /** Eén eerdere sessie, in te klappen: samenvatting, nieuws, opname en de behandelde punten. */
  function pastSession(session, items, mineRefs, open) {
    const count = items.length;
    return el('details', { className: 'oc-past', attrs: { open: open || null } }, [
      el('summary', { className: 'oc-past__summary' }, [
        dateBadge(session.date),
        el('span', { className: 'oc-past__head' }, [
          el('span', { className: 'oc-past__title', text: longDate(session.date).replace(/^./, (c) => c.toUpperCase()) }),
          el('span', { className: 'oc-past__meta', text: [session.location || 'Online', count ? (count === 1 ? '1 agendapunt' : count + ' agendapunten') : '', session.recording ? 'met opname' : ''].filter(Boolean).join(' · ') })
        ]),
        icon('chevron-down', { className: 'oc-past__chevron' })
      ]),
      el('div', { className: 'oc-past__body' }, [
        session.summary ? el('p', { className: 'oc-past__text', text: session.summary }) : null,
        session.news.length ? el('div', { className: 'oc-past__news' }, [
          el('h3', { className: 'oc-past__label' }, [icon('sparkle'), el('span', { text: 'Nieuws over Copilot' })]),
          el('ul', { className: 'oc-past__list' }, session.news.map((line) => el('li', { text: line })))
        ]) : null,
        session.recording ? el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: session.recording, target: '_blank', rel: 'noopener' } }, [icon('play-circle'), el('span', { text: 'Bekijk de opname' })]) : null,
        count ? el('div', { className: 'oc-past__items' }, items.map((item) => agendaItem(item, mineRefs.has(item.ref), false))) : null,
        !session.summary && !session.news.length && !session.recording && !count ? el('p', { className: 'oc-past__text', text: 'Van deze sessie staat nog niets op de pagina.' }) : null
      ])
    ]);
  }

  /* ---- De pagina ------------------------------------------------------------------------- */
  function render() {
    const cfg = settings();
    const mine = mineBlock();
    const formCard = el('section', { className: 'form-card', attrs: { 'aria-labelledby': 'oc-form-title' } });
    const done = el('div', { className: 'done', attrs: { hidden: true, tabindex: '-1' } });
    const agendaList = el('div', { className: 'hub__list', attrs: { 'aria-busy': 'true' } });
    const agendaStatus = el('div', { className: 'hub__status' }, [el('p', { className: 'loading', text: 'Agenda laden…' })]);
    const pastList = el('div', { className: 'oc-pasts' });
    const pastSection = el('section', { className: 'section section--tight', attrs: { 'aria-labelledby': 'oc-past-title', hidden: true } }, [
      el('div', { className: 'section__head' }, [edit(el('h2', { className: 'section__title', attrs: { id: 'oc-past-title' } }), 'opencockpit.eerder.titel', 'Eerdere sessies', 'Kop')]),
      pastList
    ]);
    const comingSession = next(cfg);

    const form = ns.app.config().enableIdeas === false
      ? el('p', { text: 'Agendapunten aandragen staat op dit moment uit.' })
      : agendaForm(cfg, (payload) => {
        form.hidden = true;
        done.replaceChildren(
          el('span', { className: 'done__icon', attrs: { 'aria-hidden': 'true' } }, [icon('check-circle')]),
          el('h3', { className: 'done__title', text: 'Dank je wel, je agendapunt is binnen!' }),
          el('p', { text: payload.allowPublic
            ? 'Het AI-team bekijkt het en zet het op de agenda. Dan zie je het hieronder staan' + (payload.email ? ', en je krijgt persoonlijk bericht.' : '.')
            : 'Het AI-team bekijkt het en neemt het mee in de sessie, zonder het op de pagina te zetten.' }),
          el('button', { className: 'btn btn--secondary', attrs: { type: 'button' }, on: { click: () => {
            done.hidden = true;
            form.hidden = false;
            form.querySelector('#oc-title').focus();
          } } }, [icon('message-plus'), el('span', { text: 'Nog een agendapunt' })])
        );
        done.hidden = false;
        done.focus();
        mine.render();
      });
    formCard.append(edit(el('h2', { className: 'form-card__title', attrs: { id: 'oc-form-title' } }), 'opencockpit.formulier.titel', 'Draag een agendapunt aan', 'Kop'), form, done);

    const agenda = el('section', { className: 'section section--tight', attrs: { 'aria-labelledby': 'oc-agenda-title' } }, [
      el('div', { className: 'section__head' }, [
        el('h2', { className: 'section__title', attrs: { id: 'oc-agenda-title' } }, [
          edit(el('span'), 'opencockpit.agenda.titel', 'Op de agenda', 'Kop'),
          comingSession ? el('span', { className: 'section__title-note', text: ' · ' + formatDate(comingSession.date).replace(/ \d{4}$/, '') }) : null
        ])
      ]),
      edit(el('p', { className: 'section__lead' }), 'opencockpit.agenda.tekst', 'Wat collega\'s hebben aangedragen voor de volgende sessie. Wil je dit ook bespreken? Stem met "Ik ook": wat het meest leeft, komt het eerst aan bod.', 'Inleiding', true),
      agendaStatus,
      agendaList
    ]);

    function fill(items) {
      const day = today();
      const groups = bySession(items, cfg, day);
      const mineRefs = new Set(ns.ideas.mySubmissions().map((entry) => entry.ref));
      // Op de agenda: de punten van de volgende sessie (of, zonder geplande sessie, die voor de eerstvolgende)
      // (een punt dat het AI-team niet behandelt, valt eraf; een vooraf beantwoord punt blijft staan, zonder stemmen)
      const open = (groups.get(comingSession ? comingSession.id : NEXT) || []).filter((item) => item.status !== 'afgewezen');
      agendaList.replaceChildren(...(open.length
        ? open.map((item) => agendaItem(item, mineRefs.has(item.ref), !DONE.includes(item.status)))
        : [emptyState('Nog geen agendapunten', 'Draag het eerste onderwerp aan. Het nieuws rond Copilot staat sowieso op de agenda.', null, 'calendar')]));
      // Eerdere sessies: met wat er staat (samenvatting, nieuws, opname of punten)
      const shown = past(cfg, day).filter((s) => s.summary || s.news.length || s.recording || (groups.get(s.id) || []).length);
      pastSection.hidden = !shown.length;
      const nodes = shown.map((s, index) => pastSession(s, groups.get(s.id) || [], mineRefs, index === 0));
      pastList.replaceChildren(...nodes.slice(0, PAST_SHOWN));
      if (nodes.length > PAST_SHOWN) {
        const more = el('button', { className: 'btn btn--quiet btn--sm oc-pasts__more', attrs: { type: 'button' } }, [icon('chevron-down'), el('span', { text: `Toon ${nodes.length - PAST_SHOWN} oudere sessies` })]);
        more.addEventListener('click', () => {
          more.replaceWith(...nodes.slice(PAST_SHOWN));
        });
        pastList.append(more);
      }
      mine.update(items);
    }

    function load() {
      agendaList.setAttribute('aria-busy', 'true');
      agendaStatus.replaceChildren(el('p', { className: 'loading', text: 'Agenda laden…' }));
      ns.central.listAgenda().then((result) => {
        agendaList.setAttribute('aria-busy', 'false');
        if (result.status === 'ok') {
          agendaStatus.replaceChildren();
          fill(result.items);
          return;
        }
        // Zonder agendapunten toch de eerdere sessies (nieuws, opname) laten zien
        fill([]);
        agendaList.replaceChildren();
        const message = result.status === 'missing'
          ? ['De agenda wordt nog aangesloten', 'Zodra de centrale opslag klaarstaat, zie je hier de agendapunten van collega\'s. (Beheer: voer setup/supabase-audit-opencockpit.sql uit, stap 19.)']
          : result.status === 'off'
            ? ['Centrale opslag staat uit', 'In de instellingen (js/config.js) is geen centrale opslag ingesteld.']
            : ['De agenda laden lukte niet', 'Controleer je internetverbinding en probeer het opnieuw.'];
        agendaStatus.replaceChildren(el('div', { className: 'notice' }, [
          icon('info'),
          el('div', {}, [el('p', { className: 'notice__title', text: message[0] }), el('p', { text: message[1] })]),
          result.status === 'failed' ? el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Opnieuw' })]) : null
        ]));
      });
    }
    load();

    const node = el('div', { className: 'page container oc' }, [
      pageHeader({ key: 'pagina.opencockpit',
        eyebrow: NAME,
        title: 'Het inloopuur over Copilot',
        lead: cfg.intro || 'Iedere paar weken een uur om samen bij te praten over Copilot: het nieuws van de afgelopen weken, jullie vragen en ervaringen, en ruimte om te brainstormen. Op een vestiging en altijd online, dus iedereen kan aanhaken. Vrijwillig: loop binnen wanneer het je uitkomt.'
      }),
      nextCard(cfg),
      ...ns.layout.arrange('opencockpit', [
        { key: 'aandragen', label: 'Agendapunt aandragen', node: el('div', { className: 'ideas-layout' }, [formCard, el('div', { className: 'ideas-layout__side' }, [howBlock(), mine.node])]) },
        { key: 'agenda', label: 'Op de agenda', node: agenda },
        { key: 'eerder', label: 'Eerdere sessies', node: pastSection }
      ])
    ]);
    return { node, title: NAME };
  }

  /* ---- Aankondigingen elders ----------------------------------------------------------- */
  /** De volgende sessie als die binnen een week is (startpagina), anders null. */
  function soon(cfg) {
    const session = next(cfg || settings());
    if (!session || !ns.content) return null;
    return ns.content.daysUntil(session.date) <= ANNOUNCE_DAYS ? session : null;
  }

  /** Op de startpagina, in de week voor een sessie: een balk naar de pagina. */
  function teaser() {
    const session = soon();
    if (!session) return null;
    return el('div', { className: 'container wr-teaser-wrap' }, [
      el('a', { className: 'wr-teaser oc-teaser', attrs: { href: ROUTE } }, [
        el('span', { className: 'wr-teaser__icon', attrs: { 'aria-hidden': 'true' } }, [icon('calendar')]),
        el('span', { className: 'wr-teaser__body' }, [
          el('span', { className: 'wr-teaser__title', text: `${NAME} ${countdown(session.date).toLowerCase()}` }),
          el('span', { className: 'wr-teaser__text', text: `${longDate(session.date).replace(/^./, (c) => c.toUpperCase())}, ${session.start} uur · ${where(session)}. Draag nog een agendapunt aan.` })
        ]),
        el('span', { className: 'wr-teaser__go' }, [el('span', { text: 'Naar de agenda' }), icon('arrow-right')])
      ])
    ]);
  }

  /** In de ideeënhub: een blok naar Open Cockpit (met de volgende sessie, als die gepland is). */
  function hubCard() {
    const cfg = settings();
    if (cfg.off) return null;
    const session = next(cfg);
    return el('section', { className: 'side-card oc-hub', attrs: { 'aria-labelledby': 'oc-hub-title' } }, [
      el('h2', { className: 'side-card__title', attrs: { id: 'oc-hub-title' } }, [icon('calendar'), el('span', { text: `${NAME}: het inloopuur` })]),
      el('p', { className: 'side-card__text', text: session
        ? `Volgende sessie: ${longDate(session.date)}, ${session.start} uur, ${session.location ? where(session) : 'online via Teams'}.`
        : 'Samen bijpraten over Copilot: nieuws, vragen en ervaringen. Op een vestiging en online.' }),
      el('a', { className: 'section__link', attrs: { href: ROUTE } }, [el('span', { text: 'Agendapunt aandragen' }), icon('arrow-right')])
    ]);
  }

  ns.openCockpit = { NAME, ROUTE, KIND, NEXT, STATUSES, settings, upcoming, past, next, sessionOf, bySession, ics, longDate, where, pageUrl, soon, teaser, hubCard };
  ns.views = ns.views || {};
  ns.views.openCockpit = { render };
})(window.AIAudit);
