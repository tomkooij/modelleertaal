# Changelog

## [Unreleased]

### Webapp

- New panel "Grafisch model (zoals in Coach)": the text model is drawn as a
  stock-flow diagram like the graphical mode of Coach 7 (toestandsvariabelen,
  stromen, hulpvariabelen, constanten, voorvallen and relatiepijlen). Works
  without Run and updates while typing. Download as SVG. New module `grafisch.js`.

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
