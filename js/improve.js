/* ==========================================================================
   Verbetervoorstel bij een prompt ('Stel een verbetering voor')
   --------------------------------------------------------------------------
   Onder een prompt (#/prompt/…, #/usecase/…): een collega past de tekst aan
   en vertelt waarom. Dat gaat als inzending van de soort 'verbetering' naar
   het AI-team, met in 'target' bij welke prompt hij hoort (stap 11 in
   setup/supabase-audit-verbeteringen.sql). In Beheer → Inzendingen zie je wat
   er verandert en neem je het (deels) over (js/admin-improve.js).
   target: { type: 'prompt'|'usecase', id, namespace, field, index, title,
   label, base (vingerafdruk van de tekst waarop het voorstel is gebaseerd),
   why (de toelichting) }.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, toast, copyText } = ns.ui;
  const MAX_BODY = 4000;
  const MAX_WHY = 500;

  /** Korte vingerafdruk van een tekst (FNV-1a): is de prompt sinds het voorstel veranderd? */
  function fingerprint(text) {
    let hash = 0x811c9dc5;
    const value = String(text || '');
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  /* ---- Verschil tussen twee teksten, per woord ---------------------------------------- */
  const tokens = (text) => String(text || '').match(/\s+|[^\s]+/g) || [];

  /**
   * Wat er verandert van a naar b: [{ type: 'equal', text } | { type: 'change', del, ins }].
   * Per woord (spaties en regels tellen mee), met de langste gemeenschappelijke reeks.
   */
  function diff(a, b) {
    const x = tokens(a);
    const y = tokens(b);
    let start = 0;
    while (start < x.length && start < y.length && x[start] === y[start]) start++;
    let endX = x.length;
    let endY = y.length;
    while (endX > start && endY > start && x[endX - 1] === y[endY - 1]) {
      endX--;
      endY--;
    }
    const xs = x.slice(start, endX);
    const ys = y.slice(start, endY);
    const ops = x.slice(0, start).map((t) => ['=', t]);
    const n = xs.length;
    const m = ys.length;
    if (n * m > 3000000) {
      // Heel lang en alles anders: één wijziging
      if (n) ops.push(['-', xs.join('')]);
      if (m) ops.push(['+', ys.join('')]);
    } else {
      // Tabel van achteren naar voren: lengte van de langste gemeenschappelijke reeks vanaf (i, j)
      const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          table[i][j] = xs[i] === ys[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
        }
      }
      let i = 0;
      let j = 0;
      while (i < n && j < m) {
        if (xs[i] === ys[j]) {
          ops.push(['=', xs[i]]);
          i++;
          j++;
        } else if (table[i + 1][j] >= table[i][j + 1]) {
          ops.push(['-', xs[i++]]);
        } else {
          ops.push(['+', ys[j++]]);
        }
      }
      while (i < n) ops.push(['-', xs[i++]]);
      while (j < m) ops.push(['+', ys[j++]]);
    }
    x.slice(endX).forEach((t) => ops.push(['=', t]));

    // Samenvoegen: gelijke stukken achter elkaar, en verwijderen + toevoegen tot één wijziging.
    // Een losse spatie tussen twee wijzigingen hoort bij de wijziging (minder kleine stukjes).
    const parts = [];
    ops.forEach(([op, text], index) => {
      const last = parts[parts.length - 1];
      const loneSpace = op === '=' && /^\s+$/.test(text) && last && last.type === 'change' && ops[index + 1] && ops[index + 1][0] !== '=';
      if (op === '=' && !loneSpace) {
        if (last && last.type === 'equal') last.text += text;
        else parts.push({ type: 'equal', text });
        return;
      }
      const change = last && last.type === 'change' ? last : (parts.push({ type: 'change', del: '', ins: '' }), parts[parts.length - 1]);
      if (op === '-') change.del += text;
      else if (op === '+') change.ins += text;
      else {
        change.del += text;
        change.ins += text;
      }
    });
    return parts;
  }

  /** De tekst na het kiezen: per wijziging overgenomen (ins) of niet (del). */
  function merge(parts) {
    return parts.map((part) => (part.type === 'equal' ? part.text : part.accepted === false ? part.del : part.ins)).join('');
  }

  /* ---- Voorstellen -------------------------------------------------------------------- */
  /** Waar een prompt staat: soort en adres van het item, veld (en plek in de lijst), kop, fase en naamruimte. */
  function target(type, item, place) {
    const namespace = item.shared ? ns.cockpit.GENERAL_NAMESPACE : ns.cockpit.namespace(ns.cockpit.activeId());
    return Object.assign({ type, id: item.id, namespace, title: item.title, phase: item.phase ? item.phase.id : '' }, place);
  }

  /** Knop onder een prompt; target zonder base/why (die komen erbij bij versturen). */
  function button(text, target) {
    if (!ns.central.isEnabled() || ns.app.config().enableIdeas === false) return null;
    const btn = el('button', { className: 'improve-link', attrs: { type: 'button', 'aria-haspopup': 'dialog' } }, [icon('wand'), el('span', { text: 'Beter idee? Stel een verbetering voor' })]);
    btn.addEventListener('click', () => open(text, target, btn));
    return btn;
  }

  let counter = 0;
  function open(original, target, opener) {
    const id = 'improve-' + (++counter);
    const proposal = el('textarea', { className: 'field__input field__textarea improve__text', attrs: { id: id + '-text', rows: '10', maxlength: String(MAX_BODY), spellcheck: 'true', 'aria-describedby': id + '-text-hint ' + id + '-text-error' } });
    proposal.value = original;
    const why = el('textarea', { className: 'field__input field__textarea improve__why', attrs: { id: id + '-why', rows: '3', maxlength: String(MAX_WHY), placeholder: 'Bijv. Copilot sloeg de kolom met de verklaring over; nu vraag ik er expliciet om.', 'aria-describedby': id + '-why-error' } });
    const name = el('input', { className: 'field__input', attrs: { id: id + '-name', type: 'text', maxlength: '100', autocomplete: 'name' } });
    name.value = ns.profile.get().naam;
    const textError = el('p', { className: 'field__error', attrs: { id: id + '-text-error' } });
    const whyError = el('p', { className: 'field__error', attrs: { id: id + '-why-error' } });
    const formError = el('div', { className: 'form-error', attrs: { role: 'alert', hidden: true } });
    const changes = el('p', { className: 'improve__changes', attrs: { 'aria-live': 'polite' } });
    const send = el('button', { className: 'btn btn--primary', attrs: { type: 'submit' } }, [icon('send'), el('span', { text: 'Versturen' })]);
    const cancel = el('button', { className: 'btn btn--secondary', attrs: { type: 'button' } }, [el('span', { text: 'Annuleren' })]);
    let confirmSensitive = false;

    function countChanges() {
      const parts = diff(original, proposal.value).filter((part) => part.type === 'change');
      changes.textContent = parts.length ? `${parts.length} ${parts.length === 1 ? 'wijziging' : 'wijzigingen'} ten opzichte van nu` : 'Nog niets veranderd';
      confirmSensitive = false;
    }
    proposal.addEventListener('input', countChanges);
    countChanges();

    const form = el('form', { className: 'improve__panel', attrs: { novalidate: true } }, [
      el('div', { className: 'improve__head' }, [
        el('span', { className: 'improve__icon', attrs: { 'aria-hidden': 'true' } }, [icon('wand')]),
        el('div', {}, [
          el('h2', { className: 'improve__title', attrs: { id: id + '-title' }, text: 'Stel een betere versie voor' }),
          el('p', { className: 'improve__subject', text: [target.title, target.label].filter(Boolean).join(' · ') })
        ])
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: id + '-text' }, text: 'Jouw versie van de prompt' }),
        el('p', { className: 'field__hint', attrs: { id: id + '-text-hint' }, text: 'Pas de tekst aan zoals jij hem beter vindt. Laat [PLAATSHOUDERS] staan in plaats van klantnamen.' }),
        proposal,
        el('div', { className: 'field__meta' }, [textError, changes])
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: id + '-why' }, text: 'Wat is er beter, en waarom?' }),
        why,
        whyError
      ]),
      el('div', { className: 'field' }, [
        el('label', { className: 'field__label', attrs: { for: id + '-name' } }, ['Naam ', el('span', { className: 'field__optional', text: '(optioneel, alleen voor het AI-team)' })]),
        name
      ]),
      el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Het AI-team bekijkt je voorstel en neemt het (deels) over. Noem geen klant- of persoonsgegevens.' })]),
      formError,
      el('div', { className: 'improve__actions' }, [cancel, send])
    ]);
    const dialog = el('dialog', { className: 'improve', attrs: { 'aria-labelledby': id + '-title' } }, [form]);

    const close = () => {
      dialog.close();
      dialog.remove();
      if (opener && opener.isConnected) opener.focus();
    };
    cancel.addEventListener('click', close);
    dialog.append(ns.ui.closeButton(close));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.hidden = true;
      const text = proposal.value.trim();
      const reason = why.value.trim();
      textError.textContent = text === original.trim() ? 'Pas de prompt eerst aan: hij is nog hetzelfde.' : !text ? 'De prompt mag niet leeg zijn.' : '';
      whyError.textContent = reason.length < 10 ? 'Vertel kort wat er beter is (minimaal 10 tekens).' : '';
      proposal.setAttribute('aria-invalid', String(Boolean(textError.textContent)));
      why.setAttribute('aria-invalid', String(Boolean(whyError.textContent)));
      if (textError.textContent || whyError.textContent) {
        (textError.textContent ? proposal : why).focus();
        return;
      }
      if (!confirmSensitive && ns.ideas.SENSITIVE.test(text + ' ' + reason)) {
        confirmSensitive = true;
        formError.replaceChildren(
          el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Staat hier een BSN of rekeningnummer in?' })]),
          el('p', { text: 'Haal persoons- en klantgegevens weg. Weet je zeker dat het goed is? Klik dan nog een keer op Versturen.' })
        );
        formError.hidden = false;
        return;
      }
      const payload = {
        ref: ns.ui.randomId(),
        kind: 'verbetering',
        title: ('Verbetering: ' + (target.title || 'prompt')).slice(0, 140),
        body: text.slice(0, MAX_BODY),
        phase: target.phase || '',
        name: name.value.trim(),
        allowPublic: false,
        target: { type: target.type, id: target.id, namespace: target.namespace, field: target.field, index: Number.isInteger(target.index) ? target.index : null, title: String(target.title || '').slice(0, 140), label: String(target.label || '').slice(0, 140), base: fingerprint(original), why: reason.slice(0, MAX_WHY) }
      };
      send.disabled = true;
      const result = await ns.central.submitIdea(payload);
      send.disabled = false;
      if (result === 'ok') {
        ns.ideas.rememberSubmission({ ref: payload.ref, kind: payload.kind, title: payload.title, at: new Date().toISOString() });
        close();
        toast('Bedankt! Het AI-team bekijkt je voorstel.', { tone: 'success', duration: 5000 });
        return;
      }
      // Mislukt (geen verbinding, of stap 11 nog niet uitgevoerd): niets kwijtraken
      const copy = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [icon('copy'), el('span', { text: 'Kopieer je versie' })]);
      copy.addEventListener('click', async () => {
        const ok = await copyText(text + '\n\n' + reason);
        toast(ok ? 'Je versie staat op het klembord' : 'Kopiëren lukte niet', { tone: ok ? 'success' : 'warning' });
      });
      formError.replaceChildren(
        el('p', { className: 'form-error__title' }, [icon('alert'), el('span', { text: 'Versturen lukte niet.' })]),
        el('p', { text: 'Probeer het later nog eens, of stuur je versie via de ideeënhub (Prompt delen). Kopieer hem eventueel, dan raak je niets kwijt.' }),
        el('div', { className: 'form-error__actions' }, [copy])
      );
      formError.hidden = false;
    });

    document.body.append(dialog);
    dialog.showModal();
    proposal.focus();
    proposal.setSelectionRange(0, 0);
    proposal.scrollTop = 0;
  }

  ns.improve = { button, open, target, diff, merge, fingerprint };
})(window.AIAudit);
