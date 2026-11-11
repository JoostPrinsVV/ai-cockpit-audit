/* ==========================================================================
   Indeling en teksten van de pagina's, aan te passen in de bewerkmodus
   --------------------------------------------------------------------------
   Twee dingen die een beheerder zonder designkennis zelf moet kunnen:
   1. Secties op een pagina verplaatsen en verbergen (pijltjes, verslepen,
      oogje). arrange() zet de secties van een pagina in de opgeslagen
      volgorde en laat verborgen secties weg (in de bewerkmodus zie je ze
      wel, gedimd, zodat je ze terug kunt zetten).
   2. Vaste teksten aanpassen (koppen, inleidingen, knoppen). text() geeft
      de aangepaste tekst of de standaardtekst; editable() markeert een
      element, zodat je er in de bewerkmodus op kunt klikken en typen.
   Alles staat in de rij 'Teksten van de site' (type setting, id site):
     layout: { <pagina>: { order: [sleutels], hidden: [sleutels] } }
     texts:  { <sleutel>: 'tekst' }
   Zo gaat het mee met Opslaan, Publiceren en Ongedaan maken (js/editor.js).
   Een lege tekst = terug naar de standaard.
   ========================================================================== */
(function (ns) {
  'use strict';

  const settings = () => (ns.content && ns.content.settings) || {};
  const editing = () => Boolean(ns.editmode && ns.editmode.isOn());

  /** De opgeslagen indeling van een pagina: { order: [], hidden: [] }. */
  function pageLayout(page) {
    const all = settings().layout;
    const own = all && typeof all === 'object' ? all[page] : null;
    return {
      order: own && Array.isArray(own.order) ? own.order.slice() : [],
      hidden: own && Array.isArray(own.hidden) ? own.hidden.slice() : []
    };
  }

  /**
   * Secties in de opgeslagen volgorde. sections: [{ key, label, node }] in de standaardvolgorde;
   * een sectie zonder node (er is niets te tonen) slaat de pagina over. Een sectie die nog niet in
   * de opgeslagen volgorde staat (nieuw in de code), blijft achter de sectie die er in de standaard
   * vóór stond. Geeft een lijst omhulsels (div.layout-block) terug.
   */
  function arrange(page, sections) {
    const saved = pageLayout(page);
    const rank = new Map();
    let last = -1;
    sections.forEach((section) => {
      const index = saved.order.indexOf(section.key);
      if (index >= 0) last = index;
      rank.set(section.key, index >= 0 ? index : last + 0.001 * (rank.size + 1));
    });
    const hidden = new Set(saved.hidden);
    const showHidden = editing();
    return sections
      .map((section, index) => ({ section, index }))
      .sort((a, b) => rank.get(a.section.key) - rank.get(b.section.key) || a.index - b.index)
      .map(({ section }) => section)
      .filter((section) => section.node && (showHidden || !hidden.has(section.key)))
      .map((section) => ns.ui.el('div', {
        className: 'layout-block' + (hidden.has(section.key) ? ' is-hidden-block' : ''),
        dataset: { layoutPage: page, layoutKey: section.key, layoutLabel: section.label }
      }, [section.node]));
  }

  /** Aangepaste tekst, of de standaardtekst. */
  function text(key, fallback) {
    const texts = settings().texts;
    const value = texts && typeof texts === 'object' ? texts[key] : '';
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  /**
   * Een element met een vaste tekst bewerkbaar maken: de tekst komt uit text(key, fallback) en in
   * de bewerkmodus klik je erop om hem aan te passen (js/editmode.js). Geeft het element terug.
   */
  function editable(node, key, fallback, options) {
    if (!node) return node;
    const opts = options || {};
    node.textContent = text(key, fallback);
    node.dataset.textKey = key;
    node.dataset.textDefault = fallback;
    node.dataset.textLabel = opts.label || 'Tekst';
    if (opts.multiline) node.dataset.textMultiline = 'true';
    return node;
  }

  /* ---- Wijzigen (vanuit de bewerkmodus) ------------------------------------------------- */
  const own = () => ns.cockpit.namespace(ns.cockpit.activeId());
  const canEdit = () => ns.rights.can('bewerken', own(), 'setting');

  function changeSite(update) {
    return ns.editor.change(own(), 'setting', 'site', (state) => {
      state.data = state.data || {};
      update(state.data);
      return state;
    });
  }

  /** Nieuwe volgorde van een pagina opslaan (alle sleutels, ook verborgen). */
  function setOrder(page, keys) {
    return changeSite((data) => {
      const layout = Object.assign({}, data.layout || {});
      layout[page] = Object.assign({}, layout[page] || {}, { order: keys.slice() });
      data.layout = layout;
    });
  }

  function setHidden(page, key, hide) {
    return changeSite((data) => {
      const layout = Object.assign({}, data.layout || {});
      const current = Object.assign({ order: [], hidden: [] }, layout[page] || {});
      const hidden = new Set(current.hidden || []);
      if (hide) hidden.add(key);
      else hidden.delete(key);
      layout[page] = Object.assign({}, current, { hidden: Array.from(hidden) });
      data.layout = layout;
    });
  }

  /** De standaardindeling van een pagina terugzetten. */
  function resetPage(page) {
    return changeSite((data) => {
      const layout = Object.assign({}, data.layout || {});
      delete layout[page];
      data.layout = layout;
    });
  }

  function setText(key, value, fallback) {
    return changeSite((data) => {
      const texts = Object.assign({}, data.texts || {});
      const clean = (value || '').trim();
      // Gelijk aan de standaard (of leeg): niets bewaren, dan volgt hij een nieuwe standaard
      if (!clean || clean === (fallback || '').trim()) delete texts[key];
      else texts[key] = clean;
      data.texts = texts;
    });
  }

  ns.layout = { arrange, text, editable, pageLayout, setOrder, setHidden, resetPage, setText, canEdit };
})(window.AIAudit);
