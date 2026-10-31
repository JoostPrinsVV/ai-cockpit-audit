/* ==========================================================================
   Beheer (#/beheer, /inhoud, /basis, /inzendingen, /reviews, /portfolio, /overzicht, /gebruik,
   /copilot, /nieuwsbrief, /disciplines, /beheerders)
   --------------------------------------------------------------------------
   Voor het AI-team: inloggen met een Supabase-gebruiker van wie het
   e-mailadres in audit_admins staat (zie setup/supabase-audit.sql).
   Links een zijbalk: bovenaan de discipline die je beheert, daaronder de
   onderdelen per groep (TABS). Rechts het onderdeel, met bovenaan voor welke
   discipline het is (of 'Alle disciplines'), de titel en één zin uitleg.
   - Start: wat er te doen is (met de stand van nu) en hoe Beheer werkt.
   - Overzicht: de stand van zaken over alle disciplines, voor het bestuur
     (af te drukken als PDF; js/admin-overview.js).
   - Inhoud: usecases, prompts, tips, trainingen, agents & tools, fasen en
     teksten van deze discipline (js/admin-content.js).
   - Gedeelde basis: wat in iedere cockpit staat (zelfde formulieren).
   - Disciplines: welke er zijn en welke open of op slot (js/admin-disciplines.js).
   - Inzendingen: lezen (met naam en e-mail), status zetten, beantwoorden,
     publiceren in de hub, beoordelen, verwijderen en exporteren (CSV).
   - Portfolio: de beoordeelde ideeën in de AI Value Matrix, met de
     registerregels (js/admin-portfolio.js).
   - Reviews: sterren en toelichtingen bij usecases en prompts; toelichting
     publiceren of verwijderen (js/reviews.js).
   - Nieuwsbrief: weekupdate of maandnieuwsbrief als PDF of e-mail
     (js/admin-newsletter.js).
   - Gebruik: anonieme tellers per usecase, demo, prompt, tip, training en agent.
   - Copilot-gebruik: de export van het Copilot-gebruik inlezen en vergelijken
     met de vorige periode; alleen totalen worden bewaard (js/admin-copilot.js).
   De sessie blijft bewaard zolang dit tabblad open is.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate, pageHeader } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const loadFailed = (error) => notice({ tone: 'warning', title: 'Laden mislukt', text: error.message });
  const view = { status: 'open', kind: 'all', days: 90, reviews: 'todo' };
  const PLAIN_EMAIL = /^[^\s@?&#%]+@[^\s@?&#%]+$/;
  // De onderdelen, per groep in de zijbalk. perDiscipline: gaat over de discipline die bovenin de
  // zijbalk gekozen is; de rest geldt voor alle disciplines. lead: de zin onder de titel.
  const GROUPS = [
    { id: 'start', label: '' },
    { id: 'inhoud', label: 'Inhoud' },
    { id: 'collegas', label: 'Inbreng van collega\'s' },
    { id: 'cijfers', label: 'Cijfers' },
    { id: 'communicatie', label: 'Communicatie' },
    { id: 'instellingen', label: 'Instellingen' }
  ];
  const TABS = [
    { id: 'start', group: 'start', label: 'Start', icon: 'plane', lead: () => 'Wat er te doen is, en waar je alles vindt.' },
    { id: 'inhoud', group: 'inhoud', label: 'Inhoud', icon: 'pencil-line', perDiscipline: true, lead: (name) => `Usecases, prompts, tips, trainingen, agents en teksten die alleen in de cockpit van ${name} staan.` },
    { id: 'basis', group: 'inhoud', label: 'Gedeelde basis', icon: 'globe', lead: () => 'Wat in iedere cockpit staat: wat je hier aanpast, zien alle disciplines.' },
    { id: 'inzendingen', group: 'collegas', label: 'Inzendingen', icon: 'message-plus', perDiscipline: true, lead: (name) => `Ideeën, vragen en verzoeken uit de ideeënhub van ${name}: beantwoorden, publiceren en beoordelen.` },
    { id: 'reviews', group: 'collegas', label: 'Reviews', icon: 'star', perDiscipline: true, lead: (name) => `Sterren en toelichtingen bij de usecases en prompts van ${name}. Een toelichting staat pas bij de usecase of prompt als jij hem publiceert.` },
    { id: 'portfolio', group: 'collegas', label: 'Portfolio', icon: 'flag', perDiscipline: true, lead: (name) => `De beoordeelde ideeën van ${name} in de AI Value Matrix, met de registerregels.` },
    { id: 'overzicht', group: 'cijfers', label: 'Overzicht', icon: 'grid', lead: () => 'De stand van zaken over alle disciplines, af te drukken als PDF voor het bestuur.' },
    { id: 'gebruik', group: 'cijfers', label: 'Gebruik van de cockpit', icon: 'chart', perDiscipline: true, lead: (name) => `Hoe vaak usecases, demo's, prompts, tips, trainingen en agents in ${name} worden bekeken en gekopieerd. Anoniem.` },
    { id: 'copilot', group: 'cijfers', label: 'Copilot-gebruik', icon: 'sparkle', perDiscipline: true, lead: (name) => `Het Copilot-gebruik van ${name} per import, met de belangrijke momenten erbij.` },
    { id: 'nieuwsbrief', group: 'communicatie', label: 'Nieuwsbrief', icon: 'mail', perDiscipline: true, lead: (name) => `Een weekupdate of maandnieuwsbrief over ${name}, als PDF of als e-mail.` },
    { id: 'disciplines', group: 'instellingen', label: 'Disciplines', icon: 'layers', lead: () => 'Welke disciplines er zijn, en welke open staan voor collega\'s of nog op slot.' },
    { id: 'beheerders', group: 'instellingen', label: 'Beheerders', icon: 'users', lead: () => 'Wie mag beheren: in welke discipline, en welke onderdelen.' }
  ];

  /** De zijbalk: de discipline die je beheert (vast bovenaan), de onderdelen per groep en wie er is ingelogd. */
  function sidebar(tab, allowed, session) {
    const activeId = ns.cockpit.activeId();
    const current = TABS.find((t) => t.id === tab);
    const scope = el('div', { className: 'admin-nav__scope' }, [
      el('p', { className: 'admin-nav__label', attrs: { id: 'admin-scope-label' }, text: 'Je beheert' }),
      // Een andere discipline: hetzelfde onderdeel in de cockpit van die discipline
      el('ul', { className: 'admin-nav__disciplines', attrs: { role: 'list', 'aria-labelledby': 'admin-scope-label' } }, ns.cockpit.registry().map((discipline) => el('li', {}, [
        el('a', {
          className: 'admin-nav__discipline',
          attrs: {
            href: ns.cockpit.href(discipline.id, '#/beheer/' + tab),
            'aria-current': discipline.id === activeId ? 'true' : null,
            title: discipline.status === 'open' ? 'Open voor iedereen' : 'Op slot: alleen beheerders'
          }
        }, [
          el('span', { className: 'admin-nav__dot', attrs: { 'aria-hidden': 'true' } }),
          el('span', { text: discipline.name }),
          discipline.status === 'open' ? null : icon('lock', { label: 'op slot' })
        ])
      ]))),
      current && !current.perDiscipline && tab !== 'start' ? el('p', { className: 'admin-nav__note', text: 'Dit onderdeel geldt voor alle disciplines.' }) : null
    ]);
    const groups = GROUPS.map((group) => {
      const items = allowed.filter((t) => t.group === group.id);
      if (!items.length) return null;
      const labelId = 'admin-group-' + group.id;
      return el('div', { className: 'admin-nav__group' }, [
        group.label ? el('p', { className: 'admin-nav__label', attrs: { id: labelId }, text: group.label }) : null,
        el('ul', { className: 'admin-nav__list', attrs: { role: 'list', 'aria-labelledby': group.label ? labelId : null } }, items.map((t) => el('li', {}, [
          // Inhoud heet naar de discipline (naast Gedeelde basis): dan zie je meteen waarvoor het is
          el('a', { className: 'admin-nav__item', attrs: { href: '#/beheer/' + t.id, 'aria-current': t.id === tab ? 'page' : null } }, [icon(t.icon), el('span', { text: t.id === 'inhoud' ? ns.cockpit.active().name : t.label })])
        ])))
      ]);
    });
    // data-keep-scroll: js/app.js bewaart hoe ver je in de zijbalk gescrold was
    return el('aside', { className: 'admin-nav', dataset: { keepScroll: 'admin-nav' } }, [
      scope,
      el('nav', { className: 'admin-nav__menu', attrs: { 'aria-label': 'Onderdelen van Beheer' } }, groups),
      session
    ]);
  }

  /** Waarin Beheer → Inhoud of Gedeelde basis werkt (zie js/admin-content.js). */
  function scopeFor(tab) {
    const discipline = ns.cockpit.active();
    return tab === 'basis'
      ? { kind: 'basis', namespace: ns.cockpit.GENERAL_NAMESPACE, base: '#/beheer/basis', name: 'de gedeelde basis', id: 'algemeen', files: false }
      : { kind: 'discipline', namespace: ns.cockpit.namespace(discipline.id), base: '#/beheer/inhoud', name: discipline.name, id: discipline.id, files: discipline.id === ns.cockpit.FILES_ID };
  }

  /* ---- Inloggen ---------------------------------------------------------------- */
  function loginForm(onDone) {
    const email = el('input', { className: 'field__input', attrs: { id: 'admin-email', type: 'email', autocomplete: 'username', required: true, autocapitalize: 'off', spellcheck: 'false' } });
    const password = el('input', { className: 'field__input', attrs: { id: 'admin-password', type: 'password', autocomplete: 'current-password', required: true } });
    const error = el('p', { className: 'field__error', attrs: { role: 'alert' } });
    const submit = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('lock'), el('span', { text: 'Inloggen' })]);
    const form = el('form', { className: 'form-card form-card--narrow', attrs: { novalidate: true } }, [
      el('h2', { className: 'form-card__title', text: 'Inloggen voor beheer' }),
      el('p', { className: 'field__hint', text: 'Met je Supabase-account. Je e-mailadres moet als beheerder zijn toegevoegd.' }),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'E-mailadres', attrs: { for: 'admin-email' } }), email]),
      el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Wachtwoord', attrs: { for: 'admin-password' } }), password]),
      error,
      submit
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      if (!email.value.trim() || !password.value) {
        error.textContent = 'Vul je e-mailadres en wachtwoord in.';
        return;
      }
      submit.disabled = true;
      const result = await ns.central.signIn(email.value.trim(), password.value);
      submit.disabled = false;
      password.value = '';
      if (result === 'ok') onDone();
      else if (result === 'not-admin') {
        ns.central.signOut();
        error.textContent = 'Je bent ingelogd, maar dit account heeft geen beheerdersrol. Vraag een hoofdbeheerder om je toe te voegen (Beheer → Beheerders).';
      } else error.textContent = 'Inloggen mislukt. Controleer je gegevens of je verbinding.';
    });
    return form;
  }

  /* ---- Inzendingen ---------------------------------------------------------------- */
  function exportCsv(items) {
    const columns = ['id', 'created_at', 'kind', 'status', 'is_public', 'allow_public', 'votes', 'phase', 'title', 'body', 'name', 'email', 'answer', 'answered_at'];
    kit.downloadCsv('ideeenhub-' + new Date().toISOString().slice(0, 10) + '.csv', columns, items.map((item) => columns.map((column) => item[column])));
  }

  function adminItem(item, onChanged) {
    const statuses = ns.ideas.STATUSES;
    const status = el('select', { className: 'field__input field__input--sm', attrs: { id: 'st-' + item.id } },
      Object.entries(statuses).map(([value, info]) => el('option', { attrs: { value, selected: value === item.status }, text: info.label })));
    const answer = el('textarea', { className: 'field__input field__textarea', attrs: { id: 'an-' + item.id, rows: '4', maxlength: '4000', placeholder: 'Reactie van het AI-team (zichtbaar in de hub als de inzending gepubliceerd is)' } });
    answer.value = item.answer || '';
    const publish = el('input', { attrs: { id: 'pub-' + item.id, type: 'checkbox', checked: item.is_public, disabled: !item.allow_public } });
    const save = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
    const remove = el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Verwijderen' })]);

    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const updated = await ns.central.adminUpdateIdea(item.id, { status: status.value, answer: answer.value.trim() || null, is_public: publish.checked && item.allow_public });
        Object.assign(item, updated);
        toast('Opgeslagen', { tone: 'success' });
        onChanged();
      } catch (error) {
        kit.failed('Opslaan', error);
      } finally {
        save.disabled = false;
      }
    });
    remove.addEventListener('click', async () => {
      if (!(await ns.ui.confirmDialog(`Inzending "${item.title}" wordt definitief verwijderd. Dit kan niet ongedaan worden gemaakt.`, { title: 'Inzending verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
      remove.disabled = true;
      try {
        await ns.central.adminDeleteIdea(item.id);
        item.deleted = true;
        toast('Verwijderd');
        onChanged();
      } catch (error) {
        kit.failed('Verwijderen', error);
        remove.disabled = false;
      }
    });

    const phase = item.phase ? ns.content.phaseById.get(item.phase) : null;
    return el('details', { className: 'admin-item' }, [
      el('summary', { className: 'admin-item__summary' }, [
        el('span', { className: 'admin-item__date', text: formatDate(item.created_at) }),
        ns.ideas.kindChip(item.kind),
        el('span', { className: 'admin-item__title', text: item.title }),
        ns.ideas.statusBadge(item.status),
        ns.adminPortfolio.badge(ns.adminPortfolio.outcome(item.assessment)),
        item.is_public ? el('span', { className: 'badge badge--free', attrs: { title: 'Zichtbaar in de hub' } }, [icon('eye'), 'Gepubliceerd']) : null,
        item.votes ? el('span', { className: 'badge', attrs: { title: 'Stemmen' } }, [icon('thumb'), String(item.votes)]) : null,
        icon('chevron-down', { className: 'admin-item__chevron' })
      ]),
      el('div', { className: 'admin-item__body' }, [
        el('dl', { className: 'admin-item__meta' }, [
          el('div', {}, [el('dt', { text: 'Fase' }), el('dd', { text: phase ? phase.label : '–' })]),
          el('div', {}, [el('dt', { text: 'Naam' }), el('dd', { text: item.name || '–' })]),
          // Alleen een gewoon adres wordt een maillink (geen ?cc= of &bcc= erachter)
          el('div', {}, [el('dt', { text: 'E-mail' }), el('dd', {}, [item.email ? (PLAIN_EMAIL.test(item.email) ? el('a', { attrs: { href: 'mailto:' + item.email }, text: item.email }) : item.email) : '–'])]),
          el('div', {}, [el('dt', { text: 'Publiceren' }), el('dd', { text: item.allow_public ? 'Mag (zonder naam)' : 'Liever niet' })])
        ]),
        el('p', { className: 'admin-item__text', text: item.body }),
        // Ideeën en verzoeken (of wat al beoordeeld is): de AI Value Matrix, zie js/admin-portfolio.js
        ns.adminPortfolio.isCandidate(item) || item.assessment ? ns.adminPortfolio.summaryRow(item, onChanged) : null,
        el('div', { className: 'admin-item__form' }, [
          el('div', { className: 'field' }, [el('label', { className: 'field__label', text: 'Status', attrs: { for: 'st-' + item.id } }), status]),
          el('div', { className: 'field field--wide' }, [el('label', { className: 'field__label', text: 'Reactie', attrs: { for: 'an-' + item.id } }), answer]),
          el('label', { className: 'check', attrs: { for: 'pub-' + item.id } }, [publish, el('span', { text: item.allow_public ? 'Zichtbaar in de hub (zonder naam en e-mail)' : 'Niet publiceren: de inzender wil dit liever niet' })]),
          el('div', { className: 'admin-item__actions' }, [save, remove])
        ])
      ])
    ]);
  }

  function ideasTab(container) {
    const list = el('div', { className: 'admin-list' });
    const summary = el('div', { className: 'kpis' });
    let items = [];

    const statusFilter = el('select', { className: 'field__input field__input--sm', attrs: { id: 'adm-status' } }, [
      el('option', { attrs: { value: 'open' }, text: 'Openstaand (ontvangen + in behandeling)' }),
      el('option', { attrs: { value: 'all' }, text: 'Alle statussen' }),
      ...Object.entries(ns.ideas.STATUSES).map(([value, info]) => el('option', { attrs: { value }, text: info.label }))
    ]);
    statusFilter.value = view.status;
    const kindFilter = el('select', { className: 'field__input field__input--sm', attrs: { id: 'adm-kind' } }, [
      el('option', { attrs: { value: 'all' }, text: 'Alle soorten' }),
      ...ns.ideas.KINDS.map((kind) => el('option', { attrs: { value: kind.id }, text: kind.label }))
    ]);
    kindFilter.value = view.kind;

    function update() {
      items = items.filter((item) => !item.deleted);
      const counts = {};
      items.forEach((item) => {
        counts[item.status] = (counts[item.status] || 0) + 1;
      });
      summary.replaceChildren(...Object.entries(ns.ideas.STATUSES).map(([value, info]) =>
        el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(counts[value] || 0) }), el('span', { className: 'kpi__label', text: info.label })])
      ));
      const shown = items.filter((item) =>
        (view.kind === 'all' || item.kind === view.kind) &&
        (view.status === 'all' || (view.status === 'open' ? ['nieuw', 'in-behandeling'].includes(item.status) : item.status === view.status))
      );
      list.replaceChildren(...(shown.length ? shown.map((item) => adminItem(item, update)) : [el('p', { className: 'section__lead', text: 'Geen inzendingen met deze filters.' })]));
    }

    statusFilter.addEventListener('change', () => {
      view.status = statusFilter.value;
      update();
    });
    kindFilter.addEventListener('change', () => {
      view.kind = kindFilter.value;
      update();
    });

    async function load() {
      list.replaceChildren(el('p', { className: 'loading', text: 'Inzendingen laden…' }));
      try {
        items = await ns.central.adminListIdeas();
        update();
      } catch (error) {
        list.replaceChildren(loadFailed(error));
        if (!ns.central.signedIn()) container.dispatchEvent(new CustomEvent('signedout'));
      }
    }

    container.append(
      summary,
      el('div', { className: 'filters filters--inline' }, [
        el('label', { className: 'sr-only', text: 'Status', attrs: { for: 'adm-status' } }), statusFilter,
        el('label', { className: 'sr-only', text: 'Soort', attrs: { for: 'adm-kind' } }), kindFilter,
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Vernieuwen' })]),
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: () => (items.length ? exportCsv(items) : toast('Nog niets om te exporteren')) } }, [icon('download'), el('span', { text: 'Exporteer (CSV)' })])
      ]),
      list
    );
    load();
  }

  /* ---- Reviews ---------------------------------------------------------------- */
  function reviewsTab(container) {
    const summary = el('div');
    const list = el('div', { className: 'admin-list' });
    let items = [];
    const filter = el('select', { className: 'field__input field__input--sm', attrs: { id: 'adm-reviews' } }, [
      el('option', { attrs: { value: 'todo' }, text: 'Toelichting nog niet gepubliceerd' }),
      el('option', { attrs: { value: 'comments' }, text: 'Alle met toelichting' }),
      el('option', { attrs: { value: 'all' }, text: 'Alle reviews' })
    ]);
    filter.value = view.reviews || 'todo';

    const lookup = (type) => (type === 'usecase' ? ns.content.usecaseById : ns.content.promptById);
    const titleOf = (type, id) => {
      const found = lookup(type).get(id);
      return found ? (found.usecase ? found.usecase.title + ' · ' + found.title : found.title) : id + ' (verwijderd)';
    };

    function reviewRow(item) {
      const publish = item.comment ? el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon(item.is_public ? 'eye' : 'check'), el('span', { text: item.is_public ? 'Toelichting verbergen' : 'Toelichting publiceren' })]) : null;
      const remove = el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Verwijderen' })]);
      if (publish) publish.addEventListener('click', async () => {
        publish.disabled = true;
        try {
          Object.assign(item, await ns.central.adminUpdateReview(item.id, { is_public: !item.is_public }));
          toast(item.is_public ? 'Gepubliceerd: de toelichting staat nu bij de ' + (item.item_type === 'usecase' ? 'usecase' : 'prompt') : 'Verborgen', { tone: 'success' });
          update();
        } catch (error) {
          kit.failed('Opslaan', error);
          publish.disabled = false;
        }
      });
      remove.addEventListener('click', async () => {
        if (!(await ns.ui.confirmDialog('Deze review wordt definitief verwijderd en telt niet meer mee in het gemiddelde.', { title: 'Review verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
        remove.disabled = true;
        try {
          await ns.central.adminDeleteReview(item.id);
          items = items.filter((other) => other !== item);
          toast('Verwijderd');
          update();
        } catch (error) {
          kit.failed('Verwijderen', error);
          remove.disabled = false;
        }
      });
      return el('div', { className: 'admin-review' }, [
        el('div', { className: 'admin-review__head' }, [
          el('span', { className: 'admin-item__date', text: formatDate(item.created_at) }),
          ns.reviews.starRow(item.rating),
          el('a', { className: 'admin-review__title', attrs: { href: `#/${item.item_type}/${item.item_id}` }, text: titleOf(item.item_type, item.item_id) }),
          el('span', { className: 'chip', text: item.item_type === 'usecase' ? 'Usecase' : 'Prompt' }),
          item.comment ? el('span', { className: 'badge ' + (item.is_public ? 'badge--free' : 'badge--draft') }, [icon(item.is_public ? 'eye' : 'pencil-line'), item.is_public ? 'Gepubliceerd' : 'Niet gepubliceerd']) : null
        ]),
        el('p', { className: 'admin-review__text' + (item.comment ? '' : ' admin-review__text--empty'), text: item.comment || 'Alleen sterren, geen toelichting.' }),
        el('div', { className: 'admin-item__actions' }, [publish, remove])
      ]);
    }

    function update() {
      // Per item: gemiddelde en aantal, meest beoordeeld eerst
      const per = new Map();
      items.forEach((item) => {
        const k = item.item_type + ':' + item.item_id;
        const entry = per.get(k) || { type: item.item_type, id: item.item_id, count: 0, sum: 0 };
        entry.count += 1;
        entry.sum += item.rating;
        per.set(k, entry);
      });
      const rows = Array.from(per.values()).sort((a, b) => b.count - a.count || b.sum / b.count - a.sum / a.count);
      summary.replaceChildren(rows.length ? el('section', { className: 'usage-table' }, [
        el('h3', { className: 'usage-table__title', text: 'Gemiddelde per usecase en prompt' }),
        el('table', { className: 'table' }, [
          el('thead', {}, [el('tr', {}, ['Usecase of prompt', 'Soort', 'Gemiddeld', 'Reviews'].map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index > 1 ? 'num' : null } })))]),
          el('tbody', {}, rows.map((entry) => el('tr', {}, [
            el('th', { attrs: { scope: 'row' } }, [el('a', { attrs: { href: `#/${entry.type}/${entry.id}` }, text: titleOf(entry.type, entry.id) })]),
            el('td', { text: entry.type === 'usecase' ? 'Usecase' : 'Prompt' }),
            el('td', { className: 'num', text: (entry.sum / entry.count).toFixed(1).replace('.', ',') }),
            el('td', { className: 'num', text: String(entry.count) })
          ])))
        ])
      ]) : el('p', { className: 'section__lead', text: 'Nog geen reviews.' }));
      const shown = items.filter((item) => (view.reviews === 'all' ? true : view.reviews === 'comments' ? Boolean(item.comment) : item.comment && !item.is_public));
      list.replaceChildren(...(shown.length ? shown.map(reviewRow) : [el('p', { className: 'section__lead', text: view.reviews === 'todo' ? 'Geen toelichtingen die nog bekeken moeten worden.' : 'Geen reviews met dit filter.' })]));
    }

    filter.addEventListener('change', () => {
      view.reviews = filter.value;
      update();
    });

    async function load() {
      list.replaceChildren(el('p', { className: 'loading', text: 'Reviews laden…' }));
      try {
        items = await ns.central.adminListReviews();
        update();
      } catch (error) {
        summary.replaceChildren();
        list.replaceChildren(loadFailed(error));
      }
    }

    container.append(
      el('p', { className: 'field__hint', text: 'Collega\'s geven usecases en prompts 1 tot 5 sterren, met eventueel een toelichting. De sterren tellen direct mee; een toelichting staat pas bij de usecase of prompt als je hem hier publiceert. Reviews zijn anoniem.' }),
      el('div', { className: 'filters filters--inline' }, [
        el('label', { className: 'sr-only', text: 'Welke reviews', attrs: { for: 'adm-reviews' } }), filter,
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Vernieuwen' })])
      ]),
      list,
      summary
    );
    load();
  }

  /* ---- Gebruik ---------------------------------------------------------------- */
  function usageTab(container) {
    const body = el('div');
    const days = el('select', { className: 'field__input field__input--sm', attrs: { id: 'adm-days' } }, [30, 90, 365].map((value) =>
      el('option', { attrs: { value: String(value), selected: value === view.days }, text: `Afgelopen ${value} dagen` })));
    days.addEventListener('change', () => {
      view.days = Number(days.value);
      load();
    });

    function table(title, rows, columns) {
      return el('section', { className: 'usage-table' }, [
        el('h3', { className: 'usage-table__title', text: title }),
        rows.length ? el('table', { className: 'table' }, [
          el('thead', {}, [el('tr', {}, columns.map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: index ? 'num' : null } })))]),
          el('tbody', {}, rows.map((row) => el('tr', {}, row.map((cell, index) => el(index ? 'td' : 'th', { text: String(cell), attrs: { class: index ? 'num' : null, scope: index ? null : 'row' } })))))
        ]) : el('p', { className: 'section__lead', text: 'Nog geen gegevens.' })
      ]);
    }

    async function load() {
      body.replaceChildren(el('p', { className: 'loading', text: 'Tellers laden…' }));
      try {
        const events = await ns.central.adminEvents(view.days);
        const count = (kind) => {
          const map = new Map();
          events.filter((e) => e.kind === kind).forEach((e) => map.set(e.item_id, (map.get(e.item_id) || 0) + 1));
          return map;
        };
        const views = count('view_usecase');
        const plays = count('play_demo');
        const copies = count('copy_prompt');
        const tipViews = count('view_tip');
        const tipCopies = count('copy_tip');
        const trainingViews = count('view_training');
        const trainingPlays = count('play_training');
        const agentViews = count('view_agent');
        const agentOpens = count('open_agent');
        const total = (map) => Array.from(map.values()).reduce((sum, n) => sum + n, 0);
        const sorted = (map) => Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        const title = (lookup, id) => {
          const item = lookup.get(id);
          return item ? (item.usecase ? item.usecase.title + ' · ' + item.title : item.title) : id + ' (verwijderd)';
        };

        const usecaseIds = new Set([...views.keys(), ...plays.keys()]);
        const usecaseRows = Array.from(usecaseIds).map((id) => [title(ns.content.usecaseById, id), views.get(id) || 0, plays.get(id) || 0]).sort((a, b) => b[1] + b[2] - a[1] - a[2]);
        const promptRows = sorted(copies).slice(0, 20).map(([id, n]) => [title(ns.content.promptById, id), n]);
        const tipIds = new Set([...tipViews.keys(), ...tipCopies.keys()]);
        const tipRows = Array.from(tipIds).map((id) => [title(ns.content.tipById, id), tipViews.get(id) || 0, tipCopies.get(id) || 0]).sort((a, b) => b[1] + b[2] - a[1] - a[2]);
        const trainingIds = new Set([...trainingViews.keys(), ...trainingPlays.keys()]);
        const trainingRows = Array.from(trainingIds).map((id) => [title(ns.content.trainingById, id), trainingViews.get(id) || 0, trainingPlays.get(id) || 0]).sort((a, b) => b[1] + b[2] - a[1] - a[2]);
        const agentIds = new Set([...agentViews.keys(), ...agentOpens.keys()]);
        const agentRows = Array.from(agentIds).map((id) => [title(ns.content.agentById, id), agentViews.get(id) || 0, agentOpens.get(id) || 0]).sort((a, b) => b[1] + b[2] - a[1] - a[2]);

        body.replaceChildren(
          el('div', { className: 'kpis' }, [
            ['Usecases bekeken', total(views)],
            ["Demo's gestart", total(plays)],
            ['Prompts gekopieerd', total(copies)],
            ['Tips bekeken', total(tipViews)],
            ['Opnames geopend', total(trainingPlays)],
            ['Agents geopend', total(agentOpens)]
          ].map(([label, value]) => el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(value) }), el('span', { className: 'kpi__label', text: label })]))),
          el('div', { className: 'usage-grid' }, [
            table('Usecases', usecaseRows, ['Usecase', 'Bekeken', 'Demo gestart']),
            table('Meest gekopieerde prompts (top 20)', promptRows, ['Prompt', 'Gekopieerd']),
            table('Tips', tipRows, ['Tip', 'Bekeken', 'Voorbeeld gekopieerd']),
            table('Trainingen', trainingRows, ['Training', 'Bekeken', 'Opname geopend']),
            table('Agents & tools', agentRows, ['Agent', 'Bekeken', 'Geopend'])
          ]),
          el('p', { className: 'field__hint', text: 'Anonieme tellers: er wordt niet bijgehouden wie iets bekijkt of kopieert.' })
        );
      } catch (error) {
        body.replaceChildren(loadFailed(error));
      }
    }

    container.append(el('div', { className: 'filters filters--inline' }, [el('label', { className: 'sr-only', text: 'Periode', attrs: { for: 'adm-days' } }), days]), body);
    load();
  }

  /* ---- Beheerders (alleen hoofdbeheerders) ------------------------------------------------ */
  function placeLabel(namespace) {
    if (namespace === '*') return 'Alle disciplines';
    if (namespace === ns.cockpit.GENERAL_NAMESPACE) return 'Gedeelde basis';
    const found = ns.cockpit.registry().find((d) => ns.cockpit.namespace(d.id) === namespace);
    return found ? found.name : namespace;
  }

  function adminsTab(container) {
    const list = el('div', { className: 'admin-list' });
    const me = (ns.central.signedIn() || '').toLowerCase();

    // Formulier: iemand toevoegen of een rol aanpassen
    const email = el('input', { className: 'field__input', attrs: { id: 'adm-new-email', type: 'email', autocomplete: 'off', placeholder: 'naam@visser-visser.nl' } });
    const role = el('select', { className: 'field__input', attrs: { id: 'adm-new-role' } }, Object.entries(ns.rights.ROLES).map(([value, info]) => el('option', { attrs: { value }, text: `${info.label}: ${info.text}` })));
    role.value = 'redacteur';
    const place = el('select', { className: 'field__input', attrs: { id: 'adm-new-place' } }, [
      el('option', { attrs: { value: '*' }, text: 'Alle disciplines (en de gedeelde basis)' }),
      ...ns.cockpit.registry().map((d) => el('option', { attrs: { value: ns.cockpit.namespace(d.id) }, text: d.name })),
      el('option', { attrs: { value: ns.cockpit.GENERAL_NAMESPACE }, text: 'Gedeelde basis' })
    ]);
    place.value = ns.cockpit.namespace(ns.cockpit.activeId());
    const sectionBoxes = ns.rights.SECTIONS.map((section) => {
      const id = 'adm-sec-' + section.id;
      return el('label', { className: 'check check--compact', attrs: { for: id } }, [el('input', { attrs: { id, type: 'checkbox', value: section.id } }), el('span', { text: section.label })]);
    });
    const sections = el('fieldset', { className: 'field field--wide refs' }, [
      el('legend', { className: 'field__label', text: 'Alleen deze onderdelen (niets aangevinkt = alles)' }),
      el('div', { className: 'refs__list' }, sectionBoxes)
    ]);
    const placeField = el('div', { className: 'field field--half' }, [el('label', { className: 'field__label', text: 'Waar', attrs: { for: 'adm-new-place' } }), place]);
    const syncRole = () => {
      const owner = role.value === 'hoofdbeheerder';
      placeField.hidden = owner;
      sections.hidden = owner;
    };
    role.addEventListener('change', syncRole);
    syncRole();
    const error = el('p', { className: 'field__error', attrs: { role: 'alert' } });
    const submit = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('users'), el('span', { text: 'Rol geven' })]);
    const form = el('form', { className: 'form-card', attrs: { novalidate: true } }, [
      el('h2', { className: 'form-card__title', text: 'Beheerder toevoegen of rol aanpassen' }),
      el('p', { className: 'field__hint', text: 'Iemand heeft ook een account nodig met hetzelfde e-mailadres: maak dat aan in Supabase (Authentication → Users → Add user) en stuur het wachtwoord veilig door. Hieronder zie je of het account er al is.' }),
      el('div', { className: 'form-grid' }, [
        el('div', { className: 'field field--half' }, [el('label', { className: 'field__label', text: 'E-mailadres', attrs: { for: 'adm-new-email' } }), email]),
        el('div', { className: 'field field--half' }, [el('label', { className: 'field__label', text: 'Rol', attrs: { for: 'adm-new-role' } }), role]),
        placeField,
        sections
      ]),
      error,
      el('div', { className: 'cms-form__actions' }, [submit])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      const address = email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
        error.textContent = 'Vul een geldig e-mailadres in.';
        return;
      }
      const chosen = sectionBoxes.map((label) => label.querySelector('input')).filter((box) => box.checked).map((box) => box.value);
      submit.disabled = true;
      try {
        await ns.central.setAdmin(address, role.value === 'hoofdbeheerder' ? '*' : place.value, role.value, role.value === 'hoofdbeheerder' ? [] : chosen);
        toast(`${address} is ${ns.rights.ROLES[role.value].label.toLowerCase()}`, { tone: 'success' });
        email.value = '';
        sectionBoxes.forEach((label) => { label.querySelector('input').checked = false; });
        if (address === me) await ns.central.refreshRights();
        load();
      } catch (err) {
        error.textContent = 'Niet gelukt: ' + err.message;
      } finally {
        submit.disabled = false;
      }
    });

    function personCard(address, roles) {
      const info = roles[0];
      const account = info.has_account
        ? el('span', { className: 'badge badge--free' }, [icon('check'), info.last_sign_in ? 'Laatst ingelogd ' + formatDate(info.last_sign_in) : 'Account actief, nog niet ingelogd'])
        : el('span', { className: 'badge badge--warning', attrs: { title: 'Maak in Supabase een gebruiker aan met dit e-mailadres' } }, [icon('alert'), 'Nog geen account']);
      return el('div', { className: 'admin-person' }, [
        el('div', { className: 'admin-person__head' }, [
          el('p', { className: 'admin-person__email', text: address + (address === me ? ' (jij)' : '') }),
          account
        ]),
        el('ul', { className: 'admin-person__roles', attrs: { role: 'list' } }, roles.map((r) => {
          const sectionsText = (r.sections || []).map((id) => (ns.rights.SECTIONS.find((s) => s.id === id) || { label: id }).label).join(', ');
          const remove = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', disabled: r.role === 'hoofdbeheerder' && address === me } }, [icon('trash'), el('span', { text: 'Intrekken' })]);
          remove.addEventListener('click', async () => {
            if (!(await ns.ui.confirmDialog(`${address} is dan geen ${ns.rights.ROLES[r.role].label.toLowerCase()} meer voor ${placeLabel(r.namespace).toLowerCase()}.`, { title: 'Rol intrekken?', confirmLabel: 'Intrekken', danger: true }))) return;
            try {
              await ns.central.removeAdmin(address, r.namespace, r.role);
              toast('Rol ingetrokken');
              load();
            } catch (err) {
              kit.failed('Aanpassen', err, 7000);
            }
          });
          return el('li', { className: 'admin-person__role' }, [
            el('span', { className: 'badge' + (r.role === 'hoofdbeheerder' ? ' badge--new' : ''), text: ns.rights.ROLES[r.role] ? ns.rights.ROLES[r.role].label : r.role }),
            el('span', { text: placeLabel(r.namespace) + (sectionsText ? ' · alleen ' + sectionsText : '') }),
            remove
          ]);
        }))
      ]);
    }

    async function load() {
      list.replaceChildren(el('p', { className: 'loading', text: 'Beheerders laden…' }));
      try {
        const rows = (await ns.central.listAdmins()) || [];
        const people = new Map();
        rows.forEach((row) => {
          const key = String(row.email).toLowerCase();
          if (!people.has(key)) people.set(key, []);
          people.get(key).push(row);
        });
        const sorted = Array.from(people.entries()).sort((a, b) => ns.rights.ROLES[a[1][0].role].rank - ns.rights.ROLES[b[1][0].role].rank || a[0].localeCompare(b[0]));
        list.replaceChildren(
          el('h2', { className: 'section__title', text: `${people.size} ${people.size === 1 ? 'beheerder' : 'beheerders'}` }),
          ...sorted.map(([address, roles]) => personCard(address, roles))
        );
      } catch (err) {
        list.replaceChildren(notice({ tone: 'warning', title: 'Beheerders zijn niet te lezen', text: err.message + '. Is setup/supabase-audit-bewerken.sql (stap 7) al uitgevoerd?' }));
      }
    }

    const rolesInfo = el('ul', { className: 'admin-roles', attrs: { role: 'list' } }, Object.values(ns.rights.ROLES).map((info) =>
      el('li', {}, [el('strong', { text: info.label }), el('span', { text: ' · ' + info.text })])
    ));
    container.append(rolesInfo, form, list);
    load();
  }

  /* ---- Start ------------------------------------------------------------------ */
  /** De eerste pagina: wat er te doen is (met de stand van nu) en in drie zinnen hoe Beheer werkt. */
  function startTab(container, allowed) {
    const owner = ns.rights.isOwner();
    const name = ns.cockpit.active().name;
    const has = (id) => allowed.some((t) => t.id === id);
    const tasks = [];
    // Een tegel naar een onderdeel; de tweede regel kan later nog veranderen (de stand van nu)
    const task = (id, title, text) => {
      const status = el('span', { className: 'admin-task__status', text });
      tasks.push(el('li', {}, [el('a', { className: 'admin-task', attrs: { href: '#/beheer/' + id } }, [
        el('span', { className: 'admin-task__icon', attrs: { 'aria-hidden': 'true' } }, [icon(TABS.find((t) => t.id === id).icon)]),
        el('span', { className: 'admin-task__body' }, [el('span', { className: 'admin-task__title', text: title }), status]),
        icon('arrow-right', { className: 'admin-task__go' })
      ])]));
      return status;
    };
    const show = (status, text, due) => {
      status.textContent = text;
      status.classList.toggle('is-due', Boolean(due));
    };
    const unreadable = (status) => () => show(status, 'Niet te lezen, probeer het later opnieuw');
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const reminder = ns.adminNewsletter.reminder();

    if (has('inzendingen')) {
      const status = task('inzendingen', 'Inzendingen beantwoorden', 'Even kijken…');
      ns.central.adminListIdeas().then((items) => {
        const fresh = items.filter((item) => item.status === 'nieuw').length;
        const busy = items.filter((item) => item.status === 'in-behandeling').length;
        if (fresh) show(status, `${fresh} nieuw${busy ? `, ${busy} in behandeling` : ''}`, true);
        else show(status, busy ? `${busy} in behandeling` : 'Niets openstaand');
      }).catch(unreadable(status));
    }
    if (has('reviews')) {
      const status = task('reviews', 'Reviews lezen', 'Even kijken…');
      ns.central.adminListReviews().then((items) => {
        const todo = items.filter((item) => item.comment && !item.is_public).length;
        show(status, todo ? `${plural(todo, 'toelichting', 'toelichtingen')} nog niet gepubliceerd` : 'Alle toelichtingen gelezen', todo > 0);
      }).catch(unreadable(status));
    }
    if (has('nieuwsbrief')) task('nieuwsbrief', 'Nieuwsbrief maken', reminder ? 'De maandnieuwsbrief staat klaar' : 'Weekupdate of maandnieuwsbrief, als PDF of e-mail');
    if (has('inhoud')) task('inhoud', `Inhoud ${name} aanpassen`, 'Usecases, prompts, tips, trainingen en agents');
    if (has('basis')) task('basis', 'Gedeelde basis aanpassen', 'Wat in iedere cockpit staat');
    if (has('copilot')) {
      const status = task('copilot', 'Copilot-gebruik bijhouden', 'Even kijken…');
      ns.central.listCopilotUsage().then((rows) => {
        const imports = (rows || []).filter((row) => ns.adminCopilot.isUsage(row.summary));
        show(status, imports.length ? `Laatste import t/m ${formatDate(imports[imports.length - 1].period_end)}` : 'Nog geen import: lees de export in');
      }).catch(unreadable(status));
    }
    if (has('overzicht')) task('overzicht', 'Stand van zaken voor het bestuur', 'Alle disciplines, af te drukken als PDF');
    if (reminder) tasks.forEach((item) => {
      const status = item.querySelector('[href="#/beheer/nieuwsbrief"] .admin-task__status');
      if (status) status.classList.add('is-due');
    });

    const howto = owner
      ? [
        [`Links kies je de discipline (nu ${name}).`, ' Inhoud, inzendingen, reviews, portfolio, gebruik, Copilot-gebruik en de nieuwsbrief gaan over die discipline.'],
        ['Gedeelde basis, Overzicht, Disciplines en Beheerders', ' gelden voor alle disciplines tegelijk.'],
        ['Tekst aanpassen kan ook op de site zelf.', ' Zet Bewerken aan in de donkere balk bovenin, klik op wat je wilt veranderen, sla op en publiceer. Collega\'s zien een wijziging pas na Publiceren.']
      ]
      : [
        ['Je beheert de inhoud waarvoor je een rol hebt.', ' Links staat welke onderdelen dat zijn; met een rol in meer disciplines kies je daar ook de discipline.'],
        ['Tekst aanpassen kan ook op de site zelf.', ' Zet Bewerken aan in de donkere balk bovenin, klik op wat je wilt veranderen en sla op. Collega\'s zien een wijziging pas na Publiceren.']
      ];
    container.append(el('div', { className: 'admin-start' }, [
      tasks.length
        ? el('section', { className: 'admin-start__tasks', attrs: { 'aria-labelledby': 'admin-tasks-title' } }, [
          el('h2', { className: 'admin-start__title', attrs: { id: 'admin-tasks-title' }, text: 'Wat wil je doen?' }),
          el('ul', { className: 'admin-tasks', attrs: { role: 'list' } }, tasks)
        ])
        : notice({ tone: 'warning', icon: 'lock', text: `Je hebt geen rol in ${name}. Kies links een andere discipline, of vraag een hoofdbeheerder om rechten.` }),
      el('section', { className: 'admin-howto', attrs: { 'aria-labelledby': 'admin-howto-title' } }, [
        el('h2', { className: 'admin-start__title', attrs: { id: 'admin-howto-title' }, text: 'Zo werkt Beheer' }),
        el('ol', { className: 'admin-howto__list' }, howto.map(([lead, rest]) => el('li', {}, [el('strong', { text: lead }), rest])))
      ])
    ]));
  }

  /* ---- Pagina ------------------------------------------------------------------------ */
  /**
   * Welke onderdelen zie je? Iedereen Start; Inhoud en Gedeelde basis met een rol voor die omgeving;
   * de rest alleen als hoofdbeheerder.
   */
  function visibleTabs() {
    if (ns.rights.isOwner()) return TABS;
    return TABS.filter((t) => t.id === 'start'
      || (t.id === 'inhoud' && ns.rights.canEditSomething(ns.cockpit.namespace(ns.cockpit.activeId())))
      || (t.id === 'basis' && ns.rights.canEditSomething(ns.cockpit.GENERAL_NAMESPACE)));
  }

  /** params: [onderdeel, ...] uit het adres, bijv. ['inhoud', 'tip', 'facilitator']. */
  function render(params) {
    if (!ns.central.isEnabled() || !ns.central.signedIn()) {
      const content = el('div', { className: 'admin admin--login' });
      const node = el('div', { className: 'page container' }, [
        pageHeader({ eyebrow: 'AI Cockpit', title: 'Beheer', lead: 'Voor het AI-team: inhoud aanpassen, inzendingen beantwoorden en zien wat er gebruikt wordt.' }),
        content
      ]);
      if (!ns.central.isEnabled()) content.append(notice({ title: 'Geen centrale opslag ingesteld', text: 'Vul centralUrl en centralKey in in js/config.js en voer setup/supabase-audit.sql uit.' }));
      // Na inloggen: inhoud opnieuw ophalen (met concepten) en deze pagina opnieuw tonen
      else content.append(loginForm(() => ns.app.reloadContent()));
      return { node, title: 'Beheer' };
    }

    const allowedTabs = visibleTabs();
    const tab = allowedTabs.some((t) => t.id === params[0]) ? params[0] : 'start';
    const def = TABS.find((t) => t.id === tab);
    const disciplineName = ns.cockpit.active().name;
    let canLeave = null;

    const panel = el('div', { className: 'admin__panel' });
    panel.addEventListener('signedout', () => ns.app.reloadContent());
    // Onderaan de zijbalk: wie er is ingelogd, en Uitloggen
    const session = el('div', { className: 'admin-nav__session' }, [
      el('p', { className: 'admin-nav__user' }, [icon('lock'), el('span', { text: ns.central.signedIn() })]),
      el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: async () => {
        if (canLeave && !canLeave() && !(await ns.ui.confirmDialog('Je hebt wijzigingen die nog niet zijn opgeslagen.', { title: 'Toch uitloggen?', confirmLabel: 'Uitloggen zonder opslaan', cancelLabel: 'Blijven', danger: true }))) return;
        // Eerst je werk wegzetten (onder je eigen naam) en je afmelden bij wat je open had
        ns.editor.reset();
        ns.central.signOut();
        canLeave = null;
        window.location.hash = '#/beheer';
        ns.app.reloadContent();
      } } }, [icon('logout'), el('span', { text: 'Uitloggen' })])
    ]);
    // Bovenaan het onderdeel: voor welke discipline (of alle), de titel en één zin uitleg
    const scope = def.perDiscipline
      ? [icon('layers'), el('span', { text: disciplineName })]
      : [icon(tab === 'start' ? 'lock' : 'globe'), el('span', { text: tab === 'start' ? 'Beheer' : 'Alle disciplines' })];
    const head = el('header', { className: 'admin-head' }, [
      el('p', { className: 'admin-head__scope' }, scope),
      el('h1', { className: 'admin-head__title', attrs: { tabindex: '-1' }, text: tab === 'inhoud' ? `Inhoud ${disciplineName}` : def.label }),
      el('p', { className: 'admin-head__lead', text: def.lead(disciplineName) })
    ]);
    const node = el('div', { className: 'page container admin-shell' }, [
      sidebar(tab, allowedTabs, session),
      el('div', { className: 'admin-main' }, [head, panel])
    ]);

    if (tab === 'start') startTab(panel, allowedTabs);
    else if (tab === 'gebruik') usageTab(panel);
    else if (tab === 'overzicht') panel.append(ns.adminOverview.render().node);
    else if (tab === 'portfolio') panel.append(ns.adminPortfolio.render().node);
    else if (tab === 'copilot') panel.append(ns.adminCopilot.render().node);
    else if (tab === 'beheerders') adminsTab(panel);
    else if (tab === 'inzendingen') ideasTab(panel);
    else if (tab === 'reviews') reviewsTab(panel);
    else if (tab === 'nieuwsbrief') panel.append(ns.adminNewsletter.render().node);
    else if (tab === 'disciplines') {
      const result = ns.adminDisciplines.render();
      panel.append(result.node);
      canLeave = result.canLeave;
    } else {
      const result = ns.adminContent.render(params.slice(1), { status: ns.content.adminStatus }, scopeFor(tab));
      panel.append(result.node);
      canLeave = result.canLeave;
    }
    // shell: tussen onderdelen van Beheer geen paginaovergang (zie route in js/app.js)
    return { node, title: 'Beheer', shell: 'admin', canLeave: () => !canLeave || canLeave() };
  }

  ns.views = ns.views || {};
  ns.views.admin = { render };
})(window.AIAudit);
