# Werkplan: grafisch modelleren vanuit een leeg model

Dit plan komt uit een gebruikstest van versie 6.6-dev. Vanuit *Basismodellen → Leeg model*
is in de weergave *Tekst + grafisch* het kracht-versnellingsmodel gebouwd, uitsluitend
via het diagram (geen tekst getypt in de modelregels of startwaarden).

Het lukte, maar met twee omwegen. Eén daarvan leverde eerst een model op dat niet
draaide. Dit document beschrijft wat er moet veranderen, in volgorde van belang.

## Stand

Uitgevoerd: punten 1–8, 12 en 13. De eindcontrole is gedaan in Chrome (headless): alle drie de
volgordes (eerst `x`, eerst `v`, via *Maak constante* → *+ Stroom erin*) geven hetzelfde model
met `a = 4`, `v = 40` en `x = 220`.

Bij punt 4 bleek de oorzaak niet alleen `grafisch_focus`: Escape werkt nu ook als de focus in
het formulier of het diagram staat.

Toelichting:
- 12: een stroom `dx = v * dt` wordt getekend zoals `x = x + v*dt`: in de stijl Examen een
  ventiel zonder naam met een pijl van `v` (examens 2014-II, 2015-I), in de stijl Kleur met de
  naam `v`. Dit geldt ook voor bestaande modellen met `ds = v * dt` (Bungeejumper).

Niet gedaan:
- 9: bewust niet gedaan. In de stijl Examen wordt een constante die alleen in een startwaarde
  wordt gebruikt weggelaten, zoals in het examen 2026-II (`Fz = m * g`: geen `g`). `Fres = F`
  heeft dezelfde vorm. In de stijl Kleur wordt hij wel getekend. Via Enter wordt `Fres = F` nu
  een hulpvariabele, dus het probleem komt minder vaak voor.
- 10, 11: niet gedaan; 10 is niet nagebootst (bij 1400 px breed blijft het diagram op 100%).

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

---

# Tweede gebruikstest (na uitvoering van punten 1–8, 12, 13)

Getest op 15 november 2026 in de browser (1400 px breed), commit 5293427, zonder in de
tekstvakken te typen. Twee modellen: het kracht-versnellingsmodel en het model van examen
vwo 2005-I Champignon. De punten hieronder zijn voorstellen; er is nog niets gebouwd.

## Resultaat

**Kracht-versnellingsmodel: gelukt.** De eindcontrole hierboven werkt in zeven stappen, zonder
omweg en zonder een formulier te hoeven sluiten: `a = 4`, na 10 stappen `v = 40` en `x = 220`.
Wat goed werkt:
- De "?" als werkwijze: elke onbekende grootheid is één klik, typen, Enter.
- Enter kiest zelf constante of hulpvariabele; *Maak toestandsvariabele* zet de regels van `v`
  vóór die van `x`.
- Het formulier "Onbekend" staat naast het element, de cursor staat in het veld.
- Het nieuwe element is geselecteerd en de bijbehorende tekstregels lichten op. Zo ziet de
  leerling wat de GUI heeft geschreven.
- Ongedaan maken, het dt-veld, en de melding "Verder werken?" na herladen.

**Champignon: niet gelukt via het diagram.** De krachten, `v`, `x` en een groeiende `Opp` lukken.
De twee voorwaarden (`als t > 13 dan …`, `als Opp > 42,6 dan …`) zijn niet te maken (punt 14).
Onderweg kwamen foute eenheden (punt 15) en een ongeldige regel (punt 16) naar voren.

## Deel 4 — blokkerend

### 14. Een voorwaarde (voorval) is niet via het diagram te maken

**Stappen:** maak `Opp` als toestandsvariabele met verandering `groei`. Klik op "?" groei en typ
`als t > 13 dan 11 anders 0`.

**Nu:**
- "De formule … klopt niet." Er is geen knop voor een voorwaarde.
- Het diagram *tekent* voorvallen wel (bliksemschicht, in het examenmodel `t > 13` en
  `Opp > 42,6`), maar het formulier zegt: "Dit kun je alleen in de tekst van het model aanpassen."
- Dit raakt ook andere examenmodellen, bijvoorbeeld 2015-I Sprong bij volleybal
  (`als … anders …` en `als (v < 0) dan stop`). De overige examens zijn niet nagelopen.

**Gewenst:**
- Een vierde knop *+ Voorwaarde* met een formulier: voorwaarde (`t > 13`), variabele (`Opp`),
  nieuwe waarde of formule (`Opp + dOpp`), en een keuze "stop het model". Het resultaat is
  `als … dan … eindals`, geplaatst na de regels van de variabele en vóór `t = t + dt`.
- Het formulier van een bestaand voorval wordt bewerkbaar (voorwaarde en toekenning), met
  *Verwijder*.
- Voor de begrenzing (`als Opp > 42,6 dan Opp = 42,6`) volstaat een veld *Maximum* / *Minimum*
  in het formulier van een toestandsvariabele.
- `als … dan … anders …` (2015-I, `Fafzet`): een hulpvariabele met een tweede formule
  "anders". Dit kan later; de eerste drie punten dekken 2005-I.

**Tests:** het model van 2005-I is via `ops` op te bouwen en geeft dezelfde uitkomst als
`modellen/examenvwo2005.xml`.

### 15. Afgeleide eenheden zijn fout bij een getal in een formule

**Stappen:** zet *eenheden* aan. Bouw `Fz = m * 9,81`, `Fr = Fz - Fw`, `a = Fr/m`, `v`, `x`. Geef
alleen `m` de eenheid `kg` (`t` en `dt` krijgen vanzelf `s`).

**Nu:** het diagram, de tabelkop en de assen tonen `Fz (kg)`, `Fw (kg)`, `Fr (kg)`, `a ()`,
`v (s)`, `x (s²)` en `k (kg/(m²·s²))`. Het getal `9,81` telt als dimensieloos
(`eenheden.js`, `case 'Number'`). De leerling ziet foute natuurkunde zonder waarschuwing.

**Gewenst:**
- Een getal in een product of quotiënt maakt de eenheid **onbekend**, niet dimensieloos.
  Uitzondering: een exponent en een geheel getal of `0,5` (`0,5 * m * v^2`).
- Een afgeleide eenheid staat er anders dan een ingevulde (grijs of cursief), zodat duidelijk is
  wat de leerling zelf heeft opgegeven.
- `a ()` wordt nooit getoond: geen eenheid is geen haakjes.
- Hint bij `m * 9,81`: "Geef 9,81 een naam (g) en een eenheid."

**Tests (`test/eenheden_tests.js`):** `Fz = m * 9,81` met `m` in kg geeft geen eenheid voor `Fz`;
`Ek = 0,5 * m * v^2` geeft wel `J`.

### 16. De naam van de stroom kan botsen met de verandering

**Stappen:** maak toestandsvariabele `Opp`, beginwaarde `0,8`, verandering `dOpp` (de naam uit
het examenmodel).

**Nu:** de GUI schrijft `dOpp = dOpp * dt` en `Opp = Opp + dOpp`. Het diagram tekent `dOpp` als
tweede toestandsvariabele. Geen melding.

**Gewenst:** `freeName('d' + naam)` telt ook de namen in de ingevulde formule mee. Bij een
botsing: een foutmelding in het formulier ("dOpp is de naam van de stroom; kies een andere
naam voor de verandering per tijdseenheid").

**Tests:** `addStock Opp (rate dOpp)` wordt geweigerd of geeft een stroom met een andere naam.

## Deel 5 — hinderlijk

### 17. Het formulier voor een toestandsvariabele bedekt het diagram

Punt 3 is opgelost voor "Onbekend" en voor de eigenschappen, niet voor *Nieuwe
toestandsvariabele* / *Maak toestandsvariabele*. Dat formulier staat linksboven over het
diagram; bij een klein model is alles weg, ook de "?" waar het om gaat. **Gewenst:** dezelfde
plaatsing als "Onbekend".

### 18. Indeling en zoom (punten 10 en 11, nu met een concreet geval)

- Na elke stap staan de elementen ergens anders (`m` sprong van naast `Fr` naar de linkerrand,
  `k` van boven `Fw` naar het midden). Een leerling moet elke keer opnieuw zoeken.
- Bij negen elementen (Champignon) zoomt het diagram naar 85%, in één tussenstap naar 63%. De
  formules zijn dan niet te lezen.
- De pagina verspringt verticaal als een formulier opent.

**Gewenst:** punt 11 (bestaande elementen blijven staan, een nieuw element komt bij zijn buur)
en punt 10 (hoogte groeit mee) krijgen voorrang boven de rest van dit deel.

### 19. Eenheid invullen

- Enter in het veld *Eenheid* doet niets; de eenheid wordt pas opgeslagen als het veld de focus
  verliest. **Gewenst:** Enter slaat op en sluit het formulier.
- Het eigenschappenformulier heeft geen zichtbare knop om op te slaan; alleen *Verwijder*.
  **Gewenst:** een knop *OK*.
- De notatie wisselt: `Opp (m^2)` (ingevuld) naast `x (s²)` (afgeleid). **Gewenst:** altijd
  superscript.

### 20. Formules in het diagram

- Vermenigvuldigen staat er als spatie: `Fz = m 9,81`, `Fw = k Opp v^2`. **Gewenst:** `·`.
- Het formulelabel van een stroom staat over de naam (`a`), het label met de beginwaarde over
  de "+"-handvatten van de toestandsvariabele.

### 21. Beginwaarde wordt overgeslagen

Na *Maak toestandsvariabele* staat de cursor in *Verandering per tijdseenheid*; de beginwaarde
(`0`) ligt daarvoor. Voor `Opp = 0,8` moet de leerling terug. **Gewenst:** cursor in
*Beginwaarde*, met de `0` geselecteerd.

## Deel 6 — klein

22. **Volgorde startwaarden.** Het resultaat is `x`, `t`, `dt`, `v`, `m`, `F`. Zet nieuwe
    startwaarden boven `t` en `dt`, zoals in de basismodellen.
23. **Spaties.** `a = Fres/m` (getypt) staat naast `dv = a * dt` (gegenereerd). Schrijf formules
    uit het formulier met dezelfde spaties.
24. **Tabel.** De stroomvariabelen `dv` en `dx` krijgen een eigen kolom. Overweeg ze standaard
    te verbergen bij een model dat via het diagram is gemaakt.
25. **Weergave onthouden.** Na herladen staat de weergave weer op *Tekst*. Onthoud
    *Tekst + grafisch*.
26. **Opnieuw beginnen.** Er is geen knop *Nieuw model* bij het diagram. Opnieuw beginnen gaat
    via de modelkeuze of herladen. (Niet getest: of "Leeg model" opnieuw kiezen in de lijst
    werkt als het al gekozen is.)
27. **Leeg canvas.** Het lege diagram is één regel hoog. Geef het de hoogte van een klein model,
    dan verspringt de pagina niet bij het eerste element.

## Eindcontrole (tweede ronde)

Bouw 2005-I Champignon in de browser, zonder in de tekstvakken te typen:

1. `x` (0, `v`) → `v` toestandsvariabele (0, `a`) → `a = Fr/m` → `Fr = Fz - Fw`.
2. `Fz = m * g`, `g = 9,81` met eenheid `m/s^2`; `Fw = k * Opp * v^2`; `m = 91` kg; `k = 0,37`.
3. `Opp` toestandsvariabele, 0,8 m², verandering `groei`; `groei = 11`.
4. *+ Voorwaarde*: `t > 13` bij de stroom van `Opp` (daarvoor geen groei); maximum 42,6.
5. Run met 500 iteraties.

Verwacht: dezelfde grafiek van `v` als het examenmodel; eenheden `Fz (N)`, `a (m/s²)`,
`v (m/s)`, `x (m)` na het invullen van `x` in m; het diagram blijft leesbaar (≥ 90%).
