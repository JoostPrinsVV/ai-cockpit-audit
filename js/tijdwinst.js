/* ==========================================================================
   Tijdwinst: hoeveel tijd prompts en usecases collega's schelen
   --------------------------------------------------------------------------
   Het AI-team zet per prompt of usecase een schatting in Beheer ('Scheelt
   ongeveer … minuten'); die staat als 'Scheelt ±20 min' op de kaart.
   Na het kopiëren vraagt de cockpit: 'Scheelde dit tijd?'. Eén tik:
     - per prompt (of usecase) hoogstens één keer per dag, en hoogstens vijf
       vragen per dag;
     - 'Ja' telt de schatting op bij je eigen teller (alleen op dit apparaat,
       in Mijn logboek) en bij het anonieme totaal van alle collega's;
     - de tik levert geen AI-miles op, zodat het getal eerlijk blijft.
   Het totaal van collega's (op de startpagina) komt uit de database (stap 14,
   setup/supabase-audit-tijdwinst.sql), rekent met de schatting van nu en
   verschijnt pas vanaf vijf uur: een laag getal overtuigt niemand.
   ========================================================================== */
(function (ns) {
  'use strict';

  const { el, icon, storage } = ns.ui;
  const KEY = 'tijdwinst';
  const EVENT = 'ai:tijdwinst';
  const MAX_ASKS_PER_DAY = 5;
  const KEEP = 500; // zoveel 'ja's bewaren (ruim een jaar dagelijks gebruik)
  const SHOW_FROM = 300; // het totaal van collega's pas vanaf 5 uur
  const VISIBLE_SECONDS = 90; // de vraag verdwijnt na anderhalve minuut in beeld

  /** Een schatting in hele minuten (0 = geen); hoogstens een werkdag. */
  function minutes(value) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 480) : 0;
  }

  /** '20 min', '1 u 5 min', '12 uur'. */
  function format(total) {
    const value = Math.max(0, Math.round(Number(total) || 0));
    if (value < 60) return value + ' min';
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${hours} u ${rest} min` : `${hours} uur`;
  }

  const today = () => (ns.content && ns.content.today ? ns.content.today() : new Date().toISOString().slice(0, 10));

  /**
   * Waar een gekopieerde prompt bij hoort: { key, minutes, title, kind } of null (geen schatting).
   * Een prompt uit een usecase telt bij die usecase: drie stappen zijn samen één keer tijdwinst.
   */
  function itemOf(id) {
    const c = ns.content || {};
    const prompt = c.promptById && c.promptById.get(id);
    const usecase = prompt ? prompt.usecase : c.usecaseById && c.usecaseById.get(id);
    if (usecase) return usecase.saves ? { key: 'usecase:' + usecase.id, minutes: usecase.saves, title: usecase.title, kind: 'usecase' } : null;
    if (prompt) return prompt.saves ? { key: 'prompt:' + prompt.id, minutes: prompt.saves, title: prompt.title, kind: 'prompt' } : null;
    return null;
  }

  /** De schatting van nu bij een sleutel ('prompt:x', 'usecase:y'); 0 als die er niet (meer) is. */
  function minutesOf(key) {
    const split = String(key).indexOf(':');
    const kind = String(key).slice(0, split);
    const id = String(key).slice(split + 1);
    const c = ns.content || {};
    const item = kind === 'usecase' ? c.usecaseById && c.usecaseById.get(id) : kind === 'prompt' ? c.promptById && c.promptById.get(id) : null;
    return item && !item.usecase ? item.saves || 0 : 0;
  }

  /* ---- Je eigen teller (alleen op dit apparaat) ------------------------------------------ */
  function read() {
    const value = storage.get(KEY, null);
    return {
      log: value && Array.isArray(value.log) ? value.log.filter((entry) => entry && entry.key && entry.day) : [],
      asked: value && value.asked && typeof value.asked === 'object' ? value.asked : { day: '', keys: [] }
    };
  }

  function write(state) {
    storage.set(KEY, { log: state.log.slice(-KEEP), asked: state.asked });
    document.dispatchEvent(new CustomEvent(EVENT));
  }

  /** Mag de vraag nu (nog) gesteld worden voor dit item? */
  function canAsk(key, asked, day) {
    if (!asked || asked.day !== day) return true;
    const keys = Array.isArray(asked.keys) ? asked.keys : [];
    return !keys.includes(key) && keys.length < MAX_ASKS_PER_DAY;
  }

  /** Vandaag gevraagd: bijhouden (één keer per item per dag). */
  function noteAsked(state, key, day) {
    const keys = state.asked && state.asked.day === day && Array.isArray(state.asked.keys) ? state.asked.keys : [];
    state.asked = { day, keys: keys.concat(key) };
  }

  /** Maandag van de week van een dag (JJJJ-MM-DD). */
  function mondayOf(day) {
    const date = new Date(day + 'T12:00:00Z');
    const weekday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - weekday);
    return date.toISOString().slice(0, 10);
  }

  /** Totalen uit je logboek: { week, month, year, all, count } in minuten. */
  function totals(log, day) {
    const now = day || today();
    const monday = mondayOf(now);
    const result = { week: 0, month: 0, year: 0, all: 0, count: 0 };
    (log || []).forEach((entry) => {
      const value = minutes(entry.minutes);
      if (!value || !entry.day || entry.day > now) return;
      result.all += value;
      result.count += 1;
      if (entry.day.slice(0, 4) === now.slice(0, 4)) result.year += value;
      if (entry.day.slice(0, 7) === now.slice(0, 7)) result.month += value;
      if (entry.day >= monday) result.week += value;
    });
    return result;
  }

  const mine = () => totals(read().log);

  /** Je antwoord op de vraag. Ja: bij je teller; beide gaan (anoniem) naar de teller van het AI-team. */
  function answer(item, yes) {
    const state = read();
    if (yes) state.log.push({ key: item.key, minutes: item.minutes, day: today() });
    write(state);
    if (ns.central && ns.central.track) ns.central.track(yes ? 'time_saved' : 'time_none', item.key);
  }

  /* ---- De vraag na het kopiëren ------------------------------------------------------------ */
  let current = null; // { node, timer, item }

  function hide() {
    if (!current) return;
    const { node, timer } = current;
    window.clearInterval(timer);
    current = null;
    node.classList.add('is-leaving');
    window.setTimeout(() => node.remove(), ns.motion && ns.motion.calm && ns.motion.calm() ? 0 : 220);
  }

  /** Na een antwoord: kort laten zien wat het oplevert, dan weg. */
  function thanks(node, yes) {
    const total = mine();
    const body = node.querySelector('.tw-ask__body');
    const actions = node.querySelector('.tw-ask__actions');
    body.replaceChildren(
      el('p', { className: 'tw-ask__title', text: yes ? 'Genoteerd' : 'Dank je, dat helpt' }),
      el('p', { className: 'tw-ask__text', text: yes
        ? `Deze week terugverdiend: ${format(total.week)} (schatting).`
        : 'Het AI-team ziet welke prompts beter kunnen.' })
    );
    // Zonder 'null' als tekst: replaceChildren maakt van null de tekst "null"
    actions.replaceChildren(...(yes ? [el('a', { className: 'btn btn--quiet btn--sm', attrs: { href: '#/mijn' }, on: { click: hide } }, [el('span', { text: 'Mijn logboek' }), icon('arrow-right')])] : []));
    ns.ui.announce(yes ? `Genoteerd. Deze week terugverdiend: ${format(total.week)}.` : 'Dank je.');
    window.clearInterval(current.timer);
    window.setTimeout(() => {
      if (current && current.node === node) hide();
    }, 5000);
  }

  /** De vraag tonen (onderin, zonder de focus te pakken). */
  function ask(item) {
    if (current) hide();
    const id = 'tw-' + Date.now();
    const yes = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button' } }, [icon('check'), el('span', { text: `Ja, ±${format(item.minutes)}` })]);
    const no = el('button', { className: 'btn btn--secondary btn--sm', attrs: { type: 'button' } }, [el('span', { text: 'Nee' })]);
    const close = ns.ui.closeButton(hide);
    const node = el('aside', { className: 'tw-ask', attrs: { 'aria-labelledby': id } }, [
      el('span', { className: 'tw-ask__icon', attrs: { 'aria-hidden': 'true' } }, [icon('clock')]),
      el('div', { className: 'tw-ask__body' }, [
        el('p', { className: 'tw-ask__title', attrs: { id }, text: 'Scheelde dit tijd?' }),
        el('p', { className: 'tw-ask__text', text: item.title })
      ]),
      el('div', { className: 'tw-ask__actions' }, [yes, no]),
      close
    ]);
    yes.addEventListener('click', () => {
      answer(item, true);
      thanks(node, true);
    });
    no.addEventListener('click', () => {
      answer(item, false);
      thanks(node, false);
    });
    document.body.append(node);
    // Weg na anderhalve minuut in beeld (niet terwijl je in Copilot zit)
    let seen = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      seen += 1;
      if (seen >= VISIBLE_SECONDS) hide();
    }, 1000);
    current = { node, timer, item };
    ns.ui.announce('Scheelde dit tijd? ' + item.title);
  }

  /** Na het kopiëren: vragen als er een schatting is en het vandaag nog niet gevraagd is. */
  function maybeAsk(id) {
    const item = itemOf(id);
    if (!item) return false;
    const state = read();
    const day = today();
    if (!canAsk(item.key, state.asked, day)) return false;
    noteAsked(state, item.key, day);
    write(state);
    // Even wachten: eerst de melding 'Gekopieerd'
    window.setTimeout(() => ask(item), 1200);
    return true;
  }

  /* ---- Op kaarten en pagina's -------------------------------------------------------------- */
  /** 'Scheelt ±20 min' (of null zonder schatting). */
  function chip(item, options) {
    const value = item && item.saves;
    if (!value) return null;
    const usecase = options && options.usecase;
    return el('span', { className: 'chip chip--saves', attrs: { title: 'Schatting van het AI-team, per keer' + (usecase ? ' dat je de usecase doorloopt' : '') } }, [icon('clock'), 'Scheelt ±' + format(value)]);
  }

  /** Je teller in Mijn logboek. Geeft { node, destroy }. */
  function card() {
    const node = el('section', { className: 'tw-card', attrs: { 'aria-labelledby': 'tw-card-title' } });
    function render() {
      const total = mine();
      const figure = (label, value) => el('div', { className: 'tw-card__figure' }, [
        el('dt', { className: 'tw-card__label', text: label }),
        el('dd', { className: 'tw-card__value', text: format(value) })
      ]);
      node.replaceChildren(
        el('div', { className: 'tw-card__head' }, [
          el('span', { className: 'tw-card__icon', attrs: { 'aria-hidden': 'true' } }, [icon('clock')]),
          el('div', {}, [
            el('h2', { className: 'tw-card__title', attrs: { id: 'tw-card-title' }, text: 'Je tijdwinst' }),
            el('p', { className: 'tw-card__text', text: total.count
              ? 'Wat de prompts en usecases je volgens jou scheelden, met de schatting van het AI-team.'
              : 'Kopieer een prompt met "Scheelt ±…" en tik daarna op Ja als het tijd scheelde. Dan telt het hier op.' })
          ])
        ]),
        el('dl', { className: 'tw-card__figures' }, [figure('Deze week', total.week), figure('Deze maand', total.month), figure('Dit jaar', total.year)]),
        el('p', { className: 'privacy' }, [icon('shield'), el('span', { text: 'Een schatting, alleen op dit apparaat bewaard. Het AI-team ziet alleen het totaal van iedereen, zonder namen.' })])
      );
    }
    render();
    const handler = () => render();
    document.addEventListener(EVENT, handler);
    return { node, destroy: () => document.removeEventListener(EVENT, handler) };
  }

  /* ---- Het totaal van alle collega's ------------------------------------------------------- */
  /**
   * Opgeteld uit de anonieme tellers: { month, total } in minuten, of null (stap 14 niet uitgevoerd,
   * geen verbinding). Rekent met de schatting van nu.
   */
  async function colleagues() {
    if (!ns.central || !ns.central.timeSaved) return null;
    const result = await ns.central.timeSaved();
    if (result.status !== 'ok') return null;
    return result.items.reduce((sum, row) => {
      const value = minutesOf(row.item_id);
      sum.month += value * (Number(row.month_count) || 0);
      sum.total += value * (Number(row.total_count) || 0);
      return sum;
    }, { month: 0, total: 0 });
  }

  /** Zin voor de startpagina (of '' onder de vijf uur). */
  function proofText(sum) {
    if (!sum) return '';
    const hours = (value) => Math.round(value / 60);
    if (sum.month >= SHOW_FROM) return `Collega's wonnen deze maand al ±${hours(sum.month)} uur terug met prompts uit de cockpit.`;
    if (sum.total >= SHOW_FROM) return `Collega's wonnen al ±${hours(sum.total)} uur terug met prompts uit de cockpit.`;
    return '';
  }

  /** Regel op de startpagina; verschijnt pas als het totaal er is (en de moeite waard is). */
  function proof() {
    const node = el('p', { className: 'tw-proof', attrs: { hidden: true } });
    colleagues().then((sum) => {
      const text = proofText(sum);
      if (!text) return;
      node.replaceChildren(icon('clock'), el('span', { text }), el('span', { className: 'tw-proof__note', text: 'schatting' }));
      node.hidden = false;
    }).catch(() => {});
    return node;
  }

  function onChange(handler) {
    document.addEventListener(EVENT, handler);
    return () => document.removeEventListener(EVENT, handler);
  }

  let started = false;
  function init() {
    if (started) return;
    started = true;
    document.addEventListener('ai:track', (event) => {
      const { kind, id } = event.detail || {};
      if (kind === 'copy_prompt') maybeAsk(id);
    });
  }

  ns.tijdwinst = { minutes, format, itemOf, minutesOf, canAsk, noteAsked, mondayOf, totals, mine, answer, maybeAsk, chip, card, colleagues, proofText, proof, onChange, init, MAX_ASKS_PER_DAY, SHOW_FROM };
})(window.AIAudit);
