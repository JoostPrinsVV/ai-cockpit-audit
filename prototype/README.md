# Prototype: één AI Cockpit voor alle disciplines

Een klikbaar prototype om te laten zien hoe de AI Cockpit organisatiebreed kan werken: per discipline
een eigen cockpit, op één gedeelde basis. Bedoeld voor het gesprek met IT en de disciplines; de live
AI Cockpit Audit (`index.html`) verandert er niet door.

- Lokaal: `prototype.html` (zie "Lokaal testen" in de README van de repository)
- Online (na pushen): `https://joostprinsvv.github.io/ai-cockpit-audit/prototype.html`
  (niet gelinkt vanaf de live cockpit, en zoekmachines slaan hem over)

## Wat je ziet

- **Disciplinewisselaar**: klik in de kopbalk op de discipline achter "AI Cockpit". Je komt op dezelfde
  pagina in de andere cockpit. Een detailpagina blijft open als het item gedeeld is; anders kom je in
  het overzicht. De keuze wordt onthouden in de browser. Met `?d=audit` of `?d=accountancy` in het
  adres open je direct een cockpit.
- **Gedeelde basis**: kaarten met het label "Voor iedereen" staan in iedere cockpit. Op de detailpagina
  staat een regel uitleg. Een discipline kan bij een gedeeld item een eigen voorbeeld zetten (in
  Accountancy: de voorbeeldinstructie bij "Stel je eigen instructies in").
- **Startpagina**: het blok "Eén basis voor heel Visser & Visser" met de aantallen gedeeld en eigen.
- **Zo werkt het** (`#/zo-werkt-het`): de opbouw, wat je kunt proberen, wie wat beheert en de vragen
  voor IT.

## Bestanden

```
prototype.html                 De pagina: kopbalk met wisselaar, prototypebalk, eigen CSP (geen verbindingen naar buiten)
prototype/js/config.js         Basisinstellingen: geen database, eigen lokale opslag
prototype/js/disciplines.js    De disciplines, de gedeelde basis (SHARED) en het samenstellen van de inhoud
prototype/data/accountancy.js  Voorbeeldinhoud Accountancy (usecases gebaseerd op de snacks van de AI Snackbar)
prototype/js/cockpit.js        Wisselaar, label "Voor iedereen", uitleg op detailpagina's, woordkeus per discipline
prototype/js/view-home.js      Kopie van js/view-home.js, met het blok gedeeld/eigen
prototype/js/view-prototype.js De pagina "Zo werkt het"
prototype/js/app.js            Kopie van js/app.js: extra pagina, geen beheer
prototype/css/prototype.css    Opmaak van wat het prototype toevoegt
```

De overige onderdelen (de andere pagina's, demo's, opmaak) komen uit de live cockpit. De auditinhoud
komt uit `data/`; daaruit wijst `SHARED` in `disciplines.js` aan wat voor iedereen is.

## Aanpassen

- **Andere disciplines of namen**: `DISCIPLINES` in `prototype/js/disciplines.js`. Status `live` of
  `voorbeeld` is te openen, `gepland` staat grijs in de wisselaar.
- **Wat gedeeld is**: `SHARED` in hetzelfde bestand (id's uit `data/`).
- **Inhoud van een discipline**: een bestand zoals `prototype/data/accountancy.js`, plus een
  `<script>` in `prototype.html`.

## Bewust (nog) niet in het prototype

- Geen database, geen beheer en de ideeënhub verstuurt niets. In een echte versie krijgt iedere
  discipline een eigen naamruimte in de database en eigen beheerders.
- Vaste zinnen over de audit in de pagina's van de live cockpit worden in het prototype per discipline
  vervangen (`wording` in `disciplines.js`). In een echte versie staan die teksten in de instellingen.
- Weggooien kan zonder gevolgen: verwijder `prototype.html` en de map `prototype/`.
