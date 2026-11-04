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

    // Miles toekennen
    const miles = el('input', { className: 'field__input', attrs: { id: 'bv-miles', type: 'number', min: '1', max: '1000', step: '5', inputmode: 'numeric' } });
    const reason = el('input', { className: 'field__input', attrs: { id: 'bv-reason', type: 'text', maxlength: '120', placeholder: 'bijv. Demo gegeven in het teamoverleg' } });
    const give = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: 'Toekennen' })]);
    give.addEventListener('click', () => {
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
      const remove = el('button', { className: 'btn btn--quiet btn--tiny', attrs: { type: 'button', 'aria-label': 'Weghalen: ' + (ns.brevet.LABELS[fact.kind] || fact.kind), title: 'Weghalen' } }, [icon('trash')]);
      remove.addEventListener('click', async () => {
        if (!(await ns.ui.confirmDialog('Dit feit verdwijnt uit het logboek; de miles en het brevet worden opnieuw berekend.', { title: 'Weghalen?', confirmLabel: 'Weghalen', danger: true }))) return;
        busyWith(remove, () => ns.brevetData.adminRemove(fact.id), 'Weggehaald');
      });
      const about = ns.views.logbook ? ns.views.logbook.subject({ kind: fact.kind, item: fact.item, detail: fact.detail || {} }) : '';
      const label = fact.kind === 'prompt_author' ? 'Auteur van een prompt' : fact.kind === 'training_registered' ? 'Aangemeld voor een training' : fact.kind === 'active_day' ? 'Actief in de cockpit' : ns.brevet.LABELS[fact.kind] || fact.kind;
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
  // Onderdelen van een checkride die maar één keer kunnen (geen aantal om in te stellen)
  const ONCE = ['tour', 'profile', 'policy', 'nominated'];
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
    const scopeNav = toggleGroup('Voor wie', [
      { value: 'basis', label: 'Alle disciplines', icon: 'globe' },
      { value: 'own', label: 'Alleen ' + discipline.name, icon: 'layers' }
    ], scope, (value) => {
      view.rulesScope = value;
      onSaved();
    }, { animate: false, resetValue: scope });

    // Brevetten: naam, drempel, voordelen en de checkride
    const levelCards = inherited.levels.map((level, index) => {
      const name = el('input', { className: 'field__input', attrs: { type: 'text', maxlength: '40', placeholder: level.name, 'aria-label': 'Naam van brevet ' + (index + 1) } });
      name.value = pick(stored, `levels.${level.id}.name`) || '';
      inputs.push({ path: `levels.${level.id}.name`, input: name, kind: 'text' });
      const perks = el('textarea', { className: 'field__input field__textarea', attrs: { rows: '4', maxlength: '600', placeholder: level.perks.join('\n'), 'aria-label': 'Voordelen van ' + level.name + ', één per regel' } });
      perks.value = (pick(stored, `levels.${level.id}.perks`) || []).join('\n');
      inputs.push({ path: `levels.${level.id}.perks`, input: perks, kind: 'list' });
      // Wat je kunt tellen, heeft een aantal; wat maar één keer kan (rondleiding, voordracht), niet
      const checks = (inherited.checks[level.id] || []).map((check) => (ONCE.includes(check.stat)
        ? el('p', { className: 'bvr-check bvr-check--once' }, [icon('check'), el('span', { text: check.label })])
        : el('label', { className: 'bvr-check' }, [number(`checks.${level.id}.${check.stat}`, check.label + ' (' + level.name + ')', 999), el('span', { text: check.label })])));
      return el('section', { className: 'bvr-level', attrs: { 'aria-label': level.name } }, [
        el('div', { className: 'bvr-level__head' }, [ns.brevetUi.insignia(index, 'md', { rules: inherited }), name]),
        level.id === 'cadet'
          ? el('p', { className: 'bvr-level__miles', text: 'Na de eerste stappen (geen drempel)' })
          : el('label', { className: 'bvr-level__miles' }, [number(`levels.${level.id}.miles`, 'AI-miles voor ' + level.name, 100000), el('span', { text: 'AI-miles nodig' })]),
        el('p', { className: 'bv-level__label', text: 'Voordelen (één per regel)' }),
        perks,
        el('p', { className: 'bv-level__label', text: 'Checkride' }),
        el('div', { className: 'bvr-checks' }, checks)
      ]);
    });

    const actionRows = ACTIONS.map(([path, label, rule]) => el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: label }),
      el('td', { className: 'num' }, [number('miles.' + path, 'Miles: ' + label, 1000)]),
      el('td', { className: 'bvr-rule', text: rule })
    ]));
    const limitRows = LIMITS.map(([path, label, rule]) => el('tr', {}, [
      el('th', { attrs: { scope: 'row' }, text: label }),
      el('td', { className: 'num' }, [number(path, label, path === 'recencyDays' ? 365 : 10000)]),
      el('td', { className: 'bvr-rule', text: rule })
    ]));

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
        else put(layer, path, raw.slice(0, 40));
      });
      return prune(layer) || {};
    }

    save.addEventListener('click', async () => {
      formError.hide();
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
        el('thead', {}, [el('tr', {}, [el('th', { attrs: { scope: 'col' }, text: 'Actie' }), el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Miles' }), el('th', { attrs: { scope: 'col' }, text: 'Spelregel' })])]),
        el('tbody', {}, actionRows.concat(limitRows))
      ])]),
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
