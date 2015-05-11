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


// parser compiled on execution by jison.js
var bnf = fs.readFileSync("modelleertaal.jison", "utf8");
var parser = new jison.Parser(bnf);


function main() {
    // input sourcode:
    var modelregels = fs.readFileSync("modelregels.txt", "utf8");
    var startwaarden = fs.readFileSync("startwaarden.txt", "utf8");
    // aantal iteraties
    var N = 1e3; // iterations
    var Nresults = 100; // store every Nresults iterations

    var evaluator = new ModelregelsEvaluator(startwaarden, modelregels, true);
    evaluator.run(N, Nresults);

}

function writeCSV(filename, result) {
    var stream = fs.createWriteStream(filename);
    stream.once('open', function(fd) {
        stream.write("t; h; v\n");
        for (var i=0; i<Nresults; i++) {
            var csvrow = result.var_t[i]+";"+result.var_h[i]+";"+result.var_v[i]+"\n";
            stream.write(csvrow.replace('.',',').replace('.',',').replace('.',','));
        }
        stream.end();
    });
}

/*
 Class namespace

 Variables are created in this.varNames = {} (a list of variable names)

 Startwaarden are copied to this.constNames and varNames are erased after
 parsing "startwaarden.txt". This is a trick to keep startwaarden seperate
*/

function Namespace() {

    // prefix to prevent variable name collision with reserved words
    this.varPrefix = "var_";

    this.varNames = {}; // list of created variables
    this.constNames = {}; // list of startwaarden that remain constant in execution

};


Namespace.prototype.createVar = function(name) {

    name = this.varPrefix + name;

    if (this.varNames[name]) {
        console.log(name, ' already created!.')
    } else {
        console.log('creating: ',name)
        this.varNames[name] = true;
    }
    return name;
}

Namespace.prototype.moveStartWaarden = function () {
    this.constNames = this.varNames;
    this.varNames = {};
}



/*
 Class Codegenerator
 */
function CodeGenerator(namespace) {
        this.namespace = namespace;
}

CodeGenerator.prototype.setNamespace = function(namespace) {
    this.namespace = namespace; // storage for variable names
    console.log('*** set Namespace. Result of this.namspace:', this.namespace);
};

CodeGenerator.prototype.generateVariableInitialisationCode = function() {
    var code = 'var storage = {} \n';
    for (var variable in this.namespace.varNames) {
        code += "storage."+variable+" = []; \n";
    }
    return code;
}

CodeGenerator.prototype.generateVariableStorageCode = function() {
    var code = '';
    for (var variable in this.namespace.varNames) {
        code += "storage."+variable+"[i]= "+variable+"; \n";
    }
    return code;
}

CodeGenerator.prototype.generateCodeFromAst = function(ast) {

    var code = "";
    console.log('DEBUG in generateCodeFromAst: this=', this)
    for (var i = 0; i < ast.length; i++) {
        //console.log("AST item = ",ast[i])
        code += this.parseNode(ast[i]);

    }
    return code
}

CodeGenerator.prototype.makeVar = function(name) {
    return this.namespace.createVar(name);
}

CodeGenerator.prototype.parseNode = function(node) {
    /* parseNode is a recursive function that parses an item
        of the JSON AST. Calls itself to traverse through nodes.

        :param: node = (part of) JSON tree
    */

    /* javascript code generation inspired by:
        http://lisperator.net/pltut/compiler/js-codegen */

    switch(node.type) {

        case 'Assignment':
                return this.makeVar(node.left) + ' = (' + this.parseNode(node.right) + ');\n';
        case 'Variable':
                return this.makeVar(node.name);
        case 'Binary': {
                    if (node.operator == '^') {
                        return "(Math.pow("+this.parseNode(node.left)+","+this.parseNode(node.right)+"))"
                    } else {
                        return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
                    }
                }
        case 'Unary':
                {
                    switch(node.operator) {
                        case '-':   return "(-1. * " + this.parseNode(node.right);
                        case 'NOT':  return "!("+ this.parseNode(node.right) + ")";
                        default:
                            throw new Error("Unknown unary:" + JSON.stringify(node));
                        }
                }
        case 'Logical':
                return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")"

        case 'If':
                return "if (" + this.parseNode(node.cond) + ") {" + this.generateCodeFromAst(node.then) + " }; ";
        case 'Number':
                return parseFloat(node.value);
        case 'True':
                return 'true';
        case 'False':
                return 'false';
        case 'Stop':
                return 'throw \'StopIteration\''
        default:
            throw new Error("Unable to parseNode() :" + JSON.stringify(node));
    } /* switch (node.type) */


} /* end of parseNode()  */
// end of javascriptCodeGenerator()


function ModelregelsEvaluator(startwaarden, modelregels, debug) {
    if (typeof debug === 'undefined')
        { this.debug = false; }
    else this.debug = debug;

    this.namespace = new Namespace();
    this.codegenerator = new CodeGenerator(this.namespace);
    if (this.debug) {
        console.log('*** input ***');
        console.log(startwaarden);
        console.log(modelregels);
    }

    this.startwaarden_ast = parser.parse(startwaarden);
    this.modelregels_ast = parser.parse(modelregels);

    if (this.debug) {
        console.log('*** AST modelregels ***');
        console.log(JSON.stringify(this.modelregels_ast, undefined, 4));
        console.log('');
    }

}

ModelregelsEvaluator.prototype.run = function(N, Nresults) {


    var startwaarden_code = this.codegenerator.generateCodeFromAst(this.startwaarden_ast);
    this.namespace.moveStartWaarden(); // keep namespace clean
    var modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast);

    var model =  "try \n"
                +"  { \n"
                +startwaarden_code + "\n"
                +this.codegenerator.generateVariableInitialisationCode()
                +"    for (var i=0; i < Nresults; i++) { \n "
                +"      for (var inner=0; inner <N/Nresults; inner++) {\n"
                +modelregels_code + "\n"
                +"      } \n"
                +this.codegenerator.generateVariableStorageCode()
                +"    } \n"
                +"  } catch (e) \n"
                +"  { console.log(e)} \n "
                +"return storage;\n";

    if (this.debug) {
        console.log('*** generated js ***');
        console.log(model);

        console.log("*** running! *** ");
        console.log("N = ", N);
        console.log("Nresults = ", Nresults);
    }

    var t1 = Date.now();

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/

    var env = {};  // object for storing variables "local" to the model
    var runModel = new Function('N','Nresults',model);
    var result = runModel(N,Nresults);

    var t2 = Date.now();

    if (this.debug) {
        console.log("result t[100]=", result.var_t[100-1]);
        console.log("result y[100]=", result.var_y[100-1]);
        console.log("Time: " + (t2 - t1) + "ms");
    }
}




main();
