# Changelog

## [5.x.dev]

dev

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
