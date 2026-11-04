/* ==========================================================================
   Beheer → Inhoud → Tijdwinst: voorstellen voor de schatting
   --------------------------------------------------------------------------
   Een startpunt voor 'Scheelt ongeveer … minuten' (js/tijdwinst.js), zodat je
   niet bij nul begint. Het AI-team bevestigt of past aan; pas dan staat het op
   de site. Bewust voorzichtig: liever een schatting die collega's herkennen
   dan een mooi getal.
   - Voor de prompts en usecases van Audit: per stuk ingeschat (tijd die het
     scheelt ten opzichte van het zelf doen, per keer).
   - Voor de rest: een standaard per soort taak (prompts) of 30 minuten
     (usecases, die meestal een heel stuk werk in een paar stappen zijn).
   ========================================================================== */
(function (ns) {
  'use strict';

  const SUGGESTIONS = {
    usecase: {
      risicoanalyse: 45,
      walkthrough: 45,
      cijferanalyse: 45,
      journaalposten: 30,
      notulen: 30,
      'jaarrekening-review': 45,
      managementletter: 45,
      klantoverleg: 30,
      weekplanning: 20
    },
    prompt: {
      'branche-ontwikkelingen': 30,
      'planningsmemo-bijwerken': 30,
      'materialiteit-onderbouwen': 15,
      fraudebespreking: 20,
      'walkthrough-vragen': 20,
      'it-omgeving': 30,
      'assurancerapport-dienstverlener': 30,
      'contract-doorlichten': 20,
      'saldibevestigingen-verschillen': 20,
      schattingspost: 15,
      'steekproef-vastleggen': 10,
      voorraadopname: 20,
      'excel-formule': 10,
      'versies-vergelijken': 30,
      bevestigingsbrief: 15,
      reviewpunten: 20,
      'memo-herschrijven': 15,
      informatieverzoek: 10,
      'herinnering-stukken': 10,
      'bevinding-uitleggen': 10,
      'teams-bijpraten': 10,
      urenoverzicht: 10,
      'afspraak-voorbereiden': 20,
      'regelgeving-begrijpen': 20
    }
  };
  // Zonder eigen voorstel: per soort taak (Beheer → prompt → Soort taak)
  const BY_TASK = { Samenvatten: 15, Schrijven: 15, Analyseren: 20, Voorbereiden: 20, Controleren: 20, Plannen: 10 };
  const USECASE = 30;
  const OTHER = 15;

  /** Voorstel voor een usecase of losse prompt: { minutes, basis: 'eigen' | 'taak' | 'standaard' }. */
  function suggest(type, id, data) {
    const own = (SUGGESTIONS[type] || {})[id];
    if (own) return { minutes: own, basis: 'eigen' };
    if (type === 'usecase') return { minutes: USECASE, basis: 'standaard' };
    const task = data && typeof data.task === 'string' ? data.task.trim() : '';
    if (BY_TASK[task]) return { minutes: BY_TASK[task], basis: 'taak' };
    return { minutes: OTHER, basis: 'standaard' };
  }

  ns.adminSaves = { SUGGESTIONS, BY_TASK, suggest };
})(window.AIAudit);
