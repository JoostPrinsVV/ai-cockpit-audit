/* ==========================================================================
   AI COCKPIT AUDIT — USECASES
   --------------------------------------------------------------------------
   Praktische toepassingen van Copilot in de controlepraktijk, elk met een
   demo. De volgorde hier is de volgorde op de pagina 'Usecases'.

   Alle namen, bedragen en organisaties in de demo's zijn verzonnen.

   Zo werkt het:
   - Iedere usecase staat tussen { en }, gescheiden door een komma.
   - Een usecase toevoegen? Kopieer een compleet blok { ... } en geef het
     een nieuwe, unieke id. Verander een id niet meer als er al naar
     gelinkt wordt (het adres is #/usecase/<id>).
   - Prompts staan tussen backticks (` ... `): zo kun je gewoon regels
     typen. Gebruik binnen de prompt zelf geen backtick.
   - [PLAATSHOUDERS] in hoofdletters kunnen collega's invullen vóór het
     kopiëren. Begin een plaatshouder dus altijd met een hoofdletter.

   Velden (* = verplicht):
     id*          Unieke code, alleen kleine letters, cijfers en '-'.
     title*       Korte titel (max. ca. 45 tekens).
     subtitle     Eén korte zin onder de titel.
     phase*       Fase uit data/phases.js, bijv. 'planning'.
     level        'Starter' of 'Gevorderd'.
     duration     Duur van de demo, bijv. '2 min'.
     license      true = Microsoft 365 Copilot-licentie nodig; false = kan met de
                  gratis Copilot Chat (bestand toevoegen of tekst plakken).
     tools        Waar je het doet, bijv. ['Copilot Chat', 'Copilot in Excel'].
     icon         Icoon uit de sprite in index.html (zonder 'i-').
     featured     true = uitgelicht op de startpagina.
     added        Datum van toevoegen (JJJJ-MM-DD), voor het label 'Nieuw'.
     intro*       Korte introductie (2-4 zinnen).
     video        Opgenomen demo (MP4). Heeft voorrang op 'demo'.
     demo         HTML-demo, bijv. 'demos/player.html#risicoanalyse' (zie demos/scripts.js)
                  of een losse HTML-demo uit de snackbar.
                  Geen video en geen demo? Dan staat er 'Demo volgt'.
     steps        'Zo pak je het aan': stappen als lijst.
     prompts*     Eén of meer prompts: [{ label, text }]. Verschijnen ook in de promptdatabase.
     promptNote   Korte toelichting onder de prompts.
     watchOut     'Let op': aandachtspunten als lijst.
     tip          Praktische tip.
     relatedTips  Id's uit data/tips.js.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.usecases = [
  {
    id: 'risicoanalyse',
    title: 'Risico-inventarisatie voor de planning',
    subtitle: 'Van jaarrekening en gespreksnotities naar een eerste risicotabel',
    phase: 'planning',
    level: 'Starter',
    duration: '1 min',
    license: false,
    tools: ['Copilot Chat'],
    icon: 'flag',
    featured: true,
    added: '2026-10-19',
    intro: 'Copilot leest de jaarrekening van vorig jaar en je aantekeningen van het planningsgesprek, en zet de mogelijke risico\'s op een rij: per post de beweringen die geraakt worden, waarom, en een eerste idee voor de aanpak. Jij beoordeelt en vult aan. Het resultaat is een stevige start voor je planningsmemo.',
    demo: 'demos/player.html#risicoanalyse',
    steps: [
      'Open Microsoft 365 Copilot Chat met je zakelijke account (je ziet het schildje) en voeg met de paperclip de jaarrekening van vorig jaar en je aantekeningen van het planningsgesprek toe.',
      'Kopieer de eerste prompt, vul de plaatshouders in en verstuur.',
      'Beoordeel de risicotabel: wat mist er, wat schat jij anders in? Vraag Copilot om aan te vullen of bij te stellen.',
      'Gebruik de tweede prompt om er een concept-risicoparagraaf voor de planningsmemo van te maken.',
      'Neem alleen over wat jij onderschrijft en leg vast in het dossier hoe je Copilot hebt gebruikt.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Risico\'s in kaart',
        text: `Je bent een ervaren auditor die de controle van [ONDERNEMING] over boekjaar [JAAR] voorbereidt. De onderneming is actief in [BRANCHE]. Ik voeg toe: de jaarrekening over [VORIG JAAR] en mijn aantekeningen van het planningsgesprek met de klant.

Maak een eerste risico-inventarisatie voor de planning.

1. Beschrijf in maximaal vijf zinnen het bedrijfsmodel en de belangrijkste ontwikkelingen sinds vorig jaar, volgens de stukken.
2. Maak een tabel met de kolommen: Nr., Post of proces, Mogelijk risico, Bewering(en) (bestaan, volledigheid, juistheid, waardering, rechten en verplichtingen, presentatie), Waarom (met bron en pagina), Inschatting inherent risico (hoog/middel/laag) en Eerste idee voor de aanpak.
3. Besteed apart aandacht aan:
   - het risico op een afwijking van materieel belang door fraude, waaronder de opbrengstverantwoording en het doorbreken van de interne beheersing door het management;
   - schattingsposten;
   - transacties met verbonden partijen;
   - signalen over continuïteit.
4. Sluit af met maximaal acht vragen die ik de klant nog moet stellen.

Werkwijze:
- Gebruik alleen de bijgevoegde stukken en vermeld bij elk risico de bron.
- Is iets een aanname of algemene branchekennis, markeer het dan met "Aanname".
- Geef geen oordeel over de materialiteit of de controleaanpak als geheel; doe voorstellen die ik zelf beoordeel.`
      },
      {
        label: 'Stap 2 · Risicoparagraaf voor de planningsmemo',
        text: `Zet de risico's met inschatting "hoog" en "middel" om in een concept-paragraaf "Risico's en controleaanpak" voor de planningsmemo. Gebruik per risico deze opbouw: het risico, de betrokken posten en beweringen, waarom dit een risico is, en de voorgestelde werkzaamheden (gegevensgericht en/of gericht op de interne beheersing). Schrijf zakelijk en compact, maximaal 400 woorden, en laat de bronverwijzingen staan.`
      }
    ],
    promptNote: 'Werkt met de gratis Copilot Chat: voeg de stukken toe met de paperclip. Met een licentie kun je ook naar bestanden in OneDrive of SharePoint verwijzen met /.',
    watchOut: [
      'Copilot kent je klant niet zoals jij: de inschatting van het risico is altijd jouw beoordeling.',
      'Gebruik alleen stukken die bij deze opdracht horen en werk in de zakelijke Copilot (schildje).',
      'Controleer de bronverwijzingen: klopt de pagina, en staat het er echt?'
    ],
    tip: 'Met een licentie kun je de agent Researcher vragen om recente ontwikkelingen in de branche erbij te zoeken. Laat die bronnen apart vermelden, zodat je ze zelf kunt beoordelen.',
    relatedTips: ['instructies', 'prompt-opbouw', 'researcher-analyst']
  },
  {
    id: 'walkthrough',
    title: 'Van walkthrough naar procesbeschrijving',
    subtitle: 'Transcriptie erin, procesbeschrijving en beheersmaatregelen eruit',
    phase: 'beheersing',
    level: 'Starter',
    duration: '1 min',
    license: false,
    tools: ['Copilot Chat', 'Teams'],
    icon: 'flow',
    featured: true,
    added: '2026-10-19',
    intro: 'Je neemt de walkthrough van het inkoopproces op in Teams. Copilot maakt van de transcriptie een procesbeschrijving in stappen, haalt de beheersmaatregelen eruit en laat zien waar de gaten zitten. Zo heb je in een paar minuten een eerste opzet voor je dossier over de interne beheersing.',
    demo: 'demos/player.html#walkthrough',
    steps: [
      'Vertel aan het begin van het gesprek dat je transcribeert en zet de transcriptie aan in Teams (met een licentie kan Facilitator meeschrijven).',
      'Download na afloop de transcriptie (.docx) en voeg die toe in Copilot Chat, eventueel samen met de procesbeschrijving van vorig jaar.',
      'Gebruik de eerste prompt voor de procesbeschrijving en de beheersmaatregelen.',
      'Gebruik de tweede prompt voor mogelijke tekortkomingen, openstaande vragen en een voorstel voor het testen van opzet, bestaan en werking.',
      'Leg daarnaast vast wat je zelf hebt gezien: een transcriptie is geen bewijs van de werking.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Procesbeschrijving en beheersmaatregelen',
        text: `Ik voeg de transcriptie toe van een walkthrough van het [PROCES, bijv. inkoopproces] bij [ONDERNEMING] op [DATUM]. Gesprekspartners: [NAMEN EN FUNCTIES].

Maak hiervan:
1. Een procesbeschrijving in genummerde stappen, van begin tot eind. Vermeld per stap wie het doet, welk systeem of document wordt gebruikt en wat er wordt vastgelegd.
2. Een tabel met beheersmaatregelen, met de kolommen: Nr., Beheersmaatregel, Stap in het proces, Soort (preventief/detectief), Handmatig of geautomatiseerd, Frequentie, Uitvoerder, Risico dat wordt afgedekt en Fragment uit de transcriptie.
3. Een lijst met de functiescheidingen die worden genoemd, en waar functiescheiding lijkt te ontbreken.

Regels:
- Gebruik alleen wat in de transcriptie staat en vul niets aan.
- Neem bij iedere beheersmaatregel het letterlijke fragment op waarin hij wordt genoemd.
- Is iets onduidelijk of tegenstrijdig, markeer het dan met "Navragen".`
      },
      {
        label: 'Stap 2 · Tekortkomingen en testaanpak',
        text: `Beoordeel op basis van de procesbeschrijving en de beheersmaatregelen:
1. Mogelijke tekortkomingen in de opzet van de interne beheersing, met het risico dat daardoor ontstaat.
2. Vragen die ik nog moet stellen om het proces volledig te begrijpen.
3. Een voorstel voor het testen van opzet, bestaan en werking van de belangrijkste beheersmaatregelen: per maatregel de testaanpak, de populatie en de omvang van de deelwaarneming die ik zou kunnen overwegen.

Zet alles in tabellen en maak duidelijk dat het voorstellen zijn die ik zelf beoordeel.`
      }
    ],
    promptNote: 'Werkt met de gratis Copilot Chat: download de transcriptie uit Teams en voeg die toe met de paperclip.',
    watchOut: [
      'Vertel aan het begin dat je transcribeert; iedereen ziet daar ook een melding van in Teams.',
      'Een transcriptie laat zien wat er gezegd is, niet wat er echt gebeurt. Bestaan en werking toets je zelf.'
    ],
    tip: 'Voeg ook de procesbeschrijving van vorig jaar toe en vraag: "Wat is er veranderd ten opzichte van vorig jaar?" Dan zie je direct waar je moet doorvragen.',
    relatedTips: ['transcriptie', 'facilitator']
  },
  {
    id: 'cijferanalyse',
    title: 'Cijferanalyse op de proefsaldibalans',
    subtitle: 'Verschillen boven de uitvoeringsmaterialiteit, met vragen voor de klant',
    phase: 'gegevensgericht',
    level: 'Starter',
    duration: '1 min',
    license: false,
    tools: ['Copilot Chat', 'Copilot in Excel'],
    icon: 'chart',
    featured: true,
    added: '2026-10-19',
    intro: 'Je exporteert de proefsaldibalans van dit jaar en vorig jaar naar Excel. Copilot berekent de verschillen, zet de mutaties boven de uitvoeringsmaterialiteit op een rij, geeft per verschil mogelijke verklaringen en formuleert de vragen voor de klant. De analyse en de conclusie blijven van jou.',
    demo: 'demos/player.html#cijferanalyse',
    steps: [
      'Exporteer de proefsaldibalans (dit jaar en vorig jaar) naar één Excel-bestand met grootboeknummer, omschrijving en saldi.',
      'Voeg het bestand toe in Copilot Chat, of open het in Excel en start daar Copilot (met licentie).',
      'Gebruik de eerste prompt; neem de uitvoeringsmaterialiteit en de grens voor het rapporteren van verschillen over uit het dossier.',
      'Reken een aantal verschillen zelf na in je eigen bestand.',
      'Gebruik de tweede prompt om de vragen per verschil klaar te zetten voor de klant.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Verschillen analyseren',
        text: `Het bijgevoegde Excel-bestand bevat de proefsaldibalans van [ONDERNEMING] per [BALANSDATUM] en die van het vergelijkende jaar. De uitvoeringsmaterialiteit is [UITVOERINGSMATERIALITEIT].

Voer een cijferanalyse uit:
1. Bereken per grootboekrekening het verschil in euro's en in procenten.
2. Maak een tabel van alle rekeningen waarvan het verschil groter is dan de uitvoeringsmaterialiteit, met de kolommen: Rekening, Omschrijving, Saldo [JAAR], Saldo [VORIG JAAR], Verschil, Verschil %, Mogelijke verklaring en Te verifiëren.
3. Noem ook opvallende verschuivingen onder de grens, zoals rekeningen die van teken wisselen of nieuwe rekeningen.
4. Bereken voor beide jaren de brutomarge, de solvabiliteit en de current ratio, en laat de berekening zien.

Werkwijze:
- Reken met de bedragen uit het bestand en laat zien hoe je rekent.
- Een verklaring is een hypothese, geen feit: markeer die met "Hypothese".
- Sla rekeningen over die in beide jaren nul zijn.`
      },
      {
        label: 'Stap 2 · Vragen voor de klant',
        text: `Maak voor de verschillen uit de tabel een lijst met vragen voor de klant. Geef per verschil één of twee concrete vragen en noem welk onderliggend stuk ik graag ontvang (bijvoorbeeld een contract, factuur of specificatie). Groepeer de vragen per onderwerp en schrijf ze zo dat ik ze direct in een mail kan zetten.`
      }
    ],
    promptNote: 'Werkt met de gratis Copilot Chat (bestand toevoegen). Met een licentie kan het ook direct in Copilot in Excel, of met de agent Analyst voor grote bestanden.',
    watchOut: [
      'Reken grote of opvallende verschillen zelf na: Copilot kan rekenfouten maken, zeker bij grote bestanden.',
      'Een verklaring van Copilot is een hypothese. Pas na onderbouwing door de klant en jouw controle is het controle-informatie.'
    ],
    tip: 'In Copilot in Excel kun je vragen: "Voeg een kolom toe met het verschil en markeer alles boven [BEDRAG]." Dan blijft alles in je eigen werkpapier.',
    relatedTips: ['excel-copilot', 'controleren']
  },
  {
    id: 'journaalposten',
    title: 'Opvallende journaalposten selecteren',
    subtitle: 'Analyst zoekt in alle boekingen naar de kenmerken die jij kiest',
    phase: 'gegevensgericht',
    level: 'Gevorderd',
    duration: '1 min',
    license: true,
    tools: ['Analyst (agent)'],
    icon: 'magnifier-doc',
    featured: false,
    added: '2026-10-19',
    intro: 'Voor de werkzaamheden rond het doorbreken van de interne beheersing door het management exporteer je alle journaalposten. De agent Analyst past jouw criteria toe op de volledige populatie, zoals boekingen in het weekend, ronde bedragen, handmatige posten door ongebruikelijke gebruikers en boekingen rond balansdatum. Je krijgt aantallen per criterium en een onderbouwde selectie.',
    demo: 'demos/player.html#journaalposten',
    steps: [
      'Exporteer alle journaalposten van het boekjaar uit het boekhoudpakket naar Excel of CSV, met datum, gebruiker, dagboek, rekening, bedrag en omschrijving.',
      'Stel de volledigheid vast: sluit het totaal aan op de proefsaldibalans?',
      'Open Microsoft 365 Copilot, kies de agent Analyst en voeg het bestand toe.',
      'Gebruik de eerste prompt met jouw criteria. Analyst laat de gebruikte code zien; die kun je opnemen in je dossier.',
      'Gebruik de tweede prompt voor de vastlegging van de selectie, en vraag daarna de onderbouwing op bij de klant.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Populatie en criteria',
        text: `Het bijgevoegde bestand bevat alle journaalposten van [ONDERNEMING] over boekjaar [JAAR] (kolommen: [KOLOMNAMEN]). Ik voer werkzaamheden uit naar aanleiding van het risico dat het management de interne beheersing doorbreekt.

1. Controleer eerst de populatie: aantal regels, aantal boekingen, totaal debet en credit, en de periode die het bestand beslaat. Meld ontbrekende of lege velden.
2. Pas deze criteria toe en geef per criterium het aantal boekingen en het totaalbedrag:
   a. geboekt in het weekend of op een feestdag;
   b. ronde bedragen van [BEDRAG] of meer (eindigend op 000);
   c. handmatige boekingen door gebruikers die normaal geen journaalposten maken: [GEBRUIKERS];
   d. boekingen op [RISICOREKENINGEN] met een tegenrekening buiten de gebruikelijke boekingsgang;
   e. boekingen in de periode [PERIODE ROND BALANSDATUM];
   f. omschrijvingen met woorden als "correctie", "memoriaal" of "diversen", of zonder omschrijving.
3. Maak een overzicht van de boekingen die aan twee of meer criteria voldoen, gesorteerd op bedrag, met: Boekingsnummer, Datum, Gebruiker, Rekening, Tegenrekening, Bedrag, Omschrijving en Criteria.
4. Laat de gebruikte code zien en leg in gewone taal uit wat je per stap hebt gedaan.

Trek geen conclusies over fraude: dit is een selectie voor nader onderzoek.`
      },
      {
        label: 'Stap 2 · Vastlegging voor het dossier',
        text: `Schrijf een korte vastlegging voor het dossier met: de populatie en de aansluiting op de proefsaldibalans, de gekozen criteria en waarom, het aantal boekingen per criterium, de geselecteerde boekingen en de volgende stap (onderbouwing opvragen en beoordelen). Maximaal 250 woorden, zakelijk.`
      }
    ],
    promptNote: 'Gebruik de agent Analyst in Microsoft 365 Copilot (licentie). Analyst werkt met Python en laat zien hoe hij rekent.',
    watchOut: [
      'De criteria kies je zelf, op basis van je kennis van de klant en de risico-inschatting. Copilot past ze alleen toe.',
      'Stel de volledigheid van de export vast vóórdat je analyseert: met een onvolledige populatie is de selectie niets waard.',
      'Bewaar het bestand alleen in het dossier en je eigen OneDrive, niet in gedeelde mappen.'
    ],
    tip: 'Vraag Analyst om de selectie terug te geven als Excel-bestand. Dan leg je per boeking direct je onderbouwing vast.',
    relatedTips: ['researcher-analyst', 'dossier-vastleggen']
  },
  {
    id: 'notulen',
    title: 'Notulen doorlezen op controlerelevante punten',
    subtitle: 'Gebeurtenissen na balansdatum, claims en verbonden partijen op een rij',
    phase: 'afronding',
    level: 'Starter',
    duration: '1 min',
    license: false,
    tools: ['Copilot Chat'],
    icon: 'book',
    featured: false,
    added: '2026-10-19',
    intro: 'Notulen van de aandeelhoudersvergadering, de raad van commissarissen en het directieoverleg zijn vaak lang. Copilot leest ze door en markeert wat voor de controle telt: gebeurtenissen na balansdatum, claims en geschillen, verbonden partijen, continuïteit en nieuwe verplichtingen. Met een letterlijk citaat, zodat je het zelf naleest.',
    demo: 'demos/player.html#notulen',
    steps: [
      'Verzamel de notulen over het boekjaar en de periode tot vandaag.',
      'Voeg ze toe in Copilot Chat; meerdere bestanden kan in één keer.',
      'Gebruik de eerste prompt voor het overzicht en lees ieder punt na in de bron.',
      'Gebruik de tweede prompt voor de vragen aan het management en de onderwerpen voor de bevestigingsbrief.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Overzicht van relevante punten',
        text: `Ik voeg de notulen toe van [VERGADERINGEN, bijv. de AVA, de RvC en het directieoverleg] van [ONDERNEMING] over de periode [PERIODE]. De balansdatum is [BALANSDATUM]; ik verwacht de controleverklaring rond [DATUM] af te geven.

Lees de notulen en maak een tabel met alle punten die relevant kunnen zijn voor de controle, met de kolommen: Datum notulen, Onderwerp, Categorie, Letterlijk citaat, Mogelijke impact op de jaarrekening en Vervolgactie voor de auditor.

Gebruik deze categorieën: gebeurtenissen na balansdatum, continuïteit, claims en geschillen, verbonden partijen, nieuwe verplichtingen of garanties, wijzigingen in organisatie of bestuur, waarderingen en schattingen, fraude of integriteit, overig.

Regels:
- Neem alleen punten op die echt in de notulen staan, met een letterlijk citaat.
- Geef geen oordeel over de jaarrekening; beschrijf de mogelijke impact als vraag of aandachtspunt.
- Vermeld onder de tabel voor welke categorieën je niets hebt gevonden.`
      },
      {
        label: 'Stap 2 · Vragen en bevestigingsbrief',
        text: `Maak op basis van de tabel:
1. Een lijst met vragen voor het management, gegroepeerd per categorie.
2. Een opsomming van onderwerpen die ik zou kunnen opnemen in de schriftelijke bevestiging van het management (bevestigingsbrief).
3. De punten die ik moet afstemmen met de opdrachtverantwoordelijke.`
      }
    ],
    promptNote: 'Werkt met de gratis Copilot Chat: voeg de notulen toe met de paperclip.',
    watchOut: [
      'Notulen zijn vertrouwelijk: werk uitsluitend in de zakelijke Copilot en voeg alleen stukken van deze opdracht toe.',
      'Copilot kan iets missen. Lees de notulen van de belangrijkste vergaderingen altijd ook zelf.'
    ],
    tip: 'Herhaal de prompt vlak voor het afgeven van de verklaring met de nieuwste notulen. Zo dek je de hele periode tot de datum van de verklaring.',
    relatedTips: ['bestanden-toevoegen', 'controleren']
  },
  {
    id: 'jaarrekening-review',
    title: 'Concept jaarrekening reviewen',
    subtitle: 'Copilot loopt het concept na vóór de laatste review',
    phase: 'afronding',
    level: 'Gevorderd',
    duration: '2,5 min',
    license: false,
    tools: ['Copilot Chat'],
    icon: 'checklist',
    featured: true,
    added: '2026-10-19',
    intro: 'Copilot doet als ervaren auditor een uitgebreide ICBO op een fictieve concept jaarrekening: volledigheid, aansluitingen, grondslagen en toelichting, analyse met de materialiteit, continuïteit en presentatie. Je krijgt een samenvatting, een bevindingentabel en vragen voor klant en team. Een extra paar ogen vóór de review.',
    video: 'assets/videos/snack-02.mp4',
    steps: [
      'Voeg de concept jaarrekening en die van vorig jaar toe in Copilot Chat.',
      'Vul het regime, de omvang, de materialiteit en de uitvoeringsmaterialiteit uit het dossier in.',
      'Loop de bevindingentabel door en reken de belangrijkste punten zelf na.',
      'Gebruik de tweede prompt voor een reviewnotitie aan de opdrachtverantwoordelijke.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Review van het concept',
        text: `Je bent een ervaren auditor met veel MKB-kennis en voert een ICBO uit op de bijgevoegde concept jaarrekening [BESTANDSNAAM] van [ONDERNEMING], [RECHTSVORM], boekjaar [JAAR]. De jaarrekening is opgesteld volgens [BW2 TITEL 9 EN RJ / RJK / FISCALE GRONDSLAGEN] voor een [MICRO / KLEINE / MIDDELGROTE] rechtspersoon.

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
    promptNote: 'Werkt met de gratis Copilot Chat: voeg de concept jaarrekening (en die van vorig jaar) toe met de paperclip. De demo gebruikt een fictieve jaarrekening.',
    watchOut: [
      'Copilot ondersteunt de review, maar vervangt jouw oordeel en de dossierreview niet.',
      'Een wettelijke eis die Copilot noemt, zoek je altijd zelf na in BW2 of de RJ.'
    ],
    tip: 'Voeg ook de jaarrekening van vorig jaar toe. Dan kan Copilot de vergelijkende cijfers en grondslagen naast elkaar leggen.',
    relatedTips: ['controleren', 'doorvragen']
  },
  {
    id: 'managementletter',
    title: 'Bevindingen omzetten in een managementletter',
    subtitle: 'Van je bevindingenlijst naar heldere tekst met risico en aanbeveling',
    phase: 'afronding',
    level: 'Starter',
    duration: '1 min',
    license: false,
    tools: ['Copilot Chat', 'Copilot in Word'],
    icon: 'pen',
    featured: false,
    added: '2026-10-19',
    intro: 'Tijdens de interim-controle verzamel je bevindingen in een lijst of werkpapier. Copilot zet ze om in een concept-managementletter: per bevinding wat er aan de hand is, het risico voor de organisatie en een concrete aanbeveling, in begrijpelijke taal voor bestuur en management. Daarna schrijft Copilot de begeleidende mail.',
    demo: 'demos/player.html#managementletter',
    steps: [
      'Zet je bevindingen in een Word- of Excel-bestand: bevinding, toelichting en wat je met de klant hebt besproken.',
      'Voeg het bestand toe in Copilot Chat, samen met de managementletter van vorig jaar.',
      'Gebruik de eerste prompt en controleer of iedere bevinding juist en volledig is weergegeven.',
      'Laat de reactie van het management open: die vraag je zelf op.',
      'Zet de tekst in de kantoortemplate en volg de gebruikelijke reviewroute.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Concept-managementletter',
        text: `Je bent een ervaren auditor. Ik voeg mijn bevindingen toe uit de interim-controle bij [ONDERNEMING] over boekjaar [JAAR], en de managementletter van vorig jaar.

Schrijf een concept-managementletter in het Nederlands met:
1. Een korte inleiding: doel en reikwijdte van de interim-controle, en dat de letter geen volledig overzicht geeft van alle mogelijke verbeterpunten.
2. Per bevinding een paragraaf met: Bevinding (wat hebben we vastgesteld), Risico (wat kan er misgaan voor de organisatie), Aanbeveling (concreet en uitvoerbaar) en Prioriteit (hoog/middel/laag). Laat ruimte voor "Reactie management" en vul die niet zelf in.
3. Een tabel met de opvolging van de bevindingen van vorig jaar: Bevinding vorig jaar, Status (opgelost/gedeeltelijk/niet opgelost, volgens mijn bevindingen) en Toelichting.
4. Een overzichtstabel van alle bevindingen, gesorteerd op prioriteit.

Schrijfregels:
- Zakelijk, positief-kritisch en begrijpelijk voor bestuur en management. Leg een vakterm die nodig is kort uit.
- Gebruik alleen de bevindingen uit mijn bestand en voeg niets toe.
- Noem geen personen; spreek over functies of afdelingen.`
      },
      {
        label: 'Stap 2 · Begeleidende mail',
        text: `Schrijf een korte begeleidende e-mail aan [NAAM EN FUNCTIE] van [ONDERNEMING] waarmee ik de concept-managementletter toestuur. Vraag om een reactie van het management per bevinding vóór [DATUM] en stel voor de letter te bespreken in een overleg van een half uur. Maximaal 120 woorden. Onderteken met [NAAM].`
      }
    ],
    promptNote: 'Werkt met de gratis Copilot Chat. Met een licentie kun je de tekst ook direct in Word laten schrijven, in de kantoortemplate.',
    watchOut: [
      'De managementletter is een formeel product: volg de kantoortemplate en de reviewroute.',
      'Lees kritisch op toon: Copilot kan stelliger of juist vager formuleren dan jij bedoelt.'
    ],
    tip: 'Vraag daarna: "Herschrijf bevinding 2 voor een lezer zonder financiële achtergrond." Handig voor een DGA of de raad van commissarissen.',
    relatedTips: ['doorvragen', 'instructies']
  },
  {
    id: 'klantoverleg',
    title: 'Van klantoverleg naar actielijst',
    subtitle: 'Notulen, acties en een bevestigingsmail uit je Teams-transcriptie',
    phase: 'communicatie',
    level: 'Starter',
    duration: '2 min',
    license: false,
    tools: ['Copilot Chat', 'Teams'],
    icon: 'users',
    featured: false,
    added: '2026-10-19',
    intro: 'Na een klantoverleg, zoals de planningsbespreking of de slotbespreking, geef je de transcriptie aan Copilot. Copilot maakt er notulen en een actielijst met eigenaren en deadlines van, en schrijft een mail waarmee je de afspraken met de klant bevestigt.',
    video: 'assets/videos/snack-03.mp4',
    steps: [
      'Vertel aan het begin van het overleg dat je transcribeert en zet de transcriptie aan in Teams.',
      'Download na afloop de transcriptie (.docx) en voeg die toe in Copilot Chat.',
      'Gebruik de eerste prompt voor de samenvatting en de actielijst.',
      'Gebruik de tweede prompt voor de bevestigingsmail en lees die na voordat je hem verstuurt.'
    ],
    prompts: [
      {
        label: 'Stap 1 · Samenvatting en actielijst',
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
- Is niet duidelijk wie iets zei, markeer dat dan met "Spreker onduidelijk".
- Zet alles wat besproken is zonder de klant erbij onder een apart kopje "Intern".`
      },
      {
        label: 'Stap 2 · Bevestigingsmail',
        text: `Schrijf een korte, vriendelijke e-mail aan [KLANTNAAM] waarin je de besluiten en de acties van beide kanten bevestigt. Maximaal 150 woorden. Noem alleen besluiten en acties uit de samenvatting, doe geen nieuwe toezeggingen en laat alles onder "Intern" weg. Vraag de klant te laten weten als iets niet klopt. Onderteken met [NAAM].`
      }
    ],
    promptNote: 'Werkt met de gratis Copilot Chat: download de transcriptie uit Teams en voeg die toe met de paperclip.',
    watchOut: [
      'Lees de bevestigingsmail altijd na: een toezegging die er niet in hoort, is zo verstuurd.',
      'Geen transcriptie? Plak je eigen aantekeningen; dezelfde prompt werkt dan ook.'
    ],
    tip: 'Met een licentie kan Facilitator tijdens het overleg al meeschrijven. Dan heb je de actielijst klaar zodra de vergadering eindigt.',
    relatedTips: ['facilitator', 'transcriptie']
  },
  {
    id: 'weekplanning',
    title: 'Van inbox naar weekplanning',
    subtitle: 'Je acties uit de mail in een to-do-lijst én een planning',
    phase: 'eigen-werk',
    level: 'Starter',
    duration: '1,5 min',
    license: true,
    tools: ['Copilot Chat (Werk)'],
    icon: 'calendar',
    featured: false,
    added: '2026-10-19',
    intro: 'In het drukke seizoen loop je zo achter je mail aan. Copilot leest de mails van de afgelopen week, zet alle acties en deadlines in een to-do-lijst met prioriteit, verdeelt de taken over je week rond je bestaande afspraken en zet een focusblok in je agenda. Drie prompts, en je week staat.',
    demo: 'assets/demos/snack-01.html',
    steps: [
      'Open Microsoft 365 Copilot Chat op het tabblad Werk.',
      'Gebruik de eerste prompt voor de to-do-lijst en controleer de deadlines in de mails zelf.',
      'Gebruik de tweede prompt voor de weekplanning rond je afspraken.',
      'Zet het belangrijkste blok direct vast met de derde prompt.',
      'Maak er een geplande prompt van, dan staat het overzicht elke maandag vanzelf klaar.'
    ],
    prompts: [
      {
        label: 'Stap 1 · To-do-lijst uit je mail',
        text: `Bekijk alle e-mails in mijn Postvak IN van de afgelopen 7 dagen. Haal daaruit alle acties, verzoeken en deadlines die op mij betrekking hebben. Maak een to-do lijst in een tabel met de kolommen: Taak, Afzender, Datum e-mail, Deadline (indien genoemd), Prioriteit (Hoog/Middel/Laag). Sorteer op prioriteit en deadline. Sla nieuwsbrieven en automatische meldingen over. Zet onderaan een korte lijst van e-mails die nog op mijn antwoord wachten.`
      },
      {
        label: 'Stap 2 · Weekplanning',
        text: `Zet deze actielijst om in een planning voor de rest van deze week. Houd rekening met mijn bestaande afspraken in mijn agenda en geef per taak een tijdsinschatting.`
      },
      {
        label: 'Stap 3 · Focusblok inplannen',
        text: `Plan een focusblok in op [DAG] van [BEGINTIJD] tot [EINDTIJD] met de titel: [TAAK]`
      }
    ],
    promptNote: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk); Copilot leest je eigen mailbox en agenda. Controleer deadlines altijd even in de mail zelf.',
    watchOut: [
      'Copilot ziet alleen wat in jouw mailbox en agenda staat. Afspraken die alleen mondeling zijn gemaakt, mist hij.'
    ],
    tip: 'Maak van de eerste prompt een geplande prompt voor elke maandag om 08:00. Dan begin je de week met je actielijst.',
    relatedTips: ['geplande-prompts', 'outlook-samenvatten']
  }
];
