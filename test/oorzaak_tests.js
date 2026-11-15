var assert = require('chai').assert;

var evaluator_js = require("../evaluator.js");
var oorzaak = require("../oorzaak.js");

function run(startwaarden, modelregels, N) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(N || 100, true, false);
    evaluator.run();
    var varNames = evaluator.namespace.varNames;
    var results = evaluator.result;
    // the first row without a valid number (as check_results in the app)
    for (var i = 1; i < results.length; i++) {
        for (var j = 0; j < varNames.length; j++) {
            if (typeof results[i][j] == 'number' && !isFinite(results[i][j])) {
                return oorzaak.find(evaluator.modelregels_ast, varNames, results, i);
            }
        }
    }
    return 'geen fout';
}

describe('oorzaak.js - waarom heeft een variabele geen geldige waarde meer?', function() {

    it('delen door nul', function() {
        var cause = run("m = 2\nv = 0\nt = 0\ndt = 0,1", "m = m - 1\na = 10/m\nv = v + a*dt\nt = t + dt", 10);
        assert.deepEqual(cause, {kind: 'deling', name: 'm'});
    });

    it('delen door een constante die 0 is (staat niet in de tabel)', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "m = 0\nF = 10\nv = 0\nt = 0\ndt = 0,1";
        model.modelregels = "a = F/m\nv = v + a*dt\nt = t + dt";
        var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
        evaluator.set_state(5, true, false);
        evaluator.run();
        var varNames = evaluator.namespace.varNames;
        assert.equal(varNames.indexOf('m'), -1);
        assert.deepEqual(oorzaak.find(evaluator.modelregels_ast, varNames, evaluator.result, 1, {m: 0, F: 10}),
                         {kind: 'deling', name: 'm'});
    });

    it('wortel uit een negatief getal', function() {
        var cause = run("h = 1\nt = 0\ndt = 0,1", "h = h - 0,3\nv = sqrt(h)\nt = t + dt", 10);
        assert.equal(cause.kind, 'wortel');
        assert.equal(cause.name, 'h');
    });

    it('steeds groter (dt te groot)', function() {
        var cause = run("x = 1\nt = 0\ndt = 1", "x = x + x^2*dt\nt = t + dt", 50);
        assert.equal(cause.kind, 'groei');
    });

    it('meldingen', function() {
        assert.match(oorzaak.message({kind: 'deling', name: 'm'}, 16, 'a'), /^Vanaf iteratie 16 heeft 'a'.*gedeeld door nul: 'm' is 0/);
        assert.match(oorzaak.message({kind: 'groei', name: 'x'}, 3, 'x'), /dt te groot/);
        assert.match(oorzaak.message(null, 3, 'x'), /gedeeld door nul, de wortel/);
    });
});
