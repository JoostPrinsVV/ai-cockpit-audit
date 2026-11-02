/* ==========================================================================
   Mijn logboek (bovenaan #/mijn): je brevet, je AI-miles en je voortgang
   --------------------------------------------------------------------------
   Nog niet meedoen: uitleg, de ladder en 'Doe mee'. Wel meedoen: je brevet
   met de strepen, je miles, de checkride voor het volgende brevet, wat je
   recent verdiende, trainingen waarvoor je bent aangemeld, en stoppen.
   In de demo: 'Kijk als' een fictieve collega, en de demo opnieuw beginnen.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate } = ns.ui;
  const NUMBER = new Intl.NumberFormat('nl-NL');
  const MONTH = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });

  /** Waar een regel in het logboek over gaat (de titel van de prompt, demo, training …). */
  function subject(entry) {
    const c = ns.content;
    const title = (map, id) => {
      const item = map && map.get(id);
      return item ? item.title : '';
    };
    switch (entry.kind) {
      case 'prompt_used': return title(c.promptById, entry.item);
      case 'demo_watched': return title(c.usecaseById, entry.item);
      case 'prompt_rated': {
        const [type, id] = entry.item.split(':');
        return title(type === 'usecase' ? c.usecaseById : c.promptById, id);
      }
      case 'recording_watched':
      case 'training_attended': return title(c.trainingById, entry.item);
      case 'contribution_adopted':
      case 'session_given': return entry.detail.title || '';
      case 'bonus': return entry.detail.reason || '';
      case 'royalty': return `${entry.detail.users} ${entry.detail.users === 1 ? 'collega' : 'collega\'s'} in ${MONTH.format(new Date(entry.item + '-15T12:00:00'))}`;
      default: return '';
    }
  }

  function demoBar(rerender) {
    if (!ns.brevetData.isDemo()) return null;
    const select = el('select', { className: 'field__input field__input--sm', attrs: { id: 'logbook-as', 'aria-label': 'Kijk als' } });
    ns.brevetData.adminAccounts().then((rows) => {
      const me = ns.account.DEMO_ME;
      select.replaceChildren(
        el('option', { attrs: { value: me }, text: 'Jijzelf' }),
        ...rows.filter((row) => row.email !== me).sort((a, b) => a.name.localeCompare(b.name, 'nl')).map((row) => el('option', { attrs: { value: row.email }, text: row.name }))
      );
      select.value = ns.account.current().email;
    });
    select.addEventListener('change', () => {
      ns.account.become(select.value);
      ns.brevet.load().then(rerender);
    });
    const reset = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Demo opnieuw' })]);
    reset.addEventListener('click', async () => {
      if (!(await ns.ui.confirmDialog('Alle fictieve collega\'s beginnen opnieuw, en jouw demo-logboek wordt leeg.', { title: 'Demo opnieuw beginnen?', confirmLabel: 'Opnieuw' }))) return;
      ns.brevetData.resetDemo();
      ns.account.become('');
      await ns.brevet.load();
      rerender();
    });
    return el('div', { className: 'logbook__demo', attrs: { role: 'note' } }, [
      icon('info'),
      el('p', {}, [el('strong', { text: 'Demo. ' }), 'Je logboek en de fictieve collega\'s staan alleen in deze browser. Zo test je alles zonder echte persoonsgegevens.']),
      el('label', { className: 'logbook__as', attrs: { for: 'logbook-as' } }, [el('span', { text: 'Kijk als' }), select]),
      reset
    ]);
  }

  function intro() {
    const join = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('plane'), el('span', { text: 'Doe mee' })]);
    join.addEventListener('click', () => ns.brevetUi.join());
    return el('section', { className: 'logbook__intro', attrs: { 'aria-labelledby': 'logbook-intro-title' } }, [
      el('div', { className: 'logbook__intro-head' }, [
        el('div', {}, [
          el('p', { className: 'logbook__eyebrow', text: 'AI-brevetten' }),
          el('h2', { className: 'logbook__title', attrs: { id: 'logbook-intro-title' }, text: 'Verdien AI-miles, haal je brevetten' }),
          el('p', { className: 'logbook__lead', text: 'Prompts gebruiken, demo\'s bekijken, trainingen volgen en vooral bijdragen levert AI-miles op. Met genoeg miles en de checkride promoveer je: van Cadet tot Commander, met echte voordelen.' })
        ]),
        join
      ]),
      ns.brevetUi.ladder(-1)
    ]);
  }

  function signedOut() {
    const login = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('key'), el('span', { text: 'Inloggen' })]);
    login.addEventListener('click', () => ns.brevetUi.login());
    return el('section', { className: 'logbook__intro' }, [
      el('div', { className: 'logbook__intro-head' }, [
        el('div', {}, [
          el('p', { className: 'logbook__eyebrow', text: 'AI-brevetten' }),
          el('h2', { className: 'logbook__title', text: 'Log in om mee te doen' }),
          el('p', { className: 'logbook__lead', text: 'Met je account van Visser & Visser is je logboek op elk apparaat hetzelfde.' })
        ]),
        login
      ]),
      ns.brevetUi.ladder(-1)
    ]);
  }

  /** Je brevet: strepen, naam, miles en of je actief bent. */
  function card(result, account, others) {
    const level = result.levelInfo;
    const share = el('input', { attrs: { id: 'logbook-share', type: 'checkbox', checked: Boolean(account.share_brevet), disabled: others } });
    share.addEventListener('change', async () => {
      share.disabled = true;
      try {
        await ns.brevet.setShare(share.checked);
        toast(share.checked ? 'Collega\'s zien nu je brevet' : 'Je brevet is alleen voor jou', { tone: 'success' });
      } catch (error) {
        share.checked = !share.checked;
        toast('Dat lukte niet: ' + error.message, { tone: 'warning' });
      } finally {
        share.disabled = false;
      }
    });
    return el('section', { className: 'logbook__card', attrs: { 'aria-labelledby': 'logbook-card-title' } }, [
      ns.brevetUi.insignia(result.level, 'lg', { rules: result.rules }),
      el('div', { className: 'logbook__card-text' }, [
        el('p', { className: 'logbook__eyebrow', text: others ? 'Brevet van ' + (account.name || account.email) : 'Jouw brevet' }),
        el('h2', { className: 'logbook__rank', attrs: { id: 'logbook-card-title' }, text: level ? level.name : 'Nog geen brevet' }),
        el('p', { className: 'logbook__miles' }, [
          el('span', { className: 'logbook__number', text: NUMBER.format(result.miles) }),
          el('span', { className: 'logbook__unit', text: 'AI-miles' })
        ]),
        el('p', { className: 'logbook__meta' }, [
          el('span', { className: 'logbook__status' + (result.active ? ' is-active' : ''), text: result.active ? 'Actief' : result.lastActive ? 'Niet actief sinds ' + formatDate(result.lastActive) : 'Nog niet actief' }),
          result.monthMiles ? el('span', { text: `+${NUMBER.format(result.monthMiles)} deze maand` }) : null
        ]),
        el('label', { className: 'check check--compact logbook__share', attrs: { for: 'logbook-share' } }, [share, el('span', { text: 'Collega\'s mogen mijn brevet zien' })])
      ])
    ]);
  }

  /** Op weg naar het volgende brevet: voortgang, de checkride, en waar je meteen kunt beginnen. */
  function nextBlock(result, others) {
    const next = result.next;
    if (!next) {
      return el('section', { className: 'logbook__next' }, [
        el('h2', { className: 'logbook__h', text: 'Het hoogste brevet' }),
        el('p', { text: 'Je hebt alle strepen. Dank je wel dat je collega\'s meeneemt.' })
      ]);
    }
    const bar = el('span', { className: 'logbook__bar-fill' });
    bar.style.setProperty('--progress', String(Math.round(next.progress * 100)));
    const missing = new Set(next.checks.filter((check) => !check.ok).map((check) => check.stat));
    const actions = [];
    if (!others) {
      if (missing.has('policy')) actions.push(el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' }, on: { click: () => ns.brevetUi.policyCheck() } }, [icon('shield'), el('span', { text: 'Doe de check "Veilig vliegen"' })]));
      if (missing.has('tour')) actions.push(el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: () => ns.tour.restart() } }, [icon('plane'), el('span', { text: 'Start de rondleiding' })]));
      if (missing.has('profile')) actions.push(el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#mine-form-title' }, on: { click: (event) => {
        event.preventDefault();
        const field = document.getElementById('mine-naam');
        if (field) field.focus();
      } } }, [icon('user'), el('span', { text: 'Vul je gegevens in' })]));
      if (missing.has('prompts')) actions.push(ns.blocks.linkButton('#/prompts', 'chat', 'Naar de prompts', 'btn--secondary btn--sm'));
      if (missing.has('demos')) actions.push(ns.blocks.linkButton('#/usecases', 'play-circle', 'Bekijk een demo', 'btn--secondary btn--sm'));
      if (missing.has('trainings') || missing.has('live')) actions.push(ns.blocks.linkButton('#/trainingen', 'cap', 'Naar de trainingen', 'btn--secondary btn--sm'));
      if (missing.has('adopted')) actions.push(el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' }, on: { click: () => ns.ideas.quick({ kind: 'prompt' }) } }, [icon('chat'), el('span', { text: 'Deel een prompt' })]));
    }
    return el('section', { className: 'logbook__next', attrs: { 'aria-labelledby': 'logbook-next-title' } }, [
      el('div', { className: 'logbook__next-head' }, [
        ns.brevetUi.insignia(next.index, 'md', { rules: result.rules }),
        el('div', {}, [
          el('h2', { className: 'logbook__h', attrs: { id: 'logbook-next-title' }, text: `Op weg naar ${next.level.name}` }),
          el('p', { className: 'logbook__sub', text: next.milesNeeded ? `Nog ${NUMBER.format(next.milesNeeded)} AI-miles, en de checkride` : 'Genoeg AI-miles: nu nog de checkride' })
        ])
      ]),
      el('span', { className: 'logbook__bar', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(next.progress * 100)), 'aria-label': 'Voortgang naar ' + next.level.name } }, [bar]),
      ns.brevetUi.checklist(next.checks),
      actions.length ? el('div', { className: 'logbook__actions' }, actions) : null
    ]);
  }

  function recent(result) {
    const entries = result.entries.slice().reverse().slice(0, 15);
    if (!entries.length) return null;
    return el('section', { className: 'logbook__recent', attrs: { 'aria-labelledby': 'logbook-recent-title' } }, [
      el('h2', { className: 'logbook__h', attrs: { id: 'logbook-recent-title' }, text: 'Recent in je logboek' }),
      el('ol', { className: 'logbook__list', attrs: { role: 'list' } }, entries.map((entry) => {
        const about = subject(entry);
        return el('li', { className: 'logbook__entry' }, [
          el('span', { className: 'logbook__date', text: formatDate(entry.day) }),
          el('span', { className: 'logbook__what' }, [
            el('span', { text: ns.brevet.LABELS[entry.kind] || entry.kind }),
            about ? el('span', { className: 'logbook__about', text: about }) : null
          ]),
          el('span', { className: 'logbook__plus' + (entry.miles ? '' : ' is-zero'), text: entry.miles ? '+' + NUMBER.format(entry.miles) : entry.capped ? 'plafond' : '·', attrs: { title: entry.capped ? 'Boven het plafond (per dag of per maand)' : null } })
        ]);
      }))
    ]);
  }

  function registered(result) {
    const ids = result.stats.registered;
    if (!ids.length) return null;
    return el('section', { className: 'logbook__recent' }, [
      el('h2', { className: 'logbook__h', text: 'Aangemeld voor' }),
      el('ul', { className: 'logbook__list', attrs: { role: 'list' } }, ids.map((id) => {
        const training = ns.content.trainingById.get(id);
        return el('li', { className: 'logbook__entry' }, [
          el('span', { className: 'logbook__date', text: training && training.date ? formatDate(training.date) : '' }),
          training ? el('a', { className: 'logbook__what', attrs: { href: '#/training/' + encodeURIComponent(id) }, text: training.title }) : el('span', { className: 'logbook__what', text: id }),
          icon('calendar')
        ]);
      }))
    ]);
  }

  function leaveButton() {
    const button = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('logout'), el('span', { text: 'Stoppen met meedoen' })]);
    button.addEventListener('click', async () => {
      if (!(await ns.ui.confirmDialog('Je account en je hele logboek met AI-miles worden gewist. Opnieuw beginnen kan altijd.', { title: 'Stoppen met de AI-brevetten?', confirmLabel: 'Stoppen en wissen', danger: true }))) return;
      try {
        await ns.brevet.leave();
        toast('Gestopt. Je logboek is gewist.');
      } catch (error) {
        toast('Stoppen lukte niet: ' + error.message, { tone: 'warning' });
      }
    });
    return button;
  }

  /** Het hele blok; bouwt zichzelf opnieuw op als je logboek verandert. Geeft { node, destroy }. */
  function section() {
    if (!ns.brevet.enabled()) return { node: null, destroy() {} };
    const node = el('div', { className: 'logbook' });
    const notice = ns.account.takeNotice();
    if (notice && notice.error) toast('Inloggen lukte niet: ' + notice.error, { tone: 'warning' });
    else if (notice && notice.ok) toast('Je bent ingelogd', { tone: 'success' });

    function render() {
      const state = ns.brevet.state();
      const person = ns.account.current();
      const others = Boolean(person && person.demo && !person.me);
      const parts = [demoBar(render)];
      if (!person) parts.push(signedOut());
      else if (state.status === 'loading' || state.status === 'idle') parts.push(el('p', { className: 'logbook__loading', text: 'Je logboek laden…' }));
      else if (state.status === 'failed') parts.push(ns.blocks.notice({ tone: 'warning', title: 'Je logboek is nu niet te laden', text: 'Probeer het straks nog eens.' }));
      else if (!ns.brevet.joined() || !state.result) parts.push(others ? el('p', { className: 'logbook__loading', text: 'Deze collega doet (nog) niet mee.' }) : intro());
      else {
        const result = state.result;
        parts.push(
          el('div', { className: 'logbook__top' }, [card(result, state.account, others), nextBlock(result, others)]),
          el('div', { className: 'logbook__columns' }, [recent(result), registered(result)]),
          el('details', { className: 'logbook__ladder' }, [
            el('summary', {}, [icon('layers'), el('span', { text: 'Alle brevetten en wat ze opleveren' })]),
            ns.brevetUi.ladder(result.level, result.rules)
          ]),
          others ? null : el('div', { className: 'logbook__foot' }, [
            el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Het AI-team ziet je logboek; collega\'s alleen je brevet, en alleen als je dat aanzet.' })]),
            leaveButton()
          ])
        );
      }
      node.replaceChildren(...parts.filter(Boolean));
    }
    render();
    const stop = ns.brevet.onChange(render);
    // Na inloggen of 'kijk als': opnieuw laden
    const stopAccount = ns.account.onChange(() => ns.brevet.load());
    if (ns.brevet.state().status === 'idle') ns.brevet.load();
    return { node, destroy: () => { stop(); stopAccount(); } };
  }

  ns.views = ns.views || {};
  ns.views.logbook = { section, subject };
})(window.AIAudit);
