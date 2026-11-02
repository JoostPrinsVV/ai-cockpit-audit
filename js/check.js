/* ==========================================================================
   AI-beleid en 'Mag dit?'
   --------------------------------------------------------------------------
   - De link naar het AI-beleid van V&V (policyUrl: Beheer → Gedeelde basis →
     Teksten, anders js/config.js): onderaan iedere pagina, bij iedere agent
     en in de check.
   - 'Mag dit?': een venster met drie vragen (welke tool, welke gegevens, waar
     komt de uitkomst terecht) en een antwoord in groen, oranje of rood. Het
     antwoord volgt het AI-beleid ('Welke tools zijn toegestaan voor welke
     data?': de vier soorten data en de tabel met tools) en wat het AI-team per
     tool heeft vastgelegd in Beheer → Agents & tools (Gegevens in deze tool,
     Work + Web, Wel geschikt voor, Niet gebruiken voor). Te openen vanuit de
     voet, met Ctrl+K, bij een agent en vanuit de waarschuwing in de promptbouwer.
   - Per agent: het gegevensniveau (en 'Work + Web') als label op de kaart en
     het blok 'Wat mag erin?' op de pagina.
   Hoe dit op het beleid aansluit: README.md, 'Zo volgt de cockpit het AI-beleid'.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass } = ns.ui;
  const HTTPS = /^https:\/\/[^\s<>"'`]+$/i;

  /* Welke data erin mag, per tool (veld dataLevel), in de termen van het AI-beleid (van weinig naar veel) */
  const LEVELS = {
    algemeen: { step: 1, label: 'Alleen algemene data', short: 'Alleen algemene data', text: 'Alles wat je ook aan vrienden zou kunnen vertellen: algemene informatie, breed beschikbare kennis en geanonimiseerde cases. Geen persoonsgegevens, klantdata of hoog-risico-data.' },
    vertrouwelijk: { step: 2, label: 'Ook persoonsgegevens en klantdata', short: 'Ook klantdata', text: 'Algemene data, persoonsgegevens en vertrouwelijke klantgegevens, binnen de beheerde omgeving van Visser & Visser en je eigen toegangsrechten. Pas dataminimalisatie toe. Geen hoog-risico-data.' },
    hoog: { step: 3, label: 'Ook hoog-risico-data, na afstemming met de CTO', short: 'Ook hoog-risico (CTO)', text: 'Daarnaast hoog-risico-data, maar alleen als dat onvermijdelijk is, na afstemming met de CTO en met extra maatregelen (zoals bij de V&V in-house-apps).' }
  };
  /* De vier soorten data uit het AI-beleid; kies de zwaarste die van toepassing is */
  const DATA = [
    { id: 'algemeen', label: 'Algemene data', hint: 'Wat je ook aan vrienden zou kunnen vertellen: algemene kennis, geanonimiseerde cases' },
    { id: 'persoon', label: 'Persoonsgegevens', hint: 'Alles over een herkenbaar persoon: namen, contactgegevens, gegevens van klanten of medewerkers' },
    { id: 'klant', label: 'Vertrouwelijke klantgegevens', hint: 'Rapportages, stukken, correspondentie, contracten, of iets wat eenvoudig naar een klant te herleiden is' },
    { id: 'hoog', label: 'Hoog-risico-data', hint: 'Bijzondere persoonsgegevens (zoals gezondheid), BSN, bedrijfsgeheimen, stukken onder geheimhouding, of veel schade bij een datalek' }
  ];
  /* 'Welke tools zijn toegestaan voor welke data?' uit het AI-beleid, kort (in het venster: 'Het beleid in het kort') */
  const POLICY_TABLE = [
    { tool: 'V&V in-house-apps (zoals Ilse)', cells: ['ja', 'ja', 'ja', 'cto'] },
    { tool: 'Microsoft Copilot (alleen in de Werk-modus)', cells: ['ja', 'ja', 'ja', 'nee'] },
    { tool: 'ChatGPT, Claude, Gemini en andere LLM\'s via de browser', cells: ['privé', 'nee', 'nee', 'nee'] },
    { tool: 'Overige tools (tenzij goedgekeurd door CTO, Business IT en Legal & Risk)', cells: ['privé', 'nee', 'nee', 'nee'] }
  ];
  const CELL_TEXT = { ja: 'Toegestaan', nee: 'Niet toegestaan', cto: 'Alleen na afstemming met de CTO', privé: 'Alleen persoonlijk, niet voor je werk' };

  /**
   * Wat het AI-beleid zegt als het AI-team bij een tool niets apart heeft vastgelegd, naar de soort:
   * - Microsoft-standaard: Copilot (ingelogd, in de Werk-modus; met of zonder licentie maakt niet uit): t/m klantdata;
   * - eigen agent (Copilot Studio, binnen de beheerde omgeving): volgt Copilot; met webtoegang alleen algemene data;
   * - extern product (overige tools): alleen algemene data, tenzij goedgekeurd (dan apart vastleggen).
   */
  function policyLevel(tool) {
    if (tool.kind === 'Microsoft-standaard') return 'vertrouwelijk';
    if (tool.kind === 'Eigen agent') return tool.web ? 'algemeen' : 'vertrouwelijk';
    if (tool.kind === 'Extern product') return 'algemeen';
    return '';
  }
  const POLICY_SOURCE = { 'Microsoft-standaard': 'Microsoft Copilot in de Werk-modus', 'Eigen agent': 'agents in Copilot Studio', 'Extern product': 'overige tools' };

  /** Welke data er in een tool mag: wat het AI-team vastlegde, anders wat het beleid voor die soort zegt. */
  const levelOf = (tool) => (LEVELS[tool.dataLevel] ? tool.dataLevel : policyLevel(tool));
  // Het eerste aanspreekpunt (het beleid: één AI-aanspreekpunt per discipline); verder opschalen doen zij
  const DOUBT = 'Bij twijfel: niet gebruiken voordat je het hebt nagevraagd bij de AI-specialist van je discipline, je leidinggevende of IT.';
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
   * Het antwoord: { tone: 'ja' | 'mits' | 'nee' | 'onbekend', title, reasons: [], doubt }.
   * tool: een agent uit Agents & tools, of 'anders' (ChatGPT, Claude of een andere tool via de browser).
   * data: 'algemeen' | 'persoon' | 'klant' | 'hoog' (de soorten data uit het AI-beleid).
   */
  function verdict(tool, data, destination) {
    const reasons = [];
    let tone = 'ja';
    const worse = (next) => {
      const rank = { ja: 0, onbekend: 1, mits: 2, nee: 3 };
      if (rank[next] > rank[tone]) tone = next;
    };
    const sensitive = data === 'persoon' || data === 'klant';
    if (tool === OTHER || !tool) {
      // Zakelijk gebruik van LLM's alleen via Copilot of Ilse; overige tools alleen persoonlijk met algemene data
      worse('nee');
      reasons.push('Voor je werk gebruik je AI alleen via Microsoft Copilot (met je zakelijke account, in de Werk-modus), een V&V in-house-app zoals Ilse of een tool uit deze cockpit. ChatGPT, Claude, Gemini en andere tools via de browser zijn voor je werk niet toegestaan, ook niet betaald.');
      reasons.push(data === 'algemeen'
        ? 'Buiten je werk mag je ze alleen gebruiken voor algemene ondersteuning (taalhulp, ideeën, uitleg) en alleen met algemene data.'
        : 'Persoonsgegevens, klantdata, bedrijfsinformatie en hoog-risico-data horen er nooit in.');
    } else {
      if (tool.status === 'In ontwikkeling' || tool.stopped) {
        worse('nee');
        reasons.push(`${tool.title} is ${tool.stopped ? 'niet meer in gebruik' : 'nog in ontwikkeling en nog niet te gebruiken'}.`);
      } else if (tool.status === 'Pilot') {
        worse('mits');
        reasons.push(`${tool.title} is in pilot: alleen als je in de pilotgroep zit.`);
      }
      const level = levelOf(tool);
      if (data === 'hoog') {
        if (level === 'hoog') {
          worse('mits');
          reasons.push('Hoog-risico-data vermijd je in beginsel. Is het onvermijdelijk, stem dan vooraf af met de CTO en spreek extra maatregelen af.');
        } else {
          worse('nee');
          reasons.push(`Hoog-risico-data hoort niet in ${tool.title}. Haal het weg, anonimiseer of gebruik een [PLAATSHOUDER]; is verwerking onvermijdelijk, stem dan eerst af met de CTO.`);
        }
      } else if (sensitive) {
        const what = data === 'persoon' ? 'persoonsgegevens' : 'vertrouwelijke klantgegevens';
        if (!level) {
          worse('onbekend');
          reasons.push(`Voor ${tool.title} is nog niet vastgelegd welke data erin mag. Gebruik hem voorlopig alleen met algemene data.`);
        } else if (level === 'algemeen') {
          worse('nee');
          reasons.push(`In ${tool.title} mag alleen algemene data, geen ${what}. Anonimiseer de gegevens zodat ze niet naar een klant of persoon te herleiden zijn, of gebruik [PLAATSHOUDERS].`);
        } else {
          // Toegestaan, binnen de beheerde omgeving; persoonsgegevens alleen wat nodig is (dataminimalisatie)
          if (data === 'persoon') worse('mits');
          reasons.push(data === 'persoon'
            ? `Persoonsgegevens mogen in ${tool.title}, mits je alleen deelt wat nodig is voor de opdracht (dataminimalisatie) en anonimiseert waar het kan.`
            : `Vertrouwelijke klantgegevens mogen in ${tool.title}, binnen de beheerde omgeving van V&V en je eigen toegangsrechten. Deel niet meer dan nodig.`);
          if (tool.kind === 'Microsoft-standaard') reasons.push('Wel ingelogd met je zakelijke account (het schildje) en in de Werk-modus (Work), niet met webbronnen (Web). Met of zonder licentie maakt daarvoor geen verschil.');
          if (tool.web) reasons.push(`${tool.title} gebruikt ook webbronnen (Work + Web): deel alleen wat hiervoor uitdrukkelijk is toegestaan.`);
        }
      } else if (data === 'algemeen' && tone !== 'nee') {
        reasons.push(`Algemene data kun je in ${tool.title} gebruiken.`);
      }
      if (tone !== 'nee' && tool.web) reasons.push('Output op basis van webbronnen controleer je altijd extra: betrouwbaarheid, actualiteit, herkomst en auteursrecht.');
    }
    // Waar de uitkomst terechtkomt: wat er daarna van je verwacht wordt
    if (tone !== 'nee' && destination === 'intern') reasons.push('AI-output is een concept, geen eindproduct: beoordeel hem op juistheid, volledigheid en actualiteit, en leg in het dossier vast wat je met AI hebt gedaan.');
    if (tone !== 'nee' && destination === 'klant') reasons.push('Controleer harde feiten (cijfers, datums, citaten, wetsartikelen) aan de bron en neem tekst niet letterlijk over maar herschrijf in je eigen woorden. Het professionele oordeel en de handtekening blijven van jou.');
    const titles = { ja: 'Ja, dat mag', mits: 'Ja, mits…', nee: 'Nee, dat mag niet', onbekend: 'Nog niet vastgesteld' };
    return { tone, title: titles[tone], reasons, doubt: tone === 'mits' || tone === 'onbekend' ? DOUBT : '' };
  }

  /** 'Het beleid in het kort': de tabel met tools en soorten data, uit het AI-beleid. */
  function policyTable() {
    const icons = { ja: 'check', nee: 'close', cto: 'alert', privé: 'user' };
    return el('details', { className: 'check__policy' }, [
      el('summary', {}, [el('span', { text: 'Het beleid in het kort: welke tool voor welke data?' }), icon('chevron-down')]),
      el('div', { className: 'check__table-wrap' }, [
        el('table', { className: 'check__table' }, [
          el('thead', {}, [el('tr', {}, [el('th', { attrs: { scope: 'col' }, text: 'Tool' }), ...DATA.map((item) => el('th', { attrs: { scope: 'col' }, text: item.label }))])]),
          el('tbody', {}, POLICY_TABLE.map((row) => el('tr', {}, [
            el('th', { attrs: { scope: 'row' }, text: row.tool }),
            ...row.cells.map((cell) => el('td', { className: 'check__cell check__cell--' + (cell === 'privé' ? 'prive' : cell) }, [icon(icons[cell]), el('span', { text: CELL_TEXT[cell] })]))
          ])))
        ])
      ]),
      el('p', { className: 'check__table-note', text: 'Agents in Copilot Studio volgen Copilot, binnen de beheerde omgeving en als pilot; met webtoegang heten ze "Work + Web". ' + DOUBT })
    ]);
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
      el('option', { attrs: { value: OTHER }, text: 'ChatGPT, Claude, Gemini of een andere tool via de browser' })
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
        result.replaceChildren(el('p', { className: 'check__wait', text: 'Kies een tool en welke data erin gaat, dan zie je hier het antwoord.' }));
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
        answer.doubt ? el('p', { className: 'check__doubt' }, [icon('info'), el('span', { text: answer.doubt })]) : null,
        el('div', { className: 'check__links' }, [
          policyLink('Lees het AI-beleid', 'btn btn--secondary btn--sm'),
          el('a', { className: 'btn btn--quiet btn--sm', attrs: { href: '#/ideeen/vraag' }, on: { click: () => close() } }, [icon('question'), el('span', { text: 'Stel je vraag aan het AI-team' })])
        ])
      ]));
    }
    tool.addEventListener('change', update);
    data.addEventListener('change', update);
    where.addEventListener('change', update);

    const closeButton = ns.ui.closeButton(() => close());
    const dialog = el('dialog', { className: 'check', attrs: { 'aria-labelledby': id + '-title' } }, [
      el('form', { className: 'check__panel', attrs: { novalidate: true } }, [
        el('div', { className: 'check__head' }, [
          el('span', { className: 'check__icon', attrs: { 'aria-hidden': 'true' } }, [icon('shield')]),
          el('div', {}, [
            el('h2', { className: 'check__title', attrs: { id: id + '-title' }, text: 'Mag dit?' }),
            el('p', { className: 'check__lead', text: 'Drie vragen, dan weet je of het mag. Volgens het AI-beleid van V&V en wat het AI-team per tool heeft vastgelegd.' })
          ])
        ]),
        el('div', { className: 'field' }, [el('label', { className: 'check__question', attrs: { for: id + '-tool' } }, [el('span', { className: 'check__number', text: '1' }), 'Welke tool wil je gebruiken?']), tool]),
        el('fieldset', { className: 'check__group' }, [el('legend', { className: 'check__question' }, [el('span', { className: 'check__number', text: '2' }), 'Welke data gaat erin? ', el('span', { className: 'field__optional', text: '(kies de zwaarste)' })]), data]),
        el('fieldset', { className: 'check__group' }, [el('legend', { className: 'check__question' }, [el('span', { className: 'check__number', text: '3' }), 'Waar komt de uitkomst terecht? ', el('span', { className: 'field__optional', text: '(optioneel)' })]), where]),
        result,
        policyTable()
      ]),
      closeButton
    ]);
    dialog.querySelector('form').addEventListener('submit', (event) => event.preventDefault());

    function close() {
      if (dialog.open) dialog.close();
    }
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

  /** Labels op de kaart van een agent: welke data erin mag, en 'Work + Web' als hij ook webbronnen gebruikt. */
  function levelChip(agent) {
    const level = LEVELS[levelOf(agent)];
    return [
      level ? el('span', { className: 'data-chip data-chip--' + levelOf(agent), attrs: { title: level.text } }, [icon('shield'), level.short]) : null,
      webChip(agent)
    ].filter(Boolean);
  }

  /** 'Work + Web': het AI-beleid vraagt dat zichtbaar te maken bij een agent met webtoegang. */
  function webChip(agent) {
    return agent.web ? el('span', { className: 'data-chip data-chip--web', attrs: { title: 'Gebruikt naast je werkgegevens ook webbronnen: controleer de output extra.' } }, [icon('globe'), 'Work + Web']) : null;
  }

  /** Op de pagina van een agent: 'Wat mag erin?', wel en niet geschikt voor, het beleid en de check. */
  function agentBlock(agent) {
    const key = levelOf(agent);
    const level = LEVELS[key];
    const check = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('shield'), el('span', { text: 'Mag dit? Check het' })]);
    check.addEventListener('click', () => open({ tool: agent.id }));
    const meter = el('ol', { className: 'data-meter', attrs: { 'aria-label': 'Welke data erin mag' } }, Object.entries(LEVELS).map(([step, info]) => el('li', {
      className: 'data-meter__step' + (level && info.step <= level.step ? ' is-on' : '') + (step === key ? ' is-current' : ''),
      attrs: { 'aria-current': step === key ? 'true' : null }
    }, [el('span', { text: info.label })])));
    // Waar het niveau vandaan komt: apart vastgelegd, of het beleid voor deze soort tool
    const source = LEVELS[agent.dataLevel] ? 'Vastgelegd door het AI-team.' : POLICY_SOURCE[agent.kind] ? `Volgens het AI-beleid voor ${POLICY_SOURCE[agent.kind]}.` : '';
    return el('section', { className: 'policy-card ' + accentClass(agent.accent), attrs: { 'aria-labelledby': 'ag-policy' } }, [
      el('h2', { className: 'policy-card__title', attrs: { id: 'ag-policy' } }, [icon('shield'), el('span', { text: 'Wat mag erin?' })]),
      level ? meter : null,
      el('p', { className: 'policy-card__text', text: level ? level.text : 'Het AI-team heeft voor deze tool nog niet vastgelegd welke data erin mag. Gebruik hem voorlopig alleen met algemene data.' }),
      level && source ? el('p', { className: 'policy-card__source', text: source + (agent.kind === 'Microsoft-standaard' ? ' Ingelogd met je zakelijke account en in de Werk-modus; met of zonder licentie maakt geen verschil.' : '') }) : null,
      agent.web ? el('p', { className: 'policy-card__web' }, [webChip(agent), el('span', { text: ' Deze tool gebruikt naast je werkgegevens ook webbronnen. Controleer de output altijd extra, en deel alleen wat hiervoor uitdrukkelijk is toegestaan.' })]) : null,
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

  ns.check = { LEVELS, DATA, DESTINATIONS, POLICY_TABLE, OTHER, policyUrl, policyLevel, levelOf, verdict, open, footerLinks, levelChip, agentBlock };
})(window.AIAudit);
