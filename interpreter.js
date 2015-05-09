/*
    Interpreter for Modelleertaal (modelregels)
    Simple dynamical models for highschool Physics in NL

    The language is described in modelleertaal.jison

    usage:
      npm install path_to/jison
      node interpreter.js
*/


// CommonJS
var fs = require("fs");
var jison = require("jison");

// input sourcode:
var modelregels = fs.readFileSync("modelregels.txt", "utf8")
var startwaarden = fs.readFileSync("startwaarden.txt", "utf8")
// aantal iteraties
const Nmax = 1e2;



// parser compiled on execution by jison.js
var bnf = fs.readFileSync("modelleertaal.jison", "utf8");
var parser = new jison.Parser(bnf);



// for some reason the jison example uses print()
// this is a lame implemenations to allow:
// print(string) and print("var = ", variable)
function print(string1, string2) {
    if (arguments.length == 1) {
        console.log(string1)
    } else {
        console.log(string1, string2)
    }
}



function main () {
    print('*** input ***');
    print(startwaarden);
    print(modelregels);

    var startwaarden_ast = parser.parse(startwaarden);
    var modelregels_ast = parser.parse(modelregels);

    print('*** AST modelregels ***');
    print(JSON.stringify(modelregels_ast, undefined, 4));

    print('')

    startwaarden_code = js_codegen(startwaarden_ast);
    modelregels_code = js_codegen(modelregels_ast);

    print(startwaarden_code);


    model = "for (var i=0; i < "+Nmax+"; i++) { " + modelregels_code  + " }";

    print(model);

    var t1 = Date.now();

    eval(startwaarden_code);

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/
    (new Function(model))(); // eval(model);

    var t2 = Date.now();

    print("* Fmotor = ", Fmotor);

    print("* t = ", t);
    print("* s = ", s);

    console.log("Time: " + (t2 - t1) + "ms");
}


function js_codegen(ast) {

    var code = "";

    for (var i = 0; i < ast.length; i++) {
        //print("AST item = ",ast[i])
        code += parseNode(ast[i]);

    }
    return code
}

function parseNode(node) {
    /* parseNode is a recursive function that parses an item
        of the JSON AST. Calls itself to traverse through nodes.

        :param: node = (part of) JSON tree
    */

    /* javascript code generation inspired by:
        http://lisperator.net/pltut/compiler/js-codegen */

    switch(node.type) {

        case 'Assignment':  return js_assign(node);
        case 'Variable': return js_var(node);
        case 'Binary': return js_binary(node);
        case 'Unary': return js_unary(node);
        case 'Logical': return js_logical(node);
        case 'If': return js_if(node);
        case 'Number': return js_number(node);
        case 'True' : return 'true';
        case 'False' : return 'false';

    } /* switch (node.type) */

    function js_number(node) {
        return parseFloat(node.value);
    }

    function make_var(name) {
        return name;
    }

    function js_var(node) {
        return make_var(node.name);
    }

    function js_binary(node) {
        if (node.operator == '^') {
            return "(Math.pow("+parseNode(node.left)+","+parseNode(node.right)+"))"
        } else {
            return "(" + parseNode(node.left) + node.operator + parseNode(node.right) + ")";
        }
    }
    function js_logical(node) {
        return "(" + parseNode(node.left) + node.operator + parseNode(node.right) + ")"
    }

    function js_assign(node) {
        return node.left + ' = (' + parseNode(node.right) + ');\n';
    }

    function js_if(node) {
        return "if ("
        +      parseNode(node.cond) + ")"
        +      " { " + js_codegen(node.then) + " }; ";
    }

    function js_unary(node) {
        switch(node.operator) {
            case '-':   return "(-1. * " + parseNode(node.right);
            case 'NOT':  return "!("+ parseNode(node.right) + ")";
        }

    }
};












function interpreter(startwaarden_ast, modelregels_ast) {

    /* Interpret AST tree
            :param: startwaarden_ast = array of json ast. Startwaarden to be loaded into namespace
            :param: modelregels_ast = array of json asts. Modelregels to be executed many times
                    */

    Namespace = function () {
    var  Functions;

        Functions = {
            abs: Math.abs,
            acos: Math.acos,
            asin: Math.asin,
            atan: Math.atan,
            ceil: Math.ceil,
            cos: Math.cos,
            exp: Math.exp,
            floor: Math.floor,
            ln: Math.ln,
            random: Math.random,
            sin: Math.sin,
            sqrt: Math.sqrt,
            tan: Math.tan
        };

        return {
            Startwaarden: {},
            Functions: Functions,
            Variables: {}
        };
    };

    function evaluate(ast) {
    /* Evaluate (part of) AST tree
        :param: ast = array of json asts

    called by interpret() of recursive by itself
    */
        print("*** start evaluate()")
        for (var i = 0; i < ast.length; i++) {
            identation = ''; // string used for identation (debugging)

            //print("AST item = ",ast[i])
            var value = parseNode(ast[i]);
            //print("item evaluates to ", value);
        }
    };

    var namespace = new Namespace();

    // evaluate startwaarden. Move Variables into Startwaarden
    evaluate(startwaarden_ast);
    namespace.Startwaarden = namespace.Variables;
    namespace.Variables = {};

    for (i=0; i < 1e6; i++) {
        evaluate(modelregels_ast);
    }

    console.log("*** variables at end of execution = ", namespace)

};


main();
