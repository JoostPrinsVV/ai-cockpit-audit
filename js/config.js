/* ==========================================================================
   AI COCKPIT AUDIT — INSTELLINGEN
   --------------------------------------------------------------------------
   Het centrale instellingenbestand van het auditplatform. Pas alleen de
   waarden aan (de tekst achter de dubbele punt), niet de namen ervoor.

   - Tekst staat tussen enkele aanhalingstekens:   'zoals dit'
   - Aan/uit is true (aan) of false (uit)
   - Vergeet de komma aan het eind van de regel niet.

   Na het opslaan: herlaad de pagina (F5) om de wijziging te zien.
   Uitleg: README.md
   ========================================================================== */

window.AIAudit = window.AIAudit || {};

window.AIAudit.config = {

  /* ---- Titel en organisatie ------------------------------------------- */
  applicationTitle: 'AI Cockpit',
  discipline: 'Audit',                  // Verschijnt in turquoise achter de titel
  tagline: 'Jij bepaalt de koers, Copilot navigeert mee.', // Slogan onder de titel op de startpagina
  applicationSubtitle: 'Usecases met demo, direct bruikbare prompts, tips, trainingen en agents: alles over Copilot in de audit op één plek.',
  organizationName: 'Visser & Visser',
  siteUrl: 'https://joostprinsvv.github.io/ai-cockpit-audit/', // Voor de links in de nieuwsbrief (Beheer → Nieuwsbrief)
  lastUpdated: '19 oktober 2026',       // 'Laatst bijgewerkt' onderaan de pagina
  newDays: 45,                          // Zo lang (in dagen) krijgt nieuwe inhoud het label 'Nieuw'
  launchDate: '2026-10-19',             // Inhoud van vóór of op deze datum krijgt geen label 'Nieuw' (anders staat bij de start alles op 'Nieuw')
  theme: 'licht',                       // Standaardthema: 'licht' of 'donker' (iedere collega kan zelf wisselen)

  /* ---- Slot met pincode (js/lock.js) ------------------------------------- */
  // Vingerafdruk van de pincode (dezelfde als bij de snackbar), niet de pincode zelf. Na één keer
  // invullen blijft de cockpit op dat apparaat open. Nieuwe pincode: typ in de console van de
  // cockpit  await AIAudit.lock.hash('nieuwe pincode')  en zet de uitkomst hier. Leeg = geen slot.
  // Een drempel tegen doorsturen, geen beveiliging: de bestanden blijven openbaar op te vragen.
  lockPinHash: '5f653a94cdf1072581a9c971ee99f97abdc5117be998d0242e5099f1e48ca002',

  /* ---- Gouden regels (onderaan iedere pagina) -------------------------- */
  rules: [
    'Werk alleen in Copilot met je zakelijke account (het schildje), nooit in een gratis of privé-AI-tool.',
    'Copilot ondersteunt, jij beoordeelt: het professionele oordeel en de handtekening blijven van jou.',
    'Controleer iedere uitkomst tegen de bron en leg vast in het dossier wat je met Copilot hebt gedaan.',
    'Deel niet meer dan nodig: geen BSN, privégegevens of stukken die niet bij de opdracht horen.'
  ],

  /* ---- Ideeënhub -------------------------------------------------------- */
  enableIdeas: true,                    // Formulier en overzicht in de ideeënhub
  ideaMaxLength: 2000,                  // Maximaal aantal tekens voor de toelichting
  ideaFallbackEmail: '',                // Optioneel: e-mailadres waar een inzending naartoe kan als de centrale
                                        // opslag nog niet werkt (bijv. 'ai-audit@visser-visser.nl'). Leeg = alleen kopiëren
  enableVotes: true,                    // 'Ik ook'-stem bij gepubliceerde ideeën en vragen
  enableReviews: true,                  // 'Wat vond je ervan?' (sterren en toelichting) bij usecases en prompts

  /* ---- Openen in Copilot ------------------------------------------------- */
  // 'Kopieer en open Copilot' bij iedere prompt: kopieert de (ingevulde) prompt en opent Copilot Chat
  // met je zakelijke account. Microsoft heeft geen officiële manier om een prompt al in het typveld
  // te zetten: je plakt hem met Ctrl+V.
  copilotUrl: 'https://m365.cloud.microsoft/chat',
  copilotPromptParam: '',               // Optioneel, alleen na testen: de parameter waarmee Copilot de prompt al invult
                                        // (bijv. 'prompt'). Zie README.md. Leeg = alleen kopiëren en openen

  /* ---- Gebruik meten ------------------------------------------------------ */
  enableUsageStats: true,               // Anoniem tellen welke usecases, demo's en prompts gebruikt worden (zichtbaar in Beheer)

  /* ---- Centrale opslag (Supabase) ---------------------------------------- */
  // Hetzelfde Supabase-project als de AI Snackbar, met eigen tabellen voor audit.
  // Eenmalig instellen: voer setup/supabase-audit.sql uit (zie README.md).
  // De sleutel is de publieke 'publishable' key, nooit de service_role key.
  centralUrl: 'https://czxyhgthbpexxqmudgdu.supabase.co',
  centralKey: 'sb_publishable_xELIX8sqJNueqdZCf4rWEw_h8K688mF',
  namespace: 'ai-audit',                // Houdt de audit-gegevens gescheiden van andere omgevingen

  /* ---- Lokale opslag (alleen op dit apparaat, nooit klantgegevens) ------- */
  storageNamespace: 'ai-snackbar-audit', // Favoriete prompts, thema en eigen inzendingen

  debugMode: false                      // true = extra technische meldingen in de console (en ?datum=JJJJ-MM-DD om het slot van de tips te testen)
};
