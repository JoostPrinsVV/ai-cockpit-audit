# AI Cockpit Audit

*Jij bepaalt de koers, Copilot navigeert mee.*

Levend kennisplatform over Copilot voor alle auditcollega's van Visser & Visser. Gebouwd op dezelfde basis als de AI Snackbar, maar een los platform.
Statische website (HTML, CSS, JavaScript), live via GitHub Pages op **https://joostprinsvv.github.io/ai-cockpit-audit/**. Alle demo-inhoud is fictief.

Het platform stond eerst in de map `audit/` van de AI Snackbar (repository `AI-snackbar-platform`). Het oude adres
`https://joostprinsvv.github.io/AI-snackbar-platform/audit/` stuurt door naar hier, inclusief het deel na de `#`
(bijv. `#/prompts`). Deze repository is zelfstandig: er zijn geen verwijzingen naar bestanden buiten deze map.

## Structuur

```
index.html            De pagina (kopbalk, voet, iconen) en de beveiligingsregels (CSP)
css/variables.css     Huisstijl: kleuren, maten, lettertypes (eigen kopie, overgenomen van de snackbar)
css/base.css          Lettertypes, reset en hulpklassen (eigen kopie)
css/audit.css         De opmaak van dit platform
js/config.js          Instellingen: titel, gouden regels, Supabase
js/*.js               De applicatie (iedere pagina een view-*.js)
data/*.js             Startinhoud en terugval als de database niet bereikbaar is
demos/                Nagespeelde Copilot-demo's (player.html + scripts.js)
assets/fonts/         IBM Plex (SIL Open Font License, zie OFL.txt)
assets/branding/      Favicon
assets/videos/        Opgenomen demo's (MP4, uit de snackbar overgenomen)
assets/demos/         HTML-demo van snack 1 (uit de snackbar overgenomen)
setup/                Het SQL-bestand voor Supabase
```

Alle paden zijn relatief binnen deze repository (geen `../`). De enige link naar buiten in de pagina is
'Naar de AI Snackbar' onderaan, naar `https://joostprinsvv.github.io/AI-snackbar-platform/`.

## Onderdelen

| Adres | Wat |
| --- | --- |
| `#/` | Startpagina: zoeken, de onderdelen, uitgelichte usecases en tips, nieuw toegevoegd |
| `#/usecases`, `#/usecase/<id>` | Praktische usecases per fase van de controle, elk met demo, stappen, prompts en aandachtspunten |
| `#/prompts`, `#/prompt/<id>` | Promptdatabase: zoeken, filteren, favorieten, plaatshouders invullen en kopiëren |
| `#/tips`, `#/tip/<id>` | Tips & tricks, o.a. eigen instructies, Facilitator en geplande prompts |
| `#/trainingen`, `#/training/<id>` | Opnames van trainingen en sessies om terug te kijken, met hoofdstukken en materiaal |
| `#/agents`, `#/agent/<id>` | Agents & tools: welke AI-agents en -producten er zijn, waarvoor (en waarvoor niet) en hoe je toegang krijgt |
| `#/ideeen` | Ideeënhub: idee, vraag, verzoek of prompt insturen; gepubliceerde inzendingen met antwoord en 'Ik ook' |
| `#/zoeken/<woorden>` | Zoeken in usecases, prompts, tips, trainingen en agents tegelijk |
| `#/beheer` | Voor het AI-team: alle inhoud beheren, inzendingen beantwoorden en publiceren, gebruik bekijken |

Ieder adres is deelbaar, bijvoorbeeld in Teams: `https://joostprinsvv.github.io/ai-cockpit-audit/#/tip/facilitator`.
Met `#/ideeen/vraag` (of `idee`, `verzoek`, `prompt`) staat de soort in de ideeënhub alvast goed.

## Inhoud beheren (Beheer → Inhoud)

Na het eenmalig instellen (zie 'Supabase instellen' hieronder) beheer je alle inhoud in de site zelf, zonder bestanden:

1. Ga naar `#/beheer` (link 'Beheer' onderaan iedere pagina) en log in.
2. De eerste keer: klik op **Overzetten naar de database**. De inhoud uit de bestanden gaat dan naar Supabase; vanaf
   dat moment tonen alle collega's de inhoud uit de database.
3. Kies een soort (Usecases, Prompts, Tips, Trainingen, Agents & tools, Fasen, Teksten) en klik op **Bewerken** of
   **Nieuwe …**. Je kunt alles aanpassen: teksten, prompts (met plaatshouders), stappen, fase, icoon, licentie, demo
   of video, de 'tip van de week'-datum, hoofdstukken en materiaal van trainingen, gekoppelde tips en usecases.
4. **Status:** *Gepubliceerd* (iedereen ziet het) of *Concept* (alleen jij als beheerder, met een label 'Concept').
   Zo kun je iets rustig voorbereiden en via **Bekijk op de site** controleren voordat je het publiceert.
5. **Volgorde:** met de pijltjes in de lijst. **Verwijderen:** eerst naar de prullenbak (terug te zetten), daarna
   eventueel definitief. Iedere wijziging bewaart bovendien de vorige versie in `audit_content_history`.
6. Op een pagina van een usecase, prompt, tip, training of agent zie je als beheerder een balk met **Bewerk deze …**.
7. **Back-up:** *Exporteer alles (JSON)* bewaart alle inhoud in één bestand; *Importeer back-up* zet zo'n bestand terug.
8. **Nieuwe soort in de bestanden:** 'Overzetten' gebeurt maar één keer. Komt er later een soort bij (zoals agents)
   die in de bestanden wél items heeft en in de database nog geen enkele, dan zie je bovenaan Beheer → Inhoud een
   melding, bijvoorbeeld **5 agents uit de bestanden toevoegen**. Na bevestigen staan ze in de database en zijn ze
   direct zichtbaar. Voer eerst `setup/supabase-audit.sql` opnieuw uit (zie hieronder), anders weigert de database ze.

Je blijft ingelogd zolang het tabblad open is. Als beheerder tel je niet mee in de gebruiksstatistiek.

Goed om te weten:
- Bezoekers krijgen eerst de laatst bekende inhoud uit hun browser (snel) en daarna de actuele. Is de database even
  niet bereikbaar, dan blijft de site gewoon werken met die laatste versie, of met de bestanden.
- Video's en demo's moeten op de site zelf staan (pad zoals `assets/videos/naam.mp4`); trainingen linken naar
  Stream/SharePoint met `https://`. Andere soorten links worden geweigerd.
- Oude paden uit de tijd in de snackbar (`../assets/…`) die nog in de database staan, worden automatisch gelezen als
  `assets/…`. Open je zo'n item in Beheer en sla je het op, dan wordt het nieuwe pad bewaard.
- De nagespeelde demo-gesprekken (`demos/scripts.js`) pas je nog in het bestand aan.

## Inhoud in de bestanden (startinhoud en terugval)

Zolang de database niet is ingericht, komt alle inhoud uit gewone tekstbestanden. Na 'Overzetten' zijn ze alleen nog
de terugval. Uitleg per veld staat bovenin elk bestand.

| Bestand | Inhoud |
| --- | --- |
| `js/config.js` | Titel, gouden regels, 'laatst bijgewerkt', ideeënhub en Supabase |
| `data/phases.js` | De fasen van de controle (filters en kleuren) |
| `data/usecases.js` | Usecases. De prompts komen automatisch ook in de promptdatabase |
| `data/prompts.js` | Losse prompts voor de promptdatabase |
| `data/tips.js` | Tips & tricks |
| `data/trainings.js` | Trainingen (opnames), met een voorbeeld onderaan om te kopiëren |
| `data/agents.js` | Agents & tools (startinhoud: de Microsoft-standaard agents) |
| `demos/scripts.js` | De gesprekken van de nagespeelde Copilot-demo's |

- **Usecase toevoegen:** kopieer een blok `{ … }` in `data/usecases.js` en geef het een nieuwe `id`.
- **Prompt toevoegen:** idem in `data/prompts.js`. Schrijf plaatshouders als `[KLANTNAAM]` of `[PROCES, bijv. inkoopproces]`
  (hoofdletter vooraan); collega's kunnen ze dan invullen vóór het kopiëren. Een prompt uit de ideeënhub? Zet de naam bij `author`.
- **Tip van de week:** een tip met `release: 'JJJJ-MM-DD'` (een vrijdag) zit op slot tot die dag. Collega's zien dan
  alleen een blok met een slotje, de datum en het thema; daarna staat hij bij 'Alle tips'. Tips zonder `release` zijn
  altijd zichtbaar. Testen hoe het er op een andere dag uitziet: zet `debugMode: true` in `js/config.js` en open
  `…/ai-cockpit-audit/?datum=2026-11-06#/tips` (daarna weer op `false`). Het slot is een spelregel, geen beveiliging.
- **Nieuw-label:** zet bij nieuwe inhoud `added: 'JJJJ-MM-DD'`. Inhoud van na `launchDate` (config) krijgt `newDays` dagen het label 'Nieuw'.
- **Na het aanpassen:** herlaad de pagina. Iets vergeten (bijv. een komma)? De console (F12) noemt het bestand en de regel.

## Demo's

Iedere usecase heeft een `video` of een `demo`:

- **Opgenomen video (aanbevolen voor echte schermopnames):** zet de MP4 in `assets/videos/` en vul bij de usecase
  `video: 'assets/videos/<naam>.mp4'` in. Een video heeft voorrang op een demo.
- **Nagespeelde demo:** een gesprek in `demos/scripts.js` dat in een Copilot-look wordt afgespeeld (bijlagen toevoegen,
  prompt plakken, denkstappen, antwoord dat opbouwt). Vul bij de usecase `demo: 'demos/player.html#<naam>'` in.
  Los bekijken kan ook: open `demos/player.html#<naam>` in de browser.
- **HTML-demo van de snackbar:** `demo: 'assets/demos/snack-01.html'` werkt ook (zelfde bediening).

Nu: zes nagespeelde demo's, de HTML-demo van snack 1 en de video's van snack 2 en 3, overgenomen uit de snackbar
(`assets/demos/` en `assets/videos/`; de video van snack 1 staat er ook, als keuze in Beheer).
Vervang een nagespeelde demo later gerust door een echte opname; de rest van de usecase blijft hetzelfde.

## Trainingen

Een training toevoegen: kopieer het voorbeeld onderaan `data/trainings.js` en vul het in.

- **Opname in Stream/SharePoint (aanbevolen):** zet de deellink bij `link`. De opname opent in een nieuw tabblad en
  Microsoft 365 regelt wie hem mag zien. Zet de rechten van het bestand zo dat alle auditcollega's hem kunnen openen.
- **Korte MP4 (alleen openbaar materiaal):** zet het bestand in `assets/videos/` en vul `video` in. Hij speelt dan op
  de pagina zelf en de hoofdstukken springen naar het juiste moment. Deze website en de repository zijn openbaar
  bereikbaar en GitHub accepteert geen bestanden boven 100 MB: zet hier nooit een opname met interne of klantinformatie.
- **Nog geen opname:** laat `link` en `video` leeg. Ligt de datum in de toekomst, dan staat de training onder
  'Binnenkort'; daarna onder 'Terugkijken' met 'Opname volgt'.

## Agents & tools

Een catalogus van AI-agents en -producten, bekeken vanuit de gebruiker: wat is het, waarvoor gebruik je het (en
waarvoor niet), hoe krijg je toegang en welke usecases, tips en trainingen horen erbij. Het formele AI-register blijft
elders; een agent kan er met `registerUrl` naar linken (afgeschermde omgeving).

> **Let op: deze site is openbaar bereikbaar.** Zet bij agents alleen informatie voor gebruikers. Nooit configuratie,
> systeemprompts, technische instellingen, interne risicoanalyses of goedkeuringsdocumenten. Noem bij voorkeur een
> afdeling of functie als aanspreekpunt, geen naam. Twijfel je? Laat het weg en link naar het AI-register.

- **Soort:** *Microsoft-standaard* (onderdeel van Microsoft 365), *Eigen agent* (gemaakt door of voor Visser & Visser)
  of *Extern product* (van een andere leverancier). Op de overzichtspagina filter je op soort en status.
- **Status:** *Beschikbaar*, *Pilot*, *In ontwikkeling* of *Gestopt*. Een gestopte agent blijft vindbaar, staat
  onderaan en heeft geen knop 'Openen'.
- **Licentie:** bij Microsoft en eigen agents de Microsoft 365 Copilot-licentie; bij een extern product een eigen
  licentie of account.
- **Link:** de knop 'Openen' opent hem in een nieuw tabblad (alleen `https://`).
- **Niet gebruiken voor:** een paar korte punten; ze staan als waarschuwing op de pagina.
- Alle velden staan uitgelegd bovenin `data/agents.js`; in Beheer → Inhoud → Agents & tools vul je dezelfde velden in.

## Supabase instellen (eenmalig, voor beheer en ideeënhub)

Beheer, de ideeënhub en de tellers gebruiken hetzelfde Supabase-project als de snackbar, met eigen tabellen. Tot die
er zijn, toont de site de inhoud uit de bestanden en meldt de hub "wordt nog aangesloten".

1. Open `setup/supabase-audit.sql` en zet bij stap 1 het e-mailadres van de beheerder(s), hetzelfde adres als hun
   Supabase-gebruiker (Authentication → Users; de gebruiker van de snackbar kan ook).
2. Supabase → SQL Editor → New query → plak het hele bestand → Run. Opnieuw uitvoeren kan geen kwaad.
3. Controleer in Authentication dat *Allow new users to sign up* uit staat.
4. Ga naar `#/beheer`, log in en zet de inhoud over (zie 'Inhoud beheren').

Rechten in het kort: iedereen kan gepubliceerde inhoud lezen en alleen tóévoegen in de hub (inzending, stem, anonieme
teller). Inhoud wijzigen kan alleen een ingelogde beheerder uit `audit_admins`. Iedereen ziet in de hub alleen wat een
beheerder publiceert, en nooit naam of e-mailadres. Een inzender kan aangeven dat de inzending privé moet blijven;
die kun je dan niet publiceren. Optioneel: zet in `js/config.js` een `ideaFallbackEmail`, dan kan een collega bij een
storing de inzending ook per mail sturen.

## Privacy en veiligheid

- Geen klantgegevens op het platform: alle demo's zijn fictief, en wat je in 'Invullen' typt wordt nergens bewaard.
- In de browser bewaren we alleen favorieten, het thema, een willekeurige stem-code en de titels van je eigen inzendingen.
- De site en de repository zijn openbaar bereikbaar. Alles op het platform is informatie voor gebruikers; zet er nooit
  configuratie, systeemprompts, goedkeuringsdocumenten, interne opnames of klantinformatie op.
- De tellers in Beheer zijn anoniem (welke usecase, demo, prompt, tip, training of agent), zonder apparaat- of
  persoonsgegevens. Heb je het SQL-bestand al eens uitgevoerd vóór de trainingen of agents er waren? Voer het dan nog
  een keer uit, zodat ook die inhoud en tellers worden geaccepteerd (bestaande gegevens blijven staan).
- De ideeënhub waarschuwt als een tekst op een BSN of IBAN lijkt.
- Demo's draaien in een afgeschermd iframe (sandbox); de pagina staat alleen verbinding met Supabase toe (CSP).
- De namen in de browseropslag (`ai-snackbar-audit:…`, ook de inlogsessie `ai-snackbar-audit:sessie`) zijn bij de
  verhuizing bewust gelijk gebleven. Het adres valt onder hetzelfde domein (`joostprinsvv.github.io`), dus favorieten,
  thema, stemmen en een lopende inlog gaan gewoon mee. Verander deze namen niet, anders raakt iedereen dat kwijt.

## Lokaal testen

Open de root van deze repository via een lokale webserver (de demo's en de klembordknop werken niet betrouwbaar vanaf
`file://`) en ga naar `/`. Gebruik Edge of Chrome. Een eigen `.claude/` (bijv. `launch.json`) wordt niet gecommit
(zie `.gitignore`).
