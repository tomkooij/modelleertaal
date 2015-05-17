var assert = require("assert"); // node.js core module

var modelclass = require("../model.js").Model;
var testmodel = new modelclass();

describe('model.js - Read model from XML', function(){

    it('readBogusXMLFile reads and parses testmodel.xml', function() {
        testmodel.readBogusXMLFile('test/testmodel/testmodel.xml');
        assert.notEqual(testmodel.startwaarden,'');
    })

});
