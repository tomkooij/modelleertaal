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
    var modelregels = fs.readFileSync("modellen/modelregels.txt", "utf8");
    var startwaarden = fs.readFileSync("modellen/startwaarden.txt", "utf8");


    var N = 1e3; // aantal iteraties
    var Nresults = 100; // store every Nresults iterations

    var evaluator = new ModelregelsEvaluator(startwaarden, modelregels, true);
    var results = evaluator.run(N, Nresults);

    // TODO: put results in class
    console.log("t[100]=", results.t[100-1]);
    console.log("y[100]=", results.y[100-1]);
    console.log(results.test_[100-1]);

    var res = new Results(evaluator.namespace);
    res.getAllandCleanUp(results);

    writeCSV("output.csv", res, 100)
}



function writeCSV(filename, result, Nresults) {
    var stream = fs.createWriteStream(filename);
    stream.once('open', function(fd) {
        stream.write("t; h; v\n");
        for (var i=0; i<Nresults; i++) {
            stream.write(result.t[i]+"; "+result.h[i]+"; "+result.v[i]+"\n");
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

    if (!this.varNames[name])
        this.varNames[name] = true;

    return name;
}

Namespace.prototype.removePrefix = function(name) {

    var regex = new RegExp("^" + this.varPrefix);
    return name.replace(regex, '');
}


Namespace.prototype.moveStartWaarden = function () {
    this.constNames = this.varNames;
    this.varNames = {};
}

/*
 Class Results
 Store and manipulate results
*/
function Results(namespace) {
    this.namespace = namespace;
};

Results.prototype.getAllandCleanUp = function(resultObject) {
    /* copy results and "clean" (round) the numbers */

    // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function humanize(x) {
      return x.toFixed(3).replace(/\.?0*$/,'').replace('.',',');
    }

    for (var varName in this.namespace.varNames) {
        varName = this.namespace.removePrefix(varName);
        // push / pop ?!!?!?
        var bb = resultObject[varName];
        var temp = [];
        for (var i = 0; i < resultObject[varName].length; i++ ) {
            temp[i] = humanize(bb[i]);
        }
        this[varName] = temp;
    }
}


/*
 Class Codegenerator
 */
function CodeGenerator(namespace) {
        this.namespace = namespace;
}

CodeGenerator.prototype.setNamespace = function(namespace) {
    this.namespace = namespace; // storage for variable names
};

CodeGenerator.prototype.generateVariableInitialisationCode = function() {
    var code = 'var storage = {} \n';
    for (var variable in this.namespace.varNames) {
        code += "storage."+this.namespace.removePrefix(variable)+" = []; \n";
    }
    return code;
}

CodeGenerator.prototype.generateVariableStorageCode = function() {
    var code = '';
    for (var variable in this.namespace.varNames) {
        code += "storage."+this.namespace.removePrefix(variable)+"[i]= "+variable+"; \n";
    }
    return code;
}

CodeGenerator.prototype.generateCodeFromAst = function(ast) {

    var code = "";
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
        case 'Function':
                switch(node.func.toLowerCase()) {
                    case 'sin': return "Math.sin("+this.parseNode(node.expr)+")";
                    case 'cos': return "Math.cos("+this.parseNode(node.expr)+")";
                    case 'tan': return "Math.tan("+this.parseNode(node.expr)+")";
                    case 'exp': return "Math.exp("+this.parseNode(node.expr)+")";
                    case 'ln':  return "Math.log("+this.parseNode(node.expr)+")";
                    case 'sqrt': return "Math.sqrt("+this.parseNode(node.expr)+")";
                    default:
                        throw new Error("Unkown function:" + JSON.stringify(node));
                    }
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
    if (typeof debug === 'undefined') {
        this.debug = false;
    } else {
        this.debug = true;
    }

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

    console.log("Time: " + (t2 - t1) + "ms");

    return result;

}



main();
