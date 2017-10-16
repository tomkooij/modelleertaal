Simple compiler and webapp for *Modelleertaal*
==========================================

[![travis](https://travis-ci.org/tomkooij/modelleertaal.svg?branch=master)](https://travis-ci.org/tomkooij/modelleertaal)
[![appveyor](https://ci.appveyor.com/api/projects/status/62ndpna03e6mi37y?svg=true
)](https://ci.appveyor.com/project/tomkooij/modelleertaal)

*Modelleertaal* to javascript compiler in javascript/jison. A simple demo webapp is included that can run most (all?)
of the models used in high school physics in NL.

## Webapp

Screenshot

[Example](https://tomkooij.github.io)

## About Modeleertaal

*Modelleertaal* is the language used for "natuurkundig modelleren"
(dynamical models in high school physics in NL. System dynamics, Jay W. Forrester, DYNAMO, ...)
The language is a subset of "CoachTaal" which is an imperative language derived from Pascal.

*Modelleertaal* tries to resemble the syntax used in NL textbooks and exams, which is CoachTaal with some differences:

 - Statements are not ; terminated
 - = is used for assignments (:= is allowed, and treated as an alias. Slightly different from CoachTaal)
 - == is used for the 'equal' operator, instead of =. In practice the == operator should never be used.
 - Only 'als dan eindals' and 'stop' statements are implemented. Other flowcontrol is never used in *Modelleertaal*.
 - Functions cannot be defined. Most math functions from CoachTaal are implemented.
 - sin(x), cos(x) and tan(x) are always in radians.
 - C/Java style comments are allowed

```


   Example:
     Als (a == 0) En Niet(b == Waar) Dan Stop       'modelleertaal

   In Pascal:
     If (a = 0) AND !(b = True) then Halt(0);

   Real world example (Examen vwo 2005-I Champignon):
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


##Installation

Node.js using npm and grunt:

```
npm install -g grunt-cli
npm install
grunt
```

##Usage

A Node.js example in in `run.js`:
```
node run
```


##License and credits

This compiler and webapp implements the language used in Dutch High School Physics exams. 
This language is (based on) Coach and CoachTaal. Both are trademarks of [CMA Science](http://cma-science.nl/). 

This was originally based on git://github.com/zaach/zii-jsconf2010-talk.git
