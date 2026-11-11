Simple compiler and webapp for *Modelleertaal*
==========================================

### [▶ Try the webapp!](https://tomkooij.github.io/modelleertaal)

It runs in your browser (computer, tablet or phone). Nothing to install, no account.

> **Prefer the old layout? Use [Modelleertaal classic](https://www.tomkooij.nl/modelleertaal-classic).**
>
> Version 6 of the webapp has a new layout. If you are used to the previous version (5.4.2), for example
> because your lesson material or instructions are based on it, you can keep using it at
> [www.tomkooij.nl/modelleertaal-classic](https://www.tomkooij.nl/modelleertaal-classic). This is an
> archived copy: it stays available, but it will not be updated.

[![test](https://github.com/tomkooij/modelleertaal/actions/workflows/test.yml/badge.svg)](https://github.com/tomkooij/modelleertaal/actions/workflows/test.yml)

*Modelleertaal* is the language of *natuurkundig modelleren*: the numerical (dynamic) models in Dutch high
school physics and in the central exams (vwo). This repository contains a fast *Modelleertaal* to javascript
compiler and a webapp that runs all models used in Dutch high school physics. The webapp is in Dutch.

## Webapp

[![The webapp: text model, automatic graphs and the previous run in gray](images/webapp-tekst.png)](https://tomkooij.github.io/modelleertaal)

The webapp is made for students: you should be able to use it without a manual.

- **Model and Run.** Choose an exam model or start with an empty model. Type the *modelregels* and
  *startwaarden* and press **Run** (or Ctrl+Enter).
- **Automatic graphs.** After Run the webapp chooses the relevant graphs from the model: (x,t), (v,t),
  (a,t), the trajectory (y,x), ... Click a thumbnail to show it large. Click a point to read its values.
- **Compare runs.** The previous run stays visible as a gray line. Change a startwaarde (for example `k`),
  press Run and see what changed.
- **Error messages in Dutch,** in the page, with the line marked in the editor and suggestions for typos
  (*Bedoel je 'Fres'?*). A warning if a value is no longer a valid number (division by zero, *dt* too large).
- **Help while modelling.** Next to the number of iterations the webapp shows how long the model runs
  (`× dt = 50`). If the model has a `stop` that is not reached, it says so and offers to double the
  number of iterations.
- **Table** with all values, and downloads: the table for Excel (TSV) and the graph as an image (PNG).
- **Your work is not lost.** Unsaved work is kept in the browser: on your next visit you can continue.
  **Bewaar** saves the model as a file, **Open** opens it again.
- **Deel link** copies a link that contains the (changed) model and its title: share it with a student,
  a colleague or in your lesson material.

### Graphical model

[![The graphical model (stock-flow diagram) next to the text of the model](images/webapp-grafisch.png)](https://tomkooij.github.io/modelleertaal)

Switch to **Tekst + grafisch** to see the model as a stock-flow diagram, like the graphical mode of Coach 7:
*toestandsvariabelen* (rectangles), *stromen* (pipes with a valve), *hulpvariabelen* (circles),
*constanten* (diamonds), *voorvallen* (lightning) and red arrows for "depends on".

- The diagram is drawn from the text of the model, while you type. No Run needed.
- **Text and diagram are linked.** Click a symbol and its lines in the text are marked. Put the cursor
  in a line of the text and its symbol lights up. After Run, hover over a symbol to see its first and last value.
- **The diagram is also input.** Click a symbol to change its name or formula, add *toestandsvariabelen*,
  *stromen*, *hulpvariabelen* and *constanten* (the **+** buttons on a selected *toestandsvariabele* add a
  flow in or out), or remove them. Every change is a small change in the text of the model: the text stays
  the model, as in the exams. Names of variables can be inserted with a click, so there are no typos.
- Drag symbols, zoom and pan. *Herkende elementen* lists how each line of the text was recognised.
  Download the diagram as SVG.

### On a phone or tablet

<img src="images/webapp-telefoon.png" alt="The webapp on a phone: the graph after Run" width="260" align="right">

The layout adapts to the screen. On a phone the model, the graph and the table are below each other;
after Run the page scrolls to the graph. The graphical model fits the width of the screen and you zoom
with two fingers.

The webapp (HTML/Javascript) runs in any modern browser on Windows, macOS, ChromeOS, Android and iOS. It is
developed and tested on Chrome. If it doesn't work or isn't easy to use: please
[provide feedback](https://github.com/tomkooij/modelleertaal/issues).

<br clear="right">

## Using the webapp in your own website

(please do!)

Only `index.html` and the folders `scripts/` and `modellen/` are needed to run the webapp in a browser or in a website. However
you need the browserified file `scripts/modelleertaal-app.browser.js` which is not included in the `master` branch.
You can build it yourself (see below) or download a zip or tarball from the [release page](https://github.com/tomkooij/modelleertaal/releases).

Optionally change the models in `modellen/` and edit `modellen/models.js` accordingly. Put it on a website somewhere.
All code runs in the browser, so a server is not needed.

The webapp can be customized (buttons and options turned off and on) in `config.js`.

## About *Modelleertaal*

*Modelleertaal* is the language used for "natuurkundig modelleren"
(dynamical models in high school physics in NL. System dynamics, Jay W. Forrester, DYNAMO, ...)
The language is a subset of "CoachTaal" which is an imperative language derived from Pascal.

*Modelleertaal* tries to resemble the syntax used in NL textbooks and exams, which is CoachTaal with some differences:

 - Statements are not ; terminated
 - = is used for assignments (:= is allowed, and treated as an alias. Slightly different from CoachTaal)
 - == is used for the 'equal' operator, instead of =. In practice the == operator should never be used.
   A single = is accepted as 'equal' directly in a condition: `als x = 3 dan`.
 - Only 'als dan eindals' 'anders' and 'stop' statements are implemented. Other flowcontrol is never used in *Modelleertaal*.
 - Functions cannot be defined. Most math functions from CoachTaal are implemented.
 - sin(x), cos(x) and tan(x) are always in degrees. Other trig functions in radians.
 - C/Java style comments are allowed

Example:
```
Als (a == 0) En Niet(b == Waar) Dan Stop       'modelleertaal
```

In Pascal:
```
If (a = 0) AND !(b = True) then Halt(0);
```

Examen vwo 2005-I Champignon:
```
     'model parachutesprong
     'modelregels
     Fwr = k * v^2
     Fres = Fzw - Fwr
     a = Fres/m
     dv = a * dt
     v = v + dv
     dy = v * dt
     y = y + dy
     h = h0 - y
     t = t + dt
     als h < 400 dan k = 0.6 * (400 - h) eindals
     als h < 350 dan k = 30 eindals
```

## About the modelleertaal compiler

`evaluator.js` contains a compiler for *Modelleertaal* to javascript. Using a modern javascript compiler such as Node.js/Chrome V8 it is very fast. `run.js` contains a benchmark. Compared to other modellertaal interpreters/compilers it is orders of magnitude faster.

The parser is build using [jison](https://github.com/zaach/jison). Modelleertaal is compiled to javascript which is executed using `eval()`. The `eval()` has been wrapped into an anonymous function to prevent bailout of the V8 optimising compiler.

Usage:
```javascript
model = new evaluator_js.Model();
model.modelregels = "a = a + 1";
model.startwaarden ="a = 1\n b=2\n";

N = 1000;
var evaluator = new evaluator_js.ModelregelsEvaluator(model);
results = evaluator.run(N);
```

`model.js` is used to read/write models. Models are stored in `BogusXML` which has an XML-like syntax with `<` and `>` allowed.

## Installation for development

To use the `master` branch (development version) of the webapp and/or compiler you will need to build it. This requires Node.js,
npm and grunt:

```
npm install -g grunt-cli
npm install
grunt
```

## Running the webapp offline

The webapp should run offline, but browser security may interfere with loading the models. (Cross site scripting protection may
block the ajax request). At the time of writing CORS protection blocks the webapp on Chrome, Firefox and Edge. Either install a
browser extension that disables CORS protection or use a local webserver (`python -m http.server`)

## License and credits

This compiler and webapp implements the language used in Dutch High School Physics exams.
This language is (based on) Coach and CoachTaal. Coach is developped by [CMA Science](http://cma-science.nl/).

The webapp was built using jQuery and Flot and heavily inspired by [HiSPARC jSPARC](http://github.com/HiSPARC/jSPARC/).

This was originally based on Zach Carter's [jsconf 2010 jison talk](https://github.com/zaach/zii-jsconf2010-talk).

### MIT License

```Copyright (c) 2017 Tom Kooij

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
