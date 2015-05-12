var assert = require("assert"); // node.js core module

var parser = require("../modelleertaal.js").parser; // jison generated parser

describe('modelleertaal.js - Modelleertaal Parser generated by Jison', function(){
    it('parses assignments', function() {
        assert.equal(typeof parser.parse('t=t'),'object');
    })

    it('parses numbers', function() {
        assert.equal(parser.parse('t=3')[0].right.value,'3');
        assert.equal(parser.parse('t=03')[0].right.value,'03');
        assert.equal(parser.parse('t=3,734')[0].right.value,'3,734');
        assert.equal(parser.parse('t=3.734')[0].right.value,'3.734');
        assert.equal(parser.parse('t=3.7e-5')[0].right.value,'3.7e-5');
    })

    it('parses unary operators', function() {
        assert.equal(parser.parse('t=-3')[0].right.operator,'-');
        assert.equal(parser.parse('t=!3')[0].right.operator,'NOT');
    })

    it('parses math expressions', function() {
        assert.equal(typeof parser.parse('t=t+2*3-5*(6*7)-5^3'),'object');
    })

    it('parses functions', function() {
        assert.equal(parser.parse('t=somefunction(x)')[0].right.func,'somefunction');
    })

    it('parses stop', function() {
        assert.equal(parser.parse('stop')[0].type,'Stop');
    })

    it('parses true and false', function() {
        assert.equal(parser.parse('t = waar')[0].right.type,'True');
        assert.equal(parser.parse('t = onwaar')[0].right.type,'False');
    })

    it('parses if statements', function() {
        assert.equal(parser.parse('als waar dan stop eindals')[0].type,'If');
    })




});
