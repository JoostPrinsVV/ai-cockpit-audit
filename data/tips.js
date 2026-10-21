/* ==========================================================================
   AI COCKPIT AUDIT — TIPS & TRICKS
   --------------------------------------------------------------------------
   Korte handleidingen voor slimmer werken met Copilot. De volgorde hier is
   de volgorde binnen elk thema; de thema's verschijnen in de volgorde
   waarin ze hier voor het eerst voorkomen.

   Menunamen in Microsoft 365 veranderen regelmatig. Schrijf stappen daarom
   zo dat ze ook kloppen als een knop net anders heet, en controleer ze af
   en toe.

   TIP VAN DE WEEK
   Een tip met 'release' gaat op die datum (een vrijdag) van het slot. Tot
   die tijd zien collega's alleen een blok met een slotje en de datum; de
   tip staat dan nergens op het platform. Daarna is hij terug te lezen bij
   'Alle tips'. Tips zonder 'release' zijn altijd zichtbaar (de basis).
   Planning nu: iedere vrijdag één tip vanaf 23 oktober 2026, zonder
   25 december en 1 januari. Een nieuwe tip inplannen? Geef hem de eerste
   vrije vrijdag na de laatste datum hieronder.
   Let op: het slot is een spelregel, geen beveiliging. Wie dit bestand
   opent, kan de tekst al lezen; zet er dus niets geheims in.

   Velden (* = verplicht):
     id*          Unieke code (adres #/tip/<id>). Verander een id niet meer.
     title*       Korte titel.
     summary*     Eén of twee zinnen: wat is het en wat heb je eraan?
     category*    Thema, bijv. 'Instellen'. Schrijf een thema overal hetzelfde.
     icon         Icoon uit de sprite in index.html (zonder 'i-').
     license      true = Microsoft 365 Copilot-licentie nodig; false = ook met de
                  gratis Copilot Chat. Weglaten = niets tonen.
     featured     true = uitgelicht op de startpagina en bovenaan de tips.
     minutes      Hoe lang het instellen duurt, bijv. '2 min'.
     why          Waarom is dit handig in de audit?
     steps*       Stappen als lijst.
     example      Optioneel: { label, text } — een tekst om te kopiëren.
     note         Kleine lettertjes: beschikbaarheid, beleid, menunamen.
     added        Datum van toevoegen (JJJJ-MM-DD), voor het label 'Nieuw'.
     release      Optioneel: vrijdag (JJJJ-MM-DD) waarop de tip als 'tip van de week'
                  van het slot gaat. Weglaten = altijd zichtbaar.
     usecases     Id's uit data/usecases.js die hierbij passen.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.tips = [
  /* ---- Instellen ----------------------------------------------------------- */
  {
    id: 'instructies',
    title: 'Stel je eigen instructies in',
    summary: 'Vertel Copilot één keer wie je bent en hoe je antwoorden wilt. Daarna houdt Copilot daar in elk gesprek rekening mee.',
    category: 'Instellen',
    icon: 'settings',
    featured: true,
    minutes: '3 min',
    why: 'Je hoeft niet in iedere prompt opnieuw uit te leggen dat je auditor bent, dat je in het Nederlands wilt werken en dat je bronnen wilt zien. Dat scheelt typwerk en levert direct beter bruikbare antwoorden op, met tabellen en duidelijk gemarkeerde aannames.',
    steps: [
      'Open Microsoft 365 Copilot in je browser (m365.cloud.microsoft/chat) of in de Copilot-app.',
      'Klik op je profielfoto of op de drie puntjes (…) en kies Instellingen.',
      'Ga naar Personalisatie en zet Aangepaste instructies aan.',
      'Plak de voorbeeldinstructie hieronder en pas je functie en voorkeuren aan.',
      'Sla op. Vanaf nu gebruikt Copilot je instructies in ieder nieuw gesprek.',
      'Test het met een vraag die je vaak stelt en schaaf bij waar nodig.'
    ],
    example: {
      label: 'Voorbeeldinstructie voor auditors',
      text: `Ik werk als [FUNCTIE, bijv. senior auditor] in de auditpraktijk van Visser & Visser. Ik controleer jaarrekeningen van MKB-ondernemingen volgens de Nederlandse controlestandaarden en BW2 Titel 9 / RJ.

Hoe je antwoordt:
- Altijd in het Nederlands, zakelijk en beknopt. Begin met de kern, daarna de onderbouwing.
- Gebruik tabellen voor overzichten en bevindingen.
- Vermeld bij feiten uit bestanden de bron (bestandsnaam en pagina of tabblad).
- Maak onderscheid tussen feiten uit de stukken, berekeningen en aannames. Markeer aannames met "Aanname".
- Noem een wettelijke eis of standaard alleen als je zeker bent van het artikel of nummer; schrijf anders "Nagaan".
- Geef geen eindoordeel over een jaarrekening of controleverklaring; doe voorstellen die ik zelf beoordeel.
- Is mijn vraag onduidelijk, vraag dan door in plaats van te gokken.`
    },
    note: 'Menunamen kunnen per versie iets verschillen. Zie je Personalisatie niet? Dan is de functie voor jouw account mogelijk (nog) niet beschikbaar. Zet in je instructies nooit klant- of persoonsgegevens.',
    added: '2026-10-19',
    usecases: ['risicoanalyse', 'managementletter']
  },
  {
    id: 'schildje',
    title: 'Kijk of je het schildje ziet',
    summary: 'Het schildje betekent dat je Copilot met je zakelijke account gebruikt, met de databescherming van Visser & Visser.',
    category: 'Instellen',
    icon: 'shield',
    license: false,
    minutes: '1 min',
    why: 'Alleen in de zakelijke omgeving blijven je prompts en bestanden binnen de beveiligde Microsoft 365-omgeving van kantoor en worden ze niet gebruikt om AI-modellen te trainen. Met een privé-account of een andere AI-tool heb je die bescherming niet.',
    steps: [
      'Ga naar m365.cloud.microsoft/chat of open Copilot in Teams of Outlook.',
      'Controleer dat je bent ingelogd met je @visser-visser.nl-account.',
      'Kijk of je het schildje ziet bij het invoerveld of bovenin. Ga er met de muis op staan: er staat dan dat je zakelijke gegevens beschermd zijn.',
      'Geen schildje? Gebruik Copilot dan niet voor werk en log opnieuw in met je zakelijke account.'
    ],
    note: 'Ook met het schildje geldt: deel niet meer dan nodig en volg het AI-beleid van kantoor.',
    added: '2026-10-19',
    usecases: []
  },

  /* ---- Vergaderen ------------------------------------------------------------ */
  {
    id: 'facilitator',
    title: 'Laat Facilitator meeschrijven in Teams',
    summary: 'Facilitator houdt tijdens de vergadering gedeelde notities bij: onderwerpen, besluiten en acties. Iedereen kijkt live mee.',
    category: 'Vergaderen',
    icon: 'mic',
    license: true,
    featured: true,
    minutes: '1 min',
    why: 'Bij de planningsbespreking, de slotbespreking of een teamoverleg wil je meedoen in het gesprek, niet notuleren. Facilitator schrijft mee en iedereen ziet de notities ontstaan, dus misverstanden over afspraken komen direct op tafel.',
    steps: [
      'Plan de vergadering zoals altijd in Teams of Outlook.',
      'Vertel aan het begin dat Copilot meeluistert en notities maakt. Iedereen ziet in Teams een melding van de transcriptie.',
      'Zet Facilitator aan in de vergadering, via Copilot of via Meer (…). Facilitator gebruikt de transcriptie; zet die aan als Teams erom vraagt.',
      'Facilitator maakt gedeelde notities met onderwerpen, besluiten en acties. Iedereen in de vergadering kan meelezen en aanvullen.',
      'Stel tussendoor vragen, bijvoorbeeld: "Welke acties hebben we tot nu toe afgesproken?"',
      'Na afloop vind je de notities en de transcriptie bij de vergadering (Samenvatting). Gebruik de usecase "Van klantoverleg naar actielijst" voor de bevestigingsmail.'
    ],
    example: {
      label: 'Handige vragen tijdens de vergadering',
      text: `Welke besluiten hebben we tot nu toe genomen?
Welke acties staan er open, met eigenaar en deadline?
Op welke vragen van de klant hebben we nog geen antwoord gegeven?
Hoeveel tijd hebben we nog voor de resterende agendapunten?`
    },
    note: 'Facilitator werkt met een Microsoft 365 Copilot-licentie. Zijn er externe deelnemers, vraag dan vooraf toestemming en volg het kantoorbeleid voor opnemen en transcriberen. Menunamen kunnen per Teams-versie verschillen.',
    added: '2026-10-19',
    usecases: ['klantoverleg', 'walkthrough']
  },
  {
    id: 'transcriptie',
    title: 'Een Teams-vergadering transcriberen en downloaden',
    summary: 'Ook zonder licentie: zet de transcriptie aan, download hem na afloop en geef hem aan Copilot Chat.',
    category: 'Vergaderen',
    icon: 'document',
    license: false,
    minutes: '2 min',
    why: 'Een transcriptie van een walkthrough of klantoverleg is de basis voor een procesbeschrijving, notulen of een actielijst. Met de gratis Copilot Chat maak je daar in een paar minuten een bruikbaar stuk van.',
    steps: [
      'Vertel aan het begin van het overleg dat je de vergadering transcribeert. Iedereen ziet daar ook een melding van in Teams.',
      'Kies in de vergadering bovenin Meer (…) → Opnemen en transcriberen → Transcriptie starten.',
      'Kies Nederlands als gesproken taal. Dan wordt de transcriptie een stuk beter.',
      'Klaar? Kies in hetzelfde menu Transcriptie stoppen, of beëindig de vergadering.',
      'Open na afloop de vergadering in je agenda of de vergaderchat, ga naar Samenvatting → Transcriptie en kies Downloaden (.docx).',
      'Voeg dat bestand in Copilot Chat toe met de paperclip en gebruik een prompt uit de usecases.'
    ],
    note: 'Downloaden kan de organisator van de vergadering. Zie je de optie om te transcriberen niet? Dan staat die mogelijk uit; vraag het na bij ICT.',
    added: '2026-10-19',
    release: '2026-11-20',
    usecases: ['walkthrough', 'klantoverleg']
  },

  /* ---- Automatiseren ------------------------------------------------------- */
  {
    id: 'geplande-prompts',
    title: 'Terugkerende taken inplannen met geplande prompts',
    summary: 'Laat Copilot een prompt automatisch op een vast moment draaien, zodat het antwoord klaarstaat als je begint.',
    category: 'Automatiseren',
    icon: 'calendar-clock',
    license: true,
    featured: true,
    minutes: '2 min',
    why: 'Sommige vragen stel je elke week opnieuw: wat staat er open, wat moet ik voorbereiden, wat heb ik gedaan voor mijn uren? Met een geplande prompt draait Copilot die vraag automatisch op het moment dat jij kiest. Je begint de week met je actielijst, of sluit de vrijdag af met je urenoverzicht.',
    steps: [
      'Open Microsoft 365 Copilot Chat op het tabblad Werk en stuur de prompt die je wilt herhalen. Kijk of het antwoord is wat je wilt.',
      'Ga met de muis over je prompt en kies Deze prompt plannen (het klokje), of kies … → Plannen.',
      'Kies hoe vaak (dagelijks, wekelijks of op vaste dagen), het tijdstip en eventueel hoe lang hij moet doorlopen.',
      'Sla op. Copilot draait de prompt op de achtergrond; je krijgt een melding en het resultaat staat in je Copilot-geschiedenis.',
      'Je geplande prompts beheer je via Instellingen → Geplande prompts: pauzeren, wijzigen of verwijderen.'
    ],
    example: {
      label: 'Drie geplande prompts voor auditors',
      text: `Elke maandag 08:00 · Weekstart
Zet de acties en deadlines uit mijn mail van de afgelopen week in een tabel (taak, afzender, deadline, prioriteit) en noem de afspraken die ik deze week heb, met wat ik per afspraak moet voorbereiden.

Elke dag 16:30 · Openstaande stukken
Zoek in mijn mail van vandaag naar stukken die klanten hebben gestuurd of toegezegd. Maak per klant een lijst: wat is binnengekomen, wat staat nog open en wie moet ik herinneren.

Elke vrijdag 15:00 · Urenoverzicht
Maak op basis van mijn agenda, verzonden mail en bewerkte bestanden van deze week een overzicht per klant en per dag van waar ik aan heb gewerkt, als hulp bij mijn urenregistratie.`
    },
    note: 'Geplande prompts werken met een Microsoft 365 Copilot-licentie. Het aantal geplande prompts en het aantal keer dat een prompt draait is beperkt; verleng hem als hij afloopt. Menunamen kunnen per versie verschillen.',
    added: '2026-10-19',
    usecases: ['weekplanning']
  },
  {
    id: 'prompts-bewaren',
    title: 'Bewaar je favoriete prompts',
    summary: 'Een goede prompt wil je terugvinden. Markeer hem met een ster op dit platform, of bewaar hem in Copilot zelf.',
    category: 'Automatiseren',
    icon: 'star',
    license: false,
    minutes: '1 min',
    why: 'De beste prompts zijn de prompts die je vaker gebruikt en steeds een beetje verbetert. Door ze te bewaren hoef je niet elke keer opnieuw te beginnen.',
    steps: [
      'Op dit platform: klik op de ster bij een prompt. Je vindt hem terug in de promptdatabase met het filter Mijn favorieten (bewaard in deze browser).',
      'In Copilot: ga met de muis over een prompt die je hebt verstuurd en kies Prompt opslaan (als je die optie ziet). Je vindt hem terug bij je opgeslagen prompts.',
      'Een eigen, verbeterde versie? Deel hem via de ideeënhub (kies Prompt delen), dan kan iedereen hem gebruiken.'
    ],
    note: 'Favorieten op dit platform staan alleen in deze browser op dit apparaat. Of je prompts kunt opslaan in Copilot, hangt af van je versie.',
    added: '2026-10-19',
    release: '2026-12-18',
    usecases: []
  },

  /* ---- Beter prompten -------------------------------------------------------- */
  {
    id: 'prompt-opbouw',
    title: 'Zo bouw je een sterke prompt: doel, context, bron, verwachting',
    summary: 'Vier onderdelen die het verschil maken tussen een vaag en een bruikbaar antwoord.',
    category: 'Beter prompten',
    icon: 'wand',
    license: false,
    minutes: '3 min',
    why: 'Copilot weet niets van jouw opdracht, behalve wat jij vertelt. Hoe concreter je bent over het doel, de situatie, de stukken en de vorm van het antwoord, hoe minder je hoeft te herstellen.',
    steps: [
      'Doel: wat wil je bereiken? Bijvoorbeeld "Maak een eerste risico-inventarisatie voor de planning."',
      'Context: wie ben je, wat is de situatie? Bijvoorbeeld "Ik ben auditor, de klant is een groothandel met 40 medewerkers, boekjaar 2026."',
      'Bron: welke stukken moet Copilot gebruiken, en alleen die? Bijvoorbeeld "Gebruik alleen de bijgevoegde jaarrekening 2025."',
      'Verwachting: hoe wil je het antwoord? Bijvoorbeeld "Een tabel met de kolommen …, maximaal 10 regels, met bron per regel."',
      'Voeg spelregels toe: "Markeer aannames", "Verzin niets", "Noem geen artikel als je niet zeker bent".'
    ],
    example: {
      label: 'Sjabloon om mee te beginnen',
      text: `Doel: [WAT WIL JE BEREIKEN]

Context: Ik ben [FUNCTIE] en werk aan [OPDRACHT OF SITUATIE].

Bronnen: Gebruik alleen [BESTANDEN OF INFORMATIE].

Verwachting: Lever op als [VORM, bijv. een tabel met de kolommen ...]. Maximaal [OMVANG].

Regels:
- Vermeld bij ieder punt de bron.
- Markeer aannames met "Aanname".
- Weet je iets niet zeker, zeg dat dan.`
    },
    note: '',
    added: '2026-10-19',
    release: '2026-10-23',
    usecases: ['risicoanalyse']
  },
  {
    id: 'doorvragen',
    title: 'Vraag door: het eerste antwoord is een begin',
    summary: 'De meeste winst zit in de tweede en derde vraag. Zo stuur je bij zonder opnieuw te beginnen.',
    category: 'Beter prompten',
    icon: 'chat',
    license: false,
    minutes: '1 min',
    why: 'Copilot onthoudt het gesprek. Je kunt dus kort bijsturen: korter, strenger, andere vorm, extra controle. Dat is sneller dan een nieuwe, lange prompt.',
    steps: [
      'Lees het antwoord en kijk wat mist of niet klopt.',
      'Stuur bij met een korte vervolgvraag (zie voorbeelden).',
      'Is het gesprek te lang of loopt het vast? Begin een nieuw gesprek en plak het beste tussenresultaat als startpunt.'
    ],
    example: {
      label: 'Vervolgvragen die vaak helpen',
      text: `Zet dit in een tabel met de kolommen [KOLOMMEN].
Maak het de helft korter en houd alleen de punten met belang "hoog".
Welke aannames heb je gedaan? Zet ze onder elkaar.
Op welke pagina staat de bron van punt 3? Citeer de tekst.
Reken de bedragen in de tabel opnieuw na en laat de berekening zien.
Schrijf dit voor een lezer zonder financiële achtergrond.
Wat zou een kritische reviewer van dit antwoord zeggen?`
    },
    note: '',
    added: '2026-10-19',
    release: '2026-11-06',
    usecases: ['jaarrekening-review', 'managementletter']
  },

  /* ---- Slimme functies ------------------------------------------------------- */
  {
    id: 'bestanden-toevoegen',
    title: 'Bestanden toevoegen: paperclip of /',
    summary: 'Geef Copilot de stukken waar het over gaat. Zonder licentie met de paperclip, met licentie ook met /.',
    category: 'Slimme functies',
    icon: 'document',
    license: false,
    minutes: '1 min',
    why: 'Een antwoord is zo goed als de bron. Door de stukken zelf toe te voegen, werkt Copilot met jouw jaarrekening, transcriptie of contract in plaats van met algemene kennis.',
    steps: [
      'Paperclip (iedereen): klik op de paperclip of de + in het invoerveld en kies een bestand van je computer of OneDrive. Je kunt meerdere bestanden toevoegen.',
      '/ (met licentie): typ / in het invoerveld en kies een bestand, e-mail, vergadering of persoon. Copilot gebruikt dan precies dat item.',
      'Noem het bestand in je prompt, bijvoorbeeld "Gebruik alleen Jaarrekening 2025 concept 3".',
      'Werk met de nieuwste versie: een oud concept geeft oude antwoorden.'
    ],
    note: 'Voeg alleen stukken toe die bij de opdracht horen. Grote of gescande bestanden worden soms niet volledig gelezen; vraag dan welke pagina\'s Copilot heeft gebruikt.',
    added: '2026-10-19',
    release: '2026-10-30',
    usecases: ['notulen', 'jaarrekening-review']
  },
  {
    id: 'researcher-analyst',
    title: 'Researcher en Analyst: agents voor diepgaand werk',
    summary: 'Researcher zoekt en onderbouwt, Analyst rekent met data. Ze nemen meer tijd, maar gaan veel dieper.',
    category: 'Slimme functies',
    icon: 'robot',
    license: true,
    minutes: '2 min',
    why: 'Voor een brancheanalyse of een analyse van alle journaalposten is een gewone chat te beperkt. Researcher combineert bronnen tot een rapport met bronvermelding. Analyst schrijft en draait Python-code op je data en laat zien hoe hij rekent; dat maakt de analyse controleerbaar.',
    steps: [
      'Open Microsoft 365 Copilot en kies in de lijst met agents Researcher of Analyst.',
      'Researcher: beschrijf je onderzoeksvraag zo concreet mogelijk. Researcher stelt soms eerst vragen terug; beantwoord die.',
      'Analyst: voeg je Excel- of CSV-bestand toe en beschrijf de analyse stap voor stap.',
      'Geef het even de tijd: beide agents werken een paar minuten aan een antwoord.',
      'Controleer de bronnen (Researcher) en de code en tussenstappen (Analyst) voordat je iets overneemt.'
    ],
    note: 'Researcher en Analyst werken met een Microsoft 365 Copilot-licentie. Het aantal keer dat je ze per maand kunt gebruiken kan beperkt zijn.',
    added: '2026-10-19',
    release: '2027-01-08',
    usecases: ['journaalposten', 'risicoanalyse']
  },
  {
    id: 'notebooks',
    title: 'Werk per onderwerp in een Copilot Notebook',
    summary: 'Verzamel de stukken van één opdracht of onderwerp in een notebook en stel er steeds vragen over.',
    category: 'Slimme functies',
    icon: 'book',
    license: true,
    minutes: '3 min',
    why: 'Bij een opdracht werk je dagen of weken met dezelfde stukken. In een notebook zet je die bij elkaar, met je eigen aantekeningen, zodat je niet in ieder gesprek alles opnieuw hoeft toe te voegen.',
    steps: [
      'Open Microsoft 365 Copilot en kies Notebooks (of Pagina\'s, afhankelijk van je versie) → Nieuw notebook.',
      'Geef het notebook een duidelijke naam, bijvoorbeeld "Planning [ONDERNEMING] 2026".',
      'Voeg verwijzingen toe naar de bestanden in het dossier of OneDrive, en eventueel vergaderingen en aantekeningen.',
      'Stel je vragen in het notebook; Copilot gebruikt de verzamelde bronnen.',
      'Ruim het notebook op als de opdracht klaar is.'
    ],
    note: 'Copilot gebruikt alleen bestanden waar jij zelf toegang toe hebt. Beschikbaarheid en naam van de functie kunnen per versie verschillen.',
    added: '2026-10-19',
    release: '2027-01-15',
    usecases: []
  },
  {
    id: 'excel-copilot',
    title: 'Copilot in Excel: kolommen, formules en analyses',
    summary: 'Laat Copilot in je eigen werkpapier formules maken, kolommen toevoegen en opvallende waarden markeren.',
    category: 'Slimme functies',
    icon: 'table',
    license: true,
    minutes: '2 min',
    why: 'Met Copilot in Excel blijft alles in je eigen bestand: je ziet precies welke formule er staat en kunt die controleren. Handig voor cijferanalyses, aansluitingen en het opschonen van exports.',
    steps: [
      'Sla het bestand op in OneDrive of SharePoint (Automatisch opslaan aan).',
      'Maak van je gegevens een tabel: selecteer de gegevens en kies Invoegen → Tabel.',
      'Klik op Copilot in het lint en beschrijf wat je wilt, bijvoorbeeld "Voeg een kolom toe met het verschil tussen 2026 en 2025".',
      'Bekijk de voorgestelde formule of wijziging en kies Invoegen als die klopt.',
      'Controleer een paar regels zelf na.'
    ],
    example: {
      label: 'Voorbeeldvragen in Excel',
      text: `Voeg een kolom toe met het verschil tussen [KOLOM A] en [KOLOM B], in euro's en in procenten.
Markeer alle rijen waarvan het verschil groter is dan [BEDRAG].
Maak een draaitabel met het totaal per [CATEGORIE] per maand.
Welke waarden in [KOLOM] wijken sterk af van de rest?`
    },
    note: 'Copilot in Excel werkt met een Microsoft 365 Copilot-licentie.',
    added: '2026-10-19',
    release: '2026-12-04',
    usecases: ['cijferanalyse']
  },
  {
    id: 'outlook-samenvatten',
    title: 'Lange mailwisseling? Laat Outlook samenvatten',
    summary: 'Met één klik de kern van een lange mailwisseling, en hulp bij het antwoord.',
    category: 'Slimme functies',
    icon: 'mail',
    license: true,
    minutes: '1 min',
    why: 'Mailwisselingen met klanten over stukken en reviewpunten worden snel lang. Een samenvatting laat zien wat er is afgesproken en wat er nog openstaat, voordat je reageert.',
    steps: [
      'Open de mailwisseling in Outlook.',
      'Klik bovenaan op Samenvatten (met het Copilot-icoon).',
      'Wil je reageren? Kies Concept maken met Copilot en beschrijf in één zin wat je wilt zeggen.',
      'Lees het concept na en pas het aan voordat je verstuurt.'
    ],
    note: 'Werkt met een Microsoft 365 Copilot-licentie. Copilot verstuurt nooit zelf een mail; dat doe jij.',
    added: '2026-10-19',
    release: '2026-11-27',
    usecases: ['weekplanning']
  },

  /* ---- Veilig werken ---------------------------------------------------------- */
  {
    id: 'controleren',
    title: 'Controleer slim: laat Copilot zichzelf narekenen',
    summary: 'Copilot kan overtuigend fout zitten. Met deze vragen vind je fouten sneller, maar de eindcontrole blijft van jou.',
    category: 'Veilig werken',
    icon: 'check-circle',
    license: false,
    minutes: '2 min',
    why: 'In de audit moet alles herleidbaar en juist zijn. Copilot kan rekenfouten maken, bronnen verkeerd citeren of iets aannemen dat niet in de stukken staat. Door gericht te controleren, vang je dat op.',
    steps: [
      'Vraag altijd om de bron per punt (bestand, pagina, citaat) en zoek een paar bronnen zelf op.',
      'Vraag Copilot om berekeningen te laten zien, en reken de grootste zelf na.',
      'Vraag welke aannames Copilot heeft gedaan en waar hij onzeker over is.',
      'Vergelijk de uitkomst met wat je zelf verwacht. Verrast een uitkomst je, zoek dan uit waarom.',
      'Neem alleen over wat je hebt gecontroleerd.'
    ],
    example: {
      label: 'Controlevragen om te kopiëren',
      text: `Noem per punt de bron: bestandsnaam, pagina en een letterlijk citaat.
Laat alle berekeningen stap voor stap zien.
Welke aannames heb je gedaan die niet letterlijk in de stukken staan?
Noem de drie punten in je antwoord waar je het minst zeker over bent, en waarom.`
    },
    note: '',
    added: '2026-10-19',
    release: '2026-11-13',
    usecases: ['cijferanalyse', 'jaarrekening-review']
  },
  {
    id: 'dossier-vastleggen',
    title: 'Leg vast wat je met Copilot hebt gedaan',
    summary: 'Gebruik je Copilot voor controlewerk? Leg kort vast waarvoor, met welke stukken en hoe je de uitkomst hebt gecontroleerd.',
    category: 'Veilig werken',
    icon: 'pencil-line',
    license: false,
    minutes: '2 min',
    why: 'Een reviewer of toetser moet kunnen volgen hoe je tot je conclusie bent gekomen. Ook als Copilot heeft geholpen, moet het dossier laten zien wat jij hebt gedaan en beoordeeld.',
    steps: [
      'Noteer bij de werkzaamheid dat je Copilot hebt gebruikt en waarvoor.',
      'Noem de stukken die je hebt toegevoegd en de prompt (of verwijs naar de prompt op dit platform).',
      'Beschrijf hoe je de uitkomst hebt gecontroleerd.',
      'Leg jouw conclusie vast, in je eigen woorden.',
      'Volg daarbij altijd het AI-beleid en de dossierrichtlijnen van kantoor.'
    ],
    example: {
      label: 'Voorbeeldvastlegging',
      text: `Gebruik van Copilot
Doel: [DOEL, bijv. eerste selectie van opvallende journaalposten]
Gebruikt: Microsoft 365 Copilot, [CHAT OF AGENT], zakelijke omgeving
Input: [BESTANDEN], prompt: [TITEL OF LINK]
Controle van de uitkomst: [CONTROLE, bijv. populatie aangesloten op de proefsaldibalans, selectie voor 10 posten handmatig nagelopen]
Conclusie: [JOUW CONCLUSIE]`
    },
    note: 'Dit is een voorbeeld. Het AI-beleid en de dossierrichtlijnen van kantoor gaan altijd voor.',
    added: '2026-10-19',
    release: '2026-12-11',
    usecases: ['journaalposten']
  }
];
