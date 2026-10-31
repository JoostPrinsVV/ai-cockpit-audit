/* ==========================================================================
   AI COCKPIT — SEIZOENSKOMPAS (startwaarden per discipline)
   --------------------------------------------------------------------------
   Wat er per periode van het jaar speelt. De startpagina toont wat nu op
   koers ligt, met de usecases, prompts en tips die daar nu het handigst
   zijn, en wat er hierna komt. Aan te passen in Beheer → Inhoud → Teksten
   (Seizoenskompas); dan is wat daar staat leidend en dit alleen de
   terugval. Een discipline zonder seizoenen hier of in Beheer: geen kompas.

   Velden per seizoen:
     title     Wat er speelt (kort).
     months    De maanden, 1 = januari … 12 = december. Mag over de
               jaarwisseling heen ([11, 12, 1]) en mag overlappen met een
               ander seizoen: dan staan ze allebei op koers.
     text      Eén of twee zinnen: waar draait het nu om?
     phases    Fasen (id's) waaruit de cockpit usecases en prompts kiest.
     keywords  Zoekwoorden: wat daarmee gevonden wordt, komt eerst.
     accent    Optioneel: kleur ('teal', 'crimson', 'steel', 'rose',
               'deepteal', 'navy'); anders die van de eerste fase.
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.seasons = {
  audit: [
    {
      title: 'Planning en jaarovergang dossier',
      months: [7, 8, 9],
      text: 'Het nieuwe controlejaar begint: dossiers naar het nieuwe jaar, opdrachtbevestigingen, de planning en de eerste risicoanalyse.',
      phases: ['planning', 'eigen-werk'],
      keywords: ['planning', 'risicoanalyse']
    },
    {
      title: 'Planning en interimcontroles',
      months: [9, 10, 11, 12],
      text: 'Interimcontroles bij klanten: processen en interne beheersing in kaart, walkthroughs, en al een eerste risico-inschatting.',
      phases: ['beheersing', 'planning'],
      keywords: ['walkthrough', 'interim']
    },
    {
      title: 'Voorraadinventarisaties',
      months: [12],
      text: 'Rond de jaarwisseling de voorraadopnames: telinstructies beoordelen, de waarneming voorbereiden en vastleggen.',
      phases: ['gegevensgericht'],
      keywords: ['voorraad', 'telinstructie'],
      accent: 'crimson'
    },
    {
      title: 'Risico-inschatting, controle en afronding',
      months: [1, 2, 3, 4, 5, 6],
      text: 'Het drukke seizoen: de risico-inschatting afronden, de jaarrekeningcontroles uitvoeren en de dossiers afronden met rapportage en managementletter.',
      phases: ['gegevensgericht', 'afronding', 'planning'],
      keywords: ['materialiteit', 'managementletter', 'journaalposten']
    }
  ],
  accountancy: [
    {
      title: 'Jaarafsluiting en aanlevering',
      months: [1, 2],
      text: 'Het jaar afsluiten: aanleverlijsten naar klanten, de laatste boekingen en de stukken voor het jaarwerk binnenhalen.',
      phases: ['administratie', 'communicatie'],
      keywords: ['aanleverlijst', 'jaarwerk']
    },
    {
      title: 'Jaarrekeningen samenstellen',
      months: [2, 3, 4, 5, 6],
      text: 'Het piekseizoen van het jaarwerk: jaarrekeningen samenstellen, cijfers analyseren en de ICBO.',
      phases: ['samenstellen'],
      keywords: ['icbo', 'mutaties']
    },
    {
      title: 'Aangiften inkomstenbelasting',
      months: [3, 4],
      text: 'Vóór 1 mei de aangiften inkomstenbelasting: stukken verzamelen, controleren en uitleggen aan de klant.',
      phases: ['fiscaal'],
      keywords: ['inkomstenbelasting', 'aangifte']
    },
    {
      title: 'Btw-aangifte over het kwartaal',
      months: [1, 4, 7, 10],
      text: 'De eerste maand van een kwartaal: de btw-aangifte over het vorige kwartaal.',
      phases: ['fiscaal'],
      keywords: ['btw'],
      accent: 'steel'
    },
    {
      title: 'Bespreken en vennootschapsbelasting',
      months: [6, 7, 8, 9],
      text: 'Jaarrekeningen bespreken met klanten, adviesgesprekken voeren en de aangiften vennootschapsbelasting indienen.',
      phases: ['advies', 'fiscaal'],
      keywords: ['klantgesprek', 'presentatie', 'vennootschapsbelasting']
    },
    {
      title: 'Prognoses en tussentijdse cijfers',
      months: [9, 10, 11],
      text: 'Tussentijdse cijfers en prognoses: waar staat de klant nu, en wat komt er nog voor het einde van het jaar?',
      phases: ['advies', 'administratie'],
      keywords: ['vergelijken', 'kosten']
    },
    {
      title: 'Eindejaarsadvies en planning jaarwerk',
      months: [11, 12],
      text: 'Fiscale eindejaarstips voor klanten, en het jaarwerk van het nieuwe jaar plannen.',
      phases: ['advies', 'eigen-werk'],
      keywords: ['adviesbrief', 'planning']
    }
  ]
};
