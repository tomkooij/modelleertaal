BogusXML: het bestandsformaat van een model
==========================================

> **Dit document is de specificatie. Houd het bij.**
>
> Verander je iets aan hoe modellen gelezen of geschreven worden, dan pas je in dezelfde commit dit
> document aan. Dat geldt voor Tom en voor Claude (en voor iedereen die een pull request maakt). Denk aan:
>
> - een nieuwe sectie (zoals `<grafisch>`) of een nieuwe instelling buiten de secties (zoals `N = ...`);
> - een andere manier van lezen of schrijven in [`model.js`](model.js) (`parseBogusXMLString`, `createBogusXMLString`);
> - een nieuwe regel in de sectie `<grafisch>` (lezen: `parseHints` in [`grafisch.js`](grafisch.js));
> - een veld dat wel in het bestand staat maar niet in de deellink of het automatisch bewaren, of andersom
>   (zie [Andere plaatsen waar een model staat](#andere-plaatsen-waar-een-model-staat)).
>
> Beschrijf het gedrag zoals de code het doet, ook als dat vreemd is (zie [Eigenaardigheden](#eigenaardigheden)),
> zet een regel in de [wijzigingsgeschiedenis](#wijzigingsgeschiedenis) onderaan, en voeg een test toe in
> [`test/model_tests.js`](test/model_tests.js).

## Waarom "bogus"?

Een model wordt opgeslagen als een tekstbestand met de extensie `.xml` dat er uitziet als XML, maar het niet
is. In de *modelregels* staan `<` en `>` (`als h < 0 dan`), en die worden **niet** geschreven als `&lt;` en
`&gt;`. Een XML-parser kan het bestand dus niet lezen. Dat is een bewuste keuze: een docent of leerling moet een
model met Kladblok kunnen openen, lezen en aanpassen, precies zoals het in de webapp staat.

Het formaat is daarom geen XML, maar een eenvoudig **regelgebaseerd** formaat: de tags zijn alleen
scheidingsregels tussen stukken tekst.

## Voorbeeld

```
<modelleertaal>
N = 500
<startwaarden>
m = 91 'kg
g = 9,81 'm/s2
k = 0,37
v = 0
t = 0
dt = 0,1 's
</startwaarden>
<modelregels>
'parachutesprong: vul de formule voor Fres in
Fz = m * g
Fw = k * v^2
Fres = ...
a = Fres/m
v = v + a*dt
t = t + dt
als t > 13 dan k = 30 eindals
</modelregels>
<grafisch>
' de pijlen van de regel met ... (zoals de figuur in het examen)
Fres: Fz, Fw
</grafisch>
</modelleertaal>
```

## Het bestand

- **Codering:** UTF-8. Een BOM (`U+FEFF`) aan het begin wordt genegeerd.
- **Regeleinden:** `\n` of `\r\n`; beide worden gelezen. **Bewaar** in de webapp schrijft `\r\n`
  (zie [Schrijven](#schrijven-bewaar)).
- **Extensie:** `.xml`. De modellen in [`modellen/`](modellen) staan in de lijst [`modellen/models.js`](modellen/models.js)
  (zie [Titel](#titel)).

Het bestand wordt **regel voor regel** gelezen. Elke regel is één van:

1. de eerste regel van het bestand (wordt overgeslagen, zie hieronder);
2. een **tag-regel**: een regel die precies gelijk is aan een van de tags uit de tabel;
3. een **inhoudsregel** binnen een sectie;
4. een regel **buiten een sectie**: daar wordt alleen naar `N = ...` gekeken.

### De eerste regel

De eerste regel wordt **altijd overgeslagen**, wat erop staat. Daar hoort `<modelleertaal>` te staan. Zet dus
nooit `N = ...` of een sectie-tag op de eerste regel.

### Tags

| Tag-regel | Betekenis | Verplicht |
|---|---|---|
| `<modelleertaal>` | begin van het bestand (eerste regel) | ja (wordt niet gecontroleerd) |
| `<startwaarden>` ... `</startwaarden>` | de *startwaarden*: worden één keer uitgevoerd vóór de rekenlus | nee, leeg als hij ontbreekt |
| `<modelregels>` ... `</modelregels>` | de *modelregels*: worden elke iteratie uitgevoerd | nee, leeg als hij ontbreekt |
| `<grafisch>` ... `</grafisch>` | aanwijzingen voor het grafische model (sinds 6.3) | nee |
| `<opdracht>` ... `</opdracht>` | een opdracht of vraag bij het model, voor de leerling (sinds 6.5) | nee |
| `<indeling>` ... `</indeling>` | de posities van versleepte symbolen in het grafische model (sinds 6.5) | nee |
| `</modelleertaal>` | einde van het bestand | nee (wordt niet gecontroleerd) |

Regels voor tag-regels:

- De regel moet **precies** de tag zijn: kleine letters, geen spaties ervoor of erachter, geen attributen,
  geen andere tekst op dezelfde regel. `  <modelregels>` (ingesprongen) of `<Modelregels>` is géén tag: zo'n regel
  wordt gelezen als gewone tekst (binnen een sectie: als inhoud).
- Een begintag start een sectie, een eindtag (van welke sectie dan ook) beëindigt de huidige sectie. Een nieuwe
  begintag binnen een sectie beëindigt de vorige sectie ook (er is geen nesting).
- Een sectie zonder eindtag loopt door tot het einde van het bestand.
- De volgorde van de secties maakt niet uit. De webapp schrijft altijd: `<opdracht>`, `<startwaarden>`,
  `<modelregels>`, `<grafisch>`, `<indeling>`.
- Komt een sectie twee keer voor, dan worden de inhouden achter elkaar gezet.
- Onbekende tags (bijvoorbeeld `<titel>`) worden buiten een sectie genegeerd en binnen een sectie gelezen als inhoud.

### Inhoud van een sectie

Elke regel tussen een begin- en eindtag wordt **letterlijk** overgenomen, met `\n` erachter: inspringing,
commentaar (`'...`, `//...`, `/* ... */`), lege regels, `<`, `>` en `&`. Er is geen escaping en er zijn geen
entiteiten. Het gevolg: een regel die precies `</modelregels>` (of een andere tag) is, kan niet in een sectie
staan. In *Modelleertaal* komt zo'n regel nooit voor.

De inhoud van `<startwaarden>` en `<modelregels>` is *Modelleertaal* (zie de [README](README.md#over-modelleertaal)).
Of die tekst een geldig model is, wordt pas gecontroleerd bij Run, niet bij het lezen van het bestand.

### Buiten een sectie: `N = ...`

Buiten de secties staat alleen het **aantal iteraties**:

```
N = 1000
```

- De regel begint met `N` (spaties ervoor mogen). `N` is een hoofdletter; `n = 1000` en `AN = 5` worden genegeerd.
- Alleen cijfers: `N = 1e4` wordt gelezen als `N = 1`, `N = 1000.5` als `N = 1000`.
- Spaties rond `=` mogen; na het getal mag nog tekst staan (`N = 500 'iteraties`).
- Ontbreekt `N`, dan gebruikt de webapp de standaardwaarde (of de `N` uit de link, `#model=...&N=100`, die gaat
  altijd voor).
- Alle andere regels buiten de secties worden genegeerd. Je kunt daar dus tekst neerzetten, maar de webapp schrijft
  die bij Bewaar niet terug.

Het lezen gebeurt met de reguliere expressie `/^\s*N\s*=\s*(\d+)/` (zonder de vlag `g`), op elke regel buiten de
secties. De webapp schrijft `N = ...` direct op de regel na `<modelleertaal>`.

### De sectie `<grafisch>`

Aanwijzingen voor het grafische model (stock-flow diagram, zie [`grafisch.js`](grafisch.js)). Het grafische model
wordt getekend uit de tekst van het model; deze sectie is alleen nodig voor wat niet uit de tekst te halen is.
Eén aanwijzing per regel:

```
naam: woord, woord, ...
```

- Alles na `'` of `//` op een regel is commentaar. Lege regels en regels zonder `:` worden genegeerd.
- `naam` is een woord zonder spaties en zonder `:`. De woorden na `:` mogen gescheiden zijn door spaties, `,` of `;`.
  Dubbele woorden tellen één keer. Staat dezelfde `naam` twee keer in de sectie, dan telt de laatste regel.

Betekenis:

| Regel | Betekenis |
|---|---|
| `Fres: Fz, Fp` | De variabele `Fres` heeft een formule met `...` (in te vullen, zoals in een examenopgave), bijvoorbeeld `Fres = ...`. Uit `...` zijn geen pijlen te halen; deze regel geeft ze: pijlen van `Fz` en `Fp` naar `Fres`, zoals in de figuur van het examen (2023-II *Fietshelm*). De regel doet alleen iets als de formule van `Fres` `...` bevat, en alleen voor namen die in het model voorkomen. |
| `startwaarden: tonen` | Een instelling, geen variabele. In de examenstijl worden dan ook de pijlen getekend uit formules in de *startwaarden* (gestippeld), zoals in 2014-II *Kogelstoten*. Zonder deze regel tekent de examenstijl die pijlen niet. |

In de webapp is `<grafisch>` alleen te lezen, niet te bewerken: de sectie van het geopende bestand blijft bewaard
en wordt bij **Bewaar** weer geschreven.

### De sectie `<opdracht>`

Gewone tekst: een opdracht of vraag bij het model, bijvoorbeeld "Vul de puntjes in en bepaal de eindsnelheid.".
De webapp toont hem in een smalle kaart boven het model. Een docent schrijft hem in **Meer opties** ("Opdracht bij
dit model"); hij gaat mee in **Bewaar**, **Deel link** en het automatisch bewaren. Witruimte en lege regels aan het
eind worden bij het lezen weggehaald. `N = ...` binnen deze sectie is tekst, geen aantal iteraties.

### De sectie `<indeling>`

Eén regel JSON: de posities van de symbolen die de gebruiker in het grafische model heeft versleept, per element
(dezelfde `id` als in [`grafisch.js`](grafisch.js)), in de coördinaten van de tekening:

```
<indeling>
{"v":[123,45],"Fw":[300,80]}
</indeling>
```

Symbolen die niet in de sectie staan, krijgen hun automatische plek. Een `id` die niet (meer) in het model voorkomt
wordt genegeerd; een positie die geen twee getallen is ook (`positions` in [`deellink.js`](deellink.js)). Ongeldige
JSON geeft de automatische indeling, geen foutmelding. **Herstel indeling** maakt de sectie leeg.

### Titel

De titel van een model staat **niet** in het bestand. Hij komt uit:

- `modellen/models.js` voor de modellen in de keuzelijst (`{title: "...", url: "modellen/naam.xml"}`; nieuwe
  bestanden voeg je toe met `modellen/update_models_js.py`, die de bestandsnaam als titel gebruikt);
- de bestandsnaam (zonder extensie) bij **Open**;
- de link bij **Deel link**.

## Schrijven (Bewaar)

`createBogusXMLString` in [`model.js`](model.js) schrijft precies:

```
<modelleertaal>
N = <N>                      ← alleen als N bekend is
<opdracht>                   ← alleen als er een opdracht is
<opdracht-tekst>
</opdracht>
<startwaarden>
<startwaarden-tekst>
</startwaarden>
<modelregels>
<modelregels-tekst>
</modelregels>
<grafisch>                   ← alleen als de sectie niet leeg is
<grafisch-tekst>
</grafisch>
<indeling>                   ← alleen als er symbolen versleept zijn
<indeling-json>
</indeling>
</modelleertaal>
```

Elke sectie wordt op dezelfde manier geschreven: lege regels (en regeleinden) aan het **eind** van de tekst worden
weggehaald, daarna krijgt elke regel één `\n`. Lege regels midden in de tekst blijven staan. Een lege sectie wordt
`<startwaarden>` direct gevolgd door `</startwaarden>`, zonder lege regel ertussen. Zo geeft Open + Bewaar
precies hetzelfde bestand, hoe vaak je het ook doet (na 6.3; daarvoor kwam er telkens een lege regel bij).

`createBogusXMLString` maakt `\n`-regeleinden. Bij het opslaan als bestand (`save_string` in
[`modelleertaal-app.js`](modelleertaal-app.js)) wordt elk regeleinde `\r\n`, ook dat van een lege regel.

Lezen en daarna schrijven geeft dus een **genormaliseerd** bestand: `N` direct na `<modelleertaal>`, vaste volgorde
van de secties, `\r\n` als regeleinde, geen lege regels aan het eind van een sectie, en tekst buiten de secties
(behalve `N`) verdwenen.

## Andere plaatsen waar een model staat

Een model staat ook op twee plaatsen die geen BogusXML zijn. Voeg je een veld toe aan het bestand, kijk dan of het
ook hier bij moet:

| Plaats | Formaat | Velden |
|---|---|---|
| **Deel link** (`#code=...`, [`deellink.js`](deellink.js)) | gecomprimeerde JSON in de URL | modelregels, startwaarden, titel, N, opdracht (`o`), indeling (`p`, als object). **Geen `<grafisch>`.** |
| **Automatisch bewaren** (localStorage, `modelleertaal_autosave`) | JSON | modelregels, startwaarden, titel, N, opdracht (`o`), indeling (`p`, als JSON-tekst). **Geen `<grafisch>`.** |

## Eigenaardigheden

Dit is hoe de huidige code werkt. Het is geen ontwerp, maar wie een model schrijft of de parser verandert, moet
het weten.

1. **De eerste regel wordt overgeslagen,** ook als het geen `<modelleertaal>` is.
2. **Alleen cijfers in `N`:** `N = 1e4` geeft `N = 1`.
3. **`N` mag overal buiten de secties staan,** ook na `</modelleertaal>`. De laatste telt.
4. **Een ingesprongen tag is geen tag** en wordt inhoud van de sectie waar hij in staat.
5. **Lege regel aan het eind van een sectie zonder eindtag:** loopt een sectie door tot het einde van het bestand,
   dan komt de lege "regel" na het laatste regeleinde er bij het lezen ook in (`"y\n\n"`). Bij Bewaar verdwijnt hij.

## Wijzigingsgeschiedenis

| Versie | Wijziging |
|---|---|
| 6.5 | Secties `<opdracht>` (tekst boven het model) en `<indeling>` (posities van versleepte symbolen, JSON). Ook in de deellink (`o`, `p`) en het automatisch bewaren. |
| na 6.3 | `N`: alleen een regel die met `N =` begint (ook na een langere regel met `=`; `AN = 5` telt niet meer). Schrijven: geen lege regels aan het eind van een sectie, dus Open + Bewaar verandert het bestand niet meer; overal `\r\n`. |
| 6.3 | Sectie `<grafisch>` (aanwijzingen `naam: ...` en de instelling `startwaarden: tonen`). Wordt gelezen en weer geschreven. |
| 6.0 | BOM wordt genegeerd; `\r\n` wordt correct gelezen (geen `\r` meer in de tekst, regelnummers in foutmeldingen kloppen). |
| 2019 | `N = ...` buiten de secties: het aantal iteraties. |
| eerste versie | `<modelleertaal>`, `<startwaarden>`, `<modelregels>`. |
