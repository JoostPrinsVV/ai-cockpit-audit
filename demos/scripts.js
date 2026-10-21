/* ==========================================================================
   AI COCKPIT AUDIT — GESPREKKEN VOOR DE NAGESPEELDE DEMO'S
   --------------------------------------------------------------------------
   Iedere demo is een gesprek met Copilot dat demos/player.html afspeelt.
   Adres: demos/player.html#<naam>; in data/usecases.js bij 'demo'.

   ALLE NAMEN, BEDRAGEN, CITATEN EN ORGANISATIES ZIJN VERZONNEN.
   De antwoorden laten zien wat je kunt verwachten; echte uitkomsten
   verschillen per document en per versie van Copilot.

   Velden per demo:
     title, summary   Voor het start- en eindscherm (los geopend)
     mode             Label linksboven, bijv. 'Copilot Chat' of 'Analyst'
     greeting         Begroeting op het lege scherm
     chips            Voorbeeldknoppen op het lege scherm (optioneel)
     turns            Beurten: { files, prompt, paste, steps, answer, suggestions, read }
                      paste: true = prompt wordt geplakt (lange prompts), anders getypt
                      steps: [['Naam', 'Uitleg'], ...] denkstappen van Copilot
                      answer: blokken ['p', tekst] ['h2'|'h3', tekst] ['ul'|'ol', [..]]
                              ['table', [kop], [[rij], ...]] ['note', tekst] ['code', label, code]
                      read: hoe lang (ms) we de eerste tabel laten zien
   Opmaak in teksten: **vet** en [[bron]].
   ========================================================================== */

window.AuditDemos = {

  /* ---- Planning: risico-inventarisatie ---------------------------------- */
  risicoanalyse: {
    title: 'Risico-inventarisatie voor de planning',
    summary: 'Van jaarrekening en gespreksnotities naar een risicotabel en een concept-risicoparagraaf.',
    mode: 'Copilot Chat',
    greeting: 'Hallo, waarmee kan ik je vandaag helpen?',
    chips: ['Bestanden samenvatten', 'Een tekst schrijven', 'Iets analyseren', '···'],
    turns: [
      {
        files: ['Jaarrekening 2025 Nordhaven BV.pdf', 'Notities planningsgesprek 14-10-2026.docx'],
        paste: true,
        prompt: 'Je bent een ervaren auditor die de controle van Nordhaven B.V. over boekjaar 2026 voorbereidt. De onderneming is actief in de groothandel in installatietechniek. Ik voeg toe: de jaarrekening over 2025 en mijn aantekeningen van het planningsgesprek met de klant.\n\nMaak een eerste risico-inventarisatie voor de planning.\n\n1. Beschrijf in maximaal vijf zinnen het bedrijfsmodel en de belangrijkste ontwikkelingen sinds vorig jaar, volgens de stukken.\n2. Maak een tabel met de kolommen: Nr., Post of proces, Mogelijk risico, Bewering(en), Waarom (met bron en pagina), Inschatting inherent risico en Eerste idee voor de aanpak.\n3. Besteed apart aandacht aan fraude, schattingsposten, verbonden partijen en continuïteit.\n4. Sluit af met maximaal acht vragen voor de klant.\n\nWerkwijze: gebruik alleen de bijgevoegde stukken, vermeld bij elk risico de bron en markeer aannames met "Aanname".',
        steps: [
          ['Bestanden lezen', 'Ik lees de jaarrekening 2025 (32 pagina\'s) en je notities van het planningsgesprek.'],
          ['Risico\'s afleiden', 'Ik koppel ontwikkelingen uit de notities aan posten en beweringen in de jaarrekening.']
        ],
        answer: [
          ['h3', 'Bedrijfsmodel en ontwikkelingen'],
          ['p', 'Nordhaven B.V. is een groothandel in installatietechniek (warmtepompen, zonnepanelen en klimaatsystemen) met circa 60 fte. De omzet steeg in 2025 met 14% naar € 18,4 mln [[JR p. 6]]. Volgens je notities is de vraag naar warmtepompen in 2026 gedaald na een wijziging van de subsidieregeling, en is er sinds maart een nieuwe financieel manager [[Notities §2]]. De voorraad lag eind 2025 al 38% hoger dan een jaar eerder [[JR p. 14]].'],
          ['h3', 'Risico-inventarisatie'],
          ['table',
            ['Nr.', 'Post of proces', 'Mogelijk risico', 'Bewering(en)', 'Waarom (bron)', 'Inherent risico', 'Eerste idee aanpak'],
            [
              ['1', 'Voorraden', 'Overwaardering door incourante warmtepompen', 'Waardering', 'Voorraad € 4,1 mln (+38%) [[JR p. 14]]; vraag gedaald [[Notities §3]]', 'Hoog', 'Incourantheidsanalyse; verkopen na balansdatum'],
              ['2', 'Omzet', 'Omzet te vroeg verantwoord bij projecten met installatie', 'Bestaan, afgrenzing', 'Nieuwe projectcontracten met oplevering [[Notities §4]]', 'Hoog', 'Contracten beoordelen; afgrenzing rond balansdatum'],
              ['3', 'Garantievoorziening', 'Te lage voorziening bij meer claims', 'Volledigheid, waardering', 'Voorziening gelijk gebleven (€ 210.000) [[JR p. 19]]', 'Middel', 'Claims analyseren; vergelijken met werkelijk verbruik'],
              ['4', 'Lening DGA-holding', 'Voorwaarden of toelichting onvolledig', 'Presentatie', 'Lening € 750.000 van de holding [[JR p. 21]]', 'Middel', 'Overeenkomst en toelichting verbonden partijen'],
              ['5', 'Financiering', 'Bankconvenant onder druk', 'Continuïteit', 'Eis solvabiliteit 25%, eind 2025: 27% [[JR p. 22]]', 'Middel', 'Prognose 2026 en convenantberekening'],
              ['6', 'Crediteuren', 'Niet alle verplichtingen verwerkt', 'Volledigheid', 'Achterstand na wissel financieel manager [[Notities §2]]', 'Middel', 'Zoeken naar niet-verwerkte facturen']
            ]
          ],
          ['h3', 'Fraude, schattingen, verbonden partijen en continuïteit'],
          ['ul', [
            '**Fraude:** omzetverantwoording rond balansdatum, mede door de bonusregeling van het verkoopteam op omzet [[Notities §5]], en het doorbreken van de interne beheersing door het management.',
            '**Schattingen:** incourantheid van de voorraad en de garantievoorziening.',
            '**Verbonden partijen:** de lening van en de huur van het bedrijfspand bij de DGA-holding [[JR p. 21]].',
            '**Continuïteit:** dalende vraag in combinatie met het convenant. Aanname: er is in 2026 geen nieuwe financiering aangetrokken.'
          ]],
          ['h3', 'Vragen voor de klant'],
          ['ol', [
            'Hoe hebben de verkopen van warmtepompen zich na de subsidiewijziging ontwikkeld, per maand?',
            'Welke voorraad ligt er langer dan twaalf maanden, en hoe bepalen jullie de incourantheid?',
            'Wanneer verantwoorden jullie de omzet bij projecten met installatie: bij levering of bij oplevering?',
            'Zijn de garantieclaims in 2026 gestegen? Is er een overzicht per productgroep?',
            'Zijn de voorwaarden van de lening van de holding gewijzigd?',
            'Hoe staat het met het bankconvenant per het laatste kwartaal?'
          ]]
        ],
        suggestions: ['Maak hiervan de risicoparagraaf voor de planningsmemo', 'Welke risico\'s zijn mogelijk significant?'],
        read: 4200
      },
      {
        prompt: 'Zet de risico\'s met inschatting "hoog" en "middel" om in een concept-paragraaf "Risico\'s en controleaanpak" voor de planningsmemo. Laat de bronverwijzingen staan.',
        steps: [['Paragraaf opstellen', 'Ik zet per risico het risico, de beweringen, de reden en de voorgestelde werkzaamheden op een rij.']],
        answer: [
          ['h2', 'Risico\'s en controleaanpak (concept)'],
          ['h3', '1. Waardering van de voorraden (hoog)'],
          ['p', 'De voorraad steeg in 2025 met 38% naar € 4,1 mln [[JR p. 14]], terwijl de vraag naar warmtepompen in 2026 is gedaald [[Notities §3]]. Er is een risico dat incourante voorraad te hoog gewaardeerd is. **Werkzaamheden:** analyse van de omloopsnelheid per artikelgroep, beoordeling van de incourantheidsvoorziening en controle van verkopen na balansdatum.'],
          ['h3', '2. Omzetverantwoording bij projecten (hoog)'],
          ['p', 'Door nieuwe projectcontracten met installatie en oplevering [[Notities §4]] en een bonusregeling op omzet [[Notities §5]] bestaat het risico dat omzet te vroeg wordt verantwoord. **Werkzaamheden:** beoordeling van de contractvoorwaarden, afgrenzingscontrole rond balansdatum en gegevensgerichte controle van projecten in uitvoering.'],
          ['h3', '3. Garantievoorziening, verbonden partijen, financiering en crediteuren (middel)'],
          ['p', 'Garantievoorziening: vergelijking met het werkelijke verbruik en de claimontwikkeling [[JR p. 19]]. Verbonden partijen: lening en huur van de holding, toelichting nagaan [[JR p. 21]]. Financiering: convenantberekening en prognose [[JR p. 22]]. Crediteuren: zoeken naar niet-verwerkte verplichtingen na de wissel van de financieel manager [[Notities §2]].'],
          ['note', 'Concept op basis van de bijgevoegde stukken. Beoordeel de inschattingen en vul aan met je eigen kennis van de klant.']
        ],
        review: false
      }
    ]
  },

  /* ---- Interne beheersing: walkthrough ---------------------------------- */
  walkthrough: {
    title: 'Van walkthrough naar procesbeschrijving',
    summary: 'Uit een transcriptie van een walkthrough: procesbeschrijving, beheersmaatregelen, tekortkomingen en testaanpak.',
    mode: 'Copilot Chat',
    greeting: 'Hallo, waarmee kan ik je vandaag helpen?',
    chips: ['Bestanden samenvatten', 'Notulen maken', 'Iets analyseren', '···'],
    turns: [
      {
        files: ['Transcriptie walkthrough inkoop Nordhaven 08-10-2026.docx'],
        paste: true,
        prompt: 'Ik voeg de transcriptie toe van een walkthrough van het inkoopproces bij Nordhaven B.V. op 8 oktober 2026. Gesprekspartners: Ilse Mulder (inkoper) en Ruud Peters (financieel manager).\n\nMaak hiervan:\n1. Een procesbeschrijving in genummerde stappen, van begin tot eind. Vermeld per stap wie het doet, welk systeem of document wordt gebruikt en wat er wordt vastgelegd.\n2. Een tabel met beheersmaatregelen, met de kolommen: Nr., Beheersmaatregel, Stap, Soort, Handmatig of geautomatiseerd, Frequentie, Uitvoerder, Risico dat wordt afgedekt en Fragment uit de transcriptie.\n3. Een lijst met de functiescheidingen die worden genoemd, en waar functiescheiding lijkt te ontbreken.\n\nRegels: gebruik alleen wat in de transcriptie staat, neem bij iedere beheersmaatregel het letterlijke fragment op en markeer onduidelijkheden met "Navragen".',
        steps: [
          ['Transcriptie lezen', 'Ik lees de transcriptie van 42 minuten met drie sprekers.'],
          ['Proces in kaart brengen', 'Ik orden de stappen van inkoopaanvraag tot betaling en zoek de controles.']
        ],
        answer: [
          ['h3', 'Procesbeschrijving inkoop'],
          ['ol', [
            '**Aanvraag:** de magazijnchef maakt een inkoopaanvraag in Exact zodra een artikel onder de minimumvoorraad komt [[03:12]].',
            '**Bestelling:** de inkoper zet de aanvraag om in een inkooporder. Orders boven € 25.000 moeten in de workflow worden goedgekeurd door de financieel manager [[05:40]].',
            '**Ontvangst:** het magazijn boekt de ontvangst op de order op basis van de pakbon [[11:05]].',
            '**Factuur:** facturen komen binnen via scan-en-herken; Exact matcht order, ontvangst en factuur automatisch [[17:20]].',
            '**Afwijkingen:** bij een prijs- of aantalsverschil van meer dan 2% gaat de factuur terug naar de inkoper [[19:48]].',
            '**Betaling:** de financieel medewerker zet wekelijks een betaalbatch klaar; de financieel manager keurt die goed in het bankportaal [[26:30]].'
          ]],
          ['h3', 'Beheersmaatregelen'],
          ['table',
            ['Nr.', 'Beheersmaatregel', 'Stap', 'Soort', 'H/G', 'Frequentie', 'Uitvoerder', 'Risico', 'Fragment'],
            [
              ['BM1', 'Goedkeuring orders > € 25.000', '2', 'Preventief', 'Handmatig in workflow', 'Per order', 'Financieel manager', 'Ongeautoriseerde inkoop', '"boven de 25 mille moet Ruud het goedkeuren" [[05:40]]'],
              ['BM2', '3-way-match order, ontvangst en factuur', '4', 'Detectief', 'Geautomatiseerd', 'Per factuur', 'Exact', 'Betalen zonder levering', '"dat matcht het systeem gewoon automatisch" [[17:20]]'],
              ['BM3', 'Afwijking > 2% terug naar inkoper', '5', 'Detectief', 'Handmatig', 'Bij afwijking', 'Inkoper', 'Te hoge prijs betaald', '"alles boven de twee procent krijg ik terug" [[19:48]]'],
              ['BM4', 'Goedkeuring betaalbatch (vier ogen)', '6', 'Preventief', 'Handmatig', 'Wekelijks', 'Financieel manager', 'Onterechte betalingen', '"ik zet hem klaar en Ruud keurt hem goed" [[26:30]]'],
              ['BM5', 'Controle wijziging bankrekening leverancier', '–', 'Preventief', 'Navragen', 'Navragen', 'Navragen', 'Betaling aan fraudeur', 'Navragen: niet duidelijk wie dit controleert [[29:15]]']
            ]
          ],
          ['h3', 'Functiescheiding'],
          ['ul', [
            'Bestellen (inkoop) en ontvangen (magazijn) zijn gescheiden [[11:05]].',
            'Mogelijk ontbrekend: de inkoper kan ook stamgegevens van leveranciers wijzigen, inclusief de bankrekening [[12:40]].',
            'Navragen: tijdens vakanties van de financieel manager "keurt Ilse de batch soms goed" [[31:05]].'
          ]]
        ],
        suggestions: ['Welke tekortkomingen zie je in de opzet?', 'Maak een testplan voor de beheersmaatregelen'],
        read: 4200
      },
      {
        prompt: 'Beoordeel mogelijke tekortkomingen in de opzet, welke vragen ik nog moet stellen, en geef een voorstel voor het testen van opzet, bestaan en werking.',
        steps: [['Opzet beoordelen', 'Ik vergelijk de risico\'s in het proces met de genoemde beheersmaatregelen.']],
        answer: [
          ['h3', 'Mogelijke tekortkomingen in de opzet'],
          ['table',
            ['Tekortkoming', 'Risico', 'Bron'],
            [
              ['Inkoper kan bankrekeningen van leveranciers wijzigen', 'Betalingen naar een verkeerde rekening, zonder dat iemand het ziet', '[[12:40]], [[29:15]]'],
              ['Inkoper keurt bij afwezigheid de betaalbatch goed', 'Vier-ogenprincipe vervalt; bestellen én betalen in één hand', '[[31:05]]'],
              ['Geen controle zichtbaar op orders onder € 25.000', 'Opsplitsen van orders om de goedkeuring te omzeilen', '[[05:40]]']
            ]
          ],
          ['h3', 'Nog navragen'],
          ['ul', [
            'Wie controleert wijzigingen in de stamgegevens, en wordt dat vastgelegd?',
            'Wie keurt de betaalbatch goed bij afwezigheid van de financieel manager, en is dat formeel geregeld?',
            'Is de tolerantie van 2% in Exact ingesteld en wie kan die wijzigen?'
          ]],
          ['h3', 'Voorstel testaanpak'],
          ['table',
            ['Beheersmaatregel', 'Opzet en bestaan', 'Werking', 'Populatie', 'Omvang (te overwegen)'],
            [
              ['BM1 Goedkeuring orders', 'Eén order volgen van begin tot eind', 'Goedkeuring in workflow controleren', 'Orders > € 25.000', 'Volgens kantoormethodiek (bijv. 25)'],
              ['BM2 3-way-match', 'Instellingen Exact inzien', 'Afhankelijk van IT-beheersing; anders gegevensgericht', 'Alle inkoopfacturen', 'Eén test per instelling'],
              ['BM4 Betaalbatch', 'Bankportaal: rechten en goedkeuringsregels', 'Goedkeuring per batch controleren', 'Wekelijkse batches', 'Volgens kantoormethodiek']
            ]
          ],
          ['note', 'Voorstellen op basis van de transcriptie. De keuze voor de aanpak en de omvang maak je zelf.']
        ],
        read: 3500
      }
    ]
  },

  /* ---- Gegevensgericht: cijferanalyse ------------------------------------- */
  cijferanalyse: {
    title: 'Cijferanalyse op de proefsaldibalans',
    summary: 'Verschillen boven de uitvoeringsmaterialiteit, kengetallen en vragen voor de klant.',
    mode: 'Copilot Chat',
    greeting: 'Hallo, waarmee kan ik je vandaag helpen?',
    chips: ['Iets analyseren', 'Een formule maken', 'Bestanden samenvatten', '···'],
    turns: [
      {
        files: ['Proefsaldibalans 2025-2026 Brouwer Logistics.xlsx'],
        paste: true,
        prompt: 'Het bijgevoegde Excel-bestand bevat de proefsaldibalans van Brouwer Logistics B.V. per 30 juni 2026 en die van het vergelijkende jaar. De uitvoeringsmaterialiteit is € 85.000.\n\nVoer een cijferanalyse uit:\n1. Bereken per grootboekrekening het verschil in euro\'s en in procenten.\n2. Maak een tabel van alle rekeningen waarvan het verschil groter is dan de uitvoeringsmaterialiteit, met de kolommen: Rekening, Omschrijving, Saldo 2026, Saldo 2025, Verschil, Verschil %, Mogelijke verklaring en Te verifiëren.\n3. Noem ook opvallende verschuivingen onder de grens.\n4. Bereken voor beide jaren de solvabiliteit en de current ratio, en laat de berekening zien.\n\nWerkwijze: reken met de bedragen uit het bestand, markeer verklaringen met "Hypothese" en sla rekeningen over die in beide jaren nul zijn.',
        steps: [
          ['Bestand lezen', 'Ik lees het tabblad "Proefsaldi" met 214 grootboekrekeningen.'],
          ['Verschillen berekenen', 'Ik bereken de verschillen en selecteer alles boven € 85.000.']
        ],
        answer: [
          ['p', 'Van de 214 rekeningen hebben er 17 een verschil van meer dan € 85.000. Hieronder de acht grootste; de volledige lijst kan ik als Excel-tabel teruggeven.'],
          ['table',
            ['Rekening', 'Omschrijving', 'Saldo 2026', 'Saldo 2025', 'Verschil', '%', 'Mogelijke verklaring', 'Te verifiëren'],
            [
              ['8000', 'Omzet transport', '24.812.400', '22.140.900', '2.671.500', '12,1%', 'Hypothese: nieuwe grote klant', 'Omzet per klant, contracten'],
              ['0300', 'Vervoermiddelen', '6.240.000', '4.410.000', '1.830.000', '41,5%', 'Hypothese: aankoop elektrische trucks', 'Investeringsoverzicht, facturen'],
              ['1300', 'Debiteuren', '3.980.000', '2.875.000', '1.105.000', '38,4%', 'Hypothese: hogere omzet en langere betaaltermijn', 'Ouderdomsanalyse, betalingen na balansdatum'],
              ['4000', 'Personeelskosten', '9.870.000', '9.112.000', '758.000', '8,3%', 'Hypothese: cao-verhoging en extra chauffeurs', 'Loonjournaal, personeelsbestand'],
              ['7100', 'Brandstofkosten', '4.912.000', '5.384.000', '-472.000', '-8,8%', 'Hypothese: lagere dieselprijs en elektrische trucks', 'Facturen, kilometerregistratie'],
              ['1720', 'Vooruitontvangen subsidie', '420.000', '0', '420.000', 'nieuw', 'Hypothese: subsidie voor emissievrije trucks', 'Subsidiebeschikking'],
              ['4950', 'Overige bedrijfskosten', '612.000', '298.000', '314.000', '105,4%', 'Hypothese: eenmalige advieskosten', 'Specificatie van de rekening'],
              ['1600', 'Crediteuren', '2.140.000', '2.310.000', '-170.000', '-7,4%', 'Hypothese: snellere betaling', 'Crediteurenlijst, betalingen na balansdatum']
            ]
          ],
          ['h3', 'Opvallend onder de grens'],
          ['ul', [
            '**1290 Tussenrekening bank** wisselt van teken: -34.200 (2026) tegenover 12.800 (2025).',
            '**4960 Diversen** is een nieuwe rekening met een saldo van 61.400.'
          ]],
          ['h3', 'Kengetallen'],
          ['table',
            ['Kengetal', '2026', '2025', 'Berekening'],
            [
              ['Solvabiliteit', '31,2%', '34,8%', 'Eigen vermogen / totaal vermogen: 4.118.000 / 13.199.000 en 3.902.000 / 11.213.000'],
              ['Current ratio', '1,18', '1,32', 'Vlottende activa / kortlopende schulden: 5.312.000 / 4.502.000 en 4.461.000 / 3.380.000']
            ]
          ],
          ['note', 'Reken de grootste verschillen en de kengetallen na in je eigen werkpapier.']
        ],
        suggestions: ['Maak vragen voor de klant per verschil', 'Geef de volledige lijst als Excel-tabel'],
        read: 4500
      },
      {
        prompt: 'Maak voor de verschillen een lijst met vragen voor de klant, gegroepeerd per onderwerp, zodat ik ze direct in een mail kan zetten.',
        steps: [['Vragen opstellen', '']],
        answer: [
          ['h3', 'Omzet en debiteuren'],
          ['ul', [
            'Kunnen jullie de omzet per klant over beide jaren toesturen? Welke nieuwe klanten zijn er bijgekomen?',
            'Hoe verklaren jullie de stijging van de debiteuren met 38%? Graag de ouderdomsanalyse per 30 juni 2026.'
          ]],
          ['h3', 'Investeringen en subsidie'],
          ['ul', [
            'Welke vervoermiddelen zijn in 2025/2026 aangeschaft? Graag het investeringsoverzicht met facturen.',
            'Kunnen jullie de subsidiebeschikking toesturen, met de voorwaarden voor de vooruitontvangen subsidie?'
          ]],
          ['h3', 'Kosten'],
          ['ul', [
            'Wat is er geboekt op Overige bedrijfskosten (4950) en op de nieuwe rekening Diversen (4960)? Graag een specificatie.',
            'Waardoor is het saldo van de tussenrekening bank (1290) negatief per balansdatum?'
          ]]
        ],
        review: false
      }
    ]
  },

  /* ---- Gegevensgericht: journaalposten (Analyst) -------------------------- */
  journaalposten: {
    title: 'Opvallende journaalposten selecteren',
    summary: 'Analyst controleert de populatie, past jouw criteria toe op alle boekingen en legt de selectie vast.',
    mode: 'Analyst',
    greeting: 'Ik ben Analyst. Geef me je data en een vraag, dan reken ik het voor je uit.',
    chips: ['Data opschonen', 'Trends vinden', 'Afwijkingen zoeken', '···'],
    turns: [
      {
        files: ['Journaalposten Brouwer Logistics 2025-2026.xlsx'],
        paste: true,
        prompt: 'Het bijgevoegde bestand bevat alle journaalposten van Brouwer Logistics B.V. over boekjaar 2025/2026 (kolommen: Boekstuk, Datum, Gebruiker, Dagboek, Rekening, Tegenrekening, Debet, Credit, Omschrijving). Ik voer werkzaamheden uit naar aanleiding van het risico dat het management de interne beheersing doorbreekt.\n\n1. Controleer eerst de populatie: aantal regels, aantal boekingen, totaal debet en credit, en de periode. Meld lege velden.\n2. Pas deze criteria toe en geef per criterium het aantal boekingen en het totaalbedrag:\n   a. geboekt in het weekend of op een feestdag;\n   b. ronde bedragen van € 25.000 of meer;\n   c. handmatige boekingen door j.brouwer en tmp.controller;\n   d. boekingen op omzet met een tegenrekening buiten debiteuren of bank;\n   e. boekingen van 23 juni tot en met 7 juli 2026;\n   f. omschrijvingen met "correctie", "memoriaal" of "diversen", of zonder omschrijving.\n3. Maak een overzicht van de boekingen die aan twee of meer criteria voldoen.\n4. Laat de gebruikte code zien.',
        steps: [
          ['Bestand inlezen', 'Ik laad 61.874 regels in Python en controleer de kolommen.'],
          ['Populatie controleren', 'Ik tel boekingen en totalen en zoek naar lege velden.'],
          ['Criteria toepassen', 'Ik markeer boekingen per criterium en combineer de uitkomsten.']
        ],
        answer: [
          ['h3', 'Populatie'],
          ['table',
            ['Kenmerk', 'Uitkomst'],
            [
              ['Regels', '61.874'],
              ['Boekingen', '18.302'],
              ['Totaal debet', '€ 214.611.380,12'],
              ['Totaal credit', '€ 214.611.380,12'],
              ['Periode', '1 juli 2025 tot en met 30 juni 2026'],
              ['Lege velden', '37 regels zonder omschrijving; geen lege datums of rekeningen']
            ]
          ],
          ['h3', 'Per criterium'],
          ['table',
            ['Criterium', 'Boekingen', 'Bedrag'],
            [
              ['a. Weekend of feestdag', '46', '€ 1.284.500'],
              ['b. Ronde bedragen ≥ € 25.000', '19', '€ 2.150.000'],
              ['c. Handmatig door j.brouwer / tmp.controller', '12', '€ 486.200'],
              ['d. Omzet met ongebruikelijke tegenrekening', '8', '€ 391.700'],
              ['e. 23 juni t/m 7 juli 2026', '1.142', '€ 18.904.300'],
              ['f. Correctie, memoriaal, diversen of leeg', '64', '€ 904.150']
            ]
          ],
          ['h3', 'Twee of meer criteria: 6 boekingen'],
          ['table',
            ['Boekstuk', 'Datum', 'Gebruiker', 'Rekening', 'Tegenrekening', 'Bedrag', 'Omschrijving', 'Criteria'],
            [
              ['MEM-0611', 'za 27-06-2026', 'j.brouwer', '8000 Omzet', '1290 Tussenrek.', '150.000,00', 'correctie', 'a, b, c, d, e, f'],
              ['MEM-0598', '30-06-2026', 'j.brouwer', '4950 Overige kosten', '1100 Kas', '25.000,00', '(leeg)', 'b, c, e, f'],
              ['MEM-0604', 'zo 28-06-2026', 'tmp.controller', '8000 Omzet', '1720 Vooruitontv.', '84.300,00', 'memoriaal', 'a, c, d, e, f'],
              ['MEM-0215', 'za 13-12-2025', 'tmp.controller', '4960 Diversen', '1600 Crediteuren', '30.000,00', 'diversen', 'a, b, c, f'],
              ['MEM-0623', '02-07-2026', 'j.brouwer', '1300 Debiteuren', '8000 Omzet', '50.000,00', 'correctie omzet', 'b, c, e, f'],
              ['MEM-0377', 'ma 06-04-2026 (2e paasdag)', 'tmp.controller', '0300 Vervoermiddelen', '1290 Tussenrek.', '40.000,00', 'memoriaal', 'a, b, c, f']
            ]
          ],
          ['code', 'Python', "import pandas as pd\n\ndf = pd.read_excel('Journaalposten Brouwer Logistics 2025-2026.xlsx')\ndf['Bedrag'] = df['Debet'].fillna(0) + df['Credit'].fillna(0)\nfeestdagen = pd.to_datetime(['2025-12-25', '2025-12-26', '2026-01-01', '2026-04-06', '2026-04-27', '2026-05-14', '2026-05-25'])\n\ncrit = pd.DataFrame(index=df.index)\ncrit['a'] = (df['Datum'].dt.weekday >= 5) | df['Datum'].isin(feestdagen)\ncrit['b'] = (df['Bedrag'] >= 25000) & (df['Bedrag'] % 1000 == 0)\ncrit['c'] = df['Gebruiker'].isin(['j.brouwer', 'tmp.controller']) & (df['Dagboek'] == 'MEM')\n# ... criteria d t/m f\n\nper_boeking = crit.groupby(df['Boekstuk']).any()\nselectie = per_boeking[per_boeking.sum(axis=1) >= 2]"],
          ['note', 'Dit is een selectie voor nader onderzoek, geen conclusie over fraude.']
        ],
        suggestions: ['Schrijf de vastlegging voor het dossier', 'Geef de selectie terug als Excel-bestand'],
        read: 4200
      },
      {
        prompt: 'Schrijf een korte vastlegging voor het dossier met de populatie, de criteria, de aantallen, de selectie en de volgende stap.',
        steps: [['Vastlegging opstellen', '']],
        answer: [
          ['h3', 'Vastlegging: selectie journaalposten 2025/2026'],
          ['p', '**Populatie.** Alle 61.874 regels (18.302 boekingen) over 1 juli 2025 tot en met 30 juni 2026. Totaal debet en credit € 214.611.380,12; aangesloten op de proefsaldibalans door het opdrachtteam.'],
          ['p', '**Criteria.** Gekozen op basis van de risico-inschatting: boekingen in het weekend of op feestdagen, ronde bedragen vanaf € 25.000, handmatige boekingen door twee gebruikers die normaal geen journaalposten maken, omzet met een ongebruikelijke tegenrekening, boekingen rond balansdatum en vage of lege omschrijvingen.'],
          ['p', '**Uitkomst.** Zes boekingen voldoen aan twee of meer criteria, met een totaal van € 379.300. Deze zijn geselecteerd voor nader onderzoek.'],
          ['p', '**Volgende stap.** Onderbouwing per boeking opvragen bij de klant en beoordelen of de boekingen zakelijk zijn en juist verwerkt.']
        ],
        review: false
      }
    ]
  },

  /* ---- Afronding: notulen ------------------------------------------------------ */
  notulen: {
    title: 'Notulen doorlezen op controlerelevante punten',
    summary: 'Gebeurtenissen na balansdatum, claims, verbonden partijen en continuïteit uit drie sets notulen.',
    mode: 'Copilot Chat',
    greeting: 'Hallo, waarmee kan ik je vandaag helpen?',
    chips: ['Bestanden samenvatten', 'Een tekst schrijven', 'Iets analyseren', '···'],
    turns: [
      {
        files: ['Notulen AVA 18-03-2026.pdf', 'Notulen RvC 2026.pdf', 'Notulen directieoverleg jan-sep 2026.docx'],
        paste: true,
        prompt: 'Ik voeg de notulen toe van de AVA, de RvC en het directieoverleg van Lindqvist Retail B.V. over de periode januari tot en met september 2026. De balansdatum is 30 juni 2026; ik verwacht de controleverklaring rond 13 november 2026 af te geven.\n\nLees de notulen en maak een tabel met alle punten die relevant kunnen zijn voor de controle, met de kolommen: Datum notulen, Onderwerp, Categorie, Letterlijk citaat, Mogelijke impact op de jaarrekening en Vervolgactie voor de auditor.\n\nGebruik deze categorieën: gebeurtenissen na balansdatum, continuïteit, claims en geschillen, verbonden partijen, nieuwe verplichtingen of garanties, wijzigingen in organisatie of bestuur, waarderingen en schattingen, fraude of integriteit, overig.\n\nRegels: neem alleen punten op die echt in de notulen staan, met een letterlijk citaat, en geef geen oordeel over de jaarrekening.',
        steps: [
          ['Notulen lezen', 'Ik lees drie documenten met in totaal 14 vergaderingen.'],
          ['Punten selecteren', 'Ik zoek naar besluiten en mededelingen per categorie.']
        ],
        answer: [
          ['p', 'Ik heb vijf punten gevonden die relevant kunnen zijn voor de controle. Alle citaten staan letterlijk in de notulen.'],
          ['table',
            ['Datum', 'Onderwerp', 'Categorie', 'Letterlijk citaat', 'Mogelijke impact', 'Vervolgactie'],
            [
              ['12-08-2026', 'Sluiting winkel Utrecht', 'Gebeurtenissen na balansdatum', '"De directie besluit de vestiging Utrecht per 1 januari 2027 te sluiten." [[Directie p. 18]]', 'Toelichting; mogelijk lagere waarde inrichting en huurverplichting', 'Boekwaarde inrichting en huurcontract opvragen'],
              ['25-09-2026', 'Claim leverancier', 'Claims en geschillen', '"De advocaat schat de claim van Textura GmbH (€ 340.000) in als een reëel risico." [[RvC p. 7]]', 'Voorziening of toelichting', 'Advocatenbrief opvragen'],
              ['18-03-2026', 'Lening aan bestuurder', 'Verbonden partijen', '"De AVA stemt in met een lening van € 120.000 aan de heer Lindqvist." [[AVA p. 3]]', 'Toelichting transacties met verbonden partijen', 'Overeenkomst en voorwaarden nagaan'],
              ['05-06-2026', 'Bankconvenant', 'Continuïteit', '"De bank heeft een waiver gegeven voor de solvabiliteitsratio over het tweede kwartaal." [[Directie p. 11]]', 'Continuïteit; rubricering van de lening', 'Waiverbrief en prognose opvragen'],
              ['10-07-2026', 'Nieuw distributiecentrum', 'Nieuwe verplichtingen', '"Het huurcontract voor het nieuwe DC is getekend: 10 jaar, € 480.000 per jaar." [[Directie p. 14]]', 'Niet uit de balans blijkende verplichting', 'Contract opvragen']
            ]
          ],
          ['note', 'Niets gevonden voor: wijzigingen in organisatie of bestuur, fraude of integriteit, en waarderingen of schattingen buiten de genoemde punten.']
        ],
        suggestions: ['Maak vragen voor het management', 'Welke punten horen in de bevestigingsbrief?'],
        read: 4500
      },
      {
        prompt: 'Maak vragen voor het management, onderwerpen voor de bevestigingsbrief en punten om af te stemmen met de opdrachtverantwoordelijke.',
        steps: [['Overzicht maken', '']],
        answer: [
          ['h3', 'Vragen voor het management'],
          ['ul', [
            '**Utrecht:** wat is de boekwaarde van de inrichting, en wat zijn de kosten van de sluiting?',
            '**Claim Textura:** wat is de stand van zaken, en is er inmiddels een schatting van de uitkomst?',
            '**Lening bestuurder:** wat zijn de rente, de aflossing en de zekerheden?',
            '**Bank:** voldoen jullie per het derde kwartaal weer aan het convenant?'
          ]],
          ['h3', 'Onderwerpen voor de bevestigingsbrief'],
          ['ul', [
            'Volledigheid van claims en geschillen, waaronder de claim van Textura GmbH.',
            'Volledigheid van transacties met verbonden partijen.',
            'Gebeurtenissen na balansdatum, waaronder het besluit over Utrecht en het nieuwe huurcontract.'
          ]],
          ['h3', 'Afstemmen met de opdrachtverantwoordelijke'],
          ['ul', [
            'Gevolgen van de waiver voor de continuïteitsparagraaf.',
            'Behandeling van de claim: voorziening of alleen toelichting.'
          ]]
        ],
        review: false
      }
    ]
  },

  /* ---- Afronding: managementletter ------------------------------------------------ */
  managementletter: {
    title: 'Bevindingen omzetten in een managementletter',
    summary: 'Van bevindingenlijst naar concept-managementletter met risico, aanbeveling en prioriteit, en een begeleidende mail.',
    mode: 'Copilot Chat',
    greeting: 'Hallo, waarmee kan ik je vandaag helpen?',
    chips: ['Een tekst schrijven', 'Bestanden samenvatten', 'Herschrijven', '···'],
    turns: [
      {
        files: ['Bevindingen interim-controle 2026 Vermeer Bouwmaterialen.docx', 'Managementletter 2025 Vermeer Bouwmaterialen.pdf'],
        paste: true,
        prompt: 'Je bent een ervaren auditor. Ik voeg mijn bevindingen toe uit de interim-controle bij Vermeer Bouwmaterialen B.V. over boekjaar 2026, en de managementletter van vorig jaar.\n\nSchrijf een concept-managementletter met:\n1. Een korte inleiding: doel en reikwijdte van de interim-controle.\n2. Per bevinding een paragraaf met: Bevinding, Risico, Aanbeveling en Prioriteit. Laat ruimte voor "Reactie management" en vul die niet zelf in.\n3. Een tabel met de opvolging van de bevindingen van vorig jaar.\n4. Een overzichtstabel van alle bevindingen, gesorteerd op prioriteit.\n\nSchrijfregels: zakelijk, positief-kritisch en begrijpelijk voor bestuur en management. Gebruik alleen mijn bevindingen en noem geen personen.',
        steps: [
          ['Bestanden lezen', 'Ik lees je drie bevindingen en de managementletter van vorig jaar.'],
          ['Letter opstellen', 'Ik schrijf per bevinding de bevinding, het risico en een aanbeveling.']
        ],
        answer: [
          ['h2', 'Managementletter interim-controle 2026 (concept)'],
          ['p', 'In september 2026 hebben wij de interim-controle uitgevoerd als onderdeel van de controle van de jaarrekening 2026 van Vermeer Bouwmaterialen B.V. Daarbij hebben wij de opzet en het bestaan van de interne beheersing in de belangrijkste processen beoordeeld. In deze brief delen wij onze bevindingen en aanbevelingen. Deze brief is geen volledig overzicht van alle mogelijke verbeterpunten.'],
          ['h3', '1. Wijzigen van bankrekeningen van leveranciers'],
          ['p', '**Bevinding:** medewerkers van inkoop kunnen bankrekeningnummers van leveranciers wijzigen, zonder dat een tweede persoon de wijziging controleert. **Risico:** een betaling kan naar een verkeerde of frauduleuze rekening gaan zonder dat dit wordt opgemerkt. **Aanbeveling:** laat iedere wijziging goedkeuren door een tweede medewerker buiten inkoop, en controleer wijzigingen telefonisch bij de leverancier. **Prioriteit:** hoog.'],
          ['p', '**Reactie management:** [in te vullen door het management]'],
          ['h3', '2. Goedkeuren van de betaalbatch bij afwezigheid'],
          ['p', '**Bevinding:** bij afwezigheid van de financieel manager keurt een medewerker van inkoop de betaalbatch goed. **Risico:** bestellen en betalen liggen dan in één hand. **Aanbeveling:** wijs een vaste vervanger aan buiten inkoop en leg dit vast in de bevoegdhedenregeling. **Prioriteit:** middel.'],
          ['h3', '3. Back-up van het ERP-systeem'],
          ['p', '**Bevinding:** de back-up wordt dagelijks gemaakt, maar het terugzetten ervan is niet getest. **Risico:** bij een storing of aanval kunnen gegevens verloren gaan. **Aanbeveling:** test het herstel minimaal één keer per jaar en leg de uitkomst vast. **Prioriteit:** middel.'],
          ['h3', 'Opvolging bevindingen 2025'],
          ['table',
            ['Bevinding vorig jaar', 'Status', 'Toelichting'],
            [
              ['Geen periodieke controle van gebruikersrechten', 'Opgelost', 'Sinds maart 2026 per kwartaal gecontroleerd'],
              ['Voorraadverschillen niet onderzocht', 'Gedeeltelijk', 'Verschillen boven € 1.000 worden onderzocht, kleinere niet']
            ]
          ],
          ['h3', 'Overzicht'],
          ['table',
            ['Nr.', 'Bevinding', 'Prioriteit'],
            [
              ['1', 'Wijzigen van bankrekeningen van leveranciers', 'Hoog'],
              ['2', 'Goedkeuren van de betaalbatch bij afwezigheid', 'Middel'],
              ['3', 'Back-up van het ERP-systeem', 'Middel']
            ]
          ]
        ],
        suggestions: ['Schrijf een begeleidende mail', 'Herschrijf bevinding 1 voor de RvC'],
        review: false
      },
      {
        prompt: 'Schrijf een korte begeleidende e-mail aan de financieel directeur van Vermeer Bouwmaterialen. Vraag om een reactie per bevinding vóór 6 november en stel een overleg van een half uur voor.',
        steps: [['Mail opstellen', '']],
        answer: [
          ['p', '**Onderwerp:** Concept-managementletter interim-controle 2026'],
          ['p', 'Beste [naam],'],
          ['p', 'Bijgaand ontvangt u de concept-managementletter naar aanleiding van onze interim-controle. Hierin staan drie bevindingen met onze aanbevelingen, en de opvolging van de punten van vorig jaar.'],
          ['p', 'Wilt u per bevinding de reactie van het management aanvullen en de letter vóór 6 november aan ons terugsturen? Graag lichten wij de bevindingen toe in een kort overleg van een half uur. Schikt een moment in de week van 2 november?'],
          ['p', 'Met vriendelijke groet,\n[naam]']
        ],
        review: false
      }
    ]
  }
};
