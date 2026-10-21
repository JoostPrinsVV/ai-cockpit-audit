/* ==========================================================================
   AI COCKPIT AUDIT — TRAININGEN
   --------------------------------------------------------------------------
   Opnames van trainingen, webinars en lunchsessies over Copilot, om terug
   te kijken. De volgorde maakt niet uit: de pagina toont de nieuwste
   (datum) bovenaan.

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
     met 'Opname volgt' (handig om een geplande sessie aan te kondigen).

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
     poster       Optioneel: afbeelding vóór het afspelen (bij 'video').
     chapters     Optioneel: hoofdstukken [{ time: '12:30', title: '...' }].
                  Bij een MP4 kun je erop klikken om naar dat moment te springen.
     materials    Optioneel: bijlagen [{ label: 'Slides (PDF)', href: '...' }].
                  Een link naar SharePoint of een bestand in assets/downloads/.
     usecases     Optioneel: id's uit data/usecases.js die in de training aan bod komen.
     tips         Optioneel: id's uit data/tips.js.
     added        Datum van toevoegen (JJJJ-MM-DD), voor het label 'Nieuw'.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.trainings = [
  // Voorbeeld (haal de // weg en vul in):
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
