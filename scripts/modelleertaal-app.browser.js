(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.modelleertaalapp_js = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
    aflezen.js

    Aflezen in de grafiek: de helling (raaklijn) bij een aangeklikt punt.
    "Bepaal de versnelling uit het (v,t)-diagram" (examenvaardigheid).

    No DOM.

    usage:
      var aflezen = require('./aflezen.js');
      aflezen.slope(rows, xi, yi, row)       // dy/dx from the neighbours of row, or null
      aflezen.tangent_to_axes([x0, y0], slope, {xmin, xmax, ymin, ymax})
                                             // the whole tangent in the graph: [[x1, y1], [x2, y2]], x1 < x2
      aflezen.slope_unit('m/s', 's')         // '(m/s)/s'
*/

//jshint node:true
//jshint es3:true
"use strict";

function number(x) {
    if (typeof x == 'boolean') return x ? 1 : 0;
    return x;
}


function finite_row(rows, i, xi, yi) {
    return i >= 0 && i < rows.length &&
        isFinite(number(rows[i][xi])) && isFinite(number(rows[i][yi])) &&
        typeof rows[i][xi] == 'number' && typeof rows[i][yi] == 'number';
}


function slope(rows, xi, yi, row) {
    // the slope dy/dx at row: from the point before to the point after (at the ends: one side)
    if (!finite_row(rows, row, xi, yi)) return null;
    var a = finite_row(rows, row - 1, xi, yi) ? row - 1 : row;
    var b = finite_row(rows, row + 1, xi, yi) ? row + 1 : row;
    if (a == b) return null;
    var dx = rows[b][xi] - rows[a][xi];
    var dy = rows[b][yi] - rows[a][yi];
    if (dx === 0 || !isFinite(dy / dx)) return null;
    return dy / dx;
}


function tangent_to_axes(point, s, range) {
    // the tangent through point, drawn through the whole graph: from axis to axis, as a student does on
    // paper. The ends are where the line leaves the graph: on the axes (x = xmin, y = ymin) when it
    // crosses them inside the graph, otherwise on the edge (x = xmax, y = ymax).
    // Returns [[x1, y1], [x2, y2]] with x1 < x2, or null.
    var x0 = point[0], y0 = point[1];
    if (isNaN(range.xmax - range.xmin) || isNaN(range.ymax - range.ymin) || !isFinite(s)) return null;
    if (range.xmax <= range.xmin || range.ymax <= range.ymin) return null;
    if (x0 < range.xmin || x0 > range.xmax || y0 < range.ymin || y0 > range.ymax) return null;
    var ends = [];
    function add(x, y) {
        if (x < range.xmin || x > range.xmax || y < range.ymin || y > range.ymax) return;
        ends.push([x, y]);
    }
    add(range.xmin, y0 + s * (range.xmin - x0));
    add(range.xmax, y0 + s * (range.xmax - x0));
    if (s !== 0) {
        add(x0 + (range.ymin - y0) / s, range.ymin);
        add(x0 + (range.ymax - y0) / s, range.ymax);
    }
    if (ends.length < 2) return null;
    ends.sort(function(a, b) { return a[0] - b[0]; });
    var a = ends[0], b = ends[ends.length - 1];
    if (b[0] - a[0] <= 0) return null;
    return [a, b];
}


function slope_unit(y_unit, x_unit) {
    // unit of the slope: 'm/s' and 's' --> '(m/s)/s'. Unknown: ''
    if (!y_unit || !x_unit) return '';
    function wrap(u) { return /[\/\s*]/.test(u) ? '(' + u + ')' : u; }
    return wrap(y_unit) + '/' + wrap(x_unit);
}


exports.slope = slope;
exports.tangent_to_axes = tangent_to_axes;
exports.slope_unit = slope_unit;

},{}],2:[function(require,module,exports){
/*
    assen.js

    Meerdere grafieken in één figuur: krijgt een grafiek een tweede as rechts?
    Verschilt het bereik van de gekozen grootheden meer dan een factor 20, dan komen de
    kleine grootheden op een tweede as rechts (anders zijn ze een vlakke lijn op de nul).

    No DOM.

    usage:
      var assen = require('./assen.js');
      assen.split(['x', 'v'], {x: [0, 800], v: [0, 12]})   // {left: ['x'], right: ['v']}
*/

//jshint node:true
//jshint es3:true
"use strict";

var FACTOR = 20;


function size(range) {
    // how large are the values? (the axis usually starts at 0)
    if (!range) return 0;
    var a = Math.abs(range[0]), b = Math.abs(range[1]);
    var s = Math.max(isFinite(a) ? a : 0, isFinite(b) ? b : 0);
    return s;
}


function split(names, ranges) {
    // names in the order of the checkboxes. ranges: name --> [min, max]
    var sizes = names.map(function(name) { return size(ranges[name]); });
    var largest = Math.max.apply(null, [0].concat(sizes));
    var left = [], right = [];
    names.forEach(function(name, n) {
        if (largest > 0 && sizes[n] > 0 && sizes[n] * FACTOR < largest) {
            right.push(name);
        } else {
            left.push(name);
        }
    });
    return {left: left, right: right};
}


function data_range(data) {
    // [min, max] of y in [[x, y], ...] (null: gap)
    var min = Infinity, max = -Infinity;
    (data || []).forEach(function(p) {
        if (p === null) return;
        if (p[1] < min) min = p[1];
        if (p[1] > max) max = p[1];
    });
    return (min <= max) ? [min, max] : null;
}


exports.split = split;
exports.data_range = data_range;
exports.FACTOR = FACTOR;

},{}],3:[function(require,module,exports){
/*
    autoplot.js

    Kies automatisch de relevante grafieken bij een model.

    De keuze is gebaseerd op:
     - de modelregels (AST): welke variabelen worden "opgeteld" (x = x + v*dt)
       Dit zijn de toestandsvariabelen (plaats, snelheid, tijd, ...) van het model.
     - de resultaten: variabelen die niet veranderen zijn niet interessant
     - de namen van de variabelen (t, x, y, h, v, a, ...)

    usage:
      var autoplot = require('./autoplot.js');
      var analysis = autoplot.analyse(varNames, results, modelregels_ast);
      analysis.graphs --> [{x: 't', y: 'x'}, {x: 't', y: 'v'}, ...]
      De eerste grafiek is de meest relevante.
*/

//jshint node:true
//jshint es3:true
"use strict";

var MAX_GRAPHS = 8;

// (y, x) combinaties die samen een baan in het platte vlak vormen
var TRAJECTORIES = [['x', 'y'], ['x', 'h'], ['x', 'z']];

// voorkeursvolgorde voor grafieken tegen de tijd
var PRIORITY = ['s', 'x', 'y', 'h', 'u', 'r', 'θ', 'ϑ', 'φ', 'v', 'vx', 'vy', 'a'];
var PRIORITY_GROWTH = ['I', 'N'];  // groei/verval en SIR modellen


function walk_expr(node, callback) {
    // call callback(node) for each node in expression
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk_expr(node.left, callback);
    walk_expr(node.right, callback);
    walk_expr(node.expr, callback);
}


function find_assignments(ast, found, conditional) {
    // list all assignments in order:
    //  [{name: 'x', integrator: true, conditional: false}, ...]
    // conditional: assignment is inside als ... dan ... eindals
    conditional = conditional || false;
    for (var i = 0; i < ast.length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment') {
            found.push({
                name: stmt.left,
                integrator: references(stmt.right, stmt.left),
                conditional: conditional
            });
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            find_assignments(stmt.then, found, true);
            if (stmt.elsestmt) find_assignments(stmt.elsestmt, found, true);
        }
    }
    return found;
}


function references(expr, name) {
    var found = false;
    walk_expr(expr, function(node) {
        if (node.type == 'Variable' && node.name == name) found = true;
    });
    return found;
}


function column_stats(results, col) {
    // min, max and "has a constant step" of column. Skip non-numbers.
    var min = Infinity, max = -Infinity;
    var n = 0;
    var numeric = true;
    var monotonic = true;
    var prev;

    for (var i = 0; i < results.length; i++) {
        var val = results[i][col];
        if (typeof val !== 'number') {
            if (typeof val === 'boolean') numeric = false;
            continue;
        }
        if (!isFinite(val)) continue;
        if (val < min) min = val;
        if (val > max) max = val;
        if (prev !== undefined && val <= prev) monotonic = false;
        prev = val;
        n += 1;
    }
    var scale = Math.max(Math.abs(min), Math.abs(max));
    return {
        numeric: numeric && n > 0,
        constant: (n === 0) || (max - min <= 1e-12 * scale),
        monotonic: monotonic && n > 1
    };
}


function analyse(varNames, results, modelregels_ast) {

    var i, name;
    var info = {};
    var order = [];  // variables in order of appearance in the model

    var assignments = find_assignments(modelregels_ast || [], []);
    for (i = 0; i < varNames.length; i++) {
        // conditional: only gets a value inside als ... dan ... eindals
        info[varNames[i]] = {integrator: false, conditional: true, column: i};
    }
    for (i = 0; i < assignments.length; i++) {
        name = assignments[i].name;
        if (!info.hasOwnProperty(name)) continue;
        if (assignments[i].integrator) info[name].integrator = true;
        if (!assignments[i].conditional) info[name].conditional = false;
        if (order.indexOf(name) == -1) order.push(name);
    }
    for (i = 0; i < varNames.length; i++) {
        if (order.indexOf(varNames[i]) == -1) order.push(varNames[i]);
    }

    for (i = 0; i < varNames.length; i++) {
        name = varNames[i];
        var stats = column_stats(results, i);
        info[name].numeric = stats.numeric;
        info[name].constant = stats.constant;
        info[name].monotonic = stats.monotonic;
        // dx, dv, dOpp: the step that is added to x, v, Opp
        var base = /^(d|Δ)(.+)$/.exec(name);
        info[name].step = (base !== null) && info.hasOwnProperty(base[2]) && base[2] != name;
    }

    function exists(name) {
        return info.hasOwnProperty(name);
    }

    function interesting(name) {
        return exists(name) && info[name].numeric && !info[name].constant;
    }

    // --- time
    var time = null;
    var candidates = ['t', 'T', 'tijd'];
    for (i = 0; i < candidates.length && time === null; i++) {
        name = candidates[i];
        if (interesting(name) && info[name].integrator && info[name].monotonic) time = name;
    }
    if (time === null && interesting('t')) time = 't';
    for (i = 0; i < order.length && time === null; i++) {
        // no 't': use another variable that only counts up
        name = order[i];
        if (interesting(name) && info[name].integrator && info[name].monotonic &&
            /^t/i.test(name)) time = name;
    }

    var graphs = [];

    function add(x, y) {
        if (x == y) return;
        for (var j = 0; j < graphs.length; j++) {
            if (graphs[j].x == x && graphs[j].y == y) return;
        }
        graphs.push({x: x, y: y});
    }

    // --- trajectory (y,x)
    for (i = 0; i < TRAJECTORIES.length; i++) {
        var tx = TRAJECTORIES[i][0], ty = TRAJECTORIES[i][1];
        if (interesting(tx) && interesting(ty)) {
            add(tx, ty);
            break;
        }
    }

    // --- everything else: against time (or against the first variable)
    var xaxis = time;
    if (xaxis === null) {
        for (i = 0; i < varNames.length && xaxis === null; i++) {
            if (interesting(varNames[i])) xaxis = varNames[i];
        }
    }

    if (xaxis !== null) {
        var ranked = [];
        var push = function(name) {
            if (name != xaxis && interesting(name) && !info[name].step &&
                ranked.indexOf(name) == -1) ranked.push(name);
        };
        if (exists('N') || exists('I')) PRIORITY_GROWTH.forEach(push);
        PRIORITY.forEach(push);
        // other integrators: state of the model
        order.forEach(function(name) {
            if (info[name].integrator) push(name);
        });
        // resulting force
        order.forEach(function(name) {
            if (/^F_?(res|r|netto|tot)/i.test(name)) push(name);
        });
        order.forEach(push);

        for (i = 0; i < ranked.length; i++) add(xaxis, ranked[i]);

        // steps (dx, dv) are the least interesting. Only use if nothing else
        if (graphs.length === 0) {
            order.forEach(function(name) {
                if (name != xaxis && interesting(name)) add(xaxis, name);
            });
        }
    }

    // --- nothing interesting: just plot the first two variables
    if (graphs.length === 0 && varNames.length > 1) {
        add(varNames[0], varNames[1]);
    }

    return {
        time: time,
        graphs: graphs.slice(0, MAX_GRAPHS),
        info: info
    };
}

exports.analyse = analyse;
exports.find_assignments = find_assignments;

},{}],4:[function(require,module,exports){
/*
    deellink.js

    "Deel link": the complete model in the URL, so a student or teacher can share a
    (changed) model without a file. This module makes and reads those links.
    No DOM, no browser APIs: tested with mocha (test/deellink_tests.js).

    Formats (the part after # in the URL):

      #model=examenvwo2005&N=100     a model from modellen/ (and optionally N)

      #code=<payload>                version 1 (webapp 6.0).    payload is
                                     base64url(utf-8(JSON)) without '=' padding,
                                     JSON: {"m": modelregels, "s": startwaarden,
                                            "t": titel (optional), "N": iteraties (optional),
                                            "o": opdracht (optional, since 6.5),
                                            "p": indeling (optional, since 6.5): positions of
                                                 dragged symbols, {"id": [x, y], ...}}

      #code=v2.<payload>             version 2: the same JSON and encoding, with a version
                                     in front. '.' never occurs in base64url, so a link
                                     without "v<number>." is always version 1.

    Rules for the future (backwards compatibility):
      - A link that was ever shared must keep working. The tests have frozen links of
        every version: they may never be changed, only added.
      - A new version (other encoding, compression, ...) gets a new number: "v3.".
        decode() keeps reading all older versions.
      - New fields in the JSON are optional; unknown fields are ignored. So adding a
        field does not need a new version.
      - A link of a newer version than this webapp knows gives a clear message
        (err.newer), not a wrong model.

    Reading is forgiving, because links are copied through chat, mail and documents:
    standard base64 (+/ and = padding), spaces and line breaks, percent-encoding and
    a character stuck to the end (a period or bracket after the link) are accepted.

    usage:
      var deellink = require('./deellink.js');
      deellink.encode({modelregels: 'x = x + v*dt', startwaarden: 'x = 0', title: 'Val', N: 100})
        --> 'v2.eyJ...'
      deellink.decode('v2.eyJ...')
        --> {modelregels, startwaarden, title, N, version: 2}
      deellink.parse_hash('#model=examenvwo2005&N=100')
        --> {model: 'examenvwo2005', N: '100'}
*/

//jshint node:true
//jshint es3:true
"use strict";

var VERSION = 2;   // the version of new links

var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';


// ------------------------------------------------------------------ utf-8

function utf8_bytes(str) {
    // string --> array of utf-8 bytes (same result as unescape(encodeURIComponent(str)))
    var encoded = encodeURIComponent(str), bytes = [];
    for (var i = 0; i < encoded.length; i++) {
        if (encoded.charAt(i) == '%') {
            bytes.push(parseInt(encoded.substr(i + 1, 2), 16));
            i += 2;
        } else {
            bytes.push(encoded.charCodeAt(i));
        }
    }
    return bytes;
}

function utf8_string(bytes) {
    // array of utf-8 bytes --> string. Throws on invalid utf-8.
    var encoded = '';
    for (var i = 0; i < bytes.length; i++) {
        encoded += '%' + (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return decodeURIComponent(encoded);
}


// ------------------------------------------------------------------ base64url

function base64url_encode(bytes) {
    // bytes --> base64url without '=' padding
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
        var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
        out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63);
        if (i + 1 < bytes.length) out += ALPHABET.charAt((n >> 6) & 63);
        if (i + 2 < bytes.length) out += ALPHABET.charAt(n & 63);
    }
    return out;
}

function base64_decode(text) {
    // base64url or standard base64 (with or without padding) --> bytes. Throws if invalid.
    text = text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (text.length % 4 == 1) throw new Error('base64: wrong length');
    var bytes = [], n = 0, bits = 0;
    for (var i = 0; i < text.length; i++) {
        var value = ALPHABET.indexOf(text.charAt(i));
        if (value == -1) throw new Error('base64: invalid character');
        n = (n << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((n >> bits) & 255);
        }
    }
    return bytes;
}


// ------------------------------------------------------------------ errors

function link_error(message, props) {
    var err = new Error(message);
    err.deellink = true;
    for (var key in props || {}) {
        if (props.hasOwnProperty(key)) err[key] = props[key];
    }
    return err;
}


// ------------------------------------------------------------------ links

function encode(model) {
    // model: {modelregels, startwaarden, title, N, opdracht, indeling (all optional but the first two)}
    //   --> 'v2.<payload>'
    var json = {m: String(model.modelregels || ''), s: String(model.startwaarden || '')};
    if (model.title) json.t = String(model.title);
    var N = Number(model.N);
    if (isFinite(N) && N > 0) json.N = N;
    if (model.opdracht) json.o = String(model.opdracht);
    if (model.indeling && typeof model.indeling == 'object' && !is_empty(model.indeling)) json.p = model.indeling;
    return 'v' + VERSION + '.' + base64url_encode(utf8_bytes(JSON.stringify(json)));
}


function clean(code) {
    // undo what chat, mail and documents do with a link
    code = String(code === undefined || code === null ? '' : code);
    if (code.indexOf('%') != -1) {
        try {
            code = decodeURIComponent(code);
        } catch (err) {
            // not percent-encoded after all: use as it is
        }
    }
    // spaces and line breaks (a long link broken over lines)
    return code.replace(/\s+/g, '');
}


function decode(code) {
    // the value of #code=... --> {modelregels, startwaarden, title, N, version}
    // Throws an Error with err.deellink = true (and err.newer for a newer version).
    code = clean(code);
    var version = 1, payload = code;
    var match = /^v(\d+)\.(.*)$/i.exec(code);
    if (match) {
        version = parseInt(match[1], 10);
        payload = match[2];
    }
    if (version > VERSION) {
        throw link_error('Deze link is gemaakt met een nieuwere versie van de webapp (versie ' + version +
            ' van de deellink). Ververs de pagina (Ctrl+F5) en probeer het opnieuw.', {newer: true, version: version});
    }
    if (version < 1) throw link_error('Deze link klopt niet (onbekende versie).');

    // versions 1 and 2: base64url(utf-8(JSON)).
    // A character stuck to the end of the link (a period, a bracket) is not base64: remove it.
    payload = payload.replace(/[^A-Za-z0-9\-_+\/=]+$/, '');
    var json;
    try {
        json = JSON.parse(utf8_string(base64_decode(payload)));
    } catch (err) {
        throw link_error('Het model in deze link kan niet gelezen worden. Is de link helemaal gekopieerd? ' +
            'Lange links worden soms afgebroken.', {incomplete: true});
    }
    if (!json || typeof json != 'object' || (json.m === undefined && json.s === undefined)) {
        throw link_error('In deze link staat geen model.');
    }

    var N = Number(json.N);
    return {
        modelregels: String(json.m === undefined || json.m === null ? '' : json.m),
        startwaarden: String(json.s === undefined || json.s === null ? '' : json.s),
        title: json.t ? String(json.t) : '',
        N: (isFinite(N) && N > 0) ? N : undefined,
        opdracht: json.o ? String(json.o) : '',
        indeling: positions(json.p),
        version: version
    };
}


function is_empty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) return false;
    }
    return true;
}


function positions(value) {
    // the positions of dragged symbols: {"id": [x, y]} (also {x, y}). Anything else is left out.
    var out = {};
    if (!value || typeof value != 'object') return out;
    for (var id in value) {
        if (!value.hasOwnProperty(id)) continue;
        var v = value[id], x, y;
        if (v && typeof v == 'object' && v.length == 2) {
            x = Number(v[0]);
            y = Number(v[1]);
        } else if (v && typeof v == 'object') {
            x = Number(v.x);
            y = Number(v.y);
        }
        if (isFinite(x) && isFinite(y)) out[id] = [x, y];
    }
    return out;
}


function parse_hash(hash) {
    // '#model=examenvwo2005&N=100' --> {model: 'examenvwo2005', N: '100'}
    // Only the first '=' separates name and value (a value may contain '=').
    var params = {};
    hash = String(hash || '').replace(/^#/, '');
    hash.split('&').forEach(function(item) {
        if (!item) return;
        var i = item.indexOf('=');
        var name = i == -1 ? item : item.substr(0, i);
        var value = i == -1 ? '' : item.substr(i + 1);
        params[name] = value;
    });
    if (params.model) {
        try {
            params.model = decodeURIComponent(params.model);
        } catch (err) {
            // use as it is
        }
    }
    return params;
}


exports.VERSION = VERSION;
exports.encode = encode;
exports.decode = decode;
exports.parse_hash = parse_hash;
exports.positions = positions;

},{}],5:[function(require,module,exports){
/*
    dtcheck.js

    Is dt klein genoeg? Reken het model nog eens door met dt/2 en 2N iteraties.
    Hangt de uitkomst daarvan af, dan is de tijdstap te groot:

      "De uitkomst hangt nog af van de tijdstap: met dt = 0,05 eindigt x op 812
       in plaats van 838. Probeer een kleinere dt."

    No DOM.

    usage:
      var dtcheck = require('./dtcheck.js');
      var r = dtcheck.check(model, N, {results, varNames, stopped, runtime_ms, analysis});
      if (r) show(dtcheck.message(r, format));
*/

//jshint node:true
//jshint es3:true
"use strict";

var evaluator_js = require('./evaluator.js');
var stapper = require('./stapper.js');

var MAX_N = 100000;          // larger models: no check
var MAX_RUNTIME_MS = 200;    // slow models: no check
var TOLERANCE = 0.05;        // 5% of the range of a variable


function assigns(ast, name) {
    // is name assigned anywhere in the statements (also inside als ... eindals)?
    for (var i = 0; i < (ast || []).length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment' && stmt.left == name) return true;
        if ((stmt.type == 'If' || stmt.type == 'IfElse') &&
            (assigns(stmt.then, name) || assigns(stmt.elsestmt, name))) return true;
    }
    return false;
}


function column(rows, varNames, name) {
    var j = varNames.indexOf(name);
    if (j == -1) return null;
    return rows.map(function(row) { return row[j]; });
}


function range(values) {
    var min = Infinity, max = -Infinity;
    values.forEach(function(v) {
        if (typeof v != 'number' || !isFinite(v)) return;
        if (v < min) min = v;
        if (v > max) max = v;
    });
    return (max >= min) ? max - min : 0;
}


function last(values) {
    return values[values.length - 1];
}


function check(model, N, first) {
    // model: {startwaarden, modelregels} (text). N: iterations of the first run.
    // first: the first run {results, varNames, stopped, runtime_ms, analysis (autoplot.analyse)}
    // returns null (no problem found, or not checked) or
    //   {kind: 'end'|'stop', name, dt, dt_half, value, value_half}
    if (N > MAX_N || first.runtime_ms > MAX_RUNTIME_MS) return null;

    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    var ast = evaluator.startwaarden_ast;

    // dt must be a startwaarde (and not change in the modelregels)
    var k = -1;
    for (var i = 0; i < ast.length; i++) {
        if (ast[i].type == 'Assignment' && ast[i].left == 'dt') k = i;
    }
    if (k == -1 || assigns(evaluator.modelregels_ast, 'dt')) return null;

    var dt = new stapper.Stepper(ast.slice(0, k + 1), [], []).values.dt;
    if (typeof dt != 'number' || !isFinite(dt) || dt <= 0) return null;

    // dt = dt / 2, right after the startwaarde of dt
    ast.splice(k + 1, 0, {
        type: 'Assignment', left: 'dt', lineNo: ast[k].lineNo, astName: 'startwaarden',
        right: {type: 'Binary', operator: '/', left: {type: 'Variable', name: 'dt'},
                right: {type: 'Number', value: '2'}}
    });
    evaluator.set_state(2 * N, true, false);
    evaluator.run();
    var second = {results: evaluator.result, varNames: evaluator.namespace.varNames, stopped: evaluator.stopped};

    var result = {dt: dt, dt_half: dt / 2};
    var time = first.analysis ? first.analysis.time : null;

    if (first.stopped || second.stopped) {
        // stopped by 'stop': compare the time at which the model stops
        if (!time) return null;
        var t1 = column(first.results, first.varNames, time);
        var t2 = column(second.results, second.varNames, time);
        if (!t1 || !t2 || !isFinite(last(t1)) || !isFinite(last(t2))) return null;
        if (Math.abs(last(t1) - last(t2)) <= TOLERANCE * range(t1)) return null;
        result.kind = 'stop';
        result.name = time;
        result.value = last(t1);
        result.value_half = last(t2);
        return result;
    }

    // same end time: compare the end value of each toestandsvariabele
    var worst = 0;
    first.varNames.forEach(function(name) {
        var info = first.analysis && first.analysis.info[name];
        if (!info || !info.integrator || name == time) return;
        var a = column(first.results, first.varNames, name);
        var b = column(second.results, second.varNames, name);
        if (!a || !b) return;
        var end1 = last(a), end2 = last(b);
        if (typeof end1 != 'number' || typeof end2 != 'number' || !isFinite(end1) || !isFinite(end2)) return;
        var r = range(a);
        if (r === 0) return;
        var deviation = Math.abs(end1 - end2) / r;
        if (deviation > TOLERANCE && deviation > worst) {
            worst = deviation;
            result.kind = 'end';
            result.name = name;
            result.value = end1;
            result.value_half = end2;
        }
    });
    return result.kind ? result : null;
}


function message(r, format) {
    format = format || stapper.format_default;
    var text = 'De uitkomst hangt nog af van de tijdstap: met dt = ' + format(r.dt_half) + ' ';
    if (r.kind == 'stop') {
        text += 'stopt het model bij ' + r.name + ' = ' + format(r.value_half) +
                ' in plaats van ' + format(r.value) + '.';
    } else {
        text += 'eindigt ' + r.name + ' op ' + format(r.value_half) + ' in plaats van ' + format(r.value) + '.';
    }
    return text + ' Probeer een kleinere dt.';
}


exports.check = check;
exports.message = message;

},{"./evaluator.js":7,"./stapper.js":22}],6:[function(require,module,exports){
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

function pretty(text) {
    // 'm/s^2' --> 'm/s²', 'kg*m' --> 'kg·m': how a unit is shown (the text of the model keeps 'm/s^2')
    return String(text).replace(/\^\s*([-−]?)(\d+)/g, function(all, minus, digits) {
        var t = minus ? '⁻' : '';
        for (var i = 0; i < digits.length; i++) t += TO_SUP[Number(digits.charAt(i))];
        return t;
    }).replace(/\s*\*\s*/g, '·');
}

function latex(text) {
    // 'm/s²' --> 'm/s^{2}', 'kg·m' --> 'kg.m': for \si{...} in the pgfplots download
    var back = {}, k;
    for (k in SUP) if (SUP.hasOwnProperty(k)) back[k] = String(SUP[k]);
    return String(text).replace(/([⁻]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function(all, minus, sup) {
        var t = minus ? '-' : '';
        for (var i = 0; i < sup.length; i++) t += back[sup.charAt(i)];
        return '^{' + t + '}';
    }).replace(/·/g, '.');
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
    // shown with superscripts (m²), also a unit as it was typed (m^2)
    for (var n in out.units) if (out.units.hasOwnProperty(n)) out.units[n] = pretty(out.units[n]);
    return out;
}

exports.units = units;
exports.derive = derive;
exports.deriveAst = deriveAst;
exports.parse = parse;
exports.format = format;
exports.pretty = pretty;
exports.latex = latex;
exports.label = label;
exports.labels = labels;
exports.line_unit = line_unit;

},{"./modelleertaal":14}],7:[function(require,module,exports){
/*
    Interpreter for Modelleertaal (modelregels)
    Simple dynamical models for highschool Physics in NL

    The language is described in modelleertaal.jison

    usage:
      npm install path_to/jison
      node interpreter.js
*/


//jshint node:true
//jshint devel:true
//jshint evil:true
//jshint es3:true
"use strict";

// parser compiled on execution by jison.js
var modelmodule = require("./model.js");
var parser = require("./modelleertaal").parser;


// patch parser.patch to inject AST name
var ast_name = 'global';
parser._parse = parser.parse;
parser.parse = function(code, ast) {
  ast_name = ast;
  return parser._parse(code);
};

/*
 * Patch the parser to inject line numbers into AST nodes
 * https://stackoverflow.com/a/10424328/4965175
 */
// store the current performAction function
parser._performAction = parser.performAction;
// override performAction
parser.performAction = function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {
    // invoke the original performAction
    var ret = parser._performAction.call(this, yytext, yyleng, yylineno, yy, yystate, $$, _$);
    // Add linenumber to each AST node
    this.$.lineNo = yylineno + 1;
    this.$.astName = ast_name; // global set in patched parser.parse()
    return ret;
};

// Array.prototype.includes polyfill (ECMAScript 7)
// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {

      // 1. Let O be ? ToObject(this value).
      if (this === null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n ≥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(searchElement, elementK) is true, return true.
        // c. Increase k by 1.
        // NOTE: === provides the correct "SameValueZero" comparison needed here.
        if (o[k] === searchElement) {
          return true;
        }
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}

/*
 Class namespace

 Variables are created in this.varNames = {} (a list of variable names)

 Startwaarden are copied to this.constNames and varNames are erased after
 parsing "startwaarden.txt". This is a trick to keep startwaarden seperate
*/

function Namespace() {

    // prefix to prevent variable name collision with reserved words
    this.varPrefix = "var_";

    this.varNames = []; // list of created variables
    this.constNames = []; // list of startwaarden that remain constant in execution
    // dictionary that converts Modelleertaal identifiers (with illegal
    //  chars [] {} in name) to javascipt identifiers
    this.varDict = {};
}

if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (obj, fromIndex) {
    if (fromIndex === null) {
        fromIndex = 0;
    } else if (fromIndex < 0) {
        fromIndex = Math.max(0, this.length + fromIndex);
    }
    for (var i = fromIndex, j = this.length; i < j; i++) {
        if (this[i] === obj)
            return i;
    }
    return -1;
  };
}

// remove javascript illegal or special char from variable names
Namespace.prototype.mangleName= function(string) {
    return this.varPrefix + string.replace(/\{/g,'_lA_').replace(/\}/g,'_rA_').replace(/\[/g,'_lH_').replace(/\]/g,'_rH_').replace(/\|/g,'_I_');
};

// create (or reference) variable that is on the left side of an assignment
Namespace.prototype.createVar = function(name) {
    if (this.varNames.indexOf(name) == -1)  {
        this.varNames.push(name);
    }
    this.varDict[name] = this.mangleName(name);
    return this.varDict[name];
};

// reference a variable that is on the right side of an assignment
// It should already exist if on the right side
Namespace.prototype.referenceVar = function(node) {

    var name = node.name;

    // it should exist (but perhaps in "startwaarden" (constNames))
    if ((this.varNames.indexOf(name) == -1) && (this.constNames.indexOf(name) == -1)) {
        var msg = "De variabele '" + name + "' heeft nog geen waarde.";
        var lijkt_op = this.findSimilarName(name);
        if (lijkt_op) {
            msg += " Bedoel je '" + lijkt_op + "'? (Let op hoofdletters en typefouten.)";
        } else if (node.astName == 'startwaarden') {
            msg += " Geef '" + name + "' eerst (hoger in de startwaarden) een waarde.";
        } else {
            msg += " Geef '" + name + "' een startwaarde, of bereken '" + name + "' eerder in het model.";
        }
        var err = new EvalError(msg);
        err.undefined_variable = name;
        throw_custom_error(err, node.astName, node.lineNo);
    }
    return this.varDict[name];
};

// find a known variable that looks like name (typo or wrong case)
Namespace.prototype.findSimilarName = function(name) {

    function distance(a, b) {
        // Levenshtein distance
        var i, j, prev, tmp;
        var row = [];
        for (j = 0; j <= b.length; j++) row[j] = j;
        for (i = 1; i <= a.length; i++) {
            prev = row[0];
            row[0] = i;
            for (j = 1; j <= b.length; j++) {
                tmp = row[j];
                row[j] = Math.min(row[j] + 1, row[j-1] + 1,
                                  prev + (a.charAt(i-1) == b.charAt(j-1) ? 0 : 1));
                prev = tmp;
            }
        }
        return row[b.length];
    }

    var known = this.constNames.concat(this.varNames);
    var i;
    for (i = 0; i < known.length; i++) {
        if (known[i].toLowerCase() == name.toLowerCase()) return known[i];
    }
    if (name.length < 3) return null;
    for (i = 0; i < known.length; i++) {
        if (known[i].length >= 3 && distance(known[i], name) <= 2 &&
            distance(known[i].toLowerCase(), name.toLowerCase()) <= (name.length > 4 ? 2 : 1)) return known[i];
    }
    return null;
};

Namespace.prototype.listAllVars = function() {
    // should really throw exception?
    console.log("WARNING: called obsolete function namespace.listAllVars()");
    return this.varNames;
};

Namespace.prototype.removePrefix = function(name) {

    var regex = new RegExp("^" + this.varPrefix);
    return name.replace(regex, '');
};


Namespace.prototype.moveStartWaarden = function () {
    this.constNames = this.varNames;
    this.varNames = [];
};

Array.prototype.swap = function(a, b) {
    this[a] = this.splice(b, 1, this[a])[0];
    return this;
};

Namespace.prototype.sortVarNames = function () {
    /* sort varNames. "Stock" variables (t, x, s) come first.
       enables automatic graphs of important variables */

    // now sorts on variable NAME. Should identify stock variables in AST.

    // names of "special"variable names to sort, sort if found in order given
    var nameList;
    if (this.varNames.includes('y') & this.varNames.includes('x')) {
      // try to plot y,x diagram
      nameList = ['x', 'y', 't', 's', 'h', 'u', 'v', 'vx', 'vy'];
    } else if (this.varNames.includes('h') & this.varNames.includes('x')) {
      // try to plot h,x diagram
      nameList = ['x', 'h', 't', 's', 'y', 'v', 'vx', 'vy'];
    } else if (this.varNames.includes('N') & this.varNames.includes('t')) {
        // try to plot N,t diagram (For SIR-virusmodels: plot I,t)
        nameList = ['t', 'I', 'N', 'x', 's', 'y', 'v', 'vx', 'vy'];
    } else {
      // try to plot s,t or x,t diagram
      nameList = ['t', 's', 'x', 'y', 'h', 'u', 'v', 'vx', 'vy', 'θ', 'ϑ'];
    }
    var nextVariableIndex = 0 ; // place to swap next "special"variable with

    /*  nextVariableIndex = 0
        for variable in nameList:
            if variable in this.varNames:
                swap variable with variable at nextVariableIndex
                nextVariableIndex += 1
    */
    for (var i = 0; i < nameList.length; i++) {
        var varNames_position = this.varNames.indexOf(nameList[i]);
        if (varNames_position != -1) {
            // swap and *afterwards* increase nextVariableIndex
            this.varNames.swap(varNames_position, nextVariableIndex++); }
    }
};


/*
 Class Codegenerator
 */
function CodeGenerator(namespace) {
    if (typeof namespace === 'undefined') {
        this.namespace = new Namespace();
    } else {
        this.namespace = namespace;
    }
}

CodeGenerator.prototype.setNamespace = function(namespace) {
    this.namespace = namespace; // storage for variable names
};

CodeGenerator.prototype.generateVariableStorageCode = function() {
    var code = 'storage[i] = [];\n';
    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += "storage[i].push("+variable+");\n";
    }
    return code;
};

CodeGenerator.prototype.generateVariableInitCode = function() {
    var code = '//initialize all variables to NaN\n';
    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += variable+"=NaN;\n";
    }
    return code;
};

CodeGenerator.prototype.generateVariableInitCode_second_run = function() {
    var code = '//initialize all variables to previous values\n';
    code += 'var last_row = storage[storage.length - 1];';

    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += variable+"=last_row["+i+"];\n";
    }
    return code;
};


CodeGenerator.prototype.generateCodeFromAst = function(ast, break_at_line) {

    var code = "";
    for (var i = 0; i < ast.length; i++) {
        //console.log("AST item = ",ast[i])
        code += this.parseNode(ast[i]);
        if (i == break_at_line) code += '/*breakpoint*/ bailout=true;\nbreak;\n';
    }
    return code;
};


CodeGenerator.prototype.parseNode = function(node) {
    /* parseNode is a recursive function that parses an item
        of the JSON AST. Calls itself to traverse through nodes.

        :param: node = (part of) JSON tree
    */

    /* javascript code generation inspired by:
        http://lisperator.net/pltut/compiler/js-codegen */

    switch(node.type) {

        case 'Assignment':
                /* evaluate the right side first, to make sure 'x=x+dx' with
                x undefined fails in code generation. */
                var node_right = this.parseNode(node.right);
                return  this.namespace.createVar(node.left)+ ' = (' +
                              node_right + ');\n';
        case 'Variable':
                return this.namespace.referenceVar(node);
        case 'Binary': {
                    if (node.operator == '^')
                        return "(Math.pow("+this.parseNode(node.left)+","+this.parseNode(node.right)+"))";
                    else
                        return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
                    break;
                    }
        case 'Unary':
                    switch(node.operator) {
                        case '+':   return "(" + this.parseNode(node.right) + ")";
                        case '-':   return "(-1. * " + this.parseNode(node.right) + ")";
                        case 'NOT':  return "!("+ this.parseNode(node.right) + ")";
                        default: {
                            var err = new SyntaxError("Unknown unary:" + JSON.stringify(node));
                            throw_custom_error(err, node.astName, node.lineNo);}
                    }
        /* falls through */
        case 'Logical':
                return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
        case 'If':
                return "if (" + this.parseNode(node.cond) + ") {\n" + this.generateCodeFromAst(node.then) + " }\n; ";
        case 'IfElse':
                return "if (" + this.parseNode(node.cond) + ") {\n" + this.generateCodeFromAst(node.then) + " \n} else {\n" +
                this.generateCodeFromAst(node.elsestmt) + " }\n; ";
        case 'Function': {
                switch(node.func.toLowerCase()) {
                    case 'sin': return "Math.sin(("+this.parseNode(node.expr)+")/180.*Math.PI)";
                    case 'cos': return "Math.cos(("+this.parseNode(node.expr)+")/180.*Math.PI)";
                    case 'tan': return "Math.tan(("+this.parseNode(node.expr)+")/180.*Math.PI)";
                    case 'sinr': return "Math.sin("+this.parseNode(node.expr)+")";
                    case 'cosr': return "Math.cos("+this.parseNode(node.expr)+")";
                    case 'tanr': return "Math.tan("+this.parseNode(node.expr)+")";
                    case 'arcsin': return "Math.asin("+this.parseNode(node.expr)+")*180./Math.PI";
                    case 'arccos': return "Math.acos("+this.parseNode(node.expr)+")*180./Math.PI";
                    case 'arctan': return "Math.atan("+this.parseNode(node.expr)+")*180./Math.PI";
                    case 'arcsinr': return "Math.asin("+this.parseNode(node.expr)+")";
                    case 'arccosr': return "Math.acos("+this.parseNode(node.expr)+")";
                    case 'arctanr': return "Math.atan("+this.parseNode(node.expr)+")";
                    case 'exp': return "Math.exp("+this.parseNode(node.expr)+")";
                    case 'ln':  return "Math.log("+this.parseNode(node.expr)+")";
                    case 'log':  return "Math.log10("+this.parseNode(node.expr)+")";
                    case 'sqrt': return "Math.sqrt("+this.parseNode(node.expr)+")";
                    case 'wortel': return "Math.sqrt("+this.parseNode(node.expr)+")";
                    case 'sqr': return "Math.pow("+this.parseNode(node.expr)+",2)";
                    case 'entier': return "Math.floor("+this.parseNode(node.expr)+")";
                    case 'round': return "Math.round("+this.parseNode(node.expr)+")";
                    case 'sign': return "Math.sign("+this.parseNode(node.expr)+")";
                    case 'teken': return "Math.sign("+this.parseNode(node.expr)+")";
                    case 'abs': return "Math.abs("+this.parseNode(node.expr)+")";
                    case 'min': return "Math.min("+this.parseNode(node.expr)+")";
                    case 'max': return "Math.max("+this.parseNode(node.expr)+")";

                    default:
                        var err1 = new SyntaxError("Onbekende functie '" + node.func + "(...)'. Bedoel je een vermenigvuldiging? Schrijf dan: " + node.func + " * (...). Kijk bij 'Functies' onder de modelregels welke functies er zijn.");
                        throw_custom_error(err1, node.astName, node.lineNo);
                    }
                break;
                }
        case 'Number':
                return parseFloat(node.value.replace(',','.'));
        case 'List':
                return this.parseNode(node.left) + "," + this.parseNode(node.right);
        case 'Boolean':
                return node.value;
        case 'Stop':
                return 'halted=true;\nbailout=true;\nbreak;';
        case 'Print':
                // print(x) wil stop execution and print "alert()" the value of variable x
                var internal_var_name = this.namespace.referenceVar({name: node.varname, lineNo: node.lineNo, astName: node.astName});
                return 'report("Gestopt: '+node.varname+' = "+Number('+internal_var_name+').toPrecision(4));\nhalted=true;\nbailout=true;\nbreak;';
        case 'Blank': {
                var err_blank = new SyntaxError("Vul iets in op de plaats van de puntjes ( ... ).");
                err_blank.blank = true;
                throw_custom_error(err_blank, node.astName, node.lineNo);
                break;
                }
        default:
            var err2 = new SyntaxError("Unable to parseNode() :" + JSON.stringify(node));
            throw_custom_error(err2, node.astName, node.lineNo);
    } /* switch (node.type) */


}; /* end of parseNode()  */
// end of javascriptCodeGenerator()


function ModelregelsEvaluator(model, debug) {
    if (typeof debug === 'undefined') {
        this.debug = false;
    } else {
        this.debug = debug;
    }

    this.debug_ast = false; // hack FIXME

    // state of evaluator (set and read by modelleertaal app)
    this.tracing = false;
    this.new_run = false;
    this.breakpoint_at_line = undefined; // only used when tracing

    this.namespace = new Namespace();
    this.codegenerator = new CodeGenerator(this.namespace);

    if (typeof model === 'undefined') {
        this.model = new modelmodule.Model();
    } else {
        this.model = model;
    }

    if (this.debug) {
        console.log('*** input ***');
        console.log(this.model.startwaarden);
        console.log(this.model.modelregels);
    }

    this.messages = [];   // output of print()
    this.stopped = false; // model stopped by stop/print (not by the debugger)

    this.startwaarden_ast = parse_or_throw(this.model.startwaarden, 'startwaarden');
    this.modelregels_ast = parse_or_throw(this.model.modelregels, 'modelregels');

    if (this.debug_ast) {
        console.log('*** AST startwaarden ***');
        console.log(JSON.stringify(this.startwaarden_ast, undefined, 4));
        console.log('*** AST modelregels ***');
        console.log(JSON.stringify(this.modelregels_ast, undefined, 4));
        console.log('');
    }

}

ModelregelsEvaluator.prototype.set_state = function(N, new_run, tracing) {
    // state of evaluator (set by modelleertaal app)

    // FIXME: replace by: enable_trace() or similar.
    this.N = N;
    this.tracing = tracing;
    this.new_run = new_run;

    if (this.tracing) {
      this.N = 1;
      if (this.breakpoint_at_line === undefined) {
        this.breakpoint_at_line = 0; // start trach
      }
    } else {
      this.breakpoint_at_line = undefined;
    }
};

ModelregelsEvaluator.prototype.get_state = function() {
    // state of evaluator (set by modelleertaal app)
    return {'tracing': this.tracing,
            'breakpoint_at_line': this.breakpoint_at_line,
            'lineno': this.breakpoint_ast_lineno
          };
};

ModelregelsEvaluator.prototype.run = function() {

    if (!this.tracing) this.breakpoint_at_line = undefined;

    var start = 0;
    var end = 0;

    if (!this.new_run && this.stopped) {
      // stopped by stop/print: never continue after the stop
      return;
    }

    if (this.new_run) {
      // first run of model!
      start = 1;
      end = this.N + 1;

      this.result = [];
      this.startwaarden_code = this.codegenerator.generateCodeFromAst(this.startwaarden_ast);
      this.namespace.moveStartWaarden(); // keep namespace clean

      this.modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast);
      this.namespace.sortVarNames(); // sort variable names for better output

      if (this.debug) {
          console.log("evaluator.run *** first run ***");
      }

    } else {
      // check this.result properties FIXME
      if (this.debug) console.log("evaluator.run *** second run ***");

      if (this.tracing) {
          if (this.debug) console.log("tracing...", this.breakpoint_at_line);
          if ((this.breakpoint_at_line > 0) & (this.result.length > 1)) {
              // continue to trace a row: remove partial results.
              // do not remove first line (startwaarden)
              this.result.pop();
          }
      this.modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast, this.breakpoint_at_line);
      }

      start = this.result.length;
      end = start + this.N;
    }

    this.generated_code = "function run_model(storage, report) { \n ";

    if (this.new_run) {
        this.generated_code += ""+
                 this.codegenerator.generateVariableInitCode() +
                 this.startwaarden_code + "\n" +
                  "var i=0;\n" +
                  this.codegenerator.generateVariableStorageCode();
    } else {
        this.generated_code += ""+
                  this.codegenerator.generateVariableInitCode_second_run();
    }

    this.generated_code +=
                  "    var bailout = false;\n"+
                  "    var halted = false;\n"+
                  "    for (i="+start+"; i < "+end+"; i++) { \n " +
                  this.modelregels_code + "\n" +
                  this.codegenerator.generateVariableStorageCode() +
                  "      }\n" +
                  " if (bailout) {" +
                  this.codegenerator.generateVariableStorageCode() +
                  " }\n" +
                  " return halted;} \n" +
                  "return run_model(results, report);\n";

    if (this.debug) {
        console.log('*** generated js ***');
        console.log(this.generated_code);
        console.log("*** running! *** ");
        console.log("N = ", this.N);
    }

    var t1 = Date.now();

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/


    var self = this;
    this.messages = [];
    var runModel = new Function('results', 'report', this.generated_code);
    this.stopped = runModel(this.result, function(msg) {
        self.messages.push(msg);
    });

    var t2 = Date.now();
    this.runtime_ms = t2 - t1;

    if (this.debug) {
        console.log("Number of iterations: ", this.result.length);
        console.log("Time: " + (t2 - t1) + "ms");
    }

    // just fail if full row already executed.
    if (this.tracing)
      {
        this.breakpoint_ast_lineno = this.modelregels_ast[this.breakpoint_at_line].lineNo;
        this.breakpoint_at_line += 1;

        if (this.breakpoint_at_line > this.modelregels_ast.length - 1)  {
          if (this.debug) console.log('end of row. Trace finished!');
          this.tracing = false;
          this.breakpoint_at_line = undefined;
      }
    }
};

function parse_or_throw(code, ast_name) {
    // parse code. Translate parser errors into something a student can read.
    try {
        return parser.parse(code, ast_name);
    } catch(err) {
        var blame = blame_line(err, code);
        var line = blame.line;
        err.parser_message = err.message; // original (jison) message
        if (/^\s*$/.test(code.replace(/('|\/\/|#)[^\n]*/g, ''))) {
            err.empty = true;
            err.message = "Hier staat nog niets. Typ eerst de " + ast_name + ".";
            line = undefined;
        } else {
            err.message = translate_parse_error(err, blame.previous);
        }
        throw_custom_error(err, ast_name, line);
    }
}

function blame_line(err, code) {
    // Find the line with the mistake.
    // The parser reports the line of the first token that it cannot use.
    // If a line is not finished ("x = 3 +") that is the *next* line.
    // returns {line: (1-based) , previous: true if line before the parser error}
    var hash = err.hash || {};
    if (typeof hash.line != 'number') return {line: undefined, previous: false};

    var lines = code.split('\n');
    var line = hash.line + 1;
    var expected = hash.expected || [];
    // (hash.loc is the location of the previous token: look at the text)
    var line_text = (lines[line - 1] !== undefined) ? lines[line - 1].replace(/^\s+/, '') : '';
    var text = String(hash.text || '');

    // parser expects a new statement: the previous lines are fine.
    var new_statement = expected.indexOf("'IF'") != -1;
    var first_on_line = !new_statement && text.length > 0 &&
                        line_text.slice(0, text.length) == text;
    // x = 3 +
    // y = 2      <-- error at second '='
    var assign_on_next_line = (hash.token == 'ASSIGN') && /^[^\s=:]+\s*:?=/.test(line_text);

    function skip_blank_lines(i) {
        // go up to the first line (1-based) that is not empty or comment
        while (i > 1 && /^\s*(('|\/\/|#).*)?$/.test(lines[i - 1])) i--;
        return i;
    }

    if (hash.token == 'EOF') {
        return {line: skip_blank_lines(Math.min(line, lines.length)), previous: false};
    }
    if (line > 1 && (first_on_line || assign_on_next_line)) {
        return {line: skip_blank_lines(line - 1), previous: true};
    }
    return {line: line, previous: false};
}

function translate_parse_error(err, previous_line) {
    // jison error --> dutch message
    var hash = err.hash || {};
    var expected = hash.expected || [];
    var token = hash.token;
    var text = hash.text;
    var lines = String(err.parser_message || err.message).split('\n');

    function expects(name) {
        return expected.indexOf("'" + name + "'") != -1;
    }

    if (/^Lexical error/.test(lines[0])) {
        // lines[1] is the code, lines[2] is -----^ pointing to the character
        var ch = (lines.length > 2) ? lines[1].charAt(lines[2].length - 1) : '';
        return "Onbekend teken" + (ch ? " '" + ch + "'" : "") + ". Dit teken kan niet in een model gebruikt worden.";
    }
    if (token == 'EOF' && expects('ENDIF')) {
        return "Er ontbreekt een 'eindals'. Elke 'als ... dan' moet worden afgesloten met 'eindals'.";
    }
    if (expects('THEN')) {
        if (token == 'ASSIGN') {
            return "Onverwachte '='. Gebruik in een voorwaarde '==' om te vergelijken, bijvoorbeeld: als (x == 3) en (y > 2) dan";
        }
        if (token == 'EOF' || token == 'IDENT' || token == 'IF' || token == 'STOP' || token == 'ENDIF') {
            return "Na de voorwaarde van 'als' ontbreekt 'dan'. Schrijf: als ... dan ... eindals";
        }
    }
    if (previous_line) {
        // the mistake is in the line before the unexpected token
        if (expects('ASSIGN') && expected.length == 1) {
            return "Deze regel is niet af. Een modelregel ziet er zo uit: v = v + a*dt";
        }
        if (expects(')') && !expects('NUMBER')) {
            return "Deze regel is niet af. Ontbreekt er een haakje sluiten ')'?";
        }
        return "Deze regel is niet af. Er ontbreekt iets aan het einde van de regel.";
    }
    if (token == 'ASSIGN' && expects(')')) {
        return "Onverwachte '='. Gebruik '==' om te vergelijken, bijvoorbeeld: als (x == 3) en (y > 2) dan";
    }
    if (token == 'EOF' && expects(')')) {
        return "Er ontbreekt een haakje sluiten ')'.";
    }
    if (token == ')') {
        return "Er staat een haakje ')' te veel, of er ontbreekt een haakje openen '('.";
    }
    if (token == 'EOF') {
        return "De laatste regel is niet af. Er ontbreekt iets aan het einde.";
    }
    if (token == 'ENDIF' || token == 'ELSE' || token == 'THEN') {
        if (expects('NUMBER')) {
            return "Onverwacht '" + text + "'. De regel hiervoor is niet af.";
        }
        return "Onverwacht '" + text + "'. Hier hoort geen '" + text + "'. Ontbreekt er een 'als' of 'dan'?";
    }
    if (token == 'ASSIGN') {
        return "Onverwachte '='. Is de regel hiervoor wel af? Links van '=' moet precies \u00e9\u00e9n variabele staan, bijvoorbeeld: v = v + a*dt";
    }
    if (expects('ASSIGN') && expected.length == 1) {
        return "Na de variabele wordt een '=' verwacht, maar er staat '" + text + "'. Een modelregel ziet er zo uit: v = v + a*dt";
    }
    if (token == 'NUMBER' || token == 'IDENT' || token == '(') {
        if (!expects('NUMBER')) {
            return "Onverwacht '" + text + "'. Ontbreekt er een bewerking ( + - * / ) of staat hier iets te veel?";
        }
    }
    if (expects('NUMBER')) {
        return "Onverwacht '" + text + "'. Hier wordt een getal of variabele verwacht.";
    }
    return "Onverwacht '" + text + "'. Deze regel klopt niet.";
}

function throw_custom_error(err, ast_name, line_number) {
    // insert line number etc in Error:
    err.parser_name = ast_name;
    err.parser_line = line_number;
    throw err;
}

// The functions that can be used in the modelregels and startwaarden
// (see CodeGenerator.parseNode, case 'Function'). Shown in the app ("Functies").
// [name, example, explanation]; names that do the same are on one row.
var FUNCTIONS = [
    [['sin', 'cos', 'tan'], 'sin(30) = 0,5', 'sinus, cosinus, tangens van een hoek in graden'],
    [['sinr', 'cosr', 'tanr'], 'sinr(pi/6) = 0,5', 'sinus, cosinus, tangens van een hoek in radialen'],
    [['arcsin', 'arccos', 'arctan'], 'arcsin(0,5) = 30', 'inverse sinus, cosinus, tangens; de hoek in graden'],
    [['arcsinr', 'arccosr', 'arctanr'], 'arcsinr(0,5) = 0,52', 'inverse sinus, cosinus, tangens; de hoek in radialen'],
    [['sqrt', 'wortel'], 'sqrt(9) = 3', 'wortel'],
    [['sqr'], 'sqr(3) = 9', 'kwadraat (hetzelfde als 3^2)'],
    [['exp'], 'exp(1) = 2,718', 'e-macht: e^x'],
    [['ln'], 'ln(exp(2)) = 2', 'natuurlijke logaritme (grondtal e)'],
    [['log'], 'log(1000) = 3', 'logaritme met grondtal 10'],
    [['abs'], 'abs(-2) = 2', 'absolute waarde: het getal zonder minteken'],
    [['sign', 'teken'], 'sign(-2) = -1', 'teken: -1 als negatief, 0 als nul, 1 als positief'],
    [['round'], 'round(2,5) = 3', 'afronden op een geheel getal'],
    [['entier'], 'entier(2,7) = 2', 'afronden naar beneden (het gehele getal eronder)'],
    [['min', 'max'], 'max(2; 5) = 5', 'kleinste / grootste van twee of meer getallen']
];

exports.FUNCTIONS = FUNCTIONS;
exports.Model = modelmodule.Model; // from model.js
exports.ModelregelsEvaluator = ModelregelsEvaluator;
exports.CodeGenerator = CodeGenerator;
exports.Namespace = Namespace;

},{"./model.js":11,"./modelleertaal":14}],8:[function(require,module,exports){
/*
    grafisch-edit.js

    Het grafische model (grafisch.js) als invoer: een bewerking in het diagram
    wordt uitgevoerd als een kleine wijziging in de tekst van het model.
    De rest van de tekst (volgorde, commentaar, opmaak) blijft staan.

    usage:
      var edit = require('./grafisch-edit.js');
      var model = {startwaarden: 'x = 0 ...', modelregels: 'x = x + v*dt ...'};
      model = edit.apply(model, {op: 'setDefinition', id: 'Fw', text: 'k * v^2'});

    Een bewerking die niet veilig automatisch kan (bijvoorbeeld een regel binnen
    als ... dan) geeft een Error met een uitleg voor de gebruiker.

    Bewerkingen (id: zie grafisch.analyse().elements):
      {op: 'setDefinition', id, text}            formule / waarde / beginwaarde
      {op: 'rename', id, name}                   overal in het model
      {op: 'addConstant', name, text}            name = text in de startwaarden
      {op: 'addAux', name, text}                 name = text in de modelregels
      {op: 'addStock', name, initial, rate}      x = 0 ; dx = rate * dt ; x = x + dx
      {op: 'addFlow', stock, direction, name, rate}   direction: 'in' of 'out'
      {op: 'setFlowEnds', id, from, to}          stroom van/naar toestand (null: buiten)
      {op: 'define', id, kind, text}             onbekende (?) variabele: 'const' of 'aux'
      {op: 'define', id, kind: 'stock', initial, rate}   onbekende wordt toestandsvariabele

    addConstant, addAux en addStock met de naam van een onbekende (?) variabele
    definiëren die variabele (zoals define).
      {op: 'convert', id, kind}                  constante <-> hulpvariabele ('aux' of 'const')
      {op: 'setDt', text}                        startwaarde van dt
      {op: 'setUnit', name, unit}                eenheid als commentaar: m = 25 '[kg] (unit '': weg)

    Met timeUnit in een bewerking (bijvoorbeeld 's') krijgen t en dt die eenheid als de
    bewerking ze maakt: t = 0 '[s]
      {op: 'remove', id}                         ook een voorval of stopvoorwaarde (het hele als-blok)

    Voorwaarden (als ... dan ... eindals, zoals in de examenmodellen):
      {op: 'addEvent', condition, target, text}  als condition dan target = text eindals,
                                                 na de laatste regel die target uitrekent
      {op: 'addEvent', condition, stop: true}    als condition dan stop eindals, aan het eind
      {op: 'setEvent', id, condition, text}      voorwaarde en/of nieuwe waarde van een voorval
                                                 of stopvoorwaarde (id: ~e1, ~s1)
      {op: 'setLimit', name, bound, text}        bound 'max': als x > text dan x = text eindals,
                                                 'min': als x < text dan x = text eindals; text '': weg

    Verder:
      edit.variablesOf(text)    de variabelen in een formule (Error als het geen formule is)
      edit.dtOf(model)          {name, text}: de tijdstap en zijn startwaarde (text: null als die er niet is)
      edit.eventOf(model, id)   {condition, target, text} van een voorval of stopvoorwaarde, als code;
                                null als het niet via het diagram kan (meer regels, als binnen als)
      edit.limitsOf(model, name)  {max, min}: de grenzen van een toestandsvariabele ('' als er geen is)
*/

//jshint node:true
//jshint es3:true
//jshint loopfunc:true
"use strict";

var parser = require('./modelleertaal').parser;
var grafisch = require('./grafisch.js');

var IDENT = '[a-zA-Z\\x7f-\\uffff][a-zA-Z\\x7f-\\u00b1\\u00b4-\\uffff0-9_\\]|{}\\[]*';
var IDENT_RE = new RegExp('^' + IDENT + '$');
var ASSIGN_RE = new RegExp('^(\\s*)(' + IDENT + ')(\\s*)(:=|=)(?!=)\\s*(.*?)\\s*$');

var MANUAL = ' Pas dit aan in de tekst van het model.';


// ------------------------------------------------------------------ text helpers

function parse(text, name) {
    if (/^\s*$/.test(text.replace(/('|\/\/|#)[^\n]*/g, ''))) return [];
    return parser.parse(text, name);
}

function splitComment(line) {
    // 'x = 1  // begin' --> {code: 'x = 1', comment: '  // begin'}
    var m = /\s*('|\/\/|#).*$/.exec(line);
    return m ? {code: line.substr(0, m.index), comment: m[0]} : {code: line, comment: ''};
}

function tokens(codeText) {
    return codeText.match(new RegExp(IDENT, 'g')) || [];
}

function uses(line, name) {
    return tokens(splitComment(line).code).indexOf(name) != -1;
}

function depths(lines) {
    // depth[i]: number of open 'als' at the start of line i
    var depth = [], d = 0;
    for (var i = 0; i < lines.length; i++) {
        depth.push(d);
        var words = tokens(splitComment(lines[i]).code);
        for (var j = 0; j < words.length; j++) {
            var w = words[j].toLowerCase();
            if (w == 'als') d += 1;
            if (w == 'eindals') d -= 1;
        }
    }
    return depth;
}

function exprOf(text) {
    // AST of an expression typed by the user. Throws if it is not one expression.
    var ast;
    try {
        ast = parse('zz = ' + text, 'formule');
    } catch (err) {
        ast = null;
    }
    if (!ast || ast.length != 1 || ast[0].type != 'Assignment' || /^\s*$/.test(text)) {
        throw new Error('De formule "' + text + '" klopt niet.');
    }
    return ast[0].right;
}

function findLine(lines, name, exprCode, topLevel) {
    // index of the line 'name = expr' (and nothing else on that line), or -1
    var depth = depths(lines);
    for (var i = 0; i < lines.length; i++) {
        if (topLevel && depth[i] !== 0) continue;
        var m = ASSIGN_RE.exec(splitComment(lines[i]).code);
        if (!m || m[2] != name) continue;
        var e;
        try { e = exprOf(m[5]); } catch (err) { continue; }
        if (exprCode === undefined || grafisch.code(e) == exprCode) return i;
    }
    return -1;
}

function setRhs(lines, i, text) {
    var parts = splitComment(lines[i]);
    var m = ASSIGN_RE.exec(parts.code);
    lines[i] = m[1] + m[2] + m[3] + m[4] + ' ' + text + parts.comment;
}

function indentOf(lines, i) {
    for (var j = Math.min(i, lines.length - 1); j >= 0; j--) {
        if (!/^\s*$/.test(lines[j])) return /^\s*/.exec(lines[j])[0];
    }
    return '';
}

function endOf(lines) {
    // index after the last line with text
    var i = lines.length;
    while (i > 0 && /^\s*$/.test(lines[i - 1])) i--;
    return i;
}

function insert(lines, i, text) {
    // insert a line before line i, outside als ... eindals
    var depth = depths(lines);
    while (i > 0 && i < lines.length && depth[i] > 0) i--;
    lines.splice(i, 0, indentOf(lines, i) + text);
    return i;
}


// ------------------------------------------------------------------ context

function Context(model) {
    var split = function(text) {
        text = String(text || '').replace(/\r/g, '');
        return /^\s*$/.test(text) ? [] : text.split('\n');
    };
    this.start = split(model.startwaarden);
    this.regels = split(model.modelregels);
    this.analyse();
}

Context.prototype.text = function() {
    return {startwaarden: this.start.join('\n'), modelregels: this.regels.join('\n')};
};

Context.prototype.analyse = function() {
    // (again) after a change of the text
    var t = this.text();
    var startAst = parse(t.startwaarden, 'startwaarden');
    var regelsAst = parse(t.modelregels, 'modelregels');
    this.g = grafisch.analyse(startAst, regelsAst);
    this.init = {};
    this.assigned = {};
    var i, a;
    var s = grafisch.collect(startAst, [], {assign: [], stops: []});
    for (i = 0; i < s.assign.length; i++) this.init[s.assign[i].name] = s.assign[i].expr;
    var r = grafisch.collect(regelsAst, [], {assign: [], stops: []});
    for (i = 0; i < r.assign.length; i++) {
        a = r.assign[i];
        (this.assigned[a.name] = this.assigned[a.name] || []).push(a);
    }
};

Context.prototype.element = function(id) {
    if (!this.g.elements.hasOwnProperty(id)) throw new Error('Onbekend element: ' + id);
    return this.g.elements[id];
};

Context.prototype.exists = function(name) {
    return this.init.hasOwnProperty(name) || this.assigned.hasOwnProperty(name) ||
        this.g.elements.hasOwnProperty(name) || name == this.g.dt || name == this.g.time;
};

Context.prototype.isUnknown = function(name) {
    // used, but nowhere a value or formula: the '?' in the diagram
    var el = this.g.elements.hasOwnProperty(name) ? this.g.elements[name] : null;
    return !!el && el.kind == 'unknown' && !this.init.hasOwnProperty(name) && !this.assigned.hasOwnProperty(name);
};

Context.prototype.checkNewName = function(name, allowUnknown) {
    // allowUnknown: the name of an unknown (?) variable is fine, it gets defined
    name = String(name || '').replace(/^\s+|\s+$/g, '');
    var ok = IDENT_RE.test(name);
    if (ok) {
        // keywords (als, dan, pi, en, of, ...) are not names
        try {
            var ast = parse(name + ' = 1', 'naam');
            ok = ast.length == 1 && ast[0].type == 'Assignment' && ast[0].left == name;
        } catch (err) {
            ok = false;
        }
    }
    if (!ok) throw new Error('"' + name + '" is geen geldige naam voor een variabele.');
    if (this.exists(name) && !(allowUnknown && this.isUnknown(name))) {
        throw new Error('De naam "' + name + '" bestaat al.');
    }
    return name;
};

Context.prototype.freeName = function(base) {
    var name = base, n = 2;
    while (this.exists(name)) name = base + (n++);
    return name;
};

Context.prototype.startLine = function(name) {
    return this.init.hasOwnProperty(name) ? findLine(this.start, name, grafisch.code(this.init[name]), true) : -1;
};

Context.prototype.regelLine = function(name, which) {
    // line of the only unconditional assignment to name. which: 'self' = x = x + ... ; 'def' = other
    var list = this.assigned[name] || [], found = [];
    for (var i = 0; i < list.length; i++) {
        var self = grafisch.variables(list[i].expr).indexOf(name) != -1;
        if (list[i].conds.length === 0 && (which === undefined || (which == 'self') == self)) found.push(list[i]);
    }
    if (found.length != 1) return -1;
    return findLine(this.regels, name, grafisch.code(found[0].expr), true);
};

Context.prototype.need = function(line, name) {
    if (line == -1) {
        throw new Error('De regel voor ' + name + ' kan ik niet automatisch aanpassen ' +
            '(bijvoorbeeld omdat hij binnen als ... dan staat of er meer op één regel staat).' + MANUAL);
    }
    return line;
};

Context.prototype.timeLine = function() {
    return this.g.time ? this.regelLine(this.g.time, 'self') : -1;
};

Context.prototype.blocks = function() {
    // the als ... eindals blocks at the top level of the modelregels: [{start, end, stmt}]
    // (end: the line of eindals). A block that is not one statement is left out.
    var depth = depths(this.regels), out = [], i, j, k;
    for (i = 0; i < this.regels.length; i++) {
        var words = tokens(splitComment(this.regels[i]).code);
        if (depth[i] !== 0 || !words.length || words[0].toLowerCase() != 'als') continue;
        for (j = i; j + 1 < this.regels.length && depth[j + 1] !== 0; j++) { /* to the eindals */ }
        var ast = null, stmts = [];
        try {
            ast = parse(this.regels.slice(i, j + 1).join('\n'), 'als');
        } catch (err) {
            ast = null;
        }
        for (k = 0; ast && k < ast.length; k++) if (ast[k].type != 'Blank') stmts.push(ast[k]);
        if (stmts.length == 1 && (stmts[0].type == 'If' || stmts[0].type == 'IfElse')) {
            out.push({start: i, end: j, stmt: stmts[0]});
        }
        i = j;
    }
    return out;
};

Context.prototype.eventBlock = function(el) {
    // the block of a voorval (one condition, only name = ... for its targets) or a stopvoorwaarde
    var list = this.blocks();
    for (var i = 0; i < list.length; i++) {
        var st = list[i].stmt, body = [], k;
        if (st.type != 'If' || grafisch.fmt(st.cond) != el.condition) continue;
        for (k = 0; k < st.then.length; k++) if (st.then[k].type != 'Blank') body.push(st.then[k]);
        if (el.kind == 'stop' && body.length == 1 && body[0].type == 'Stop') return list[i];
        if (el.kind != 'event' || body.length != el.actions.length) continue;
        var ok = true;
        for (k = 0; k < body.length; k++) {
            if (body[k].type != 'Assignment' || el.targets.indexOf(body[k].left) == -1) ok = false;
        }
        if (ok) return list[i];
    }
    return null;
};

Context.prototype.afterLast = function(name) {
    // where a voorval for name goes: after the last line that calculates name (after the end
    // of its als-block). A toestandsvariabele or constante: also after the other toestandsvariabelen,
    // just before t = t + dt (als h < 0 dan v = -v after h = h + v*dt, as in the exam models).
    // A hulpvariabele (also one drawn as the valve of a flow, groei in dOpp = groei * dt): right
    // after its formula, before it is used.
    var depth = depths(this.regels), at = -1, i, t = this.timeLine();
    if (!this.isFormula(name) && t != -1) {
        for (i = t; i < this.regels.length; i++) {
            var m2 = ASSIGN_RE.exec(splitComment(this.regels[i]).code);
            if (m2 && m2[2] == name && i != t) t = -1;   // name is calculated after t = t + dt
        }
        if (t != -1) return t;
    }
    for (i = 0; i < this.regels.length; i++) {
        var m = ASSIGN_RE.exec(splitComment(this.regels[i]).code);
        if (m && m[2] == name && i != this.timeLine()) at = i;
    }
    if (at == -1) {
        t = this.timeLine();
        return t != -1 ? t : endOf(this.regels);
    }
    while (at + 1 < this.regels.length && depth[at + 1] > 0) at++;
    return at + 1;
};

Context.prototype.startEnd = function() {
    // where a new startwaarde goes: at the end, but above t = 0 and dt = 0,1 when those are
    // the last lines (as in the basismodellen)
    var end = endOf(this.start), names = [this.g.time, this.g.dt];
    while (end > 0) {
        var m = ASSIGN_RE.exec(splitComment(this.start[end - 1]).code);
        if (!m || names.indexOf(m[2]) == -1) break;
        end--;
    }
    return end;
};

Context.prototype.decimal = function(value) {
    // 0.1 in the style of the model: 0,1 (default) or 0.1
    var t = this.start.join('\n') + this.regels.join('\n');
    var point = /\d\.\d/.test(t) && !/\d,\d/.test(t);
    return point ? value : value.replace('.', ',');
};

Context.prototype.needTime = function() {
    // new model: t = t + dt
    var dt = this.g.dt;
    var unit = this.timeUnit ? " '[" + this.timeUnit + "]" : '';
    if (!this.g.time) {
        var t = this.freeName('t');
        this.start.splice(endOf(this.start), 0, t + ' = 0' + unit);
        this.regels.splice(endOf(this.regels), 0, t + ' = ' + t + ' + ' + dt);
    }
    if (!this.init.hasOwnProperty(dt)) this.start.splice(endOf(this.start), 0, dt + ' = ' + this.decimal('0.1') + unit);
    this.analyse();
};

Context.prototype.flowsOf = function(stock) {
    // [{id, sign, term}] of a stock (or constant: none)
    var el = this.element(stock), out = [], i;
    if (el.kind != 'stock') return out;
    for (i = 0; i < el.inflows.length; i++) out.push({id: el.inflows[i], sign: 1, term: this.g.elements[el.inflows[i]].term});
    for (i = 0; i < el.outflows.length; i++) out.push({id: el.outflows[i], sign: -1, term: this.g.elements[el.outflows[i]].term});
    return out;
};

Context.prototype.checkStock = function(stock) {
    var el = this.element(stock);
    if (el.kind == 'const') return el;
    if (el.kind != 'stock') throw new Error(stock + ' is geen toestandsvariabele of constante.');
    if (el.general || el.updates > 1) {
        throw new Error('De regel voor ' + stock + ' heeft niet de vorm ' + stock + ' = ' + stock + ' + ...' + MANUAL);
    }
    return el;
};

Context.prototype.stockPlace = function(name) {
    // where the new line  name = name + ...  goes: before the first flow or stock that uses name
    // (x = x + v * dt after v = v + dv, as in the basismodellen), else before t = t + dt
    var t = this.timeLine();
    for (var i = 0; name !== null && i < this.regels.length; i++) {
        var m = ASSIGN_RE.exec(splitComment(this.regels[i]).code);
        var el = m && this.g.elements.hasOwnProperty(m[2]) ? this.g.elements[m[2]] : null;
        if (el && !el.isRate && (el.kind == 'flow' || el.kind == 'stock') && uses(this.regels[i], name)) return i;
    }
    return t != -1 ? t : endOf(this.regels);
};

Context.prototype.writeStock = function(stock, terms, at) {
    // (re)write  stock = stock + in - out. No terms: remove the line (stock becomes a constant).
    // at: where a new line goes (default: before t = t + dt)
    this.checkStock(stock);
    var line = this.regelLine(stock, 'self');
    if ((this.assigned[stock] || []).length && line == -1) this.need(-1, stock);
    var rhs = stock;
    for (var i = 0; i < terms.length; i++) rhs += (terms[i].sign > 0 ? ' + ' : ' - ') + terms[i].term;
    if (line == -1) {
        if (!terms.length) return -1;
        line = insert(this.regels, at === undefined ? this.stockPlace(null) : at, stock + ' = ' + rhs);
    } else if (!terms.length) {
        this.regels.splice(line, 1);
        line = -1;
    } else {
        setRhs(this.regels, line, rhs);
    }
    return line;
};


// ------------------------------------------------------------------ operations

var ops = {};

ops.setDefinition = function(c, op) {
    var el = c.element(op.id), expr = exprOf(op.text), text = op.text.replace(/^\s+|\s+$/g, '');
    switch (el.kind) {
        case 'const':
            setRhs(c.start, c.need(c.startLine(el.name), el.name), text);
            break;
        case 'stock':
            if (!c.init.hasOwnProperty(el.name)) c.start.splice(c.startEnd(), 0, el.name + ' = ' + text);
            else setRhs(c.start, c.need(c.startLine(el.name), el.name), text);
            break;
        case 'aux':
            if (el.code === null) c.need(-1, el.name);
            setRhs(c.regels, c.need(c.regelLine(el.name), el.name), text);
            break;
        case 'flow':
            if (el.name) {
                setRhs(c.regels, c.need(c.regelLine(el.name, 'def'), el.name), text);
            } else {
                // term in the line of the stock:  x = x + v * dt
                var stock = el.to || el.from, terms = c.flowsOf(stock);
                for (var i = 0; i < terms.length; i++) {
                    if (terms[i].id == el.id) terms[i].term = grafisch.code(expr, 4, true);
                }
                c.writeStock(stock, terms);
            }
            break;
        default:
            throw new Error('Dit element heeft geen formule die je hier kunt aanpassen.' + MANUAL);
    }
};

function nameFlow(c, el, name) {
    // x = x + v * dt  -->  dx = v * dt ; x = x + dx
    var stock = el.to || el.from, terms = c.flowsOf(stock);
    var line = c.need(c.regelLine(stock, 'self'), stock);
    for (var i = 0; i < terms.length; i++) if (terms[i].id == el.id) terms[i].term = name;
    c.writeStock(stock, terms);
    insert(c.regels, line, name + ' = ' + el.code);
}

ops.rename = function(c, op) {
    var el = c.element(op.id), name = c.checkNewName(op.name);
    if (el.kind == 'flow' && !el.name) return nameFlow(c, el, name);
    if (!el.name) throw new Error('Dit element heeft geen naam.');
    var re = new RegExp(IDENT, 'g');
    var replace = function(lines) {
        for (var i = 0; i < lines.length; i++) {
            var parts = splitComment(lines[i]);
            lines[i] = parts.code.replace(re, function(word) { return word == el.name ? name : word; }) + parts.comment;
        }
    };
    replace(c.start);
    replace(c.regels);
};

function addStart(c, name, text) {
    // name = text in the startwaarden: after the startwaarden it needs, before the first
    // startwaarde that uses it. A value that needs a variable without startwaarde: at the end.
    var expr = exprOf(text), deps = grafisch.variables(expr), i, lo = 0, end = endOf(c.start), at = -1;
    for (i = 0; i < deps.length && lo != -1; i++) {
        if (deps[i] == name) continue;
        var l = c.startLine(deps[i]);
        lo = l == -1 ? -1 : Math.max(lo, l + 1);
    }
    if (lo != -1) {
        for (i = lo; i < end && at == -1; i++) if (uses(c.start[i], name)) at = i;
    }
    if (at == -1) at = lo == -1 ? end : Math.max(lo, c.startEnd());
    var line = name + ' = ' + text.replace(/^\s+|\s+$/g, '');
    if (at == end) c.start.splice(at, 0, indentOf(c.start, c.start.length) + line);
    else insert(c.start, at, line);
}

ops.addConstant = function(c, op) {
    addStart(c, c.checkNewName(op.name, true), op.text);
};

function addRule(c, name, text) {
    // name = text in the modelregels: before its first use, else after what it needs,
    // else before the flows and stocks
    var expr = exprOf(text), i, at = -1;
    for (i = 0; i < c.regels.length && at == -1; i++) if (uses(c.regels[i], name)) at = i;
    if (at == -1) {
        var deps = grafisch.variables(expr);
        for (i = 0; i < deps.length; i++) {
            var el = c.g.elements[deps[i]];
            if (el && (el.kind == 'aux' || el.kind == 'flow')) at = Math.max(at, findLine(c.regels, deps[i], undefined, true) + 1);
        }
        if (at <= 0) {
            at = endOf(c.regels);
            for (var id in c.g.elements) {
                if (!c.g.elements.hasOwnProperty(id)) continue;
                var k = c.g.elements[id].kind, name2 = c.g.elements[id].name;
                if ((k == 'stock' || k == 'flow') && name2) {
                    var l = findLine(c.regels, name2, undefined, true);
                    if (l != -1) at = Math.min(at, l);
                }
            }
            var t = c.timeLine();
            if (t != -1) at = Math.min(at, t);
        }
    }
    insert(c.regels, at, name + ' = ' + text.replace(/^\s+|\s+$/g, ''));
}

ops.addAux = function(c, op) {
    addRule(c, c.checkNewName(op.name, true), op.text);
};

ops.define = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'unknown') throw new Error(el.name + ' heeft al een waarde of formule.');
    if (op.kind == 'stock') return defineStock(c, el.name, op.initial, op.rate, op.flow);
    if (op.kind == 'aux') addRule(c, el.name, op.text);
    else addStart(c, el.name, op.text);
};

ops.convert = function(c, op) {
    // constante (startwaarden) <-> hulpvariabele (modelregels), same name and formula
    var el = c.element(op.id), line;
    if (op.kind == 'aux' && el.kind == 'const') {
        line = c.need(c.startLine(el.name), el.name);
        c.start.splice(line, 1);
        c.analyse();
        addRule(c, el.name, el.code);
    } else if (op.kind == 'const' && el.kind == 'aux') {
        if (el.code === null) c.need(-1, el.name);
        if (grafisch.variables(exprOf(el.code)).length) {
            throw new Error(el.name + ' = ' + el.code + ' hangt af van andere variabelen: dat kan geen constante zijn.');
        }
        line = c.need(c.regelLine(el.name), el.name);
        c.regels.splice(line, 1);
        c.analyse();
        addStart(c, el.name, el.code);
    } else {
        throw new Error('Dit element kan ik niet omzetten.' + MANUAL);
    }
};

ops.setDt = function(c, op) {
    var text = op.text.replace(/^\s+|\s+$/g, ''), dt = c.g.dt;
    exprOf(text);
    var line = c.startLine(dt);
    if (line == -1 && c.init.hasOwnProperty(dt)) c.need(-1, dt);
    if (line == -1) c.start.splice(endOf(c.start), 0, dt + ' = ' + text);
    else setRhs(c.start, line, text);
};

ops.setUnit = function(c, op) {
    // the unit in the comment of the line of name: in the startwaarden, else in the modelregels
    var unit = String(op.unit || '').replace(/^\s+|\s+$/g, ''), name = op.name;
    if (unit.length > 20 || /[\[\]\n]/.test(unit)) {
        throw new Error('"' + unit + '" is geen eenheid die ik kan opslaan (geen [ of ], hoogstens 20 tekens).');
    }
    var lines = c.start, line = c.startLine(name);
    if (line == -1 && !c.init.hasOwnProperty(name)) {
        lines = c.regels;
        line = c.regelLine(name, 'def');
        if (line == -1) line = c.regelLine(name);
    }
    c.need(line, name);
    var parts = splitComment(lines[line]), comment = parts.comment;
    var bracket = /\s*\[[^\[\]]*\]/;
    if (unit === '') {
        comment = comment.replace(bracket, '');
        if (/^\s*('|\/\/|#)\s*$/.test(comment)) comment = '';
    } else if (bracket.test(comment)) {
        comment = comment.replace(/\[[^\[\]]*\]/, '[' + unit + ']');
    } else if (comment) {
        // 'massa --> '[kg] massa ; // massa --> // [kg] massa
        comment = comment.replace(/^(\s*)('|\/\/|#)\s*/, function(all, space, mark) {
            return space + mark + (mark == "'" ? '' : ' ') + '[' + unit + '] ';
        });
    } else {
        comment = " '[" + unit + "]";
    }
    lines[line] = parts.code.replace(/\s+$/, '') + comment;
};

function flowName(c, name, stock, rate) {
    // the name of the flow of stock: given, or d + stock. It cannot be in its own formula:
    // dOpp = dOpp * dt would be a second toestandsvariabele
    var auto = /^\s*$/.test(name || '');
    name = auto ? c.freeName('d' + stock) : c.checkNewName(name);
    if (grafisch.variables(exprOf(rate)).indexOf(name) != -1) {
        throw new Error(auto ?
            name + ' is de naam van de stroom van ' + stock + '. Kies een andere naam voor de ' +
            'verandering per tijdseenheid, bijvoorbeeld groei.' :
            'De stroom ' + name + ' kan niet in zijn eigen formule staan (' + name + ' = ' + rate + ' * ' + c.g.dt + ').');
    }
    return name;
}

function flowLine(c, name, rate) {
    // dx = rate * dt
    return name + ' = ' + grafisch.code(exprOf(rate), 5, false) + ' * ' + c.g.dt;
}

function defineStock(c, name, initial, rate, flow) {
    // unknown variable becomes a stock: dv = rate * dt ; v = v + dv before the first use of v
    initial = /^\s*$/.test(initial || '') ? '0' : initial.replace(/^\s+|\s+$/g, '');
    rate = /^\s*$/.test(rate || '') ? '0' : rate;
    exprOf(rate);
    addStart(c, name, initial);
    c.analyse();
    var fname = flowName(c, flow, name, rate);
    c.needTime();
    var at = insert(c.regels, c.stockPlace(name), name + ' = ' + name + ' + ' + fname);
    insert(c.regels, at, flowLine(c, fname, rate));
}

ops.addStock = function(c, op) {
    var name = c.checkNewName(op.name, true);
    if (c.isUnknown(name)) return defineStock(c, name, op.initial, op.rate, op.flow);
    var initial = /^\s*$/.test(op.initial || '') ? '0' : op.initial.replace(/^\s+|\s+$/g, '');
    exprOf(initial);
    c.start.splice(c.startEnd(), 0, name + ' = ' + initial);
    c.analyse();
    ops.addFlow(c, {stock: name, direction: 'in', name: op.flow, rate: op.rate});
};

ops.addFlow = function(c, op) {
    var el = c.checkStock(op.stock);
    var rate = /^\s*$/.test(op.rate || '') ? '0' : op.rate;
    exprOf(rate);
    var name = flowName(c, op.name, op.stock, rate);
    c.needTime();
    var terms = c.flowsOf(op.stock);
    terms.push({sign: op.direction == 'out' ? -1 : 1, term: name});
    // a constant becomes a stock: its line goes where define would put it
    var line = c.writeStock(op.stock, terms, el.kind == 'const' ? c.stockPlace(op.stock) : undefined);
    insert(c.regels, line, flowLine(c, name, rate));
};

ops.setFlowEnds = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'flow' || op.id.indexOf('#') != -1) throw new Error('Deze stroom kan ik niet automatisch verleggen.' + MANUAL);
    var from = op.from || null, to = op.to || null;
    if (from === null && to === null) throw new Error('Een stroom zit aan minstens één toestandsvariabele vast.');
    if (from == to) throw new Error('Een stroom kan niet van en naar dezelfde toestandsvariabele lopen.');
    if (!el.name) {
        // first give it a name: the same variable is used in two lines
        var name = c.freeName('d' + (el.to || el.from));
        nameFlow(c, el, name);
        c.analyse();
        el = c.element(name);
    }
    var ends = [[el.from, from, -1], [el.to, to, 1]], i, j, lines = [];
    for (i = 0; i < ends.length; i++) {
        var old = ends[i][0], now = ends[i][1], sign = ends[i][2];
        if (old == now) continue;
        if (old !== null) {
            var keep = [], terms = c.flowsOf(old);
            for (j = 0; j < terms.length; j++) if (terms[j].id != el.id) keep.push(terms[j]);
            c.writeStock(old, keep);
            c.analyse();
        }
        if (now !== null) {
            var add = c.flowsOf(now);
            add.push({sign: sign, term: el.term});
            c.writeStock(now, add);
            c.analyse();
        }
    }
    // the flow is calculated before the stocks that use it
    var def = findLine(c.regels, el.name, undefined, true);
    if (from !== null) lines.push(c.regelLine(from, 'self'));
    if (to !== null) lines.push(c.regelLine(to, 'self'));
    for (i = 0; i < lines.length; i++) {
        if (def != -1 && lines[i] != -1 && lines[i] < def) {
            var text = c.regels.splice(def, 1)[0];
            c.regels.splice(lines[i], 0, text);
            def = lines[i];
        }
    }
};

function removeFlows(c, flows, goneStock) {
    // take the flows out of the lines of their stocks (goneStock: line already removed)
    var ids = [], stocks = [], i, j;
    for (i = 0; i < flows.length; i++) {
        ids.push(flows[i].id);
        var ends = [flows[i].from, flows[i].to];
        for (j = 0; j < 2; j++) {
            if (ends[j] !== null && ends[j] != goneStock && stocks.indexOf(ends[j]) == -1) stocks.push(ends[j]);
        }
    }
    for (i = 0; i < stocks.length; i++) {
        var terms = c.flowsOf(stocks[i]), keep = [];
        for (j = 0; j < terms.length; j++) if (ids.indexOf(terms[j].id) == -1) keep.push(terms[j]);
        c.writeStock(stocks[i], keep);
    }
    for (i = 0; i < flows.length; i++) {
        // dx = v * dt goes too, unless something else uses it or it still flows somewhere.
        // a = Fres / m (used as a * dt) stays as a hulpvariabele
        var flow = flows[i], used = false;
        if (flow.step) {
            // a is the flow of  dv = a * dt ; v = v + dv : dv goes, a stays as a hulpvariabele
            var sl = c.regelLine(flow.step, 'def');
            if (sl != -1) c.regels.splice(sl, 1);
            continue;
        }
        if (!flow.name || flow.isRate) continue;
        for (j = 0; j < c.g.links.length; j++) if (c.g.links[j].from == flow.id) used = true;
        var line = c.regelLine(flow.name, 'def');
        if (!used && line != -1) c.regels.splice(line, 1);
    }
}

ops.remove = function(c, op) {
    var el = c.element(op.id);
    switch (el.kind) {
        case 'const':
            c.start.splice(c.need(c.startLine(el.name), el.name), 1);
            break;
        case 'aux':
            if (el.code === null) c.need(-1, el.name);
            c.regels.splice(c.need(c.regelLine(el.name), el.name), 1);
            break;
        case 'flow':
            if (op.id.indexOf('#') != -1) c.need(-1, el.label);
            removeFlows(c, [el], null);
            break;
        case 'stock':
            c.checkStock(el.id);
            var flows = [], ids = el.inflows.concat(el.outflows);
            for (var i = 0; i < ids.length; i++) {
                // a flow to or from another stock stays (now to or from outside)
                var fl = c.g.elements[ids[i]];
                if ((fl.from === null || fl.from == el.id) && (fl.to === null || fl.to == el.id)) flows.push(fl);
            }
            c.regels.splice(c.need(c.regelLine(el.id, 'self'), el.id), 1);
            removeFlows(c, flows, el.id);
            var s = findLine(c.start, el.id, undefined, true);
            if (s != -1) c.start.splice(s, 1);
            break;
        case 'event':
        case 'stop':
            var block = c.eventBlock(el);
            if (!block) c.need(-1, el.label);
            c.regels.splice(block.start, block.end - block.start + 1);
            break;
        default:
            throw new Error('Dit element kun je hier niet verwijderen.' + MANUAL);
    }
};


// ------------------------------------------------------------------ voorwaarden

function condOf(text) {
    // a condition typed by the user: 't > 13' (also 'als t > 13 dan'). Returns the trimmed text
    text = String(text || '').replace(/^\s+|\s+$/g, '').replace(/^als\s+/i, '').replace(/\s+dan$/i, '');
    var ast = null;
    try {
        ast = parse('als ' + text + ' dan\nstop\neindals', 'voorwaarde');
    } catch (err) {
        ast = null;
    }
    if (!text || !ast || ast.length != 1 || ast[0].type != 'If') {
        throw new Error('De voorwaarde "' + text + '" klopt niet. Bijvoorbeeld: t > 13');
    }
    return text;
}

function blockLines(condition, body) {
    // als t > 13 dan / (indented) Opp = Opp + dOpp / eindals, as in the exam models
    var out = ['als ' + condition + ' dan'];
    for (var i = 0; i < body.length; i++) out.push('    ' + body[i]);
    out.push('eindals');
    return out;
}

function writeBlock(c, at, lines) {
    // insert the lines of a block before line at (outside als ... eindals), same indentation
    var i = insert(c.regels, at, lines[0]);
    var ind = /^\s*/.exec(c.regels[i])[0];
    for (var k = 1; k < lines.length; k++) c.regels.splice(i + k, 0, ind + lines[k]);
}

function replaceBlock(c, block, lines) {
    var ind = /^\s*/.exec(c.regels[block.start])[0];
    var args = [block.start, block.end - block.start + 1];
    for (var k = 0; k < lines.length; k++) args.push(ind + lines[k]);
    c.regels.splice.apply(c.regels, args);
}

Context.prototype.isFormula = function(name) {
    // calculated with a formula in the modelregels, not a toestandsvariabele (x = x + dx)
    var el = this.g.elements.hasOwnProperty(name) ? this.g.elements[name] : null;
    return this.assigned.hasOwnProperty(name) && !(el && el.kind == 'stock') && !this.init.hasOwnProperty(name);
};

Context.prototype.checkTarget = function(name) {
    // a variable that a voorval can change: with a startwaarde, or a hulpvariabele
    name = String(name || '').replace(/^\s+|\s+$/g, '');
    if (!name) throw new Error('Welke variabele verandert er? Vul de naam in, bijvoorbeeld v.');
    if (name == this.g.time || name == this.g.dt) {
        throw new Error(name + ' kun je niet met een voorwaarde veranderen. Kies "Stop het model" om op een tijdstip te stoppen.');
    }
    if (!this.exists(name)) throw new Error('De variabele "' + name + '" bestaat niet.');
    if (!this.init.hasOwnProperty(name) && !this.isFormula(name)) {
        throw new Error(name + ' heeft nog geen beginwaarde. Geef ' + name + ' eerst een waarde (klik op de ?).');
    }
    return name;
};

ops.addEvent = function(c, op) {
    var cond = condOf(op.condition);
    if (op.stop) {
        writeBlock(c, endOf(c.regels), blockLines(cond, ['stop']));
        return;
    }
    var name = c.checkTarget(op.target), text = String(op.text || '').replace(/^\s+|\s+$/g, '');
    exprOf(text);
    writeBlock(c, c.afterLast(name), blockLines(cond, [name + ' = ' + text]));
};

ops.setEvent = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'event' && el.kind != 'stop') throw new Error('Dit is geen voorval of stopvoorwaarde.');
    var block = c.eventBlock(el);
    if (!block) c.need(-1, el.label);
    var st = block.stmt;
    var cond = op.condition === undefined ? grafisch.code(st.cond) : condOf(op.condition);
    var body = [], k;
    for (k = 0; k < st.then.length; k++) {
        var s = st.then[k];
        if (s.type == 'Stop') body.push('stop');
        if (s.type == 'Assignment') body.push(s.left + ' = ' + grafisch.code(s.right));
    }
    if (op.text !== undefined && el.kind == 'event') {
        if (body.length != 1) c.need(-1, el.label);
        var text = String(op.text).replace(/^\s+|\s+$/g, '');
        exprOf(text);
        for (k = 0; k < st.then.length; k++) if (st.then[k].type == 'Assignment') body[0] = st.then[k].left + ' = ' + text;
    }
    replaceBlock(c, block, blockLines(cond, body));
};

Context.prototype.limitBlock = function(name, bound) {
    // als x > 42,6 dan x = 42,6 eindals (bound 'max'), als x < 0 dan x = 0 eindals ('min')
    var list = this.blocks(), cmp = bound == 'max' ? ['>', '>='] : ['<', '<='];
    for (var i = 0; i < list.length; i++) {
        var st = list[i].stmt, body = [], k;
        if (st.type != 'If' || st.cond.type != 'Logical' || cmp.indexOf(st.cond.operator) == -1) continue;
        if (st.cond.left.type != 'Variable' || st.cond.left.name != name) continue;
        for (k = 0; k < st.then.length; k++) if (st.then[k].type != 'Blank') body.push(st.then[k]);
        if (body.length == 1 && body[0].type == 'Assignment' && body[0].left == name &&
            grafisch.code(body[0].right) == grafisch.code(st.cond.right)) return list[i];
    }
    return null;
};

ops.setLimit = function(c, op) {
    var name = op.name, text = String(op.text || '').replace(/^\s+|\s+$/g, '');
    if (op.bound != 'max' && op.bound != 'min') throw new Error('Onbekende grens: ' + op.bound);
    var block = c.limitBlock(name, op.bound);
    if (text === '') {
        if (block) c.regels.splice(block.start, block.end - block.start + 1);
        return;
    }
    exprOf(text);
    var lines = blockLines(name + (op.bound == 'max' ? ' > ' : ' < ') + text, [name + ' = ' + text]);
    if (block) replaceBlock(c, block, lines);
    else writeBlock(c, c.afterLast(name), lines);
};


function apply(model, op) {
    // returns the new {startwaarden, modelregels}. Throws an Error with a message for the user.
    if (!ops.hasOwnProperty(op.op)) throw new Error('Onbekende bewerking: ' + op.op);
    var c;
    try {
        c = new Context(model);
    } catch (err) {
        throw new Error('Het model bevat een fout. Los die eerst op in de tekst.');
    }
    c.timeUnit = op.timeUnit;
    ops[op.op](c, op);
    var result = c.text();
    try {
        parse(result.startwaarden, 'startwaarden');
        parse(result.modelregels, 'modelregels');
    } catch (err2) {
        throw new Error('Deze wijziging levert geen geldig model op.' + MANUAL);
    }
    return result;
}

function variablesOf(text) {
    return grafisch.variables(exprOf(text));
}

function dtOf(model) {
    var c = new Context(model), dt = c.g.dt;
    return {name: dt, text: c.init.hasOwnProperty(dt) ? grafisch.code(c.init[dt]) : null};
}

function eventOf(model, id) {
    var c = new Context(model), el = c.element(id);
    var block = (el.kind == 'event' || el.kind == 'stop') ? c.eventBlock(el) : null;
    if (!block) return null;
    var st = block.stmt, out = {condition: grafisch.code(st.cond), target: null, text: null};
    for (var k = 0; k < st.then.length; k++) {
        if (st.then[k].type == 'Assignment') {
            if (out.target !== null) return {condition: out.condition, target: null, text: null};   // more: only the condition
            out.target = st.then[k].left;
            out.text = grafisch.code(st.then[k].right);
        }
    }
    return out;
}

function limitsOf(model, name) {
    var c = new Context(model), out = {}, bounds = ['max', 'min'];
    for (var i = 0; i < bounds.length; i++) {
        var b = c.limitBlock(name, bounds[i]);
        out[bounds[i]] = b ? grafisch.code(b.stmt.cond.right) : '';
    }
    return out;
}

exports.apply = apply;
exports.eventOf = eventOf;
exports.limitsOf = limitsOf;
exports.variablesOf = variablesOf;
exports.dtOf = dtOf;

},{"./grafisch.js":9,"./modelleertaal":14}],9:[function(require,module,exports){
/*
    grafisch.js  (prototype)

    Zet een tekstmodel (startwaarden + modelregels) om in een grafisch model
    (System Dynamics / stock-flow), getekend zoals de grafische modellen in de
    centrale examens natuurkunde vwo (bijvoorbeeld 2022-I en 2023-II):
    grijze achtergrond, toestandsvariabele als rechthoek, stroom als holle pijl
    met een ventiel (cirkel met kraantje), hulpvariabelen en constanten als
    cirkels met de naam eronder en zwarte relatiepijlen.
    Er is ook een stijl in kleur (toSVG(g, lay, {stijl: 'kleur'})) met de symbolen
    die de meeste System Dynamics software gebruikt (Forrester, Stella, Vensim, Powersim):
    hulpvariabele cirkel, constante ruit, ventiel als vlinderdas, wolkje buiten het model.
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
      In te vullen (...)   Fres = ... heeft geen pijlen; de sectie <grafisch> van het model
                           geeft ze (Fres: Fz, Fp), zoals in de examenfiguur (2023-II).
                           vy = ... met een startwaarde: toestandsvariabele zonder stromen (2014-II)
                           'startwaarden: tonen' in <grafisch>: de examenstijl tekent ook de
                           pijlen uit formules in de startwaarden, gestippeld (2014-II)

    usage:
      var grafisch = require('./grafisch.js');
      var g = grafisch.analyse(startwaarden_ast, modelregels_ast, {hints: model.grafisch});
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

function parseHints(text) {
    // <grafisch> section of a model: 'Fres: Fz, Fp' (one line per variable, ' or // comment)
    //   --> {Fres: ['Fz', 'Fp']}. 'startwaarden: tonen' is a setting (see view)
    var hints = {}, lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var m = /^\s*([^\s:]+)\s*:\s*(.*)$/.exec(lines[i].replace(/('|\/\/).*$/, ''));
        if (!m) continue;
        var deps = m[2].split(/[\s,;]+/), out = [];
        for (var j = 0; j < deps.length; j++) if (deps[j] && out.indexOf(deps[j]) == -1) out.push(deps[j]);
        hints[m[1]] = out;
    }
    return hints;
}

function hasBlank(expr) {
    var found = false;
    walk(expr, function(node) { if (node.type == 'Blank') found = true; });
    return found;
}

function analyse(startwaarden_ast, modelregels_ast, options) {
    // options.hints: the <grafisch> section of the model (text, or {name: [deps]}):
    //   the arrows of a line with ... (in te vullen), as in the exam figure
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
    var isStock = {}, stockOrder = [], blankStock = {};
    for (i = 0; i < regels.assign.length; i++) {
        a = regels.assign[i];
        if (!isStock[a.name] && variables(a.expr).indexOf(a.name) != -1) {
            isStock[a.name] = true;
            stockOrder.push(a.name);
        }
    }
    // vy = ... (in te vullen) with a startwaarde: in the answer vy = vy - g * dt. A toestandsvariabele
    // without flows, as in the exam 2014-II (figuur 3)
    for (i = 0; i < regels.assign.length; i++) {
        a = regels.assign[i];
        if (!isStock[a.name] && a.expr.type == 'Blank' && init.hasOwnProperty(a.name) &&
            assigned[a.name].uncond.length == 1 && !assigned[a.name].cond.length) {
            isStock[a.name] = true;
            blankStock[a.name] = true;
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
                         // vy = ...: no + buttons for new flows (fill in the text first)
                         updates: blankStock[name] ? 0 : assigned[name].uncond.length,
                         conditional: assigned[name].cond.length > 0, blank: !!blankStock[name]});
        var updates = blankStock[name] ? [] : assigned[name].uncond;
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
                        // dx = v * dt ; x = x + dx: drawn as x = x + v * dt (see below): in the exam
                        // style a valve without a name with an arrow from v, in color the name v
                        var single = !!(rate && isVar(rate) && rate.name != time);
                        f = {id: f ? v + '#' + flows.length : v, kind: 'flow', name: v, label: v,
                             from: term.sign < 0 ? name : null, to: term.sign > 0 ? name : null,
                             term: v, code: code(def),
                             definition: fmt(def), rate: rate ? fmt(rate) : null,
                             varRate: single, shown: single ? rate.name : null,
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
                         // x = x + v * dt with v a variable that has its own symbol (a toestandsvariabele
                         // or a constante): in the exams a valve without a name, with an arrow from v
                         // (2014-II, 2015-I, 2022-I, 2023-II)
                         varRate: !!(r && isVar(r) && r.name != time),
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

    // --- lines with ... (in te vullen): the arrows from options.hints (the exam figure shows them)
    var hints = options && options.hints ? (typeof options.hints == 'string' ? parseHints(options.hints) : options.hints) : {};
    var blank = {}, known = {};
    for (i = 0; i < start.assign.length; i++) {
        known[start.assign[i].name] = true;
        if (hasBlank(start.assign[i].expr)) blank[start.assign[i].name] = true;
    }
    for (i = 0; i < regels.assign.length; i++) {
        known[regels.assign[i].name] = true;
        if (hasBlank(regels.assign[i].expr)) blank[regels.assign[i].name] = true;
    }
    for (name in hints) {
        if (!hints.hasOwnProperty(name) || !blank[name]) continue;
        var hid = flowOfVar[name] && !elements[name] ? flowOfVar[name].id : name;
        if (!elements.hasOwnProperty(hid) || !elements[hid].deps) continue;
        for (j = 0; j < hints[name].length; j++) {
            if (known[hints[name][j]] && hints[name][j] != name) addAll(elements[hid].deps, [hints[name][j]]);
        }
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
            stops: stops,
            // <grafisch> 'startwaarden: tonen': the exam style also draws the arrows from the
            // formulas in the startwaarden (dashed), as in the exam 2014-II
            showStart: !!(hints.startwaarden && hints.startwaarden.indexOf('tonen') != -1)};
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
                def = 'beginwaarde ' + el.initial + (change.length ? '; verandering: ' + change.join(' ') :
                                                     el.blank ? '; verandering: ...' : '');
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
        // the independent variable (t = t + dt, s = s + ds) is only drawn when a formula uses it,
        // but always listed: otherwise s in s = s + ds seems not to be recognised (2026-II)
        if (KIND_ORDER[k] == 'time' && g.time !== null && !g.elements.hasOwnProperty(g.time)) {
            rows.push({kind: KIND_NAMES.time, name: g.time,
                       definition: 'stap ' + g.dt + (g.dtValue !== null ? ' = ' + g.dtValue : '') +
                                   '; niet getekend, want geen formule gebruikt ' + g.time,
                       id: undefined});
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
    // Ek = 1/2 * m * v^2) and no constante that is only used there (g), as in the exam 2026-II.
    // Unless the model says 'startwaarden: tonen' in <grafisch> (g.showStart, exam 2014-II)
    var exam = !(opts && opts.stijl == 'kleur') && !g.showStart;
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
    // opts.formules: room for the boxes with formulas (see toSVG)
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

    // with formulas (opts.formules): room for the boxes below the names
    var layerH = L.layerH + (opts && opts.formules ? 38 : 0);
    var boxW = function(id) {
        var t = opts && opts.formules ? formulaText(g.elements[id]) : null;
        if (t === null) return 0;
        var parts = String(t).split('; '), w = 0;
        for (var m = 0; m < parts.length && m < 4; m++) w = Math.max(w, 6.4 * Math.min(parts[m].length, 34) + 8);
        return w;
    };
    var need = function(a, b) { return Math.max(L.gap, (boxW(a) + boxW(b)) / 2 + 14); };
    var belowY = L.stockH / 2 + (below == 2 ? 150 : below == 1 ? 110 : 60) + (layerH - L.layerH);
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
                var over = need(wanted[k].id, wanted[k + 1].id) - (wanted[k + 1].x - wanted[k].x);
                if (over > 0.5) { wanted[k].x -= over / 2; wanted[k + 1].x += over / 2; moved = true; }
            }
            if (!moved) break;
        }
        for (k = 0; k < wanted.length; k++) pos[wanted[k].id] = {x: wanted[k].x, y: y};
    }
    for (var up = 1; up <= maxUp; up++) {
        if (layers[up]) place(layers[up], -up * layerH, function(id) { return targets[id].length ? targets[id] : sources[id]; });
    }
    for (var down = 1; layers[-down]; down++) {
        place(layers[-down], belowY + (down - 1) * layerH, function(id) { return sources[id].length ? sources[id] : targets[id]; });
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
//   'kleur':  the stock-flow symbols that most System Dynamics software shares, going back to
//             J.W. Forrester, Industrial Dynamics (1961), chapter 'Symbols for flow diagrams',
//             and J.D. Sterman, Business Dynamics (2000):
//               toestandsvariabele  rectangle                       (Forrester level; all software)
//               stroom              pipe with a bow tie valve       (Forrester rate; Vensim, Sterman)
//               buiten het model    cloud (source / sink)           (Forrester, Stella, Vensim, Powersim)
//               hulpvariabele       circle                          (Stella converter, Powersim auxiliary)
//               constante           diamond                         (Powersim constant)
//               relatiepijl         thin curved arrow               (Stella connector, Vensim arrow)
//               stopvoorwaarde      octagon (a stop sign; the diamond is the constante here)
//             Not in the stock-flow notation, the same in both styles (black in examen):
//               voorval             lightning bolt: the Event element of AnyLogic (a yellow bolt,
//                                   https://anylogic.help/anylogic/statecharts/events.html)
//               onafhankelijke var. clock face: the Clock block of Simulink (simulation time,
//                                   https://www.mathworks.com/help/simulink/slref/clock.html)
//             The elements themselves (voorval: a condition that changes a toestandsvariabele;
//             onafhankelijke variabele t) are those of the Coach 7 manual, section 'Modelelementen
//             voor de grafische en vergelijkingenmodus'; its icons are not copied.
//             Colors: blue symbols, red relatiepijlen on white, as Dutch students know from school,
//             softened (#1f5fa8 and #c62828 instead of pure blue and red) with a light blue fill.
var STIJLEN = {
    examen: {line: '#000', fill: '#fff', bg: '#d4d4d4', red: '#c62828', text: '#000', grey: '#555',
             arrow: '#000', font: 'Times New Roman, Times, serif', size: 15,
             aux: 13, constant: 13, valve: 10, gap: 2},
    kleur: {line: '#1f5fa8', fill: '#dceaf8', bg: '#fff', red: '#c62828', text: '#1d2733', grey: '#6b7785',
            arrow: '#c62828', font: 'Segoe UI, Helvetica, Arial, sans-serif', size: 13,
            aux: 18, constant: 14, valve: 9, gap: 3, outside: 13}
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
        case 'const':
            if (!S.outside) return S.constant + S.gap;
            // diamond: |x| + |y| = r
            var dl = Math.sqrt(dx * dx + dy * dy) || 1;
            return S.constant * dl / ((Math.abs(dx) + Math.abs(dy)) || 1) + S.gap;
        case 'event': return 16;
        case 'stop': return 15;
        default: return S.aux + S.gap;
    }
}

function pipeEnd(x, y, S) {
    // the open end of a flow from or to outside the model.
    // examen: not drawn (an invisible area to drag it), kleur: a cloud (source or sink, as Forrester)
    if (!S.outside) {
        return '<circle class="end" cx="' + x + '" cy="' + y + '" r="12" fill="#000" fill-opacity="0" stroke="none"/>';
    }
    return '<path class="cloud" d="' + cloud(x, y) + '" fill="#fff" stroke="' + S.line +
        '" stroke-width="1.5" stroke-linejoin="round"/>';
}

function cloud(x, y) {
    // a cloud of four bumps on a flat bottom, about 26 wide and 17 high, centered at (x, y)
    var pt = function(dx, dy) { return (x + dx) + ',' + (y + dy); };
    return 'M' + pt(-9, 7) + ' A4.5,4.5 0 0 1 ' + pt(-10, -1) + ' A5.5,5.5 0 0 1 ' + pt(-2, -7) +
        ' A5,5 0 0 1 ' + pt(7, -5) + ' A4.5,4.5 0 0 1 ' + pt(9, 7) + ' z';
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
    // opts.formules: a box with the formula or beginwaarde next to every symbol (exams 2015-I, 2016-I)
    // opts.units: name --> unit (eenheden.js): the unit after the name, v (m/s)
    // opts.derivedUnits: name --> true for a unit derived from the formulas (drawn lighter)
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
        // kleur: the pipe starts under the cloud, the arrow head touches the cloud (10 wide, 7 high)
        var ra = f.from ? radius(g.elements[f.from], u0.x, u0.y, S) + (exam ? -3 : 0) : (exam ? 0 : 5);
        var rb = f.to ? radius(g.elements[f.to], -u1.x, -u1.y, S) + (exam ? -3 : 3) :
            (exam ? 0 : 10 * Math.abs(u1.x) + 7 * Math.abs(u1.y) + 2);
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
        // exam style: a formula in the startwaarden (vx = v0 * cos(alfa)) dashed, as in 2014-II
        out.push('<path d="' + d + '" fill="none" ' + linkStyle(exam && lk.start ? 'initial' : lk.kind, S) + '/>');
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
    var lblUnit = '', lblDerived = false;
    var lab = function(text) {
        // the name in italics (exam style), the unit (opts.units) upright: v (m/s)
        text = String(text);
        var suffix = lblUnit ? ' (' + lblUnit + ')' : '';
        if (suffix && text.length > suffix.length && text.slice(-suffix.length) == suffix) {
            return esc(text.slice(0, -suffix.length)) + '<tspan font-style="normal"' +
                (lblDerived ? ' fill-opacity="0.55"' : '') + '>' + esc(suffix) + '</tspan>';
        }
        return esc(text);
    };
    var name = function(x, y, r, label, id, cls) {
        cls = (cls || 'name') + ' lbl';
        if (bottom[id]) grow(x + r + 4 + 8 * String(label).length, y, 4);
        return bottom[id] ?
            '<text x="' + (x + r + 4) + '" y="' + (y + 5) + '" class="' + cls + '">' + lab(label) + '</text>' :
            '<text x="' + x + '" y="' + (y + r + 16) + '" text-anchor="middle" class="' + cls + '">' + lab(label) + '</text>';
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
        var x = p.x, y = p.y, label = el.shown || el.name || el.label;
        lblUnit = opts.units && el.kind != 'event' && el.kind != 'stop' && opts.units.hasOwnProperty(label) ? opts.units[label] : '';
        lblDerived = !!(lblUnit && opts.derivedUnits && opts.derivedUnits[label]);
        if (lblUnit) label += ' (' + lblUnit + ')';
        var maxLen = lblUnit ? 28 : 16;
        var nameDown = 0;   // a name lower than usual (below a tap that points down)
        switch (el.kind) {
            case 'stock':
                // rectangle, name inside
                out.push(tip + '<rect x="' + (x - L.stockW / 2) + '" y="' + (y - L.stockH / 2) + '" width="' + L.stockW +
                    '" height="' + L.stockH + '"' + (exam ? '' : ' rx="3"') + ' fill="' + S.fill + '" stroke="' + S.line +
                    '" stroke-width="' + (exam ? 1.5 : 2) + '"/>' +
                    '<text x="' + x + '" y="' + (y + (exam ? 6 : 5)) + '" text-anchor="middle" class="name stock">' + lab(label) + '</text>');
                grow(x, y, L.stockW / 2 + 4);
                break;
            case 'flow':
                if (exam) {
                    // ventiel: a circle on the pipe with a tap. An arrow from above: the tap below
                    var flip = above[id] && !bottom[id];
                    if (flip && valveDir[id] != 'v') nameDown = 7;
                    out.push(tip + valve(x, y, valveDir[id], flip, S) + (el.varRate ? '' :
                        name(x, flip && valveDir[id] != 'v' ? y + 7 : y, S.valve, shorten(label, maxLen), id)));
                } else {
                    // the name as large as other names (a in v = v + a*dt), as in the SLO examples
                    out.push(tip + valve(x, y, valveDir[id], false, S) + name(x, y, 12, shorten(label, maxLen), id));
                }
                grow(x, y + 20, 30);
                break;
            case 'aux':
                out.push(tip + circle(x, y, S.aux, S.fill, S.line, el.conditional ? ' stroke-dasharray="4 2"' : '') +
                    name(x, y, S.aux, label, id));
                grow(x, y + 10, 30);
                break;
            case 'const':
                // examen: the same circle as a hulpvariabele. kleur: a diamond (Powersim)
                var rc = S.constant;
                out.push(tip + (exam ? circle(x, y, rc, S.fill, S.line) :
                    '<path d="M' + x + ',' + (y - rc) + ' L' + (x + rc) + ',' + y + ' L' + x + ',' + (y + rc) +
                    ' L' + (x - rc) + ',' + y + ' z" fill="' + S.fill + '" stroke="' + S.line +
                    '" stroke-width="2" stroke-linejoin="round"/>') +
                    name(x, y, rc, label, id));
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
                // stopvoorwaarde, the condition below. examen: a diamond (exam 2026-II).
                // kleur: an octagon, a stop sign (the diamond is the constante in this style)
                var ds = '';
                if (exam) {
                    ds = 'M' + x + ',' + (y - 14) + ' L' + (x + 14) + ',' + y + ' L' + x + ',' + (y + 14) + ' L' + (x - 14) + ',' + y + ' z';
                } else {
                    for (var k8 = 0; k8 < 8; k8++) {
                        var a8 = (k8 + 0.5) * Math.PI / 4;
                        ds += (k8 ? ' L' : 'M') + (x + 14 * Math.cos(a8)).toFixed(1) + ',' + (y + 14 * Math.sin(a8)).toFixed(1);
                    }
                    ds += ' z';
                }
                out.push(tip + '<path d="' + ds + '" fill="' + (exam ? S.fill : '#fdecea') + '" stroke="' + (exam ? S.line : S.red) +
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
        if (opts.formules) {
            // a box with the formula or beginwaarde (exams 2015-I and 2016-I): above a stock
            // (higher than the + buttons on its corners), otherwise below the name (also when the
            // name is lower, below a tap that points down)
            var ftext = formulaText(el);
            if (ftext !== null) {
                var fr = el.kind == 'flow' ? S.valve : el.kind == 'const' ? S.constant : S.aux;
                var named = !(el.kind == 'flow' && exam && el.varRate) && !bottom[id];
                var ftop = el.kind == 'stock' ? y - L.stockH / 2 - 31 : y + fr + (named ? 24 + nameDown : 6);
                out.push(formulaBox(x, ftop, ftext, S, grow));
            }
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
        '.small{font-size:' + (exam ? 12 : 11) + 'px;fill:' + S.grey + '}' +
        'text.formula{font-size:12px;font-style:normal}</style>' +
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

function formulaText(el) {
    // the text in the box next to a symbol (opts.formules)
    switch (el.kind) {
        case 'stock': return el.name + ' = ' + el.initial;
        // x = x + v * dt: no name and no box (2015-I)
        case 'flow': return el.varRate ? null : el.name ? el.name + ' = ' + el.definition : el.definition;
        case 'aux':
        case 'const': return el.name + ' = ' + el.definition;
        default: return null;
    }
}

function formulaBox(x, top, text, S, grow) {
    // a white box with a black border, centered at x (as in the exams 2015-I and 2016-I).
    // 'als ... dan ...; anders ...': one line per part, as in the exam 2015-I
    var parts = String(text).split('; '), lines = [], i, w = 0;
    for (i = 0; i < parts.length && i < 4; i++) {
        lines.push(shorten(parts[i], 34));
        w = Math.max(w, Math.round(6.4 * lines[i].length + 8));
    }
    var h = 4 + 15 * lines.length, left = x - w / 2;
    grow(left, top, 0);
    grow(left + w, top + h, 0);
    var out = '<rect class="formula" x="' + left + '" y="' + top + '" width="' + w + '" height="' + h +
        '" fill="#fff" stroke="' + S.line + '" stroke-width="0.8"/>';
    for (i = 0; i < lines.length; i++) {
        out += '<text class="formula" x="' + x + '" y="' + (top + 14 + 15 * i) + '" text-anchor="middle">' +
            esc(lines[i]) + '</text>';
    }
    return out;
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
exports.parseHints = parseHints;
exports.layout = layout;
exports.toSVG = toSVG;
exports.STIJLEN = STIJLEN;
exports.table = table;
exports.lines = lines;
exports.fmt = fmt;
exports.code = code;
exports.collect = collect;
exports.variables = variables;

},{}],10:[function(require,module,exports){
/*
    hints.js

    Hints bij veelgemaakte modelfouten. Na Run, als informatie (nooit blokkerend), één tegelijk:

      - dt bestaat maar t wordt niet opgehoogd:  "De tijd loopt niet: voeg t = t + dt toe."
      - een startwaarde die nergens wordt gebruikt:  "'k' wordt niet gebruikt in de modelregels."
      - een startwaarde die in de modelregels wordt overschreven voordat hij gebruikt wordt:
        "De startwaarde van 'a' wordt niet gebruikt: ..."

    No DOM. Works on the AST of the parser.

    usage:
      var hints = require('./hints.js');
      var list = hints.find(evaluator.startwaarden_ast, evaluator.modelregels_ast);
      // [{kind: 'tijd', name: 't', text: '...'}, ...] (most important first)
*/

//jshint node:true
//jshint es3:true
"use strict";


function walk(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk(node.left, callback);
    walk(node.right, callback);
    walk(node.expr, callback);
}


function expr_reads(expr, out) {
    walk(expr, function(node) {
        if (node.type == 'Variable') out[node.name] = true;
    });
    return out;
}


function reads(ast, out) {
    // all names that are read in the statements (also inside als ... dan)
    out = out || {};
    (ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') {
            expr_reads(stmt.right, out);
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            expr_reads(stmt.cond, out);
            reads(stmt.then, out);
            reads(stmt.elsestmt, out);
        } else if (stmt.type == 'Print') {
            out[stmt.varname] = true;
        }
    });
    return out;
}


function writes(ast, out) {
    // all names that get a value (also inside als ... dan)
    out = out || {};
    (ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') {
            out[stmt.left] = true;
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            writes(stmt.then, out);
            writes(stmt.elsestmt, out);
        }
    });
    return out;
}


function first_use(ast, name) {
    // in the order of the modelregels: is name first 'read' or first 'write' (always, not
    // inside als ... dan)? null: not used.
    for (var i = 0; i < (ast || []).length; i++) {
        var stmt = ast[i];
        if (stmt.type == 'Assignment') {
            if (expr_reads(stmt.right, {})[name]) return 'read';
            if (stmt.left == name) return 'write';
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            if (reads([stmt], {})[name]) return 'read';
        } else if (stmt.type == 'Print' && stmt.varname == name) {
            return 'read';
        }
    }
    return null;
}


function find(startwaarden_ast, modelregels_ast) {
    var start = [];   // names with a startwaarde, in order
    (startwaarden_ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment' && start.indexOf(stmt.left) == -1) start.push(stmt.left);
    });
    var read_start = reads(startwaarden_ast);
    var read_model = reads(modelregels_ast);
    var written = writes(modelregels_ast);
    var out = [];

    // the time does not run
    if (start.indexOf('t') != -1 && start.indexOf('dt') != -1 && read_model.dt && !written.t) {
        out.push({kind: 'tijd', name: 't',
                  text: "De tijd loopt niet: 't' wordt in de modelregels niet groter. Voeg t = t + dt toe."});
    }

    // a startwaarde that is not used anywhere
    start.forEach(function(name) {
        if (!read_model[name] && !read_start[name] && !written[name] && !(name == 't' && out.length)) {
            out.push({kind: 'ongebruikt', name: name,
                      text: "'" + name + "' wordt niet gebruikt in de modelregels."});
        }
    });

    // a startwaarde that is overwritten before it is used
    start.forEach(function(name) {
        if (!read_start[name] && first_use(modelregels_ast, name) == 'write') {
            out.push({kind: 'overschreven', name: name,
                      text: "De startwaarde van '" + name + "' wordt niet gebruikt: '" + name +
                            "' krijgt in de modelregels een nieuwe waarde voordat hij gebruikt wordt."});
        }
    });
    return out;
}


exports.find = find;
exports.first_use = first_use;

},{}],11:[function(require,module,exports){
/*
 model.js

 Model Class

 read a from model.xml
 store model in string etc


 model.xml example:

 <modelleertaal>
 <startwaarden>
     Fmotor = 500 'N
     m = 800 'kg
     dt = 1e-2 's
     v = 0'm/s
     s = 0 'm/s
     t = 0 's
 </startwaarden>
 <modelregels>
     Fres= Fmotor
     a = Fres/m
     dv = a * dt
     v = v + dv
     ds = v * dt
     s = s + ds
     t = t + dt
     als (0)
     dan
       Stop
     EindAls
 </modelregels>

 </modelleertaal>
*/


//jshint es3:true

var fs = require('fs');

function Model() {
    this.modelregels = '';
    this.startwaarden = '';
}


Model.prototype.readBogusXMLFile = function(filename) {
    // This read a "bogus" XML file that still includes < instead of &lt;
    var buf = fs.readFileSync(filename, "utf8");

    this.parseBogusXMLString(buf);
};

Model.prototype.parseBogusXMLString = function(xmlString) {

    var action = 0; // 0 = do nothing, 1 = modelregels, 2 = startwaarden, 3 = grafisch, 4 = opdracht, 5 = indeling
    // N = 1000 (outside the sections): the number of iterations. Not global (/g): a global regexp
    // keeps lastIndex between the lines, so N could be missed after a longer line with =
    var equationRe = /^\s*N\s*=\s*(\d+)/;

    this.startwaarden = '';
    this.modelregels = '';
    // <grafisch>: for the graphical model, which variables a line with ... depends on,
    // e.g. 'Fres: Fz, Fp' (see grafisch.js, parseHints). Optional.
    this.grafisch = '';
    // <opdracht>: a question or assignment with the model (shown above the model). Optional.
    this.opdracht = '';
    // <indeling>: positions of dragged symbols in the graphical model, as JSON. Optional.
    this.indeling = '';

    // strip BOM and Windows line endings (\r confuses the line numbers in error messages)
    if (xmlString.charCodeAt(0) === 0xFEFF) xmlString = xmlString.slice(1);
    var lines = xmlString.split(/\r?\n/);

    for(var line = 1; line < lines.length; line++) {

        //console.log(action, lines[line]);
        // try to extra N = ... from model
        if (action === 0) {
          var matches = equationRe.exec(lines[line]);
          if (matches !== null) {
            this.N = parseInt(matches[1], 10);
            if (this.debug) console.log('Found N = '+this.N+' in model.xml');
          }
        }
        switch(lines[line].replace('\r','')) {
            // < and > mess things up in the browser
            case '<modelregels>': { action = 1; continue; }
            case '</modelregels>': { action = 0; continue; }
            case '<startwaarden>': { action = 2; continue; }
            case '</startwaarden>': { action = 0; continue; }
            case '<grafisch>': { action = 3; continue; }
            case '</grafisch>': { action = 0; continue; }
            case '<opdracht>': { action = 4; continue; }
            case '</opdracht>': { action = 0; continue; }
            case '<indeling>': { action = 5; continue; }
            case '</indeling>': { action = 0; continue; }
        }
        if (action==1) this.modelregels += lines[line]+'\n';
        if (action==2) this.startwaarden += lines[line]+'\n';
        if (action==3) this.grafisch += lines[line]+'\n';
        if (action==4) this.opdracht += lines[line]+'\n';
        if (action==5) this.indeling += lines[line]+'\n';
    }
    this.opdracht = this.opdracht.replace(/\s+$/, '');
    this.indeling = this.indeling.replace(/\s+$/, '');
    //console.log('DEBUG: in model.js parseBogusXMLString endresult this.modelregels:');
    //console.log(this.modelregels);
    //console.log('DEBUG: in model.js parseBogusXMLString endresult this.startwaarden:');
    //console.log(this.startwaarden);

};

Model.prototype.createBogusXMLString = function() {

    // TODO replace this with a function that exports all options.
    var Nstring = '';
    if (this.N !== undefined)
            Nstring = 'N = ' + this.N + '\n';
    // the text of a section, one \n after each line. Without empty lines at the end: a model that
    // was read ends with \n, and Open + Bewaar must not add an empty line each time
    var section = function(name, text) {
        text = String(text || '').replace(/(\r?\n)+$/, '');
        return '<' + name + '>\n' + (text ? text + '\n' : '') + '</' + name + '>\n';
    };
    return '<modelleertaal>\n' +
            Nstring +
            (this.opdracht ? section('opdracht', this.opdracht) : '') +
            section('startwaarden', this.startwaarden) +
            section('modelregels', this.modelregels) +
            (this.grafisch ? section('grafisch', this.grafisch) : '') +
            (this.indeling ? section('indeling', this.indeling) : '') +
            '</modelleertaal>\n';
};



exports.Model = Model;

},{"fs":16}],12:[function(require,module,exports){
/*
    modelkeuze.js

    De gelaagde modelkeuze: verzameling (groep) -> kopje (sectie) -> model.

    model_index (modellen/models.js) is één platte lijst. Elk model heeft een groep
    (eerste keuzelijst) en een sectie (kopje in de tweede keuzelijst). Een model
    zonder groep komt in de groep OVERIG. De volgorde van groepen en secties is de
    volgorde waarin ze voor het eerst in de lijst staan.

    No DOM.

    usage:
      var modelkeuze = require('./modelkeuze.js');
      modelkeuze.groepen(model_index)          // ['Examens vwo', 'C2 Energie en arbeid', ...]
      modelkeuze.secties(model_index, 'C3 Gravitatie')
          // [{sectie: 'Basismodellen', modellen: [{index: 21, title: '0 Horizontale worp'}, ...]}, ...]
      modelkeuze.groep_van(model_index[i])     // 'C3 Gravitatie'
      modelkeuze.naam_van_url('modellen/c2/Bungeejumper.xml')   // 'c2/Bungeejumper'
      modelkeuze.zoek_url(model_index, 'modellen/c3/kogelbaan.xml')   // index in groep C3 (or first match), or -1
*/

//jshint node:true
//jshint es3:true
"use strict";

var OVERIG = 'Overige modellen';


function groep_van(entry) {
    return (entry && entry.groep) ? String(entry.groep) : OVERIG;
}


function groepen(model_index) {
    var result = [];
    for (var i = 0; i < model_index.length; i++) {
        var groep = groep_van(model_index[i]);
        if (result.indexOf(groep) == -1) result.push(groep);
    }
    return result;
}


function secties(model_index, groep) {
    var result = [], by_name = {};
    for (var i = 0; i < model_index.length; i++) {
        var entry = model_index[i];
        if (groep_van(entry) != groep) continue;
        var sectie = entry.sectie ? String(entry.sectie) : '';
        if (!by_name.hasOwnProperty(sectie)) {
            by_name[sectie] = {sectie: sectie, modellen: []};
            result.push(by_name[sectie]);
        }
        by_name[sectie].modellen.push({index: i, title: entry.title});
    }
    return result;
}


function naam_van_url(url) {
    // modellen/naam.xml --> naam, modellen/c2/naam.xml --> c2/naam (used in #model=...)
    var match = /^(?:.*\/)?modellen\/(.+)\.xml$/.exec(String(url || ''));
    if (match) return match[1];
    match = /([^\/]+)\.xml$/.exec(String(url || ''));
    return match ? match[1] : null;
}


function zoek_url(model_index, url) {
    // the model with this url. A model can be in more than one groep (Basismodellen and its
    // module). A model in a submap (modellen/c3/...) is found in the groep of its module (the
    // groep that starts with the name of the submap: 'C3 Gravitatie'), else the first one.
    var match = /modellen\/([^\/]+)\/[^\/]+$/.exec(String(url || ''));
    var module = match ? match[1].toLowerCase() + ' ' : null;
    var first = -1;
    for (var i = 0; i < model_index.length; i++) {
        if (model_index[i].url != url) continue;
        if (first == -1) first = i;
        if (module && groep_van(model_index[i]).toLowerCase().indexOf(module) === 0) return i;
    }
    return first;
}


exports.OVERIG = OVERIG;
exports.groep_van = groep_van;
exports.groepen = groepen;
exports.secties = secties;
exports.naam_van_url = naam_van_url;
exports.zoek_url = zoek_url;

},{}],13:[function(require,module,exports){
var evaluator_js = require('./evaluator.js');
var autoplot = require('./autoplot.js');
var deellink = require('./deellink.js');
var grafisch = require('./grafisch.js');
var grafisch_edit = require('./grafisch-edit.js');
var stapper = require('./stapper.js');
var vergelijk = require('./vergelijk.js');
var dtcheck = require('./dtcheck.js');
var modelkeuze = require('./modelkeuze.js');
var eenheden = require('./eenheden.js');
var aflezen = require('./aflezen.js');
var assen = require('./assen.js');
var hints = require('./hints.js');
var oorzaak = require('./oorzaak.js');
var rondleiding = require('./rondleiding.js');
var Blob = require('blob');
var FileSaver = require('file-saver');
// this also depends on:
// jQuery
// jQuery.Flot
// These libs are not included, because the Flot libray does not play well
// with browserify.
// Include this in the HTML with:
//<script src="scripts/jquery-3.2.1.min.js"></script>
//<script src="scripts/jquery.flot.js"></script>

//jshint devel:true
//jshint es5:true
//jshint loopfunc: true
//jshint browser:true
/* globals $, CodeMirror */

/* version history: CHANGELOG.md */
var version = "v6.7.1";

var COLOR_PLOT = '#1d4ed8';
var COLOR_PREVIOUS = '#c3c8d1';
var COLOR_READ = '#d97706';   // Aflezen: the point that was clicked, its lines and the tangent
// qualitative colour scheme that is colour-blind safe.
// https://personal.sron.nl/~pault/#sec:qualitative
// blue, cyan, green, yellow, red, purple, grey
var COLORS_MULTIPLOT = ['#4477aa', '#66ccee', '#228833', '#ccbb44', '#ee6677', '#aa3377', '#bbbbbb'];

var N_MAX = 1e6;


function ModelleertaalApp(params) {

  params = params || {};
  var self = this;

  this.debug = params.debug || false;
  this.version = version;
  if (this.debug) console.log('Modelleertaal App. ' + version);

  this.model_index = params.model_index || [];
  this.N_default = params.N_default || window.N_default || 1000;

  this.CodeMirror = (params.CodeMirror !== false);
  this.CodeMirrorActive = false;

  this.yaxis_autoscale = false;  // try to include origin (y=0) by default
  this.max_rows_in_plot = 500;
  this.precision = 4;

  this.dom_modelregels = "#modelregels";
  this.dom_startwaarden = "#startwaarden";
  this.dom_status = "#status_bar";
  this.dom_message = "#message";
  this.dom_datatable = "#datatable";
  this.dom_graph = "#graph";
  this.dom_graph_tabs = "#graph_tabs";
  this.dom_graph_note = "#graph_note";
  this.dom_results = ".results";
  this.dom_nbox = "#NBox";
  this.dom_endtime_hint = "#endtime_hint";
  this.dom_run = "#run";
  this.dom_step = "#stap";
  this.dom_step_line = "#stap_regel";
  this.dom_fileinput = "#fileinput";
  this.dom_download_xml = "#download_xml";
  this.dom_download_pgf = "#download_pgf";
  this.dom_download_tsv = "#download_tsv";
  this.dom_download_svg = "#download_svg";
  this.dom_download_png = "#download_png";
  this.dom_precision = "#precision";
  this.dom_max_rows = "#max_rows";
  this.dom_x_var = "#x_var";
  this.dom_y_var = "#y_var";
  this.dom_y_checks = "#y_checks";
  this.dom_x_pick = "#x_pick";
  this.dom_y_pick = "#y_pick";
  this.dom_zoom_reset = "#zoom_reset";
  this.dom_multiplot = "#multiplot";
  this.dom_yaxis_zero = "#yaxis_zero";
  this.dom_model_keuze = "#model_keuze";
  this.dom_model_groep = "#model_groep";
  this.dom_permalink = "#permalink";
  this.dom_titel = "#model_titel";
  this.dom_opdracht = "#opdracht";
  this.dom_opdracht_tekst = "#opdracht_tekst";
  this.dom_opdracht_invoer = "#opdracht_invoer";
  this.opdracht = '';   // the assignment with the model (shown above the model)
  this.dom_grafisch = "#grafisch_model";
  this.dom_grafisch_svg = "#grafisch_svg";
  this.dom_view_switch = ".view_switch";
  this.dom_workspace = ".workspace";
  this.dom_grafisch_tabel = "#grafisch_tabel";
  this.dom_functies_tabel = "#functies_tabel";
  this.weergave = 'tekst';   // 'tekst' or 'grafisch' (text and diagram)
  this.grafisch_stijl = 'examen';   // style of the diagram: 'examen' or 'kleur' (see grafisch.js)
  this.grafisch_formules = false;   // a box with the formula next to every symbol (exams 2015, 2016)
  this.dom_grafisch_formules = "#grafisch_formules";
  this.grafisch_eenheden = false;   // units in the diagram and a field Eenheid in the forms
  this.dom_grafisch_eenheden = "#grafisch_eenheden";
  this.dom_download_grafisch = "#download_grafisch";
  this.dom_grafisch_reset = "#grafisch_herstel";
  this.dom_grafisch_form = "#grafisch_eigenschappen";
  this.dom_grafisch_melding = "#grafisch_melding";
  this.grafisch_selected = undefined;   // id of the selected element
  this.grafisch_moved = {};   // positions of elements dragged by the user
  this.model_title = '';
  this.units = {};   // name --> unit, from the comments of the model (eenheden.js)

  this.read_model();
  this.fill_functies();

  function run_from_keyboard() {
    $(self.dom_run).click();
  }

  if ((this.CodeMirror) && (typeof(CodeMirror) == 'function')) {
    var codemirror_options = {
      lineNumbers: true,
      gutters: ['CodeMirror-linenumbers', 'mt-error-markers'],
      lineWrapping: true,
      viewportMargin: Infinity,
      mode: "modelleertaal",
      extraKeys: {
        "Ctrl-Enter": run_from_keyboard,
        "Cmd-Enter": run_from_keyboard
      }
    };
    this.modelregels_editor = CodeMirror.fromTextArea($(this.dom_modelregels)[0], codemirror_options);
    this.startwaarden_editor = CodeMirror.fromTextArea($(this.dom_startwaarden)[0], codemirror_options);
    this.CodeMirrorActive = true;

    var on_change = function(editor, change) {
      if (change.origin != 'setValue') self.on_model_edited();
    };
    this.modelregels_editor.on('change', on_change);
    this.startwaarden_editor.on('change', on_change);

    // the symbol of the line with the cursor lights up in the diagram
    var on_cursor = function(editor) {
      self.grafisch_link_cursor(editor);
    };
    [this.modelregels_editor, this.startwaarden_editor].forEach(function(editor) {
      editor.on('cursorActivity', on_cursor);
      editor.on('focus', on_cursor);
      editor.on('blur', on_cursor);
    });
  } else {
    this.CodeMirror = false;
    this.CodeMirrorActive = false;
    $(this.dom_modelregels + ',' + this.dom_startwaarden).on('input', function() {
      self.on_model_edited();
    });
  }

  $(document).on('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key == 'Enter' && !event.isDefaultPrevented()) {
      event.preventDefault();
      run_from_keyboard();
    }
  });

  // (re)set the app
  this.load_settings();
  this.starting = true;
  this.init_app();
  this.starting = false;
  // after the first model is loaded: offer to continue with unsaved work
  this.restore_check = true;
  this.load_model();

  // Rondleiding: only with the button at the top, never automatically
  this.rondleiding = new rondleiding.Rondleiding(this);
  this.rondleiding.knop('#rondleiding_knop');

  $(this.dom_run).click(function() {
    // count model run as pageview to #run in goatcounter
    if (window.goatcounter !== undefined && window.goatcounter.count) {
      window.goatcounter.count({
        path: location.pathname + '#run',
      });
    }
    self.run();
  });

  $(this.dom_step).click(function() {
    self.step();
  });

  $(this.dom_nbox).on('keydown', function(event) {
    if (event.key == 'Enter') {
      event.preventDefault();
      $(self.dom_run).click();
    }
  });

  // Houd vast: keep the gray line of a run as a reference
  $(this.dom_graph_note).on('click', 'button.pin', function() {
    self.pinned = !self.pinned;
    self.do_plot();
  });

  $(this.dom_nbox).on('input', function() {
    self.update_endtime_hint(false);
    self.schedule_autosave();
  });

  // first menu: another groep shows its models. A model is loaded when it is chosen in the second menu.
  $(this.dom_model_groep).change(function() {
    self.dropdown_fill($(this).val());
  });

  $(this.dom_model_keuze).change(function() {
    if ($(this).val() === '') return;   // "Kies een model..."
    if (self.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
        'Als je een ander model kiest, gaan je wijzigingen verloren.\n\nAnder model laden?')) {
      self.dropdown_fill(self.dropdown_groep);
      return;
    }
    self.dropdown_load_model();
  });

  $(window).on('hashchange', function() {
    // user opens another link (#model=...) in the same tab. Changed model: ask first, as with the menu.
    var url_params = self.parse_url_hash();
    if (!url_params.model && !url_params.code) return;
    if (self.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
        'Als je de nieuwe link opent, gaan je wijzigingen verloren.\n\nNieuwe link openen?')) return;
    self.load_model();
  });

  $(window).on('beforeunload', function(event) {
    if (self.autosave_timer) self.autosave();
    if (self.is_modified()) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  });

  $(this.dom_titel).on('input', function() {
    self.update_document_title();
    self.schedule_autosave();
  });

  // Opdracht bij dit model (Meer opties): shown above the model, goes into Deel link
  $(this.dom_opdracht_invoer).on('input', function() {
    self.set_opdracht($(this).val(), false);
    self.schedule_autosave();
  });

  $(this.dom_permalink).click(function(event) {
    event.preventDefault();
    self.copy_share_url();
  });

  $(this.dom_download_xml).click(function() {
    self.download_model();
  });
  $(this.dom_download_pgf).click(function() {
    self.download_pgfplot();
  });
  $(this.dom_download_tsv).click(function() {
    self.download_tsv();
  });
  $(this.dom_download_svg).click(function() {
    self.download_svg();
  });
  $(this.dom_download_png).click(function() {
    self.download_png();
  });

  // Meer opties: applied when the value changes (no separate button)
  $(this.dom_precision).on('change', function() {
    self.set_precision($(this).val());
  });
  $(this.dom_max_rows).on('change', function() {
    self.set_max_rows_in_plot($(this).val());
  });

  // Tekst | Tekst + grafisch. The diagram is drawn from the text of the model (no Run needed)
  $(this.dom_view_switch).on('click', 'button', function() {
    self.set_weergave($(this).attr('data-weergave'), true);
  });
  // Examen | Kleur: style of the diagram
  $('.stijl_switch').on('click', 'button', function() {
    self.set_grafisch_stijl($(this).attr('data-stijl'), true);
  });
  // Formules: a box with the formula or beginwaarde next to every symbol
  $(this.dom_grafisch_eenheden).on('change', function() {
    self.set_grafisch_eenheden($(this).prop('checked'), true);
  });
  $(this.dom_grafisch_formules).on('change', function() {
    self.set_grafisch_formules($(this).prop('checked'), true);
  });
  // Herkende elementen: a click on a row selects the element in the diagram
  $(this.dom_grafisch_tabel).on('click', 'tr[data-id]', function() {
    self.grafisch_focus = true;
    self.grafisch_select($(this).attr('data-id'));
  });
  // + on the selected toestandsvariabele: new flow in or out
  $(this.dom_grafisch_svg).on('click', '[data-action]', function() {
    self.grafisch_flow_form($(this).attr('data-stock'), $(this).attr('data-action') == 'flow-in' ? 'in' : 'out');
  });
  $(this.dom_download_grafisch).click(function() {
    self.download_grafisch_model();
  });
  $(this.dom_grafisch_reset).click(function() {
    self.grafisch_moved = {};
    self.draw_grafisch_model();
    self.schedule_autosave();
  });

  // drag elements of the grafisch model. Arrows and pipes are drawn again from the new positions.
  var drag = null, frame = null;
  $(this.dom_grafisch_svg).on('pointerdown', '[data-id]', function(event) {
    var e = event.originalEvent;
    if (e.button !== 0 || !self.grafisch_layout) return;
    var id = $(this).attr('data-id');
    var pos = self.grafisch_layout.pos;
    if (!pos[id]) return;
    var m = self.grafisch_point(e);
    // a toestandsvariabele takes its flows to and from a cloud along (pipe stays straight)
    var ids = [id];
    if (self.grafisch_g.elements[id] && self.grafisch_g.elements[id].kind == 'stock') {
      self.grafisch_g.flows.forEach(function(f) {
        if (f.to == id && !f.from) ids.push(f.id, f.id + ':src');
        if (f.from == id && !f.to) ids.push(f.id, f.id + ':dst');
      });
    }
    drag = {id: id, moved: false, ids: ids, x: m.x, y: m.y,
            start: ids.map(function(k) { return {x: pos[k].x, y: pos[k].y}; })};
    e.preventDefault();
  });
  $(window).on('pointermove', function(event) {
    if (!drag) return;
    var m = self.grafisch_point(event.originalEvent);
    var pos = self.grafisch_layout.pos;
    // a small movement is a click (select), not a drag
    if (!drag.moved && Math.abs(m.x - drag.x) + Math.abs(m.y - drag.y) < 4) return;
    drag.moved = true;
    drag.ids.forEach(function(k, n) {
      pos[k].x = Math.round(drag.start[n].x + m.x - drag.x);
      pos[k].y = Math.round(drag.start[n].y + m.y - drag.y);
      self.grafisch_moved[k] = {x: pos[k].x, y: pos[k].y};
    });
    if (!frame) {
      frame = window.requestAnimationFrame(function() {
        frame = null;
        self.render_grafisch_model();
      });
    }
  });
  $(window).on('pointerup pointercancel', function(event) {
    if (drag && !drag.moved && event.type == 'pointerup') {
      // click: select the element (a cloud: its flow) and show its properties
      self.grafisch_select(drag.id.replace(/:(src|dst)$/, ''));
    }
    // the new layout is kept (autosave, Bewaar, Deel link)
    if (drag && drag.moved) self.schedule_autosave();
    drag = null;
  });

  // drag the background: move the view (pan). Click on the background: nothing selected.
  // (touch: the browser scrolls the view itself)
  var pan = null;
  $(this.dom_grafisch_svg).on('pointerdown', function(event) {
    var e = event.originalEvent;
    self.grafisch_focus = true;
    if (e.button !== 0 || $(e.target).closest('[data-id], [data-action]').length) return;
    // not on the scrollbars
    var box = this.getBoundingClientRect();
    if (e.clientX > box.left + this.clientWidth || e.clientY > box.top + this.clientHeight) return;
    pan = {x: e.clientX, y: e.clientY, left: this.scrollLeft, top: this.scrollTop, moved: false,
           mouse: e.pointerType == 'mouse'};
    if (pan.mouse) e.preventDefault();
  });
  $(window).on('pointermove', function(event) {
    if (!pan) return;
    var e = event.originalEvent;
    if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 4) pan.moved = true;
    if (pan.mouse && pan.moved) {
      $(self.dom_grafisch_svg).scrollLeft(pan.left - (e.clientX - pan.x)).scrollTop(pan.top - (e.clientY - pan.y));
    }
  });
  $(window).on('pointerup pointercancel', function(event) {
    if (pan && !pan.moved && event.type == 'pointerup') {
      self.grafisch_form_new = false;
      self.grafisch_select(undefined);
    }
    pan = null;
  });
  $(this.dom_grafisch_svg).on('scroll', function() {
    self.grafisch_place_form();
  });
  $(window).on('resize', function() {
    if (self.grafisch_open() && self.grafisch_g) self.render_grafisch_model();
  });

  // zoom: buttons, and ctrl + mouse wheel (or pinch on a trackpad) on the diagram
  $('#grafisch_zoom_in').click(function() { self.grafisch_set_zoom(self.grafisch_zoom_now * 1.25); });
  $('#grafisch_zoom_uit').click(function() { self.grafisch_set_zoom(self.grafisch_zoom_now / 1.25); });
  $('#grafisch_zoom_passend').click(function() { self.grafisch_set_zoom(null); });
  var view = $(this.dom_grafisch_svg)[0];
  if (view && view.addEventListener) {
    view.addEventListener('wheel', function(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      self.grafisch_set_zoom(self.grafisch_zoom_now * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e);
    }, {passive: false});

    // touch screen: pinch with two fingers to zoom (one finger scrolls, as usual)
    var pinch = null, pinch_frame = null;
    var two_fingers = function(e) {
      var a = e.touches[0], b = e.touches[1];
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return {d: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
              clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2};
    };
    view.addEventListener('touchstart', function(e) {
      if (e.touches.length != 2 || !self.grafisch_g) return;
      e.preventDefault();
      drag = null;
      pan = null;
      pinch = {start: two_fingers(e), zoom: self.grafisch_zoom_now || 1};
    }, {passive: false});
    view.addEventListener('touchmove', function(e) {
      if (!pinch || e.touches.length != 2) return;
      e.preventDefault();
      pinch.now = two_fingers(e);
      if (pinch_frame) return;
      pinch_frame = window.requestAnimationFrame(function() {
        pinch_frame = null;
        if (pinch && pinch.now) self.grafisch_set_zoom(pinch.zoom * pinch.now.d / pinch.start.d, pinch.now);
      });
    }, {passive: false});
    view.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) pinch = null;
    });
  }

  // keys: Delete removes the selected element, Escape closes the form
  $(document).on('pointerdown', function(event) {
    if (!$(event.target).closest(self.dom_grafisch).length) self.grafisch_focus = false;
  });
  $(document).on('keydown', function(event) {
    // the focus in the diagram or its form also counts (after a click on a button of the toolbar)
    var inside = $(event.target).closest(self.dom_grafisch).length > 0;
    if (!(self.grafisch_focus || inside) || !self.grafisch_open()) return;
    var typing = $(event.target).closest('input, textarea, select, .CodeMirror').length > 0;
    if (event.key == 'Escape') {
      self.grafisch_form_new = false;
      self.grafisch_select(undefined);
    } else if ((event.key == 'Delete' || event.key == 'Backspace') && !typing && self.grafisch_selected !== undefined) {
      event.preventDefault();
      self.grafisch_apply([{op: 'remove', id: self.grafisch_selected}], undefined);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == 'z' && !typing) {
      event.preventDefault();
      self.grafisch_undo();
    }
  });
  $('#grafisch_undo').click(function() { self.grafisch_undo(); });

  // grafisch model as input: new elements
  $('#grafisch_nieuw_toestand').click(function() { self.grafisch_new_form('stock'); });
  $('#grafisch_nieuw_hulp').click(function() { self.grafisch_new_form('aux'); });
  $('#grafisch_nieuw_constante').click(function() { self.grafisch_new_form('const'); });
  $('#grafisch_nieuw_voorwaarde').click(function() { self.grafisch_new_form('event'); });
  $('#grafisch_nieuw_model').click(function() { self.new_empty_model(); });
  // the unit of dt (with the toggle eenheden)
  $('#grafisch_dt_eenheid').on('change', function() {
    var dt = self.grafisch_g ? self.grafisch_g.dt : 'dt';
    if (!self.grafisch_apply([{op: 'setUnit', name: dt, unit: $(this).val()}], self.grafisch_selected, {noform: self.grafisch_noform})) {
      $(this).addClass('invalid');
    }
  }).on('input', function() { $(this).removeClass('invalid'); })
    .on('keydown', function(event) { if (event.key == 'Enter') { event.preventDefault(); $(this).trigger('change'); } });
  // Tab takes over the derived unit (not the word 'eenheid')
  grafisch_accept_on_tab($('#grafisch_dt_eenheid'), function(text) { return text != 'eenheid'; });
  // dt: the startwaarde of the time step
  $('#grafisch_dt').on('change', function() {
    var text = $.trim($(this).val());
    if (text === '') return self.grafisch_show_dt();
    if (!self.grafisch_apply([{op: 'setDt', text: text}], self.grafisch_selected, {noform: self.grafisch_noform})) {
      $(this).addClass('invalid');
    }
  }).on('input', function() { $(this).removeClass('invalid'); })
    .on('keydown', function(event) { if (event.key == 'Enter') { event.preventDefault(); $(this).trigger('change'); } });

  $(this.dom_fileinput).change(function(event) {
    self.read_file(event);
  });

  //
  // graph controls
  //
  $(this.dom_x_var).change(function() {
    self.xvar = $(this).val();
    self.user_axes = true;
    self.do_plot();
  });

  $(this.dom_y_var).change(function() {
    self.yvar = $(this).val();
    self.user_axes = true;
    self.do_plot();
  });

  $(this.dom_y_checks).on('change', 'input', function() {
    self.multi_yvars = $(self.dom_y_checks).find('input:checked').map(function() {
      return $(this).val();
    }).get();
    self.do_plot();
  });

  $(this.dom_multiplot).change(function() {
    self.multiplot = $(this).prop('checked');
    if (self.multiplot && self.multi_yvars.indexOf(self.yvar) == -1) {
      self.multi_yvars.push(self.yvar);
    }
    self.update_axis_controls();
    self.do_plot();
  });

  $(this.dom_yaxis_zero).change(function() {
    self.yaxis_autoscale = !$(this).prop('checked');
    self.save_settings();
    self.do_plot();
  });

  $(this.dom_graph_tabs).on('click', 'button', function() {
    var graph = self.graphs[$(this).data('index')];
    if (!graph) return;
    self.xvar = graph.x;
    self.yvar = graph.y;
    self.user_axes = true;
    self.multiplot = false;
    self.update_axis_controls();
    self.do_plot();
  });

  // Aflezen: a click on a point shows it with lines to the axes, and its row in the table.
  // A click next to the graph line removes it.
  // Inzoomen: drag a rectangle in the graph. Double click or Hele grafiek: back.
  // Not on a touch screen (dragging there scrolls the page).
  this.zoom_enabled = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  this.zoom = null;
  var zoom_drag = null;
  $(this.dom_graph).on('mousedown', function(event) {
    if (!self.zoom_enabled || event.button !== 0 || !self.plot_object || !self.results_available()) return;
    var p = self.zoom_position(event);
    if (!p.inside) return;
    zoom_drag = {x0: p.x, y0: p.y, x1: p.x, y1: p.y, box: null};
    event.preventDefault();
  });
  $(window).on('mousemove', function(event) {
    if (!zoom_drag) return;
    var p = self.zoom_position(event);
    zoom_drag.x1 = p.x;
    zoom_drag.y1 = p.y;
    if (!zoom_drag.box && Math.abs(p.x - zoom_drag.x0) + Math.abs(p.y - zoom_drag.y0) < 6) return;
    if (!zoom_drag.box) zoom_drag.box = $('<div class="zoom_box">').appendTo(self.dom_graph);
    var off = self.plot_object.getPlotOffset();
    zoom_drag.box.css({
      left: off.left + Math.min(zoom_drag.x0, p.x) + 'px',
      top: off.top + Math.min(zoom_drag.y0, p.y) + 'px',
      width: Math.abs(p.x - zoom_drag.x0) + 'px',
      height: Math.abs(p.y - zoom_drag.y0) + 'px'
    });
  });
  $(window).on('mouseup', function() {
    if (!zoom_drag) return;
    var d = zoom_drag;
    zoom_drag = null;
    if (!d.box) return;   // a click, not a rectangle
    d.box.remove();
    if (Math.abs(d.x1 - d.x0) < 6 || Math.abs(d.y1 - d.y0) < 6) return;
    var ranges = {};
    $.each(self.plot_object.getAxes(), function(name, axis) {
      if (!axis.used) return;
      var a = axis.c2p(axis.direction == 'x' ? d.x0 : d.y0), b = axis.c2p(axis.direction == 'x' ? d.x1 : d.y1);
      ranges[name] = {from: Math.min(a, b), to: Math.max(a, b)};
    });
    self.zoom = {key: self.zoom_key(), ranges: ranges};
    self.zoom_time = Date.now();
    self.do_plot();
  });
  $(this.dom_graph).on('dblclick', function() {
    self.set_zoom(null);
  });
  $(this.dom_zoom_reset).click(function() {
    self.set_zoom(null);
  });

  $(this.dom_graph).on("plotclick", function(event, pos, item) {
    // the end of dragging a rectangle (zoom) is not a click. Stap voor stap: no reading off.
    if (self.zoom_time && Date.now() - self.zoom_time < 400) return;
    if (self.stepper) return;
    if (self.read && self.near_tangent(pos)) {
      self.set_read($.extend({}, self.read, {tangent: !self.read.tangent}));
      return;
    }
    if (item && item.series.mt_read) return;
    if (!item || item.series.mt_previous || !item.series.mt_yvar) {
      self.set_read(null);
      return;
    }
    var row = self.get_result_rowIndex(item.dataIndex, item.series.data.length);
    var same = self.read && self.read.row == row && self.read.yvar == item.series.mt_yvar;
    self.set_read(same ? null : {row: row, yvar: item.series.mt_yvar});
  });

  $(this.dom_graph).on("plothover", function(event, pos) {
    $(this).toggleClass('over_tangent', Boolean(self.read && self.near_tangent(pos)));
  });

  // and the other way around: a click on a row of the table puts the point in the graph
  $(this.dom_datatable).on('click', 'tbody tr[data-row]', function() {
    if (self.stepper || !self.results_available()) return;
    var row = Number($(this).attr('data-row'));
    var yvar = self.yvar;
    if (self.multiplot) {
      yvar = (self.read && self.multi_yvars.indexOf(self.read.yvar) != -1) ? self.read.yvar : self.multi_yvars[0];
    }
    if (!yvar) return;
    self.set_read((self.read && self.read.row == row) ? null : {row: row, yvar: yvar});
  });

  var resize_timer;
  $(window).on('resize', function() {
    clearTimeout(resize_timer);
    resize_timer = setTimeout(function() {
      if (self.results_available()) self.do_plot();
    }, 150);
  });
}


//
// Loading / saving models
//
ModelleertaalApp.prototype.parse_url_hash = function() {
  // index.html#model=model_naam&N=100 or index.html#code=... (Deel link, see deellink.js)
  return deellink.parse_hash(window.location.hash);
};


ModelleertaalApp.prototype.load_model = function() {

  var url_params = this.parse_url_hash();
  if (this.debug) console.log("params passed in URL", url_params);

  // N in the link (#model=...&N=100) wins over N in the model file, for the model of the link
  this.url_N = undefined;
  if (url_params.N && isFinite(Number(url_params.N)) && Number(url_params.N) >= 1) {
    this.N_default = Number(url_params.N);
    this.url_N = Number(url_params.N);
  }
  $(this.dom_nbox).val(this.N_default);

  this.dropdown_update();

  if (url_params.code !== undefined) {
    // complete model in URL (made with "Deel link"). All versions of the link: see deellink.js
    try {
      var shared = deellink.decode(url_params.code);
      this.model = new evaluator_js.Model();
      this.model.modelregels = shared.modelregels;
      this.model.startwaarden = shared.startwaarden;
      if (shared.N) this.model.N = shared.N;
      this.model.opdracht = shared.opdracht;
      this.model.indeling = JSON.stringify(shared.indeling);
      this.model_title = shared.title || 'Gedeeld model';
      this.dropdown_extra('shared', this.model_title + ' (uit link)');
      this.init_app();
      return;
    } catch (err) {
      // show why, after the first model of the list is loaded (init_app clears messages)
      console.error('Kan model uit link niet lezen', err);
      this.link_error = err.deellink ? err.message : 'Het model in deze link kan niet gelezen worden.';
    }
  }

  if (url_params.model) {
    // try to load model passed with model=... parameter
    var model_url = 'modellen/' + url_params.model + '.xml';
    var index = modelkeuze.zoek_url(this.model_index, model_url);
    if (index != -1) {
      // set dropdowns (groep and model) to selected model
      this.dropdown_select(index);
      this.model_title = this.model_index[index].title;
    } else {
      this.model_title = url_params.model;
    }
    this.load_model_xml_from_url(model_url);
  } else {
    // lees keuze uit drop-down en kies juiste url
    this.dropdown_load_model();
  }
};


ModelleertaalApp.prototype.print_status = function(status) {
  $(this.dom_status).text(status);
};


ModelleertaalApp.prototype.show_message = function(type, title, text, buttons) {
  // type: 'error', 'warning' or 'info'. buttons (optional): [{text, action}]
  var box = $(this.dom_message).removeClass('error warning info').addClass(type).empty()
    .append($('<strong>').text(title))
    .append($('<span>').text(text));
  (buttons || []).forEach(function(b) {
    box.append($('<button type="button">').addClass('inline_action').text(b.text).click(b.action));
  });
  box.show();
};


ModelleertaalApp.prototype.clear_message = function() {
  $(this.dom_message).hide().empty();
};


ModelleertaalApp.prototype.load_model_xml_from_url = function(url) {
  var self = this;
  $.ajax({
    url: url,
    dataType: "text",
    success: function(data) {
      self.read_model_from_xml(data);
      self.init_app();
    },
    error: function(xhr) {
      var text = "Het model '" + url + "' kan niet geladen worden.";
      if (xhr.status === 0 && window.location.protocol == 'file:') {
        text += " Open de webapp via een webserver (bijvoorbeeld: python -m http.server).";
      } else if (xhr.status == 404) {
        text += " Het bestand bestaat niet.";
      }
      self.show_message('error', 'Model niet geladen', text);
      self.print_status("Model niet geladen.");
    }
  });
};


ModelleertaalApp.prototype.dropdown_update = function() {
  // maak de keuzemenu's uit models.js: verzameling (groep) en model (see modelkeuze.js)
  var groepen = modelkeuze.groepen(this.model_index);
  var groep_menu = $(this.dom_model_groep).empty();
  groepen.forEach(function(groep) {
    $('<option/>').val(groep).text(groep).appendTo(groep_menu);
  });
  // only one groep: no need to choose
  groep_menu.toggle(groepen.length > 1);

  var entry = this.model_index[this.dropdown_value];
  var groep = entry ? modelkeuze.groep_van(entry) : (this.dropdown_groep || groepen[0]);
  this.dropdown_fill(groep, this.dropdown_value === undefined);
};


ModelleertaalApp.prototype.dropdown_fill = function(groep, select_first) {
  // fill the model menu with the models of one groep, with a heading (optgroup) per sectie.
  // The current model is selected. If it is not in this groep: "Kies een model"
  // (or the first model, select_first).
  var self = this;
  var menu = $(this.dom_model_keuze).empty();
  this.dropdown_groep = groep;
  $(this.dom_model_groep).val(groep);

  modelkeuze.secties(this.model_index, groep).forEach(function(s) {
    var parent = s.sectie ? $('<optgroup/>').attr('label', s.sectie).appendTo(menu) : menu;
    s.modellen.forEach(function(m) {
      $('<option/>').val(m.index).text(m.title).appendTo(parent);
    });
  });

  var current = String(this.dropdown_value);
  if (menu.find('option').filter(function() { return this.value === current; }).length) {
    menu.val(current);
  } else if (this.dropdown_extra_option && this.dropdown_extra_option.value === current) {
    // a model from a link or the browser (not in models.js)
    $('<option/>').val(current).text(this.dropdown_extra_option.text).prependTo(menu);
    menu.val(current);
  } else if (select_first) {
    menu.prop('selectedIndex', 0);
  } else {
    $('<option/>').val('').text('Kies een model…').prependTo(menu);
    menu.val('');
  }
};


ModelleertaalApp.prototype.dropdown_select = function(index) {
  // show model index in the menus (its groep in the first menu)
  this.dropdown_value = String(index);
  this.dropdown_fill(modelkeuze.groep_van(this.model_index[index]));
};


ModelleertaalApp.prototype.dropdown_extra = function(value, text) {
  // a model that is not in models.js ('shared': from a link, 'restored': from the browser)
  this.dropdown_extra_option = {value: value, text: text};
  this.dropdown_value = value;
  this.dropdown_fill(this.dropdown_groep || modelkeuze.groepen(this.model_index)[0]);
};


ModelleertaalApp.prototype.model_name_from_url = function(url) {
  // modellen/naam.xml --> naam, modellen/c2/naam.xml --> c2/naam
  return modelkeuze.naam_van_url(url);
};


ModelleertaalApp.prototype.dropdown_load_model = function() {

  var model_keuze = $(this.dom_model_keuze).val();
  if (!this.model_index[model_keuze]) return;
  this.dropdown_value = model_keuze;
  this.dropdown_fill(this.dropdown_groep);   // without "Kies een model..."

  var url = this.model_index[model_keuze].url;
  var name = this.model_name_from_url(url);
  this.model_title = this.model_index[model_keuze].title;

  // verander de URL in de browser (history)
  if (name && window.history.replaceState) {
    window.history.replaceState("", "Modelleertaal webapp", '#model=' + name);
  }

  // count model reload as pageview in goatcounter
  if (window.goatcounter !== undefined && window.goatcounter.count) {
    window.goatcounter.count({
      path: location.pathname,
    });
  }
  this.load_model_xml_from_url(url);
};


ModelleertaalApp.prototype.new_empty_model = function() {
  // Nieuw model (above the diagram): Basismodellen -> Leeg model, also when that is already chosen.
  // Changed model: ask first, as with the menu
  var index = null;
  // the same file is also in other groups ("0 Leeg model"): the first one is Basismodellen
  for (var i = 0; i < this.model_index.length && index === null; i++) {
    if (/(^|\/)leeg\.xml$/.test(this.model_index[i].url)) index = i;
  }
  if (index === null) return;
  if (this.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
      'Als je opnieuw begint, gaan je wijzigingen verloren.\n\nNieuw leeg model?')) return;
  this.dropdown_select(index);
  $(this.dom_model_keuze).val(String(index));
  this.grafisch_history = [];
  $('#grafisch_undo').prop('disabled', true);
  this.dropdown_load_model();
};


ModelleertaalApp.prototype.read_model = function() {
  // read model from textarea/CodeMirror. The <grafisch> section of the loaded file stays
  var grafisch = this.model ? this.model.grafisch : undefined;
  this.model = new evaluator_js.Model();
  if (grafisch) this.model.grafisch = grafisch;
  this.model.opdracht = this.opdracht;
  this.model.indeling = this.indeling_text();
  if (this.CodeMirrorActive) {
    this.model.modelregels = this.modelregels_editor.getValue();
    this.model.startwaarden = this.startwaarden_editor.getValue();
  } else {
    this.model.modelregels = $(this.dom_modelregels).val();
    this.model.startwaarden = $(this.dom_startwaarden).val();
  }
};


ModelleertaalApp.prototype.current_text = function() {
  // the text in the editors: {modelregels, startwaarden}
  if (this.CodeMirrorActive) {
    return {modelregels: this.modelregels_editor.getValue(),
            startwaarden: this.startwaarden_editor.getValue()};
  }
  return {modelregels: $(this.dom_modelregels).val(), startwaarden: $(this.dom_startwaarden).val()};
};


ModelleertaalApp.prototype.is_modified = function() {
  // has the user changed the model since it was loaded (or saved)?
  if (!this.loaded) return false;
  var current = this.current_text();
  function normalize(s) {
    return String(s).replace(/\r/g, '').replace(/\s+$/, '');
  }
  return normalize(current.modelregels) != normalize(this.loaded.modelregels) ||
         normalize(current.startwaarden) != normalize(this.loaded.startwaarden) ||
         normalize(this.opdracht) != normalize(this.loaded.opdracht || '') ||
         this.indeling_text() != (this.loaded.indeling || '');
};


ModelleertaalApp.prototype.indeling_text = function() {
  // the positions of the dragged symbols as JSON ({"id": [x, y]}), '' if none
  var out = {}, any = false;
  for (var id in this.grafisch_moved) {
    if (this.grafisch_moved.hasOwnProperty(id)) {
      out[id] = [this.grafisch_moved[id].x, this.grafisch_moved[id].y];
      any = true;
    }
  }
  return any ? JSON.stringify(out) : '';
};


ModelleertaalApp.prototype.set_indeling = function(text) {
  // positions from a file, link or autosave (see indeling_text)
  var parsed = {};
  try {
    parsed = deellink.positions(typeof text == 'string' ? (text ? JSON.parse(text) : {}) : text);
  } catch (err) {
    parsed = {};
  }
  this.grafisch_moved = {};
  for (var id in parsed) {
    if (parsed.hasOwnProperty(id)) this.grafisch_moved[id] = {x: parsed[id][0], y: parsed[id][1]};
  }
};


ModelleertaalApp.prototype.set_opdracht = function(text, update_input) {
  // the assignment above the model. Empty: no card.
  this.opdracht = String(text || '').replace(/\s+$/, '');
  $(this.dom_opdracht_tekst).text(this.opdracht);
  $(this.dom_opdracht).prop('hidden', !this.opdracht);
  if (update_input) $(this.dom_opdracht_invoer).val(this.opdracht);
};


ModelleertaalApp.prototype.on_model_edited = function() {
  // called on every change in the editors.
  var self = this;
  this.remove_highlight_error();
  // an error of the last Run is about the old model
  if ($(this.dom_message).hasClass('error')) this.clear_message();
  // typing ends Stap voor stap
  if (this.stepper) this.end_stepping();
  clearTimeout(this.hint_timer);
  this.hint_timer = setTimeout(function() { self.update_endtime_hint(true); }, 300);
  // 1 s after the last key: check the syntax, quietly (a red dot next to the line)
  clearTimeout(this.lint_timer);
  this.lint_timer = setTimeout(function() { self.silent_check(); }, 1000);
  this.schedule_autosave();
  if (this.grafisch_open()) {
    clearTimeout(this.grafisch_timer);
    this.grafisch_timer = setTimeout(function() { self.draw_grafisch_model(); }, 400);
  }
  if (this.results_available() && !this.stale) {
    this.set_stale(true);
    this.print_status("Model gewijzigd. Druk op Run.");
  }
};


ModelleertaalApp.prototype.silent_check = function() {
  // only parse the model. A syntax error: a red dot in the line numbers, with the message
  // as title. No message bar and the cursor does not move: the full message comes with Run.
  this.remove_lint();
  if (!this.CodeMirrorActive) return;
  var model = new evaluator_js.Model();
  var text = this.current_text();
  model.startwaarden = text.startwaarden;
  model.modelregels = text.modelregels;
  try {
    // jshint nonew:false
    new evaluator_js.ModelregelsEvaluator(model, false);
  } catch (err) {
    // ... (to be filled in) or an empty model is not an error
    if (err.blank || err.empty) return;
    var editor = this.get_editor(err.parser_name);
    var line = err.parser_line;
    if (!editor || !line || line < 1) return;
    line = Math.min(line, editor.lineCount());
    var marker = $('<span class="mt-lint-marker" role="img">').text('\u25cf')
      .attr({'title': err.message || 'Fout in deze regel', 'aria-label': err.message || 'Fout in deze regel'});
    this.lint = {editor: editor, handle: editor.setGutterMarker(line - 1, 'mt-error-markers', marker[0])};
  }
};


ModelleertaalApp.prototype.remove_lint = function() {
  if (!this.lint) return;
  this.lint.editor.setGutterMarker(this.lint.handle, 'mt-error-markers', null);
  this.lint = undefined;
};


ModelleertaalApp.prototype.constant_values = function(names) {
  // values of startwaarden that stay constant (they are not in the table): name --> value
  var out = {};
  names = (names || []).filter(function(name) { return /^[^\s=]+$/.test(name); });
  if (!names.length) return out;
  var model = new evaluator_js.Model();
  model.startwaarden = this.model.startwaarden;
  model.modelregels = names.map(function(name) { return name + ' = ' + name; }).join('\n');
  try {
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(0, true, false);
    evaluator.run();
    var varNames = evaluator.namespace.varNames;
    names.forEach(function(name) {
      var j = varNames.indexOf(name);
      if (j != -1) out[name] = evaluator.result[0][j];
    });
  } catch (err) {
    // no values: the general message
  }
  return out;
};


ModelleertaalApp.prototype.read_dt = function() {
  // the value of dt from the startwaarden, without running the model. null if unknown.
  var model = new evaluator_js.Model();
  model.startwaarden = this.current_text().startwaarden;
  model.modelregels = 'dt = dt';
  try {
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(0, true, false);
    evaluator.run();
    var dt = evaluator.result[0][evaluator.namespace.varNames.indexOf('dt')];
    return (typeof dt == 'number' && isFinite(dt) && dt > 0) ? dt : null;
  } catch (err) {
    // syntax error, ... or no dt in the startwaarden: no hint
    return null;
  }
};


ModelleertaalApp.prototype.update_endtime_hint = function(model_changed) {
  // next to the number of iterations: N x dt (how long the model runs)
  if (model_changed || this.hint_dt === undefined) this.hint_dt = this.read_dt();
  var N = Number(String($(this.dom_nbox).val()).replace(',', '.'));
  var text = '';
  if (this.hint_dt !== null && isFinite(N) && N >= 1) {
    text = '× dt = ' + Number((Math.round(N) * this.hint_dt).toPrecision(this.precision));
    // with the unit of dt, if the model has one: × dt = 50 s
    var text_now = this.current_text();
    var unit = eenheden.units(text_now.startwaarden, text_now.modelregels).dt;
    if (unit) text += ' ' + unit;
  }
  $(this.dom_endtime_hint).text(text);
};


ModelleertaalApp.prototype.grafisch_open = function() {
  // is the diagram shown? (Tekst + grafisch)
  return this.weergave == 'grafisch';
};


ModelleertaalApp.prototype.set_grafisch_stijl = function(stijl, save) {
  // 'examen': black and white, as in the exams. 'kleur': in color.
  this.grafisch_stijl = (stijl == 'kleur') ? 'kleur' : 'examen';
  var now = this.grafisch_stijl;
  $('.stijl_switch button').each(function() {
    $(this).attr('aria-pressed', String($(this).attr('data-stijl') == now));
  });
  $('.grafisch_strook').each(function() {
    $(this).prop('hidden', $(this).attr('data-stijl') != now);
  });
  $(this.dom_grafisch_svg).attr('data-stijl', now);
  // the exam style leaves out some elements (formulas in the startwaarden): a new layout
  if (this.grafisch_open() && this.grafisch_g) this.draw_grafisch_model();
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.set_grafisch_eenheden = function(on, save) {
  // units: after the names in the diagram, and a field Eenheid in the forms
  this.grafisch_eenheden = !!on;
  $(this.dom_grafisch_eenheden).prop('checked', this.grafisch_eenheden);
  $('#grafisch_dt_eenheid').prop('hidden', !this.grafisch_eenheden);
  if (this.grafisch_open() && this.grafisch_g) {
    this.grafisch_form_new = false;
    this.draw_grafisch_model();
  }
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.grafisch_unit = function(name) {
  // {explicit: unit in the text or '', derived: unit from the formulas or '', conflict: text or ''}
  var u = this.grafisch_units || {units: {}, explicit: {}, derived: {}, conflicts: {}};
  var has = function(o) { return !!name && o.hasOwnProperty(name); };
  return {explicit: has(u.explicit) ? u.explicit[name] : '',
          derived: has(u.derived) ? u.units[name] : '',
          conflict: has(u.conflicts) ? u.conflicts[name] : ''};
};


ModelleertaalApp.prototype.grafisch_unit_field = function(name, example) {
  // the field Eenheid (only with the toggle eenheden). The grey hint is the unit that follows
  // from the formulas (or an example): it is not taken over, an empty field means no unit
  if (!this.grafisch_eenheden) return [];
  var u = this.grafisch_unit(name);
  return [{key: 'unit', label: 'Eenheid', value: u.explicit, placeholder: u.derived || example || '', hint: true}];
};


ModelleertaalApp.prototype.grafisch_unit_ops = function(ops, name, v) {
  // ops for a new element: + its unit, and t and dt in s when they are made
  var self = this;
  if (this.grafisch_eenheden) {
    ops.forEach(function(op) { op.timeUnit = 's'; });
    if (v.unit !== undefined && $.trim(v.unit) !== '' && $.trim(v.unit) != self.grafisch_unit(name).explicit) {
      ops.push({op: 'setUnit', name: name, unit: v.unit});
    }
  }
  return ops;
};


ModelleertaalApp.prototype.set_grafisch_formules = function(on, save) {
  // the formulas next to the symbols, as in the exams 2015-I and 2016-I
  this.grafisch_formules = !!on;
  $(this.dom_grafisch_formules).prop('checked', this.grafisch_formules);
  // the boxes need more room: a new layout
  if (this.grafisch_open() && this.grafisch_g) this.draw_grafisch_model();
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.set_weergave = function(weergave, save) {
  // 'tekst': only the text. 'grafisch': the diagram above the text, in the same card.
  var self = this;
  this.weergave = (weergave == 'grafisch') ? 'grafisch' : 'tekst';
  $(this.dom_view_switch).find('button').each(function() {
    $(this).attr('aria-pressed', String($(this).attr('data-weergave') == self.weergave));
  });
  $(this.dom_grafisch).prop('hidden', this.weergave != 'grafisch');
  // the page layout changes: the model gets the whole width, the graph goes below it
  $(this.dom_workspace).toggleClass('met_grafisch', this.weergave == 'grafisch');
  if (this.grafisch_open()) {
    this.draw_grafisch_model();
  } else {
    this.grafisch_form_new = false;
    this.grafisch_select(undefined);
    this.grafisch_linked = undefined;
  }
  // the graph has another size now
  if (this.results_available()) {
    this.do_plot();
    this.draw_thumbnails();
  }
  if (save) {
    this.save_settings();
    // the view is kept with the unsaved work (see autosave)
    if (this.is_modified()) this.schedule_autosave();
  }
};


ModelleertaalApp.prototype.analyse_grafisch_model = function() {
  // grafisch.js analysis of the model in the editors. Throws on syntax errors.
  // Also: which lines of the text belong to which symbol (this.grafisch_lines)
  this.read_model();
  var ev = new evaluator_js.ModelregelsEvaluator(this.model, false);
  // <grafisch> in the model file: the arrows of the lines with ... (as in the exam figure)
  var g = grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast, {hints: this.model.grafisch});
  this.grafisch_lines = grafisch.lines(g, ev.startwaarden_ast, ev.modelregels_ast);
  this.grafisch_units = eenheden.derive(this.model.startwaarden, this.model.modelregels);
  return g;
};


ModelleertaalApp.prototype.draw_grafisch_model = function() {
  // draw the model as a stock-flow diagram, in the style of the exams or in color (see grafisch.js)
  var svg = $(this.dom_grafisch_svg);
  var g;
  try {
    g = this.analyse_grafisch_model();
  } catch (err) {
    svg.empty().append($('<div>').addClass('placeholder').text(err.empty ?
      'Nog geen model. Begin met een toestandsvariabele, zoals x (+ Toestandsvariabele). ' +
      'Klik daarna op een ? om die grootheid in te vullen. Of typ het model in de tekstvakken.' :
      'Geen grafisch model: ' + (err.message || 'fout in het model')));
    this.grafisch_g = undefined;
    this.grafisch_layout = undefined;
    this.grafisch_lines = undefined;
    $(this.dom_grafisch_tabel).empty();
    this.grafisch_select(undefined);
    this.grafisch_show_dt();
    return;
  }
  this.grafisch_g = g;
  this.grafisch_layout = grafisch.layout(g, {stijl: this.grafisch_stijl, formules: this.grafisch_formules});
  // keep the positions the user dragged (while editing the same model)
  var pos = this.grafisch_layout.pos;
  for (var id in this.grafisch_moved) {
    if (this.grafisch_moved.hasOwnProperty(id) && pos[id]) {
      pos[id].x = this.grafisch_moved[id].x;
      pos[id].y = this.grafisch_moved[id].y;
    }
  }
  this.grafisch_bounds = null;
  this.render_grafisch_model();
  // Herkende elementen: the same model as a list
  var table = $('<table>'), self = this;
  grafisch.table(g).forEach(function(row) {
    var unit = self.grafisch_eenheden && self.grafisch_units && self.grafisch_units.units.hasOwnProperty(row.name) ?
      ' (' + self.grafisch_units.units[row.name] + ')' : '';
    var tr = $('<tr>')
      .append($('<td>').text(row.kind))
      .append($('<td>').append($('<b>').text(row.name)).append(document.createTextNode(unit)))
      .append($('<td>').text(row.definition));
    if (row.id !== undefined) tr.attr('data-id', row.id).attr('title', 'Klik om ' + row.name + ' in het diagram te kiezen');
    table.append(tr);
  });
  $(this.dom_grafisch_tabel).empty().append(table);
  // the form of the selected element shows the new text of the model
  if (this.grafisch_selected !== undefined || !this.grafisch_form_new) {
    this.grafisch_select(this.grafisch_selected, {noform: this.grafisch_noform});
  }
  this.grafisch_show_dt();
};


ModelleertaalApp.prototype.grafisch_show_dt = function() {
  // the field dt = in the toolbar of the diagram
  var input = $('#grafisch_dt');
  if (!input.length || input.is(':focus')) return;
  var dt = null;
  try {
    this.read_model();
    dt = grafisch_edit.dtOf({startwaarden: this.model.startwaarden, modelregels: this.model.modelregels});
  } catch (err) {
    dt = null;
  }
  input.removeClass('invalid').val(dt && dt.text !== null ? dt.text : '')
    .attr('placeholder', dt ? '' : '?').prop('disabled', !dt);
  var u = this.grafisch_unit(dt ? dt.name : null), unit = $('#grafisch_dt_eenheid');
  if (!unit.is(':focus')) {
    unit.removeClass('invalid').val(u.explicit).attr('placeholder', u.derived || 'eenheid')
      .prop('disabled', !dt || dt.text === null).prop('hidden', !this.grafisch_eenheden);
  }
  $('#grafisch_dt_naam').text((dt ? dt.name : 'dt') + ' =');
};


ModelleertaalApp.prototype.grafisch_values = function() {
  // after a run: name --> {first, last} (as in the table), for the tooltips of the symbols
  if (!this.results_available() || this.stale) return null;
  var self = this, out = {};
  var last = this.results[this.results.length - 1];
  this.allVars.forEach(function(name, j) {
    // a hulpvariabele gets its first value in the first iteration
    var first = self.results[0][j];
    for (var i = 0; i < self.results.length && typeof first == 'number' && !isFinite(first); i++) {
      first = self.results[i][j];
    }
    out[name] = {first: self.format_number(first, j), last: self.format_number(last[j], j)};
  });
  return out;
};


ModelleertaalApp.prototype.render_grafisch_model = function() {
  // draw this.grafisch_g with the (dragged) positions in this.grafisch_layout.
  // The drawing only grows while dragging, so it does not jump under the mouse.
  var self = this;
  var opts = {bounds: this.grafisch_bounds, values: this.grafisch_values(), stijl: this.grafisch_stijl,
              formules: this.grafisch_formules,
              units: this.grafisch_eenheden && this.grafisch_units ? this.grafisch_units.units : undefined,
              derivedUnits: this.grafisch_units ? this.grafisch_units.derived : undefined,
              selected: this.grafisch_form_new ? undefined : this.grafisch_selected};
  var view = $(this.dom_grafisch_svg);
  view.html(grafisch.toSVG(this.grafisch_g, this.grafisch_layout, opts));
  this.grafisch_bounds = opts.used;
  // zoom: this.grafisch_zoom is a factor, or null: fit the width (not larger than 100%)
  var svg = view.find('svg');
  var w = parseFloat(svg.attr('width')), h = parseFloat(svg.attr('height'));
  var zoom = this.grafisch_zoom;
  // not smaller than 50%: then it is unreadable, scroll instead.
  // A phone shows the whole model (zoom in with two fingers).
  var narrow = view[0].clientWidth < 600;
  if (!zoom) zoom = Math.max(narrow ? 0.3 : 0.5, Math.min(1, (view[0].clientWidth - 2) / w));
  this.grafisch_zoom_now = zoom;
  svg.attr('width', Math.round(w * zoom)).attr('height', Math.round(h * zoom));
  $('#grafisch_zoom_waarde').text(Math.round(zoom * 100) + '%');
  if (this.grafisch_selected !== undefined) {
    view.find('[data-id]').filter(function() {
      return $(this).attr('data-id').replace(/:(src|dst)$/, '') == self.grafisch_selected;
    }).addClass('selected');
  }
  this.grafisch_mark_linked();
  this.grafisch_place_form();
};


ModelleertaalApp.prototype.grafisch_link_cursor = function(editor) {
  // the cursor is in a line of the text: light up the symbol of that line
  if (!this.grafisch_open() || !this.grafisch_lines) return;
  var name = (editor === this.modelregels_editor) ? 'modelregels' : 'startwaarden';
  var id = this.grafisch_lines.byLine[name + ':' + (editor.getCursor().line + 1)];
  id = editor.hasFocus() ? id : undefined;
  if (id === this.grafisch_linked) return;
  this.grafisch_linked = id;
  this.grafisch_mark_linked();
};


ModelleertaalApp.prototype.grafisch_mark_linked = function() {
  var self = this;
  var view = $(this.dom_grafisch_svg);
  view.find('.linked').removeClass('linked');
  if (this.grafisch_linked === undefined) return;
  view.find('[data-id]').filter(function() {
    return $(this).attr('data-id') == self.grafisch_linked;
  }).addClass('linked');
};


ModelleertaalApp.prototype.grafisch_highlight_lines = function(id) {
  // the lines of the text of the selected symbol get a colour (definition and beginwaarde)
  var self = this;
  (this.link_lines || []).forEach(function(h) {
    h.editor.removeLineClass(h.handle, 'background', 'mt-link-line');
  });
  this.link_lines = [];
  if (!this.CodeMirrorActive || id === undefined || !this.grafisch_lines) return;
  var lines = this.grafisch_lines.byElement[id];
  if (!lines) return;
  ['startwaarden', 'modelregels'].forEach(function(name) {
    var editor = self.get_editor(name);
    lines[name].forEach(function(line) {
      if (line >= 1 && line <= editor.lineCount()) {
        self.link_lines.push({editor: editor, handle: editor.addLineClass(line - 1, 'background', 'mt-link-line')});
      }
    });
  });
};


ModelleertaalApp.prototype.grafisch_set_zoom = function(zoom, wheel) {
  // zoom: factor, or null to fit the width. wheel: keep the point under the mouse in place
  if (!this.grafisch_g || !this.grafisch_layout) return;
  var view = $(this.dom_grafisch_svg)[0];
  var old = this.grafisch_zoom_now || 1;
  var box = view.getBoundingClientRect();
  var px = wheel ? wheel.clientX - box.left : view.clientWidth / 2;
  var py = wheel ? wheel.clientY - box.top : view.clientHeight / 2;
  var cx = (view.scrollLeft + px) / old, cy = (view.scrollTop + py) / old;
  this.grafisch_zoom = zoom === null ? null : Math.max(0.3, Math.min(3, zoom));
  this.render_grafisch_model();
  view.scrollLeft = cx * this.grafisch_zoom_now - px;
  view.scrollTop = cy * this.grafisch_zoom_now - py;
};


ModelleertaalApp.prototype.grafisch_place_form = function() {
  // the form is a small window in the diagram (wide screens), at the place where it covers
  // the least: never the selected element, preferably not the elements connected to it.
  // Never outside the diagram: the diagram is made at least as high as the form.
  var box = $(this.dom_grafisch_form), form = box.children('form');
  var area = $(this.dom_grafisch_svg);
  if (!form.length || box.css('position') != 'absolute') {
    box.css({left: '', top: ''});
    area.css('min-height', '');
    return;
  }
  var formH = box.outerHeight(), formW = box.outerWidth();
  area.css('min-height', Math.ceil(formH + 16) + 'px');
  var wrap = box.parent()[0].getBoundingClientRect();
  var view = area[0].getBoundingClientRect();
  var minTop = view.top - wrap.top + 8, maxTop = view.bottom - wrap.top - formH - 8;
  var minLeft = 8, maxLeft = Math.min(wrap.width, view.right - wrap.left) - formW - 8;
  var clamp = function(c) {
    return {left: Math.max(minLeft, Math.min(c.left, maxLeft)), top: Math.max(minTop, Math.min(c.top, maxTop))};
  };
  var self = this, g = this.grafisch_g, sel = this.grafisch_selected;
  // a new element for an unknown (?) variable: that symbol counts as the selected one
  var focus = sel === undefined && this.grafisch_form_new ? this.grafisch_form_focus : undefined;
  var rect = function(node) {
    var r = node.getBoundingClientRect();
    return {left: r.left - wrap.left, top: r.top - wrap.top, right: r.right - wrap.left, bottom: r.bottom - wrap.top};
  };
  var el = sel === undefined ? null : area.find('.selected').filter(function() {
    return $(this).attr('data-id') == sel;
  })[0];
  if (!el && focus) {
    el = area.find('[data-id]').filter(function() { return $(this).attr('data-id') == focus; })[0];
    sel = focus;
  }
  var pos = clamp({left: minLeft, top: minTop});
  if (!el && g) {
    // a new element: the corner or side of the diagram where the form covers the least
    var all = [];
    area.find('[data-id]').each(function() { all.push(rect(this)); });
    var cover = function(c) {
      var f = {left: c.left, top: c.top, right: c.left + formW, bottom: c.top + formH}, sum = 0;
      all.forEach(function(o) {
        var w = Math.min(f.right, o.right) - Math.max(f.left, o.left);
        var h = Math.min(f.bottom, o.bottom) - Math.max(f.top, o.top);
        if (w > 0 && h > 0) sum += w * h;
      });
      return sum;
    };
    var midTop = (minTop + maxTop) / 2;
    var spots = [{left: minLeft, top: minTop}, {left: maxLeft, top: minTop}, {left: minLeft, top: maxTop},
                 {left: maxLeft, top: maxTop}, {left: maxLeft, top: midTop}, {left: minLeft, top: midTop}];
    var bestNew = null;
    spots.forEach(function(c, n) {
      c = clamp(c);
      var score = cover(c) * 10 + n;
      if (!bestNew || score < bestNew.score) bestNew = {score: score, pos: c};
    });
    pos = bestNew.pos;
  }
  if (el && g) {
    // the selected symbol (with its + buttons), its neighbours and the rest of the diagram
    var r = rect(el);
    r = {left: r.left - 12, top: r.top - 12, right: r.right + 12, bottom: r.bottom + 12};
    var near = {};
    g.links.forEach(function(l) {
      if (l.from == sel) near[l.to] = true;
      if (l.to == sel) near[l.from] = true;
    });
    g.flows.forEach(function(f) {
      if (f.id == sel) { near[f.from] = true; near[f.to] = true; }
      if (f.from == sel || f.to == sel) near[f.id] = true;
    });
    var others = [];
    area.find('[data-id]').each(function() {
      var id = $(this).attr('data-id').replace(/:(src|dst)$/, '');
      if (id == sel) return;
      others.push({r: rect(this), weight: near[id] ? 20 : 1});
    });
    var overlap = function(a, b) {
      var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return (w > 0 && h > 0) ? w * h : 0;
    };
    var midY = (r.top + r.bottom - formH) / 2, midX = (r.left + r.right - formW) / 2;
    var candidates = [
      {left: r.left, top: r.bottom + 4}, {left: midX, top: r.bottom + 4},
      {left: r.left, top: r.top - 4 - formH}, {left: midX, top: r.top - 4 - formH},
      {left: r.right + 6, top: midY}, {left: r.left - 6 - formW, top: midY},
      {left: r.right + 6, top: r.top}, {left: r.left - 6 - formW, top: r.top},
      {left: minLeft, top: minTop}, {left: maxLeft, top: minTop},
      {left: minLeft, top: maxTop}, {left: maxLeft, top: maxTop}];
    var best = null;
    candidates.forEach(function(c, n) {
      c = clamp(c);
      var f = {left: c.left, top: c.top, right: c.left + formW, bottom: c.top + formH};
      var score = overlap(f, r) * 1000 + n;   // the first candidates go first
      others.forEach(function(o) { score += overlap(f, o.r) * o.weight; });
      if (!best || score < best.score) best = {score: score, pos: c};
    });
    pos = best.pos;
  }
  box.css({left: Math.round(pos.left) + 'px', top: Math.round(pos.top) + 'px'});
};


ModelleertaalApp.prototype.grafisch_undo = function() {
  // undo the last change made in the diagram
  var last = (this.grafisch_history || []).pop();
  $('#grafisch_undo').prop('disabled', !(this.grafisch_history || []).length);
  if (!last) return;
  this.read_model();
  if (this.model.startwaarden.replace(/\r/g, '') != last.after.startwaarden ||
      this.model.modelregels.replace(/\r/g, '') != last.after.modelregels) {
    // the text was changed in the editor after that
    this.grafisch_history = [];
    $('#grafisch_undo').prop('disabled', true);
    this.grafisch_message('De tekst van het model is daarna veranderd. Gebruik Ctrl+Z in de tekst.');
    return;
  }
  this.write_model(last.before);
  clearTimeout(this.grafisch_timer);
  this.grafisch_form_new = false;
  this.grafisch_selected = last.selected;
  this.draw_grafisch_model();
};


//
// Grafisch model as input: a change in the diagram is a small change in the text
// of the model (grafisch-edit.js). The text stays the source: Ctrl+Z in the editor works.
//
ModelleertaalApp.prototype.write_model = function(model) {
  // put a model changed by the program in the editors
  if (this.CodeMirrorActive) {
    if (this.startwaarden_editor.getValue() != model.startwaarden) this.startwaarden_editor.setValue(model.startwaarden);
    if (this.modelregels_editor.getValue() != model.modelregels) this.modelregels_editor.setValue(model.modelregels);
  } else {
    $(this.dom_startwaarden).val(model.startwaarden);
    $(this.dom_modelregels).val(model.modelregels);
  }
  this.on_model_edited();
};


ModelleertaalApp.prototype.grafisch_message = function(text) {
  // in the open form, else under the diagram
  var inForm = $(this.dom_grafisch_form).find('.grafisch_form_melding');
  inForm.text(text || '');
  $(this.dom_grafisch_melding).text(inForm.length ? '' : (text || ''));
  if (inForm.length && text) this.grafisch_place_form();
};


ModelleertaalApp.prototype.grafisch_apply = function(ops, select, opts) {
  // apply the edit operations (see grafisch-edit.js) to the text of the model. All or nothing.
  // opts.noform: the element select is selected, but its form stays closed (after a new element)
  this.read_model();
  var model = {startwaarden: this.model.startwaarden, modelregels: this.model.modelregels};
  try {
    ops.forEach(function(op) {
      model = grafisch_edit.apply(model, op);
    });
  } catch (err) {
    this.grafisch_message(err.message);
    return false;
  }
  this.grafisch_message('');
  // nothing changed (dt = 0,1 again when the field loses the focus): no new drawing, so a form
  // that is being clicked is not replaced and the click and the keys after it are not lost
  if (model.startwaarden == this.model.startwaarden.replace(/\r/g, '') &&
      model.modelregels == this.model.modelregels.replace(/\r/g, '')) return true;
  this.grafisch_history = this.grafisch_history || [];
  this.grafisch_history.push({
    before: {startwaarden: this.model.startwaarden.replace(/\r/g, ''), modelregels: this.model.modelregels.replace(/\r/g, '')},
    after: model, selected: this.grafisch_selected});
  $('#grafisch_undo').prop('disabled', false);
  this.write_model(model);
  clearTimeout(this.grafisch_timer);
  this.grafisch_form_new = false;
  this.grafisch_selected = select;
  this.grafisch_noform = !!(opts && opts.noform);
  this.draw_grafisch_model();
  return true;
};


ModelleertaalApp.prototype.grafisch_names = function() {
  // names of the variables in the diagram (for the buttons under a formula),
  // without the selected element itself
  var g = this.grafisch_g, names = [];
  if (!g) return names;
  var self_name = (this.grafisch_selected !== undefined && g.elements[this.grafisch_selected]) ?
    g.elements[this.grafisch_selected].name : null;
  g.order.forEach(function(id) {
    var name = g.elements[id].name;
    if (name && name != self_name && names.indexOf(name) == -1) names.push(name);
  });
  return names;
};


function grafisch_accept_on_tab(input, ok) {
  var base = input.attr('title') || '';   // the own tooltip of the field stays
  // Tab (forward) in an empty field: the grey suggestion (placeholder) becomes the value, so it is
  // real input (and in a form of an existing element it is applied when the field is left).
  // ok (optional): function(placeholder) --> false for a placeholder that is not a value
  input.on('keydown', function(event) {
    var text = input.attr('placeholder') || '';
    if (event.key != 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if ($.trim(input.val()) !== '' || $.trim(text) === '' || (ok && !ok(text))) return;
    input.val(text).removeClass('invalid').trigger('change');
  });
  input.on('focus', function() {
    // the tooltip says so, with the suggestion of this moment
    var text = input.attr('placeholder') || '';
    var show = $.trim(input.val()) === '' && $.trim(text) !== '' && (!ok || ok(text));
    var tip = show ? (base ? base + '. ' : '') + 'Tab: ' + text + ' overnemen' : base;
    if (tip) input.attr('title', tip);
    else input.removeAttr('title');
  });
}


ModelleertaalApp.prototype.grafisch_form = function(title, note, fields, buttons, onchange, onenter) {
  // fields: [{key, label, value, placeholder, options: [{value, text}], formula: true}]
  //   Tab in an empty field takes over the grey example or suggestion (placeholder) as real input,
  //   unless accept: false (a placeholder that is not a value, such as 'geen').
  // buttons: [{text, action: function(values)}]
  // onchange (optional), for an existing element: function(values, key). Every change is applied
  //   at once: with Enter, or when you leave the field. Returns false if the change is not possible
  //   (the text of the model is not changed, the field gets a red border).
  //   Without onchange the first button is also the Enter key (new elements: "Voeg toe").
  // onenter (optional, without onchange): function(values) for the Enter key, instead of the first button.
  var self = this;
  var box = $(this.dom_grafisch_form).empty();
  if (!title) {
    this.grafisch_place_form();
    return;
  }
  var live = typeof onchange == 'function';
  var enter = !live && typeof onenter == 'function';
  var form = $('<form>').addClass('grafisch_form').attr('autocomplete', 'off');
  var inputs = {}, formulas = [];

  var values = function() {
    // a new element: an empty field with an example (placeholder) gets the example
    var v = {};
    for (var key in inputs) {
      if (!inputs.hasOwnProperty(key)) continue;
      v[key] = inputs[key].val();
      if (!live && !inputs[key].data('hint') && $.trim(v[key]) === '' && inputs[key].attr('placeholder')) {
        v[key] = inputs[key].attr('placeholder');
      }
    }
    return v;
  };
  var changed = function() {
    for (var key in inputs) {
      if (inputs.hasOwnProperty(key) && inputs[key].val() !== inputs[key].data('committed')) return true;
    }
    return false;
  };
  var done = function() {
    // Enter or OK: the element stays selected, the form closes (a click on the element opens it)
    self.grafisch_select(self.grafisch_selected, {noform: true});
  };
  var commit = function(key, finish) {
    // after the focus has moved on (Tab, click): apply, and keep the focus in the new form.
    // finish (Enter): close the form after a change that worked (or when nothing changed)
    setTimeout(function() {
      if (!$.contains(document.documentElement, form[0])) return;
      if (!changed()) {
        if (finish) done();
        return;
      }
      var refocus = null, active = document.activeElement;
      for (var k in inputs) {
        if (inputs.hasOwnProperty(k) && inputs[k][0] === active) {
          refocus = {key: k, start: active.selectionStart, end: active.selectionEnd};
        }
      }
      self.grafisch_refocus = refocus;
      var ok = onchange(values(), key);
      self.grafisch_refocus = null;
      if (finish && ok !== false) {
        done();
        return;
      }
      if (ok === false && $.contains(document.documentElement, form[0])) {
        // not possible: keep what the user typed, so it can be corrected
        if (inputs[key]) inputs[key].addClass('invalid');
        for (k in inputs) {
          if (inputs.hasOwnProperty(k)) inputs[k].data('committed', inputs[k].val());
        }
      }
    }, 0);
  };
  var close = function() {
    if (live && changed()) onchange(values());
    self.grafisch_form_new = false;
    self.grafisch_select(undefined);
  };

  form.append($('<h2>').text(title).append(
    $('<button type="button" title="Sluiten (Esc)" aria-label="Sluiten">').addClass('grafisch_sluit').html('&times;')
      .on('mousedown', function(event) { event.preventDefault(); })
      .click(close)));
  if (note) form.append($('<p>').addClass('grafisch_legenda').text(note));

  fields.forEach(function(f) {
    var input;
    if (f.options) {
      input = $('<select>');
      f.options.forEach(function(o) {
        input.append($('<option>').val(o.value).text(o.text));
      });
      input.val(f.value);
      if (live) input.on('change', function() { commit(f.key); });
    } else {
      input = $('<input type="text" spellcheck="false" autocapitalize="off">').val(f.value).attr('placeholder', f.placeholder || '');
      if (live) {
        input.on('blur', function() { commit(f.key); });
        input.on('keydown', function(event) {
          if (event.key == 'Enter') {
            event.preventDefault();
            commit(f.key, true);
          }
        });
      }
      if (enter) {
        input.on('keydown', function(event) {
          if (event.key == 'Enter') {
            event.preventDefault();
            onenter(values());
          }
        });
      }
      input.on('input', function() { $(this).removeClass('invalid'); });
      if (f.accept !== false) grafisch_accept_on_tab(input);
    }
    input.data('committed', input.val());
    if (f.hint) input.data('hint', true).addClass('grafisch_hint');
    inputs[f.key] = input;
    if (f.formula) formulas.push(input);
    form.append($('<label>').append($('<span>').text(f.label)).append(input));
  });

  // the names of the variables: a click puts the name in the formula (no typing mistakes)
  var names = this.grafisch_names();
  if (formulas.length && names.length) {
    var target = formulas[0];
    formulas.forEach(function(input) {
      input.on('focus', function() { target = input; });
    });
    var chips = $('<div>').addClass('grafisch_chips').append($('<span>').text('Invoegen:'));
    names.forEach(function(name) {
      chips.append($('<button type="button">').text(name).attr('title', 'Zet ' + name + ' in de formule')
        .on('mousedown', function(event) { event.preventDefault(); })   // the focus stays in the formula
        .click(function() {
          var el = target[0], text = target.val();
          var focused = document.activeElement === el;
          var start = focused ? el.selectionStart : text.length, end = focused ? el.selectionEnd : text.length;
          target.val(text.slice(0, start) + name + text.slice(end)).removeClass('invalid');
          el.focus();
          el.setSelectionRange(start + name.length, start + name.length);
        }));
    });
    form.append(chips);
  }

  var row = $('<div>').addClass('grafisch_form_knoppen');
  if (live && fields.length) {
    // OK: apply what is typed and close the form (the same as Enter)
    buttons = [{text: 'OK', action: function() { commit(null, true); }}].concat(buttons);
  }
  buttons.forEach(function(b, n) {
    var button = $('<button>').attr('type', (!live && !enter && n === 0) ? 'submit' : 'button').text(b.text).click(function(event) {
      event.preventDefault();
      b.action(values());
    });
    // a click on a button does not first apply the field you are typing in
    if (live) button.on('mousedown', function(event) { event.preventDefault(); });
    row.append(button);
  });
  form.append($('<div>').addClass('grafisch_form_melding').attr('role', 'alert'));
  if (buttons.length) form.append(row);
  if (live || enter) form.on('submit', function(event) { event.preventDefault(); });
  box.append(form);
  // keys typed in the form are not for the diagram (Delete) or the model (Ctrl+Enter)
  form.on('pointerdown', function() { self.grafisch_focus = true; });
  this.grafisch_place_form();

  // the form was made again after a change: the cursor stays where it was
  var refocus = this.grafisch_refocus;
  if (refocus && inputs[refocus.key]) {
    inputs[refocus.key].focus();
    try {
      inputs[refocus.key][0].setSelectionRange(refocus.start, refocus.end);
    } catch (err) {
      // (select: no cursor)
    }
  }
  return form;
};


ModelleertaalApp.prototype.grafisch_new_form = function(kind, name, value) {
  // form for a new toestandsvariabele ('stock'), hulpvariabele ('aux') or constante ('const').
  // name (optional): of an unknown (?) variable, that gets defined. value: what was typed for it
  var self = this;
  name = name || '';
  var close = {text: 'Annuleer', action: function() {
    self.grafisch_form_new = false;
    self.grafisch_select(undefined);
  }};
  // + Voorwaarde with a variable selected: that variable changes
  var g = this.grafisch_g, sel = (g && this.grafisch_selected !== undefined) ? g.elements[this.grafisch_selected] : null;
  var target = (sel && sel.name && ['stock', 'const', 'aux'].indexOf(sel.kind) != -1) ? sel.name : '';
  this.grafisch_message('');
  this.grafisch_selected = undefined;
  this.grafisch_form_focus = name || (kind == 'event' && target ? target : undefined);
  this.grafisch_highlight_lines(undefined);
  this.grafisch_form_new = true;
  if (this.grafisch_g) this.render_grafisch_model();
  var form;
  if (kind == 'stock') {
    var x = name || 'x';
    form = this.grafisch_form(name ? 'Toestandsvariabele ' + name : 'Nieuwe toestandsvariabele',
      'Een grootheid die elke stap een beetje verandert, zoals de plaats x of de snelheid v. ' +
      'In de tekst komt: ' + x + ' = ' + x + ' + d' + x + ' met d' + x + ' = (verandering per tijdseenheid) * dt.',
      [{key: 'name', label: 'Naam', value: name, placeholder: 'x'},
       {key: 'initial', label: 'Beginwaarde', value: value || '0', formula: true},
       {key: 'rate', label: 'Verandering per tijdseenheid', value: '', placeholder: name ? '' : 'v', formula: true}]
        .concat(this.grafisch_unit_field(name, name ? '' : 'm')),
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'addStock', name: v.name, initial: v.initial, rate: v.rate}],
          $.trim(v.name), v), $.trim(v.name), {noform: true});
      }}, close]);
  } else if (kind == 'event') {
    form = this.grafisch_form('Nieuwe voorwaarde',
      'Als de voorwaarde waar is, krijgt de variabele een nieuwe waarde (bijvoorbeeld: als t > 13 dan ' +
      'Opp = Opp + dOpp). Of het model stopt. In de tekst komt: als ... dan ... eindals.',
      [{key: 'condition', label: 'Als', value: '', placeholder: 't > 13', formula: true},
       {key: 'target', label: 'dan verandert', value: target, placeholder: 'Opp', hint: true},
       {key: 'text', label: 'in (nieuwe waarde)', value: '', placeholder: 'Opp + dOpp', formula: true, hint: true}],
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply([{op: 'addEvent', condition: v.condition, target: v.target, text: v.text}],
          $.trim(v.target) || undefined, {noform: true});
      }}, {text: 'Stop het model', action: function(v) {
        self.grafisch_apply([{op: 'addEvent', condition: v.condition, stop: true}], undefined);
      }}, close]);
    form.find('input').first().focus();
    return;
  } else if (kind == 'aux') {
    form = this.grafisch_form('Nieuwe hulpvariabele', 'Een grootheid die elke stap met een formule wordt uitgerekend, zoals Fres.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'Fres'},
       {key: 'text', label: 'Formule', value: '', placeholder: 'Fz - Fw', formula: true}]
        .concat(this.grafisch_unit_field(null, 'N')),
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'addAux', name: v.name, text: v.text}], $.trim(v.name), v),
          $.trim(v.name), {noform: true});
      }}, close]);
  } else {
    form = this.grafisch_form('Nieuwe constante', 'Een grootheid die niet verandert, zoals de massa m. Komt bij de startwaarden.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'm'},
       {key: 'text', label: 'Waarde', value: '', placeholder: '75', formula: true}]
        .concat(this.grafisch_unit_field(null, 'kg')),
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'addConstant', name: v.name, text: v.text}], $.trim(v.name), v),
          $.trim(v.name), {noform: true});
      }}, close]);
  }
  // the first empty field (a name that is already filled in: the next one)
  var empty = form.find('input').filter(function() { return $(this).val() === ''; }).first();
  (name && empty.length ? empty : form.find('input').first()).focus();
};


ModelleertaalApp.prototype.grafisch_flow_form = function(stock, direction) {
  // new flow into ('in') or out of ('out') a toestandsvariabele or constante
  var self = this;
  this.grafisch_form_new = true;
  this.grafisch_message('');
  if (this.grafisch_g) this.render_grafisch_model();
  var form = this.grafisch_form(direction == 'in' ? 'Nieuwe stroom naar ' + stock : 'Nieuwe stroom uit ' + stock,
    'In de tekst komt: ' + stock + ' = ' + stock + (direction == 'in' ? ' + ' : ' - ') + 'naam, met naam = (stroomsterkte) * dt.',
    [{key: 'name', label: 'Naam', value: '', placeholder: 'd' + stock},
     {key: 'rate', label: 'Stroomsterkte (per tijdseenheid)', value: '', placeholder: '0', formula: true}],
    [{text: 'Voeg toe', action: function(v) {
      self.grafisch_apply(self.grafisch_unit_ops([{op: 'addFlow', stock: stock, direction: direction, name: v.name, rate: v.rate}],
        stock, {}), stock, {noform: true});
    }}, {text: 'Annuleer', action: function() {
      self.grafisch_form_new = false;
      self.grafisch_select(stock);
    }}]);
  form.find('input').first().focus();
};


ModelleertaalApp.prototype.grafisch_select = function(id, opts) {
  // select an element of the grafisch model and show the form with its properties.
  // opts.noform: selected, but without the form (a click on the element opens it)
  var self = this, g = this.grafisch_g;
  this.grafisch_noform = !!(opts && opts.noform);
  var el = (g && id !== undefined && g.elements.hasOwnProperty(id)) ? g.elements[id] : undefined;
  var changed = (el ? id : undefined) !== this.grafisch_selected;
  this.grafisch_selected = el ? id : undefined;
  this.grafisch_form_new = false;
  if (changed) this.grafisch_message('');
  if (g && this.grafisch_layout) this.render_grafisch_model();
  // the lines in the text that belong to this symbol, and its row in Herkende elementen
  this.grafisch_highlight_lines(this.grafisch_selected);
  $(this.dom_grafisch_tabel).find('tr').removeClass('selected').filter(function() {
    return $(this).attr('data-id') === self.grafisch_selected;
  }).addClass('selected');
  if (!el || this.grafisch_noform) {
    this.grafisch_form(null);
    return;
  }

  var rename = function(ops, v) {
    // returns the id after the change of the name
    var name = $.trim(v.name);
    if (name === '' || name == el.name) return id;
    ops.push({op: 'rename', id: id, name: name});
    // a dragged element stays where it is under its new name
    ['', ':src', ':dst'].forEach(function(suffix) {
      if (self.grafisch_moved[id + suffix]) self.grafisch_moved[name + suffix] = self.grafisch_moved[id + suffix];
    });
    return name;
  };
  var apply = function(ops, select) {
    if (ops.length) return self.grafisch_apply(ops, select);
  };
  // the field Eenheid (toggle eenheden), and a remark when the units do not fit
  var unit_name = el.name;
  var unit_fields = unit_name ? this.grafisch_unit_field(unit_name) : [];
  var unit_info = this.grafisch_unit(unit_name);
  var unit_note = function(note) {
    if (!self.grafisch_eenheden || !unit_info.conflict) return note;
    return (note ? note + ' ' : '') + 'Eenheid: ' + unit_info.conflict + '.';
  };
  var unit_op = function(ops, now, v) {
    if (unit_fields.length && $.trim(v.unit || '') != unit_info.explicit) ops.push({op: 'setUnit', name: now, unit: v.unit});
  };
  var remove = {text: 'Verwijder', action: function() {
    self.grafisch_apply([{op: 'remove', id: id}], undefined);
  }};
  var inflow = {text: '+ Stroom erin', action: function() { self.grafisch_flow_form(id, 'in'); }};
  var outflow = {text: '+ Stroom eruit', action: function() { self.grafisch_flow_form(id, 'out'); }};
  var manual = 'Dit kun je alleen in de tekst van het model aanpassen.';
  // a toestandsvariabele shows how it changes: the formulas of its flows
  var stockFlows = [];
  if (el.kind == 'stock' && !el.general && el.updates == 1) {
    [[el.inflows, 'Stroom erin'], [el.outflows, 'Stroom eruit']].forEach(function(side) {
      side[0].forEach(function(fid) {
        var f = g.elements[fid];
        if (fid.indexOf('#') != -1) return;
        var other = side[1] == 'Stroom erin' ? f.from : f.to;
        stockFlows.push({key: 'flow:' + fid, flow: fid, value: f.code, formula: true,
          label: side[1] + (other ? (side[1] == 'Stroom erin' ? ' (uit ' : ' (naar ') + other + ')' : '') +
                 (f.name ? ': ' + f.name + ' =' : '')});
      });
    });
  }

  switch (el.kind) {
    case 'stock':
      // a maximum or minimum: als x > 42,6 dan x = 42,6 eindals (exam 2005-I)
      this.read_model();
      var limits = {max: '', min: ''};
      try {
        limits = grafisch_edit.limitsOf({startwaarden: this.model.startwaarden, modelregels: this.model.modelregels}, el.name);
      } catch (err) {
        limits = {max: '', min: ''};
      }
      var limit_fields = [{key: 'min', label: 'Minimum', value: limits.min, placeholder: 'geen', hint: true, accept: false, formula: true},
                          {key: 'max', label: 'Maximum', value: limits.max, placeholder: 'geen', hint: true, accept: false, formula: true}];
      this.grafisch_form('Toestandsvariabele ' + el.name,
        unit_note((el.general || el.updates != 1) ? 'De stromen van ' + el.name + ' kun je alleen in de tekst aanpassen.' : ''),
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Beginwaarde', value: el.initialCode, formula: true}].concat(unit_fields, stockFlows, limit_fields),
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.initialCode) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
          ['max', 'min'].forEach(function(b) {
            if ($.trim(v[b]) != limits[b]) ops.push({op: 'setLimit', name: now, bound: b, text: v[b]});
          });
          stockFlows.forEach(function(f) {
            if ($.trim(v[f.key]) != f.value) ops.push({op: 'setDefinition', id: f.flow, text: v[f.key]});
          });
          return apply(ops, now);
        });
      break;
    case 'const':
      this.grafisch_form('Constante ' + el.name, unit_note('Met een stroom erin of eruit wordt het een toestandsvariabele.'),
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Waarde', value: el.code, formula: true}].concat(unit_fields),
        [inflow, outflow, {text: 'Maak hulpvariabele', action: function() {
          apply([{op: 'convert', id: id, kind: 'aux'}], id);
        }}, remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
          return apply(ops, now);
        });
      break;
    case 'aux':
      if (el.code === null) {
        this.grafisch_form('Hulpvariabele ' + el.name, el.definition + '. ' + manual,
          [{key: 'name', label: 'Naam', value: el.name}], [],
          function(v) {
            var ops = [], now = rename(ops, v);
            return apply(ops, now);
          });
        break;
      }
      var no_vars = false;
      try {
        no_vars = grafisch_edit.variablesOf(el.code).length === 0;
      } catch (err) {
        no_vars = false;
      }
      this.grafisch_form('Hulpvariabele ' + el.name, unit_note(''),
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Formule', value: el.code, formula: true}].concat(unit_fields),
        (no_vars ? [{text: 'Maak constante', action: function() {
          apply([{op: 'convert', id: id, kind: 'const'}], id);
        }}] : []).concat([remove]),
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
          return apply(ops, now);
        });
      break;
    case 'flow':
      var ends = [{value: '', text: 'buiten (wolkje)'}];
      g.order.forEach(function(k) {
        var e = g.elements[k];
        if (e.kind == 'stock') ends.push({value: k, text: k});
        if (e.kind == 'const') ends.push({value: k, text: k + ' (constante, wordt toestandsvariabele)'});
      });
      this.grafisch_form('Stroom ' + (el.name || el.label),
        el.name ? (el.isRate ? 'Stroomsterkte per tijdseenheid: in de tekst staat ' + el.term + '.' : '') :
          'Deze stroom heeft geen naam: hij staat als ' + el.term + ' in de regel van ' + (el.to || el.from) + '.',
        [{key: 'name', label: 'Naam', value: el.name || '', placeholder: '(geen naam)', accept: false},
         {key: 'text', label: 'Formule', value: el.code, formula: true}].concat(unit_fields, [
         {key: 'from', label: 'Van', value: el.from || '', options: ends},
         {key: 'to', label: 'Naar', value: el.to || '', options: ends}]),
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
          if (v.from != (el.from || '') || v.to != (el.to || '')) {
            ops.push({op: 'setFlowEnds', id: now, from: v.from || null, to: v.to || null});
            // a flow without a name gets a name: its id is not known here
            if (now == id && !el.name) now = undefined;
          }
          return apply(ops, now);
        });
      break;
    case 'unknown':
      var define = function(kind, v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'define', id: id, kind: kind, text: v.text}], el.name, v), id, {noform: true});
      };
      var unknown_form = this.grafisch_form('Onbekend: ' + el.name,
        el.name + ' wordt gebruikt, maar heeft nog geen waarde of formule. ' +
        'Enter: een getal wordt een constante, een formule met variabelen een hulpvariabele.',
        [{key: 'text', label: 'Waarde of formule', value: '', formula: true}].concat(unit_fields),
        [{text: 'Maak constante', action: function(v) { define('const', v); }},
         {text: 'Maak hulpvariabele', action: function(v) { define('aux', v); }},
         {text: 'Maak toestandsvariabele', action: function(v) { self.grafisch_new_form('stock', el.name, $.trim(v.text)); }}],
        undefined,
        function(v) {
          // Enter: a number (or an expression without variables) is a constant, else a hulpvariabele
          var vars;
          try {
            vars = grafisch_edit.variablesOf(v.text);
          } catch (err) {
            self.grafisch_message(err.message);
            return;
          }
          define(vars.length ? 'aux' : 'const', v);
        });
      unknown_form.find('input').first().focus();
      break;
    case 'event':
    case 'stop':
      // condition and new value can be changed when the voorval is one als-block (see grafisch-edit.js)
      this.read_model();
      var ev = null;
      try {
        ev = grafisch_edit.eventOf({startwaarden: this.model.startwaarden, modelregels: this.model.modelregels}, id);
      } catch (err) {
        ev = null;
      }
      var title = el.kind == 'stop' ? 'Stopvoorwaarde' : 'Voorval';
      if (!ev) {
        this.grafisch_form(title, (el.kind == 'stop' ? 'Het model stopt als ' + el.condition :
          'als ' + el.condition + ' dan ' + el.actions.join('; ')) + '. ' + manual, [], []);
        break;
      }
      var ev_fields = [{key: 'condition', label: 'Als', value: ev.condition, formula: true}];
      if (ev.target !== null) ev_fields.push({key: 'text', label: 'dan wordt ' + ev.target, value: ev.text, formula: true});
      this.grafisch_form(title,
        el.kind == 'stop' ? 'Het model stopt als de voorwaarde waar is.' :
          (ev.target === null ? 'als ' + el.condition + ' dan ' + el.actions.join('; ') + '. De nieuwe waarden kun je alleen in de tekst aanpassen.' :
           'Als de voorwaarde waar is, krijgt ' + ev.target + ' een nieuwe waarde.'),
        ev_fields, [remove],
        function(v) {
          var op = {op: 'setEvent', id: id};
          if ($.trim(v.condition) != ev.condition) op.condition = v.condition;
          if (ev.target !== null && $.trim(v.text) != ev.text) op.text = v.text;
          if (op.condition === undefined && op.text === undefined) return;
          // the id of a voorval is its number (~e1): it stays the same when the condition changes
          return self.grafisch_apply([op], id);
        });
      break;
    default:
      this.grafisch_form(el.name, el.definition + '. ' + manual, [], []);
  }
};


ModelleertaalApp.prototype.grafisch_point = function(e) {
  // mouse/touch position in SVG coordinates
  var svg = $(this.dom_grafisch_svg).find('svg')[0];
  var pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};


ModelleertaalApp.prototype.download_grafisch_model = function() {
  // download with the positions as shown (dragged by the user)
  var g = this.grafisch_g, lay = this.grafisch_layout;
  if (!g || !this.grafisch_open()) {
    try {
      g = this.analyse_grafisch_model();
    } catch (err) {
      this.show_error(err);
      return;
    }
    lay = undefined;
  }
  this.save_string('<?xml version="1.0" encoding="UTF-8"?>\n' + grafisch.toSVG(g, lay, {stijl: this.grafisch_stijl, formules: this.grafisch_formules,
    units: this.grafisch_eenheden && this.grafisch_units ? this.grafisch_units.units : undefined,
    derivedUnits: this.grafisch_units ? this.grafisch_units.derived : undefined}), this.file_name('.svg', 'grafisch model'));
};


ModelleertaalApp.prototype.set_stale = function(stale) {
  // results on screen do not belong to the model in the editor (anymore)
  this.stale = stale;
  $(this.dom_results).toggleClass('stale', stale);
  $(this.dom_run).toggleClass('attention', stale);
};


ModelleertaalApp.prototype.read_file = function(evt) {
  var self = this;
  var f = evt.target.files[0];

  if (f) {
    var r = new FileReader();
    r.onload = function(e) {
      self.read_model_from_xml(e.target.result);
      if (!self.model.modelregels && !self.model.startwaarden) {
        self.show_message('error', 'Bestand niet gelezen',
          "'" + f.name + "' is geen model van de modelleertaal webapp.");
        return;
      }
      self.model_title = f.name.replace(/\.[^.]*$/, '');
      self.init_app();
      self.print_status("Model geladen uit " + f.name + ". Druk op Run.");
    };
    r.readAsText(f);
  }
  // allow to open the same file again
  $(this.dom_fileinput).val('');
};


ModelleertaalApp.prototype.download_model = function() {
  // download model in "BogusXML" format
  //  just a text file with XML like tags...

  var filename = this.file_name('.xml');
  this.read_model();

  var N = Number($(this.dom_nbox).val());
  if (isFinite(N) && N > 0) this.model.N = N;

  this.save_string(this.model.createBogusXMLString(), filename);
  // model is saved: do not warn for unsaved changes
  this.loaded = {modelregels: this.model.modelregels, startwaarden: this.model.startwaarden,
                 opdracht: this.opdracht, indeling: this.indeling_text()};
  this.autosave();
};


//
// Autosave: unsaved work is kept in the browser (localStorage), so it is not lost
// when the tab is closed. On the next visit the user can continue with it.
//
var AUTOSAVE_KEY = 'modelleertaal_autosave';
var AUTOSAVE_MAX_AGE = 30 * 24 * 3600 * 1000;   // 30 days
var SETTINGS_KEY = 'modelleertaal_instellingen';

function storage(action, value, key) {
  // localStorage can be blocked (private window, settings): then nothing is saved
  key = key || AUTOSAVE_KEY;
  try {
    if (action == 'get') return window.localStorage.getItem(key);
    if (action == 'set') window.localStorage.setItem(key, value);
    if (action == 'remove') window.localStorage.removeItem(key);
  } catch (err) {
    return null;
  }
  return null;
}


ModelleertaalApp.prototype.load_settings = function() {
  // settings of the user (Meer opties) from the last visit
  var settings;
  try {
    settings = JSON.parse(storage('get', null, SETTINGS_KEY)) || {};
  } catch (err) {
    settings = {};
  }
  var precision = Math.round(Number(settings.precision));
  if (precision >= 1 && precision <= 15) this.precision = precision;
  if (typeof settings.yaxis_zero == 'boolean') this.yaxis_autoscale = !settings.yaxis_zero;
  $(this.dom_precision).val(this.precision);
  $(this.dom_yaxis_zero).prop('checked', !this.yaxis_autoscale);
  this.set_grafisch_stijl(settings.grafisch_stijl, false);
  this.set_grafisch_formules(settings.grafisch_formules === true, false);
  this.set_grafisch_eenheden(settings.grafisch_eenheden === true, false);
  // Tekst | Tekst + grafisch is not remembered: every visit starts with Tekst
  // (but Verder werken goes back to the view of the saved work, see autosave)
  this.set_weergave('tekst', false);
};


ModelleertaalApp.prototype.save_settings = function() {
  storage('set', JSON.stringify({precision: this.precision, yaxis_zero: !this.yaxis_autoscale,
                                 grafisch_stijl: this.grafisch_stijl,
                                 grafisch_formules: this.grafisch_formules,
                                 grafisch_eenheden: this.grafisch_eenheden}), SETTINGS_KEY);
};


ModelleertaalApp.prototype.schedule_autosave = function() {
  var self = this;
  clearTimeout(this.autosave_timer);
  this.autosave_timer = setTimeout(function() { self.autosave(); }, 1000);
};


ModelleertaalApp.prototype.autosave = function() {
  clearTimeout(this.autosave_timer);
  this.autosave_timer = undefined;
  if (this.is_modified()) {
    var text = this.current_text();
    storage('set', JSON.stringify({
      t: this.get_title(),
      m: text.modelregels,
      s: text.startwaarden,
      N: String($(this.dom_nbox).val()),
      o: this.opdracht,
      p: this.indeling_text(),
      // the view (Tekst | Tekst + grafisch) goes with the work, not with the settings:
      // a new visit starts with Tekst (6.1.1), continuing with the work goes back to the diagram
      w: this.weergave,
      time: Date.now()
    }));
    this.restore_pending = false;
  } else if (!this.restore_pending && !this.restore_check) {
    // (not while the user can still choose to continue with the saved work)
    storage('remove');
  }
};


ModelleertaalApp.prototype.read_autosave = function() {
  // the saved work, or null
  var saved;
  try {
    saved = JSON.parse(storage('get'));
  } catch (err) {
    saved = null;
  }
  if (!saved || typeof saved.m != 'string' || typeof saved.s != 'string') return null;
  var age = Date.now() - Number(saved.time);
  if (isNaN(age) || age > AUTOSAVE_MAX_AGE) {
    storage('remove');
    return null;
  }
  return saved;
};


ModelleertaalApp.prototype.offer_restore = function() {
  // ask if the user wants to continue with the work of the last visit
  var self = this;
  if (this.parse_url_hash().code) return;   // a shared link: open that model
  var saved = this.read_autosave();
  if (!saved) return;

  var when = '';
  try {
    when = ' (' + new Date(saved.time).toLocaleString('nl-NL',
      {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'}) + ')';
  } catch (err) {
    when = '';
  }
  this.restore_pending = true;
  this.show_message('info', 'Verder werken?',
    "Je was bezig met " + (saved.t ? "'" + saved.t + "'" : "een model") + when + ". Dat is nog niet opgeslagen.", [
      {text: 'Ga verder', action: function() { self.restore_autosave(saved); }},
      {text: 'Weggooien', action: function() {
        self.restore_pending = false;
        storage('remove');
        self.clear_message();
      }}
    ]);
};


ModelleertaalApp.prototype.restore_autosave = function(saved) {
  if (this.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
      'Als je verder gaat met het bewaarde model, gaan je wijzigingen verloren.\n\nBewaard model laden?')) {
    return;
  }
  this.model = new evaluator_js.Model();
  this.model.modelregels = saved.m;
  this.model.startwaarden = saved.s;
  var N = Number(saved.N);
  if (isFinite(N) && N >= 1) this.model.N = N;
  this.model.opdracht = saved.o ? String(saved.o) : '';
  this.model.indeling = saved.p ? String(saved.p) : '';
  this.model_title = saved.t ? String(saved.t) : '';

  // in the menu, like a model from a shared link
  this.dropdown_extra('restored', (this.model_title || 'Model') + ' (bewaard)');
  if (window.history.replaceState) {
    window.history.replaceState('', document.title, window.location.pathname + window.location.search);
  }

  this.init_app();
  if (saved.w == 'grafisch') this.set_weergave('grafisch', false);
  // the restored model is not saved in a file: still warn before it is lost
  this.loaded = {modelregels: '', startwaarden: '', opdracht: '', indeling: ''};
  this.restore_pending = false;
  this.autosave();
  this.print_status('Model van de vorige keer teruggezet. Druk op Run.');
};


ModelleertaalApp.prototype.share_url = function() {
  // link to this model. If the model was changed, the model is put in the link.
  var base = window.location.origin + window.location.pathname;
  var entry = this.model_index[this.dropdown_value];
  var title = this.get_title();

  if (entry && !this.is_modified() && title == entry.title) {
    return base + '#model=' + this.model_name_from_url(entry.url);
  }
  this.read_model();
  var indeling = {};
  try {
    indeling = JSON.parse(this.indeling_text() || '{}');
  } catch (err) {
    indeling = {};
  }
  return base + '#code=' + deellink.encode({
    modelregels: this.model.modelregels,
    startwaarden: this.model.startwaarden,
    title: title,
    N: Number(String($(this.dom_nbox).val()).replace(',', '.')),
    opdracht: this.opdracht,
    indeling: indeling
  });
};


ModelleertaalApp.prototype.get_title = function() {
  // title of the model (editable by the user, goes into the share link)
  return $.trim($(this.dom_titel).val() || '');
};


ModelleertaalApp.prototype.file_name = function(extension, suffix) {
  // name of a downloaded file: the title of the model (+ suffix), without characters
  // that are not allowed in a file name. 'Examen vwo 2005-I Champignon (x,t).png'
  var name = this.get_title() || 'model';
  if (suffix) name += ' ' + suffix;
  name = name.replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^[\s.]+|[\s.]+$/g, '');
  return (name || 'model') + extension;
};


ModelleertaalApp.prototype.graph_name = function() {
  // the graph that is shown, as in the thumbnails: (y,x)
  if (this.multiplot) return '(' + this.multi_yvars.join(',') + ' tegen ' + this.xvar + ')';
  return '(' + this.yvar + ',' + this.xvar + ')';
};


ModelleertaalApp.prototype.update_document_title = function() {
  var title = this.get_title();
  document.title = title ? title + ' - Modelleertaal' : 'Modelleertaal webapp';
};


ModelleertaalApp.prototype.copy_share_url = function() {
  var self = this;
  var url = this.share_url();

  function fallback() {
    window.prompt('Kopieer deze link naar het model:', url);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      // confirmation in the button itself, where the user is looking
      var button = $(self.dom_permalink);
      if (!button.data('text')) button.data('text', button.text());
      button.text('Link gekopieerd ✓').addClass('done');
      clearTimeout(self.permalink_timer);
      self.permalink_timer = setTimeout(function() {
        button.text(button.data('text')).removeClass('done');
      }, 2000);
    }, fallback);
  } else {
    fallback();
  }
};


ModelleertaalApp.prototype.download_pgfplot = function() {
  // save the plot in TikZ/PGFPlot format
  var data = this.create_pgfplot();
  if (data === false) return;
  this.save_string(data, this.file_name('.tex', this.graph_name()));
};


ModelleertaalApp.prototype.download_tsv = function() {
  // download the results in TSV format.
  if (!this.require_results()) return;
  this.save_string(this.create_tsv(), this.file_name('.tsv'));
};


ModelleertaalApp.prototype.download_svg = function() {
  // download SVG Plot.
  var data = this.create_svgplot();
  if (data === false) return;
  this.save_string(data, this.file_name('.svg', this.graph_name()));
};


ModelleertaalApp.prototype.download_png = function() {
  // the graph as shown (with axes and labels) as a PNG image.
  // Flot draws the lines on canvases and the text in an SVG layer: compose them.
  var self = this;
  if (!this.require_results() || !this.plot_object) return;
  var sources = $(this.dom_graph).find('canvas, svg').toArray();
  var composed = document.createElement('canvas');
  var filename = this.file_name('.png', this.graph_name());
  var legend = this.multiplot ? this.multi_yvars.slice() : [];

  $.plot.composeImages(sources, composed).then(function() {
    var out = document.createElement('canvas');
    out.width = composed.width;
    out.height = composed.height;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(composed, 0, 0);
    // several graphs: the colours are next to the checkboxes on screen, put them in the image
    var scale = out.width / Math.max(1, $(self.dom_graph).width());
    ctx.font = Math.round(13 * scale) + 'px sans-serif';
    ctx.textBaseline = 'middle';
    legend.forEach(function(name, n) {
      var y = (16 + 18 * n) * scale, x = out.width - 110 * scale;
      ctx.fillStyle = COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length];
      ctx.fillRect(x, y - 2 * scale, 18 * scale, 4 * scale);
      ctx.fillStyle = '#111827';
      ctx.fillText(name, x + 24 * scale, y);
    });
    out.toBlob(function(blob) {
      FileSaver.saveAs(blob, filename);
    }, 'image/png');
  }, function() {
    self.show_message('error', 'Niet gelukt', 'De grafiek kon niet als plaatje worden opgeslagen.');
  });
};


ModelleertaalApp.prototype.save_string = function(data, filename) {
  // requires FileSaver.js and Blob.js
  // (Blob() not supported on most mobile browsers)

  // mime text/plain expects CRLF \r\n instead of \n
  // this should work on both Windows and Mac/Linux
  // (every \n, also the \n of an empty line)
  var blob = new Blob([data.replace(/\r?\n/g, "\r\n")], {
    type: "text/plain;charset=utf-8"
  });
  FileSaver.saveAs(blob, filename);
};


//
// Run
//
ModelleertaalApp.prototype.read_N = function(dom) {
  // read the number of iterations from input field. Return null if invalid
  var N = Number(String($(dom).val()).replace(',', '.'));

  if (!isFinite(N) || N < 1) {
    this.show_message('error', 'Aantal iteraties',
      "Vul bij het aantal iteraties een getal in (minimaal 1).");
    $(dom).focus();
    return null;
  }
  if (N > N_MAX) {
    this.show_message('error', 'Aantal iteraties',
      "Het aantal iteraties is te groot. Kies maximaal 1000000.");
    $(dom).focus();
    return null;
  }
  return Math.round(N);
};


ModelleertaalApp.prototype.run = function() {

  var N = this.read_N(this.dom_nbox);
  if (N === null) return false;
  this.N = N;

  // Run during Stap voor stap: compute the whole model again
  this.end_stepping();
  if (!this.setup_run()) return false;

  // keep the results of the previous run: plot in gray for comparison
  var previous = null;
  if (this.results_available() && this.last_source) {
    previous = {
      vars: this.allVars,
      rows: this.reduce_rows(this.results, this.max_rows_in_plot),
      source: this.last_source
    };
  }

  this.new_run = true;
  this.has_run = this.do_run();
  if (this.has_run) {
    // Houd vast: the gray line stays (the pinned run), else it is the previous run
    if (previous && !(this.pinned && this.previous)) this.previous = previous;
    if (!this.previous) this.pinned = false;
    this.last_source = vergelijk.source(this.evaluator.startwaarden_ast, this.evaluator.modelregels_ast, N);
    this.compare_text = this.previous ?
      vergelijk.describe(vergelijk.differences(this.previous.source, this.last_source)) : '';
    this.after_run();
    // small screen: the graph is below the model.
    this.reveal(this.dom_graph);
  }
  return this.has_run;
};


ModelleertaalApp.prototype.reveal = function(dom) {
  // scroll to element, if it is not on screen
  var element = $(dom)[0];
  if (!element || !element.getBoundingClientRect || !element.scrollIntoView) return;
  var rect = element.getBoundingClientRect();
  var visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (visible < Math.min(rect.height, window.innerHeight) / 2) {
    element.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }
};


ModelleertaalApp.prototype.format_text = function(x) {
  // number in a sentence (Dutch decimal comma): 0,981
  if (typeof x == 'boolean') return x ? 'waar' : 'onwaar';
  if (typeof x != 'number' || isNaN(x)) return '?';
  if (!isFinite(x)) return (x > 0) ? '\u221e' : '-\u221e';
  return String(Number(x.toPrecision(this.precision))).replace('.', ',');
};


//
// Stap voor stap: one modelregel per click, with the calculation in numbers (stapper.js)
//
ModelleertaalApp.prototype.step = function() {
  // first click (after loading, after a change, after a Run or at the end): start at the startwaarden
  if (!this.stepper || this.stepper.finished) {
    if (!this.start_stepping()) return false;
  }
  var step;
  try {
    step = this.stepper.step();
  } catch (err) {
    this.end_stepping();
    this.show_error(err);
    return false;
  }
  if (step) this.show_step(step);
  return true;
};


ModelleertaalApp.prototype.start_stepping = function() {
  var self = this;
  var N = this.read_N(this.dom_nbox);
  if (N === null) return false;

  this.end_stepping();
  this.remove_highlight_error();
  this.clear_message();
  this.read_model();
  this.units = eenheden.derive(this.model.startwaarden, this.model.modelregels).units;
  try {
    // check the model (and find the columns of the table) without computing an iteration
    var evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
    evaluator.set_state(0, true, false);
    evaluator.run();
    this.stepper = new stapper.Stepper(evaluator.startwaarden_ast, evaluator.modelregels_ast,
      evaluator.namespace.varNames, {N: N, format: function(x) { return self.format_text(x); }});
  } catch (err) {
    this.stepper = null;
    this.show_error(err);
    return false;
  }
  $(this.dom_datatable).addClass('stepping');
  return true;
};


ModelleertaalApp.prototype.show_step = function(step) {
  this.highlight_trace(step.line);
  if (this.CodeMirrorActive) {
    this.modelregels_editor.scrollIntoView({line: step.line - 1, ch: 0}, 40);
  }
  $(this.dom_step_line).text(step.text).prop('hidden', false);

  // the table: the cell that changed lights up
  this.step_mark = {row: step.iteration, column: this.stepper.varNames.indexOf(step.name)};
  this.print_table();
  this.plot_steps();

  var status;
  if (step.finished && this.stepper.stopped) {
    status = "Stap voor stap: het model is gestopt in iteratie " + step.iteration + ". Druk op Stap om opnieuw te beginnen.";
  } else if (step.finished) {
    status = "Stap voor stap: alle " + step.iteration + " iteraties zijn gedaan. Druk op Stap om opnieuw te beginnen.";
  } else if (step.end_of_iteration) {
    status = "Stap voor stap: iteratie " + step.iteration + " is klaar. De volgende stap begint weer bovenaan.";
  } else {
    status = "Stap voor stap: iteratie " + step.iteration + ".";
  }
  this.print_status(status);
};


ModelleertaalApp.prototype.end_stepping = function() {
  // back to the results of the last Run
  if (!this.stepper) return;
  this.stepper = null;
  this.step_mark = undefined;
  this.remove_highlight_trace();
  $(this.dom_step_line).prop('hidden', true).empty();
  $(this.dom_datatable).removeClass('stepping');
  $(this.dom_graph).removeClass('stepping');
  if (this.results_available()) {
    this.print_table();
    this.do_plot();
    this.print_status(this.stale ? "Model gewijzigd. Druk op Run." : "Klaar met stap voor stap. Druk op Run of Stap.");
  } else {
    $(this.dom_datatable).empty().append(
      $('<div>').addClass('placeholder').text('Hier komt de tabel met resultaten.'));
    if (this.plot_object) {
      this.plot_object.shutdown();
      this.plot_object = undefined;
    }
    $(this.dom_graph).empty().append(
      $('<div>').addClass('placeholder').text('Druk op Run om het model door te rekenen.'));
    $(this.dom_graph_note).empty();
    this.place_axis_picks();
    this.print_status("Druk op Run of Stap.");
  }
};


ModelleertaalApp.prototype.plot_steps = function() {
  // Stap voor stap: the graph of the last Run in gray (fixed axes), with the iterations
  // computed so far on top and a dot at the current point
  var self = this;
  if (!this.stepper) return;
  var rows = this.stepper.table(), vars = this.stepper.varNames;
  var x = this.xvar, ys = this.multiplot ? this.multi_yvars.slice() : [this.yvar];
  if (vars.indexOf(x) == -1) x = (vars.indexOf('t') != -1) ? 't' : vars[0];
  ys = ys.filter(function(name) { return vars.indexOf(name) != -1; });
  if (ys.length === 0) {
    var other = vars.filter(function(name) { return name != x; });
    if (other.length === 0) return;
    ys = [other[0]];
  }
  var last_run = this.results_available() ? this.reduce_rows(this.results, this.max_rows_in_plot) : null;
  var dataset = [], gray = false;
  ys.forEach(function(name, n) {
    var color = ys.length > 1 ? COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length] : COLOR_PLOT;
    var previous = last_run ? self.xy_data(last_run, self.allVars, x, name) : null;
    if (previous) {
      gray = true;
      dataset.push({data: previous, color: COLOR_PREVIOUS, points: {show: false}, hoverable: false, clickable: false});
    }
    var data = self.xy_data(rows, vars, x, name) || [];
    dataset.push({data: data, color: color, label: ys.length > 1 ? name : undefined, points: {show: data.length <= 60}});
    var now = null;
    for (var i = data.length - 1; i >= 0 && now === null; i--) now = data[i];
    if (now) {
      dataset.push({data: [now], color: COLOR_READ, lines: {show: false},
                    points: {show: true, radius: 5, fill: true, fillColor: COLOR_READ},
                    hoverable: false, clickable: false});
    }
  });
  this.read_xy = null;
  $(this.dom_graph_note).empty().append($('<span>').text(gray ?
    'Stap voor stap: de punten tot nu toe, grijs is de laatste Run.' : 'Stap voor stap: de punten tot nu toe.'));
  this.plot_graph(dataset, x, ys);
  $(this.dom_graph).addClass('stepping');
};


ModelleertaalApp.prototype.setup_run = function() {

  this.remove_highlight_trace();
  this.remove_highlight_error();
  this.remove_lint();
  clearTimeout(this.lint_timer);
  this.clear_message();

  this.read_model();
  this.units = eenheden.derive(this.model.startwaarden, this.model.modelregels).units;

  try {
    this.evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
  } catch (err) {
    this.show_error(err);
    return false;
  }
  return true;
};


ModelleertaalApp.prototype.do_run = function() {

  this.clear_message();

  try {
    this.evaluator.set_state(this.N, this.new_run, false);
    this.evaluator.run();
  } catch (err) {
    this.show_error(err);
    return false;
  }

  this.results = this.evaluator.result;
  this.allVars = this.evaluator.namespace.varNames;
  return true;
};


ModelleertaalApp.prototype.show_error = function(err) {
  // show error in model (from parser or evaluator).

  if (this.debug) console.log(err);

  var name = err.parser_name;
  var line = err.parser_line;
  var title, type;

  if (err.blank) {
    title = 'Het model is nog niet af';
    type = 'warning';
  } else if (err.empty) {
    title = 'Nog geen model';
    type = 'warning';
  } else {
    title = 'Fout';
    type = 'error';
  }
  if (name) {
    title += ' (' + name + (line ? ', regel ' + line : '') + ')';
  }
  this.show_message(type, title, err.message);
  this.print_status(type == 'error' ? "Fout in het model." : "Model niet uitgevoerd.");
  this.highlight_error(line, name, err.message);
  this.reveal(this.dom_message);
  if (this.results_available()) this.set_stale(true);
};


ModelleertaalApp.prototype.after_run = function() {

  if (this.allVars === undefined) return;

  this.set_stale(false);
  $(this.dom_download_tsv + ',' + this.dom_download_png).prop('hidden', false);

  this.analysis = autoplot.analyse(this.allVars, this.results, this.evaluator.modelregels_ast);
  this.graphs = this.analysis.graphs;

  this.choose_axes();
  this.update_axis_controls();

  this.read = null;
  this.print_table(10);
  this.do_plot();
  this.draw_thumbnails();

  this.print_run_status();
  this.check_results();
  // values in the tooltips of the diagram
  if (this.grafisch_open() && this.grafisch_g) this.render_grafisch_model();

  // is dt small enough? (after the graph is drawn: the student does not wait for this)
  var self = this;
  var run_id = this.run_id = (this.run_id || 0) + 1;
  clearTimeout(this.dtcheck_timer);
  this.dtcheck_timer = setTimeout(function() {
    if (run_id == self.run_id && !self.stale && !self.stepper) {
      self.check_dt();
      self.show_hint();
    }
  }, 30);
};


ModelleertaalApp.prototype.check_dt = function() {
  // run the model again with dt/2 (dtcheck.js). Different result: dt is too large.
  if ($(this.dom_message).is(':visible')) return;   // a warning or print() goes first
  var self = this;
  var result;
  try {
    result = dtcheck.check(this.model, this.N, {
      results: this.results,
      varNames: this.allVars,
      stopped: this.evaluator.stopped,
      runtime_ms: this.evaluator.runtime_ms,
      analysis: this.analysis
    });
  } catch (err) {
    if (this.debug) console.log('dtcheck', err);
    return;
  }
  if (result) {
    this.show_message('info', 'Is dt klein genoeg?', dtcheck.message(result, function(x) {
      return self.format_text(x);
    }));
  }
};


ModelleertaalApp.prototype.show_hint = function() {
  // a common mistake in the model (hints.js): one hint, as information, only if there is no
  // other message
  if ($(this.dom_message).is(':visible') || !this.evaluator) return;
  var list;
  try {
    list = hints.find(this.evaluator.startwaarden_ast, this.evaluator.modelregels_ast);
  } catch (err) {
    return;
  }
  if (list.length) this.show_message('info', 'Tip', list[0].text);
};


ModelleertaalApp.prototype.print_run_status = function() {

  var N_iterations = this.results.length - 1;
  var status;

  var iterations = N_iterations + (N_iterations == 1 ? " iteratie." : " iteraties.");
  if (this.evaluator.stopped) {
    status = "Model gestopt na " + iterations;
  } else {
    status = "Klaar na " + iterations;
  }
  if (this.analysis.time !== null) {
    var t = this.results[this.results.length - 1][this.allVars.indexOf(this.analysis.time)];
    if (typeof t == 'number' && isFinite(t)) {
      var unit = this.units.hasOwnProperty(this.analysis.time) ? ' ' + this.units[this.analysis.time] : '';
      status += " Eindtijd: " + this.analysis.time + " = " + Number(t.toPrecision(this.precision)) + unit + ".";
    }
  }
  this.print_status(status);

  if (!this.evaluator.stopped && contains_stop(this.evaluator.modelregels_ast)) {
    // the model has a stop condition, but did not get there: the graph is not finished
    var self = this;
    $(this.dom_status).append(document.createTextNode(" Het model is nog niet bij 'stop' gekomen."))
      .append($('<button type="button">').addClass('inline_action')
        .text('Verdubbel aantal iteraties')
        .click(function() {
          var N = Math.round(Number(String($(self.dom_nbox).val()).replace(',', '.')));
          if (!isFinite(N) || N < 1) N = self.results.length - 1;
          $(self.dom_nbox).val(Math.min(2 * N, N_MAX));
          self.update_endtime_hint(false);
          $(self.dom_run).click();
        }));
  }
};


function contains_stop(ast) {
  // is there a 'stop' in the modelregels (also inside als ... dan ... eindals)?
  for (var i = 0; i < (ast || []).length; i++) {
    var stmt = ast[i];
    if (stmt.type == 'Stop') return true;
    if ((stmt.type == 'If' || stmt.type == 'IfElse') &&
        (contains_stop(stmt.then) || contains_stop(stmt.elsestmt))) return true;
  }
  return false;
}


ModelleertaalApp.prototype.check_results = function() {
  // warn if the model 'explodes' (division by zero, sqrt of negative number,..)
  // and show the output of print()

  var last = this.results[this.results.length - 1];
  var first_bad_row = Infinity;
  var bad_var;

  for (var j = 0; j < this.allVars.length; j++) {
    if (typeof last[j] != 'number' || isFinite(last[j])) continue;

    // find the first row without a valid number. (row 0: startwaarden)
    var seen_valid = false;
    var bad_row = -1;
    for (var i = 1; i < this.results.length; i++) {
      var ok = isFinite(this.results[i][j]);
      if (ok) {
        seen_valid = true;
        bad_row = -1;
      } else if (bad_row == -1) {
        bad_row = i;
      }
    }
    var info = this.analysis.info[this.allVars[j]];
    // a variable that only gets a value inside als..dan..eindals can be empty.
    if (!seen_valid && info && info.conditional && isNaN(last[j])) continue;

    if (bad_row != -1 && bad_row < first_bad_row) {
      first_bad_row = bad_row;
      bad_var = this.allVars[j];
    }
  }

  if (bad_var !== undefined) {
    // name the most probable cause (oorzaak.js), not three questions at once
    var cause = null;
    try {
      cause = oorzaak.find(this.evaluator.modelregels_ast, this.allVars, this.results, first_bad_row,
                           this.constant_values(this.evaluator.namespace.constNames));
    } catch (err) {
      cause = null;
    }
    this.show_message('warning', 'Let op', oorzaak.message(cause, first_bad_row, bad_var));
  } else if (this.evaluator.messages.length > 0) {
    this.show_message('info', 'print', this.evaluator.messages.join(' '));
  }
};


//
// Axis
//
ModelleertaalApp.prototype.has_var = function(name) {
  return this.allVars.indexOf(name) != -1;
};


ModelleertaalApp.prototype.choose_axes = function() {
  // keep the graph chosen by the user (if possible). Else: best automatic graph.
  var self = this;

  this.multi_yvars = this.multi_yvars.filter(function(name) {
    return self.has_var(name);
  });

  if (this.user_axes && this.has_var(this.xvar) && this.has_var(this.yvar)) return;

  this.user_axes = false;
  if (this.graphs.length > 0) {
    this.xvar = this.graphs[0].x;
    this.yvar = this.graphs[0].y;
  } else {
    this.xvar = this.allVars[0];
    this.yvar = this.allVars[this.allVars.length > 1 ? 1 : 0];
  }
};


ModelleertaalApp.prototype.update_axis_controls = function() {
  // (re)set varNames in drop-down select fields and checkboxes

  var i, name;

  $(this.dom_x_var).empty();
  $(this.dom_y_var).empty();
  $(this.dom_y_checks).empty();

  if (!this.results_available()) {
    $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
    $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  } else {
    for (i = 0; i < this.allVars.length; i++) {
      name = this.allVars[i];
      $('<option/>').val(name).text(eenheden.label(name, this.units)).appendTo(this.dom_x_var);
      $('<option/>').val(name).text(eenheden.label(name, this.units)).appendTo(this.dom_y_var);
      $('<label/>').append(
        $('<input type="checkbox">').val(name)
          .prop('checked', this.multi_yvars.indexOf(name) != -1)
      ).append($('<span>').addClass('swatch'))
       .append(document.createTextNode(name)).appendTo(this.dom_y_checks);
    }
    $(this.dom_x_var).val(this.xvar);
    $(this.dom_y_var).val(this.yvar);
  }

  $(this.dom_multiplot).prop('checked', this.multiplot);
  $(this.dom_yaxis_zero).prop('checked', !this.yaxis_autoscale);
  $(this.dom_y_var).toggle(!this.multiplot);
  $(this.dom_y_checks).css('display', this.multiplot ? 'flex' : 'none');
};


//
// Table
//
ModelleertaalApp.prototype.format_number = function(x, column) {
  // format number in table. column (optional): index of column in results
  if (typeof x != 'number') return (x) ? 'Waar' : 'Onwaar';
  if (isNaN(x)) return "\u2013";
  if (!isFinite(x)) return (x > 0) ? "\u221e" : "-\u221e";
  // hide floating point noise (1e-17 instead of 0)
  if (x === 0) return "0";
  if (column !== undefined && this.column_scale && Math.abs(x) < 1e-10 * this.column_scale[column]) return "0";
  return x.toPrecision(this.precision);
};


ModelleertaalApp.prototype.compute_column_scale = function(rows, vars) {
  // largest absolute value in each column
  var scale = [];
  var i, j, val;
  for (j = 0; j < vars.length; j++) scale.push(0);
  for (i = 0; i < rows.length; i++) {
    for (j = 0; j < scale.length; j++) {
      val = Math.abs(rows[i][j]);
      if (val > scale[j] && isFinite(val)) scale[j] = val;
    }
  }
  this.column_scale = scale;
};


ModelleertaalApp.prototype.table_header = function(vars) {
  var firstrow = $('<tr>');
  firstrow.append($('<th>').text('#'));

  for (var k = 0; k < vars.length; k++) {
    firstrow.append($('<th>').text(eenheden.label(vars[k], this.units)));
  }
  return firstrow;
};


ModelleertaalApp.prototype.table_row = function(rows, rowIndex, mark_column) {
  // mark_column (optional): the cell that just changed (Stap voor stap)
  var row = $('<tr>').attr('data-row', rowIndex);
  row.append($('<td>').text(rowIndex));
  if (!this.stepper && this.read && this.read.row == rowIndex) row.addClass('mt-read-row');

  for (var j = 0; j < rows[rowIndex].length; j++) {
    var cell = $('<td>').text(this.format_number(rows[rowIndex][j], j));
    if (j === mark_column) cell.addClass('mt-step-cell');
    row.append(cell);
  }
  if (mark_column !== undefined) row.addClass('mt-step-row');
  return row;
};


ModelleertaalApp.prototype.print_table = function(limit) {
  // truncated row from: jquery.jsparc.js
  // http://github.com/HiSPARC/jSPARC

  var self = this;

  // Stap voor stap: the rows computed so far. Else: the last Run.
  var rows = this.stepper ? this.stepper.table() : this.results;
  var vars = this.stepper ? this.stepper.varNames : this.allVars;
  var mark = this.stepper ? this.step_mark : undefined;

  this.compute_column_scale(rows, vars);

  // the number of rows shown stays (also after a click on a row)
  if (limit) this.table_limit = limit;
  limit = Math.min(rows.length, this.table_limit || 10);
  // this row is always shown: the step, or the point that is read in the graph
  var focus = mark ? mark.row : (this.read ? this.read.row : undefined);
  var shown = function(i) {
    return limit >= rows.length || i < Math.floor(limit / 2) || i >= rows.length - Math.ceil(limit / 2) ||
           (focus !== undefined && Math.abs(i - focus) <= 2);
  };

  var table = $('<table>').addClass('table');
  table.append($('<thead>').append(this.table_header(vars)));
  var body = $('<tbody>').appendTo(table);

  var show_more = function() {
    self.print_table(limit * 5);
  };

  for (var i = 0; i < rows.length; i++) {
    if (shown(i)) {
      body.append(this.table_row(rows, i, (mark && mark.row == i) ? mark.column : undefined));
      continue;
    }
    var j = i;
    while (j < rows.length && !shown(j)) j++;
    var truncrow = $('<tr>').addClass('truncated');
    truncrow.append($('<td>')
      .attr('colspan', vars.length + 1)
      .append($('<button type="button">')
        .text('\u22ee  ' + (j - i) + (j - i == 1 ? ' rij' : ' rijen') + ' verborgen. Klik voor meer rijen.')
        .click(show_more)));
    body.append(truncrow);
    i = j - 1;
  }

  $(self.dom_datatable).empty().append($('<div>').addClass('table_scroll').append(table));
};


//
// Plotten
//
ModelleertaalApp.prototype.results_available = function() {
  return (this.results !== undefined && this.results.length > 0);
};


ModelleertaalApp.prototype.require_results = function() {
  if (this.results_available()) return true;
  this.show_message('warning', 'Geen resultaten', 'Druk eerst op Run.');
  return false;
};


ModelleertaalApp.prototype.xy_data = function(rows, vars, xvar, yvar) {
  // create [[x, y], ...] from rows. Returns null if variables do not exist
  var xi = vars.indexOf(xvar);
  var yi = vars.indexOf(yvar);
  var data = [];
  var x, y;

  if (xi == -1 || yi == -1) return null;

  for (var i = 0; i < rows.length; i++) {
    x = rows[i][xi];
    y = rows[i][yi];
    if (typeof x == 'boolean') x = x ? 1 : 0;
    if (typeof y == 'boolean') y = y ? 1 : 0;
    if (isFinite(x) && isFinite(y)) {
      data.push([x, y]);
    } else {
      data.push(null); // gap in plot
    }
  }
  return data;
};


ModelleertaalApp.prototype.do_plot = function() {

  var self = this;

  if (!this.results_available()) {
    return false;
  }

  var rows = this.reduce_rows(this.results, this.max_rows_in_plot);
  this.rowinc = this.row_increment(this.results, this.max_rows_in_plot);

  var show_points = (rows.length <= 60);
  var dataset = [];
  var y_names = [];
  var note = '';

  // another graph: not zoomed in anymore
  if (this.zoom && this.zoom.key != this.zoom_key()) this.zoom = null;
  $(this.dom_zoom_reset).prop('hidden', !this.zoom);

  // several graphs with a very different range: the small ones on a second axis (right)
  var split = {left: this.multiplot ? this.multi_yvars : [this.yvar], right: []};
  if (this.multiplot) {
    var ranges = {};
    this.multi_yvars.forEach(function(name) {
      ranges[name] = assen.data_range(self.xy_data(rows, self.allVars, self.xvar, name));
    });
    split = assen.split(this.multi_yvars, ranges);
  }
  this.axis_of = function(name) {
    return (split.right.indexOf(name) != -1) ? 2 : 1;
  };

  var has_previous = false;
  var push_previous = function(yvar) {
    var data = (self.previous) ? self.xy_data(self.previous.rows, self.previous.vars, self.xvar, yvar) : null;
    if (data === null) return;
    has_previous = true;
    dataset.push({
      data: data,
      color: COLOR_PREVIOUS,
      yaxis: self.axis_of(yvar),
      mt_previous: true,
      points: {show: false},
      hoverable: false,
      clickable: false
    });
  };

  if (this.multiplot) {
    this.multi_yvars.forEach(push_previous);
    this.multi_yvars.forEach(function(name, n) {
      dataset.push({
        data: self.xy_data(rows, self.allVars, self.xvar, name),
        color: COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length],
        label: name,
        mt_yvar: name,
        yaxis: self.axis_of(name),
        points: {show: show_points}
      });
    });
    y_names = split.left;
    if (dataset.length === 0) note = 'Vink hieronder aan welke variabelen je wilt zien.';
    // legend: colour next to the checkbox, and which graphs use the axis on the right
    $(this.dom_y_checks).find('label').each(function() {
      var name = $(this).find('input').val();
      var n = self.multi_yvars.indexOf(name);
      $(this).find('.swatch')
        .css('background-color', COLORS_MULTIPLOT[Math.max(n, 0) % COLORS_MULTIPLOT.length])
        .css('display', (n == -1) ? 'none' : 'inline-block');
      $(this).find('.as_rechts').remove();
      if (split.right.indexOf(name) != -1) $(this).append($('<span class="as_rechts">').text(' (as rechts)'));
    });
  } else {
    push_previous(this.yvar);
    dataset.push({
      data: this.xy_data(rows, this.allVars, this.xvar, this.yvar),
      color: COLOR_PLOT,
      mt_yvar: this.yvar,
      points: {show: show_points}
    });
    y_names = [this.yvar];
  }

  var read_text = this.read_point(dataset);
  var note_box = $(this.dom_graph_note).empty();
  if (has_previous) {
    note_box.append($('<span>').text((this.pinned ? 'Grijs: vastgehouden run' : 'Grijs: vorige run') +
      (this.compare_text ? ' (' + this.compare_text + ')' : '') + '.'));
    note_box.append($('<button type="button">').addClass('pin small_action')
      .attr('aria-pressed', String(Boolean(this.pinned)))
      .attr('title', this.pinned ?
        'De grijze lijn blijft staan bij volgende runs. Klik om weer de vorige run te tonen.' :
        'Houd deze grijze lijn vast: hij blijft dan staan bij volgende runs')
      .text('\ud83d\udccc Houd vast'));
  }
  if (note) note_box.append($('<span>').text(' ' + note));
  this.plot_graph(dataset, this.xvar, y_names, split.right);
  if (read_text) read_text = read_text.concat(this.tangent_text());
  this.show_read_label(read_text);
  this.select_thumbnail();
}; // do_plot


//
// Aflezen: the point that was clicked in the graph (or the row in the table)
//
ModelleertaalApp.prototype.set_read = function(read) {
  // read: {row (in this.results), yvar}, or null
  if (!read && !this.read) return;
  this.read = read;
  if (!this.results_available()) return;
  this.do_plot();
  if (!this.stepper) this.print_table();
};


ModelleertaalApp.prototype.zoom_key = function() {
  // the graph that is shown: zooming in belongs to this graph
  return [this.xvar, this.multiplot ? this.multi_yvars.join(',') : this.yvar, this.multiplot].join('|');
};


ModelleertaalApp.prototype.zoom_position = function(event) {
  // mouse position in the plot area (pixels), limited to the plot area
  var off = this.plot_object.getPlotOffset();
  var g = $(this.dom_graph).offset();
  var x = event.pageX - g.left - off.left, y = event.pageY - g.top - off.top;
  var w = this.plot_object.width(), h = this.plot_object.height();
  return {inside: x >= 0 && y >= 0 && x <= w && y <= h,
          x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y))};
};


ModelleertaalApp.prototype.set_zoom = function(zoom) {
  if (!zoom && !this.zoom) return;
  this.zoom = zoom;
  if (this.results_available()) this.do_plot();
};


ModelleertaalApp.prototype.read_point = function(dataset) {
  // adds the point to dataset (the tangent: plot_graph). Returns the text next to the point, or null.
  var self = this;
  var read = this.read;
  this.read_xy = null;
  this.read_tangent = null;
  if (!read || !this.results_available() || !this.results[read.row]) return null;
  var shown = this.multiplot ? this.multi_yvars : [this.yvar];
  if (shown.indexOf(read.yvar) == -1) return null;
  var xi = this.allVars.indexOf(this.xvar), yi = this.allVars.indexOf(read.yvar);
  if (xi == -1 || yi == -1) return null;
  var x = this.results[read.row][xi], y = this.results[read.row][yi];
  if (typeof x != 'number' || typeof y != 'number' || !isFinite(x) || !isFinite(y)) return null;

  function value(name, val) {
    var unit = self.units.hasOwnProperty(name) ? ' ' + self.units[name] : '';
    return name + ' = ' + self.format_text(val) + unit;
  }
  var text = [value(this.xvar, x), value(read.yvar, y)];
  var axis = this.axis_of ? this.axis_of(read.yvar) : 1;

  // the slope: a tangent from axis to axis (only with one graph: which line would it be?). It is drawn
  // in plot_graph, when the axes are known. A click on the tangent shows the calculation of the helling.
  this.read_tangent = null;
  if (!this.multiplot) {
    var slope = aflezen.slope(this.results, xi, yi, read.row);
    if (slope !== null) {
      this.read_tangent = {point: [x, y], slope: slope, axis: axis, xvar: this.xvar, yvar: read.yvar,
                           line: null};
    }
  }
  dataset.push({data: [[x, y]], color: COLOR_READ, lines: {show: false}, yaxis: axis,
                points: {show: true, radius: 5, fill: true, fillColor: COLOR_READ},
                mt_read: true, hoverable: false, clickable: false});
  this.read_xy = [x, y];
  this.read_axis = axis;
  return text;
};


ModelleertaalApp.prototype.tangent_text = function() {
  // the helling from the two ends of the tangent: delta y / delta x, as on paper (DIDACTIEK.md)
  var self = this;
  var t = this.read_tangent;
  if (!t || !t.line || !this.read) return [];
  if (!this.read.tangent) return [{text: 'klik op de raaklijn voor de helling', cls: 'read_hint'}];
  var a = t.line[0], b = t.line[1];
  var dx = b[0] - a[0], dy = b[1] - a[1];
  function num(v) { return self.format_text(v).replace('-', '\u2212'); }
  function minus(v) { return (v < 0) ? '(' + num(v) + ')' : num(v); }
  function difference(v1, v2) { return num(v2) + ' − ' + minus(v1); }
  var slope_unit = aflezen.slope_unit(this.units[t.yvar], this.units[t.xvar]);
  // helling = (delta y)/(delta x) = (y2 - y1)/(x2 - x1) = ..., as real fractions (show_read_label)
  return [{cls: 'read_calc read_first read_result', parts: [
    'helling = ',
    {num: 'Δ' + t.yvar, den: 'Δ' + t.xvar},
    ' = ',
    {num: difference(a[1], b[1]), den: difference(a[0], b[0])},
    ' = ' + num(dy / dx) + (slope_unit ? ' ' + slope_unit : '')
  ]}];
};


ModelleertaalApp.prototype.near_tangent = function(pos) {
  // is the mouse (pos of plotclick/plothover) on the tangent? Not on the point itself: that is the graph.
  var t = this.read_tangent;
  if (!t || !t.line || !this.plot_object || !pos) return false;
  var g = $(this.dom_graph).offset();
  var mx = pos.pageX - g.left, my = pos.pageY - g.top;
  var plot = this.plot_object;
  function px(p) {
    var o = plot.pointOffset({x: p[0], y: p[1], yaxis: t.axis || 1});
    return [o.left, o.top];
  }
  var a = px(t.line[0]), b = px(t.line[1]), c = px(t.point);
  if (Math.sqrt(Math.pow(mx - c[0], 2) + Math.pow(my - c[1], 2)) < 10) return false;
  var vx = b[0] - a[0], vy = b[1] - a[1];
  var f = ((mx - a[0]) * vx + (my - a[1]) * vy) / (vx * vx + vy * vy || 1);
  f = Math.max(0, Math.min(1, f));
  var d = Math.sqrt(Math.pow(mx - a[0] - f * vx, 2) + Math.pow(my - a[1] - f * vy, 2));
  return d < 8;
};


ModelleertaalApp.prototype.show_read_label = function(text) {
  // the values of the point that is read, next to the point in the graph
  if (!text || !this.plot_object || !this.read_xy) return;
  var graph = $(this.dom_graph);
  var off = this.plot_object.pointOffset({x: this.read_xy[0], y: this.read_xy[1], yaxis: this.read_axis || 1});
  // zoomed in: the point can be outside the graph
  var box = this.plot_object.getPlotOffset();
  if (off.left < box.left || off.left > box.left + this.plot_object.width() ||
      off.top < box.top || off.top > box.top + this.plot_object.height()) return;
  var self = this;
  var label = $('<div class="read_label">').appendTo(graph);
  text.forEach(function(line) {
    if (typeof line == 'string') line = {text: line};
    var div = $('<div>').addClass(line.cls || '').appendTo(label);
    if (!line.parts) {
      div.text(line.text);
      return;
    }
    // text and fractions {num, den}
    line.parts.forEach(function(part) {
      if (typeof part == 'string') {
        div.append($('<span>').text(part));
      } else {
        div.append($('<span class="frac">')
          .append($('<span class="frac_num">').text(part.num))
          .append($('<span class="frac_den">').text(part.den)));
      }
    });
  });
  // a click on the tangent: the values at both ends, next to the ends
  var t = this.read_tangent;
  var taken = [];   // the labels at the ends: the label of the point must not cover them
  if (t && t.line && this.read && this.read.tangent) {
    t.line.forEach(function(p, i) {
      var o = self.plot_object.pointOffset({x: p[0], y: p[1], yaxis: t.axis || 1});
      var end = $('<div class="read_label read_end">').appendTo(graph)
        .text('(' + self.format_text(p[0]) + '; ' + self.format_text(p[1]) + ')');
      var ew = end.outerWidth(), eh = end.outerHeight();
      var el = (i === 0) ? o.left + 8 : o.left - ew - 8;
      var et = (o.top - eh - 6 < 0) ? o.top + 6 : o.top - eh - 6;
      el = Math.max(0, Math.min(graph.width() - ew, el));
      end.css({left: el + 'px', top: et + 'px'});
      taken.push([el, et, ew, eh]);
    });
  }
  var w = label.outerWidth(), h = label.outerHeight();
  // next to the point, not on the tangent: a rising tangent goes up to the right, so then below right
  var right = off.left + 12, left = off.left - w - 12, above = off.top - h - 10, below = off.top + 12;
  var places = [[right, above], [right, below], [left, above], [left, below]];
  if (t && t.line && t.slope > 0) places = [[right, below], [left, above], [right, above], [left, below]];
  if (t && t.line && t.slope < 0) places = [[right, above], [left, below], [right, below], [left, above]];
  var place = places.filter(function(p) {
    return p[0] >= 0 && p[0] + w <= graph.width() && p[1] >= 0 && p[1] + h <= graph.height() &&
      taken.every(function(r) {
        return p[0] >= r[0] + r[2] || p[0] + w <= r[0] || p[1] >= r[1] + r[3] || p[1] + h <= r[1];
      });
  })[0] || places[0];
  label.css({left: Math.max(0, place[0]) + 'px', top: Math.max(0, place[1]) + 'px'});
};


ModelleertaalApp.prototype.plot_graph = function(dataset, x_name, y_names, y2_names) {
  // y_names: the variables on the vertical axis, y2_names (optional): on the second axis (right).
  // The axes show the units (eenheden.js)

  var self = this;
  y2_names = y2_names || [];
  var x_label = eenheden.label(x_name, this.units);
  var y_label = eenheden.labels(y_names, this.units);
  var y2_label = eenheden.labels(y2_names, this.units);
  var zoom = this.zoom ? this.zoom.ranges : null;

  if ($(this.dom_graph).width() === 0 || $(this.dom_graph).height() === 0) return;

  // plot the y-axis from 0, unless autoscale. Zoomed in: the rectangle.
  function y_range(n, zoomed) {
    if (zoomed) return {min: zoomed.from, max: zoomed.to, autoScale: 'none'};
    var range = {};
    if (self.yaxis_autoscale) return range;
    var min = Infinity, max = -Infinity;
    dataset.forEach(function(series) {
      if ((series.yaxis || 1) != n) return;
      series.data.forEach(function(point) {
        if (point === null) return;
        if (point[1] < min) min = point[1];
        if (point[1] > max) max = point[1];
      });
    });
    if (min >= 0) range.min = 0;
    if (max <= 0) range.max = 0;
    return range;
  }
  var y1 = y_range(1, zoom && zoom.yaxis);
  var y2 = y_range(2, zoom && zoom.y2axis);

  function sciFormatter(val, axis) {
    // format large numbers in scientific notation: 1e6
    if (Math.abs(val) > 9e4)
      return val.toExponential(1);
    else
      return $.plot.defaultTickFormatter(val, axis);
  }

  function short(val) {
    return String(Number(Number(val).toPrecision(self.precision)));
  }

  function value(name, val) {
    // 'v = 3.2 m/s'
    var unit = self.units.hasOwnProperty(name) ? ' ' + self.units[name] : '';
    return name + ' = ' + short(val) + unit;
  }

  function axis_lines(axes) {
    // the lines x = 0 and y = 0 when they are inside the graph (gh-37)
    var lines = [];
    function inside(axis) { return axis.min < 0 && axis.max > 0; }
    if (inside(axes.yaxis)) lines.push({yaxis: {from: 0, to: 0}, color: '#4b5563', lineWidth: 1});
    if (inside(axes.xaxis)) lines.push({xaxis: {from: 0, to: 0}, color: '#4b5563', lineWidth: 1});
    // Aflezen: from the point to both axes, as on paper
    if (self.read_xy) {
      var x = self.read_xy[0], y = self.read_xy[1];
      if (self.read_axis == 2 && axes.y2axis) {
        // a graph on the right axis: the line goes to the right
        lines.push({xaxis: {from: x, to: x}, y2axis: {from: axes.y2axis.min, to: y}, color: COLOR_READ, lineWidth: 1});
        lines.push({y2axis: {from: y, to: y}, xaxis: {from: x, to: axes.xaxis.max}, color: COLOR_READ, lineWidth: 1});
      } else {
        lines.push({xaxis: {from: x, to: x}, yaxis: {from: axes.yaxis.min, to: y}, color: COLOR_READ, lineWidth: 1});
        lines.push({yaxis: {from: y, to: y}, xaxis: {from: axes.xaxis.min, to: x}, color: COLOR_READ, lineWidth: 1});
      }
    }
    return lines;
  }

  var axis_font = {
    size: 13,
    lineHeight: 14,
    family: "sans-serif",
    color: "#4b5563"
  };

  $(this.dom_graph).empty().toggleClass('zoomable', this.zoom_enabled);

  var yaxes = [{
      font: axis_font,
      showTicks: false,
      position: 'left',
      tickFormatter: sciFormatter,
      min: y1.min,
      max: y1.max,
      autoScale: y1.autoScale,
      axisLabel: y_label
    }];
  if (y2_names.length) {
    yaxes.push({
      font: axis_font,
      showTicks: false,
      position: 'right',
      tickFormatter: sciFormatter,
      min: y2.min,
      max: y2.max,
      autoScale: y2.autoScale,
      axisLabel: y2_label
    });
  }

  var options = {
    series: {
      lines: {
        show: true,
        lineWidth: 2
      },
      points: {
        radius: 2,
        fill: true
      },
      shadowSize: 0
    },
    grid: {
      hoverable: true,
      clickable: true,
      borderWidth: 1,
      borderColor: '#9ca3af',
      markings: axis_lines
    },
    axisLabels: {
      show: true
    },
    xaxis: {
      font: axis_font,
      showTicks: false,
      tickFormatter: sciFormatter,
      min: zoom ? zoom.xaxis.from : undefined,
      max: zoom ? zoom.xaxis.to : undefined,
      autoScale: zoom ? 'none' : undefined,
      axisLabel: x_label
    },
    yaxes: yaxes,
    legend: {
      show: false
    },
    tooltip: {
      show: true,
      content: function(label, x, y) {
        return value(x_name, x) + ", " + value(label || y_names[0], y);
      }
    }
  };
  this.plot_object = $.plot($(this.dom_graph), dataset, options);

  // Aflezen: the tangent from axis to axis. The axes are known now: plot again with the tangent and the
  // same axes (the tangent must not change the axes).
  var t = this.read_tangent;
  if (t) {
    var axes = this.plot_object.getAxes();
    var ya = (t.axis == 2 && axes.y2axis) ? axes.y2axis : axes.yaxis;
    t.line = aflezen.tangent_to_axes(t.point, t.slope,
                                     {xmin: axes.xaxis.min, xmax: axes.xaxis.max, ymin: ya.min, ymax: ya.max});
    if (t.line) {
      var tangent = [{data: t.line, color: COLOR_READ, lines: {show: true, lineWidth: 2}, yaxis: t.axis || 1,
                      points: {show: false}, mt_read: true, hoverable: false, clickable: false}];
      if (this.read && this.read.tangent) {
        tangent.push({data: t.line, color: COLOR_READ, lines: {show: false}, yaxis: t.axis || 1,
                      points: {show: true, radius: 4, fill: true, fillColor: '#ffffff'},
                      mt_read: true, hoverable: false, clickable: false});
      }
      // under the point that was clicked (the last series)
      Array.prototype.splice.apply(dataset, [dataset.length - 1, 0].concat(tangent));
      options.xaxis.min = axes.xaxis.min;
      options.xaxis.max = axes.xaxis.max;
      options.xaxis.autoScale = 'none';
      options.yaxes.forEach(function(yaxis, i) {
        var used = axes[i ? 'y2axis' : 'yaxis'];
        if (!used) return;
        yaxis.min = used.min;
        yaxis.max = used.max;
        yaxis.autoScale = 'none';
      });
      $(this.dom_graph).empty();
      this.plot_object = $.plot($(this.dom_graph), dataset, options);
    }
  }
  this.place_axis_picks();
}; // plot_graph()


ModelleertaalApp.prototype.place_axis_picks = function() {
  // choose the variables on the axes on the axis labels themselves: an invisible menu
  // on top of the label (the label is part of the graph, also in the PNG)
  var self = this;
  var wrap = $(this.dom_graph).parent()[0];
  var base = wrap.getBoundingClientRect();
  var ok = this.results_available() && this.plot_object;
  function place(pick, label_class, show) {
    var label = $(self.dom_graph).find('.' + label_class)[0];
    if (!show || !label || !label.getBoundingClientRect) {
      $(pick).prop('hidden', true);
      return;
    }
    var r = label.getBoundingClientRect();
    var w = Math.max(r.width + 8, 26), h = Math.max(r.height + 6, 26);
    $(pick).prop('hidden', false).css({
      left: Math.round(r.left - base.left + r.width / 2 - w / 2) + 'px',
      top: Math.round(r.top - base.top + r.height / 2 - h / 2) + 'px',
      width: Math.round(w) + 'px',
      height: Math.round(h) + 'px'
    });
  }
  place(this.dom_x_pick, 'x1Label', ok);
  place(this.dom_y_pick, 'y1Label', ok && !this.multiplot);
};


//
// Thumbnails: all automatic graphs. Click to enlarge.
//
ModelleertaalApp.prototype.draw_thumbnails = function() {

  var container = $(this.dom_graph_tabs).empty();

  if (!this.results_available() || this.graphs.length < 2) {
    return;
  }

  var rows = this.reduce_rows(this.results, 150);

  for (var i = 0; i < this.graphs.length; i++) {
    var graph = this.graphs[i];
    var canvas = $('<canvas>')[0];
    var button = $('<button type="button">')
      .data('index', i)
      .attr('title', 'Grafiek van ' + graph.y + ' tegen ' + graph.x)
      .append(canvas)
      .append($('<span>').text('(' + graph.y + ',' + graph.x + ')'))
      .appendTo(container);
    var previous = (this.previous) ?
      this.xy_data(this.previous.rows, this.previous.vars, graph.x, graph.y) : null;
    draw_sparkline(canvas, this.xy_data(rows, this.allVars, graph.x, graph.y), previous);
    button.toggleClass('selected', false);
  }
  this.select_thumbnail();
};


ModelleertaalApp.prototype.select_thumbnail = function() {
  // highlight the thumbnail of the graph that is shown
  var self = this;
  $(this.dom_graph_tabs).find('button').each(function() {
    var graph = self.graphs[$(this).data('index')];
    var selected = !self.multiplot && graph && graph.x == self.xvar && graph.y == self.yvar;
    $(this).toggleClass('selected', Boolean(selected)).attr('aria-pressed', String(Boolean(selected)));
  });
};


function draw_sparkline(canvas, data, previous) {
  // minimal line graph without axis.
  var width = 112, height = 64, pad = 6;
  var ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  (data || []).forEach(function(point) {
    if (point === null) return;
    if (point[0] < xmin) xmin = point[0];
    if (point[0] > xmax) xmax = point[0];
    if (point[1] < ymin) ymin = point[1];
    if (point[1] > ymax) ymax = point[1];
  });
  if (xmin == Infinity) return;
  // include y = 0 (same as large plot)
  if (ymin > 0) ymin = 0;
  if (ymax < 0) ymax = 0;
  if (xmax == xmin) xmax = xmin + 1;
  if (ymax == ymin) ymax = ymin + 1;

  function px(x) {
    return pad + (x - xmin) / (xmax - xmin) * (width - 2 * pad);
  }
  function py(y) {
    return height - pad - (y - ymin) / (ymax - ymin) * (height - 2 * pad);
  }

  function line(points, color, linewidth) {
    var pen_down = false;
    ctx.beginPath();
    points.forEach(function(point) {
      if (point === null) {
        pen_down = false;
        return;
      }
      if (pen_down) {
        ctx.lineTo(px(point[0]), py(point[1]));
      } else {
        ctx.moveTo(px(point[0]), py(point[1]));
        pen_down = true;
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // axis: y = 0
  line([[xmin, 0], [xmax, 0]], '#d1d5db', 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  if (previous) line(previous, COLOR_PREVIOUS, 1.5);
  line(data, COLOR_PLOT, 1.75);
  ctx.restore();
}


ModelleertaalApp.prototype.set_max_rows_in_plot = function(max_rows) {
  max_rows = Math.round(Number(max_rows));
  if (!isFinite(max_rows) || max_rows < 2) {
    $(this.dom_max_rows).val(this.max_rows_in_plot);
    return;
  }
  this.max_rows_in_plot = max_rows;
  if (this.results_available()) this.do_plot();
};

ModelleertaalApp.prototype.set_precision = function(precision) {
  precision = Math.round(Number(precision));
  if (!isFinite(precision) || precision < 1 || precision > 15) {
    $(this.dom_precision).val(this.precision);
    return;
  }
  this.precision = precision;
  this.save_settings();
  this.update_endtime_hint(false);
  if (this.results_available()) this.print_table();
};

ModelleertaalApp.prototype.read_model_from_xml = function(XMLString) {
  this.model = new evaluator_js.Model();
  this.model.parseBogusXMLString(XMLString);
};


//
// Reset
//
ModelleertaalApp.prototype.init_app = function() {
  if (this.CodeMirrorActive) {
    this.modelregels_editor.setValue(this.model.modelregels);
    this.startwaarden_editor.setValue(this.model.startwaarden);
    this.modelregels_editor.clearHistory();
    this.startwaarden_editor.clearHistory();
  } else {
    $(this.dom_modelregels).val(this.model.modelregels);
    $(this.dom_startwaarden).val(this.model.startwaarden);
  }
  $(this.dom_nbox).val(this.url_N || this.model.N || this.N_default);
  this.url_N = undefined;   // only for the model that the link opens
  $(this.dom_titel).val(this.model_title || '');
  this.update_document_title();

  this.set_opdracht(this.model.opdracht || '', true);
  // other model: the dragged positions of its file (or none)
  this.set_indeling(this.model.indeling || '');
  this.loaded = {modelregels: this.model.modelregels, startwaarden: this.model.startwaarden,
                 opdracht: this.opdracht, indeling: this.indeling_text()};

  this.results = [];
  this.allVars = [];
  this.units = {};
  this.read = null;
  this.table_limit = 10;
  this.zoom = null;
  this.graphs = [];
  this.analysis = undefined;
  this.end_stepping();
  this.previous = null;
  this.pinned = false;
  this.last_source = null;
  this.compare_text = '';
  this.has_run = false;
  this.remove_highlight_trace();
  this.remove_highlight_error();
  clearTimeout(this.lint_timer);
  this.remove_lint();

  // (re)set graph menu
  this.multiplot = false;
  this.multi_yvars = [];
  this.user_axes = false;
  this.xvar = undefined;
  this.yvar = undefined;
  this.update_axis_controls();
  this.set_stale(false);
  this.clear_message();

  if (this.plot_object) {
    this.plot_object.shutdown();
    this.plot_object = undefined;
  }
  $(this.dom_graph).empty().append(
    $('<div>').addClass('placeholder').text('Druk op Run om het model door te rekenen.'));
  $(this.dom_graph_tabs).empty();
  $(this.dom_graph_note).empty();
  $(this.dom_zoom_reset).prop('hidden', true);
  this.place_axis_picks();
  $(this.dom_download_tsv + ',' + this.dom_download_png).prop('hidden', true);
  $(this.dom_datatable).empty().append(
    $('<div>').addClass('placeholder').text('Hier komt de tabel met resultaten.'));
  this.print_status("Model geladen. Druk op Run.");
  this.update_endtime_hint(true);
  if (this.restore_check) {
    this.restore_check = false;
    this.offer_restore();
  } else if (!this.starting) {
    // another model is loaded: the saved work is no longer needed
    this.autosave();
  }
  if (this.link_error && !this.starting) {
    // the Deel link could not be read: say so (another model is shown instead)
    this.show_message('error', 'Link niet gelezen', this.link_error + ' Je ziet nu een ander model.');
    this.print_status('Het model uit de link kon niet geladen worden.');
    this.link_error = undefined;
  }
  this.grafisch_zoom = null;
  this.grafisch_history = [];
  this.grafisch_selected = undefined;
  this.grafisch_linked = undefined;
  this.grafisch_highlight_lines(undefined);
  $('#grafisch_undo').prop('disabled', true);
  if (this.grafisch_open()) this.draw_grafisch_model();
};


//
// TSV -- use TSV instead of CSV to prevent , . decimal problems in Excel.
//
ModelleertaalApp.prototype.create_tsv = function() {
  var self = this;
  var tsv = '';

  tsv += this.allVars.map(function(name) {   // header row, with units: v (m/s)
    return eenheden.label(name, self.units);
  }).join('\t');
  tsv += "\n";

  tsv += this.results.map(function(row) {
    return row.map(function(item) {
      return typeof(item) === 'number' ? item.toPrecision(self.precision).replace('.', ',') : item;
    }).join('\t');
  }).join('\n');

  // . is replaced with , for NL Excel
  return tsv;
};


ModelleertaalApp.prototype.current_xy = function() {
  // the data of the current (single) plot, without gaps
  if (!this.require_results()) return false;

  if (this.multiplot) {
    this.show_message('warning', 'Niet mogelijk', 'Dit werkt alleen met een enkele grafiek.');
    return false;
  }
  var rows = this.reduce_rows(this.results, this.max_rows_in_plot);
  return this.xy_data(rows, this.allVars, this.xvar, this.yvar).filter(function(point) {
    return point !== null;
  });
};


//
// PGFPlot
//
ModelleertaalApp.prototype.create_pgfplot_header = function(scatter_plot) {
  // try to create a PGFPlot that fits the 10x10cm grid.
  // set x,y axis scales and min max values accordingly
  // This only works for graphs starting at (0,0)

  // https://stackoverflow.com/a/31643591/4965175
  function arrayMax(array) {
    return array.reduce(function(a, b) {
      return Math.max(a, b);
    });
  }

  function arrayMin(array) {
    return array.reduce(function(a, b) {
      return Math.min(a, b);
    });
  }

  function round_to_scale(max_val) {
    // round to next 10, 20, 50, 100, 200, 500, ...

    var exp_10 = Math.floor(Math.log(max_val) / Math.log(10));
    var power_of_ten = Math.pow(10, exp_10);

    if (max_val / (2 * power_of_ten) < 1) return 2 * power_of_ten;
    if (max_val / (5 * power_of_ten) < 1) return 5 * power_of_ten;
    return 10 * power_of_ten;
  }

  var x_var = this.xvar;
  var y_var = this.yvar;
  var units = this.units;
  function axis_label(name) {
    // unit from the comments of the model (eenheden.js): {$v$ [\si{m/s}]}
    // m/s² is written as m/s^{2}
    return "{$" + name + "$" + (units.hasOwnProperty(name) && units[name] ? " [\\si{" + eenheden.latex(units[name]) + "}]" : "") + "}";
  }

  // and back to columns again ...
  var x = [];
  var y = [];
  for (var i = 0; i < scatter_plot.length; i++) {
    x.push(scatter_plot[i][0]);
    y.push(scatter_plot[i][1]);
  }

  // This only works for 10x10 grid with x_min, y_min = (0,0)
  var x_min = arrayMin(x);
  var x_max = round_to_scale(arrayMax(x));
  var y_min = arrayMin(y);
  var y_max = round_to_scale(arrayMax(y));
  var x_scale = x_max / 10; // adjust to 10 cm x 10 cm grid
  var y_scale = y_max / 10;

  return "%x and y scale set to 10cmx10cm grid. Adjust to fit!\n" +
    "% x = [" + x_min + " .. " + arrayMax(x) + "]\n" +
    "% y = [" + y_min + " .. " + arrayMax(y) + "]\n" +
    "% this only works for graphs starting at (0,0)\n" +
    "\\begin{axis}[x=1cm\/" + x_scale + ", y=1cm\/" + y_scale + ",\n" +
    "axis y line=left, axis x line=middle,\n" +
    "enlargelimits=false, tick align=outside,\n " +
    "xlabel=" + axis_label(x_var) + ",\n" +
    "ylabel=" + axis_label(y_var) + ",\n" +
    "% xtick={0, 1, 2, ..., 10},\n" +
    "% ytick={0, 2, 4, ..., 20},\n" +
    "xmin=" + x_min + ", xmax=" + x_max + ", ymin=" + y_min + ", ymax=" + y_max + "]\n";
};


ModelleertaalApp.prototype.create_pgfplot = function() {
  // Output PGFPlots plot

  var scatter_plot = this.current_xy();
  if (scatter_plot === false || scatter_plot.length === 0) return false;

  var coordinates = scatter_plot.map(function(d) {
    return "(" + d.join(',') + ")";
  }).join('\n');

  var PGFPlot_TeX = "% Use \\input{} to wrap this inside suitable LaTeX doc:\n";
  PGFPlot_TeX += "\\begin{tikzpicture}\n" +
    "\\pgfplotsset{/pgf/number format/use comma}\n" +
    "% draw 10x10cm millimeter paper.\n" +
    "\\def\\width{10}\n" +
    "\\def\\height{10}\n" +
    "\\draw[step=1mm, line width=0.2mm, blue!20!white] (0,0) grid (\\width,\\height);\n" +
    "\\draw[step=5mm, line width=0.2mm, blue!40!white] (0,0) grid (\\width,\\height);\n" +
    "\\draw[step=1cm, line width=0.2mm, blue!60!white] (0,0) grid (\\width,\\height);\n";
  PGFPlot_TeX += "%\n%\n%\n";

  PGFPlot_TeX += this.create_pgfplot_header(scatter_plot);

  PGFPlot_TeX += "\\addplot[no marks, black, very thick]\n";
  PGFPlot_TeX += "coordinates {\n";
  PGFPlot_TeX += coordinates;
  PGFPlot_TeX += "\n};\n";
  PGFPlot_TeX += "\\end{axis}\n";
  PGFPlot_TeX += "\\end{tikzpicture}\n";
  return PGFPlot_TeX;
};

//
// SVG
//
ModelleertaalApp.prototype.create_svgplot = function() {
  // Output SVG plot: the curve, scaled to 400 x 300, y-axis pointing up.

  var scatter_plot = this.current_xy();
  if (scatter_plot === false || scatter_plot.length === 0) return false;

  var width = 400, height = 300;
  var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  scatter_plot.forEach(function(d) {
    xmin = Math.min(xmin, d[0]);
    xmax = Math.max(xmax, d[0]);
    ymin = Math.min(ymin, d[1]);
    ymax = Math.max(ymax, d[1]);
  });
  if (xmax == xmin) xmax = xmin + 1;
  if (ymax == ymin) ymax = ymin + 1;

  var coordinates = scatter_plot.map(function(d) {
    var x = (d[0] - xmin) / (xmax - xmin) * width;
    var y = height - (d[1] - ymin) / (ymax - ymin) * height;
    return " " + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }).join('\n');

  var SVG_Plot = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 ' + (width + 10) + ' ' + (height + 10) + '">\n';
  SVG_Plot += '<!-- ' + this.yvar + ' (' + ymin + ' .. ' + ymax + ') tegen ' +
              this.xvar + ' (' + xmin + ' .. ' + xmax + ') -->\n';
  // graph
  SVG_Plot += '<polyline fill="none" stroke="black" ';
  SVG_Plot += 'points= "\n';
  SVG_Plot += coordinates;
  SVG_Plot += ' "/>\n';
  SVG_Plot += '</svg>\n';

  return SVG_Plot;
};


//
// Helpers
//
ModelleertaalApp.prototype.row_increment = function(rows, Nresults) {
  return (rows.length > Nresults) ? Math.floor(rows.length / Nresults) : 1;
};


ModelleertaalApp.prototype.reduce_rows = function(rows, Nresults) {
  // reduce resultsObject (large array) to length == Nresults

  var length = rows.length;
  var rowinc = this.row_increment(rows, Nresults);

  if (rowinc == 1) return rows;

  // select first row, last row and rows in between. Keep Nrows+1 rows.
  return rows.filter(function(value, index) {
    return (index % rowinc === 0 || index == length - 1);
  });
};


ModelleertaalApp.prototype.get_result_rowIndex = function(rowIndex_plot, length_plot) {
  // map row index from plot (reduced number of rows)
  // back to this.results. The last point of the plot is the last row (see reduce_rows).

  if (length_plot !== undefined && rowIndex_plot == length_plot - 1) return this.results.length - 1;
  var rowIndex = this.rowinc * rowIndex_plot;
  if (rowIndex < this.results.length) {
    return rowIndex;
  } else {
    return this.results.length - 1;
  }
};


ModelleertaalApp.prototype.get_editor = function(editor_name) {
  if (!this.CodeMirrorActive) return null;
  if (editor_name === 'modelregels') return this.modelregels_editor;
  if (editor_name === 'startwaarden') return this.startwaarden_editor;
  return null;
};


ModelleertaalApp.prototype.fill_functies = function() {
  // "Functies" under the modelregels: the functions that can be used (gh-54)
  var table = $('<table>');
  evaluator_js.FUNCTIONS.forEach(function(row) {
    table.append($('<tr>').append(
      $('<td>').text(row[0].map(function(name) { return name + '()'; }).join(' ')),
      $('<td>').text(row[2]).append($('<br>'), $('<span class="voorbeeld">').text(row[1]))
    ));
  });
  $(this.dom_functies_tabel).empty().append(table);
};


ModelleertaalApp.prototype.highlight_error = function(line, editor_name, message) {
  // highlight line with error, until the model is edited or run.
  // A cross in the gutter shows the message on hover (gh-42).

  var editor = this.get_editor(editor_name);
  if (editor === null) return false;

  if (line === undefined || line < 1) {
    editor.focus();
    return false;
  }
  line = Math.min(line, editor.lineCount());

  this.remove_highlight_error();
  this.remove_lint();
  this.error_highlight = {
    editor: editor,
    handle: editor.addLineClass(line - 1, 'background', 'mt-error-line')
  };
  editor.addLineClass(this.error_highlight.handle, 'gutter', 'mt-error-gutter');
  var marker = $('<span class="mt-error-marker" role="img">').text('✕')
    .attr({'title': message || 'Fout in deze regel', 'aria-label': message || 'Fout in deze regel'});
  editor.setGutterMarker(this.error_highlight.handle, 'mt-error-markers', marker[0]);
  editor.setCursor({line: line - 1, ch: editor.getLine(line - 1).length});
  editor.focus();
};


ModelleertaalApp.prototype.remove_highlight_error = function() {
  if (!this.error_highlight) return;
  var highlight = this.error_highlight;
  this.error_highlight = undefined;
  highlight.editor.removeLineClass(highlight.handle, 'background', 'mt-error-line');
  highlight.editor.removeLineClass(highlight.handle, 'gutter', 'mt-error-gutter');
  highlight.editor.setGutterMarker(highlight.handle, 'mt-error-markers', null);
};


ModelleertaalApp.prototype.remove_highlight_trace = function() {

  if (!this.CodeMirrorActive) return false;

  if (this.at_line !== undefined) {
    // remove current highlighted line
    this.modelregels_editor.removeLineClass(this.at_line, 'background', 'mt-trace-line');
    this.at_line = undefined;
  }
};


ModelleertaalApp.prototype.highlight_trace = function(line) {

  if (!this.CodeMirrorActive) return false;

  this.remove_highlight_trace();
  this.at_line = line - 1;
  this.modelregels_editor.addLineClass(this.at_line, 'background', 'mt-trace-line');
};


exports.ModelleertaalApp = ModelleertaalApp;

},{"./aflezen.js":1,"./assen.js":2,"./autoplot.js":3,"./deellink.js":4,"./dtcheck.js":5,"./eenheden.js":6,"./evaluator.js":7,"./grafisch-edit.js":8,"./grafisch.js":9,"./hints.js":10,"./modelkeuze.js":12,"./oorzaak.js":20,"./rondleiding.js":21,"./stapper.js":22,"./vergelijk.js":23,"blob":15,"file-saver":17}],14:[function(require,module,exports){
(function (process){
/* parser generated by jison 0.4.18 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,4],$V1=[1,5],$V2=[1,6],$V3=[1,7],$V4=[1,8],$V5=[5,7,10,13,14,15,16,19],$V6=[1,24],$V7=[1,18],$V8=[1,21],$V9=[1,16],$Va=[1,15],$Vb=[1,17],$Vc=[1,19],$Vd=[1,20],$Ve=[1,22],$Vf=[1,23],$Vg=[1,29],$Vh=[1,30],$Vi=[1,31],$Vj=[1,32],$Vk=[1,33],$Vl=[1,34],$Vm=[1,35],$Vn=[1,36],$Vo=[1,37],$Vp=[1,38],$Vq=[1,39],$Vr=[1,40],$Vs=[1,41],$Vt=[1,42],$Vu=[1,43],$Vv=[5,7,8,10,12,13,14,15,16,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35],$Vw=[5,7,8,10,12,13,14,15,16,18,19,21,22,23,24,25,26,27,28,32,33,34,35],$Vx=[5,7,8,10,12,13,14,15,16,18,19,21,27,28],$Vy=[5,7,8,10,12,13,14,15,16,18,19,21,22,23,24,25,26,27,28],$Vz=[5,7,8,10,12,13,14,15,16,18,19,21,22,23,24,25,26,27,28,32,33];
var parser = {trace: function trace () { },
yy: {},
symbols_: {"error":2,"program":3,"stmt_list":4,"EOF":5,"stmt":6,"IDENT":7,"ASSIGN":8,"expr":9,"IF":10,"condition":11,"THEN":12,"ENDIF":13,"ELSE":14,"STOP":15,"PRINT":16,"(":17,")":18,"BLANK":19,"direct_declarator":20,"SEP":21,"==":22,">":23,">=":24,"<":25,"<=":26,"||":27,"&&":28,"SQUARED":29,"CUBED":30,"^":31,"+":32,"-":33,"*":34,"/":35,"NOT":36,"NUMBER":37,"PI":38,"TRUE":39,"FALSE":40,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",7:"IDENT",8:"ASSIGN",10:"IF",12:"THEN",13:"ENDIF",14:"ELSE",15:"STOP",16:"PRINT",17:"(",18:")",19:"BLANK",21:"SEP",22:"==",23:">",24:">=",25:"<",26:"<=",27:"||",28:"&&",29:"SQUARED",30:"CUBED",31:"^",32:"+",33:"-",34:"*",35:"/",36:"NOT",37:"NUMBER",38:"PI",39:"TRUE",40:"FALSE"},
productions_: [0,[3,2],[4,1],[4,2],[6,3],[6,5],[6,7],[6,1],[6,4],[6,1],[11,1],[11,3],[20,1],[20,4],[9,1],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,2],[9,2],[9,3],[9,3],[9,3],[9,3],[9,3],[9,2],[9,2],[9,2],[9,3],[9,1],[9,1],[9,1],[9,1],[9,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:
 return($$[$0-1]); 
break;
case 2:
 this.$ = [$$[$0]]; 
break;
case 3:
 $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 4:
 this.$ = {
                type: 'Assignment',
                left: $$[$0-2],
                right: $$[$0]

            };
        
break;
case 5:
 this.$ = {
                type: 'If',
                cond: $$[$0-3],
                then: $$[$0-1]
            };
        
break;
case 6:
 this.$ = {
              type: 'IfElse',
              cond: $$[$0-5],
              then: $$[$0-3],
              elsestmt: $$[$0-1]
          };
      
break;
case 7:
this.$ = {
                 type: 'Stop',
                 value: $$[$0]
            };
      
break;
case 8:
this.$ = {
                 type: 'Print',
                 value: $$[$0-3],
                 varname: $$[$0-1]
            };
      
break;
case 9:
this.$ = {
                type: 'Blank',
                value: $$[$0]
           };
      
break;
case 10: case 14:
this.$ = $$[$0];
break;
case 11:
this.$ = {
             type: 'Logical',
             operator: '==',
             left: $$[$0-2],
             right: $$[$0]
     };
  
break;
case 12:
 this.$ = {
                  type: 'Variable',
                  name: yytext
              };
          
break;
case 13:
this.$ = {
              type: 'Function',
              func: $$[$0-3],
              expr: $$[$0-1]
      };
  
break;
case 15:
this.$ = {
               type: 'List',
               operator: 'LIST',
               left: $$[$0-2],
               right: $$[$0]
       };
  
break;
case 16:
this.$ = {
               type: 'Logical',
               operator: '==',
               left: $$[$0-2],
               right: $$[$0]
       };
   
break;
case 17:
this.$ = {
              type: 'Logical',
              operator: '>',
              left: $$[$0-2],
              right: $$[$0]
      };
  
break;
case 18:
this.$ = {
                type: 'Logical',
                operator: '>=',
                left: $$[$0-2],
                right: $$[$0]
        };
    
break;
case 19:
this.$ = {
               type: 'Logical',
               operator: '<',
               left: $$[$0-2],
               right: $$[$0]
       };
   
break;
case 20:
this.$ = {
                  type: 'Logical',
                  operator: '<=',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 21:
this.$ = {
                  type: 'Logical',
                  operator: '||',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 22:
this.$ = {
                  type: 'Logical',
                  operator: '&&',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 23:
this.$ = {
                  type: 'Binary',
                  operator: '^',
                  left: $$[$0-1],
                  right: {
                          type: 'Number',
                          value: "2"
                      },
            };
          
break;
case 24:
this.$ = {
                  type: 'Binary',
                  operator: '^',
                  left: $$[$0-1],
                  right: {
                          type: 'Number',
                          value: "3"
                      },
            };
          
break;
case 25:
this.$ = {
                 type: 'Binary',
                 operator: '^',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 26:
this.$ = {
                type: 'Binary',
                operator: '+',
                left: $$[$0-2],
                right: $$[$0]
          };
        
break;
case 27:
this.$ = {
                 type: 'Binary',
                 operator: '-',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 28:
this.$ = {
                 type: 'Binary',
                 operator: '*',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 29:
this.$ = {
               type: 'Binary',
               operator: '/',
               left: $$[$0-2],
               right: $$[$0]
         };
       
break;
case 30:
this.$ = {
                  type: 'Unary',
                  operator: '-',
                  right: $$[$0]
            };
          
break;
case 31:
this.$ = {
                  type: 'Unary',
                  operator: '+',
                  right: $$[$0]
            };
          
break;
case 32:
this.$ = {
                type: 'Unary',
                operator: 'NOT',
                right: $$[$0]
          };
        
break;
case 33:
this.$ = $$[$0-1];
break;
case 34:
this.$ = {
                  type: 'Number',
                  value: $$[$0]
              };
           
break;
case 35:
this.$ = {
              type: 'Number',
              value: "3.14159265359"
          };
       
break;
case 36:
this.$ = {
              type: 'Blank',
          };
       
break;
case 37:
this.$ = {
                type: 'Boolean',
                value: 'true'
            };
         
break;
case 38:
this.$ = {
                type: 'Boolean',
                value: 'false'
            };
         
break;
}
},
table: [{3:1,4:2,6:3,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},{1:[3]},{5:[1,9],6:10,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},o($V5,[2,2]),{8:[1,11]},{7:$V6,9:13,11:12,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($V5,[2,7]),{17:[1,25]},o($V5,[2,9]),{1:[2,1]},o($V5,[2,3]),{7:$V6,9:26,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{12:[1,27]},{8:[1,28],12:[2,10],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},o($Vv,[2,14]),{7:$V6,9:44,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:45,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:46,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:47,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($Vv,[2,34]),o($Vv,[2,35]),o($Vv,[2,36]),o($Vv,[2,37]),o($Vv,[2,38]),o($Vv,[2,12],{17:[1,48]}),{7:[1,49]},o($V5,[2,4],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),{4:50,6:3,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},{7:$V6,9:51,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:52,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:53,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:54,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:55,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:56,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:57,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:58,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:59,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($Vv,[2,23]),o($Vv,[2,24]),{7:$V6,9:60,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:61,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:62,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:63,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:64,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($Vw,[2,30],{29:$Vo,30:$Vp,31:$Vq}),o($Vw,[2,31],{29:$Vo,30:$Vp,31:$Vq}),o($Vx,[2,32],{22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),{18:[1,65],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},{7:$V6,9:66,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{18:[1,67]},{6:10,7:$V0,10:$V1,13:[1,68],14:[1,69],15:$V2,16:$V3,19:$V4},{12:[2,11],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},o([5,7,8,10,12,13,14,15,16,18,19,21],[2,15],{22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vy,[2,16],{29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vy,[2,17],{29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vy,[2,18],{29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vy,[2,19],{29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vy,[2,20],{29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o([5,7,8,10,12,13,14,15,16,18,19,21,27],[2,21],{22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vx,[2,22],{22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),o($Vv,[2,25]),o($Vz,[2,26],{29:$Vo,30:$Vp,31:$Vq,34:$Vt,35:$Vu}),o($Vz,[2,27],{29:$Vo,30:$Vp,31:$Vq,34:$Vt,35:$Vu}),o($Vw,[2,28],{29:$Vo,30:$Vp,31:$Vq}),o($Vw,[2,29],{29:$Vo,30:$Vp,31:$Vq}),o($Vv,[2,33]),{18:[1,70],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},o($V5,[2,8]),o($V5,[2,5]),{4:71,6:3,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},o($Vv,[2,13]),{6:10,7:$V0,10:$V1,13:[1,72],15:$V2,16:$V3,19:$V4},o($V5,[2,6])],
defaultActions: {9:[2,1]},
parseError: function parseError (str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        var error = new Error(str);
        error.hash = hash;
        throw error;
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        var lex = function () {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        };
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};
/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function(match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex () {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin (condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState () {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules () {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState (n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState (condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {"case-insensitive":true},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* ignore whitespaces */
break;
case 1:/* ignore whitespaces */
break;
case 2:/* modelleertaal comment */
break;
case 3:/* C-style multiline comment */
break;
case 4:/* C-style comment */
break;
case 5:/* Python style comment */
break;
case 6:return 17
break;
case 7:return 18
break;
case 8:return 38
break;
case 9:return 38
break;
case 10:return 22
break;
case 11:return 24
break;
case 12:return 26
break;
case 13:return 23
break;
case 14:return 25
break;
case 15:return 27
break;
case 16:return 27
break;
case 17:return 28
break;
case 18:return 28
break;
case 19:return 36
break;
case 20:return 40
break;
case 21:return 39
break;
case 22:return 8
break;
case 23:return 8
break;
case 24:return 37
break;
case 25:return 37
break;
case 26:return 37
break;
case 27:return 29
break;
case 28:return 30
break;
case 29:return 31
break;
case 30:return 32
break;
case 31:return 33
break;
case 32:return 34
break;
case 33:return 35
break;
case 34:return 13
break;
case 35:return 10
break;
case 36:return 12
break;
case 37:return 15
break;
case 38:return 14
break;
case 39:return 16  //stop and print value
break;
case 40:return 21 // allow lists: min(1;2;3)
break;
case 41:return 19
break;
case 42:return 19
break;
case 43:return 7
break;
case 44:return 5
break;
}
},
rules: [/^(?:\s+)/i,/^(?:\t+)/i,/^(?:'[^\n]*)/i,/^(?:\/\*(.|\n|\r)*?\*\/)/i,/^(?:\/\/[^\n]*)/i,/^(?:#[^\n]*)/i,/^(?:\()/i,/^(?:\))/i,/^(?:pi\b)/i,/^(?:π)/i,/^(?:==)/i,/^(?:>=)/i,/^(?:<=)/i,/^(?:>)/i,/^(?:<)/i,/^(?:of\b)/i,/^(?:\|\|)/i,/^(?:en\b)/i,/^(?:&&)/i,/^(?:!|niet\b)/i,/^(?:onwaar\b)/i,/^(?:waar\b)/i,/^(?:=)/i,/^(?::=)/i,/^(?:[0-9]*["."","][0-9]+([Ee][+-]?[0-9]+)?)/i,/^(?:[0-9]+["."","][0-9]*([Ee][+-]?[0-9]+)?)/i,/^(?:[0-9]+([Ee][+-]?[0-9]+)?)/i,/^(?:²)/i,/^(?:³)/i,/^(?:\^)/i,/^(?:\+)/i,/^(?:-)/i,/^(?:\*)/i,/^(?:\/)/i,/^(?:eindals\b)/i,/^(?:als\b)/i,/^(?:dan\b)/i,/^(?:stop\b)/i,/^(?:anders\b)/i,/^(?:print\b)/i,/^(?:;)/i,/^(?:\.\.\.)/i,/^(?:…)/i,/^(?:[a-zA-Z\x7f-\uffff][a-zA-Z\x7f-\u00b1\u00b4-\uffff0-9_"\]""\|"{}"["]*)/i,/^(?:$)/i],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); };
exports.main = function commonjsMain (args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
}).call(this,require('_process'))
},{"_process":19,"fs":16,"path":18}],15:[function(require,module,exports){
(function (global){
/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  for (var i = 0; i < ary.length; i++) {
    var chunk = ary[i];
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      ary[i] = buf;
    }
  }
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary);

  for (var i = 0; i < ary.length; i++) {
    bb.append(ary[i]);
  }

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  mapArrayBufferViews(ary);
  return new Blob(ary, options || {});
};

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],16:[function(require,module,exports){

},{}],17:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.3.2
 * 2016-06-16 18:25:19
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof view === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /constructor/i.test(view.HTMLElement) || view.safari
		, is_chrome_ios =/CriOS\/[\d]+/.test(navigator.userAgent)
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			// note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, force = type === force_saveable_type
				, object_url
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
							var popup = view.open(url, '_blank');
							if(!popup) view.location.href = url;
							url=undefined; // release reference before dispatching
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (!object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (force) {
						view.location.href = object_url;
					} else {
						var opened = view.open(object_url, "_blank");
						if (!opened) {
							// Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
							view.location.href = object_url;
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
			;
			filesaver.readyState = filesaver.INIT;

			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}

			fs_error();
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			name = name || blob.name || "download";

			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name);
		};
	}

	FS_proto.abort = function(){};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define("FileSaver.js", function() {
    return saveAs;
  });
}

},{}],18:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":19}],19:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],20:[function(require,module,exports){
/*
    oorzaak.js

    "Vanaf iteratie 16 heeft 'x' geen geldige waarde meer": wat is de meest waarschijnlijke
    oorzaak? Eén oorzaak noemen is duidelijker dan drie vragen tegelijk.

      'deling'  een noemer (een variabele) is 0 in die iteratie: delen door nul
      'wortel'  de wortel (of log, ln) van een negatieve variabele
      'groei'   de waarden worden eerst steeds groter tot ze te groot zijn: dt te groot?
      null      onbekend: de algemene melding

    No DOM. Works on the AST of the modelregels and the results of the run.

    usage:
      var oorzaak = require('./oorzaak.js');
      oorzaak.find(modelregels_ast, varNames, results, bad_row, constants)   // {kind: 'deling', name: 'm'} or null
      (constants, optional: name --> value of startwaarden that are not in the results, such as m)
*/

//jshint node:true
//jshint es3:true
"use strict";

var ROOTS = ['sqrt', 'wortel', 'log', 'ln', 'log10'];
var HUGE = 1e100;


function walk(node, callback) {
    if (!node || typeof node !== 'object') return;
    callback(node);
    walk(node.left, callback);
    walk(node.right, callback);
    walk(node.expr, callback);
}


function each_expr(ast, callback) {
    (ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') walk(stmt.right, callback);
        if (stmt.type == 'If' || stmt.type == 'IfElse') {
            walk(stmt.cond, callback);
            each_expr(stmt.then, callback);
            each_expr(stmt.elsestmt, callback);
        }
    });
}


function find(modelregels_ast, varNames, results, bad_row, constants) {
    constants = constants || {};
    function value(results, varNames, row, name) {
        var j = varNames.indexOf(name);
        if (j == -1) return constants.hasOwnProperty(name) ? constants[name] : undefined;
        if (row < 0 || row >= results.length) return undefined;
        return results[row][j];
    }

    var rows = [bad_row - 1, bad_row];
    var found = null;

    // delen door nul: a denominator that is a variable with the value 0
    each_expr(modelregels_ast, function(node) {
        if (found || node.type != 'Binary' || node.operator != '/' || !node.right) return;
        if (node.right.type != 'Variable') return;
        var name = node.right.name;
        rows.forEach(function(row) {
            if (!found && value(results, varNames, row, name) === 0) found = {kind: 'deling', name: name};
        });
    });
    if (found) return found;

    // wortel uit een negatief getal
    each_expr(modelregels_ast, function(node) {
        if (found || node.type != 'Function' || ROOTS.indexOf(String(node.func).toLowerCase()) == -1) return;
        if (!node.expr || node.expr.type != 'Variable') return;
        var name = node.expr.name;
        rows.forEach(function(row) {
            var v = value(results, varNames, row, name);
            if (!found && typeof v == 'number' && v < 0) found = {kind: 'wortel', name: name, func: node.func};
        });
    });
    if (found) return found;

    // the values grow until they are too large (numerically unstable: dt too large)
    var last = bad_row - 1;
    if (last >= 1) {
        for (var j = 0; j < varNames.length; j++) {
            var now = Math.abs(results[last][j]);
            var before = Math.abs(results[Math.max(0, last - 3)][j]);
            if (typeof results[last][j] != 'number' || !isFinite(now)) continue;
            if (now > HUGE || (now > 1e6 && now > 100 * before)) return {kind: 'groei', name: varNames[j]};
        }
    }
    return null;
}


function message(cause, bad_row, bad_var) {
    // the text of the warning
    var start = "Vanaf iteratie " + bad_row + " heeft '" + bad_var + "' geen geldige waarde meer. ";
    if (cause && cause.kind == 'deling') {
        return start + "Waarschijnlijk wordt er gedeeld door nul: '" + cause.name + "' is 0 in die iteratie. " +
               "Controleer de modelregels en startwaarden.";
    }
    if (cause && cause.kind == 'wortel') {
        return start + "Waarschijnlijk is '" + cause.name + "' negatief in " + cause.func + "(" + cause.name + "). " +
               "Controleer de modelregels en startwaarden.";
    }
    if (cause && cause.kind == 'groei') {
        return start + "De waarden (zoals '" + cause.name + "') worden steeds groter, tot ze te groot zijn. " +
               "Waarschijnlijk is dt te groot: probeer een kleinere dt.";
    }
    return start + "Wordt er gedeeld door nul, de wortel getrokken uit een negatief getal of wordt een getal te groot? " +
           "Controleer de modelregels en startwaarden (is dt klein genoeg?).";
}


exports.find = find;
exports.message = message;

},{}],21:[function(require,module,exports){
/*
    rondleiding.js

    Twee korte rondleidingen, elk in vijf stappen:
    - voor leerlingen: de basis (model kiezen, modelregels, Run en Stap, grafieken, diagram)
    - voor docenten: wat een docent extra kan (opdracht, Deel link, runs vergelijken in de klas,
      het diagram als invoer, het diagram uit het tekstmodel)
    Start nooit vanzelf: alleen met de knop Rondleiding bovenaan, die een keuzemenu opent.
    Bij een paar stappen doet de rondleiding het voor (zie DEMOS).
    Tot iemand de rondleiding een keer geopend heeft, staat er een kleine stip op de knop.

    Elke stap licht een deel van de pagina op (de rest wordt donkerder) met een tekstballon
    ernaast. De pagina blijft bruikbaar: je kunt tijdens de rondleiding gewoon klikken.
    Wat de rondleiding voor een stap open zet (het diagram, Meer opties) gaat bij de
    volgende stap weer terug zoals het was.
*/
//jshint browser:true, node:true
/*global $*/
"use strict";

var GEZIEN_KEY = 'modelleertaal_rondleiding_gezien';

var DIDACTIEK = '<a href="https://github.com/tomkooij/modelleertaal/blob/master/DIDACTIEK.md" ' +
    'target="_blank" rel="noopener">DIDACTIEK.md</a>';
var README = '<a href="https://github.com/tomkooij/modelleertaal#de-webapp-in-je-eigen-website-gebruiken" ' +
    'target="_blank" rel="noopener">README</a>';

// De rondleidingen. 'doel' is de selector van wat oplicht; 'voor' zet de pagina klaar
// (zie zet_klaar). In node (tests) worden alleen de teksten gebruikt.
var RONDLEIDINGEN = {
    leerling: {
        naam: 'Voor leerlingen',
        uitleg: 'De basis: een model doorrekenen en de grafiek aflezen',
        einde: 'Je werk blijft in deze browser staan, ook als je de pagina sluit. ' +
            'Wil je het als bestand hebben, druk dan op <b>Bewaar</b>.',
        stappen: [
            {
                doel: '.model_select',
                titel: 'Kies een model',
                tekst: 'Kies eerst een verzameling (de examens of je module), dan het model van je opgave. ' +
                    'Heb je van je docent een link gekregen, dan staat het model al klaar. ' +
                    'Staat er een opdracht bij, dan zie je die boven het model.'
            },
            {
                doel: '.editors',
                titel: 'Modelregels en startwaarden',
                tekst: 'Rechts de <b>startwaarden</b>: zo begint het model. Links de <b>modelregels</b>: ' +
                    'die worden elke stap opnieuw uitgerekend. Een eenheid zet je erachter: ' +
                    '<code>v = 0 \'[m/s]</code>. Onder <b>Functies</b> staat wat je kunt gebruiken, zoals ' +
                    '<code>sqrt</code> en <code>sin</code>. Een fout staat in het Nederlands boven het model.'
            },
            {
                doel: '.runbar',
                titel: 'Run en Stap',
                demo: 'stap',
                tekst: '<b>Run</b> (of Ctrl+Enter) rekent het model door. Naast het aantal iteraties zie je ' +
                    'hoe lang het model loopt. Snap je niet wat er gebeurt? Met <b>Stap</b> reken je regel ' +
                    'voor regel, met de getallen ingevuld: ' +
                    '<code>v = v + a*dt &rarr; v = 0,981 + 9,78 &times; 0,1</code>.'
            },
            {
                doel: '.area_graph',
                titel: 'De grafiek aflezen',
                demo: 'aflezen',
                voor: 'run',
                tekst: 'De webapp kiest zelf de grafieken; klik op een miniatuur om die groot te zien, ' +
                    'of kies een andere grootheid op de as. Klik op een punt om af te lezen. ' +
                    'Klik op de raaklijn: dan zie je hoe de helling &Delta;y/&Delta;x wordt uitgerekend. ' +
                    'Alle waarden staan in de tabel.'
            },
            {
                doel: '.area_model',
                titel: 'Tekst + grafisch',
                demo: 'kies_symbool',
                voor: 'grafisch',
                tekst: 'Met <b>Tekst + grafisch</b> zie je je model als diagram, zoals in het examen: ' +
                    'toestandsvariabelen, stromen en pijlen voor &ldquo;hangt af van&rdquo;. ' +
                    'Klik op een symbool en de regels ervan lichten op in de tekst. ' +
                    'Je kunt het model ook in het diagram bouwen met de knoppen erboven.'
            }
        ]
    },
    docent: {
        naam: 'Voor docenten',
        uitleg: 'Opdrachten maken en delen, demonstreren in de klas, het grafische model',
        einde: 'Waarom de webapp zo werkt, staat in ' + DIDACTIEK + '. ' +
            'De webapp met je eigen modellen op je eigen website: zie de ' + README + '. ' +
            'De basis zie je in de rondleiding <b>Voor leerlingen</b>.',
        stappen: [
            {
                doel: '.opdracht_optie',
                titel: 'Een opdracht bij het model',
                voor: 'opties',
                tekst: 'Schrijf hier (in <b>Meer opties</b>) een opdracht bij het model, bijvoorbeeld ' +
                    '&ldquo;vul de puntjes in en bepaal de eindsnelheid&rdquo;. Je leerlingen zien die ' +
                    'boven het model. Tip: kies een examenmodel, vervang een regel door puntjes en schrijf ' +
                    'de vraag erbij.'
            },
            {
                doel: '#permalink',
                titel: 'Deel link',
                tekst: '<b>Deel link</b> kopieert een link met het model zoals het nu is: met jouw wijzigingen, ' +
                    'de titel en de opdracht. Zet hem in je ELO of lesbrief. Leerlingen hoeven niets te ' +
                    'installeren en hebben geen account nodig; het werkt ook op een telefoon.'
            },
            {
                doel: '.area_graph',
                titel: 'Runs vergelijken in de klas',
                voor: 'run',
                tekst: 'Laat zien wat een startwaarde doet: verander bijvoorbeeld de massa en druk op Run. ' +
                    'De vorige run blijft als grijze lijn staan en onder de grafiek staat wat er veranderd is ' +
                    '(<code>m = 91 &rarr; nu 120</code>). Met <b>Houd vast</b> blijft een grijze lijn staan ' +
                    'als referentie terwijl je verder probeert.'
            },
            {
                doel: '#grafisch_model',
                titel: 'Het diagram is ook invoer',
                demo: 'formulier',
                voor: 'grafisch',
                tekst: 'Tekst en diagram zijn gekoppeld. Klik op een symbool: de regels ervan lichten op in de ' +
                    'tekst, en in het formulier verander je de naam of de formule. Met de knoppen erboven voeg ' +
                    'je grootheden en voorwaarden toe; een stroom voeg je toe bij een gekozen toestandsvariabele. ' +
                    'Elke wijziging is een kleine wijziging in de tekst: de tekst blijft het model, net als in ' +
                    'het examen. Namen kies je met een klik, dus zonder typefouten.'
            },
            {
                doel: '.area_model',
                titel: 'Het diagram komt uit de tekst',
                demo: 'cursor',
                voor: 'grafisch',
                tekst: 'Het diagram wordt vanzelf getekend uit het tekstmodel, terwijl je typt; Run is niet nodig. ' +
                    'Zo laat je bij elk examenmodel het grafische model zien. Zet de cursor in een regel en het ' +
                    'symbool licht op. Onder het diagram zet je <b>formules</b> en <b>eenheden</b> bij de symbolen ' +
                    'en kies je de stijl <b>Examen</b> of <b>Kleur</b>; <b>Herkende elementen</b> laat zien hoe ' +
                    'elke regel herkend is.'
            }
        ]
    }
};


// Demonstraties: de rondleiding doet het even voor. Elke demo krijgt ctx:
//   ctx.app            de webapp
//   ctx.later(fn, ms)  doe fn na ms (alleen zolang deze stap open is)
//   ctx.toon(html)     zet een korte uitleg in de ballon ('' haalt hem weg)
// en geeft een functie terug die alles terugzet. Het model zelf verandert nooit.
var DEMOS = {
    stap: function(ctx) {
        // a few lines with Stap: the calculation with the numbers below the run bar
        var app = ctx.app, n = 0;
        function stap() {
            if (!app.step() || !app.stepper) return;
            n += 1;
            ctx.toon('Hier wordt drie keer op <b>Stap</b> gedrukt: de berekening staat onder de knoppen, ' +
                'de regel licht op in de modelregels.');
            if (n < 3) ctx.later(stap, 1100);
        }
        ctx.later(stap, 500);
        return function() { app.end_stepping(); };
    },

    aflezen: function(ctx) {
        // a point is read off, then the tangent is clicked: the helling as on paper
        var app = ctx.app;
        var vorige = app.read;
        if (!app.results_available() || app.multiplot || !app.yvar || app.results.length < 5) {
            return function() {};
        }
        var row = Math.round((app.results.length - 1) * 0.3);
        var punt = {row: row, yvar: app.yvar};
        ctx.later(function() {
            app.set_read(punt);
            ctx.toon('Hier is op de grafiek geklikt: de stip met hulplijnen naar beide assen, en de raaklijn.');
            ctx.later(function() {
                app.set_read($.extend({}, punt, {tangent: true}));
                ctx.toon('En nu op de raaklijn: de snijpunten met de assen zijn afgelezen en de helling ' +
                    'volgt uit &Delta;y/&Delta;x, ingevuld met die punten.');
            }, 2200);
        }, 600);
        return function() { app.set_read(vorige || null); };
    },

    kies_symbool: function(ctx) {
        // a symbol is selected: its lines light up in the text (no form)
        return kies(ctx, true);
    },

    formulier: function(ctx) {
        // a symbol is selected with its form: name, beginwaarde, flows
        return kies(ctx, false);
    },

    cursor: function(ctx) {
        // the cursor in a line of the text: the symbol lights up (without moving the real cursor)
        var app = ctx.app;
        var lines = app.grafisch_lines && app.grafisch_lines.byLine;
        var g = app.grafisch_g;
        if (!lines || !g || !app.CodeMirrorActive) return function() {};
        var regel = null, id;
        Object.keys(lines).forEach(function(key) {
            var m = /^modelregels:(\d+)$/.exec(key);
            var el = g.elements[lines[key]];
            if (!m || !el) return;
            var score = el.kind == 'aux' ? 2 : 1;
            if (!regel || score > regel.score) regel = {line: Number(m[1]), id: lines[key], score: score};
        });
        if (!regel) return function() {};
        id = regel.id;
        var editor = app.modelregels_editor;
        var handle = null;
        ctx.later(function() {
            handle = editor.addLineClass(regel.line - 1, 'background', 'mt-link-line');
            app.grafisch_linked = id;
            app.grafisch_mark_linked();
            ctx.toon('Zoals hier: de cursor staat in regel ' + regel.line + ' (<code>' +
                esc(editor.getLine(regel.line - 1).trim()) + '</code>) en <b>' + esc(g.elements[id].name || id) +
                '</b> licht op in het diagram.');
        }, 500);
        return function() {
            if (handle) editor.removeLineClass(handle, 'background', 'mt-link-line');
            if (app.grafisch_linked === id) {
                app.grafisch_linked = undefined;
                app.grafisch_mark_linked();
            }
        };
    }
};

function kies(ctx, noform) {
    // select a toestandsvariabele (with flows, if there is one), as if it was clicked
    var app = ctx.app, g = app.grafisch_g;
    if (!g) return function() {};
    var ids = Object.keys(g.elements), id = null;
    ids.forEach(function(k) {
        var el = g.elements[k];
        if (id === null && el.kind == 'stock' && el.inflows && el.inflows.length) id = k;
    });
    if (id === null) ids.forEach(function(k) { if (id === null && g.elements[k].name) id = k; });
    if (id === null) return function() {};
    var naam = esc(g.elements[id].name || id);
    ctx.later(function() {
        app.grafisch_select(id, noform ? {noform: true} : undefined);
        ctx.toon(noform ?
            'Hier is op <b>' + naam + '</b> geklikt: de regels van ' + naam + ' lichten op in de tekst.' :
            'Hier is op <b>' + naam + '</b> geklikt: de regels lichten op en het formulier staat open. ' +
            'Wat je daar verandert, komt in de tekst.');
    }, 500);
    return function() {
        if (app.grafisch_selected === id) app.grafisch_select(undefined);
    };
}

function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


function storage(action) {
    // localStorage can be blocked (private window): then the dot simply stays
    try {
        if (action == 'get') return window.localStorage.getItem(GEZIEN_KEY);
        if (action == 'set') window.localStorage.setItem(GEZIEN_KEY, '1');
    } catch (err) {
        return null;
    }
    return null;
}


function Rondleiding(app) {
    this.app = app;
    this.index = -1;
    this.herstel = null;   // undoes what 'voor' changed on the page
}

Rondleiding.prototype.knop = function(selector) {
    var self = this;
    var $knop = $(selector);
    this.$knop = $knop;
    if (!storage('get')) $knop.addClass('nieuw');
    // the menu: one choice per tour
    var $menu = $('<div class="tour_menu" id="rondleiding_menu" role="menu" hidden>');
    $.each(RONDLEIDINGEN, function(id, r) {
        $('<button type="button" role="menuitem">').attr('data-rondleiding', id)
            .append($('<b>').text(r.naam), $('<span>').text(r.uitleg))
            .appendTo($menu);
    });
    $menu.insertAfter($knop);
    $knop.attr({'aria-haspopup': 'menu', 'aria-controls': 'rondleiding_menu'});
    this.$menu = $menu;

    $knop.on('click', function() {
        if (self.index >= 0) self.stop();
        else if ($menu.prop('hidden')) self.open_menu();
        else self.sluit_menu();
    });
    $menu.on('click', '[data-rondleiding]', function() {
        self.sluit_menu(true);
        self.start($(this).attr('data-rondleiding'));
    });
    $menu.on('keydown', function(e) {
        var items = $menu.find('button');
        var i = items.index(document.activeElement);
        if (e.key == 'Escape') { self.sluit_menu(); $knop.trigger('focus'); e.preventDefault(); }
        else if (e.key == 'ArrowDown') { items.eq((i + 1) % items.length).trigger('focus'); e.preventDefault(); }
        else if (e.key == 'ArrowUp') { items.eq((i - 1 + items.length) % items.length).trigger('focus'); e.preventDefault(); }
    });
    $(document).on('mousedown touchstart', function(e) {
        if (!$menu.prop('hidden') && !$(e.target).closest($menu.add($knop)).length) self.sluit_menu();
    });

    // de plek van de knop: opnieuw kiezen als het venster of de keuzelijsten van breedte veranderen
    var wacht = false;
    var opnieuw = function() {
        if (wacht) return;
        wacht = true;
        window.requestAnimationFrame(function() { wacht = false; self.plaats_knop(); });
    };
    this.plaats_knop();
    $(window).on('resize load', opnieuw);
    if (window.ResizeObserver) {
        var breedtes = {};
        var ro = new window.ResizeObserver(function(entries) {
            var anders = false;
            entries.forEach(function(e) {
                var w = Math.round(e.contentRect.width);
                if (breedtes[e.target.id] !== w) anders = true;
                breedtes[e.target.id] = w;
            });
            if (anders) opnieuw();
        });
        $('#model_groep, #model_keuze').each(function() { ro.observe(this); });
    }
};

// De knop staat zo hoog mogelijk, maar de bovenste balk mag er niet hoger door worden.
// Probeer om de beurt: rechts in de balk, alleen het ?-rondje, rechts op de titelregel.
// Past het nergens, dan rechts in de voettekst.
Rondleiding.prototype.plaats_knop = function() {
    var header = $('header.topbar')[0];
    var plek = this.$knop.parent('.tour_plek')[0];
    if (!header || !plek) return;
    var knop = this.$knop[0];
    var focus = document.activeElement === knop;
    var brand = $(header).find('.brand')[0];
    if (plek.parentNode) plek.parentNode.removeChild(plek);
    header.classList.remove('tour_in_titel');
    var basis = header.offsetHeight;   // de balk zonder knop
    var pogingen = [[header, false], [header, true], [brand, false]];
    var gelukt = false;
    for (var i = 0; i < pogingen.length && !gelukt; i++) {
        if (!pogingen[i][0]) continue;
        pogingen[i][0].appendChild(plek);
        knop.classList.toggle('compact', pogingen[i][1]);
        header.classList.toggle('tour_in_titel', pogingen[i][0] === brand);
        gelukt = header.offsetHeight <= basis;
    }
    if (!gelukt) {
        header.classList.remove('tour_in_titel');
        knop.classList.remove('compact');
        $('footer').append(plek);
    }
    if (focus) knop.focus();
};

Rondleiding.prototype.open_menu = function() {
    this.$menu.prop('hidden', false);
    this.$knop.attr('aria-expanded', 'true');
    this.$menu.find('button').first().trigger('focus');
};

Rondleiding.prototype.sluit_menu = function(tour_start) {
    this.$menu.prop('hidden', true);
    if (!tour_start) this.$knop.attr('aria-expanded', 'false');
};

Rondleiding.prototype.start = function(naam) {
    var self = this;
    this.rondleiding = RONDLEIDINGEN[naam] || RONDLEIDINGEN.leerling;
    this.stappen = this.rondleiding.stappen;
    storage('set');
    $('#rondleiding_knop').removeClass('nieuw').attr('aria-expanded', 'true');
    this.$spot = $('<div class="tour_spot" aria-hidden="true">').appendTo('body');
    this.$ballon = $('<div class="tour_ballon" role="dialog" aria-modal="false" aria-labelledby="tour_titel">')
        .appendTo('body');
    this.$ballon.on('click', '[data-tour]', function() {
        var actie = $(this).attr('data-tour');
        if (actie == 'volgende') self.ga(self.index + 1);
        if (actie == 'vorige') self.ga(self.index - 1);
        if (actie == 'stop') self.stop();
    });
    this.on_key = function(e) {
        // not while typing in the model or a form
        if ($(e.target).closest('input, textarea, select, .CodeMirror, [contenteditable]').length) return;
        if (e.key == 'Escape') { self.stop(); e.preventDefault(); }
        else if (e.key == 'ArrowRight') { self.ga(self.index + 1); e.preventDefault(); }
        else if (e.key == 'ArrowLeft' && self.index > 0) { self.ga(self.index - 1); e.preventDefault(); }
    };
    this.on_move = function() { self.plaats(); };
    $(document).on('keydown', this.on_key);
    $(window).on('resize scroll', this.on_move);
    // the layout can also change without scrolling (graph drawn, diagram opened, editor loaded)
    if (window.ResizeObserver) {
        this.observer = new window.ResizeObserver(this.on_move);
        this.observer.observe(document.body);
    }
    this.ga(0);
};

Rondleiding.prototype.stop = function() {
    if (this.index < 0) return;
    this.demo_stop();
    this.zet_terug();
    this.index = -1;
    $(document).off('keydown', this.on_key);
    $(window).off('resize scroll', this.on_move);
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    clearTimeout(this.timer);
    this.$spot.remove();
    this.$ballon.remove();
    // back to the button, without scrolling to it (it is at the bottom of the page)
    var knop = $('#rondleiding_knop').attr('aria-expanded', 'false')[0];
    if (knop) knop.focus({preventScroll: true});
};

Rondleiding.prototype.zet_terug = function() {
    if (this.herstel) this.herstel();
    this.herstel = null;
};

Rondleiding.prototype.demo_stop = function() {
    (this.demo_timers || []).forEach(clearTimeout);
    this.demo_timers = [];
    if (this.demo_herstel) this.demo_herstel();
    this.demo_herstel = null;
};

Rondleiding.prototype.demo_start = function(naam) {
    var self = this;
    var index = this.index;
    if (!DEMOS[naam]) return;
    var ctx = {
        app: this.app,
        later: function(fn, ms) {
            self.demo_timers.push(setTimeout(function() {
                if (self.index === index) fn();
            }, ms));
        },
        toon: function(html) {
            self.$ballon.find('.tour_demo').html(html).prop('hidden', !html);
            self.plaats();
        }
    };
    this.demo_herstel = DEMOS[naam](ctx);
};

Rondleiding.prototype.zet_klaar = function(voor) {
    // prepare the page for a step, and remember how to undo it
    var app = this.app;
    var extra = '';
    if (voor == 'run' && !app.results_available()) {
        // show real graphs: compute the model that is loaded
        $(app.dom_run).trigger('click');
        if (app.results_available()) extra = 'De rondleiding heeft het model voor je doorgerekend.';
    } else if (voor == 'grafisch' && app.weergave != 'grafisch') {
        app.set_weergave('grafisch', false);
        this.herstel = function() { app.set_weergave('tekst', false); };
    } else if (voor == 'opties') {
        var details = document.getElementById('meer_opties');
        if (details && !details.open) {
            details.open = true;
            this.herstel = function() { details.open = false; };
        }
    }
    return extra;
};

Rondleiding.prototype.ga = function(index) {
    if (index >= this.stappen.length) { this.stop(); return; }
    if (index < 0) return;
    var stap = this.stappen[index];
    var extra = '';
    this.demo_stop();
    if (!(this.herstel && stap.voor && stap.voor == this.voor)) {
        // the next step needs the same (the diagram stays open): leave the page as it is
        this.zet_terug();
        extra = this.zet_klaar(stap.voor);
        this.voor = stap.voor;
    }
    this.index = index;
    var laatste = index == this.stappen.length - 1;

    this.$ballon.html(
        '<button type="button" class="tour_sluit" data-tour="stop" aria-label="Sluit de rondleiding" title="Sluiten (Esc)">&times;</button>' +
        '<div class="tour_teller">' + this.rondleiding.naam + ' &middot; ' + (index + 1) + ' van ' +
        this.stappen.length + '</div>' +
        '<h2 id="tour_titel">' + stap.titel + '</h2>' +
        '<p>' + stap.tekst + '</p>' +
        (extra ? '<p class="tour_extra">' + extra + '</p>' : '') +
        '<p class="tour_demo" aria-live="polite" hidden></p>' +
        (laatste ? '<p class="tour_extra">' + this.rondleiding.einde + '</p>' : '') +
        '<div class="tour_knoppen">' +
        (index > 0 ? '<button type="button" data-tour="vorige">Vorige</button>' : '<span></span>') +
        '<button type="button" class="tour_volgende" data-tour="volgende">' +
        (laatste ? 'Klaar' : 'Volgende') + '</button>' +
        '</div>');

    var el = $(stap.doel)[0];
    if (el && el.scrollIntoView) {
        var r = el.getBoundingClientRect();
        // only scroll when the part is not (nearly) completely visible
        if (r.top < 8 || r.bottom > window.innerHeight - 8) {
            el.scrollIntoView({block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth'});
        }
    }
    this.plaats();
    // the layout can still change (graph drawn, diagram opened, smooth scroll)
    var self = this;
    clearTimeout(this.timer);
    this.timer = setTimeout(function() { self.plaats(); }, 400);
    var volgende = this.$ballon.find('.tour_volgende')[0];
    if (volgende) volgende.focus({preventScroll: true});
    this.demo_start(stap.demo);
};

Rondleiding.prototype.plaats = function() {
    if (this.index < 0) return;
    var el = $(this.stappen[this.index].doel)[0];
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var marge = 6;
    var $b = this.$ballon;
    var bw = Math.min(360, vw - 32);
    $b.css({width: bw});
    var bh = $b.outerHeight();

    if (!el || !el.getClientRects().length) {
        this.$spot.hide();
        $b.css({left: (vw - bw) / 2, top: Math.max(16, (vh - bh) / 2)});
        return;
    }
    var r = el.getBoundingClientRect();
    this.$spot.show().css({
        left: r.left - marge, top: r.top - marge,
        width: r.width + 2 * marge, height: r.height + 2 * marge
    });

    // below the part, else above it, else next to it, else on top of it at the bottom
    var left = Math.min(Math.max(16, r.left), vw - bw - 16);
    var top;
    var ruimte_onder = vh - r.bottom - 2 * marge;
    var ruimte_boven = r.top - 2 * marge;
    if (ruimte_onder >= bh + 8) {
        top = r.bottom + marge + 10;
    } else if (ruimte_boven >= bh + 8) {
        top = r.top - marge - 10 - bh;
    } else if (vw - r.right >= bw + 32) {
        left = r.right + marge + 14;
        top = Math.min(Math.max(16, r.top), vh - bh - 16);
    } else if (r.left >= bw + 32) {
        left = r.left - marge - 14 - bw;
        top = Math.min(Math.max(16, r.top), vh - bh - 16);
    } else {
        top = vh - bh - 16;
    }
    $b.css({left: left, top: Math.max(16, top)});
};


exports.Rondleiding = Rondleiding;
exports.RONDLEIDINGEN = RONDLEIDINGEN;
exports.DEMOS = DEMOS;

},{}],22:[function(require,module,exports){
/*
    stapper.js

    Stap voor stap: voer een model regel voor regel uit en laat de berekening
    zien met ingevulde getallen. Zo wordt de rekenlus van een numeriek model
    zichtbaar.

      iteratie 3, regel 6:  v = v + a*dt  ->  v = 0,981 + 9,78 × 0,1 = 1,959

    No DOM. The expressions are computed with the code generator of
    evaluator.js, so the results are the same as those of a Run.

    usage:
      var stapper = require('./stapper.js');
      var s = new stapper.Stepper(startwaarden_ast, modelregels_ast, varNames, {N: 100});
      var step = s.step();   // {iteration, line, text, name, ...}
      s.rows                 // table: [startwaarden, iteration 1, ...] (columns: varNames)

      stapper.expr_text(node)                 --> 'v + a*dt'
      stapper.substitute(node, values, fmt)   --> '0,981 + 9,78 × 0,1'
*/

//jshint node:true
//jshint es3:true
//jshint evil:true
"use strict";

var evaluator_js = require('./evaluator.js');

// precedence of operators (higher binds stronger). See modelleertaal.jison.
var PREC = {
    'LIST': 1, '||': 2, '&&': 3, 'NOT': 4,
    '==': 5, '<': 5, '<=': 5, '>': 5, '>=': 5,
    '+': 6, '-': 6, '*': 7, '/': 7, 'UMINUS': 8, '^': 9,
    'ATOM': 10
};

var PI_TEXT = "3.14159265359";   // value of pi in the AST


function format_default(x) {
    // number as text, Dutch notation: 0,981
    if (typeof x == 'boolean') return x ? 'waar' : 'onwaar';
    if (typeof x != 'number' || isNaN(x)) return '?';
    if (!isFinite(x)) return x > 0 ? '∞' : '-∞';
    return String(Number(x.toPrecision(4))).replace('.', ',');
}


function render(node, values, format) {
    // expression as text: {text, prec}
    // values === undefined: with the names of the variables (v + a*dt)
    // else: with the values filled in (0,981 + 9,78 × 0,1)
    var fill = (values !== undefined);
    var left, right, op, prec;

    function wrap(child, min_prec) {
        // parentheses around child if it binds weaker than min_prec
        return (child.prec < min_prec) ? '(' + child.text + ')' : child.text;
    }

    switch (node.type) {
        case 'Number':
            if (node.value == PI_TEXT) {
                return fill ? {text: format(Math.PI), prec: PREC.ATOM} : {text: 'pi', prec: PREC.ATOM};
            }
            return {text: String(node.value), prec: PREC.ATOM};
        case 'Boolean':
            return {text: (node.value == 'true') ? 'waar' : 'onwaar', prec: PREC.ATOM};
        case 'Variable':
            if (!fill) return {text: node.name, prec: PREC.ATOM};
            var value = values[node.name];
            var text = format(value);
            // a negative number is put in parentheses: 0 + (-9,81) × 0,1
            return {text: text, prec: (typeof value == 'number' && value < 0) ? 0 : PREC.ATOM};
        case 'Function':
            return {text: node.func + '(' + render(node.expr, values, format).text + ')', prec: PREC.ATOM};
        case 'List':
            left = render(node.left, values, format);
            right = render(node.right, values, format);
            return {text: wrap(left, PREC.LIST) + '; ' + wrap(right, PREC.LIST + 1), prec: PREC.LIST};
        case 'Unary':
            right = render(node.right, values, format);
            if (node.operator == 'NOT') {
                return {text: 'niet ' + wrap(right, PREC.NOT), prec: PREC.NOT};
            }
            return {text: node.operator + wrap(right, PREC.UMINUS + 1), prec: PREC.UMINUS};
        case 'Binary':
        case 'Logical':
            prec = PREC[node.operator];
            left = render(node.left, values, format);
            right = render(node.right, values, format);
            op = node.operator;
            if (op == '&&') op = ' en ';
            else if (op == '||') op = ' of ';
            else if (op == '*') op = fill ? ' × ' : '*';
            else if (op == '/') op = fill ? ' / ' : '/';
            else if (op == '^') op = '^';
            else op = ' ' + op + ' ';
            // operators are left associative: a - (b - c) keeps its parentheses
            return {text: wrap(left, prec) + op + wrap(right, prec + 1), prec: prec};
        default:
            return {text: '...', prec: PREC.ATOM};
    }
}


function expr_text(node) {
    // expression with the names of the variables: 'v + a*dt'
    return render(node).text;
}


function substitute(node, values, format) {
    // expression with the values filled in: '0,981 + 9,78 × 0,1'
    // values: {name: value}. format (optional): number --> text
    return render(node, values, format || format_default).text;
}


function statement_text(stmt) {
    // statement as one line of text (whitespace and comments do not matter)
    switch (stmt.type) {
        case 'Assignment': return stmt.left + ' = ' + expr_text(stmt.right);
        case 'If': return 'als ' + expr_text(stmt.cond) + ' dan ' + program_text(stmt.then, ' ') + ' eindals';
        case 'IfElse': return 'als ' + expr_text(stmt.cond) + ' dan ' + program_text(stmt.then, ' ') +
                              ' anders ' + program_text(stmt.elsestmt, ' ') + ' eindals';
        case 'Stop': return 'stop';
        case 'Print': return 'print(' + stmt.varname + ')';
        default: return '...';
    }
}


function program_text(ast, separator) {
    // all statements as text: equal for two models that differ only in layout and comments
    return (ast || []).map(statement_text).join(separator === undefined ? '\n' : separator);
}


function first_line(stmt) {
    // line number of the first line of a statement (als ... : the line with 'als')
    if ((stmt.type == 'If' || stmt.type == 'IfElse') && stmt.cond) return stmt.cond.lineNo;
    return stmt.lineNo;
}


function lines_text(stmts) {
    // 'regel 9' or 'regels 9 t/m 11'
    if (!stmts || stmts.length === 0) return 'geen regels';
    var from = first_line(stmts[0]);
    var to = stmts[stmts.length - 1].lineNo;
    if (from === undefined || to === undefined) return 'de regels';
    return (from == to) ? 'regel ' + from : 'regels ' + from + ' t/m ' + to;
}


//
// Compile an expression with the code generator of evaluator.js.
// The variables are read from an object V: V["v"] instead of var_v.
//
function ValuesNamespace() {}

ValuesNamespace.prototype.createVar = function(name) {
    return 'V[' + JSON.stringify(name) + ']';
};
ValuesNamespace.prototype.referenceVar = function(node) {
    return 'V[' + JSON.stringify(node.name) + ']';
};

var codegenerator = new evaluator_js.CodeGenerator(new ValuesNamespace());

function evaluate(node, values) {
    var code = codegenerator.parseNode(node);
    return (new Function('V', 'return (' + code + ');'))(values);
}


//
// Stepper
//
function Stepper(startwaarden_ast, modelregels_ast, varNames, options) {
    // varNames: columns of the table (evaluator.namespace.varNames after a run)
    options = options || {};
    this.modelregels_ast = modelregels_ast;
    this.varNames = varNames;
    this.N = options.N || Infinity;     // stop after N iterations
    this.format = options.format || format_default;

    this.values = {};
    var i;
    for (i = 0; i < varNames.length; i++) this.values[varNames[i]] = NaN;
    // startwaarden: all at once
    this.run_statements(startwaarden_ast);

    this.iteration = 0;
    this.rows = [this.current_row()];
    this.stack = [];          // statements still to do in this iteration: [{stmts, index}]
    this.finished = false;    // after 'stop', 'print' or N iterations
    this.stopped = false;     // stopped by 'stop' or 'print'
}


Stepper.prototype.run_statements = function(stmts) {
    // execute statements without stepping (startwaarden)
    for (var i = 0; i < stmts.length; i++) {
        var stmt = stmts[i];
        if (stmt.type == 'Assignment') {
            this.values[stmt.left] = evaluate(stmt.right, this.values);
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            if (evaluate(stmt.cond, this.values)) this.run_statements(stmt.then);
            else if (stmt.elsestmt) this.run_statements(stmt.elsestmt);
        }
    }
};


Stepper.prototype.current_row = function() {
    var self = this;
    return this.varNames.map(function(name) { return self.values[name]; });
};


Stepper.prototype.in_iteration = function() {
    // is an iteration started and not yet finished?
    return this.stack.length > 0;
};


Stepper.prototype.table = function() {
    // rows for the table: finished iterations and the iteration that is busy
    if (this.in_iteration()) return this.rows.concat([this.current_row()]);
    return this.rows;
};


Stepper.prototype.step = function() {
    // execute one statement. Returns a description of what happened:
    //   {iteration, line, kind: 'assign'|'cond'|'stop'|'print', text, name,
    //    end_of_iteration, finished}
    // returns null if there is nothing left to do.
    if (this.finished) return null;

    if (!this.in_iteration()) {
        this.iteration += 1;
        this.stack.push({stmts: this.modelregels_ast, index: 0});
    }

    var frame = this.stack[this.stack.length - 1];
    var stmt = frame.stmts[frame.index];
    frame.index += 1;
    var step = {iteration: this.iteration, line: stmt.lineNo, name: undefined};
    var fmt = this.format;
    var detail;

    switch (stmt.type) {
        case 'Assignment':
            var before = {};
            for (var key in this.values) before[key] = this.values[key];
            var value = evaluate(stmt.right, this.values);
            this.values[stmt.left] = value;
            step.kind = 'assign';
            step.name = stmt.left;
            step.value = value;
            if (stmt.right.type == 'Number' || stmt.right.type == 'Boolean') {
                // Opp = 42,6: nothing to compute
                detail = stmt.left + ' = ' + expr_text(stmt.right);
            } else if (stmt.right.type == 'Variable') {
                detail = stmt.left + ' = ' + expr_text(stmt.right) + '  →  ' + stmt.left + ' = ' + fmt(value);
            } else {
                detail = stmt.left + ' = ' + expr_text(stmt.right) + '  →  ' +
                         stmt.left + ' = ' + substitute(stmt.right, before, fmt) + ' = ' + fmt(value);
            }
            break;
        case 'If':
        case 'IfElse':
            var cond = Boolean(evaluate(stmt.cond, this.values));
            step.kind = 'cond';
            step.line = first_line(stmt);
            step.value = cond;
            detail = 'als ' + expr_text(stmt.cond) + '  →  ' +
                     substitute(stmt.cond, this.values, fmt) + ' is ' + (cond ? 'waar' : 'onwaar') + ': ';
            if (cond) {
                detail += lines_text(stmt.then) + (stmt.then.length > 1 ? ' worden' : ' wordt') + ' uitgevoerd';
                this.stack.push({stmts: stmt.then, index: 0});
            } else if (stmt.elsestmt) {
                detail += lines_text(stmt.elsestmt) + ' (anders)' + (stmt.elsestmt.length > 1 ? ' worden' : ' wordt') +
                          ' uitgevoerd';
                this.stack.push({stmts: stmt.elsestmt, index: 0});
            } else {
                detail += lines_text(stmt.then) + (stmt.then.length > 1 ? ' worden' : ' wordt') + ' overgeslagen';
            }
            break;
        case 'Stop':
            step.kind = 'stop';
            detail = "stop: het model stopt hier";
            this.stopped = true;
            break;
        case 'Print':
            step.kind = 'print';
            step.name = stmt.varname;
            detail = 'print(' + stmt.varname + '): ' + stmt.varname + ' = ' + fmt(this.values[stmt.varname]) +
                     ', het model stopt hier';
            this.stopped = true;
            break;
        default:
            detail = '...';
    }

    // remove the lists of statements that are done (end of als ... eindals, end of iteration)
    while (this.stack.length > 0 && this.stack[this.stack.length - 1].index >= this.stack[this.stack.length - 1].stmts.length) {
        this.stack.pop();
    }
    if (this.stopped) {
        // 'stop' ends the iteration (the row with the values is kept, like in a Run)
        this.stack = [];
    }

    step.end_of_iteration = !this.in_iteration();
    if (step.end_of_iteration) {
        this.rows.push(this.current_row());
        if (this.stopped || this.iteration >= this.N) this.finished = true;
    }
    step.finished = this.finished;
    step.text = 'iteratie ' + step.iteration + ', regel ' + step.line + ':  ' + detail;
    return step;
};


exports.Stepper = Stepper;
exports.expr_text = expr_text;
exports.substitute = substitute;
exports.statement_text = statement_text;
exports.program_text = program_text;
exports.format_default = format_default;

},{"./evaluator.js":7}],23:[function(require,module,exports){
/*
    vergelijk.js

    Vergelijk twee runs: wat is er anders aan het model?
    Gebruikt voor de notitie onder de grafiek bij de grijze lijn van de vorige run:

      "Grijs: vorige run (k = 0,37 → nu 0,50)"

    No DOM. The difference is computed on the parsed model, so whitespace and
    comments do not count.

    usage:
      var vergelijk = require('./vergelijk.js');
      var a = vergelijk.source(evaluator.startwaarden_ast, evaluator.modelregels_ast, N);
      var d = vergelijk.differences(a, b);   // {changes: [...], model_changed, N}
      vergelijk.describe(d)                  // 'k = 0,37 → nu 0,50'
*/

//jshint node:true
//jshint es3:true
"use strict";

var stapper = require('./stapper.js');

var MAX_CHANGES = 3;   // more differences: "model gewijzigd"


function source(startwaarden_ast, modelregels_ast, N) {
    // what defines a run: startwaarden (name --> text of the value), modelregels and N
    var values = {};
    var order = [];
    var other = [];   // statements that are not a plain assignment (als ... dan in startwaarden)
    (startwaarden_ast || []).forEach(function(stmt) {
        if (stmt.type == 'Assignment') {
            if (!values.hasOwnProperty(stmt.left)) order.push(stmt.left);
            values[stmt.left] = stapper.expr_text(stmt.right);
        } else {
            other.push(stapper.statement_text(stmt));
        }
    });
    return {
        startwaarden: values,
        order: order,
        startwaarden_other: other.join('\n'),
        modelregels: stapper.program_text(modelregels_ast),
        N: N
    };
}


function differences(before, now) {
    // differences between two runs (source() of each run)
    var changes = [];
    now.order.forEach(function(name) {
        if (!before.startwaarden.hasOwnProperty(name)) {
            changes.push({name: name, before: undefined, now: now.startwaarden[name]});
        } else if (before.startwaarden[name] != now.startwaarden[name]) {
            changes.push({name: name, before: before.startwaarden[name], now: now.startwaarden[name]});
        }
    });
    before.order.forEach(function(name) {
        if (!now.startwaarden.hasOwnProperty(name)) {
            changes.push({name: name, before: before.startwaarden[name], now: undefined});
        }
    });
    return {
        changes: changes,
        model_changed: (before.modelregels != now.modelregels) ||
                       (before.startwaarden_other != now.startwaarden_other),
        N: (before.N != now.N) ? {before: before.N, now: now.N} : null
    };
}


function describe(diff) {
    // the differences in words (without "Grijs: vorige run")
    if (diff.model_changed || diff.changes.length > MAX_CHANGES) return 'model gewijzigd';
    var parts = diff.changes.map(function(c) {
        if (c.before === undefined) return c.name + ' = ' + c.now + ' is nieuw';
        if (c.now === undefined) return c.name + ' is weggehaald';
        return c.name + ' = ' + c.before + ' → nu ' + c.now;
    });
    if (diff.N && parts.length < MAX_CHANGES) {
        parts.push('iteraties ' + diff.N.before + ' → nu ' + diff.N.now);
    }
    if (parts.length === 0) return 'hetzelfde model';
    return parts.join('; ');
}


exports.source = source;
exports.differences = differences;
exports.describe = describe;

},{"./stapper.js":22}]},{},[13])(13)
});
