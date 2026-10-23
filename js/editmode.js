/* ==========================================================================
   Bewerkmodus op de pagina zelf
   --------------------------------------------------------------------------
   Met 'Bewerken' in de bewerkbalk zie je de cockpit zoals altijd, maar:
   - titels en korte teksten pas je aan door erop te klikken (Enter of
     ergens anders klikken = klaar, Esc = terug);
   - op iedere kaart: verslepen (of pijltjes), het potlood voor alle velden
     in een zijpaneel, en de prullenbak;
   - aan het eind van een lijst: een plusknop voor een nieuw item;
   - op de startpagina: naam, slogan en uitleg in de hero.
   Alles wordt een niet-opgeslagen wijziging (js/editor.js): Opslaan en
   Publiceren in de bewerkbalk. Rechten volgen de rol (js/rights.js).
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon } = ns.ui;
  const MODE_KEY = 'ai-snackbar-audit:bewerkmodus';

  // Kaarten op de pagina: waar staat het adres, welke tekst is de titel en welke de korte tekst
  const CARDS = [
    { sel: '.uc-card:not(.ag-card)', type: 'usecase', link: 'a[href^="#/usecase/"]', title: '.uc-card__link', text: '.uc-card__subtitle', textKey: 'subtitle' },
    { sel: '.ag-card', type: 'agent', self: true, title: '.uc-card__title', text: '.uc-card__subtitle', textKey: 'summary' },
    { sel: '.tip-card:not(.tip-card--locked)', type: 'tip', link: 'a[href^="#/tip/"]', title: '.tip-card__link', text: '.tip-card__summary', textKey: 'summary' },
    { sel: '.p-card', type: 'prompt', link: '.p-card__title a', title: '.p-card__title a', text: '.p-card__desc', textKey: 'description' },
    { sel: '.tr-card', type: 'training', self: true, title: '.tr-card__title', text: '.tr-card__subtitle', textKey: 'subtitle' }
  ];
  const MAPS = { usecase: 'usecaseById', prompt: 'promptById', tip: 'tipById', training: 'trainingById', agent: 'agentById' };
  const ORDERED = { usecase: true, prompt: true, tip: true, agent: true };
  const ADD_LABEL = { usecase: 'Nieuwe usecase', prompt: 'Nieuwe prompt', tip: 'Nieuwe tip', training: 'Nieuwe training', agent: 'Nieuwe agent' };
  // Lijstpagina's: daar kun je ook toevoegen en verslepen
  const LIST_PAGES = { usecases: 'usecase', prompts: 'prompt', tips: 'tip', trainingen: 'training', agents: 'agent' };
  const DETAIL_TEXT = { usecase: 'subtitle', tip: 'summary', prompt: 'description', training: 'subtitle', agent: 'summary' };

  let on = false;
  try {
    on = window.sessionStorage.getItem(MODE_KEY) === 'aan';
  } catch (error) {
    on = false;
  }
  let dragging = null; // { namespace, type, id, slot }

  const isOn = () => on && ns.editor.available();

  function toggle() {
    on = !on;
    // Bewerken gaat over je werkversie: niet tegelijk 'Als collega' (de gepubliceerde versie) bekijken
    if (on) ns.editor.setVisitorView(false);
    try {
      window.sessionStorage.setItem(MODE_KEY, on ? 'aan' : 'uit');
    } catch (error) {
      /* alleen in het geheugen */
    }
    document.body.classList.toggle('is-editing', isOn());
    if (ns.app && ns.app.refresh) ns.app.refresh();
    ns.ui.announce(on ? 'Bewerken staat aan' : 'Bewerken staat uit');
  }

  const own = () => ns.cockpit.namespace(ns.cockpit.activeId());

  /** Item achter een kaart: { type, id, namespace, derived } of null. */
  function target(type, id) {
    const item = ns.content[MAPS[type]] && ns.content[MAPS[type]].get(id);
    if (!item) return null;
    // Een prompt uit een usecase bewerk je via die usecase
    if (type === 'prompt' && item.usecase) {
      return { type: 'usecase', id: item.usecase.id, namespace: item.usecase.shared ? ns.cockpit.GENERAL_NAMESPACE : own(), derived: true };
    }
    return { type, id, namespace: item.shared ? ns.cockpit.GENERAL_NAMESPACE : own(), derived: false };
  }

  const idFromHref = (href) => decodeURIComponent(String(href || '').split('/').pop() || '');

  /* ---- Zijpaneel ------------------------------------------------------------------ */
  function openPanel(type, namespace, id) {
    const schema = ns.adminContent.SCHEMAS[type];
    const what = schema ? schema.one : 'item';
    let handle = null;
    const panel = ns.adminContent.quickForm(type, namespace, id, () => handle && handle.close(), () => handle && handle.tryClose());
    // Iets ingevuld maar niet toegepast: eerst vragen (ook bij Escape of een klik naast het paneel)
    const canClose = () => !panel.isDirty() || ns.ui.confirmDialog('Wat je in dit paneel hebt ingevuld, is nog niet toegepast.', { title: 'Paneel sluiten?', confirmLabel: 'Sluiten zonder toepassen', cancelLabel: 'Verder invullen', danger: true });
    handle = ns.editor.drawer(id ? `${what.charAt(0).toUpperCase() + what.slice(1)} bewerken` : (ADD_LABEL[type] || 'Nieuw'), panel.node, null, { canClose });
    const first = panel.node.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  /* ---- Teksten direct op de pagina ------------------------------------------------------ */
  /**
   * Maakt node bewerkbaar. commit(text) wordt aangeroepen als de tekst is veranderd.
   * multiline: Enter maakt een nieuwe regel (anders: klaar). label: wat je bewerkt (voor schermlezers).
   */
  function inline(node, commit, multiline, label) {
    if (!node || node.dataset.inline) return;
    node.dataset.inline = 'aan';
    try {
      node.contentEditable = 'plaintext-only';
    } catch (error) {
      node.contentEditable = 'true';
    }
    if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
    node.spellcheck = true;
    node.setAttribute('role', 'textbox');
    node.setAttribute('aria-label', `${label || 'Tekst'} bewerken: ${node.textContent.trim()}`);
    if (multiline) node.setAttribute('aria-multiline', 'true');
    let original = '';
    node.addEventListener('focus', () => {
      original = node.textContent;
    });
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        node.textContent = original;
        node.blur();
      } else if (event.key === 'Enter' && !multiline) {
        // Een titel is één regel: ook Shift+Enter is klaar
        event.preventDefault();
        node.blur();
      }
    });
    node.addEventListener('paste', (event) => {
      // Alleen platte tekst
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '));
    });
    node.addEventListener('blur', () => {
      // innerText houdt regeleinden (ook als de browser <br> gebruikt); harde spaties worden gewone
      const text = node.innerText.replace(/\u00a0/g, ' ').trim();
      if (text === original.trim()) return;
      if (!text) {
        node.textContent = original;
        return;
      }
      commit(text);
    });
  }

  function editField(t, key) {
    return (text) => ns.editor.change(t.namespace, t.type, t.id, (state) => {
      state.data[key] = text;
      return state;
    });
  }

  /* ---- Gereedschap op een kaart ----------------------------------------------------------- */
  function toolButton(iconName, label, onClick, extra) {
    const button = el('button', { className: 'edit-tools__btn' + (extra || ''), attrs: { type: 'button', title: label, 'aria-label': label } }, [icon(iconName)]);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(event);
    });
    return button;
  }

  function decorateCard(card, spec, listPage) {
    const slot = card.parentElement;
    if (!slot || slot.dataset.editSlot) return;
    const link = spec.self ? card : card.querySelector(spec.link);
    const id = link ? idFromHref(link.getAttribute('href')) : '';
    const t = id ? target(spec.type, id) : null;
    if (!t) return;
    const canEdit = ns.rights.can('bewerken', t.namespace, t.type);
    if (!canEdit) return;
    const canDelete = !t.derived && ns.rights.can('verwijderen', t.namespace, t.type);
    const orderable = listPage && !t.derived && ORDERED[t.type];
    slot.dataset.editSlot = [t.namespace, t.type, t.id].join('|');
    slot.classList.add('edit-slot');

    const title = card.querySelector(spec.title);
    const label = title ? title.textContent.trim() : t.id;
    const tools = [];
    if (orderable) {
      const grip = el('span', { className: 'edit-tools__btn edit-tools__grip', attrs: { title: 'Verslepen', 'aria-hidden': 'true' } }, [icon('grip')]);
      grip.addEventListener('mousedown', () => {
        slot.draggable = true;
        // Alleen klikken, niet slepen: niet versleepbaar laten (anders sleept selecteren in de titel de kaart)
        window.addEventListener('mouseup', () => {
          if (!dragging) slot.draggable = false;
        }, { once: true });
      });
      tools.push(grip);
      tools.push(toolButton('arrow-left', 'Eerder: ' + label, () => step(slot, -1)));
      tools.push(toolButton('arrow-right', 'Later: ' + label, () => step(slot, 1)));
    }
    tools.push(toolButton('pencil-line', (t.derived ? 'Bewerk de usecase van: ' : 'Alle velden: ') + label, () => openPanel(t.type, t.namespace, t.id)));
    if (canDelete) {
      tools.push(toolButton('trash', 'Verwijderen: ' + label, async () => {
        if (!(await ns.ui.confirmDialog(`"${label}" verdwijnt van de pagina. Live gaat dat pas na Opslaan en Publiceren; tot die tijd kun je het ongedaan maken.`, { title: 'Verwijderen?', confirmLabel: 'Verwijderen', danger: true }))) return;
        ns.editor.change(t.namespace, t.type, t.id, { status: 'trash' });
      }, ' edit-tools__btn--danger'));
    }
    slot.append(el('div', { className: 'edit-tools', attrs: { role: 'toolbar', 'aria-label': 'Bewerken: ' + label } }, tools));

    // Titel en korte tekst direct aanpassen (niet bij een prompt uit een usecase)
    if (!t.derived) {
      inline(title, editField(t, 'title'), false, 'Titel');
      inline(card.querySelector(spec.text), editField(t, spec.textKey), true, 'Korte tekst');
    }
    if (orderable) enableDrop(slot, t);
  }

  /** Met de pijltjes een plek eerder of later in de lijst. */
  function step(slot, delta) {
    const slots = Array.from(slot.parentElement.querySelectorAll(':scope > .edit-slot'));
    const [namespace, type, id] = slot.dataset.editSlot.split('|');
    let index = slots.indexOf(slot) + delta;
    // Alleen naast items uit dezelfde omgeving (eigen inhoud of gedeelde basis)
    while (slots[index] && !slots[index].dataset.editSlot.startsWith(namespace + '|' + type + '|')) index += delta;
    const other = slots[index];
    if (!other) return;
    ns.editor.move(namespace, type, id, other.dataset.editSlot.split('|')[2], delta > 0);
  }

  /* ---- Verslepen -------------------------------------------------------------------- */
  function enableDrop(slot, t) {
    slot.addEventListener('dragstart', (event) => {
      dragging = { namespace: t.namespace, type: t.type, id: t.id, slot };
      slot.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', t.id);
      } catch (error) {
        /* oude browser */
      }
    });
    slot.addEventListener('dragend', () => {
      slot.draggable = false;
      slot.classList.remove('is-dragging');
      document.querySelectorAll('.drop-before, .drop-after').forEach((node) => node.classList.remove('drop-before', 'drop-after'));
      dragging = null;
    });
    slot.addEventListener('dragover', (event) => {
      if (!dragging || dragging.slot === slot || dragging.type !== t.type || dragging.namespace !== t.namespace) return;
      event.preventDefault();
      const box = slot.getBoundingClientRect();
      const after = event.clientX > box.left + box.width / 2 || event.clientY > box.bottom - box.height / 4;
      slot.classList.toggle('drop-after', after);
      slot.classList.toggle('drop-before', !after);
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-before', 'drop-after'));
    slot.addEventListener('drop', (event) => {
      if (!dragging) return;
      event.preventDefault();
      const after = slot.classList.contains('drop-after');
      slot.classList.remove('drop-before', 'drop-after');
      ns.editor.move(dragging.namespace, dragging.type, dragging.id, t.id, after);
    });
  }

  /* ---- Toevoegen aan het eind van een lijst ---------------------------------------------- */
  function addButton(list, type) {
    if (list.querySelector(':scope > .edit-add')) return;
    const namespace = own();
    if (!ns.rights.can('bewerken', namespace, type)) return;
    const button = el('button', { className: 'edit-add__btn', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: ADD_LABEL[type] })]);
    button.addEventListener('click', () => openPanel(type, namespace, ''));
    list.append(el('li', { className: 'edit-add' }, [button]));
  }

  /* ---- Startpagina: naam, slogan en uitleg ------------------------------------------------- */
  function decorateHero(view) {
    const namespace = own();
    if (!ns.rights.can('bewerken', namespace, 'setting')) return;
    const setting = (key) => (text) => ns.editor.change(namespace, 'setting', 'site', (state) => {
      state.data[key] = text;
      return state;
    });
    const titleSpan = view.querySelector('.hero__title > span:first-child');
    inline(titleSpan, (text) => setting('applicationTitle')(text.trim()), false, 'Naam van het platform');
    inline(view.querySelector('.hero__tagline'), setting('tagline'), false, 'Slogan');
    inline(view.querySelector('.hero__subtitle'), setting('applicationSubtitle'), true, 'Uitleg');
  }

  /* ---- Detailpagina: titel en ondertitel -------------------------------------------------- */
  function decorateDetail(view, parsed) {
    const type = parsed.name;
    if (!MAPS[type]) return;
    const t = target(type, parsed.params[0]);
    if (!t || t.derived || !ns.rights.can('bewerken', t.namespace, t.type)) return;
    inline(view.querySelector('.detail__title'), editField(t, 'title'), false, 'Titel');
    inline(view.querySelector('.detail__subtitle'), editField(t, DETAIL_TEXT[type]), true, 'Ondertitel');
  }

  let lastParsed = null;
  let queued = false;
  // Filters bouwen een lijst opnieuw op zonder nieuwe pagina: dan opnieuw versieren
  const observer = new MutationObserver(() => {
    if (queued || !isOn()) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      decorate(lastParsed);
    });
  });

  /** Na iedere pagina (js/app.js): de bewerkmogelijkheden erop zetten. */
  function decorate(parsed) {
    lastParsed = parsed || lastParsed;
    document.body.classList.toggle('is-editing', isOn());
    const viewNode = document.getElementById('view');
    if (viewNode && isOn()) observer.observe(viewNode, { childList: true, subtree: true });
    else observer.disconnect();
    if (!isOn() || !parsed) return;
    const view = document.getElementById('view');
    if (!view || parsed.name === 'beheer') return;
    const listType = LIST_PAGES[parsed.name];
    CARDS.forEach((spec) => view.querySelectorAll(spec.sel).forEach((card) => decorateCard(card, spec, Boolean(listType))));
    if (listType) {
      // Plusknop aan het eind van iedere lijst met kaarten van deze soort
      view.querySelectorAll('ul.card-grid, ul.p-grid').forEach((list) => {
        const slot = list.querySelector(':scope > .edit-slot');
        if (slot && slot.dataset.editSlot.split('|')[1] === listType) addButton(list, listType);
      });
      // Lege lijst (bijv. nog geen agents): toch kunnen toevoegen
      if (!view.querySelector('.edit-add')) {
        const list = view.querySelector('ul.card-grid, ul.p-grid');
        if (list) addButton(list, listType);
      }
    }
    if (parsed.name === '') decorateHero(view);
    decorateDetail(view, parsed);
  }

  // In de bewerkmodus: kaarten en links niet openen bij klikken (dan zou je niet kunnen typen)
  document.addEventListener('click', (event) => {
    if (!isOn()) return;
    const link = event.target.closest && event.target.closest('a');
    if (!link || link.closest('.edit-tools, .admin-bar, .topbar, .drawer, .confirm')) return;
    if (link.closest('.edit-slot') || link.querySelector('[data-inline]') || link.closest('[data-inline]')) event.preventDefault();
  }, true);

  ns.editmode = { isOn, toggle, decorate, openPanel };
})(window.AIAudit);
