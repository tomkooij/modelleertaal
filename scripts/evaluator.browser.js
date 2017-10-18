(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.evaluator_js = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
Namespace.prototype.referenceVar = function(name) {

    // it should exist (but perhaps in "startwaarden" (constNames))
    if ((this.varNames.indexOf(name) == -1) && (this.constNames.indexOf(name) == -1)) {
        throw new Error('Namespace: referenced variable unknown: ', name);
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
    var nameList = ['t', 's', 'x', 'y', 'h', 'v', 'vx', 'vy'];
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

CodeGenerator.prototype.generateStartWaardenStorageCode = function() {
    var code = 'storage[0] = [];\n';
    for (var i = 0; i < this.namespace.varNames.length; i++) {
        var variable = this.namespace.varDict[this.namespace.varNames[i]];
        code += "if (typeof("+variable+") == 'undefined') "+variable+"=0;\n" +
        "storage[0].push("+variable+");\n";
    }
    return code;
};


CodeGenerator.prototype.generateCodeFromAst = function(ast) {

    var code = "";
    for (var i = 0; i < ast.length; i++) {
        //console.log("AST item = ",ast[i])
        code += this.parseNode(ast[i]);

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
                return this.namespace.createVar(node.left) + ' = (' + this.parseNode(node.right) + ');\n';
        case 'Variable':
                return this.namespace.referenceVar(node.name);
        case 'Binary': {
                    if (node.operator == '^')
                        return "(Math.pow("+this.parseNode(node.left)+","+this.parseNode(node.right)+"))";
                    else
                        return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
                    break;
                    }
        case 'Unary':
                    switch(node.operator) {
                        case '-':   return "(-1. * " + this.parseNode(node.right) + ")";
                        case 'NOT':  return "!("+ this.parseNode(node.right) + ")";
                        default:
                            throw new Error("Unknown unary:" + JSON.stringify(node));
                    }
        /* falls through */
        case 'Logical':
                return "(" + this.parseNode(node.left) + node.operator + this.parseNode(node.right) + ")";
        case 'If':
                return "if (" + this.parseNode(node.cond) + ") {" + this.generateCodeFromAst(node.then) + " }; ";
        case 'Function': {
                switch(node.func.toLowerCase()) {
                    case 'sin': return "Math.sin("+this.parseNode(node.expr)+")";
                    case 'cos': return "Math.cos("+this.parseNode(node.expr)+")";
                    case 'tan': return "Math.tan("+this.parseNode(node.expr)+")";
                    case 'arcsin': return "Math.asin("+this.parseNode(node.expr)+")";
                    case 'arccos': return "Math.acos("+this.parseNode(node.expr)+")";
                    case 'arctan': return "Math.atan("+this.parseNode(node.expr)+")";
                    case 'exp': return "Math.exp("+this.parseNode(node.expr)+")";
                    case 'ln':  return "Math.log("+this.parseNode(node.expr)+")";
                    case 'sqrt': return "Math.sqrt("+this.parseNode(node.expr)+")";
                    default:
                        throw new Error("Unkown function:" + JSON.stringify(node));
                    }
                break;
                }
        case 'Number':
                return parseFloat(node.value.replace(',','.'));
        case 'True':
                return 'true';
        case 'False':
                return 'false';
        case 'Stop':
                return 'throw \'StopIteration\'';
        default:
            throw new Error("Unable to parseNode() :" + JSON.stringify(node));
    } /* switch (node.type) */


}; /* end of parseNode()  */
// end of javascriptCodeGenerator()


function ModelregelsEvaluator(model, debug) {
    if (typeof debug === 'undefined') {
        this.debug = false;
    } else {
        this.debug = true;
    }

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

    this.startwaarden_ast = parser.parse(this.model.startwaarden);
    this.modelregels_ast = parser.parse(this.model.modelregels);

    if (this.debug) {
        console.log('*** AST startwaarden ***');
        console.log(JSON.stringify(this.startwaarden_ast, undefined, 4));
        console.log('*** AST modelregels ***');
        console.log(JSON.stringify(this.modelregels_ast, undefined, 4));
        console.log('');
    }

}

ModelregelsEvaluator.prototype.run = function(N) {

    var startwaarden_code = this.codegenerator.generateCodeFromAst(this.startwaarden_ast);
    this.namespace.moveStartWaarden(); // keep namespace clean
    var modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast);
    this.namespace.sortVarNames(); // sort variable names for better output

    // separate function run_model() inside anonymous Function()
    // to prevent bailout of the V8 optimising compiler in try {} catch
    var model =     "function run_model(N, storage) { \n " +
                    startwaarden_code + "\n" +
                    this.codegenerator.generateStartWaardenStorageCode() +
                    "    for (var i=1; i < N; i++) { \n " +
                    modelregels_code + "\n" +
                    this.codegenerator.generateVariableStorageCode() +
                    "    }  \n" +
                    " return;} \n" +
                 "    var results = []; \n " +
                 "    try \n" +
                 "  { \n" +
                 "      run_model(N, results); \n" +
                 "  } catch (e) \n" +
                 "  { console.log(e)} \n " +
                 "return results;\n";

    if (this.debug) {
        console.log('*** generated js ***');
        console.log(model);
        console.log("*** running! *** ");
        console.log("N = ", N);
    }

    var t1 = Date.now();

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/
    var runModel = new Function('N', model);
    var result = runModel(N);

    var t2 = Date.now();

    console.log("Number of iterations: ", result.length);
    console.log("Time: " + (t2 - t1) + "ms");

    return result;

};

exports.Model = modelmodule.Model; // from model.js
exports.ModelregelsEvaluator = ModelregelsEvaluator;
exports.CodeGenerator = CodeGenerator;
exports.Namespace = Namespace;

},{"./model.js":2,"./modelleertaal":3}],2:[function(require,module,exports){
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

    this.startwaarden = '';
    this.modelregels = '';

    var lines = xmlString.split('\n');

    for(var line = 1; line < lines.length; line++) {

        //console.log(action, lines[line]);

        switch(lines[line].replace('\r','')) {
            // < and > mess things up in the browser
            case '<modelregels>': { action = 1; lines[line] = ''; break; }
            case '</modelregels>': { action = 0; break; }
            case '<startwaarden>': { action = 2; lines[line] = ''; break; }
            case '</startwaarden>': { action = 0; break; }
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

    return '<modelleertaal>\n<startwaarden>\n' +
            this.startwaarden +
            '</startwaarden>\n<modelregels>\n' +
            this.modelregels +
            '</modelregels>\n</modelleertaal>\n';
};



exports.Model = Model;

},{"fs":4}],3:[function(require,module,exports){
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
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,4],$V1=[1,5],$V2=[1,6],$V3=[5,7,10,13,14],$V4=[1,20],$V5=[1,15],$V6=[1,13],$V7=[1,14],$V8=[1,16],$V9=[1,17],$Va=[1,18],$Vb=[1,19],$Vc=[1,23],$Vd=[1,24],$Ve=[1,25],$Vf=[1,26],$Vg=[1,27],$Vh=[1,28],$Vi=[1,29],$Vj=[1,30],$Vk=[1,31],$Vl=[1,32],$Vm=[5,7,10,12,13,14,17,18,19,20,21,22,23,24,25,26,27],$Vn=[5,7,10,12,13,14,17,24,25],$Vo=[5,7,10,12,13,14,17,23,24,25,26,27],$Vp=[5,7,10,12,13,14,17,24,25,26,27];
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"program":3,"stmt_list":4,"EOF":5,"stmt":6,"IDENT":7,"ASSIGN":8,"expr":9,"IF":10,"condition":11,"THEN":12,"ENDIF":13,"STOP":14,"direct_declarator":15,"(":16,")":17,"==":18,">":19,">=":20,"<":21,"<=":22,"^":23,"+":24,"-":25,"*":26,"/":27,"NOT":28,"NUMBER":29,"PI":30,"TRUE":31,"FALSE":32,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",7:"IDENT",8:"ASSIGN",10:"IF",12:"THEN",13:"ENDIF",14:"STOP",16:"(",17:")",18:"==",19:">",20:">=",21:"<",22:"<=",23:"^",24:"+",25:"-",26:"*",27:"/",28:"NOT",29:"NUMBER",30:"PI",31:"TRUE",32:"FALSE"},
productions_: [0,[3,2],[4,1],[4,2],[6,3],[6,5],[6,1],[11,1],[15,1],[15,4],[9,1],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,3],[9,2],[9,2],[9,3],[9,1],[9,1],[9,1],[9,1]],
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
                 type: 'Stop',
                 value: $$[$0]
            };
        
break;
case 7: case 10:
this.$ = $$[$0];
break;
case 8:
 this.$ = {
                  type: 'Variable',
                  name: yytext
              };
          
break;
case 9:
this.$ = {
              type: 'Function',
              func: $$[$0-3],
              expr: $$[$0-1]
      };
  
break;
case 11:
this.$ = {
               type: 'Logical',
               operator: '==',
               left: $$[$0-2],
               right: $$[$0]
       };
   
break;
case 12:
this.$ = {
              type: 'Logical',
              operator: '>',
              left: $$[$0-2],
              right: $$[$0]
      };
  
break;
case 13:
this.$ = {
                type: 'Logical',
                operator: '>=',
                left: $$[$0-2],
                right: $$[$0]
        };
    
break;
case 14:
this.$ = {
               type: 'Logical',
               operator: '<',
               left: $$[$0-2],
               right: $$[$0]
       };
   
break;
case 15:
this.$ = {
                  type: 'Logical',
                  operator: '<=',
                  left: $$[$0-2],
                  right: $$[$0]
          };
      
break;
case 16:
this.$ = {
                 type: 'Binary',
                 operator: '^',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 17:
this.$ = {
                type: 'Binary',
                operator: '+',
                left: $$[$0-2],
                right: $$[$0]
          };
        
break;
case 18:
this.$ = {
                 type: 'Binary',
                 operator: '-',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 19:
this.$ = {
                 type: 'Binary',
                 operator: '*',
                 left: $$[$0-2],
                 right: $$[$0]
           };
         
break;
case 20:
this.$ = {
               type: 'Binary',
               operator: '/',
               left: $$[$0-2],
               right: $$[$0]
         };
       
break;
case 21:
this.$ = {
                  type: 'Unary',
                  operator: '-',
                  right: $$[$0]
            };
          
break;
case 22:
this.$ = {
                type: 'Unary',
                operator: 'NOT',
                right: $$[$0]
          };
        
break;
case 23:
this.$ = $$[$0-1];
break;
case 24:
this.$ = {
                  type: 'Number',
                  value: $$[$0]
              };
           
break;
case 25:
this.$ = {
              type: 'Number',
              value: "3.14159265359"
          };
       
break;
case 26:
this.$ = {
                type: 'True',
                value: $$[$0]
            };
         
break;
case 27:
this.$ = {
                type: 'False',
                value: $$[$0]
            };
         
break;
}
},
table: [{3:1,4:2,6:3,7:$V0,10:$V1,14:$V2},{1:[3]},{5:[1,7],6:8,7:$V0,10:$V1,14:$V2},o($V3,[2,2]),{8:[1,9]},{7:$V4,9:11,11:10,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},o($V3,[2,6]),{1:[2,1]},o($V3,[2,3]),{7:$V4,9:21,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{12:[1,22]},{12:[2,7],18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,24:$Vi,25:$Vj,26:$Vk,27:$Vl},o($Vm,[2,10]),{7:$V4,9:33,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:34,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:35,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},o($Vm,[2,24]),o($Vm,[2,25]),o($Vm,[2,26]),o($Vm,[2,27]),o($Vm,[2,8],{16:[1,36]}),o($V3,[2,4],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,24:$Vi,25:$Vj,26:$Vk,27:$Vl}),{4:37,6:3,7:$V0,10:$V1,14:$V2},{7:$V4,9:38,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:39,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:40,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:41,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:42,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:43,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:44,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:45,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:46,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{7:$V4,9:47,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},o($Vn,[2,21],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,26:$Vk,27:$Vl}),o($Vo,[2,22],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg}),{17:[1,48],18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,24:$Vi,25:$Vj,26:$Vk,27:$Vl},{7:$V4,9:49,15:12,16:$V5,25:$V6,28:$V7,29:$V8,30:$V9,31:$Va,32:$Vb},{6:8,7:$V0,10:$V1,13:[1,50],14:$V2},o([5,7,10,12,13,14,17,18,23,24,25,26,27],[2,11],{19:$Vd,20:$Ve,21:$Vf,22:$Vg}),o($Vm,[2,12]),o([5,7,10,12,13,14,17,18,20,21,22,23,24,25,26,27],[2,13],{19:$Vd}),o([5,7,10,12,13,14,17,18,21,22,23,24,25,26,27],[2,14],{19:$Vd,20:$Ve}),o([5,7,10,12,13,14,17,18,22,23,24,25,26,27],[2,15],{19:$Vd,20:$Ve,21:$Vf}),o($Vo,[2,16],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg}),o($Vn,[2,17],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,26:$Vk,27:$Vl}),o($Vn,[2,18],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,26:$Vk,27:$Vl}),o($Vp,[2,19],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh}),o($Vp,[2,20],{18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh}),o($Vm,[2,23]),{17:[1,51],18:$Vc,19:$Vd,20:$Ve,21:$Vf,22:$Vg,23:$Vh,24:$Vi,25:$Vj,26:$Vk,27:$Vl},o($V3,[2,5]),o($Vm,[2,9])],
defaultActions: {7:[2,1]},
parseError: function parseError(str, hash) {
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
test_match:function (match, indexed_rule) {
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
lex:function lex() {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
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
case 6:return 16
break;
case 7:return 17
break;
case 8:return 30
break;
case 9:return 18
break;
case 10:return 20
break;
case 11:return 22
break;
case 12:return 19
break;
case 13:return 21
break;
case 14:return 28
break;
case 15:return 32
break;
case 16:return 31
break;
case 17:return 8
break;
case 18:return 8
break;
case 19:return 29
break;
case 20:return 29
break;
case 21:return 29
break;
case 22:return 23
break;
case 23:return 24
break;
case 24:return 25
break;
case 25:return 26
break;
case 26:return 27
break;
case 27:return 13
break;
case 28:return 10
break;
case 29:return 12
break;
case 30:return 14
break;
case 31:return 7
break;
case 32:return 5
break;
}
},
rules: [/^(?:\s+)/i,/^(?:\t+)/i,/^(?:'[^\n]*)/i,/^(?:\/\*(.|\n|\r)*?\*\/)/i,/^(?:\/\/[^\n]*)/i,/^(?:#[^\n]*)/i,/^(?:\()/i,/^(?:\))/i,/^(?:pi\b)/i,/^(?:==)/i,/^(?:>=)/i,/^(?:<=)/i,/^(?:>)/i,/^(?:<)/i,/^(?:!|niet\b)/i,/^(?:onwaar\b)/i,/^(?:waar\b)/i,/^(?:=)/i,/^(?::=)/i,/^(?:[0-9]*["."","][0-9]+([Ee][+-]?[0-9]+)?)/i,/^(?:[0-9]+["."","][0-9]*([Ee][+-]?[0-9]+)?)/i,/^(?:[0-9]+([Ee][+-]?[0-9]+)?)/i,/^(?:\^)/i,/^(?:\+)/i,/^(?:-)/i,/^(?:\*)/i,/^(?:\/)/i,/^(?:eindals\b)/i,/^(?:als\b)/i,/^(?:dan\b)/i,/^(?:stop\b)/i,/^(?:[a-zA-Z][a-zA-Z0-9_"\]""\|"{}"["]*)/i,/^(?:$)/i],
conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32],"inclusive":true}}
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
exports.main = function commonjsMain(args) {
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

},{"_process":6,"fs":4,"path":5}],4:[function(require,module,exports){

},{}],5:[function(require,module,exports){
(function (process){
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

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

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

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
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

},{"_process":6}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
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
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (!draining) {
        setTimeout(drainQueue, 0);
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

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJldmFsdWF0b3IuanMiLCJtb2RlbC5qcyIsIm1vZGVsbGVlcnRhYWwuanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2gxQkE7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxyXG4gICAgSW50ZXJwcmV0ZXIgZm9yIE1vZGVsbGVlcnRhYWwgKG1vZGVscmVnZWxzKVxyXG4gICAgU2ltcGxlIGR5bmFtaWNhbCBtb2RlbHMgZm9yIGhpZ2hzY2hvb2wgUGh5c2ljcyBpbiBOTFxyXG5cclxuICAgIFRoZSBsYW5ndWFnZSBpcyBkZXNjcmliZWQgaW4gbW9kZWxsZWVydGFhbC5qaXNvblxyXG5cclxuICAgIHVzYWdlOlxyXG4gICAgICBucG0gaW5zdGFsbCBwYXRoX3RvL2ppc29uXHJcbiAgICAgIG5vZGUgaW50ZXJwcmV0ZXIuanNcclxuKi9cclxuXHJcblxyXG4vL2pzaGludCBub2RlOnRydWVcclxuLy9qc2hpbnQgZGV2ZWw6dHJ1ZVxyXG4vL2pzaGludCBldmlsOnRydWVcclxuLy9qc2hpbnQgZXMzOnRydWVcclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vLyBwYXJzZXIgY29tcGlsZWQgb24gZXhlY3V0aW9uIGJ5IGppc29uLmpzXHJcbnZhciBtb2RlbG1vZHVsZSA9IHJlcXVpcmUoXCIuL21vZGVsLmpzXCIpO1xyXG52YXIgcGFyc2VyID0gcmVxdWlyZShcIi4vbW9kZWxsZWVydGFhbFwiKS5wYXJzZXI7XHJcblxyXG4vKlxyXG4gQ2xhc3MgbmFtZXNwYWNlXHJcblxyXG4gVmFyaWFibGVzIGFyZSBjcmVhdGVkIGluIHRoaXMudmFyTmFtZXMgPSB7fSAoYSBsaXN0IG9mIHZhcmlhYmxlIG5hbWVzKVxyXG5cclxuIFN0YXJ0d2FhcmRlbiBhcmUgY29waWVkIHRvIHRoaXMuY29uc3ROYW1lcyBhbmQgdmFyTmFtZXMgYXJlIGVyYXNlZCBhZnRlclxyXG4gcGFyc2luZyBcInN0YXJ0d2FhcmRlbi50eHRcIi4gVGhpcyBpcyBhIHRyaWNrIHRvIGtlZXAgc3RhcnR3YWFyZGVuIHNlcGVyYXRlXHJcbiovXHJcblxyXG5mdW5jdGlvbiBOYW1lc3BhY2UoKSB7XHJcblxyXG4gICAgLy8gcHJlZml4IHRvIHByZXZlbnQgdmFyaWFibGUgbmFtZSBjb2xsaXNpb24gd2l0aCByZXNlcnZlZCB3b3Jkc1xyXG4gICAgdGhpcy52YXJQcmVmaXggPSBcInZhcl9cIjtcclxuXHJcbiAgICB0aGlzLnZhck5hbWVzID0gW107IC8vIGxpc3Qgb2YgY3JlYXRlZCB2YXJpYWJsZXNcclxuICAgIHRoaXMuY29uc3ROYW1lcyA9IFtdOyAvLyBsaXN0IG9mIHN0YXJ0d2FhcmRlbiB0aGF0IHJlbWFpbiBjb25zdGFudCBpbiBleGVjdXRpb25cclxuICAgIC8vIGRpY3Rpb25hcnkgdGhhdCBjb252ZXJ0cyBNb2RlbGxlZXJ0YWFsIGlkZW50aWZpZXJzICh3aXRoIGlsbGVnYWxcclxuICAgIC8vICBjaGFycyBbXSB7fSBpbiBuYW1lKSB0byBqYXZhc2NpcHQgaWRlbnRpZmllcnNcclxuICAgIHRoaXMudmFyRGljdCA9IHt9O1xyXG59XHJcblxyXG5pZiAoIUFycmF5LnByb3RvdHlwZS5pbmRleE9mKSB7XHJcbiAgQXJyYXkucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiAob2JqLCBmcm9tSW5kZXgpIHtcclxuICAgIGlmIChmcm9tSW5kZXggPT09IG51bGwpIHtcclxuICAgICAgICBmcm9tSW5kZXggPSAwO1xyXG4gICAgfSBlbHNlIGlmIChmcm9tSW5kZXggPCAwKSB7XHJcbiAgICAgICAgZnJvbUluZGV4ID0gTWF0aC5tYXgoMCwgdGhpcy5sZW5ndGggKyBmcm9tSW5kZXgpO1xyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgaSA9IGZyb21JbmRleCwgaiA9IHRoaXMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XHJcbiAgICAgICAgaWYgKHRoaXNbaV0gPT09IG9iailcclxuICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gLTE7XHJcbiAgfTtcclxufVxyXG5cclxuLy8gcmVtb3ZlIGphdmFzY3JpcHQgaWxsZWdhbCBvciBzcGVjaWFsIGNoYXIgZnJvbSB2YXJpYWJsZSBuYW1lc1xyXG5OYW1lc3BhY2UucHJvdG90eXBlLm1hbmdsZU5hbWU9IGZ1bmN0aW9uKHN0cmluZykge1xyXG4gICAgcmV0dXJuIHRoaXMudmFyUHJlZml4ICsgc3RyaW5nLnJlcGxhY2UoJ1xceycsJ19sQV8nKS5yZXBsYWNlKCdcXH0nLCdfckFfJykucmVwbGFjZSgnXFxbJywnX2xIXycpLnJlcGxhY2UoJ1xcXScsJ19ySF8nKS5yZXBsYWNlKCdcXHwnLCdfSV8nKTtcclxufTtcclxuXHJcbi8vIGNyZWF0ZSAob3IgcmVmZXJlbmNlKSB2YXJpYWJsZSB0aGF0IGlzIG9uIHRoZSBsZWZ0IHNpZGUgb2YgYW4gYXNzaWdubWVudFxyXG5OYW1lc3BhY2UucHJvdG90eXBlLmNyZWF0ZVZhciA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgIGlmICh0aGlzLnZhck5hbWVzLmluZGV4T2YobmFtZSkgPT0gLTEpICB7XHJcbiAgICAgICAgdGhpcy52YXJOYW1lcy5wdXNoKG5hbWUpO1xyXG4gICAgfVxyXG4gICAgdGhpcy52YXJEaWN0W25hbWVdID0gdGhpcy5tYW5nbGVOYW1lKG5hbWUpO1xyXG4gICAgcmV0dXJuIHRoaXMudmFyRGljdFtuYW1lXTtcclxufTtcclxuXHJcbi8vIHJlZmVyZW5jZSBhIHZhcmlhYmxlIHRoYXQgaXMgb24gdGhlIHJpZ2h0IHNpZGUgb2YgYW4gYXNzaWdubWVudFxyXG4vLyBJdCBzaG91bGQgYWxyZWFkeSBleGlzdCBpZiBvbiB0aGUgcmlnaHQgc2lkZVxyXG5OYW1lc3BhY2UucHJvdG90eXBlLnJlZmVyZW5jZVZhciA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuXHJcbiAgICAvLyBpdCBzaG91bGQgZXhpc3QgKGJ1dCBwZXJoYXBzIGluIFwic3RhcnR3YWFyZGVuXCIgKGNvbnN0TmFtZXMpKVxyXG4gICAgaWYgKCh0aGlzLnZhck5hbWVzLmluZGV4T2YobmFtZSkgPT0gLTEpICYmICh0aGlzLmNvbnN0TmFtZXMuaW5kZXhPZihuYW1lKSA9PSAtMSkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05hbWVzcGFjZTogcmVmZXJlbmNlZCB2YXJpYWJsZSB1bmtub3duOiAnLCBuYW1lKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnZhckRpY3RbbmFtZV07XHJcbn07XHJcblxyXG5OYW1lc3BhY2UucHJvdG90eXBlLmxpc3RBbGxWYXJzID0gZnVuY3Rpb24oKSB7XHJcbiAgICAvLyBzaG91bGQgcmVhbGx5IHRocm93IGV4Y2VwdGlvbj9cclxuICAgIGNvbnNvbGUubG9nKFwiV0FSTklORzogY2FsbGVkIG9ic29sZXRlIGZ1bmN0aW9uIG5hbWVzcGFjZS5saXN0QWxsVmFycygpXCIpO1xyXG4gICAgcmV0dXJuIHRoaXMudmFyTmFtZXM7XHJcbn07XHJcblxyXG5OYW1lc3BhY2UucHJvdG90eXBlLnJlbW92ZVByZWZpeCA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuXHJcbiAgICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlwiICsgdGhpcy52YXJQcmVmaXgpO1xyXG4gICAgcmV0dXJuIG5hbWUucmVwbGFjZShyZWdleCwgJycpO1xyXG59O1xyXG5cclxuXHJcbk5hbWVzcGFjZS5wcm90b3R5cGUubW92ZVN0YXJ0V2FhcmRlbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuY29uc3ROYW1lcyA9IHRoaXMudmFyTmFtZXM7XHJcbiAgICB0aGlzLnZhck5hbWVzID0gW107XHJcbn07XHJcblxyXG5BcnJheS5wcm90b3R5cGUuc3dhcCA9IGZ1bmN0aW9uKGEsIGIpIHtcclxuICAgIHRoaXNbYV0gPSB0aGlzLnNwbGljZShiLCAxLCB0aGlzW2FdKVswXTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuTmFtZXNwYWNlLnByb3RvdHlwZS5zb3J0VmFyTmFtZXMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAvKiBzb3J0IHZhck5hbWVzLiBcIlN0b2NrXCIgdmFyaWFibGVzICh0LCB4LCBzKSBjb21lIGZpcnN0LlxyXG4gICAgICAgZW5hYmxlcyBhdXRvbWF0aWMgZ3JhcGhzIG9mIGltcG9ydGFudCB2YXJpYWJsZXMgKi9cclxuXHJcbiAgICAvLyBub3cgc29ydHMgb24gdmFyaWFibGUgTkFNRS4gU2hvdWxkIGlkZW50aWZ5IHN0b2NrIHZhcmlhYmxlcyBpbiBBU1QuXHJcblxyXG4gICAgLy8gbmFtZXMgb2YgXCJzcGVjaWFsXCJ2YXJpYWJsZSBuYW1lcyB0byBzb3J0LCBzb3J0IGlmIGZvdW5kIGluIG9yZGVyIGdpdmVuXHJcbiAgICB2YXIgbmFtZUxpc3QgPSBbJ3QnLCAncycsICd4JywgJ3knLCAnaCcsICd2JywgJ3Z4JywgJ3Z5J107XHJcbiAgICB2YXIgbmV4dFZhcmlhYmxlSW5kZXggPSAwIDsgLy8gcGxhY2UgdG8gc3dhcCBuZXh0IFwic3BlY2lhbFwidmFyaWFibGUgd2l0aFxyXG5cclxuICAgIC8qICBuZXh0VmFyaWFibGVJbmRleCA9IDBcclxuICAgICAgICBmb3IgdmFyaWFibGUgaW4gbmFtZUxpc3Q6XHJcbiAgICAgICAgICAgIGlmIHZhcmlhYmxlIGluIHRoaXMudmFyTmFtZXM6XHJcbiAgICAgICAgICAgICAgICBzd2FwIHZhcmlhYmxlIHdpdGggdmFyaWFibGUgYXQgbmV4dFZhcmlhYmxlSW5kZXhcclxuICAgICAgICAgICAgICAgIG5leHRWYXJpYWJsZUluZGV4ICs9IDFcclxuICAgICovXHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5hbWVMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIHZhck5hbWVzX3Bvc2l0aW9uID0gdGhpcy52YXJOYW1lcy5pbmRleE9mKG5hbWVMaXN0W2ldKTtcclxuICAgICAgICBpZiAodmFyTmFtZXNfcG9zaXRpb24gIT0gLTEpIHtcclxuICAgICAgICAgICAgLy8gc3dhcCBhbmQgKmFmdGVyd2FyZHMqIGluY3JlYXNlIG5leHRWYXJpYWJsZUluZGV4XHJcbiAgICAgICAgICAgIHRoaXMudmFyTmFtZXMuc3dhcCh2YXJOYW1lc19wb3NpdGlvbiwgbmV4dFZhcmlhYmxlSW5kZXgrKyk7IH1cclxuICAgIH1cclxufTtcclxuXHJcblxyXG4vKlxyXG4gQ2xhc3MgQ29kZWdlbmVyYXRvclxyXG4gKi9cclxuZnVuY3Rpb24gQ29kZUdlbmVyYXRvcihuYW1lc3BhY2UpIHtcclxuICAgIGlmICh0eXBlb2YgbmFtZXNwYWNlID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIHRoaXMubmFtZXNwYWNlID0gbmV3IE5hbWVzcGFjZSgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcclxuICAgIH1cclxufVxyXG5cclxuQ29kZUdlbmVyYXRvci5wcm90b3R5cGUuc2V0TmFtZXNwYWNlID0gZnVuY3Rpb24obmFtZXNwYWNlKSB7XHJcbiAgICB0aGlzLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTsgLy8gc3RvcmFnZSBmb3IgdmFyaWFibGUgbmFtZXNcclxufTtcclxuXHJcbkNvZGVHZW5lcmF0b3IucHJvdG90eXBlLmdlbmVyYXRlVmFyaWFibGVTdG9yYWdlQ29kZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGNvZGUgPSAnc3RvcmFnZVtpXSA9IFtdO1xcbic7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubmFtZXNwYWNlLnZhck5hbWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgdmFyIHZhcmlhYmxlID0gdGhpcy5uYW1lc3BhY2UudmFyRGljdFt0aGlzLm5hbWVzcGFjZS52YXJOYW1lc1tpXV07XHJcbiAgICAgICAgY29kZSArPSBcInN0b3JhZ2VbaV0ucHVzaChcIit2YXJpYWJsZStcIik7XFxuXCI7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29kZTtcclxufTtcclxuXHJcbkNvZGVHZW5lcmF0b3IucHJvdG90eXBlLmdlbmVyYXRlU3RhcnRXYWFyZGVuU3RvcmFnZUNvZGUgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBjb2RlID0gJ3N0b3JhZ2VbMF0gPSBbXTtcXG4nO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLm5hbWVzcGFjZS52YXJOYW1lcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIHZhciB2YXJpYWJsZSA9IHRoaXMubmFtZXNwYWNlLnZhckRpY3RbdGhpcy5uYW1lc3BhY2UudmFyTmFtZXNbaV1dO1xyXG4gICAgICAgIGNvZGUgKz0gXCJpZiAodHlwZW9mKFwiK3ZhcmlhYmxlK1wiKSA9PSAndW5kZWZpbmVkJykgXCIrdmFyaWFibGUrXCI9MDtcXG5cIiArXHJcbiAgICAgICAgXCJzdG9yYWdlWzBdLnB1c2goXCIrdmFyaWFibGUrXCIpO1xcblwiO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvZGU7XHJcbn07XHJcblxyXG5cclxuQ29kZUdlbmVyYXRvci5wcm90b3R5cGUuZ2VuZXJhdGVDb2RlRnJvbUFzdCA9IGZ1bmN0aW9uKGFzdCkge1xyXG5cclxuICAgIHZhciBjb2RlID0gXCJcIjtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIkFTVCBpdGVtID0gXCIsYXN0W2ldKVxyXG4gICAgICAgIGNvZGUgKz0gdGhpcy5wYXJzZU5vZGUoYXN0W2ldKTtcclxuXHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29kZTtcclxufTtcclxuXHJcblxyXG5cclxuXHJcbkNvZGVHZW5lcmF0b3IucHJvdG90eXBlLnBhcnNlTm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcclxuICAgIC8qIHBhcnNlTm9kZSBpcyBhIHJlY3Vyc2l2ZSBmdW5jdGlvbiB0aGF0IHBhcnNlcyBhbiBpdGVtXHJcbiAgICAgICAgb2YgdGhlIEpTT04gQVNULiBDYWxscyBpdHNlbGYgdG8gdHJhdmVyc2UgdGhyb3VnaCBub2Rlcy5cclxuXHJcbiAgICAgICAgOnBhcmFtOiBub2RlID0gKHBhcnQgb2YpIEpTT04gdHJlZVxyXG4gICAgKi9cclxuXHJcbiAgICAvKiBqYXZhc2NyaXB0IGNvZGUgZ2VuZXJhdGlvbiBpbnNwaXJlZCBieTpcclxuICAgICAgICBodHRwOi8vbGlzcGVyYXRvci5uZXQvcGx0dXQvY29tcGlsZXIvanMtY29kZWdlbiAqL1xyXG5cclxuICAgIHN3aXRjaChub2RlLnR5cGUpIHtcclxuXHJcbiAgICAgICAgY2FzZSAnQXNzaWdubWVudCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5uYW1lc3BhY2UuY3JlYXRlVmFyKG5vZGUubGVmdCkgKyAnID0gKCcgKyB0aGlzLnBhcnNlTm9kZShub2RlLnJpZ2h0KSArICcpO1xcbic7XHJcbiAgICAgICAgY2FzZSAnVmFyaWFibGUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubmFtZXNwYWNlLnJlZmVyZW5jZVZhcihub2RlLm5hbWUpO1xyXG4gICAgICAgIGNhc2UgJ0JpbmFyeSc6IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5vcGVyYXRvciA9PSAnXicpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIihNYXRoLnBvdyhcIit0aGlzLnBhcnNlTm9kZShub2RlLmxlZnQpK1wiLFwiK3RoaXMucGFyc2VOb2RlKG5vZGUucmlnaHQpK1wiKSlcIjtcclxuICAgICAgICAgICAgICAgICAgICBlbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBcIihcIiArIHRoaXMucGFyc2VOb2RlKG5vZGUubGVmdCkgKyBub2RlLm9wZXJhdG9yICsgdGhpcy5wYXJzZU5vZGUobm9kZS5yaWdodCkgKyBcIilcIjtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgY2FzZSAnVW5hcnknOlxyXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaChub2RlLm9wZXJhdG9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJy0nOiAgIHJldHVybiBcIigtMS4gKiBcIiArIHRoaXMucGFyc2VOb2RlKG5vZGUucmlnaHQpICsgXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ05PVCc6ICByZXR1cm4gXCIhKFwiKyB0aGlzLnBhcnNlTm9kZShub2RlLnJpZ2h0KSArIFwiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biB1bmFyeTpcIiArIEpTT04uc3RyaW5naWZ5KG5vZGUpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xyXG4gICAgICAgIGNhc2UgJ0xvZ2ljYWwnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiKFwiICsgdGhpcy5wYXJzZU5vZGUobm9kZS5sZWZ0KSArIG5vZGUub3BlcmF0b3IgKyB0aGlzLnBhcnNlTm9kZShub2RlLnJpZ2h0KSArIFwiKVwiO1xyXG4gICAgICAgIGNhc2UgJ0lmJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcImlmIChcIiArIHRoaXMucGFyc2VOb2RlKG5vZGUuY29uZCkgKyBcIikge1wiICsgdGhpcy5nZW5lcmF0ZUNvZGVGcm9tQXN0KG5vZGUudGhlbikgKyBcIiB9OyBcIjtcclxuICAgICAgICBjYXNlICdGdW5jdGlvbic6IHtcclxuICAgICAgICAgICAgICAgIHN3aXRjaChub2RlLmZ1bmMudG9Mb3dlckNhc2UoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3Npbic6IHJldHVybiBcIk1hdGguc2luKFwiK3RoaXMucGFyc2VOb2RlKG5vZGUuZXhwcikrXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnY29zJzogcmV0dXJuIFwiTWF0aC5jb3MoXCIrdGhpcy5wYXJzZU5vZGUobm9kZS5leHByKStcIilcIjtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICd0YW4nOiByZXR1cm4gXCJNYXRoLnRhbihcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2FyY3Npbic6IHJldHVybiBcIk1hdGguYXNpbihcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2FyY2Nvcyc6IHJldHVybiBcIk1hdGguYWNvcyhcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2FyY3Rhbic6IHJldHVybiBcIk1hdGguYXRhbihcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2V4cCc6IHJldHVybiBcIk1hdGguZXhwKFwiK3RoaXMucGFyc2VOb2RlKG5vZGUuZXhwcikrXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbG4nOiAgcmV0dXJuIFwiTWF0aC5sb2coXCIrdGhpcy5wYXJzZU5vZGUobm9kZS5leHByKStcIilcIjtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdzcXJ0JzogcmV0dXJuIFwiTWF0aC5zcXJ0KFwiK3RoaXMucGFyc2VOb2RlKG5vZGUuZXhwcikrXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rb3duIGZ1bmN0aW9uOlwiICsgSlNPTi5zdHJpbmdpZnkobm9kZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgIGNhc2UgJ051bWJlcic6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChub2RlLnZhbHVlLnJlcGxhY2UoJywnLCcuJykpO1xyXG4gICAgICAgIGNhc2UgJ1RydWUnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuICd0cnVlJztcclxuICAgICAgICBjYXNlICdGYWxzZSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2ZhbHNlJztcclxuICAgICAgICBjYXNlICdTdG9wJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiAndGhyb3cgXFwnU3RvcEl0ZXJhdGlvblxcJyc7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIHBhcnNlTm9kZSgpIDpcIiArIEpTT04uc3RyaW5naWZ5KG5vZGUpKTtcclxuICAgIH0gLyogc3dpdGNoIChub2RlLnR5cGUpICovXHJcblxyXG5cclxufTsgLyogZW5kIG9mIHBhcnNlTm9kZSgpICAqL1xyXG4vLyBlbmQgb2YgamF2YXNjcmlwdENvZGVHZW5lcmF0b3IoKVxyXG5cclxuXHJcbmZ1bmN0aW9uIE1vZGVscmVnZWxzRXZhbHVhdG9yKG1vZGVsLCBkZWJ1Zykge1xyXG4gICAgaWYgKHR5cGVvZiBkZWJ1ZyA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICB0aGlzLmRlYnVnID0gZmFsc2U7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZGVidWcgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMubmFtZXNwYWNlID0gbmV3IE5hbWVzcGFjZSgpO1xyXG4gICAgdGhpcy5jb2RlZ2VuZXJhdG9yID0gbmV3IENvZGVHZW5lcmF0b3IodGhpcy5uYW1lc3BhY2UpO1xyXG5cclxuICAgIGlmICh0eXBlb2YgbW9kZWwgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgdGhpcy5tb2RlbCA9IG5ldyBtb2RlbG1vZHVsZS5Nb2RlbCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuZGVidWcpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnKioqIGlucHV0ICoqKicpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMubW9kZWwuc3RhcnR3YWFyZGVuKTtcclxuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLm1vZGVsLm1vZGVscmVnZWxzKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnN0YXJ0d2FhcmRlbl9hc3QgPSBwYXJzZXIucGFyc2UodGhpcy5tb2RlbC5zdGFydHdhYXJkZW4pO1xyXG4gICAgdGhpcy5tb2RlbHJlZ2Vsc19hc3QgPSBwYXJzZXIucGFyc2UodGhpcy5tb2RlbC5tb2RlbHJlZ2Vscyk7XHJcblxyXG4gICAgaWYgKHRoaXMuZGVidWcpIHtcclxuICAgICAgICBjb25zb2xlLmxvZygnKioqIEFTVCBzdGFydHdhYXJkZW4gKioqJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkodGhpcy5zdGFydHdhYXJkZW5fYXN0LCB1bmRlZmluZWQsIDQpKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnKioqIEFTVCBtb2RlbHJlZ2VscyAqKionKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh0aGlzLm1vZGVscmVnZWxzX2FzdCwgdW5kZWZpbmVkLCA0KSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJycpO1xyXG4gICAgfVxyXG5cclxufVxyXG5cclxuTW9kZWxyZWdlbHNFdmFsdWF0b3IucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKE4pIHtcclxuXHJcbiAgICB2YXIgc3RhcnR3YWFyZGVuX2NvZGUgPSB0aGlzLmNvZGVnZW5lcmF0b3IuZ2VuZXJhdGVDb2RlRnJvbUFzdCh0aGlzLnN0YXJ0d2FhcmRlbl9hc3QpO1xyXG4gICAgdGhpcy5uYW1lc3BhY2UubW92ZVN0YXJ0V2FhcmRlbigpOyAvLyBrZWVwIG5hbWVzcGFjZSBjbGVhblxyXG4gICAgdmFyIG1vZGVscmVnZWxzX2NvZGUgPSB0aGlzLmNvZGVnZW5lcmF0b3IuZ2VuZXJhdGVDb2RlRnJvbUFzdCh0aGlzLm1vZGVscmVnZWxzX2FzdCk7XHJcbiAgICB0aGlzLm5hbWVzcGFjZS5zb3J0VmFyTmFtZXMoKTsgLy8gc29ydCB2YXJpYWJsZSBuYW1lcyBmb3IgYmV0dGVyIG91dHB1dFxyXG5cclxuICAgIC8vIHNlcGFyYXRlIGZ1bmN0aW9uIHJ1bl9tb2RlbCgpIGluc2lkZSBhbm9ueW1vdXMgRnVuY3Rpb24oKVxyXG4gICAgLy8gdG8gcHJldmVudCBiYWlsb3V0IG9mIHRoZSBWOCBvcHRpbWlzaW5nIGNvbXBpbGVyIGluIHRyeSB7fSBjYXRjaFxyXG4gICAgdmFyIG1vZGVsID0gICAgIFwiZnVuY3Rpb24gcnVuX21vZGVsKE4sIHN0b3JhZ2UpIHsgXFxuIFwiICtcclxuICAgICAgICAgICAgICAgICAgICBzdGFydHdhYXJkZW5fY29kZSArIFwiXFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29kZWdlbmVyYXRvci5nZW5lcmF0ZVN0YXJ0V2FhcmRlblN0b3JhZ2VDb2RlKCkgK1xyXG4gICAgICAgICAgICAgICAgICAgIFwiICAgIGZvciAodmFyIGk9MTsgaSA8IE47IGkrKykgeyBcXG4gXCIgK1xyXG4gICAgICAgICAgICAgICAgICAgIG1vZGVscmVnZWxzX2NvZGUgKyBcIlxcblwiICtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvZGVnZW5lcmF0b3IuZ2VuZXJhdGVWYXJpYWJsZVN0b3JhZ2VDb2RlKCkgK1xyXG4gICAgICAgICAgICAgICAgICAgIFwiICAgIH0gIFxcblwiICtcclxuICAgICAgICAgICAgICAgICAgICBcIiByZXR1cm47fSBcXG5cIiArXHJcbiAgICAgICAgICAgICAgICAgXCIgICAgdmFyIHJlc3VsdHMgPSBbXTsgXFxuIFwiICtcclxuICAgICAgICAgICAgICAgICBcIiAgICB0cnkgXFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgIFwiICB7IFxcblwiICtcclxuICAgICAgICAgICAgICAgICBcIiAgICAgIHJ1bl9tb2RlbChOLCByZXN1bHRzKTsgXFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgIFwiICB9IGNhdGNoIChlKSBcXG5cIiArXHJcbiAgICAgICAgICAgICAgICAgXCIgIHsgY29uc29sZS5sb2coZSl9IFxcbiBcIiArXHJcbiAgICAgICAgICAgICAgICAgXCJyZXR1cm4gcmVzdWx0cztcXG5cIjtcclxuXHJcbiAgICBpZiAodGhpcy5kZWJ1Zykge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCcqKiogZ2VuZXJhdGVkIGpzICoqKicpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1vZGVsKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhcIioqKiBydW5uaW5nISAqKiogXCIpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTiA9IFwiLCBOKTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgdDEgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgIC8vIGV2YWwobW9kZWwpOyAvLyBzbG93Li4uIGluIGNocm9tZSA+MjNcclxuICAgIC8vICB0aGUgb3B0aW1pc2luZyBjb21waWxlciBkb2VzIG5vdCBvcHRpbWlzZSBldmFsKCkgaW4gbG9jYWwgc2NvcGVcclxuICAgIC8vICBodHRwOi8vbW9kdXNjcmVhdGUuY29tL2phdmFzY3JpcHQtcGVyZm9ybWFuY2UtdGlwcy10cmlja3MvXHJcbiAgICB2YXIgcnVuTW9kZWwgPSBuZXcgRnVuY3Rpb24oJ04nLCBtb2RlbCk7XHJcbiAgICB2YXIgcmVzdWx0ID0gcnVuTW9kZWwoTik7XHJcblxyXG4gICAgdmFyIHQyID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhcIk51bWJlciBvZiBpdGVyYXRpb25zOiBcIiwgcmVzdWx0Lmxlbmd0aCk7XHJcbiAgICBjb25zb2xlLmxvZyhcIlRpbWU6IFwiICsgKHQyIC0gdDEpICsgXCJtc1wiKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG5cclxufTtcclxuXHJcbmV4cG9ydHMuTW9kZWwgPSBtb2RlbG1vZHVsZS5Nb2RlbDsgLy8gZnJvbSBtb2RlbC5qc1xyXG5leHBvcnRzLk1vZGVscmVnZWxzRXZhbHVhdG9yID0gTW9kZWxyZWdlbHNFdmFsdWF0b3I7XHJcbmV4cG9ydHMuQ29kZUdlbmVyYXRvciA9IENvZGVHZW5lcmF0b3I7XHJcbmV4cG9ydHMuTmFtZXNwYWNlID0gTmFtZXNwYWNlO1xyXG4iLCIvKlxyXG4gbW9kZWwuanNcclxuXHJcbiBNb2RlbCBDbGFzc1xyXG5cclxuIHJlYWQgYSBmcm9tIG1vZGVsLnhtbFxyXG4gc3RvcmUgbW9kZWwgaW4gc3RyaW5nIGV0Y1xyXG5cclxuXHJcbiBtb2RlbC54bWwgZXhhbXBsZTpcclxuXHJcbiA8bW9kZWxsZWVydGFhbD5cclxuIDxzdGFydHdhYXJkZW4+XHJcbiAgICAgRm1vdG9yID0gNTAwICdOXHJcbiAgICAgbSA9IDgwMCAna2dcclxuICAgICBkdCA9IDFlLTIgJ3NcclxuICAgICB2ID0gMCdtL3NcclxuICAgICBzID0gMCAnbS9zXHJcbiAgICAgdCA9IDAgJ3NcclxuIDwvc3RhcnR3YWFyZGVuPlxyXG4gPG1vZGVscmVnZWxzPlxyXG4gICAgIEZyZXM9IEZtb3RvclxyXG4gICAgIGEgPSBGcmVzL21cclxuICAgICBkdiA9IGEgKiBkdFxyXG4gICAgIHYgPSB2ICsgZHZcclxuICAgICBkcyA9IHYgKiBkdFxyXG4gICAgIHMgPSBzICsgZHNcclxuICAgICB0ID0gdCArIGR0XHJcbiAgICAgYWxzICgwKVxyXG4gICAgIGRhblxyXG4gICAgICAgU3RvcFxyXG4gICAgIEVpbmRBbHNcclxuIDwvbW9kZWxyZWdlbHM+XHJcblxyXG4gPC9tb2RlbGxlZXJ0YWFsPlxyXG4qL1xyXG5cclxuXHJcbi8vanNoaW50IGVzMzp0cnVlXHJcblxyXG52YXIgZnMgPSByZXF1aXJlKCdmcycpO1xyXG5cclxuZnVuY3Rpb24gTW9kZWwoKSB7XHJcbiAgICB0aGlzLm1vZGVscmVnZWxzID0gJyc7XHJcbiAgICB0aGlzLnN0YXJ0d2FhcmRlbiA9ICcnO1xyXG59XHJcblxyXG5cclxuTW9kZWwucHJvdG90eXBlLnJlYWRCb2d1c1hNTEZpbGUgPSBmdW5jdGlvbihmaWxlbmFtZSkge1xyXG4gICAgLy8gVGhpcyByZWFkIGEgXCJib2d1c1wiIFhNTCBmaWxlIHRoYXQgc3RpbGwgaW5jbHVkZXMgPCBpbnN0ZWFkIG9mICZsdDtcclxuICAgIHZhciBidWYgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUsIFwidXRmOFwiKTtcclxuXHJcbiAgICB0aGlzLnBhcnNlQm9ndXNYTUxTdHJpbmcoYnVmKTtcclxufTtcclxuXHJcbk1vZGVsLnByb3RvdHlwZS5wYXJzZUJvZ3VzWE1MU3RyaW5nID0gZnVuY3Rpb24oeG1sU3RyaW5nKSB7XHJcblxyXG4gICAgdmFyIGFjdGlvbiA9IDA7IC8vIDAgPSBkbyBub3RoaW5nLCAxID0gbW9kZWxyZWdlbHMsIDIgPSBzdGFydHdhYXJkZW5cclxuXHJcbiAgICB0aGlzLnN0YXJ0d2FhcmRlbiA9ICcnO1xyXG4gICAgdGhpcy5tb2RlbHJlZ2VscyA9ICcnO1xyXG5cclxuICAgIHZhciBsaW5lcyA9IHhtbFN0cmluZy5zcGxpdCgnXFxuJyk7XHJcblxyXG4gICAgZm9yKHZhciBsaW5lID0gMTsgbGluZSA8IGxpbmVzLmxlbmd0aDsgbGluZSsrKSB7XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coYWN0aW9uLCBsaW5lc1tsaW5lXSk7XHJcblxyXG4gICAgICAgIHN3aXRjaChsaW5lc1tsaW5lXS5yZXBsYWNlKCdcXHInLCcnKSkge1xyXG4gICAgICAgICAgICAvLyA8IGFuZCA+IG1lc3MgdGhpbmdzIHVwIGluIHRoZSBicm93c2VyXHJcbiAgICAgICAgICAgIGNhc2UgJzxtb2RlbHJlZ2Vscz4nOiB7IGFjdGlvbiA9IDE7IGxpbmVzW2xpbmVdID0gJyc7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgIGNhc2UgJzwvbW9kZWxyZWdlbHM+JzogeyBhY3Rpb24gPSAwOyBicmVhazsgfVxyXG4gICAgICAgICAgICBjYXNlICc8c3RhcnR3YWFyZGVuPic6IHsgYWN0aW9uID0gMjsgbGluZXNbbGluZV0gPSAnJzsgYnJlYWs7IH1cclxuICAgICAgICAgICAgY2FzZSAnPC9zdGFydHdhYXJkZW4+JzogeyBhY3Rpb24gPSAwOyBicmVhazsgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYWN0aW9uPT0xKSB0aGlzLm1vZGVscmVnZWxzICs9IGxpbmVzW2xpbmVdKydcXG4nO1xyXG4gICAgICAgIGlmIChhY3Rpb249PTIpIHRoaXMuc3RhcnR3YWFyZGVuICs9IGxpbmVzW2xpbmVdKydcXG4nO1xyXG4gICAgfVxyXG4gICAgLy9jb25zb2xlLmxvZygnREVCVUc6IGluIG1vZGVsLmpzIHBhcnNlQm9ndXNYTUxTdHJpbmcgZW5kcmVzdWx0IHRoaXMubW9kZWxyZWdlbHM6Jyk7XHJcbiAgICAvL2NvbnNvbGUubG9nKHRoaXMubW9kZWxyZWdlbHMpO1xyXG4gICAgLy9jb25zb2xlLmxvZygnREVCVUc6IGluIG1vZGVsLmpzIHBhcnNlQm9ndXNYTUxTdHJpbmcgZW5kcmVzdWx0IHRoaXMuc3RhcnR3YWFyZGVuOicpO1xyXG4gICAgLy9jb25zb2xlLmxvZyh0aGlzLnN0YXJ0d2FhcmRlbik7XHJcblxyXG59O1xyXG5cclxuTW9kZWwucHJvdG90eXBlLmNyZWF0ZUJvZ3VzWE1MU3RyaW5nID0gZnVuY3Rpb24oKSB7XHJcblxyXG4gICAgcmV0dXJuICc8bW9kZWxsZWVydGFhbD5cXG48c3RhcnR3YWFyZGVuPlxcbicgK1xyXG4gICAgICAgICAgICB0aGlzLnN0YXJ0d2FhcmRlbiArXHJcbiAgICAgICAgICAgICc8L3N0YXJ0d2FhcmRlbj5cXG48bW9kZWxyZWdlbHM+XFxuJyArXHJcbiAgICAgICAgICAgIHRoaXMubW9kZWxyZWdlbHMgK1xyXG4gICAgICAgICAgICAnPC9tb2RlbHJlZ2Vscz5cXG48L21vZGVsbGVlcnRhYWw+XFxuJztcclxufTtcclxuXHJcblxyXG5cclxuZXhwb3J0cy5Nb2RlbCA9IE1vZGVsO1xyXG4iLCIvKiBwYXJzZXIgZ2VuZXJhdGVkIGJ5IGppc29uIDAuNC4xOCAqL1xuLypcbiAgUmV0dXJucyBhIFBhcnNlciBvYmplY3Qgb2YgdGhlIGZvbGxvd2luZyBzdHJ1Y3R1cmU6XG5cbiAgUGFyc2VyOiB7XG4gICAgeXk6IHt9XG4gIH1cblxuICBQYXJzZXIucHJvdG90eXBlOiB7XG4gICAgeXk6IHt9LFxuICAgIHRyYWNlOiBmdW5jdGlvbigpLFxuICAgIHN5bWJvbHNfOiB7YXNzb2NpYXRpdmUgbGlzdDogbmFtZSA9PT4gbnVtYmVyfSxcbiAgICB0ZXJtaW5hbHNfOiB7YXNzb2NpYXRpdmUgbGlzdDogbnVtYmVyID09PiBuYW1lfSxcbiAgICBwcm9kdWN0aW9uc186IFsuLi5dLFxuICAgIHBlcmZvcm1BY3Rpb246IGZ1bmN0aW9uIGFub255bW91cyh5eXRleHQsIHl5bGVuZywgeXlsaW5lbm8sIHl5LCB5eXN0YXRlLCAkJCwgXyQpLFxuICAgIHRhYmxlOiBbLi4uXSxcbiAgICBkZWZhdWx0QWN0aW9uczogey4uLn0sXG4gICAgcGFyc2VFcnJvcjogZnVuY3Rpb24oc3RyLCBoYXNoKSxcbiAgICBwYXJzZTogZnVuY3Rpb24oaW5wdXQpLFxuXG4gICAgbGV4ZXI6IHtcbiAgICAgICAgRU9GOiAxLFxuICAgICAgICBwYXJzZUVycm9yOiBmdW5jdGlvbihzdHIsIGhhc2gpLFxuICAgICAgICBzZXRJbnB1dDogZnVuY3Rpb24oaW5wdXQpLFxuICAgICAgICBpbnB1dDogZnVuY3Rpb24oKSxcbiAgICAgICAgdW5wdXQ6IGZ1bmN0aW9uKHN0ciksXG4gICAgICAgIG1vcmU6IGZ1bmN0aW9uKCksXG4gICAgICAgIGxlc3M6IGZ1bmN0aW9uKG4pLFxuICAgICAgICBwYXN0SW5wdXQ6IGZ1bmN0aW9uKCksXG4gICAgICAgIHVwY29taW5nSW5wdXQ6IGZ1bmN0aW9uKCksXG4gICAgICAgIHNob3dQb3NpdGlvbjogZnVuY3Rpb24oKSxcbiAgICAgICAgdGVzdF9tYXRjaDogZnVuY3Rpb24ocmVnZXhfbWF0Y2hfYXJyYXksIHJ1bGVfaW5kZXgpLFxuICAgICAgICBuZXh0OiBmdW5jdGlvbigpLFxuICAgICAgICBsZXg6IGZ1bmN0aW9uKCksXG4gICAgICAgIGJlZ2luOiBmdW5jdGlvbihjb25kaXRpb24pLFxuICAgICAgICBwb3BTdGF0ZTogZnVuY3Rpb24oKSxcbiAgICAgICAgX2N1cnJlbnRSdWxlczogZnVuY3Rpb24oKSxcbiAgICAgICAgdG9wU3RhdGU6IGZ1bmN0aW9uKCksXG4gICAgICAgIHB1c2hTdGF0ZTogZnVuY3Rpb24oY29uZGl0aW9uKSxcblxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICByYW5nZXM6IGJvb2xlYW4gICAgICAgICAgIChvcHRpb25hbDogdHJ1ZSA9PT4gdG9rZW4gbG9jYXRpb24gaW5mbyB3aWxsIGluY2x1ZGUgYSAucmFuZ2VbXSBtZW1iZXIpXG4gICAgICAgICAgICBmbGV4OiBib29sZWFuICAgICAgICAgICAgIChvcHRpb25hbDogdHJ1ZSA9PT4gZmxleC1saWtlIGxleGluZyBiZWhhdmlvdXIgd2hlcmUgdGhlIHJ1bGVzIGFyZSB0ZXN0ZWQgZXhoYXVzdGl2ZWx5IHRvIGZpbmQgdGhlIGxvbmdlc3QgbWF0Y2gpXG4gICAgICAgICAgICBiYWNrdHJhY2tfbGV4ZXI6IGJvb2xlYW4gIChvcHRpb25hbDogdHJ1ZSA9PT4gbGV4ZXIgcmVnZXhlcyBhcmUgdGVzdGVkIGluIG9yZGVyIGFuZCBmb3IgZWFjaCBtYXRjaGluZyByZWdleCB0aGUgYWN0aW9uIGNvZGUgaXMgaW52b2tlZDsgdGhlIGxleGVyIHRlcm1pbmF0ZXMgdGhlIHNjYW4gd2hlbiBhIHRva2VuIGlzIHJldHVybmVkIGJ5IHRoZSBhY3Rpb24gY29kZSlcbiAgICAgICAgfSxcblxuICAgICAgICBwZXJmb3JtQWN0aW9uOiBmdW5jdGlvbih5eSwgeXlfLCAkYXZvaWRpbmdfbmFtZV9jb2xsaXNpb25zLCBZWV9TVEFSVCksXG4gICAgICAgIHJ1bGVzOiBbLi4uXSxcbiAgICAgICAgY29uZGl0aW9uczoge2Fzc29jaWF0aXZlIGxpc3Q6IG5hbWUgPT0+IHNldH0sXG4gICAgfVxuICB9XG5cblxuICB0b2tlbiBsb2NhdGlvbiBpbmZvIChAJCwgXyQsIGV0Yy4pOiB7XG4gICAgZmlyc3RfbGluZTogbixcbiAgICBsYXN0X2xpbmU6IG4sXG4gICAgZmlyc3RfY29sdW1uOiBuLFxuICAgIGxhc3RfY29sdW1uOiBuLFxuICAgIHJhbmdlOiBbc3RhcnRfbnVtYmVyLCBlbmRfbnVtYmVyXSAgICAgICAod2hlcmUgdGhlIG51bWJlcnMgYXJlIGluZGV4ZXMgaW50byB0aGUgaW5wdXQgc3RyaW5nLCByZWd1bGFyIHplcm8tYmFzZWQpXG4gIH1cblxuXG4gIHRoZSBwYXJzZUVycm9yIGZ1bmN0aW9uIHJlY2VpdmVzIGEgJ2hhc2gnIG9iamVjdCB3aXRoIHRoZXNlIG1lbWJlcnMgZm9yIGxleGVyIGFuZCBwYXJzZXIgZXJyb3JzOiB7XG4gICAgdGV4dDogICAgICAgIChtYXRjaGVkIHRleHQpXG4gICAgdG9rZW46ICAgICAgICh0aGUgcHJvZHVjZWQgdGVybWluYWwgdG9rZW4sIGlmIGFueSlcbiAgICBsaW5lOiAgICAgICAgKHl5bGluZW5vKVxuICB9XG4gIHdoaWxlIHBhcnNlciAoZ3JhbW1hcikgZXJyb3JzIHdpbGwgYWxzbyBwcm92aWRlIHRoZXNlIG1lbWJlcnMsIGkuZS4gcGFyc2VyIGVycm9ycyBkZWxpdmVyIGEgc3VwZXJzZXQgb2YgYXR0cmlidXRlczoge1xuICAgIGxvYzogICAgICAgICAoeXlsbG9jKVxuICAgIGV4cGVjdGVkOiAgICAoc3RyaW5nIGRlc2NyaWJpbmcgdGhlIHNldCBvZiBleHBlY3RlZCB0b2tlbnMpXG4gICAgcmVjb3ZlcmFibGU6IChib29sZWFuOiBUUlVFIHdoZW4gdGhlIHBhcnNlciBoYXMgYSBlcnJvciByZWNvdmVyeSBydWxlIGF2YWlsYWJsZSBmb3IgdGhpcyBwYXJ0aWN1bGFyIGVycm9yKVxuICB9XG4qL1xudmFyIHBhcnNlciA9IChmdW5jdGlvbigpe1xudmFyIG89ZnVuY3Rpb24oayx2LG8sbCl7Zm9yKG89b3x8e30sbD1rLmxlbmd0aDtsLS07b1trW2xdXT12KTtyZXR1cm4gb30sJFYwPVsxLDRdLCRWMT1bMSw1XSwkVjI9WzEsNl0sJFYzPVs1LDcsMTAsMTMsMTRdLCRWND1bMSwyMF0sJFY1PVsxLDE1XSwkVjY9WzEsMTNdLCRWNz1bMSwxNF0sJFY4PVsxLDE2XSwkVjk9WzEsMTddLCRWYT1bMSwxOF0sJFZiPVsxLDE5XSwkVmM9WzEsMjNdLCRWZD1bMSwyNF0sJFZlPVsxLDI1XSwkVmY9WzEsMjZdLCRWZz1bMSwyN10sJFZoPVsxLDI4XSwkVmk9WzEsMjldLCRWaj1bMSwzMF0sJFZrPVsxLDMxXSwkVmw9WzEsMzJdLCRWbT1bNSw3LDEwLDEyLDEzLDE0LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3XSwkVm49WzUsNywxMCwxMiwxMywxNCwxNywyNCwyNV0sJFZvPVs1LDcsMTAsMTIsMTMsMTQsMTcsMjMsMjQsMjUsMjYsMjddLCRWcD1bNSw3LDEwLDEyLDEzLDE0LDE3LDI0LDI1LDI2LDI3XTtcbnZhciBwYXJzZXIgPSB7dHJhY2U6IGZ1bmN0aW9uIHRyYWNlKCkgeyB9LFxueXk6IHt9LFxuc3ltYm9sc186IHtcImVycm9yXCI6MixcInByb2dyYW1cIjozLFwic3RtdF9saXN0XCI6NCxcIkVPRlwiOjUsXCJzdG10XCI6NixcIklERU5UXCI6NyxcIkFTU0lHTlwiOjgsXCJleHByXCI6OSxcIklGXCI6MTAsXCJjb25kaXRpb25cIjoxMSxcIlRIRU5cIjoxMixcIkVORElGXCI6MTMsXCJTVE9QXCI6MTQsXCJkaXJlY3RfZGVjbGFyYXRvclwiOjE1LFwiKFwiOjE2LFwiKVwiOjE3LFwiPT1cIjoxOCxcIj5cIjoxOSxcIj49XCI6MjAsXCI8XCI6MjEsXCI8PVwiOjIyLFwiXlwiOjIzLFwiK1wiOjI0LFwiLVwiOjI1LFwiKlwiOjI2LFwiL1wiOjI3LFwiTk9UXCI6MjgsXCJOVU1CRVJcIjoyOSxcIlBJXCI6MzAsXCJUUlVFXCI6MzEsXCJGQUxTRVwiOjMyLFwiJGFjY2VwdFwiOjAsXCIkZW5kXCI6MX0sXG50ZXJtaW5hbHNfOiB7MjpcImVycm9yXCIsNTpcIkVPRlwiLDc6XCJJREVOVFwiLDg6XCJBU1NJR05cIiwxMDpcIklGXCIsMTI6XCJUSEVOXCIsMTM6XCJFTkRJRlwiLDE0OlwiU1RPUFwiLDE2OlwiKFwiLDE3OlwiKVwiLDE4OlwiPT1cIiwxOTpcIj5cIiwyMDpcIj49XCIsMjE6XCI8XCIsMjI6XCI8PVwiLDIzOlwiXlwiLDI0OlwiK1wiLDI1OlwiLVwiLDI2OlwiKlwiLDI3OlwiL1wiLDI4OlwiTk9UXCIsMjk6XCJOVU1CRVJcIiwzMDpcIlBJXCIsMzE6XCJUUlVFXCIsMzI6XCJGQUxTRVwifSxcbnByb2R1Y3Rpb25zXzogWzAsWzMsMl0sWzQsMV0sWzQsMl0sWzYsM10sWzYsNV0sWzYsMV0sWzExLDFdLFsxNSwxXSxbMTUsNF0sWzksMV0sWzksM10sWzksM10sWzksM10sWzksM10sWzksM10sWzksM10sWzksM10sWzksM10sWzksM10sWzksM10sWzksMl0sWzksMl0sWzksM10sWzksMV0sWzksMV0sWzksMV0sWzksMV1dLFxucGVyZm9ybUFjdGlvbjogZnVuY3Rpb24gYW5vbnltb3VzKHl5dGV4dCwgeXlsZW5nLCB5eWxpbmVubywgeXksIHl5c3RhdGUgLyogYWN0aW9uWzFdICovLCAkJCAvKiB2c3RhY2sgKi8sIF8kIC8qIGxzdGFjayAqLykge1xuLyogdGhpcyA9PSB5eXZhbCAqL1xuXG52YXIgJDAgPSAkJC5sZW5ndGggLSAxO1xuc3dpdGNoICh5eXN0YXRlKSB7XG5jYXNlIDE6XG4gcmV0dXJuKCQkWyQwLTFdKTsgXG5icmVhaztcbmNhc2UgMjpcbiB0aGlzLiQgPSBbJCRbJDBdXTsgXG5icmVhaztcbmNhc2UgMzpcbiAkJFskMC0xXS5wdXNoKCQkWyQwXSk7IHRoaXMuJCA9ICQkWyQwLTFdOyBcbmJyZWFrO1xuY2FzZSA0OlxuIHRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdBc3NpZ25tZW50JyxcclxuICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG5cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcbmJyZWFrO1xuY2FzZSA1OlxuIHRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdJZicsXHJcbiAgICAgICAgICAgICAgICBjb25kOiAkJFskMC0zXSxcclxuICAgICAgICAgICAgICAgIHRoZW46ICQkWyQwLTFdXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXG5icmVhaztcbmNhc2UgNjpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgICB0eXBlOiAnU3RvcCcsXHJcbiAgICAgICAgICAgICAgICAgdmFsdWU6ICQkWyQwXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxuYnJlYWs7XG5jYXNlIDc6IGNhc2UgMTA6XG50aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgODpcbiB0aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdWYXJpYWJsZScsXHJcbiAgICAgICAgICAgICAgICAgIG5hbWU6IHl5dGV4dFxyXG4gICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICBcbmJyZWFrO1xuY2FzZSA5OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgIHR5cGU6ICdGdW5jdGlvbicsXHJcbiAgICAgICAgICAgICAgZnVuYzogJCRbJDAtM10sXHJcbiAgICAgICAgICAgICAgZXhwcjogJCRbJDAtMV1cclxuICAgICAgfTtcclxuICBcbmJyZWFrO1xuY2FzZSAxMTpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgdHlwZTogJ0xvZ2ljYWwnLFxyXG4gICAgICAgICAgICAgICBvcGVyYXRvcjogJz09JyxcclxuICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgIH07XHJcbiAgIFxuYnJlYWs7XG5jYXNlIDEyOlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgIHR5cGU6ICdMb2dpY2FsJyxcclxuICAgICAgICAgICAgICBvcGVyYXRvcjogJz4nLFxyXG4gICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgfTtcclxuICBcbmJyZWFrO1xuY2FzZSAxMzpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdMb2dpY2FsJyxcclxuICAgICAgICAgICAgICAgIG9wZXJhdG9yOiAnPj0nLFxyXG4gICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICAgfTtcclxuICAgIFxuYnJlYWs7XG5jYXNlIDE0OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICB0eXBlOiAnTG9naWNhbCcsXHJcbiAgICAgICAgICAgICAgIG9wZXJhdG9yOiAnPCcsXHJcbiAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICB9O1xyXG4gICBcbmJyZWFrO1xuY2FzZSAxNTpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgICAgdHlwZTogJ0xvZ2ljYWwnLFxyXG4gICAgICAgICAgICAgICAgICBvcGVyYXRvcjogJzw9JyxcclxuICAgICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgICAgIH07XHJcbiAgICAgIFxuYnJlYWs7XG5jYXNlIDE2OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgIHR5cGU6ICdCaW5hcnknLFxyXG4gICAgICAgICAgICAgICAgIG9wZXJhdG9yOiAnXicsXHJcbiAgICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgICAgIH07XHJcbiAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDE3OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ0JpbmFyeScsXHJcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogJysnLFxyXG4gICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIFxuYnJlYWs7XG5jYXNlIDE4OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgIHR5cGU6ICdCaW5hcnknLFxyXG4gICAgICAgICAgICAgICAgIG9wZXJhdG9yOiAnLScsXHJcbiAgICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgICAgIH07XHJcbiAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDE5OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgIHR5cGU6ICdCaW5hcnknLFxyXG4gICAgICAgICAgICAgICAgIG9wZXJhdG9yOiAnKicsXHJcbiAgICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgICAgIH07XHJcbiAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDIwOlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICB0eXBlOiAnQmluYXJ5JyxcclxuICAgICAgICAgICAgICAgb3BlcmF0b3I6ICcvJyxcclxuICAgICAgICAgICAgICAgbGVmdDogJCRbJDAtMl0sXHJcbiAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgICAgfTtcclxuICAgICAgIFxuYnJlYWs7XG5jYXNlIDIxOlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgICB0eXBlOiAnVW5hcnknLFxyXG4gICAgICAgICAgICAgICAgICBvcGVyYXRvcjogJy0nLFxyXG4gICAgICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAyMjpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdVbmFyeScsXHJcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogJ05PVCcsXHJcbiAgICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIFxuYnJlYWs7XG5jYXNlIDIzOlxudGhpcy4kID0gJCRbJDAtMV07XG5icmVhaztcbmNhc2UgMjQ6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdOdW1iZXInLFxyXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogJCRbJDBdXHJcbiAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICBcbmJyZWFrO1xuY2FzZSAyNTpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICB0eXBlOiAnTnVtYmVyJyxcclxuICAgICAgICAgICAgICB2YWx1ZTogXCIzLjE0MTU5MjY1MzU5XCJcclxuICAgICAgICAgIH07XHJcbiAgICAgICBcbmJyZWFrO1xuY2FzZSAyNjpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdUcnVlJyxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiAkJFskMF1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgXG5icmVhaztcbmNhc2UgMjc6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnRmFsc2UnLFxyXG4gICAgICAgICAgICAgICAgdmFsdWU6ICQkWyQwXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICBcbmJyZWFrO1xufVxufSxcbnRhYmxlOiBbezM6MSw0OjIsNjozLDc6JFYwLDEwOiRWMSwxNDokVjJ9LHsxOlszXX0sezU6WzEsN10sNjo4LDc6JFYwLDEwOiRWMSwxNDokVjJ9LG8oJFYzLFsyLDJdKSx7ODpbMSw5XX0sezc6JFY0LDk6MTEsMTE6MTAsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSxvKCRWMyxbMiw2XSksezE6WzIsMV19LG8oJFYzLFsyLDNdKSx7NzokVjQsOToyMSwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHsxMjpbMSwyMl19LHsxMjpbMiw3XSwxODokVmMsMTk6JFZkLDIwOiRWZSwyMTokVmYsMjI6JFZnLDIzOiRWaCwyNDokVmksMjU6JFZqLDI2OiRWaywyNzokVmx9LG8oJFZtLFsyLDEwXSksezc6JFY0LDk6MzMsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTozNCwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjM1LDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sbygkVm0sWzIsMjRdKSxvKCRWbSxbMiwyNV0pLG8oJFZtLFsyLDI2XSksbygkVm0sWzIsMjddKSxvKCRWbSxbMiw4XSx7MTY6WzEsMzZdfSksbygkVjMsWzIsNF0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZoLDI0OiRWaSwyNTokVmosMjY6JFZrLDI3OiRWbH0pLHs0OjM3LDY6Myw3OiRWMCwxMDokVjEsMTQ6JFYyfSx7NzokVjQsOTozOCwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjM5LDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6NDAsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTo0MSwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjQyLDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6NDMsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTo0NCwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjQ1LDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6NDYsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTo0NywxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LG8oJFZuLFsyLDIxXSx7MTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZywyMzokVmgsMjY6JFZrLDI3OiRWbH0pLG8oJFZvLFsyLDIyXSx7MTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZ30pLHsxNzpbMSw0OF0sMTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZywyMzokVmgsMjQ6JFZpLDI1OiRWaiwyNjokVmssMjc6JFZsfSx7NzokVjQsOTo0OSwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs2OjgsNzokVjAsMTA6JFYxLDEzOlsxLDUwXSwxNDokVjJ9LG8oWzUsNywxMCwxMiwxMywxNCwxNywxOCwyMywyNCwyNSwyNiwyN10sWzIsMTFdLHsxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmd9KSxvKCRWbSxbMiwxMl0pLG8oWzUsNywxMCwxMiwxMywxNCwxNywxOCwyMCwyMSwyMiwyMywyNCwyNSwyNiwyN10sWzIsMTNdLHsxOTokVmR9KSxvKFs1LDcsMTAsMTIsMTMsMTQsMTcsMTgsMjEsMjIsMjMsMjQsMjUsMjYsMjddLFsyLDE0XSx7MTk6JFZkLDIwOiRWZX0pLG8oWzUsNywxMCwxMiwxMywxNCwxNywxOCwyMiwyMywyNCwyNSwyNiwyN10sWzIsMTVdLHsxOTokVmQsMjA6JFZlLDIxOiRWZn0pLG8oJFZvLFsyLDE2XSx7MTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZ30pLG8oJFZuLFsyLDE3XSx7MTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZywyMzokVmgsMjY6JFZrLDI3OiRWbH0pLG8oJFZuLFsyLDE4XSx7MTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZywyMzokVmgsMjY6JFZrLDI3OiRWbH0pLG8oJFZwLFsyLDE5XSx7MTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZywyMzokVmh9KSxvKCRWcCxbMiwyMF0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZofSksbygkVm0sWzIsMjNdKSx7MTc6WzEsNTFdLDE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZoLDI0OiRWaSwyNTokVmosMjY6JFZrLDI3OiRWbH0sbygkVjMsWzIsNV0pLG8oJFZtLFsyLDldKV0sXG5kZWZhdWx0QWN0aW9uczogezc6WzIsMV19LFxucGFyc2VFcnJvcjogZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICBpZiAoaGFzaC5yZWNvdmVyYWJsZSkge1xuICAgICAgICB0aGlzLnRyYWNlKHN0cik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKHN0cik7XG4gICAgICAgIGVycm9yLmhhc2ggPSBoYXNoO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG59LFxucGFyc2U6IGZ1bmN0aW9uIHBhcnNlKGlucHV0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLCBzdGFjayA9IFswXSwgdHN0YWNrID0gW10sIHZzdGFjayA9IFtudWxsXSwgbHN0YWNrID0gW10sIHRhYmxlID0gdGhpcy50YWJsZSwgeXl0ZXh0ID0gJycsIHl5bGluZW5vID0gMCwgeXlsZW5nID0gMCwgcmVjb3ZlcmluZyA9IDAsIFRFUlJPUiA9IDIsIEVPRiA9IDE7XG4gICAgdmFyIGFyZ3MgPSBsc3RhY2suc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHZhciBsZXhlciA9IE9iamVjdC5jcmVhdGUodGhpcy5sZXhlcik7XG4gICAgdmFyIHNoYXJlZFN0YXRlID0geyB5eToge30gfTtcbiAgICBmb3IgKHZhciBrIGluIHRoaXMueXkpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLnl5LCBrKSkge1xuICAgICAgICAgICAgc2hhcmVkU3RhdGUueXlba10gPSB0aGlzLnl5W2tdO1xuICAgICAgICB9XG4gICAgfVxuICAgIGxleGVyLnNldElucHV0KGlucHV0LCBzaGFyZWRTdGF0ZS55eSk7XG4gICAgc2hhcmVkU3RhdGUueXkubGV4ZXIgPSBsZXhlcjtcbiAgICBzaGFyZWRTdGF0ZS55eS5wYXJzZXIgPSB0aGlzO1xuICAgIGlmICh0eXBlb2YgbGV4ZXIueXlsbG9jID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGxleGVyLnl5bGxvYyA9IHt9O1xuICAgIH1cbiAgICB2YXIgeXlsb2MgPSBsZXhlci55eWxsb2M7XG4gICAgbHN0YWNrLnB1c2goeXlsb2MpO1xuICAgIHZhciByYW5nZXMgPSBsZXhlci5vcHRpb25zICYmIGxleGVyLm9wdGlvbnMucmFuZ2VzO1xuICAgIGlmICh0eXBlb2Ygc2hhcmVkU3RhdGUueXkucGFyc2VFcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLnBhcnNlRXJyb3IgPSBzaGFyZWRTdGF0ZS55eS5wYXJzZUVycm9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucGFyc2VFcnJvciA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih0aGlzKS5wYXJzZUVycm9yO1xuICAgIH1cbiAgICBmdW5jdGlvbiBwb3BTdGFjayhuKSB7XG4gICAgICAgIHN0YWNrLmxlbmd0aCA9IHN0YWNrLmxlbmd0aCAtIDIgKiBuO1xuICAgICAgICB2c3RhY2subGVuZ3RoID0gdnN0YWNrLmxlbmd0aCAtIG47XG4gICAgICAgIGxzdGFjay5sZW5ndGggPSBsc3RhY2subGVuZ3RoIC0gbjtcbiAgICB9XG4gICAgX3Rva2VuX3N0YWNrOlxuICAgICAgICB2YXIgbGV4ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHRva2VuO1xuICAgICAgICAgICAgdG9rZW4gPSBsZXhlci5sZXgoKSB8fCBFT0Y7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRva2VuICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHRva2VuID0gc2VsZi5zeW1ib2xzX1t0b2tlbl0gfHwgdG9rZW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgICAgIH07XG4gICAgdmFyIHN5bWJvbCwgcHJlRXJyb3JTeW1ib2wsIHN0YXRlLCBhY3Rpb24sIGEsIHIsIHl5dmFsID0ge30sIHAsIGxlbiwgbmV3U3RhdGUsIGV4cGVjdGVkO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHN0YXRlID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXSkge1xuICAgICAgICAgICAgYWN0aW9uID0gdGhpcy5kZWZhdWx0QWN0aW9uc1tzdGF0ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8IHR5cGVvZiBzeW1ib2wgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBzeW1ib2wgPSBsZXgoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjdGlvbiA9IHRhYmxlW3N0YXRlXSAmJiB0YWJsZVtzdGF0ZV1bc3ltYm9sXTtcbiAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdGlvbiA9PT0gJ3VuZGVmaW5lZCcgfHwgIWFjdGlvbi5sZW5ndGggfHwgIWFjdGlvblswXSkge1xuICAgICAgICAgICAgICAgIHZhciBlcnJTdHIgPSAnJztcbiAgICAgICAgICAgICAgICBleHBlY3RlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAocCBpbiB0YWJsZVtzdGF0ZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMudGVybWluYWxzX1twXSAmJiBwID4gVEVSUk9SKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5wdXNoKCdcXCcnICsgdGhpcy50ZXJtaW5hbHNfW3BdICsgJ1xcJycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsZXhlci5zaG93UG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gJ1BhcnNlIGVycm9yIG9uIGxpbmUgJyArICh5eWxpbmVubyArIDEpICsgJzpcXG4nICsgbGV4ZXIuc2hvd1Bvc2l0aW9uKCkgKyAnXFxuRXhwZWN0aW5nICcgKyBleHBlY3RlZC5qb2luKCcsICcpICsgJywgZ290IFxcJycgKyAodGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sKSArICdcXCcnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVyclN0ciA9ICdQYXJzZSBlcnJvciBvbiBsaW5lICcgKyAoeXlsaW5lbm8gKyAxKSArICc6IFVuZXhwZWN0ZWQgJyArIChzeW1ib2wgPT0gRU9GID8gJ2VuZCBvZiBpbnB1dCcgOiAnXFwnJyArICh0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wpICsgJ1xcJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlRXJyb3IoZXJyU3RyLCB7XG4gICAgICAgICAgICAgICAgICAgIHRleHQ6IGxleGVyLm1hdGNoLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sLFxuICAgICAgICAgICAgICAgICAgICBsaW5lOiBsZXhlci55eWxpbmVubyxcbiAgICAgICAgICAgICAgICAgICAgbG9jOiB5eWxvYyxcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIGlmIChhY3Rpb25bMF0gaW5zdGFuY2VvZiBBcnJheSAmJiBhY3Rpb24ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQYXJzZSBFcnJvcjogbXVsdGlwbGUgYWN0aW9ucyBwb3NzaWJsZSBhdCBzdGF0ZTogJyArIHN0YXRlICsgJywgdG9rZW46ICcgKyBzeW1ib2wpO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoYWN0aW9uWzBdKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHN0YWNrLnB1c2goc3ltYm9sKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKGxleGVyLnl5dGV4dCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaChsZXhlci55eWxsb2MpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChhY3Rpb25bMV0pO1xuICAgICAgICAgICAgc3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIGlmICghcHJlRXJyb3JTeW1ib2wpIHtcbiAgICAgICAgICAgICAgICB5eWxlbmcgPSBsZXhlci55eWxlbmc7XG4gICAgICAgICAgICAgICAgeXl0ZXh0ID0gbGV4ZXIueXl0ZXh0O1xuICAgICAgICAgICAgICAgIHl5bGluZW5vID0gbGV4ZXIueXlsaW5lbm87XG4gICAgICAgICAgICAgICAgeXlsb2MgPSBsZXhlci55eWxsb2M7XG4gICAgICAgICAgICAgICAgaWYgKHJlY292ZXJpbmcgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY292ZXJpbmctLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN5bWJvbCA9IHByZUVycm9yU3ltYm9sO1xuICAgICAgICAgICAgICAgIHByZUVycm9yU3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBsZW4gPSB0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzFdO1xuICAgICAgICAgICAgeXl2YWwuJCA9IHZzdGFja1t2c3RhY2subGVuZ3RoIC0gbGVuXTtcbiAgICAgICAgICAgIHl5dmFsLl8kID0ge1xuICAgICAgICAgICAgICAgIGZpcnN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0uZmlyc3RfbGluZSxcbiAgICAgICAgICAgICAgICBsYXN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9saW5lLFxuICAgICAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9jb2x1bW4sXG4gICAgICAgICAgICAgICAgbGFzdF9jb2x1bW46IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9jb2x1bW5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAocmFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgeXl2YWwuXyQucmFuZ2UgPSBbXG4gICAgICAgICAgICAgICAgICAgIGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0ucmFuZ2VbMF0sXG4gICAgICAgICAgICAgICAgICAgIGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ucmFuZ2VbMV1cbiAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgciA9IHRoaXMucGVyZm9ybUFjdGlvbi5hcHBseSh5eXZhbCwgW1xuICAgICAgICAgICAgICAgIHl5dGV4dCxcbiAgICAgICAgICAgICAgICB5eWxlbmcsXG4gICAgICAgICAgICAgICAgeXlsaW5lbm8sXG4gICAgICAgICAgICAgICAgc2hhcmVkU3RhdGUueXksXG4gICAgICAgICAgICAgICAgYWN0aW9uWzFdLFxuICAgICAgICAgICAgICAgIHZzdGFjayxcbiAgICAgICAgICAgICAgICBsc3RhY2tcbiAgICAgICAgICAgIF0uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICBzdGFjayA9IHN0YWNrLnNsaWNlKDAsIC0xICogbGVuICogMik7XG4gICAgICAgICAgICAgICAgdnN0YWNrID0gdnN0YWNrLnNsaWNlKDAsIC0xICogbGVuKTtcbiAgICAgICAgICAgICAgICBsc3RhY2sgPSBsc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhY2sucHVzaCh0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzBdKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKHl5dmFsLiQpO1xuICAgICAgICAgICAgbHN0YWNrLnB1c2goeXl2YWwuXyQpO1xuICAgICAgICAgICAgbmV3U3RhdGUgPSB0YWJsZVtzdGFja1tzdGFjay5sZW5ndGggLSAyXV1bc3RhY2tbc3RhY2subGVuZ3RoIC0gMV1dO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXdTdGF0ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59fTtcbi8qIGdlbmVyYXRlZCBieSBqaXNvbi1sZXggMC4zLjQgKi9cbnZhciBsZXhlciA9IChmdW5jdGlvbigpe1xudmFyIGxleGVyID0gKHtcblxuRU9GOjEsXG5cbnBhcnNlRXJyb3I6ZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICAgICAgaWYgKHRoaXMueXkucGFyc2VyKSB7XG4gICAgICAgICAgICB0aGlzLnl5LnBhcnNlci5wYXJzZUVycm9yKHN0ciwgaGFzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbi8vIHJlc2V0cyB0aGUgbGV4ZXIsIHNldHMgbmV3IGlucHV0XG5zZXRJbnB1dDpmdW5jdGlvbiAoaW5wdXQsIHl5KSB7XG4gICAgICAgIHRoaXMueXkgPSB5eSB8fCB0aGlzLnl5IHx8IHt9O1xuICAgICAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xuICAgICAgICB0aGlzLl9tb3JlID0gdGhpcy5fYmFja3RyYWNrID0gdGhpcy5kb25lID0gZmFsc2U7XG4gICAgICAgIHRoaXMueXlsaW5lbm8gPSB0aGlzLnl5bGVuZyA9IDA7XG4gICAgICAgIHRoaXMueXl0ZXh0ID0gdGhpcy5tYXRjaGVkID0gdGhpcy5tYXRjaCA9ICcnO1xuICAgICAgICB0aGlzLmNvbmRpdGlvblN0YWNrID0gWydJTklUSUFMJ107XG4gICAgICAgIHRoaXMueXlsbG9jID0ge1xuICAgICAgICAgICAgZmlyc3RfbGluZTogMSxcbiAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogMCxcbiAgICAgICAgICAgIGxhc3RfbGluZTogMSxcbiAgICAgICAgICAgIGxhc3RfY29sdW1uOiAwXG4gICAgICAgIH07XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFswLDBdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuLy8gY29uc3VtZXMgYW5kIHJldHVybnMgb25lIGNoYXIgZnJvbSB0aGUgaW5wdXRcbmlucHV0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNoID0gdGhpcy5faW5wdXRbMF07XG4gICAgICAgIHRoaXMueXl0ZXh0ICs9IGNoO1xuICAgICAgICB0aGlzLnl5bGVuZysrO1xuICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICB0aGlzLm1hdGNoICs9IGNoO1xuICAgICAgICB0aGlzLm1hdGNoZWQgKz0gY2g7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLm1hdGNoKC8oPzpcXHJcXG4/fFxcbikuKi9nKTtcbiAgICAgICAgaWYgKGxpbmVzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGluZW5vKys7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5sYXN0X2xpbmUrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfY29sdW1uKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlWzFdKys7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKDEpO1xuICAgICAgICByZXR1cm4gY2g7XG4gICAgfSxcblxuLy8gdW5zaGlmdHMgb25lIGNoYXIgKG9yIGEgc3RyaW5nKSBpbnRvIHRoZSBpbnB1dFxudW5wdXQ6ZnVuY3Rpb24gKGNoKSB7XG4gICAgICAgIHZhciBsZW4gPSBjaC5sZW5ndGg7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLnNwbGl0KC8oPzpcXHJcXG4/fFxcbikvZyk7XG5cbiAgICAgICAgdGhpcy5faW5wdXQgPSBjaCArIHRoaXMuX2lucHV0O1xuICAgICAgICB0aGlzLnl5dGV4dCA9IHRoaXMueXl0ZXh0LnN1YnN0cigwLCB0aGlzLnl5dGV4dC5sZW5ndGggLSBsZW4pO1xuICAgICAgICAvL3RoaXMueXlsZW5nIC09IGxlbjtcbiAgICAgICAgdGhpcy5vZmZzZXQgLT0gbGVuO1xuICAgICAgICB2YXIgb2xkTGluZXMgPSB0aGlzLm1hdGNoLnNwbGl0KC8oPzpcXHJcXG4/fFxcbikvZyk7XG4gICAgICAgIHRoaXMubWF0Y2ggPSB0aGlzLm1hdGNoLnN1YnN0cigwLCB0aGlzLm1hdGNoLmxlbmd0aCAtIDEpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoZWQuc3Vic3RyKDAsIHRoaXMubWF0Y2hlZC5sZW5ndGggLSAxKTtcblxuICAgICAgICBpZiAobGluZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgdGhpcy55eWxpbmVubyAtPSBsaW5lcy5sZW5ndGggLSAxO1xuICAgICAgICB9XG4gICAgICAgIHZhciByID0gdGhpcy55eWxsb2MucmFuZ2U7XG5cbiAgICAgICAgdGhpcy55eWxsb2MgPSB7XG4gICAgICAgICAgICBmaXJzdF9saW5lOiB0aGlzLnl5bGxvYy5maXJzdF9saW5lLFxuICAgICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vICsgMSxcbiAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uLFxuICAgICAgICAgICAgbGFzdF9jb2x1bW46IGxpbmVzID9cbiAgICAgICAgICAgICAgICAobGluZXMubGVuZ3RoID09PSBvbGRMaW5lcy5sZW5ndGggPyB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gOiAwKVxuICAgICAgICAgICAgICAgICArIG9sZExpbmVzW29sZExpbmVzLmxlbmd0aCAtIGxpbmVzLmxlbmd0aF0ubGVuZ3RoIC0gbGluZXNbMF0ubGVuZ3RoIDpcbiAgICAgICAgICAgICAgdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uIC0gbGVuXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3JbMF0sIHJbMF0gKyB0aGlzLnl5bGVuZyAtIGxlbl07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy55eWxlbmcgPSB0aGlzLnl5dGV4dC5sZW5ndGg7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbi8vIFdoZW4gY2FsbGVkIGZyb20gYWN0aW9uLCBjYWNoZXMgbWF0Y2hlZCB0ZXh0IGFuZCBhcHBlbmRzIGl0IG9uIG5leHQgYWN0aW9uXG5tb3JlOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbi8vIFdoZW4gY2FsbGVkIGZyb20gYWN0aW9uLCBzaWduYWxzIHRoZSBsZXhlciB0aGF0IHRoaXMgcnVsZSBmYWlscyB0byBtYXRjaCB0aGUgaW5wdXQsIHNvIHRoZSBuZXh0IG1hdGNoaW5nIHJ1bGUgKHJlZ2V4KSBzaG91bGQgYmUgdGVzdGVkIGluc3RlYWQuXG5yZWplY3Q6ZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJhY2t0cmFja19sZXhlcikge1xuICAgICAgICAgICAgdGhpcy5fYmFja3RyYWNrID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXJyb3IoJ0xleGljYWwgZXJyb3Igb24gbGluZSAnICsgKHRoaXMueXlsaW5lbm8gKyAxKSArICcuIFlvdSBjYW4gb25seSBpbnZva2UgcmVqZWN0KCkgaW4gdGhlIGxleGVyIHdoZW4gdGhlIGxleGVyIGlzIG9mIHRoZSBiYWNrdHJhY2tpbmcgcGVyc3Vhc2lvbiAob3B0aW9ucy5iYWNrdHJhY2tfbGV4ZXIgPSB0cnVlKS5cXG4nICsgdGhpcy5zaG93UG9zaXRpb24oKSwge1xuICAgICAgICAgICAgICAgIHRleHQ6IFwiXCIsXG4gICAgICAgICAgICAgICAgdG9rZW46IG51bGwsXG4gICAgICAgICAgICAgICAgbGluZTogdGhpcy55eWxpbmVub1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4vLyByZXRhaW4gZmlyc3QgbiBjaGFyYWN0ZXJzIG9mIHRoZSBtYXRjaFxubGVzczpmdW5jdGlvbiAobikge1xuICAgICAgICB0aGlzLnVucHV0KHRoaXMubWF0Y2guc2xpY2UobikpO1xuICAgIH0sXG5cbi8vIGRpc3BsYXlzIGFscmVhZHkgbWF0Y2hlZCBpbnB1dCwgaS5lLiBmb3IgZXJyb3IgbWVzc2FnZXNcbnBhc3RJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwYXN0ID0gdGhpcy5tYXRjaGVkLnN1YnN0cigwLCB0aGlzLm1hdGNoZWQubGVuZ3RoIC0gdGhpcy5tYXRjaC5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gKHBhc3QubGVuZ3RoID4gMjAgPyAnLi4uJzonJykgKyBwYXN0LnN1YnN0cigtMjApLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxuXG4vLyBkaXNwbGF5cyB1cGNvbWluZyBpbnB1dCwgaS5lLiBmb3IgZXJyb3IgbWVzc2FnZXNcbnVwY29taW5nSW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMubWF0Y2g7XG4gICAgICAgIGlmIChuZXh0Lmxlbmd0aCA8IDIwKSB7XG4gICAgICAgICAgICBuZXh0ICs9IHRoaXMuX2lucHV0LnN1YnN0cigwLCAyMC1uZXh0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChuZXh0LnN1YnN0cigwLDIwKSArIChuZXh0Lmxlbmd0aCA+IDIwID8gJy4uLicgOiAnJykpLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxuXG4vLyBkaXNwbGF5cyB0aGUgY2hhcmFjdGVyIHBvc2l0aW9uIHdoZXJlIHRoZSBsZXhpbmcgZXJyb3Igb2NjdXJyZWQsIGkuZS4gZm9yIGVycm9yIG1lc3NhZ2VzXG5zaG93UG9zaXRpb246ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcHJlID0gdGhpcy5wYXN0SW5wdXQoKTtcbiAgICAgICAgdmFyIGMgPSBuZXcgQXJyYXkocHJlLmxlbmd0aCArIDEpLmpvaW4oXCItXCIpO1xuICAgICAgICByZXR1cm4gcHJlICsgdGhpcy51cGNvbWluZ0lucHV0KCkgKyBcIlxcblwiICsgYyArIFwiXlwiO1xuICAgIH0sXG5cbi8vIHRlc3QgdGhlIGxleGVkIHRva2VuOiByZXR1cm4gRkFMU0Ugd2hlbiBub3QgYSBtYXRjaCwgb3RoZXJ3aXNlIHJldHVybiB0b2tlblxudGVzdF9tYXRjaDpmdW5jdGlvbiAobWF0Y2gsIGluZGV4ZWRfcnVsZSkge1xuICAgICAgICB2YXIgdG9rZW4sXG4gICAgICAgICAgICBsaW5lcyxcbiAgICAgICAgICAgIGJhY2t1cDtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJhY2t0cmFja19sZXhlcikge1xuICAgICAgICAgICAgLy8gc2F2ZSBjb250ZXh0XG4gICAgICAgICAgICBiYWNrdXAgPSB7XG4gICAgICAgICAgICAgICAgeXlsaW5lbm86IHRoaXMueXlsaW5lbm8sXG4gICAgICAgICAgICAgICAgeXlsbG9jOiB7XG4gICAgICAgICAgICAgICAgICAgIGZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmZpcnN0X2xpbmUsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RfbGluZTogdGhpcy5sYXN0X2xpbmUsXG4gICAgICAgICAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uLFxuICAgICAgICAgICAgICAgICAgICBsYXN0X2NvbHVtbjogdGhpcy55eWxsb2MubGFzdF9jb2x1bW5cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHl5dGV4dDogdGhpcy55eXRleHQsXG4gICAgICAgICAgICAgICAgbWF0Y2g6IHRoaXMubWF0Y2gsXG4gICAgICAgICAgICAgICAgbWF0Y2hlczogdGhpcy5tYXRjaGVzLFxuICAgICAgICAgICAgICAgIG1hdGNoZWQ6IHRoaXMubWF0Y2hlZCxcbiAgICAgICAgICAgICAgICB5eWxlbmc6IHRoaXMueXlsZW5nLFxuICAgICAgICAgICAgICAgIG9mZnNldDogdGhpcy5vZmZzZXQsXG4gICAgICAgICAgICAgICAgX21vcmU6IHRoaXMuX21vcmUsXG4gICAgICAgICAgICAgICAgX2lucHV0OiB0aGlzLl9pbnB1dCxcbiAgICAgICAgICAgICAgICB5eTogdGhpcy55eSxcbiAgICAgICAgICAgICAgICBjb25kaXRpb25TdGFjazogdGhpcy5jb25kaXRpb25TdGFjay5zbGljZSgwKSxcbiAgICAgICAgICAgICAgICBkb25lOiB0aGlzLmRvbmVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgICAgIGJhY2t1cC55eWxsb2MucmFuZ2UgPSB0aGlzLnl5bGxvYy5yYW5nZS5zbGljZSgwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxpbmVzID0gbWF0Y2hbMF0ubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICBpZiAobGluZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsaW5lbm8gKz0gbGluZXMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMueXlsbG9jID0ge1xuICAgICAgICAgICAgZmlyc3RfbGluZTogdGhpcy55eWxsb2MubGFzdF9saW5lLFxuICAgICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vICsgMSxcbiAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MubGFzdF9jb2x1bW4sXG4gICAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgP1xuICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCAtIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLm1hdGNoKC9cXHI/XFxuPy8pWzBdLmxlbmd0aCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy55eWxsb2MubGFzdF9jb2x1bW4gKyBtYXRjaFswXS5sZW5ndGhcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy55eXRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgIHRoaXMubWF0Y2ggKz0gbWF0Y2hbMF07XG4gICAgICAgIHRoaXMubWF0Y2hlcyA9IG1hdGNoO1xuICAgICAgICB0aGlzLnl5bGVuZyA9IHRoaXMueXl0ZXh0Lmxlbmd0aDtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3RoaXMub2Zmc2V0LCB0aGlzLm9mZnNldCArPSB0aGlzLnl5bGVuZ107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbW9yZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9iYWNrdHJhY2sgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faW5wdXQgPSB0aGlzLl9pbnB1dC5zbGljZShtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgKz0gbWF0Y2hbMF07XG4gICAgICAgIHRva2VuID0gdGhpcy5wZXJmb3JtQWN0aW9uLmNhbGwodGhpcywgdGhpcy55eSwgdGhpcywgaW5kZXhlZF9ydWxlLCB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoIC0gMV0pO1xuICAgICAgICBpZiAodGhpcy5kb25lICYmIHRoaXMuX2lucHV0KSB7XG4gICAgICAgICAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB0b2tlbjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9iYWNrdHJhY2spIHtcbiAgICAgICAgICAgIC8vIHJlY292ZXIgY29udGV4dFxuICAgICAgICAgICAgZm9yICh2YXIgayBpbiBiYWNrdXApIHtcbiAgICAgICAgICAgICAgICB0aGlzW2tdID0gYmFja3VwW2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBydWxlIGFjdGlvbiBjYWxsZWQgcmVqZWN0KCkgaW1wbHlpbmcgdGhlIG5leHQgcnVsZSBzaG91bGQgYmUgdGVzdGVkIGluc3RlYWQuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbi8vIHJldHVybiBuZXh0IG1hdGNoIGluIGlucHV0XG5uZXh0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5faW5wdXQpIHtcbiAgICAgICAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdG9rZW4sXG4gICAgICAgICAgICBtYXRjaCxcbiAgICAgICAgICAgIHRlbXBNYXRjaCxcbiAgICAgICAgICAgIGluZGV4O1xuICAgICAgICBpZiAoIXRoaXMuX21vcmUpIHtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ID0gJyc7XG4gICAgICAgICAgICB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJ1bGVzID0gdGhpcy5fY3VycmVudFJ1bGVzKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRlbXBNYXRjaCA9IHRoaXMuX2lucHV0Lm1hdGNoKHRoaXMucnVsZXNbcnVsZXNbaV1dKTtcbiAgICAgICAgICAgIGlmICh0ZW1wTWF0Y2ggJiYgKCFtYXRjaCB8fCB0ZW1wTWF0Y2hbMF0ubGVuZ3RoID4gbWF0Y2hbMF0ubGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoID0gdGVtcE1hdGNoO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJhY2t0cmFja19sZXhlcikge1xuICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHRoaXMudGVzdF9tYXRjaCh0ZW1wTWF0Y2gsIHJ1bGVzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRva2VuICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JhY2t0cmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvLyBydWxlIGFjdGlvbiBjYWxsZWQgcmVqZWN0KCkgaW1wbHlpbmcgYSBydWxlIE1JU21hdGNoLlxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZWxzZTogdGhpcyBpcyBhIGxleGVyIHJ1bGUgd2hpY2ggY29uc3VtZXMgaW5wdXQgd2l0aG91dCBwcm9kdWNpbmcgYSB0b2tlbiAoZS5nLiB3aGl0ZXNwYWNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vcHRpb25zLmZsZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLnRlc3RfbWF0Y2gobWF0Y2gsIHJ1bGVzW2luZGV4XSk7XG4gICAgICAgICAgICBpZiAodG9rZW4gIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZWxzZTogdGhpcyBpcyBhIGxleGVyIHJ1bGUgd2hpY2ggY29uc3VtZXMgaW5wdXQgd2l0aG91dCBwcm9kdWNpbmcgYSB0b2tlbiAoZS5nLiB3aGl0ZXNwYWNlKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9pbnB1dCA9PT0gXCJcIikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFcnJvcignTGV4aWNhbCBlcnJvciBvbiBsaW5lICcgKyAodGhpcy55eWxpbmVubyArIDEpICsgJy4gVW5yZWNvZ25pemVkIHRleHQuXFxuJyArIHRoaXMuc2hvd1Bvc2l0aW9uKCksIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIlwiLFxuICAgICAgICAgICAgICAgIHRva2VuOiBudWxsLFxuICAgICAgICAgICAgICAgIGxpbmU6IHRoaXMueXlsaW5lbm9cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSxcblxuLy8gcmV0dXJuIG5leHQgbWF0Y2ggdGhhdCBoYXMgYSB0b2tlblxubGV4OmZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgdmFyIHIgPSB0aGlzLm5leHQoKTtcbiAgICAgICAgaWYgKHIpIHtcbiAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGV4KCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4vLyBhY3RpdmF0ZXMgYSBuZXcgbGV4ZXIgY29uZGl0aW9uIHN0YXRlIChwdXNoZXMgdGhlIG5ldyBsZXhlciBjb25kaXRpb24gc3RhdGUgb250byB0aGUgY29uZGl0aW9uIHN0YWNrKVxuYmVnaW46ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sucHVzaChjb25kaXRpb24pO1xuICAgIH0sXG5cbi8vIHBvcCB0aGUgcHJldmlvdXNseSBhY3RpdmUgbGV4ZXIgY29uZGl0aW9uIHN0YXRlIG9mZiB0aGUgY29uZGl0aW9uIHN0YWNrXG5wb3BTdGF0ZTpmdW5jdGlvbiBwb3BTdGF0ZSgpIHtcbiAgICAgICAgdmFyIG4gPSB0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aCAtIDE7XG4gICAgICAgIGlmIChuID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFja1swXTtcbiAgICAgICAgfVxuICAgIH0sXG5cbi8vIHByb2R1Y2UgdGhlIGxleGVyIHJ1bGUgc2V0IHdoaWNoIGlzIGFjdGl2ZSBmb3IgdGhlIGN1cnJlbnRseSBhY3RpdmUgbGV4ZXIgY29uZGl0aW9uIHN0YXRlXG5fY3VycmVudFJ1bGVzOmZ1bmN0aW9uIF9jdXJyZW50UnVsZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aCAmJiB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoIC0gMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvbnNbdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aCAtIDFdXS5ydWxlcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvbnNbXCJJTklUSUFMXCJdLnJ1bGVzO1xuICAgICAgICB9XG4gICAgfSxcblxuLy8gcmV0dXJuIHRoZSBjdXJyZW50bHkgYWN0aXZlIGxleGVyIGNvbmRpdGlvbiBzdGF0ZTsgd2hlbiBhbiBpbmRleCBhcmd1bWVudCBpcyBwcm92aWRlZCBpdCBwcm9kdWNlcyB0aGUgTi10aCBwcmV2aW91cyBjb25kaXRpb24gc3RhdGUsIGlmIGF2YWlsYWJsZVxudG9wU3RhdGU6ZnVuY3Rpb24gdG9wU3RhdGUobikge1xuICAgICAgICBuID0gdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGggLSAxIC0gTWF0aC5hYnMobiB8fCAwKTtcbiAgICAgICAgaWYgKG4gPj0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2tbbl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gXCJJTklUSUFMXCI7XG4gICAgICAgIH1cbiAgICB9LFxuXG4vLyBhbGlhcyBmb3IgYmVnaW4oY29uZGl0aW9uKVxucHVzaFN0YXRlOmZ1bmN0aW9uIHB1c2hTdGF0ZShjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5iZWdpbihjb25kaXRpb24pO1xuICAgIH0sXG5cbi8vIHJldHVybiB0aGUgbnVtYmVyIG9mIHN0YXRlcyBjdXJyZW50bHkgb24gdGhlIHN0YWNrXG5zdGF0ZVN0YWNrU2l6ZTpmdW5jdGlvbiBzdGF0ZVN0YWNrU2l6ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoO1xuICAgIH0sXG5vcHRpb25zOiB7XCJjYXNlLWluc2Vuc2l0aXZlXCI6dHJ1ZX0sXG5wZXJmb3JtQWN0aW9uOiBmdW5jdGlvbiBhbm9ueW1vdXMoeXkseXlfLCRhdm9pZGluZ19uYW1lX2NvbGxpc2lvbnMsWVlfU1RBUlQpIHtcbnZhciBZWVNUQVRFPVlZX1NUQVJUO1xuc3dpdGNoKCRhdm9pZGluZ19uYW1lX2NvbGxpc2lvbnMpIHtcbmNhc2UgMDovKiBpZ25vcmUgd2hpdGVzcGFjZXMgKi9cbmJyZWFrO1xuY2FzZSAxOi8qIGlnbm9yZSB3aGl0ZXNwYWNlcyAqL1xuYnJlYWs7XG5jYXNlIDI6LyogbW9kZWxsZWVydGFhbCBjb21tZW50ICovXG5icmVhaztcbmNhc2UgMzovKiBDLXN0eWxlIG11bHRpbGluZSBjb21tZW50ICovXG5icmVhaztcbmNhc2UgNDovKiBDLXN0eWxlIGNvbW1lbnQgKi9cbmJyZWFrO1xuY2FzZSA1Oi8qIFB5dGhvbiBzdHlsZSBjb21tZW50ICovXG5icmVhaztcbmNhc2UgNjpyZXR1cm4gMTZcbmJyZWFrO1xuY2FzZSA3OnJldHVybiAxN1xuYnJlYWs7XG5jYXNlIDg6cmV0dXJuIDMwXG5icmVhaztcbmNhc2UgOTpyZXR1cm4gMThcbmJyZWFrO1xuY2FzZSAxMDpyZXR1cm4gMjBcbmJyZWFrO1xuY2FzZSAxMTpyZXR1cm4gMjJcbmJyZWFrO1xuY2FzZSAxMjpyZXR1cm4gMTlcbmJyZWFrO1xuY2FzZSAxMzpyZXR1cm4gMjFcbmJyZWFrO1xuY2FzZSAxNDpyZXR1cm4gMjhcbmJyZWFrO1xuY2FzZSAxNTpyZXR1cm4gMzJcbmJyZWFrO1xuY2FzZSAxNjpyZXR1cm4gMzFcbmJyZWFrO1xuY2FzZSAxNzpyZXR1cm4gOFxuYnJlYWs7XG5jYXNlIDE4OnJldHVybiA4XG5icmVhaztcbmNhc2UgMTk6cmV0dXJuIDI5XG5icmVhaztcbmNhc2UgMjA6cmV0dXJuIDI5XG5icmVhaztcbmNhc2UgMjE6cmV0dXJuIDI5XG5icmVhaztcbmNhc2UgMjI6cmV0dXJuIDIzXG5icmVhaztcbmNhc2UgMjM6cmV0dXJuIDI0XG5icmVhaztcbmNhc2UgMjQ6cmV0dXJuIDI1XG5icmVhaztcbmNhc2UgMjU6cmV0dXJuIDI2XG5icmVhaztcbmNhc2UgMjY6cmV0dXJuIDI3XG5icmVhaztcbmNhc2UgMjc6cmV0dXJuIDEzXG5icmVhaztcbmNhc2UgMjg6cmV0dXJuIDEwXG5icmVhaztcbmNhc2UgMjk6cmV0dXJuIDEyXG5icmVhaztcbmNhc2UgMzA6cmV0dXJuIDE0XG5icmVhaztcbmNhc2UgMzE6cmV0dXJuIDdcbmJyZWFrO1xuY2FzZSAzMjpyZXR1cm4gNVxuYnJlYWs7XG59XG59LFxucnVsZXM6IFsvXig/OlxccyspL2ksL14oPzpcXHQrKS9pLC9eKD86J1teXFxuXSopL2ksL14oPzpcXC9cXCooLnxcXG58XFxyKSo/XFwqXFwvKS9pLC9eKD86XFwvXFwvW15cXG5dKikvaSwvXig/OiNbXlxcbl0qKS9pLC9eKD86XFwoKS9pLC9eKD86XFwpKS9pLC9eKD86cGlcXGIpL2ksL14oPzo9PSkvaSwvXig/Oj49KS9pLC9eKD86PD0pL2ksL14oPzo+KS9pLC9eKD86PCkvaSwvXig/OiF8bmlldFxcYikvaSwvXig/Om9ud2FhclxcYikvaSwvXig/OndhYXJcXGIpL2ksL14oPzo9KS9pLC9eKD86Oj0pL2ksL14oPzpbMC05XSpbXCIuXCJcIixcIl1bMC05XSsoW0VlXVsrLV0/WzAtOV0rKT8pL2ksL14oPzpbMC05XStbXCIuXCJcIixcIl1bMC05XSooW0VlXVsrLV0/WzAtOV0rKT8pL2ksL14oPzpbMC05XSsoW0VlXVsrLV0/WzAtOV0rKT8pL2ksL14oPzpcXF4pL2ksL14oPzpcXCspL2ksL14oPzotKS9pLC9eKD86XFwqKS9pLC9eKD86XFwvKS9pLC9eKD86ZWluZGFsc1xcYikvaSwvXig/OmFsc1xcYikvaSwvXig/OmRhblxcYikvaSwvXig/OnN0b3BcXGIpL2ksL14oPzpbYS16QS1aXVthLXpBLVowLTlfXCJcXF1cIlwiXFx8XCJ7fVwiW1wiXSopL2ksL14oPzokKS9pXSxcbmNvbmRpdGlvbnM6IHtcIklOSVRJQUxcIjp7XCJydWxlc1wiOlswLDEsMiwzLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDI5LDMwLDMxLDMyXSxcImluY2x1c2l2ZVwiOnRydWV9fVxufSk7XG5yZXR1cm4gbGV4ZXI7XG59KSgpO1xucGFyc2VyLmxleGVyID0gbGV4ZXI7XG5mdW5jdGlvbiBQYXJzZXIgKCkge1xuICB0aGlzLnl5ID0ge307XG59XG5QYXJzZXIucHJvdG90eXBlID0gcGFyc2VyO3BhcnNlci5QYXJzZXIgPSBQYXJzZXI7XG5yZXR1cm4gbmV3IFBhcnNlcjtcbn0pKCk7XG5cblxuaWYgKHR5cGVvZiByZXF1aXJlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbmV4cG9ydHMucGFyc2VyID0gcGFyc2VyO1xuZXhwb3J0cy5QYXJzZXIgPSBwYXJzZXIuUGFyc2VyO1xuZXhwb3J0cy5wYXJzZSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHBhcnNlci5wYXJzZS5hcHBseShwYXJzZXIsIGFyZ3VtZW50cyk7IH07XG5leHBvcnRzLm1haW4gPSBmdW5jdGlvbiBjb21tb25qc01haW4oYXJncykge1xuICAgIGlmICghYXJnc1sxXSkge1xuICAgICAgICBjb25zb2xlLmxvZygnVXNhZ2U6ICcrYXJnc1swXSsnIEZJTEUnKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cbiAgICB2YXIgc291cmNlID0gcmVxdWlyZSgnZnMnKS5yZWFkRmlsZVN5bmMocmVxdWlyZSgncGF0aCcpLm5vcm1hbGl6ZShhcmdzWzFdKSwgXCJ1dGY4XCIpO1xuICAgIHJldHVybiBleHBvcnRzLnBhcnNlci5wYXJzZShzb3VyY2UpO1xufTtcbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiByZXF1aXJlLm1haW4gPT09IG1vZHVsZSkge1xuICBleHBvcnRzLm1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDEpKTtcbn1cbn0iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyByZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggYXJyYXkgd2l0aCBkaXJlY3RvcnkgbmFtZXMgdGhlcmVcbi8vIG11c3QgYmUgbm8gc2xhc2hlcywgZW1wdHkgZWxlbWVudHMsIG9yIGRldmljZSBuYW1lcyAoYzpcXCkgaW4gdGhlIGFycmF5XG4vLyAoc28gYWxzbyBubyBsZWFkaW5nIGFuZCB0cmFpbGluZyBzbGFzaGVzIC0gaXQgZG9lcyBub3QgZGlzdGluZ3Vpc2hcbi8vIHJlbGF0aXZlIGFuZCBhYnNvbHV0ZSBwYXRocylcbmZ1bmN0aW9uIG5vcm1hbGl6ZUFycmF5KHBhcnRzLCBhbGxvd0Fib3ZlUm9vdCkge1xuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gcGFydHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICB2YXIgbGFzdCA9IHBhcnRzW2ldO1xuICAgIGlmIChsYXN0ID09PSAnLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICB9IGVsc2UgaWYgKGxhc3QgPT09ICcuLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXAtLTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gIGlmIChhbGxvd0Fib3ZlUm9vdCkge1xuICAgIGZvciAoOyB1cC0tOyB1cCkge1xuICAgICAgcGFydHMudW5zaGlmdCgnLi4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFydHM7XG59XG5cbi8vIFNwbGl0IGEgZmlsZW5hbWUgaW50byBbcm9vdCwgZGlyLCBiYXNlbmFtZSwgZXh0XSwgdW5peCB2ZXJzaW9uXG4vLyAncm9vdCcgaXMganVzdCBhIHNsYXNoLCBvciBub3RoaW5nLlxudmFyIHNwbGl0UGF0aFJlID1cbiAgICAvXihcXC8/fCkoW1xcc1xcU10qPykoKD86XFwuezEsMn18W15cXC9dKz98KShcXC5bXi5cXC9dKnwpKSg/OltcXC9dKikkLztcbnZhciBzcGxpdFBhdGggPSBmdW5jdGlvbihmaWxlbmFtZSkge1xuICByZXR1cm4gc3BsaXRQYXRoUmUuZXhlYyhmaWxlbmFtZSkuc2xpY2UoMSk7XG59O1xuXG4vLyBwYXRoLnJlc29sdmUoW2Zyb20gLi4uXSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHJlc29sdmVkUGF0aCA9ICcnLFxuICAgICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+PSAtMSAmJiAhcmVzb2x2ZWRBYnNvbHV0ZTsgaS0tKSB7XG4gICAgdmFyIHBhdGggPSAoaSA+PSAwKSA/IGFyZ3VtZW50c1tpXSA6IHByb2Nlc3MuY3dkKCk7XG5cbiAgICAvLyBTa2lwIGVtcHR5IGFuZCBpbnZhbGlkIGVudHJpZXNcbiAgICBpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5yZXNvbHZlIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH0gZWxzZSBpZiAoIXBhdGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHJlc29sdmVkUGF0aCA9IHBhdGggKyAnLycgKyByZXNvbHZlZFBhdGg7XG4gICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IHBhdGguY2hhckF0KDApID09PSAnLyc7XG4gIH1cblxuICAvLyBBdCB0aGlzIHBvaW50IHRoZSBwYXRoIHNob3VsZCBiZSByZXNvbHZlZCB0byBhIGZ1bGwgYWJzb2x1dGUgcGF0aCwgYnV0XG4gIC8vIGhhbmRsZSByZWxhdGl2ZSBwYXRocyB0byBiZSBzYWZlIChtaWdodCBoYXBwZW4gd2hlbiBwcm9jZXNzLmN3ZCgpIGZhaWxzKVxuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICByZXNvbHZlZFBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocmVzb2x2ZWRQYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIXJlc29sdmVkQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICByZXR1cm4gKChyZXNvbHZlZEFic29sdXRlID8gJy8nIDogJycpICsgcmVzb2x2ZWRQYXRoKSB8fCAnLic7XG59O1xuXG4vLyBwYXRoLm5vcm1hbGl6ZShwYXRoKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5ub3JtYWxpemUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciBpc0Fic29sdXRlID0gZXhwb3J0cy5pc0Fic29sdXRlKHBhdGgpLFxuICAgICAgdHJhaWxpbmdTbGFzaCA9IHN1YnN0cihwYXRoLCAtMSkgPT09ICcvJztcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihwYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIWlzQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICBpZiAoIXBhdGggJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBwYXRoID0gJy4nO1xuICB9XG4gIGlmIChwYXRoICYmIHRyYWlsaW5nU2xhc2gpIHtcbiAgICBwYXRoICs9ICcvJztcbiAgfVxuXG4gIHJldHVybiAoaXNBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHBhdGg7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmlzQWJzb2x1dGUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5qb2luID0gZnVuY3Rpb24oKSB7XG4gIHZhciBwYXRocyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gIHJldHVybiBleHBvcnRzLm5vcm1hbGl6ZShmaWx0ZXIocGF0aHMsIGZ1bmN0aW9uKHAsIGluZGV4KSB7XG4gICAgaWYgKHR5cGVvZiBwICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGguam9pbiBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH0pLmpvaW4oJy8nKSk7XG59O1xuXG5cbi8vIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlbGF0aXZlID0gZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgZnJvbSA9IGV4cG9ydHMucmVzb2x2ZShmcm9tKS5zdWJzdHIoMSk7XG4gIHRvID0gZXhwb3J0cy5yZXNvbHZlKHRvKS5zdWJzdHIoMSk7XG5cbiAgZnVuY3Rpb24gdHJpbShhcnIpIHtcbiAgICB2YXIgc3RhcnQgPSAwO1xuICAgIGZvciAoOyBzdGFydCA8IGFyci5sZW5ndGg7IHN0YXJ0KyspIHtcbiAgICAgIGlmIChhcnJbc3RhcnRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgdmFyIGVuZCA9IGFyci5sZW5ndGggLSAxO1xuICAgIGZvciAoOyBlbmQgPj0gMDsgZW5kLS0pIHtcbiAgICAgIGlmIChhcnJbZW5kXSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChzdGFydCA+IGVuZCkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBhcnIuc2xpY2Uoc3RhcnQsIGVuZCAtIHN0YXJ0ICsgMSk7XG4gIH1cblxuICB2YXIgZnJvbVBhcnRzID0gdHJpbShmcm9tLnNwbGl0KCcvJykpO1xuICB2YXIgdG9QYXJ0cyA9IHRyaW0odG8uc3BsaXQoJy8nKSk7XG5cbiAgdmFyIGxlbmd0aCA9IE1hdGgubWluKGZyb21QYXJ0cy5sZW5ndGgsIHRvUGFydHMubGVuZ3RoKTtcbiAgdmFyIHNhbWVQYXJ0c0xlbmd0aCA9IGxlbmd0aDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmIChmcm9tUGFydHNbaV0gIT09IHRvUGFydHNbaV0pIHtcbiAgICAgIHNhbWVQYXJ0c0xlbmd0aCA9IGk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB2YXIgb3V0cHV0UGFydHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IHNhbWVQYXJ0c0xlbmd0aDsgaSA8IGZyb21QYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgIG91dHB1dFBhcnRzLnB1c2goJy4uJyk7XG4gIH1cblxuICBvdXRwdXRQYXJ0cyA9IG91dHB1dFBhcnRzLmNvbmNhdCh0b1BhcnRzLnNsaWNlKHNhbWVQYXJ0c0xlbmd0aCkpO1xuXG4gIHJldHVybiBvdXRwdXRQYXJ0cy5qb2luKCcvJyk7XG59O1xuXG5leHBvcnRzLnNlcCA9ICcvJztcbmV4cG9ydHMuZGVsaW1pdGVyID0gJzonO1xuXG5leHBvcnRzLmRpcm5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciByZXN1bHQgPSBzcGxpdFBhdGgocGF0aCksXG4gICAgICByb290ID0gcmVzdWx0WzBdLFxuICAgICAgZGlyID0gcmVzdWx0WzFdO1xuXG4gIGlmICghcm9vdCAmJiAhZGlyKSB7XG4gICAgLy8gTm8gZGlybmFtZSB3aGF0c29ldmVyXG4gICAgcmV0dXJuICcuJztcbiAgfVxuXG4gIGlmIChkaXIpIHtcbiAgICAvLyBJdCBoYXMgYSBkaXJuYW1lLCBzdHJpcCB0cmFpbGluZyBzbGFzaFxuICAgIGRpciA9IGRpci5zdWJzdHIoMCwgZGlyLmxlbmd0aCAtIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJvb3QgKyBkaXI7XG59O1xuXG5cbmV4cG9ydHMuYmFzZW5hbWUgPSBmdW5jdGlvbihwYXRoLCBleHQpIHtcbiAgdmFyIGYgPSBzcGxpdFBhdGgocGF0aClbMl07XG4gIC8vIFRPRE86IG1ha2UgdGhpcyBjb21wYXJpc29uIGNhc2UtaW5zZW5zaXRpdmUgb24gd2luZG93cz9cbiAgaWYgKGV4dCAmJiBmLnN1YnN0cigtMSAqIGV4dC5sZW5ndGgpID09PSBleHQpIHtcbiAgICBmID0gZi5zdWJzdHIoMCwgZi5sZW5ndGggLSBleHQubGVuZ3RoKTtcbiAgfVxuICByZXR1cm4gZjtcbn07XG5cblxuZXhwb3J0cy5leHRuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gc3BsaXRQYXRoKHBhdGgpWzNdO1xufTtcblxuZnVuY3Rpb24gZmlsdGVyICh4cywgZikge1xuICAgIGlmICh4cy5maWx0ZXIpIHJldHVybiB4cy5maWx0ZXIoZik7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGYoeHNbaV0sIGksIHhzKSkgcmVzLnB1c2goeHNbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufVxuXG4vLyBTdHJpbmcucHJvdG90eXBlLnN1YnN0ciAtIG5lZ2F0aXZlIGluZGV4IGRvbid0IHdvcmsgaW4gSUU4XG52YXIgc3Vic3RyID0gJ2FiJy5zdWJzdHIoLTEpID09PSAnYidcbiAgICA/IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHsgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbikgfVxuICAgIDogZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikge1xuICAgICAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IHN0ci5sZW5ndGggKyBzdGFydDtcbiAgICAgICAgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbik7XG4gICAgfVxuO1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKCFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiJdfQ==
