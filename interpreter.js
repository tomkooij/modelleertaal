/*
    Interpreter for Modelleertaal (modelregels)
    Simple dynamical models for highschool Physics in NL

    The language is described in modelleertaal.jison

    usage:
      npm install path_to/jison
      node interpreter.js
*/

"use strict";

// CommonJS
var fs = require("fs");
var jison = require("jison");

// input sourcode:
var modelregels = fs.readFileSync("modelregels.txt", "utf8");
var startwaarden = fs.readFileSync("startwaarden.txt", "utf8");
// aantal iteraties
var N = 1e3; // iterations
var Nresults = 100; // store every Nresults iterations

var variablePrefix = "env_" // prefix voor variables in generated js code

// parser compiled on execution by jison.js
var bnf = fs.readFileSync("modelleertaal.jison", "utf8");
var parser = new jison.Parser(bnf);


function main () {
    console.log('*** input ***');
    console.log(startwaarden);
    console.log(modelregels);

    var startwaarden_ast = parser.parse(startwaarden);
    var modelregels_ast = parser.parse(modelregels);

    //console.log('*** AST modelregels ***');
    //console.log(JSON.stringify(modelregels_ast, undefined, 4));
    //console.log('');

    var startwaarden_code = js_codegen(startwaarden_ast);
    namespace.moveStartWaarden(); // keep namespace clean
    var modelregels_code = js_codegen(modelregels_ast);

    console.log('*** generated js ***');

    var model =  "try \n"
                +"  { \n"
                +startwaarden_code + "\n"
                +namespace.generate_var_storage_js_code()
                +"    for (var i=0; i < Nresults; i++) { \n "
                +"      for (var inner=0; inner <N/Nresults; inner++) {\n"
                +modelregels_code + "\n"
                +"      } \n"
                +namespace.generate_storage_js_code()
                +"    } \n"
                +"  } catch (e) \n"
                +"  { console.log(e)} \n "
                +"return storage;\n";

    console.log(model);

    console.log("*** running! *** ");
    console.log("N = ", N);
    console.log("Nresults = ", Nresults);
    var t1 = Date.now();

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/

    var env = {};  // object for storing variables "local" to the model
    var runModel = new Function('N','Nresults',model);
    var result = runModel(N,Nresults);

    var t2 = Date.now();

    //console.log("namespace object: ", namespace);
    console.log("result t[100]=", result.env_t[100-1]);
    console.log("result s[100]=", result.env_s[100-1]);
    console.log("Time: " + (t2 - t1) + "ms");

    writeCSV("output.csv", result)
}

function writeCSV(filename, result) {
    var stream = fs.createWriteStream(filename);
    stream.once('open', function(fd) {
        stream.write("t; s\n");
        for (var i=0; i<Nresults; i++) {
            var csvrow = result.env_t[i]+";"+result.env_s[i]+"\n";
            stream.write(csvrow.replace('.',',').replace('.',','));
        }
        stream.end();
    });
}

/*
 The namespace

 Variables are created in this.varNames = {} (a list of variable names)

 Startwaarden are copied to this.constNames and varNames are erased after
 parsing "startwaarden.txt". This is a trick to keep startwaarden seperate
*/

var namespace = new Object;
namespace.varNames = {}; // list of created variables
namespace.constNames = {}; // list of startwaarden that remain constant in execution
namespace.createVar = function(name) {
    if (this.varNames[name]) {
        console.log(name, ' already created!.')
    } else {
        console.log('creating: ',name)
        this.varNames[name] = true;
    }
}
namespace.moveStartWaarden = function () {
    this.constNames = this.varNames;
    this.varNames = {};
}
namespace.generate_var_storage_js_code = function() {
    var code = 'var storage = {} \n';
    for (var variable in this.varNames) {
        code += "storage."+variable+" = []; \n";
    }
    return code;
}
namespace.generate_storage_js_code = function() {
    var code = '';
    for (var variable in this.varNames) {
        code += "storage."+variable+"[i]= "+variable+"; \n";
    }
    return code;
}
function js_codegen(ast) {

    var code = "";

    for (var i = 0; i < ast.length; i++) {
        //console.log("AST item = ",ast[i])
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
        default:
            throw new Error("Unable to parseNode() :" + JSON.stringify(node));
    } /* switch (node.type) */

    function js_number(node) {
        return parseFloat(node.value);
    }

    function make_var(name) {
        namespace.createVar(variablePrefix+name);
        return variablePrefix+name;
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
            default:
                throw new Error("Unknown unary:" + JSON.stringify(node));
        }

    }
}


main();
