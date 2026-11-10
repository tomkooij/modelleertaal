/*
    grafisch.js  (prototype)

    Zet een tekstmodel (startwaarden + modelregels) om in een grafisch model,
    zoals de grafische modus van Coach 7 (System Dynamics / stock-flow,
    zie hoofdstuk 6 van de Coach 7 handleiding).

    Herkenning (Euler-vorm, zoals in de examenmodellen):

      Toestandsvariabele   x = x + dx              variabele die naar zichzelf verwijst
      Stroomvariabele      dx = v * dt             de termen die bij x worden opgeteld
                                                   (+ is ingaand, - is uitgaand);
                                                   dezelfde stroom als - bij A en + bij B
                                                   is een stroom van A naar B
      Onafhankelijke var.  t = t + dt              alleen getekend als t gebruikt wordt
      Hulpvariabele        Fres = Fz - Fw          overige variabelen uit de modelregels
      Constante            m = 80                  alleen in de startwaarden
      Voorval              als h < 0 dan v = -v eindals
                                                   (toestandsvariabele verandert sprongsgewijs)
      Stopvoorwaarde       als ... dan stop eindals (modelinstelling, geen element)
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
var OPS = {'*': '·', '/': '/', '^': '^', '+': ' + ', '-': ' − ', '&&': ' en ', '||': ' of ',
           '==': ' = ', '<': ' < ', '>': ' > ', '<=': ' ≤ ', '>=': ' ≥ ', 'LIST': ', '};

function fmt(node, parentPrec, rightSide) {
    // expression --> readable string (minimal parentheses)
    var s, prec;
    parentPrec = parentPrec || 0;
    if (!node) return '?';
    switch (node.type) {
        case 'Variable': return node.name;
        case 'Number': return node.value == '3.14159265359' ? 'π' : String(node.value);
        case 'Boolean': return node.value == 'true' ? 'waar' : 'onwaar';
        case 'Function': return node.func + '(' + fmt(node.expr) + ')';
        case 'Unary':
            prec = 6;
            s = (node.operator == 'NOT' ? 'niet ' : (node.operator == '-' ? '−' : '+')) +
                fmt(node.right, prec, true);
            break;
        case 'Binary':
        case 'Logical':
        case 'List':
            prec = PREC[node.operator];
            s = fmt(node.left, prec, false) + OPS[node.operator] + fmt(node.right, prec, true);
            break;
        default:
            return '?';
    }
    if (prec < parentPrec || (prec == parentPrec && rightSide)) s = '(' + s + ')';
    return s;
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
            out.assign.push({name: stmt.left, expr: stmt.right, conds: conds});
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            collect(stmt.then, conds.concat([{cond: stmt.cond, neg: false}]), out);
            if (stmt.elsestmt) collect(stmt.elsestmt, conds.concat([{cond: stmt.cond, neg: true}]), out);
        } else if (stmt.type == 'Stop') {
            out.stops.push(conds);
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

    for (i = 0; i < stockOrder.length; i++) {
        name = stockOrder[i];
        if (name == time) continue;
        var stock = add({id: name, kind: 'stock', name: name,
                         initial: init.hasOwnProperty(name) ? fmt(init[name]) : '?',
                         inflows: [], outflows: [], general: null});
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
                    } else {
                        var def = assigned[v].uncond[0].expr;
                        var rate = stripDt(def, dt);
                        f = {id: f ? v + '#' + flows.length : v, kind: 'flow', name: v, label: v,
                             from: term.sign < 0 ? name : null, to: term.sign > 0 ? name : null,
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
    var stops = [];
    for (i = 0; i < regels.stops.length; i++) stops.push(fmtConds(regels.stops[i]));

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
             conditional: conditional, deps: without(addAll(deps.slice(), cdeps), [name, dt]),
             condDeps: without(cdeps, deps)});
    }

    // --- constanten (alleen startwaarden)
    for (i = 0; i < initOrder.length; i++) {
        name = initOrder[i];
        if (elements.hasOwnProperty(name) || isStock[name] || name == time || name == dt) continue;
        // vx = v0 * cos(alfa): relation arrows from v0 and alfa
        add({id: name, kind: 'const', name: name, definition: fmt(init[name]),
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
                if (elements.hasOwnProperty(idOf(ideps[j]))) links.push({from: idOf(ideps[j]), to: el.id, kind: 'initial'});
            }
        }
        if (!el.deps) continue;
        for (j = 0; j < el.deps.length; j++) {
            var d = el.deps[j];
            if (d == dt) continue;
            if (d == time) showTime = true;
            else if (!elements.hasOwnProperty(idOf(d))) {
                // Coach: element met vraagteken
                add({id: d, kind: 'unknown', name: d, definition: '? (geen startwaarde of formule)', deps: []});
            }
            var lk = idOf(d) + '>' + el.id;
            if (!seen[lk]) {
                seen[lk] = true;
                // condition: only used in 'als ... dan' of a hulpvariabele (drawn lighter)
                links.push({from: idOf(d), to: el.id,
                            kind: el.condDeps && el.condDeps.indexOf(d) != -1 ? 'condition' : 'relation'});
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
                    '; van ' + (el.from || 'buiten') + ' naar ' + (el.to || 'buiten');
            } else if (el.kind == 'event') {
                def = 'als ' + el.condition + ' dan ' + el.actions.join('; ');
            } else {
                def = el.definition;
            }
            rows.push({kind: KIND_NAMES[el.kind], name: el.name || el.label, definition: def});
        }
    }
    for (i = 0; i < g.stops.length; i++) rows.push({kind: 'Stopvoorwaarde', name: '', definition: g.stops[i]});
    return rows;
}


// ------------------------------------------------------------------ layout

var L = {stockW: 96, stockH: 46, flowLen: 116, cloud: 44, chainGap: 64, layerH: 92, gap: 100};

function mean(list) {
    var s = 0;
    for (var i = 0; i < list.length; i++) s += list[i];
    return s / list.length;
}

function layout(g) {
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
    for (i = 0; i < g.flows.length; i++) pos[g.flows[i].id] = flowGeom[g.flows[i].id].valve;

    // --- other elements in layers: inputs above the row, outputs below
    var isRow = function(id) { var k = g.elements[id].kind; return k == 'stock' || k == 'flow'; };
    var others = [], targets = {}, sources = {};
    for (i = 0; i < g.order.length; i++) {
        var id = g.order[i];
        targets[id] = [];
        sources[id] = [];
        if (!isRow(id)) others.push(id);
    }
    // beginwaarde arrows only position elements that have no other arrows (alfa in vx = v0*cos(alfa))
    var other = {}, lk;
    for (i = 0; i < g.links.length; i++) {
        lk = g.links[i];
        if (lk.kind != 'initial') { other[lk.from] = true; other[lk.to] = true; }
    }
    for (i = 0; i < g.links.length; i++) {
        lk = g.links[i];
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
    return {pos: pos, flows: flowGeom};
}


// ------------------------------------------------------------------ SVG

var C = {blue: '#1f5fa8', fill: '#dceaf8', red: '#c62828', text: '#1d2733', grey: '#6b7785'};

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function radius(el, dx, dy) {
    // distance from center to the border of the symbol in direction (dx, dy)
    switch (el.kind) {
        case 'stock':
            var len = Math.sqrt(dx * dx + dy * dy) || 1;
            var tx = Math.abs(dx) > 1e-9 ? (L.stockW / 2) / Math.abs(dx) : Infinity;
            var ty = Math.abs(dy) > 1e-9 ? (L.stockH / 2) / Math.abs(dy) : Infinity;
            return Math.min(tx, ty) * len + 3;
        case 'flow': return 13;
        case 'const': return 12;
        case 'event': return 16;
        default: return 21;
    }
}

function cloud(x, y) {
    return '<path d="M' + (x - 14) + ',' + (y + 8) +
        ' a7,7 0 0,1 -2,-13 a9,9 0 0,1 15,-6 a8,8 0 0,1 14,4 a7,7 0 0,1 1,15 z"' +
        ' fill="#fff" stroke="' + C.blue + '" stroke-width="1.5"/>';
}

function pipe(points, out) {
    var d = 'M' + points[0].x + ',' + points[0].y;
    for (var i = 1; i < points.length; i++) d += ' L' + points[i].x + ',' + points[i].y;
    out.push('<path d="' + d + '" fill="none" stroke="' + C.blue + '" stroke-width="8" stroke-linejoin="round"/>');
    out.push('<path d="' + d + '" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>');
    // arrow head at the end
    var p = points[points.length - 1], q = points[points.length - 2];
    var ux = p.x - q.x, uy = p.y - q.y, l = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= l; uy /= l;
    out.push('<path d="M' + (p.x + ux * 4) + ',' + (p.y + uy * 4) +
        ' L' + (p.x - ux * 10 - uy * 9) + ',' + (p.y - uy * 10 + ux * 9) +
        ' L' + (p.x - ux * 10 + uy * 9) + ',' + (p.y - uy * 10 - ux * 9) + ' z" fill="' + C.blue + '"/>');
}

var LINK_STYLE = {
    relation: 'stroke="' + C.red + '" stroke-width="1.4" marker-end="url(#ar)"',
    // only in the condition of 'als ... dan': lighter
    condition: 'stroke="' + C.red + '" stroke-width="1.1" stroke-opacity="0.45" stroke-dasharray="2 3" marker-end="url(#ar)"',
    // beginwaarde of a toestandsvariabele
    initial: 'stroke="' + C.grey + '" stroke-width="1.1" stroke-dasharray="4 3" marker-end="url(#ag)"',
    // voorval changes a toestandsvariabele
    action: 'stroke="' + C.blue + '" stroke-width="1.4" stroke-dasharray="5 3" marker-end="url(#ab)"'
};

function toSVG(g, lay) {
    lay = lay || layout(g);
    var pos = lay.pos, out = [], i, el, p, id;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var grow = function(x, y, r) {
        minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
        minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
    };

    // flows (pipes) first
    for (i = 0; i < g.flows.length; i++) {
        var f = g.flows[i], geo = lay.flows[f.id], v = geo.valve, pts;
        var a = f.from ? pos[f.from] : null, b = f.to ? pos[f.to] : null;
        if (geo.detour) {
            var yb = v.y;
            pts = [{x: a.x, y: L.stockH / 2 + 3}, {x: a.x, y: yb}, {x: b.x, y: yb}, {x: b.x, y: L.stockH / 2 + 6}];
        } else if (geo.src && geo.src.y !== 0) {          // vertical in from below
            pts = [{x: v.x, y: geo.src.y - 10}, {x: v.x, y: L.stockH / 2 + 6}];
        } else if (geo.dst && geo.dst.y !== 0) {          // vertical out to below
            pts = [{x: v.x, y: L.stockH / 2 + 3}, {x: v.x, y: geo.dst.y - 14}];
        } else {
            var x0 = a ? a.x + L.stockW / 2 + 3 : geo.src.x + 17;
            var x1 = b ? b.x - L.stockW / 2 - 6 : geo.dst.x - 20;
            pts = [{x: x0, y: 0}, {x: x1, y: 0}];
        }
        pipe(pts, out);
        if (geo.src) { out.push(cloud(geo.src.x, geo.src.y)); grow(geo.src.x, geo.src.y, 22); }
        if (geo.dst) { out.push(cloud(geo.dst.x, geo.dst.y)); grow(geo.dst.x, geo.dst.y, 22); }
    }

    // relation arrows
    for (i = 0; i < g.links.length; i++) {
        var lk = g.links[i], s = pos[lk.from], t = pos[lk.to];
        if (!s || !t) continue;
        var dx = t.x - s.x, dy = t.y - s.y, len = Math.sqrt(dx * dx + dy * dy) || 1, d;
        if (s.y === 0 && t.y === 0) {
            // both on the row of stocks and flows: arc over the row instead of along the pipes
            var top = function(el) { return el.kind == 'stock' ? -L.stockH / 2 - 2 : -12; };
            var y0 = top(g.elements[lk.from]), y1 = top(g.elements[lk.to]) - 3;
            var arcH = Math.min(60, 26 + 0.1 * Math.abs(dx));
            var sx0 = s.x + (dx > 0 ? 8 : -8), ex0 = t.x + (dx > 0 ? -4 : 4);
            d = 'M' + sx0.toFixed(1) + ',' + y0 + ' C' + sx0.toFixed(1) + ',' + (y0 - arcH).toFixed(1) +
                ' ' + ex0.toFixed(1) + ',' + (y1 - arcH).toFixed(1) + ' ' + ex0.toFixed(1) + ',' + y1;
            grow(s.x + dx / 2, y0 - 0.75 * arcH, 4);
        } else {
            var r0 = radius(g.elements[lk.from], dx, dy), r1 = radius(g.elements[lk.to], -dx, -dy);
            var ux = dx / len, uy = dy / len;
            var sx = s.x + ux * r0, sy = s.y + uy * r0, ex = t.x - ux * (r1 + 2), ey = t.y - uy * (r1 + 2);
            var bend = Math.min(30, 0.12 * len);
            var cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend;
            d = 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) +
                ' ' + ex.toFixed(1) + ',' + ey.toFixed(1);
        }
        out.push('<path d="' + d + '" fill="none" ' + LINK_STYLE[lk.kind] + '/>');
    }

    // symbols
    for (i = 0; i < g.order.length; i++) {
        id = g.order[i];
        el = g.elements[id];
        p = pos[id];
        if (!p) continue;
        var tip = '<title>' + esc(tooltip(g, el)) + '</title>';
        var x = p.x, y = p.y, label = el.name || el.label;
        switch (el.kind) {
            case 'stock':
                out.push('<g>' + tip + '<rect x="' + (x - L.stockW / 2) + '" y="' + (y - L.stockH / 2) + '" width="' + L.stockW +
                    '" height="' + L.stockH + '" rx="3" fill="' + C.fill + '" stroke="' + C.blue + '" stroke-width="2"/>' +
                    '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-weight="bold">' + esc(label) + '</text></g>');
                grow(x, y, L.stockW / 2 + 4);
                break;
            case 'flow':
                out.push('<g>' + tip + valve(x, y, lay.flows[id]) +
                    '<text x="' + x + '" y="' + (y + 28) + '" text-anchor="middle" class="small">' + esc(shorten(label)) + '</text></g>');
                grow(x, y + 20, 30);
                break;
            case 'aux':
                out.push('<g>' + tip + '<circle cx="' + x + '" cy="' + y + '" r="18" fill="' + C.fill + '" stroke="' + C.blue +
                    '" stroke-width="2"' + (el.conditional ? ' stroke-dasharray="4 2"' : '') + '/>' +
                    '<text x="' + x + '" y="' + (y + 34) + '" text-anchor="middle">' + esc(label) + '</text></g>');
                grow(x, y + 10, 30);
                break;
            case 'const':
                out.push('<g>' + tip + '<path d="M' + x + ',' + (y - 10) + ' L' + (x + 10) + ',' + y + ' L' + x + ',' + (y + 10) +
                    ' L' + (x - 10) + ',' + y + ' z" fill="' + C.fill + '" stroke="' + C.blue + '" stroke-width="2"/>' +
                    '<text x="' + x + '" y="' + (y + 26) + '" text-anchor="middle">' + esc(label) + '</text></g>');
                grow(x, y + 10, 30);
                break;
            case 'event':
                out.push('<g>' + tip + '<path d="M' + (x + 3) + ',' + (y - 15) + ' L' + (x - 9) + ',' + (y + 2) + ' L' + (x - 1) + ',' + (y + 2) +
                    ' L' + (x - 4) + ',' + (y + 15) + ' L' + (x + 9) + ',' + (y - 3) + ' L' + (x + 1) + ',' + (y - 3) + ' z"' +
                    ' fill="#ffe08a" stroke="#b07d00" stroke-width="1.5"/>' +
                    '<text x="' + x + '" y="' + (y + 30) + '" text-anchor="middle" class="small">' + esc(shorten(el.condition, 22)) + '</text></g>');
                grow(x, y + 10, 40);
                break;
            case 'time':
                out.push('<g>' + tip + '<circle cx="' + x + '" cy="' + y + '" r="16" fill="#fff" stroke="' + C.grey + '" stroke-width="2"/>' +
                    '<path d="M' + x + ',' + (y - 10) + ' L' + x + ',' + y + ' L' + (x + 7) + ',' + (y + 4) + '" fill="none" stroke="' + C.grey + '" stroke-width="2"/>' +
                    '<text x="' + x + '" y="' + (y + 32) + '" text-anchor="middle">' + esc(label) + '</text></g>');
                grow(x, y + 10, 30);
                break;
            default:   // unknown
                out.push('<g>' + tip + '<circle cx="' + x + '" cy="' + y + '" r="18" fill="#fdecea" stroke="' + C.red + '" stroke-width="2"/>' +
                    '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" fill="' + C.red + '" font-weight="bold">?</text>' +
                    '<text x="' + x + '" y="' + (y + 34) + '" text-anchor="middle">' + esc(label) + '</text></g>');
                grow(x, y + 10, 30);
        }
    }

    if (minX == Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 50; }
    var pad = 12, w = maxX - minX + 2 * pad, h = maxY - minY + 2 * pad;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (minX - pad).toFixed(0) + ' ' + (minY - pad).toFixed(0) + ' ' +
        w.toFixed(0) + ' ' + h.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '"' +
        ' font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="' + C.text + '">' +
        '<style>text{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}' +
        '.small{font-size:11px;fill:' + C.grey + '}</style>' +
        '<defs>' +
        '<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0,0 L10,5 L0,10 z" fill="' + C.red + '"/></marker>' +
        '<marker id="ab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0,0 L10,5 L0,10 z" fill="' + C.blue + '"/></marker>' +
        '<marker id="ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
        '<path d="M0,0 L10,5 L0,10 z" fill="' + C.grey + '"/></marker>' +
        '</defs>' + out.join('') + '</svg>';
}

function valve(x, y, geo) {
    // bow tie across the pipe
    var vertical = geo && !geo.detour && ((geo.src && geo.src.y !== 0) || (geo.dst && geo.dst.y !== 0));
    var d = vertical ?
        'M' + (x - 9) + ',' + (y - 9) + ' L' + (x + 9) + ',' + (y - 9) + ' L' + (x - 9) + ',' + (y + 9) + ' L' + (x + 9) + ',' + (y + 9) + ' z' :
        'M' + (x - 9) + ',' + (y - 9) + ' L' + (x + 9) + ',' + (y + 9) + ' L' + (x + 9) + ',' + (y - 9) + ' L' + (x - 9) + ',' + (y + 9) + ' z';
    return '<path d="' + d + '" fill="' + C.fill + '" stroke="' + C.blue + '" stroke-width="2" stroke-linejoin="round"/>';
}

function shorten(s, n) {
    n = n || 16;
    s = String(s);
    return s.length > n ? s.substr(0, n - 1) + '…' : s;
}

function tooltip(g, el) {
    switch (el.kind) {
        case 'stock': return el.name + ' (toestandsvariabele), beginwaarde ' + el.initial;
        case 'flow': return (el.name ? el.name + ' = ' : '') + el.definition + ' (stroom)';
        case 'event': return 'als ' + el.condition + ' dan ' + el.actions.join('; ');
        default: return el.name + ' = ' + el.definition;
    }
}

exports.analyse = analyse;
exports.layout = layout;
exports.toSVG = toSVG;
exports.table = table;
exports.fmt = fmt;
