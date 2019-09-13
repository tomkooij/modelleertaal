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

    it('parseBogusXMLString parses N = ... line', function() {
        testmodel.parseBogusXMLString(bogusModel);
        assert.equal(testmodel.N, 1000);
    })
});
