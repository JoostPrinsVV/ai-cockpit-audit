/* ==========================================================================
   Beheer → Wrapped (#/beheer/wrapped)
   --------------------------------------------------------------------------
   Cockpit Wrapped van de discipline maken (zie js/wrapped.js voor de pagina):
     1. Kies de periode en de naam, bijv. '2026' of 'Seizoen 2026-2027'.
     2. 'Cijfers ophalen': de cockpit telt uit de anonieme tellers en de
        ideeënhub wat er in die periode gebeurde (compute). Nooit namen.
     3. Kijk het na, schrijf een inleiding en hoogtepunten, zet schermen uit
        die niets zeggen, en vul eventueel de Engelse versie in.
     4. Opslaan als concept (alleen beheerders zien hem) of publiceren.
   Opgeslagen als instelling 'wrapped' van de discipline (audit_content);
   geen extra databasestap. Alleen voor hoofdbeheerders.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast } = ns.ui;
  const confirm = (message, options) => ns.ui.confirmDialog(message, options);

  const SCREEN_LABELS = {
    totals: 'Samen: hoe vaak er gekopieerd en bekeken is',
    saved: 'Tijdwinst (alleen vanaf 5 uur)',
    top: 'Het meest gebruikt: top 5 prompts, usecase, tip en training',
    months: 'Door het jaar heen: de drukste maand',
    fresh: 'Nieuw in de cockpit',
    ideas: 'De ideeënhub en invliegen',
    highlights: 'Hoogtepunten van het AI-team',
    mine: 'Jouw jaar (alleen in de browser van de collega)'
  };
  const HIGHLIGHTS = 4;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  /* ---- De cijfers van een periode ---------------------------------------------------------- */
  const day = (value) => String(value || '').slice(0, 10);

  /** De maanden van een periode als 'JJJJ-MM' (hoogstens 24). */
  function monthsOf(from, to) {
    const out = [];
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7));
    const end = to.slice(0, 7);
    while (out.length < 24) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (key > end) break;
      out.push(key);
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  /**
   * Wat er in een periode ({ from, to }) gebeurde, uit de anonieme tellers (events: [{ kind, item_id, occurred_at }]),
   * de ideeënhub (ideas) en de inhoud (content, zoals ns.content). minutesOf(sleutel): de tijdsindicatie van nu bij
   * 'prompt:x' of 'usecase:y' (js/tijdwinst.js). Geen namen, alleen aantallen en id's.
   */
  function compute(period, events, ideas, content, minutesOf) {
    const inPeriod = (value) => {
      const d = day(value);
      return DATE.test(d) && d >= period.from && d <= period.to;
    };
    const list = (Array.isArray(events) ? events : []).filter((event) => event && inPeriod(event.occurred_at));
    const kinds = {};
    const items = {};
    const months = new Map(monthsOf(period.from, period.to).map((m) => [m, 0]));
    list.forEach((event) => {
      kinds[event.kind] = (kinds[event.kind] || 0) + 1;
      const key = event.kind + ':' + event.item_id;
      items[key] = (items[key] || 0) + 1;
      const m = day(event.occurred_at).slice(0, 7);
      if (months.has(m)) months.set(m, months.get(m) + 1);
    });
    const n = (kind) => kinds[kind] || 0;
    // De meest gebruikte items van een soort: [[id, aantal], …], hoogstens tien
    const top = (...prefixes) => {
      const counts = new Map();
      Object.entries(items).forEach(([key, value]) => {
        const prefix = prefixes.find((p) => key.startsWith(p + ':'));
        if (!prefix) return;
        const id = key.slice(prefix.length + 1);
        if (id) counts.set(id, (counts.get(id) || 0) + value);
      });
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 10);
    };
    const minutes = typeof minutesOf === 'function' ? minutesOf : () => 0;
    const saved = list.filter((event) => event.kind === 'time_saved').reduce((total, event) => total + (Number(minutes(event.item_id)) || 0), 0);
    const c = content || {};
    const live = (item) => item && !item.draft;
    const fresh = (items, dateOf) => (Array.isArray(items) ? items : []).filter((item) => live(item) && inPeriod(dateOf(item))).length;
    const allIdeas = Array.isArray(ideas) ? ideas : [];
    return {
      period: { from: period.from, to: period.to },
      computedAt: new Date().toISOString(),
      totals: {
        copies: n('copy_prompt') + n('copy_tip'),
        views: n('view_usecase') + n('view_tip') + n('view_training') + n('view_agent'),
        demos: n('play_demo'),
        trainings: n('play_training'),
        agents: n('open_agent')
      },
      saved: { taps: n('time_saved'), minutes: Math.round(saved) },
      top: {
        prompt: top('copy_prompt'),
        usecase: top('view_usecase', 'play_demo'),
        tip: top('view_tip', 'copy_tip'),
        training: top('view_training', 'play_training')
      },
      months: Array.from(months.entries()),
      fresh: {
        usecase: fresh(c.usecases, (u) => u.added),
        prompt: fresh((c.prompts || []).filter((p) => !p.usecase), (p) => p.added),
        tip: fresh(c.tips, (t) => t.added),
        training: fresh(c.trainings, (t) => t.added || t.date),
        agent: fresh(c.agents, (a) => a.added)
      },
      ideas: {
        submitted: allIdeas.filter((idea) => idea.kind !== 'invliegen' && inPeriod(idea.created_at)).length,
        answered: allIdeas.filter((idea) => idea.kind !== 'invliegen' && idea.answer && inPeriod(idea.answered_at || idea.created_at)).length,
        realised: allIdeas.filter((idea) => idea.status === 'gerealiseerd' && inPeriod(idea.updated_at || idea.created_at)).length,
        flyins: allIdeas.filter((idea) => idea.kind === 'invliegen' && inPeriod(idea.created_at)).length
      },
      events: list.length
    };
  }

  /** Standaard voor een nieuwe Wrapped: het jaar van nu. */
  function defaults(today) {
    const year = Number(String(today).slice(0, 4));
    return {
      title: `Cockpit Wrapped ${year}`,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      until: `${year + 1}-01-31`,
      intro: `Dit was ${year} in de AI-cockpit: wat collega's het meest gebruikten, wat het opleverde en wat er nieuw bij kwam. En onderaan: jouw eigen jaar.`,
      closing: 'Bedankt voor alle prompts, vragen en ideeën. Op naar het volgende jaar: heb je een idee, laat het weten in de ideeënhub.',
      highlights: [],
      off: [],
      stats: null
    };
  }

  /* ---- Het scherm in Beheer ---------------------------------------------------------------- */
  let uid = 0;
  function field(label, input, hint) {
    const id = 'wr-f' + (++uid);
    input.id = id;
    return el('div', { className: 'field' + (input.tagName === 'TEXTAREA' ? ' field--wide' : ' field--half') }, [
      el('label', { className: 'field__label', attrs: { for: id }, text: label }),
      input,
      hint ? el('p', { className: 'field__hint', text: hint }) : null
    ].filter(Boolean));
  }
  const textInput = (value, attrs) => {
    const input = el('input', { className: 'field__input', attrs: Object.assign({ type: 'text', autocomplete: 'off' }, attrs || {}) });
    input.value = value || '';
    return input;
  };
  const textArea = (value, rows, placeholder) => {
    const input = el('textarea', { className: 'field__input field__textarea', attrs: { rows: String(rows || 3), placeholder: placeholder || null } });
    input.value = value || '';
    return input;
  };

  function summary(stats) {
    if (!stats) return el('p', { className: 'field__hint', text: 'Nog geen cijfers. Kies de periode en klik op Cijfers ophalen.' });
    const titleOf = (type, id) => {
      const item = ns.kinds.item(type, id);
      return item ? (item.usecase ? item.usecase.title + ' · ' + item.title : item.title) : id + ' (bestaat niet meer)';
    };
    const t = stats.totals;
    const rows = [
      ['Kopieerden een prompt of tip', t.copies],
      ['Keer iets bekeken', t.views],
      ['Demo\'s afgespeeld', t.demos],
      ['Trainingen teruggekeken', t.trainings],
      ['Agents geopend', t.agents],
      ['"Ja, dat scheelde tijd"', stats.saved.taps],
      ['Tijdwinst (schatting, minuten)', stats.saved.minutes],
      ['Nieuwe usecases / prompts / tips', `${stats.fresh.usecase} / ${stats.fresh.prompt} / ${stats.fresh.tip}`],
      ['Nieuwe trainingen / agents', `${stats.fresh.training} / ${stats.fresh.agent}`],
      ['Ideeën en vragen / beantwoord / gerealiseerd', `${stats.ideas.submitted} / ${stats.ideas.answered} / ${stats.ideas.realised}`],
      ['Keer de AI-specialist ingevlogen', stats.ideas.flyins]
    ];
    const tops = (stats.top.prompt || []).slice(0, 5).map(([id, n]) => el('li', { text: `${titleOf('prompt', id)} (${n}×)` }));
    return el('div', { className: 'wr-admin__summary' }, [
      el('p', { className: 'field__hint', text: `Opgehaald op ${ns.ui.formatDate(day(stats.computedAt))} over ${ns.ui.formatDate(stats.period.from)} t/m ${ns.ui.formatDate(stats.period.to)}: ${stats.events} tellingen.` }),
      el('table', { className: 'table wr-admin__table' }, [el('tbody', {}, rows.map(([label, value]) => el('tr', {}, [el('th', { attrs: { scope: 'row' }, text: label }), el('td', { className: 'num', text: String(value) })])))]),
      tops.length ? el('p', { className: 'field__label', text: 'Top 5 prompts' }) : null,
      tops.length ? el('ol', { className: 'wr-admin__top' }, tops) : null
    ].filter(Boolean));
  }

  function render() {
    const namespace = ns.cockpit.namespace(ns.cockpit.activeId());
    const row = (ns.content.adminRows || []).find((r) => r.namespace === namespace && r.type === 'setting' && r.id === ns.content.WRAPPED_ID && r.status !== 'trash') || null;
    const start = Object.assign(defaults(ns.content.today()), row ? row.data : {});
    let stats = start.stats || null;
    let busy = false;

    const title = textInput(start.title, { maxlength: '80' });
    const from = textInput(start.from, { type: 'date' });
    const to = textInput(start.to, { type: 'date' });
    const until = textInput(start.until, { type: 'date' });
    const intro = textArea(start.intro, 3);
    const closing = textArea(start.closing, 2);
    const highlightInputs = Array.from({ length: HIGHLIGHTS }, (unused, index) => {
      const h = (start.highlights || [])[index] || {};
      return { title: textInput(h.title, { maxlength: '90', placeholder: index === 0 ? 'bijv. De PIM/PAM-agent kwam live' : null }), text: textArea(h.text, 2) };
    });
    const screenBoxes = ns.wrapped.SCREENS.map((id) => {
      const box = el('input', { attrs: { type: 'checkbox', value: id, checked: !(start.off || []).includes(id) } });
      box.id = 'wr-s-' + id;
      return { id, box, node: el('label', { className: 'check check--compact', attrs: { for: box.id } }, [box, el('span', { text: SCREEN_LABELS[id] })]) };
    });

    // Engelse versie: dezelfde teksten, met het Nederlands als grijze voorbeeldtekst
    const en = start.en || {};
    const enTitle = textInput(en.title, { maxlength: '80', placeholder: start.title });
    const enIntro = textArea(en.intro, 3, start.intro);
    const enClosing = textArea(en.closing, 2, start.closing);
    const enHighlights = highlightInputs.map((h, index) => {
      const value = (en.highlights || [])[index] || {};
      return { title: textInput(value.title, { maxlength: '90', placeholder: h.title.value }), text: textArea(value.text, 2, h.text.value) };
    });

    const stateNode = el('div', { className: 'wr-admin__stats', attrs: { 'aria-live': 'polite' } }, [summary(stats)]);
    const fetchButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Cijfers ophalen voor deze periode' })]);
    const formError = ns.adminKit.formError();

    /** De Nederlandse teksten zoals ze nu in het formulier staan. */
    function dutch() {
      return {
        title: title.value.trim(),
        intro: intro.value.trim(),
        closing: closing.value.trim(),
        highlights: highlightInputs.map((h) => ({ title: h.title.value.trim(), text: h.text.value.trim() })).filter((h) => h.title || h.text)
      };
    }
    function englishValue() {
      // Op dezelfde plek als het Nederlands: lege hoogtepunten blijven staan voor de volgorde
      const raw = {
        title: enTitle.value.trim(),
        intro: enIntro.value.trim(),
        closing: enClosing.value.trim(),
        highlights: highlightInputs.map((h, index) => (h.title.value.trim() || h.text.value.trim() ? { title: enHighlights[index].title.value.trim(), text: enHighlights[index].text.value.trim() } : null)).filter(Boolean)
      };
      return ns.contentEn.clean('wrapped', raw, dutch());
    }
    function collect() {
      const data = Object.assign(dutch(), {
        from: from.value,
        to: to.value,
        until: until.value,
        off: screenBoxes.filter((s) => !s.box.checked).map((s) => s.id),
        stats
      });
      const english = englishValue();
      if (english) data.en = english;
      Object.keys(data).forEach((key) => { if (data[key] === '' || data[key] == null) delete data[key]; });
      return data;
    }
    const snapshot = () => JSON.stringify(collect());
    let initial = snapshot();

    fetchButton.addEventListener('click', async () => {
      formError.hide();
      if (!DATE.test(from.value) || !DATE.test(to.value) || from.value > to.value) {
        formError.show('Kies een geldige periode: van een datum tot een latere datum.');
        return;
      }
      fetchButton.disabled = true;
      stateNode.replaceChildren(el('p', { className: 'loading', text: 'Cijfers ophalen…' }));
      try {
        const days = Math.ceil((Date.now() - new Date(from.value + 'T00:00:00').getTime()) / 86400000) + 2;
        const [events, ideas] = await Promise.all([
          ns.central.adminEvents(Math.max(days, 1)).catch(() => []),
          ns.central.adminListIdeas().catch(() => [])
        ]);
        stats = compute({ from: from.value, to: to.value }, events || [], ideas || [], ns.content, ns.tijdwinst.minutesOf);
        stateNode.replaceChildren(...[
          stats.events ? null : ns.blocks.notice({ tone: 'warning', text: 'Geen tellingen gevonden in deze periode. Staan de anonieme tellers aan (enableUsageStats in js/config.js), en ligt de periode niet in de toekomst?' }),
          summary(stats)
        ].filter(Boolean));
      } catch (error) {
        stateNode.replaceChildren(ns.blocks.notice({ tone: 'warning', text: 'Ophalen lukte niet: ' + error.message }));
      } finally {
        fetchButton.disabled = false;
      }
    });

    // Vertalen met Copilot (zoals bij de inhoud, js/admin-english.js)
    const answer = el('textarea', { className: 'field__input field__textarea naslag-import__answer', attrs: { rows: '4', spellcheck: 'false', placeholder: '{ "title": "…", … }', 'aria-label': 'Antwoord van Copilot' } });
    const fillEnglish = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('wand'), el('span', { text: 'Vertaling invullen' })]);
    const enResult = el('div', { className: 'naslag-import__result', attrs: { 'aria-live': 'polite' } });
    fillEnglish.addEventListener('click', () => {
      try {
        const parsed = ns.adminEnglish.parse(answer.value, 'wrapped', dutch());
        if (parsed.en.title) enTitle.value = parsed.en.title;
        if (parsed.en.intro) enIntro.value = parsed.en.intro;
        if (parsed.en.closing) enClosing.value = parsed.en.closing;
        (parsed.en.highlights || []).forEach((h, index) => {
          if (!enHighlights[index]) return;
          if (h.title) enHighlights[index].title.value = h.title;
          if (h.text) enHighlights[index].text.value = h.text;
        });
        answer.value = '';
        enResult.replaceChildren(el('p', { className: 'naslag-import__ok' }, [icon('check-circle'), el('span', { text: 'Engelse teksten ingevuld. Lees ze na en sla op.' })]));
      } catch (error) {
        enResult.replaceChildren(el('p', { className: 'naslag-import__error' }, [icon('alert'), el('span', { text: error.message })]));
      }
    });

    async function save(status) {
      formError.hide();
      const data = collect();
      if (!data.title) return formError.show('Geef Wrapped een naam, bijv. Cockpit Wrapped 2026.');
      if (!DATE.test(from.value) || !DATE.test(to.value) || from.value > to.value) return formError.show('Kies een geldige periode: van een datum tot een latere datum.');
      if (status === 'published') {
        if (!stats) return formError.show('Haal eerst de cijfers op, dan kun je publiceren.');
        if (stats.period.from !== from.value || stats.period.to !== to.value) return formError.show('De periode is veranderd sinds je de cijfers ophaalde. Haal ze opnieuw op voordat je publiceert.');
        if (!(await confirm(`"${data.title}" wordt zichtbaar voor alle collega's van ${ns.cockpit.active().name}${data.until ? ', met een aankondiging op de startpagina tot ' + ns.ui.formatDate(data.until) : ''}.`, { title: 'Wrapped publiceren?', confirmLabel: 'Publiceren' }))) return;
      }
      busy = true;
      try {
        await ns.central.saveContent([{ type: 'setting', id: ns.content.WRAPPED_ID, data, position: 0, status }], namespace);
        initial = snapshot();
        await ns.app.reloadContent();
        toast(status === 'published' ? 'Gepubliceerd: collega\'s zien Wrapped nu' : 'Opgeslagen als concept: alleen beheerders zien hem', { tone: 'success' });
      } catch (error) {
        formError.show('Opslaan mislukt: ' + error.message);
      } finally {
        busy = false;
      }
    }

    const saveDraft = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('check'), el('span', { text: row && row.status === 'published' ? 'Terugzetten naar concept' : 'Opslaan als concept' })]);
    const publish = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('send'), el('span', { text: row && row.status === 'published' ? 'Opslaan en gepubliceerd laten' : 'Publiceren' })]);
    saveDraft.addEventListener('click', () => save('draft'));
    publish.addEventListener('click', () => save('published'));
    const remove = row ? el('button', { className: 'btn btn--danger', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Verwijderen' })]) : null;
    if (remove) {
      remove.addEventListener('click', async () => {
        if (!(await confirm('Wrapped verdwijnt uit de cockpit, ook de aankondiging op de startpagina.', { title: 'Wrapped verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
        try {
          await ns.central.deleteContent('setting', ns.content.WRAPPED_ID, namespace);
          initial = snapshot();
          await ns.app.reloadContent();
          toast('Wrapped verwijderd', { tone: 'success' });
        } catch (error) {
          formError.show('Verwijderen mislukt: ' + error.message);
        }
      });
    }

    const status = row
      ? el('span', { className: 'status status--' + (row.status === 'published' ? 'success' : 'info'), text: row.status === 'published' ? 'Gepubliceerd' : 'Concept' })
      : el('span', { className: 'status status--muted', text: 'Nog niet gemaakt' });

    const node = el('div', { className: 'cms wr-admin' }, [
      el('div', { className: 'wr-admin__head' }, [
        el('p', { className: 'section__lead', text: 'Het jaar (of seizoen) van de discipline in de cockpit: wat collega\'s het meest gebruikten, wat het opleverde, wat er nieuw bij kwam, met jouw hoogtepunten. Collega\'s zien daarnaast hun eigen jaar, alleen in hun eigen browser. Er staan geen namen in.' }),
        status
      ]),
      el('form', { className: 'cms-form', attrs: { novalidate: true } }, [
        el('div', { className: 'form-grid' }, [
          el('div', { className: 'field form-section' }, [el('h3', { className: 'form-section__title', text: '1. Periode en naam' })]),
          field('Naam', title, 'Bijv. Cockpit Wrapped 2026, of Seizoen 2026-2027.'),
          field('Op de startpagina tot', until, 'Tot deze dag staat er een aankondiging op de startpagina. Daarna blijft Wrapped te vinden via #/wrapped.'),
          field('Van', from),
          field('Tot en met', to),
          el('div', { className: 'field field--wide' }, [fetchButton, stateNode]),
          el('div', { className: 'field form-section' }, [el('h3', { className: 'form-section__title', text: '2. Teksten' })]),
          field('Inleiding', intro),
          ...highlightInputs.flatMap((h, index) => [field(`Hoogtepunt ${index + 1}: kop`, h.title), field(`Hoogtepunt ${index + 1}: tekst`, h.text)]),
          field('Afsluiting', closing),
          el('fieldset', { className: 'field field--wide choices' }, [
            el('legend', { className: 'field__label', text: '3. Welke schermen tonen' }),
            el('p', { className: 'field__hint', text: 'Een scherm zonder cijfers (bijv. tijdwinst onder de 5 uur) laat de cockpit vanzelf weg.' }),
            el('div', { className: 'choices__list wr-admin__screens' }, screenBoxes.map((s) => s.node))
          ]),
          el('details', { className: 'field field--wide en-box' }, [
            el('summary', { className: 'en-box__head' }, [
              el('span', { className: 'en-box__icon', attrs: { 'aria-hidden': 'true' } }, [icon('globe')]),
              el('span', { className: 'en-box__heading' }, [
                el('span', { className: 'en-box__title', text: '4. Engelse versie' }),
                el('span', { className: 'en-box__lead', text: 'Voor collega\'s die de cockpit in het Engels gebruiken. Leeg = de Nederlandse tekst.' })
              ]),
              icon('chevron-down', { className: 'en-box__chevron' })
            ]),
            el('div', { className: 'en-box__body' }, [
              el('div', { className: 'naslag-import__actions' }, [
                ns.ui.copilotButton(() => ns.adminEnglish.prompt('wrapped', dutch()), { label: 'Kopieer de vertaalprompt en open Copilot', className: 'btn--sm' })
              ]),
              answer,
              el('div', { className: 'naslag-import__actions' }, [fillEnglish]),
              enResult,
              el('div', { className: 'form-grid en-box__grid' }, [
                field('Naam (Engels)', enTitle),
                field('Inleiding (Engels)', enIntro),
                ...enHighlights.flatMap((h, index) => [field(`Hoogtepunt ${index + 1}: kop (Engels)`, h.title), field(`Hoogtepunt ${index + 1}: tekst (Engels)`, h.text)]),
                field('Afsluiting (Engels)', enClosing)
              ])
            ])
          ])
        ]),
        formError.node,
        el('div', { className: 'cms-form__actions' }, [
          publish,
          saveDraft,
          el('a', { className: 'btn btn--quiet', attrs: { href: '#/wrapped' } }, [icon('eye'), el('span', { text: 'Bekijk op de site' })]),
          el('span', { className: 'cms-form__spacer' }),
          remove
        ].filter(Boolean))
      ])
    ]);
    return { node, canLeave: () => busy || snapshot() === initial };
  }

  ns.adminWrapped = { compute, defaults, monthsOf, render, SCREEN_LABELS };
})(window.AIAudit);
