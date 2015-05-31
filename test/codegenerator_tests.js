var assert = require('chai').assert;

var codegen = require("../evaluator.js").CodeGenerator;
codegenerator = new codegen();
var parser = require("../modelleertaal.js").parser; // jison generated parser

describe('CodeGenertor.generateCodeFromAst() generate javascript from parsed AST', function(){

    it('CodeGenerator class exists in evaluator.js', function() {
        assert.typeOf(codegen,'function');
    })

    it('CodeGenerator reads AST', function() {
        ast = parser.parse("t=3*2");
        code = codegenerator.generateCodeFromAst(ast);
        assert.typeOf(code,'string');
    })

    it('CodeGenerator generates math expressions', function() {
        ast = parser.parse("t=3*2 + 10^3");
        code = codegenerator.generateCodeFromAst(ast);
        assert.include(code,'3*2');
        assert.include(code,'Math.pow')
    })

    it('CodeGenerator generates sin/cos/tan math functions', function() {
        ast = parser.parse("x=1\nt=sin(x)+cos(x)+tan(x)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.include(code,'Math.sin');
        assert.include(code,'Math.cos');
        assert.include(code,'Math.tan');
    })

    it('CodeGenerator generates arcsin/arccos/arctan math functions', function() {
        ast = parser.parse("x=1\nt=arcsin(x)+arccos(x)+arctan(x)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.include(code,'Math.asin');
        assert.include(code,'Math.acos');
        assert.include(code,'Math.atan');
    })

    it('CodeGenerator generates ln/exp/sqrt math functions', function() {
        ast = parser.parse("x=1\nt=ln(x)+exp(x)+sqrt(x)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.include(code,'Math.log');
        assert.include(code,'Math.exp');
        assert.include(code,'Math.sqrt');
    })
});

describe('CodeGenertor.generateCodeFromAst() correct output of math expressions', function(){

    it('operator precedence: 3 + 2 * 5 = 13', function() {
        ast = parser.parse("t=3+2*5");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),13);
    })

    it('operator precedence: 3 - 2 * 5 = -7', function() {
        ast = parser.parse("t=3-2*5");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),-7);
    })

    it('operator precedence: 3 ^ 2 * 3 = 27', function() {
        ast = parser.parse("t=3^2*3");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),27);
    })

    it('correct functionality of unary operator: 2 + -3 + 1 == 0', function() {
        ast = parser.parse("t=2 + -3 + 1");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),0);
    })


    it('operator precedence: -3 ^ 2 = -9 ', function() {
        ast = parser.parse("t=-3^2");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),-9);
    })

    it('operator precedence: (-3)^ 2 = +9 ', function() {
        ast = parser.parse("t=(-3)^2");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),9);
    })

    it('operator precedence: -(3+2) ^ 2 = -25', function() {
        ast = parser.parse("t=-(3+2) ^ 2");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),-25);
    })

    it('some stupid long math expression: 2*5^2-3^(5+-2^2)+3*sqrt(9) = 56 ', function() {
        ast = parser.parse("t=2*5^2-3^(5+-2^2)+3*sqrt(9)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),56);
    })

    it('pi = 3.1415...', function() {
        ast = parser.parse("t = pi");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3.14159265359);
    })

    it('Math.sin: sin(45/180*pi) = 0.707..', function() {
        ast = parser.parse("t=sin(45/180*pi)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),0.707,0.01);
    })

    it('Math.asin: arcsin(0.707) = 1/4*pi', function() {
        ast = parser.parse("t=arcsin(0,707)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),(1/4*3.1415),0.01);
    })

    it('SysNat scientific notation: G = 6,67*10^-11', function() {
        ast = parser.parse("G = 6,67*10^-11");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),6.67e-11,0.01);
    })

});

describe('CodeGenertor.generateCodeFromAst() correct flow control', function(){

    it('als dan eindals', function() {
        ast = parser.parse("t = 0 \n als waar dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
    })
    it('Multiple statements between dan ... eindals', function() {
        ast = parser.parse("t = 0 \n als waar dan t = 3 \n a = 5 \n b = 17 \n eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),17);
    })
    it('Correct functionality of == > >= < <= in als dan statement', function() {
        ast = parser.parse("t = 0 \n als 1==1 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
        ast = parser.parse("t = 0 \n als 1>0 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
        ast = parser.parse("t = 0 \n als 2>=2 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
        ast = parser.parse("t = 0 \n als 2<=2 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
        ast = parser.parse("t = 0 \n als 2<2 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),0);
        ast = parser.parse("t = 0 \n als 2>2 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),0);
    })


});
