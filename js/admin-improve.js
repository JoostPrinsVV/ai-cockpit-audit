/* ==========================================================================
   Beheer → Inzendingen: een verbetervoorstel bij een prompt beoordelen
   --------------------------------------------------------------------------
   Bij een inzending van de soort 'verbetering' (js/improve.js): bij welke
   prompt hij hoort, de toelichting, en wat er per woord verandert. Klik op
   een wijziging om hem wel of niet over te nemen; het resultaat kun je nog
   met de hand aanpassen. 'Overnemen in de cockpit' zet het klaar als niet-
   opgeslagen wijziging (de bewerkbalk: opslaan en publiceren, met de vier
   ogen van stap 8) en zet de inzending op Gerealiseerd.
   Vergeleken wordt met de tekst zoals jij hem nu zou bewerken (je werkversie);
   is die sinds het voorstel veranderd, dan staat dat erbij.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, copyText } = ns.ui;
  const kit = ns.adminKit;

  const editable = () => Boolean(ns.editor && ns.editor.available());

  /** De gegevens van het item: je werkversie als je kunt bewerken, anders zoals de site het toont. */
  function dataOf(target) {
    if (editable()) {
      const state = ns.editor.effective(target.namespace, target.type, target.id);
      if (state) return state.data || {};
    }
    const item = ns.kinds.item(target.type, target.id);
    return item ? { prompt: item.prompt, promptBasic: item.promptBasic, followUps: item.followUps, prompts: item.prompts } : null;
  }

  /**
   * De huidige tekst op die plek: { text, index, changed } of null (het item of de plek bestaat niet
   * meer). In een lijst eerst op de plek; staat daar een andere tekst, dan op de vingerafdruk.
   */
  function locate(target) {
    const data = dataOf(target);
    if (!data) return null;
    const value = data[target.field];
    const print = (text) => ns.improve.fingerprint(String(text || '').trim());
    if (typeof value === 'string') return { text: value.trim(), index: null, changed: print(value) !== target.base };
    if (!Array.isArray(value)) return null;
    const at = Number.isInteger(target.index) ? target.index : -1;
    let index = at >= 0 && value[at] && print(value[at].text) === target.base ? at : value.findIndex((entry) => entry && print(entry.text) === target.base);
    if (index < 0) index = at >= 0 && value[at] ? at : -1;
    if (index < 0) return null;
    const text = String(value[index].text || '').trim();
    return { text, index, changed: print(text) !== target.base };
  }

  /** Klaarzetten in de cockpit (niet opgeslagen): de tekst op die plek wordt het resultaat. */
  function stage(target, found, result) {
    return ns.editor.change(target.namespace, target.type, target.id, (state) => {
      const data = Object.assign({}, state.data || {});
      if (found.index === null) {
        data[target.field] = result;
      } else {
        const list = (Array.isArray(data[target.field]) ? data[target.field] : []).slice();
        if (!list[found.index]) return null;
        list[found.index] = Object.assign({}, list[found.index], { text: result });
        data[target.field] = list;
      }
      return Object.assign(state, { data });
    });
  }

  function review(item, onChanged) {
    const target = item.target || {};
    const found = locate(target);
    const href = ns.kinds.byRoute(target.type) ? ns.kinds.href(target.type, target.id) : '';
    const place = el('p', { className: 'improve-review__target' }, [
      icon(target.type === 'usecase' ? 'play-circle' : 'chat'),
      el('span', { text: `Bij de ${target.type === 'usecase' ? 'usecase' : 'prompt'} ` }),
      href ? el('a', { attrs: { href }, text: target.title || target.id }) : el('strong', { text: target.title || target.id }),
      target.label ? el('span', { text: ' · ' + target.label }) : null,
      target.namespace === ns.cockpit.GENERAL_NAMESPACE ? el('span', { className: 'badge', text: 'Gedeelde basis' }) : null
    ]);
    const why = target.why ? el('blockquote', { className: 'improve-review__why' }, [el('p', { className: 'improve-review__why-label', text: 'Waarom' }), el('p', { text: target.why })]) : null;

    if (!found) {
      return el('div', { className: 'improve-review' }, [place, why,
        ns.blocks.notice({ tone: 'warning', title: 'Deze prompt bestaat niet meer (op die plek)', text: 'Het voorstel staat hieronder; neem het eventueel met de hand over.' }),
        el('pre', { className: 'prompt-box__text', text: item.body })]);
    }

    const parts = ns.improve.diff(found.text, item.body);
    const changes = parts.filter((part) => part.type === 'change');
    changes.forEach((part) => {
      part.accepted = true;
    });
    const result = el('textarea', { className: 'field__input field__textarea improve-review__result', attrs: { id: 'imp-res-' + item.id, rows: '8', spellcheck: 'true' } });
    const count = el('p', { className: 'improve-review__count', attrs: { 'aria-live': 'polite' } });
    let edited = false;
    result.addEventListener('input', () => {
      edited = true;
    });
    function sync() {
      const taken = changes.filter((part) => part.accepted).length;
      count.textContent = `${taken} van ${changes.length} ${changes.length === 1 ? 'wijziging' : 'wijzigingen'} overgenomen`;
      result.value = ns.improve.merge(parts);
      edited = false;
    }

    // Het verschil: gelijke tekst gewoon, een wijziging als knop (aan = overnemen)
    const view = el('div', { className: 'diff', attrs: { role: 'group', 'aria-label': 'Wijzigingen; klik om wel of niet over te nemen' } }, parts.map((part) => {
      if (part.type === 'equal') return el('span', { className: 'diff__same', text: part.text });
      const number = changes.indexOf(part) + 1;
      const describe = () => `Wijziging ${number}: ${part.del.trim() ? `"${part.del.trim().slice(0, 60)}"` : 'niets'} wordt ${part.ins.trim() ? `"${part.ins.trim().slice(0, 60)}"` : 'weggehaald'}. ${part.accepted ? 'Overgenomen' : 'Niet overgenomen'}.`;
      const btn = el('button', { className: 'diff__change is-on', attrs: { type: 'button', 'aria-pressed': 'true', 'aria-label': describe() } }, [
        part.del ? el('del', { text: part.del }) : null,
        part.ins ? el('ins', { text: part.ins }) : null
      ]);
      btn.addEventListener('click', async () => {
        if (edited && !(await ns.ui.confirmDialog('Je hebt het resultaat met de hand aangepast. Kies je een wijziging, dan begint het resultaat opnieuw vanuit je keuzes.', { title: 'Handmatige aanpassing kwijt?', confirmLabel: 'Doorgaan' }))) return;
        part.accepted = !part.accepted;
        btn.classList.toggle('is-on', part.accepted);
        btn.setAttribute('aria-pressed', String(part.accepted));
        btn.setAttribute('aria-label', describe());
        sync();
      });
      return btn;
    }));
    sync();

    const all = (on) => () => {
      changes.forEach((part) => {
        part.accepted = on;
      });
      view.querySelectorAll('.diff__change').forEach((btn) => {
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
      });
      sync();
    };
    const apply = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: 'Overnemen in de cockpit' })]);
    const copy = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('copy'), el('span', { text: 'Kopieer resultaat' })]);
    copy.addEventListener('click', async () => {
      const ok = await copyText(result.value);
      toast(ok ? 'Het resultaat staat op het klembord' : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
    });
    const allowed = editable() && ns.rights.can('bewerken', target.namespace, target.type);
    apply.disabled = !allowed;
    apply.addEventListener('click', async () => {
      const text = result.value.trim();
      if (!text) {
        toast('Het resultaat is leeg.', { tone: 'warning' });
        return;
      }
      // Opnieuw zoeken: de werkversie kan intussen veranderd zijn
      const now = locate(target);
      if (!now || !stage(target, now, text)) {
        toast('Klaarzetten lukte niet: de prompt staat niet meer op die plek. Kopieer het resultaat en pas hem met de hand aan.', { tone: 'warning', duration: 8000 });
        return;
      }
      const restore = kit.busy(apply);
      try {
        const wasDone = item.status === 'gerealiseerd';
        Object.assign(item, await ns.central.adminUpdateIdea(item.id, { status: 'gerealiseerd' }));
        // AI-miles voor wie het voorstelde, als die meedoet (js/admin-brevet.js)
        if (!wasDone) ns.adminBrevet.awardFor(item).then(ns.adminBrevet.awardToast).catch((error) => kit.failed('AI-miles toekennen', error));
      } catch (error) {
        kit.failed('Status bijwerken', error);
      } finally {
        restore();
      }
      toast('Klaargezet in de cockpit (nog niet opgeslagen). Bekijk het op de pagina en sla op en publiceer met de bewerkbalk bovenaan.', { tone: 'success', duration: 9000 });
      onChanged();
    });

    return el('div', { className: 'improve-review' }, [
      place,
      why,
      found.changed ? ns.blocks.notice({ tone: 'warning', title: 'De prompt is sinds het voorstel aangepast', text: 'Je vergelijkt met de tekst zoals die nu is; kijk of de wijzigingen nog kloppen.' }) : null,
      el('div', { className: 'improve-review__bar' }, [
        el('p', { className: 'improve-review__legend' }, [el('del', { text: 'weg' }), ' ', el('ins', { text: 'erbij' }), ' · klik op een wijziging om hem wel of niet over te nemen']),
        el('span', { className: 'improve-review__all' }, [
          el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' }, on: { click: all(true) } }, [el('span', { text: 'Alles' })]),
          el('button', { className: 'btn btn--quiet btn--sm', attrs: { type: 'button' }, on: { click: all(false) } }, [el('span', { text: 'Niets' })])
        ])
      ]),
      changes.length ? view : el('p', { className: 'field__hint', text: 'Het voorstel is gelijk aan de tekst zoals die nu is.' }),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: 'imp-res-' + item.id }, text: 'Resultaat (pas aan als je wilt)' }),
        result,
        count
      ]),
      el('div', { className: 'admin-item__actions' }, [
        apply,
        copy,
        allowed ? null : el('p', { className: 'field__hint', text: editable() ? 'Je mag deze prompt niet bewerken (rol of onderdeel).' : 'Overnemen kan zodra opslaan en publiceren op de site werkt (stap 7). Kopieer het resultaat en pas de prompt aan in Beheer → Inhoud.' })
      ])
    ]);
  }

  ns.adminImprove = { review, locate };
})(window.AIAudit);
