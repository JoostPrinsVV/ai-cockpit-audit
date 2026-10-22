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
  const TYPE_LABEL = { usecase: 'Usecase', prompt: 'Prompt', tip: 'Tip', training: 'Training', agent: 'Agent', phase: 'Fase', setting: 'Teksten' };
  const ROUTE = { usecase: 'usecase', prompt: 'prompt', tip: 'tip', training: 'training', agent: 'agent' };

  const keyOf = (namespace, type, id) => namespace + '|' + type + '|' + id;
  const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

  let pending = new Map(); // keyOf → { namespace, type, id, draft: { data, position, status }, version, title }
  let undoStack = [];
  let redoStack = [];
  let visitorView = false; // 'Bekijk als collega': alleen de gepubliceerde versie
  let restoredFor = '';
  let busy = false;
  const listeners = new Set();

  /* ---- Toestand ---------------------------------------------------------------- */
  const signedIn = () => Boolean(ns.central.signedIn()) && ns.central.isAdmin();
  /** Kan er met werkversies gewerkt worden (ingelogd, stap 7 uitgevoerd, database leidend)? */
  const available = () => signedIn() && ns.central.draftingAvailable() === true && Array.isArray(ns.content.adminRows);
  const rows = () => (Array.isArray(ns.content.adminRows) ? ns.content.adminRows : []);
  const rowOf = (namespace, type, id) => rows().find((row) => row.namespace === namespace && row.type === type && row.id === id) || null;
  const storeKey = () => 'bewerken:' + (ns.central.signedIn() || '').toLowerCase();
  const titleOf = (data, id) => (data && (data.title || data.label)) || id;

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
    storage.set(storeKey(), pending.size ? Array.from(pending.values()) : null);
  }

  /** Niet-opgeslagen wijzigingen van een vorige keer terughalen (eenmalig per sessie). */
  function restore() {
    const email = (ns.central.signedIn() || '').toLowerCase();
    if (!email || restoredFor === email) return;
    restoredFor = email;
    const saved = storage.get(storeKey(), null);
    if (!Array.isArray(saved) || !saved.length) return;
    saved.forEach((entry) => {
      if (entry && entry.namespace && entry.type && entry.id && entry.draft) pending.set(keyOf(entry.namespace, entry.type, entry.id), entry);
    });
    if (pending.size) toast(`${pending.size === 1 ? '1 wijziging' : pending.size + ' wijzigingen'} van de vorige keer terug: nog niet opgeslagen.`, { duration: 7000 });
  }

  const snapshot = () => JSON.stringify(Array.from(pending.entries()));
  function load(state) {
    pending = new Map(JSON.parse(state));
  }

  /**
   * Een wijziging klaarzetten (niet opgeslagen). update: object met data/position/status,
   * of een functie die de huidige stand krijgt en de nieuwe teruggeeft.
   */
  function change(namespace, type, id, update) {
    const current = effective(namespace, type, id) || { data: {}, position: 0, status: 'published' };
    const next = typeof update === 'function' ? update(clone(current)) : Object.assign(clone(current), clone(update));
    if (!next) return false;
    const row = rowOf(namespace, type, id);
    const draft = { data: next.data || {}, position: Number.isFinite(next.position) ? next.position : 0, status: next.status === 'trash' ? 'trash' : 'published' };
    undoStack.push(snapshot());
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack = [];
    const key = keyOf(namespace, type, id);
    // Weer gelijk aan de opgeslagen stand: dan is er niets meer te bewaren
    if (row && JSON.stringify(draft) === JSON.stringify(savedState(row))) pending.delete(key);
    else pending.set(key, { namespace, type, id, draft, version: row ? row.version : null, title: titleOf(draft.data, id) });
    persist();
    afterLocalChange();
    return true;
  }

  /** Niet-opgeslagen wijziging van één item laten vallen. */
  function forget(namespace, type, id) {
    if (!pending.has(keyOf(namespace, type, id))) return;
    undoStack.push(snapshot());
    pending.delete(keyOf(namespace, type, id));
    persist();
    afterLocalChange();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    load(undoStack.pop());
    persist();
    afterLocalChange();
    ns.ui.announce('Ongedaan gemaakt');
  }

  function redo() {
    if (!redoStack.length) return;
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
  function changeLabel(row) {
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
        _change: local ? 'niet opgeslagen' : changeLabel(row)
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
    if (ns.app && ns.app.recompose) ns.app.recompose();
    emit();
  }

  /* ---- Opslaan ------------------------------------------------------------------- */
  /** Eén item direct opslaan als werkversie (vanuit een formulier). Geeft true als het gelukt is. */
  async function saveOne(entry) {
    const row = rowOf(entry.namespace, entry.type, entry.id);
    const item = Object.assign({ version: row ? row.version : null, title: titleOf(entry.draft.data, entry.id) }, entry);
    const result = await ns.central.saveDraft(item);
    if (result && result.conflict) {
      const overwrite = await askConflict(item, result);
      if (!overwrite) return false;
      await ns.central.saveDraft(Object.assign({}, item, { version: result.version }));
    }
    pending.delete(keyOf(item.namespace, item.type, item.id));
    persist();
    return true;
  }

  function askConflict(item, result) {
    const who = result.draft_by || result.updated_by || 'een andere beheerder';
    const when = result.draft_at || result.updated_at;
    return confirm(`"${item.title || item.id}" is intussen opgeslagen door ${who}${when ? ' (' + new Date(when).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) + ')' : ''}. Zet je jouw versie eroverheen, dan gaat die van de ander verloren.`, {
      title: 'Iemand anders was je voor',
      confirmLabel: 'Mijn versie opslaan',
      cancelLabel: 'Hun versie houden'
    });
  }

  /** Alle niet-opgeslagen wijzigingen opslaan. */
  async function save() {
    if (busy || !pending.size) return true;
    busy = true;
    emit();
    const failed = [];
    try {
      for (const entry of Array.from(pending.values())) {
        try {
          await saveOne(entry);
        } catch (error) {
          failed.push(`${entry.title || entry.id}: ${error.message}`);
        }
      }
      await ns.app.reloadContent();
    } finally {
      busy = false;
      emit();
    }
    if (failed.length) {
      toast('Niet alles is opgeslagen. ' + failed.join(' · '), { tone: 'warning', duration: 9000 });
      return false;
    }
    toast('Opgeslagen. Nog niet live: publiceer om het voor iedereen te tonen.', { tone: 'success' });
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
      const result = await ns.central.publish(items.map((item) => ({ namespace: item.namespace, type: item.type, id: item.id })), at || null);
      await ns.app.reloadContent();
      const skipped = (result && result.skipped) || [];
      const done = (result && result.done) || 0;
      const scheduled = (result && result.scheduled) || 0;
      const parts = [];
      if (done) parts.push(done === 1 ? '1 item staat live' : done + ' items staan live');
      if (scheduled) parts.push(`${scheduled === 1 ? '1 item' : scheduled + ' items'} gepland op ${new Date(at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}`);
      if (skipped.length) parts.push(`${skipped.length} overgeslagen (${skipped.map((s) => s.reason).join(', ')})`);
      toast(parts.join(' · ') || 'Niets gepubliceerd', { tone: skipped.length ? 'warning' : 'success', duration: 6000 });
    } catch (error) {
      toast('Publiceren mislukt: ' + error.message, { tone: 'warning', duration: 8000 });
    } finally {
      busy = false;
      emit();
    }
  }

  async function discard(item) {
    if (!(await confirm(`De opgeslagen wijziging van "${item.title}" wordt weggegooid. ${item.kind === 'nieuw' ? 'Het nieuwe item verdwijnt helemaal.' : 'De gepubliceerde versie blijft staan.'}`, { title: 'Wijziging weggooien?', confirmLabel: 'Weggooien', danger: true }))) return false;
    try {
      await ns.central.discardDraft(item.type, item.id, item.namespace);
      await ns.app.reloadContent();
      toast('Weggegooid');
      return true;
    } catch (error) {
      toast('Weggooien mislukt: ' + error.message, { tone: 'warning', duration: 7000 });
      return false;
    }
  }

  /* ---- Zijpaneel (publiceren, logboek, versies) ----------------------------------------- */
  function drawer(title, body, footer) {
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
    closeButton.addEventListener('click', close);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return { dialog, close };
  }

  const shortName = (email) => String(email || '').split('@')[0] || 'onbekend';
  const when = (value) => (value ? new Date(value).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const KIND_TEXT = { nieuw: 'Nieuw', gewijzigd: 'Gewijzigd', verwijderen: 'Verwijderen', concept: 'Concept' };

  /** Paneel Publiceren: wat klaarstaat, met aandachtspunten, nu of gepland. */
  async function openPublish() {
    if (pending.size) {
      const ok = await confirm(`Je hebt nog ${pending.size === 1 ? '1 wijziging' : pending.size + ' wijzigingen'} die niet is opgeslagen. Die sla ik eerst op.`, { title: 'Eerst opslaan', confirmLabel: 'Opslaan en verder' });
      if (!ok || !(await save())) return;
    }
    const items = waiting();
    const checks = new Map();
    const list = el('ul', { className: 'publish-list', attrs: { role: 'list' } }, items.map((item) => {
      const box = el('input', { attrs: { type: 'checkbox', checked: item.canPublish, disabled: !item.canPublish, 'aria-label': 'Publiceren: ' + item.title } });
      checks.set(item, box);
      const route = ROUTE[item.type];
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
            el('span', { text: `${TYPE_LABEL[item.type] || item.type}${item.namespace === ns.cockpit.GENERAL_NAMESPACE ? ' · gedeelde basis' : ''} · ${shortName(item.by)}, ${when(item.at)}` })
          ]),
          el('p', { className: 'publish-item__title' }, [
            route && item.kind !== 'verwijderen' ? el('a', { attrs: { href: `#/${route}/${item.id}` }, text: item.title }) : el('span', { text: item.title })
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

  /** Paneel Logboek: wie deed wat, met per item de eerdere versies. */
  async function openLog() {
    const body = el('div', {}, [el('p', { className: 'drawer__lead', text: 'Logboek laden…' })]);
    drawer('Logboek', body);
    let entries = [];
    try {
      entries = await ns.central.listLog(cockpitNamespaces(), 300);
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
    body.replaceChildren(...Array.from(days.entries()).map(([day, list]) => el('section', { className: 'log-day' }, [
      el('h3', { className: 'log-day__title', text: day }),
      el('ul', { className: 'log-list', attrs: { role: 'list' } }, list.map((entry) => {
        const route = ROUTE[entry.type];
        const versions = entry.type && entry.item_id ? el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' } }, [icon('refresh'), el('span', { text: 'Versies' })]) : null;
        if (versions) versions.addEventListener('click', () => openVersions(entry.namespace, entry.type, entry.item_id, entry.title));
        return el('li', { className: 'log-item' }, [
          el('span', { className: 'log-item__time', text: new Date(entry.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) }),
          el('span', { className: 'log-item__text' }, [
            el('strong', { text: shortName(entry.actor) }), ' ', entry.action, entry.title ? ' · ' : '',
            entry.title ? (route && entry.item_id ? el('a', { attrs: { href: `#/${route}/${entry.item_id}` }, text: entry.title }) : el('span', { text: entry.title })) : null,
            entry.type ? el('span', { className: 'log-item__type', text: ' (' + (TYPE_LABEL[entry.type] || entry.type) + ')' }) : null
          ]),
          versions
        ]);
      }))
    ])));
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
  /**
   * Meldt dat je dit item open hebt (zolang node in de pagina staat) en toont een
   * waarschuwing in node als iemand anders het ook open heeft.
   */
  function watch(namespace, type, id, node) {
    if (!available() || !node) return;
    const notice = el('p', { className: 'notice notice--warning presence', attrs: { role: 'status', hidden: true } });
    node.prepend(notice);
    let timer = 0;
    async function tick() {
      if (!node.isConnected) {
        ns.central.leave(type, id, namespace);
        return;
      }
      const others = await ns.central.ping(type, id, namespace);
      if (others.length) {
        notice.replaceChildren(icon('users'), el('span', { text: `${others.map((o) => shortName(o.editor)).join(' en ')} ${others.length === 1 ? 'heeft' : 'hebben'} dit item ook open. Overleg even, anders overschrijven jullie elkaars werk.` }));
        notice.hidden = false;
      } else notice.hidden = true;
      timer = window.setTimeout(tick, PING_EVERY);
    }
    window.setTimeout(tick, 400);
    return () => window.clearTimeout(timer);
  }

  /* ---- Bewerkbalk ------------------------------------------------------------------ */
  let barItem = null; // het item van de huidige pagina: { type, id, namespace, label, shared }

  function renderBar() {
    const bar = document.getElementById('admin-bar');
    if (!bar) return;
    if (!signedIn()) {
      bar.hidden = true;
      bar.replaceChildren();
      document.body.classList.remove('has-admin-bar');
      return;
    }
    bar.hidden = false;
    document.body.classList.add('has-admin-bar');
    const own = ns.cockpit.namespace(ns.cockpit.activeId());
    const role = ns.rights.describe(own) || (ns.rights.isOwner() ? 'Hoofdbeheerder' : 'Beheer');
    const items = [];

    items.push(el('a', { className: 'admin-bar__brand', attrs: { href: '#/beheer', title: 'Naar Beheer' } }, [icon('lock'), el('span', { className: 'admin-bar__role', text: role })]));

    if (!available()) {
      items.push(el('span', { className: 'admin-bar__status', text: ns.central.draftingAvailable() === false ? 'Opslaan en publiceren werkt na stap 7 (setup/supabase-audit-bewerken.sql). Tot dan gaan wijzigingen in Beheer direct live.' : 'Beheer' }));
    } else {
      const waitingCount = waiting().length;
      const status = busy ? 'Bezig…' : pending.size ? `${pending.size === 1 ? '1 wijziging' : pending.size + ' wijzigingen'} niet opgeslagen` : waitingCount ? `${waitingCount} klaar om te publiceren` : 'Alles is gepubliceerd';
      items.push(el('span', { className: 'admin-bar__status' + (pending.size ? ' admin-bar__status--dirty' : ''), attrs: { role: 'status' }, text: status }));
      const undoButton = el('button', { className: 'admin-bar__btn', attrs: { type: 'button', disabled: !undoStack.length || busy, title: 'Ongedaan maken (Ctrl+Z)', 'aria-label': 'Ongedaan maken' } }, [icon('arrow-left')]);
      const redoButton = el('button', { className: 'admin-bar__btn', attrs: { type: 'button', disabled: !redoStack.length || busy, title: 'Opnieuw (Ctrl+Y)', 'aria-label': 'Opnieuw' } }, [icon('arrow-right')]);
      const saveButton = el('button', { className: 'admin-bar__btn admin-bar__btn--save' + (pending.size ? ' is-dirty' : ''), attrs: { type: 'button', disabled: !pending.size || busy, title: 'Opslaan (Ctrl+S)' } }, [icon('check'), el('span', { text: 'Opslaan' })]);
      const canPublishHere = ns.rights.can('publiceren', own) || ns.rights.can('publiceren', ns.cockpit.GENERAL_NAMESPACE);
      const publishButton = el('button', { className: 'admin-bar__btn admin-bar__btn--publish', attrs: { type: 'button', disabled: busy || (!waitingCount && !pending.size) } }, [icon('send'), el('span', { text: canPublishHere ? 'Publiceren' : 'Klaar voor publicatie' }), waitingCount ? el('span', { className: 'admin-bar__count', text: String(waitingCount) }) : null]);
      const logButton = el('button', { className: 'admin-bar__btn', attrs: { type: 'button' } }, [icon('clock'), el('span', { text: 'Logboek' })]);
      const viewButton = el('button', { className: 'admin-bar__btn', attrs: { type: 'button', 'aria-pressed': String(visitorView), title: 'Bekijk de site zoals collega\'s hem zien' } }, [icon('eye'), el('span', { text: 'Als collega' })]);
      undoButton.addEventListener('click', undo);
      redoButton.addEventListener('click', redo);
      saveButton.addEventListener('click', save);
      publishButton.addEventListener('click', openPublish);
      logButton.addEventListener('click', openLog);
      viewButton.addEventListener('click', () => setVisitorView(!visitorView));
      items.push(el('span', { className: 'admin-bar__group' }, [undoButton, redoButton]), saveButton, publishButton, logButton, viewButton);
    }
    if (barItem) {
      items.push(el('a', { className: 'admin-bar__btn admin-bar__btn--item', attrs: { href: `#/beheer/${barItem.shared ? 'basis' : 'inhoud'}/${barItem.type}/${barItem.id}` } }, [icon('pencil-line'), el('span', { text: 'Bewerk ' + barItem.label })]));
    }
    bar.replaceChildren(el('div', { className: 'container admin-bar__inner' }, items));
  }

  /** De pagina is gewisseld: welk item staat erop (voor 'Bewerk deze tip'). */
  function setPageItem(item) {
    barItem = item || null;
    renderBar();
  }

  function onKey(event) {
    if (!signedIn() || !available()) return;
    const mod = event.ctrlKey || event.metaKey;
    if (!mod) return;
    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      save();
      return;
    }
    // In een tekstveld doet de browser zelf ongedaan maken
    const target = event.target;
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
  }

  /** Na het (opnieuw) laden van de inhoud: niet-opgeslagen werk terughalen en de balk bijwerken. */
  function contentLoaded() {
    if (available()) restore();
    renderBar();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  ns.editor = {
    init,
    available,
    contentLoaded,
    subscribe,
    overlay,
    effective,
    change,
    forget,
    undo,
    redo,
    save,
    saveOne,
    publish,
    openPublish,
    openLog,
    openVersions,
    waiting,
    checks,
    watch,
    setPageItem,
    setVisitorView,
    isVisitorView: () => visitorView,
    pendingCount: () => pending.size,
    hasPending: (namespace, type, id) => pending.has(keyOf(namespace, type, id)),
    rowOf,
    savedState
  };
})(window.AIAudit);
