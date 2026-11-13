/* ==========================================================================
   Beheer → Open Cockpit (#/beheer/opencockpit)
   --------------------------------------------------------------------------
   Het inloopuur over Copilot (js/opencockpit.js), per discipline:
   1. Uitnodiging: de vaste link en een tekst voor de agenda-uitnodiging aan
      de hele discipline.
   2. Sessies: datum, tijd, vestiging, Teams-link, en na afloop het nieuws,
      een samenvatting en de opname. Opgeslagen als instelling 'opencockpit'
      in audit_content (geen SQL nodig).
   3. Agendapunten: wat collega's aandroegen (soort 'agendapunt', stap 19),
      per sessie. Op de agenda zetten (= publiceren, zonder naam), naar een
      andere sessie verplaatsen, en na de sessie de reactie erbij.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, copyText, formatDate } = ns.ui;
  const kit = ns.adminKit;
  const confirm = (message, options) => ns.ui.confirmDialog(message, options);
  const OC = () => ns.openCockpit;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  // In Beheer de statussen die bij een agenda horen (de rest van de statussen gebruikt een agendapunt niet)
  const STATUS_CHOICES = [
    { value: 'nieuw', label: 'Aangedragen' },
    { value: 'gepland', label: 'Op de agenda' },
    { value: 'beantwoord', label: 'Behandeld' },
    { value: 'afgewezen', label: 'Niet behandeld' }
  ];
  let uid = 0;

  function field(label, input, hint, wide) {
    const id = 'oc-f' + (++uid);
    input.id = id;
    return el('div', { className: 'field' + (wide || input.tagName === 'TEXTAREA' ? ' field--wide' : ' field--half') }, [
      el('label', { className: 'field__label', attrs: { for: id }, text: label }),
      input,
      hint ? el('p', { className: 'field__hint', text: hint }) : null
    ]);
  }
  const input = (value, attrs) => {
    const node = el('input', { className: 'field__input', attrs: Object.assign({ type: 'text' }, attrs) });
    node.value = value == null ? '' : String(value);
    return node;
  };
  const area = (value, rows, attrs) => {
    const node = el('textarea', { className: 'field__input field__textarea', attrs: Object.assign({ rows: String(rows || 3) }, attrs) });
    node.value = value == null ? '' : String(value);
    return node;
  };
  const addDays = (date, days) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  /* ---- 1. Uitnodiging ---------------------------------------------------------------- */
  function inviteText(url) {
    return [
      'Open Cockpit: het inloopuur over Copilot',
      '',
      'Iedere paar weken een uur om samen bij te praten over Copilot: het nieuws van de afgelopen weken, jullie vragen en ervaringen, en ruimte om te brainstormen. Op een vestiging en altijd online via Teams, dus iedereen kan aanhaken. Vrijwillig: loop binnen wanneer het je uitkomt.',
      '',
      'Heb je een onderwerp? Draag het vooraf aan in de AI-cockpit:',
      url,
      '',
      'Daar zie je ook wat collega\'s hebben aangedragen, en na afloop de reactie op ieder punt.'
    ].join('\n');
  }

  function inviteCard() {
    const url = OC().pageUrl();
    const copy = (value, label) => async () => {
      const ok = await copyText(value);
      toast(ok ? label + ' staat op het klembord' : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
    };
    return el('section', { className: 'side-card oc-admin__invite', attrs: { 'aria-labelledby': 'oc-invite-title' } }, [
      el('h2', { className: 'side-card__title', attrs: { id: 'oc-invite-title' } }, [icon('mail'), el('span', { text: '1. De uitnodiging' })]),
      el('p', { className: 'side-card__text', text: 'Stuur een terugkerende afspraak naar de hele discipline, met de Teams-vergadering erin en deze link. De link toont altijd de eerstvolgende sessie: bij een nieuwe datum of vestiging hoef je de uitnodiging niet aan te passen.' }),
      el('p', { className: 'oc-admin__link' }, [el('code', { text: url })]),
      el('div', { className: 'oc-admin__actions' }, [
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: copy(url, 'De link') } }, [icon('copy'), el('span', { text: 'Kopieer de link' })]),
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: copy(inviteText(url), 'De tekst') } }, [icon('copy'), el('span', { text: 'Kopieer tekst voor de uitnodiging' })]),
        el('a', { className: 'btn btn--quiet btn--sm', attrs: { href: OC().ROUTE } }, [icon('eye'), el('span', { text: 'Bekijk de pagina' })])
      ])
    ]);
  }

  /* ---- 2. Sessies ------------------------------------------------------------------------ */
  function sessionsCard(namespace, row, onSaved) {
    const start = row && row.data && typeof row.data === 'object' ? row.data : {};
    const teams = input(start.teams, { type: 'url', placeholder: 'https://teams.microsoft.com/l/meetup-join/…', maxlength: '600' });
    const intro = area(start.intro, 3, { maxlength: '600', placeholder: 'Leeg = de standaardtekst bovenaan de pagina.' });
    const list = el('div', { className: 'oc-admin__sessions' });
    const formError = kit.formError();
    const rows = [];
    let busy = false;
    const locations = () => Array.from(new Set(rows.map((r) => r.location.value.trim()).filter(Boolean)));
    const datalist = el('datalist', { attrs: { id: 'oc-locations' } });

    function sessionRow(data, open) {
      const s = data || {};
      const r = {
        date: input(s.date, { type: 'date', required: true }),
        start: input(s.start || '12:00', { type: 'time' }),
        end: input(s.end || '', { type: 'time' }),
        location: input(s.location, { maxlength: '60', placeholder: 'Bijv. Leeuwarden. Leeg = alleen online', list: 'oc-locations' }),
        teams: input(s.teams, { type: 'url', maxlength: '600', placeholder: 'Leeg = de link van de reeks' }),
        news: area(Array.isArray(s.news) ? s.news.join('\n') : s.news, 4, { maxlength: '3000', placeholder: 'Eén onderwerp per regel, bijv. Copilot Notebooks nu beschikbaar' }),
        summary: area(s.summary, 3, { maxlength: '3000' }),
        recording: input(s.recording, { type: 'url', maxlength: '600', placeholder: 'https://…' }),
        cancelled: el('input', { attrs: { type: 'checkbox', checked: Boolean(s.cancelled) } })
      };
      const title = el('span', { className: 'oc-admin__session-title' });
      const label = () => {
        const date = r.date.value;
        title.textContent = DATE.test(date)
          ? OC().longDate(date).replace(/^./, (c) => c.toUpperCase()) + (r.location.value.trim() ? ' · ' + r.location.value.trim() : ' · online') + (r.cancelled.checked ? ' (afgelast)' : '')
          : 'Nieuwe sessie: kies een datum';
      };
      [r.date, r.location, r.cancelled].forEach((node) => node.addEventListener('input', label));
      r.cancelled.addEventListener('change', label);
      label();
      const remove = el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Sessie verwijderen' })]);
      const cancelledId = 'oc-f' + (++uid);
      r.cancelled.id = cancelledId;
      r.node = el('details', { className: 'oc-admin__session', attrs: { open: open || null } }, [
        el('summary', { className: 'oc-admin__session-head' }, [icon('calendar'), title, icon('chevron-down', { className: 'oc-admin__chevron' })]),
        el('div', { className: 'form-grid' }, [
          field('Datum', r.date),
          field('Vestiging', r.location, 'Waar je fysiek bent. Online via Teams kan altijd.'),
          field('Begin', r.start),
          field('Einde', r.end, 'Leeg = een uur na het begin.'),
          field('Eigen Teams-link (optioneel)', r.teams, 'Alleen als deze sessie een andere vergadering heeft dan de reeks.', true),
          el('div', { className: 'field form-section' }, [el('h3', { className: 'form-section__title', text: 'Na de sessie' })]),
          field('Nieuws over Copilot', r.news, 'Wat je als update hebt verteld. Staat bij Eerdere sessies.'),
          field('Samenvatting', r.summary, 'Optioneel: wat er verder besproken is. De reactie per agendapunt schrijf je hieronder bij Agendapunten.'),
          field('Opname', r.recording, 'Link naar de opname (Stream of SharePoint), als die er is.', true),
          el('label', { className: 'check field--wide', attrs: { for: cancelledId } }, [r.cancelled, el('span', { text: 'Afgelast (agendapunten schuiven door naar de volgende sessie)' })]),
          el('div', { className: 'field field--wide' }, [remove])
        ])
      ]);
      remove.addEventListener('click', async () => {
        if (!(await confirm('De sessie verdwijnt na opslaan van de pagina. Agendapunten die erbij hoorden, schuiven door naar de eerstvolgende sessie.', { title: 'Sessie verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
        rows.splice(rows.indexOf(r), 1);
        r.node.remove();
      });
      r.data = () => {
        const out = { date: r.date.value, start: r.start.value, end: r.end.value, location: r.location.value.trim() };
        if (r.teams.value.trim()) out.teams = r.teams.value.trim();
        const news = r.news.value.split('\n').map((line) => line.trim()).filter(Boolean);
        if (news.length) out.news = news;
        if (r.summary.value.trim()) out.summary = r.summary.value.trim();
        if (r.recording.value.trim()) out.recording = r.recording.value.trim();
        if (r.cancelled.checked) out.cancelled = true;
        return out;
      };
      return r;
    }

    function add(data, open, atStart) {
      const r = sessionRow(data, open);
      rows.push(r);
      if (atStart) list.prepend(r.node);
      else list.append(r.node);
      datalist.replaceChildren(...locations().map((value) => el('option', { attrs: { value } })));
      return r;
    }

    // De komende sessies bovenaan (de eerste open), daarna wat geweest is
    const today = ns.content.today();
    const saved = (Array.isArray(start.sessions) ? start.sessions : []).filter((s) => s && DATE.test(s.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const coming = saved.filter((s) => s.date >= today);
    const done = saved.filter((s) => s.date < today).reverse();
    coming.forEach((s, index) => add(s, index === 0));
    done.forEach((s) => add(s, false));

    const collect = () => ({
      teams: teams.value.trim(),
      intro: intro.value.trim(),
      sessions: rows.map((r) => r.data()).sort((a, b) => (a.date < b.date ? -1 : 1))
    });
    const snapshot = () => JSON.stringify(collect());
    let initial = snapshot();

    const addButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: 'Sessie toevoegen' })]);
    addButton.addEventListener('click', () => {
      // Vier weken na de laatste sessie (of over twee weken), op dezelfde tijd
      const all = rows.map((r) => r.data()).filter((s) => DATE.test(s.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
      const last = all[all.length - 1];
      const date = last && last.date >= today ? addDays(last.date, 28) : addDays(today, 14);
      const r = add({ date, start: last ? last.start : '12:00', end: last ? last.end : '' }, true, true);
      r.location.focus();
    });

    const save = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('send'), el('span', { text: 'Opslaan en publiceren' })]);
    save.addEventListener('click', async () => {
      formError.hide();
      const data = collect();
      const dates = data.sessions.map((s) => s.date);
      if (dates.some((date) => !DATE.test(date))) return formError.show('Iedere sessie heeft een datum nodig.');
      if (new Set(dates).size !== dates.length) return formError.show('Twee sessies staan op dezelfde dag. Eén sessie per dag.');
      if (data.sessions.some((s) => (s.start && !TIME.test(s.start)) || (s.end && (!TIME.test(s.end) || s.end <= s.start)))) return formError.show('Controleer de tijden: het einde ligt na het begin.');
      const badUrl = [data.teams].concat(data.sessions.flatMap((s) => [s.teams, s.recording])).find((value) => value && !/^https:\/\/\S+$/.test(value));
      if (badUrl) return formError.show('Een link begint met https:// (' + badUrl.slice(0, 60) + ').');
      const restore = kit.busy(save, 'Opslaan…');
      busy = true;
      try {
        await ns.central.saveContent([{ type: 'setting', id: ns.content.OPEN_COCKPIT_ID, data, position: 0, status: 'published' }], namespace);
        initial = snapshot();
        await ns.app.reloadContent();
        toast('Opgeslagen: de sessies staan op de pagina', { tone: 'success' });
        onSaved();
      } catch (error) {
        formError.show('Opslaan mislukt: ' + error.message);
      } finally {
        busy = false;
        restore();
      }
    });

    const node = el('section', { className: 'side-card oc-admin__card', attrs: { 'aria-labelledby': 'oc-sessions-title' } }, [
      el('h2', { className: 'side-card__title', attrs: { id: 'oc-sessions-title' } }, [icon('calendar'), el('span', { text: '2. Sessies' })]),
      el('p', { className: 'side-card__text', text: 'Plan de sessies vooruit: datum, tijd en vestiging. Na afloop zet je bij de sessie het nieuws dat je hebt verteld en eventueel de opname. Alles is direct zichtbaar voor collega\'s; zet geen namen van klanten in de teksten.' }),
      el('div', { className: 'form-grid' }, [
        field('Teams-link van de reeks', teams, 'De vergadering uit je terugkerende uitnodiging (in Outlook: rechtsklik op "Deelnemen aan de vergadering" → link kopiëren). Staat bij iedere sessie.', true),
        field('Tekst bovenaan de pagina (optioneel)', intro)
      ]),
      datalist,
      el('div', { className: 'oc-admin__bar' }, [el('h3', { className: 'form-section__title', text: 'Sessies' }), addButton]),
      list,
      rows.length ? null : el('p', { className: 'field__hint', text: 'Nog geen sessies. Voeg de eerste toe.' }),
      formError.node,
      el('div', { className: 'cms-form__actions' }, [save])
    ]);
    return { node, canLeave: () => busy || snapshot() === initial };
  }

  /* ---- 3. Agendapunten ----------------------------------------------------------------- */
  function agendaItem(item, cfg, onChanged) {
    const status = el('select', { className: 'field__input field__input--sm' }, STATUS_CHOICES.map((choice) =>
      el('option', { attrs: { value: choice.value, selected: choice.value === item.status || (choice.value === 'gepland' && item.status === 'in-behandeling') || (choice.value === 'beantwoord' && item.status === 'gerealiseerd') }, text: choice.label })));
    const sessionChoices = cfg.sessions.map((s) => ({ value: s.id, label: formatDate(s.date) + (s.location ? ' · ' + s.location : '') + (s.cancelled ? ' (afgelast)' : '') }))
      .concat({ value: OC().NEXT, label: 'Eerstvolgende (nog niet gepland)' });
    const current = OC().sessionOf(item, cfg);
    const session = el('select', { className: 'field__input field__input--sm' }, sessionChoices.map((choice) => el('option', { attrs: { value: choice.value, selected: choice.value === current }, text: choice.label })));
    const answer = area(item.answer, 3, { maxlength: '4000', placeholder: 'Wat er in de sessie over gezegd is. Zichtbaar bij Eerdere sessies als het punt op de pagina staat.' });
    const publish = el('input', { attrs: { type: 'checkbox', checked: item.is_public, disabled: !item.allow_public } });
    const publishId = 'oc-f' + (++uid);
    publish.id = publishId;
    // Op de agenda zetten = publiceren, als de collega dat goedvond
    status.addEventListener('change', () => {
      if (item.allow_public && ['gepland', 'beantwoord'].includes(status.value)) publish.checked = true;
      if (status.value === 'afgewezen') publish.checked = false;
    });

    async function store(patch, button) {
      const restore = kit.busy(button);
      try {
        const updated = await ns.central.adminUpdateIdea(item.id, patch);
        Object.assign(item, updated);
        toast('Opgeslagen', { tone: 'success' });
        onChanged();
      } catch (error) {
        kit.failed('Opslaan', error);
      } finally {
        restore();
      }
    }
    const save = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
    save.addEventListener('click', () => store({ status: status.value, session: session.value, answer: answer.value.trim() || null, is_public: publish.checked && item.allow_public }, save));
    // Eén klik: op de agenda van de sessie die erbij staat
    const approve = item.status === 'nieuw' ? el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('calendar'), el('span', { text: 'Op de agenda zetten' })]) : null;
    if (approve) approve.addEventListener('click', () => store({ status: 'gepland', session: session.value, is_public: Boolean(item.allow_public) }, approve));
    const remove = el('button', { className: 'btn btn--danger btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Verwijderen' })]);
    remove.addEventListener('click', async () => {
      if (!(await confirm(`Agendapunt "${item.title}" wordt definitief verwijderd. Dit kan niet ongedaan worden gemaakt.`, { title: 'Agendapunt verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
      try {
        await ns.central.adminDeleteIdea(item.id);
        item.deleted = true;
        toast('Verwijderd');
        onChanged();
      } catch (error) {
        kit.failed('Verwijderen', error);
      }
    });

    const email = item.email && /^[^\s@?&#%]+@[^\s@?&#%]+$/.test(item.email) ? el('a', { attrs: { href: 'mailto:' + item.email }, text: item.email }) : item.email || '–';
    return el('details', { className: 'admin-item' }, [
      el('summary', { className: 'admin-item__summary' }, [
        el('span', { className: 'admin-item__date', text: formatDate(item.created_at) }),
        el('span', { className: 'admin-item__title', text: item.title }),
        ns.ideas.statusBadge(item.status, OC().STATUSES),
        item.is_public ? el('span', { className: 'badge badge--free', attrs: { title: 'Zichtbaar op de pagina' } }, [icon('eye'), 'Op de pagina']) : null,
        item.votes ? el('span', { className: 'badge', attrs: { title: 'Stemmen' } }, [icon('thumb'), String(item.votes)]) : null,
        icon('chevron-down', { className: 'admin-item__chevron' })
      ]),
      el('div', { className: 'admin-item__body' }, [
        el('dl', { className: 'admin-item__meta' }, [
          el('div', {}, [el('dt', { text: 'Naam' }), el('dd', { text: item.name || '–' })]),
          el('div', {}, [el('dt', { text: 'E-mail' }), el('dd', {}, [email])]),
          el('div', {}, [el('dt', { text: 'Op de pagina' }), el('dd', { text: item.allow_public ? 'Mag (zonder naam)' : 'Liever niet' })])
        ]),
        item.body && item.body !== item.title ? el('p', { className: 'admin-item__text', text: item.body }) : null,
        el('div', { className: 'admin-item__form' }, [
          field('Status', status),
          field('Sessie', session),
          field('Reactie (na de sessie)', answer),
          el('label', { className: 'check', attrs: { for: publishId } }, [publish, el('span', { text: item.allow_public ? 'Op de pagina (zonder naam en e-mail)' : 'Niet op de pagina: de collega wil dit liever niet' })]),
          el('div', { className: 'admin-item__actions' }, [approve, save, remove])
        ])
      ])
    ]);
  }

  function agendaCard() {
    const summary = el('div', { className: 'kpis' });
    const list = el('div', { className: 'oc-admin__agenda' });
    let items = [];

    function update() {
      items = items.filter((item) => !item.deleted);
      const cfg = OC().settings();
      const count = (statuses) => items.filter((item) => statuses.includes(item.status)).length;
      summary.replaceChildren(...[
        ['Aangedragen', count(['nieuw'])],
        ['Op de agenda', count(['gepland', 'in-behandeling'])],
        ['Behandeld', count(['beantwoord', 'gerealiseerd'])],
        ['Niet behandeld', count(['afgewezen'])]
      ].map(([label, value]) => el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(value) }), el('span', { className: 'kpi__label', text: label })])));
      const groups = OC().bySession(items, cfg);
      const today = ns.content.today();
      // Komende sessies eerst, dan 'nog niet gepland', dan wat geweest is (de laatste eerst)
      const order = OC().upcoming(cfg, today).map((s) => s.id).concat(OC().NEXT, OC().past(cfg, today).map((s) => s.id));
      const sections = order.filter((id) => groups.has(id)).map((id) => {
        const s = cfg.sessions.find((x) => x.id === id);
        const heading = s ? OC().longDate(s.date).replace(/^./, (c) => c.toUpperCase()) + (s.location ? ' · ' + s.location : ' · online') : 'Eerstvolgende sessie (nog niet gepland)';
        const open = groups.get(id).filter((item) => item.status === 'nieuw').length;
        return el('section', { className: 'oc-admin__group' }, [
          el('h3', { className: 'oc-admin__group-title' }, [el('span', { text: heading }), open ? el('span', { className: 'status status--info', text: open + ' nieuw' }) : null]),
          el('div', { className: 'admin-list' }, groups.get(id).map((item) => agendaItem(item, cfg, update)))
        ]);
      });
      list.replaceChildren(...(sections.length ? sections : [el('p', { className: 'section__lead', text: 'Nog geen agendapunten aangedragen.' })]));
    }

    async function load() {
      list.replaceChildren(el('p', { className: 'loading', text: 'Agendapunten laden…' }));
      try {
        items = (await ns.central.adminListIdeas()).filter((item) => item.kind === OC().KIND);
        update();
      } catch (error) {
        list.replaceChildren(ns.blocks.notice({ tone: 'warning', title: 'Laden mislukt', text: error.message }));
      }
    }
    load();

    return {
      update,
      node: el('section', { className: 'side-card oc-admin__card', attrs: { 'aria-labelledby': 'oc-agenda-admin-title' } }, [
        el('div', { className: 'oc-admin__bar' }, [
          el('h2', { className: 'side-card__title', attrs: { id: 'oc-agenda-admin-title' } }, [icon('checklist'), el('span', { text: '3. Agendapunten' })]),
          el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Vernieuwen' })])
        ]),
        el('p', { className: 'side-card__text', text: 'Wat collega\'s aandroegen, per sessie. "Op de agenda zetten" zet het punt op de pagina (zonder naam), zodat anderen kunnen stemmen. Na de sessie schrijf je de reactie erbij en zet je het op Behandeld. Zonder stap 19 (setup/supabase-audit-opencockpit.sql) kunnen collega\'s nog niets aandragen.' }),
        summary,
        list
      ])
    };
  }

  function render() {
    const namespace = ns.cockpit.namespace(ns.cockpit.activeId());
    const row = (ns.content.adminRows || []).find((r) => r.namespace === namespace && r.type === 'setting' && r.id === ns.content.OPEN_COCKPIT_ID && r.status !== 'trash') || null;
    const agenda = agendaCard();
    // Na opslaan van de sessies: de agendapunten opnieuw indelen (een sessie kan verplaatst of verwijderd zijn)
    const sessions = sessionsCard(namespace, row, () => agenda.update());
    const node = el('div', { className: 'oc-admin' }, [inviteCard(), sessions.node, agenda.node]);
    return { node, canLeave: sessions.canLeave };
  }

  ns.adminOpenCockpit = { render, inviteText };
})(window.AIAudit);
