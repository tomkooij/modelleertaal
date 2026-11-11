var assert = require('chai').assert;

var evaluator_js = require("../evaluator.js");
var vergelijk = require("../vergelijk.js");

function source(startwaarden, modelregels, N) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    return vergelijk.source(evaluator.startwaarden_ast, evaluator.modelregels_ast, N || 100);
}

function describe_diff(a, b) {
    return vergelijk.describe(vergelijk.differences(a, b));
}

var REGELS = "Fw = k*v^2\na = (m*9,81 - Fw)/m\nv = v + a*dt\nt = t + dt";
var START = "m = 91\nk = 0,37\nv = 0\nt = 0\ndt = 0,1";

describe('vergelijk.js - wat is er anders dan bij de vorige run?', function() {

    it('één startwaarde gewijzigd', function() {
        var a = source(START, REGELS);
        var b = source(START.replace('k = 0,37', 'k = 0,50'), REGELS);
        assert.equal(describe_diff(a, b), 'k = 0,37 → nu 0,50');
    });

    it('witruimte en commentaar tellen niet mee', function() {
        var a = source(START, REGELS);
        var b = source("m=91 ' massa\nk = 0,37 // [kg/m]\n\nv = 0\nt = 0\ndt =   0,1", "'model\n" + REGELS);
        assert.equal(describe_diff(a, b), 'hetzelfde model');
    });

    it('meerdere startwaarden', function() {
        var a = source(START, REGELS);
        var b = source(START.replace('k = 0,37', 'k = 0,5').replace('m = 91', 'm = 80'), REGELS);
        assert.equal(describe_diff(a, b), 'm = 91 → nu 80; k = 0,37 → nu 0,5');
    });

    it('nieuwe en weggehaalde startwaarden', function() {
        var a = source(START, REGELS);
        var b = source(START.replace('m = 91\n', '') + '\nm = 91\nc = 3', REGELS);
        assert.equal(describe_diff(a, b), 'c = 3 is nieuw');
        var c = source(START + '\nc = 3', REGELS);
        assert.equal(describe_diff(c, a), 'c is weggehaald');
    });

    it('meer dan drie verschillen: model gewijzigd', function() {
        var a = source(START, REGELS);
        var b = source("m = 1\nk = 2\nv = 3\nt = 4\ndt = 0,1", REGELS);
        assert.equal(describe_diff(a, b), 'model gewijzigd');
    });

    it('gewijzigde modelregels: model gewijzigd', function() {
        var a = source(START, REGELS);
        var b = source(START, REGELS.replace('k*v^2', 'k*v'));
        assert.equal(describe_diff(a, b), 'model gewijzigd');
    });

    it('ander aantal iteraties', function() {
        var a = source(START, REGELS, 100);
        var b = source(START, REGELS, 200);
        assert.equal(describe_diff(a, b), 'iteraties 100 → nu 200');
        var c = source(START.replace('k = 0,37', 'k = 0,4'), REGELS, 200);
        assert.equal(describe_diff(a, c), 'k = 0,37 → nu 0,4; iteraties 100 → nu 200');
    });
});
