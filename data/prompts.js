/* ==========================================================================
   AI COCKPIT AUDIT — PROMPTDATABASE
   --------------------------------------------------------------------------
   Losse prompts voor de controlepraktijk, direct te kopiëren. De prompts
   uit de usecases (data/usecases.js) komen er automatisch bij, met een
   link naar de demo.

   Zo werkt het:
   - Iedere prompt staat tussen { en }, gescheiden door een komma.
   - Nieuwe prompts mag je overal tussen zetten: de pagina sorteert zelf
     op fase. Verander een id niet meer als er al naar gelinkt wordt
     (het adres is #/prompt/<id>).
   - De prompt staat tussen backticks (` ... `). Gebruik binnen de prompt
     zelf geen backtick.
   - [PLAATSHOUDERS] in hoofdletters kunnen collega's invullen vóór het
     kopiëren. Begin een plaatshouder altijd met een hoofdletter, en
     gebruik blokhaken niet voor iets anders.

   Velden (* = verplicht):
     id*          Unieke code, alleen kleine letters, cijfers en '-'.
     title*       Korte titel (max. ca. 55 tekens).
     description  Eén zin: wat levert de prompt op?
     phase*       Fase uit data/phases.js.
     task         Soort taak: 'Analyseren', 'Samenvatten', 'Schrijven',
                  'Controleren', 'Voorbereiden' of 'Plannen'.
     tool         Waar je hem gebruikt, bijv. 'Copilot Chat', 'Copilot in Excel',
                  'Copilot in Outlook', 'Copilot in Teams', 'Researcher', 'Analyst'.
     license      true = Microsoft 365 Copilot-licentie nodig; false = kan met de
                  gratis Copilot Chat (bestand toevoegen of tekst plakken).
     prompt*      De prompt.
     note         Korte toelichting: waar en hoe gebruik je hem?
     tip          Praktische tip.
     added        Datum van toevoegen (JJJJ-MM-DD), voor het label 'Nieuw'.
     author       Optioneel: wie de prompt heeft aangedragen (bijv. via de ideeënhub).
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.prompts = [
  /* ---- Planning & risicoanalyse ---------------------------------------- */
  {
    id: 'branche-ontwikkelingen',
    title: 'Ontwikkelingen in de branche van je klant',
    description: 'Researcher zoekt recente ontwikkelingen op en vertaalt ze naar mogelijke controlerisico\'s.',
    phase: 'planning',
    task: 'Voorbereiden',
    tool: 'Researcher',
    license: true,
    prompt: `Ik bereid de controle voor van een onderneming in de branche [BRANCHE] in Nederland, met een omzet van ongeveer [OMZET]. Onderzoek de belangrijkste ontwikkelingen in deze branche in de afgelopen twaalf maanden.

Geef:
1. Markt en economie: vraag, prijzen, kosten, concurrentie.
2. Wet- en regelgeving, subsidies en fiscale wijzigingen die voor deze branche gelden.
3. Ontwikkelingen die de financiering of de continuïteit kunnen raken.
4. Wat dit kan betekenen voor de jaarrekening: posten, schattingen en toelichtingen waar ik extra op moet letten.

Vermeld bij ieder punt de bron met datum. Maak onderscheid tussen feiten, verwachtingen en meningen. Gebruik geen klantgegevens; dit gaat over de branche in het algemeen.`,
    note: 'Gebruik de agent Researcher in Microsoft 365 Copilot. Noem geen klantnaam: je vraagt naar de branche.',
    tip: 'Vraag daarna: "Welke drie punten zijn het meest relevant voor een onderneming met [KENMERK]?"',
    added: '2026-10-19'
  },
  {
    id: 'planningsmemo-bijwerken',
    title: 'Planningsmemo van vorig jaar bijwerken',
    description: 'Laat zien wat er in de memo moet veranderen op basis van de nieuwe informatie.',
    phase: 'planning',
    task: 'Analyseren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg de planningsmemo van vorig jaar toe van de controle van [ONDERNEMING], en de nieuwe informatie van dit jaar: [STUKKEN, bijv. de tussentijdse cijfers en mijn aantekeningen van het planningsgesprek].

Vergelijk de memo met de nieuwe informatie en maak een tabel met de kolommen: Paragraaf van de memo, Wat er vorig jaar stond, Wat er volgens de nieuwe informatie is veranderd, Voorstel voor aanpassing en Bron.

Markeer met "Nagaan" alles waarvoor de nieuwe informatie niet volstaat. Pas de memo zelf niet aan en neem geen besluiten over materialiteit of aanpak; dat doe ik zelf.`,
    note: 'Werkt met de gratis Copilot Chat: voeg de memo en de nieuwe stukken toe met de paperclip.',
    tip: 'Vraag daarna om een lijst met alleen de paragrafen die je echt moet herschrijven. Dan weet je waar je tijd in moet steken.',
    added: '2026-10-19'
  },
  {
    id: 'materialiteit-onderbouwen',
    title: 'Je keuze voor de materialiteit helder verwoorden',
    description: 'Jij kiest de grondslag en het percentage, Copilot helpt met een heldere onderbouwing.',
    phase: 'planning',
    task: 'Schrijven',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik heb voor de controle van [ONDERNEMING] over [JAAR] de materialiteit bepaald. Mijn keuzes:
- Grondslag: [GRONDSLAG, bijv. totale opbrengsten]
- Percentage: [PERCENTAGE]
- Materialiteit: [BEDRAG]
- Uitvoeringsmaterialiteit: [BEDRAG UM] ([PERCENTAGE UM] van de materialiteit)
- Waarom deze grondslag: [MIJN OVERWEGINGEN]
- Gebruikers van de jaarrekening: [GEBRUIKERS, bijv. aandeelhouder en bank]

Schrijf hiervan een heldere onderbouwing van maximaal 200 woorden voor het dossier. Gebruik alleen mijn keuzes en overwegingen, voeg geen nieuwe argumenten toe en verander geen bedragen. Noem aan het eind welke informatie een reviewer mogelijk nog mist.`,
    note: 'Werkt met de gratis Copilot Chat. De keuzes zijn en blijven van jou; Copilot helpt alleen met de formulering.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'fraudebespreking',
    title: 'Fraudebespreking met het team voorbereiden',
    description: 'Een gestructureerde agenda en vragen voor de teambespreking over frauderisico\'s.',
    phase: 'planning',
    task: 'Voorbereiden',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik bereid de teambespreking over frauderisico's voor bij de controle van een [SOORT ONDERNEMING, bijv. familiebedrijf in de groothandel] met [AANTAL] medewerkers. Bijzonderheden: [BIJZONDERHEDEN, bijv. bonusregeling op winst, nieuwe financieel directeur, groei via acquisities].

Maak:
1. Een agenda voor een bespreking van 45 minuten.
2. Per element van de fraudedriehoek (druk of prikkel, gelegenheid, rationalisatie) vijf vragen die het team zichzelf kan stellen, toegespitst op deze onderneming.
3. Een lijst met mogelijke frauderisico's, met per risico de posten en beweringen die geraakt kunnen worden, inclusief opbrengstverantwoording en het doorbreken van de interne beheersing door het management.
4. Een opzet voor de vastlegging van de bespreking.

Het zijn voorbeelden om het gesprek op gang te brengen; de inschatting doet het team zelf.`,
    note: 'Werkt met de gratis Copilot Chat. Noem geen namen van personen bij de klant.',
    tip: 'Deel de vragen vooraf met het team, dan begint de bespreking niet bij nul.',
    added: '2026-10-19'
  },

  /* ---- Interne beheersing ------------------------------------------------- */
  {
    id: 'walkthrough-vragen',
    title: 'Vragenlijst voor een walkthrough',
    description: 'Gespreksvragen, verwachte beheersmaatregelen en op te vragen stukken voor één proces.',
    phase: 'beheersing',
    task: 'Voorbereiden',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik ga een walkthrough doen van het [PROCES, bijv. verkoopproces] bij een [SOORT ONDERNEMING]. Ze werken met [SYSTEEM, bijv. Exact Online] en hebben ongeveer [AANTAL] medewerkers op de administratie.

Maak:
1. Een vragenlijst voor het gesprek, in de volgorde van het proces (van begin tot eind), met per stap de vragen: wie, wat, welk systeem, welke vastlegging, welke controle.
2. Een lijst met beheersmaatregelen die ik in dit proces normaal zou verwachten, met het risico dat ze afdekken.
3. Een lijst met stukken die ik tijdens of na het gesprek kan opvragen om het proces te volgen (één transactie van begin tot eind).

Houd de vragen open en neutraal, zodat de klant het proces zelf beschrijft.`,
    note: 'Werkt met de gratis Copilot Chat. Combineer met de usecase "Van walkthrough naar procesbeschrijving".',
    tip: 'Neem het gesprek op met transcriptie: dan kun je na afloop direct de procesbeschrijving laten maken.',
    added: '2026-10-19'
  },
  {
    id: 'it-omgeving',
    title: 'IT-omgeving en algemene IT-beheersing in kaart',
    description: 'Van ingevulde IT-vragenlijst naar een overzicht van systemen, risico\'s en vervolgvragen.',
    phase: 'beheersing',
    task: 'Analyseren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg de door [ONDERNEMING] ingevulde IT-vragenlijst toe, en eventueel mijn aantekeningen van het gesprek met de IT-verantwoordelijke.

Maak:
1. Een overzicht van de systemen die relevant zijn voor de financiële verslaglegging: naam, functie, eigen beheer of uitbesteed, en koppelingen.
2. Een samenvatting van de algemene IT-beheersing per onderwerp: toegangsbeheer, wijzigingsbeheer, back-up en herstel, en beheer door derden.
3. Een tabel met mogelijke risico's, met de kolommen: Onderwerp, Wat de vragenlijst zegt, Mogelijk risico voor de jaarrekening en Vervolgvraag.
4. Een lijst met stukken die ik kan opvragen, zoals een overzicht van gebruikers en rechten of een assurancerapport van de leverancier.

Gebruik alleen de bijgevoegde informatie en markeer onduidelijke antwoorden met "Navragen".`,
    note: 'Werkt met de gratis Copilot Chat: voeg de vragenlijst toe met de paperclip.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'assurancerapport-dienstverlener',
    title: 'ISAE 3402- of SOC-rapport samenvatten',
    description: 'De kern van een assurancerapport van een serviceorganisatie, en wat jij ermee moet.',
    phase: 'beheersing',
    task: 'Samenvatten',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg het assurancerapport [SOORT RAPPORT, bijv. ISAE 3402 type II] toe van [DIENSTVERLENER], die voor mijn klant [DIENST, bijv. de salarisadministratie] verzorgt.

Vat samen:
1. Soort rapport, periode, reikwijdte en welke diensten en systemen erin vallen.
2. Het oordeel van de auditor van de dienstverlener, en eventuele beperkingen of afwijkingen in het oordeel.
3. Alle uitzonderingen die bij het testen zijn gevonden, in een tabel: Beheersdoelstelling, Uitzondering, Reactie van het management en Mogelijke relevantie voor mijn controle.
4. De beheersmaatregelen die de gebruikersorganisatie zelf moet hebben (complementary user entity controls).
5. De periode tussen het einde van de rapportageperiode en onze balansdatum [BALANSDATUM]: wat betekent dat voor mijn werkzaamheden?

Citeer bij uitzonderingen de tekst uit het rapport met paginanummer.`,
    note: 'Werkt met de gratis Copilot Chat: voeg het rapport toe met de paperclip.',
    tip: 'Vraag daarna: "Welke van de gebruikersmaatregelen moet ik bij mijn klant toetsen, en hoe?"',
    added: '2026-10-19'
  },

  /* ---- Gegevensgerichte werkzaamheden ------------------------------------ */
  {
    id: 'contract-doorlichten',
    title: 'Een contract doorlichten voor de controle',
    description: 'Looptijd, bedragen, verplichtingen en niet uit de balans blijkende verplichtingen op een rij.',
    phase: 'gegevensgericht',
    task: 'Analyseren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg het contract [SOORT CONTRACT, bijv. huurovereenkomst bedrijfspand] toe tussen [PARTIJEN]. Ik beoordeel het voor de controle van de jaarrekening [JAAR] van [ONDERNEMING].

Maak een overzicht met:
1. Partijen, onderwerp, ingangsdatum, looptijd, verlengings- en opzegmogelijkheden.
2. Alle bedragen: vergoedingen, betalingstermijnen, indexatie, borg, boetes en bonussen.
3. Verplichtingen per partij, inclusief garanties, zekerheden en exclusiviteit.
4. Wat dit kan betekenen voor de jaarrekening: verwerking, waardering, en niet uit de balans blijkende verplichtingen met een berekening van de resterende verplichting per balansdatum [BALANSDATUM].
5. Afwijkende of ongebruikelijke bepalingen.

Verwijs bij ieder punt naar het artikel. Staat iets niet in het contract, schrijf dan "Niet geregeld". Geef geen juridisch oordeel; markeer onduidelijkheden als vraag.`,
    note: 'Werkt met de gratis Copilot Chat. Is het contract in een andere taal? Vraag dan om de originele tekst met een Nederlandse vertaling eronder.',
    tip: 'Laat de berekening van de resterende verplichting zien en reken hem zelf na.',
    added: '2026-10-19'
  },
  {
    id: 'saldibevestigingen-verschillen',
    title: 'Verschillen uit saldibevestigingen uitzoeken',
    description: 'Bevestigde saldi naast de administratie, met een eerste indeling van de verschillen.',
    phase: 'gegevensgericht',
    task: 'Analyseren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg een Excel-bestand toe met de ontvangen saldibevestigingen van [DEBITEUREN OF CREDITEUREN] van [ONDERNEMING] per [BALANSDATUM], met per relatie het saldo volgens de administratie en het bevestigde saldo, en de openstaande-postenlijst.

1. Bereken per relatie het verschil.
2. Maak een tabel van alle verschillen groter dan [GRENS], met: Relatie, Saldo administratie, Bevestigd saldo, Verschil en Mogelijke oorzaak volgens de openstaande posten (bijvoorbeeld een factuur of betaling rond balansdatum).
3. Deel de verschillen in: waarschijnlijk tijdsverschil, nog onverklaard, of mogelijk een afwijking.
4. Geef per onverklaard verschil de vervolgstap.
5. Geef het percentage van het totale saldo dat is bevestigd.

Een mogelijke oorzaak is een hypothese; markeer die als "Hypothese" totdat ik hem heb uitgezocht.`,
    note: 'Werkt met de gratis Copilot Chat: voeg het bestand toe met de paperclip.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'schattingspost',
    title: 'Een schattingspost kritisch bekijken',
    description: 'Aannames, gevoeligheid en vragen bij bijvoorbeeld een voorziening of een waardering.',
    phase: 'gegevensgericht',
    task: 'Analyseren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik controleer de schattingspost [POST, bijv. de voorziening dubieuze debiteuren] van [ONDERNEMING] per [BALANSDATUM]. Ik voeg de berekening van de klant toe, en de berekening van vorig jaar met de werkelijke uitkomst.

1. Beschrijf de methode van de klant en alle aannames die erin zitten.
2. Vergelijk de schatting van vorig jaar met de werkelijke uitkomst: hoe groot was het verschil en wat zegt dat over de betrouwbaarheid van de methode?
3. Laat zien hoe gevoelig de uitkomst is voor de belangrijkste aanname: wat gebeurt er bij een redelijke andere aanname? Laat de berekening zien.
4. Noem signalen van mogelijke eenzijdigheid van het management.
5. Maak een lijst met vragen voor de klant en de stukken die ik daarbij wil zien.

Gebruik alleen de bijgevoegde stukken. Het oordeel over de redelijkheid van de schatting doe ik zelf.`,
    note: 'Werkt met de gratis Copilot Chat: voeg de berekeningen toe met de paperclip.',
    tip: 'Vraag daarna om een tabel met drie scenario\'s (laag, verwacht, hoog). Handig voor je bespreking met de opdrachtverantwoordelijke.',
    added: '2026-10-19'
  },
  {
    id: 'steekproef-vastleggen',
    title: 'Je deelwaarneming duidelijk vastleggen',
    description: 'Van jouw keuzes naar een heldere beschrijving van populatie, methode en omvang.',
    phase: 'gegevensgericht',
    task: 'Schrijven',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Help me de vastlegging van een deelwaarneming te schrijven. Mijn gegevens:
- Doel van de werkzaamheid: [DOEL]
- Populatie: [POPULATIE, bijv. verkoopfacturen 2026, 4.812 stuks, totaal € 8,4 mln]
- Hoe ik de volledigheid van de populatie heb vastgesteld: [AANSLUITING]
- Selectiemethode: [METHODE, bijv. monetary unit sampling]
- Omvang van de deelwaarneming en hoe die is bepaald: [OMVANG EN ONDERBOUWING]
- Wat ik per post controleer: [WERKZAAMHEDEN]

Schrijf hiervan een vastlegging van maximaal 250 woorden met de kopjes: Doel, Populatie, Selectie, Werkzaamheden en Evaluatie van afwijkingen. Laat de evaluatie open met plaatshouders voor de uitkomst. Verander geen getallen en voeg geen keuzes toe; noem aan het eind wat er volgens jou nog ontbreekt.`,
    note: 'Werkt met de gratis Copilot Chat. De methode en omvang bepaal je zelf volgens de kantoormethodiek.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'voorraadopname',
    title: 'Instructie voor het bijwonen van de voorraadopname',
    description: 'Een praktisch draaiboek en checklist voor het team dat bij de telling aanwezig is.',
    phase: 'gegevensgericht',
    task: 'Voorbereiden',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg de telinstructie toe van [ONDERNEMING], een [SOORT ONDERNEMING], voor de voorraadopname op [DATUM]. De voorraad ligt op [AANTAL] locaties en bestaat uit [SOORT VOORRAAD].

Maak voor ons team:
1. Een beoordeling van de telinstructie: wat is goed geregeld en wat mist er (bijvoorbeeld afgrenzing, dubbeltellingen voorkomen, incourante voorraad markeren)?
2. Een draaiboek voor de dag: wat doen we vóór, tijdens en na de telling?
3. Een checklist voor de teller van ons team, met tellingen van vloer naar lijst en van lijst naar vloer.
4. Een lijst met gegevens die we moeten vastleggen voor de afgrenzing (laatste ontvangst- en verzenddocumenten).

Schrijf kort en praktisch, zodat een junior het op een tablet kan volgen.`,
    note: 'Werkt met de gratis Copilot Chat: voeg de telinstructie van de klant toe met de paperclip.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'excel-formule',
    title: 'Een Excel-formule laten maken of uitleggen',
    description: 'Van gewone taal naar een werkende formule, of andersom.',
    phase: 'gegevensgericht',
    task: 'Analyseren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik werk in Excel met een tabel met de kolommen [KOLOMMEN, bijv. A: factuurnummer, B: datum, C: debiteur, D: bedrag].

Ik wil: [WAT JE WILT, bijv. per debiteur het totaal van de facturen na 15 december, alleen als het bedrag boven € 5.000 ligt].

Geef:
1. De formule (Nederlandse Excel-functienamen, met puntkomma's als scheidingsteken).
2. Een uitleg per onderdeel van de formule in gewone taal.
3. Een manier om de uitkomst te controleren.`,
    note: 'Werkt met de gratis Copilot Chat. Met een licentie kun je het in Copilot in Excel direct in je bestand laten doen.',
    tip: 'Een formule die je niet begrijpt? Plak hem en vraag: "Leg deze formule stap voor stap uit."',
    added: '2026-10-19'
  },

  /* ---- Afronding & rapportage --------------------------------------------- */
  {
    id: 'versies-vergelijken',
    title: 'Twee versies van de jaarrekening vergelijken',
    description: 'Alle wijzigingen tussen concept 2 en concept 3 in één tabel.',
    phase: 'afronding',
    task: 'Controleren',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg twee versies toe van de jaarrekening [JAAR] van [ONDERNEMING]: [VERSIE A] en [VERSIE B].

Vergelijk de versies en maak een tabel met alle verschillen, met de kolommen: Nr., Onderdeel (bijvoorbeeld balans, toelichting op de voorraad), Pagina in versie A, Pagina in versie B, Wat er stond, Wat er nu staat en Soort wijziging (bedrag, tekst, nieuw, verwijderd).

Neem ook kleine wijzigingen op, zoals afrondingen en tekstcorrecties. Controleer daarna of de wijzigingen in bedragen overal zijn doorgevoerd: balans, winst-en-verliesrekening, kasstroomoverzicht, toelichting en tekst.`,
    note: 'Werkt met de gratis Copilot Chat: voeg beide versies toe met de paperclip.',
    tip: 'Vraag daarna: "Welke wijzigingen raken de bedragen in de controleverklaring of de bevestigingsbrief?"',
    added: '2026-10-19'
  },
  {
    id: 'bevestigingsbrief',
    title: 'Specifieke punten voor de bevestigingsbrief',
    description: 'Voorstellen voor opdrachtspecifieke bevestigingen op basis van je dossier.',
    phase: 'afronding',
    task: 'Schrijven',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik stel de schriftelijke bevestiging van het management (bevestigingsbrief) op voor de controle van [ONDERNEMING] over [JAAR]. De standaardtekst van ons kantoor gebruik ik als basis. Bijzondere onderwerpen in deze controle: [ONDERWERPEN, bijv. een lopende claim van een afnemer, een lening van de DGA, een belangrijke schatting van de garantievoorziening].

Stel per onderwerp een concrete, specifieke bevestiging voor die het management kan afgeven. Schrijf in de stijl van een bevestigingsbrief ("Wij bevestigen dat ...") en houd elke bevestiging feitelijk en controleerbaar.

Noem daarnaast per onderwerp welke andere controle-informatie ik nodig heb: een bevestiging van het management komt niet in de plaats van ander bewijs.`,
    note: 'Werkt met de gratis Copilot Chat. Gebruik altijd de kantoortemplate als basis.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'reviewpunten',
    title: 'Reviewpunten ordenen en beantwoorden',
    description: 'Een overzicht van alle reviewpunten met een voorstel voor je antwoord en actie.',
    phase: 'afronding',
    task: 'Plannen',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Hieronder staan de reviewpunten van [REVIEWER] op het dossier van [ONDERNEMING] [JAAR]:

[PLAK HIER DE REVIEWPUNTEN]

Maak een tabel met de kolommen: Nr., Onderdeel van het dossier, Reviewpunt in het kort, Soort (vastlegging, extra werkzaamheden, vraag aan de klant, verduidelijking), Wat ik moet doen, Geschatte tijd en Prioriteit.

Sorteer op prioriteit. Zet daarna de vragen aan de klant bij elkaar, zodat ik ze in één mail kan sturen. Formuleer geen antwoorden op inhoudelijke punten waarvoor ik eerst werk moet doen.`,
    note: 'Werkt met de gratis Copilot Chat: plak de reviewpunten in de prompt.',
    tip: 'Maak van de tabel een afvinklijst in Microsoft To Do of Planner, dan houd je overzicht tot het dossier dicht is.',
    added: '2026-10-19'
  },
  {
    id: 'memo-herschrijven',
    title: 'Een dossiermemo helder herschrijven',
    description: 'Dezelfde inhoud in een vaste opbouw, zodat een reviewer hem in één keer snapt.',
    phase: 'afronding',
    task: 'Schrijven',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Herschrijf de memo hieronder voor het controledossier, zonder de inhoud te veranderen. Gebruik deze opbouw:
1. Aanleiding (waarom deze memo)
2. Feiten (wat hebben we vastgesteld, met bron)
3. Werkzaamheden (wat hebben we gedaan)
4. Beoordeling (hoe weegt het team dit)
5. Conclusie

Regels:
- Behoud alle feiten, bedragen en bronverwijzingen precies zoals ze er staan.
- Schrijf zakelijk en compact, in actieve zinnen.
- Voeg niets toe. Mist er volgens jou iets dat een reviewer verwacht, zet dat dan onder de memo bij "Mogelijk ontbrekend".

[PLAK HIER DE MEMO]`,
    note: 'Werkt met de gratis Copilot Chat: plak de memo of voeg het bestand toe.',
    tip: '',
    added: '2026-10-19'
  },

  /* ---- Klant- en teamcommunicatie ------------------------------------------ */
  {
    id: 'informatieverzoek',
    title: 'Informatieverzoek (PBC-lijst) als heldere mail',
    description: 'Van een lijst met op te vragen stukken naar een vriendelijke, overzichtelijke mail.',
    phase: 'communicatie',
    task: 'Schrijven',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Schrijf een e-mail aan [CONTACTPERSOON] van [ONDERNEMING] waarin ik de stukken opvraag voor de [FASE, bijv. jaarrekeningcontrole 2026]. De stukken:

[PLAK HIER DE LIJST]

Regels:
- Groepeer de stukken per onderwerp (bijvoorbeeld vaste activa, voorraad, personeel) in een tabel met: Nr., Stuk, Toelichting (wat we precies nodig hebben) en Uiterlijk aanleveren.
- Leg in gewone taal uit waarom we iets nodig hebben als dat niet vanzelf spreekt.
- Uiterste aanleverdatum: [DATUM]. Vraag om stukken die eerder klaar zijn alvast te sturen.
- Vriendelijk en zakelijk, maximaal 150 woorden buiten de tabel. Onderteken met [NAAM].`,
    note: 'Werkt met de gratis Copilot Chat. Met een licentie kun je de mail direct in Outlook laten opstellen.',
    tip: 'Vraag daarna: "Maak van de tabel een Excel-lijst met een kolom Status", dan houd je de voortgang bij.',
    added: '2026-10-19'
  },
  {
    id: 'herinnering-stukken',
    title: 'Vriendelijke herinnering voor openstaande stukken',
    description: 'Copilot zoekt in je mail wat er al binnen is en schrijft een herinnering voor de rest.',
    phase: 'communicatie',
    task: 'Schrijven',
    tool: 'Copilot Chat (Werk)',
    license: true,
    prompt: `Zoek in mijn mail van de afgelopen [AANTAL] weken naar berichten van en aan [ONDERNEMING] over de stukken voor de controle. Vergelijk dat met deze lijst van opgevraagde stukken:

[PLAK HIER DE LIJST]

1. Maak een tabel: Stuk, Ontvangen (ja/nee/deels), Datum ontvangen en Opmerking.
2. Schrijf daarna een vriendelijke herinnering aan [CONTACTPERSOON] voor alles wat nog openstaat, met de nieuwe uiterste datum [DATUM]. Bedank voor wat al binnen is. Maximaal 120 woorden.

Twijfel je of een stuk is ontvangen, zet het dan op "deels" en noem het bericht waarin het genoemd wordt.`,
    note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk); Copilot zoekt in je eigen mailbox.',
    tip: 'Maak hier een geplande prompt van voor elke dinsdag tijdens de controle.',
    added: '2026-10-19'
  },
  {
    id: 'bevinding-uitleggen',
    title: 'Een bevinding uitleggen aan de ondernemer',
    description: 'Een technische bevinding in begrijpelijke taal, met wat de klant moet doen.',
    phase: 'communicatie',
    task: 'Schrijven',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Leg de volgende bevinding uit aan [ONTVANGER, bijv. de DGA van een MKB-onderneming], die geen financiële achtergrond heeft:

[BEVINDING]

Schrijf:
1. In twee zinnen wat er aan de hand is.
2. Waarom het belangrijk is voor de onderneming (niet voor de accountant).
3. Wat de ondernemer concreet kan doen, in maximaal drie stappen.

Gebruik geen vaktermen, of leg ze in één zin uit. Toon: behulpzaam en duidelijk, niet belerend. Maximaal 150 woorden.`,
    note: 'Werkt met de gratis Copilot Chat. Noem geen klantnaam als dat niet nodig is.',
    tip: 'Vraag om twee versies: één voor in een mail en één als gespreksnotitie voor een overleg.',
    added: '2026-10-19'
  },
  {
    id: 'teams-bijpraten',
    title: 'Bijgepraat in een Teams-chat of kanaal',
    description: 'Wat heb je gemist in het opdrachtteam terwijl je bij een andere klant zat?',
    phase: 'communicatie',
    task: 'Samenvatten',
    tool: 'Copilot in Teams',
    license: true,
    prompt: `Vat de berichten in deze chat samen van [DATUM] tot nu. Geef:
1. De belangrijkste onderwerpen en besluiten.
2. Vragen of verzoeken die aan mij zijn gesteld en nog geen antwoord hebben.
3. Acties met eigenaar en deadline.
4. Stukken of links die zijn gedeeld.

Kort en in opsommingen.`,
    note: 'Open Copilot in de Teams-chat of het kanaal van het opdrachtteam (licentie).',
    tip: '',
    added: '2026-10-19'
  },

  /* ---- Eigen werk & planning ----------------------------------------------- */
  {
    id: 'urenoverzicht',
    title: 'Weekoverzicht voor je urenregistratie',
    description: 'Copilot zet per klant en per dag op een rij waar je aan hebt gewerkt.',
    phase: 'eigen-werk',
    task: 'Plannen',
    tool: 'Copilot Chat (Werk)',
    license: true,
    prompt: `Maak een overzicht van waar ik deze week (maandag tot en met vandaag) aan heb gewerkt, als hulp bij mijn urenregistratie. Gebruik mijn agenda, mijn verzonden e-mails, de Teams-vergaderingen waaraan ik heb deelgenomen en de bestanden die ik heb bewerkt.

Maak een tabel per dag met: Klant of opdracht, Activiteit, Bron (afspraak, mail, bestand) en Geschatte tijd (alleen als die uit de agenda blijkt).

Zet aan het eind een totaal per klant. Kun je een activiteit niet aan een klant koppelen, zet die dan onder "Onbekend".`,
    note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Het is een hulpmiddel: jouw urenregistratie blijft leidend.',
    tip: 'Plan deze prompt voor elke vrijdag om 15:00. Zie de tip "Geplande prompts".',
    added: '2026-10-19'
  },
  {
    id: 'afspraak-voorbereiden',
    title: 'Je volgende klantafspraak voorbereiden',
    description: 'Alles over de klant uit mail, Teams en bestanden, met een agenda en goede vragen.',
    phase: 'eigen-werk',
    task: 'Voorbereiden',
    tool: 'Copilot Chat (Werk)',
    license: true,
    prompt: `Bereid mij voor op mijn eerstvolgende afspraak met [KLANTNAAM].

Gebruik relevante informatie uit de agenda-uitnodiging, e-mails met [KLANTNAAM] van de afgelopen [AANTAL] weken, eerdere vergaderingen en bestanden waarin [KLANTNAAM] wordt genoemd.

Geef:
1. Datum, tijd, deelnemers en doel van de afspraak
2. Stand van zaken van de controle: wat is gedaan, wat loopt, wat staat open
3. Openstaande acties voor ons en voor de klant
4. Mogelijke knelpunten
5. Vijf vragen die ik kan stellen
6. Een voorgestelde agenda

Vermeld bij ieder feit de bron. Maak onderscheid tussen bevestigde informatie en jouw suggesties.`,
    note: 'Gebruik in Microsoft 365 Copilot Chat (tabblad Werk). Typ / en kies de afspraak uit je agenda.',
    tip: '',
    added: '2026-10-19'
  },
  {
    id: 'regelgeving-begrijpen',
    title: 'Een nieuwe regel of standaard snel begrijpen',
    description: 'Wat verandert er, voor wie, vanaf wanneer, en wat betekent het voor de controle?',
    phase: 'eigen-werk',
    task: 'Samenvatten',
    tool: 'Copilot Chat',
    license: false,
    prompt: `Ik voeg [DOCUMENT, bijv. de publicatie van de NBA of de nieuwe RJ-uiting] toe. Leg uit voor een auditor in een MKB-praktijk:
1. Wat er verandert, in maximaal vijf punten.
2. Voor welke organisaties het geldt en vanaf wanneer.
3. Wat het betekent voor de controle en voor het dossier.
4. Wat het betekent voor de klant, als ik het moet uitleggen.
5. Drie vragen die ik nog zou moeten uitzoeken.

Gebruik alleen het bijgevoegde document en verwijs naar de paragraaf. Wat niet in het document staat, markeer je met "Niet in het document".`,
    note: 'Werkt met de gratis Copilot Chat: voeg de publicatie toe. Zonder document zoekt Copilot op internet; controleer dan de bronnen extra goed.',
    tip: '',
    added: '2026-10-19'
  }
];
