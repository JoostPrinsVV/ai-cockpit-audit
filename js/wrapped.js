/* ==========================================================================
   Cockpit Wrapped (#/wrapped)
   --------------------------------------------------------------------------
   Het jaar van de discipline in de cockpit, en jouw eigen jaar.
   - Het jaar van de discipline is een momentopname die het AI-team maakt
     in Beheer → Wrapped: periode en naam, de cijfers uit de anonieme
     tellers, een paar hoogtepunten. Pas na publiceren zien collega's hem;
     een concept zien alleen beheerders. Geen namen van collega's.
   - Jouw jaar rekent deze module in je eigen browser uit: wat je kopieerde
     en bekeek (vanaf nu bijgehouden onder 'mijn-jaar', alleen op dit
     apparaat) en je tijdwinst (js/tijdwinst.js). Er gaat niets naar het
     AI-team.
   - Op de startpagina een aankondiging zolang Wrapped er is (tot de datum
     'Op de startpagina tot' uit Beheer).
   De meest gebruikte items staan als id in de momentopname: de titel komt
   uit de inhoud van nu, zodat hij ook in het Engels klopt.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage } = ns.ui;
  const LOG_KEY = 'mijn-jaar';
  const KEEP_MONTHS = 14; // zoveel maanden bewaren (een jaar plus wat speling)
  const KEEP_ITEMS = 200; // per maand hoogstens zoveel items
  // Wat telt voor jouw jaar (dezelfde soorten als de anonieme tellers, js/central.js)
  const KINDS = ['copy_prompt', 'copy_tip', 'view_usecase', 'play_demo', 'view_tip', 'view_training', 'play_training', 'view_agent', 'open_agent'];
  const VIEWS = ['view_usecase', 'view_tip', 'view_training', 'view_agent'];
  // De schermen, in deze volgorde; Beheer kan ze per stuk uitzetten
  const SCREENS = ['totals', 'saved', 'top', 'months', 'fresh', 'ideas', 'highlights', 'mine'];
  const SAVED_FROM = 300; // tijdwinst pas vanaf 5 uur (zoals op de startpagina)
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const count = (value) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const today = () => (ns.content && ns.content.today ? ns.content.today() : new Date().toISOString().slice(0, 10));
  const number = (n) => new Intl.NumberFormat(ns.i18n ? ns.i18n.locale() : 'nl-NL').format(n);

  /* ---- Jouw jaar: bijhouden in deze browser -------------------------------------------- */
  function emptyLog() {
    return { v: 1, days: {}, months: {} };
  }

  function readLog() {
    const value = storage.get(LOG_KEY, null);
    if (!value || typeof value !== 'object' || !value.days || !value.months) return emptyLog();
    return value;
  }

  /** Eén keer iets gedaan: bij de dag (per soort) en bij de maand (per item). Geeft het logboek terug. */
  function record(log, kind, id, day) {
    if (!KINDS.includes(kind) || !DATE.test(day || '')) return log;
    const next = log && log.days && log.months ? log : emptyLog();
    const dayEntry = next.days[day] || (next.days[day] = {});
    dayEntry[kind] = (dayEntry[kind] || 0) + 1;
    if (id) {
      const month = day.slice(0, 7);
      const items = next.months[month] || (next.months[month] = {});
      const key = kind + ':' + String(id).slice(0, 80);
      if (items[key] || Object.keys(items).length < KEEP_ITEMS) items[key] = (items[key] || 0) + 1;
    }
    // Opruimen: alleen de laatste maanden
    const months = Object.keys(next.months).sort();
    const cut = months.length > KEEP_MONTHS ? months[months.length - KEEP_MONTHS] : '';
    if (cut) {
      Object.keys(next.months).forEach((m) => { if (m < cut) delete next.months[m]; });
      Object.keys(next.days).forEach((d) => { if (d.slice(0, 7) < cut) delete next.days[d]; });
    }
    return next;
  }

  /**
   * Jouw jaar binnen een periode ({ from, to }): uit je logboek (log) en je tijdwinst (saved: de 'ja's uit
   * js/tijdwinst.js). Geeft { copies, views, demos, days, prompt, usecase, phase, saved, any }.
   */
  function mine(period, log, saved) {
    const inPeriod = (day) => DATE.test(day || '') && day >= period.from && day <= period.to;
    const result = { copies: 0, views: 0, demos: 0, days: 0, prompt: null, usecase: null, phase: null, saved: { minutes: 0, count: 0 }, any: false };
    const source = log && log.days ? log : emptyLog();
    Object.keys(source.days).filter(inPeriod).forEach((day) => {
      const entry = source.days[day] || {};
      result.days += 1;
      result.copies += count(entry.copy_prompt) + count(entry.copy_tip);
      result.views += VIEWS.reduce((total, kind) => total + count(entry[kind]), 0);
      result.demos += count(entry.play_demo);
    });
    // Items: per maand bijgehouden, dus op maandniveau binnen de periode
    const items = {};
    Object.keys(source.months || {}).filter((m) => m >= period.from.slice(0, 7) && m <= period.to.slice(0, 7)).forEach((m) => {
      Object.entries(source.months[m] || {}).forEach(([key, n]) => { items[key] = (items[key] || 0) + count(n); });
    });
    const c = ns.content || {};
    const best = (prefix, map) => Object.entries(items)
      .filter(([key]) => key.startsWith(prefix) && map && map.get(key.slice(prefix.length)))
      .sort((a, b) => b[1] - a[1])[0];
    const prompt = best('copy_prompt:', c.promptById);
    if (prompt) result.prompt = { item: c.promptById.get(prompt[0].slice(12)), n: prompt[1] };
    const usecase = best('view_usecase:', c.usecaseById);
    if (usecase) result.usecase = { item: c.usecaseById.get(usecase[0].slice(13)), n: usecase[1] };
    // Je fase: waar de prompts die je kopieerde bij horen
    const phases = new Map();
    Object.entries(items).filter(([key]) => key.startsWith('copy_prompt:')).forEach(([key, n]) => {
      const item = c.promptById && c.promptById.get(key.slice(12));
      if (item && item.phase) phases.set(item.phase.id, { phase: item.phase, n: ((phases.get(item.phase.id) || {}).n || 0) + n });
    });
    result.phase = Array.from(phases.values()).sort((a, b) => b.n - a.n)[0] || null;
    (Array.isArray(saved) ? saved : []).filter((entry) => entry && inPeriod(entry.day)).forEach((entry) => {
      const minutes = ns.tijdwinst ? ns.tijdwinst.minutes(entry.minutes) : count(entry.minutes);
      if (!minutes) return;
      result.saved.minutes += minutes;
      result.saved.count += 1;
    });
    result.any = result.copies + result.views + result.demos + result.saved.count > 0;
    return result;
  }

  /* ---- De momentopname van de discipline ------------------------------------------------ */
  const pairs = (value) => (Array.isArray(value) ? value : [])
    .filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string')
    .map(([id, n]) => [id, count(n)])
    .filter(([, n]) => n > 0);

  /** De instelling uit Beheer, opgeschoond. null als er niets (bruikbaars) is. */
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const from = DATE.test(text(raw.from)) ? text(raw.from) : '';
    const to = DATE.test(text(raw.to)) ? text(raw.to) : '';
    if (!from || !to || from > to) return null;
    const s = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
    const totals = s.totals || {};
    const fresh = s.fresh || {};
    const ideas = s.ideas || {};
    const top = s.top || {};
    return {
      title: text(raw.title) || 'Cockpit Wrapped',
      from,
      to,
      until: DATE.test(text(raw.until)) ? text(raw.until) : '',
      intro: text(raw.intro),
      closing: text(raw.closing),
      highlights: (Array.isArray(raw.highlights) ? raw.highlights : [])
        .map((h) => ({ title: text(h && h.title), text: text(h && h.text) }))
        .filter((h) => h.title || h.text)
        .slice(0, 6),
      off: (Array.isArray(raw.off) ? raw.off : []).filter((id) => SCREENS.includes(id)),
      draft: raw._draft === true,
      stats: {
        computedAt: text(s.computedAt),
        totals: { copies: count(totals.copies), views: count(totals.views), demos: count(totals.demos), trainings: count(totals.trainings), agents: count(totals.agents) },
        saved: { taps: count(s.saved && s.saved.taps), minutes: count(s.saved && s.saved.minutes) },
        top: { prompt: pairs(top.prompt), usecase: pairs(top.usecase), tip: pairs(top.tip), training: pairs(top.training) },
        // Ook maanden zonder gebruik: de grafiek loopt over de hele periode
        months: (Array.isArray(s.months) ? s.months : []).filter((entry) => Array.isArray(entry) && /^\d{4}-\d{2}$/.test(entry[0])).map(([m, n]) => [m, count(n)]),
        fresh: { usecase: count(fresh.usecase), prompt: count(fresh.prompt), tip: count(fresh.tip), training: count(fresh.training), agent: count(fresh.agent) },
        ideas: { submitted: count(ideas.submitted), answered: count(ideas.answered), realised: count(ideas.realised), flyins: count(ideas.flyins) }
      }
    };
  }

  /** Wrapped van deze cockpit (al in de taal van nu), of null. */
  const current = () => normalize(ns.content && ns.content.wrapped);

  /** Welke schermen er iets te laten zien hebben (en niet uitgezet zijn in Beheer). */
  function screensFor(w, personal) {
    const s = w.stats;
    const has = {
      totals: s.totals.copies + s.totals.views + s.totals.demos > 0,
      saved: s.saved.minutes >= SAVED_FROM,
      top: s.top.prompt.length + s.top.usecase.length + s.top.tip.length + s.top.training.length > 0,
      months: s.months.filter(([, n]) => n > 0).length >= 2,
      fresh: Object.values(s.fresh).some((n) => n > 0),
      ideas: s.ideas.submitted + s.ideas.flyins > 0,
      highlights: w.highlights.length > 0,
      mine: true // ook zonder eigen gegevens: dan een uitleg
    };
    return SCREENS.filter((id) => has[id] && !w.off.includes(id) && (id !== 'mine' || personal !== false));
  }

  /** Aan te kondigen op de startpagina? Gepubliceerd (of een concept voor beheerders) en niet voorbij 'tot'. */
  function showOnHome(w, day) {
    return Boolean(w) && (!w.until || (day || today()) <= w.until);
  }

  /* ---- Opbouw --------------------------------------------------------------------------- */
  const longDate = (value) => new Date(value + 'T12:00:00').toLocaleDateString(ns.i18n ? ns.i18n.locale() : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  const monthName = (ym) => (ns.i18n ? ns.i18n.month(Number(ym.slice(5, 7)) - 1) : ym) + ' ' + ym.slice(0, 4);

  function screen(id, eyebrow, children, extra) {
    const titleId = 'wr-' + id;
    return el('section', { className: 'wr-screen wr-screen--' + id + (extra ? ' ' + extra : ''), attrs: { 'aria-labelledby': titleId } }, [
      el('p', { className: 'wr-screen__eyebrow', attrs: { id: titleId }, text: eyebrow })
    ].concat(children));
  }

  const big = (value, caption) => el('div', { className: 'wr-big' }, [
    // Een getal of een maand (al in de taal van nu): niet door de vertaling (js/i18n.js)
    el('p', { className: 'wr-big__number', attrs: { translate: 'no' }, text: value }),
    el('p', { className: 'wr-big__caption', text: caption })
  ]);

  /** Een rij kleine cijfers: [[getal, tekst], …], tekst eventueel [enkelvoud, meervoud] (nul laten we weg). */
  const facts = (list) => {
    const shown = list.filter(([n]) => n > 0);
    return shown.length ? el('ul', { className: 'wr-facts', attrs: { role: 'list' } }, shown.map(([n, label]) => el('li', { className: 'wr-fact' }, [
      el('strong', { className: 'wr-fact__number', text: number(n) }),
      el('span', { className: 'wr-fact__label', text: Array.isArray(label) ? label[n === 1 ? 0 : 1] : label })
    ]))) : null;
  };

  /** Een item uit de momentopname, met de titel van nu (of niets als het er niet meer is). */
  function itemLink(type, id) {
    const item = ns.kinds.item(type, id);
    if (!item) return null;
    return { item, href: ns.kinds.href(type, id), title: item.usecase ? item.usecase.title + ' · ' + item.title : item.title };
  }

  function topScreen(s) {
    const prompts = s.top.prompt.map(([id, n]) => ({ link: itemLink('prompt', id), n })).filter((entry) => entry.link).slice(0, 5);
    const single = [
      ['usecase', s.top.usecase, 'Meest bekeken usecase', 'bekeken'],
      ['tip', s.top.tip, 'Populairste tip', 'bekeken'],
      ['training', s.top.training, 'Meest bekeken training', 'bekeken']
    ].map(([type, list, label]) => {
      const first = list.map(([id, n]) => ({ link: itemLink(type, id), n })).find((entry) => entry.link);
      return first ? el('li', { className: 'wr-pick' }, [
        el('span', { className: 'wr-pick__label', text: label }),
        el('a', { className: 'wr-pick__title', attrs: { href: first.link.href }, text: first.link.title })
      ]) : null;
    }).filter(Boolean);
    if (!prompts.length && !single.length) return null;
    return screen('top', 'Het meest gebruikt', [
      prompts.length ? el('h2', { className: 'wr-screen__title', text: 'De top 5 prompts' }) : null,
      prompts.length ? el('ol', { className: 'wr-rank' }, prompts.map((entry, index) => el('li', { className: 'wr-rank__item' }, [
        el('span', { className: 'wr-rank__place', attrs: { 'aria-hidden': 'true' }, text: String(index + 1) }),
        el('a', { className: 'wr-rank__title', attrs: { href: entry.link.href }, text: entry.link.title }),
        el('span', { className: 'wr-rank__count' }, [el('strong', { attrs: { translate: 'no' }, text: number(entry.n) + '×' }), ' ', el('span', { text: 'gekopieerd' })])
      ]))) : null,
      single.length ? el('ul', { className: 'wr-picks', attrs: { role: 'list' } }, single) : null
    ].filter(Boolean));
  }

  function monthsScreen(s) {
    const list = s.months;
    const max = Math.max(...list.map(([, n]) => n));
    const busiest = list.find(([, n]) => n === max);
    return screen('months', 'Door het jaar heen', [
      big(monthName(busiest[0]), 'was de drukste maand in de cockpit'),
      el('div', { className: 'wr-chart', attrs: { role: 'img', translate: 'no', 'aria-label': list.map(([m, n]) => monthName(m) + ': ' + number(n)).join(', ') } }, list.map(([m, n]) => {
        const bar = el('span', { className: 'wr-chart__bar' + (m === busiest[0] ? ' is-top' : '') });
        // Een maand zonder gebruik: alleen een dun streepje
        bar.style.setProperty('--h', (n ? Math.max(4, Math.round((n / max) * 100)) : 1) + '%');
        return el('span', { className: 'wr-chart__col' }, [bar, el('span', { className: 'wr-chart__label', attrs: { 'aria-hidden': 'true' }, text: ns.i18n ? ns.i18n.month(Number(m.slice(5, 7)) - 1, 'short').replace('.', '') : m.slice(5) })]);
      }))
    ]);
  }

  /** Jouw jaar als tekst om te delen (Teams, mail); in de taal van nu. */
  function shareText(w, me) {
    const english = ns.i18n && ns.i18n.english();
    const discipline = ns.cockpit ? ns.cockpit.active().name : '';
    const saved = me.saved.minutes ? ns.tijdwinst.format(me.saved.minutes) : '';
    const config = ns.app && ns.app.config ? ns.app.config() : {};
    const link = String(config.siteUrl || (window.location.origin + window.location.pathname)).replace(/[?#].*$/, '') + '#/wrapped';
    return english
      ? `My ${w.title} in the AI cockpit ${discipline}: ${me.copies} prompts copied${saved ? `, about ${saved} saved` : ''}. Have a look: ${link}`
      : `Mijn ${w.title} in de AI-cockpit ${discipline}: ${me.copies} prompts gekopieerd${saved ? `, ±${saved} tijd bespaard` : ''}. Kijk zelf: ${link}`;
  }

  function mineScreen(w) {
    const me = mine({ from: w.from, to: w.to }, readLog(), readSaved());
    if (!me.any) {
      return screen('mine', 'Jouw jaar', [
        el('h2', { className: 'wr-screen__title', text: 'Nog geen eigen jaar op dit apparaat' }),
        el('p', { className: 'wr-screen__text', text: 'Jouw jaar houdt de cockpit alleen in je eigen browser bij, vanaf het moment dat je hem gebruikt. Kopieer een prompt of bekijk een usecase, dan staat het er volgende keer.' })
      ], 'wr-screen--personal');
    }
    const lines = [
      me.prompt ? el('li', { className: 'wr-pick' }, [el('span', { className: 'wr-pick__label', text: 'Jouw meest gebruikte prompt' }), el('a', { className: 'wr-pick__title', attrs: { href: ns.kinds.href('prompt', me.prompt.item.id) }, text: me.prompt.item.title })]) : null,
      me.usecase ? el('li', { className: 'wr-pick' }, [el('span', { className: 'wr-pick__label', text: 'Jouw meest bekeken usecase' }), el('a', { className: 'wr-pick__title', attrs: { href: ns.kinds.href('usecase', me.usecase.item.id) }, text: me.usecase.item.title })]) : null,
      me.phase ? el('li', { className: 'wr-pick' }, [el('span', { className: 'wr-pick__label', text: 'Jouw fase' }), el('span', { className: 'wr-pick__title', text: me.phase.phase.label })]) : null
    ].filter(Boolean);
    const copy = ns.ui.copyButton(() => shareText(w, me), { label: 'Kopieer je jaar als tekst', className: 'btn--secondary btn--sm' });
    return screen('mine', 'Jouw jaar', [
      big(number(me.copies), me.copies === 1 ? 'prompt of tip kopieerde jij' : 'prompts en tips kopieerde jij'),
      facts([
        [Math.round(me.saved.minutes / 60), 'uur tijd bespaard (jouw eigen "Ja, dat scheelde tijd")'],
        [me.views, 'keer iets bekeken'],
        [me.demos, ['demo afgespeeld', 'demo\'s afgespeeld']],
        [me.days, ['dag in de cockpit', 'dagen in de cockpit']]
      ]),
      lines.length ? el('ul', { className: 'wr-picks', attrs: { role: 'list' } }, lines) : null,
      el('div', { className: 'wr-screen__actions' }, [copy]),
      el('p', { className: 'wr-screen__note' }, [icon('shield'), el('span', { text: 'Alleen in jouw browser uitgerekend. Het AI-team ziet dit niet.' })])
    ].filter(Boolean), 'wr-screen--personal');
  }

  /** Alle schermen van Wrapped. */
  function screens(w) {
    const s = w.stats;
    const discipline = ns.cockpit ? ns.cockpit.active().name : '';
    const out = [];
    out.push(el('section', { className: 'wr-screen wr-screen--intro', attrs: { 'aria-labelledby': 'wr-title' } }, [
      el('p', { className: 'wr-screen__eyebrow', text: 'AI-cockpit ' + discipline }),
      el('h1', { className: 'wr-intro__title', attrs: { id: 'wr-title', tabindex: '-1' }, text: w.title }),
      el('p', { className: 'wr-intro__period', attrs: { translate: 'no' }, text: `${longDate(w.from)} – ${longDate(w.to)}` }),
      w.intro ? el('p', { className: 'wr-intro__text', text: w.intro }) : null,
      w.draft ? el('p', { className: 'wr-intro__draft' }, [icon('pencil-line'), el('span', { text: 'Concept: alleen beheerders zien deze versie' })]) : null
    ].filter(Boolean)));
    screensFor(w).forEach((id) => {
      if (id === 'totals') {
        out.push(screen('totals', 'Samen', [
          big(number(s.totals.copies), 'keer kopieerden collega\'s een prompt of tip'),
          facts([[s.totals.views, 'keer een usecase, tip, training of agent bekeken'], [s.totals.demos, ['demo afgespeeld', 'demo\'s afgespeeld']], [s.totals.trainings, ['training teruggekeken', 'trainingen teruggekeken']], [s.totals.agents, 'keer een agent geopend']])
        ]));
      } else if (id === 'saved') {
        out.push(screen('saved', 'Tijdwinst', [
          big('±' + number(Math.round(s.saved.minutes / 60)), 'uur bespaard, volgens collega\'s zelf'),
          facts([[s.saved.taps, 'keer "Ja, dat scheelde tijd"']]),
          el('p', { className: 'wr-screen__note', text: 'Een schatting: de tijdsindicatie van het AI-team bij iedere keer dat een collega aangaf dat het tijd scheelde.' })
        ]));
      } else if (id === 'top') {
        const node = topScreen(s);
        if (node) out.push(node);
      } else if (id === 'months') {
        out.push(monthsScreen(s));
      } else if (id === 'fresh') {
        out.push(screen('fresh', 'Nieuw in de cockpit', [
          facts([[s.fresh.usecase, ['nieuwe usecase', 'nieuwe usecases']], [s.fresh.prompt, ['nieuwe prompt', 'nieuwe prompts']], [s.fresh.tip, ['nieuwe tip', 'nieuwe tips']], [s.fresh.training, ['training', 'trainingen']], [s.fresh.agent, ['nieuwe agent of tool', 'nieuwe agents en tools']]])
        ], 'wr-screen--grid'));
      } else if (id === 'ideas') {
        out.push(screen('ideas', 'De ideeënhub', [
          big(number(s.ideas.submitted), s.ideas.submitted === 1 ? 'idee, vraag of verzoek van een collega' : 'ideeën, vragen en verzoeken van collega\'s'),
          facts([[s.ideas.answered, 'beantwoord door het AI-team'], [s.ideas.realised, 'werkelijkheid geworden'], [s.ideas.flyins, 'keer de AI-specialist ingevlogen']])
        ]));
      } else if (id === 'highlights') {
        out.push(screen('highlights', 'Hoogtepunten', [
          el('ul', { className: 'wr-highlights', attrs: { role: 'list' } }, w.highlights.map((h) => el('li', { className: 'wr-highlight' }, [
            h.title ? el('h2', { className: 'wr-highlight__title', text: h.title }) : null,
            h.text ? el('p', { className: 'wr-highlight__text', text: h.text }) : null
          ].filter(Boolean))))
        ]));
      } else if (id === 'mine') {
        out.push(mineScreen(w));
      }
    });
    out.push(el('section', { className: 'wr-screen wr-screen--closing', attrs: { 'aria-label': 'Tot slot' } }, [
      w.closing ? el('p', { className: 'wr-closing__text', text: w.closing }) : el('p', { className: 'wr-closing__text', text: 'Op naar het volgende jaar. Heb je een idee of een prompt die goed werkt? De ideeënhub hoort het graag.' }),
      el('div', { className: 'wr-screen__actions' }, [
        el('a', { className: 'btn btn--primary', attrs: { href: '#/ideeen' } }, [icon('message-plus'), el('span', { text: 'Naar de ideeënhub' })]),
        el('a', { className: 'btn btn--secondary', attrs: { href: '#/' } }, [icon('arrow-left'), el('span', { text: 'Naar de startpagina' })])
      ])
    ]));
    return out;
  }

  /** De pagina #/wrapped. */
  function render() {
    const w = current();
    if (!w) {
      return {
        node: el('div', { className: 'page container' }, [
          el('div', { className: 'empty empty--page' }, [
            el('span', { className: 'empty__icon', attrs: { 'aria-hidden': 'true' } }, [icon('sparkle')]),
            el('h1', { className: 'empty__title', text: 'Nog geen Cockpit Wrapped', attrs: { tabindex: '-1' } }),
            el('p', { className: 'empty__text', text: 'Het AI-team maakt Wrapped aan het eind van een jaar of seizoen. Tot die tijd vind je in Mijn logboek wat je al hebt gedaan.' }),
            el('div', { className: 'empty__actions' }, [el('a', { className: 'btn btn--primary', attrs: { href: '#/' } }, [icon('arrow-left'), el('span', { text: 'Naar de startpagina' })])])
          ])
        ]),
        title: 'Cockpit Wrapped'
      };
    }
    return { node: el('div', { className: 'page wrapped' }, [el('div', { className: 'container wrapped__inner' }, screens(w))]), title: w.title };
  }

  /** De aankondiging op de startpagina, of null. */
  function teaser() {
    const w = current();
    if (!showOnHome(w)) return null;
    return el('div', { className: 'container wr-teaser-wrap' }, [
      el('a', { className: 'wr-teaser', attrs: { href: '#/wrapped' } }, [
        el('span', { className: 'wr-teaser__icon', attrs: { 'aria-hidden': 'true' } }, [icon('sparkle')]),
        el('span', { className: 'wr-teaser__body' }, [
          el('span', { className: 'wr-teaser__title', text: w.title }),
          el('span', { className: 'wr-teaser__text', text: 'Wat collega\'s het meest gebruikten, wat het opleverde, en jouw eigen jaar.' })
        ]),
        w.draft ? el('span', { className: 'badge badge--draft', text: 'Concept' }) : null,
        el('span', { className: 'wr-teaser__go' }, [el('span', { text: 'Bekijk Wrapped' }), icon('arrow-right')])
      ].filter(Boolean))
    ]);
  }

  function readSaved() {
    const value = storage.get('tijdwinst', null);
    return value && Array.isArray(value.log) ? value.log : [];
  }

  /** Bij het opstarten: wat je doet, bijhouden voor jouw jaar (alleen in deze browser). */
  function init() {
    document.addEventListener('ai:track', (event) => {
      const detail = event.detail || {};
      storage.set(LOG_KEY, record(readLog(), detail.kind, detail.id, today()));
    });
  }

  ns.wrapped = { SCREENS, KINDS, SAVED_FROM, emptyLog, readLog, record, mine, normalize, current, screensFor, showOnHome, shareText, teaser, init };
  ns.views = ns.views || {};
  ns.views.wrapped = { render };
})(window.AIAudit);
