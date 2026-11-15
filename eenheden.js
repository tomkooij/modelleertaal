/*
    eenheden.js

    Eenheden van variabelen uit het commentaar van het model. Geen nieuwe bediening:
    een eenheid tussen rechte haken in het commentaar achter een startwaarde wordt herkend.

      m = 91 '[kg]
      v = 0 // [m/s] beginsnelheid
      Fw = k*v^2   ' [N]       (modelregel: voor een variabele zonder startwaarde)

    De eenheid komt op de assen ("v (m/s)"), in de tabelkop, in de tooltip en in de TSV.
    Een eenheid in de startwaarden gaat voor een eenheid in de modelregels.

    No DOM.

    Eenheden die niet in het commentaar staan worden zo veel mogelijk afgeleid uit de formules
    (derive): x '[m] en t '[s] met dx = v * dt ; x = x + dx ; t = t + dt geven v in m/s. Ook
    terug: uit x = x + dx volgt de eenheid van dx. N, J, W, Pa, V en Ohm worden herkend
    (Fres / m met Fres in N en m in kg is m/s²). Een eenheid met een voorvoegsel of een andere
    eenheid (km, h, g, dag) telt als een eigen symbool: km/h * h = km.

    usage:
      var eenheden = require('./eenheden.js');
      var units = eenheden.units(startwaarden_text, modelregels_text);   // {v: 'm/s', ...}
      eenheden.label('v', units)   // 'v (m/s)'
      var d = eenheden.derive(startwaarden_text, modelregels_text);
      // d.units: alle eenheden (uit het commentaar en afgeleid), d.derived: {naam: true} afgeleid,
      // d.conflicts: {naam: uitleg} als de eenheden in de formule van naam niet kloppen
*/

//jshint node:true
//jshint es3:true
"use strict";

// name = ... or name := ... at the start of a line (same characters as the parser, simplified)
var ASSIGNMENT = /^\s*([a-zA-Z\u007f-\uffef][a-zA-Z0-9_\u007f-\uffef]*)\s*:?=(?!=)/;
// start of a comment: ' or // or # or /*
var COMMENT = /'|\/\/|#|\/\*/;
var UNIT = /\[([^\[\]]{1,20})\]/;


function line_unit(line) {
    // {name, unit} for a line 'name = ... '[unit]', or null
    var m = ASSIGNMENT.exec(line);
    if (!m) return null;
    var rest = line.slice(m[0].length);
    var c = COMMENT.exec(rest);
    if (!c) return null;
    var u = UNIT.exec(rest.slice(c.index));
    if (!u) return null;
    var unit = u[1].replace(/^\s+|\s+$/g, '');
    if (!unit) return null;
    return {name: m[1], unit: unit};
}


function units(startwaarden, modelregels) {
    // name --> unit. The first unit of a name counts; startwaarden go first.
    var out = {};
    [startwaarden, modelregels].forEach(function(text) {
        String(text || '').split(/\r?\n/).forEach(function(line) {
            var found = line_unit(line);
            if (found && !out.hasOwnProperty(found.name)) out[found.name] = found.unit;
        });
    });
    return out;
}


function label(name, units) {
    // 'v (m/s)', or 'v' without a unit
    // no unit (or the empty unit of a ratio): no brackets, never 'a ()'
    return (units && units.hasOwnProperty(name) && units[name]) ? name + ' (' + units[name] + ')' : name;
}


function labels(names, units) {
    // the label of an axis with several variables: 'x, y (m)' when they have the same unit,
    // else 'x (m), v (m/s)'
    if (names.length === 0) return '';
    var first = units && units.hasOwnProperty(names[0]) ? units[names[0]] : undefined;
    var same = !!first && names.every(function(name) {
        return units && units.hasOwnProperty(name) && units[name] === first;
    });
    if (same && first !== undefined) return names.join(', ') + ' (' + first + ')';
    return names.map(function(name) { return label(name, units); }).join(', ');
}


// ------------------------------------------------------------------ unit algebra

// SI units that are written as base units (kg, m, s, A, K, mol, cd)
var NAMED = {
    N: {kg: 1, m: 1, s: -2},
    J: {kg: 1, m: 2, s: -2},
    W: {kg: 1, m: 2, s: -3},
    Pa: {kg: 1, m: -1, s: -2},
    V: {kg: 1, m: 2, s: -3, A: -1},
    'Ω': {kg: 1, m: 2, s: -3, A: -2},
    Ohm: {kg: 1, m: 2, s: -3, A: -2},
    C: {A: 1, s: 1},
    Hz: {s: -1}
};
// shown when a derived unit is one of these (in this order)
var SHOW_NAMED = ['N', 'J', 'W', 'Pa', 'V', 'Ω', 'C'];
var BASE_ORDER = ['kg', 'm', 's', 'A', 'K', 'mol', 'cd'];
var SUP = {'⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5,
           '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9};
var TO_SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

function mul(a, b, power) {
    // a * b^power (dims: {symbol: power})
    var out = {}, k;
    for (k in a) if (a.hasOwnProperty(k)) out[k] = a[k];
    for (k in b) {
        if (!b.hasOwnProperty(k)) continue;
        out[k] = (out[k] || 0) + b[k] * power;
        if (out[k] === 0) delete out[k];
    }
    return out;
}

function pow(a, n) {
    // a^n, or null if the powers are not whole numbers
    var out = {};
    for (var k in a) {
        if (!a.hasOwnProperty(k)) continue;
        var p = a[k] * n;
        if (Math.abs(p - Math.round(p)) > 1e-9) return null;
        if (Math.round(p) !== 0) out[k] = Math.round(p);
    }
    return out;
}

function same(a, b) {
    var k;
    for (k in a) if (a.hasOwnProperty(k) && a[k] !== b[k]) return false;
    for (k in b) if (b.hasOwnProperty(k) && a[k] !== b[k]) return false;
    return true;
}

function parse(text) {
    // 'kg·m/s^2', 'N/kg', 'm s-1', '(m/s)/s', 'km/h' --> dims. Not understood: the text is one symbol
    var src = String(text || '').replace(/^\s+|\s+$/g, ''), i = 0;
    if (!src) return null;
    var space = function() { while (i < src.length && src.charAt(i) == ' ') i++; };
    var exponent = function() {
        // ^2, ^-1, 2, -1, ², ⁻¹
        var start = i, sign = 1, digits = '';
        if (src.charAt(i) == '^') i++;
        if (src.charAt(i) == '-' || src.charAt(i) == '−' || src.charAt(i) == '⁻') { sign = -1; i++; }
        while (i < src.length && (/[0-9]/.test(src.charAt(i)) || SUP.hasOwnProperty(src.charAt(i)))) {
            digits += SUP.hasOwnProperty(src.charAt(i)) ? SUP[src.charAt(i)] : src.charAt(i);
            i++;
        }
        if (!digits) { i = start; return 1; }
        return sign * Number(digits);
    };
    var product, factor;
    factor = function() {
        space();
        var c = src.charAt(i), d;
        if (c == '(') {
            i++;
            d = product();
            space();
            if (src.charAt(i) != ')') throw new Error('unit');
            i++;
        } else if (c == '1') {
            i++;
            d = {};
        } else {
            var m = /^[a-zA-Z°µμΩ%À-ɏ]+/.exec(src.slice(i));
            if (!m) throw new Error('unit');
            i += m[0].length;
            d = {};
            if (NAMED.hasOwnProperty(m[0])) d = mul(d, NAMED[m[0]], 1);
            else d[m[0]] = 1;
        }
        var n = exponent();
        return n == 1 ? d : pow(d, n);
    };
    product = function() {
        var d = factor();
        for (;;) {
            space();
            var c = src.charAt(i);
            if (c == '/') { i++; d = mul(d, factor(), -1); }
            else if (c == '*' || c == '·' || c == '.' || c == '⋅') { i++; d = mul(d, factor(), 1); }
            else if (i < src.length && c != ')') { d = mul(d, factor(), 1); }   // 'kg m'
            else return d;
        }
    };
    try {
        var d = product();
        if (i != src.length) throw new Error('unit');
        return d;
    } catch (err) {
        var own = {};
        own[src] = 1;
        return own;
    }
}

function format(d, preferred) {
    // dims --> 'm/s²'. preferred: [unit text] from the model, used when it is the same unit
    var i;
    for (i = 0; i < (preferred || []).length; i++) {
        var p = parse(preferred[i]);
        if (p && same(p, d)) return preferred[i];
    }
    for (i = 0; i < SHOW_NAMED.length; i++) if (same(NAMED[SHOW_NAMED[i]], d)) return SHOW_NAMED[i];
    var keys = [], k;
    for (k in d) if (d.hasOwnProperty(k)) keys.push(k);
    keys.sort(function(a, b) {
        var ia = BASE_ORDER.indexOf(a), ib = BASE_ORDER.indexOf(b);
        if (ia == -1 && ib == -1) return a < b ? -1 : 1;
        if (ia == -1) return -1;   // km/h: own symbols first
        if (ib == -1) return 1;
        return ia - ib;
    });
    var sup = function(n) {
        var t = '';
        String(n).split('').forEach(function(c) { t += TO_SUP[Number(c)]; });
        return t;
    };
    var part = function(sym, n) { return sym + (n == 1 ? '' : sup(n)); };
    var top = [], bottom = [];
    for (i = 0; i < keys.length; i++) {
        if (d[keys[i]] > 0) top.push(part(keys[i], d[keys[i]]));
        else bottom.push(part(keys[i], -d[keys[i]]));
    }
    if (!top.length && !bottom.length) return '';
    var text = top.length ? top.join('·') : '1';
    if (bottom.length) text += '/' + (bottom.length > 1 ? '(' + bottom.join('·') + ')' : bottom[0]);
    return text;
}


// ------------------------------------------------------------------ units from the formulas

var DIMLESS_FUNCS = ['sin', 'cos', 'tan', 'sinr', 'cosr', 'tanr', 'arcsin', 'arccos', 'arctan',
                     'arcsinr', 'arccosr', 'arctanr', 'exp', 'ln', 'log', 'sign', 'teken'];
var SAME_FUNCS = ['abs', 'round', 'entier', 'min', 'max'];

function args(node) {
    // arguments of min(a; b)
    if (node && node.type == 'List') return args(node.left).concat(args(node.right));
    return [node];
}

function pureNumber(text) {
    // a number without a unit for sure: a whole number, 0,5 (Ek = 0,5 * m * v^2) or pi.
    // 9,81 or 0,37 in a formula is a quantity with a unit that is not written (g, k)
    var v = Number(String(text).replace(',', '.'));
    return !isNaN(v) && (v === Math.round(v) || v == 0.5 || Math.abs(v - Math.PI) < 1e-9);
}

function infer(node, env) {
    // unit of an expression: {d: dims, num: true for a plain number (fits any unit in a sum)},
    // or null when unknown. num: 'pure' for a number that is certainly without unit (2, 0,5)
    if (!node) return null;
    var l, r, i;
    var factor = function(a, b) {
        // a number with an unknown unit (9,81) in a product: the product has no known unit
        return a && a.num && a.num != 'pure' && !(b && b.num);
    };
    switch (node.type) {
        case 'Number': return {d: {}, num: pureNumber(node.value) ? 'pure' : true};
        case 'Variable': return env.hasOwnProperty(node.name) ? {d: env[node.name], num: false} : null;
        case 'Unary': return node.operator == 'NOT' ? null : infer(node.right, env);
        case 'Function':
            if (DIMLESS_FUNCS.indexOf(node.func) != -1) return {d: {}, num: false};
            var list = args(node.expr), found = null;
            if (node.func == 'sqrt' || node.func == 'wortel') {
                l = infer(node.expr, env);
                if (!l) return null;
                var half = pow(l.d, 0.5);
                return half ? {d: half, num: l.num} : null;
            }
            if (node.func == 'sqr') {
                l = infer(node.expr, env);
                return l ? {d: pow(l.d, 2), num: l.num} : null;
            }
            if (SAME_FUNCS.indexOf(node.func) == -1) return null;
            for (i = 0; i < list.length; i++) {
                l = infer(list[i], env);
                if (l && (!found || found.num)) found = l;
            }
            return found;
        case 'Binary':
            l = infer(node.left, env);
            r = infer(node.right, env);
            switch (node.operator) {
                case '+':
                case '-':
                    if (l && r && !l.num && !r.num) return same(l.d, r.d) ? l : null;
                    if (l && !l.num) return l;
                    if (r && !r.num) return r;
                    return (l && r) ? {d: {}, num: true} : null;
                case '*':
                case '/':
                    if (!l || !r || factor(l, r) || factor(r, l)) return null;
                    return {d: mul(l.d, r.d, node.operator == '*' ? 1 : -1),
                            num: l.num && r.num ? (l.num == 'pure' && r.num == 'pure' ? 'pure' : true) : false};
                case '^':
                    if (!l || node.right.type != 'Number') return (l && r && l.num && r.num) ? l : null;
                    var p = pow(l.d, Number(node.right.value));
                    return p ? {d: p, num: l.num} : null;
            }
            return null;
        default:
            return null;
    }
}

function solve(node, target, env, set) {
    // give the unknown variables in node a unit, so that node has the unit target
    if (!node || !target) return;
    var l, r, n;
    switch (node.type) {
        case 'Variable':
            if (!env.hasOwnProperty(node.name)) set(node.name, target);
            return;
        case 'Unary':
            if (node.operator != 'NOT') solve(node.right, target, env, set);
            return;
        case 'Function':
            if (node.func == 'sqrt' || node.func == 'wortel') solve(node.expr, pow(target, 2), env, set);
            else if (node.func == 'sqr') solve(node.expr, pow(target, 0.5), env, set);
            else if (node.func == 'abs') solve(node.expr, target, env, set);
            return;
        case 'Binary':
            l = infer(node.left, env);
            r = infer(node.right, env);
            // 9,81 * m: the unit of 9,81 is not known, so m cannot be solved
            if ((node.operator == '*' || node.operator == '/') &&
                ((l && l.num && l.num != 'pure') || (r && r.num && r.num != 'pure'))) return;
            switch (node.operator) {
                case '+':
                case '-':
                    solve(node.left, target, env, set);
                    solve(node.right, target, env, set);
                    return;
                case '*':
                    if (l && !r) solve(node.right, mul(target, l.d, -1), env, set);
                    if (r && !l) solve(node.left, mul(target, r.d, -1), env, set);
                    return;
                case '/':
                    if (l && !r) solve(node.right, mul(l.d, target, -1), env, set);
                    if (r && !l) solve(node.left, mul(target, r.d, 1), env, set);
                    return;
                case '^':
                    n = node.right.type == 'Number' ? Number(node.right.value) : 0;
                    if (n) solve(node.left, pow(target, 1 / n), env, set);
                    return;
            }
    }
}

function assignments(ast, out) {
    // all name = expr, also inside als ... dan
    for (var i = 0; i < (ast || []).length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment') out.push({name: stmt.left, expr: stmt.right});
        else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            assignments(stmt.then, out);
            assignments(stmt.elsestmt, out);
        }
    }
    return out;
}

function deriveAst(startAst, regelsAst, explicit) {
    // explicit: {name: unit text} (from the comments). See derive.
    var env = {}, derived = {}, name, i;
    var preferred = [];
    for (name in explicit) {
        if (!explicit.hasOwnProperty(name)) continue;
        env[name] = parse(explicit[name]);
        if (preferred.indexOf(explicit[name]) == -1) preferred.push(explicit[name]);
    }
    var list = assignments(regelsAst, assignments(startAst, []));
    var changed = true;
    var set = function(n, d) {
        if (env.hasOwnProperty(n) || !d) return;
        env[n] = d;
        derived[n] = true;
        changed = true;
    };
    for (var pass = 0; pass < 20 && changed; pass++) {
        changed = false;
        for (i = 0; i < list.length; i++) {
            var a = list[i];
            if (!env.hasOwnProperty(a.name)) {
                var u = infer(a.expr, env);
                if (u && !u.num) set(a.name, u.d);
            }
            if (env.hasOwnProperty(a.name)) solve(a.expr, env[a.name], env, set);
        }
    }
    var out = {units: {}, derived: derived, conflicts: {}};
    for (name in env) if (env.hasOwnProperty(name)) out.units[name] = explicit.hasOwnProperty(name) ? explicit[name] : format(env[name], preferred);
    var sumConflict = function(node) {
        // 'kg en kg·dag/s': two terms of a sum with a different unit
        if (!node || typeof node != 'object') return null;
        if (node.type == 'Binary' && (node.operator == '+' || node.operator == '-')) {
            var l = infer(node.left, env), r = infer(node.right, env);
            if (l && r && !l.num && !r.num && !same(l.d, r.d)) {
                return (format(l.d, preferred) || '1') + ' en ' + (format(r.d, preferred) || '1');
            }
        }
        return sumConflict(node.left) || sumConflict(node.right) || sumConflict(node.expr);
    };
    for (i = 0; i < list.length; i++) {
        var b = list[i], w = infer(b.expr, env), sc = sumConflict(b.expr);
        if (out.conflicts.hasOwnProperty(b.name)) continue;
        if (sc) {
            out.conflicts[b.name] = 'in de formule worden ' + sc + ' opgeteld of afgetrokken';
        } else if (env.hasOwnProperty(b.name) && w && !w.num && !same(w.d, env[b.name])) {
            out.conflicts[b.name] = 'volgens de formule is de eenheid ' + (format(w.d, preferred) || '1') +
                ', niet ' + (out.units[b.name] || '1');
        }
    }
    return out;
}

function derive(startwaarden, modelregels) {
    // all units: from the comments and from the formulas. A model with an error: only the comments
    var explicit = units(startwaarden, modelregels);
    var parser = require('./modelleertaal').parser;
    var ast = function(text, name) {
        return /^\s*$/.test(String(text || '').replace(/('|\/\/|#)[^\n]*/g, '')) ? [] : parser.parse(String(text), name);
    };
    var out;
    try {
        out = deriveAst(ast(startwaarden, 'startwaarden'), ast(modelregels, 'modelregels'), explicit);
    } catch (err) {
        out = {units: {}, derived: {}, conflicts: {}};
        for (var k in explicit) if (explicit.hasOwnProperty(k)) out.units[k] = explicit[k];
    }
    out.explicit = explicit;
    return out;
}

exports.units = units;
exports.derive = derive;
exports.deriveAst = deriveAst;
exports.parse = parse;
exports.format = format;
exports.label = label;
exports.labels = labels;
exports.line_unit = line_unit;
