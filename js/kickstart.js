/* ==========================================================================
   Kickstart: een korte startroute met je eerste tijdwinst
   --------------------------------------------------------------------------
   Een kaart op de startpagina en in Mijn logboek. Wie start, krijgt vier
   stappen om af te vinken:
     1. de rondleiding door de cockpit;
     2. de check 'Veilig vliegen' (drie vragen over het AI-beleid);
     3. drie van de startprompts gebruiken;
     4. de usecase van de Kickstart bekijken.
   Het doel is je eerste uur per week terug: de balk toont je tijdwinst van
   deze week (js/tijdwinst.js). Afronden levert AI-miles op als je meedoet met
   de AI-brevetten (Beheer → AI-brevetten → Regels: 'Kickstart afgerond').

   Beheer → Inhoud → Teksten → Kickstart: titel, belofte, startprompts en de
   usecase. Zonder eigen keuze kiest de cockpit zelf: prompts uit de fasen
   van het seizoen (seizoenskompas), met een tijdsindicatie eerst.
   Je voortgang staat alleen op dit apparaat.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage, toast } = ns.ui;
  const KEY = 'kickstart';
  const EVENT = 'ai:kickstart';
  const DAYS = 14;
  const GOAL = 60; // minuten per week: je eerste uur
  const PROMPTS = 5; // zoveel startprompts
  const NEED = 3; // zoveel daarvan gebruiken
  const DEFAULT_TITLE = 'Kickstart voor assistenten';
  const DEFAULT_LEAD = 'In 14 dagen je eerste uur per week terug';

  const settings = () => (ns.content && ns.content.settings) || {};
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const today = () => ns.content.today();

  /* ---- Wat hoort erbij --------------------------------------------------------------------- */
  /** Titel, belofte en of hij aan staat (Beheer → Teksten). */
  function info(source) {
    const s = source || settings();
    return { on: s.kickstartOff !== true, title: text(s.kickstartTitle) || DEFAULT_TITLE, lead: text(s.kickstartLead) || DEFAULT_LEAD };
  }

  /**
   * De startprompts en de usecase: { prompts: [prompt], usecase }. Eigen keuze uit Beheer; anders
   * prompts uit de fasen van het seizoen, met een schatting van de tijdwinst eerst, één per usecase.
   */
  function startSet(source) {
    const s = source || settings();
    const c = ns.content;
    const usable = (item) => item && !item.locked && !item.draft;
    const chosen = (Array.isArray(s.kickstartPrompts) ? s.kickstartPrompts : []).map((id) => c.promptById.get(id)).filter(usable);
    let prompts = chosen.slice(0, PROMPTS);
    const nowPhases = ns.compass && ns.app ? ns.compass.nowPhases(ns.app.config()).map((entry) => entry.phase) : [];
    if (!prompts.length) {
      const rank = (p) => (nowPhases.includes(p.phase) ? 0 : 2) + (ns.tijdwinst.itemOf(p.id) ? 0 : 1);
      const seen = new Set();
      prompts = c.prompts
        .filter((p) => usable(p) && (!p.usecase || p.step === 1))
        .map((p, index) => ({ p, index }))
        .sort((a, b) => rank(a.p) - rank(b.p) || a.index - b.index)
        .map((entry) => entry.p)
        .filter((p) => {
          const group = p.usecase ? 'u:' + p.usecase.id : 'p:' + p.id;
          if (seen.has(group)) return false;
          seen.add(group);
          return true;
        })
        .slice(0, PROMPTS);
    }
    const ownUsecase = (Array.isArray(s.kickstartUsecase) ? s.kickstartUsecase : []).map((id) => c.usecaseById.get(id)).find(usable);
    const usecase = ownUsecase
      || c.usecases.find((u) => usable(u) && u.hasDemo && nowPhases.includes(u.phase))
      || c.usecases.find((u) => usable(u) && u.featured)
      || c.usecases.find(usable)
      || null;
    return { prompts, usecase };
  }

  /* ---- Je voortgang (alleen op dit apparaat) ------------------------------------------------ */
  function read() {
    const value = storage.get(KEY, null) || {};
    return {
      started: text(value.started),
      prompts: Array.isArray(value.prompts) ? value.prompts.map(String).slice(0, 50) : [],
      usecase: text(value.usecase),
      policy: value.policy === true,
      hidden: value.hidden === true,
      done: text(value.done)
    };
  }

  function write(state) {
    storage.set(KEY, state);
    document.dispatchEvent(new CustomEvent(EVENT));
  }

  function update(change) {
    const state = Object.assign(read(), change);
    write(state);
    return state;
  }

  /** De rondleiding en de check 'Veilig vliegen' (ook als je die deed voordat je startte). */
  function signals() {
    const brevet = ns.brevet && ns.brevet.state ? ns.brevet.state().result : null;
    return {
      tour: Boolean(ns.tour && ns.tour.seen && ns.tour.seen()),
      policy: Boolean(brevet && brevet.stats && brevet.stats.policy)
    };
  }

  /**
   * De stappen met wat al gedaan is: { steps: [{ id, label, done, have, need }], done, total, complete, day }.
   * day: dag zoveel van de veertien (0 = nog niet gestart).
   */
  function progress(state, set, signal, day) {
    const sig = signal || {};
    const used = set.prompts.filter((p) => state.prompts.includes(p.id)).length;
    const need = Math.min(NEED, set.prompts.length);
    const steps = [
      { id: 'tour', label: 'Rondleiding door de cockpit', done: Boolean(sig.tour) },
      { id: 'policy', label: 'Check "Veilig vliegen" gehaald', done: state.policy || Boolean(sig.policy) },
      need ? { id: 'prompts', label: need === 1 ? 'Een startprompt gebruikt' : `${need} startprompts gebruikt`, done: used >= need, have: Math.min(used, need), need } : null,
      set.usecase ? { id: 'usecase', label: 'De usecase bekeken', done: state.usecase === set.usecase.id } : null
    ].filter(Boolean);
    const done = steps.filter((step) => step.done).length;
    let dayNumber = 0;
    if (state.started) {
      const from = Date.parse(state.started + 'T12:00:00Z');
      const to = Date.parse((day || today()) + 'T12:00:00Z');
      dayNumber = Math.max(1, Math.round((to - from) / 86400000) + 1);
    }
    return { steps, done, total: steps.length, complete: steps.length > 0 && done === steps.length, day: dayNumber };
  }

  /** Klaar: één keer vastleggen, met AI-miles als je meedoet met de AI-brevetten. */
  function finish(state) {
    if (state.done) return;
    update({ done: today() });
    if (ns.brevet && ns.brevet.record) ns.brevet.record('kickstart_done', '');
    toast('Kickstart afgerond. Goed bezig!', { tone: 'success' });
  }

  /* ---- De kaart --------------------------------------------------------------------------- */
  const milesFor = () => {
    if (!ns.brevet || !ns.brevet.enabled || !ns.brevet.enabled()) return 0;
    const rules = ns.brevet.rules();
    return (rules.miles && rules.miles.kickstart_done) || 0;
  };

  function promptRow(prompt, used) {
    return el('li', { className: 'ks-prompt' + (used ? ' is-done' : '') }, [
      el('span', { className: 'ks-prompt__mark', attrs: { 'aria-hidden': 'true' } }, [icon(used ? 'check' : 'chat')]),
      el('a', { className: 'ks-prompt__title', attrs: { href: ns.kinds.href('prompt', prompt.id) }, text: prompt.usecase ? prompt.usecase.title : prompt.title }),
      used ? el('span', { className: 'sr-only', text: ' (gebruikt)' }) : null,
      ns.tijdwinst.chip(prompt.usecase || prompt, { usecase: Boolean(prompt.usecase) })
    ]);
  }

  /** Wat je krijgt: de startprompts, een prompt op maat en de AI-miles. */
  function extras(set, state) {
    const miles = milesFor();
    const ask = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' }, on: { click: () => ns.ideas.quick({ kind: 'verzoek' }) } }, [icon('flag'), el('span', { text: 'Vraag hem aan' })]);
    const promise = ns.promises.get('prompt');
    return el('div', { className: 'ks-extras' }, [
      el('h3', { className: 'ks-extras__title' }, [icon('gift'), el('span', { text: 'Hoort erbij' })]),
      set.prompts.length ? el('div', { className: 'ks-extra' }, [
        el('p', { className: 'ks-extra__name', text: set.prompts.length === 1 ? 'Je startprompt' : `Je ${set.prompts.length} startprompts` }),
        el('ul', { className: 'ks-prompts', attrs: { role: 'list' } }, set.prompts.map((p) => promptRow(p, state.prompts.includes(p.id))))
      ]) : null,
      promise ? el('div', { className: 'ks-extra' }, [
        el('p', { className: 'ks-extra__name', text: 'Staat jouw taak er niet bij?' }),
        el('p', { className: 'ks-extra__text', text: promise.text + ', van het AI-team.' }),
        ask
      ]) : null,
      miles ? el('div', { className: 'ks-extra' }, [
        el('p', { className: 'ks-extra__name', text: `+${miles} AI-miles` }),
        el('p', { className: 'ks-extra__text', text: 'Bij afronden, als je meedoet met de AI-brevetten.' })
      ]) : null
    ]);
  }

  /** De knop bij een stap die nog open staat. */
  function stepAction(step, set) {
    const button = (label, iconName, run) => el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: run } }, [icon(iconName), el('span', { text: label })]);
    if (step.id === 'tour') return button('Start de rondleiding', 'compass', () => ns.tour.restart());
    if (step.id === 'policy') return button('Doe de check', 'shield', () => ns.brevetUi.policyCheck());
    if (step.id === 'usecase') return el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: ns.kinds.href('usecase', set.usecase.id) } }, [icon('play-circle'), el('span', { text: set.usecase.title })]);
    return null;
  }

  /** De balk: je tijdwinst deze week, op weg naar je eerste uur. */
  function goalBar() {
    const week = ns.tijdwinst.mine().week;
    const share = Math.min(1, week / GOAL);
    const fill = el('span', { className: 'ks-goal__fill' });
    fill.style.setProperty('--ks-goal', String(share));
    return el('div', { className: 'ks-goal' }, [
      el('p', { className: 'ks-goal__text' }, week >= GOAL
        ? [el('strong', { text: `Deze week ${ns.tijdwinst.format(week)} terug.` }), ' Je eerste uur is binnen.']
        : [el('strong', { text: `Deze week terug: ${ns.tijdwinst.format(week)}` }), ` van je eerste uur (schatting)`]),
      el('span', { className: 'ks-goal__bar', attrs: { role: 'progressbar', 'aria-label': 'Tijdwinst deze week', 'aria-valuemin': '0', 'aria-valuemax': String(GOAL), 'aria-valuenow': String(Math.min(week, GOAL)) } }, [fill])
    ]);
  }

  /** Nog niet gestart: kort wat het is en wat je krijgt. */
  function intro(about, set, node) {
    const start = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('plane'), el('span', { text: 'Start mijn Kickstart' })]);
    const later = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [el('span', { text: 'Niet voor mij' })]);
    start.addEventListener('click', () => {
      update({ started: today(), hidden: false });
      const title = node.querySelector('.ks__title');
      if (title) title.focus({ preventScroll: true });
    });
    later.addEventListener('click', () => {
      update({ hidden: true });
      toast('Verborgen. Je vindt de Kickstart terug in Mijn logboek.');
    });
    const minutesTotal = set.prompts.reduce((sum, p) => sum + ((p.usecase || p).saves || 0), 0);
    return [
      el('ul', { className: 'ks-points', attrs: { role: 'list' } }, [
        el('li', {}, [icon('check'), el('span', { text: set.prompts.length ? `${set.prompts.length} startprompts voor wat nu speelt` + (minutesTotal ? `, samen ±${ns.tijdwinst.format(minutesTotal)} per keer` : '') : 'Startprompts voor wat nu speelt' })]),
        el('li', {}, [icon('check'), el('span', { text: 'Vier stappen, een paar minuten per dag' })]),
        ns.promises.get('prompt') ? el('li', {}, [icon('check'), el('span', { text: ns.promises.get('prompt').text + ' als jouw taak er niet bij staat' })]) : null
      ]),
      el('div', { className: 'ks__actions' }, [start, later])
    ];
  }

  /** Gestart: de stappen, wat erbij hoort en je tijdwinst. */
  function route(state, set, now) {
    const steps = el('ol', { className: 'ks-steps', attrs: { role: 'list' } }, now.steps.map((step) => el('li', { className: 'ks-step' + (step.done ? ' is-done' : '') }, [
      el('span', { className: 'ks-step__mark', attrs: { 'aria-hidden': 'true' } }, [step.done ? icon('check') : null]),
      el('span', { className: 'ks-step__label' }, [
        step.label,
        step.need ? el('span', { className: 'ks-step__count', text: ` ${step.have}/${step.need}` }) : null,
        el('span', { className: 'sr-only', text: step.done ? ' (gedaan)' : ' (nog te doen)' })
      ]),
      step.done ? null : stepAction(step, set)
    ])));
    return [el('div', { className: 'ks__body' }, [el('div', { className: 'ks__route' }, [steps, goalBar()]), extras(set, state)])];
  }

  /**
   * De kaart. options.place: 'home' (verborgen als je hem wegklikte) of 'mijn' (altijd, met
   * 'weer tonen'). Geeft { node, destroy }; de kaart werkt zichzelf bij.
   */
  function card(options) {
    const place = (options && options.place) || 'home';
    const node = el('section', { className: 'ks section container', attrs: { 'aria-labelledby': 'ks-title-' + place } });
    function render() {
      const about = info();
      const state = read();
      const set = startSet();
      if (!about.on || !set.prompts.length || (place === 'home' && state.hidden)) {
        node.hidden = true;
        node.replaceChildren();
        return;
      }
      node.hidden = false;
      const now = progress(state, set, signals());
      if (state.started && now.complete && !state.done) {
        finish(state);
        return; // finish schrijft; dat bouwt de kaart opnieuw op
      }
      const hide = el('button', { className: 'btn btn--quiet btn--sm ks__hide', attrs: { type: 'button' } }, [el('span', { text: 'Verbergen' })]);
      hide.addEventListener('click', () => update({ hidden: true }));
      const show = el('button', { className: 'btn btn--quiet btn--sm ks__hide', attrs: { type: 'button' } }, [el('span', { text: 'Weer tonen op de startpagina' })]);
      show.addEventListener('click', () => update({ hidden: false }));
      const status = state.done
        ? el('p', { className: 'ks__status is-done' }, [icon('check-circle'), el('span', { text: 'Afgerond' })])
        : state.started
          ? el('p', { className: 'ks__status' }, [el('span', { text: now.day <= DAYS ? `Dag ${now.day} van ${DAYS}` : 'Je veertien dagen zijn om: maak hem gewoon af' }), el('span', { className: 'ks__status-count', text: ` · ${now.done} van ${now.total} stappen` })])
          : null;
      node.replaceChildren(el('div', { className: 'ks__panel' + (state.done ? ' is-done' : '') }, [
        el('div', { className: 'ks__head' }, [
          el('span', { className: 'ks__icon', attrs: { 'aria-hidden': 'true' } }, [icon(state.done ? 'check-circle' : 'plane')]),
          el('div', { className: 'ks__heading' }, [
            el('p', { className: 'ks__eyebrow', text: 'Kickstart' }),
            el('h2', { className: 'ks__title', attrs: { id: 'ks-title-' + place, tabindex: '-1' }, text: about.title }),
            el('p', { className: 'ks__lead', text: about.lead })
          ]),
          status,
          state.started || state.done ? (state.hidden ? show : hide) : null
        ]),
        ...(state.started || state.done ? route(state, set, now) : intro(about, set, node))
      ]));
    }
    render();
    const handler = () => render();
    document.addEventListener(EVENT, handler);
    const stopTime = ns.tijdwinst.onChange(handler);
    const stopBrevet = ns.brevet && ns.brevet.onChange ? ns.brevet.onChange(handler) : () => {};
    return {
      node,
      destroy: () => {
        document.removeEventListener(EVENT, handler);
        stopTime();
        stopBrevet();
      }
    };
  }

  /* ---- Signalen uit de rest van de cockpit -------------------------------------------------- */
  let started = false;
  function init() {
    if (started) return;
    started = true;
    document.addEventListener('ai:track', (event) => {
      const { kind, id } = event.detail || {};
      if (kind !== 'copy_prompt' && kind !== 'view_usecase') return;
      const set = startSet();
      const state = read();
      if (kind === 'copy_prompt' && set.prompts.some((p) => p.id === id) && !state.prompts.includes(id)) update({ prompts: state.prompts.concat(id) });
      if (kind === 'view_usecase' && set.usecase && set.usecase.id === id && state.usecase !== id) update({ usecase: id });
    });
    document.addEventListener('ai:veilig-vliegen', () => {
      if (!read().policy) update({ policy: true });
    });
  }

  ns.kickstart = { info, startSet, read, progress, card, init, DAYS, GOAL, NEED, PROMPTS, DEFAULT_TITLE, DEFAULT_LEAD };
})(window.AIAudit);
