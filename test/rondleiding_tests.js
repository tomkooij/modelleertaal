var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');
var rondleiding = require('../rondleiding.js');

/*
    De rondleidingen (knop Rondleiding): voor leerlingen en voor docenten, elk vijf stappen,
    en elke stap wijst naar iets dat in index.html staat. Hernoem je een id of class in
    index.html, dan faalt deze test.
*/
describe('rondleiding', function () {
    var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    var R = rondleiding.RONDLEIDINGEN;

    it('er is een rondleiding voor leerlingen en een voor docenten', function () {
        assert.sameMembers(Object.keys(R), ['leerling', 'docent']);
    });

    Object.keys(R).forEach(function (naam) {
        describe(naam, function () {
            it('heeft een naam, uitleg, slottekst en vijf stappen met titel en tekst', function () {
                assert.isString(R[naam].naam);
                assert.isString(R[naam].uitleg);
                assert.isString(R[naam].einde);
                assert.lengthOf(R[naam].stappen, 5);
                R[naam].stappen.forEach(function (stap) {
                    assert.isString(stap.titel);
                    assert.isAbove(stap.tekst.length, 40);
                });
            });

            it('elke stap wijst naar een element in index.html', function () {
                R[naam].stappen.forEach(function (stap) {
                    var m = /^([.#])([\w-]+)$/.exec(stap.doel);
                    assert.isNotNull(m, 'eenvoudige selector: ' + stap.doel);
                    var attr = m[1] == '#' ? 'id' : 'class';
                    var re = new RegExp(attr + '="(?:[^"]* )?' + m[2] + '(?: [^"]*)?"');
                    assert.match(html, re, stap.doel + ' staat in index.html');
                });
            });
        });
    });

    it('docenten zien andere onderdelen dan leerlingen', function () {
        var titels = function (r) { return r.stappen.map(function (s) { return s.titel; }); };
        titels(R.docent).forEach(function (t) {
            assert.notInclude(titels(R.leerling), t);
        });
    });

    it('de knop staat in index.html', function () {
        assert.include(html, 'id="rondleiding_knop"');
    });
});
