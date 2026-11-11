/*
    dtcheck.js

    Is dt klein genoeg? Reken het model nog eens door met dt/2 en 2N iteraties.
    Hangt de uitkomst daarvan af, dan is de tijdstap te groot:

      "De uitkomst hangt nog af van de tijdstap: met dt = 0,05 eindigt x op 812
       in plaats van 838. Probeer een kleinere dt."

    No DOM.

    usage:
      var dtcheck = require('./dtcheck.js');
      var r = dtcheck.check(model, N, {results, varNames, stopped, runtime_ms, analysis});
      if (r) show(dtcheck.message(r, format));
*/

//jshint node:true
//jshint es3:true
"use strict";

var evaluator_js = require('./evaluator.js');
var stapper = require('./stapper.js');

var MAX_N = 100000;          // larger models: no check
var MAX_RUNTIME_MS = 200;    // slow models: no check
var TOLERANCE = 0.05;        // 5% of the range of a variable


function assigns(ast, name) {
    // is name assigned anywhere in the statements (also inside als ... eindals)?
    for (var i = 0; i < (ast || []).length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment' && stmt.left == name) return true;
        if ((stmt.type == 'If' || stmt.type == 'IfElse') &&
            (assigns(stmt.then, name) || assigns(stmt.elsestmt, name))) return true;
    }
    return false;
}


function column(rows, varNames, name) {
    var j = varNames.indexOf(name);
    if (j == -1) return null;
    return rows.map(function(row) { return row[j]; });
}


function range(values) {
    var min = Infinity, max = -Infinity;
    values.forEach(function(v) {
        if (typeof v != 'number' || !isFinite(v)) return;
        if (v < min) min = v;
        if (v > max) max = v;
    });
    return (max >= min) ? max - min : 0;
}


function last(values) {
    return values[values.length - 1];
}


function check(model, N, first) {
    // model: {startwaarden, modelregels} (text). N: iterations of the first run.
    // first: the first run {results, varNames, stopped, runtime_ms, analysis (autoplot.analyse)}
    // returns null (no problem found, or not checked) or
    //   {kind: 'end'|'stop', name, dt, dt_half, value, value_half}
    if (N > MAX_N || first.runtime_ms > MAX_RUNTIME_MS) return null;

    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    var ast = evaluator.startwaarden_ast;

    // dt must be a startwaarde (and not change in the modelregels)
    var k = -1;
    for (var i = 0; i < ast.length; i++) {
        if (ast[i].type == 'Assignment' && ast[i].left == 'dt') k = i;
    }
    if (k == -1 || assigns(evaluator.modelregels_ast, 'dt')) return null;

    var dt = new stapper.Stepper(ast.slice(0, k + 1), [], []).values.dt;
    if (typeof dt != 'number' || !isFinite(dt) || dt <= 0) return null;

    // dt = dt / 2, right after the startwaarde of dt
    ast.splice(k + 1, 0, {
        type: 'Assignment', left: 'dt', lineNo: ast[k].lineNo, astName: 'startwaarden',
        right: {type: 'Binary', operator: '/', left: {type: 'Variable', name: 'dt'},
                right: {type: 'Number', value: '2'}}
    });
    evaluator.set_state(2 * N, true, false);
    evaluator.run();
    var second = {results: evaluator.result, varNames: evaluator.namespace.varNames, stopped: evaluator.stopped};

    var result = {dt: dt, dt_half: dt / 2};
    var time = first.analysis ? first.analysis.time : null;

    if (first.stopped || second.stopped) {
        // stopped by 'stop': compare the time at which the model stops
        if (!time) return null;
        var t1 = column(first.results, first.varNames, time);
        var t2 = column(second.results, second.varNames, time);
        if (!t1 || !t2 || !isFinite(last(t1)) || !isFinite(last(t2))) return null;
        if (Math.abs(last(t1) - last(t2)) <= TOLERANCE * range(t1)) return null;
        result.kind = 'stop';
        result.name = time;
        result.value = last(t1);
        result.value_half = last(t2);
        return result;
    }

    // same end time: compare the end value of each toestandsvariabele
    var worst = 0;
    first.varNames.forEach(function(name) {
        var info = first.analysis && first.analysis.info[name];
        if (!info || !info.integrator || name == time) return;
        var a = column(first.results, first.varNames, name);
        var b = column(second.results, second.varNames, name);
        if (!a || !b) return;
        var end1 = last(a), end2 = last(b);
        if (typeof end1 != 'number' || typeof end2 != 'number' || !isFinite(end1) || !isFinite(end2)) return;
        var r = range(a);
        if (r === 0) return;
        var deviation = Math.abs(end1 - end2) / r;
        if (deviation > TOLERANCE && deviation > worst) {
            worst = deviation;
            result.kind = 'end';
            result.name = name;
            result.value = end1;
            result.value_half = end2;
        }
    });
    return result.kind ? result : null;
}


function message(r, format) {
    format = format || stapper.format_default;
    var text = 'De uitkomst hangt nog af van de tijdstap: met dt = ' + format(r.dt_half) + ' ';
    if (r.kind == 'stop') {
        text += 'stopt het model bij ' + r.name + ' = ' + format(r.value_half) +
                ' in plaats van ' + format(r.value) + '.';
    } else {
        text += 'eindigt ' + r.name + ' op ' + format(r.value_half) + ' in plaats van ' + format(r.value) + '.';
    }
    return text + ' Probeer een kleinere dt.';
}


exports.check = check;
exports.message = message;
