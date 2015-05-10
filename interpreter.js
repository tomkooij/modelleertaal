/*
    Interpreter for Modelleertaal (modelregels)
    Simple dynamical models for highschool Physics in NL

    The language is described in modelleertaal.jison

    usage:
      npm install path_to/jison
      node interpreter.js
*/
//"use strict"

// CommonJS
var fs = require("fs");
var jison = require("jison");

// input sourcode:
var modelregels = fs.readFileSync("modelregels.txt", "utf8")
var startwaarden = fs.readFileSync("startwaarden.txt", "utf8")
// aantal iteraties
var Nmax = 1e6;



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

    var startwaarden_code = js_codegen(startwaarden_ast);
    var modelregels_code = js_codegen(modelregels_ast);

    print(startwaarden_code);

    var env = {};

    var model = "try {\n var storage = []; for (var i=0; i < "+Nmax+"; i++) { \n " + modelregels_code  + " storage[i]=env.s; } \n } catch (e) {console.log(e)} return storage;";

    print(model);

    var t1 = Date.now();

    var runStartWaarden = new Function('env', startwaarden_code);
    runStartWaarden(env);

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/
    var runModel = new Function('env',model);
    var result = runModel(env);

    var t2 = Date.now();

    print("* Fmotor = ", env.Fmotor);
    print("* t = ", env.t);
    print("* s = ", env.s);
    print("enviroments: ", env ); // Object.keys(env)

    print("result[100]", result[10000]);
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
        case 'Stop' : return 'throw \'StopIteration\''

    } /* switch (node.type) */

    function js_number(node) {
        return parseFloat(node.value);
    }

    function make_var(name) {
        return "env."+name;
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
        return make_var(node.left) + ' = (' + parseNode(node.right) + ');\n';
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


main();
