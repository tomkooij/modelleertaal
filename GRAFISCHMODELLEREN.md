# Werkplan: grafisch modelleren vanuit een leeg model

Dit plan komt uit een gebruikstest van versie 6.6-dev. Vanuit *Basismodellen → Leeg model*
is in de weergave *Tekst + grafisch* het kracht-versnellingsmodel gebouwd, uitsluitend
via het diagram (geen tekst getypt in de modelregels of startwaarden).

Het lukte, maar met twee omwegen. Eén daarvan leverde eerst een model op dat niet
draaide. Dit document beschrijft wat er moet veranderen, in volgorde van belang.

## Doel

Een leerling bouwt dit model volledig via het diagram, in de volgorde die hij zelf
kiest, zonder dat de GUI een ongeldig model maakt:

```
'modelregels            'startwaarden
Fres = F                F = 100
a = Fres / m            m = 25
v = v + a * dt          v = 0
x = x + v * dt          x = 0
t = t + dt              t = 0
                        dt = 1
```

(De GUI schrijft stromen als `dv = a * dt` / `v = v + dv`; dat is goed.)

## Waar de code staat

| Onderdeel | Bestand |
|---|---|
| Bewerkingen op de tekst (`addStock`, `define`, `addConstant`, …) | `grafisch-edit.js` |
| Tests van de bewerkingen | `test/grafisch_edit_tests.js` |
| Analyse en tekenen van het diagram, indeling | `grafisch.js`, `test/grafisch_tests.js` |
| Formulieren, toetsen, zoom, undo (`grafisch_form`, `grafisch_place_form`, `grafisch_apply`) | `modelleertaal-app.js` |
| Opmaak van canvas en formulier | `index.html` (CSS) |

Regelnummers hieronder gelden voor commit 3920a89 en verschuiven; zoek op de naam.

## Werkwijze

- Pas eerst `grafisch-edit.js` aan met tests, daarna de formulieren in `modelleertaal-app.js`.
- `npm test` moet slagen (jshint draait mee; de code is ES3-stijl, zie de `jshint`-regels bovenaan).
- De webapp laadt `scripts/modelleertaal-app.browser.js`. Dat bestand staat in `.gitignore`
  en moet na elke wijziging opnieuw worden gebouwd met `npx grunt browserify`. Zonder die
  stap test je de oude code (de voettekst toont het versienummer van de bundel).
- Controleer elk punt in de browser met het scenario onder "Eindcontrole".
- Werk `CHANGELOG.md` bij.

## Deel 1 — blokkerend

### 1. Een onbekende variabele kan geen toestandsvariabele worden

**Stappen:** leeg model → *+ Toestandsvariabele* `x`, beginwaarde `0`, verandering `v`.
Er verschijnt een rood "?" voor `v`. Probeer nu `v` een toestandsvariabele te maken.

**Nu:**
- Het formulier "Onbekend: v" biedt alleen *Maak constante* en *Maak hulpvariabele*
  (`modelleertaal-app.js`, `case 'unknown'`; `ops.define` in `grafisch-edit.js` kent
  alleen `kind: 'const'` en `'aux'`).
- *+ Toestandsvariabele* met naam `v` geeft "De naam "v" bestaat al."
  (`Context.prototype.checkNewName` → `exists`, dat ook onbekende elementen meetelt).
- De enige uitwegen: undo en in omgekeerde volgorde bouwen (eerst `v`, dan `x`), of
  *Maak constante* → *+ Stroom erin*. Die laatste omweg zet de regels van `v` ná die
  van `x`, een andere rekenvolgorde dan het basismodel.

**Gewenst:**
- `ops.define` krijgt `kind: 'stock'` met `initial` en `rate`. Het resultaat is gelijk
  aan `addStock`, maar de regels `dv = …` en `v = v + dv` komen **vóór het eerste
  gebruik** van `v` in de modelregels (zoals `addRule` dat al doet voor hulpvariabelen).
- Het formulier "Onbekend" krijgt een derde knop *Maak toestandsvariabele*. Die opent
  het formulier voor een nieuwe toestandsvariabele met de naam al ingevuld (velden
  beginwaarde en verandering per tijdseenheid).
- *+ Toestandsvariabele* met de naam van een onbekende doet hetzelfde in plaats van de
  foutmelding. Voor *+ Hulpvariabele* en *+ Constante* geldt dit ook: een bestaande
  onbekende naam wordt gedefinieerd, niet geweigerd.

**Tests (`test/grafisch_edit_tests.js`):**
- Na `addStock x (rate v)` en `define v als stock (rate a)` staan de regels in de
  volgorde `dv`, `v`, `dx`, `x`, `t`.
- De naam van een element dat al een waarde of formule heeft wordt nog steeds geweigerd.

### 2. Enter in "Onbekend" maakt altijd een constante

**Stappen:** maak `a = Fres/m` (Fres wordt "?"). Klik op Fres, typ `F`, druk Enter.

**Nu:**
- De eerste knop is de submit-knop (`grafisch_form`: `n === 0` → `type="submit"`), dus
  Enter kiest altijd *Maak constante*.
- Het resultaat is `Fres = F` in de startwaarden. Definieer je daarna `F = 100`, dan
  komt die regel eronder en geeft Run: "De variabele 'F' heeft nog geen waarde".
  De GUI heeft dan zelf een ongeldig model gemaakt.

**Gewenst:**
- Enter kiest op basis van de invoer: alleen een getal (of een uitdrukking zonder
  variabelen) → constante; een formule met variabelen → hulpvariabele.
  `grafisch.variables(exprOf(text))` geeft de gebruikte variabelen.
- Een constante wordt ingevoegd **vóór de eerste startwaarde die hem gebruikt**, niet
  altijd aan het eind. Dit geldt voor `ops.define` (kind `const`) en `ops.addConstant`.
- Een constante waarvan de waarde naar andere startwaarden verwijst, komt **na** de
  laatste daarvan. Is dat niet mogelijk (variabele bestaat nog niet), dan aan het eind.

**Tests:**
- `define Fres const 'F'`, daarna `define F const '100'` → `F = 100` staat boven
  `Fres = F`, en het model draait.
- `addConstant` met een waarde die een bestaande startwaarde gebruikt komt daaronder.

## Deel 2 — hinderlijk

### 3. Het formulier bedekt het diagram

Het formulier opent over het canvas, vaak over het element dat net is gemaakt of over
de buren ervan (`grafisch_place_form`). Bij een klein model is het halve diagram weg.

**Gewenst:** het formulier staat niet over het geselecteerde element en liefst niet over
de elementen waarmee het verbonden is. Eenvoudigste oplossing: op brede schermen een
vaste strook rechts van of onder het canvas. Anders: plaats kiezen aan de kant met de
meeste vrije ruimte.

### 4. Formulier sluiten

- Na *Voeg toe* opent direct het eigenschappenformulier van het nieuwe element; dat moet
  met × worden weggeklikt voor de volgende stap. **Gewenst:** na toevoegen is het element
  geselecteerd, maar het formulier blijft dicht (of sluit bij de eerste klik ernaast).
- Escape sluit het formulier niet altijd. De toetsafhandeling vereist `grafisch_focus`,
  en die staat uit als de laatste klik op een werkbalkknop was en het formulier daarna
  alleen met het toetsenbord is bediend. **Gewenst:** Escape sluit het formulier zolang
  de focus in het formulier of het diagram staat. Controleer eerst of dit de oorzaak is.

### 5. Geen autofocus in "Onbekend"

Het formulier voor een nieuw element zet de cursor in het eerste veld; het formulier
"Onbekend" (en de eigenschappenformulieren) niet. Wat direct na de klik wordt getypt
gaat verloren. **Gewenst:** bij "Onbekend" staat de cursor in *Waarde of formule*.

### 6. Type omzetten

Een constante kan geen hulpvariabele worden en andersom; alleen verwijderen en opnieuw
definiëren werkt. **Gewenst:** een knop in het formulier (*Maak hulpvariabele* bij een
constante, *Maak constante* bij een hulpvariabele zonder variabelen in de formule) die
de regel verplaatst tussen startwaarden en modelregels, met de plaatsingsregels van punt 2.

### 7. dt is niet via het diagram in te stellen

`dt` en `t` zijn geen elementen; `dt` wordt stilzwijgend `0,1`. **Gewenst:** een klein
veld "dt =" in de werkbalk van het diagram dat de startwaarde van `dt` aanpast
(`setDefinition` op de regel van `dt`).

### 8. Oude foutmelding blijft staan

Na een fout bij Run blijft de rode balk zichtbaar, ook nadat het model via het diagram
is hersteld. **Gewenst:** de foutbalk verdwijnt bij elke wijziging van het model, net
zoals grafiek en tabel dan grijs worden.

## Deel 3 — klein

9. **Constante zonder pijl verdwijnt.** Een constante die alleen door een andere
   startwaarde wordt gebruikt (`Fres = F`) wordt niet getekend. Teken hem, met een pijl
   naar de startwaarde die hem gebruikt.
10. **Laag canvas.** Bij vijf of zes elementen zoomt *Passend* naar ongeveer 63% en zijn
    de formules onleesbaar. Laat de hoogte meegroeien met het diagram (tot een maximum)
    of maak de onderrand sleepbaar.
11. **Indeling verspringt.** Na een bewerking wisselen elementen van plaats (m en Fres).
    Houd bestaande elementen zo veel mogelijk op hun plek.
12. **Stroomlabels.** De ene stroom heet `a`, de andere `dx`. Overweeg bij een stroom
    waarvan de sterkte één variabele is (`dx = v * dt`) die variabele te tonen.
13. **Starthint.** Het lege canvas zegt alleen "Begin met + Toestandsvariabele". Na punt 1
    maakt de volgorde niet meer uit; pas de tekst dan aan, bijvoorbeeld: "Begin met een
    toestandsvariabele, zoals x. Klik daarna op een ? om die grootheid in te vullen."

## Eindcontrole

Bouw in de browser, zonder in de tekstvakken te typen:

1. Leeg model → *+ Toestandsvariabele* `x`, `0`, `v`.
2. Klik op "?" v → *Maak toestandsvariabele*, beginwaarde `0`, verandering `a`.
3. Klik op "?" a → `Fres/m`, Enter (wordt hulpvariabele/stroom).
4. Klik op "?" Fres → `F`, Enter (wordt hulpvariabele, niet constante).
5. Klik op "?" m → `25`, Enter. Klik op "?" F → `100`, Enter.
6. Zet dt op `1` en het aantal iteraties op `10`. Run.

Verwacht:
- Geen foutmelding; de modelregels staan in de volgorde `Fres`, `a`, `dv`, `v`, `dx`, `x`, `t`.
- `a = 4`, na 10 stappen `v = 40` en `x = 220`.
- Onderweg hoeft geen formulier met × te worden gesloten om verder te kunnen, en het
  element waaraan wordt gewerkt blijft zichtbaar.

Herhaal stap 1–5 in omgekeerde volgorde (eerst `v`, dan `x`) en via
*Maak constante* → *+ Stroom erin*; ook dan moet het model draaien.
