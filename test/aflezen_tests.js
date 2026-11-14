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

    it('raaklijn door het punt, binnen de grafiek', function() {
        var range = {xmin: 0, xmax: 1, ymin: 0, ymax: 9.81};
        var line = aflezen.tangent([0.5, 4.905], 9.81, range);
        // through the point, with the slope
        assert.closeTo((line[1][1] - line[0][1]) / (line[1][0] - line[0][0]), 9.81, 1e-9);
        assert.closeTo((line[0][1] + line[1][1]) / 2, 4.905, 1e-9);
        // at the edge: shorter, not outside the graph
        line = aflezen.tangent([1, 9.81], 9.81, range);
        assert.closeTo(line[1][0], 1, 1e-12);
        assert.isTrue(line[1][1] <= 9.81 + 1e-12);
    });

    it('eenheid van de helling', function() {
        assert.equal(aflezen.slope_unit('m/s', 's'), '(m/s)/s');
        assert.equal(aflezen.slope_unit('m', 's'), 'm/s');
        assert.equal(aflezen.slope_unit('', 's'), '');
    });
});
