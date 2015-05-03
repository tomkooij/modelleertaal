Simple parser / interpreter for *Modelleertaal*
==========================================

Modelleertaal grammar and interpreter in javascript/jison.

Parses the language used for "natuurkundig modelleren" (dynamical models in
 high school physics in NL). The language is a subset of "CoachTaal" which
 is a Pascal-derivative with the keywords translated into Dutch.
```
 Note that keywords start with a capital (and are in dutch).
 Statements are not ; terminated
 Comments start with '

 Example:
   Als (a = '0') En Niet(b = Waar) Dan Stop       'modelleertaal

 In Pascal this would be:
   If (a = '0') AND !(b = True) then Halt(0);

Extensions to the language:
CoachTaal (and Pascal) use ':=' as the assign keyword. We also allow '='
 because our textbook and exams use '='
C/Java style comments are allowed
```

This was originally based on git://github.com/zaach/zii-jsconf2010-talk.git

Installation
============

Command-line usage with Node.JS: Make sure jison is in CommonJS:

```
npm install path_to_jison/jison
```

Usage
=====

```
node interpreter.js
```
