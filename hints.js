/*
    hints.js

    Hints bij veelgemaakte modelfouten. Na Run, als informatie (nooit blokkerend), één tegelijk:

      - dt bestaat maar t wordt niet opgehoogd:  "De tijd loopt niet: voeg t = t + dt toe."
      - een startwaarde die nergens wordt gebruikt:  "'k' wordt niet gebruikt in de modelregels."
      - een startwaarde die in de modelregels wordt overschreven voordat hij gebruikt wordt:
        "De startwaarde van 'a' wordt niet gebruikt: ..."

    No DOM. Works on the AST of the parser.

    usage:
      var hints = require('./hints.js');
      var list = hints.find(evaluator.startwaarden_ast, evaluator.modelregels_ast);
      // [{kind: 'tijd', name: 't', text: '...'}, ...] (most important first)
*/

//jshint node:true
//jshint es3:true
"use strict";


function walk(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk(node.left, callback);
    walk(node.right, callback);
    walk(node.expr, callback);
}


function expr_reads(expr, out) {
    walk(expr, function(node) {
        if (node.type == 'Variable') out[node.name] = true;
    });
    return out;
}


function reads(ast, out) {
    // all names that are read in the statements (also inside als ... dan)
    out = out || {};
    (ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') {
            expr_reads(stmt.right, out);
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            expr_reads(stmt.cond, out);
            reads(stmt.then, out);
            reads(stmt.elsestmt, out);
        } else if (stmt.type == 'Print') {
            out[stmt.varname] = true;
        }
    });
    return out;
}


function writes(ast, out) {
    // all names that get a value (also inside als ... dan)
    out = out || {};
    (ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') {
            out[stmt.left] = true;
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            writes(stmt.then, out);
            writes(stmt.elsestmt, out);
        }
    });
    return out;
}


function first_use(ast, name) {
    // in the order of the modelregels: is name first 'read' or first 'write' (always, not
    // inside als ... dan)? null: not used.
    for (var i = 0; i < (ast || []).length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment') {
            if (expr_reads(stmt.right, {})[name]) return 'read';
            if (stmt.left == name) return 'write';
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            if (reads([stmt], {})[name]) return 'read';
        } else if (stmt.type == 'Print' && stmt.varname == name) {
            return 'read';
        }
    }
    return null;
}


function find(startwaarden_ast, modelregels_ast) {
    var start = [];   // names with a startwaarde, in order
    (startwaarden_ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment' && start.indexOf(stmt.left) == -1) start.push(stmt.left);
    });
    var read_start = reads(startwaarden_ast);
    var read_model = reads(modelregels_ast);
    var written = writes(modelregels_ast);
    var out = [];

    // the time does not run
    if (start.indexOf('t') != -1 && start.indexOf('dt') != -1 && read_model.dt && !written.t) {
        out.push({kind: 'tijd', name: 't',
                  text: "De tijd loopt niet: 't' wordt in de modelregels niet groter. Voeg t = t + dt toe."});
    }

    // a startwaarde that is not used anywhere
    start.forEach(function(name) {
        if (!read_model[name] && !read_start[name] && !written[name] && !(name == 't' && out.length)) {
            out.push({kind: 'ongebruikt', name: name,
                      text: "'" + name + "' wordt niet gebruikt in de modelregels."});
        }
    });

    // a startwaarde that is overwritten before it is used
    start.forEach(function(name) {
        if (!read_start[name] && first_use(modelregels_ast, name) == 'write') {
            out.push({kind: 'overschreven', name: name,
                      text: "De startwaarde van '" + name + "' wordt niet gebruikt: '" + name +
                            "' krijgt in de modelregels een nieuwe waarde voordat hij gebruikt wordt."});
        }
    });
    return out;
}


exports.find = find;
exports.first_use = first_use;
