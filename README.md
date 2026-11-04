# AI-cockpit Audit

*Jij bepaalt de koers, Copilot navigeert mee.*

Levend kennisplatform over Copilot voor alle auditcollega's van Visser & Visser. Gebouwd op dezelfde basis als de AI Snackbar, maar een los platform.
Statische website (HTML, CSS, JavaScript), live via GitHub Pages op **https://joostprinsvv.github.io/ai-cockpit-audit/**. Alle demo-inhoud is fictief.

Het platform stond eerst in de map `audit/` van de AI Snackbar (repository `AI-snackbar-platform`). Het oude adres
`https://joostprinsvv.github.io/AI-snackbar-platform/audit/` stuurt door naar hier, inclusief het deel na de `#`
(bijv. `#/prompts`). Deze repository is zelfstandig: er zijn geen verwijzingen naar bestanden buiten deze map.

## Structuur

```
index.html            De pagina (kopbalk, voet, iconen) en de beveiligingsregels (CSP)
css/variables.css     Alle tokens, voor het lichte én het donkere thema: kleuren, maten, lettertypes, beweging
css/base.css          Lettertypes, reset, focus en hulpklassen
css/audit.css         De opmaak van dit platform, ook voor hoog contrast (Windows) en afdrukken
css/admin.css         De opmaak van Beheer, de bewerkbalk en de bewerkmodus (alleen geladen voor wie beheert)
js/vroeg.js           Vóór de eerste weergave: het gekozen thema (geen witte flits) en een vangnet bij fouten
js/config.js          Instellingen: titel, gouden regels, Supabase
js/kinds.js           De soorten inhoud (usecase, prompt, tip, …): naam, adres, lijstpagina; één plek voor alles
js/blocks.js          Bouwstenen voor de pagina's: detailkop, lijsten, meldingen en de filters van de lijstpagina's
js/central.js         Centrale opslag (Supabase): alle verzoeken, via een paar gedeelde hulpfuncties
js/disciplines.js     Disciplines: welke cockpit je ziet, wat op slot staat, de wisselaar in de kopbalk
js/instruments.js     Cockpitstijl: de koersband (onder kopbalk en hero) en de kompasroos in de hero
js/admin-kit.js       Gereedschap voor Beheer: downloaden, meldingen, bezette knoppen, adressen en kleuren
js/rights.js          Rollen: wat de ingelogde beheerder mag (zelfde regels als de database)
js/editor.js          Werkversies, bewerkbalk, opslaan, publiceren (ook gepland), logboek, ongedaan maken
js/editmode.js        Bewerken op de pagina zelf: teksten, verslepen, toevoegen, verwijderen, zijpaneel
js/motion.js          Beweging: paginaovergangen, opstarten van de instrumenten, soepel filteren, thema-overgang
js/profile.js         Mijn gegevens: naam, functie, boekjaar … die de cockpit in prompts invult (alleen in je browser)
js/compass.js         Seizoenskompas op de startpagina (seizoenen uit Beheer of data/seizoenen.js)
js/radar.js           Radar: wat nieuw is sinds je vorige bezoek, op de kompasroos en onder het zoekvak
js/palette.js         Zoekvenster: Ctrl+K, / of de zoekknop, met acties en prompt meteen kopiëren
js/check.js           Het AI-beleid (link) en 'Mag dit?': de check in drie vragen, en 'Wat mag erin?' per agent
js/tour.js            Rondleiding bij het eerste bezoek (opnieuw via de voet en Ctrl+K)
js/improve.js         'Stel een verbetering voor' onder een prompt (stap 11); js/admin-improve.js beoordeelt het in Beheer
css/motion.css        Beweging in CSS: overgangen, uitklappers, panelen, scrolleffecten (uit bij 'minder beweging')
js/*.js               De applicatie (iedere pagina een view-*.js, Beheer in admin-*.js)
data/disciplines.js   De disciplines en de gedeelde basis (startstand; daarna Beheer → Disciplines)
data/seizoenen.js     De seizoenen van het seizoenskompas per discipline (startstand; daarna Beheer → Inhoud → Teksten)
data/*.js             Startinhoud van Audit en terugval als de database niet bereikbaar is (alleen dan geladen)
tools/versie.ps1      Nieuwe versie van de site: ?v=… in index.html ophogen (zie 'Snel laden')
tests/                Tests van de kern, in de browser (zie 'Tests')
data/voorbeelden/     Voorbeeldinhoud om een nieuwe discipline mee te beginnen (alleen via Beheer)
demos/                Nagespeelde Copilot-demo's (player.html + scripts.js)
assets/fonts/         IBM Plex (SIL Open Font License, zie OFL.txt)
assets/branding/      Logo: logo-dark.svg (zonder vierkant, voor de donkere kopbalk en nieuwsbriefkop),
                      logo.svg en favicon.svg (wit afgerond vierkant, los en als tabbladicoon)
assets/videos/        Opgenomen demo's (MP4, uit de snackbar overgenomen)
assets/demos/         HTML-demo van snack 1 (uit de snackbar overgenomen)
assets/trainingen/    Slides van trainingen, per training een map (assets/trainingen/<id>/slide-01.jpg …), soms met video
setup/                De SQL-bestanden voor Supabase: stap 1, 7 en 8 (in die volgorde), stap 9 (Copilot-gebruik), 10 (portfolio)
                      en 11 (verbetervoorstellen bij prompts)
```

Alle paden zijn relatief binnen deze repository (geen `../`). De pagina zelf linkt niet naar andere sites; links naar
buiten staan alleen in de inhoud (bijv. de opname van een training of een agent).

## Onderdelen

| Adres | Wat |
| --- | --- |
| `#/` | Startpagina: zoeken, de radar (nieuw sinds je vorige bezoek), de onderdelen, het seizoenskompas, uitgelichte usecases en tips, nieuw toegevoegd |
| `#/usecases`, `#/usecase/<id>` | Praktische usecases per fase van de controle, elk met demo, stappen, prompts, aandachtspunten en reviews |
| `#/prompts`, `#/prompt/<id>` | Promptdatabase: zoeken, filteren, favorieten, plaatshouders invullen, kopiëren en beoordelen |
| `#/tips`, `#/tip/<id>` | Tips & tricks, o.a. eigen instructies, Facilitator en geplande prompts |
| `#/trainingen`, `#/training/<id>` | Opnames van trainingen en sessies om terug te kijken, met hoofdstukken en materiaal, en per training een naslagwerk: slides, wat je meeneemt, acties om af te vinken, uit de zaal en het vervolg |
| `#/agents`, `#/agent/<id>` | Agents & tools: welke AI-agents en -producten er zijn, waarvoor (en waarvoor niet) en hoe je toegang krijgt |
| `#/ideeen` | Ideeënhub: idee, vraag, verzoek of prompt insturen; de route van een idee tot toepassing; gepubliceerde inzendingen met antwoord en 'Ik ook' |
| `#/zoeken/<woorden>` | Zoeken in usecases, prompts, tips, trainingen en agents tegelijk (snel: Ctrl+K op iedere pagina) |
| `#/promptbouwer` | Zelf een prompt bouwen in zes stappen, met een meter en wat er nog beter kan |
| `#/mijn` | Mijn gegevens: naam, functie, vestiging, team en boekjaar, voortaan ingevuld in iedere prompt |
| `#/beheer` | Voor het AI-team: inhoud per discipline en de gedeelde basis beheren, disciplines openzetten of op slot houden, inzendingen en reviews beoordelen, ideeën in het portfolio zetten (AI Value Matrix), de nieuwsbrief maken, gebruik bekijken, het Copilot-gebruik per periode volgen, doelen per discipline bewaken (Doelkoers), en het overzicht voor het bestuur |

Ieder adres is deelbaar, bijvoorbeeld in Teams: `https://joostprinsvv.github.io/ai-cockpit-audit/#/tip/facilitator`.
Met `#/ideeen/vraag` (of `idee`, `verzoek`, `prompt`) staat de soort in de ideeënhub alvast goed.
Een andere discipline: `?d=<id>` vóór de `#`, bijv. `…/ai-cockpit-audit/?d=accountancy#/prompts`. Zonder `?d=`
kom je in de laatst gekozen discipline, of in Audit.

## Disciplines en gedeelde basis

De cockpit is er per discipline (Audit, Accountancy, Belastingadvies, Salarisadministratie, …), op één gedeelde basis.

- **Wisselaar:** in de kopbalk staat achter 'AI-cockpit' een knopje met de discipline ('Audit ⌄'). Daarin kies je een
  andere discipline. Je komt op dezelfde pagina; een detailpagina alleen als het item gedeeld is.
- **Open of op slot** (Beheer → Disciplines): een discipline op slot staat in de wisselaar met een slotje. Collega's
  kunnen er niet in (wie het adres toch opent, komt in Audit); beheerders wel, met bovenaan een balk 'Op slot'. Zo
  zet je de inhoud alvast klaar en zet je de discipline open als hij af is. Hier pas je ook naam, omschrijving,
  volgorde, icoon en kleur aan, en voeg je een discipline toe. Zolang je hier niets opslaat, geldt `data/disciplines.js`.
- **Wisselen in Beheer:** bovenaan Beheer kies je de discipline. *Inhoud*, *Inzendingen*, *Gebruik* en
  *Copilot-gebruik* gaan over de discipline waarin je zit.
- **Gedeelde basis** (Beheer → Gedeelde basis): wat in iedere cockpit staat, zoals de tips (met de tip van de week),
  agents & tools, trainingen en een paar algemene usecases en prompts. Eenmalig inrichten vanuit Audit: je vinkt aan
  wat voor iedereen is (het voorstel komt uit `sharedBasis` in `data/disciplines.js`), en die items verhuizen naar de
  basis. Voor Audit verandert er niets. Daarna pas je ze aan bij *Gedeelde basis*; op de site zie je als beheerder het
  label 'Voor iedereen'. Collega's zien dat label pas als er meer dan één discipline open is.
- **Nieuwe discipline:** open in Beheer de cockpit van die discipline. Zolang hij leeg is, kies je *Begin met een lege
  cockpit* (eerst de fasen toevoegen) of *Voorbeeldinhoud overnemen*. Voor Accountancy (`data/voorbeelden/accountancy.js`)
  is dat de AI Snackbar van de Boost & Learn: de zes snacks als usecases met hun demo, en de dertig bijgerechten als
  losse prompts (met de versie zonder licentie en de vervolgstappen), en de training *Van AI-hype naar toepassing* met
  het naslagwerk van de ochtendsessie (19 slides en de videosamenvatting van 5 minuten met zes hoofdstukken in
  `assets/trainingen/van-ai-hype-naar-toepassing/`). Het volledige naslagwerk is alleen voor intern gebruik en staat
  versleuteld op de snackbar: in de cockpit staat de rest, met een link ernaartoe. De video staat er bewust wel, achter
  het slot met de pincode (zie *Slot met pincode*); wie het adres van het bestand kent, kan hem openen. De pro-versie van
  snack 4 (met Claude) staat er bewust niet in: in de cockpit werk je alleen met Copilot. Is Accountancy al ingericht,
  dan biedt Beheer dit niet meer aan.
- **Teksten per discipline:** Beheer → Inhoud → Teksten in een discipline gaat voor de teksten in de gedeelde basis, en
  die weer voor `js/config.js`. Hoe de discipline in lopende tekst heet ('Waarom handig in de audit', 'Per fase van de
  controle') stel je in bij Disciplines.

In de database heeft iedere discipline een eigen naamruimte (`ai-audit`, `ai-accountancy`, …) en de basis `ai-algemeen`;
inzendingen en tellers gaan naar de discipline waarin je zit. Daarvoor hoeft de SQL niet opnieuw te worden uitgevoerd.

## Beheer: de indeling

Links staat een zijbalk: bovenaan **Je beheert** (de discipline), daaronder de onderdelen per groep: *Start*; *Inhoud*
(de discipline en de gedeelde basis); *Inbreng van collega's* (inzendingen, reviews, portfolio); *Cijfers* (overzicht,
gebruik van de cockpit, Copilot-gebruik); *Communicatie* (nieuwsbrief); *Instellingen* (disciplines, beheerders).
Bovenaan ieder onderdeel staat voor welke discipline het is, of *Alle disciplines*. **Start** (`#/beheer`) laat zien wat
er te doen is (nieuwe inzendingen, toelichtingen die nog niet gepubliceerd zijn, de nieuwsbrief, de laatste import van
het Copilot-gebruik) en legt in drie zinnen uit hoe Beheer werkt. Wie alleen een rol voor inhoud heeft, ziet alleen
Start en die inhoud. De onderdelen staan in `TABS` in `js/view-admin.js`.

Bovenaan Start staat voor hoofdbeheerders **Klaar voor livegang?** (`js/admin-launch.js`): wat er nog moet voordat
collega's alles kunnen gebruiken, met een knop naar de plek waar je het regelt.
- **Database (eenmalig):** stap 13 (invliegen), stap 14 (tijdwinst) en stap 12 (brevetten met echte accounts; pas nodig
  bij de Microsoft-login). De cockpit controleert zelf of een stap is uitgevoerd, door een functie van die stap
  alleen-lezend aan te roepen (`probe` in `js/central.js`).
- **Cockpit van de discipline:** inhoud in de database, schattingen van de tijdwinst (klaar vanaf 80%), de startprompts
  van de Kickstart (naar keuze) en de AI-specialist voor invliegen.
- **Alle disciplines:** de beloftes van het AI-team.
Is alles klaar, dan klapt het blok in tot één regel.

## Inhoud beheren (Beheer → Inhoud)

Na het eenmalig instellen (zie 'Supabase instellen' hieronder) beheer je alle inhoud in de site zelf, zonder bestanden:

1. Ga naar `#/beheer` (link 'Beheer' onderaan iedere pagina) en log in; kies links bij *Inhoud* de discipline of de
   gedeelde basis.
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
   direct zichtbaar. Voer eerst `setup/supabase-audit.sql` opnieuw uit (zie hieronder), anders weigert de database ze;
   dat laat wat stap 7 en 8 hebben ingesteld gewoon staan.

Je blijft ingelogd zolang het tabblad open is. Als beheerder tel je niet mee in de gebruiksstatistiek.

Goed om te weten:
- Bezoekers krijgen eerst de laatst bekende inhoud uit hun browser (snel) en daarna de actuele. Is de database even
  niet bereikbaar, dan blijft de site gewoon werken met die laatste versie, of met de bestanden.
- Video's en demo's moeten op de site zelf staan (pad zoals `assets/videos/naam.mp4`); trainingen linken naar
  Stream/SharePoint met `https://`. Andere soorten links worden geweigerd.
- Oude paden uit de tijd in de snackbar (`../assets/…`) die nog in de database staan, worden automatisch gelezen als
  `assets/…`. Open je zo'n item in Beheer en sla je het op, dan wordt het nieuwe pad bewaard.
- De nagespeelde demo-gesprekken (`demos/scripts.js`) pas je nog in het bestand aan.

## Bewerken op de site, publiceren en rollen (stap 7)

Na het uitvoeren van `setup/supabase-audit-bewerken.sql` werkt beheer in drie lagen:

1. **Niet opgeslagen:** wat je net hebt aangepast. Staat alleen in je browser en wordt automatisch bewaard (ook als het
   tabblad dichtgaat). **Ongedaan maken** en **Opnieuw** werken hierop (ook Ctrl+Z en Ctrl+Y).
2. **Opgeslagen werkversie:** met **Opslaan** (licht op bij een wijziging, ook Ctrl+S). Alleen beheerders zien hem,
   met een label (Gewijzigd, Nieuw, Voorstel, Gepland).
3. **Gepubliceerd:** met **Publiceren** zie je wat klaarstaat, met aandachtspunten (bijv. een verwijzing naar iets
   dat niet bestaat of een usecase zonder demo). Dat is een hulp, geen blokkade. Publiceer nu, of **plan** een
   moment: de wijziging gaat live bij het eerstvolgende bezoek na dat moment (met pg_cron binnen een minuut, zie
   stap 8). Je publiceert precies de versie die je in het paneel zag: is het item intussen opnieuw opgeslagen, dan
   wordt het overgeslagen. Slaat een bijdrager een voorstel op voor een ingepland item, dan vervalt de planning (die
   versie heeft nog niemand bekeken).

**De bewerkbalk** staat bovenin zodra je bent ingelogd: je rol, **Bewerken**, de status, Ongedaan maken, Opnieuw,
Opslaan, Publiceren, **Logboek** (wie wat wanneer deed, per dag in te klappen en te doorzoeken op naam, actie, titel
of datum, met per item de eerdere versies om terug te zetten) en
**Als collega** (de site zoals collega's hem zien). Iemand anders hetzelfde item open? Dan zie je een melding.
Sloeg iemand het intussen op, dan kies je of jouw versie of die van de ander blijft.

**Bewerken** zet de pagina zelf in de bewerkmodus: klik op een titel of korte tekst om hem aan te passen, versleep
kaarten (of gebruik de pijltjes), open met het potlood alle velden in een zijpaneel, verwijder met de prullenbak en
voeg toe met de plusknop aan het eind van een lijst. Op de startpagina pas je ook naam, slogan en uitleg aan.

**Rollen** (Beheer → Beheerders, alleen voor hoofdbeheerders), per discipline, voor de gedeelde basis of voor alle
disciplines, en eventueel alleen voor bepaalde onderdelen (bijv. alleen tips):

| Rol | Mag |
| --- | --- |
| Hoofdbeheerder | Alles, ook beheerders, disciplines, inzendingen, reviews, nieuwsbrief en gebruik |
| Beheerder | Bewerken, verwijderen en publiceren |
| Redacteur | Bewerken en publiceren, niet verwijderen |
| Bijdrager | Alleen voorstellen; een beheerder of redacteur publiceert (vier ogen) |

Een nieuwe beheerder heeft ook een account nodig met hetzelfde e-mailadres: maak dat aan in Supabase
(Authentication → Users → Add user). Het tabblad Beheerders laat zien of het account er al is.

**Uploaden:** bij video's, afbeeldingen (poster, slides) en bijlagen staat een knop **Uploaden**. Bestanden gaan
naar Supabase Storage (map `cockpit-media`, maximaal 50 MB) en zijn openbaar: alleen materiaal zonder klant- of
interne informatie. Langere opnames blijven via een link naar Stream of SharePoint.

Zolang stap 7 niet is uitgevoerd, werkt Beheer zoals voorheen: opslaan in een formulier zet het direct live.

## Beveiligen en betrouwbaar publiceren (stap 8)

`setup/supabase-audit-beveiligen.sql` voer je uit na stap 7. Zet eerst de nieuwe versie van de site live: die werkt
met én zonder stap 8, de oude versie werkt na stap 8 niet meer voor beheerders. Wat het doet:

- Werkversies, planning en e-mailadressen van beheerders zijn alleen te lezen voor wie een rol heeft in die
  discipline, niet voor iedere ingelogde gebruiker van het (met de snackbar gedeelde) Supabase-project.
- Vier ogen ook bij gepland publiceren, en publiceren per versie (zie hierboven).
- Een rechtstreekse wijziging (back-up terugzetten, definitief verwijderen) komt in het logboek.
- Een geüpload bestand kan niet meer worden overschreven.
- Met meerdere rollen telt iedere rol mee (bijv. beheerder van Tips én redacteur van alles).
- Staat in Supabase de extensie pg_cron aan (Database → Extensions), dan gaat een planning binnen een minuut live.

Stap 1 en 8 kun je later gerust opnieuw uitvoeren. Stap 7 weigert na stap 8 (het zou functies terugzetten naar de
oude vorm); voer dan alleen stap 8 opnieuw uit. Onderaan het bestand van stap 8 staat een proef die je in de SQL
Editor kunt draaien (wordt teruggedraaid).

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
- **Prompt met meer stappen of zonder licentie:** een losse prompt kan vervolgprompts hebben (`followUps`, in dezelfde
  chat) en, als hij een licentie nodig heeft, een versie voor de gratis Copilot Chat (`promptBasic`, `noteBasic`). Bij
  de prompt kies je dan *Met licentie* of *Zonder licentie*; het filter *Zonder licentie* laat hem ook zien. In Beheer
  staan dezelfde velden onder de prompttekst.
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
(`assets/demos/` en `assets/videos/`).
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
- **Voor wie** (`audience`: `assistent`, `senior`, `manager`, `partner`; leeg = voor iedereen). Op de kaart staat dan
  "Voor managers". Wie die rol heeft, ziet de training bovenaan met "Voor jou". De rol komt uit Mijn gegevens: gekozen,
  of afgeleid uit de functie ("Senior manager" → manager). Boven 'Terugkijken' staat een filter *Voor wie*; daarbij
  staan ook de trainingen voor iedereen. Niets wordt verborgen: iedereen kan elke training openen.

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

**De snelle route, helemaal in Beheer (zonder bestanden of ontwikkelaar):**

1. Beheer → Inhoud → Trainingen → **Nieuwe training**: titel, datum en eventueel *Voor wie*.
2. Open bovenaan **Naslagwerk maken met Copilot** (`js/admin-naslag.js`).
   - Kopieer de prompt en plak hem in Copilot Chat (werkaccount), met de PowerPoint of PDF en het transcript van de
     Teams-opname erbij.
   - Plak het hele antwoord terug en klik op **Invullen**. De cockpit haalt eruit wat hij kent: titel, ondertitel,
     omschrijving, kernpunten, acties met stappen en prompts, hoofdstukken met tijden, ideeën en vragen uit de zaal.
   - Wat er al stond bij die onderdelen wordt vervangen (na een vraag). Slides, datum, links en *Voor wie* blijven.
   - De cockpit waarschuwt bij een e-mailadres, iets wat op een BSN of rekeningnummer lijkt, en hoofdstukken zonder
     geldige tijd.
3. Bij **Slides**: **Alle slides in één keer uploaden**. Exporteer in PowerPoint alle dia's als JPEG en selecteer ze
   allemaal. Ze komen op volgorde van de bestandsnaam (Dia1, Dia2, … Dia10). Laat slides die niet openbaar mogen eerst
   weg.
4. Lees alles na, geef de slides een titel, sla op en publiceer.

**De uitgebreide route (bestanden en repository):**

1. **Slides als afbeeldingen.** In PowerPoint: *Bestand → Exporteren → Bestandstype wijzigen → JPEG*, alle dia's.
   Laat de slides weg die niet openbaar mogen. Noem de bestanden `slide-01.jpg`, `slide-02.jpg`, … (twee cijfers) in
   de volgorde van het naslagwerk. Liefst 16:9, ongeveer 1600 px breed en hooguit ongeveer 150 kB per slide.
2. **Afbeeldingen in de repository.** Zet ze in `assets/trainingen/<id>/`, waarbij `<id>` het adres van de training
   is (bijv. `assets/trainingen/learn-play-sessie-2/slide-01.jpg`). Commit en push via GitHub Desktop; GitHub Pages
   zet ze binnen een paar minuten online. Na stap 7 kan het ook met **Uploaden** bij ieder slideveld in Beheer
   (openbaar, zie 'Bewerken op de site'); via de repository blijven de slides van een training bij elkaar in één map.
3. **De inhoud.**
   - *Zolang de database nog geen trainingen heeft:* zet de training in `data/trainings.js` en klik in Beheer → Inhoud
     op de melding **… uit de bestanden toevoegen**.
   - *Daarna (de database is leidend):* Beheer → Inhoud → Trainingen → **Nieuwe training**, en vul de velden onder
     **Naslagwerk** in (bij slides het pad, bijv. `assets/trainingen/learn-play-sessie-2/slide-01.jpg`). Een training
     die je alleen in `data/trainings.js` zet, verschijnt dan niet meer vanzelf.
   - *Of met een importbestand:* een JSON-bestand in de vorm hieronder zet je terug met **Importeer back-up**. Alleen
     items met hetzelfde adres worden overschreven; met `"status": "draft"` komt hij er als concept in.
4. **Controleren en publiceren.** Sla hem op (een werkversie: alleen beheerders zien hem), bekijk hem via **Bekijk op
   de site** en zet hem live met **Publiceren** in de bewerkbalk. (Zonder stap 7: eerst *Concept*, daarna
   *Gepubliceerd*.) Een link naar een slide (`slide: 14`) telt vanaf 1 in de lijst met slides: laat je een slide
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
- **Link:** de knop 'Openen' opent hem in een nieuw tabblad (alleen `https://`). Een Copilot-agent moet in Copilot zelf
  met collega's gedeeld zijn, anders krijgen ze geen toegang.
- **Fasen:** de overzichtspagina is ingedeeld naar de fasen, net als de prompts: bovenaan een filter per fase, daaronder
  een groep per fase. Een agent met een paar fasen staat in elk daarvan; een agent in (bijna) alle fasen staat één
  keer, bij *In elke fase*. Namen, kleuren en volgorde van de fasen pas je aan bij Beheer → Inhoud → Fasen.
- **Uitgelicht in het seizoen:** de fasen van wat nu speelt in het seizoenskompas (Beheer → Inhoud → Teksten →
  Seizoenskompas, *Fasen bij dit seizoen*) staan bovenaan, in een eigen vlak met *Nu in het seizoen*. Bij Audit nu
  Interne beheersing en Planning (interimcontroles), in het voorjaar de fasen van risico-inschatting, controle en afronding.
  Dat geldt ook bij de prompts (die groepen eerst) en de usecases (eerst die van het seizoen, dan *Alle andere
  usecases*), zolang je op Alle fasen en de gewone volgorde staat.
- **Nieuw:** een agent (net als alle andere inhoud) heeft het label *Nieuw* tot 45 dagen na *Toegevoegd op*
  (`newDays` in `js/config.js`); inhoud van vóór de lancering (`launchDate`) krijgt het niet.
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
- **Op de kaarten** staat het gemiddelde (★ 4,6 (5)), en bij prompts en usecases kun je de **volgorde** zetten op
  **Best beoordeeld**: hoogste gemiddelde eerst, bij gelijk gemiddelde het grootste aantal; zonder beoordelingen achteraan.
- **Favoriet bij collega's** op de startpagina: de vier best beoordeelde prompts en usecases met minstens drie
  beoordelingen (`MIN_REVIEWS` in `js/view-home.js`). Zolang er niets aan die drempel voldoet, staat het blok er niet.

## Kopieer en open Copilot

Bij iedere prompt staat **Kopieer en open Copilot** (op de kaart: **Copilot**). Die kopieert de prompt, met wat je
bij 'Invullen' hebt ingevuld, en opent Copilot Chat met je zakelijke account (`copilotUrl` in `js/config.js`) in een
nieuw tabblad. Daar plak je hem met Ctrl+V.

Microsoft heeft geen officiële manier om een prompt al in het typveld van Microsoft 365 Copilot te zetten. Getest op
23 oktober 2026: `?prompt=…` en `?q=…` (de parameter die ChatGPT gebruikt) laten het typveld in onze omgeving leeg,
zowel op `https://m365.cloud.microsoft/chat/` als op `https://copilot.cloud.microsoft/`, dus het blijft bij kopiëren en
openen. Komt Microsoft later met zo'n parameter, dan zet je die in `copilotPromptParam` in
`js/config.js`; het kopiëren blijft dan als reserve werken. Gebruik nooit de gratis consumentenversie
(copilot.microsoft.com): die heeft niet de bescherming van je zakelijke account.

## Bewaren en recent bekeken

- Met de **bladwijzer** bewaar je een prompt, usecase of tip (op de kaart en op de pagina zelf). Bij prompts, usecases
  en tips filter je met **Bewaard** op wat je bewaard hebt. De sterren zijn alleen voor beoordelingen.
- Op de startpagina staan **Jouw bewaarde items** (de laatste zes) en **Recent bekeken** (de laatste vier usecases,
  prompts, tips, trainingen of agents die je opende).
- Beide staan **alleen in je eigen browser** (`ai-snackbar-audit:favorites` en `ai-snackbar-audit:viewed`): niemand
  anders ziet ze en er gaat niets naar de database. De oude favorieten (alleen prompts) tellen gewoon mee als bewaard.

## Persoonlijk en slim

- **Mijn gegevens** (`#/mijn`, de knop met je initialen rechtsboven): je naam, functie, rol (assistent, senior, manager
  of partner; leeg = afgeleid uit je functie, voor "Voor jou" bij trainingen), vestiging, team, soort klanten
  en het boekjaar waar je mee bezig bent (niet invullen, automatisch of een vast jaar; automatisch = tot en met juni
  het vorige jaar). Plaatshouders met precies die naam (`[NAAM]`, `[FUNCTIE]`, `[VESTIGING]`, `[TEAM]`, `[JAAR]`,
  `[VORIG JAAR]`, …) staan daarmee al ingevuld: in het promptblok (groen, per prompt te overschrijven), bij Kopieer en
  Copilot op de kaarten, in de promptbouwer en het zoekvenster. `[NAAM AFZENDER]` of `[NAAM EN FUNCTIE]` is iemand
  anders: die blijven open. Je naam staat ook al bij een inzending, en de startpagina begroet je. Alleen in je browser
  (`ai-snackbar-audit:profiel`), nooit verstuurd; geen klantgegevens.
- **Seizoenskompas** op de startpagina: wat er nu speelt in het jaar (een wijzerplaat met de seizoenen en een naald op
  vandaag), wat er ook speelt, wat hierna komt en de usecases, prompts en tips die nu het handigst zijn (eerst wat de
  zoekwoorden van een seizoen vinden, dan uit de fasen). De seizoenen staan per discipline in `data/seizoenen.js`
  (Audit: planning en jaarovergang jul–sep, planning en interimcontroles sep–dec, voorraadinventarisaties dec,
  risico-inschatting, controle en afronding jan–jun; Accountancy: een voorstel). Aanpassen in Beheer → Inhoud →
  Teksten → Seizoenskompas (*Standaard overnemen om aan te passen*); dan is dat leidend.
- **Radar**: wat er nieuw is sinds je vorige bezoek, als rode stipjes op de kompasroos (een veeg 'vindt' ze bij het
  openen). Op een smal scherm (onder 1240 pixels), waar de roos niet staat, als strook onder het zoekvak met een klein
  draaiend radartje. In *Recent toegevoegd* onderaan de startpagina krijgt wat nieuw voor je is een rood bolletje.
  Wat je opent (of in de strook met het kruisje wegklikt), verdwijnt. Wat je kent, onthoudt je browser per discipline
  (`ai-snackbar-audit:radar:<discipline>`, alleen adressen); bij je allereerste bezoek staat er wat recent is toegevoegd.
- **Zoekvenster** (Ctrl+K, / buiten een tekstveld, of de zoekknop): zoek en kies met de pijltjes een usecase, prompt,
  tip, training, agent of actie (promptbouwer, Mijn gegevens, een vraag stellen, het thema). Enter opent, Ctrl+Enter
  kopieert een prompt meteen (met je gegevens erin).
- **Prompt aanvragen of delen zonder naar de ideeënhub** (`ns.ideas.quick` in `js/view-ideas.js`): bovenaan de
  promptdatabase staat *Staat jouw prompt er niet bij?* met *Vraag een prompt aan* en *Deel je prompt*, met
  ernaast een eigen donkere kaart naar de promptbouwer (`teaser()` in `js/view-builder.js`, met een kleine meter
  waarvan de naald bij hover uitslaat). Een venster op de pagina zelf; wat je al zocht en de fase die je koos staan er al in, je naam uit Mijn
  gegevens ook. Een aanvraag wordt een *Verzoek* met de titel "Prompt voor: …", een gedeelde prompt een *Prompt delen*,
  gewoon in Beheer → Inzendingen. Ook bij geen zoekresultaten (op de promptdatabase, de zoekpagina en in Ctrl+K:
  *Vraag een prompt aan: "…"*), met Ctrl+K (*Vraag een prompt aan*, *Deel je prompt*) en in de promptbouwer (*Deel je
  prompt*, met de prompt al ingevuld). Met dezelfde controle op een BSN of IBAN als in de hub.
- **Promptbouwer** (`#/promptbouwer`, ook vanaf de promptdatabase): rol, doel, context, bron, verwachting en extra
  zekerheid; rechts groeit de prompt mee met een meter (0–100) en wat er nog mist. Drie voorbeelden om mee te
  beginnen, 'Over mij invoegen' uit Mijn gegevens, een waarschuwing bij iets dat op een BSN of IBAN lijkt, en
  *Deel je prompt* (een venster met de prompt al ingevuld). Wat je typt wordt niet bewaard.
- **Een kopie op je eigen computer** (localhost of een bestand) telt niet mee in de anonieme tellers.
- **Rondleiding** (`js/tour.js`): wie de cockpit voor het eerst opent, krijgt op de startpagina (even na het opstarten,
  na het slot met pincode) een korte rondleiding: welkom, zoeken (Ctrl+K), het menu, de radar, het seizoenskompas,
  Mijn gegevens en veilig werken, en een slot met de weg naar de prompts en de promptbouwer. Een lichtbundel schuift
  vloeiend van onderdeel naar onderdeel; vorige en volgende met de knoppen of de pijltjes, Esc of het kruisje stopt.
  Een onderdeel dat er niet is (de kompasroos op een smal scherm), slaat hij over. Daarna nooit meer vanzelf
  (`ai-snackbar-audit:rondleiding`); opnieuw via *Rondleiding* onderaan iedere pagina, Ctrl+K of `?rondleiding` in het
  adres. Een ingelogde beheerder krijgt hem niet vanzelf. Iedereen opnieuw laten zien (bijv. na een grote
  vernieuwing): verhoog `VERSION` in `js/tour.js`.

## AI-beleid en 'Mag dit?'

Geen eigen pagina: het beleid staat waar je de vraag hebt.

- **Het AI-beleid van V&V**: een link onder de gouden regels onderaan iedere pagina, bij iedere agent en in de check.
  Het adres staat in `policyUrl` (`js/config.js`, nu het Serviceplein) en is te overschrijven in Beheer → Gedeelde
  basis → Teksten. Het beleid zelf staat niet op de site.
- **Mag dit?** (de knop onder de gouden regels, Ctrl+K "mag dit", de knop bij een agent en de BSN-waarschuwing in de
  promptbouwer): een venster met drie vragen. Welke tool (de agents & tools die niet gestopt zijn, of ChatGPT, Claude
  of een andere tool via de browser), welke data (de vier soorten uit het AI-beleid: algemene data, persoonsgegevens,
  vertrouwelijke klantgegevens, hoog-risico-data) en waar de uitkomst terechtkomt. Het antwoord (groen ja, oranje ja
  mits of nog niet vastgesteld, rood nee) volgt het AI-beleid en wat per tool is vastgelegd: een tool via de browser is
  voor je werk altijd nee, hoog-risico-data nee (behalve in een in-house-app, na afstemming met de CTO), een tool in
  ontwikkeling nee, een pilot 'mits', en persoonsgegevens en klantdata volgens *Data in deze tool*. Naar de klant of in
  het dossier: met de herinnering om na te lezen en vast te leggen. Onderaan: *Het beleid in het kort*, de tabel met
  tools en soorten data uit het beleid.
- **Per agent** (Beheer → Agents & tools): *Data in deze tool* (alleen algemene data; ook persoonsgegevens en
  klantdata; of ook hoog-risico-data na afstemming met de CTO), *Gebruikt ook webbronnen (Work + Web)*, *Wel geschikt
  voor* en *Niet gebruiken voor*. Het niveau (en *Work + Web*) staat als label op de kaart; op de pagina staat het blok
  *Wat mag erin?* met de knop *Mag dit? Check het*. Staat het niveau op *Volgens het AI-beleid* (de standaard), dan
  volgt de cockpit het beleid per soort: *Microsoft-standaard* (Copilot, met of zonder licentie: ingelogd met je
  zakelijke account en in de Werk-modus) en *Eigen agent* ook persoonsgegevens en klantdata, geen hoog-risico-data; een
  eigen agent met webtoegang alleen algemene data; *Extern product* alleen algemene data. Kies alleen een ander niveau
  als dat voor die tool apart is vastgesteld (bijv. Ilse, of een goedgekeurd extern product).

### Zo volgt de cockpit het AI-beleid

Getoetst aan het AI-beleid van V&V (Serviceplein, stand november 2026). Het beleid gaat over AI in het algemeen; de
cockpit gaat over Copilot. Hieronder per onderdeel van het beleid waar het in de cockpit zit. Wijzigt het beleid, loop
deze lijst dan na (en `js/check.js`: `DATA`, `LEVELS`, `POLICY_TABLE` en `verdict`).

| Uit het beleid | In de cockpit |
| --- | --- |
| Vier soorten data: algemene data, persoonsgegevens, vertrouwelijke klantgegevens, hoog-risico-data | Vraag 2 van *Mag dit?*, met dezelfde namen en uitleg; *kies de zwaarste* |
| Tools vs. type data: in-house-apps (Ilse) alles, hoog-risico alleen na afstemming met de CTO; Copilot (alleen Werk-modus) t/m klantdata; LLM's via de browser en overige tools alleen persoonlijk met algemene data | *Het beleid in het kort* (tabel in *Mag dit?*), de niveaus bij *Data in deze tool* en het antwoord van de check |
| Zakelijk gebruik van LLM's alleen via Copilot of Ilse; ChatGPT, Claude, Gemini via de browser niet, ook niet betaald | Keuze *ChatGPT, Claude, Gemini of een andere tool via de browser* in de check: altijd nee voor je werk, met de uitzondering voor persoonlijke algemene ondersteuning; gouden regel 1 |
| Copilot alleen in de Werk-modus; extra alert bij webbronnen | Bij persoonsgegevens of klantdata in een Microsoft-tool: *gebruik de Werk-modus*; bij een agent met webtoegang: label *Work + Web* en *controleer extra* |
| Agents in Copilot Studio als pilot, binnen de beheerde omgeving; *Work + Web* zichtbaar via naam of toelichting | Status *Pilot* (check: *alleen voor de pilotgroep*), veld *Gebruikt ook webbronnen (Work + Web)* met het label op kaart en pagina |
| Dataminimalisatie, anonimiseren, fictieve gegevens en gevoelige informatie pas zelf invullen in de definitieve versie | De [PLAATSHOUDERS] in alle prompts (wat je invult wordt niet bewaard), *Mag dit?* bij persoonsgegevens (*ja, mits*), gouden regel 4, de BSN/IBAN-waarschuwing in de promptbouwer en de ideeënhub |
| AI is een hulpmiddel; output is een concept; controleer harde feiten aan de bron; niet letterlijk overnemen; jij blijft verantwoordelijk | Gouden regels 2 en 3, en in de check bij *intern* of *naar de klant* |
| Bij twijfel niet gebruiken tot afstemming (het beleid noemt leidinggevende, disciplinedirectie, Business IT, Legal & Risk of de CTO, en één AI-aanspreekpunt per discipline als eerste aanspreekpunt) | Onder ieder *ja, mits* en *nog niet vastgesteld* in de check, en in *Het beleid in het kort*: *navragen bij de AI-specialist van je discipline, je leidinggevende of IT* (het eerste aanspreekpunt; zij schalen zo nodig op) |
| Nieuwe tools en AI-modules vooraf toetsen (CTO, leverancierscontrole) | Een andere tool is in de check altijd nee; de ideeënhub en de route van een idee lopen via het AI-team |
| AI-geletterdheid (AI Act) en kennis delen via de AI-werkgroep | De cockpit zelf: usecases, prompts, tips, trainingen en de ideeënhub |

**Bewust strenger of specifieker dan het beleid:** de gouden regels noemen het BSN apart (de check rekent het tot
hoog-risico-data), en *leg vast in het dossier* komt uit de beroepspraktijk van de audit. **Nog te bevestigen:** de
vinkjes van de tabel *tools vs type data* zijn uit de tekst van het beleid afgeleid; voor Copilot en hoog-risico-data
staat in het beleid "tot en met level 3 van de interne dataclassificatie" (de cockpit gaat uit van: geen hoog-risico-data).

**Gouden regels:** die staan in de database (Beheer → Gedeelde basis → Teksten) en gaan voor `js/config.js`. In
`js/config.js` staan ze in lijn met het beleid (regel 1 noemt Ilse en betaalde LLM's, regel 4 hoog-risico-data);
neem ze daar over als ze nog de oude tekst hebben.

## Verbetervoorstellen bij prompts (stap 11)

Onder iedere prompt (bij de prompt zelf en bij een usecase) staat **Beter idee? Stel een verbetering voor**. Een
collega past de tekst aan, zegt wat er beter is en verstuurt het; het wordt een inzending van de soort *Verbetering*
(niet in de hub gepubliceerd). In **Beheer → Inzendingen** zie je bij zo'n inzending bij welke prompt hij hoort, de
toelichting en per woord wat er verandert. Klik op een wijziging om hem wel of niet over te nemen (of *Alles* /
*Niets*), pas het resultaat eventueel met de hand aan, en kies **Overnemen in de cockpit**: dat zet het klaar als
niet-opgeslagen wijziging (bekijk het op de pagina, en sla op en publiceer met de bewerkbalk) en zet de inzending op
Gerealiseerd. Is de prompt sinds het voorstel aangepast, dan staat dat erbij.

Eenmalig: voer `setup/supabase-audit-verbeteringen.sql` uit (stap 11, na stap 1; overnemen gebruikt de werkversies
van stap 7). Die voegt de soort *verbetering* toe en één kolom `target` (bij welke prompt). Tot dan lukt versturen
niet en biedt het venster aan je versie te kopiëren; de andere inzendingen werken gewoon.

## AI-brevetten (Mijn logboek, Beheer → AI-brevetten, stap 12)

Wie meedoet (opt-in), verdient **AI-miles** en haalt **brevetten**: Cadet, Co-pilot, CaptAIn en Commander, als
epauletstrepen (1, 3, 4, en 4 met een ster). Een brevet = genoeg miles én de checkride van dat brevet (en van de
vorige), zoals een piloot vlieguren én een examen nodig heeft. Alles staat op **Mijn logboek** (`#/mijn`, de knop
rechtsboven, met je strepen erop): je brevet, je miles, de checkride voor het volgende brevet met knoppen om meteen te
beginnen, wat je recent verdiende, trainingen waarvoor je bent aangemeld, en stoppen (dan wordt je logboek gewist).
Bij een promotie verschijnt één keer een venster met een korte animatie, wat het brevet betekent en de volgende
checkride (bij openen van de cockpit, of terwijl je hem open hebt). De rondleiding eindigt met een uitnodiging om mee
te doen; wie de rondleiding al had, krijgt op de startpagina één keer een kaartje.

| Brevet | Miles | Checkride |
|---|---|---|
| Cadet | 0 | rondleiding, Mijn gegevens, check "Veilig vliegen" (5 vragen over het AI-beleid) |
| Co-pilot | 250 | 10 verschillende prompts, 3 demo's, 1 training (live of opname), 4 weken actief |
| CaptAIn | 1.000 | 1 bijdrage overgenomen, 1 live training, 2 trainingen, 25 verschillende prompts |
| Commander | 2.500 | 25 keer dat een collega jouw prompt gebruikte, een sessie gegeven, voorgedragen door het AI-team |

**Tegen sparen met klikken** (`js/brevet.js`): gebruik telt per uniek ding (elke prompt, demo of beoordeling één
keer) en samen hoogstens 25 miles per dag; insturen hoogstens 3 keer per week; het grootste deel komt pas als het
AI-team een bijdrage overneemt; royalty's tellen elke collega één keer (nooit jezelf), hoogstens 100 per maand. Een
video-demo telt pas als hij helemaal is bekeken. Miles worden altijd opnieuw berekend uit het **feitenlogboek** (wie,
wat, welk item, wanneer); de database zet het tijdstip, dus terugdateren kan niet.

**Wie ziet wat.** Het AI-team (hoofdbeheerders) ziet het logboek: gebruik en bijdragen. Collega's zien alleen wat
iemand kiest te delen (het brevet, nooit het gebruik). Wie niet meedoet, wordt alleen anoniem geteld, zoals altijd.
Omdat beheer gebruik per persoon ziet, kan dit gelden als personeelsvolgsysteem (art. 27 lid 1 sub l WOR): leg het
voor aan de ondernemingsraad en de privacy-officer voordat echte collega's meedoen.

**Beheer → AI-brevetten** (hoofdbeheerders): *Deelnemers* (brevet, miles, laatst actief; per persoon het logboek,
miles toekennen met een reden, een sessie vastleggen, voordragen als Commander, een prompt op iemands naam zetten voor
de royalty's, een feit weghalen; CSV), *Trainingen* (per training wie is aangemeld en wie er was; alleen deelnemers
toe te voegen; *aanwezig* levert miles op en telt voor de checkride) en *Regels*. Een inzending op **Gerealiseerd**
zetten (ook via *Overnemen in de cockpit* bij een verbetervoorstel) kent automatisch miles toe als de indiener
meedoet (op e-mailadres; in de demo op naam).

**Regels aanpassen** (*Regels*): per brevet de naam, de drempel in AI-miles, de voordelen (één per regel) en de
aantallen van de checkride; de AI-miles per actie; de plafonds (per dag, per week insturen, royalty's per maand) en
hoe lang iemand "actief" telt. Twee niveaus: **Alle disciplines** (de gedeelde basis) en **Alleen <discipline>** (de
discipline bovenin de zijbalk). Een leeg veld volgt de laag eronder: bij een discipline de regels van alle
disciplines, daar de standaard (`js/brevet.js`); grijs in het veld is wat dan geldt. Opslaan gaat direct live (een
instelling `brevet` per naamruimte); miles en brevetten worden opnieuw berekend, en de drempels moeten oplopen.
Deelnemers rekenen met de regels van de cockpit waarin ze kijken. Een discipline zonder eigen inhoud in de database
volgt de regels van alle disciplines.

**Demo of echt** (`js/config.js`, `brevet.mode`):
- `'demo'` (nu): jij plus ruim dertig verzonnen collega's (adressen op `@demo.cockpit`), alles alleen in deze browser.
  Op Mijn logboek kun je *kijken als* een collega en de demo opnieuw beginnen. Geen echte persoonsgegevens buiten
  V&V-systemen.
- `'supabase'`: echte accounts. Voer `setup/supabase-audit-brevetten.sql` uit (stap 12, na stap 1). Zet in Supabase
  → Authentication het adres van de cockpit bij *Site URL* en *Redirect URLs*, en zet *Allow new users to sign up*
  aan (wie geen V&V-adres heeft, kan in de database niets: dat bewaakt `audit_brevet_allowed`). Inloggen gaat met een
  link naar je V&V-mailadres (`brevet.login: 'email'`; voor meer dan een handvol mensen een eigen SMTP-server instellen)
  of met Microsoft (`'microsoft'`: Providers → Azure, met een app-registratie van IT voor alleen de V&V-tenant).

### Migratie naar de Microsoft-omgeving (SSO)

De cockpit is zo gebouwd dat je bij de migratie twee dingen verwisselt en de rest blijft:
1. **Wie ben je** staat alleen in `js/account.js` (`current()`, `token()`, `signIn()`). Blijft Supabase de
   database, dan is het `brevet.login: 'microsoft'` met de Azure-koppeling. Komt er een andere database of een
   inlog van het hostingplatform, dan vervang je alleen de Supabase-stukken in `js/account.js` en
   `js/brevet-data.js` (de functies `account`, `saveAccount`, `facts`, `add`, `royalties` en de `admin…`-varianten).
2. **De gegevens**: twee tabellen, `audit_accounts` en `audit_brevet_facts` (exporteer ze als CSV in Supabase →
   Table editor). De sleutel is het zakelijke e-mailadres in kleine letters; dat is in Microsoft hetzelfde, dus bij de
   eerste SSO-login vindt iemand zijn logboek terug. Miles en brevetten staan nergens opgeslagen: die rekent de
   cockpit uit de feiten uit, met dezelfde regels.
Neem de regels in `setup/supabase-audit-brevetten.sql` mee (alleen eigen gegevens lezen, alleen eigen gebruik
toevoegen, tijdstip door de server, alleen V&V-adressen); in een andere database worden dat rechten of een kleine API.

## AI-specialist invliegen (Beheer → Invliegen, stap 13)

Een team met een klantcasus vraagt vanuit de cockpit de AI-specialist van de discipline om mee te denken
(`js/specialist.js`). De knop staat bij iedere usecase ("Wil je dit inzetten bij jouw klant?", met de usecase erbij),
in de ideeënhub (de brede vijfde keuze), op de startpagina (in "Mis je iets?") en in Ctrl+K. Het venster vraagt: wat
wil je bereiken, de casus (zonder klantnaam), fase, soort klant, welke data (de vier soorten van "Mag dit?"; bij
hoog-risico-data een waarschuwing), wanneer (deze week, binnen twee weken, geen haast, plus een datum), hoe (meekijken
in Teams, langskomen, chat) en naam en e-mailadres (verplicht). Na versturen: "<naam> vliegt in", met de reactietijd en
een knop *Chat alvast in Teams*. Lukt versturen niet, dan kun je het verzoek kopiëren en in Teams sturen.

- **Wie de specialist is**, stel je per discipline in bij **Beheer → Disciplines**: naam, e-mailadres voor Teams,
  reactietijd en beschikbaarheid. Zonder naam heet hij "de AI-specialist". Het e-mailadres is zichtbaar voor iedereen
  die de cockpit kan openen (zolang de site openbaar is dus voor iedereen); zet het daarom alleen hier, nooit in de code.
- **Beheer → Invliegen** (per discipline): de verzoeken op urgentie (eerst nieuw, dan ingepland; daarbinnen deze week
  en de vroegste datum), met fase, soort klant, data, vorm en de usecase. Per verzoek: *Mail het team*, *Chat in Teams*,
  de status (ontvangen, ingepland met een datum, afgerond, niet opgepakt), een notitie, en *Maak er een usecase van*
  (een concept-usecase in Beheer → Inhoud met de titel, fase en casus alvast ingevuld: maak hem anoniem). Op de
  startpagina van Beheer staat hoeveel teams je willen invliegen. Deze verzoeken staan niet bij Inzendingen.
- **De aanvrager** ziet de status bij *Jouw inzendingen* in de ideeënhub ("Ingepland op 12 nov."). Een verzoek wordt
  nooit gepubliceerd; de status komt op de referentie die alleen op het eigen apparaat staat.
- Eenmalig: voer `setup/supabase-audit-invliegen.sql` uit (stap 13, na stap 1). Tot dan lukt versturen niet en biedt het
  venster aan het verzoek te kopiëren (en in Teams te sturen, als het adres is ingesteld).

**Later een bericht in Teams bij ieder nieuw verzoek** (geen code nodig): maak in Power Automate een flow met de trigger
*When an HTTP request is received*; zet in Supabase → Database → Webhooks een webhook op *INSERT* in `audit_ideas` naar
het adres van die flow; laat de flow alleen doorgaan bij `kind = 'invliegen'` en de juiste `namespace`, en stuur een
bericht (of een adaptive card met een knop naar `#/beheer/invliegen`) in een Teams-chat of -kanaal. Na de migratie naar
de Microsoft-omgeving kan dezelfde flow rechtstreeks op de nieuwe opslag reageren.

## Tijdwinst, Kickstart en beloftes van het AI-team (stap 14)

Drie onderdelen die samen laten zien wat de cockpit iemand oplevert, en het begin zo makkelijk mogelijk maken.

**Tijdwinst** (`js/tijdwinst.js`). Bij een prompt of usecase zet het AI-team in Beheer → Inhoud een schatting:
*Scheelt ongeveer (minuten)*. Die staat als "Scheelt ±20 min" op de kaart (bij een usecase geldt hij voor alle stappen
samen; de stappen zelf tonen hem niet). Na het kopiëren vraagt de cockpit onderin, zonder de focus te pakken:
*Scheelde dit tijd?* met *Ja, ±20 min* en *Nee*.
- **Alles in één scherm:** Beheer → Inhoud → tabblad **Tijdwinst** (ook bij Gedeelde basis). Alle usecases en losse
  prompts met hun schatting, gegroepeerd en op fase. Per regel staat een voorstel (`js/admin-saves.js`: voor de inhoud van
  Audit per stuk ingeschat, anders een standaard per soort taak, met een *). *Voorstellen invullen in lege velden* zet
  ze erin; jij kijkt ze na en kiest *Opslaan* of *Opslaan en publiceren*. Met werkversies wordt alleen gepubliceerd wat al
  live stond; een concept blijft een concept.
- Per prompt (of usecase) hoogstens één keer per dag, en hoogstens vijf vragen per dag. De vraag verdwijnt na anderhalve
  minuut in beeld (niet terwijl je in Copilot zit).
- *Ja* telt op bij je eigen teller (deze week, maand en jaar) in **Mijn logboek**. Die staat alleen op het eigen
  apparaat (`ai-snackbar-audit:tijdwinst`). Het antwoord gaat ook als anonieme teller naar de database (`time_saved` of
  `time_none`), zonder naam of apparaat.
- De tik levert bewust geen AI-miles op: dan blijft het getal eerlijk.
- **Beheer → Gebruik** toont per prompt of usecase hoe vaak ja en nee, en de tijd terug (aantal keer ja maal de schatting
  van nu). Veel "nee" is een teken dat een prompt beter kan.
- Op de **startpagina** staat onder de onderdelen hoeveel uur collega's deze maand terugwonnen (anders: sinds de start).
  Pas vanaf vijf uur, en altijd met "schatting" erbij.

**Kickstart** (`js/kickstart.js`). Een kaart op de startpagina en in Mijn logboek: *Kickstart voor assistenten. In 14
dagen je eerste uur per week terug.* Wie start, vinkt vier stappen af: de rondleiding, de check "Veilig vliegen", drie
startprompts gebruiken en de usecase van de Kickstart bekijken. Een balk toont de tijdwinst van deze week op weg naar
het eerste uur. Bij *Hoort erbij* staan de startprompts (met hun tijdwinst), de prompt op maat en de AI-miles. Afronden
levert AI-miles op voor wie meedoet met de brevetten (*Kickstart afgerond*, standaard 50, instelbaar bij Beheer →
AI-brevetten → Regels). *Niet voor mij* of *Verbergen* haalt hem van de startpagina; in Mijn logboek blijft hij staan.
De voortgang staat alleen op het eigen apparaat (`ai-snackbar-audit:kickstart`).
- In **Beheer → Inhoud → Teksten → Kickstart**: titel, wat het oplevert, de startprompts (de eerste vijf die je aanvinkt)
  en de usecase. Zonder eigen keuze kiest de cockpit prompts uit de fasen van het seizoen (seizoenskompas), met een
  tijdsindicatie eerst en één per usecase. *Kickstart uitzetten* haalt hem overal weg.

**Beloftes van het AI-team** (`js/promises.js`). Klein onder het formulier waar ze bij horen:
- AI-specialist invliegen: *reactie binnen 1–2 werkdagen* (termijn 2 werkdagen);
- een verzoek in de ideeënhub: *reactie binnen een week* (5 werkdagen);
- *Vraag een prompt aan* (op de promptpagina, bij zoeken zonder resultaat, in Ctrl+K en in de Kickstart): *een prompt op
  maat binnen 1 werkdag* (1 werkdag).

Tekst en termijn pas je aan in **Beheer → Inhoud → Teksten → Beloftes van het AI-team**. Leeg = de standaard; een
streepje (`-`) zet één belofte uit, *Geen beloftes tonen* allemaal. In **Beheer → Inzendingen** en **Invliegen** staat
bij een open verzoek hoeveel tijd er nog is ("Nog 5 uur", oranje in de laatste acht uur, rood als hij verlopen is).
Weekenden tellen niet mee; wat in het weekend binnenkomt, telt vanaf maandag. Een reactie telt als gehouden zodra de
status niet meer *Ontvangen* is of er een antwoord staat; een prompt op maat pas als hij gerealiseerd (of afgehandeld) is.
Beloof alleen wat het AI-team waar kan maken.

Eenmalig: voer `setup/supabase-audit-tijdwinst.sql` uit (stap 14, na stap 1). Dat zet de twee soorten tellers erbij,
de functie `audit_time_saved` (alleen aantallen, voor de regel op de startpagina) en, als de AI-brevetten er al zijn,
*Kickstart afgerond* als feit dat een deelnemer zelf mag vastleggen. Tot dan werken de eigen teller en de Kickstart
gewoon; alleen het totaal van collega's en de tijdwinst in Beheer → Gebruik blijven leeg.

## Engels (voor het team in Zuid-Afrika)

Iedereen kiest zijn taal in **Mijn gegevens → Taal / Language** of via **Ctrl+K** (*Switch to English*). De keuze staat
alleen op dat apparaat (`ai-snackbar-audit:taal`). Staat de browser op een andere taal dan Nederlands en is er nog niets
gekozen, dan vraagt de cockpit het één keer. Datums en getallen volgen dan het Britse Engels (`en-GB`).

**Fase 1 (klaar): de schermen.** `js/i18n.js` vertaalt in het Engels alle knoppen, koppen, uitleg en meldingen terwijl ze
verschijnen, ook `aria-label`, `title`, `placeholder` en `alt`. De vertalingen staan in `js/i18n-en.js`: een lijst met
de Nederlandse tekst als sleutel, plus patronen voor teksten met een getal of naam (`Nog 5 uur` → `Due in 5 hours`). Wat
er niet in staat, blijft Nederlands; er gaat dus nooit iets stuk. De promptbouwer heeft eigen Engelse bouwstenen
(`js/view-builder.js`), omdat die tekst in je prompt zetten. Niet vertaald: Beheer (blijft Nederlands), wat je zelf typt,
stukken met `translate="no"` en de inhoud.

Een vertaling toevoegen of verbeteren: zet de cockpit op English, open de pagina's en typ in de console
`AIAudit.i18n.missing()`. Dat geeft de Nederlandse schermteksten die je zag zonder vertaling (de inhoud zit er niet
tussen). Zet ze in `js/i18n-en.js` (sleutel zonder spaties eromheen; de tests controleren dat) en draai `tools/versie.ps1`.
Let op: de teksten over het AI-beleid (*Mag dit?*, de checkride, Werk-modus) zijn een eerste vertaling en moeten nog
langs Compliance voordat het Zuid-Afrikaanse team ermee werkt.

**Fase 2 (volgt): de inhoud.** Prompts, usecases, tips, trainingen en agents krijgen per item een Engelse versie in
Beheer. Zonder Engelse versie toont de cockpit het Nederlandse item met het label *Dutch only*.

## Nieuwsbrief (Beheer → Nieuwsbrief)

Een weekupdate of maandnieuwsbrief, vanzelf samengesteld uit wat er in die periode nieuw was in de cockpit van de
discipline waarin je zit (plus de gedeelde basis):

- tips van de week die vrijkwamen en nieuwe tips, nieuwe usecases en prompts, trainingen, agents & tools;
- beantwoorde en gepubliceerde vragen uit de ideeënhub (nooit naam of e-mailadres);
- populair: meest bekeken usecases en meest gekopieerde prompts (de anonieme tellers);
- best beoordeeld, met eventueel een gepubliceerde toelichting als citaat (reviews);
- binnenkort: de volgende tip van de week, alleen het thema en de datum (het slot blijft dicht);
- ook bijgewerkt: staat standaard uit, want ook kleine correcties tellen mee.

**Week** is maandag tot en met zondag (verstuur je hem op vrijdag, dan staat de tip van de week erin), **maand** is de
kalendermaand. Op de laatste dag van de maand staat bovenaan Beheer een melding dat de maandnieuwsbrief compleet is.
Met de pijltjes kies je een eerdere periode. Per onderdeel en per item vink je aan wat erin komt, en je past
onderwerp, inleiding, afsluiting en ondertekening aan. Dat onthoudt de browser per periode.

- **PDF opslaan:** opent het afdrukvenster met alleen de nieuwsbrief op A4; kies *Opslaan als PDF* (Edge of Chrome).
- **E-mail (Outlook):** downloadt een `.eml`-bestand. Dubbelklik erop: Outlook opent een nieuw bericht met onderwerp en
  opmaak; vul de ontvangers in en verstuur.
- **Kopieer voor e-mail of Teams:** zet de nieuwsbrief met opmaak op het klembord, om te plakken in een bericht.

Er wordt niets automatisch verstuurd en niets in de database opgeslagen. Alle links gaan naar `siteUrl` uit
`js/config.js` (de live cockpit), ook als je de nieuwsbrief lokaal maakt.

## Copilot-gebruik (Beheer → Copilot-gebruik, stap 9)

Hoe het gebruik van Copilot zich ontwikkelt, van periode tot periode. Alleen voor hoofdbeheerders.

1. Eenmalig: voer `setup/supabase-audit-copilot.sql` uit (stap 9, na stap 1; stap 7 en 8 zijn er niet voor nodig).
   Zonder deze stap kun je een bestand al wel inlezen en bekijken, maar niet opslaan.
2. Iedere periode (bijvoorbeeld maandelijks): **Export inlezen** en kies het Excel-bestand met het Copilot-gebruik. Je
   ziet eerst wat er is gelezen en hoe het eruitziet; **Opslaan** bewaart de totalen. Een import met dezelfde
   einddatum vervangt de vorige.
3. De pagina vergelijkt de laatste periode met de vorige import: tegels met het verschil, een tabel per licentie (Basic
   en Premium), de weken van alle imports in twee grafieken (de cijfers ook als tabel), de kanalen van Basic, hoe vaak
   mensen actief zijn en 'Wat valt op'. Onder **Alle imports** staan de kerncijfers per periode; daar verwijder je ook
   een import.

Welk bestand: nu het analysebestand (`Copilot gebruik analyse.xlsx`). De pagina zoekt de tabellen op de namen van de
kolommen, niet op de plek: per persoon `Huidige licentie`, `Totaal volume`, `Volume laatste 4 weken` en `Actieve
weken`; per week `Week`, `Actieve gebruikers Basic`, `Actieve gebruikers Premium`, `Basic-prompts` en
`Premium-acties`; per kanaal (mag ontbreken) `Basic-kanaal` en `Prompts laatste 4 weken`. Een kolom of tabblad erbij
maakt niet uit, een andere kolomnaam wel. Voor een ander soort export (bijvoorbeeld rechtstreeks uit Copilot) komt er
een lezer bij in `FORMATS` in `js/admin-copilot.js`; de rest blijft gelijk.

**Meerdere disciplines in één bestand** (bijvoorbeeld tabbladen `Audit`, `Accountants` en `Belastingadviseurs`): staan
alle tabellen van een discipline op één tabblad, dan leest de pagina ieder tabblad apart en hoort het tabblad bij de
discipline met die naam. De eerste letters tellen, dus `Accountants` → Accountancy en `Belastingadviseurs` →
Belastingadvies; `Fiscaal` → Belastingadvies mag ook. Je ziet vooraf de cijfers van de discipline waarin je zit en een
lijst van alle tabbladen; **Opslaan voor alle … disciplines** slaat ze in één keer op, ieder bij de eigen discipline. Een
tabblad zonder herkenbare naam wordt niet opgeslagen (geef het de naam van de discipline), en twee tabbladen voor
dezelfde discipline geven een foutmelding. Mislukt het opslaan halverwege, dan zie je wat al wel is opgeslagen en
probeer je de rest opnieuw.

**Momenten** (onder de grafieken): belangrijke data zoals een Boost & Learn of de dag dat iedereen een licentie kreeg.
Vul de datum in en wat er gebeurde; vink *Voor alle disciplines* aan als het overal geldt. Een moment staat als
genummerde stippellijn in de grafieken (met uitleg eronder, in het uitleesvak en als kolom in de tabel), ook in de
grafiek van het cockpitgebruik bij Overzicht. Bij **Wat valt op** zie je per moment het gemiddelde per week in de 4
volle weken ervoor en de (eerste 4) weken erna: actieve gebruikers per licentie en het volume; de week waarin het moment
valt telt niet mee. Pas met 2 weken erna in de gegevens komt er een vergelijking. Het laat zien wát er veranderde, niet
waardoor. Opslag: in dezelfde tabel als de imports (dus geen nieuwe SQL), als één rij per discipline met de datum
1900-01-01; de gedeelde basis (`ai-algemeen`) is voor alle disciplines.

Privacy: het bestand wordt in de browser gelezen en nergens heen gestuurd. Alleen totalen per periode gaan naar de
database (`audit_copilot_usage`): aantallen personen en actieve gebruikers per licentie, volume per week en per kanaal,
hoe vaak mensen actief zijn en het aandeel van de tien meest actieve personen samen. Geen PersonId's, geen cijfers per
persoon en geen bestandsnaam. Is een groep heel klein (een licentie met een of twee personen), dan liggen de totalen
dicht bij cijfers per persoon; houd daar rekening mee. Een echte export hoort nooit in deze (openbare) repository.

## Doelkoers (Beheer → Doelkoers)

Per discipline stel je doelen voor de Copilot-adoptie en het gebruik van de cockpit, en zie je of je op koers ligt.

- **Een doel:** een kengetal, een doelwaarde, een einddatum en (optioneel) vanaf wanneer de koers loopt; leeg = vanaf
  de eerste meting. De beginwaarde wordt bij het opslaan vastgelegd. Een toelichting kan erbij. Drie voorbeelden om mee
  te beginnen.
- **Kengetallen** (`METRICS` in `js/admin-goals.js`): uit Copilot-gebruik *Adoptie* (actief in de laatste 4 weken, per
  import), *Wekelijks actief* (deel van de collega's per week, lopend gemiddelde over 4 weken), *Licenties benut*
  (Premium, actief in 4 weken) en *Gebruik per actieve collega* (keer per week); uit de cockpit *Prompts gekopieerd* en
  *Cockpit bekeken* (keer per week, lopend gemiddelde, alleen volle weken).
- **De koers** is een rechte lijn van de beginwaarde naar het doel. De laatste meting tegenover de koers geeft de stand:
  *Doel gehaald*, *Op koers*, *Iets achter* (binnen 10% van de weg), *Achter op koers*, *Niet gehaald* (einddatum
  voorbij) of *Nog geen gegevens*. Het tempo is een rechte lijn door de laatste metingen (hooguit 8): "Bij dit tempo
  haal je het doel rond …".
- **Per doel:** het label met de stand, de laatste meting, een koersband (van begin naar doel, met een streepje waar de
  koers nu ligt), één zin en een grafiek met de metingen, de koers, het doel, vandaag en het tempo (aanwijzen of de
  pijltjes voor de cijfers, en als tabel).
- **Ook in Overzicht** (alle doelen van alle disciplines, met de stand) **en op Start** ("2 van 3 doelen op koers").
- **Opslag:** één rij per discipline in `audit_copilot_usage`, net als de momenten (stap 9, geen nieuwe SQL); alleen
  voor hoofdbeheerders.

## Overzicht (Beheer → Overzicht)

De stand van zaken over alle disciplines op één scherm, voor hoofdbeheerders (in de zijbalk onder *Cijfers*):
kerncijfers (Copilot-adoptie, usecases met demo, prompts, hoe vaak er in 30 dagen iets is bekeken en gekopieerd, met
het verschil met de 30 dagen ervoor, en de ideeën), het gebruik van de cockpit per week, een tabel per discipline, het
Copilot-gebruik per discipline (laatste import), de ideeënhub en het portfolio, en de laatste trainingen. Met
**Afdrukken als PDF** maak je er een document van, bijvoorbeeld voor het bestuur. Alles komt uit wat er al is: wat live
staat, de anonieme tellers, de ideeënhub en de totalen van de Copilot-export; er is geen aparte SQL voor nodig.

## Route van een idee (Ideeënhub)

In de ideeënhub staat onder het formulier **Wat gebeurt er met je idee?**: de stappen van een idee op de werkvloer tot
een toepassing in gebruik, met per stap wie het doet en waar een idee de route kan verlaten (de afslagen: het kan al
met Copilot, te weinig waarde, nog niet goed genoeg). Ernaast staat **Wie doet wat**, de rollen van iedereen tot de
CTO. Met **Afdrukken als PDF** maak je er een document van, bijvoorbeeld voor het Serviceplein.

- **Per discipline:** de standaard staat in `ideaRoutes` in `data/disciplines.js`. Audit heeft een eigen route (team
  AI en team dAtA beoordelen mee en bouwen zelf in goedgekeurde tooling); een andere discipline krijgt `standaard`
  (na het besluit direct naar DIU).
- **Aanpassen** in Beheer → Inhoud → Teksten (alleen die discipline) of in de gedeelde basis (voor iedereen): de
  inleiding, de stappen, de rollen en een link naar het organogram op het Serviceplein. Met *Standaard overnemen om
  aan te passen* staan de standaardstappen klaar in het formulier. Eigen stappen vervangen alle standaardstappen.
- **Openbaar:** de site is openbaar bereikbaar. Noem rollen en teams, geen namen; de namen staan in het organogram op
  het Serviceplein, de cockpit linkt ernaartoe.

## Portfolio en ideeën beoordelen (Beheer → Portfolio, stap 10)

Ideeën en verzoeken uit de ideeënhub beoordeel je met de **AI Value Matrix**, bij Inzendingen (*Beoordelen met de AI
Value Matrix*) of in Portfolio:

1. **Knock-outs** (K1 tot en met K5): één treffer en het idee stopt, met de vervolgstap erbij.
2. **Scores** van 0 tot 5: A kwaliteitseffect, B capaciteitseffect (vul uren per keer × keren per jaar in, dan zet de
   pagina de score), C technische haalbaarheid en D time-to-value, ieder met een regel onderbouwing.
3. **Kwadrant**: waarde (A + B) en haalbaarheid (C + D), grens bij 6: Direct uitvoeren, Strategisch ontwikkelen, Quick
   win of Stoppen. Twee punten of minder onder de grens is een grensgeval: opnieuw scoren bij het ontwerp.
4. **Risicoklasse** (laag, midden, hoog): bepaalt de route erna, niet het kwadrant. Daarna de technische route, het
   besluit en de open vragen.

Portfolio toont alle beoordelingen van de discipline in de matrix (genummerde punten, met de cijfers bij aanwijzen of
Tab) en als lijst, met de knock-outs en wat nog te beoordelen is. **Registerregels (CSV)** geeft per idee de regel
voor het AI-register. Eenmalig: voer `setup/supabase-audit-portfolio.sql` uit (stap 10, na stap 1): die zet één kolom
`assessment` bij de inzendingen. Alleen hoofdbeheerders lezen hem; bezoekers van de hub zien hem nooit.

## Supabase instellen (eenmalig, voor beheer en ideeënhub)

Beheer, de ideeënhub en de tellers gebruiken hetzelfde Supabase-project als de snackbar, met eigen tabellen. Tot die
er zijn, toont de site de inhoud uit de bestanden en meldt de hub "wordt nog aangesloten".

1. Open `setup/supabase-audit.sql` en zet bij stap 1 het e-mailadres van de eerste hoofdbeheerder, hetzelfde adres
   als diens Supabase-gebruiker (Authentication → Users; de gebruiker van de snackbar kan ook). Meer beheerders voeg
   je later toe in Beheer → Beheerders.
2. Supabase → SQL Editor → New query → plak het hele bestand → Run. Doe daarna hetzelfde met
   `setup/supabase-audit-bewerken.sql` (stap 7) en `setup/supabase-audit-beveiligen.sql` (stap 8), in die volgorde.
   Stap 1 en 8 opnieuw uitvoeren kan geen kwaad; stap 7 weigert na stap 8 (zie hierboven). Voor Beheer →
   Copilot-gebruik ook `setup/supabase-audit-copilot.sql` (stap 9), voor Beheer → Portfolio
   `setup/supabase-audit-portfolio.sql` (stap 10) en voor de verbetervoorstellen bij prompts
   `setup/supabase-audit-verbeteringen.sql` (stap 11); alle drie mogen op ieder moment na stap 1 en opnieuw. Voor
   de AI-brevetten met echte accounts `setup/supabase-audit-brevetten.sql` (stap 12; zie 'AI-brevetten'), en voor
   de AI-specialist invliegen `setup/supabase-audit-invliegen.sql` (stap 13), en voor de tijdwinst
   `setup/supabase-audit-tijdwinst.sql` (stap 14).
3. Controleer in Authentication: *Allow new users to sign up* uit, *Allow anonymous sign-ins* uit, en bij de
   e-mailprovider *Confirm email* en *Secure email change* aan (rechten hangen aan het e-mailadres van een account).
4. Ga naar `#/beheer`, log in en zet de inhoud over (zie 'Inhoud beheren').

Een ander Supabase-project? Zet het adres in `centralUrl` in `js/config.js` én in de Content-Security-Policy bovenin
`index.html`; die staat alleen verbinding met dit ene project toe.

Rechten in het kort: iedereen kan gepubliceerde inhoud lezen en alleen tóévoegen in de hub (inzending, stem, anonieme
teller). Inhoud wijzigen gaat via de rollen van stap 7 (opslaan en publiceren, door de database gecontroleerd);
overzicht, inzendingen, portfolio, reviews, gebruik, Copilot-gebruik, disciplines en beheerders zijn voor hoofdbeheerders
(`audit_admins`). Iedereen ziet in
de hub alleen wat een beheerder publiceert, en nooit naam of e-mailadres. Een inzender kan aangeven dat de inzending
privé moet blijven; die kun je dan niet publiceren. Optioneel: zet in `js/config.js` een `ideaFallbackEmail`, dan kan
een collega bij een storing de inzending ook per mail sturen.

Bewust zo gelaten: de inhoud van een discipline die op slot staat, is technisch op te vragen met de openbare sleutel
(op slot betekent: nog niet in de wisselaar), en een geüpload bestand is direct openbaar (ook bij een voorstel).

## Privacy en veiligheid

- Geen klantgegevens op het platform: alle demo's zijn fictief, en wat je in 'Invullen' typt wordt nergens bewaard.
- In de browser bewaren we alleen wat je bewaard en recent bekeken hebt, het thema, een willekeurige stem-code, de titels
  van je eigen inzendingen, welke usecases en prompts je hebt beoordeeld, de gekozen discipline, de scrollpositie per
  pagina (alleen in dit tabblad), de afgevinkte acties uit een naslagwerk, de laatst bekende inhoud (zodat de site
  snel opent), Mijn gegevens (als je die invult), welke items je al kent (de radar), je tijdwinst (de keren dat je
  "Ja, het scheelde tijd" tikte) en je voortgang in de Kickstart. Beheerders: ook niet-opgeslagen wijzigingen (`bewerken:<e-mailadres>`), ook na uitloggen, tot je ze
  opslaat; ouder dan 30 dagen wordt niet meer teruggehaald.
- De site en de repository zijn openbaar bereikbaar. Alles op het platform is informatie voor gebruikers; zet er nooit
  configuratie, systeemprompts, goedkeuringsdocumenten, interne opnames of klantinformatie op.
- De tellers in Beheer zijn anoniem (welke usecase, demo, prompt, tip, training of agent), zonder apparaat- of
  persoonsgegevens. Heb je het SQL-bestand al eens uitgevoerd vóór de trainingen of agents er waren? Voer het dan nog
  een keer uit, zodat ook die inhoud en tellers worden geaccepteerd (bestaande gegevens blijven staan).
- **Slot met pincode** (`js/lock.js`): wie de cockpit opent, vult eerst de pincode in (dezelfde als bij de snackbar).
  Daarna blijft hij op dat apparaat open (`ai-snackbar-audit:slot`), tot de pincode verandert. Een ingelogde beheerder en
  een lokale kopie zien geen slot; lokaal toon je het met `?slot` vóór de #. In `js/config.js` staat alleen een
  vingerafdruk (`lockPinHash`); een nieuwe pincode: typ in de console `await AIAudit.lock.hash('nieuwe pincode')` en zet
  de uitkomst daar. Leeg = geen slot. Het is een drempel tegen doorsturen, geen beveiliging: de losse bestanden (ook de
  video bij de training) blijven op te vragen voor wie het adres kent, en de repository is openbaar.
- De ideeënhub waarschuwt als een tekst op een BSN of IBAN lijkt.
- Demo's draaien in een afgeschermd iframe (sandbox); de pagina staat alleen verbinding met ons eigen Supabase-project
  toe (CSP).
- De namen in de browseropslag (`ai-snackbar-audit:…`, ook de inlogsessie `ai-snackbar-audit:sessie`) zijn bij de
  verhuizing bewust gelijk gebleven. Het adres valt onder hetzelfde domein (`joostprinsvv.github.io`), dus favorieten,
  thema, stemmen en een lopende inlog gaan gewoon mee. Verander deze namen niet, anders raakt iedereen dat kwijt.

## Toegankelijkheid

Het doel is WCAG 2.2 niveau AA. Wat daarvoor in de code zit (en wat je bij nieuwe onderdelen meeneemt):

- **Toetsenbord:** alles is met Tab te bereiken, met een zichtbare focusring (crimson, op donkere vlakken turquoise).
  'Direct naar de inhoud' staat als eerste. Na een andere pagina staat de focus op de kop; wordt de pagina opnieuw
  opgebouwd (nieuwe inhoud, een wijziging in de bewerkmodus), dan blijft hij op hetzelfde element. Knoppen die je net
  gebruikte (Opslaan in de bewerkbalk, 'Ik ook', de pijltjes in Beheer) houden de focus, ook als ze daarna even niets
  kunnen doen (`aria-disabled` in plaats van `disabled`).
- **Kaarten:** de titel is de link en reikt over de hele kaart; de bewaarknop ligt erboven. Een schermlezer hoort zo
  alleen de titel als link. De kompasroos op de startpagina is alleen voor de muis: dezelfde zes onderdelen staan als
  tegels eronder.
- **Schermlezers:** de stand van de bewerkbalk, het aantal resultaten bij filteren en zoeken, en meldingen worden
  voorgelezen (`role="status"`, de meldingenlaag); de lijsten zelf niet bij iedere toetsaanslag. Schakelknoppen
  (filters, 'Bewaard', het thema) hebben een vaste naam met `aria-pressed`.
- **Kleur en contrast:** tekst haalt minimaal 4,5:1, randen van invoervelden 3:1, in beide thema's (de waarden staan
  bij de tokens in `css/variables.css`). Gekozen sterren zijn gevuld, de andere omlijnd: niet alleen kleur.
- **Grafieken** (Beheer → Copilot-gebruik): een legenda en de laatste waarde met naam aan iedere lijn, dus niet alleen
  kleur; de kleuren van de reeksen zijn getoetst op kleurenblindheid en 3:1 contrast in beide thema's. Met Tab kom je
  op de grafiek, met de pijltjes ga je per week (het uitleesvak wordt voorgelezen), en alle cijfers staan ook in een
  tabel ('Als tabel').
- **Hoog contrast** (Windows-contrastthema's), **minder beweging** (alle animaties uit) en **afdrukken** (alleen de
  inhoud, prompts helemaal, in het lichte thema) staan onderaan `css/audit.css` en `css/motion.css`.

## Tests

`tests/index.html` test de kern zonder build of npm: plaatshouders, zoeken, de controles op adressen en paden, inhoud
laden, rechten, het soortenregister, de verzoeken naar Supabase (met een nagebootste verbinding), de werkversies, het
gereedschap van Beheer, de voorbeeldinhoud van Accountancy, de AI-brevetten, de tijdwinst, de Kickstart, de termijnen
van de beloftes en het inlezen van het Copilot-gebruik. Dat laatste met een verzonnen Excel-bestand dat de test
zelf maakt (`tests/fixture-copilot.js`, zelfde opbouw als het echte bestand), nooit met een echte export. Open hem via een lokale webserver (`/tests/`) of op de live site
(`…/ai-cockpit-audit/tests/`). De uitkomst staat bovenaan en in de titel van het tabblad (✓ of ✗); er wordt niets
opgeslagen of verstuurd. Een nieuwe test zet je in `tests/tests.js` (`await test('…', () => equal(…))`).

## Snel laden

- Een bezoeker laadt alleen wat de site nodig heeft. De beheercode (`js/rights.js`, `js/editor.js`, `js/admin-*.js`,
  `js/view-admin.js`, `js/editmode.js`, `css/admin.css`) laadt pas bij inloggen of op `#/beheer`; de inhoud in
  `data/*.js` alleen als de database die niet levert. Een nieuw beheerbestand? Zet het in `ADMIN_SCRIPTS` in `js/app.js`.
- De lettertypes worden vooraf geladen en de verbinding met Supabase wordt alvast opgezet (`index.html`).
- **Nieuwe versie van de code:** draai daarna `powershell -ExecutionPolicy Bypass -File tools/versie.ps1` en commit
  `index.html` mee. Dat zet een nieuw `?v=…` achter alle eigen bestanden, zodat iedere browser alles opnieuw ophaalt
  (GitHub Pages laat browsers bestanden 10 minuten bewaren; zonder nieuwe versie kan een oud bestand naast een nieuw
  belanden). Alleen inhoud aanpassen in Beheer hoeft dit niet.

## Lokaal testen

Open de root van deze repository via een lokale webserver (de demo's en de klembordknop werken niet betrouwbaar vanaf
`file://`) en ga naar `/`. Gebruik Edge of Chrome. Draai na een wijziging ook de tests (`/tests/`). Een eigen
`.claude/` (bijv. `launch.json`) wordt niet gecommit (zie `.gitignore`).
