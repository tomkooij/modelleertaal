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
