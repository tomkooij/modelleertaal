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

    it('eenheden lezen en schrijven: N/kg is m/s², km/h blijft km/h', function() {
        var f = function(t) { return eenheden.format(eenheden.parse(t)); };
        assert.equal(f('N/kg'), 'm/s²');
        assert.equal(f('kg*m/s^2'), 'N');
        assert.equal(f('kg·m²/s³'), 'W');
        assert.equal(f('m s-1'), 'm/s');
        assert.equal(f('(m/s)/s'), 'm/s²');
        assert.equal(f('1/s'), '1/s');
        assert.equal(f('km/h'), 'km/h');
        assert.equal(f('graden Celsius!'), 'graden Celsius!', 'niet begrepen: één symbool');
        assert.equal(eenheden.format(eenheden.parse('m/s^2'), ['m/s^2']), 'm/s^2', 'zoals in het model');
    });

    it('eenheden afleiden uit de formules, ook terug (x = x + dx: dx in m)', function() {
        var d = eenheden.derive("x = 0 '[m]\nt = 0 '[s]\ndt = 1\nm = 25 '[kg]\nF = 100 '[N]\nv = 0",
            "Fres = F\na = Fres/m\ndv = a * dt\nv = v + dv\ndx = v * dt\nx = x + dx\nEk = 0,5*m*v^2\nP = Fres*v\nt = t + dt");
        assert.deepEqual(d.units, {x: 'm', t: 's', m: 'kg', F: 'N', Fres: 'N', a: 'm/s²', dx: 'm', dt: 's',
                                   dv: 'm/s', v: 'm/s', Ek: 'J', P: 'W'});
        assert.isTrue(d.derived.v);
        assert.isUndefined(d.derived.x);
        assert.deepEqual(d.conflicts, {});
    });

    it('zonder tijdseenheid geen aanname; tegenstrijdige eenheid wordt gemeld', function() {
        var d = eenheden.derive("x = 0 '[m]\nv = 2\nt = 0\ndt = 0,1", "x = x + v*dt\nt = t + dt");
        assert.isUndefined(d.units.v, 'eenheid van dt onbekend');
        d = eenheden.derive("m = 2 '[kg]\nF = 4 '[N]\na = 0 '[m/s]", "a = F/m");
        assert.deepEqual(d.conflicts, {a: 'volgens de formule is de eenheid m/s², niet m/s'});
        d = eenheden.derive("x = (", "");
        assert.deepEqual(d.units, {}, 'fout in het model: alleen het commentaar');
        d = eenheden.derive("k = 3 '[1/s]\nN = 100 '[kg]\nt = 0 '[dag]\ndt = 1", "N = N - k*N*dt\nt = t + dt");
        // k per s, t in dagen: de fout komt bij N of bij t (welke volgt uit de volgorde)
        assert.equal(Object.keys(d.conflicts).length, 1);
        assert.match(d.conflicts.N || d.conflicts.t, /dag/);
        assert.equal(eenheden.derive("v = 3 '[m/s]", "w = sqrt(v^2 + 1)\nh = sin(v)").units.w, 'm/s');
    });

    it('een getal met een eenheid die er niet staat (9,81) maakt de eenheid onbekend', function() {
        var d = eenheden.derive("m = 91 '[kg]\nv = 0\nx = 0\nt = 0 '[s]\ndt = 0,1",
            "Fz = m * 9,81\nFr = Fz - Fw\na = Fr/m\nv = v + a*dt\nx = x + v*dt\nt = t + dt");
        ['Fz', 'Fr', 'a', 'v', 'x'].forEach(function(name) { assert.isUndefined(d.units[name], name); });
        // terug oplossen ook niet: m krijgt geen N
        d = eenheden.derive("Fz = 0 '[N]\nm = 3", "Fz = m * 9,81");
        assert.isUndefined(d.units.m);
        // gehele getallen, 0,5 en pi wel
        d = eenheden.derive("m = 2 '[kg]\nv = 3 '[m/s]\nr = 1 '[m]", "Ek = 0,5 * m * v^2\np = 2 * m * v\nO = 2 * pi * r\nh = r / 2");
        assert.equal(d.units.Ek, 'J');
        assert.equal(d.units.p, 'kg·m/s');
        assert.equal(d.units.O, 'm');
        assert.equal(d.units.h, 'm');
    });

    it('geen lege haken: a () wordt a', function() {
        assert.equal(eenheden.label('a', {a: ''}), 'a');
        assert.equal(eenheden.labels(['a', 'b'], {a: '', b: ''}), 'a, b');
    });
});
