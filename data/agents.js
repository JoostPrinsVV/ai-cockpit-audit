/* ==========================================================================
   AI COCKPIT AUDIT — AGENTS & TOOLS
   --------------------------------------------------------------------------
   Catalogus van AI-agents en -producten, vanuit de gebruiker bekeken: wat
   is het, waarvoor gebruik je het (en waarvoor niet) en hoe krijg je
   toegang. De volgorde hier is de volgorde op de pagina.

   LET OP: DEZE WEBSITE IS OPENBAAR BEREIKBAAR
   Zet hier alleen informatie voor gebruikers. Nooit configuratie,
   systeemprompts, technische instellingen, interne risicoanalyses of
   goedkeuringsdocumenten. De formele registratie staat in het AI-register;
   daar link je hooguit naar (registerUrl).

   Zo werkt het:
   - Iedere agent staat tussen { en }, gescheiden door een komma.
   - Is de database leidend (Beheer → Inhoud), dan beheer je de agents daar
     en is dit bestand alleen startinhoud en terugval.

   Velden (* = verplicht):
     id*          Unieke code, alleen kleine letters, cijfers en '-'
                  (adres #/agent/<id>). Verander een id niet meer.
     title*       Naam van de agent of het product.
     kind*        'Microsoft-standaard', 'Eigen agent' of 'Extern product'.
     summary*     Eén of twee zinnen: wat is het en wat heb je eraan?
     description  Uitgebreidere uitleg (lege regel = nieuwe alinea).
     phases       Fasen waarin je het gebruikt: id's uit data/phases.js.
     status*      'Beschikbaar', 'Pilot', 'In ontwikkeling' of 'Gestopt'.
     license      true = er is een licentie nodig (Microsoft 365 Copilot, of bij
                  een extern product een eigen licentie); false = geen extra
                  licentie nodig. Weglaten = niets tonen.
     access       Hoe krijg je toegang? Waar vind je het, wie regelt het?
     link         Waar je het opent. Begint met https://; opent in een nieuw tabblad.
     owner        Aanspreekpunt: liever een afdeling of functie dan een naam.
     notFor       Waarvoor gebruik je het níet (lijst).
     usecases     Optioneel: id's uit data/usecases.js.
     trainings    Optioneel: id's uit data/trainings.js.
     tips         Optioneel: id's uit data/tips.js.
     icon         Icoon uit de sprite in index.html (zonder 'i-').
     added        Datum van toevoegen (JJJJ-MM-DD), voor het label 'Nieuw'.
     registerUrl  Optioneel: link naar de registratie in het AI-register
                  (afgeschermde omgeving). Begint met https://.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.agents = [
  {
    id: 'copilot-chat',
    title: 'Microsoft 365 Copilot Chat',
    kind: 'Microsoft-standaard',
    summary: 'De chat van Copilot in je browser, Teams en Outlook. Met je zakelijke account te gebruiken, ook zonder extra licentie.',
    description: `Copilot Chat is de basis: je stelt een vraag, voegt een bestand toe met de paperclip en laat Copilot samenvatten, ordenen, herschrijven of meedenken.

Zonder licentie werkt Copilot Chat vooral met informatie van internet en met wat je zelf toevoegt. Je mail, agenda en bestanden laten doorzoeken kan met een Microsoft 365 Copilot-licentie.`,
    phases: ['planning', 'beheersing', 'gegevensgericht', 'afronding', 'communicatie'],
    status: 'Beschikbaar',
    license: false,
    access: 'Ga naar m365.cloud.microsoft/chat of open Copilot in Teams, Outlook of Edge en log in met je zakelijke account. Controleer of je het schildje ziet: dan werk je in de beveiligde omgeving van kantoor.',
    link: 'https://m365.cloud.microsoft/chat',
    owner: 'ICT voor toegang en inloggen, het AI-team voor vragen over het gebruik',
    notFor: [
      'Werken met een privé-account, of zonder het schildje',
      'Gegevens delen die niet bij de opdracht horen, zoals een BSN of privégegevens',
      'Een uitkomst of conclusie overnemen zonder die zelf tegen de bron te controleren'
    ],
    usecases: ['risicoanalyse', 'walkthrough', 'notulen', 'jaarrekening-review', 'managementletter'],
    tips: ['schildje', 'instructies', 'prompt-opbouw', 'bestanden-toevoegen'],
    icon: 'chat',
    added: '2026-10-21'
  },
  {
    id: 'microsoft-365-copilot',
    title: 'Microsoft 365 Copilot (met licentie)',
    kind: 'Microsoft-standaard',
    summary: 'Copilot die ook met je eigen werk overweg kan: mail, agenda, vergaderingen en bestanden, en Copilot in Word, Excel, PowerPoint, Outlook en Teams.',
    description: `Met een Microsoft 365 Copilot-licentie kan Copilot ook werken met wat jij in Microsoft 365 mag zien, zoals je mail, je agenda, Teams-vergaderingen en bestanden in OneDrive en SharePoint. Copilot gebruikt alleen informatie waar jij zelf toegang toe hebt.

Daarnaast werkt Copilot dan in de apps zelf: bijvoorbeeld in Excel om kolommen en formules te maken, of in Outlook om een lange mailwisseling samen te vatten. Ook de agents Researcher, Analyst en Facilitator horen bij de licentie.`,
    phases: ['planning', 'beheersing', 'gegevensgericht', 'afronding', 'communicatie', 'eigen-werk'],
    status: 'Beschikbaar',
    license: true,
    access: 'Je hebt een Microsoft 365 Copilot-licentie nodig. Heb je die, dan zie je in Copilot Chat het tabblad Werk en de Copilot-knop in Word, Excel, PowerPoint, Outlook en Teams. Weet je niet of je een licentie hebt? Vraag het na bij ICT.',
    link: 'https://m365.cloud.microsoft/chat',
    owner: 'ICT voor licenties en toegang, het AI-team voor vragen over het gebruik',
    notFor: [
      'Mail, vergaderingen of bestanden laten doorzoeken die niet bij jouw opdracht horen',
      'Informatie van verschillende klanten of opdrachten met elkaar combineren',
      'Een bedrag of conclusie overnemen zonder het tegen de bron te controleren'
    ],
    usecases: ['weekplanning', 'cijferanalyse', 'klantoverleg'],
    tips: ['excel-copilot', 'outlook-samenvatten', 'geplande-prompts', 'notebooks'],
    icon: 'sparkle',
    added: '2026-10-21'
  },
  {
    id: 'researcher',
    title: 'Researcher',
    kind: 'Microsoft-standaard',
    summary: 'Agent voor diepgaand uitzoekwerk: combineert bronnen tot een uitgewerkt rapport met bronvermelding. Neemt er een paar minuten voor.',
    description: `Researcher is een agent in Microsoft 365 Copilot voor vragen die meer nodig hebben dan een snel antwoord, zoals een brancheanalyse ter voorbereiding van de planning.

Researcher stelt soms eerst vragen terug, zoekt in meerdere bronnen en levert een rapport met bronnen. Dat kost meer tijd dan een gewone chat, maar gaat veel dieper.`,
    phases: ['planning'],
    status: 'Beschikbaar',
    license: true,
    access: 'Met een Microsoft 365 Copilot-licentie: open Copilot Chat en kies Researcher in de lijst met agents. Het aantal keer dat je Researcher per maand kunt gebruiken, kan beperkt zijn.',
    link: 'https://m365.cloud.microsoft/chat',
    owner: 'Het AI-team voor vragen over het gebruik',
    notFor: [
      'Een snelle vraag die Copilot Chat direct kan beantwoorden',
      'Een rapport overnemen zonder de bronnen te openen en te controleren',
      'Je eigen professionele oordeel vervangen'
    ],
    usecases: ['risicoanalyse'],
    tips: ['researcher-analyst'],
    icon: 'magnifier-doc',
    added: '2026-10-21'
  },
  {
    id: 'analyst',
    title: 'Analyst',
    kind: 'Microsoft-standaard',
    summary: 'Agent voor data-analyse: rekent met je Excel- of CSV-bestand en laat zien hoe hij rekent.',
    description: `Analyst is een agent in Microsoft 365 Copilot die stap voor stap redeneert over data. Hij schrijft en draait code op het bestand dat je toevoegt en laat de tussenstappen zien.

Dat maakt de analyse controleerbaar, bijvoorbeeld bij het selecteren van opvallende journaalposten of een cijferanalyse op de proefsaldibalans.`,
    phases: ['gegevensgericht', 'planning'],
    status: 'Beschikbaar',
    license: true,
    access: 'Met een Microsoft 365 Copilot-licentie: open Copilot Chat, kies Analyst in de lijst met agents en voeg je bestand toe. Het aantal keer dat je Analyst per maand kunt gebruiken, kan beperkt zijn.',
    link: 'https://m365.cloud.microsoft/chat',
    owner: 'Het AI-team voor vragen over het gebruik',
    notFor: [
      'Bestanden met meer gegevens dan nodig voor de analyse, zoals persoonsgegevens',
      'Een uitkomst overnemen zonder de code en de tussenstappen na te lopen',
      'Je eigen controlewerkzaamheden vervangen'
    ],
    usecases: ['journaalposten', 'cijferanalyse'],
    tips: ['researcher-analyst', 'excel-copilot', 'controleren'],
    icon: 'chart',
    added: '2026-10-21'
  },
  {
    id: 'facilitator',
    title: 'Facilitator',
    kind: 'Microsoft-standaard',
    summary: 'Schrijft mee in Teams-vergaderingen: gedeelde notities met onderwerpen, besluiten en acties die iedereen live ziet.',
    description: `Facilitator is een agent in Teams die tijdens de vergadering gedeelde notities bijhoudt. Iedereen in de vergadering kan meelezen en aanvullen, en je kunt tussendoor vragen stellen, zoals welke acties er zijn afgesproken.

Na afloop staan de notities bij de vergadering, zodat je er bijvoorbeeld een actielijst of bevestigingsmail van maakt.`,
    phases: ['communicatie', 'planning', 'afronding'],
    status: 'Beschikbaar',
    license: true,
    access: 'Met een Microsoft 365 Copilot-licentie: zet Facilitator aan in de Teams-vergadering, via Copilot of via Meer (…). Facilitator gebruikt de transcriptie. Vertel aan het begin dat Copilot meeschrijft.',
    link: 'https://teams.microsoft.com',
    owner: 'Het AI-team voor vragen over het gebruik',
    notFor: [
      'Vergaderingen waarin niet iedereen weet dat Copilot meeschrijft',
      'Overleg met externe deelnemers zonder hun toestemming vooraf',
      'De notities als officieel verslag gebruiken zonder ze na te lezen'
    ],
    usecases: ['klantoverleg', 'walkthrough'],
    tips: ['facilitator', 'transcriptie'],
    icon: 'mic',
    added: '2026-10-21'
  }
];
