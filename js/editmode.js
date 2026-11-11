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

  // Kaarten op de pagina (data-kind en data-id, zie js/kinds.js): welke tekst is de titel en welke
  // de korte tekst. Alleen deze kaarten; de regels op de startpagina zijn geen kaart.
  const CARD_PARTS = {
    usecase: { title: '.uc-card__link', text: '.uc-card__subtitle' },
    agent: { title: '.uc-card__link', text: '.uc-card__subtitle' },
    tip: { title: '.tip-card__link', text: '.tip-card__summary' },
    prompt: { title: '.p-card__title a', text: '.p-card__desc' },
    training: { title: '.tr-card__link', text: '.tr-card__subtitle' }
  };
  const CARDS = ':is(.uc-card, .tip-card, .p-card, .tr-card)[data-kind][data-id]';

  let on = false;
  try {
    on = window.sessionStorage.getItem(MODE_KEY) === 'aan';
  } catch (error) {
    on = false;
  }
  let dragging = null; // { namespace, type, id, slot }

  // In het Engels niet: dan zou een Engelse tekst in het Nederlandse veld belanden (de Engelse versie staat in Beheer)
  const english = () => Boolean(ns.i18n && ns.i18n.english());
  const isOn = () => on && ns.editor.available() && !english();

  function toggle() {
    if (!on && english()) {
      ns.ui.toast('Bewerken op de pagina kan alleen in het Nederlands. Zet je taal op Nederlands (Mijn gegevens), of pas de Engelse versie aan in Beheer → Inhoud.', { tone: 'warning', duration: 8000 });
      return;
    }
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
    const item = ns.kinds.item(type, id);
    if (!item) return null;
    // Een prompt uit een usecase bewerk je via die usecase
    if (type === 'prompt' && item.usecase) {
      return { type: 'usecase', id: item.usecase.id, namespace: item.usecase.shared ? ns.cockpit.GENERAL_NAMESPACE : own(), derived: true };
    }
    return { type, id, namespace: item.shared ? ns.cockpit.GENERAL_NAMESPACE : own(), derived: false };
  }

  /* ---- Zijpaneel ------------------------------------------------------------------ */
  function openPanel(type, namespace, id) {
    const kind = ns.kinds.get(type);
    let handle = null;
    const panel = ns.adminContent.quickForm(type, namespace, id, () => handle && handle.close(), () => handle && handle.tryClose());
    // Iets ingevuld maar niet toegepast: eerst vragen (ook bij Escape of een klik naast het paneel)
    const canClose = () => !panel.isDirty() || ns.ui.confirmDialog('Wat je in dit paneel hebt ingevuld, is nog niet toegepast.', { title: 'Paneel sluiten?', confirmLabel: 'Sluiten zonder toepassen', cancelLabel: 'Verder invullen', danger: true });
    handle = ns.editor.drawer(id ? `${kind.label} bewerken` : kind.add, panel.node, null, { canClose });
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
    // Klaar: de wijziging doorgeven. Met Enter blijft de focus op dit veld, zodat je met het
    // toetsenbord op dezelfde plek verder werkt (js/app.js zet hem na het opnieuw opbouwen terug).
    function finish() {
      // innerText houdt regeleinden (ook als de browser <br> gebruikt); harde spaties worden gewone
      const text = node.innerText.replace(/ /g, ' ').trim();
      if (text === original.trim()) return;
      if (!text) {
        node.textContent = original;
        return;
      }
      original = text;
      commit(text);
    }
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        // Terug naar de tekst van daarnet (de focus blijft hier)
        event.stopPropagation();
        node.textContent = original;
      } else if (event.key === 'Enter' && !multiline) {
        // Een titel is één regel: ook Shift+Enter is klaar
        event.preventDefault();
        finish();
      }
    });
    node.addEventListener('paste', (event) => {
      // Alleen platte tekst
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n\s*/g, ' '));
    });
    node.addEventListener('blur', finish);
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

  function decorateCard(card, listPage) {
    const slot = card.parentElement;
    const parts = CARD_PARTS[card.dataset.kind];
    if (!slot || slot.dataset.editSlot || !parts) return;
    const t = target(card.dataset.kind, card.dataset.id);
    if (!t) return;
    const canEdit = ns.rights.can('bewerken', t.namespace, t.type);
    if (!canEdit) return;
    const canDelete = !t.derived && ns.rights.can('verwijderen', t.namespace, t.type);
    const orderable = listPage && !t.derived && ns.kinds.get(t.type).ordered;
    slot.dataset.editSlot = [t.namespace, t.type, t.id].join('|');
    slot.classList.add('edit-slot');

    const title = card.querySelector(parts.title);
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
    // Een groep (geen 'toolbar': die belooft pijltjestoetsen tussen de knoppen)
    slot.append(el('div', { className: 'edit-tools', attrs: { role: 'group', 'aria-label': 'Bewerken: ' + label } }, tools));

    // Titel en korte tekst direct aanpassen (niet bij een prompt uit een usecase)
    if (!t.derived) {
      inline(title, editField(t, 'title'), false, 'Titel');
      inline(card.querySelector(parts.text), editField(t, ns.kinds.get(t.type).textKey), true, 'Korte tekst');
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
    const button = el('button', { className: 'edit-add__btn', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: ns.kinds.get(type).add })]);
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
    // Kickstart: titel en belofte (dezelfde teksten als in Beheer → Teksten)
    inline(view.querySelector('.ks__title'), setting('kickstartTitle'), false, 'Titel van de Kickstart');
    inline(view.querySelector('.ks__lead'), setting('kickstartLead'), true, 'Belofte van de Kickstart');
  }

  /* ---- Detailpagina: titel en ondertitel -------------------------------------------------- */
  function decorateDetail(view, parsed) {
    const kind = ns.kinds.byRoute(parsed.name);
    if (!kind) return;
    const t = target(kind.type, parsed.params[0]);
    if (!t || t.derived || !ns.rights.can('bewerken', t.namespace, t.type)) return;
    inline(view.querySelector('.detail__title'), editField(t, 'title'), false, 'Titel');
    inline(view.querySelector('.detail__subtitle'), editField(t, kind.textKey), true, 'Ondertitel');
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
    // De voet staat buiten de pagina: na de bewerkmodus opnieuw vullen, dan is hij weer gewoon
    const footer = document.getElementById('footer');
    if (!isOn() && footer && footer.querySelector('[data-inline], .rule-tools, .rules-add')) {
      footer.querySelectorAll('.rules-add').forEach((node) => node.remove());
      ns.app.refreshChrome();
    }
    if (isOn()) decorateFooter(footer);
    if (!isOn() || !parsed) return;
    const view = document.getElementById('view');
    if (!view || parsed.name === 'beheer') return;
    // Op een overzicht (#/tips) kun je ook toevoegen en verslepen
    const listKind = ns.kinds.byList(parsed.name);
    const listType = listKind ? listKind.type : '';
    view.querySelectorAll(CARDS).forEach((card) => decorateCard(card, Boolean(listType)));
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
    decorateTexts(view);
    decorateBlocks(view);
  }

  /* ---- Vaste teksten (koppen, inleidingen, knoppen): js/layout.js ------------------------- */
  function decorateTexts(view) {
    if (!ns.layout.canEdit()) return;
    view.querySelectorAll('[data-text-key]').forEach((node) => {
      if (node.dataset.inline) return;
      const { textKey, textDefault, textLabel } = node.dataset;
      inline(node, (text) => ns.layout.setText(textKey, text, textDefault), node.dataset.textMultiline === 'true', textLabel);
    });
  }

  /* ---- Secties verplaatsen en verbergen: js/layout.js ------------------------------------- */
  let draggingBlock = null;

  function blockKeys(block) {
    return Array.from(block.parentElement.querySelectorAll(':scope > .layout-block'))
      .filter((other) => other.dataset.layoutPage === block.dataset.layoutPage)
      .map((other) => other.dataset.layoutKey);
  }

  function moveBlock(block, toIndex) {
    const keys = blockKeys(block);
    const from = keys.indexOf(block.dataset.layoutKey);
    if (toIndex < 0 || toIndex >= keys.length || toIndex === from) return;
    keys.splice(from, 1);
    keys.splice(toIndex, 0, block.dataset.layoutKey);
    // Ook verborgen secties die nu niet op de pagina staan, houden hun plek achteraan
    const saved = ns.layout.pageLayout(block.dataset.layoutPage).order.filter((key) => !keys.includes(key));
    ns.layout.setOrder(block.dataset.layoutPage, keys.concat(saved));
  }

  function decorateBlocks(view) {
    if (!ns.layout.canEdit()) return;
    const blocks = Array.from(view.querySelectorAll('.layout-block'));
    blocks.forEach((block) => {
      if (block.querySelector(':scope > .block-tools')) return;
      const { layoutPage: page, layoutKey: key, layoutLabel: label } = block.dataset;
      const hidden = block.classList.contains('is-hidden-block');
      const index = () => blockKeys(block).indexOf(key);
      const grip = el('span', { className: 'block-tools__grip', attrs: { title: 'Sleep om te verplaatsen', 'aria-hidden': 'true' } }, [icon('grip')]);
      grip.addEventListener('mousedown', () => {
        block.draggable = true;
        window.addEventListener('mouseup', () => {
          if (!draggingBlock) block.draggable = false;
        }, { once: true });
      });
      const button = (iconName, text, onClick, extra) => {
        const b = el('button', { className: 'block-tools__btn' + (extra || ''), attrs: { type: 'button', title: text, 'aria-label': text + ': ' + label } }, [icon(iconName), el('span', { className: 'block-tools__text', text })]);
        b.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        });
        return b;
      };
      const tools = el('div', { className: 'block-tools', attrs: { role: 'group', 'aria-label': 'Sectie: ' + label } }, [
        grip,
        el('span', { className: 'block-tools__label', text: label + (hidden ? ' · verborgen' : '') }),
        button('arrow-up', 'Omhoog', () => moveBlock(block, index() - 1)),
        button('arrow-down', 'Omlaag', () => moveBlock(block, index() + 1)),
        hidden
          ? button('eye', 'Tonen', () => ns.layout.setHidden(page, key, false), ' block-tools__btn--show')
          : button('close', 'Verbergen', () => ns.layout.setHidden(page, key, true))
      ]);
      block.prepend(tools);

      block.addEventListener('dragstart', (event) => {
        if (event.target !== block) return;
        draggingBlock = block;
        block.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        try {
          event.dataTransfer.setData('text/plain', key);
        } catch (error) {
          /* oudere browsers */
        }
      });
      block.addEventListener('dragend', () => {
        block.draggable = false;
        block.classList.remove('is-dragging');
        blocks.forEach((other) => other.classList.remove('drop-before', 'drop-after'));
        draggingBlock = null;
      });
      block.addEventListener('dragover', (event) => {
        if (!draggingBlock || draggingBlock === block || draggingBlock.dataset.layoutPage !== page) return;
        event.preventDefault();
        const box = block.getBoundingClientRect();
        const after = event.clientY > box.top + box.height / 2;
        block.classList.toggle('drop-after', after);
        block.classList.toggle('drop-before', !after);
      });
      block.addEventListener('dragleave', () => block.classList.remove('drop-before', 'drop-after'));
      block.addEventListener('drop', (event) => {
        if (!draggingBlock || draggingBlock === block) return;
        event.preventDefault();
        const after = block.classList.contains('drop-after');
        block.classList.remove('drop-before', 'drop-after');
        const keys = blockKeys(block).filter((k) => k !== draggingBlock.dataset.layoutKey);
        const target = keys.indexOf(key) + (after ? 1 : 0);
        moveBlock(draggingBlock, target);
      });
    });
    // Eén knop per pagina om de standaardindeling terug te zetten
    const first = blocks[0];
    if (first && !view.querySelector('.block-reset')) {
      const page = first.dataset.layoutPage;
      const saved = ns.layout.pageLayout(page);
      if (saved.order.length || saved.hidden.length) {
        const reset = el('button', { className: 'block-reset btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('replay'), el('span', { text: 'Standaardindeling van deze pagina terugzetten' })]);
        reset.addEventListener('click', () => ns.layout.resetPage(page));
        first.parentElement.append(el('div', { className: 'container block-reset-wrap' }, [reset]));
      }
    }
  }

  /* ---- Voet: de gouden regels en de kleine tekst onderaan ----------------------------------- */
  const currentRules = () => ((ns.app.config() || {}).rules || []).slice();
  function setRules(rules) {
    return ns.editor.change(own(), 'setting', 'site', (state) => {
      state.data = state.data || {};
      state.data.rules = rules;
      return state;
    });
  }

  function decorateFooter(footer) {
    if (!footer || !ns.layout.canEdit()) return;
    decorateTexts(footer);
    const list = document.getElementById('footer-rules');
    if (!list) return;
    list.querySelectorAll('.rules__text').forEach((span) => {
      if (span.dataset.inline) return;
      const index = Number(span.dataset.ruleIndex);
      inline(span, (text) => {
        const rules = currentRules();
        rules[index] = text;
        setRules(rules);
      }, false, `Gouden regel ${index + 1}`);
      const remove = el('button', { className: 'rule-tools', attrs: { type: 'button', title: 'Regel weghalen', 'aria-label': `Regel ${index + 1} weghalen` } }, [icon('trash')]);
      remove.addEventListener('click', async () => {
        if (!(await ns.ui.confirmDialog(`"${span.textContent.trim()}" verdwijnt uit de gouden regels. Live gaat dat pas na Opslaan en Publiceren.`, { title: 'Regel weghalen?', confirmLabel: 'Weghalen', danger: true }))) return;
        const rules = currentRules();
        rules.splice(index, 1);
        setRules(rules);
      });
      span.parentElement.append(remove);
    });
    if (!footer.querySelector('.rules-add')) {
      const add = el('button', { className: 'rules-add btn btn--ghost-dark btn--sm', attrs: { type: 'button' } }, [icon('plus'), el('span', { text: 'Regel toevoegen' })]);
      add.addEventListener('click', () => {
        setRules(currentRules().concat('Nieuwe regel: klik om de tekst aan te passen'));
        ns.ui.announce('Regel toegevoegd. Klik op de tekst om hem aan te passen.');
      });
      list.after(add);
    }
    // Nog geen regels: het blok staat verborgen; in de bewerkmodus toch tonen, zodat je kunt toevoegen
    document.getElementById('rules-section').hidden = false;
  }

  /* ---- Hoofdmenu: namen, volgorde en tonen (knop 'Menu' in de bewerkbalk) ------------------- */
  function openMenu() {
    if (!ns.layout.canEdit()) return;
    const start = JSON.stringify(ns.layout.menu());
    let items = JSON.parse(start);
    const list = el('ol', { className: 'menu-editor', attrs: { role: 'list' } });
    const dirty = () => JSON.stringify(items) !== start;

    function render(focusKey, focusAction) {
      list.replaceChildren(...items.map((item, index) => {
        const input = el('input', { className: 'field__input', attrs: { type: 'text', value: item.label, maxlength: '40', 'aria-label': 'Naam van menuknop ' + (index + 1) } });
        input.addEventListener('input', () => { item.label = input.value; });
        const show = el('input', { attrs: { type: 'checkbox', checked: !item.hidden } });
        show.addEventListener('change', () => {
          item.hidden = !show.checked;
          row.classList.toggle('is-off', item.hidden);
        });
        const move = (delta, action) => {
          const to = index + delta;
          if (to < 0 || to >= items.length) return;
          items.splice(to, 0, items.splice(index, 1)[0]);
          render(item.key, action);
        };
        const button = (iconName, text, onClick, disabled, action) => {
          const b = el('button', { className: 'btn btn--quiet btn--icon btn--sm', attrs: { type: 'button', title: text, 'aria-label': `${text}: ${item.label || item.standard}`, disabled, 'data-action': action } }, [icon(iconName)]);
          b.addEventListener('click', onClick);
          return b;
        };
        const row = el('li', { className: 'menu-editor__row' + (item.hidden ? ' is-off' : ''), dataset: { key: item.key } }, [
          el('span', { className: 'menu-editor__number', text: String(index + 1), attrs: { 'aria-hidden': 'true' } }),
          el('div', { className: 'menu-editor__name' }, [
            input,
            item.label.trim() !== item.standard ? el('span', { className: 'field__hint', text: 'Standaard: ' + item.standard }) : null
          ]),
          el('label', { className: 'menu-editor__show' }, [show, el('span', { text: 'Tonen' })]),
          el('span', { className: 'menu-editor__move' }, [
            button('arrow-up', 'Omhoog', () => move(-1, 'up'), index === 0, 'up'),
            button('arrow-down', 'Omlaag', () => move(1, 'down'), index === items.length - 1, 'down')
          ])
        ]);
        return row;
      }));
      if (focusKey) {
        const row = list.querySelector(`[data-key="${focusKey}"]`);
        const target = row && (row.querySelector(`[data-action="${focusAction}"]:not([disabled])`) || row.querySelector('input[type="text"]'));
        if (target) target.focus();
      }
    }
    render();

    const apply = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Toepassen' })]);
    const reset = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [icon('replay'), el('span', { text: 'Standaardmenu' })]);
    const body = el('div', { className: 'menu-editor__wrap' }, [
      el('p', { className: 'drawer__lead', text: 'Pas de namen aan, zet de knoppen in een andere volgorde of verberg er een. Een verborgen knop haalt alleen de knop weg: de pagina blijft bereikbaar via zoeken en links.' }),
      list,
      el('div', { className: 'menu-editor__actions' }, [apply, reset])
    ]);
    let handle = null;
    const canClose = () => !dirty() || ns.ui.confirmDialog('Wat je in dit paneel hebt aangepast, is nog niet toegepast.', { title: 'Paneel sluiten?', confirmLabel: 'Sluiten zonder toepassen', cancelLabel: 'Verder aanpassen', danger: true });
    apply.addEventListener('click', () => {
      if (dirty()) ns.layout.setMenu(items);
      handle.close();
    });
    reset.addEventListener('click', () => {
      items = ns.layout.MENU.map((item) => ({ key: item.key, standard: item.label, label: item.label, hidden: false }));
      render();
    });
    handle = ns.editor.drawer('Hoofdmenu aanpassen', body, null, { canClose });
    const first = list.querySelector('input');
    if (first) first.focus();
  }

  // In de bewerkmodus: kaarten en links niet openen bij klikken (dan zou je niet kunnen typen)
  document.addEventListener('click', (event) => {
    if (!isOn()) return;
    const link = event.target.closest && event.target.closest('a');
    if (!link || link.closest('.edit-tools, .admin-bar, .topbar, .drawer, .confirm')) return;
    if (link.closest('.edit-slot') || link.querySelector('[data-inline]') || link.closest('[data-inline]')) event.preventDefault();
  }, true);

  ns.editmode = { isOn, toggle, decorate, openPanel, openMenu };
})(window.AIAudit);
