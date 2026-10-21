/* ==========================================================================
   AI COCKPIT AUDIT — FASEN VAN DE CONTROLE
   --------------------------------------------------------------------------
   Usecases, prompts en ideeën worden ingedeeld naar de fase waarin je ze
   gebruikt. De volgorde hier is de volgorde van de filters.

   Velden:
     id       Unieke code (kleine letters). Wordt gebruikt in de andere
              databestanden (veld phase). Verander een id niet meer.
     label    Naam zoals collega's die zien.
     short    Korte naam voor smalle schermen.
     accent   Kleur: 'teal', 'crimson', 'steel', 'rose', 'deepteal' of 'navy'.
     icon     Icoon uit de sprite in index.html (zonder 'i-').
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.phases = [
  { id: 'planning', label: 'Planning & risicoanalyse', short: 'Planning', accent: 'teal', icon: 'flag' },
  { id: 'beheersing', label: 'Interne beheersing', short: 'Interne beheersing', accent: 'steel', icon: 'flow' },
  { id: 'gegevensgericht', label: 'Gegevensgerichte werkzaamheden', short: 'Gegevensgericht', accent: 'crimson', icon: 'table' },
  { id: 'afronding', label: 'Afronding & rapportage', short: 'Afronding', accent: 'rose', icon: 'document' },
  { id: 'communicatie', label: 'Klant- en teamcommunicatie', short: 'Communicatie', accent: 'deepteal', icon: 'users' },
  { id: 'eigen-werk', label: 'Eigen werk & planning', short: 'Eigen werk', accent: 'navy', icon: 'calendar' }
];
