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
| `</modelleertaal>` | einde van het bestand | nee (wordt niet gecontroleerd) |

Regels voor tag-regels:

- De regel moet **precies** de tag zijn: kleine letters, geen spaties ervoor of erachter, geen attributen,
  geen andere tekst op dezelfde regel. `  <modelregels>` (ingesprongen) of `<Modelregels>` is géén tag: zo'n regel
  wordt gelezen als gewone tekst (binnen een sectie: als inhoud).
- Een begintag start een sectie, een eindtag (van welke sectie dan ook) beëindigt de huidige sectie. Een nieuwe
  begintag binnen een sectie beëindigt de vorige sectie ook (er is geen nesting).
- Een sectie zonder eindtag loopt door tot het einde van het bestand.
- De volgorde van de secties maakt niet uit. De webapp schrijft altijd: `<startwaarden>`, `<modelregels>`, `<grafisch>`.
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

- `N` is een hoofdletter; `n = 1000` wordt genegeerd.
- Alleen cijfers: `N = 1e4` wordt gelezen als `N = 1`, `N = 1000.5` als `N = 1000`.
- Spaties rond `=` mogen.
- Ontbreekt `N`, dan gebruikt de webapp de standaardwaarde (of de `N` uit de link, `#model=...&N=100`, die gaat
  altijd voor).
- Alle andere regels buiten de secties worden genegeerd. Je kunt daar dus tekst neerzetten, maar de webapp schrijft
  die bij Bewaar niet terug.

Het lezen gebeurt met de reguliere expressie `/([A-Za-z])[ ]*\=[ ]*(\d*)/g`: de eerste letter direct (op spaties
na) vóór een `=`. Zie [Eigenaardigheden](#eigenaardigheden) voor de gevolgen. **Zet `N = ...` daarom direct op de
regel na `<modelleertaal>`**, zoals de webapp zelf doet.

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
<startwaarden>
<startwaarden-tekst>
</startwaarden>
<modelregels>
<modelregels-tekst>
</modelregels>
<grafisch>                   ← alleen als de sectie niet leeg is
<grafisch-tekst>             ← zonder lege regels aan het eind
</grafisch>
</modelleertaal>
```

Na de tekst van `<startwaarden>` en `<modelregels>` komt altijd een `\n` vóór de eindtag, ook als de tekst al op een
regeleinde eindigt. Een model dat net geopend is, eindigt op een regeleinde (bij het lezen krijgt elke regel er een),
dus bij **Bewaar** komt er een lege regel bij vóór `</startwaarden>` en `</modelregels>` (zie
[Eigenaardigheden](#eigenaardigheden)).

`createBogusXMLString` maakt `\n`-regeleinden. Bij het opslaan als bestand (`save_string` in
[`modelleertaal-app.js`](modelleertaal-app.js)) worden die vervangen door `\r\n`, met de expressie
`/([^\r])\n/g`: een `\n` direct na een andere `\n` (een lege regel) blijft daardoor `\n`.

Lezen en daarna schrijven geeft dus een **genormaliseerd** bestand: `N` direct na `<modelleertaal>`, vaste volgorde
van de secties, en tekst buiten de secties (behalve `N`) verdwenen.

## Andere plaatsen waar een model staat

Een model staat ook op twee plaatsen die geen BogusXML zijn. Voeg je een veld toe aan het bestand, kijk dan of het
ook hier bij moet:

| Plaats | Formaat | Velden |
|---|---|---|
| **Deel link** (`#code=...`, [`deellink.js`](deellink.js)) | gecomprimeerde JSON in de URL | modelregels, startwaarden, titel, N. **Geen `<grafisch>`.** |
| **Automatisch bewaren** (localStorage, `modelleertaal_autosave`) | JSON | modelregels, startwaarden, titel, N. **Geen `<grafisch>`.** |

## Eigenaardigheden

Dit is hoe de huidige code werkt. Het is geen ontwerp, maar wie een model schrijft of de parser verandert, moet
het weten.

1. **De eerste regel wordt overgeslagen,** ook als het geen `<modelleertaal>` is.
2. **`N` kan gemist worden.** De reguliere expressie heeft de vlag `g` en wordt voor elke regel opnieuw gebruikt:
   na een treffer zoekt de volgende regel pas verder vanaf de positie van die treffer (`lastIndex`). Staat er buiten
   de secties vóór `N = 500` een langere regel met een `=` (bijvoorbeeld `abcdefghijkl = 1`), dan wordt `N` niet
   gevonden.
3. **`N` kan uit een andere naam komen.** De expressie kijkt naar de letter direct vóór `=`: buiten de secties
   wordt `AN = 5` gelezen als `N = 5`.
4. **Alleen cijfers:** `N = 1e4` geeft `N = 1`.
5. **`N` mag overal buiten de secties staan,** ook na `</modelleertaal>`. De laatste telt.
6. **Een ingesprongen tag is geen tag** en wordt inhoud van de sectie waar hij in staat.
7. **Elke keer Open + Bewaar geeft een extra lege regel** aan het eind van `<startwaarden>` en `<modelregels>`
   (zie [Schrijven](#schrijven-bewaar)).
8. **Gemengde regeleinden na Bewaar:** lege regels krijgen `\n`, de andere regels `\r\n`. Lezen gaat goed.
9. **Lege regel aan het eind van een sectie zonder eindtag:** loopt een sectie door tot het einde van het bestand,
   dan komt de lege "regel" na het laatste regeleinde er ook in (`"y\n\n"`).

## Wijzigingsgeschiedenis

| Versie | Wijziging |
|---|---|
| 6.3 | Sectie `<grafisch>` (aanwijzingen `naam: ...` en de instelling `startwaarden: tonen`). Wordt gelezen en weer geschreven. |
| 6.0 | BOM wordt genegeerd; `\r\n` wordt correct gelezen (geen `\r` meer in de tekst, regelnummers in foutmeldingen kloppen). |
| 2019 | `N = ...` buiten de secties: het aantal iteraties. |
| eerste versie | `<modelleertaal>`, `<startwaarden>`, `<modelregels>`. |
