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
js/disciplines.js     Disciplines: welke cockpit je ziet, wat op slot staat, de wisselaar in de kopbalk
js/*.js               De applicatie (iedere pagina een view-*.js, Beheer in admin-*.js)
data/disciplines.js   De disciplines en de gedeelde basis (startstand; daarna Beheer → Disciplines)
data/*.js             Startinhoud van Audit en terugval als de database niet bereikbaar is
data/voorbeelden/     Voorbeeldinhoud om een nieuwe discipline mee te beginnen (alleen via Beheer)
demos/                Nagespeelde Copilot-demo's (player.html + scripts.js)
assets/fonts/         IBM Plex (SIL Open Font License, zie OFL.txt)
assets/branding/      Favicon
assets/videos/        Opgenomen demo's (MP4, uit de snackbar overgenomen)
assets/demos/         HTML-demo van snack 1 (uit de snackbar overgenomen)
assets/trainingen/    Slides van trainingen, per training een map (assets/trainingen/<id>/slide-01.jpg …)
setup/                Het SQL-bestand voor Supabase
```

Alle paden zijn relatief binnen deze repository (geen `../`). De pagina zelf linkt niet naar andere sites; links naar
buiten staan alleen in de inhoud (bijv. de opname van een training of een agent).

## Onderdelen

| Adres | Wat |
| --- | --- |
| `#/` | Startpagina: zoeken, de onderdelen, uitgelichte usecases en tips, nieuw toegevoegd |
| `#/usecases`, `#/usecase/<id>` | Praktische usecases per fase van de controle, elk met demo, stappen, prompts, aandachtspunten en reviews |
| `#/prompts`, `#/prompt/<id>` | Promptdatabase: zoeken, filteren, favorieten, plaatshouders invullen, kopiëren en beoordelen |
| `#/tips`, `#/tip/<id>` | Tips & tricks, o.a. eigen instructies, Facilitator en geplande prompts |
| `#/trainingen`, `#/training/<id>` | Opnames van trainingen en sessies om terug te kijken, met hoofdstukken en materiaal, en per training een naslagwerk: slides, wat je meeneemt, acties om af te vinken, uit de zaal en het vervolg |
| `#/agents`, `#/agent/<id>` | Agents & tools: welke AI-agents en -producten er zijn, waarvoor (en waarvoor niet) en hoe je toegang krijgt |
| `#/ideeen` | Ideeënhub: idee, vraag, verzoek of prompt insturen; gepubliceerde inzendingen met antwoord en 'Ik ook' |
| `#/zoeken/<woorden>` | Zoeken in usecases, prompts, tips, trainingen en agents tegelijk |
| `#/beheer` | Voor het AI-team: inhoud per discipline en de gedeelde basis beheren, disciplines openzetten of op slot houden, inzendingen beantwoorden en publiceren, gebruik bekijken |

Ieder adres is deelbaar, bijvoorbeeld in Teams: `https://joostprinsvv.github.io/ai-cockpit-audit/#/tip/facilitator`.
Met `#/ideeen/vraag` (of `idee`, `verzoek`, `prompt`) staat de soort in de ideeënhub alvast goed.
Een andere discipline: `?d=<id>` vóór de `#`, bijv. `…/ai-cockpit-audit/?d=accountancy#/prompts`. Zonder `?d=`
kom je in de laatst gekozen discipline, of in Audit.

## Disciplines en gedeelde basis

De cockpit is er per discipline (Audit, Accountancy, Belastingadvies, Salarisadministratie, …), op één gedeelde basis.

- **Wisselaar:** in de kopbalk staat achter 'AI Cockpit' een knopje met de discipline ('Audit ⌄'). Daarin kies je een
  andere discipline. Je komt op dezelfde pagina; een detailpagina alleen als het item gedeeld is.
- **Open of op slot** (Beheer → Disciplines): een discipline op slot staat in de wisselaar met een slotje. Collega's
  kunnen er niet in (wie het adres toch opent, komt in Audit); beheerders wel, met bovenaan een balk 'Op slot'. Zo
  zet je de inhoud alvast klaar en zet je de discipline open als hij af is. Hier pas je ook naam, omschrijving,
  volgorde, icoon en kleur aan, en voeg je een discipline toe. Zolang je hier niets opslaat, geldt `data/disciplines.js`.
- **Wisselen in Beheer:** bovenaan Beheer kies je de discipline. *Inhoud*, *Inzendingen* en *Gebruik* gaan over de
  discipline waarin je zit.
- **Gedeelde basis** (Beheer → Gedeelde basis): wat in iedere cockpit staat, zoals de tips (met de tip van de week),
  agents & tools, trainingen en een paar algemene usecases en prompts. Eenmalig inrichten vanuit Audit: je vinkt aan
  wat voor iedereen is (het voorstel komt uit `sharedBasis` in `data/disciplines.js`), en die items verhuizen naar de
  basis. Voor Audit verandert er niets. Daarna pas je ze aan bij *Gedeelde basis*; op de site zie je als beheerder het
  label 'Voor iedereen'. Collega's zien dat label pas als er meer dan één discipline open is.
- **Nieuwe discipline:** open in Beheer de cockpit van die discipline. Zolang hij leeg is, kies je *Begin met een lege
  cockpit* (eerst de fasen toevoegen) of *Voorbeeldinhoud overnemen* (voor Accountancy: `data/voorbeelden/accountancy.js`,
  usecases gebaseerd op de snacks van de AI Snackbar).
- **Teksten per discipline:** Beheer → Inhoud → Teksten in een discipline gaat voor de teksten in de gedeelde basis, en
  die weer voor `js/config.js`. Hoe de discipline in lopende tekst heet ('Waarom handig in de audit', 'Per fase van de
  controle') stel je in bij Disciplines.

In de database heeft iedere discipline een eigen naamruimte (`ai-audit`, `ai-accountancy`, …) en de basis `ai-algemeen`;
inzendingen en tellers gaan naar de discipline waarin je zit. Daarvoor hoeft de SQL niet opnieuw te worden uitgevoerd.

## Inhoud beheren (Beheer → Inhoud)

Na het eenmalig instellen (zie 'Supabase instellen' hieronder) beheer je alle inhoud in de site zelf, zonder bestanden:

1. Ga naar `#/beheer` (link 'Beheer' onderaan iedere pagina) en log in.
2. De eerste keer: klik op **Overzetten naar de database**. De inhoud uit de bestanden gaat dan naar Supabase; vanaf
   dat moment tonen alle collega's de inhoud uit de database.
3. Kies een soort (Usecases, Prompts, Tips, Trainingen, Agents & tools, Fasen, Teksten) en klik op **Bewerken** of
   **Nieuwe …**. Je kunt alles aanpassen: teksten, prompts (met plaatshouders), stappen, fase, icoon, licentie, demo
   of video, de 'tip van de week'-datum, hoofdstukken, materiaal en het naslagwerk van trainingen, gekoppelde tips
   en usecases.
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
| `data/trainings.js` | Trainingen (opnames en naslagwerk): een fictief voorbeeld van een naslagwerk en onderaan een voorbeeld met opname |
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
  'Binnenkort'; daarna onder 'Terugkijken' met 'Opname volgt' (met een naslagwerk staan daar de slides).

### Naslagwerk na een training

Bij iedere training kan een naslagwerk staan, op dezelfde pagina (`#/training/<id>`). Alles is optioneel; een
onderdeel zonder inhoud verschijnt niet. Zie `data/trainings.js` voor een fictief voorbeeld.

| Onderdeel | Veld | Wat collega's zien |
| --- | --- | --- |
| Slides | `slides` | De eerste slide groot met 'Bekijk de slides', daaronder alle slides als miniatuur. Het venster bladert met knoppen, pijltjestoetsen of vegen. |
| Wat je meeneemt | `takeaways` | 3 tot 5 kaarten met een kop en uitleg; `warning: true` maakt er een rode waarschuwing van. |
| Aan de slag | `actions` | Een afvinklijst. Per actie kop en tekst, optioneel een link naar een slide, stappen (`howto`, met `more` als kop van het uitklapblok), kleine letters (`note`) en prompts of sjablonen om in te vullen en te kopiëren. |
| Uit de zaal | `ideas`, `questions` | Ideeën (kop en tekst) en open vragen. |
| Vervolg | `timelineIntro`, `timeline` | Een tijdlijn van de reeks (maand, titel, tekst); `current: true` markeert deze training, `training` linkt naar een andere training. |

Boven de onderdelen staat een inhoudsopgave (op een breed scherm blijft die links in beeld). De vinkjes bij 'Aan de
slag' staan alleen in de browser van die collega (lokale opslag, per training) en horen bij de kop van de actie:
pas een kop na publiceren liever niet meer aan. Alle velden staan uitgelegd bovenin `data/trainings.js`; in Beheer
staan dezelfde velden onder de kop **Naslagwerk**.

> **Let op: deze site en de repository zijn openbaar bereikbaar.** Zet in een naslagwerk alleen wat iedereen mag
> zien. Laat slides met interne informatie weg (bijv. de strategie van een vestiging, interne tools of documenten,
> QR-codes en deelnamecodes, foto's van collega's), en noem geen namen of uitspraken van deelnemers. Geen persoonlijke
> instructies of systeemprompts, geen klantinformatie. Twijfel je? Laat het weg.

**Zo voeg je na een training een naslagwerk toe:**

1. **Slides als afbeeldingen.** In PowerPoint: *Bestand → Exporteren → Bestandstype wijzigen → JPEG*, alle dia's.
   Laat de slides weg die niet openbaar mogen. Noem de bestanden `slide-01.jpg`, `slide-02.jpg`, … (twee cijfers) in
   de volgorde van het naslagwerk. Liefst 16:9, ongeveer 1600 px breed en hooguit ongeveer 150 kB per slide.
2. **Afbeeldingen in de repository.** Zet ze in `assets/trainingen/<id>/`, waarbij `<id>` het adres van de training
   is (bijv. `assets/trainingen/learn-play-sessie-2/slide-01.jpg`). Commit en push via GitHub Desktop; GitHub Pages
   zet ze binnen een paar minuten online. **Beheer kan geen afbeeldingen uploaden**: dat gaat altijd via de repository.
3. **De inhoud.**
   - *Zolang de database nog geen trainingen heeft:* zet de training in `data/trainings.js` en klik in Beheer → Inhoud
     op de melding **… uit de bestanden toevoegen**.
   - *Daarna (de database is leidend):* Beheer → Inhoud → Trainingen → **Nieuwe training**, en vul de velden onder
     **Naslagwerk** in (bij slides het pad, bijv. `assets/trainingen/learn-play-sessie-2/slide-01.jpg`). Een training
     die je alleen in `data/trainings.js` zet, verschijnt dan niet meer vanzelf.
   - *Of met een importbestand:* een JSON-bestand in de vorm hieronder zet je terug met **Importeer back-up**. Alleen
     items met hetzelfde adres worden overschreven; met `"status": "draft"` komt hij er als concept in.
4. **Controleren en publiceren.** Zet hem eerst op *Concept*, bekijk hem via **Bekijk op de site** en zet hem dan
   op *Gepubliceerd*. Een link naar een slide (`slide: 14`) telt vanaf 1 in de lijst met slides: laat je een slide
   weg, pas dan ook de nummers aan.

```json
{
  "rows": [
    {
      "type": "training",
      "id": "learn-play-sessie-2",
      "status": "draft",
      "data": {
        "title": "Verspilling in beeld",
        "date": "2026-12-10",
        "category": "Basistraining",
        "slides": [{ "image": "assets/trainingen/learn-play-sessie-2/slide-01.jpg", "title": "Titel" }],
        "takeaways": [{ "title": "Kop", "text": "Uitleg" }],
        "actions": [{ "title": "Kop", "text": "Uitleg", "slide": 1, "prompts": [{ "label": "Prompt", "text": "…" }] }],
        "timeline": [{ "month": "December", "title": "Verspilling in beeld", "current": true }]
      }
    }
  ]
}
```

**Met Claude:** geef Claude de PowerPoint (of de geëxporteerde slides) en je aantekeningen, en vraag om een
naslagwerk volgens deze sectie: de slides als `assets/trainingen/<id>/slide-NN.jpg` in deze repository en de inhoud
als importbestand (JSON) of als blok in `data/trainings.js`. Controleer daarna zelf of er niets interns in staat.

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

## Reviews bij usecases en prompts

Onderaan iedere usecase en prompt staat **Wat vond je ervan?**: 1 tot 5 sterren, met eventueel een korte toelichting
(maximaal 500 tekens).

- **Anoniem:** één review per apparaat per item, met dezelfde willekeurige code als de 'Ik ook'-stemmen. Wat je gaf,
  onthoudt de browser ('Bedankt! Je gaf 4 sterren').
- **Sterren tellen direct mee** in het gemiddelde bij de usecase of prompt. Een **toelichting** staat er pas als een
  beheerder hem publiceert, want de site is openbaar.
- **Beheer → Reviews** (per discipline): de toelichtingen die nog bekeken moeten worden, publiceren of verbergen,
  verwijderen, en per usecase en prompt het gemiddelde en het aantal reviews.
- Zolang de tabel `audit_reviews` nog niet bestaat (stap 6 in `setup/supabase-audit.sql`), verschijnt het blok niet.
  Uitzetten kan met `enableReviews: false` in `js/config.js`.

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
- In de browser bewaren we alleen favorieten, het thema, een willekeurige stem-code, de titels van je eigen inzendingen,
  welke usecases en prompts je hebt beoordeeld, de gekozen discipline en de afgevinkte acties uit een naslagwerk.
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
