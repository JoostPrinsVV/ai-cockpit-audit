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
css/motion.css        Beweging in CSS: overgangen, uitklappers, panelen, scrolleffecten (uit bij 'minder beweging')
js/*.js               De applicatie (iedere pagina een view-*.js, Beheer in admin-*.js)
data/disciplines.js   De disciplines en de gedeelde basis (startstand; daarna Beheer → Disciplines)
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
assets/trainingen/    Slides van trainingen, per training een map (assets/trainingen/<id>/slide-01.jpg …)
setup/                De SQL-bestanden voor Supabase: stap 1, 7 en 8 (in die volgorde), en stap 9 (Copilot-gebruik)
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
| `#/beheer` | Voor het AI-team: inhoud per discipline en de gedeelde basis beheren, disciplines openzetten of op slot houden, inzendingen en reviews beoordelen, de nieuwsbrief maken, gebruik bekijken, het Copilot-gebruik per periode volgen |

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
- **Wisselen in Beheer:** bovenaan Beheer kies je de discipline. *Inhoud*, *Inzendingen*, *Gebruik* en
  *Copilot-gebruik* gaan over de discipline waarin je zit.
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
Opslaan, Publiceren, **Logboek** (wie wat wanneer deed, met per item de eerdere versies om terug te zetten) en
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

Privacy: het bestand wordt in de browser gelezen en nergens heen gestuurd. Alleen totalen per periode gaan naar de
database (`audit_copilot_usage`): aantallen personen en actieve gebruikers per licentie, volume per week en per kanaal,
hoe vaak mensen actief zijn en het aandeel van de tien meest actieve personen samen. Geen PersonId's, geen cijfers per
persoon en geen bestandsnaam. Is een groep heel klein (een licentie met een of twee personen), dan liggen de totalen
dicht bij cijfers per persoon; houd daar rekening mee. Een echte export hoort nooit in deze (openbare) repository.

## Supabase instellen (eenmalig, voor beheer en ideeënhub)

Beheer, de ideeënhub en de tellers gebruiken hetzelfde Supabase-project als de snackbar, met eigen tabellen. Tot die
er zijn, toont de site de inhoud uit de bestanden en meldt de hub "wordt nog aangesloten".

1. Open `setup/supabase-audit.sql` en zet bij stap 1 het e-mailadres van de eerste hoofdbeheerder, hetzelfde adres
   als diens Supabase-gebruiker (Authentication → Users; de gebruiker van de snackbar kan ook). Meer beheerders voeg
   je later toe in Beheer → Beheerders.
2. Supabase → SQL Editor → New query → plak het hele bestand → Run. Doe daarna hetzelfde met
   `setup/supabase-audit-bewerken.sql` (stap 7) en `setup/supabase-audit-beveiligen.sql` (stap 8), in die volgorde.
   Stap 1 en 8 opnieuw uitvoeren kan geen kwaad; stap 7 weigert na stap 8 (zie hierboven). Voor Beheer →
   Copilot-gebruik ook `setup/supabase-audit-copilot.sql` (stap 9, mag op ieder moment na stap 1).
3. Controleer in Authentication: *Allow new users to sign up* uit, *Allow anonymous sign-ins* uit, en bij de
   e-mailprovider *Confirm email* en *Secure email change* aan (rechten hangen aan het e-mailadres van een account).
4. Ga naar `#/beheer`, log in en zet de inhoud over (zie 'Inhoud beheren').

Een ander Supabase-project? Zet het adres in `centralUrl` in `js/config.js` én in de Content-Security-Policy bovenin
`index.html`; die staat alleen verbinding met dit ene project toe.

Rechten in het kort: iedereen kan gepubliceerde inhoud lezen en alleen tóévoegen in de hub (inzending, stem, anonieme
teller). Inhoud wijzigen gaat via de rollen van stap 7 (opslaan en publiceren, door de database gecontroleerd);
inzendingen, reviews, gebruik, Copilot-gebruik, disciplines en beheerders zijn voor hoofdbeheerders (`audit_admins`). Iedereen ziet in
de hub alleen wat een beheerder publiceert, en nooit naam of e-mailadres. Een inzender kan aangeven dat de inzending
privé moet blijven; die kun je dan niet publiceren. Optioneel: zet in `js/config.js` een `ideaFallbackEmail`, dan kan
een collega bij een storing de inzending ook per mail sturen.

Bewust zo gelaten: de inhoud van een discipline die op slot staat, is technisch op te vragen met de openbare sleutel
(op slot betekent: nog niet in de wisselaar), en een geüpload bestand is direct openbaar (ook bij een voorstel).

## Privacy en veiligheid

- Geen klantgegevens op het platform: alle demo's zijn fictief, en wat je in 'Invullen' typt wordt nergens bewaard.
- In de browser bewaren we alleen wat je bewaard en recent bekeken hebt, het thema, een willekeurige stem-code, de titels
  van je eigen inzendingen, welke usecases en prompts je hebt beoordeeld, de gekozen discipline, de scrollpositie per
  pagina (alleen in dit tabblad), de afgevinkte acties uit een naslagwerk en de laatst bekende inhoud (zodat de site
  snel opent). Beheerders: ook niet-opgeslagen wijzigingen (`bewerken:<e-mailadres>`), ook na uitloggen, tot je ze
  opslaat; ouder dan 30 dagen wordt niet meer teruggehaald.
- De site en de repository zijn openbaar bereikbaar. Alles op het platform is informatie voor gebruikers; zet er nooit
  configuratie, systeemprompts, goedkeuringsdocumenten, interne opnames of klantinformatie op.
- De tellers in Beheer zijn anoniem (welke usecase, demo, prompt, tip, training of agent), zonder apparaat- of
  persoonsgegevens. Heb je het SQL-bestand al eens uitgevoerd vóór de trainingen of agents er waren? Voer het dan nog
  een keer uit, zodat ook die inhoud en tellers worden geaccepteerd (bestaande gegevens blijven staan).
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
gereedschap van Beheer en het inlezen van het Copilot-gebruik. Dat laatste met een verzonnen Excel-bestand dat de test
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
