/* ==========================================================================
   Beheer → Start: het dashboard 'Deze week' (per discipline)
   --------------------------------------------------------------------------
   Eén plek om te zien wat er deze week in de cockpit van de gekozen
   discipline te doen is. Alles komt uit wat er al staat; afvinken hoeft niet:
   is het gedaan, dan verdwijnt het vanzelf.

   1. Te doen, op urgentie (een verlopen belofte van het AI-team gaat voor
      alles, met de badge bij het punt zelf): nieuwe inzendingen, verbeter-
      voorstellen bij prompts, testervaringen, AI-specialist invliegen, Open
      Cockpit (agendapunten, sessie plannen of afronden), reviews, ideeën om te
      beoordelen, werkversies en voorstellen, de tip van de week, trainingen
      zonder opname, onderhoud, het Copilot-gebruik en de nieuwsbrief.
   2. Nieuw binnen: de inzendingen van de afgelopen week, met een stip bij wat
      nieuw is sinds je vorige bezoek (bijgehouden op dit apparaat).
   3. Goed om te weten: de volgende Open Cockpit, de tip van deze week,
      geplande publicaties, doelkoers en de laatste import van het Copilot-gebruik.

   compute() rekent alles uit (zonder scherm, zie tests/tests.js); render()
   haalt de gegevens op en tekent het dashboard.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, formatDate } = ns.ui;
  const VISIT_KEY = 'beheerVorigBezoek';
  const DAY = 86400000;
  // Hoe lang iets in 'Nieuw binnen' staat, en hoe oud de laatste import van het Copilot-gebruik mag zijn
  const NEW_DAYS = 7;
  const USAGE_DAYS = 35;
  // Na hoeveel dagen een sessie van Open Cockpit of een training 'nog af te ronden' niet meer meldt
  const FOLLOW_UP_DAYS = 21;
  const TRAINING_DAYS = 60;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---- Datums ------------------------------------------------------------------------- */
  const parse = (date) => new Date(date + 'T12:00:00');
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (date, days) => {
    const d = parse(date);
    d.setDate(d.getDate() + days);
    return iso(d);
  };
  const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / DAY);

  /** Maandag en zondag van de week van een datum, en het weeknummer (ISO 8601). */
  function week(date) {
    const d = parse(date);
    const monday = addDays(date, -((d.getDay() + 6) % 7));
    const thursday = parse(addDays(monday, 3));
    const jan4 = new Date(thursday.getFullYear(), 0, 4, 12);
    const firstMonday = addDays(iso(jan4), -((jan4.getDay() + 6) % 7));
    return { monday, sunday: addDays(monday, 6), number: Math.floor(daysBetween(firstMonday, monday) / 7) + 1 };
  }

  /** De eerstvolgende vrijdag ná vandaag (de tip van de week komt op vrijdag). */
  function nextFriday(date) {
    const d = parse(date);
    const ahead = ((5 - d.getDay() + 7) % 7) || 7;
    return addDays(date, ahead);
  }

  /** 'vandaag', 'gisteren', of 'di 10 nov'. */
  function dayWords(value, today) {
    const date = String(value || '').slice(0, 10);
    if (!date) return '';
    const days = daysBetween(date, today);
    if (days === 0) return 'vandaag';
    if (days === 1) return 'gisteren';
    return parse(date).toLocaleDateString(ns.i18n ? ns.i18n.locale() : 'nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  }

  /* ---- Uitrekenen ----------------------------------------------------------------------- */
  // Waar een inzending in Beheer staat
  const tabOf = (kind) => (kind === 'invliegen' ? 'invliegen' : kind === 'agendapunt' ? 'opencockpit' : 'inzendingen');
  const titleOf = (row) => {
    const data = (row.draft && row.draft.data) || row.data || {};
    return data.title || data.label || row.id;
  };

  /**
   * Alles wat op het dashboard komt. data: { ideas, reviews, rows, tips, trainings, openCockpit (instelling),
   * onderhoud ({ text, due }), usage (rijen van het Copilot-gebruik), goals ({ text, due }), newsletterDay (bool) },
   * met null voor wat niet te lezen was of waar je geen rechten voor hebt.
   * ctx: { today, now (Date), lastVisit (ISO-tijd of ''), namespaces (eigen en, met rechten, de basis), has(tab) }.
   * @returns {{ todo: object[], fresh: object[], info: object[], counts: { todo, late, fresh } }}
   */
  function compute(data, ctx) {
    const has = ctx.has || (() => true);
    const today = ctx.today;
    const now = ctx.now || new Date();
    const todo = [];
    const info = [];
    // rank: lager = eerder. tone: 'late' (verlopen), 'due' (deze week), '' (gewoon)
    const add = (item) => todo.push(Object.assign({ rank: 50, tone: '', items: [] }, item));
    const ideas = Array.isArray(data.ideas) ? data.ideas : null;
    // Een belofte van het AI-team (js/promises.js) die verlopen is of vandaag afloopt: bij het punt zelf, en dan bovenaan
    const promiseOf = (item) => {
      const due = ns.promises.deadline(item, now);
      return due && (due.late || due.hoursLeft < 24) ? due : null;
    };
    const sample = (list) => list
      .map((item) => ({ item, due: promiseOf(item) }))
      .sort((a, b) => (a.due ? a.due.hoursLeft : Infinity) - (b.due ? b.due.hoursLeft : Infinity))
      .slice(0, 3)
      .map(({ item, due }) => ({ title: item.title, meta: due ? ns.promises.leftText(due) : dayWords(item.created_at, today), late: Boolean(due && due.late) }));
    /** Toon, badge en plek van een punt met inzendingen: een verlopen belofte gaat voor alles. */
    const urgency = (list, rank) => {
      const dues = list.map(promiseOf).filter(Boolean);
      const late = dues.filter((due) => due.late).length;
      if (late) return { tone: 'late', badge: late === 1 ? 'Belofte verlopen' : `${late} beloftes verlopen`, rank: rank / 10 };
      if (dues.length) return { tone: 'due', badge: 'Vandaag nog', rank: 5 + rank / 10 };
      return { tone: 'due', rank };
    };

    if (ideas) {
      const open = (kind) => ideas.filter((item) => item.kind === kind && item.status === 'nieuw');

      if (has('invliegen')) {
        const list = open('invliegen');
        if (list.length) add(Object.assign({ id: 'invliegen', tab: 'invliegen', icon: 'plane', title: `${plural(list.length, 'team wil', 'teams willen')} de AI-specialist invliegen`, text: 'Plan een moment of reageer.', items: sample(list) }, urgency(list, 10)));
      }
      if (has('inzendingen')) {
        const general = ideas.filter((item) => ['idee', 'vraag', 'verzoek', 'prompt'].includes(item.kind) && item.status === 'nieuw');
        if (general.length) {
          const kinds = ['verzoek', 'vraag', 'idee', 'prompt'].map((kind) => [kind, general.filter((item) => item.kind === kind).length]).filter(([, n]) => n);
          const words = { verzoek: ['verzoek', 'verzoeken'], vraag: ['vraag', 'vragen'], idee: ['idee', 'ideeën'], prompt: ['gedeelde prompt', 'gedeelde prompts'] };
          add(Object.assign({ id: 'inzendingen', tab: 'inzendingen', filter: { status: 'open', kind: 'all' }, icon: 'message-plus', title: `${plural(general.length, 'nieuwe inzending', 'nieuwe inzendingen')} in de ideeënhub`, text: kinds.map(([kind, n]) => plural(n, words[kind][0], words[kind][1])).join(' · '), items: sample(general) }, urgency(general, 20)));
        }
        const improvements = open('verbetering');
        if (improvements.length) add({ id: 'verbeteringen', tab: 'inzendingen', filter: { status: 'open', kind: 'verbetering' }, icon: 'wand', rank: 22, tone: 'due', title: `${plural(improvements.length, 'verbetervoorstel', 'verbetervoorstellen')} bij prompts`, text: 'Kijk wat er verandert en neem over wat beter is.', items: sample(improvements) });
        const tests = open('testfeedback');
        if (tests.length) add({ id: 'testervaringen', tab: 'inzendingen', filter: { status: 'open', kind: 'testfeedback' }, icon: 'flask', rank: 24, title: `${plural(tests.length, 'testervaring', 'testervaringen')} bij agents in testfase`, text: 'Lees mee en vat samen bij de agent.', items: sample(tests) });
      }
      // Open Cockpit (js/opencockpit.js): agendapunten, de volgende sessie plannen, een sessie afronden
      if (has('opencockpit') && ns.openCockpit) {
        const O = ns.openCockpit;
        const cfg = O.settings(data.openCockpit || {});
        const agenda = ideas.filter((item) => item.kind === O.KIND);
        const fresh = agenda.filter((item) => item.status === 'nieuw');
        if (fresh.length) add({ id: 'agendapunten', tab: 'opencockpit', icon: 'calendar', rank: 26, tone: 'due', title: `${plural(fresh.length, 'nieuw agendapunt', 'nieuwe agendapunten')} voor Open Cockpit`, text: 'Zet ze op de agenda, dan kunnen collega\'s meestemmen.', items: sample(fresh) });
        if (cfg.sessions.length || agenda.length) {
          const coming = O.next(cfg, today);
          if (!coming) add({ id: 'sessie-plannen', tab: 'opencockpit', icon: 'calendar', rank: 40, title: 'Plan de volgende sessie van Open Cockpit', text: 'Er staat geen sessie meer gepland. Collega\'s zien nu "De volgende sessie wordt gepland".' });
          const groups = O.bySession(agenda, cfg, today);
          O.past(cfg, today).filter((s) => daysBetween(s.date, today) <= FOLLOW_UP_DAYS).forEach((s) => {
            const waiting = (groups.get(s.id) || []).filter((item) => ['gepland', 'in-behandeling'].includes(item.status));
            const missing = [];
            if (waiting.length) missing.push(`reactie bij ${plural(waiting.length, 'agendapunt', 'agendapunten')}`);
            if (!s.news.length && !s.summary) missing.push('het nieuws of een samenvatting');
            if (missing.length) add({ id: 'sessie-' + s.id, tab: 'opencockpit', icon: 'checklist', rank: 30, tone: 'due', title: `Rond de sessie van ${formatDate(s.date).replace(/ \d{4}$/, '')} af`, text: 'Nog te doen: ' + missing.join(' en ') + '.' });
          });
          if (coming && daysBetween(today, coming.date) <= 7) {
            const count = (groups.get(coming.id) || []).filter((item) => item.status !== 'afgewezen' && item.status !== 'nieuw').length;
            info.push({ id: 'sessie', icon: 'calendar', label: 'Open Cockpit', value: daysBetween(today, coming.date) === 0 ? 'Vandaag' : formatDate(coming.date).replace(/ \d{4}$/, ''), text: `${coming.start} uur · ${coming.location || 'online'} · ${count} op de agenda`, tab: 'opencockpit' });
          }
        }
      }
      // Ideeën en verzoeken voor het portfolio (AI Value Matrix) die nog niet beoordeeld zijn
      if (has('portfolio') && ns.adminPortfolio) {
        const unassessed = ideas.filter((item) => ns.adminPortfolio.isCandidate(item) && !ns.adminPortfolio.outcome(item.assessment) && item.status !== 'nieuw');
        if (unassessed.length) add({ id: 'portfolio', tab: 'portfolio', icon: 'flag', rank: 60, title: `${plural(unassessed.length, 'idee', 'ideeën')} nog niet beoordeeld`, text: 'Opgepakte ideeën en verzoeken zonder score in de AI Value Matrix.', items: sample(unassessed) });
      }
    }

    // Reviews: toelichtingen die nog niet gepubliceerd zijn
    if (has('reviews') && Array.isArray(data.reviews)) {
      const unread = data.reviews.filter((item) => item.comment && !item.is_public);
      if (unread.length) add({ id: 'reviews', tab: 'reviews', icon: 'star', rank: 45, title: `${plural(unread.length, 'toelichting', 'toelichtingen')} bij reviews`, text: 'Lees ze en publiceer wat nuttig is voor collega\'s.' });
    }

    // Werkversies: wat opgeslagen maar nog niet gepubliceerd is, en voorstellen van redacteuren (js/editor.js)
    if ((has('inhoud') || has('basis')) && Array.isArray(data.rows)) {
      const spaces = ctx.namespaces || [];
      const waiting = data.rows.filter((row) => spaces.includes(row.namespace) && row.type !== 'meta' && row.type !== 'setting' && (row.draft || row.status === 'draft') && !row.publish_at);
      const proposals = waiting.filter((row) => row.draft_kind === 'voorstel');
      const own = waiting.filter((row) => row.draft_kind !== 'voorstel');
      if (proposals.length) add({ id: 'voorstellen', tab: 'inhoud', icon: 'pencil-line', rank: 35, tone: 'due', title: `${plural(proposals.length, 'voorstel', 'voorstellen')} van redacteuren`, text: 'Bekijk ze en publiceer, of stuur ze terug.', items: proposals.slice(0, 3).map((row) => ({ title: titleOf(row), meta: ns.kinds.label(row.type) })) });
      if (own.length) add({ id: 'werkversies', tab: 'inhoud', icon: 'pencil-line', rank: 55, title: `${plural(own.length, 'werkversie', 'werkversies')} nog niet gepubliceerd`, text: 'Opgeslagen, maar collega\'s zien het nog niet.', items: own.slice(0, 3).map((row) => ({ title: titleOf(row), meta: ns.kinds.label(row.type) })) });
      const planned = data.rows.filter((row) => spaces.includes(row.namespace) && row.publish_at && row.publish_at.slice(0, 10) <= addDays(today, 7));
      if (planned.length) info.push({ id: 'gepland', icon: 'calendar-clock', label: 'Gepland', value: String(planned.length), text: planned.length === 1 ? titleOf(planned[0]) + ' · ' + dayWords(planned[0].publish_at, today) : 'publicaties de komende 7 dagen', tab: 'inhoud' });
    }

    // Tip van de week: staat er een klaar voor de eerstvolgende vrijdag? (alleen als de discipline weektips gebruikt)
    if (has('inhoud') && Array.isArray(data.tips) && data.tips.some((tip) => tip.weekly)) {
      const friday = nextFriday(today);
      const ready = data.tips.find((tip) => tip.release === friday);
      const current = data.tips.filter((tip) => tip.weekly && tip.release <= today).sort((a, b) => (a.release < b.release ? 1 : -1))[0];
      if (!ready) {
        const days = daysBetween(today, friday);
        add({ id: 'weektip', tab: 'inhoud', icon: 'bulb', rank: days <= 2 ? 15 : 38, tone: days <= 2 ? 'due' : '', title: `Plan de tip van vrijdag ${formatDate(friday).replace(/ \d{4}$/, '')}`, text: 'Er staat nog geen tip van de week klaar: maak een tip met die datum als vrijgave.', badge: days === 1 ? 'Morgen' : `Nog ${days} dagen` });
      }
      info.push({ id: 'weektip', icon: 'bulb', label: 'Tip van de week', value: ready ? 'Klaar' : 'Nog niet', text: ready ? `${ready.title} · vrijdag` : current ? 'Nu: ' + current.title : 'Nog geen tip gepland', tab: 'inhoud' });
    }

    // Trainingen die geweest zijn zonder opname of naslagwerk
    if (has('inhoud') && Array.isArray(data.trainings)) {
      const past = data.trainings.filter((t) => t.date && t.date < today && daysBetween(t.date, today) <= TRAINING_DAYS && !t.available && !t.shared);
      if (past.length) add({ id: 'trainingen', tab: 'inhoud', icon: 'cap', rank: 58, title: `${plural(past.length, 'training', 'trainingen')} zonder opname of naslag`, text: 'Zet de opname of het naslagwerk online, dan kunnen collega\'s terugkijken.', items: past.slice(0, 3).map((t) => ({ title: t.title, meta: formatDate(t.date) })) });
    }

    // Onderhoud: zoekvragen zonder resultaat en inhoud die aandacht vraagt
    if (has('onderhoud') && data.onderhoud && data.onderhoud.text && !/^Niets/.test(data.onderhoud.text)) {
      add({ id: 'onderhoud', tab: 'onderhoud', icon: 'checklist', rank: 65, tone: data.onderhoud.due ? 'due' : '', title: 'Onderhoud', text: data.onderhoud.text });
    }

    // Copilot-gebruik: de laatste import
    if (has('copilot') && Array.isArray(data.usage)) {
      const imports = data.usage.filter((row) => ns.adminCopilot && ns.adminCopilot.isUsage(row.summary)).sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
      const last = imports[imports.length - 1];
      const age = last ? daysBetween(String(last.period_end).slice(0, 10), today) : null;
      if (!last || age > USAGE_DAYS) add({ id: 'copilot', tab: 'copilot', icon: 'sparkle', rank: 70, title: 'Lees het Copilot-gebruik in', text: last ? `De laatste import loopt tot ${formatDate(last.period_end)}.` : 'Er is nog geen import: lees de export uit het Microsoft 365-beheercentrum in.' });
      if (last) info.push({ id: 'copilot', icon: 'chart', label: 'Copilot-gebruik', value: 't/m ' + formatDate(last.period_end).replace(/ \d{4}$/, ''), text: age > USAGE_DAYS ? 'Tijd voor een nieuwe import' : 'Laatste import', tab: 'copilot' });
    }

    if (has('doelkoers') && data.goals && data.goals.text) info.push({ id: 'doelkoers', icon: 'compass', label: 'Doelkoers', value: data.goals.due ? 'Let op' : 'Op koers', text: data.goals.text, tab: 'doelkoers', tone: data.goals.due ? 'due' : '' });

    if (has('nieuwsbrief') && data.newsletterDay) add({ id: 'nieuwsbrief', tab: 'nieuwsbrief', icon: 'mail', rank: 12, tone: 'due', title: 'De maandnieuwsbrief staat klaar', text: 'Vandaag is de laatste dag van de maand: download hem als PDF of e-mail.', badge: 'Vandaag' });

    todo.sort((a, b) => a.rank - b.rank);

    // Nieuw binnen: de inzendingen van de afgelopen week (niet de verzoeken om in te vliegen die al bij Te doen staan, wel alles)
    const since = addDays(today, -NEW_DAYS);
    const fresh = (ideas || [])
      .filter((item) => String(item.created_at).slice(0, 10) >= since && (has(tabOf(item.kind)) || has('inzendingen')))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((item) => ({ id: item.id, kind: item.kind, title: item.title, status: item.status, tab: tabOf(item.kind), when: dayWords(item.created_at, today), unseen: Boolean(ctx.lastVisit) && item.created_at > ctx.lastVisit }));

    return {
      todo,
      fresh,
      info,
      counts: { todo: todo.length, late: todo.filter((item) => item.tone === 'late').length, unseen: fresh.filter((item) => item.unseen).length }
    };
  }

  /* ---- Tekenen ------------------------------------------------------------------------------ */
  function todoRow(item, onOpen) {
    const link = el('a', { className: 'dash-row' + (item.tone ? ' is-' + item.tone : ''), attrs: { href: '#/beheer/' + item.tab } }, [
      el('span', { className: 'dash-row__icon', attrs: { 'aria-hidden': 'true' } }, [icon(item.icon)]),
      el('span', { className: 'dash-row__body' }, [
        el('span', { className: 'dash-row__title', text: item.title }),
        item.text ? el('span', { className: 'dash-row__text', text: item.text }) : null,
        item.items.length ? el('span', { className: 'dash-row__items' }, item.items.map((sub) => el('span', { className: 'dash-row__item' + (sub.late ? ' is-late' : '') }, [
          el('span', { className: 'dash-row__item-title', text: sub.title }),
          sub.meta ? el('span', { className: 'dash-row__item-meta', text: sub.meta }) : null
        ]))) : null
      ]),
      item.badge ? el('span', { className: 'dash-row__badge', text: item.badge }) : null,
      icon('arrow-right', { className: 'dash-row__go' })
    ]);
    // Naar Inzendingen met het juiste filter (bijv. alleen verbetervoorstellen)
    if (item.filter) link.addEventListener('click', () => onOpen(item.filter));
    return el('li', {}, [link]);
  }

  function freshRow(item) {
    return el('li', {}, [el('a', { className: 'dash-new' + (item.unseen ? ' is-unseen' : ''), attrs: { href: '#/beheer/' + item.tab } }, [
      item.unseen ? el('span', { className: 'dash-new__dot', attrs: { title: 'Nieuw sinds je vorige bezoek' } }, [el('span', { className: 'sr-only', text: 'Nieuw sinds je vorige bezoek: ' })]) : el('span', { className: 'dash-new__dot is-seen', attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'dash-new__body' }, [
        el('span', { className: 'dash-new__title', text: item.title }),
        el('span', { className: 'dash-new__meta' }, [ns.ideas.kindChip(item.kind), el('span', { text: item.when })])
      ]),
      item.kind === 'agendapunt' && ns.openCockpit ? ns.ideas.statusBadge(item.status, ns.openCockpit.STATUSES) : ns.ideas.statusBadge(item.status)
    ])]);
  }

  function infoTile(item) {
    return el('li', {}, [el('a', { className: 'dash-info' + (item.tone ? ' is-' + item.tone : ''), attrs: { href: '#/beheer/' + item.tab } }, [
      el('span', { className: 'dash-info__label' }, [icon(item.icon), el('span', { text: item.label })]),
      el('span', { className: 'dash-info__value', text: item.value }),
      el('span', { className: 'dash-info__text', text: item.text })
    ])]);
  }

  /**
   * Het dashboard. allowed: de onderdelen die je mag zien (js/view-admin.js); onOpen(filter): zet het
   * filter van Inzendingen voordat je erheen gaat.
   */
  function render(allowed, onOpen) {
    const has = (id) => allowed.some((t) => t.id === id);
    const today = ns.content.today();
    const name = ns.cockpit.active().name;
    const w = week(today);
    const lastVisit = ns.ui.storage.get(VISIT_KEY, '');
    const kpis = el('ul', { className: 'dash__kpis', attrs: { role: 'list' } });
    const body = el('div', { className: 'dash__body', attrs: { 'aria-busy': 'true' } }, [el('p', { className: 'loading', text: 'Even alles nalopen…' })]);
    // '9 – 15 november', of over de maandgrens '29 december – 4 januari'
    const long = (date, withMonth) => parse(date).toLocaleDateString(ns.i18n.locale(), withMonth ? { day: 'numeric', month: 'long' } : { day: 'numeric' });
    const span = `${long(w.monday, w.monday.slice(5, 7) !== w.sunday.slice(5, 7))} – ${long(w.sunday, true)}`;

    const node = el('section', { className: 'dash', attrs: { 'aria-labelledby': 'dash-title' } }, [
      el('header', { className: 'dash__head' }, [
        el('div', {}, [
          el('p', { className: 'dash__eyebrow', text: `Week ${w.number} · ${span}` }),
          el('h2', { className: 'dash__title', attrs: { id: 'dash-title' }, text: `Deze week in ${name}` })
        ]),
        kpis
      ]),
      body
    ]);

    const namespace = ns.cockpit.namespace(ns.cockpit.activeId());
    const namespaces = [namespace].concat(has('basis') ? [ns.cockpit.GENERAL_NAMESPACE] : []);
    const safe = (promise) => promise.then((value) => value, () => null);
    const needIdeas = ['inzendingen', 'invliegen', 'opencockpit', 'portfolio'].some(has);
    Promise.all([
      needIdeas ? safe(ns.central.adminListIdeas()) : null,
      has('reviews') ? safe(ns.central.adminListReviews()) : null,
      has('onderhoud') ? safe(ns.adminOnderhoud.startStatus()) : null,
      has('copilot') ? safe(ns.central.listCopilotUsage()) : null,
      has('doelkoers') ? safe(ns.adminGoals.startStatus()) : null
    ]).then(([ideas, reviews, onderhoud, usage, goals]) => {
      const result = compute({
        ideas, reviews, onderhoud, usage, goals,
        rows: ns.content.adminRows,
        tips: ns.content.tips,
        trainings: ns.content.trainings,
        openCockpit: ns.content.openCockpit,
        newsletterDay: Boolean(ns.adminNewsletter.reminder())
      }, { today, now: new Date(), lastVisit, namespaces, has });
      // Vanaf nu is dit je vorige bezoek (voor de stip bij wat nieuw is)
      ns.ui.storage.set(VISIT_KEY, new Date().toISOString());

      const kpi = (value, label, tone) => el('li', { className: 'dash-kpi' + (tone ? ' is-' + tone : '') }, [el('span', { className: 'dash-kpi__value', text: String(value) }), el('span', { className: 'dash-kpi__label', text: label })]);
      kpis.replaceChildren(
        kpi(result.counts.todo, result.counts.todo === 1 ? 'te doen' : 'te doen', result.counts.todo ? 'due' : 'ok'),
        result.counts.late ? kpi(result.counts.late, result.counts.late === 1 ? 'verlopen' : 'verlopen', 'late') : null,
        kpi(result.counts.unseen, 'nieuw sinds je vorige bezoek', result.counts.unseen ? 'new' : '')
      );

      const todoPanel = el('section', { className: 'dash__panel dash__todo', attrs: { 'aria-labelledby': 'dash-todo-title' } }, [
        el('h3', { className: 'dash__panel-title', attrs: { id: 'dash-todo-title' } }, [icon('checklist'), el('span', { text: 'Te doen' })]),
        result.todo.length
          ? el('ol', { className: 'dash-list', attrs: { role: 'list' } }, result.todo.map((item) => todoRow(item, onOpen)))
          : el('div', { className: 'dash__done' }, [
            el('span', { className: 'dash__done-icon', attrs: { 'aria-hidden': 'true' } }, [icon('check-circle')]),
            el('p', { className: 'dash__done-title', text: 'Alles bij' }),
            el('p', { className: 'dash__done-text', text: `Er staat deze week niets open in de cockpit van ${name}.` })
          ])
      ]);
      const freshPanel = el('section', { className: 'dash__panel dash__new', attrs: { 'aria-labelledby': 'dash-new-title' } }, [
        el('h3', { className: 'dash__panel-title', attrs: { id: 'dash-new-title' } }, [icon('message-plus'), el('span', { text: 'Nieuw binnen' }), el('span', { className: 'dash__panel-note', text: `afgelopen ${NEW_DAYS} dagen` })]),
        result.fresh.length
          ? el('ul', { className: 'dash-feed', attrs: { role: 'list' } }, result.fresh.slice(0, 10).map(freshRow))
          : el('p', { className: 'dash__empty', text: ideas ? 'Deze week is er niets ingestuurd.' : 'Inzendingen zijn nu niet te lezen.' }),
        result.fresh.length > 10 ? el('a', { className: 'section__link', attrs: { href: '#/beheer/inzendingen' } }, [el('span', { text: `Nog ${result.fresh.length - 10} meer` }), icon('arrow-right')]) : null
      ]);
      const infoPanel = result.info.length ? el('section', { className: 'dash__panel dash__info', attrs: { 'aria-labelledby': 'dash-info-title' } }, [
        el('h3', { className: 'dash__panel-title', attrs: { id: 'dash-info-title' } }, [icon('info'), el('span', { text: 'Goed om te weten' })]),
        el('ul', { className: 'dash-infos', attrs: { role: 'list' } }, result.info.map(infoTile))
      ]) : null;
      body.replaceChildren(el('div', { className: 'dash__grid' }, [todoPanel, freshPanel]), infoPanel);
      body.setAttribute('aria-busy', 'false');
    });
    return node;
  }

  ns.adminDashboard = { compute, render, week, nextFriday, dayWords };
})(window.AIAudit);
