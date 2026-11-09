/* ==========================================================================
   Zoekvragen zonder resultaat (anoniem)
   --------------------------------------------------------------------------
   Zoekt iemand iets wat er niet is (op #/zoeken of met Ctrl+K), dan telt de
   cockpit die zoekterm anoniem mee: een teller 'search_empty' in
   audit_events, net als 'bekeken' en 'gekopieerd' (stap 17). Zo ziet het
   AI-team in Beheer → Onderhoud wat er ontbreekt.
   - Pas als je even stopt met typen (een half woord telt niet), en dezelfde
     term één keer per bezoek.
   - Opgeschoond: kleine letters, cijfers weggelaten (geen BSN, IBAN of
     telefoonnummer), niets met een e-mailadres of link, hoogstens 60 tekens.
   - Collega's zien bij 'niets gevonden' dat de term anoniem meetelt; de
     database wist zoektermen na 180 dagen, en het AI-team kan er een wissen.
   ========================================================================== */
(function (ns) {
  'use strict';

  const KIND = 'search_empty';
  const WAIT = 2500; // ms stil na het typen
  const MAX = 60;
  let timer = 0;
  const sent = new Set();

  /** De zoekterm zoals hij meetelt, of '' als hij niet meetelt. */
  function clean(raw) {
    const text = String(raw || '').normalize('NFC').toLowerCase();
    // Een e-mailadres of link: nooit
    if (/@|https?:|www\./.test(text)) return '';
    const term = text
      .replace(/\d+/g, '#') // cijfers weg: een BSN, IBAN of telefoonnummer wordt '#'
      .replace(/[^a-z0-9à-ÿ#&'\/ -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Te kort, geen woord, te lang, een hele zin (geplakte tekst) of vooral cijfers (een rekeningnummer): niet
    if (term.length < 3 || term.length > MAX || !/[a-zà-ÿ]{3}/.test(term) || term.split(' ').length > 6 || (term.match(/#/g) || []).length > 2) return '';
    return term;
  }

  /** Telt de teller mee? (Voor de zin bij 'niets gevonden'.) */
  function active() {
    const config = (ns.app && ns.app.config ? ns.app.config() : ns.config) || {};
    return Boolean(ns.central && ns.central.isEnabled() && config.enableUsageStats);
  }

  /**
   * Na iedere zoekopdracht: total = het aantal resultaten. Zonder resultaat en na even stil telt de term
   * mee (één keer per bezoek); met resultaat of een nieuwe zoekopdracht vervalt wat nog wachtte.
   */
  function note(query, total) {
    window.clearTimeout(timer);
    if (total > 0) return;
    const term = clean(query);
    if (!term || sent.has(term)) return;
    timer = window.setTimeout(() => {
      sent.add(term);
      ns.central.track(KIND, term);
    }, WAIT);
  }

  /** De zin bij 'niets gevonden' (op de zoekpagina en in Ctrl+K). */
  const NOTICE = 'Zoektermen zonder resultaat tellen we anoniem mee (zonder cijfers), zodat het AI-team ziet wat er ontbreekt. Typ dus geen klant- of persoonsnamen.';

  ns.searchGaps = { KIND, MAX, clean, active, note, NOTICE };
})(window.AIAudit);
