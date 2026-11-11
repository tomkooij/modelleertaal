/*
    vergelijk.js

    Vergelijk twee runs: wat is er anders aan het model?
    Gebruikt voor de notitie onder de grafiek bij de grijze lijn van de vorige run:

      "Grijs: vorige run (k = 0,37 → nu 0,50)"

    No DOM. The difference is computed on the parsed model, so whitespace and
    comments do not count.

    usage:
      var vergelijk = require('./vergelijk.js');
      var a = vergelijk.source(evaluator.startwaarden_ast, evaluator.modelregels_ast, N);
      var d = vergelijk.differences(a, b);   // {changes: [...], model_changed, N}
      vergelijk.describe(d)                  // 'k = 0,37 → nu 0,50'
*/

//jshint node:true
//jshint es3:true
"use strict";

var stapper = require('./stapper.js');

var MAX_CHANGES = 3;   // more differences: "model gewijzigd"


function source(startwaarden_ast, modelregels_ast, N) {
    // what defines a run: startwaarden (name --> text of the value), modelregels and N
    var values = {};
    var order = [];
    var other = [];   // statements that are not a plain assignment (als ... dan in startwaarden)
    (startwaarden_ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') {
            if (!values.hasOwnProperty(stmt.left)) order.push(stmt.left);
            values[stmt.left] = stapper.expr_text(stmt.right);
        } else {
            other.push(stapper.statement_text(stmt));
        }
    });
    return {
        startwaarden: values,
        order: order,
        startwaarden_other: other.join('\n'),
        modelregels: stapper.program_text(modelregels_ast),
        N: N
    };
}


function differences(before, now) {
    // differences between two runs (source() of each run)
    var changes = [];
    now.order.forEach(function(name) {
        if (!before.startwaarden.hasOwnProperty(name)) {
            changes.push({name: name, before: undefined, now: now.startwaarden[name]});
        } else if (before.startwaarden[name] != now.startwaarden[name]) {
            changes.push({name: name, before: before.startwaarden[name], now: now.startwaarden[name]});
        }
    });
    before.order.forEach(function(name) {
        if (!now.startwaarden.hasOwnProperty(name)) {
            changes.push({name: name, before: before.startwaarden[name], now: undefined});
        }
    });
    return {
        changes: changes,
        model_changed: (before.modelregels != now.modelregels) ||
                       (before.startwaarden_other != now.startwaarden_other),
        N: (before.N != now.N) ? {before: before.N, now: now.N} : null
    };
}


function describe(diff) {
    // the differences in words (without "Grijs: vorige run")
    if (diff.model_changed || diff.changes.length > MAX_CHANGES) return 'model gewijzigd';
    var parts = diff.changes.map(function(c) {
        if (c.before === undefined) return c.name + ' = ' + c.now + ' is nieuw';
        if (c.now === undefined) return c.name + ' is weggehaald';
        return c.name + ' = ' + c.before + ' → nu ' + c.now;
    });
    if (diff.N && parts.length < MAX_CHANGES) {
        parts.push('iteraties ' + diff.N.before + ' → nu ' + diff.N.now);
    }
    if (parts.length === 0) return 'hetzelfde model';
    return parts.join('; ');
}


exports.source = source;
exports.differences = differences;
exports.describe = describe;
