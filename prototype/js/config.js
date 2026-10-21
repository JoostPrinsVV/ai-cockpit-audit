/* ==========================================================================
   AI COCKPIT · PROTOTYPE — INSTELLINGEN
   --------------------------------------------------------------------------
   Basisinstellingen van het prototype. Wat per discipline verschilt (naam,
   uitleg, gouden regels) staat in prototype/js/disciplines.js.

   Bewust anders dan de live cockpit (js/config.js):
   - geen centrale opslag: de inhoud komt uit de bestanden, er is geen beheer
     en de ideeënhub verstuurt niets;
   - een eigen naam voor de lokale opslag, zodat favorieten en thema van de
     live cockpit niet door elkaar lopen met die van het prototype.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.config = {
  applicationTitle: 'AI Cockpit',
  discipline: 'Audit',                  // Wordt overschreven door de gekozen discipline
  tagline: 'Jij bepaalt de koers, Copilot navigeert mee.',
  applicationSubtitle: '',
  organizationName: 'Visser & Visser',
  lastUpdated: '21 oktober 2026',
  newDays: 45,
  launchDate: '2026-10-19',
  theme: 'licht',
  rules: [],

  enableIdeas: true,
  ideaMaxLength: 2000,
  ideaFallbackEmail: '',
  enableVotes: false,
  enableUsageStats: false,

  centralUrl: '',                       // Leeg = geen database (alleen de bestanden)
  centralKey: '',
  namespace: 'ai-cockpit-prototype',

  storageNamespace: 'ai-cockpit-prototype',

  debugMode: false
};
