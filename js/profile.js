/* ==========================================================================
   Mijn gegevens: wat de cockpit voor je invult (#/mijn)
   --------------------------------------------------------------------------
   Je naam, functie, vestiging, team en (als je wilt) het boekjaar waar je mee
   bezig bent. Een plaatshouder met dezelfde naam ([NAAM], [FUNCTIE], [JAAR],
   [VORIG JAAR], …) staat daarmee al ingevuld: in het promptblok, bij kopiëren
   en 'Kopieer en open Copilot' op de kaarten, in de promptbouwer en in het
   zoekvenster (Ctrl+K). Je naam staat ook al bij een inzending. Je rol
   (assistent, senior, manager, partner; anders afgeleid uit je functie) zet
   trainingen voor jouw rol bovenaan, met 'Voor jou'.
   Alleen in deze browser (lokale opslag 'profiel'), nooit verstuurd. Geen
   klantgegevens: die vul je per prompt in, en die worden niet bewaard.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { storage } = ns.ui;
  const KEY = 'profiel';
  const EVENT = 'ai:profiel';

  /* Velden. placeholders: de plaatshouders (het deel vóór ', bijv.', in hoofdletters) die het veld
     invult. Precies die naam: [NAAM EN FUNCTIE] of [NAAM AFZENDER] is iemand anders. Ook de Engelse
     namen, voor de Engelse versie van een prompt ([NAME], [ROLE], …; zie js/content-en.js). */
  const FIELDS = [
    { id: 'naam', label: 'Je naam', hint: 'Bijv. Sanne de Vries', autocomplete: 'name', placeholders: ['NAAM', 'MIJN NAAM', 'JOUW NAAM', 'JE NAAM', 'ONDERTEKENING', 'NAME', 'MY NAME', 'YOUR NAME', 'SIGNATURE'] },
    { id: 'functie', label: 'Je functie', hint: 'Bijv. senior auditor', autocomplete: 'organization-title', placeholders: ['FUNCTIE', 'MIJN FUNCTIE', 'JOUW FUNCTIE', 'JE FUNCTIE', 'ROLE', 'MY ROLE', 'YOUR ROLE', 'JOB TITLE', 'MY JOB TITLE', 'YOUR JOB TITLE'],
      options: ['Assistent-accountant', 'Junior auditor', 'Senior auditor', 'Supervisor', 'Manager', 'Partner', 'Samenstellend accountant', 'Fiscalist', 'Adviseur', 'Office manager'] },
    { id: 'vestiging', label: 'Vestiging', hint: 'Bijv. Amsterdam', autocomplete: 'off', placeholders: ['VESTIGING', 'KANTOOR', 'MIJN VESTIGING', 'MIJN KANTOOR', 'OFFICE', 'MY OFFICE', 'YOUR OFFICE'] },
    { id: 'team', label: 'Team', hint: 'Bijv. team MKB Noord', autocomplete: 'off', placeholders: ['TEAM', 'MIJN TEAM', 'JOUW TEAM', 'MY TEAM', 'YOUR TEAM'] },
    // Alleen voor de promptbouwer (als achtergrond): een soort klanten, nooit een naam
    { id: 'klanten', label: 'Soort klanten', hint: 'Bijv. mkb in de bouw en de groothandel', autocomplete: 'off', placeholders: [] }
  ];
  /* Rol: voor wie een training (of later iets anders) bedoeld is. Kies je hem niet, dan leidt de cockpit
     hem af uit je functie ('Senior auditor' → senior). Volgorde van de woorden telt: 'Senior manager' is een manager. */
  const ROLES = [
    { id: 'assistent', label: 'Assistent', plural: 'assistenten' },
    { id: 'senior', label: 'Senior', plural: 'seniors' },
    { id: 'manager', label: 'Manager', plural: 'managers' },
    { id: 'partner', label: 'Partner', plural: 'partners' }
  ];
  const ROLE_IDS = ROLES.map((role) => role.id);
  const ROLE_WORDS = [
    ['partner', /partner|directeur|director|vennoot/i],
    ['manager', /manager|supervisor/i],
    ['senior', /senior|teamleider|ervaren/i],
    ['assistent', /assistent|junior|trainee|stagiair|starter/i]
  ];
  /** De rol bij een functie ('' als die er niet uit te halen is). */
  function roleOf(functie) {
    const found = ROLE_WORDS.find(([, pattern]) => pattern.test(String(functie || '')));
    return found ? found[0] : '';
  }

  // Boekjaar: '' (niet invullen), 'auto' of een jaartal
  const YEAR_PLACEHOLDERS = ['JAAR', 'BOEKJAAR', 'YEAR', 'FINANCIAL YEAR'];
  const PREVIOUS_YEAR_PLACEHOLDERS = ['VORIG JAAR', 'VORIG BOEKJAAR', 'PREVIOUS YEAR', 'PRIOR YEAR', 'PREVIOUS FINANCIAL YEAR', 'PRIOR FINANCIAL YEAR'];

  const BY_PLACEHOLDER = new Map();
  FIELDS.forEach((field) => field.placeholders.forEach((name) => BY_PLACEHOLDER.set(name, field.id)));

  const clean = (value) => (typeof value === 'string' ? value.trim().slice(0, 120) : '');
  let cache = null;

  /** Je gegevens: { naam, functie, vestiging, team, klanten, boekjaar, rol } (lege tekst als het leeg is). */
  function get() {
    if (!cache) {
      const saved = storage.get(KEY, null);
      const source = saved && typeof saved === 'object' ? saved : {};
      cache = {};
      FIELDS.forEach((field) => {
        cache[field.id] = clean(source[field.id]);
      });
      const year = clean(source.boekjaar);
      cache.boekjaar = year === 'auto' || /^\d{4}$/.test(year) ? year : '';
      cache.rol = ROLE_IDS.includes(source.rol) ? source.rol : '';
    }
    return Object.assign({}, cache);
  }

  /** Je rol: gekozen in Mijn gegevens, anders afgeleid uit je functie ('' als die onbekend is). */
  function role() {
    const values = get();
    return values.rol || roleOf(values.functie);
  }

  /** Bewaren (alleen wat je meegeeft verandert) en iedereen die meekijkt laten weten. */
  function set(values) {
    const next = Object.assign(get(), values || {});
    const tidy = {};
    FIELDS.forEach((field) => {
      if (clean(next[field.id])) tidy[field.id] = clean(next[field.id]);
    });
    if (next.boekjaar === 'auto' || /^\d{4}$/.test(String(next.boekjaar || ''))) tidy.boekjaar = String(next.boekjaar);
    if (ROLE_IDS.includes(next.rol)) tidy.rol = next.rol;
    if (Object.keys(tidy).length) storage.set(KEY, tidy);
    else storage.remove(KEY);
    cache = null;
    document.dispatchEvent(new CustomEvent(EVENT));
    return get();
  }

  function clear() {
    return set(Object.assign(Object.fromEntries(FIELDS.map((field) => [field.id, ''])), { boekjaar: '', rol: '' }));
  }

  /** Iets ingevuld? */
  function filled() {
    const values = get();
    return FIELDS.some((field) => values[field.id]) || Boolean(values.boekjaar) || Boolean(values.rol);
  }

  /** Het boekjaar bij 'automatisch': januari tot en met juni het vorige jaar, daarna dit jaar. */
  function autoYear(today) {
    const day = today || (ns.content && ns.content.today ? ns.content.today() : new Date().toISOString().slice(0, 10));
    const year = Number(day.slice(0, 4));
    return Number(day.slice(5, 7)) <= 6 ? year - 1 : year;
  }

  /** Het boekjaar dat de cockpit invult, of '' als je dat niet wilt. */
  function year(today) {
    const value = get().boekjaar;
    if (!value) return '';
    return String(value === 'auto' ? autoYear(today) : Number(value));
  }

  /** Label van een plaatshouder ('NAAM, bijv. Sanne' → 'NAAM'), in hoofdletters. */
  const labelOf = (inner) => String(inner).split(ns.ui.HINT_SPLIT)[0].trim().toUpperCase();

  /** Wat de cockpit invult voor deze plaatshouder (de tekst tussen de haken), of ''. */
  function valueFor(inner, today) {
    const label = labelOf(inner);
    const field = BY_PLACEHOLDER.get(label);
    if (field) return get()[field] || '';
    if (YEAR_PLACEHOLDERS.includes(label)) return year(today);
    if (PREVIOUS_YEAR_PLACEHOLDERS.includes(label)) {
      const current = year(today);
      return current ? String(Number(current) - 1) : '';
    }
    return '';
  }

  /** Alles wat de cockpit in deze tekst invult: { 'NAAM': 'Sanne de Vries', … } (sleutels zoals parsePlaceholders). */
  function values(text) {
    const out = {};
    ns.ui.parsePlaceholders(text || '').forEach((field) => {
      const value = valueFor(field.key);
      if (value) out[field.key] = value;
    });
    return out;
  }

  /** De tekst met je gegevens ingevuld (de rest blijft [PLAATSHOUDER]). */
  function fill(text) {
    return ns.ui.fillPlaceholders(text, values(text));
  }

  /** Kan de cockpit in deze tekst iets voor je invullen (als je het invult)? */
  function canFill(text) {
    return ns.ui.parsePlaceholders(text || '').some((field) => Boolean(source(field.key)));
  }

  /** Welk veld van Mijn gegevens deze plaatshouder invult ('Je naam', 'Boekjaar' …), of '' (Beheer, js/admin-content.js). */
  function source(inner) {
    const label = labelOf(inner);
    const field = FIELDS.find((item) => item.id === BY_PLACEHOLDER.get(label));
    if (field) return field.label;
    if (YEAR_PLACEHOLDERS.includes(label)) return 'Boekjaar';
    if (PREVIOUS_YEAR_PLACEHOLDERS.includes(label)) return 'Boekjaar min één';
    return '';
  }

  /** Voornaam voor de begroeting op de startpagina. */
  function firstName() {
    return get().naam.split(/\s+/)[0] || '';
  }

  /** Initialen voor de knop in de kopbalk ('Sanne de Vries' → 'SV'). */
  function initials() {
    const words = get().naam.split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  /** Na een wijziging (hier of in een ander tabblad). Geeft een functie om te stoppen. */
  function onChange(handler) {
    document.addEventListener(EVENT, handler);
    return () => document.removeEventListener(EVENT, handler);
  }

  window.addEventListener('storage', (event) => {
    if (event.key && event.key.endsWith(':' + KEY)) {
      cache = null;
      document.dispatchEvent(new CustomEvent(EVENT));
    }
  });

  /* ---- Knop in de kopbalk: je initialen zodra je naam bekend is ---- */
  function syncButton() {
    const button = document.getElementById('me-button');
    if (!button) return;
    const letters = initials();
    const label = button.querySelector('.topbar__initials');
    const svg = button.querySelector('svg');
    label.textContent = letters;
    label.hidden = !letters;
    if (svg) svg.style.display = letters ? 'none' : '';
    button.setAttribute('aria-label', letters ? `Mijn logboek (${get().naam})` : 'Mijn logboek');
    button.title = letters ? 'Mijn logboek' : 'Mijn logboek: vul je naam en functie één keer in';
    // Met een brevet: de strepen erbij (js/brevet-ui.js)
    if (ns.brevetUi) ns.brevetUi.syncMeButton();
  }

  function init() {
    syncButton();
    onChange(syncButton);
  }

  ns.profile = { FIELDS, ROLES, ROLE_IDS, roleOf, role, init, get, set, clear, filled, year, autoYear, valueFor, values, fill, canFill, source, firstName, initials, onChange };
})(window.AIAudit);
