PGFPlots
========

TikZ/PGFPlots can be used to make beautiful and high-quality plots of Modelleertaal App output:

![example figure](/pgfplots/example.png)

`ModelleertaalApp.create_pgfplot` creates TikZ/PGFPlot output. `plot.tex` includes the generated input using the TeX `\input{}` statement.
A PGFPlots graph is overlayed over a TikZ millimeter grid (adjustable to 5mm or 1cm grid).

Usage
=====

Compile TeX to PDF (for example using TeXLive):

```
latexmk -c plot.tex
```

Or upload both files to ShareLatex or similar online service. [Example on Overleaf](https://www.overleaf.com/project/59f49e118ade204b7f11ab8f) 

Credit
======

This is based on example graphs by David Fokkema.
