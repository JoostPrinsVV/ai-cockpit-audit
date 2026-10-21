/* ==========================================================================
   AI COCKPIT — DISCIPLINES EN GEDEELDE BASIS (startwaarden)
   --------------------------------------------------------------------------
   Eén cockpit, per discipline een eigen omgeving, bovenop één gedeelde
   basis die in iedere cockpit verschijnt. Wat hier staat is de startstand
   en de terugval: zodra je in Beheer → Disciplines opslaat, is de database
   leidend.

   Velden per discipline:
     id           Code (kleine letters, cijfers en '-'), ook in het adres: ?d=<id>.
                  Verander een id niet meer. 'algemeen' is gereserveerd.
     name         Naam in de kopbalk en de wisselaar.
     description  Korte omschrijving in de wisselaar.
     status       'open' (iedereen) of 'locked' (op slot: alleen beheerders kunnen erin).
     icon         Icoon uit de sprite in index.html (zonder 'i-').
     accent       Kleur: 'teal', 'crimson', 'steel', 'rose', 'deepteal' of 'navy'.
     eyebrow      Regel boven de titel op de startpagina, na 'Visser & Visser ·'.
     label        In lopende tekst, bijv. 'de audit' → "Waarom handig in de audit".
     phases       Waar de fasen bij horen, bijv. 'de controle' → "Per fase van de controle".

   De eerste discipline met status 'open' is de standaard.
   De inhoud van Audit staat in de andere bestanden in data/; die van de
   andere disciplines alleen in de database (Beheer → Inhoud).
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.disciplines = [
  {
    id: 'audit',
    name: 'Audit',
    description: 'Controlepraktijk',
    status: 'open',
    icon: 'magnifier-doc',
    accent: 'teal',
    eyebrow: 'Copilot in de controlepraktijk',
    label: 'de audit',
    phases: 'de controle'
  },
  {
    id: 'accountancy',
    name: 'Accountancy',
    description: 'Samenstellen, administratie en advies',
    status: 'locked',
    icon: 'table',
    accent: 'crimson',
    eyebrow: 'Copilot in de samenstelpraktijk',
    label: 'accountancy',
    phases: 'je werk'
  },
  {
    id: 'belastingadvies',
    name: 'Belastingadvies',
    description: 'Aangiftes, fiscale vragen en advies',
    status: 'locked',
    icon: 'document',
    accent: 'steel',
    eyebrow: 'Copilot in de belastingpraktijk',
    label: 'belastingadvies',
    phases: 'je werk'
  },
  {
    id: 'salarisadministratie',
    name: 'Salarisadministratie',
    description: 'Loonverwerking en vragen van werkgevers',
    status: 'locked',
    icon: 'users',
    accent: 'deepteal',
    eyebrow: 'Copilot in de salarispraktijk',
    label: 'salarisadministratie',
    phases: 'je werk'
  }
];

/* Gedeelde basis: welke items uit de bestanden in data/ voor iedereen zijn ('*' = alles
   van die soort). Dit is het voorstel bij Beheer → Gedeelde basis → Inrichten, en de
   terugval voor de andere disciplines als de database even niet bereikbaar is. */
window.AIAudit.sharedBasis = {
  phase: ['communicatie', 'eigen-werk'],
  usecase: ['klantoverleg', 'weekplanning'],
  prompt: ['herinnering-stukken', 'teams-bijpraten', 'urenoverzicht', 'afspraak-voorbereiden', 'regelgeving-begrijpen'],
  tip: [
    'instructies', 'schildje', 'facilitator', 'transcriptie', 'geplande-prompts', 'prompts-bewaren', 'prompt-opbouw',
    'doorvragen', 'bestanden-toevoegen', 'researcher-analyst', 'notebooks', 'excel-copilot', 'outlook-samenvatten', 'controleren'
  ],
  training: '*',
  agent: '*'
};

/* Voorbeeldinhoud om een nieuwe discipline mee te beginnen (Beheer → Inhoud, zolang die
   discipline nog leeg is). Per discipline het bestand; weglaten = alleen 'leeg beginnen'. */
window.AIAudit.disciplineExamples = {
  accountancy: 'data/voorbeelden/accountancy.js'
};
