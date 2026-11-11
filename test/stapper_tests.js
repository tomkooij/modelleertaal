var assert = require('chai').assert;

var evaluator_js = require("../evaluator.js");
var stapper = require("../stapper.js");

function parse(startwaarden, modelregels) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    return new evaluator_js.ModelregelsEvaluator(model, false);
}

function stepper(startwaarden, modelregels, N) {
    // as in the app: check the model (N = 0) to find the columns, then step
    var evaluator = parse(startwaarden, modelregels);
    evaluator.set_state(0, true, false);
    evaluator.run();
    return new stapper.Stepper(evaluator.startwaarden_ast, evaluator.modelregels_ast,
                               evaluator.namespace.varNames, {N: N});
}

function run(startwaarden, modelregels, N) {
    var evaluator = parse(startwaarden, modelregels);
    evaluator.set_state(N, true, false);
    evaluator.run();
    return evaluator;
}

var CHAMPIGNON_START = "m = 91\nk = 0,37\nOpp = 0,8\nv = 0\nx = 0\nt = 0\ndOpp = 1,1\ndt = 0,1";
var CHAMPIGNON = "'Examen VWO 2005-I Champignon\n" +
    "Fz = m * 9,81\nFw = k * Opp * v^2\nFr = Fz - Fw\na = Fr/m\nv = v + a*dt\nx = x + v*dt\n" +
    "als t > 13 dan\n    Opp = Opp + dOpp\neindals\n" +
    "als Opp > 42,6 dan\n    Opp = 42,6\neindals\nt = t + dt\n";

function expr(text) {
    // AST of the expression on the right of 'y = ...'
    return parse('a = 1', 'y = ' + text).modelregels_ast[0].right;
}

describe('stapper.js - expressies als tekst', function() {

    it('expr_text: met namen, haakjes alleen waar nodig', function() {
        assert.equal(stapper.expr_text(expr('v + a*dt')), 'v + a*dt');
        assert.equal(stapper.expr_text(expr('(a + b) * c')), '(a + b)*c');
        assert.equal(stapper.expr_text(expr('a - (b - c)')), 'a - (b - c)');
        assert.equal(stapper.expr_text(expr('a / (b * c)')), 'a/(b*c)');
        assert.equal(stapper.expr_text(expr('-x^2')), '-x^2');
        assert.equal(stapper.expr_text(expr('sqrt(x^2 + y^2)')), 'sqrt(x^2 + y^2)');
        assert.equal(stapper.expr_text(expr('9,81')), '9,81');
        assert.equal(stapper.expr_text(expr('pi * r²')), 'pi*r^2');
    });

    it('expr_text: voorwaarden in het Nederlands', function() {
        assert.equal(stapper.expr_text(expr('(t > 13) en (x <= 2)')), 't > 13 en x <= 2');
        assert.equal(stapper.expr_text(expr('niet (a of b)')), 'niet (a of b)');
        assert.equal(stapper.expr_text(expr('waar')), 'waar');
    });

    it('substitute: getallen ingevuld, met komma en ×', function() {
        assert.equal(stapper.substitute(expr('v + a*dt'), {v: 0.981, a: 9.78, dt: 0.1}), '0,981 + 9,78 × 0,1');
        assert.equal(stapper.substitute(expr('t > 13'), {t: 0.3}), '0,3 > 13');
    });

    it('substitute: negatieve getallen tussen haakjes', function() {
        assert.equal(stapper.substitute(expr('v + a*dt'), {v: 0, a: -9.81, dt: 0.1}), '0 + (-9,81) × 0,1');
        assert.equal(stapper.substitute(expr('x'), {x: -2}), '-2');
        assert.equal(stapper.substitute(expr('x^2'), {x: -2}), '(-2)^2');
    });

    it('substitute: opmaak van getallen kan worden meegegeven', function() {
        var fmt = function(x) { return x.toFixed(2); };
        assert.equal(stapper.substitute(expr('a*b'), {a: 1, b: 2}, fmt), '1.00 × 2.00');
    });

    it('program_text: los van witruimte en commentaar', function() {
        var a = parse('a=1', "x = x+1 ' commentaar\nals x>3 dan\n stop\neindals").modelregels_ast;
        var b = parse('a=1', "// ander commentaar\nx=x + 1\nals (x > 3) dan stop eindals").modelregels_ast;
        assert.equal(stapper.program_text(a), stapper.program_text(b));
    });
});

describe('stapper.js - stap voor stap', function() {

    it('eerste stap: iteratie 1, regel 2, met de berekening in getallen', function() {
        var s = stepper(CHAMPIGNON_START, CHAMPIGNON, 500);
        var step = s.step();
        assert.equal(step.iteration, 1);
        assert.equal(step.line, 2);
        assert.equal(step.name, 'Fz');
        assert.equal(step.text, 'iteratie 1, regel 2:  Fz = m*9,81  →  Fz = 91 × 9,81 = 892,7');
    });

    it('v = v + a*dt met ingevulde getallen (waarden van voor de regel)', function() {
        var s = stepper(CHAMPIGNON_START, CHAMPIGNON, 500);
        var step;
        for (var i = 0; i < 9 + 5; i++) step = s.step();   // iteration 2, line 6
        assert.equal(step.iteration, 2);
        assert.equal(step.line, 6);
        assert.equal(step.text, 'iteratie 2, regel 6:  v = v + a*dt  →  v = 0,981 + 9,807 × 0,1 = 1,962');
    });

    it('als ... dan: onwaar slaat de regel over', function() {
        var s = stepper(CHAMPIGNON_START, CHAMPIGNON, 500);
        var step;
        for (var i = 0; i < 7; i++) step = s.step();
        assert.equal(step.kind, 'cond');
        assert.equal(step.line, 8);
        assert.isFalse(step.value);
        assert.equal(step.text, 'iteratie 1, regel 8:  als t > 13  →  0 > 13 is onwaar: regel 9 wordt overgeslagen');
    });

    it('één iteratie van examenvwo2005 is 9 stappen en geeft dezelfde rij als Run', function() {
        var s = stepper(CHAMPIGNON_START, CHAMPIGNON, 500);
        var steps = [];
        for (var i = 0; i < 9; i++) steps.push(s.step());
        assert.deepEqual(steps.map(function(st) { return st.line; }), [2, 3, 4, 5, 6, 7, 8, 11, 14]);
        assert.isTrue(steps[8].end_of_iteration);
        assert.isFalse(steps[7].end_of_iteration);
        assert.equal(s.rows.length, 2);
        assert.deepEqual(s.rows, run(CHAMPIGNON_START, CHAMPIGNON, 1).result);
    });

    it('stap voor stap geeft precies dezelfde tabel als Run', function() {
        var s = stepper(CHAMPIGNON_START, CHAMPIGNON, 200);
        while (!s.finished) s.step();
        assert.deepEqual(s.rows, run(CHAMPIGNON_START, CHAMPIGNON, 200).result);
    });

    it('als ... dan: waar voert de regels erin uit, als aparte stappen', function() {
        var s = stepper('x = 5', 'als x > 3 dan\n  x = x - 1\n  y = 2\neindals\nz = x');
        var step = s.step();
        assert.isTrue(step.value);
        assert.equal(step.text, 'iteratie 1, regel 1:  als x > 3  →  5 > 3 is waar: regels 2 t/m 3 worden uitgevoerd');
        assert.equal(s.step().line, 2);
        assert.equal(s.step().line, 3);
        step = s.step();
        assert.equal(step.line, 5);
        assert.isTrue(step.end_of_iteration);
    });

    it('als ... anders: onwaar voert het anders-deel uit', function() {
        var s = stepper('x = 1', 'als x > 3 dan\n  y = 1\nanders\n  y = 2\neindals');
        var step = s.step();
        assert.match(step.text, /is onwaar: regel 4 \(anders\) wordt uitgevoerd$/);
        step = s.step();
        assert.equal(step.line, 4);
        assert.equal(step.value, 2);
    });

    it('tabel: tijdens een iteratie staat de halve rij erbij', function() {
        var s = stepper('x = 0\nt = 0', 'x = x + 2\nt = t + 1');
        assert.equal(s.table().length, 1);
        s.step();
        assert.equal(s.table().length, 2);
        assert.equal(s.table()[1][s.varNames.indexOf('x')], 2);
        assert.equal(s.table()[1][s.varNames.indexOf('t')], 0);
        s.step();
        assert.equal(s.table().length, 2);
        assert.equal(s.rows.length, 2);
    });

    it('stop: het stappen is klaar, net als bij Run', function() {
        var start = 't = 0\ndt = 1';
        var regels = 't = t + dt\nals t >= 3 dan\n  stop\neindals';
        var s = stepper(start, regels, 100);
        var step;
        while (!s.finished) step = s.step();
        assert.equal(step.kind, 'stop');
        assert.isTrue(s.stopped);
        assert.isNull(s.step());
        assert.deepEqual(s.rows, run(start, regels, 100).result);
    });

    it('na N iteraties is het stappen klaar', function() {
        var s = stepper('x = 0', 'x = x + 1', 3);
        var step;
        while (!s.finished) step = s.step();
        assert.equal(step.iteration, 3);
        assert.equal(s.rows.length, 4);
    });

    it('sin en cos in graden, zoals bij Run', function() {
        var s = stepper('a = 30', 'y = sin(a)');
        assert.closeTo(s.step().value, 0.5, 1e-12);
    });
});
