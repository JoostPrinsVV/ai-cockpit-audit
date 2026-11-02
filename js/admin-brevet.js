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

  /* ---- Regels ----------------------------------------------------------------------- */
  function rulesPart(data) {
    const r = data.rules;
    const m = r.miles;
    const rows = [
      ['Een prompt voor het eerst gebruiken', m.prompt_used, 'elke prompt één keer'],
      ['Een demo bekijken', m.demo_watched, 'per usecase één keer; een video pas als hij helemaal is bekeken'],
      ['Een prompt of usecase beoordelen', m.prompt_rated, 'per item één keer'],
      ['Een sterke prompt bouwen (90+)', m.builder_strong, 'hoogstens één keer per dag'],
      ['Rondleiding, Mijn gegevens, check "Veilig vliegen"', `${m.tour_done} / ${m.profile_done} / ${m.policy_check}`, 'één keer'],
      ['Insturen in de ideeënhub', m.idea_sent, `hoogstens ${r.caps.sentPerWeek} keer per week`],
      ['Opname van een training bekeken', m.recording_watched, 'per training één keer (zelf aangegeven)'],
      ['Live training bijgewoond', m.training_attended, 'legt het AI-team vast'],
      ['Prompt overgenomen', m.adopted.prompt, 'bij Gerealiseerd in Inzendingen'],
      ['Verbetervoorstel overgenomen', m.adopted.verbetering, 'ook gedeeltelijk'],
      ['Idee gerealiseerd', m.adopted.idee, ''],
      ['Usecase of demo aangeleverd', m.adopted.usecase, 'met een bonus vast te leggen'],
      ['Sessie gegeven in je team', m.session_given, 'legt het AI-team vast'],
      ['Royalty: een collega gebruikt jouw prompt', m.royalty, `per collega één keer; hoogstens ${r.caps.royaltyPerMonth} per maand`],
      ['Vliegritme: 3 dagen actief in een week', m.rhythm, 'per week']
    ];
    return el('div', { className: 'bv-part' }, [
      el('ol', { className: 'bv-levels', attrs: { role: 'list' } }, r.levels.map((level, index) => el('li', { className: 'bv-level' }, [
        ns.brevetUi.insignia(index, 'md', { rules: r }),
        el('div', {}, [
          el('h3', { className: 'bv-level__name', text: `${level.name} · ${index === 0 ? 'de eerste stappen' : NUMBER.format(level.miles) + ' AI-miles'}` }),
          el('p', { className: 'bv-level__label', text: 'Checkride' }),
          el('ul', { attrs: { role: 'list' } }, (r.checks[level.id] || []).map((check) => el('li', { text: (check.need > 1 ? check.need + ' ' : '') + check.label }))),
          el('p', { className: 'bv-level__label', text: 'Voordelen' }),
          el('ul', { attrs: { role: 'list' } }, level.perks.map((perk) => el('li', { text: perk })))
        ])
      ]))),
      el('div', { className: 'usage-table' }, [el('table', { className: 'table' }, [
        el('caption', { className: 'sr-only', text: 'AI-miles per actie' }),
        el('thead', {}, [el('tr', {}, [el('th', { attrs: { scope: 'col' }, text: 'Actie' }), el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Miles' }), el('th', { attrs: { scope: 'col' }, text: 'Spelregel' })])]),
        el('tbody', {}, rows.map(([label, value, rule]) => el('tr', {}, [el('th', { attrs: { scope: 'row' }, text: label }), el('td', { className: 'num', text: String(value) }), el('td', { text: rule })])))
      ])]),
      el('p', { className: 'field__hint' }, [
        `Gebruik telt samen hoogstens ${r.caps.usagePerDay} miles per dag. Actief = de laatste ${r.recencyDays} dagen in de cockpit geweest. Namen, drempels, voordelen en de belangrijkste miles pas je aan in `,
        el('a', { attrs: { href: '#/beheer/basis' }, text: 'Gedeelde basis → Teksten' }),
        ', bij AI-brevetten.'
      ])
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
      body.replaceChildren(view.part === 'trainingen' ? trainings(data, redraw) : view.part === 'regels' ? rulesPart(data) : participants(data, redraw));
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
