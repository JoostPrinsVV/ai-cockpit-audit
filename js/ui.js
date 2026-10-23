/* ==========================================================================
   UI-hulpfuncties: DOM-opbouw, iconen, lokale opslag, meldingen, kopiëren,
   zoeken en plaatshouders in prompts.
   ========================================================================== */
(function (ns) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TOAST_LIMIT = 2;
  let config = {};

  function init(options) {
    config = options.config || {};
  }

  /* ---- Later laden (beheer, de bestanden in data/) -------------------------------------------
     Met dezelfde versie (?v=…) als de rest van de pagina in index.html, zodat een browser nooit
     een oud bestand naast een nieuw gebruikt. */
  const VERSION = (() => {
    try {
      return new URL(document.currentScript.src).search;
    } catch (error) {
      return '';
    }
  })();
  const loading = new Map(); // adres → Promise (elk bestand één keer)

  /** Scripts toevoegen; ze worden in deze volgorde uitgevoerd. */
  function loadScripts(sources) {
    return Promise.all(sources.map((src) => {
      if (!loading.has(src)) {
        loading.set(src, new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src + VERSION;
          script.async = false;
          script.onload = resolve;
          script.onerror = () => {
            loading.delete(src); // de volgende keer opnieuw proberen
            script.remove();
            reject(new Error('kon ' + src + ' niet laden'));
          };
          document.head.append(script);
        }));
      }
      return loading.get(src);
    }));
  }

  /** Stylesheet toevoegen (na de andere, dus met voorrang bij gelijke specificiteit). */
  function loadStyle(href) {
    if (!loading.has(href)) {
      loading.set(href, new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href + VERSION;
        link.onload = resolve;
        link.onerror = () => {
          loading.delete(href);
          link.remove();
          reject(new Error('kon ' + href + ' niet laden'));
        };
        document.head.append(link);
      }));
    }
    return loading.get(href);
  }

  /* ---- DOM ----------------------------------------------------------------- */
  /**
   * Maakt een element. Opties: className, text, attrs, dataset, on.
   * Kinderen mogen nodes of strings zijn; null/false wordt overgeslagen.
   */
  function el(tag, options, children) {
    const node = document.createElement(tag);
    const opts = options || {};
    if (opts.className) node.className = opts.className;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.attrs) {
      Object.entries(opts.attrs).forEach(([name, value]) => {
        if (value === false || value == null) return;
        node.setAttribute(name, value === true ? '' : String(value));
      });
    }
    if (opts.dataset) Object.assign(node.dataset, opts.dataset);
    if (opts.on) {
      Object.entries(opts.on).forEach(([type, handler]) => node.addEventListener(type, handler));
    }
    append(node, children);
    return node;
  }

  function append(parent, children) {
    if (children == null) return parent;
    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child == null || child === false) return;
      parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return parent;
  }

  /** Inline SVG-icoon uit de sprite in index.html. */
  function icon(name, options) {
    const opts = options || {};
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', ('icon ' + (opts.className || '')).trim());
    svg.setAttribute('focusable', 'false');
    if (opts.label) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', opts.label);
    } else {
      svg.setAttribute('aria-hidden', 'true');
    }
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }

  function setIcon(svg, name) {
    const use = svg && svg.querySelector('use');
    if (use) use.setAttribute('href', '#i-' + name);
  }

  /** Knop of link met icoon en tekst. */
  function button(label, options) {
    const opts = options || {};
    const tag = opts.href ? 'a' : 'button';
    const attrs = Object.assign({}, opts.attrs);
    if (opts.href) attrs.href = opts.href;
    else attrs.type = opts.type || 'button';
    const node = el(tag, { className: 'btn ' + (opts.className || 'btn--secondary'), attrs, on: opts.on }, [
      opts.icon ? icon(opts.icon) : null,
      el('span', { text: label })
    ]);
    return node;
  }

  /* ---- Lokale opslag (alleen op dit apparaat) --------------------------------
     Kan leeg terugkomen of weigeren (privévenster, geblokkeerde opslag):
     alles werkt dan gewoon, alleen zonder onthouden. */
  function storageKey(key) {
    return (config.storageNamespace || 'ai-snackbar-audit') + ':' + key;
  }

  const storage = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(storageKey(key));
        return raw == null ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(storageKey(key), JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(storageKey(key));
      } catch (error) {
        /* niets aan de hand */
      }
    }
  };

  function randomId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // Terugval: UUID v4-vorm uit getRandomValues
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  /* ---- Bewaren en recent bekeken (alleen in deze browser) -------------------------
     Items heten 'type:id' (bijv. 'prompt:notulen'), want een tip en een agent kunnen
     hetzelfde id hebben. Bewaren gebruikt de oude opslag van de favorieten
     ('favorites'): die bevatte alleen prompt-id's en die tellen gewoon mee. */
  const itemKey = (type, id) => type + ':' + id;

  function keyList(name) {
    const value = storage.get(name, []);
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
  }

  // In het geheugen (een lijst met kaarten vraagt het voor iedere kaart); opnieuw lezen na een
  // wijziging, hier of in een ander tabblad
  let savedCache = null;
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey('favorites')) savedCache = null;
  });

  const saved = {
    /** Alles wat je bewaard hebt, het laatst bewaarde eerst. */
    list() {
      if (!savedCache) {
        const list = keyList('favorites').map((entry) => (entry.includes(':') ? entry : itemKey('prompt', entry))).reverse();
        savedCache = { list, set: new Set(list) };
      }
      return savedCache.list.slice();
    },
    has(type, id) {
      saved.list();
      return savedCache.set.has(itemKey(type, id));
    },
    toggle(type, id) {
      const list = saved.list().reverse();
      const key = itemKey(type, id);
      const index = list.indexOf(key);
      if (index === -1) list.push(key);
      else list.splice(index, 1);
      storage.set('favorites', list);
      savedCache = null;
      return index === -1;
    }
  };

  const VIEWED_MAX = 12;
  const viewed = {
    /** Laatst bekeken eerst. */
    list() {
      return keyList('viewed');
    },
    add(type, id) {
      const key = itemKey(type, id);
      storage.set('viewed', [key].concat(viewed.list().filter((entry) => entry !== key)).slice(0, VIEWED_MAX));
    }
  };

  const SAVED_EVENT = 'ai:saved';

  function syncSaveButton(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', (on ? 'Niet meer bewaren: ' : 'Bewaren: ') + btn.dataset.saveTitle);
    btn.title = on ? 'Niet meer bewaren' : 'Bewaren';
    setIcon(btn.querySelector('svg'), on ? 'bookmark-filled' : 'bookmark');
  }

  /**
   * Bladwijzerknop: bewaar een prompt, usecase of tip om later terug te vinden. Na een klik krijgen
   * alle knoppen van dit item de nieuwe stand (een tip kan uitgelicht én in de lijst staan) en gaat
   * het event 'ai:saved' rond, voor lijsten met een 'Bewaard'-filter (zie onSaved).
   */
  function saveButton(type, id, title) {
    const btn = el('button', { className: 'fav', attrs: { type: 'button', 'data-save-type': type, 'data-save-id': id, 'data-save-title': title } }, [icon('bookmark')]);
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const on = saved.toggle(type, id);
      document.querySelectorAll('.fav[data-save-type]').forEach((other) => {
        if (other.dataset.saveType === type && other.dataset.saveId === id) syncSaveButton(other, on);
      });
      toast(on ? 'Bewaard: je vindt het terug op de startpagina' : 'Niet meer bewaard', { icon: on ? 'bookmark-filled' : 'bookmark' });
      document.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { type, id, on } }));
    });
    syncSaveButton(btn, saved.has(type, id));
    return btn;
  }

  /**
   * Na bewaren of niet meer bewaren van een item van deze soort (null: elke soort): refresh() werkt
   * de lijst bij. Verdwijnt daarbij de kaart met de focus uit list (filter 'Bewaard'), dan gaat de
   * focus naar de bladwijzer van de kaart die op die plek komt. Geeft een functie om te stoppen (destroy).
   */
  function onSaved(type, list, refresh) {
    const handler = (event) => {
      if (type && event.detail.type !== type) return;
      if (!list) {
        refresh();
        return;
      }
      const cards = () => Array.from(list.querySelectorAll('.fav'));
      const index = cards().indexOf(document.activeElement);
      refresh();
      if (index < 0 || list.contains(document.activeElement)) return;
      const rest = cards();
      const next = rest[Math.min(index, rest.length - 1)];
      if (next) next.focus();
    };
    document.addEventListener(SAVED_EVENT, handler);
    return () => document.removeEventListener(SAVED_EVENT, handler);
  }

  /* ---- Meldingen (toasts) en schermlezers ------------------------------------- */
  /**
   * De meldingen in de bovenste laag zetten (popover in index.html), boven een venster dat
   * daarna is geopend. Opnieuw openen zet ze er weer bovenop.
   */
  function raiseToasts(region) {
    if (typeof region.showPopover !== 'function') return;
    try {
      if (region.matches(':popover-open')) {
        if (!document.querySelector('dialog[open]')) return;
        region.hidePopover();
      }
      region.showPopover();
    } catch (error) {
      /* geen popover: dan gewoon onderaan de pagina */
    }
  }

  function toast(message, options) {
    const opts = options || {};
    const region = document.getElementById('toast-region');
    if (!region) return;
    raiseToasts(region);
    while (region.children.length >= TOAST_LIMIT) region.firstElementChild.remove();
    const tone = opts.tone || 'info';
    const iconName = opts.icon || (tone === 'success' ? 'check-circle' : tone === 'warning' ? 'alert' : 'info');
    const item = el('div', { className: 'toast toast--' + tone }, [icon(iconName), el('span', { text: message })]);
    region.append(item);
    window.setTimeout(() => {
      item.classList.add('is-leaving');
      item.addEventListener('animationend', () => item.remove(), { once: true });
      window.setTimeout(() => item.remove(), 600);
    }, opts.duration || 3200);
  }

  /**
   * Eigen bevestigingsvenster in de pagina (in plaats van window.confirm, dat sommige
   * browsers en ingebouwde vensters stil onderdrukken).
   * @returns {Promise<boolean>} true = bevestigd
   * options: title, confirmLabel, cancelLabel, danger (rode knop, focus op Annuleren)
   */
  let dialogCount = 0;
  function confirmDialog(message, options) {
    const opts = options || {};
    const id = 'confirm-' + (++dialogCount);
    return new Promise((resolve) => {
      const ok = el('button', { className: 'btn ' + (opts.danger ? 'btn--danger-solid' : 'btn--primary'), attrs: { type: 'button' } }, [el('span', { text: opts.confirmLabel || 'Doorgaan' })]);
      const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: opts.cancelLabel || 'Annuleren' })]);
      const dialog = el('dialog', { className: 'confirm', attrs: { 'aria-labelledby': id, 'aria-describedby': id + '-text' } }, [
        el('div', { className: 'confirm__panel' }, [
          el('span', { className: 'confirm__icon' + (opts.danger ? ' confirm__icon--danger' : ''), attrs: { 'aria-hidden': 'true' } }, [icon(opts.danger ? 'alert' : 'info')]),
          el('h2', { className: 'confirm__title', text: opts.title || 'Weet je het zeker?', attrs: { id } }),
          el('p', { className: 'confirm__text', text: message, attrs: { id: id + '-text' } }),
          el('div', { className: 'confirm__actions' }, [cancel, ok])
        ])
      ]);
      let done = false;
      function close(result) {
        if (done) return;
        done = true;
        try {
          dialog.close();
        } catch (error) {
          /* al dicht */
        }
        dialog.remove();
        resolve(result);
      }
      ok.addEventListener('click', () => close(true));
      cancel.addEventListener('click', () => close(false));
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        close(false);
      });
      document.body.append(dialog);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      (opts.danger ? cancel : ok).focus();
    });
  }

  function announce(message) {
    const node = document.getElementById('announcer');
    if (!node) return;
    node.textContent = '';
    window.setTimeout(() => {
      node.textContent = message;
    }, 60);
  }

  /* ---- Kopiëren ----------------------------------------------------------------- */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* terugval hieronder */
    }
    // Terugval voor oudere browsers en file://
    const area = el('textarea', { className: 'copy-buffer', attrs: { readonly: true, 'aria-hidden': 'true', tabindex: '-1' } });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  /** Kopieerknop met 'Gekopieerd'-stand. getText() levert de tekst op het moment van klikken. */
  function copyButton(getText, options) {
    const opts = options || {};
    const label = opts.label || 'Kopieer prompt';
    const btn = el('button', { className: 'btn btn--copy ' + (opts.className || ''), attrs: { type: 'button' } }, [
      icon('copy'),
      el('span', { text: label })
    ]);
    let timer = 0;
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const ok = await copyText(getText());
      if (!ok) {
        toast('Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf (Ctrl+C).', { tone: 'warning' });
        return;
      }
      window.clearTimeout(timer);
      btn.classList.add('is-copied');
      setIcon(btn.querySelector('svg'), 'check');
      btn.querySelector('span').textContent = 'Gekopieerd';
      announce('Gekopieerd naar het klembord');
      if (opts.onCopy) opts.onCopy();
      timer = window.setTimeout(() => {
        btn.classList.remove('is-copied');
        setIcon(btn.querySelector('svg'), 'copy');
        btn.querySelector('span').textContent = label;
      }, 2400);
    });
    return btn;
  }

  /**
   * 'Kopieer en open Copilot': kopieert de (ingevulde) prompt en opent Copilot Chat in een nieuw
   * tabblad, met je zakelijke account. Daar plak je hem met Ctrl+V: Microsoft heeft geen officiële
   * manier om een prompt al in het typveld te zetten. Werkt in jullie omgeving een parameter wel
   * (config.copilotPromptParam, zie README.md), dan staat hij er ook al in.
   * options: { label, className, onCopy }
   */
  function copilotButton(getText, options) {
    const opts = options || {};
    const base = config.copilotUrl || 'https://m365.cloud.microsoft/chat';
    const link = el('a', {
      className: 'btn btn--copilot ' + (opts.className || ''),
      attrs: { href: base, target: '_blank', rel: 'noopener', title: 'Kopieert de prompt en opent Copilot Chat. Plak hem daar met Ctrl+V.' }
    }, [icon('external'), el('span', { text: opts.label || 'Kopieer en open Copilot' })]);
    link.addEventListener('click', (event) => {
      event.stopPropagation(); // niet ook de kaart openen
      const text = getText();
      // Eerst kopiëren (nu dit tabblad nog de focus heeft), dan opent de link Copilot
      copyText(text).then((ok) => {
        toast(ok ? 'Prompt gekopieerd: plak hem in Copilot met Ctrl+V.' : 'Kopiëren lukte niet. Kopieer de prompt zelf en plak hem in Copilot.', { tone: ok ? 'success' : 'warning', duration: 6000 });
      });
      if (config.copilotPromptParam) {
        link.href = `${base}${base.includes('?') ? '&' : '?'}${encodeURIComponent(config.copilotPromptParam)}=${encodeURIComponent(text)}`;
      }
      if (opts.onCopy) opts.onCopy();
    });
    return link;
  }

  /* ---- Tekst en zoeken ------------------------------------------------------------ */
  /** Kleine letters, zonder accenten: 'Continuïteit' → 'continuiteit'. */
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // De zoekwoorden van de laatste zoekopdracht (die wordt voor iedere kaart opnieuw getoetst)
  let lastQuery = null;
  let lastTerms = [];

  /** Alle zoekwoorden moeten voorkomen. */
  function matches(haystack, query) {
    if (query !== lastQuery) {
      lastQuery = query;
      lastTerms = normalize(query).split(' ').filter(Boolean);
    }
    return lastTerms.every((term) => haystack.includes(term));
  }

  const MONTHS = ['jan.', 'feb.', 'mrt.', 'apr.', 'mei', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];

  function parseDate(value) {
    if (!value) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return '';
    return date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear();
  }

  function isNew(value) {
    const date = parseDate(value);
    if (!date) return false;
    if (config.launchDate && value <= config.launchDate) return false;
    const days = Number(config.newDays) || 45;
    return Date.now() - date.getTime() < days * 86400000;
  }

  /* ---- Plaatshouders: [KLANTNAAM], [PROCES, bijv. inkoopproces] -------------------
     Een plaatshouder begint met een hoofdletter. Alles na ', bijv.' is een
     voorbeeld (wordt de hint in het invulveld). */
  const PLACEHOLDER = /\[([A-ZÀ-ÖØ-Þ][^[\]\n]{0,140})\]/g;

  function parsePlaceholders(text) {
    const found = new Map();
    String(text).replace(PLACEHOLDER, (match, inner) => {
      if (!found.has(inner)) {
        const split = inner.split(/,\s*(?=bijv\.|bijvoorbeeld|zoals)/i);
        const label = split[0].trim();
        const hint = split.slice(1).join(', ').trim();
        const options = / \/ /.test(label) ? label.split(' / ').map((part) => part.trim()).filter(Boolean) : [];
        found.set(inner, { key: inner, label, hint, options, long: /^PLAK\b/.test(label) });
      }
      return match;
    });
    return Array.from(found.values());
  }

  function fillPlaceholders(text, values) {
    return String(text).replace(PLACEHOLDER, (match, inner) => {
      const value = values && values[inner];
      return value && value.trim() ? value.trim() : match;
    });
  }

  /** Prompttekst als nodes, met plaatshouders gemarkeerd (ingevuld = andere stijl). */
  function promptNodes(text, values) {
    const nodes = [];
    let last = 0;
    String(text).replace(PLACEHOLDER, (match, inner, offset) => {
      if (offset > last) nodes.push(document.createTextNode(text.slice(last, offset)));
      const value = values && values[inner] && values[inner].trim();
      nodes.push(el('mark', { className: 'ph' + (value ? ' ph--filled' : ''), text: value || match }));
      last = offset + match.length;
      return match;
    });
    if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
    return nodes;
  }

  /* ---- Kleine bouwstenen ------------------------------------------------------------ */
  function accentClass(accent) {
    return 'accent-' + (accent || 'navy');
  }

  function licenseBadge(license, options) {
    if (license !== true && license !== false) return null;
    const opts = options || {};
    return license
      ? el('span', { className: 'badge badge--license', attrs: { title: 'Werkt met een Microsoft 365 Copilot-licentie' } }, [icon('key'), opts.short ? 'Licentie' : 'Met licentie'])
      : el('span', { className: 'badge badge--free', attrs: { title: 'Kan ook met de gratis Copilot Chat' } }, [icon('check'), opts.short ? 'Zonder licentie' : 'Ook zonder licentie']);
  }

  function newBadge(added) {
    return isNew(added) ? el('span', { className: 'badge badge--new' }, [icon('sparkle'), 'Nieuw']) : null;
  }

  /** Alleen zichtbaar voor beheerders: inhoud die nog niet gepubliceerd is. */
  /** Voor beheerders: concept, of een wijziging die nog niet live staat (zie js/editor.js). */
  const CHANGE_BADGES = {
    'niet opgeslagen': { text: 'Niet opgeslagen', title: 'Gewijzigd, nog niet opgeslagen' },
    nieuw: { text: 'Nieuw', title: 'Nieuw item, nog niet gepubliceerd' },
    gewijzigd: { text: 'Gewijzigd', title: 'Opgeslagen wijziging, nog niet gepubliceerd' },
    voorstel: { text: 'Voorstel', title: 'Voorstel, wacht op publicatie door een beheerder' },
    gepland: { text: 'Gepland', title: 'Gaat automatisch live op het geplande moment' }
  };
  function draftBadge(item) {
    if (!item) return null;
    const change = CHANGE_BADGES[item.change];
    if (change) return el('span', { className: 'badge badge--change', attrs: { title: change.title } }, [icon('pencil-line'), change.text]);
    return item.draft ? el('span', { className: 'badge badge--draft', attrs: { title: 'Concept: alleen zichtbaar voor beheerders' } }, [icon('pencil-line'), 'Concept']) : null;
  }

  function chip(text, options) {
    const opts = options || {};
    return el('span', { className: 'chip ' + (opts.className || '') }, [opts.icon ? icon(opts.icon) : null, text]);
  }

  /** Paginakop: terugknop (optioneel), eyebrow, titel, lead. */
  function pageHeader(options) {
    return el('header', { className: 'page-head' }, [
      options.back ? el('a', { className: 'btn btn--back btn--sm', attrs: { href: options.back.href } }, [icon('arrow-left'), el('span', { text: options.back.label })]) : null,
      options.eyebrow ? el('p', { className: 'page-head__eyebrow', text: options.eyebrow }) : null,
      el('h1', { className: 'page-head__title', text: options.title, attrs: { tabindex: '-1' } }),
      options.lead ? el('p', { className: 'page-head__lead', text: options.lead }) : null
    ]);
  }

  /**
   * Groep schakelknoppen (aria-pressed). items: [{ value, label, count?, icon?, step? }]
   * (step: een nummer vóór het label, zoals '02' bij de fasen als route).
   * Klik je op het filter dat al aan staat, dan gaat het uit: terug naar het eerste
   * item (bijv. 'Alle fasen'), of naar options.resetValue.
   */
  function toggleGroup(label, items, current, onChange, options) {
    const opts = options || {};
    const resetValue = opts.resetValue != null ? opts.resetValue : items[0].value;
    const group = el('div', { className: 'toggles ' + (opts.className || ''), attrs: { role: 'group', 'aria-label': label } });
    items.forEach((item) => {
      const btn = el('button', {
        className: 'toggle' + (item.accent ? ' toggle--accent ' + accentClass(item.accent) : ''),
        attrs: { type: 'button', 'aria-pressed': String(item.value === current) },
        dataset: { value: item.value }
      }, [
        item.icon ? icon(item.icon) : null,
        item.step ? el('span', { className: 'toggle__step', text: item.step, attrs: { 'aria-hidden': 'true' } }) : null,
        el('span', { text: item.label }),
        item.count != null ? el('span', { className: 'toggle__count', text: String(item.count) }) : null
      ]);
      group.append(btn);
    });
    group.addEventListener('click', (event) => {
      const btn = event.target.closest('.toggle');
      if (!btn || !group.contains(btn)) return;
      let value = btn.dataset.value;
      if (btn.getAttribute('aria-pressed') === 'true') {
        if (value === resetValue) return; // 'Alle' staat al aan: niets te doen
        value = resetValue;
      }
      group.querySelectorAll('.toggle').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.value === value)));
      // Kaarten schuiven naar hun nieuwe plek (js/motion.js); options.animate: false voor een lijst zonder kaarten
      if (opts.animate === false) onChange(value);
      else ns.motion.filter(() => onChange(value));
    });
    return group;
  }

  /** Losse aan/uit-knop in een filterbalk (bijv. 'Met demo', 'Bewaard'). onToggle krijgt de nieuwe stand. */
  function switchButton(label, iconName, pressed, onToggle, extra) {
    const btn = el('button', { className: 'toggle toggle--switch', attrs: { type: 'button', 'aria-pressed': String(Boolean(pressed)) } }, [icon(iconName), el('span', { text: label }), extra || null]);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      ns.motion.filter(() => onToggle(on));
    });
    return btn;
  }

  /** Lege toestand: kop, uitleg, eventueel een knop; iconName standaard het vergrootglas (niets gevonden). */
  function emptyState(title, text, action, iconName) {
    return el('div', { className: 'empty' }, [
      el('span', { className: 'empty__icon', attrs: { 'aria-hidden': 'true' } }, [icon(iconName || 'search')]),
      el('p', { className: 'empty__title', text: title }),
      text ? el('p', { className: 'empty__text', text }) : null,
      action || null
    ]);
  }

  ns.ui = {
    init,
    loadScripts,
    loadStyle,
    el,
    append,
    icon,
    setIcon,
    button,
    storage,
    randomId,
    saved,
    viewed,
    saveButton,
    onSaved,
    toast,
    confirmDialog,
    announce,
    copyText,
    copyButton,
    copilotButton,
    normalize,
    matches,
    formatDate,
    parseDate,
    isNew,
    parsePlaceholders,
    fillPlaceholders,
    promptNodes,
    accentClass,
    licenseBadge,
    newBadge,
    draftBadge,
    chip,
    pageHeader,
    toggleGroup,
    switchButton,
    emptyState
  };
})(window.AIAudit);
