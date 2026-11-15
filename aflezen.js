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
