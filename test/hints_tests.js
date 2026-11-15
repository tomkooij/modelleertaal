var assert = require('chai').assert;

var evaluator_js = require("../evaluator.js");
var hints = require("../hints.js");

function find(startwaarden, modelregels) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    return hints.find(evaluator.startwaarden_ast, evaluator.modelregels_ast).map(function(h) {
        return h.kind + ':' + h.name;
    });
}

var REGELS = "Fw = k*v^2\na = (m*9,81 - Fw)/m\nv = v + a*dt\nt = t + dt";
var START = "m = 91\nk = 0,37\nv = 0\nt = 0\ndt = 0,1";

describe('hints.js - hints bij veelgemaakte modelfouten', function() {

    it('een goed model: geen hints', function() {
        assert.deepEqual(find(START, REGELS), []);
    });

    it('de tijd loopt niet', function() {
        assert.deepEqual(find(START, "Fw = k*v^2\na = (m*9,81 - Fw)/m\nv = v + a*dt"), ['tijd:t']);
    });

    it('geen t of geen dt: geen hint over de tijd', function() {
        assert.deepEqual(find("x = 0\nds = 1\ns = 0", "x = x + ds\ns = s + ds"), []);
    });

    it('een startwaarde die nergens wordt gebruikt', function() {
        assert.deepEqual(find(START + "\nCw = 0,8", REGELS), ['ongebruikt:Cw']);
    });

    it('gebruikt in een andere startwaarde of in print telt als gebruikt', function() {
        assert.deepEqual(find(START + "\nr = 2\nA = pi*r^2", REGELS + "\nprint(A)"), []);
    });

    it('een startwaarde die wordt overschreven voordat hij gebruikt wordt', function() {
        assert.deepEqual(find(START + "\na = 0", REGELS), ['overschreven:a']);
    });

    it('eerst gebruikt, dan overschreven: geen hint', function() {
        assert.deepEqual(find(START + "\nFw = 0", "v = v + Fw/m*dt\nFw = k*v^2\nt = t + dt"), []);
    });

    it('alleen overschreven binnen als ... dan telt niet', function() {
        assert.deepEqual(find(START + "\na = 9,81",
            "als t > 1 dan a = 0 eindals\nv = v + a*dt\nt = t + dt"), ['ongebruikt:m', 'ongebruikt:k']);
    });
});
