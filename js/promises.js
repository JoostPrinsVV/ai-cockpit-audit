/* ==========================================================================
   Beloftes van het AI-team
   --------------------------------------------------------------------------
   Drie service-afspraken, klein onder het formulier waar ze bij horen:
     invliegen   reactie op een verzoek om de AI-specialist in te vliegen
     verzoek     reactie op een verzoek in de ideeënhub
     prompt      een prompt op maat ('Vraag een prompt aan', js/view-ideas.js)
   Tekst en termijn (in werkdagen) pas je aan in Beheer → Inhoud → Teksten,
   onder 'Beloftes van het AI-team'. Leeg = de standaard hieronder; een streepje
   (-) zet één belofte uit, 'Geen beloftes tonen' allemaal.
   In Beheer → Inzendingen en Invliegen staat bij een open verzoek hoeveel tijd
   er nog is (badge), zodat het AI-team de belofte kan houden.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon } = ns.ui;

  const DEFAULTS = {
    flyin: { text: 'Reactie binnen 1–2 werkdagen', days: 2 },
    request: { text: 'Reactie binnen een week', days: 5 },
    prompt: { text: 'Een prompt op maat binnen 1 werkdag', days: 1 }
  };
  // Namen van de instellingen (Beheer → Teksten)
  const KEYS = {
    flyin: ['promiseFlyin', 'promiseFlyinDays'],
    request: ['promiseRequest', 'promiseRequestDays'],
    prompt: ['promisePrompt', 'promisePromptDays']
  };
  // 'Vraag een prompt aan' wordt een verzoek met deze titel (js/view-ideas.js)
  const PROMPT_TITLE = /^prompt voor:/i;

  const settings = () => (ns.content && ns.content.settings) || {};

  /** De belofte voor een soort ('flyin', 'request', 'prompt'): { text, days } of null (uit). */
  function get(kind, source) {
    const s = source || settings();
    if (!DEFAULTS[kind] || s.promisesOff === true) return null;
    const [textKey, daysKey] = KEYS[kind];
    const own = typeof s[textKey] === 'string' ? s[textKey].trim() : '';
    if (own === '-') return null;
    const days = Math.round(Number(s[daysKey]));
    return {
      text: own || DEFAULTS[kind].text,
      days: Number.isFinite(days) && days > 0 ? Math.min(days, 30) : DEFAULTS[kind].days
    };
  }

  /** Bij welke belofte een inzending hoort (of null). */
  function kindOf(item) {
    if (!item) return null;
    if (item.kind === 'invliegen') return 'flyin';
    if (item.kind === 'verzoek') return PROMPT_TITLE.test(String(item.title || '').trim()) ? 'prompt' : 'request';
    return null;
  }

  /** Een aantal werkdagen later (zaterdag en zondag tellen niet mee), op hetzelfde tijdstip. */
  function addWorkdays(from, days) {
    const date = new Date(from.getTime());
    // Ingestuurd in het weekend: de termijn begint maandag om middernacht (1 werkdag = vóór het eind van maandag)
    if (date.getDay() === 0 || date.getDay() === 6) {
      while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
    }
    let left = days;
    while (left > 0) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1;
    }
    return date;
  }

  /** Is de belofte al gehouden? Reactie: zodra de status niet meer 'nieuw' is of er een antwoord staat. Prompt: als hij er is (of afgehandeld). */
  function kept(item, kind) {
    if (kind === 'prompt') return ['gerealiseerd', 'beantwoord', 'afgewezen'].includes(item.status);
    return (item.status && item.status !== 'nieuw') || Boolean(item.answer) || Boolean(item.answered_at);
  }

  /**
   * De termijn van een open inzending: { kind, promise, due (Date), hoursLeft, late } of null
   * (geen belofte, al gehouden, of geen datum).
   */
  function deadline(item, now, source) {
    const kind = kindOf(item);
    const promise = kind ? get(kind, source) : null;
    if (!promise || kept(item, kind)) return null;
    const created = new Date(item.created_at);
    if (Number.isNaN(created.getTime())) return null;
    const due = addWorkdays(created, promise.days);
    const hoursLeft = (due.getTime() - (now || new Date()).getTime()) / 3600000;
    return { kind, promise, due, hoursLeft, late: hoursLeft < 0 };
  }

  const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);
  const DUE = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  /** Korte tekst bij de termijn: 'Belofte verlopen', 'Nog 5 uur', 'Nog 2 dagen'. */
  function leftText(info) {
    if (info.late) return 'Belofte verlopen';
    if (info.hoursLeft < 24) return 'Nog ' + Math.max(1, Math.floor(info.hoursLeft)) + ' uur';
    const days = Math.floor(info.hoursLeft / 24);
    return 'Nog ' + days + (days === 1 ? ' dag' : ' dagen');
  }

  /** Badge voor Beheer bij een open inzending, of null. */
  function badge(item, now) {
    const info = deadline(item, now);
    if (!info) return null;
    const soon = !info.late && info.hoursLeft < 8;
    return el('span', {
      className: 'badge badge--promise' + (info.late ? ' is-late' : soon ? ' is-soon' : ''),
      attrs: { title: 'Belofte van het AI-team: ' + lower(info.promise.text) + ' (uiterlijk ' + DUE.format(info.due) + ')' }
    }, [icon('clock'), leftText(info)]);
  }

  /** De belofte als regel onder een formulier, of null als hij uit staat. */
  function line(kind) {
    const promise = get(kind);
    if (!promise) return null;
    return el('p', { className: 'promise' }, [
      icon('check-circle'),
      el('span', {}, [el('strong', { text: 'Belofte van het AI-team: ' }), lower(promise.text) + '.'])
    ]);
  }

  /** De belofte in een zin (voor een bevestiging), of ''. */
  function sentence(kind) {
    const promise = get(kind);
    return promise ? 'Belofte van het AI-team: ' + lower(promise.text) + '.' : '';
  }

  ns.promises = { DEFAULTS, KEYS, get, kindOf, addWorkdays, kept, deadline, leftText, badge, line, sentence };
})(window.AIAudit);
