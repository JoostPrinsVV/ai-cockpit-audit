/* ==========================================================================
   Beheer → Inhoud → Trainingen: naslagwerk maken met Copilot
   --------------------------------------------------------------------------
   Zonder bestanden of ontwikkelaar een naslagwerk vullen:
     1. kopieer de prompt hieronder (PROMPT);
     2. plak hem in Copilot Chat (werkaccount), met de PowerPoint of PDF en het
        transcript van de Teams-opname erbij;
     3. plak het antwoord in Beheer: parse() haalt eruit wat de cockpit kent
        (kernpunten, acties met stappen en prompts, hoofdstukken, uit de zaal)
        en het formulier van de training wordt ingevuld (js/admin-content.js).
   Slides zelf komen er niet uit Copilot: die upload je in één keer (alle
   dia's als JPEG). Alles blijft een voorstel: nakijken, opslaan, publiceren.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon } = ns.ui;

  const PROMPT = `Je maakt een naslagwerk van een interne training over Copilot, voor collega's van Visser & Visser. Gebruik alleen de bijgevoegde slides en het transcript van de training.

Geef je antwoord als één JSON-object, zonder uitleg ervoor of erna, in precies deze vorm:
{
  "title": "titel van de training",
  "subtitle": "één zin: wat je na deze training kunt",
  "description": "twee of drie zinnen over waar de training over ging",
  "duration": "bijv. 60 min",
  "chapters": [{ "time": "mm:ss", "title": "onderwerp" }],
  "takeaways": [{ "title": "kop", "text": "twee of drie zinnen", "warning": false }],
  "actions": [{
    "title": "korte opdracht, bijv. Stel je persoonlijke instructies in",
    "text": "wat het oplevert, in één of twee zinnen",
    "slide": 0,
    "more": "Zo pak je het aan",
    "howto": [{ "title": "kop", "steps": ["stap 1", "stap 2"] }],
    "note": "",
    "prompts": [{ "label": "kop", "text": "prompt met [PLAATSHOUDERS]" }]
  }],
  "ideas": [{ "title": "kop", "text": "een idee uit de zaal" }],
  "questions": ["een open vraag uit de zaal"]
}

Regels:
- Schrijf in het Nederlands, helder en zakelijk (taalniveau B1), en spreek de lezer aan met je.
- takeaways: 3 tot 5 kernpunten. Zet "warning": true alleen bij een belangrijk aandachtspunt, zoals de output altijd controleren of geen klantgegevens in een tool die daar niet voor is goedgekeurd.
- actions: 3 tot 6 concrete dingen die een collega na de training zelf kan doen, met stappen en waar het past een prompt om te kopiëren. "slide" is het nummer van de slide waar het over gaat, of 0.
- Prompts: plaatshouders in hoofdletters tussen blokhaken, zoals [KLANTNAAM] of [PERIODE, bijv. Q3].
- chapters: alleen als het transcript tijden heeft (mm:ss of u:mm:ss); anders een lege lijst.
- ideas en questions: wat deelnemers inbrachten, zonder namen en niet herleidbaar tot personen.
- Noem geen namen van deelnemers, geen klantnamen en geen interne of vertrouwelijke informatie. Twijfel je, laat het weg.
- Verzin niets wat niet in de slides of het transcript staat.`;

  const SENSITIVE = /\b\d{9}\b|\bNL\d{2}\s?[A-Z]{4}(\s?\d){10}\b/i;
  const EMAIL = /[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i;
  const TIME = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

  // Tekst: zonder stuurtekens, getrimd, met een maximale lengte
  const str = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 600) : '');
  const arr = (value) => (Array.isArray(value) ? value : []);
  const strings = (value, max) => arr(value).map((item) => str(item, max)).filter(Boolean);
  // Een object met alleen de ingevulde velden (zoals Beheer ze bewaart)
  const compact = (object) => {
    const out = {};
    Object.entries(object).forEach(([key, value]) => {
      if (value === '' || value == null || value === false || (Array.isArray(value) && !value.length)) return;
      out[key] = value;
    });
    return out;
  };

  /**
   * Het antwoord van Copilot → velden van een training. Geeft { data, warnings, summary }; gooit een
   * Error met uitleg als er geen bruikbare JSON in staat.
   */
  function parse(raw) {
    let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Er staat geen JSON in. Kopieer het hele antwoord van Copilot, van de eerste { tot en met de laatste }.');
    text = text.slice(start, end + 1);
    let source;
    try {
      source = JSON.parse(text);
    } catch (error) {
      throw new Error('Dit is geen geldige JSON (misschien niet helemaal gekopieerd). Vraag Copilot: "Geef alleen het JSON-object, zonder uitleg", en plak het opnieuw.');
    }
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Het antwoord is geen JSON-object. Gebruik de prompt hierboven en plak het hele antwoord.');

    const warnings = [];
    const data = compact({
      title: str(source.title, 140),
      subtitle: str(source.subtitle, 240),
      description: str(source.description, 1200),
      duration: str(source.duration, 40),
      chapters: arr(source.chapters)
        .map((chapter) => compact({ time: str(chapter && chapter.time, 8), title: str(chapter && chapter.title, 140) }))
        .filter((chapter) => chapter.title && TIME.test(chapter.time || '')),
      takeaways: arr(source.takeaways)
        .map((card) => compact({ title: str(card && card.title, 120), text: str(card && card.text, 800), warning: Boolean(card && card.warning === true) }))
        .filter((card) => card.title || card.text),
      actions: arr(source.actions).map((action) => {
        const a = action || {};
        const slide = Math.round(Number(a.slide));
        return compact({
          title: str(a.title, 140),
          text: str(a.text, 800),
          slide: Number.isFinite(slide) && slide > 0 ? String(slide) : '',
          more: str(a.more, 80),
          howto: arr(a.howto).map((list) => compact({ title: str(list && list.title, 120), steps: strings(list && list.steps, 400) })).filter((list) => list.steps && list.steps.length),
          note: str(a.note, 600),
          prompts: arr(a.prompts).map((prompt) => compact({ label: str(prompt && prompt.label, 120), text: str(prompt && prompt.text, 4000) })).filter((prompt) => prompt.text)
        });
      }).filter((action) => action.title),
      ideas: arr(source.ideas).map((idea) => compact({ title: str(idea && idea.title, 120), text: str(idea && idea.text, 800) })).filter((idea) => idea.title || idea.text),
      questions: strings(source.questions, 400)
    });
    if (!Object.keys(data).length) throw new Error('Er staat niets in dat de cockpit herkent. Gebruik de prompt hierboven: die vraagt om precies de goede velden.');

    const takeaways = (data.takeaways || []).length;
    if (takeaways && (takeaways < 3 || takeaways > 5)) warnings.push(`${takeaways} kernpunten bij "Wat je meeneemt"; 3 tot 5 leest het best.`);
    const dropped = arr(source.chapters).length - (data.chapters || []).length;
    if (dropped > 0) warnings.push(`${dropped} ${dropped === 1 ? 'hoofdstuk heeft' : 'hoofdstukken hebben'} geen geldige tijd (zoals 12:30) en ${dropped === 1 ? 'is' : 'zijn'} weggelaten.`);
    const all = JSON.stringify(data);
    if (EMAIL.test(all)) warnings.push('Er staat een e-mailadres in. Haal namen en adressen weg voordat je publiceert.');
    if (SENSITIVE.test(all)) warnings.push('Er staat iets in dat op een BSN of rekeningnummer lijkt. Haal het weg.');
    return {
      data,
      warnings,
      summary: { takeaways, actions: (data.actions || []).length, chapters: (data.chapters || []).length, ideas: (data.ideas || []).length, questions: (data.questions || []).length }
    };
  }

  /** In één zin wat er is ingevuld. */
  function summaryText(summary) {
    const parts = [
      [summary.takeaways, 'kernpunt', 'kernpunten'],
      [summary.actions, 'actie', 'acties'],
      [summary.chapters, 'hoofdstuk', 'hoofdstukken'],
      [summary.ideas, 'idee', 'ideeën'],
      [summary.questions, 'vraag', 'vragen']
    ].filter(([n]) => n).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
    return parts.length ? 'Ingevuld: ' + parts.join(', ') + '.' : 'Ingevuld.';
  }

  let count = 0;
  /**
   * Het uitklapblok boven het formulier van een training. onImport(data) vult het formulier en geeft
   * false als je annuleert. Geeft het element.
   */
  function panel(onImport) {
    const id = 'naslag-import-' + (++count);
    const answer = el('textarea', { className: 'field__input field__textarea naslag-import__answer', attrs: { id: id + '-answer', rows: '6', spellcheck: 'false', placeholder: '{ "title": "…", "takeaways": [ … ], … }' } });
    const fill = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('wand'), el('span', { text: 'Invullen' })]);
    const result = el('div', { className: 'naslag-import__result', attrs: { 'aria-live': 'polite' } });
    const copy = ns.ui.copyButton(() => PROMPT, { label: 'Kopieer de prompt', className: 'btn--secondary btn--sm' });

    fill.addEventListener('click', async () => {
      result.replaceChildren();
      let parsed;
      try {
        parsed = parse(answer.value);
      } catch (error) {
        result.replaceChildren(el('p', { className: 'naslag-import__error' }, [icon('alert'), el('span', { text: error.message })]));
        answer.focus();
        return;
      }
      const done = await onImport(parsed.data);
      if (done === false) return;
      answer.value = '';
      result.replaceChildren(...[
        el('p', { className: 'naslag-import__ok' }, [icon('check-circle'), el('span', { text: summaryText(parsed.summary) + ' Kijk alles na, upload de slides en sla op.' })]),
        parsed.warnings.length ? el('ul', { className: 'naslag-import__warnings' }, parsed.warnings.map((warning) => el('li', {}, [icon('alert'), el('span', { text: warning })]))) : null
      ].filter(Boolean));
    });

    return el('details', { className: 'naslag-import' }, [
      el('summary', { className: 'naslag-import__head' }, [
        el('span', { className: 'naslag-import__icon', attrs: { 'aria-hidden': 'true' } }, [icon('sparkle')]),
        el('span', { className: 'naslag-import__heading' }, [
          el('span', { className: 'naslag-import__title', text: 'Naslagwerk maken met Copilot' }),
          el('span', { className: 'naslag-import__lead', text: 'Slides en transcript erin, kernpunten, acties en hoofdstukken eruit' })
        ]),
        icon('chevron-down', { className: 'naslag-import__chevron' })
      ]),
      el('ol', { className: 'naslag-import__steps' }, [
        el('li', {}, [el('p', {}, [el('strong', { text: 'Kopieer de prompt.' }), ' Hij vraagt Copilot om precies de velden van het naslagwerk.']), copy]),
        el('li', {}, [el('p', {}, [el('strong', { text: 'Open Copilot Chat met je werkaccount.' }), ' Voeg de PowerPoint (of PDF) en het transcript van de Teams-opname toe, en plak de prompt.'])]),
        el('li', {}, [
          el('label', { attrs: { for: id + '-answer' } }, [el('strong', { text: 'Plak het hele antwoord hier' }), ' en klik op Invullen. Wat er al staat bij die onderdelen, wordt vervangen; de slides, datum en links blijven.']),
          answer,
          el('div', { className: 'naslag-import__actions' }, [fill]),
          result
        ])
      ]),
      el('p', { className: 'field__hint' }, [icon('shield'), ' Lees alles na voordat je publiceert: Copilot kan zich vergissen, en noem geen namen van deelnemers of klantinformatie. Zolang de cockpit openbaar bereikbaar is, alleen wat iedereen mag zien.'])
    ]);
  }

  ns.adminNaslag = { PROMPT, parse, summaryText, panel };
})(window.AIAudit);
