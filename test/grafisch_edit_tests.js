var assert = require('chai').assert;

var evaluator_js = require("../evaluator.js");
var grafisch = require("../grafisch.js");
var edit = require("../grafisch-edit.js");

var VAL = {
    startwaarden: "m = 80   // kg\nk = 0,3\nv = 0\nx = 0\nt = 0\ndt = 0,1",
    modelregels: "// valbeweging\nFz = m*9,81\nFw = k*v^2   ' luchtweerstand\nFres = Fz - Fw\na = Fres/m\ndv = a*dt\nv = v + dv\nx = x + v*dt\nt = t + dt"
};

var SIR = {
    startwaarden: "S=990\nI=10\nR=0\nb=0,3\nc=0,1\nN=1000\nt=0\ndt=0,1",
    modelregels: "besmet = b*S*I/N*dt\nbeter = c*I*dt\nS = S - besmet\nI = I + besmet - beter\nR = R + beter\nt = t + dt"
};

function analyse(model) {
    var m = new evaluator_js.Model();
    m.startwaarden = model.startwaarden;
    m.modelregels = model.modelregels;
    var ev = new evaluator_js.ModelregelsEvaluator(m, false);
    return grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
}

function run(model, N) {
    // last row of the results as {name: value}
    var m = new evaluator_js.Model();
    m.startwaarden = model.startwaarden;
    m.modelregels = model.modelregels;
    var ev = new evaluator_js.ModelregelsEvaluator(m, false);
    ev.set_state(N || 10, true, false);
    ev.run();
    var row = ev.result[ev.result.length - 1], out = {};
    ev.namespace.varNames.forEach(function(name, i) { out[name] = row[i]; });
    return out;
}

function lines(text) {
    return text.split('\n');
}

describe('grafisch-edit.js - grafisch model als invoer', function() {

    it('formule van een hulpvariabele: alleen die regel verandert, commentaar blijft', function() {
        var m = edit.apply(VAL, {op: 'setDefinition', id: 'Fw', text: '0,5 * k * v^2'});
        assert.equal(lines(m.modelregels)[2], "Fw = 0,5 * k * v^2   ' luchtweerstand");
        assert.equal(m.startwaarden, VAL.startwaarden);
        assert.equal(lines(m.modelregels).length, lines(VAL.modelregels).length);
    });

    it('waarde van een constante en beginwaarde van een toestandsvariabele', function() {
        var m = edit.apply(VAL, {op: 'setDefinition', id: 'm', text: '95'});
        assert.equal(lines(m.startwaarden)[0], 'm = 95   // kg');
        m = edit.apply(m, {op: 'setDefinition', id: 'v', text: '12'});
        assert.equal(lines(m.startwaarden)[2], 'v = 12');
    });

    it('formule van een stroom: benoemd (dv = a*dt: a) en als term (x = x + v*dt)', function() {
        var m = edit.apply(VAL, {op: 'setDefinition', id: 'a', text: 'Fres/m - 1'});
        assert.include(m.modelregels, 'a = Fres/m - 1');
        assert.include(m.modelregels, 'dv = a*dt');
        var id = analyse(m).elements.x.inflows[0];
        m = edit.apply(m, {op: 'setDefinition', id: id, text: '2 * v * dt'});
        assert.include(m.modelregels, 'x = x + 2 * v * dt');
    });

    it('foute formule wordt geweigerd', function() {
        assert.throws(function() { edit.apply(VAL, {op: 'setDefinition', id: 'Fw', text: 'k * (v'}); }, /klopt niet/);
        assert.throws(function() { edit.apply(VAL, {op: 'setDefinition', id: 'Fw', text: '1\nq = 2'}); }, /klopt niet/);
    });

    it('hernoemen: overal, maar niet in commentaar of in andere namen', function() {
        var model = {startwaarden: VAL.startwaarden + "\nvmax = 50  // v is de snelheid",
                     modelregels: VAL.modelregels};
        var m = edit.apply(model, {op: 'rename', id: 'v', name: 'snelheid'});
        assert.include(m.modelregels, 'Fw = k*snelheid^2');
        assert.include(m.modelregels, 'snelheid = snelheid + dv');
        assert.include(m.modelregels, 'x = x + snelheid*dt');
        assert.include(m.startwaarden, 'vmax = 50  // v is de snelheid');
        assert.include(m.modelregels, 'dv = a*dt');
        assert.equal(analyse(m).elements.snelheid.kind, 'stock');
        assert.throws(function() { edit.apply(VAL, {op: 'rename', id: 'v', name: 'm'}); }, /bestaat al/);
        assert.throws(function() { edit.apply(VAL, {op: 'rename', id: 'v', name: 'als'}); }, /geen geldige naam/);
        assert.throws(function() { edit.apply(VAL, {op: 'rename', id: 'v', name: '2x'}); }, /geen geldige naam/);
    });

    it('nieuwe constante en hulpvariabele (voor de stromen en toestanden)', function() {
        var m = edit.apply(VAL, {op: 'addConstant', name: 'g', text: '9,81'});
        assert.equal(lines(m.startwaarden).pop(), 'g = 9,81');
        m = edit.apply(m, {op: 'addAux', name: 'Ek', text: '0,5 * m * v^2'});
        var regels = lines(m.modelregels);
        assert.isBelow(regels.indexOf('Ek = 0,5 * m * v^2'), regels.indexOf('dv = a*dt'));
        assert.equal(analyse(m).elements.Ek.kind, 'aux');
        // uses a: after the line of a
        m = edit.apply(m, {op: 'addAux', name: 'F2', text: 'm * a'});
        regels = lines(m.modelregels);
        assert.equal(regels.indexOf('F2 = m * a'), regels.indexOf('a = Fres/m') + 1);
    });

    it('onbekende variabele (?) een formule geven: voor het eerste gebruik', function() {
        var m = edit.apply(VAL, {op: 'setDefinition', id: 'Fres', text: 'Fz - Fw - Frol'});
        assert.equal(analyse(m).elements.Frol.kind, 'unknown');
        var m2 = edit.apply(m, {op: 'define', id: 'Frol', kind: 'aux', text: '0,01 * Fz'});
        var regels = lines(m2.modelregels);
        assert.equal(regels.indexOf('Frol = 0,01 * Fz') + 1, regels.indexOf('Fres = Fz - Fw - Frol'));
        m2 = edit.apply(m, {op: 'define', id: 'Frol', kind: 'const', text: '5'});
        assert.equal(analyse(m2).elements.Frol.kind, 'const');
        assert.isNumber(run(m2).x);
    });

    it('nieuwe toestandsvariabele in een leeg model: ook t en dt', function() {
        var m = edit.apply({startwaarden: '', modelregels: ''},
            {op: 'addStock', name: 'N', initial: '1000', rate: '-0,1 * N'});
        assert.equal(m.startwaarden, 'N = 1000\nt = 0\ndt = 0,1');
        assert.equal(m.modelregels, 'dN = -0,1 * N * dt\nN = N + dN\nt = t + dt');
        var g = analyse(m);
        assert.equal(g.elements.N.kind, 'stock');
        assert.equal(g.elements.dN.to, 'N');
        assert.closeTo(run(m, 1).N, 990, 1e-9);
    });

    it('stroom toevoegen aan een toestand, en aan een constante (wordt toestand)', function() {
        var m = edit.apply(VAL, {op: 'addFlow', stock: 'v', direction: 'out', name: 'rem', rate: 'k + 1'});
        var regels = lines(m.modelregels);
        assert.include(regels, 'v = v + dv - rem');
        assert.equal(regels.indexOf('rem = (k + 1) * dt') + 1, regels.indexOf('v = v + dv - rem'));
        m = edit.apply(VAL, {op: 'addFlow', stock: 'm', direction: 'out', rate: '2'});
        regels = lines(m.modelregels);
        assert.deepEqual(regels.slice(-3), ['dm = 2 * dt', 'm = m - dm', 't = t + dt']);
        assert.equal(analyse(m).elements.m.kind, 'stock');
    });

    it('stroom verleggen: van buiten -> I naar S -> I en terug', function() {
        var model = {startwaarden: SIR.startwaarden,
                     modelregels: "besmet = b*S*I/N*dt\nI = I + besmet\nt = t + dt"};
        var m = edit.apply(model, {op: 'setFlowEnds', id: 'besmet', from: 'S', to: 'I'});
        assert.equal(m.modelregels, "besmet = b*S*I/N*dt\nI = I + besmet\nS = S - besmet\nt = t + dt");
        var g = analyse(m);
        assert.equal(g.elements.besmet.from, 'S');
        assert.equal(g.elements.besmet.to, 'I');
        m = edit.apply(m, {op: 'setFlowEnds', id: 'besmet', from: null, to: 'I'});
        assert.equal(m.modelregels, model.modelregels);
        assert.throws(function() { edit.apply(model, {op: 'setFlowEnds', id: 'besmet', from: null, to: null}); });
        assert.throws(function() { edit.apply(SIR, {op: 'setFlowEnds', id: 'besmet', from: 'I', to: 'I'}); });
    });

    it('stroom zonder naam verleggen: krijgt eerst een naam', function() {
        var model = {startwaarden: "A=10\nB=0\nk=0,5\nt=0\ndt=0,1", modelregels: "A = A - k*A*dt\nt = t + dt"};
        var id = analyse(model).elements.A.outflows[0];
        var m = edit.apply(model, {op: 'setFlowEnds', id: id, from: 'A', to: 'B'});
        assert.equal(m.modelregels, "dA = k * A * dt\nA = A - dA\nB = B + dA\nt = t + dt");
        var r = run(m, 1);
        assert.closeTo(r.A, 9.5, 1e-9);
        assert.closeTo(r.B, 0.5, 1e-9);
        // naam geven via hernoemen
        m = edit.apply(model, {op: 'rename', id: id, name: 'verval'});
        assert.equal(m.modelregels, "verval = k * A * dt\nA = A - verval\nt = t + dt");
    });

    it('verwijderen: constante, hulpvariabele, stroom en toestand', function() {
        var m = edit.apply(VAL, {op: 'remove', id: 'k'});
        assert.notInclude(m.startwaarden, 'k = 0,3');
        assert.equal(analyse(m).elements.k.kind, 'unknown', 'nog gebruikt in Fw: vraagteken');

        m = edit.apply(VAL, {op: 'remove', id: 'Fz'});
        assert.notInclude(m.modelregels, 'Fz = m*9,81');

        // stroom tussen twee toestanden
        m = edit.apply(SIR, {op: 'remove', id: 'beter'});
        assert.equal(m.modelregels, "besmet = b*S*I/N*dt\nS = S - besmet\nI = I + besmet\nt = t + dt");
        assert.equal(analyse(m).elements.R.kind, 'const', 'R heeft geen stroom meer: constante');

        // toestand met stromen naar andere toestanden
        m = edit.apply(SIR, {op: 'remove', id: 'I'});
        assert.equal(m.modelregels, "besmet = b*S*I/N*dt\nbeter = c*I*dt\nS = S - besmet\nR = R + beter\nt = t + dt");
        assert.notInclude(m.startwaarden, 'I=10');

        // dv = a*dt verdwijnt mee, a blijft
        m = edit.apply(VAL, {op: 'remove', id: 'v'});
        assert.notInclude(m.modelregels, 'dv = a*dt');
        assert.notInclude(m.modelregels, 'v = v + dv');
        assert.include(m.modelregels, 'a = Fres/m');
    });

    it('wat niet veilig kan wordt geweigerd met uitleg', function() {
        var model = {startwaarden: "h=500\nk=0,3\nv=0\nt=0\ndt=0,1",
                     modelregels: "v = v + 9,81*dt\nh = h - v*dt\nals h < 400 dan k = 0,6 * (400 - h) eindals\nals h < 0 dan v = 0 eindals\nt = t + dt"};
        var g = analyse(model);
        assert.equal(g.elements.k.kind, 'aux');
        assert.throws(function() { edit.apply(model, {op: 'setDefinition', id: 'k', text: '1'}); }, /niet automatisch/);
        assert.throws(function() { edit.apply(model, {op: 'remove', id: '~e1'}); }, /niet verwijderen/);
        assert.throws(function() { edit.apply({startwaarden: 'x = (', modelregels: ''}, {op: 'addConstant', name: 'a', text: '1'}); }, /fout/);
        // x = x * 1,05: geen x = x + ... vorm
        assert.throws(function() {
            edit.apply({startwaarden: "x=1\nt=0\ndt=1", modelregels: "x = x * 1,05\nt = t + dt"},
                {op: 'addFlow', stock: 'x', direction: 'in', rate: '1'});
        }, /niet de vorm/);
    });

    it('na elke bewerking is het een werkend model met dezelfde uitkomst waar niets veranderde', function() {
        var before = run(VAL, 20);
        var m = edit.apply(VAL, {op: 'rename', id: 'x', name: 'hoogte'});
        m = edit.apply(m, {op: 'addAux', name: 'Ek', text: '0,5 * m * v^2'});
        m = edit.apply(m, {op: 'addConstant', name: 'g', text: '9,81'});
        m = edit.apply(m, {op: 'setDefinition', id: 'Fz', text: 'm * g'});
        var after = run(m, 20);
        assert.closeTo(after.hoogte, before.x, 1e-9);
        assert.closeTo(after.v, before.v, 1e-9);
        assert.isAbove(after.Ek, 0);
    });
});
