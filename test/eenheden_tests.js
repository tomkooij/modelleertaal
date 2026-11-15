var assert = require('chai').assert;

var eenheden = require("../eenheden.js");

describe('eenheden.js - eenheden uit het commentaar', function() {

    it('eenheid achter een startwaarde, met \' en //', function() {
        var u = eenheden.units("m = 91 '[kg]\nv = 0 // [m/s] beginsnelheid\nt = 0 '[s]", "");
        assert.deepEqual(u, {m: 'kg', v: 'm/s', t: 's'});
    });

    it('ook # en /* */ en := ', function() {
        var u = eenheden.units("x := 0 # [m]\ny = 2 /* [m] */", "");
        assert.deepEqual(u, {x: 'm', y: 'm'});
    });

    it('zonder haken: geen eenheid', function() {
        assert.deepEqual(eenheden.units("m = 91 'massa\nv = 0\ndt = 0,1", "v = v + a*dt"), {});
    });

    it('haken buiten het commentaar tellen niet', function() {
        assert.deepEqual(eenheden.units("x = 3", "y = x 'geen eenheid"), {});
    });

    it('eenheid achter een modelregel, voor variabelen zonder startwaarde', function() {
        var u = eenheden.units("v = 0 '[m/s]", "Fw = k*v^2 ' [N] wrijving\nv = v + a*dt '[km/h]");
        assert.deepEqual(u, {v: 'm/s', Fw: 'N'});
    });

    it('lege haken en als ... dan worden overgeslagen', function() {
        var u = eenheden.units("k = 3 '[]", "als t > 3 dan x = 1 eindals '[m]\na == b '[m]");
        assert.deepEqual(u, {});
    });

    it('labels', function() {
        var u = {x: 'm', y: 'm', v: 'm/s'};
        assert.equal(eenheden.label('x', u), 'x (m)');
        assert.equal(eenheden.label('t', u), 't');
        assert.equal(eenheden.labels(['x', 'y'], u), 'x, y (m)');
        assert.equal(eenheden.labels(['x', 'v'], u), 'x (m), v (m/s)');
        assert.equal(eenheden.labels(['x', 't'], u), 'x (m), t');
    });
});
