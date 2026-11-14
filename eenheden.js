/*
    eenheden.js

    Eenheden van variabelen uit het commentaar van het model. Geen nieuwe bediening:
    een eenheid tussen rechte haken in het commentaar achter een startwaarde wordt herkend.

      m = 91 '[kg]
      v = 0 // [m/s] beginsnelheid
      Fw = k*v^2   ' [N]       (modelregel: voor een variabele zonder startwaarde)

    De eenheid komt op de assen ("v (m/s)"), in de tabelkop, in de tooltip en in de TSV.
    Een eenheid in de startwaarden gaat voor een eenheid in de modelregels.

    No DOM.

    usage:
      var eenheden = require('./eenheden.js');
      var units = eenheden.units(startwaarden_text, modelregels_text);   // {v: 'm/s', ...}
      eenheden.label('v', units)   // 'v (m/s)'
*/

//jshint node:true
//jshint es3:true
"use strict";

// name = ... or name := ... at the start of a line (same characters as the parser, simplified)
var ASSIGNMENT = /^\s*([a-zA-Z\u007f-\uffef][a-zA-Z0-9_\u007f-\uffef]*)\s*:?=(?!=)/;
// start of a comment: ' or // or # or /*
var COMMENT = /'|\/\/|#|\/\*/;
var UNIT = /\[([^\[\]]{1,20})\]/;


function line_unit(line) {
    // {name, unit} for a line 'name = ... '[unit]', or null
    var m = ASSIGNMENT.exec(line);
    if (!m) return null;
    var rest = line.slice(m[0].length);
    var c = COMMENT.exec(rest);
    if (!c) return null;
    var u = UNIT.exec(rest.slice(c.index));
    if (!u) return null;
    var unit = u[1].replace(/^\s+|\s+$/g, '');
    if (!unit) return null;
    return {name: m[1], unit: unit};
}


function units(startwaarden, modelregels) {
    // name --> unit. The first unit of a name counts; startwaarden go first.
    var out = {};
    [startwaarden, modelregels].forEach(function(text) {
        String(text || '').split(/\r?\n/).forEach(function(line) {
            var found = line_unit(line);
            if (found && !out.hasOwnProperty(found.name)) out[found.name] = found.unit;
        });
    });
    return out;
}


function label(name, units) {
    // 'v (m/s)', or 'v' without a unit
    return (units && units.hasOwnProperty(name)) ? name + ' (' + units[name] + ')' : name;
}


function labels(names, units) {
    // the label of an axis with several variables: 'x, y (m)' when they have the same unit,
    // else 'x (m), v (m/s)'
    if (names.length === 0) return '';
    var first = units && units.hasOwnProperty(names[0]) ? units[names[0]] : undefined;
    var same = names.every(function(name) {
        return units && units.hasOwnProperty(name) && units[name] === first;
    });
    if (same && first !== undefined) return names.join(', ') + ' (' + first + ')';
    return names.map(function(name) { return label(name, units); }).join(', ');
}


exports.units = units;
exports.label = label;
exports.labels = labels;
exports.line_unit = line_unit;
