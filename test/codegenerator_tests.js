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

    it('CodeGenerator generates booleans', function() {
        ast = parser.parse("t=waar");
        code = codegenerator.generateCodeFromAst(ast);
        assert.include(code,'true');
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

    it('operator precedence (unicode squared): 3² * 3 = 27', function() {
        ast = parser.parse("t=3²*3");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),27);
    })

    it('correct functionality of unary - operator: 2 + -3 + 1 == 0', function() {
        ast = parser.parse("t=2 + -3 + 1");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),0);
    })

    it('correct functionality of unary + operator: + 2 - 3 + 1 == 0', function() {
        ast = parser.parse("t=+ 2 + -3 + 1");
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

    it('operator precedence (unicode squared): -(3+2)² = -25', function() {
        ast = parser.parse("t=-(3+2)²");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),-25);
    })

    it('operator precedence (unicode cubed): -(3+2)³ = -125', function() {
        ast = parser.parse("t=-(3+2)²");
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

    it('Math.sin (degrees): sin(45) = 0.707..', function() {
        ast = parser.parse("t=sin(45)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),0.707,0.01);
    })

    it('Math.cos (degrees): cos(60) = 0.5..', function() {
        ast = parser.parse("t=cos(60)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),0.5,0.01);
    })

    it('Math.tan (degrees): tan(45) = 1.', function() {
        ast = parser.parse("t=tan(45)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),1.,0.01);
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
    it('sign operator: sign(-8) == -1', function() {
        ast = parser.parse("x = sign(-8)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),-1,0.01);
    })
    it('SysNat teken() operator: teken(v)*Fwr', function() {
        ast = parser.parse("x = teken(-8)");
        code = codegenerator.generateCodeFromAst(ast);
        assert.closeTo(eval(code),-1,0.01);
    })
});

describe('CodeGenertor.generateCodeFromAst() correct flow control', function(){

    it('als dan eindals', function() {
        ast = parser.parse("t = 0 \n als waar dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
    })
    it('als dan anders eindals - test dan', function() {
        ast = parser.parse("t = 0 \n als waar dan t = 3 anders t = 1 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
    })
    it('als dan anders eindals - test anders', function() {
        ast = parser.parse("t = 0 \n als niet waar dan t = 3 anders t = 1 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),1);
    })
    it('Multiple statements between dan ... eindals', function() {
        ast = parser.parse("t = 0 \n als waar dan t = 3 \n a = 5 \n b = 17 \n eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),17);
    })
    it('Correct functionality of == > >= < <= in als dan statement', function() {
        // since node v6 eval() seems broken, these tests are shakey...
        // eval("t=0; if (0) t=3"); returns undefined instead of 0
        // so can only test for passing ifs
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
        ast = parser.parse("t = 0 \n als niet 2<2 dan t = 3 eindals");
        codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code), 3);
        ast = parser.parse("t = 0 \n als niet 2>2 dan t = 3 eindals");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code), 3);
    })
    it('Correct functionality of && || en of in als dan statement', function() {
        ast = parser.parse("t = 0 of 1");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),true);
        ast = parser.parse("t = 1 en 1");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),true);
        ast = parser.parse("t = 0 of 1 en 1");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),true);
        ast = parser.parse("t = 1 en 0");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),false);
        ast = parser.parse("t = 0 of 1 of waar");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),true);
        ast = parser.parse("t = 1 en waar");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),true);
    })
});

describe('Namespace varDict correct handling / translation / mangling of variable names', function(){

    it('case sensitivity of variables names', function() {
        ast = parser.parse("A=3\na=2\nt=A");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),3);
    })

    it('special characters (illegal in javascript) in variable names', function() {
        // this code *can* be legal javascript. Check translation/mangling
        ast = parser.parse("t[35]=26\n");
        codegenerator.namespace.varDict = {}; // clear
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(codegenerator.namespace.varDict['t[35]'],'var_t_lH_35_rH_');

        // this code is illegal in javascipt. Check if it evals.
        ast = parser.parse("t=9\nt_\{35\}\|=12\n");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),12);
    })

    it('js reserved words in variable names', function() {
        // this code is illegal in javascipt. Check if it evals.
        ast = parser.parse("function = 9\nif = 12\n");
        code = codegenerator.generateCodeFromAst(ast);
        assert.equal(eval(code),12);
    })

});
