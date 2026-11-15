var assert = require('chai').assert;

var aflezen = require("../aflezen.js");

// t, v, x: v = 9,81 t
var ROWS = [];
for (var i = 0; i <= 10; i++) ROWS.push([i * 0.1, 9.81 * i * 0.1, 4.905 * Math.pow(i * 0.1, 2)]);

describe('aflezen.js - helling bij een punt in de grafiek', function() {

    it('helling van een rechte lijn', function() {
        assert.closeTo(aflezen.slope(ROWS, 0, 1, 5), 9.81, 1e-9);
    });

    it('helling aan het begin en eind: één kant', function() {
        assert.closeTo(aflezen.slope(ROWS, 0, 1, 0), 9.81, 1e-9);
        assert.closeTo(aflezen.slope(ROWS, 0, 1, 10), 9.81, 1e-9);
    });

    it('helling van een parabool: centraal verschil', function() {
        // x = 4,905 t^2: dx/dt = 9,81 t = 4,905 bij t = 0,5
        assert.closeTo(aflezen.slope(ROWS, 0, 2, 5), 4.905, 1e-9);
    });

    it('geen helling bij een verticale lijn of ongeldige waarden', function() {
        assert.isNull(aflezen.slope([[1, 0], [1, 1], [1, 2]], 0, 1, 1));
        assert.isNull(aflezen.slope([[0, NaN], [1, NaN]], 0, 1, 0));
        assert.isNull(aflezen.slope([[0, 1]], 0, 1, 0));
    });

    it('raaklijn tot aan de assen', function() {
        var range = {xmin: 0, xmax: 1, ymin: 0, ymax: 10};
        // y = 2 + 4x: from the y-axis (0, 2) to the edge on the right (1, 6)
        var line = aflezen.tangent_to_axes([0.5, 4], 4, range);
        assert.deepEqual(line, [[0, 2], [1, 6]]);
        // y = 8 - 16x: from the y-axis (0, 8) to the x-axis (0,5, 0)
        line = aflezen.tangent_to_axes([0.25, 4], -16, range);
        assert.deepEqual(line, [[0, 8], [0.5, 0]]);
        // y = 20x - 5: from the x-axis (0,25, 0) to the top (0,75, 10)
        line = aflezen.tangent_to_axes([0.5, 5], 20, range);
        assert.closeTo(line[0][0], 0.25, 1e-12);
        assert.equal(line[0][1], 0);
        assert.closeTo(line[1][0], 0.75, 1e-12);
        assert.equal(line[1][1], 10);
        // horizontal
        assert.deepEqual(aflezen.tangent_to_axes([0.5, 3], 0, range), [[0, 3], [1, 3]]);
        // the helling of the line is the slope
        line = aflezen.tangent_to_axes([0.3, 7], 3.3, range);
        assert.closeTo((line[1][1] - line[0][1]) / (line[1][0] - line[0][0]), 3.3, 1e-9);
        // point outside the graph (zoomed in) or no graph
        assert.isNull(aflezen.tangent_to_axes([2, 3], 1, range));
        assert.isNull(aflezen.tangent_to_axes([0.5, 3], 1, {xmin: 0, xmax: 0, ymin: 0, ymax: 1}));
    });

    it('eenheid van de helling', function() {
        assert.equal(aflezen.slope_unit('m/s', 's'), '(m/s)/s');
        assert.equal(aflezen.slope_unit('m', 's'), 'm/s');
        assert.equal(aflezen.slope_unit('', 's'), '');
    });
});
