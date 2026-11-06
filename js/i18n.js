/* ==========================================================================
   Taal: de cockpit in het Nederlands of in het Engels
   --------------------------------------------------------------------------
   Je kiest je taal in Mijn gegevens ('Taal / Language'), of via Ctrl+K. De
   keuze staat alleen op dit apparaat (ai-snackbar-audit:taal). Staat je browser
   op een andere taal dan Nederlands, dan vraagt de cockpit het één keer.

   In het Engels vertaalt deze module de teksten van de schermen terwijl ze
   verschijnen: knoppen, koppen, uitleg, meldingen, en ook aria-label, title,
   placeholder en alt. De vertalingen staan in js/i18n-en.js: een lijst met het
   Nederlands als sleutel, plus patronen voor teksten met een getal of naam
   ('Nog 5 uur' → 'Due in 5 hours'). Wat er niet in staat, blijft Nederlands:
   er gaat nooit iets stuk.

   Niet vertaald: prompts en andere inhoud (die krijgt per item een Engelse
   versie, zie README 'Engels'), wat je zelf typt (invoervelden), stukken met
   translate="no", en Beheer (voor het Nederlandse AI-team).

   Ontbrekende vertalingen opzoeken (in het Engels, in de console):
   AIAudit.i18n.missing()  → de Nederlandse teksten die je zag zonder vertaling.
   ========================================================================== */
(function (ns) {
  'use strict';

  const KEY = 'taal';
  const LANGS = ['nl', 'en'];
  const LOCALES = { nl: 'nl-NL', en: 'en-GB' };
  // Niet vertalen: code en prompts, wat je typt, wat expliciet 'translate="no"' heeft, en Beheer (blijft Nederlands)
  const SKIP = 'script, style, noscript, pre, code, textarea, [translate="no"], [contenteditable="true"], [contenteditable="plaintext-only"], .admin-shell, #admin-bar';
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

  const storageKey = () => ((ns.config && ns.config.storageNamespace) || 'ai-snackbar-audit') + ':' + KEY;

  /** De bewaarde keuze ('nl', 'en') of '' als je nog niet koos. */
  function stored() {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey()));
      return LANGS.includes(value) ? value : '';
    } catch (error) {
      return '';
    }
  }

  let current = null;
  /** De taal van nu: 'nl' of 'en'. */
  function lang() {
    if (current === null) current = stored() || 'nl';
    return current;
  }
  const locale = () => LOCALES[lang()];
  const english = () => lang() === 'en';

  /** Taal kiezen en bewaren. reload: de pagina opnieuw laden (standaard), zodat alles in de nieuwe taal staat. */
  function set(value, options) {
    if (!LANGS.includes(value)) return;
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(value));
    } catch (error) {
      /* zonder opslag geldt de keuze alleen nu */
    }
    current = value;
    if (!options || options.reload !== false) window.location.reload();
  }

  /* ---- Vertalen ------------------------------------------------------------------------ */
  const words = () => (ns.i18nEn && ns.i18nEn.words) || {};
  const patterns = () => (ns.i18nEn && ns.i18nEn.patterns) || [];

  /**
   * De Engelse tekst bij een Nederlandse (al getrimd), of null als die er niet is. Eerst de lijst,
   * dan de patronen. Een patroon is [RegExp, 'English $1'] of [RegExp, (match, translate) => '…'].
   */
  function lookup(raw) {
    // Eén schrijfwijze voor letters met een accent (ë als één teken of als e + trema)
    const text = String(raw).normalize('NFC');
    const exact = words()[text];
    if (typeof exact === 'string') return exact;
    const list = patterns();
    for (let index = 0; index < list.length; index++) {
      const [pattern, out] = list[index];
      const match = text.match(pattern);
      if (!match) continue;
      return typeof out === 'function' ? out(match, (part) => lookup(String(part).trim()) || part) : text.replace(pattern, out);
    }
    return null;
  }

  /** {naam} in een tekst invullen. */
  const fill = (text, vars) => (vars ? String(text).replace(/\{(\w+)\}/g, (whole, name) => (vars[name] != null ? String(vars[name]) : whole)) : String(text));

  /** Voor code: de tekst in de taal van nu, met {naam} ingevuld. In het Nederlands verandert er niets. */
  function t(text, vars) {
    if (!english()) return fill(text, vars);
    const key = String(text).trim();
    const out = lookup(key);
    if (out == null) note(key);
    return fill(out != null ? out : text, vars);
  }

  /** Maandnaam in de taal van nu (index 0 = januari), lang of kort. */
  function month(index, style) {
    return new Intl.DateTimeFormat(locale(), { month: style || 'long' }).format(new Date(2026, index, 1));
  }

  /* ---- Bijhouden wat nog niet vertaald is (alleen in het Engels) ----------------------------- */
  const gaps = new Map();
  function note(text) {
    // Zonder kleine letters (JP, [KLANTNAAM]) is het een afkorting of plaatshouder: niets om te vertalen
    if (!english() || !/[A-Za-zÀ-ÿ]{2}/.test(text) || !/[a-zà-ÿ]/.test(text)) return;
    gaps.set(text, (gaps.get(text) || 0) + 1);
  }

  /** Alle teksten van de inhoud (titels, prompts, …): die horen niet in de lijst met schermteksten. */
  function contentTexts() {
    const found = new Set();
    const walk = (value, depth) => {
      if (depth > 6 || value == null) return;
      if (typeof value === 'string') {
        if (value.trim()) found.add(value.trim());
        return;
      }
      if (value instanceof Map) return value.forEach((item) => walk(item, depth + 1));
      if (Array.isArray(value)) return value.forEach((item) => walk(item, depth + 1));
      if (typeof value === 'object') Object.values(value).forEach((item) => walk(item, depth + 1));
    };
    const c = ns.content || {};
    [c.usecases, c.prompts, c.tips, c.trainings, c.agents, c.phases, c.settings, c.wrapped].forEach((list) => walk(list, 0));
    return found;
  }

  /** Wat je in het Engels zag zonder vertaling (zonder de inhoud), het vaakst gezien eerst. */
  function missing() {
    const content = contentTexts();
    return Array.from(gaps.entries()).filter(([text]) => !content.has(text)).sort((a, b) => b[1] - a[1]).map(([text]) => text);
  }

  /* ---- De pagina vertalen ---------------------------------------------------------------------- */
  /** Een tekst met de spaties eromheen zoals ze waren; null als er niets verandert. */
  function translated(raw) {
    const text = raw.trim();
    if (!text || !/[A-Za-zÀ-ÿ]/.test(text)) return null;
    const out = lookup(text);
    if (out == null) {
      note(text);
      return null;
    }
    if (out === text) return null;
    return raw.slice(0, raw.indexOf(text)) + out + raw.slice(raw.indexOf(text) + text.length);
  }

  const skipped = (node) => {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return !element || Boolean(element.closest(SKIP));
  };

  function translateText(node) {
    if (skipped(node)) return;
    const out = translated(node.nodeValue);
    if (out != null) node.nodeValue = out;
  }

  function translateAttr(element, name) {
    if (!element.getAttribute || element.closest('[translate="no"], .admin-shell, #admin-bar')) return;
    const value = element.getAttribute(name);
    if (!value) return;
    const out = translated(value);
    if (out != null) element.setAttribute(name, out);
  }

  /** Alles in en onder een element vertalen (tekst en de attributen hierboven). */
  function translateTree(root) {
    if (!english() || !root) return;
    if (root.nodeType === 3) {
      translateText(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(translateText);
    const elements = root.nodeType === 1 ? [root].concat(Array.from(root.querySelectorAll('[aria-label], [title], [placeholder], [alt]'))) : Array.from(root.querySelectorAll('[aria-label], [title], [placeholder], [alt]'));
    elements.forEach((element) => ATTRS.forEach((name) => {
      if (element.hasAttribute && element.hasAttribute(name)) translateAttr(element, name);
    }));
  }

  // De menuknoppen in de kopbalk zijn in stukjes geschreven ('Training' + 'en', 'Ideeën' + 'hub'): die apart
  const NAV_TAILS = { en: 's', hub: ' hub' };
  function navTails() {
    document.querySelectorAll('.nav__tail').forEach((tail) => {
      const text = tail.textContent.trim();
      if (Object.prototype.hasOwnProperty.call(NAV_TAILS, text)) tail.textContent = NAV_TAILS[text];
      tail.setAttribute('translate', 'no');
    });
  }

  let observer = null;
  /** Bij het opstarten: de taal op de pagina zetten en, in het Engels, alles vertalen wat verschijnt. */
  function start() {
    document.documentElement.lang = lang();
    if (!english() || observer || typeof MutationObserver !== 'function') return;
    navTails();
    translateTree(document.documentElement);
    observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'childList') record.addedNodes.forEach(translateTree);
        else if (record.type === 'characterData') translateText(record.target);
        else if (record.type === 'attributes') translateAttr(record.target, record.attributeName);
      });
      // Wat we net zelf veranderden, hoeft niet nog een keer langs
      observer.takeRecords();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---- Eén keer vragen, als je browser niet op Nederlands staat --------------------------------- */
  let offering = false;
  /** Of de vraag 'Switch to English?' nu openstaat (de rondleiding wacht daarop). */
  const isOffering = () => offering;

  function offer(onDone) {
    const browser = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    if (stored() || !browser || /^nl\b/i.test(browser) || english()) return false;
    offering = true;
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    };
    const card = el('aside', 'lang-offer');
    card.setAttribute('translate', 'no');
    card.setAttribute('aria-labelledby', 'lang-offer-title');
    const title = el('p', 'lang-offer__title', 'This cockpit is also available in English');
    title.id = 'lang-offer-title';
    const text = el('p', 'lang-offer__text', 'You can change this later in My details (top right). / Je kunt dit later wijzigen in Mijn gegevens.');
    const yes = el('button', 'btn btn--primary btn--sm', 'Switch to English');
    const no = el('button', 'btn btn--secondary btn--sm', 'Nederlands houden');
    yes.type = 'button';
    no.type = 'button';
    const actions = el('div', 'lang-offer__actions');
    actions.append(yes, no);
    card.append(title, text, actions);
    yes.addEventListener('click', () => set('en'));
    no.addEventListener('click', () => {
      set('nl', { reload: false });
      offering = false;
      card.remove();
      if (onDone) onDone();
    });
    document.body.append(card);
    return true;
  }

  /** Alleen voor nu (tests): een taal gebruiken zonder hem te bewaren of de pagina te herladen. */
  function use(value) {
    if (LANGS.includes(value)) current = value;
  }

  ns.i18n = { LANGS, lang, locale, english, stored, set, use, t, lookup, month, missing, translateTree, start, offer, isOffering };
  // Pas als alle scripts er zijn (ook de vertaallijst): uitgestelde scripts draaien al als readyState 'interactive' is
  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})(window.AIAudit = window.AIAudit || {});
