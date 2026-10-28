/* ==========================================================================
   Beheer → Portfolio (#/beheer/portfolio) en ideeën beoordelen
   --------------------------------------------------------------------------
   Ideeën uit de ideeënhub beoordelen met de AI Value Matrix:
   1. knock-outs (één treffer: stoppen, met de vervolgstap);
   2. vier scores van 0 tot 5: A kwaliteitseffect, B capaciteitseffect (met de
      rekensom uren per keer × keren per jaar), C technische haalbaarheid,
      D time-to-value;
   3. waarde = A + B, haalbaarheid = C + D, grens bij 6: dat geeft het kwadrant;
   4. de risicoklasse bepaalt de route erna, niet het kwadrant.
   De beoordeling staat bij de inzending (kolom assessment in audit_ideas,
   setup/supabase-audit-portfolio.sql, stap 10): alleen hoofdbeheerders lezen
   hem, bezoekers van de hub nooit. Portfolio toont alle beoordelingen van deze
   discipline in de matrix en als lijst, en exporteert de registerregels (CSV).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, formatDate } = ns.ui;
  const { notice } = ns.blocks;
  const kit = ns.adminKit;
  const { svg } = ns.adminChart;

  const KNOCKOUTS = [
    { id: 'K1', label: 'Geen eigenaar vanuit de praktijk', next: 'Terug naar de indiener.' },
    { id: 'K2', label: 'Vervangt het professionele oordeel', next: 'Niet toepassen: de toepassing signaleert, het team concludeert.' },
    { id: 'K3', label: 'Vraagt klantdata in een niet-goedgekeurde omgeving', next: 'Eerst langs DIU en Compliance.' },
    { id: 'K4', label: 'Ligt al bij een ander team (zoals Team dAtA of DIU) of een leverancier', next: 'Doorverwijzen als afhankelijkheid: geen tweede traject, opbrengst niet dubbel tellen.' },
    { id: 'K5', label: 'Eenmalig probleem, of beperkt tot één opdracht', next: 'Geen portefeuille-item.' }
  ];

  const DIMENSIONS = [
    { id: 'A', label: 'Kwaliteitseffect', levels: ['Geen effect', 'Marginaal, vooral gemak', 'Consistentere vastlegging', 'Betere onderbouwing of minder variatie tussen teams', 'Vollediger dossier (audit evidence) of fouten eerder gevonden', 'Raakt een NV COS-vereiste direct en maakt werk mogelijk dat handmatig niet haalbaar is'] },
    { id: 'B', label: 'Capaciteitseffect', levels: ['Minder dan 50 uur per jaar', '50 tot 150 uur per jaar', '150 tot 400 uur per jaar', '400 tot 800 uur per jaar', '800 tot 1.500 uur per jaar', 'Meer dan 1.500 uur per jaar'] },
    { id: 'C', label: 'Technische haalbaarheid', levels: ['Technologie of data die we niet hebben', 'Nieuwe ontwikkeling bij DIU of een leverancier, planning onzeker', 'Ontwikkeling binnen een bestaand platform, afhankelijk van derden', 'Te bouwen in goedgekeurde tooling door het eigen AI-team', 'Bestaande functionaliteit, alleen configureren', 'Bestaande functionaliteit, direct bruikbaar; data beschikbaar en betrouwbaar'] },
    { id: 'D', label: 'Time-to-value', levels: ['Meer dan een jaar, of onbekend', 'Volgend seizoen', 'Dit seizoen, Q4', 'Binnen twee kwartalen', 'Binnen een kwartaal', 'Binnen vier weken iets bruikbaars'] }
  ];

  const BOUNDARY = 6;
  const QUADRANTS = [
    { id: 'direct', label: 'Direct uitvoeren', text: 'Op de roadmap van dit seizoen.', value: true, feasible: true },
    { id: 'strategisch', label: 'Strategisch ontwikkelen', text: 'Opknippen; de blokkerende afhankelijkheid apart beleggen.', value: true, feasible: false },
    { id: 'quickwin', label: 'Quick win', text: 'Uitvoeren bij vrije capaciteit, niet ten koste van wat meer waarde heeft.', value: false, feasible: true },
    { id: 'stoppen', label: 'Stoppen', text: 'Met reden vastleggen en terugkoppelen aan de indiener, zodat het niet terugkomt.', value: false, feasible: false }
  ];

  const RISKS = [
    { id: 'laag', label: 'Laag', text: 'Schrijf- en structureerondersteuning: geen aparte acceptatie; de gebruiker beoordeelt de uitkomst.' },
    { id: 'midden', label: 'Midden', text: 'Documentanalyse, conceptmemo\'s, consistentiechecks: bronvermelding, validatie tegen de bron en vaktechnische acceptatie per toepassing.' },
    { id: 'hoog', label: 'Hoog', text: 'Analyse van controle-informatie, risicosignalering: volledige bronaansluiting, zekerheidsdrempel, audittrail en jaarlijkse herbeoordeling.' }
  ];

  const NUMBER = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
  // Kandidaten voor het portfolio: ideeën en verzoeken (geen vragen of losse prompts), niet afgewezen
  const isCandidate = (idea) => ['idee', 'verzoek'].includes(idea.kind) && idea.status !== 'afgewezen';

  /** Score B uit de uren per jaar: <50 → 0, 50-150 → 1, 150-400 → 2, 400-800 → 3, 800-1.500 → 4, >1.500 → 5. */
  function hoursScore(hours) {
    if (!(hours >= 0)) return null;
    if (hours > 1500) return 5;
    return [50, 150, 400, 800].filter((limit) => hours >= limit).length;
  }

  const validScore = (value) => Number.isInteger(value) && value >= 0 && value <= 5;

  /**
   * Uitkomst van een beoordeling: { knockouts, complete, value, feasibility, quadrant, borderline }.
   * Met een knock-out is er geen kwadrant. Grensgeval: waarde of haalbaarheid twee punten of minder
   * onder de grens (voordeel van de twijfel, opnieuw scoren bij het ontwerp). null zonder beoordeling.
   */
  function outcome(assessment) {
    if (!assessment || typeof assessment !== 'object') return null;
    const knockouts = (Array.isArray(assessment.knockouts) ? assessment.knockouts : []).filter((id) => KNOCKOUTS.some((k) => k.id === id));
    const scores = assessment.scores || {};
    const complete = DIMENSIONS.every((d) => validScore(scores[d.id]));
    if (knockouts.length || !complete) return { knockouts, complete, value: null, feasibility: null, quadrant: null, borderline: false };
    const value = scores.A + scores.B;
    const feasibility = scores.C + scores.D;
    const quadrant = QUADRANTS.find((q) => q.value === (value >= BOUNDARY) && q.feasible === (feasibility >= BOUNDARY));
    const borderline = [value, feasibility].some((n) => n < BOUNDARY && n >= BOUNDARY - 2);
    return { knockouts, complete, value, feasibility, quadrant, borderline };
  }

  /** Badge met het kwadrant (of 'Knock-out' / 'Niet compleet'). */
  function badge(result) {
    if (!result) return null;
    if (result.knockouts.length) return el('span', { className: 'badge quadrant quadrant--ko' }, [icon('close'), 'Knock-out ' + result.knockouts.join(', ')]);
    if (!result.quadrant) return el('span', { className: 'badge quadrant' }, ['Niet compleet']);
    return el('span', { className: 'badge quadrant quadrant--' + result.quadrant.id }, [result.quadrant.label]);
  }

  /* ---- Beoordelen (zijpaneel) ------------------------------------------------------------ */
  let formCount = 0;

  /** Het formulier van de AI Value Matrix voor één inzending; onSaved(bijgewerkte inzending). */
  function assess(idea, onSaved) {
    const prefix = 'vm' + (++formCount) + '-';
    const before = idea.assessment || {};
    const fieldInput = (key, label, value, options) => {
      const opts = options || {};
      const id = prefix + key;
      const input = el(opts.multiline ? 'textarea' : 'input', {
        className: 'field__input' + (opts.multiline ? ' field__textarea' : ''),
        attrs: { id, type: opts.multiline ? null : 'text', rows: opts.multiline ? '3' : null, maxlength: opts.max || 300, placeholder: opts.placeholder || null }
      });
      input.value = value || '';
      return { input, node: el('div', { className: 'field' }, [el('label', { className: 'field__label', text: label, attrs: { for: id } }), opts.hint ? el('p', { className: 'field__hint', text: opts.hint }) : null, input]) };
    };

    const problem = fieldInput('problem', 'Het idee in één zin', before.problem, { hint: 'Welk praktijkprobleem, voor wie en in welke fase?', placeholder: 'bijv. Teams verwerken klantinterviews met de hand in de planningsfase' });
    const owner = fieldInput('owner', 'Eigenaar vanuit de praktijk', before.owner, { max: 120 });

    const knockoutBoxes = KNOCKOUTS.map((k) => {
      const id = prefix + k.id;
      const box = el('input', { attrs: { id, type: 'checkbox', value: k.id, checked: (before.knockouts || []).includes(k.id) } });
      return { box, node: el('label', { className: 'check', attrs: { for: id } }, [box, el('span', {}, [el('strong', { text: `${k.id} · ${k.label}` }), el('span', { className: 'assess__next', text: k.next })])]) };
    });

    const scores = {};
    const notes = {};
    const hourInputs = {};
    const dimensionNodes = DIMENSIONS.map((d) => {
      const id = prefix + 'score-' + d.id;
      const select = el('select', { className: 'field__input', attrs: { id } }, [
        el('option', { attrs: { value: '' }, text: '– kies een score –' }),
        ...d.levels.map((text, n) => el('option', { attrs: { value: String(n) }, text: `${n} · ${text}` }))
      ]);
      select.value = validScore((before.scores || {})[d.id]) ? String(before.scores[d.id]) : '';
      scores[d.id] = select;
      const note = el('input', { className: 'field__input field__input--sm', attrs: { id: id + '-note', type: 'text', maxlength: 200, placeholder: 'Onderbouwing in één regel', 'aria-label': `Onderbouwing ${d.label}` } });
      note.value = ((before.notes || {})[d.id]) || '';
      notes[d.id] = note;
      let sum = null;
      if (d.id === 'B') {
        // De rekensom: uren per keer × keren per jaar; zet de score (die je nog kunt aanpassen)
        const perTime = el('input', { className: 'field__input field__input--sm assess__hours', attrs: { id: prefix + 'per', type: 'number', min: '0', step: '0.5', inputmode: 'decimal' } });
        const times = el('input', { className: 'field__input field__input--sm assess__hours', attrs: { id: prefix + 'times', type: 'number', min: '0', step: '1', inputmode: 'numeric' } });
        perTime.value = before.hoursPerTime != null ? String(before.hoursPerTime) : '';
        times.value = before.timesPerYear != null ? String(before.timesPerYear) : '';
        const total = el('span', { className: 'assess__total' });
        hourInputs.perTime = perTime;
        hourInputs.times = times;
        hourInputs.total = total;
        const onHours = () => {
          const hours = hoursOf();
          if (hours != null) select.value = String(hoursScore(hours));
          update();
        };
        perTime.addEventListener('input', onHours);
        times.addEventListener('input', onHours);
        sum = el('div', { className: 'assess__sum' }, [
          el('label', { attrs: { for: prefix + 'per' }, text: 'Uren per keer' }), perTime,
          el('span', { attrs: { 'aria-hidden': 'true' }, text: '×' }),
          el('label', { attrs: { for: prefix + 'times' }, text: 'keren per jaar' }), times,
          total
        ]);
      }
      return el('div', { className: 'field assess__dimension' }, [
        el('label', { className: 'field__label', attrs: { for: id }, text: `${d.id} · ${d.label}` }),
        select,
        sum,
        note
      ]);
    });

    const riskId = prefix + 'risk';
    const riskRadios = RISKS.map((r) => {
      const id = riskId + '-' + r.id;
      const radio = el('input', { attrs: { id, type: 'radio', name: riskId, value: r.id, checked: before.risk === r.id } });
      return { radio, node: el('label', { className: 'check', attrs: { for: id } }, [radio, el('span', {}, [el('strong', { text: r.label }), el('span', { className: 'assess__next', text: r.text })])]) };
    });
    const route = fieldInput('route', 'Technische route', before.route, { placeholder: 'bijv. Copilot Chat met een vaste prompt, of een agent in Copilot Studio', max: 200 });
    const decision = fieldInput('decision', 'Besluit', before.decision, { placeholder: 'bijv. Uitvoeren in Q1, pilot met twee teams', max: 200 });
    const questions = fieldInput('questions', 'Open vragen', before.questions, { multiline: true, max: 1000, hint: 'De twee of drie vragen die beantwoord moeten worden voordat de score hard is.' });

    const result = el('div', { className: 'assess__result', attrs: { role: 'status' } });
    const error = el('p', { className: 'field__error', attrs: { role: 'alert' } });

    function hoursOf() {
      const per = Number(hourInputs.perTime.value);
      const times = Number(hourInputs.times.value);
      return hourInputs.perTime.value !== '' && hourInputs.times.value !== '' && per >= 0 && times >= 0 ? Math.round(per * times) : null;
    }

    function collect() {
      const hours = hoursOf();
      const pick = (select) => (select.value === '' ? null : Number(select.value));
      const radio = riskRadios.find((r) => r.radio.checked);
      return {
        version: 1,
        problem: problem.input.value.trim(),
        owner: owner.input.value.trim(),
        knockouts: knockoutBoxes.filter((k) => k.box.checked).map((k) => k.box.value),
        scores: Object.fromEntries(DIMENSIONS.map((d) => [d.id, pick(scores[d.id])])),
        notes: Object.fromEntries(DIMENSIONS.map((d) => [d.id, notes[d.id].value.trim()])),
        hoursPerTime: hourInputs.perTime.value === '' ? null : Number(hourInputs.perTime.value),
        timesPerYear: hourInputs.times.value === '' ? null : Number(hourInputs.times.value),
        hours,
        risk: radio ? radio.radio.value : '',
        route: route.input.value.trim(),
        decision: decision.input.value.trim(),
        questions: questions.input.value.trim()
      };
    }

    function update() {
      const hours = hoursOf();
      hourInputs.total.textContent = hours == null ? '' : `= ${NUMBER.format(hours)} uur per jaar (schatting)`;
      const data = collect();
      const r = outcome(data);
      if (r.knockouts.length) {
        result.replaceChildren(badge(r), ...r.knockouts.map((id) => el('p', { text: `${id}: ${KNOCKOUTS.find((k) => k.id === id).next}` })));
      } else if (!r.complete) {
        result.replaceChildren(el('p', { text: 'Kies vier scores om het kwadrant te zien.' }));
      } else {
        result.replaceChildren(...[
          el('p', { className: 'assess__score' }, [
            el('span', { text: `Waarde ${r.value} (A ${data.scores.A} + B ${data.scores.B})` }),
            el('span', { text: `Haalbaarheid ${r.feasibility} (C ${data.scores.C} + D ${data.scores.D})` })
          ]),
          el('p', {}, [badge(r), ' ', r.quadrant.text]),
          r.borderline ? el('p', { className: 'assess__borderline', text: 'Grensgeval: binnen twee punten onder de grens. Geef het voordeel van de twijfel en scoor opnieuw bij het ontwerp.' }) : null
        ].filter(Boolean));
      }
    }

    const form = el('form', { className: 'assess', attrs: { novalidate: true } }, [
      el('p', { className: 'drawer__lead' }, [
        el('strong', { text: idea.title }),
        ` · ${ns.ideas.KINDS.find((k) => k.id === idea.kind) ? ns.ideas.KINDS.find((k) => k.id === idea.kind).label.toLowerCase() : idea.kind} van ${formatDate(idea.created_at)}${idea.name ? ' door ' + idea.name : ''}`
      ]),
      idea.body ? el('details', { className: 'assess__idea' }, [el('summary', { text: 'De inzending lezen' }), el('p', { text: idea.body })]) : null,
      problem.node,
      owner.node,
      el('fieldset', { className: 'assess__group' }, [el('legend', { className: 'field__label', text: 'Stap 0 · Knock-outs (één treffer: stoppen)' }), ...knockoutBoxes.map((k) => k.node)]),
      el('fieldset', { className: 'assess__group' }, [el('legend', { className: 'field__label', text: 'Stap 1 · Scores (0 tot 5)' }), ...dimensionNodes]),
      el('div', { className: 'assess__outcome' }, [el('p', { className: 'field__label', text: 'Stap 2 · Kwadrant (grens bij 6)' }), result]),
      el('fieldset', { className: 'assess__group' }, [el('legend', { className: 'field__label', text: 'Stap 3 · Risicoklasse (bepaalt de route erna)' }), ...riskRadios.map((r) => r.node)]),
      route.node,
      decision.node,
      questions.node,
      error
    ]);
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', (event) => event.preventDefault());
    update();

    const save = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Beoordeling opslaan' })]);
    const remove = idea.assessment ? el('button', { className: 'btn btn--quiet', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Beoordeling verwijderen' })]) : null;
    const start = JSON.stringify(collect());
    let saved = false;
    const handle = ns.editor.drawer('Beoordelen met de AI Value Matrix', form, el('div', { className: 'assess__actions' }, [save, remove]), {
      canClose: () => saved || JSON.stringify(collect()) === start || ns.ui.confirmDialog('Je beoordeling is nog niet opgeslagen.', { title: 'Sluiten zonder opslaan?', confirmLabel: 'Sluiten zonder opslaan', cancelLabel: 'Blijven', danger: true })
    });

    async function store(assessment, message) {
      try {
        const updated = await ns.central.adminUpdateIdea(idea.id, { assessment });
        Object.assign(idea, updated);
        saved = true;
        handle.close();
        toast(message, { tone: 'success' });
        onSaved(idea);
      } catch (err) {
        error.textContent = /assessment/.test(err.message)
          ? 'De database kent beoordelingen nog niet: voer setup/supabase-audit-portfolio.sql (stap 10) uit in Supabase.'
          : 'Opslaan mislukt: ' + err.message;
      }
    }

    save.addEventListener('click', async () => {
      error.textContent = '';
      const data = collect();
      const r = outcome(data);
      if (!r.knockouts.length && !r.complete) {
        error.textContent = 'Kies voor alle vier de onderdelen een score, of vink een knock-out aan.';
        return;
      }
      if (!r.knockouts.length && !data.risk) {
        error.textContent = 'Kies een risicoklasse.';
        return;
      }
      const restore = kit.busy(save, 'Opslaan…');
      await store(Object.assign(data, { assessedAt: new Date().toISOString(), assessedBy: ns.central.signedIn() }), 'Beoordeling opgeslagen');
      if (!saved) restore();
    });
    if (remove) remove.addEventListener('click', async () => {
      if (!(await ns.ui.confirmDialog('De beoordeling van dit idee wordt verwijderd; het idee zelf blijft staan.', { title: 'Beoordeling verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
      await store(null, 'Beoordeling verwijderd');
    });
  }

  /** Regel in Beheer → Inzendingen: de uitkomst met een knop om te beoordelen of aan te passen. */
  function summaryRow(idea, onChanged) {
    const result = outcome(idea.assessment);
    const button = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('flag'), el('span', { text: result ? 'Beoordeling aanpassen' : 'Beoordelen met de AI Value Matrix' })]);
    button.addEventListener('click', () => assess(idea, onChanged));
    return el('div', { className: 'assess-row' }, [
      result ? badge(result) : el('span', { className: 'assess-row__none', text: 'Nog niet beoordeeld' }),
      result && result.quadrant ? el('span', { className: 'assess-row__score', text: `Waarde ${result.value} · haalbaarheid ${result.feasibility}${idea.assessment.risk ? ' · risico ' + idea.assessment.risk : ''}` }) : null,
      button
    ]);
  }

  /* ---- Matrix ------------------------------------------------------------------------------ */
  /**
   * De vier kwadranten met de ideeën als genummerde punten (nummer = regel in de lijst eronder).
   * x: haalbaarheid 0-10, y: waarde 0-10; de grenslijn ligt tussen 5 en 6. Punten op dezelfde plek
   * liggen naast elkaar. Aanwijzen of focus (Tab) geeft het uitleesvak.
   */
  function matrix(entries) {
    const box = el('div', { className: 'matrix' });
    const readout = el('div', { className: 'chart__readout matrix__readout', attrs: { 'aria-live': 'polite', hidden: true } });
    let width = 0;

    function draw() {
      const M = { top: 12, right: 12, bottom: 44, left: 52 };
      const size = Math.max(160, Math.min(width - M.left - M.right, 460));
      const height = size + M.top + M.bottom;
      const x = (n) => M.left + (n / 10) * size;
      const y = (n) => M.top + size - (n / 10) * size;
      const root = svg('svg', { class: 'matrix__svg', width: size + M.left + M.right, height, viewBox: `0 0 ${size + M.left + M.right} ${height}`, role: 'group', 'aria-label': `AI Value Matrix met ${entries.length} beoordeelde ideeën; de lijst eronder heeft alle cijfers.` });
      // Kwadranten (rustige vlakken) met hun naam in een hoek
      const mid = 5.5;
      [
        { q: 'strategisch', x0: 0, x1: mid, y0: mid, y1: 10, anchor: 'start' },
        { q: 'direct', x0: mid, x1: 10, y0: mid, y1: 10, anchor: 'end' },
        { q: 'stoppen', x0: 0, x1: mid, y0: 0, y1: mid, anchor: 'start' },
        { q: 'quickwin', x0: mid, x1: 10, y0: 0, y1: mid, anchor: 'end' }
      ].forEach((area) => {
        root.append(svg('rect', { x: x(area.x0), y: y(area.y1), width: x(area.x1) - x(area.x0), height: y(area.y0) - y(area.y1), class: 'matrix__area matrix__area--' + area.q }));
        const label = QUADRANTS.find((q) => q.id === area.q).label;
        root.append(svg('text', { x: area.anchor === 'start' ? x(area.x0) + 8 : x(area.x1) - 8, y: area.y1 === 10 ? y(10) + 16 : y(area.y0) - 8, 'text-anchor': area.anchor, class: 'matrix__label' }, label));
      });
      // Assen met de schaal 0-10 en de grens
      const axes = svg('g', { class: 'chart__grid' });
      [0, 2, 4, 6, 8, 10].forEach((n) => {
        axes.append(svg('text', { x: x(n), y: M.top + size + 16, 'text-anchor': 'middle' }, String(n)));
        axes.append(svg('text', { x: M.left - 8, y: y(n) + 4, 'text-anchor': 'end' }, String(n)));
      });
      root.append(axes);
      root.append(svg('line', { x1: x(mid), x2: x(mid), y1: y(10), y2: y(0), class: 'matrix__boundary' }));
      root.append(svg('line', { x1: x(0), x2: x(10), y1: y(mid), y2: y(mid), class: 'matrix__boundary' }));
      root.append(svg('text', { x: M.left + size / 2, y: height - 6, 'text-anchor': 'middle', class: 'matrix__axis' }, 'Haalbaarheid (C + D)'));
      root.append(svg('text', { x: 14, y: M.top + size / 2, 'text-anchor': 'middle', class: 'matrix__axis', transform: `rotate(-90 14 ${M.top + size / 2})` }, 'Waarde (A + B)'));

      // Punten: op dezelfde plek in een klein rondje naast elkaar
      const spots = new Map();
      entries.forEach((entry) => {
        const spot = entry.result.feasibility + ':' + entry.result.value;
        if (!spots.has(spot)) spots.set(spot, []);
        spots.get(spot).push(entry);
      });
      spots.forEach((list) => list.forEach((entry, n) => {
        const angle = (n / list.length) * Math.PI * 2;
        const spread = list.length > 1 ? 13 : 0;
        const cx = x(entry.result.feasibility) + Math.cos(angle) * spread;
        const cy = y(entry.result.value) + Math.sin(angle) * spread;
        const point = svg('g', { class: 'matrix__point', tabindex: '0', role: 'img', 'aria-label': `${entry.number}: ${entry.idea.title}. Waarde ${entry.result.value}, haalbaarheid ${entry.result.feasibility}, ${entry.result.quadrant.label}${entry.idea.assessment.risk ? ', risico ' + entry.idea.assessment.risk : ''}.` });
        point.append(
          svg('circle', { cx, cy, r: 15, class: 'matrix__hit' }),
          svg('circle', { cx, cy, r: 11, class: 'matrix__dot' }),
          svg('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'matrix__number' }, String(entry.number))
        );
        const show = () => {
          const a = entry.idea.assessment;
          // replaceChildren maakt van null de tekst 'null': alleen echte onderdelen
          readout.replaceChildren(...[
            el('p', { className: 'chart__readout-date', text: `${entry.number} · ${entry.result.quadrant.label}` }),
            el('p', { className: 'matrix__readout-title', text: entry.idea.title }),
            el('p', { className: 'chart__readout-row' }, [el('strong', { text: `Waarde ${entry.result.value}` }), el('span', { text: `A ${a.scores.A} + B ${a.scores.B}` })]),
            el('p', { className: 'chart__readout-row' }, [el('strong', { text: `Haalbaarheid ${entry.result.feasibility}` }), el('span', { text: `C ${a.scores.C} + D ${a.scores.D}` })]),
            a.risk ? el('p', { className: 'chart__readout-row' }, [el('span', { text: 'Risico ' + a.risk })]) : null
          ].filter(Boolean));
          readout.hidden = false;
          const left = cx + 18 + readout.offsetWidth <= width ? cx + 18 : Math.max(0, cx - 18 - readout.offsetWidth);
          readout.style.setProperty('--x', `${Math.round(left)}px`);
          readout.style.setProperty('--y', `${Math.round(Math.max(0, cy - 30))}px`);
        };
        const hide = () => { readout.hidden = true; };
        point.addEventListener('pointerenter', show);
        point.addEventListener('pointerleave', () => { if (document.activeElement !== point) hide(); });
        point.addEventListener('focus', show);
        point.addEventListener('blur', hide);
        root.append(point);
      }));
      box.replaceChildren(root, readout);
    }

    const observer = new ResizeObserver((items) => {
      if (!box.isConnected) {
        observer.disconnect();
        return;
      }
      const next = Math.round(items[0].contentRect.width);
      if (next && next !== width) {
        width = next;
        draw();
      }
    });
    observer.observe(box);
    return box;
  }

  /* ---- Portfolio (tabblad) ----------------------------------------------------------------- */
  /** Beoordeelde ideeën in de volgorde van de kwadranten, dan op waarde; met een volgnummer. */
  function ranked(ideas) {
    const order = (q) => QUADRANTS.findIndex((item) => item.id === q.id);
    return ideas
      .map((idea) => ({ idea, result: outcome(idea.assessment) }))
      .filter((entry) => entry.result && entry.result.quadrant)
      .sort((a, b) => order(a.result.quadrant) - order(b.result.quadrant) || b.result.value - a.result.value || b.result.feasibility - a.result.feasibility)
      .map((entry, n) => Object.assign(entry, { number: n + 1 }));
  }

  /** De registerregel van één idee, in de kolommen van REGISTER. */
  const REGISTER = ['Idee', 'Indiener', 'Eigenaar vanuit de praktijk', 'Fase', 'Probleem in één zin', 'A', 'B', 'C', 'D', 'Waarde', 'Haalbaarheid', 'Kwadrant', 'Risicoklasse', 'Technische route', 'Geschatte uren per jaar', 'Besluit', 'Datum'];
  function registerRow(idea) {
    const a = idea.assessment || {};
    const r = outcome(a) || {};
    const phase = idea.phase && ns.content.phaseById.get(idea.phase);
    const s = a.scores || {};
    return [
      idea.title, idea.name || '', a.owner || '', phase ? phase.label : idea.phase || '', a.problem || '',
      s.A, s.B, s.C, s.D, r.value, r.feasibility,
      r.knockouts && r.knockouts.length ? 'Knock-out ' + r.knockouts.join(', ') : r.quadrant ? r.quadrant.label : '',
      a.risk || '', a.route || '', a.hours != null ? a.hours : '', a.decision || '', a.assessedAt ? a.assessedAt.slice(0, 10) : ''
    ];
  }

  function render() {
    const node = el('div', { className: 'portfolio' });
    const body = el('div', { className: 'portfolio__body' });
    let ideas = [];

    async function load() {
      body.replaceChildren(el('p', { className: 'loading', text: 'Portfolio laden…' }));
      try {
        ideas = await ns.central.adminListIdeas();
        update();
      } catch (error) {
        body.replaceChildren(notice({ tone: 'warning', title: 'Laden mislukt', text: error.message }));
        if (!ns.central.signedIn()) node.dispatchEvent(new CustomEvent('signedout', { bubbles: true }));
      }
    }

    function assessButton(idea, text) {
      const button = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('flag'), el('span', { text })]);
      button.addEventListener('click', () => assess(idea, update));
      return button;
    }

    function update() {
      // Zonder kolom assessment (stap 10 nog niet uitgevoerd) ontbreekt die bij iedere inzending
      const missing = ideas.length > 0 && !ideas.some((idea) => 'assessment' in idea);
      const entries = ranked(ideas);
      const knockouts = ideas.filter((idea) => { const r = outcome(idea.assessment); return r && r.knockouts.length; });
      const open = ideas.filter((idea) => isCandidate(idea) && !outcome(idea.assessment));
      const count = (id) => entries.filter((entry) => entry.result.quadrant.id === id).length;

      body.replaceChildren(...[
        missing ? notice({ tone: 'warning', title: 'Nog niet ingericht', text: 'De database kent beoordelingen nog niet: voer setup/supabase-audit-portfolio.sql (stap 10) uit in Supabase. Daarna kun je ideeën beoordelen.' }) : null,
        el('div', { className: 'kpis' }, [
          ...QUADRANTS.map((q) => el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(count(q.id)) }), el('span', { className: 'kpi__label', text: q.label })])),
          el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(knockouts.length) }), el('span', { className: 'kpi__label', text: 'Knock-out' })]),
          el('div', { className: 'kpi' }, [el('span', { className: 'kpi__value', text: String(open.length) }), el('span', { className: 'kpi__label', text: 'Nog te beoordelen' })])
        ]),
        entries.length ? el('div', { className: 'portfolio__grid' }, [
          el('section', { className: 'usage-table' }, [
            el('h3', { className: 'usage-table__title', text: 'AI Value Matrix' }),
            el('p', { className: 'chart__sub', text: 'Waarde (kwaliteit + capaciteit) tegen haalbaarheid (techniek + time-to-value). Het nummer is de regel in de lijst.' }),
            matrix(entries)
          ]),
          el('section', { className: 'usage-table' }, [
            el('h3', { className: 'usage-table__title', text: 'Wat de kwadranten betekenen' }),
            el('dl', { className: 'portfolio__legend' }, QUADRANTS.map((q) => el('div', {}, [el('dt', {}, [el('span', { className: 'badge quadrant quadrant--' + q.id, text: q.label })]), el('dd', { text: q.text })]))),
            el('h3', { className: 'usage-table__title portfolio__subtitle', text: 'Risicoklassen' }),
            el('dl', { className: 'portfolio__legend' }, RISKS.map((r) => el('div', {}, [el('dt', { text: r.label }), el('dd', { text: r.text })])))
          ])
        ]) : el('p', { className: 'section__lead', text: 'Nog geen beoordeelde ideeën. Beoordeel een idee hieronder of bij Inzendingen.' }),
        entries.length ? el('section', { className: 'usage-table' }, [
          el('h3', { className: 'usage-table__title', text: 'Het portfolio' }),
          el('table', { className: 'table' }, [
            el('thead', {}, [el('tr', {}, ['Nr.', 'Idee', 'Waarde', 'Haalbaarheid', 'Kwadrant', 'Risico', 'Uren per jaar', 'Besluit', ''].map((column, index) => el('th', { text: column, attrs: { scope: 'col', class: [0, 2, 3, 6].includes(index) ? 'num' : null } })))]),
            el('tbody', {}, entries.map((entry) => {
              const a = entry.idea.assessment;
              return el('tr', {}, [
                el('td', { className: 'num', text: String(entry.number) }),
                el('th', { attrs: { scope: 'row' } }, [entry.idea.title, a.problem ? el('span', { className: 'copilot__note', text: a.problem }) : null]),
                el('td', { className: 'num', text: `${entry.result.value}` }),
                el('td', { className: 'num', text: `${entry.result.feasibility}` }),
                el('td', {}, [badge(entry.result), entry.result.borderline ? el('span', { className: 'copilot__note', text: 'Grensgeval' }) : null]),
                el('td', { text: a.risk || '–' }),
                el('td', { className: 'num', text: a.hours != null ? NUMBER.format(a.hours) : '–' }),
                el('td', { text: a.decision || '–' }),
                el('td', {}, [assessButton(entry.idea, 'Aanpassen')])
              ]);
            }))
          ])
        ]) : null,
        knockouts.length ? el('section', { className: 'usage-table' }, [
          el('h3', { className: 'usage-table__title', text: 'Knock-outs' }),
          el('ul', { className: 'portfolio__list', attrs: { role: 'list' } }, knockouts.map((idea) => el('li', {}, [
            el('span', { className: 'portfolio__title', text: idea.title }),
            badge(outcome(idea.assessment)),
            assessButton(idea, 'Aanpassen')
          ])))
        ]) : null,
        el('section', { className: 'usage-table' }, [
          el('h3', { className: 'usage-table__title', text: 'Nog te beoordelen' }),
          open.length ? el('ul', { className: 'portfolio__list', attrs: { role: 'list' } }, open.map((idea) => el('li', {}, [
            el('span', { className: 'admin-item__date', text: formatDate(idea.created_at) }),
            el('span', { className: 'portfolio__title', text: idea.title }),
            ns.ideas.statusBadge(idea.status),
            assessButton(idea, 'Beoordelen')
          ]))) : el('p', { className: 'section__lead', text: 'Alle ideeën en verzoeken zijn beoordeeld.' })
        ])
      ].filter(Boolean));
    }

    const exportButton = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('download'), el('span', { text: 'Registerregels (CSV)' })]);
    exportButton.addEventListener('click', () => {
      const assessed = ideas.filter((idea) => outcome(idea.assessment));
      if (!assessed.length) {
        toast('Nog niets beoordeeld om te exporteren');
        return;
      }
      kit.downloadCsv(`ai-register-${ns.cockpit.activeId()}-${new Date().toISOString().slice(0, 10)}.csv`, REGISTER, assessed.map(registerRow));
    });

    node.append(
      el('p', { className: 'field__hint portfolio__intro', text: 'Ideeën en verzoeken uit de ideeënhub, beoordeeld met de AI Value Matrix: eerst de knock-outs, dan vier scores van 0 tot 5. Waarde (A + B) en haalbaarheid (C + D) bepalen het kwadrant, de risicoklasse de route erna. Alleen hoofdbeheerders zien dit.' }),
      el('div', { className: 'filters filters--inline' }, [
        el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: load } }, [icon('refresh'), el('span', { text: 'Vernieuwen' })]),
        exportButton
      ]),
      body
    );
    load();
    return { node };
  }

  ns.adminPortfolio = { render, assess, summaryRow, outcome, badge, hoursScore, ranked, registerRow, isCandidate, KNOCKOUTS, DIMENSIONS, QUADRANTS, RISKS, REGISTER };
})(window.AIAudit);
