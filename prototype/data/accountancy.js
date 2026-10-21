/* ==========================================================================
   AI COCKPIT · PROTOTYPE — VOORBEELDINHOUD ACCOUNTANCY
   --------------------------------------------------------------------------
   De eigen inhoud van de cockpit Accountancy, bovenop de gedeelde basis
   (zie prototype/js/disciplines.js). Dezelfde velden als de bestanden in
   data/ (uitleg staat daar bovenin).

   Voorbeeldinhoud voor het prototype: de usecases zijn gebaseerd op de
   snacks van de AI Snackbar (Boost & Learn), de rest is ter illustratie.
   Alle namen en organisaties zijn verzonnen.

   overrides: aanpassingen op gedeelde items, alleen in deze cockpit
   (bijv. een eigen voorbeeldinstructie bij de gedeelde tip 'instructies').
   ========================================================================== */

window.AIAudit = window.AIAudit || {};
window.AIAudit.disciplineData = window.AIAudit.disciplineData || {};

window.AIAudit.disciplineData.accountancy = {
  /* ---- Fasen (de gedeelde fasen 'communicatie' en 'eigen-werk' komen erachter) ---- */
  phases: [
    { id: 'administratie', label: 'Administratie & verwerking', short: 'Administratie', accent: 'teal', icon: 'table' },
    { id: 'samenstellen', label: 'Samenstellen jaarrekening', short: 'Samenstellen', accent: 'crimson', icon: 'document' },
    { id: 'fiscaal', label: 'Aangiftes & fiscaal', short: 'Fiscaal', accent: 'steel', icon: 'checklist' },
    { id: 'advies', label: 'Advies & klantgesprek', short: 'Advies', accent: 'rose', icon: 'chart' }
  ],

  /* ---- Usecases --------------------------------------------------------------------- */
  usecases: [
    {
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
      intro: 'Copilot doet een uitgebreide ICBO op een fictieve concept jaarrekening: volledigheid, aansluitingen, grondslagen en toelichting, analyse met de materialiteit, continuïteit en presentatie. Je krijgt een samenvatting, een bevindingentabel en vragen voor klant en team.',
      video: 'assets/videos/snack-02.mp4',
      steps: [
        'Open Microsoft 365 Copilot Chat met je zakelijke account (je ziet het schildje) en voeg met de paperclip de concept jaarrekening toe, en die van vorig jaar.',
        'Kopieer de eerste prompt, vul de plaatshouders in (zoals de materialiteit uit het dossier) en verstuur.',
        'Loop de bevindingentabel na: klopt iedere bevinding met de pagina en de berekening?',
        'Maak met de tweede prompt een korte reviewnotitie voor de opdrachtverantwoordelijke.'
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
          label: 'Stap 2 · Reviewnotitie',
          text: `Zet de bevindingen met belang "hoog" om in een korte reviewnotitie voor de opdrachtverantwoordelijke, met per punt de voorgestelde actie.`
        }
      ],
      promptNote: 'Werkt met de gratis Copilot Chat: voeg de concept jaarrekening (en die van vorig jaar) toe met de paperclip en vul de materialiteit uit het dossier in. Gebruik voor de demo een fictieve jaarrekening.',
      watchOut: [
        'Copilot ondersteunt de ICBO, maar vervangt jouw oordeel niet.',
        'Reken bevindingen met een hoog belang zelf na voordat je ze bespreekt.'
      ],
      tip: 'Voeg ook de jaarrekening van vorig jaar toe. Dan kan Copilot de vergelijkende cijfers en grondslagen naast elkaar leggen.',
      relatedTips: ['bestanden-toevoegen', 'controleren']
    },
    {
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

  /* ---- Aanpassingen op gedeelde items, alleen in deze cockpit ------------------------ */
  overrides: {
    tip: {
      instructies: {
        why: 'Je hoeft niet in iedere prompt opnieuw uit te leggen dat je jaarrekeningen samenstelt, dat je in het Nederlands wilt werken en dat je bronnen wilt zien. Dat scheelt typwerk en levert direct beter bruikbare antwoorden op.',
        example: {
          label: 'Voorbeeldinstructie voor accountancy',
          text: `Ik werk als [FUNCTIE, bijv. assistent-accountant] bij Visser & Visser. Ik stel jaarrekeningen samen voor MKB-ondernemingen en adviseer ondernemers over hun cijfers.

Hoe je antwoordt:
- Altijd in het Nederlands, zakelijk en beknopt. Begin met de kern, daarna de onderbouwing.
- Gebruik tabellen voor overzichten.
- Vermeld bij feiten uit bestanden de bron (bestandsnaam en pagina of tabblad).
- Maak onderscheid tussen feiten uit de stukken, berekeningen en aannames. Markeer aannames met "Aanname".
- Schrijf teksten voor klanten in begrijpelijke taal, zonder vakjargon.
- Gebruik geen woorden als "controle" of "goedgekeurd": ik werk aan samenstellingsopdrachten.
- Is mijn vraag onduidelijk, vraag dan door in plaats van te gokken.`
        }
      },
      controleren: {
        why: 'Bedragen in een jaarrekening, aangifte of klantpresentatie moeten kloppen. Copilot kan rekenfouten maken, bronnen verkeerd citeren of iets aannemen dat niet in de stukken staat. Door gericht te controleren, vang je dat op.'
      }
    }
  }
};
