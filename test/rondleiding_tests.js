var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');
var rondleiding = require('../rondleiding.js');

/*
    De rondleiding (knop Rondleiding): vijf stappen, en elke stap wijst naar iets dat in
    index.html staat. Hernoem je een id of class in index.html, dan faalt deze test.
*/
describe('rondleiding', function () {
    var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    it('heeft vijf stappen met titel en tekst', function () {
        assert.lengthOf(rondleiding.STAPPEN, 5);
        rondleiding.STAPPEN.forEach(function (stap) {
            assert.isString(stap.titel);
            assert.isAbove(stap.tekst.length, 40);
        });
    });

    it('elke stap wijst naar een element in index.html', function () {
        rondleiding.STAPPEN.forEach(function (stap) {
            var m = /^([.#])([\w-]+)$/.exec(stap.doel);
            assert.isNotNull(m, 'eenvoudige selector: ' + stap.doel);
            var attr = m[1] == '#' ? 'id' : 'class';
            var re = new RegExp(attr + '="(?:[^"]* )?' + m[2] + '(?: [^"]*)?"');
            assert.match(html, re, stap.doel + ' staat in index.html');
        });
    });

    it('de knop staat in index.html', function () {
        assert.include(html, 'id="rondleiding_knop"');
    });
});
