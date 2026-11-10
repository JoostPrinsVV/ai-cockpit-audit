/* ==========================================================================
   Inhoud in het Engels: per item een Engelse versie (veld 'en')
   --------------------------------------------------------------------------
   Iedere usecase, prompt, tip, agent en fase (en de teksten van de site) kan
   naast het Nederlands een Engelse versie hebben, in data.en. Trainingen niet:
   die worden in één taal gegeven, dus een Engelse training is een eigen kaart
   (veld language: 'en'); in het Engels krijgt een Nederlandse training het
   label 'In Dutch' (ns.ui.languageBadge). Die
   heeft dezelfde veldnamen, maar alleen voor de teksten (SPEC hieronder):
     { title: 'Risk assessment …', prompts: [{ label: '…', text: '…' }], … }
   Lijsten met onderdelen (prompts, acties, hoofdstukken) gaan op volgorde:
   het tweede Engelse onderdeel hoort bij het tweede Nederlandse. Plaatjes,
   tijden, links en keuzes komen altijd uit het Nederlands.

   Met de cockpit in het Engels legt apply() de Engelse versie over het
   Nederlands. Wat niet vertaald is, blijft Nederlands; een item zonder
   Engelse versie krijgt het label 'Dutch only'. Beheer blijft Nederlands; de
   Engelse versie pas je daar aan per item (js/admin-english.js).

   en._nl onthoudt welke Nederlandse tekst er vertaald is (een vingerafdruk).
   Verandert het Nederlands daarna, dan meldt Beheer dat de vertaling bijgewerkt
   moet worden.
   ========================================================================== */
(function (ns) {
  'use strict';

  const T = true;
  /* De teksten die een Engelse versie kunnen hebben. true = tekst of lijst met regels; een object =
     de velden per onderdeel (bij een lijst met onderdelen op volgorde, bij één onderdeel per veld). */
  const SPEC = {
    phase: { label: T, short: T },
    usecase: { title: T, subtitle: T, duration: T, intro: T, steps: T, prompts: { label: T, text: T }, promptNote: T, watchOut: T, tip: T },
    prompt: { title: T, description: T, prompt: T, note: T, followUps: { label: T, text: T }, promptLabel: T, promptBasic: T, noteBasic: T, tip: T },
    tip: { title: T, summary: T, category: T, minutes: T, why: T, steps: T, example: { label: T, text: T }, note: T },
    // (Geen training: die wordt niet vertaald, zie hierboven)
    agent: { title: T, summary: T, description: T, access: T, owner: T, useFor: T, notFor: T, testCriteria: T, testGroup: T },
    // Cockpit Wrapped (Beheer → Wrapped; js/wrapped.js): de teksten van het AI-team
    wrapped: { title: T, intro: T, highlights: { title: T, text: T }, closing: T },
    setting: {
      applicationTitle: T, tagline: T, applicationSubtitle: T, rules: T,
      routeIntro: T, route: { title: T, who: T, text: T, exit: T }, routeRoles: { name: T, text: T },
      seasons: { title: T, text: T },
      kickstartTitle: T, kickstartLead: T, promiseFlyin: T, promiseRequest: T, promisePrompt: T
    }
  };

  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const isText = (value) => typeof value === 'string' && value.trim() !== '';
  const lines = (value) => (Array.isArray(value) ? value.filter(isText) : []);

  /** Iets ingevuld: tekst, een lijst met regels of een onderdeel met ten minste één tekst. */
  function filled(value) {
    if (isText(value)) return true;
    if (Array.isArray(value)) return value.some(filled);
    if (isObject(value)) return Object.keys(value).some((key) => key !== '_nl' && filled(value[key]));
    return false;
  }

  /**
   * Alleen de teksten volgens spec, opgeschoond. Een lijst met onderdelen houdt zijn lengte (een leeg
   * onderdeel wordt {}), zodat de volgorde blijft kloppen. Geeft undefined als er niets in staat.
   */
  function pick(value, spec) {
    if (spec === true) {
      if (isText(value)) return value.trim();
      const list = lines(value).map((line) => line.trim());
      return list.length ? list : undefined;
    }
    if (Array.isArray(value)) {
      const list = value.map((item) => (isObject(item) ? pick(item, spec) || {} : {}));
      while (list.length && !Object.keys(list[list.length - 1]).length) list.pop();
      return list.length ? list : undefined;
    }
    if (isObject(value)) {
      const out = {};
      Object.keys(spec).forEach((key) => {
        const part = pick(value[key], spec[key]);
        if (part !== undefined) out[key] = part;
      });
      return Object.keys(out).length ? out : undefined;
    }
    return undefined;
  }

  /** Het Nederlands met de Engelse teksten erover (alleen wat vertaald is). */
  function overlay(nl, en, spec) {
    if (spec === true) {
      if (isText(en)) return en;
      return lines(en).length ? lines(en) : nl;
    }
    if (Array.isArray(nl)) {
      const list = Array.isArray(en) ? en : [];
      return nl.map((item, index) => (isObject(item) && isObject(list[index]) ? overlay(item, list[index], spec) : item));
    }
    if (isObject(nl)) {
      if (!isObject(en)) return nl;
      const out = Object.assign({}, nl);
      Object.keys(spec).forEach((key) => {
        if (en[key] !== undefined) out[key] = overlay(nl[key], en[key], spec[key]);
      });
      return out;
    }
    // Geen Nederlands (bijv. de standaardroute van een idee): dan de Engelse versie zoals hij is
    return filled(en) ? pick(en, spec) : nl;
  }

  /** Heeft dit item een Engelse versie (ten minste één tekst)? */
  function translated(data) {
    return Boolean(data) && isObject(data.en) && filled(data.en);
  }

  /** Een item in het Engels: met de Engelse teksten erover, en _dutchOnly als er geen Engelse versie is. */
  function apply(type, data) {
    const spec = SPEC[type];
    if (!spec || !isObject(data)) return data;
    if (!translated(data)) return Object.assign({}, data, { _dutchOnly: true });
    return overlay(data, data.en, spec);
  }

  /** De Nederlandse teksten van een item (zonder plaatjes, links en keuzes): voor de vertaling en de vingerafdruk. */
  function extract(type, data) {
    return (SPEC[type] && pick(data, SPEC[type])) || {};
  }

  /** Vingerafdruk van de Nederlandse teksten (FNV-1a): verandert als er iets in het Nederlands verandert. */
  function fingerprint(type, data) {
    const text = JSON.stringify(extract(type, data));
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  /** '' (niet vertaald), 'ok' of 'verouderd' (het Nederlands is veranderd sinds de vertaling). */
  function status(type, data) {
    if (!translated(data)) return '';
    return data.en._nl && data.en._nl !== fingerprint(type, data) ? 'verouderd' : 'ok';
  }

  /** Een Engelse versie opschonen (alleen de teksten volgens SPEC), met de vingerafdruk van het Nederlands erbij. */
  function clean(type, en, data) {
    const out = (SPEC[type] && pick(en, SPEC[type])) || null;
    if (!out) return null;
    out._nl = fingerprint(type, data || {});
    return out;
  }

  ns.contentEn = { SPEC, filled, pick, overlay, translated, apply, extract, fingerprint, status, clean };
})(window.AIAudit = window.AIAudit || {});
