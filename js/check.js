/* ==========================================================================
   AI-beleid en 'Mag dit?'
   --------------------------------------------------------------------------
   - De link naar het AI-beleid van V&V (policyUrl: Beheer → Gedeelde basis →
     Teksten, anders js/config.js): onderaan iedere pagina, bij iedere agent
     en in de check.
   - 'Mag dit?': een venster met drie vragen (welke tool, welke gegevens, waar
     komt de uitkomst terecht) en een antwoord in groen, oranje of rood. Het
     antwoord volgt uit de gouden regels en uit wat het AI-team per tool heeft
     vastgelegd in Beheer → Agents & tools (Gegevens in deze tool, Wel
     geschikt voor, Niet gebruiken voor). Te openen vanuit de voet, met
     Ctrl+K, bij een agent en vanuit de waarschuwing in de promptbouwer.
   - Per agent: het gegevensniveau als label op de kaart en het blok 'Wat
     mag erin?' op de pagina.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass } = ns.ui;
  const HTTPS = /^https:\/\/[^\s<>"'`]+$/i;

  /* Welke gegevens erin mogen, per tool (veld dataLevel; de volgorde is van weinig naar veel) */
  const LEVELS = {
    algemeen: { step: 1, label: 'Alleen algemene informatie', short: 'Geen klantgegevens', text: 'Geen klant- of persoonsgegevens: alleen algemene vragen, je eigen teksten en openbare informatie.' },
    klant: { step: 2, label: 'Klantgegevens, zonder persoonsgegevens', short: 'Klantgegevens', text: 'Cijfers, stukken en notulen van een klant, maar zonder namen of andere persoonsgegevens.' },
    vertrouwelijk: { step: 3, label: 'Klant- en persoonsgegevens, binnen V&V', short: 'Ook persoonsgegevens', text: 'Ook vertrouwelijke klantgegevens en persoonsgegevens, binnen de beveiligde omgeving van Visser & Visser. Deel niet meer dan nodig.' }
  };
  const DATA = [
    { id: 'geen', label: 'Geen klant- of persoonsgegevens', hint: 'Een algemene vraag, je eigen tekst, openbare informatie' },
    { id: 'klant', label: 'Klantgegevens zonder persoonsgegevens', hint: 'Cijfers, stukken of notulen van een klant, zonder namen' },
    { id: 'persoon', label: 'Persoonsgegevens', hint: 'Namen, contactgegevens, gegevens van medewerkers of klanten' },
    { id: 'bijzonder', label: 'BSN, medische of andere bijzondere gegevens', hint: 'Ook in een bijlage of een geplakte tekst' }
  ];
  const DESTINATIONS = [
    { id: 'zelf', label: 'Alleen voor mezelf' },
    { id: 'intern', label: 'Intern of in het dossier' },
    { id: 'klant', label: 'Naar de klant' }
  ];
  const OTHER = 'anders';

  /** De link naar het AI-beleid, of '' (alleen https://). */
  function policyUrl() {
    const url = String((ns.app && ns.app.config().policyUrl) || '').trim();
    return HTTPS.test(url) ? url : '';
  }

  const policyLink = (text, className) => {
    const url = policyUrl();
    return url ? el('a', { className: className || 'policy-link', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } }, [icon('book'), el('span', { text: text || 'Het AI-beleid van V&V' }), icon('external')]) : null;
  };

  /**
   * Het antwoord: { tone: 'ja' | 'mits' | 'nee' | 'onbekend', title, reasons: [] }.
   * tool: een agent uit Agents & tools, of 'anders' (een andere of gratis AI-tool).
   */
  function verdict(tool, data, destination) {
    const reasons = [];
    let tone = 'ja';
    const worse = (next) => {
      const rank = { ja: 0, onbekend: 1, mits: 2, nee: 3 };
      if (rank[next] > rank[tone]) tone = next;
    };
    if (tool === OTHER || !tool) {
      worse('nee');
      reasons.push('Gebruik voor je werk alleen Copilot met je zakelijke account (het schildje) of een agent of tool uit deze cockpit, nooit een gratis of privé-AI-tool.');
    } else {
      if (tool.status === 'In ontwikkeling' || tool.stopped) {
        worse('nee');
        reasons.push(`${tool.title} is ${tool.stopped ? 'niet meer in gebruik' : 'nog in ontwikkeling en nog niet te gebruiken'}.`);
      } else if (tool.status === 'Pilot') {
        worse('mits');
        reasons.push(`${tool.title} is in pilot: alleen als je in de pilotgroep zit.`);
      }
      const level = LEVELS[tool.dataLevel] ? tool.dataLevel : '';
      if (data === 'bijzonder') {
        worse('nee');
        reasons.push('Deel geen BSN, medische of andere bijzondere persoonsgegevens met AI, ook niet in Copilot. Haal ze weg of gebruik een [PLAATSHOUDER].');
      } else if (data === 'klant' || data === 'persoon') {
        if (!level) {
          worse('onbekend');
          reasons.push(`Voor ${tool.title} is nog niet vastgelegd welke gegevens erin mogen. Gebruik hem voorlopig zonder klant- en persoonsgegevens, of vraag het na bij het AI-team.`);
        } else if (data === 'klant' && level === 'algemeen') {
          worse('nee');
          reasons.push(`In ${tool.title} mogen geen klantgegevens: ${LEVELS.algemeen.text.charAt(0).toLowerCase() + LEVELS.algemeen.text.slice(1)}`);
        } else if (data === 'persoon' && level !== 'vertrouwelijk') {
          worse('nee');
          reasons.push(`In ${tool.title} mogen geen persoonsgegevens (${LEVELS[level].label.toLowerCase()}). Haal namen en andere persoonsgegevens weg, of gebruik [PLAATSHOUDERS].`);
        } else if (data === 'persoon') {
          worse('mits');
          reasons.push('Alleen de persoonsgegevens die echt nodig zijn voor de opdracht: deel niet meer dan nodig.');
        } else if (tone !== 'nee') {
          reasons.push(`${tool.title} is geschikt voor klantgegevens zonder persoonsgegevens.`);
        }
      } else if (data === 'geen' && tone !== 'nee') {
        reasons.push(`Algemene informatie kun je in ${tool.title} gebruiken.`);
      }
    }
    // Waar de uitkomst terechtkomt: wat er daarna van je verwacht wordt
    if (tone !== 'nee' && destination === 'intern') reasons.push('Controleer de uitkomst tegen de bron en leg in het dossier vast wat je met AI hebt gedaan.');
    if (tone !== 'nee' && destination === 'klant') reasons.push('Controleer de uitkomst tegen de bron en lees hem kritisch na: het professionele oordeel en de handtekening blijven van jou.');
    const titles = { ja: 'Ja, dat mag', mits: 'Ja, mits…', nee: 'Nee, dat mag niet', onbekend: 'Nog niet vastgesteld' };
    return { tone, title: titles[tone], reasons };
  }

  /* ---- Het venster ------------------------------------------------------------------ */
  let counter = 0;

  /** options: { tool (id van een agent) } om die alvast te kiezen. */
  function open(options) {
    const opts = options || {};
    const id = 'check-' + (++counter);
    const opener = document.activeElement;
    const agents = ns.content.agents.filter((agent) => !agent.stopped);

    const tool = el('select', { className: 'field__input', attrs: { id: id + '-tool' } }, [
      el('option', { attrs: { value: '' }, text: 'Kies een tool…' }),
      ...agents.map((agent) => el('option', { attrs: { value: agent.id }, text: agent.title })),
      el('option', { attrs: { value: OTHER }, text: 'Een andere AI-tool (bijv. gratis ChatGPT of een privé-account)' })
    ]);
    if (opts.tool && agents.some((agent) => agent.id === opts.tool)) tool.value = opts.tool;

    const radios = (name, items, cards) => el('div', { className: cards ? 'check__cards' : 'check__chips' }, items.map((item) => {
      const inputId = `${id}-${name}-${item.id}`;
      return el('div', { className: cards ? 'check__card' : 'check__chip' }, [
        el('input', { attrs: { id: inputId, type: 'radio', name: id + '-' + name, value: item.id } }),
        el('label', { attrs: { for: inputId } }, [el('span', { className: 'check__card-label', text: item.label }), item.hint ? el('span', { className: 'check__card-hint', text: item.hint }) : null])
      ]);
    }));
    const data = radios('data', DATA, true);
    const where = radios('where', DESTINATIONS, false);
    const result = el('div', { className: 'check__result', attrs: { 'aria-live': 'polite' } });

    const value = (group) => {
      const checked = group.querySelector('input:checked');
      return checked ? checked.value : '';
    };
    function update() {
      const chosenTool = tool.value === OTHER ? OTHER : agents.find((agent) => agent.id === tool.value) || null;
      const chosenData = value(data);
      if (!tool.value || !chosenData) {
        result.replaceChildren(el('p', { className: 'check__wait', text: 'Kies een tool en welke gegevens erin gaan, dan zie je hier het antwoord.' }));
        return;
      }
      const answer = verdict(chosenTool, chosenData, value(where));
      const iconName = { ja: 'check-circle', mits: 'alert', nee: 'close', onbekend: 'question' }[answer.tone];
      const notes = chosenTool && chosenTool !== OTHER ? [
        chosenTool.useFor.length ? el('div', { className: 'check__notes' }, [el('p', { className: 'check__notes-title', text: 'Wel geschikt voor' }), el('ul', {}, chosenTool.useFor.map((line) => el('li', { text: line })))]) : null,
        chosenTool.notFor.length ? el('div', { className: 'check__notes check__notes--not' }, [el('p', { className: 'check__notes-title', text: 'Niet gebruiken voor' }), el('ul', {}, chosenTool.notFor.map((line) => el('li', { text: line })))]) : null
      ] : [];
      result.replaceChildren(el('div', { className: 'check__answer check__answer--' + answer.tone }, [
        el('p', { className: 'check__verdict' }, [el('span', { className: 'check__lamp', attrs: { 'aria-hidden': 'true' } }, [icon(iconName)]), el('span', { text: answer.title })]),
        el('ul', { className: 'check__reasons' }, answer.reasons.map((line) => el('li', { text: line }))),
        ...notes,
        el('div', { className: 'check__links' }, [
          policyLink('Lees het AI-beleid', 'btn btn--secondary btn--sm'),
          el('a', { className: 'btn btn--quiet btn--sm', attrs: { href: '#/ideeen/vraag' }, on: { click: () => close() } }, [icon('question'), el('span', { text: 'Twijfel je? Stel je vraag' })])
        ])
      ]));
    }
    tool.addEventListener('change', update);
    data.addEventListener('change', update);
    where.addEventListener('change', update);

    const closeButton = el('button', { className: 'btn btn--quiet btn--icon check__close', attrs: { type: 'button', 'aria-label': 'Sluiten' } }, [icon('close')]);
    const dialog = el('dialog', { className: 'check', attrs: { 'aria-labelledby': id + '-title' } }, [
      el('form', { className: 'check__panel', attrs: { novalidate: true } }, [
        el('div', { className: 'check__head' }, [
          el('span', { className: 'check__icon', attrs: { 'aria-hidden': 'true' } }, [icon('shield')]),
          el('div', {}, [
            el('h2', { className: 'check__title', attrs: { id: id + '-title' }, text: 'Mag dit?' }),
            el('p', { className: 'check__lead', text: 'Drie vragen, dan weet je of het mag. Op basis van de gouden regels en wat het AI-team per tool heeft vastgelegd.' })
          ]),
          closeButton
        ]),
        el('div', { className: 'field' }, [el('label', { className: 'check__question', attrs: { for: id + '-tool' } }, [el('span', { className: 'check__number', text: '1' }), 'Welke tool wil je gebruiken?']), tool]),
        el('fieldset', { className: 'check__group' }, [el('legend', { className: 'check__question' }, [el('span', { className: 'check__number', text: '2' }), 'Welke gegevens gaan erin?']), data]),
        el('fieldset', { className: 'check__group' }, [el('legend', { className: 'check__question' }, [el('span', { className: 'check__number', text: '3' }), 'Waar komt de uitkomst terecht? ', el('span', { className: 'field__optional', text: '(optioneel)' })]), where]),
        result
      ])
    ]);
    dialog.querySelector('form').addEventListener('submit', (event) => event.preventDefault());

    function close() {
      if (dialog.open) dialog.close();
    }
    closeButton.addEventListener('click', close);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    });

    update();
    document.body.append(dialog);
    dialog.showModal();
    (tool.value ? data.querySelector('input') : tool).focus();
  }

  /* ---- Bouwstenen voor de voet en de agents ----------------------------------------- */
  /** Onderaan iedere pagina: de link naar het beleid en de knop 'Mag dit?'. */
  function footerLinks() {
    const button = el('button', { className: 'btn btn--ghost-dark btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('shield'), el('span', { text: 'Mag dit? Check het in drie vragen' })]);
    button.addEventListener('click', () => open());
    return [policyLink('Lees het AI-beleid van V&V', 'footer__policy-link'), button].filter(Boolean);
  }

  /** Label op de kaart van een agent: welke gegevens erin mogen (of niets als dat niet is vastgelegd). */
  function levelChip(agent) {
    const level = LEVELS[agent.dataLevel];
    return level ? el('span', { className: 'data-chip data-chip--' + agent.dataLevel, attrs: { title: level.text } }, [icon('shield'), level.short]) : null;
  }

  /** Op de pagina van een agent: 'Wat mag erin?', wel en niet geschikt voor, het beleid en de check. */
  function agentBlock(agent) {
    const level = LEVELS[agent.dataLevel];
    const check = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('shield'), el('span', { text: 'Mag dit? Check het' })]);
    check.addEventListener('click', () => open({ tool: agent.id }));
    const meter = el('ol', { className: 'data-meter', attrs: { 'aria-label': 'Welke gegevens erin mogen' } }, Object.entries(LEVELS).map(([key, info]) => el('li', {
      className: 'data-meter__step' + (level && info.step <= level.step ? ' is-on' : '') + (key === agent.dataLevel ? ' is-current' : ''),
      attrs: { 'aria-current': key === agent.dataLevel ? 'true' : null }
    }, [el('span', { text: info.label })])));
    return el('section', { className: 'policy-card ' + accentClass(agent.accent), attrs: { 'aria-labelledby': 'ag-policy' } }, [
      el('h2', { className: 'policy-card__title', attrs: { id: 'ag-policy' } }, [icon('shield'), el('span', { text: 'Wat mag erin?' })]),
      level ? meter : null,
      el('p', { className: 'policy-card__text', text: level ? level.text : 'Het AI-team heeft voor deze tool nog niet vastgelegd welke gegevens erin mogen. Gebruik hem voorlopig zonder klant- en persoonsgegevens.' }),
      agent.useFor.length ? el('div', { className: 'policy-card__list policy-card__list--yes' }, [
        el('h3', { className: 'policy-card__subtitle', text: 'Wel geschikt voor' }),
        el('ul', { attrs: { role: 'list' } }, agent.useFor.map((line) => el('li', {}, [icon('check'), el('span', { text: line })])))
      ]) : null,
      agent.notFor.length ? el('div', { className: 'policy-card__list policy-card__list--no' }, [
        el('h3', { className: 'policy-card__subtitle', text: 'Niet gebruiken voor' }),
        el('ul', { attrs: { role: 'list' } }, agent.notFor.map((line) => el('li', {}, [icon('close'), el('span', { text: line })])))
      ]) : null,
      el('div', { className: 'policy-card__actions' }, [check, policyLink('Het AI-beleid van V&V', 'btn btn--secondary btn--sm')])
    ]);
  }

  ns.check = { LEVELS, DATA, DESTINATIONS, OTHER, policyUrl, verdict, open, footerLinks, levelChip, agentBlock };
})(window.AIAudit);
