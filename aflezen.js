/*
    aflezen.js

    Aflezen in de grafiek: de helling (raaklijn) bij een aangeklikt punt.
    "Bepaal de versnelling uit het (v,t)-diagram" (examenvaardigheid).

    No DOM.

    usage:
      var aflezen = require('./aflezen.js');
      aflezen.slope(rows, xi, yi, row)       // dy/dx from the neighbours of row, or null
      aflezen.tangent([x0, y0], slope, {xmin, xmax, ymin, ymax})   // [[x1, y1], [x2, y2]]
      aflezen.slope_unit('m/s', 's')         // '(m/s)/s'
*/

//jshint node:true
//jshint es3:true
"use strict";

var TANGENT_LENGTH = 0.12;   // half the length of the tangent, as a part of the graph


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


function tangent(point, s, range) {
    // a short piece of the tangent through point, with the same length on screen for every slope.
    // It stays inside range (the graph), so the axes do not change.
    var X = range.xmax - range.xmin, Y = range.ymax - range.ymin;
    if (isNaN(X) || X <= 0) return null;
    if (isNaN(Y) || Y <= 0) Y = Math.abs(s) * X || 1;
    var s_screen = s * X / Y;
    var hx = TANGENT_LENGTH / Math.sqrt(1 + s_screen * s_screen) * X;
    var x0 = point[0], y0 = point[1];

    function clip(sign) {
        var h = hx;
        var x = x0 + sign * h;
        if (x > range.xmax) h = range.xmax - x0;
        if (x < range.xmin) h = x0 - range.xmin;
        var y = y0 + sign * s * h;
        if (s !== 0 && y > range.ymax) h = Math.min(h, Math.abs((range.ymax - y0) / s));
        if (s !== 0 && y < range.ymin) h = Math.min(h, Math.abs((y0 - range.ymin) / s));
        h = Math.max(h, 0);
        return [x0 + sign * h, y0 + sign * s * h];
    }
    return [clip(-1), clip(1)];
}


function slope_unit(y_unit, x_unit) {
    // unit of the slope: 'm/s' and 's' --> '(m/s)/s'. Unknown: ''
    if (!y_unit || !x_unit) return '';
    function wrap(u) { return /[\/\s*]/.test(u) ? '(' + u + ')' : u; }
    return wrap(y_unit) + '/' + wrap(x_unit);
}


exports.slope = slope;
exports.tangent = tangent;
exports.slope_unit = slope_unit;
