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
        // dv = a*dt ; v = v + dv: a is the flow (ventiel a, as in the exam 2018-I)
        assert.deepEqual(k.flow, ['a', 'v']);
        assert.deepEqual(k.aux, ['Fz', 'Fw', 'Fres']);
        assert.deepEqual(k['const'], ['m', 'k']);
        assert.isUndefined(k.time, 't wordt niet gebruikt: niet tekenen');
        assert.equal(g.elements.a.to, 'v');
        assert.equal(g.elements.a.step, 'dv');
        assert.equal(g.elements.a.definition, 'Fres/m');
        assert.isUndefined(g.elements.dv);
        assert.isTrue(g.links.some(function(l) { return l.from == 'Fres' && l.to == 'a'; }));
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

    it('twee stijlen: examen (standaard) en kleur', function() {
        var g = analyse("x=0\nk=0.5\nm=2\nt=0\ndt=0.1", "F = k * x\nx = x - F/m*dt\nt = t + dt");
        var examen = grafisch.toSVG(g);
        assert.equal(grafisch.toSVG(g, undefined, {stijl: 'examen'}), examen);
        assert.equal(grafisch.toSVG(g, undefined, {stijl: 'onbekend'}), examen, 'onbekende stijl: examen');
        assert.include(examen, 'fill="#d4d4d4"', 'grijze achtergrond');
        assert.notInclude(examen, 'stroke-dasharray="3 2.5"', 'geen symbool voor buiten het model');
        var kleur = grafisch.toSVG(g, undefined, {stijl: 'kleur'});
        // kleur: colors of Coach 7, blue symbols and red relatiepijlen
        assert.include(kleur, '#1f5fa8');
        assert.include(kleur, 'stroke="#c62828"', 'rode relatiepijlen');
        assert.include(kleur, 'stroke-dasharray="3 2.5"', 'stroom naar buiten: gestippelde cirkel');
        // Coach 7: hulpvariabele is a circle, constante a circle with a line segment on each side
        var symbol = function(svg, id) { return svg.split('data-id="' + id + '"')[1].split('</g>')[0]; };
        assert.include(symbol(kleur, 'F'), '<circle', 'hulpvariabele: cirkel');
        assert.notInclude(symbol(kleur, 'F'), ' H', 'hulpvariabele: geen streepjes');
        assert.include(symbol(kleur, 'k'), '<circle', 'constante: cirkel');
        assert.match(symbol(kleur, 'k'), /<path d="M[^"]* H[^"]* M[^"]* H[^"]*"/, 'constante: streepjes links en rechts');
        // the same elements, in both styles
        ['x', 'k', 'm', 'F', '~f1:dst'].forEach(function(id) {
            assert.include(examen, 'data-id="' + id + '"');
            assert.include(kleur, 'data-id="' + id + '"');
        });
    });

    it('regels bij elk element (symbool <-> modelregel)', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "m=80\nk=0.3\nv=0\nx=0\nt=0\ndt=0.1";
        model.modelregels = "Fw = k*v^2\na = (m*9.81 - Fw)/m\nv = v + a*dt\nx = x + v*dt\n" +
            "als x > 100 dan\n  v = 0\neindals\nt = t + dt";
        var ev = new evaluator_js.ModelregelsEvaluator(model, false);
        var g = grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
        var ln = grafisch.lines(g, ev.startwaarden_ast, ev.modelregels_ast);
        assert.deepEqual(ln.byElement.Fw, {startwaarden: [], modelregels: [1]});
        assert.deepEqual(ln.byElement.k, {startwaarden: [2], modelregels: []});
        assert.deepEqual(ln.byElement.v, {startwaarden: [3], modelregels: [3]});
        assert.deepEqual(ln.byElement.a.modelregels, [2, 3], 'a = ... en v = v + a*dt');
        // x = x + v*dt: unnamed flow, written in the line of x
        var anon = g.flows.filter(function(f) { return !f.name; })[0];
        assert.deepEqual(ln.byElement[anon.id].modelregels, [4]);
        assert.equal(ln.byLine['modelregels:4'], 'x');
        // v = 0 inside als ... dan: the voorval
        var event = g.order.filter(function(id) { return g.elements[id].kind == 'event'; })[0];
        assert.deepEqual(ln.byElement[event].modelregels, [6]);
        assert.equal(ln.byLine['modelregels:6'], event);
        assert.equal(ln.byLine['startwaarden:1'], 'm');
        assert.isUndefined(ln.byLine['startwaarden:6'], 'dt is geen element');
    });

    it('herkende elementen: tabel met soort, naam, definitie en id', function() {
        var g = analyse("m=1\nv=0\nt=0\ndt=0.1", "a = 9.81/m\nv = v + a*dt\nals v > 5 dan stop eindals\nt = t + dt");
        var rows = grafisch.table(g);
        var v = rows.filter(function(r) { return r.name == 'v'; })[0];
        assert.equal(v.kind, 'Toestandsvariabele');
        assert.equal(v.id, 'v');
        assert.equal(rows.filter(function(r) { return r.name == 'a'; })[0].id, 'a');
        var stop = rows.filter(function(r) { return r.kind == 'Stopvoorwaarde'; })[0];
        assert.equal(stop.definition, 'v > 5');
        assert.equal(stop.id, '~s1', 'stopvoorwaarde: ruit in het diagram');
        assert.equal(rows.filter(function(r) { return r.name == 'a'; })[0].kind, 'Stroomvariabele');
    });

    it('waarden na een run in de tooltip, + knoppen bij geselecteerde toestand', function() {
        var g = analyse("v=0\nx=0\nt=0\ndt=0.1", "v = v + 9.81*dt\nx = x + v*dt\nt = t + dt");
        var svg = grafisch.toSVG(g, null, {selected: 'x', values: {x: {first: '0', last: '12.3'}}});
        assert.include(svg, 'begin: 0, eind: 12.3');
        assert.include(svg, 'data-action="flow-in" data-stock="x"');
        assert.include(svg, 'data-action="flow-out" data-stock="x"');
        assert.notInclude(grafisch.toSVG(g, null, {selected: 'v'}), 'data-stock="x"');
        assert.notInclude(grafisch.toSVG(g), 'data-action');
    });

    it('dv = a*dt alleen samen als a een hulpvariabele is en dv nergens anders staat', function() {
        // dv also in Ek: stays a named flow dv
        var g = analyse("m=1\nF=2\nv=0\nt=0\ndt=0.1", "a = F/m\ndv = a*dt\nv = v + dv\nP = dv/dt\nt = t + dt");
        assert.equal(g.elements.dv.kind, 'flow');
        assert.equal(g.elements.a.kind, 'aux');
        // g a constante: dv stays (ventiel dv, a relatiepijl from g)
        g = analyse("g=9.81\nv=0\nt=0\ndt=0.1", "dv = g*dt\nv = v + dv\nt = t + dt");
        assert.equal(g.elements.dv.kind, 'flow');
    });

    it('s = s + ds zonder t: s is de onafhankelijke variabele (examen 2026-II Phobos)', function() {
        var g = analyse("s=0\nds=10\nf=0,25\nm=1E4\nR=1,11E4\ng=5,7E-3\nFz=m*g\nv=7,5\nEk=1/2*m*v^2",
            "v = sqrt(2*Ek/m)\nFmpz = m*v^2/R\nFN = Fz - Fmpz\nFw = f*FN\ndEk = -Fw*ds\nEk = Ek + dEk\n" +
            "s = s + ds\nals Ek < 0 dan stop eindals");
        var k = kinds(g);
        assert.equal(g.time, 's');
        assert.equal(g.dt, 'ds');
        assert.deepEqual(k.stock, ['Ek'], 's is geen toestandsvariabele');
        assert.deepEqual(k.flow, ['Fw'], 'dEk = -Fw*ds: ventiel Fw');
        assert.equal(g.elements.Fw.to, 'Ek');
        assert.equal(g.elements.Fw.step, 'dEk');
        assert.isUndefined(k.time, 's wordt niet gebruikt');
        assert.deepEqual(k.stop, ['stop']);
        assert.equal(g.elements['~s1'].condition, 'Ek < 0');
        // examen: no arrows from the startwaarden (Fz = m*g, Ek = 1/2*m*v^2), no g
        var examen = grafisch.toSVG(g);
        assert.notInclude(examen, 'data-id="g"');
        assert.include(examen, 'data-id="Fz"');
        assert.include(examen, 'data-id="~s1"');
        assert.include(examen, '>Ek &lt; 0<');
        assert.notInclude(examen, 'stroke-dasharray="4 3"', 'geen gestippelde beginwaarde-pijlen');
        var lay = grafisch.layout(g);
        assert.isUndefined(lay.pos.g);
        // kleur: everything
        var kleur = grafisch.toSVG(g, grafisch.layout(g, {stijl: 'kleur'}), {stijl: 'kleur'});
        assert.include(kleur, 'data-id="g"');
        assert.include(kleur, 'stroke-dasharray="4 3"');
    });

    it('regels bij stroom met tussenstap en bij de stopvoorwaarde', function() {
        var model = new evaluator_js.Model();
        model.startwaarden = "m=1\nF=2\nv=0\nt=0\ndt=0.1";
        model.modelregels = "a = F/m\ndv = a*dt\nv = v + dv\nals v > 5 dan\n  stop\neindals\nt = t + dt";
        var ev = new evaluator_js.ModelregelsEvaluator(model, false);
        var g = grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
        var ln = grafisch.lines(g, ev.startwaarden_ast, ev.modelregels_ast);
        assert.deepEqual(ln.byElement.a.modelregels, [1, 2, 3]);
        assert.equal(ln.byLine['modelregels:2'], 'a');
        assert.deepEqual(ln.byElement['~s1'].modelregels, [5]);
    });

    it('x = x + v*dt met v een toestand: ventiel zonder naam in de examenstijl (2015-I)', function() {
        var g = analyse("m=2\nk=0.5\nv=1\nx=0\nt=0\ndt=0.1", "F = -k*x\na = F/m\nv = v + a*dt\nx = x + v*dt\nt = t + dt");
        var flow = g.elements[g.elements.x.inflows[0]];
        assert.isTrue(flow.stockRate);
        assert.isFalse(!!g.elements.a.stockRate, 'a is geen toestand');
        var symbol = function(svg, id) { return svg.split('data-id="' + id + '"')[1].split('</g>')[0]; };
        assert.notInclude(symbol(grafisch.toSVG(g), flow.id), '<text', 'examen: geen naam');
        assert.include(symbol(grafisch.toSVG(g, undefined, {stijl: 'kleur'}), flow.id), '>v<', 'kleur: wel');
    });

    it('formules bij de symbolen (examens 2015-I en 2016-I)', function() {
        var g = analyse("m=2\nC=8600\nyB=1,12\nv=0\ny=0,68\nt=0\ndt=0,001",
            "als y < yB dan F = C*(yB - y) anders F = 0 eindals\na = F/m\nv = v + a*dt\ny = y + v*dt\nt = t + dt");
        var zonder = grafisch.toSVG(g);
        assert.notInclude(zonder, 'class="formula"', 'standaard geen formules');
        var met = grafisch.toSVG(g, grafisch.layout(g, {formules: true}), {formules: true});
        assert.include(met, '>m = 2<');
        assert.include(met, '>y = 0,68<', 'beginwaarde van een toestand');
        assert.include(met, '>a = F/m<');
        assert.include(met, '>F = als y &lt; yB dan C·(yB − y)<', 'als ... dan: eerste regel');
        assert.include(met, '>als niet (y &lt; yB) dan 0<', 'tweede regel');
        var flow = g.elements.y.inflows[0];
        assert.notInclude(met.split('data-id="' + flow + '"')[1].split('</g>')[0], 'formula',
                          'y = y + v*dt: geen kader, zoals in 2015-I');
        // the layout makes room for the boxes
        var p0 = grafisch.layout(g).pos, p1 = grafisch.layout(g, {formules: true}).pos;
        assert.isAbove(Math.abs(p1.C.x - p1.yB.x), Math.abs(p0.C.x - p0.yB.x) - 1);
        assert.isBelow(p1.C.y, p0.C.y, 'meer ruimte tussen de lagen');
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
            var g = grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
            var met = grafisch.toSVG(g, grafisch.layout(g, {formules: true}), {formules: true});
            assert.notMatch(met, /NaN|undefined|null/, f + ' met formules');
        });
    });
});
