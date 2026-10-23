/* ==========================================================================
   Gereedschap voor Beheer
   --------------------------------------------------------------------------
   Kleine hulpfuncties die meerdere beheeronderdelen gebruiken. Wordt alleen
   geladen na inloggen of op #/beheer, als eerste van ADMIN_SCRIPTS in js/app.js.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, toast } = ns.ui;

  // De namen van de kleuren (ns.ui.ACCENTS) in de keuzelijsten
  const ACCENT_LABELS = { teal: 'Turquoise', crimson: 'Rood', steel: 'Staalblauw', rose: 'Roze', deepteal: 'Donkerturquoise', navy: 'Donkerblauw' };
  const accentOptions = () => ns.ui.ACCENTS.map((value) => ({ value, label: ACCENT_LABELS[value] || value }));

  const MOMENT = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
  /** Datum en tijd van een wijziging, bijv. '23 okt 2026, 14:05'. */
  const moment = (value) => MOMENT.format(new Date(value));

  /** Adres uit een tekst: kleine letters, cijfers en streepjes ('Één & ander' → 'een-ander'). */
  function slug(value, max) {
    return ns.ui.normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, max || 60).replace(/-+$/, '');
  }

  /** Bestandsnaam voor een upload: zoals slug, maar met de punt van de extensie erin. */
  function fileName(value) {
    return ns.ui.normalize(value).replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'bestand';
  }

  let icons = null;
  /** Alle iconen uit de set in index.html, op alfabet. */
  function iconNames() {
    if (!icons) icons = Array.from(document.querySelectorAll('svg.sprite symbol'), (symbol) => symbol.id.replace(/^i-/, '')).sort();
    return icons.slice();
  }

  /** Een bestand downloaden dat in de pagina is gemaakt (back-up, export, nieuwsbrief). */
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    const link = el('a', { attrs: { href: url, download: name } });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** Foutmelding onder een formulier: { node, show(text), hide() }. */
  function formError() {
    const node = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    return {
      node,
      show(text) {
        node.replaceChildren(el('p', { className: 'form-error__title' }, [ns.ui.icon('alert'), el('span', { text })]));
        node.hidden = false;
      },
      hide() {
        node.hidden = true;
      }
    };
  }

  /** Melding dat iets niet lukte, met de reden: 'Opslaan mislukt: …'. */
  function failed(what, error, duration) {
    toast(`${what} mislukt: ${error.message}`, { tone: 'warning', duration: duration || 6000 });
  }

  /**
   * Knop(pen) uitzetten zolang iets loopt; de eerste krijgt de tekst 'Bezig…' of text.
   * Geeft een functie die alles terugzet zoals het was.
   */
  function busy(buttons, text) {
    const list = [].concat(buttons).filter(Boolean);
    const label = list[0] && list[0].querySelector('span');
    const before = label ? label.textContent : '';
    list.forEach((button) => { button.disabled = true; });
    if (label) label.textContent = text || 'Bezig…';
    return () => {
      list.forEach((button) => { button.disabled = false; });
      if (label) label.textContent = before;
    };
  }

  ns.adminKit = { accentOptions, moment, slug, fileName, iconNames, download, formError, failed, busy };
})(window.AIAudit);
