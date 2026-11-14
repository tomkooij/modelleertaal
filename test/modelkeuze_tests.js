var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var modelkeuze = require("../modelkeuze.js");

var INDEX = [
    {title: "Examen A", url: "modellen/a.xml", groep: "Examens vwo", sectie: ""},
    {title: "Leeg model", url: "modellen/leeg.xml", groep: "Examens vwo", sectie: ""},
    {title: "0 Leeg model", url: "modellen/leeg.xml", groep: "C2", sectie: "Basismodellen"},
    {title: "Bungeejumper", url: "modellen/c2/Bungeejumper.xml", groep: "C2", sectie: "Opgaven"},
    {title: "1 Constante snelheid", url: "modellen/c2/constantesnelheid.xml", groep: "C2", sectie: "Basismodellen"},
    {title: "Zonder groep", url: "modellen/x.xml"}
];


function read_models_js() {
    var file = path.join(__dirname, '..', 'modellen', 'models.js');
    var sandbox = {};
    vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nthis.model_index = model_index;', sandbox);
    return sandbox.model_index;
}


function xml_files(dir, prefix) {
    var result = [];
    fs.readdirSync(dir).forEach(function(name) {
        var full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            result = result.concat(xml_files(full, prefix + name + '/'));
        } else if (/\.xml$/.test(name)) {
            result.push(prefix + name);
        }
    });
    return result;
}


describe('modelkeuze.js: gelaagde modelkeuze', function() {

    it('groepen in de volgorde van de lijst, zonder groep: overig', function() {
        assert.deepEqual(modelkeuze.groepen(INDEX), ["Examens vwo", "C2", modelkeuze.OVERIG]);
    });

    it('secties in de volgorde waarin ze voor het eerst voorkomen, met de index in model_index', function() {
        assert.deepEqual(modelkeuze.secties(INDEX, "C2"), [
            {sectie: "Basismodellen", modellen: [{index: 2, title: "0 Leeg model"}, {index: 4, title: "1 Constante snelheid"}]},
            {sectie: "Opgaven", modellen: [{index: 3, title: "Bungeejumper"}]}
        ]);
        assert.deepEqual(modelkeuze.secties(INDEX, "Examens vwo"), [
            {sectie: "", modellen: [{index: 0, title: "Examen A"}, {index: 1, title: "Leeg model"}]}
        ]);
        assert.deepEqual(modelkeuze.secties(INDEX, "bestaat niet"), []);
    });

    it('naam voor #model=... (met submap)', function() {
        assert.equal(modelkeuze.naam_van_url("modellen/examenvwo2005.xml"), "examenvwo2005");
        assert.equal(modelkeuze.naam_van_url("modellen/c2/Bungeejumper.xml"), "c2/Bungeejumper");
        assert.equal(modelkeuze.naam_van_url("modellen/c2/Val_zonder_luchtweerstand_(fysische_vrije_val).xml"),
            "c2/Val_zonder_luchtweerstand_(fysische_vrije_val)");
        assert.equal(modelkeuze.naam_van_url("modellen/b1/Massa-veersysteem.xml"), "b1/Massa-veersysteem");
    });

    it('zoek_url: het eerste model met deze url', function() {
        assert.equal(modelkeuze.zoek_url(INDEX, "modellen/leeg.xml"), 1);
        assert.equal(modelkeuze.zoek_url(INDEX, "modellen/c2/Bungeejumper.xml"), 3);
        assert.equal(modelkeuze.zoek_url(INDEX, "modellen/onbekend.xml"), -1);
    });

    it('zoek_url: een model uit een submap in de groep van zijn module', function() {
        var index = [
            {title: "Kogelbaan", url: "modellen/c3/kogelbaan.xml", groep: "Basismodellen"},
            {title: "1 Kogelbaan", url: "modellen/c3/kogelbaan.xml", groep: "C3 Gravitatie", sectie: "Basismodellen"},
            {title: "Slinger", url: "modellen/b1/3_Slinger.xml", groep: "Basismodellen"}
        ];
        assert.equal(modelkeuze.zoek_url(index, "modellen/c3/kogelbaan.xml"), 1);
        // no groep of the module: the first one
        assert.equal(modelkeuze.zoek_url(index, "modellen/b1/3_Slinger.xml"), 2);
    });
});


describe('modellen/models.js', function() {
    var index = read_models_js();
    var root = path.join(__dirname, '..');

    it('elk model heeft een titel, een groep en een bestand dat bestaat', function() {
        index.forEach(function(entry) {
            assert.ok(entry.title, entry.url);
            assert.ok(entry.groep, entry.url);
            assert.ok(fs.existsSync(path.join(root, entry.url)), 'bestand ontbreekt: ' + entry.url);
        });
    });

    it('elk .xml-bestand in modellen/ staat in models.js', function() {
        var urls = index.map(function(entry) { return entry.url; });
        xml_files(path.join(root, 'modellen'), 'modellen/').forEach(function(url) {
            assert.include(urls, url, 'niet in models.js: ' + url);
        });
    });

    it('een #model=... link vindt elk model terug, een model van een module in zijn eigen module', function() {
        index.forEach(function(entry) {
            var name = modelkeuze.naam_van_url(entry.url);
            var found = index[modelkeuze.zoek_url(index, 'modellen/' + name + '.xml')];
            assert.equal(found.url, entry.url);
            var map = name.split('/');
            if (map.length > 1) assert.match(found.groep, new RegExp('^' + map[0] + ' ', 'i'), name);
        });
    });

    it('binnen een groep staat elke sectie bij elkaar', function() {
        modelkeuze.groepen(index).forEach(function(groep) {
            var seen = [], last;
            index.forEach(function(entry) {
                if (entry.groep != groep) return;
                if (entry.sectie !== last) {
                    assert.notInclude(seen, entry.sectie, groep + ': sectie ' + entry.sectie + ' staat op twee plaatsen');
                    seen.push(entry.sectie);
                    last = entry.sectie;
                }
            });
        });
    });
});
