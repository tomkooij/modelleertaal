var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

var evaluator_js = require("../evaluator.js");
var autoplot = require("../autoplot.js");

function run(startwaarden, modelregels, N) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    return run_model(model, N);
}

function run_model(model, N) {
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(N || 100, true, false);
    evaluator.run();
    return autoplot.analyse(evaluator.namespace.varNames, evaluator.result, evaluator.modelregels_ast);
}

function graph_names(analysis) {
    return analysis.graphs.map(function(g) { return g.y + ',' + g.x; });
}

describe('autoplot.js - kies automatisch relevante grafieken', function() {

    it('valbeweging: x,t eerst, dan v,t en a,t. Constanten en stapjes niet', function() {
        var analysis = run("m=80\nk=0.3\nv=0\nx=0\nt=0\ndt=0.1",
            "Fz = m*9.81\nFw = k*v^2\nFres = Fz - Fw\na = Fres/m\ndv = a*dt\nv = v + dv\nx = x + v*dt\nt = t + dt");
        assert.equal(analysis.time, 't');
        assert.deepEqual(graph_names(analysis), ['x,t', 'v,t', 'a,t', 'Fres,t', 'Fw,t']);
    });

    it('herkent toestandsvariabelen (x = x + ...) ook met onbekende namen', function() {
        var analysis = run("Q=100\nC=4\ntijd=0\nstap=1\nTemp=80",
            "P = 2*(Temp - 20)\nQ = Q - P*stap\nTemp = Q/C\ntijd = tijd + stap");
        assert.equal(analysis.time, 'tijd');
        assert.equal(graph_names(analysis)[0], 'Q,tijd');
        assert.isTrue(analysis.info.Q.integrator);
        assert.isFalse(analysis.info.P.integrator);
    });

    it('baan: y,x diagram eerst als x en y allebei veranderen', function() {
        var analysis = run("x=0\ny=2\nvx=3\nvy=4\ng=9.81\nt=0\ndt=0.01",
            "x = x + vx*dt\ny = y + vy*dt\nvy = vy - g*dt\nt = t + dt");
        assert.deepEqual(graph_names(analysis), ['y,x', 'x,t', 'y,t', 'vy,t']);
    });

    it('groei: N,t', function() {
        var analysis = run("N=1000\nt=0\ndt=1\nk=0.1", "dN = -k*N*dt\nN = N + dN\nt = t + dt");
        assert.deepEqual(graph_names(analysis), ['N,t']);
    });

    it('integrator in als..dan wordt gevonden', function() {
        var assignments = autoplot.find_assignments(
            new evaluator_js.ModelregelsEvaluator({startwaarden: 'a=1', modelregels: 'als a > 0 dan a = a + 1 anders b = 2 eindals'}).modelregels_ast, []);
        assert.deepEqual(assignments, [{name: 'a', integrator: true, conditional: true},
                                       {name: 'b', integrator: false, conditional: true}]);
    });

    it('model zonder tijd: gebruik eerste variabele als x-as', function() {
        var analysis = run("x=0\nv=1", "x = x + v\nE = x^2");
        assert.equal(analysis.time, null);
        assert.deepEqual(graph_names(analysis), ['E,x']);
    });

    it('niet meer dan 8 grafieken', function() {
        var regels = "t = t + dt\n";
        for (var i = 0; i < 20; i++) regels += "p" + i + " = t * " + (i + 1) + "\n";
        var analysis = run("t=0\ndt=1", regels);
        assert.equal(analysis.graphs.length, 8);
    });

    it('alle meegeleverde modellen (zonder ...) geven minstens een grafiek', function() {
        var folder = path.join(__dirname, '..', 'modellen');
        var count = 0;
        fs.readdirSync(folder).forEach(function(fn) {
            if (!/\.xml$/.test(fn) || fn == 'leeg.xml') return;
            var model = new evaluator_js.Model();
            model.readBogusXMLFile(path.join(folder, fn));
            if (/\.\.\.|…/.test(model.modelregels + model.startwaarden)) return; // in te vullen door leerling
            var analysis = run_model(model, 500);
            assert.isAbove(analysis.graphs.length, 0, fn);
            assert.isNotNull(analysis.time, fn);
            count += 1;
        });
        assert.isAbove(count, 5);
    });
});

describe('evaluator.js - foutmeldingen en stop', function() {

    function error_of(startwaarden, modelregels) {
        try {
            run(startwaarden, modelregels, 1);
        } catch (err) {
            return err;
        }
        return null;
    }

    it('operator precedence: t + dt > 10 is (t + dt) > 10', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "t=5\ndt=1\nr=0";
        model.modelregels = "als t + dt > 10 dan r = 1 anders r = 2 eindals";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(1, true, false);
        evaluator.run();
        assert.equal(evaluator.result[1][0], 2);
    });

    it('min(a+1; b), 2 - -x en als x = 3 dan', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "a=3\nb=10";
        model.modelregels = "c = min(a+1; b)\nd = 2 - -a\nals a = 3 dan e = 1 anders e = 0 eindals";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(1, true, false);
        evaluator.run();
        assert.deepEqual(evaluator.result[1], [4, 5, 1]);
    });

    it('stop wordt gemeld', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "t=0";
        model.modelregels = "t = t + 1\nals t > 4 dan stop eindals";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(100, true, false);
        evaluator.run();
        assert.isTrue(evaluator.stopped);
        assert.isBelow(evaluator.result.length, 10);
    });

    it('na stop wordt niet verder gerekend (iteraties toevoegen of debugger)', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "t=0";
        model.modelregels = "t = t + 1\nals t > 4 dan stop eindals";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(100, true, false);
        evaluator.run();
        var rows = evaluator.result.length;
        evaluator.set_state(10, false, false);
        evaluator.run();
        assert.equal(evaluator.result.length, rows);
        evaluator.set_state(1, false, true);
        evaluator.run();
        assert.equal(evaluator.result.length, rows);
        assert.isTrue(evaluator.stopped);
    });

    it('debugger: een regel uitvoeren is geen stop', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "t=0";
        model.modelregels = "t = t + 1\nx = 2 * t";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(1, true, true);
        evaluator.run();
        assert.isFalse(evaluator.stopped);
        evaluator.set_state(1, false, true);
        evaluator.run();
        assert.isFalse(evaluator.stopped);
        assert.deepEqual(evaluator.result[1], [1, 2]);
    });

    it('zonder stop: stopped is onwaar', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "t=0";
        model.modelregels = "t = t + 1\nals t > 400 dan stop eindals";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(10, true, false);
        evaluator.run();
        assert.isFalse(evaluator.stopped);
        assert.equal(evaluator.result.length, 11);
    });

    it('ontbrekende startwaarde: melding met regelnummer en naam', function() {
        var err = error_of("a=2", "b = 1\nd = a + k");
        assert.equal(err.parser_name, 'modelregels');
        assert.equal(err.parser_line, 2);
        assert.include(err.message, "'k'");
    });

    it('typefout in variabele: suggestie', function() {
        assert.include(error_of("Fz=2", "d = fz").message, "Bedoel je 'Fz'");
    });

    it('ontbrekende eindals', function() {
        assert.include(error_of("a=2", "als a > 1 dan\n d = 1\n").message, "eindals");
    });

    it('onaffe regel: de regel zelf wordt aangewezen, niet de volgende', function() {
        var err = error_of("a=2", "b = a +\nc = 2\nd = 3");
        assert.equal(err.parser_line, 1);
        err = error_of("a=2", "als a > 1\n\n  c = 2\neindals");
        assert.equal(err.parser_line, 1);
        assert.include(err.message, "'dan'");
        err = error_of("a=2", "b\nc = 2");
        assert.equal(err.parser_line, 1);
        // fout midden in de regel: regel zelf
        err = error_of("a=2", "b = 1\nc = 2 3\nd = 3");
        assert.equal(err.parser_line, 2);
        err = error_of("a=2", "b = 1\neindals");
        assert.equal(err.parser_line, 2);
    });

    it('fout in startwaarden', function() {
        var err = error_of("a=2\nb = 3 +* 2", "d = a");
        assert.equal(err.parser_name, 'startwaarden');
        assert.equal(err.parser_line, 2);
    });
});
