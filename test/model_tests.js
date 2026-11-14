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
});
