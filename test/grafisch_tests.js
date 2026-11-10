var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

var evaluator_js = require("../evaluator.js");
var grafisch = require("../grafisch.js");

function analyse(startwaarden, modelregels) {
    var model = new evaluator_js.Model();
    model.startwaarden = startwaarden;
    model.modelregels = modelregels;
    var ev = new evaluator_js.ModelregelsEvaluator(model, false);
    return grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
}

function kinds(g) {
    var out = {};
    g.order.forEach(function(id) {
        var el = g.elements[id];
        (out[el.kind] = out[el.kind] || []).push(el.name || el.label);
    });
    return out;
}

describe('grafisch.js - tekstmodel naar grafisch model', function() {

    it('valbeweging: toestanden, stromen, hulpvariabelen en constanten', function() {
        var g = analyse("m=80\nk=0.3\nv=0\nx=0\nt=0\ndt=0.1",
            "Fz = m*9.81\nFw = k*v^2\nFres = Fz - Fw\na = Fres/m\ndv = a*dt\nv = v + dv\nx = x + v*dt\nt = t + dt");
        var k = kinds(g);
        assert.equal(g.time, 't');
        assert.equal(g.dt, 'dt');
        assert.deepEqual(k.stock, ['v', 'x']);
        assert.deepEqual(k.flow, ['dv', 'v']);
        assert.deepEqual(k.aux, ['Fz', 'Fw', 'Fres', 'a']);
        assert.deepEqual(k['const'], ['m', 'k']);
        assert.isUndefined(k.time, 't wordt niet gebruikt: niet tekenen');
        assert.equal(g.elements.dv.to, 'v');
        assert.equal(g.elements.dv.rate, 'a');
        assert.isTrue(g.links.some(function(l) { return l.from == 'a' && l.to == 'dv'; }));
        assert.isTrue(g.links.some(function(l) { return l.from == 'v' && l.to == 'Fw'; }));
    });

    it('v = v + a*dt: a wordt de stroom', function() {
        var g = analyse("m=1\nF=2\nv=0\nt=0\ndt=0.1", "a = F/m\nv = v + a*dt\nt = t + dt");
        assert.equal(g.elements.a.kind, 'flow');
        assert.equal(g.elements.a.to, 'v');
        assert.equal(g.elements.a.definition, 'F/m');
    });

    it('stroom van de ene naar de andere toestand (SIR)', function() {
        var g = analyse("S=990\nI=10\nR=0\nb=0.3\nc=0.1\nN=1000\nt=0\ndt=0.1",
            "besmet = b*S*I/N*dt\nbeter = c*I*dt\nS = S - besmet\nI = I + besmet - beter\nR = R + beter\nt = t + dt");
        assert.equal(g.elements.besmet.from, 'S');
        assert.equal(g.elements.besmet.to, 'I');
        assert.equal(g.elements.beter.from, 'I');
        assert.equal(g.elements.beter.to, 'R');
        assert.equal(g.flows.length, 2);
    });

    it('voorval, stopvoorwaarde, onbekende variabele en t', function() {
        var g = analyse("h=10\nv=0\ng=9.81\nt=0\ndt=0.01",
            "v = v - g*dt\nh = h + v*dt\nals h < 0 dan v = -0.8*v eindals\nF = k*sin(t)\nals t > 10 dan stop eindals\nt = t + dt");
        var k = kinds(g);
        assert.equal(k.event.length, 1);
        assert.equal(g.elements['~e1'].condition, 'h < 0');
        assert.deepEqual(g.elements['~e1'].targets, ['v']);
        assert.deepEqual(g.stops, ['t > 10']);
        assert.deepEqual(k.unknown, ['k']);
        assert.deepEqual(k.time, ['t']);
        assert.equal(g.elements['~f1'].from, 'v', 'v = v - g*dt: g stroomt uit v');
    });

    it('beginwaarde-formules geven pijlen; vy staat links van y', function() {
        var g = analyse("v0=12\nalfa=45\nvx=v0*cos(alfa)\nvy=v0*sin(alfa)\ng=9.81\nx=0\ny=2\nt=0\ndt=0.01",
            "x = x + vx*dt\ny = y + vy*dt\nvy = vy - g*dt\nt = t + dt");
        var has = function(from, to, kind) {
            return g.links.some(function(l) { return l.from == from && l.to == to && l.kind == kind; });
        };
        assert.isTrue(has('v0', 'vx', 'relation'), 'constante met formule');
        assert.isTrue(has('alfa', 'vy', 'initial'), 'beginwaarde van een toestandsvariabele');
        var pos = grafisch.layout(g).pos;
        assert.isBelow(pos.vy.x, pos.y.x);
    });

    it('variabele alleen in de voorwaarde: lichtere pijl', function() {
        var g = analyse("x=0\nk=1\nt=0\ndt=1", "als x > 5 dan F = 2*k eindals\nx = x + F*dt\nt = t + dt");
        assert.isTrue(g.links.some(function(l) { return l.from == 'x' && l.to == 'F' && l.kind == 'condition'; }));
        assert.isTrue(g.links.some(function(l) { return l.from == 'k' && l.to == 'F' && l.kind == 'relation'; }));
    });

    it('verplaatste elementen: pijp en pijlen volgen de nieuwe posities', function() {
        var g = analyse("S=990\nI=10\nb=0.3\nN=1000\nt=0\ndt=0.1",
            "besmet = b*S*I/N*dt\nS = S - besmet\nI = I + besmet\nt = t + dt");
        var lay = grafisch.layout(g);
        lay.pos.besmet.x = 123;
        lay.pos.besmet.y = 77;
        var opts = {};
        var svg = grafisch.toSVG(g, lay, opts);
        assert.include(svg, 'data-id="besmet"');
        assert.include(svg, 'data-id="S"');
        assert.include(svg, ' L123,77 ', 'pijp loopt via het verplaatste kraantje');
        assert.isAbove(opts.used.maxY, 77);
        // bounds only grow
        var svg2 = grafisch.toSVG(g, grafisch.layout(g), {bounds: opts.used});
        assert.equal(svg2.match(/viewBox="([^"]*)"/)[1], svg.match(/viewBox="([^"]*)"/)[1]);
    });

    it('alle voorbeeldmodellen geven een SVG', function() {
        fs.readdirSync('modellen').filter(function(f) {
            return /\.xml$/.test(f) && f != 'leeg.xml';
        }).forEach(function(f) {
            var model = new evaluator_js.Model();
            model.readBogusXMLFile(path.join('modellen', f));
            var ev = new evaluator_js.ModelregelsEvaluator(model, false);
            var svg = grafisch.toSVG(grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast));
            assert.match(svg, /^<svg[^>]*viewBox="-?\d+ -?\d+ \d+ \d+"/, f);
            assert.notMatch(svg, /NaN|undefined/, f);
        });
    });
});
