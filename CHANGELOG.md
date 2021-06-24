# Changelog

## [5.4 dev]

- Update grunt minimum version
- arcsin/arccos/arctan in degrees, consistent with sin/cos/tan
- arcsinr/arccosr/arctanr in radians, consistent with sinr/cosr/tanr
- Update Flot to 4.4.2
- Patch Flot to fix tickDecimals (issue gh-57)

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
