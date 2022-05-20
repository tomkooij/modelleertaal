(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.modelleertaalapp_js = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
    Interpreter for Modelleertaal (modelregels)
    Simple dynamical models for highschool Physics in NL

    The language is described in modelleertaal.jison

    usage:
      npm install path_to/jison
      node interpreter.js
*/


//jshint node:true
//jshint devel:true
//jshint evil:true
//jshint es3:true
"use strict";

// parser compiled on execution by jison.js
var modelmodule = require("./model.js");
var parser = require("./modelleertaal").parser;


// patch parser.patch to inject AST name
var ast_name = 'global';
parser._parse = parser.parse;
parser.parse = function(code, ast) {
  ast_name = ast;
  return parser._parse(code);
};

/*
 * Patch the parser to inject line numbers into AST nodes
 * https://stackoverflow.com/a/10424328/4965175
 */
// store the current performAction function
parser._performAction = parser.performAction;
// override performAction
parser.performAction = function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {
    // invoke the original performAction
    var ret = parser._performAction.call(this, yytext, yyleng, yylineno, yy, yystate, $$, _$);
    // Add linenumber to each AST node
    this.$.lineNo = yylineno + 1;
    this.$.astName = ast_name; // global set in patched parser.parse()
    return ret;
};

// Array.prototype.includes polyfill (ECMAScript 7)
// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(searchElement, fromIndex) {

      // 1. Let O be ? ToObject(this value).
      if (this === null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n ≥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(searchElement, elementK) is true, return true.
        // c. Increase k by 1.
        // NOTE: === provides the correct "SameValueZero" comparison needed here.
        if (o[k] === searchElement) {
          return true;
        }
        k++;
      }

      // 8. Return false
      return false;
    }
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

    this.varNames = []; // list of created variables
    this.constNames = []; // list of startwaarden that remain constant in execution
    // dictionary that converts Modelleertaal identifiers (with illegal
    //  chars [] {} in name) to javascipt identifiers
    this.varDict = {};
}

if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (obj, fromIndex) {
    if (fromIndex === null) {
        fromIndex = 0;
    } else if (fromIndex < 0) {
        fromIndex = Math.max(0, this.length + fromIndex);
    }
    for (var i = fromIndex, j = this.length; i < j; i++) {
        if (this[i] === obj)
            return i;
    }
    return -1;
  };
}

// remove javascript illegal or special char from variable names
Namespace.prototype.mangleName= function(string) {
    return this.varPrefix + string.replace('\{','_lA_').replace('\}','_rA_').replace('\[','_lH_').replace('\]','_rH_').replace('\|','_I_');
};

// create (or reference) variable that is on the left side of an assignment
Namespace.prototype.createVar = function(name) {
    if (this.varNames.indexOf(name) == -1)  {
        this.varNames.push(name);
    }
    this.varDict[name] = this.mangleName(name);
    return this.varDict[name];
};

// reference a variable that is on the right side of an assignment
// It should already exist if on the right side
Namespace.prototype.referenceVar = function(node) {

    var name = node.name;

    // it should exist (but perhaps in "startwaarden" (constNames))
    if ((this.varNames.indexOf(name) == -1) && (this.constNames.indexOf(name) == -1)) {
        var err = new EvalError('Variabele niet gedefineerd: '+ name + ' Line: '+node.lineNo+" ("+node.astName+")" );
        throw_custom_error(err, node.astName, node.lineNo);
    }
    return this.varDict[name];
};

Namespace.prototype.listAllVars = function() {
    // should really throw exception?
    console.log("WARNING: called obsolete function namespace.listAllVars()");
    return this.varNames;
};

Namespace.prototype.removePrefix = function(name) {

    var regex = new RegExp("^" + this.varPrefix);
    return name.replace(regex, '');
};


Namespace.prototype.moveStartWaarden = function () {
    this.constNames = this.varNames;
    this.varNames = [];
};

Array.prototype.swap = function(a, b) {
    this[a] = this.splice(b, 1, this[a])[0];
    return this;
};

Namespace.prototype.sortVarNames = function () {
    /* sort varNames. "Stock" variables (t, x, s) come first.
       enables automatic graphs of important variables */

    // now sorts on variable NAME. Should identify stock variables in AST.

    // names of "special"variable names to sort, sort if found in order given
    var nameList;
    if (this.varNames.includes('y') & this.varNames.includes('x')) {
      // try to plot y,x diagram
      nameList = ['x', 'y', 't', 's', 'h', 'u', 'v', 'vx', 'vy'];
    } else if (this.varNames.includes('h') & this.varNames.includes('x')) {
      // try to plot h,x diagram
      nameList = ['x', 'h', 't', 's', 'y', 'v', 'vx', 'vy'];
    } else if (this.varNames.includes('N') & this.varNames.includes('t')) {
        // try to plot N,t diagram (For SIR-virusmodels: plot I,t)
        nameList = ['t', 'I', 'N', 'x', 's', 'y', 'v', 'vx', 'vy'];
    } else {
      // try to plot s,t or x,t diagram
      nameList = ['t', 's', 'x', 'y', 'h', 'u', 'v', 'vx', 'vy', 'θ', 'ϑ'];
    }
    var nextVariableIndex = 0 ; // place to swap next "special"variable with

    /*  nextVariableIndex = 0
        for variable in nameList:
            if variable in this.varNames:
                swap variable with variable at nextVariableIndex
                nextVariableIndex += 1
    */
    for (var i = 0; i < nameList.length; i++) {
        var varNames_position = this.varNames.indexOf(nameList[i]);
        if (varNames_position != -1) {
            // swap and *afterwards* increase nextVariableIndex
            this.varNames.swap(varNames_position, nextVariableIndex++); }
    }
};


/*
 Class Codegenerator
 */
function CodeGenerator(namespace) {
    if (typeof namespace === 'undefined') {
        this.namespace = new Namespace();
    } else {
        this.namespace = namespace;
    }
}

CodeGenerator.prototype.setNamespace = function(namespace) {
    this.namespace = namespace; // storage for variable names
};

CodeGenerator.prototype.generateVariableStorageCode = function() {
    var code = 'storage[i] = [];\n';
    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += "storage[i].push("+variable+");\n";
    }
    return code;
};

CodeGenerator.prototype.generateVariableInitCode = function() {
    var code = '//initialize all variables to NaN\n';
    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += variable+"=NaN;\n";
    }
    return code;
};

CodeGenerator.prototype.generateVariableInitCode_second_run = function() {
    var code = '//initialize all variables to previous values\n';
    code += 'var last_row = storage[storage.length - 1];';

    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += variable+"=last_row["+i+"];\n";
    }
    return code;
};


CodeGenerator.prototype.generateCodeFromAst = function(ast, break_at_line) {

    var code = "";
    for (var i = 0; i < ast.length; i++) {
        //console.log("AST item = ",ast[i])
        code += this.parseNode(ast[i]);
        if (i == break_at_line) code += '/*breakpoint*/ bailout=true;\nbreak;\n';
    }
    return code;
};


CodeGenerator.prototype.parseNode = function(node) {
    /* parseNode is a recursive function that parses an item
        of the JSON AST. Calls itself to traverse through nodes.

        :param: node = (part of) JSON tree
    */

    /* javascript code generation inspired by:
        http://lisperator.net/pltut/compiler/js-codegen */

    switch(node.type) {

        case 'Assignment':
                /* evaluate the right side first, to make sure 'x=x+dx' with
                x undefined fails in code generation. */
                var node_right = this.parseNode(node.right);
                return  this.namespace.createVar(node.left)+ ' = (' +
                              node_right + ');\n';
        case 'Variable':
                return this.namespace.referenceVar(node);
        case 'Binary': {
                    if (node.operator == '^')
                        return "(Math.pow("+this.parseNode(node.left)+","+this.parseNode(node.right)+"))";
                    else
                        return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
                    break;
                    }
        case 'Unary':
                    switch(node.operator) {
                        case '+':   return "(" + this.parseNode(node.right) + ")";
                        case '-':   return "-1. * " + this.parseNode(node.right);
                        case 'NOT':  return "!("+ this.parseNode(node.right) + ")";
                        default: {
                            var err = new SyntaxError("Unknown unary:" + JSON.stringify(node));
                            throw_custom_error(err, node.astName, node.lineNo);}
                    }
        /* falls through */
        case 'Logical':
                return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
        case 'If':
                return "if (" + this.parseNode(node.cond) + ") {\n" + this.generateCodeFromAst(node.then) + " }\n; ";
        case 'IfElse':
                return "if (" + this.parseNode(node.cond) + ") {\n" + this.generateCodeFromAst(node.then) + " \n} else {\n" +
                this.generateCodeFromAst(node.elsestmt) + " }\n; ";
        case 'Function': {
                switch(node.func.toLowerCase()) {
                    case 'sin': return "Math.sin(("+this.parseNode(node.expr)+")/180.*Math.PI)";
                    case 'cos': return "Math.cos(("+this.parseNode(node.expr)+")/180.*Math.PI)";
                    case 'tan': return "Math.tan(("+this.parseNode(node.expr)+")/180.*Math.PI)";
                    case 'sinr': return "Math.sin("+this.parseNode(node.expr)+")";
                    case 'cosr': return "Math.cos("+this.parseNode(node.expr)+")";
                    case 'tanr': return "Math.tan("+this.parseNode(node.expr)+")";
                    case 'arcsin': return "Math.asin("+this.parseNode(node.expr)+")*180./Math.PI";
                    case 'arccos': return "Math.acos("+this.parseNode(node.expr)+")*180./Math.PI";
                    case 'arctan': return "Math.atan("+this.parseNode(node.expr)+")*180./Math.PI";
                    case 'arcsinr': return "Math.asin("+this.parseNode(node.expr)+")";
                    case 'arccosr': return "Math.acos("+this.parseNode(node.expr)+")";
                    case 'arctanr': return "Math.atan("+this.parseNode(node.expr)+")";
                    case 'exp': return "Math.exp("+this.parseNode(node.expr)+")";
                    case 'ln':  return "Math.log("+this.parseNode(node.expr)+")";
                    case 'log':  return "Math.log10("+this.parseNode(node.expr)+")";
                    case 'sqrt': return "Math.sqrt("+this.parseNode(node.expr)+")";
                    case 'sign': return "Math.sign("+this.parseNode(node.expr)+")";
                    case 'teken': return "Math.sign("+this.parseNode(node.expr)+")";
                    case 'abs': return "Math.abs("+this.parseNode(node.expr)+")";
                    case 'min': return "Math.min("+this.parseNode(node.expr)+")";
                    case 'max': return "Math.max("+this.parseNode(node.expr)+")";

                    default:
                        var err1 = new SyntaxError("Unknown function:" + JSON.stringify(node.func) + " Line: "+node.lineNo+" ("+node.astName+")");
                        throw_custom_error(err1, node.astName, node.lineNo);
                    }
                break;
                }
        case 'Number':
                return parseFloat(node.value.replace(',','.'));
        case 'List':
                return this.parseNode(node.left) + "," + this.parseNode(node.right);
        case 'Boolean':
                return node.value;
        case 'Stop':
                return 'bailout=true;\nbreak;';
        case 'Print':
                // print(x) wil stop execution and print "alert()" the value of variable x
                var internal_var_name = this.namespace.varDict[node.varname];
                return 'alert("Gestopt: '+node.varname+' = "+'+internal_var_name+'.toPrecision(4));\nbailout=true;\nbreak;';
        case 'Blank': {
                var err_blank = new SyntaxError("Vul iets in in plaats van de puntjes ...");
                throw_custom_error(err_blank, node.astName, node.lineNo);
                break;
                }
        default:
            var err2 = new SyntaxError("Unable to parseNode() :" + JSON.stringify(node));
            throw_custom_error(err2, node.astName, node.lineNo);
    } /* switch (node.type) */


}; /* end of parseNode()  */
// end of javascriptCodeGenerator()


function ModelregelsEvaluator(model, debug) {
    if (typeof debug === 'undefined') {
        this.debug = false;
    } else {
        this.debug = debug;
    }

    this.debug_ast = false; // hack FIXME

    // state of evaluator (set and read by modelleertaal app)
    this.tracing = false;
    this.new_run = false;
    this.breakpoint_at_line = undefined; // only used when tracing

    this.namespace = new Namespace();
    this.codegenerator = new CodeGenerator(this.namespace);

    if (typeof model === 'undefined') {
        this.model = new modelmodule.Model();
    } else {
        this.model = model;
    }

    if (this.debug) {
        console.log('*** input ***');
        console.log(this.model.startwaarden);
        console.log(this.model.modelregels);
    }

    try {
      this.startwaarden_ast = parser.parse(this.model.startwaarden, 'startwaarden');
    } catch(err) {
      throw_custom_error(err, 'startwaarden', err.hash.line+1);
    }
    try {
      this.modelregels_ast = parser.parse(this.model.modelregels, 'modelregels');
    } catch(err) {
      throw_custom_error(err, 'modelregels', err.hash.line+1);
    }

    if (this.debug_ast) {
        console.log('*** AST startwaarden ***');
        console.log(JSON.stringify(this.startwaarden_ast, undefined, 4));
        console.log('*** AST modelregels ***');
        console.log(JSON.stringify(this.modelregels_ast, undefined, 4));
        console.log('');
    }

}

ModelregelsEvaluator.prototype.set_state = function(N, new_run, tracing) {
    // state of evaluator (set by modelleertaal app)

    // FIXME: replace by: enable_trace() or similar.
    this.N = N;
    this.tracing = tracing;
    this.new_run = new_run;

    if (this.tracing) {
      this.N = 1;
      if (this.breakpoint_at_line === undefined) {
        this.breakpoint_at_line = 0; // start trach
      }
    } else {
      this.breakpoint_at_line = undefined;
    }
};

ModelregelsEvaluator.prototype.get_state = function() {
    // state of evaluator (set by modelleertaal app)
    return {'tracing': this.tracing,
            'breakpoint_at_line': this.breakpoint_at_line,
            'lineno': this.breakpoint_ast_lineno
          };
};

ModelregelsEvaluator.prototype.run = function() {

    if (!this.tracing) this.breakpoint_at_line = undefined;

    var start = 0;
    var end = 0;

    if (this.new_run) {
      // first run of model!
      start = 1;
      end = this.N + 1;

      this.result = [];
      this.startwaarden_code = this.codegenerator.generateCodeFromAst(this.startwaarden_ast);
      this.namespace.moveStartWaarden(); // keep namespace clean

      this.modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast);
      this.namespace.sortVarNames(); // sort variable names for better output

      if (this.debug) {
          console.log("evaluator.run *** first run ***");
      }

    } else {
      // check this.result properties FIXME
      console.log("evaluator.run *** second run ***");

      if (this.tracing) {
          console.log("tracing...", this.breakpoint_at_line);
          if ((this.breakpoint_at_line > 0) & (this.result.length > 1)) {
              // continue to trace a row: remove partial results.
              // do not remove first line (startwaarden)
              this.result.pop();
          }
      this.modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast, this.breakpoint_at_line);
      }

      start = this.result.length;
      end = start + this.N;
    }

    // separate function run_model() inside anonymous Function()
    // to prevent bailout of the V8 optimising compiler in try {} catch
    this.model = "function run_model(storage) { \n ";

    if (this.new_run) {
        this.model += ""+
                 this.codegenerator.generateVariableInitCode() +
                 this.startwaarden_code + "\n" +
                  "var i=0;\n" +
                  this.codegenerator.generateVariableStorageCode();
    } else {
        this.model += ""+
                  this.codegenerator.generateVariableInitCode_second_run();
    }

    this.model +=
                  "    var bailout = false;\n"+
                  "    for (i="+start+"; i < "+end+"; i++) { \n " +
                  this.modelregels_code + "\n" +
                  this.codegenerator.generateVariableStorageCode() +
                  "      }\n" +
                  " if (bailout) {" +
                  this.codegenerator.generateVariableStorageCode() +
                  " }\n" +
                  " return;} \n" +
                  "    try \n" +
                  "  { \n" +
                  "      run_model(results); \n" +
                  "  } catch (e) \n" +
                  "  { console.log(e)} \n " +
                  "return results;\n";

    if (this.debug) {
        console.log('*** generated js ***');
        console.log(this.model);
        console.log("*** running! *** ");
        console.log("N = ", this.N);
    }

    var t1 = Date.now();

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/


    var runModel = new Function('results', this.model);
    this.result = runModel(this.result);

    var t2 = Date.now();

    console.log("Number of iterations: ", this.result.length);
    console.log("Time: " + (t2 - t1) + "ms");

    // just fail if full row already executed.
    if (this.tracing)
      {
        this.breakpoint_ast_lineno = this.modelregels_ast[this.breakpoint_at_line].lineNo;
        this.breakpoint_at_line += 1;

        if (this.breakpoint_at_line > this.modelregels_ast.length - 1)  {
          console.log('end of row. Trace finished!');
          this.tracing = false;
          this.breakpoint_at_line = undefined;
      }
    }
};

function throw_custom_error(err, ast_name, line_number) {
    // insert line number etc in Error:
    err.parser_name = ast_name;
    err.parser_line = line_number;
    throw err;
}

exports.Model = modelmodule.Model; // from model.js
exports.ModelregelsEvaluator = ModelregelsEvaluator;
exports.CodeGenerator = CodeGenerator;
exports.Namespace = Namespace;

},{"./model.js":2,"./modelleertaal":4}],2:[function(require,module,exports){
/*
 model.js

 Model Class

 read a from model.xml
 store model in string etc


 model.xml example:

 <modelleertaal>
 <startwaarden>
     Fmotor = 500 'N
     m = 800 'kg
     dt = 1e-2 's
     v = 0'm/s
     s = 0 'm/s
     t = 0 's
 </startwaarden>
 <modelregels>
     Fres= Fmotor
     a = Fres/m
     dv = a * dt
     v = v + dv
     ds = v * dt
     s = s + ds
     t = t + dt
     als (0)
     dan
       Stop
     EindAls
 </modelregels>

 </modelleertaal>
*/


//jshint es3:true

var fs = require('fs');

function Model() {
    this.modelregels = '';
    this.startwaarden = '';
}


Model.prototype.readBogusXMLFile = function(filename) {
    // This read a "bogus" XML file that still includes < instead of &lt;
    var buf = fs.readFileSync(filename, "utf8");

    this.parseBogusXMLString(buf);
};

Model.prototype.parseBogusXMLString = function(xmlString) {

    var action = 0; // 0 = do nothing, 1 = modelregels, 2 = startwaarden
    var equationRe = /([A-Za-z])[ ]*\=[ ]*(\d*)/g;  // Match N = 1000

    this.startwaarden = '';
    this.modelregels = '';

    var lines = xmlString.split('\n');

    for(var line = 1; line < lines.length; line++) {

        //console.log(action, lines[line]);
        // try to extra N = ... from model
        if (action === 0) {
          var matches = equationRe.exec(lines[line]);
          if (matches !== null) {
            if (matches[1] == 'N')
              this.N = parseInt(matches[2], 10);
              if (this.debug) console.log('Found N = '+this.N+' in model.xml');
          }
        }
        switch(lines[line].replace('\r','')) {
            // < and > mess things up in the browser
            case '<modelregels>': { action = 1; continue; }
            case '</modelregels>': { action = 0; continue; }
            case '<startwaarden>': { action = 2; continue; }
            case '</startwaarden>': { action = 0; continue; }
        }
        if (action==1) this.modelregels += lines[line]+'\n';
        if (action==2) this.startwaarden += lines[line]+'\n';
    }
    //console.log('DEBUG: in model.js parseBogusXMLString endresult this.modelregels:');
    //console.log(this.modelregels);
    //console.log('DEBUG: in model.js parseBogusXMLString endresult this.startwaarden:');
    //console.log(this.startwaarden);

};

Model.prototype.createBogusXMLString = function() {

    // TODO replace this with a function that exports all options.
    var Nstring = '';
    if (this.N !== undefined)
            Nstring = 'N = ' + this.N + '\n';
    return '<modelleertaal>\n' +
            Nstring +
            '<startwaarden>\n' +
            this.startwaarden +
            '\n</startwaarden>\n<modelregels>\n' +
            this.modelregels +
            '\n</modelregels>\n</modelleertaal>\n';
};



exports.Model = Model;

},{"fs":6}],3:[function(require,module,exports){
var evaluator_js = require('./evaluator.js');
var Blob = require('blob');
var FileSaver = require('file-saver');
// this also depends on:
// jQuery
// jQuery.Flot
// These libs are not included, because the Flot libray does not play well
// with browserify.
// Include this in the HTML with:
//<script src="scripts/jquery-3.2.1.min.js"></script>
//<script src="scripts/jquery.flot.js"></script>

//jshint devel:true
//jshint es5:true
//jshint loopfunc: true

/* version history: CHANGELOG.md */
var version = "v5.4.2 20mei2022";

function ModelleertaalApp(params) {

  this.debug = params.debug || false;
  this.version = version;
  console.log('Modelleertaal App. ' + version + '. Debug = ' + this.debug);

  this.model_index = params.model_index || false;
  console.log('Model_index: ', this.model_index);

  this.base_url = params.base_url || '';
  this.rel_url = params.rel_url || 'index.html';

  if (this.debug) {
    console.log('base_url: ', base_url);
    console.log('rel_url:' , rel_url);
  }

  this.CodeMirror = params.CodeMirror || true;
  this.CodeMirrorActive = false;

  this.yaxis_autoscale = false;  // try to include origin (y=0) by default

  this.dom_modelregels = "#modelregels";
  this.dom_startwaarden = "#startwaarden";
  this.dom_status = "#status_bar";
  this.dom_datatable = "#datatable";
  this.dom_graph = "#graph";
  this.dom_nbox = "#NBox";
  this.dom_nbox_continue = "#NBoxContinue";
  this.dom_run = "#run";
  this.dom_continue = "#continue";
  this.dom_trace = "#trace";
  this.dom_plot = "#plot";
  this.dom_fileinput = "#fileinput";
  this.dom_download_xml = "#download_xml";
  this.dom_download_xml_fn = "#xml_filename";
  this.dom_download_pgf = "#download_pgf";
  this.dom_download_pgf_fn = "#pgf_filename";
  this.dom_download_tsv = "#download_tsv";
  this.dom_download_tsv_fn = "#tsv_filename";
  this.dom_download_svg = "#download_svg";
  this.dom_download_svg_fn = "#svg_filename";
  this.dom_clickdata = "#clickdata";
  this.dom_x_var = "#x_var";
  this.dom_y_var = "#y_var";
  this.dom_select_graph = "#select_graph";
  this.dom_model_keuze = "#model_keuze";
  this.dom_permalink = "#permaklink";
  this.dom_legend = "#legend";

  this.read_model();

  if ((this.CodeMirror) && (typeof(CodeMirror) == 'function')) {
    if (this.debug)
      console.log("CodeMirror enabled.");
    var codemirror_options = {
      lineNumbers: true,
      mode: "modelleertaal" };
    this.modelregels_editor = CodeMirror.fromTextArea($(this.dom_modelregels)[0], codemirror_options);
    this.startwaarden_editor = CodeMirror.fromTextArea($(this.dom_startwaarden)[0], codemirror_options);
    this.CodeMirrorActive = true;
  } else {
    this.CodeMirror = false;
    this.CodeMirrorActive = false;
    if (this.debug)
      console.log("CodeMirror disabled.");
  }

  // (re)set the app
  this.init_app();
  this.load_model();

  this.max_rows_in_plot = 200;
  this.precision = 4;

  var self = this;

  $(this.dom_run).click(function() {
    // read N from input field
    self.N = Number($(self.dom_nbox).val());
    // count model run as pageview to #run in goatcounter
    if (window.goatcounter !== undefined) {
      window.goatcounter.count({
        path: location.pathname + '#run',
      });
    }
    self.run();
  });

  $(this.dom_continue).click(function() {
    self.N = Number($(self.dom_nbox_continue).val());
    self.continue_run();
  });

  $(this.dom_trace).click(function() {
    self.trace();
  });

  $(this.dom_plot).click(function() {
    if (self.results.length === 0) {
        console.log('Plot clicked. No results --> Run first');
        self.N = Number($(self.dom_nbox).val());
        self.run();
    }
    self.do_plot();

    //self.print_status("Plot OK.");
  });

  $(this.dom_model_keuze).change(function () {
    self.dropdown_load_model();
  });

  $(this.dom_download_xml).click(function() {
    self.download_model();
  });
  $(this.dom_download_pgf).click(function() {
    self.download_pgfplot();
  });
  $(this.dom_download_tsv).click(function() {
    self.download_tsv();
  });
  $(this.dom_download_svg).click(function() {
    self.download_svg();
  });

  $(this.dom_fileinput).change(function(event) {
    self.read_file(event);
  });

  this.multiplot = false;
  $("#multiplot").click(function() {
      self.multiplot = !self.multiplot;
      self.set_graph_menu();
  });

}

ModelleertaalApp.prototype.load_model = function() {
    // called from $(document).ready();

    // listen to URL index.html#model=model_naam&N=100 type URL
    // https://stackoverflow.com/a/44169739/4965175
    var hash = window.location.hash.substr(1);
    var url_params = hash.split('&').reduce(function(result, item) {
        var parts = item.split('=');
        result[parts[0]] = parts[1];
        return result;
    }, {});
    console.log("params passed in URL", url_params);

    var N_preset = url_params.N || N_default || false;
    if (N_preset) {
        $("#NBox").val(N_preset);
    }

    this.dropdown_update();
    var model_preselected = url_params.model || false;
    if (model_preselected) {
        // try to load model passed with model=... parameter
        var model_url = 'modellen/' + model_preselected + '.xml';
        this.load_model_xml_from_url(model_url);
        var reverse_dropdown_val = model_index.findIndex(function(element) {
            return element.url == model_url;
        });
        // set dropdown to selected model
        $(this.dom_model_keuze).val(reverse_dropdown_val);
    } else {
        // lees keuze uit drop-down en kies juiste url
        this.dropdown_load_model();
    }
};




ModelleertaalApp.prototype.print_status = function(status, error) {
  $(this.dom_status).html(status);
  if (typeof error != "undefined") $(this.dom_graph).html(error).css("font-family", "monospace");
};


ModelleertaalApp.prototype.load_model_xml_from_url = function(url) {
    var self = this;
    $.ajax({
        url: url,
        dataType: "text",
        success: function(data) {
            self.read_model_from_xml(data);
            self.init_app();
        }, // succes();
        error: function(xhr, ajaxOptions, thrownError) {
            if (xhr.status === 0) {
                alert("Kan model " + url + " niet laden.\nBestaat het model?\nOffline? Zet CORS protection uit");
            } else {
                alert(thrownError);
            }
            $(self.dom_graph).html("Model niet geladen! FOUT.");
            self.print_status("Status: ERROR.");
        } // error();
    }); //.ajax
};


ModelleertaalApp.prototype.dropdown_update = function() {
    // maak het drop-down modelkeuze menu uit model.js
    $(this.dom_model_keuze).empty();
    for (var i = 0; i < this.model_index.length; i++) {
        $('<option/>').val(i).text(this.model_index[i].title).appendTo(this.dom_model_keuze);
    }
};


ModelleertaalApp.prototype.dropdown_load_model = function() {

    //var model_keuze = $("#model_keuze").val();
    var model_keuze = $(this.dom_model_keuze).val();

    url = this.model_index[model_keuze].url;
    var myRe = /\/([^.]+)/g;

    var rel_link = this.rel_url + 'index.html#model=' + myRe.exec(url)[1];
    var permalink = this.base_url + rel_link;

    // verander de URL onder de knop "link"
    $(this.dom_permalink).attr('href', permalink);

    // verander de URL in de browser (history)
    if (history.replaceState) {
        window.history.replaceState("", "Modelleertaal webapp", rel_link);
    } else {
        document.location.href = rel_link;
    }

    // count model reload as pageview in goatcounter
    if (window.goatcouter !== undefined) {
      window.goatcounter.count({
        path: location.pathname,
      });
    }
    this.load_model_xml_from_url(url);
};




ModelleertaalApp.prototype.read_model = function() {
  // read model from textarea/CodeMirror
  this.model = new evaluator_js.Model();
  if (this.CodeMirrorActive) {
    this.model.modelregels = this.modelregels_editor.getValue();
    this.model.startwaarden = this.startwaarden_editor.getValue();
  } else {
    this.model.modelregels = $(this.dom_modelregels).val();
    this.model.startwaarden = $(this.dom_startwaarden).val();
  }
};


ModelleertaalApp.prototype.read_file = function(evt) {
  var self = this;
  var f = evt.target.files[0];
  console.log('read_file: ' + f);

  if (f) {
    var r = new FileReader();
    r.onload = function(e) {
      console.log(e.target.result);
      self.read_model_from_xml(e.target.result);
      self.init_app();
    };
    r.readAsText(f);
  }
};


ModelleertaalApp.prototype.download_model = function() {
  // download model in "BogusXML" format
  //  just a text file with XML like tags...

  var filename = $(this.dom_download_xml_fn).val();
  this.read_model();

  // copy N from app, if exist, write into Model
  if (this.N !== undefined) {
    this.model.N = this.N;
  }

  this.save_string(this.model.createBogusXMLString(), filename);
};


ModelleertaalApp.prototype.download_pgfplot = function() {
  // save the plot in TikZ/PGFPlot format

  if (this.do_plot() === false) return;

  var filename = $(this.dom_download_pgf_fn).val();
  this.save_string(this.create_pgfplot(), filename);
};


ModelleertaalApp.prototype.download_tsv = function() {
  // download the results in TSV format.

  var filename = $(this.dom_download_tsv_fn).val();
  this.save_string(this.create_tsv(), filename);
};


ModelleertaalApp.prototype.download_svg = function() {
  // download SVG Plot.

  var filename = $(this.dom_download_svg_fn).val();
  this.save_string(this.create_svgplot(), filename);
};


ModelleertaalApp.prototype.save_string = function(data, filename) {
  // requires FileSaver.js and Blob.js
  // (Blob() not supported on most mobile browsers)

  // mime text/plain expects CRLF \r\n instead of \n
  // this should work on both Windows and Mac/Linux
  var blob = new Blob([data.replace(/([^\r])\n/g, "$1\r\n")], {
    type: "text/plain;charset=utf-8"
  });
  FileSaver.saveAs(blob, filename);
};

ModelleertaalApp.prototype.run = function() {

  if (this.setup_run()) {
    this.new_run = true;
    if (!this.do_run()) this.has_run = false;
    this.after_run();
    this.has_run = true;
    return true;
  } else {
    return false;
  }
};

ModelleertaalApp.prototype.continue_run = function() {
  if (this.has_run) {
    this.new_run = false;
    this.tracing = false;
  } else {
    this.new_run = true;
    this.setup_run();
  }
  if (!this.do_run()) this.has_run = false;
  this.after_run();
  this.has_run = true;
  return true;
};

ModelleertaalApp.prototype.trace = function() {

  if (this.has_run) {
    this.new_run = false;
  } else {
    this.new_run = true;
    this.setup_run();
  }

  this.tracing = true;
  this.do_run();

  this.after_run();
  this.has_run = true;
  return true;
};

ModelleertaalApp.prototype.setup_run = function() {

  // reset the breakpoint pointer:
  this.tracing = false;
  this.remove_highlight_trace();

  this.read_model();

  if (this.debug)
    console.log('model = ', this.model);

  if (this.N > 1e6) {
    alert('N te groot!');
    throw new Error('N te groot!');
  }

  this.print_status("Run started...");
  console.log("Run started...");

  try {
    this.evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
  } catch (err) {
    this.print_status("Model niet in orde.", err.message.replace(/\n/g, "<br>"));
    alert("Model niet in orde: \n" + err.message);
    this.highlight_error(err.parser_line, err.parser_name);
		return false;
  }
  return true;
};

ModelleertaalApp.prototype.do_run = function() {

  var run_result;

	try {
    this.evaluator.set_state(this.N, this.new_run, this.tracing);
	  this.evaluator.run();
    run_result = this.evaluator.get_state();
    this.results = this.evaluator.result;
  } catch (err) {
		if (err instanceof EvalError) {
			alert("Model niet in orde:\nVariable niet gedefineerd in startwaarden?\n" + err.message);
		} else {
			alert("Model niet in orde:\n" + err.message);
		}
    this.print_status("Fout in model.", err.message.replace(/\n/g, "<br>"));
    this.highlight_error(err.parser_line, err.parser_name);
    return false;
	}

  var N_iterations = this.results.length-1;
  if (!run_result.tracing) {
    this.print_status("Klaar na "+N_iterations+" iteraties.");
       this.tracing = false;
    this.remove_highlight_trace();
  } else {
    this.print_status("Debugger in iteratie "+ N_iterations);
    this.highlight_trace(run_result.lineno+1);
  }

  // make table, plot
  this.allVars = this.evaluator.namespace.varNames;
  if (this.debug)
    console.log(this.allVars);
};

ModelleertaalApp.prototype.after_run = function() {

  if (this.allVars !== undefined) {
    // create the axis drop-down menu, try to keep value
    this.save_axis();
    this.reset_axis_dropdown();
    this.set_axis();

    this.print_table();
    this.do_plot();
  }
};


ModelleertaalApp.prototype.save_axis = function() {
  // save chosen variable, try to plot same graph
  this.xvar_last = $(this.dom_x_var).find(":selected").text();
  this.yvar_last = $(this.dom_y_var).find(":selected").text();
};


ModelleertaalApp.prototype.reset_axis_dropdown = function() {

  if (!this.results_available()) {
    return;
  }

  // (re)set varNames in drop-down select fields
  $(this.dom_x_var).empty();
  $(this.dom_y_var).empty();
  $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
  $('<option/>').val('').text('auto').appendTo(this.dom_y_var);

  for (var i = 0; i < this.allVars.length; i++) {
    $('<option/>').val(i).text(this.allVars[i]).appendTo(this.dom_x_var);
    $('<option/>').val(i).text(this.allVars[i]).appendTo(this.dom_y_var);
  }
  var self = this;
  $(this.dom_x_var).change(function(){
    // the plotted variables change. Erase previous results.
    self.previous_plot = [];
  });
  $(this.dom_y_var).change(function(){
    // the plotted variables change. Erase previous results.
    self.previous_plot = [];
  });
};

ModelleertaalApp.prototype.set_axis = function() {
  // try to plot same graph: Reset axis to previous settings.
  var self = this;
  idx = this.allVars.findIndex(function(s) {
    return s == self.xvar_last;
  });
  if (idx != -1) $(this.dom_x_var).val(idx);
  idx = this.allVars.findIndex(function(s) {
    return s == self.yvar_last;
  });
  if (idx != -1) $(this.dom_y_var).val(idx);
};


//
// Table
//
ModelleertaalApp.prototype.table_header = function() {
  var firstrow = $('<tr>');
  firstrow.append($('<th>').text('#'));

  for (var k = 0; k < this.allVars.length; k++) {
    firstrow.append($('<th>').text(this.allVars[k]));
  }
  return firstrow;
};


ModelleertaalApp.prototype.table_row = function(rowIndex) {

    function fix(x) {
      if (isNaN(x)) return "X";
      if (Math.abs(x) < 0.0001) return 0;
      return x;
    }

    var row = $('<tr>');
    row.append($('<td>').text(rowIndex));

    var res;
    for (var j = 0; j < this.results[rowIndex].length; j++) {
      res = this.results[rowIndex][j];
      if (typeof(res) === 'number') {
          res = fix(res.toPrecision(this.precision));
      } else {  // -- boolean
          if (res) {
            res = 'Waar';
          } else {
            res = 'Onwaar';
          }
      }
      row.append($('<td>').text(res));
    }
    return row;
};

ModelleertaalApp.prototype.print_table = function(limit) {
  // truncated row from: jquery.jsparc.js
  // http://github.com/HiSPARC/jSPARC

  var self = this;

  limit = (limit) ? limit : 10;
  limit = Math.min(this.results.length, limit);

  var table = $('<table>').addClass('table');
  table.append(this.table_header());

  for (var i = 0; i < this.results.length; i++) {
    table.append(this.table_row(i));

    if (limit != this.results.length && i == Math.floor(limit / 2) - 1) {
      var truncrow = $('<tr>');
      truncrow.append($('<td>')
        .text('... Tabel ingekort. Klik voor meer rijen ...')
        .attr('colspan', this.results.length + 1)
        .css({
          'text-align': 'left',
          'cursor': 'pointer'
        })
        .click(function() {
          self.print_table(limit * 5);
        }));
      table.append(truncrow);
      i = this.results.length - 1 - Math.ceil(limit / 2);
    }
  }

  $(self.dom_datatable).html(table);
};

//
// Plotten
//
ModelleertaalApp.prototype.do_plot = function() {

  if (!this.results_available()) {
    //alert('Geen resultaten. Druk eerst op Run!');
    console.error('No results! cannot plot');
    return false;
  }

  if (this.multiplot) {
    this.do_multi_plot();
    return;
  }

  // if set to "auto" set axis to default settings (x,t)
  this.set_axis_to_defaults();
  // show "meerdere grafieken button"
  this.toggle_plot_mode();

  var results = this.reduce_rows(this.results, this.max_rows_in_plot);

  var current_plot = {
      data: [],
      color: 'blue',
      label: this.allVars[yvar_colidx]
    };
  var previous_plot = {
      data: this.previous_plot,
      color: '#d3d3d3', // light-gray
      label: ''
  };

  for (var i = 0; i < results.length; i++) {
    current_plot.data.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
  }
  // FIXME: left over from (very!) old code...
  this.scatter_plot = current_plot.data;

  var dataset = [];
  dataset.push(previous_plot);
  dataset.push(current_plot);

  $(this.dom_graph).empty(); // verwijder text enzo
  $(this.dom_clickdata).empty();
  this.plot_graph(dataset);
  this.previous_plot = this.scatter_plot;
}; // do_plot


ModelleertaalApp.prototype.results_available = function() {
  if (this.results.length === 0) {
    return false;
  }
  return true;
}; // results_available


ModelleertaalApp.prototype.toggle_plot_mode = function() {

  if (!this.results_available()) {
    $("#multiplot").empty();
    $("#multiplot").removeClass("multiplot");
    $("#legend").css('display','none');  //hide legend
    return;
  }

  var msg = "";
  if (this.multiplot) {
     msg = 'Terug naar enkele grafiek';
  } else {
     msg = 'Plot meerdere grafieken';
  }

  $("#multiplot").html(msg).addClass("multiplot");
  $("#legend").css('display','inline');

}; // set_plot.mode

ModelleertaalApp.prototype.set_graph_menu = function() {
  var self = this;

  if (this.multiplot) {
    // build multi variable checkboxes for y-var
    $(this.dom_select_graph).empty();

    for (var i = 0; i < this.allVars.length; i++) {
      var checked_y = (i == yvar_colidx) ? true : false;
      var checked_x = (i == xvar_colidx) ? true : false;
      $(this.dom_select_graph).append($("<input>").attr("type", "checkbox")
            .attr("checked", checked_y).attr("idx_yvar", i)
            .attr("id", "id_" + this.allVars[i]));
      $(this.dom_select_graph).append($("<label>").text(this.allVars[i]));
      $(this.dom_select_graph).append($('<br>'));
    }
    $(this.dom_select_graph).find("input:checkbox").click(function () {
      // toglle autoscale on/off and replot!
      self.do_plot();
    });
  } else {
    // reset single dropdown menu for y-var.
    $(this.dom_select_graph).empty();
    $(this.dom_select_graph).append($("<select>").attr("id", "y_var"));
    $(this.dom_legend).empty();
    this.reset_axis_dropdown();
  }
  this.toggle_plot_mode();

}; // create_graph_checkboxes


ModelleertaalApp.prototype.do_multi_plot = function() {

  var self = this;

  // qualitative colour scheme that is colour-blind safe.
  // https://personal.sron.nl/~pault/#sec:qualitative
  // blue, cyan, green, yellow, red, purple, grey
  var graph_colors = ['blue', '#6ce', '#283', '#cb4', '#e67','#a37', '#bbb'];

  // FIXME cache this!!!
  var results = this.reduce_rows(this.results, this.max_rows_in_plot);
  var dataset = [];

  // x-var
  xvar_colidx = parseInt($(this.dom_x_var).val());
  xvar_colidx = (!isNaN(xvar_colidx)) ? xvar_colidx : 0;
  $(this.dom_x_var).val(xvar_colidx);

  var n = 0;
  // y-vars
  $("#select_graph").find("input:checked").each(function () {
    var ycol_idx = $(this).attr("idx_yvar");
    ycol_idx = parseInt(ycol_idx);
    if (isNaN(ycol_idx)) return ;
    var plot = {
        data: []
      };

    for (var i = 0; i < results.length; i++) {
      // FIXME xvar_colidx scope!!!!
      plot.data.push([results[i][xvar_colidx], results[i][ycol_idx]]);
    }
    plot.color = graph_colors[n];
    plot.label = self.allVars[ycol_idx];
    n += 1;
    dataset.push(plot);
	});
  $(this.dom_graph).empty(); // verwijder text enzo
  $(this.dom_clickdata).empty();
  this.plot_graph(dataset);

}; // do_multi_plot


ModelleertaalApp.prototype.set_axis_to_defaults = function() {
  // get column indices (in results array) of variables to plot
  xvar_colidx = parseInt($(this.dom_x_var).val());
  yvar_colidx = parseInt($(this.dom_y_var).val());

  // if undefined -> x first column, y second column of results
  xvar_colidx = (!isNaN(xvar_colidx)) ? xvar_colidx : 0;
  yvar_colidx = (!isNaN(yvar_colidx)) ? yvar_colidx : 1;

  // set column varnames in input fields
  $(this.dom_x_var).val(xvar_colidx);
  $(this.dom_y_var).val(yvar_colidx);
};


ModelleertaalApp.prototype.plot_graph = function(dataset) {

  var self = this;
  var plot_yaxis_min;

  var x_var_name = this.allVars[$(this.dom_x_var).val()];
  var y_var_name = this.allVars[$(this.dom_y_var).val()];

  // FIXME: Dit kan VEEL makkelijker en LEESBAARDER!
  function find_datasets_min_below_zero(ds) {
      var min = 0;
      var len_ds = ds.length;
      var val, i;
  	  for (i = 0; i < len_ds; i++ ) {
          val = find_dataset_min(ds[i]);
          if ( val < min ) {
  			       min = val;
  	          }
	    }
	    return min;
  }

  function find_dataset_min(d) {
      var min = Infinity;
      var len = d.data.length;
      var val;

  	  for ( var i = 0; i < len; i++ ) {
          val = d.data[i][1];
          if ( val < min ) {
  			       min = val;
  	          }
	    }
	    return min;
  }

  if (self.yaxis_autoscale) {
    plot_yaxis_min = undefined;  // use autoscale for y-axis
  } else {
    // plot the y-axis from min(0, minimum of dataset)
    // FIXME: Does not work for multiple datasets!!!!
    plot_yaxis_min = find_datasets_min_below_zero(dataset);
  }

  $(this.dom_graph).css("font-family", "sans-serif");

  function sciFormatter(val, axis) {
    // format large numbers in scientific notation: 1e6
    // probably *much* (much!) slower than the default tickformatter
    if (Math.abs(val) > 9e4)
        return val.toExponential(1);
    else
        //return val.toFixed(axis.tickDecimals);
        return $.plot.defaultTickFormatter(val, axis);
  }

  var legendContainer = document.getElementById("legend");

  var axis_font = {
    size: 12,
    lineHeight: 13,
    family: "sans-serif",
    variant: "small-caps",
    color: "#545454"
  };

  var plot_object = $.plot($(this.dom_graph), dataset, {
    series: {
      lines: {
        show: true
      },
      points: {
        radius: 1,
        show: true,
        fill: true
      }
    },
    grid: {
      hoverable: true,
      clickable: true
    },
    axisLabels: {
      show: true
    },
    xaxis: {
      font: axis_font,
      showTicks: false,
      tickFormatter: sciFormatter,
      axisLabel: x_var_name
    },
    yaxis: {
      font: axis_font,
      showTicks: false,
      position: 'left',
      tickFormatter: sciFormatter,
      min: plot_yaxis_min,
      axisLabel: y_var_name
    },
    legend: {
      show: (this.multiplot) ? true : null,
      container: legendContainer,
    },
    tooltip: {
      show: true,
      content: "%lx: %x.2, %s: %y.2"
    }
  }); // $.plot()

  $(this.dom_graph).bind("plotclick", function(event, pos, item) {
    if ((self.multiplot) || (item.seriesIndex == 1)) {
     // multiplot: click on all lines, single plot: do not allow click on previous plot
     var table = $('<table>').addClass('table');
     table.append(self.table_header());
     table.append(self.table_row(self.get_result_rowIndex(item.dataIndex)));
     $(self.dom_clickdata).html(table);
    }
  }); // $bind.("plotclick")

  // create clickable y-axis that toggles autoscale
  var axes = plot_object.getAxes();
  var axis = axes.yaxis;
  var box = axis.box;
  $("<div id='plot_yaxis' class='axisTarget' style='position:absolute; left:" + box.left + "px; top:" + box.top + "px; width:" + box.width +  "px; height:" + box.height + "px'></div>")
				.data("axis.direction", axis.direction)
				.data("axis.n", axis.n)
				.css({ backgroundColor: "#f00", opacity: 0, cursor: "pointer" })
				.appendTo(plot_object.getPlaceholder())
				.hover(
					function () { $(this).css({ opacity: 0.10 }); },
					function () { $(this).css({ opacity: 0 }); }
				)
				.click(function () {
          // toglle autoscale on/off and replot!
          self.yaxis_autoscale = !self.yaxis_autoscale;
          self.do_plot();
        });

  $("#plot_yaxis").hover(function() {
        $(this).css('cursor','pointer').attr('title', 'Klik op de as om de schaal te wijzigen (autoscale aan/uit).');
    });
}; // plot_graph()

ModelleertaalApp.prototype.set_max_rows_in_plot = function(max_rows) {
  this.max_rows_in_plot = max_rows;
};

ModelleertaalApp.prototype.set_precision = function(precision) {
  this.precision = precision;
};

ModelleertaalApp.prototype.read_model_from_xml = function(XMLString) {
  this.model = new evaluator_js.Model();
  this.model.parseBogusXMLString(XMLString);
};


//
// Reset
//
ModelleertaalApp.prototype.init_app = function() {
  if (this.CodeMirrorActive) {
    this.modelregels_editor.setValue(this.model.modelregels);
    this.startwaarden_editor.setValue(this.model.startwaarden);
  } else {
    $(this.dom_modelregels).val(this.model.modelregels);
    $(this.dom_startwaarden).val(this.model.startwaarden);
  }
  if (this.model.N) $(this.dom_nbox).val(this.model.N);

  this.results = [];
  this.scatter_plot = [];
  this.previous_plot = [];
  this.has_run = false;
  this.tracing = false;

  // (re)set graph menu
  this.multiplot = false;
  this.set_graph_menu();
  $(this.dom_y_var).empty();
  $(this.dom_x_var).empty();
  $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
  $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  this.print_status("Status: Model geladen.", "Model geladen. Geen data. Druk op Run!");
  $(this.dom_datatable).empty();

};


//
// TSV -- use TSV instead of CSV to prevent , . decimal problems in Excel.
//
ModelleertaalApp.prototype.create_tsv = function() {
    var self = this;
    var tsv = '';

    tsv += this.allVars.join('\t'); //header row
    tsv += "\n";

    tsv += this.results.map(function(row ){
        return row.map(function(item) {
          return typeof(item) === 'number' ? item.toPrecision(self.precision) : item;
        }).join('\t');
    }).join('\n');

    // replace . with , for NL Excel (should be an option)
    return tsv.replace(/\./g,",");
};

//
// PGFPlot
//
ModelleertaalApp.prototype.create_pgfplot_header = function() {
		// try to create a PGFPlot that fits the 10x10cm grid.
		// set x,y axis scales and min max values accordingly
		// This only works for graphs starting at (0,0)

		// https://stackoverflow.com/a/31643591/4965175
		function arrayMax(array) {
      return array.reduce(function(a, b) {
        return Math.max(a, b);
      });
		}

		function arrayMin(array) {
      return array.reduce(function(a, b) {
        return Math.min(a, b);
      });
		}

		function round_to_scale(max_val) {
			// round to next 10, 20, 50, 100, 200, 500, ...

			var exp_10 = Math.floor(Math.log(max_val)/Math.log(10));
			var power_of_ten = Math.pow(10, exp_10);

			if (max_val / (2 * power_of_ten) < 1) return 2*power_of_ten;
			if (max_val / (5 * power_of_ten) < 1) return 5*power_of_ten;
			return 10*power_of_ten;
		}

		function get_units_by_variable_name(var_name) {
			var units = {"x": "\\meter", "y": "\\meter", "h": "\\meter", "u": "\\meter",
								"s": "\\meter", "t": "\\second",
							 "v": "\\meter\\per\\second",
							 "a": "\\meter\\per\\second",
						   "Fres": "\\Newton", "Fr": "\\Newton", "Fw": "\\Newton"};
			return (units[var_name]) ? units[var_name] : "unknown";
		}

		this.save_axis(); // get axis from drop-down
		x_var = this.xvar_last;
		y_var = this.yvar_last;
		x_unit = get_units_by_variable_name(x_var);
		y_unit = get_units_by_variable_name(y_var);

		// and back to columns again ...
		var x = []; var y = [];
		for(var i = 0; i < this.scatter_plot.length; i++){
		    x.push(this.scatter_plot[i][0]); y.push(this.scatter_plot[i][1]);
		}

		// This only works for 10x10 grid with x_min, y_min = (0,0)
		x_min = arrayMin(x);
		x_max = round_to_scale(arrayMax(x));
		y_min = arrayMin(y);
		y_max = round_to_scale(arrayMax(y));
		x_scale = x_max / 10;   // adjust to 10 cm x 10 cm grid
		y_scale = y_max / 10;

		return "%x and y scale set to 10cmx10cm grid. Adjust to fit!\n" +
		 "% x = ["+x_min+" .. "+arrayMax(x)+"]\n"+
		 "% y = ["+y_min+" .. "+arrayMax(y)+"]\n"+
		 "% this only works for graphs starting at (0,0)\n"+
		 "\\begin{axis}[x=1cm\/"+x_scale+", y=1cm\/"+y_scale+",\n"+
     "axis y line=left, axis x line=middle,\n"+
		 "enlargelimits=false, tick align=outside,\n "+
		 "xlabel={$"+x_var+"$ [\\si{"+x_unit+"}]},\n"+
		 "ylabel={$"+y_var+"$ [\\si{"+y_unit+"}]},\n"+
		 "% xtick={0, 1, 2, ..., 10},\n"+
		 "% ytick={0, 2, 4, ..., 20},\n"+
		 "xmin="+x_min+", xmax="+x_max+", ymin="+y_min+", ymax="+y_max+"]\n";
	};


ModelleertaalApp.prototype.create_pgfplot = function() {
		// Output PGFPlots plot

    if (!this.results_available()) {
      alert('Geen resultaten. Druk eerst op Run!');
      return false;
    }

    if (this.multiplot) {
      alert('Not Implemented! Dit werkt alleen met enkele grafiek');
      return false;
    }

    this.scatter_plot = [];

    this.set_axis_to_defaults();

    var results = this.reduce_rows(this.results, this.max_rows_in_plot);

    for (var i = 0; i < results.length; i++) {
      this.scatter_plot.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
    }

		var coordinates = this.scatter_plot.map(function(d){
						return "("+d.join(',')+")";
				}).join('\n');

		PGFPlot_TeX = "% Use \\input{} to wrap this inside suitable LaTeX doc:\n";
		PGFPlot_TeX += "\\begin{tikzpicture}\n" +
       "\pgfplotsset{/pgf/number format/use comma}\n" +
			 "% draw 10x10cm millimeter paper.\n" +
			 "\\def\\width{10}\n" +
	     "\\def\\height{10}\n" +
	     "\\draw[step=1mm, line width=0.2mm, blue!20!white] (0,0) grid (\\width,\\height);\n"+
	     "\\draw[step=5mm, line width=0.2mm, blue!40!white] (0,0) grid (\\width,\\height);\n"+
	     "\\draw[step=1cm, line width=0.2mm, blue!60!white] (0,0) grid (\\width,\\height);\n";
		PGFPlot_TeX += "%\n%\n%\n";

		PGFPlot_TeX += this.create_pgfplot_header();

		PGFPlot_TeX += "\\addplot[no marks, black, very thick]\n";
		PGFPlot_TeX += "coordinates {\n";
		PGFPlot_TeX += coordinates;
		PGFPlot_TeX += "\n};\n";
		PGFPlot_TeX += "\\end{axis}\n";
		PGFPlot_TeX += "\\end{tikzpicture}\n";
		return PGFPlot_TeX;
	};

// 
// SVG
// 
ModelleertaalApp.prototype.create_svgplot = function() {
  // Output SVG plot

  if (!this.results_available()) {
    alert('Geen resultaten. Druk eerst op Run!');
    return false;
  }

  if (this.multiplot) {
    alert('Not Implemented! Dit werkt alleen met enkele grafiek');
    return false;
  }

  this.scatter_plot = [];

  this.set_axis_to_defaults();

  var results = this.reduce_rows(this.results, this.max_rows_in_plot);

  for (var i = 0; i < results.length; i++) {
    this.scatter_plot.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
  }

  var coordinates = this.scatter_plot.map(function(d){
          return " "+d.join(',')+" ";
      }).join('\n');

  SVG_Plot = '<svg viewBox="0 0 100 100">\n';
  // graph
  SVG_Plot += '<polyline fill="none" stroke="black" '  ;                 
  SVG_Plot += 'points= "\n';
  SVG_Plot += coordinates; 
  SVG_Plot += ' "/>\n';
  SVG_Plot += '</svg>\n';
  
  return SVG_Plot;
};


//
// Helpers
//
ModelleertaalApp.prototype.reduce_rows = function(rows, Nresults) {
  // reduce resultsObject (large array) to length == Nresults

  var length = rows.length;
  var rowinc = Math.floor(length / Nresults);

  function select_rows(value, index) {
    // select first row, last row and rows in between. Keep Nrows+1 rows.
    if (index === 0 || index % rowinc === 0 || index == length - 1) {
      return true;
    } else {
      return false;
    }
  }

  if (length > Nresults) {
    this.rowinc = rowinc;
    return rows.filter(select_rows);
  }
  this.rowinc = 1;
  return rows;
};


ModelleertaalApp.prototype.get_result_rowIndex = function(rowIndex_plot) {
  // map row index from this.scatter_plot (reduced number of rows)
  // back to this.results

  rowIndex = this.rowinc * rowIndex_plot;
  if (rowIndex < this.results.length) {
    return rowIndex;
  } else {
    return this.results.length - 1;
  }
};


ModelleertaalApp.prototype.highlight_error = function(line, editor_name) {

  if (!this.CodeMirrorActive) return false;

  var self_editor;

  if (editor_name === 'modelregels') {
     self_editor = this.modelregels_editor;
   } else if (editor_name === 'startwaarden') {
     self_editor = this.startwaarden_editor;
   } else {
     console.log('highlight_error: no such editor: '+editor_name);
     return false;
   }

  self_editor.addLineClass(line-1, 'background', 'CodeMirror-matchingtag');
  setTimeout(function() {
      self_editor.removeLineClass(line-1, 'background', 'CodeMirror-matchingtag');
    }, 7000);
};


ModelleertaalApp.prototype.remove_highlight_trace = function(line) {

  if (!this.CodeMirrorActive) return false;
  var self_editor = this.modelregels_editor;

  if (this.at_line !== undefined)
      // remove current highlighted line
      self_editor.removeLineClass(this.at_line, 'background', 'CodeMirror-activeline-background');
};


ModelleertaalApp.prototype.highlight_trace = function(line) {

  if (!this.CodeMirrorActive) return false;
  var self_editor = this.modelregels_editor;

  if (this.at_line !== undefined)
      // remove current highlighted line
      self_editor.removeLineClass(this.at_line, 'background', 'CodeMirror-activeline-background');

  this.at_line = line-1;
  self_editor.addLineClass(this.at_line, 'background', 'CodeMirror-activeline-background');
/*  setTimeout(function() {
      self_editor.removeLineClass(line-1, 'background', 'CodeMirror-matchingtag');
    }, 7000); */
};


exports.ModelleertaalApp = ModelleertaalApp;

},{"./evaluator.js":1,"blob":5,"file-saver":7}],4:[function(require,module,exports){
(function (process){
/* parser generated by jison 0.4.18 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,4],$V1=[1,5],$V2=[1,6],$V3=[1,7],$V4=[1,8],$V5=[5,7,10,13,14,15,16,19],$V6=[1,24],$V7=[1,18],$V8=[1,21],$V9=[1,16],$Va=[1,15],$Vb=[1,17],$Vc=[1,19],$Vd=[1,20],$Ve=[1,22],$Vf=[1,23],$Vg=[1,28],$Vh=[1,29],$Vi=[1,30],$Vj=[1,31],$Vk=[1,32],$Vl=[1,33],$Vm=[1,34],$Vn=[1,35],$Vo=[1,36],$Vp=[1,37],$Vq=[1,38],$Vr=[1,39],$Vs=[1,40],$Vt=[1,41],$Vu=[1,42],$Vv=[5,7,10,12,13,14,15,16,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35],$Vw=[5,7,10,12,13,14,15,16,18,19,32,33],$Vx=[5,7,10,12,13,14,15,16,18,19,27,28,29,30,31,32,33,34,35],$Vy=[5,7,10,12,13,14,15,16,18,19,32,33,34,35];
var parser = {trace: function trace () { },
yy: {},
symbols_: {"error":2,"program":3,"stmt_list":4,"EOF":5,"stmt":6,"IDENT":7,"ASSIGN":8,"expr":9,"IF":10,"condition":11,"THEN":12,"ENDIF":13,"ELSE":14,"STOP":15,"PRINT":16,"(":17,")":18,"BLANK":19,"direct_declarator":20,"SEP":21,"==":22,">":23,">=":24,"<":25,"<=":26,"||":27,"&&":28,"SQUARED":29,"CUBED":30,"^":31,"+":32,"-":33,"*":34,"/":35,"NOT":36,"NUMBER":37,"PI":38,"TRUE":39,"FALSE":40,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",7:"IDENT",8:"ASSIGN",10:"IF",12:"THEN",13:"ENDIF",14:"ELSE",15:"STOP",16:"PRINT",17:"(",18:")",19:"BLANK",21:"SEP",22:"==",23:">",24:">=",25:"<",26:"<=",27:"||",28:"&&",29:"SQUARED",30:"CUBED",31:"^",32:"+",33:"-",34:"*",35:"/",36:"NOT",37:"NUMBER",38:"PI",39:"TRUE",40:"FALSE"},
productions_: [0,[3,2],[4,1],[4,2],[6,3],[6,5],[6,7],[6,1],[6,4],[6,1],[11,1],[20,1],[20,4],[9,1],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,2],[9,2],[9,3],[9,3],[9,3],[9,3],[9,3],[9,2],[9,2],[9,2],[9,3],[9,1],[9,1],[9,1],[9,1],[9,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:
 return($$[$0-1]); 
break;
case 2:
 this.$ = [$$[$0]]; 
break;
case 3:
 $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 4:
 this.$ = {
                type: 'Assignment',
                left: $$[$0-2],
                right: $$[$0]

            };
        
break;
case 5:
 this.$ = {
                type: 'If',
                cond: $$[$0-3],
                then: $$[$0-1]
            };
        
break;
case 6:
 this.$ = {
              type: 'IfElse',
              cond: $$[$0-5],
              then: $$[$0-3],
              elsestmt: $$[$0-1]
          };
      
break;
case 7:
this.$ = {
                 type: 'Stop',
                 value: $$[$0]
            };
      
break;
case 8:
this.$ = {
                 type: 'Print',
                 value: $$[$0-3],
                 varname: $$[$0-1]
            };
      
break;
case 9:
this.$ = {
                type: 'Blank',
                value: $$[$0]
           };
      
break;
case 10: case 13:
this.$ = $$[$0];
break;
case 11:
 this.$ = {
                  type: 'Variable',
                  name: yytext
              };
          
break;
case 12:
this.$ = {
              type: 'Function',
              func: $$[$0-3],
              expr: $$[$0-1]
      };
  
break;
case 14:
this.$ = {
               type: 'List',
               operator: 'LIST',
               left: $$[$0-2],
               right: $$[$0]
       };
  
break;
case 15:
this.$ = {
               type: 'Logical',
               operator: '==',
               left: $$[$0-2],
               right: $$[$0]
       };
   
break;
case 16:
this.$ = {
              type: 'Logical',
              operator: '>',
              left: $$[$0-2],
              right: $$[$0]
      };
  
break;
case 17:
this.$ = {
                type: 'Logical',
                operator: '>=',
                left: $$[$0-2],
                right: $$[$0]
        };
    
break;
case 18:
this.$ = {
               type: 'Logical',
               operator: '<',
               left: $$[$0-2],
               right: $$[$0]
       };
   
break;
case 19:
this.$ = {
                  type: 'Logical',
                  operator: '<=',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 20:
this.$ = {
                  type: 'Logical',
                  operator: '||',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 21:
this.$ = {
                  type: 'Logical',
                  operator: '&&',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 22:
this.$ = {
                  type: 'Binary',
                  operator: '^',
                  left: $$[$0-1],
                  right: {
                          type: 'Number',
                          value: "2"
                      },
            };
          
break;
case 23:
this.$ = {
                  type: 'Binary',
                  operator: '^',
                  left: $$[$0-1],
                  right: {
                          type: 'Number',
                          value: "3"
                      },
            };
          
break;
case 24:
this.$ = {
                 type: 'Binary',
                 operator: '^',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 25:
this.$ = {
                type: 'Binary',
                operator: '+',
                left: $$[$0-2],
                right: $$[$0]
          };
        
break;
case 26:
this.$ = {
                 type: 'Binary',
                 operator: '-',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 27:
this.$ = {
                 type: 'Binary',
                 operator: '*',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 28:
this.$ = {
               type: 'Binary',
               operator: '/',
               left: $$[$0-2],
               right: $$[$0]
         };
       
break;
case 29:
this.$ = {
                  type: 'Unary',
                  operator: '-',
                  right: $$[$0]
            };
          
break;
case 30:
this.$ = {
                  type: 'Unary',
                  operator: '+',
                  right: $$[$0]
            };
          
break;
case 31:
this.$ = {
                type: 'Unary',
                operator: 'NOT',
                right: $$[$0]
          };
        
break;
case 32:
this.$ = $$[$0-1];
break;
case 33:
this.$ = {
                  type: 'Number',
                  value: $$[$0]
              };
           
break;
case 34:
this.$ = {
              type: 'Number',
              value: "3.14159265359"
          };
       
break;
case 35:
this.$ = {
              type: 'Blank',
          };
       
break;
case 36:
this.$ = {
                type: 'Boolean',
                value: 'true'
            };
         
break;
case 37:
this.$ = {
                type: 'Boolean',
                value: 'false'
            };
         
break;
}
},
table: [{3:1,4:2,6:3,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},{1:[3]},{5:[1,9],6:10,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},o($V5,[2,2]),{8:[1,11]},{7:$V6,9:13,11:12,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($V5,[2,7]),{17:[1,25]},o($V5,[2,9]),{1:[2,1]},o($V5,[2,3]),{7:$V6,9:26,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{12:[1,27]},{12:[2,10],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},o($Vv,[2,13]),{7:$V6,9:43,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:44,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:45,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:46,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($Vv,[2,33]),o($Vv,[2,34]),o($Vv,[2,35]),o($Vv,[2,36]),o($Vv,[2,37]),o($Vv,[2,11],{17:[1,47]}),{7:[1,48]},o($V5,[2,4],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu}),{4:49,6:3,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},{7:$V6,9:50,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:51,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:52,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:53,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:54,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:55,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:56,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:57,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($Vv,[2,22]),o($Vv,[2,23]),{7:$V6,9:58,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:59,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:60,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:61,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{7:$V6,9:62,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},o($Vw,[2,29],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,34:$Vt,35:$Vu}),o($Vw,[2,30],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,34:$Vt,35:$Vu}),o($Vx,[2,31],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl}),{18:[1,63],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},{7:$V6,9:64,17:$V7,19:$V8,20:14,32:$V9,33:$Va,36:$Vb,37:$Vc,38:$Vd,39:$Ve,40:$Vf},{18:[1,65]},{6:10,7:$V0,10:$V1,13:[1,66],14:[1,67],15:$V2,16:$V3,19:$V4},o($Vv,[2,14]),o([5,7,10,12,13,14,15,16,18,19,22,27,28,29,30,31,32,33,34,35],[2,15],{21:$Vg,23:$Vi,24:$Vj,25:$Vk,26:$Vl}),o([5,7,10,12,13,14,15,16,18,19,22,23,24,25,26,27,28,29,30,31,32,33,34,35],[2,16],{21:$Vg}),o([5,7,10,12,13,14,15,16,18,19,22,24,25,26,27,28,29,30,31,32,33,34,35],[2,17],{21:$Vg,23:$Vi}),o([5,7,10,12,13,14,15,16,18,19,22,25,26,27,28,29,30,31,32,33,34,35],[2,18],{21:$Vg,23:$Vi,24:$Vj}),o([5,7,10,12,13,14,15,16,18,19,22,26,27,28,29,30,31,32,33,34,35],[2,19],{21:$Vg,23:$Vi,24:$Vj,25:$Vk}),o($Vx,[2,20],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl}),o($Vx,[2,21],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl}),o([5,7,10,12,13,14,15,16,18,19,29,30,31,32,33,34,35],[2,24],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn}),o($Vw,[2,25],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,34:$Vt,35:$Vu}),o($Vw,[2,26],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,34:$Vt,35:$Vu}),o($Vy,[2,27],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq}),o($Vy,[2,28],{21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq}),o($Vv,[2,32]),{18:[1,68],21:$Vg,22:$Vh,23:$Vi,24:$Vj,25:$Vk,26:$Vl,27:$Vm,28:$Vn,29:$Vo,30:$Vp,31:$Vq,32:$Vr,33:$Vs,34:$Vt,35:$Vu},o($V5,[2,8]),o($V5,[2,5]),{4:69,6:3,7:$V0,10:$V1,15:$V2,16:$V3,19:$V4},o($Vv,[2,12]),{6:10,7:$V0,10:$V1,13:[1,70],15:$V2,16:$V3,19:$V4},o($V5,[2,6])],
defaultActions: {9:[2,1]},
parseError: function parseError (str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        var error = new Error(str);
        error.hash = hash;
        throw error;
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        var lex = function () {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        };
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};
/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function(match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex () {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin (condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState () {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules () {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState (n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState (condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {"case-insensitive":true},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0:/* ignore whitespaces */
break;
case 1:/* ignore whitespaces */
break;
case 2:/* modelleertaal comment */
break;
case 3:/* C-style multiline comment */
break;
case 4:/* C-style comment */
break;
case 5:/* Python style comment */
break;
case 6:return 17
break;
case 7:return 18
break;
case 8:return 38
break;
case 9:return 38
break;
case 10:return 22
break;
case 11:return 24
break;
case 12:return 26
break;
case 13:return 23
break;
case 14:return 25
break;
case 15:return 27
break;
case 16:return 27
break;
case 17:return 28
break;
case 18:return 28
break;
case 19:return 36
break;
case 20:return 40
break;
case 21:return 39
break;
case 22:return 8
break;
case 23:return 8
break;
case 24:return 37
break;
case 25:return 37
break;
case 26:return 37
break;
case 27:return 29
break;
case 28:return 30
break;
case 29:return 31
break;
case 30:return 32
break;
case 31:return 33
break;
case 32:return 34
break;
case 33:return 35
break;
case 34:return 13
break;
case 35:return 10
break;
case 36:return 12
break;
case 37:return 15
break;
case 38:return 14
break;
case 39:return 16  //stop and print value
break;
case 40:return 21 // allow lists: min(1;2;3)
break;
case 41:return 19
break;
case 42:return 19
break;
case 43:return 7
break;
case 44:return 5
break;
}
},
rules: [/^(?:\s+)/i,/^(?:\t+)/i,/^(?:'[^\n]*)/i,/^(?:\/\*(.|\n|\r)*?\*\/)/i,/^(?:\/\/[^\n]*)/i,/^(?:#[^\n]*)/i,/^(?:\()/i,/^(?:\))/i,/^(?:pi\b)/i,/^(?:π)/i,/^(?:==)/i,/^(?:>=)/i,/^(?:<=)/i,/^(?:>)/i,/^(?:<)/i,/^(?:of\b)/i,/^(?:\|\|)/i,/^(?:en\b)/i,/^(?:&&)/i,/^(?:!|niet\b)/i,/^(?:onwaar\b)/i,/^(?:waar\b)/i,/^(?:=)/i,/^(?::=)/i,/^(?:[0-9]*["."","][0-9]+([Ee][+-]?[0-9]+)?)/i,/^(?:[0-9]+["."","][0-9]*([Ee][+-]?[0-9]+)?)/i,/^(?:[0-9]+([Ee][+-]?[0-9]+)?)/i,/^(?:²)/i,/^(?:³)/i,/^(?:\^)/i,/^(?:\+)/i,/^(?:-)/i,/^(?:\*)/i,/^(?:\/)/i,/^(?:eindals\b)/i,/^(?:als\b)/i,/^(?:dan\b)/i,/^(?:stop\b)/i,/^(?:anders\b)/i,/^(?:print\b)/i,/^(?:;)/i,/^(?:\.\.\.)/i,/^(?:…)/i,/^(?:[a-zA-Z\x7f-\uffff][a-zA-Z\x7f-\u00b1\u00b4-\uffff0-9_"\]""\|"{}"["]*)/i,/^(?:$)/i],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); };
exports.main = function commonjsMain (args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
}).call(this,require('_process'))
},{"_process":9,"fs":6,"path":8}],5:[function(require,module,exports){
(function (global){
/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  for (var i = 0; i < ary.length; i++) {
    var chunk = ary[i];
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      ary[i] = buf;
    }
  }
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary);

  for (var i = 0; i < ary.length; i++) {
    bb.append(ary[i]);
  }

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  mapArrayBufferViews(ary);
  return new Blob(ary, options || {});
};

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],6:[function(require,module,exports){

},{}],7:[function(require,module,exports){
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.3.2
 * 2016-06-16 18:25:19
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof view === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /constructor/i.test(view.HTMLElement) || view.safari
		, is_chrome_ios =/CriOS\/[\d]+/.test(navigator.userAgent)
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			// note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, force = type === force_saveable_type
				, object_url
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
							var popup = view.open(url, '_blank');
							if(!popup) view.location.href = url;
							url=undefined; // release reference before dispatching
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (!object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (force) {
						view.location.href = object_url;
					} else {
						var opened = view.open(object_url, "_blank");
						if (!opened) {
							// Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
							view.location.href = object_url;
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
			;
			filesaver.readyState = filesaver.INIT;

			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}

			fs_error();
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			name = name || blob.name || "download";

			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name);
		};
	}

	FS_proto.abort = function(){};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define("FileSaver.js", function() {
    return saveAs;
  });
}

},{}],8:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":9}],9:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[3])(3)
});
