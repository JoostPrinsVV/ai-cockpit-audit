/* ==========================================================================
   Beheer → Overzicht (#/beheer/overzicht)
   --------------------------------------------------------------------------
   De stand van zaken over alle disciplines, op één scherm en af te drukken
   als PDF (bijvoorbeeld voor het bestuur):
   - kerncijfers: Copilot-adoptie, demo's en prompts, gebruik van de cockpit
     (30 dagen, met het verschil met de 30 dagen ervoor) en ideeën;
   - het gebruik van de cockpit per week (laatste 12 volle weken);
   - per discipline: inhoud, ideeën en gebruik;
   - Copilot-gebruik per discipline (laatste import, met het verschil);
   - ideeën: de status in de hub en het portfolio (AI Value Matrix);
   - de laatste trainingen.
   Bronnen: wat live staat, de anonieme tellers, de ideeënhub en de totalen van
   de Copilot-export. Geen gegevens per persoon. Alleen voor hoofdbeheerders.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, formatDate } = ns.ui;
  const { notice } = ns.blocks;
  const NUMBER = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  const PERCENT = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 0 });
  const SIGNED = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  const SIGNED_PERCENT = new Intl.NumberFormat('nl-NL', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  const DAY = 86400000;
  const WEEKS = 12;

  // Soorten tellers: bekijken (ook afspelen en openen) en kopiëren
  const VIEWED = ['view_usecase', 'play_demo', 'view_tip', 'view_training', 'play_training', 'view_agent', 'open_agent'];
  const COPIED = ['copy_prompt', 'copy_tip'];

  /** Maandag van de week (UTC) als 'JJJJ-MM-DD'. */
  function weekOf(time) {
    const date = new Date(time);
    const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - ((date.getUTCDay() + 6) % 7) * DAY;
    return new Date(start).toISOString().slice(0, 10);
  }

  /**
   * Telt de inhoud die live staat per naamruimte: usecases (en hoeveel met demo), losse prompts plus de
   * stappen uit de usecases, tips en trainingen.
   */
  function countContent(rows) {
    const per = new Map();
    const of = (namespace) => {
      if (!per.has(namespace)) per.set(namespace, { usecases: 0, demos: 0, prompts: 0, tips: 0, trainings: 0 });
      return per.get(namespace);
    };
    rows.forEach((row) => {
      const counts = of(row.namespace);
      if (row.type === 'usecase') {
        counts.usecases += 1;
        if (row.video || row.demo) counts.demos += 1;
        counts.prompts += Array.isArray(row.prompts) ? row.prompts.length : 0;
      } else if (row.type === 'prompt') counts.prompts += 1;
      else if (row.type === 'tip') counts.tips += 1;
      else if (row.type === 'training') counts.trainings += 1;
    });
    return per;
  }

  /** Gebruik per periode: bekeken en gekopieerd in de laatste 30 dagen en de 30 dagen ervoor, en per week. */
  function countEvents(events, now) {
    const result = { recent: { viewed: 0, copied: 0 }, before: { viewed: 0, copied: 0 }, perNamespace: new Map(), weeks: [] };
    const current = weekOf(now);
    const weeks = new Map();
    for (let n = WEEKS; n >= 1; n -= 1) weeks.set(new Date(Date.parse(current) - n * 7 * DAY).toISOString().slice(0, 10), { viewed: 0, copied: 0 });
    events.forEach((event) => {
      const kind = VIEWED.includes(event.kind) ? 'viewed' : COPIED.includes(event.kind) ? 'copied' : '';
      if (!kind) return;
      const time = Date.parse(event.occurred_at);
      const age = now - time;
      if (age <= 30 * DAY) {
        result.recent[kind] += 1;
        result.perNamespace.set(event.namespace, (result.perNamespace.get(event.namespace) || 0) + 1);
      } else if (age <= 60 * DAY) result.before[kind] += 1;
      const week = weeks.get(weekOf(time));
      if (week) week[kind] += 1;
    });
    result.weeks = Array.from(weeks.entries()).map(([week, values]) => ({ week, values }));
    return result;
  }

  /** Per discipline de laatste en de vorige import van het Copilot-gebruik, met de kengetallen. */
  function copilotPerNamespace(rows) {
    const per = new Map();
    // Alleen de imports (de tabel heeft per discipline ook een rij met momenten)
    rows.filter((row) => ns.adminCopilot.isUsage(row.summary)).forEach((row) => {
      if (!per.has(row.namespace)) per.set(row.namespace, []);
      per.get(row.namespace).push(row);
    });
    const result = [];
    per.forEach((list, namespace) => {
      const sorted = list.slice().sort((a, b) => (a.period_end < b.period_end ? -1 : 1));
      try {
        const latest = sorted[sorted.length - 1];
        const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        result.push({
          namespace,
          latest,
          previous,
          now: ns.adminCopilot.measures(latest.summary).total,
          then: previous ? ns.adminCopilot.measures(previous.summary).total : null
        });
      } catch (error) {
        /* een samenvatting die deze versie niet kent: overslaan */
      }
    });
    return result;
  }

  const relative = (now, then) => (then ? now / then - 1 : null);

  /** Kerncijfer: waarde, label, en eventueel het verschil (pijltje) of een toelichting. */
  function tile(value, label, delta, note) {
    let deltaNode = null;
    if (delta && delta.value != null && Number.isFinite(delta.value)) {
      const direction = delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat';
      deltaNode = el('span', { className: 'kpi__delta kpi__delta--' + direction }, [
        direction === 'flat' ? null : icon(direction === 'up' ? 'arrow-up' : 'arrow-down'),
        el('span', { text: delta.text })
      ]);
    }
    return el('div', { className: 'kpi' }, [
      el('span', { className: 'kpi__value', text: value }),
      el('span', { className: 'kpi__label', text: label }),
      deltaNode,
      note ? el('span', { className: 'kpi__note', text: note }) : null
    ]);
  }

  function table(columns, rows, numeric) {
    return el('table', { className: 'table' }, [
      el('thead', {}, [el('tr', {}, columns.map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: numeric(index) ? 'num' : null } })))]),
      el('tbody', {}, rows.map((row) => el('tr', { className: row.total ? 'copilot__total' : '' }, row.cells.map((cell, index) =>
        el(index ? 'td' : 'th', { className: numeric(index) ? 'num' : '', attrs: { scope: index ? null : 'row' } }, [cell])))))
    ]);
  }

  const section = (title, sub, content) => el('section', { className: 'usage-table overview__section' }, [
    el('h3', { className: 'usage-table__title', text: title }),
    sub ? el('p', { className: 'chart__sub', text: sub }) : null,
    ...[].concat(content)
  ]);

  const unreadable = (what, reason) => el('p', { className: 'section__lead', text: `${what} is niet te lezen: ${reason}` });

  /* ---- Pagina ------------------------------------------------------------------------------ */
  function render() {
    const node = el('div', { className: 'overview' });
    const body = el('div', { className: 'overview__body' });
    const stamp = el('p', { className: 'overview__stamp' });

    async function load() {
      body.replaceChildren(el('p', { className: 'loading', text: 'Overzicht laden…' }));
      const now = Date.now();
      const [content, events, ideas, copilot] = await Promise.allSettled([
        ns.central.contentOverview(),
        ns.central.adminEvents(WEEKS * 7 + 7, { all: true }),
        ns.central.adminListIdeas({ all: true }),
        ns.central.listCopilotUsage({ all: true })
      ]);
      if (!ns.central.signedIn()) {
        node.dispatchEvent(new CustomEvent('signedout', { bubbles: true }));
        return;
      }
      stamp.textContent = `Alle disciplines · peildatum ${formatDate(new Date(now).toISOString().slice(0, 10))}`;
      const disciplines = ns.cockpit.registry();
      const nameOf = (namespace) => {
        if (namespace === ns.cockpit.GENERAL_NAMESPACE) return 'Gedeelde basis';
        const found = disciplines.find((d) => ns.cockpit.namespace(d.id) === namespace);
        return found ? found.name : namespace;
      };

      const contentCounts = content.status === 'fulfilled' ? countContent(content.value) : null;
      const usage = events.status === 'fulfilled' ? countEvents(events.value, now) : null;
      const ideaList = ideas.status === 'fulfilled' ? ideas.value : null;
      const copilotList = copilot.status === 'fulfilled' && copilot.value ? copilotPerNamespace(copilot.value) : null;
      // Momenten van alle disciplines (Copilot-gebruik → Momenten), met de discipline erbij
      const markers = copilot.status === 'fulfilled' && copilot.value
        ? copilot.value.filter((row) => row.source === 'momenten' && row.summary && Array.isArray(row.summary.moments))
          .flatMap((row) => row.summary.moments.map((moment) => ({
            date: moment.date,
            label: row.namespace === ns.cockpit.GENERAL_NAMESPACE ? moment.title : `${moment.title} (${nameOf(row.namespace)})`
          })))
        : [];
      const sum = (field) => (contentCounts ? Array.from(contentCounts.values()).reduce((total, counts) => total + counts[field], 0) : null);

      // ---- Kerncijfers
      const tiles = [];
      if (copilotList && copilotList.length) {
        const people = copilotList.reduce((total, item) => total + item.now.people, 0);
        const active = copilotList.reduce((total, item) => total + item.now.active, 0);
        const withPrevious = copilotList.every((item) => item.then);
        const before = withPrevious ? copilotList.reduce((total, item) => total + item.then.active, 0) / copilotList.reduce((total, item) => total + item.then.people, 0) : null;
        const adoption = people ? active / people : null;
        tiles.push(tile(adoption == null ? '–' : PERCENT.format(adoption), 'Actief met Copilot (laatste 4 weken)',
          before != null && adoption != null ? { value: adoption - before, text: `${SIGNED.format(Math.round((adoption - before) * 100))} %-punt t.o.v. de vorige import` } : null,
          `${NUMBER.format(active)} van ${NUMBER.format(people)} collega's`));
      } else {
        tiles.push(tile('–', 'Actief met Copilot', null, 'Lees een export in bij Copilot-gebruik'));
      }
      tiles.push(tile(contentCounts ? NUMBER.format(sum('demos')) : '–', 'Usecases met demo', null, contentCounts ? `van ${NUMBER.format(sum('usecases'))} usecases` : null));
      tiles.push(tile(contentCounts ? NUMBER.format(sum('prompts')) : '–', 'Prompts, klaar om te kopiëren', null, contentCounts ? `${NUMBER.format(sum('tips'))} tips · ${NUMBER.format(sum('trainings'))} trainingen` : null));
      ['viewed', 'copied'].forEach((kind) => {
        const recent = usage ? usage.recent[kind] : null;
        const change = usage ? relative(usage.recent[kind], usage.before[kind]) : null;
        tiles.push(tile(usage ? NUMBER.format(recent) : '–', kind === 'viewed' ? 'Keer bekeken (30 dagen)' : 'Keer gekopieerd (30 dagen)',
          change != null ? { value: change, text: `${SIGNED_PERCENT.format(change)} t.o.v. de 30 dagen ervoor` } : null,
          kind === 'viewed' ? 'Usecases, demo\'s, tips, trainingen en agents' : 'Prompts en voorbeelden uit tips'));
      });
      if (ideaList) {
        const done = ideaList.filter((idea) => ['gerealiseerd', 'gepland'].includes(idea.status)).length;
        tiles.push(tile(NUMBER.format(ideaList.length), 'Ideeën en vragen ingediend', null, `${NUMBER.format(done)} opgepakt of gerealiseerd`));
      }

      // ---- Gebruik per week
      const usageSection = usage
        ? (usage.weeks.some((week) => week.values.viewed || week.values.copied)
          ? ns.adminChart.lineChart({
            title: 'Gebruik van de cockpit per week',
            sub: `De laatste ${WEEKS} volle weken, alle disciplines. Anoniem: er wordt niet bijgehouden wie iets bekijkt of kopieert.`,
            series: [{ id: 'viewed', label: 'Bekeken' }, { id: 'copied', label: 'Gekopieerd' }],
            points: usage.weeks,
            markers
          })
          : section('Gebruik van de cockpit per week', null, el('p', { className: 'section__lead', text: 'Nog geen gebruik geteld in de laatste weken.' })))
        : section('Gebruik van de cockpit per week', null, unreadable('Het gebruik', events.reason.message));

      // ---- Per discipline
      let disciplineSection;
      if (contentCounts) {
        const ideaCount = (namespace) => (ideaList ? ideaList.filter((idea) => idea.namespace === namespace).length : null);
        const rows = disciplines.map((d) => {
          const namespace = ns.cockpit.namespace(d.id);
          const counts = contentCounts.get(namespace) || { usecases: 0, demos: 0, prompts: 0, tips: 0, trainings: 0 };
          return { cells: [d.name, d.status === 'open' ? 'Open' : 'Op slot', NUMBER.format(counts.usecases), NUMBER.format(counts.prompts), NUMBER.format(counts.tips), NUMBER.format(counts.trainings), ideaCount(namespace) == null ? '–' : NUMBER.format(ideaCount(namespace)), usage ? NUMBER.format(usage.perNamespace.get(namespace) || 0) : '–'] };
        });
        const basis = contentCounts.get(ns.cockpit.GENERAL_NAMESPACE);
        if (basis) rows.push({ cells: ['Gedeelde basis', 'Overal',NUMBER.format(basis.usecases), NUMBER.format(basis.prompts), NUMBER.format(basis.tips), NUMBER.format(basis.trainings), '–', '–'] });
        rows.push({ total: true, cells: ['Samen', '', NUMBER.format(sum('usecases')), NUMBER.format(sum('prompts')), NUMBER.format(sum('tips')), NUMBER.format(sum('trainings')), ideaList ? NUMBER.format(ideaList.length) : '–', usage ? NUMBER.format(usage.recent.viewed + usage.recent.copied) : '–'] });
        disciplineSection = section('Per discipline', 'Wat live staat. Prompts: de losse prompts plus de stappen uit de usecases. Gebruik: keer bekeken of gekopieerd in de laatste 30 dagen.',
          table(['Discipline', 'Status', 'Usecases', 'Prompts', 'Tips', 'Trainingen', 'Ideeën', 'Gebruik (30 dgn)'], rows, (index) => index > 1));
      } else {
        disciplineSection = section('Per discipline', null, unreadable('De inhoud', content.reason.message));
      }

      // ---- Copilot-gebruik
      let copilotSection;
      if (copilot.status === 'rejected') copilotSection = section('Copilot-gebruik', null, unreadable('Het Copilot-gebruik', copilot.reason.message));
      else if (!copilot.value) copilotSection = section('Copilot-gebruik', null, el('p', { className: 'section__lead', text: 'Nog niet ingericht: voer setup/supabase-audit-copilot.sql (stap 9) uit en lees een export in bij Copilot-gebruik.' }));
      else if (!copilotList.length) copilotSection = section('Copilot-gebruik', null, el('p', { className: 'section__lead', text: 'Nog geen export ingelezen. Dat doe je per discipline bij Beheer → Copilot-gebruik.' }));
      else {
        copilotSection = section('Copilot-gebruik', 'De laatste import per discipline, met het verschil met de import ervoor. Alleen totalen, geen gegevens per persoon.',
          table(['Discipline', 'Periode', 'Personen', 'Actief (4 wkn)', 'Adoptie', 'Verschil'], copilotList.map((item) => {
            const diff = item.then ? Math.round((item.now.adoption - item.then.adoption) * 100) : null;
            return { cells: [nameOf(item.namespace), ns.adminCopilot.period({ periodStart: item.latest.period_start, periodEnd: item.latest.period_end }), NUMBER.format(item.now.people), NUMBER.format(item.now.active), item.now.adoption == null ? '–' : PERCENT.format(item.now.adoption), diff == null ? 'Eerste import' : `${SIGNED.format(diff)} %-punt`] };
          }), (index) => index > 1 && index < 5));
      }

      // ---- Ideeën: status en portfolio
      let ideaSection;
      if (ideaList) {
        const statuses = Object.entries(ns.ideas.STATUSES);
        const max = Math.max(1, ...statuses.map(([value]) => ideaList.filter((idea) => idea.status === value).length));
        const bars = el('ul', { className: 'bars', attrs: { role: 'list' } }, statuses.map(([value, info]) => {
          const n = ideaList.filter((idea) => idea.status === value).length;
          const bar = el('span', { className: 'bars__bar' });
          bar.style.setProperty('--share', String(n / max));
          return el('li', { className: 'bars__row' }, [el('span', { className: 'bars__label', text: info.label }), el('span', { className: 'bars__track' }, [bar, el('span', { className: 'bars__value', text: NUMBER.format(n) })])]);
        }));
        const P = ns.adminPortfolio;
        const ranked = P.ranked(ideaList);
        const open = ideaList.filter((idea) => P.isCandidate(idea) && !P.outcome(idea.assessment)).length;
        const quadrants = el('div', { className: 'overview__quadrants' }, ['strategisch', 'direct', 'stoppen', 'quickwin'].map((id) => {
          const q = P.QUADRANTS.find((item) => item.id === id);
          return el('div', { className: 'overview__quadrant overview__quadrant--' + id }, [
            el('span', { className: 'overview__quadrant-count', text: NUMBER.format(ranked.filter((entry) => entry.result.quadrant.id === id).length) }),
            el('span', { className: 'overview__quadrant-label', text: q.label })
          ]);
        }));
        const first = ranked.filter((entry) => entry.result.quadrant.id === 'direct').slice(0, 5);
        ideaSection = el('div', { className: 'usage-grid' }, [
          section('Ideeënhub', `${NUMBER.format(ideaList.length)} inzendingen in alle disciplines, per status.`, bars),
          section('Portfolio (AI Value Matrix)', `${NUMBER.format(ranked.length)} beoordeeld · ${NUMBER.format(open)} nog te beoordelen. Waarde (verticaal) tegen haalbaarheid (horizontaal).`, [
            quadrants,
            first.length ? el('div', { className: 'overview__first' }, [
              el('p', { className: 'field__label', text: 'Direct uitvoeren' }),
              el('ul', {}, first.map((entry) => el('li', { text: `${entry.idea.title} (${nameOf(entry.idea.namespace)})` })))
            ]) : null
          ])
        ]);
      } else {
        ideaSection = section('Ideeën', null, unreadable('De ideeënhub', ideas.reason.message));
      }

      // ---- Trainingen
      let trainingSection = null;
      if (content.status === 'fulfilled') {
        const trainings = content.value.filter((row) => row.type === 'training' && row.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
        if (trainings.length) {
          trainingSection = section('Trainingen en sessies', 'De laatste vijf, met naslagwerk of opname in de cockpit.',
            el('ul', { className: 'overview__trainings', attrs: { role: 'list' } }, trainings.map((row) => el('li', {}, [
              el('span', { className: 'admin-item__date', text: formatDate(row.date) }),
              el('span', { className: 'overview__training-title', text: row.title || row.id }),
              el('span', { className: 'chip', text: nameOf(row.namespace) })
            ]))));
        }
      }

      // replaceChildren maakt van null de tekst 'null': alleen de onderdelen die er zijn
      body.replaceChildren(...[
        el('div', { className: 'kpis overview__kpis' }, tiles),
        usageSection,
        disciplineSection,
        copilotSection,
        ideaSection,
        trainingSection,
        el('p', { className: 'field__hint overview__source', text: 'Bronnen: wat live in de cockpit staat, de anonieme tellers van de cockpit, de ideeënhub (met de beoordelingen) en de totalen uit de Copilot-export. Geen gegevens per persoon.' })
      ].filter(Boolean));
    }

    /** PDF: dit overzicht afdrukken, de rest van de pagina verborgen (zie @media print in css/admin.css). */
    function printPdf() {
      const root = el('div', { className: 'ov-print' }, [node.cloneNode(true)]);
      const title = document.title;
      document.body.append(root);
      document.body.classList.add('is-printing-overview');
      document.title = 'AI Cockpit - stand van zaken ' + new Date().toISOString().slice(0, 10);
      const done = () => {
        document.body.classList.remove('is-printing-overview');
        root.remove();
        document.title = title;
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
      window.setTimeout(() => { if (document.body.contains(root)) done(); }, 1500);
    }

    node.append(
      el('div', { className: 'overview__head' }, [
        el('div', {}, [el('h2', { className: 'section__title', text: 'Stand van zaken' }), stamp]),
        el('div', { className: 'overview__actions' }, [
          el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Vernieuwen' })]),
          el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' }, on: { click: printPdf } }, [icon('download'), el('span', { text: 'Afdrukken als PDF' })])
        ])
      ]),
      body
    );
    load();
    return { node };
  }

  ns.adminOverview = { render, countContent, countEvents, weekOf };
})(window.AIAudit);
