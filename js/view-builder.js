/* ==========================================================================
   Promptbouwer (#/promptbouwer)
   --------------------------------------------------------------------------
   Stap voor stap een goede prompt: rol, doel, context, bron en verwachting
   (de opbouw die Microsoft voor Copilot aanraadt), plus een paar extra's.
   Rechts groeit de prompt mee, met een meter (0 tot 100) en wat er nog mist.
   Kopiëren gaat met je gegevens uit Mijn gegevens erin. Wat je hier typt
   blijft alleen staan zolang de site open is (niet bewaard: het kan over een
   klant gaan); lijkt er een BSN of IBAN in te staan, dan waarschuwt de bouwer.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, pageHeader, copyButton, copilotButton } = ns.ui;
  const SENSITIVE = /\b\d{9}\b|\bNL\d{2}\s?[A-Z]{4}(\s?\d){10}\b/i;

  // Wat je invult, zolang de site open is
  const state = { role: '', goal: '', context: '', source: '', onlySource: false, formats: [], expect: '', extras: [] };

  const ROLES = {
    audit: ['Je bent een ervaren auditor', 'Je bent een kritische reviewer van een controledossier', 'Je bent een IT-auditor'],
    accountancy: ['Je bent een ervaren samenstellend accountant', 'Je bent een fiscalist', 'Je bent een adviseur voor mkb-ondernemers'],
    algemeen: ['Je bent een ervaren adviseur bij een accountantskantoor', 'Je bent een communicatieadviseur', 'Je bent een kritische meelezer']
  };
  const VERBS = ['Vat samen', 'Analyseer', 'Schrijf een e-mail', 'Maak een tabel van', 'Vergelijk', 'Controleer', 'Bedenk vragen over'];
  const SOURCES = ['het bijgevoegde document', 'de e-mail hieronder', 'de tekst hieronder', '/[BESTANDSNAAM] (kies het bestand met /)', 'de Teams-vergadering', 'alleen je algemene kennis, zonder bestanden'];
  const FORMATS = ['een tabel', 'een opsomming', 'een korte e-mail', 'maximaal 200 woorden', 'een zakelijke toon', 'spreek de klant aan met u', 'stap voor stap', 'in het Engels'];
  const EXTRAS = [
    'Stel me eerst vragen als iets onduidelijk is.',
    'Noem bij ieder punt waar het in de bron staat.',
    'Geef aan waar je twijfelt of iets niet zeker weet.',
    'Doe geen aannames over bedragen of data die niet in de bron staan.'
  ];
  const EXAMPLES = [
    { label: 'E-mail aan een klant', values: { role: 'Je bent een ervaren adviseur bij een accountantskantoor', goal: 'Schrijf een vriendelijke e-mail aan [KLANTNAAM] waarin ik de ontbrekende stukken voor het jaarwerk opvraag.', context: 'De klant is een mkb-ondernemer die weinig tijd heeft. De deadline is [DATUM].', source: 'de tekst hieronder', formats: ['een korte e-mail', 'maximaal 200 woorden'], expect: 'Zet de stukken in een genummerde lijst. Onderteken met [NAAM].' } },
    { label: 'Notulen samenvatten', values: { role: 'Je bent een ervaren notulist', goal: 'Vat de vergadering samen in besluiten, acties en open punten.', context: 'Het overleg ging over de planning van de controle. De samenvatting gaat naar het hele team.', source: 'de Teams-vergadering', formats: ['een tabel'], expect: 'Per actie: wie, wat en wanneer.', extras: ['Noem bij ieder punt waar het in de bron staat.'] } },
    { label: 'Cijfers vergelijken', values: { role: 'Je bent een kritische controller', goal: 'Vergelijk de cijfers van [JAAR] met [VORIG JAAR] en noem de grootste verschillen met een mogelijke verklaring.', context: 'Ik bereid een gesprek met de klant voor en wil weten waar ik naar moet vragen.', source: 'het bijgevoegde document', onlySource: true, formats: ['een tabel'], expect: 'Kolommen: post, bedrag dit jaar, vorig jaar, verschil, mogelijke verklaring.', extras: ['Doe geen aannames over bedragen of data die niet in de bron staan.'] } }
  ];

  const EMPTY = { role: '', goal: '', context: '', source: '', onlySource: false, formats: [], expect: '', extras: [] };
  const full = (values) => Object.assign({}, EMPTY, values || state);
  const words = (value) => value.trim().split(/\s+/).filter(Boolean).length;
  const sentence = (value) => {
    const text = value.trim();
    return text && !/[.!?:]$/.test(text) ? text + '.' : text;
  };

  /** De prompt die uit de stappen ontstaat (lege stappen vallen weg). */
  function compose(values) {
    const v = full(values);
    const parts = [];
    if (v.role.trim()) parts.push(sentence(v.role));
    if (v.goal.trim()) parts.push(sentence(v.goal));
    if (v.context.trim()) parts.push(sentence(v.context));
    const source = [];
    if (v.source.trim()) source.push(`Gebruik ${v.source.trim().replace(/[.]$/, '')}.`);
    if (v.onlySource) source.push('Gebruik alleen deze bron; staat iets er niet in, zeg dat dan.');
    if (source.length) parts.push(source.join(' '));
    const expect = [];
    if (v.formats.length) expect.push(`Lever het op als ${v.formats.join(', ').replace(/, ([^,]*)$/, ' en $1')}.`);
    if (v.expect.trim()) expect.push(sentence(v.expect));
    if (expect.length) parts.push(expect.join(' '));
    if (v.extras.length) parts.push(v.extras.join('\n'));
    return parts.join('\n\n');
  }

  /**
   * Hoe goed de prompt is: { score (0-100), checks: [{ id, label, ok, tip }] }. Doel weegt het
   * zwaarst; een kort doel of korte context telt half.
   */
  function score(values) {
    const v = full(values);
    const goalWords = words(v.goal);
    const contextWords = words(v.context);
    const checks = [
      { id: 'goal', label: 'Doel', points: goalWords >= 6 ? 35 : goalWords ? 20 : 0, max: 35, tip: goalWords ? 'Maak je doel concreter: wat moet er precies uitkomen?' : 'Begin met je doel: wat moet Copilot doen?' },
      { id: 'context', label: 'Context', points: contextWords >= 8 ? 20 : contextWords ? 10 : 0, max: 20, tip: contextWords ? 'Iets meer context: voor wie is het, en waarom?' : 'Geef context: voor wie is het, en wat moet Copilot weten?' },
      { id: 'source', label: 'Bron', points: v.source.trim() ? 15 : 0, max: 15, tip: 'Zeg welke bron Copilot gebruikt: een bestand, e-mail of tekst.' },
      { id: 'expect', label: 'Verwachting', points: v.formats.length || v.expect.trim() ? 15 : 0, max: 15, tip: 'Zeg hoe je het wilt hebben: een tabel, opsomming, lengte of toon.' },
      { id: 'role', label: 'Rol', points: v.role.trim() ? 10 : 0, max: 10, tip: 'Geef Copilot een rol, bijv. "Je bent een ervaren auditor".' },
      { id: 'extra', label: 'Extra zekerheid', points: v.extras.length || v.onlySource ? 5 : 0, max: 5, tip: 'Laat Copilot vragen stellen of zijn bron noemen.' }
    ].map((check) => Object.assign(check, { ok: check.points === check.max }));
    return { score: checks.reduce((total, check) => total + check.points, 0), checks };
  }

  const LEVELS = [[90, 'Copilot-klaar'], [70, 'Sterk'], [40, 'Op koers'], [1, 'Nog vaag'], [0, 'Nog leeg']];
  const levelOf = (value) => LEVELS.find(([min]) => value >= min)[1];

  /* ---- Meter (halve wijzerplaat, versiering; het getal en de lijst staan ernaast) ---- */
  const SVG = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((key) => node.setAttribute(key, attrs[key]));
    return node;
  }

  function gauge() {
    const root = svg('svg', { class: 'meter__dial', viewBox: '-110 -104 220 118', 'aria-hidden': 'true', focusable: 'false' });
    root.append(svg('path', { class: 'meter__track', d: 'M -90 0 A 90 90 0 0 1 90 0' }));
    const fill = svg('path', { class: 'meter__fill', d: 'M -90 0 A 90 90 0 0 1 90 0', pathLength: '100' });
    root.append(fill);
    for (let n = 0; n <= 10; n++) {
      const angle = Math.PI - (n / 10) * Math.PI;
      const [c, s] = [Math.cos(angle), -Math.sin(angle)];
      root.append(svg('line', { class: 'meter__tick', x1: (c * 100).toFixed(1), y1: (s * 100).toFixed(1), x2: (c * (n % 5 ? 104 : 108)).toFixed(1), y2: (s * (n % 5 ? 104 : 108)).toFixed(1) }));
    }
    const needle = svg('g', { class: 'meter__needle' });
    needle.append(svg('line', { x1: 0, y1: 0, x2: -78, y2: 0 }));
    needle.append(svg('circle', { r: 6 }));
    root.append(needle);
    return {
      node: root,
      set(value) {
        fill.style.strokeDasharray = `${value} 100`;
        needle.style.transform = `rotate(${(value / 100) * 180}deg)`;
      }
    };
  }

  /**
   * Kaart naar de promptbouwer (op de promptdatabase en bij een tip over prompts): donker, met een
   * kleine meter waarvan de naald bij hover of focus uitslaat (alleen CSS). options: { title, lead }.
   */
  function teaser(options) {
    const opts = options || {};
    return el('a', { className: 'builder-teaser' + (opts.className ? ' ' + opts.className : ''), attrs: { href: '#/promptbouwer' } }, [
      el('span', { className: 'builder-teaser__meter', attrs: { 'aria-hidden': 'true' } }, [gauge().node]),
      el('span', { className: 'builder-teaser__text' }, [
        el('span', { className: 'builder-teaser__eyebrow', text: 'Promptbouwer' }),
        el('span', { className: 'builder-teaser__title', text: opts.title || 'Liever zelf schrijven?' }),
        el('span', { className: 'builder-teaser__lead', text: opts.lead || 'Bouw je prompt in zes stappen. De meter laat zien wat er nog beter kan.' }),
        el('span', { className: 'builder-teaser__go' }, [el('span', { text: 'Open de promptbouwer' }), icon('arrow-right')])
      ])
    ]);
  }

  /* ---- Bouwstenen van het formulier ---- */
  function chips(label, values, onPick, options) {
    const opts = options || {};
    return el('div', { className: 'chips builder__chips', attrs: { role: 'group', 'aria-label': label } }, values.map((value) => {
      const pressed = opts.pressed ? opts.pressed(value) : null;
      const btn = el('button', { className: 'builder__chip', attrs: { type: 'button', 'aria-pressed': pressed === null ? null : String(pressed) } }, [opts.plus ? icon('plus') : null, el('span', { text: value })]);
      btn.addEventListener('click', () => onPick(value, btn));
      return btn;
    }));
  }

  function render() {
    const disciplineId = ns.cockpit.activeId();
    const fields = {};
    const preview = el('pre', { className: 'prompt-box__text builder__preview', attrs: { tabindex: '0', role: 'region', 'aria-label': 'Je prompt' } });
    const meterValue = el('span', { className: 'meter__value' });
    const meterLabel = el('span', { className: 'meter__label' });
    const meter = gauge();
    const checklist = el('ul', { className: 'builder__checks', attrs: { role: 'list' } });
    const checkButton = el('button', { className: 'builder__check-link', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [el('span', { text: 'Mag dit? Check het' })]);
    checkButton.addEventListener('click', () => ns.check.open());
    const warning = el('div', { className: 'builder__warning', attrs: { role: 'alert', hidden: true } }, [icon('alert'), el('span', {}, ['Dit lijkt op een BSN of rekeningnummer. Deel niet meer dan nodig: haal persoons- en klantgegevens weg of gebruik een [PLAATSHOUDER]. ', checkButton])]);
    const announcer = el('p', { className: 'sr-only', attrs: { 'aria-live': 'polite' } });
    let lastLevel = '';

    function update() {
      const text = compose();
      const mine = ns.profile.values(text);
      preview.replaceChildren(...(text ? ns.ui.promptNodes(text, mine, Object.keys(mine)) : [el('span', { className: 'builder__empty', text: 'Je prompt verschijnt hier terwijl je de stappen invult.' })]));
      const result = score();
      meter.set(result.score);
      meterValue.textContent = String(result.score);
      const level = levelOf(result.score);
      meterLabel.textContent = level;
      if (level !== lastLevel && lastLevel) announcer.textContent = `Prompt: ${result.score} van de 100, ${level.toLowerCase()}`;
      lastLevel = level;
      const firstMissing = result.checks.find((check) => !check.ok);
      checklist.replaceChildren(...result.checks.map((check) => el('li', { className: 'builder__check' + (check.ok ? ' is-ok' : '') + (check === firstMissing ? ' is-next' : '') }, [
        icon(check.ok ? 'check-circle' : 'info'),
        el('span', {}, [el('strong', { text: check.label }), check.ok ? '' : el('span', { className: 'builder__tip', text: ' ' + check.tip })])
      ])));
      warning.hidden = !SENSITIVE.test(text);
      actions.hidden = !text;
    }

    const textField = (key, label, hint, rows, placeholder) => {
      const id = 'pb-' + key;
      const input = el(rows ? 'textarea' : 'input', { className: 'field__input' + (rows ? ' field__textarea builder__area' : ''), attrs: { id, rows: rows || null, type: rows ? null : 'text', placeholder, spellcheck: 'true', 'aria-describedby': id + '-hint', autocomplete: 'off' } });
      input.value = state[key];
      input.addEventListener('input', () => {
        state[key] = input.value;
        update();
      });
      fields[key] = input;
      return { input, label: el('label', { className: 'field__label', attrs: { for: id }, text: label }), hint: el('p', { className: 'field__hint', attrs: { id: id + '-hint' }, text: hint }) };
    };
    const setField = (key, value) => {
      state[key] = value;
      fields[key].value = value;
      update();
    };

    const step = (number, title, body, accent) => el('section', { className: 'builder__step ' + ns.ui.accentClass(accent), attrs: { 'aria-labelledby': 'pb-step-' + number } }, [
      el('h2', { className: 'builder__step-title', attrs: { id: 'pb-step-' + number } }, [el('span', { className: 'builder__step-number', text: String(number), attrs: { 'aria-hidden': 'true' } }), el('span', { text: title })]),
      ...body
    ]);

    // 1. Rol
    const role = textField('role', 'Wie is Copilot?', 'Een rol zet Copilot in de juiste stand.', 0, 'Bijv. Je bent een ervaren auditor');
    const roleChips = chips('Voorbeelden van een rol', ROLES[disciplineId] || ROLES.algemeen, (value) => setField('role', value), { plus: true });
    // 2. Doel
    const goal = textField('goal', 'Wat moet Copilot doen?', 'Begin met een werkwoord en wees concreet over wat eruit moet komen.', 3, 'Bijv. Vat de notulen samen in besluiten, acties en open punten');
    const verbChips = chips('Begin met een werkwoord', VERBS, (verb) => {
      const rest = state.goal.replace(/^(Vat samen|Analyseer|Schrijf een e-mail|Maak een tabel van|Vergelijk|Controleer|Bedenk vragen over)\b\s*/i, '');
      setField('goal', verb + ' ' + rest);
      fields.goal.focus();
    });
    // 3. Context
    const context = textField('context', 'Wat moet Copilot weten?', 'Voor wie is het, waarom, en wat is de situatie? Gebruik [PLAATSHOUDERS] in plaats van klantnamen.', 3, 'Bijv. Het overleg ging over de planning; de samenvatting gaat naar het team');
    const me = ns.profile.get();
    const about = [me.functie ? `Ik werk als ${me.functie.toLowerCase()} bij ${ns.app.config().organizationName || 'Visser & Visser'}` : '', me.team ? `in ${me.team}` : '', me.klanten ? `en werk vooral voor ${me.klanten}` : ''].filter(Boolean).join(' ');
    const aboutButton = about
      ? el('button', { className: 'builder__chip', attrs: { type: 'button' } }, [icon('user'), el('span', { text: 'Over mij invoegen' })])
      : el('a', { className: 'builder__link', attrs: { href: '#/mijn' } }, [icon('user'), el('span', { text: 'Vul je functie in bij Mijn gegevens, dan kun je die hier invoegen' })]);
    if (about) {
      aboutButton.addEventListener('click', () => {
        setField('context', (state.context.trim() ? state.context.trim() + ' ' : '') + sentence(about));
        fields.context.focus();
      });
    }
    // 4. Bron
    const source = textField('source', 'Welke bron gebruikt Copilot?', 'Met / kies je in Copilot een bestand; of plak de tekst onder je prompt.', 0, 'Bijv. het bijgevoegde document');
    const sourceChips = chips('Voorbeelden van een bron', SOURCES, (value) => setField('source', value), { plus: true });
    const only = el('input', { attrs: { id: 'pb-only', type: 'checkbox', checked: state.onlySource } });
    only.addEventListener('change', () => {
      state.onlySource = only.checked;
      update();
    });
    // 5. Verwachting
    const formatChips = chips('Vorm', FORMATS, (value, btn) => {
      const on = !state.formats.includes(value);
      state.formats = on ? state.formats.concat(value) : state.formats.filter((f) => f !== value);
      btn.setAttribute('aria-pressed', String(on));
      update();
    }, { pressed: (value) => state.formats.includes(value) });
    const expect = textField('expect', 'Nog iets over de vorm?', 'Bijv. de kolommen van een tabel, of met wie je ondertekent ([NAAM]).', 2, 'Bijv. Kolommen: post, dit jaar, vorig jaar, verschil');
    // 6. Extra
    const extras = el('div', { className: 'builder__extras' }, EXTRAS.map((line, index) => {
      const id = 'pb-extra-' + index;
      const box = el('input', { attrs: { id, type: 'checkbox', checked: state.extras.includes(line) } });
      box.addEventListener('change', () => {
        state.extras = box.checked ? state.extras.concat(line) : state.extras.filter((l) => l !== line);
        update();
      });
      return el('label', { className: 'check', attrs: { for: id } }, [box, el('span', { text: line })]);
    }));

    // Voorbeelden en opnieuw beginnen
    const apply = (values) => {
      Object.assign(state, JSON.parse(JSON.stringify(EMPTY)), JSON.parse(JSON.stringify(values)));
      ns.app.refresh();
    };
    const examples = el('div', { className: 'builder__examples' }, [
      el('span', { className: 'builder__examples-label', text: 'Begin met een voorbeeld:' }),
      ...EXAMPLES.map((example) => el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' }, on: { click: () => apply(example.values) } }, [el('span', { text: example.label })]))
    ]);
    const reset = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Opnieuw beginnen' })]);
    reset.addEventListener('click', () => apply({}));

    // Kopiëren, Copilot en delen
    const filled = () => ns.profile.fill(compose());
    // Delen in een venster op deze pagina (js/view-ideas.js), met de prompt al ingevuld
    const share = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('message-plus'), el('span', { text: 'Deel je prompt' })]);
    share.addEventListener('click', () => ns.ideas.quick({ kind: 'prompt', title: state.goal.trim().slice(0, 100), body: compose() }));
    // Een sterke prompt (90+) gekopieerd: in je logboek, hoogstens één keer per dag (js/brevet.js)
    const onCopy = () => {
      if (score().score >= 90) ns.brevet.record('builder_strong', ns.content.today());
    };
    const actions = el('div', { className: 'builder__actions' }, [
      copyButton(filled, { label: 'Kopieer prompt', onCopy }),
      copilotButton(filled, { className: 'btn--sm', onCopy }),
      share
    ]);

    const form = el('div', { className: 'builder__steps' }, [
      examples,
      step(1, 'Rol', [role.label, role.hint, role.input, roleChips], 'navy'),
      step(2, 'Doel', [goal.label, goal.hint, verbChips, goal.input], 'crimson'),
      step(3, 'Context', [context.label, context.hint, context.input, el('div', { className: 'builder__chips' }, [aboutButton])], 'teal'),
      step(4, 'Bron', [source.label, source.hint, source.input, sourceChips, el('label', { className: 'check', attrs: { for: 'pb-only' } }, [only, el('span', { text: 'Alleen deze bron: zegt Copilot het als iets er niet in staat' })])], 'steel'),
      step(5, 'Verwachting', [el('p', { className: 'field__label', text: 'Hoe wil je het hebben?' }), formatChips, expect.label, expect.hint, expect.input], 'deepteal'),
      step(6, 'Extra zekerheid', [extras], 'rose'),
      el('div', { className: 'builder__foot' }, [reset, el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Wat je hier typt wordt niet bewaard en nergens heen gestuurd: weg zodra je de site sluit.' })])])
    ]);

    const aside = el('aside', { className: 'builder__aside', attrs: { 'aria-label': 'Je prompt en de meter' } }, [
      el('div', { className: 'meter on-dark' }, [
        meter.node,
        el('p', { className: 'meter__readout' }, [meterValue, el('span', { className: 'meter__max', text: '/100' })]),
        meterLabel,
        announcer
      ]),
      checklist,
      warning,
      el('h2', { className: 'builder__preview-title', text: 'Je prompt' }),
      preview,
      actions
    ]);

    update();
    const node = el('div', { className: 'page container' }, [
      pageHeader({ eyebrow: 'Promptbouwer', title: 'Bouw je eigen prompt', lead: 'Een goede prompt heeft een doel, context, een bron en een verwachting. Vul de stappen in; rechts groeit je prompt mee en zie je wat er nog beter kan.' }),
      el('div', { className: 'builder' }, [form, aside])
    ]);
    return { node, title: 'Promptbouwer' };
  }

  ns.views = ns.views || {};
  ns.views.builder = { render, teaser, compose, score };
})(window.AIAudit);
