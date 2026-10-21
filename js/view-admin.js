/* ==========================================================================
   Beheer (#/beheer/inhoud, /basis, /disciplines, /inzendingen, /gebruik)
   --------------------------------------------------------------------------
   Voor het AI-team: inloggen met een Supabase-gebruiker van wie het
   e-mailadres in audit_admins staat (zie setup/supabase-audit.sql).
   Bovenaan wissel je van discipline: Inhoud, Inzendingen en Gebruik gaan
   over de discipline waarin je zit.
   - Inhoud: usecases, prompts, tips, trainingen, agents & tools, fasen en
     teksten van deze discipline (js/admin-content.js).
   - Gedeelde basis: wat in iedere cockpit staat (zelfde formulieren).
   - Disciplines: welke er zijn en welke open of op slot (js/admin-disciplines.js).
   - Inzendingen: lezen (met naam en e-mail), status zetten, beantwoorden,
     publiceren in de hub, verwijderen en exporteren (CSV).
   - Gebruik: anonieme tellers per usecase, demo, prompt, tip, training en agent.
   De sessie blijft bewaard zolang dit tabblad open is.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate, pageHeader } = ns.ui;
  const view = { status: 'open', kind: 'all', days: 90 };
  const TABS = [
    { id: 'inhoud', label: 'Inhoud', icon: 'pencil-line', perDiscipline: true },
    { id: 'basis', label: 'Gedeelde basis', icon: 'globe' },
    { id: 'disciplines', label: 'Disciplines', icon: 'layers' },
    { id: 'inzendingen', label: 'Inzendingen', icon: 'message-plus', perDiscipline: true },
    { id: 'gebruik', label: 'Gebruik', icon: 'chart', perDiscipline: true }
  ];

  /** Wisselen van discipline in Beheer: naar hetzelfde onderdeel in de cockpit van die discipline. */
  function disciplineChooser(tab) {
    const target = TABS.find((t) => t.id === tab && t.perDiscipline) ? tab : 'inhoud';
    const activeId = ns.cockpit.activeId();
    return el('div', { className: 'admin__scope' }, [
      el('span', { className: 'admin__scope-label', text: 'Discipline' }),
      el('nav', { className: 'toggles', attrs: { 'aria-label': 'Discipline om te beheren' } }, ns.cockpit.registry().map((discipline) =>
        el('a', {
          className: 'toggle',
          attrs: {
            href: ns.cockpit.href(discipline.id, '#/beheer/' + target),
            'aria-current': discipline.id === activeId ? 'page' : null,
            title: discipline.status === 'open' ? 'Open voor iedereen' : 'Op slot: alleen beheerders'
          }
        }, [discipline.status === 'open' ? null : icon('lock'), el('span', { text: discipline.name })])
      ))
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
        error.textContent = 'Je bent ingelogd, maar dit account is geen beheerder. Laat je e-mailadres toevoegen aan audit_admins in Supabase.';
      } else error.textContent = 'Inloggen mislukt. Controleer je gegevens of je verbinding.';
    });
    return form;
  }

  /* ---- Inzendingen ---------------------------------------------------------------- */
  function csvCell(value) {
    let text = value == null ? '' : String(value);
    // Geen formules laten uitvoeren als het bestand in Excel wordt geopend
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function exportCsv(items) {
    const columns = ['id', 'created_at', 'kind', 'status', 'is_public', 'allow_public', 'votes', 'phase', 'title', 'body', 'name', 'email', 'answer', 'answered_at'];
    const lines = [columns.join(';')].concat(items.map((item) => columns.map((column) => csvCell(item[column])).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { attrs: { href: url, download: 'ideeenhub-' + new Date().toISOString().slice(0, 10) + '.csv' } });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
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
        toast('Opslaan mislukt: ' + error.message, { tone: 'warning', duration: 6000 });
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
        toast('Verwijderen mislukt: ' + error.message, { tone: 'warning', duration: 6000 });
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
        item.is_public ? el('span', { className: 'badge badge--free', attrs: { title: 'Zichtbaar in de hub' } }, [icon('eye'), 'Gepubliceerd']) : null,
        item.votes ? el('span', { className: 'badge', attrs: { title: 'Stemmen' } }, [icon('thumb'), String(item.votes)]) : null,
        icon('chevron-down', { className: 'admin-item__chevron' })
      ]),
      el('div', { className: 'admin-item__body' }, [
        el('dl', { className: 'admin-item__meta' }, [
          el('div', {}, [el('dt', { text: 'Fase' }), el('dd', { text: phase ? phase.label : '–' })]),
          el('div', {}, [el('dt', { text: 'Naam' }), el('dd', { text: item.name || '–' })]),
          el('div', {}, [el('dt', { text: 'E-mail' }), el('dd', {}, [item.email ? el('a', { attrs: { href: 'mailto:' + item.email }, text: item.email }) : '–'])]),
          el('div', {}, [el('dt', { text: 'Publiceren' }), el('dd', { text: item.allow_public ? 'Mag (zonder naam)' : 'Liever niet' })])
        ]),
        el('p', { className: 'admin-item__text', text: item.body }),
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
        list.replaceChildren(el('div', { className: 'notice notice--warning' }, [icon('alert'), el('div', {}, [el('p', { className: 'notice__title', text: 'Laden mislukt' }), el('p', { text: error.message })])]));
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
        body.replaceChildren(el('div', { className: 'notice notice--warning' }, [icon('alert'), el('div', {}, [el('p', { className: 'notice__title', text: 'Laden mislukt' }), el('p', { text: error.message })])]));
      }
    }

    container.append(el('div', { className: 'filters filters--inline' }, [el('label', { className: 'sr-only', text: 'Periode', attrs: { for: 'adm-days' } }), days]), body);
    load();
  }

  /* ---- Pagina ------------------------------------------------------------------------ */
  /** params: [onderdeel, ...] uit het adres, bijv. ['inhoud', 'tip', 'facilitator']. */
  function render(params) {
    const tab = TABS.some((t) => t.id === params[0]) ? params[0] : 'inhoud';
    const content = el('div', { className: 'admin' });
    const node = el('div', { className: 'page container' }, [
      pageHeader({ eyebrow: 'Beheer', title: 'Beheer van het platform', lead: 'Voor het AI-team: de inhoud per discipline en de gedeelde basis aanpassen, disciplines openzetten of op slot houden, inzendingen uit de ideeënhub beantwoorden en zien wat er gebruikt wordt.' }),
      content
    ]);
    let canLeave = null;

    if (!ns.central.isEnabled()) {
      content.append(el('div', { className: 'notice' }, [icon('info'), el('div', {}, [
        el('p', { className: 'notice__title', text: 'Geen centrale opslag ingesteld' }),
        el('p', { text: 'Vul centralUrl en centralKey in in js/config.js en voer setup/supabase-audit.sql uit.' })
      ])]));
      return { node, title: 'Beheer' };
    }
    if (!ns.central.signedIn()) {
      // Na inloggen: inhoud opnieuw ophalen (met concepten) en deze pagina opnieuw tonen
      content.append(loginForm(() => ns.app.reloadContent()));
      return { node, title: 'Beheer' };
    }

    const panel = el('div', { className: 'admin__panel' });
    panel.addEventListener('signedout', () => ns.app.reloadContent());
    const disciplineName = ns.cockpit.active().name;
    const tabs = el('nav', { className: 'toggles', attrs: { 'aria-label': 'Onderdeel van beheer' } }, TABS.map((t) =>
      el('a', { className: 'toggle', attrs: { href: '#/beheer/' + t.id, 'aria-current': t.id === tab ? 'page' : null } }, [
        icon(t.icon),
        el('span', { text: t.id === 'inhoud' ? 'Inhoud ' + disciplineName : t.label })
      ])
    ));
    content.append(
      ...(TABS.find((t) => t.id === tab).perDiscipline ? [disciplineChooser(tab)] : []),
      el('div', { className: 'admin__bar' }, [
        tabs,
        el('p', { className: 'admin__user' }, [icon('lock'), el('span', { text: 'Ingelogd als ' + ns.central.signedIn() })]),
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: async () => {
          if (canLeave && !canLeave() && !(await ns.ui.confirmDialog('Je hebt wijzigingen die nog niet zijn opgeslagen.', { title: 'Toch uitloggen?', confirmLabel: 'Uitloggen zonder opslaan', cancelLabel: 'Blijven', danger: true }))) return;
          ns.central.signOut();
          canLeave = null;
          window.location.hash = '#/beheer';
          ns.app.reloadContent();
        } } }, [icon('logout'), el('span', { text: 'Uitloggen' })])
      ]),
      panel
    );
    if (tab === 'gebruik') usageTab(panel);
    else if (tab === 'inzendingen') ideasTab(panel);
    else if (tab === 'disciplines') {
      const result = ns.adminDisciplines.render();
      panel.append(result.node);
      canLeave = result.canLeave;
    } else {
      const result = ns.adminContent.render(params.slice(1), { status: ns.content.adminStatus }, scopeFor(tab));
      panel.append(result.node);
      canLeave = result.canLeave;
    }
    return { node, title: 'Beheer', canLeave: () => !canLeave || canLeave() };
  }

  ns.views = ns.views || {};
  ns.views.admin = { render };
})(window.AIAudit);
