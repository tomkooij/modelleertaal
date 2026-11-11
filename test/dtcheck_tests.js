var assert = require('chai').assert;

var evaluator_js = require("../evaluator.js");
var autoplot = require("../autoplot.js");
var dtcheck = require("../dtcheck.js");

function check(startwaarden, modelregels, N) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(N, true, false);
    evaluator.run();
    var varNames = evaluator.namespace.varNames;
    return dtcheck.check(model, N, {
        results: evaluator.result,
        varNames: varNames,
        stopped: evaluator.stopped,
        runtime_ms: evaluator.runtime_ms,
        analysis: autoplot.analyse(varNames, evaluator.result, evaluator.modelregels_ast)
    });
}

var CHAMPIGNON = "Fz = m * 9,81\nFw = k * Opp * v^2\nFr = Fz - Fw\na = Fr/m\nv = v + a*dt\nx = x + v*dt\n" +
    "als t > 13 dan\n    Opp = Opp + dOpp\neindals\nals Opp > 42,6 dan\n    Opp = 42,6\neindals\nt = t + dt\n";

function champignon(dt) {
    return "m = 91\nk = 0,37\nOpp = 0,8\nv = 0\nx = 0\nt = 0\ndOpp = 1,1\ndt = " + dt;
}

describe('dtcheck.js - is dt klein genoeg?', function() {

    it('examenvwo2005 met dt = 1: melding', function() {
        var r = check(champignon('1'), CHAMPIGNON, 50);
        assert.isNotNull(r);
        assert.equal(r.kind, 'end');
        assert.equal(r.name, 'x');
        assert.equal(r.dt_half, 0.5);
        assert.match(dtcheck.message(r),
            /^De uitkomst hangt nog af van de tijdstap: met dt = 0,5 eindigt x op [0-9,]+ in plaats van [0-9,]+\. Probeer een kleinere dt\.$/);
    });

    it('examenvwo2005 met dt = 0,1 en dt = 0,01: geen melding', function() {
        assert.isNull(check(champignon('0,1'), CHAMPIGNON, 500));
        assert.isNull(check(champignon('0,01'), CHAMPIGNON, 5000));
    });

    it('trilling met grote dt: melding', function() {
        var r = check("m = 1\nC = 40\nu = 1\nv = 0\nt = 0\ndt = 0,05",
                      "F = -C*u\na = F/m\nv = v + a*dt\nu = u + v*dt\nt = t + dt", 200);
        assert.isNotNull(r);
    });

    it('stop: vergelijk de tijd waarop het model stopt', function() {
        // free fall from 5 m: with dt = 0,4 the model stops at t = 1,2, with dt = 0,2 at t = 1,0
        var start = "h = 5\nv = 0\nt = 0\ndt = 0,4";
        var regels = "a = 9,81\nv = v + a*dt\nh = h - v*dt\nt = t + dt\nals h < 0 dan\n stop\neindals";
        var r = check(start, regels, 1000);
        assert.isNotNull(r);
        assert.equal(r.kind, 'stop');
        assert.equal(r.name, 't');
        assert.match(dtcheck.message(r), /stopt het model bij t = /);
        assert.isNull(check(start.replace('dt = 0,4', 'dt = 0,001'), regels, 10000));
    });

    it('geen dt in de startwaarden: geen controle', function() {
        assert.isNull(check("x = 1\nn = 0", "x = x*1,5\nn = n + 1", 20));
    });

    it('dt verandert in de modelregels: geen controle', function() {
        assert.isNull(check("x = 0\nt = 0\ndt = 1", "x = x + t*dt\nt = t + dt\ndt = dt*1,1", 20));
    });

    it('meer dan 100 000 iteraties: geen controle', function() {
        assert.isNull(check(champignon('1'), CHAMPIGNON, 100001));
    });

    it('dt wordt gehalveerd vlak na de startwaarde, ook als andere startwaarden dt gebruiken', function() {
        // n = 1/dt: with dt/2 the model does not change (exact, no warning)
        var r = check("x = 0\nt = 0\ndt = 0,5\nv = 2", "x = x + v*dt\nt = t + dt", 20);
        assert.isNull(r);
    });
});
