var assert = require("assert"); // node.js core module

var modelclass = require("../model.js").Model;
var testmodel = new modelclass();

var bogusModel = '<modelleertaal>\n\r' +
                        '<modelregels>\nt=t+dt\np=5\n</modelregels>\n\r' +
                        '<startwaarden>\nParseMe!\n</startwaarden>\n';

describe('model.js - Read model from XML', function(){

    it('parseBogusXMLString parses test string', function() {
        testmodel.parseBogusXMLString(bogusModel);
        assert.equal(testmodel.startwaarden,'ParseMe!\n');
    })

    it('readBogusXMLFile reads and parses testmodel.xml', function() {
        testmodel.readBogusXMLFile('test/testmodel/testmodel.xml');
        assert.notEqual(testmodel.startwaarden,'');
    })

    it('<grafisch> wordt gelezen en weer geschreven', function() {
        var m = new modelclass();
        m.parseBogusXMLString('<modelleertaal>\n<startwaarden>\nx=1\n</startwaarden>\n<modelregels>\n' +
                              'x=x+1\n</modelregels>\n<grafisch>\nFres: Fz, Fp\n</grafisch>\n</modelleertaal>\n');
        assert.equal(m.grafisch, 'Fres: Fz, Fp\n');
        assert.equal(m.modelregels, 'x=x+1\n');
        var m2 = new modelclass();
        m2.parseBogusXMLString(m.createBogusXMLString());
        assert.equal(m2.grafisch, 'Fres: Fz, Fp\n');
        // without <grafisch>: nothing extra in the file
        m2.grafisch = '';
        assert.equal(m2.createBogusXMLString().indexOf('grafisch'), -1);
    });

    it('parseBogusXMLString parses N = ... line', function() {
        testmodel.parseBogusXMLString(bogusModel);
        assert.equal(testmodel.N, 1000);
    })

    it('N = ... wordt ook gevonden na een langere regel met =', function() {
        // vroeger: de regexp had /g, en lastIndex van de vorige regel liet N missen
        var m = new modelclass();
        m.parseBogusXMLString('<modelleertaal>\nabcdefghijkl = 1\nN = 500\n<startwaarden>\nx=1\n</startwaarden>\n');
        assert.equal(m.N, 500);
        m = new modelclass();
        m.parseBogusXMLString('<modelleertaal>\nN=10000\n');
        assert.equal(m.N, 10000);
    });

    it('alleen N = ... telt, geen andere naam die op N eindigt', function() {
        var m = new modelclass();
        m.parseBogusXMLString('<modelleertaal>\nAN = 5\nn = 7\n<startwaarden>\nN = 3\n</startwaarden>\n');
        assert.equal(m.N, undefined);
    });

    it('Open + Bewaar geeft geen extra lege regels', function() {
        var xml = '<modelleertaal>\nN = 500\n<startwaarden>\nx = 1\n\ny = 2\n</startwaarden>\n' +
                  '<modelregels>\nx = x + 1\n</modelregels>\n<grafisch>\nFres: Fz\n</grafisch>\n</modelleertaal>\n';
        var m = new modelclass();
        m.parseBogusXMLString(xml);
        assert.equal(m.createBogusXMLString(), xml);
        // tekst uit de editor zonder regeleinde aan het eind: hetzelfde bestand
        m.startwaarden = 'x = 1\n\ny = 2';
        m.modelregels = 'x = x + 1';
        assert.equal(m.createBogusXMLString(), xml);
        // twee keer lezen en schrijven: niets erbij
        var m2 = new modelclass();
        m2.parseBogusXMLString(m.createBogusXMLString());
        assert.equal(m2.createBogusXMLString(), xml);
    });

    it('lege secties worden geschreven zonder lege regel', function() {
        var m = new modelclass();
        assert.equal(m.createBogusXMLString(),
            '<modelleertaal>\n<startwaarden>\n</startwaarden>\n<modelregels>\n</modelregels>\n</modelleertaal>\n');
        m.parseBogusXMLString(m.createBogusXMLString());
        assert.equal(m.startwaarden, '');
        assert.equal(m.modelregels, '');
    });
});
