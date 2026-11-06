/* ==========================================================================
   Beheer → AI-brevetten (alleen hoofdbeheerders)
   --------------------------------------------------------------------------
   Drie delen:
   - Deelnemers: wie meedoet, met brevet, miles en wanneer actief; per persoon
     het logboek (gebruik en bijdragen), miles toekennen, een sessie vastleggen,
     voordragen als Commander, een prompt op iemands naam zetten (royalty's)
     en een feit weghalen;
   - Trainingen: per training wie is aangemeld en wie er was. Alleen mensen met
     een account (wie meedoet) kun je toevoegen; aanwezig levert miles op en telt
     mee voor de checkride;
   - Regels: de brevetten, checkrides en miles zoals ze nu gelden (aanpassen in
     Beheer → Gedeelde basis → Teksten, bij AI-brevetten).
   Een inzending op 'Gerealiseerd' zetten kent automatisch miles toe (awardFor,
   vanuit Inzendingen en Verbetervoorstellen), als de indiener meedoet.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate, toggleGroup } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const NUMBER = new Intl.NumberFormat('nl-NL');
  const view = { part: 'deelnemers', query: '', level: 'all', training: '' };

  /** Alles ophalen en per deelnemer uitrekenen. */
  async function loadAll() {
    const [accounts, facts] = await Promise.all([ns.brevetData.adminAccounts(), ns.brevetData.adminFacts()]);
    const byEmail = new Map();
    facts.forEach((fact) => {
      if (!byEmail.has(fact.email)) byEmail.set(fact.email, []);
      byEmail.get(fact.email).push(fact);
    });
    const rules = ns.brevet.rules();
    const rows = accounts.filter((account) => account.joined_at).map((account) => {
      const own = byEmail.get(account.email) || [];
      return { account, facts: own, result: ns.brevet.compute(own, { rules, royalties: ns.brevet.royaltiesFrom(facts, account.email) }) };
    }).sort((a, b) => b.result.miles - a.result.miles);
    return { accounts, facts, rows, rules };
  }

  const nameOf = (account) => account.name || account.email;

  /* ---- Miles bij een overgenomen inzending ----------------------------------------- */
  /**
   * Een inzending is gerealiseerd: miles voor de indiener, als die meedoet (op e-mailadres; in de demo
   * ook op naam). Geeft { status: 'ok' | 'al' | 'geen-email' | 'geen-account', name, miles }.
   */
  async function awardFor(idea) {
    if (!ns.brevet.enabled()) return { status: 'uit' };
    const email = String(idea.email || '').trim().toLowerCase();
    const name = String(idea.name || '').trim().toLowerCase();
    if (!email && !(ns.brevetData.isDemo() && name)) return { status: 'geen-email' };
    const accounts = (await ns.brevetData.adminAccounts()).filter((account) => account.joined_at);
    const account = accounts.find((row) => email && row.email === email)
      || (ns.brevetData.isDemo() && name ? accounts.find((row) => String(row.name || '').toLowerCase() === name) : null);
    if (!account) return { status: 'geen-account' };
    const added = await ns.brevetData.adminAdd([{ email: account.email, kind: 'contribution_adopted', item: 'idee-' + idea.id, detail: { kind: idea.kind, title: String(idea.title || '').slice(0, 120) }, namespace: idea.namespace || null }]);
    const miles = ns.brevet.rules().miles.adopted[idea.kind] || 0;
    return { status: added ? 'ok' : 'al', name: nameOf(account), miles };
  }

  /** Een melding bij awardFor (voor Inzendingen en Verbetervoorstellen). */
  function awardToast(result) {
    if (result.status === 'ok') toast(`${NUMBER.format(result.miles)} AI-miles voor ${result.name} (bijdrage overgenomen)`, { tone: 'success' });
    else if (result.status === 'geen-account') toast('De indiener doet niet mee met de AI-brevetten: geen miles toegekend.');
  }

  /* ---- Deelnemers ------------------------------------------------------------------ */
  function tiles(data) {
    const active = data.rows.filter((row) => row.result.active).length;
    const month = data.rows.reduce((total, row) => total + row.result.monthMiles, 0);
    const perLevel = data.rules.levels.map((level, index) => ({ level, index, count: data.rows.filter((row) => row.result.level === index).length }));
    return el('div', { className: 'bv-tiles' }, [
      el('div', { className: 'bv-tile' }, [el('strong', { text: NUMBER.format(data.rows.length) }), el('span', { text: 'doen mee' })]),
      el('div', { className: 'bv-tile' }, [el('strong', { text: NUMBER.format(active) }), el('span', { text: `actief (${data.rules.recencyDays} dagen)` })]),
      el('div', { className: 'bv-tile' }, [el('strong', { text: NUMBER.format(month) }), el('span', { text: 'AI-miles deze maand' })]),
      el('div', { className: 'bv-tile bv-tile--levels' }, perLevel.map((entry) => el('span', { className: 'bv-tile__level', attrs: { title: entry.level.name } }, [
        ns.brevetUi.insignia(entry.index, 'sm', { rules: data.rules }),
        el('span', {}, [el('strong', { text: NUMBER.format(entry.count) }), ' ' + entry.level.name])
      ])))
    ]);
  }

  function participants(data, redraw) {
    const search = el('input', { className: 'field__input', attrs: { id: 'bv-search', type: 'search', placeholder: 'Zoek op naam, e-mail of vestiging', autocomplete: 'off' } });
    search.value = view.query;
    const list = el('div', { className: 'usage-table' });
    const levelItems = [{ value: 'all', label: 'Alle' }, { value: '-1', label: 'Nog geen brevet' }].concat(data.rules.levels.map((level, index) => ({ value: String(index), label: level.name })));
    const filter = toggleGroup('Brevet', levelItems, view.level, (value) => {
      view.level = value;
      draw();
    }, { animate: false });

    function draw() {
      const query = ns.ui.normalize(view.query);
      const rows = data.rows.filter((row) => (view.level === 'all' || String(row.result.level) === view.level)
        && (!query || ns.ui.normalize([row.account.name, row.account.email, row.account.vestiging, row.account.team].join(' ')).includes(query)));
      if (!rows.length) {
        list.replaceChildren(el('p', { className: 'section__lead', text: data.rows.length ? 'Niemand gevonden met dit filter.' : 'Nog niemand doet mee. Wie meedoet, verschijnt hier.' }));
        return;
      }
      list.replaceChildren(el('table', { className: 'table bv-table' }, [
        el('caption', { className: 'sr-only', text: 'Deelnemers aan de AI-brevetten' }),
        el('thead', {}, [el('tr', {}, ['Naam', 'Brevet', 'AI-miles', 'Deze maand', 'Laatst actief', 'Deelt brevet', ''].map((label, n) => el('th', { className: n >= 2 && n <= 3 ? 'num' : '', attrs: { scope: 'col' }, text: label })))]),
        el('tbody', {}, rows.map((row) => {
          const open = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('book'), el('span', { text: 'Logboek' })]);
          open.addEventListener('click', () => person(row, data, redraw));
          return el('tr', {}, [
            el('th', { attrs: { scope: 'row' } }, [el('span', { className: 'bv-name', text: nameOf(row.account) }), el('span', { className: 'bv-email', text: row.account.email + (row.account.vestiging ? ' · ' + row.account.vestiging : '') })]),
            el('td', {}, [el('span', { className: 'bv-rank' }, [ns.brevetUi.insignia(row.result.level, 'sm', { rules: data.rules }), el('span', { text: row.result.levelInfo ? row.result.levelInfo.name : 'Nog geen' })])]),
            el('td', { className: 'num', text: NUMBER.format(row.result.miles) }),
            el('td', { className: 'num', text: row.result.monthMiles ? '+' + NUMBER.format(row.result.monthMiles) : '' }),
            el('td', {}, [el('span', { className: 'bv-active' + (row.result.active ? ' is-active' : ''), text: row.result.lastActive ? formatDate(row.result.lastActive) : 'Nog niet' })]),
            el('td', { text: row.account.share_brevet ? 'Ja' : 'Nee' }),
            el('td', {}, [open])
          ]);
        }))
      ]));
    }
    let timer = 0;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        view.query = search.value;
        draw();
      }, 150);
    });
    const csv = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('download'), el('span', { text: 'CSV' })]);
    csv.addEventListener('click', () => {
      const columns = ['naam', 'email', 'vestiging', 'brevet', 'miles', 'deze_maand', 'laatst_actief', 'deelt_brevet'];
      kit.downloadCsv('ai-brevetten-' + new Date().toISOString().slice(0, 10) + '.csv', columns, data.rows.map((row) => [row.account.name, row.account.email, row.account.vestiging, row.result.levelInfo ? row.result.levelInfo.name : '', row.result.miles, row.result.monthMiles, row.result.lastActive, row.account.share_brevet ? 'ja' : 'nee']));
    });
    draw();
    return el('div', { className: 'bv-part' }, [
      tiles(data),
      el('div', { className: 'bv-filters' }, [
        el('label', { className: 'sr-only', attrs: { for: 'bv-search' }, text: 'Zoek een deelnemer' }),
        search,
        filter,
        csv
      ]),
      list
    ]);
  }

  /* ---- Eén deelnemer: logboek en acties --------------------------------------------- */
  function person(row, data, redraw) {
    const opener = document.activeElement;
    const { account, result } = row;
    const email = account.email;
    const own = () => data.facts.filter((fact) => fact.email === email);
    const facts = own().slice().sort((a, b) => (a.at < b.at ? 1 : -1));
    const busyWith = async (button, run, done) => {
      button.disabled = true;
      try {
        await run();
        toast(done, { tone: 'success' });
        dialog.close();
        redraw();
      } catch (error) {
        kit.failed('Opslaan', error);
        button.disabled = false;
      }
    };

    // Miles toekennen: een eigen item van het AI-team (Regels → Eigen items) of een los aantal met een reden
    const items = (data.rules.items || []).filter((item) => !item.off);
    const has = (id) => facts.some((fact) => fact.kind === 'item_awarded' && fact.detail && fact.detail.item === id);
    const itemSelect = el('select', { className: 'field__input', attrs: { id: 'bv-item' } }, [
      el('option', { attrs: { value: '' }, text: 'Los aantal miles, met een reden' }),
      ...items.map((item) => el('option', { attrs: { value: item.id, disabled: !item.repeat && has(item.id) }, text: `${item.name} · ${NUMBER.format(item.miles)} miles${!item.repeat && has(item.id) ? ' (al gekregen)' : ''}` }))
    ]);
    const miles = el('input', { className: 'field__input', attrs: { id: 'bv-miles', type: 'number', min: '1', max: '1000', step: '5', inputmode: 'numeric', placeholder: 'miles' } });
    const reason = el('input', { className: 'field__input', attrs: { id: 'bv-reason', type: 'text', maxlength: '120', placeholder: 'bijv. Demo gegeven in het teamoverleg' } });
    const syncItem = () => {
      miles.hidden = Boolean(itemSelect.value);
      reason.placeholder = itemSelect.value ? 'Toelichting (optioneel)' : 'bijv. Demo gegeven in het teamoverleg';
    };
    itemSelect.addEventListener('change', syncItem);
    const give = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: 'Toekennen' })]);
    give.addEventListener('click', () => {
      const chosen = items.find((item) => item.id === itemSelect.value);
      if (chosen) {
        if (!chosen.repeat && has(chosen.id)) {
          toast(`${nameOf(account)} heeft "${chosen.name}" al gekregen; dit item kan maar één keer.`, { tone: 'warning' });
          return;
        }
        const detail = { item: chosen.id, name: chosen.name, miles: chosen.miles };
        if (reason.value.trim()) detail.reason = reason.value.trim();
        busyWith(give, () => ns.brevetData.adminAdd([{ email, kind: 'item_awarded', item: chosen.repeat ? `${chosen.id}-${Date.now()}` : chosen.id, detail }]), `${chosen.name}: ${chosen.miles} AI-miles voor ${nameOf(account)}`);
        return;
      }
      const amount = Math.round(Number(miles.value));
      if (!amount || amount < 1 || amount > 1000 || !reason.value.trim()) {
        toast('Vul een aantal (1 tot 1000) en een reden in.', { tone: 'warning' });
        return;
      }
      busyWith(give, () => ns.brevetData.adminAdd([{ email, kind: 'bonus', item: 'bonus-' + Date.now(), detail: { miles: amount, reason: reason.value.trim() } }]), `${amount} AI-miles voor ${nameOf(account)}`);
    });
    // Sessie gegeven
    const session = el('input', { className: 'field__input', attrs: { id: 'bv-session', type: 'text', maxlength: '120', placeholder: 'bijv. Copilot in het controleteam Groningen' } });
    const sessionButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('users'), el('span', { text: 'Vastleggen' })]);
    sessionButton.addEventListener('click', () => {
      if (!session.value.trim()) {
        toast('Vul in welke sessie.', { tone: 'warning' });
        return;
      }
      busyWith(sessionButton, () => ns.brevetData.adminAdd([{ email, kind: 'session_given', item: 'sessie-' + Date.now(), detail: { title: session.value.trim() } }]), 'Sessie vastgelegd');
    });
    // Voordragen als Commander (of intrekken)
    const nominated = facts.find((fact) => fact.kind === 'nominated');
    const top = data.rules.levels[data.rules.levels.length - 1];
    const nominate = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('star'), el('span', { text: nominated ? 'Voordracht intrekken' : `Voordragen als ${top.name}` })]);
    nominate.addEventListener('click', () => busyWith(nominate, () => (nominated ? ns.brevetData.adminRemove(nominated.id) : ns.brevetData.adminAdd([{ email, kind: 'nominated', item: '' }])), nominated ? 'Voordracht ingetrokken' : 'Voorgedragen'));
    // Een prompt op iemands naam (voor de royalty's)
    const authored = new Set(facts.filter((fact) => fact.kind === 'prompt_author').map((fact) => fact.item));
    const prompt = el('select', { className: 'field__input', attrs: { id: 'bv-prompt' } }, [
      el('option', { attrs: { value: '' }, text: 'Kies een prompt' }),
      ...ns.content.prompts.filter((p) => !authored.has(p.id)).map((p) => el('option', { attrs: { value: p.id }, text: p.title }))
    ]);
    const link = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('link'), el('span', { text: 'Op naam zetten' })]);
    link.addEventListener('click', () => {
      if (!prompt.value) return;
      busyWith(link, () => ns.brevetData.adminAdd([{ email, kind: 'prompt_author', item: prompt.value }]), 'Prompt staat op naam: collega\'s die hem gebruiken, leveren royalty\'s op');
    });

    const entryOf = (fact) => {
      const remove = el('button', { className: 'btn btn--quiet btn--tiny', attrs: { type: 'button', 'aria-label': 'Weghalen: ' + ns.brevet.label({ kind: fact.kind, item: fact.item, detail: fact.detail || {} }, data.rules), title: 'Weghalen' } }, [icon('trash')]);
      remove.addEventListener('click', async () => {
        if (!(await ns.ui.confirmDialog('Dit feit verdwijnt uit het logboek; de miles en het brevet worden opnieuw berekend.', { title: 'Weghalen?', confirmLabel: 'Weghalen', danger: true }))) return;
        busyWith(remove, () => ns.brevetData.adminRemove(fact.id), 'Weggehaald');
      });
      const about = ns.views.logbook ? ns.views.logbook.subject({ kind: fact.kind, item: fact.item, detail: fact.detail || {} }) : '';
      const label = fact.kind === 'prompt_author' ? 'Auteur van een prompt' : fact.kind === 'training_registered' ? 'Aangemeld voor een training' : fact.kind === 'active_day' ? 'Actief in de cockpit' : ns.brevet.label({ kind: fact.kind, item: fact.item, detail: fact.detail || {} }, data.rules);
      const subject = about || (fact.kind === 'prompt_author' || fact.kind === 'training_registered' ? (ns.content.promptById.get(fact.item) || ns.content.trainingById.get(fact.item) || {}).title || fact.item : '');
      return el('li', { className: 'bv-fact' }, [
        el('span', { className: 'bv-fact__date', text: formatDate(ns.brevet.dayOf(fact.at)) }),
        el('span', { className: 'bv-fact__what' }, [el('span', { text: label }), subject ? el('span', { className: 'bv-fact__about', text: subject }) : null]),
        el('span', { className: 'bv-fact__by', text: fact.by && fact.by !== email ? 'AI-team' : '' }),
        remove
      ]);
    };
    const stats = result.stats;
    const dialog = el('dialog', { className: 'improve brevet-dialog bv-person', attrs: { 'aria-labelledby': 'bv-person-title' } }, [
      el('div', { className: 'improve__panel' }, [
        el('div', { className: 'bv-person__head' }, [
          ns.brevetUi.insignia(result.level, 'md', { rules: data.rules }),
          el('div', {}, [
            el('h2', { className: 'improve__title', attrs: { id: 'bv-person-title' }, text: nameOf(account) }),
            el('p', { className: 'improve__subject', text: [email, account.vestiging, result.levelInfo ? result.levelInfo.name : 'Nog geen brevet', NUMBER.format(result.miles) + ' AI-miles', result.active ? 'actief' : 'niet actief'].filter(Boolean).join(' · ') })
          ])
        ]),
        el('dl', { className: 'bv-stats' }, [
          ['Prompts', stats.prompts], ['Demo\'s', stats.demos], ['Trainingen', stats.trainings], ['Waarvan live', stats.live],
          ['Weken actief', stats.weeks], ['Overgenomen', stats.adopted], ['Royalty\'s (collega\'s)', stats.colleagues], ['Sessies', stats.sessions]
        ].map(([label, value]) => el('div', {}, [el('dt', { text: label }), el('dd', { text: NUMBER.format(value) })]))),
        result.next ? el('div', { className: 'bv-person__next' }, [
          el('h3', { className: 'promo__label', text: `Checkride voor ${result.next.level.name}` + (result.next.milesNeeded ? ` (nog ${NUMBER.format(result.next.milesNeeded)} miles)` : '') }),
          ns.brevetUi.checklist(result.next.checks)
        ]) : null,
        el('div', { className: 'bv-actions' }, [
          el('div', { className: 'bv-action' }, [
            el('h3', { className: 'promo__label', text: 'Miles toekennen' }),
            items.length ? el('div', { className: 'bv-action__row' }, [el('label', { className: 'sr-only', attrs: { for: 'bv-item' }, text: 'Waarvoor' }), itemSelect]) : null,
            el('div', { className: 'bv-action__row' }, [
              el('label', { className: 'sr-only', attrs: { for: 'bv-miles' }, text: 'Aantal miles' }), miles,
              el('label', { className: 'sr-only', attrs: { for: 'bv-reason' }, text: 'Reden' }), reason,
              give
            ])
          ]),
          el('div', { className: 'bv-action' }, [
            el('h3', { className: 'promo__label', text: 'Sessie gegeven in het team' }),
            el('div', { className: 'bv-action__row' }, [el('label', { className: 'sr-only', attrs: { for: 'bv-session' }, text: 'Welke sessie' }), session, sessionButton])
          ]),
          el('div', { className: 'bv-action' }, [
            el('h3', { className: 'promo__label', text: 'Prompt op naam (royalty\'s)' }),
            el('div', { className: 'bv-action__row' }, [el('label', { className: 'sr-only', attrs: { for: 'bv-prompt' }, text: 'Prompt' }), prompt, link])
          ]),
          el('div', { className: 'bv-action bv-action--inline' }, [nominate])
        ]),
        el('details', { className: 'bv-log' }, [
          el('summary', { text: `Logboek (${facts.length} ${facts.length === 1 ? 'regel' : 'regels'})` }),
          el('ol', { className: 'bv-facts', attrs: { role: 'list' } }, facts.map(entryOf))
        ]),
        el('div', { className: 'improve__actions' }, [el('button', { className: 'btn btn--secondary', attrs: { type: 'button' }, on: { click: () => dialog.close() } }, [el('span', { text: 'Sluiten' })])])
      ])
    ]);
    dialog.append(ns.ui.closeButton(() => dialog.close()));
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });
    document.body.append(dialog);
    dialog.showModal();
  }

  /* ---- Trainingen ------------------------------------------------------------------- */
  function trainings(data, redraw) {
    const all = ns.content.trainings.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!all.length) return el('p', { className: 'section__lead', text: 'Er staan nog geen trainingen in de cockpit.' });
    if (!all.some((training) => training.id === view.training)) view.training = all[0].id;
    const select = el('select', { className: 'field__input', attrs: { id: 'bv-training' } }, all.map((training) => el('option', { attrs: { value: training.id }, text: (training.date ? formatDate(training.date) + ' · ' : '') + training.title })));
    select.value = view.training;
    select.addEventListener('change', () => {
      view.training = select.value;
      redraw(true);
    });
    const id = view.training;
    const training = all.find((item) => item.id === id);
    const accounts = new Map(data.rows.map((row) => [row.account.email, row.account]));
    const people = new Map();
    data.facts.forEach((fact) => {
      if (fact.item !== id || !accounts.has(fact.email)) return;
      if (fact.kind === 'training_attended') people.set(fact.email, { status: 'aanwezig', facts: (people.get(fact.email) || { facts: [] }).facts.concat(fact) });
      if (fact.kind === 'training_registered') {
        const known = people.get(fact.email);
        people.set(fact.email, { status: known && known.status === 'aanwezig' ? 'aanwezig' : 'aangemeld', facts: (known ? known.facts : []).concat(fact) });
      }
    });

    // Toevoegen: alleen deelnemers (accounts die meedoen)
    const input = el('input', { className: 'field__input', attrs: { id: 'bv-add', type: 'text', list: 'bv-people', placeholder: 'Naam of e-mailadres', autocomplete: 'off' } });
    const options = el('datalist', { attrs: { id: 'bv-people' } }, data.rows.filter((row) => !people.has(row.account.email)).map((row) => el('option', { attrs: { value: `${nameOf(row.account)} <${row.account.email}>` } })));
    const status = el('select', { className: 'field__input', attrs: { id: 'bv-add-status', 'aria-label': 'Status' } }, [
      el('option', { attrs: { value: 'training_registered' }, text: 'Aangemeld' }),
      el('option', { attrs: { value: 'training_attended' }, text: 'Aanwezig' })
    ]);
    status.value = training && training.date && training.date > ns.content.today() ? 'training_registered' : 'training_attended';
    const add = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'submit' } }, [icon('plus'), el('span', { text: 'Toevoegen' })]);
    const form = el('form', { className: 'bv-add', attrs: { novalidate: true } }, [
      el('label', { className: 'field__label', attrs: { for: 'bv-add' }, text: 'Deelnemer toevoegen' }),
      el('div', { className: 'bv-action__row' }, [input, options, status, add]),
      el('p', { className: 'field__hint', text: 'Alleen collega\'s die meedoen met de AI-brevetten (en dus een account hebben). Aanwezig levert miles op en telt mee voor de checkride.' })
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim().toLowerCase();
      const match = value.match(/<([^>]+)>/);
      const wanted = match ? match[1] : value;
      const row = data.rows.find((item) => item.account.email === wanted) || data.rows.find((item) => String(item.account.name || '').toLowerCase() === wanted);
      if (!row) {
        toast('Geen deelnemer gevonden. Alleen wie meedoet, kun je toevoegen.', { tone: 'warning' });
        return;
      }
      const kinds = status.value === 'training_attended' ? ['training_registered', 'training_attended'] : ['training_registered'];
      add.disabled = true;
      ns.brevetData.adminAdd(kinds.map((kind) => ({ email: row.account.email, kind, item: id, namespace: training.namespace || null })))
        .then(() => {
          toast(`${nameOf(row.account)} ${status.value === 'training_attended' ? 'staat op aanwezig' : 'is aangemeld'}`, { tone: 'success' });
          redraw(true);
        })
        .catch((error) => {
          kit.failed('Toevoegen', error);
          add.disabled = false;
        });
    });

    const registered = Array.from(people.entries()).filter(([, info]) => info.status === 'aangemeld');
    const allPresent = registered.length ? el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: registered.length === 1 ? 'De aangemelde op aanwezig' : `Alle ${registered.length} aangemelden op aanwezig` })]) : null;
    if (allPresent) allPresent.addEventListener('click', async () => {
      allPresent.disabled = true;
      try {
        await ns.brevetData.adminAdd(registered.map(([email]) => ({ email, kind: 'training_attended', item: id, namespace: training.namespace || null })));
        toast('Iedereen staat op aanwezig', { tone: 'success' });
        redraw(true);
      } catch (error) {
        kit.failed('Opslaan', error);
        allPresent.disabled = false;
      }
    });

    const list = people.size
      ? el('ul', { className: 'bv-people', attrs: { role: 'list' } }, Array.from(people.entries()).sort((a, b) => nameOf(accounts.get(a[0])).localeCompare(nameOf(accounts.get(b[0])), 'nl')).map(([email, info]) => {
        const account = accounts.get(email);
        const present = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button', hidden: info.status === 'aanwezig' } }, [icon('check'), el('span', { text: 'Aanwezig' })]);
        present.addEventListener('click', async () => {
          present.disabled = true;
          try {
            await ns.brevetData.adminAdd([{ email, kind: 'training_attended', item: id, namespace: training.namespace || null }]);
            redraw(true);
          } catch (error) {
            kit.failed('Opslaan', error);
            present.disabled = false;
          }
        });
        const remove = el('button', { className: 'btn btn--quiet btn--tiny', attrs: { type: 'button', 'aria-label': 'Weghalen: ' + nameOf(account), title: 'Weghalen' } }, [icon('trash')]);
        remove.addEventListener('click', async () => {
          if (!(await ns.ui.confirmDialog(`${nameOf(account)} staat dan niet meer bij deze training (ook niet als aanwezig).`, { title: 'Weghalen?', confirmLabel: 'Weghalen', danger: true }))) return;
          remove.disabled = true;
          try {
            for (const fact of info.facts) await ns.brevetData.adminRemove(fact.id);
            redraw(true);
          } catch (error) {
            kit.failed('Weghalen', error);
            remove.disabled = false;
          }
        });
        return el('li', { className: 'bv-person-row' }, [
          el('span', { className: 'bv-name', text: nameOf(account) }),
          el('span', { className: 'bv-status bv-status--' + info.status, text: info.status === 'aanwezig' ? 'Aanwezig' : 'Aangemeld' }),
          el('span', { className: 'bv-person-row__actions' }, [present, remove])
        ]);
      }))
      : el('p', { className: 'section__lead', text: 'Nog niemand bij deze training.' });

    return el('div', { className: 'bv-part' }, [
      el('div', { className: 'field' }, [el('label', { className: 'field__label', attrs: { for: 'bv-training' }, text: 'Training' }), select]),
      form,
      el('div', { className: 'bv-people-head' }, [el('h3', { className: 'promo__label', text: `${people.size} ${people.size === 1 ? 'deelnemer' : 'deelnemers'}` }), allPresent]),
      list
    ]);
  }

  /* ---- Regels: aanpassen voor alle disciplines, of alleen voor deze ------------------------- */
  // De acties met miles: [plek in de regels, wat, spelregel]
  const ACTIONS = [
    ['prompt_used', 'Een prompt voor het eerst gebruiken', 'elke prompt één keer'],
    ['demo_watched', 'Een demo bekijken', 'per usecase één keer; een video pas als hij helemaal is bekeken'],
    ['prompt_rated', 'Een prompt of usecase beoordelen', 'per item één keer'],
    ['builder_strong', 'Een sterke prompt bouwen (90+)', 'hoogstens één keer per dag'],
    ['tour_done', 'De rondleiding gedaan', 'één keer'],
    ['profile_done', 'Mijn gegevens ingevuld', 'één keer'],
    ['policy_check', 'Check "Veilig vliegen" gehaald', 'één keer'],
    ['idea_sent', 'Insturen in de ideeënhub', 'tot het plafond per week'],
    ['recording_watched', 'Opname van een training bekeken', 'per training één keer (zelf aangegeven)'],
    ['kickstart_done', 'Kickstart afgerond', 'één keer: alle stappen van de Kickstart gedaan'],
    ['training_attended', 'Live training bijgewoond', 'legt het AI-team vast'],
    ['session_given', 'Sessie gegeven in je team', 'legt het AI-team vast'],
    ['royalty', 'Royalty: een collega gebruikt jouw prompt', 'per collega één keer, tot het plafond per maand'],
    ['rhythm', 'Vliegritme: 3 dagen actief in een week', 'per week'],
    ['adopted.prompt', 'Prompt overgenomen', 'bij Gerealiseerd in Inzendingen'],
    ['adopted.verbetering', 'Verbetervoorstel overgenomen', 'ook gedeeltelijk'],
    ['adopted.idee', 'Idee gerealiseerd', ''],
    ['adopted.usecase', 'Usecase aangeleverd', ''],
    ['adopted.verzoek', 'Verzoek gerealiseerd', 'het AI-team maakte iets op jouw verzoek']
  ];
  const LIMITS = [
    ['caps.usagePerDay', 'Plafond: miles uit gebruik per dag', 'prompts, demo\'s, beoordelen en de promptbouwer samen'],
    ['caps.sentPerWeek', 'Plafond: keer insturen per week', 'daarboven levert insturen geen miles op'],
    ['caps.royaltyPerMonth', 'Plafond: royalty\'s per maand', 'in miles'],
    ['recencyDays', 'Actief = de laatste … dagen', 'zoals piloten: wie zo lang niet is geweest, staat op niet actief']
  ];
  const pick = (obj, path) => path.split('.').reduce((o, key) => (o == null ? undefined : o[key]), obj);
  function put(obj, path, value) {
    const keys = path.split('.');
    let target = obj;
    keys.slice(0, -1).forEach((key) => {
      target = target[key] = target[key] || {};
    });
    target[keys[keys.length - 1]] = value;
  }
  // Leeg (geen enkele waarde) weghalen, zodat alleen wat je invult wordt bewaard
  function prune(value) {
    if (Array.isArray(value)) return value.length ? value : undefined;
    if (value && typeof value === 'object') {
      const result = {};
      Object.entries(value).forEach(([key, inner]) => {
        const kept = prune(inner);
        if (kept !== undefined) result[key] = kept;
      });
      return Object.keys(result).length ? result : undefined;
    }
    return value === '' || value == null ? undefined : value;
  }

  /**
   * Brevetten, voordelen, checkrides en miles aanpassen. Twee niveaus: voor alle disciplines (de
   * gedeelde basis) en alleen voor de discipline die bovenin de zijbalk gekozen is; wat je bij de
   * discipline leeg laat, komt van alle disciplines (en anders de standaard). Bewaard als instelling
   * 'brevet' per naamruimte (js/content.js), direct live.
   */
  function rulesEditor(onSaved) {
    const discipline = ns.cockpit.active();
    const scope = view.rulesScope === 'own' ? 'own' : 'basis';
    const stored = (ns.content.brevetRules || {})[scope] || {};
    // Wat geldt als je hier niets invult (grijs in de velden)
    const inherited = scope === 'own' ? ns.brevet.rules(null, { basisOnly: true }) : ns.brevet.rules((ns.content.settings || {}).brevet || {});
    const namespace = scope === 'own' ? ns.cockpit.namespace(discipline.id) : ns.cockpit.GENERAL_NAMESPACE;
    const inputs = [];
    let uid = 0;
    // Wat nu geldt voor een veld (in de regels zijn de brevetten en checkrides lijsten, in een laag op naam)
    const current = (path) => {
      const [head, id, key] = path.split('.');
      if (head === 'levels') return (inherited.levels.find((level) => level.id === id) || {})[key];
      if (head === 'checks') return ((inherited.checks[id] || []).find((check) => check.stat === key) || {}).need;
      return pick(inherited, path);
    };

    const number = (path, label, max) => {
      const id = 'bvr-' + (++uid);
      const now = current(path);
      const input = el('input', { className: 'field__input field__input--sm', attrs: { id, type: 'number', min: path.startsWith('checks.') ? '1' : '0', max: max ? String(max) : null, step: '1', inputmode: 'numeric', placeholder: now == null ? '' : String(now), 'aria-label': label } });
      const own = pick(stored, path);
      input.value = own == null || own === '' ? '' : String(own);
      inputs.push({ path, input, kind: 'number' });
      return input;
    };
    // Een naam (in het logboek): leeg = wat nu geldt (grijs)
    const nameInput = (path, now, label) => {
      const input = el('input', { className: 'field__input field__input--sm bvr-name', attrs: { type: 'text', maxlength: '60', placeholder: now || '', 'aria-label': label } });
      input.value = pick(stored, path) || '';
      inputs.push({ path, input, kind: 'label' });
      return input;
    };
    // De regels met deze laag erbij (voor de keuzes bij een checkride: ook de eigen items van deze laag)
    const full = preview(stored);
    const scopeNav = toggleGroup('Voor wie', [
      { value: 'basis', label: 'Alle disciplines', icon: 'globe' },
      { value: 'own', label: 'Alleen ' + discipline.name, icon: 'layers' }
    ], scope, (value) => {
      view.rulesScope = value;
      onSaved();
    }, { animate: false, resetValue: scope });

    // Brevetten: naam, drempel, voordelen en de checkride
    const checkRows = {};
    const levelCards = inherited.levels.map((level, index) => {
      const name = el('input', { className: 'field__input', attrs: { type: 'text', maxlength: '40', placeholder: level.name, 'aria-label': 'Naam van brevet ' + (index + 1) } });
      name.value = pick(stored, `levels.${level.id}.name`) || '';
      inputs.push({ path: `levels.${level.id}.name`, input: name, kind: 'text' });
      // Net zoveel regels als er voordelen zijn (geen scrollbalk in het vak)
      const ownPerks = pick(stored, `levels.${level.id}.perks`) || [];
      const perks = el('textarea', { className: 'field__input field__textarea', attrs: { rows: String(Math.min(8, Math.max(3, Math.max(ownPerks.length, level.perks.length) + 1))), maxlength: '600', placeholder: level.perks.join('\n'), 'aria-label': 'Voordelen van ' + level.name + ', één per regel' } });
      perks.value = ownPerks.join('\n');
      inputs.push({ path: `levels.${level.id}.perks`, input: perks, kind: 'list' });
      // Wat je kunt tellen, heeft een aantal; wat maar één keer kan (rondleiding, voordracht), niet.
      // Met het kruisje haal je een eis weg; onderaan voeg je er een toe.
      const checkBox = el('div', { className: 'bvr-checks' });
      const rows = checkRows[level.id] = [];
      const once = (stat) => ns.brevet.ONCE_STATS.includes(stat);
      const drawCheck = (row) => {
        const input = once(row.stat) ? null : el('input', { className: 'field__input field__input--sm', attrs: { type: 'number', min: '1', max: '999', step: '1', inputmode: 'numeric', placeholder: row.inherited ? String(row.need) : '1', 'aria-label': row.label + ' (' + level.name + ')' } });
        if (input) input.value = row.value == null ? '' : String(row.value);
        row.input = input;
        const remove = el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-pressed': String(row.removed), 'aria-label': (row.removed ? 'Terugzetten: ' : 'Weghalen: ') + row.label, title: row.removed ? 'Terugzetten' : 'Weghalen uit de checkride' } }, [icon(row.removed ? 'refresh' : 'close')]);
        const node = el('div', { className: 'bvr-check' + (input ? '' : ' bvr-check--once') + (row.removed ? ' is-removed' : '') }, [
          input || icon('check'),
          el('span', { text: row.label }),
          remove
        ]);
        remove.addEventListener('click', () => {
          // Wat je al typte, blijft staan als je hem terugzet
          if (input) row.value = input.value === '' ? null : Math.round(Number(input.value));
          if (!row.inherited) {
            rows.splice(rows.indexOf(row), 1);
            node.remove();
            return;
          }
          row.removed = !row.removed;
          node.replaceWith(drawCheck(row));
        });
        row.node = node;
        return node;
      };
      // Wat nu geldt (zonder deze laag) …
      (inherited.checks[level.id] || []).forEach((check) => {
        const own = pick(stored, `checks.${level.id}.${check.stat}`);
        rows.push({ stat: check.stat, label: check.label, need: check.need, inherited: true, removed: own === 0, value: own > 0 ? own : null });
      });
      // … en wat deze laag toevoegde
      Object.entries((stored.checks || {})[level.id] || {}).forEach(([stat, value]) => {
        if (rows.some((row) => row.stat === stat) || !(value > 0)) return;
        rows.push({ stat, label: ns.brevet.statLabel(stat, value, full), need: value, inherited: false, removed: false, value: once(stat) ? null : value });
      });
      rows.forEach((row) => checkBox.append(drawCheck(row)));
      // Een eis toevoegen: alles wat de cockpit telt, de automatische items en de eigen items
      const choices = Object.keys(ns.brevet.STATS)
        .concat(ns.brevet.ACTIVITIES.map((activity) => 'activity:' + activity.id))
        .concat((full.items || []).map((item) => 'item:' + item.id));
      const addSelect = el('select', { className: 'field__input field__input--sm', attrs: { 'aria-label': 'Eis toevoegen aan de checkride van ' + level.name } }, [el('option', { attrs: { value: '' }, text: 'Eis toevoegen…' })].concat(
        choices.map((stat) => el('option', { attrs: { value: stat }, text: ns.brevet.statLabel(stat, 1, full) }))
      ));
      addSelect.addEventListener('change', () => {
        const stat = addSelect.value;
        addSelect.value = '';
        if (!stat) return;
        const existing = rows.find((row) => row.stat === stat);
        if (existing) {
          if (existing.removed) {
            existing.removed = false;
            existing.node.replaceWith(drawCheck(existing));
          }
          toast('Deze eis staat al in de checkride.');
          return;
        }
        const row = { stat, label: ns.brevet.statLabel(stat, 1, full), need: 1, inherited: false, removed: false, value: once(stat) ? null : 1 };
        rows.push(row);
        checkBox.append(drawCheck(row));
        if (row.input) row.input.focus();
      });
      const checks = [checkBox, rows.length < 8 ? addSelect : null].filter(Boolean);
      return el('section', { className: 'bvr-level', attrs: { 'aria-label': level.name } }, [
        el('div', { className: 'bvr-level__head' }, [ns.brevetUi.insignia(index, 'md', { rules: inherited }), name]),
        level.id === 'cadet'
          ? el('p', { className: 'bvr-level__miles', text: 'Geen drempel: het eerste brevet, na de eerste stappen' })
          : el('label', { className: 'bvr-level__miles' }, [el('span', { text: 'Drempel' }), number(`levels.${level.id}.miles`, 'AI-miles voor ' + level.name, 100000), el('span', { text: 'AI-miles' })]),
        el('p', { className: 'bv-level__label' }, ['Voordelen', el('span', { className: 'bvr-level__sub', text: ' · één per regel' })]),
        perks,
        el('p', { className: 'bv-level__label', text: 'Checkride' }),
        ...checks
      ]);
    });

    // Vaste acties: miles en (waar het een eigen regel in het logboek is) de naam daar
    const actionRows = ACTIONS.map(([path, label, rule]) => el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: label }),
      el('td', { className: 'num' }, [number('miles.' + path, 'Miles: ' + label, 1000)]),
      el('td', {}, [ns.brevet.LABELS[path] ? nameInput('labels.' + path, inherited.labels[path] || ns.brevet.LABELS[path], 'Naam in het logboek: ' + label) : null].filter(Boolean)),
      el('td', { className: 'bvr-rule', text: rule })
    ]));
    const limitRows = LIMITS.map(([path, label, rule]) => el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: label }),
      el('td', { className: 'num' }, [number(path, label, path === 'recencyDays' ? 365 : 10000)]),
      el('td', {}),
      el('td', { className: 'bvr-rule', text: rule })
    ]));
    // Automatische items: wat de cockpit al ziet; 0 miles = uit
    const activityRows = ns.brevet.ACTIVITIES.map((activity) => el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: activity.label }),
      el('td', { className: 'num' }, [number('activities.' + activity.id + '.miles', 'Miles: ' + activity.label, 1000)]),
      el('td', {}, [nameInput('activities.' + activity.id + '.name', inherited.activities[activity.id].name || activity.label, 'Naam in het logboek: ' + activity.label)]),
      el('td', { className: 'bvr-rule', text: activity.rule })
    ]));

    /* Eigen items van het AI-team: toe te kennen bij een deelnemer (Deelnemers → Miles toekennen). Bij een
       discipline: de items van alle disciplines aan of uit en met eigen miles, en eigen items erbij. */
    const itemRows = [];
    const itemList = el('div', { className: 'bvr-items' });
    const ownItems = Array.isArray(stored.items) ? stored.items : [];
    function itemRow(source, from) {
      const row = { id: source.id || '', from, name: null, miles: null, repeat: null, off: null };
      const n = itemRows.length + 1;
      row.name = el('input', { className: 'field__input field__input--sm', attrs: { type: 'text', maxlength: '60', placeholder: from ? source.placeholderName : 'bijv. Agent gebouwd in Copilot Studio', 'aria-label': 'Naam van eigen item ' + n } });
      row.name.value = from ? '' : source.name || '';
      if (from) row.name.disabled = true;
      row.miles = el('input', { className: 'field__input field__input--sm', attrs: { type: 'number', min: '0', max: '1000', step: '5', inputmode: 'numeric', placeholder: from ? String(source.placeholderMiles) : '50', 'aria-label': 'Miles voor eigen item ' + n } });
      row.miles.value = source.miles == null ? '' : String(source.miles);
      row.repeat = el('select', { className: 'field__input field__input--sm', attrs: { 'aria-label': 'Hoe vaak, eigen item ' + n } }, [
        el('option', { attrs: { value: 'once' }, text: 'Eén keer per persoon' }),
        el('option', { attrs: { value: 'repeat' }, text: 'Vaker (elke keer)' })
      ]);
      row.repeat.value = source.repeat ? 'repeat' : 'once';
      if (from) row.repeat.disabled = true;
      const offBox = el('input', { attrs: { type: 'checkbox', checked: source.off === true } });
      offBox.id = 'bvr-item-off-' + (++uid);
      row.off = offBox;
      const remove = from ? null : el('button', { className: 'btn btn--quiet btn--icon btn--tiny', attrs: { type: 'button', 'aria-label': 'Weghalen: eigen item ' + n, title: 'Weghalen' } }, [icon('trash')]);
      const node = el('div', { className: 'bvr-item' + (from ? ' bvr-item--inherited' : '') }, [
        row.name, row.miles, row.repeat,
        el('label', { className: 'check check--compact', attrs: { for: offBox.id } }, [offBox, el('span', { text: 'Uit' })]),
        from ? el('span', { className: 'bvr-item__from', text: 'van alle disciplines' }) : remove
      ].filter(Boolean));
      if (remove) {
        remove.addEventListener('click', () => {
          itemRows.splice(itemRows.indexOf(row), 1);
          node.remove();
        });
      }
      row.node = node;
      itemRows.push(row);
      itemList.append(node);
      return row;
    }
    if (scope === 'own') {
      // De items van alle disciplines: hier alleen aan/uit en de miles
      (inherited.items || []).forEach((item) => {
        const override = ownItems.find((own) => own.id === item.id) || {};
        itemRow({ id: item.id, placeholderName: item.name, placeholderMiles: item.miles, repeat: item.repeat, miles: override.miles, off: override.off === true || item.off }, true);
      });
    }
    ownItems.filter((item) => scope === 'basis' || !(inherited.items || []).some((i) => i.id === item.id)).forEach((item) => itemRow(item, false));
    const addItem = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: 'Item toevoegen' })]);
    addItem.addEventListener('click', () => {
      const row = itemRow({}, false);
      row.name.focus();
    });

    const status = el('p', { className: 'bvr-status', attrs: { role: 'status' } });
    const formError = kit.formError();
    const save = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
    const reset = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: scope === 'own' ? 'Alles zoals bij alle disciplines' : 'Alles terug naar de standaard' })]);

    function collect() {
      const layer = {};
      inputs.forEach(({ path, input, kind }) => {
        const raw = input.value.trim();
        if (!raw) return;
        if (kind === 'number') put(layer, path, Math.round(Number(raw)));
        else if (kind === 'list') put(layer, path, raw.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8));
        else put(layer, path, raw.slice(0, kind === 'label' ? 60 : 40));
      });
      // Eigen items: een adres uit de naam (blijft daarna hetzelfde, zodat toegekende items blijven kloppen)
      const taken = new Set((inherited.items || []).map((item) => item.id));
      const items = [];
      itemRows.forEach((row) => {
        const name = row.name.value.trim();
        const miles = row.miles.value.trim();
        if (row.from) {
          // Van alle disciplines: alleen wat je hier anders wilt
          const override = { id: row.id };
          if (miles !== '') override.miles = Math.round(Number(miles));
          if (row.off.checked) override.off = true;
          if (Object.keys(override).length > 1) items.push(override);
          return;
        }
        if (!name) return;
        let id = row.id;
        if (!id) {
          const base = kit.slug(name, 34) || 'item';
          id = base;
          for (let n = 2; taken.has(id) || items.some((item) => item.id === id); n++) id = `${base}-${n}`;
          row.id = id;
        }
        taken.add(id);
        const item = { id, name: name.slice(0, 60), miles: miles === '' ? 0 : Math.round(Number(miles)), repeat: row.repeat.value === 'repeat' };
        if (row.off.checked) item.off = true;
        items.push(item);
      });
      if (items.length) layer.items = items;
      // Checkrides: weggehaald = 0, toegevoegd = het aantal (of 1), aangepast = het nieuwe aantal
      Object.entries(checkRows).forEach(([levelId, rows]) => {
        rows.forEach((row) => {
          const path = `checks.${levelId}.${row.stat}`;
          const typed = row.input && row.input.value.trim() !== '' ? Math.round(Number(row.input.value)) : null;
          if (row.removed) put(layer, path, 0);
          else if (!row.inherited) put(layer, path, typed || 1);
          else if (typed != null) put(layer, path, typed);
        });
      });
      return prune(layer) || {};
    }

    save.addEventListener('click', async () => {
      formError.hide();
      const unnamed = itemRows.find((row) => !row.from && !row.name.value.trim() && row.miles.value.trim());
      if (unnamed) {
        formError.show('Geef ieder eigen item een naam (zo heet hij in het logboek).');
        unnamed.name.focus();
        return;
      }
      const wrongMiles = itemRows.find((row) => row.miles.value.trim() && !(Number(row.miles.value) >= 0 && Number(row.miles.value) <= 1000));
      if (wrongMiles) {
        formError.show('Miles voor een eigen item: een heel getal van 0 tot 1000.');
        wrongMiles.miles.focus();
        return;
      }
      const wrongCheck = Object.values(checkRows).flat().find((row) => row.input && row.input.value.trim() && !(Number(row.input.value) >= 1 && Number(row.input.value) <= 999));
      if (wrongCheck) {
        formError.show('Een eis in een checkride: een aantal van 1 tot 999 (of haal hem weg met het kruisje).');
        wrongCheck.input.focus();
        return;
      }
      const layer = collect();
      const bad = inputs.find(({ input, kind }) => kind === 'number' && input.value.trim() && !(Number(input.value) >= 0));
      if (bad) {
        formError.show('Gebruik alleen hele getallen van 0 of meer.');
        bad.input.focus();
        return;
      }
      // Na opslaan moeten de drempels oplopen (brevet 2 < 3 < 4)
      const after = preview(layer).levels;
      const thresholds = after.map((level) => level.miles);
      if (!(thresholds[1] < thresholds[2] && thresholds[2] < thresholds[3])) {
        const [, two, three, four] = after.map((level) => `${level.name} (${level.miles})`);
        formError.show(`De drempels moeten oplopen: nu ${two}, ${three}, ${four}. Elk brevet vraagt meer AI-miles dan het vorige.`);
        return;
      }
      const where = scope === 'own' ? discipline.name : 'alle disciplines';
      if (!(await ns.ui.confirmDialog(`De regels gelden direct voor ${where}. Miles en brevetten worden opnieuw berekend; wie hierdoor promoveert, krijgt het promotievenster.`, { title: 'Regels opslaan?', confirmLabel: 'Opslaan' }))) return;
      save.disabled = true;
      try {
        await ns.central.saveContent([{ type: 'setting', id: ns.content.BREVET_RULES_ID, data: layer, position: 0, status: 'published' }], namespace);
        await ns.app.reloadContent();
        toast('Regels opgeslagen voor ' + where, { tone: 'success' });
        onSaved();
      } catch (error) {
        formError.show('Opslaan mislukt: ' + error.message);
        save.disabled = false;
      }
    });
    reset.addEventListener('click', async () => {
      if (!Object.keys(stored).length) {
        toast(scope === 'own' ? 'Er staan geen eigen regels voor ' + discipline.name : 'Er staan al de standaardregels');
        return;
      }
      if (!(await ns.ui.confirmDialog(scope === 'own' ? `${discipline.name} volgt dan weer de regels van alle disciplines.` : 'Alle disciplines volgen dan weer de standaardregels (eigen regels van een discipline blijven staan).', { title: 'Terugzetten?', confirmLabel: 'Terugzetten' }))) return;
      reset.disabled = true;
      try {
        await ns.central.deleteContent('setting', ns.content.BREVET_RULES_ID, namespace);
        await ns.app.reloadContent();
        toast('Teruggezet', { tone: 'success' });
        onSaved();
      } catch (error) {
        kit.failed('Terugzetten', error);
        reset.disabled = false;
      }
    });

    /** De regels zoals ze in deze cockpit worden na opslaan (deze laag in plaats van de bewaarde). */
    function preview(layer) {
      const saved = ns.content.brevetRules;
      ns.content.brevetRules = Object.assign({ basis: null, own: null }, saved, { [scope]: layer });
      try {
        return ns.brevet.rules();
      } finally {
        ns.content.brevetRules = saved;
      }
    }

    status.textContent = Object.keys(stored).length
      ? (scope === 'own' ? 'Eigen regels voor ' + discipline.name + '. Lege velden volgen alle disciplines.' : 'Eigen regels voor alle disciplines. Lege velden volgen de standaard.')
      : (scope === 'own' ? discipline.name + ' volgt nu de regels van alle disciplines.' : 'Nu gelden de standaardregels.');

    return el('div', { className: 'bv-part bvr' }, [
      el('div', { className: 'bvr-scope' }, [scopeNav, status]),
      el('p', { className: 'field__hint', text: 'Grijs in een veld is wat nu geldt als je het leeg laat. Deelnemers en hun logboek rekenen met de regels van de cockpit waarin ze kijken.' }),
      el('div', { className: 'bvr-levels' }, levelCards),
      el('div', { className: 'usage-table' }, [el('table', { className: 'table bvr-table' }, [
        el('caption', { className: 'bvr-caption', text: 'AI-miles per actie' }),
        el('thead', {}, [el('tr', {}, [el('th', { attrs: { scope: 'col' }, text: 'Actie' }), el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Miles' }), el('th', { attrs: { scope: 'col' }, text: 'Naam in het logboek' }), el('th', { attrs: { scope: 'col' }, text: 'Spelregel' })])]),
        el('tbody', {}, actionRows.concat(limitRows))
      ])]),
      el('div', { className: 'usage-table' }, [el('table', { className: 'table bvr-table' }, [
        el('caption', { className: 'bvr-caption', text: 'Automatische items: wat de cockpit al ziet' }),
        el('thead', {}, [el('tr', {}, [el('th', { attrs: { scope: 'col' }, text: 'Item' }), el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Miles' }), el('th', { attrs: { scope: 'col' }, text: 'Naam in het logboek' }), el('th', { attrs: { scope: 'col' }, text: 'Spelregel' })])]),
        el('tbody', {}, activityRows)
      ])]),
      el('p', { className: 'field__hint', text: 'Standaard uit (0 miles). Zet je er een aan (miles, of als eis in een checkride), dan legt de cockpit het vanaf dat moment vast bij wie meedoet; miles tellen mee voor het plafond per dag. Wat iemand eerder deed, telt niet mee. Vraagt eenmalig stap 15 (setup/supabase-audit-puntenitems.sql).' }),
      el('section', { className: 'bvr-own', attrs: { 'aria-labelledby': 'bvr-own-title' } }, [
        el('h3', { className: 'bvr-caption', attrs: { id: 'bvr-own-title' }, text: 'Eigen items: toegekend door het AI-team' }),
        el('p', { className: 'field__hint', text: scope === 'own'
          ? `De items van alle disciplines staan bovenaan: zet ze uit of geef ze andere miles voor ${discipline.name}. Eigen items van ${discipline.name} voeg je eronder toe.`
          : 'Bijvoorbeeld "Agent gebouwd in Copilot Studio" of "Demo gegeven in het teamoverleg". Je kent ze toe bij een deelnemer (Deelnemers → Miles toekennen); in het logboek staat de naam. Een nieuw item kun je na opslaan ook als eis in een checkride zetten.' }),
        el('div', { className: 'bvr-item bvr-item--head', attrs: { 'aria-hidden': 'true' } }, [el('span', { text: 'Naam' }), el('span', { text: 'Miles' }), el('span', { text: 'Hoe vaak' }), el('span', { text: '' }), el('span', { text: '' })]),
        itemList,
        addItem
      ]),
      formError.node,
      el('div', { className: 'cms-form__actions' }, [save, reset])
    ]);
  }

  /* ---- Het tabblad ------------------------------------------------------------------ */
  function render() {
    const body = el('div', { className: 'bv__body' });
    const parts = [{ value: 'deelnemers', label: 'Deelnemers', icon: 'users' }, { value: 'trainingen', label: 'Trainingen', icon: 'cap' }, { value: 'regels', label: 'Regels', icon: 'book' }];
    const nav = toggleGroup('Onderdeel', parts, view.part, (value) => {
      view.part = value;
      draw();
    }, { animate: false, resetValue: view.part });
    let data = null;

    function draw() {
      if (!data) return;
      const redraw = (keep) => load(keep);
      body.replaceChildren(view.part === 'trainingen' ? trainings(data, redraw) : view.part === 'regels' ? rulesEditor(redraw) : participants(data, redraw));
    }

    async function load() {
      if (!data) body.replaceChildren(el('p', { className: 'section__lead', text: 'Laden…' }));
      try {
        data = await loadAll();
        draw();
      } catch (error) {
        body.replaceChildren(notice({ tone: 'warning', title: 'Laden mislukt', text: error.message }));
      }
    }

    const intro = ns.brevetData.isDemo()
      ? notice({ title: 'Demo: fictieve collega\'s', text: 'Zolang de cockpit nog niet op een V&V-systeem staat, zie je hier verzonnen deelnemers (alles staat alleen in deze browser). Zo werkt het straks met echte collega\'s. Overschakelen: zet brevet.mode op \'supabase\' in js/config.js, na stap 12 (zie README).' })
      : null;
    load();
    return { node: el('div', { className: 'bv' }, [intro, el('div', { className: 'bv-nav' }, [nav]), body]) };
  }

  ns.adminBrevet = { render, awardFor, awardToast, loadAll };
})(window.AIAudit);
