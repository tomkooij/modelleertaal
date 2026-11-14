var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

var evaluator_js = require("../evaluator.js");

function value_of(expression) {
    // value of an expression in the modelleertaal (decimal comma allowed)
    var model = new evaluator_js.Model();
    model.startwaarden = "z = 0";
    model.modelregels = "y = " + expression;
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(1, true, false);
    evaluator.run();
    return evaluator.result[1][evaluator.namespace.varNames.indexOf('y')];
}

function number(text) {
    return parseFloat(text.replace(',', '.'));
}

describe('evaluator.FUNCTIONS - lijst met functies (gh-54)', function() {

    var listed = [];
    evaluator_js.FUNCTIONS.forEach(function(row) { listed = listed.concat(row[0]); });

    it('elke functie in de codegenerator staat in de lijst, en omgekeerd', function() {
        var source = fs.readFileSync(path.join(__dirname, '..', 'evaluator.js'), 'utf8');
        var block = source.slice(source.indexOf("switch(node.func"), source.indexOf("Onbekende functie"));
        var implemented = [];
        var re = /case '(\w+)':/g, m;
        while ((m = re.exec(block)) !== null) implemented.push(m[1]);
        assert.isAbove(implemented.length, 20);
        assert.sameMembers(listed, implemented);
    });

    it('elke functie werkt in een model', function() {
        listed.forEach(function(name) {
            var arg = (name == 'min' || name == 'max') ? '1; 2' : '0,5';
            assert.isNumber(value_of(name + '(' + arg + ')'), name);
        });
    });

    it('de voorbeelden in de lijst kloppen', function() {
        evaluator_js.FUNCTIONS.forEach(function(row) {
            var parts = row[1].split(' = ');
            var expected = number(parts[1]);
            var tolerance = Math.max(0.01, Math.abs(expected) * 0.005);
            assert.closeTo(value_of(parts[0]), expected, tolerance, row[1]);
        });
    });

    it('een onbekende functie geeft een foutmelding met een tip', function() {
        assert.throws(function() { value_of('k(2)'); }, /Onbekende functie 'k/);
    });
});
