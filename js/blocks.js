/* ==========================================================================
   Bouwstenen voor pagina's
   --------------------------------------------------------------------------
   Stukken die op meerdere pagina's terugkomen, één keer gemaakt: de kop van
   een detailpagina, een lijst met verwante links, stappen, kleine meldingen
   en het blok met een opname of status. Overal dezelfde opbouw, dus ook
   dezelfde toegankelijkheid en opmaak (css/audit.css).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, accentClass, saveButton, toggleGroup, switchButton } = ns.ui;

  /**
   * Kop van een detailpagina: terug naar het overzicht, bovenregel met icoon, titel (met de
   * bladwijzer ernaast als save is opgegeven), ondertitel en labels.
   * @param {object} o  back: [href, label], icon, eyebrow, title, save: [type, id] (optioneel),
   *                    subtitle, chips: nodes (null wordt overgeslagen)
   */
  function detailHeader(o) {
    const title = el('h1', { className: 'detail__title', text: o.title, attrs: { tabindex: '-1' } });
    return el('header', { className: 'detail__header' }, [
      el('a', { className: 'btn btn--back btn--sm', attrs: { href: o.back[0] } }, [icon('arrow-left'), el('span', { text: o.back[1] })]),
      el('p', { className: 'detail__eyebrow' }, [icon(o.icon), el('span', { text: o.eyebrow })]),
      o.save ? el('div', { className: 'detail__title-row' }, [title, saveButton(o.save[0], o.save[1], o.title)]) : title,
      o.subtitle ? el('p', { className: 'detail__subtitle', text: o.subtitle }) : null,
      el('div', { className: 'chips' }, (o.chips || []).filter(Boolean))
    ]);
  }

  /**
   * Een blok met links (verwante items, materiaal). Zonder links: niets (null).
   * links: [{ href, icon, text, external, download }]; after: iets onder de lijst (bijv. een uitleg).
   */
  function relatedList(id, title, links, after) {
    if (!links.length) return null;
    return el('section', { className: 'related', attrs: { 'aria-labelledby': id } }, [
      el('h2', { className: 'related__title', text: title, attrs: { id } }),
      el('ul', { className: 'related__list', attrs: { role: 'list' } }, links.map((link) => {
        const attrs = link.external ? { href: link.href, target: '_blank', rel: 'noopener noreferrer' } : { href: link.href, download: link.download || null };
        return el('li', {}, [el('a', { className: 'related__link', attrs }, [
          icon(link.icon),
          el('span', { text: link.text }),
          icon(link.external ? 'external' : 'arrow-right', { className: 'related__go' })
        ])]);
      })),
      after || null
    ]);
  }

  /**
   * Links naar items (usecases, tips, …) voor relatedList; onbekende en dichte items vallen weg.
   * ownIcon: het eigen icoon van ieder item (een lijst van één soort), anders dat van de soort.
   */
  function itemLinks(type, ids, ownIcon) {
    const kind = ns.kinds.get(type);
    return ids.map((id) => ns.kinds.item(type, id))
      .filter((item) => item && !item.locked)
      .map((item) => ({ href: ns.kinds.href(type, item.id), icon: (ownIcon && item.icon) || kind.icon, text: item.title }));
  }

  /** Genummerde stappen. size: '' (gewoon), 'large' of 'small'. */
  function stepsList(steps, size) {
    return el('ol', { className: 'steps' + (size ? ' steps--' + size : ''), attrs: { role: 'list' } }, steps.map((step, index) =>
      el('li', { className: 'steps__item' }, [el('span', { className: 'steps__number', text: String(index + 1) }), el('span', { text: step })])
    ));
  }

  /** Kleine toelichting met een i ervoor (bijv. onder een prompt). Zonder tekst: null. */
  const infoNote = (text) => (text ? el('p', { className: 'takeaway__note' }, [icon('info'), el('span', { text })]) : null);

  /** 'Tip …' met een lampje. Zonder tekst: null. */
  const tipCallout = (text) => (text ? el('div', { className: 'tip' }, [
    el('span', { className: 'tip__icon', attrs: { 'aria-hidden': 'true' } }, [icon('bulb')]),
    el('p', {}, [el('strong', { text: 'Tip ' }), text])
  ]) : null);

  /** Waarschuwingen als lijst (bijv. 'Let op', 'Niet gebruiken voor'). Zonder punten: null. */
  function warningList(id, title, items) {
    if (!items.length) return null;
    return el('section', { className: 'callout callout--warning', attrs: { 'aria-labelledby': id } }, [
      el('h2', { className: 'callout__title', attrs: { id } }, [icon('alert'), el('span', { text: title })]),
      el('ul', { className: 'callout__list' }, items.map((item) => el('li', { text: item })))
    ]);
  }

  /** Zijkaart 'Vraag over deze training?' met een knop naar de ideeënhub. */
  function askCard(subject) {
    return el('div', { className: 'side-card' }, [
      el('h2', { className: 'side-card__title' }, [icon('question'), el('span', { text: `Vraag over ${subject}?` })]),
      el('p', { className: 'side-card__text', text: 'Stel hem in de ideeënhub. Het antwoord helpt vaak ook anderen.' }),
      el('a', { className: 'btn btn--secondary btn--sm', attrs: { href: '#/ideeen/vraag' } }, [icon('message-plus'), el('span', { text: 'Stel een vraag' })])
    ]);
  }

  /**
   * Melding in de pagina. o: tone ('' | 'warning' | 'cta'), icon, title, text (tekst of nodes),
   * more (nodes onder de tekst), action (knop of link, naast de tekst), className (extra).
   */
  function notice(o) {
    const tone = o.tone ? ' notice--' + o.tone : '';
    return el('div', { className: 'notice' + tone + (o.className ? ' ' + o.className : '') }, [
      icon(o.icon || (o.tone === 'warning' ? 'alert' : 'info')),
      el('div', {}, [
        o.title ? el('p', { className: 'notice__title', text: o.title }) : null,
        o.text ? el('p', {}, typeof o.text === 'string' ? [o.text] : o.text) : null,
        ...(o.more || [])
      ]),
      o.action || null
    ]);
  }

  /** Knop of link met icoon en tekst, bijv. linkButton('#/ideeen/vraag', 'message-plus', 'Stel een vraag', 'btn--secondary btn--sm'). */
  const linkButton = (href, iconName, text, className) =>
    el('a', { className: 'btn ' + (className || 'btn--secondary'), attrs: { href } }, [icon(iconName), el('span', { text })]);

  /**
   * Blok met een opname, een link om iets te openen of de stand van zaken.
   * o: accent, icon, title, text, pending (gedempt: nog niet beschikbaar), action (knop)
   */
  function statusPanel(o) {
    return el('div', { className: 'recording' + (o.pending ? ' recording--pending' : ' on-dark') + ' ' + accentClass(o.accent) }, [
      el('span', { className: 'recording__icon', attrs: { 'aria-hidden': 'true' } }, [icon(o.icon)]),
      el('div', { className: 'recording__body' }, [
        el('p', { className: 'recording__title', text: o.title }),
        o.text ? el('p', { className: 'recording__text', text: o.text }) : null
      ]),
      o.action || null
    ]);
  }

  /** Een knop die een externe pagina in een nieuw tabblad opent (en eventueel telt). */
  function openButton(href, label, options) {
    const opts = options || {};
    const button = el('a', { className: 'btn btn--primary btn--lg', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }, [
      opts.icon ? icon(opts.icon) : null,
      el('span', { text: label }),
      icon('external')
    ]);
    if (opts.onOpen) button.addEventListener('click', opts.onOpen);
    return button;
  }

  /* ---- Overzichten: filters, volgorde, Bewaard en de teller --------------------------------
     De filters staan in een object van de pagina (bijv. { phase, license, saved, sort }) dat
     blijft bestaan zolang de site open is; update() bouwt de lijst opnieuw op. */

  /** Een rij in een filterblok: label en wat erachter komt. */
  const filterRow = (label, ...controls) => el('div', { className: 'filters__row' }, [el('span', { className: 'filters__label', text: label }), ...controls]);

  /** Losse aan/uit-filters bij elkaar (bijv. 'Met demo' en 'Bewaard'). */
  const extraFilters = (...buttons) => el('div', { className: 'toggles toggles--compact', attrs: { role: 'group', 'aria-label': 'Extra filters' } }, buttons);

  /** De teller onder de filters; alleen die wordt voorgelezen, niet de hele lijst. */
  const resultCount = () => el('p', { className: 'results-count', attrs: { 'aria-live': 'polite' } });
  const countText = (n, one, many) => (n === 1 ? '1 ' + one : n + ' ' + many);

  /**
   * De fasen als route (01 Planning, 02 …) op een stippellijn, met aantallen. Een fase die er na
   * een wijziging niet meer is: terug naar Alle fasen. items: alles op de pagina (met .phase).
   */
  function phaseFilter(items, filters, update) {
    const options = ns.content.phases
      .map((phase, index) => ({ value: phase.id, label: phase.short, accent: phase.accent, step: String(index + 1).padStart(2, '0'), count: items.filter((item) => item.phase.id === phase.id).length }))
      .filter((option) => option.count > 0);
    if (filters.phase !== 'all' && !options.some((option) => option.value === filters.phase)) filters.phase = 'all';
    return toggleGroup('Filter op fase', [{ value: 'all', label: 'Alle fasen', count: items.length }].concat(options), filters.phase, (value) => {
      filters.phase = value;
      update();
    }, { className: 'toggles--route' });
  }

  /** Met of zonder licentie; filteren met licenseMatch(filters.license, item.license). */
  function licenseFilter(filters, update) {
    return toggleGroup('Filter op licentie', [
      { value: 'all', label: 'Alle' },
      { value: 'no', label: 'Zonder licentie', icon: 'check' },
      { value: 'yes', label: 'Met licentie', icon: 'key' }
    ], filters.license, (value) => {
      filters.license = value;
      update();
    }, { className: 'toggles--compact' });
  }
  // Zonder opgegeven licentie (null) valt een item bij Met en bij Zonder weg; 'both' (een prompt met
  // ook een versie zonder licentie) blijft bij allebei staan
  const licenseMatch = (wanted, license) => wanted === 'all' || license === 'both' || license === (wanted === 'yes');

  /** Volgorde: de gewone, of best beoordeeld door collega's. Zonder reviews: null. */
  function ratingSort(filters, update, normal) {
    if (!ns.reviews.enabled()) return null;
    return toggleGroup('Volgorde', [normal, { value: 'rating', label: 'Best beoordeeld', icon: 'star' }], filters.sort, (value) => {
      filters.sort = value;
      update();
    }, { className: 'toggles--compact' });
  }

  /**
   * Schakelaar 'Bewaard' met het aantal. ids(): de bewaarde id's van deze soort die op de pagina
   * staan (exists), en werkt meteen de telling bij. watch(list): bij (niet meer) bewaren, ook via
   * een andere kaart op de pagina, de telling en met de schakelaar aan de lijst bijwerken; geeft
   * een functie om te stoppen (voor destroy).
   */
  function savedFilter(type, filters, update, exists) {
    const count = el('span', { className: 'toggle__count' });
    const prefix = type + ':';
    function ids() {
      const list = ns.ui.saved.list().filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)).filter(exists);
      count.textContent = String(list.length);
      return list;
    }
    const button = switchButton('Bewaard', 'bookmark', filters.saved, (on) => {
      filters.saved = on;
      update();
    }, count);
    // De focus na 'niet meer bewaren' (de kaart verdwijnt) regelt ns.ui.onSaved
    const watch = (list) => ns.ui.onSaved(type, list, () => (filters.saved ? update() : ids()));
    return { button, ids, watch };
  }

  /**
   * Iedere kaart één keer bouwen; filteren en sorteren zetten alleen de bestaande kaarten op hun
   * plek. build(item, key) geeft de kaart; reset() na nieuwe gegevens (bijv. de sterren).
   */
  function cardCache(build) {
    const cards = new Map();
    const get = (item, variant) => {
      const key = item.id + (variant ? '|' + variant : '');
      if (!cards.has(key)) cards.set(key, el('li', {}, [build(item, variant)]));
      return cards.get(key);
    };
    get.reset = () => cards.clear();
    return get;
  }

  ns.blocks = {
    detailHeader, relatedList, itemLinks, stepsList, infoNote, tipCallout, warningList, askCard, notice, linkButton, statusPanel, openButton,
    filterRow, extraFilters, resultCount, countText, phaseFilter, licenseFilter, licenseMatch, ratingSort, savedFilter, cardCache
  };
})(window.AIAudit);
