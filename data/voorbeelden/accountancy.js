/* ==========================================================================
   AI COCKPIT — VOORBEELDINHOUD ACCOUNTANCY
   --------------------------------------------------------------------------
   Startinhoud voor de discipline Accountancy. Niet zichtbaar op de site:
   Beheer → Inhoud (in de cockpit van Accountancy) biedt aan deze inhoud
   over te nemen zolang Accountancy nog leeg is. Daarna pas je alles daar
   aan; dit bestand doet dan niet meer mee.

   Dezelfde velden als de bestanden in data/ (uitleg staat daar bovenin).
   Uit de AI Snackbar van de Boost & Learn (26 en 27 oktober 2026):
   - de zes snacks als usecases, ieder met de demo van de snackkaart
     (snack 1 als HTML-demo, snack 2 t/m 6 als video in assets/videos/);
     de pro-versie van snack 4 niet: die werkt met Claude, buiten Copilot;
   - de dertig bijgerechten als losse prompts, met de versie zonder
     licentie (promptBasic) en de vervolgstappen (followUps);
   - de training 'Van AI-hype naar toepassing' (26 oktober 2026) met het
     naslagwerk, voor zover dat op een openbare site mag (zie daar).
   De fasen 'communicatie' en 'eigen-werk' staan hier zelf in: de gedeelde
   basis heeft (nog) geen fasen. Alle namen en organisaties zijn verzonnen.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};
window.AIAudit.examples = window.AIAudit.examples || {};

window.AIAudit.examples.accountancy = {
  /* ---- Fasen ------------------------------------------------------------------------ */
  phases: [
    { id: 'administratie', label: 'Administratie & verwerking', short: 'Administratie', accent: 'teal', icon: 'table' },
    { id: 'samenstellen', label: 'Samenstellen jaarrekening', short: 'Samenstellen', accent: 'crimson', icon: 'document' },
    { id: 'fiscaal', label: 'Aangiftes & fiscaal', short: 'Fiscaal', accent: 'steel', icon: 'checklist' },
    { id: 'advies', label: 'Advies & klantgesprek', short: 'Advies', accent: 'rose', icon: 'chart' },
    { id: 'communicatie', label: 'Klant- en teamcommunicatie', short: 'Communicatie', accent: 'deepteal', icon: 'users' },
    { id: 'eigen-werk', label: 'Eigen werk & planning', short: 'Eigen werk', accent: 'navy', icon: 'calendar' }
  ],

  /* ---- Usecases: de zes snacks ------------------------------------------------------- */
  usecases: [
    {
      // Snack 1
      id: 'weekplanning',
      title: 'Van inbox naar weekplanning',
      subtitle: 'Copilot maakt van je mail een to-do-lijst én een planning',
      phase: 'eigen-werk',
      level: 'Starter',
      duration: '1,5 min',
      license: true,
      tools: ['Copilot Chat (Werk)'],
      icon: 'mail',
      featured: true,
      added: '2026-10-28',
      intro: 'In de drukke jaarwerkperiode loop je zo achter je mail aan. Copilot leest de mails van de afgelopen week en zet alle acties en deadlines in een to-do-lijst met prioriteit. Daarna verdeelt Copilot de taken over je week, rond je bestaande afspraken, en zet een focusblok in je agenda.',
      demo: 'assets/demos/snack-01.html',
      steps: [
        'Open Microsoft 365 Copilot Chat op het tabblad Werk.',
        'Gebruik de eerste prompt voor de to-do-lijst en controleer de deadlines in de mails zelf.',
        'Gebruik de tweede prompt voor de weekplanning rond je afspraken.',
        'Zet het belangrijkste blok direct vast met de derde prompt.'
      ],
      prompts: [
        {
          label: 'Stap 1 · To-do-lijst uit je mail',
          text: `Bekijk alle e-mails in mijn Postvak IN van de afgelopen 7 dagen. Haal daaruit alle acties, verzoeken en deadlines die op mij betrekking hebben. Maak een to-do lijst in een tabel met de kolommen: Taak, Afzender, Datum e-mail, Deadline (indien genoemd), Prioriteit (Hoog/Middel/Laag). Sorteer op prioriteit en deadline. Sla nieuwsbrieven en automatische meldingen over. Zet onderaan een korte lijst van e-mails die nog op mijn antwoord wachten.`
        },
        {
          label: 'Stap 2 · Planning voor de rest van de week',
          text: `Zet deze actielijst om in een planning voor de rest van deze week. Houd rekening met mijn bestaande afspraken in mijn agenda en geef per taak een tijdsinschatting.`
        },
        {
          label: 'Stap 3 · Focusblok inplannen',
          text: `Plan een focusblok in op [DAG] van [BEGINTIJD] tot [EINDTIJD] met de titel: [TAAK]`
        }
      ],
      promptNote: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk); Copilot leest je eigen mailbox en agenda. Geen licentie? Plak de tekst van je mails van deze week in de gratis Copilot Chat en begin de prompt met "Hieronder staan mijn e-mails van deze week." Afspraken zet je dan zelf in je agenda.',
      watchOut: [
        'Controleer deadlines altijd even in de mail zelf.',
        'Copilot ziet alleen wat in jouw mailbox en agenda staat. Afspraken die alleen mondeling zijn gemaakt, mist hij.'
      ],
      tip: 'Maak van de eerste prompt een geplande prompt voor elke maandag om 08:00. Dan begin je de week met je actielijst.',
      relatedTips: ['geplande-prompts', 'outlook-samenvatten']
    },
    {
      // Snack 2
      id: 'icbo-jaarrekening',
      title: 'ICBO op een concept jaarrekening',
      subtitle: 'Copilot loopt het concept uitgebreid na vóór afgifte',
      phase: 'samenstellen',
      level: 'Gevorderd',
      duration: '3 min',
      license: false,
      tools: ['Copilot Chat'],
      icon: 'checklist',
      featured: true,
      added: '2026-10-19',
      intro: 'Copilot doet een uitgebreide ICBO op een fictieve concept jaarrekening: volledigheid, aansluitingen, grondslagen en toelichting, analyse met de materialiteit, continuïteit en presentatie. Daarna reviewt Copilot het eigen werk kritisch. Je krijgt een samenvatting, een bevindingentabel, vragen voor klant en team en een reviewnotitie.',
      video: 'assets/videos/snack-02.mp4',
      steps: [
        'Open Microsoft 365 Copilot Chat met je zakelijke account (je ziet het schildje) en voeg met de paperclip de concept jaarrekening toe, en die van vorig jaar.',
        'Kopieer de eerste prompt, vul de plaatshouders in (zoals de materialiteit uit het dossier) en verstuur.',
        'Laat Copilot met de tweede prompt het eigen werk kritisch nalopen, in dezelfde chat.',
        'Loop de gecorrigeerde bevindingentabel na: klopt iedere bevinding met de pagina en de berekening?',
        'Maak met de derde prompt een korte reviewnotitie voor de opdrachtverantwoordelijke.'
      ],
      prompts: [
        {
          label: 'Stap 1 · ICBO op de jaarrekening',
          text: `Je bent een ervaren accountant met veel MKB-kennis en voert een ICBO uit op de bijgevoegde concept jaarrekening [BESTANDSNAAM] van [ONDERNEMING], [RECHTSVORM], boekjaar [JAAR]. De jaarrekening is opgesteld volgens [BW2 TITEL 9 EN RJ / RJK / FISCALE GRONDSLAGEN] voor een [MICRO / KLEINE / MIDDELGROTE] rechtspersoon.

Beoordeel de jaarrekening op de volgende onderdelen.

A. Volledigheid en opbouw
- Zijn balans, winst-en-verliesrekening, grondslagen, toelichting, overige gegevens, etc. aanwezig?
- Kloppen naam, rechtsvorm, vestigingsplaats, KvK-nummer, boekjaar en data overal?

B. Cijfermatige aansluitingen
- Kloppen de balanstotalen, subtotalen en de tabellen in de toelichting?
- Sluit het resultaat uit de winst-en-verliesrekening aan op het verloop van het eigen vermogen?
- Sluiten de toelichtingen aan op de posten in de balans en de winst-en-verliesrekening?
- Komen bedragen in de tekst overeen met de tabellen?

C. Grondslagen en toelichting
- Zijn er grondslagen voor alle materiële posten, en zijn die gelijk aan vorig jaar?
- Ontbreken toelichtingen die voor dit regime gebruikelijk of vereist zijn, zoals niet in de balans opgenomen verplichtingen, gebeurtenissen na balansdatum en het gemiddeld aantal werknemers?

D. Analyse ten opzichte van vorig jaar & materialiteit
- De materialiteit bedraagt [MATERIALITEIT] voor [JAAR] en de uitvoeringsmaterialiteit [UITVOERINGSMATERIALITEIT].
- Analyseer posten en mutaties groter dan de uitvoeringsmaterialiteit.
- Bereken de solvabiliteit, de current ratio en de brutomarge voor beide jaren en laat de berekening zien.

E. Continuïteit
- Zijn er signalen zoals een negatief eigen vermogen, structurele verliezen of een krappe liquiditeit? Wordt dit in de toelichting besproken?

F. Presentatie
- Inconsistente termen, tik- of afrondingsverschillen, ontbrekende eenheden en verkeerde verwijzingen.

Lever op:
1. Een samenvatting van maximaal vijf zinnen met de belangrijkste aandachtspunten.
2. Een bevindingentabel met: Nr., Onderdeel (A tot en met F), Bevinding, Pagina, Berekening of bron, Belang (hoog/middel/laag) en Voorgestelde actie.
3. Een lijst met vragen voor de klant en een lijst met vragen voor het opdrachtteam.

Werkwijze:
- Gebruik uitsluitend de bijgevoegde stukken.
- Reken na waar dat kan en laat je berekening zien.
- Noem een wettelijke eis alleen met het artikel of het RJ-hoofdstuk als je daar zeker van bent; markeer het anders als "Nagaan".
- Geef geen oordeel over de jaarrekening als geheel; benoem alleen bevindingen en vragen.`
        },
        {
          label: 'Stap 2 · Kritische review van de eigen ICBO',
          text: `Review nu je eigen ICBO-uitkomst kritisch, alsof je de manager bent die het werk van een junior nakijkt. Ga ervan uit dat er fouten in zitten. Gebruik opnieuw uitsluitend de bijgevoegde stukken en lees de bronbedragen opnieuw uit de PDF, niet uit je eerdere antwoord.

Werk deze stappen een voor een af:

1. Opdracht versus oplevering
- Leg de oorspronkelijke opdracht naast je antwoord. Is ieder gevraagd onderdeel, iedere gevraagde kolom en iedere gevraagde lijst aanwezig?
- Heb je ergens iets gedaan dat de opdracht uitdrukkelijk uitsloot?

2. Interne consistentie
- Vergelijk ieder bedrag, ieder verschil en iedere ratio in je samenvatting met de bevindingentabel en de ratio-analyse.
- Gaat het overal om hetzelfde bedrag, hetzelfde boekjaar en dezelfde twee bronnen?

3. Herberekening
- Reken iedere berekening opnieuw na vanuit de bronbedragen.
- Toon per berekening: bronbedragen met pagina, de berekening, de uitkomst en of die afwijkt van je eerdere uitkomst.

4. Aansluitingen tussen onderdelen
- Zoek ieder bedrag dat op meer dan één plek voorkomt (balans, winst-en-verliesrekening, kasstroomoverzicht, verloopoverzichten, toelichtingstabellen en lopende tekst) en kijk of het overal gelijk is, ook voor de vergelijkende cijfers.
- Noem bij een verschil beide bedragen, beide pagina's en het verschil.

5. Bevindingen dat iets ontbreekt
- Doorzoek voor iedere bevinding waarin je stelt dat iets ontbreekt of alleen elders staat de volledige jaarrekening opnieuw: bestuursverslag, grondslagen, toelichting op de balans en toelichting op de winst-en-verliesrekening.
- Staat het er toch, pas de bevinding dan aan of laat deze vervallen.

6. Datums en perioden
- Kijk of alle datums en perioden in de tekst logisch zijn ten opzichte van het boekjaar en de balansdatum, en of ze in het juiste onderdeel van de jaarrekening staan.

7. Kwaliteit van de bevindingen
- Haal punten die alleen bevestigen dat iets klopt uit de bevindingentabel en zet ze onder "Uitgevoerde checks zonder bevinding".
- Ga na of het toegekende belang past bij de omvang ten opzichte van de uitvoeringsmaterialiteit uit de eerste opdracht en bij de aard van het punt.

8. Oordeel
- Ga na of je ergens een oordeel over de jaarrekening als geheel geeft, en verwijder dat.

Lever op:
1. Een correctielijst met per punt: wat er eerder stond, wat het moet zijn, de pagina en de berekening.
2. Nieuwe bevindingen die je bij deze review hebt gevonden.
3. De gecorrigeerde bevindingentabel met alle gevraagde kolommen.

Vind je bij een stap geen fout, zeg dat dan expliciet. Verzin geen correcties.`
        },
        {
          label: 'Stap 3 · Reviewnotitie',
          text: `Zet de bevindingen met belang "hoog" om in een korte reviewnotitie voor de opdrachtverantwoordelijke, met per punt de voorgestelde actie.`
        }
      ],
      promptNote: 'Werkt met de gratis Copilot Chat: voeg de concept jaarrekening (en die van vorig jaar) toe met de paperclip, vul de materialiteit uit het dossier in en gebruik de drie prompts na elkaar in dezelfde chat. Gebruik voor de demo een fictieve jaarrekening.',
      watchOut: [
        'Copilot ondersteunt de ICBO, maar vervangt jouw oordeel niet.',
        'Reken bevindingen met een hoog belang zelf na voordat je ze bespreekt.'
      ],
      tip: 'Voeg ook de jaarrekening van vorig jaar toe. Dan kan Copilot de vergelijkende cijfers en grondslagen naast elkaar leggen.',
      relatedTips: ['bestanden-toevoegen', 'controleren']
    },
    {
      // Snack 3
      id: 'klantoverleg',
      title: 'Van overleg naar actielijst',
      subtitle: 'Notulen, acties en een vervolgmail uit je transcriptie',
      phase: 'communicatie',
      level: 'Starter',
      duration: '2 min',
      license: false,
      tools: ['Copilot Chat', 'Teams'],
      icon: 'users',
      featured: true,
      added: '2026-10-28',
      intro: 'Na een klantoverleg, zoals het jaarrekeninggesprek of een adviesgesprek, geef je de transcriptie uit Teams aan Copilot Chat. Copilot maakt er notulen en een actielijst met eigenaren en deadlines van, en schrijft een mail waarmee je de afspraken met de klant bevestigt.',
      video: 'assets/videos/snack-03.mp4',
      steps: [
        'Vertel aan het begin van het overleg dat je de vergadering transcribeert. Kies in Teams Meer (…) → Opnemen en transcriberen → Transcriptie starten, met Nederlands als gesproken taal.',
        'Open na afloop de vergadering in je agenda of de vergaderchat, ga naar Samenvatting → Transcriptie en kies Downloaden (.docx).',
        'Voeg dat bestand in Copilot Chat toe met de paperclip en gebruik de eerste prompt voor de samenvatting en de actielijst.',
        'Gebruik de tweede prompt voor de bevestigingsmail en lees die na voordat je hem verstuurt.'
      ],
      prompts: [
        {
          label: 'Stap 1 · Overleg samenvatten',
          text: `Ik voeg de transcriptie toe van ons overleg met [KLANTNAAM] op [DATUM]. Vanuit ons kantoor waren aanwezig: [NAMEN]. Vanuit de klant: [NAMEN KLANT].

Vat het overleg samen met:
1. De belangrijkste besproken onderwerpen, per onderwerp in 1 à 2 zinnen
2. Genomen besluiten
3. Voorstellen en ideeën waarover nog geen besluit is genomen
4. Actiepunten in een tabel met: Actie, Eigenaar, Organisatie (wij/klant), Deadline en Fragment uit de transcriptie
5. Openstaande vragen, met per vraag wie het antwoord moet geven

Regels:
- Gebruik alleen wat in de transcriptie staat en vul niets aan.
- Iets is pas een besluit als het expliciet is afgesproken. Twijfel je, zet het dan onder voorstellen.
- Vermeld "Niet benoemd" als een eigenaar of deadline ontbreekt. Neem relatieve deadlines zoals "volgende week" letterlijk over.
- Is niet duidelijk wie iets zei, markeer dat dan met "Spreker onduidelijk".`
        },
        {
          label: 'Stap 2 · Bevestigingsmail aan de klant',
          text: `Schrijf een korte, vriendelijke e-mail aan [KLANTNAAM] waarin je de besluiten en de acties van beide kanten bevestigt. Maximaal 150 woorden. Noem alleen besluiten en acties uit de samenvatting, doe geen nieuwe toezeggingen en laat interne opmerkingen weg. Vraag de klant te laten weten als iets niet klopt. Onderteken met [NAAM].`
        }
      ],
      promptNote: 'Werkt met de gratis Copilot Chat: download de transcriptie uit Teams en voeg die toe met de paperclip. Downloaden kan de organisator van de vergadering.',
      watchOut: [
        'Lees de bevestigingsmail altijd na: een toezegging die er niet in hoort, is zo verstuurd.',
        'Geen transcriptie? Plak je eigen aantekeningen van het overleg; dezelfde prompt werkt dan ook.'
      ],
      tip: 'Met een licentie kan Facilitator tijdens het overleg al meeschrijven. Dan heb je de actielijst klaar zodra de vergadering eindigt.',
      relatedTips: ['facilitator', 'transcriptie']
    },
    {
      // Snack 4 (de pro-versie met Claude staat hier bewust niet in: alleen Copilot met je zakelijke account)
      id: 'klantpresentatie',
      title: 'Van notitie naar klantpresentatie',
      subtitle: 'Copilot maakt van je Word-notitie een presentatie voor het jaargesprek',
      phase: 'advies',
      level: 'Gevorderd',
      duration: '2 min',
      license: true,
      tools: ['Copilot in PowerPoint'],
      icon: 'document',
      featured: true,
      added: '2026-10-19',
      intro: 'Copilot maakt in de huisstijl van Visser & Visser een presentatie voor het jaarrekeninggesprek met de directie. Iedere dia krijgt één boodschap in begrijpelijke taal. De uitleg en bronverwijzing staan in de sprekersnotities, zodat je het gesprek zo kunt voeren.',
      video: 'assets/videos/snack-04.mp4',
      steps: [
        'Zet je bespreekpunten en adviezen in een Word-notitie.',
        'Open de PowerPoint-template van Visser & Visser en start Copilot.',
        'Kopieer de eerste prompt, voeg je notitie toe als bron en verstuur.',
        'Laat Copilot met de tweede prompt ieder bedrag naast je notitie leggen.',
        'Lees de sprekersnotities na en pas aan waar nodig.'
      ],
      prompts: [
        {
          label: 'Stap 1 · Presentatie maken',
          text: `Je bent een ervaren samenstellend accountant bij Visser & Visser. Maak in deze template een presentatie van maximaal 8 dia's voor het jaarrekeninggesprek met de directie van [ONDERNEMING].

DOEL: de jaarrekening [JAAR] toelichten, de belangrijkste bespreekpunten en adviezen bespreken en afspraken maken over de vervolgstappen.
PUBLIEK: [PUBLIEK, bijv. de directeur-grootaandeelhouder en de financieel directeur]. Zij zijn ondernemers, geen accountants.
BRON: gebruik alleen het bijgevoegde document.

OPBOUW
1. Titel en doel van het gesprek
2. Samenvatting: de jaarrekening in drie punten, met de kerncijfers
3-6. De vier belangrijkste bespreekpunten, één per dia
7. Advies en keuzes voor de directie
8. Vervolgstappen en planning

SCHRIJFREGELS
- De diatitel is de boodschap in één zin.
- Maximaal vier bullets per blok, van maximaal tien woorden.
- Schrijf in begrijpelijke taal zonder vakjargon. Leg onvermijdelijke termen uit in de sprekersnotities.
- Dit is een samenstellingsopdracht, geen controle. Gebruik geen woorden als "controle", "controleverklaring" of "goedgekeurd".
- Zet uitleg en bronverwijzing (paragraaf) in de sprekersnotities.
- Gebruik alleen feiten en bedragen uit het document. Ontbreekt iets, zet dan [ONTBREEKT: wat er mist] op de dia.

OPMAAK
- Gebruik de huidige template en behoud logo, kleuren, lettertypen en zijbalk.
- Vul de zijbalk met de onderwerpen van deze presentatie.`
        },
        {
          label: 'Stap 2 · Bedragen nalopen',
          text: `Leg ieder bedrag en ieder feit in deze presentatie naast het bijgevoegde document. Maak een tabel met: Dia, Bedrag of feit, Paragraaf in het document en Klopt (ja / nee / niet gevonden). Pas de presentatie niet aan; ik beoordeel de verschillen zelf.`
        }
      ],
      promptNote: 'Werkt met Microsoft 365 Copilot in PowerPoint. Controleer cijfers en opmaak voordat je presenteert.',
      watchOut: ['Dit is een samenstellingsopdracht: geen woorden als "controle" of "goedgekeurd" op de dia\'s.'],
      tip: 'Lees de sprekersnotities na: daar staan de bronverwijzingen, zodat je ieder bedrag snel kunt controleren.',
      relatedTips: ['woordkeuze-samenstellen']
    },
    {
      // Snack 6
      id: 'contract-vertalen',
      title: 'Contract in een andere taal',
      subtitle: 'Copilot vat een buitenlands contract samen in helder Nederlands',
      phase: 'advies',
      level: 'Gevorderd',
      duration: '2 min',
      license: false,
      tools: ['Copilot Chat'],
      icon: 'magnifier-doc',
      featured: true,
      added: '2026-10-19',
      intro: 'Een klant stuurt een fictief contract in het Frans. Copilot vat het samen in helder Nederlands: partijen, looptijd, vergoedingen, verplichtingen en wat financieel relevant is, met per onderdeel het artikel en de originele tekst erbij. Daarna krijg je de vragen die je nog moet stellen.',
      video: 'assets/videos/snack-06.mp4',
      steps: [
        'Open Copilot Chat met je zakelijke account en voeg het contract toe met de paperclip.',
        'Kopieer de eerste prompt, vul de bestandsnaam en de taal in en verstuur.',
        'Lees de samenvatting naast het origineel: klopt de verwijzing naar ieder artikel?',
        'Gebruik de tweede prompt voor de vragen aan de klant of een jurist.'
      ],
      prompts: [
        {
          label: 'Stap 1 · Samenvatten in het Nederlands',
          text: `Je bent een ervaren accountant met kennis van contracten. Het bijgevoegde contract [BESTANDSNAAM] is opgesteld in het [TAAL, bijv. Frans]. Ik spreek die taal niet goed genoeg om het zelf te beoordelen.

Vat het contract in het Nederlands samen met:
1. Contractpartijen en hun rol
2. Onderwerp van het contract
3. Ingangsdatum, looptijd, verlenging en opzegging
4. Vergoedingen, betalingstermijnen en eventuele indexatie
5. Belangrijkste verplichtingen per partij
6. Aansprakelijkheid, boetes en garanties
7. Toepasselijk recht en bevoegde rechter
8. Bepalingen die financieel of fiscaal relevant kunnen zijn

Regels:
- Verwijs per onderdeel naar het artikel in het originele contract.
- Neem bij belangrijke bepalingen de oorspronkelijke tekst op, met je Nederlandse vertaling eronder.
- Is een term lastig te vertalen? Noem dan de originele term en leg uit wat die betekent.
- Staat iets niet in het contract, schrijf dan "Niet geregeld".
- Geef geen juridisch oordeel; markeer onduidelijkheden als vraag.`
        },
        {
          label: 'Stap 2 · Vragen voor klant of jurist',
          text: `Maak een lijst met maximaal vijf vragen die ik aan de klant of een jurist moet stellen voordat we dit contract verwerken.`
        }
      ],
      promptNote: 'Werkt met de gratis Copilot Chat: voeg het contract toe met de paperclip. Laat belangrijke conclusies altijd controleren.',
      watchOut: ['Een samenvatting is geen juridisch advies. Leg twijfelpunten voor aan een jurist.'],
      tip: 'Vraag daarna: "Vertaal artikel [NUMMER] volledig naar het Nederlands." Zo lees je het belangrijkste artikel helemaal.',
      relatedTips: ['bestanden-toevoegen']
    },
    {
      // Snack 5
      id: 'klantgesprek-voorbereiden',
      title: 'Klaar voor je klantgesprek',
      subtitle: 'Copilot zet alles over je klant op een rij vóór de afspraak',
      phase: 'communicatie',
      level: 'Starter',
      duration: '2 min',
      license: true,
      tools: ['Copilot Chat (Werk)'],
      icon: 'calendar',
      featured: true,
      added: '2026-10-19',
      intro: 'Morgen een afspraak met een klant? Copilot zoekt in je agenda, mails, Teams en bestanden wat er speelt: ontwikkelingen, eerdere afspraken en openstaande acties. Je krijgt vijf goede vragen en een voorstel voor de gespreksagenda.',
      video: 'assets/videos/snack-05.mp4',
      steps: [
        'Open Microsoft 365 Copilot Chat op het tabblad Werk, bijvoorbeeld een dag voor de afspraak.',
        'Kopieer de eerste prompt, vul de klantnaam en de periode in en verstuur.',
        'Kijk of de feiten kloppen: Copilot noemt bij ieder feit de bron.',
        'Stuur de klant met de tweede prompt de voorgestelde agenda.'
      ],
      prompts: [
        {
          label: 'Stap 1 · Alles op een rij',
          text: `Bereid mij voor op mijn eerstvolgende vergadering met [KLANTNAAM].

Gebruik relevante informatie uit:
- de agenda-uitnodiging;
- e-mails met [KLANTNAAM] uit de afgelopen [AANTAL] dagen;
- eerdere vergaderingen met [KLANTNAAM] uit de afgelopen [AANTAL] maanden;
- relevante bestanden waarin [KLANTNAAM] wordt genoemd.

Geef:
1. Datum, tijd en onderwerp van de afspraak
2. Doel van de afspraak
3. Belangrijkste ontwikkelingen sinds het vorige overleg
4. Eerder gemaakte afspraken
5. Openstaande acties voor ons
6. Openstaande acties voor de klant
7. Mogelijke knelpunten of onduidelijkheden
8. Vijf concrete vragen die ik tijdens de afspraak kan stellen
9. Een voorgestelde agenda voor het gesprek

Vermeld bij ieder feit de gebruikte bron. Maak onderscheid tussen bevestigde informatie en jouw suggesties voor gesprekspunten.`
        },
        {
          label: 'Stap 2 · Agenda naar de klant',
          text: `Schrijf een korte, vriendelijke e-mail aan [KLANTNAAM] met de voorgestelde agenda, zodat de klant zich ook kan voorbereiden. Maximaal 120 woorden. Onderteken met [NAAM].`
        }
      ],
      promptNote: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Copilot gebruikt alleen berichten en bestanden waar jij toegang toe hebt.',
      tip: 'Typ / en kies de afspraak uit je agenda. Dan weet Copilot precies welk gesprek je bedoelt.',
      relatedTips: ['instructies']
    }
  ],

  /* ---- Losse prompts ---------------------------------------------------------------- */
  prompts: [
    {
      id: 'aanleverlijst-jaarwerk',
      title: 'Aanleverlijst voor het jaarwerk als heldere mail',
      description: 'Van je interne lijst naar een vriendelijke mail die de klant in één keer begrijpt.',
      phase: 'administratie',
      task: 'Schrijven',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Ik stel de jaarrekening [JAAR] samen van [ONDERNEMING]. Hieronder staat mijn interne lijst met stukken die ik nog nodig heb:

[PLAK HIER JE LIJST]

Schrijf een vriendelijke, duidelijke mail aan [CONTACTPERSOON] met:
1. Een korte inleiding: waarvoor we de stukken nodig hebben en wanneer we ze graag ontvangen ([DEADLINE]).
2. De stukken als genummerde lijst, gegroepeerd per onderwerp (bijvoorbeeld bank, debiteuren, personeel), in gewone taal zonder vakjargon.
3. Per stuk in een paar woorden waarom we het nodig hebben, als dat niet vanzelf spreekt.
4. Hoe de klant de stukken kan aanleveren: [MANIER, bijv. via het klantportaal].

Maximaal 200 woorden. Onderteken met [NAAM].`,
      note: 'Werkt met de gratis Copilot Chat. Zet in de lijst niet meer klantgegevens dan nodig.',
      tip: 'Vraag daarna: "Maak er ook een korte herinnering van voor over twee weken."',
      added: '2026-10-19'
    },
    {
      id: 'kosten-vergelijken',
      title: 'Kosten vergelijken met vorig jaar',
      description: 'Copilot in Excel zet de grootste verschillen op een rij, met vragen om na te gaan.',
      phase: 'samenstellen',
      task: 'Analyseren',
      tool: 'Copilot in Excel',
      license: true,
      prompt: `Dit werkblad bevat de kostenposten van [ONDERNEMING] over [JAAR] en [VORIG JAAR] (kolommen: [KOLOMMEN, bijv. grootboekrekening, omschrijving, bedrag dit jaar, bedrag vorig jaar]).

1. Voeg kolommen toe met het verschil in euro's en in procenten.
2. Markeer de posten met een verschil groter dan [DREMPEL, bijv. € 5.000 of 20%].
3. Maak een overzicht van die posten, van groot naar klein verschil.
4. Geef per post één of twee mogelijke verklaringen die ik bij de klant kan navragen. Schrijf er "Navragen" bij: het zijn vragen, geen conclusies.

Laat de formules zien die je gebruikt.`,
      note: 'Gebruik Copilot in Excel met een licentie. Werk in een kopie of export, niet in het origineel.',
      tip: 'Zet de gegevens eerst als tabel (Ctrl+T): dan werkt Copilot in Excel het best.',
      added: '2026-10-19'
    },
    {
      id: 'mutaties-uitleggen',
      title: 'Grote veranderingen in gewone taal uitleggen',
      description: 'Voor het jaarrekeninggesprek: de belangrijkste veranderingen, begrijpelijk voor de ondernemer.',
      phase: 'samenstellen',
      task: 'Schrijven',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Ik voeg de concept jaarrekening [JAAR] van [ONDERNEMING] toe, met de vergelijkende cijfers van [VORIG JAAR].

Leg de vijf grootste veranderingen in resultaat en vermogen uit voor de directeur-grootaandeelhouder. Die is ondernemer, geen accountant.

Per verandering:
- Wat is er veranderd (bedrag en percentage)?
- Wat betekent dat in gewone woorden?
- Welke vraag kan ik de ondernemer erover stellen?

Gebruik alleen cijfers uit de jaarrekening en noem bij ieder bedrag de pagina. Dit is een samenstellingsopdracht: gebruik geen woorden als "controle" of "goedgekeurd".`,
      note: 'Werkt met de gratis Copilot Chat: voeg de jaarrekening toe met de paperclip.',
      tip: 'Vraag daarna: "Zet dit om in drie zinnen voor de begeleidende mail."',
      added: '2026-10-19'
    },
    {
      id: 'aangifte-checklist',
      title: 'Checklist voor de aangifte inkomstenbelasting',
      description: 'Een checklist op basis van de aangifte van vorig jaar en de nieuwe stukken.',
      phase: 'fiscaal',
      task: 'Controleren',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Ik bereid de aangifte inkomstenbelasting [JAAR] van een klant voor. Ik voeg toe: de aangifte van vorig jaar en de stukken die de klant dit jaar heeft aangeleverd. Namen en BSN heb ik weggelaten.

1. Maak een checklist van alle onderdelen uit de aangifte van vorig jaar (bijvoorbeeld inkomen, eigen woning, aftrekposten, box 3).
2. Geef per onderdeel aan of er dit jaar een stuk voor is aangeleverd: Ja, Nee of Onduidelijk.
3. Noem wat opvalt ten opzichte van vorig jaar: nieuwe of verdwenen onderdelen en grote verschillen.
4. Maak een lijst met vragen voor de klant over wat ontbreekt.

Noem geen fiscale regels of bedragen die niet in de stukken staan; schrijf "Nagaan" als iets uitgezocht moet worden.`,
      note: 'Werkt met de gratis Copilot Chat. Haal BSN en andere persoonsgegevens weg voordat je stukken toevoegt.',
      tip: 'Vraag daarna: "Zet de vragen voor de klant in een korte, vriendelijke mail."',
      added: '2026-10-19'
    },
    {
      id: 'adviesbrief-jaargesprek',
      title: 'Adviesbrief na het jaarrekeninggesprek',
      description: 'Van je gespreksnotities naar een heldere brief met adviezen en afspraken.',
      phase: 'advies',
      task: 'Schrijven',
      tool: 'Copilot in Word',
      license: true,
      prompt: `Ik voeg mijn aantekeningen toe van het jaarrekeninggesprek met [ONDERNEMING] op [DATUM].

Schrijf een brief aan [CONTACTPERSOON] met:
1. Een korte terugblik op het gesprek.
2. De besproken adviezen, ieder met: wat we adviseren, waarom en wat de volgende stap is.
3. De gemaakte afspraken in een tabel: wat, wie en wanneer.
4. Een afsluiting met de uitnodiging om te reageren.

Schrijf in begrijpelijke taal, zakelijk en vriendelijk, maximaal één A4. Gebruik alleen wat in mijn aantekeningen staat; zet [AANVULLEN] waar iets ontbreekt.`,
      note: 'Werkt in Copilot in Word met een licentie (verwijs met / naar je aantekeningen), of in Copilot Chat door de notities te plakken.',
      tip: 'Lees de adviezen goed na: een advies op papier weegt zwaarder dan in een gesprek.',
      added: '2026-10-19'
    },

    /* ---- De dertig bijgerechten uit de AI Snackbar (Bijgerecht 01 t/m 30) ------------- */
    {
      // Bijgerecht 01
      id: 'start-je-dag-met-een-mailboxoverzicht',
      title: 'Start je dag met een mailboxoverzicht',
      description: 'Laat Copilot je acties, deadlines en openstaande verzoeken uit recente e-mails verzamelen.',
      phase: 'eigen-werk',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer de e-mails die ik in de afgelopen [AANTAL] dagen heb ontvangen.

Neem uitsluitend e-mails op waarin:
- een actie of reactie van mij wordt gevraagd;
- een deadline wordt genoemd;
- ik een document moet beoordelen of aanleveren;
- een afspraak of toezegging aan mij is gekoppeld;
- een klant of collega op mijn reactie wacht;
- een klant stukken aanlevert of ik nog op stukken van een klant wacht (bijv. voor de jaarrekening, een aangifte of de controle).

Maak een tabel met:
1. Afzender
2. Onderwerp
3. Ontvangstdatum
4. Gevraagde actie
5. Deadline
6. Betrokken klant en opdracht (bijv. jaarrekening 2025 of aangifte IB)
7. Urgentie: hoog, middel of laag
8. Aanbevolen eerstvolgende stap

Sorteer eerst op verstreken deadlines, daarna op urgentie en vervolgens op ontvangstdatum.

Neem informatieve nieuwsbrieven, automatische notificaties en e-mails zonder actie voor mij niet op. Als een actie, deadline of klant niet expliciet uit de e-mail blijkt, vermeld dan "Niet benoemd".`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Controleer deadlines altijd even in de mail zelf.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 02
      id: 'alle-recente-e-mails-over-een-klant',
      title: 'Alle recente e-mails over één klant',
      description: 'Breng recente klantmails, afspraken en openstaande vragen samen in één overzicht.',
      phase: 'communicatie',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Zoek in mijn ontvangen en verzonden e-mails van de afgelopen [AANTAL] dagen naar berichten die betrekking hebben op [KLANTNAAM].

Maak een chronologisch overzicht van:
1. De belangrijkste besproken onderwerpen
2. Door de klant gestelde vragen
3. Door ons gestelde vragen
4. Toegezegde, aangeleverde en nog ontbrekende stukken (bijv. voor de jaarrekening of een aangifte)
5. Openstaande acties voor mij
6. Openstaande acties voor de klant
7. Genoemde deadlines
8. Punten waarover nog geen overeenstemming bestaat

Vermeld per onderwerp:
- datum van het meest recente bericht;
- afzender;
- e-mailonderwerp;
- huidige stand van zaken.

Gebruik uitsluitend informatie die expliciet in de e-mails staat. Presenteer aannames niet als feiten en markeer onduidelijke punten als "Nog te verifiëren".`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Schrijf de klantnaam zoals die in de mails staat.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 03
      id: 'welke-klantmails-wachten-nog-op-antwoord',
      title: 'Welke klantmails wachten nog op antwoord?',
      description: 'Vind klantmails waarop je waarschijnlijk nog moet reageren.',
      phase: 'communicatie',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer mijn ontvangen e-mails van de afgelopen [AANTAL] werkdagen.

Identificeer uitsluitend e-mails van klanten waarop naar verwachting nog een reactie van mij nodig is.

Controleer daarbij:
- of de afzender een vraag stelt;
- of om documenten, bevestiging of advies wordt gevraagd;
- of een beslissing of goedkeuring van mij wordt verwacht;
- of ik na ontvangst al een inhoudelijke reactie heb verzonden;
- of in een vervolgmail blijkt dat het verzoek inmiddels is afgehandeld.

Maak een tabel met:
1. Klant
2. Afzender
3. Onderwerp
4. Ontvangstdatum
5. Gevraagde reactie (bijv. vraag over de jaarrekening, een aangifte, de administratie of een advies)
6. Eventuele deadline
7. Reden waarom de e-mail nog open lijkt te staan
8. Concept voor de eerstvolgende actie

Neem een e-mail niet op als je niet kunt vaststellen dat een reactie nodig is. Benoem eventuele onzekerheid expliciet.`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Een antwoord buiten de mail om, zoals telefonisch, ziet Copilot niet.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 04
      id: 'van-een-e-mailthread-naar-een-volledig-overzicht',
      title: 'Van één e-mailthread naar een volledig overzicht',
      description: 'Laat een lange e-mailwisseling terugbrengen tot hoofdlijnen, afspraken en acties.',
      phase: 'communicatie',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer de volledige e-mailthread met als onderwerp "[ONDERWERP]".

Geef uitsluitend:
1. Aanleiding van de correspondentie
2. Belangrijkste feiten
3. Standpunten of vragen per betrokken partij
4. Gemaakte afspraken
5. Toegezegde documenten
6. Openstaande acties met verantwoordelijke
7. Genoemde deadlines en (fiscale) termijnen
8. Genoemde bedragen
9. Punten waarover nog onduidelijkheid bestaat

Sluit af met een samenvatting van maximaal vijf zinnen waarin je de actuele status van de e-mailwisseling beschrijft.

Baseer je uitsluitend op deze e-mailthread. Voeg geen informatie uit andere e-mails of documenten toe.`,
      note: 'Gebruik in Copilot Chat (tabblad Werk) of in Outlook met de mailwisseling geopend.',
      promptBasic: `Analyseer de e-mailwisseling die ik hieronder plak.

Geef uitsluitend:
1. Aanleiding van de correspondentie
2. Belangrijkste feiten
3. Standpunten of vragen per betrokken partij
4. Gemaakte afspraken
5. Toegezegde documenten
6. Openstaande acties met verantwoordelijke
7. Genoemde deadlines en (fiscale) termijnen
8. Genoemde bedragen
9. Punten waarover nog onduidelijkheid bestaat

Sluit af met een samenvatting van maximaal vijf zinnen waarin je de actuele status van de e-mailwisseling beschrijft.

Baseer je uitsluitend op deze e-mailwisseling. Voeg geen andere informatie toe.

E-mailwisseling:
[PLAK HIER DE VOLLEDIGE E-MAILWISSELING]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: kopieer de mailwisseling uit Outlook en plak die onderaan de prompt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 05
      id: 'beantwoord-een-uitgebreide-klantmail-punt-voor-punt',
      title: 'Beantwoord een uitgebreide klantmail punt voor punt',
      description: 'Laat Copilot een uitgebreide klantmail opsplitsen en punt voor punt beantwoorden.',
      phase: 'communicatie',
      task: 'Schrijven',
      tool: 'Copilot Chat (Werk)',
      license: true,
      promptLabel: 'Stap 1 · Alle punten op een rij',
      prompt: `Je bent accountant bij Visser & Visser. Analyseer de e-mail van [NAAM AFZENDER] over [ONDERWERP] van [DATUM].

Maak een genummerde lijst van iedere afzonderlijke:
- vraag;
- verzoek;
- deadline;
- toezegging;
- bijlage waarnaar wordt verwezen.

Geef per punt aan of het een vakinhoudelijke vraag is (bijv. over de jaarrekening, een aangifte of de administratie) of een praktische vraag.`,
      followUps: [
        { label: 'Stap 2 · Conceptantwoord', text: `Schrijf een professioneel conceptantwoord waarin ieder punt uit de lijst in dezelfde volgorde wordt behandeld.

Gebruik een vriendelijke en zakelijke toon. Houd het antwoord beknopt, maar volledig, en leg vaktermen kort uit. Voeg geen feiten, toezeggingen of deadlines toe die niet uit de e-mail of mijn onderstaande instructies blijken.

Aanvullende informatie voor het antwoord:
[VOEG HIER EVENTUELE INFORMATIE TOE]

Markeer ontbrekende informatie met [AANVULLEN] in plaats van deze zelf in te vullen.` }
      ],
      note: 'Gebruik in Copilot Chat (tabblad Werk) of in Outlook met de e-mail geopend. Lees het concept altijd na voordat je het verstuurt.',
      promptBasic: `Je bent accountant bij Visser & Visser. Analyseer de klantmail die ik hieronder plak.

Maak een genummerde lijst van iedere afzonderlijke:
- vraag;
- verzoek;
- deadline;
- toezegging;
- bijlage waarnaar wordt verwezen.

Geef per punt aan of het een vakinhoudelijke vraag is (bijv. over de jaarrekening, een aangifte of de administratie) of een praktische vraag.

E-mail:
[PLAK HIER DE E-MAIL]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: plak de e-mail onderaan de prompt. Lees het concept altijd na voordat je het verstuurt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 06
      id: 'maak-een-klantmail-korter-en-duidelijker',
      title: 'Maak een klantmail korter en duidelijker',
      description: 'Herschrijf je boodschap professioneel, vriendelijk en concreet.',
      phase: 'communicatie',
      task: 'Schrijven',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Herschrijf onderstaande conceptmail aan [KLANT OF ONTVANGER].

Doel van de mail:
[DOEL]

Gewenste actie van de ontvanger:
[ACTIE]

Gewenste deadline:
[DEADLINE]

Maak de mail:
- professioneel;
- vriendelijk;
- concreet;
- maximaal [AANTAL] woorden;
- voorzien van een duidelijke onderwerpregel;
- afgesloten met één concrete call-to-action.

Behoud alle feiten en inhoudelijke nuances. Voeg geen nieuwe toezeggingen of informatie toe. Vermijd lange inleidingen, herhaling, onnodig formele taal en vakjargon; leg een vakterm kort uit als die nodig is.

Conceptmail:
[PLAK CONCEPTMAIL]`,
      note: 'Werkt ook met de gratis Copilot Chat: plak je conceptmail onderaan de prompt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 07
      id: 'mijn-teams-acties-van-de-afgelopen-week',
      title: 'Mijn Teams-acties van de afgelopen week',
      description: 'Vind terug wat aan jou is gevraagd en wat je zelf hebt toegezegd.',
      phase: 'eigen-werk',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer mijn Teams-chats en Teams-kanaalberichten van de afgelopen [AANTAL] dagen.

Zoek uitsluitend naar berichten waarin:
- ik rechtstreeks word genoemd;
- een vraag aan mij wordt gesteld;
- een actie aan mij wordt toegewezen;
- ik zelf een toezegging doe;
- een deadline voor mij wordt genoemd;
- iemand op mijn reactie wacht.

Maak een tabel met:
1. Datum
2. Chat of kanaal
3. Betrokken personen en klant of opdracht
4. Actie voor mij
5. Deadline
6. Status voor zover uit de berichten blijkt
7. Link of duidelijke verwijzing naar het bronbericht

Sorteer op deadline en daarna op datum. Neem sociale berichten, algemene mededelingen en acties voor andere personen niet op. Als een deadline ontbreekt, vermeld dan "Niet benoemd".`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk).',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 08
      id: 'een-projectchat-omzetten-naar-een-actielijst',
      title: 'Eén projectchat omzetten naar een actielijst',
      description: 'Zet een drukke projectchat om in acties, eigenaren en deadlines.',
      phase: 'communicatie',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer de Teams-chat met de naam "[NAAM VAN DE CHAT, bijv. Jaarrekening 2025 Klant X]" over de periode [STARTDATUM] tot en met [EINDDATUM].

Maak een actielijst met:
1. Actie
2. Verantwoordelijke
3. Deadline
4. Huidige status
5. Datum waarop de actie is genoemd
6. Korte verwijzing naar het relevante bericht

Neem alleen acties op die expliciet zijn gevraagd, toegewezen of toegezegd.

Maak daarnaast afzonderlijke lijsten van:
- genomen besluiten;
- openstaande vragen;
- onderwerpen die nog moeten worden besproken.

Als verantwoordelijke, deadline of status niet duidelijk is, vermeld dan "Niet benoemd". Leid deze informatie niet zelf af.`,
      note: 'Gebruik in Copilot Chat (tabblad Werk) of in Teams, in de chat zelf.',
      promptBasic: `Analyseer de berichten uit een Teams-chat die ik hieronder plak.

Maak een actielijst met:
1. Actie
2. Verantwoordelijke
3. Deadline
4. Huidige status
5. Datum waarop de actie is genoemd
6. Korte verwijzing naar het relevante bericht

Neem alleen acties op die expliciet zijn gevraagd, toegewezen of toegezegd.

Maak daarnaast afzonderlijke lijsten van:
- genomen besluiten;
- openstaande vragen;
- onderwerpen die nog moeten worden besproken.

Als verantwoordelijke, deadline of status niet duidelijk is, vermeld dan "Niet benoemd". Leid deze informatie niet zelf af.

Chatberichten:
[PLAK HIER DE BERICHTEN UIT DE CHAT]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: selecteer de berichten in Teams, kopieer ze en plak ze onderaan de prompt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 09
      id: 'een-vergadering-samenvatten',
      title: 'Eén vergadering samenvatten',
      description: 'Laat Copilot besluiten, acties en openstaande vragen uit een vergadering halen.',
      phase: 'communicatie',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Maak een samenvatting van de vergadering "[NAAM VERGADERING]" op [DATUM].

Gebruik uitsluitend:
- de beschikbare transcriptie;
- de vergaderchat;
- gedeelde vergadernotities.

Structureer de uitkomst als volgt:
1. Doel van de vergadering
2. Belangrijkste besproken onderwerpen
3. Definitief genomen besluiten
4. Actiepunten met verantwoordelijke en deadline
5. Openstaande vragen
6. Verschillen van inzicht
7. Afspraken over aan te leveren stukken en termijnen
8. Afgesproken vervolg

Maak duidelijk of informatie afkomstig is uit de transcriptie, vergaderchat of notities.

Presenteer een voorstel of discussiepunt niet als besluit. Vermeld "Niet benoemd" wanneer een verantwoordelijke of deadline ontbreekt.`,
      note: 'Werkt alleen als de vergadering is opgenomen of getranscribeerd. Ook te gebruiken in Teams, bij de vergadering zelf.',
      promptBasic: `Maak een samenvatting van de vergadering "[NAAM VERGADERING]" op [DATUM].

Gebruik uitsluitend de transcriptie of notities die ik toevoeg.

Structureer de uitkomst als volgt:
1. Doel van de vergadering
2. Belangrijkste besproken onderwerpen
3. Definitief genomen besluiten
4. Actiepunten met verantwoordelijke en deadline
5. Openstaande vragen
6. Verschillen van inzicht
7. Afspraken over aan te leveren stukken en termijnen
8. Afgesproken vervolg

Presenteer een voorstel of discussiepunt niet als besluit. Vermeld "Niet benoemd" wanneer een verantwoordelijke of deadline ontbreekt.

Transcriptie of notities:
[PLAK HIER DE TEKST, OF VOEG HET BESTAND TOE]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: download de transcriptie uit Teams en voeg die toe, of plak je eigen notities.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 10
      id: 'bereid-mij-voor-op-mijn-volgende-klantafspraak',
      title: 'Bereid mij voor op mijn volgende klantafspraak',
      description: 'Verzamel vooraf de laatste ontwikkelingen, afspraken en openstaande acties.',
      phase: 'advies',
      task: 'Voorbereiden',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Bereid mij voor op mijn eerstvolgende vergadering met [KLANTNAAM].

Gebruik relevante informatie uit:
- de agenda-uitnodiging;
- e-mails met [KLANTNAAM] uit de afgelopen [AANTAL] dagen;
- eerdere vergaderingen met [KLANTNAAM] uit de afgelopen [AANTAL] maanden;
- relevante bestanden waarin [KLANTNAAM] wordt genoemd.

Geef:
1. Datum, tijd en onderwerp van de afspraak
2. Doel van de afspraak
3. Belangrijkste ontwikkelingen sinds het vorige overleg
4. Eerder gemaakte afspraken
5. Openstaande acties voor ons
6. Openstaande acties voor de klant, zoals nog aan te leveren stukken
7. Mogelijke knelpunten of onduidelijkheden
8. Vijf concrete vragen die ik tijdens de afspraak kan stellen
9. Een voorgestelde agenda voor het gesprek

Vermeld bij ieder feit de gebruikte bron. Maak onderscheid tussen bevestigde informatie en jouw suggesties voor gesprekspunten.`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk), bijvoorbeeld een dag voor de afspraak.',
      promptBasic: `Bereid mij voor op mijn afspraak met [KLANTNAAM] op [DATUM] over [ONDERWERP].

Gebruik uitsluitend de informatie die ik hieronder toevoeg:
- recente e-mails met [KLANTNAAM];
- notities van eerdere gesprekken;
- relevante documenten (als bijlage).

Geef:
1. Doel van de afspraak
2. Belangrijkste ontwikkelingen sinds het vorige overleg
3. Eerder gemaakte afspraken
4. Openstaande acties voor ons
5. Openstaande acties voor de klant, zoals nog aan te leveren stukken
6. Mogelijke knelpunten of onduidelijkheden
7. Vijf concrete vragen die ik tijdens de afspraak kan stellen
8. Een voorgestelde agenda voor het gesprek

Vermeld bij ieder feit de gebruikte bron. Maak onderscheid tussen bevestigde informatie en jouw suggesties voor gesprekspunten.

Informatie:
[PLAK HIER DE E-MAILS EN NOTITIES]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: plak de laatste mails en je notities, of voeg ze toe als bestand.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 11
      id: 'maak-een-agenda-vanuit-eerdere-communicatie',
      title: 'Maak een agenda vanuit eerdere communicatie',
      description: 'Maak van eerdere communicatie een doelgerichte agenda voor het volgende overleg.',
      phase: 'communicatie',
      task: 'Voorbereiden',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Stel een agenda op voor de komende vergadering "[NAAM VERGADERING, bijv. Bespreking jaarrekening 2025]" met [KLANT OF DEELNEMERS] op [DATUM].

Gebruik:
- de agenda-uitnodiging;
- relevante e-mails uit de afgelopen [AANTAL] weken;
- openstaande acties uit de vorige vergadering;
- documenten die expliciet voor deze vergadering zijn gedeeld.

Maak een agenda voor maximaal [DUUR] minuten, als tabel met:
1. Onderwerp
2. Doel van het agendapunt
3. Benodigde voorbereiding
4. Gewenste beslissing of uitkomst
5. Beschikbare tijd

Neem alleen onderwerpen op die uit de beschikbare informatie volgen. Plaats openstaande acties en beslispunten vooraan.`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Deel de agenda daarna met de deelnemers.',
      promptBasic: `Stel een agenda op voor de vergadering "[NAAM VERGADERING, bijv. Bespreking jaarrekening 2025]" met [KLANT OF DEELNEMERS] op [DATUM].

Gebruik uitsluitend de informatie die ik hieronder toevoeg:
- relevante e-mails;
- openstaande acties uit de vorige vergadering;
- documenten die voor deze vergadering zijn gedeeld (als bijlage).

Maak een agenda voor maximaal [DUUR] minuten, als tabel met:
1. Onderwerp
2. Doel van het agendapunt
3. Benodigde voorbereiding
4. Gewenste beslissing of uitkomst
5. Beschikbare tijd

Neem alleen onderwerpen op die uit de informatie volgen. Plaats openstaande acties en beslispunten vooraan.

Informatie:
[PLAK HIER DE E-MAILS EN ACTIEPUNTEN]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: plak de mails en actiepunten onderaan de prompt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 12
      id: 'verander-transcriptie-in-nette-notulen',
      title: 'Verander transcriptie in nette notulen',
      description: 'Zet een transcriptie om in professionele notulen met besluiten en actiepunten.',
      phase: 'communicatie',
      task: 'Schrijven',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Zet de transcriptie van de vergadering "[NAAM VERGADERING]" op [DATUM] om in professionele notulen.

Gebruik de volgende structuur:
1. Datum en onderwerp
2. Doel van de vergadering
3. Besproken onderwerpen in logische volgorde
4. Besluiten
5. Actiepunten
6. Openstaande vragen
7. Vervolgafspraak

Gebruik voor de actielijst een tabel met:
- Actie
- Verantwoordelijke
- Organisatie (wij of klant)
- Deadline
- Bronpassage of tijdstip

Verwijder herhalingen, stopwoorden en technische transcriptiefouten. Verander de inhoudelijke betekenis niet. Neem uitsluitend informatie op die uit de transcriptie blijkt.`,
      note: 'Werkt alleen als de vergadering is getranscribeerd. Controleer namen en besluiten voordat je de notulen deelt.',
      promptBasic: `Zet de bijgevoegde transcriptie van de vergadering "[NAAM VERGADERING]" op [DATUM] om in professionele notulen.

Gebruik de volgende structuur:
1. Datum en onderwerp
2. Doel van de vergadering
3. Besproken onderwerpen in logische volgorde
4. Besluiten
5. Actiepunten
6. Openstaande vragen
7. Vervolgafspraak

Gebruik voor de actielijst een tabel met:
- Actie
- Verantwoordelijke
- Organisatie (wij of klant)
- Deadline
- Bronpassage of tijdstip

Verwijder herhalingen, stopwoorden en technische transcriptiefouten. Verander de inhoudelijke betekenis niet. Neem uitsluitend informatie op die uit de transcriptie blijkt.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: download de transcriptie uit Teams en voeg die toe met de paperclip.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 13
      id: 'maak-een-klantoverzicht-uit-microsoft-365',
      title: 'Maak een klantoverzicht uit Microsoft 365',
      description: 'Breng recente communicatie, afspraken, documenten en deadlines samen.',
      phase: 'advies',
      task: 'Voorbereiden',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Maak een actueel klantoverzicht voor [KLANTNAAM].

Gebruik relevante informatie uit de afgelopen [AANTAL] maanden uit:
- e-mails;
- Teams-chats;
- vergaderingen;
- Word-, Excel-, PowerPoint- en PDF-bestanden.

Structureer het overzicht als volgt:
1. Kernactiviteiten van de klant
2. Belangrijkste contactpersonen en hun rol
3. Lopende opdrachten (bijv. samenstelling, controle, aangiften) en hun status
4. Recente ontwikkelingen
5. Openstaande vragen en acties
6. Belangrijke deadlines
7. Genoemde risico’s of knelpunten
8. Mogelijke advies- of gespreksonderwerpen
9. Documenten die waarschijnlijk relevant zijn voor vervolgwerkzaamheden

Vermeld per onderdeel de gebruikte bron en datum. Presenteer mogelijke adviesonderwerpen uitsluitend als suggesties. Neem geen informatie op waarvan de relatie met [KLANTNAAM] onzeker is.`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Copilot gebruikt alleen berichten en bestanden waar jij toegang toe hebt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 14
      id: 'bereid-een-eerste-gesprek-met-een-nieuwe-klant',
      title: 'Bereid een eerste gesprek met een nieuwe klant voor',
      description: 'Bereid een kennismakingsgesprek voor met bedrijfsinformatie en slimme vragen.',
      phase: 'advies',
      task: 'Voorbereiden',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Bereid een eerste kennismakingsgesprek voor met [BEDRIJFSNAAM].

Gebruik uitsluitend:
- de website van [BEDRIJFSNAAM];
- openbare informatie uit betrouwbare bronnen;
- documenten die ik in deze chat toevoeg.

Geef:
1. Korte beschrijving van de onderneming, met rechtsvorm en (voor zover openbaar) omvang en aantal medewerkers
2. Verdienmodel
3. Producten en diensten
4. Belangrijkste markten en klantgroepen
5. Recente publiek beschikbare ontwikkelingen
6. Mogelijke financiële en operationele aandachtspunten
7. Vijf branchespecifieke vragen
8. Vijf vragen over de administratie en financiële rapportage
9. Vijf vragen over toekomstplannen en adviesbehoeften

Vermeld voor iedere feitelijke constatering de bron. Maak duidelijk onderscheid tussen feiten, mogelijke aandachtspunten en vragen voor het gesprek.`,
      note: 'Werkt ook met de gratis Copilot Chat, met zoeken op internet aan. Controleer bedrijfsgegevens bij de bron, bijvoorbeeld de KvK.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 15
      id: 'signaleer-adviesmogelijkheden-uit-klantcontact',
      title: 'Signaleer adviesmogelijkheden uit klantcontact',
      description: 'Herken in klantcontact mogelijke signalen voor aanvullende dienstverlening.',
      phase: 'advies',
      task: 'Analyseren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer mijn e-mails en vergaderingen met [KLANTNAAM] uit de afgelopen [AANTAL] maanden.

Zoek naar expliciete signalen over:
- groei of krimp;
- financieringsbehoefte;
- liquiditeitsproblemen;
- personeelsgroei;
- investeringsplannen;
- bedrijfsopvolging;
- internationalisering;
- automatisering;
- veranderende rapportagebehoeften;
- fiscale of juridische vraagstukken;
- behoefte aan tussentijdse stuurinformatie.

Maak een tabel met:
1. Signaal
2. Letterlijke of zakelijke bronverwijzing
3. Datum
4. Mogelijke adviesvraag
5. Aanbevolen vervolgvraag aan de klant
6. Betrokken discipline

Presenteer dit als mogelijke gespreksonderwerpen, niet als vastgestelde commerciële kansen. Neem alleen signalen op die aantoonbaar uit de bronnen volgen.`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Let bij controleklanten op de onafhankelijkheidsregels voordat je aanvullend advies bespreekt.',
      promptBasic: `Analyseer de e-mails en gespreksnotities over [KLANTNAAM] die ik hieronder plak.

Zoek naar expliciete signalen over:
- groei of krimp;
- financieringsbehoefte;
- liquiditeitsproblemen;
- personeelsgroei;
- investeringsplannen;
- bedrijfsopvolging;
- internationalisering;
- automatisering;
- veranderende rapportagebehoeften;
- fiscale of juridische vraagstukken;
- behoefte aan tussentijdse stuurinformatie.

Maak een tabel met:
1. Signaal
2. Letterlijke of zakelijke bronverwijzing
3. Datum
4. Mogelijke adviesvraag
5. Aanbevolen vervolgvraag aan de klant
6. Betrokken discipline

Presenteer dit als mogelijke gespreksonderwerpen, niet als vastgestelde commerciële kansen. Neem alleen signalen op die aantoonbaar uit de tekst volgen.

E-mails en notities:
[PLAK HIER DE TEKST]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: plak de mails en notities onderaan. Let bij controleklanten op de onafhankelijkheidsregels.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 27
      id: 'leg-het-uit-in-begrijpelijke-taal',
      title: 'Leg het uit in begrijpelijke taal',
      description: 'Herschrijf een technische uitleg naar heldere taal voor je klant.',
      phase: 'advies',
      task: 'Schrijven',
      tool: 'Copilot Chat',
      license: false,
      promptLabel: 'Stap 1 · Herschrijven in begrijpelijke taal',
      prompt: `Je bent accountant en legt iets uit aan een klant. Herschrijf de tekst hieronder voor een ondernemer zonder financiële achtergrond.

Gebruik:
- taalniveau B1;
- korte zinnen;
- één concreet voorbeeld uit de praktijk van een ondernemer.

Laat alle bedragen, data en conclusies precies zoals ze zijn, en leg vaktermen uit in gewone woorden. Sluit af met maximaal drie punten: wat moet de klant doen of beslissen, en wanneer?

Tekst:
[PLAK HIER JE UITLEG, bijv. over de jaarrekening of een aangifte]`,
      followUps: [
        { label: 'Stap 2 · Optioneel: vragen van de klant voorzien', text: `Welke vragen zal de klant hier waarschijnlijk over stellen? Geef per vraag een kort antwoord, alleen op basis van de tekst.` }
      ],
      note: 'Werkt ook met de gratis Copilot Chat. Controleer altijd of de vakinhoud nog klopt voordat je de tekst naar een klant stuurt.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 16
      id: 'verken-een-omvangrijk-document',
      title: 'Verken één omvangrijk document',
      description: 'Haal de belangrijkste feiten, bedragen en aandachtspunten uit een omvangrijk document.',
      phase: 'samenstellen',
      task: 'Analyseren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer het bestand /[BESTANDSNAAM, bijv. een jaarverslag, taxatierapport of overeenkomst].

Maak een eerste verkenning met:
1. Doel en type document
2. Periode waarop het document betrekking heeft
3. Managementsamenvatting van maximaal 150 woorden
4. Belangrijkste bedragen
5. Belangrijkste data en deadlines
6. Verplichtingen per betrokken partij
7. Genoemde risico’s en onzekerheden
8. Onderdelen die financiële verwerking kunnen beïnvloeden
9. Vijf vragen voor nadere beoordeling
10. Relevante pagina- of paragraafverwijzingen

Gebruik uitsluitend dit bestand. Maak onderscheid tussen letterlijke documentinhoud en jouw interpretatie. Vermeld expliciet wanneer informatie niet in het document staat.`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies het bestand.',
      promptBasic: `Analyseer het bijgevoegde bestand [BESTANDSNAAM, bijv. een jaarverslag, taxatierapport of overeenkomst].

Maak een eerste verkenning met:
1. Doel en type document
2. Periode waarop het document betrekking heeft
3. Managementsamenvatting van maximaal 150 woorden
4. Belangrijkste bedragen
5. Belangrijkste data en deadlines
6. Verplichtingen per betrokken partij
7. Genoemde risico’s en onzekerheden
8. Onderdelen die financiële verwerking kunnen beïnvloeden
9. Vijf vragen voor nadere beoordeling
10. Relevante pagina- of paragraafverwijzingen

Gebruik uitsluitend dit bestand. Maak onderscheid tussen letterlijke documentinhoud en jouw interpretatie. Vermeld expliciet wanneer informatie niet in het document staat.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg het bestand toe met de paperclip.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 17
      id: 'vergelijk-concept-en-definitieve-versie',
      title: 'Vergelijk concept en definitieve versie',
      description: 'Vergelijk twee documentversies op bedragen, voorwaarden en inhoudelijke wijzigingen.',
      phase: 'samenstellen',
      task: 'Controleren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Vergelijk /[CONCEPTBESTAND] met /[DEFINITIEF BESTAND].

Identificeer alle inhoudelijk relevante wijzigingen in:
- bedragen;
- percentages;
- data;
- contractvoorwaarden;
- verantwoordelijkheden;
- conclusies;
- risico’s;
- toelichtingen;
- opgenomen of verwijderde paragrafen.

Presenteer de uitkomst in een tabel met:
1. Onderwerp
2. Tekst of informatie in de conceptversie
3. Tekst of informatie in de definitieve versie
4. Type wijziging
5. Mogelijke betekenis van de wijziging
6. Pagina of paragraaf in beide bestanden

Negeer wijzigingen die alleen opmaak, spelling of witruimte betreffen. Geef aan wanneer de mogelijke betekenis nader door een medewerker moet worden beoordeeld.`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies beide bestanden.',
      promptBasic: `Vergelijk de twee bijgevoegde bestanden: [CONCEPTBESTAND] (concept) en [DEFINITIEF BESTAND] (definitief).

Identificeer alle inhoudelijk relevante wijzigingen in:
- bedragen;
- percentages;
- data;
- contractvoorwaarden;
- verantwoordelijkheden;
- conclusies;
- risico’s;
- toelichtingen;
- opgenomen of verwijderde paragrafen.

Presenteer de uitkomst in een tabel met:
1. Onderwerp
2. Tekst of informatie in de conceptversie
3. Tekst of informatie in de definitieve versie
4. Type wijziging
5. Mogelijke betekenis van de wijziging
6. Pagina of paragraaf in beide bestanden

Negeer wijzigingen die alleen opmaak, spelling of witruimte betreffen. Geef aan wanneer de mogelijke betekenis nader door een medewerker moet worden beoordeeld.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg beide bestanden toe met de paperclip.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 18
      id: 'contract-samenvatten-voor-dossiergebruik',
      title: 'Contract samenvatten voor dossiergebruik',
      description: 'Breng verplichtingen, vergoedingen en bijzondere contractvoorwaarden snel in beeld.',
      phase: 'samenstellen',
      task: 'Samenvatten',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer het contract /[BESTANDSNAAM] voor [KLANTNAAM].

Maak een zakelijke samenvatting met:
1. Contractpartijen
2. Ingangsdatum
3. Looptijd
4. Verlengingsvoorwaarden
5. Opzegvoorwaarden
6. Producten of diensten
7. Vergoedingen en betalingsmomenten
8. Prestatieverplichtingen
9. Kortingen, bonussen of variabele vergoedingen
10. Garanties
11. Boetes en aansprakelijkheid
12. Bijzondere of afwijkende voorwaarden
13. Financieel relevante bepalingen
14. Vragen voor nadere beoordeling

Verwijs per onderdeel naar het relevante artikel of paginanummer. Gebruik uitsluitend het contract. Geef geen juridische of verslaggevingstechnische conclusie zonder een afzonderlijke bronbeoordeling.`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies het contract. Gebruik de uitkomst als werkdocument, niet als juridisch oordeel.',
      promptBasic: `Analyseer het bijgevoegde contract [BESTANDSNAAM] voor [KLANTNAAM].

Maak een zakelijke samenvatting met:
1. Contractpartijen
2. Ingangsdatum
3. Looptijd
4. Verlengingsvoorwaarden
5. Opzegvoorwaarden
6. Producten of diensten
7. Vergoedingen en betalingsmomenten
8. Prestatieverplichtingen
9. Kortingen, bonussen of variabele vergoedingen
10. Garanties
11. Boetes en aansprakelijkheid
12. Bijzondere of afwijkende voorwaarden
13. Financieel relevante bepalingen
14. Vragen voor nadere beoordeling

Verwijs per onderdeel naar het relevante artikel of paginanummer. Gebruik uitsluitend het contract. Geef geen juridische of verslaggevingstechnische conclusie zonder een afzonderlijke bronbeoordeling.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg het contract toe met de paperclip. Gebruik de uitkomst als werkdocument, niet als juridisch oordeel.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 19
      id: 'maak-een-conceptprocesbeschrijving',
      title: 'Maak een conceptprocesbeschrijving',
      description: 'Zet interviewnotities om in een eerste, logisch opgebouwde procesbeschrijving.',
      phase: 'administratie',
      task: 'Schrijven',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Zet de notities in /[BESTANDSNAAM] om in een conceptprocesbeschrijving van het proces [PROCESNAAM] bij [KLANTNAAM].

Gebruik de structuur:
1. Doel en afbakening
2. Startpunt van het proces
3. Betrokken functies
4. Gebruikte systemen
5. Chronologische processtappen
6. Invoer en bewijsstukken
7. Registraties en boekingen
8. Controles en reviews
9. Afhandeling van uitzonderingen
10. Rapportages
11. Einde van het proces
12. Ontbrekende of onduidelijke informatie

Beschrijf per beheersingsmaatregel:
- wie de controle uitvoert;
- wat wordt gecontroleerd;
- wanneer en hoe vaak;
- welke documentatie ontstaat;
- wie afwijkingen opvolgt.

Voeg geen processtappen of beheersingsmaatregelen toe die niet uit de bron blijken. Markeer ontbrekende informatie met [NADER UITVRAGEN].`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies het bestand met je notities. Laat de beschrijving daarna bevestigen door de klant.',
      promptBasic: `Zet de notities in het bijgevoegde bestand [BESTANDSNAAM] om in een conceptprocesbeschrijving van het proces [PROCESNAAM] bij [KLANTNAAM].

Gebruik de structuur:
1. Doel en afbakening
2. Startpunt van het proces
3. Betrokken functies
4. Gebruikte systemen
5. Chronologische processtappen
6. Invoer en bewijsstukken
7. Registraties en boekingen
8. Controles en reviews
9. Afhandeling van uitzonderingen
10. Rapportages
11. Einde van het proces
12. Ontbrekende of onduidelijke informatie

Beschrijf per beheersingsmaatregel:
- wie de controle uitvoert;
- wat wordt gecontroleerd;
- wanneer en hoe vaak;
- welke documentatie ontstaat;
- wie afwijkingen opvolgt.

Voeg geen processtappen of beheersingsmaatregelen toe die niet uit de bron blijken. Markeer ontbrekende informatie met [NADER UITVRAGEN].`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg het bestand met je notities toe met de paperclip.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 20
      id: 'review-een-conceptverslag',
      title: 'Review een conceptverslag',
      description: 'Laat zwakke redeneringen, onduidelijkheden en ontbrekende onderbouwing vooraf signaleren.',
      phase: 'samenstellen',
      task: 'Controleren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      promptLabel: 'Stap 1 · Kritisch reviewen',
      prompt: `Review /[BESTANDSNAAM, bijv. een adviesrapport, managementletter of toelichting bij de jaarrekening] als kritische vakinhoudelijke tweede lezer, zoals een ervaren collega-accountant dat zou doen.

Beoordeel het document op:
- logische opbouw;
- duidelijkheid;
- volledigheid;
- tegenstrijdigheden;
- bedragen en percentages die niet overeenkomen tussen tekst en tabellen;
- ononderbouwde aannames;
- conclusies die niet aansluiten op de beschreven feiten;
- ontbrekende bronverwijzingen;
- te stellige formuleringen;
- onduidelijke acties of verantwoordelijkheden;
- taal en professionaliteit.

Maak een tabel met:
1. Pagina of paragraaf
2. Oorspronkelijke passage
3. Type verbeterpunt
4. Waarom dit aandacht vraagt
5. Voorstel voor verbetering

Wijzig nog niets aan het document.`,
      followUps: [
        { label: 'Stap 2 · Passages herschrijven', text: `Maak nu uitsluitend een herschreven versie van de passages waarvoor aanpassing nodig is. Zet per passage de oorspronkelijke en de herschreven tekst onder elkaar. Wijzig geen feiten, bedragen of vaktechnische conclusies.` }
      ],
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies je conceptverslag. Jij beslist welke verbeteringen je overneemt.',
      promptBasic: `Review het bijgevoegde bestand [BESTANDSNAAM, bijv. een adviesrapport, managementletter of toelichting bij de jaarrekening] als kritische vakinhoudelijke tweede lezer, zoals een ervaren collega-accountant dat zou doen.

Beoordeel het document op:
- logische opbouw;
- duidelijkheid;
- volledigheid;
- tegenstrijdigheden;
- bedragen en percentages die niet overeenkomen tussen tekst en tabellen;
- ononderbouwde aannames;
- conclusies die niet aansluiten op de beschreven feiten;
- ontbrekende bronverwijzingen;
- te stellige formuleringen;
- onduidelijke acties of verantwoordelijkheden;
- taal en professionaliteit.

Maak een tabel met:
1. Pagina of paragraaf
2. Oorspronkelijke passage
3. Type verbeterpunt
4. Waarom dit aandacht vraagt
5. Voorstel voor verbetering

Wijzig nog niets aan het document.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg je conceptverslag toe met de paperclip.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 26
      id: 'vind-dat-ene-document-of-besluit-terug',
      title: 'Vind dat ene document of besluit terug',
      description: 'Laat Copilot dat ene document, besluit of bericht terugvinden in je mail, Teams en bestanden.',
      phase: 'eigen-werk',
      task: 'Voorbereiden',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Zoek in mijn e-mails, Teams-chats en bestanden van de afgelopen [AANTAL] maanden naar [ONDERWERP, bijv. de afspraken met [KLANTNAAM] over het aanleveren van de jaarstukken].

Geef de vijf meest relevante resultaten, met per resultaat:
1. Onderwerp of bestandsnaam
2. Datum
3. Afzender of maker
4. In één zin waarom het relevant is
5. Link naar het bericht of bestand

Neem alleen resultaten op die aantoonbaar over [ONDERWERP] gaan. Vind je niets, zeg dat dan in plaats van iets te benaderen.`,
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Hoe specifieker het onderwerp, hoe beter het resultaat.',
      tip: 'Weet je nog ongeveer wie het stuurde? Voeg dan toe: "van [NAAM COLLEGA]". Dat scheelt veel zoekwerk.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 21
      id: 'formule-maken-voor-een-concrete-excel-tabel',
      title: 'Formule maken voor een concrete Excel-tabel',
      description: 'Laat Copilot de formule maken, uitleggen en voorzien van een controle.',
      phase: 'administratie',
      task: 'Analyseren',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Ik werk in Excel met een tabel genaamd [TABELNAAM].

De relevante kolommen zijn:
- [KOLOM 1]
- [KOLOM 2]
- [KOLOM 3]

Ik wil per regel het volgende berekenen:
[GEWENSTE BEREKENING, bijv. het aantal dagen na de vervaldatum of het btw-bedrag bij een bedrag inclusief btw]

Schrijf:
1. De exacte Excel-formule met gestructureerde tabelverwijzingen
2. Een versie met normale celverwijzingen
3. Een korte uitleg van ieder onderdeel
4. Een fictief rekenvoorbeeld
5. Een controle waarmee ik kan vaststellen dat de formule correct werkt
6. Een oplossing voor lege cellen en foutmeldingen

Gebruik functienamen en scheidingstekens die passen bij mijn [NEDERLANDSE/ENGELSE] Excel-versie (bij Nederlandse instellingen een puntkomma tussen de argumenten).`,
      note: 'Werkt in elke Copilot Chat, ook de gratis versie, of in Copilot in Excel met de tabel geopend.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 22
      id: 'vergelijk-twee-financiele-perioden',
      title: 'Vergelijk twee financiële perioden',
      description: 'Vergelijk twee perioden en laat de grootste en opvallendste verschillen signaleren.',
      phase: 'samenstellen',
      task: 'Analyseren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer de tabel in /[EXCELBESTAND].

Vergelijk [PERIODE A] met [PERIODE B] op basis van de kolommen:
- [REKENING OF CATEGORIE]
- [BEDRAG PERIODE A]
- [BEDRAG PERIODE B]

Bereken per regel:
1. Absoluut verschil
2. Procentueel verschil
3. Aandeel in het totaal van beide perioden

Identificeer vervolgens:
- de tien grootste absolute mutaties;
- mutaties groter dan [BEDRAG];
- mutaties groter dan [PERCENTAGE]%;
- nieuwe posten;
- verdwenen posten;
- tekenwisselingen;
- ontbrekende of ongeldige waarden.

Maak een tabel met de resultaten en formuleer per opvallende mutatie één neutrale onderzoeksvraag. Presenteer geen verklaringen als feit; noem een mogelijke verklaring alleen als hypothese die nog moet worden geverifieerd.`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies het Excelbestand. Controleer enkele berekeningen zelf.',
      promptBasic: `Analyseer de tabel in het bijgevoegde bestand [EXCELBESTAND].

Vergelijk [PERIODE A] met [PERIODE B] op basis van de kolommen:
- [REKENING OF CATEGORIE]
- [BEDRAG PERIODE A]
- [BEDRAG PERIODE B]

Bereken per regel:
1. Absoluut verschil
2. Procentueel verschil
3. Aandeel in het totaal van beide perioden

Identificeer vervolgens:
- de tien grootste absolute mutaties;
- mutaties groter dan [BEDRAG];
- mutaties groter dan [PERCENTAGE]%;
- nieuwe posten;
- verdwenen posten;
- tekenwisselingen;
- ontbrekende of ongeldige waarden.

Maak een tabel met de resultaten en formuleer per opvallende mutatie één neutrale onderzoeksvraag. Presenteer geen verklaringen als feit; noem een mogelijke verklaring alleen als hypothese die nog moet worden geverifieerd.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg het Excelbestand toe met de paperclip. Controleer enkele berekeningen zelf.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 23
      id: 'openstaande-posten-prioriteren',
      title: 'Openstaande posten prioriteren',
      description: 'Prioriteer openstaande posten op bedrag, ouderdom en afwijkende kenmerken.',
      phase: 'administratie',
      task: 'Analyseren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Analyseer de openstaande-postenlijst in /[EXCELBESTAND] per [PEILDATUM].

Gebruik minimaal de kolommen:
- Relatie
- Factuurnummer
- Factuurdatum
- Vervaldatum
- Openstaand bedrag

Bereken per post:
1. Aantal dagen openstaand
2. Aantal dagen na vervaldatum
3. Ouderdomscategorie: niet vervallen, 1 tot 30, 31 tot 60, 61 tot 90 of meer dan 90 dagen
4. Totaal openstaand per relatie

Signaleer:
- posten ouder dan [AANTAL] dagen;
- posten groter dan [BEDRAG];
- creditbedragen;
- dubbele factuurnummers;
- relaties met meerdere oude posten;
- ontbrekende factuur- of vervaldata.

Maak drie categorieën:
1. Direct opvolgen
2. Nader beoordelen
3. Reguliere opvolging

Leg de indelingscriteria uit. Trek geen conclusie over inbaarheid zonder aanvullende informatie.`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies de openstaande-postenlijst. Controleer enkele uitkomsten zelf.',
      promptBasic: `Analyseer de openstaande-postenlijst in het bijgevoegde bestand [EXCELBESTAND] per [PEILDATUM].

Gebruik minimaal de kolommen:
- Relatie
- Factuurnummer
- Factuurdatum
- Vervaldatum
- Openstaand bedrag

Bereken per post:
1. Aantal dagen openstaand
2. Aantal dagen na vervaldatum
3. Ouderdomscategorie: niet vervallen, 1 tot 30, 31 tot 60, 61 tot 90 of meer dan 90 dagen
4. Totaal openstaand per relatie

Signaleer:
- posten ouder dan [AANTAL] dagen;
- posten groter dan [BEDRAG];
- creditbedragen;
- dubbele factuurnummers;
- relaties met meerdere oude posten;
- ontbrekende factuur- of vervaldata.

Maak drie categorieën:
1. Direct opvolgen
2. Nader beoordelen
3. Reguliere opvolging

Leg de indelingscriteria uit. Trek geen conclusie over inbaarheid zonder aanvullende informatie.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg de openstaande-postenlijst toe met de paperclip. Controleer enkele uitkomsten zelf.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 24
      id: 'databestand-controleren-op-afwijkingen',
      title: 'Databestand controleren op afwijkingen',
      description: 'Signaleer dubbele, ontbrekende en opvallende transacties in een gegevensbestand.',
      phase: 'administratie',
      task: 'Controleren',
      tool: 'Copilot Chat (Werk)',
      license: true,
      prompt: `Controleer de tabel in /[EXCELBESTAND] op mogelijke datakwaliteitsproblemen en afwijkende transacties.

Gebruik de volgende kolommen:
[NOEM DE RELEVANTE KOLOMMEN]

Controleer specifiek op:
- exacte dubbelen;
- dubbele document- of factuurnummers;
- ontbrekende waarden;
- ongeldige datums;
- boekingen buiten de periode [STARTDATUM] tot en met [EINDDATUM];
- negatieve bedragen;
- ronde bedragen vanaf [BEDRAG];
- bedragen groter dan [GRENSBEDRAG];
- ongebruikelijke boekingstijdstippen;
- afwijkende of lege omschrijvingen;
- inconsistente namen of coderingen;
- onverwachte combinaties van rekening en omschrijving.

Maak een overzicht per type signaal met:
1. Aantal signalen
2. Betrokken regels
3. Waarom het signaal opvalt
4. Aanbevolen vervolgstap

Noem dit uitsluitend signalen voor nader onderzoek. Trek geen conclusie over fouten of fraude.`,
      note: 'Typ / in Copilot Chat (tabblad Werk) en kies het Excelbestand. Signalen zijn een startpunt voor onderzoek, geen bevinding.',
      promptBasic: `Controleer de tabel in het bijgevoegde bestand [EXCELBESTAND] op mogelijke datakwaliteitsproblemen en afwijkende transacties.

Gebruik de volgende kolommen:
[NOEM DE RELEVANTE KOLOMMEN]

Controleer specifiek op:
- exacte dubbelen;
- dubbele document- of factuurnummers;
- ontbrekende waarden;
- ongeldige datums;
- boekingen buiten de periode [STARTDATUM] tot en met [EINDDATUM];
- negatieve bedragen;
- ronde bedragen vanaf [BEDRAG];
- bedragen groter dan [GRENSBEDRAG];
- ongebruikelijke boekingstijdstippen;
- afwijkende of lege omschrijvingen;
- inconsistente namen of coderingen;
- onverwachte combinaties van rekening en omschrijving.

Maak een overzicht per type signaal met:
1. Aantal signalen
2. Betrokken regels
3. Waarom het signaal opvalt
4. Aanbevolen vervolgstap

Noem dit uitsluitend signalen voor nader onderzoek. Trek geen conclusie over fouten of fraude.`,
      noteBasic: 'Werkt met de gratis Copilot Chat: voeg het Excelbestand toe met de paperclip. Signalen zijn een startpunt voor onderzoek, geen bevinding.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 28
      id: 'schrijf-een-toelichting-bij-de-cijfers',
      title: 'Schrijf een toelichting bij de cijfers',
      description: 'Laat Copilot een korte, heldere toelichting schrijven bij een tabel met cijfers.',
      phase: 'samenstellen',
      task: 'Schrijven',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Analyseer de tabel in het bijgevoegde bestand [EXCELBESTAND].

Schrijf een toelichting van maximaal 150 woorden voor de klant, met:
1. De drie belangrijkste ontwikkelingen
2. De oorzaak, voor zover die uit de cijfers blijkt
3. Waar de klant op moet letten

Gebruik alleen bedragen en percentages die in de tabel staan. Laat bij iedere berekening zien hoe je eraan komt. Presenteer een mogelijke oorzaak die niet uit de cijfers blijkt als vraag, niet als feit.`,
      note: 'Werkt ook met de gratis Copilot Chat: voeg het bestand toe met de paperclip. Controleer de bedragen altijd zelf.',
      tip: 'Te formeel? Vraag: "Maak het korter en persoonlijker, als alinea in een e-mail."',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 25
      id: 'maak-een-persoonlijke-weekplanning-uit-werkgegevens',
      title: 'Maak een persoonlijke weekplanning uit werkgegevens',
      description: 'Breng afspraken, acties en deadlines samen in een haalbaar weekvoorstel.',
      phase: 'eigen-werk',
      task: 'Plannen',
      tool: 'Copilot Chat (Werk)',
      license: true,
      promptLabel: 'Stap 1 · Takenlijst uit je werkgegevens',
      prompt: `Maak een overzicht van mijn taken voor de werkweek van [STARTDATUM] tot en met [EINDDATUM].

Gebruik:
- mijn agenda voor deze periode;
- acties uit mijn ontvangen e-mails van de afgelopen [AANTAL] dagen;
- acties die in mijn Teams-chats aan mij zijn toegewezen;
- expliciet genoemde deadlines, zoals aangifte- en deponeringstermijnen;
- openstaande toezeggingen die ik zelf heb gedaan, bijvoorbeeld aan klanten.

Maak een tabel met:
1. Taak
2. Herkomst: e-mail, Teams of vergadering
3. Betrokken klant of opdracht
4. Deadline
5. Verwachte duur, alleen wanneer deze expliciet beschikbaar is
6. Urgentie
7. Bronverwijzing

Als de benodigde duur niet bekend is, vermeld dan "Zelf inschatten".`,
      followUps: [
        { label: 'Stap 2 · Voorstel per werkdag', text: `Maak van deze takenlijst een voorstel per werkdag.

Plan:
- taken met een harde deadline eerst;
- voorbereiding vóór de relevante vergadering of klantbespreking;
- voldoende ruimte tussen afspraken;
- geen werkzaamheden op reeds bezette momenten.

Presenteer de planning als voorstel en verander geen afspraken in mijn agenda.` }
      ],
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Zet de blokken daarna zelf in je agenda.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 29
      id: 'plan-terug-vanaf-een-deadline',
      title: 'Plan terug vanaf een deadline',
      description: 'Maak vanaf een harde deadline een haalbare terugrekenplanning met buffer.',
      phase: 'eigen-werk',
      task: 'Plannen',
      tool: 'Copilot Chat (Werk)',
      license: true,
      promptLabel: 'Stap 1 · Terugrekenplanning',
      prompt: `Ik moet [OPDRACHT, bijv. een conceptjaarrekening] uiterlijk [DATUM] opleveren.

Maak een terugrekenplanning vanaf die deadline:
- verdeel het werk in logische stappen (bijv. stukken opvragen, verwerken, review, bespreking met de klant);
- geef per stap een tijdsinschatting en de datum waarop die stap uiterlijk klaar moet zijn;
- plan minimaal twee werkdagen buffer in;
- houd rekening met de afspraken die al in mijn agenda staan.

Zet het in een tabel met:
1. Stap
2. Tijd
3. Uiterlijk klaar
4. Wat ik nodig heb van anderen

Presenteer de planning als voorstel en verander geen afspraken in mijn agenda.`,
      followUps: [
        { label: 'Stap 2 · Optioneel: mail aan je team', text: `Maak hier een korte mail van aan mijn team met wat ik van wie nodig heb, en wanneer.` }
      ],
      note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Controleer de planning en zet de blokken daarna zelf in je agenda.',
      promptBasic: `Ik moet [OPDRACHT, bijv. een conceptjaarrekening] uiterlijk [DATUM] opleveren.

Maak een terugrekenplanning vanaf die deadline:
- verdeel het werk in logische stappen (bijv. stukken opvragen, verwerken, review, bespreking met de klant);
- geef per stap een tijdsinschatting en de datum waarop die stap uiterlijk klaar moet zijn;
- plan minimaal twee werkdagen buffer in;
- houd rekening met mijn vaste afspraken hieronder.

Zet het in een tabel met:
1. Stap
2. Tijd
3. Uiterlijk klaar
4. Wat ik nodig heb van anderen

Presenteer de planning als voorstel.

Mijn vaste afspraken in deze periode:
[NOEM PER AFSPRAAK DE DATUM, TIJD EN OMSCHRIJVING]`,
      noteBasic: 'Werkt met de gratis Copilot Chat: noem zelf je vaste afspraken. Copilot kijkt dan niet in je agenda en plant niets in.',
      added: '2026-10-28'
    },
    {
      // Bijgerecht 30
      id: 'maak-een-checklist-van-een-terugkerende-taak',
      title: 'Maak een checklist van een terugkerende taak',
      description: 'Zet je eigen werkwijze om in een afvinkbare checklist, zodat je niets vergeet.',
      phase: 'eigen-werk',
      task: 'Plannen',
      tool: 'Copilot Chat',
      license: false,
      prompt: `Ik voer deze taak regelmatig uit: [BESCHRIJF DE TAAK, bijv. het afronden van een btw-aangifte].

Maak van mijn aantekeningen hieronder een afvinkbare checklist in een logische volgorde. Zet bij iedere stap:
- wat ik controleer;
- wat ik vastleg.

Markeer de stappen waar vaak iets misgaat en stel voor hoe ik dat voorkom. Is iets onduidelijk, stel me dan eerst een vraag.

Aantekeningen:
[PLAK HIER JE AANTEKENINGEN OF WERKINSTRUCTIE]`,
      note: 'Werkt ook met de gratis Copilot Chat. Leg de checklist daarna naast de kantoorrichtlijnen.',
      tip: 'Bewaar de checklist in OneNote of Loop. Dan vink je hem iedere keer af en verbeter je hem samen met je team.',
      added: '2026-10-28'
    }
  ],

  /* ---- Trainingen ------------------------------------------------------------------- */
  // Het naslagwerk van de ochtendsessie van de Boost & Learn (26 oktober 2026). Het volledige
  // naslagwerk (alle slides, de Mentimeter-uitkomsten en de 21 groepsideeën) is alleen voor
  // intern gebruik en staat versleuteld op de snackbar; deze site is openbaar. Hier dus alleen
  // wat voor iedereen mag: 19 van de 27 slides (zonder het programma, de Mentimeter-codes, de
  // opdrachtinstructie en het scherm van het ideeënloket), en de inbreng van collega's in
  // algemene vorm. De videosamenvatting (5 minuten) staat er wel: bewust gekozen, achter het
  // slot met de pincode (js/lock.js). Wie het adres van het bestand kent, kan hem openen.
  trainings: [
    {
      id: 'van-ai-hype-naar-toepassing',
      title: 'Van AI-hype naar toepassing',
      subtitle: 'Boost & Learn: de ochtendsessie van de discipline Accountancy',
      date: '2026-10-26',
      category: 'Boost & Learn',
      level: 'Starter',
      license: false,
      description: 'Wat betekent AI voor ons vak, onze dienstverlening en onze ontwikkeling? Bekijk de slides terug en lees wat je meeneemt: kalibreren, wat wel en niet mag met gegevens, de beste ideeën uit de praktijksessie en hoe je morgen verder kunt.',
      video: 'assets/trainingen/van-ai-hype-naar-toepassing/sessie-in-5-minuten.mp4',
      poster: 'assets/trainingen/van-ai-hype-naar-toepassing/sessie-in-5-minuten.jpg',
      chapters: [
        { time: '0:00', title: 'Opening' },
        { time: '0:57', title: 'Buitenwereld' },
        { time: '2:05', title: 'Organisatiekoers' },
        { time: '3:41', title: 'Praktijkervaring' },
        { time: '3:55', title: 'Disciplinestrategie' },
        { time: '4:27', title: 'Leerlijn' }
      ],
      materials: [
        { label: 'Het volledige naslagwerk, met alle ideeën (open de link uit het Teams-bericht)', href: 'https://joostprinsvv.github.io/AI-snackbar-platform/boost-learn-ai.html' }
      ],
      usecases: ['weekplanning', 'icbo-jaarrekening', 'klantoverleg', 'klantpresentatie', 'klantgesprek-voorbereiden', 'contract-vertalen'],
      tips: ['schildje', 'controleren'],
      added: '2026-10-28',

      slides: [
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-01.jpg', title: 'Van AI-hype naar toepassing' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-02.jpg', title: 'Waarom deze sessie?' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-03.jpg', title: 'De route van vandaag' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-04.jpg', title: 'Wat gebeurt er in de wereld?' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-05.jpg', title: 'Van techniek naar toepassing' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-06.jpg', title: 'Zo werkt kalibreren in de praktijk' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-07.jpg', title: 'Onze uitgangspunten' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-08.jpg', title: 'Wie willen wij blijven?' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-09.jpg', title: 'Vier soorten gegevens' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-10.jpg', title: 'Een simpele vuistregel en ons beleid' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-11.jpg', title: 'Ethiek' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-12.jpg', title: 'De drie domeinen' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-13.jpg', title: 'Werkwijze in zes stappen' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-14.jpg', title: 'AI Snackbar' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-15.jpg', title: 'Wat hebben we geleerd?' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-16.jpg', title: 'De koers voor Accountancy' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-17.jpg', title: 'Van bewustwording naar ontwikkeling' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-18.jpg', title: 'Jouw eerste stap' },
        { image: 'assets/trainingen/van-ai-hype-naar-toepassing/slide-19.jpg', title: 'Afsluiting' }
      ],

      takeaways: [
        { title: 'Versnellen en verbeteren: ja. Vervangen: nee.', text: 'Routinewerk sneller en met minder fouten, betere analyses, hogere kwaliteit en rijker advies. Het professionele oordeel blijft altijd bij de mens.' },
        { title: 'AI is geen technologieproject, maar onderdeel van onze dienstverlening.', text: 'AI raakt administratie, samenstellen én advies. De vraag is niet óf ons vak verandert, maar hoe wij daar richting aan geven.' },
        { title: 'Kalibreren: vertrouwen waar het kan, controleren waar het moet.', text: 'Je hoeft niet te weten hoe AI werkt. Wel wát er beschikbaar is, wannéér je het gebruikt en wanneer je moet contróleren. AI levert snel iets op dat er af uitziet; het vakmanschap zit in kritisch kijken en bijsturen.' },
        { title: 'Klant- en persoonsgegevens alleen in Copilot, met je werkaccount.', text: 'Vuistregel: zou je het niet hardop vertellen op een verjaardag? Zet het dan ook niet zomaar in een AI-tool.', warning: true },
        { title: 'AI ondersteunt, de professional beslist.', text: 'AI zoekt, ordent, vat samen en signaleert. Jij beoordeelt, kalibreert, tekent en adviseert. We zijn transparant over waar AI is gebruikt, kunnen elke uitkomst verantwoorden en werken binnen de kaders voor data.' }
      ],

      actions: [
        {
          title: 'Maak je "Morgen ga ik…" concreet en zet het in je agenda',
          text: 'Eén toepassing, klein genoeg om morgen te doen. Schrijf het op, deel het met een collega en plan nu al het moment om het te proberen.',
          slide: 18
        },
        {
          title: 'Proef één snack',
          text: 'De zes snacks van de AI Snackbar staan bij Usecases, ieder met de demo en de prompts. Begin met een snack op niveau Starter, bijvoorbeeld "Van overleg naar actielijst".',
          slide: 14
        },
        {
          title: 'Check de soort gegevens vóór je iets in een AI-tool zet',
          text: 'Hoe gevoeliger de gegevens, hoe voorzichtiger. Bij twijfel: niet doen, of vraag het de interne helpdesk.',
          slide: 9,
          more: 'Vier soorten gegevens en ons beleid',
          howto: [
            { title: 'Vier soorten gegevens', steps: [
              'Openbaar (mag overal): algemene informatie, gepubliceerde teksten, openbare cijfers.',
              'Persoonsgegevens (voorzichtig): namen, BSN, e-mailadressen. Alleen in de veilige Microsoft 365-omgeving.',
              'Vertrouwelijk klantmateriaal (extra alert): dossiers, contracten, financiële details van klanten.',
              'Hoog-risico (niet delen): zeer gevoelige of beschermde informatie. Bij twijfel: niet doen.'
            ] },
            { title: 'Het beleid van Visser & Visser', steps: [
              'Gebruik Copilot alleen met je werkaccount in de Microsoft 365-omgeving.',
              'Geen klant- of persoonsgegevens in openbare AI-tools zoals ChatGPT, Claude of Gemini.',
              'Blijf zelf verantwoordelijk voor wat je gebruikt en verstuurt.',
              'Twijfel je? Vraag het de interne helpdesk. Liever één keer te vaak.'
            ] }
          ],
          note: 'De vuistregel: welke feiten zou jij wél delen op een verjaardag?'
        },
        {
          title: 'Kalibreer bewust',
          text: 'Lees de uitkomst na zoals je het werk van een nieuwe junior beoordeelt: wat klopt, wat is aangenomen of verzonnen?',
          slide: 6,
          howto: [
            { title: 'Zo werkt kalibreren', steps: [
              'Opdracht geven: een herkenbare vraag uit de praktijk, met fictieve gegevens.',
              'AI levert op: snel, overtuigend geformuleerd en ogenschijnlijk af.',
              'Kritisch kijken: waar klopt het niet? Wat is aangenomen of verzonnen? Dáár zit het vakmanschap.',
              'Kalibreren: bijsturen, controleren en zelf het oordeel vellen.'
            ] }
          ]
        },
        {
          title: 'Probeer een idee uit de praktijksessie',
          text: 'Drie ideeën uit de praktijksessie gingen door naar de plenaire zaal. Na de sessie zijn ze uitgewerkt tot een voorzet om zelf te proberen. Gebruik Microsoft 365 Copilot met je werkaccount (dit is vertrouwelijk klantmateriaal) en pas de [PLAATSHOUDERS] aan.',
          slide: 13,
          prompts: [
            {
              label: 'Risicoanalyse kwalitatief verbeteren',
              text: `Je bent een ervaren samenstellend accountant. Ik voeg toe: de bedrijfsbeschrijving van [KLANT], de jaarrekening van vorig jaar en [BENCHMARK OF BRANCHE-INFORMATIE]. Bereid de risicoanalyse voor de samenstelopdracht over boekjaar [JAAR] voor.

1. Benoem mogelijke risico's op een onjuiste of onvolledige jaarrekening, gegroepeerd naar: bedrijfsactiviteiten en markt, financiële positie en continuïteit, specifieke posten, en verslaggeving.
2. Geef per risico: omschrijving, bron (document en passage), betrokken jaarrekeningpost(en) en het belang (hoog/middel/laag) met onderbouwing.
3. Selecteer daarna maximaal vijf risico's die het meest relevant zijn voor deze opdracht en leg uit waarom.

Regels:
- Gebruik alleen de bijgevoegde stukken en markeer aannames als aanname.
- Vul ontbrekende informatie niet zelf in, maar zet het onder "Vragen aan de klant".`
            },
            {
              label: 'Fiscale posities sneller en met minder fouten opstellen',
              text: `Je bent een ervaren fiscalist. Ik voeg toe: het maatschapscontract van [MAATSCHAP] en de cijfers over [JAAR].

1. Vat de afspraken over de winstverdeling samen per maat, met verwijzing naar het artikel in het contract.
2. Werk op basis daarvan de fiscale positie per maat uit in een tabel, met per regel de bron en de berekening.
3. Benoem mogelijkheden om de belastingdruk te optimaliseren, met per mogelijkheid de voorwaarden en de risico's.
4. Lever een korte bespreeknotitie op voor het gesprek met de maten.

Regels:
- Reken alleen met bedragen uit de bijgevoegde stukken en laat je berekening zien.
- Noem een tarief, grens of wetsartikel alleen als je daar zeker van bent; markeer het anders als "Nagaan".
- Zet onderaan wat je niet uit de stukken kunt halen.`
            },
            {
              label: 'Bedrijfsbeschrijving en ICBO laten checken',
              text: `Je bent een ervaren samenstellend accountant. Ik voeg de bedrijfsbeschrijving en de ICBO van [KLANT] over boekjaar [JAAR] toe.

1. Beoordeel de bedrijfsbeschrijving op volledigheid: activiteiten, organisatie, markt, financiering en belangrijke ontwikkelingen. Noem wat ontbreekt.
2. Noem relevante marktontwikkelingen voor deze branche, met per ontwikkeling de bron.
3. Leg de ICBO naast de bedrijfsbeschrijving: welke bevindingen worden niet verklaard, en welke ontwikkelingen zie je niet terug in de cijfers?
4. Doe een eerste opzet voor de risicoanalyse en geef maximaal vijf adviespunten voor gesprekken door het jaar heen.

Maak steeds onderscheid tussen wat uit de stukken komt en wat jouw suggestie is. Vul ontbrekende informatie niet zelf in.`
            }
          ],
          note: 'Een maatschapscontract bevat persoonsgegevens: gebruik alleen Microsoft 365 Copilot met je werkaccount. Tarieven en wetsartikelen controleer je altijd zelf. Voor de ICBO zelf staat de usecase "ICBO op een concept jaarrekening" klaar.'
        },
        {
          title: 'Dien je idee in bij het ideeënloket',
          text: 'Vraagt je idee om een agent, koppeling of tool? Laat het achter in het ideeënloket van Ilse Lab. Je hoort binnen twee weken of en hoe we ermee verdergaan.'
        }
      ],

      ideas: [
        { title: 'Risicoanalyse kwalitatief verbeteren', text: 'Met Copilot een analyse op meer bronnen tegelijk: de bedrijfsbeschrijving, marktontwikkelingen, benchmarks en verslaggeving. Laat AI de risico\'s in beeld brengen en kies zelf de belangrijkste: AI stelt al snel te veel risico\'s vast.' },
        { title: 'Fiscale posities sneller en met minder fouten', text: 'Copilot analyseert het maatschapscontract op de winstverdeling en zet de fiscale positie per maat op, als stuk ter bespreking. Uitgaan van actuele wetgeving, en de adviseur toetst altijd de uitkomst.' },
        { title: 'Bedrijfsbeschrijving en ICBO laten checken', text: 'Copilot checkt de bedrijfsbeschrijving en de ICBO op volledigheid, marktontwikkelingen en adviesmogelijkheden door het jaar heen, als opzet voor de risicoanalyse. Valideer wat je terugkrijgt, en: gewoon proberen.' }
      ],
      questions: [
        'Hoe leren junioren het vak goed als AI een deel van het basiswerk overneemt?',
        'Wat betekent het voor ons advies als klanten zelf AI gebruiken?',
        'Hoe houden we het tempo van alle ontwikkelingen bij?'
      ],

      timelineIntro: 'De koers voor de discipline Accountancy: we bouwen stap voor stap, van bewustwording via toepassing en vakmanschap naar structurele ontwikkeling.',
      timeline: [
        { month: 'Nu', title: 'Eerste toepassingen', text: 'Eerste AI-toepassingen in de praktijk, kaders voor dataveiligheid en ethiek, de Boost & Learn en de AI Snackbar.', current: true },
        { month: '1 tot 2 jaar', title: 'Koplopers en kennisbank', text: 'AI-koplopers vanuit het werkveld, werkprocessen in kaart brengen en een kennisbank met praktijkvoorbeelden.' },
        { month: 'Richting 2030', title: 'AI structureel in de praktijk', text: 'Proactief signaleren bij klanten en meer ruimte voor advies.' }
      ]
    }
  ],

  /* ---- Eigen tips (de gedeelde tips komen er vanzelf bij) ---------------------------- */
  tips: [
    {
      id: 'woordkeuze-samenstellen',
      title: 'Samenstellen is geen controle: let op je woorden',
      summary: 'Copilot schrijft al snel "gecontroleerd" of "goedgekeurd". Bij een samenstellingsopdracht wil je dat juist niet.',
      category: 'Veilig werken',
      icon: 'pen',
      license: false,
      minutes: '2 min',
      why: 'Bij een samenstellingsopdracht geef je geen zekerheid over de jaarrekening. Woorden als "controle", "gecontroleerd" of "goedgekeurd" in een mail, presentatie of brief kunnen bij de klant het verkeerde beeld geven. Copilot neemt die woorden makkelijk over. Met één regel in je instructies of prompt voorkom je dat.',
      steps: [
        'Zet een regel over je woordkeuze in je eigen instructies (zie de tip "Stel je eigen instructies in").',
        'Of zet de regel onder iedere prompt voor stukken die naar de klant gaan.',
        'Laat Copilot een tekst nalopen met de prompt hieronder voordat je hem verstuurt.',
        'Twijfel je over een formulering? Leg hem voor aan je opdrachtverantwoordelijke.'
      ],
      example: {
        label: 'Regel voor je instructies en een prompt om na te lopen',
        text: `Regel voor je instructies of prompt:
Ik werk aan samenstellingsopdrachten. Gebruik geen woorden die zekerheid suggereren, zoals "controle", "gecontroleerd", "controleverklaring" of "goedgekeurd". Schrijf "samengesteld" of "opgesteld".

Prompt om een tekst na te lopen:
Loop de tekst hieronder na op woorden die suggereren dat de jaarrekening is gecontroleerd of goedgekeurd. Geef per gevonden woord de zin en een voorstel voor een betere formulering. Pas verder niets aan.

[PLAK HIER DE TEKST]`
      },
      note: 'Een hulpmiddel bij je woordkeuze. De richtlijnen van kantoor over samenstellingsopdrachten gaan altijd voor.',
      added: '2026-10-21',
      usecases: ['klantpresentatie', 'icbo-jaarrekening']
    }
  ],
};
