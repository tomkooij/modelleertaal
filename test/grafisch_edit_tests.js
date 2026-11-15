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

    it('onbekende variabele (?) wordt toestandsvariabele: regels voor het eerste gebruik', function() {
        var m = edit.apply({startwaarden: '', modelregels: ''},
            {op: 'addStock', name: 'x', initial: '0', rate: 'v'});
        assert.equal(analyse(m).elements.v.kind, 'unknown');
        m = edit.apply(m, {op: 'define', id: 'v', kind: 'stock', initial: '0', rate: 'a'});
        assert.deepEqual(lines(m.modelregels), ['dv = a * dt', 'v = v + dv', 'dx = v * dt', 'x = x + dx', 't = t + dt']);
        var g = analyse(m);
        assert.equal(g.elements.v.kind, 'stock');
        assert.equal(g.elements.a.kind, 'unknown');
        // + Toestandsvariabele met de naam van een onbekende: hetzelfde
        var m2 = edit.apply({startwaarden: '', modelregels: ''},
            {op: 'addStock', name: 'x', initial: '0', rate: 'v'});
        m2 = edit.apply(m2, {op: 'addStock', name: 'v', initial: '0', rate: 'a'});
        assert.deepEqual(m2, m);
        // + Hulpvariabele en + Constante met de naam van een onbekende
        var m3 = edit.apply(m, {op: 'addAux', name: 'a', text: 'Fres / m'});
        assert.equal(lines(m3.modelregels)[0], 'a = Fres / m');
        m3 = edit.apply(m3, {op: 'addConstant', name: 'm', text: '25'});
        assert.include(lines(m3.startwaarden), 'm = 25');
        // een naam met een waarde of formule blijft geweigerd
        assert.throws(function() { edit.apply(m3, {op: 'addStock', name: 'a', initial: '0', rate: '1'}); }, /bestaat al/);
        assert.throws(function() { edit.apply(m3, {op: 'addConstant', name: 'v', text: '1'}); }, /bestaat al/);
        assert.throws(function() { edit.apply(m3, {op: 'define', id: 'v', kind: 'stock', initial: '0', rate: '1'}); }, /al een waarde/);
    });

    it('constante voor de startwaarde die hem gebruikt, na de startwaarden die hij nodig heeft', function() {
        var m = edit.apply({startwaarden: '', modelregels: ''},
            {op: 'addStock', name: 'v', initial: '0', rate: 'a'});
        m = edit.apply(m, {op: 'addAux', name: 'a', text: 'Fres / m'});
        m = edit.apply(m, {op: 'define', id: 'Fres', kind: 'const', text: 'F'});
        m = edit.apply(m, {op: 'define', id: 'm', kind: 'const', text: '25'});
        m = edit.apply(m, {op: 'define', id: 'F', kind: 'const', text: '100'});
        var start = lines(m.startwaarden);
        assert.isBelow(start.indexOf('F = 100'), start.indexOf('Fres = F'));
        assert.closeTo(run(m, 10).v, 4, 1e-9);   // dt = 0,1
        // addConstant met een waarde die een bestaande startwaarde gebruikt: daaronder
        m = edit.apply(VAL, {op: 'addConstant', name: 'm2', text: '2 * m'});
        start = lines(m.startwaarden);
        assert.isAbove(start.indexOf('m2 = 2 * m'), start.indexOf('m = 80   // kg'));
        // ... en boven een startwaarde die hem gebruikt
        m = edit.apply({startwaarden: 'm = 80\nG = m * g\nt = 0\ndt = 1', modelregels: 't = t + dt'},
            {op: 'addConstant', name: 'g', text: '9,81'});
        assert.deepEqual(lines(m.startwaarden), ['m = 80', 'g = 9,81', 'G = m * g', 't = 0', 'dt = 1']);
    });

    it('constante met een stroom erin: regels voor het eerste gebruik (zelfde volgorde als define)', function() {
        var m = edit.apply({startwaarden: '', modelregels: ''}, {op: 'addStock', name: 'x', initial: '0', rate: 'v'});
        m = edit.apply(m, {op: 'define', id: 'v', kind: 'const', text: '0'});
        m = edit.apply(m, {op: 'addFlow', stock: 'v', direction: 'in', rate: 'a'});
        assert.deepEqual(lines(m.modelregels), ['dv = a * dt', 'v = v + dv', 'dx = v * dt', 'x = x + dx', 't = t + dt']);
    });

    it('constante <-> hulpvariabele omzetten', function() {
        var m = edit.apply(VAL, {op: 'convert', id: 'k', kind: 'aux'});
        assert.notInclude(m.startwaarden, 'k = 0,3');
        var regels = lines(m.modelregels);
        assert.isBelow(regels.indexOf('k = 0,3'), regels.indexOf("Fw = k*v^2   ' luchtweerstand"));
        assert.equal(analyse(m).elements.k.kind, 'aux');
        var m2 = edit.apply(m, {op: 'convert', id: 'k', kind: 'const'});
        assert.include(lines(m2.startwaarden), 'k = 0,3');
        assert.equal(analyse(m2).elements.k.kind, 'const');
        assert.closeTo(run(m2, 20).x, run(VAL, 20).x, 1e-9);
        assert.throws(function() { edit.apply(VAL, {op: 'convert', id: 'Fz', kind: 'const'}); }, /hangt af van/);
    });

    it('dt aanpassen en aflezen', function() {
        var m = edit.apply(VAL, {op: 'setDt', text: '1'});
        assert.equal(lines(m.startwaarden).pop(), 'dt = 1');
        assert.deepEqual(edit.dtOf(m), {name: 'dt', text: '1'});
        assert.deepEqual(edit.dtOf({startwaarden: '', modelregels: ''}).text, null);
        assert.deepEqual(edit.variablesOf('Fres / m'), ['Fres', 'm']);
        assert.deepEqual(edit.variablesOf('2 * 3'), []);
        assert.throws(function() { edit.variablesOf('2 *'); }, /klopt niet/);
    });

    it('eenheid als commentaar: toevoegen, vervangen, weghalen', function() {
        var m = edit.apply(VAL, {op: 'setUnit', name: 'm', unit: 'g'});
        assert.equal(lines(m.startwaarden)[0], "m = 80   // [g] kg");
        m = edit.apply(m, {op: 'setUnit', name: 'm', unit: 'kg'});
        assert.equal(lines(m.startwaarden)[0], "m = 80   // [kg] kg");
        m = edit.apply(VAL, {op: 'setUnit', name: 'k', unit: 'kg/m'});
        assert.equal(lines(m.startwaarden)[1], "k = 0,3 '[kg/m]");
        m = edit.apply(m, {op: 'setUnit', name: 'k', unit: ''});
        assert.equal(lines(m.startwaarden)[1], "k = 0,3");
        // hulpvariabele en benoemde stroom: in de modelregels
        m = edit.apply(VAL, {op: 'setUnit', name: 'Fw', unit: 'N'});
        assert.equal(lines(m.modelregels)[2], "Fw = k*v^2   '[N] luchtweerstand");
        m = edit.apply(m, {op: 'setUnit', name: 'dv', unit: 'm/s'});
        assert.include(lines(m.modelregels), "dv = a*dt '[m/s]");
        assert.throws(function() { edit.apply(VAL, {op: 'setUnit', name: 'k', unit: 'a]b'}); }, /geen eenheid/);
        // nieuw model met timeUnit: t en dt in s
        m = edit.apply({startwaarden: '', modelregels: ''}, {op: 'addStock', name: 'x', initial: '0', rate: '2', timeUnit: 's'});
        assert.equal(m.startwaarden, "x = 0\nt = 0 '[s]\ndt = 0,1 '[s]");
        assert.closeTo(run(m, 1).t, 0.1, 1e-9);
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
        // een voorval (als h < 0 dan v = 0 eindals) kan nu wel weg, het hele als-blok
        assert.notInclude(edit.apply(model, {op: 'remove', id: '~e1'}).modelregels, 'h < 0');
        // een stopvoorwaarde binnen een andere voorwaarde niet
        assert.throws(function() {
            edit.apply({startwaarden: "x=0\nt=0\ndt=1", modelregels: "x = x + dt\nals x > 1 dan\n  als t > 2 dan stop eindals\neindals\nt = t + dt"},
                {op: 'remove', id: '~s1'});
        }, /niet automatisch/);
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

    it('een stroom kan niet in zijn eigen formule staan (dOpp = dOpp * dt)', function() {
        var m = {startwaarden: '', modelregels: ''};
        assert.throws(function() { edit.apply(m, {op: 'addStock', name: 'Opp', initial: '0,8', rate: 'dOpp'}); },
            /dOpp is de naam van de stroom van Opp/);
        assert.throws(function() { edit.apply(m, {op: 'addStock', name: 'x', initial: '0', rate: 'w', flow: 'w'}); },
            /eigen formule/);
        m = edit.apply(m, {op: 'addStock', name: 'x', initial: '0', rate: 'v'});
        assert.throws(function() { edit.apply(m, {op: 'define', id: 'v', kind: 'stock', initial: '0', rate: 'dv'}); },
            /dv is de naam van de stroom van v/);
        assert.throws(function() { edit.apply(m, {op: 'addFlow', stock: 'x', direction: 'out', rate: 'dx2'}); },
            /dx2 is de naam/);
    });

    it('voorwaarden: het model van examen vwo 2005-I Champignon via het diagram', function() {
        var m = {startwaarden: '', modelregels: ''};
        var A = function(op) { m = edit.apply(m, op); };
        A({op: 'addStock', name: 'x', initial: '0', rate: 'v'});
        A({op: 'define', id: 'v', kind: 'stock', initial: '0', rate: 'a'});
        A({op: 'define', id: 'a', kind: 'aux', text: 'Fr/m'});
        A({op: 'define', id: 'Fr', kind: 'aux', text: 'Fz - Fw'});
        A({op: 'define', id: 'Fz', kind: 'aux', text: 'm * 9,81'});
        A({op: 'define', id: 'Fw', kind: 'aux', text: 'k * Opp * v^2'});
        A({op: 'define', id: 'm', kind: 'const', text: '91'});
        A({op: 'define', id: 'k', kind: 'const', text: '0,37'});
        A({op: 'define', id: 'Opp', kind: 'const', text: '0,8'});
        A({op: 'addEvent', condition: 't > 13', target: 'Opp', text: 'Opp + dOpp'});
        A({op: 'define', id: 'dOpp', kind: 'const', text: '1,1'});
        A({op: 'setLimit', name: 'Opp', bound: 'max', text: '42,6'});
        var r = lines(m.modelregels);
        assert.deepEqual(r.slice(r.indexOf('als t > 13 dan')),
            ['als t > 13 dan', '    Opp = Opp + dOpp', 'eindals', 'als Opp > 42,6 dan', '    Opp = 42,6', 'eindals', 't = t + dt']);
        var g = analyse(m);
        assert.equal(g.elements.Opp.kind, 'stock');
        assert.equal(g.elements['~e1'].kind, 'event');
        assert.deepEqual(edit.limitsOf(m, 'Opp'), {max: '42,6', min: ''});
        assert.deepEqual(edit.eventOf(m, '~e1'), {condition: 't > 13', target: 'Opp', text: 'Opp + dOpp'});
        // dezelfde uitkomst als het examenmodel
        var exam = {startwaarden: "m = 91\nk = 0,37\nOpp = 0,8\nv = 0\nx = 0\nt = 0\ndOpp = 1,1\ndt = 0,1",
                    modelregels: "Fz = m * 9,81\nFw = k * Opp * v^2\nFr = Fz - Fw\na = Fr/m\nv = v + a*dt\nx = x + v*dt\n" +
                                 "als t > 13 dan\n    Opp = Opp + dOpp\neindals\nals Opp > 42,6 dan\n    Opp = 42,6\neindals\nt = t + dt"};
        var mine = run(m, 300), theirs = run(exam, 300);
        ['v', 'x', 'Opp', 't'].forEach(function(name) { assert.closeTo(mine[name], theirs[name], 1e-9, name); });
        assert.closeTo(mine.Opp, 42.6, 1e-9);
    });

    it('voorwaarden aanpassen, stoppen, grenzen weghalen', function() {
        var m = {startwaarden: "h = 10\nv = 0\nt = 0\ndt = 0,1", modelregels: "v = v - 9,81*dt\nh = h + v*dt\nt = t + dt"};
        m = edit.apply(m, {op: 'addEvent', condition: 'als h < 0 dan', target: 'v', text: '-0,8 * v'});
        m = edit.apply(m, {op: 'addEvent', condition: 't > 5', stop: true});
        assert.deepEqual(lines(m.modelregels),
            ['v = v - 9,81*dt', 'h = h + v*dt', 'als h < 0 dan', '    v = -0,8 * v', 'eindals', 't = t + dt',
             'als t > 5 dan', '    stop', 'eindals']);
        m = edit.apply(m, {op: 'setEvent', id: '~e1', condition: 'h <= 0', text: '-v'});
        assert.include(m.modelregels, 'als h <= 0 dan\n    v = -v\neindals');
        m = edit.apply(m, {op: 'setEvent', id: '~s1', condition: 't > 8'});
        assert.deepEqual(edit.eventOf(m, '~s1'), {condition: 't > 8', target: null, text: null});
        m = edit.apply(m, {op: 'setLimit', name: 'h', bound: 'min', text: '0'});
        assert.equal(edit.limitsOf(m, 'h').min, '0');
        m = edit.apply(m, {op: 'setLimit', name: 'h', bound: 'min', text: ''});
        assert.equal(edit.limitsOf(m, 'h').min, '');
        assert.throws(function() { edit.apply(m, {op: 'addEvent', condition: 't >', target: 'v', text: '0'}); }, /voorwaarde/);
        assert.throws(function() { edit.apply(m, {op: 'addEvent', condition: 't > 1', target: 'w', text: '0'}); }, /bestaat niet/);
        assert.throws(function() { edit.apply(m, {op: 'addEvent', condition: 't > 1', target: 't', text: '0'}); }, /Stop het model/);
        assert.equal(run(m, 200).t >= 8, true);
    });

    it('voorwaarde op een hulpvariabele die als ventiel getekend wordt (groei)', function() {
        var m = {startwaarden: "Opp = 0,8\nt = 0\ndt = 0,1", modelregels: "groei = 11\ndOpp = groei * dt\nOpp = Opp + dOpp\nt = t + dt"};
        assert.equal(analyse(m).elements.groei.kind, 'flow');
        m = edit.apply(m, {op: 'addEvent', condition: 't <= 13', target: 'groei', text: '0'});
        assert.deepEqual(lines(m.modelregels),
            ['groei = 11', 'als t <= 13 dan', '    groei = 0', 'eindals', 'dOpp = groei * dt', 'Opp = Opp + dOpp', 't = t + dt']);
        assert.closeTo(run(m, 200).Opp, 0.8 + 1.1 * 69, 1e-6);
    });
});
