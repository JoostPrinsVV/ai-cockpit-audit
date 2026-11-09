/* ==========================================================================
   Beheer → Start: Klaar voor livegang?
   --------------------------------------------------------------------------
   Eén lijst met wat er nog moet voordat collega's alles kunnen gebruiken:
   - de databasestappen van de nieuwste onderdelen (de cockpit controleert
     zelf of ze zijn uitgevoerd, door een functie van die stap alleen-lezend
     aan te roepen: js/central.js, probe);
   - voor de discipline die je beheert: inhoud in de database, schattingen
     van de tijdwinst, de startprompts van de Kickstart en de AI-specialist;
   - voor alle disciplines: de beloftes van het AI-team.
   Alleen voor hoofdbeheerders. Is alles klaar, dan klapt de lijst in.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon } = ns.ui;
  // Hoe een regel eruitziet: klaar, nog doen, later (hoeft nu niet), naar keuze, onbekend
  const STATES = {
    done: { icon: 'check-circle', label: 'Klaar' },
    todo: { icon: 'alert', label: 'Nog doen' },
    optional: { icon: 'info', label: 'Naar keuze' },
    later: { icon: 'clock', label: 'Later' },
    unknown: { icon: 'question', label: 'Onbekend' },
    busy: { icon: 'clock', label: 'Controleren…' }
  };

  /** Hoeveel usecases en losse prompts een schatting van de tijdwinst hebben. */
  function savesCount(content) {
    const c = content || ns.content;
    const items = c.usecases.concat(c.prompts.filter((prompt) => !prompt.usecase)).filter((item) => !item.locked);
    return { filled: items.filter((item) => item.saves > 0).length, total: items.length };
  }

  /** De toestand van de schattingen: klaar vanaf 80%. */
  function savesState(count) {
    if (!count.total) return 'optional';
    return count.filled / count.total >= 0.8 ? 'done' : 'todo';
  }

  /** De regels over de inhoud van de discipline die je beheert (geen database nodig). */
  function contentChecks() {
    const discipline = ns.cockpit.active();
    const namespace = ns.cockpit.namespace(discipline.id);
    const rows = Array.isArray(ns.content.adminRows) ? ns.content.adminRows : [];
    const seeded = rows.some((row) => row.namespace === namespace && row.type === 'meta' && row.id === 'bron');
    const settings = ns.content.settings || {};
    const saves = savesCount();
    const startPrompts = Array.isArray(settings.kickstartPrompts) ? settings.kickstartPrompts.length : 0;
    const specialist = Boolean(discipline.specialist && discipline.specialistEmail);
    return [
      {
        id: 'seeded',
        label: 'Inhoud in de database',
        state: seeded ? 'done' : 'todo',
        text: seeded ? 'Je past alles aan in Beheer → Inhoud.' : 'De inhoud staat nog in de bestanden: zet hem over om hem in Beheer aan te passen.',
        href: '#/beheer/inhoud'
      },
      {
        id: 'saves',
        label: 'Schattingen van de tijdwinst',
        state: savesState(saves),
        text: saves.total
          ? `${saves.filled} van de ${saves.total} usecases en losse prompts hebben er een. Zonder schatting geen "Scheelde dit tijd?" en geen minuten in de Kickstart.`
          : 'Nog geen usecases of losse prompts.',
        href: '#/beheer/inhoud/tijdwinst',
        action: 'Invullen'
      },
      {
        id: 'kickstart',
        label: 'Startprompts van de Kickstart',
        state: settings.kickstartOff === true ? 'later' : startPrompts ? 'done' : 'optional',
        text: settings.kickstartOff === true ? 'De Kickstart staat uit.'
          : startPrompts ? `${Math.min(startPrompts, ns.kickstart.PROMPTS)} gekozen.` : 'Nog niet gekozen: de cockpit kiest nu zelf prompts uit het seizoen.',
        href: '#/beheer/inhoud/setting',
        action: 'Kiezen'
      },
      {
        id: 'specialist',
        label: 'AI-specialist voor invliegen',
        state: specialist ? 'done' : 'todo',
        text: specialist ? discipline.specialist : 'Nog geen naam en e-mailadres: dan heet het "de AI-specialist" en is er geen knop naar Teams.',
        href: '#/beheer/disciplines',
        action: 'Instellen'
      }
    ];
  }

  /** De beloftes van het AI-team (voor alle disciplines, uit de gedeelde basis of deze discipline). */
  function promiseCheck() {
    const list = ['flyin', 'request', 'prompt'].map((kind) => ns.promises.get(kind)).filter(Boolean);
    return {
      id: 'promises',
      label: 'Beloftes van het AI-team',
      state: 'done',
      text: list.length ? list.map((promise) => promise.text).join(' · ') : 'Uitgezet.',
      href: '#/beheer/basis/setting',
      action: 'Aanpassen'
    };
  }

  // De databasestappen: welke functie bewijst dat de stap is uitgevoerd, en wat als hij ontbreekt
  const STEPS = [
    { id: 'step13', label: 'Stap 13 · AI-specialist invliegen', file: 'setup/supabase-audit-invliegen.sql', fn: 'audit_invliegen_status', body: () => ({ p_refs: [] }), missing: 'todo', missingText: 'Nog uitvoeren, anders lukt een verzoek om in te vliegen niet.' },
    { id: 'step14', label: 'Stap 14 · Tijdwinst', file: 'setup/supabase-audit-tijdwinst.sql', fn: 'audit_time_saved', body: () => ({ p_namespace: ns.app.config().namespace }), missing: 'todo', missingText: 'Nog uitvoeren, anders blijven het totaal op de startpagina en de tijdwinst in Gebruik leeg.' },
    { id: 'step16', label: 'Stap 16 · Agents in testfase', file: 'setup/supabase-audit-testfase.sql', fn: 'audit_testfeedback_count', body: () => ({ p_namespace: ns.app.config().namespace }), missing: 'todo', missingText: 'Nog uitvoeren (na stap 13), anders lukt "Deel je testervaring" bij een agent in testfase niet.' },
    { id: 'step12', label: 'Stap 12 · AI-brevetten met echte accounts', file: 'setup/supabase-audit-brevetten.sql', fn: 'audit_brevet_allowed', body: () => ({}), missing: 'later', missingText: 'Pas nodig bij echte accounts (de Microsoft-login), samen met stap 15 (puntenitems). Tot dan draaien de brevetten als demo.' }
  ];

  /** Eén databasestap controleren. */
  async function checkStep(step) {
    const result = await ns.central.probe(step.fn, step.body());
    if (result === 'ok') return { state: 'done', text: 'Uitgevoerd.' };
    if (result === 'missing') return { state: step.missing, text: step.missingText + ' Supabase → SQL Editor: ' + step.file + '.' };
    return { state: 'unknown', text: 'Niet te controleren (geen verbinding of geen rechten).' };
  }

  function rowNode(item) {
    const info = STATES[item.state] || STATES.unknown;
    const node = el('li', { className: 'launch__item is-' + item.state }, [
      el('span', { className: 'launch__mark', attrs: { title: info.label } }, [icon(info.icon), el('span', { className: 'sr-only', text: info.label + ': ' })]),
      el('div', { className: 'launch__body' }, [
        el('p', { className: 'launch__label', text: item.label }),
        el('p', { className: 'launch__text', text: item.text })
      ]),
      item.href && item.state !== 'done' && item.state !== 'busy' ? el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: item.href } }, [el('span', { text: item.action || 'Regelen' }), icon('arrow-right')]) : null
    ]);
    return node;
  }

  /** Het blok op Beheer → Start. Vult zich zodra de databasestappen gecontroleerd zijn. Geeft { node }. */
  function render() {
    const name = ns.cockpit.active().name;
    const summary = el('span', { className: 'launch__summary', text: 'Even kijken…' });
    const lists = el('div', { className: 'launch__lists' });
    const details = el('details', { className: 'launch', attrs: { open: true } }, [
      el('summary', { className: 'launch__head' }, [
        el('span', { className: 'launch__icon', attrs: { 'aria-hidden': 'true' } }, [icon('plane')]),
        el('span', { className: 'launch__heading' }, [el('span', { className: 'launch__title', text: 'Klaar voor livegang?' }), summary]),
        icon('chevron-down', { className: 'launch__chevron' })
      ]),
      lists
    ]);
    const steps = STEPS.map((step) => Object.assign({}, step, { state: 'busy', text: 'Controleren…' }));
    const group = (title, items) => el('section', { className: 'launch__group' }, [
      el('h3', { className: 'launch__group-title', text: title }),
      el('ul', { className: 'launch__list', attrs: { role: 'list' } }, items.map(rowNode))
    ]);

    function draw() {
      const content = contentChecks();
      const shared = [promiseCheck()];
      lists.replaceChildren(group('Database (eenmalig)', steps), group(`Cockpit van ${name}`, content), group('Alle disciplines', shared));
      const all = steps.concat(content, shared);
      const counted = all.filter((item) => item.state === 'done' || item.state === 'todo');
      const done = counted.filter((item) => item.state === 'done').length;
      const busy = all.some((item) => item.state === 'busy');
      summary.textContent = busy ? `${done} van de ${counted.length} klaar · database controleren…` : done === counted.length ? 'Alles staat klaar' : `${done} van de ${counted.length} klaar`;
      details.classList.toggle('is-ready', !busy && done === counted.length);
      if (!busy && done === counted.length) details.open = false;
    }

    draw();
    Promise.all(steps.map((step) => checkStep(step).then((result) => Object.assign(step, result)))).then(draw).catch(draw);
    return { node: details };
  }

  ns.adminLaunch = { render, contentChecks, savesCount, savesState, STEPS };
})(window.AIAudit);
