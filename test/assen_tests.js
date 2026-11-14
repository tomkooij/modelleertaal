var assert = require('chai').assert;

var assen = require("../assen.js");

describe('assen.js - tweede verticale as bij meerdere grafieken', function() {

    it('vergelijkbaar bereik: één as', function() {
        assert.deepEqual(assen.split(['x', 'y'], {x: [0, 800], y: [0, 100]}), {left: ['x', 'y'], right: []});
    });

    it('meer dan een factor 20 verschil: kleine grootheid rechts', function() {
        assert.deepEqual(assen.split(['x', 'v', 'a'], {x: [0, 800], v: [0, 12], a: [-9.81, 0]}),
                         {left: ['x'], right: ['v', 'a']});
    });

    it('negatieve waarden tellen ook', function() {
        assert.deepEqual(assen.split(['F', 'v'], {F: [-5000, 0], v: [0, 30]}), {left: ['F'], right: ['v']});
    });

    it('een grootheid die overal 0 is blijft links', function() {
        assert.deepEqual(assen.split(['x', 'z'], {x: [0, 800], z: [0, 0]}), {left: ['x', 'z'], right: []});
    });

    it('bereik van de gegevens', function() {
        assert.deepEqual(assen.data_range([[0, 3], null, [1, -2], [2, 5]]), [-2, 5]);
        assert.isNull(assen.data_range([null]));
    });
});
