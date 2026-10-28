/* ==========================================================================
   Bewerken: werkversies, opslaan, publiceren, ongedaan maken, logboek
   --------------------------------------------------------------------------
   Drie lagen (zie setup/supabase-audit-bewerken.sql):
   1. Niet opgeslagen: wat je net hebt aangepast. Staat alleen in deze browser
      en wordt automatisch bewaard (ook als je het tabblad sluit). Ongedaan
      maken en opnieuw werken op deze laag.
   2. Opgeslagen werkversie (database): alleen beheerders zien hem, met een
      label Gewijzigd, Nieuw, Voorstel of Gepland.
   3. Gepubliceerd: wat iedereen ziet.
   Opslaan zet 1 → 2. Publiceren zet 2 → 3, nu of op een gekozen moment.

   De bewerkbalk staat bovenin (in de kopbalk) zodra je bent ingelogd:
   Ongedaan maken, Opnieuw, Opslaan (licht op bij wijzigingen), Publiceren,
   Logboek en Bekijk als collega. Sneltoetsen: Ctrl+S, Ctrl+Z, Ctrl+Y.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, storage, formatDate } = ns.ui;
  const confirm = (message, options) => ns.ui.confirmDialog(message, options);
  const UNDO_MAX = 50;
  const PING_EVERY = 30000;
  const KEEP_DAYS = 30; // niet-opgeslagen werk dat ouder is, wordt bij de volgende keer niet meer teruggehaald
  // Adres van een item op de site (fasen en teksten hebben er geen)
  const pageOf = (type, id) => (ns.kinds.byRoute(type) ? ns.kinds.href(type, id) : '');

  const keyOf = (namespace, type, id) => namespace + '|' + type + '|' + id;
  const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

  let pending = new Map(); // keyOf → { namespace, type, id, draft: { data, position, status }, version, title }
  let undoStack = [];
  let redoStack = [];
  let visitorView = false; // 'Bekijk als collega': alleen de gepubliceerde versie
  let restoredFor = '';
  let busy = false;
  let batching = false; // binnen batch(): één stap voor ongedaan maken
  const listeners = new Set();

  /* ---- Toestand ---------------------------------------------------------------- */
  const signedIn = () => Boolean(ns.central.signedIn()) && ns.central.isAdmin();
  /** Kan er met werkversies gewerkt worden (ingelogd, stap 7 uitgevoerd, database leidend)? */
  const available = () => signedIn() && ns.central.draftingAvailable() === true && Array.isArray(ns.content.adminRows);
  const rows = () => (Array.isArray(ns.content.adminRows) ? ns.content.adminRows : []);
  const rowOf = (namespace, type, id) => rows().find((row) => row.namespace === namespace && row.type === type && row.id === id) || null;
  const storeKey = () => 'bewerken:' + (ns.central.signedIn() || '').toLowerCase();
  const titleOf = (data, id) => (data && (data.title || data.label)) || (id === 'site' ? 'Teksten van de site' : id);

  /** De opgeslagen stand van een rij: de werkversie als die er is, anders de gepubliceerde. */
  function savedState(row) {
    if (!row) return null;
    if (row.draft) {
      return { data: row.draft.data || row.data || {}, position: Number.isFinite(row.draft.position) ? row.draft.position : row.position || 0, status: row.draft.status || 'published' };
    }
    return { data: row.data || {}, position: row.position || 0, status: row.status === 'trash' ? 'trash' : 'published' };
  }

  /** Zoals het nu bij jou staat: niet opgeslagen, anders opgeslagen, anders gepubliceerd. */
  function effective(namespace, type, id) {
    const local = pending.get(keyOf(namespace, type, id));
    if (local) return clone(local.draft);
    return clone(savedState(rowOf(namespace, type, id)));
  }

  function emit() {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[AI Cockpit Audit] bewerkbalk', error);
      }
    });
  }

  function persist() {
    if (!ns.central.signedIn()) return;
    if (!pending.size) storage.remove(storeKey());
    else if (!storage.set(storeKey(), Array.from(pending.values()))) toast('Je wijzigingen kunnen niet in deze browser worden bewaard (opslag vol of geblokkeerd). Sla ze op voordat je het tabblad sluit.', { tone: 'warning', duration: 8000 });
  }

  const usable = (entry) => Boolean(entry && entry.namespace && entry.type && entry.id && entry.draft);
  const fresh = (entry) => !entry.at || Date.now() - entry.at < KEEP_DAYS * 86400000;

  /** Niet-opgeslagen wijzigingen van een vorige keer terughalen (eenmalig per sessie). */
  function restore() {
    const email = (ns.central.signedIn() || '').toLowerCase();
    if (!email || restoredFor === email) return;
    restoredFor = email;
    const saved = storage.get(storeKey(), null);
    if (!Array.isArray(saved) || !saved.length) return;
    saved.filter(usable).filter(fresh).forEach((entry) => pending.set(keyOf(entry.namespace, entry.type, entry.id), entry));
    if (pending.size) toast(`${pending.size === 1 ? '1 wijziging' : pending.size + ' wijzigingen'} van de vorige keer terug: nog niet opgeslagen.`, { duration: 7000 });
  }

  /**
   * Een ander tabblad (zelfde beheerder) bewaarde zijn niet-opgeslagen werk. Dat komt er hier bij,
   * anders overschrijft het tabblad dat het laatst bewaart het werk van het andere. Bij hetzelfde
   * item gaat de wijziging in dit tabblad voor.
   */
  function onOtherTab(event) {
    if (!event.key || !ns.central.signedIn() || !event.key.endsWith(':' + storeKey())) return;
    let theirs = [];
    try {
      theirs = JSON.parse(event.newValue || '[]') || [];
    } catch (error) {
      return;
    }
    let added = 0;
    (Array.isArray(theirs) ? theirs : []).filter(usable).forEach((entry) => {
      const key = keyOf(entry.namespace, entry.type, entry.id);
      if (pending.has(key)) return;
      pending.set(key, entry);
      added++;
    });
    if (!added) return;
    persist();
    afterLocalChange();
  }

  const snapshot = () => JSON.stringify(Array.from(pending.entries()));
  function load(state) {
    pending = new Map(JSON.parse(state));
  }

  /** Eén stap voor ongedaan maken vastleggen (de stand vóór de wijziging). */
  function record() {
    undoStack.push(snapshot());
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = [];
  }

  /**
   * Een wijziging klaarzetten (niet opgeslagen). update: object met data/position/status,
   * of een functie die de huidige stand krijgt en de nieuwe teruggeeft.
   */
  function change(namespace, type, id, update) {
    const current = effective(namespace, type, id) || { data: {}, position: 0, status: 'published' };
    const next = typeof update === 'function' ? update(clone(current)) : Object.assign(clone(current), clone(update));
    if (!next) return false;
    if (!batching) record();
    stageQuiet(namespace, type, id, next);
    if (!batching) {
      persist();
      afterLocalChange();
    }
    return true;
  }

  /** Meerdere wijzigingen als één stap (één keer ongedaan maken), bijv. een nieuw adres: het item onder het nieuwe adres en het oude weg. */
  function batch(run) {
    record();
    batching = true;
    try {
      run();
    } finally {
      batching = false;
    }
    persist();
    afterLocalChange();
  }

  /**
   * Volgorde aanpassen: zet item id vóór (of na) targetId, binnen dezelfde soort en naamruimte.
   * Eén wijziging als er ruimte is tussen de buren, anders worden de posities opnieuw genummerd.
   */
  function move(namespace, type, id, targetId, after) {
    if (id === targetId) return false;
    const ids = new Set(rows().filter((row) => row.namespace === namespace && row.type === type).map((row) => row.id));
    pending.forEach((entry) => {
      if (entry.namespace === namespace && entry.type === type) ids.add(entry.id);
    });
    const list = Array.from(ids)
      .map((itemId) => ({ id: itemId, state: effective(namespace, type, itemId) }))
      .filter((item) => item.state && item.state.status !== 'trash')
      .sort((a, b) => (a.state.position || 0) - (b.state.position || 0) || (a.id < b.id ? -1 : 1));
    const moving = list.find((item) => item.id === id);
    if (!moving || !list.some((item) => item.id === targetId)) return false;
    list.splice(list.indexOf(moving), 1);
    const at = list.findIndex((item) => item.id === targetId) + (after ? 1 : 0);
    list.splice(at, 0, moving);
    const prev = list[at - 1];
    const next = list[at + 1];
    const prevPos = prev ? prev.state.position || 0 : null;
    const nextPos = next ? next.state.position || 0 : null;
    let position = null;
    if (prevPos === null && nextPos !== null) position = nextPos - 10;
    else if (nextPos === null && prevPos !== null) position = prevPos + 10;
    else if (prevPos !== null && nextPos - prevPos >= 2) position = Math.floor((prevPos + nextPos) / 2);
    if (position !== null) return change(namespace, type, id, { position });
    // Geen ruimte: alles in stappen van 10, in één stap ongedaan te maken
    batch(() => list.forEach((item, index) => {
      const wanted = (index + 1) * 10;
      if (item.state.position !== wanted) stageQuiet(namespace, type, item.id, Object.assign(item.state, { position: wanted }));
    }));
    return true;
  }

  /**
   * Zoals change(), maar zonder eigen stap voor ongedaan maken en zonder opnieuw opbouwen.
   * De versie blijft die van het moment waarop je met dit item begon: is het intussen door
   * een ander opgeslagen, dan meldt Opslaan dat (in plaats van stil te overschrijven).
   */
  function stageQuiet(namespace, type, id, next) {
    const row = rowOf(namespace, type, id);
    const draft = { data: next.data || {}, position: Number.isFinite(next.position) ? next.position : 0, status: next.status === 'trash' ? 'trash' : 'published' };
    const key = keyOf(namespace, type, id);
    const before = pending.get(key);
    // Weer gelijk aan de opgeslagen stand: dan is er niets meer te bewaren
    if (row && JSON.stringify(draft) === JSON.stringify(savedState(row))) pending.delete(key);
    else pending.set(key, { namespace, type, id, draft, version: before ? before.version : row ? row.version : null, title: titleOf(draft.data, id), at: Date.now() });
  }

  function undo() {
    if (busy || !undoStack.length) return;
    redoStack.push(snapshot());
    load(undoStack.pop());
    persist();
    afterLocalChange();
    ns.ui.announce('Ongedaan gemaakt');
  }

  function redo() {
    if (busy || !redoStack.length) return;
    undoStack.push(snapshot());
    load(redoStack.pop());
    persist();
    afterLocalChange();
    ns.ui.announce('Opnieuw gedaan');
  }

  function afterLocalChange() {
    if (ns.app && ns.app.recompose) ns.app.recompose();
    emit();
  }

  /* ---- Weergave: de site met werkversies erin --------------------------------------- */
  /** Wat er met een opgeslagen werkversie gebeurt bij publiceren: een sleutel uit ns.ui.CHANGES, of '' zonder werkversie. */
  function changeOf(row) {
    if (!row.draft) return '';
    if (row.draft.status === 'trash') return 'verwijderen';
    if (row.publish_at) return 'gepland';
    if (row.draft_kind === 'voorstel') return 'voorstel';
    return row.status === 'draft' ? 'nieuw' : 'gewijzigd';
  }

  /**
   * Rijen zoals een beheerder de site ziet: met werkversies en niet-opgeslagen wijzigingen
   * (en een label). 'Bekijk als collega': alleen wat gepubliceerd is.
   */
  function overlay(list) {
    const source = Array.isArray(list) ? list : [];
    if (visitorView) return source.filter((row) => row.status === 'published');
    const out = source.map((row) => {
      const local = pending.get(keyOf(row.namespace, row.type, row.id));
      const state = local ? local.draft : row.draft ? savedState(row) : null;
      if (!state) return row;
      return Object.assign({}, row, {
        data: state.data,
        position: state.position,
        status: state.status === 'trash' ? 'trash' : 'published',
        _change: local ? 'niet opgeslagen' : changeOf(row)
      });
    });
    pending.forEach((entry) => {
      if (rowOf(entry.namespace, entry.type, entry.id)) return;
      out.push({ namespace: entry.namespace, type: entry.type, id: entry.id, data: entry.draft.data, position: entry.draft.position, status: entry.draft.status === 'trash' ? 'trash' : 'published', _change: 'niet opgeslagen' });
    });
    return out;
  }

  function setVisitorView(on) {
    visitorView = Boolean(on);
    // Als collega kijken en tegelijk bewerken gaat niet samen: je zou de werkversie aanpassen terwijl je de gepubliceerde ziet
    if (visitorView && ns.editmode && ns.editmode.isOn()) ns.editmode.toggle();
    if (ns.app && ns.app.recompose) ns.app.recompose();
    emit();
  }

  /* ---- Opslaan ------------------------------------------------------------------- */
  /**
   * Eén item opslaan als werkversie (uit de bewerkbalk of een formulier in Beheer).
   * Geeft { kind: 'wijziging' | 'voorstel' (een ander zet het live), version }, of false als je bij
   * een conflict de versie van de ander houdt. Gooit een fout als het niet lukt; de wijziging blijft dan staan.
   */
  async function saveOne(entry) {
    const key = keyOf(entry.namespace, entry.type, entry.id);
    const before = pending.get(key);
    const row = rowOf(entry.namespace, entry.type, entry.id);
    const item = Object.assign({ version: before ? before.version : row ? row.version : null, title: titleOf(entry.draft.data, entry.id) }, entry);
    // Alleen weg als er intussen (tijdens het opslaan) niets meer aan dit item is veranderd
    const settled = () => {
      if (pending.get(key) === before) pending.delete(key);
      persist();
    };
    let result = await ns.central.saveDraft(item);
    if (result && result.conflict) {
      if (!(await askConflict(item, result))) {
        settled(); // hun versie houden: jouw niet-opgeslagen wijziging vervalt
        return false;
      }
      result = await ns.central.saveDraft(Object.assign({}, item, { version: result.version }));
      // Intussen wéér door iemand opgeslagen: niet blind overschrijven
      if (result && result.conflict) throw new Error(`intussen opnieuw opgeslagen door ${result.draft_by || result.updated_by || 'een ander'}; bekijk het item en probeer het nog eens`);
    }
    settled();
    // 'voorstel' als je niet mag publiceren (een ander zet het live), anders 'wijziging'
    return { kind: (result && result.kind) || 'wijziging', version: result && Number.isFinite(result.version) ? result.version : null };
  }

  function askConflict(item, result) {
    const who = result.draft_by || result.updated_by || '';
    const at = result.draft_at || result.updated_at;
    const stamp = at ? ' (' + ns.adminKit.moment(at) + ')' : '';
    // Zelf opgeslagen, bijvoorbeeld in een ander tabblad
    if (who && who.toLowerCase() === (ns.central.signedIn() || '').toLowerCase()) {
      return confirm(`Je hebt "${item.title || item.id}" intussen zelf opgeslagen${stamp}, misschien in een ander tabblad. Welke versie wil je houden?`, {
        title: 'Al eerder opgeslagen',
        confirmLabel: 'Deze versie opslaan',
        cancelLabel: 'De opgeslagen versie houden'
      });
    }
    return confirm(`"${item.title || item.id}" is intussen opgeslagen door ${who || 'een andere beheerder'}${stamp}. Zet je jouw versie eroverheen, dan gaat die van de ander verloren.`, {
      title: 'Iemand anders was je voor',
      confirmLabel: 'Mijn versie opslaan',
      cancelLabel: 'Hun versie houden'
    });
  }

  /** Alle niet-opgeslagen wijzigingen opslaan. Geeft true als alles is opgeslagen. */
  async function save() {
    if (busy) return false;
    if (!pending.size) return true;
    busy = true;
    emit();
    const failed = [];
    const kinds = [];
    try {
      for (const entry of Array.from(pending.values())) {
        try {
          kinds.push(await saveOne(entry));
        } catch (error) {
          failed.push(`${entry.title || entry.id}: ${error.message}`);
        }
      }
      // Ongedaan maken gaat over niet-opgeslagen werk: na opslaan begint dat opnieuw
      // (anders haalt Ctrl+Z een stand terug die al is opgeslagen, met een oude versie)
      undoStack = [];
      redoStack = [];
      await ns.app.reloadContent();
    } finally {
      busy = false;
      emit();
    }
    if (failed.length) {
      toast('Niet alles is opgeslagen. ' + failed.join(' · '), { tone: 'warning', duration: 9000 });
      return false;
    }
    const savedKinds = kinds.filter(Boolean).map((saved) => saved.kind);
    if (!savedKinds.length) toast('Niets opgeslagen: de versie die al was opgeslagen is gehouden.');
    else if (savedKinds.every((kind) => kind === 'voorstel')) toast('Voorstel opgeslagen. Een beheerder of redacteur bekijkt het en publiceert het.', { tone: 'success', duration: 6000 });
    else toast('Opgeslagen. Nog niet live: publiceer om het voor iedereen te tonen.', { tone: 'success' });
    return true;
  }

  /* ---- Publiceren --------------------------------------------------------------------- */
  /** De naamruimtes van deze cockpit: de eigen inhoud en de gedeelde basis. */
  const cockpitNamespaces = () => [ns.cockpit.namespace(ns.cockpit.activeId()), ns.cockpit.GENERAL_NAMESPACE];

  /** Opgeslagen werkversies (en oude concepten) in deze cockpit. */
  function waiting() {
    const spaces = cockpitNamespaces();
    return rows()
      .filter((row) => spaces.includes(row.namespace) && row.type !== 'meta' && (row.draft || row.status === 'draft'))
      .map((row) => {
        const state = savedState(row);
        const deleting = row.draft && row.draft.status === 'trash';
        return {
          namespace: row.namespace,
          type: row.type,
          id: row.id,
          row,
          title: titleOf(state.data, row.id),
          kind: deleting ? 'verwijderen' : !row.draft ? 'concept' : row.status === 'draft' ? 'nieuw' : 'gewijzigd',
          proposal: row.draft_kind === 'voorstel',
          by: row.draft_by || row.updated_by || '',
          at: row.draft_at || row.updated_at || '',
          publishAt: row.publish_at || '',
          canPublish: ns.rights.can('publiceren', row.namespace, row.type) && (!deleting || ns.rights.can('verwijderen', row.namespace, row.type)),
          warnings: deleting ? [] : checks(row.type, state.data, row.id)
        };
      })
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  /**
   * Controle vóór publiceren: aandachtspunten, geen blokkade. Je kunt altijd toch publiceren.
   */
  function checks(type, data, id) {
    const d = data || {};
    const out = [];
    if (type !== 'setting' && !d.title && !d.label) out.push('Geen titel');
    const refs = { relatedTips: 'tipById', usecases: 'usecaseById', tips: 'tipById', trainings: 'trainingById', phases: 'phaseById' };
    Object.keys(refs).forEach((field) => {
      (Array.isArray(d[field]) ? d[field] : []).forEach((ref) => {
        const map = ns.content[refs[field]];
        if (map && !map.has(ref)) out.push(`Verwijst naar "${ref}", dat niet (meer) bestaat`);
      });
    });
    if ((type === 'usecase' || type === 'prompt') && d.phase && ns.content.phaseById && !ns.content.phaseById.has(d.phase)) out.push(`Onbekende fase "${d.phase}"`);
    ['link', 'registerUrl'].forEach((field) => {
      if (d[field] && !/^https:\/\//i.test(d[field])) out.push('Een link begint niet met https://');
    });
    if (type === 'usecase') {
      if (!d.video && !d.demo) out.push('Nog geen demo: de kaart toont "Demo volgt"');
      if (!(Array.isArray(d.prompts) && d.prompts.some((p) => p && String(p.text || '').trim()))) out.push('Nog geen prompt');
      if (!String(d.intro || '').trim()) out.push('Geen introductie');
    }
    if (type === 'prompt' && !String(d.prompt || '').trim()) out.push('Geen prompttekst');
    if ((type === 'tip' || type === 'agent') && !String(d.summary || '').trim()) out.push('Geen samenvatting');
    if (type === 'tip' && d.release) {
      const day = new Date(d.release + 'T12:00:00');
      if (Number.isNaN(day.getTime())) out.push('De datum van de tip van de week klopt niet');
      else if (day.getDay() !== 5) out.push('De tip van de week valt niet op een vrijdag');
    }
    const filler = JSON.stringify(d).match(/lorem ipsum|\bTODO\b|\bXXX\b/i);
    if (filler) out.push(`Bevat nog opvultekst ("${filler[0]}")`);
    return out;
  }

  async function publish(items, at) {
    if (!items.length) return;
    busy = true;
    emit();
    try {
      // Met de versie die je in het paneel zag: is het item intussen opnieuw opgeslagen, dan slaat de database het over (stap 8)
      const versionOf = (item) => (Number.isFinite(item.version) ? item.version : item.row ? item.row.version : null);
      const result = await ns.central.publish(items.map((item) => ({ namespace: item.namespace, type: item.type, id: item.id, version: versionOf(item) })), at || null);
      await ns.app.reloadContent();
      const skipped = (result && result.skipped) || [];
      const done = (result && result.done) || 0;
      const scheduled = (result && result.scheduled) || 0;
      const parts = [];
      if (done) parts.push(done === 1 ? '1 item staat live' : done + ' items staan live');
      if (scheduled) parts.push(`${scheduled === 1 ? '1 item' : scheduled + ' items'} gepland op ${ns.adminKit.moment(at)}`);
      if (skipped.length) parts.push(`${skipped.length} overgeslagen (${skipped.map((s) => s.reason).join(', ')})`);
      toast(parts.join(' · ') || 'Niets gepubliceerd', { tone: skipped.length ? 'warning' : 'success', duration: 6000 });
    } catch (error) {
      ns.adminKit.failed('Publiceren', error, 8000);
    } finally {
      busy = false;
      emit();
    }
  }

  async function discard(item) {
    const effect = item.kind === 'nieuw' ? 'Het nieuwe item verdwijnt helemaal.' : item.kind === 'concept' ? 'Het concept verdwijnt helemaal.' : 'De gepubliceerde versie blijft staan.';
    if (!(await confirm(`De opgeslagen wijziging van "${item.title}" wordt weggegooid. ${effect}`, { title: 'Wijziging weggooien?', confirmLabel: 'Weggooien', danger: true }))) return false;
    try {
      await ns.central.discardDraft(item.type, item.id, item.namespace);
      await ns.app.reloadContent();
      toast('Weggegooid');
      return true;
    } catch (error) {
      ns.adminKit.failed('Weggooien', error, 7000);
      return false;
    }
  }

  /* ---- Zijpaneel (publiceren, logboek, versies) ----------------------------------------- */
  /**
   * options.canClose(): mag het paneel dicht (Sluiten, Escape, klik ernaast)? Bijv. vragen bij
   * een half ingevuld formulier. Mag ook een Promise geven.
   */
  function drawer(title, body, footer, options) {
    const opts = options || {};
    const titleId = 'drawer-' + Math.random().toString(36).slice(2, 8);
    const closeButton = el('button', { className: 'btn btn--quiet btn--icon', attrs: { type: 'button', 'aria-label': 'Sluiten' } }, [icon('close')]);
    const dialog = el('dialog', { className: 'drawer', attrs: { 'aria-labelledby': titleId } }, [
      el('div', { className: 'drawer__panel' }, [
        el('div', { className: 'drawer__head' }, [el('h2', { className: 'drawer__title', text: title, attrs: { id: titleId } }), closeButton]),
        el('div', { className: 'drawer__body' }, [body]),
        footer ? el('div', { className: 'drawer__foot' }, [footer]) : null
      ])
    ]);
    const close = () => {
      try {
        dialog.close();
      } catch (error) {
        /* al dicht */
      }
      dialog.remove();
    };
    const tryClose = async () => {
      if (opts.canClose && !(await opts.canClose())) return;
      close();
    };
    closeButton.addEventListener('click', tryClose);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) tryClose();
    });
    // Escape: eerst vragen (de browser zou het paneel anders meteen sluiten)
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      tryClose();
    });
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return { dialog, close, tryClose };
  }

  const shortName = (email) => String(email || '').split('@')[0] || 'onbekend';
  const when = (value) => (value ? new Date(value).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const KIND_TEXT = { nieuw: 'Nieuw', gewijzigd: 'Gewijzigd', verwijderen: 'Verwijderen', concept: 'Concept' };

  /** Paneel Publiceren: wat klaarstaat, met aandachtspunten, nu of gepland. */
  async function openPublish() {
    if (busy) return;
    if (pending.size) {
      const ok = await confirm(`Je hebt nog ${pending.size === 1 ? '1 wijziging' : pending.size + ' wijzigingen'} die niet is opgeslagen. Die sla ik eerst op.`, { title: 'Eerst opslaan', confirmLabel: 'Opslaan en verder' });
      if (!ok || !(await save())) return;
    }
    const items = waiting();
    const checks = new Map();
    const list = el('ul', { className: 'publish-list', attrs: { role: 'list' } }, items.map((item) => {
      const box = el('input', { attrs: { type: 'checkbox', checked: item.canPublish, disabled: !item.canPublish, 'aria-label': 'Publiceren: ' + item.title } });
      checks.set(item, box);
      const page = pageOf(item.type, item.id);
      const discardButton = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('trash'), el('span', { text: 'Weggooien' })]);
      discardButton.addEventListener('click', async () => {
        if (await discard(item)) {
          handle.close();
          openPublish();
        }
      });
      const unscheduleButton = item.publishAt && item.canPublish ? el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('close'), el('span', { text: 'Planning annuleren' })]) : null;
      if (unscheduleButton) {
        unscheduleButton.addEventListener('click', async () => {
          try {
            await ns.central.unschedule(item.type, item.id, item.namespace);
            await ns.app.reloadContent();
            handle.close();
            openPublish();
          } catch (error) {
            toast('Mislukt: ' + error.message, { tone: 'warning' });
          }
        });
      }
      return el('li', { className: 'publish-item' + (item.warnings.length ? ' publish-item--warn' : '') }, [
        el('label', { className: 'publish-item__check' }, [box]),
        el('div', { className: 'publish-item__body' }, [
          el('p', { className: 'publish-item__meta' }, [
            el('span', { className: 'badge badge--change', text: KIND_TEXT[item.kind] }),
            item.proposal ? el('span', { className: 'badge badge--mine', text: 'Voorstel van ' + shortName(item.by) }) : null,
            item.publishAt ? el('span', { className: 'badge badge--week' }, [icon('calendar'), 'Gepland: ' + when(item.publishAt)]) : null,
            el('span', { text: `${ns.kinds.label(item.type)}${item.namespace === ns.cockpit.GENERAL_NAMESPACE ? ' · gedeelde basis' : ''} · ${shortName(item.by)}, ${when(item.at)}` })
          ]),
          el('p', { className: 'publish-item__title' }, [
            page && item.kind !== 'verwijderen' ? el('a', { attrs: { href: page }, text: item.title }) : el('span', { text: item.title })
          ]),
          item.warnings.length ? el('ul', { className: 'publish-item__warnings' }, item.warnings.map((w) => el('li', {}, [icon('alert'), el('span', { text: w })]))) : null,
          !item.canPublish ? el('p', { className: 'field__hint', text: 'Wacht op iemand die mag publiceren.' }) : null,
          el('div', { className: 'publish-item__actions' }, [discardButton, unscheduleButton])
        ])
      ]);
    }));

    const nowId = 'pub-now-' + Date.now();
    const laterId = 'pub-later-' + Date.now();
    const now = el('input', { attrs: { type: 'radio', name: 'pub-when', id: nowId, checked: true } });
    const later = el('input', { attrs: { type: 'radio', name: 'pub-when', id: laterId } });
    const moment = el('input', { className: 'field__input field__input--sm', attrs: { type: 'datetime-local', 'aria-label': 'Moment van publiceren' } });
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(8, 0, 0, 0);
    moment.value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    moment.addEventListener('focus', () => {
      later.checked = true;
      sync();
    });
    const go = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('send'), el('span')]);
    const selected = () => items.filter((item) => checks.get(item).checked);
    const sync = () => {
      const n = selected().length;
      go.querySelector('span').textContent = (later.checked ? 'Plannen' : 'Publiceren') + (n ? ` (${n})` : '');
      go.disabled = !n;
    };
    [now, later].forEach((input) => input.addEventListener('change', sync));
    checks.forEach((box) => box.addEventListener('change', sync));
    sync();
    go.addEventListener('click', async () => {
      let at = null;
      if (later.checked) {
        at = new Date(moment.value);
        if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
          toast('Kies een moment in de toekomst.', { tone: 'warning' });
          return;
        }
      }
      const chosen = selected();
      const warned = chosen.filter((item) => item.warnings.length).length;
      if (warned && !(await confirm(`${warned === 1 ? '1 item heeft' : warned + ' items hebben'} nog aandachtspunten. Toch ${at ? 'plannen' : 'publiceren'}?`, { title: 'Aandachtspunten', confirmLabel: at ? 'Toch plannen' : 'Toch publiceren' }))) return;
      handle.close();
      await publish(chosen, at);
    });

    const body = items.length
      ? el('div', {}, [
        el('p', { className: 'drawer__lead', text: 'Opgeslagen wijzigingen in deze cockpit. Vink aan wat live mag; aandachtspunten zijn een hulp, geen blokkade.' }),
        list
      ])
      : el('p', { className: 'drawer__lead', text: 'Er staat niets klaar om te publiceren. Pas iets aan en sla het op.' });
    const footer = items.length ? el('div', { className: 'publish-when' }, [
      el('label', { className: 'check', attrs: { for: nowId } }, [now, el('span', { text: 'Nu publiceren' })]),
      el('label', { className: 'check', attrs: { for: laterId } }, [later, el('span', { text: 'Plannen op' })]),
      moment,
      go
    ]) : null;
    const handle = drawer('Publiceren', body, footer);
  }

  const LOG_LIMIT = 1000;
  // Welke dagen in het logboek openstaan, zolang de site open is (eerste keer: alleen de nieuwste)
  let logOpenDays = null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /**
   * Paneel Logboek: wie deed wat, per dag in te klappen en te doorzoeken (naam, actie, titel,
   * soort of datum), met per item de eerdere versies.
   */
  async function openLog() {
    const body = el('div', {}, [el('p', { className: 'drawer__lead', text: 'Logboek laden…' })]);
    const handle = drawer('Logboek', body);
    let entries = [];
    try {
      entries = await ns.central.listLog(cockpitNamespaces(), LOG_LIMIT);
    } catch (error) {
      body.replaceChildren(el('p', { className: 'drawer__lead', text: 'Het logboek is niet te lezen: ' + error.message }));
      return;
    }
    if (!entries.length) {
      body.replaceChildren(el('p', { className: 'drawer__lead', text: 'Nog niets gebeurd sinds het logboek er is.' }));
      return;
    }
    const days = new Map();
    entries.forEach((entry) => {
      const day = formatDate(entry.at);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(entry);
    });
    if (!logOpenDays) logOpenDays = new Set([days.keys().next().value]);
    let searching = false;

    const groups = Array.from(days.entries()).map(([day, list]) => {
      const items = list.map((entry) => {
        const time = new Date(entry.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
        const page = entry.item_id ? pageOf(entry.type, entry.item_id) : '';
        const kind = entry.type ? ns.kinds.label(entry.type) : '';
        const versions = entry.type && entry.item_id ? el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Versies' })]) : null;
        if (versions) versions.addEventListener('click', () => openVersions(entry.namespace, entry.type, entry.item_id, entry.title));
        const node = el('li', { className: 'log-item' }, [
          el('span', { className: 'log-item__time', text: time }),
          el('span', { className: 'log-item__text' }, [
            el('strong', { text: shortName(entry.actor) }), ' ', entry.action, entry.title ? ' · ' : '',
            entry.title ? (page ? el('a', { attrs: { href: page }, text: entry.title }) : el('span', { text: entry.title })) : null,
            kind ? el('span', { className: 'log-item__type', text: ' (' + kind + ')' }) : null
          ]),
          versions
        ]);
        // Naam zonder domein: anders vindt 'visser' iedere regel
        return { node, haystack: ns.ui.normalize([shortName(entry.actor), entry.action, entry.title, kind, entry.item_id, day, time].join(' ')) };
      });
      const count = el('span', { className: 'log-day__count' });
      const details = el('details', { className: 'log-day', attrs: { open: logOpenDays.has(day) } }, [
        el('summary', { className: 'log-day__head' }, [
          el('span', { className: 'log-day__title', text: day }),
          count,
          icon('chevron-down', { className: 'log-day__chevron' })
        ]),
        el('ul', { className: 'log-list', attrs: { role: 'list' } }, items.map((item) => item.node))
      ]);
      return { day, details, items, count, total: list.length };
    });

    const toggleAll = el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [el('span')]);
    const status = el('p', { className: 'log-tools__status', attrs: { role: 'status' } });
    const visible = () => groups.filter((group) => !group.details.hidden);
    const syncToggleAll = () => {
      toggleAll.firstChild.textContent = visible().some((group) => !group.details.open) ? 'Alles uitklappen' : 'Alles inklappen';
    };

    // Zelf in- of uitgeklapt (niet tijdens het zoeken): onthouden voor de volgende keer
    groups.forEach((group) => group.details.addEventListener('toggle', () => {
      if (!searching) {
        if (group.details.open) logOpenDays.add(group.day);
        else logOpenDays.delete(group.day);
      }
      syncToggleAll();
    }));
    toggleAll.addEventListener('click', () => {
      const open = visible().some((group) => !group.details.open);
      visible().forEach((group) => { group.details.open = open; });
      syncToggleAll();
    });

    const input = el('input', { className: 'search__input', attrs: { id: 'log-search', type: 'search', placeholder: 'Zoek op naam, actie, titel of datum', autocomplete: 'off', enterkeyhint: 'search' } });
    /** Alleen de regels die passen; dagen met een treffer gaan open. Leeg zoekveld: zoals je het had. */
    function update() {
      const query = input.value.trim();
      searching = Boolean(query);
      let found = 0;
      groups.forEach((group) => {
        let hits = 0;
        group.items.forEach((item) => {
          const hit = !searching || ns.ui.matches(item.haystack, query);
          item.node.hidden = !hit;
          if (hit) hits += 1;
        });
        found += hits;
        group.details.hidden = searching && !hits;
        group.details.open = searching ? hits > 0 : logOpenDays.has(group.day);
        group.count.textContent = searching ? `${hits} van ${group.total}` : plural(group.total, 'wijziging', 'wijzigingen');
      });
      const daysFound = visible().length;
      status.textContent = !searching
        ? `${plural(entries.length, 'wijziging', 'wijzigingen')} op ${plural(groups.length, 'dag', 'dagen')}${entries.length >= LOG_LIMIT ? ` (de laatste ${LOG_LIMIT})` : ''}.`
        : found
          ? `${plural(found, 'wijziging', 'wijzigingen')} gevonden op ${plural(daysFound, 'dag', 'dagen')}.`
          : `Niets gevonden voor "${query}". Zoek op een naam, een actie (bijv. gepubliceerd), een titel of een datum (bijv. 23 okt).`;
      toggleAll.hidden = searching && !found;
      syncToggleAll();
    }
    let timer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 120);
    });
    // Escape maakt eerst het zoekveld leeg; pas daarna sluit hij het paneel
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !input.value) return;
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      update();
    });
    const search = el('form', { className: 'search search--log', attrs: { role: 'search', novalidate: true } }, [
      el('label', { className: 'sr-only', text: 'Zoek in het logboek', attrs: { for: 'log-search' } }),
      icon('search', { className: 'search__icon' }),
      input
    ]);
    search.addEventListener('submit', (event) => event.preventDefault());

    body.replaceChildren(
      el('div', { className: 'log-tools' }, [search, el('div', { className: 'log-tools__row' }, [status, toggleAll])]),
      ...groups.map((group) => group.details)
    );
    update();
    // Het paneel stond al open tijdens het laden: dan direct kunnen zoeken
    if (handle.dialog.contains(document.activeElement)) input.focus();
  }

  /** Eerdere gepubliceerde versies van één item; terugzetten maakt er een werkversie van. */
  async function openVersions(namespace, type, id, title) {
    const body = el('div', {}, [el('p', { className: 'drawer__lead', text: 'Versies laden…' })]);
    const handle = drawer('Versies: ' + (title || id), body);
    let list = [];
    try {
      list = await ns.central.listHistory(type, id, namespace);
    } catch (error) {
      body.replaceChildren(el('p', { className: 'drawer__lead', text: 'Niet te lezen: ' + error.message }));
      return;
    }
    if (!list.length) {
      body.replaceChildren(el('p', { className: 'drawer__lead', text: 'Nog geen eerdere versies.' }));
      return;
    }
    body.replaceChildren(
      el('p', { className: 'drawer__lead', text: 'Iedere eerdere gepubliceerde versie. Terugzetten maakt er een niet-opgeslagen wijziging van: kijk hem na, sla op en publiceer.' }),
      el('ul', { className: 'log-list', attrs: { role: 'list' } }, list.map((version) => {
        const back = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button', disabled: !ns.rights.can('bewerken', namespace, type) } }, [icon('refresh'), el('span', { text: 'Terugzetten' })]);
        back.addEventListener('click', () => {
          const current = effective(namespace, type, id) || { position: 0 };
          change(namespace, type, id, { data: version.data || {}, position: current.position, status: version.status === 'trash' ? 'trash' : 'published' });
          handle.close();
          toast('Teruggezet als niet-opgeslagen wijziging. Sla op en publiceer om hem live te zetten.', { duration: 7000 });
        });
        return el('li', { className: 'log-item' }, [
          el('span', { className: 'log-item__time', text: when(version.changed_at) }),
          el('span', { className: 'log-item__text' }, [
            el('strong', { text: titleOf(version.data, id) }),
            el('span', { className: 'log-item__type', text: ` · vervangen door ${shortName(version.changed_by)}${version.status === 'trash' ? ' · stond in de prullenbak' : ''}` })
          ]),
          back
        ]);
      }))
    );
  }

  /* ---- Wie bewerkt wat ------------------------------------------------------------- */
  // Eén melding per item, ook als de pagina intussen opnieuw wordt opgebouwd (dan verhuist hij mee)
  const watching = new Map(); // keyOf → { namespace, type, id, node, notice, timer }

  function stopWatch(key) {
    const entry = watching.get(key);
    if (!entry) return;
    window.clearTimeout(entry.timer);
    watching.delete(key);
    ns.central.leave(entry.type, entry.id, entry.namespace);
  }

  /**
   * Meldt dat je dit item open hebt (zolang node in de pagina staat) en toont een
   * waarschuwing in node als iemand anders het ook open heeft.
   */
  function watch(namespace, type, id, node) {
    if (!available() || !node) return;
    const key = keyOf(namespace, type, id);
    const notice = el('p', { className: 'notice notice--warning presence', attrs: { role: 'status', hidden: true } });
    node.prepend(notice);
    const running = watching.get(key);
    if (running) {
      // Al bezig (de pagina is opnieuw opgebouwd): verder in het nieuwe formulier
      running.node = node;
      running.notice = notice;
      return;
    }
    const entry = { namespace, type, id, node, notice, timer: 0 };
    watching.set(key, entry);
    async function tick() {
      if (watching.get(key) !== entry) return;
      if (!entry.node.isConnected || !signedIn()) {
        stopWatch(key);
        return;
      }
      // Tabblad op de achtergrond: niet melden (scheelt verzoeken), wel blijven kijken
      if (!document.hidden) {
        const others = await ns.central.ping(type, id, namespace);
        if (watching.get(key) !== entry) return;
        if (others.length) {
          entry.notice.replaceChildren(icon('users'), el('span', { text: `${others.map((o) => shortName(o.editor)).join(' en ')} ${others.length === 1 ? 'heeft' : 'hebben'} dit item ook open. Overleg even, anders overschrijven jullie elkaars werk.` }));
          entry.notice.hidden = false;
        } else entry.notice.hidden = true;
      }
      entry.timer = window.setTimeout(tick, PING_EVERY);
    }
    entry.timer = window.setTimeout(tick, 400);
  }

  /* ---- Bewerkbalk ---------------------------------------------------------------------
     Eén keer opgebouwd en daarna alleen bijgewerkt: een knop die je net gebruikte houdt de
     focus, en een schermlezer meldt de stand (role=status) alleen als die verandert. Een knop
     die nu niets kan doen is aria-disabled (niet disabled): dan blijft hij focus houden. */
  let barItem = null; // het item van de huidige pagina: { type, id, namespace, label, shared }
  let barParts = null;

  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };
  const setOff = (button, off) => button.setAttribute('aria-disabled', String(Boolean(off)));

  function barButton(className, iconName, text, attrs, onClick) {
    const label = text == null ? null : el('span', { text });
    const button = el('button', { className: 'admin-bar__btn' + (className ? ' ' + className : ''), attrs: Object.assign({ type: 'button' }, attrs) }, [icon(iconName), label]);
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') onClick();
    });
    return { button, label };
  }

  function buildBar(bar) {
    const p = {};
    p.role = el('span', { className: 'admin-bar__role' });
    p.brand = el('a', { className: 'admin-bar__brand', attrs: { href: '#/beheer', title: 'Naar Beheer' } }, [icon('lock'), p.role]);
    // Bewerken op de pagina zelf (js/editmode.js)
    p.mode = barButton('admin-bar__btn--mode', 'pencil-line', 'Bewerken', { 'aria-pressed': 'false', title: 'Pas de pagina zelf aan: teksten, volgorde, toevoegen en verwijderen' }, () => ns.editmode.toggle());
    p.status = el('span', { className: 'admin-bar__status', attrs: { role: 'status' } });
    p.undo = barButton('', 'arrow-left', null, { title: 'Ongedaan maken (Ctrl+Z)', 'aria-label': 'Ongedaan maken' }, undo);
    p.redo = barButton('', 'arrow-right', null, { title: 'Opnieuw (Ctrl+Y)', 'aria-label': 'Opnieuw' }, redo);
    p.group = el('span', { className: 'admin-bar__group' }, [p.undo.button, p.redo.button]);
    p.save = barButton('admin-bar__btn--save', 'check', 'Opslaan', { title: 'Opslaan (Ctrl+S)' }, save);
    p.publish = barButton('admin-bar__btn--publish', 'send', 'Publiceren', {}, openPublish);
    p.count = el('span', { className: 'admin-bar__count' });
    p.publish.button.append(p.count);
    p.log = barButton('', 'clock', 'Logboek', {}, openLog);
    p.view = barButton('', 'eye', 'Als collega', { 'aria-pressed': 'false', title: 'Bekijk de site zoals collega\'s hem zien' }, () => setVisitorView(!visitorView));
    // 'Bewerk deze tip': in de bewerkmodus het zijpaneel, anders het formulier in Beheer
    p.itemButton = barButton('admin-bar__btn--item', 'pencil-line', '', {}, () => ns.editmode.openPanel(barItem.type, barItem.namespace, barItem.id));
    p.itemLabel = el('span');
    p.itemLink = el('a', { className: 'admin-bar__btn admin-bar__btn--item' }, [icon('pencil-line'), p.itemLabel]);
    p.tools = [p.mode.button, p.group, p.save.button, p.publish.button, p.log.button, p.view.button];
    bar.replaceChildren(el('div', { className: 'container admin-bar__inner' }, [p.brand, p.mode.button, p.status, p.group, p.save.button, p.publish.button, p.log.button, p.view.button, p.itemButton.button, p.itemLink]));
    return p;
  }

  function renderBar() {
    const bar = document.getElementById('admin-bar');
    if (!bar) return;
    if (!signedIn()) {
      bar.hidden = true;
      bar.replaceChildren();
      barParts = null;
      document.body.classList.remove('has-admin-bar');
      return;
    }
    if (!barParts || !bar.contains(barParts.brand)) barParts = buildBar(bar);
    const p = barParts;
    bar.hidden = false;
    document.body.classList.add('has-admin-bar');
    const own = ns.cockpit.namespace(ns.cockpit.activeId());
    const general = ns.rights.describe(ns.cockpit.GENERAL_NAMESPACE);
    setText(p.role, ns.rights.describe(own) || (general ? general + ' (gedeelde basis)' : ns.rights.isOwner() ? 'Hoofdbeheerder' : 'Beheer'));

    const on = available();
    p.tools.forEach((node) => { node.hidden = !on; });
    p.mode.button.hidden = !on || !ns.editmode;
    p.status.classList.toggle('admin-bar__status--dirty', on && pending.size > 0);
    if (!on) {
      setText(p.status, ns.central.draftingAvailable() === false ? 'Opslaan en publiceren werkt na stap 7 (setup/supabase-audit-bewerken.sql). Tot dan gaan wijzigingen in Beheer direct live.' : 'Beheer');
    } else {
      const waitingItems = waiting();
      const waitingCount = waitingItems.length;
      const proposals = waitingItems.filter((item) => item.proposal).length;
      setText(p.status, busy ? 'Bezig…' : pending.size ? `${pending.size === 1 ? '1 wijziging' : pending.size + ' wijzigingen'} niet opgeslagen` : waitingCount ? `${waitingCount} klaar om te publiceren${proposals ? ` (${proposals === 1 ? '1 voorstel' : proposals + ' voorstellen'})` : ''}` : 'Alles is gepubliceerd');
      if (ns.editmode) {
        p.mode.button.setAttribute('aria-pressed', String(ns.editmode.isOn()));
        setText(p.mode.label, ns.editmode.isOn() ? 'Bewerken aan' : 'Bewerken');
      }
      setOff(p.undo.button, !undoStack.length || busy);
      setOff(p.redo.button, !redoStack.length || busy);
      setOff(p.save.button, !pending.size || busy);
      p.save.button.classList.toggle('is-dirty', pending.size > 0);
      const canPublishHere = ns.rights.can('publiceren', own) || ns.rights.can('publiceren', ns.cockpit.GENERAL_NAMESPACE);
      setOff(p.publish.button, busy || (!waitingCount && !pending.size));
      setText(p.publish.label, canPublishHere ? 'Publiceren' : 'Klaar voor publicatie');
      setText(p.count, String(waitingCount));
      p.count.hidden = !waitingCount;
      p.view.button.setAttribute('aria-pressed', String(visitorView));
    }
    const inPanel = Boolean(barItem && ns.editmode && ns.editmode.isOn() && on);
    p.itemButton.button.hidden = !inPanel;
    p.itemLink.hidden = !barItem || inPanel;
    if (barItem) {
      setText(p.itemButton.label, 'Bewerk ' + barItem.label);
      setText(p.itemLabel, 'Bewerk ' + barItem.label);
      p.itemLink.setAttribute('href', `#/beheer/${barItem.shared ? 'basis' : 'inhoud'}/${barItem.type}/${barItem.id}`);
    }
  }

  /** De pagina is gewisseld: welk item staat erop (voor 'Bewerk deze tip'). */
  function setPageItem(item) {
    barItem = item || null;
    renderBar();
  }

  function onKey(event) {
    if (!signedIn() || !available()) return;
    const mod = event.ctrlKey || event.metaKey;
    // AltGr (Ctrl+Alt) is een gewone letter; een ingedrukt gehouden toets niet steeds opnieuw
    if (!mod || event.altKey || event.repeat) return;
    const key = event.key.toLowerCase();
    const target = event.target;
    if (key === 's') {
      event.preventDefault();
      // In een formulier (Beheer of het zijpaneel): dát formulier opslaan, niet de bewerkbalk
      const form = target && target.closest ? target.closest('form.cms-form') : null;
      if (form) form.requestSubmit();
      else if (!document.querySelector('dialog[open]')) save();
      return;
    }
    // Niet achter een open venster (bijv. het publiceerpaneel) iets ongedaan maken
    if (document.querySelector('dialog[open]')) return;
    // In een tekstveld doet de browser zelf ongedaan maken
    if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      redo();
    }
  }

  function init() {
    listeners.add(renderBar);
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', persist);
    window.addEventListener('storage', onOtherTab);
  }

  /** Na het (opnieuw) laden van de inhoud: niet-opgeslagen werk terughalen en de balk bijwerken. */
  function contentLoaded() {
    // Uitgelogd (bijv. sessie verlopen) of iemand anders ingelogd in dit tabblad: niets van de vorige
    // meenemen (diens werk staat al onder diens eigen naam in deze browser)
    const email = (ns.central.signedIn() || '').toLowerCase();
    if (restoredFor && restoredFor !== email) {
      pending = new Map();
      undoStack = [];
      redoStack = [];
      visitorView = false;
      restoredFor = '';
    }
    if (available()) restore();
    renderBar();
  }

  /**
   * Vóór uitloggen: het werk blijft bewaard in deze browser (onder je eigen naam), maar niets
   * ervan blijft in het geheugen hangen voor wie hierna in dit tabblad inlogt.
   */
  function reset() {
    persist();
    Array.from(watching.keys()).forEach(stopWatch);
    pending = new Map();
    undoStack = [];
    redoStack = [];
    visitorView = false;
    restoredFor = '';
    barItem = null;
  }

  ns.editor = {
    init,
    available,
    contentLoaded,
    reset,
    overlay,
    effective,
    change,
    batch,
    move,
    drawer,
    saveOne,
    publish,
    watch,
    setPageItem,
    setVisitorView,
    savedState,
    changeOf
  };
})(window.AIAudit);
