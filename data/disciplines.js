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

/* Route van een idee (Ideeënhub → 'Wat gebeurt er met je idee?'). 'standaard' geldt voor
   iedere discipline; een discipline met eigen stappen of rollen staat eronder (alleen wat
   anders is). Aanpassen in Beheer → Inhoud → Teksten (per discipline) of in de gedeelde
   basis (voor iedereen); wat daar staat, gaat voor.
     intro   Inleiding boven de route.
     steps   De stappen: title, who (rol, liever geen naam), text, exit (afslag, optioneel).
     roles   'Wie doet wat': name en text.
   De site is openbaar: rollen en teams, geen namen. Namen staan in het organogram op het
   Serviceplein (de link zet je in Beheer). */
window.AIAudit.ideaRoutes = {
  standaard: {
    intro: 'Van een idee op de werkvloer tot een toepassing die iedereen gebruikt. Niet ieder idee loopt alle stappen: veel kan al met Copilot, en stoppen is ook een uitkomst. Bij iedere stap hoor je wat er met je idee gebeurt.',
    steps: [
      { title: 'Je dient je idee in', who: 'Iedereen', text: 'Via het formulier hierboven. Beschrijf vooral het probleem in je werk, niet alleen de oplossing.' },
      { title: 'Eerste check', who: 'Innovatieteam of kartrekker', text: 'Is het idee duidelijk, en loopt het al ergens anders?', exit: 'Kan het al met Copilot? Dan wordt het een prompt, tip of training en kun je er meteen mee aan de slag.' },
      { title: 'Beoordeling', who: 'Innovatieteam of kartrekker', text: 'Met de AI Value Matrix: wat levert het op aan kwaliteit en uren, en is het haalbaar?', exit: 'Te weinig waarde of niet haalbaar? Dan stopt het hier, met de reden erbij.' },
      { title: 'Besluit', who: 'Directie van de discipline', text: 'Gaan we het bouwen, en met welke prioriteit?' },
      { title: 'Check op data en risico', who: 'Compliance, met DIU', text: 'Alleen als er klantdata in gaat of het risico midden of hoog is: mag het, en onder welke voorwaarden?' },
      { title: 'Bouwen', who: 'DIU', text: 'DIU maakt een prototype in de eigen testomgeving.' },
      { title: 'Testen', who: 'Jouw team, met de bouwers', text: 'Werkt het in de praktijk, en klopt de uitkomst met de bron?', exit: 'Nog niet goed genoeg? Terug naar bouwen, of stoppen.' },
      { title: 'In gebruik', who: 'Een eigenaar uit de praktijk', text: 'Iedereen kan ermee aan de slag, met uitleg en een demo in deze cockpit. De eigenaar houdt het bij en het wordt op een vast moment opnieuw beoordeeld.' }
    ],
    roles: [
      { name: 'Iedereen', text: 'Ziet in het werk waar het beter kan en dient dat in.' },
      { name: 'Innovatieteams en kartrekkers', text: 'Eerste aanspreekpunt: checken, beoordelen en terugkoppelen.' },
      { name: 'Directie per discipline', text: 'Besluit wat er gebouwd wordt en geeft DIU de opdracht.' },
      { name: 'Compliance', text: 'Kijkt mee zodra er klantdata in een toepassing gaat.' },
      { name: 'DIU (Data Intelligence Unit)', text: 'Bouwt prototypes en toepassingen in opdracht van de directie, waar nodig met ontwikkelaars van Growteq.' },
      { name: 'CTO', text: 'Bepaalt de kaders voor AI: beleid, architectuur en budget.' }
    ]
  },
  audit: {
    steps: [
      { title: 'Je dient je idee in', who: 'Iedereen', text: 'Via het formulier hierboven. Beschrijf vooral het probleem in je werk, niet alleen de oplossing.' },
      { title: 'Eerste check', who: 'Innovatieteam of kartrekker', text: 'Is het idee duidelijk, en loopt het al ergens anders?', exit: 'Kan het al met Copilot? Dan wordt het een prompt, tip of training en kun je er meteen mee aan de slag.' },
      { title: 'Beoordeling', who: 'Innovatieteam, met team AI of team dAtA', text: 'Met de AI Value Matrix: wat levert het op aan kwaliteit en uren, en is het haalbaar?', exit: 'Te weinig waarde of niet haalbaar? Dan stopt het hier, met de reden erbij.' },
      { title: 'Besluit', who: 'Directie Audit', text: 'Gaan we het bouwen, en met welke prioriteit?' },
      { title: 'Check op data en risico', who: 'Compliance, met DIU', text: 'Alleen als er klantdata in gaat of het risico midden of hoog is: mag het, en onder welke voorwaarden?' },
      { title: 'Bouwen', who: 'Team AI of team dAtA, of DIU', text: 'Kan het in goedgekeurde tooling, dan bouwt team AI of team dAtA het. Is er meer nodig, dan maakt DIU een prototype in de eigen testomgeving.' },
      { title: 'Testen', who: 'Jouw team, met de bouwers', text: 'Werkt het in de praktijk, en klopt de uitkomst met de bron?', exit: 'Nog niet goed genoeg? Terug naar bouwen, of stoppen.' },
      { title: 'In gebruik', who: 'Een eigenaar uit de praktijk', text: 'Iedereen kan ermee aan de slag, met uitleg en een demo in deze cockpit. De eigenaar houdt het bij en het wordt op een vast moment opnieuw beoordeeld.' }
    ],
    roles: [
      { name: 'Iedereen', text: 'Ziet in het werk waar het beter kan en dient dat in.' },
      { name: 'Innovatieteams en kartrekkers', text: 'Eerste aanspreekpunt: checken, beoordelen en terugkoppelen.' },
      { name: 'Team AI en team dAtA', text: 'De AI- en dataspecialisten van Audit: beoordelen mee en bouwen zelf in goedgekeurde tooling.' },
      { name: 'Directie Audit', text: 'Besluit wat er gebouwd wordt en geeft DIU de opdracht.' },
      { name: 'Compliance', text: 'Kijkt mee zodra er klantdata in een toepassing gaat.' },
      { name: 'DIU (Data Intelligence Unit)', text: 'Bouwt prototypes en toepassingen in opdracht van de directie, waar nodig met ontwikkelaars van Growteq.' },
      { name: 'CTO', text: 'Bepaalt de kaders voor AI: beleid, architectuur en budget.' }
    ]
  }
};
