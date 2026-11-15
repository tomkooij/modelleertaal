# Changelog

## [Unreleased]

### Rondleiding

- New button **Rondleiding** at the right of the top bar: a short tour along the five parts a
  teacher should see first: choosing a model, Run and Stap, the automatic graphs and reading them,
  Tekst + grafisch, and an opdracht with Deel link. It never starts by itself; a small dot on the
  button shows it has not been opened yet (remembered in the browser).
- Each step lights up its part of the page; the page stays usable. Volgende/Vorige, the arrow keys
  and Esc. For the graph step the tour runs the model if it has no results; the diagram and Meer
  opties are opened for their step and closed again afterwards.

## [6.6]

15 nov 2026

### Grafisch model: voorwaarden (als ... dan) via het diagram

- New button **+ Voorwaarde**: *Als* `t > 13` *dan verandert* `Opp` *in* `Opp + dOpp`, or
  *Stop het model*. It writes `als ... dan` / `Opp = Opp + dOpp` / `eindals` as in the exam
  models: for a toestandsvariabele or constante just before `t = t + dt`, for a hulpvariabele
  right after its formula, a stop at the end. With a variable selected, its name is filled in.
- A voorval (lightning bolt) and a stopvoorwaarde can be changed in their form (condition and new
  value) and removed, when they are one `als ... eindals` block. A block inside another `als` or
  with more than one new value still says to change it in the text.
- A voorwaarde can also change a hulpvariabele that is drawn as the valve of a flow (`groei` in
  `dOpp = groei * dt`); its block goes right after `groei = 11`.
- The form of a toestandsvariabele has **Minimum** and **Maximum**: `als Opp > 42,6 dan Opp = 42,6
  eindals`; empty removes it.
- The model of exam vwo 2005-I *Champignon* can now be built from an empty model without typing in
  the text, and gives the same results.

### Grafisch model: formulieren, eenheden, opnieuw beginnen (GRAFISCHMODELLEREN.md 17–27)

- The form of a new element is placed where it covers the least of the diagram; with *Maak
  toestandsvariabele* it stays next to the **?** that is being defined.
- In the form of an existing element, Enter saves and closes the form (the element stays selected).
  New button **OK** does the same.
- Units are shown with superscripts everywhere (`m²`, `m/s²`), also when typed as `m^2`; the text
  of the model keeps what was typed. The pgfplots download writes `\si{m/s^{2}}`.
- Formula boxes (*formules*): the box of a flow is below its name, also when the tap points down;
  the box with the beginwaarde is above the + buttons of a toestandsvariabele.
- A new startwaarde goes above `t = 0` and `dt = 0,1` when those are the last lines.
- *Verder werken → Ga verder* goes back to *Tekst + grafisch* when that was the view of the saved
  work. A new visit still starts with *Tekst* (6.1.1).
- New button **Nieuw** above the diagram: Basismodellen → Leeg model, also when that is already
  chosen. It asks first when the model was changed.
- The empty diagram is as high as a small model, so the page does not jump at the first element.

### Grafisch model: Tab neemt de voorgestelde waarde over

- Tab in an empty field of a form of the diagram takes over the grey example or suggestion as
  real input: `x`, `0`, `v` and `m` in *Nieuwe toestandsvariabele*, or the derived unit (`m/s`) in
  the field *Eenheid*. In the form of an existing element it is applied when the field is left.
  The tooltip of the field says so. Also in the field for the unit of `dt` (a derived unit, not the
  word *eenheid*). Not for a placeholder that is not a value: *geen* (Minimum, Maximum) and
  *(geen naam)* (a flow without a name). Shift+Tab never fills in.

### Eenheden en stromen (GRAFISCHMODELLEREN.md 15, 16)

- A number with a unit that is not written (`9,81` in `Fz = m * 9,81`, `0,37`) makes the unit of a
  product unknown. Before, it counted as a pure number, which gave `Fz (kg)`, `a ()`, `v (s)` and
  `x (s²)`. Whole numbers, `0,5` and `pi` still count as pure numbers (`Ek = 0,5 * m * v^2` is J).
- No empty brackets: `a ()` is shown as `a`.
- In the diagram a derived unit is lighter than a unit you filled in yourself.
- A toestandsvariabele `Opp` with *verandering per tijdseenheid* `dOpp` was written as
  `dOpp = dOpp * dt` (a second toestandsvariabele). Now the form says that `dOpp` is the name of
  the flow and asks for another name.
- Fixed: after Enter in the field `dt =`, a click in a form moved the typing back into `dt =`
  (`0,1kg`). A change that does not change the text no longer redraws the diagram.

### Eenheden: afgeleid uit de formules, en in het grafische model

- Units that are not written in the comments are derived from the formulas where possible, also
  backwards: with `x '[m]` and `t '[s]`, `dx = v * dt ; x = x + dx` gives `dx` in m and `v` in m/s;
  `Fres/m` with N and kg gives m/s² (N, J, W, Pa, V, Ω and C are recognised; km, h, g, dag stay
  their own symbols). The derived units appear on the axes, in the table and in the downloads.
  No time unit is assumed.
- *Tekst + grafisch* has a toggle **eenheden**: the units after the names in the diagram (upright),
  in *Herkende elementen*, and a field *Eenheid* in every form (new elements, *Onbekend*, existing
  elements) and next to `dt =`. The field writes the comment `'[kg]` in the text; empty removes it.
  The grey hint in the field is the derived unit (or an example) and is **not** taken over by
  *Voeg toe*.
- With the toggle on, a new model gets `t = 0 '[s]` and `dt = 0,1 '[s]`.
- A form says when the units in a formula do not fit (*volgens de formule is de eenheid m/s², niet
  m/s*; *kg en kg·dag/s opgeteld*).

### Grafisch model: bouwen vanuit een leeg model (GRAFISCHMODELLEREN.md)

- An unknown variable (**?**) can become a *toestandsvariabele*: the form *Onbekend* has a third
  button *Maak toestandsvariabele*. Its lines `dv = a * dt` and `v = v + dv` go before the first
  flow that uses `v`, so building `x` first and `v` second gives the same model (and the same
  order of calculation) as the other way round.
- *+ Toestandsvariabele*, *+ Hulpvariabele* and *+ Constante* with the name of an unknown
  variable define it, instead of the message "De naam bestaat al".
- Enter in the form *Onbekend* chooses: a number (or a formula without variables) becomes a
  *constante*, a formula with variables a *hulpvariabele*. Before, Enter always made a constante,
  and `Fres = F` followed by `F = 100` gave a model that did not run.
- A new constante goes before the first startwaarde that uses it and after the startwaarden it
  needs (was: always at the end).
- A constante with a new flow (*+ Stroom erin*) becomes a toestandsvariabele at the same place
  as above (was: just before `t = t + dt`).
- After *Voeg toe* the new element is selected, but its form stays closed: the diagram stays in
  view. A click on the element opens the form.
- The form covers as little of the diagram as possible: never the selected element, preferably
  not the elements connected to it.
- Escape closes the form whenever the focus is in the form or the diagram.
- The form *Onbekend* puts the cursor in *Waarde of formule*.
- A constante can become a hulpvariabele and back (button *Maak hulpvariabele* / *Maak constante*).
- A field **dt =** in the toolbar of the diagram sets the time step.
- The red error bar of the last Run disappears when the model changes.
- The empty diagram explains how to start: a toestandsvariabele first, then click a **?**.
- In the form of a new element, an empty field takes the grey example: *Voeg toe* at once
  makes `x` with change `v`, `Fres = Fz - Fw` or `m = 75` (was: an error message). A new flow
  has the example `0` instead of the word *formule*.
- A flow `dx = v * dt` with `x = x + dx` (as the diagram writes it) is drawn as `x = x + v*dt`:
  in the style Examen a valve without a name with an arrow from `v` (as in the exams 2014-II,
  2015-I), in the style Kleur the name `v`. The flow is still called `dx` in its form and in
  *Herkende elementen*. Also for models such as `ds = v * dt` (Bungeejumper).

## [6.5]

15 nov 2026

### Grafisch model: symbolen in de stijl Kleur

- The style **Kleur** now uses the stock-flow notation shared by most System Dynamics software and
  books (Forrester, Sterman, Stella, Vensim, Powersim) instead of the symbols of one program:
  a *constante* is a diamond (was: a circle with a line segment on each side), a flow from or to
  outside the model starts or ends in a cloud (was: a dashed circle) and a *stopvoorwaarde* is an
  octagon (a stop sign; was: a red diamond). Toestandsvariabele (rectangle), stroom (pipe with a
  bow tie valve), hulpvariabele (circle) and the colors do not change. The style Examen does not change.
- README and DIDACTIEK.md explain the choice of symbols and colors, with sources per symbol.
- In the style Kleur the name of a flow (`a` in `v = v + a*dt`) is as large as the other names
  (was: small and grey), as in the SLO examples.
- README, DIDACTIEK.md and `grafisch.js` give the sources of the lightning bolt (voorval: the
  Event of AnyLogic) and the clock (onafhankelijke variabele: the Clock block of Simulink).
- DIDACTIEK.md compares both styles with the graphical models in the SLO examples
  (*Voorbeelden computermodellen natuurkunde*) and explains why there is no third style.

### Documentatie

- New `DIDACTIEK.md`: the didactic principles of the webapp and, per part, the reason behind
  it. The README links to it and describes the new features that matter for teaching
  (reading off and slope, units, tips, opdracht bij een model).

### Eenheden

- A unit in square brackets in the comment after a startwaarde is recognised:
  `m = 91 '[kg]` or `v = 0 // [m/s]`. For a variable without a startwaarde: in the comment
  after its modelregel. The unit is shown on the axes (`v (m/s)`), in the table header, in the
  tooltip of the graph, in the TSV header, in the PGFPlot labels, in the end time next to the
  number of iterations (`× dt = 50 s`) and in the status line. Models without brackets do not
  change. New module `eenheden.js` (with tests).
- PGFPlot no longer uses a fixed list of units (in which `a` was m/s).
- The basic models (Basismodellen) have units.

### Aflezen in de grafiek

- A click on a point of the graph shows it as a dot with lines to both axes (reading off,
  as on paper) and a label with its values. The table shows that row and marks it.
  The other way around: a click on a row of the table puts the dot in the graph. A click
  next to the line removes it. The separate mini table under the graph (`#clickdata`) is gone.
- With one graph the tangent at that point is drawn up to the axes (or the edge of the graph),
  through the whole graph, without changing the axes. The slope comes from the points before
  and after. A click on the tangent shows its two ends (where it crosses the axes) with their
  values, and the label calculates the slope from them as real (stacked) fractions:
  helling = Δy/Δt = (1,5 − 0,4127)/(0,4525 − 0) = 2,403 m/s, with the values read off the
  tangent in the numerator and denominator. Another click hides it. Before that click the
  label only says "klik op de raaklijn voor de helling". New module `aflezen.js` (with tests).
  See DIDACTIEK.md, with screenshots made by `tools/screenshots.mjs`.
- The table keeps the number of rows shown when it is drawn again.

### Grafiek

- Zoom in: drag a rectangle in the graph (the cursor is a cross). **Hele grafiek** (only
  visible when zoomed in) or a double click shows the whole graph again. Not on a touch
  screen, where dragging scrolls the page. Another graph: not zoomed in.
- The variables on the axes are chosen on the axis labels themselves (a small arrow next to
  the label; the menus show the units). The menus "verticaal" and "horizontaal" under the
  graph are gone.
- Several graphs in one figure: when the ranges differ more than a factor 20, the small ones
  get a second axis on the right ("(as rechts)" next to the checkbox). New module `assen.js`
  (with tests).

### Controle van het model

- Quiet check while typing: 1 s after the last key the model is parsed. A syntax error gives
  only a red dot next to the line number, with the message as title (hover). No message bar,
  the cursor does not move. The full message comes with Run, as before. Lines with `...`
  are not an error.
- Hints after Run for common mistakes, as information and only when there is no other
  message (one at a time): the time does not run (`t = t + dt` is missing), a startwaarde
  that is not used, and a startwaarde that is overwritten in the modelregels before it is
  used. New module `hints.js` (with tests).

### Opdracht en indeling

- Opdracht bij een model (for teachers): in **Meer opties** a text box "Opdracht bij dit
  model". The text is shown in a small card above the model, and goes along in Deel link
  (field `o`), Bewaar (section `<opdracht>`) and the autosave. A teacher can share a model
  with puntjes and a question in one link.
- The layout of the graphical model is kept: dragged symbols keep their place in Deel link
  (field `p`), Bewaar (section `<indeling>`, JSON) and the autosave. Herstel indeling clears it.
  Changing the opdracht or the layout counts as a change of the model (warning before it is lost).
- `BogusXML.md` describes the new sections.

### Kleine punten

- Opening another link (`#model=...`, `#code=...`) in the same tab with a changed model now
  asks first whether the changes may be lost, as choosing another model does. Before, the
  new link was ignored without a word.
- Stap voor stap: the graph shows the last Run in gray (so the axes do not jump) with the
  points computed so far and a dot at the current point.
- `Ctrl+Enter` (on a Mac `⌘+Enter`) runs the model; it is in the tooltip of Run, not always visible.
- "Vanaf iteratie 16 heeft 'x' geen geldige waarde meer" names the most probable cause:
  division by zero (with the variable that is 0, also a constant), the square root of a
  negative number, or values that grow until they are too large (dt too large). Otherwise
  the general message as before. New module `oorzaak.js` (with tests).

## [6.4.1]

14 nov 2026

- The version at the bottom of the webapp was still v6.2; it is now the version of
  `package.json`. `npm version` keeps them equal (`tools/sync-version.js`), a test and
  the release workflow check it.

## [6.4]

14 nov 2026

### Modelkeuze

- The models of c2modellen (C2 Energie en arbeid), c3modellen (C3 Gravitatie) and
  b1modellen (B1 Trillingen en golven) are in the webapp, in `modellen/c2`, `modellen/c3`
  and `modellen/b1`. Links: `#model=c2/Bungeejumper`.
- Choosing a model has two menus: the collection (Examens vwo, Basismodellen, B1, C2, C3)
  and the model, with headings (Opgaven, ...). Basismodellen has the empty model and the
  basic models of B1, C2 and C3 (each model once), by subject (beweging, worp en baan,
  trillingen) and from simple to complex. B1, C2 and C3 also have their own basic
  models, under the heading Basismodellen. `models.js` has `groep` and `sectie` per
  model (see `modelkeuze.js`); `update_models_js.py` reads the subfolders.

### Modelbestand (BogusXML)

- `N = ...` is always found: the regexp no longer has the `g` flag, whose `lastIndex`
  made it miss `N` after a longer line with `=`. Only a line that starts with `N =`
  counts (`AN = 5` is no longer read as `N = 5`).
- Bewaar no longer adds an empty line at the end of `<startwaarden>` and `<modelregels>`
  each time a model is opened and saved again, and writes `\r\n` for every line
  (empty lines were `\n`).
- The file format is specified in `BogusXML.md`.

## [6.3]

14 nov 2026

### Grafisch model

Closer to the graphical models in the exams (2018-I, 2026-II):

- `dv = a*dt; v = v + dv` with `a` a hulpvariabele: the valve is `a`, not
  `dv` (exam 2018-I). Also with a minus sign: `dEk = -Fw*ds` gives valve `Fw`.
- Without `t`: `s = s + ds` with `ds` a constant is the independent variable,
  like `t` (exam 2026-II Phobos). `s` and `ds` are not drawn.
- Exam style: no arrows from formulas in the startwaarden (`Fz = m*g`,
  `Ek = 1/2*m*v^2`), and no constante that is only used there (`g`). The
  style Kleur still shows them. Switching the style makes a new layout.
- The stopvoorwaarde is a diamond with its condition, top left, without
  arrows (exam 2026-II). Click it to see the condition.
- New checkbox **formules** next to Examen | Kleur: a box with the formula or
  beginwaarde next to every symbol, as in the exams 2015-I and 2016-I
  (`a = Fres/m`, `y = 0,68`; `als ... dan ...` on more lines). The layout makes
  room for the boxes. Remembered for the next visit.
- `x = x + v*dt` with `v` a toestandsvariabele: in the exam style the valve has
  no name (exams 2015-I, 2023-II), only the arrow from `v`.
- A line with `...` (to be filled in) has no arrows, but the exam figure does.
  New optional section `<grafisch>` in the model file gives them, one line per
  variable: `Fres: Fz, Fp`. Only used while the line still has `...`; the
  formula itself is not in it. Kept when the model is saved. Added to
  2023-II Fietshelm (figuur 6).
- Valve without a name also when the flow is one constante (`x = x + vx*dt`,
  exams 2014-II and 2022-I): the name is already on the symbol it comes from.
- `vy = ...` with a startwaarde is a toestandsvariabele without flows (exam
  2014-II, figuur 3); in the answer it is `vy = vy - g*dt`.
- `startwaarden: tonen` in `<grafisch>`: the exam style also draws the arrows
  from formulas in the startwaarden, dashed (exam 2014-II: `v0` and `alfa` to
  `vx` and `vy`). Without it, as before (exam 2026-II). Added to both 2014-II
  models.

### Modellen

- Examen vwo 2014-II *Kogelstoten* as in the exam, with `vy = ...` and
  `Als ... Dan stop` (figuur 3), and the answer from the correctievoorschrift
  as `examenvwo2014-antwoord.xml` (the model that was there before).

- Add Examen vwo 2023-II *Fietshelm* (with answer) and 2026-II *Sporen op
  Phobos* (model 2). Checked against all natuurkunde havo/vwo exams on
  examenblad.nl from 2021 to 2026 (no exams in 2020): these were the only
  missing exams with modelregels. Havo has no modelling questions; 2022-II
  (vwo) describes a computermodel but does not print it.
### Webapp

- Error in the model: a cross (✕) next to the line number of the line with the
  error; hover over it to see the message (gh-42). It stays until the model is
  edited or run, like the red line.
- "Functies" under the modelregels: a list of all functions (sin, sinr, wortel,
  ln, log, entier, teken, min/max, ...) with an explanation and an example
  (gh-54). "Onbekende functie" points to this list. The list is
  `FUNCTIONS` in `evaluator.js`; a test checks that it matches the code
  generator and that every example is correct.
- Graph: a line for x = 0 and y = 0 when it lies inside the graph (gh-37),
  also in the PNG of "Download grafiek".
- Closed: gh-38 (custom Flot, see `README.CUSTOM-FLOT.md`) and gh-49 (empty PNG
  with "Opslaan als": replaced by "Download grafiek" in 6.2).

## [6.2]

11 nov 2026

### Webapp

- New button **Stap** next to Run (P2-1): computes the model one modelregel per
  click and shows the calculation with the numbers filled in, below the run bar:
  `iteratie 3, regel 6:  v = v + a*dt  →  v = 0,981 + 9,78 × 0,1 = 1,959`.
  At `als ... dan` it shows whether the condition is true and which lines are
  skipped or executed (also step by step). The line lights up in the editor and
  the cell that changed lights up in the table. The first click (after loading,
  after a change, after a Run or at the end) starts again at the startwaarden;
  typing in the editor or Run ends the stepping. Replaces the debugger
  ("Volgende regel") and "Voeg toe: N iteraties"; the checkbox for these
  buttons in "Meer opties" and their entries in the profiles of `config.js`
  are removed. New module `stapper.js` (no DOM, tested): the expressions are
  computed with the code generator of `evaluator.js`, so stepping gives exactly
  the same table as Run.
- Comparing runs (P2-2): the note below the graph says what is different from
  the previous run: "Grijs: vorige run (k = 0,37 → nu 0,50)", or "(model
  gewijzigd)" for changed modelregels or more than three differences. The
  differences are found in the parsed model (whitespace and comments do not
  count). New button **Houd vast**: the gray line stays as a reference for the
  next runs until the button is clicked again. The gray line is also shown with
  "meerdere grafieken in één figuur". New module `vergelijk.js` (no DOM, tested).
- Is dt small enough? (P2-3): after a Run the model is computed again in the
  background with dt/2 and 2N iterations. If the end value of a
  toestandsvariabele differs more than 5% of its range (with `stop`: the time
  at which the model stops), a message says so: "De uitkomst hangt nog af van
  de tijdstap: met dt = 0,05 eindigt x op 812 in plaats van 838. Probeer een
  kleinere dt." Skipped for N > 100 000, without `dt` in the startwaarden, when
  `dt` changes in the modelregels, or when the run took more than 200 ms. New
  module `dtcheck.js` (no DOM, tested).

## [6.1.1]

11 nov 2026

### Webapp

- The model card always starts with "Tekst" (not "Tekst + grafisch"). The
  choice "Tekst | Tekst + grafisch" is no longer remembered in the browser.

## [6.1]

11 nov 2026

### Documentatie

- README in het Nederlands (de MIT-licentie blijft de officiele Engelse tekst).
- README: "Probeer de webapp" bovenaan, nieuwe secties over de webapp, het
  grafische model en gebruik op een telefoon, met screenshots in `images/`.

### Ontwikkeling

- Grunt minimaal 1.5.3 (twee Dependabot-meldingen: race condition en path traversal).

### Webapp

- "Deel link" is backwards compatible and more robust. New module
  `deellink.js` (no DOM, tested). New links are `#code=v2.<payload>`: the
  version is in front of the payload, so a future version can change the
  encoding and still read all older links. Links of version 1 (webapp 6.0,
  `#code=<payload>`) and `#model=naam&N=...` keep working; frozen links
  of every version are in `test/deellink_tests.js`. Reading accepts links
  mangled by chat, mail and documents (standard base64, line breaks,
  percent-encoding, a period or bracket at the end). A link that cannot be
  read (cut off, newer version) gives a message instead of silently showing
  another model.
- Fix: `N` in a link (`#model=...&N=100`) is no longer overruled by `N` in the
  model file.
- New panel "Weergave als grafisch model": the text model is drawn as a
  stock-flow diagram (toestandsvariabelen, stromen, hulpvariabelen, constanten,
  voorvallen and relatiepijlen), drawn like the graphical models in the vwo
  exams (2022-I, 2023-II): black on gray, a stroom is a hollow arrow with a
  valve (circle with a tap), hulpvariabelen and constanten are circles with the
  name below (or to the right, when an arrow leaves at the bottom).
  The switch "Examen | Kleur" below the diagram draws it in the colors of
  Coach 7 instead: blue symbols, red relatiepijlen, a hulpvariabele is a circle
  and a constante a small circle with a line segment on each side (as in
  Coach 7, see A. Heck, Guide on modelling, UvA; sources in `STIJLEN` in
  `grafisch.js`). The choice is remembered and used for the SVG download. Works
  without Run and updates while typing. Elements can be dragged (arrows and
  pipes follow), "Herstel indeling" resets. Download as SVG. New module `grafisch.js`.
- The graphical model is also input: click a symbol to change its name, formula,
  value or (for a flow) where it comes from and goes to; add toestandsvariabelen,
  stromen, hulpvariabelen and constanten; give an unknown (?) variable a value;
  remove elements. Every change is a small edit of the text of the model
  (comments and layout of the text are kept, Ctrl+Z in the editor works).
  New module `grafisch-edit.js`.
- Graphical model controls: the form of the selected symbol opens next to it and
  shows, for a toestandsvariabele, the formulas of its flows; Delete removes the
  selected symbol, Escape or a click on the background closes the form;
  "Ongedaan maken" (Ctrl+Z) for changes made in the diagram; zoom (buttons,
  Ctrl + mouse wheel, "Passend") and pan (drag the background). A wide model
  is fitted to the width.
- Unsaved work is kept in the browser (localStorage). On the next visit:
  "Verder werken?" with "Ga verder" and "Weggooien". Not for a shared link
  (`#code=`); removed after "Sla model op" or after choosing another model.
- Next to "Aantal iteraties": `× dt = 50`, how long the model runs (N × dt,
  from the startwaarden, updates while typing).
- If the model has a `stop` that was not reached: hint in the status line with
  a button "Verdubbel aantal iteraties" (doubles N and runs again).
- Top bar: "Open", "Bewaar" and "Deel link" are always visible ("Bestanden…"
  and the file name field are gone). "Deel link" confirms in the button itself
  ("Link gekopieerd ✓"). The link to Modelleertaal classic is in the footer.
- The title of the model is a heading above the editors that can be edited
  directly ("Pas titel aan" is gone). Downloaded files are named after the
  title: `Examen vwo 2014-II Kogelstoten.xml`, `... (y,x).png`, `....tsv`.
- "Download tabel (Excel)" in the heading of the table and "Download grafiek"
  next to the graph (after Run). The graph is saved as a PNG with axes, labels
  and (multiplot) legend. SVG and PGFPlot stay in "Meer opties".
- "Meer opties": significant digits and max. points are applied when changed
  (no button-as-label); "Meer/minder knoppen (profiel)" is now a checkbox that
  shows "Volgende regel" and "Voeg toe". Significant digits and "verticale as
  vanaf 0" are remembered in the browser.
- Graphical model in the model card: switch "Tekst | Tekst + grafisch" next to
  the title (remembered). With "Tekst + grafisch" the model gets the whole
  width: diagram left and text right (≥ 1200 px, else diagram above the
  text), graph and table below it, next to each other. With "Tekst" the
  graph stays in view on the right (sticky on wide screens). The panel
  "Weergave als grafisch model" at the bottom is gone.
- Symbol and text are linked: a selected symbol marks its lines in the
  editors (definition, beginwaarde, the line where a flow enters); the cursor
  in a line lights up its symbol. After Run the tooltip of a symbol shows the
  begin and end value. New `grafisch.lines()`.
- Diagram controls without instructions: the explanation paragraph and
  "Legenda" are replaced by a small fixed legend under the diagram.
  "Herkende elementen" (closed by default) is under the legend; a click on a
  row selects that element in the diagram; "Herstel indeling" and the SVG download are icons in the
  toolbar. A selected toestandsvariabele has + buttons for a new flow in
  (left) and out (right). Changes in the form are applied at once (Enter or
  leaving the field, no "Pas toe"); an impossible change gets a red border
  and leaves the text as it is. Under a formula: the names of the variables,
  click to insert. The form opens below, above or next to the symbol and
  never outside the diagram.
- Phone: the diagram starts fitted to the width ("Passend", down to 30%);
  zoom with two fingers.
- Fix: after `stop`, "Voeg toe" and the debugger ("Volgende regel") no longer
  continue the model. `evaluator.stopped` is only true for `stop`/`print`, no
  longer for a debugger breakpoint.

## [6.0]

10 nov 2026

### Webapp

- Automatic graphs: after Run the relevant graphs are chosen from the model
  (state variables like `x = x + v*dt`, variables that change) and shown as
  clickable thumbnails. New module `autoplot.js`.
- Previous run (gray line) is shown for every graph, not only the last one plotted.
- Error messages in Dutch in the page (no more `alert()`), with the line marked
  in the editor. Suggestions for typos in variable names.
- Warning if a variable is no longer a valid number (division by zero, dt too large).
- Status shows if the model was stopped by `stop` and the final time.
- Run with Ctrl+Enter. Changing the axis replots immediately (Plot button removed).
- New responsive layout (works on phones), `lang="nl"`.
- "Deel link": link that contains the (changed) model: `index.html#code=...`
- Editable model title (default: the title from the menu). The title goes into the share link.
- Ask for confirmation before changes to a model are lost.
- Table: small numbers (1e-5) are no longer shown as 0.
- Multiplot: colour next to the checkbox instead of a separate legend.
- SVG export is scaled and no longer upside down.
- Debug output in console only with `index.html#debug`.

### Compiler

- Fix operator precedence: `als t + dt > 10 dan` was parsed as `t + (dt > 10)`.
  `min(a+1; b)` returned `b`.
- Fix `2 - -x` (generated invalid javascript).
- Allow `als x = 3 dan` (single `=` as equals, in a condition).
- Add `sqr()`, `wortel()`, `entier()` and `round()`.
- `print()` no longer uses `alert()`: output in `evaluator.messages`.
- `evaluator.stopped` is true if the model stopped before N iterations.
- Line numbers in errors are correct for files with Windows line endings.

## [5.4.2]

20 may 2022

- Add Examen 2022 

## [5.4]

- Update grunt minimum version
- arcsin/arccos/arctan in degrees, consistent with sin/cos/tan
- arcsinr/arccosr/arctanr in radians, consistent with sinr/cosr/tanr
- Update Flot to 4.4.2
- Patch Flot to fix tickDecimals (issue gh-57)
- Include Flot 6ef52547a0049cee5ad02ef21645a035b67ffd59 (flot PR 1730) 
  (Modelleertaal issue gh-38). Added README.CUSTOM-FLOT.md
- Migrate to travis-ci.com
- Add examen 2013-3


## [5.3]

1 jun 2021

- Add leeg model

## [5.2]

2 apr 2021

- Add sinr, cosr and tanr functions (trig with radians) by mierenhoop
- Export N=... to model.xml
- Allow user to set precision (significante cijfers) in table and TSV
- implement min() and max() functions, with ; as separator. min(-10; 0) == 0

## [5.1.1]

- Plot theta,t diagram (add theta unicode 3b8 to evaluator.sortVarNames())

## [5.1]

- Implement print(). Stops execution and print value of variable.
- Auto plot (N, t) curve for exponentiale growth/decay

## [5.0.2]

29 Feb 2020

### Changes ###

- Fix packaging (travis/releases). 
  Make sure browserified modelleertaal-app.browser.js is deployed to releases.

## [5.0.1]

12 Feb 2020

### Changes ###

- Replace Google Analytics by Goatcounter. (Privacy friendly)

### Bug Fixes ###

- Round numbers in TSV export to 4 digits. Fix Google Sheets import issues.


## [5.0]

12 jan 2020

### Changes ###

- Meerdere plots tegelijkertijd in een grafiek
- Klik op y-as for autoscale aan/uit (plot y-as vanaf nul)
- Tooltips om waarden af te lezen in grafiek
- app layout, bestanden menu
- `update_modeljs.py` script: genereer `models.js`automatisch
- PGFPlots: verbeterde plots
- 'EN' en 'OF' logische operatoren toegevoegd
- Kies automatisch voor het (y,x)-diagram als y en x variabelen in model zitten.
- Zet directe link naar model in URL en browser history
- 'log()' en 'abs()' functies toegevoegd

### Bug Fixes ###

- [#35](https://github.com/tomkooij/modelleertaal/issues/35) - "BLANK" geeft nu ook "vul iets in bij de puntjes" als de regel alleen "..." bevat
- fix boolean variablen in output (tabel)

## [4.5.0]

28sep2019

### Changes ###

- accepteer unicode squared/cubed F=k*v²

### Bug Fixes ###

- fix double alert 'cannot read property of undefined' on parse error

## [4.4.1]

15sep2019

### Changes ###

 - Accept ... and unicode symbol '...' as BLANK (Vul hier in error)

## [4.4.0]

13sep2019

### Changes ###

- Add read N=1000 from XML.
- Add error msg for ... "Vul hier iets in"
