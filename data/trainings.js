/* ==========================================================================
   AI COCKPIT AUDIT — TRAININGEN
   --------------------------------------------------------------------------
   Opnames van trainingen, webinars en lunchsessies over Copilot, om terug
   te kijken, en per training optioneel een naslagwerk. De volgorde maakt
   niet uit: de pagina toont de nieuwste (datum) bovenaan.

   Let op: staan de trainingen eenmaal in de database (Beheer → Inhoud), dan
   is de database leidend en is dit bestand alleen nog de terugval. Een
   nieuwe training zet je dan in Beheer (of importeer je als back-up, zie
   README.md, 'Naslagwerk na een training').

   WAAR ZET JE DE OPNAME?
   - Aanbevolen: laat de opname in Microsoft Stream / SharePoint / Teams staan
     en zet de link bij 'link'. Dan bepaalt Microsoft 365 wie hem mag zien
     (alleen collega's met een Visser & Visser-account) en hoeft er niets
     groots in deze map. Collega's openen hem in een nieuw tabblad.
   - Alleen voor korte, openbare fragmenten: een MP4 in assets/videos/ bij
     'video'. Let op: deze website en de repository zijn openbaar bereikbaar
     en GitHub accepteert geen bestanden boven 100 MB. Zet hier dus nooit een
     opname met interne of klantinformatie neer.
   - Nog geen opname? Laat 'link' en 'video' leeg: de training staat er dan
     met 'Opname volgt' (handig om een geplande sessie aan te kondigen). Met
     een naslagwerk staat er geen 'Opname volgt', maar de slides.

   Zo werkt het:
   - Iedere training staat tussen { en }, gescheiden door een komma.
   - Een training toevoegen: kopieer het voorbeeld onderaan dit bestand,
     haal de // weg en vul het in. Verander een id niet meer als er al naar
     gelinkt wordt (het adres is #/training/<id>).

   Velden (* = verplicht):
     id*          Unieke code, alleen kleine letters, cijfers en '-'.
     title*       Titel van de training.
     subtitle     Eén korte zin onder de titel.
     date*        Datum van de training (JJJJ-MM-DD).
     duration     Duur, bijv. '45 min'.
     trainer      Wie gaf de training, bijv. 'Team AI & Innovatie'.
     category     Soort, bijv. 'Basistraining', 'Verdieping', 'Lunchsessie', 'Webinar'.
     level        'Starter' of 'Gevorderd'.
     license      true = gaat over functies met een Microsoft 365 Copilot-licentie;
                  false = ook bruikbaar met de gratis Copilot Chat. Weglaten = niets tonen.
     description  Waar gaat de training over (2-4 zinnen).
     link         Link naar de opname in Stream, SharePoint of Teams.
     video        Of: pad naar een korte MP4, bijv. 'assets/videos/training-01.mp4'.
     poster       Optioneel: afbeelding vóór het afspelen (bij 'video'), en op de kaart
                  in het overzicht. Leeg = de eerste slide (als die er is).
     videoTitle   Optioneel: koptekst boven de opname, bijv. 'De sessie in 5 minuten'.
     videoIntro   Optioneel: één of twee zinnen onder die koptekst.
     slidesFirst  true = eerst de slides, dan de opname. Weglaten = eerst de opname.
     chapters     Optioneel: hoofdstukken [{ time: '12:30', title: '...' }], direct onder de
                  opname. Bij een MP4 kun je erop klikken om naar dat moment te springen.
     materials    Optioneel: bijlagen [{ label: 'Slides (PDF)', href: '...' }].
                  Een link naar SharePoint of een bestand in assets/downloads/.
     usecases     Optioneel: id's uit data/usecases.js die in de training aan bod komen.
     tips         Optioneel: id's uit data/tips.js.
     added        Datum van toevoegen (JJJJ-MM-DD), voor het label 'Nieuw'.

   NASLAGWERK (alles optioneel; een onderdeel zonder inhoud verschijnt niet)
   De site is openbaar bereikbaar: geen interne of klantinformatie, geen namen
   van deelnemers, geen persoonlijke instructies of systeemprompts.

     slides       De slides om terug te kijken, in volgorde:
                    [{ image: 'assets/trainingen/<id>/slide-01.jpg', title: 'Titel van de slide' }]
                  Afbeeldingen zet je via de repository in assets/trainingen/<id>/
                  (Beheer kan niet uploaden). Liefst JPG, 16:9, ca. 1600 px breed en
                  hooguit ca. 150 kB per slide. Een slide met interne informatie laat je weg.
     takeaways    'Wat je meeneemt': 3 tot 5 kaarten
                    [{ title: 'Kop', text: 'Uitleg', warning: true }]
                  warning: true = rode kaart met een uitroepteken (weglaten = gewoon).
     actions      'Aan de slag': de afvinklijst. Collega's vinken af in hun eigen browser
                  (lokale opslag, per training; het vinkje hoort bij de kop, dus pas een
                  kop na publiceren liever niet meer aan).
                    [{
                      title: 'Kop van de actie',                    (verplicht)
                      text: 'Korte uitleg',
                      slide: 14,                                    nummer van een slide (1 = de eerste
                                                                    in 'slides'); toont 'Bekijk slide 14: …'
                      more: 'Zo stel je het in',                    kop van het uitklapblok
                                                                    (standaard 'Zo pak je het aan')
                      howto: [{ title: 'Direct instellen', steps: ['Stap 1', 'Stap 2'] }],
                      note: 'Kleine letters onder de stappen',
                      prompts: [{ label: 'Kop', text: 'Prompt of sjabloon, met [PLAATSHOUDERS]' }]
                    }]
     ideas        'Uit de zaal': ideeën [{ title: 'Kop', text: 'Uitleg' }]
     questions    'Uit de zaal': open vragen ['Vraag 1', 'Vraag 2']
     timelineIntro  'Vervolg': één of twee zinnen boven de tijdlijn.
     timeline     'Vervolg': de sessies van de reeks
                    [{ month: 'Oktober', title: 'Basistraining', text: 'Korte uitleg',
                       current: true,                               deze training (gemarkeerd)
                       training: 'andere-training-id' }]            optioneel: link naar die training
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.trainings = [
  // Fictief voorbeeld van een naslagwerk (zonder slides): zo ziet het eruit na een training.
  // Na een echte training: kopieer dit blok, vul het in en zet de slides erbij (zie README.md).
  {
    id: 'voorbeeld-naslagwerk-copilot-basis',
    title: 'Voorbeeld: naslagwerk bij een basistraining Copilot',
    subtitle: 'Fictief voorbeeld van wat je na een training terugvindt',
    date: '2026-10-20',
    trainer: 'Team AI & Innovatie',
    category: 'Voorbeeld',
    level: 'Starter',
    license: true,
    description: 'Dit is een verzonnen training. Zo ziet een naslagwerk eruit: wat je meeneemt, acties om af te vinken met prompts en stappen, ideeën en vragen uit de zaal en het vervolg. Bij een echte training staan hier ook de slides om terug te kijken.',
    tips: ['instructies', 'geplande-prompts', 'prompt-opbouw', 'transcriptie'],
    added: '2026-10-21',

    takeaways: [
      { title: 'AI geeft een waarschijnlijk antwoord, geen zeker antwoord.', text: 'Het eerste concept komt van Copilot. Het oordeel en de verantwoordelijkheid blijven bij jou.' },
      { title: 'Klantinformatie alleen in Microsoft 365 Copilot.', text: 'Werk met je Visser & Visser-account (het schildje), nooit in een gratis of privé-AI-tool.', warning: true },
      { title: 'Copilot kent je werk.', text: 'Je mail, agenda, Teams en bestanden. En dus ook alles waar jij toegang toe hebt: controleer wat je deelt.' },
      { title: 'Een goede prompt geeft richting.', text: 'Rol, doel, format, aanpak, en context en grenzen. Niet lang, wel afgebakend.' },
      { title: 'Begin klein.', text: 'Kies één taak die je deze week met Copilot oppakt. Probeer, beoordeel en bouw verder.' }
    ],

    actions: [
      {
        title: 'Stel je persoonlijke instructies in',
        text: 'Leg één keer vast wie je bent, wat je doet en hoe je antwoorden wilt. Een concrete prompt gaat altijd voor op je instructies.',
        more: 'Sjabloon om in te vullen',
        prompts: [{
          label: 'Persoonlijke instructies (sjabloon)',
          text: 'Rol en context\nJe bent de persoonlijke assistent van [NAAM], [FUNCTIE, bijv. senior assistent] bij Visser & Visser, team [TEAM, bijv. audit]. Ik werk vooral voor [TYPE KLANTEN, bijv. mkb-ondernemers en hun ondernemingen].\n\nDoel\nHelp mij bij [DRIE TAKEN DIE VAAK TERUGKOMEN IN JE WERK].\n\nCommunicatiestijl\nSchrijf zakelijk, helder en concreet, in het Nederlands tenzij ik anders vraag. Vermijd marketingtaal.\n\nRichtlijnen\nBaseer je op bronnen en noem ze. Maak onderscheid tussen feiten, aannames en ideeën. Zeg het als informatie ontbreekt en vul niets zelf in. Ga ervan uit dat alle informatie vertrouwelijk is. Houd rekening met [RELEVANTE REGELGEVING, bijv. BW2, RJ en NV COS].\n\nOutput\nBegin met de kern. Gebruik koppen en opsommingen waar dat de leesbaarheid helpt. Sluit af met open punten of vervolgstappen.'
        }]
      },
      {
        title: 'Plan een prompt voor je weekoverzicht',
        text: 'Met een geplande prompt draait Copilot een vaste vraag automatisch, bijvoorbeeld elke maandag om 7.00 uur. Dan staat je overzicht klaar als je begint.',
        more: 'Zo stel je het in',
        howto: [
          { title: 'Direct instellen', steps: ['Open Copilot Chat en klik op de drie puntjes rechtsboven.', 'Kies Geplande prompt en daarna Nieuwe instellen.', 'Plak de prompt hieronder en kies hoe vaak en wanneer, bijvoorbeeld wekelijks op maandag om 7.00 uur.'] },
          { title: 'Of vanuit een chat', steps: ['Stuur de prompt één keer in Copilot Chat, in de modus Werk.', 'Ga met je muis over je verstuurde prompt en kies de optie om hem te plannen.'] }
        ],
        note: 'Het resultaat verschijnt daarna automatisch in je Copilot-chats. Zie je de optie niet, dan staat de functie mogelijk nog niet voor je aan.',
        prompts: [{ label: 'Prompt voor je weekoverzicht', text: 'Maak een overzicht van mijn week: vergaderingen, de belangrijkste taken en deadlines, en chats en mails die op een reactie van mij wachten. Houd het kort genoeg om in vijf minuten door te nemen.' }]
      },
      {
        title: 'Vat een lange mailwisseling samen, als gevorderde',
        text: 'Niet "vat deze mails samen", maar met afbakening en outputcriteria. Vergelijk het resultaat met wat je zelf had opgeschreven.',
        prompts: [{ label: 'Prompt voor een mailwisseling', text: 'Analyseer deze e-mailwisseling en geef uitsluitend de besluiten, openstaande acties, actiehouders en deadlines. Maak onderscheid tussen acties voor mij en voor anderen. Verzin geen ontbrekende informatie en benoem wanneer een actiehouder of deadline onduidelijk is.' }]
      },
      {
        title: 'Gebruik transcriptie en samenvatting in Teams',
        text: 'Waar dat passend en toegestaan is. Vraag bij klanten vooraf toestemming, spreek taken expliciet uit en controleer de actiepunten.'
      },
      {
        title: 'Deel welke toepassing je gaat proberen',
        text: 'Zet het in de ideeënhub, zodat collega\'s ervaringen kunnen uitwisselen en het AI-team ziet waar behoefte aan is.'
      }
    ],

    ideas: [
      { title: 'Vaste prompt voor de dossierreview', text: 'Eén gedeelde prompt die openstaande reviewpunten per sectie op een rij zet.' },
      { title: 'Voorbereiding van het eindgesprek', text: 'Uitzoeken hoe Copilot de belangrijkste bevindingen en open punten bundelt voor het gesprek met de klant.' }
    ],
    questions: [
      'Hoe leggen we in het dossier vast wat we met Copilot hebben gedaan?',
      'Hoe controleren we grote Excel-analyses van Copilot goed?'
    ],

    timelineIntro: 'Fictief: zo ziet het vervolg van een reeks eruit. De training van deze pagina staat gemarkeerd.',
    timeline: [
      { month: 'Oktober', title: 'Basistraining', text: 'De mogelijkheden van Copilot in de audit', current: true },
      { month: 'December', title: 'Prompts voor de planning', text: 'Van risicoanalyse tot planningsmemo' },
      { month: 'Februari', title: 'Agents in de audit', text: 'Wat agents kunnen, en waar je op let' },
      { month: 'April', title: 'Copilot in Excel', text: 'Analyses en formules, en hoe je ze controleert' }
    ]
  }

  // Voorbeeld van een training met opname (haal de // weg en vul in):
  // {
  //   id: 'copilot-basis-audit',
  //   title: 'Copilot in de audit: de basis',
  //   subtitle: 'Van eerste prompt tot eigen instructies',
  //   date: '2026-11-12',
  //   duration: '60 min',
  //   trainer: 'Team AI & Innovatie',
  //   category: 'Basistraining',
  //   level: 'Starter',
  //   license: false,
  //   description: 'We laten zien hoe je Copilot veilig gebruikt in de controlepraktijk, hoe je een goede prompt opbouwt en hoe je je eigen instructies instelt.',
  //   link: 'https://<jullie-omgeving>.sharepoint.com/...',
  //   chapters: [
  //     { time: '00:00', title: 'Welkom en het schildje' },
  //     { time: '08:30', title: 'Zo bouw je een sterke prompt' },
  //     { time: '27:15', title: 'Eigen instructies instellen' }
  //   ],
  //   materials: [{ label: 'Slides (PDF)', href: 'https://<jullie-omgeving>.sharepoint.com/...' }],
  //   usecases: ['risicoanalyse'],
  //   tips: ['instructies', 'prompt-opbouw'],
  //   added: '2026-11-12'
  // }
];
