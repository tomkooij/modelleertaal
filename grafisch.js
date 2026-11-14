/*
    grafisch.js  (prototype)

    Zet een tekstmodel (startwaarden + modelregels) om in een grafisch model
    (System Dynamics / stock-flow), getekend zoals de grafische modellen in de
    centrale examens natuurkunde vwo (bijvoorbeeld 2022-I en 2023-II):
    grijze achtergrond, toestandsvariabele als rechthoek, stroom als holle pijl
    met een ventiel (cirkel met kraantje), hulpvariabelen en constanten als
    cirkels met de naam eronder en zwarte relatiepijlen.
    Er is ook een stijl in kleur (toSVG(g, lay, {stijl: 'kleur'})): de kleuren en
    symbolen van Coach 7 (hulpvariabele cirkel, constante cirkel met streepjes).
    Bronnen: zie STIJLEN.

    Herkenning (Euler-vorm, zoals in de examenmodellen):

      Toestandsvariabele   x = x + dx              variabele die naar zichzelf verwijst
      Stroomvariabele      dx = v * dt             de termen die bij x worden opgeteld
                                                   (+ is ingaand, - is uitgaand);
                                                   dezelfde stroom als - bij A en + bij B
                                                   is een stroom van A naar B
                           dv = a * dt; v = v + dv met a een hulpvariabele: a is de stroom
                                                   (ventiel a, zoals in de examens 2018-I en 2026-II)
      Onafhankelijke var.  t = t + dt              alleen getekend als t gebruikt wordt
                           s = s + ds              zonder t, met ds een constante (examen 2026-II)
      Hulpvariabele        Fres = Fz - Fw          overige variabelen uit de modelregels
      Constante            m = 80                  alleen in de startwaarden
                                                   Examen-stijl: geen pijlen uit formules in de
                                                   startwaarden (Fz = m * g) en geen constante die
                                                   alleen daar gebruikt wordt (g), zoals 2026-II
      Voorval              als h < 0 dan v = -v eindals
                                                   (toestandsvariabele verandert sprongsgewijs)
      Stopvoorwaarde       als ... dan stop eindals (ruit linksboven, zonder pijlen)
      Relatiepijl          van elke variabele in een formule naar de variabele
                           die met die formule berekend wordt
      Onbekend (?)         variabele die nergens een waarde krijgt

    usage:
      var grafisch = require('./grafisch.js');
      var g = grafisch.analyse(startwaarden_ast, modelregels_ast);
      grafisch.toSVG(g)      --> '<svg ...>'
      grafisch.table(g)      --> [{kind: 'Toestandsvariabele', name: 'x', definition: '...'}, ...]
*/

//jshint node:true
//jshint es3:true
//jshint loopfunc:true
"use strict";

var TIME_NAMES = ['t', 'T', 'tijd'];


// ------------------------------------------------------------------ AST helpers

function walk(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk(node.left, callback);
    walk(node.right, callback);
    walk(node.expr, callback);
}

function variables(expr) {
    var names = [];
    walk(expr, function(node) {
        if (node.type == 'Variable' && names.indexOf(node.name) == -1) names.push(node.name);
    });
    return names;
}

function isVar(node, name) {
    return node && node.type == 'Variable' && (name === undefined || node.name == name);
}

var PREC = {'LIST': 0, '||': 1, '&&': 2, '==': 3, '<': 3, '>': 3, '<=': 3, '>=': 3,
            '+': 4, '-': 4, '*': 5, '/': 5, '^': 7};
// how to write an expression: for reading (diagram, table) and as modelleertaal code
var SHOW = {'*': '·', '/': '/', '^': '^', '+': ' + ', '-': ' − ', '&&': ' en ', '||': ' of ',
            '==': ' = ', '<': ' < ', '>': ' > ', '<=': ' ≤ ', '>=': ' ≥ ', 'LIST': '; ',
            minus: '−', pi: 'π'};
var CODE = {'*': ' * ', '/': ' / ', '^': '^', '+': ' + ', '-': ' - ', '&&': ' en ', '||': ' of ',
            '==': ' == ', '<': ' < ', '>': ' > ', '<=': ' <= ', '>=': ' >= ', 'LIST': '; ',
            minus: '-', pi: 'pi'};

function write(node, ops, parentPrec, rightSide) {
    // expression --> string (minimal parentheses)
    var s, prec;
    parentPrec = parentPrec || 0;
    if (!node) return '?';
    switch (node.type) {
        case 'Variable': return node.name;
        case 'Number': return node.value == '3.14159265359' ? ops.pi : String(node.value);
        case 'Boolean': return node.value == 'true' ? 'waar' : 'onwaar';
        case 'Function': return node.func + '(' + write(node.expr, ops) + ')';
        case 'Blank': return '...';
        case 'Unary':
            prec = 6;
            s = (node.operator == 'NOT' ? 'niet ' : (node.operator == '-' ? ops.minus : '+')) +
                write(node.right, ops, prec, true);
            break;
        case 'Binary':
        case 'Logical':
        case 'List':
            prec = PREC[node.operator];
            s = write(node.left, ops, prec, false) + ops[node.operator] + write(node.right, ops, prec, true);
            break;
        default:
            return '?';
    }
    if (prec < parentPrec || (prec == parentPrec && rightSide)) s = '(' + s + ')';
    return s;
}

function fmt(node, parentPrec, rightSide) {
    // readable: a·dt
    return write(node, SHOW, parentPrec, rightSide);
}

function code(node, parentPrec, rightSide) {
    // modelleertaal: a * dt
    return write(node, CODE, parentPrec, rightSide);
}

function signedTerms(expr, sign, out) {
    // x + a - (b - c) --> [+x, +a, -b, +c]
    if (expr.type == 'Binary' && (expr.operator == '+' || expr.operator == '-')) {
        signedTerms(expr.left, sign, out);
        signedTerms(expr.right, expr.operator == '-' ? -sign : sign, out);
    } else if (expr.type == 'Unary' && expr.operator == '-') {
        signedTerms(expr.right, -sign, out);
    } else {
        out.push({sign: sign, expr: expr});
    }
    return out;
}

function stripDt(expr, dt) {
    // a * dt --> a ;  F * dt / m --> F / m ; dt --> 1 ; otherwise null
    var r;
    if (isVar(expr, dt)) return {type: 'Number', value: '1'};
    if (expr.type == 'Binary' && expr.operator == '*') {
        if (isVar(expr.right, dt)) return expr.left;
        if (isVar(expr.left, dt)) return expr.right;
        r = stripDt(expr.left, dt);
        if (r) return {type: 'Binary', operator: '*', left: r, right: expr.right};
        r = stripDt(expr.right, dt);
        if (r) return {type: 'Binary', operator: '*', left: expr.left, right: r};
    }
    if (expr.type == 'Binary' && expr.operator == '/') {
        r = stripDt(expr.left, dt);
        if (r) return {type: 'Binary', operator: '/', left: r, right: expr.right};
    }
    if (expr.type == 'Unary' && expr.operator == '-') {
        r = stripDt(expr.right, dt);
        if (r) return {type: 'Unary', operator: '-', right: r};
    }
    return null;
}

function collect(ast, conds, out) {
    // flatten modelregels: assignments and stops, each with its conditions
    for (var i = 0; i < ast.length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment') {
            out.assign.push({name: stmt.left, expr: stmt.right, conds: conds, line: stmt.lineNo});
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            collect(stmt.then, conds.concat([{cond: stmt.cond, neg: false}]), out);
            if (stmt.elsestmt) collect(stmt.elsestmt, conds.concat([{cond: stmt.cond, neg: true}]), out);
        } else if (stmt.type == 'Stop') {
            var stop = conds.slice();
            stop.line = stmt.lineNo;
            out.stops.push(stop);
        }
    }
    return out;
}

function fmtConds(conds) {
    var parts = [];
    for (var i = 0; i < conds.length; i++) {
        parts.push((conds[i].neg ? 'niet ' : '') + fmt(conds[i].cond, conds[i].neg ? 6 : 0));
    }
    return parts.join(' en ') || 'waar';
}

function condVars(conds) {
    var names = [];
    for (var i = 0; i < conds.length; i++) addAll(names, variables(conds[i].cond));
    return names;
}

function addAll(list, items) {
    for (var i = 0; i < items.length; i++) {
        if (list.indexOf(items[i]) == -1) list.push(items[i]);
    }
    return list;
}

function without(list, remove) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
        if (remove.indexOf(list[i]) == -1) out.push(list[i]);
    }
    return out;
}


// ------------------------------------------------------------------ analyse

function analyse(startwaarden_ast, modelregels_ast) {
    var i, j, a, name, key;
    var init = {}, initOrder = [];
    var start = collect(startwaarden_ast || [], [], {assign: [], stops: []});
    for (i = 0; i < start.assign.length; i++) {
        a = start.assign[i];
        if (!init.hasOwnProperty(a.name)) initOrder.push(a.name);
        init[a.name] = a.expr;
    }
    var regels = collect(modelregels_ast || [], [], {assign: [], stops: []});

    // assignments per variable
    var assigned = {}, assignOrder = [];
    for (i = 0; i < regels.assign.length; i++) {
        a = regels.assign[i];
        if (!assigned.hasOwnProperty(a.name)) {
            assigned[a.name] = {uncond: [], cond: []};
            assignOrder.push(a.name);
        }
        assigned[a.name][a.conds.length ? 'cond' : 'uncond'].push(a);
    }

    // --- toestandsvariabelen: verwijzen naar zichzelf
    var isStock = {}, stockOrder = [];
    for (i = 0; i < regels.assign.length; i++) {
        a = regels.assign[i];
        if (!isStock[a.name] && variables(a.expr).indexOf(a.name) != -1) {
            isStock[a.name] = true;
            stockOrder.push(a.name);
        }
    }

    // --- onafhankelijke variabele: t = t + dt
    var time = null, dt = 'dt';
    for (i = 0; i < stockOrder.length && time === null; i++) {
        name = stockOrder[i];
        var upd = assigned[name].uncond;
        if (upd.length != 1) continue;
        var tt = signedTerms(upd[0].expr, 1, []);
        if (tt.length != 2 || !isVar(tt[0].expr, name) || tt[0].sign != 1 || tt[1].sign != 1) continue;
        var step = tt[1].expr;
        if ((isVar(step) && (step.name == 'dt' || TIME_NAMES.indexOf(name) != -1)) ||
            (step.type == 'Number' && TIME_NAMES.indexOf(name) != -1)) {
            time = name;
            if (isVar(step)) dt = step.name;
        }
    }
    // no time: s = s + ds with ds a constant (only in the startwaarden) is the independent
    // variable, ds its step (examen 2026-II Phobos: the model counts in steps of the distance)
    for (i = 0; i < stockOrder.length && time === null; i++) {
        name = stockOrder[i];
        if (assigned[name].uncond.length != 1 || assigned[name].cond.length) continue;
        var st = signedTerms(assigned[name].uncond[0].expr, 1, []);
        if (st.length != 2 || !isVar(st[0].expr, name) || st[0].sign != 1 || st[1].sign != 1) continue;
        if (isVar(st[1].expr, 'd' + name) && init.hasOwnProperty('d' + name) && !assigned.hasOwnProperty('d' + name)) {
            time = name;
            dt = 'd' + name;
        }
    }

    var elements = {};      // id --> element
    var order = [];

    function add(el) {
        elements[el.id] = el;
        order.push(el.id);
        return el;
    }

    // --- stromen
    var flows = [], flowOfVar = {}, nAnon = 0;

    function flowCandidate(v) {
        // v can be drawn as a (named) flow: computed once, unconditionally, from other variables
        return assigned.hasOwnProperty(v) && !isStock[v] && v != dt &&
            assigned[v].uncond.length == 1;
    }

    function onlyInStocks(v) {
        // v is only used in the update lines of toestandsvariabelen (x = x + v)
        for (var m = 0; m < regels.assign.length; m++) {
            var as = regels.assign[m];
            if (condVars(as.conds).indexOf(v) != -1) return false;
            if (!isStock[as.name] && variables(as.expr).indexOf(v) != -1) return false;
        }
        for (m = 0; m < regels.stops.length; m++) if (condVars(regels.stops[m]).indexOf(v) != -1) return false;
        return true;
    }

    function rateVar(v) {
        // dv = a * dt  or  dv = -a * dt, a a hulpvariabele, dv only used in x = x + dv: a. Otherwise null
        var rate = stripDt(assigned[v].uncond[0].expr, dt);
        if (rate && rate.type == 'Unary' && rate.operator == '-') rate = rate.right;
        if (!rate || !isVar(rate) || rate.name == v || !flowCandidate(rate.name) ||
            flowOfVar[rate.name] || !onlyInStocks(v)) return null;
        return rate.name;
    }

    for (i = 0; i < stockOrder.length; i++) {
        name = stockOrder[i];
        if (name == time) continue;
        // editable: one update line  x = x + ... - ...  (see grafisch-edit.js)
        var stock = add({id: name, kind: 'stock', name: name,
                         initial: init.hasOwnProperty(name) ? fmt(init[name]) : '?',
                         initialCode: init.hasOwnProperty(name) ? code(init[name]) : '',
                         inflows: [], outflows: [], general: null,
                         updates: assigned[name].uncond.length, conditional: assigned[name].cond.length > 0});
        var updates = assigned[name].uncond;
        for (j = 0; j < updates.length; j++) {
            var terms = signedTerms(updates[j].expr, 1, []);
            var self = -1;
            for (var k = 0; k < terms.length; k++) {
                if (terms[k].sign == 1 && isVar(terms[k].expr, name)) { self = k; break; }
            }
            if (self == -1) {
                // x = x * 1.05: no x + ... form. One flow with the whole change.
                stock.general = fmt(updates[j].expr);
                terms = [{sign: 1, expr: {type: 'Binary', operator: '-',
                          left: updates[j].expr, right: {type: 'Variable', name: name}}}];
            } else {
                terms.splice(self, 1);
            }
            for (k = 0; k < terms.length; k++) {
                var term = terms[k], f = null, r, v = isVar(term.expr) ? term.expr.name : null;
                if (v !== null && flowCandidate(v)) {
                    // named flow: dv = a * dt ; v = v + dv
                    f = flowOfVar[v];
                    if (f && ((term.sign > 0 && f.to === null) || (term.sign < 0 && f.from === null))) {
                        if (term.sign > 0) f.to = name; else f.from = name;
                    } else if (!f && (r = rateVar(v)) !== null) {
                        // dv = a * dt ; v = v + dv ; a = Fres / m  --> a is the flow, as in the exams
                        // (2018-I: ventiel a; 2026-II: dEk = -Fw * ds, ventiel Fw)
                        var sdef = assigned[v].uncond[0].expr, vdef = assigned[r].uncond[0].expr;
                        f = {id: r, kind: 'flow', name: r, label: r,
                             from: term.sign < 0 ? name : null, to: term.sign > 0 ? name : null,
                             term: v, code: code(vdef), definition: fmt(vdef), rate: fmt(vdef), isRate: true,
                             step: v, stepDefinition: fmt(sdef),
                             deps: without(variables(vdef), [dt])};
                        flowOfVar[v] = f;
                        flowOfVar[r] = f;
                        flows.push(add(f));
                    } else {
                        var def = assigned[v].uncond[0].expr;
                        var rate = stripDt(def, dt);
                        f = {id: f ? v + '#' + flows.length : v, kind: 'flow', name: v, label: v,
                             from: term.sign < 0 ? name : null, to: term.sign > 0 ? name : null,
                             term: v, code: code(def),
                             definition: fmt(def), rate: rate ? fmt(rate) : null,
                             deps: without(variables(def), [dt])};
                        if (!flowOfVar[v]) flowOfVar[v] = f;
                        flows.push(add(f));
                    }
                } else if ((r = stripDt(term.expr, dt)) && isVar(r) && flowCandidate(r.name) && !flowOfVar[r.name]) {
                    // v = v + a * dt ; a = Fres / m  --> a is the flow (rate per dt)
                    var rdef = assigned[r.name].uncond[0].expr;
                    f = {id: r.name, kind: 'flow', name: r.name, label: r.name,
                         from: term.sign < 0 ? name : null, to: term.sign > 0 ? name : null,
                         term: code(term.expr, 4, true), code: code(rdef),
                         definition: fmt(rdef), rate: fmt(rdef), isRate: true,
                         deps: without(variables(rdef), [dt])};
                    flowOfVar[r.name] = f;
                    flows.push(add(f));
                } else {
                    // anonymous flow: x = x + v * dt
                    r = stripDt(term.expr, dt);
                    var label = fmt(r || term.expr);
                    nAnon += 1;
                    f = {id: '~f' + nAnon, kind: 'flow', name: null, label: label,
                         from: term.sign < 0 ? name : null, to: term.sign > 0 ? name : null,
                         term: code(term.expr, 4, true), code: code(term.expr),
                         definition: fmt(term.expr), rate: r ? label : null,
                         deps: without(variables(term.expr), [dt])};
                    flows.push(add(f));
                }
            }
        }
    }
    for (i = 0; i < flows.length; i++) {
        if (flows[i].to) elements[flows[i].to].inflows.push(flows[i].id);
        if (flows[i].from) elements[flows[i].from].outflows.push(flows[i].id);
    }

    // --- voorvallen (toestandsvariabele verandert binnen als..dan) en stopvoorwaarden
    var events = {}, nEvents = 0;
    for (i = 0; i < regels.assign.length; i++) {
        a = regels.assign[i];
        if (!a.conds.length || !isStock[a.name] || a.name == time) continue;
        key = fmtConds(a.conds);
        if (!events.hasOwnProperty(key)) {
            nEvents += 1;
            events[key] = add({id: '~e' + nEvents, kind: 'event', name: null,
                               label: 'voorval ' + nEvents, condition: key, actions: [],
                               targets: [], deps: condVars(a.conds)});
        }
        var ev = events[key];
        ev.actions.push(a.name + ' = ' + fmt(a.expr));
        addAll(ev.targets, [a.name]);
        addAll(ev.deps, variables(a.expr));
    }
    for (key in events) {
        if (events.hasOwnProperty(key)) {
            events[key].deps = without(events[key].deps, events[key].targets.concat([dt]));
        }
    }
    // stopvoorwaarde: a diamond without arrows, as in Coach and the exam 2026-II (Ek < 0)
    var stops = [];
    for (i = 0; i < regels.stops.length; i++) {
        stops.push(fmtConds(regels.stops[i]));
        add({id: '~s' + (i + 1), kind: 'stop', name: null, label: 'stop', condition: stops[i]});
    }

    // --- hulpvariabelen
    for (i = 0; i < assignOrder.length; i++) {
        name = assignOrder[i];
        if (isStock[name] || name == time || flowOfVar[name]) continue;
        var defs = [], deps = [], cdeps = [];
        var as = assigned[name].uncond.concat(assigned[name].cond);
        for (j = 0; j < as.length; j++) {
            defs.push(as[j].conds.length ? 'als ' + fmtConds(as[j].conds) + ' dan ' + fmt(as[j].expr) : fmt(as[j].expr));
            addAll(deps, variables(as[j].expr));
            addAll(cdeps, condVars(as[j].conds));
        }
        var conditional = assigned[name].uncond.length === 0;
        if (conditional && init.hasOwnProperty(name)) defs.push('anders ' + fmt(init[name]) + ' (startwaarde)');
        add({id: name, kind: 'aux', name: name, definition: defs.join('; '),
             code: assigned[name].uncond.length == 1 && !assigned[name].cond.length ? code(assigned[name].uncond[0].expr) : null,
             conditional: conditional, deps: without(addAll(deps.slice(), cdeps), [name, dt]),
             condDeps: without(cdeps, deps)});
    }

    // --- constanten (alleen startwaarden)
    for (i = 0; i < initOrder.length; i++) {
        name = initOrder[i];
        if (elements.hasOwnProperty(name) || isStock[name] || name == time || name == dt) continue;
        // vx = v0 * cos(alfa): relation arrows from v0 and alfa
        add({id: name, kind: 'const', name: name, definition: fmt(init[name]), code: code(init[name]),
             deps: without(variables(init[name]), [name, dt, time])});
    }

    // --- relatiepijlen
    var links = [], seen = {};
    var idOf = function(v) { return flowOfVar[v] && !elements[v] ? flowOfVar[v].id : v; };
    var showTime = false;
    for (i = 0; i < order.length; i++) {
        var el = elements[order[i]];
        if (el.kind == 'stock' && init.hasOwnProperty(el.id)) {
            // beginwaarde as a formula: vx = v0 * cos(alfa)
            var ideps = without(variables(init[el.id]), [el.id, dt, time]);
            for (j = 0; j < ideps.length; j++) {
                if (elements.hasOwnProperty(idOf(ideps[j]))) links.push({from: idOf(ideps[j]), to: el.id, kind: 'initial', start: true});
            }
        }
        if (!el.deps) continue;
        for (j = 0; j < el.deps.length; j++) {
            var d = el.deps[j];
            if (d == dt) continue;
            if (d == time) showTime = true;
            else if (!elements.hasOwnProperty(idOf(d))) {
                // element met vraagteken
                add({id: d, kind: 'unknown', name: d, definition: '? (geen startwaarde of formule)', deps: []});
            }
            var lk = idOf(d) + '>' + el.id;
            if (!seen[lk]) {
                seen[lk] = true;
                // condition: only used in 'als ... dan' of a hulpvariabele (drawn lighter)
                // start: from a formula in the startwaarden (Fz = m * g), not drawn in the exam style
                links.push({from: idOf(d), to: el.id,
                            kind: el.condDeps && el.condDeps.indexOf(d) != -1 ? 'condition' : 'relation',
                            start: el.kind == 'const'});
            }
        }
        if (el.kind == 'event') {
            for (j = 0; j < el.targets.length; j++) links.push({from: el.id, to: el.targets[j], kind: 'action'});
        }
    }
    if (showTime) {
        add({id: time, kind: 'time', name: time, definition: 'onafhankelijke variabele, stap ' + dt +
             (init.hasOwnProperty(dt) ? ' = ' + fmt(init[dt]) : ''), deps: []});
    }

    return {elements: elements, order: order, flows: flows, links: links,
            time: time, dt: dt, dtValue: init.hasOwnProperty(dt) ? fmt(init[dt]) : null,
            timeStart: time && init.hasOwnProperty(time) ? fmt(init[time]) : null,
            stops: stops};
}


// ------------------------------------------------------------------ lines

function lines(g, startwaarden_ast, modelregels_ast) {
    // which lines of the text belong to which element of the diagram.
    //   byElement: id --> {startwaarden: [line, ...], modelregels: [line, ...]}   (1-based)
    //   byLine:    'startwaarden:3' --> id
    // A line where a toestandsvariabele is updated also belongs to its unnamed flows.
    var byElement = {}, byLine = {}, i, j, a, id;

    function idOf(name) {
        if (g.elements.hasOwnProperty(name)) return name;
        for (var k = 0; k < g.flows.length; k++) {
            // step: dv in dv = a * dt, when a is the flow
            if (g.flows[k].name == name || g.flows[k].step == name) return g.flows[k].id;
        }
        return null;
    }
    function put(id, editor, line, owner) {
        if (id === null || !line) return;
        var el = byElement[id] = byElement[id] || {startwaarden: [], modelregels: []};
        if (el[editor].indexOf(line) == -1) el[editor].push(line);
        if (owner && !byLine.hasOwnProperty(editor + ':' + line)) byLine[editor + ':' + line] = id;
    }

    var start = collect(startwaarden_ast || [], [], {assign: [], stops: []}).assign;
    for (i = 0; i < start.length; i++) put(idOf(start[i].name), 'startwaarden', start[i].line, true);

    var regels = collect(modelregels_ast || [], [], {assign: [], stops: []}).assign;
    for (i = 0; i < regels.length; i++) {
        a = regels[i];
        id = idOf(a.name);
        var el = id !== null ? g.elements[id] : null;
        if (el && el.kind == 'stock' && a.conds.length) {
            // x changes inside 'als ... dan': the line of the voorval
            var key = fmtConds(a.conds);
            for (j = 0; j < g.order.length; j++) {
                var ev = g.elements[g.order[j]];
                if (ev.kind == 'event' && ev.condition == key && ev.targets.indexOf(a.name) != -1) id = ev.id;
            }
        } else if (el && el.kind == 'stock') {
            // the flows of x are in this line: x = x + dx  or  x = x + v * dt
            for (j = 0; j < g.flows.length; j++) {
                var f = g.flows[j];
                if (f.to == a.name || f.from == a.name) put(f.id, 'modelregels', a.line, false);
            }
        }
        put(id, 'modelregels', a.line, true);
    }
    var stops = collect(modelregels_ast || [], [], {assign: [], stops: []}).stops;
    for (i = 0; i < stops.length; i++) {
        if (g.elements.hasOwnProperty('~s' + (i + 1))) put('~s' + (i + 1), 'modelregels', stops[i].line, true);
    }
    return {byElement: byElement, byLine: byLine};
}


// ------------------------------------------------------------------ table

var KIND_NAMES = {stock: 'Toestandsvariabele', flow: 'Stroomvariabele', aux: 'Hulpvariabele',
                  'const': 'Constante', event: 'Voorval', time: 'Onafhankelijke variabele',
                  unknown: 'Onbekend'};
var KIND_ORDER = ['stock', 'flow', 'aux', 'const', 'event', 'time', 'unknown'];

function table(g) {
    var rows = [], i, k, el, def;
    for (k = 0; k < KIND_ORDER.length; k++) {
        for (i = 0; i < g.order.length; i++) {
            el = g.elements[g.order[i]];
            if (el.kind != KIND_ORDER[k]) continue;
            if (el.kind == 'stock') {
                var change = [];
                for (var j = 0; j < el.inflows.length; j++) change.push('+ ' + g.elements[el.inflows[j]].label);
                for (j = 0; j < el.outflows.length; j++) change.push('− ' + g.elements[el.outflows[j]].label);
                def = 'beginwaarde ' + el.initial + (change.length ? '; verandering: ' + change.join(' ') : '');
            } else if (el.kind == 'flow') {
                def = (el.name ? el.name + ' = ' : '') + el.definition +
                    (el.isRate ? '  (per ' + g.dt + ')' :
                     el.rate !== null ? '  (per ' + g.dt + ': ' + el.rate + ')' : '  (per stap)') +
                    (el.step ? '; ' + el.step + ' = ' + el.stepDefinition : '') +
                    '; van ' + (el.from || 'buiten') + ' naar ' + (el.to || 'buiten');
            } else if (el.kind == 'event') {
                def = 'als ' + el.condition + ' dan ' + el.actions.join('; ');
            } else {
                def = el.definition;
            }
            rows.push({kind: KIND_NAMES[el.kind], name: el.name || el.label, definition: def, id: el.id});
        }
    }
    for (i = 0; i < g.stops.length; i++) {
        rows.push({kind: 'Stopvoorwaarde', name: '', definition: g.stops[i],
                   id: g.elements.hasOwnProperty('~s' + (i + 1)) ? '~s' + (i + 1) : undefined});
    }
    return rows;
}


// ------------------------------------------------------------------ layout

var L = {stockW: 96, stockH: 46, flowLen: 116, cloud: 44, chainGap: 64, layerH: 92, gap: 100};

function mean(list) {
    var s = 0;
    for (var i = 0; i < list.length; i++) s += list[i];
    return s / list.length;
}

function view(g, opts) {
    // what is drawn. Exam style: no arrows from formulas in the startwaarden (Fz = m * g,
    // Ek = 1/2 * m * v^2) and no constante that is only used there (g), as in the exam 2026-II
    var exam = !(opts && opts.stijl == 'kleur');
    var links = [], hidden = {}, used = {}, i, lk;
    for (i = 0; i < g.links.length; i++) {
        lk = g.links[i];
        if (exam && lk.start) continue;
        links.push(lk);
        used[lk.from] = true;
        used[lk.to] = true;
    }
    for (i = 0; i < g.links.length && exam; i++) {
        lk = g.links[i];
        if (lk.start && !used[lk.from] && g.elements[lk.from].kind == 'const') hidden[lk.from] = true;
    }
    return {links: links, hidden: hidden};
}

function layout(g, opts) {
    // opts.stijl: 'examen' (default) or 'kleur': the exam style leaves out some elements (see view)
    var vw = view(g, opts);
    var pos = {}, i, j, f, s, el, chain, links;
    var flowGeom = {};
    var stocks = [];
    for (i = 0; i < g.order.length; i++) if (g.elements[g.order[i]].kind == 'stock') stocks.push(g.order[i]);

    function flowsWhere(test) {
        var out = [];
        for (var k = 0; k < g.flows.length; k++) if (test(g.flows[k])) out.push(g.flows[k]);
        return out;
    }

    // --- chains of stocks connected by flows
    var visited = {}, placed = {}, x = 0, chains = [], chainOf = {};
    for (i = 0; i < stocks.length; i++) {
        if (visited[stocks[i]]) continue;
        var first = stocks[i], back = {};
        back[first] = true;
        for (;;) {
            var pred = flowsWhere(function(fl) { return fl.to == first && fl.from && !visited[fl.from] && !back[fl.from]; });
            if (!pred.length) break;
            first = pred[0].from;
            back[first] = true;
        }
        chain = []; links = [];
        var cur = first;
        while (cur && !visited[cur]) {
            visited[cur] = true;
            chain.push(cur);
            var next = flowsWhere(function(fl) { return fl.from == cur && fl.to && !visited[fl.to]; });
            links.push(next.length ? next[0] : null);
            cur = next.length ? next[0].to : null;
        }
        for (j = 0; j < chain.length; j++) chainOf[chain[j]] = chains.length;
        chains.push({stocks: chain, links: links});
    }

    // --- order of the chains: a chain whose stock is the rate of a flow in another chain
    //     (v in x = x + v*dt) is placed directly left of that chain: v, x
    var feeds = [], fedBy = [], c;
    for (c = 0; c < chains.length; c++) { feeds.push([]); fedBy.push([]); }
    for (i = 0; i < g.flows.length; i++) {
        f = g.flows[i];
        var target = f.to || f.from;
        if (f.deps.length != 1 || !chainOf.hasOwnProperty(f.deps[0])) continue;
        var cs = chainOf[f.deps[0]], ct = chainOf[target];
        if (cs == ct || feeds[cs].indexOf(ct) != -1) continue;
        feeds[cs].push(ct);
        fedBy[ct].push(cs);
    }
    var chainOrder = [], marked = {};
    var placeChain = function(k) {
        if (marked[k]) return;
        marked[k] = true;
        for (var m = 0; m < fedBy[k].length; m++) placeChain(fedBy[k][m]);
        chainOrder.push(k);
        for (m = 0; m < feeds[k].length; m++) placeChain(feeds[k][m]);
    };
    for (c = 0; c < chains.length; c++) placeChain(c);

    // --- chains side by side on one row
    for (c = 0; c < chainOrder.length; c++) {
        chain = chains[chainOrder[c]].stocks;
        links = chains[chainOrder[c]].links;
        for (j = 0; j < chain.length; j++) {
            s = chain[j];
            if (j === 0) {
                f = flowsWhere(function(fl) { return fl.to == s && !fl.from; })[0];
                if (f) {
                    flowGeom[f.id] = {src: {x: x + L.cloud / 2, y: 0}, valve: {x: x + L.cloud + L.flowLen / 2, y: 0}};
                    placed[f.id] = true;
                    x += L.cloud + L.flowLen;
                }
            } else {
                f = links[j - 1];
                flowGeom[f.id] = {valve: {x: x + L.flowLen / 2, y: 0}};
                placed[f.id] = true;
                x += L.flowLen;
            }
            pos[s] = {x: x + L.stockW / 2, y: 0};
            x += L.stockW;
            if (j == chain.length - 1) {
                f = flowsWhere(function(fl) { return fl.from == s && !fl.to; })[0];
                if (f) {
                    flowGeom[f.id] = {valve: {x: x + L.flowLen / 2, y: 0}, dst: {x: x + L.flowLen + L.cloud / 2, y: 0}};
                    placed[f.id] = true;
                    x += L.flowLen + L.cloud;
                }
            }
        }
        x += L.chainGap;
    }

    // --- remaining flows: vertical below the stock (cloud) or a detour below (stock to stock)
    var extra = {}, below = 0;
    for (i = 0; i < g.flows.length; i++) {
        f = g.flows[i];
        if (placed[f.id]) continue;
        if (f.from && f.to) {
            var a = pos[f.from], b = pos[f.to];
            below = Math.max(below, 1);
            flowGeom[f.id] = {valve: {x: (a.x + b.x) / 2, y: L.stockH / 2 + 50}, detour: true};
        } else {
            s = f.from || f.to;
            extra[s] = (extra[s] || 0) + 1;
            below = 2;
            var dx = (extra[s] - 1) * 34 * (extra[s] % 2 ? 1 : -1);
            flowGeom[f.id] = {valve: {x: pos[s].x + dx, y: L.stockH / 2 + 46}};
            if (f.from) flowGeom[f.id].dst = {x: pos[s].x + dx, y: L.stockH / 2 + 100};
            else flowGeom[f.id].src = {x: pos[s].x + dx, y: L.stockH / 2 + 100};
        }
    }
    for (i = 0; i < g.flows.length; i++) {
        f = g.flows[i];
        pos[f.id] = flowGeom[f.id].valve;
        if (flowGeom[f.id].src) pos[f.id + ':src'] = flowGeom[f.id].src;
        if (flowGeom[f.id].dst) pos[f.id + ':dst'] = flowGeom[f.id].dst;
    }

    // --- other elements in layers: inputs above the row, outputs below
    var isRow = function(id) { var k = g.elements[id].kind; return k == 'stock' || k == 'flow'; };
    var others = [], targets = {}, sources = {};
    for (i = 0; i < g.order.length; i++) {
        var id = g.order[i];
        targets[id] = [];
        sources[id] = [];
        if (!isRow(id) && !vw.hidden[id] && g.elements[id].kind != 'stop') others.push(id);
    }
    // beginwaarde arrows only position elements that have no other arrows (alfa in vx = v0*cos(alfa))
    var other = {}, lk;
    for (i = 0; i < vw.links.length; i++) {
        lk = vw.links[i];
        if (lk.kind != 'initial') { other[lk.from] = true; other[lk.to] = true; }
    }
    for (i = 0; i < vw.links.length; i++) {
        lk = vw.links[i];
        if (lk.kind == 'initial' && other[lk.from]) continue;
        targets[lk.from].push(lk.to);
        sources[lk.to].push(lk.from);
    }
    var dist = {}, n, changed, iter;
    for (i = 0; i < g.order.length; i++) dist[g.order[i]] = isRow(g.order[i]) ? 0 : Infinity;
    for (iter = 0, changed = true; changed && iter < 200; iter++) {
        changed = false;
        for (i = 0; i < others.length; i++) {
            n = others[i];
            for (j = 0; j < targets[n].length; j++) {
                if (dist[targets[n][j]] + 1 < dist[n]) { dist[n] = dist[targets[n][j]] + 1; changed = true; }
            }
        }
    }
    var layers = {}, maxUp = 0, unused = [], outputs = [];
    for (i = 0; i < others.length; i++) {
        n = others[i];
        if (!targets[n].length && !sources[n].length) unused.push(n);
        else if (dist[n] < Infinity) {
            (layers[dist[n]] = layers[dist[n]] || []).push(n);
            maxUp = Math.max(maxUp, dist[n]);
        } else outputs.push(n);
    }
    // outputs: depth below the row (longest path), source-less inputs share the layer of their target
    var depth = {}, isOut = {};
    for (i = 0; i < outputs.length; i++) isOut[outputs[i]] = true;
    var hasSrc = function(id) { return sources[id].length > 0; };
    for (i = 0; i < outputs.length; i++) depth[outputs[i]] = 1;
    for (iter = 0, changed = true; changed && iter < 50; iter++) {
        changed = false;
        for (i = 0; i < outputs.length; i++) {
            n = outputs[i];
            if (!hasSrc(n)) continue;
            for (j = 0; j < sources[n].length; j++) {
                var src = sources[n][j];
                if (isOut[src] && hasSrc(src) && depth[src] + 1 > depth[n]) { depth[n] = depth[src] + 1; changed = true; }
            }
        }
    }
    for (i = 0; i < outputs.length; i++) {
        n = outputs[i];
        if (!hasSrc(n)) {
            var ds = [];
            for (j = 0; j < targets[n].length; j++) if (isOut[targets[n][j]]) ds.push(depth[targets[n][j]]);
            depth[n] = ds.length ? Math.min.apply(null, ds) : 1;
        }
        (layers[-depth[n]] = layers[-depth[n]] || []).push(n);
    }
    if (unused.length) {
        maxUp += 1;
        layers[maxUp] = (layers[maxUp] || []).concat(unused);
    }

    var belowY = L.stockH / 2 + (below == 2 ? 150 : below == 1 ? 110 : 60);
    function place(layer, y, neighbours) {
        var wanted = [];
        for (var k = 0; k < layer.length; k++) {
            var xs = [], nb = neighbours(layer[k]);
            for (var m = 0; m < nb.length; m++) if (pos[nb[m]]) xs.push(pos[nb[m]].x);
            wanted.push({id: layer[k], x: xs.length ? mean(xs) : null});
        }
        // no placed neighbours: next to the others
        var right = -Infinity;
        for (k = 0; k < wanted.length; k++) if (wanted[k].x !== null) right = Math.max(right, wanted[k].x);
        if (right == -Infinity) right = 0;
        for (k = 0; k < wanted.length; k++) if (wanted[k].x === null) { right += L.gap; wanted[k].x = right; }
        wanted.sort(function(p, q) { return p.x - q.x; });
        for (var it = 0; it < 200; it++) {
            var moved = false;
            for (k = 0; k + 1 < wanted.length; k++) {
                var over = L.gap - (wanted[k + 1].x - wanted[k].x);
                if (over > 0.5) { wanted[k].x -= over / 2; wanted[k + 1].x += over / 2; moved = true; }
            }
            if (!moved) break;
        }
        for (k = 0; k < wanted.length; k++) pos[wanted[k].id] = {x: wanted[k].x, y: y};
    }
    for (var up = 1; up <= maxUp; up++) {
        if (layers[up]) place(layers[up], -up * L.layerH, function(id) { return targets[id].length ? targets[id] : sources[id]; });
    }
    for (var down = 1; layers[-down]; down++) {
        place(layers[-down], belowY + (down - 1) * L.layerH, function(id) { return sources[id].length ? sources[id] : targets[id]; });
    }
    // a few sweeps: move every element towards all its neighbours (fewer long, crossing arrows)
    var both = function(id) { return sources[id].concat(targets[id]); };
    for (var sweep = 0; sweep < 4; sweep++) {
        for (var key in layers) {
            if (layers.hasOwnProperty(key)) place(layers[key], pos[layers[key][0]].y, both);
        }
    }
    // stopvoorwaarden: top left, left of everything else, as in the exam 2026-II
    var stops = [], minX = Infinity, minY = Infinity;
    for (var pid in pos) {
        if (pos.hasOwnProperty(pid)) { minX = Math.min(minX, pos[pid].x); minY = Math.min(minY, pos[pid].y); }
    }
    if (minX == Infinity) { minX = 0; minY = 0; }
    for (i = 0; i < g.order.length; i++) if (g.elements[g.order[i]].kind == 'stop') stops.push(g.order[i]);
    for (i = 0; i < stops.length; i++) pos[stops[i]] = {x: minX - 0.8 * L.gap, y: minY + i * 0.8 * L.layerH};
    return {pos: pos, flows: flowGeom};
}


// ------------------------------------------------------------------ SVG

// Two styles (opts.stijl):
//
//   'examen': the graphical models in the central exams natuurkunde vwo (examenblad.nl),
//             e.g. 2022-I 'Vrije worp bij basketbal' (figuur 5) and 2023-II 'Fietshelm' (figuur 6):
//             black on white symbols on a gray background, a hollow pipe with an open arrow head,
//             ventiel = circle with a tap, hulpvariabele and constante the same circle, name below.
//
//   'kleur':  the colors of Coach 7 (CMA): blue symbols and names, red relatiepijlen, on white.
//             The meaning of the symbols as in Coach 7, see A. Heck, Guide on modelling (UvA),
//             https://staff.fnwi.uva.nl/a.j.p.heck/Guide_on_modelling/Text/grafischmodelleren.html
//             (Fig 3.10 'A graphical model in Coach 7'):
//               toestandsvariabele  rectangle
//               hulpvariabele       circle ('indicated by a circle')
//               constante           'a circle with two extra line segments on each side'
//             (the same constante symbol is in the exam 2018-I 'Uitrijden van een auto', figuur 2).
//             Our own: softer colors (Coach 7 uses #0000ff and #ff0000), a light blue fill, a bow tie
//             as valve and a dashed circle for a flow from/to outside the model (Coach 7: open end).
var STIJLEN = {
    examen: {line: '#000', fill: '#fff', bg: '#d4d4d4', red: '#c62828', text: '#000', grey: '#555',
             arrow: '#000', font: 'Times New Roman, Times, serif', size: 15,
             aux: 13, constant: 13, valve: 10, gap: 2},
    kleur: {line: '#1f5fa8', fill: '#dceaf8', bg: '#fff', red: '#c62828', text: '#1d2733', grey: '#6b7785',
            arrow: '#c62828', font: 'Segoe UI, Helvetica, Arial, sans-serif', size: 13,
            aux: 18, constant: 11, valve: 9, gap: 3, outside: 10}
};

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function radius(el, dx, dy, S) {
    // distance from center to the border of the symbol in direction (dx, dy)
    switch (el.kind) {
        case 'stock':
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            var tx = Math.abs(dx) > 1e-9 ? (L.stockW / 2) / Math.abs(dx) : Infinity;
            var ty = Math.abs(dy) > 1e-9 ? (L.stockH / 2) / Math.abs(dy) : Infinity;
            return Math.min(tx, ty) * len + 3;
        case 'flow': return S.valve + S.gap + 1;
        case 'const': return S.constant + S.gap;
        case 'event': return 16;
        case 'stop': return 15;
        default: return S.aux + S.gap;
    }
}

function pipeEnd(x, y, S) {
    // the open end of a flow from or to outside the model.
    // examen: not drawn (an invisible area to drag it), kleur: a dashed circle
    if (!S.outside) {
        return '<circle class="end" cx="' + x + '" cy="' + y + '" r="12" fill="#000" fill-opacity="0" stroke="none"/>';
    }
    return '<circle cx="' + x + '" cy="' + y + '" r="' + S.outside + '" fill="#fff" stroke="' + S.line +
        '" stroke-width="1.5" stroke-dasharray="3 2.5"/>';
}

function pipe(points, out, S) {
    // pipe with an arrow head at the end.
    // examen: hollow (white with a black border), open arrow head. kleur: blue, filled arrow head.
    var n = points.length, p = points[n - 1], q = points[n - 2];
    var ux = p.x - q.x, uy = p.y - q.y, l = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= l; uy /= l;
    var d, i;
    if (S.outside) {
        d = 'M' + points[0].x + ',' + points[0].y;
        for (i = 1; i < n; i++) d += ' L' + points[i].x + ',' + points[i].y;
        out.push('<path d="' + d + '" fill="none" stroke="' + S.line + '" stroke-width="8" stroke-linejoin="round"/>');
        out.push('<path d="' + d + '" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>');
        out.push('<path d="M' + (p.x + ux * 4) + ',' + (p.y + uy * 4) +
            ' L' + (p.x - ux * 10 - uy * 9) + ',' + (p.y - uy * 10 + ux * 9) +
            ' L' + (p.x - ux * 10 + uy * 9) + ',' + (p.y - uy * 10 - ux * 9) + ' z" fill="' + S.line + '"/>');
        return;
    }
    var head = 17, half = 10;
    var base = {x: p.x - ux * head, y: p.y - uy * head};
    // closed start: the border goes a little further back than the white inside
    var s0 = points[0], s1 = points[1];
    var vx = s1.x - s0.x, vy = s1.y - s0.y, m = Math.sqrt(vx * vx + vy * vy) || 1;
    var path = function(first) {
        var dd = 'M' + first.x.toFixed(1) + ',' + first.y.toFixed(1);
        for (var k = 1; k < n - 1; k++) dd += ' L' + points[k].x + ',' + points[k].y;
        return dd + ' L' + base.x.toFixed(1) + ',' + base.y.toFixed(1);
    };
    out.push('<path d="' + path({x: s0.x - vx / m * 1.5, y: s0.y - vy / m * 1.5}) +
        '" fill="none" stroke="' + S.line + '" stroke-width="10" stroke-linejoin="round"/>');
    out.push('<path d="' + path(s0) + '" fill="none" stroke="' + S.fill + '" stroke-width="7" stroke-linejoin="round"/>');
    out.push('<path d="M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
        ' L' + (base.x - uy * half).toFixed(1) + ',' + (base.y + ux * half).toFixed(1) +
        ' L' + (base.x + uy * half).toFixed(1) + ',' + (base.y - ux * half).toFixed(1) + ' z"' +
        ' fill="' + S.fill + '" stroke="' + S.line + '" stroke-width="1.5" stroke-linejoin="miter"/>');
}

function linkStyle(kind, S) {
    var w = S.outside ? 1.4 : 1.3;
    switch (kind) {
        // only in the condition of 'als ... dan': lighter
        case 'condition': return 'stroke="' + S.arrow + '" stroke-width="1.1" stroke-opacity="0.45" stroke-dasharray="2 3" marker-end="url(#ar)"';
        // beginwaarde of a toestandsvariabele
        case 'initial': return 'stroke="' + S.grey + '" stroke-width="1.1" stroke-dasharray="4 3" marker-end="url(#ag)"';
        // voorval changes a toestandsvariabele
        case 'action': return 'stroke="' + S.line + '" stroke-width="' + w + '" stroke-dasharray="5 3" marker-end="url(#ab)"';
        default: return 'stroke="' + S.arrow + '" stroke-width="' + w + '" marker-end="url(#ar)"';
    }
}

function marker(id, color, S) {
    // arrow head of a relatiepijl. examen: slender (as in the exams), kleur: a triangle
    if (S.outside) {
        return '<marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
            '<path d="M0,0 L10,5 L0,10 z" fill="' + color + '"/></marker>';
    }
    return '<marker id="' + id + '" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="9" markerHeight="7.5" ' +
        'orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,1 L12,5 L0,9 L2.5,5 z" fill="' + color + '"/></marker>';
}

function unit(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l = Math.sqrt(dx * dx + dy * dy);
    return l > 1e-9 ? {x: dx / l, y: dy / l} : {x: 1, y: 0};
}

function toSVG(g, lay, opts) {
    // lay: layout(g), possibly with positions changed by the user (lay.pos[id] = {x, y}).
    //      Open ends of a flow are lay.pos[flowId + ':src'] and lay.pos[flowId + ':dst'].
    // opts.stijl: 'examen' (default) or 'kleur', see STIJLEN
    // opts.bounds: {minX, minY, maxX, maxY}: draw at least this area (no jumps while dragging)
    // opts.used: filled with the bounds of this drawing
    // opts.selected: id of the selected element (a toestandsvariabele gets + buttons for new flows)
    // opts.values: name --> {first, last}: values after a run, in the tooltip
    opts = opts || {};
    lay = lay || layout(g, opts);
    var vw = view(g, opts);
    var S = STIJLEN.hasOwnProperty(opts.stijl) ? STIJLEN[opts.stijl] : STIJLEN.examen;
    var exam = !S.outside;
    var pos = lay.pos, out = [], i, el, p, id;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (opts.bounds) {
        minX = opts.bounds.minX; minY = opts.bounds.minY; maxX = opts.bounds.maxX; maxY = opts.bounds.maxY;
    }
    var grow = function(x, y, r) {
        minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
        minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
    };

    // flows (pipes) first: source (stock or open end) --> valve --> destination (stock or open end)
    var valveDir = {};
    for (i = 0; i < g.flows.length; i++) {
        var f = g.flows[i], v = pos[f.id];
        var a = f.from ? pos[f.from] : pos[f.id + ':src'];
        var b = f.to ? pos[f.to] : pos[f.id + ':dst'];
        var u0 = unit(a, v), u1 = unit(v, b);
        // examen: the arrow head touches the stock, kleur: a small gap
        var ra = f.from ? radius(g.elements[f.from], u0.x, u0.y, S) + (exam ? -3 : 0) : (exam ? 0 : S.outside + 1);
        var rb = f.to ? radius(g.elements[f.to], -u1.x, -u1.y, S) + (exam ? -3 : 3) : (exam ? 0 : S.outside + 5);
        var start = {x: a.x + u0.x * ra, y: a.y + u0.y * ra}, end = {x: b.x - u1.x * rb, y: b.y - u1.y * rb};
        var straight = Math.abs(u0.x * u1.y - u0.y * u1.x) < 1e-3 && (u0.x * u1.x + u0.y * u1.y) > 0;
        pipe(straight ? [start, end] : [start, v, end], out, S);
        var ud = unit(a, b);
        valveDir[f.id] = Math.abs(ud.y) > Math.abs(ud.x) ? 'v' : 'h';
        if (!f.from) {
            out.push('<g data-id="' + esc(f.id) + ':src">' + pipeEnd(a.x, a.y, S) + '</g>');
            grow(a.x, a.y, 12);
        }
        if (!f.to) {
            out.push('<g data-id="' + esc(f.id) + ':dst">' + pipeEnd(b.x, b.y, S) + '</g>');
            grow(b.x, b.y, 12);
        }
    }

    // relation arrows
    for (i = 0; i < vw.links.length; i++) {
        var lk = vw.links[i], s = pos[lk.from], t = pos[lk.to];
        if (!s || !t || vw.hidden[lk.from] || vw.hidden[lk.to]) continue;
        var dx = t.x - s.x, dy = t.y - s.y, len = Math.sqrt(dx * dx + dy * dy) || 1, d;
        var onRow = function(e) { return e.kind == 'stock' || e.kind == 'flow'; };
        if (onRow(g.elements[lk.from]) && onRow(g.elements[lk.to]) && Math.abs(dy) < 1) {
            // both on the row of stocks and flows: arc over the row instead of along the pipes
            var top = function(el) { return el.kind == 'stock' ? -L.stockH / 2 - 2 : -12; };
            var y0 = s.y + top(g.elements[lk.from]), y1 = t.y + top(g.elements[lk.to]) - 3;
            var arcH = Math.min(60, 26 + 0.1 * Math.abs(dx));
            var sx0 = s.x + (dx > 0 ? 8 : -8), ex0 = t.x + (dx > 0 ? -4 : 4);
            d = 'M' + sx0.toFixed(1) + ',' + y0 + ' C' + sx0.toFixed(1) + ',' + (y0 - arcH).toFixed(1) +
                ' ' + ex0.toFixed(1) + ',' + (y1 - arcH).toFixed(1) + ' ' + ex0.toFixed(1) + ',' + y1;
            grow(s.x + dx / 2, y0 - 0.75 * arcH, 4);
        } else {
            var r0 = radius(g.elements[lk.from], dx, dy, S), r1 = radius(g.elements[lk.to], -dx, -dy, S);
            var ux = dx / len, uy = dy / len;
            var sx = s.x + ux * r0, sy = s.y + uy * r0, ex = t.x - ux * (r1 + 2), ey = t.y - uy * (r1 + 2);
            var bend = Math.min(30, 0.12 * len);
            var cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend;
            d = 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) +
                ' ' + ex.toFixed(1) + ',' + ey.toFixed(1);
        }
        out.push('<path d="' + d + '" fill="none" ' + linkStyle(lk.kind, S) + '/>');
    }

    // a relatiepijl leaves or enters a circle at the bottom: its name goes to the right
    // (otherwise below, as in the exams), so the arrow does not cross the name
    var bottom = {}, above = {};
    for (i = 0; i < vw.links.length; i++) {
        var from = pos[vw.links[i].from], to = pos[vw.links[i].to];
        if (!from || !to) continue;
        var dir = unit(from, to);
        if (dir.y > 0.6) bottom[vw.links[i].from] = true;
        if (dir.y < -0.6) bottom[vw.links[i].to] = true;
        // an arrow between two symbols on the row of stocks and flows: arc from above
        var row = function(e) { return e.kind == 'stock' || e.kind == 'flow'; };
        if (dir.y > 0.3 || (row(g.elements[vw.links[i].from]) && row(g.elements[vw.links[i].to]) &&
                            Math.abs(to.y - from.y) < 1)) above[vw.links[i].to] = true;
    }
    var name = function(x, y, r, label, id, cls) {
        cls = (cls || 'name') + ' lbl';
        if (bottom[id]) grow(x + r + 4 + 8 * String(label).length, y, 4);
        return bottom[id] ?
            '<text x="' + (x + r + 4) + '" y="' + (y + 5) + '" class="' + cls + '">' + esc(label) + '</text>' :
            '<text x="' + x + '" y="' + (y + r + 16) + '" text-anchor="middle" class="' + cls + '">' + esc(label) + '</text>';
    };
    var circle = function(x, y, r, fill, stroke, extra) {
        return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke +
            '" stroke-width="' + (exam ? 1.5 : 2) + '"' + (extra || '') + '/>';
    };

    // symbols
    for (i = 0; i < g.order.length; i++) {
        id = g.order[i];
        el = g.elements[id];
        p = pos[id];
        if (!p || vw.hidden[id]) continue;
        var tip = '<title>' + esc(tooltip(g, el) + valueText(el, opts.values)) + '</title>';
        out.push('<g data-id="' + esc(id) + '">');
        var x = p.x, y = p.y, label = el.name || el.label;
        switch (el.kind) {
            case 'stock':
                // rectangle, name inside
                out.push(tip + '<rect x="' + (x - L.stockW / 2) + '" y="' + (y - L.stockH / 2) + '" width="' + L.stockW +
                    '" height="' + L.stockH + '"' + (exam ? '' : ' rx="3"') + ' fill="' + S.fill + '" stroke="' + S.line +
                    '" stroke-width="' + (exam ? 1.5 : 2) + '"/>' +
                    '<text x="' + x + '" y="' + (y + (exam ? 6 : 5)) + '" text-anchor="middle" class="name stock">' + esc(label) + '</text>');
                grow(x, y, L.stockW / 2 + 4);
                break;
            case 'flow':
                if (exam) {
                    // ventiel: a circle on the pipe with a tap. An arrow from above: the tap below
                    var flip = above[id] && !bottom[id];
                    out.push(tip + valve(x, y, valveDir[id], flip, S) +
                        name(x, flip && valveDir[id] != 'v' ? y + 7 : y, S.valve, shorten(label), id));
                } else {
                    out.push(tip + valve(x, y, valveDir[id], false, S) + name(x, y, 12, shorten(label), id, 'small'));
                }
                grow(x, y + 20, 30);
                break;
            case 'aux':
                out.push(tip + circle(x, y, S.aux, S.fill, S.line, el.conditional ? ' stroke-dasharray="4 2"' : '') +
                    name(x, y, S.aux, label, id));
                grow(x, y + 10, 30);
                break;
            case 'const':
                // examen: the same circle as a hulpvariabele.
                // kleur: as Coach 7, a small circle with a line segment on each side
                var tick = exam ? 0 : 6;
                out.push(tip + circle(x, y, S.constant, S.fill, S.line) + (exam ? '' :
                    '<path d="M' + (x - S.constant - tick) + ',' + y + ' H' + (x - S.constant) +
                    ' M' + (x + S.constant) + ',' + y + ' H' + (x + S.constant + tick) + '" stroke="' + S.line + '" stroke-width="2"/>') +
                    name(x, y, S.constant + (bottom[id] ? tick : 0), label, id));
                grow(x, y + 10, 30);
                break;
            case 'event':
                out.push(tip + '<path d="M' + (x + 3) + ',' + (y - 15) + ' L' + (x - 9) + ',' + (y + 2) + ' L' + (x - 1) + ',' + (y + 2) +
                    ' L' + (x - 4) + ',' + (y + 15) + ' L' + (x + 9) + ',' + (y - 3) + ' L' + (x + 1) + ',' + (y - 3) + ' z"' +
                    (exam ? ' fill="' + S.fill + '" stroke="' + S.line + '" stroke-width="1.5" stroke-linejoin="round"/>' :
                            ' fill="#ffe08a" stroke="#b07d00" stroke-width="1.5"/>') +
                    '<text x="' + x + '" y="' + (y + 30) + '" text-anchor="middle" class="small lbl">' + esc(shorten(el.condition, 22)) + '</text>');
                grow(x, y + 10, 40);
                break;
            case 'stop':
                // stopvoorwaarde: a diamond, the condition below (Coach; exam 2026-II)
                out.push(tip + '<path d="M' + x + ',' + (y - 14) + ' L' + (x + 14) + ',' + y + ' L' + x + ',' + (y + 14) +
                    ' L' + (x - 14) + ',' + y + ' z" fill="' + S.fill + '" stroke="' + (exam ? S.line : S.red) +
                    '" stroke-width="' + (exam ? 1.5 : 2) + '" stroke-linejoin="miter"/>' +
                    '<text x="' + x + '" y="' + (y + 31) + '" text-anchor="middle" class="name lbl">' +
                    esc(shorten(el.condition, 22)) + '</text>');
                grow(x, y + 10, 40);
                break;
            case 'time':
                var rt = exam ? S.aux : 16, hand = exam ? S.line : S.grey;
                out.push(tip + circle(x, y, rt, '#fff', hand) +
                    '<path d="M' + x + ',' + (y - rt + 5) + ' L' + x + ',' + y + ' L' + (x + 6) + ',' + (y + 3) +
                    '" fill="none" stroke="' + hand + '" stroke-width="' + (exam ? 1.5 : 2) + '"/>' + name(x, y, rt, label, id));
                grow(x, y + 10, 30);
                break;
            default:   // unknown
                out.push(tip + circle(x, y, S.aux, exam ? S.fill : '#fdecea', S.red) +
                    '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" fill="' + S.red + '" font-weight="bold">?</text>' +
                    name(x, y, S.aux, label, id));
                grow(x, y + 10, 30);
        }
        out.push('</g>');
    }

    // selected toestandsvariabele: + buttons for a new flow in (left) and out (right)
    el = opts.selected !== undefined && g.elements.hasOwnProperty(opts.selected) ? g.elements[opts.selected] : null;
    if (el && el.kind == 'stock' && pos[el.id] && !el.general && el.updates == 1) {
        p = pos[el.id];
        [['in', -1, 'Nieuwe stroom naar ' + el.name], ['out', 1, 'Nieuwe stroom uit ' + el.name]].forEach(function(h) {
            var hx = p.x + h[1] * (L.stockW / 2), hy = p.y - L.stockH / 2;
            out.push('<g data-action="flow-' + h[0] + '" data-stock="' + esc(el.id) + '" class="handle">' +
                '<title>' + esc(h[2]) + '</title>' +
                '<circle cx="' + hx + '" cy="' + hy + '" r="10" fill="#fff" stroke="#d97706" stroke-width="2"/>' +
                '<path d="M' + (hx - 5) + ',' + hy + ' H' + (hx + 5) + ' M' + hx + ',' + (hy - 5) + ' V' + (hy + 5) + '"' +
                ' stroke="#b45309" stroke-width="2.2" stroke-linecap="round"/></g>');
            grow(hx, hy, 12);
        });
    }

    if (minX == Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 50; }
    opts.used = {minX: minX, minY: minY, maxX: maxX, maxY: maxY};
    var pad = 12, w = maxX - minX + 2 * pad, h = maxY - minY + 2 * pad;
    var vbX = (minX - pad).toFixed(0), vbY = (minY - pad).toFixed(0);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vbX + ' ' + vbY + ' ' +
        w.toFixed(0) + ' ' + h.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '"' +
        ' font-family="' + S.font + '" font-size="' + S.size + '" fill="' + S.text + '">' +
        '<style>' + (exam ? '.name{font-style:italic}' : '.stock{font-weight:bold}') +
        '.lbl{paint-order:stroke;stroke:' + S.bg + ';stroke-width:3px;stroke-linejoin:round}' +
        '.small{font-size:' + (exam ? 12 : 11) + 'px;fill:' + S.grey + '}</style>' +
        '<defs>' + marker('ar', S.arrow, S) + marker('ab', S.line, S) + marker('ag', S.grey, S) + '</defs>' +
        '<rect class="bg" x="' + vbX + '" y="' + vbY + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) +
        '" fill="' + S.bg + '"/>' + out.join('') + '</svg>';
}

function valve(x, y, dir, flip, S) {
    // examen: ventiel, a circle on the pipe with a tap (dir: 'h' horizontal or 'v' vertical pipe;
    //         tap above or left, flip: below or right)
    // kleur: bow tie across the pipe
    var r = S.valve, d;
    if (S.outside) {
        d = dir == 'v' ?
            'M' + (x - r) + ',' + (y - r) + ' L' + (x + r) + ',' + (y - r) + ' L' + (x - r) + ',' + (y + r) + ' L' + (x + r) + ',' + (y + r) + ' z' :
            'M' + (x - r) + ',' + (y - r) + ' L' + (x + r) + ',' + (y + r) + ' L' + (x + r) + ',' + (y - r) + ' L' + (x - r) + ',' + (y + r) + ' z';
        return '<path d="' + d + '" fill="' + S.fill + '" stroke="' + S.line + '" stroke-width="2" stroke-linejoin="round"/>';
    }
    var t = r + 6, sg = flip ? -1 : 1;
    d = dir == 'v' ?
        'M' + (x - sg * r) + ',' + y + ' H' + (x - sg * t) + ' M' + (x - sg * t) + ',' + (y - 4) + ' V' + (y + 4) :
        'M' + x + ',' + (y - sg * r) + ' V' + (y - sg * t) + ' M' + (x - 4) + ',' + (y - sg * t) + ' H' + (x + 4);
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + S.fill + '" stroke="' + S.line + '" stroke-width="1.5"/>' +
        '<path d="' + d + '" fill="none" stroke="' + S.line + '" stroke-width="1.5"/>';
}

function shorten(s, n) {
    n = n || 16;
    s = String(s);
    return s.length > n ? s.substr(0, n - 1) + '…' : s;
}

function valueText(el, values) {
    // after a run: the value at the start and at the end (values: name --> {first, last} as text)
    var v = values && el.name && values.hasOwnProperty(el.name) ? values[el.name] : null;
    if (!v) return '';
    return v.first == v.last ? '\nwaarde: ' + v.first : '\nbegin: ' + v.first + ', eind: ' + v.last;
}

function tooltip(g, el) {
    switch (el.kind) {
        case 'stock': return el.name + ' (toestandsvariabele), beginwaarde ' + el.initial;
        case 'flow': return (el.name ? el.name + ' = ' : '') + el.definition + ' (stroom)' +
            (el.step ? '\n' + el.step + ' = ' + el.stepDefinition : '');
        case 'event': return 'als ' + el.condition + ' dan ' + el.actions.join('; ');
        case 'stop': return 'stop als ' + el.condition + ' (stopvoorwaarde)';
        default: return el.name + ' = ' + el.definition;
    }
}

exports.analyse = analyse;
exports.layout = layout;
exports.toSVG = toSVG;
exports.STIJLEN = STIJLEN;
exports.table = table;
exports.lines = lines;
exports.fmt = fmt;
exports.code = code;
exports.collect = collect;
exports.variables = variables;
