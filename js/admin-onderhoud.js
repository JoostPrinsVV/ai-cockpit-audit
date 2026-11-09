/* ==========================================================================
   Beheer → Onderhoud: wat ontbreekt er, en wat vraagt aandacht?
   --------------------------------------------------------------------------
   Twee lijsten, voor de discipline die je beheert:
   - Zoekvragen zonder resultaat: wat collega's zochten en niet vonden, de
     afgelopen 180 dagen (anoniem, js/search-gaps.js, stap 17). Per term: hoe
     vaak, wanneer het laatst, en of hij nu wél iets vindt. Maak er een prompt
     van, of wis hem (bijv. als er een klantnaam tussen staat).
   - Inhoud die aandacht vraagt (issues): een testfase die verlopen is, lage
     sterren, vaak 'scheelde geen tijd', open verbetervoorstellen, lang niet
     bekeken of niet bijgewerkt, een training zonder opname. Per punt naar het
     formulier, of 'Gezien' (dan 90 dagen weg, op dit apparaat).
   Alleen voor hoofdbeheerders; Start toont hoeveel er openstaat (startStatus).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate, storage } = ns.ui;
  const DAY = 86400000;
  const SEEN_KEY = 'onderhoud-gezien'; // { <punt>: 'JJJJ-MM-DD' }: weggeklikt, 90 dagen
  const SEEN_DAYS = 90;
  const SEARCH_DAYS = 180;
  const MIN_EVENTS = 100; // pas 'niet bekeken' melden als de tellers echt lopen
  const TYPE_LABEL = { usecase: 'Usecase', prompt: 'Prompt', tip: 'Tip', training: 'Training', agent: 'Agent' };
  const TYPE_ORDER = ['agent', 'usecase', 'prompt', 'tip', 'training'];
  // Welke tellers 'gebruikt' betekenen, per soort
  const USED = {
    usecase: ['view_usecase', 'play_demo'],
    prompt: ['copy_prompt'],
    tip: ['view_tip', 'copy_tip'],
    training: ['view_training', 'play_training'],
    agent: ['view_agent', 'open_agent']
  };

  const shift = (day, days) => new Date(Date.parse(day + 'T12:00:00Z') - days * DAY).toISOString().slice(0, 10);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const comma = (n) => String(n).replace('.', ',');

  /** De zoektermen uit de database, met hoeveel resultaten ze nu vinden: [{ term, count, last, found }]. */
  function terms(rows, search) {
    const find = typeof search === 'function' ? search : () => 0;
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => row && typeof row.term === 'string' && row.term)
      .map((row) => ({ term: row.term, count: Number(row.searches) || 0, last: String(row.last_at || '').slice(0, 10), found: find(row.term) }))
      .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
  }

  /** Hoeveel resultaten een zoekterm nu in de cockpit vindt. */
  function foundNow(term) {
    const found = ns.content.search(term);
    return found.usecases.length + found.prompts.length + found.tips.length + found.trainings.length + found.agents.length;
  }

  /**
   * Wat aandacht vraagt. input: { content (zoals ns.content), events (tellers van 90 dagen), reviews, ideas, rows
   * (ns.content.adminRows), today }. Geeft [{ id, check, type, item, tone: 'warning'|'info', text }], het
   * belangrijkste eerst.
   */
  function issues(input) {
    const c = input.content || {};
    const today = input.today;
    const events = Array.isArray(input.events) ? input.events : [];
    const out = [];
    const maps = { usecase: c.usecaseById, prompt: c.promptById, tip: c.tipById, training: c.trainingById, agent: c.agentById };
    const lookup = (type, id) => (maps[type] && maps[type].get ? maps[type].get(id) : null) || null;
    const live = (item) => Boolean(item) && !item.draft && !item.locked;
    const add = (type, item, check, tone, text) => {
      if (!live(item)) return;
      out.push({ id: `${check}:${type}:${item.id}`, check, type, item, tone, text });
    };
    const list = (name) => (Array.isArray(c[name]) ? c[name] : []);

    // Agents: een testfase die verlopen is, testen zonder criteria, of geen weg naar de agent
    list('agents').forEach((agent) => {
      if (agent.testing && agent.testUntil && agent.testUntil < today) {
        add('agent', agent, 'test-verlopen', 'warning', `De testfase liep tot ${formatDate(agent.testUntil)}. Goed bevonden (en goedgekeurd waar nodig)? Zet hem op Beschikbaar. Anders: verleng de testfase.`);
      }
      if (agent.testing && !(agent.testCriteria || []).length) {
        add('agent', agent, 'test-criteria', 'info', 'In testfase zonder testcriteria: testers krijgen alleen één algemene vraag. Zet erbij waar ze op moeten letten.');
      }
      if (agent.status === 'Beschikbaar' && !agent.link && !agent.access) {
        add('agent', agent, 'toegang', 'info', 'Geen link en geen uitleg hoe je toegang krijgt.');
      }
    });

    // Lage sterren: gemiddeld onder de 3, bij minstens 3 reviews
    const stars = new Map();
    (Array.isArray(input.reviews) ? input.reviews : []).forEach((review) => {
      if (!review || !['usecase', 'prompt'].includes(review.item_type)) return;
      const key = review.item_type + ':' + review.item_id;
      const entry = stars.get(key) || { type: review.item_type, id: review.item_id, sum: 0, n: 0 };
      entry.sum += Number(review.rating) || 0;
      entry.n += 1;
      stars.set(key, entry);
    });
    stars.forEach((entry) => {
      const average = Math.round((entry.sum / entry.n) * 10) / 10;
      if (entry.n >= 3 && average < 3) add(entry.type, lookup(entry.type, entry.id), 'sterren', 'warning', `Gemiddeld ${comma(average)} sterren uit ${entry.n} reviews. Lees de toelichtingen in Reviews.`);
    });

    // Tijdwinst: vaker 'scheelde geen tijd' dan wel (bij minstens 5 keer nee)
    const time = new Map();
    events.forEach((event) => {
      if (event.kind !== 'time_saved' && event.kind !== 'time_none') return;
      const entry = time.get(event.item_id) || { yes: 0, no: 0 };
      if (event.kind === 'time_saved') entry.yes += 1;
      else entry.no += 1;
      time.set(event.item_id, entry);
    });
    time.forEach((entry, key) => {
      const split = String(key).indexOf(':');
      const type = String(key).slice(0, split);
      if (entry.no >= 5 && entry.no > entry.yes) add(type, lookup(type, String(key).slice(split + 1)), 'tijdwinst', 'info', `${entry.no} keer "scheelde geen tijd" en ${entry.yes} keer wel (90 dagen). Kan de prompt beter, of klopt de schatting niet?`);
    });

    // Open verbetervoorstellen per prompt of usecase
    const proposals = new Map();
    (Array.isArray(input.ideas) ? input.ideas : []).forEach((idea) => {
      if (!idea || idea.kind !== 'verbetering' || !idea.target || !['nieuw', 'in-behandeling'].includes(idea.status)) return;
      const key = idea.target.type + ':' + idea.target.id;
      proposals.set(key, (proposals.get(key) || 0) + 1);
    });
    proposals.forEach((n, key) => {
      const split = key.indexOf(':');
      const type = key.slice(0, split);
      add(type, lookup(type, key.slice(split + 1)), 'voorstellen', 'info', `${plural(n, 'verbetervoorstel staat', 'verbetervoorstellen staan')} nog open.`);
    });

    // Niet bekeken of gekopieerd in 90 dagen (alleen als de tellers echt lopen, en niet bij iets nieuws)
    if (events.length >= MIN_EVENTS) {
      const used = new Set(events.map((event) => event.kind + ':' + event.item_id));
      const old = shift(today, 60);
      Object.keys(USED).forEach((type) => {
        const name = { usecase: 'usecases', prompt: 'prompts', tip: 'tips', training: 'trainings', agent: 'agents' }[type];
        list(name).forEach((item) => {
          if (type === 'prompt' && item.usecase) return; // een stap telt bij zijn usecase
          if (type === 'agent' && item.stopped) return;
          if (type === 'training' && (!item.available || (item.date && item.date > old))) return;
          if (!item.added || item.added > old) return;
          if (USED[type].some((kind) => used.has(kind + ':' + item.id))) return;
          add(type, item, 'ongebruikt', 'info', 'Niet bekeken of gekopieerd in de afgelopen 90 dagen. Nog nodig, of beter vindbaar maken (titel, fase, tip van de week)?');
        });
      });
    }

    // Al meer dan een jaar niet bijgewerkt
    const yearAgo = shift(today, 365);
    (Array.isArray(input.rows) ? input.rows : []).forEach((row) => {
      if (!row || row.status !== 'published' || !['usecase', 'prompt', 'tip', 'agent'].includes(row.type)) return;
      const updated = String(row.updated_at || '').slice(0, 10);
      if (!updated || updated >= yearAgo) return;
      add(row.type, lookup(row.type, row.id), 'verouderd', 'info', `Sinds ${formatDate(updated)} niet bijgewerkt. Klopt het nog met hoe Copilot nu werkt?`);
    });

    // Een training die geweest is, zonder opname of naslagwerk
    const twoWeeks = shift(today, 14);
    list('trainings').forEach((training) => {
      if (training.date && training.date < twoWeeks && !training.available) add('training', training, 'opname', 'info', `Was op ${formatDate(training.date)}, maar er staat nog geen opname of naslagwerk bij.`);
    });

    // Eén punt per item en soort; het belangrijkste eerst
    const seen = new Set();
    return out
      .filter((issue) => !seen.has(issue.id) && seen.add(issue.id))
      .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'warning' ? -1 : 1)
        || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
        || String(a.item.title).localeCompare(String(b.item.title), 'nl'));
  }

  /* ---- Weggeklikt ('Gezien') ------------------------------------------------------------------ */
  function seenMap() {
    const all = storage.get(SEEN_KEY, {});
    return all && typeof all === 'object' ? all : {};
  }
  const isSeen = (id, today) => {
    const at = seenMap()[id];
    return typeof at === 'string' && at > shift(today, SEEN_DAYS);
  };
  function markSeen(id, today) {
    const all = seenMap();
    // Oude keren opruimen
    Object.keys(all).forEach((key) => {
      if (!(typeof all[key] === 'string' && all[key] > shift(today, SEEN_DAYS))) delete all[key];
    });
    all[id] = today;
    storage.set(SEEN_KEY, all);
  }

  /* ---- Ophalen -------------------------------------------------------------------------------- */
  async function gather() {
    const today = ns.content.today();
    const [rows, events, reviews, ideas] = await Promise.all([
      ns.central.adminSearchTerms(SEARCH_DAYS).catch((error) => ({ error })),
      ns.central.adminEvents(90).catch(() => []),
      ns.central.adminListReviews().catch(() => []),
      ns.central.adminListIdeas().catch(() => [])
    ]);
    const list = issues({ content: ns.content, events, reviews, ideas, rows: ns.content.adminRows, today });
    return {
      today,
      // null: stap 17 nog niet uitgevoerd; { error }: niet te lezen
      terms: rows && rows.error ? rows : rows === null ? null : terms(rows, foundNow),
      issues: list,
      open: list.filter((issue) => !isSeen(issue.id, today))
    };
  }

  /** Voor Start: { text, due }. */
  async function startStatus() {
    const data = await gather();
    const open = Array.isArray(data.terms) ? data.terms.filter((t) => !t.found).length : 0;
    const parts = [];
    if (open) parts.push(plural(open, 'zoekvraag zonder resultaat', 'zoekvragen zonder resultaat'));
    if (data.open.length) parts.push(plural(data.open.length, 'punt bij de inhoud', 'punten bij de inhoud'));
    return { text: parts.length ? parts.join(' · ') : 'Niets dat aandacht vraagt', due: data.open.some((issue) => issue.tone === 'warning') };
  }

  /* ---- Tekenen ---------------------------------------------------------------------------------- */
  const editHref = (type, item) => {
    const target = type === 'prompt' && item.usecase ? { type: 'usecase', item: item.usecase } : { type, item };
    return `${target.item.shared ? '#/beheer/basis' : '#/beheer/inhoud'}/${target.type}/${target.item.id}`;
  };
  const titleOf = (type, item) => (type === 'prompt' && item.usecase ? item.usecase.title + ' · ' + item.title : item.title);

  function searchSection(data, reload) {
    const head = el('div', { className: 'onderhoud__head' }, [
      el('h2', { className: 'onderhoud__title' }, [icon('search'), el('span', { text: 'Zoekvragen zonder resultaat' })])
    ]);
    const hint = el('p', { className: 'field__hint', text: `Wat collega's zochten en niet vonden, de afgelopen ${SEARCH_DAYS} dagen. Anoniem: geen namen, en cijfers zijn weggelaten (#). Staat er een klantnaam of iets persoonlijks tussen? Wis hem. Na ${SEARCH_DAYS} dagen verdwijnen zoektermen vanzelf.` });
    const section = el('section', { className: 'onderhoud__section', attrs: { 'aria-label': 'Zoekvragen zonder resultaat' } }, [head, hint]);
    if (data.terms === null) {
      section.append(ns.blocks.notice({ tone: 'warning', title: 'Nog niet ingericht', text: 'Voer eenmalig stap 17 uit (setup/supabase-audit-onderhoud.sql). Daarna telt de cockpit wat collega\'s zoeken en niet vinden.' }));
      return section;
    }
    if (data.terms.error) {
      section.append(ns.blocks.notice({ tone: 'warning', title: 'Laden mislukt', text: data.terms.error.message }));
      return section;
    }
    if (!data.terms.length) {
      section.append(el('p', { className: 'section__lead', text: 'Nog geen zoekvragen zonder resultaat. Collega\'s vinden wat ze zoeken, of er is nog niet veel gezocht.' }));
      return section;
    }
    const solved = data.terms.filter((t) => t.found > 0);
    const wipe = async (list, button) => {
      button.disabled = true;
      try {
        for (const t of list) await ns.central.adminDeleteSearchTerm(t.term);
        toast(list.length === 1 ? `"${list[0].term}" gewist` : `${list.length} zoektermen gewist`, { tone: 'success' });
        reload();
      } catch (error) {
        ns.adminKit.failed('Wissen', error);
        button.disabled = false;
      }
    };
    if (solved.length) {
      const bulk = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: `Wis wat nu wel iets vindt (${solved.length})` })]);
      bulk.addEventListener('click', () => wipe(solved, bulk));
      head.append(bulk);
    }
    const shown = data.terms.slice(0, 60);
    const rows = shown.map((t) => {
      const make = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button', title: 'Een nieuwe prompt met deze zoekterm als titel' } }, [icon('plus'), el('span', { text: 'Maak een prompt' })]);
      make.addEventListener('click', () => {
        ns.adminContent.draft('prompt', { title: t.term.charAt(0).toUpperCase() + t.term.slice(1) });
        window.location.hash = '#/beheer/inhoud/prompt/nieuw';
      });
      const remove = el('button', { className: 'btn btn--quiet btn--sm btn--icon', attrs: { type: 'button', 'aria-label': `Zoekterm "${t.term}" wissen`, title: 'Wissen' } }, [icon('trash')]);
      remove.addEventListener('click', () => wipe([t], remove));
      return el('tr', { className: t.found ? 'is-solved' : '' }, [
        el('th', { attrs: { scope: 'row' } }, [
          el('span', { className: 'onderhoud__term', text: t.term }),
          // Vindt hij intussen iets (er is iets bijgekomen)? Dan is hij opgelost
          t.found
            ? el('span', { className: 'status status--success onderhoud__found', text: `Vindt nu ${t.found}` })
            : el('span', { className: 'status status--muted onderhoud__found', text: 'Vindt nog niets' })
        ]),
        el('td', { className: 'num', text: String(t.count) }),
        el('td', { text: t.last ? formatDate(t.last) : '' }),
        el('td', {}, [el('div', { className: 'onderhoud__actions' }, [t.found ? null : make, remove].filter(Boolean))])
      ]);
    });
    section.append(el('div', { className: 'usage-table' }, [el('table', { className: 'table onderhoud__table' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { attrs: { scope: 'col' }, text: 'Zoekterm' }),
        el('th', { className: 'num', attrs: { scope: 'col' }, text: 'Gezocht' }),
        el('th', { attrs: { scope: 'col' }, text: 'Laatst' }),
        el('th', { attrs: { scope: 'col' }, text: '' })
      ])]),
      el('tbody', {}, rows)
    ])]));
    if (data.terms.length > shown.length) section.append(el('p', { className: 'field__hint', text: `De ${shown.length} meest gezochte van ${data.terms.length}.` }));
    return section;
  }

  function issuesSection(data) {
    let showAll = false;
    const body = el('div');
    const toggle = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } });
    toggle.addEventListener('click', () => {
      showAll = !showAll;
      draw();
    });

    function row(issue) {
      const seen = isSeen(issue.id, data.today);
      const gotIt = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', title: `${SEEN_DAYS} dagen niet meer tonen (op dit apparaat)` } }, [icon('check'), el('span', { text: 'Gezien' })]);
      gotIt.addEventListener('click', () => {
        markSeen(issue.id, data.today);
        draw();
      });
      return el('li', { className: 'onderhoud-item is-' + issue.tone + (seen ? ' is-seen' : '') }, [
        el('span', { className: 'onderhoud-item__icon', attrs: { 'aria-hidden': 'true' } }, [icon(issue.tone === 'warning' ? 'alert' : 'info')]),
        el('div', { className: 'onderhoud-item__body' }, [
          el('p', { className: 'onderhoud-item__title' }, [
            el('span', { className: 'onderhoud-item__type', text: TYPE_LABEL[issue.type] || issue.type }),
            el('a', { attrs: { href: editHref(issue.type, issue.item) }, text: titleOf(issue.type, issue.item) }),
            issue.item.shared ? el('span', { className: 'badge', text: 'Gedeelde basis' }) : null
          ]),
          el('p', { className: 'onderhoud-item__text', text: issue.text })
        ]),
        el('div', { className: 'onderhoud-item__actions' }, [
          el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: ns.kinds.href(issue.type === 'prompt' && issue.item.usecase ? 'usecase' : issue.type, issue.type === 'prompt' && issue.item.usecase ? issue.item.usecase.id : issue.item.id), title: 'Bekijk op de site' } }, [icon('eye'), el('span', { text: 'Bekijk' })]),
          seen ? null : gotIt
        ].filter(Boolean))
      ]);
    }

    function draw() {
      const open = data.issues.filter((issue) => !isSeen(issue.id, data.today));
      const hidden = data.issues.length - open.length;
      const list = showAll ? data.issues : open;
      body.replaceChildren(list.length
        ? el('ul', { className: 'onderhoud-list', attrs: { role: 'list' } }, list.map(row))
        : el('p', { className: 'section__lead', text: data.issues.length ? 'Alles bekeken. Mooi.' : 'Niets dat aandacht vraagt.' }));
      toggle.hidden = !hidden;
      toggle.replaceChildren(el('span', { text: showAll ? 'Verberg wat je als gezien markeerde' : `Toon ook wat je als gezien markeerde (${hidden})` }));
    }
    draw();

    return el('section', { className: 'onderhoud__section', attrs: { 'aria-label': 'Inhoud die aandacht vraagt' } }, [
      el('div', { className: 'onderhoud__head' }, [el('h2', { className: 'onderhoud__title' }, [icon('checklist'), el('span', { text: 'Inhoud die aandacht vraagt' })]), toggle]),
      body,
      el('p', { className: 'field__hint', text: 'Wat de cockpit nakijkt: agents in testfase (verlopen, of zonder testcriteria), agents zonder link of uitleg voor toegang, lage sterren (onder de 3 bij minstens 3 reviews), vaker "scheelde geen tijd" dan wel, open verbetervoorstellen, niet bekeken in 90 dagen (zodra de tellers lopen), meer dan een jaar niet bijgewerkt, en trainingen zonder opname of naslagwerk. Links naar buiten controleert de cockpit niet.' })
    ]);
  }

  /** Het onderdeel Onderhoud. Geeft { node }. */
  function render() {
    const node = el('div', { className: 'onderhoud' }, [el('p', { className: 'loading', text: 'Even nakijken…' })]);
    async function load() {
      const data = await gather();
      node.replaceChildren(searchSection(data, load), issuesSection(data));
    }
    load().catch((error) => node.replaceChildren(ns.blocks.notice({ tone: 'warning', title: 'Laden mislukt', text: error.message })));
    return { node };
  }

  ns.adminOnderhoud = { render, startStatus, terms, issues, SEARCH_DAYS };
})(window.AIAudit);
