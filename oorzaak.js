/*
    oorzaak.js

    "Vanaf iteratie 16 heeft 'x' geen geldige waarde meer": wat is de meest waarschijnlijke
    oorzaak? Eén oorzaak noemen is duidelijker dan drie vragen tegelijk.

      'deling'  een noemer (een variabele) is 0 in die iteratie: delen door nul
      'wortel'  de wortel (of log, ln) van een negatieve variabele
      'groei'   de waarden worden eerst steeds groter tot ze te groot zijn: dt te groot?
      null      onbekend: de algemene melding

    No DOM. Works on the AST of the modelregels and the results of the run.

    usage:
      var oorzaak = require('./oorzaak.js');
      oorzaak.find(modelregels_ast, varNames, results, bad_row, constants)   // {kind: 'deling', name: 'm'} or null
      (constants, optional: name --> value of startwaarden that are not in the results, such as m)
*/

//jshint node:true
//jshint es3:true
"use strict";

var ROOTS = ['sqrt', 'wortel', 'log', 'ln', 'log10'];
var HUGE = 1e100;


function walk(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk(node.left, callback);
    walk(node.right, callback);
    walk(node.expr, callback);
}


function each_expr(ast, callback) {
    (ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') walk(stmt.right, callback);
        if (stmt.type == 'If' || stmt.type == 'IfElse') {
            walk(stmt.cond, callback);
            each_expr(stmt.then, callback);
            each_expr(stmt.elsestmt, callback);
        }
    });
}


function find(modelregels_ast, varNames, results, bad_row, constants) {
    constants = constants || {};
    function value(results, varNames, row, name) {
        var j = varNames.indexOf(name);
        if (j == -1) return constants.hasOwnProperty(name) ? constants[name] : undefined;
        if (row < 0 || row >= results.length) return undefined;
        return results[row][j];
    }

    var rows = [bad_row - 1, bad_row];
    var found = null;

    // delen door nul: a denominator that is a variable with the value 0
    each_expr(modelregels_ast, function(node) {
        if (found || node.type != 'Binary' || node.operator != '/' || !node.right) return;
        if (node.right.type != 'Variable') return;
        var name = node.right.name;
        rows.forEach(function(row) {
            if (!found && value(results, varNames, row, name) === 0) found = {kind: 'deling', name: name};
        });
    });
    if (found) return found;

    // wortel uit een negatief getal
    each_expr(modelregels_ast, function(node) {
        if (found || node.type != 'Function' || ROOTS.indexOf(String(node.func).toLowerCase()) == -1) return;
        if (!node.expr || node.expr.type != 'Variable') return;
        var name = node.expr.name;
        rows.forEach(function(row) {
            var v = value(results, varNames, row, name);
            if (!found && typeof v == 'number' && v < 0) found = {kind: 'wortel', name: name, func: node.func};
        });
    });
    if (found) return found;

    // the values grow until they are too large (numerically unstable: dt too large)
    var last = bad_row - 1;
    if (last >= 1) {
        for (var j = 0; j < varNames.length; j++) {
            var now = Math.abs(results[last][j]);
            var before = Math.abs(results[Math.max(0, last - 3)][j]);
            if (typeof results[last][j] != 'number' || !isFinite(now)) continue;
            if (now > HUGE || (now > 1e6 && now > 100 * before)) return {kind: 'groei', name: varNames[j]};
        }
    }
    return null;
}


function message(cause, bad_row, bad_var) {
    // the text of the warning
    var start = "Vanaf iteratie " + bad_row + " heeft '" + bad_var + "' geen geldige waarde meer. ";
    if (cause && cause.kind == 'deling') {
        return start + "Waarschijnlijk wordt er gedeeld door nul: '" + cause.name + "' is 0 in die iteratie. " +
               "Controleer de modelregels en startwaarden.";
    }
    if (cause && cause.kind == 'wortel') {
        return start + "Waarschijnlijk is '" + cause.name + "' negatief in " + cause.func + "(" + cause.name + "). " +
               "Controleer de modelregels en startwaarden.";
    }
    if (cause && cause.kind == 'groei') {
        return start + "De waarden (zoals '" + cause.name + "') worden steeds groter, tot ze te groot zijn. " +
               "Waarschijnlijk is dt te groot: probeer een kleinere dt.";
    }
    return start + "Wordt er gedeeld door nul, de wortel getrokken uit een negatief getal of wordt een getal te groot? " +
           "Controleer de modelregels en startwaarden (is dt klein genoeg?).";
}


exports.find = find;
exports.message = message;
