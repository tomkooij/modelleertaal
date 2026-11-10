/*
    autoplot.js

    Kies automatisch de relevante grafieken bij een model.

    De keuze is gebaseerd op:
     - de modelregels (AST): welke variabelen worden "opgeteld" (x = x + v*dt)
       Dit zijn de toestandsvariabelen (plaats, snelheid, tijd, ...) van het model.
     - de resultaten: variabelen die niet veranderen zijn niet interessant
     - de namen van de variabelen (t, x, y, h, v, a, ...)

    usage:
      var autoplot = require('./autoplot.js');
      var analysis = autoplot.analyse(varNames, results, modelregels_ast);
      analysis.graphs --> [{x: 't', y: 'x'}, {x: 't', y: 'v'}, ...]
      De eerste grafiek is de meest relevante.
*/

//jshint node:true
//jshint es3:true
"use strict";

var MAX_GRAPHS = 8;

// (y, x) combinaties die samen een baan in het platte vlak vormen
var TRAJECTORIES = [['x', 'y'], ['x', 'h'], ['x', 'z']];

// voorkeursvolgorde voor grafieken tegen de tijd
var PRIORITY = ['s', 'x', 'y', 'h', 'u', 'r', 'θ', 'ϑ', 'φ', 'v', 'vx', 'vy', 'a'];
var PRIORITY_GROWTH = ['I', 'N'];  // groei/verval en SIR modellen


function walk_expr(node, callback) {
    // call callback(node) for each node in expression
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk_expr(node.left, callback);
    walk_expr(node.right, callback);
    walk_expr(node.expr, callback);
}


function find_assignments(ast, found, conditional) {
    // list all assignments in order:
    //  [{name: 'x', integrator: true, conditional: false}, ...]
    // conditional: assignment is inside als ... dan ... eindals
    conditional = conditional || false;
    for (var i = 0; i < ast.length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment') {
            found.push({
                name: stmt.left,
                integrator: references(stmt.right, stmt.left),
                conditional: conditional
            });
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            find_assignments(stmt.then, found, true);
            if (stmt.elsestmt) find_assignments(stmt.elsestmt, found, true);
        }
    }
    return found;
}


function references(expr, name) {
    var found = false;
    walk_expr(expr, function(node) {
        if (node.type == 'Variable' && node.name == name) found = true;
    });
    return found;
}


function column_stats(results, col) {
    // min, max and "has a constant step" of column. Skip non-numbers.
    var min = Infinity, max = -Infinity;
    var n = 0;
    var numeric = true;
    var monotonic = true;
    var prev;

    for (var i = 0; i < results.length; i++) {
        var val = results[i][col];
        if (typeof val !== 'number') {
            if (typeof val === 'boolean') numeric = false;
            continue;
        }
        if (!isFinite(val)) continue;
        if (val < min) min = val;
        if (val > max) max = val;
        if (prev !== undefined && val <= prev) monotonic = false;
        prev = val;
        n += 1;
    }
    var scale = Math.max(Math.abs(min), Math.abs(max));
    return {
        numeric: numeric && n > 0,
        constant: (n === 0) || (max - min <= 1e-12 * scale),
        monotonic: monotonic && n > 1
    };
}


function analyse(varNames, results, modelregels_ast) {

    var i, name;
    var info = {};
    var order = [];  // variables in order of appearance in the model

    var assignments = find_assignments(modelregels_ast || [], []);
    for (i = 0; i < varNames.length; i++) {
        // conditional: only gets a value inside als ... dan ... eindals
        info[varNames[i]] = {integrator: false, conditional: true, column: i};
    }
    for (i = 0; i < assignments.length; i++) {
        name = assignments[i].name;
        if (!info.hasOwnProperty(name)) continue;
        if (assignments[i].integrator) info[name].integrator = true;
        if (!assignments[i].conditional) info[name].conditional = false;
        if (order.indexOf(name) == -1) order.push(name);
    }
    for (i = 0; i < varNames.length; i++) {
        if (order.indexOf(varNames[i]) == -1) order.push(varNames[i]);
    }

    for (i = 0; i < varNames.length; i++) {
        name = varNames[i];
        var stats = column_stats(results, i);
        info[name].numeric = stats.numeric;
        info[name].constant = stats.constant;
        info[name].monotonic = stats.monotonic;
        // dx, dv, dOpp: the step that is added to x, v, Opp
        var base = /^(d|Δ)(.+)$/.exec(name);
        info[name].step = (base !== null) && info.hasOwnProperty(base[2]) && base[2] != name;
    }

    function exists(name) {
        return info.hasOwnProperty(name);
    }

    function interesting(name) {
        return exists(name) && info[name].numeric && !info[name].constant;
    }

    // --- time
    var time = null;
    var candidates = ['t', 'T', 'tijd'];
    for (i = 0; i < candidates.length && time === null; i++) {
        name = candidates[i];
        if (interesting(name) && info[name].integrator && info[name].monotonic) time = name;
    }
    if (time === null && interesting('t')) time = 't';
    for (i = 0; i < order.length && time === null; i++) {
        // no 't': use another variable that only counts up
        name = order[i];
        if (interesting(name) && info[name].integrator && info[name].monotonic &&
            /^t/i.test(name)) time = name;
    }

    var graphs = [];

    function add(x, y) {
        if (x == y) return;
        for (var j = 0; j < graphs.length; j++) {
            if (graphs[j].x == x && graphs[j].y == y) return;
        }
        graphs.push({x: x, y: y});
    }

    // --- trajectory (y,x)
    for (i = 0; i < TRAJECTORIES.length; i++) {
        var tx = TRAJECTORIES[i][0], ty = TRAJECTORIES[i][1];
        if (interesting(tx) && interesting(ty)) {
            add(tx, ty);
            break;
        }
    }

    // --- everything else: against time (or against the first variable)
    var xaxis = time;
    if (xaxis === null) {
        for (i = 0; i < varNames.length && xaxis === null; i++) {
            if (interesting(varNames[i])) xaxis = varNames[i];
        }
    }

    if (xaxis !== null) {
        var ranked = [];
        var push = function(name) {
            if (name != xaxis && interesting(name) && !info[name].step &&
                ranked.indexOf(name) == -1) ranked.push(name);
        };
        if (exists('N') || exists('I')) PRIORITY_GROWTH.forEach(push);
        PRIORITY.forEach(push);
        // other integrators: state of the model
        order.forEach(function(name) {
            if (info[name].integrator) push(name);
        });
        // resulting force
        order.forEach(function(name) {
            if (/^F_?(res|r|netto|tot)/i.test(name)) push(name);
        });
        order.forEach(push);

        for (i = 0; i < ranked.length; i++) add(xaxis, ranked[i]);

        // steps (dx, dv) are the least interesting. Only use if nothing else
        if (graphs.length === 0) {
            order.forEach(function(name) {
                if (name != xaxis && interesting(name)) add(xaxis, name);
            });
        }
    }

    // --- nothing interesting: just plot the first two variables
    if (graphs.length === 0 && varNames.length > 1) {
        add(varNames[0], varNames[1]);
    }

    return {
        time: time,
        graphs: graphs.slice(0, MAX_GRAPHS),
        info: info
    };
}

exports.analyse = analyse;
exports.find_assignments = find_assignments;
