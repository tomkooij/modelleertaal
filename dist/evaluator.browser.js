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

    this.varNames = {}; // list of created variables
    this.constNames = {}; // list of startwaarden that remain constant in execution

}


Namespace.prototype.createVar = function(name) {

    name = this.varPrefix + name;

    if (!this.varNames[name])
        this.varNames[name] = true;

    return name;
};

Namespace.prototype.removePrefix = function(name) {

    var regex = new RegExp("^" + this.varPrefix);
    return name.replace(regex, '');
};


Namespace.prototype.moveStartWaarden = function () {
    this.constNames = this.varNames;
    this.varNames = {};
};

/*
 Class Results
 Store and manipulate results
*/
function Results(namespace) {
    this.namespace = namespace;
}

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

CodeGenerator.prototype.generateVariableInitialisationCode = function() {
    var code = 'var storage = {} \n';
    for (var variable in this.namespace.varNames) {
        code += "storage."+this.namespace.removePrefix(variable)+" = []; \n";
    }
    return code;
};

CodeGenerator.prototype.generateVariableStorageCode = function() {
    var code = '';
    for (var variable in this.namespace.varNames) {
        code += "storage."+this.namespace.removePrefix(variable)+"[i]= "+variable+"; \n";
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

CodeGenerator.prototype.makeVar = function(name) {
    return this.namespace.createVar(name);
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
                return this.makeVar(node.left) + ' = (' + this.parseNode(node.right) + ');\n';
        case 'Variable':
                return this.makeVar(node.name);
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

ModelregelsEvaluator.prototype.run = function(N, Nresults) {

    var startwaarden_code = this.codegenerator.generateCodeFromAst(this.startwaarden_ast);
    this.namespace.moveStartWaarden(); // keep namespace clean
    var modelregels_code = this.codegenerator.generateCodeFromAst(this.modelregels_ast);

    var model =  "try \n" +
                 "  { \n" +
                 startwaarden_code + "\n" +
                 this.codegenerator.generateVariableInitialisationCode() +
                 "    for (var i=0; i < Nresults; i++) { \n " +
                 "      for (var inner=0; inner <N/Nresults; inner++) {\n" +
                 modelregels_code + "\n" +
                 "      } \n" +
                 this.codegenerator.generateVariableStorageCode() +
                 "    } \n" +
                 "  } catch (e) \n" +
                 "  { console.log(e)} \n " +
                 "return storage;\n";

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
    var runModel = new Function('N','Nresults',model);
    var result = runModel(N,Nresults);

    var t2 = Date.now();

    console.log("Time: " + (t2 - t1) + "ms");

    return result;

};

exports.Model = modelmodule.Model; // from model.js
exports.ModelregelsEvaluator = ModelregelsEvaluator;
exports.Results = Results;
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

var xml = require('node-xml-lite');
var fs = require('fs');

function Model() {
    this.modelregels = '';
    this.startwaarden = '';
}

Model.prototype.readXMLFile = function(filename) {

    var xmlJSON = xml.parseFileSync(filename);
    this.parseXML(xmlJSON);
};

Model.prototype.readXMLString = function(xmlString) {

    var xmlJSON = xml.parseString(xmlString);
    this.parseXML(xmlJSON);
};


Model.prototype.parseXML = function(xmlJSON) {

    if (xmlJSON.name == 'modelleertaal') {

        for (var i = 0; i < xmlJSON.childs.length; i++) {

            switch(xmlJSON.childs[i].name){
                case 'startwaarden':  {
                    this.startwaarden = xmlJSON.childs[i].childs[0];
                    break;
                }
                case 'modelregels':  {
                    this.modelregels = xmlJSON.childs[i].childs[0];
                    break;
                }
                default:
                        throw new Error('Unable to handle xml item: ', xmlJSON.childs[i]);
            }
        }
    }
};

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
            case '<modelregels>': { action = 1; lines[line] = '/* modelregels */'; break; }
            case '</modelregels>': { action = 0; break; }
            case '<startwaarden>': { action = 2; lines[line] = '/* startwaarden */'; break; }
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


exports.Model = Model;

},{"fs":4,"node-xml-lite":13}],3:[function(require,module,exports){
(function (process){
/* parser generated by jison 0.4.15 */
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
        throw new Error(str);
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
        function lex() {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        }
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
options: {},
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
case 15:return 31
break;
case 16:return 32
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
case 27:return 10
break;
case 28:return 12
break;
case 29:return 13
break;
case 30:return 14
break;
case 31:return 7
break;
case 32:return 5
break;
}
},
rules: [/^(?:\s+)/,/^(?:\t+)/,/^(?:'[^\n]*)/,/^(?:\/\*(.|\n|\r)*?\*\/)/,/^(?:\/\/[^\n]*)/,/^(?:#[^\n]*)/,/^(?:\()/,/^(?:\))/,/^(?:pi\b)/,/^(?:==)/,/^(?:>=)/,/^(?:<=)/,/^(?:>)/,/^(?:<)/,/^(?:!|Niet|niet\b)/,/^(?:Waar|waar\b)/,/^(?:Onwaar|onwaar|OnWaar|False\b)/,/^(?:=)/,/^(?::=)/,/^(?:[0-9]*["."","][0-9]+([Ee][+-]?[0-9]+)?)/,/^(?:[0-9]+["."","][0-9]*([Ee][+-]?[0-9]+)?)/,/^(?:[0-9]+([Ee][+-]?[0-9]+)?)/,/^(?:\^)/,/^(?:\+)/,/^(?:-)/,/^(?:\*)/,/^(?:\/)/,/^(?:Als|als\b)/,/^(?:Dan|dan\b)/,/^(?:EindAls|Eindals|eindals\b)/,/^(?:Stop|stop\b)/,/^(?:[a-zA-Z]+([a-zA-Z0-9_])?)/,/^(?:$)/],
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

},{"_process":11,"fs":4,"path":10}],4:[function(require,module,exports){

},{}],5:[function(require,module,exports){
arguments[4][4][0].apply(exports,arguments)
},{"dup":4}],6:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff
var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined' && object.buffer instanceof ArrayBuffer) {
    return fromTypedArray(that, object)
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = String(string)

  if (string.length === 0) return 0

  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      return string.length
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return string.length * 2
    case 'hex':
      return string.length >>> 1
    case 'utf8':
    case 'utf-8':
      return utf8ToBytes(string).length
    case 'base64':
      return base64ToBytes(string).length
    default:
      return string.length
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function toString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []
  var i = 0

  for (; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (leadSurrogate) {
        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        } else {
          // valid surrogate pair
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      } else {
        // no lead yet

        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else {
          // valid lead
          leadSurrogate = codePoint
          continue
        }
      }
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":7,"ieee754":8,"is-array":9}],7:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],8:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],9:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],10:[function(require,module,exports){
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

},{"_process":11}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":6}],13:[function(require,module,exports){
(function (Buffer){

var
    fs = require("fs"),
    iconv; // loaded if necessary

const
    BUFFER_LENGTH = 1024;

const
    xsStart = 0,
    xsEatSpaces = 1,
    xsElement = 2,
    xsElementName = 3,
    xsAttributes = 4,
    xsAttributeName = 5,
    xsEqual = 6,
    xsAttributeValue = 7,
    xsCloseEmptyElement = 8,
    xsTryCloseElement = 9,
    xsCloseElementName = 10,
    xsChildNodes = 11,
    xsElementString = 12,
    xsElementComment = 13,
    xsCloseElementComment = 14,
    xsDoctype = 15,
    xsElementPI = 16,
    xsElementDataPI = 17,
    xsCloseElementPI = 18,
    xsElementCDATA = 19,
    xsClodeElementCDATA = 20,
    xsEscape = 21,
    xsEscape_lt = 22,
    xsEscape_gt = 23,
    xsEscape_amp = 24,
    xsEscape_apos = 25,
    xsEscape_quot = 26,
    xsEscape_char = 27,
    xsEscape_char_num = 28,
    xsEscape_char_hex = 29,
    xsEnd = 30;

const
    xcElement = 0,
    xcComment = 1,
    xcString = 2,
    xcCdata = 3,
    xcProcessInst = 4;

const
    xtOpen = exports.xtOpen = 0,
    xtClose = exports.xtClose = 1,
    xtAttribute = exports.xtAttribute = 2,
    xtText = exports.xtText = 3,
    xtCData = exports.xtCData = 4,
    xtComment = exports.xtComment = 5;

const
    CHAR_TAB    = 9,
    CHAR_LF     = 10,
    CHAR_CR     = 13,
    CHAR_SP     = 32,
    CHAR_EXCL   = 33, // !
    CHAR_DBLQ   = 34, // "
    CHAR_SHRP   = 35, // #
    CHAR_AMPE   = 38, // &
    CHAR_SINQ   = 39, // '
    CHAR_MINU   = 45, // -
    CHAR_PT     = 46, // .
    CHAR_SLAH   = 47, // /
    CHAR_ZERO   = 48, // 0
    CHAR_NINE   = 57, // 9
    CHAR_COLO   = 58, // :
    CHAR_SCOL   = 59, // ;
    CHAR_LESS   = 60, // <
    CHAR_EQUA   = 61, // =
    CHAR_GREA   = 62, // >
    CHAR_QUES   = 63, // ?
    CHAR_A      = 65,
    CHAR_C      = 67,
    CHAR_D      = 68,
    CHAR_F      = 70,
    CHAR_T      = 84,
    CHAR_Z      = 90,
    CHAR_LEBR   = 91, // [
    CHAR_RIBR   = 93, // [
    CHAR_LL     = 95, // _
    CHAR_a      = 97,
    CHAR_f      = 102,
    CHAR_g      = 103,
    CHAR_l      = 108,
    CHAR_m      = 109,
    CHAR_o      = 111,
    CHAR_p      = 112,
    CHAR_q      = 113,
    CHAR_s      = 115,
    CHAR_t      = 116,
    CHAR_u      = 117,
    CHAR_x      = 120,
    CHAR_z      = 122,
    CHAR_HIGH   = 161;

const
    STR_ENCODING = 'encoding',
    STR_XML = 'xml';

function isSpace(v) {
    return (v == CHAR_TAB || v == CHAR_LF || v == CHAR_CR || v == CHAR_SP)
}

function isAlpha(v) {
    return (v >= CHAR_A && v <= CHAR_Z) ||
    (v >= CHAR_a && v <= CHAR_z) ||
    (v == CHAR_LL) || (v == CHAR_COLO) || (v >= CHAR_HIGH)
}

function isNum(v) {
    return (v >= CHAR_ZERO && v <= CHAR_NINE)
}

function isAlphaNum(v) {
    return (isAlpha(v) || isNum(v) || (v == CHAR_PT) || (v == CHAR_MINU))
}

function isHex(v) {
    return (v >= CHAR_A && v <= CHAR_F) ||
        (v >= CHAR_a && v <= CHAR_f) ||
        (v >= CHAR_ZERO && v <= CHAR_NINE)
}

function hexDigit(v) {
    if (v <= CHAR_NINE) {
        return v - CHAR_ZERO
    } else {
        return (v & 7) + 9
    }
}

// ------------------------------

const
   STRING_BUFFER_SIZE = 32;

function StringBuffer() {
    this.buffer = new Buffer(STRING_BUFFER_SIZE);
    this.pos = 0;
}

StringBuffer.prototype.append = function(value) {
    if (this.pos == this.buffer.length) {
        var buf = new Buffer(this.buffer.length * 2);
        this.buffer.copy(buf);
        this.buffer = buf;
    }
    this.buffer.writeUInt8(value, this.pos);
    this.pos++;
};

StringBuffer.prototype.appendBuffer = function(value) {
    if (value.length) {
        var len = this.buffer.length;
        while (len - this.pos < value.length) {
            len *= 2;
        }
        if (len != this.buffer.length) {
            var buf = new Buffer(len);
            this.buffer.copy(buf);
            this.buffer = buf;
        }
        value.copy(this.buffer, this.pos);
        this.pos += value.length;
    }
};

/*
StringBuffer.prototype.trimRight = function() {
    while (this.pos > 0 && isSpace(this.buffer[this.pos-1])) {
        this.pos--;
    }
};
*/

StringBuffer.prototype.toString = function(encoding) {
    if (!encoding) {
        return this.buffer.slice(0, this.pos).toString()
    }
    if (!iconv) {
        iconv = require("iconv-lite");
    }
    return iconv.decode(this.buffer.slice(0, this.pos), encoding);
};

StringBuffer.prototype.toBuffer = function() {
    var ret = new Buffer(this.pos);
    this.buffer.copy(ret);
    return ret;
};

// ------------------------------

function XMLParser() {
    this.stackUp();
    this.str = new StringBuffer();
    this.value = new StringBuffer();
    this.line = 0;
    this.col = 0;
}

XMLParser.prototype.stackUp = function() {
    var st = {};
    st.state = xsEatSpaces;
    st.savedstate = xsStart;
    st.prev = this.stack;
    if (st.prev) {
        st.prev.next = st;
    }
    this.stack = st;
};

XMLParser.prototype.stackDown = function() {
    if (this.stack) {
        this.stack = this.stack.prev;
        if (this.stack) {
            delete this.stack.next;
        }
    }
};

XMLParser.prototype.parseBuffer = function(buffer, len, event) {
    var i = 0;
    var c = buffer[i];
    while (true) {
        switch (this.stack.state) {
            case xsEatSpaces:
                if (!isSpace(c)) {
                    this.stack.state = this.stack.savedstate;
                    continue;
                }
                break;
            case xsStart:
                if (c == CHAR_LESS) {
                    this.stack.state = xsElement;
                    break;
                } else {
                    return false;
                }
            case xsElement:
               switch (c) {
                   case CHAR_QUES:
                       this.stack.savedstate = xsStart;
                       this.stack.state = xsEatSpaces;
                       this.stackUp();
                       this.str.pos = 0;
                       this.stack.state = xsElementPI;
                       this.stack.clazz = xcProcessInst;
                       break;
                   case CHAR_EXCL:
                       this.position = 0;
                       this.stack.savedstate = xsStart;
                       this.stack.state = xsElementComment;
                       this.stack.clazz = xcComment;
                       break;
                   default:
                       if (isAlpha(c)) {
                            this.str.pos = 0;
                            this.stack.state = xsElementName;
                            this.stack.clazz = xcElement;
                            continue;
                       } else {
                           return false;
                       }
               }
               break;
            case xsElementPI:
                if (isAlphaNum(c)) {
                    this.str.append(c);
                    break;
                } else {
                    this.stack.state = xsEatSpaces;
                    if (this.str == STR_XML) {
                        this.stack.savedstate = xsAttributes;
                    } else {
                        this.value.pos = 0;
                        this.stack.savedstate = xsElementDataPI;
                    }
                    continue;
                }
            case xsElementDataPI:
                if (c == CHAR_QUES) {
                    this.stack.state = xsCloseElementPI;
                } else {
                    this.value.append(c);
                }
                break;
            case xsCloseElementPI:
                if (c != CHAR_GREA) {
                    return false;
                }
                this.stackDown();
                break;
            case xsElementName:
                if (isAlphaNum(c)) {
                    this.str.append(c);
                } else {
                    this.stack.name = this.str.toBuffer();
                    if (!event(xtOpen, this.str.toString())) {
                        return false;
                    }
                    this.stack.state = xsEatSpaces;
                    this.stack.savedstate = xsAttributes;
                    continue;
                }
                break;
            case xsChildNodes:
                if (c == CHAR_LESS) {
                    this.stack.state = xsTryCloseElement;
                    break;
                } else {
                    this.value.pos = 0;
                    this.stack.state = xsElementString;
                    this.stack.clazz = xcString;
                    continue;
                }
            case xsCloseEmptyElement:
                if (c == CHAR_GREA) {
                    if (!event(xtClose)) {
                        return false;
                    }
                    if (!this.stack.prev) {
                        return true;
                    }
                    this.stack.state = xsEatSpaces;
                    this.stack.savedstate = xsEnd;
                    break;
                } else {
                    return false;
                }
            case xsTryCloseElement:
                switch (c) {
                    case CHAR_SLAH:
                        this.stack.state = xsCloseElementName;
                        this.position = 0;
                        this.str.pos = 0;
                        this.str.appendBuffer(this.stack.name);
                        break;
                    case CHAR_EXCL:
                        this.position = 0;
                        this.stack.savedstate = xsChildNodes;
                        this.stack.state = xsElementComment;
                        this.stack.clazz = xcComment;
                        break;
                    case CHAR_QUES:
                        this.stack.savedstate = xsChildNodes;
                        this.stack.state = xsEatSpaces;
                        this.stackUp();
                        this.str.pos = 0;
                        this.stack.state = xsElementPI;
                        this.stack.clazz = xcProcessInst;
                        break;
                    default:
                        this.stack.state = xsChildNodes;
                        this.stackUp();
                        if (isAlpha(c)) {
                            this.str.pos = 0;
                            this.stack.state = xsElementName;
                            this.stack.clazz = xcElement;
                            continue;
                        } else {
                            return false;
                        }
                }
                break;
            case xsCloseElementName:
                if (this.str.pos == this.position) {
                    this.stack.savedstate = xsCloseEmptyElement;
                    this.stack.state = xsEatSpaces;
                    continue;
                } else {
                    if (c != this.str.buffer[this.position]) {
                        return false;
                    }
                    this.position++;
                }
                break;
            case xsAttributes:
                switch (c) {
                    case CHAR_QUES:
                        if (this.stack.clazz != xcProcessInst) {
                            return false;
                        }
                        this.stack.state = xsCloseElementPI;
                        break;
                    case CHAR_SLAH:
                        this.stack.state = xsCloseEmptyElement;
                        break;
                    case CHAR_GREA:
                        this.stack.state = xsEatSpaces;
                        this.stack.savedstate = xsChildNodes;
                        break;
                    default:
                        if (isAlpha(c)) {
                            this.str.pos = 0;
                            this.str.append(c);
                            this.stack.state = xsAttributeName;
                            break;
                        } else {
                            return false;
                        }

                }
                break;
            case xsAttributeName:
                if (isAlphaNum(c)) {
                    this.str.append(c);
                    break;
                } else {
                    this.stack.state = xsEatSpaces;
                    this.stack.savedstate = xsEqual;
                    continue;
                }
            case xsEqual:
                if (c != CHAR_EQUA) {
                    return false;
                }
                this.stack.state = xsEatSpaces;
                this.stack.savedstate = xsAttributeValue;
                this.value.pos = 0;
                this.position = 0;
                delete this.quote;
                break;
            case xsAttributeValue:
                if (this.quote) {
                    if (c == this.quote) {
                        if (this.stack.clazz != xcProcessInst) {
                            event(xtAttribute, this.str.toString(), this.value.toString(this.encoding));
                        }  else if (this.str == STR_ENCODING) {
                            this.encoding = this.value.toString();
                        }


                        this.stack.savedstate = xsAttributes;
                        this.stack.state = xsEatSpaces;
                    } else {
                        switch (c) {
                            case CHAR_AMPE:
                                this.stack.state = xsEscape;
                                this.stack.savedstate = xsAttributeValue;
                                break;
/*
                            case CHAR_CR:
                            case CHAR_LF:
                                this.value.trimRight();
                                this.value.append(CHAR_SP);
                                this.stack.state = xsEatSpaces;
                                this.stack.savedstate = xsAttributeValue;
                                break;
 */
                            default:
                                this.value.append(c);
                        }
                    }
                } else {
                   if (c == CHAR_SINQ || c == CHAR_DBLQ) {
                       this.quote = c;
                       this.position++;
                   } else {
                       return false;
                   }
                }
                break;
            case xsElementString:
                switch (c) {
                    case CHAR_LESS:
                        //this.value.trimRight();
                        if (!event(xtText, this.value.toString(this.encoding))) {
                            return false;
                        }
                        this.stack.state = xsTryCloseElement;
                        break;
/*
                    case CHAR_CR:
                    case CHAR_LF:
                        this.value.trimRight();
                        this.value.append(CHAR_SP);
                        this.stack.state = xsEatSpaces;
                        this.stack.savedstate = xsElementString;
                        break;
*/
                    case CHAR_AMPE:
                        this.stack.state = xsEscape;
                        this.stack.savedstate = xsElementString;
                        break;
                    default:
                        this.value.append(c);
                }
                break;
            case xsElementComment:
                switch (this.position) {
                    case 0:
                        switch (c) {
                            case CHAR_MINU:
                                this.position++;
                                break;
                            case CHAR_LEBR:
                                this.value.pos = 0;
                                this.position = 0;
                                this.stack.state = xsElementCDATA;
                                this.stack.clazz = xcCdata;
                                break;
                            default:
                                this.stack.state = xsDoctype;
                        }
                        break;
                    case 1:
                        if (c != CHAR_MINU) {
                            return false;
                        }
                        this.str.pos = 0;
                        this.position++;
                        break;
                    default:
                        if (c !== CHAR_MINU) {
                            this.str.append(c);
                        } else {
                            this.position = 0;
                            this.stack.state = xsCloseElementComment;
                        }
                }
                break;
            case xsCloseElementComment:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_MINU) {
                            this.position = 2;
                            this.stack.state = xsElementComment;
                        } else {
                            this.position++;
                        }
                        break;
                    case 1:
                        if (c != CHAR_GREA) {
                            return false;
                        }
                        event(xtComment, this.str.toString(this.encoding));
                        this.stack.state = xsEatSpaces;
                        break;
                    default:
                        return false;
                }
                break;
            case xsDoctype:
                // todo: parse elements ...
                if (c == CHAR_GREA) {
                    this.stack.state = xsEatSpaces;
                    if (this.stack.prev) {
                        this.stack.savedstate = xsChildNodes
                    } else {
                        this.stack.savedstate = xsStart;
                    }
                }
                break;
            case xsElementCDATA:
                switch (this.position) {
                    case 0:
                        if (c == CHAR_C) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 1:
                        if (c == CHAR_D) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 2:
                        if (c == CHAR_A) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 3:
                        if (c == CHAR_T) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 4:
                        if (c == CHAR_A) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    case 5:
                        if (c == CHAR_LEBR) {
                            this.position++;
                            break;
                        } else {
                            return false;
                        }
                    default:
                        if (c == CHAR_RIBR) {
                            this.position = 0;
                            this.stack.state = xsClodeElementCDATA;
                        } else {
                            this.value.append(c);
                        }
                }
                break;
            case xsClodeElementCDATA:
                switch (this.position) {
                    case 0:
                        if (c == CHAR_RIBR) {
                            this.position++;
                        } else {
                            this.value.append(CHAR_RIBR);
                            this.value.append(c);
                            this.position = 6;
                            this.stack.state = xsElementCDATA;
                        }
                        break;
                    case 1:
                        switch (c) {
                            case CHAR_GREA:
                                if (!event(xtCData, this.value.toString(this.encoding))) {
                                    return false;
                                }
                                this.stack.state = xsEatSpaces;
                                this.stack.savedstate = xsChildNodes;
                                break;
                            case CHAR_RIBR:
                                this.value.append(c);
                                break;
                        }
                        break;
                    default:
                        this.value.append(c);
                        this.stack.state = xsElementCDATA;
                }
                break;
            case xsEscape:
                this.position = 0;
                switch (c) {
                    case CHAR_l:
                        this.stack.state = xsEscape_lt;
                        break;
                    case CHAR_g:
                        this.stack.state = xsEscape_gt;
                        break;
                    case CHAR_a:
                        this.stack.state = xsEscape_amp;
                        break;
                    case CHAR_q:
                        this.stack.state = xsEscape_quot;
                        break;
                    case CHAR_SHRP:
                        this.stack.state = xsEscape_char;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_lt:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_t) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 1:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_LESS);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_gt:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_t) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 1:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_GREA);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_amp:
                switch (this.position) {
                    case 0:
                        switch (c) {
                            case CHAR_m:
                                this.position++;
                                break;
                            case CHAR_p:
                                this.stack.state = xsEscape_apos;
                                this.position++;
                                break;
                            default:
                                return false;
                        }
                        break;
                    case 1:
                        if (c != CHAR_p) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 2:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_AMPE);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_apos:
                switch (this.position) {
                    case 0:
                        switch (c) {
                            case CHAR_p:
                                this.position++;
                                break;
                            case CHAR_m:
                                this.stack.state = xsEscape_amp;
                                this.position++;
                                break;
                            default:
                                return false;
                        }
                        break;
                    case 1:
                        if (c != CHAR_o) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 2:
                        if (c != CHAR_s) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 3:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_SINQ);
                        this.stack.state = this.stack.savedstate;
                        break;
                }
                break;
            case xsEscape_quot:
                switch (this.position) {
                    case 0:
                        if (c != CHAR_u) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 1:
                        if (c != CHAR_o) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 2:
                        if (c != CHAR_t) {
                            return false;
                        }
                        this.position++;
                        break;
                    case 3:
                        if (c != CHAR_SCOL) {
                            return false;
                        }
                        this.value.append(CHAR_DBLQ);
                        this.stack.state = this.stack.savedstate;
                        break;
                    default:
                        return false;
                }
                break;
            case xsEscape_char:
                if (isNum(c)) {
                    this.position = c - CHAR_ZERO;
                    this.stack.state = xsEscape_char_num;
                } else if (c == CHAR_x) {
                    this.stack.state = xsEscape_char_hex;
                } else {
                    return false;
                }
                break;
            case xsEscape_char_num:
                if (isNum(c)) {
                    this.position = (this.position * 10) + (c - CHAR_ZERO);
                } else if (c == CHAR_SCOL) {
                    this.value.append(this.position);
                    this.stack.state = this.stack.savedstate;
                } else {
                    return false;
                }
                break;
            case xsEscape_char_hex:
                if (isHex(c)) {
                    this.position = (this.position * 16) + hexDigit(c);
                } else if (c == CHAR_SCOL) {
                    this.value.append(this.position);
                    this.stack.state = this.stack.savedstate;
                } else {
                    return false;
                }
                break;
            case xsEnd:
                this.stackDown();
                continue;
            default:
                return false;
        }
        i++;
        if (i >= len) break;
        c = buffer[i];
        if (c !== CHAR_LF) {
            this.col++;
        } else {
            this.col = 0;
            this.line++;
        }
    }
};

XMLParser.prototype.parseString = function(str, event) {
    var buf = new Buffer(str);
    this.parseBuffer(buf, buf.length, event);
};

// ------------------------------

var SAXParseFile = exports.SAXParseFile = function(path, event, callback) {
    fs.open(path, 'r', function(err, fd) {
        var buffer = new Buffer(BUFFER_LENGTH);
        var parser = new XMLParser();
        if (!err) {
            function cb(err, br) {
                if (!err) {
                    if (br > 0) {
                        var ret = parser.parseBuffer(buffer, br, event);
                        if (ret === undefined){
                            fs.read(fd, buffer, 0, BUFFER_LENGTH, null, cb);
                        } else if (ret === true) {
                            if (callback) {
                                callback()
                            }
                        } else if (ret === false) {
                            if (callback) {
                                callback("parsing error at line: " + parser.line + ", col: " + parser.col)
                            }
                        }
                    } else {
                        fs.close(fd);
                    }
                } else {
                    fs.close(fd);
                    if (callback)
                        callback(err);
                }
            }
            fs.read(fd, buffer, 0, BUFFER_LENGTH, null, cb);
        } else {
            if (callback)
                callback(err);
        }
    });
};

var SAXParseFileSync = exports.SAXParseFileSync = function(path, event) {
    var fd = fs.openSync(path, 'r');
    try {
        var buffer = new Buffer(BUFFER_LENGTH);
        var parser = new XMLParser();
        var br = fs.readSync(fd, buffer, 0, BUFFER_LENGTH);
        while (br > 0) {
            var ret = parser.parseBuffer(buffer, br, event);
            if (ret === undefined){
                br = fs.readSync(fd, buffer, 0, BUFFER_LENGTH);
            } else if (ret === true) {
                return
            } else if (ret === false) {
                throw new Error("parsing error at line: " + parser.line + ", col: " + parser.col)
            }
        }
    } finally {
        fs.closeSync(fd);
    }
};

function processEvent(stack, state, p1, p2) {
    var node, parent;
    switch (state) {
        case xtOpen:
            node = {name: p1};
            stack.push(node);
            break;
        case xtClose:
            node = stack.pop();
            if (stack.length) {
                parent = stack[stack.length-1];
                if (parent.childs) {
                    parent.childs.push(node)
                } else {
                    parent.childs = [node];
                }
            }
            break;
        case xtAttribute:
            parent = stack[stack.length-1];
            if (!parent.attrib) {
                parent.attrib = {};
            }
            parent.attrib[p1] = p2;
            break;
        case xtText:
        case xtCData:
            parent = stack[stack.length-1];
            if (parent.childs) {
                parent.childs.push(p1)
            } else {
                parent.childs = [p1];
            }
            break;
    }
    return node;
}

exports.parseFile = function(path, callback) {
    var stack = [], node;
    SAXParseFile(path,
        function(state, p1, p2) {
            node = processEvent(stack, state, p1, p2);
            return true;
        },
        function(err){
            if (callback) {
                callback(err, node);
            }
        }
    );
};

exports.parseFileSync = function(path) {
    var stack = [];
    var node = null;
    SAXParseFileSync(path,
        function(state, p1, p2) {
            node = processEvent(stack, state, p1, p2);
            return true;
        }
    );
    return node;
};

var parseBuffer = exports.parseBuffer = function(buffer) {
    var node = null,
        parser = new XMLParser(),
        stack = [];

    var ret = parser.parseBuffer(buffer, buffer.length,
        function(state, p1, p2) {
            node = processEvent(stack, state, p1, p2);
            return true;
        }
    );
    if (ret === false) {
        throw new Error("parsing error at line: " + parser.line + ", col: " + parser.col)
    }
    return node;
};

exports.parseString = function(str) {
   return parseBuffer(new Buffer(str));
};
}).call(this,require("buffer").Buffer)

},{"buffer":6,"fs":4,"iconv-lite":31}],14:[function(require,module,exports){
(function (Buffer){

// Multibyte codec. In this scheme, a character is represented by 1 or more bytes.
// Our codec supports UTF-16 surrogates, extensions for GB18030 and unicode sequences.
// To save memory and loading time, we read table files only when requested.

exports._dbcs = function(options) {
    return new DBCSCodec(options);
}

var UNASSIGNED = -1,
    GB18030_CODE = -2,
    SEQ_START  = -10,
    NODE_START = -1000,
    UNASSIGNED_NODE = new Array(0x100),
    DEF_CHAR = -1;

for (var i = 0; i < 0x100; i++)
    UNASSIGNED_NODE[i] = UNASSIGNED;


// Class DBCSCodec reads and initializes mapping tables.
function DBCSCodec(options) {
    this.options = options;
    if (!options)
        throw new Error("DBCS codec is called without the data.")
    if (!options.table)
        throw new Error("Encoding '" + options.encodingName + "' has no data.");

    // Load tables.
    var mappingTable = options.table();


    // Decode tables: MBCS -> Unicode.

    // decodeTables is a trie, encoded as an array of arrays of integers. Internal arrays are trie nodes and all have len = 256.
    // Trie root is decodeTables[0].
    // Values: >=  0 -> unicode character code. can be > 0xFFFF
    //         == UNASSIGNED -> unknown/unassigned sequence.
    //         == GB18030_CODE -> this is the end of a GB18030 4-byte sequence.
    //         <= NODE_START -> index of the next node in our trie to process next byte.
    //         <= SEQ_START  -> index of the start of a character code sequence, in decodeTableSeq.
    this.decodeTables = [];
    this.decodeTables[0] = UNASSIGNED_NODE.slice(0); // Create root node.

    // Sometimes a MBCS char corresponds to a sequence of unicode chars. We store them as arrays of integers here. 
    this.decodeTableSeq = [];

    // Actual mapping tables consist of chunks. Use them to fill up decode tables.
    for (var i = 0; i < mappingTable.length; i++)
        this._addDecodeChunk(mappingTable[i]);

    this.defaultCharUnicode = options.iconv.defaultCharUnicode;

    
    // Encode tables: Unicode -> DBCS.

    // `encodeTable` is array mapping from unicode char to encoded char. All its values are integers for performance.
    // Because it can be sparse, it is represented as array of buckets by 256 chars each. Bucket can be null.
    // Values: >=  0 -> it is a normal char. Write the value (if <=256 then 1 byte, if <=65536 then 2 bytes, etc.).
    //         == UNASSIGNED -> no conversion found. Output a default char.
    //         <= SEQ_START  -> it's an index in encodeTableSeq, see below. The character starts a sequence.
    this.encodeTable = [];
    
    // `encodeTableSeq` is used when a sequence of unicode characters is encoded as a single code. We use a tree of
    // objects where keys correspond to characters in sequence and leafs are the encoded dbcs values. A special DEF_CHAR key
    // means end of sequence (needed when one sequence is a strict subsequence of another).
    // Objects are kept separately from encodeTable to increase performance.
    this.encodeTableSeq = [];

    // Some chars can be decoded, but need not be encoded.
    var skipEncodeChars = {};
    if (options.encodeSkipVals)
        for (var i = 0; i < options.encodeSkipVals.length; i++) {
            var range = options.encodeSkipVals[i];
            for (var j = range.from; j <= range.to; j++)
                skipEncodeChars[j] = true;
        }
        
    // Use decode trie to recursively fill out encode tables.
    this._fillEncodeTable(0, 0, skipEncodeChars);

    // Add more encoding pairs when needed.
    if (options.encodeAdd) {
        for (var uChar in options.encodeAdd)
            if (Object.prototype.hasOwnProperty.call(options.encodeAdd, uChar))
                this._setEncodeChar(uChar.charCodeAt(0), options.encodeAdd[uChar]);
    }

    this.defCharSB  = this.encodeTable[0][options.iconv.defaultCharSingleByte.charCodeAt(0)];
    if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]['?'];
    if (this.defCharSB === UNASSIGNED) this.defCharSB = "?".charCodeAt(0);


    // Load & create GB18030 tables when needed.
    if (typeof options.gb18030 === 'function') {
        this.gb18030 = options.gb18030(); // Load GB18030 ranges.

        // Add GB18030 decode tables.
        var thirdByteNodeIdx = this.decodeTables.length;
        var thirdByteNode = this.decodeTables[thirdByteNodeIdx] = UNASSIGNED_NODE.slice(0);

        var fourthByteNodeIdx = this.decodeTables.length;
        var fourthByteNode = this.decodeTables[fourthByteNodeIdx] = UNASSIGNED_NODE.slice(0);

        for (var i = 0x81; i <= 0xFE; i++) {
            var secondByteNodeIdx = NODE_START - this.decodeTables[0][i];
            var secondByteNode = this.decodeTables[secondByteNodeIdx];
            for (var j = 0x30; j <= 0x39; j++)
                secondByteNode[j] = NODE_START - thirdByteNodeIdx;
        }
        for (var i = 0x81; i <= 0xFE; i++)
            thirdByteNode[i] = NODE_START - fourthByteNodeIdx;
        for (var i = 0x30; i <= 0x39; i++)
            fourthByteNode[i] = GB18030_CODE
    }        
}

// Public interface: create encoder and decoder objects. 
// The methods (write, end) are simple functions to not inhibit optimizations.
DBCSCodec.prototype.encoder = function encoderDBCS(options) {
    return {
        // Methods
        write: encoderDBCSWrite,
        end: encoderDBCSEnd,

        // Encoder state
        leadSurrogate: -1,
        seqObj: undefined,
        
        // Static data
        encodeTable: this.encodeTable,
        encodeTableSeq: this.encodeTableSeq,
        defaultCharSingleByte: this.defCharSB,
        gb18030: this.gb18030,

        // Export for testing
        findIdx: findIdx,
    }
}

DBCSCodec.prototype.decoder = function decoderDBCS(options) {
    return {
        // Methods
        write: decoderDBCSWrite,
        end: decoderDBCSEnd,

        // Decoder state
        nodeIdx: 0,
        prevBuf: new Buffer(0),

        // Static data
        decodeTables: this.decodeTables,
        decodeTableSeq: this.decodeTableSeq,
        defaultCharUnicode: this.defaultCharUnicode,
        gb18030: this.gb18030,
    }
}



// Decoder helpers
DBCSCodec.prototype._getDecodeTrieNode = function(addr) {
    var bytes = [];
    for (; addr > 0; addr >>= 8)
        bytes.push(addr & 0xFF);
    if (bytes.length == 0)
        bytes.push(0);

    var node = this.decodeTables[0];
    for (var i = bytes.length-1; i > 0; i--) { // Traverse nodes deeper into the trie.
        var val = node[bytes[i]];

        if (val == UNASSIGNED) { // Create new node.
            node[bytes[i]] = NODE_START - this.decodeTables.length;
            this.decodeTables.push(node = UNASSIGNED_NODE.slice(0));
        }
        else if (val <= NODE_START) { // Existing node.
            node = this.decodeTables[NODE_START - val];
        }
        else
            throw new Error("Overwrite byte in " + this.options.encodingName + ", addr: " + addr.toString(16));
    }
    return node;
}


DBCSCodec.prototype._addDecodeChunk = function(chunk) {
    // First element of chunk is the hex mbcs code where we start.
    var curAddr = parseInt(chunk[0], 16);

    // Choose the decoding node where we'll write our chars.
    var writeTable = this._getDecodeTrieNode(curAddr);
    curAddr = curAddr & 0xFF;

    // Write all other elements of the chunk to the table.
    for (var k = 1; k < chunk.length; k++) {
        var part = chunk[k];
        if (typeof part === "string") { // String, write as-is.
            for (var l = 0; l < part.length;) {
                var code = part.charCodeAt(l++);
                if (0xD800 <= code && code < 0xDC00) { // Decode surrogate
                    var codeTrail = part.charCodeAt(l++);
                    if (0xDC00 <= codeTrail && codeTrail < 0xE000)
                        writeTable[curAddr++] = 0x10000 + (code - 0xD800) * 0x400 + (codeTrail - 0xDC00);
                    else
                        throw new Error("Incorrect surrogate pair in "  + this.options.encodingName + " at chunk " + chunk[0]);
                }
                else if (0x0FF0 < code && code <= 0x0FFF) { // Character sequence (our own encoding used)
                    var len = 0xFFF - code + 2;
                    var seq = [];
                    for (var m = 0; m < len; m++)
                        seq.push(part.charCodeAt(l++)); // Simple variation: don't support surrogates or subsequences in seq.

                    writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length;
                    this.decodeTableSeq.push(seq);
                }
                else
                    writeTable[curAddr++] = code; // Basic char
            }
        } 
        else if (typeof part === "number") { // Integer, meaning increasing sequence starting with prev character.
            var charCode = writeTable[curAddr - 1] + 1;
            for (var l = 0; l < part; l++)
                writeTable[curAddr++] = charCode++;
        }
        else
            throw new Error("Incorrect type '" + typeof part + "' given in "  + this.options.encodingName + " at chunk " + chunk[0]);
    }
    if (curAddr > 0xFF)
        throw new Error("Incorrect chunk in "  + this.options.encodingName + " at addr " + chunk[0] + ": too long" + curAddr);
}

// Encoder helpers
DBCSCodec.prototype._getEncodeBucket = function(uCode) {
    var high = uCode >> 8; // This could be > 0xFF because of astral characters.
    if (this.encodeTable[high] === undefined)
        this.encodeTable[high] = UNASSIGNED_NODE.slice(0); // Create bucket on demand.
    return this.encodeTable[high];
}

DBCSCodec.prototype._setEncodeChar = function(uCode, dbcsCode) {
    var bucket = this._getEncodeBucket(uCode);
    var low = uCode & 0xFF;
    if (bucket[low] <= SEQ_START)
        this.encodeTableSeq[SEQ_START-bucket[low]][DEF_CHAR] = dbcsCode; // There's already a sequence, set a single-char subsequence of it.
    else if (bucket[low] == UNASSIGNED)
        bucket[low] = dbcsCode;
}

DBCSCodec.prototype._setEncodeSequence = function(seq, dbcsCode) {
    
    // Get the root of character tree according to first character of the sequence.
    var uCode = seq[0];
    var bucket = this._getEncodeBucket(uCode);
    var low = uCode & 0xFF;

    var node;
    if (bucket[low] <= SEQ_START) {
        // There's already a sequence with  - use it.
        node = this.encodeTableSeq[SEQ_START-bucket[low]];
    }
    else {
        // There was no sequence object - allocate a new one.
        node = {};
        if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low]; // If a char was set before - make it a single-char subsequence.
        bucket[low] = SEQ_START - this.encodeTableSeq.length;
        this.encodeTableSeq.push(node);
    }

    // Traverse the character tree, allocating new nodes as needed.
    for (var j = 1; j < seq.length-1; j++) {
        var oldVal = node[uCode];
        if (typeof oldVal === 'object')
            node = oldVal;
        else {
            node = node[uCode] = {}
            if (oldVal !== undefined)
                node[DEF_CHAR] = oldVal
        }
    }

    // Set the leaf to given dbcsCode.
    uCode = seq[seq.length-1];
    node[uCode] = dbcsCode;
}

DBCSCodec.prototype._fillEncodeTable = function(nodeIdx, prefix, skipEncodeChars) {
    var node = this.decodeTables[nodeIdx];
    for (var i = 0; i < 0x100; i++) {
        var uCode = node[i];
        var mbCode = prefix + i;
        if (skipEncodeChars[mbCode])
            continue;

        if (uCode >= 0)
            this._setEncodeChar(uCode, mbCode);
        else if (uCode <= NODE_START)
            this._fillEncodeTable(NODE_START - uCode, mbCode << 8, skipEncodeChars);
        else if (uCode <= SEQ_START)
            this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode);
    }
}



// == Actual Encoding ==========================================================


function encoderDBCSWrite(str) {
    var newBuf = new Buffer(str.length * (this.gb18030 ? 4 : 3)), 
        leadSurrogate = this.leadSurrogate,
        seqObj = this.seqObj, nextChar = -1,
        i = 0, j = 0;

    while (true) {
        // 0. Get next character.
        if (nextChar === -1) {
            if (i == str.length) break;
            var uCode = str.charCodeAt(i++);
        }
        else {
            var uCode = nextChar;
            nextChar = -1;    
        }

        // 1. Handle surrogates.
        if (0xD800 <= uCode && uCode < 0xE000) { // Char is one of surrogates.
            if (uCode < 0xDC00) { // We've got lead surrogate.
                if (leadSurrogate === -1) {
                    leadSurrogate = uCode;
                    continue;
                } else {
                    leadSurrogate = uCode;
                    // Double lead surrogate found.
                    uCode = UNASSIGNED;
                }
            } else { // We've got trail surrogate.
                if (leadSurrogate !== -1) {
                    uCode = 0x10000 + (leadSurrogate - 0xD800) * 0x400 + (uCode - 0xDC00);
                    leadSurrogate = -1;
                } else {
                    // Incomplete surrogate pair - only trail surrogate found.
                    uCode = UNASSIGNED;
                }
                
            }
        }
        else if (leadSurrogate !== -1) {
            // Incomplete surrogate pair - only lead surrogate found.
            nextChar = uCode; uCode = UNASSIGNED; // Write an error, then current char.
            leadSurrogate = -1;
        }

        // 2. Convert uCode character.
        var dbcsCode = UNASSIGNED;
        if (seqObj !== undefined && uCode != UNASSIGNED) { // We are in the middle of the sequence
            var resCode = seqObj[uCode];
            if (typeof resCode === 'object') { // Sequence continues.
                seqObj = resCode;
                continue;

            } else if (typeof resCode == 'number') { // Sequence finished. Write it.
                dbcsCode = resCode;

            } else if (resCode == undefined) { // Current character is not part of the sequence.

                // Try default character for this sequence
                resCode = seqObj[DEF_CHAR];
                if (resCode !== undefined) {
                    dbcsCode = resCode; // Found. Write it.
                    nextChar = uCode; // Current character will be written too in the next iteration.

                } else {
                    // TODO: What if we have no default? (resCode == undefined)
                    // Then, we should write first char of the sequence as-is and try the rest recursively.
                    // Didn't do it for now because no encoding has this situation yet.
                    // Currently, just skip the sequence and write current char.
                }
            }
            seqObj = undefined;
        }
        else if (uCode >= 0) {  // Regular character
            var subtable = this.encodeTable[uCode >> 8];
            if (subtable !== undefined)
                dbcsCode = subtable[uCode & 0xFF];
            
            if (dbcsCode <= SEQ_START) { // Sequence start
                seqObj = this.encodeTableSeq[SEQ_START-dbcsCode];
                continue;
            }

            if (dbcsCode == UNASSIGNED && this.gb18030) {
                // Use GB18030 algorithm to find character(s) to write.
                var idx = findIdx(this.gb18030.uChars, uCode);
                if (idx != -1) {
                    var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx]);
                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 12600); dbcsCode = dbcsCode % 12600;
                    newBuf[j++] = 0x30 + Math.floor(dbcsCode / 1260); dbcsCode = dbcsCode % 1260;
                    newBuf[j++] = 0x81 + Math.floor(dbcsCode / 10); dbcsCode = dbcsCode % 10;
                    newBuf[j++] = 0x30 + dbcsCode;
                    continue;
                }
            }
        }

        // 3. Write dbcsCode character.
        if (dbcsCode === UNASSIGNED)
            dbcsCode = this.defaultCharSingleByte;
        
        if (dbcsCode < 0x100) {
            newBuf[j++] = dbcsCode;
        }
        else if (dbcsCode < 0x10000) {
            newBuf[j++] = dbcsCode >> 8;   // high byte
            newBuf[j++] = dbcsCode & 0xFF; // low byte
        }
        else {
            newBuf[j++] = dbcsCode >> 16;
            newBuf[j++] = (dbcsCode >> 8) & 0xFF;
            newBuf[j++] = dbcsCode & 0xFF;
        }
    }

    this.seqObj = seqObj;
    this.leadSurrogate = leadSurrogate;
    return newBuf.slice(0, j);
}

function encoderDBCSEnd() {
    if (this.leadSurrogate === -1 && this.seqObj === undefined)
        return; // All clean. Most often case.

    var newBuf = new Buffer(10), j = 0;

    if (this.seqObj) { // We're in the sequence.
        var dbcsCode = this.seqObj[DEF_CHAR];
        if (dbcsCode !== undefined) { // Write beginning of the sequence.
            if (dbcsCode < 0x100) {
                newBuf[j++] = dbcsCode;
            }
            else {
                newBuf[j++] = dbcsCode >> 8;   // high byte
                newBuf[j++] = dbcsCode & 0xFF; // low byte
            }
        } else {
            // See todo above.
        }
        this.seqObj = undefined;
    }

    if (this.leadSurrogate !== -1) {
        // Incomplete surrogate pair - only lead surrogate found.
        newBuf[j++] = this.defaultCharSingleByte;
        this.leadSurrogate = -1;
    }
    
    return newBuf.slice(0, j);
}


// == Actual Decoding ==========================================================


function decoderDBCSWrite(buf) {
    var newBuf = new Buffer(buf.length*2),
        nodeIdx = this.nodeIdx, 
        prevBuf = this.prevBuf, prevBufOffset = this.prevBuf.length,
        seqStart = -this.prevBuf.length, // idx of the start of current parsed sequence.
        uCode;

    if (prevBufOffset > 0) // Make prev buf overlap a little to make it easier to slice later.
        prevBuf = Buffer.concat([prevBuf, buf.slice(0, 10)]);
    
    for (var i = 0, j = 0; i < buf.length; i++) {
        var curByte = (i >= 0) ? buf[i] : prevBuf[i + prevBufOffset];

        // Lookup in current trie node.
        var uCode = this.decodeTables[nodeIdx][curByte];

        if (uCode >= 0) { 
            // Normal character, just use it.
        }
        else if (uCode === UNASSIGNED) { // Unknown char.
            // TODO: Callback with seq.
            //var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
            i = seqStart; // Try to parse again, after skipping first byte of the sequence ('i' will be incremented by 'for' cycle).
            uCode = this.defaultCharUnicode.charCodeAt(0);
        }
        else if (uCode === GB18030_CODE) {
            var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
            var ptr = (curSeq[0]-0x81)*12600 + (curSeq[1]-0x30)*1260 + (curSeq[2]-0x81)*10 + (curSeq[3]-0x30);
            var idx = findIdx(this.gb18030.gbChars, ptr);
            uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx];
        }
        else if (uCode <= NODE_START) { // Go to next trie node.
            nodeIdx = NODE_START - uCode;
            continue;
        }
        else if (uCode <= SEQ_START) { // Output a sequence of chars.
            var seq = this.decodeTableSeq[SEQ_START - uCode];
            for (var k = 0; k < seq.length - 1; k++) {
                uCode = seq[k];
                newBuf[j++] = uCode & 0xFF;
                newBuf[j++] = uCode >> 8;
            }
            uCode = seq[seq.length-1];
        }
        else
            throw new Error("iconv-lite internal error: invalid decoding table value " + uCode + " at " + nodeIdx + "/" + curByte);

        // Write the character to buffer, handling higher planes using surrogate pair.
        if (uCode > 0xFFFF) { 
            uCode -= 0x10000;
            var uCodeLead = 0xD800 + Math.floor(uCode / 0x400);
            newBuf[j++] = uCodeLead & 0xFF;
            newBuf[j++] = uCodeLead >> 8;

            uCode = 0xDC00 + uCode % 0x400;
        }
        newBuf[j++] = uCode & 0xFF;
        newBuf[j++] = uCode >> 8;

        // Reset trie node.
        nodeIdx = 0; seqStart = i+1;
    }

    this.nodeIdx = nodeIdx;
    this.prevBuf = (seqStart >= 0) ? buf.slice(seqStart) : prevBuf.slice(seqStart + prevBufOffset);
    return newBuf.slice(0, j).toString('ucs2');
}

function decoderDBCSEnd() {
    var ret = '';

    // Try to parse all remaining chars.
    while (this.prevBuf.length > 0) {
        // Skip 1 character in the buffer.
        ret += this.defaultCharUnicode;
        var buf = this.prevBuf.slice(1);

        // Parse remaining as usual.
        this.prevBuf = new Buffer(0);
        this.nodeIdx = 0;
        if (buf.length > 0)
            ret += decoderDBCSWrite.call(this, buf);
    }

    this.nodeIdx = 0;
    return ret;
}

// Binary search for GB18030. Returns largest i such that table[i] <= val.
function findIdx(table, val) {
    if (table[0] > val)
        return -1;

    var l = 0, r = table.length;
    while (l < r-1) { // always table[l] <= val < table[r]
        var mid = l + Math.floor((r-l+1)/2);
        if (table[mid] <= val)
            l = mid;
        else
            r = mid;
    }
    return l;
}


}).call(this,require("buffer").Buffer)

},{"buffer":6}],15:[function(require,module,exports){

// Description of supported double byte encodings and aliases.
// Tables are not require()-d until they are needed to speed up library load.
// require()-s are direct to support Browserify.

module.exports = {
    
    // == Japanese/ShiftJIS ====================================================
    // All japanese encodings are based on JIS X set of standards:
    // JIS X 0201 - Single-byte encoding of ASCII + ¥ + Kana chars at 0xA1-0xDF.
    // JIS X 0208 - Main set of 6879 characters, placed in 94x94 plane, to be encoded by 2 bytes. 
    //              Has several variations in 1978, 1983, 1990 and 1997.
    // JIS X 0212 - Supplementary plane of 6067 chars in 94x94 plane. 1990. Effectively dead.
    // JIS X 0213 - Extension and modern replacement of 0208 and 0212. Total chars: 11233.
    //              2 planes, first is superset of 0208, second - revised 0212.
    //              Introduced in 2000, revised 2004. Some characters are in Unicode Plane 2 (0x2xxxx)

    // Byte encodings are:
    //  * Shift_JIS: Compatible with 0201, uses not defined chars in top half as lead bytes for double-byte
    //               encoding of 0208. Lead byte ranges: 0x81-0x9F, 0xE0-0xEF; Trail byte ranges: 0x40-0x7E, 0x80-0x9E, 0x9F-0xFC.
    //               Windows CP932 is a superset of Shift_JIS. Some companies added more chars, notably KDDI.
    //  * EUC-JP:    Up to 3 bytes per character. Used mostly on *nixes.
    //               0x00-0x7F       - lower part of 0201
    //               0x8E, 0xA1-0xDF - upper part of 0201
    //               (0xA1-0xFE)x2   - 0208 plane (94x94).
    //               0x8F, (0xA1-0xFE)x2 - 0212 plane (94x94).
    //  * JIS X 208: 7-bit, direct encoding of 0208. Byte ranges: 0x21-0x7E (94 values). Uncommon.
    //               Used as-is in ISO2022 family.
    //  * ISO2022-JP: Stateful encoding, with escape sequences to switch between ASCII, 
    //                0201-1976 Roman, 0208-1978, 0208-1983.
    //  * ISO2022-JP-1: Adds esc seq for 0212-1990.
    //  * ISO2022-JP-2: Adds esc seq for GB2313-1980, KSX1001-1992, ISO8859-1, ISO8859-7.
    //  * ISO2022-JP-3: Adds esc seq for 0201-1976 Kana set, 0213-2000 Planes 1, 2.
    //  * ISO2022-JP-2004: Adds 0213-2004 Plane 1.
    //
    // After JIS X 0213 appeared, Shift_JIS-2004, EUC-JISX0213 and ISO2022-JP-2004 followed, with just changing the planes.
    //
    // Overall, it seems that it's a mess :( http://www8.plala.or.jp/tkubota1/unicode-symbols-map2.html


    'shiftjis': {
        type: '_dbcs',
        table: function() { return require('./tables/shiftjis.json') },
        encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
        encodeSkipVals: [{from: 0xED40, to: 0xF940}],
    },
    'csshiftjis': 'shiftjis',
    'mskanji': 'shiftjis',
    'sjis': 'shiftjis',
    'windows31j': 'shiftjis',
    'xsjis': 'shiftjis',
    'windows932': 'shiftjis',
    '932': 'shiftjis',
    'cp932': 'shiftjis',

    'eucjp': {
        type: '_dbcs',
        table: function() { return require('./tables/eucjp.json') },
        encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
    },

    // TODO: KDDI extension to Shift_JIS
    // TODO: IBM CCSID 942 = CP932, but F0-F9 custom chars and other char changes.
    // TODO: IBM CCSID 943 = Shift_JIS = CP932 with original Shift_JIS lower 128 chars.

    // == Chinese/GBK ==========================================================
    // http://en.wikipedia.org/wiki/GBK

    // Oldest GB2312 (1981, ~7600 chars) is a subset of CP936
    'gb2312': 'cp936',
    'gb231280': 'cp936',
    'gb23121980': 'cp936',
    'csgb2312': 'cp936',
    'csiso58gb231280': 'cp936',
    'euccn': 'cp936',
    'isoir58': 'gbk',

    // Microsoft's CP936 is a subset and approximation of GBK.
    // TODO: Euro = 0x80 in cp936, but not in GBK (where it's valid but undefined)
    'windows936': 'cp936',
    '936': 'cp936',
    'cp936': {
        type: '_dbcs',
        table: function() { return require('./tables/cp936.json') },
    },

    // GBK (~22000 chars) is an extension of CP936 that added user-mapped chars and some other.
    'gbk': {
        type: '_dbcs',
        table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },
    },
    'xgbk': 'gbk',

    // GB18030 is an algorithmic extension of GBK.
    'gb18030': {
        type: '_dbcs',
        table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },
        gb18030: function() { return require('./tables/gb18030-ranges.json') },
    },

    'chinese': 'gb18030',

    // TODO: Support GB18030 (~27000 chars + whole unicode mapping, cp54936)
    // http://icu-project.org/docs/papers/gb18030.html
    // http://source.icu-project.org/repos/icu/data/trunk/charset/data/xml/gb-18030-2000.xml
    // http://www.khngai.com/chinese/charmap/tblgbk.php?page=0

    // == Korean ===============================================================
    // EUC-KR, KS_C_5601 and KS X 1001 are exactly the same.
    'windows949': 'cp949',
    '949': 'cp949',
    'cp949': {
        type: '_dbcs',
        table: function() { return require('./tables/cp949.json') },
    },

    'cseuckr': 'cp949',
    'csksc56011987': 'cp949',
    'euckr': 'cp949',
    'isoir149': 'cp949',
    'korean': 'cp949',
    'ksc56011987': 'cp949',
    'ksc56011989': 'cp949',
    'ksc5601': 'cp949',


    // == Big5/Taiwan/Hong Kong ================================================
    // There are lots of tables for Big5 and cp950. Please see the following links for history:
    // http://moztw.org/docs/big5/  http://www.haible.de/bruno/charsets/conversion-tables/Big5.html
    // Variations, in roughly number of defined chars:
    //  * Windows CP 950: Microsoft variant of Big5. Canonical: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT
    //  * Windows CP 951: Microsoft variant of Big5-HKSCS-2001. Seems to be never public. http://me.abelcheung.org/articles/research/what-is-cp951/
    //  * Big5-2003 (Taiwan standard) almost superset of cp950.
    //  * Unicode-at-on (UAO) / Mozilla 1.8. Falling out of use on the Web. Not supported by other browsers.
    //  * Big5-HKSCS (-2001, -2004, -2008). Hong Kong standard. 
    //    many unicode code points moved from PUA to Supplementary plane (U+2XXXX) over the years.
    //    Plus, it has 4 combining sequences.
    //    Seems that Mozilla refused to support it for 10 yrs. https://bugzilla.mozilla.org/show_bug.cgi?id=162431 https://bugzilla.mozilla.org/show_bug.cgi?id=310299
    //    because big5-hkscs is the only encoding to include astral characters in non-algorithmic way.
    //    Implementations are not consistent within browsers; sometimes labeled as just big5.
    //    MS Internet Explorer switches from big5 to big5-hkscs when a patch applied.
    //    Great discussion & recap of what's going on https://bugzilla.mozilla.org/show_bug.cgi?id=912470#c31
    //    In the encoder, it might make sense to support encoding old PUA mappings to Big5 bytes seq-s.
    //    Official spec: http://www.ogcio.gov.hk/en/business/tech_promotion/ccli/terms/doc/2003cmp_2008.txt
    //                   http://www.ogcio.gov.hk/tc/business/tech_promotion/ccli/terms/doc/hkscs-2008-big5-iso.txt
    // 
    // Current understanding of how to deal with Big5(-HKSCS) is in the Encoding Standard, http://encoding.spec.whatwg.org/#big5-encoder
    // Unicode mapping (http://www.unicode.org/Public/MAPPINGS/OBSOLETE/EASTASIA/OTHER/BIG5.TXT) is said to be wrong.

    'windows950': 'cp950',
    '950': 'cp950',
    'cp950': {
        type: '_dbcs',
        table: function() { return require('./tables/cp950.json') },
    },

    // Big5 has many variations and is an extension of cp950. We use Encoding Standard's as a consensus.
    'big5': 'big5hkscs',
    'big5hkscs': {
        type: '_dbcs',
        table: function() { return require('./tables/cp950.json').concat(require('./tables/big5-added.json')) },
    },

    'cnbig5': 'big5hkscs',
    'csbig5': 'big5hkscs',
    'xxbig5': 'big5hkscs',

};

},{"./tables/big5-added.json":21,"./tables/cp936.json":22,"./tables/cp949.json":23,"./tables/cp950.json":24,"./tables/eucjp.json":25,"./tables/gb18030-ranges.json":26,"./tables/gbk-added.json":27,"./tables/shiftjis.json":28}],16:[function(require,module,exports){

// Update this array if you add/rename/remove files in this directory.
// We support Browserify by skipping automatic module discovery and requiring modules directly.
var modules = [
    require("./internal"),
    require("./utf16"),
    require("./utf7"),
    require("./sbcs-codec"),
    require("./sbcs-data"),
    require("./sbcs-data-generated"),
    require("./dbcs-codec"),
    require("./dbcs-data"),
];

// Put all encoding/alias/codec definitions to single object and export it. 
for (var i = 0; i < modules.length; i++) {
    var module = modules[i];
    for (var enc in module)
        if (Object.prototype.hasOwnProperty.call(module, enc))
            exports[enc] = module[enc];
}

},{"./dbcs-codec":14,"./dbcs-data":15,"./internal":17,"./sbcs-codec":18,"./sbcs-data":20,"./sbcs-data-generated":19,"./utf16":29,"./utf7":30}],17:[function(require,module,exports){
(function (Buffer){

// Export Node.js internal encodings.

var utf16lebom = new Buffer([0xFF, 0xFE]);

module.exports = {
    // Encodings
    utf8:   { type: "_internal", enc: "utf8" },
    cesu8:  { type: "_internal", enc: "utf8" },
    unicode11utf8: { type: "_internal", enc: "utf8" },
    ucs2:   { type: "_internal", enc: "ucs2", bom: utf16lebom },
    utf16le:{ type: "_internal", enc: "ucs2", bom: utf16lebom },
    binary: { type: "_internal", enc: "binary" },
    base64: { type: "_internal", enc: "base64" },
    hex:    { type: "_internal", enc: "hex" },

    // Codec.
    _internal: function(options) {
        if (!options || !options.enc)
            throw new Error("Internal codec is called without encoding type.")

        return {
            encoder: options.enc == "base64" ? encoderBase64 : encoderInternal,
            decoder: decoderInternal,

            enc: options.enc,
            bom: options.bom,
        };
    },
};

// We use node.js internal decoder. It's signature is the same as ours.
var StringDecoder = require('string_decoder').StringDecoder;

if (!StringDecoder.prototype.end) // Node v0.8 doesn't have this method.
    StringDecoder.prototype.end = function() {};

function decoderInternal() {
    return new StringDecoder(this.enc);
}

// Encoder is mostly trivial

function encoderInternal() {
    return {
        write: encodeInternal,
        end: function() {},
        
        enc: this.enc,
    }
}

function encodeInternal(str) {
    return new Buffer(str, this.enc);
}


// Except base64 encoder, which must keep its state.

function encoderBase64() {
    return {
        write: encodeBase64Write,
        end: encodeBase64End,

        prevStr: '',
    };
}

function encodeBase64Write(str) {
    str = this.prevStr + str;
    var completeQuads = str.length - (str.length % 4);
    this.prevStr = str.slice(completeQuads);
    str = str.slice(0, completeQuads);

    return new Buffer(str, "base64");
}

function encodeBase64End() {
    return new Buffer(this.prevStr, "base64");
}


}).call(this,require("buffer").Buffer)

},{"buffer":6,"string_decoder":12}],18:[function(require,module,exports){
(function (Buffer){

// Single-byte codec. Needs a 'chars' string parameter that contains 256 or 128 chars that
// correspond to encoded bytes (if 128 - then lower half is ASCII). 

exports._sbcs = function(options) {
    if (!options)
        throw new Error("SBCS codec is called without the data.")
    
    // Prepare char buffer for decoding.
    if (!options.chars || (options.chars.length !== 128 && options.chars.length !== 256))
        throw new Error("Encoding '"+options.type+"' has incorrect 'chars' (must be of len 128 or 256)");
    
    if (options.chars.length === 128) {
        var asciiString = "";
        for (var i = 0; i < 128; i++)
            asciiString += String.fromCharCode(i);
        options.chars = asciiString + options.chars;
    }

    var decodeBuf = new Buffer(options.chars, 'ucs2');
    
    // Encoding buffer.
    var encodeBuf = new Buffer(65536);
    encodeBuf.fill(options.iconv.defaultCharSingleByte.charCodeAt(0));

    for (var i = 0; i < options.chars.length; i++)
        encodeBuf[options.chars.charCodeAt(i)] = i;

    return {
        encoder: encoderSBCS,
        decoder: decoderSBCS,

        encodeBuf: encodeBuf,
        decodeBuf: decodeBuf,
    };
}

function encoderSBCS(options) {
    return {
        write: encoderSBCSWrite,
        end: function() {},

        encodeBuf: this.encodeBuf,
    };
}

function encoderSBCSWrite(str) {
    var buf = new Buffer(str.length);
    for (var i = 0; i < str.length; i++)
        buf[i] = this.encodeBuf[str.charCodeAt(i)];
    
    return buf;
}


function decoderSBCS(options) {
    return {
        write: decoderSBCSWrite,
        end: function() {},
        
        decodeBuf: this.decodeBuf,
    };
}

function decoderSBCSWrite(buf) {
    // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.
    var decodeBuf = this.decodeBuf;
    var newBuf = new Buffer(buf.length*2);
    var idx1 = 0, idx2 = 0;
    for (var i = 0, _len = buf.length; i < _len; i++) {
        idx1 = buf[i]*2; idx2 = i*2;
        newBuf[idx2] = decodeBuf[idx1];
        newBuf[idx2+1] = decodeBuf[idx1+1];
    }
    return newBuf.toString('ucs2');
}

}).call(this,require("buffer").Buffer)

},{"buffer":6}],19:[function(require,module,exports){

// Generated data for sbcs codec. Don't edit manually. Regenerate using generation/gen-sbcs.js script.
module.exports = {
  "437": "cp437",
  "737": "cp737",
  "775": "cp775",
  "850": "cp850",
  "852": "cp852",
  "855": "cp855",
  "856": "cp856",
  "857": "cp857",
  "858": "cp858",
  "860": "cp860",
  "861": "cp861",
  "862": "cp862",
  "863": "cp863",
  "864": "cp864",
  "865": "cp865",
  "866": "cp866",
  "869": "cp869",
  "874": "windows874",
  "922": "cp922",
  "1046": "cp1046",
  "1124": "cp1124",
  "1125": "cp1125",
  "1129": "cp1129",
  "1133": "cp1133",
  "1161": "cp1161",
  "1162": "cp1162",
  "1163": "cp1163",
  "1250": "windows1250",
  "1251": "windows1251",
  "1252": "windows1252",
  "1253": "windows1253",
  "1254": "windows1254",
  "1255": "windows1255",
  "1256": "windows1256",
  "1257": "windows1257",
  "1258": "windows1258",
  "28591": "iso88591",
  "28592": "iso88592",
  "28593": "iso88593",
  "28594": "iso88594",
  "28595": "iso88595",
  "28596": "iso88596",
  "28597": "iso88597",
  "28598": "iso88598",
  "28599": "iso88599",
  "28600": "iso885910",
  "28601": "iso885911",
  "28603": "iso885913",
  "28604": "iso885914",
  "28605": "iso885915",
  "28606": "iso885916",
  "windows874": {
    "type": "_sbcs",
    "chars": "€����…�����������‘’“”•–—�������� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  },
  "win874": "windows874",
  "cp874": "windows874",
  "windows1250": {
    "type": "_sbcs",
    "chars": "€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
  },
  "win1250": "windows1250",
  "cp1250": "windows1250",
  "windows1251": {
    "type": "_sbcs",
    "chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
  },
  "win1251": "windows1251",
  "cp1251": "windows1251",
  "windows1252": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "win1252": "windows1252",
  "cp1252": "windows1252",
  "windows1253": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›���� ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
  },
  "win1253": "windows1253",
  "cp1253": "windows1253",
  "windows1254": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ����‘’“”•–—˜™š›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
  },
  "win1254": "windows1254",
  "cp1254": "windows1254",
  "windows1255": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰�‹�����‘’“”•–—˜™�›���� ¡¢£₪¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾¿ְֱֲֳִֵֶַָֹ�ֻּֽ־ֿ׀ׁׂ׃װױײ׳״�������אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
  },
  "win1255": "windows1255",
  "cp1255": "windows1255",
  "windows1256": {
    "type": "_sbcs",
    "chars": "€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں ،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے"
  },
  "win1256": "windows1256",
  "cp1256": "windows1256",
  "windows1257": {
    "type": "_sbcs",
    "chars": "€�‚�„…†‡�‰�‹�¨ˇ¸�‘’“”•–—�™�›�¯˛� �¢£¤�¦§Ø©Ŗ«¬­®Æ°±²³´µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž˙"
  },
  "win1257": "windows1257",
  "cp1257": "windows1257",
  "windows1258": {
    "type": "_sbcs",
    "chars": "€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
  },
  "win1258": "windows1258",
  "cp1258": "windows1258",
  "iso88591": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "cp28591": "iso88591",
  "iso88592": {
    "type": "_sbcs",
    "chars": " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
  },
  "cp28592": "iso88592",
  "iso88593": {
    "type": "_sbcs",
    "chars": " Ħ˘£¤�Ĥ§¨İŞĞĴ­�Ż°ħ²³´µĥ·¸ışğĵ½�żÀÁÂ�ÄĊĈÇÈÉÊËÌÍÎÏ�ÑÒÓÔĠÖ×ĜÙÚÛÜŬŜßàáâ�äċĉçèéêëìíîï�ñòóôġö÷ĝùúûüŭŝ˙"
  },
  "cp28593": "iso88593",
  "iso88594": {
    "type": "_sbcs",
    "chars": " ĄĸŖ¤ĨĻ§¨ŠĒĢŦ­Ž¯°ą˛ŗ´ĩļˇ¸šēģŧŊžŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎĪĐŅŌĶÔÕÖ×ØŲÚÛÜŨŪßāáâãäåæįčéęëėíîīđņōķôõö÷øųúûüũū˙"
  },
  "cp28594": "iso88594",
  "iso88595": {
    "type": "_sbcs",
    "chars": " ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђѓєѕіїјљњћќ§ўџ"
  },
  "cp28595": "iso88595",
  "iso88596": {
    "type": "_sbcs",
    "chars": " ���¤�������،­�������������؛���؟�ءآأؤإئابةتثجحخدذرزسشصضطظعغ�����ـفقكلمنهوىيًٌٍَُِّْ�������������"
  },
  "cp28596": "iso88596",
  "iso88597": {
    "type": "_sbcs",
    "chars": " ‘’£€₯¦§¨©ͺ«¬­�―°±²³΄΅Ά·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
  },
  "cp28597": "iso88597",
  "iso88598": {
    "type": "_sbcs",
    "chars": " �¢£¤¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾��������������������������������‗אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
  },
  "cp28598": "iso88598",
  "iso88599": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
  },
  "cp28599": "iso88599",
  "iso885910": {
    "type": "_sbcs",
    "chars": " ĄĒĢĪĨĶ§ĻĐŠŦŽ­ŪŊ°ąēģīĩķ·ļđšŧž―ūŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎÏÐŅŌÓÔÕÖŨØŲÚÛÜÝÞßāáâãäåæįčéęëėíîïðņōóôõöũøųúûüýþĸ"
  },
  "cp28600": "iso885910",
  "iso885911": {
    "type": "_sbcs",
    "chars": " กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  },
  "cp28601": "iso885911",
  "iso885913": {
    "type": "_sbcs",
    "chars": " ”¢£¤„¦§Ø©Ŗ«¬­®Æ°±²³“µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž’"
  },
  "cp28603": "iso885913",
  "iso885914": {
    "type": "_sbcs",
    "chars": " Ḃḃ£ĊċḊ§Ẁ©ẂḋỲ­®ŸḞḟĠġṀṁ¶ṖẁṗẃṠỳẄẅṡÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŴÑÒÓÔÕÖṪØÙÚÛÜÝŶßàáâãäåæçèéêëìíîïŵñòóôõöṫøùúûüýŷÿ"
  },
  "cp28604": "iso885914",
  "iso885915": {
    "type": "_sbcs",
    "chars": " ¡¢£€¥Š§š©ª«¬­®¯°±²³Žµ¶·ž¹º»ŒœŸ¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "cp28605": "iso885915",
  "iso885916": {
    "type": "_sbcs",
    "chars": " ĄąŁ€„Š§š©Ș«Ź­źŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ"
  },
  "cp28606": "iso885916",
  "cp437": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm437": "cp437",
  "csibm437": "cp437",
  "cp737": {
    "type": "_sbcs",
    "chars": "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ωάέήϊίόύϋώΆΈΉΊΌΎΏ±≥≤ΪΫ÷≈°∙·√ⁿ²■ "
  },
  "ibm737": "cp737",
  "csibm737": "cp737",
  "cp775": {
    "type": "_sbcs",
    "chars": "ĆüéāäģåćłēŖŗīŹÄÅÉæÆōöĢ¢ŚśÖÜø£Ø×¤ĀĪóŻżź”¦©®¬½¼Ł«»░▒▓│┤ĄČĘĖ╣║╗╝ĮŠ┐└┴┬├─┼ŲŪ╚╔╩╦╠═╬Žąčęėįšųūž┘┌█▄▌▐▀ÓßŌŃõÕµńĶķĻļņĒŅ’­±“¾¶§÷„°∙·¹³²■ "
  },
  "ibm775": "cp775",
  "csibm775": "cp775",
  "cp850": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
  },
  "ibm850": "cp850",
  "csibm850": "cp850",
  "cp852": {
    "type": "_sbcs",
    "chars": "ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ "
  },
  "ibm852": "cp852",
  "csibm852": "cp852",
  "cp855": {
    "type": "_sbcs",
    "chars": "ђЂѓЃёЁєЄѕЅіІїЇјЈљЉњЊћЋќЌўЎџЏюЮъЪаАбБцЦдДеЕфФгГ«»░▒▓│┤хХиИ╣║╗╝йЙ┐└┴┬├─┼кК╚╔╩╦╠═╬¤лЛмМнНоОп┘┌█▄Пя▀ЯрРсСтТуУжЖвВьЬ№­ыЫзЗшШэЭщЩчЧ§■ "
  },
  "ibm855": "cp855",
  "csibm855": "cp855",
  "cp856": {
    "type": "_sbcs",
    "chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת�£�×����������®¬½¼�«»░▒▓│┤���©╣║╗╝¢¥┐└┴┬├─┼��╚╔╩╦╠═╬¤���������┘┌█▄¦�▀������µ�������¯´­±‗¾¶§÷¸°¨·¹³²■ "
  },
  "ibm856": "cp856",
  "csibm856": "cp856",
  "cp857": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîıÄÅÉæÆôöòûùİÖÜø£ØŞşáíóúñÑĞğ¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ºªÊËÈ�ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµ�×ÚÛÙìÿ¯´­±�¾¶§÷¸°¨·¹³²■ "
  },
  "ibm857": "cp857",
  "csibm857": "cp857",
  "cp858": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
  },
  "ibm858": "cp858",
  "csibm858": "cp858",
  "cp860": {
    "type": "_sbcs",
    "chars": "ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm860": "cp860",
  "csibm860": "cp860",
  "cp861": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèÐðÞÄÅÉæÆôöþûÝýÖÜø£Ø₧ƒáíóúÁÍÓÚ¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm861": "cp861",
  "csibm861": "cp861",
  "cp862": {
    "type": "_sbcs",
    "chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm862": "cp862",
  "csibm862": "cp862",
  "cp863": {
    "type": "_sbcs",
    "chars": "ÇüéâÂà¶çêëèïî‗À§ÉÈÊôËÏûù¤ÔÜ¢£ÙÛƒ¦´óú¨¸³¯Î⌐¬½¼¾«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm863": "cp863",
  "csibm863": "cp863",
  "cp864": {
    "type": "_sbcs",
    "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$٪&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·∙√▒─│┼┤┬├┴┐┌└┘β∞φ±½¼≈«»ﻷﻸ��ﻻﻼ� ­ﺂ£¤ﺄ��ﺎﺏﺕﺙ،ﺝﺡﺥ٠١٢٣٤٥٦٧٨٩ﻑ؛ﺱﺵﺹ؟¢ﺀﺁﺃﺅﻊﺋﺍﺑﺓﺗﺛﺟﺣﺧﺩﺫﺭﺯﺳﺷﺻﺿﻁﻅﻋﻏ¦¬÷×ﻉـﻓﻗﻛﻟﻣﻧﻫﻭﻯﻳﺽﻌﻎﻍﻡﹽّﻥﻩﻬﻰﻲﻐﻕﻵﻶﻝﻙﻱ■�"
  },
  "ibm864": "cp864",
  "csibm864": "cp864",
  "cp865": {
    "type": "_sbcs",
    "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø₧ƒáíóúñÑªº¿⌐¬½¼¡«¤░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  },
  "ibm865": "cp865",
  "csibm865": "cp865",
  "cp866": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ "
  },
  "ibm866": "cp866",
  "csibm866": "cp866",
  "cp869": {
    "type": "_sbcs",
    "chars": "������Ά�·¬¦‘’Έ―ΉΊΪΌ��ΎΫ©Ώ²³ά£έήίϊΐόύΑΒΓΔΕΖΗ½ΘΙ«»░▒▓│┤ΚΛΜΝ╣║╗╝ΞΟ┐└┴┬├─┼ΠΡ╚╔╩╦╠═╬ΣΤΥΦΧΨΩαβγ┘┌█▄δε▀ζηθικλμνξοπρσςτ΄­±υφχ§ψ΅°¨ωϋΰώ■ "
  },
  "ibm869": "cp869",
  "csibm869": "cp869",
  "cp922": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§¨©ª«¬­®‾°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŠÑÒÓÔÕÖ×ØÙÚÛÜÝŽßàáâãäåæçèéêëìíîïšñòóôõö÷øùúûüýžÿ"
  },
  "ibm922": "cp922",
  "csibm922": "cp922",
  "cp1046": {
    "type": "_sbcs",
    "chars": "ﺈ×÷ﹱ■│─┐┌└┘ﹹﹻﹽﹿﹷﺊﻰﻳﻲﻎﻏﻐﻶﻸﻺﻼ ¤ﺋﺑﺗﺛﺟﺣ،­ﺧﺳ٠١٢٣٤٥٦٧٨٩ﺷ؛ﺻﺿﻊ؟ﻋءآأؤإئابةتثجحخدذرزسشصضطﻇعغﻌﺂﺄﺎﻓـفقكلمنهوىيًٌٍَُِّْﻗﻛﻟﻵﻷﻹﻻﻣﻧﻬﻩ�"
  },
  "ibm1046": "cp1046",
  "csibm1046": "cp1046",
  "cp1124": {
    "type": "_sbcs",
    "chars": " ЁЂҐЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђґєѕіїјљњћќ§ўџ"
  },
  "ibm1124": "cp1124",
  "csibm1124": "cp1124",
  "cp1125": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёҐґЄєІіЇї·√№¤■ "
  },
  "ibm1125": "cp1125",
  "csibm1125": "cp1125",
  "cp1129": {
    "type": "_sbcs",
    "chars": " ¡¢£¤¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
  },
  "ibm1129": "cp1129",
  "csibm1129": "cp1129",
  "cp1133": {
    "type": "_sbcs",
    "chars": " ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ���ຯະາຳິີຶືຸູຼັົຽ���ເແໂໃໄ່້໊໋໌ໍໆ�ໜໝ₭����������������໐໑໒໓໔໕໖໗໘໙��¢¬¦�"
  },
  "ibm1133": "cp1133",
  "csibm1133": "cp1133",
  "cp1161": {
    "type": "_sbcs",
    "chars": "��������������������������������่กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู้๊๋€฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛¢¬¦ "
  },
  "ibm1161": "cp1161",
  "csibm1161": "cp1161",
  "cp1162": {
    "type": "_sbcs",
    "chars": "€…‘’“”•–— กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  },
  "ibm1162": "cp1162",
  "csibm1162": "cp1162",
  "cp1163": {
    "type": "_sbcs",
    "chars": " ¡¢£€¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
  },
  "ibm1163": "cp1163",
  "csibm1163": "cp1163",
  "maccroatian": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊�©⁄¤‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ"
  },
  "maccyrillic": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°¢£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµ∂ЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
  },
  "macgreek": {
    "type": "_sbcs",
    "chars": "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦­ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ�"
  },
  "maciceland": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macroman": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macromania": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂŞ∞±≤≥¥µ∂∑∏π∫ªºΩăş¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›Ţţ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macthai": {
    "type": "_sbcs",
    "chars": "«»…“”�•‘’� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู﻿​–—฿เแโใไๅๆ็่้๊๋์ํ™๏๐๑๒๓๔๕๖๗๘๙®©����"
  },
  "macturkish": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙ�ˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "macukraine": {
    "type": "_sbcs",
    "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
  },
  "koi8r": {
    "type": "_sbcs",
    "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "koi8u": {
    "type": "_sbcs",
    "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґ╝╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪Ґ╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "koi8ru": {
    "type": "_sbcs",
    "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "koi8t": {
    "type": "_sbcs",
    "chars": "қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬­®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
  },
  "armscii8": {
    "type": "_sbcs",
    "chars": " �և։)(»«—.՝,-֊…՜՛՞ԱաԲբԳգԴդԵեԶզԷէԸըԹթԺժԻիԼլԽխԾծԿկՀհՁձՂղՃճՄմՅյՆնՇշՈոՉչՊպՋջՌռՍսՎվՏտՐրՑցՒւՓփՔքՕօՖֆ՚�"
  },
  "rk1048": {
    "type": "_sbcs",
    "chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊҚҺЏђ‘’“”•–—�™љ›њқһџ ҰұӘ¤Ө¦§Ё©Ғ«¬­®Ү°±Ііөµ¶·ё№ғ»әҢңүАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
  },
  "tcvn": {
    "type": "_sbcs",
    "chars": "\u0000ÚỤ\u0003ỪỬỮ\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010ỨỰỲỶỸÝỴ\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀẢÃÁẠẶẬÈẺẼÉẸỆÌỈĨÍỊÒỎÕÓỌỘỜỞỠỚỢÙỦŨ ĂÂÊÔƠƯĐăâêôơưđẶ̀̀̉̃́àảãáạẲằẳẵắẴẮẦẨẪẤỀặầẩẫấậèỂẻẽéẹềểễếệìỉỄẾỒĩíịòỔỏõóọồổỗốộờởỡớợùỖủũúụừửữứựỳỷỹýỵỐ"
  },
  "georgianacademy": {
    "type": "_sbcs",
    "chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "georgianps": {
    "type": "_sbcs",
    "chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
  },
  "pt154": {
    "type": "_sbcs",
    "chars": "ҖҒӮғ„…ҶҮҲүҠӢҢҚҺҸҗ‘’“”•–—ҳҷҡӣңқһҹ ЎўЈӨҘҰ§Ё©Ә«¬ӯ®Ҝ°ұІіҙө¶·ё№ә»јҪҫҝАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
  },
  "viscii": {
    "type": "_sbcs",
    "chars": "\u0000\u0001Ẳ\u0003\u0004ẴẪ\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013Ỷ\u0015\u0016\u0017\u0018Ỹ\u001a\u001b\u001c\u001dỴ\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ẠẮẰẶẤẦẨẬẼẸẾỀỂỄỆỐỒỔỖỘỢỚỜỞỊỎỌỈỦŨỤỲÕắằặấầẩậẽẹếềểễệốồổỗỠƠộờởịỰỨỪỬơớƯÀÁÂÃẢĂẳẵÈÉÊẺÌÍĨỳĐứÒÓÔạỷừửÙÚỹỵÝỡưàáâãảăữẫèéêẻìíĩỉđựòóôõỏọụùúũủýợỮ"
  },
  "iso646cn": {
    "type": "_sbcs",
    "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#¥%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
  },
  "iso646jp": {
    "type": "_sbcs",
    "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[¥]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
  },
  "hproman8": {
    "type": "_sbcs",
    "chars": " ÀÂÈÊËÎÏ´ˋˆ¨˜ÙÛ₤¯Ýý°ÇçÑñ¡¿¤£¥§ƒ¢âêôûáéóúàèòùäëöüÅîØÆåíøæÄìÖÜÉïßÔÁÃãÐðÍÌÓÒÕõŠšÚŸÿÞþ·µ¶¾—¼½ªº«■»±�"
  },
  "macintosh": {
    "type": "_sbcs",
    "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
  },
  "ascii": {
    "type": "_sbcs",
    "chars": "��������������������������������������������������������������������������������������������������������������������������������"
  },
  "tis620": {
    "type": "_sbcs",
    "chars": "���������������������������������กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
  }
}
},{}],20:[function(require,module,exports){

// Manually added data to be used by sbcs codec in addition to generated one.

module.exports = {
    // Not supported by iconv, not sure why.
    "10029": "maccenteuro",
    "maccenteuro": {
        "type": "_sbcs",
        "chars": "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ"
    },

    "808": "cp808",
    "ibm808": "cp808",
    "cp808": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■ "
    },

    // Aliases of generated encodings.
    "ascii8bit": "ascii",
    "usascii": "ascii",
    "ansix34": "ascii",
    "ansix341968": "ascii",
    "ansix341986": "ascii",
    "csascii": "ascii",
    "cp367": "ascii",
    "ibm367": "ascii",
    "isoir6": "ascii",
    "iso646us": "ascii",
    "iso646irv": "ascii",
    "us": "ascii",

    "latin1": "iso88591",
    "latin2": "iso88592",
    "latin3": "iso88593",
    "latin4": "iso88594",
    "latin5": "iso88599",
    "latin6": "iso885910",
    "latin7": "iso885913",
    "latin8": "iso885914",
    "latin9": "iso885915",
    "latin10": "iso885916",

    "csisolatin1": "iso88591",
    "csisolatin2": "iso88592",
    "csisolatin3": "iso88593",
    "csisolatin4": "iso88594",
    "csisolatincyrillic": "iso88595",
    "csisolatinarabic": "iso88596",
    "csisolatingreek" : "iso88597",
    "csisolatinhebrew": "iso88598",
    "csisolatin5": "iso88599",
    "csisolatin6": "iso885910",

    "l1": "iso88591",
    "l2": "iso88592",
    "l3": "iso88593",
    "l4": "iso88594",
    "l5": "iso88599",
    "l6": "iso885910",
    "l7": "iso885913",
    "l8": "iso885914",
    "l9": "iso885915",
    "l10": "iso885916",

    "isoir14": "iso646jp",
    "isoir57": "iso646cn",
    "isoir100": "iso88591",
    "isoir101": "iso88592",
    "isoir109": "iso88593",
    "isoir110": "iso88594",
    "isoir144": "iso88595",
    "isoir127": "iso88596",
    "isoir126": "iso88597",
    "isoir138": "iso88598",
    "isoir148": "iso88599",
    "isoir157": "iso885910",
    "isoir166": "tis620",
    "isoir179": "iso885913",
    "isoir199": "iso885914",
    "isoir203": "iso885915",
    "isoir226": "iso885916",

    "cp819": "iso88591",
    "ibm819": "iso88591",

    "cyrillic": "iso88595",

    "arabic": "iso88596",
    "arabic8": "iso88596",
    "ecma114": "iso88596",
    "asmo708": "iso88596",

    "greek" : "iso88597",
    "greek8" : "iso88597",
    "ecma118" : "iso88597",
    "elot928" : "iso88597",

    "hebrew": "iso88598",
    "hebrew8": "iso88598",

    "turkish": "iso88599",
    "turkish8": "iso88599",

    "thai": "iso885911",
    "thai8": "iso885911",

    "celtic": "iso885914",
    "celtic8": "iso885914",
    "isoceltic": "iso885914",

    "tis6200": "tis620",
    "tis62025291": "tis620",
    "tis62025330": "tis620",

    "10000": "macroman",
    "10006": "macgreek",
    "10007": "maccyrillic",
    "10079": "maciceland",
    "10081": "macturkish",

    "cspc8codepage437": "cp437",
    "cspc775baltic": "cp775",
    "cspc850multilingual": "cp850",
    "cspcp852": "cp852",
    "cspc862latinhebrew": "cp862",
    "cpgr": "cp869",

    "msee": "cp1250",
    "mscyrl": "cp1251",
    "msansi": "cp1252",
    "msgreek": "cp1253",
    "msturk": "cp1254",
    "mshebr": "cp1255",
    "msarab": "cp1256",
    "winbaltrim": "cp1257",

    "cp20866": "koi8r",
    "20866": "koi8r",
    "ibm878": "koi8r",
    "cskoi8r": "koi8r",

    "cp21866": "koi8u",
    "21866": "koi8u",
    "ibm1168": "koi8u",

    "strk10482002": "rk1048",

    "tcvn5712": "tcvn",
    "tcvn57121": "tcvn",

    "gb198880": "iso646cn",
    "cn": "iso646cn",

    "csiso14jisc6220ro": "iso646jp",
    "jisc62201969ro": "iso646jp",
    "jp": "iso646jp",

    "cshproman8": "hproman8",
    "r8": "hproman8",
    "roman8": "hproman8",
    "xroman8": "hproman8",
    "ibm1051": "hproman8",

    "mac": "macintosh",
    "csmacintosh": "macintosh",
};


},{}],21:[function(require,module,exports){
module.exports=[
["8740","䏰䰲䘃䖦䕸𧉧䵷䖳𧲱䳢𧳅㮕䜶䝄䱇䱀𤊿𣘗𧍒𦺋𧃒䱗𪍑䝏䗚䲅𧱬䴇䪤䚡𦬣爥𥩔𡩣𣸆𣽡晍囻"],
["8767","綕夝𨮹㷴霴𧯯寛𡵞媤㘥𩺰嫑宷峼杮薓𩥅瑡璝㡵𡵓𣚞𦀡㻬"],
["87a1","𥣞㫵竼龗𤅡𨤍𣇪𠪊𣉞䌊蒄龖鐯䤰蘓墖靊鈘秐稲晠権袝瑌篅枂稬剏遆㓦珄𥶹瓆鿇垳䤯呌䄱𣚎堘穲𧭥讏䚮𦺈䆁𥶙箮𢒼鿈𢓁𢓉𢓌鿉蔄𣖻䂴鿊䓡𪷿拁灮鿋"],
["8840","㇀",4,"𠄌㇅𠃑𠃍㇆㇇𠃋𡿨㇈𠃊㇉㇊㇋㇌𠄎㇍㇎ĀÁǍÀĒÉĚÈŌÓǑÒ࿿Ê̄Ế࿿Ê̌ỀÊāáǎàɑēéěèīíǐìōóǒòūúǔùǖǘǚ"],
["88a1","ǜü࿿ê̄ế࿿ê̌ềêɡ⏚⏛"],
["8940","𪎩𡅅"],
["8943","攊"],
["8946","丽滝鵎釟"],
["894c","𧜵撑会伨侨兖兴农凤务动医华发变团声处备夲头学实実岚庆总斉柾栄桥济炼电纤纬纺织经统缆缷艺苏药视设询车轧轮"],
["89a1","琑糼緍楆竉刧"],
["89ab","醌碸酞肼"],
["89b0","贋胶𠧧"],
["89b5","肟黇䳍鷉鸌䰾𩷶𧀎鸊𪄳㗁"],
["89c1","溚舾甙"],
["89c5","䤑马骏龙禇𨑬𡷊𠗐𢫦两亁亀亇亿仫伷㑌侽㹈倃傈㑽㒓㒥円夅凛凼刅争剹劐匧㗇厩㕑厰㕓参吣㕭㕲㚁咓咣咴咹哐哯唘唣唨㖘唿㖥㖿嗗㗅"],
["8a40","𧶄唥"],
["8a43","𠱂𠴕𥄫喐𢳆㧬𠍁蹆𤶸𩓥䁓𨂾睺𢰸㨴䟕𨅝𦧲𤷪擝𠵼𠾴𠳕𡃴撍蹾𠺖𠰋𠽤𢲩𨉖𤓓"],
["8a64","𠵆𩩍𨃩䟴𤺧𢳂骲㩧𩗴㿭㔆𥋇𩟔𧣈𢵄鵮頕"],
["8a76","䏙𦂥撴哣𢵌𢯊𡁷㧻𡁯"],
["8aa1","𦛚𦜖𧦠擪𥁒𠱃蹨𢆡𨭌𠜱"],
["8aac","䠋𠆩㿺塳𢶍"],
["8ab2","𤗈𠓼𦂗𠽌𠶖啹䂻䎺"],
["8abb","䪴𢩦𡂝膪飵𠶜捹㧾𢝵跀嚡摼㹃"],
["8ac9","𪘁𠸉𢫏𢳉"],
["8ace","𡃈𣧂㦒㨆𨊛㕸𥹉𢃇噒𠼱𢲲𩜠㒼氽𤸻"],
["8adf","𧕴𢺋𢈈𪙛𨳍𠹺𠰴𦠜羓𡃏𢠃𢤹㗻𥇣𠺌𠾍𠺪㾓𠼰𠵇𡅏𠹌"],
["8af6","𠺫𠮩𠵈𡃀𡄽㿹𢚖搲𠾭"],
["8b40","𣏴𧘹𢯎𠵾𠵿𢱑𢱕㨘𠺘𡃇𠼮𪘲𦭐𨳒𨶙𨳊閪哌苄喹"],
["8b55","𩻃鰦骶𧝞𢷮煀腭胬尜𦕲脴㞗卟𨂽醶𠻺𠸏𠹷𠻻㗝𤷫㘉𠳖嚯𢞵𡃉𠸐𠹸𡁸𡅈𨈇𡑕𠹹𤹐𢶤婔𡀝𡀞𡃵𡃶垜𠸑"],
["8ba1","𧚔𨋍𠾵𠹻𥅾㜃𠾶𡆀𥋘𪊽𤧚𡠺𤅷𨉼墙剨㘚𥜽箲孨䠀䬬鼧䧧鰟鮍𥭴𣄽嗻㗲嚉丨夂𡯁屮靑𠂆乛亻㔾尣彑忄㣺扌攵歺氵氺灬爫丬犭𤣩罒礻糹罓𦉪㓁"],
["8bde","𦍋耂肀𦘒𦥑卝衤见𧢲讠贝钅镸长门𨸏韦页风飞饣𩠐鱼鸟黄歯龜丷𠂇阝户钢"],
["8c40","倻淾𩱳龦㷉袏𤅎灷峵䬠𥇍㕙𥴰愢𨨲辧釶熑朙玺𣊁𪄇㲋𡦀䬐磤琂冮𨜏䀉橣𪊺䈣蘏𠩯稪𩥇𨫪靕灍匤𢁾鏴盙𨧣龧矝亣俰傼丯众龨吴綋墒壐𡶶庒庙忂𢜒斋"],
["8ca1","𣏹椙橃𣱣泿"],
["8ca7","爀𤔅玌㻛𤨓嬕璹讃𥲤𥚕窓篬糃繬苸薗龩袐龪躹龫迏蕟駠鈡龬𨶹𡐿䁱䊢娚"],
["8cc9","顨杫䉶圽"],
["8cce","藖𤥻芿𧄍䲁𦵴嵻𦬕𦾾龭龮宖龯曧繛湗秊㶈䓃𣉖𢞖䎚䔶"],
["8ce6","峕𣬚諹屸㴒𣕑嵸龲煗䕘𤃬𡸣䱷㥸㑊𠆤𦱁諌侴𠈹妿腬顖𩣺弻"],
["8d40","𠮟"],
["8d42","𢇁𨥭䄂䚻𩁹㼇龳𪆵䃸㟖䛷𦱆䅼𨚲𧏿䕭㣔𥒚䕡䔛䶉䱻䵶䗪㿈𤬏㙡䓞䒽䇭崾嵈嵖㷼㠏嶤嶹㠠㠸幂庽弥徃㤈㤔㤿㥍惗愽峥㦉憷憹懏㦸戬抐拥挘㧸嚱"],
["8da1","㨃揢揻搇摚㩋擀崕嘡龟㪗斆㪽旿晓㫲暒㬢朖㭂枤栀㭘桊梄㭲㭱㭻椉楃牜楤榟榅㮼槖㯝橥橴橱檂㯬檙㯲檫檵櫔櫶殁毁毪汵沪㳋洂洆洦涁㳯涤涱渕渘温溆𨧀溻滢滚齿滨滩漤漴㵆𣽁澁澾㵪㵵熷岙㶊瀬㶑灐灔灯灿炉𠌥䏁㗱𠻘"],
["8e40","𣻗垾𦻓焾𥟠㙎榢𨯩孴穉𥣡𩓙穥穽𥦬窻窰竂竃燑𦒍䇊竚竝竪䇯咲𥰁笋筕笩𥌎𥳾箢筯莜𥮴𦱿篐萡箒箸𥴠㶭𥱥蒒篺簆簵𥳁籄粃𤢂粦晽𤕸糉糇糦籴糳糵糎"],
["8ea1","繧䔝𦹄絝𦻖璍綉綫焵綳緒𤁗𦀩緤㴓緵𡟹緥𨍭縝𦄡𦅚繮纒䌫鑬縧罀罁罇礶𦋐駡羗𦍑羣𡙡𠁨䕜𣝦䔃𨌺翺𦒉者耈耝耨耯𪂇𦳃耻耼聡𢜔䦉𦘦𣷣𦛨朥肧𨩈脇脚墰𢛶汿𦒘𤾸擧𡒊舘𡡞橓𤩥𤪕䑺舩𠬍𦩒𣵾俹𡓽蓢荢𦬊𤦧𣔰𡝳𣷸芪椛芳䇛"],
["8f40","蕋苐茚𠸖𡞴㛁𣅽𣕚艻苢茘𣺋𦶣𦬅𦮗𣗎㶿茝嗬莅䔋𦶥莬菁菓㑾𦻔橗蕚㒖𦹂𢻯葘𥯤葱㷓䓤檧葊𣲵祘蒨𦮖𦹷𦹃蓞萏莑䒠蒓蓤𥲑䉀𥳀䕃蔴嫲𦺙䔧蕳䔖枿蘖"],
["8fa1","𨘥𨘻藁𧂈蘂𡖂𧃍䕫䕪蘨㙈𡢢号𧎚虾蝱𪃸蟮𢰧螱蟚蠏噡虬桖䘏衅衆𧗠𣶹𧗤衞袜䙛袴袵揁装睷𧜏覇覊覦覩覧覼𨨥觧𧤤𧪽誜瞓釾誐𧩙竩𧬺𣾏䜓𧬸煼謌謟𥐰𥕥謿譌譍誩𤩺讐讛誯𡛟䘕衏貛𧵔𧶏貫㜥𧵓賖𧶘𧶽贒贃𡤐賛灜贑𤳉㻐起"],
["9040","趩𨀂𡀔𤦊㭼𨆼𧄌竧躭躶軃鋔輙輭𨍥𨐒辥錃𪊟𠩐辳䤪𨧞𨔽𣶻廸𣉢迹𪀔𨚼𨔁𢌥㦀𦻗逷𨔼𧪾遡𨕬𨘋邨𨜓郄𨛦邮都酧㫰醩釄粬𨤳𡺉鈎沟鉁鉢𥖹銹𨫆𣲛𨬌𥗛"],
["90a1","𠴱錬鍫𨫡𨯫炏嫃𨫢𨫥䥥鉄𨯬𨰹𨯿鍳鑛躼閅閦鐦閠濶䊹𢙺𨛘𡉼𣸮䧟氜陻隖䅬隣𦻕懚隶磵𨫠隽双䦡𦲸𠉴𦐐𩂯𩃥𤫑𡤕𣌊霱虂霶䨏䔽䖅𤫩灵孁霛靜𩇕靗孊𩇫靟鐥僐𣂷𣂼鞉鞟鞱鞾韀韒韠𥑬韮琜𩐳響韵𩐝𧥺䫑頴頳顋顦㬎𧅵㵑𠘰𤅜"],
["9140","𥜆飊颷飈飇䫿𦴧𡛓喰飡飦飬鍸餹𤨩䭲𩡗𩤅駵騌騻騐驘𥜥㛄𩂱𩯕髠髢𩬅髴䰎鬔鬭𨘀倴鬴𦦨㣃𣁽魐魀𩴾婅𡡣鮎𤉋鰂鯿鰌𩹨鷔𩾷𪆒𪆫𪃡𪄣𪇟鵾鶃𪄴鸎梈"],
["91a1","鷄𢅛𪆓𪈠𡤻𪈳鴹𪂹𪊴麐麕麞麢䴴麪麯𤍤黁㭠㧥㴝伲㞾𨰫鼂鼈䮖鐤𦶢鼗鼖鼹嚟嚊齅馸𩂋韲葿齢齩竜龎爖䮾𤥵𤦻煷𤧸𤍈𤩑玞𨯚𡣺禟𨥾𨸶鍩鏳𨩄鋬鎁鏋𨥬𤒹爗㻫睲穃烐𤑳𤏸煾𡟯炣𡢾𣖙㻇𡢅𥐯𡟸㜢𡛻𡠹㛡𡝴𡣑𥽋㜣𡛀坛𤨥𡏾𡊨"],
["9240","𡏆𡒶蔃𣚦蔃葕𤦔𧅥𣸱𥕜𣻻𧁒䓴𣛮𩦝𦼦柹㜳㰕㷧塬𡤢栐䁗𣜿𤃡𤂋𤄏𦰡哋嚞𦚱嚒𠿟𠮨𠸍鏆𨬓鎜仸儫㠙𤐶亼𠑥𠍿佋侊𥙑婨𠆫𠏋㦙𠌊𠐔㐵伩𠋀𨺳𠉵諚𠈌亘"],
["92a1","働儍侢伃𤨎𣺊佂倮偬傁俌俥偘僼兙兛兝兞湶𣖕𣸹𣺿浲𡢄𣺉冨凃𠗠䓝𠒣𠒒𠒑赺𨪜𠜎剙劤𠡳勡鍮䙺熌𤎌𠰠𤦬𡃤槑𠸝瑹㻞璙琔瑖玘䮎𤪼𤂍叐㖄爏𤃉喴𠍅响𠯆圝鉝雴鍦埝垍坿㘾壋媙𨩆𡛺𡝯𡜐娬妸銏婾嫏娒𥥆𡧳𡡡𤊕㛵洅瑃娡𥺃"],
["9340","媁𨯗𠐓鏠璌𡌃焅䥲鐈𨧻鎽㞠尞岞幞幈𡦖𡥼𣫮廍孏𡤃𡤄㜁𡢠㛝𡛾㛓脪𨩇𡶺𣑲𨦨弌弎𡤧𡞫婫𡜻孄蘔𧗽衠恾𢡠𢘫忛㺸𢖯𢖾𩂈𦽳懀𠀾𠁆𢘛憙憘恵𢲛𢴇𤛔𩅍"],
["93a1","摱𤙥𢭪㨩𢬢𣑐𩣪𢹸挷𪑛撶挱揑𤧣𢵧护𢲡搻敫楲㯴𣂎𣊭𤦉𣊫唍𣋠𡣙𩐿曎𣊉𣆳㫠䆐𥖄𨬢𥖏𡛼𥕛𥐥磮𣄃𡠪𣈴㑤𣈏𣆂𤋉暎𦴤晫䮓昰𧡰𡷫晣𣋒𣋡昞𥡲㣑𣠺𣞼㮙𣞢𣏾瓐㮖枏𤘪梶栞㯄檾㡣𣟕𤒇樳橒櫉欅𡤒攑梘橌㯗橺歗𣿀𣲚鎠鋲𨯪𨫋"],
["9440","銉𨀞𨧜鑧涥漋𤧬浧𣽿㶏渄𤀼娽渊塇洤硂焻𤌚𤉶烱牐犇犔𤞏𤜥兹𤪤𠗫瑺𣻸𣙟𤩊𤤗𥿡㼆㺱𤫟𨰣𣼵悧㻳瓌琼鎇琷䒟𦷪䕑疃㽣𤳙𤴆㽘畕癳𪗆㬙瑨𨫌𤦫𤦎㫻"],
["94a1","㷍𤩎㻿𤧅𤣳釺圲鍂𨫣𡡤僟𥈡𥇧睸𣈲眎眏睻𤚗𣞁㩞𤣰琸璛㺿𤪺𤫇䃈𤪖𦆮錇𥖁砞碍碈磒珐祙𧝁𥛣䄎禛蒖禥樭𣻺稺秴䅮𡛦䄲鈵秱𠵌𤦌𠊙𣶺𡝮㖗啫㕰㚪𠇔𠰍竢婙𢛵𥪯𥪜娍𠉛磰娪𥯆竾䇹籝籭䈑𥮳𥺼𥺦糍𤧹𡞰粎籼粮檲緜縇緓罎𦉡"],
["9540","𦅜𧭈綗𥺂䉪𦭵𠤖柖𠁎𣗏埄𦐒𦏸𤥢翝笧𠠬𥫩𥵃笌𥸎駦虅驣樜𣐿㧢𤧷𦖭騟𦖠蒀𧄧𦳑䓪脷䐂胆脉腂𦞴飃𦩂艢艥𦩑葓𦶧蘐𧈛媆䅿𡡀嬫𡢡嫤𡣘蚠蜨𣶏蠭𧐢娂"],
["95a1","衮佅袇袿裦襥襍𥚃襔𧞅𧞄𨯵𨯙𨮜𨧹㺭蒣䛵䛏㟲訽訜𩑈彍鈫𤊄旔焩烄𡡅鵭貟賩𧷜妚矃姰䍮㛔踪躧𤰉輰轊䋴汘澻𢌡䢛潹溋𡟚鯩㚵𤤯邻邗啱䤆醻鐄𨩋䁢𨫼鐧𨰝𨰻蓥訫閙閧閗閖𨴴瑅㻂𤣿𤩂𤏪㻧𣈥随𨻧𨹦𨹥㻌𤧭𤩸𣿮琒瑫㻼靁𩂰"],
["9640","桇䨝𩂓𥟟靝鍨𨦉𨰦𨬯𦎾銺嬑譩䤼珹𤈛鞛靱餸𠼦巁𨯅𤪲頟𩓚鋶𩗗釥䓀𨭐𤩧𨭤飜𨩅㼀鈪䤥萔餻饍𧬆㷽馛䭯馪驜𨭥𥣈檏騡嫾騯𩣱䮐𩥈馼䮽䮗鍽塲𡌂堢𤦸"],
["96a1","𡓨硄𢜟𣶸棅㵽鑘㤧慐𢞁𢥫愇鱏鱓鱻鰵鰐魿鯏𩸭鮟𪇵𪃾鴡䲮𤄄鸘䲰鴌𪆴𪃭𪃳𩤯鶥蒽𦸒𦿟𦮂藼䔳𦶤𦺄𦷰萠藮𦸀𣟗𦁤秢𣖜𣙀䤭𤧞㵢鏛銾鍈𠊿碹鉷鑍俤㑀遤𥕝砽硔碶硋𡝗𣇉𤥁㚚佲濚濙瀞瀞吔𤆵垻壳垊鴖埗焴㒯𤆬燫𦱀𤾗嬨𡞵𨩉"],
["9740","愌嫎娋䊼𤒈㜬䭻𨧼鎻鎸𡣖𠼝葲𦳀𡐓𤋺𢰦𤏁妔𣶷𦝁綨𦅛𦂤𤦹𤦋𨧺鋥珢㻩璴𨭣𡢟㻡𤪳櫘珳珻㻖𤨾𤪔𡟙𤩦𠎧𡐤𤧥瑈𤤖炥𤥶銄珦鍟𠓾錱𨫎𨨖鎆𨯧𥗕䤵𨪂煫"],
["97a1","𤥃𠳿嚤𠘚𠯫𠲸唂秄𡟺緾𡛂𤩐𡡒䔮鐁㜊𨫀𤦭妰𡢿𡢃𧒄媡㛢𣵛㚰鉟婹𨪁𡡢鍴㳍𠪴䪖㦊僴㵩㵌𡎜煵䋻𨈘渏𩃤䓫浗𧹏灧沯㳖𣿭𣸭渂漌㵯𠏵畑㚼㓈䚀㻚䡱姄鉮䤾轁𨰜𦯀堒埈㛖𡑒烾𤍢𤩱𢿣𡊰𢎽梹楧𡎘𣓥𧯴𣛟𨪃𣟖𣏺𤲟樚𣚭𦲷萾䓟䓎"],
["9840","𦴦𦵑𦲂𦿞漗𧄉茽𡜺菭𦲀𧁓𡟛妉媂𡞳婡婱𡤅𤇼㜭姯𡜼㛇熎鎐暚𤊥婮娫𤊓樫𣻹𧜶𤑛𤋊焝𤉙𨧡侰𦴨峂𤓎𧹍𤎽樌𤉖𡌄炦焳𤏩㶥泟勇𤩏繥姫崯㷳彜𤩝𡟟綤萦"],
["98a1","咅𣫺𣌀𠈔坾𠣕𠘙㿥𡾞𪊶瀃𩅛嵰玏糓𨩙𩐠俈翧狍猐𧫴猸猹𥛶獁獈㺩𧬘遬燵𤣲珡臶㻊県㻑沢国琙琞琟㻢㻰㻴㻺瓓㼎㽓畂畭畲疍㽼痈痜㿀癍㿗癴㿜発𤽜熈嘣覀塩䀝睃䀹条䁅㗛瞘䁪䁯属瞾矋売砘点砜䂨砹硇硑硦葈𥔵礳栃礲䄃"],
["9940","䄉禑禙辻稆込䅧窑䆲窼艹䇄竏竛䇏両筢筬筻簒簛䉠䉺类粜䊌粸䊔糭输烀𠳏総緔緐緽羮羴犟䎗耠耥笹耮耱联㷌垴炠肷胩䏭脌猪脎脒畠脔䐁㬹腖腙腚"],
["99a1","䐓堺腼膄䐥膓䐭膥埯臁臤艔䒏芦艶苊苘苿䒰荗险榊萅烵葤惣蒈䔄蒾蓡蓸蔐蔸蕒䔻蕯蕰藠䕷虲蚒蚲蛯际螋䘆䘗袮裿褤襇覑𧥧訩訸誔誴豑賔賲贜䞘塟跃䟭仮踺嗘坔蹱嗵躰䠷軎転軤軭軲辷迁迊迌逳駄䢭飠鈓䤞鈨鉘鉫銱銮銿"],
["9a40","鋣鋫鋳鋴鋽鍃鎄鎭䥅䥑麿鐗匁鐝鐭鐾䥪鑔鑹锭関䦧间阳䧥枠䨤靀䨵鞲韂噔䫤惨颹䬙飱塄餎餙冴餜餷饂饝饢䭰駅䮝騼鬏窃魩鮁鯝鯱鯴䱭鰠㝯𡯂鵉鰺"],
["9aa1","黾噐鶓鶽鷀鷼银辶鹻麬麱麽黆铜黢黱黸竈齄𠂔𠊷𠎠椚铃妬𠓗塀铁㞹𠗕𠘕𠙶𡚺块煳𠫂𠫍𠮿呪吆𠯋咞𠯻𠰻𠱓𠱥𠱼惧𠲍噺𠲵𠳝𠳭𠵯𠶲𠷈楕鰯螥𠸄𠸎𠻗𠾐𠼭𠹳尠𠾼帋𡁜𡁏𡁶朞𡁻𡂈𡂖㙇𡂿𡃓𡄯𡄻卤蒭𡋣𡍵𡌶讁𡕷𡘙𡟃𡟇乸炻𡠭𡥪"],
["9b40","𡨭𡩅𡰪𡱰𡲬𡻈拃𡻕𡼕熘桕𢁅槩㛈𢉼𢏗𢏺𢜪𢡱𢥏苽𢥧𢦓𢫕覥𢫨辠𢬎鞸𢬿顇骽𢱌"],
["9b62","𢲈𢲷𥯨𢴈𢴒𢶷𢶕𢹂𢽴𢿌𣀳𣁦𣌟𣏞徱晈暿𧩹𣕧𣗳爁𤦺矗𣘚𣜖纇𠍆墵朎"],
["9ba1","椘𣪧𧙗𥿢𣸑𣺹𧗾𢂚䣐䪸𤄙𨪚𤋮𤌍𤀻𤌴𤎖𤩅𠗊凒𠘑妟𡺨㮾𣳿𤐄𤓖垈𤙴㦛𤜯𨗨𩧉㝢𢇃譞𨭎駖𤠒𤣻𤨕爉𤫀𠱸奥𤺥𤾆𠝹軚𥀬劏圿煱𥊙𥐙𣽊𤪧喼𥑆𥑮𦭒釔㑳𥔿𧘲𥕞䜘𥕢𥕦𥟇𤤿𥡝偦㓻𣏌惞𥤃䝼𨥈𥪮𥮉𥰆𡶐垡煑澶𦄂𧰒遖𦆲𤾚譢𦐂𦑊"],
["9c40","嵛𦯷輶𦒄𡤜諪𤧶𦒈𣿯𦔒䯀𦖿𦚵𢜛鑥𥟡憕娧晉侻嚹𤔡𦛼乪𤤴陖涏𦲽㘘襷𦞙𦡮𦐑𦡞營𦣇筂𩃀𠨑𦤦鄄𦤹穅鷰𦧺騦𦨭㙟𦑩𠀡禃𦨴𦭛崬𣔙菏𦮝䛐𦲤画补𦶮墶"],
["9ca1","㜜𢖍𧁋𧇍㱔𧊀𧊅銁𢅺𧊋錰𧋦𤧐氹钟𧑐𠻸蠧裵𢤦𨑳𡞱溸𤨪𡠠㦤㚹尐秣䔿暶𩲭𩢤襃𧟌𧡘囖䃟𡘊㦡𣜯𨃨𡏅熭荦𧧝𩆨婧䲷𧂯𨦫𧧽𧨊𧬋𧵦𤅺筃祾𨀉澵𪋟樃𨌘厢𦸇鎿栶靝𨅯𨀣𦦵𡏭𣈯𨁈嶅𨰰𨂃圕頣𨥉嶫𤦈斾槕叒𤪥𣾁㰑朶𨂐𨃴𨄮𡾡𨅏"],
["9d40","𨆉𨆯𨈚𨌆𨌯𨎊㗊𨑨𨚪䣺揦𨥖砈鉕𨦸䏲𨧧䏟𨧨𨭆𨯔姸𨰉輋𨿅𩃬筑𩄐𩄼㷷𩅞𤫊运犏嚋𩓧𩗩𩖰𩖸𩜲𩣑𩥉𩥪𩧃𩨨𩬎𩵚𩶛纟𩻸𩼣䲤镇𪊓熢𪋿䶑递𪗋䶜𠲜达嗁"],
["9da1","辺𢒰边𤪓䔉繿潖檱仪㓤𨬬𧢝㜺躀𡟵𨀤𨭬𨮙𧨾𦚯㷫𧙕𣲷𥘵𥥖亚𥺁𦉘嚿𠹭踎孭𣺈𤲞揞拐𡟶𡡻攰嘭𥱊吚𥌑㷆𩶘䱽嘢嘞罉𥻘奵𣵀蝰东𠿪𠵉𣚺脗鵞贘瘻鱅癎瞹鍅吲腈苷嘥脲萘肽嗪祢噃吖𠺝㗎嘅嗱曱𨋢㘭甴嗰喺咗啲𠱁𠲖廐𥅈𠹶𢱢"],
["9e40","𠺢麫絚嗞𡁵抝靭咔賍燶酶揼掹揾啩𢭃鱲𢺳冚㓟𠶧冧呍唞唓癦踭𦢊疱肶蠄螆裇膶萜𡃁䓬猄𤜆宐茋𦢓噻𢛴𧴯𤆣𧵳𦻐𧊶酰𡇙鈈𣳼𪚩𠺬𠻹牦𡲢䝎𤿂𧿹𠿫䃺"],
["9ea1","鱝攟𢶠䣳𤟠𩵼𠿬𠸊恢𧖣𠿭"],
["9ead","𦁈𡆇熣纎鵐业丄㕷嬍沲卧㚬㧜卽㚥𤘘墚𤭮舭呋垪𥪕𠥹"],
["9ec5","㩒𢑥獴𩺬䴉鯭𣳾𩼰䱛𤾩𩖞𩿞葜𣶶𧊲𦞳𣜠挮紥𣻷𣸬㨪逈勌㹴㙺䗩𠒎癀嫰𠺶硺𧼮墧䂿噼鮋嵴癔𪐴麅䳡痹㟻愙𣃚𤏲"],
["9ef5","噝𡊩垧𤥣𩸆刴𧂮㖭汊鵼"],
["9f40","籖鬹埞𡝬屓擓𩓐𦌵𧅤蚭𠴨𦴢𤫢𠵱"],
["9f4f","凾𡼏嶎霃𡷑麁遌笟鬂峑箣扨挵髿篏鬪籾鬮籂粆鰕篼鬉鼗鰛𤤾齚啳寃俽麘俲剠㸆勑坧偖妷帒韈鶫轜呩鞴饀鞺匬愰"],
["9fa1","椬叚鰊鴂䰻陁榀傦畆𡝭駚剳"],
["9fae","酙隁酜"],
["9fb2","酑𨺗捿𦴣櫊嘑醎畺抅𠏼獏籰𥰡𣳽"],
["9fc1","𤤙盖鮝个𠳔莾衂"],
["9fc9","届槀僭坺刟巵从氱𠇲伹咜哚劚趂㗾弌㗳"],
["9fdb","歒酼龥鮗頮颴骺麨麄煺笔"],
["9fe7","毺蠘罸"],
["9feb","嘠𪙊蹷齓"],
["9ff0","跔蹏鸜踁抂𨍽踨蹵竓𤩷稾磘泪詧瘇"],
["a040","𨩚鼦泎蟖痃𪊲硓咢贌狢獱謭猂瓱賫𤪻蘯徺袠䒷"],
["a055","𡠻𦸅"],
["a058","詾𢔛"],
["a05b","惽癧髗鵄鍮鮏蟵"],
["a063","蠏賷猬霡鮰㗖犲䰇籑饊𦅙慙䰄麖慽"],
["a073","坟慯抦戹拎㩜懢厪𣏵捤栂㗒"],
["a0a1","嵗𨯂迚𨸹"],
["a0a6","僙𡵆礆匲阸𠼻䁥"],
["a0ae","矾"],
["a0b0","糂𥼚糚稭聦聣絍甅瓲覔舚朌聢𧒆聛瓰脃眤覉𦟌畓𦻑螩蟎臈螌詉貭譃眫瓸蓚㘵榲趦"],
["a0d4","覩瑨涹蟁𤀑瓧㷛煶悤憜㳑煢恷"],
["a0e2","罱𨬭牐惩䭾删㰘𣳇𥻗𧙖𥔱𡥄𡋾𩤃𦷜𧂭峁𦆭𨨏𣙷𠃮𦡆𤼎䕢嬟𦍌齐麦𦉫"],
["a3c0","␀",31,"␡"],
["c6a1","①",9,"⑴",9,"ⅰ",9,"丶丿亅亠冂冖冫勹匸卩厶夊宀巛⼳广廴彐彡攴无疒癶辵隶¨ˆヽヾゝゞ〃仝々〆〇ー［］✽ぁ",23],
["c740","す",58,"ァアィイ"],
["c7a1","ゥ",81,"А",5,"ЁЖ",4],
["c840","Л",26,"ёж",25,"⇧↸↹㇏𠃌乚𠂊刂䒑"],
["c8a1","龰冈龱𧘇"],
["c8cd","￢￤＇＂㈱№℡゛゜⺀⺄⺆⺇⺈⺊⺌⺍⺕⺜⺝⺥⺧⺪⺬⺮⺶⺼⺾⻆⻊⻌⻍⻏⻖⻗⻞⻣"],
["c8f5","ʃɐɛɔɵœøŋʊɪ"],
["f9fe","￭"],
["fa40","𠕇鋛𠗟𣿅蕌䊵珯况㙉𤥂𨧤鍄𡧛苮𣳈砼杄拟𤤳𨦪𠊠𦮳𡌅侫𢓭倈𦴩𧪄𣘀𤪱𢔓倩𠍾徤𠎀𠍇滛𠐟偽儁㑺儎顬㝃萖𤦤𠒇兠𣎴兪𠯿𢃼𠋥𢔰𠖎𣈳𡦃宂蝽𠖳𣲙冲冸"],
["faa1","鴴凉减凑㳜凓𤪦决凢卂凭菍椾𣜭彻刋刦刼劵剗劔効勅簕蕂勠蘍𦬓包𨫞啉滙𣾀𠥔𣿬匳卄𠯢泋𡜦栛珕恊㺪㣌𡛨燝䒢卭却𨚫卾卿𡖖𡘓矦厓𨪛厠厫厮玧𥝲㽙玜叁叅汉义埾叙㪫𠮏叠𣿫𢶣叶𠱷吓灹唫晗浛呭𦭓𠵴啝咏咤䞦𡜍𠻝㶴𠵍"],
["fb40","𨦼𢚘啇䳭启琗喆喩嘅𡣗𤀺䕒𤐵暳𡂴嘷曍𣊊暤暭噍噏磱囱鞇叾圀囯园𨭦㘣𡉏坆𤆥汮炋坂㚱𦱾埦𡐖堃𡑔𤍣堦𤯵塜墪㕡壠壜𡈼壻寿坃𪅐𤉸鏓㖡够梦㛃湙"],
["fba1","𡘾娤啓𡚒蔅姉𠵎𦲁𦴪𡟜姙𡟻𡞲𦶦浱𡠨𡛕姹𦹅媫婣㛦𤦩婷㜈媖瑥嫓𦾡𢕔㶅𡤑㜲𡚸広勐孶斈孼𧨎䀄䡝𠈄寕慠𡨴𥧌𠖥寳宝䴐尅𡭄尓珎尔𡲥𦬨屉䣝岅峩峯嶋𡷹𡸷崐崘嵆𡺤岺巗苼㠭𤤁𢁉𢅳芇㠶㯂帮檊幵幺𤒼𠳓厦亷廐厨𡝱帉廴𨒂"],
["fc40","廹廻㢠廼栾鐛弍𠇁弢㫞䢮𡌺强𦢈𢏐彘𢑱彣鞽𦹮彲鍀𨨶徧嶶㵟𥉐𡽪𧃸𢙨釖𠊞𨨩怱暅𡡷㥣㷇㘹垐𢞴祱㹀悞悤悳𤦂𤦏𧩓璤僡媠慤萤慂慈𦻒憁凴𠙖憇宪𣾷"],
["fca1","𢡟懓𨮝𩥝懐㤲𢦀𢣁怣慜攞掋𠄘担𡝰拕𢸍捬𤧟㨗搸揸𡎎𡟼撐澊𢸶頔𤂌𥜝擡擥鑻㩦携㩗敍漖𤨨𤨣斅敭敟𣁾斵𤥀䬷旑䃘𡠩无旣忟𣐀昘𣇷𣇸晄𣆤𣆥晋𠹵晧𥇦晳晴𡸽𣈱𨗴𣇈𥌓矅𢣷馤朂𤎜𤨡㬫槺𣟂杞杧杢𤇍𩃭柗䓩栢湐鈼栁𣏦𦶠桝"],
["fd40","𣑯槡樋𨫟楳棃𣗍椁椀㴲㨁𣘼㮀枬楡𨩊䋼椶榘㮡𠏉荣傐槹𣙙𢄪橅𣜃檝㯳枱櫈𩆜㰍欝𠤣惞欵歴𢟍溵𣫛𠎵𡥘㝀吡𣭚毡𣻼毜氷𢒋𤣱𦭑汚舦汹𣶼䓅𣶽𤆤𤤌𤤀"],
["fda1","𣳉㛥㳫𠴲鮃𣇹𢒑羏样𦴥𦶡𦷫涖浜湼漄𤥿𤂅𦹲蔳𦽴凇沜渝萮𨬡港𣸯瑓𣾂秌湏媑𣁋濸㜍澝𣸰滺𡒗𤀽䕕鏰潄潜㵎潴𩅰㴻澟𤅄濓𤂑𤅕𤀹𣿰𣾴𤄿凟𤅖𤅗𤅀𦇝灋灾炧炁烌烕烖烟䄄㷨熴熖𤉷焫煅媈煊煮岜𤍥煏鍢𤋁焬𤑚𤨧𤨢熺𨯨炽爎"],
["fe40","鑂爕夑鑃爤鍁𥘅爮牀𤥴梽牕牗㹕𣁄栍漽犂猪猫𤠣𨠫䣭𨠄猨献珏玪𠰺𦨮珉瑉𤇢𡛧𤨤昣㛅𤦷𤦍𤧻珷琕椃𤨦琹𠗃㻗瑜𢢭瑠𨺲瑇珤瑶莹瑬㜰瑴鏱樬璂䥓𤪌"],
["fea1","𤅟𤩹𨮏孆𨰃𡢞瓈𡦈甎瓩甞𨻙𡩋寗𨺬鎅畍畊畧畮𤾂㼄𤴓疎瑝疞疴瘂瘬癑癏癯癶𦏵皐臯㟸𦤑𦤎皡皥皷盌𦾟葢𥂝𥅽𡸜眞眦着撯𥈠睘𣊬瞯𨥤𨥨𡛁矴砉𡍶𤨒棊碯磇磓隥礮𥗠磗礴碱𧘌辸袄𨬫𦂃𢘜禆褀椂禀𥡗禝𧬹礼禩渪𧄦㺨秆𩄍秔"]
]

},{}],22:[function(require,module,exports){
module.exports=[
["0","\u0000",127,"€"],
["8140","丂丄丅丆丏丒丗丟丠両丣並丩丮丯丱丳丵丷丼乀乁乂乄乆乊乑乕乗乚乛乢乣乤乥乧乨乪",5,"乲乴",9,"乿",6,"亇亊"],
["8180","亐亖亗亙亜亝亞亣亪亯亰亱亴亶亷亸亹亼亽亾仈仌仏仐仒仚仛仜仠仢仦仧仩仭仮仯仱仴仸仹仺仼仾伀伂",6,"伋伌伒",4,"伜伝伡伣伨伩伬伭伮伱伳伵伷伹伻伾",4,"佄佅佇",5,"佒佔佖佡佢佦佨佪佫佭佮佱佲併佷佸佹佺佽侀侁侂侅來侇侊侌侎侐侒侓侕侖侘侙侚侜侞侟価侢"],
["8240","侤侫侭侰",4,"侶",8,"俀俁係俆俇俈俉俋俌俍俒",4,"俙俛俠俢俤俥俧俫俬俰俲俴俵俶俷俹俻俼俽俿",11],
["8280","個倎倐們倓倕倖倗倛倝倞倠倢倣値倧倫倯",10,"倻倽倿偀偁偂偄偅偆偉偊偋偍偐",4,"偖偗偘偙偛偝",7,"偦",5,"偭",8,"偸偹偺偼偽傁傂傃傄傆傇傉傊傋傌傎",20,"傤傦傪傫傭",4,"傳",6,"傼"],
["8340","傽",17,"僐",5,"僗僘僙僛",10,"僨僩僪僫僯僰僱僲僴僶",4,"僼",9,"儈"],
["8380","儉儊儌",5,"儓",13,"儢",28,"兂兇兊兌兎兏児兒兓兗兘兙兛兝",4,"兣兤兦內兩兪兯兲兺兾兿冃冄円冇冊冋冎冏冐冑冓冔冘冚冝冞冟冡冣冦",4,"冭冮冴冸冹冺冾冿凁凂凃凅凈凊凍凎凐凒",5],
["8440","凘凙凚凜凞凟凢凣凥",5,"凬凮凱凲凴凷凾刄刅刉刋刌刏刐刓刔刕刜刞刟刡刢刣別刦刧刪刬刯刱刲刴刵刼刾剄",5,"剋剎剏剒剓剕剗剘"],
["8480","剙剚剛剝剟剠剢剣剤剦剨剫剬剭剮剰剱剳",9,"剾劀劃",4,"劉",6,"劑劒劔",6,"劜劤劥劦劧劮劯劰労",9,"勀勁勂勄勅勆勈勊勌勍勎勏勑勓勔動勗務",5,"勠勡勢勣勥",10,"勱",7,"勻勼勽匁匂匃匄匇匉匊匋匌匎"],
["8540","匑匒匓匔匘匛匜匞匟匢匤匥匧匨匩匫匬匭匯",9,"匼匽區卂卄卆卋卌卍卐協単卙卛卝卥卨卪卬卭卲卶卹卻卼卽卾厀厁厃厇厈厊厎厏"],
["8580","厐",4,"厖厗厙厛厜厞厠厡厤厧厪厫厬厭厯",6,"厷厸厹厺厼厽厾叀參",4,"収叏叐叒叓叕叚叜叝叞叡叢叧叴叺叾叿吀吂吅吇吋吔吘吙吚吜吢吤吥吪吰吳吶吷吺吽吿呁呂呄呅呇呉呌呍呎呏呑呚呝",4,"呣呥呧呩",7,"呴呹呺呾呿咁咃咅咇咈咉咊咍咑咓咗咘咜咞咟咠咡"],
["8640","咢咥咮咰咲咵咶咷咹咺咼咾哃哅哊哋哖哘哛哠",4,"哫哬哯哰哱哴",5,"哻哾唀唂唃唄唅唈唊",4,"唒唓唕",5,"唜唝唞唟唡唥唦"],
["8680","唨唩唫唭唲唴唵唶唸唹唺唻唽啀啂啅啇啈啋",4,"啑啒啓啔啗",4,"啝啞啟啠啢啣啨啩啫啯",5,"啹啺啽啿喅喆喌喍喎喐喒喓喕喖喗喚喛喞喠",6,"喨",8,"喲喴営喸喺喼喿",4,"嗆嗇嗈嗊嗋嗎嗏嗐嗕嗗",4,"嗞嗠嗢嗧嗩嗭嗮嗰嗱嗴嗶嗸",4,"嗿嘂嘃嘄嘅"],
["8740","嘆嘇嘊嘋嘍嘐",7,"嘙嘚嘜嘝嘠嘡嘢嘥嘦嘨嘩嘪嘫嘮嘯嘰嘳嘵嘷嘸嘺嘼嘽嘾噀",11,"噏",4,"噕噖噚噛噝",4],
["8780","噣噥噦噧噭噮噯噰噲噳噴噵噷噸噹噺噽",7,"嚇",6,"嚐嚑嚒嚔",14,"嚤",10,"嚰",6,"嚸嚹嚺嚻嚽",12,"囋",8,"囕囖囘囙囜団囥",5,"囬囮囯囲図囶囷囸囻囼圀圁圂圅圇國",6],
["8840","園",9,"圝圞圠圡圢圤圥圦圧圫圱圲圴",4,"圼圽圿坁坃坄坅坆坈坉坋坒",4,"坘坙坢坣坥坧坬坮坰坱坲坴坵坸坹坺坽坾坿垀"],
["8880","垁垇垈垉垊垍",4,"垔",6,"垜垝垞垟垥垨垪垬垯垰垱垳垵垶垷垹",8,"埄",6,"埌埍埐埑埓埖埗埛埜埞埡埢埣埥",7,"埮埰埱埲埳埵埶執埻埼埾埿堁堃堄堅堈堉堊堌堎堏堐堒堓堔堖堗堘堚堛堜堝堟堢堣堥",4,"堫",4,"報堲堳場堶",7],
["8940","堾",5,"塅",6,"塎塏塐塒塓塕塖塗塙",4,"塟",5,"塦",4,"塭",16,"塿墂墄墆墇墈墊墋墌"],
["8980","墍",4,"墔",4,"墛墜墝墠",7,"墪",17,"墽墾墿壀壂壃壄壆",10,"壒壓壔壖",13,"壥",5,"壭壯壱売壴壵壷壸壺",7,"夃夅夆夈",4,"夎夐夑夒夓夗夘夛夝夞夠夡夢夣夦夨夬夰夲夳夵夶夻"],
["8a40","夽夾夿奀奃奅奆奊奌奍奐奒奓奙奛",4,"奡奣奤奦",12,"奵奷奺奻奼奾奿妀妅妉妋妌妎妏妐妑妔妕妘妚妛妜妝妟妠妡妢妦"],
["8a80","妧妬妭妰妱妳",5,"妺妼妽妿",6,"姇姈姉姌姍姎姏姕姖姙姛姞",4,"姤姦姧姩姪姫姭",11,"姺姼姽姾娀娂娊娋娍娎娏娐娒娔娕娖娗娙娚娛娝娞娡娢娤娦娧娨娪",6,"娳娵娷",4,"娽娾娿婁",4,"婇婈婋",9,"婖婗婘婙婛",5],
["8b40","婡婣婤婥婦婨婩婫",8,"婸婹婻婼婽婾媀",17,"媓",6,"媜",13,"媫媬"],
["8b80","媭",4,"媴媶媷媹",4,"媿嫀嫃",5,"嫊嫋嫍",4,"嫓嫕嫗嫙嫚嫛嫝嫞嫟嫢嫤嫥嫧嫨嫪嫬",4,"嫲",22,"嬊",11,"嬘",25,"嬳嬵嬶嬸",7,"孁",6],
["8c40","孈",7,"孒孖孞孠孡孧孨孫孭孮孯孲孴孶孷學孹孻孼孾孿宂宆宊宍宎宐宑宒宔宖実宧宨宩宬宭宮宯宱宲宷宺宻宼寀寁寃寈寉寊寋寍寎寏"],
["8c80","寑寔",8,"寠寢寣實寧審",4,"寯寱",6,"寽対尀専尃尅將專尋尌對導尐尒尓尗尙尛尞尟尠尡尣尦尨尩尪尫尭尮尯尰尲尳尵尶尷屃屄屆屇屌屍屒屓屔屖屗屘屚屛屜屝屟屢層屧",6,"屰屲",6,"屻屼屽屾岀岃",4,"岉岊岋岎岏岒岓岕岝",4,"岤",4],
["8d40","岪岮岯岰岲岴岶岹岺岻岼岾峀峂峃峅",5,"峌",5,"峓",5,"峚",6,"峢峣峧峩峫峬峮峯峱",9,"峼",4],
["8d80","崁崄崅崈",5,"崏",4,"崕崗崘崙崚崜崝崟",4,"崥崨崪崫崬崯",4,"崵",7,"崿",7,"嵈嵉嵍",10,"嵙嵚嵜嵞",10,"嵪嵭嵮嵰嵱嵲嵳嵵",12,"嶃",21,"嶚嶛嶜嶞嶟嶠"],
["8e40","嶡",21,"嶸",12,"巆",6,"巎",12,"巜巟巠巣巤巪巬巭"],
["8e80","巰巵巶巸",4,"巿帀帄帇帉帊帋帍帎帒帓帗帞",7,"帨",4,"帯帰帲",4,"帹帺帾帿幀幁幃幆",5,"幍",6,"幖",4,"幜幝幟幠幣",14,"幵幷幹幾庁庂広庅庈庉庌庍庎庒庘庛庝庡庢庣庤庨",4,"庮",4,"庴庺庻庼庽庿",6],
["8f40","廆廇廈廋",5,"廔廕廗廘廙廚廜",11,"廩廫",8,"廵廸廹廻廼廽弅弆弇弉弌弍弎弐弒弔弖弙弚弜弝弞弡弢弣弤"],
["8f80","弨弫弬弮弰弲",6,"弻弽弾弿彁",14,"彑彔彙彚彛彜彞彟彠彣彥彧彨彫彮彯彲彴彵彶彸彺彽彾彿徃徆徍徎徏徑従徔徖徚徛徝從徟徠徢",5,"復徫徬徯",5,"徶徸徹徺徻徾",4,"忇忈忊忋忎忓忔忕忚忛応忞忟忢忣忥忦忨忩忬忯忰忲忳忴忶忷忹忺忼怇"],
["9040","怈怉怋怌怐怑怓怗怘怚怞怟怢怣怤怬怭怮怰",4,"怶",4,"怽怾恀恄",6,"恌恎恏恑恓恔恖恗恘恛恜恞恟恠恡恥恦恮恱恲恴恵恷恾悀"],
["9080","悁悂悅悆悇悈悊悋悎悏悐悑悓悕悗悘悙悜悞悡悢悤悥悧悩悪悮悰悳悵悶悷悹悺悽",7,"惇惈惉惌",4,"惒惓惔惖惗惙惛惞惡",4,"惪惱惲惵惷惸惻",4,"愂愃愄愅愇愊愋愌愐",4,"愖愗愘愙愛愜愝愞愡愢愥愨愩愪愬",18,"慀",6],
["9140","慇慉態慍慏慐慒慓慔慖",6,"慞慟慠慡慣慤慥慦慩",6,"慱慲慳慴慶慸",18,"憌憍憏",4,"憕"],
["9180","憖",6,"憞",8,"憪憫憭",9,"憸",5,"憿懀懁懃",4,"應懌",4,"懓懕",16,"懧",13,"懶",8,"戀",5,"戇戉戓戔戙戜戝戞戠戣戦戧戨戩戫戭戯戰戱戲戵戶戸",4,"扂扄扅扆扊"],
["9240","扏扐払扖扗扙扚扜",6,"扤扥扨扱扲扴扵扷扸扺扻扽抁抂抃抅抆抇抈抋",5,"抔抙抜抝択抣抦抧抩抪抭抮抯抰抲抳抴抶抷抸抺抾拀拁"],
["9280","拃拋拏拑拕拝拞拠拡拤拪拫拰拲拵拸拹拺拻挀挃挄挅挆挊挋挌挍挏挐挒挓挔挕挗挘挙挜挦挧挩挬挭挮挰挱挳",5,"挻挼挾挿捀捁捄捇捈捊捑捒捓捔捖",7,"捠捤捥捦捨捪捫捬捯捰捲捳捴捵捸捹捼捽捾捿掁掃掄掅掆掋掍掑掓掔掕掗掙",6,"採掤掦掫掯掱掲掵掶掹掻掽掿揀"],
["9340","揁揂揃揅揇揈揊揋揌揑揓揔揕揗",6,"揟揢揤",4,"揫揬揮揯揰揱揳揵揷揹揺揻揼揾搃搄搆",4,"損搎搑搒搕",5,"搝搟搢搣搤"],
["9380","搥搧搨搩搫搮",5,"搵",4,"搻搼搾摀摂摃摉摋",6,"摓摕摖摗摙",4,"摟",7,"摨摪摫摬摮",9,"摻",6,"撃撆撈",8,"撓撔撗撘撚撛撜撝撟",4,"撥撦撧撨撪撫撯撱撲撳撴撶撹撻撽撾撿擁擃擄擆",6,"擏擑擓擔擕擖擙據"],
["9440","擛擜擝擟擠擡擣擥擧",24,"攁",7,"攊",7,"攓",4,"攙",8],
["9480","攢攣攤攦",4,"攬攭攰攱攲攳攷攺攼攽敀",4,"敆敇敊敋敍敎敐敒敓敔敗敘敚敜敟敠敡敤敥敧敨敩敪敭敮敯敱敳敵敶數",14,"斈斉斊斍斎斏斒斔斕斖斘斚斝斞斠斢斣斦斨斪斬斮斱",7,"斺斻斾斿旀旂旇旈旉旊旍旐旑旓旔旕旘",7,"旡旣旤旪旫"],
["9540","旲旳旴旵旸旹旻",4,"昁昄昅昇昈昉昋昍昐昑昒昖昗昘昚昛昜昞昡昢昣昤昦昩昪昫昬昮昰昲昳昷",4,"昽昿晀時晄",6,"晍晎晐晑晘"],
["9580","晙晛晜晝晞晠晢晣晥晧晩",4,"晱晲晳晵晸晹晻晼晽晿暀暁暃暅暆暈暉暊暋暍暎暏暐暒暓暔暕暘",4,"暞",8,"暩",4,"暯",4,"暵暶暷暸暺暻暼暽暿",25,"曚曞",7,"曧曨曪",5,"曱曵曶書曺曻曽朁朂會"],
["9640","朄朅朆朇朌朎朏朑朒朓朖朘朙朚朜朞朠",5,"朧朩朮朰朲朳朶朷朸朹朻朼朾朿杁杄杅杇杊杋杍杒杔杕杗",4,"杝杢杣杤杦杧杫杬杮東杴杶"],
["9680","杸杹杺杻杽枀枂枃枅枆枈枊枌枍枎枏枑枒枓枔枖枙枛枟枠枡枤枦枩枬枮枱枲枴枹",7,"柂柅",9,"柕柖柗柛柟柡柣柤柦柧柨柪柫柭柮柲柵",7,"柾栁栂栃栄栆栍栐栒栔栕栘",4,"栞栟栠栢",6,"栫",6,"栴栵栶栺栻栿桇桋桍桏桒桖",5],
["9740","桜桝桞桟桪桬",7,"桵桸",8,"梂梄梇",7,"梐梑梒梔梕梖梘",9,"梣梤梥梩梪梫梬梮梱梲梴梶梷梸"],
["9780","梹",6,"棁棃",5,"棊棌棎棏棐棑棓棔棖棗棙棛",4,"棡棢棤",9,"棯棲棳棴棶棷棸棻棽棾棿椀椂椃椄椆",4,"椌椏椑椓",11,"椡椢椣椥",7,"椮椯椱椲椳椵椶椷椸椺椻椼椾楀楁楃",16,"楕楖楘楙楛楜楟"],
["9840","楡楢楤楥楧楨楩楪楬業楯楰楲",4,"楺楻楽楾楿榁榃榅榊榋榌榎",5,"榖榗榙榚榝",9,"榩榪榬榮榯榰榲榳榵榶榸榹榺榼榽"],
["9880","榾榿槀槂",7,"構槍槏槑槒槓槕",5,"槜槝槞槡",11,"槮槯槰槱槳",9,"槾樀",9,"樋",11,"標",5,"樠樢",5,"権樫樬樭樮樰樲樳樴樶",6,"樿",4,"橅橆橈",7,"橑",6,"橚"],
["9940","橜",4,"橢橣橤橦",10,"橲",6,"橺橻橽橾橿檁檂檃檅",8,"檏檒",4,"檘",7,"檡",5],
["9980","檧檨檪檭",114,"欥欦欨",6],
["9a40","欯欰欱欳欴欵欶欸欻欼欽欿歀歁歂歄歅歈歊歋歍",11,"歚",7,"歨歩歫",13,"歺歽歾歿殀殅殈"],
["9a80","殌殎殏殐殑殔殕殗殘殙殜",4,"殢",7,"殫",7,"殶殸",6,"毀毃毄毆",4,"毌毎毐毑毘毚毜",4,"毢",7,"毬毭毮毰毱毲毴毶毷毸毺毻毼毾",6,"氈",4,"氎氒気氜氝氞氠氣氥氫氬氭氱氳氶氷氹氺氻氼氾氿汃汄汅汈汋",4,"汑汒汓汖汘"],
["9b40","汙汚汢汣汥汦汧汫",4,"汱汳汵汷汸決汻汼汿沀沄沇沊沋沍沎沑沒沕沖沗沘沚沜沝沞沠沢沨沬沯沰沴沵沶沷沺泀況泂泃泆泇泈泋泍泎泏泑泒泘"],
["9b80","泙泚泜泝泟泤泦泧泩泬泭泲泴泹泿洀洂洃洅洆洈洉洊洍洏洐洑洓洔洕洖洘洜洝洟",5,"洦洨洩洬洭洯洰洴洶洷洸洺洿浀浂浄浉浌浐浕浖浗浘浛浝浟浡浢浤浥浧浨浫浬浭浰浱浲浳浵浶浹浺浻浽",4,"涃涄涆涇涊涋涍涏涐涒涖",4,"涜涢涥涬涭涰涱涳涴涶涷涹",5,"淁淂淃淈淉淊"],
["9c40","淍淎淏淐淒淓淔淕淗淚淛淜淟淢淣淥淧淨淩淪淭淯淰淲淴淵淶淸淺淽",7,"渆渇済渉渋渏渒渓渕渘渙減渜渞渟渢渦渧渨渪測渮渰渱渳渵"],
["9c80","渶渷渹渻",7,"湅",7,"湏湐湑湒湕湗湙湚湜湝湞湠",10,"湬湭湯",14,"満溁溂溄溇溈溊",4,"溑",6,"溙溚溛溝溞溠溡溣溤溦溨溩溫溬溭溮溰溳溵溸溹溼溾溿滀滃滄滅滆滈滉滊滌滍滎滐滒滖滘滙滛滜滝滣滧滪",5],
["9d40","滰滱滲滳滵滶滷滸滺",7,"漃漄漅漇漈漊",4,"漐漑漒漖",9,"漡漢漣漥漦漧漨漬漮漰漲漴漵漷",6,"漿潀潁潂"],
["9d80","潃潄潅潈潉潊潌潎",9,"潙潚潛潝潟潠潡潣潤潥潧",5,"潯潰潱潳潵潶潷潹潻潽",6,"澅澆澇澊澋澏",12,"澝澞澟澠澢",4,"澨",10,"澴澵澷澸澺",5,"濁濃",5,"濊",6,"濓",10,"濟濢濣濤濥"],
["9e40","濦",7,"濰",32,"瀒",7,"瀜",6,"瀤",6],
["9e80","瀫",9,"瀶瀷瀸瀺",17,"灍灎灐",13,"灟",11,"灮灱灲灳灴灷灹灺灻災炁炂炃炄炆炇炈炋炌炍炏炐炑炓炗炘炚炛炞",12,"炰炲炴炵炶為炾炿烄烅烆烇烉烋",12,"烚"],
["9f40","烜烝烞烠烡烢烣烥烪烮烰",6,"烸烺烻烼烾",10,"焋",4,"焑焒焔焗焛",10,"焧",7,"焲焳焴"],
["9f80","焵焷",13,"煆煇煈煉煋煍煏",12,"煝煟",4,"煥煩",4,"煯煰煱煴煵煶煷煹煻煼煾",5,"熅",4,"熋熌熍熎熐熑熒熓熕熖熗熚",4,"熡",6,"熩熪熫熭",5,"熴熶熷熸熺",8,"燄",9,"燏",4],
["a040","燖",9,"燡燢燣燤燦燨",5,"燯",9,"燺",11,"爇",19],
["a080","爛爜爞",9,"爩爫爭爮爯爲爳爴爺爼爾牀",6,"牉牊牋牎牏牐牑牓牔牕牗牘牚牜牞牠牣牤牥牨牪牫牬牭牰牱牳牴牶牷牸牻牼牽犂犃犅",4,"犌犎犐犑犓",11,"犠",11,"犮犱犲犳犵犺",6,"狅狆狇狉狊狋狌狏狑狓狔狕狖狘狚狛"],
["a1a1","　、。·ˉˇ¨〃々—～‖…‘’“”〔〕〈",7,"〖〗【】±×÷∶∧∨∑∏∪∩∈∷√⊥∥∠⌒⊙∫∮≡≌≈∽∝≠≮≯≤≥∞∵∴♂♀°′″℃＄¤￠￡‰§№☆★○●◎◇◆□■△▲※→←↑↓〓"],
["a2a1","ⅰ",9],
["a2b1","⒈",19,"⑴",19,"①",9],
["a2e5","㈠",9],
["a2f1","Ⅰ",11],
["a3a1","！＂＃￥％",88,"￣"],
["a4a1","ぁ",82],
["a5a1","ァ",85],
["a6a1","Α",16,"Σ",6],
["a6c1","α",16,"σ",6],
["a6e0","︵︶︹︺︿﹀︽︾﹁﹂﹃﹄"],
["a6ee","︻︼︷︸︱"],
["a6f4","︳︴"],
["a7a1","А",5,"ЁЖ",25],
["a7d1","а",5,"ёж",25],
["a840","ˊˋ˙–―‥‵℅℉↖↗↘↙∕∟∣≒≦≧⊿═",35,"▁",6],
["a880","█",7,"▓▔▕▼▽◢◣◤◥☉⊕〒〝〞"],
["a8a1","āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑ"],
["a8bd","ńň"],
["a8c0","ɡ"],
["a8c5","ㄅ",36],
["a940","〡",8,"㊣㎎㎏㎜㎝㎞㎡㏄㏎㏑㏒㏕︰￢￤"],
["a959","℡㈱"],
["a95c","‐"],
["a960","ー゛゜ヽヾ〆ゝゞ﹉",9,"﹔﹕﹖﹗﹙",8],
["a980","﹢",4,"﹨﹩﹪﹫"],
["a996","〇"],
["a9a4","─",75],
["aa40","狜狝狟狢",5,"狪狫狵狶狹狽狾狿猀猂猄",5,"猋猌猍猏猐猑猒猔猘猙猚猟猠猣猤猦猧猨猭猯猰猲猳猵猶猺猻猼猽獀",8],
["aa80","獉獊獋獌獎獏獑獓獔獕獖獘",7,"獡",10,"獮獰獱"],
["ab40","獲",11,"獿",4,"玅玆玈玊玌玍玏玐玒玓玔玕玗玘玙玚玜玝玞玠玡玣",5,"玪玬玭玱玴玵玶玸玹玼玽玾玿珁珃",4],
["ab80","珋珌珎珒",6,"珚珛珜珝珟珡珢珣珤珦珨珪珫珬珮珯珰珱珳",4],
["ac40","珸",10,"琄琇琈琋琌琍琎琑",8,"琜",5,"琣琤琧琩琫琭琯琱琲琷",4,"琽琾琿瑀瑂",11],
["ac80","瑎",6,"瑖瑘瑝瑠",12,"瑮瑯瑱",4,"瑸瑹瑺"],
["ad40","瑻瑼瑽瑿璂璄璅璆璈璉璊璌璍璏璑",10,"璝璟",7,"璪",15,"璻",12],
["ad80","瓈",9,"瓓",8,"瓝瓟瓡瓥瓧",6,"瓰瓱瓲"],
["ae40","瓳瓵瓸",6,"甀甁甂甃甅",7,"甎甐甒甔甕甖甗甛甝甞甠",4,"甦甧甪甮甴甶甹甼甽甿畁畂畃畄畆畇畉畊畍畐畑畒畓畕畖畗畘"],
["ae80","畝",7,"畧畨畩畫",6,"畳畵當畷畺",4,"疀疁疂疄疅疇"],
["af40","疈疉疊疌疍疎疐疓疕疘疛疜疞疢疦",4,"疭疶疷疺疻疿痀痁痆痋痌痎痏痐痑痓痗痙痚痜痝痟痠痡痥痩痬痭痮痯痲痳痵痶痷痸痺痻痽痾瘂瘄瘆瘇"],
["af80","瘈瘉瘋瘍瘎瘏瘑瘒瘓瘔瘖瘚瘜瘝瘞瘡瘣瘧瘨瘬瘮瘯瘱瘲瘶瘷瘹瘺瘻瘽癁療癄"],
["b040","癅",6,"癎",5,"癕癗",4,"癝癟癠癡癢癤",6,"癬癭癮癰",7,"癹発發癿皀皁皃皅皉皊皌皍皏皐皒皔皕皗皘皚皛"],
["b080","皜",7,"皥",8,"皯皰皳皵",9,"盀盁盃啊阿埃挨哎唉哀皑癌蔼矮艾碍爱隘鞍氨安俺按暗岸胺案肮昂盎凹敖熬翱袄傲奥懊澳芭捌扒叭吧笆八疤巴拔跋靶把耙坝霸罢爸白柏百摆佰败拜稗斑班搬扳般颁板版扮拌伴瓣半办绊邦帮梆榜膀绑棒磅蚌镑傍谤苞胞包褒剥"],
["b140","盄盇盉盋盌盓盕盙盚盜盝盞盠",4,"盦",7,"盰盳盵盶盷盺盻盽盿眀眂眃眅眆眊県眎",10,"眛眜眝眞眡眣眤眥眧眪眫"],
["b180","眬眮眰",4,"眹眻眽眾眿睂睄睅睆睈",7,"睒",7,"睜薄雹保堡饱宝抱报暴豹鲍爆杯碑悲卑北辈背贝钡倍狈备惫焙被奔苯本笨崩绷甭泵蹦迸逼鼻比鄙笔彼碧蓖蔽毕毙毖币庇痹闭敝弊必辟壁臂避陛鞭边编贬扁便变卞辨辩辫遍标彪膘表鳖憋别瘪彬斌濒滨宾摈兵冰柄丙秉饼炳"],
["b240","睝睞睟睠睤睧睩睪睭",11,"睺睻睼瞁瞂瞃瞆",5,"瞏瞐瞓",11,"瞡瞣瞤瞦瞨瞫瞭瞮瞯瞱瞲瞴瞶",4],
["b280","瞼瞾矀",12,"矎",8,"矘矙矚矝",4,"矤病并玻菠播拨钵波博勃搏铂箔伯帛舶脖膊渤泊驳捕卜哺补埠不布步簿部怖擦猜裁材才财睬踩采彩菜蔡餐参蚕残惭惨灿苍舱仓沧藏操糙槽曹草厕策侧册测层蹭插叉茬茶查碴搽察岔差诧拆柴豺搀掺蝉馋谗缠铲产阐颤昌猖"],
["b340","矦矨矪矯矰矱矲矴矵矷矹矺矻矼砃",5,"砊砋砎砏砐砓砕砙砛砞砠砡砢砤砨砪砫砮砯砱砲砳砵砶砽砿硁硂硃硄硆硈硉硊硋硍硏硑硓硔硘硙硚"],
["b380","硛硜硞",11,"硯",7,"硸硹硺硻硽",6,"场尝常长偿肠厂敞畅唱倡超抄钞朝嘲潮巢吵炒车扯撤掣彻澈郴臣辰尘晨忱沉陈趁衬撑称城橙成呈乘程惩澄诚承逞骋秤吃痴持匙池迟弛驰耻齿侈尺赤翅斥炽充冲虫崇宠抽酬畴踌稠愁筹仇绸瞅丑臭初出橱厨躇锄雏滁除楚"],
["b440","碄碅碆碈碊碋碏碐碒碔碕碖碙碝碞碠碢碤碦碨",7,"碵碶碷碸確碻碼碽碿磀磂磃磄磆磇磈磌磍磎磏磑磒磓磖磗磘磚",9],
["b480","磤磥磦磧磩磪磫磭",4,"磳磵磶磸磹磻",5,"礂礃礄礆",6,"础储矗搐触处揣川穿椽传船喘串疮窗幢床闯创吹炊捶锤垂春椿醇唇淳纯蠢戳绰疵茨磁雌辞慈瓷词此刺赐次聪葱囱匆从丛凑粗醋簇促蹿篡窜摧崔催脆瘁粹淬翠村存寸磋撮搓措挫错搭达答瘩打大呆歹傣戴带殆代贷袋待逮"],
["b540","礍",5,"礔",9,"礟",4,"礥",14,"礵",4,"礽礿祂祃祄祅祇祊",8,"祔祕祘祙祡祣"],
["b580","祤祦祩祪祫祬祮祰",6,"祹祻",4,"禂禃禆禇禈禉禋禌禍禎禐禑禒怠耽担丹单郸掸胆旦氮但惮淡诞弹蛋当挡党荡档刀捣蹈倒岛祷导到稻悼道盗德得的蹬灯登等瞪凳邓堤低滴迪敌笛狄涤翟嫡抵底地蒂第帝弟递缔颠掂滇碘点典靛垫电佃甸店惦奠淀殿碉叼雕凋刁掉吊钓调跌爹碟蝶迭谍叠"],
["b640","禓",6,"禛",11,"禨",10,"禴",4,"禼禿秂秄秅秇秈秊秌秎秏秐秓秔秖秗秙",5,"秠秡秢秥秨秪"],
["b680","秬秮秱",6,"秹秺秼秾秿稁稄稅稇稈稉稊稌稏",4,"稕稖稘稙稛稜丁盯叮钉顶鼎锭定订丢东冬董懂动栋侗恫冻洞兜抖斗陡豆逗痘都督毒犊独读堵睹赌杜镀肚度渡妒端短锻段断缎堆兑队对墩吨蹲敦顿囤钝盾遁掇哆多夺垛躲朵跺舵剁惰堕蛾峨鹅俄额讹娥恶厄扼遏鄂饿恩而儿耳尔饵洱二"],
["b740","稝稟稡稢稤",14,"稴稵稶稸稺稾穀",5,"穇",9,"穒",4,"穘",16],
["b780","穩",6,"穱穲穳穵穻穼穽穾窂窅窇窉窊窋窌窎窏窐窓窔窙窚窛窞窡窢贰发罚筏伐乏阀法珐藩帆番翻樊矾钒繁凡烦反返范贩犯饭泛坊芳方肪房防妨仿访纺放菲非啡飞肥匪诽吠肺废沸费芬酚吩氛分纷坟焚汾粉奋份忿愤粪丰封枫蜂峰锋风疯烽逢冯缝讽奉凤佛否夫敷肤孵扶拂辐幅氟符伏俘服"],
["b840","窣窤窧窩窪窫窮",4,"窴",10,"竀",10,"竌",9,"竗竘竚竛竜竝竡竢竤竧",5,"竮竰竱竲竳"],
["b880","竴",4,"竻竼竾笀笁笂笅笇笉笌笍笎笐笒笓笖笗笘笚笜笝笟笡笢笣笧笩笭浮涪福袱弗甫抚辅俯釜斧脯腑府腐赴副覆赋复傅付阜父腹负富讣附妇缚咐噶嘎该改概钙盖溉干甘杆柑竿肝赶感秆敢赣冈刚钢缸肛纲岗港杠篙皋高膏羔糕搞镐稿告哥歌搁戈鸽胳疙割革葛格蛤阁隔铬个各给根跟耕更庚羹"],
["b940","笯笰笲笴笵笶笷笹笻笽笿",5,"筆筈筊筍筎筓筕筗筙筜筞筟筡筣",10,"筯筰筳筴筶筸筺筼筽筿箁箂箃箄箆",6,"箎箏"],
["b980","箑箒箓箖箘箙箚箛箞箟箠箣箤箥箮箯箰箲箳箵箶箷箹",7,"篂篃範埂耿梗工攻功恭龚供躬公宫弓巩汞拱贡共钩勾沟苟狗垢构购够辜菇咕箍估沽孤姑鼓古蛊骨谷股故顾固雇刮瓜剐寡挂褂乖拐怪棺关官冠观管馆罐惯灌贯光广逛瑰规圭硅归龟闺轨鬼诡癸桂柜跪贵刽辊滚棍锅郭国果裹过哈"],
["ba40","篅篈築篊篋篍篎篏篐篒篔",4,"篛篜篞篟篠篢篣篤篧篨篩篫篬篭篯篰篲",4,"篸篹篺篻篽篿",7,"簈簉簊簍簎簐",5,"簗簘簙"],
["ba80","簚",4,"簠",5,"簨簩簫",12,"簹",5,"籂骸孩海氦亥害骇酣憨邯韩含涵寒函喊罕翰撼捍旱憾悍焊汗汉夯杭航壕嚎豪毫郝好耗号浩呵喝荷菏核禾和何合盒貉阂河涸赫褐鹤贺嘿黑痕很狠恨哼亨横衡恒轰哄烘虹鸿洪宏弘红喉侯猴吼厚候后呼乎忽瑚壶葫胡蝴狐糊湖"],
["bb40","籃",9,"籎",36,"籵",5,"籾",9],
["bb80","粈粊",6,"粓粔粖粙粚粛粠粡粣粦粧粨粩粫粬粭粯粰粴",4,"粺粻弧虎唬护互沪户花哗华猾滑画划化话槐徊怀淮坏欢环桓还缓换患唤痪豢焕涣宦幻荒慌黄磺蝗簧皇凰惶煌晃幌恍谎灰挥辉徽恢蛔回毁悔慧卉惠晦贿秽会烩汇讳诲绘荤昏婚魂浑混豁活伙火获或惑霍货祸击圾基机畸稽积箕"],
["bc40","粿糀糂糃糄糆糉糋糎",6,"糘糚糛糝糞糡",6,"糩",5,"糰",7,"糹糺糼",13,"紋",5],
["bc80","紑",14,"紡紣紤紥紦紨紩紪紬紭紮細",6,"肌饥迹激讥鸡姬绩缉吉极棘辑籍集及急疾汲即嫉级挤几脊己蓟技冀季伎祭剂悸济寄寂计记既忌际妓继纪嘉枷夹佳家加荚颊贾甲钾假稼价架驾嫁歼监坚尖笺间煎兼肩艰奸缄茧检柬碱硷拣捡简俭剪减荐槛鉴践贱见键箭件"],
["bd40","紷",54,"絯",7],
["bd80","絸",32,"健舰剑饯渐溅涧建僵姜将浆江疆蒋桨奖讲匠酱降蕉椒礁焦胶交郊浇骄娇嚼搅铰矫侥脚狡角饺缴绞剿教酵轿较叫窖揭接皆秸街阶截劫节桔杰捷睫竭洁结解姐戒藉芥界借介疥诫届巾筋斤金今津襟紧锦仅谨进靳晋禁近烬浸"],
["be40","継",12,"綧",6,"綯",42],
["be80","線",32,"尽劲荆兢茎睛晶鲸京惊精粳经井警景颈静境敬镜径痉靖竟竞净炯窘揪究纠玖韭久灸九酒厩救旧臼舅咎就疚鞠拘狙疽居驹菊局咀矩举沮聚拒据巨具距踞锯俱句惧炬剧捐鹃娟倦眷卷绢撅攫抉掘倔爵觉决诀绝均菌钧军君峻"],
["bf40","緻",62],
["bf80","縺縼",4,"繂",4,"繈",21,"俊竣浚郡骏喀咖卡咯开揩楷凯慨刊堪勘坎砍看康慷糠扛抗亢炕考拷烤靠坷苛柯棵磕颗科壳咳可渴克刻客课肯啃垦恳坑吭空恐孔控抠口扣寇枯哭窟苦酷库裤夸垮挎跨胯块筷侩快宽款匡筐狂框矿眶旷况亏盔岿窥葵奎魁傀"],
["c040","繞",35,"纃",23,"纜纝纞"],
["c080","纮纴纻纼绖绤绬绹缊缐缞缷缹缻",6,"罃罆",9,"罒罓馈愧溃坤昆捆困括扩廓阔垃拉喇蜡腊辣啦莱来赖蓝婪栏拦篮阑兰澜谰揽览懒缆烂滥琅榔狼廊郎朗浪捞劳牢老佬姥酪烙涝勒乐雷镭蕾磊累儡垒擂肋类泪棱楞冷厘梨犁黎篱狸离漓理李里鲤礼莉荔吏栗丽厉励砾历利傈例俐"],
["c140","罖罙罛罜罝罞罠罣",4,"罫罬罭罯罰罳罵罶罷罸罺罻罼罽罿羀羂",7,"羋羍羏",4,"羕",4,"羛羜羠羢羣羥羦羨",6,"羱"],
["c180","羳",4,"羺羻羾翀翂翃翄翆翇翈翉翋翍翏",4,"翖翗翙",5,"翢翣痢立粒沥隶力璃哩俩联莲连镰廉怜涟帘敛脸链恋炼练粮凉梁粱良两辆量晾亮谅撩聊僚疗燎寥辽潦了撂镣廖料列裂烈劣猎琳林磷霖临邻鳞淋凛赁吝拎玲菱零龄铃伶羚凌灵陵岭领另令溜琉榴硫馏留刘瘤流柳六龙聋咙笼窿"],
["c240","翤翧翨翪翫翬翭翯翲翴",6,"翽翾翿耂耇耈耉耊耎耏耑耓耚耛耝耞耟耡耣耤耫",5,"耲耴耹耺耼耾聀聁聄聅聇聈聉聎聏聐聑聓聕聖聗"],
["c280","聙聛",13,"聫",5,"聲",11,"隆垄拢陇楼娄搂篓漏陋芦卢颅庐炉掳卤虏鲁麓碌露路赂鹿潞禄录陆戮驴吕铝侣旅履屡缕虑氯律率滤绿峦挛孪滦卵乱掠略抡轮伦仑沦纶论萝螺罗逻锣箩骡裸落洛骆络妈麻玛码蚂马骂嘛吗埋买麦卖迈脉瞒馒蛮满蔓曼慢漫"],
["c340","聾肁肂肅肈肊肍",5,"肔肕肗肙肞肣肦肧肨肬肰肳肵肶肸肹肻胅胇",4,"胏",6,"胘胟胠胢胣胦胮胵胷胹胻胾胿脀脁脃脄脅脇脈脋"],
["c380","脌脕脗脙脛脜脝脟",12,"脭脮脰脳脴脵脷脹",4,"脿谩芒茫盲氓忙莽猫茅锚毛矛铆卯茂冒帽貌贸么玫枚梅酶霉煤没眉媒镁每美昧寐妹媚门闷们萌蒙檬盟锰猛梦孟眯醚靡糜迷谜弥米秘觅泌蜜密幂棉眠绵冕免勉娩缅面苗描瞄藐秒渺庙妙蔑灭民抿皿敏悯闽明螟鸣铭名命谬摸"],
["c440","腀",5,"腇腉腍腎腏腒腖腗腘腛",4,"腡腢腣腤腦腨腪腫腬腯腲腳腵腶腷腸膁膃",4,"膉膋膌膍膎膐膒",5,"膙膚膞",4,"膤膥"],
["c480","膧膩膫",7,"膴",5,"膼膽膾膿臄臅臇臈臉臋臍",6,"摹蘑模膜磨摩魔抹末莫墨默沫漠寞陌谋牟某拇牡亩姆母墓暮幕募慕木目睦牧穆拿哪呐钠那娜纳氖乃奶耐奈南男难囊挠脑恼闹淖呢馁内嫩能妮霓倪泥尼拟你匿腻逆溺蔫拈年碾撵捻念娘酿鸟尿捏聂孽啮镊镍涅您柠狞凝宁"],
["c540","臔",14,"臤臥臦臨臩臫臮",4,"臵",5,"臽臿舃與",4,"舎舏舑舓舕",5,"舝舠舤舥舦舧舩舮舲舺舼舽舿"],
["c580","艀艁艂艃艅艆艈艊艌艍艎艐",7,"艙艛艜艝艞艠",7,"艩拧泞牛扭钮纽脓浓农弄奴努怒女暖虐疟挪懦糯诺哦欧鸥殴藕呕偶沤啪趴爬帕怕琶拍排牌徘湃派攀潘盘磐盼畔判叛乓庞旁耪胖抛咆刨炮袍跑泡呸胚培裴赔陪配佩沛喷盆砰抨烹澎彭蓬棚硼篷膨朋鹏捧碰坯砒霹批披劈琵毗"],
["c640","艪艫艬艭艱艵艶艷艸艻艼芀芁芃芅芆芇芉芌芐芓芔芕芖芚芛芞芠芢芣芧芲芵芶芺芻芼芿苀苂苃苅苆苉苐苖苙苚苝苢苧苨苩苪苬苭苮苰苲苳苵苶苸"],
["c680","苺苼",4,"茊茋茍茐茒茓茖茘茙茝",9,"茩茪茮茰茲茷茻茽啤脾疲皮匹痞僻屁譬篇偏片骗飘漂瓢票撇瞥拼频贫品聘乒坪苹萍平凭瓶评屏坡泼颇婆破魄迫粕剖扑铺仆莆葡菩蒲埔朴圃普浦谱曝瀑期欺栖戚妻七凄漆柒沏其棋奇歧畦崎脐齐旗祈祁骑起岂乞企启契砌器气迄弃汽泣讫掐"],
["c740","茾茿荁荂荄荅荈荊",4,"荓荕",4,"荝荢荰",6,"荹荺荾",6,"莇莈莊莋莌莍莏莐莑莔莕莖莗莙莚莝莟莡",6,"莬莭莮"],
["c780","莯莵莻莾莿菂菃菄菆菈菉菋菍菎菐菑菒菓菕菗菙菚菛菞菢菣菤菦菧菨菫菬菭恰洽牵扦钎铅千迁签仟谦乾黔钱钳前潜遣浅谴堑嵌欠歉枪呛腔羌墙蔷强抢橇锹敲悄桥瞧乔侨巧鞘撬翘峭俏窍切茄且怯窃钦侵亲秦琴勤芹擒禽寝沁青轻氢倾卿清擎晴氰情顷请庆琼穷秋丘邱球求囚酋泅趋区蛆曲躯屈驱渠"],
["c840","菮華菳",4,"菺菻菼菾菿萀萂萅萇萈萉萊萐萒",5,"萙萚萛萞",5,"萩",7,"萲",5,"萹萺萻萾",7,"葇葈葉"],
["c880","葊",6,"葒",4,"葘葝葞葟葠葢葤",4,"葪葮葯葰葲葴葷葹葻葼取娶龋趣去圈颧权醛泉全痊拳犬券劝缺炔瘸却鹊榷确雀裙群然燃冉染瓤壤攘嚷让饶扰绕惹热壬仁人忍韧任认刃妊纫扔仍日戎茸蓉荣融熔溶容绒冗揉柔肉茹蠕儒孺如辱乳汝入褥软阮蕊瑞锐闰润若弱撒洒萨腮鳃塞赛三叁"],
["c940","葽",4,"蒃蒄蒅蒆蒊蒍蒏",7,"蒘蒚蒛蒝蒞蒟蒠蒢",12,"蒰蒱蒳蒵蒶蒷蒻蒼蒾蓀蓂蓃蓅蓆蓇蓈蓋蓌蓎蓏蓒蓔蓕蓗"],
["c980","蓘",4,"蓞蓡蓢蓤蓧",4,"蓭蓮蓯蓱",10,"蓽蓾蔀蔁蔂伞散桑嗓丧搔骚扫嫂瑟色涩森僧莎砂杀刹沙纱傻啥煞筛晒珊苫杉山删煽衫闪陕擅赡膳善汕扇缮墒伤商赏晌上尚裳梢捎稍烧芍勺韶少哨邵绍奢赊蛇舌舍赦摄射慑涉社设砷申呻伸身深娠绅神沈审婶甚肾慎渗声生甥牲升绳"],
["ca40","蔃",8,"蔍蔎蔏蔐蔒蔔蔕蔖蔘蔙蔛蔜蔝蔞蔠蔢",8,"蔭",9,"蔾",4,"蕄蕅蕆蕇蕋",10],
["ca80","蕗蕘蕚蕛蕜蕝蕟",4,"蕥蕦蕧蕩",8,"蕳蕵蕶蕷蕸蕼蕽蕿薀薁省盛剩胜圣师失狮施湿诗尸虱十石拾时什食蚀实识史矢使屎驶始式示士世柿事拭誓逝势是嗜噬适仕侍释饰氏市恃室视试收手首守寿授售受瘦兽蔬枢梳殊抒输叔舒淑疏书赎孰熟薯暑曙署蜀黍鼠属术述树束戍竖墅庶数漱"],
["cb40","薂薃薆薈",6,"薐",10,"薝",6,"薥薦薧薩薫薬薭薱",5,"薸薺",6,"藂",6,"藊",4,"藑藒"],
["cb80","藔藖",5,"藝",6,"藥藦藧藨藪",14,"恕刷耍摔衰甩帅栓拴霜双爽谁水睡税吮瞬顺舜说硕朔烁斯撕嘶思私司丝死肆寺嗣四伺似饲巳松耸怂颂送宋讼诵搜艘擞嗽苏酥俗素速粟僳塑溯宿诉肃酸蒜算虽隋随绥髓碎岁穗遂隧祟孙损笋蓑梭唆缩琐索锁所塌他它她塔"],
["cc40","藹藺藼藽藾蘀",4,"蘆",10,"蘒蘓蘔蘕蘗",15,"蘨蘪",13,"蘹蘺蘻蘽蘾蘿虀"],
["cc80","虁",11,"虒虓處",4,"虛虜虝號虠虡虣",7,"獭挞蹋踏胎苔抬台泰酞太态汰坍摊贪瘫滩坛檀痰潭谭谈坦毯袒碳探叹炭汤塘搪堂棠膛唐糖倘躺淌趟烫掏涛滔绦萄桃逃淘陶讨套特藤腾疼誊梯剔踢锑提题蹄啼体替嚏惕涕剃屉天添填田甜恬舔腆挑条迢眺跳贴铁帖厅听烃"],
["cd40","虭虯虰虲",6,"蚃",6,"蚎",4,"蚔蚖",5,"蚞",4,"蚥蚦蚫蚭蚮蚲蚳蚷蚸蚹蚻",4,"蛁蛂蛃蛅蛈蛌蛍蛒蛓蛕蛖蛗蛚蛜"],
["cd80","蛝蛠蛡蛢蛣蛥蛦蛧蛨蛪蛫蛬蛯蛵蛶蛷蛺蛻蛼蛽蛿蜁蜄蜅蜆蜋蜌蜎蜏蜐蜑蜔蜖汀廷停亭庭挺艇通桐酮瞳同铜彤童桶捅筒统痛偷投头透凸秃突图徒途涂屠土吐兔湍团推颓腿蜕褪退吞屯臀拖托脱鸵陀驮驼椭妥拓唾挖哇蛙洼娃瓦袜歪外豌弯湾玩顽丸烷完碗挽晚皖惋宛婉万腕汪王亡枉网往旺望忘妄威"],
["ce40","蜙蜛蜝蜟蜠蜤蜦蜧蜨蜪蜫蜬蜭蜯蜰蜲蜳蜵蜶蜸蜹蜺蜼蜽蝀",6,"蝊蝋蝍蝏蝐蝑蝒蝔蝕蝖蝘蝚",5,"蝡蝢蝦",7,"蝯蝱蝲蝳蝵"],
["ce80","蝷蝸蝹蝺蝿螀螁螄螆螇螉螊螌螎",4,"螔螕螖螘",6,"螠",4,"巍微危韦违桅围唯惟为潍维苇萎委伟伪尾纬未蔚味畏胃喂魏位渭谓尉慰卫瘟温蚊文闻纹吻稳紊问嗡翁瓮挝蜗涡窝我斡卧握沃巫呜钨乌污诬屋无芜梧吾吴毋武五捂午舞伍侮坞戊雾晤物勿务悟误昔熙析西硒矽晰嘻吸锡牺"],
["cf40","螥螦螧螩螪螮螰螱螲螴螶螷螸螹螻螼螾螿蟁",4,"蟇蟈蟉蟌",4,"蟔",6,"蟜蟝蟞蟟蟡蟢蟣蟤蟦蟧蟨蟩蟫蟬蟭蟯",9],
["cf80","蟺蟻蟼蟽蟿蠀蠁蠂蠄",5,"蠋",7,"蠔蠗蠘蠙蠚蠜",4,"蠣稀息希悉膝夕惜熄烯溪汐犀檄袭席习媳喜铣洗系隙戏细瞎虾匣霞辖暇峡侠狭下厦夏吓掀锨先仙鲜纤咸贤衔舷闲涎弦嫌显险现献县腺馅羡宪陷限线相厢镶香箱襄湘乡翔祥详想响享项巷橡像向象萧硝霄削哮嚣销消宵淆晓"],
["d040","蠤",13,"蠳",5,"蠺蠻蠽蠾蠿衁衂衃衆",5,"衎",5,"衕衖衘衚",6,"衦衧衪衭衯衱衳衴衵衶衸衹衺"],
["d080","衻衼袀袃袆袇袉袊袌袎袏袐袑袓袔袕袗",4,"袝",4,"袣袥",5,"小孝校肖啸笑效楔些歇蝎鞋协挟携邪斜胁谐写械卸蟹懈泄泻谢屑薪芯锌欣辛新忻心信衅星腥猩惺兴刑型形邢行醒幸杏性姓兄凶胸匈汹雄熊休修羞朽嗅锈秀袖绣墟戌需虚嘘须徐许蓄酗叙旭序畜恤絮婿绪续轩喧宣悬旋玄"],
["d140","袬袮袯袰袲",4,"袸袹袺袻袽袾袿裀裃裄裇裈裊裋裌裍裏裐裑裓裖裗裚",4,"裠裡裦裧裩",6,"裲裵裶裷裺裻製裿褀褁褃",5],
["d180","褉褋",4,"褑褔",4,"褜",4,"褢褣褤褦褧褨褩褬褭褮褯褱褲褳褵褷选癣眩绚靴薛学穴雪血勋熏循旬询寻驯巡殉汛训讯逊迅压押鸦鸭呀丫芽牙蚜崖衙涯雅哑亚讶焉咽阉烟淹盐严研蜒岩延言颜阎炎沿奄掩眼衍演艳堰燕厌砚雁唁彦焰宴谚验殃央鸯秧杨扬佯疡羊洋阳氧仰痒养样漾邀腰妖瑶"],
["d240","褸",8,"襂襃襅",24,"襠",5,"襧",19,"襼"],
["d280","襽襾覀覂覄覅覇",26,"摇尧遥窑谣姚咬舀药要耀椰噎耶爷野冶也页掖业叶曳腋夜液一壹医揖铱依伊衣颐夷遗移仪胰疑沂宜姨彝椅蚁倚已乙矣以艺抑易邑屹亿役臆逸肄疫亦裔意毅忆义益溢诣议谊译异翼翌绎茵荫因殷音阴姻吟银淫寅饮尹引隐"],
["d340","覢",30,"觃觍觓觔觕觗觘觙觛觝觟觠觡觢觤觧觨觩觪觬觭觮觰觱觲觴",6],
["d380","觻",4,"訁",5,"計",21,"印英樱婴鹰应缨莹萤营荧蝇迎赢盈影颖硬映哟拥佣臃痈庸雍踊蛹咏泳涌永恿勇用幽优悠忧尤由邮铀犹油游酉有友右佑釉诱又幼迂淤于盂榆虞愚舆余俞逾鱼愉渝渔隅予娱雨与屿禹宇语羽玉域芋郁吁遇喻峪御愈欲狱育誉"],
["d440","訞",31,"訿",8,"詉",21],
["d480","詟",25,"詺",6,"浴寓裕预豫驭鸳渊冤元垣袁原援辕园员圆猿源缘远苑愿怨院曰约越跃钥岳粤月悦阅耘云郧匀陨允运蕴酝晕韵孕匝砸杂栽哉灾宰载再在咱攒暂赞赃脏葬遭糟凿藻枣早澡蚤躁噪造皂灶燥责择则泽贼怎增憎曾赠扎喳渣札轧"],
["d540","誁",7,"誋",7,"誔",46],
["d580","諃",32,"铡闸眨栅榨咋乍炸诈摘斋宅窄债寨瞻毡詹粘沾盏斩辗崭展蘸栈占战站湛绽樟章彰漳张掌涨杖丈帐账仗胀瘴障招昭找沼赵照罩兆肇召遮折哲蛰辙者锗蔗这浙珍斟真甄砧臻贞针侦枕疹诊震振镇阵蒸挣睁征狰争怔整拯正政"],
["d640","諤",34,"謈",27],
["d680","謤謥謧",30,"帧症郑证芝枝支吱蜘知肢脂汁之织职直植殖执值侄址指止趾只旨纸志挚掷至致置帜峙制智秩稚质炙痔滞治窒中盅忠钟衷终种肿重仲众舟周州洲诌粥轴肘帚咒皱宙昼骤珠株蛛朱猪诸诛逐竹烛煮拄瞩嘱主著柱助蛀贮铸筑"],
["d740","譆",31,"譧",4,"譭",25],
["d780","讇",24,"讬讱讻诇诐诪谉谞住注祝驻抓爪拽专砖转撰赚篆桩庄装妆撞壮状椎锥追赘坠缀谆准捉拙卓桌琢茁酌啄着灼浊兹咨资姿滋淄孜紫仔籽滓子自渍字鬃棕踪宗综总纵邹走奏揍租足卒族祖诅阻组钻纂嘴醉最罪尊遵昨左佐柞做作坐座"],
["d840","谸",8,"豂豃豄豅豈豊豋豍",7,"豖豗豘豙豛",5,"豣",6,"豬",6,"豴豵豶豷豻",6,"貃貄貆貇"],
["d880","貈貋貍",6,"貕貖貗貙",20,"亍丌兀丐廿卅丕亘丞鬲孬噩丨禺丿匕乇夭爻卮氐囟胤馗毓睾鼗丶亟鼐乜乩亓芈孛啬嘏仄厍厝厣厥厮靥赝匚叵匦匮匾赜卦卣刂刈刎刭刳刿剀剌剞剡剜蒯剽劂劁劐劓冂罔亻仃仉仂仨仡仫仞伛仳伢佤仵伥伧伉伫佞佧攸佚佝"],
["d940","貮",62],
["d980","賭",32,"佟佗伲伽佶佴侑侉侃侏佾佻侪佼侬侔俦俨俪俅俚俣俜俑俟俸倩偌俳倬倏倮倭俾倜倌倥倨偾偃偕偈偎偬偻傥傧傩傺僖儆僭僬僦僮儇儋仝氽佘佥俎龠汆籴兮巽黉馘冁夔勹匍訇匐凫夙兕亠兖亳衮袤亵脔裒禀嬴蠃羸冫冱冽冼"],
["da40","贎",14,"贠赑赒赗赟赥赨赩赪赬赮赯赱赲赸",8,"趂趃趆趇趈趉趌",4,"趒趓趕",9,"趠趡"],
["da80","趢趤",12,"趲趶趷趹趻趽跀跁跂跅跇跈跉跊跍跐跒跓跔凇冖冢冥讠讦讧讪讴讵讷诂诃诋诏诎诒诓诔诖诘诙诜诟诠诤诨诩诮诰诳诶诹诼诿谀谂谄谇谌谏谑谒谔谕谖谙谛谘谝谟谠谡谥谧谪谫谮谯谲谳谵谶卩卺阝阢阡阱阪阽阼陂陉陔陟陧陬陲陴隈隍隗隰邗邛邝邙邬邡邴邳邶邺"],
["db40","跕跘跙跜跠跡跢跥跦跧跩跭跮跰跱跲跴跶跼跾",6,"踆踇踈踋踍踎踐踑踒踓踕",7,"踠踡踤",4,"踫踭踰踲踳踴踶踷踸踻踼踾"],
["db80","踿蹃蹅蹆蹌",4,"蹓",5,"蹚",11,"蹧蹨蹪蹫蹮蹱邸邰郏郅邾郐郄郇郓郦郢郜郗郛郫郯郾鄄鄢鄞鄣鄱鄯鄹酃酆刍奂劢劬劭劾哿勐勖勰叟燮矍廴凵凼鬯厶弁畚巯坌垩垡塾墼壅壑圩圬圪圳圹圮圯坜圻坂坩垅坫垆坼坻坨坭坶坳垭垤垌垲埏垧垴垓垠埕埘埚埙埒垸埴埯埸埤埝"],
["dc40","蹳蹵蹷",4,"蹽蹾躀躂躃躄躆躈",6,"躑躒躓躕",6,"躝躟",11,"躭躮躰躱躳",6,"躻",7],
["dc80","軃",10,"軏",21,"堋堍埽埭堀堞堙塄堠塥塬墁墉墚墀馨鼙懿艹艽艿芏芊芨芄芎芑芗芙芫芸芾芰苈苊苣芘芷芮苋苌苁芩芴芡芪芟苄苎芤苡茉苷苤茏茇苜苴苒苘茌苻苓茑茚茆茔茕苠苕茜荑荛荜茈莒茼茴茱莛荞茯荏荇荃荟荀茗荠茭茺茳荦荥"],
["dd40","軥",62],
["dd80","輤",32,"荨茛荩荬荪荭荮莰荸莳莴莠莪莓莜莅荼莶莩荽莸荻莘莞莨莺莼菁萁菥菘堇萘萋菝菽菖萜萸萑萆菔菟萏萃菸菹菪菅菀萦菰菡葜葑葚葙葳蒇蒈葺蒉葸萼葆葩葶蒌蒎萱葭蓁蓍蓐蓦蒽蓓蓊蒿蒺蓠蒡蒹蒴蒗蓥蓣蔌甍蔸蓰蔹蔟蔺"],
["de40","轅",32,"轪辀辌辒辝辠辡辢辤辥辦辧辪辬辭辮辯農辳辴辵辷辸辺辻込辿迀迃迆"],
["de80","迉",4,"迏迒迖迗迚迠迡迣迧迬迯迱迲迴迵迶迺迻迼迾迿逇逈逌逎逓逕逘蕖蔻蓿蓼蕙蕈蕨蕤蕞蕺瞢蕃蕲蕻薤薨薇薏蕹薮薜薅薹薷薰藓藁藜藿蘧蘅蘩蘖蘼廾弈夼奁耷奕奚奘匏尢尥尬尴扌扪抟抻拊拚拗拮挢拶挹捋捃掭揶捱捺掎掴捭掬掊捩掮掼揲揸揠揿揄揞揎摒揆掾摅摁搋搛搠搌搦搡摞撄摭撖"],
["df40","這逜連逤逥逧",5,"逰",4,"逷逹逺逽逿遀遃遅遆遈",4,"過達違遖遙遚遜",5,"遤遦遧適遪遫遬遯",4,"遶",6,"遾邁"],
["df80","還邅邆邇邉邊邌",4,"邒邔邖邘邚邜邞邟邠邤邥邧邨邩邫邭邲邷邼邽邿郀摺撷撸撙撺擀擐擗擤擢攉攥攮弋忒甙弑卟叱叽叩叨叻吒吖吆呋呒呓呔呖呃吡呗呙吣吲咂咔呷呱呤咚咛咄呶呦咝哐咭哂咴哒咧咦哓哔呲咣哕咻咿哌哙哚哜咩咪咤哝哏哞唛哧唠哽唔哳唢唣唏唑唧唪啧喏喵啉啭啁啕唿啐唼"],
["e040","郂郃郆郈郉郋郌郍郒郔郕郖郘郙郚郞郟郠郣郤郥郩郪郬郮郰郱郲郳郵郶郷郹郺郻郼郿鄀鄁鄃鄅",19,"鄚鄛鄜"],
["e080","鄝鄟鄠鄡鄤",10,"鄰鄲",6,"鄺",8,"酄唷啖啵啶啷唳唰啜喋嗒喃喱喹喈喁喟啾嗖喑啻嗟喽喾喔喙嗪嗷嗉嘟嗑嗫嗬嗔嗦嗝嗄嗯嗥嗲嗳嗌嗍嗨嗵嗤辔嘞嘈嘌嘁嘤嘣嗾嘀嘧嘭噘嘹噗嘬噍噢噙噜噌噔嚆噤噱噫噻噼嚅嚓嚯囔囗囝囡囵囫囹囿圄圊圉圜帏帙帔帑帱帻帼"],
["e140","酅酇酈酑酓酔酕酖酘酙酛酜酟酠酦酧酨酫酭酳酺酻酼醀",4,"醆醈醊醎醏醓",6,"醜",5,"醤",5,"醫醬醰醱醲醳醶醷醸醹醻"],
["e180","醼",10,"釈釋釐釒",9,"針",8,"帷幄幔幛幞幡岌屺岍岐岖岈岘岙岑岚岜岵岢岽岬岫岱岣峁岷峄峒峤峋峥崂崃崧崦崮崤崞崆崛嵘崾崴崽嵬嵛嵯嵝嵫嵋嵊嵩嵴嶂嶙嶝豳嶷巅彳彷徂徇徉後徕徙徜徨徭徵徼衢彡犭犰犴犷犸狃狁狎狍狒狨狯狩狲狴狷猁狳猃狺"],
["e240","釦",62],
["e280","鈥",32,"狻猗猓猡猊猞猝猕猢猹猥猬猸猱獐獍獗獠獬獯獾舛夥飧夤夂饣饧",5,"饴饷饽馀馄馇馊馍馐馑馓馔馕庀庑庋庖庥庠庹庵庾庳赓廒廑廛廨廪膺忄忉忖忏怃忮怄忡忤忾怅怆忪忭忸怙怵怦怛怏怍怩怫怊怿怡恸恹恻恺恂"],
["e340","鉆",45,"鉵",16],
["e380","銆",7,"銏",24,"恪恽悖悚悭悝悃悒悌悛惬悻悱惝惘惆惚悴愠愦愕愣惴愀愎愫慊慵憬憔憧憷懔懵忝隳闩闫闱闳闵闶闼闾阃阄阆阈阊阋阌阍阏阒阕阖阗阙阚丬爿戕氵汔汜汊沣沅沐沔沌汨汩汴汶沆沩泐泔沭泷泸泱泗沲泠泖泺泫泮沱泓泯泾"],
["e440","銨",5,"銯",24,"鋉",31],
["e480","鋩",32,"洹洧洌浃浈洇洄洙洎洫浍洮洵洚浏浒浔洳涑浯涞涠浞涓涔浜浠浼浣渚淇淅淞渎涿淠渑淦淝淙渖涫渌涮渫湮湎湫溲湟溆湓湔渲渥湄滟溱溘滠漭滢溥溧溽溻溷滗溴滏溏滂溟潢潆潇漤漕滹漯漶潋潴漪漉漩澉澍澌潸潲潼潺濑"],
["e540","錊",51,"錿",10],
["e580","鍊",31,"鍫濉澧澹澶濂濡濮濞濠濯瀚瀣瀛瀹瀵灏灞宀宄宕宓宥宸甯骞搴寤寮褰寰蹇謇辶迓迕迥迮迤迩迦迳迨逅逄逋逦逑逍逖逡逵逶逭逯遄遑遒遐遨遘遢遛暹遴遽邂邈邃邋彐彗彖彘尻咫屐屙孱屣屦羼弪弩弭艴弼鬻屮妁妃妍妩妪妣"],
["e640","鍬",34,"鎐",27],
["e680","鎬",29,"鏋鏌鏍妗姊妫妞妤姒妲妯姗妾娅娆姝娈姣姘姹娌娉娲娴娑娣娓婀婧婊婕娼婢婵胬媪媛婷婺媾嫫媲嫒嫔媸嫠嫣嫱嫖嫦嫘嫜嬉嬗嬖嬲嬷孀尕尜孚孥孳孑孓孢驵驷驸驺驿驽骀骁骅骈骊骐骒骓骖骘骛骜骝骟骠骢骣骥骧纟纡纣纥纨纩"],
["e740","鏎",7,"鏗",54],
["e780","鐎",32,"纭纰纾绀绁绂绉绋绌绐绔绗绛绠绡绨绫绮绯绱绲缍绶绺绻绾缁缂缃缇缈缋缌缏缑缒缗缙缜缛缟缡",6,"缪缫缬缭缯",4,"缵幺畿巛甾邕玎玑玮玢玟珏珂珑玷玳珀珉珈珥珙顼琊珩珧珞玺珲琏琪瑛琦琥琨琰琮琬"],
["e840","鐯",14,"鐿",43,"鑬鑭鑮鑯"],
["e880","鑰",20,"钑钖钘铇铏铓铔铚铦铻锜锠琛琚瑁瑜瑗瑕瑙瑷瑭瑾璜璎璀璁璇璋璞璨璩璐璧瓒璺韪韫韬杌杓杞杈杩枥枇杪杳枘枧杵枨枞枭枋杷杼柰栉柘栊柩枰栌柙枵柚枳柝栀柃枸柢栎柁柽栲栳桠桡桎桢桄桤梃栝桕桦桁桧桀栾桊桉栩梵梏桴桷梓桫棂楮棼椟椠棹"],
["e940","锧锳锽镃镈镋镕镚镠镮镴镵長",7,"門",42],
["e980","閫",32,"椤棰椋椁楗棣椐楱椹楠楂楝榄楫榀榘楸椴槌榇榈槎榉楦楣楹榛榧榻榫榭槔榱槁槊槟榕槠榍槿樯槭樗樘橥槲橄樾檠橐橛樵檎橹樽樨橘橼檑檐檩檗檫猷獒殁殂殇殄殒殓殍殚殛殡殪轫轭轱轲轳轵轶轸轷轹轺轼轾辁辂辄辇辋"],
["ea40","闌",27,"闬闿阇阓阘阛阞阠阣",6,"阫阬阭阯阰阷阸阹阺阾陁陃陊陎陏陑陒陓陖陗"],
["ea80","陘陙陚陜陝陞陠陣陥陦陫陭",4,"陳陸",12,"隇隉隊辍辎辏辘辚軎戋戗戛戟戢戡戥戤戬臧瓯瓴瓿甏甑甓攴旮旯旰昊昙杲昃昕昀炅曷昝昴昱昶昵耆晟晔晁晏晖晡晗晷暄暌暧暝暾曛曜曦曩贲贳贶贻贽赀赅赆赈赉赇赍赕赙觇觊觋觌觎觏觐觑牮犟牝牦牯牾牿犄犋犍犏犒挈挲掰"],
["eb40","隌階隑隒隓隕隖隚際隝",9,"隨",7,"隱隲隴隵隷隸隺隻隿雂雃雈雊雋雐雑雓雔雖",9,"雡",6,"雫"],
["eb80","雬雭雮雰雱雲雴雵雸雺電雼雽雿霂霃霅霊霋霌霐霑霒霔霕霗",4,"霝霟霠搿擘耄毪毳毽毵毹氅氇氆氍氕氘氙氚氡氩氤氪氲攵敕敫牍牒牖爰虢刖肟肜肓肼朊肽肱肫肭肴肷胧胨胩胪胛胂胄胙胍胗朐胝胫胱胴胭脍脎胲胼朕脒豚脶脞脬脘脲腈腌腓腴腙腚腱腠腩腼腽腭腧塍媵膈膂膑滕膣膪臌朦臊膻"],
["ec40","霡",8,"霫霬霮霯霱霳",4,"霺霻霼霽霿",18,"靔靕靗靘靚靜靝靟靣靤靦靧靨靪",7],
["ec80","靲靵靷",4,"靽",7,"鞆",4,"鞌鞎鞏鞐鞓鞕鞖鞗鞙",4,"臁膦欤欷欹歃歆歙飑飒飓飕飙飚殳彀毂觳斐齑斓於旆旄旃旌旎旒旖炀炜炖炝炻烀炷炫炱烨烊焐焓焖焯焱煳煜煨煅煲煊煸煺熘熳熵熨熠燠燔燧燹爝爨灬焘煦熹戾戽扃扈扉礻祀祆祉祛祜祓祚祢祗祠祯祧祺禅禊禚禧禳忑忐"],
["ed40","鞞鞟鞡鞢鞤",6,"鞬鞮鞰鞱鞳鞵",46],
["ed80","韤韥韨韮",4,"韴韷",23,"怼恝恚恧恁恙恣悫愆愍慝憩憝懋懑戆肀聿沓泶淼矶矸砀砉砗砘砑斫砭砜砝砹砺砻砟砼砥砬砣砩硎硭硖硗砦硐硇硌硪碛碓碚碇碜碡碣碲碹碥磔磙磉磬磲礅磴礓礤礞礴龛黹黻黼盱眄眍盹眇眈眚眢眙眭眦眵眸睐睑睇睃睚睨"],
["ee40","頏",62],
["ee80","顎",32,"睢睥睿瞍睽瞀瞌瞑瞟瞠瞰瞵瞽町畀畎畋畈畛畲畹疃罘罡罟詈罨罴罱罹羁罾盍盥蠲钅钆钇钋钊钌钍钏钐钔钗钕钚钛钜钣钤钫钪钭钬钯钰钲钴钶",4,"钼钽钿铄铈",6,"铐铑铒铕铖铗铙铘铛铞铟铠铢铤铥铧铨铪"],
["ef40","顯",5,"颋颎颒颕颙颣風",37,"飏飐飔飖飗飛飜飝飠",4],
["ef80","飥飦飩",30,"铩铫铮铯铳铴铵铷铹铼铽铿锃锂锆锇锉锊锍锎锏锒",4,"锘锛锝锞锟锢锪锫锩锬锱锲锴锶锷锸锼锾锿镂锵镄镅镆镉镌镎镏镒镓镔镖镗镘镙镛镞镟镝镡镢镤",8,"镯镱镲镳锺矧矬雉秕秭秣秫稆嵇稃稂稞稔"],
["f040","餈",4,"餎餏餑",28,"餯",26],
["f080","饊",9,"饖",12,"饤饦饳饸饹饻饾馂馃馉稹稷穑黏馥穰皈皎皓皙皤瓞瓠甬鸠鸢鸨",4,"鸲鸱鸶鸸鸷鸹鸺鸾鹁鹂鹄鹆鹇鹈鹉鹋鹌鹎鹑鹕鹗鹚鹛鹜鹞鹣鹦",6,"鹱鹭鹳疒疔疖疠疝疬疣疳疴疸痄疱疰痃痂痖痍痣痨痦痤痫痧瘃痱痼痿瘐瘀瘅瘌瘗瘊瘥瘘瘕瘙"],
["f140","馌馎馚",10,"馦馧馩",47],
["f180","駙",32,"瘛瘼瘢瘠癀瘭瘰瘿瘵癃瘾瘳癍癞癔癜癖癫癯翊竦穸穹窀窆窈窕窦窠窬窨窭窳衤衩衲衽衿袂袢裆袷袼裉裢裎裣裥裱褚裼裨裾裰褡褙褓褛褊褴褫褶襁襦襻疋胥皲皴矜耒耔耖耜耠耢耥耦耧耩耨耱耋耵聃聆聍聒聩聱覃顸颀颃"],
["f240","駺",62],
["f280","騹",32,"颉颌颍颏颔颚颛颞颟颡颢颥颦虍虔虬虮虿虺虼虻蚨蚍蚋蚬蚝蚧蚣蚪蚓蚩蚶蛄蚵蛎蚰蚺蚱蚯蛉蛏蚴蛩蛱蛲蛭蛳蛐蜓蛞蛴蛟蛘蛑蜃蜇蛸蜈蜊蜍蜉蜣蜻蜞蜥蜮蜚蜾蝈蜴蜱蜩蜷蜿螂蜢蝽蝾蝻蝠蝰蝌蝮螋蝓蝣蝼蝤蝙蝥螓螯螨蟒"],
["f340","驚",17,"驲骃骉骍骎骔骕骙骦骩",6,"骲骳骴骵骹骻骽骾骿髃髄髆",4,"髍髎髏髐髒體髕髖髗髙髚髛髜"],
["f380","髝髞髠髢髣髤髥髧髨髩髪髬髮髰",8,"髺髼",6,"鬄鬅鬆蟆螈螅螭螗螃螫蟥螬螵螳蟋蟓螽蟑蟀蟊蟛蟪蟠蟮蠖蠓蟾蠊蠛蠡蠹蠼缶罂罄罅舐竺竽笈笃笄笕笊笫笏筇笸笪笙笮笱笠笥笤笳笾笞筘筚筅筵筌筝筠筮筻筢筲筱箐箦箧箸箬箝箨箅箪箜箢箫箴篑篁篌篝篚篥篦篪簌篾篼簏簖簋"],
["f440","鬇鬉",5,"鬐鬑鬒鬔",10,"鬠鬡鬢鬤",10,"鬰鬱鬳",7,"鬽鬾鬿魀魆魊魋魌魎魐魒魓魕",5],
["f480","魛",32,"簟簪簦簸籁籀臾舁舂舄臬衄舡舢舣舭舯舨舫舸舻舳舴舾艄艉艋艏艚艟艨衾袅袈裘裟襞羝羟羧羯羰羲籼敉粑粝粜粞粢粲粼粽糁糇糌糍糈糅糗糨艮暨羿翎翕翥翡翦翩翮翳糸絷綦綮繇纛麸麴赳趄趔趑趱赧赭豇豉酊酐酎酏酤"],
["f540","魼",62],
["f580","鮻",32,"酢酡酰酩酯酽酾酲酴酹醌醅醐醍醑醢醣醪醭醮醯醵醴醺豕鹾趸跫踅蹙蹩趵趿趼趺跄跖跗跚跞跎跏跛跆跬跷跸跣跹跻跤踉跽踔踝踟踬踮踣踯踺蹀踹踵踽踱蹉蹁蹂蹑蹒蹊蹰蹶蹼蹯蹴躅躏躔躐躜躞豸貂貊貅貘貔斛觖觞觚觜"],
["f640","鯜",62],
["f680","鰛",32,"觥觫觯訾謦靓雩雳雯霆霁霈霏霎霪霭霰霾龀龃龅",5,"龌黾鼋鼍隹隼隽雎雒瞿雠銎銮鋈錾鍪鏊鎏鐾鑫鱿鲂鲅鲆鲇鲈稣鲋鲎鲐鲑鲒鲔鲕鲚鲛鲞",5,"鲥",4,"鲫鲭鲮鲰",7,"鲺鲻鲼鲽鳄鳅鳆鳇鳊鳋"],
["f740","鰼",62],
["f780","鱻鱽鱾鲀鲃鲄鲉鲊鲌鲏鲓鲖鲗鲘鲙鲝鲪鲬鲯鲹鲾",4,"鳈鳉鳑鳒鳚鳛鳠鳡鳌",4,"鳓鳔鳕鳗鳘鳙鳜鳝鳟鳢靼鞅鞑鞒鞔鞯鞫鞣鞲鞴骱骰骷鹘骶骺骼髁髀髅髂髋髌髑魅魃魇魉魈魍魑飨餍餮饕饔髟髡髦髯髫髻髭髹鬈鬏鬓鬟鬣麽麾縻麂麇麈麋麒鏖麝麟黛黜黝黠黟黢黩黧黥黪黯鼢鼬鼯鼹鼷鼽鼾齄"],
["f840","鳣",62],
["f880","鴢",32],
["f940","鵃",62],
["f980","鶂",32],
["fa40","鶣",62],
["fa80","鷢",32],
["fb40","鸃",27,"鸤鸧鸮鸰鸴鸻鸼鹀鹍鹐鹒鹓鹔鹖鹙鹝鹟鹠鹡鹢鹥鹮鹯鹲鹴",9,"麀"],
["fb80","麁麃麄麅麆麉麊麌",5,"麔",8,"麞麠",5,"麧麨麩麪"],
["fc40","麫",8,"麵麶麷麹麺麼麿",4,"黅黆黇黈黊黋黌黐黒黓黕黖黗黙黚點黡黣黤黦黨黫黬黭黮黰",8,"黺黽黿",6],
["fc80","鼆",4,"鼌鼏鼑鼒鼔鼕鼖鼘鼚",5,"鼡鼣",8,"鼭鼮鼰鼱"],
["fd40","鼲",4,"鼸鼺鼼鼿",4,"齅",10,"齒",38],
["fd80","齹",5,"龁龂龍",11,"龜龝龞龡",4,"郎凉秊裏隣"],
["fe40","兀嗀﨎﨏﨑﨓﨔礼﨟蘒﨡﨣﨤﨧﨨﨩"]
]

},{}],23:[function(require,module,exports){
module.exports=[
["0","\u0000",127],
["8141","갂갃갅갆갋",4,"갘갞갟갡갢갣갥",6,"갮갲갳갴"],
["8161","갵갶갷갺갻갽갾갿걁",9,"걌걎",5,"걕"],
["8181","걖걗걙걚걛걝",18,"걲걳걵걶걹걻",4,"겂겇겈겍겎겏겑겒겓겕",6,"겞겢",5,"겫겭겮겱",6,"겺겾겿곀곂곃곅곆곇곉곊곋곍",7,"곖곘",7,"곢곣곥곦곩곫곭곮곲곴곷",4,"곾곿괁괂괃괅괇",4,"괎괐괒괓"],
["8241","괔괕괖괗괙괚괛괝괞괟괡",7,"괪괫괮",5],
["8261","괶괷괹괺괻괽",6,"굆굈굊",5,"굑굒굓굕굖굗"],
["8281","굙",7,"굢굤",7,"굮굯굱굲굷굸굹굺굾궀궃",4,"궊궋궍궎궏궑",10,"궞",5,"궥",17,"궸",7,"귂귃귅귆귇귉",6,"귒귔",7,"귝귞귟귡귢귣귥",18],
["8341","귺귻귽귾긂",5,"긊긌긎",5,"긕",7],
["8361","긝",18,"긲긳긵긶긹긻긼"],
["8381","긽긾긿깂깄깇깈깉깋깏깑깒깓깕깗",4,"깞깢깣깤깦깧깪깫깭깮깯깱",6,"깺깾",5,"꺆",5,"꺍",46,"꺿껁껂껃껅",6,"껎껒",5,"껚껛껝",8],
["8441","껦껧껩껪껬껮",5,"껵껶껷껹껺껻껽",8],
["8461","꼆꼉꼊꼋꼌꼎꼏꼑",18],
["8481","꼤",7,"꼮꼯꼱꼳꼵",6,"꼾꽀꽄꽅꽆꽇꽊",5,"꽑",10,"꽞",5,"꽦",18,"꽺",5,"꾁꾂꾃꾅꾆꾇꾉",6,"꾒꾓꾔꾖",5,"꾝",26,"꾺꾻꾽꾾"],
["8541","꾿꿁",5,"꿊꿌꿏",4,"꿕",6,"꿝",4],
["8561","꿢",5,"꿪",5,"꿲꿳꿵꿶꿷꿹",6,"뀂뀃"],
["8581","뀅",6,"뀍뀎뀏뀑뀒뀓뀕",6,"뀞",9,"뀩",26,"끆끇끉끋끍끏끐끑끒끖끘끚끛끜끞",29,"끾끿낁낂낃낅",6,"낎낐낒",5,"낛낝낞낣낤"],
["8641","낥낦낧낪낰낲낶낷낹낺낻낽",6,"냆냊",5,"냒"],
["8661","냓냕냖냗냙",6,"냡냢냣냤냦",10],
["8681","냱",22,"넊넍넎넏넑넔넕넖넗넚넞",4,"넦넧넩넪넫넭",6,"넶넺",5,"녂녃녅녆녇녉",6,"녒녓녖녗녙녚녛녝녞녟녡",22,"녺녻녽녾녿놁놃",4,"놊놌놎놏놐놑놕놖놗놙놚놛놝"],
["8741","놞",9,"놩",15],
["8761","놹",18,"뇍뇎뇏뇑뇒뇓뇕"],
["8781","뇖",5,"뇞뇠",7,"뇪뇫뇭뇮뇯뇱",7,"뇺뇼뇾",5,"눆눇눉눊눍",6,"눖눘눚",5,"눡",18,"눵",6,"눽",26,"뉙뉚뉛뉝뉞뉟뉡",6,"뉪",4],
["8841","뉯",4,"뉶",5,"뉽",6,"늆늇늈늊",4],
["8861","늏늒늓늕늖늗늛",4,"늢늤늧늨늩늫늭늮늯늱늲늳늵늶늷"],
["8881","늸",15,"닊닋닍닎닏닑닓",4,"닚닜닞닟닠닡닣닧닩닪닰닱닲닶닼닽닾댂댃댅댆댇댉",6,"댒댖",5,"댝",54,"덗덙덚덝덠덡덢덣"],
["8941","덦덨덪덬덭덯덲덳덵덶덷덹",6,"뎂뎆",5,"뎍"],
["8961","뎎뎏뎑뎒뎓뎕",10,"뎢",5,"뎩뎪뎫뎭"],
["8981","뎮",21,"돆돇돉돊돍돏돑돒돓돖돘돚돜돞돟돡돢돣돥돦돧돩",18,"돽",18,"됑",6,"됙됚됛됝됞됟됡",6,"됪됬",7,"됵",15],
["8a41","둅",10,"둒둓둕둖둗둙",6,"둢둤둦"],
["8a61","둧",4,"둭",18,"뒁뒂"],
["8a81","뒃",4,"뒉",19,"뒞",5,"뒥뒦뒧뒩뒪뒫뒭",7,"뒶뒸뒺",5,"듁듂듃듅듆듇듉",6,"듑듒듓듔듖",5,"듞듟듡듢듥듧",4,"듮듰듲",5,"듹",26,"딖딗딙딚딝"],
["8b41","딞",5,"딦딫",4,"딲딳딵딶딷딹",6,"땂땆"],
["8b61","땇땈땉땊땎땏땑땒땓땕",6,"땞땢",8],
["8b81","땫",52,"떢떣떥떦떧떩떬떭떮떯떲떶",4,"떾떿뗁뗂뗃뗅",6,"뗎뗒",5,"뗙",18,"뗭",18],
["8c41","똀",15,"똒똓똕똖똗똙",4],
["8c61","똞",6,"똦",5,"똭",6,"똵",5],
["8c81","똻",12,"뙉",26,"뙥뙦뙧뙩",50,"뚞뚟뚡뚢뚣뚥",5,"뚭뚮뚯뚰뚲",16],
["8d41","뛃",16,"뛕",8],
["8d61","뛞",17,"뛱뛲뛳뛵뛶뛷뛹뛺"],
["8d81","뛻",4,"뜂뜃뜄뜆",33,"뜪뜫뜭뜮뜱",6,"뜺뜼",7,"띅띆띇띉띊띋띍",6,"띖",9,"띡띢띣띥띦띧띩",6,"띲띴띶",5,"띾띿랁랂랃랅",6,"랎랓랔랕랚랛랝랞"],
["8e41","랟랡",6,"랪랮",5,"랶랷랹",8],
["8e61","럂",4,"럈럊",19],
["8e81","럞",13,"럮럯럱럲럳럵",6,"럾렂",4,"렊렋렍렎렏렑",6,"렚렜렞",5,"렦렧렩렪렫렭",6,"렶렺",5,"롁롂롃롅",11,"롒롔",7,"롞롟롡롢롣롥",6,"롮롰롲",5,"롹롺롻롽",7],
["8f41","뢅",7,"뢎",17],
["8f61","뢠",7,"뢩",6,"뢱뢲뢳뢵뢶뢷뢹",4],
["8f81","뢾뢿룂룄룆",5,"룍룎룏룑룒룓룕",7,"룞룠룢",5,"룪룫룭룮룯룱",6,"룺룼룾",5,"뤅",18,"뤙",6,"뤡",26,"뤾뤿륁륂륃륅",6,"륍륎륐륒",5],
["9041","륚륛륝륞륟륡",6,"륪륬륮",5,"륶륷륹륺륻륽"],
["9061","륾",5,"릆릈릋릌릏",15],
["9081","릟",12,"릮릯릱릲릳릵",6,"릾맀맂",5,"맊맋맍맓",4,"맚맜맟맠맢맦맧맩맪맫맭",6,"맶맻",4,"먂",5,"먉",11,"먖",33,"먺먻먽먾먿멁멃멄멅멆"],
["9141","멇멊멌멏멐멑멒멖멗멙멚멛멝",6,"멦멪",5],
["9161","멲멳멵멶멷멹",9,"몆몈몉몊몋몍",5],
["9181","몓",20,"몪몭몮몯몱몳",4,"몺몼몾",5,"뫅뫆뫇뫉",14,"뫚",33,"뫽뫾뫿묁묂묃묅",7,"묎묐묒",5,"묙묚묛묝묞묟묡",6],
["9241","묨묪묬",7,"묷묹묺묿",4,"뭆뭈뭊뭋뭌뭎뭑뭒"],
["9261","뭓뭕뭖뭗뭙",7,"뭢뭤",7,"뭭",4],
["9281","뭲",21,"뮉뮊뮋뮍뮎뮏뮑",18,"뮥뮦뮧뮩뮪뮫뮭",6,"뮵뮶뮸",7,"믁믂믃믅믆믇믉",6,"믑믒믔",35,"믺믻믽믾밁"],
["9341","밃",4,"밊밎밐밒밓밙밚밠밡밢밣밦밨밪밫밬밮밯밲밳밵"],
["9361","밶밷밹",6,"뱂뱆뱇뱈뱊뱋뱎뱏뱑",8],
["9381","뱚뱛뱜뱞",37,"벆벇벉벊벍벏",4,"벖벘벛",4,"벢벣벥벦벩",6,"벲벶",5,"벾벿볁볂볃볅",7,"볎볒볓볔볖볗볙볚볛볝",22,"볷볹볺볻볽"],
["9441","볾",5,"봆봈봊",5,"봑봒봓봕",8],
["9461","봞",5,"봥",6,"봭",12],
["9481","봺",5,"뵁",6,"뵊뵋뵍뵎뵏뵑",6,"뵚",9,"뵥뵦뵧뵩",22,"붂붃붅붆붋",4,"붒붔붖붗붘붛붝",6,"붥",10,"붱",6,"붹",24],
["9541","뷒뷓뷖뷗뷙뷚뷛뷝",11,"뷪",5,"뷱"],
["9561","뷲뷳뷵뷶뷷뷹",6,"븁븂븄븆",5,"븎븏븑븒븓"],
["9581","븕",6,"븞븠",35,"빆빇빉빊빋빍빏",4,"빖빘빜빝빞빟빢빣빥빦빧빩빫",4,"빲빶",4,"빾빿뺁뺂뺃뺅",6,"뺎뺒",5,"뺚",13,"뺩",14],
["9641","뺸",23,"뻒뻓"],
["9661","뻕뻖뻙",6,"뻡뻢뻦",5,"뻭",8],
["9681","뻶",10,"뼂",5,"뼊",13,"뼚뼞",33,"뽂뽃뽅뽆뽇뽉",6,"뽒뽓뽔뽖",44],
["9741","뾃",16,"뾕",8],
["9761","뾞",17,"뾱",7],
["9781","뾹",11,"뿆",5,"뿎뿏뿑뿒뿓뿕",6,"뿝뿞뿠뿢",89,"쀽쀾쀿"],
["9841","쁀",16,"쁒",5,"쁙쁚쁛"],
["9861","쁝쁞쁟쁡",6,"쁪",15],
["9881","쁺",21,"삒삓삕삖삗삙",6,"삢삤삦",5,"삮삱삲삷",4,"삾샂샃샄샆샇샊샋샍샎샏샑",6,"샚샞",5,"샦샧샩샪샫샭",6,"샶샸샺",5,"섁섂섃섅섆섇섉",6,"섑섒섓섔섖",5,"섡섢섥섨섩섪섫섮"],
["9941","섲섳섴섵섷섺섻섽섾섿셁",6,"셊셎",5,"셖셗"],
["9961","셙셚셛셝",6,"셦셪",5,"셱셲셳셵셶셷셹셺셻"],
["9981","셼",8,"솆",5,"솏솑솒솓솕솗",4,"솞솠솢솣솤솦솧솪솫솭솮솯솱",11,"솾",5,"쇅쇆쇇쇉쇊쇋쇍",6,"쇕쇖쇙",6,"쇡쇢쇣쇥쇦쇧쇩",6,"쇲쇴",7,"쇾쇿숁숂숃숅",6,"숎숐숒",5,"숚숛숝숞숡숢숣"],
["9a41","숤숥숦숧숪숬숮숰숳숵",16],
["9a61","쉆쉇쉉",6,"쉒쉓쉕쉖쉗쉙",6,"쉡쉢쉣쉤쉦"],
["9a81","쉧",4,"쉮쉯쉱쉲쉳쉵",6,"쉾슀슂",5,"슊",5,"슑",6,"슙슚슜슞",5,"슦슧슩슪슫슮",5,"슶슸슺",33,"싞싟싡싢싥",5,"싮싰싲싳싴싵싷싺싽싾싿쌁",6,"쌊쌋쌎쌏"],
["9b41","쌐쌑쌒쌖쌗쌙쌚쌛쌝",6,"쌦쌧쌪",8],
["9b61","쌳",17,"썆",7],
["9b81","썎",25,"썪썫썭썮썯썱썳",4,"썺썻썾",5,"쎅쎆쎇쎉쎊쎋쎍",50,"쏁",22,"쏚"],
["9c41","쏛쏝쏞쏡쏣",4,"쏪쏫쏬쏮",5,"쏶쏷쏹",5],
["9c61","쏿",8,"쐉",6,"쐑",9],
["9c81","쐛",8,"쐥",6,"쐭쐮쐯쐱쐲쐳쐵",6,"쐾",9,"쑉",26,"쑦쑧쑩쑪쑫쑭",6,"쑶쑷쑸쑺",5,"쒁",18,"쒕",6,"쒝",12],
["9d41","쒪",13,"쒹쒺쒻쒽",8],
["9d61","쓆",25],
["9d81","쓠",8,"쓪",5,"쓲쓳쓵쓶쓷쓹쓻쓼쓽쓾씂",9,"씍씎씏씑씒씓씕",6,"씝",10,"씪씫씭씮씯씱",6,"씺씼씾",5,"앆앇앋앏앐앑앒앖앚앛앜앟앢앣앥앦앧앩",6,"앲앶",5,"앾앿얁얂얃얅얆얈얉얊얋얎얐얒얓얔"],
["9e41","얖얙얚얛얝얞얟얡",7,"얪",9,"얶"],
["9e61","얷얺얿",4,"엋엍엏엒엓엕엖엗엙",6,"엢엤엦엧"],
["9e81","엨엩엪엫엯엱엲엳엵엸엹엺엻옂옃옄옉옊옋옍옎옏옑",6,"옚옝",6,"옦옧옩옪옫옯옱옲옶옸옺옼옽옾옿왂왃왅왆왇왉",6,"왒왖",5,"왞왟왡",10,"왭왮왰왲",5,"왺왻왽왾왿욁",6,"욊욌욎",5,"욖욗욙욚욛욝",6,"욦"],
["9f41","욨욪",5,"욲욳욵욶욷욻",4,"웂웄웆",5,"웎"],
["9f61","웏웑웒웓웕",6,"웞웟웢",5,"웪웫웭웮웯웱웲"],
["9f81","웳",4,"웺웻웼웾",5,"윆윇윉윊윋윍",6,"윖윘윚",5,"윢윣윥윦윧윩",6,"윲윴윶윸윹윺윻윾윿읁읂읃읅",4,"읋읎읐읙읚읛읝읞읟읡",6,"읩읪읬",7,"읶읷읹읺읻읿잀잁잂잆잋잌잍잏잒잓잕잙잛",4,"잢잧",4,"잮잯잱잲잳잵잶잷"],
["a041","잸잹잺잻잾쟂",5,"쟊쟋쟍쟏쟑",6,"쟙쟚쟛쟜"],
["a061","쟞",5,"쟥쟦쟧쟩쟪쟫쟭",13],
["a081","쟻",4,"젂젃젅젆젇젉젋",4,"젒젔젗",4,"젞젟젡젢젣젥",6,"젮젰젲",5,"젹젺젻젽젾젿졁",6,"졊졋졎",5,"졕",26,"졲졳졵졶졷졹졻",4,"좂좄좈좉좊좎",5,"좕",7,"좞좠좢좣좤"],
["a141","좥좦좧좩",18,"좾좿죀죁"],
["a161","죂죃죅죆죇죉죊죋죍",6,"죖죘죚",5,"죢죣죥"],
["a181","죦",14,"죶",5,"죾죿줁줂줃줇",4,"줎　、。·‥…¨〃­―∥＼∼‘’“”〔〕〈",9,"±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§※☆★○●◎◇◆□■△▲▽▼→←↑↓↔〓≪≫√∽∝∵∫∬∈∋⊆⊇⊂⊃∪∩∧∨￢"],
["a241","줐줒",5,"줙",18],
["a261","줭",6,"줵",18],
["a281","쥈",7,"쥒쥓쥕쥖쥗쥙",6,"쥢쥤",7,"쥭쥮쥯⇒⇔∀∃´～ˇ˘˝˚˙¸˛¡¿ː∮∑∏¤℉‰◁◀▷▶♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▦▩♨☏☎☜☞¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡€®"],
["a341","쥱쥲쥳쥵",6,"쥽",10,"즊즋즍즎즏"],
["a361","즑",6,"즚즜즞",16],
["a381","즯",16,"짂짃짅짆짉짋",4,"짒짔짗짘짛！",58,"￦］",32,"￣"],
["a441","짞짟짡짣짥짦짨짩짪짫짮짲",5,"짺짻짽짾짿쨁쨂쨃쨄"],
["a461","쨅쨆쨇쨊쨎",5,"쨕쨖쨗쨙",12],
["a481","쨦쨧쨨쨪",28,"ㄱ",93],
["a541","쩇",4,"쩎쩏쩑쩒쩓쩕",6,"쩞쩢",5,"쩩쩪"],
["a561","쩫",17,"쩾",5,"쪅쪆"],
["a581","쪇",16,"쪙",14,"ⅰ",9],
["a5b0","Ⅰ",9],
["a5c1","Α",16,"Σ",6],
["a5e1","α",16,"σ",6],
["a641","쪨",19,"쪾쪿쫁쫂쫃쫅"],
["a661","쫆",5,"쫎쫐쫒쫔쫕쫖쫗쫚",5,"쫡",6],
["a681","쫨쫩쫪쫫쫭",6,"쫵",18,"쬉쬊─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂┒┑┚┙┖┕┎┍┞┟┡┢┦┧┩┪┭┮┱┲┵┶┹┺┽┾╀╁╃",7],
["a741","쬋",4,"쬑쬒쬓쬕쬖쬗쬙",6,"쬢",7],
["a761","쬪",22,"쭂쭃쭄"],
["a781","쭅쭆쭇쭊쭋쭍쭎쭏쭑",6,"쭚쭛쭜쭞",5,"쭥",7,"㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙",9,"㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰",9,"㎀",4,"㎺",5,"㎐",4,"Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆"],
["a841","쭭",10,"쭺",14],
["a861","쮉",18,"쮝",6],
["a881","쮤",19,"쮹",11,"ÆÐªĦ"],
["a8a6","Ĳ"],
["a8a8","ĿŁØŒºÞŦŊ"],
["a8b1","㉠",27,"ⓐ",25,"①",14,"½⅓⅔¼¾⅛⅜⅝⅞"],
["a941","쯅",14,"쯕",10],
["a961","쯠쯡쯢쯣쯥쯦쯨쯪",18],
["a981","쯽",14,"찎찏찑찒찓찕",6,"찞찟찠찣찤æđðħıĳĸŀłøœßþŧŋŉ㈀",27,"⒜",25,"⑴",14,"¹²³⁴ⁿ₁₂₃₄"],
["aa41","찥찦찪찫찭찯찱",6,"찺찿",4,"챆챇챉챊챋챍챎"],
["aa61","챏",4,"챖챚",5,"챡챢챣챥챧챩",6,"챱챲"],
["aa81","챳챴챶",29,"ぁ",82],
["ab41","첔첕첖첗첚첛첝첞첟첡",6,"첪첮",5,"첶첷첹"],
["ab61","첺첻첽",6,"쳆쳈쳊",5,"쳑쳒쳓쳕",5],
["ab81","쳛",8,"쳥",6,"쳭쳮쳯쳱",12,"ァ",85],
["ac41","쳾쳿촀촂",5,"촊촋촍촎촏촑",6,"촚촜촞촟촠"],
["ac61","촡촢촣촥촦촧촩촪촫촭",11,"촺",4],
["ac81","촿",28,"쵝쵞쵟А",5,"ЁЖ",25],
["acd1","а",5,"ёж",25],
["ad41","쵡쵢쵣쵥",6,"쵮쵰쵲",5,"쵹",7],
["ad61","춁",6,"춉",10,"춖춗춙춚춛춝춞춟"],
["ad81","춠춡춢춣춦춨춪",5,"춱",18,"췅"],
["ae41","췆",5,"췍췎췏췑",16],
["ae61","췢",5,"췩췪췫췭췮췯췱",6,"췺췼췾",4],
["ae81","츃츅츆츇츉츊츋츍",6,"츕츖츗츘츚",5,"츢츣츥츦츧츩츪츫"],
["af41","츬츭츮츯츲츴츶",19],
["af61","칊",13,"칚칛칝칞칢",5,"칪칬"],
["af81","칮",5,"칶칷칹칺칻칽",6,"캆캈캊",5,"캒캓캕캖캗캙"],
["b041","캚",5,"캢캦",5,"캮",12],
["b061","캻",5,"컂",19],
["b081","컖",13,"컦컧컩컪컭",6,"컶컺",5,"가각간갇갈갉갊감",7,"같",4,"갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆"],
["b141","켂켃켅켆켇켉",6,"켒켔켖",5,"켝켞켟켡켢켣"],
["b161","켥",6,"켮켲",5,"켹",11],
["b181","콅",14,"콖콗콙콚콛콝",6,"콦콨콪콫콬괌괍괏광괘괜괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸"],
["b241","콭콮콯콲콳콵콶콷콹",6,"쾁쾂쾃쾄쾆",5,"쾍"],
["b261","쾎",18,"쾢",5,"쾩"],
["b281","쾪",5,"쾱",18,"쿅",6,"깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙"],
["b341","쿌",19,"쿢쿣쿥쿦쿧쿩"],
["b361","쿪",5,"쿲쿴쿶",5,"쿽쿾쿿퀁퀂퀃퀅",5],
["b381","퀋",5,"퀒",5,"퀙",19,"끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남납낫",4,"낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝"],
["b441","퀮",5,"퀶퀷퀹퀺퀻퀽",6,"큆큈큊",5],
["b461","큑큒큓큕큖큗큙",6,"큡",10,"큮큯"],
["b481","큱큲큳큵",6,"큾큿킀킂",18,"뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫",4,"닳담답닷",4,"닿대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥"],
["b541","킕",14,"킦킧킩킪킫킭",5],
["b561","킳킶킸킺",5,"탂탃탅탆탇탊",5,"탒탖",4],
["b581","탛탞탟탡탢탣탥",6,"탮탲",5,"탹",11,"덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디딕딘딛딜딤딥딧딨딩딪따딱딴딸"],
["b641","턅",7,"턎",17],
["b661","턠",15,"턲턳턵턶턷턹턻턼턽턾"],
["b681","턿텂텆",5,"텎텏텑텒텓텕",6,"텞텠텢",5,"텩텪텫텭땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄람랍랏랐랑랒랖랗"],
["b741","텮",13,"텽",6,"톅톆톇톉톊"],
["b761","톋",20,"톢톣톥톦톧"],
["b781","톩",6,"톲톴톶톷톸톹톻톽톾톿퇁",14,"래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률륨륩"],
["b841","퇐",7,"퇙",17],
["b861","퇫",8,"퇵퇶퇷퇹",13],
["b881","툈툊",5,"툑",24,"륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많",4,"맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼"],
["b941","툪툫툮툯툱툲툳툵",6,"툾퉀퉂",5,"퉉퉊퉋퉌"],
["b961","퉍",14,"퉝",6,"퉥퉦퉧퉨"],
["b981","퉩",22,"튂튃튅튆튇튉튊튋튌묀묄묍묏묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍및밑바",4,"받",4,"밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗"],
["ba41","튍튎튏튒튓튔튖",5,"튝튞튟튡튢튣튥",6,"튭"],
["ba61","튮튯튰튲",5,"튺튻튽튾틁틃",4,"틊틌",5],
["ba81","틒틓틕틖틗틙틚틛틝",6,"틦",9,"틲틳틵틶틷틹틺벙벚베벡벤벧벨벰벱벳벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤"],
["bb41","틻",4,"팂팄팆",5,"팏팑팒팓팕팗",4,"팞팢팣"],
["bb61","팤팦팧팪팫팭팮팯팱",6,"팺팾",5,"퍆퍇퍈퍉"],
["bb81","퍊",31,"빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤"],
["bc41","퍪",17,"퍾퍿펁펂펃펅펆펇"],
["bc61","펈펉펊펋펎펒",5,"펚펛펝펞펟펡",6,"펪펬펮"],
["bc81","펯",4,"펵펶펷펹펺펻펽",6,"폆폇폊",5,"폑",5,"샥샨샬샴샵샷샹섀섄섈섐섕서",4,"섣설섦섧섬섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭"],
["bd41","폗폙",7,"폢폤",7,"폮폯폱폲폳폵폶폷"],
["bd61","폸폹폺폻폾퐀퐂",5,"퐉",13],
["bd81","퐗",5,"퐞",25,"숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰"],
["be41","퐸",7,"푁푂푃푅",14],
["be61","푔",7,"푝푞푟푡푢푣푥",7,"푮푰푱푲"],
["be81","푳",4,"푺푻푽푾풁풃",4,"풊풌풎",5,"풕",8,"쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽얾엄",6,"엌엎"],
["bf41","풞",10,"풪",14],
["bf61","풹",18,"퓍퓎퓏퓑퓒퓓퓕"],
["bf81","퓖",5,"퓝퓞퓠",7,"퓩퓪퓫퓭퓮퓯퓱",6,"퓹퓺퓼에엑엔엘엠엡엣엥여역엮연열엶엷염",5,"옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜웝웠웡웨"],
["c041","퓾",5,"픅픆픇픉픊픋픍",6,"픖픘",5],
["c061","픞",25],
["c081","픸픹픺픻픾픿핁핂핃핅",6,"핎핐핒",5,"핚핛핝핞핟핡핢핣웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응",7,"읜읠읨읫이익인일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊"],
["c141","핤핦핧핪핬핮",5,"핶핷핹핺핻핽",6,"햆햊햋"],
["c161","햌햍햎햏햑",19,"햦햧"],
["c181","햨",31,"점접젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓"],
["c241","헊헋헍헎헏헑헓",4,"헚헜헞",5,"헦헧헩헪헫헭헮"],
["c261","헯",4,"헶헸헺",5,"혂혃혅혆혇혉",6,"혒"],
["c281","혖",5,"혝혞혟혡혢혣혥",7,"혮",9,"혺혻징짖짙짚짜짝짠짢짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻"],
["c341","혽혾혿홁홂홃홄홆홇홊홌홎홏홐홒홓홖홗홙홚홛홝",4],
["c361","홢",4,"홨홪",5,"홲홳홵",11],
["c381","횁횂횄횆",5,"횎횏횑횒횓횕",7,"횞횠횢",5,"횩횪찼창찾채책챈챌챔챕챗챘챙챠챤챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층"],
["c441","횫횭횮횯횱",7,"횺횼",7,"훆훇훉훊훋"],
["c461","훍훎훏훐훒훓훕훖훘훚",5,"훡훢훣훥훦훧훩",4],
["c481","훮훯훱훲훳훴훶",5,"훾훿휁휂휃휅",11,"휒휓휔치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼"],
["c541","휕휖휗휚휛휝휞휟휡",6,"휪휬휮",5,"휶휷휹"],
["c561","휺휻휽",6,"흅흆흈흊",5,"흒흓흕흚",4],
["c581","흟흢흤흦흧흨흪흫흭흮흯흱흲흳흵",6,"흾흿힀힂",5,"힊힋큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜"],
["c641","힍힎힏힑",6,"힚힜힞",5],
["c6a1","퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평폐폘폡폣포폭폰폴폼폽폿퐁"],
["c7a1","퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐협혓혔형혜혠"],
["c8a1","혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝"],
["caa1","伽佳假價加可呵哥嘉嫁家暇架枷柯歌珂痂稼苛茄街袈訶賈跏軻迦駕刻却各恪慤殼珏脚覺角閣侃刊墾奸姦干幹懇揀杆柬桿澗癎看磵稈竿簡肝艮艱諫間乫喝曷渴碣竭葛褐蝎鞨勘坎堪嵌感憾戡敢柑橄減甘疳監瞰紺邯鑑鑒龕"],
["cba1","匣岬甲胛鉀閘剛堈姜岡崗康强彊慷江畺疆糠絳綱羌腔舡薑襁講鋼降鱇介价個凱塏愷愾慨改槪漑疥皆盖箇芥蓋豈鎧開喀客坑更粳羹醵倨去居巨拒据據擧渠炬祛距踞車遽鉅鋸乾件健巾建愆楗腱虔蹇鍵騫乞傑杰桀儉劍劒檢"],
["cca1","瞼鈐黔劫怯迲偈憩揭擊格檄激膈覡隔堅牽犬甄絹繭肩見譴遣鵑抉決潔結缺訣兼慊箝謙鉗鎌京俓倞傾儆勁勍卿坰境庚徑慶憬擎敬景暻更梗涇炅烱璟璥瓊痙硬磬竟競絅經耕耿脛莖警輕逕鏡頃頸驚鯨係啓堺契季屆悸戒桂械"],
["cda1","棨溪界癸磎稽系繫繼計誡谿階鷄古叩告呱固姑孤尻庫拷攷故敲暠枯槁沽痼皐睾稿羔考股膏苦苽菰藁蠱袴誥賈辜錮雇顧高鼓哭斛曲梏穀谷鵠困坤崑昆梱棍滾琨袞鯤汨滑骨供公共功孔工恐恭拱控攻珙空蚣貢鞏串寡戈果瓜"],
["cea1","科菓誇課跨過鍋顆廓槨藿郭串冠官寬慣棺款灌琯瓘管罐菅觀貫關館刮恝括适侊光匡壙廣曠洸炚狂珖筐胱鑛卦掛罫乖傀塊壞怪愧拐槐魁宏紘肱轟交僑咬喬嬌嶠巧攪敎校橋狡皎矯絞翹膠蕎蛟較轎郊餃驕鮫丘久九仇俱具勾"],
["cfa1","區口句咎嘔坵垢寇嶇廐懼拘救枸柩構歐毆毬求溝灸狗玖球瞿矩究絿耉臼舅舊苟衢謳購軀逑邱鉤銶駒驅鳩鷗龜國局菊鞠鞫麴君窘群裙軍郡堀屈掘窟宮弓穹窮芎躬倦券勸卷圈拳捲權淃眷厥獗蕨蹶闕机櫃潰詭軌饋句晷歸貴"],
["d0a1","鬼龜叫圭奎揆槻珪硅窺竅糾葵規赳逵閨勻均畇筠菌鈞龜橘克剋劇戟棘極隙僅劤勤懃斤根槿瑾筋芹菫覲謹近饉契今妗擒昑檎琴禁禽芩衾衿襟金錦伋及急扱汲級給亘兢矜肯企伎其冀嗜器圻基埼夔奇妓寄岐崎己幾忌技旗旣"],
["d1a1","朞期杞棋棄機欺氣汽沂淇玘琦琪璂璣畸畿碁磯祁祇祈祺箕紀綺羈耆耭肌記譏豈起錡錤飢饑騎騏驥麒緊佶吉拮桔金喫儺喇奈娜懦懶拏拿癩",5,"那樂",4,"諾酪駱亂卵暖欄煖爛蘭難鸞捏捺南嵐枏楠湳濫男藍襤拉"],
["d2a1","納臘蠟衲囊娘廊",4,"乃來內奈柰耐冷女年撚秊念恬拈捻寧寗努勞奴弩怒擄櫓爐瑙盧",5,"駑魯",10,"濃籠聾膿農惱牢磊腦賂雷尿壘",7,"嫩訥杻紐勒",5,"能菱陵尼泥匿溺多茶"],
["d3a1","丹亶但單團壇彖斷旦檀段湍短端簞緞蛋袒鄲鍛撻澾獺疸達啖坍憺擔曇淡湛潭澹痰聃膽蕁覃談譚錟沓畓答踏遝唐堂塘幢戇撞棠當糖螳黨代垈坮大對岱帶待戴擡玳臺袋貸隊黛宅德悳倒刀到圖堵塗導屠島嶋度徒悼挑掉搗桃"],
["d4a1","棹櫂淘渡滔濤燾盜睹禱稻萄覩賭跳蹈逃途道都鍍陶韜毒瀆牘犢獨督禿篤纛讀墩惇敦旽暾沌焞燉豚頓乭突仝冬凍動同憧東桐棟洞潼疼瞳童胴董銅兜斗杜枓痘竇荳讀豆逗頭屯臀芚遁遯鈍得嶝橙燈登等藤謄鄧騰喇懶拏癩羅"],
["d5a1","蘿螺裸邏樂洛烙珞絡落諾酪駱丹亂卵欄欒瀾爛蘭鸞剌辣嵐擥攬欖濫籃纜藍襤覽拉臘蠟廊朗浪狼琅瑯螂郞來崍徠萊冷掠略亮倆兩凉梁樑粮粱糧良諒輛量侶儷勵呂廬慮戾旅櫚濾礪藜蠣閭驢驪麗黎力曆歷瀝礫轢靂憐戀攣漣"],
["d6a1","煉璉練聯蓮輦連鍊冽列劣洌烈裂廉斂殮濂簾獵令伶囹寧岺嶺怜玲笭羚翎聆逞鈴零靈領齡例澧禮醴隷勞怒撈擄櫓潞瀘爐盧老蘆虜路輅露魯鷺鹵碌祿綠菉錄鹿麓論壟弄朧瀧瓏籠聾儡瀨牢磊賂賚賴雷了僚寮廖料燎療瞭聊蓼"],
["d7a1","遼鬧龍壘婁屢樓淚漏瘻累縷蔞褸鏤陋劉旒柳榴流溜瀏琉瑠留瘤硫謬類六戮陸侖倫崙淪綸輪律慄栗率隆勒肋凜凌楞稜綾菱陵俚利厘吏唎履悧李梨浬犁狸理璃異痢籬罹羸莉裏裡里釐離鯉吝潾燐璘藺躪隣鱗麟林淋琳臨霖砬"],
["d8a1","立笠粒摩瑪痲碼磨馬魔麻寞幕漠膜莫邈万卍娩巒彎慢挽晩曼滿漫灣瞞萬蔓蠻輓饅鰻唜抹末沫茉襪靺亡妄忘忙望網罔芒茫莽輞邙埋妹媒寐昧枚梅每煤罵買賣邁魅脈貊陌驀麥孟氓猛盲盟萌冪覓免冕勉棉沔眄眠綿緬面麵滅"],
["d9a1","蔑冥名命明暝椧溟皿瞑茗蓂螟酩銘鳴袂侮冒募姆帽慕摸摹暮某模母毛牟牡瑁眸矛耗芼茅謀謨貌木沐牧目睦穆鶩歿沒夢朦蒙卯墓妙廟描昴杳渺猫竗苗錨務巫憮懋戊拇撫无楙武毋無珷畝繆舞茂蕪誣貿霧鵡墨默們刎吻問文"],
["daa1","汶紊紋聞蚊門雯勿沕物味媚尾嵋彌微未梶楣渼湄眉米美薇謎迷靡黴岷悶愍憫敏旻旼民泯玟珉緡閔密蜜謐剝博拍搏撲朴樸泊珀璞箔粕縛膊舶薄迫雹駁伴半反叛拌搬攀斑槃泮潘班畔瘢盤盼磐磻礬絆般蟠返頒飯勃拔撥渤潑"],
["dba1","發跋醱鉢髮魃倣傍坊妨尨幇彷房放方旁昉枋榜滂磅紡肪膀舫芳蒡蚌訪謗邦防龐倍俳北培徘拜排杯湃焙盃背胚裴裵褙賠輩配陪伯佰帛柏栢白百魄幡樊煩燔番磻繁蕃藩飜伐筏罰閥凡帆梵氾汎泛犯範范法琺僻劈壁擘檗璧癖"],
["dca1","碧蘗闢霹便卞弁變辨辯邊別瞥鱉鼈丙倂兵屛幷昞昺柄棅炳甁病秉竝輧餠騈保堡報寶普步洑湺潽珤甫菩補褓譜輔伏僕匐卜宓復服福腹茯蔔複覆輹輻馥鰒本乶俸奉封峯峰捧棒烽熢琫縫蓬蜂逢鋒鳳不付俯傅剖副否咐埠夫婦"],
["dda1","孚孵富府復扶敷斧浮溥父符簿缶腐腑膚艀芙莩訃負賦賻赴趺部釜阜附駙鳧北分吩噴墳奔奮忿憤扮昐汾焚盆粉糞紛芬賁雰不佛弗彿拂崩朋棚硼繃鵬丕備匕匪卑妃婢庇悲憊扉批斐枇榧比毖毗毘沸泌琵痺砒碑秕秘粃緋翡肥"],
["dea1","脾臂菲蜚裨誹譬費鄙非飛鼻嚬嬪彬斌檳殯浜濱瀕牝玭貧賓頻憑氷聘騁乍事些仕伺似使俟僿史司唆嗣四士奢娑寫寺射巳師徙思捨斜斯柶査梭死沙泗渣瀉獅砂社祀祠私篩紗絲肆舍莎蓑蛇裟詐詞謝賜赦辭邪飼駟麝削數朔索"],
["dfa1","傘刪山散汕珊産疝算蒜酸霰乷撒殺煞薩三參杉森渗芟蔘衫揷澁鈒颯上傷像償商喪嘗孀尙峠常床庠廂想桑橡湘爽牀狀相祥箱翔裳觴詳象賞霜塞璽賽嗇塞穡索色牲生甥省笙墅壻嶼序庶徐恕抒捿敍暑曙書栖棲犀瑞筮絮緖署"],
["e0a1","胥舒薯西誓逝鋤黍鼠夕奭席惜昔晳析汐淅潟石碩蓆釋錫仙僊先善嬋宣扇敾旋渲煽琁瑄璇璿癬禪線繕羨腺膳船蘚蟬詵跣選銑鐥饍鮮卨屑楔泄洩渫舌薛褻設說雪齧剡暹殲纖蟾贍閃陝攝涉燮葉城姓宬性惺成星晟猩珹盛省筬"],
["e1a1","聖聲腥誠醒世勢歲洗稅笹細說貰召嘯塑宵小少巢所掃搔昭梳沼消溯瀟炤燒甦疏疎瘙笑篠簫素紹蔬蕭蘇訴逍遡邵銷韶騷俗屬束涑粟續謖贖速孫巽損蓀遜飡率宋悚松淞訟誦送頌刷殺灑碎鎖衰釗修受嗽囚垂壽嫂守岫峀帥愁"],
["e2a1","戍手授搜收數樹殊水洙漱燧狩獸琇璲瘦睡秀穗竪粹綏綬繡羞脩茱蒐蓚藪袖誰讐輸遂邃酬銖銹隋隧隨雖需須首髓鬚叔塾夙孰宿淑潚熟琡璹肅菽巡徇循恂旬栒楯橓殉洵淳珣盾瞬筍純脣舜荀蓴蕣詢諄醇錞順馴戌術述鉥崇崧"],
["e3a1","嵩瑟膝蝨濕拾習褶襲丞乘僧勝升承昇繩蠅陞侍匙嘶始媤尸屎屍市弑恃施是時枾柴猜矢示翅蒔蓍視試詩諡豕豺埴寔式息拭植殖湜熄篒蝕識軾食飾伸侁信呻娠宸愼新晨燼申神紳腎臣莘薪藎蜃訊身辛辰迅失室實悉審尋心沁"],
["e4a1","沈深瀋甚芯諶什十拾雙氏亞俄兒啞娥峨我牙芽莪蛾衙訝阿雅餓鴉鵝堊岳嶽幄惡愕握樂渥鄂鍔顎鰐齷安岸按晏案眼雁鞍顔鮟斡謁軋閼唵岩巖庵暗癌菴闇壓押狎鴨仰央怏昻殃秧鴦厓哀埃崖愛曖涯碍艾隘靄厄扼掖液縊腋額"],
["e5a1","櫻罌鶯鸚也倻冶夜惹揶椰爺耶若野弱掠略約若葯蒻藥躍亮佯兩凉壤孃恙揚攘敭暘梁楊樣洋瀁煬痒瘍禳穰糧羊良襄諒讓釀陽量養圄御於漁瘀禦語馭魚齬億憶抑檍臆偃堰彦焉言諺孼蘖俺儼嚴奄掩淹嶪業円予余勵呂女如廬"],
["e6a1","旅歟汝濾璵礖礪與艅茹輿轝閭餘驪麗黎亦力域役易曆歷疫繹譯轢逆驛嚥堧姸娟宴年延憐戀捐挻撚椽沇沿涎涓淵演漣烟然煙煉燃燕璉硏硯秊筵緣練縯聯衍軟輦蓮連鉛鍊鳶列劣咽悅涅烈熱裂說閱厭廉念捻染殮炎焰琰艶苒"],
["e7a1","簾閻髥鹽曄獵燁葉令囹塋寧嶺嶸影怜映暎楹榮永泳渶潁濚瀛瀯煐營獰玲瑛瑩瓔盈穎纓羚聆英詠迎鈴鍈零霙靈領乂倪例刈叡曳汭濊猊睿穢芮藝蘂禮裔詣譽豫醴銳隸霓預五伍俉傲午吾吳嗚塢墺奧娛寤悟惡懊敖旿晤梧汚澳"],
["e8a1","烏熬獒筽蜈誤鰲鼇屋沃獄玉鈺溫瑥瘟穩縕蘊兀壅擁瓮甕癰翁邕雍饔渦瓦窩窪臥蛙蝸訛婉完宛梡椀浣玩琓琬碗緩翫脘腕莞豌阮頑曰往旺枉汪王倭娃歪矮外嵬巍猥畏了僚僥凹堯夭妖姚寥寮尿嶢拗搖撓擾料曜樂橈燎燿瑤療"],
["e9a1","窈窯繇繞耀腰蓼蟯要謠遙遼邀饒慾欲浴縟褥辱俑傭冗勇埇墉容庸慂榕涌湧溶熔瑢用甬聳茸蓉踊鎔鏞龍于佑偶優又友右宇寓尤愚憂旴牛玗瑀盂祐禑禹紆羽芋藕虞迂遇郵釪隅雨雩勖彧旭昱栯煜稶郁頊云暈橒殞澐熉耘芸蕓"],
["eaa1","運隕雲韻蔚鬱亐熊雄元原員圓園垣媛嫄寃怨愿援沅洹湲源爰猿瑗苑袁轅遠阮院願鴛月越鉞位偉僞危圍委威尉慰暐渭爲瑋緯胃萎葦蔿蝟衛褘謂違韋魏乳侑儒兪劉唯喩孺宥幼幽庾悠惟愈愉揄攸有杻柔柚柳楡楢油洧流游溜"],
["eba1","濡猶猷琉瑜由留癒硫紐維臾萸裕誘諛諭踰蹂遊逾遺酉釉鍮類六堉戮毓肉育陸倫允奫尹崙淪潤玧胤贇輪鈗閏律慄栗率聿戎瀜絨融隆垠恩慇殷誾銀隱乙吟淫蔭陰音飮揖泣邑凝應膺鷹依倚儀宜意懿擬椅毅疑矣義艤薏蟻衣誼"],
["eca1","議醫二以伊利吏夷姨履已弛彛怡易李梨泥爾珥理異痍痢移罹而耳肄苡荑裏裡貽貳邇里離飴餌匿溺瀷益翊翌翼謚人仁刃印吝咽因姻寅引忍湮燐璘絪茵藺蚓認隣靭靷鱗麟一佚佾壹日溢逸鎰馹任壬妊姙恁林淋稔臨荏賃入卄"],
["eda1","立笠粒仍剩孕芿仔刺咨姉姿子字孜恣慈滋炙煮玆瓷疵磁紫者自茨蔗藉諮資雌作勺嚼斫昨灼炸爵綽芍酌雀鵲孱棧殘潺盞岑暫潛箴簪蠶雜丈仗匠場墻壯奬將帳庄張掌暲杖樟檣欌漿牆狀獐璋章粧腸臟臧莊葬蔣薔藏裝贓醬長"],
["eea1","障再哉在宰才材栽梓渽滓災縡裁財載齋齎爭箏諍錚佇低儲咀姐底抵杵楮樗沮渚狙猪疽箸紵苧菹著藷詛貯躇這邸雎齟勣吊嫡寂摘敵滴狄炙的積笛籍績翟荻謫賊赤跡蹟迪迹適鏑佃佺傳全典前剪塡塼奠專展廛悛戰栓殿氈澱"],
["efa1","煎琠田甸畑癲筌箋箭篆纏詮輾轉鈿銓錢鐫電顚顫餞切截折浙癤竊節絶占岾店漸点粘霑鮎點接摺蝶丁井亭停偵呈姃定幀庭廷征情挺政整旌晶晸柾楨檉正汀淀淨渟湞瀞炡玎珽町睛碇禎程穽精綎艇訂諪貞鄭酊釘鉦鋌錠霆靖"],
["f0a1","靜頂鼎制劑啼堤帝弟悌提梯濟祭第臍薺製諸蹄醍除際霽題齊俎兆凋助嘲弔彫措操早晁曺曹朝條棗槽漕潮照燥爪璪眺祖祚租稠窕粗糟組繰肇藻蚤詔調趙躁造遭釣阻雕鳥族簇足鏃存尊卒拙猝倧宗從悰慫棕淙琮種終綜縱腫"],
["f1a1","踪踵鍾鐘佐坐左座挫罪主住侏做姝胄呪周嗾奏宙州廚晝朱柱株注洲湊澍炷珠疇籌紂紬綢舟蛛註誅走躊輳週酎酒鑄駐竹粥俊儁准埈寯峻晙樽浚準濬焌畯竣蠢逡遵雋駿茁中仲衆重卽櫛楫汁葺增憎曾拯烝甑症繒蒸證贈之只"],
["f2a1","咫地址志持指摯支旨智枝枳止池沚漬知砥祉祗紙肢脂至芝芷蜘誌識贄趾遲直稙稷織職唇嗔塵振搢晉晋桭榛殄津溱珍瑨璡畛疹盡眞瞋秦縉縝臻蔯袗診賑軫辰進鎭陣陳震侄叱姪嫉帙桎瓆疾秩窒膣蛭質跌迭斟朕什執潗緝輯"],
["f3a1","鏶集徵懲澄且侘借叉嗟嵯差次此磋箚茶蹉車遮捉搾着窄錯鑿齪撰澯燦璨瓚竄簒纂粲纘讚贊鑽餐饌刹察擦札紮僭參塹慘慙懺斬站讒讖倉倡創唱娼廠彰愴敞昌昶暢槍滄漲猖瘡窓脹艙菖蒼債埰寀寨彩採砦綵菜蔡采釵冊柵策"],
["f4a1","責凄妻悽處倜刺剔尺慽戚拓擲斥滌瘠脊蹠陟隻仟千喘天川擅泉淺玔穿舛薦賤踐遷釧闡阡韆凸哲喆徹撤澈綴輟轍鐵僉尖沾添甛瞻簽籤詹諂堞妾帖捷牒疊睫諜貼輒廳晴淸聽菁請靑鯖切剃替涕滯締諦逮遞體初剿哨憔抄招梢"],
["f5a1","椒楚樵炒焦硝礁礎秒稍肖艸苕草蕉貂超酢醋醮促囑燭矗蜀觸寸忖村邨叢塚寵悤憁摠總聰蔥銃撮催崔最墜抽推椎楸樞湫皺秋芻萩諏趨追鄒酋醜錐錘鎚雛騶鰍丑畜祝竺筑築縮蓄蹙蹴軸逐春椿瑃出朮黜充忠沖蟲衝衷悴膵萃"],
["f6a1","贅取吹嘴娶就炊翠聚脆臭趣醉驟鷲側仄厠惻測層侈値嗤峙幟恥梔治淄熾痔痴癡稚穉緇緻置致蚩輜雉馳齒則勅飭親七柒漆侵寢枕沈浸琛砧針鍼蟄秤稱快他咤唾墮妥惰打拖朶楕舵陀馱駝倬卓啄坼度托拓擢晫柝濁濯琢琸託"],
["f7a1","鐸呑嘆坦彈憚歎灘炭綻誕奪脫探眈耽貪塔搭榻宕帑湯糖蕩兌台太怠態殆汰泰笞胎苔跆邰颱宅擇澤撑攄兎吐土討慟桶洞痛筒統通堆槌腿褪退頹偸套妬投透鬪慝特闖坡婆巴把播擺杷波派爬琶破罷芭跛頗判坂板版瓣販辦鈑"],
["f8a1","阪八叭捌佩唄悖敗沛浿牌狽稗覇貝彭澎烹膨愎便偏扁片篇編翩遍鞭騙貶坪平枰萍評吠嬖幣廢弊斃肺蔽閉陛佈包匍匏咆哺圃布怖抛抱捕暴泡浦疱砲胞脯苞葡蒲袍褒逋鋪飽鮑幅暴曝瀑爆輻俵剽彪慓杓標漂瓢票表豹飇飄驃"],
["f9a1","品稟楓諷豊風馮彼披疲皮被避陂匹弼必泌珌畢疋筆苾馝乏逼下何厦夏廈昰河瑕荷蝦賀遐霞鰕壑學虐謔鶴寒恨悍旱汗漢澣瀚罕翰閑閒限韓割轄函含咸啣喊檻涵緘艦銜陷鹹合哈盒蛤閤闔陜亢伉姮嫦巷恒抗杭桁沆港缸肛航"],
["faa1","行降項亥偕咳垓奚孩害懈楷海瀣蟹解該諧邂駭骸劾核倖幸杏荇行享向嚮珦鄕響餉饗香噓墟虛許憲櫶獻軒歇險驗奕爀赫革俔峴弦懸晛泫炫玄玹現眩睍絃絢縣舷衒見賢鉉顯孑穴血頁嫌俠協夾峽挾浹狹脅脇莢鋏頰亨兄刑型"],
["fba1","形泂滎瀅灐炯熒珩瑩荊螢衡逈邢鎣馨兮彗惠慧暳蕙蹊醯鞋乎互呼壕壺好岵弧戶扈昊晧毫浩淏湖滸澔濠濩灝狐琥瑚瓠皓祜糊縞胡芦葫蒿虎號蝴護豪鎬頀顥惑或酷婚昏混渾琿魂忽惚笏哄弘汞泓洪烘紅虹訌鴻化和嬅樺火畵"],
["fca1","禍禾花華話譁貨靴廓擴攫確碻穫丸喚奐宦幻患換歡晥桓渙煥環紈還驩鰥活滑猾豁闊凰幌徨恍惶愰慌晃晄榥況湟滉潢煌璜皇篁簧荒蝗遑隍黃匯回廻徊恢悔懷晦會檜淮澮灰獪繪膾茴蛔誨賄劃獲宖橫鐄哮嚆孝效斅曉梟涍淆"],
["fda1","爻肴酵驍侯候厚后吼喉嗅帿後朽煦珝逅勛勳塤壎焄熏燻薰訓暈薨喧暄煊萱卉喙毁彙徽揮暉煇諱輝麾休携烋畦虧恤譎鷸兇凶匈洶胸黑昕欣炘痕吃屹紇訖欠欽歆吸恰洽翕興僖凞喜噫囍姬嬉希憙憘戱晞曦熙熹熺犧禧稀羲詰"]
]

},{}],24:[function(require,module,exports){
module.exports=[
["0","\u0000",127],
["a140","　，、。．‧；：？！︰…‥﹐﹑﹒·﹔﹕﹖﹗｜–︱—︳╴︴﹏（）︵︶｛｝︷︸〔〕︹︺【】︻︼《》︽︾〈〉︿﹀「」﹁﹂『』﹃﹄﹙﹚"],
["a1a1","﹛﹜﹝﹞‘’“”〝〞‵′＃＆＊※§〃○●△▲◎☆★◇◆□■▽▼㊣℅¯￣＿ˍ﹉﹊﹍﹎﹋﹌﹟﹠﹡＋－×÷±√＜＞＝≦≧≠∞≒≡﹢",4,"～∩∪⊥∠∟⊿㏒㏑∫∮∵∴♀♂⊕⊙↑↓←→↖↗↙↘∥∣／"],
["a240","＼∕﹨＄￥〒￠￡％＠℃℉﹩﹪﹫㏕㎜㎝㎞㏎㎡㎎㎏㏄°兙兛兞兝兡兣嗧瓩糎▁",7,"▏▎▍▌▋▊▉┼┴┬┤├▔─│▕┌┐└┘╭"],
["a2a1","╮╰╯═╞╪╡◢◣◥◤╱╲╳０",9,"Ⅰ",9,"〡",8,"十卄卅Ａ",25,"ａ",21],
["a340","ｗｘｙｚΑ",16,"Σ",6,"α",16,"σ",6,"ㄅ",10],
["a3a1","ㄐ",25,"˙ˉˊˇˋ"],
["a3e1","€"],
["a440","一乙丁七乃九了二人儿入八几刀刁力匕十卜又三下丈上丫丸凡久么也乞于亡兀刃勺千叉口土士夕大女子孑孓寸小尢尸山川工己已巳巾干廾弋弓才"],
["a4a1","丑丐不中丰丹之尹予云井互五亢仁什仃仆仇仍今介仄元允內六兮公冗凶分切刈勻勾勿化匹午升卅卞厄友及反壬天夫太夭孔少尤尺屯巴幻廿弔引心戈戶手扎支文斗斤方日曰月木欠止歹毋比毛氏水火爪父爻片牙牛犬王丙"],
["a540","世丕且丘主乍乏乎以付仔仕他仗代令仙仞充兄冉冊冬凹出凸刊加功包匆北匝仟半卉卡占卯卮去可古右召叮叩叨叼司叵叫另只史叱台句叭叻四囚外"],
["a5a1","央失奴奶孕它尼巨巧左市布平幼弁弘弗必戊打扔扒扑斥旦朮本未末札正母民氐永汁汀氾犯玄玉瓜瓦甘生用甩田由甲申疋白皮皿目矛矢石示禾穴立丞丟乒乓乩亙交亦亥仿伉伙伊伕伍伐休伏仲件任仰仳份企伋光兇兆先全"],
["a640","共再冰列刑划刎刖劣匈匡匠印危吉吏同吊吐吁吋各向名合吃后吆吒因回囝圳地在圭圬圯圩夙多夷夸妄奸妃好她如妁字存宇守宅安寺尖屹州帆并年"],
["a6a1","式弛忙忖戎戌戍成扣扛托收早旨旬旭曲曳有朽朴朱朵次此死氖汝汗汙江池汐汕污汛汍汎灰牟牝百竹米糸缶羊羽老考而耒耳聿肉肋肌臣自至臼舌舛舟艮色艾虫血行衣西阡串亨位住佇佗佞伴佛何估佐佑伽伺伸佃佔似但佣"],
["a740","作你伯低伶余佝佈佚兌克免兵冶冷別判利刪刨劫助努劬匣即卵吝吭吞吾否呎吧呆呃吳呈呂君吩告吹吻吸吮吵吶吠吼呀吱含吟听囪困囤囫坊坑址坍"],
["a7a1","均坎圾坐坏圻壯夾妝妒妨妞妣妙妖妍妤妓妊妥孝孜孚孛完宋宏尬局屁尿尾岐岑岔岌巫希序庇床廷弄弟彤形彷役忘忌志忍忱快忸忪戒我抄抗抖技扶抉扭把扼找批扳抒扯折扮投抓抑抆改攻攸旱更束李杏材村杜杖杞杉杆杠"],
["a840","杓杗步每求汞沙沁沈沉沅沛汪決沐汰沌汨沖沒汽沃汲汾汴沆汶沍沔沘沂灶灼災灸牢牡牠狄狂玖甬甫男甸皂盯矣私秀禿究系罕肖肓肝肘肛肚育良芒"],
["a8a1","芋芍見角言谷豆豕貝赤走足身車辛辰迂迆迅迄巡邑邢邪邦那酉釆里防阮阱阪阬並乖乳事些亞享京佯依侍佳使佬供例來侃佰併侈佩佻侖佾侏侑佺兔兒兕兩具其典冽函刻券刷刺到刮制剁劾劻卒協卓卑卦卷卸卹取叔受味呵"],
["a940","咖呸咕咀呻呷咄咒咆呼咐呱呶和咚呢周咋命咎固垃坷坪坩坡坦坤坼夜奉奇奈奄奔妾妻委妹妮姑姆姐姍始姓姊妯妳姒姅孟孤季宗定官宜宙宛尚屈居"],
["a9a1","屆岷岡岸岩岫岱岳帘帚帖帕帛帑幸庚店府底庖延弦弧弩往征彿彼忝忠忽念忿怏怔怯怵怖怪怕怡性怩怫怛或戕房戾所承拉拌拄抿拂抹拒招披拓拔拋拈抨抽押拐拙拇拍抵拚抱拘拖拗拆抬拎放斧於旺昔易昌昆昂明昀昏昕昊"],
["aa40","昇服朋杭枋枕東果杳杷枇枝林杯杰板枉松析杵枚枓杼杪杲欣武歧歿氓氛泣注泳沱泌泥河沽沾沼波沫法泓沸泄油況沮泗泅泱沿治泡泛泊沬泯泜泖泠"],
["aaa1","炕炎炒炊炙爬爭爸版牧物狀狎狙狗狐玩玨玟玫玥甽疝疙疚的盂盲直知矽社祀祁秉秈空穹竺糾罔羌羋者肺肥肢肱股肫肩肴肪肯臥臾舍芳芝芙芭芽芟芹花芬芥芯芸芣芰芾芷虎虱初表軋迎返近邵邸邱邶采金長門阜陀阿阻附"],
["ab40","陂隹雨青非亟亭亮信侵侯便俠俑俏保促侶俘俟俊俗侮俐俄係俚俎俞侷兗冒冑冠剎剃削前剌剋則勇勉勃勁匍南卻厚叛咬哀咨哎哉咸咦咳哇哂咽咪品"],
["aba1","哄哈咯咫咱咻咩咧咿囿垂型垠垣垢城垮垓奕契奏奎奐姜姘姿姣姨娃姥姪姚姦威姻孩宣宦室客宥封屎屏屍屋峙峒巷帝帥帟幽庠度建弈弭彥很待徊律徇後徉怒思怠急怎怨恍恰恨恢恆恃恬恫恪恤扁拜挖按拼拭持拮拽指拱拷"],
["ac40","拯括拾拴挑挂政故斫施既春昭映昧是星昨昱昤曷柿染柱柔某柬架枯柵柩柯柄柑枴柚查枸柏柞柳枰柙柢柝柒歪殃殆段毒毗氟泉洋洲洪流津洌洱洞洗"],
["aca1","活洽派洶洛泵洹洧洸洩洮洵洎洫炫為炳炬炯炭炸炮炤爰牲牯牴狩狠狡玷珊玻玲珍珀玳甚甭畏界畎畋疫疤疥疢疣癸皆皇皈盈盆盃盅省盹相眉看盾盼眇矜砂研砌砍祆祉祈祇禹禺科秒秋穿突竿竽籽紂紅紀紉紇約紆缸美羿耄"],
["ad40","耐耍耑耶胖胥胚胃胄背胡胛胎胞胤胝致舢苧范茅苣苛苦茄若茂茉苒苗英茁苜苔苑苞苓苟苯茆虐虹虻虺衍衫要觔計訂訃貞負赴赳趴軍軌述迦迢迪迥"],
["ada1","迭迫迤迨郊郎郁郃酋酊重閂限陋陌降面革韋韭音頁風飛食首香乘亳倌倍倣俯倦倥俸倩倖倆值借倚倒們俺倀倔倨俱倡個候倘俳修倭倪俾倫倉兼冤冥冢凍凌准凋剖剜剔剛剝匪卿原厝叟哨唐唁唷哼哥哲唆哺唔哩哭員唉哮哪"],
["ae40","哦唧唇哽唏圃圄埂埔埋埃堉夏套奘奚娑娘娜娟娛娓姬娠娣娩娥娌娉孫屘宰害家宴宮宵容宸射屑展屐峭峽峻峪峨峰島崁峴差席師庫庭座弱徒徑徐恙"],
["aea1","恣恥恐恕恭恩息悄悟悚悍悔悌悅悖扇拳挈拿捎挾振捕捂捆捏捉挺捐挽挪挫挨捍捌效敉料旁旅時晉晏晃晒晌晅晁書朔朕朗校核案框桓根桂桔栩梳栗桌桑栽柴桐桀格桃株桅栓栘桁殊殉殷氣氧氨氦氤泰浪涕消涇浦浸海浙涓"],
["af40","浬涉浮浚浴浩涌涊浹涅浥涔烊烘烤烙烈烏爹特狼狹狽狸狷玆班琉珮珠珪珞畔畝畜畚留疾病症疲疳疽疼疹痂疸皋皰益盍盎眩真眠眨矩砰砧砸砝破砷"],
["afa1","砥砭砠砟砲祕祐祠祟祖神祝祗祚秤秣秧租秦秩秘窄窈站笆笑粉紡紗紋紊素索純紐紕級紜納紙紛缺罟羔翅翁耆耘耕耙耗耽耿胱脂胰脅胭胴脆胸胳脈能脊胼胯臭臬舀舐航舫舨般芻茫荒荔荊茸荐草茵茴荏茲茹茶茗荀茱茨荃"],
["b040","虔蚊蚪蚓蚤蚩蚌蚣蚜衰衷袁袂衽衹記訐討訌訕訊託訓訖訏訑豈豺豹財貢起躬軒軔軏辱送逆迷退迺迴逃追逅迸邕郡郝郢酒配酌釘針釗釜釙閃院陣陡"],
["b0a1","陛陝除陘陞隻飢馬骨高鬥鬲鬼乾偺偽停假偃偌做偉健偶偎偕偵側偷偏倏偯偭兜冕凰剪副勒務勘動匐匏匙匿區匾參曼商啪啦啄啞啡啃啊唱啖問啕唯啤唸售啜唬啣唳啁啗圈國圉域堅堊堆埠埤基堂堵執培夠奢娶婁婉婦婪婀"],
["b140","娼婢婚婆婊孰寇寅寄寂宿密尉專將屠屜屝崇崆崎崛崖崢崑崩崔崙崤崧崗巢常帶帳帷康庸庶庵庾張強彗彬彩彫得徙從徘御徠徜恿患悉悠您惋悴惦悽"],
["b1a1","情悻悵惜悼惘惕惆惟悸惚惇戚戛扈掠控捲掖探接捷捧掘措捱掩掉掃掛捫推掄授掙採掬排掏掀捻捩捨捺敝敖救教敗啟敏敘敕敔斜斛斬族旋旌旎晝晚晤晨晦晞曹勗望梁梯梢梓梵桿桶梱梧梗械梃棄梭梆梅梔條梨梟梡梂欲殺"],
["b240","毫毬氫涎涼淳淙液淡淌淤添淺清淇淋涯淑涮淞淹涸混淵淅淒渚涵淚淫淘淪深淮淨淆淄涪淬涿淦烹焉焊烽烯爽牽犁猜猛猖猓猙率琅琊球理現琍瓠瓶"],
["b2a1","瓷甜產略畦畢異疏痔痕疵痊痍皎盔盒盛眷眾眼眶眸眺硫硃硎祥票祭移窒窕笠笨笛第符笙笞笮粒粗粕絆絃統紮紹紼絀細紳組累終紲紱缽羞羚翌翎習耜聊聆脯脖脣脫脩脰脤舂舵舷舶船莎莞莘荸莢莖莽莫莒莊莓莉莠荷荻荼"],
["b340","莆莧處彪蛇蛀蚶蛄蚵蛆蛋蚱蚯蛉術袞袈被袒袖袍袋覓規訪訝訣訥許設訟訛訢豉豚販責貫貨貪貧赧赦趾趺軛軟這逍通逗連速逝逐逕逞造透逢逖逛途"],
["b3a1","部郭都酗野釵釦釣釧釭釩閉陪陵陳陸陰陴陶陷陬雀雪雩章竟頂頃魚鳥鹵鹿麥麻傢傍傅備傑傀傖傘傚最凱割剴創剩勞勝勛博厥啻喀喧啼喊喝喘喂喜喪喔喇喋喃喳單喟唾喲喚喻喬喱啾喉喫喙圍堯堪場堤堰報堡堝堠壹壺奠"],
["b440","婷媚婿媒媛媧孳孱寒富寓寐尊尋就嵌嵐崴嵇巽幅帽幀幃幾廊廁廂廄弼彭復循徨惑惡悲悶惠愜愣惺愕惰惻惴慨惱愎惶愉愀愒戟扉掣掌描揀揩揉揆揍"],
["b4a1","插揣提握揖揭揮捶援揪換摒揚揹敞敦敢散斑斐斯普晰晴晶景暑智晾晷曾替期朝棺棕棠棘棗椅棟棵森棧棹棒棲棣棋棍植椒椎棉棚楮棻款欺欽殘殖殼毯氮氯氬港游湔渡渲湧湊渠渥渣減湛湘渤湖湮渭渦湯渴湍渺測湃渝渾滋"],
["b540","溉渙湎湣湄湲湩湟焙焚焦焰無然煮焜牌犄犀猶猥猴猩琺琪琳琢琥琵琶琴琯琛琦琨甥甦畫番痢痛痣痙痘痞痠登發皖皓皴盜睏短硝硬硯稍稈程稅稀窘"],
["b5a1","窗窖童竣等策筆筐筒答筍筋筏筑粟粥絞結絨絕紫絮絲絡給絢絰絳善翔翕耋聒肅腕腔腋腑腎脹腆脾腌腓腴舒舜菩萃菸萍菠菅萋菁華菱菴著萊菰萌菌菽菲菊萸萎萄菜萇菔菟虛蛟蛙蛭蛔蛛蛤蛐蛞街裁裂袱覃視註詠評詞証詁"],
["b640","詔詛詐詆訴診訶詖象貂貯貼貳貽賁費賀貴買貶貿貸越超趁跎距跋跚跑跌跛跆軻軸軼辜逮逵週逸進逶鄂郵鄉郾酣酥量鈔鈕鈣鈉鈞鈍鈐鈇鈑閔閏開閑"],
["b6a1","間閒閎隊階隋陽隅隆隍陲隄雁雅雄集雇雯雲韌項順須飧飪飯飩飲飭馮馭黃黍黑亂傭債傲傳僅傾催傷傻傯僇剿剷剽募勦勤勢勣匯嗟嗨嗓嗦嗎嗜嗇嗑嗣嗤嗯嗚嗡嗅嗆嗥嗉園圓塞塑塘塗塚塔填塌塭塊塢塒塋奧嫁嫉嫌媾媽媼"],
["b740","媳嫂媲嵩嵯幌幹廉廈弒彙徬微愚意慈感想愛惹愁愈慎慌慄慍愾愴愧愍愆愷戡戢搓搾搞搪搭搽搬搏搜搔損搶搖搗搆敬斟新暗暉暇暈暖暄暘暍會榔業"],
["b7a1","楚楷楠楔極椰概楊楨楫楞楓楹榆楝楣楛歇歲毀殿毓毽溢溯滓溶滂源溝滇滅溥溘溼溺溫滑準溜滄滔溪溧溴煎煙煩煤煉照煜煬煦煌煥煞煆煨煖爺牒猷獅猿猾瑯瑚瑕瑟瑞瑁琿瑙瑛瑜當畸瘀痰瘁痲痱痺痿痴痳盞盟睛睫睦睞督"],
["b840","睹睪睬睜睥睨睢矮碎碰碗碘碌碉硼碑碓硿祺祿禁萬禽稜稚稠稔稟稞窟窠筷節筠筮筧粱粳粵經絹綑綁綏絛置罩罪署義羨群聖聘肆肄腱腰腸腥腮腳腫"],
["b8a1","腹腺腦舅艇蒂葷落萱葵葦葫葉葬葛萼萵葡董葩葭葆虞虜號蛹蜓蜈蜇蜀蛾蛻蜂蜃蜆蜊衙裟裔裙補裘裝裡裊裕裒覜解詫該詳試詩詰誇詼詣誠話誅詭詢詮詬詹詻訾詨豢貊貉賊資賈賄貲賃賂賅跡跟跨路跳跺跪跤跦躲較載軾輊"],
["b940","辟農運遊道遂達逼違遐遇遏過遍遑逾遁鄒鄗酬酪酩釉鈷鉗鈸鈽鉀鈾鉛鉋鉤鉑鈴鉉鉍鉅鈹鈿鉚閘隘隔隕雍雋雉雊雷電雹零靖靴靶預頑頓頊頒頌飼飴"],
["b9a1","飽飾馳馱馴髡鳩麂鼎鼓鼠僧僮僥僖僭僚僕像僑僱僎僩兢凳劃劂匱厭嗾嘀嘛嘗嗽嘔嘆嘉嘍嘎嗷嘖嘟嘈嘐嗶團圖塵塾境墓墊塹墅塽壽夥夢夤奪奩嫡嫦嫩嫗嫖嫘嫣孵寞寧寡寥實寨寢寤察對屢嶄嶇幛幣幕幗幔廓廖弊彆彰徹慇"],
["ba40","愿態慷慢慣慟慚慘慵截撇摘摔撤摸摟摺摑摧搴摭摻敲斡旗旖暢暨暝榜榨榕槁榮槓構榛榷榻榫榴槐槍榭槌榦槃榣歉歌氳漳演滾漓滴漩漾漠漬漏漂漢"],
["baa1","滿滯漆漱漸漲漣漕漫漯澈漪滬漁滲滌滷熔熙煽熊熄熒爾犒犖獄獐瑤瑣瑪瑰瑭甄疑瘧瘍瘋瘉瘓盡監瞄睽睿睡磁碟碧碳碩碣禎福禍種稱窪窩竭端管箕箋筵算箝箔箏箸箇箄粹粽精綻綰綜綽綾綠緊綴網綱綺綢綿綵綸維緒緇綬"],
["bb40","罰翠翡翟聞聚肇腐膀膏膈膊腿膂臧臺與舔舞艋蓉蒿蓆蓄蒙蒞蒲蒜蓋蒸蓀蓓蒐蒼蓑蓊蜿蜜蜻蜢蜥蜴蜘蝕蜷蜩裳褂裴裹裸製裨褚裯誦誌語誣認誡誓誤"],
["bba1","說誥誨誘誑誚誧豪貍貌賓賑賒赫趙趕跼輔輒輕輓辣遠遘遜遣遙遞遢遝遛鄙鄘鄞酵酸酷酴鉸銀銅銘銖鉻銓銜銨鉼銑閡閨閩閣閥閤隙障際雌雒需靼鞅韶頗領颯颱餃餅餌餉駁骯骰髦魁魂鳴鳶鳳麼鼻齊億儀僻僵價儂儈儉儅凜"],
["bc40","劇劈劉劍劊勰厲嘮嘻嘹嘲嘿嘴嘩噓噎噗噴嘶嘯嘰墀墟增墳墜墮墩墦奭嬉嫻嬋嫵嬌嬈寮寬審寫層履嶝嶔幢幟幡廢廚廟廝廣廠彈影德徵慶慧慮慝慕憂"],
["bca1","慼慰慫慾憧憐憫憎憬憚憤憔憮戮摩摯摹撞撲撈撐撰撥撓撕撩撒撮播撫撚撬撙撢撳敵敷數暮暫暴暱樣樟槨樁樞標槽模樓樊槳樂樅槭樑歐歎殤毅毆漿潼澄潑潦潔澆潭潛潸潮澎潺潰潤澗潘滕潯潠潟熟熬熱熨牖犛獎獗瑩璋璃"],
["bd40","瑾璀畿瘠瘩瘟瘤瘦瘡瘢皚皺盤瞎瞇瞌瞑瞋磋磅確磊碾磕碼磐稿稼穀稽稷稻窯窮箭箱範箴篆篇篁箠篌糊締練緯緻緘緬緝編緣線緞緩綞緙緲緹罵罷羯"],
["bda1","翩耦膛膜膝膠膚膘蔗蔽蔚蓮蔬蔭蔓蔑蔣蔡蔔蓬蔥蓿蔆螂蝴蝶蝠蝦蝸蝨蝙蝗蝌蝓衛衝褐複褒褓褕褊誼諒談諄誕請諸課諉諂調誰論諍誶誹諛豌豎豬賠賞賦賤賬賭賢賣賜質賡赭趟趣踫踐踝踢踏踩踟踡踞躺輝輛輟輩輦輪輜輞"],
["be40","輥適遮遨遭遷鄰鄭鄧鄱醇醉醋醃鋅銻銷鋪銬鋤鋁銳銼鋒鋇鋰銲閭閱霄霆震霉靠鞍鞋鞏頡頫頜颳養餓餒餘駝駐駟駛駑駕駒駙骷髮髯鬧魅魄魷魯鴆鴉"],
["bea1","鴃麩麾黎墨齒儒儘儔儐儕冀冪凝劑劓勳噙噫噹噩噤噸噪器噥噱噯噬噢噶壁墾壇壅奮嬝嬴學寰導彊憲憑憩憊懍憶憾懊懈戰擅擁擋撻撼據擄擇擂操撿擒擔撾整曆曉暹曄曇暸樽樸樺橙橫橘樹橄橢橡橋橇樵機橈歙歷氅濂澱澡"],
["bf40","濃澤濁澧澳激澹澶澦澠澴熾燉燐燒燈燕熹燎燙燜燃燄獨璜璣璘璟璞瓢甌甍瘴瘸瘺盧盥瞠瞞瞟瞥磨磚磬磧禦積穎穆穌穋窺篙簑築篤篛篡篩篦糕糖縊"],
["bfa1","縑縈縛縣縞縝縉縐罹羲翰翱翮耨膳膩膨臻興艘艙蕊蕙蕈蕨蕩蕃蕉蕭蕪蕞螃螟螞螢融衡褪褲褥褫褡親覦諦諺諫諱謀諜諧諮諾謁謂諷諭諳諶諼豫豭貓賴蹄踱踴蹂踹踵輻輯輸輳辨辦遵遴選遲遼遺鄴醒錠錶鋸錳錯錢鋼錫錄錚"],
["c040","錐錦錡錕錮錙閻隧隨險雕霎霑霖霍霓霏靛靜靦鞘頰頸頻頷頭頹頤餐館餞餛餡餚駭駢駱骸骼髻髭鬨鮑鴕鴣鴦鴨鴒鴛默黔龍龜優償儡儲勵嚎嚀嚐嚅嚇"],
["c0a1","嚏壕壓壑壎嬰嬪嬤孺尷屨嶼嶺嶽嶸幫彌徽應懂懇懦懋戲戴擎擊擘擠擰擦擬擱擢擭斂斃曙曖檀檔檄檢檜櫛檣橾檗檐檠歜殮毚氈濘濱濟濠濛濤濫濯澀濬濡濩濕濮濰燧營燮燦燥燭燬燴燠爵牆獰獲璩環璦璨癆療癌盪瞳瞪瞰瞬"],
["c140","瞧瞭矯磷磺磴磯礁禧禪穗窿簇簍篾篷簌篠糠糜糞糢糟糙糝縮績繆縷縲繃縫總縱繅繁縴縹繈縵縿縯罄翳翼聱聲聰聯聳臆臃膺臂臀膿膽臉膾臨舉艱薪"],
["c1a1","薄蕾薜薑薔薯薛薇薨薊虧蟀蟑螳蟒蟆螫螻螺蟈蟋褻褶襄褸褽覬謎謗謙講謊謠謝謄謐豁谿豳賺賽購賸賻趨蹉蹋蹈蹊轄輾轂轅輿避遽還邁邂邀鄹醣醞醜鍍鎂錨鍵鍊鍥鍋錘鍾鍬鍛鍰鍚鍔闊闋闌闈闆隱隸雖霜霞鞠韓顆颶餵騁"],
["c240","駿鮮鮫鮪鮭鴻鴿麋黏點黜黝黛鼾齋叢嚕嚮壙壘嬸彝懣戳擴擲擾攆擺擻擷斷曜朦檳檬櫃檻檸櫂檮檯歟歸殯瀉瀋濾瀆濺瀑瀏燻燼燾燸獷獵璧璿甕癖癘"],
["c2a1","癒瞽瞿瞻瞼礎禮穡穢穠竄竅簫簧簪簞簣簡糧織繕繞繚繡繒繙罈翹翻職聶臍臏舊藏薩藍藐藉薰薺薹薦蟯蟬蟲蟠覆覲觴謨謹謬謫豐贅蹙蹣蹦蹤蹟蹕軀轉轍邇邃邈醫醬釐鎔鎊鎖鎢鎳鎮鎬鎰鎘鎚鎗闔闖闐闕離雜雙雛雞霤鞣鞦"],
["c340","鞭韹額顏題顎顓颺餾餿餽餮馥騎髁鬃鬆魏魎魍鯊鯉鯽鯈鯀鵑鵝鵠黠鼕鼬儳嚥壞壟壢寵龐廬懲懷懶懵攀攏曠曝櫥櫝櫚櫓瀛瀟瀨瀚瀝瀕瀘爆爍牘犢獸"],
["c3a1","獺璽瓊瓣疇疆癟癡矇礙禱穫穩簾簿簸簽簷籀繫繭繹繩繪羅繳羶羹羸臘藩藝藪藕藤藥藷蟻蠅蠍蟹蟾襠襟襖襞譁譜識證譚譎譏譆譙贈贊蹼蹲躇蹶蹬蹺蹴轔轎辭邊邋醱醮鏡鏑鏟鏃鏈鏜鏝鏖鏢鏍鏘鏤鏗鏨關隴難霪霧靡韜韻類"],
["c440","願顛颼饅饉騖騙鬍鯨鯧鯖鯛鶉鵡鵲鵪鵬麒麗麓麴勸嚨嚷嚶嚴嚼壤孀孃孽寶巉懸懺攘攔攙曦朧櫬瀾瀰瀲爐獻瓏癢癥礦礪礬礫竇競籌籃籍糯糰辮繽繼"],
["c4a1","纂罌耀臚艦藻藹蘑藺蘆蘋蘇蘊蠔蠕襤覺觸議譬警譯譟譫贏贍躉躁躅躂醴釋鐘鐃鏽闡霰飄饒饑馨騫騰騷騵鰓鰍鹹麵黨鼯齟齣齡儷儸囁囀囂夔屬巍懼懾攝攜斕曩櫻欄櫺殲灌爛犧瓖瓔癩矓籐纏續羼蘗蘭蘚蠣蠢蠡蠟襪襬覽譴"],
["c540","護譽贓躊躍躋轟辯醺鐮鐳鐵鐺鐸鐲鐫闢霸霹露響顧顥饗驅驃驀騾髏魔魑鰭鰥鶯鶴鷂鶸麝黯鼙齜齦齧儼儻囈囊囉孿巔巒彎懿攤權歡灑灘玀瓤疊癮癬"],
["c5a1","禳籠籟聾聽臟襲襯觼讀贖贗躑躓轡酈鑄鑑鑒霽霾韃韁顫饕驕驍髒鬚鱉鰱鰾鰻鷓鷗鼴齬齪龔囌巖戀攣攫攪曬欐瓚竊籤籣籥纓纖纔臢蘸蘿蠱變邐邏鑣鑠鑤靨顯饜驚驛驗髓體髑鱔鱗鱖鷥麟黴囑壩攬灞癱癲矗罐羈蠶蠹衢讓讒"],
["c640","讖艷贛釀鑪靂靈靄韆顰驟鬢魘鱟鷹鷺鹼鹽鼇齷齲廳欖灣籬籮蠻觀躡釁鑲鑰顱饞髖鬣黌灤矚讚鑷韉驢驥纜讜躪釅鑽鑾鑼鱷鱸黷豔鑿鸚爨驪鬱鸛鸞籲"],
["c940","乂乜凵匚厂万丌乇亍囗兀屮彳丏冇与丮亓仂仉仈冘勼卬厹圠夃夬尐巿旡殳毌气爿丱丼仨仜仩仡仝仚刌匜卌圢圣夗夯宁宄尒尻屴屳帄庀庂忉戉扐氕"],
["c9a1","氶汃氿氻犮犰玊禸肊阞伎优伬仵伔仱伀价伈伝伂伅伢伓伄仴伒冱刓刉刐劦匢匟卍厊吇囡囟圮圪圴夼妀奼妅奻奾奷奿孖尕尥屼屺屻屾巟幵庄异弚彴忕忔忏扜扞扤扡扦扢扙扠扚扥旯旮朾朹朸朻机朿朼朳氘汆汒汜汏汊汔汋"],
["ca40","汌灱牞犴犵玎甪癿穵网艸艼芀艽艿虍襾邙邗邘邛邔阢阤阠阣佖伻佢佉体佤伾佧佒佟佁佘伭伳伿佡冏冹刜刞刡劭劮匉卣卲厎厏吰吷吪呔呅吙吜吥吘"],
["caa1","吽呏呁吨吤呇囮囧囥坁坅坌坉坋坒夆奀妦妘妠妗妎妢妐妏妧妡宎宒尨尪岍岏岈岋岉岒岊岆岓岕巠帊帎庋庉庌庈庍弅弝彸彶忒忑忐忭忨忮忳忡忤忣忺忯忷忻怀忴戺抃抌抎抏抔抇扱扻扺扰抁抈扷扽扲扴攷旰旴旳旲旵杅杇"],
["cb40","杙杕杌杈杝杍杚杋毐氙氚汸汧汫沄沋沏汱汯汩沚汭沇沕沜汦汳汥汻沎灴灺牣犿犽狃狆狁犺狅玕玗玓玔玒町甹疔疕皁礽耴肕肙肐肒肜芐芏芅芎芑芓"],
["cba1","芊芃芄豸迉辿邟邡邥邞邧邠阰阨阯阭丳侘佼侅佽侀侇佶佴侉侄佷佌侗佪侚佹侁佸侐侜侔侞侒侂侕佫佮冞冼冾刵刲刳剆刱劼匊匋匼厒厔咇呿咁咑咂咈呫呺呾呥呬呴呦咍呯呡呠咘呣呧呤囷囹坯坲坭坫坱坰坶垀坵坻坳坴坢"],
["cc40","坨坽夌奅妵妺姏姎妲姌姁妶妼姃姖妱妽姀姈妴姇孢孥宓宕屄屇岮岤岠岵岯岨岬岟岣岭岢岪岧岝岥岶岰岦帗帔帙弨弢弣弤彔徂彾彽忞忥怭怦怙怲怋"],
["cca1","怴怊怗怳怚怞怬怢怍怐怮怓怑怌怉怜戔戽抭抴拑抾抪抶拊抮抳抯抻抩抰抸攽斨斻昉旼昄昒昈旻昃昋昍昅旽昑昐曶朊枅杬枎枒杶杻枘枆构杴枍枌杺枟枑枙枃杽极杸杹枔欥殀歾毞氝沓泬泫泮泙沶泔沭泧沷泐泂沺泃泆泭泲"],
["cd40","泒泝沴沊沝沀泞泀洰泍泇沰泹泏泩泑炔炘炅炓炆炄炑炖炂炚炃牪狖狋狘狉狜狒狔狚狌狑玤玡玭玦玢玠玬玝瓝瓨甿畀甾疌疘皯盳盱盰盵矸矼矹矻矺"],
["cda1","矷祂礿秅穸穻竻籵糽耵肏肮肣肸肵肭舠芠苀芫芚芘芛芵芧芮芼芞芺芴芨芡芩苂芤苃芶芢虰虯虭虮豖迒迋迓迍迖迕迗邲邴邯邳邰阹阽阼阺陃俍俅俓侲俉俋俁俔俜俙侻侳俛俇俖侺俀侹俬剄剉勀勂匽卼厗厖厙厘咺咡咭咥哏"],
["ce40","哃茍咷咮哖咶哅哆咠呰咼咢咾呲哞咰垵垞垟垤垌垗垝垛垔垘垏垙垥垚垕壴复奓姡姞姮娀姱姝姺姽姼姶姤姲姷姛姩姳姵姠姾姴姭宨屌峐峘峌峗峋峛"],
["cea1","峞峚峉峇峊峖峓峔峏峈峆峎峟峸巹帡帢帣帠帤庰庤庢庛庣庥弇弮彖徆怷怹恔恲恞恅恓恇恉恛恌恀恂恟怤恄恘恦恮扂扃拏挍挋拵挎挃拫拹挏挌拸拶挀挓挔拺挕拻拰敁敃斪斿昶昡昲昵昜昦昢昳昫昺昝昴昹昮朏朐柁柲柈枺"],
["cf40","柜枻柸柘柀枷柅柫柤柟枵柍枳柷柶柮柣柂枹柎柧柰枲柼柆柭柌枮柦柛柺柉柊柃柪柋欨殂殄殶毖毘毠氠氡洨洴洭洟洼洿洒洊泚洳洄洙洺洚洑洀洝浂"],
["cfa1","洁洘洷洃洏浀洇洠洬洈洢洉洐炷炟炾炱炰炡炴炵炩牁牉牊牬牰牳牮狊狤狨狫狟狪狦狣玅珌珂珈珅玹玶玵玴珫玿珇玾珃珆玸珋瓬瓮甮畇畈疧疪癹盄眈眃眄眅眊盷盻盺矧矨砆砑砒砅砐砏砎砉砃砓祊祌祋祅祄秕种秏秖秎窀"],
["d040","穾竑笀笁籺籸籹籿粀粁紃紈紁罘羑羍羾耇耎耏耔耷胘胇胠胑胈胂胐胅胣胙胜胊胕胉胏胗胦胍臿舡芔苙苾苹茇苨茀苕茺苫苖苴苬苡苲苵茌苻苶苰苪"],
["d0a1","苤苠苺苳苭虷虴虼虳衁衎衧衪衩觓訄訇赲迣迡迮迠郱邽邿郕郅邾郇郋郈釔釓陔陏陑陓陊陎倞倅倇倓倢倰倛俵俴倳倷倬俶俷倗倜倠倧倵倯倱倎党冔冓凊凄凅凈凎剡剚剒剞剟剕剢勍匎厞唦哢唗唒哧哳哤唚哿唄唈哫唑唅哱"],
["d140","唊哻哷哸哠唎唃唋圁圂埌堲埕埒垺埆垽垼垸垶垿埇埐垹埁夎奊娙娖娭娮娕娏娗娊娞娳孬宧宭宬尃屖屔峬峿峮峱峷崀峹帩帨庨庮庪庬弳弰彧恝恚恧"],
["d1a1","恁悢悈悀悒悁悝悃悕悛悗悇悜悎戙扆拲挐捖挬捄捅挶捃揤挹捋捊挼挩捁挴捘捔捙挭捇挳捚捑挸捗捀捈敊敆旆旃旄旂晊晟晇晑朒朓栟栚桉栲栳栻桋桏栖栱栜栵栫栭栯桎桄栴栝栒栔栦栨栮桍栺栥栠欬欯欭欱欴歭肂殈毦毤"],
["d240","毨毣毢毧氥浺浣浤浶洍浡涒浘浢浭浯涑涍淯浿涆浞浧浠涗浰浼浟涂涘洯浨涋浾涀涄洖涃浻浽浵涐烜烓烑烝烋缹烢烗烒烞烠烔烍烅烆烇烚烎烡牂牸"],
["d2a1","牷牶猀狺狴狾狶狳狻猁珓珙珥珖玼珧珣珩珜珒珛珔珝珚珗珘珨瓞瓟瓴瓵甡畛畟疰痁疻痄痀疿疶疺皊盉眝眛眐眓眒眣眑眕眙眚眢眧砣砬砢砵砯砨砮砫砡砩砳砪砱祔祛祏祜祓祒祑秫秬秠秮秭秪秜秞秝窆窉窅窋窌窊窇竘笐"],
["d340","笄笓笅笏笈笊笎笉笒粄粑粊粌粈粍粅紞紝紑紎紘紖紓紟紒紏紌罜罡罞罠罝罛羖羒翃翂翀耖耾耹胺胲胹胵脁胻脀舁舯舥茳茭荄茙荑茥荖茿荁茦茜茢"],
["d3a1","荂荎茛茪茈茼荍茖茤茠茷茯茩荇荅荌荓茞茬荋茧荈虓虒蚢蚨蚖蚍蚑蚞蚇蚗蚆蚋蚚蚅蚥蚙蚡蚧蚕蚘蚎蚝蚐蚔衃衄衭衵衶衲袀衱衿衯袃衾衴衼訒豇豗豻貤貣赶赸趵趷趶軑軓迾迵适迿迻逄迼迶郖郠郙郚郣郟郥郘郛郗郜郤酐"],
["d440","酎酏釕釢釚陜陟隼飣髟鬯乿偰偪偡偞偠偓偋偝偲偈偍偁偛偊偢倕偅偟偩偫偣偤偆偀偮偳偗偑凐剫剭剬剮勖勓匭厜啵啶唼啍啐唴唪啑啢唶唵唰啒啅"],
["d4a1","唌唲啥啎唹啈唭唻啀啋圊圇埻堔埢埶埜埴堀埭埽堈埸堋埳埏堇埮埣埲埥埬埡堎埼堐埧堁堌埱埩埰堍堄奜婠婘婕婧婞娸娵婭婐婟婥婬婓婤婗婃婝婒婄婛婈媎娾婍娹婌婰婩婇婑婖婂婜孲孮寁寀屙崞崋崝崚崠崌崨崍崦崥崏"],
["d540","崰崒崣崟崮帾帴庱庴庹庲庳弶弸徛徖徟悊悐悆悾悰悺惓惔惏惤惙惝惈悱惛悷惊悿惃惍惀挲捥掊掂捽掽掞掭掝掗掫掎捯掇掐据掯捵掜捭掮捼掤挻掟"],
["d5a1","捸掅掁掑掍捰敓旍晥晡晛晙晜晢朘桹梇梐梜桭桮梮梫楖桯梣梬梩桵桴梲梏桷梒桼桫桲梪梀桱桾梛梖梋梠梉梤桸桻梑梌梊桽欶欳欷欸殑殏殍殎殌氪淀涫涴涳湴涬淩淢涷淶淔渀淈淠淟淖涾淥淜淝淛淴淊涽淭淰涺淕淂淏淉"],
["d640","淐淲淓淽淗淍淣涻烺焍烷焗烴焌烰焄烳焐烼烿焆焓焀烸烶焋焂焎牾牻牼牿猝猗猇猑猘猊猈狿猏猞玈珶珸珵琄琁珽琇琀珺珼珿琌琋珴琈畤畣痎痒痏"],
["d6a1","痋痌痑痐皏皉盓眹眯眭眱眲眴眳眽眥眻眵硈硒硉硍硊硌砦硅硐祤祧祩祪祣祫祡离秺秸秶秷窏窔窐笵筇笴笥笰笢笤笳笘笪笝笱笫笭笯笲笸笚笣粔粘粖粣紵紽紸紶紺絅紬紩絁絇紾紿絊紻紨罣羕羜羝羛翊翋翍翐翑翇翏翉耟"],
["d740","耞耛聇聃聈脘脥脙脛脭脟脬脞脡脕脧脝脢舑舸舳舺舴舲艴莐莣莨莍荺荳莤荴莏莁莕莙荵莔莩荽莃莌莝莛莪莋荾莥莯莈莗莰荿莦莇莮荶莚虙虖蚿蚷"],
["d7a1","蛂蛁蛅蚺蚰蛈蚹蚳蚸蛌蚴蚻蚼蛃蚽蚾衒袉袕袨袢袪袚袑袡袟袘袧袙袛袗袤袬袌袓袎覂觖觙觕訰訧訬訞谹谻豜豝豽貥赽赻赹趼跂趹趿跁軘軞軝軜軗軠軡逤逋逑逜逌逡郯郪郰郴郲郳郔郫郬郩酖酘酚酓酕釬釴釱釳釸釤釹釪"],
["d840","釫釷釨釮镺閆閈陼陭陫陱陯隿靪頄飥馗傛傕傔傞傋傣傃傌傎傝偨傜傒傂傇兟凔匒匑厤厧喑喨喥喭啷噅喢喓喈喏喵喁喣喒喤啽喌喦啿喕喡喎圌堩堷"],
["d8a1","堙堞堧堣堨埵塈堥堜堛堳堿堶堮堹堸堭堬堻奡媯媔媟婺媢媞婸媦婼媥媬媕媮娷媄媊媗媃媋媩婻婽媌媜媏媓媝寪寍寋寔寑寊寎尌尰崷嵃嵫嵁嵋崿崵嵑嵎嵕崳崺嵒崽崱嵙嵂崹嵉崸崼崲崶嵀嵅幄幁彘徦徥徫惉悹惌惢惎惄愔"],
["d940","惲愊愖愅惵愓惸惼惾惁愃愘愝愐惿愄愋扊掔掱掰揎揥揨揯揃撝揳揊揠揶揕揲揵摡揟掾揝揜揄揘揓揂揇揌揋揈揰揗揙攲敧敪敤敜敨敥斌斝斞斮旐旒"],
["d9a1","晼晬晻暀晱晹晪晲朁椌棓椄棜椪棬棪棱椏棖棷棫棤棶椓椐棳棡椇棌椈楰梴椑棯棆椔棸棐棽棼棨椋椊椗棎棈棝棞棦棴棑椆棔棩椕椥棇欹欻欿欼殔殗殙殕殽毰毲毳氰淼湆湇渟湉溈渼渽湅湢渫渿湁湝湳渜渳湋湀湑渻渃渮湞"],
["da40","湨湜湡渱渨湠湱湫渹渢渰湓湥渧湸湤湷湕湹湒湦渵渶湚焠焞焯烻焮焱焣焥焢焲焟焨焺焛牋牚犈犉犆犅犋猒猋猰猢猱猳猧猲猭猦猣猵猌琮琬琰琫琖"],
["daa1","琚琡琭琱琤琣琝琩琠琲瓻甯畯畬痧痚痡痦痝痟痤痗皕皒盚睆睇睄睍睅睊睎睋睌矞矬硠硤硥硜硭硱硪确硰硩硨硞硢祴祳祲祰稂稊稃稌稄窙竦竤筊笻筄筈筌筎筀筘筅粢粞粨粡絘絯絣絓絖絧絪絏絭絜絫絒絔絩絑絟絎缾缿罥"],
["db40","罦羢羠羡翗聑聏聐胾胔腃腊腒腏腇脽腍脺臦臮臷臸臹舄舼舽舿艵茻菏菹萣菀菨萒菧菤菼菶萐菆菈菫菣莿萁菝菥菘菿菡菋菎菖菵菉萉萏菞萑萆菂菳"],
["dba1","菕菺菇菑菪萓菃菬菮菄菻菗菢萛菛菾蛘蛢蛦蛓蛣蛚蛪蛝蛫蛜蛬蛩蛗蛨蛑衈衖衕袺裗袹袸裀袾袶袼袷袽袲褁裉覕覘覗觝觚觛詎詍訹詙詀詗詘詄詅詒詈詑詊詌詏豟貁貀貺貾貰貹貵趄趀趉跘跓跍跇跖跜跏跕跙跈跗跅軯軷軺"],
["dc40","軹軦軮軥軵軧軨軶軫軱軬軴軩逭逴逯鄆鄬鄄郿郼鄈郹郻鄁鄀鄇鄅鄃酡酤酟酢酠鈁鈊鈥鈃鈚鈦鈏鈌鈀鈒釿釽鈆鈄鈧鈂鈜鈤鈙鈗鈅鈖镻閍閌閐隇陾隈"],
["dca1","隉隃隀雂雈雃雱雰靬靰靮頇颩飫鳦黹亃亄亶傽傿僆傮僄僊傴僈僂傰僁傺傱僋僉傶傸凗剺剸剻剼嗃嗛嗌嗐嗋嗊嗝嗀嗔嗄嗩喿嗒喍嗏嗕嗢嗖嗈嗲嗍嗙嗂圔塓塨塤塏塍塉塯塕塎塝塙塥塛堽塣塱壼嫇嫄嫋媺媸媱媵媰媿嫈媻嫆"],
["dd40","媷嫀嫊媴媶嫍媹媐寖寘寙尟尳嵱嵣嵊嵥嵲嵬嵞嵨嵧嵢巰幏幎幊幍幋廅廌廆廋廇彀徯徭惷慉慊愫慅愶愲愮慆愯慏愩慀戠酨戣戥戤揅揱揫搐搒搉搠搤"],
["dda1","搳摃搟搕搘搹搷搢搣搌搦搰搨摁搵搯搊搚摀搥搧搋揧搛搮搡搎敯斒旓暆暌暕暐暋暊暙暔晸朠楦楟椸楎楢楱椿楅楪椹楂楗楙楺楈楉椵楬椳椽楥棰楸椴楩楀楯楄楶楘楁楴楌椻楋椷楜楏楑椲楒椯楻椼歆歅歃歂歈歁殛嗀毻毼"],
["de40","毹毷毸溛滖滈溏滀溟溓溔溠溱溹滆滒溽滁溞滉溷溰滍溦滏溲溾滃滜滘溙溒溎溍溤溡溿溳滐滊溗溮溣煇煔煒煣煠煁煝煢煲煸煪煡煂煘煃煋煰煟煐煓"],
["dea1","煄煍煚牏犍犌犑犐犎猼獂猻猺獀獊獉瑄瑊瑋瑒瑑瑗瑀瑏瑐瑎瑂瑆瑍瑔瓡瓿瓾瓽甝畹畷榃痯瘏瘃痷痾痼痹痸瘐痻痶痭痵痽皙皵盝睕睟睠睒睖睚睩睧睔睙睭矠碇碚碔碏碄碕碅碆碡碃硹碙碀碖硻祼禂祽祹稑稘稙稒稗稕稢稓"],
["df40","稛稐窣窢窞竫筦筤筭筴筩筲筥筳筱筰筡筸筶筣粲粴粯綈綆綀綍絿綅絺綎絻綃絼綌綔綄絽綒罭罫罧罨罬羦羥羧翛翜耡腤腠腷腜腩腛腢腲朡腞腶腧腯"],
["dfa1","腄腡舝艉艄艀艂艅蓱萿葖葶葹蒏蒍葥葑葀蒆葧萰葍葽葚葙葴葳葝蔇葞萷萺萴葺葃葸萲葅萩菙葋萯葂萭葟葰萹葎葌葒葯蓅蒎萻葇萶萳葨葾葄萫葠葔葮葐蜋蜄蛷蜌蛺蛖蛵蝍蛸蜎蜉蜁蛶蜍蜅裖裋裍裎裞裛裚裌裐覅覛觟觥觤"],
["e040","觡觠觢觜触詶誆詿詡訿詷誂誄詵誃誁詴詺谼豋豊豥豤豦貆貄貅賌赨赩趑趌趎趏趍趓趔趐趒跰跠跬跱跮跐跩跣跢跧跲跫跴輆軿輁輀輅輇輈輂輋遒逿"],
["e0a1","遄遉逽鄐鄍鄏鄑鄖鄔鄋鄎酮酯鉈鉒鈰鈺鉦鈳鉥鉞銃鈮鉊鉆鉭鉬鉏鉠鉧鉯鈶鉡鉰鈱鉔鉣鉐鉲鉎鉓鉌鉖鈲閟閜閞閛隒隓隑隗雎雺雽雸雵靳靷靸靲頏頍頎颬飶飹馯馲馰馵骭骫魛鳪鳭鳧麀黽僦僔僗僨僳僛僪僝僤僓僬僰僯僣僠"],
["e140","凘劀劁勩勫匰厬嘧嘕嘌嘒嗼嘏嘜嘁嘓嘂嗺嘝嘄嗿嗹墉塼墐墘墆墁塿塴墋塺墇墑墎塶墂墈塻墔墏壾奫嫜嫮嫥嫕嫪嫚嫭嫫嫳嫢嫠嫛嫬嫞嫝嫙嫨嫟孷寠"],
["e1a1","寣屣嶂嶀嵽嶆嵺嶁嵷嶊嶉嶈嵾嵼嶍嵹嵿幘幙幓廘廑廗廎廜廕廙廒廔彄彃彯徶愬愨慁慞慱慳慒慓慲慬憀慴慔慺慛慥愻慪慡慖戩戧戫搫摍摛摝摴摶摲摳摽摵摦撦摎撂摞摜摋摓摠摐摿搿摬摫摙摥摷敳斠暡暠暟朅朄朢榱榶槉"],
["e240","榠槎榖榰榬榼榑榙榎榧榍榩榾榯榿槄榽榤槔榹槊榚槏榳榓榪榡榞槙榗榐槂榵榥槆歊歍歋殞殟殠毃毄毾滎滵滱漃漥滸漷滻漮漉潎漙漚漧漘漻漒滭漊"],
["e2a1","漶潳滹滮漭潀漰漼漵滫漇漎潃漅滽滶漹漜滼漺漟漍漞漈漡熇熐熉熀熅熂熏煻熆熁熗牄牓犗犕犓獃獍獑獌瑢瑳瑱瑵瑲瑧瑮甀甂甃畽疐瘖瘈瘌瘕瘑瘊瘔皸瞁睼瞅瞂睮瞀睯睾瞃碲碪碴碭碨硾碫碞碥碠碬碢碤禘禊禋禖禕禔禓"],
["e340","禗禈禒禐稫穊稰稯稨稦窨窫窬竮箈箜箊箑箐箖箍箌箛箎箅箘劄箙箤箂粻粿粼粺綧綷緂綣綪緁緀緅綝緎緄緆緋緌綯綹綖綼綟綦綮綩綡緉罳翢翣翥翞"],
["e3a1","耤聝聜膉膆膃膇膍膌膋舕蒗蒤蒡蒟蒺蓎蓂蒬蒮蒫蒹蒴蓁蓍蒪蒚蒱蓐蒝蒧蒻蒢蒔蓇蓌蒛蒩蒯蒨蓖蒘蒶蓏蒠蓗蓔蓒蓛蒰蒑虡蜳蜣蜨蝫蝀蜮蜞蜡蜙蜛蝃蜬蝁蜾蝆蜠蜲蜪蜭蜼蜒蜺蜱蜵蝂蜦蜧蜸蜤蜚蜰蜑裷裧裱裲裺裾裮裼裶裻"],
["e440","裰裬裫覝覡覟覞觩觫觨誫誙誋誒誏誖谽豨豩賕賏賗趖踉踂跿踍跽踊踃踇踆踅跾踀踄輐輑輎輍鄣鄜鄠鄢鄟鄝鄚鄤鄡鄛酺酲酹酳銥銤鉶銛鉺銠銔銪銍"],
["e4a1","銦銚銫鉹銗鉿銣鋮銎銂銕銢鉽銈銡銊銆銌銙銧鉾銇銩銝銋鈭隞隡雿靘靽靺靾鞃鞀鞂靻鞄鞁靿韎韍頖颭颮餂餀餇馝馜駃馹馻馺駂馽駇骱髣髧鬾鬿魠魡魟鳱鳲鳵麧僿儃儰僸儆儇僶僾儋儌僽儊劋劌勱勯噈噂噌嘵噁噊噉噆噘"],
["e540","噚噀嘳嘽嘬嘾嘸嘪嘺圚墫墝墱墠墣墯墬墥墡壿嫿嫴嫽嫷嫶嬃嫸嬂嫹嬁嬇嬅嬏屧嶙嶗嶟嶒嶢嶓嶕嶠嶜嶡嶚嶞幩幝幠幜緳廛廞廡彉徲憋憃慹憱憰憢憉"],
["e5a1","憛憓憯憭憟憒憪憡憍慦憳戭摮摰撖撠撅撗撜撏撋撊撌撣撟摨撱撘敶敺敹敻斲斳暵暰暩暲暷暪暯樀樆樗槥槸樕槱槤樠槿槬槢樛樝槾樧槲槮樔槷槧橀樈槦槻樍槼槫樉樄樘樥樏槶樦樇槴樖歑殥殣殢殦氁氀毿氂潁漦潾澇濆澒"],
["e640","澍澉澌潢潏澅潚澖潶潬澂潕潲潒潐潗澔澓潝漀潡潫潽潧澐潓澋潩潿澕潣潷潪潻熲熯熛熰熠熚熩熵熝熥熞熤熡熪熜熧熳犘犚獘獒獞獟獠獝獛獡獚獙"],
["e6a1","獢璇璉璊璆璁瑽璅璈瑼瑹甈甇畾瘥瘞瘙瘝瘜瘣瘚瘨瘛皜皝皞皛瞍瞏瞉瞈磍碻磏磌磑磎磔磈磃磄磉禚禡禠禜禢禛歶稹窲窴窳箷篋箾箬篎箯箹篊箵糅糈糌糋緷緛緪緧緗緡縃緺緦緶緱緰緮緟罶羬羰羭翭翫翪翬翦翨聤聧膣膟"],
["e740","膞膕膢膙膗舖艏艓艒艐艎艑蔤蔻蔏蔀蔩蔎蔉蔍蔟蔊蔧蔜蓻蔫蓺蔈蔌蓴蔪蓲蔕蓷蓫蓳蓼蔒蓪蓩蔖蓾蔨蔝蔮蔂蓽蔞蓶蔱蔦蓧蓨蓰蓯蓹蔘蔠蔰蔋蔙蔯虢"],
["e7a1","蝖蝣蝤蝷蟡蝳蝘蝔蝛蝒蝡蝚蝑蝞蝭蝪蝐蝎蝟蝝蝯蝬蝺蝮蝜蝥蝏蝻蝵蝢蝧蝩衚褅褌褔褋褗褘褙褆褖褑褎褉覢覤覣觭觰觬諏諆誸諓諑諔諕誻諗誾諀諅諘諃誺誽諙谾豍貏賥賟賙賨賚賝賧趠趜趡趛踠踣踥踤踮踕踛踖踑踙踦踧"],
["e840","踔踒踘踓踜踗踚輬輤輘輚輠輣輖輗遳遰遯遧遫鄯鄫鄩鄪鄲鄦鄮醅醆醊醁醂醄醀鋐鋃鋄鋀鋙銶鋏鋱鋟鋘鋩鋗鋝鋌鋯鋂鋨鋊鋈鋎鋦鋍鋕鋉鋠鋞鋧鋑鋓"],
["e8a1","銵鋡鋆銴镼閬閫閮閰隤隢雓霅霈霂靚鞊鞎鞈韐韏頞頝頦頩頨頠頛頧颲餈飺餑餔餖餗餕駜駍駏駓駔駎駉駖駘駋駗駌骳髬髫髳髲髱魆魃魧魴魱魦魶魵魰魨魤魬鳼鳺鳽鳿鳷鴇鴀鳹鳻鴈鴅鴄麃黓鼏鼐儜儓儗儚儑凞匴叡噰噠噮"],
["e940","噳噦噣噭噲噞噷圜圛壈墽壉墿墺壂墼壆嬗嬙嬛嬡嬔嬓嬐嬖嬨嬚嬠嬞寯嶬嶱嶩嶧嶵嶰嶮嶪嶨嶲嶭嶯嶴幧幨幦幯廩廧廦廨廥彋徼憝憨憖懅憴懆懁懌憺"],
["e9a1","憿憸憌擗擖擐擏擉撽撉擃擛擳擙攳敿敼斢曈暾曀曊曋曏暽暻暺曌朣樴橦橉橧樲橨樾橝橭橶橛橑樨橚樻樿橁橪橤橐橏橔橯橩橠樼橞橖橕橍橎橆歕歔歖殧殪殫毈毇氄氃氆澭濋澣濇澼濎濈潞濄澽澞濊澨瀄澥澮澺澬澪濏澿澸"],
["ea40","澢濉澫濍澯澲澰燅燂熿熸燖燀燁燋燔燊燇燏熽燘熼燆燚燛犝犞獩獦獧獬獥獫獪瑿璚璠璔璒璕璡甋疀瘯瘭瘱瘽瘳瘼瘵瘲瘰皻盦瞚瞝瞡瞜瞛瞢瞣瞕瞙"],
["eaa1","瞗磝磩磥磪磞磣磛磡磢磭磟磠禤穄穈穇窶窸窵窱窷篞篣篧篝篕篥篚篨篹篔篪篢篜篫篘篟糒糔糗糐糑縒縡縗縌縟縠縓縎縜縕縚縢縋縏縖縍縔縥縤罃罻罼罺羱翯耪耩聬膱膦膮膹膵膫膰膬膴膲膷膧臲艕艖艗蕖蕅蕫蕍蕓蕡蕘"],
["eb40","蕀蕆蕤蕁蕢蕄蕑蕇蕣蔾蕛蕱蕎蕮蕵蕕蕧蕠薌蕦蕝蕔蕥蕬虣虥虤螛螏螗螓螒螈螁螖螘蝹螇螣螅螐螑螝螄螔螜螚螉褞褦褰褭褮褧褱褢褩褣褯褬褟觱諠"],
["eba1","諢諲諴諵諝謔諤諟諰諈諞諡諨諿諯諻貑貒貐賵賮賱賰賳赬赮趥趧踳踾踸蹀蹅踶踼踽蹁踰踿躽輶輮輵輲輹輷輴遶遹遻邆郺鄳鄵鄶醓醐醑醍醏錧錞錈錟錆錏鍺錸錼錛錣錒錁鍆錭錎錍鋋錝鋺錥錓鋹鋷錴錂錤鋿錩錹錵錪錔錌"],
["ec40","錋鋾錉錀鋻錖閼闍閾閹閺閶閿閵閽隩雔霋霒霐鞙鞗鞔韰韸頵頯頲餤餟餧餩馞駮駬駥駤駰駣駪駩駧骹骿骴骻髶髺髹髷鬳鮀鮅鮇魼魾魻鮂鮓鮒鮐魺鮕"],
["eca1","魽鮈鴥鴗鴠鴞鴔鴩鴝鴘鴢鴐鴙鴟麈麆麇麮麭黕黖黺鼒鼽儦儥儢儤儠儩勴嚓嚌嚍嚆嚄嚃噾嚂噿嚁壖壔壏壒嬭嬥嬲嬣嬬嬧嬦嬯嬮孻寱寲嶷幬幪徾徻懃憵憼懧懠懥懤懨懞擯擩擣擫擤擨斁斀斶旚曒檍檖檁檥檉檟檛檡檞檇檓檎"],
["ed40","檕檃檨檤檑橿檦檚檅檌檒歛殭氉濌澩濴濔濣濜濭濧濦濞濲濝濢濨燡燱燨燲燤燰燢獳獮獯璗璲璫璐璪璭璱璥璯甐甑甒甏疄癃癈癉癇皤盩瞵瞫瞲瞷瞶"],
["eda1","瞴瞱瞨矰磳磽礂磻磼磲礅磹磾礄禫禨穜穛穖穘穔穚窾竀竁簅簏篲簀篿篻簎篴簋篳簂簉簃簁篸篽簆篰篱簐簊糨縭縼繂縳顈縸縪繉繀繇縩繌縰縻縶繄縺罅罿罾罽翴翲耬膻臄臌臊臅臇膼臩艛艚艜薃薀薏薧薕薠薋薣蕻薤薚薞"],
["ee40","蕷蕼薉薡蕺蕸蕗薎薖薆薍薙薝薁薢薂薈薅蕹蕶薘薐薟虨螾螪螭蟅螰螬螹螵螼螮蟉蟃蟂蟌螷螯蟄蟊螴螶螿螸螽蟞螲褵褳褼褾襁襒褷襂覭覯覮觲觳謞"],
["eea1","謘謖謑謅謋謢謏謒謕謇謍謈謆謜謓謚豏豰豲豱豯貕貔賹赯蹎蹍蹓蹐蹌蹇轃轀邅遾鄸醚醢醛醙醟醡醝醠鎡鎃鎯鍤鍖鍇鍼鍘鍜鍶鍉鍐鍑鍠鍭鎏鍌鍪鍹鍗鍕鍒鍏鍱鍷鍻鍡鍞鍣鍧鎀鍎鍙闇闀闉闃闅閷隮隰隬霠霟霘霝霙鞚鞡鞜"],
["ef40","鞞鞝韕韔韱顁顄顊顉顅顃餥餫餬餪餳餲餯餭餱餰馘馣馡騂駺駴駷駹駸駶駻駽駾駼騃骾髾髽鬁髼魈鮚鮨鮞鮛鮦鮡鮥鮤鮆鮢鮠鮯鴳鵁鵧鴶鴮鴯鴱鴸鴰"],
["efa1","鵅鵂鵃鴾鴷鵀鴽翵鴭麊麉麍麰黈黚黻黿鼤鼣鼢齔龠儱儭儮嚘嚜嚗嚚嚝嚙奰嬼屩屪巀幭幮懘懟懭懮懱懪懰懫懖懩擿攄擽擸攁攃擼斔旛曚曛曘櫅檹檽櫡櫆檺檶檷櫇檴檭歞毉氋瀇瀌瀍瀁瀅瀔瀎濿瀀濻瀦濼濷瀊爁燿燹爃燽獶"],
["f040","璸瓀璵瓁璾璶璻瓂甔甓癜癤癙癐癓癗癚皦皽盬矂瞺磿礌礓礔礉礐礒礑禭禬穟簜簩簙簠簟簭簝簦簨簢簥簰繜繐繖繣繘繢繟繑繠繗繓羵羳翷翸聵臑臒"],
["f0a1","臐艟艞薴藆藀藃藂薳薵薽藇藄薿藋藎藈藅薱薶藒蘤薸薷薾虩蟧蟦蟢蟛蟫蟪蟥蟟蟳蟤蟔蟜蟓蟭蟘蟣螤蟗蟙蠁蟴蟨蟝襓襋襏襌襆襐襑襉謪謧謣謳謰謵譇謯謼謾謱謥謷謦謶謮謤謻謽謺豂豵貙貘貗賾贄贂贀蹜蹢蹠蹗蹖蹞蹥蹧"],
["f140","蹛蹚蹡蹝蹩蹔轆轇轈轋鄨鄺鄻鄾醨醥醧醯醪鎵鎌鎒鎷鎛鎝鎉鎧鎎鎪鎞鎦鎕鎈鎙鎟鎍鎱鎑鎲鎤鎨鎴鎣鎥闒闓闑隳雗雚巂雟雘雝霣霢霥鞬鞮鞨鞫鞤鞪"],
["f1a1","鞢鞥韗韙韖韘韺顐顑顒颸饁餼餺騏騋騉騍騄騑騊騅騇騆髀髜鬈鬄鬅鬩鬵魊魌魋鯇鯆鯃鮿鯁鮵鮸鯓鮶鯄鮹鮽鵜鵓鵏鵊鵛鵋鵙鵖鵌鵗鵒鵔鵟鵘鵚麎麌黟鼁鼀鼖鼥鼫鼪鼩鼨齌齕儴儵劖勷厴嚫嚭嚦嚧嚪嚬壚壝壛夒嬽嬾嬿巃幰"],
["f240","徿懻攇攐攍攉攌攎斄旞旝曞櫧櫠櫌櫑櫙櫋櫟櫜櫐櫫櫏櫍櫞歠殰氌瀙瀧瀠瀖瀫瀡瀢瀣瀩瀗瀤瀜瀪爌爊爇爂爅犥犦犤犣犡瓋瓅璷瓃甖癠矉矊矄矱礝礛"],
["f2a1","礡礜礗礞禰穧穨簳簼簹簬簻糬糪繶繵繸繰繷繯繺繲繴繨罋罊羃羆羷翽翾聸臗臕艤艡艣藫藱藭藙藡藨藚藗藬藲藸藘藟藣藜藑藰藦藯藞藢蠀蟺蠃蟶蟷蠉蠌蠋蠆蟼蠈蟿蠊蠂襢襚襛襗襡襜襘襝襙覈覷覶觶譐譈譊譀譓譖譔譋譕"],
["f340","譑譂譒譗豃豷豶貚贆贇贉趬趪趭趫蹭蹸蹳蹪蹯蹻軂轒轑轏轐轓辴酀鄿醰醭鏞鏇鏏鏂鏚鏐鏹鏬鏌鏙鎩鏦鏊鏔鏮鏣鏕鏄鏎鏀鏒鏧镽闚闛雡霩霫霬霨霦"],
["f3a1","鞳鞷鞶韝韞韟顜顙顝顗颿颽颻颾饈饇饃馦馧騚騕騥騝騤騛騢騠騧騣騞騜騔髂鬋鬊鬎鬌鬷鯪鯫鯠鯞鯤鯦鯢鯰鯔鯗鯬鯜鯙鯥鯕鯡鯚鵷鶁鶊鶄鶈鵱鶀鵸鶆鶋鶌鵽鵫鵴鵵鵰鵩鶅鵳鵻鶂鵯鵹鵿鶇鵨麔麑黀黼鼭齀齁齍齖齗齘匷嚲"],
["f440","嚵嚳壣孅巆巇廮廯忀忁懹攗攖攕攓旟曨曣曤櫳櫰櫪櫨櫹櫱櫮櫯瀼瀵瀯瀷瀴瀱灂瀸瀿瀺瀹灀瀻瀳灁爓爔犨獽獼璺皫皪皾盭矌矎矏矍矲礥礣礧礨礤礩"],
["f4a1","禲穮穬穭竷籉籈籊籇籅糮繻繾纁纀羺翿聹臛臙舋艨艩蘢藿蘁藾蘛蘀藶蘄蘉蘅蘌藽蠙蠐蠑蠗蠓蠖襣襦覹觷譠譪譝譨譣譥譧譭趮躆躈躄轙轖轗轕轘轚邍酃酁醷醵醲醳鐋鐓鏻鐠鐏鐔鏾鐕鐐鐨鐙鐍鏵鐀鏷鐇鐎鐖鐒鏺鐉鏸鐊鏿"],
["f540","鏼鐌鏶鐑鐆闞闠闟霮霯鞹鞻韽韾顠顢顣顟飁飂饐饎饙饌饋饓騲騴騱騬騪騶騩騮騸騭髇髊髆鬐鬒鬑鰋鰈鯷鰅鰒鯸鱀鰇鰎鰆鰗鰔鰉鶟鶙鶤鶝鶒鶘鶐鶛"],
["f5a1","鶠鶔鶜鶪鶗鶡鶚鶢鶨鶞鶣鶿鶩鶖鶦鶧麙麛麚黥黤黧黦鼰鼮齛齠齞齝齙龑儺儹劘劗囃嚽嚾孈孇巋巏廱懽攛欂櫼欃櫸欀灃灄灊灈灉灅灆爝爚爙獾甗癪矐礭礱礯籔籓糲纊纇纈纋纆纍罍羻耰臝蘘蘪蘦蘟蘣蘜蘙蘧蘮蘡蘠蘩蘞蘥"],
["f640","蠩蠝蠛蠠蠤蠜蠫衊襭襩襮襫觺譹譸譅譺譻贐贔趯躎躌轞轛轝酆酄酅醹鐿鐻鐶鐩鐽鐼鐰鐹鐪鐷鐬鑀鐱闥闤闣霵霺鞿韡顤飉飆飀饘饖騹騽驆驄驂驁騺"],
["f6a1","騿髍鬕鬗鬘鬖鬺魒鰫鰝鰜鰬鰣鰨鰩鰤鰡鶷鶶鶼鷁鷇鷊鷏鶾鷅鷃鶻鶵鷎鶹鶺鶬鷈鶱鶭鷌鶳鷍鶲鹺麜黫黮黭鼛鼘鼚鼱齎齥齤龒亹囆囅囋奱孋孌巕巑廲攡攠攦攢欋欈欉氍灕灖灗灒爞爟犩獿瓘瓕瓙瓗癭皭礵禴穰穱籗籜籙籛籚"],
["f740","糴糱纑罏羇臞艫蘴蘵蘳蘬蘲蘶蠬蠨蠦蠪蠥襱覿覾觻譾讄讂讆讅譿贕躕躔躚躒躐躖躗轠轢酇鑌鑐鑊鑋鑏鑇鑅鑈鑉鑆霿韣顪顩飋饔饛驎驓驔驌驏驈驊"],
["f7a1","驉驒驐髐鬙鬫鬻魖魕鱆鱈鰿鱄鰹鰳鱁鰼鰷鰴鰲鰽鰶鷛鷒鷞鷚鷋鷐鷜鷑鷟鷩鷙鷘鷖鷵鷕鷝麶黰鼵鼳鼲齂齫龕龢儽劙壨壧奲孍巘蠯彏戁戃戄攩攥斖曫欑欒欏毊灛灚爢玂玁玃癰矔籧籦纕艬蘺虀蘹蘼蘱蘻蘾蠰蠲蠮蠳襶襴襳觾"],
["f840","讌讎讋讈豅贙躘轤轣醼鑢鑕鑝鑗鑞韄韅頀驖驙鬞鬟鬠鱒鱘鱐鱊鱍鱋鱕鱙鱌鱎鷻鷷鷯鷣鷫鷸鷤鷶鷡鷮鷦鷲鷰鷢鷬鷴鷳鷨鷭黂黐黲黳鼆鼜鼸鼷鼶齃齏"],
["f8a1","齱齰齮齯囓囍孎屭攭曭曮欓灟灡灝灠爣瓛瓥矕礸禷禶籪纗羉艭虃蠸蠷蠵衋讔讕躞躟躠躝醾醽釂鑫鑨鑩雥靆靃靇韇韥驞髕魙鱣鱧鱦鱢鱞鱠鸂鷾鸇鸃鸆鸅鸀鸁鸉鷿鷽鸄麠鼞齆齴齵齶囔攮斸欘欙欗欚灢爦犪矘矙礹籩籫糶纚"],
["f940","纘纛纙臠臡虆虇虈襹襺襼襻觿讘讙躥躤躣鑮鑭鑯鑱鑳靉顲饟鱨鱮鱭鸋鸍鸐鸏鸒鸑麡黵鼉齇齸齻齺齹圞灦籯蠼趲躦釃鑴鑸鑶鑵驠鱴鱳鱱鱵鸔鸓黶鼊"],
["f9a1","龤灨灥糷虪蠾蠽蠿讞貜躩軉靋顳顴飌饡馫驤驦驧鬤鸕鸗齈戇欞爧虌躨钂钀钁驩驨鬮鸙爩虋讟钃鱹麷癵驫鱺鸝灩灪麤齾齉龘碁銹裏墻恒粧嫺╔╦╗╠╬╣╚╩╝╒╤╕╞╪╡╘╧╛╓╥╖╟╫╢╙╨╜║═╭╮╰╯▓"]
]

},{}],25:[function(require,module,exports){
module.exports=[
["0","\u0000",127],
["8ea1","｡",62],
["a1a1","　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",9,"＋－±×÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇"],
["a2a1","◆□■△▲▽▼※〒→←↑↓〓"],
["a2ba","∈∋⊆⊇⊂⊃∪∩"],
["a2ca","∧∨￢⇒⇔∀∃"],
["a2dc","∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
["a2f2","Å‰♯♭♪†‡¶"],
["a2fe","◯"],
["a3b0","０",9],
["a3c1","Ａ",25],
["a3e1","ａ",25],
["a4a1","ぁ",82],
["a5a1","ァ",85],
["a6a1","Α",16,"Σ",6],
["a6c1","α",16,"σ",6],
["a7a1","А",5,"ЁЖ",25],
["a7d1","а",5,"ёж",25],
["a8a1","─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
["ada1","①",19,"Ⅰ",9],
["adc0","㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
["addf","㍻〝〟№㏍℡㊤",4,"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"],
["b0a1","亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
["b1a1","院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応"],
["b2a1","押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
["b3a1","魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱"],
["b4a1","粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
["b5a1","機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京"],
["b6a1","供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
["b7a1","掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲"],
["b8a1","検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
["b9a1","后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込"],
["baa1","此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
["bba1","察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時"],
["bca1","次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
["bda1","宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償"],
["bea1","勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
["bfa1","拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾"],
["c0a1","澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
["c1a1","繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎"],
["c2a1","臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
["c3a1","叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵"],
["c4a1","帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
["c5a1","邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到"],
["c6a1","董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
["c7a1","如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦"],
["c8a1","函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
["c9a1","鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服"],
["caa1","福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
["cba1","法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満"],
["cca1","漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
["cda1","諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃"],
["cea1","痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
["cfa1","蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
["d0a1","弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
["d1a1","僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨"],
["d2a1","辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
["d3a1","咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉"],
["d4a1","圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
["d5a1","奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓"],
["d6a1","屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
["d7a1","廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚"],
["d8a1","悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
["d9a1","戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼"],
["daa1","據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
["dba1","曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍"],
["dca1","棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
["dda1","檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾"],
["dea1","沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
["dfa1","漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼"],
["e0a1","燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
["e1a1","瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰"],
["e2a1","癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
["e3a1","磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐"],
["e4a1","筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
["e5a1","紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺"],
["e6a1","罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
["e7a1","隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙"],
["e8a1","茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
["e9a1","蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙"],
["eaa1","蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
["eba1","襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫"],
["eca1","譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
["eda1","蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸"],
["eea1","遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
["efa1","錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞"],
["f0a1","陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
["f1a1","顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷"],
["f2a1","髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
["f3a1","鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠"],
["f4a1","堯槇遙瑤凜熙"],
["f9a1","纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德"],
["faa1","忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
["fba1","犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚"],
["fca1","釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
["fcf1","ⅰ",9,"￢￤＇＂"],
["8fa2af","˘ˇ¸˙˝¯˛˚～΄΅"],
["8fa2c2","¡¦¿"],
["8fa2eb","ºª©®™¤№"],
["8fa6e1","ΆΈΉΊΪ"],
["8fa6e7","Ό"],
["8fa6e9","ΎΫ"],
["8fa6ec","Ώ"],
["8fa6f1","άέήίϊΐόςύϋΰώ"],
["8fa7c2","Ђ",10,"ЎЏ"],
["8fa7f2","ђ",10,"ўџ"],
["8fa9a1","ÆĐ"],
["8fa9a4","Ħ"],
["8fa9a6","Ĳ"],
["8fa9a8","ŁĿ"],
["8fa9ab","ŊØŒ"],
["8fa9af","ŦÞ"],
["8fa9c1","æđðħıĳĸłŀŉŋøœßŧþ"],
["8faaa1","ÁÀÄÂĂǍĀĄÅÃĆĈČÇĊĎÉÈËÊĚĖĒĘ"],
["8faaba","ĜĞĢĠĤÍÌÏÎǏİĪĮĨĴĶĹĽĻŃŇŅÑÓÒÖÔǑŐŌÕŔŘŖŚŜŠŞŤŢÚÙÜÛŬǓŰŪŲŮŨǗǛǙǕŴÝŸŶŹŽŻ"],
["8faba1","áàäâăǎāąåãćĉčçċďéèëêěėēęǵĝğ"],
["8fabbd","ġĥíìïîǐ"],
["8fabc5","īįĩĵķĺľļńňņñóòöôǒőōõŕřŗśŝšşťţúùüûŭǔűūųůũǘǜǚǖŵýÿŷźžż"],
["8fb0a1","丂丄丅丌丒丟丣两丨丫丮丯丰丵乀乁乄乇乑乚乜乣乨乩乴乵乹乿亍亖亗亝亯亹仃仐仚仛仠仡仢仨仯仱仳仵份仾仿伀伂伃伈伋伌伒伕伖众伙伮伱你伳伵伷伹伻伾佀佂佈佉佋佌佒佔佖佘佟佣佪佬佮佱佷佸佹佺佽佾侁侂侄"],
["8fb1a1","侅侉侊侌侎侐侒侓侔侗侙侚侞侟侲侷侹侻侼侽侾俀俁俅俆俈俉俋俌俍俏俒俜俠俢俰俲俼俽俿倀倁倄倇倊倌倎倐倓倗倘倛倜倝倞倢倧倮倰倲倳倵偀偁偂偅偆偊偌偎偑偒偓偗偙偟偠偢偣偦偧偪偭偰偱倻傁傃傄傆傊傎傏傐"],
["8fb2a1","傒傓傔傖傛傜傞",4,"傪傯傰傹傺傽僀僃僄僇僌僎僐僓僔僘僜僝僟僢僤僦僨僩僯僱僶僺僾儃儆儇儈儋儌儍儎僲儐儗儙儛儜儝儞儣儧儨儬儭儯儱儳儴儵儸儹兂兊兏兓兕兗兘兟兤兦兾冃冄冋冎冘冝冡冣冭冸冺冼冾冿凂"],
["8fb3a1","凈减凑凒凓凕凘凞凢凥凮凲凳凴凷刁刂刅划刓刕刖刘刢刨刱刲刵刼剅剉剕剗剘剚剜剟剠剡剦剮剷剸剹劀劂劅劊劌劓劕劖劗劘劚劜劤劥劦劧劯劰劶劷劸劺劻劽勀勄勆勈勌勏勑勔勖勛勜勡勥勨勩勪勬勰勱勴勶勷匀匃匊匋"],
["8fb4a1","匌匑匓匘匛匜匞匟匥匧匨匩匫匬匭匰匲匵匼匽匾卂卌卋卙卛卡卣卥卬卭卲卹卾厃厇厈厎厓厔厙厝厡厤厪厫厯厲厴厵厷厸厺厽叀叅叏叒叓叕叚叝叞叠另叧叵吂吓吚吡吧吨吪启吱吴吵呃呄呇呍呏呞呢呤呦呧呩呫呭呮呴呿"],
["8fb5a1","咁咃咅咈咉咍咑咕咖咜咟咡咦咧咩咪咭咮咱咷咹咺咻咿哆哊响哎哠哪哬哯哶哼哾哿唀唁唅唈唉唌唍唎唕唪唫唲唵唶唻唼唽啁啇啉啊啍啐啑啘啚啛啞啠啡啤啦啿喁喂喆喈喎喏喑喒喓喔喗喣喤喭喲喿嗁嗃嗆嗉嗋嗌嗎嗑嗒"],
["8fb6a1","嗓嗗嗘嗛嗞嗢嗩嗶嗿嘅嘈嘊嘍",5,"嘙嘬嘰嘳嘵嘷嘹嘻嘼嘽嘿噀噁噃噄噆噉噋噍噏噔噞噠噡噢噣噦噩噭噯噱噲噵嚄嚅嚈嚋嚌嚕嚙嚚嚝嚞嚟嚦嚧嚨嚩嚫嚬嚭嚱嚳嚷嚾囅囉囊囋囏囐囌囍囙囜囝囟囡囤",4,"囱囫园"],
["8fb7a1","囶囷圁圂圇圊圌圑圕圚圛圝圠圢圣圤圥圩圪圬圮圯圳圴圽圾圿坅坆坌坍坒坢坥坧坨坫坭",4,"坳坴坵坷坹坺坻坼坾垁垃垌垔垗垙垚垜垝垞垟垡垕垧垨垩垬垸垽埇埈埌埏埕埝埞埤埦埧埩埭埰埵埶埸埽埾埿堃堄堈堉埡"],
["8fb8a1","堌堍堛堞堟堠堦堧堭堲堹堿塉塌塍塏塐塕塟塡塤塧塨塸塼塿墀墁墇墈墉墊墌墍墏墐墔墖墝墠墡墢墦墩墱墲壄墼壂壈壍壎壐壒壔壖壚壝壡壢壩壳夅夆夋夌夒夓夔虁夝夡夣夤夨夯夰夳夵夶夿奃奆奒奓奙奛奝奞奟奡奣奫奭"],
["8fb9a1","奯奲奵奶她奻奼妋妌妎妒妕妗妟妤妧妭妮妯妰妳妷妺妼姁姃姄姈姊姍姒姝姞姟姣姤姧姮姯姱姲姴姷娀娄娌娍娎娒娓娞娣娤娧娨娪娭娰婄婅婇婈婌婐婕婞婣婥婧婭婷婺婻婾媋媐媓媖媙媜媞媟媠媢媧媬媱媲媳媵媸媺媻媿"],
["8fbaa1","嫄嫆嫈嫏嫚嫜嫠嫥嫪嫮嫵嫶嫽嬀嬁嬈嬗嬴嬙嬛嬝嬡嬥嬭嬸孁孋孌孒孖孞孨孮孯孼孽孾孿宁宄宆宊宎宐宑宓宔宖宨宩宬宭宯宱宲宷宺宼寀寁寍寏寖",4,"寠寯寱寴寽尌尗尞尟尣尦尩尫尬尮尰尲尵尶屙屚屜屢屣屧屨屩"],
["8fbba1","屭屰屴屵屺屻屼屽岇岈岊岏岒岝岟岠岢岣岦岪岲岴岵岺峉峋峒峝峗峮峱峲峴崁崆崍崒崫崣崤崦崧崱崴崹崽崿嵂嵃嵆嵈嵕嵑嵙嵊嵟嵠嵡嵢嵤嵪嵭嵰嵹嵺嵾嵿嶁嶃嶈嶊嶒嶓嶔嶕嶙嶛嶟嶠嶧嶫嶰嶴嶸嶹巃巇巋巐巎巘巙巠巤"],
["8fbca1","巩巸巹帀帇帍帒帔帕帘帟帠帮帨帲帵帾幋幐幉幑幖幘幛幜幞幨幪",4,"幰庀庋庎庢庤庥庨庪庬庱庳庽庾庿廆廌廋廎廑廒廔廕廜廞廥廫异弆弇弈弎弙弜弝弡弢弣弤弨弫弬弮弰弴弶弻弽弿彀彄彅彇彍彐彔彘彛彠彣彤彧"],
["8fbda1","彯彲彴彵彸彺彽彾徉徍徏徖徜徝徢徧徫徤徬徯徰徱徸忄忇忈忉忋忐",4,"忞忡忢忨忩忪忬忭忮忯忲忳忶忺忼怇怊怍怓怔怗怘怚怟怤怭怳怵恀恇恈恉恌恑恔恖恗恝恡恧恱恾恿悂悆悈悊悎悑悓悕悘悝悞悢悤悥您悰悱悷"],
["8fbea1","悻悾惂惄惈惉惊惋惎惏惔惕惙惛惝惞惢惥惲惵惸惼惽愂愇愊愌愐",4,"愖愗愙愜愞愢愪愫愰愱愵愶愷愹慁慅慆慉慞慠慬慲慸慻慼慿憀憁憃憄憋憍憒憓憗憘憜憝憟憠憥憨憪憭憸憹憼懀懁懂懎懏懕懜懝懞懟懡懢懧懩懥"],
["8fbfa1","懬懭懯戁戃戄戇戓戕戜戠戢戣戧戩戫戹戽扂扃扄扆扌扐扑扒扔扖扚扜扤扭扯扳扺扽抍抎抏抐抦抨抳抶抷抺抾抿拄拎拕拖拚拪拲拴拼拽挃挄挊挋挍挐挓挖挘挩挪挭挵挶挹挼捁捂捃捄捆捊捋捎捒捓捔捘捛捥捦捬捭捱捴捵"],
["8fc0a1","捸捼捽捿掂掄掇掊掐掔掕掙掚掞掤掦掭掮掯掽揁揅揈揎揑揓揔揕揜揠揥揪揬揲揳揵揸揹搉搊搐搒搔搘搞搠搢搤搥搩搪搯搰搵搽搿摋摏摑摒摓摔摚摛摜摝摟摠摡摣摭摳摴摻摽撅撇撏撐撑撘撙撛撝撟撡撣撦撨撬撳撽撾撿"],
["8fc1a1","擄擉擊擋擌擎擐擑擕擗擤擥擩擪擭擰擵擷擻擿攁攄攈攉攊攏攓攔攖攙攛攞攟攢攦攩攮攱攺攼攽敃敇敉敐敒敔敟敠敧敫敺敽斁斅斊斒斕斘斝斠斣斦斮斲斳斴斿旂旈旉旎旐旔旖旘旟旰旲旴旵旹旾旿昀昄昈昉昍昑昒昕昖昝"],
["8fc2a1","昞昡昢昣昤昦昩昪昫昬昮昰昱昳昹昷晀晅晆晊晌晑晎晗晘晙晛晜晠晡曻晪晫晬晾晳晵晿晷晸晹晻暀晼暋暌暍暐暒暙暚暛暜暟暠暤暭暱暲暵暻暿曀曂曃曈曌曎曏曔曛曟曨曫曬曮曺朅朇朎朓朙朜朠朢朳朾杅杇杈杌杔杕杝"],
["8fc3a1","杦杬杮杴杶杻极构枎枏枑枓枖枘枙枛枰枱枲枵枻枼枽柹柀柂柃柅柈柉柒柗柙柜柡柦柰柲柶柷桒栔栙栝栟栨栧栬栭栯栰栱栳栻栿桄桅桊桌桕桗桘桛桫桮",4,"桵桹桺桻桼梂梄梆梈梖梘梚梜梡梣梥梩梪梮梲梻棅棈棌棏"],
["8fc4a1","棐棑棓棖棙棜棝棥棨棪棫棬棭棰棱棵棶棻棼棽椆椉椊椐椑椓椖椗椱椳椵椸椻楂楅楉楎楗楛楣楤楥楦楨楩楬楰楱楲楺楻楿榀榍榒榖榘榡榥榦榨榫榭榯榷榸榺榼槅槈槑槖槗槢槥槮槯槱槳槵槾樀樁樃樏樑樕樚樝樠樤樨樰樲"],
["8fc5a1","樴樷樻樾樿橅橆橉橊橎橐橑橒橕橖橛橤橧橪橱橳橾檁檃檆檇檉檋檑檛檝檞檟檥檫檯檰檱檴檽檾檿櫆櫉櫈櫌櫐櫔櫕櫖櫜櫝櫤櫧櫬櫰櫱櫲櫼櫽欂欃欆欇欉欏欐欑欗欛欞欤欨欫欬欯欵欶欻欿歆歊歍歒歖歘歝歠歧歫歮歰歵歽"],
["8fc6a1","歾殂殅殗殛殟殠殢殣殨殩殬殭殮殰殸殹殽殾毃毄毉毌毖毚毡毣毦毧毮毱毷毹毿氂氄氅氉氍氎氐氒氙氟氦氧氨氬氮氳氵氶氺氻氿汊汋汍汏汒汔汙汛汜汫汭汯汴汶汸汹汻沅沆沇沉沔沕沗沘沜沟沰沲沴泂泆泍泏泐泑泒泔泖"],
["8fc7a1","泚泜泠泧泩泫泬泮泲泴洄洇洊洎洏洑洓洚洦洧洨汧洮洯洱洹洼洿浗浞浟浡浥浧浯浰浼涂涇涑涒涔涖涗涘涪涬涴涷涹涽涿淄淈淊淎淏淖淛淝淟淠淢淥淩淯淰淴淶淼渀渄渞渢渧渲渶渹渻渼湄湅湈湉湋湏湑湒湓湔湗湜湝湞"],
["8fc8a1","湢湣湨湳湻湽溍溓溙溠溧溭溮溱溳溻溿滀滁滃滇滈滊滍滎滏滫滭滮滹滻滽漄漈漊漌漍漖漘漚漛漦漩漪漯漰漳漶漻漼漭潏潑潒潓潗潙潚潝潞潡潢潨潬潽潾澃澇澈澋澌澍澐澒澓澔澖澚澟澠澥澦澧澨澮澯澰澵澶澼濅濇濈濊"],
["8fc9a1","濚濞濨濩濰濵濹濼濽瀀瀅瀆瀇瀍瀗瀠瀣瀯瀴瀷瀹瀼灃灄灈灉灊灋灔灕灝灞灎灤灥灬灮灵灶灾炁炅炆炔",4,"炛炤炫炰炱炴炷烊烑烓烔烕烖烘烜烤烺焃",4,"焋焌焏焞焠焫焭焯焰焱焸煁煅煆煇煊煋煐煒煗煚煜煞煠"],
["8fcaa1","煨煹熀熅熇熌熒熚熛熠熢熯熰熲熳熺熿燀燁燄燋燌燓燖燙燚燜燸燾爀爇爈爉爓爗爚爝爟爤爫爯爴爸爹牁牂牃牅牎牏牐牓牕牖牚牜牞牠牣牨牫牮牯牱牷牸牻牼牿犄犉犍犎犓犛犨犭犮犱犴犾狁狇狉狌狕狖狘狟狥狳狴狺狻"],
["8fcba1","狾猂猄猅猇猋猍猒猓猘猙猞猢猤猧猨猬猱猲猵猺猻猽獃獍獐獒獖獘獝獞獟獠獦獧獩獫獬獮獯獱獷獹獼玀玁玃玅玆玎玐玓玕玗玘玜玞玟玠玢玥玦玪玫玭玵玷玹玼玽玿珅珆珉珋珌珏珒珓珖珙珝珡珣珦珧珩珴珵珷珹珺珻珽"],
["8fcca1","珿琀琁琄琇琊琑琚琛琤琦琨",9,"琹瑀瑃瑄瑆瑇瑋瑍瑑瑒瑗瑝瑢瑦瑧瑨瑫瑭瑮瑱瑲璀璁璅璆璇璉璏璐璑璒璘璙璚璜璟璠璡璣璦璨璩璪璫璮璯璱璲璵璹璻璿瓈瓉瓌瓐瓓瓘瓚瓛瓞瓟瓤瓨瓪瓫瓯瓴瓺瓻瓼瓿甆"],
["8fcda1","甒甖甗甠甡甤甧甩甪甯甶甹甽甾甿畀畃畇畈畎畐畒畗畞畟畡畯畱畹",5,"疁疅疐疒疓疕疙疜疢疤疴疺疿痀痁痄痆痌痎痏痗痜痟痠痡痤痧痬痮痯痱痹瘀瘂瘃瘄瘇瘈瘊瘌瘏瘒瘓瘕瘖瘙瘛瘜瘝瘞瘣瘥瘦瘩瘭瘲瘳瘵瘸瘹"],
["8fcea1","瘺瘼癊癀癁癃癄癅癉癋癕癙癟癤癥癭癮癯癱癴皁皅皌皍皕皛皜皝皟皠皢",6,"皪皭皽盁盅盉盋盌盎盔盙盠盦盨盬盰盱盶盹盼眀眆眊眎眒眔眕眗眙眚眜眢眨眭眮眯眴眵眶眹眽眾睂睅睆睊睍睎睏睒睖睗睜睞睟睠睢"],
["8fcfa1","睤睧睪睬睰睲睳睴睺睽瞀瞄瞌瞍瞔瞕瞖瞚瞟瞢瞧瞪瞮瞯瞱瞵瞾矃矉矑矒矕矙矞矟矠矤矦矪矬矰矱矴矸矻砅砆砉砍砎砑砝砡砢砣砭砮砰砵砷硃硄硇硈硌硎硒硜硞硠硡硣硤硨硪确硺硾碊碏碔碘碡碝碞碟碤碨碬碭碰碱碲碳"],
["8fd0a1","碻碽碿磇磈磉磌磎磒磓磕磖磤磛磟磠磡磦磪磲磳礀磶磷磺磻磿礆礌礐礚礜礞礟礠礥礧礩礭礱礴礵礻礽礿祄祅祆祊祋祏祑祔祘祛祜祧祩祫祲祹祻祼祾禋禌禑禓禔禕禖禘禛禜禡禨禩禫禯禱禴禸离秂秄秇秈秊秏秔秖秚秝秞"],
["8fd1a1","秠秢秥秪秫秭秱秸秼稂稃稇稉稊稌稑稕稛稞稡稧稫稭稯稰稴稵稸稹稺穄穅穇穈穌穕穖穙穜穝穟穠穥穧穪穭穵穸穾窀窂窅窆窊窋窐窑窔窞窠窣窬窳窵窹窻窼竆竉竌竎竑竛竨竩竫竬竱竴竻竽竾笇笔笟笣笧笩笪笫笭笮笯笰"],
["8fd2a1","笱笴笽笿筀筁筇筎筕筠筤筦筩筪筭筯筲筳筷箄箉箎箐箑箖箛箞箠箥箬箯箰箲箵箶箺箻箼箽篂篅篈篊篔篖篗篙篚篛篨篪篲篴篵篸篹篺篼篾簁簂簃簄簆簉簋簌簎簏簙簛簠簥簦簨簬簱簳簴簶簹簺籆籊籕籑籒籓籙",5],
["8fd3a1","籡籣籧籩籭籮籰籲籹籼籽粆粇粏粔粞粠粦粰粶粷粺粻粼粿糄糇糈糉糍糏糓糔糕糗糙糚糝糦糩糫糵紃紇紈紉紏紑紒紓紖紝紞紣紦紪紭紱紼紽紾絀絁絇絈絍絑絓絗絙絚絜絝絥絧絪絰絸絺絻絿綁綂綃綅綆綈綋綌綍綑綖綗綝"],
["8fd4a1","綞綦綧綪綳綶綷綹緂",4,"緌緍緎緗緙縀緢緥緦緪緫緭緱緵緶緹緺縈縐縑縕縗縜縝縠縧縨縬縭縯縳縶縿繄繅繇繎繐繒繘繟繡繢繥繫繮繯繳繸繾纁纆纇纊纍纑纕纘纚纝纞缼缻缽缾缿罃罄罇罏罒罓罛罜罝罡罣罤罥罦罭"],
["8fd5a1","罱罽罾罿羀羋羍羏羐羑羖羗羜羡羢羦羪羭羴羼羿翀翃翈翎翏翛翟翣翥翨翬翮翯翲翺翽翾翿耇耈耊耍耎耏耑耓耔耖耝耞耟耠耤耦耬耮耰耴耵耷耹耺耼耾聀聄聠聤聦聭聱聵肁肈肎肜肞肦肧肫肸肹胈胍胏胒胔胕胗胘胠胭胮"],
["8fd6a1","胰胲胳胶胹胺胾脃脋脖脗脘脜脞脠脤脧脬脰脵脺脼腅腇腊腌腒腗腠腡腧腨腩腭腯腷膁膐膄膅膆膋膎膖膘膛膞膢膮膲膴膻臋臃臅臊臎臏臕臗臛臝臞臡臤臫臬臰臱臲臵臶臸臹臽臿舀舃舏舓舔舙舚舝舡舢舨舲舴舺艃艄艅艆"],
["8fd7a1","艋艎艏艑艖艜艠艣艧艭艴艻艽艿芀芁芃芄芇芉芊芎芑芔芖芘芚芛芠芡芣芤芧芨芩芪芮芰芲芴芷芺芼芾芿苆苐苕苚苠苢苤苨苪苭苯苶苷苽苾茀茁茇茈茊茋荔茛茝茞茟茡茢茬茭茮茰茳茷茺茼茽荂荃荄荇荍荎荑荕荖荗荰荸"],
["8fd8a1","荽荿莀莂莄莆莍莒莔莕莘莙莛莜莝莦莧莩莬莾莿菀菇菉菏菐菑菔菝荓菨菪菶菸菹菼萁萆萊萏萑萕萙莭萯萹葅葇葈葊葍葏葑葒葖葘葙葚葜葠葤葥葧葪葰葳葴葶葸葼葽蒁蒅蒒蒓蒕蒞蒦蒨蒩蒪蒯蒱蒴蒺蒽蒾蓀蓂蓇蓈蓌蓏蓓"],
["8fd9a1","蓜蓧蓪蓯蓰蓱蓲蓷蔲蓺蓻蓽蔂蔃蔇蔌蔎蔐蔜蔞蔢蔣蔤蔥蔧蔪蔫蔯蔳蔴蔶蔿蕆蕏",4,"蕖蕙蕜",6,"蕤蕫蕯蕹蕺蕻蕽蕿薁薅薆薉薋薌薏薓薘薝薟薠薢薥薧薴薶薷薸薼薽薾薿藂藇藊藋藎薭藘藚藟藠藦藨藭藳藶藼"],
["8fdaa1","藿蘀蘄蘅蘍蘎蘐蘑蘒蘘蘙蘛蘞蘡蘧蘩蘶蘸蘺蘼蘽虀虂虆虒虓虖虗虘虙虝虠",4,"虩虬虯虵虶虷虺蚍蚑蚖蚘蚚蚜蚡蚦蚧蚨蚭蚱蚳蚴蚵蚷蚸蚹蚿蛀蛁蛃蛅蛑蛒蛕蛗蛚蛜蛠蛣蛥蛧蚈蛺蛼蛽蜄蜅蜇蜋蜎蜏蜐蜓蜔蜙蜞蜟蜡蜣"],
["8fdba1","蜨蜮蜯蜱蜲蜹蜺蜼蜽蜾蝀蝃蝅蝍蝘蝝蝡蝤蝥蝯蝱蝲蝻螃",6,"螋螌螐螓螕螗螘螙螞螠螣螧螬螭螮螱螵螾螿蟁蟈蟉蟊蟎蟕蟖蟙蟚蟜蟟蟢蟣蟤蟪蟫蟭蟱蟳蟸蟺蟿蠁蠃蠆蠉蠊蠋蠐蠙蠒蠓蠔蠘蠚蠛蠜蠞蠟蠨蠭蠮蠰蠲蠵"],
["8fdca1","蠺蠼衁衃衅衈衉衊衋衎衑衕衖衘衚衜衟衠衤衩衱衹衻袀袘袚袛袜袟袠袨袪袺袽袾裀裊",4,"裑裒裓裛裞裧裯裰裱裵裷褁褆褍褎褏褕褖褘褙褚褜褠褦褧褨褰褱褲褵褹褺褾襀襂襅襆襉襏襒襗襚襛襜襡襢襣襫襮襰襳襵襺"],
["8fdda1","襻襼襽覉覍覐覔覕覛覜覟覠覥覰覴覵覶覷覼觔",4,"觥觩觫觭觱觳觶觹觽觿訄訅訇訏訑訒訔訕訞訠訢訤訦訫訬訯訵訷訽訾詀詃詅詇詉詍詎詓詖詗詘詜詝詡詥詧詵詶詷詹詺詻詾詿誀誃誆誋誏誐誒誖誗誙誟誧誩誮誯誳"],
["8fdea1","誶誷誻誾諃諆諈諉諊諑諓諔諕諗諝諟諬諰諴諵諶諼諿謅謆謋謑謜謞謟謊謭謰謷謼譂",4,"譈譒譓譔譙譍譞譣譭譶譸譹譼譾讁讄讅讋讍讏讔讕讜讞讟谸谹谽谾豅豇豉豋豏豑豓豔豗豘豛豝豙豣豤豦豨豩豭豳豵豶豻豾貆"],
["8fdfa1","貇貋貐貒貓貙貛貜貤貹貺賅賆賉賋賏賖賕賙賝賡賨賬賯賰賲賵賷賸賾賿贁贃贉贒贗贛赥赩赬赮赿趂趄趈趍趐趑趕趞趟趠趦趫趬趯趲趵趷趹趻跀跅跆跇跈跊跎跑跔跕跗跙跤跥跧跬跰趼跱跲跴跽踁踄踅踆踋踑踔踖踠踡踢"],
["8fe0a1","踣踦踧踱踳踶踷踸踹踽蹀蹁蹋蹍蹎蹏蹔蹛蹜蹝蹞蹡蹢蹩蹬蹭蹯蹰蹱蹹蹺蹻躂躃躉躐躒躕躚躛躝躞躢躧躩躭躮躳躵躺躻軀軁軃軄軇軏軑軔軜軨軮軰軱軷軹軺軭輀輂輇輈輏輐輖輗輘輞輠輡輣輥輧輨輬輭輮輴輵輶輷輺轀轁"],
["8fe1a1","轃轇轏轑",4,"轘轝轞轥辝辠辡辤辥辦辵辶辸达迀迁迆迊迋迍运迒迓迕迠迣迤迨迮迱迵迶迻迾适逄逈逌逘逛逨逩逯逪逬逭逳逴逷逿遃遄遌遛遝遢遦遧遬遰遴遹邅邈邋邌邎邐邕邗邘邙邛邠邡邢邥邰邲邳邴邶邽郌邾郃"],
["8fe2a1","郄郅郇郈郕郗郘郙郜郝郟郥郒郶郫郯郰郴郾郿鄀鄄鄅鄆鄈鄍鄐鄔鄖鄗鄘鄚鄜鄞鄠鄥鄢鄣鄧鄩鄮鄯鄱鄴鄶鄷鄹鄺鄼鄽酃酇酈酏酓酗酙酚酛酡酤酧酭酴酹酺酻醁醃醅醆醊醎醑醓醔醕醘醞醡醦醨醬醭醮醰醱醲醳醶醻醼醽醿"],
["8fe3a1","釂釃釅釓釔釗釙釚釞釤釥釩釪釬",5,"釷釹釻釽鈀鈁鈄鈅鈆鈇鈉鈊鈌鈐鈒鈓鈖鈘鈜鈝鈣鈤鈥鈦鈨鈮鈯鈰鈳鈵鈶鈸鈹鈺鈼鈾鉀鉂鉃鉆鉇鉊鉍鉎鉏鉑鉘鉙鉜鉝鉠鉡鉥鉧鉨鉩鉮鉯鉰鉵",4,"鉻鉼鉽鉿銈銉銊銍銎銒銗"],
["8fe4a1","銙銟銠銤銥銧銨銫銯銲銶銸銺銻銼銽銿",4,"鋅鋆鋇鋈鋋鋌鋍鋎鋐鋓鋕鋗鋘鋙鋜鋝鋟鋠鋡鋣鋥鋧鋨鋬鋮鋰鋹鋻鋿錀錂錈錍錑錔錕錜錝錞錟錡錤錥錧錩錪錳錴錶錷鍇鍈鍉鍐鍑鍒鍕鍗鍘鍚鍞鍤鍥鍧鍩鍪鍭鍯鍰鍱鍳鍴鍶"],
["8fe5a1","鍺鍽鍿鎀鎁鎂鎈鎊鎋鎍鎏鎒鎕鎘鎛鎞鎡鎣鎤鎦鎨鎫鎴鎵鎶鎺鎩鏁鏄鏅鏆鏇鏉",4,"鏓鏙鏜鏞鏟鏢鏦鏧鏹鏷鏸鏺鏻鏽鐁鐂鐄鐈鐉鐍鐎鐏鐕鐖鐗鐟鐮鐯鐱鐲鐳鐴鐻鐿鐽鑃鑅鑈鑊鑌鑕鑙鑜鑟鑡鑣鑨鑫鑭鑮鑯鑱鑲钄钃镸镹"],
["8fe6a1","镾閄閈閌閍閎閝閞閟閡閦閩閫閬閴閶閺閽閿闆闈闉闋闐闑闒闓闙闚闝闞闟闠闤闦阝阞阢阤阥阦阬阱阳阷阸阹阺阼阽陁陒陔陖陗陘陡陮陴陻陼陾陿隁隂隃隄隉隑隖隚隝隟隤隥隦隩隮隯隳隺雊雒嶲雘雚雝雞雟雩雯雱雺霂"],
["8fe7a1","霃霅霉霚霛霝霡霢霣霨霱霳靁靃靊靎靏靕靗靘靚靛靣靧靪靮靳靶靷靸靻靽靿鞀鞉鞕鞖鞗鞙鞚鞞鞟鞢鞬鞮鞱鞲鞵鞶鞸鞹鞺鞼鞾鞿韁韄韅韇韉韊韌韍韎韐韑韔韗韘韙韝韞韠韛韡韤韯韱韴韷韸韺頇頊頙頍頎頔頖頜頞頠頣頦"],
["8fe8a1","頫頮頯頰頲頳頵頥頾顄顇顊顑顒顓顖顗顙顚顢顣顥顦顪顬颫颭颮颰颴颷颸颺颻颿飂飅飈飌飡飣飥飦飧飪飳飶餂餇餈餑餕餖餗餚餛餜餟餢餦餧餫餱",4,"餹餺餻餼饀饁饆饇饈饍饎饔饘饙饛饜饞饟饠馛馝馟馦馰馱馲馵"],
["8fe9a1","馹馺馽馿駃駉駓駔駙駚駜駞駧駪駫駬駰駴駵駹駽駾騂騃騄騋騌騐騑騖騞騠騢騣騤騧騭騮騳騵騶騸驇驁驄驊驋驌驎驑驔驖驝骪骬骮骯骲骴骵骶骹骻骾骿髁髃髆髈髎髐髒髕髖髗髛髜髠髤髥髧髩髬髲髳髵髹髺髽髿",4],
["8feaa1","鬄鬅鬈鬉鬋鬌鬍鬎鬐鬒鬖鬙鬛鬜鬠鬦鬫鬭鬳鬴鬵鬷鬹鬺鬽魈魋魌魕魖魗魛魞魡魣魥魦魨魪",4,"魳魵魷魸魹魿鮀鮄鮅鮆鮇鮉鮊鮋鮍鮏鮐鮔鮚鮝鮞鮦鮧鮩鮬鮰鮱鮲鮷鮸鮻鮼鮾鮿鯁鯇鯈鯎鯐鯗鯘鯝鯟鯥鯧鯪鯫鯯鯳鯷鯸"],
["8feba1","鯹鯺鯽鯿鰀鰂鰋鰏鰑鰖鰘鰙鰚鰜鰞鰢鰣鰦",4,"鰱鰵鰶鰷鰽鱁鱃鱄鱅鱉鱊鱎鱏鱐鱓鱔鱖鱘鱛鱝鱞鱟鱣鱩鱪鱜鱫鱨鱮鱰鱲鱵鱷鱻鳦鳲鳷鳹鴋鴂鴑鴗鴘鴜鴝鴞鴯鴰鴲鴳鴴鴺鴼鵅鴽鵂鵃鵇鵊鵓鵔鵟鵣鵢鵥鵩鵪鵫鵰鵶鵷鵻"],
["8feca1","鵼鵾鶃鶄鶆鶊鶍鶎鶒鶓鶕鶖鶗鶘鶡鶪鶬鶮鶱鶵鶹鶼鶿鷃鷇鷉鷊鷔鷕鷖鷗鷚鷞鷟鷠鷥鷧鷩鷫鷮鷰鷳鷴鷾鸊鸂鸇鸎鸐鸑鸒鸕鸖鸙鸜鸝鹺鹻鹼麀麂麃麄麅麇麎麏麖麘麛麞麤麨麬麮麯麰麳麴麵黆黈黋黕黟黤黧黬黭黮黰黱黲黵"],
["8feda1","黸黿鼂鼃鼉鼏鼐鼑鼒鼔鼖鼗鼙鼚鼛鼟鼢鼦鼪鼫鼯鼱鼲鼴鼷鼹鼺鼼鼽鼿齁齃",4,"齓齕齖齗齘齚齝齞齨齩齭",4,"齳齵齺齽龏龐龑龒龔龖龗龞龡龢龣龥"]
]

},{}],26:[function(require,module,exports){
module.exports={"uChars":[128,165,169,178,184,216,226,235,238,244,248,251,253,258,276,284,300,325,329,334,364,463,465,467,469,471,473,475,477,506,594,610,712,716,730,930,938,962,970,1026,1104,1106,8209,8215,8218,8222,8231,8241,8244,8246,8252,8365,8452,8454,8458,8471,8482,8556,8570,8596,8602,8713,8720,8722,8726,8731,8737,8740,8742,8748,8751,8760,8766,8777,8781,8787,8802,8808,8816,8854,8858,8870,8896,8979,9322,9372,9548,9588,9616,9622,9634,9652,9662,9672,9676,9680,9702,9735,9738,9793,9795,11906,11909,11913,11917,11928,11944,11947,11951,11956,11960,11964,11979,12284,12292,12312,12319,12330,12351,12436,12447,12535,12543,12586,12842,12850,12964,13200,13215,13218,13253,13263,13267,13270,13384,13428,13727,13839,13851,14617,14703,14801,14816,14964,15183,15471,15585,16471,16736,17208,17325,17330,17374,17623,17997,18018,18212,18218,18301,18318,18760,18811,18814,18820,18823,18844,18848,18872,19576,19620,19738,19887,40870,59244,59336,59367,59413,59417,59423,59431,59437,59443,59452,59460,59478,59493,63789,63866,63894,63976,63986,64016,64018,64021,64025,64034,64037,64042,65074,65093,65107,65112,65127,65132,65375,65510,65536],"gbChars":[0,36,38,45,50,81,89,95,96,100,103,104,105,109,126,133,148,172,175,179,208,306,307,308,309,310,311,312,313,341,428,443,544,545,558,741,742,749,750,805,819,820,7922,7924,7925,7927,7934,7943,7944,7945,7950,8062,8148,8149,8152,8164,8174,8236,8240,8262,8264,8374,8380,8381,8384,8388,8390,8392,8393,8394,8396,8401,8406,8416,8419,8424,8437,8439,8445,8482,8485,8496,8521,8603,8936,8946,9046,9050,9063,9066,9076,9092,9100,9108,9111,9113,9131,9162,9164,9218,9219,11329,11331,11334,11336,11346,11361,11363,11366,11370,11372,11375,11389,11682,11686,11687,11692,11694,11714,11716,11723,11725,11730,11736,11982,11989,12102,12336,12348,12350,12384,12393,12395,12397,12510,12553,12851,12962,12973,13738,13823,13919,13933,14080,14298,14585,14698,15583,15847,16318,16434,16438,16481,16729,17102,17122,17315,17320,17402,17418,17859,17909,17911,17915,17916,17936,17939,17961,18664,18703,18814,18962,19043,33469,33470,33471,33484,33485,33490,33497,33501,33505,33513,33520,33536,33550,37845,37921,37948,38029,38038,38064,38065,38066,38069,38075,38076,38078,39108,39109,39113,39114,39115,39116,39265,39394,189000]}
},{}],27:[function(require,module,exports){
module.exports=[
["a140","",62],
["a180","",32],
["a240","",62],
["a280","",32],
["a2ab","",5],
["a2e3","€"],
["a2ef",""],
["a2fd",""],
["a340","",62],
["a380","",31,"　"],
["a440","",62],
["a480","",32],
["a4f4","",10],
["a540","",62],
["a580","",32],
["a5f7","",7],
["a640","",62],
["a680","",32],
["a6b9","",7],
["a6d9","",6],
["a6ec",""],
["a6f3",""],
["a6f6","",8],
["a740","",62],
["a780","",32],
["a7c2","",14],
["a7f2","",12],
["a896","",10],
["a8bc",""],
["a8bf","ǹ"],
["a8c1",""],
["a8ea","",20],
["a958",""],
["a95b",""],
["a95d",""],
["a989","〾⿰",11],
["a997","",12],
["a9f0","",14],
["aaa1","",93],
["aba1","",93],
["aca1","",93],
["ada1","",93],
["aea1","",93],
["afa1","",93],
["d7fa","",4],
["f8a1","",93],
["f9a1","",93],
["faa1","",93],
["fba1","",93],
["fca1","",93],
["fda1","",93],
["fe50","⺁⺄㑳㑇⺈⺋㖞㘚㘎⺌⺗㥮㤘㧏㧟㩳㧐㭎㱮㳠⺧⺪䁖䅟⺮䌷⺳⺶⺷䎱䎬⺻䏝䓖䙡䙌"],
["fe80","䜣䜩䝼䞍⻊䥇䥺䥽䦂䦃䦅䦆䦟䦛䦷䦶䲣䲟䲠䲡䱷䲢䴓",6,"䶮",93]
]

},{}],28:[function(require,module,exports){
module.exports=[
["0","\u0000",128],
["a1","｡",62],
["8140","　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",9,"＋－±×"],
["8180","÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓〓"],
["81b8","∈∋⊆⊇⊂⊃∪∩"],
["81c8","∧∨￢⇒⇔∀∃"],
["81da","∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
["81f0","Å‰♯♭♪†‡¶"],
["81fc","◯"],
["824f","０",9],
["8260","Ａ",25],
["8281","ａ",25],
["829f","ぁ",82],
["8340","ァ",62],
["8380","ム",22],
["839f","Α",16,"Σ",6],
["83bf","α",16,"σ",6],
["8440","А",5,"ЁЖ",25],
["8470","а",5,"ёж",7],
["8480","о",17],
["849f","─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
["8740","①",19,"Ⅰ",9],
["875f","㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
["877e","㍻"],
["8780","〝〟№㏍℡㊤",4,"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"],
["889f","亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
["8940","院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円"],
["8980","園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
["8a40","魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫"],
["8a80","橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
["8b40","機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救"],
["8b80","朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
["8c40","掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨"],
["8c80","劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
["8d40","后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降"],
["8d80","項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
["8e40","察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止"],
["8e80","死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
["8f40","宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳"],
["8f80","準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
["9040","拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨"],
["9080","逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
["9140","繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻"],
["9180","操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
["9240","叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄"],
["9280","逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
["9340","邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬"],
["9380","凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
["9440","如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅"],
["9480","楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
["9540","鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷"],
["9580","斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
["9640","法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆"],
["9680","摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
["9740","諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲"],
["9780","沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
["9840","蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
["989f","弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
["9940","僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭"],
["9980","凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
["9a40","咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸"],
["9a80","噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
["9b40","奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀"],
["9b80","它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
["9c40","廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠"],
["9c80","怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
["9d40","戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫"],
["9d80","捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
["9e40","曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎"],
["9e80","梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
["9f40","檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯"],
["9f80","麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
["e040","漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝"],
["e080","烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
["e140","瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿"],
["e180","痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
["e240","磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰"],
["e280","窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
["e340","紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷"],
["e380","縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
["e440","隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤"],
["e480","艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
["e540","蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬"],
["e580","蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
["e640","襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧"],
["e680","諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
["e740","蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜"],
["e780","轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
["e840","錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙"],
["e880","閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
["e940","顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃"],
["e980","騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
["ea40","鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯"],
["ea80","黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠堯槇遙瑤凜熙"],
["ed40","纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏"],
["ed80","塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
["ee40","犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙"],
["ee80","蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
["eeef","ⅰ",9,"￢￤＇＂"],
["f040","",62],
["f080","",124],
["f140","",62],
["f180","",124],
["f240","",62],
["f280","",124],
["f340","",62],
["f380","",124],
["f440","",62],
["f480","",124],
["f540","",62],
["f580","",124],
["f640","",62],
["f680","",124],
["f740","",62],
["f780","",124],
["f840","",62],
["f880","",124],
["f940",""],
["fa40","ⅰ",9,"Ⅰ",9,"￢￤＇＂㈱№℡∵纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊"],
["fa80","兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯"],
["fb40","涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神"],
["fb80","祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙"],
["fc40","髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"]
]

},{}],29:[function(require,module,exports){
(function (Buffer){


// == UTF16-BE codec. ==========================================================

exports.utf16be = function(options) {
    return {
        encoder: utf16beEncoder,
        decoder: utf16beDecoder,

        bom: new Buffer([0xFE, 0xFF]),
    };
};


// -- Encoding

function utf16beEncoder(options) {
    return {
        write: utf16beEncoderWrite,
        end: function() {},
    }
}

function utf16beEncoderWrite(str) {
    var buf = new Buffer(str, 'ucs2');
    for (var i = 0; i < buf.length; i += 2) {
        var tmp = buf[i]; buf[i] = buf[i+1]; buf[i+1] = tmp;
    }
    return buf;
}


// -- Decoding

function utf16beDecoder(options) {
    return {
        write: utf16beDecoderWrite,
        end: function() {},

        overflowByte: -1,
    };
}

function utf16beDecoderWrite(buf) {
    if (buf.length == 0)
        return '';

    var buf2 = new Buffer(buf.length + 1),
        i = 0, j = 0;

    if (this.overflowByte !== -1) {
        buf2[0] = buf[0];
        buf2[1] = this.overflowByte;
        i = 1; j = 2;
    }

    for (; i < buf.length-1; i += 2, j+= 2) {
        buf2[j] = buf[i+1];
        buf2[j+1] = buf[i];
    }

    this.overflowByte = (i == buf.length-1) ? buf[buf.length-1] : -1;

    return buf2.slice(0, j).toString('ucs2');
}


// == UTF-16 codec =============================================================
// Decoder chooses automatically from UTF-16LE and UTF-16BE using BOM and space-based heuristic.
// Defaults to UTF-16BE, according to RFC 2781, although it is against some industry practices, see
// http://en.wikipedia.org/wiki/UTF-16 and http://encoding.spec.whatwg.org/#utf-16le
// Decoder default can be changed: iconv.decode(buf, 'utf16', {default: 'utf-16le'});

// Encoder prepends BOM and uses UTF-16BE.
// Endianness can also be changed: iconv.encode(str, 'utf16', {use: 'utf-16le'});

exports.utf16 = function(options) {
    return {
        encoder: utf16Encoder,
        decoder: utf16Decoder,

        getCodec: options.iconv.getCodec,
    };
};

// -- Encoding

function utf16Encoder(options) {
    options = options || {};
    var codec = this.getCodec(options.use || 'utf-16be');
    if (!codec.bom)
        throw new Error("iconv-lite: in UTF-16 encoder, 'use' parameter should be either UTF-16BE or UTF16-LE.");

    return {
        write: utf16EncoderWrite,
        end: utf16EncoderEnd,

        bom: codec.bom,
        internalEncoder: codec.encoder(options),
    };
}

function utf16EncoderWrite(str) {
    var buf = this.internalEncoder.write(str);

    if (this.bom) {
        buf = Buffer.concat([this.bom, buf]);
        this.bom = null;
    }

    return buf;
}

function utf16EncoderEnd() {
    return this.internalEncoder.end();
}


// -- Decoding

function utf16Decoder(options) {
    return {
        write: utf16DecoderWrite,
        end: utf16DecoderEnd,

        internalDecoder: null,
        initialBytes: [],
        initialBytesLen: 0,

        options: options || {},
        getCodec: this.getCodec,
    };
}

function utf16DecoderWrite(buf) {
    if (this.internalDecoder)
        return this.internalDecoder.write(buf);

    // Codec is not chosen yet. Accumulate initial bytes.
    this.initialBytes.push(buf);
    this.initialBytesLen += buf.length;
    
    if (this.initialBytesLen < 16) // We need > 2 bytes to use space heuristic (see below)
        return '';

    // We have enough bytes -> decide endianness.
    return utf16DecoderDecideEndianness.call(this);
}

function utf16DecoderEnd() {
    if (this.internalDecoder)
        return this.internalDecoder.end();

    var res = utf16DecoderDecideEndianness.call(this);
    var trail;

    if (this.internalDecoder)
        trail = this.internalDecoder.end();

    return (trail && trail.length > 0) ? (res + trail) : res;
}

function utf16DecoderDecideEndianness() {
    var buf = Buffer.concat(this.initialBytes);
    this.initialBytes.length = this.initialBytesLen = 0;

    if (buf.length < 2)
        return ''; // Not a valid UTF-16 sequence anyway.

    // Default encoding.
    var enc = this.options.default || 'utf-16be';

    // Check BOM.
    if (buf[0] == 0xFE && buf[1] == 0xFF) { // UTF-16BE BOM
        enc = 'utf-16be'; buf = buf.slice(2);
    }
    else if (buf[0] == 0xFF && buf[1] == 0xFE) { // UTF-16LE BOM
        enc = 'utf-16le'; buf = buf.slice(2);
    }
    else {
        // No BOM found. Try to deduce encoding from initial content.
        // Most of the time, the content has spaces (U+0020), but the opposite (U+2000) is very uncommon.
        // So, we count spaces as if it was LE or BE, and decide from that.
        var spaces = [0, 0], // Counts of space chars in both positions
            _len = Math.min(buf.length - (buf.length % 2), 64); // Len is always even.

        for (var i = 0; i < _len; i += 2) {
            if (buf[i] == 0x00 && buf[i+1] == 0x20) spaces[0]++;
            if (buf[i] == 0x20 && buf[i+1] == 0x00) spaces[1]++;
        }

        if (spaces[0] > 0 && spaces[1] == 0)  
            enc = 'utf-16be';
        else if (spaces[0] == 0 && spaces[1] > 0)
            enc = 'utf-16le';
    }

    this.internalDecoder = this.getCodec(enc).decoder(this.options);
    return this.internalDecoder.write(buf);
}



}).call(this,require("buffer").Buffer)

},{"buffer":6}],30:[function(require,module,exports){
(function (Buffer){

// UTF-7 codec, according to https://tools.ietf.org/html/rfc2152
// Below is UTF-7-IMAP codec, according to http://tools.ietf.org/html/rfc3501#section-5.1.3

exports.utf7 = function(options) {
    return {
        encoder: function utf7Encoder() {
            return {
                write: utf7EncoderWrite,
                end: function() {},

                iconv: options.iconv,
            };
        },
        decoder: function utf7Decoder() {
            return {
                write: utf7DecoderWrite,
                end: utf7DecoderEnd,

                iconv: options.iconv,
                inBase64: false,
                base64Accum: '',
            };
        },
    };
};

exports.unicode11utf7 = 'utf7'; // Alias UNICODE-1-1-UTF-7


var nonDirectChars = /[^A-Za-z0-9'\(\),-\.\/:\? \n\r\t]+/g;

function utf7EncoderWrite(str) {
    // Naive implementation.
    // Non-direct chars are encoded as "+<base64>-"; single "+" char is encoded as "+-".
    return new Buffer(str.replace(nonDirectChars, function(chunk) {
        return "+" + (chunk === '+' ? '' : 
            this.iconv.encode(chunk, 'utf16-be').toString('base64').replace(/=+$/, '')) 
            + "-";
    }.bind(this)));
}


var base64Regex = /[A-Za-z0-9\/+]/;
var base64Chars = [];
for (var i = 0; i < 256; i++)
    base64Chars[i] = base64Regex.test(String.fromCharCode(i));

var plusChar = '+'.charCodeAt(0), 
    minusChar = '-'.charCodeAt(0),
    andChar = '&'.charCodeAt(0);

function utf7DecoderWrite(buf) {
    var res = "", lastI = 0,
        inBase64 = this.inBase64,
        base64Accum = this.base64Accum;

    // The decoder is more involved as we must handle chunks in stream.

    for (var i = 0; i < buf.length; i++) {
        if (!inBase64) { // We're in direct mode.
            // Write direct chars until '+'
            if (buf[i] == plusChar) {
                res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
                lastI = i+1;
                inBase64 = true;
            }
        } else { // We decode base64.
            if (!base64Chars[buf[i]]) { // Base64 ended.
                if (i == lastI && buf[i] == minusChar) {// "+-" -> "+"
                    res += "+";
                } else {
                    var b64str = base64Accum + buf.slice(lastI, i).toString();
                    res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
                }

                if (buf[i] != minusChar) // Minus is absorbed after base64.
                    i--;

                lastI = i+1;
                inBase64 = false;
                base64Accum = '';
            }
        }
    }

    if (!inBase64) {
        res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
    } else {
        var b64str = base64Accum + buf.slice(lastI).toString();

        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
        b64str = b64str.slice(0, canBeDecoded);

        res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
    }

    this.inBase64 = inBase64;
    this.base64Accum = base64Accum;

    return res;
}

function utf7DecoderEnd() {
    var res = "";
    if (this.inBase64 && this.base64Accum.length > 0)
        res = this.iconv.decode(new Buffer(this.base64Accum, 'base64'), "utf16-be");

    this.inBase64 = false;
    this.base64Accum = '';
    return res;
}


// UTF-7-IMAP codec.
// RFC3501 Sec. 5.1.3 Modified UTF-7 (http://tools.ietf.org/html/rfc3501#section-5.1.3)
// Differences:
//  * Base64 part is started by "&" instead of "+"
//  * Direct characters are 0x20-0x7E, except "&" (0x26)
//  * In Base64, "," is used instead of "/"
//  * Base64 must not be used to represent direct characters.
//  * No implicit shift back from Base64 (should always end with '-')
//  * String must end in non-shifted position.
//  * "-&" while in base64 is not allowed.


exports.utf7imap = function(options) {
    return {
        encoder: function utf7ImapEncoder() {
            return {
                write: utf7ImapEncoderWrite,
                end: utf7ImapEncoderEnd,

                iconv: options.iconv,
                inBase64: false,
                base64Accum: new Buffer(6),
                base64AccumIdx: 0,
            };
        },
        decoder: function utf7ImapDecoder() {
            return {
                write: utf7ImapDecoderWrite,
                end: utf7ImapDecoderEnd,

                iconv: options.iconv,
                inBase64: false,
                base64Accum: '',
            };
        },
    };
};


function utf7ImapEncoderWrite(str) {
    var inBase64 = this.inBase64,
        base64Accum = this.base64Accum,
        base64AccumIdx = this.base64AccumIdx,
        buf = new Buffer(str.length*5 + 10), bufIdx = 0;

    for (var i = 0; i < str.length; i++) {
        var uChar = str.charCodeAt(i);
        if (0x20 <= uChar && uChar <= 0x7E) { // Direct character or '&'.
            if (inBase64) {
                if (base64AccumIdx > 0) {
                    bufIdx += buf.write(base64Accum.slice(0, base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
                    base64AccumIdx = 0;
                }

                buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
                inBase64 = false;
            }

            if (!inBase64) {
                buf[bufIdx++] = uChar; // Write direct character

                if (uChar === andChar)  // Ampersand -> '&-'
                    buf[bufIdx++] = minusChar;
            }

        } else { // Non-direct character
            if (!inBase64) {
                buf[bufIdx++] = andChar; // Write '&', then go to base64 mode.
                inBase64 = true;
            }
            if (inBase64) {
                base64Accum[base64AccumIdx++] = uChar >> 8;
                base64Accum[base64AccumIdx++] = uChar & 0xFF;

                if (base64AccumIdx == base64Accum.length) {
                    bufIdx += buf.write(base64Accum.toString('base64').replace(/\//g, ','), bufIdx);
                    base64AccumIdx = 0;
                }
            }
        }
    }

    this.inBase64 = inBase64;
    this.base64AccumIdx = base64AccumIdx;

    return buf.slice(0, bufIdx);
}

function utf7ImapEncoderEnd() {
    var buf = new Buffer(10), bufIdx = 0;
    if (this.inBase64) {
        if (this.base64AccumIdx > 0) {
            bufIdx += buf.write(this.base64Accum.slice(0, this.base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
            this.base64AccumIdx = 0;
        }

        buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
        this.inBase64 = false;
    }

    return buf.slice(0, bufIdx);
}


var base64IMAPChars = base64Chars.slice();
base64IMAPChars[','.charCodeAt(0)] = true;

function utf7ImapDecoderWrite(buf) {
    var res = "", lastI = 0,
        inBase64 = this.inBase64,
        base64Accum = this.base64Accum;

    // The decoder is more involved as we must handle chunks in stream.
    // It is forgiving, closer to standard UTF-7 (for example, '-' is optional at the end).

    for (var i = 0; i < buf.length; i++) {
        if (!inBase64) { // We're in direct mode.
            // Write direct chars until '&'
            if (buf[i] == andChar) {
                res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
                lastI = i+1;
                inBase64 = true;
            }
        } else { // We decode base64.
            if (!base64IMAPChars[buf[i]]) { // Base64 ended.
                if (i == lastI && buf[i] == minusChar) { // "&-" -> "&"
                    res += "&";
                } else {
                    var b64str = base64Accum + buf.slice(lastI, i).toString().replace(/,/g, '/');
                    res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
                }

                if (buf[i] != minusChar) // Minus may be absorbed after base64.
                    i--;

                lastI = i+1;
                inBase64 = false;
                base64Accum = '';
            }
        }
    }

    if (!inBase64) {
        res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
    } else {
        var b64str = base64Accum + buf.slice(lastI).toString().replace(/,/g, '/');

        var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
        base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
        b64str = b64str.slice(0, canBeDecoded);

        res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
    }

    this.inBase64 = inBase64;
    this.base64Accum = base64Accum;

    return res;
}

function utf7ImapDecoderEnd() {
    var res = "";
    if (this.inBase64 && this.base64Accum.length > 0)
        res = this.iconv.decode(new Buffer(this.base64Accum, 'base64'), "utf16-be");

    this.inBase64 = false;
    this.base64Accum = '';
    return res;
}



}).call(this,require("buffer").Buffer)

},{"buffer":6}],31:[function(require,module,exports){
(function (process,Buffer){

var iconv = module.exports;

// All codecs and aliases are kept here, keyed by encoding name/alias.
// They are lazy loaded in `iconv.getCodec` from `encodings/index.js`.
iconv.encodings = null;

// Characters emitted in case of error.
iconv.defaultCharUnicode = '�';
iconv.defaultCharSingleByte = '?';

// Public API.
iconv.encode = function encode(str, encoding, options) {
    str = "" + (str || ""); // Ensure string.

    var encoder = iconv.getCodec(encoding).encoder(options);

    var res = encoder.write(str);
    var trail = encoder.end();
    
    return (trail && trail.length > 0) ? Buffer.concat([res, trail]) : res;
}

iconv.decode = function decode(buf, encoding, options) {
    if (typeof buf === 'string') {
        if (!iconv.skipDecodeWarning) {
            console.error('Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding');
            iconv.skipDecodeWarning = true;
        }

        buf = new Buffer("" + (buf || ""), "binary"); // Ensure buffer.
    }

    var decoder = iconv.getCodec(encoding).decoder(options);

    var res = decoder.write(buf);
    var trail = decoder.end();

    return (trail && trail.length > 0) ? (res + trail) : res;
}

iconv.encodingExists = function encodingExists(enc) {
    try {
        iconv.getCodec(enc);
        return true;
    } catch (e) {
        return false;
    }
}

// Legacy aliases to convert functions
iconv.toEncoding = iconv.encode;
iconv.fromEncoding = iconv.decode;

// Search for a codec in iconv.encodings. Cache codec data in iconv._codecDataCache.
iconv._codecDataCache = {};
iconv.getCodec = function getCodec(encoding) {
    if (!iconv.encodings)
        iconv.encodings = require("../encodings"); // Lazy load all encoding definitions.
    
    // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
    var enc = (''+encoding).toLowerCase().replace(/[^0-9a-z]|:\d{4}$/g, "");

    // Traverse iconv.encodings to find actual codec.
    var codecData, codecOptions;
    while (true) {
        codecData = iconv._codecDataCache[enc];
        if (codecData)
            return codecData;

        var codec = iconv.encodings[enc];

        switch (typeof codec) {
            case "string": // Direct alias to other encoding.
                enc = codec;
                break;

            case "object": // Alias with options. Can be layered.
                if (!codecOptions) {
                    codecOptions = codec;
                    codecOptions.encodingName = enc;
                }
                else {
                    for (var key in codec)
                        codecOptions[key] = codec[key];
                }

                enc = codec.type;
                break;

            case "function": // Codec itself.
                if (!codecOptions)
                    codecOptions = { encodingName: enc };
                codecOptions.iconv = iconv;

                // The codec function must load all tables and return object with .encoder and .decoder methods.
                // It'll be called only once (for each different options object).
                codecData = codec.call(iconv.encodings, codecOptions);

                iconv._codecDataCache[codecOptions.encodingName] = codecData; // Save it to be reused later.
                return codecData;

            default:
                throw new Error("Encoding not recognized: '" + encoding + "' (searched as: '"+enc+"')");
        }
    }
}

// Load extensions in Node. All of them are omitted in Browserify build via 'browser' field in package.json.
var nodeVer = typeof process !== 'undefined' && process.versions && process.versions.node;
if (nodeVer) {

    // Load streaming support in Node v0.10+
    var nodeVerArr = nodeVer.split(".").map(Number);
    if (nodeVerArr[0] > 0 || nodeVerArr[1] >= 10) {
        require("./streams")(iconv);
    }

    // Load Node primitive extensions.
    require("./extend-node")(iconv);
}


}).call(this,require('_process'),require("buffer").Buffer)

},{"../encodings":16,"./extend-node":5,"./streams":5,"_process":11,"buffer":6}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJldmFsdWF0b3IuanMiLCJtb2RlbC5qcyIsIm1vZGVsbGVlcnRhYWwuanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2Jhc2U2NC1qcy9saWIvYjY0LmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2lzLWFycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3BhdGgtYnJvd3NlcmlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZ3J1bnQtYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvc3RyaW5nX2RlY29kZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ub2RlLXhtbC1saXRlL25vZGVfbW9kdWxlcy9pY29udi1saXRlL2VuY29kaW5ncy9kYmNzLWNvZGVjLmpzIiwibm9kZV9tb2R1bGVzL25vZGUteG1sLWxpdGUvbm9kZV9tb2R1bGVzL2ljb252LWxpdGUvZW5jb2RpbmdzL2RiY3MtZGF0YS5qcyIsIm5vZGVfbW9kdWxlcy9ub2RlLXhtbC1saXRlL25vZGVfbW9kdWxlcy9pY29udi1saXRlL2VuY29kaW5ncy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9ub2RlLXhtbC1saXRlL25vZGVfbW9kdWxlcy9pY29udi1saXRlL2VuY29kaW5ncy9pbnRlcm5hbC5qcyIsIm5vZGVfbW9kdWxlcy9ub2RlLXhtbC1saXRlL25vZGVfbW9kdWxlcy9pY29udi1saXRlL2VuY29kaW5ncy9zYmNzLWNvZGVjLmpzIiwibm9kZV9tb2R1bGVzL25vZGUteG1sLWxpdGUvbm9kZV9tb2R1bGVzL2ljb252LWxpdGUvZW5jb2RpbmdzL3NiY3MtZGF0YS1nZW5lcmF0ZWQuanMiLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3Mvc2Jjcy1kYXRhLmpzIiwibm9kZV9tb2R1bGVzL25vZGUteG1sLWxpdGUvbm9kZV9tb2R1bGVzL2ljb252LWxpdGUvZW5jb2RpbmdzL3RhYmxlcy9iaWc1LWFkZGVkLmpzb24iLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3MvdGFibGVzL2NwOTM2Lmpzb24iLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3MvdGFibGVzL2NwOTQ5Lmpzb24iLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3MvdGFibGVzL2NwOTUwLmpzb24iLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3MvdGFibGVzL2V1Y2pwLmpzb24iLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3MvdGFibGVzL2diMTgwMzAtcmFuZ2VzLmpzb24iLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9lbmNvZGluZ3MvdGFibGVzL2diay1hZGRlZC5qc29uIiwibm9kZV9tb2R1bGVzL25vZGUteG1sLWxpdGUvbm9kZV9tb2R1bGVzL2ljb252LWxpdGUvZW5jb2RpbmdzL3RhYmxlcy9zaGlmdGppcy5qc29uIiwibm9kZV9tb2R1bGVzL25vZGUteG1sLWxpdGUvbm9kZV9tb2R1bGVzL2ljb252LWxpdGUvZW5jb2RpbmdzL3V0ZjE2LmpzIiwibm9kZV9tb2R1bGVzL25vZGUteG1sLWxpdGUvbm9kZV9tb2R1bGVzL2ljb252LWxpdGUvZW5jb2RpbmdzL3V0ZjcuanMiLCJub2RlX21vZHVsZXMvbm9kZS14bWwtbGl0ZS9ub2RlX21vZHVsZXMvaWNvbnYtbGl0ZS9saWIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOTBCQTs7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdDRDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeCtCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDakZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDalJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdExBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDMU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOVJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxyXG4gICAgSW50ZXJwcmV0ZXIgZm9yIE1vZGVsbGVlcnRhYWwgKG1vZGVscmVnZWxzKVxyXG4gICAgU2ltcGxlIGR5bmFtaWNhbCBtb2RlbHMgZm9yIGhpZ2hzY2hvb2wgUGh5c2ljcyBpbiBOTFxyXG5cclxuICAgIFRoZSBsYW5ndWFnZSBpcyBkZXNjcmliZWQgaW4gbW9kZWxsZWVydGFhbC5qaXNvblxyXG5cclxuICAgIHVzYWdlOlxyXG4gICAgICBucG0gaW5zdGFsbCBwYXRoX3RvL2ppc29uXHJcbiAgICAgIG5vZGUgaW50ZXJwcmV0ZXIuanNcclxuKi9cclxuXHJcblxyXG4vL2pzaGludCBub2RlOnRydWVcclxuLy9qc2hpbnQgZGV2ZWw6dHJ1ZVxyXG4vL2pzaGludCBldmlsOnRydWVcclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vLyBwYXJzZXIgY29tcGlsZWQgb24gZXhlY3V0aW9uIGJ5IGppc29uLmpzXHJcbnZhciBtb2RlbG1vZHVsZSA9IHJlcXVpcmUoXCIuL21vZGVsLmpzXCIpO1xyXG52YXIgcGFyc2VyID0gcmVxdWlyZShcIi4vbW9kZWxsZWVydGFhbFwiKS5wYXJzZXI7XHJcblxyXG4vKlxyXG4gQ2xhc3MgbmFtZXNwYWNlXHJcblxyXG4gVmFyaWFibGVzIGFyZSBjcmVhdGVkIGluIHRoaXMudmFyTmFtZXMgPSB7fSAoYSBsaXN0IG9mIHZhcmlhYmxlIG5hbWVzKVxyXG5cclxuIFN0YXJ0d2FhcmRlbiBhcmUgY29waWVkIHRvIHRoaXMuY29uc3ROYW1lcyBhbmQgdmFyTmFtZXMgYXJlIGVyYXNlZCBhZnRlclxyXG4gcGFyc2luZyBcInN0YXJ0d2FhcmRlbi50eHRcIi4gVGhpcyBpcyBhIHRyaWNrIHRvIGtlZXAgc3RhcnR3YWFyZGVuIHNlcGVyYXRlXHJcbiovXHJcblxyXG5mdW5jdGlvbiBOYW1lc3BhY2UoKSB7XHJcblxyXG4gICAgLy8gcHJlZml4IHRvIHByZXZlbnQgdmFyaWFibGUgbmFtZSBjb2xsaXNpb24gd2l0aCByZXNlcnZlZCB3b3Jkc1xyXG4gICAgdGhpcy52YXJQcmVmaXggPSBcInZhcl9cIjtcclxuXHJcbiAgICB0aGlzLnZhck5hbWVzID0ge307IC8vIGxpc3Qgb2YgY3JlYXRlZCB2YXJpYWJsZXNcclxuICAgIHRoaXMuY29uc3ROYW1lcyA9IHt9OyAvLyBsaXN0IG9mIHN0YXJ0d2FhcmRlbiB0aGF0IHJlbWFpbiBjb25zdGFudCBpbiBleGVjdXRpb25cclxuXHJcbn1cclxuXHJcblxyXG5OYW1lc3BhY2UucHJvdG90eXBlLmNyZWF0ZVZhciA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuXHJcbiAgICBuYW1lID0gdGhpcy52YXJQcmVmaXggKyBuYW1lO1xyXG5cclxuICAgIGlmICghdGhpcy52YXJOYW1lc1tuYW1lXSlcclxuICAgICAgICB0aGlzLnZhck5hbWVzW25hbWVdID0gdHJ1ZTtcclxuXHJcbiAgICByZXR1cm4gbmFtZTtcclxufTtcclxuXHJcbk5hbWVzcGFjZS5wcm90b3R5cGUucmVtb3ZlUHJlZml4ID0gZnVuY3Rpb24obmFtZSkge1xyXG5cclxuICAgIHZhciByZWdleCA9IG5ldyBSZWdFeHAoXCJeXCIgKyB0aGlzLnZhclByZWZpeCk7XHJcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKHJlZ2V4LCAnJyk7XHJcbn07XHJcblxyXG5cclxuTmFtZXNwYWNlLnByb3RvdHlwZS5tb3ZlU3RhcnRXYWFyZGVuID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5jb25zdE5hbWVzID0gdGhpcy52YXJOYW1lcztcclxuICAgIHRoaXMudmFyTmFtZXMgPSB7fTtcclxufTtcclxuXHJcbi8qXHJcbiBDbGFzcyBSZXN1bHRzXHJcbiBTdG9yZSBhbmQgbWFuaXB1bGF0ZSByZXN1bHRzXHJcbiovXHJcbmZ1bmN0aW9uIFJlc3VsdHMobmFtZXNwYWNlKSB7XHJcbiAgICB0aGlzLm5hbWVzcGFjZSA9IG5hbWVzcGFjZTtcclxufVxyXG5cclxuUmVzdWx0cy5wcm90b3R5cGUuZ2V0QWxsYW5kQ2xlYW5VcCA9IGZ1bmN0aW9uKHJlc3VsdE9iamVjdCkge1xyXG4gICAgLyogY29weSByZXN1bHRzIGFuZCBcImNsZWFuXCIgKHJvdW5kKSB0aGUgbnVtYmVycyAqL1xyXG5cclxuICAgIC8vIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNjYxNTYyL2hvdy10by1mb3JtYXQtYS1mbG9hdC1pbi1qYXZhc2NyaXB0XHJcbiAgICBmdW5jdGlvbiBodW1hbml6ZSh4KSB7XHJcbiAgICAgIHJldHVybiB4LnRvRml4ZWQoMykucmVwbGFjZSgvXFwuPzAqJC8sJycpLnJlcGxhY2UoJy4nLCcsJyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgdmFyTmFtZSBpbiB0aGlzLm5hbWVzcGFjZS52YXJOYW1lcykge1xyXG4gICAgICAgIHZhck5hbWUgPSB0aGlzLm5hbWVzcGFjZS5yZW1vdmVQcmVmaXgodmFyTmFtZSk7XHJcbiAgICAgICAgLy8gcHVzaCAvIHBvcCA/ISE/IT9cclxuICAgICAgICB2YXIgYmIgPSByZXN1bHRPYmplY3RbdmFyTmFtZV07XHJcbiAgICAgICAgdmFyIHRlbXAgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdE9iamVjdFt2YXJOYW1lXS5sZW5ndGg7IGkrKyApIHtcclxuICAgICAgICAgICAgdGVtcFtpXSA9IGh1bWFuaXplKGJiW2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpc1t2YXJOYW1lXSA9IHRlbXA7XHJcbiAgICB9XHJcbn07XHJcblxyXG5cclxuLypcclxuIENsYXNzIENvZGVnZW5lcmF0b3JcclxuICovXHJcbmZ1bmN0aW9uIENvZGVHZW5lcmF0b3IobmFtZXNwYWNlKSB7XHJcbiAgICBpZiAodHlwZW9mIG5hbWVzcGFjZSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICB0aGlzLm5hbWVzcGFjZSA9IG5ldyBOYW1lc3BhY2UoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XHJcbiAgICB9XHJcbn1cclxuXHJcbkNvZGVHZW5lcmF0b3IucHJvdG90eXBlLnNldE5hbWVzcGFjZSA9IGZ1bmN0aW9uKG5hbWVzcGFjZSkge1xyXG4gICAgdGhpcy5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7IC8vIHN0b3JhZ2UgZm9yIHZhcmlhYmxlIG5hbWVzXHJcbn07XHJcblxyXG5Db2RlR2VuZXJhdG9yLnByb3RvdHlwZS5nZW5lcmF0ZVZhcmlhYmxlSW5pdGlhbGlzYXRpb25Db2RlID0gZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgY29kZSA9ICd2YXIgc3RvcmFnZSA9IHt9IFxcbic7XHJcbiAgICBmb3IgKHZhciB2YXJpYWJsZSBpbiB0aGlzLm5hbWVzcGFjZS52YXJOYW1lcykge1xyXG4gICAgICAgIGNvZGUgKz0gXCJzdG9yYWdlLlwiK3RoaXMubmFtZXNwYWNlLnJlbW92ZVByZWZpeCh2YXJpYWJsZSkrXCIgPSBbXTsgXFxuXCI7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY29kZTtcclxufTtcclxuXHJcbkNvZGVHZW5lcmF0b3IucHJvdG90eXBlLmdlbmVyYXRlVmFyaWFibGVTdG9yYWdlQ29kZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIGNvZGUgPSAnJztcclxuICAgIGZvciAodmFyIHZhcmlhYmxlIGluIHRoaXMubmFtZXNwYWNlLnZhck5hbWVzKSB7XHJcbiAgICAgICAgY29kZSArPSBcInN0b3JhZ2UuXCIrdGhpcy5uYW1lc3BhY2UucmVtb3ZlUHJlZml4KHZhcmlhYmxlKStcIltpXT0gXCIrdmFyaWFibGUrXCI7IFxcblwiO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvZGU7XHJcbn07XHJcblxyXG5Db2RlR2VuZXJhdG9yLnByb3RvdHlwZS5nZW5lcmF0ZUNvZGVGcm9tQXN0ID0gZnVuY3Rpb24oYXN0KSB7XHJcblxyXG4gICAgdmFyIGNvZGUgPSBcIlwiO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhc3QubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiQVNUIGl0ZW0gPSBcIixhc3RbaV0pXHJcbiAgICAgICAgY29kZSArPSB0aGlzLnBhcnNlTm9kZShhc3RbaV0pO1xyXG5cclxuICAgIH1cclxuICAgIHJldHVybiBjb2RlO1xyXG59O1xyXG5cclxuQ29kZUdlbmVyYXRvci5wcm90b3R5cGUubWFrZVZhciA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgIHJldHVybiB0aGlzLm5hbWVzcGFjZS5jcmVhdGVWYXIobmFtZSk7XHJcbn07XHJcblxyXG5Db2RlR2VuZXJhdG9yLnByb3RvdHlwZS5wYXJzZU5vZGUgPSBmdW5jdGlvbihub2RlKSB7XHJcbiAgICAvKiBwYXJzZU5vZGUgaXMgYSByZWN1cnNpdmUgZnVuY3Rpb24gdGhhdCBwYXJzZXMgYW4gaXRlbVxyXG4gICAgICAgIG9mIHRoZSBKU09OIEFTVC4gQ2FsbHMgaXRzZWxmIHRvIHRyYXZlcnNlIHRocm91Z2ggbm9kZXMuXHJcblxyXG4gICAgICAgIDpwYXJhbTogbm9kZSA9IChwYXJ0IG9mKSBKU09OIHRyZWVcclxuICAgICovXHJcblxyXG4gICAgLyogamF2YXNjcmlwdCBjb2RlIGdlbmVyYXRpb24gaW5zcGlyZWQgYnk6XHJcbiAgICAgICAgaHR0cDovL2xpc3BlcmF0b3IubmV0L3BsdHV0L2NvbXBpbGVyL2pzLWNvZGVnZW4gKi9cclxuXHJcbiAgICBzd2l0Y2gobm9kZS50eXBlKSB7XHJcblxyXG4gICAgICAgIGNhc2UgJ0Fzc2lnbm1lbnQnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWFrZVZhcihub2RlLmxlZnQpICsgJyA9ICgnICsgdGhpcy5wYXJzZU5vZGUobm9kZS5yaWdodCkgKyAnKTtcXG4nO1xyXG4gICAgICAgIGNhc2UgJ1ZhcmlhYmxlJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1ha2VWYXIobm9kZS5uYW1lKTtcclxuICAgICAgICBjYXNlICdCaW5hcnknOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUub3BlcmF0b3IgPT0gJ14nKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIoTWF0aC5wb3coXCIrdGhpcy5wYXJzZU5vZGUobm9kZS5sZWZ0KStcIixcIit0aGlzLnBhcnNlTm9kZShub2RlLnJpZ2h0KStcIikpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCIoXCIgKyB0aGlzLnBhcnNlTm9kZShub2RlLmxlZnQpICsgbm9kZS5vcGVyYXRvciArIHRoaXMucGFyc2VOb2RlKG5vZGUucmlnaHQpICsgXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgIGNhc2UgJ1VuYXJ5JzpcclxuICAgICAgICAgICAgICAgICAgICBzd2l0Y2gobm9kZS5vcGVyYXRvcikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICctJzogICByZXR1cm4gXCIoLTEuICogXCIgKyB0aGlzLnBhcnNlTm9kZShub2RlLnJpZ2h0KSArIFwiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdOT1QnOiAgcmV0dXJuIFwiIShcIisgdGhpcy5wYXJzZU5vZGUobm9kZS5yaWdodCkgKyBcIilcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdW5hcnk6XCIgKyBKU09OLnN0cmluZ2lmeShub2RlKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cclxuICAgICAgICBjYXNlICdMb2dpY2FsJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIihcIiArIHRoaXMucGFyc2VOb2RlKG5vZGUubGVmdCkgKyBub2RlLm9wZXJhdG9yICsgdGhpcy5wYXJzZU5vZGUobm9kZS5yaWdodCkgKyBcIilcIjtcclxuICAgICAgICBjYXNlICdJZic6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJpZiAoXCIgKyB0aGlzLnBhcnNlTm9kZShub2RlLmNvbmQpICsgXCIpIHtcIiArIHRoaXMuZ2VuZXJhdGVDb2RlRnJvbUFzdChub2RlLnRoZW4pICsgXCIgfTsgXCI7XHJcbiAgICAgICAgY2FzZSAnRnVuY3Rpb24nOiB7XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2gobm9kZS5mdW5jLnRvTG93ZXJDYXNlKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdzaW4nOiByZXR1cm4gXCJNYXRoLnNpbihcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2Nvcyc6IHJldHVybiBcIk1hdGguY29zKFwiK3RoaXMucGFyc2VOb2RlKG5vZGUuZXhwcikrXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAndGFuJzogcmV0dXJuIFwiTWF0aC50YW4oXCIrdGhpcy5wYXJzZU5vZGUobm9kZS5leHByKStcIilcIjtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdleHAnOiByZXR1cm4gXCJNYXRoLmV4cChcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xuJzogIHJldHVybiBcIk1hdGgubG9nKFwiK3RoaXMucGFyc2VOb2RlKG5vZGUuZXhwcikrXCIpXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnc3FydCc6IHJldHVybiBcIk1hdGguc3FydChcIit0aGlzLnBhcnNlTm9kZShub2RlLmV4cHIpK1wiKVwiO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua293biBmdW5jdGlvbjpcIiArIEpTT04uc3RyaW5naWZ5KG5vZGUpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICBjYXNlICdOdW1iZXInOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQobm9kZS52YWx1ZS5yZXBsYWNlKCcsJywnLicpKTtcclxuICAgICAgICBjYXNlICdUcnVlJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiAndHJ1ZSc7XHJcbiAgICAgICAgY2FzZSAnRmFsc2UnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuICdmYWxzZSc7XHJcbiAgICAgICAgY2FzZSAnU3RvcCc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3Rocm93IFxcJ1N0b3BJdGVyYXRpb25cXCcnO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBwYXJzZU5vZGUoKSA6XCIgKyBKU09OLnN0cmluZ2lmeShub2RlKSk7XHJcbiAgICB9IC8qIHN3aXRjaCAobm9kZS50eXBlKSAqL1xyXG5cclxuXHJcbn07IC8qIGVuZCBvZiBwYXJzZU5vZGUoKSAgKi9cclxuLy8gZW5kIG9mIGphdmFzY3JpcHRDb2RlR2VuZXJhdG9yKClcclxuXHJcblxyXG5mdW5jdGlvbiBNb2RlbHJlZ2Vsc0V2YWx1YXRvcihtb2RlbCwgZGVidWcpIHtcclxuICAgIGlmICh0eXBlb2YgZGVidWcgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgdGhpcy5kZWJ1ZyA9IGZhbHNlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmRlYnVnID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm5hbWVzcGFjZSA9IG5ldyBOYW1lc3BhY2UoKTtcclxuICAgIHRoaXMuY29kZWdlbmVyYXRvciA9IG5ldyBDb2RlR2VuZXJhdG9yKHRoaXMubmFtZXNwYWNlKTtcclxuXHJcbiAgICBpZiAodHlwZW9mIG1vZGVsID09PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIHRoaXMubW9kZWwgPSBuZXcgbW9kZWxtb2R1bGUuTW9kZWwoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmRlYnVnKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJyoqKiBpbnB1dCAqKionKTtcclxuICAgICAgICBjb25zb2xlLmxvZyh0aGlzLm1vZGVsLnN0YXJ0d2FhcmRlbik7XHJcbiAgICAgICAgY29uc29sZS5sb2codGhpcy5tb2RlbC5tb2RlbHJlZ2Vscyk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zdGFydHdhYXJkZW5fYXN0ID0gcGFyc2VyLnBhcnNlKHRoaXMubW9kZWwuc3RhcnR3YWFyZGVuKTtcclxuICAgIHRoaXMubW9kZWxyZWdlbHNfYXN0ID0gcGFyc2VyLnBhcnNlKHRoaXMubW9kZWwubW9kZWxyZWdlbHMpO1xyXG5cclxuICAgIGlmICh0aGlzLmRlYnVnKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJyoqKiBBU1Qgc3RhcnR3YWFyZGVuICoqKicpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHRoaXMuc3RhcnR3YWFyZGVuX2FzdCwgdW5kZWZpbmVkLCA0KSk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJyoqKiBBU1QgbW9kZWxyZWdlbHMgKioqJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coSlNPTi5zdHJpbmdpZnkodGhpcy5tb2RlbHJlZ2Vsc19hc3QsIHVuZGVmaW5lZCwgNCkpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCcnKTtcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbk1vZGVscmVnZWxzRXZhbHVhdG9yLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbihOLCBOcmVzdWx0cykge1xyXG5cclxuICAgIHZhciBzdGFydHdhYXJkZW5fY29kZSA9IHRoaXMuY29kZWdlbmVyYXRvci5nZW5lcmF0ZUNvZGVGcm9tQXN0KHRoaXMuc3RhcnR3YWFyZGVuX2FzdCk7XHJcbiAgICB0aGlzLm5hbWVzcGFjZS5tb3ZlU3RhcnRXYWFyZGVuKCk7IC8vIGtlZXAgbmFtZXNwYWNlIGNsZWFuXHJcbiAgICB2YXIgbW9kZWxyZWdlbHNfY29kZSA9IHRoaXMuY29kZWdlbmVyYXRvci5nZW5lcmF0ZUNvZGVGcm9tQXN0KHRoaXMubW9kZWxyZWdlbHNfYXN0KTtcclxuXHJcbiAgICB2YXIgbW9kZWwgPSAgXCJ0cnkgXFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgIFwiICB7IFxcblwiICtcclxuICAgICAgICAgICAgICAgICBzdGFydHdhYXJkZW5fY29kZSArIFwiXFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgIHRoaXMuY29kZWdlbmVyYXRvci5nZW5lcmF0ZVZhcmlhYmxlSW5pdGlhbGlzYXRpb25Db2RlKCkgK1xyXG4gICAgICAgICAgICAgICAgIFwiICAgIGZvciAodmFyIGk9MDsgaSA8IE5yZXN1bHRzOyBpKyspIHsgXFxuIFwiICtcclxuICAgICAgICAgICAgICAgICBcIiAgICAgIGZvciAodmFyIGlubmVyPTA7IGlubmVyIDxOL05yZXN1bHRzOyBpbm5lcisrKSB7XFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgIG1vZGVscmVnZWxzX2NvZGUgKyBcIlxcblwiICtcclxuICAgICAgICAgICAgICAgICBcIiAgICAgIH0gXFxuXCIgK1xyXG4gICAgICAgICAgICAgICAgIHRoaXMuY29kZWdlbmVyYXRvci5nZW5lcmF0ZVZhcmlhYmxlU3RvcmFnZUNvZGUoKSArXHJcbiAgICAgICAgICAgICAgICAgXCIgICAgfSBcXG5cIiArXHJcbiAgICAgICAgICAgICAgICAgXCIgIH0gY2F0Y2ggKGUpIFxcblwiICtcclxuICAgICAgICAgICAgICAgICBcIiAgeyBjb25zb2xlLmxvZyhlKX0gXFxuIFwiICtcclxuICAgICAgICAgICAgICAgICBcInJldHVybiBzdG9yYWdlO1xcblwiO1xyXG5cclxuICAgIGlmICh0aGlzLmRlYnVnKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJyoqKiBnZW5lcmF0ZWQganMgKioqJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2cobW9kZWwpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiKioqIHJ1bm5pbmchICoqKiBcIik7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJOID0gXCIsIE4pO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiTnJlc3VsdHMgPSBcIiwgTnJlc3VsdHMpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciB0MSA9IERhdGUubm93KCk7XHJcblxyXG4gICAgLy8gZXZhbChtb2RlbCk7IC8vIHNsb3cuLi4gaW4gY2hyb21lID4yM1xyXG4gICAgLy8gIHRoZSBvcHRpbWlzaW5nIGNvbXBpbGVyIGRvZXMgbm90IG9wdGltaXNlIGV2YWwoKSBpbiBsb2NhbCBzY29wZVxyXG4gICAgLy8gIGh0dHA6Ly9tb2R1c2NyZWF0ZS5jb20vamF2YXNjcmlwdC1wZXJmb3JtYW5jZS10aXBzLXRyaWNrcy9cclxuICAgIHZhciBydW5Nb2RlbCA9IG5ldyBGdW5jdGlvbignTicsJ05yZXN1bHRzJyxtb2RlbCk7XHJcbiAgICB2YXIgcmVzdWx0ID0gcnVuTW9kZWwoTixOcmVzdWx0cyk7XHJcblxyXG4gICAgdmFyIHQyID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhcIlRpbWU6IFwiICsgKHQyIC0gdDEpICsgXCJtc1wiKTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG5cclxufTtcclxuXHJcbmV4cG9ydHMuTW9kZWwgPSBtb2RlbG1vZHVsZS5Nb2RlbDsgLy8gZnJvbSBtb2RlbC5qc1xyXG5leHBvcnRzLk1vZGVscmVnZWxzRXZhbHVhdG9yID0gTW9kZWxyZWdlbHNFdmFsdWF0b3I7XHJcbmV4cG9ydHMuUmVzdWx0cyA9IFJlc3VsdHM7XHJcbmV4cG9ydHMuQ29kZUdlbmVyYXRvciA9IENvZGVHZW5lcmF0b3I7XHJcbmV4cG9ydHMuTmFtZXNwYWNlID0gTmFtZXNwYWNlO1xyXG4iLCIvKlxyXG4gbW9kZWwuanNcclxuXHJcbiBNb2RlbCBDbGFzc1xyXG5cclxuIHJlYWQgYSBmcm9tIG1vZGVsLnhtbFxyXG4gc3RvcmUgbW9kZWwgaW4gc3RyaW5nIGV0Y1xyXG5cclxuXHJcbiBtb2RlbC54bWwgZXhhbXBsZTpcclxuXHJcbiA8bW9kZWxsZWVydGFhbD5cclxuIDxzdGFydHdhYXJkZW4+XHJcbiAgICAgRm1vdG9yID0gNTAwICdOXHJcbiAgICAgbSA9IDgwMCAna2dcclxuICAgICBkdCA9IDFlLTIgJ3NcclxuICAgICB2ID0gMCdtL3NcclxuICAgICBzID0gMCAnbS9zXHJcbiAgICAgdCA9IDAgJ3NcclxuIDwvc3RhcnR3YWFyZGVuPlxyXG4gPG1vZGVscmVnZWxzPlxyXG4gICAgIEZyZXM9IEZtb3RvclxyXG4gICAgIGEgPSBGcmVzL21cclxuICAgICBkdiA9IGEgKiBkdFxyXG4gICAgIHYgPSB2ICsgZHZcclxuICAgICBkcyA9IHYgKiBkdFxyXG4gICAgIHMgPSBzICsgZHNcclxuICAgICB0ID0gdCArIGR0XHJcbiAgICAgYWxzICgwKVxyXG4gICAgIGRhblxyXG4gICAgICAgU3RvcFxyXG4gICAgIEVpbmRBbHNcclxuIDwvbW9kZWxyZWdlbHM+XHJcblxyXG4gPC9tb2RlbGxlZXJ0YWFsPlxyXG4qL1xyXG5cclxudmFyIHhtbCA9IHJlcXVpcmUoJ25vZGUteG1sLWxpdGUnKTtcclxudmFyIGZzID0gcmVxdWlyZSgnZnMnKTtcclxuXHJcbmZ1bmN0aW9uIE1vZGVsKCkge1xyXG4gICAgdGhpcy5tb2RlbHJlZ2VscyA9ICcnO1xyXG4gICAgdGhpcy5zdGFydHdhYXJkZW4gPSAnJztcclxufVxyXG5cclxuTW9kZWwucHJvdG90eXBlLnJlYWRYTUxGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcclxuXHJcbiAgICB2YXIgeG1sSlNPTiA9IHhtbC5wYXJzZUZpbGVTeW5jKGZpbGVuYW1lKTtcclxuICAgIHRoaXMucGFyc2VYTUwoeG1sSlNPTik7XHJcbn07XHJcblxyXG5Nb2RlbC5wcm90b3R5cGUucmVhZFhNTFN0cmluZyA9IGZ1bmN0aW9uKHhtbFN0cmluZykge1xyXG5cclxuICAgIHZhciB4bWxKU09OID0geG1sLnBhcnNlU3RyaW5nKHhtbFN0cmluZyk7XHJcbiAgICB0aGlzLnBhcnNlWE1MKHhtbEpTT04pO1xyXG59O1xyXG5cclxuXHJcbk1vZGVsLnByb3RvdHlwZS5wYXJzZVhNTCA9IGZ1bmN0aW9uKHhtbEpTT04pIHtcclxuXHJcbiAgICBpZiAoeG1sSlNPTi5uYW1lID09ICdtb2RlbGxlZXJ0YWFsJykge1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhtbEpTT04uY2hpbGRzLmxlbmd0aDsgaSsrKSB7XHJcblxyXG4gICAgICAgICAgICBzd2l0Y2goeG1sSlNPTi5jaGlsZHNbaV0ubmFtZSl7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzdGFydHdhYXJkZW4nOiAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhcnR3YWFyZGVuID0geG1sSlNPTi5jaGlsZHNbaV0uY2hpbGRzWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FzZSAnbW9kZWxyZWdlbHMnOiAge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxyZWdlbHMgPSB4bWxKU09OLmNoaWxkc1tpXS5jaGlsZHNbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBoYW5kbGUgeG1sIGl0ZW06ICcsIHhtbEpTT04uY2hpbGRzW2ldKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcbk1vZGVsLnByb3RvdHlwZS5yZWFkQm9ndXNYTUxGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcclxuICAgIC8vIFRoaXMgcmVhZCBhIFwiYm9ndXNcIiBYTUwgZmlsZSB0aGF0IHN0aWxsIGluY2x1ZGVzIDwgaW5zdGVhZCBvZiAmbHQ7XHJcbiAgICB2YXIgYnVmID0gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCBcInV0ZjhcIik7XHJcblxyXG4gICAgdGhpcy5wYXJzZUJvZ3VzWE1MU3RyaW5nKGJ1Zik7XHJcbn07XHJcblxyXG5Nb2RlbC5wcm90b3R5cGUucGFyc2VCb2d1c1hNTFN0cmluZyA9IGZ1bmN0aW9uKHhtbFN0cmluZykge1xyXG5cclxuICAgIHZhciBhY3Rpb24gPSAwOyAvLyAwID0gZG8gbm90aGluZywgMSA9IG1vZGVscmVnZWxzLCAyID0gc3RhcnR3YWFyZGVuXHJcblxyXG4gICAgdGhpcy5zdGFydHdhYXJkZW4gPSAnJztcclxuICAgIHRoaXMubW9kZWxyZWdlbHMgPSAnJztcclxuXHJcbiAgICB2YXIgbGluZXMgPSB4bWxTdHJpbmcuc3BsaXQoJ1xcbicpO1xyXG5cclxuICAgIGZvcih2YXIgbGluZSA9IDE7IGxpbmUgPCBsaW5lcy5sZW5ndGg7IGxpbmUrKykge1xyXG5cclxuICAgICAgICAvL2NvbnNvbGUubG9nKGFjdGlvbiwgbGluZXNbbGluZV0pO1xyXG5cclxuICAgICAgICBzd2l0Y2gobGluZXNbbGluZV0ucmVwbGFjZSgnXFxyJywnJykpIHtcclxuICAgICAgICAgICAgLy8gPCBhbmQgPiBtZXNzIHRoaW5ncyB1cCBpbiB0aGUgYnJvd3NlclxyXG4gICAgICAgICAgICBjYXNlICc8bW9kZWxyZWdlbHM+JzogeyBhY3Rpb24gPSAxOyBsaW5lc1tsaW5lXSA9ICcvKiBtb2RlbHJlZ2VscyAqLyc7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgIGNhc2UgJzwvbW9kZWxyZWdlbHM+JzogeyBhY3Rpb24gPSAwOyBicmVhazsgfVxyXG4gICAgICAgICAgICBjYXNlICc8c3RhcnR3YWFyZGVuPic6IHsgYWN0aW9uID0gMjsgbGluZXNbbGluZV0gPSAnLyogc3RhcnR3YWFyZGVuICovJzsgYnJlYWs7IH1cclxuICAgICAgICAgICAgY2FzZSAnPC9zdGFydHdhYXJkZW4+JzogeyBhY3Rpb24gPSAwOyBicmVhazsgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYWN0aW9uPT0xKSB0aGlzLm1vZGVscmVnZWxzICs9IGxpbmVzW2xpbmVdKydcXG4nO1xyXG4gICAgICAgIGlmIChhY3Rpb249PTIpIHRoaXMuc3RhcnR3YWFyZGVuICs9IGxpbmVzW2xpbmVdKydcXG4nO1xyXG4gICAgfVxyXG4gICAgLy9jb25zb2xlLmxvZygnREVCVUc6IGluIG1vZGVsLmpzIHBhcnNlQm9ndXNYTUxTdHJpbmcgZW5kcmVzdWx0IHRoaXMubW9kZWxyZWdlbHM6Jyk7XHJcbiAgICAvL2NvbnNvbGUubG9nKHRoaXMubW9kZWxyZWdlbHMpO1xyXG4gICAgLy9jb25zb2xlLmxvZygnREVCVUc6IGluIG1vZGVsLmpzIHBhcnNlQm9ndXNYTUxTdHJpbmcgZW5kcmVzdWx0IHRoaXMuc3RhcnR3YWFyZGVuOicpO1xyXG4gICAgLy9jb25zb2xlLmxvZyh0aGlzLnN0YXJ0d2FhcmRlbik7XHJcblxyXG59O1xyXG5cclxuXHJcbmV4cG9ydHMuTW9kZWwgPSBNb2RlbDtcclxuIiwiLyogcGFyc2VyIGdlbmVyYXRlZCBieSBqaXNvbiAwLjQuMTUgKi9cbi8qXG4gIFJldHVybnMgYSBQYXJzZXIgb2JqZWN0IG9mIHRoZSBmb2xsb3dpbmcgc3RydWN0dXJlOlxuXG4gIFBhcnNlcjoge1xuICAgIHl5OiB7fVxuICB9XG5cbiAgUGFyc2VyLnByb3RvdHlwZToge1xuICAgIHl5OiB7fSxcbiAgICB0cmFjZTogZnVuY3Rpb24oKSxcbiAgICBzeW1ib2xzXzoge2Fzc29jaWF0aXZlIGxpc3Q6IG5hbWUgPT0+IG51bWJlcn0sXG4gICAgdGVybWluYWxzXzoge2Fzc29jaWF0aXZlIGxpc3Q6IG51bWJlciA9PT4gbmFtZX0sXG4gICAgcHJvZHVjdGlvbnNfOiBbLi4uXSxcbiAgICBwZXJmb3JtQWN0aW9uOiBmdW5jdGlvbiBhbm9ueW1vdXMoeXl0ZXh0LCB5eWxlbmcsIHl5bGluZW5vLCB5eSwgeXlzdGF0ZSwgJCQsIF8kKSxcbiAgICB0YWJsZTogWy4uLl0sXG4gICAgZGVmYXVsdEFjdGlvbnM6IHsuLi59LFxuICAgIHBhcnNlRXJyb3I6IGZ1bmN0aW9uKHN0ciwgaGFzaCksXG4gICAgcGFyc2U6IGZ1bmN0aW9uKGlucHV0KSxcblxuICAgIGxleGVyOiB7XG4gICAgICAgIEVPRjogMSxcbiAgICAgICAgcGFyc2VFcnJvcjogZnVuY3Rpb24oc3RyLCBoYXNoKSxcbiAgICAgICAgc2V0SW5wdXQ6IGZ1bmN0aW9uKGlucHV0KSxcbiAgICAgICAgaW5wdXQ6IGZ1bmN0aW9uKCksXG4gICAgICAgIHVucHV0OiBmdW5jdGlvbihzdHIpLFxuICAgICAgICBtb3JlOiBmdW5jdGlvbigpLFxuICAgICAgICBsZXNzOiBmdW5jdGlvbihuKSxcbiAgICAgICAgcGFzdElucHV0OiBmdW5jdGlvbigpLFxuICAgICAgICB1cGNvbWluZ0lucHV0OiBmdW5jdGlvbigpLFxuICAgICAgICBzaG93UG9zaXRpb246IGZ1bmN0aW9uKCksXG4gICAgICAgIHRlc3RfbWF0Y2g6IGZ1bmN0aW9uKHJlZ2V4X21hdGNoX2FycmF5LCBydWxlX2luZGV4KSxcbiAgICAgICAgbmV4dDogZnVuY3Rpb24oKSxcbiAgICAgICAgbGV4OiBmdW5jdGlvbigpLFxuICAgICAgICBiZWdpbjogZnVuY3Rpb24oY29uZGl0aW9uKSxcbiAgICAgICAgcG9wU3RhdGU6IGZ1bmN0aW9uKCksXG4gICAgICAgIF9jdXJyZW50UnVsZXM6IGZ1bmN0aW9uKCksXG4gICAgICAgIHRvcFN0YXRlOiBmdW5jdGlvbigpLFxuICAgICAgICBwdXNoU3RhdGU6IGZ1bmN0aW9uKGNvbmRpdGlvbiksXG5cbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgcmFuZ2VzOiBib29sZWFuICAgICAgICAgICAob3B0aW9uYWw6IHRydWUgPT0+IHRva2VuIGxvY2F0aW9uIGluZm8gd2lsbCBpbmNsdWRlIGEgLnJhbmdlW10gbWVtYmVyKVxuICAgICAgICAgICAgZmxleDogYm9vbGVhbiAgICAgICAgICAgICAob3B0aW9uYWw6IHRydWUgPT0+IGZsZXgtbGlrZSBsZXhpbmcgYmVoYXZpb3VyIHdoZXJlIHRoZSBydWxlcyBhcmUgdGVzdGVkIGV4aGF1c3RpdmVseSB0byBmaW5kIHRoZSBsb25nZXN0IG1hdGNoKVxuICAgICAgICAgICAgYmFja3RyYWNrX2xleGVyOiBib29sZWFuICAob3B0aW9uYWw6IHRydWUgPT0+IGxleGVyIHJlZ2V4ZXMgYXJlIHRlc3RlZCBpbiBvcmRlciBhbmQgZm9yIGVhY2ggbWF0Y2hpbmcgcmVnZXggdGhlIGFjdGlvbiBjb2RlIGlzIGludm9rZWQ7IHRoZSBsZXhlciB0ZXJtaW5hdGVzIHRoZSBzY2FuIHdoZW4gYSB0b2tlbiBpcyByZXR1cm5lZCBieSB0aGUgYWN0aW9uIGNvZGUpXG4gICAgICAgIH0sXG5cbiAgICAgICAgcGVyZm9ybUFjdGlvbjogZnVuY3Rpb24oeXksIHl5XywgJGF2b2lkaW5nX25hbWVfY29sbGlzaW9ucywgWVlfU1RBUlQpLFxuICAgICAgICBydWxlczogWy4uLl0sXG4gICAgICAgIGNvbmRpdGlvbnM6IHthc3NvY2lhdGl2ZSBsaXN0OiBuYW1lID09PiBzZXR9LFxuICAgIH1cbiAgfVxuXG5cbiAgdG9rZW4gbG9jYXRpb24gaW5mbyAoQCQsIF8kLCBldGMuKToge1xuICAgIGZpcnN0X2xpbmU6IG4sXG4gICAgbGFzdF9saW5lOiBuLFxuICAgIGZpcnN0X2NvbHVtbjogbixcbiAgICBsYXN0X2NvbHVtbjogbixcbiAgICByYW5nZTogW3N0YXJ0X251bWJlciwgZW5kX251bWJlcl0gICAgICAgKHdoZXJlIHRoZSBudW1iZXJzIGFyZSBpbmRleGVzIGludG8gdGhlIGlucHV0IHN0cmluZywgcmVndWxhciB6ZXJvLWJhc2VkKVxuICB9XG5cblxuICB0aGUgcGFyc2VFcnJvciBmdW5jdGlvbiByZWNlaXZlcyBhICdoYXNoJyBvYmplY3Qgd2l0aCB0aGVzZSBtZW1iZXJzIGZvciBsZXhlciBhbmQgcGFyc2VyIGVycm9yczoge1xuICAgIHRleHQ6ICAgICAgICAobWF0Y2hlZCB0ZXh0KVxuICAgIHRva2VuOiAgICAgICAodGhlIHByb2R1Y2VkIHRlcm1pbmFsIHRva2VuLCBpZiBhbnkpXG4gICAgbGluZTogICAgICAgICh5eWxpbmVubylcbiAgfVxuICB3aGlsZSBwYXJzZXIgKGdyYW1tYXIpIGVycm9ycyB3aWxsIGFsc28gcHJvdmlkZSB0aGVzZSBtZW1iZXJzLCBpLmUuIHBhcnNlciBlcnJvcnMgZGVsaXZlciBhIHN1cGVyc2V0IG9mIGF0dHJpYnV0ZXM6IHtcbiAgICBsb2M6ICAgICAgICAgKHl5bGxvYylcbiAgICBleHBlY3RlZDogICAgKHN0cmluZyBkZXNjcmliaW5nIHRoZSBzZXQgb2YgZXhwZWN0ZWQgdG9rZW5zKVxuICAgIHJlY292ZXJhYmxlOiAoYm9vbGVhbjogVFJVRSB3aGVuIHRoZSBwYXJzZXIgaGFzIGEgZXJyb3IgcmVjb3ZlcnkgcnVsZSBhdmFpbGFibGUgZm9yIHRoaXMgcGFydGljdWxhciBlcnJvcilcbiAgfVxuKi9cbnZhciBwYXJzZXIgPSAoZnVuY3Rpb24oKXtcbnZhciBvPWZ1bmN0aW9uKGssdixvLGwpe2ZvcihvPW98fHt9LGw9ay5sZW5ndGg7bC0tO29ba1tsXV09dik7cmV0dXJuIG99LCRWMD1bMSw0XSwkVjE9WzEsNV0sJFYyPVsxLDZdLCRWMz1bNSw3LDEwLDEzLDE0XSwkVjQ9WzEsMjBdLCRWNT1bMSwxNV0sJFY2PVsxLDEzXSwkVjc9WzEsMTRdLCRWOD1bMSwxNl0sJFY5PVsxLDE3XSwkVmE9WzEsMThdLCRWYj1bMSwxOV0sJFZjPVsxLDIzXSwkVmQ9WzEsMjRdLCRWZT1bMSwyNV0sJFZmPVsxLDI2XSwkVmc9WzEsMjddLCRWaD1bMSwyOF0sJFZpPVsxLDI5XSwkVmo9WzEsMzBdLCRWaz1bMSwzMV0sJFZsPVsxLDMyXSwkVm09WzUsNywxMCwxMiwxMywxNCwxNywxOCwxOSwyMCwyMSwyMiwyMywyNCwyNSwyNiwyN10sJFZuPVs1LDcsMTAsMTIsMTMsMTQsMTcsMjQsMjVdLCRWbz1bNSw3LDEwLDEyLDEzLDE0LDE3LDIzLDI0LDI1LDI2LDI3XSwkVnA9WzUsNywxMCwxMiwxMywxNCwxNywyNCwyNSwyNiwyN107XG52YXIgcGFyc2VyID0ge3RyYWNlOiBmdW5jdGlvbiB0cmFjZSgpIHsgfSxcbnl5OiB7fSxcbnN5bWJvbHNfOiB7XCJlcnJvclwiOjIsXCJwcm9ncmFtXCI6MyxcInN0bXRfbGlzdFwiOjQsXCJFT0ZcIjo1LFwic3RtdFwiOjYsXCJJREVOVFwiOjcsXCJBU1NJR05cIjo4LFwiZXhwclwiOjksXCJJRlwiOjEwLFwiY29uZGl0aW9uXCI6MTEsXCJUSEVOXCI6MTIsXCJFTkRJRlwiOjEzLFwiU1RPUFwiOjE0LFwiZGlyZWN0X2RlY2xhcmF0b3JcIjoxNSxcIihcIjoxNixcIilcIjoxNyxcIj09XCI6MTgsXCI+XCI6MTksXCI+PVwiOjIwLFwiPFwiOjIxLFwiPD1cIjoyMixcIl5cIjoyMyxcIitcIjoyNCxcIi1cIjoyNSxcIipcIjoyNixcIi9cIjoyNyxcIk5PVFwiOjI4LFwiTlVNQkVSXCI6MjksXCJQSVwiOjMwLFwiVFJVRVwiOjMxLFwiRkFMU0VcIjozMixcIiRhY2NlcHRcIjowLFwiJGVuZFwiOjF9LFxudGVybWluYWxzXzogezI6XCJlcnJvclwiLDU6XCJFT0ZcIiw3OlwiSURFTlRcIiw4OlwiQVNTSUdOXCIsMTA6XCJJRlwiLDEyOlwiVEhFTlwiLDEzOlwiRU5ESUZcIiwxNDpcIlNUT1BcIiwxNjpcIihcIiwxNzpcIilcIiwxODpcIj09XCIsMTk6XCI+XCIsMjA6XCI+PVwiLDIxOlwiPFwiLDIyOlwiPD1cIiwyMzpcIl5cIiwyNDpcIitcIiwyNTpcIi1cIiwyNjpcIipcIiwyNzpcIi9cIiwyODpcIk5PVFwiLDI5OlwiTlVNQkVSXCIsMzA6XCJQSVwiLDMxOlwiVFJVRVwiLDMyOlwiRkFMU0VcIn0sXG5wcm9kdWN0aW9uc186IFswLFszLDJdLFs0LDFdLFs0LDJdLFs2LDNdLFs2LDVdLFs2LDFdLFsxMSwxXSxbMTUsMV0sWzE1LDRdLFs5LDFdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDNdLFs5LDJdLFs5LDJdLFs5LDNdLFs5LDFdLFs5LDFdLFs5LDFdLFs5LDFdXSxcbnBlcmZvcm1BY3Rpb246IGZ1bmN0aW9uIGFub255bW91cyh5eXRleHQsIHl5bGVuZywgeXlsaW5lbm8sIHl5LCB5eXN0YXRlIC8qIGFjdGlvblsxXSAqLywgJCQgLyogdnN0YWNrICovLCBfJCAvKiBsc3RhY2sgKi8pIHtcbi8qIHRoaXMgPT0geXl2YWwgKi9cblxudmFyICQwID0gJCQubGVuZ3RoIC0gMTtcbnN3aXRjaCAoeXlzdGF0ZSkge1xuY2FzZSAxOlxuIHJldHVybigkJFskMC0xXSk7IFxuYnJlYWs7XG5jYXNlIDI6XG4gdGhpcy4kID0gWyQkWyQwXV07IFxuYnJlYWs7XG5jYXNlIDM6XG4gJCRbJDAtMV0ucHVzaCgkJFskMF0pOyB0aGlzLiQgPSAkJFskMC0xXTsgXG5icmVhaztcbmNhc2UgNDpcbiB0aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnQXNzaWdubWVudCcsXHJcbiAgICAgICAgICAgICAgICBsZWZ0OiAkJFskMC0yXSxcclxuICAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgXG5icmVhaztcbmNhc2UgNTpcbiB0aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnSWYnLFxyXG4gICAgICAgICAgICAgICAgY29uZDogJCRbJDAtM10sXHJcbiAgICAgICAgICAgICAgICB0aGVuOiAkJFskMC0xXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIFxuYnJlYWs7XG5jYXNlIDY6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICAgdHlwZTogJ1N0b3AnLFxyXG4gICAgICAgICAgICAgICAgIHZhbHVlOiAkJFskMF1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICBcbmJyZWFrO1xuY2FzZSA3OiBjYXNlIDEwOlxudGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDg6XG4gdGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgICB0eXBlOiAnVmFyaWFibGUnLFxyXG4gICAgICAgICAgICAgICAgICBuYW1lOiB5eXRleHRcclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgXG5icmVhaztcbmNhc2UgOTpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICB0eXBlOiAnRnVuY3Rpb24nLFxyXG4gICAgICAgICAgICAgIGZ1bmM6ICQkWyQwLTNdLFxyXG4gICAgICAgICAgICAgIGV4cHI6ICQkWyQwLTFdXHJcbiAgICAgIH07XHJcbiAgXG5icmVhaztcbmNhc2UgMTE6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgIHR5cGU6ICdMb2dpY2FsJyxcclxuICAgICAgICAgICAgICAgb3BlcmF0b3I6ICc9PScsXHJcbiAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICB9O1xyXG4gICBcbmJyZWFrO1xuY2FzZSAxMjpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICB0eXBlOiAnTG9naWNhbCcsXHJcbiAgICAgICAgICAgICAgb3BlcmF0b3I6ICc+JyxcclxuICAgICAgICAgICAgICBsZWZ0OiAkJFskMC0yXSxcclxuICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgIH07XHJcbiAgXG5icmVhaztcbmNhc2UgMTM6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnTG9naWNhbCcsXHJcbiAgICAgICAgICAgICAgICBvcGVyYXRvcjogJz49JyxcclxuICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgIH07XHJcbiAgICBcbmJyZWFrO1xuY2FzZSAxNDpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgdHlwZTogJ0xvZ2ljYWwnLFxyXG4gICAgICAgICAgICAgICBvcGVyYXRvcjogJzwnLFxyXG4gICAgICAgICAgICAgICBsZWZ0OiAkJFskMC0yXSxcclxuICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgfTtcclxuICAgXG5icmVhaztcbmNhc2UgMTU6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdMb2dpY2FsJyxcclxuICAgICAgICAgICAgICAgICAgb3BlcmF0b3I6ICc8PScsXHJcbiAgICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICAgICB9O1xyXG4gICAgICBcbmJyZWFrO1xuY2FzZSAxNjpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgICB0eXBlOiAnQmluYXJ5JyxcclxuICAgICAgICAgICAgICAgICBvcGVyYXRvcjogJ14nLFxyXG4gICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgICAgICB9O1xyXG4gICAgICAgICBcbmJyZWFrO1xuY2FzZSAxNzpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdCaW5hcnknLFxyXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6ICcrJyxcclxuICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICBcbmJyZWFrO1xuY2FzZSAxODpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgICB0eXBlOiAnQmluYXJ5JyxcclxuICAgICAgICAgICAgICAgICBvcGVyYXRvcjogJy0nLFxyXG4gICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgICAgICB9O1xyXG4gICAgICAgICBcbmJyZWFrO1xuY2FzZSAxOTpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgICB0eXBlOiAnQmluYXJ5JyxcclxuICAgICAgICAgICAgICAgICBvcGVyYXRvcjogJyonLFxyXG4gICAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICAgIHJpZ2h0OiAkJFskMF1cclxuICAgICAgICAgICB9O1xyXG4gICAgICAgICBcbmJyZWFrO1xuY2FzZSAyMDpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgdHlwZTogJ0JpbmFyeScsXHJcbiAgICAgICAgICAgICAgIG9wZXJhdG9yOiAnLycsXHJcbiAgICAgICAgICAgICAgIGxlZnQ6ICQkWyQwLTJdLFxyXG4gICAgICAgICAgICAgICByaWdodDogJCRbJDBdXHJcbiAgICAgICAgIH07XHJcbiAgICAgICBcbmJyZWFrO1xuY2FzZSAyMTpcbnRoaXMuJCA9IHtcclxuICAgICAgICAgICAgICAgICAgdHlwZTogJ1VuYXJ5JyxcclxuICAgICAgICAgICAgICAgICAgb3BlcmF0b3I6ICctJyxcclxuICAgICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgXG5icmVhaztcbmNhc2UgMjI6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnVW5hcnknLFxyXG4gICAgICAgICAgICAgICAgb3BlcmF0b3I6ICdOT1QnLFxyXG4gICAgICAgICAgICAgICAgcmlnaHQ6ICQkWyQwXVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICBcbmJyZWFrO1xuY2FzZSAyMzpcbnRoaXMuJCA9ICQkWyQwLTFdO1xuYnJlYWs7XG5jYXNlIDI0OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgICB0eXBlOiAnTnVtYmVyJyxcclxuICAgICAgICAgICAgICAgICAgdmFsdWU6ICQkWyQwXVxyXG4gICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgXG5icmVhaztcbmNhc2UgMjU6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgdHlwZTogJ051bWJlcicsXHJcbiAgICAgICAgICAgICAgdmFsdWU6IFwiMy4xNDE1OTI2NTM1OVwiXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgXG5icmVhaztcbmNhc2UgMjY6XG50aGlzLiQgPSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnVHJ1ZScsXHJcbiAgICAgICAgICAgICAgICB2YWx1ZTogJCRbJDBdXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDI3OlxudGhpcy4kID0ge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ0ZhbHNlJyxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiAkJFskMF1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgXG5icmVhaztcbn1cbn0sXG50YWJsZTogW3szOjEsNDoyLDY6Myw3OiRWMCwxMDokVjEsMTQ6JFYyfSx7MTpbM119LHs1OlsxLDddLDY6OCw3OiRWMCwxMDokVjEsMTQ6JFYyfSxvKCRWMyxbMiwyXSksezg6WzEsOV19LHs3OiRWNCw5OjExLDExOjEwLDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sbygkVjMsWzIsNl0pLHsxOlsyLDFdfSxvKCRWMyxbMiwzXSksezc6JFY0LDk6MjEsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7MTI6WzEsMjJdfSx7MTI6WzIsN10sMTg6JFZjLDE5OiRWZCwyMDokVmUsMjE6JFZmLDIyOiRWZywyMzokVmgsMjQ6JFZpLDI1OiRWaiwyNjokVmssMjc6JFZsfSxvKCRWbSxbMiwxMF0pLHs3OiRWNCw5OjMzLDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6MzQsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTozNSwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LG8oJFZtLFsyLDI0XSksbygkVm0sWzIsMjVdKSxvKCRWbSxbMiwyNl0pLG8oJFZtLFsyLDI3XSksbygkVm0sWzIsOF0sezE2OlsxLDM2XX0pLG8oJFYzLFsyLDRdLHsxODokVmMsMTk6JFZkLDIwOiRWZSwyMTokVmYsMjI6JFZnLDIzOiRWaCwyNDokVmksMjU6JFZqLDI2OiRWaywyNzokVmx9KSx7NDozNyw2OjMsNzokVjAsMTA6JFYxLDE0OiRWMn0sezc6JFY0LDk6MzgsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTozOSwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjQwLDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6NDEsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTo0MiwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjQzLDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6NDQsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7NzokVjQsOTo0NSwxNToxMiwxNjokVjUsMjU6JFY2LDI4OiRWNywyOTokVjgsMzA6JFY5LDMxOiRWYSwzMjokVmJ9LHs3OiRWNCw5OjQ2LDE1OjEyLDE2OiRWNSwyNTokVjYsMjg6JFY3LDI5OiRWOCwzMDokVjksMzE6JFZhLDMyOiRWYn0sezc6JFY0LDk6NDcsMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSxvKCRWbixbMiwyMV0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZoLDI2OiRWaywyNzokVmx9KSxvKCRWbyxbMiwyMl0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmd9KSx7MTc6WzEsNDhdLDE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZoLDI0OiRWaSwyNTokVmosMjY6JFZrLDI3OiRWbH0sezc6JFY0LDk6NDksMTU6MTIsMTY6JFY1LDI1OiRWNiwyODokVjcsMjk6JFY4LDMwOiRWOSwzMTokVmEsMzI6JFZifSx7Njo4LDc6JFYwLDEwOiRWMSwxMzpbMSw1MF0sMTQ6JFYyfSxvKFs1LDcsMTAsMTIsMTMsMTQsMTcsMTgsMjMsMjQsMjUsMjYsMjddLFsyLDExXSx7MTk6JFZkLDIwOiRWZSwyMTokVmYsMjI6JFZnfSksbygkVm0sWzIsMTJdKSxvKFs1LDcsMTAsMTIsMTMsMTQsMTcsMTgsMjAsMjEsMjIsMjMsMjQsMjUsMjYsMjddLFsyLDEzXSx7MTk6JFZkfSksbyhbNSw3LDEwLDEyLDEzLDE0LDE3LDE4LDIxLDIyLDIzLDI0LDI1LDI2LDI3XSxbMiwxNF0sezE5OiRWZCwyMDokVmV9KSxvKFs1LDcsMTAsMTIsMTMsMTQsMTcsMTgsMjIsMjMsMjQsMjUsMjYsMjddLFsyLDE1XSx7MTk6JFZkLDIwOiRWZSwyMTokVmZ9KSxvKCRWbyxbMiwxNl0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmd9KSxvKCRWbixbMiwxN10sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZoLDI2OiRWaywyNzokVmx9KSxvKCRWbixbMiwxOF0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZoLDI2OiRWaywyNzokVmx9KSxvKCRWcCxbMiwxOV0sezE4OiRWYywxOTokVmQsMjA6JFZlLDIxOiRWZiwyMjokVmcsMjM6JFZofSksbygkVnAsWzIsMjBdLHsxODokVmMsMTk6JFZkLDIwOiRWZSwyMTokVmYsMjI6JFZnLDIzOiRWaH0pLG8oJFZtLFsyLDIzXSksezE3OlsxLDUxXSwxODokVmMsMTk6JFZkLDIwOiRWZSwyMTokVmYsMjI6JFZnLDIzOiRWaCwyNDokVmksMjU6JFZqLDI2OiRWaywyNzokVmx9LG8oJFYzLFsyLDVdKSxvKCRWbSxbMiw5XSldLFxuZGVmYXVsdEFjdGlvbnM6IHs3OlsyLDFdfSxcbnBhcnNlRXJyb3I6IGZ1bmN0aW9uIHBhcnNlRXJyb3Ioc3RyLCBoYXNoKSB7XG4gICAgaWYgKGhhc2gucmVjb3ZlcmFibGUpIHtcbiAgICAgICAgdGhpcy50cmFjZShzdHIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihzdHIpO1xuICAgIH1cbn0sXG5wYXJzZTogZnVuY3Rpb24gcGFyc2UoaW5wdXQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsIHN0YWNrID0gWzBdLCB0c3RhY2sgPSBbXSwgdnN0YWNrID0gW251bGxdLCBsc3RhY2sgPSBbXSwgdGFibGUgPSB0aGlzLnRhYmxlLCB5eXRleHQgPSAnJywgeXlsaW5lbm8gPSAwLCB5eWxlbmcgPSAwLCByZWNvdmVyaW5nID0gMCwgVEVSUk9SID0gMiwgRU9GID0gMTtcbiAgICB2YXIgYXJncyA9IGxzdGFjay5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgdmFyIGxleGVyID0gT2JqZWN0LmNyZWF0ZSh0aGlzLmxleGVyKTtcbiAgICB2YXIgc2hhcmVkU3RhdGUgPSB7IHl5OiB7fSB9O1xuICAgIGZvciAodmFyIGsgaW4gdGhpcy55eSkge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMueXksIGspKSB7XG4gICAgICAgICAgICBzaGFyZWRTdGF0ZS55eVtrXSA9IHRoaXMueXlba107XG4gICAgICAgIH1cbiAgICB9XG4gICAgbGV4ZXIuc2V0SW5wdXQoaW5wdXQsIHNoYXJlZFN0YXRlLnl5KTtcbiAgICBzaGFyZWRTdGF0ZS55eS5sZXhlciA9IGxleGVyO1xuICAgIHNoYXJlZFN0YXRlLnl5LnBhcnNlciA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiBsZXhlci55eWxsb2MgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbGV4ZXIueXlsbG9jID0ge307XG4gICAgfVxuICAgIHZhciB5eWxvYyA9IGxleGVyLnl5bGxvYztcbiAgICBsc3RhY2sucHVzaCh5eWxvYyk7XG4gICAgdmFyIHJhbmdlcyA9IGxleGVyLm9wdGlvbnMgJiYgbGV4ZXIub3B0aW9ucy5yYW5nZXM7XG4gICAgaWYgKHR5cGVvZiBzaGFyZWRTdGF0ZS55eS5wYXJzZUVycm9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMucGFyc2VFcnJvciA9IHNoYXJlZFN0YXRlLnl5LnBhcnNlRXJyb3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wYXJzZUVycm9yID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHRoaXMpLnBhcnNlRXJyb3I7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBvcFN0YWNrKG4pIHtcbiAgICAgICAgc3RhY2subGVuZ3RoID0gc3RhY2subGVuZ3RoIC0gMiAqIG47XG4gICAgICAgIHZzdGFjay5sZW5ndGggPSB2c3RhY2subGVuZ3RoIC0gbjtcbiAgICAgICAgbHN0YWNrLmxlbmd0aCA9IGxzdGFjay5sZW5ndGggLSBuO1xuICAgIH1cbiAgICBfdG9rZW5fc3RhY2s6XG4gICAgICAgIGZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgICAgIHZhciB0b2tlbjtcbiAgICAgICAgICAgIHRva2VuID0gbGV4ZXIubGV4KCkgfHwgRU9GO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0b2tlbiAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IHNlbGYuc3ltYm9sc19bdG9rZW5dIHx8IHRva2VuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICB9XG4gICAgdmFyIHN5bWJvbCwgcHJlRXJyb3JTeW1ib2wsIHN0YXRlLCBhY3Rpb24sIGEsIHIsIHl5dmFsID0ge30sIHAsIGxlbiwgbmV3U3RhdGUsIGV4cGVjdGVkO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHN0YXRlID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXSkge1xuICAgICAgICAgICAgYWN0aW9uID0gdGhpcy5kZWZhdWx0QWN0aW9uc1tzdGF0ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8IHR5cGVvZiBzeW1ib2wgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBzeW1ib2wgPSBsZXgoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjdGlvbiA9IHRhYmxlW3N0YXRlXSAmJiB0YWJsZVtzdGF0ZV1bc3ltYm9sXTtcbiAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdGlvbiA9PT0gJ3VuZGVmaW5lZCcgfHwgIWFjdGlvbi5sZW5ndGggfHwgIWFjdGlvblswXSkge1xuICAgICAgICAgICAgICAgIHZhciBlcnJTdHIgPSAnJztcbiAgICAgICAgICAgICAgICBleHBlY3RlZCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAocCBpbiB0YWJsZVtzdGF0ZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMudGVybWluYWxzX1twXSAmJiBwID4gVEVSUk9SKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5wdXNoKCdcXCcnICsgdGhpcy50ZXJtaW5hbHNfW3BdICsgJ1xcJycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsZXhlci5zaG93UG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gJ1BhcnNlIGVycm9yIG9uIGxpbmUgJyArICh5eWxpbmVubyArIDEpICsgJzpcXG4nICsgbGV4ZXIuc2hvd1Bvc2l0aW9uKCkgKyAnXFxuRXhwZWN0aW5nICcgKyBleHBlY3RlZC5qb2luKCcsICcpICsgJywgZ290IFxcJycgKyAodGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sKSArICdcXCcnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVyclN0ciA9ICdQYXJzZSBlcnJvciBvbiBsaW5lICcgKyAoeXlsaW5lbm8gKyAxKSArICc6IFVuZXhwZWN0ZWQgJyArIChzeW1ib2wgPT0gRU9GID8gJ2VuZCBvZiBpbnB1dCcgOiAnXFwnJyArICh0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wpICsgJ1xcJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlRXJyb3IoZXJyU3RyLCB7XG4gICAgICAgICAgICAgICAgICAgIHRleHQ6IGxleGVyLm1hdGNoLFxuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sLFxuICAgICAgICAgICAgICAgICAgICBsaW5lOiBsZXhlci55eWxpbmVubyxcbiAgICAgICAgICAgICAgICAgICAgbG9jOiB5eWxvYyxcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWQ6IGV4cGVjdGVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIGlmIChhY3Rpb25bMF0gaW5zdGFuY2VvZiBBcnJheSAmJiBhY3Rpb24ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQYXJzZSBFcnJvcjogbXVsdGlwbGUgYWN0aW9ucyBwb3NzaWJsZSBhdCBzdGF0ZTogJyArIHN0YXRlICsgJywgdG9rZW46ICcgKyBzeW1ib2wpO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoYWN0aW9uWzBdKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHN0YWNrLnB1c2goc3ltYm9sKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKGxleGVyLnl5dGV4dCk7XG4gICAgICAgICAgICBsc3RhY2sucHVzaChsZXhlci55eWxsb2MpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChhY3Rpb25bMV0pO1xuICAgICAgICAgICAgc3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIGlmICghcHJlRXJyb3JTeW1ib2wpIHtcbiAgICAgICAgICAgICAgICB5eWxlbmcgPSBsZXhlci55eWxlbmc7XG4gICAgICAgICAgICAgICAgeXl0ZXh0ID0gbGV4ZXIueXl0ZXh0O1xuICAgICAgICAgICAgICAgIHl5bGluZW5vID0gbGV4ZXIueXlsaW5lbm87XG4gICAgICAgICAgICAgICAgeXlsb2MgPSBsZXhlci55eWxsb2M7XG4gICAgICAgICAgICAgICAgaWYgKHJlY292ZXJpbmcgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY292ZXJpbmctLTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN5bWJvbCA9IHByZUVycm9yU3ltYm9sO1xuICAgICAgICAgICAgICAgIHByZUVycm9yU3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBsZW4gPSB0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzFdO1xuICAgICAgICAgICAgeXl2YWwuJCA9IHZzdGFja1t2c3RhY2subGVuZ3RoIC0gbGVuXTtcbiAgICAgICAgICAgIHl5dmFsLl8kID0ge1xuICAgICAgICAgICAgICAgIGZpcnN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0uZmlyc3RfbGluZSxcbiAgICAgICAgICAgICAgICBsYXN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9saW5lLFxuICAgICAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9jb2x1bW4sXG4gICAgICAgICAgICAgICAgbGFzdF9jb2x1bW46IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9jb2x1bW5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAocmFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgeXl2YWwuXyQucmFuZ2UgPSBbXG4gICAgICAgICAgICAgICAgICAgIGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0ucmFuZ2VbMF0sXG4gICAgICAgICAgICAgICAgICAgIGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ucmFuZ2VbMV1cbiAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgciA9IHRoaXMucGVyZm9ybUFjdGlvbi5hcHBseSh5eXZhbCwgW1xuICAgICAgICAgICAgICAgIHl5dGV4dCxcbiAgICAgICAgICAgICAgICB5eWxlbmcsXG4gICAgICAgICAgICAgICAgeXlsaW5lbm8sXG4gICAgICAgICAgICAgICAgc2hhcmVkU3RhdGUueXksXG4gICAgICAgICAgICAgICAgYWN0aW9uWzFdLFxuICAgICAgICAgICAgICAgIHZzdGFjayxcbiAgICAgICAgICAgICAgICBsc3RhY2tcbiAgICAgICAgICAgIF0uY29uY2F0KGFyZ3MpKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICBzdGFjayA9IHN0YWNrLnNsaWNlKDAsIC0xICogbGVuICogMik7XG4gICAgICAgICAgICAgICAgdnN0YWNrID0gdnN0YWNrLnNsaWNlKDAsIC0xICogbGVuKTtcbiAgICAgICAgICAgICAgICBsc3RhY2sgPSBsc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhY2sucHVzaCh0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzBdKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKHl5dmFsLiQpO1xuICAgICAgICAgICAgbHN0YWNrLnB1c2goeXl2YWwuXyQpO1xuICAgICAgICAgICAgbmV3U3RhdGUgPSB0YWJsZVtzdGFja1tzdGFjay5sZW5ndGggLSAyXV1bc3RhY2tbc3RhY2subGVuZ3RoIC0gMV1dO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXdTdGF0ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59fTtcbi8qIGdlbmVyYXRlZCBieSBqaXNvbi1sZXggMC4zLjQgKi9cbnZhciBsZXhlciA9IChmdW5jdGlvbigpe1xudmFyIGxleGVyID0gKHtcblxuRU9GOjEsXG5cbnBhcnNlRXJyb3I6ZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICAgICAgaWYgKHRoaXMueXkucGFyc2VyKSB7XG4gICAgICAgICAgICB0aGlzLnl5LnBhcnNlci5wYXJzZUVycm9yKHN0ciwgaGFzaCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbiAgICAgICAgfVxuICAgIH0sXG5cbi8vIHJlc2V0cyB0aGUgbGV4ZXIsIHNldHMgbmV3IGlucHV0XG5zZXRJbnB1dDpmdW5jdGlvbiAoaW5wdXQsIHl5KSB7XG4gICAgICAgIHRoaXMueXkgPSB5eSB8fCB0aGlzLnl5IHx8IHt9O1xuICAgICAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xuICAgICAgICB0aGlzLl9tb3JlID0gdGhpcy5fYmFja3RyYWNrID0gdGhpcy5kb25lID0gZmFsc2U7XG4gICAgICAgIHRoaXMueXlsaW5lbm8gPSB0aGlzLnl5bGVuZyA9IDA7XG4gICAgICAgIHRoaXMueXl0ZXh0ID0gdGhpcy5tYXRjaGVkID0gdGhpcy5tYXRjaCA9ICcnO1xuICAgICAgICB0aGlzLmNvbmRpdGlvblN0YWNrID0gWydJTklUSUFMJ107XG4gICAgICAgIHRoaXMueXlsbG9jID0ge1xuICAgICAgICAgICAgZmlyc3RfbGluZTogMSxcbiAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogMCxcbiAgICAgICAgICAgIGxhc3RfbGluZTogMSxcbiAgICAgICAgICAgIGxhc3RfY29sdW1uOiAwXG4gICAgICAgIH07XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmFuZ2VzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFswLDBdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuLy8gY29uc3VtZXMgYW5kIHJldHVybnMgb25lIGNoYXIgZnJvbSB0aGUgaW5wdXRcbmlucHV0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNoID0gdGhpcy5faW5wdXRbMF07XG4gICAgICAgIHRoaXMueXl0ZXh0ICs9IGNoO1xuICAgICAgICB0aGlzLnl5bGVuZysrO1xuICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICB0aGlzLm1hdGNoICs9IGNoO1xuICAgICAgICB0aGlzLm1hdGNoZWQgKz0gY2g7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLm1hdGNoKC8oPzpcXHJcXG4/fFxcbikuKi9nKTtcbiAgICAgICAgaWYgKGxpbmVzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGluZW5vKys7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5sYXN0X2xpbmUrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfY29sdW1uKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlWzFdKys7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pbnB1dCA9IHRoaXMuX2lucHV0LnNsaWNlKDEpO1xuICAgICAgICByZXR1cm4gY2g7XG4gICAgfSxcblxuLy8gdW5zaGlmdHMgb25lIGNoYXIgKG9yIGEgc3RyaW5nKSBpbnRvIHRoZSBpbnB1dFxudW5wdXQ6ZnVuY3Rpb24gKGNoKSB7XG4gICAgICAgIHZhciBsZW4gPSBjaC5sZW5ndGg7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLnNwbGl0KC8oPzpcXHJcXG4/fFxcbikvZyk7XG5cbiAgICAgICAgdGhpcy5faW5wdXQgPSBjaCArIHRoaXMuX2lucHV0O1xuICAgICAgICB0aGlzLnl5dGV4dCA9IHRoaXMueXl0ZXh0LnN1YnN0cigwLCB0aGlzLnl5dGV4dC5sZW5ndGggLSBsZW4pO1xuICAgICAgICAvL3RoaXMueXlsZW5nIC09IGxlbjtcbiAgICAgICAgdGhpcy5vZmZzZXQgLT0gbGVuO1xuICAgICAgICB2YXIgb2xkTGluZXMgPSB0aGlzLm1hdGNoLnNwbGl0KC8oPzpcXHJcXG4/fFxcbikvZyk7XG4gICAgICAgIHRoaXMubWF0Y2ggPSB0aGlzLm1hdGNoLnN1YnN0cigwLCB0aGlzLm1hdGNoLmxlbmd0aCAtIDEpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoZWQuc3Vic3RyKDAsIHRoaXMubWF0Y2hlZC5sZW5ndGggLSAxKTtcblxuICAgICAgICBpZiAobGluZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgdGhpcy55eWxpbmVubyAtPSBsaW5lcy5sZW5ndGggLSAxO1xuICAgICAgICB9XG4gICAgICAgIHZhciByID0gdGhpcy55eWxsb2MucmFuZ2U7XG5cbiAgICAgICAgdGhpcy55eWxsb2MgPSB7XG4gICAgICAgICAgICBmaXJzdF9saW5lOiB0aGlzLnl5bGxvYy5maXJzdF9saW5lLFxuICAgICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vICsgMSxcbiAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uLFxuICAgICAgICAgICAgbGFzdF9jb2x1bW46IGxpbmVzID9cbiAgICAgICAgICAgICAgICAobGluZXMubGVuZ3RoID09PSBvbGRMaW5lcy5sZW5ndGggPyB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4gOiAwKVxuICAgICAgICAgICAgICAgICArIG9sZExpbmVzW29sZExpbmVzLmxlbmd0aCAtIGxpbmVzLmxlbmd0aF0ubGVuZ3RoIC0gbGluZXNbMF0ubGVuZ3RoIDpcbiAgICAgICAgICAgICAgdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uIC0gbGVuXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3JbMF0sIHJbMF0gKyB0aGlzLnl5bGVuZyAtIGxlbl07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy55eWxlbmcgPSB0aGlzLnl5dGV4dC5sZW5ndGg7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbi8vIFdoZW4gY2FsbGVkIGZyb20gYWN0aW9uLCBjYWNoZXMgbWF0Y2hlZCB0ZXh0IGFuZCBhcHBlbmRzIGl0IG9uIG5leHQgYWN0aW9uXG5tb3JlOmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5fbW9yZSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbi8vIFdoZW4gY2FsbGVkIGZyb20gYWN0aW9uLCBzaWduYWxzIHRoZSBsZXhlciB0aGF0IHRoaXMgcnVsZSBmYWlscyB0byBtYXRjaCB0aGUgaW5wdXQsIHNvIHRoZSBuZXh0IG1hdGNoaW5nIHJ1bGUgKHJlZ2V4KSBzaG91bGQgYmUgdGVzdGVkIGluc3RlYWQuXG5yZWplY3Q6ZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJhY2t0cmFja19sZXhlcikge1xuICAgICAgICAgICAgdGhpcy5fYmFja3RyYWNrID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlRXJyb3IoJ0xleGljYWwgZXJyb3Igb24gbGluZSAnICsgKHRoaXMueXlsaW5lbm8gKyAxKSArICcuIFlvdSBjYW4gb25seSBpbnZva2UgcmVqZWN0KCkgaW4gdGhlIGxleGVyIHdoZW4gdGhlIGxleGVyIGlzIG9mIHRoZSBiYWNrdHJhY2tpbmcgcGVyc3Vhc2lvbiAob3B0aW9ucy5iYWNrdHJhY2tfbGV4ZXIgPSB0cnVlKS5cXG4nICsgdGhpcy5zaG93UG9zaXRpb24oKSwge1xuICAgICAgICAgICAgICAgIHRleHQ6IFwiXCIsXG4gICAgICAgICAgICAgICAgdG9rZW46IG51bGwsXG4gICAgICAgICAgICAgICAgbGluZTogdGhpcy55eWxpbmVub1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4vLyByZXRhaW4gZmlyc3QgbiBjaGFyYWN0ZXJzIG9mIHRoZSBtYXRjaFxubGVzczpmdW5jdGlvbiAobikge1xuICAgICAgICB0aGlzLnVucHV0KHRoaXMubWF0Y2guc2xpY2UobikpO1xuICAgIH0sXG5cbi8vIGRpc3BsYXlzIGFscmVhZHkgbWF0Y2hlZCBpbnB1dCwgaS5lLiBmb3IgZXJyb3IgbWVzc2FnZXNcbnBhc3RJbnB1dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBwYXN0ID0gdGhpcy5tYXRjaGVkLnN1YnN0cigwLCB0aGlzLm1hdGNoZWQubGVuZ3RoIC0gdGhpcy5tYXRjaC5sZW5ndGgpO1xuICAgICAgICByZXR1cm4gKHBhc3QubGVuZ3RoID4gMjAgPyAnLi4uJzonJykgKyBwYXN0LnN1YnN0cigtMjApLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxuXG4vLyBkaXNwbGF5cyB1cGNvbWluZyBpbnB1dCwgaS5lLiBmb3IgZXJyb3IgbWVzc2FnZXNcbnVwY29taW5nSW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMubWF0Y2g7XG4gICAgICAgIGlmIChuZXh0Lmxlbmd0aCA8IDIwKSB7XG4gICAgICAgICAgICBuZXh0ICs9IHRoaXMuX2lucHV0LnN1YnN0cigwLCAyMC1uZXh0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChuZXh0LnN1YnN0cigwLDIwKSArIChuZXh0Lmxlbmd0aCA+IDIwID8gJy4uLicgOiAnJykpLnJlcGxhY2UoL1xcbi9nLCBcIlwiKTtcbiAgICB9LFxuXG4vLyBkaXNwbGF5cyB0aGUgY2hhcmFjdGVyIHBvc2l0aW9uIHdoZXJlIHRoZSBsZXhpbmcgZXJyb3Igb2NjdXJyZWQsIGkuZS4gZm9yIGVycm9yIG1lc3NhZ2VzXG5zaG93UG9zaXRpb246ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcHJlID0gdGhpcy5wYXN0SW5wdXQoKTtcbiAgICAgICAgdmFyIGMgPSBuZXcgQXJyYXkocHJlLmxlbmd0aCArIDEpLmpvaW4oXCItXCIpO1xuICAgICAgICByZXR1cm4gcHJlICsgdGhpcy51cGNvbWluZ0lucHV0KCkgKyBcIlxcblwiICsgYyArIFwiXlwiO1xuICAgIH0sXG5cbi8vIHRlc3QgdGhlIGxleGVkIHRva2VuOiByZXR1cm4gRkFMU0Ugd2hlbiBub3QgYSBtYXRjaCwgb3RoZXJ3aXNlIHJldHVybiB0b2tlblxudGVzdF9tYXRjaDpmdW5jdGlvbiAobWF0Y2gsIGluZGV4ZWRfcnVsZSkge1xuICAgICAgICB2YXIgdG9rZW4sXG4gICAgICAgICAgICBsaW5lcyxcbiAgICAgICAgICAgIGJhY2t1cDtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJhY2t0cmFja19sZXhlcikge1xuICAgICAgICAgICAgLy8gc2F2ZSBjb250ZXh0XG4gICAgICAgICAgICBiYWNrdXAgPSB7XG4gICAgICAgICAgICAgICAgeXlsaW5lbm86IHRoaXMueXlsaW5lbm8sXG4gICAgICAgICAgICAgICAgeXlsbG9jOiB7XG4gICAgICAgICAgICAgICAgICAgIGZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmZpcnN0X2xpbmUsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RfbGluZTogdGhpcy5sYXN0X2xpbmUsXG4gICAgICAgICAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uLFxuICAgICAgICAgICAgICAgICAgICBsYXN0X2NvbHVtbjogdGhpcy55eWxsb2MubGFzdF9jb2x1bW5cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHl5dGV4dDogdGhpcy55eXRleHQsXG4gICAgICAgICAgICAgICAgbWF0Y2g6IHRoaXMubWF0Y2gsXG4gICAgICAgICAgICAgICAgbWF0Y2hlczogdGhpcy5tYXRjaGVzLFxuICAgICAgICAgICAgICAgIG1hdGNoZWQ6IHRoaXMubWF0Y2hlZCxcbiAgICAgICAgICAgICAgICB5eWxlbmc6IHRoaXMueXlsZW5nLFxuICAgICAgICAgICAgICAgIG9mZnNldDogdGhpcy5vZmZzZXQsXG4gICAgICAgICAgICAgICAgX21vcmU6IHRoaXMuX21vcmUsXG4gICAgICAgICAgICAgICAgX2lucHV0OiB0aGlzLl9pbnB1dCxcbiAgICAgICAgICAgICAgICB5eTogdGhpcy55eSxcbiAgICAgICAgICAgICAgICBjb25kaXRpb25TdGFjazogdGhpcy5jb25kaXRpb25TdGFjay5zbGljZSgwKSxcbiAgICAgICAgICAgICAgICBkb25lOiB0aGlzLmRvbmVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgICAgIGJhY2t1cC55eWxsb2MucmFuZ2UgPSB0aGlzLnl5bGxvYy5yYW5nZS5zbGljZSgwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxpbmVzID0gbWF0Y2hbMF0ubWF0Y2goLyg/Olxcclxcbj98XFxuKS4qL2cpO1xuICAgICAgICBpZiAobGluZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsaW5lbm8gKz0gbGluZXMubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMueXlsbG9jID0ge1xuICAgICAgICAgICAgZmlyc3RfbGluZTogdGhpcy55eWxsb2MubGFzdF9saW5lLFxuICAgICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vICsgMSxcbiAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MubGFzdF9jb2x1bW4sXG4gICAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgP1xuICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCAtIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLm1hdGNoKC9cXHI/XFxuPy8pWzBdLmxlbmd0aCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy55eWxsb2MubGFzdF9jb2x1bW4gKyBtYXRjaFswXS5sZW5ndGhcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy55eXRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgIHRoaXMubWF0Y2ggKz0gbWF0Y2hbMF07XG4gICAgICAgIHRoaXMubWF0Y2hlcyA9IG1hdGNoO1xuICAgICAgICB0aGlzLnl5bGVuZyA9IHRoaXMueXl0ZXh0Lmxlbmd0aDtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLnJhbmdlID0gW3RoaXMub2Zmc2V0LCB0aGlzLm9mZnNldCArPSB0aGlzLnl5bGVuZ107XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbW9yZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9iYWNrdHJhY2sgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faW5wdXQgPSB0aGlzLl9pbnB1dC5zbGljZShtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgKz0gbWF0Y2hbMF07XG4gICAgICAgIHRva2VuID0gdGhpcy5wZXJmb3JtQWN0aW9uLmNhbGwodGhpcywgdGhpcy55eSwgdGhpcywgaW5kZXhlZF9ydWxlLCB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoIC0gMV0pO1xuICAgICAgICBpZiAodGhpcy5kb25lICYmIHRoaXMuX2lucHV0KSB7XG4gICAgICAgICAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodG9rZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB0b2tlbjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9iYWNrdHJhY2spIHtcbiAgICAgICAgICAgIC8vIHJlY292ZXIgY29udGV4dFxuICAgICAgICAgICAgZm9yICh2YXIgayBpbiBiYWNrdXApIHtcbiAgICAgICAgICAgICAgICB0aGlzW2tdID0gYmFja3VwW2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBydWxlIGFjdGlvbiBjYWxsZWQgcmVqZWN0KCkgaW1wbHlpbmcgdGhlIG5leHQgcnVsZSBzaG91bGQgYmUgdGVzdGVkIGluc3RlYWQuXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbi8vIHJldHVybiBuZXh0IG1hdGNoIGluIGlucHV0XG5uZXh0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5faW5wdXQpIHtcbiAgICAgICAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdG9rZW4sXG4gICAgICAgICAgICBtYXRjaCxcbiAgICAgICAgICAgIHRlbXBNYXRjaCxcbiAgICAgICAgICAgIGluZGV4O1xuICAgICAgICBpZiAoIXRoaXMuX21vcmUpIHtcbiAgICAgICAgICAgIHRoaXMueXl0ZXh0ID0gJyc7XG4gICAgICAgICAgICB0aGlzLm1hdGNoID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJ1bGVzID0gdGhpcy5fY3VycmVudFJ1bGVzKCk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRlbXBNYXRjaCA9IHRoaXMuX2lucHV0Lm1hdGNoKHRoaXMucnVsZXNbcnVsZXNbaV1dKTtcbiAgICAgICAgICAgIGlmICh0ZW1wTWF0Y2ggJiYgKCFtYXRjaCB8fCB0ZW1wTWF0Y2hbMF0ubGVuZ3RoID4gbWF0Y2hbMF0ubGVuZ3RoKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoID0gdGVtcE1hdGNoO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJhY2t0cmFja19sZXhlcikge1xuICAgICAgICAgICAgICAgICAgICB0b2tlbiA9IHRoaXMudGVzdF9tYXRjaCh0ZW1wTWF0Y2gsIHJ1bGVzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRva2VuICE9PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JhY2t0cmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2ggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvLyBydWxlIGFjdGlvbiBjYWxsZWQgcmVqZWN0KCkgaW1wbHlpbmcgYSBydWxlIE1JU21hdGNoLlxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZWxzZTogdGhpcyBpcyBhIGxleGVyIHJ1bGUgd2hpY2ggY29uc3VtZXMgaW5wdXQgd2l0aG91dCBwcm9kdWNpbmcgYSB0b2tlbiAoZS5nLiB3aGl0ZXNwYWNlKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5vcHRpb25zLmZsZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLnRlc3RfbWF0Y2gobWF0Y2gsIHJ1bGVzW2luZGV4XSk7XG4gICAgICAgICAgICBpZiAodG9rZW4gIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZWxzZTogdGhpcyBpcyBhIGxleGVyIHJ1bGUgd2hpY2ggY29uc3VtZXMgaW5wdXQgd2l0aG91dCBwcm9kdWNpbmcgYSB0b2tlbiAoZS5nLiB3aGl0ZXNwYWNlKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9pbnB1dCA9PT0gXCJcIikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuRU9GO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VFcnJvcignTGV4aWNhbCBlcnJvciBvbiBsaW5lICcgKyAodGhpcy55eWxpbmVubyArIDEpICsgJy4gVW5yZWNvZ25pemVkIHRleHQuXFxuJyArIHRoaXMuc2hvd1Bvc2l0aW9uKCksIHtcbiAgICAgICAgICAgICAgICB0ZXh0OiBcIlwiLFxuICAgICAgICAgICAgICAgIHRva2VuOiBudWxsLFxuICAgICAgICAgICAgICAgIGxpbmU6IHRoaXMueXlsaW5lbm9cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSxcblxuLy8gcmV0dXJuIG5leHQgbWF0Y2ggdGhhdCBoYXMgYSB0b2tlblxubGV4OmZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgdmFyIHIgPSB0aGlzLm5leHQoKTtcbiAgICAgICAgaWYgKHIpIHtcbiAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGV4KCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4vLyBhY3RpdmF0ZXMgYSBuZXcgbGV4ZXIgY29uZGl0aW9uIHN0YXRlIChwdXNoZXMgdGhlIG5ldyBsZXhlciBjb25kaXRpb24gc3RhdGUgb250byB0aGUgY29uZGl0aW9uIHN0YWNrKVxuYmVnaW46ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sucHVzaChjb25kaXRpb24pO1xuICAgIH0sXG5cbi8vIHBvcCB0aGUgcHJldmlvdXNseSBhY3RpdmUgbGV4ZXIgY29uZGl0aW9uIHN0YXRlIG9mZiB0aGUgY29uZGl0aW9uIHN0YWNrXG5wb3BTdGF0ZTpmdW5jdGlvbiBwb3BTdGF0ZSgpIHtcbiAgICAgICAgdmFyIG4gPSB0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aCAtIDE7XG4gICAgICAgIGlmIChuID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFja1swXTtcbiAgICAgICAgfVxuICAgIH0sXG5cbi8vIHByb2R1Y2UgdGhlIGxleGVyIHJ1bGUgc2V0IHdoaWNoIGlzIGFjdGl2ZSBmb3IgdGhlIGN1cnJlbnRseSBhY3RpdmUgbGV4ZXIgY29uZGl0aW9uIHN0YXRlXG5fY3VycmVudFJ1bGVzOmZ1bmN0aW9uIF9jdXJyZW50UnVsZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aCAmJiB0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoIC0gMV0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvbnNbdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aCAtIDFdXS5ydWxlcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbmRpdGlvbnNbXCJJTklUSUFMXCJdLnJ1bGVzO1xuICAgICAgICB9XG4gICAgfSxcblxuLy8gcmV0dXJuIHRoZSBjdXJyZW50bHkgYWN0aXZlIGxleGVyIGNvbmRpdGlvbiBzdGF0ZTsgd2hlbiBhbiBpbmRleCBhcmd1bWVudCBpcyBwcm92aWRlZCBpdCBwcm9kdWNlcyB0aGUgTi10aCBwcmV2aW91cyBjb25kaXRpb24gc3RhdGUsIGlmIGF2YWlsYWJsZVxudG9wU3RhdGU6ZnVuY3Rpb24gdG9wU3RhdGUobikge1xuICAgICAgICBuID0gdGhpcy5jb25kaXRpb25TdGFjay5sZW5ndGggLSAxIC0gTWF0aC5hYnMobiB8fCAwKTtcbiAgICAgICAgaWYgKG4gPj0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2tbbl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gXCJJTklUSUFMXCI7XG4gICAgICAgIH1cbiAgICB9LFxuXG4vLyBhbGlhcyBmb3IgYmVnaW4oY29uZGl0aW9uKVxucHVzaFN0YXRlOmZ1bmN0aW9uIHB1c2hTdGF0ZShjb25kaXRpb24pIHtcbiAgICAgICAgdGhpcy5iZWdpbihjb25kaXRpb24pO1xuICAgIH0sXG5cbi8vIHJldHVybiB0aGUgbnVtYmVyIG9mIHN0YXRlcyBjdXJyZW50bHkgb24gdGhlIHN0YWNrXG5zdGF0ZVN0YWNrU2l6ZTpmdW5jdGlvbiBzdGF0ZVN0YWNrU2l6ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoO1xuICAgIH0sXG5vcHRpb25zOiB7fSxcbnBlcmZvcm1BY3Rpb246IGZ1bmN0aW9uIGFub255bW91cyh5eSx5eV8sJGF2b2lkaW5nX25hbWVfY29sbGlzaW9ucyxZWV9TVEFSVCkge1xudmFyIFlZU1RBVEU9WVlfU1RBUlQ7XG5zd2l0Y2goJGF2b2lkaW5nX25hbWVfY29sbGlzaW9ucykge1xuY2FzZSAwOi8qIGlnbm9yZSB3aGl0ZXNwYWNlcyAqL1xuYnJlYWs7XG5jYXNlIDE6LyogaWdub3JlIHdoaXRlc3BhY2VzICovXG5icmVhaztcbmNhc2UgMjovKiBtb2RlbGxlZXJ0YWFsIGNvbW1lbnQgKi9cbmJyZWFrO1xuY2FzZSAzOi8qIEMtc3R5bGUgbXVsdGlsaW5lIGNvbW1lbnQgKi9cbmJyZWFrO1xuY2FzZSA0Oi8qIEMtc3R5bGUgY29tbWVudCAqL1xuYnJlYWs7XG5jYXNlIDU6LyogUHl0aG9uIHN0eWxlIGNvbW1lbnQgKi9cbmJyZWFrO1xuY2FzZSA2OnJldHVybiAxNlxuYnJlYWs7XG5jYXNlIDc6cmV0dXJuIDE3XG5icmVhaztcbmNhc2UgODpyZXR1cm4gMzBcbmJyZWFrO1xuY2FzZSA5OnJldHVybiAxOFxuYnJlYWs7XG5jYXNlIDEwOnJldHVybiAyMFxuYnJlYWs7XG5jYXNlIDExOnJldHVybiAyMlxuYnJlYWs7XG5jYXNlIDEyOnJldHVybiAxOVxuYnJlYWs7XG5jYXNlIDEzOnJldHVybiAyMVxuYnJlYWs7XG5jYXNlIDE0OnJldHVybiAyOFxuYnJlYWs7XG5jYXNlIDE1OnJldHVybiAzMVxuYnJlYWs7XG5jYXNlIDE2OnJldHVybiAzMlxuYnJlYWs7XG5jYXNlIDE3OnJldHVybiA4XG5icmVhaztcbmNhc2UgMTg6cmV0dXJuIDhcbmJyZWFrO1xuY2FzZSAxOTpyZXR1cm4gMjlcbmJyZWFrO1xuY2FzZSAyMDpyZXR1cm4gMjlcbmJyZWFrO1xuY2FzZSAyMTpyZXR1cm4gMjlcbmJyZWFrO1xuY2FzZSAyMjpyZXR1cm4gMjNcbmJyZWFrO1xuY2FzZSAyMzpyZXR1cm4gMjRcbmJyZWFrO1xuY2FzZSAyNDpyZXR1cm4gMjVcbmJyZWFrO1xuY2FzZSAyNTpyZXR1cm4gMjZcbmJyZWFrO1xuY2FzZSAyNjpyZXR1cm4gMjdcbmJyZWFrO1xuY2FzZSAyNzpyZXR1cm4gMTBcbmJyZWFrO1xuY2FzZSAyODpyZXR1cm4gMTJcbmJyZWFrO1xuY2FzZSAyOTpyZXR1cm4gMTNcbmJyZWFrO1xuY2FzZSAzMDpyZXR1cm4gMTRcbmJyZWFrO1xuY2FzZSAzMTpyZXR1cm4gN1xuYnJlYWs7XG5jYXNlIDMyOnJldHVybiA1XG5icmVhaztcbn1cbn0sXG5ydWxlczogWy9eKD86XFxzKykvLC9eKD86XFx0KykvLC9eKD86J1teXFxuXSopLywvXig/OlxcL1xcKigufFxcbnxcXHIpKj9cXCpcXC8pLywvXig/OlxcL1xcL1teXFxuXSopLywvXig/OiNbXlxcbl0qKS8sL14oPzpcXCgpLywvXig/OlxcKSkvLC9eKD86cGlcXGIpLywvXig/Oj09KS8sL14oPzo+PSkvLC9eKD86PD0pLywvXig/Oj4pLywvXig/OjwpLywvXig/OiF8TmlldHxuaWV0XFxiKS8sL14oPzpXYWFyfHdhYXJcXGIpLywvXig/Ok9ud2FhcnxvbndhYXJ8T25XYWFyfEZhbHNlXFxiKS8sL14oPzo9KS8sL14oPzo6PSkvLC9eKD86WzAtOV0qW1wiLlwiXCIsXCJdWzAtOV0rKFtFZV1bKy1dP1swLTldKyk/KS8sL14oPzpbMC05XStbXCIuXCJcIixcIl1bMC05XSooW0VlXVsrLV0/WzAtOV0rKT8pLywvXig/OlswLTldKyhbRWVdWystXT9bMC05XSspPykvLC9eKD86XFxeKS8sL14oPzpcXCspLywvXig/Oi0pLywvXig/OlxcKikvLC9eKD86XFwvKS8sL14oPzpBbHN8YWxzXFxiKS8sL14oPzpEYW58ZGFuXFxiKS8sL14oPzpFaW5kQWxzfEVpbmRhbHN8ZWluZGFsc1xcYikvLC9eKD86U3RvcHxzdG9wXFxiKS8sL14oPzpbYS16QS1aXSsoW2EtekEtWjAtOV9dKT8pLywvXig/OiQpL10sXG5jb25kaXRpb25zOiB7XCJJTklUSUFMXCI6e1wicnVsZXNcIjpbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSwxNiwxNywxOCwxOSwyMCwyMSwyMiwyMywyNCwyNSwyNiwyNywyOCwyOSwzMCwzMSwzMl0sXCJpbmNsdXNpdmVcIjp0cnVlfX1cbn0pO1xucmV0dXJuIGxleGVyO1xufSkoKTtcbnBhcnNlci5sZXhlciA9IGxleGVyO1xuZnVuY3Rpb24gUGFyc2VyICgpIHtcbiAgdGhpcy55eSA9IHt9O1xufVxuUGFyc2VyLnByb3RvdHlwZSA9IHBhcnNlcjtwYXJzZXIuUGFyc2VyID0gUGFyc2VyO1xucmV0dXJuIG5ldyBQYXJzZXI7XG59KSgpO1xuXG5cbmlmICh0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5leHBvcnRzLnBhcnNlciA9IHBhcnNlcjtcbmV4cG9ydHMuUGFyc2VyID0gcGFyc2VyLlBhcnNlcjtcbmV4cG9ydHMucGFyc2UgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBwYXJzZXIucGFyc2UuYXBwbHkocGFyc2VyLCBhcmd1bWVudHMpOyB9O1xuZXhwb3J0cy5tYWluID0gZnVuY3Rpb24gY29tbW9uanNNYWluKGFyZ3MpIHtcbiAgICBpZiAoIWFyZ3NbMV0pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1VzYWdlOiAnK2FyZ3NbMF0rJyBGSUxFJyk7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG4gICAgdmFyIHNvdXJjZSA9IHJlcXVpcmUoJ2ZzJykucmVhZEZpbGVTeW5jKHJlcXVpcmUoJ3BhdGgnKS5ub3JtYWxpemUoYXJnc1sxXSksIFwidXRmOFwiKTtcbiAgICByZXR1cm4gZXhwb3J0cy5wYXJzZXIucGFyc2Uoc291cmNlKTtcbn07XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgcmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgZXhwb3J0cy5tYWluKHByb2Nlc3MuYXJndi5zbGljZSgxKSk7XG59XG59IixudWxsLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxmZXJvc3NAZmVyb3NzLm9yZz4gPGh0dHA6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXMtYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIGtNYXhMZW5ndGggPSAweDNmZmZmZmZmXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIE5vdGU6XG4gKlxuICogLSBJbXBsZW1lbnRhdGlvbiBtdXN0IHN1cHBvcnQgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMuXG4gKiAgIEZpcmVmb3ggNC0yOSBsYWNrZWQgc3VwcG9ydCwgZml4ZWQgaW4gRmlyZWZveCAzMCsuXG4gKiAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG4gKlxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXkgd2lsbFxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgd2lsbCB3b3JrIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSAoZnVuY3Rpb24gKCkge1xuICB0cnkge1xuICAgIHZhciBidWYgPSBuZXcgQXJyYXlCdWZmZXIoMClcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgbmV3IFVpbnQ4QXJyYXkoMSkuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn0pKClcblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgLy8gQXZvaWQgZ29pbmcgdGhyb3VnaCBhbiBBcmd1bWVudHNBZGFwdG9yVHJhbXBvbGluZSBpbiB0aGUgY29tbW9uIGNhc2UuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGFyZ3VtZW50c1sxXSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcpXG4gIH1cblxuICB0aGlzLmxlbmd0aCA9IDBcbiAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGZyb21OdW1iZXIodGhpcywgYXJnKVxuICB9XG5cbiAgLy8gU2xpZ2h0bHkgbGVzcyBjb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhpcywgYXJnLCBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6ICd1dGY4JylcbiAgfVxuXG4gIC8vIFVudXN1YWwuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoaXMsIGFyZylcbn1cblxuZnVuY3Rpb24gZnJvbU51bWJlciAodGhhdCwgbGVuZ3RoKSB7XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGggPCAwID8gMCA6IGNoZWNrZWQobGVuZ3RoKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykgZW5jb2RpbmcgPSAndXRmOCdcblxuICAvLyBBc3N1bXB0aW9uOiBieXRlTGVuZ3RoKCkgcmV0dXJuIHZhbHVlIGlzIGFsd2F5cyA8IGtNYXhMZW5ndGguXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqZWN0KSkgcmV0dXJuIGZyb21CdWZmZXIodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChpc0FycmF5KG9iamVjdCkpIHJldHVybiBmcm9tQXJyYXkodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIG9iamVjdC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gIH1cblxuICBpZiAob2JqZWN0Lmxlbmd0aCkgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqZWN0KVxuXG4gIHJldHVybiBmcm9tSnNvbk9iamVjdCh0aGF0LCBvYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZyb21CdWZmZXIgKHRoYXQsIGJ1ZmZlcikge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChidWZmZXIubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgYnVmZmVyLmNvcHkodGhhdCwgMCwgMCwgbGVuZ3RoKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEdXBsaWNhdGUgb2YgZnJvbUFycmF5KCkgdG8ga2VlcCBmcm9tQXJyYXkoKSBtb25vbW9ycGhpYy5cbmZ1bmN0aW9uIGZyb21UeXBlZEFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICAvLyBUcnVuY2F0aW5nIHRoZSBlbGVtZW50cyBpcyBwcm9iYWJseSBub3Qgd2hhdCBwZW9wbGUgZXhwZWN0IGZyb20gdHlwZWRcbiAgLy8gYXJyYXlzIHdpdGggQllURVNfUEVSX0VMRU1FTlQgPiAxIGJ1dCBpdCdzIGNvbXBhdGlibGUgd2l0aCB0aGUgYmVoYXZpb3JcbiAgLy8gb2YgdGhlIG9sZCBCdWZmZXIgY29uc3RydWN0b3IuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRGVzZXJpYWxpemUgeyB0eXBlOiAnQnVmZmVyJywgZGF0YTogWzEsMiwzLC4uLl0gfSBpbnRvIGEgQnVmZmVyIG9iamVjdC5cbi8vIFJldHVybnMgYSB6ZXJvLWxlbmd0aCBidWZmZXIgZm9yIGlucHV0cyB0aGF0IGRvbid0IGNvbmZvcm0gdG8gdGhlIHNwZWMuXG5mdW5jdGlvbiBmcm9tSnNvbk9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIHZhciBhcnJheVxuICB2YXIgbGVuZ3RoID0gMFxuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmplY3QuZGF0YSkpIHtcbiAgICBhcnJheSA9IG9iamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB9XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGFsbG9jYXRlICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICAgIHRoYXQuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIHZhciBpID0gMFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgYnJlYWtcblxuICAgICsraVxuICB9XG5cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9IGVsc2UgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIGxpc3RbMF1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSBTdHJpbmcoc3RyaW5nKVxuXG4gIGlmIChzdHJpbmcubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIHN3aXRjaCAoZW5jb2RpbmcgfHwgJ3V0ZjgnKSB7XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAncmF3JzpcbiAgICAgIHJldHVybiBzdHJpbmcubGVuZ3RoXG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiBzdHJpbmcubGVuZ3RoICogMlxuICAgIGNhc2UgJ2hleCc6XG4gICAgICByZXR1cm4gc3RyaW5nLmxlbmd0aCA+Pj4gMVxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gc3RyaW5nLmxlbmd0aFxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbkJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG5CdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxuXG4vLyB0b1N0cmluZyhlbmNvZGluZywgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gMFxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbi8vIGBnZXRgIHdpbGwgYmUgcmVtb3ZlZCBpbiBOb2RlIDAuMTMrXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldCAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCB3aWxsIGJlIHJlbW92ZWQgaW4gTm9kZSAwLjEzK1xuQnVmZmVyLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiBzZXQgKHYsIG9mZnNldCkge1xuICBjb25zb2xlLmxvZygnLnNldCgpIGlzIGRlcHJlY2F0ZWQuIEFjY2VzcyB1c2luZyBhcnJheSBpbmRleGVzIGluc3RlYWQuJylcbiAgcmV0dXJuIHRoaXMud3JpdGVVSW50OCh2LCBvZmZzZXQpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aCB8IDBcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignYXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXMgPSAnJ1xuICB2YXIgdG1wID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgaWYgKGJ1ZltpXSA8PSAweDdGKSB7XG4gICAgICByZXMgKz0gZGVjb2RlVXRmOENoYXIodG1wKSArIFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICAgICAgdG1wID0gJydcbiAgICB9IGVsc2Uge1xuICAgICAgdG1wICs9ICclJyArIGJ1ZltpXS50b1N0cmluZygxNilcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzICsgZGVjb2RlVXRmOENoYXIodG1wKVxufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldFN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiB0b0FycmF5QnVmZmVyICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiBfYXVnbWVudCAoYXJyKSB7XG4gIGFyci5jb25zdHJ1Y3RvciA9IEJ1ZmZlclxuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgc2V0IG1ldGhvZCBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZCwgd2lsbCBiZSByZW1vdmVkIGluIG5vZGUgMC4xMytcbiAgYXJyLmdldCA9IEJQLmdldFxuICBhcnIuc2V0ID0gQlAuc2V0XG5cbiAgYXJyLndyaXRlID0gQlAud3JpdGVcbiAgYXJyLnRvU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvTG9jYWxlU3RyaW5nID0gQlAudG9TdHJpbmdcbiAgYXJyLnRvSlNPTiA9IEJQLnRvSlNPTlxuICBhcnIuZXF1YWxzID0gQlAuZXF1YWxzXG4gIGFyci5jb21wYXJlID0gQlAuY29tcGFyZVxuICBhcnIuaW5kZXhPZiA9IEJQLmluZGV4T2ZcbiAgYXJyLmNvcHkgPSBCUC5jb3B5XG4gIGFyci5zbGljZSA9IEJQLnNsaWNlXG4gIGFyci5yZWFkVUludExFID0gQlAucmVhZFVJbnRMRVxuICBhcnIucmVhZFVJbnRCRSA9IEJQLnJlYWRVSW50QkVcbiAgYXJyLnJlYWRVSW50OCA9IEJQLnJlYWRVSW50OFxuICBhcnIucmVhZFVJbnQxNkxFID0gQlAucmVhZFVJbnQxNkxFXG4gIGFyci5yZWFkVUludDE2QkUgPSBCUC5yZWFkVUludDE2QkVcbiAgYXJyLnJlYWRVSW50MzJMRSA9IEJQLnJlYWRVSW50MzJMRVxuICBhcnIucmVhZFVJbnQzMkJFID0gQlAucmVhZFVJbnQzMkJFXG4gIGFyci5yZWFkSW50TEUgPSBCUC5yZWFkSW50TEVcbiAgYXJyLnJlYWRJbnRCRSA9IEJQLnJlYWRJbnRCRVxuICBhcnIucmVhZEludDggPSBCUC5yZWFkSW50OFxuICBhcnIucmVhZEludDE2TEUgPSBCUC5yZWFkSW50MTZMRVxuICBhcnIucmVhZEludDE2QkUgPSBCUC5yZWFkSW50MTZCRVxuICBhcnIucmVhZEludDMyTEUgPSBCUC5yZWFkSW50MzJMRVxuICBhcnIucmVhZEludDMyQkUgPSBCUC5yZWFkSW50MzJCRVxuICBhcnIucmVhZEZsb2F0TEUgPSBCUC5yZWFkRmxvYXRMRVxuICBhcnIucmVhZEZsb2F0QkUgPSBCUC5yZWFkRmxvYXRCRVxuICBhcnIucmVhZERvdWJsZUxFID0gQlAucmVhZERvdWJsZUxFXG4gIGFyci5yZWFkRG91YmxlQkUgPSBCUC5yZWFkRG91YmxlQkVcbiAgYXJyLndyaXRlVUludDggPSBCUC53cml0ZVVJbnQ4XG4gIGFyci53cml0ZVVJbnRMRSA9IEJQLndyaXRlVUludExFXG4gIGFyci53cml0ZVVJbnRCRSA9IEJQLndyaXRlVUludEJFXG4gIGFyci53cml0ZVVJbnQxNkxFID0gQlAud3JpdGVVSW50MTZMRVxuICBhcnIud3JpdGVVSW50MTZCRSA9IEJQLndyaXRlVUludDE2QkVcbiAgYXJyLndyaXRlVUludDMyTEUgPSBCUC53cml0ZVVJbnQzMkxFXG4gIGFyci53cml0ZVVJbnQzMkJFID0gQlAud3JpdGVVSW50MzJCRVxuICBhcnIud3JpdGVJbnRMRSA9IEJQLndyaXRlSW50TEVcbiAgYXJyLndyaXRlSW50QkUgPSBCUC53cml0ZUludEJFXG4gIGFyci53cml0ZUludDggPSBCUC53cml0ZUludDhcbiAgYXJyLndyaXRlSW50MTZMRSA9IEJQLndyaXRlSW50MTZMRVxuICBhcnIud3JpdGVJbnQxNkJFID0gQlAud3JpdGVJbnQxNkJFXG4gIGFyci53cml0ZUludDMyTEUgPSBCUC53cml0ZUludDMyTEVcbiAgYXJyLndyaXRlSW50MzJCRSA9IEJQLndyaXRlSW50MzJCRVxuICBhcnIud3JpdGVGbG9hdExFID0gQlAud3JpdGVGbG9hdExFXG4gIGFyci53cml0ZUZsb2F0QkUgPSBCUC53cml0ZUZsb2F0QkVcbiAgYXJyLndyaXRlRG91YmxlTEUgPSBCUC53cml0ZURvdWJsZUxFXG4gIGFyci53cml0ZURvdWJsZUJFID0gQlAud3JpdGVEb3VibGVCRVxuICBhcnIuZmlsbCA9IEJQLmZpbGxcbiAgYXJyLmluc3BlY3QgPSBCUC5pbnNwZWN0XG4gIGFyci50b0FycmF5QnVmZmVyID0gQlAudG9BcnJheUJ1ZmZlclxuXG4gIHJldHVybiBhcnJcbn1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teK1xcLzAtOUEtelxcLV0vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG4gIHZhciBpID0gMFxuXG4gIGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gMiBsZWFkcyBpbiBhIHJvd1xuICAgICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgICAgICBjb2RlUG9pbnQgPSBsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwIHwgMHgxMDAwMFxuICAgICAgICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG5cbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcbiAgICB9XG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDIwMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBkZWNvZGVVdGY4Q2hhciAoc3RyKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChzdHIpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkZGRCkgLy8gVVRGIDggaW52YWxpZCBjaGFyXG4gIH1cbn1cbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sXG4gICAgICBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxLFxuICAgICAgZU1heCA9ICgxIDw8IGVMZW4pIC0gMSxcbiAgICAgIGVCaWFzID0gZU1heCA+PiAxLFxuICAgICAgbkJpdHMgPSAtNyxcbiAgICAgIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMCxcbiAgICAgIGQgPSBpc0xFID8gLTEgOiAxLFxuICAgICAgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgYyxcbiAgICAgIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDEsXG4gICAgICBlTWF4ID0gKDEgPDwgZUxlbikgLSAxLFxuICAgICAgZUJpYXMgPSBlTWF4ID4+IDEsXG4gICAgICBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMCksXG4gICAgICBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSksXG4gICAgICBkID0gaXNMRSA/IDEgOiAtMSxcbiAgICAgIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIlxuLyoqXG4gKiBpc0FycmF5XG4gKi9cblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXG4vKipcbiAqIHRvU3RyaW5nXG4gKi9cblxudmFyIHN0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogV2hldGhlciBvciBub3QgdGhlIGdpdmVuIGB2YWxgXG4gKiBpcyBhbiBhcnJheS5cbiAqXG4gKiBleGFtcGxlOlxuICpcbiAqICAgICAgICBpc0FycmF5KFtdKTtcbiAqICAgICAgICAvLyA+IHRydWVcbiAqICAgICAgICBpc0FycmF5KGFyZ3VtZW50cyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICogICAgICAgIGlzQXJyYXkoJycpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqXG4gKiBAcGFyYW0ge21peGVkfSB2YWxcbiAqIEByZXR1cm4ge2Jvb2x9XG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBpc0FycmF5IHx8IGZ1bmN0aW9uICh2YWwpIHtcbiAgcmV0dXJuICEhIHZhbCAmJiAnW29iamVjdCBBcnJheV0nID09IHN0ci5jYWxsKHZhbCk7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHJlc29sdmVzIC4gYW5kIC4uIGVsZW1lbnRzIGluIGEgcGF0aCBhcnJheSB3aXRoIGRpcmVjdG9yeSBuYW1lcyB0aGVyZVxuLy8gbXVzdCBiZSBubyBzbGFzaGVzLCBlbXB0eSBlbGVtZW50cywgb3IgZGV2aWNlIG5hbWVzIChjOlxcKSBpbiB0aGUgYXJyYXlcbi8vIChzbyBhbHNvIG5vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgLSBpdCBkb2VzIG5vdCBkaXN0aW5ndWlzaFxuLy8gcmVsYXRpdmUgYW5kIGFic29sdXRlIHBhdGhzKVxuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXkocGFydHMsIGFsbG93QWJvdmVSb290KSB7XG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIHZhciBsYXN0ID0gcGFydHNbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBwYXJ0cy51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cztcbn1cblxuLy8gU3BsaXQgYSBmaWxlbmFtZSBpbnRvIFtyb290LCBkaXIsIGJhc2VuYW1lLCBleHRdLCB1bml4IHZlcnNpb25cbi8vICdyb290JyBpcyBqdXN0IGEgc2xhc2gsIG9yIG5vdGhpbmcuXG52YXIgc3BsaXRQYXRoUmUgPVxuICAgIC9eKFxcLz98KShbXFxzXFxTXSo/KSgoPzpcXC57MSwyfXxbXlxcL10rP3wpKFxcLlteLlxcL10qfCkpKD86W1xcL10qKSQvO1xudmFyIHNwbGl0UGF0aCA9IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG4gIHJldHVybiBzcGxpdFBhdGhSZS5leGVjKGZpbGVuYW1lKS5zbGljZSgxKTtcbn07XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVzb2x2ZWRQYXRoID0gJycsXG4gICAgICByZXNvbHZlZEFic29sdXRlID0gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID49IC0xICYmICFyZXNvbHZlZEFic29sdXRlOyBpLS0pIHtcbiAgICB2YXIgcGF0aCA9IChpID49IDApID8gYXJndW1lbnRzW2ldIDogcHJvY2Vzcy5jd2QoKTtcblxuICAgIC8vIFNraXAgZW1wdHkgYW5kIGludmFsaWQgZW50cmllc1xuICAgIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLnJlc29sdmUgbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfSBlbHNlIGlmICghcGF0aCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICByZXNvbHZlZEFic29sdXRlID0gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihyZXNvbHZlZFBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhcmVzb2x2ZWRBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIHJldHVybiAoKHJlc29sdmVkQWJzb2x1dGUgPyAnLycgOiAnJykgKyByZXNvbHZlZFBhdGgpIHx8ICcuJztcbn07XG5cbi8vIHBhdGgubm9ybWFsaXplKHBhdGgpXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIGlzQWJzb2x1dGUgPSBleHBvcnRzLmlzQWJzb2x1dGUocGF0aCksXG4gICAgICB0cmFpbGluZ1NsYXNoID0gc3Vic3RyKHBhdGgsIC0xKSA9PT0gJy8nO1xuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICBwYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhaXNBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIGlmICghcGF0aCAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHBhdGggPSAnLic7XG4gIH1cbiAgaWYgKHBhdGggJiYgdHJhaWxpbmdTbGFzaCkge1xuICAgIHBhdGggKz0gJy8nO1xuICB9XG5cbiAgcmV0dXJuIChpc0Fic29sdXRlID8gJy8nIDogJycpICsgcGF0aDtcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuaXNBYnNvbHV0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGguY2hhckF0KDApID09PSAnLyc7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmpvaW4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBhdGhzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgcmV0dXJuIGV4cG9ydHMubm9ybWFsaXplKGZpbHRlcihwYXRocywgZnVuY3Rpb24ocCwgaW5kZXgpIHtcbiAgICBpZiAodHlwZW9mIHAgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5qb2luIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbiAgfSkuam9pbignLycpKTtcbn07XG5cblxuLy8gcGF0aC5yZWxhdGl2ZShmcm9tLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVsYXRpdmUgPSBmdW5jdGlvbihmcm9tLCB0bykge1xuICBmcm9tID0gZXhwb3J0cy5yZXNvbHZlKGZyb20pLnN1YnN0cigxKTtcbiAgdG8gPSBleHBvcnRzLnJlc29sdmUodG8pLnN1YnN0cigxKTtcblxuICBmdW5jdGlvbiB0cmltKGFycikge1xuICAgIHZhciBzdGFydCA9IDA7XG4gICAgZm9yICg7IHN0YXJ0IDwgYXJyLmxlbmd0aDsgc3RhcnQrKykge1xuICAgICAgaWYgKGFycltzdGFydF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICB2YXIgZW5kID0gYXJyLmxlbmd0aCAtIDE7XG4gICAgZm9yICg7IGVuZCA+PSAwOyBlbmQtLSkge1xuICAgICAgaWYgKGFycltlbmRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0ID4gZW5kKSByZXR1cm4gW107XG4gICAgcmV0dXJuIGFyci5zbGljZShzdGFydCwgZW5kIC0gc3RhcnQgKyAxKTtcbiAgfVxuXG4gIHZhciBmcm9tUGFydHMgPSB0cmltKGZyb20uc3BsaXQoJy8nKSk7XG4gIHZhciB0b1BhcnRzID0gdHJpbSh0by5zcGxpdCgnLycpKTtcblxuICB2YXIgbGVuZ3RoID0gTWF0aC5taW4oZnJvbVBhcnRzLmxlbmd0aCwgdG9QYXJ0cy5sZW5ndGgpO1xuICB2YXIgc2FtZVBhcnRzTGVuZ3RoID0gbGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGZyb21QYXJ0c1tpXSAhPT0gdG9QYXJ0c1tpXSkge1xuICAgICAgc2FtZVBhcnRzTGVuZ3RoID0gaTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHZhciBvdXRwdXRQYXJ0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gc2FtZVBhcnRzTGVuZ3RoOyBpIDwgZnJvbVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgb3V0cHV0UGFydHMucHVzaCgnLi4nKTtcbiAgfVxuXG4gIG91dHB1dFBhcnRzID0gb3V0cHV0UGFydHMuY29uY2F0KHRvUGFydHMuc2xpY2Uoc2FtZVBhcnRzTGVuZ3RoKSk7XG5cbiAgcmV0dXJuIG91dHB1dFBhcnRzLmpvaW4oJy8nKTtcbn07XG5cbmV4cG9ydHMuc2VwID0gJy8nO1xuZXhwb3J0cy5kZWxpbWl0ZXIgPSAnOic7XG5cbmV4cG9ydHMuZGlybmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIHJlc3VsdCA9IHNwbGl0UGF0aChwYXRoKSxcbiAgICAgIHJvb3QgPSByZXN1bHRbMF0sXG4gICAgICBkaXIgPSByZXN1bHRbMV07XG5cbiAgaWYgKCFyb290ICYmICFkaXIpIHtcbiAgICAvLyBObyBkaXJuYW1lIHdoYXRzb2V2ZXJcbiAgICByZXR1cm4gJy4nO1xuICB9XG5cbiAgaWYgKGRpcikge1xuICAgIC8vIEl0IGhhcyBhIGRpcm5hbWUsIHN0cmlwIHRyYWlsaW5nIHNsYXNoXG4gICAgZGlyID0gZGlyLnN1YnN0cigwLCBkaXIubGVuZ3RoIC0gMSk7XG4gIH1cblxuICByZXR1cm4gcm9vdCArIGRpcjtcbn07XG5cblxuZXhwb3J0cy5iYXNlbmFtZSA9IGZ1bmN0aW9uKHBhdGgsIGV4dCkge1xuICB2YXIgZiA9IHNwbGl0UGF0aChwYXRoKVsyXTtcbiAgLy8gVE9ETzogbWFrZSB0aGlzIGNvbXBhcmlzb24gY2FzZS1pbnNlbnNpdGl2ZSBvbiB3aW5kb3dzP1xuICBpZiAoZXh0ICYmIGYuc3Vic3RyKC0xICogZXh0Lmxlbmd0aCkgPT09IGV4dCkge1xuICAgIGYgPSBmLnN1YnN0cigwLCBmLmxlbmd0aCAtIGV4dC5sZW5ndGgpO1xuICB9XG4gIHJldHVybiBmO1xufTtcblxuXG5leHBvcnRzLmV4dG5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBzcGxpdFBhdGgocGF0aClbM107XG59O1xuXG5mdW5jdGlvbiBmaWx0ZXIgKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZpbHRlcikgcmV0dXJuIHhzLmZpbHRlcihmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZih4c1tpXSwgaSwgeHMpKSByZXMucHVzaCh4c1tpXSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUuc3Vic3RyIC0gbmVnYXRpdmUgaW5kZXggZG9uJ3Qgd29yayBpbiBJRThcbnZhciBzdWJzdHIgPSAnYWInLnN1YnN0cigtMSkgPT09ICdiJ1xuICAgID8gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikgeyByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKSB9XG4gICAgOiBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7XG4gICAgICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gc3RyLmxlbmd0aCArIHN0YXJ0O1xuICAgICAgICByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKTtcbiAgICB9XG47XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAoIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbnZhciBpc0J1ZmZlckVuY29kaW5nID0gQnVmZmVyLmlzRW5jb2RpbmdcbiAgfHwgZnVuY3Rpb24oZW5jb2RpbmcpIHtcbiAgICAgICBzd2l0Y2ggKGVuY29kaW5nICYmIGVuY29kaW5nLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgIGNhc2UgJ2hleCc6IGNhc2UgJ3V0ZjgnOiBjYXNlICd1dGYtOCc6IGNhc2UgJ2FzY2lpJzogY2FzZSAnYmluYXJ5JzogY2FzZSAnYmFzZTY0JzogY2FzZSAndWNzMic6IGNhc2UgJ3Vjcy0yJzogY2FzZSAndXRmMTZsZSc6IGNhc2UgJ3V0Zi0xNmxlJzogY2FzZSAncmF3JzogcmV0dXJuIHRydWU7XG4gICAgICAgICBkZWZhdWx0OiByZXR1cm4gZmFsc2U7XG4gICAgICAgfVxuICAgICB9XG5cblxuZnVuY3Rpb24gYXNzZXJ0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgaWYgKGVuY29kaW5nICYmICFpc0J1ZmZlckVuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgfVxufVxuXG4vLyBTdHJpbmdEZWNvZGVyIHByb3ZpZGVzIGFuIGludGVyZmFjZSBmb3IgZWZmaWNpZW50bHkgc3BsaXR0aW5nIGEgc2VyaWVzIG9mXG4vLyBidWZmZXJzIGludG8gYSBzZXJpZXMgb2YgSlMgc3RyaW5ncyB3aXRob3V0IGJyZWFraW5nIGFwYXJ0IG11bHRpLWJ5dGVcbi8vIGNoYXJhY3RlcnMuIENFU1UtOCBpcyBoYW5kbGVkIGFzIHBhcnQgb2YgdGhlIFVURi04IGVuY29kaW5nLlxuLy9cbi8vIEBUT0RPIEhhbmRsaW5nIGFsbCBlbmNvZGluZ3MgaW5zaWRlIGEgc2luZ2xlIG9iamVjdCBtYWtlcyBpdCB2ZXJ5IGRpZmZpY3VsdFxuLy8gdG8gcmVhc29uIGFib3V0IHRoaXMgY29kZSwgc28gaXQgc2hvdWxkIGJlIHNwbGl0IHVwIGluIHRoZSBmdXR1cmUuXG4vLyBAVE9ETyBUaGVyZSBzaG91bGQgYmUgYSB1dGY4LXN0cmljdCBlbmNvZGluZyB0aGF0IHJlamVjdHMgaW52YWxpZCBVVEYtOCBjb2RlXG4vLyBwb2ludHMgYXMgdXNlZCBieSBDRVNVLTguXG52YXIgU3RyaW5nRGVjb2RlciA9IGV4cG9ydHMuU3RyaW5nRGVjb2RlciA9IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gIHRoaXMuZW5jb2RpbmcgPSAoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1stX10vLCAnJyk7XG4gIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKTtcbiAgc3dpdGNoICh0aGlzLmVuY29kaW5nKSB7XG4gICAgY2FzZSAndXRmOCc6XG4gICAgICAvLyBDRVNVLTggcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDMtYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIC8vIFVURi0xNiByZXByZXNlbnRzIGVhY2ggb2YgU3Vycm9nYXRlIFBhaXIgYnkgMi1ieXRlc1xuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMjtcbiAgICAgIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSB1dGYxNkRldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIC8vIEJhc2UtNjQgc3RvcmVzIDMgYnl0ZXMgaW4gNCBjaGFycywgYW5kIHBhZHMgdGhlIHJlbWFpbmRlci5cbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy53cml0ZSA9IHBhc3NUaHJvdWdoV3JpdGU7XG4gICAgICByZXR1cm47XG4gIH1cblxuICAvLyBFbm91Z2ggc3BhY2UgdG8gc3RvcmUgYWxsIGJ5dGVzIG9mIGEgc2luZ2xlIGNoYXJhY3Rlci4gVVRGLTggbmVlZHMgNFxuICAvLyBieXRlcywgYnV0IENFU1UtOCBtYXkgcmVxdWlyZSB1cCB0byA2ICgzIGJ5dGVzIHBlciBzdXJyb2dhdGUpLlxuICB0aGlzLmNoYXJCdWZmZXIgPSBuZXcgQnVmZmVyKDYpO1xuICAvLyBOdW1iZXIgb2YgYnl0ZXMgcmVjZWl2ZWQgZm9yIHRoZSBjdXJyZW50IGluY29tcGxldGUgbXVsdGktYnl0ZSBjaGFyYWN0ZXIuXG4gIHRoaXMuY2hhclJlY2VpdmVkID0gMDtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIGV4cGVjdGVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJMZW5ndGggPSAwO1xufTtcblxuXG4vLyB3cml0ZSBkZWNvZGVzIHRoZSBnaXZlbiBidWZmZXIgYW5kIHJldHVybnMgaXQgYXMgSlMgc3RyaW5nIHRoYXQgaXNcbi8vIGd1YXJhbnRlZWQgdG8gbm90IGNvbnRhaW4gYW55IHBhcnRpYWwgbXVsdGktYnl0ZSBjaGFyYWN0ZXJzLiBBbnkgcGFydGlhbFxuLy8gY2hhcmFjdGVyIGZvdW5kIGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlciBpcyBidWZmZXJlZCB1cCwgYW5kIHdpbGwgYmVcbi8vIHJldHVybmVkIHdoZW4gY2FsbGluZyB3cml0ZSBhZ2FpbiB3aXRoIHRoZSByZW1haW5pbmcgYnl0ZXMuXG4vL1xuLy8gTm90ZTogQ29udmVydGluZyBhIEJ1ZmZlciBjb250YWluaW5nIGFuIG9ycGhhbiBzdXJyb2dhdGUgdG8gYSBTdHJpbmdcbi8vIGN1cnJlbnRseSB3b3JrcywgYnV0IGNvbnZlcnRpbmcgYSBTdHJpbmcgdG8gYSBCdWZmZXIgKHZpYSBgbmV3IEJ1ZmZlcmAsIG9yXG4vLyBCdWZmZXIjd3JpdGUpIHdpbGwgcmVwbGFjZSBpbmNvbXBsZXRlIHN1cnJvZ2F0ZXMgd2l0aCB0aGUgdW5pY29kZVxuLy8gcmVwbGFjZW1lbnQgY2hhcmFjdGVyLiBTZWUgaHR0cHM6Ly9jb2RlcmV2aWV3LmNocm9taXVtLm9yZy8xMjExNzMwMDkvIC5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciBjaGFyU3RyID0gJyc7XG4gIC8vIGlmIG91ciBsYXN0IHdyaXRlIGVuZGVkIHdpdGggYW4gaW5jb21wbGV0ZSBtdWx0aWJ5dGUgY2hhcmFjdGVyXG4gIHdoaWxlICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcmVtYWluaW5nIGJ5dGVzIHRoaXMgYnVmZmVyIGhhcyB0byBvZmZlciBmb3IgdGhpcyBjaGFyXG4gICAgdmFyIGF2YWlsYWJsZSA9IChidWZmZXIubGVuZ3RoID49IHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkKSA/XG4gICAgICAgIHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkIDpcbiAgICAgICAgYnVmZmVyLmxlbmd0aDtcblxuICAgIC8vIGFkZCB0aGUgbmV3IGJ5dGVzIHRvIHRoZSBjaGFyIGJ1ZmZlclxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgdGhpcy5jaGFyUmVjZWl2ZWQsIDAsIGF2YWlsYWJsZSk7XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgKz0gYXZhaWxhYmxlO1xuXG4gICAgaWYgKHRoaXMuY2hhclJlY2VpdmVkIDwgdGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgICAvLyBzdGlsbCBub3QgZW5vdWdoIGNoYXJzIGluIHRoaXMgYnVmZmVyPyB3YWl0IGZvciBtb3JlIC4uLlxuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIC8vIHJlbW92ZSBieXRlcyBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgY2hhcmFjdGVyIGZyb20gdGhlIGJ1ZmZlclxuICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZShhdmFpbGFibGUsIGJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgLy8gZ2V0IHRoZSBjaGFyYWN0ZXIgdGhhdCB3YXMgc3BsaXRcbiAgICBjaGFyU3RyID0gdGhpcy5jaGFyQnVmZmVyLnNsaWNlKDAsIHRoaXMuY2hhckxlbmd0aCkudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG5cbiAgICAvLyBDRVNVLTg6IGxlYWQgc3Vycm9nYXRlIChEODAwLURCRkYpIGlzIGFsc28gdGhlIGluY29tcGxldGUgY2hhcmFjdGVyXG4gICAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGNoYXJTdHIubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCArPSB0aGlzLnN1cnJvZ2F0ZVNpemU7XG4gICAgICBjaGFyU3RyID0gJyc7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgPSB0aGlzLmNoYXJMZW5ndGggPSAwO1xuXG4gICAgLy8gaWYgdGhlcmUgYXJlIG5vIG1vcmUgYnl0ZXMgaW4gdGhpcyBidWZmZXIsIGp1c3QgZW1pdCBvdXIgY2hhclxuICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gY2hhclN0cjtcbiAgICB9XG4gICAgYnJlYWs7XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgYW5kIHNldCBjaGFyTGVuZ3RoIC8gY2hhclJlY2VpdmVkXG4gIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKTtcblxuICB2YXIgZW5kID0gYnVmZmVyLmxlbmd0aDtcbiAgaWYgKHRoaXMuY2hhckxlbmd0aCkge1xuICAgIC8vIGJ1ZmZlciB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXIgYnl0ZXMgd2UgZ290XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCBidWZmZXIubGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQsIGVuZCk7XG4gICAgZW5kIC09IHRoaXMuY2hhclJlY2VpdmVkO1xuICB9XG5cbiAgY2hhclN0ciArPSBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgZW5kKTtcblxuICB2YXIgZW5kID0gY2hhclN0ci5sZW5ndGggLSAxO1xuICB2YXIgY2hhckNvZGUgPSBjaGFyU3RyLmNoYXJDb2RlQXQoZW5kKTtcbiAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICBpZiAoY2hhckNvZGUgPj0gMHhEODAwICYmIGNoYXJDb2RlIDw9IDB4REJGRikge1xuICAgIHZhciBzaXplID0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgIHRoaXMuY2hhckxlbmd0aCArPSBzaXplO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IHNpemU7XG4gICAgdGhpcy5jaGFyQnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCBzaXplLCAwLCBzaXplKTtcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIDAsIDAsIHNpemUpO1xuICAgIHJldHVybiBjaGFyU3RyLnN1YnN0cmluZygwLCBlbmQpO1xuICB9XG5cbiAgLy8gb3IganVzdCBlbWl0IHRoZSBjaGFyU3RyXG4gIHJldHVybiBjaGFyU3RyO1xufTtcblxuLy8gZGV0ZWN0SW5jb21wbGV0ZUNoYXIgZGV0ZXJtaW5lcyBpZiB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIFVURi04IGNoYXJhY3RlciBhdFxuLy8gdGhlIGVuZCBvZiB0aGUgZ2l2ZW4gYnVmZmVyLiBJZiBzbywgaXQgc2V0cyB0aGlzLmNoYXJMZW5ndGggdG8gdGhlIGJ5dGVcbi8vIGxlbmd0aCB0aGF0IGNoYXJhY3RlciwgYW5kIHNldHMgdGhpcy5jaGFyUmVjZWl2ZWQgdG8gdGhlIG51bWJlciBvZiBieXRlc1xuLy8gdGhhdCBhcmUgYXZhaWxhYmxlIGZvciB0aGlzIGNoYXJhY3Rlci5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmRldGVjdEluY29tcGxldGVDaGFyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIC8vIGRldGVybWluZSBob3cgbWFueSBieXRlcyB3ZSBoYXZlIHRvIGNoZWNrIGF0IHRoZSBlbmQgb2YgdGhpcyBidWZmZXJcbiAgdmFyIGkgPSAoYnVmZmVyLmxlbmd0aCA+PSAzKSA/IDMgOiBidWZmZXIubGVuZ3RoO1xuXG4gIC8vIEZpZ3VyZSBvdXQgaWYgb25lIG9mIHRoZSBsYXN0IGkgYnl0ZXMgb2Ygb3VyIGJ1ZmZlciBhbm5vdW5jZXMgYW5cbiAgLy8gaW5jb21wbGV0ZSBjaGFyLlxuICBmb3IgKDsgaSA+IDA7IGktLSkge1xuICAgIHZhciBjID0gYnVmZmVyW2J1ZmZlci5sZW5ndGggLSBpXTtcblxuICAgIC8vIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1VURi04I0Rlc2NyaXB0aW9uXG5cbiAgICAvLyAxMTBYWFhYWFxuICAgIGlmIChpID09IDEgJiYgYyA+PiA1ID09IDB4MDYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDI7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTEwWFhYWFxuICAgIGlmIChpIDw9IDIgJiYgYyA+PiA0ID09IDB4MEUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTExMFhYWFxuICAgIGlmIChpIDw9IDMgJiYgYyA+PiAzID09IDB4MUUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDQ7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBpO1xufTtcblxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciByZXMgPSAnJztcbiAgaWYgKGJ1ZmZlciAmJiBidWZmZXIubGVuZ3RoKVxuICAgIHJlcyA9IHRoaXMud3JpdGUoYnVmZmVyKTtcblxuICBpZiAodGhpcy5jaGFyUmVjZWl2ZWQpIHtcbiAgICB2YXIgY3IgPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgICB2YXIgYnVmID0gdGhpcy5jaGFyQnVmZmVyO1xuICAgIHZhciBlbmMgPSB0aGlzLmVuY29kaW5nO1xuICAgIHJlcyArPSBidWYuc2xpY2UoMCwgY3IpLnRvU3RyaW5nKGVuYyk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gcGFzc1Rocm91Z2hXcml0ZShidWZmZXIpIHtcbiAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZyh0aGlzLmVuY29kaW5nKTtcbn1cblxuZnVuY3Rpb24gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpIHtcbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBidWZmZXIubGVuZ3RoICUgMjtcbiAgdGhpcy5jaGFyTGVuZ3RoID0gdGhpcy5jaGFyUmVjZWl2ZWQgPyAyIDogMDtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDM7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMyA6IDA7XG59XG4iLCJcclxudmFyXHJcbiAgICBmcyA9IHJlcXVpcmUoXCJmc1wiKSxcclxuICAgIGljb252OyAvLyBsb2FkZWQgaWYgbmVjZXNzYXJ5XHJcblxyXG5jb25zdFxyXG4gICAgQlVGRkVSX0xFTkdUSCA9IDEwMjQ7XHJcblxyXG5jb25zdFxyXG4gICAgeHNTdGFydCA9IDAsXHJcbiAgICB4c0VhdFNwYWNlcyA9IDEsXHJcbiAgICB4c0VsZW1lbnQgPSAyLFxyXG4gICAgeHNFbGVtZW50TmFtZSA9IDMsXHJcbiAgICB4c0F0dHJpYnV0ZXMgPSA0LFxyXG4gICAgeHNBdHRyaWJ1dGVOYW1lID0gNSxcclxuICAgIHhzRXF1YWwgPSA2LFxyXG4gICAgeHNBdHRyaWJ1dGVWYWx1ZSA9IDcsXHJcbiAgICB4c0Nsb3NlRW1wdHlFbGVtZW50ID0gOCxcclxuICAgIHhzVHJ5Q2xvc2VFbGVtZW50ID0gOSxcclxuICAgIHhzQ2xvc2VFbGVtZW50TmFtZSA9IDEwLFxyXG4gICAgeHNDaGlsZE5vZGVzID0gMTEsXHJcbiAgICB4c0VsZW1lbnRTdHJpbmcgPSAxMixcclxuICAgIHhzRWxlbWVudENvbW1lbnQgPSAxMyxcclxuICAgIHhzQ2xvc2VFbGVtZW50Q29tbWVudCA9IDE0LFxyXG4gICAgeHNEb2N0eXBlID0gMTUsXHJcbiAgICB4c0VsZW1lbnRQSSA9IDE2LFxyXG4gICAgeHNFbGVtZW50RGF0YVBJID0gMTcsXHJcbiAgICB4c0Nsb3NlRWxlbWVudFBJID0gMTgsXHJcbiAgICB4c0VsZW1lbnRDREFUQSA9IDE5LFxyXG4gICAgeHNDbG9kZUVsZW1lbnRDREFUQSA9IDIwLFxyXG4gICAgeHNFc2NhcGUgPSAyMSxcclxuICAgIHhzRXNjYXBlX2x0ID0gMjIsXHJcbiAgICB4c0VzY2FwZV9ndCA9IDIzLFxyXG4gICAgeHNFc2NhcGVfYW1wID0gMjQsXHJcbiAgICB4c0VzY2FwZV9hcG9zID0gMjUsXHJcbiAgICB4c0VzY2FwZV9xdW90ID0gMjYsXHJcbiAgICB4c0VzY2FwZV9jaGFyID0gMjcsXHJcbiAgICB4c0VzY2FwZV9jaGFyX251bSA9IDI4LFxyXG4gICAgeHNFc2NhcGVfY2hhcl9oZXggPSAyOSxcclxuICAgIHhzRW5kID0gMzA7XHJcblxyXG5jb25zdFxyXG4gICAgeGNFbGVtZW50ID0gMCxcclxuICAgIHhjQ29tbWVudCA9IDEsXHJcbiAgICB4Y1N0cmluZyA9IDIsXHJcbiAgICB4Y0NkYXRhID0gMyxcclxuICAgIHhjUHJvY2Vzc0luc3QgPSA0O1xyXG5cclxuY29uc3RcclxuICAgIHh0T3BlbiA9IGV4cG9ydHMueHRPcGVuID0gMCxcclxuICAgIHh0Q2xvc2UgPSBleHBvcnRzLnh0Q2xvc2UgPSAxLFxyXG4gICAgeHRBdHRyaWJ1dGUgPSBleHBvcnRzLnh0QXR0cmlidXRlID0gMixcclxuICAgIHh0VGV4dCA9IGV4cG9ydHMueHRUZXh0ID0gMyxcclxuICAgIHh0Q0RhdGEgPSBleHBvcnRzLnh0Q0RhdGEgPSA0LFxyXG4gICAgeHRDb21tZW50ID0gZXhwb3J0cy54dENvbW1lbnQgPSA1O1xyXG5cclxuY29uc3RcclxuICAgIENIQVJfVEFCICAgID0gOSxcclxuICAgIENIQVJfTEYgICAgID0gMTAsXHJcbiAgICBDSEFSX0NSICAgICA9IDEzLFxyXG4gICAgQ0hBUl9TUCAgICAgPSAzMixcclxuICAgIENIQVJfRVhDTCAgID0gMzMsIC8vICFcclxuICAgIENIQVJfREJMUSAgID0gMzQsIC8vIFwiXHJcbiAgICBDSEFSX1NIUlAgICA9IDM1LCAvLyAjXHJcbiAgICBDSEFSX0FNUEUgICA9IDM4LCAvLyAmXHJcbiAgICBDSEFSX1NJTlEgICA9IDM5LCAvLyAnXHJcbiAgICBDSEFSX01JTlUgICA9IDQ1LCAvLyAtXHJcbiAgICBDSEFSX1BUICAgICA9IDQ2LCAvLyAuXHJcbiAgICBDSEFSX1NMQUggICA9IDQ3LCAvLyAvXHJcbiAgICBDSEFSX1pFUk8gICA9IDQ4LCAvLyAwXHJcbiAgICBDSEFSX05JTkUgICA9IDU3LCAvLyA5XHJcbiAgICBDSEFSX0NPTE8gICA9IDU4LCAvLyA6XHJcbiAgICBDSEFSX1NDT0wgICA9IDU5LCAvLyA7XHJcbiAgICBDSEFSX0xFU1MgICA9IDYwLCAvLyA8XHJcbiAgICBDSEFSX0VRVUEgICA9IDYxLCAvLyA9XHJcbiAgICBDSEFSX0dSRUEgICA9IDYyLCAvLyA+XHJcbiAgICBDSEFSX1FVRVMgICA9IDYzLCAvLyA/XHJcbiAgICBDSEFSX0EgICAgICA9IDY1LFxyXG4gICAgQ0hBUl9DICAgICAgPSA2NyxcclxuICAgIENIQVJfRCAgICAgID0gNjgsXHJcbiAgICBDSEFSX0YgICAgICA9IDcwLFxyXG4gICAgQ0hBUl9UICAgICAgPSA4NCxcclxuICAgIENIQVJfWiAgICAgID0gOTAsXHJcbiAgICBDSEFSX0xFQlIgICA9IDkxLCAvLyBbXHJcbiAgICBDSEFSX1JJQlIgICA9IDkzLCAvLyBbXHJcbiAgICBDSEFSX0xMICAgICA9IDk1LCAvLyBfXHJcbiAgICBDSEFSX2EgICAgICA9IDk3LFxyXG4gICAgQ0hBUl9mICAgICAgPSAxMDIsXHJcbiAgICBDSEFSX2cgICAgICA9IDEwMyxcclxuICAgIENIQVJfbCAgICAgID0gMTA4LFxyXG4gICAgQ0hBUl9tICAgICAgPSAxMDksXHJcbiAgICBDSEFSX28gICAgICA9IDExMSxcclxuICAgIENIQVJfcCAgICAgID0gMTEyLFxyXG4gICAgQ0hBUl9xICAgICAgPSAxMTMsXHJcbiAgICBDSEFSX3MgICAgICA9IDExNSxcclxuICAgIENIQVJfdCAgICAgID0gMTE2LFxyXG4gICAgQ0hBUl91ICAgICAgPSAxMTcsXHJcbiAgICBDSEFSX3ggICAgICA9IDEyMCxcclxuICAgIENIQVJfeiAgICAgID0gMTIyLFxyXG4gICAgQ0hBUl9ISUdIICAgPSAxNjE7XHJcblxyXG5jb25zdFxyXG4gICAgU1RSX0VOQ09ESU5HID0gJ2VuY29kaW5nJyxcclxuICAgIFNUUl9YTUwgPSAneG1sJztcclxuXHJcbmZ1bmN0aW9uIGlzU3BhY2Uodikge1xyXG4gICAgcmV0dXJuICh2ID09IENIQVJfVEFCIHx8IHYgPT0gQ0hBUl9MRiB8fCB2ID09IENIQVJfQ1IgfHwgdiA9PSBDSEFSX1NQKVxyXG59XHJcblxyXG5mdW5jdGlvbiBpc0FscGhhKHYpIHtcclxuICAgIHJldHVybiAodiA+PSBDSEFSX0EgJiYgdiA8PSBDSEFSX1opIHx8XHJcbiAgICAodiA+PSBDSEFSX2EgJiYgdiA8PSBDSEFSX3opIHx8XHJcbiAgICAodiA9PSBDSEFSX0xMKSB8fCAodiA9PSBDSEFSX0NPTE8pIHx8ICh2ID49IENIQVJfSElHSClcclxufVxyXG5cclxuZnVuY3Rpb24gaXNOdW0odikge1xyXG4gICAgcmV0dXJuICh2ID49IENIQVJfWkVSTyAmJiB2IDw9IENIQVJfTklORSlcclxufVxyXG5cclxuZnVuY3Rpb24gaXNBbHBoYU51bSh2KSB7XHJcbiAgICByZXR1cm4gKGlzQWxwaGEodikgfHwgaXNOdW0odikgfHwgKHYgPT0gQ0hBUl9QVCkgfHwgKHYgPT0gQ0hBUl9NSU5VKSlcclxufVxyXG5cclxuZnVuY3Rpb24gaXNIZXgodikge1xyXG4gICAgcmV0dXJuICh2ID49IENIQVJfQSAmJiB2IDw9IENIQVJfRikgfHxcclxuICAgICAgICAodiA+PSBDSEFSX2EgJiYgdiA8PSBDSEFSX2YpIHx8XHJcbiAgICAgICAgKHYgPj0gQ0hBUl9aRVJPICYmIHYgPD0gQ0hBUl9OSU5FKVxyXG59XHJcblxyXG5mdW5jdGlvbiBoZXhEaWdpdCh2KSB7XHJcbiAgICBpZiAodiA8PSBDSEFSX05JTkUpIHtcclxuICAgICAgICByZXR1cm4gdiAtIENIQVJfWkVST1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gKHYgJiA3KSArIDlcclxuICAgIH1cclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5jb25zdFxyXG4gICBTVFJJTkdfQlVGRkVSX1NJWkUgPSAzMjtcclxuXHJcbmZ1bmN0aW9uIFN0cmluZ0J1ZmZlcigpIHtcclxuICAgIHRoaXMuYnVmZmVyID0gbmV3IEJ1ZmZlcihTVFJJTkdfQlVGRkVSX1NJWkUpO1xyXG4gICAgdGhpcy5wb3MgPSAwO1xyXG59XHJcblxyXG5TdHJpbmdCdWZmZXIucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICBpZiAodGhpcy5wb3MgPT0gdGhpcy5idWZmZXIubGVuZ3RoKSB7XHJcbiAgICAgICAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIodGhpcy5idWZmZXIubGVuZ3RoICogMik7XHJcbiAgICAgICAgdGhpcy5idWZmZXIuY29weShidWYpO1xyXG4gICAgICAgIHRoaXMuYnVmZmVyID0gYnVmO1xyXG4gICAgfVxyXG4gICAgdGhpcy5idWZmZXIud3JpdGVVSW50OCh2YWx1ZSwgdGhpcy5wb3MpO1xyXG4gICAgdGhpcy5wb3MrKztcclxufTtcclxuXHJcblN0cmluZ0J1ZmZlci5wcm90b3R5cGUuYXBwZW5kQnVmZmVyID0gZnVuY3Rpb24odmFsdWUpIHtcclxuICAgIGlmICh2YWx1ZS5sZW5ndGgpIHtcclxuICAgICAgICB2YXIgbGVuID0gdGhpcy5idWZmZXIubGVuZ3RoO1xyXG4gICAgICAgIHdoaWxlIChsZW4gLSB0aGlzLnBvcyA8IHZhbHVlLmxlbmd0aCkge1xyXG4gICAgICAgICAgICBsZW4gKj0gMjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGxlbiAhPSB0aGlzLmJ1ZmZlci5sZW5ndGgpIHtcclxuICAgICAgICAgICAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuKTtcclxuICAgICAgICAgICAgdGhpcy5idWZmZXIuY29weShidWYpO1xyXG4gICAgICAgICAgICB0aGlzLmJ1ZmZlciA9IGJ1ZjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFsdWUuY29weSh0aGlzLmJ1ZmZlciwgdGhpcy5wb3MpO1xyXG4gICAgICAgIHRoaXMucG9zICs9IHZhbHVlLmxlbmd0aDtcclxuICAgIH1cclxufTtcclxuXHJcbi8qXHJcblN0cmluZ0J1ZmZlci5wcm90b3R5cGUudHJpbVJpZ2h0ID0gZnVuY3Rpb24oKSB7XHJcbiAgICB3aGlsZSAodGhpcy5wb3MgPiAwICYmIGlzU3BhY2UodGhpcy5idWZmZXJbdGhpcy5wb3MtMV0pKSB7XHJcbiAgICAgICAgdGhpcy5wb3MtLTtcclxuICAgIH1cclxufTtcclxuKi9cclxuXHJcblN0cmluZ0J1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbihlbmNvZGluZykge1xyXG4gICAgaWYgKCFlbmNvZGluZykge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmJ1ZmZlci5zbGljZSgwLCB0aGlzLnBvcykudG9TdHJpbmcoKVxyXG4gICAgfVxyXG4gICAgaWYgKCFpY29udikge1xyXG4gICAgICAgIGljb252ID0gcmVxdWlyZShcImljb252LWxpdGVcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaWNvbnYuZGVjb2RlKHRoaXMuYnVmZmVyLnNsaWNlKDAsIHRoaXMucG9zKSwgZW5jb2RpbmcpO1xyXG59O1xyXG5cclxuU3RyaW5nQnVmZmVyLnByb3RvdHlwZS50b0J1ZmZlciA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHJldCA9IG5ldyBCdWZmZXIodGhpcy5wb3MpO1xyXG4gICAgdGhpcy5idWZmZXIuY29weShyZXQpO1xyXG4gICAgcmV0dXJuIHJldDtcclxufTtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZnVuY3Rpb24gWE1MUGFyc2VyKCkge1xyXG4gICAgdGhpcy5zdGFja1VwKCk7XHJcbiAgICB0aGlzLnN0ciA9IG5ldyBTdHJpbmdCdWZmZXIoKTtcclxuICAgIHRoaXMudmFsdWUgPSBuZXcgU3RyaW5nQnVmZmVyKCk7XHJcbiAgICB0aGlzLmxpbmUgPSAwO1xyXG4gICAgdGhpcy5jb2wgPSAwO1xyXG59XHJcblxyXG5YTUxQYXJzZXIucHJvdG90eXBlLnN0YWNrVXAgPSBmdW5jdGlvbigpIHtcclxuICAgIHZhciBzdCA9IHt9O1xyXG4gICAgc3Quc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgIHN0LnNhdmVkc3RhdGUgPSB4c1N0YXJ0O1xyXG4gICAgc3QucHJldiA9IHRoaXMuc3RhY2s7XHJcbiAgICBpZiAoc3QucHJldikge1xyXG4gICAgICAgIHN0LnByZXYubmV4dCA9IHN0O1xyXG4gICAgfVxyXG4gICAgdGhpcy5zdGFjayA9IHN0O1xyXG59O1xyXG5cclxuWE1MUGFyc2VyLnByb3RvdHlwZS5zdGFja0Rvd24gPSBmdW5jdGlvbigpIHtcclxuICAgIGlmICh0aGlzLnN0YWNrKSB7XHJcbiAgICAgICAgdGhpcy5zdGFjayA9IHRoaXMuc3RhY2sucHJldjtcclxuICAgICAgICBpZiAodGhpcy5zdGFjaykge1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5zdGFjay5uZXh0O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblhNTFBhcnNlci5wcm90b3R5cGUucGFyc2VCdWZmZXIgPSBmdW5jdGlvbihidWZmZXIsIGxlbiwgZXZlbnQpIHtcclxuICAgIHZhciBpID0gMDtcclxuICAgIHZhciBjID0gYnVmZmVyW2ldO1xyXG4gICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgICBzd2l0Y2ggKHRoaXMuc3RhY2suc3RhdGUpIHtcclxuICAgICAgICAgICAgY2FzZSB4c0VhdFNwYWNlczpcclxuICAgICAgICAgICAgICAgIGlmICghaXNTcGFjZShjKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB0aGlzLnN0YWNrLnNhdmVkc3RhdGU7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c1N0YXJ0OlxyXG4gICAgICAgICAgICAgICAgaWYgKGMgPT0gQ0hBUl9MRVNTKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWxlbWVudDtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXNlIHhzRWxlbWVudDpcclxuICAgICAgICAgICAgICAgc3dpdGNoIChjKSB7XHJcbiAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfUVVFUzpcclxuICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnNhdmVkc3RhdGUgPSB4c1N0YXJ0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrVXAoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ci5wb3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VsZW1lbnRQSTtcclxuICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLmNsYXp6ID0geGNQcm9jZXNzSW5zdDtcclxuICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9FWENMOlxyXG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24gPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzU3RhcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWxlbWVudENvbW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5jbGF6eiA9IHhjQ29tbWVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQWxwaGEoYykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyLnBvcyA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFbGVtZW50TmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suY2xhenogPSB4Y0VsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHhzRWxlbWVudFBJOlxyXG4gICAgICAgICAgICAgICAgaWYgKGlzQWxwaGFOdW0oYykpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ci5hcHBlbmQoYyk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zdHIgPT0gU1RSX1hNTCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnNhdmVkc3RhdGUgPSB4c0F0dHJpYnV0ZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS5wb3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnNhdmVkc3RhdGUgPSB4c0VsZW1lbnREYXRhUEk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXNlIHhzRWxlbWVudERhdGFQSTpcclxuICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfUVVFUykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0Nsb3NlRWxlbWVudFBJO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChjKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHhzQ2xvc2VFbGVtZW50UEk6XHJcbiAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX0dSRUEpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrRG93bigpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFbGVtZW50TmFtZTpcclxuICAgICAgICAgICAgICAgIGlmIChpc0FscGhhTnVtKGMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHIuYXBwZW5kKGMpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLm5hbWUgPSB0aGlzLnN0ci50b0J1ZmZlcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghZXZlbnQoeHRPcGVuLCB0aGlzLnN0ci50b1N0cmluZygpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnNhdmVkc3RhdGUgPSB4c0F0dHJpYnV0ZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0NoaWxkTm9kZXM6XHJcbiAgICAgICAgICAgICAgICBpZiAoYyA9PSBDSEFSX0xFU1MpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNUcnlDbG9zZUVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWUucG9zID0gMDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFbGVtZW50U3RyaW5nO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suY2xhenogPSB4Y1N0cmluZztcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2FzZSB4c0Nsb3NlRW1wdHlFbGVtZW50OlxyXG4gICAgICAgICAgICAgICAgaWYgKGMgPT0gQ0hBUl9HUkVBKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFldmVudCh4dENsb3NlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5zdGFjay5wcmV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFYXRTcGFjZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zYXZlZHN0YXRlID0geHNFbmQ7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2FzZSB4c1RyeUNsb3NlRWxlbWVudDpcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAoYykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9TTEFIOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNDbG9zZUVsZW1lbnROYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHIucG9zID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHIuYXBwZW5kQnVmZmVyKHRoaXMuc3RhY2submFtZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9FWENMOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zYXZlZHN0YXRlID0geHNDaGlsZE5vZGVzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFbGVtZW50Q29tbWVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5jbGF6eiA9IHhjQ29tbWVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBDSEFSX1FVRVM6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQ2hpbGROb2RlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWF0U3BhY2VzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrVXAoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdHIucG9zID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWxlbWVudFBJO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLmNsYXp6ID0geGNQcm9jZXNzSW5zdDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzQ2hpbGROb2RlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFja1VwKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0FscGhhKGMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ci5wb3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWxlbWVudE5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLmNsYXp6ID0geGNFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHhzQ2xvc2VFbGVtZW50TmFtZTpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0ci5wb3MgPT0gdGhpcy5wb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQ2xvc2VFbXB0eUVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWF0U3BhY2VzO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSB0aGlzLnN0ci5idWZmZXJbdGhpcy5wb3NpdGlvbl0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0F0dHJpYnV0ZXM6XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGMpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfUVVFUzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RhY2suY2xhenogIT0geGNQcm9jZXNzSW5zdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0Nsb3NlRWxlbWVudFBJO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfU0xBSDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzQ2xvc2VFbXB0eUVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9HUkVBOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFYXRTcGFjZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQ2hpbGROb2RlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQWxwaGEoYykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyLnBvcyA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ci5hcHBlbmQoYyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNBdHRyaWJ1dGVOYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0F0dHJpYnV0ZU5hbWU6XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNBbHBoYU51bShjKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyLmFwcGVuZChjKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWF0U3BhY2VzO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzRXF1YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhc2UgeHNFcXVhbDpcclxuICAgICAgICAgICAgICAgIGlmIChjICE9IENIQVJfRVFVQSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQXR0cmlidXRlVmFsdWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLnBvcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gMDtcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnF1b3RlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNBdHRyaWJ1dGVWYWx1ZTpcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnF1b3RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGMgPT0gdGhpcy5xdW90ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zdGFjay5jbGF6eiAhPSB4Y1Byb2Nlc3NJbnN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudCh4dEF0dHJpYnV0ZSwgdGhpcy5zdHIudG9TdHJpbmcoKSwgdGhpcy52YWx1ZS50b1N0cmluZyh0aGlzLmVuY29kaW5nKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gIGVsc2UgaWYgKHRoaXMuc3RyID09IFNUUl9FTkNPRElORykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbmNvZGluZyA9IHRoaXMudmFsdWUudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQXR0cmlidXRlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWF0U3BhY2VzO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoYykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBDSEFSX0FNUEU6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRXNjYXBlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQXR0cmlidXRlVmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbi8qXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfQ1I6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfTEY6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS50cmltUmlnaHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChDSEFSX1NQKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFYXRTcGFjZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zYXZlZHN0YXRlID0geHNBdHRyaWJ1dGVWYWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICovXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWUuYXBwZW5kKGMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfU0lOUSB8fCBjID09IENIQVJfREJMUSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMucXVvdGUgPSBjO1xyXG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24rKztcclxuICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFbGVtZW50U3RyaW5nOlxyXG4gICAgICAgICAgICAgICAgc3dpdGNoIChjKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBDSEFSX0xFU1M6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vdGhpcy52YWx1ZS50cmltUmlnaHQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFldmVudCh4dFRleHQsIHRoaXMudmFsdWUudG9TdHJpbmcodGhpcy5lbmNvZGluZykpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzVHJ5Q2xvc2VFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuLypcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfQ1I6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBDSEFSX0xGOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLnRyaW1SaWdodCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChDSEFSX1NQKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWF0U3BhY2VzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnNhdmVkc3RhdGUgPSB4c0VsZW1lbnRTdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4qL1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9BTVBFOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzRWxlbWVudFN0cmluZztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS5hcHBlbmQoYyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0VsZW1lbnRDb21tZW50OlxyXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLnBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9NSU5VOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24rKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9MRUJSOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWUucG9zID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gMDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFbGVtZW50Q0RBVEE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5jbGF6eiA9IHhjQ2RhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0RvY3R5cGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX01JTlUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0ci5wb3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjICE9PSBDSEFSX01JTlUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyLmFwcGVuZChjKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24gPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzQ2xvc2VFbGVtZW50Q29tbWVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNDbG9zZUVsZW1lbnRDb21tZW50OlxyXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLnBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX01JTlUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24gPSAyO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWxlbWVudENvbW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX0dSRUEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCh4dENvbW1lbnQsIHRoaXMuc3RyLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWF0U3BhY2VzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0RvY3R5cGU6XHJcbiAgICAgICAgICAgICAgICAvLyB0b2RvOiBwYXJzZSBlbGVtZW50cyAuLi5cclxuICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfR1JFQSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5zdGFjay5wcmV2KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzQ2hpbGROb2Rlc1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc2F2ZWRzdGF0ZSA9IHhzU3RhcnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFbGVtZW50Q0RBVEE6XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMucG9zaXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfQykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfRCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfQSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfVCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfQSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDU6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjID09IENIQVJfTEVCUikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyA9PSBDSEFSX1JJQlIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24gPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzQ2xvZGVFbGVtZW50Q0RBVEE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChjKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNDbG9kZUVsZW1lbnRDREFUQTpcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5wb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGMgPT0gQ0hBUl9SSUJSKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChDSEFSX1JJQlIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS5hcHBlbmQoYyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gNjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VsZW1lbnRDREFUQTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoYykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBDSEFSX0dSRUE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFldmVudCh4dENEYXRhLCB0aGlzLnZhbHVlLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VhdFNwYWNlcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnNhdmVkc3RhdGUgPSB4c0NoaWxkTm9kZXM7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfUklCUjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChjKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChjKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRWxlbWVudENEQVRBO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFc2NhcGU6XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gMDtcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAoYykge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9sOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGVfbHQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9nOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGVfZ3Q7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9hOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGVfYW1wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfcTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHhzRXNjYXBlX3F1b3Q7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9TSFJQOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGVfY2hhcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFc2NhcGVfbHQ6XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMucG9zaXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjICE9IENIQVJfdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24rKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX1NDT0wpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChDSEFSX0xFU1MpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0gdGhpcy5zdGFjay5zYXZlZHN0YXRlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0VzY2FwZV9ndDpcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5wb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGMgIT0gQ0hBUl90KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjICE9IENIQVJfU0NPTCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWUuYXBwZW5kKENIQVJfR1JFQSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB0aGlzLnN0YWNrLnNhdmVkc3RhdGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHhzRXNjYXBlX2FtcDpcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5wb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChjKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfbTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIENIQVJfcDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGVfYXBvcztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjICE9IENIQVJfcCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24rKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX1NDT0wpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnZhbHVlLmFwcGVuZChDSEFSX0FNUEUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0gdGhpcy5zdGFjay5zYXZlZHN0YXRlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSB4c0VzY2FwZV9hcG9zOlxyXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLnBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9wOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24rKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgQ0hBUl9tOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VzY2FwZV9hbXA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX28pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGMgIT0gQ0hBUl9zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjICE9IENIQVJfU0NPTCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWUuYXBwZW5kKENIQVJfU0lOUSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB0aGlzLnN0YWNrLnNhdmVkc3RhdGU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFc2NhcGVfcXVvdDpcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5wb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGMgIT0gQ0hBUl91KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjICE9IENIQVJfbykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24rKztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYyAhPSBDSEFSX3QpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uKys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGMgIT0gQ0hBUl9TQ09MKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS5hcHBlbmQoQ0hBUl9EQkxRKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHRoaXMuc3RhY2suc2F2ZWRzdGF0ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFc2NhcGVfY2hhcjpcclxuICAgICAgICAgICAgICAgIGlmIChpc051bShjKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucG9zaXRpb24gPSBjIC0gQ0hBUl9aRVJPO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB4c0VzY2FwZV9jaGFyX251bTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PSBDSEFSX3gpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnN0YWNrLnN0YXRlID0geHNFc2NhcGVfY2hhcl9oZXg7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHhzRXNjYXBlX2NoYXJfbnVtOlxyXG4gICAgICAgICAgICAgICAgaWYgKGlzTnVtKGMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbiA9ICh0aGlzLnBvc2l0aW9uICogMTApICsgKGMgLSBDSEFSX1pFUk8pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjID09IENIQVJfU0NPTCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmFsdWUuYXBwZW5kKHRoaXMucG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhY2suc3RhdGUgPSB0aGlzLnN0YWNrLnNhdmVkc3RhdGU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlIHhzRXNjYXBlX2NoYXJfaGV4OlxyXG4gICAgICAgICAgICAgICAgaWYgKGlzSGV4KGMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbiA9ICh0aGlzLnBvc2l0aW9uICogMTYpICsgaGV4RGlnaXQoYyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGMgPT0gQ0hBUl9TQ09MKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52YWx1ZS5hcHBlbmQodGhpcy5wb3NpdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGFjay5zdGF0ZSA9IHRoaXMuc3RhY2suc2F2ZWRzdGF0ZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIGNhc2UgeHNFbmQ6XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN0YWNrRG93bigpO1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGkrKztcclxuICAgICAgICBpZiAoaSA+PSBsZW4pIGJyZWFrO1xyXG4gICAgICAgIGMgPSBidWZmZXJbaV07XHJcbiAgICAgICAgaWYgKGMgIT09IENIQVJfTEYpIHtcclxuICAgICAgICAgICAgdGhpcy5jb2wrKztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmNvbCA9IDA7XHJcbiAgICAgICAgICAgIHRoaXMubGluZSsrO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTtcclxuXHJcblhNTFBhcnNlci5wcm90b3R5cGUucGFyc2VTdHJpbmcgPSBmdW5jdGlvbihzdHIsIGV2ZW50KSB7XHJcbiAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdHIpO1xyXG4gICAgdGhpcy5wYXJzZUJ1ZmZlcihidWYsIGJ1Zi5sZW5ndGgsIGV2ZW50KTtcclxufTtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxudmFyIFNBWFBhcnNlRmlsZSA9IGV4cG9ydHMuU0FYUGFyc2VGaWxlID0gZnVuY3Rpb24ocGF0aCwgZXZlbnQsIGNhbGxiYWNrKSB7XHJcbiAgICBmcy5vcGVuKHBhdGgsICdyJywgZnVuY3Rpb24oZXJyLCBmZCkge1xyXG4gICAgICAgIHZhciBidWZmZXIgPSBuZXcgQnVmZmVyKEJVRkZFUl9MRU5HVEgpO1xyXG4gICAgICAgIHZhciBwYXJzZXIgPSBuZXcgWE1MUGFyc2VyKCk7XHJcbiAgICAgICAgaWYgKCFlcnIpIHtcclxuICAgICAgICAgICAgZnVuY3Rpb24gY2IoZXJyLCBicikge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYnIgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciByZXQgPSBwYXJzZXIucGFyc2VCdWZmZXIoYnVmZmVyLCBiciwgZXZlbnQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmV0ID09PSB1bmRlZmluZWQpe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVhZChmZCwgYnVmZmVyLCAwLCBCVUZGRVJfTEVOR1RILCBudWxsLCBjYik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmV0ID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmV0ID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soXCJwYXJzaW5nIGVycm9yIGF0IGxpbmU6IFwiICsgcGFyc2VyLmxpbmUgKyBcIiwgY29sOiBcIiArIHBhcnNlci5jb2wpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmcy5jbG9zZShmZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBmcy5jbG9zZShmZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZzLnJlYWQoZmQsIGJ1ZmZlciwgMCwgQlVGRkVSX0xFTkdUSCwgbnVsbCwgY2IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaylcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbn07XHJcblxyXG52YXIgU0FYUGFyc2VGaWxlU3luYyA9IGV4cG9ydHMuU0FYUGFyc2VGaWxlU3luYyA9IGZ1bmN0aW9uKHBhdGgsIGV2ZW50KSB7XHJcbiAgICB2YXIgZmQgPSBmcy5vcGVuU3luYyhwYXRoLCAncicpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB2YXIgYnVmZmVyID0gbmV3IEJ1ZmZlcihCVUZGRVJfTEVOR1RIKTtcclxuICAgICAgICB2YXIgcGFyc2VyID0gbmV3IFhNTFBhcnNlcigpO1xyXG4gICAgICAgIHZhciBiciA9IGZzLnJlYWRTeW5jKGZkLCBidWZmZXIsIDAsIEJVRkZFUl9MRU5HVEgpO1xyXG4gICAgICAgIHdoaWxlIChiciA+IDApIHtcclxuICAgICAgICAgICAgdmFyIHJldCA9IHBhcnNlci5wYXJzZUJ1ZmZlcihidWZmZXIsIGJyLCBldmVudCk7XHJcbiAgICAgICAgICAgIGlmIChyZXQgPT09IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgICAgICAgICBiciA9IGZzLnJlYWRTeW5jKGZkLCBidWZmZXIsIDAsIEJVRkZFUl9MRU5HVEgpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJldCA9PT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmV0ID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicGFyc2luZyBlcnJvciBhdCBsaW5lOiBcIiArIHBhcnNlci5saW5lICsgXCIsIGNvbDogXCIgKyBwYXJzZXIuY29sKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgICBmcy5jbG9zZVN5bmMoZmQpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuZnVuY3Rpb24gcHJvY2Vzc0V2ZW50KHN0YWNrLCBzdGF0ZSwgcDEsIHAyKSB7XHJcbiAgICB2YXIgbm9kZSwgcGFyZW50O1xyXG4gICAgc3dpdGNoIChzdGF0ZSkge1xyXG4gICAgICAgIGNhc2UgeHRPcGVuOlxyXG4gICAgICAgICAgICBub2RlID0ge25hbWU6IHAxfTtcclxuICAgICAgICAgICAgc3RhY2sucHVzaChub2RlKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSB4dENsb3NlOlxyXG4gICAgICAgICAgICBub2RlID0gc3RhY2sucG9wKCk7XHJcbiAgICAgICAgICAgIGlmIChzdGFjay5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHBhcmVudCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXTtcclxuICAgICAgICAgICAgICAgIGlmIChwYXJlbnQuY2hpbGRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmNoaWxkcy5wdXNoKG5vZGUpXHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZHMgPSBbbm9kZV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSB4dEF0dHJpYnV0ZTpcclxuICAgICAgICAgICAgcGFyZW50ID0gc3RhY2tbc3RhY2subGVuZ3RoLTFdO1xyXG4gICAgICAgICAgICBpZiAoIXBhcmVudC5hdHRyaWIpIHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5hdHRyaWIgPSB7fTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBwYXJlbnQuYXR0cmliW3AxXSA9IHAyO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIHh0VGV4dDpcclxuICAgICAgICBjYXNlIHh0Q0RhdGE6XHJcbiAgICAgICAgICAgIHBhcmVudCA9IHN0YWNrW3N0YWNrLmxlbmd0aC0xXTtcclxuICAgICAgICAgICAgaWYgKHBhcmVudC5jaGlsZHMpIHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZHMucHVzaChwMSlcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5jaGlsZHMgPSBbcDFdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5vZGU7XHJcbn1cclxuXHJcbmV4cG9ydHMucGFyc2VGaWxlID0gZnVuY3Rpb24ocGF0aCwgY2FsbGJhY2spIHtcclxuICAgIHZhciBzdGFjayA9IFtdLCBub2RlO1xyXG4gICAgU0FYUGFyc2VGaWxlKHBhdGgsXHJcbiAgICAgICAgZnVuY3Rpb24oc3RhdGUsIHAxLCBwMikge1xyXG4gICAgICAgICAgICBub2RlID0gcHJvY2Vzc0V2ZW50KHN0YWNrLCBzdGF0ZSwgcDEsIHAyKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBmdW5jdGlvbihlcnIpe1xyXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgbm9kZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICApO1xyXG59O1xyXG5cclxuZXhwb3J0cy5wYXJzZUZpbGVTeW5jID0gZnVuY3Rpb24ocGF0aCkge1xyXG4gICAgdmFyIHN0YWNrID0gW107XHJcbiAgICB2YXIgbm9kZSA9IG51bGw7XHJcbiAgICBTQVhQYXJzZUZpbGVTeW5jKHBhdGgsXHJcbiAgICAgICAgZnVuY3Rpb24oc3RhdGUsIHAxLCBwMikge1xyXG4gICAgICAgICAgICBub2RlID0gcHJvY2Vzc0V2ZW50KHN0YWNrLCBzdGF0ZSwgcDEsIHAyKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgKTtcclxuICAgIHJldHVybiBub2RlO1xyXG59O1xyXG5cclxudmFyIHBhcnNlQnVmZmVyID0gZXhwb3J0cy5wYXJzZUJ1ZmZlciA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xyXG4gICAgdmFyIG5vZGUgPSBudWxsLFxyXG4gICAgICAgIHBhcnNlciA9IG5ldyBYTUxQYXJzZXIoKSxcclxuICAgICAgICBzdGFjayA9IFtdO1xyXG5cclxuICAgIHZhciByZXQgPSBwYXJzZXIucGFyc2VCdWZmZXIoYnVmZmVyLCBidWZmZXIubGVuZ3RoLFxyXG4gICAgICAgIGZ1bmN0aW9uKHN0YXRlLCBwMSwgcDIpIHtcclxuICAgICAgICAgICAgbm9kZSA9IHByb2Nlc3NFdmVudChzdGFjaywgc3RhdGUsIHAxLCBwMik7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICk7XHJcbiAgICBpZiAocmV0ID09PSBmYWxzZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInBhcnNpbmcgZXJyb3IgYXQgbGluZTogXCIgKyBwYXJzZXIubGluZSArIFwiLCBjb2w6IFwiICsgcGFyc2VyLmNvbClcclxuICAgIH1cclxuICAgIHJldHVybiBub2RlO1xyXG59O1xyXG5cclxuZXhwb3J0cy5wYXJzZVN0cmluZyA9IGZ1bmN0aW9uKHN0cikge1xyXG4gICByZXR1cm4gcGFyc2VCdWZmZXIobmV3IEJ1ZmZlcihzdHIpKTtcclxufTsiLCJcbi8vIE11bHRpYnl0ZSBjb2RlYy4gSW4gdGhpcyBzY2hlbWUsIGEgY2hhcmFjdGVyIGlzIHJlcHJlc2VudGVkIGJ5IDEgb3IgbW9yZSBieXRlcy5cbi8vIE91ciBjb2RlYyBzdXBwb3J0cyBVVEYtMTYgc3Vycm9nYXRlcywgZXh0ZW5zaW9ucyBmb3IgR0IxODAzMCBhbmQgdW5pY29kZSBzZXF1ZW5jZXMuXG4vLyBUbyBzYXZlIG1lbW9yeSBhbmQgbG9hZGluZyB0aW1lLCB3ZSByZWFkIHRhYmxlIGZpbGVzIG9ubHkgd2hlbiByZXF1ZXN0ZWQuXG5cbmV4cG9ydHMuX2RiY3MgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBEQkNTQ29kZWMob3B0aW9ucyk7XG59XG5cbnZhciBVTkFTU0lHTkVEID0gLTEsXG4gICAgR0IxODAzMF9DT0RFID0gLTIsXG4gICAgU0VRX1NUQVJUICA9IC0xMCxcbiAgICBOT0RFX1NUQVJUID0gLTEwMDAsXG4gICAgVU5BU1NJR05FRF9OT0RFID0gbmV3IEFycmF5KDB4MTAwKSxcbiAgICBERUZfQ0hBUiA9IC0xO1xuXG5mb3IgKHZhciBpID0gMDsgaSA8IDB4MTAwOyBpKyspXG4gICAgVU5BU1NJR05FRF9OT0RFW2ldID0gVU5BU1NJR05FRDtcblxuXG4vLyBDbGFzcyBEQkNTQ29kZWMgcmVhZHMgYW5kIGluaXRpYWxpemVzIG1hcHBpbmcgdGFibGVzLlxuZnVuY3Rpb24gREJDU0NvZGVjKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIGlmICghb3B0aW9ucylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiREJDUyBjb2RlYyBpcyBjYWxsZWQgd2l0aG91dCB0aGUgZGF0YS5cIilcbiAgICBpZiAoIW9wdGlvbnMudGFibGUpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuY29kaW5nICdcIiArIG9wdGlvbnMuZW5jb2RpbmdOYW1lICsgXCInIGhhcyBubyBkYXRhLlwiKTtcblxuICAgIC8vIExvYWQgdGFibGVzLlxuICAgIHZhciBtYXBwaW5nVGFibGUgPSBvcHRpb25zLnRhYmxlKCk7XG5cblxuICAgIC8vIERlY29kZSB0YWJsZXM6IE1CQ1MgLT4gVW5pY29kZS5cblxuICAgIC8vIGRlY29kZVRhYmxlcyBpcyBhIHRyaWUsIGVuY29kZWQgYXMgYW4gYXJyYXkgb2YgYXJyYXlzIG9mIGludGVnZXJzLiBJbnRlcm5hbCBhcnJheXMgYXJlIHRyaWUgbm9kZXMgYW5kIGFsbCBoYXZlIGxlbiA9IDI1Ni5cbiAgICAvLyBUcmllIHJvb3QgaXMgZGVjb2RlVGFibGVzWzBdLlxuICAgIC8vIFZhbHVlczogPj0gIDAgLT4gdW5pY29kZSBjaGFyYWN0ZXIgY29kZS4gY2FuIGJlID4gMHhGRkZGXG4gICAgLy8gICAgICAgICA9PSBVTkFTU0lHTkVEIC0+IHVua25vd24vdW5hc3NpZ25lZCBzZXF1ZW5jZS5cbiAgICAvLyAgICAgICAgID09IEdCMTgwMzBfQ09ERSAtPiB0aGlzIGlzIHRoZSBlbmQgb2YgYSBHQjE4MDMwIDQtYnl0ZSBzZXF1ZW5jZS5cbiAgICAvLyAgICAgICAgIDw9IE5PREVfU1RBUlQgLT4gaW5kZXggb2YgdGhlIG5leHQgbm9kZSBpbiBvdXIgdHJpZSB0byBwcm9jZXNzIG5leHQgYnl0ZS5cbiAgICAvLyAgICAgICAgIDw9IFNFUV9TVEFSVCAgLT4gaW5kZXggb2YgdGhlIHN0YXJ0IG9mIGEgY2hhcmFjdGVyIGNvZGUgc2VxdWVuY2UsIGluIGRlY29kZVRhYmxlU2VxLlxuICAgIHRoaXMuZGVjb2RlVGFibGVzID0gW107XG4gICAgdGhpcy5kZWNvZGVUYWJsZXNbMF0gPSBVTkFTU0lHTkVEX05PREUuc2xpY2UoMCk7IC8vIENyZWF0ZSByb290IG5vZGUuXG5cbiAgICAvLyBTb21ldGltZXMgYSBNQkNTIGNoYXIgY29ycmVzcG9uZHMgdG8gYSBzZXF1ZW5jZSBvZiB1bmljb2RlIGNoYXJzLiBXZSBzdG9yZSB0aGVtIGFzIGFycmF5cyBvZiBpbnRlZ2VycyBoZXJlLiBcbiAgICB0aGlzLmRlY29kZVRhYmxlU2VxID0gW107XG5cbiAgICAvLyBBY3R1YWwgbWFwcGluZyB0YWJsZXMgY29uc2lzdCBvZiBjaHVua3MuIFVzZSB0aGVtIHRvIGZpbGwgdXAgZGVjb2RlIHRhYmxlcy5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hcHBpbmdUYWJsZS5sZW5ndGg7IGkrKylcbiAgICAgICAgdGhpcy5fYWRkRGVjb2RlQ2h1bmsobWFwcGluZ1RhYmxlW2ldKTtcblxuICAgIHRoaXMuZGVmYXVsdENoYXJVbmljb2RlID0gb3B0aW9ucy5pY29udi5kZWZhdWx0Q2hhclVuaWNvZGU7XG5cbiAgICBcbiAgICAvLyBFbmNvZGUgdGFibGVzOiBVbmljb2RlIC0+IERCQ1MuXG5cbiAgICAvLyBgZW5jb2RlVGFibGVgIGlzIGFycmF5IG1hcHBpbmcgZnJvbSB1bmljb2RlIGNoYXIgdG8gZW5jb2RlZCBjaGFyLiBBbGwgaXRzIHZhbHVlcyBhcmUgaW50ZWdlcnMgZm9yIHBlcmZvcm1hbmNlLlxuICAgIC8vIEJlY2F1c2UgaXQgY2FuIGJlIHNwYXJzZSwgaXQgaXMgcmVwcmVzZW50ZWQgYXMgYXJyYXkgb2YgYnVja2V0cyBieSAyNTYgY2hhcnMgZWFjaC4gQnVja2V0IGNhbiBiZSBudWxsLlxuICAgIC8vIFZhbHVlczogPj0gIDAgLT4gaXQgaXMgYSBub3JtYWwgY2hhci4gV3JpdGUgdGhlIHZhbHVlIChpZiA8PTI1NiB0aGVuIDEgYnl0ZSwgaWYgPD02NTUzNiB0aGVuIDIgYnl0ZXMsIGV0Yy4pLlxuICAgIC8vICAgICAgICAgPT0gVU5BU1NJR05FRCAtPiBubyBjb252ZXJzaW9uIGZvdW5kLiBPdXRwdXQgYSBkZWZhdWx0IGNoYXIuXG4gICAgLy8gICAgICAgICA8PSBTRVFfU1RBUlQgIC0+IGl0J3MgYW4gaW5kZXggaW4gZW5jb2RlVGFibGVTZXEsIHNlZSBiZWxvdy4gVGhlIGNoYXJhY3RlciBzdGFydHMgYSBzZXF1ZW5jZS5cbiAgICB0aGlzLmVuY29kZVRhYmxlID0gW107XG4gICAgXG4gICAgLy8gYGVuY29kZVRhYmxlU2VxYCBpcyB1c2VkIHdoZW4gYSBzZXF1ZW5jZSBvZiB1bmljb2RlIGNoYXJhY3RlcnMgaXMgZW5jb2RlZCBhcyBhIHNpbmdsZSBjb2RlLiBXZSB1c2UgYSB0cmVlIG9mXG4gICAgLy8gb2JqZWN0cyB3aGVyZSBrZXlzIGNvcnJlc3BvbmQgdG8gY2hhcmFjdGVycyBpbiBzZXF1ZW5jZSBhbmQgbGVhZnMgYXJlIHRoZSBlbmNvZGVkIGRiY3MgdmFsdWVzLiBBIHNwZWNpYWwgREVGX0NIQVIga2V5XG4gICAgLy8gbWVhbnMgZW5kIG9mIHNlcXVlbmNlIChuZWVkZWQgd2hlbiBvbmUgc2VxdWVuY2UgaXMgYSBzdHJpY3Qgc3Vic2VxdWVuY2Ugb2YgYW5vdGhlcikuXG4gICAgLy8gT2JqZWN0cyBhcmUga2VwdCBzZXBhcmF0ZWx5IGZyb20gZW5jb2RlVGFibGUgdG8gaW5jcmVhc2UgcGVyZm9ybWFuY2UuXG4gICAgdGhpcy5lbmNvZGVUYWJsZVNlcSA9IFtdO1xuXG4gICAgLy8gU29tZSBjaGFycyBjYW4gYmUgZGVjb2RlZCwgYnV0IG5lZWQgbm90IGJlIGVuY29kZWQuXG4gICAgdmFyIHNraXBFbmNvZGVDaGFycyA9IHt9O1xuICAgIGlmIChvcHRpb25zLmVuY29kZVNraXBWYWxzKVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9wdGlvbnMuZW5jb2RlU2tpcFZhbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciByYW5nZSA9IG9wdGlvbnMuZW5jb2RlU2tpcFZhbHNbaV07XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gcmFuZ2UuZnJvbTsgaiA8PSByYW5nZS50bzsgaisrKVxuICAgICAgICAgICAgICAgIHNraXBFbmNvZGVDaGFyc1tqXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgLy8gVXNlIGRlY29kZSB0cmllIHRvIHJlY3Vyc2l2ZWx5IGZpbGwgb3V0IGVuY29kZSB0YWJsZXMuXG4gICAgdGhpcy5fZmlsbEVuY29kZVRhYmxlKDAsIDAsIHNraXBFbmNvZGVDaGFycyk7XG5cbiAgICAvLyBBZGQgbW9yZSBlbmNvZGluZyBwYWlycyB3aGVuIG5lZWRlZC5cbiAgICBpZiAob3B0aW9ucy5lbmNvZGVBZGQpIHtcbiAgICAgICAgZm9yICh2YXIgdUNoYXIgaW4gb3B0aW9ucy5lbmNvZGVBZGQpXG4gICAgICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9wdGlvbnMuZW5jb2RlQWRkLCB1Q2hhcikpXG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0RW5jb2RlQ2hhcih1Q2hhci5jaGFyQ29kZUF0KDApLCBvcHRpb25zLmVuY29kZUFkZFt1Q2hhcl0pO1xuICAgIH1cblxuICAgIHRoaXMuZGVmQ2hhclNCICA9IHRoaXMuZW5jb2RlVGFibGVbMF1bb3B0aW9ucy5pY29udi5kZWZhdWx0Q2hhclNpbmdsZUJ5dGUuY2hhckNvZGVBdCgwKV07XG4gICAgaWYgKHRoaXMuZGVmQ2hhclNCID09PSBVTkFTU0lHTkVEKSB0aGlzLmRlZkNoYXJTQiA9IHRoaXMuZW5jb2RlVGFibGVbMF1bJz8nXTtcbiAgICBpZiAodGhpcy5kZWZDaGFyU0IgPT09IFVOQVNTSUdORUQpIHRoaXMuZGVmQ2hhclNCID0gXCI/XCIuY2hhckNvZGVBdCgwKTtcblxuXG4gICAgLy8gTG9hZCAmIGNyZWF0ZSBHQjE4MDMwIHRhYmxlcyB3aGVuIG5lZWRlZC5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZ2IxODAzMCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLmdiMTgwMzAgPSBvcHRpb25zLmdiMTgwMzAoKTsgLy8gTG9hZCBHQjE4MDMwIHJhbmdlcy5cblxuICAgICAgICAvLyBBZGQgR0IxODAzMCBkZWNvZGUgdGFibGVzLlxuICAgICAgICB2YXIgdGhpcmRCeXRlTm9kZUlkeCA9IHRoaXMuZGVjb2RlVGFibGVzLmxlbmd0aDtcbiAgICAgICAgdmFyIHRoaXJkQnl0ZU5vZGUgPSB0aGlzLmRlY29kZVRhYmxlc1t0aGlyZEJ5dGVOb2RlSWR4XSA9IFVOQVNTSUdORURfTk9ERS5zbGljZSgwKTtcblxuICAgICAgICB2YXIgZm91cnRoQnl0ZU5vZGVJZHggPSB0aGlzLmRlY29kZVRhYmxlcy5sZW5ndGg7XG4gICAgICAgIHZhciBmb3VydGhCeXRlTm9kZSA9IHRoaXMuZGVjb2RlVGFibGVzW2ZvdXJ0aEJ5dGVOb2RlSWR4XSA9IFVOQVNTSUdORURfTk9ERS5zbGljZSgwKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMHg4MTsgaSA8PSAweEZFOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBzZWNvbmRCeXRlTm9kZUlkeCA9IE5PREVfU1RBUlQgLSB0aGlzLmRlY29kZVRhYmxlc1swXVtpXTtcbiAgICAgICAgICAgIHZhciBzZWNvbmRCeXRlTm9kZSA9IHRoaXMuZGVjb2RlVGFibGVzW3NlY29uZEJ5dGVOb2RlSWR4XTtcbiAgICAgICAgICAgIGZvciAodmFyIGogPSAweDMwOyBqIDw9IDB4Mzk7IGorKylcbiAgICAgICAgICAgICAgICBzZWNvbmRCeXRlTm9kZVtqXSA9IE5PREVfU1RBUlQgLSB0aGlyZEJ5dGVOb2RlSWR4O1xuICAgICAgICB9XG4gICAgICAgIGZvciAodmFyIGkgPSAweDgxOyBpIDw9IDB4RkU7IGkrKylcbiAgICAgICAgICAgIHRoaXJkQnl0ZU5vZGVbaV0gPSBOT0RFX1NUQVJUIC0gZm91cnRoQnl0ZU5vZGVJZHg7XG4gICAgICAgIGZvciAodmFyIGkgPSAweDMwOyBpIDw9IDB4Mzk7IGkrKylcbiAgICAgICAgICAgIGZvdXJ0aEJ5dGVOb2RlW2ldID0gR0IxODAzMF9DT0RFXG4gICAgfSAgICAgICAgXG59XG5cbi8vIFB1YmxpYyBpbnRlcmZhY2U6IGNyZWF0ZSBlbmNvZGVyIGFuZCBkZWNvZGVyIG9iamVjdHMuIFxuLy8gVGhlIG1ldGhvZHMgKHdyaXRlLCBlbmQpIGFyZSBzaW1wbGUgZnVuY3Rpb25zIHRvIG5vdCBpbmhpYml0IG9wdGltaXphdGlvbnMuXG5EQkNTQ29kZWMucHJvdG90eXBlLmVuY29kZXIgPSBmdW5jdGlvbiBlbmNvZGVyREJDUyhvcHRpb25zKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgLy8gTWV0aG9kc1xuICAgICAgICB3cml0ZTogZW5jb2RlckRCQ1NXcml0ZSxcbiAgICAgICAgZW5kOiBlbmNvZGVyREJDU0VuZCxcblxuICAgICAgICAvLyBFbmNvZGVyIHN0YXRlXG4gICAgICAgIGxlYWRTdXJyb2dhdGU6IC0xLFxuICAgICAgICBzZXFPYmo6IHVuZGVmaW5lZCxcbiAgICAgICAgXG4gICAgICAgIC8vIFN0YXRpYyBkYXRhXG4gICAgICAgIGVuY29kZVRhYmxlOiB0aGlzLmVuY29kZVRhYmxlLFxuICAgICAgICBlbmNvZGVUYWJsZVNlcTogdGhpcy5lbmNvZGVUYWJsZVNlcSxcbiAgICAgICAgZGVmYXVsdENoYXJTaW5nbGVCeXRlOiB0aGlzLmRlZkNoYXJTQixcbiAgICAgICAgZ2IxODAzMDogdGhpcy5nYjE4MDMwLFxuXG4gICAgICAgIC8vIEV4cG9ydCBmb3IgdGVzdGluZ1xuICAgICAgICBmaW5kSWR4OiBmaW5kSWR4LFxuICAgIH1cbn1cblxuREJDU0NvZGVjLnByb3RvdHlwZS5kZWNvZGVyID0gZnVuY3Rpb24gZGVjb2RlckRCQ1Mob3B0aW9ucykge1xuICAgIHJldHVybiB7XG4gICAgICAgIC8vIE1ldGhvZHNcbiAgICAgICAgd3JpdGU6IGRlY29kZXJEQkNTV3JpdGUsXG4gICAgICAgIGVuZDogZGVjb2RlckRCQ1NFbmQsXG5cbiAgICAgICAgLy8gRGVjb2RlciBzdGF0ZVxuICAgICAgICBub2RlSWR4OiAwLFxuICAgICAgICBwcmV2QnVmOiBuZXcgQnVmZmVyKDApLFxuXG4gICAgICAgIC8vIFN0YXRpYyBkYXRhXG4gICAgICAgIGRlY29kZVRhYmxlczogdGhpcy5kZWNvZGVUYWJsZXMsXG4gICAgICAgIGRlY29kZVRhYmxlU2VxOiB0aGlzLmRlY29kZVRhYmxlU2VxLFxuICAgICAgICBkZWZhdWx0Q2hhclVuaWNvZGU6IHRoaXMuZGVmYXVsdENoYXJVbmljb2RlLFxuICAgICAgICBnYjE4MDMwOiB0aGlzLmdiMTgwMzAsXG4gICAgfVxufVxuXG5cblxuLy8gRGVjb2RlciBoZWxwZXJzXG5EQkNTQ29kZWMucHJvdG90eXBlLl9nZXREZWNvZGVUcmllTm9kZSA9IGZ1bmN0aW9uKGFkZHIpIHtcbiAgICB2YXIgYnl0ZXMgPSBbXTtcbiAgICBmb3IgKDsgYWRkciA+IDA7IGFkZHIgPj49IDgpXG4gICAgICAgIGJ5dGVzLnB1c2goYWRkciAmIDB4RkYpO1xuICAgIGlmIChieXRlcy5sZW5ndGggPT0gMClcbiAgICAgICAgYnl0ZXMucHVzaCgwKTtcblxuICAgIHZhciBub2RlID0gdGhpcy5kZWNvZGVUYWJsZXNbMF07XG4gICAgZm9yICh2YXIgaSA9IGJ5dGVzLmxlbmd0aC0xOyBpID4gMDsgaS0tKSB7IC8vIFRyYXZlcnNlIG5vZGVzIGRlZXBlciBpbnRvIHRoZSB0cmllLlxuICAgICAgICB2YXIgdmFsID0gbm9kZVtieXRlc1tpXV07XG5cbiAgICAgICAgaWYgKHZhbCA9PSBVTkFTU0lHTkVEKSB7IC8vIENyZWF0ZSBuZXcgbm9kZS5cbiAgICAgICAgICAgIG5vZGVbYnl0ZXNbaV1dID0gTk9ERV9TVEFSVCAtIHRoaXMuZGVjb2RlVGFibGVzLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMuZGVjb2RlVGFibGVzLnB1c2gobm9kZSA9IFVOQVNTSUdORURfTk9ERS5zbGljZSgwKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodmFsIDw9IE5PREVfU1RBUlQpIHsgLy8gRXhpc3Rpbmcgbm9kZS5cbiAgICAgICAgICAgIG5vZGUgPSB0aGlzLmRlY29kZVRhYmxlc1tOT0RFX1NUQVJUIC0gdmFsXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVyd3JpdGUgYnl0ZSBpbiBcIiArIHRoaXMub3B0aW9ucy5lbmNvZGluZ05hbWUgKyBcIiwgYWRkcjogXCIgKyBhZGRyLnRvU3RyaW5nKDE2KSk7XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xufVxuXG5cbkRCQ1NDb2RlYy5wcm90b3R5cGUuX2FkZERlY29kZUNodW5rID0gZnVuY3Rpb24oY2h1bmspIHtcbiAgICAvLyBGaXJzdCBlbGVtZW50IG9mIGNodW5rIGlzIHRoZSBoZXggbWJjcyBjb2RlIHdoZXJlIHdlIHN0YXJ0LlxuICAgIHZhciBjdXJBZGRyID0gcGFyc2VJbnQoY2h1bmtbMF0sIDE2KTtcblxuICAgIC8vIENob29zZSB0aGUgZGVjb2Rpbmcgbm9kZSB3aGVyZSB3ZSdsbCB3cml0ZSBvdXIgY2hhcnMuXG4gICAgdmFyIHdyaXRlVGFibGUgPSB0aGlzLl9nZXREZWNvZGVUcmllTm9kZShjdXJBZGRyKTtcbiAgICBjdXJBZGRyID0gY3VyQWRkciAmIDB4RkY7XG5cbiAgICAvLyBXcml0ZSBhbGwgb3RoZXIgZWxlbWVudHMgb2YgdGhlIGNodW5rIHRvIHRoZSB0YWJsZS5cbiAgICBmb3IgKHZhciBrID0gMTsgayA8IGNodW5rLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIHZhciBwYXJ0ID0gY2h1bmtba107XG4gICAgICAgIGlmICh0eXBlb2YgcGFydCA9PT0gXCJzdHJpbmdcIikgeyAvLyBTdHJpbmcsIHdyaXRlIGFzLWlzLlxuICAgICAgICAgICAgZm9yICh2YXIgbCA9IDA7IGwgPCBwYXJ0Lmxlbmd0aDspIHtcbiAgICAgICAgICAgICAgICB2YXIgY29kZSA9IHBhcnQuY2hhckNvZGVBdChsKyspO1xuICAgICAgICAgICAgICAgIGlmICgweEQ4MDAgPD0gY29kZSAmJiBjb2RlIDwgMHhEQzAwKSB7IC8vIERlY29kZSBzdXJyb2dhdGVcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNvZGVUcmFpbCA9IHBhcnQuY2hhckNvZGVBdChsKyspO1xuICAgICAgICAgICAgICAgICAgICBpZiAoMHhEQzAwIDw9IGNvZGVUcmFpbCAmJiBjb2RlVHJhaWwgPCAweEUwMDApXG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZVRhYmxlW2N1ckFkZHIrK10gPSAweDEwMDAwICsgKGNvZGUgLSAweEQ4MDApICogMHg0MDAgKyAoY29kZVRyYWlsIC0gMHhEQzAwKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5jb3JyZWN0IHN1cnJvZ2F0ZSBwYWlyIGluIFwiICArIHRoaXMub3B0aW9ucy5lbmNvZGluZ05hbWUgKyBcIiBhdCBjaHVuayBcIiArIGNodW5rWzBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoMHgwRkYwIDwgY29kZSAmJiBjb2RlIDw9IDB4MEZGRikgeyAvLyBDaGFyYWN0ZXIgc2VxdWVuY2UgKG91ciBvd24gZW5jb2RpbmcgdXNlZClcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxlbiA9IDB4RkZGIC0gY29kZSArIDI7XG4gICAgICAgICAgICAgICAgICAgIHZhciBzZXEgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgbSA9IDA7IG0gPCBsZW47IG0rKylcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcS5wdXNoKHBhcnQuY2hhckNvZGVBdChsKyspKTsgLy8gU2ltcGxlIHZhcmlhdGlvbjogZG9uJ3Qgc3VwcG9ydCBzdXJyb2dhdGVzIG9yIHN1YnNlcXVlbmNlcyBpbiBzZXEuXG5cbiAgICAgICAgICAgICAgICAgICAgd3JpdGVUYWJsZVtjdXJBZGRyKytdID0gU0VRX1NUQVJUIC0gdGhpcy5kZWNvZGVUYWJsZVNlcS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGVjb2RlVGFibGVTZXEucHVzaChzZXEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHdyaXRlVGFibGVbY3VyQWRkcisrXSA9IGNvZGU7IC8vIEJhc2ljIGNoYXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHBhcnQgPT09IFwibnVtYmVyXCIpIHsgLy8gSW50ZWdlciwgbWVhbmluZyBpbmNyZWFzaW5nIHNlcXVlbmNlIHN0YXJ0aW5nIHdpdGggcHJldiBjaGFyYWN0ZXIuXG4gICAgICAgICAgICB2YXIgY2hhckNvZGUgPSB3cml0ZVRhYmxlW2N1ckFkZHIgLSAxXSArIDE7XG4gICAgICAgICAgICBmb3IgKHZhciBsID0gMDsgbCA8IHBhcnQ7IGwrKylcbiAgICAgICAgICAgICAgICB3cml0ZVRhYmxlW2N1ckFkZHIrK10gPSBjaGFyQ29kZSsrO1xuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkluY29ycmVjdCB0eXBlICdcIiArIHR5cGVvZiBwYXJ0ICsgXCInIGdpdmVuIGluIFwiICArIHRoaXMub3B0aW9ucy5lbmNvZGluZ05hbWUgKyBcIiBhdCBjaHVuayBcIiArIGNodW5rWzBdKTtcbiAgICB9XG4gICAgaWYgKGN1ckFkZHIgPiAweEZGKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbmNvcnJlY3QgY2h1bmsgaW4gXCIgICsgdGhpcy5vcHRpb25zLmVuY29kaW5nTmFtZSArIFwiIGF0IGFkZHIgXCIgKyBjaHVua1swXSArIFwiOiB0b28gbG9uZ1wiICsgY3VyQWRkcik7XG59XG5cbi8vIEVuY29kZXIgaGVscGVyc1xuREJDU0NvZGVjLnByb3RvdHlwZS5fZ2V0RW5jb2RlQnVja2V0ID0gZnVuY3Rpb24odUNvZGUpIHtcbiAgICB2YXIgaGlnaCA9IHVDb2RlID4+IDg7IC8vIFRoaXMgY291bGQgYmUgPiAweEZGIGJlY2F1c2Ugb2YgYXN0cmFsIGNoYXJhY3RlcnMuXG4gICAgaWYgKHRoaXMuZW5jb2RlVGFibGVbaGlnaF0gPT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhpcy5lbmNvZGVUYWJsZVtoaWdoXSA9IFVOQVNTSUdORURfTk9ERS5zbGljZSgwKTsgLy8gQ3JlYXRlIGJ1Y2tldCBvbiBkZW1hbmQuXG4gICAgcmV0dXJuIHRoaXMuZW5jb2RlVGFibGVbaGlnaF07XG59XG5cbkRCQ1NDb2RlYy5wcm90b3R5cGUuX3NldEVuY29kZUNoYXIgPSBmdW5jdGlvbih1Q29kZSwgZGJjc0NvZGUpIHtcbiAgICB2YXIgYnVja2V0ID0gdGhpcy5fZ2V0RW5jb2RlQnVja2V0KHVDb2RlKTtcbiAgICB2YXIgbG93ID0gdUNvZGUgJiAweEZGO1xuICAgIGlmIChidWNrZXRbbG93XSA8PSBTRVFfU1RBUlQpXG4gICAgICAgIHRoaXMuZW5jb2RlVGFibGVTZXFbU0VRX1NUQVJULWJ1Y2tldFtsb3ddXVtERUZfQ0hBUl0gPSBkYmNzQ29kZTsgLy8gVGhlcmUncyBhbHJlYWR5IGEgc2VxdWVuY2UsIHNldCBhIHNpbmdsZS1jaGFyIHN1YnNlcXVlbmNlIG9mIGl0LlxuICAgIGVsc2UgaWYgKGJ1Y2tldFtsb3ddID09IFVOQVNTSUdORUQpXG4gICAgICAgIGJ1Y2tldFtsb3ddID0gZGJjc0NvZGU7XG59XG5cbkRCQ1NDb2RlYy5wcm90b3R5cGUuX3NldEVuY29kZVNlcXVlbmNlID0gZnVuY3Rpb24oc2VxLCBkYmNzQ29kZSkge1xuICAgIFxuICAgIC8vIEdldCB0aGUgcm9vdCBvZiBjaGFyYWN0ZXIgdHJlZSBhY2NvcmRpbmcgdG8gZmlyc3QgY2hhcmFjdGVyIG9mIHRoZSBzZXF1ZW5jZS5cbiAgICB2YXIgdUNvZGUgPSBzZXFbMF07XG4gICAgdmFyIGJ1Y2tldCA9IHRoaXMuX2dldEVuY29kZUJ1Y2tldCh1Q29kZSk7XG4gICAgdmFyIGxvdyA9IHVDb2RlICYgMHhGRjtcblxuICAgIHZhciBub2RlO1xuICAgIGlmIChidWNrZXRbbG93XSA8PSBTRVFfU1RBUlQpIHtcbiAgICAgICAgLy8gVGhlcmUncyBhbHJlYWR5IGEgc2VxdWVuY2Ugd2l0aCAgLSB1c2UgaXQuXG4gICAgICAgIG5vZGUgPSB0aGlzLmVuY29kZVRhYmxlU2VxW1NFUV9TVEFSVC1idWNrZXRbbG93XV07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSB3YXMgbm8gc2VxdWVuY2Ugb2JqZWN0IC0gYWxsb2NhdGUgYSBuZXcgb25lLlxuICAgICAgICBub2RlID0ge307XG4gICAgICAgIGlmIChidWNrZXRbbG93XSAhPT0gVU5BU1NJR05FRCkgbm9kZVtERUZfQ0hBUl0gPSBidWNrZXRbbG93XTsgLy8gSWYgYSBjaGFyIHdhcyBzZXQgYmVmb3JlIC0gbWFrZSBpdCBhIHNpbmdsZS1jaGFyIHN1YnNlcXVlbmNlLlxuICAgICAgICBidWNrZXRbbG93XSA9IFNFUV9TVEFSVCAtIHRoaXMuZW5jb2RlVGFibGVTZXEubGVuZ3RoO1xuICAgICAgICB0aGlzLmVuY29kZVRhYmxlU2VxLnB1c2gobm9kZSk7XG4gICAgfVxuXG4gICAgLy8gVHJhdmVyc2UgdGhlIGNoYXJhY3RlciB0cmVlLCBhbGxvY2F0aW5nIG5ldyBub2RlcyBhcyBuZWVkZWQuXG4gICAgZm9yICh2YXIgaiA9IDE7IGogPCBzZXEubGVuZ3RoLTE7IGorKykge1xuICAgICAgICB2YXIgb2xkVmFsID0gbm9kZVt1Q29kZV07XG4gICAgICAgIGlmICh0eXBlb2Ygb2xkVmFsID09PSAnb2JqZWN0JylcbiAgICAgICAgICAgIG5vZGUgPSBvbGRWYWw7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbm9kZSA9IG5vZGVbdUNvZGVdID0ge31cbiAgICAgICAgICAgIGlmIChvbGRWYWwgIT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICBub2RlW0RFRl9DSEFSXSA9IG9sZFZhbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBsZWFmIHRvIGdpdmVuIGRiY3NDb2RlLlxuICAgIHVDb2RlID0gc2VxW3NlcS5sZW5ndGgtMV07XG4gICAgbm9kZVt1Q29kZV0gPSBkYmNzQ29kZTtcbn1cblxuREJDU0NvZGVjLnByb3RvdHlwZS5fZmlsbEVuY29kZVRhYmxlID0gZnVuY3Rpb24obm9kZUlkeCwgcHJlZml4LCBza2lwRW5jb2RlQ2hhcnMpIHtcbiAgICB2YXIgbm9kZSA9IHRoaXMuZGVjb2RlVGFibGVzW25vZGVJZHhdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMHgxMDA7IGkrKykge1xuICAgICAgICB2YXIgdUNvZGUgPSBub2RlW2ldO1xuICAgICAgICB2YXIgbWJDb2RlID0gcHJlZml4ICsgaTtcbiAgICAgICAgaWYgKHNraXBFbmNvZGVDaGFyc1ttYkNvZGVdKVxuICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgaWYgKHVDb2RlID49IDApXG4gICAgICAgICAgICB0aGlzLl9zZXRFbmNvZGVDaGFyKHVDb2RlLCBtYkNvZGUpO1xuICAgICAgICBlbHNlIGlmICh1Q29kZSA8PSBOT0RFX1NUQVJUKVxuICAgICAgICAgICAgdGhpcy5fZmlsbEVuY29kZVRhYmxlKE5PREVfU1RBUlQgLSB1Q29kZSwgbWJDb2RlIDw8IDgsIHNraXBFbmNvZGVDaGFycyk7XG4gICAgICAgIGVsc2UgaWYgKHVDb2RlIDw9IFNFUV9TVEFSVClcbiAgICAgICAgICAgIHRoaXMuX3NldEVuY29kZVNlcXVlbmNlKHRoaXMuZGVjb2RlVGFibGVTZXFbU0VRX1NUQVJUIC0gdUNvZGVdLCBtYkNvZGUpO1xuICAgIH1cbn1cblxuXG5cbi8vID09IEFjdHVhbCBFbmNvZGluZyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cblxuZnVuY3Rpb24gZW5jb2RlckRCQ1NXcml0ZShzdHIpIHtcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihzdHIubGVuZ3RoICogKHRoaXMuZ2IxODAzMCA/IDQgOiAzKSksIFxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gdGhpcy5sZWFkU3Vycm9nYXRlLFxuICAgICAgICBzZXFPYmogPSB0aGlzLnNlcU9iaiwgbmV4dENoYXIgPSAtMSxcbiAgICAgICAgaSA9IDAsIGogPSAwO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgLy8gMC4gR2V0IG5leHQgY2hhcmFjdGVyLlxuICAgICAgICBpZiAobmV4dENoYXIgPT09IC0xKSB7XG4gICAgICAgICAgICBpZiAoaSA9PSBzdHIubGVuZ3RoKSBicmVhaztcbiAgICAgICAgICAgIHZhciB1Q29kZSA9IHN0ci5jaGFyQ29kZUF0KGkrKyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgdUNvZGUgPSBuZXh0Q2hhcjtcbiAgICAgICAgICAgIG5leHRDaGFyID0gLTE7ICAgIFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gMS4gSGFuZGxlIHN1cnJvZ2F0ZXMuXG4gICAgICAgIGlmICgweEQ4MDAgPD0gdUNvZGUgJiYgdUNvZGUgPCAweEUwMDApIHsgLy8gQ2hhciBpcyBvbmUgb2Ygc3Vycm9nYXRlcy5cbiAgICAgICAgICAgIGlmICh1Q29kZSA8IDB4REMwMCkgeyAvLyBXZSd2ZSBnb3QgbGVhZCBzdXJyb2dhdGUuXG4gICAgICAgICAgICAgICAgaWYgKGxlYWRTdXJyb2dhdGUgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGxlYWRTdXJyb2dhdGUgPSB1Q29kZTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IHVDb2RlO1xuICAgICAgICAgICAgICAgICAgICAvLyBEb3VibGUgbGVhZCBzdXJyb2dhdGUgZm91bmQuXG4gICAgICAgICAgICAgICAgICAgIHVDb2RlID0gVU5BU1NJR05FRDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBXZSd2ZSBnb3QgdHJhaWwgc3Vycm9nYXRlLlxuICAgICAgICAgICAgICAgIGlmIChsZWFkU3Vycm9nYXRlICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICB1Q29kZSA9IDB4MTAwMDAgKyAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCkgKiAweDQwMCArICh1Q29kZSAtIDB4REMwMCk7XG4gICAgICAgICAgICAgICAgICAgIGxlYWRTdXJyb2dhdGUgPSAtMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBJbmNvbXBsZXRlIHN1cnJvZ2F0ZSBwYWlyIC0gb25seSB0cmFpbCBzdXJyb2dhdGUgZm91bmQuXG4gICAgICAgICAgICAgICAgICAgIHVDb2RlID0gVU5BU1NJR05FRDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIEluY29tcGxldGUgc3Vycm9nYXRlIHBhaXIgLSBvbmx5IGxlYWQgc3Vycm9nYXRlIGZvdW5kLlxuICAgICAgICAgICAgbmV4dENoYXIgPSB1Q29kZTsgdUNvZGUgPSBVTkFTU0lHTkVEOyAvLyBXcml0ZSBhbiBlcnJvciwgdGhlbiBjdXJyZW50IGNoYXIuXG4gICAgICAgICAgICBsZWFkU3Vycm9nYXRlID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAyLiBDb252ZXJ0IHVDb2RlIGNoYXJhY3Rlci5cbiAgICAgICAgdmFyIGRiY3NDb2RlID0gVU5BU1NJR05FRDtcbiAgICAgICAgaWYgKHNlcU9iaiAhPT0gdW5kZWZpbmVkICYmIHVDb2RlICE9IFVOQVNTSUdORUQpIHsgLy8gV2UgYXJlIGluIHRoZSBtaWRkbGUgb2YgdGhlIHNlcXVlbmNlXG4gICAgICAgICAgICB2YXIgcmVzQ29kZSA9IHNlcU9ialt1Q29kZV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlc0NvZGUgPT09ICdvYmplY3QnKSB7IC8vIFNlcXVlbmNlIGNvbnRpbnVlcy5cbiAgICAgICAgICAgICAgICBzZXFPYmogPSByZXNDb2RlO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiByZXNDb2RlID09ICdudW1iZXInKSB7IC8vIFNlcXVlbmNlIGZpbmlzaGVkLiBXcml0ZSBpdC5cbiAgICAgICAgICAgICAgICBkYmNzQ29kZSA9IHJlc0NvZGU7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzQ29kZSA9PSB1bmRlZmluZWQpIHsgLy8gQ3VycmVudCBjaGFyYWN0ZXIgaXMgbm90IHBhcnQgb2YgdGhlIHNlcXVlbmNlLlxuXG4gICAgICAgICAgICAgICAgLy8gVHJ5IGRlZmF1bHQgY2hhcmFjdGVyIGZvciB0aGlzIHNlcXVlbmNlXG4gICAgICAgICAgICAgICAgcmVzQ29kZSA9IHNlcU9ialtERUZfQ0hBUl07XG4gICAgICAgICAgICAgICAgaWYgKHJlc0NvZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBkYmNzQ29kZSA9IHJlc0NvZGU7IC8vIEZvdW5kLiBXcml0ZSBpdC5cbiAgICAgICAgICAgICAgICAgICAgbmV4dENoYXIgPSB1Q29kZTsgLy8gQ3VycmVudCBjaGFyYWN0ZXIgd2lsbCBiZSB3cml0dGVuIHRvbyBpbiB0aGUgbmV4dCBpdGVyYXRpb24uXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBXaGF0IGlmIHdlIGhhdmUgbm8gZGVmYXVsdD8gKHJlc0NvZGUgPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICAvLyBUaGVuLCB3ZSBzaG91bGQgd3JpdGUgZmlyc3QgY2hhciBvZiB0aGUgc2VxdWVuY2UgYXMtaXMgYW5kIHRyeSB0aGUgcmVzdCByZWN1cnNpdmVseS5cbiAgICAgICAgICAgICAgICAgICAgLy8gRGlkbid0IGRvIGl0IGZvciBub3cgYmVjYXVzZSBubyBlbmNvZGluZyBoYXMgdGhpcyBzaXR1YXRpb24geWV0LlxuICAgICAgICAgICAgICAgICAgICAvLyBDdXJyZW50bHksIGp1c3Qgc2tpcCB0aGUgc2VxdWVuY2UgYW5kIHdyaXRlIGN1cnJlbnQgY2hhci5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXFPYmogPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodUNvZGUgPj0gMCkgeyAgLy8gUmVndWxhciBjaGFyYWN0ZXJcbiAgICAgICAgICAgIHZhciBzdWJ0YWJsZSA9IHRoaXMuZW5jb2RlVGFibGVbdUNvZGUgPj4gOF07XG4gICAgICAgICAgICBpZiAoc3VidGFibGUgIT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICBkYmNzQ29kZSA9IHN1YnRhYmxlW3VDb2RlICYgMHhGRl07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChkYmNzQ29kZSA8PSBTRVFfU1RBUlQpIHsgLy8gU2VxdWVuY2Ugc3RhcnRcbiAgICAgICAgICAgICAgICBzZXFPYmogPSB0aGlzLmVuY29kZVRhYmxlU2VxW1NFUV9TVEFSVC1kYmNzQ29kZV07XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkYmNzQ29kZSA9PSBVTkFTU0lHTkVEICYmIHRoaXMuZ2IxODAzMCkge1xuICAgICAgICAgICAgICAgIC8vIFVzZSBHQjE4MDMwIGFsZ29yaXRobSB0byBmaW5kIGNoYXJhY3RlcihzKSB0byB3cml0ZS5cbiAgICAgICAgICAgICAgICB2YXIgaWR4ID0gZmluZElkeCh0aGlzLmdiMTgwMzAudUNoYXJzLCB1Q29kZSk7XG4gICAgICAgICAgICAgICAgaWYgKGlkeCAhPSAtMSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGJjc0NvZGUgPSB0aGlzLmdiMTgwMzAuZ2JDaGFyc1tpZHhdICsgKHVDb2RlIC0gdGhpcy5nYjE4MDMwLnVDaGFyc1tpZHhdKTtcbiAgICAgICAgICAgICAgICAgICAgbmV3QnVmW2orK10gPSAweDgxICsgTWF0aC5mbG9vcihkYmNzQ29kZSAvIDEyNjAwKTsgZGJjc0NvZGUgPSBkYmNzQ29kZSAlIDEyNjAwO1xuICAgICAgICAgICAgICAgICAgICBuZXdCdWZbaisrXSA9IDB4MzAgKyBNYXRoLmZsb29yKGRiY3NDb2RlIC8gMTI2MCk7IGRiY3NDb2RlID0gZGJjc0NvZGUgJSAxMjYwO1xuICAgICAgICAgICAgICAgICAgICBuZXdCdWZbaisrXSA9IDB4ODEgKyBNYXRoLmZsb29yKGRiY3NDb2RlIC8gMTApOyBkYmNzQ29kZSA9IGRiY3NDb2RlICUgMTA7XG4gICAgICAgICAgICAgICAgICAgIG5ld0J1ZltqKytdID0gMHgzMCArIGRiY3NDb2RlO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAzLiBXcml0ZSBkYmNzQ29kZSBjaGFyYWN0ZXIuXG4gICAgICAgIGlmIChkYmNzQ29kZSA9PT0gVU5BU1NJR05FRClcbiAgICAgICAgICAgIGRiY3NDb2RlID0gdGhpcy5kZWZhdWx0Q2hhclNpbmdsZUJ5dGU7XG4gICAgICAgIFxuICAgICAgICBpZiAoZGJjc0NvZGUgPCAweDEwMCkge1xuICAgICAgICAgICAgbmV3QnVmW2orK10gPSBkYmNzQ29kZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChkYmNzQ29kZSA8IDB4MTAwMDApIHtcbiAgICAgICAgICAgIG5ld0J1ZltqKytdID0gZGJjc0NvZGUgPj4gODsgICAvLyBoaWdoIGJ5dGVcbiAgICAgICAgICAgIG5ld0J1ZltqKytdID0gZGJjc0NvZGUgJiAweEZGOyAvLyBsb3cgYnl0ZVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbmV3QnVmW2orK10gPSBkYmNzQ29kZSA+PiAxNjtcbiAgICAgICAgICAgIG5ld0J1ZltqKytdID0gKGRiY3NDb2RlID4+IDgpICYgMHhGRjtcbiAgICAgICAgICAgIG5ld0J1ZltqKytdID0gZGJjc0NvZGUgJiAweEZGO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zZXFPYmogPSBzZXFPYmo7XG4gICAgdGhpcy5sZWFkU3Vycm9nYXRlID0gbGVhZFN1cnJvZ2F0ZTtcbiAgICByZXR1cm4gbmV3QnVmLnNsaWNlKDAsIGopO1xufVxuXG5mdW5jdGlvbiBlbmNvZGVyREJDU0VuZCgpIHtcbiAgICBpZiAodGhpcy5sZWFkU3Vycm9nYXRlID09PSAtMSAmJiB0aGlzLnNlcU9iaiA9PT0gdW5kZWZpbmVkKVxuICAgICAgICByZXR1cm47IC8vIEFsbCBjbGVhbi4gTW9zdCBvZnRlbiBjYXNlLlxuXG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoMTApLCBqID0gMDtcblxuICAgIGlmICh0aGlzLnNlcU9iaikgeyAvLyBXZSdyZSBpbiB0aGUgc2VxdWVuY2UuXG4gICAgICAgIHZhciBkYmNzQ29kZSA9IHRoaXMuc2VxT2JqW0RFRl9DSEFSXTtcbiAgICAgICAgaWYgKGRiY3NDb2RlICE9PSB1bmRlZmluZWQpIHsgLy8gV3JpdGUgYmVnaW5uaW5nIG9mIHRoZSBzZXF1ZW5jZS5cbiAgICAgICAgICAgIGlmIChkYmNzQ29kZSA8IDB4MTAwKSB7XG4gICAgICAgICAgICAgICAgbmV3QnVmW2orK10gPSBkYmNzQ29kZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld0J1ZltqKytdID0gZGJjc0NvZGUgPj4gODsgICAvLyBoaWdoIGJ5dGVcbiAgICAgICAgICAgICAgICBuZXdCdWZbaisrXSA9IGRiY3NDb2RlICYgMHhGRjsgLy8gbG93IGJ5dGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFNlZSB0b2RvIGFib3ZlLlxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VxT2JqID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmxlYWRTdXJyb2dhdGUgIT09IC0xKSB7XG4gICAgICAgIC8vIEluY29tcGxldGUgc3Vycm9nYXRlIHBhaXIgLSBvbmx5IGxlYWQgc3Vycm9nYXRlIGZvdW5kLlxuICAgICAgICBuZXdCdWZbaisrXSA9IHRoaXMuZGVmYXVsdENoYXJTaW5nbGVCeXRlO1xuICAgICAgICB0aGlzLmxlYWRTdXJyb2dhdGUgPSAtMTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIG5ld0J1Zi5zbGljZSgwLCBqKTtcbn1cblxuXG4vLyA9PSBBY3R1YWwgRGVjb2RpbmcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5cbmZ1bmN0aW9uIGRlY29kZXJEQkNTV3JpdGUoYnVmKSB7XG4gICAgdmFyIG5ld0J1ZiA9IG5ldyBCdWZmZXIoYnVmLmxlbmd0aCoyKSxcbiAgICAgICAgbm9kZUlkeCA9IHRoaXMubm9kZUlkeCwgXG4gICAgICAgIHByZXZCdWYgPSB0aGlzLnByZXZCdWYsIHByZXZCdWZPZmZzZXQgPSB0aGlzLnByZXZCdWYubGVuZ3RoLFxuICAgICAgICBzZXFTdGFydCA9IC10aGlzLnByZXZCdWYubGVuZ3RoLCAvLyBpZHggb2YgdGhlIHN0YXJ0IG9mIGN1cnJlbnQgcGFyc2VkIHNlcXVlbmNlLlxuICAgICAgICB1Q29kZTtcblxuICAgIGlmIChwcmV2QnVmT2Zmc2V0ID4gMCkgLy8gTWFrZSBwcmV2IGJ1ZiBvdmVybGFwIGEgbGl0dGxlIHRvIG1ha2UgaXQgZWFzaWVyIHRvIHNsaWNlIGxhdGVyLlxuICAgICAgICBwcmV2QnVmID0gQnVmZmVyLmNvbmNhdChbcHJldkJ1ZiwgYnVmLnNsaWNlKDAsIDEwKV0pO1xuICAgIFxuICAgIGZvciAodmFyIGkgPSAwLCBqID0gMDsgaSA8IGJ1Zi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY3VyQnl0ZSA9IChpID49IDApID8gYnVmW2ldIDogcHJldkJ1ZltpICsgcHJldkJ1Zk9mZnNldF07XG5cbiAgICAgICAgLy8gTG9va3VwIGluIGN1cnJlbnQgdHJpZSBub2RlLlxuICAgICAgICB2YXIgdUNvZGUgPSB0aGlzLmRlY29kZVRhYmxlc1tub2RlSWR4XVtjdXJCeXRlXTtcblxuICAgICAgICBpZiAodUNvZGUgPj0gMCkgeyBcbiAgICAgICAgICAgIC8vIE5vcm1hbCBjaGFyYWN0ZXIsIGp1c3QgdXNlIGl0LlxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVDb2RlID09PSBVTkFTU0lHTkVEKSB7IC8vIFVua25vd24gY2hhci5cbiAgICAgICAgICAgIC8vIFRPRE86IENhbGxiYWNrIHdpdGggc2VxLlxuICAgICAgICAgICAgLy92YXIgY3VyU2VxID0gKHNlcVN0YXJ0ID49IDApID8gYnVmLnNsaWNlKHNlcVN0YXJ0LCBpKzEpIDogcHJldkJ1Zi5zbGljZShzZXFTdGFydCArIHByZXZCdWZPZmZzZXQsIGkrMSArIHByZXZCdWZPZmZzZXQpO1xuICAgICAgICAgICAgaSA9IHNlcVN0YXJ0OyAvLyBUcnkgdG8gcGFyc2UgYWdhaW4sIGFmdGVyIHNraXBwaW5nIGZpcnN0IGJ5dGUgb2YgdGhlIHNlcXVlbmNlICgnaScgd2lsbCBiZSBpbmNyZW1lbnRlZCBieSAnZm9yJyBjeWNsZSkuXG4gICAgICAgICAgICB1Q29kZSA9IHRoaXMuZGVmYXVsdENoYXJVbmljb2RlLmNoYXJDb2RlQXQoMCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodUNvZGUgPT09IEdCMTgwMzBfQ09ERSkge1xuICAgICAgICAgICAgdmFyIGN1clNlcSA9IChzZXFTdGFydCA+PSAwKSA/IGJ1Zi5zbGljZShzZXFTdGFydCwgaSsxKSA6IHByZXZCdWYuc2xpY2Uoc2VxU3RhcnQgKyBwcmV2QnVmT2Zmc2V0LCBpKzEgKyBwcmV2QnVmT2Zmc2V0KTtcbiAgICAgICAgICAgIHZhciBwdHIgPSAoY3VyU2VxWzBdLTB4ODEpKjEyNjAwICsgKGN1clNlcVsxXS0weDMwKSoxMjYwICsgKGN1clNlcVsyXS0weDgxKSoxMCArIChjdXJTZXFbM10tMHgzMCk7XG4gICAgICAgICAgICB2YXIgaWR4ID0gZmluZElkeCh0aGlzLmdiMTgwMzAuZ2JDaGFycywgcHRyKTtcbiAgICAgICAgICAgIHVDb2RlID0gdGhpcy5nYjE4MDMwLnVDaGFyc1tpZHhdICsgcHRyIC0gdGhpcy5nYjE4MDMwLmdiQ2hhcnNbaWR4XTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1Q29kZSA8PSBOT0RFX1NUQVJUKSB7IC8vIEdvIHRvIG5leHQgdHJpZSBub2RlLlxuICAgICAgICAgICAgbm9kZUlkeCA9IE5PREVfU1RBUlQgLSB1Q29kZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVDb2RlIDw9IFNFUV9TVEFSVCkgeyAvLyBPdXRwdXQgYSBzZXF1ZW5jZSBvZiBjaGFycy5cbiAgICAgICAgICAgIHZhciBzZXEgPSB0aGlzLmRlY29kZVRhYmxlU2VxW1NFUV9TVEFSVCAtIHVDb2RlXTtcbiAgICAgICAgICAgIGZvciAodmFyIGsgPSAwOyBrIDwgc2VxLmxlbmd0aCAtIDE7IGsrKykge1xuICAgICAgICAgICAgICAgIHVDb2RlID0gc2VxW2tdO1xuICAgICAgICAgICAgICAgIG5ld0J1ZltqKytdID0gdUNvZGUgJiAweEZGO1xuICAgICAgICAgICAgICAgIG5ld0J1ZltqKytdID0gdUNvZGUgPj4gODtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVDb2RlID0gc2VxW3NlcS5sZW5ndGgtMV07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWNvbnYtbGl0ZSBpbnRlcm5hbCBlcnJvcjogaW52YWxpZCBkZWNvZGluZyB0YWJsZSB2YWx1ZSBcIiArIHVDb2RlICsgXCIgYXQgXCIgKyBub2RlSWR4ICsgXCIvXCIgKyBjdXJCeXRlKTtcblxuICAgICAgICAvLyBXcml0ZSB0aGUgY2hhcmFjdGVyIHRvIGJ1ZmZlciwgaGFuZGxpbmcgaGlnaGVyIHBsYW5lcyB1c2luZyBzdXJyb2dhdGUgcGFpci5cbiAgICAgICAgaWYgKHVDb2RlID4gMHhGRkZGKSB7IFxuICAgICAgICAgICAgdUNvZGUgLT0gMHgxMDAwMDtcbiAgICAgICAgICAgIHZhciB1Q29kZUxlYWQgPSAweEQ4MDAgKyBNYXRoLmZsb29yKHVDb2RlIC8gMHg0MDApO1xuICAgICAgICAgICAgbmV3QnVmW2orK10gPSB1Q29kZUxlYWQgJiAweEZGO1xuICAgICAgICAgICAgbmV3QnVmW2orK10gPSB1Q29kZUxlYWQgPj4gODtcblxuICAgICAgICAgICAgdUNvZGUgPSAweERDMDAgKyB1Q29kZSAlIDB4NDAwO1xuICAgICAgICB9XG4gICAgICAgIG5ld0J1ZltqKytdID0gdUNvZGUgJiAweEZGO1xuICAgICAgICBuZXdCdWZbaisrXSA9IHVDb2RlID4+IDg7XG5cbiAgICAgICAgLy8gUmVzZXQgdHJpZSBub2RlLlxuICAgICAgICBub2RlSWR4ID0gMDsgc2VxU3RhcnQgPSBpKzE7XG4gICAgfVxuXG4gICAgdGhpcy5ub2RlSWR4ID0gbm9kZUlkeDtcbiAgICB0aGlzLnByZXZCdWYgPSAoc2VxU3RhcnQgPj0gMCkgPyBidWYuc2xpY2Uoc2VxU3RhcnQpIDogcHJldkJ1Zi5zbGljZShzZXFTdGFydCArIHByZXZCdWZPZmZzZXQpO1xuICAgIHJldHVybiBuZXdCdWYuc2xpY2UoMCwgaikudG9TdHJpbmcoJ3VjczInKTtcbn1cblxuZnVuY3Rpb24gZGVjb2RlckRCQ1NFbmQoKSB7XG4gICAgdmFyIHJldCA9ICcnO1xuXG4gICAgLy8gVHJ5IHRvIHBhcnNlIGFsbCByZW1haW5pbmcgY2hhcnMuXG4gICAgd2hpbGUgKHRoaXMucHJldkJ1Zi5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFNraXAgMSBjaGFyYWN0ZXIgaW4gdGhlIGJ1ZmZlci5cbiAgICAgICAgcmV0ICs9IHRoaXMuZGVmYXVsdENoYXJVbmljb2RlO1xuICAgICAgICB2YXIgYnVmID0gdGhpcy5wcmV2QnVmLnNsaWNlKDEpO1xuXG4gICAgICAgIC8vIFBhcnNlIHJlbWFpbmluZyBhcyB1c3VhbC5cbiAgICAgICAgdGhpcy5wcmV2QnVmID0gbmV3IEJ1ZmZlcigwKTtcbiAgICAgICAgdGhpcy5ub2RlSWR4ID0gMDtcbiAgICAgICAgaWYgKGJ1Zi5sZW5ndGggPiAwKVxuICAgICAgICAgICAgcmV0ICs9IGRlY29kZXJEQkNTV3JpdGUuY2FsbCh0aGlzLCBidWYpO1xuICAgIH1cblxuICAgIHRoaXMubm9kZUlkeCA9IDA7XG4gICAgcmV0dXJuIHJldDtcbn1cblxuLy8gQmluYXJ5IHNlYXJjaCBmb3IgR0IxODAzMC4gUmV0dXJucyBsYXJnZXN0IGkgc3VjaCB0aGF0IHRhYmxlW2ldIDw9IHZhbC5cbmZ1bmN0aW9uIGZpbmRJZHgodGFibGUsIHZhbCkge1xuICAgIGlmICh0YWJsZVswXSA+IHZhbClcbiAgICAgICAgcmV0dXJuIC0xO1xuXG4gICAgdmFyIGwgPSAwLCByID0gdGFibGUubGVuZ3RoO1xuICAgIHdoaWxlIChsIDwgci0xKSB7IC8vIGFsd2F5cyB0YWJsZVtsXSA8PSB2YWwgPCB0YWJsZVtyXVxuICAgICAgICB2YXIgbWlkID0gbCArIE1hdGguZmxvb3IoKHItbCsxKS8yKTtcbiAgICAgICAgaWYgKHRhYmxlW21pZF0gPD0gdmFsKVxuICAgICAgICAgICAgbCA9IG1pZDtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgciA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGw7XG59XG5cbiIsIlxuLy8gRGVzY3JpcHRpb24gb2Ygc3VwcG9ydGVkIGRvdWJsZSBieXRlIGVuY29kaW5ncyBhbmQgYWxpYXNlcy5cbi8vIFRhYmxlcyBhcmUgbm90IHJlcXVpcmUoKS1kIHVudGlsIHRoZXkgYXJlIG5lZWRlZCB0byBzcGVlZCB1cCBsaWJyYXJ5IGxvYWQuXG4vLyByZXF1aXJlKCktcyBhcmUgZGlyZWN0IHRvIHN1cHBvcnQgQnJvd3NlcmlmeS5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgXG4gICAgLy8gPT0gSmFwYW5lc2UvU2hpZnRKSVMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFsbCBqYXBhbmVzZSBlbmNvZGluZ3MgYXJlIGJhc2VkIG9uIEpJUyBYIHNldCBvZiBzdGFuZGFyZHM6XG4gICAgLy8gSklTIFggMDIwMSAtIFNpbmdsZS1ieXRlIGVuY29kaW5nIG9mIEFTQ0lJICsgwqUgKyBLYW5hIGNoYXJzIGF0IDB4QTEtMHhERi5cbiAgICAvLyBKSVMgWCAwMjA4IC0gTWFpbiBzZXQgb2YgNjg3OSBjaGFyYWN0ZXJzLCBwbGFjZWQgaW4gOTR4OTQgcGxhbmUsIHRvIGJlIGVuY29kZWQgYnkgMiBieXRlcy4gXG4gICAgLy8gICAgICAgICAgICAgIEhhcyBzZXZlcmFsIHZhcmlhdGlvbnMgaW4gMTk3OCwgMTk4MywgMTk5MCBhbmQgMTk5Ny5cbiAgICAvLyBKSVMgWCAwMjEyIC0gU3VwcGxlbWVudGFyeSBwbGFuZSBvZiA2MDY3IGNoYXJzIGluIDk0eDk0IHBsYW5lLiAxOTkwLiBFZmZlY3RpdmVseSBkZWFkLlxuICAgIC8vIEpJUyBYIDAyMTMgLSBFeHRlbnNpb24gYW5kIG1vZGVybiByZXBsYWNlbWVudCBvZiAwMjA4IGFuZCAwMjEyLiBUb3RhbCBjaGFyczogMTEyMzMuXG4gICAgLy8gICAgICAgICAgICAgIDIgcGxhbmVzLCBmaXJzdCBpcyBzdXBlcnNldCBvZiAwMjA4LCBzZWNvbmQgLSByZXZpc2VkIDAyMTIuXG4gICAgLy8gICAgICAgICAgICAgIEludHJvZHVjZWQgaW4gMjAwMCwgcmV2aXNlZCAyMDA0LiBTb21lIGNoYXJhY3RlcnMgYXJlIGluIFVuaWNvZGUgUGxhbmUgMiAoMHgyeHh4eClcblxuICAgIC8vIEJ5dGUgZW5jb2RpbmdzIGFyZTpcbiAgICAvLyAgKiBTaGlmdF9KSVM6IENvbXBhdGlibGUgd2l0aCAwMjAxLCB1c2VzIG5vdCBkZWZpbmVkIGNoYXJzIGluIHRvcCBoYWxmIGFzIGxlYWQgYnl0ZXMgZm9yIGRvdWJsZS1ieXRlXG4gICAgLy8gICAgICAgICAgICAgICBlbmNvZGluZyBvZiAwMjA4LiBMZWFkIGJ5dGUgcmFuZ2VzOiAweDgxLTB4OUYsIDB4RTAtMHhFRjsgVHJhaWwgYnl0ZSByYW5nZXM6IDB4NDAtMHg3RSwgMHg4MC0weDlFLCAweDlGLTB4RkMuXG4gICAgLy8gICAgICAgICAgICAgICBXaW5kb3dzIENQOTMyIGlzIGEgc3VwZXJzZXQgb2YgU2hpZnRfSklTLiBTb21lIGNvbXBhbmllcyBhZGRlZCBtb3JlIGNoYXJzLCBub3RhYmx5IEtEREkuXG4gICAgLy8gICogRVVDLUpQOiAgICBVcCB0byAzIGJ5dGVzIHBlciBjaGFyYWN0ZXIuIFVzZWQgbW9zdGx5IG9uICpuaXhlcy5cbiAgICAvLyAgICAgICAgICAgICAgIDB4MDAtMHg3RiAgICAgICAtIGxvd2VyIHBhcnQgb2YgMDIwMVxuICAgIC8vICAgICAgICAgICAgICAgMHg4RSwgMHhBMS0weERGIC0gdXBwZXIgcGFydCBvZiAwMjAxXG4gICAgLy8gICAgICAgICAgICAgICAoMHhBMS0weEZFKXgyICAgLSAwMjA4IHBsYW5lICg5NHg5NCkuXG4gICAgLy8gICAgICAgICAgICAgICAweDhGLCAoMHhBMS0weEZFKXgyIC0gMDIxMiBwbGFuZSAoOTR4OTQpLlxuICAgIC8vICAqIEpJUyBYIDIwODogNy1iaXQsIGRpcmVjdCBlbmNvZGluZyBvZiAwMjA4LiBCeXRlIHJhbmdlczogMHgyMS0weDdFICg5NCB2YWx1ZXMpLiBVbmNvbW1vbi5cbiAgICAvLyAgICAgICAgICAgICAgIFVzZWQgYXMtaXMgaW4gSVNPMjAyMiBmYW1pbHkuXG4gICAgLy8gICogSVNPMjAyMi1KUDogU3RhdGVmdWwgZW5jb2RpbmcsIHdpdGggZXNjYXBlIHNlcXVlbmNlcyB0byBzd2l0Y2ggYmV0d2VlbiBBU0NJSSwgXG4gICAgLy8gICAgICAgICAgICAgICAgMDIwMS0xOTc2IFJvbWFuLCAwMjA4LTE5NzgsIDAyMDgtMTk4My5cbiAgICAvLyAgKiBJU08yMDIyLUpQLTE6IEFkZHMgZXNjIHNlcSBmb3IgMDIxMi0xOTkwLlxuICAgIC8vICAqIElTTzIwMjItSlAtMjogQWRkcyBlc2Mgc2VxIGZvciBHQjIzMTMtMTk4MCwgS1NYMTAwMS0xOTkyLCBJU084ODU5LTEsIElTTzg4NTktNy5cbiAgICAvLyAgKiBJU08yMDIyLUpQLTM6IEFkZHMgZXNjIHNlcSBmb3IgMDIwMS0xOTc2IEthbmEgc2V0LCAwMjEzLTIwMDAgUGxhbmVzIDEsIDIuXG4gICAgLy8gICogSVNPMjAyMi1KUC0yMDA0OiBBZGRzIDAyMTMtMjAwNCBQbGFuZSAxLlxuICAgIC8vXG4gICAgLy8gQWZ0ZXIgSklTIFggMDIxMyBhcHBlYXJlZCwgU2hpZnRfSklTLTIwMDQsIEVVQy1KSVNYMDIxMyBhbmQgSVNPMjAyMi1KUC0yMDA0IGZvbGxvd2VkLCB3aXRoIGp1c3QgY2hhbmdpbmcgdGhlIHBsYW5lcy5cbiAgICAvL1xuICAgIC8vIE92ZXJhbGwsIGl0IHNlZW1zIHRoYXQgaXQncyBhIG1lc3MgOiggaHR0cDovL3d3dzgucGxhbGEub3IuanAvdGt1Ym90YTEvdW5pY29kZS1zeW1ib2xzLW1hcDIuaHRtbFxuXG5cbiAgICAnc2hpZnRqaXMnOiB7XG4gICAgICAgIHR5cGU6ICdfZGJjcycsXG4gICAgICAgIHRhYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHJlcXVpcmUoJy4vdGFibGVzL3NoaWZ0amlzLmpzb24nKSB9LFxuICAgICAgICBlbmNvZGVBZGQ6IHsnXFx1MDBhNSc6IDB4NUMsICdcXHUyMDNFJzogMHg3RX0sXG4gICAgICAgIGVuY29kZVNraXBWYWxzOiBbe2Zyb206IDB4RUQ0MCwgdG86IDB4Rjk0MH1dLFxuICAgIH0sXG4gICAgJ2Nzc2hpZnRqaXMnOiAnc2hpZnRqaXMnLFxuICAgICdtc2thbmppJzogJ3NoaWZ0amlzJyxcbiAgICAnc2ppcyc6ICdzaGlmdGppcycsXG4gICAgJ3dpbmRvd3MzMWonOiAnc2hpZnRqaXMnLFxuICAgICd4c2ppcyc6ICdzaGlmdGppcycsXG4gICAgJ3dpbmRvd3M5MzInOiAnc2hpZnRqaXMnLFxuICAgICc5MzInOiAnc2hpZnRqaXMnLFxuICAgICdjcDkzMic6ICdzaGlmdGppcycsXG5cbiAgICAnZXVjanAnOiB7XG4gICAgICAgIHR5cGU6ICdfZGJjcycsXG4gICAgICAgIHRhYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHJlcXVpcmUoJy4vdGFibGVzL2V1Y2pwLmpzb24nKSB9LFxuICAgICAgICBlbmNvZGVBZGQ6IHsnXFx1MDBhNSc6IDB4NUMsICdcXHUyMDNFJzogMHg3RX0sXG4gICAgfSxcblxuICAgIC8vIFRPRE86IEtEREkgZXh0ZW5zaW9uIHRvIFNoaWZ0X0pJU1xuICAgIC8vIFRPRE86IElCTSBDQ1NJRCA5NDIgPSBDUDkzMiwgYnV0IEYwLUY5IGN1c3RvbSBjaGFycyBhbmQgb3RoZXIgY2hhciBjaGFuZ2VzLlxuICAgIC8vIFRPRE86IElCTSBDQ1NJRCA5NDMgPSBTaGlmdF9KSVMgPSBDUDkzMiB3aXRoIG9yaWdpbmFsIFNoaWZ0X0pJUyBsb3dlciAxMjggY2hhcnMuXG5cbiAgICAvLyA9PSBDaGluZXNlL0dCSyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9HQktcblxuICAgIC8vIE9sZGVzdCBHQjIzMTIgKDE5ODEsIH43NjAwIGNoYXJzKSBpcyBhIHN1YnNldCBvZiBDUDkzNlxuICAgICdnYjIzMTInOiAnY3A5MzYnLFxuICAgICdnYjIzMTI4MCc6ICdjcDkzNicsXG4gICAgJ2diMjMxMjE5ODAnOiAnY3A5MzYnLFxuICAgICdjc2diMjMxMic6ICdjcDkzNicsXG4gICAgJ2NzaXNvNThnYjIzMTI4MCc6ICdjcDkzNicsXG4gICAgJ2V1Y2NuJzogJ2NwOTM2JyxcbiAgICAnaXNvaXI1OCc6ICdnYmsnLFxuXG4gICAgLy8gTWljcm9zb2Z0J3MgQ1A5MzYgaXMgYSBzdWJzZXQgYW5kIGFwcHJveGltYXRpb24gb2YgR0JLLlxuICAgIC8vIFRPRE86IEV1cm8gPSAweDgwIGluIGNwOTM2LCBidXQgbm90IGluIEdCSyAod2hlcmUgaXQncyB2YWxpZCBidXQgdW5kZWZpbmVkKVxuICAgICd3aW5kb3dzOTM2JzogJ2NwOTM2JyxcbiAgICAnOTM2JzogJ2NwOTM2JyxcbiAgICAnY3A5MzYnOiB7XG4gICAgICAgIHR5cGU6ICdfZGJjcycsXG4gICAgICAgIHRhYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHJlcXVpcmUoJy4vdGFibGVzL2NwOTM2Lmpzb24nKSB9LFxuICAgIH0sXG5cbiAgICAvLyBHQksgKH4yMjAwMCBjaGFycykgaXMgYW4gZXh0ZW5zaW9uIG9mIENQOTM2IHRoYXQgYWRkZWQgdXNlci1tYXBwZWQgY2hhcnMgYW5kIHNvbWUgb3RoZXIuXG4gICAgJ2diayc6IHtcbiAgICAgICAgdHlwZTogJ19kYmNzJyxcbiAgICAgICAgdGFibGU6IGZ1bmN0aW9uKCkgeyByZXR1cm4gcmVxdWlyZSgnLi90YWJsZXMvY3A5MzYuanNvbicpLmNvbmNhdChyZXF1aXJlKCcuL3RhYmxlcy9nYmstYWRkZWQuanNvbicpKSB9LFxuICAgIH0sXG4gICAgJ3hnYmsnOiAnZ2JrJyxcblxuICAgIC8vIEdCMTgwMzAgaXMgYW4gYWxnb3JpdGhtaWMgZXh0ZW5zaW9uIG9mIEdCSy5cbiAgICAnZ2IxODAzMCc6IHtcbiAgICAgICAgdHlwZTogJ19kYmNzJyxcbiAgICAgICAgdGFibGU6IGZ1bmN0aW9uKCkgeyByZXR1cm4gcmVxdWlyZSgnLi90YWJsZXMvY3A5MzYuanNvbicpLmNvbmNhdChyZXF1aXJlKCcuL3RhYmxlcy9nYmstYWRkZWQuanNvbicpKSB9LFxuICAgICAgICBnYjE4MDMwOiBmdW5jdGlvbigpIHsgcmV0dXJuIHJlcXVpcmUoJy4vdGFibGVzL2diMTgwMzAtcmFuZ2VzLmpzb24nKSB9LFxuICAgIH0sXG5cbiAgICAnY2hpbmVzZSc6ICdnYjE4MDMwJyxcblxuICAgIC8vIFRPRE86IFN1cHBvcnQgR0IxODAzMCAofjI3MDAwIGNoYXJzICsgd2hvbGUgdW5pY29kZSBtYXBwaW5nLCBjcDU0OTM2KVxuICAgIC8vIGh0dHA6Ly9pY3UtcHJvamVjdC5vcmcvZG9jcy9wYXBlcnMvZ2IxODAzMC5odG1sXG4gICAgLy8gaHR0cDovL3NvdXJjZS5pY3UtcHJvamVjdC5vcmcvcmVwb3MvaWN1L2RhdGEvdHJ1bmsvY2hhcnNldC9kYXRhL3htbC9nYi0xODAzMC0yMDAwLnhtbFxuICAgIC8vIGh0dHA6Ly93d3cua2huZ2FpLmNvbS9jaGluZXNlL2NoYXJtYXAvdGJsZ2JrLnBocD9wYWdlPTBcblxuICAgIC8vID09IEtvcmVhbiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBFVUMtS1IsIEtTX0NfNTYwMSBhbmQgS1MgWCAxMDAxIGFyZSBleGFjdGx5IHRoZSBzYW1lLlxuICAgICd3aW5kb3dzOTQ5JzogJ2NwOTQ5JyxcbiAgICAnOTQ5JzogJ2NwOTQ5JyxcbiAgICAnY3A5NDknOiB7XG4gICAgICAgIHR5cGU6ICdfZGJjcycsXG4gICAgICAgIHRhYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHJlcXVpcmUoJy4vdGFibGVzL2NwOTQ5Lmpzb24nKSB9LFxuICAgIH0sXG5cbiAgICAnY3NldWNrcic6ICdjcDk0OScsXG4gICAgJ2Nza3NjNTYwMTE5ODcnOiAnY3A5NDknLFxuICAgICdldWNrcic6ICdjcDk0OScsXG4gICAgJ2lzb2lyMTQ5JzogJ2NwOTQ5JyxcbiAgICAna29yZWFuJzogJ2NwOTQ5JyxcbiAgICAna3NjNTYwMTE5ODcnOiAnY3A5NDknLFxuICAgICdrc2M1NjAxMTk4OSc6ICdjcDk0OScsXG4gICAgJ2tzYzU2MDEnOiAnY3A5NDknLFxuXG5cbiAgICAvLyA9PSBCaWc1L1RhaXdhbi9Ib25nIEtvbmcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gVGhlcmUgYXJlIGxvdHMgb2YgdGFibGVzIGZvciBCaWc1IGFuZCBjcDk1MC4gUGxlYXNlIHNlZSB0aGUgZm9sbG93aW5nIGxpbmtzIGZvciBoaXN0b3J5OlxuICAgIC8vIGh0dHA6Ly9tb3p0dy5vcmcvZG9jcy9iaWc1LyAgaHR0cDovL3d3dy5oYWlibGUuZGUvYnJ1bm8vY2hhcnNldHMvY29udmVyc2lvbi10YWJsZXMvQmlnNS5odG1sXG4gICAgLy8gVmFyaWF0aW9ucywgaW4gcm91Z2hseSBudW1iZXIgb2YgZGVmaW5lZCBjaGFyczpcbiAgICAvLyAgKiBXaW5kb3dzIENQIDk1MDogTWljcm9zb2Z0IHZhcmlhbnQgb2YgQmlnNS4gQ2Fub25pY2FsOiBodHRwOi8vd3d3LnVuaWNvZGUub3JnL1B1YmxpYy9NQVBQSU5HUy9WRU5ET1JTL01JQ1NGVC9XSU5ET1dTL0NQOTUwLlRYVFxuICAgIC8vICAqIFdpbmRvd3MgQ1AgOTUxOiBNaWNyb3NvZnQgdmFyaWFudCBvZiBCaWc1LUhLU0NTLTIwMDEuIFNlZW1zIHRvIGJlIG5ldmVyIHB1YmxpYy4gaHR0cDovL21lLmFiZWxjaGV1bmcub3JnL2FydGljbGVzL3Jlc2VhcmNoL3doYXQtaXMtY3A5NTEvXG4gICAgLy8gICogQmlnNS0yMDAzIChUYWl3YW4gc3RhbmRhcmQpIGFsbW9zdCBzdXBlcnNldCBvZiBjcDk1MC5cbiAgICAvLyAgKiBVbmljb2RlLWF0LW9uIChVQU8pIC8gTW96aWxsYSAxLjguIEZhbGxpbmcgb3V0IG9mIHVzZSBvbiB0aGUgV2ViLiBOb3Qgc3VwcG9ydGVkIGJ5IG90aGVyIGJyb3dzZXJzLlxuICAgIC8vICAqIEJpZzUtSEtTQ1MgKC0yMDAxLCAtMjAwNCwgLTIwMDgpLiBIb25nIEtvbmcgc3RhbmRhcmQuIFxuICAgIC8vICAgIG1hbnkgdW5pY29kZSBjb2RlIHBvaW50cyBtb3ZlZCBmcm9tIFBVQSB0byBTdXBwbGVtZW50YXJ5IHBsYW5lIChVKzJYWFhYKSBvdmVyIHRoZSB5ZWFycy5cbiAgICAvLyAgICBQbHVzLCBpdCBoYXMgNCBjb21iaW5pbmcgc2VxdWVuY2VzLlxuICAgIC8vICAgIFNlZW1zIHRoYXQgTW96aWxsYSByZWZ1c2VkIHRvIHN1cHBvcnQgaXQgZm9yIDEwIHlycy4gaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTYyNDMxIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTMxMDI5OVxuICAgIC8vICAgIGJlY2F1c2UgYmlnNS1oa3NjcyBpcyB0aGUgb25seSBlbmNvZGluZyB0byBpbmNsdWRlIGFzdHJhbCBjaGFyYWN0ZXJzIGluIG5vbi1hbGdvcml0aG1pYyB3YXkuXG4gICAgLy8gICAgSW1wbGVtZW50YXRpb25zIGFyZSBub3QgY29uc2lzdGVudCB3aXRoaW4gYnJvd3NlcnM7IHNvbWV0aW1lcyBsYWJlbGVkIGFzIGp1c3QgYmlnNS5cbiAgICAvLyAgICBNUyBJbnRlcm5ldCBFeHBsb3JlciBzd2l0Y2hlcyBmcm9tIGJpZzUgdG8gYmlnNS1oa3NjcyB3aGVuIGEgcGF0Y2ggYXBwbGllZC5cbiAgICAvLyAgICBHcmVhdCBkaXNjdXNzaW9uICYgcmVjYXAgb2Ygd2hhdCdzIGdvaW5nIG9uIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTkxMjQ3MCNjMzFcbiAgICAvLyAgICBJbiB0aGUgZW5jb2RlciwgaXQgbWlnaHQgbWFrZSBzZW5zZSB0byBzdXBwb3J0IGVuY29kaW5nIG9sZCBQVUEgbWFwcGluZ3MgdG8gQmlnNSBieXRlcyBzZXEtcy5cbiAgICAvLyAgICBPZmZpY2lhbCBzcGVjOiBodHRwOi8vd3d3Lm9nY2lvLmdvdi5oay9lbi9idXNpbmVzcy90ZWNoX3Byb21vdGlvbi9jY2xpL3Rlcm1zL2RvYy8yMDAzY21wXzIwMDgudHh0XG4gICAgLy8gICAgICAgICAgICAgICAgICAgaHR0cDovL3d3dy5vZ2Npby5nb3YuaGsvdGMvYnVzaW5lc3MvdGVjaF9wcm9tb3Rpb24vY2NsaS90ZXJtcy9kb2MvaGtzY3MtMjAwOC1iaWc1LWlzby50eHRcbiAgICAvLyBcbiAgICAvLyBDdXJyZW50IHVuZGVyc3RhbmRpbmcgb2YgaG93IHRvIGRlYWwgd2l0aCBCaWc1KC1IS1NDUykgaXMgaW4gdGhlIEVuY29kaW5nIFN0YW5kYXJkLCBodHRwOi8vZW5jb2Rpbmcuc3BlYy53aGF0d2cub3JnLyNiaWc1LWVuY29kZXJcbiAgICAvLyBVbmljb2RlIG1hcHBpbmcgKGh0dHA6Ly93d3cudW5pY29kZS5vcmcvUHVibGljL01BUFBJTkdTL09CU09MRVRFL0VBU1RBU0lBL09USEVSL0JJRzUuVFhUKSBpcyBzYWlkIHRvIGJlIHdyb25nLlxuXG4gICAgJ3dpbmRvd3M5NTAnOiAnY3A5NTAnLFxuICAgICc5NTAnOiAnY3A5NTAnLFxuICAgICdjcDk1MCc6IHtcbiAgICAgICAgdHlwZTogJ19kYmNzJyxcbiAgICAgICAgdGFibGU6IGZ1bmN0aW9uKCkgeyByZXR1cm4gcmVxdWlyZSgnLi90YWJsZXMvY3A5NTAuanNvbicpIH0sXG4gICAgfSxcblxuICAgIC8vIEJpZzUgaGFzIG1hbnkgdmFyaWF0aW9ucyBhbmQgaXMgYW4gZXh0ZW5zaW9uIG9mIGNwOTUwLiBXZSB1c2UgRW5jb2RpbmcgU3RhbmRhcmQncyBhcyBhIGNvbnNlbnN1cy5cbiAgICAnYmlnNSc6ICdiaWc1aGtzY3MnLFxuICAgICdiaWc1aGtzY3MnOiB7XG4gICAgICAgIHR5cGU6ICdfZGJjcycsXG4gICAgICAgIHRhYmxlOiBmdW5jdGlvbigpIHsgcmV0dXJuIHJlcXVpcmUoJy4vdGFibGVzL2NwOTUwLmpzb24nKS5jb25jYXQocmVxdWlyZSgnLi90YWJsZXMvYmlnNS1hZGRlZC5qc29uJykpIH0sXG4gICAgfSxcblxuICAgICdjbmJpZzUnOiAnYmlnNWhrc2NzJyxcbiAgICAnY3NiaWc1JzogJ2JpZzVoa3NjcycsXG4gICAgJ3h4YmlnNSc6ICdiaWc1aGtzY3MnLFxuXG59O1xuIiwiXG4vLyBVcGRhdGUgdGhpcyBhcnJheSBpZiB5b3UgYWRkL3JlbmFtZS9yZW1vdmUgZmlsZXMgaW4gdGhpcyBkaXJlY3RvcnkuXG4vLyBXZSBzdXBwb3J0IEJyb3dzZXJpZnkgYnkgc2tpcHBpbmcgYXV0b21hdGljIG1vZHVsZSBkaXNjb3ZlcnkgYW5kIHJlcXVpcmluZyBtb2R1bGVzIGRpcmVjdGx5LlxudmFyIG1vZHVsZXMgPSBbXG4gICAgcmVxdWlyZShcIi4vaW50ZXJuYWxcIiksXG4gICAgcmVxdWlyZShcIi4vdXRmMTZcIiksXG4gICAgcmVxdWlyZShcIi4vdXRmN1wiKSxcbiAgICByZXF1aXJlKFwiLi9zYmNzLWNvZGVjXCIpLFxuICAgIHJlcXVpcmUoXCIuL3NiY3MtZGF0YVwiKSxcbiAgICByZXF1aXJlKFwiLi9zYmNzLWRhdGEtZ2VuZXJhdGVkXCIpLFxuICAgIHJlcXVpcmUoXCIuL2RiY3MtY29kZWNcIiksXG4gICAgcmVxdWlyZShcIi4vZGJjcy1kYXRhXCIpLFxuXTtcblxuLy8gUHV0IGFsbCBlbmNvZGluZy9hbGlhcy9jb2RlYyBkZWZpbml0aW9ucyB0byBzaW5nbGUgb2JqZWN0IGFuZCBleHBvcnQgaXQuIFxuZm9yICh2YXIgaSA9IDA7IGkgPCBtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG1vZHVsZSA9IG1vZHVsZXNbaV07XG4gICAgZm9yICh2YXIgZW5jIGluIG1vZHVsZSlcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2R1bGUsIGVuYykpXG4gICAgICAgICAgICBleHBvcnRzW2VuY10gPSBtb2R1bGVbZW5jXTtcbn1cbiIsIlxuLy8gRXhwb3J0IE5vZGUuanMgaW50ZXJuYWwgZW5jb2RpbmdzLlxuXG52YXIgdXRmMTZsZWJvbSA9IG5ldyBCdWZmZXIoWzB4RkYsIDB4RkVdKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgLy8gRW5jb2RpbmdzXG4gICAgdXRmODogICB7IHR5cGU6IFwiX2ludGVybmFsXCIsIGVuYzogXCJ1dGY4XCIgfSxcbiAgICBjZXN1ODogIHsgdHlwZTogXCJfaW50ZXJuYWxcIiwgZW5jOiBcInV0ZjhcIiB9LFxuICAgIHVuaWNvZGUxMXV0Zjg6IHsgdHlwZTogXCJfaW50ZXJuYWxcIiwgZW5jOiBcInV0ZjhcIiB9LFxuICAgIHVjczI6ICAgeyB0eXBlOiBcIl9pbnRlcm5hbFwiLCBlbmM6IFwidWNzMlwiLCBib206IHV0ZjE2bGVib20gfSxcbiAgICB1dGYxNmxlOnsgdHlwZTogXCJfaW50ZXJuYWxcIiwgZW5jOiBcInVjczJcIiwgYm9tOiB1dGYxNmxlYm9tIH0sXG4gICAgYmluYXJ5OiB7IHR5cGU6IFwiX2ludGVybmFsXCIsIGVuYzogXCJiaW5hcnlcIiB9LFxuICAgIGJhc2U2NDogeyB0eXBlOiBcIl9pbnRlcm5hbFwiLCBlbmM6IFwiYmFzZTY0XCIgfSxcbiAgICBoZXg6ICAgIHsgdHlwZTogXCJfaW50ZXJuYWxcIiwgZW5jOiBcImhleFwiIH0sXG5cbiAgICAvLyBDb2RlYy5cbiAgICBfaW50ZXJuYWw6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zIHx8ICFvcHRpb25zLmVuYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludGVybmFsIGNvZGVjIGlzIGNhbGxlZCB3aXRob3V0IGVuY29kaW5nIHR5cGUuXCIpXG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVuY29kZXI6IG9wdGlvbnMuZW5jID09IFwiYmFzZTY0XCIgPyBlbmNvZGVyQmFzZTY0IDogZW5jb2RlckludGVybmFsLFxuICAgICAgICAgICAgZGVjb2RlcjogZGVjb2RlckludGVybmFsLFxuXG4gICAgICAgICAgICBlbmM6IG9wdGlvbnMuZW5jLFxuICAgICAgICAgICAgYm9tOiBvcHRpb25zLmJvbSxcbiAgICAgICAgfTtcbiAgICB9LFxufTtcblxuLy8gV2UgdXNlIG5vZGUuanMgaW50ZXJuYWwgZGVjb2Rlci4gSXQncyBzaWduYXR1cmUgaXMgdGhlIHNhbWUgYXMgb3Vycy5cbnZhciBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXInKS5TdHJpbmdEZWNvZGVyO1xuXG5pZiAoIVN0cmluZ0RlY29kZXIucHJvdG90eXBlLmVuZCkgLy8gTm9kZSB2MC44IGRvZXNuJ3QgaGF2ZSB0aGlzIG1ldGhvZC5cbiAgICBTdHJpbmdEZWNvZGVyLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbigpIHt9O1xuXG5mdW5jdGlvbiBkZWNvZGVySW50ZXJuYWwoKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdEZWNvZGVyKHRoaXMuZW5jKTtcbn1cblxuLy8gRW5jb2RlciBpcyBtb3N0bHkgdHJpdmlhbFxuXG5mdW5jdGlvbiBlbmNvZGVySW50ZXJuYWwoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgd3JpdGU6IGVuY29kZUludGVybmFsLFxuICAgICAgICBlbmQ6IGZ1bmN0aW9uKCkge30sXG4gICAgICAgIFxuICAgICAgICBlbmM6IHRoaXMuZW5jLFxuICAgIH1cbn1cblxuZnVuY3Rpb24gZW5jb2RlSW50ZXJuYWwoc3RyKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoc3RyLCB0aGlzLmVuYyk7XG59XG5cblxuLy8gRXhjZXB0IGJhc2U2NCBlbmNvZGVyLCB3aGljaCBtdXN0IGtlZXAgaXRzIHN0YXRlLlxuXG5mdW5jdGlvbiBlbmNvZGVyQmFzZTY0KCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHdyaXRlOiBlbmNvZGVCYXNlNjRXcml0ZSxcbiAgICAgICAgZW5kOiBlbmNvZGVCYXNlNjRFbmQsXG5cbiAgICAgICAgcHJldlN0cjogJycsXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gZW5jb2RlQmFzZTY0V3JpdGUoc3RyKSB7XG4gICAgc3RyID0gdGhpcy5wcmV2U3RyICsgc3RyO1xuICAgIHZhciBjb21wbGV0ZVF1YWRzID0gc3RyLmxlbmd0aCAtIChzdHIubGVuZ3RoICUgNCk7XG4gICAgdGhpcy5wcmV2U3RyID0gc3RyLnNsaWNlKGNvbXBsZXRlUXVhZHMpO1xuICAgIHN0ciA9IHN0ci5zbGljZSgwLCBjb21wbGV0ZVF1YWRzKTtcblxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN0ciwgXCJiYXNlNjRcIik7XG59XG5cbmZ1bmN0aW9uIGVuY29kZUJhc2U2NEVuZCgpIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcih0aGlzLnByZXZTdHIsIFwiYmFzZTY0XCIpO1xufVxuXG4iLCJcbi8vIFNpbmdsZS1ieXRlIGNvZGVjLiBOZWVkcyBhICdjaGFycycgc3RyaW5nIHBhcmFtZXRlciB0aGF0IGNvbnRhaW5zIDI1NiBvciAxMjggY2hhcnMgdGhhdFxuLy8gY29ycmVzcG9uZCB0byBlbmNvZGVkIGJ5dGVzIChpZiAxMjggLSB0aGVuIGxvd2VyIGhhbGYgaXMgQVNDSUkpLiBcblxuZXhwb3J0cy5fc2JjcyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNCQ1MgY29kZWMgaXMgY2FsbGVkIHdpdGhvdXQgdGhlIGRhdGEuXCIpXG4gICAgXG4gICAgLy8gUHJlcGFyZSBjaGFyIGJ1ZmZlciBmb3IgZGVjb2RpbmcuXG4gICAgaWYgKCFvcHRpb25zLmNoYXJzIHx8IChvcHRpb25zLmNoYXJzLmxlbmd0aCAhPT0gMTI4ICYmIG9wdGlvbnMuY2hhcnMubGVuZ3RoICE9PSAyNTYpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbmNvZGluZyAnXCIrb3B0aW9ucy50eXBlK1wiJyBoYXMgaW5jb3JyZWN0ICdjaGFycycgKG11c3QgYmUgb2YgbGVuIDEyOCBvciAyNTYpXCIpO1xuICAgIFxuICAgIGlmIChvcHRpb25zLmNoYXJzLmxlbmd0aCA9PT0gMTI4KSB7XG4gICAgICAgIHZhciBhc2NpaVN0cmluZyA9IFwiXCI7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMTI4OyBpKyspXG4gICAgICAgICAgICBhc2NpaVN0cmluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpO1xuICAgICAgICBvcHRpb25zLmNoYXJzID0gYXNjaWlTdHJpbmcgKyBvcHRpb25zLmNoYXJzO1xuICAgIH1cblxuICAgIHZhciBkZWNvZGVCdWYgPSBuZXcgQnVmZmVyKG9wdGlvbnMuY2hhcnMsICd1Y3MyJyk7XG4gICAgXG4gICAgLy8gRW5jb2RpbmcgYnVmZmVyLlxuICAgIHZhciBlbmNvZGVCdWYgPSBuZXcgQnVmZmVyKDY1NTM2KTtcbiAgICBlbmNvZGVCdWYuZmlsbChvcHRpb25zLmljb252LmRlZmF1bHRDaGFyU2luZ2xlQnl0ZS5jaGFyQ29kZUF0KDApKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb3B0aW9ucy5jaGFycy5sZW5ndGg7IGkrKylcbiAgICAgICAgZW5jb2RlQnVmW29wdGlvbnMuY2hhcnMuY2hhckNvZGVBdChpKV0gPSBpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2RlcjogZW5jb2RlclNCQ1MsXG4gICAgICAgIGRlY29kZXI6IGRlY29kZXJTQkNTLFxuXG4gICAgICAgIGVuY29kZUJ1ZjogZW5jb2RlQnVmLFxuICAgICAgICBkZWNvZGVCdWY6IGRlY29kZUJ1ZixcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBlbmNvZGVyU0JDUyhvcHRpb25zKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgd3JpdGU6IGVuY29kZXJTQkNTV3JpdGUsXG4gICAgICAgIGVuZDogZnVuY3Rpb24oKSB7fSxcblxuICAgICAgICBlbmNvZGVCdWY6IHRoaXMuZW5jb2RlQnVmLFxuICAgIH07XG59XG5cbmZ1bmN0aW9uIGVuY29kZXJTQkNTV3JpdGUoc3RyKSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3RyLmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspXG4gICAgICAgIGJ1ZltpXSA9IHRoaXMuZW5jb2RlQnVmW3N0ci5jaGFyQ29kZUF0KGkpXTtcbiAgICBcbiAgICByZXR1cm4gYnVmO1xufVxuXG5cbmZ1bmN0aW9uIGRlY29kZXJTQkNTKG9wdGlvbnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICB3cml0ZTogZGVjb2RlclNCQ1NXcml0ZSxcbiAgICAgICAgZW5kOiBmdW5jdGlvbigpIHt9LFxuICAgICAgICBcbiAgICAgICAgZGVjb2RlQnVmOiB0aGlzLmRlY29kZUJ1ZixcbiAgICB9O1xufVxuXG5mdW5jdGlvbiBkZWNvZGVyU0JDU1dyaXRlKGJ1Zikge1xuICAgIC8vIFN0cmluZ3MgYXJlIGltbXV0YWJsZSBpbiBKUyAtPiB3ZSB1c2UgdWNzMiBidWZmZXIgdG8gc3BlZWQgdXAgY29tcHV0YXRpb25zLlxuICAgIHZhciBkZWNvZGVCdWYgPSB0aGlzLmRlY29kZUJ1ZjtcbiAgICB2YXIgbmV3QnVmID0gbmV3IEJ1ZmZlcihidWYubGVuZ3RoKjIpO1xuICAgIHZhciBpZHgxID0gMCwgaWR4MiA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDAsIF9sZW4gPSBidWYubGVuZ3RoOyBpIDwgX2xlbjsgaSsrKSB7XG4gICAgICAgIGlkeDEgPSBidWZbaV0qMjsgaWR4MiA9IGkqMjtcbiAgICAgICAgbmV3QnVmW2lkeDJdID0gZGVjb2RlQnVmW2lkeDFdO1xuICAgICAgICBuZXdCdWZbaWR4MisxXSA9IGRlY29kZUJ1ZltpZHgxKzFdO1xuICAgIH1cbiAgICByZXR1cm4gbmV3QnVmLnRvU3RyaW5nKCd1Y3MyJyk7XG59XG4iLCJcbi8vIEdlbmVyYXRlZCBkYXRhIGZvciBzYmNzIGNvZGVjLiBEb24ndCBlZGl0IG1hbnVhbGx5LiBSZWdlbmVyYXRlIHVzaW5nIGdlbmVyYXRpb24vZ2VuLXNiY3MuanMgc2NyaXB0LlxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFwiNDM3XCI6IFwiY3A0MzdcIixcbiAgXCI3MzdcIjogXCJjcDczN1wiLFxuICBcIjc3NVwiOiBcImNwNzc1XCIsXG4gIFwiODUwXCI6IFwiY3A4NTBcIixcbiAgXCI4NTJcIjogXCJjcDg1MlwiLFxuICBcIjg1NVwiOiBcImNwODU1XCIsXG4gIFwiODU2XCI6IFwiY3A4NTZcIixcbiAgXCI4NTdcIjogXCJjcDg1N1wiLFxuICBcIjg1OFwiOiBcImNwODU4XCIsXG4gIFwiODYwXCI6IFwiY3A4NjBcIixcbiAgXCI4NjFcIjogXCJjcDg2MVwiLFxuICBcIjg2MlwiOiBcImNwODYyXCIsXG4gIFwiODYzXCI6IFwiY3A4NjNcIixcbiAgXCI4NjRcIjogXCJjcDg2NFwiLFxuICBcIjg2NVwiOiBcImNwODY1XCIsXG4gIFwiODY2XCI6IFwiY3A4NjZcIixcbiAgXCI4NjlcIjogXCJjcDg2OVwiLFxuICBcIjg3NFwiOiBcIndpbmRvd3M4NzRcIixcbiAgXCI5MjJcIjogXCJjcDkyMlwiLFxuICBcIjEwNDZcIjogXCJjcDEwNDZcIixcbiAgXCIxMTI0XCI6IFwiY3AxMTI0XCIsXG4gIFwiMTEyNVwiOiBcImNwMTEyNVwiLFxuICBcIjExMjlcIjogXCJjcDExMjlcIixcbiAgXCIxMTMzXCI6IFwiY3AxMTMzXCIsXG4gIFwiMTE2MVwiOiBcImNwMTE2MVwiLFxuICBcIjExNjJcIjogXCJjcDExNjJcIixcbiAgXCIxMTYzXCI6IFwiY3AxMTYzXCIsXG4gIFwiMTI1MFwiOiBcIndpbmRvd3MxMjUwXCIsXG4gIFwiMTI1MVwiOiBcIndpbmRvd3MxMjUxXCIsXG4gIFwiMTI1MlwiOiBcIndpbmRvd3MxMjUyXCIsXG4gIFwiMTI1M1wiOiBcIndpbmRvd3MxMjUzXCIsXG4gIFwiMTI1NFwiOiBcIndpbmRvd3MxMjU0XCIsXG4gIFwiMTI1NVwiOiBcIndpbmRvd3MxMjU1XCIsXG4gIFwiMTI1NlwiOiBcIndpbmRvd3MxMjU2XCIsXG4gIFwiMTI1N1wiOiBcIndpbmRvd3MxMjU3XCIsXG4gIFwiMTI1OFwiOiBcIndpbmRvd3MxMjU4XCIsXG4gIFwiMjg1OTFcIjogXCJpc284ODU5MVwiLFxuICBcIjI4NTkyXCI6IFwiaXNvODg1OTJcIixcbiAgXCIyODU5M1wiOiBcImlzbzg4NTkzXCIsXG4gIFwiMjg1OTRcIjogXCJpc284ODU5NFwiLFxuICBcIjI4NTk1XCI6IFwiaXNvODg1OTVcIixcbiAgXCIyODU5NlwiOiBcImlzbzg4NTk2XCIsXG4gIFwiMjg1OTdcIjogXCJpc284ODU5N1wiLFxuICBcIjI4NTk4XCI6IFwiaXNvODg1OThcIixcbiAgXCIyODU5OVwiOiBcImlzbzg4NTk5XCIsXG4gIFwiMjg2MDBcIjogXCJpc284ODU5MTBcIixcbiAgXCIyODYwMVwiOiBcImlzbzg4NTkxMVwiLFxuICBcIjI4NjAzXCI6IFwiaXNvODg1OTEzXCIsXG4gIFwiMjg2MDRcIjogXCJpc284ODU5MTRcIixcbiAgXCIyODYwNVwiOiBcImlzbzg4NTkxNVwiLFxuICBcIjI4NjA2XCI6IFwiaXNvODg1OTE2XCIsXG4gIFwid2luZG93czg3NFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4oKs77+977+977+977+94oCm77+977+977+977+977+977+977+977+977+977+977+94oCY4oCZ4oCc4oCd4oCi4oCT4oCU77+977+977+977+977+977+977+977+9wqDguIHguILguIPguITguIXguIbguIfguIjguInguIrguIvguIzguI3guI7guI/guJDguJHguJLguJPguJTguJXguJbguJfguJjguJnguJrguJvguJzguJ3guJ7guJ/guKDguKHguKLguKPguKTguKXguKbguKfguKjguKnguKrguKvguKzguK3guK7guK/guLDguLHguLLguLPguLTguLXguLbguLfguLjguLnguLrvv73vv73vv73vv73guL/guYDguYHguYLguYPguYTguYXguYbguYfguYjguYnguYrguYvguYzguY3guY7guY/guZDguZHguZLguZPguZTguZXguZbguZfguZjguZnguZrguZvvv73vv73vv73vv71cIlxuICB9LFxuICBcIndpbjg3NFwiOiBcIndpbmRvd3M4NzRcIixcbiAgXCJjcDg3NFwiOiBcIndpbmRvd3M4NzRcIixcbiAgXCJ3aW5kb3dzMTI1MFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4oKs77+94oCa77+94oCe4oCm4oCg4oCh77+94oCwxaDigLnFmsWkxb3Fue+/veKAmOKAmeKAnOKAneKAouKAk+KAlO+/veKEosWh4oC6xZvFpcW+xbrCoMuHy5jFgcKkxITCpsKnwqjCqcWewqvCrMKtwq7Fu8KwwrHLm8WCwrTCtcK2wrfCuMSFxZ/Cu8S9y53EvsW8xZTDgcOCxILDhMS5xIbDh8SMw4nEmMOLxJrDjcOOxI7EkMWDxYfDk8OUxZDDlsOXxZjFrsOaxbDDnMOdxaLDn8WVw6HDosSDw6TEusSHw6fEjcOpxJnDq8Sbw63DrsSPxJHFhMWIw7PDtMWRw7bDt8WZxa/DusWxw7zDvcWjy5lcIlxuICB9LFxuICBcIndpbjEyNTBcIjogXCJ3aW5kb3dzMTI1MFwiLFxuICBcImNwMTI1MFwiOiBcIndpbmRvd3MxMjUwXCIsXG4gIFwid2luZG93czEyNTFcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcItCC0IPigJrRk+KAnuKApuKAoOKAoeKCrOKAsNCJ4oC50IrQjNCL0I/RkuKAmOKAmeKAnOKAneKAouKAk+KAlO+/veKEotGZ4oC60ZrRnNGb0Z/CoNCO0Z7QiMKk0pDCpsKn0IHCqdCEwqvCrMKtwq7Qh8KwwrHQhtGW0pHCtcK2wrfRkeKEltGUwrvRmNCF0ZXRl9CQ0JHQktCT0JTQldCW0JfQmNCZ0JrQm9Cc0J3QntCf0KDQodCi0KPQpNCl0KbQp9Co0KnQqtCr0KzQrdCu0K/QsNCx0LLQs9C00LXQttC30LjQudC60LvQvNC90L7Qv9GA0YHRgtGD0YTRhdGG0YfRiNGJ0YrRi9GM0Y3RjtGPXCJcbiAgfSxcbiAgXCJ3aW4xMjUxXCI6IFwid2luZG93czEyNTFcIixcbiAgXCJjcDEyNTFcIjogXCJ3aW5kb3dzMTI1MVwiLFxuICBcIndpbmRvd3MxMjUyXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLigqzvv73igJrGkuKAnuKApuKAoOKAocuG4oCwxaDigLnFku+/vcW977+977+94oCY4oCZ4oCc4oCd4oCi4oCT4oCUy5zihKLFoeKAusWT77+9xb7FuMKgwqHCosKjwqTCpcKmwqfCqMKpwqrCq8Kswq3CrsKvwrDCscKywrPCtMK1wrbCt8K4wrnCusK7wrzCvcK+wr/DgMOBw4LDg8OEw4XDhsOHw4jDicOKw4vDjMONw47Dj8OQw5HDksOTw5TDlcOWw5fDmMOZw5rDm8Ocw53DnsOfw6DDocOiw6PDpMOlw6bDp8Oow6nDqsOrw6zDrcOuw6/DsMOxw7LDs8O0w7XDtsO3w7jDucO6w7vDvMO9w77Dv1wiXG4gIH0sXG4gIFwid2luMTI1MlwiOiBcIndpbmRvd3MxMjUyXCIsXG4gIFwiY3AxMjUyXCI6IFwid2luZG93czEyNTJcIixcbiAgXCJ3aW5kb3dzMTI1M1wiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4oKs77+94oCaxpLigJ7igKbigKDigKHvv73igLDvv73igLnvv73vv73vv73vv73vv73igJjigJnigJzigJ3igKLigJPigJTvv73ihKLvv73igLrvv73vv73vv73vv73CoM6FzobCo8KkwqXCpsKnwqjCqe+/vcKrwqzCrcKu4oCVwrDCscKywrPOhMK1wrbCt86IzonOisK7zozCvc6Ozo/OkM6RzpLOk86UzpXOls6XzpjOmc6azpvOnM6dzp7On86gzqHvv73Oo86kzqXOps6nzqjOqc6qzqvOrM6tzq7Or86wzrHOss6zzrTOtc62zrfOuM65zrrOu868zr3Ovs6/z4DPgc+Cz4PPhM+Fz4bPh8+Iz4nPis+Lz4zPjc+O77+9XCJcbiAgfSxcbiAgXCJ3aW4xMjUzXCI6IFwid2luZG93czEyNTNcIixcbiAgXCJjcDEyNTNcIjogXCJ3aW5kb3dzMTI1M1wiLFxuICBcIndpbmRvd3MxMjU0XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLigqzvv73igJrGkuKAnuKApuKAoOKAocuG4oCwxaDigLnFku+/ve+/ve+/ve+/veKAmOKAmeKAnOKAneKAouKAk+KAlMuc4oSixaHigLrFk++/ve+/vcW4wqDCocKiwqPCpMKlwqbCp8KowqnCqsKrwqzCrcKuwq/CsMKxwrLCs8K0wrXCtsK3wrjCucK6wrvCvMK9wr7Cv8OAw4HDgsODw4TDhcOGw4fDiMOJw4rDi8OMw43DjsOPxJ7DkcOSw5PDlMOVw5bDl8OYw5nDmsObw5zEsMWew5/DoMOhw6LDo8Okw6XDpsOnw6jDqcOqw6vDrMOtw67Dr8Sfw7HDssOzw7TDtcO2w7fDuMO5w7rDu8O8xLHFn8O/XCJcbiAgfSxcbiAgXCJ3aW4xMjU0XCI6IFwid2luZG93czEyNTRcIixcbiAgXCJjcDEyNTRcIjogXCJ3aW5kb3dzMTI1NFwiLFxuICBcIndpbmRvd3MxMjU1XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLigqzvv73igJrGkuKAnuKApuKAoOKAocuG4oCw77+94oC577+977+977+977+977+94oCY4oCZ4oCc4oCd4oCi4oCT4oCUy5zihKLvv73igLrvv73vv73vv73vv73CoMKhwqLCo+KCqsKlwqbCp8KowqnDl8KrwqzCrcKuwq/CsMKxwrLCs8K0wrXCtsK3wrjCucO3wrvCvMK9wr7Cv9aw1rHWstaz1rTWtda21rfWuNa577+91rvWvNa91r7Wv9eA14HXgteD17DXsdey17PXtO+/ve+/ve+/ve+/ve+/ve+/ve+/vdeQ15HXkteT15TXldeW15fXmNeZ15rXm9ec153Xntef16DXodei16PXpNel16bXp9eo16nXqu+/ve+/veKAjuKAj++/vVwiXG4gIH0sXG4gIFwid2luMTI1NVwiOiBcIndpbmRvd3MxMjU1XCIsXG4gIFwiY3AxMjU1XCI6IFwid2luZG93czEyNTVcIixcbiAgXCJ3aW5kb3dzMTI1NlwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4oKs2b7igJrGkuKAnuKApuKAoOKAocuG4oCw2bnigLnFktqG2pjaiNqv4oCY4oCZ4oCc4oCd4oCi4oCT4oCU2qnihKLakeKAusWT4oCM4oCN2rrCoNiMwqLCo8KkwqXCpsKnwqjCqdq+wqvCrMKtwq7Cr8KwwrHCssKzwrTCtcK2wrfCuMK52JvCu8K8wr3Cvtif24HYodii2KPYpNil2KbYp9io2KnYqtir2KzYrdiu2K/YsNix2LLYs9i02LXYtsOX2LfYuNi52LrZgNmB2YLZg8Og2YTDotmF2YbZh9mIw6fDqMOpw6rDq9mJ2YrDrsOv2YvZjNmN2Y7DtNmP2ZDDt9mRw7nZksO7w7zigI7igI/bklwiXG4gIH0sXG4gIFwid2luMTI1NlwiOiBcIndpbmRvd3MxMjU2XCIsXG4gIFwiY3AxMjU2XCI6IFwid2luZG93czEyNTZcIixcbiAgXCJ3aW5kb3dzMTI1N1wiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4oKs77+94oCa77+94oCe4oCm4oCg4oCh77+94oCw77+94oC577+9wqjLh8K477+94oCY4oCZ4oCc4oCd4oCi4oCT4oCU77+94oSi77+94oC677+9wq/Lm++/vcKg77+9wqLCo8Kk77+9wqbCp8OYwqnFlsKrwqzCrcKuw4bCsMKxwrLCs8K0wrXCtsK3w7jCucWXwrvCvMK9wr7DpsSExK7EgMSGw4TDhcSYxJLEjMOJxbnElsSixLbEqsS7xaDFg8WFw5PFjMOVw5bDl8WyxYHFmsWqw5zFu8W9w5/EhcSvxIHEh8Okw6XEmcSTxI3DqcW6xJfEo8S3xKvEvMWhxYTFhsOzxY3DtcO2w7fFs8WCxZvFq8O8xbzFvsuZXCJcbiAgfSxcbiAgXCJ3aW4xMjU3XCI6IFwid2luZG93czEyNTdcIixcbiAgXCJjcDEyNTdcIjogXCJ3aW5kb3dzMTI1N1wiLFxuICBcIndpbmRvd3MxMjU4XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLigqzvv73igJrGkuKAnuKApuKAoOKAocuG4oCw77+94oC5xZLvv73vv73vv73vv73igJjigJnigJzigJ3igKLigJPigJTLnOKEou+/veKAusWT77+977+9xbjCoMKhwqLCo8KkwqXCpsKnwqjCqcKqwqvCrMKtwq7Cr8KwwrHCssKzwrTCtcK2wrfCuMK5wrrCu8K8wr3CvsK/w4DDgcOCxILDhMOFw4bDh8OIw4nDisOLzIDDjcOOw4/EkMORzInDk8OUxqDDlsOXw5jDmcOaw5vDnMavzIPDn8Ogw6HDosSDw6TDpcOmw6fDqMOpw6rDq8yBw63DrsOvxJHDscyjw7PDtMahw7bDt8O4w7nDusO7w7zGsOKCq8O/XCJcbiAgfSxcbiAgXCJ3aW4xMjU4XCI6IFwid2luZG93czEyNThcIixcbiAgXCJjcDEyNThcIjogXCJ3aW5kb3dzMTI1OFwiLFxuICBcImlzbzg4NTkxXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCgMKBwoLCg8KEwoXChsKHwojCicKKwovCjMKNwo7Cj8KQwpHCksKTwpTClcKWwpfCmMKZwprCm8Kcwp3CnsKfwqDCocKiwqPCpMKlwqbCp8KowqnCqsKrwqzCrcKuwq/CsMKxwrLCs8K0wrXCtsK3wrjCucK6wrvCvMK9wr7Cv8OAw4HDgsODw4TDhcOGw4fDiMOJw4rDi8OMw43DjsOPw5DDkcOSw5PDlMOVw5bDl8OYw5nDmsObw5zDncOew5/DoMOhw6LDo8Okw6XDpsOnw6jDqcOqw6vDrMOtw67Dr8Oww7HDssOzw7TDtcO2w7fDuMO5w7rDu8O8w73DvsO/XCJcbiAgfSxcbiAgXCJjcDI4NTkxXCI6IFwiaXNvODg1OTFcIixcbiAgXCJpc284ODU5MlwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8KgxITLmMWBwqTEvcWawqfCqMWgxZ7FpMW5wq3FvcW7wrDEhcubxYLCtMS+xZvLh8K4xaHFn8WlxbrLncW+xbzFlMOBw4LEgsOExLnEhsOHxIzDicSYw4vEmsONw47EjsSQxYPFh8OTw5TFkMOWw5fFmMWuw5rFsMOcw53FosOfxZXDocOixIPDpMS6xIfDp8SNw6nEmcOrxJvDrcOuxI/EkcWExYjDs8O0xZHDtsO3xZnFr8O6xbHDvMO9xaPLmVwiXG4gIH0sXG4gIFwiY3AyODU5MlwiOiBcImlzbzg4NTkyXCIsXG4gIFwiaXNvODg1OTNcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoMSmy5jCo8Kk77+9xKTCp8KoxLDFnsSexLTCre+/vcW7wrDEp8KywrPCtMK1xKXCt8K4xLHFn8SfxLXCve+/vcW8w4DDgcOC77+9w4TEisSIw4fDiMOJw4rDi8OMw43DjsOP77+9w5HDksOTw5TEoMOWw5fEnMOZw5rDm8OcxazFnMOfw6DDocOi77+9w6TEi8SJw6fDqMOpw6rDq8Osw63DrsOv77+9w7HDssOzw7TEocO2w7fEncO5w7rDu8O8xa3FncuZXCJcbiAgfSxcbiAgXCJjcDI4NTkzXCI6IFwiaXNvODg1OTNcIixcbiAgXCJpc284ODU5NFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8KgxITEuMWWwqTEqMS7wqfCqMWgxJLEosWmwq3FvcKvwrDEhcubxZfCtMSpxLzLh8K4xaHEk8SjxafFisW+xYvEgMOBw4LDg8OEw4XDhsSuxIzDicSYw4vElsONw47EqsSQxYXFjMS2w5TDlcOWw5fDmMWyw5rDm8OcxajFqsOfxIHDocOiw6PDpMOlw6bEr8SNw6nEmcOrxJfDrcOuxKvEkcWGxY3Et8O0w7XDtsO3w7jFs8O6w7vDvMWpxavLmVwiXG4gIH0sXG4gIFwiY3AyODU5NFwiOiBcImlzbzg4NTk0XCIsXG4gIFwiaXNvODg1OTVcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoNCB0ILQg9CE0IXQhtCH0IjQidCK0IvQjMKt0I7Qj9CQ0JHQktCT0JTQldCW0JfQmNCZ0JrQm9Cc0J3QntCf0KDQodCi0KPQpNCl0KbQp9Co0KnQqtCr0KzQrdCu0K/QsNCx0LLQs9C00LXQttC30LjQudC60LvQvNC90L7Qv9GA0YHRgtGD0YTRhdGG0YfRiNGJ0YrRi9GM0Y3RjtGP4oSW0ZHRktGT0ZTRldGW0ZfRmNGZ0ZrRm9GcwqfRntGfXCJcbiAgfSxcbiAgXCJjcDI4NTk1XCI6IFwiaXNvODg1OTVcIixcbiAgXCJpc284ODU5NlwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8Kg77+977+977+9wqTvv73vv73vv73vv73vv73vv73vv73YjMKt77+977+977+977+977+977+977+977+977+977+977+977+977+92Jvvv73vv73vv73Yn++/vdih2KLYo9ik2KXYptin2KjYqdiq2KvYrNit2K7Yr9iw2LHYstiz2LTYtdi22LfYuNi52Lrvv73vv73vv73vv73vv73ZgNmB2YLZg9mE2YXZhtmH2YjZidmK2YvZjNmN2Y7Zj9mQ2ZHZku+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/vVwiXG4gIH0sXG4gIFwiY3AyODU5NlwiOiBcImlzbzg4NTk2XCIsXG4gIFwiaXNvODg1OTdcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoOKAmOKAmcKj4oKs4oKvwqbCp8KowqnNusKrwqzCre+/veKAlcKwwrHCssKzzoTOhc6GwrfOiM6JzorCu86Mwr3Ojs6PzpDOkc6SzpPOlM6VzpbOl86YzpnOms6bzpzOnc6ezp/OoM6h77+9zqPOpM6lzqbOp86ozqnOqs6rzqzOrc6uzq/OsM6xzrLOs860zrXOts63zrjOuc66zrvOvM69zr7Ov8+Az4HPgs+Dz4TPhc+Gz4fPiM+Jz4rPi8+Mz43Pju+/vVwiXG4gIH0sXG4gIFwiY3AyODU5N1wiOiBcImlzbzg4NTk3XCIsXG4gIFwiaXNvODg1OThcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoO+/vcKiwqPCpMKlwqbCp8KowqnDl8KrwqzCrcKuwq/CsMKxwrLCs8K0wrXCtsK3wrjCucO3wrvCvMK9wr7vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73igJfXkNeR15LXk9eU15XXlteX15jXmdea15vXnNed157Xn9eg16HXotej16TXpdem16fXqNep16rvv73vv73igI7igI/vv71cIlxuICB9LFxuICBcImNwMjg1OThcIjogXCJpc284ODU5OFwiLFxuICBcImlzbzg4NTk5XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCgMKBwoLCg8KEwoXChsKHwojCicKKwovCjMKNwo7Cj8KQwpHCksKTwpTClcKWwpfCmMKZwprCm8Kcwp3CnsKfwqDCocKiwqPCpMKlwqbCp8KowqnCqsKrwqzCrcKuwq/CsMKxwrLCs8K0wrXCtsK3wrjCucK6wrvCvMK9wr7Cv8OAw4HDgsODw4TDhcOGw4fDiMOJw4rDi8OMw43DjsOPxJ7DkcOSw5PDlMOVw5bDl8OYw5nDmsObw5zEsMWew5/DoMOhw6LDo8Okw6XDpsOnw6jDqcOqw6vDrMOtw67Dr8Sfw7HDssOzw7TDtcO2w7fDuMO5w7rDu8O8xLHFn8O/XCJcbiAgfSxcbiAgXCJjcDI4NTk5XCI6IFwiaXNvODg1OTlcIixcbiAgXCJpc284ODU5MTBcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoMSExJLEosSqxKjEtsKnxLvEkMWgxabFvcKtxarFisKwxIXEk8SjxKvEqcS3wrfEvMSRxaHFp8W+4oCVxavFi8SAw4HDgsODw4TDhcOGxK7EjMOJxJjDi8SWw43DjsOPw5DFhcWMw5PDlMOVw5bFqMOYxbLDmsObw5zDncOew5/EgcOhw6LDo8Okw6XDpsSvxI3DqcSZw6vEl8Otw67Dr8OwxYbFjcOzw7TDtcO2xanDuMWzw7rDu8O8w73DvsS4XCJcbiAgfSxcbiAgXCJjcDI4NjAwXCI6IFwiaXNvODg1OTEwXCIsXG4gIFwiaXNvODg1OTExXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCgMKBwoLCg8KEwoXChsKHwojCicKKwovCjMKNwo7Cj8KQwpHCksKTwpTClcKWwpfCmMKZwprCm8Kcwp3CnsKfwqDguIHguILguIPguITguIXguIbguIfguIjguInguIrguIvguIzguI3guI7guI/guJDguJHguJLguJPguJTguJXguJbguJfguJjguJnguJrguJvguJzguJ3guJ7guJ/guKDguKHguKLguKPguKTguKXguKbguKfguKjguKnguKrguKvguKzguK3guK7guK/guLDguLHguLLguLPguLTguLXguLbguLfguLjguLnguLrvv73vv73vv73vv73guL/guYDguYHguYLguYPguYTguYXguYbguYfguYjguYnguYrguYvguYzguY3guY7guY/guZDguZHguZLguZPguZTguZXguZbguZfguZjguZnguZrguZvvv73vv73vv73vv71cIlxuICB9LFxuICBcImNwMjg2MDFcIjogXCJpc284ODU5MTFcIixcbiAgXCJpc284ODU5MTNcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoOKAncKiwqPCpOKAnsKmwqfDmMKpxZbCq8Kswq3CrsOGwrDCscKywrPigJzCtcK2wrfDuMK5xZfCu8K8wr3CvsOmxITErsSAxIbDhMOFxJjEksSMw4nFucSWxKLEtsSqxLvFoMWDxYXDk8WMw5XDlsOXxbLFgcWaxarDnMW7xb3Dn8SFxK/EgcSHw6TDpcSZxJPEjcOpxbrEl8SjxLfEq8S8xaHFhMWGw7PFjcO1w7bDt8WzxYLFm8Wrw7zFvMW+4oCZXCJcbiAgfSxcbiAgXCJjcDI4NjAzXCI6IFwiaXNvODg1OTEzXCIsXG4gIFwiaXNvODg1OTE0XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCgMKBwoLCg8KEwoXChsKHwojCicKKwovCjMKNwo7Cj8KQwpHCksKTwpTClcKWwpfCmMKZwprCm8Kcwp3CnsKfwqDhuILhuIPCo8SKxIvhuIrCp+G6gMKp4bqC4biL4buywq3CrsW44bie4bifxKDEoeG5gOG5gcK24bmW4bqB4bmX4bqD4bmg4buz4bqE4bqF4bmhw4DDgcOCw4PDhMOFw4bDh8OIw4nDisOLw4zDjcOOw4/FtMORw5LDk8OUw5XDluG5qsOYw5nDmsObw5zDncW2w5/DoMOhw6LDo8Okw6XDpsOnw6jDqcOqw6vDrMOtw67Dr8W1w7HDssOzw7TDtcO24bmrw7jDucO6w7vDvMO9xbfDv1wiXG4gIH0sXG4gIFwiY3AyODYwNFwiOiBcImlzbzg4NTkxNFwiLFxuICBcImlzbzg4NTkxNVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8KgwqHCosKj4oKswqXFoMKnxaHCqcKqwqvCrMKtwq7Cr8KwwrHCssKzxb3CtcK2wrfFvsK5wrrCu8WSxZPFuMK/w4DDgcOCw4PDhMOFw4bDh8OIw4nDisOLw4zDjcOOw4/DkMORw5LDk8OUw5XDlsOXw5jDmcOaw5vDnMOdw57Dn8Ogw6HDosOjw6TDpcOmw6fDqMOpw6rDq8Osw63DrsOvw7DDscOyw7PDtMO1w7bDt8O4w7nDusO7w7zDvcO+w79cIlxuICB9LFxuICBcImNwMjg2MDVcIjogXCJpc284ODU5MTVcIixcbiAgXCJpc284ODU5MTZcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoMSExIXFgeKCrOKAnsWgwqfFocKpyJjCq8W5wq3FusW7wrDCscSMxYLFveKAncK2wrfFvsSNyJnCu8WSxZPFuMW8w4DDgcOCxILDhMSGw4bDh8OIw4nDisOLw4zDjcOOw4/EkMWDw5LDk8OUxZDDlsWaxbDDmcOaw5vDnMSYyJrDn8Ogw6HDosSDw6TEh8Omw6fDqMOpw6rDq8Osw63DrsOvxJHFhMOyw7PDtMWRw7bFm8Wxw7nDusO7w7zEmcibw79cIlxuICB9LFxuICBcImNwMjg2MDZcIjogXCJpc284ODU5MTZcIixcbiAgXCJjcDQzN1wiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiw4fDvMOpw6LDpMOgw6XDp8Oqw6vDqMOvw67DrMOEw4XDicOmw4bDtMO2w7LDu8O5w7/DlsOcwqLCo8Kl4oKnxpLDocOtw7PDusOxw5HCqsK6wr/ijJDCrMK9wrzCocKrwrvilpHilpLilpPilILilKTilaHilaLilZbilZXilaPilZHilZfilZ3ilZzilZvilJDilJTilLTilKzilJzilIDilLzilZ7ilZ/ilZrilZTilanilabilaDilZDilazilafilajilaTilaXilZnilZjilZLilZPilavilarilJjilIzilojiloTilozilpDiloDOscOfzpPPgM6jz4PCtc+EzqbOmM6pzrTiiJ7Phs614oip4omhwrHiiaXiiaTijKDijKHDt+KJiMKw4oiZwrfiiJrigb/CsuKWoMKgXCJcbiAgfSxcbiAgXCJpYm00MzdcIjogXCJjcDQzN1wiLFxuICBcImNzaWJtNDM3XCI6IFwiY3A0MzdcIixcbiAgXCJjcDczN1wiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwizpHOks6TzpTOlc6WzpfOmM6ZzprOm86czp3Ons6fzqDOoc6jzqTOpc6mzqfOqM6pzrHOss6zzrTOtc62zrfOuM65zrrOu868zr3Ovs6/z4DPgc+Dz4LPhM+Fz4bPh8+I4paR4paS4paT4pSC4pSk4pWh4pWi4pWW4pWV4pWj4pWR4pWX4pWd4pWc4pWb4pSQ4pSU4pS04pSs4pSc4pSA4pS84pWe4pWf4pWa4pWU4pWp4pWm4pWg4pWQ4pWs4pWn4pWo4pWk4pWl4pWZ4pWY4pWS4pWT4pWr4pWq4pSY4pSM4paI4paE4paM4paQ4paAz4nOrM6tzq7Pis6vz4zPjc+Lz47Ohs6IzonOis6Mzo7Oj8Kx4oml4omkzqrOq8O34omIwrDiiJnCt+KImuKBv8Ky4pagwqBcIlxuICB9LFxuICBcImlibTczN1wiOiBcImNwNzM3XCIsXG4gIFwiY3NpYm03MzdcIjogXCJjcDczN1wiLFxuICBcImNwNzc1XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLEhsO8w6nEgcOkxKPDpcSHxYLEk8WWxZfEq8W5w4TDhcOJw6bDhsWNw7bEosKixZrFm8OWw5zDuMKjw5jDl8KkxIDEqsOzxbvFvMW64oCdwqbCqcKuwqzCvcK8xYHCq8K74paR4paS4paT4pSC4pSkxITEjMSYxJbilaPilZHilZfilZ3ErsWg4pSQ4pSU4pS04pSs4pSc4pSA4pS8xbLFquKVmuKVlOKVqeKVpuKVoOKVkOKVrMW9xIXEjcSZxJfEr8WhxbPFq8W+4pSY4pSM4paI4paE4paM4paQ4paAw5PDn8WMxYPDtcOVwrXFhMS2xLfEu8S8xYbEksWF4oCZwq3CseKAnMK+wrbCp8O34oCewrDiiJnCt8K5wrPCsuKWoMKgXCJcbiAgfSxcbiAgXCJpYm03NzVcIjogXCJjcDc3NVwiLFxuICBcImNzaWJtNzc1XCI6IFwiY3A3NzVcIixcbiAgXCJjcDg1MFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiw4fDvMOpw6LDpMOgw6XDp8Oqw6vDqMOvw67DrMOEw4XDicOmw4bDtMO2w7LDu8O5w7/DlsOcw7jCo8OYw5fGksOhw63Ds8O6w7HDkcKqwrrCv8KuwqzCvcK8wqHCq8K74paR4paS4paT4pSC4pSkw4HDgsOAwqnilaPilZHilZfilZ3CosKl4pSQ4pSU4pS04pSs4pSc4pSA4pS8w6PDg+KVmuKVlOKVqeKVpuKVoOKVkOKVrMKkw7DDkMOKw4vDiMSxw43DjsOP4pSY4pSM4paI4paEwqbDjOKWgMOTw5/DlMOSw7XDlcK1w77DnsOaw5vDmcO9w53Cr8K0wq3CseKAl8K+wrbCp8O3wrjCsMKowrfCucKzwrLilqDCoFwiXG4gIH0sXG4gIFwiaWJtODUwXCI6IFwiY3A4NTBcIixcbiAgXCJjc2libTg1MFwiOiBcImNwODUwXCIsXG4gIFwiY3A4NTJcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsOHw7zDqcOiw6TFr8SHw6fFgsOrxZDFkcOuxbnDhMSGw4nEucS6w7TDtsS9xL7FmsWbw5bDnMWkxaXFgcOXxI3DocOtw7PDusSExIXFvcW+xJjEmcKsxbrEjMWfwqvCu+KWkeKWkuKWk+KUguKUpMOBw4LEmsWe4pWj4pWR4pWX4pWdxbvFvOKUkOKUlOKUtOKUrOKUnOKUgOKUvMSCxIPilZrilZTilanilabilaDilZDilazCpMSRxJDEjsOLxI/Fh8ONw47Em+KUmOKUjOKWiOKWhMWixa7iloDDk8Ofw5TFg8WExYjFoMWhxZTDmsWVxbDDvcOdxaPCtMKty53Lm8uHy5jCp8O3wrjCsMKoy5nFscWYxZnilqDCoFwiXG4gIH0sXG4gIFwiaWJtODUyXCI6IFwiY3A4NTJcIixcbiAgXCJjc2libTg1MlwiOiBcImNwODUyXCIsXG4gIFwiY3A4NTVcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcItGS0ILRk9CD0ZHQgdGU0ITRldCF0ZbQhtGX0IfRmNCI0ZnQidGa0IrRm9CL0ZzQjNGe0I7Rn9CP0Y7QrtGK0KrQsNCQ0LHQkdGG0KbQtNCU0LXQldGE0KTQs9CTwqvCu+KWkeKWkuKWk+KUguKUpNGF0KXQuNCY4pWj4pWR4pWX4pWd0LnQmeKUkOKUlOKUtOKUrOKUnOKUgOKUvNC60JrilZrilZTilanilabilaDilZDilazCpNC70JvQvNCc0L3QndC+0J7Qv+KUmOKUjOKWiOKWhNCf0Y/iloDQr9GA0KDRgdCh0YLQotGD0KPQttCW0LLQktGM0KzihJbCrdGL0KvQt9CX0YjQqNGN0K3RidCp0YfQp8Kn4pagwqBcIlxuICB9LFxuICBcImlibTg1NVwiOiBcImNwODU1XCIsXG4gIFwiY3NpYm04NTVcIjogXCJjcDg1NVwiLFxuICBcImNwODU2XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLXkNeR15LXk9eU15XXlteX15jXmdea15vXnNed157Xn9eg16HXotej16TXpdem16fXqNep16rvv73Co++/vcOX77+977+977+977+977+977+977+977+977+977+9wq7CrMK9wrzvv73Cq8K74paR4paS4paT4pSC4pSk77+977+977+9wqnilaPilZHilZfilZ3CosKl4pSQ4pSU4pS04pSs4pSc4pSA4pS877+977+94pWa4pWU4pWp4pWm4pWg4pWQ4pWswqTvv73vv73vv73vv73vv73vv73vv73vv73vv73ilJjilIzilojiloTCpu+/veKWgO+/ve+/ve+/ve+/ve+/ve+/vcK177+977+977+977+977+977+977+9wq/CtMKtwrHigJfCvsK2wqfDt8K4wrDCqMK3wrnCs8Ky4pagwqBcIlxuICB9LFxuICBcImlibTg1NlwiOiBcImNwODU2XCIsXG4gIFwiY3NpYm04NTZcIjogXCJjcDg1NlwiLFxuICBcImNwODU3XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLDh8O8w6nDosOkw6DDpcOnw6rDq8Oow6/DrsSxw4TDhcOJw6bDhsO0w7bDssO7w7nEsMOWw5zDuMKjw5jFnsWfw6HDrcOzw7rDscORxJ7En8K/wq7CrMK9wrzCocKrwrvilpHilpLilpPilILilKTDgcOCw4DCqeKVo+KVkeKVl+KVncKiwqXilJDilJTilLTilKzilJzilIDilLzDo8OD4pWa4pWU4pWp4pWm4pWg4pWQ4pWswqTCusKqw4rDi8OI77+9w43DjsOP4pSY4pSM4paI4paEwqbDjOKWgMOTw5/DlMOSw7XDlcK177+9w5fDmsObw5nDrMO/wq/CtMKtwrHvv73CvsK2wqfDt8K4wrDCqMK3wrnCs8Ky4pagwqBcIlxuICB9LFxuICBcImlibTg1N1wiOiBcImNwODU3XCIsXG4gIFwiY3NpYm04NTdcIjogXCJjcDg1N1wiLFxuICBcImNwODU4XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLDh8O8w6nDosOkw6DDpcOnw6rDq8Oow6/DrsOsw4TDhcOJw6bDhsO0w7bDssO7w7nDv8OWw5zDuMKjw5jDl8aSw6HDrcOzw7rDscORwqrCusK/wq7CrMK9wrzCocKrwrvilpHilpLilpPilILilKTDgcOCw4DCqeKVo+KVkeKVl+KVncKiwqXilJDilJTilLTilKzilJzilIDilLzDo8OD4pWa4pWU4pWp4pWm4pWg4pWQ4pWswqTDsMOQw4rDi8OI4oKsw43DjsOP4pSY4pSM4paI4paEwqbDjOKWgMOTw5/DlMOSw7XDlcK1w77DnsOaw5vDmcO9w53Cr8K0wq3CseKAl8K+wrbCp8O3wrjCsMKowrfCucKzwrLilqDCoFwiXG4gIH0sXG4gIFwiaWJtODU4XCI6IFwiY3A4NThcIixcbiAgXCJjc2libTg1OFwiOiBcImNwODU4XCIsXG4gIFwiY3A4NjBcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsOHw7zDqcOiw6PDoMOBw6fDqsOKw6jDjcOUw6zDg8OCw4nDgMOIw7TDtcOyw5rDucOMw5XDnMKiwqPDmeKCp8OTw6HDrcOzw7rDscORwqrCusK/w5LCrMK9wrzCocKrwrvilpHilpLilpPilILilKTilaHilaLilZbilZXilaPilZHilZfilZ3ilZzilZvilJDilJTilLTilKzilJzilIDilLzilZ7ilZ/ilZrilZTilanilabilaDilZDilazilafilajilaTilaXilZnilZjilZLilZPilavilarilJjilIzilojiloTilozilpDiloDOscOfzpPPgM6jz4PCtc+EzqbOmM6pzrTiiJ7Phs614oip4omhwrHiiaXiiaTijKDijKHDt+KJiMKw4oiZwrfiiJrigb/CsuKWoMKgXCJcbiAgfSxcbiAgXCJpYm04NjBcIjogXCJjcDg2MFwiLFxuICBcImNzaWJtODYwXCI6IFwiY3A4NjBcIixcbiAgXCJjcDg2MVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiw4fDvMOpw6LDpMOgw6XDp8Oqw6vDqMOQw7DDnsOEw4XDicOmw4bDtMO2w77Du8Odw73DlsOcw7jCo8OY4oKnxpLDocOtw7PDusOBw43Dk8Oawr/ijJDCrMK9wrzCocKrwrvilpHilpLilpPilILilKTilaHilaLilZbilZXilaPilZHilZfilZ3ilZzilZvilJDilJTilLTilKzilJzilIDilLzilZ7ilZ/ilZrilZTilanilabilaDilZDilazilafilajilaTilaXilZnilZjilZLilZPilavilarilJjilIzilojiloTilozilpDiloDOscOfzpPPgM6jz4PCtc+EzqbOmM6pzrTiiJ7Phs614oip4omhwrHiiaXiiaTijKDijKHDt+KJiMKw4oiZwrfiiJrigb/CsuKWoMKgXCJcbiAgfSxcbiAgXCJpYm04NjFcIjogXCJjcDg2MVwiLFxuICBcImNzaWJtODYxXCI6IFwiY3A4NjFcIixcbiAgXCJjcDg2MlwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi15DXkdeS15PXlNeV15bXl9eY15nXmteb15zXndee15/XoNeh16LXo9ek16XXpten16jXqdeqwqLCo8Kl4oKnxpLDocOtw7PDusOxw5HCqsK6wr/ijJDCrMK9wrzCocKrwrvilpHilpLilpPilILilKTilaHilaLilZbilZXilaPilZHilZfilZ3ilZzilZvilJDilJTilLTilKzilJzilIDilLzilZ7ilZ/ilZrilZTilanilabilaDilZDilazilafilajilaTilaXilZnilZjilZLilZPilavilarilJjilIzilojiloTilozilpDiloDOscOfzpPPgM6jz4PCtc+EzqbOmM6pzrTiiJ7Phs614oip4omhwrHiiaXiiaTijKDijKHDt+KJiMKw4oiZwrfiiJrigb/CsuKWoMKgXCJcbiAgfSxcbiAgXCJpYm04NjJcIjogXCJjcDg2MlwiLFxuICBcImNzaWJtODYyXCI6IFwiY3A4NjJcIixcbiAgXCJjcDg2M1wiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiw4fDvMOpw6LDgsOgwrbDp8Oqw6vDqMOvw67igJfDgMKnw4nDiMOKw7TDi8OPw7vDucKkw5TDnMKiwqPDmcObxpLCpsK0w7PDusKowrjCs8Kvw47ijJDCrMK9wrzCvsKrwrvilpHilpLilpPilILilKTilaHilaLilZbilZXilaPilZHilZfilZ3ilZzilZvilJDilJTilLTilKzilJzilIDilLzilZ7ilZ/ilZrilZTilanilabilaDilZDilazilafilajilaTilaXilZnilZjilZLilZPilavilarilJjilIzilojiloTilozilpDiloDOscOfzpPPgM6jz4PCtc+EzqbOmM6pzrTiiJ7Phs614oip4omhwrHiiaXiiaTijKDijKHDt+KJiMKw4oiZwrfiiJrigb/CsuKWoMKgXCJcbiAgfSxcbiAgXCJpYm04NjNcIjogXCJjcDg2M1wiLFxuICBcImNzaWJtODYzXCI6IFwiY3A4NjNcIixcbiAgXCJjcDg2NFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiXFx1MDAwMFxcdTAwMDFcXHUwMDAyXFx1MDAwM1xcdTAwMDRcXHUwMDA1XFx1MDAwNlxcdTAwMDdcXGJcXHRcXG5cXHUwMDBiXFxmXFxyXFx1MDAwZVxcdTAwMGZcXHUwMDEwXFx1MDAxMVxcdTAwMTJcXHUwMDEzXFx1MDAxNFxcdTAwMTVcXHUwMDE2XFx1MDAxN1xcdTAwMThcXHUwMDE5XFx1MDAxYVxcdTAwMWJcXHUwMDFjXFx1MDAxZFxcdTAwMWVcXHUwMDFmICFcXFwiIyTZqiYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xcXFxdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f8KwwrfiiJniiJrilpLilIDilILilLzilKTilKzilJzilLTilJDilIzilJTilJjOsuKIns+GwrHCvcK84omIwqvCu++7t++7uO+/ve+/ve+7u++7vO+/vcKgwq3vuoLCo8Kk77qE77+977+977qO77qP77qV77qZ2Izvup3vuqHvuqXZoNmh2aLZo9mk2aXZptmn2ajZqe+7kdib77qx77q177q52J/Cou+6gO+6ge+6g++6he+7iu+6i++6je+6ke+6k++6l++6m++6n++6o++6p++6qe+6q++6re+6r++6s++6t++6u++6v++7ge+7he+7i++7j8KmwqzDt8OX77uJ2YDvu5Pvu5fvu5vvu5/vu6Pvu6fvu6vvu63vu6/vu7Pvur3vu4zvu47vu43vu6Hvub3Zke+7pe+7qe+7rO+7sO+7su+7kO+7le+7te+7tu+7ne+7me+7seKWoO+/vVwiXG4gIH0sXG4gIFwiaWJtODY0XCI6IFwiY3A4NjRcIixcbiAgXCJjc2libTg2NFwiOiBcImNwODY0XCIsXG4gIFwiY3A4NjVcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsOHw7zDqcOiw6TDoMOlw6fDqsOrw6jDr8Ouw6zDhMOFw4nDpsOGw7TDtsOyw7vDucO/w5bDnMO4wqPDmOKCp8aSw6HDrcOzw7rDscORwqrCusK/4oyQwqzCvcK8wqHCq8Kk4paR4paS4paT4pSC4pSk4pWh4pWi4pWW4pWV4pWj4pWR4pWX4pWd4pWc4pWb4pSQ4pSU4pS04pSs4pSc4pSA4pS84pWe4pWf4pWa4pWU4pWp4pWm4pWg4pWQ4pWs4pWn4pWo4pWk4pWl4pWZ4pWY4pWS4pWT4pWr4pWq4pSY4pSM4paI4paE4paM4paQ4paAzrHDn86Tz4DOo8+DwrXPhM6mzpjOqc604oiez4bOteKIqeKJocKx4oml4omk4oyg4oyhw7fiiYjCsOKImcK34oia4oG/wrLilqDCoFwiXG4gIH0sXG4gIFwiaWJtODY1XCI6IFwiY3A4NjVcIixcbiAgXCJjc2libTg2NVwiOiBcImNwODY1XCIsXG4gIFwiY3A4NjZcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcItCQ0JHQktCT0JTQldCW0JfQmNCZ0JrQm9Cc0J3QntCf0KDQodCi0KPQpNCl0KbQp9Co0KnQqtCr0KzQrdCu0K/QsNCx0LLQs9C00LXQttC30LjQudC60LvQvNC90L7Qv+KWkeKWkuKWk+KUguKUpOKVoeKVouKVluKVleKVo+KVkeKVl+KVneKVnOKVm+KUkOKUlOKUtOKUrOKUnOKUgOKUvOKVnuKVn+KVmuKVlOKVqeKVpuKVoOKVkOKVrOKVp+KVqOKVpOKVpeKVmeKVmOKVkuKVk+KVq+KVquKUmOKUjOKWiOKWhOKWjOKWkOKWgNGA0YHRgtGD0YTRhdGG0YfRiNGJ0YrRi9GM0Y3RjtGP0IHRkdCE0ZTQh9GX0I7RnsKw4oiZwrfiiJrihJbCpOKWoMKgXCJcbiAgfSxcbiAgXCJpYm04NjZcIjogXCJjcDg2NlwiLFxuICBcImNzaWJtODY2XCI6IFwiY3A4NjZcIixcbiAgXCJjcDg2OVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi77+977+977+977+977+977+9zobvv73Ct8KswqbigJjigJnOiOKAlc6JzorOqs6M77+977+9zo7Oq8Kpzo/CssKzzqzCo86tzq7Or8+KzpDPjM+NzpHOks6TzpTOlc6WzpfCvc6YzpnCq8K74paR4paS4paT4pSC4pSkzprOm86czp3ilaPilZHilZfilZ3Ons6f4pSQ4pSU4pS04pSs4pSc4pSA4pS8zqDOoeKVmuKVlOKVqeKVpuKVoOKVkOKVrM6jzqTOpc6mzqfOqM6pzrHOss6z4pSY4pSM4paI4paEzrTOteKWgM62zrfOuM65zrrOu868zr3Ovs6/z4DPgc+Dz4LPhM6Ewq3Csc+Fz4bPh8Knz4jOhcKwwqjPic+LzrDPjuKWoMKgXCJcbiAgfSxcbiAgXCJpYm04NjlcIjogXCJjcDg2OVwiLFxuICBcImNzaWJtODY5XCI6IFwiY3A4NjlcIixcbiAgXCJjcDkyMlwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8KgwqHCosKjwqTCpcKmwqfCqMKpwqrCq8Kswq3CruKAvsKwwrHCssKzwrTCtcK2wrfCuMK5wrrCu8K8wr3CvsK/w4DDgcOCw4PDhMOFw4bDh8OIw4nDisOLw4zDjcOOw4/FoMORw5LDk8OUw5XDlsOXw5jDmcOaw5vDnMOdxb3Dn8Ogw6HDosOjw6TDpcOmw6fDqMOpw6rDq8Osw63DrsOvxaHDscOyw7PDtMO1w7bDt8O4w7nDusO7w7zDvcW+w79cIlxuICB9LFxuICBcImlibTkyMlwiOiBcImNwOTIyXCIsXG4gIFwiY3NpYm05MjJcIjogXCJjcDkyMlwiLFxuICBcImNwMTA0NlwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi77qIw5fDt++jtu+jte+jtO+jt++5scKI4pag4pSC4pSA4pSQ4pSM4pSU4pSY77m577m777m977m/77m377qK77uw77uz77uy77uO77uP77uQ77u277u477u677u8wqDvo7rvo7nvo7jCpO+ju++6i++6ke+6l++6m++6n++6o9iMwq3vuqfvurPZoNmh2aLZo9mk2aXZptmn2ajZqe+6t9ib77q777q/77uK2J/vu4vYodii2KPYpNil2KbYp9io2KnYqtir2KzYrdiu2K/YsNix2LLYs9i02LXYtti377uH2LnYuu+7jO+6gu+6hO+6ju+7k9mA2YHZgtmD2YTZhdmG2YfZiNmJ2YrZi9mM2Y3ZjtmP2ZDZkdmS77uX77ub77uf76O877u177u377u577u777uj77un77us77up77+9XCJcbiAgfSxcbiAgXCJpYm0xMDQ2XCI6IFwiY3AxMDQ2XCIsXG4gIFwiY3NpYm0xMDQ2XCI6IFwiY3AxMDQ2XCIsXG4gIFwiY3AxMTI0XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCgMKBwoLCg8KEwoXChsKHwojCicKKwovCjMKNwo7Cj8KQwpHCksKTwpTClcKWwpfCmMKZwprCm8Kcwp3CnsKfwqDQgdCC0pDQhNCF0IbQh9CI0InQitCL0IzCrdCO0I/QkNCR0JLQk9CU0JXQltCX0JjQmdCa0JvQnNCd0J7Qn9Cg0KHQotCj0KTQpdCm0KfQqNCp0KrQq9Cs0K3QrtCv0LDQsdCy0LPQtNC10LbQt9C40LnQutC70LzQvdC+0L/RgNGB0YLRg9GE0YXRhtGH0YjRidGK0YvRjNGN0Y7Rj+KEltGR0ZLSkdGU0ZXRltGX0ZjRmdGa0ZvRnMKn0Z7Rn1wiXG4gIH0sXG4gIFwiaWJtMTEyNFwiOiBcImNwMTEyNFwiLFxuICBcImNzaWJtMTEyNFwiOiBcImNwMTEyNFwiLFxuICBcImNwMTEyNVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi0JDQkdCS0JPQlNCV0JbQl9CY0JnQmtCb0JzQndCe0J/QoNCh0KLQo9Ck0KXQptCn0KjQqdCq0KvQrNCt0K7Qr9Cw0LHQstCz0LTQtdC20LfQuNC50LrQu9C80L3QvtC/4paR4paS4paT4pSC4pSk4pWh4pWi4pWW4pWV4pWj4pWR4pWX4pWd4pWc4pWb4pSQ4pSU4pS04pSs4pSc4pSA4pS84pWe4pWf4pWa4pWU4pWp4pWm4pWg4pWQ4pWs4pWn4pWo4pWk4pWl4pWZ4pWY4pWS4pWT4pWr4pWq4pSY4pSM4paI4paE4paM4paQ4paA0YDRgdGC0YPRhNGF0YbRh9GI0YnRitGL0YzRjdGO0Y/QgdGR0pDSkdCE0ZTQhtGW0IfRl8K34oia4oSWwqTilqDCoFwiXG4gIH0sXG4gIFwiaWJtMTEyNVwiOiBcImNwMTEyNVwiLFxuICBcImNzaWJtMTEyNVwiOiBcImNwMTEyNVwiLFxuICBcImNwMTEyOVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8KgwqHCosKjwqTCpcKmwqfFk8KpwqrCq8Kswq3CrsKvwrDCscKywrPFuMK1wrbCt8WSwrnCusK7wrzCvcK+wr/DgMOBw4LEgsOEw4XDhsOHw4jDicOKw4vMgMONw47Dj8SQw5HMicOTw5TGoMOWw5fDmMOZw5rDm8Ocxq/Mg8Ofw6DDocOixIPDpMOlw6bDp8Oow6nDqsOrzIHDrcOuw6/EkcOxzKPDs8O0xqHDtsO3w7jDucO6w7vDvMaw4oKrw79cIlxuICB9LFxuICBcImlibTExMjlcIjogXCJjcDExMjlcIixcbiAgXCJjc2libTExMjlcIjogXCJjcDExMjlcIixcbiAgXCJjcDExMzNcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHCgsKDwoTChcKGwofCiMKJworCi8KMwo3CjsKPwpDCkcKSwpPClMKVwpbCl8KYwpnCmsKbwpzCncKewp/CoOC6geC6guC6hOC6h+C6iOC6quC6iuC6jeC6lOC6leC6luC6l+C6meC6muC6m+C6nOC6neC6nuC6n+C6oeC6ouC6o+C6peC6p+C6q+C6reC6ru+/ve+/ve+/veC6r+C6sOC6suC6s+C6tOC6teC6tuC6t+C6uOC6ueC6vOC6seC6u+C6ve+/ve+/ve+/veC7gOC7geC7guC7g+C7hOC7iOC7ieC7iuC7i+C7jOC7jeC7hu+/veC7nOC7neKCre+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/veC7kOC7keC7kuC7k+C7lOC7leC7luC7l+C7mOC7me+/ve+/vcKiwqzCpu+/vVwiXG4gIH0sXG4gIFwiaWJtMTEzM1wiOiBcImNwMTEzM1wiLFxuICBcImNzaWJtMTEzM1wiOiBcImNwMTEzM1wiLFxuICBcImNwMTE2MVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi77+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+94LmI4LiB4LiC4LiD4LiE4LiF4LiG4LiH4LiI4LiJ4LiK4LiL4LiM4LiN4LiO4LiP4LiQ4LiR4LiS4LiT4LiU4LiV4LiW4LiX4LiY4LiZ4Lia4Lib4Lic4Lid4Lie4Lif4Lig4Lih4Lii4Lij4Lik4Lil4Lim4Lin4Lio4Lip4Liq4Lir4Lis4Lit4Liu4Liv4Liw4Lix4Liy4Liz4Li04Li14Li24Li34Li44Li54Li64LmJ4LmK4LmL4oKs4Li/4LmA4LmB4LmC4LmD4LmE4LmF4LmG4LmH4LmI4LmJ4LmK4LmL4LmM4LmN4LmO4LmP4LmQ4LmR4LmS4LmT4LmU4LmV4LmW4LmX4LmY4LmZ4Lma4LmbwqLCrMKmwqBcIlxuICB9LFxuICBcImlibTExNjFcIjogXCJjcDExNjFcIixcbiAgXCJjc2libTExNjFcIjogXCJjcDExNjFcIixcbiAgXCJjcDExNjJcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIuKCrMKBwoLCg8KE4oCmwobCh8KIwonCisKLwozCjcKOwo/CkOKAmOKAmeKAnOKAneKAouKAk+KAlMKYwpnCmsKbwpzCncKewp/CoOC4geC4guC4g+C4hOC4heC4huC4h+C4iOC4ieC4iuC4i+C4jOC4jeC4juC4j+C4kOC4keC4kuC4k+C4lOC4leC4luC4l+C4mOC4meC4muC4m+C4nOC4neC4nuC4n+C4oOC4oeC4ouC4o+C4pOC4peC4puC4p+C4qOC4qeC4quC4q+C4rOC4reC4ruC4r+C4sOC4seC4suC4s+C4tOC4teC4tuC4t+C4uOC4ueC4uu+/ve+/ve+/ve+/veC4v+C5gOC5geC5guC5g+C5hOC5heC5huC5h+C5iOC5ieC5iuC5i+C5jOC5jeC5juC5j+C5kOC5keC5kuC5k+C5lOC5leC5luC5l+C5mOC5meC5muC5m++/ve+/ve+/ve+/vVwiXG4gIH0sXG4gIFwiaWJtMTE2MlwiOiBcImNwMTE2MlwiLFxuICBcImNzaWJtMTE2MlwiOiBcImNwMTE2MlwiLFxuICBcImNwMTE2M1wiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8KgwqHCosKj4oKswqXCpsKnxZPCqcKqwqvCrMKtwq7Cr8KwwrHCssKzxbjCtcK2wrfFksK5wrrCu8K8wr3CvsK/w4DDgcOCxILDhMOFw4bDh8OIw4nDisOLzIDDjcOOw4/EkMORzInDk8OUxqDDlsOXw5jDmcOaw5vDnMavzIPDn8Ogw6HDosSDw6TDpcOmw6fDqMOpw6rDq8yBw63DrsOvxJHDscyjw7PDtMahw7bDt8O4w7nDusO7w7zGsOKCq8O/XCJcbiAgfSxcbiAgXCJpYm0xMTYzXCI6IFwiY3AxMTYzXCIsXG4gIFwiY3NpYm0xMTYzXCI6IFwiY3AxMTYzXCIsXG4gIFwibWFjY3JvYXRpYW5cIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsOEw4XDh8OJw5HDlsOcw6HDoMOiw6TDo8Olw6fDqcOow6rDq8Otw6zDrsOvw7HDs8Oyw7TDtsO1w7rDucO7w7zigKDCsMKiwqPCp+KAosK2w5/CrsWg4oSiwrTCqOKJoMW9w5jiiJ7CseKJpOKJpeKIhsK14oiC4oiR4oiPxaHiiKvCqsK64oSmxb7DuMK/wqHCrOKImsaS4omIxIbCq8SM4oCmwqDDgMODw5XFksWTxJDigJTigJzigJ3igJjigJnDt+KXiu+/vcKp4oGEwqTigLnigLrDhsK74oCTwrfigJrigJ7igLDDgsSHw4HEjcOIw43DjsOPw4zDk8OUxJHDksOaw5vDmcSxy4bLnMKvz4DDi8uawrjDisOmy4dcIlxuICB9LFxuICBcIm1hY2N5cmlsbGljXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLQkNCR0JLQk9CU0JXQltCX0JjQmdCa0JvQnNCd0J7Qn9Cg0KHQotCj0KTQpdCm0KfQqNCp0KrQq9Cs0K3QrtCv4oCgwrDCosKjwqfigKLCttCGwq7CqeKEotCC0ZLiiaDQg9GT4oiewrHiiaTiiaXRlsK14oiC0IjQhNGU0IfRl9CJ0ZnQitGa0ZjQhcKs4oiaxpLiiYjiiIbCq8K74oCmwqDQi9Gb0IzRnNGV4oCT4oCU4oCc4oCd4oCY4oCZw7figJ7QjtGe0I/Rn+KEltCB0ZHRj9Cw0LHQstCz0LTQtdC20LfQuNC50LrQu9C80L3QvtC/0YDRgdGC0YPRhNGF0YbRh9GI0YnRitGL0YzRjdGOwqRcIlxuICB9LFxuICBcIm1hY2dyZWVrXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLDhMK5wrLDicKzw5bDnM6Fw6DDosOkzoTCqMOnw6nDqMOqw6vCo+KEosOuw6/igKLCveKAsMO0w7bCpsKtw7nDu8O84oCgzpPOlM6YzpvOns6gw5/CrsKpzqPOqsKn4omgwrDOh86RwrHiiaTiiaXCpc6SzpXOls6XzpnOms6czqbOq86ozqnOrM6dwqzOn86h4omIzqTCq8K74oCmwqDOpc6nzobOiMWT4oCT4oCV4oCc4oCd4oCY4oCZw7fOic6KzozOjs6tzq7Or8+Mzo/Pjc6xzrLPiM60zrXPhs6zzrfOuc6+zrrOu868zr3Ov8+Az47Pgc+Dz4TOuM+Jz4LPh8+FzrbPis+LzpDOsO+/vVwiXG4gIH0sXG4gIFwibWFjaWNlbGFuZFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiw4TDhcOHw4nDkcOWw5zDocOgw6LDpMOjw6XDp8Opw6jDqsOrw63DrMOuw6/DscOzw7LDtMO2w7XDusO5w7vDvMOdwrDCosKjwqfigKLCtsOfwq7CqeKEosK0wqjiiaDDhsOY4oiewrHiiaTiiaXCpcK14oiC4oiR4oiPz4DiiKvCqsK64oSmw6bDuMK/wqHCrOKImsaS4omI4oiGwqvCu+KApsKgw4DDg8OVxZLFk+KAk+KAlOKAnOKAneKAmOKAmcO34peKw7/FuOKBhMKkw5DDsMOew77DvcK34oCa4oCe4oCww4LDisOBw4vDiMONw47Dj8OMw5PDlO+/vcOSw5rDm8OZxLHLhsucwq/LmMuZy5rCuMudy5vLh1wiXG4gIH0sXG4gIFwibWFjcm9tYW5cIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsOEw4XDh8OJw5HDlsOcw6HDoMOiw6TDo8Olw6fDqcOow6rDq8Otw6zDrsOvw7HDs8Oyw7TDtsO1w7rDucO7w7zigKDCsMKiwqPCp+KAosK2w5/CrsKp4oSiwrTCqOKJoMOGw5jiiJ7CseKJpOKJpcKlwrXiiILiiJHiiI/PgOKIq8KqwrrihKbDpsO4wr/CocKs4oiaxpLiiYjiiIbCq8K74oCmwqDDgMODw5XFksWT4oCT4oCU4oCc4oCd4oCY4oCZw7fil4rDv8W44oGEwqTigLnigLrvrIHvrILigKHCt+KAmuKAnuKAsMOCw4rDgcOLw4jDjcOOw4/DjMOTw5Tvv73DksOaw5vDmcSxy4bLnMKvy5jLmcuawrjLncuby4dcIlxuICB9LFxuICBcIm1hY3JvbWFuaWFcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsOEw4XDh8OJw5HDlsOcw6HDoMOiw6TDo8Olw6fDqcOow6rDq8Otw6zDrsOvw7HDs8Oyw7TDtsO1w7rDucO7w7zigKDCsMKiwqPCp+KAosK2w5/CrsKp4oSiwrTCqOKJoMSCxZ7iiJ7CseKJpOKJpcKlwrXiiILiiJHiiI/PgOKIq8KqwrrihKbEg8Wfwr/CocKs4oiaxpLiiYjiiIbCq8K74oCmwqDDgMODw5XFksWT4oCT4oCU4oCc4oCd4oCY4oCZw7fil4rDv8W44oGEwqTigLnigLrFosWj4oChwrfigJrigJ7igLDDgsOKw4HDi8OIw43DjsOPw4zDk8OU77+9w5LDmsObw5nEscuGy5zCr8uYy5nLmsK4y53Lm8uHXCJcbiAgfSxcbiAgXCJtYWN0aGFpXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCq8K74oCm76KM76KP76KS76KV76KY76KL76KO76KR76KU76KX4oCc4oCd76KZ77+94oCi76KE76KJ76KF76KG76KH76KI76KK76KN76KQ76KT76KW4oCY4oCZ77+9wqDguIHguILguIPguITguIXguIbguIfguIjguInguIrguIvguIzguI3guI7guI/guJDguJHguJLguJPguJTguJXguJbguJfguJjguJnguJrguJvguJzguJ3guJ7guJ/guKDguKHguKLguKPguKTguKXguKbguKfguKjguKnguKrguKvguKzguK3guK7guK/guLDguLHguLLguLPguLTguLXguLbguLfguLjguLnguLrvu7/igIvigJPigJTguL/guYDguYHguYLguYPguYTguYXguYbguYfguYjguYnguYrguYvguYzguY3ihKLguY/guZDguZHguZLguZPguZTguZXguZbguZfguZjguZnCrsKp77+977+977+977+9XCJcbiAgfSxcbiAgXCJtYWN0dXJraXNoXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLDhMOFw4fDicORw5bDnMOhw6DDosOkw6PDpcOnw6nDqMOqw6vDrcOsw67Dr8Oxw7PDssO0w7bDtcO6w7nDu8O84oCgwrDCosKjwqfigKLCtsOfwq7CqeKEosK0wqjiiaDDhsOY4oiewrHiiaTiiaXCpcK14oiC4oiR4oiPz4DiiKvCqsK64oSmw6bDuMK/wqHCrOKImsaS4omI4oiGwqvCu+KApsKgw4DDg8OVxZLFk+KAk+KAlOKAnOKAneKAmOKAmcO34peKw7/FuMSexJ/EsMSxxZ7Fn+KAocK34oCa4oCe4oCww4LDisOBw4vDiMONw47Dj8OMw5PDlO+/vcOSw5rDm8OZ77+9y4bLnMKvy5jLmcuawrjLncuby4dcIlxuICB9LFxuICBcIm1hY3VrcmFpbmVcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcItCQ0JHQktCT0JTQldCW0JfQmNCZ0JrQm9Cc0J3QntCf0KDQodCi0KPQpNCl0KbQp9Co0KnQqtCr0KzQrdCu0K/igKDCsNKQwqPCp+KAosK20IbCrsKp4oSi0ILRkuKJoNCD0ZPiiJ7CseKJpOKJpdGWwrXSkdCI0ITRlNCH0ZfQidGZ0IrRmtGY0IXCrOKImsaS4omI4oiGwqvCu+KApsKg0IvRm9CM0ZzRleKAk+KAlOKAnOKAneKAmOKAmcO34oCe0I7RntCP0Z/ihJbQgdGR0Y/QsNCx0LLQs9C00LXQttC30LjQudC60LvQvNC90L7Qv9GA0YHRgtGD0YTRhdGG0YfRiNGJ0YrRi9GM0Y3RjsKkXCJcbiAgfSxcbiAgXCJrb2k4clwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4pSA4pSC4pSM4pSQ4pSU4pSY4pSc4pSk4pSs4pS04pS84paA4paE4paI4paM4paQ4paR4paS4paT4oyg4pag4oiZ4oia4omI4omk4omlwqDijKHCsMKywrfDt+KVkOKVkeKVktGR4pWT4pWU4pWV4pWW4pWX4pWY4pWZ4pWa4pWb4pWc4pWd4pWe4pWf4pWg4pWh0IHilaLilaPilaTilaXilabilafilajilanilarilavilazCqdGO0LDQsdGG0LTQtdGE0LPRhdC40LnQutC70LzQvdC+0L/Rj9GA0YHRgtGD0LbQstGM0YvQt9GI0Y3RidGH0YrQrtCQ0JHQptCU0JXQpNCT0KXQmNCZ0JrQm9Cc0J3QntCf0K/QoNCh0KLQo9CW0JLQrNCr0JfQqNCt0KnQp9CqXCJcbiAgfSxcbiAgXCJrb2k4dVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi4pSA4pSC4pSM4pSQ4pSU4pSY4pSc4pSk4pSs4pS04pS84paA4paE4paI4paM4paQ4paR4paS4paT4oyg4pag4oiZ4oia4omI4omk4omlwqDijKHCsMKywrfDt+KVkOKVkeKVktGR0ZTilZTRltGX4pWX4pWY4pWZ4pWa4pWb0pHilZ3ilZ7ilZ/ilaDilaHQgdCE4pWj0IbQh+KVpuKVp+KVqOKVqeKVqtKQ4pWswqnRjtCw0LHRhtC00LXRhNCz0YXQuNC50LrQu9C80L3QvtC/0Y/RgNGB0YLRg9C20LLRjNGL0LfRiNGN0YnRh9GK0K7QkNCR0KbQlNCV0KTQk9Cl0JjQmdCa0JvQnNCd0J7Qn9Cv0KDQodCi0KPQltCS0KzQq9CX0KjQrdCp0KfQqlwiXG4gIH0sXG4gIFwia29pOHJ1XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLilIDilILilIzilJDilJTilJjilJzilKTilKzilLTilLziloDiloTilojilozilpDilpHilpLilpPijKDilqDiiJniiJriiYjiiaTiiaXCoOKMocKwwrLCt8O34pWQ4pWR4pWS0ZHRlOKVlNGW0ZfilZfilZjilZnilZrilZvSkdGe4pWe4pWf4pWg4pWh0IHQhOKVo9CG0IfilabilafilajilanilarSkNCOwqnRjtCw0LHRhtC00LXRhNCz0YXQuNC50LrQu9C80L3QvtC/0Y/RgNGB0YLRg9C20LLRjNGL0LfRiNGN0YnRh9GK0K7QkNCR0KbQlNCV0KTQk9Cl0JjQmdCa0JvQnNCd0J7Qn9Cv0KDQodCi0KPQltCS0KzQq9CX0KjQrdCp0KfQqlwiXG4gIH0sXG4gIFwia29pOHRcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcItKb0pPigJrSkuKAnuKApuKAoOKAoe+/veKAsNKz4oC50rLSt9K277+90prigJjigJnigJzigJ3igKLigJPigJTvv73ihKLvv73igLrvv73vv73vv73vv73vv73Tr9Ou0ZHCpNOjwqbCp++/ve+/ve+/vcKrwqzCrcKu77+9wrDCscKy0IHvv73TosK2wrfvv73ihJbvv73Cu++/ve+/ve+/vcKp0Y7QsNCx0YbQtNC10YTQs9GF0LjQudC60LvQvNC90L7Qv9GP0YDRgdGC0YPQttCy0YzRi9C30YjRjdGJ0YfRitCu0JDQkdCm0JTQldCk0JPQpdCY0JnQmtCb0JzQndCe0J/Qr9Cg0KHQotCj0JbQktCs0KvQl9Co0K3QqdCn0KpcIlxuICB9LFxuICBcImFybXNjaWk4XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLCgMKBwoLCg8KEwoXChsKHwojCicKKwovCjMKNwo7Cj8KQwpHCksKTwpTClcKWwpfCmMKZwprCm8Kcwp3CnsKfwqDvv73Wh9aJKSjCu8Kr4oCULtWdLC3WiuKAptWc1ZvVntSx1aHUstWi1LPVo9S01aTUtdWl1LbVptS31afUuNWo1LnVqdS61arUu9Wr1LzVrNS91a3UvtWu1L/Vr9WA1bDVgdWx1YLVstWD1bPVhNW01YXVtdWG1bbVh9W31YjVuNWJ1bnVitW61YvVu9WM1bzVjdW91Y7VvtWP1b/VkNaA1ZHWgdWS1oLVk9aD1ZTWhNWV1oXVltaG1Zrvv71cIlxuICB9LFxuICBcInJrMTA0OFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwi0ILQg+KAmtGT4oCe4oCm4oCg4oCh4oKs4oCw0InigLnQitKa0rrQj9GS4oCY4oCZ4oCc4oCd4oCi4oCT4oCU77+94oSi0ZnigLrRmtKb0rvRn8Kg0rDSsdOYwqTTqMKmwqfQgcKp0pLCq8Kswq3CrtKuwrDCsdCG0ZbTqcK1wrbCt9GR4oSW0pPCu9OZ0qLSo9Kv0JDQkdCS0JPQlNCV0JbQl9CY0JnQmtCb0JzQndCe0J/QoNCh0KLQo9Ck0KXQptCn0KjQqdCq0KvQrNCt0K7Qr9Cw0LHQstCz0LTQtdC20LfQuNC50LrQu9C80L3QvtC/0YDRgdGC0YPRhNGF0YbRh9GI0YnRitGL0YzRjdGO0Y9cIlxuICB9LFxuICBcInRjdm5cIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIlxcdTAwMDDDmuG7pFxcdTAwMDPhu6rhu6zhu65cXHUwMDA3XFxiXFx0XFxuXFx1MDAwYlxcZlxcclxcdTAwMGVcXHUwMDBmXFx1MDAxMOG7qOG7sOG7suG7tuG7uMOd4bu0XFx1MDAxOFxcdTAwMTlcXHUwMDFhXFx1MDAxYlxcdTAwMWNcXHUwMDFkXFx1MDAxZVxcdTAwMWYgIVxcXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXFxcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn/DgOG6osODw4HhuqDhurbhuqzDiOG6uuG6vMOJ4bq44buGw4zhu4jEqMON4buKw5Lhu47DlcOT4buM4buY4buc4bue4bug4bua4buiw5nhu6bFqMKgxILDgsOKw5TGoMavxJDEg8Oiw6rDtMahxrDEkeG6sMyAzInMg8yBzKPDoOG6o8Ojw6HhuqHhurLhurHhurPhurXhuq/hurThuq7huqbhuqjhuqrhuqThu4DhurfhuqfhuqnhuqvhuqXhuq3DqOG7guG6u+G6vcOp4bq54buB4buD4buF4bq/4buHw6zhu4nhu4Thur7hu5LEqcOt4buLw7Lhu5Thu4/DtcOz4buN4buT4buV4buX4buR4buZ4bud4buf4buh4bub4bujw7nhu5bhu6fFqcO64bul4bur4but4buv4bup4bux4buz4bu34bu5w73hu7Xhu5BcIlxuICB9LFxuICBcImdlb3JnaWFuYWNhZGVteVwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgeKAmsaS4oCe4oCm4oCg4oChy4bigLDFoOKAucWSwo3CjsKPwpDigJjigJnigJzigJ3igKLigJPigJTLnOKEosWh4oC6xZPCncKexbjCoMKhwqLCo8KkwqXCpsKnwqjCqcKqwqvCrMKtwq7Cr8KwwrHCssKzwrTCtcK2wrfCuMK5wrrCu8K8wr3CvsK/4YOQ4YOR4YOS4YOT4YOU4YOV4YOW4YOX4YOY4YOZ4YOa4YOb4YOc4YOd4YOe4YOf4YOg4YOh4YOi4YOj4YOk4YOl4YOm4YOn4YOo4YOp4YOq4YOr4YOs4YOt4YOu4YOv4YOw4YOx4YOy4YOz4YO04YO14YO2w6fDqMOpw6rDq8Osw63DrsOvw7DDscOyw7PDtMO1w7bDt8O4w7nDusO7w7zDvcO+w79cIlxuICB9LFxuICBcImdlb3JnaWFucHNcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIsKAwoHigJrGkuKAnuKApuKAoOKAocuG4oCwxaDigLnFksKNwo7Cj8KQ4oCY4oCZ4oCc4oCd4oCi4oCT4oCUy5zihKLFoeKAusWTwp3CnsW4wqDCocKiwqPCpMKlwqbCp8KowqnCqsKrwqzCrcKuwq/CsMKxwrLCs8K0wrXCtsK3wrjCucK6wrvCvMK9wr7Cv+GDkOGDkeGDkuGDk+GDlOGDleGDluGDseGDl+GDmOGDmeGDmuGDm+GDnOGDsuGDneGDnuGDn+GDoOGDoeGDouGDs+GDo+GDpOGDpeGDpuGDp+GDqOGDqeGDquGDq+GDrOGDreGDruGDtOGDr+GDsOGDtcOmw6fDqMOpw6rDq8Osw63DrsOvw7DDscOyw7PDtMO1w7bDt8O4w7nDusO7w7zDvcO+w79cIlxuICB9LFxuICBcInB0MTU0XCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLSltKS067Sk+KAnuKAptK20q7SstKv0qDTotKi0prSutK40pfigJjigJnigJzigJ3igKLigJPigJTSs9K30qHTo9Kj0pvSu9K5wqDQjtGe0IjTqNKY0rDCp9CBwqnTmMKrwqzTr8Ku0pzCsNKx0IbRltKZ06nCtsK30ZHihJbTmcK70ZjSqtKr0p3QkNCR0JLQk9CU0JXQltCX0JjQmdCa0JvQnNCd0J7Qn9Cg0KHQotCj0KTQpdCm0KfQqNCp0KrQq9Cs0K3QrtCv0LDQsdCy0LPQtNC10LbQt9C40LnQutC70LzQvdC+0L/RgNGB0YLRg9GE0YXRhtGH0YjRidGK0YvRjNGN0Y7Rj1wiXG4gIH0sXG4gIFwidmlzY2lpXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCJcXHUwMDAwXFx1MDAwMeG6slxcdTAwMDNcXHUwMDA04bq04bqqXFx1MDAwN1xcYlxcdFxcblxcdTAwMGJcXGZcXHJcXHUwMDBlXFx1MDAwZlxcdTAwMTBcXHUwMDExXFx1MDAxMlxcdTAwMTPhu7ZcXHUwMDE1XFx1MDAxNlxcdTAwMTdcXHUwMDE44bu4XFx1MDAxYVxcdTAwMWJcXHUwMDFjXFx1MDAxZOG7tFxcdTAwMWYgIVxcXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXFxcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn/huqDhuq7hurDhurbhuqThuqbhuqjhuqzhurzhurjhur7hu4Dhu4Lhu4Thu4bhu5Dhu5Lhu5Thu5bhu5jhu6Lhu5rhu5zhu57hu4rhu47hu4zhu4jhu6bFqOG7pOG7ssOV4bqv4bqx4bq34bql4bqn4bqp4bqt4bq94bq54bq/4buB4buD4buF4buH4buR4buT4buV4buX4bugxqDhu5nhu53hu5/hu4vhu7Dhu6jhu6rhu6zGoeG7m8avw4DDgcOCw4PhuqLEguG6s+G6tcOIw4nDiuG6usOMw43EqOG7s8SQ4bupw5LDk8OU4bqh4bu34bur4butw5nDmuG7ueG7tcOd4buhxrDDoMOhw6LDo+G6o8SD4buv4bqrw6jDqcOq4bq7w6zDrcSp4buJxJHhu7HDssOzw7TDteG7j+G7jeG7pcO5w7rFqeG7p8O94buj4buuXCJcbiAgfSxcbiAgXCJpc282NDZjblwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiXFx1MDAwMFxcdTAwMDFcXHUwMDAyXFx1MDAwM1xcdTAwMDRcXHUwMDA1XFx1MDAwNlxcdTAwMDdcXGJcXHRcXG5cXHUwMDBiXFxmXFxyXFx1MDAwZVxcdTAwMGZcXHUwMDEwXFx1MDAxMVxcdTAwMTJcXHUwMDEzXFx1MDAxNFxcdTAwMTVcXHUwMDE2XFx1MDAxN1xcdTAwMThcXHUwMDE5XFx1MDAxYVxcdTAwMWJcXHUwMDFjXFx1MDAxZFxcdTAwMWVcXHUwMDFmICFcXFwiI8KlJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xcXFxdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH3igL5/77+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+9XCJcbiAgfSxcbiAgXCJpc282NDZqcFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiXFx1MDAwMFxcdTAwMDFcXHUwMDAyXFx1MDAwM1xcdTAwMDRcXHUwMDA1XFx1MDAwNlxcdTAwMDdcXGJcXHRcXG5cXHUwMDBiXFxmXFxyXFx1MDAwZVxcdTAwMGZcXHUwMDEwXFx1MDAxMVxcdTAwMTJcXHUwMDEzXFx1MDAxNFxcdTAwMTVcXHUwMDE2XFx1MDAxN1xcdTAwMThcXHUwMDE5XFx1MDAxYVxcdTAwMWJcXHUwMDFjXFx1MDAxZFxcdTAwMWVcXHUwMDFmICFcXFwiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbwqVdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH3igL5/77+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+977+9XCJcbiAgfSxcbiAgXCJocHJvbWFuOFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiwoDCgcKCwoPChMKFwobCh8KIwonCisKLwozCjcKOwo/CkMKRwpLCk8KUwpXClsKXwpjCmcKawpvCnMKdwp7Cn8Kgw4DDgsOIw4rDi8OOw4/CtMuLy4bCqMucw5nDm+KCpMKvw53DvcKww4fDp8ORw7HCocK/wqTCo8KlwqfGksKiw6LDqsO0w7vDocOpw7PDusOgw6jDssO5w6TDq8O2w7zDhcOuw5jDhsOlw63DuMOmw4TDrMOWw5zDicOvw5/DlMOBw4PDo8OQw7DDjcOMw5PDksOVw7XFoMWhw5rFuMO/w57DvsK3wrXCtsK+4oCUwrzCvcKqwrrCq+KWoMK7wrHvv71cIlxuICB9LFxuICBcIm1hY2ludG9zaFwiOiB7XG4gICAgXCJ0eXBlXCI6IFwiX3NiY3NcIixcbiAgICBcImNoYXJzXCI6IFwiw4TDhcOHw4nDkcOWw5zDocOgw6LDpMOjw6XDp8Opw6jDqsOrw63DrMOuw6/DscOzw7LDtMO2w7XDusO5w7vDvOKAoMKwwqLCo8Kn4oCiwrbDn8KuwqnihKLCtMKo4omgw4bDmOKInsKx4omk4omlwqXCteKIguKIkeKIj8+A4oirwqrCuuKEpsOmw7jCv8KhwqziiJrGkuKJiOKIhsKrwrvigKbCoMOAw4PDlcWSxZPigJPigJTigJzigJ3igJjigJnDt+KXisO/xbjigYTCpOKAueKAuu+sge+sguKAocK34oCa4oCe4oCww4LDisOBw4vDiMONw47Dj8OMw5PDlO+/vcOSw5rDm8OZxLHLhsucwq/LmMuZy5rCuMudy5vLh1wiXG4gIH0sXG4gIFwiYXNjaWlcIjoge1xuICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgXCJjaGFyc1wiOiBcIu+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/ve+/vVwiXG4gIH0sXG4gIFwidGlzNjIwXCI6IHtcbiAgICBcInR5cGVcIjogXCJfc2Jjc1wiLFxuICAgIFwiY2hhcnNcIjogXCLvv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73vv73guIHguILguIPguITguIXguIbguIfguIjguInguIrguIvguIzguI3guI7guI/guJDguJHguJLguJPguJTguJXguJbguJfguJjguJnguJrguJvguJzguJ3guJ7guJ/guKDguKHguKLguKPguKTguKXguKbguKfguKjguKnguKrguKvguKzguK3guK7guK/guLDguLHguLLguLPguLTguLXguLbguLfguLjguLnguLrvv73vv73vv73vv73guL/guYDguYHguYLguYPguYTguYXguYbguYfguYjguYnguYrguYvguYzguY3guY7guY/guZDguZHguZLguZPguZTguZXguZbguZfguZjguZnguZrguZvvv73vv73vv73vv71cIlxuICB9XG59IiwiXG4vLyBNYW51YWxseSBhZGRlZCBkYXRhIHRvIGJlIHVzZWQgYnkgc2JjcyBjb2RlYyBpbiBhZGRpdGlvbiB0byBnZW5lcmF0ZWQgb25lLlxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAvLyBOb3Qgc3VwcG9ydGVkIGJ5IGljb252LCBub3Qgc3VyZSB3aHkuXG4gICAgXCIxMDAyOVwiOiBcIm1hY2NlbnRldXJvXCIsXG4gICAgXCJtYWNjZW50ZXVyb1wiOiB7XG4gICAgICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCLDhMSAxIHDicSEw5bDnMOhxIXEjMOkxI3EhsSHw6nFucW6xI7DrcSPxJLEk8SWw7PEl8O0w7bDtcO6xJrEm8O84oCgwrDEmMKjwqfigKLCtsOfwq7CqeKEosSZwqjiiaDEo8SuxK/EquKJpOKJpcSrxLbiiILiiJHFgsS7xLzEvcS+xLnEusWFxYbFg8Ks4oiaxYTFh+KIhsKrwrvigKbCoMWIxZDDlcWRxYzigJPigJTigJzigJ3igJjigJnDt+KXisWNxZTFlcWY4oC54oC6xZnFlsWXxaDigJrigJ7FocWaxZvDgcWkxaXDjcW9xb7FqsOTw5TFq8Wuw5rFr8WwxbHFssWzw53DvcS3xbvFgcW8xKLLh1wiXG4gICAgfSxcblxuICAgIFwiODA4XCI6IFwiY3A4MDhcIixcbiAgICBcImlibTgwOFwiOiBcImNwODA4XCIsXG4gICAgXCJjcDgwOFwiOiB7XG4gICAgICAgIFwidHlwZVwiOiBcIl9zYmNzXCIsXG4gICAgICAgIFwiY2hhcnNcIjogXCLQkNCR0JLQk9CU0JXQltCX0JjQmdCa0JvQnNCd0J7Qn9Cg0KHQotCj0KTQpdCm0KfQqNCp0KrQq9Cs0K3QrtCv0LDQsdCy0LPQtNC10LbQt9C40LnQutC70LzQvdC+0L/ilpHilpLilpPilILilKTilaHilaLilZbilZXilaPilZHilZfilZ3ilZzilZvilJDilJTilLTilKzilJzilIDilLzilZ7ilZ/ilZrilZTilanilabilaDilZDilazilafilajilaTilaXilZnilZjilZLilZPilavilarilJjilIzilojiloTilozilpDiloDRgNGB0YLRg9GE0YXRhtGH0YjRidGK0YvRjNGN0Y7Rj9CB0ZHQhNGU0IfRl9CO0Z7CsOKImcK34oia4oSW4oKs4pagwqBcIlxuICAgIH0sXG5cbiAgICAvLyBBbGlhc2VzIG9mIGdlbmVyYXRlZCBlbmNvZGluZ3MuXG4gICAgXCJhc2NpaThiaXRcIjogXCJhc2NpaVwiLFxuICAgIFwidXNhc2NpaVwiOiBcImFzY2lpXCIsXG4gICAgXCJhbnNpeDM0XCI6IFwiYXNjaWlcIixcbiAgICBcImFuc2l4MzQxOTY4XCI6IFwiYXNjaWlcIixcbiAgICBcImFuc2l4MzQxOTg2XCI6IFwiYXNjaWlcIixcbiAgICBcImNzYXNjaWlcIjogXCJhc2NpaVwiLFxuICAgIFwiY3AzNjdcIjogXCJhc2NpaVwiLFxuICAgIFwiaWJtMzY3XCI6IFwiYXNjaWlcIixcbiAgICBcImlzb2lyNlwiOiBcImFzY2lpXCIsXG4gICAgXCJpc282NDZ1c1wiOiBcImFzY2lpXCIsXG4gICAgXCJpc282NDZpcnZcIjogXCJhc2NpaVwiLFxuICAgIFwidXNcIjogXCJhc2NpaVwiLFxuXG4gICAgXCJsYXRpbjFcIjogXCJpc284ODU5MVwiLFxuICAgIFwibGF0aW4yXCI6IFwiaXNvODg1OTJcIixcbiAgICBcImxhdGluM1wiOiBcImlzbzg4NTkzXCIsXG4gICAgXCJsYXRpbjRcIjogXCJpc284ODU5NFwiLFxuICAgIFwibGF0aW41XCI6IFwiaXNvODg1OTlcIixcbiAgICBcImxhdGluNlwiOiBcImlzbzg4NTkxMFwiLFxuICAgIFwibGF0aW43XCI6IFwiaXNvODg1OTEzXCIsXG4gICAgXCJsYXRpbjhcIjogXCJpc284ODU5MTRcIixcbiAgICBcImxhdGluOVwiOiBcImlzbzg4NTkxNVwiLFxuICAgIFwibGF0aW4xMFwiOiBcImlzbzg4NTkxNlwiLFxuXG4gICAgXCJjc2lzb2xhdGluMVwiOiBcImlzbzg4NTkxXCIsXG4gICAgXCJjc2lzb2xhdGluMlwiOiBcImlzbzg4NTkyXCIsXG4gICAgXCJjc2lzb2xhdGluM1wiOiBcImlzbzg4NTkzXCIsXG4gICAgXCJjc2lzb2xhdGluNFwiOiBcImlzbzg4NTk0XCIsXG4gICAgXCJjc2lzb2xhdGluY3lyaWxsaWNcIjogXCJpc284ODU5NVwiLFxuICAgIFwiY3Npc29sYXRpbmFyYWJpY1wiOiBcImlzbzg4NTk2XCIsXG4gICAgXCJjc2lzb2xhdGluZ3JlZWtcIiA6IFwiaXNvODg1OTdcIixcbiAgICBcImNzaXNvbGF0aW5oZWJyZXdcIjogXCJpc284ODU5OFwiLFxuICAgIFwiY3Npc29sYXRpbjVcIjogXCJpc284ODU5OVwiLFxuICAgIFwiY3Npc29sYXRpbjZcIjogXCJpc284ODU5MTBcIixcblxuICAgIFwibDFcIjogXCJpc284ODU5MVwiLFxuICAgIFwibDJcIjogXCJpc284ODU5MlwiLFxuICAgIFwibDNcIjogXCJpc284ODU5M1wiLFxuICAgIFwibDRcIjogXCJpc284ODU5NFwiLFxuICAgIFwibDVcIjogXCJpc284ODU5OVwiLFxuICAgIFwibDZcIjogXCJpc284ODU5MTBcIixcbiAgICBcImw3XCI6IFwiaXNvODg1OTEzXCIsXG4gICAgXCJsOFwiOiBcImlzbzg4NTkxNFwiLFxuICAgIFwibDlcIjogXCJpc284ODU5MTVcIixcbiAgICBcImwxMFwiOiBcImlzbzg4NTkxNlwiLFxuXG4gICAgXCJpc29pcjE0XCI6IFwiaXNvNjQ2anBcIixcbiAgICBcImlzb2lyNTdcIjogXCJpc282NDZjblwiLFxuICAgIFwiaXNvaXIxMDBcIjogXCJpc284ODU5MVwiLFxuICAgIFwiaXNvaXIxMDFcIjogXCJpc284ODU5MlwiLFxuICAgIFwiaXNvaXIxMDlcIjogXCJpc284ODU5M1wiLFxuICAgIFwiaXNvaXIxMTBcIjogXCJpc284ODU5NFwiLFxuICAgIFwiaXNvaXIxNDRcIjogXCJpc284ODU5NVwiLFxuICAgIFwiaXNvaXIxMjdcIjogXCJpc284ODU5NlwiLFxuICAgIFwiaXNvaXIxMjZcIjogXCJpc284ODU5N1wiLFxuICAgIFwiaXNvaXIxMzhcIjogXCJpc284ODU5OFwiLFxuICAgIFwiaXNvaXIxNDhcIjogXCJpc284ODU5OVwiLFxuICAgIFwiaXNvaXIxNTdcIjogXCJpc284ODU5MTBcIixcbiAgICBcImlzb2lyMTY2XCI6IFwidGlzNjIwXCIsXG4gICAgXCJpc29pcjE3OVwiOiBcImlzbzg4NTkxM1wiLFxuICAgIFwiaXNvaXIxOTlcIjogXCJpc284ODU5MTRcIixcbiAgICBcImlzb2lyMjAzXCI6IFwiaXNvODg1OTE1XCIsXG4gICAgXCJpc29pcjIyNlwiOiBcImlzbzg4NTkxNlwiLFxuXG4gICAgXCJjcDgxOVwiOiBcImlzbzg4NTkxXCIsXG4gICAgXCJpYm04MTlcIjogXCJpc284ODU5MVwiLFxuXG4gICAgXCJjeXJpbGxpY1wiOiBcImlzbzg4NTk1XCIsXG5cbiAgICBcImFyYWJpY1wiOiBcImlzbzg4NTk2XCIsXG4gICAgXCJhcmFiaWM4XCI6IFwiaXNvODg1OTZcIixcbiAgICBcImVjbWExMTRcIjogXCJpc284ODU5NlwiLFxuICAgIFwiYXNtbzcwOFwiOiBcImlzbzg4NTk2XCIsXG5cbiAgICBcImdyZWVrXCIgOiBcImlzbzg4NTk3XCIsXG4gICAgXCJncmVlazhcIiA6IFwiaXNvODg1OTdcIixcbiAgICBcImVjbWExMThcIiA6IFwiaXNvODg1OTdcIixcbiAgICBcImVsb3Q5MjhcIiA6IFwiaXNvODg1OTdcIixcblxuICAgIFwiaGVicmV3XCI6IFwiaXNvODg1OThcIixcbiAgICBcImhlYnJldzhcIjogXCJpc284ODU5OFwiLFxuXG4gICAgXCJ0dXJraXNoXCI6IFwiaXNvODg1OTlcIixcbiAgICBcInR1cmtpc2g4XCI6IFwiaXNvODg1OTlcIixcblxuICAgIFwidGhhaVwiOiBcImlzbzg4NTkxMVwiLFxuICAgIFwidGhhaThcIjogXCJpc284ODU5MTFcIixcblxuICAgIFwiY2VsdGljXCI6IFwiaXNvODg1OTE0XCIsXG4gICAgXCJjZWx0aWM4XCI6IFwiaXNvODg1OTE0XCIsXG4gICAgXCJpc29jZWx0aWNcIjogXCJpc284ODU5MTRcIixcblxuICAgIFwidGlzNjIwMFwiOiBcInRpczYyMFwiLFxuICAgIFwidGlzNjIwMjUyOTFcIjogXCJ0aXM2MjBcIixcbiAgICBcInRpczYyMDI1MzMwXCI6IFwidGlzNjIwXCIsXG5cbiAgICBcIjEwMDAwXCI6IFwibWFjcm9tYW5cIixcbiAgICBcIjEwMDA2XCI6IFwibWFjZ3JlZWtcIixcbiAgICBcIjEwMDA3XCI6IFwibWFjY3lyaWxsaWNcIixcbiAgICBcIjEwMDc5XCI6IFwibWFjaWNlbGFuZFwiLFxuICAgIFwiMTAwODFcIjogXCJtYWN0dXJraXNoXCIsXG5cbiAgICBcImNzcGM4Y29kZXBhZ2U0MzdcIjogXCJjcDQzN1wiLFxuICAgIFwiY3NwYzc3NWJhbHRpY1wiOiBcImNwNzc1XCIsXG4gICAgXCJjc3BjODUwbXVsdGlsaW5ndWFsXCI6IFwiY3A4NTBcIixcbiAgICBcImNzcGNwODUyXCI6IFwiY3A4NTJcIixcbiAgICBcImNzcGM4NjJsYXRpbmhlYnJld1wiOiBcImNwODYyXCIsXG4gICAgXCJjcGdyXCI6IFwiY3A4NjlcIixcblxuICAgIFwibXNlZVwiOiBcImNwMTI1MFwiLFxuICAgIFwibXNjeXJsXCI6IFwiY3AxMjUxXCIsXG4gICAgXCJtc2Fuc2lcIjogXCJjcDEyNTJcIixcbiAgICBcIm1zZ3JlZWtcIjogXCJjcDEyNTNcIixcbiAgICBcIm1zdHVya1wiOiBcImNwMTI1NFwiLFxuICAgIFwibXNoZWJyXCI6IFwiY3AxMjU1XCIsXG4gICAgXCJtc2FyYWJcIjogXCJjcDEyNTZcIixcbiAgICBcIndpbmJhbHRyaW1cIjogXCJjcDEyNTdcIixcblxuICAgIFwiY3AyMDg2NlwiOiBcImtvaThyXCIsXG4gICAgXCIyMDg2NlwiOiBcImtvaThyXCIsXG4gICAgXCJpYm04NzhcIjogXCJrb2k4clwiLFxuICAgIFwiY3Nrb2k4clwiOiBcImtvaThyXCIsXG5cbiAgICBcImNwMjE4NjZcIjogXCJrb2k4dVwiLFxuICAgIFwiMjE4NjZcIjogXCJrb2k4dVwiLFxuICAgIFwiaWJtMTE2OFwiOiBcImtvaTh1XCIsXG5cbiAgICBcInN0cmsxMDQ4MjAwMlwiOiBcInJrMTA0OFwiLFxuXG4gICAgXCJ0Y3ZuNTcxMlwiOiBcInRjdm5cIixcbiAgICBcInRjdm41NzEyMVwiOiBcInRjdm5cIixcblxuICAgIFwiZ2IxOTg4ODBcIjogXCJpc282NDZjblwiLFxuICAgIFwiY25cIjogXCJpc282NDZjblwiLFxuXG4gICAgXCJjc2lzbzE0amlzYzYyMjByb1wiOiBcImlzbzY0NmpwXCIsXG4gICAgXCJqaXNjNjIyMDE5Njlyb1wiOiBcImlzbzY0NmpwXCIsXG4gICAgXCJqcFwiOiBcImlzbzY0NmpwXCIsXG5cbiAgICBcImNzaHByb21hbjhcIjogXCJocHJvbWFuOFwiLFxuICAgIFwicjhcIjogXCJocHJvbWFuOFwiLFxuICAgIFwicm9tYW44XCI6IFwiaHByb21hbjhcIixcbiAgICBcInhyb21hbjhcIjogXCJocHJvbWFuOFwiLFxuICAgIFwiaWJtMTA1MVwiOiBcImhwcm9tYW44XCIsXG5cbiAgICBcIm1hY1wiOiBcIm1hY2ludG9zaFwiLFxuICAgIFwiY3NtYWNpbnRvc2hcIjogXCJtYWNpbnRvc2hcIixcbn07XG5cbiIsIm1vZHVsZS5leHBvcnRzPVtcbltcIjg3NDBcIixcIuSPsOSwsuSYg+SWpuSVuPCniafktbfklrPwp7Kx5LOi8KezheOuleSctuSdhOSxh+SxgPCkir/wo5iX8KeNkvCmuovwp4OS5LGX8KqNkeSdj+SXmuSyhfCnsazktIfkqqTkmqHwpqyj54il8KWplPChqaPwo7iG8KO9oeaZjeWbu1wiXSxcbltcIjg3NjdcIixcIue2leWknfCorrnjt7TpnLTwp6+v5a+b8KG1nuWqpOOYpfCpurDlq5Hlrrfls7zmna7olpPwqaWF55Gh55Kd46G18KG1k/Cjmp7wpoCh47usXCJdLFxuW1wiODdhMVwiLFwi8KWjnuOrteervOm+l/CkhaHwqKSN8KOHqvCgqorwo4me5IyK6JKE6b6W6ZCv5KSw6JiT5aKW6Z2K6YiY56eQ56iy5pmg5qip6KKd55GM56+F5p6C56is5YmP6YGG45Om54+E8KW2ueeThum/h+Wes+Skr+WRjOSEsfCjmo7loJjnqbLwp62l6K6P5Jqu8Ka6iOSGgfCltpnnrq7wopK86b+I8KKTgfCik4nwopOM6b+J6JSE8KOWu+SCtOm/iuSTofCqt7/mi4Hnga7pv4tcIl0sXG5bXCI4ODQwXCIsXCLjh4BcIiw0LFwi8KCEjOOHhfCgg5HwoION44eG44eH8KCDi/Chv6jjh4jwoIOK44eJ44eK44eL44eM8KCEjuOHjeOHjsSAw4HHjcOAxJLDicSaw4jFjMOTx5HDkuC/v8OKzIThur7gv7/DisyM4buAw4rEgcOhx47DoMmRxJPDqcSbw6jEq8Otx5DDrMWNw7PHksOyxavDuseUw7nHlseYx5pcIl0sXG5bXCI4OGExXCIsXCLHnMO84L+/w6rMhOG6v+C/v8OqzIzhu4HDqsmh4o+a4o+bXCJdLFxuW1wiODk0MFwiLFwi8KqOqfChhYVcIl0sXG5bXCI4OTQzXCIsXCLmlIpcIl0sXG5bXCI4OTQ2XCIsXCLkuL3mu53ptY7ph59cIl0sXG5bXCI4OTRjXCIsXCLwp5y15pKR5Lya5Lyo5L6o5YWW5YW05Yac5Yek5Yqh5Yqo5Yy75Y2O5Y+R5Y+Y5Zui5aOw5aSE5aSH5aSy5aS05a2m5a6e5a6f5bKa5bqG5oC75paJ5p++5qCE5qGl5rWO54K855S157qk57qs57q657uH57uP57uf57yG57y36Im66IuP6I2v6KeG6K6+6K+i6L2m6L2n6L2uXCJdLFxuW1wiODlhMVwiLFwi55CR57O857eN5qWG56uJ5YinXCJdLFxuW1wiODlhYlwiLFwi6YaM56K46YWe6IK8XCJdLFxuW1wiODliMFwiLFwi6LSL6IO28KCnp1wiXSxcbltcIjg5YjVcIixcIuiCn+m7h+Szjem3iem4jOSwvvCpt7bwp4CO6biK8KqEs+OXgVwiXSxcbltcIjg5YzFcIixcIua6muiIvueUmVwiXSxcbltcIjg5YzVcIixcIuSkkemprOmqj+m+meemh/CokazwobeK8KCXkPCiq6bkuKTkuoHkuoDkuofkur/ku6vkvLfjkYzkvr3juYjlgIPlgojjkb3jkpPjkqXlhoblpIXlh5vlh7zliIXkuonlibnlipDljKfjl4fljqnjlZHljrDjlZPlj4LlkKPjla3jlbLjmoHlkpPlkqPlkrTlkrnlk5Dlk6/llJjllKPllKjjlpjllL/jlqXjlr/ll5fjl4VcIl0sXG5bXCI4YTQwXCIsXCLwp7aE5ZSlXCJdLFxuW1wiOGE0M1wiLFwi8KCxgvCgtJXwpYSr5ZaQ8KKzhuOnrPCgjYHouYbwpLa48KmTpeSBk/Cogr7nnbrworC446i05J+V8KiFnfCmp7LwpLeq5pOd8KC1vPCgvrTwoLOV8KGDtOaSjei5vvCgupbwoLCL8KC9pPCisqnwqImW8KSTk1wiXSxcbltcIjhhNjRcIixcIvCgtYbwqamN8KiDqeSftPCkuqfworOC6aqy46mn8KmXtOO/reOUhvCli4fwqZ+U8KejiPCitYTpta7poJVcIl0sXG5bXCI4YTc2XCIsXCLkj5nwpoKl5pK05ZOj8KK1jPCir4rwoYG346e78KGBr1wiXSxcbltcIjhhYTFcIixcIvCmm5rwppyW8KemoOaTqvClgZLwoLGD6Lmo8KKGofCorYzwoJyxXCJdLFxuW1wiOGFhY1wiLFwi5KCL8KCGqeO/uuWhs/Cito1cIl0sXG5bXCI4YWIyXCIsXCLwpJeI8KCTvPCmgpfwoL2M8KC2luWVueSCu+SOulwiXSxcbltcIjhhYmJcIixcIuSqtPCiqabwoYKd6Iaq6aO18KC2nOaNueOnvvCinbXot4DlmqHmkbzjuYNcIl0sXG5bXCI4YWM5XCIsXCLwqpiB8KC4ifCiq4/worOJXCJdLFxuW1wiOGFjZVwiLFwi8KGDiPCjp4LjppLjqIbwqIqb45W48KW5ifCig4flmZLwoLyx8KKysvCpnKDjkrzmsL3wpLi7XCJdLFxuW1wiOGFkZlwiLFwi8KeVtPCiuovwooiI8KqZm/Cos43woLm68KCwtPCmoJznvpPwoYOP8KKgg/CipLnjl7vwpYej8KC6jPCgvo3woLqq476T8KC8sPCgtYfwoYWP8KC5jFwiXSxcbltcIjhhZjZcIixcIvCguqvwoK6p8KC1iPChg4DwoYS947+58KKaluaQsvCgvq1cIl0sXG5bXCI4YjQwXCIsXCLwo4+08KeYufCir47woLW+8KC1v/CisZHworGV46iY8KC6mPChg4fwoLyu8KqYsvCmrZDwqLOS8Ki2mfCos4rplqrlk4zoi4TllrlcIl0sXG5bXCI4YjU1XCIsXCLwqbuD6bCm6aq28KednvCit67nhYDoha3og6zlsJzwppWy6IS0456X5Y2f8KiCvemGtvCgu7rwoLiP8KC5t/Cgu7vjl53wpLer45iJ8KCzluWar/CinrXwoYOJ8KC4kPCgubjwoYG48KGFiPCoiIfwoZGV8KC5ufCkuZDworak5amU8KGAnfChgJ7woYO18KGDtuWenPCguJFcIl0sXG5bXCI4YmExXCIsXCLwp5qU8KiLjfCgvrXwoLm78KWFvuOcg/CgvrbwoYaA8KWLmPCqir3wpKea8KGguvCkhbfwqIm85aKZ5Ymo45ia8KWcveeusuWtqOSggOSsrOm8p+Snp+mwn+mujfClrbTwo4S95Ze745ey5ZqJ5Lio5aSC8KGvgfCvobjpnZHwoIKG5Lmb5Lq745S+5bCj5b2R5b+E46O65omM5pS15q265rC15rC654Gs54ir5Lis54qt8KSjqee9kueku+ezuee9k/Cmiarjk4FcIl0sXG5bXCI4YmRlXCIsXCLwpo2L6ICC6IKA8KaYkvCmpZHljZ3ooaTop4Hwp6Ky6K6g6LSd6ZKF6ZW46ZW/6Zeo8Ki4j+mfpumhtemjjumjnumlo/CpoJDpsbzpuJ/pu4Tmra/vpIfkuLfwoIKH6Zid5oi36ZKiXCJdLFxuW1wiOGM0MFwiLFwi5YC75re+8Kmxs+m+puO3ieiij/CkhY7ngbfls7XkrKDwpYeN45WZ8KW0sOaEovCoqLLovqfph7bnhpHmnJnnjrrwo4qB8KqEh+Oyi/ChpoDkrJDno6TnkILlhq7wqJyP5ICJ5qmj8KqKuuSIo+iYj/Cgqa/nqKrwqaWH8KirqumdleeBjeWMpPCigb7pj7Tnm5nwqKej6b6n55+d5Lqj5L+w5YK85Liv5LyX6b6o5ZC057aL5aKS5aOQ8KG2tuW6kuW6meW/gvCinJLmlotcIl0sXG5bXCI4Y2ExXCIsXCLwo4+55qSZ5qmD8KOxo+azv1wiXSxcbltcIjhjYTdcIixcIueIgPCklIXnjozju5vwpKiT5ayV55K56K6D8KWypPClmpXnqpPnr6zns4Pnuazoi7jolpfpvqnoopDpvqrournpvqvov4/olZ/pp6DpiKHpvqzwqLa58KGQv+SBseSKouWomlwiXSxcbltcIjhjYzlcIixcIumhqOadq+SJtuWcvVwiXSxcbltcIjhjY2VcIixcIuiXlvCkpbvoir/wp4SN5LKB8Ka1tOW1u/CmrJXwpr6+6b6t6b6u5a6W6b6v5pun57mb5rmX56eK47aI5JOD8KOJlvCinpbkjprklLZcIl0sXG5bXCI4Y2U2XCIsXCLls5Xwo6ya6Ku55bG447SS8KOVkeW1uOm+sueFl+SVmPCkg6zwobij5LG346W445GK8KCGpPCmsYHoq4zkvrTwoIi55aa/6IWs6aGW8KmjuuW8u1wiXSxcbltcIjhkNDBcIixcIvCgrp9cIl0sXG5bXCI4ZDQyXCIsXCLwooeB8KilreSEguSau/CpgbnjvIfpvrPwqoa15IO445+W5Ju38KaxhuSFvPComrLwp4+/5JWt46OU8KWSmuSVoeSUm+S2ieSxu+S1tuSXquO/iPCkrI/jmaHkk57kkr3kh63ltL7ltYjltZbjt7zjoI/ltqTltrnjoKDjoLjluYLlur3lvKXlvoPjpIjjpJTjpL/jpY3mg5fmhL3ls6Xjponmhrfmhrnmh4/jprjmiKzmipDmi6XmjJjjp7jlmrFcIl0sXG5bXCI4ZGExXCIsXCLjqIPmj6Lmj7vmkIfmkZrjqYvmk4DltJXlmKHpvp/jqpfmlobjqr3ml7/mmZPjq7LmmpLjrKLmnJbjrYLmnqTmoIDjrZjmoYrmooTjrbLjrbHjrbvmpInmpYPniZzmpaTmpp/mpoXjrrzmp5bjr53mqaXmqbTmqbHmqoLjr6zmqpnjr7LmqqvmqrXmq5Tmq7bmroHmr4Hmr6rmsbXmsqrjs4vmtILmtIbmtKbmtoHjs6/mtqTmtrHmuJXmuJjmuKnmuobwqKeA5rq75rui5rua6b2/5ruo5rup5ryk5ry047WG8KO9gea+gea+vuO1quO1teeGt+WymeO2iueArOO2keeBkOeBlOeBr+eBv+eCifCgjKXkj4Hjl7HwoLuYXCJdLFxuW1wiOGU0MFwiLFwi8KO7l+WevvCmu5PnhL7wpZ+g45mO5qai8KivqeWttOepifClo6HwqZOZ56ml56m98KWmrOequ+eqsOerguerg+eHkfCmko3kh4rnq5rnq53nq6rkh6/lkrLwpbCB56yL562V56yp8KWMjvCls77nrqLnra/ojpzwpa608Kaxv+evkOiQoeeukueuuPCltKDjtq3wpbGl6JKS56+657CG57C18KWzgeexhOeyg/CkooLnsqbmmb3wpJW457OJ57OH57Om57G057Oz57O157OOXCJdLFxuW1wiOGVhMVwiLFwi57mn5JSd8Ka5hOe1nfCmu5bnko3ntonntqvnhLXntrPnt5LwpIGX8KaAqee3pOO0k+e3tfChn7nnt6XwqI2t57id8KaEofCmhZrnua7nupLkjKvpkaznuKfnvYDnvYHnvYfnpLbwpouQ6aeh576X8KaNkee+o/ChmaHwoIGo5JWc8KOdpuSUg/CojLrnv7rwppKJ6ICF6ICI6ICd6ICo6ICv8KqCh/Cms4PogLvogLzogaHwopyU5KaJ8KaYpvCjt6Pwppuo5pyl6IKn8KipiOiEh+iEmuWisPCim7bmsb/wppKY8KS+uOaTp/ChkoroiJjwoaGe5qmT8KSppfCkqpXkkbroiKnwoKyN8KapkvCjtb7kv7nwoZO96JOi6I2i8KasivCkpqfwo5Sw8KGds/Cjt7joiqrmpJvwr6aU5IebXCJdLFxuW1wiOGY0MFwiLFwi6JWL6IuQ6Iya8KC4lvChnrTjm4Hwo4W98KOVmuiJu+iLouiMmPCjuovwpraj8KashfCmrpfwo5eO47a/6Iyd5Zes6I6F5JSL8Ka2peiOrOiPgeiPk+ORvvCmu5TmqZfolZrjkpbwprmC8KK7r+iRmPClr6TokbHjt5Pkk6TmqqfokYrwo7K156WY6JKo8KaulvCmubfwprmD6JOe6JCP6I6R5JKg6JKT6JOk8KWykeSJgPCls4DklYPolLTlq7LwprqZ5JSn6JWz5JSW5p6/6JiWXCJdLFxuW1wiOGZhMVwiLFwi8KiYpfComLvol4Hwp4KI6JiC8KGWgvCng43wr6ay5JWq6Jio45mI8KGiouWPt/Cnjpromb7onbHwqoO46J+u8KKwp+ieseifmuigj+WZoeiZrOahluSYj+ihheihhvCnl6Dwo7a58KeXpOihnuiinOSZm+iitOiiteaPgeijheedt/CnnI/opofoporopqbopqnopqfoprzwqKil6Ken8KekpPCnqr3oqpznnpPph77oqpDwp6mZ56up8KesuvCjvo/knJPwp6y454W86KyM6Kyf8KWQsPCllaXorL/orYzorY3oqqnwpKm66K6Q6K6b6Kqv8KGbn+SYleihj+iym/CntZTwp7aP8K+nlOOcpfCntZPos5bwp7aY8Ke2vei0kui0g/ChpJDos5vngZzotJHwpLOJ47uQ6LW3XCJdLFxuW1wiOTA0MFwiLFwi6Lap8KiAgvChgJTwpKaK46288KiGvPCnhIznq6fouq3ourbou4Ppi5TovJnovK3wqI2l8KiQkui+pemMg/Cqip/woKmQ6L6z5KSq8KinnvColL3wo7a75bu48KOJoui/ufCqgJTwqJq88KiUgfCijKXjpoDwpruX6YC38KiUvPCnqr7pgaHwqJWs8KiYi+mCqPConJPpg4TwqJum6YKu6YO96YWn46uw6Yap6YeE57Ks8Kiks/ChuonpiI7msp/piYHpiaLwpZa56Yq58KirhvCjspvwqKyM8KWXm1wiXSxcbltcIjkwYTFcIixcIvCgtLHpjKzpjavwqKuh8Kivq+eCj+Wrg/Coq6LwqKul5KWl6YmE8KivrPCosLnwqK+/6Y2z6ZGb6Lq86ZaF6Zam6ZCm6Zag5r+25Iq58KKZuvCom5jwoYm88KO4ruSnn+awnOmZu+maluSFrOmao/Cmu5Xmh5rpmrbno7XwqKug6Zq95Y+M5Kah8KayuPCgibTwppCQ8KmCr/Cpg6XwpKuR8KGklfCjjIrpnLHomYLpnLbkqI/klL3kloXwpKup54G15a2B6Zyb6Z2c8KmHlemdl+WtivCph6vpnZ/pkKXlg5Dwo4K38KOCvOmeiemen+mesemevumfgOmfkumfoPClkazpn67nkJzwqZCz6Z+/6Z+18KmQnfCnpbrkq5HpoLTpoLPpoYvpoabjrI7wp4W147WR8KCYsPCkhZxcIl0sXG5bXCI5MTQwXCIsXCLwpZyG6aOK6aK36aOI6aOH5Ku/8Ka0p/Chm5PllrDpo6Hpo6bpo6zpjbjppLnwpKip5K2y8Kmhl/CppIXpp7XpqIzpqLvpqJDpqZjwpZyl45uE8KmCsfCpr5Xpq6Dpq6LwqayF6au05LCO6ayU6ayt8KiYgOWAtOmstPCmpqjjo4Pwo4G96a2Q6a2A8Km0vuWphfChoaPpro7wpImL6bCC6a+/6bCM8Km5qOm3lPCpvrfwqoaS8KqGq/Cqg6HwqoSj8KqHn+m1vum2g/CqhLTpuI7moohcIl0sXG5bXCI5MWExXCIsXCLpt4TwooWb8KqGk/CqiKDwoaS78KqIs+m0ufCqgrnwqoq06bqQ6bqV6bqe6bqi5LS06bqq6bqv8KSNpOm7geOtoOOnpeO0neS8suOevvCosKvpvILpvIjkrpbpkKTwprai6byX6byW6by55Zqf5ZqK6b2F6aa48KmCi+mfsuiRv+m9oum9qeernOm+jueIluSuvvCkpbXwpKa754W38KSnuPCkjYjwpKmR546e8KivmvCho7rnpp/wqKW+8Ki4tumNqemPs/CoqYTpi6zpjoHpj4vwqKWs8KSSueeIl+O7q+edsuepg+eDkPCkkbPwpI+454W+8KGfr+eCo/Chor7wo5aZ47uH8KGihfClkK/woZ+445yi8KGbu/ChoLnjm6HwoZ208KGjkfClvYvjnKPwoZuA5Z2b8KSopfChj77woYqoXCJdLFxuW1wiOTI0MFwiLFwi8KGPhvChkrbolIPwo5qm6JSD6JGV8KSmlPCnhaXwo7ix8KWVnPCju7vwp4GS5JO08KObrvCppp3wprym5p+545yz47CV47en5aGs8KGkouagkOSBl/CjnL/wpIOh8KSCi/CkhI/wprCh5ZOL5Zqe8KaaseWakvCgv5/woK6o8KC4jemPhvCorJPpjpzku7jlhKvjoJnwpJC25Lq88KCRpfCgjb/kvYvkvorwpZmR5amo8KCGq/Cgj4vjppnwoIyK8KCQlOOQteS8qfCgi4DwqLqz8KCJteirmvCgiIzkuphcIl0sXG5bXCI5MmExXCIsXCLlg43lhI3kvqLkvIPwpKiO8KO6iuS9guWAruWBrOWCgeS/jOS/peWBmOWDvOWFmeWFm+WFneWFnua5tvCjlpXwo7i58KO6v+a1svChooTwo7qJ5Yao5YeD8KCXoOSTnfCgkqPwoJKS8KCSkei1uvCoqpzwoJyO5YmZ5Yqk8KChs+WLoemNruSZuueGjPCkjozwoLCg8KSmrPChg6Tmp5HwoLid55G547ue55KZ55CU55GW546Y5K6O8KSqvPCkgo3lj5DjloTniI/wpIOJ5Za08KCNheWTjfCgr4blnJ3piZ3pm7Tpjabln53lno3lnb/jmL7lo4vlqpnwqKmG8KGbuvChna/woZyQ5ais5aa46YqP5am+5auP5aiS8KWlhvChp7PwoaGh8KSKleObtea0heeRg+WoofCluoNcIl0sXG5bXCI5MzQwXCIsXCLlqoHwqK+X8KCQk+mPoOeSjPChjIPnhIXkpbLpkIjwqKe76Y69456g5bCe5bKe5bme5bmI8KGmlvChpbzwo6uu5buN5a2P8KGkg/ChpITjnIHwoaKg45ud8KGbvuObk+iEqvCoqYfwoba68KORsvCopqjlvIzlvI7woaSn8KGeq+Wpq/ChnLvlrYTomJTwp5e96KGg5oG+8KKhoPCimKvlv5vjurjwopav8KKWvvCpgojwpr2z5oeA8KCAvvCggYbwopib5oaZ5oaY5oG18KKym/CitIfwpJuU8KmFjVwiXSxcbltcIjkzYTFcIixcIuaRsfCkmaXwoq2q46ip8KKsovCjkZDwqaOq8KK5uOaMt/CqkZvmkrbmjLHmj5HwpKej8KK1p+aKpPCisqHmkLvmlavmpbLjr7Two4KO8KOKrfCkponwo4qr5ZSN8KOLoPCho5nwqZC/5puO8KOKifCjhrPjq6DkhpDwpZaE8KisovCllo/woZu88KWVm/ClkKXno67wo4SD8KGgqvCjiLTjkaTwo4iP8KOGgvCki4nmmo7wprSk5pmr5K6T5piw8KehsPCht6vmmaPwo4uS8KOLoeaYnvClobLjo5Hwo6C68KOevOOumfCjnqLwo4++55OQ466W5p6P8KSYquaituagnuOvhOaqvuOho/Cjn5XwpJKH5qiz5qmS5quJ5qyF8KGkkuaUkeaimOapjOOvl+apuuatl/Cjv4Dwo7Ka6Y6g6Yuy8KivqvCoq4tcIl0sXG5bXCI5NDQwXCIsXCLpionwqICe8KinnOmRp+a2pea8i/Ckp6zmtafwo72/47aP5riE8KSAvOWovea4iuWhh+a0pOehgueEu/CkjJrwpIm254Ox54mQ54qH54qU8KSej/CknKXlhbnwpKqk8KCXq+eRuvCju7jwo5mf8KSpivCkpJfwpb+h47yG47qx8KSrn/CosKPwo7y15oKn47uz55OM55C86Y6H55C35JKf8Ka3quSVkeeWg+O9o/Cks5nwpLSG472Y55WV55mz8KqXhuOsmeeRqPCoq4zwpKar8KSmjuOru1wiXSxcbltcIjk0YTFcIixcIuO3jfCkqY7ju7/wpKeF8KSjs+mHuuWcsumNgvCoq6PwoaGk5YOf8KWIofClh6fnnbjwo4iy55yO55yP55278KSal/CjnoHjqZ7wpKOw55C455Kb47q/8KSquvCkq4fkg4jwpKqW8KaGrumMh/ClloHnoJ7noo3noojno5Lnj5DnpZnwp52B8KWbo+SEjuemm+iSluempeaorfCju7rnqLrnp7Tkha7woZum5ISy6Yi156ex8KC1jPCkpozwoIqZ8KO2uvChna7jlpfllavjlbDjmqrwoIeU8KCwjeerouWpmfCim7Xwpaqv8KWqnOWojfCgiZvno7DlqKrwpa+G56u+5Ie557Gd57Gt5IiR8KWus/Clurzwpbqm57ON8KSnufChnrDnso7nsbznsq7mqrLnt5znuIfnt5PnvY7wpomhXCJdLFxuW1wiOTU0MFwiLFwi8KaFnPCnrYjntpfwpbqC5Imq8KattfCgpJbmn5bwoIGO8KOXj+WfhPCmkJLwpo+48KSloue/neesp/CgoKzwpaup8KW1g+esjPCluI7pp6bomYXpqaPmqJzwo5C/46ei8KSnt/Cmlq3pqJ/wppag6JKA8KeEp/Cms5Hkk6rohLfkkILog4bohInohYLwpp606aOD8KapguiJouiJpfCmqZHokZPwpran6JiQ8KeIm+WqhuSFv/ChoYDlrKvwoaKh5auk8KGjmOiaoPCvprzwo7aP6KCt8KeQouWoglwiXSxcbltcIjk1YTFcIixcIuihruS9heiih+iiv+ijpuilpeiljfClmoPopZTwp56F8KeehPCor7XwqK+Z8KiunPCop7njuq3okqPkm7Xkm4/jn7LoqL3oqJzwqZGI5b2N6Yir8KSKhOaXlOeEqeeDhPChoYXpta3osp/os6nwp7ec5aaa55+D5aew5I2u45uU6Liq6Lqn8KSwiei8sOi9iuSLtOaxmOa+u/CijKHkopvmvbnmuovwoZ+a6a+p45q18KSkr+mCu+mCl+WVseSkhumGu+mQhPCoqYvkgaLwqKu86ZCn8KiwnfCosLvok6XoqKvplpnplqfplpfplpbwqLS055GF47uC8KSjv/CkqYLwpI+q47un8KOIpemaj/Cou6fwqLmm8Ki5peO7jPCkp63wpKm48KO/rueQkueRq+O7vOmdgfCpgrBcIl0sXG5bXCI5NjQwXCIsXCLmoYfkqJ3wqYKT8KWfn+mdnemNqPCoponwqLCm8Kisr/Cmjr7pirrlrJHorankpLznj7nwpIib6Z6b6Z2x6aS48KC8puW3gfCor4XwpKqy6aCf8KmTmumLtvCpl5fph6Xkk4DwqK2Q8KSpp/CoraTpo5zwqKmF47yA6Yiq5KSl6JCU6aS76aWN8KeshuO3vemmm+Str+mmqumpnPCoraXwpaOI5qqP6aih5au+6aiv8KmjseSukPCppYjpprzkrr3krpfpjb3lobLwoYyC5aCi8KSmuFwiXSxcbltcIjk2YTFcIixcIvChk6jnoYTwopyf8KO2uOajheO1vemRmOOkp+aFkPCinoHwoqWr5oSH6bGP6bGT6bG76bC16bCQ6a2/6a+P8Km4remun/Cqh7XwqoO+6bSh5LKu8KSEhOm4mOSysOm0jPCqhrTwqoOt8KqDs/CppK/ptqXokr3wpriS8Ka/n/CmroLol7zklLPwprak8Ka6hPCmt7DokKDol67wpriA8KOfl/CmgaTnp6Lwo5ac8KOZgOSkrfCkp57jtaLpj5vpir7pjYjwoIq/56K56Ym36ZGN5L+k45GA6YGk8KWVneegveehlOeituehi/ChnZfwo4eJ8KSlgeOamuS9sua/mua/meeAnueAnuWQlPCkhrXlnrvlo7PlnorptJbln5fnhLTjkq/wpIas54er8KaxgPCkvpflrKjwoZ618KipiVwiXSxcbltcIjk3NDBcIixcIuaEjOWrjuWoi+SKvPCkkojjnKzkrbvwqKe86Y676Y648KGjlvCgvJ3okbLwprOA8KGQk/Cki7rworCm8KSPgeWmlPCjtrfwpp2B57ao8KaFm/CmgqTwpKa58KSmi/Cop7rpi6Xnj6Lju6nnkrTwqK2j8KGin+O7ofCkqrPmq5jnj7Pnj7vju5bwpKi+8KSqlPChn5nwpKmm8KCOp/ChkKTwpKel55GI8KSklueCpfCkpbbpioTnj6bpjZ/woJO+6Yyx8KirjvCoqJbpjobwqK+n8KWXleSktfCoqoLnhatcIl0sXG5bXCI5N2ExXCIsXCLwpKWD8KCzv+WapPCgmJrwoK+r8KCyuOWUguenhPChn7rnt77woZuC8KSpkPChoZLklK7pkIHjnIrwqKuA8KSmreWmsPChor/woaKD8KeShOWqoeObovCjtZvjmrDpiZ/lqbnwqKqB8KGhoumNtOOzjfCgqrTkqpbjporlg7TjtanjtYzwoY6c54W15Iu78KiImOa4j/Cpg6Tkk6vmtZfwp7mP54Gn5rKv47OW8KO/rfCjuK3muILmvIzjta/woI+155WR45q845OI5JqA47ua5KGx5aeE6Ymu5KS+6L2B8KiwnPCmr4DloJLln4jjm5bwoZGS54O+8KSNovCkqbHwor+j8KGKsPCijr3mornmpafwoY6Y8KOTpfCnr7Two5uf8Kiqg/Cjn5bwo4+68KSyn+aomvCjmq3wprK36JC+5JOf5JOOXCJdLFxuW1wiOTg0MFwiLFwi8Ka0pvCmtZHwprKC8Ka/nua8l/CnhInojL3woZy66I+t8KaygPCngZPwoZ+b5aaJ5aqC8KGes+WpoeWpsfChpIXwpIe845yt5aev8KGcvOObh+eGjumOkOaamvCkiqXlqa7lqKvwpIqT5qir8KO7ufCnnLbwpJGb8KSLiueEnfCkiZnwqKeh5L6w8Ka0qOWzgvCkk47wp7mN8KSOveaojPCkiZbwoYyE54Km54Sz8KSPqeO2peazn/CvoKXwpKmP57ml5aer5bSv47ez5b2c8KSpnfChn5/ntqTokKZcIl0sXG5bXCI5OGExXCIsXCLlkoXwo6u68KOMgPCgiJTlnb7woKOV8KCYmeO/pfChvp7wqoq254CD8KmFm+W1sOeOj+ezk/CoqZnwqZCg5L+I57+n54uN54yQ8KertOeMuOeMufClm7bnjYHnjYjjuqnwp6yY6YGs54e18KSjsuePoeiHtuO7iuecjOO7keayouWbveeQmeeQnueQn+O7ouO7sOO7tOO7uueTk+O8juO9k+eVgueVreeVsueWjeO9vOeXiOeXnOO/gOeZjeO/l+eZtOO/nOeZuvCkvZznhojlmKPopoDloankgJ3nnYPkgLnmnaHkgYXjl5vnnpjkgarkga/lsZ7nnr7nn4vlo7LnoJjngrnnoJzkgqjnoLnnoYfnoZHnoabokYjwpZS156Sz5qCD56Sy5ISDXCJdLFxuW1wiOTk0MFwiLFwi5ISJ56aR56aZ6L6756iG6L685IWn56qR5Iay56q86Im55IeE56uP56ub5IeP5Lih562i562s562757CS57Cb5Img5Im657G757Kc5IqM57K45IqU57Ot6L6T54OA8KCzj+e3j+e3lOe3kOe3vee+rue+tOeKn+SOl+iAoOiApeesueiAruiAseiBlOO3jOWetOeCoOiCt+iDqeSPreiEjOeMquiEjuiEkueVoOiElOSQgeOsueiFluiFmeiFmlwiXSxcbltcIjk5YTFcIixcIuSQk+WguuiFvOiGhOSQpeiGk+SQreiGpeWfr+iHgeiHpOiJlOSSj+iKpuiJtuiLiuiLmOiLv+SSsOiNl+mZqeamiuiQheeDteiRpOaDo+iSiOSUhOiSvuiToeiTuOiUkOiUuOiVkuSUu+iVr+iVsOiXoOSVt+iZsuiakuiasuibr+mZheiei+SYhuSYl+iiruijv+ikpOilh+imkfCnpafoqKnoqLjoqpToqrTosZHos5Tos7LotJzknpjloZ/ot4Pkn63ku67ouLrll5jlnZToubHll7XourDkoLfou47ou6Lou6Tou63ou7Lovrfov4Hov4rov4zpgLPpp4Tkoq3po6DpiJPkpJ7piKjpiZjpiavpirHpiq7pir9cIl0sXG5bXCI5YTQwXCIsXCLpi6Ppi6vpi7Ppi7Tpi73pjYPpjoTpjq3kpYXkpZHpur/pkJfljIHpkJ3pkK3pkL7kparpkZTpkbnplK3plqLkpqfpl7TpmLPkp6XmnqDkqKTpnYDkqLXpnrLpn4LlmZTkq6Tmg6jpornkrJnpo7HloYTppI7ppJnlhrTppJzppLfppYLppZ3ppaLkrbDpp4Xkrp3pqLzprI/nqoPpranproHpr53pr7Hpr7Tksa3psKDjna/woa+C6bWJ6bC6XCJdLFxuW1wiOWFhMVwiLFwi6bu+5ZmQ6baT6ba96beA6be86ZO26L626bm76bqs6bqx6bq96buG6ZOc6bui6bux6bu456uI6b2E8KCClPCgirfwoI6g5qSa6ZOD5aas8KCTl+WhgOmTgeOeufCgl5XwoJiV8KCZtvChmrrlnZfnhbPwoKuC8KCrjfCgrr/lkarwr6C78KCvi+WSnvCgr7vwoLC78KCxk/CgsaXwoLG85oOn8KCyjeWZuvCgsrXwoLOd8KCzrfCgta/woLay8KC3iOallemwr+iepfCguITwoLiO8KC7l/CgvpDwoLyt8KC5s+WwoPCgvrzluIvwoYGc8KGBj/ChgbbmnJ7woYG78KGCiPChgpbjmYfwoYK/8KGDk/ChhK/woYS75Y2k6JKt8KGLo/ChjbXwoYy26K6B8KGVt/ChmJnwoZ+D8KGfh+S5uOeCu/ChoK3woaWqXCJdLFxuW1wiOWI0MFwiLFwi8KGorfChqYXwobCq8KGxsPChsqzwobuI5ouD8KG7lfChvJXnhpjmoZXwooGF5qep45uI8KKJvPCij5fwoo+68KKcqvCiobHwoqWP6Iu98KKlp/CippPwoquV6Kal8KKrqOi+oPCirI7pnrjwoqy/6aGH6aq98KKxjFwiXSxcbltcIjliNjJcIixcIvCisojworK38KWvqPCitIjworSS8KK2t/CitpXwormC8KK9tPCiv4zwo4Cz8KOBpvCjjJ/wo4+e5b6x5pmI5pq/8KepufCjlafwo5ez54iB8KSmuuefl/CjmJrwo5yW57qH8KCNhuWiteacjlwiXSxcbltcIjliYTFcIixcIuakmPCjqqfwp5mX8KW/ovCjuJHwo7q58KeXvvCigprko5DkqrjwpISZ8KiqmvCki67wpIyN8KSAu/CkjLTwpI6W8KSphfCgl4rlh5LwoJiR5aaf8KG6qOOuvvCjs7/wpJCE8KSTluWeiPCkmbTjppvwpJyv8KiXqPCpp4njnaLwooeD6K2e8KitjumnlvCkoJLwpKO78KSoleeIifCkq4DwoLG45aWl8KS6pfCkvobwoJ256Lua8KWArOWKj+Wcv+eFsfClipnwpZCZ8KO9ivCkqqfllrzwpZGG8KWRrvCmrZLph5TjkbPwpZS/8KeYsvCllZ7knJjwpZWi8KWVpvCln4fwpKS/8KWhneWBpuOTu/Cjj4zmg57wpaSD5J288KiliPClqq7wpa6J8KWwhvChtpDlnqHnhZHmvrbwpoSC8KewkumBlvCmhrLwpL6a6K2i8KaQgvCmkYpcIl0sXG5bXCI5YzQwXCIsXCLltZvwpq+36Ly28KaShPChpJzoq6rwpKe28KaSiPCjv6/wppSS5K+A8KaWv/CmmrXwopyb6ZGl8KWfoeaGleWop/Cvo43kvrvlmrnwpJSh8KabvOS5qvCkpLTpmZbmto/wprK945iY6KW38KaemfCmoa7wppCR8KahnueHn/Cmo4fnrYLwqYOA8KCokfCmpKbphITwpqS556mF6bew8KanuumopvCmqK3jmZ/wppGp8KCAoeemg/CmqLTwpq2b5bSs8KOUmeiPj/Cmrp3km5DwprKk55S76KGl8Ka2ruWitlwiXSxcbltcIjljYTFcIixcIuOcnPCilo3wp4GL8KeHjeOxlPCnioDwp4qF6YqB8KKFuvCniovpjLDwp4um8KSnkOawuemSn/CnkZDwoLu46KCn6KO18KKkpvCokbPwoZ6x5rq48KSoqvChoKDjpqTjmrnlsJDnp6PklL/mmrbwqbKt8KmipOilg/Cnn4zwp6GY5ZuW5IOf8KGYiuOmofCjnK/wqIOo8KGPheeGreiNpvCnp53wqYao5amn5LK38KeCr/Copqvwp6e98KeoivCnrIvwp7Wm8KSFuuetg+elvvCogInmvrXwqouf5qiD8KiMmOWOovCmuIfpjr/moLbpnZ3wqIWv8KiAo/CmprXwoY+t8KOIr/CogYjltoXwqLCw8KiCg+Wclemgo/CopYnltqvwpKaI5pa+5qeV5Y+S8KSqpfCjvoHjsJHmnLbwqIKQ8KiDtPCohK7wob6h8KiFj1wiXSxcbltcIjlkNDBcIixcIvCohonwqIav8KiImvCojIbwqIyv8KiOiuOXivCokajwqJqq5KO65o+m8KilluegiOmJlfCoprjkj7LwqKen5I+f8KinqPCorYbwqK+U5ae48Kiwiei8i/Cov4XwqYOs562R8KmEkPCphLzjt7fwqYWe8KSriui/kOeKj+Wai/Cpk6fwqZep8KmWsPCplrjwqZyy8KmjkfCppYnwqaWq8Kmng/CpqKjwqayO8Km1mvCptpvnup/wqbu48Km8o+SypOmVh/CqipPnhqLwqou/5LaR6YCS8KqXi+S2nPCgspzovr7ll4FcIl0sXG5bXCI5ZGExXCIsXCLovrrwopKw6L658KSqk+SUiee5v+a9luaqseS7quOTpPCorKzwp6Kd45y66LqA8KGftfCogKTwqK2s8KiumfCnqL7wppqv47er8KeZlfCjsrfwpZi18KWlluS6mvCluoHwpomY5Zq/8KC5rei4juWtrfCjuojwpLKe5o+e5ouQ8KGftvChobvmlLDlmK3wpbGK5ZCa8KWMkeO3hvCptpjksb3lmKLlmJ7nvYnwpbuY5aW18KO1gOidsOS4nPCgv6rwoLWJ8KOauuiEl+m1nui0mOeYu+mxheeZjueeuemNheWQsuiFiOiLt+WYpeiEsuiQmOiCveWXquelouWZg+WQlvCgup3jl47lmIXll7Hmm7HwqIui45it55S05Zew5Za65ZKX5ZWy8KCxgfCgspblu5DwpYWI8KC5tvCisaJcIl0sXG5bXCI5ZTQwXCIsXCLwoLqi6bqr57Wa5Zee8KGBteaKnemdreWSlOizjeeHtumFtuaPvOaOueaPvuWVqfCirYPpsbLworqz5Yaa45Of8KC2p+WGp+WRjeWUnuWUk+eZpui4rfCmoornlrHogrbooITonoboo4fohrbokJzwoYOB5JOs54yE8KSchuWukOiMi/CmopPlmbvwopu08Ke0r/CkhqPwp7Wz8Ka7kPCnirbphbDwoYeZ6YiI8KOzvPCqmqnwoLqs8KC7ueeJpvChsqLknY7wpL+C8Ke/ufCgv6vkg7pcIl0sXG5bXCI5ZWExXCIsXCLpsZ3mlJ/worag5KOz8KSfoPCptbzwoL+s8KC4iuaBovCnlqPwoL+tXCJdLFxuW1wiOWVhZFwiLFwi8KaBiPChhofnhqPnuo7ptZDkuJrkuITjlbflrI3msrLljafjmqzjp5zljb3jmqXwpJiY5aKa8KStruiIreWRi+WeqvClqpXwoKW5XCJdLFxuW1wiOWVjNVwiLFwi46mS8KKRpeeNtPCpuqzktInpr63wo7O+8Km8sOSxm/CkvqnwqZae8Km/nuiRnPCjtrbwp4qy8Kaes/CjnKDmjK7ntKXwo7u38KO4rOOoqumAiOWLjOO5tOOZuuSXqfCgko7nmYDlq7DwoLq256G68Ke8ruWip+SCv+WZvOmui+W1tOeZlPCqkLTpuoXks6Hnl7njn7vmhJnwo4Oa8KSPslwiXSxcbltcIjllZjVcIixcIuWZnfChiqnlnqfwpKWj8Km4huWItPCngq7jlq3msYrptbxcIl0sXG5bXCI5ZjQwXCIsXCLnsZbprLnln57woZ2s5bGT5pOT8KmTkPCmjLXwp4Wk6Jqt8KC0qPCmtKLwpKui8KC1sVwiXSxcbltcIjlmNGZcIixcIuWHvvChvI/lto7pnIPwobeR6bqB6YGM56yf6ayC5bOR566j5omo5oy16au/56+P6ayq57G+6ayu57GC57KG6bCV56+86ayJ6byX6bCb8KSkvum9muWVs+Wvg+S/vem6mOS/suWJoOO4huWLkeWdp+WBluWmt+W4kumfiOm2q+i9nOWRqemetOmlgOmeuuWMrOaEsFwiXSxcbltcIjlmYTFcIixcIuakrOWPmumwium0guSwu+mZgeamgOWCpueVhvChna3pp5rlibNcIl0sXG5bXCI5ZmFlXCIsXCLphZnpmoHphZxcIl0sXG5bXCI5ZmIyXCIsXCLphZHwqLqX5o2/8Ka0o+ariuWYkemGjueVuuaKhfCgj7znjY/nsbDwpbCh8KOzvVwiXSxcbltcIjlmYzFcIixcIvCkpJnnm5bprp3kuKrwoLOU6I6+6KGCXCJdLFxuW1wiOWZjOVwiLFwi5bGK5qeA5YOt5Z265Yif5be15LuO5rCx8KCHsuS8ueWSnOWTmuWKmui2guOXvuW8jOOXs1wiXSxcbltcIjlmZGJcIixcIuatkumFvOm+pemul+mgrumitOmquum6qOm6hOeFuueslFwiXSxcbltcIjlmZTdcIixcIuavuuigmOe9uFwiXSxcbltcIjlmZWJcIixcIuWYoPCqmYroubfpvZNcIl0sXG5bXCI5ZmYwXCIsXCLot5TouY/puJzouIHmioLwqI296Lio6Lm156uT8KSpt+eovuejmOazquipp+eYh1wiXSxcbltcImEwNDBcIixcIvCoqZrpvKbms47on5bnl4Pwqoqy56GT8K+hgOi0jOeLoueNseisreeMgueTseizq/CkqrvomK/lvrrooqDkkrdcIl0sXG5bXCJhMDU1XCIsXCLwoaC78Ka4hVwiXSxcbltcImEwNThcIixcIuipvvCilJtcIl0sXG5bXCJhMDViXCIsXCLmg73nmafpq5fptYTpja7pro/on7VcIl0sXG5bXCJhMDYzXCIsXCLooI/os7fnjKzpnKHprrDjl5bnirLksIfnsZHppYrwpoWZ5oWZ5LCE6bqW5oW9XCJdLFxuW1wiYTA3M1wiLFwi5Z2f5oWv5oqm5oi55ouO46mc5oei5Y6q8KOPteaNpOagguOXklwiXSxcbltcImEwYTFcIixcIuW1l/Cor4Lov5rwqLi5XCJdLFxuW1wiYTBhNlwiLFwi5YOZ8KG1huekhuWMsumYuPCgvLvkgaVcIl0sXG5bXCJhMGFlXCIsXCLnn75cIl0sXG5bXCJhMGIwXCIsXCLns4Lwpbya57Oa56it6IGm6IGj57WN55SF55Oy6KaU6Iia5pyM6IGi8KeShuiBm+eTsOiEg+ecpOimifCmn4znlZPwpruR6J6p6J+O6IeI6J6M6KmJ6LKt6K2D55yr55O46JOa45i15qay6LamXCJdLFxuW1wiYTBkNFwiLFwi6Kap55Go5ra56J+B8KSAkeeTp+O3m+eFtuaCpOaGnOOzkeeFouaBt1wiXSxcbltcImEwZTJcIixcIue9sfCorK3niZDmg6nkrb7liKDjsJjwo7OH8KW7l/CnmZbwpZSx8KGlhPChi77wqaSD8Ka3nPCngq3ls4Hwpoat8Kioj/CjmbfwoIOu8KahhvCkvI7klaLlrJ/wpo2M6b2Q6bqm8KaJq1wiXSxcbltcImEzYzBcIixcIuKQgFwiLDMxLFwi4pChXCJdLFxuW1wiYzZhMVwiLFwi4pGgXCIsOSxcIuKRtFwiLDksXCLihbBcIiw5LFwi5Li25Li/5LqF5Lqg5YaC5YaW5Yar5Yu55Yy45Y2p5Y625aSK5a6A5beb4ryz5bm/5bu05b2Q5b2h5pS05peg55aS55m26L616Zq2wqjLhuODveODvuOCneOCnuOAg+S7neOAheOAhuOAh+ODvO+8u++8veKcveOBgVwiLDIzXSxcbltcImM3NDBcIixcIuOBmVwiLDU4LFwi44Kh44Ki44Kj44KkXCJdLFxuW1wiYzdhMVwiLFwi44KlXCIsODEsXCLQkFwiLDUsXCLQgdCWXCIsNF0sXG5bXCJjODQwXCIsXCLQm1wiLDI2LFwi0ZHQtlwiLDI1LFwi4oen4oa44oa544eP8KCDjOS5mvCggorliILkkpFcIl0sXG5bXCJjOGExXCIsXCLpvrDlhojpvrHwp5iHXCJdLFxuW1wiYzhjZFwiLFwi77+i77+k77yH77yC44ix4oSW4oSh44Kb44Kc4rqA4rqE4rqG4rqH4rqI4rqK4rqM4rqN4rqV4rqc4rqd4rql4rqn4rqq4rqs4rqu4rq24rq84rq+4ruG4ruK4ruM4ruN4ruP4ruW4ruX4rue4rujXCJdLFxuW1wiYzhmNVwiLFwiyoPJkMmbyZTJtcWTw7jFi8qKyapcIl0sXG5bXCJmOWZlXCIsXCLvv61cIl0sXG5bXCJmYTQwXCIsXCLwoJWH6Yub8KCXn/Cjv4XolYzkirXnj6/lhrXjmYnwpKWC8KinpOmNhPChp5voi67wo7OI56C85p2E5ouf8KSks/CopqrwoIqg8Kaus/ChjIXkvqvwopOt5YCI8Ka0qfCnqoTwo5iA8KSqsfCilJPlgKnwoI2+5b6k8KCOgPCgjYfmu5vwoJCf5YG95YSB45G65YSO6aGs452D6JCW8KSmpPCgkoflhaDwo4605YWq8KCvv/Cig7zwoIul8KKUsPCglo7wo4iz8KGmg+WuguidvfCglrPwo7KZ5Yay5Ya4XCJdLFxuW1wiZmFhMVwiLFwi6bS05YeJ5YeP5YeR47Oc5YeT8KSqpuWGs+WHouWNguWHreiPjeakvvCjnK3lvbvliIvliKbliLzlirXliZflipTlirnli4XnsJXolYLli6DomI3wpqyT5YyF8KirnuWViea7mfCjvoDwoKWU8KO/rOWMs+WNhPCgr6Lms4vwoZym5qCb54+V5oGK47qq46OM8KGbqOeHneSSouWNreWNtPComqvljb7ljb/woZaW8KGYk+efpuWOk/CoqpvljqDljqvljq7njqfwpZ2y472Z546c5Y+B5Y+F5rGJ5LmJ5Z++5Y+Z46qr8KCuj+WPoPCjv6vworaj5Y+28KCxt+WQk+eBueWUq+aZl+a1m+WRrfCmrZPwoLW05ZWd5ZKP5ZKk5J6m8KGcjfCgu53jtrTwoLWNXCJdLFxuW1wiZmI0MFwiLFwi8KimvPCimpjllYfks63lkK/nkJfllobllqnlmIXwoaOX8KSAuuSVkvCkkLXmmrPwoYK05Zi35puN8KOKiuaapOaareWZjeWZj+ejseWbsemeh+WPvuWcgOWbr+WbrfCorabjmKPwoYmP5Z2G8KSGpeaxrueCi+WdguOasfCmsb7ln6bwoZCW5aCD8KGRlPCkjaPloKbwpK+15aGc5aKq45Wh5aOg5aOc8KGIvOWju+Wvv+Wdg/CqhZDwpIm46Y+T45ah5aSf5qKm45uD5rmZXCJdLFxuW1wiZmJhMVwiLFwi8KGYvuWopOWVk/ChmpLolIXlp4nwoLWO8KaygfCmtKrwoZ+c5aeZ8KGfu/ChnrLwpram5rWx8KGgqPChm5Xlp7nwprmF5aqr5amj45um8KSmqeWpt+OciOWqlueRpeWrk/CmvqHwopWU47aF8KGkkeOcsvChmrjluoPli5Dlrbbmlojlrbzwp6iO5ICE5KGd8KCIhOWvleaFoPChqLTwpaeM8KCWpeWvs+WuneS0kOWwhfChrYTlsJPnj47lsJTwobKl8KasqOWxieSjneWyheWzqeWzr+W2i/Cht7nwobi35bSQ5bSY5bWG8KG6pOWyuuW3l+iLvOOgrfCkpIHwooGJ8KKFs+iKh+OgtuOvguW4ruaqiuW5teW5uvCkkrzwoLOT5Y6m5Lq35buQ5Y6o8KGdseW4ieW7tPCokoJcIl0sXG5bXCJmYzQwXCIsXCLlu7nlu7vjoqDlu7zmoL7pkJvlvI3woIeB8K+ilOOrnuSirvChjLrlvLrwpqKI8KKPkOW9mPCikbHlvaPpnr3wprmu5b2y6Y2A8KiotuW+p+W2tuO1n/CliZDwob2q8KeDuPCimajph5bwoIqe8KioqeaAseaahfChobfjpaPjt4fjmLnlnpDwop6056Wx47mA5oKe5oKk5oKz8KSmgvCkpo/wp6mT55Kk5YOh5aqg5oWk6JCk5oWC8K+ipvCmu5LmhoHlh7TwoJmW5oaH5a6q8KO+t1wiXSxcbltcImZjYTFcIixcIvCioZ/mh5PwqK6d8KmlneaHkOOksvCipoDwoqOB5oCj5oWc5pSe5o6L8KCEmOaLhfChnbDmi5XworiN5o2s8KSnn+Ool+aQuOaPuPChjo7woZ+85pKQ5r6K8KK4tumglPCkgozwpZyd5pOh5pOl6ZG746mm5pC646mX5pWN5ryW8KSoqPCkqKPmloXmla3mlZ/wo4G+5pa18KSlgOSst+aXkeSDmPChoKnml6Dml6Plv5/wo5CA5piY8KOHt/Cjh7jmmYTwo4ak8KOGpeaZi/CgubXmmafwpYem5pmz5pm08KG4vfCjiLHwqJe08KOHiPCljJPnn4XwoqO36aak5pyC8KSOnPCkqKHjrKvmp7rwo5+C5p2e5p2n5p2i8KSHjfCpg63mn5fkk6nmoKLmuZDpiLzmoIHwo4+m8Ka2oOahnVwiXSxcbltcImZkNDBcIixcIvCjka/mp6HmqIvwqKuf5qWz5qOD8KOXjeakgeakgOO0suOogfCjmLzjroDmnqzmpaHwqKmK5Iu85qS25qaY466h8KCPieiNo+WCkOanufCjmZnwooSq5qmF8KOcg+aqneOvs+aeseariPCphpzjsI3mrJ3woKSj5oOe5qy15q208KKfjea6tfCjq5vwoI618KGlmOOdgOWQofCjrZrmr6Hwo7u85q+c5rC38KKSi/Cko7Hwpq2R5rGa6Iim5rG58KO2vOSThfCjtr3wpIak8KSkjPCkpIBcIl0sXG5bXCJmZGExXCIsXCLwo7OJ45ul47Or8KC0sumug/Cjh7nwopKR576P5qC38Ka0pfCmtqHwprer5raW5rWc5rm85ryE8KSlv/CkgoXwprmy6JSz8Ka9tOWHh+aynOa4neiQrvCorKHmuK/wo7iv55GT8KO+guenjOa5j+WqkfCjgYvmv7jjnI3mvp3wo7iw5ru68KGSl/CkgL3klZXpj7DmvYTmvZzjtY7mvbTwqYWw47S75r6f8KSFhOa/k/CkgpHwpIWV8KSAufCjv7Dwo7608KSEv+WHn/CkhZbwpIWX8KSFgPCmh53ngYvngb7ngqfngoHng4zng5Xng5bng5/khITjt6jnhrTnhpbwpIm354Sr54WF5aqI54WK54Wu5bKc8KSNpeeFj+mNovCki4HnhKzwpJGa8KSop/CkqKLnhrrwqK+o54K954iOXCJdLFxuW1wiZmU0MFwiLFwi6ZGC54iV5aSR6ZGD54ik6Y2B8KWYheeIrueJgPCkpbTmor3niZXniZfjuZXwo4GE5qCN5ry954qC54yq54yr8KSgo/CooKvko63wqKCE54yo54yu54+P546q8KCwuvCmqK7nj4nnkYnwpIei8KGbp/CkqKTmmKPjm4XwpKa38KSmjfCkp7vnj7fnkJXmpIPwpKim55C58KCXg+O7l+eRnPCioq3nkaDwqLqy55GH54+k55G26I6555Gs45yw55G06Y+x5qis55KC5KWT8KSqjFwiXSxcbltcImZlYTFcIixcIvCkhZ/wpKm58Kiuj+WthvCosIPwoaKe55OI8KGmiOeUjueTqeeUnvCou5nwoamL5a+X8Ki6rOmOheeVjeeViueVp+eVrvCkvoLjvITwpLST55aO55Gd55ae55a055iC55is55mR55mP55mv55m28KaPteeakOiHr+OfuPCmpJHwpqSO55qh55ql55q355uM8Ka+n+iRovClgp3wpYW98KG4nOecnuecpuedgOaSr/CliKDnnZjwo4qs556v8KilpPCopajwoZuB55+056CJ8KGNtvCkqJLmo4rnoq/no4fno5PpmqXnpK7wpZeg56OX56S056Kx8KeYjOi+uOiihPCorKvwpoKD8KKYnOemhuikgOakguemgPCloZfnpp3wp6y556S856ap5riq8KeEpuO6qOenhvCphI3np5RcIl1cbl1cbiIsIm1vZHVsZS5leHBvcnRzPVtcbltcIjBcIixcIlxcdTAwMDBcIiwxMjcsXCLigqxcIl0sXG5bXCI4MTQwXCIsXCLkuILkuITkuIXkuIbkuI/kuJLkuJfkuJ/kuKDkuKHkuKPkuKbkuKnkuK7kuK/kuLHkuLPkuLXkuLfkuLzkuYDkuYHkuYLkuYTkuYbkuYrkuZHkuZXkuZfkuZrkuZvkuaLkuaPkuaTkuaXkuafkuajkuapcIiw1LFwi5Lmy5Lm0XCIsOSxcIuS5v1wiLDYsXCLkuofkuopcIl0sXG5bXCI4MTgwXCIsXCLkupDkupbkupfkupnkupzkup3kup7kuqPkuqrkuq/kurDkurHkurTkurbkurfkurjkurnkurzkur3kur7ku4jku4zku4/ku5Dku5Lku5rku5vku5zku6Dku6Lku6bku6fku6nku63ku67ku6/ku7Hku7Tku7jku7nku7rku7zku77kvIDkvIJcIiw2LFwi5LyL5LyM5LySXCIsNCxcIuS8nOS8neS8oeS8o+S8qOS8qeS8rOS8reS8ruS8seS8s+S8teS8t+S8ueS8u+S8vlwiLDQsXCLkvYTkvYXkvYdcIiw1LFwi5L2S5L2U5L2W5L2h5L2i5L2m5L2o5L2q5L2r5L2t5L2u5L2x5L2y5L215L235L245L255L265L295L6A5L6B5L6C5L6F5L6G5L6H5L6K5L6M5L6O5L6Q5L6S5L6T5L6V5L6W5L6Y5L6Z5L6a5L6c5L6e5L6f5L6h5L6iXCJdLFxuW1wiODI0MFwiLFwi5L6k5L6r5L6t5L6wXCIsNCxcIuS+tlwiLDgsXCLkv4Dkv4Hkv4Lkv4bkv4fkv4jkv4nkv4vkv4zkv43kv5JcIiw0LFwi5L+Z5L+b5L+g5L+i5L+k5L+l5L+n5L+r5L+s5L+w5L+y5L+05L+15L+25L+35L+55L+75L+85L+95L+/XCIsMTFdLFxuW1wiODI4MFwiLFwi5YCL5YCO5YCQ5YCR5YCT5YCV5YCW5YCX5YCb5YCd5YCe5YCg5YCi5YCj5YCk5YCn5YCr5YCvXCIsMTAsXCLlgLvlgL3lgL/lgYDlgYHlgYLlgYTlgYXlgYblgYnlgYrlgYvlgY3lgZBcIiw0LFwi5YGW5YGX5YGY5YGZ5YGb5YGdXCIsNyxcIuWBplwiLDUsXCLlga1cIiw4LFwi5YG45YG55YG65YG85YG95YKB5YKC5YKD5YKE5YKG5YKH5YKJ5YKK5YKL5YKM5YKOXCIsMjAsXCLlgqTlgqblgqrlgqvlgq1cIiw0LFwi5YKzXCIsNixcIuWCvFwiXSxcbltcIjgzNDBcIixcIuWCvVwiLDE3LFwi5YOQXCIsNSxcIuWDl+WDmOWDmeWDm1wiLDEwLFwi5YOo5YOp5YOq5YOr5YOv5YOw5YOx5YOy5YO05YO2XCIsNCxcIuWDvFwiLDksXCLlhIhcIl0sXG5bXCI4MzgwXCIsXCLlhInlhIrlhIxcIiw1LFwi5YSTXCIsMTMsXCLlhKJcIiwyOCxcIuWFguWFh+WFiuWFjOWFjuWFj+WFkOWFkuWFk+WFl+WFmOWFmeWFm+WFnVwiLDQsXCLlhaPlhaTlhablhaflhanlharlha/lhbLlhbrlhb7lhb/lhoPlhoTlhoblhoflhorlhovlho7lho/lhpDlhpHlhpPlhpTlhpjlhprlhp3lhp7lhp/lhqHlhqPlhqZcIiw0LFwi5Yat5Yau5Ya05Ya45Ya55Ya65Ya+5Ya/5YeB5YeC5YeD5YeF5YeI5YeK5YeN5YeO5YeQ5YeSXCIsNV0sXG5bXCI4NDQwXCIsXCLlh5jlh5nlh5rlh5zlh57lh5/lh6Llh6Plh6VcIiw1LFwi5Yes5Yeu5Yex5Yey5Ye05Ye35Ye+5YiE5YiF5YiJ5YiL5YiM5YiP5YiQ5YiT5YiU5YiV5Yic5Yie5Yif5Yih5Yii5Yij5Yil5Yim5Yin5Yiq5Yis5Yiv5Yix5Yiy5Yi05Yi15Yi85Yi+5YmEXCIsNSxcIuWJi+WJjuWJj+WJkuWJk+WJleWJl+WJmFwiXSxcbltcIjg0ODBcIixcIuWJmeWJmuWJm+WJneWJn+WJoOWJouWJo+WJpOWJpuWJqOWJq+WJrOWJreWJruWJsOWJseWJs1wiLDksXCLlib7lioDlioNcIiw0LFwi5YqJXCIsNixcIuWKkeWKkuWKlFwiLDYsXCLlipzliqTliqXliqbliqfliq7liq/lirDlirRcIiw5LFwi5YuA5YuB5YuC5YuE5YuF5YuG5YuI5YuK5YuM5YuN5YuO5YuP5YuR5YuT5YuU5YuV5YuX5YuZXCIsNSxcIuWLoOWLoeWLouWLo+WLpVwiLDEwLFwi5YuxXCIsNyxcIuWLu+WLvOWLveWMgeWMguWMg+WMhOWMh+WMieWMiuWMi+WMjOWMjlwiXSxcbltcIjg1NDBcIixcIuWMkeWMkuWMk+WMlOWMmOWMm+WMnOWMnuWMn+WMouWMpOWMpeWMp+WMqOWMqeWMq+WMrOWMreWMr1wiLDksXCLljLzljL3ljYDljYLljYTljYbljYvljYzljY3ljZDljZTljZjljZnljZvljZ3ljaXljajljarljazlja3ljbLljbbljbnljbvljbzljb3ljb7ljoDljoHljoPljofljojljorljo7ljo9cIl0sXG5bXCI4NTgwXCIsXCLljpBcIiw0LFwi5Y6W5Y6X5Y6Z5Y6b5Y6c5Y6e5Y6g5Y6h5Y6k5Y6n5Y6q5Y6r5Y6s5Y6t5Y6vXCIsNixcIuWOt+WOuOWOueWOuuWOvOWOveWOvuWPgOWPg1wiLDQsXCLlj47lj4/lj5Dlj5Llj5Plj5Xlj5rlj5zlj53lj57lj6Hlj6Llj6flj7Tlj7rlj77lj7/lkIDlkILlkIXlkIflkIvlkJTlkJjlkJnlkJrlkJzlkKLlkKTlkKXlkKrlkLDlkLPlkLblkLflkLrlkL3lkL/lkYHlkYLlkYTlkYXlkYflkYnlkYzlkY3lkY7lkY/lkZHlkZrlkZ1cIiw0LFwi5ZGj5ZGl5ZGn5ZGpXCIsNyxcIuWRtOWRueWRuuWRvuWRv+WSgeWSg+WSheWSh+WSiOWSieWSiuWSjeWSkeWSk+WSl+WSmOWSnOWSnuWSn+WSoOWSoVwiXSxcbltcIjg2NDBcIixcIuWSouWSpeWSruWSsOWSsuWSteWStuWSt+WSueWSuuWSvOWSvuWTg+WTheWTiuWTi+WTluWTmOWTm+WToFwiLDQsXCLlk6vlk6zlk6/lk7Dlk7Hlk7RcIiw1LFwi5ZO75ZO+5ZSA5ZSC5ZSD5ZSE5ZSF5ZSI5ZSKXCIsNCxcIuWUkuWUk+WUlVwiLDUsXCLllJzllJ3llJ7llJ/llKHllKXllKZcIl0sXG5bXCI4NjgwXCIsXCLllKjllKnllKvllK3llLLllLTllLXllLbllLjllLnllLrllLvllL3llYDllYLllYXllYfllYjllYtcIiw0LFwi5ZWR5ZWS5ZWT5ZWU5ZWXXCIsNCxcIuWVneWVnuWVn+WVoOWVouWVo+WVqOWVqeWVq+WVr1wiLDUsXCLllbnllbrllb3llb/lloXllobllozllo3llo7llpDllpLllpPllpXllpbllpfllprllpvllp7llqBcIiw2LFwi5ZaoXCIsOCxcIuWWsuWWtOWWtuWWuOWWuuWWvOWWv1wiLDQsXCLll4bll4fll4jll4rll4vll47ll4/ll5Dll5Xll5dcIiw0LFwi5Zee5Zeg5Zei5Zen5Zep5Zet5Zeu5Zew5Zex5Ze05Ze25Ze4XCIsNCxcIuWXv+WYguWYg+WYhOWYhVwiXSxcbltcIjg3NDBcIixcIuWYhuWYh+WYiuWYi+WYjeWYkFwiLDcsXCLlmJnlmJrlmJzlmJ3lmKDlmKHlmKLlmKXlmKblmKjlmKnlmKrlmKvlmK7lmK/lmLDlmLPlmLXlmLflmLjlmLrlmLzlmL3lmL7lmYBcIiwxMSxcIuWZj1wiLDQsXCLlmZXlmZblmZrlmZvlmZ1cIiw0XSxcbltcIjg3ODBcIixcIuWZo+WZpeWZpuWZp+WZreWZruWZr+WZsOWZsuWZs+WZtOWZteWZt+WZuOWZueWZuuWZvVwiLDcsXCLlmodcIiw2LFwi5ZqQ5ZqR5ZqS5ZqUXCIsMTQsXCLlmqRcIiwxMCxcIuWasFwiLDYsXCLlmrjlmrnlmrrlmrvlmr1cIiwxMixcIuWbi1wiLDgsXCLlm5Xlm5blm5jlm5nlm5zlm6Plm6VcIiw1LFwi5Zus5Zuu5Zuv5Zuy5Zuz5Zu25Zu35Zu45Zu75Zu85ZyA5ZyB5ZyC5ZyF5ZyH5ZyLXCIsNl0sXG5bXCI4ODQwXCIsXCLlnJJcIiw5LFwi5Zyd5Zye5Zyg5Zyh5Zyi5Zyk5Zyl5Zym5Zyn5Zyr5Zyx5Zyy5Zy0XCIsNCxcIuWcvOWcveWcv+WdgeWdg+WdhOWdheWdhuWdiOWdieWdi+WdklwiLDQsXCLlnZjlnZnlnaLlnaPlnaXlnaflnazlna7lnbDlnbHlnbLlnbTlnbXlnbjlnbnlnbrlnb3lnb7lnb/lnoBcIl0sXG5bXCI4ODgwXCIsXCLlnoHlnoflnojlnonlnorlno1cIiw0LFwi5Z6UXCIsNixcIuWenOWeneWenuWen+WepeWeqOWequWerOWer+WesOWeseWes+WeteWetuWet+WeuVwiLDgsXCLln4RcIiw2LFwi5Z+M5Z+N5Z+Q5Z+R5Z+T5Z+W5Z+X5Z+b5Z+c5Z+e5Z+h5Z+i5Z+j5Z+lXCIsNyxcIuWfruWfsOWfseWfsuWfs+WfteWftuWft+Wfu+WfvOWfvuWfv+WggeWgg+WghOWgheWgiOWgieWgiuWgjOWgjuWgj+WgkOWgkuWgk+WglOWgluWgl+WgmOWgmuWgm+WgnOWgneWgn+WgouWgo+WgpVwiLDQsXCLloKtcIiw0LFwi5aCx5aCy5aCz5aC05aC2XCIsN10sXG5bXCI4OTQwXCIsXCLloL5cIiw1LFwi5aGFXCIsNixcIuWhjuWhj+WhkOWhkuWhk+WhleWhluWhl+WhmVwiLDQsXCLloZ9cIiw1LFwi5aGmXCIsNCxcIuWhrVwiLDE2LFwi5aG/5aKC5aKE5aKG5aKH5aKI5aKK5aKL5aKMXCJdLFxuW1wiODk4MFwiLFwi5aKNXCIsNCxcIuWilFwiLDQsXCLlopvlopzlop3loqBcIiw3LFwi5aKqXCIsMTcsXCLlor3lor7lor/lo4Dlo4Llo4Plo4Tlo4ZcIiwxMCxcIuWjkuWjk+WjlOWjllwiLDEzLFwi5aOlXCIsNSxcIuWjreWjr+WjseWjsuWjtOWjteWjt+WjuOWjulwiLDcsXCLlpIPlpIXlpIblpIhcIiw0LFwi5aSO5aSQ5aSR5aSS5aST5aSX5aSY5aSb5aSd5aSe5aSg5aSh5aSi5aSj5aSm5aSo5aSs5aSw5aSy5aSz5aS15aS25aS7XCJdLFxuW1wiOGE0MFwiLFwi5aS95aS+5aS/5aWA5aWD5aWF5aWG5aWK5aWM5aWN5aWQ5aWS5aWT5aWZ5aWbXCIsNCxcIuWloeWlo+WlpOWlplwiLDEyLFwi5aW15aW35aW65aW75aW85aW+5aW/5aaA5aaF5aaJ5aaL5aaM5aaO5aaP5aaQ5aaR5aaU5aaV5aaY5aaa5aab5aac5aad5aaf5aag5aah5aai5aamXCJdLFxuW1wiOGE4MFwiLFwi5aan5aas5aat5aaw5aax5aazXCIsNSxcIuWmuuWmvOWmveWmv1wiLDYsXCLlp4flp4jlp4nlp4zlp43lp47lp4/lp5Xlp5blp5nlp5vlp55cIiw0LFwi5aek5aem5aen5aep5aeq5aer5aetXCIsMTEsXCLlp7rlp7zlp73lp77lqIDlqILlqIrlqIvlqI3lqI7lqI/lqJDlqJLlqJTlqJXlqJblqJflqJnlqJrlqJvlqJ3lqJ7lqKHlqKLlqKTlqKblqKflqKjlqKpcIiw2LFwi5aiz5ai15ai3XCIsNCxcIuWoveWovuWov+WpgVwiLDQsXCLlqYflqYjlqYtcIiw5LFwi5amW5amX5amY5amZ5ambXCIsNV0sXG5bXCI4YjQwXCIsXCLlqaHlqaPlqaTlqaXlqablqajlqanlqatcIiw4LFwi5am45am55am75am85am95am+5aqAXCIsMTcsXCLlqpNcIiw2LFwi5aqcXCIsMTMsXCLlqqvlqqxcIl0sXG5bXCI4YjgwXCIsXCLlqq1cIiw0LFwi5aq05aq25aq35aq5XCIsNCxcIuWqv+WrgOWrg1wiLDUsXCLlq4rlq4vlq41cIiw0LFwi5auT5auV5auX5auZ5aua5aub5aud5aue5auf5aui5auk5aul5aun5auo5auq5ausXCIsNCxcIuWrslwiLDIyLFwi5ayKXCIsMTEsXCLlrJhcIiwyNSxcIuWss+WsteWstuWsuFwiLDcsXCLlrYFcIiw2XSxcbltcIjhjNDBcIixcIuWtiFwiLDcsXCLlrZLlrZblrZ7lraDlraHlraflrajlravlra3lra7lra/lrbLlrbTlrbblrbflrbjlrbnlrbvlrbzlrb7lrb/lroLlroblrorlro3lro7lrpDlrpHlrpLlrpTlrpblrp/lrqflrqjlrqnlrqzlrq3lrq7lrq/lrrHlrrLlrrflrrrlrrvlrrzlr4Dlr4Hlr4Plr4jlr4nlr4rlr4vlr43lr47lr49cIl0sXG5bXCI4YzgwXCIsXCLlr5Hlr5RcIiw4LFwi5a+g5a+i5a+j5a+m5a+n5a+pXCIsNCxcIuWvr+WvsVwiLDYsXCLlr73lr77lsIDlsILlsIPlsIXlsIflsIjlsIvlsIzlsI3lsI7lsJDlsJLlsJPlsJflsJnlsJvlsJ7lsJ/lsKDlsKHlsKPlsKblsKjlsKnlsKrlsKvlsK3lsK7lsK/lsLDlsLLlsLPlsLXlsLblsLflsYPlsYTlsYblsYflsYzlsY3lsZLlsZPlsZTlsZblsZflsZjlsZrlsZvlsZzlsZ3lsZ/lsaLlsaTlsadcIiw2LFwi5bGw5bGyXCIsNixcIuWxu+WxvOWxveWxvuWygOWyg1wiLDQsXCLlsonlsorlsovlso7lso/lspLlspPlspXlsp1cIiw0LFwi5bKkXCIsNF0sXG5bXCI4ZDQwXCIsXCLlsqrlsq7lsq/lsrDlsrLlsrTlsrblsrnlsrrlsrvlsrzlsr7ls4Dls4Lls4Pls4VcIiw1LFwi5bOMXCIsNSxcIuWzk1wiLDUsXCLls5pcIiw2LFwi5bOi5bOj5bOn5bOp5bOr5bOs5bOu5bOv5bOxXCIsOSxcIuWzvFwiLDRdLFxuW1wiOGQ4MFwiLFwi5bSB5bSE5bSF5bSIXCIsNSxcIuW0j1wiLDQsXCLltJXltJfltJjltJnltJrltJzltJ3ltJ9cIiw0LFwi5bSl5bSo5bSq5bSr5bSs5bSvXCIsNCxcIuW0tVwiLDcsXCLltL9cIiw3LFwi5bWI5bWJ5bWNXCIsMTAsXCLltZnltZrltZzltZ5cIiwxMCxcIuW1quW1reW1ruW1sOW1seW1suW1s+W1tVwiLDEyLFwi5baDXCIsMjEsXCLltprltpvltpzltp7ltp/ltqBcIl0sXG5bXCI4ZTQwXCIsXCLltqFcIiwyMSxcIuW2uFwiLDEyLFwi5beGXCIsNixcIuW3jlwiLDEyLFwi5bec5bef5beg5bej5bek5beq5bes5betXCJdLFxuW1wiOGU4MFwiLFwi5bew5be15be25be4XCIsNCxcIuW3v+W4gOW4hOW4h+W4ieW4iuW4i+W4jeW4juW4kuW4k+W4l+W4nlwiLDcsXCLluKhcIiw0LFwi5biv5biw5biyXCIsNCxcIuW4ueW4uuW4vuW4v+W5gOW5geW5g+W5hlwiLDUsXCLluY1cIiw2LFwi5bmWXCIsNCxcIuW5nOW5neW5n+W5oOW5o1wiLDE0LFwi5bm15bm35bm55bm+5bqB5bqC5bqD5bqF5bqI5bqJ5bqM5bqN5bqO5bqS5bqY5bqb5bqd5bqh5bqi5bqj5bqk5bqoXCIsNCxcIuW6rlwiLDQsXCLlurTlurrlurvlurzlur3lur9cIiw2XSxcbltcIjhmNDBcIixcIuW7huW7h+W7iOW7i1wiLDUsXCLlu5Tlu5Xlu5flu5jlu5nlu5rlu5xcIiwxMSxcIuW7qeW7q1wiLDgsXCLlu7Xlu7jlu7nlu7vlu7zlu73lvIXlvIblvIflvInlvIzlvI3lvI7lvJDlvJLlvJTlvJblvJnlvJrlvJzlvJ3lvJ7lvKHlvKLlvKPlvKRcIl0sXG5bXCI4ZjgwXCIsXCLlvKjlvKvlvKzlvK7lvLDlvLJcIiw2LFwi5by75by95by+5by/5b2BXCIsMTQsXCLlvZHlvZTlvZnlvZrlvZvlvZzlvZ7lvZ/lvaDlvaPlvaXlvaflvajlvavlva7lva/lvbLlvbTlvbXlvbblvbjlvbrlvb3lvb7lvb/lvoPlvoblvo3lvo7lvo/lvpHlvpPlvpTlvpblvprlvpvlvp3lvp7lvp/lvqDlvqJcIiw1LFwi5b6p5b6r5b6s5b6vXCIsNSxcIuW+tuW+uOW+ueW+uuW+u+W+vlwiLDQsXCLlv4flv4jlv4rlv4vlv47lv5Plv5Tlv5Xlv5rlv5vlv5zlv57lv5/lv6Llv6Plv6Xlv6blv6jlv6nlv6zlv6/lv7Dlv7Llv7Plv7Tlv7blv7flv7nlv7rlv7zmgIdcIl0sXG5bXCI5MDQwXCIsXCLmgIjmgInmgIvmgIzmgJDmgJHmgJPmgJfmgJjmgJrmgJ7mgJ/mgKLmgKPmgKTmgKzmgK3mgK7mgLBcIiw0LFwi5oC2XCIsNCxcIuaAveaAvuaBgOaBhFwiLDYsXCLmgYzmgY7mgY/mgZHmgZPmgZTmgZbmgZfmgZjmgZvmgZzmgZ7mgZ/mgaDmgaHmgaXmgabmga7mgbHmgbLmgbTmgbXmgbfmgb7mgoBcIl0sXG5bXCI5MDgwXCIsXCLmgoHmgoLmgoXmgobmgofmgojmgormgovmgo7mgo/mgpDmgpHmgpPmgpXmgpfmgpjmgpnmgpzmgp7mgqHmgqLmgqTmgqXmgqfmgqnmgqrmgq7mgrDmgrPmgrXmgrbmgrfmgrnmgrrmgr1cIiw3LFwi5oOH5oOI5oOJ5oOMXCIsNCxcIuaDkuaDk+aDlOaDluaDl+aDmeaDm+aDnuaDoVwiLDQsXCLmg6rmg7Hmg7Lmg7Xmg7fmg7jmg7tcIiw0LFwi5oSC5oSD5oSE5oSF5oSH5oSK5oSL5oSM5oSQXCIsNCxcIuaEluaEl+aEmOaEmeaEm+aEnOaEneaEnuaEoeaEouaEpeaEqOaEqeaEquaErFwiLDE4LFwi5oWAXCIsNl0sXG5bXCI5MTQwXCIsXCLmhYfmhYnmhYvmhY3mhY/mhZDmhZLmhZPmhZTmhZZcIiw2LFwi5oWe5oWf5oWg5oWh5oWj5oWk5oWl5oWm5oWpXCIsNixcIuaFseaFsuaFs+aFtOaFtuaFuFwiLDE4LFwi5oaM5oaN5oaPXCIsNCxcIuaGlVwiXSxcbltcIjkxODBcIixcIuaGllwiLDYsXCLmhp5cIiw4LFwi5oaq5oar5oatXCIsOSxcIuaGuFwiLDUsXCLmhr/mh4Dmh4Hmh4NcIiw0LFwi5oeJ5oeMXCIsNCxcIuaHk+aHlVwiLDE2LFwi5oenXCIsMTMsXCLmh7ZcIiw4LFwi5oiAXCIsNSxcIuaIh+aIieaIk+aIlOaImeaInOaIneaInuaIoOaIo+aIpuaIp+aIqOaIqeaIq+aIreaIr+aIsOaIseaIsuaIteaItuaIuFwiLDQsXCLmiYLmiYTmiYXmiYbmiYpcIl0sXG5bXCI5MjQwXCIsXCLmiY/miZDmiZXmiZbmiZfmiZnmiZrmiZxcIiw2LFwi5omk5oml5omo5omx5omy5om05om15om35om45om65om75om95oqB5oqC5oqD5oqF5oqG5oqH5oqI5oqLXCIsNSxcIuaKlOaKmeaKnOaKneaKnuaKo+aKpuaKp+aKqeaKquaKreaKruaKr+aKsOaKsuaKs+aKtOaKtuaKt+aKuOaKuuaKvuaLgOaLgVwiXSxcbltcIjkyODBcIixcIuaLg+aLi+aLj+aLkeaLleaLneaLnuaLoOaLoeaLpOaLquaLq+aLsOaLsuaLteaLuOaLueaLuuaLu+aMgOaMg+aMhOaMheaMhuaMiuaMi+aMjOaMjeaMj+aMkOaMkuaMk+aMlOaMleaMl+aMmOaMmeaMnOaMpuaMp+aMqeaMrOaMreaMruaMsOaMseaMs1wiLDUsXCLmjLvmjLzmjL7mjL/mjYDmjYHmjYTmjYfmjYjmjYrmjZHmjZLmjZPmjZTmjZZcIiw3LFwi5o2g5o2k5o2l5o2m5o2o5o2q5o2r5o2s5o2v5o2w5o2y5o2z5o205o215o245o255o285o295o2+5o2/5o6B5o6D5o6E5o6F5o6G5o6L5o6N5o6R5o6T5o6U5o6V5o6X5o6ZXCIsNixcIuaOoeaOpOaOpuaOq+aOr+aOseaOsuaOteaOtuaOueaOu+aOveaOv+aPgFwiXSxcbltcIjkzNDBcIixcIuaPgeaPguaPg+aPheaPh+aPiOaPiuaPi+aPjOaPkeaPk+aPlOaPleaPl1wiLDYsXCLmj5/mj6Lmj6RcIiw0LFwi5o+r5o+s5o+u5o+v5o+w5o+x5o+z5o+15o+35o+55o+65o+75o+85o++5pCD5pCE5pCGXCIsNCxcIuaQjeaQjuaQkeaQkuaQlVwiLDUsXCLmkJ3mkJ/mkKLmkKPmkKRcIl0sXG5bXCI5MzgwXCIsXCLmkKXmkKfmkKjmkKnmkKvmkK5cIiw1LFwi5pC1XCIsNCxcIuaQu+aQvOaQvuaRgOaRguaRg+aRieaRi1wiLDYsXCLmkZPmkZXmkZbmkZfmkZlcIiw0LFwi5pGfXCIsNyxcIuaRqOaRquaRq+aRrOaRrlwiLDksXCLmkbtcIiw2LFwi5pKD5pKG5pKIXCIsOCxcIuaSk+aSlOaSl+aSmOaSmuaSm+aSnOaSneaSn1wiLDQsXCLmkqXmkqbmkqfmkqjmkqrmkqvmkq/mkrHmkrLmkrPmkrTmkrbmkrnmkrvmkr3mkr7mkr/mk4Hmk4Pmk4Tmk4ZcIiw2LFwi5pOP5pOR5pOT5pOU5pOV5pOW5pOZ5pOaXCJdLFxuW1wiOTQ0MFwiLFwi5pOb5pOc5pOd5pOf5pOg5pOh5pOj5pOl5pOnXCIsMjQsXCLmlIFcIiw3LFwi5pSKXCIsNyxcIuaUk1wiLDQsXCLmlJlcIiw4XSxcbltcIjk0ODBcIixcIuaUouaUo+aUpOaUplwiLDQsXCLmlKzmlK3mlLDmlLHmlLLmlLPmlLfmlLrmlLzmlL3mlYBcIiw0LFwi5pWG5pWH5pWK5pWL5pWN5pWO5pWQ5pWS5pWT5pWU5pWX5pWY5pWa5pWc5pWf5pWg5pWh5pWk5pWl5pWn5pWo5pWp5pWq5pWt5pWu5pWv5pWx5pWz5pW15pW25pW4XCIsMTQsXCLmlojmlonmlormlo3mlo7mlo/mlpLmlpTmlpXmlpbmlpjmlprmlp3mlp7mlqDmlqLmlqPmlqbmlqjmlqrmlqzmlq7mlrFcIiw3LFwi5pa65pa75pa+5pa/5peA5peC5peH5peI5peJ5peK5peN5peQ5peR5peT5peU5peV5peYXCIsNyxcIuaXoeaXo+aXpOaXquaXq1wiXSxcbltcIjk1NDBcIixcIuaXsuaXs+aXtOaXteaXuOaXueaXu1wiLDQsXCLmmIHmmITmmIXmmIfmmIjmmInmmIvmmI3mmJDmmJHmmJLmmJbmmJfmmJjmmJrmmJvmmJzmmJ7mmKHmmKLmmKPmmKTmmKbmmKnmmKrmmKvmmKzmmK7mmLDmmLLmmLPmmLdcIiw0LFwi5pi95pi/5pmA5pmC5pmEXCIsNixcIuaZjeaZjuaZkOaZkeaZmFwiXSxcbltcIjk1ODBcIixcIuaZmeaZm+aZnOaZneaZnuaZoOaZouaZo+aZpeaZp+aZqVwiLDQsXCLmmbHmmbLmmbPmmbXmmbjmmbnmmbvmmbzmmb3mmb/mmoDmmoHmmoPmmoXmmobmmojmmonmmormmovmmo3mmo7mmo/mmpDmmpLmmpPmmpTmmpXmmphcIiw0LFwi5pqeXCIsOCxcIuaaqVwiLDQsXCLmmq9cIiw0LFwi5pq15pq25pq35pq45pq65pq75pq85pq95pq/XCIsMjUsXCLmm5rmm55cIiw3LFwi5pun5puo5puqXCIsNSxcIuabseabteabtuabuOabuuabu+abveacgeacguacg1wiXSxcbltcIjk2NDBcIixcIuachOacheachuach+acjOacjuacj+ackeackuack+acluacmOacmeacmuacnOacnuacoFwiLDUsXCLmnKfmnKnmnK7mnLDmnLLmnLPmnLbmnLfmnLjmnLnmnLvmnLzmnL7mnL/mnYHmnYTmnYXmnYfmnYrmnYvmnY3mnZLmnZTmnZXmnZdcIiw0LFwi5p2d5p2i5p2j5p2k5p2m5p2n5p2r5p2s5p2u5p2x5p205p22XCJdLFxuW1wiOTY4MFwiLFwi5p245p255p265p275p295p6A5p6C5p6D5p6F5p6G5p6I5p6K5p6M5p6N5p6O5p6P5p6R5p6S5p6T5p6U5p6W5p6Z5p6b5p6f5p6g5p6h5p6k5p6m5p6p5p6s5p6u5p6x5p6y5p605p65XCIsNyxcIuafguafhVwiLDksXCLmn5Xmn5bmn5fmn5vmn5/mn6Hmn6Pmn6Tmn6bmn6fmn6jmn6rmn6vmn63mn67mn7Lmn7VcIiw3LFwi5p++5qCB5qCC5qCD5qCE5qCG5qCN5qCQ5qCS5qCU5qCV5qCYXCIsNCxcIuagnuagn+agoOagolwiLDYsXCLmoKtcIiw2LFwi5qC05qC15qC25qC65qC75qC/5qGH5qGL5qGN5qGP5qGS5qGWXCIsNV0sXG5bXCI5NzQwXCIsXCLmoZzmoZ3moZ7moZ/moarmoaxcIiw3LFwi5qG15qG4XCIsOCxcIuaiguaihOaih1wiLDcsXCLmopDmopHmopLmopTmopXmopbmophcIiw5LFwi5qKj5qKk5qKl5qKp5qKq5qKr5qKs5qKu5qKx5qKy5qK05qK25qK35qK4XCJdLFxuW1wiOTc4MFwiLFwi5qK5XCIsNixcIuajgeajg1wiLDUsXCLmo4rmo4zmo47mo4/mo5Dmo5Hmo5Pmo5Tmo5bmo5fmo5nmo5tcIiw0LFwi5qOh5qOi5qOkXCIsOSxcIuajr+ajsuajs+ajtOajtuajt+ajuOaju+ajveajvuajv+akgOakguakg+akhOakhlwiLDQsXCLmpIzmpI/mpJHmpJNcIiwxMSxcIuakoeakouako+akpVwiLDcsXCLmpK7mpK/mpLHmpLLmpLPmpLXmpLbmpLfmpLjmpLrmpLvmpLzmpL7mpYDmpYHmpYNcIiwxNixcIualleallualmOalmealm+alnOaln1wiXSxcbltcIjk4NDBcIixcIualoealoualpOalpealp+alqOalqealqualrOalrealr+alsOalslwiLDQsXCLmpbrmpbvmpb3mpb7mpb/mpoHmpoPmpoXmpormpovmpozmpo5cIiw1LFwi5qaW5qaX5qaZ5qaa5qadXCIsOSxcIuamqeamquamrOamruamr+amsOamsuams+amteamtuamuOamueamuuamvOamvVwiXSxcbltcIjk4ODBcIixcIuamvuamv+angOanglwiLDcsXCLmp4vmp43mp4/mp5Hmp5Lmp5Pmp5VcIiw1LFwi5qec5qed5qee5qehXCIsMTEsXCLmp67mp6/mp7Dmp7Hmp7NcIiw5LFwi5qe+5qiAXCIsOSxcIuaoi1wiLDExLFwi5qiZXCIsNSxcIuaooOaoolwiLDUsXCLmqKnmqKvmqKzmqK3mqK7mqLDmqLLmqLPmqLTmqLZcIiw2LFwi5qi/XCIsNCxcIuapheaphuapiFwiLDcsXCLmqZFcIiw2LFwi5qmaXCJdLFxuW1wiOTk0MFwiLFwi5qmcXCIsNCxcIuapouapo+appOapplwiLDEwLFwi5qmyXCIsNixcIuapuuapu+apveapvuapv+aqgeaqguaqg+aqhVwiLDgsXCLmqo/mqpJcIiw0LFwi5qqYXCIsNyxcIuaqoVwiLDVdLFxuW1wiOTk4MFwiLFwi5qqn5qqo5qqq5qqtXCIsMTE0LFwi5qyl5qym5qyoXCIsNl0sXG5bXCI5YTQwXCIsXCLmrK/mrLDmrLHmrLPmrLTmrLXmrLbmrLjmrLvmrLzmrL3mrL/mrYDmrYHmrYLmrYTmrYXmrYjmrYrmrYvmrY1cIiwxMSxcIuatmlwiLDcsXCLmrajmranmratcIiwxMyxcIuatuuatveatvuatv+augOauheauiFwiXSxcbltcIjlhODBcIixcIuaujOaujuauj+aukOaukeaulOauleaul+aumOaumeaunFwiLDQsXCLmrqJcIiw3LFwi5q6rXCIsNyxcIuautuauuFwiLDYsXCLmr4Dmr4Pmr4Tmr4ZcIiw0LFwi5q+M5q+O5q+Q5q+R5q+Y5q+a5q+cXCIsNCxcIuavolwiLDcsXCLmr6zmr63mr67mr7Dmr7Hmr7Lmr7Tmr7bmr7fmr7jmr7rmr7vmr7zmr75cIiw2LFwi5rCIXCIsNCxcIuawjuawkuawl+awnOawneawnuawoOawo+awpeawq+awrOawreawseaws+awtuawt+awueawuuawu+awvOawvuawv+axg+axhOaxheaxiOaxi1wiLDQsXCLmsZHmsZLmsZPmsZbmsZhcIl0sXG5bXCI5YjQwXCIsXCLmsZnmsZrmsaLmsaPmsaXmsabmsafmsatcIiw0LFwi5rGx5rGz5rG15rG35rG45rG65rG75rG85rG/5rKA5rKE5rKH5rKK5rKL5rKN5rKO5rKR5rKS5rKV5rKW5rKX5rKY5rKa5rKc5rKd5rKe5rKg5rKi5rKo5rKs5rKv5rKw5rK05rK15rK25rK35rK65rOA5rOB5rOC5rOD5rOG5rOH5rOI5rOL5rON5rOO5rOP5rOR5rOS5rOYXCJdLFxuW1wiOWI4MFwiLFwi5rOZ5rOa5rOc5rOd5rOf5rOk5rOm5rOn5rOp5rOs5rOt5rOy5rO05rO55rO/5rSA5rSC5rSD5rSF5rSG5rSI5rSJ5rSK5rSN5rSP5rSQ5rSR5rST5rSU5rSV5rSW5rSY5rSc5rSd5rSfXCIsNSxcIua0pua0qOa0qea0rOa0rea0r+a0sOa0tOa0tua0t+a0uOa0uua0v+a1gOa1gua1hOa1iea1jOa1kOa1lea1lua1l+a1mOa1m+a1nea1n+a1oea1oua1pOa1pea1p+a1qOa1q+a1rOa1rea1sOa1sea1sua1s+a1tea1tua1uea1uua1u+a1vVwiLDQsXCLmtoPmtoTmtobmtofmtormtovmto3mto/mtpDmtpLmtpZcIiw0LFwi5rac5rai5ral5ras5rat5raw5rax5raz5ra05ra25ra35ra5XCIsNSxcIua3gea3gua3g+a3iOa3iea3ilwiXSxcbltcIjljNDBcIixcIua3jea3jua3j+a3kOa3kua3k+a3lOa3lea3l+a3mua3m+a3nOa3n+a3oua3o+a3pea3p+a3qOa3qea3qua3rea3r+a3sOa3sua3tOa3tea3tua3uOa3uua3vVwiLDcsXCLmuIbmuIfmuIjmuInmuIvmuI/muJLmuJPmuJXmuJjmuJnmuJvmuJzmuJ7muJ/muKLmuKbmuKfmuKjmuKrmuKzmuK7muLDmuLHmuLPmuLVcIl0sXG5bXCI5YzgwXCIsXCLmuLbmuLfmuLnmuLtcIiw3LFwi5rmFXCIsNyxcIua5j+a5kOa5kea5kua5lea5l+a5mea5mua5nOa5nea5nua5oFwiLDEwLFwi5rms5rmt5rmvXCIsMTQsXCLmuoDmuoHmuoLmuoTmuofmuojmuopcIiw0LFwi5rqRXCIsNixcIua6mea6mua6m+a6nea6nua6oOa6oea6o+a6pOa6pua6qOa6qea6q+a6rOa6rea6rua6sOa6s+a6tea6uOa6uea6vOa6vua6v+a7gOa7g+a7hOa7hea7hua7iOa7iea7iua7jOa7jea7jua7kOa7kua7lua7mOa7mea7m+a7nOa7nea7o+a7p+a7qlwiLDVdLFxuW1wiOWQ0MFwiLFwi5ruw5rux5ruy5ruz5ru15ru25ru35ru45ru6XCIsNyxcIua8g+a8hOa8hea8h+a8iOa8ilwiLDQsXCLmvJDmvJHmvJLmvJZcIiw5LFwi5ryh5ryi5ryj5ryl5rym5ryn5ryo5rys5ryu5ryw5ryy5ry05ry15ry3XCIsNixcIua8v+a9gOa9gea9glwiXSxcbltcIjlkODBcIixcIua9g+a9hOa9hea9iOa9iea9iua9jOa9jlwiLDksXCLmvZnmvZrmvZvmvZ3mvZ/mvaDmvaHmvaPmvaTmvaXmvadcIiw1LFwi5r2v5r2w5r2x5r2z5r215r225r235r255r275r29XCIsNixcIua+hea+hua+h+a+iua+i+a+j1wiLDEyLFwi5r6d5r6e5r6f5r6g5r6iXCIsNCxcIua+qFwiLDEwLFwi5r605r615r635r645r66XCIsNSxcIua/gea/g1wiLDUsXCLmv4pcIiw2LFwi5r+TXCIsMTAsXCLmv5/mv6Lmv6Pmv6Tmv6VcIl0sXG5bXCI5ZTQwXCIsXCLmv6ZcIiw3LFwi5r+wXCIsMzIsXCLngJJcIiw3LFwi54CcXCIsNixcIueApFwiLDZdLFxuW1wiOWU4MFwiLFwi54CrXCIsOSxcIueAtueAt+eAuOeAulwiLDE3LFwi54GN54GO54GQXCIsMTMsXCLngZ9cIiwxMSxcIueBrueBseeBsueBs+eBtOeBt+eBueeBuueBu+eBveeCgeeCgueCg+eChOeChueCh+eCiOeCi+eCjOeCjeeCj+eCkOeCkeeCk+eCl+eCmOeCmueCm+eCnlwiLDEyLFwi54Kw54Ky54K054K154K254K654K+54K/54OE54OF54OG54OH54OJ54OLXCIsMTIsXCLng5pcIl0sXG5bXCI5ZjQwXCIsXCLng5zng53ng57ng6Dng6Hng6Lng6Png6Xng6rng67ng7BcIiw2LFwi54O454O654O754O854O+XCIsMTAsXCLnhItcIiw0LFwi54SR54SS54SU54SX54SbXCIsMTAsXCLnhKdcIiw3LFwi54Sy54Sz54S0XCJdLFxuW1wiOWY4MFwiLFwi54S154S3XCIsMTMsXCLnhYbnhYfnhYjnhYnnhYvnhY3nhY9cIiwxMixcIueFneeFn1wiLDQsXCLnhaXnhalcIiw0LFwi54Wv54Ww54Wx54W054W154W254W354W554W754W854W+XCIsNSxcIueGhVwiLDQsXCLnhovnhoznho3nho7nhpDnhpHnhpLnhpPnhpXnhpbnhpfnhppcIiw0LFwi54ahXCIsNixcIueGqeeGqueGq+eGrVwiLDUsXCLnhrTnhrbnhrfnhrjnhrpcIiw4LFwi54eEXCIsOSxcIueHj1wiLDRdLFxuW1wiYTA0MFwiLFwi54eWXCIsOSxcIueHoeeHoueHo+eHpOeHpueHqFwiLDUsXCLnh69cIiw5LFwi54e6XCIsMTEsXCLniIdcIiwxOV0sXG5bXCJhMDgwXCIsXCLniJvniJzniJ5cIiw5LFwi54ip54ir54it54iu54iv54iy54iz54i054i654i854i+54mAXCIsNixcIueJieeJiueJi+eJjueJj+eJkOeJkeeJk+eJlOeJleeJl+eJmOeJmueJnOeJnueJoOeJo+eJpOeJpeeJqOeJqueJq+eJrOeJreeJsOeJseeJs+eJtOeJtueJt+eJuOeJu+eJvOeJveeKgueKg+eKhVwiLDQsXCLnioznio7nipDnipHnipNcIiwxMSxcIueKoFwiLDExLFwi54qu54qx54qy54qz54q154q6XCIsNixcIueLheeLhueLh+eLieeLiueLi+eLjOeLj+eLkeeLk+eLlOeLleeLlueLmOeLmueLm1wiXSxcbltcImExYTFcIixcIuOAgOOAgeOAgsK3y4nLh8Ko44CD44CF4oCU772e4oCW4oCm4oCY4oCZ4oCc4oCd44CU44CV44CIXCIsNyxcIuOAluOAl+OAkOOAkcKxw5fDt+KItuKIp+KIqOKIkeKIj+KIquKIqeKIiOKIt+KImuKKpeKIpeKIoOKMkuKKmeKIq+KIruKJoeKJjOKJiOKIveKIneKJoOKJruKJr+KJpOKJpeKInuKIteKItOKZguKZgMKw4oCy4oCz4oSD77yEwqTvv6Dvv6HigLDCp+KEluKYhuKYheKXi+KXj+KXjuKXh+KXhuKWoeKWoOKWs+KWsuKAu+KGkuKGkOKGkeKGk+OAk1wiXSxcbltcImEyYTFcIixcIuKFsFwiLDldLFxuW1wiYTJiMVwiLFwi4pKIXCIsMTksXCLikbRcIiwxOSxcIuKRoFwiLDldLFxuW1wiYTJlNVwiLFwi44igXCIsOV0sXG5bXCJhMmYxXCIsXCLihaBcIiwxMV0sXG5bXCJhM2ExXCIsXCLvvIHvvILvvIPvv6XvvIVcIiw4OCxcIu+/o1wiXSxcbltcImE0YTFcIixcIuOBgVwiLDgyXSxcbltcImE1YTFcIixcIuOCoVwiLDg1XSxcbltcImE2YTFcIixcIs6RXCIsMTYsXCLOo1wiLDZdLFxuW1wiYTZjMVwiLFwizrFcIiwxNixcIs+DXCIsNl0sXG5bXCJhNmUwXCIsXCLvuLXvuLbvuLnvuLrvuL/vuYDvuL3vuL7vuYHvuYLvuYPvuYRcIl0sXG5bXCJhNmVlXCIsXCLvuLvvuLzvuLfvuLjvuLFcIl0sXG5bXCJhNmY0XCIsXCLvuLPvuLRcIl0sXG5bXCJhN2ExXCIsXCLQkFwiLDUsXCLQgdCWXCIsMjVdLFxuW1wiYTdkMVwiLFwi0LBcIiw1LFwi0ZHQtlwiLDI1XSxcbltcImE4NDBcIixcIsuKy4vLmeKAk+KAleKApeKAteKEheKEieKGluKGl+KGmOKGmeKIleKIn+KIo+KJkuKJpuKJp+KKv+KVkFwiLDM1LFwi4paBXCIsNl0sXG5bXCJhODgwXCIsXCLilohcIiw3LFwi4paT4paU4paV4pa84pa94pei4pej4pek4pel4piJ4oqV44CS44Cd44CeXCJdLFxuW1wiYThhMVwiLFwixIHDoceOw6DEk8OpxJvDqMSrw63HkMOsxY3Ds8eSw7LFq8O6x5TDuceWx5jHmsecw7zDqsmRXCJdLFxuW1wiYThiZFwiLFwixYTFiFwiXSxcbltcImE4YzBcIixcIsmhXCJdLFxuW1wiYThjNVwiLFwi44SFXCIsMzZdLFxuW1wiYTk0MFwiLFwi44ChXCIsOCxcIuOKo+OOjuOOj+OOnOOOneOOnuOOoeOPhOOPjuOPkeOPkuOPle+4sO+/ou+/pFwiXSxcbltcImE5NTlcIixcIuKEoeOIsVwiXSxcbltcImE5NWNcIixcIuKAkFwiXSxcbltcImE5NjBcIixcIuODvOOCm+OCnOODveODvuOAhuOCneOCnu+5iVwiLDksXCLvuZTvuZXvuZbvuZfvuZlcIiw4XSxcbltcImE5ODBcIixcIu+5olwiLDQsXCLvuajvuanvuarvuatcIl0sXG5bXCJhOTk2XCIsXCLjgIdcIl0sXG5bXCJhOWE0XCIsXCLilIBcIiw3NV0sXG5bXCJhYTQwXCIsXCLni5zni53ni5/ni6JcIiw1LFwi54uq54ur54u154u254u554u954u+54u/54yA54yC54yEXCIsNSxcIueMi+eMjOeMjeeMj+eMkOeMkeeMkueMlOeMmOeMmeeMmueMn+eMoOeMo+eMpOeMpueMp+eMqOeMreeMr+eMsOeMsueMs+eMteeMtueMuueMu+eMvOeMveeNgFwiLDhdLFxuW1wiYWE4MFwiLFwi542J542K542L542M542O542P542R542T542U542V542W542YXCIsNyxcIueNoVwiLDEwLFwi542u542w542xXCJdLFxuW1wiYWI0MFwiLFwi542yXCIsMTEsXCLnjb9cIiw0LFwi546F546G546I546K546M546N546P546Q546S546T546U546V546X546Y546Z546a546c546d546e546g546h546jXCIsNSxcIueOqueOrOeOreeOseeOtOeOteeOtueOuOeOueeOvOeOveeOvueOv+ePgeePg1wiLDRdLFxuW1wiYWI4MFwiLFwi54+L54+M54+O54+SXCIsNixcIuePmuePm+ePnOePneePn+ePoeePouePo+ePpOePpuePqOePquePq+ePrOePruePr+ePsOePseePs1wiLDRdLFxuW1wiYWM0MFwiLFwi54+4XCIsMTAsXCLnkITnkIfnkIjnkIvnkIznkI3nkI7nkJFcIiw4LFwi55CcXCIsNSxcIueQo+eQpOeQp+eQqeeQq+eQreeQr+eQseeQsueQt1wiLDQsXCLnkL3nkL7nkL/nkYDnkYJcIiwxMV0sXG5bXCJhYzgwXCIsXCLnkY5cIiw2LFwi55GW55GY55Gd55GgXCIsMTIsXCLnka7nka/nkbFcIiw0LFwi55G455G555G6XCJdLFxuW1wiYWQ0MFwiLFwi55G755G855G955G/55KC55KE55KF55KG55KI55KJ55KK55KM55KN55KP55KRXCIsMTAsXCLnkp3nkp9cIiw3LFwi55KqXCIsMTUsXCLnkrtcIiwxMl0sXG5bXCJhZDgwXCIsXCLnk4hcIiw5LFwi55OTXCIsOCxcIueTneeTn+eToeeTpeeTp1wiLDYsXCLnk7Dnk7Hnk7JcIl0sXG5bXCJhZTQwXCIsXCLnk7Pnk7Xnk7hcIiw2LFwi55SA55SB55SC55SD55SFXCIsNyxcIueUjueUkOeUkueUlOeUleeUlueUl+eUm+eUneeUnueUoFwiLDQsXCLnlKbnlKfnlKrnlK7nlLTnlLbnlLnnlLznlL3nlL/nlYHnlYLnlYPnlYTnlYbnlYfnlYnnlYrnlY3nlZDnlZHnlZLnlZPnlZXnlZbnlZfnlZhcIl0sXG5bXCJhZTgwXCIsXCLnlZ1cIiw3LFwi55Wn55Wo55Wp55WrXCIsNixcIueVs+eVteeVtueVt+eVulwiLDQsXCLnloDnloHnloLnloTnloXnlodcIl0sXG5bXCJhZjQwXCIsXCLnlojnlonnlornloznlo3nlo7nlpDnlpPnlpXnlpjnlpvnlpznlp7nlqLnlqZcIiw0LFwi55at55a255a355a655a755a/55eA55eB55eG55eL55eM55eO55eP55eQ55eR55eT55eX55eZ55ea55ec55ed55ef55eg55eh55el55ep55es55et55eu55ev55ey55ez55e155e255e355e455e655e755e955e+55iC55iE55iG55iHXCJdLFxuW1wiYWY4MFwiLFwi55iI55iJ55iL55iN55iO55iP55iR55iS55iT55iU55iW55ia55ic55id55ie55ih55ij55in55io55is55iu55iv55ix55iy55i255i355i555i655i755i955mB55mC55mEXCJdLFxuW1wiYjA0MFwiLFwi55mFXCIsNixcIueZjlwiLDUsXCLnmZXnmZdcIiw0LFwi55md55mf55mg55mh55mi55mkXCIsNixcIueZrOeZreeZrueZsFwiLDcsXCLnmbnnmbrnmbznmb/nmoDnmoHnmoPnmoXnmonnmornmoznmo3nmo/nmpDnmpLnmpTnmpXnmpfnmpjnmprnmptcIl0sXG5bXCJiMDgwXCIsXCLnmpxcIiw3LFwi55qlXCIsOCxcIuear+easOeas+eatVwiLDksXCLnm4Dnm4Hnm4PllYrpmL/ln4PmjKjlk47llInlk4DnmpHnmYzolLznn67oib7noo3niLHpmpjpno3msKjlronkv7rmjInmmpflsrjog7rmoYjogq7mmILnm47lh7nmlZbnhqznv7HoooTlgrLlpaXmh4rmvrPoiq3mjYzmiZLlj63lkKfnrIblhavnlqTlt7Tmi5Tot4vpnbbmiorogJnlnZ3pnLjnvaLniLjnmb3mn4/nmb7mkYbkvbDotKXmi5znqJfmlpHnj63mkKzmibPoiKzpooHmnb/niYjmia7mi4zkvLTnk6PljYrlip7nu4rpgqbluK7moobmppzohoDnu5Hmo5Lno4XomozplZHlgo3osKToi57og57ljIXopJLliaVcIl0sXG5bXCJiMTQwXCIsXCLnm4Tnm4fnm4nnm4vnm4znm5Pnm5Xnm5nnm5rnm5znm53nm57nm6BcIiw0LFwi55umXCIsNyxcIuebsOebs+ebteebtuebt+ebuuebu+ebveebv+ecgOecguecg+echeechueciuecjOecjlwiLDEwLFwi55yb55yc55yd55ye55yh55yj55yk55yl55yn55yq55yrXCJdLFxuW1wiYjE4MFwiLFwi55ys55yu55ywXCIsNCxcIuecueecu+ecveecvuecv+edguedhOedheedhuediFwiLDcsXCLnnZJcIiw3LFwi552c6JaE6Zu55L+d5aCh6aWx5a6d5oqx5oql5pq06LG56bKN54iG5p2v56KR5oKy5Y2R5YyX6L6I6IOM6LSd6ZKh5YCN54uI5aSH5oOr54SZ6KKr5aWU6Iuv5pys56yo5bSp57u355St5rO16Lmm6L+46YC86by75q+U6YSZ56yU5b2856Kn6JOW6JS95q+V5q+Z5q+W5biB5bqH55e56Zet5pWd5byK5b+F6L6f5aOB6IeC6YG/6Zmb6Z6t6L6557yW6LSs5omB5L6/5Y+Y5Y2e6L6o6L6p6L6r6YGN5qCH5b2q6IaY6KGo6bOW5oaL5Yir55iq5b2s5paM5r+S5ruo5a6+5pGI5YW15Yaw5p+E5LiZ56eJ6aW854KzXCJdLFxuW1wiYjI0MFwiLFwi552d552e552f552g552k552n552p552q552tXCIsMTEsXCLnnbrnnbvnnbznnoHnnoLnnoPnnoZcIiw1LFwi556P556Q556TXCIsMTEsXCLnnqHnnqPnnqTnnqbnnqjnnqvnnq3nnq7nnq/nnrHnnrLnnrTnnrZcIiw0XSxcbltcImIyODBcIixcIueevOeevuefgFwiLDEyLFwi55+OXCIsOCxcIuefmOefmeefmuefnVwiLDQsXCLnn6Tnl4Xlubbnjrvoj6Dmkq3mi6jpkrXms6LljZrli4PmkI/pk4LnrpTkvK/luJvoiLbohJbohormuKTms4rpqbPmjZXljZzlk7rooaXln6DkuI3luIPmraXnsL/pg6jmgJbmk6bnjJzoo4HmnZDmiY3otKLnnazouKnph4flvanoj5zolKHppJDlj4LompXmrovmg63mg6jngb/oi43oiLHku5Pmsqfol4/mk43ns5nmp73mm7nojYnljpXnrZbkvqflhozmtYvlsYLoua3mj5Llj4nojKzojLbmn6XnorTmkL3lr5/lspTlt67or6fmi4bmn7TosbrmkIDmjrronYnppovosJfnvKDpk7LkuqfpmJDpoqTmmIznjJZcIl0sXG5bXCJiMzQwXCIsXCLnn6bnn6jnn6rnn6/nn7Dnn7Hnn7Lnn7Tnn7Xnn7fnn7nnn7rnn7vnn7znoINcIiw1LFwi56CK56CL56CO56CP56CQ56CT56CV56CZ56Cb56Ce56Cg56Ch56Ci56Ck56Co56Cq56Cr56Cu56Cv56Cx56Cy56Cz56C156C256C956C/56GB56GC56GD56GE56GG56GI56GJ56GK56GL56GN56GP56GR56GT56GU56GY56GZ56GaXCJdLFxuW1wiYjM4MFwiLFwi56Gb56Gc56GeXCIsMTEsXCLnoa9cIiw3LFwi56G456G556G656G756G9XCIsNixcIuWcuuWwneW4uOmVv+WBv+iCoOWOguaVnueVheWUseWAoei2heaKhOmSnuacneWYsua9ruW3ouWQteeCkui9puaJr+aSpOaOo+W9u+a+iOmDtOiHo+i+sOWwmOaZqOW/seayiemZiOi2geihrOaSkeensOWfjuapmeaIkOWRiOS5mOeoi+aDqea+hOivmuaJv+mAnumqi+enpOWQg+eXtOaMgeWMmeaxoOi/n+W8m+mpsOiAu+m9v+S+iOWwuui1pOe/heaWpeeCveWFheWGsuiZq+W0h+WuoOaKvemFrOeVtOi4jOeooOaEgeetueS7h+e7uOeeheS4keiHreWIneWHuuapseWOqOi6h+mUhOmbj+a7gemZpOalmlwiXSxcbltcImI0NDBcIixcIueihOeiheeihueiiOeiiueii+eij+eikOeikueilOeileeilueimeeineeinueioOeioueipOeipueiqFwiLDcsXCLnorXnorbnorfnorjnorrnorvnorznor3nor/no4Dno4Lno4Pno4Tno4bno4fno4jno4zno43no47no4/no5Hno5Lno5Pno5bno5fno5jno5pcIiw5XSxcbltcImI0ODBcIixcIuejpOejpeejpuejp+ejqeejquejq+ejrVwiLDQsXCLno7Pno7Xno7bno7jno7nno7tcIiw1LFwi56SC56SD56SE56SGXCIsNixcIuehgOWCqOefl+aQkOinpuWkhOaPo+W3neepv+akveS8oOiIueWWmOS4sueWrueql+W5ouW6iumXr+WIm+WQueeCiuaNtumUpOWeguaYpeakv+mGh+WUh+a3s+e6r+igouaIs+e7sOeWteiMqOejgembjOi+nuaFiOeTt+ivjeatpOWIuui1kOasoeiBquiRseWbseWMhuS7juS4m+WHkeeyl+mGi+ewh+S/g+i5v+evoeeqnOaRp+W0lOWCrOiEhueYgeeyuea3rOe/oOadkeWtmOWvuOeji+aSruaQk+aOquaMq+mUmeaQrei+vuetlOeYqeaJk+Wkp+WRhuatueWCo+aItOW4puauhuS7o+i0t+iii+W+hemArlwiXSxcbltcImI1NDBcIixcIuekjVwiLDUsXCLnpJRcIiw5LFwi56SfXCIsNCxcIuekpVwiLDE0LFwi56S1XCIsNCxcIuekveekv+elguelg+elhOelheelh+elilwiLDgsXCLnpZTnpZXnpZjnpZnnpaHnpaNcIl0sXG5bXCJiNTgwXCIsXCLnpaTnpabnpannparnpavnpaznpa7npbBcIiw2LFwi56W556W7XCIsNCxcIuemguemg+emhuemh+emiOemieemi+emjOemjeemjuemkOemkeemkuaAoOiAveaLheS4ueWNlemDuOaOuOiDhuaXpuawruS9huaDrua3oeivnuW8ueibi+W9k+aMoeWFmuiNoeaho+WIgOaNo+i5iOWAkuWym+elt+WvvOWIsOeou+aCvOmBk+ebl+W+t+W+l+eahOi5rOeBr+eZu+etieeequWHs+mCk+WgpOS9jua7tOi/quaVjOesm+eLhOa2pOe/n+WroeaKteW6leWcsOiSguesrOW4neW8n+mAkue8lOmioOaOgua7h+eimOeCueWFuOmdm+Weq+eUteS9g+eUuOW6l+aDpuWloOa3gOauv+eiieWPvOmbleWHi+WIgeaOieWQiumSk+iwg+i3jOeIueein+idtui/reiwjeWPoFwiXSxcbltcImI2NDBcIixcIuemk1wiLDYsXCLnpptcIiwxMSxcIuemqFwiLDEwLFwi56a0XCIsNCxcIuemvOemv+enguenhOenheenh+eniOeniuenjOenjuenj+enkOenk+enlOenluenl+enmVwiLDUsXCLnp6Dnp6Hnp6Lnp6Xnp6jnp6pcIl0sXG5bXCJiNjgwXCIsXCLnp6znp67np7FcIiw2LFwi56e556e656e856e+56e/56iB56iE56iF56iH56iI56iJ56iK56iM56iPXCIsNCxcIueoleeolueomOeomeeom+eonOS4geebr+WPrumSiemhtum8jumUreWumuiuouS4ouS4nOWGrOiRo+aHguWKqOagi+S+l+aBq+WGu+a0nuWFnOaKluaWl+mZoeixhumAl+eXmOmDveedo+avkueKiueLrOivu+Wgteeduei1jOadnOmVgOiCmuW6pua4oeWmkuerr+efremUu+auteaWree8juWghuWFkemYn+WvueWiqeWQqOi5suaVpumhv+WbpOmSneebvumBgeaOh+WThuWkmuWkuuWem+i6suactei3uuiIteWJgeaDsOWgleibvuWzqOm5heS/hOmineiuueWopeaBtuWOhOaJvOmBj+mEgumlv+aBqeiAjOWEv+iAs+WwlOmltea0seS6jFwiXSxcbltcImI3NDBcIixcIueoneeon+eooeeooueopFwiLDE0LFwi56i056i156i256i456i656i+56mAXCIsNSxcIueph1wiLDksXCLnqZJcIiw0LFwi56mYXCIsMTZdLFxuW1wiYjc4MFwiLFwi56mpXCIsNixcIuepseepsueps+epteepu+epvOepveepvueqgueqheeqh+eqieeqiueqi+eqjOeqjueqj+eqkOeqk+eqlOeqmeeqmueqm+eqnueqoeeqoui0sOWPkee9muetj+S8kOS5j+mYgOazleePkOiXqeW4hueVque/u+aoiuefvumSkue5geWHoeeDpuWPjei/lOiMg+i0qeeKr+mlreazm+WdiuiKs+aWueiCquaIv+mYsuWmqOS7v+iuv+e6uuaUvuiPsumdnuWVoemjnuiCpeWMquivveWQoOiCuuW6n+ayuOi0ueiKrOmFmuWQqeawm+WIhue6t+Wdn+eEmuaxvueyieWli+S7veW/v+aEpOeyquS4sOWwgeaeq+icguWzsOmUi+mjjueWr+eDvemAouWGr+e8neiuveWlieWHpOS9m+WQpuWkq+aVt+iCpOWtteaJtuaLgui+kOW5heawn+espuS8j+S/mOacjVwiXSxcbltcImI4NDBcIixcIueqo+eqpOeqp+eqqeeqqueqq+eqrlwiLDQsXCLnqrRcIiwxMCxcIuergFwiLDEwLFwi56uMXCIsOSxcIuerl+ermOermuerm+ernOerneeroeerouerpOerp1wiLDUsXCLnq67nq7Dnq7Hnq7Lnq7NcIl0sXG5bXCJiODgwXCIsXCLnq7RcIiw0LFwi56u756u856u+56yA56yB56yC56yF56yH56yJ56yM56yN56yO56yQ56yS56yT56yW56yX56yY56ya56yc56yd56yf56yh56yi56yj56yn56yp56yt5rWu5raq56aP6KKx5byX55Sr5oqa6L6F5L+v6Yec5pan6ISv6IWR5bqc6IWQ6LW05Ymv6KaG6LWL5aSN5YKF5LuY6Zic54i26IW56LSf5a+M6K6j6ZmE5aaH57ya5ZKQ5Zm25ZiO6K+l5pS55qaC6ZKZ55uW5rqJ5bmy55SY5p2G5p+R56u/6IKd6LW25oSf56eG5pWi6LWj5YaI5Yia6ZKi57y46IKb57qy5bKX5riv5p2g56+Z55qL6auY6IaP576U57OV5pCe6ZWQ56i/5ZGK5ZOl5q2M5pCB5oiI6bi96IOz55aZ5Ymy6Z2p6JGb5qC86Juk6ZiB6ZqU6ZOs5Liq5ZCE57uZ5qC56Lef6ICV5pu05bqa5765XCJdLFxuW1wiYjk0MFwiLFwi56yv56yw56yy56y056y156y256y356y556y756y956y/XCIsNSxcIuethuetiOetiuetjeetjuetk+etleetl+etmeetnOetnuetn+etoeeto1wiLDEwLFwi562v562w562z562056225624562656285629562/566B566C566D566E566GXCIsNixcIueujueuj1wiXSxcbltcImI5ODBcIixcIueukeeukueuk+eulueumOeumeeumueum+eunueun+euoOeuo+eupOeupeeurueur+eusOeusueus+euteeutueut+euuVwiLDcsXCLnr4Lnr4Pnr4Tln4LogL/mopflt6XmlLvlip/mga3pvprkvpvouqzlhazlrqvlvJPlt6nmsZ7mi7HotKHlhbHpkqnli77msp/oi5/ni5flnqLmnoTotK3lpJ/ovpzoj4flkpXnro3kvLDmsr3lraTlp5HpvJPlj6Tom4rpqqjosLfogqHmlYXpob7lm7rpm4fliK7nk5zliZDlr6HmjILopILkuZbmi5DmgKrmo7rlhbPlrpjlhqDop4LnrqHppobnvZDmg6/ngYzotK/lhYnlub/pgJvnkbDop4TlnK3noYXlvZLpvp/pl7rovajprLzor6HnmbjmoYLmn5zot6rotLXliL3ovormu5rmo43plIXpg63lm73mnpzoo7nov4flk4hcIl0sXG5bXCJiYTQwXCIsXCLnr4Xnr4jnr4nnr4rnr4vnr43nr47nr4/nr5Dnr5Lnr5RcIiw0LFwi56+b56+c56+e56+f56+g56+i56+j56+k56+n56+o56+p56+r56+s56+t56+v56+w56+yXCIsNCxcIuevuOevueevuuevu+evveevv1wiLDcsXCLnsIjnsInnsIrnsI3nsI7nsJBcIiw1LFwi57CX57CY57CZXCJdLFxuW1wiYmE4MFwiLFwi57CaXCIsNCxcIuewoFwiLDUsXCLnsKjnsKnnsKtcIiwxMixcIuewuVwiLDUsXCLnsYLpqrjlranmtbfmsKbkuqXlrrPpqofphaPmhqjpgq/pn6nlkKvmtrXlr5Llh73llornvZXnv7DmkrzmjY3ml7Hmhr7mgo3nhIrmsZfmsYnlpK/mna3oiKrlo5Xlmo7osarmr6vpg53lpb3ogJflj7fmtanlkbXllp3ojbfoj4/moLjnpr7lkozkvZXlkIjnm5LosonpmILmsrPmtrjotavopJDpuaTotLrlmL/pu5Hnl5Xlvojni6Dmgajlk7zkuqjmqKrooaHmgZLovbDlk4Tng5jombnpuL/mtKrlro/lvJjnuqLllonkvq/njLTlkLzljprlgJnlkI7lkbzkuY7lv73nkZrlo7bokavog6HonbTni5Dns4rmuZZcIl0sXG5bXCJiYjQwXCIsXCLnsYNcIiw5LFwi57GOXCIsMzYsXCLnsbVcIiw1LFwi57G+XCIsOV0sXG5bXCJiYjgwXCIsXCLnsojnsopcIiw2LFwi57KT57KU57KW57KZ57Ka57Kb57Kg57Kh57Kj57Km57Kn57Ko57Kp57Kr57Ks57Kt57Kv57Kw57K0XCIsNCxcIueyuueyu+W8p+iZjuWUrOaKpOS6kuayquaIt+iKseWTl+WNjueMvua7keeUu+WIkuWMluivneankOW+iuaAgOa3ruWdj+asoueOr+ahk+i/mOe8k+aNouaCo+WUpOeXquixoueElea2o+WupuW5u+iNkuaFjOm7hOejuuidl+ewp+eah+WHsOaDtueFjOaZg+W5jOaBjeiwjueBsOaMpei+ieW+veaBouiblOWbnuavgeaClOaFp+WNieaDoOaZpui0v+enveS8mueDqeaxh+ius+ivsue7mOiNpOaYj+Wpmumtgua1kea3t+ixgea0u+S8meeBq+iOt+aIluaDkemcjei0p+eluOWHu+WcvuWfuuacuueVuOeoveenr+eulVwiXSxcbltcImJjNDBcIixcIueyv+ezgOezguezg+ezhOezhuezieezi+ezjlwiLDYsXCLns5jns5rns5vns53ns57ns6FcIiw2LFwi57OpXCIsNSxcIuezsFwiLDcsXCLns7nns7rns7xcIiwxMyxcIue0i1wiLDVdLFxuW1wiYmM4MFwiLFwi57SRXCIsMTQsXCLntKHntKPntKTntKXntKbntKjntKnntKrntKzntK3ntK7ntLBcIiw2LFwi6IKM6aWl6L+55r+A6K6l6bih5aes57up57yJ5ZCJ5p6B5qOY6L6R57GN6ZuG5Y+K5oCl55a+5rGy5Y2z5auJ57qn5oyk5Yeg6ISK5bex6JOf5oqA5YaA5a2j5LyO56Wt5YmC5oK45rWO5a+E5a+C6K6h6K6w5pei5b+M6ZmF5aaT57un57qq5ZiJ5p635aS55L2z5a625Yqg6I2a6aKK6LS+55Sy6ZK+5YGH56i85Lu35p626am+5auB5q2855uR5Z2a5bCW56y66Ze054WO5YW86IKp6Imw5aW457yE6Iyn5qOA5p+s56Kx56G35ouj5o2h566A5L+t5Ymq5YeP6I2Q5qeb6Ym06Le16LSx6KeB6ZSu566t5Lu2XCJdLFxuW1wiYmQ0MFwiLFwi57S3XCIsNTQsXCLnta9cIiw3XSxcbltcImJkODBcIixcIue1uFwiLDMyLFwi5YGl6Iiw5YmR6aWv5riQ5rqF5ran5bu65YO15aec5bCG5rWG5rGf55aG6JKL5qGo5aWW6K6y5Yyg6YWx6ZmN6JWJ5qSS56SB54Sm6IO25Lqk6YOK5rWH6aqE5aiH5Zq85pCF6ZOw55+r5L6l6ISa54uh6KeS6aW657y057ue5Ym/5pWZ6YW16L2/6L6D5Y+r56qW5o+t5o6l55qG56e46KGX6Zi25oiq5Yqr6IqC5qGU5p2w5o23552r56ut5rSB57uT6Kej5aeQ5oiS6JeJ6Iql55WM5YCf5LuL55al6K+r5bGK5be+562L5pak6YeR5LuK5rSl6KWf57Sn6ZSm5LuF6LCo6L+b6Z2z5pmL56aB6L+R54Os5rW4XCJdLFxuW1wiYmU0MFwiLFwi57aZXCIsMTIsXCLntqdcIiw2LFwi57avXCIsNDJdLFxuW1wiYmU4MFwiLFwi57eaXCIsMzIsXCLlsL3lirLojYblhaLojI7nnZvmmbbpsrjkuqzmg4rnsr7nsrPnu4/kupXorabmma/poojpnZnlooPmlazplZzlvoTnl4npnZbnq5/nq57lh4Dngq/nqpjmj6rnqbbnuqDnjpbpn63kuYXngbjkuZ3phZLljqnmlZHml6foh7zoiIXlko7lsLHnlprpnqDmi5jni5nnlr3lsYXpqbnoj4rlsYDlkoDnn6nkuL7msq7ogZrmi5Lmja7lt6jlhbfot53ouJ7plK/kv7Hlj6Xmg6fngqzliafmjZDpuYPlqJ/lgKbnnLfljbfnu6LmkoXmlKvmionmjpjlgJTniLXop4nlhrPor4Dnu53lnYfoj4zpkqflhpvlkJvls7tcIl0sXG5bXCJiZjQwXCIsXCLnt7tcIiw2Ml0sXG5bXCJiZjgwXCIsXCLnuLrnuLxcIiw0LFwi57mCXCIsNCxcIue5iFwiLDIxLFwi5L+K56uj5rWa6YOh6aqP5ZaA5ZKW5Y2h5ZKv5byA5o+p5qW35Yev5oWo5YiK5aCq5YuY5Z2O56CN55yL5bq35oW357Og5omb5oqX5Lqi54KV6ICD5ou354Ok6Z2g5Z236Iub5p+v5qO156OV6aKX56eR5aOz5ZKz5Y+v5ri05YWL5Yi75a6i6K++6IKv5ZWD5Z6m5oGz5Z2R5ZCt56m65oGQ5a2U5o6n5oqg5Y+j5omj5a+H5p6v5ZOt56qf6Ium6YW35bqT6KOk5aS45Z6u5oyO6Leo6IOv5Z2X56235L6p5b+r5a695qy+5Yyh562Q54uC5qGG55+/55y25pe35Ya15LqP55uU5bK/56ql6JG15aWO6a2B5YKAXCJdLFxuW1wiYzA0MFwiLFwi57meXCIsMzUsXCLnuoNcIiwyMyxcIue6nOe6nee6nlwiXSxcbltcImMwODBcIixcIue6rue6tOe6u+e6vOe7lue7pOe7rOe7uee8iue8kOe8nue8t+e8uee8u1wiLDYsXCLnvYPnvYZcIiw5LFwi572S572T6aaI5oSn5rqD5Z2k5piG5o2G5Zuw5ous5omp5buT6ZiU5Z6D5ouJ5ZaH6Jyh6IWK6L6j5ZWm6I6x5p2l6LWW6JOd5amq5qCP5oum56+u6ZiR5YWw5r6c6LCw5o+96KeI5oeS57yG54OC5rul55CF5qaU54u85buK6YOO5pyX5rWq5o2e5Yqz54mi6ICB5L2s5ael6YWq54OZ5rad5YuS5LmQ6Zu36ZWt6JW+56OK57Sv5YSh5Z6S5pOC6IKL57G75rOq5qOx5qWe5Ya35Y6Y5qKo54qB6buO56+x54u456a75ryT55CG5p2O6YeM6bKk56S86I6J6I2U5ZCP5qCX5Li95Y6J5Yqx56C+5Y6G5Yip5YKI5L6L5L+QXCJdLFxuW1wiYzE0MFwiLFwi572W572Z572b572c572d572e572g572jXCIsNCxcIue9q+e9rOe9ree9r+e9sOe9s+e9tee9tue9t+e9uOe9uue9u+e9vOe9vee9v+e+gOe+glwiLDcsXCLnvovnvo3nvo9cIiw0LFwi576VXCIsNCxcIue+m+e+nOe+oOe+oue+o+e+pee+pue+qFwiLDYsXCLnvrFcIl0sXG5bXCJjMTgwXCIsXCLnvrNcIiw0LFwi57665767576+57+A57+C57+D57+E57+G57+H57+I57+J57+L57+N57+PXCIsNCxcIue/lue/l+e/mVwiLDUsXCLnv6Lnv6Pnl6Lnq4vnspLmsqXpmrblipvnkoPlk6nkv6nogZTojrLov57plbDlu4nmgJzmtp/luJjmlZvohLjpk77mgYvngrznu4Pnsq7lh4nmooHnsrHoia/kuKTovobph4/mmb7kuq7osIXmkqnogYrlg5rnlpfnh47lr6Xovr3mvabkuobmkoLplaPlu5bmlpnliJfoo4Lng4jliqPnjI7nkLPmnpfno7fpnJbkuLTpgrvps57mt4vlh5votYHlkJ3mi47njrLoj7Hpm7bpvoTpk4PkvLbnvprlh4zngbXpmbXlsq3pooblj6bku6TmupznkInmprTnoavppo/nlZnliJjnmKTmtYHmn7Plha3pvpnogYvlkpnnrLznqr9cIl0sXG5bXCJjMjQwXCIsXCLnv6Tnv6fnv6jnv6rnv6vnv6znv63nv6/nv7Lnv7RcIiw2LFwi57+957++57+/6ICC6ICH6ICI6ICJ6ICK6ICO6ICP6ICR6ICT6ICa6ICb6ICd6ICe6ICf6ICh6ICj6ICk6ICrXCIsNSxcIuiAsuiAtOiAueiAuuiAvOiAvuiBgOiBgeiBhOiBheiBh+iBiOiBieiBjuiBj+iBkOiBkeiBk+iBleiBluiBl1wiXSxcbltcImMyODBcIixcIuiBmeiBm1wiLDEzLFwi6IGrXCIsNSxcIuiBslwiLDExLFwi6ZqG5Z6E5oui6ZmH5qW85aiE5pCC56+T5ryP6ZmL6Iqm5Y2i6aKF5bqQ54KJ5o6z5Y2k6JmP6bKB6bqT56KM6Zyy6Lev6LWC6bm/5r2e56aE5b2V6ZmG5oiu6am05ZCV6ZOd5L6j5peF5bGl5bGh57yV6JmR5rCv5b6L546H5ruk57u/5bOm5oyb5a2q5rum5Y215Lmx5o6g55Wl5oqh6L2u5Lym5LuR5rKm57q26K666JCd6J66572X6YC76ZSj566p6aqh6KO46JC95rSb6aqG57uc5aaI6bq7546b56CB6JqC6ams6aqC5Zib5ZCX5Z+L5Lmw6bqm5Y2W6L+I6ISJ556S6aaS6Juu5ruh6JST5pu85oWi5ryrXCJdLFxuW1wiYzM0MFwiLFwi6IG+6IKB6IKC6IKF6IKI6IKK6IKNXCIsNSxcIuiClOiCleiCl+iCmeiCnuiCo+iCpuiCp+iCqOiCrOiCsOiCs+iCteiCtuiCuOiCueiCu+iDheiDh1wiLDQsXCLog49cIiw2LFwi6IOY6IOf6IOg6IOi6IOj6IOm6IOu6IO16IO36IO56IO76IO+6IO/6ISA6ISB6ISD6ISE6ISF6ISH6ISI6ISLXCJdLFxuW1wiYzM4MFwiLFwi6ISM6ISV6ISX6ISZ6ISb6ISc6ISd6ISfXCIsMTIsXCLohK3ohK7ohLDohLPohLTohLXohLfohLlcIiw0LFwi6IS/6LCp6IqS6Iyr55uy5rCT5b+Z6I6954yr6IyF6ZSa5q+b55+b6ZOG5Y2v6IyC5YaS5bi96LKM6LS45LmI546r5p6a5qKF6YW26ZyJ54Wk5rKh55yJ5aqS6ZWB5q+P576O5pin5a+Q5aa55aqa6Zeo6Ze35Lus6JCM6JKZ5qqs55uf6ZSw54yb5qKm5a2f55yv6Yaa6Z2h57Oc6L+36LCc5byl57Gz56eY6KeF5rOM6Jyc5a+G5bmC5qOJ55yg57u15YaV5YWN5YuJ5aip57yF6Z2i6IuX5o+P556E6JeQ56eS5ri65bqZ5aaZ6JSR54Gt5rCR5oq/55q/5pWP5oKv6Ze95piO6J6f6bij6ZOt5ZCN5ZG96LCs5pG4XCJdLFxuW1wiYzQ0MFwiLFwi6IWAXCIsNSxcIuiFh+iFieiFjeiFjuiFj+iFkuiFluiFl+iFmOiFm1wiLDQsXCLohaHohaLohaPohaTohabohajoharohavohazoha/ohbLohbPohbXohbbohbfohbjohoHohoNcIiw0LFwi6IaJ6IaL6IaM6IaN6IaO6IaQ6IaSXCIsNSxcIuiGmeiGmuiGnlwiLDQsXCLohqTohqVcIl0sXG5bXCJjNDgwXCIsXCLohqfohqnohqtcIiw3LFwi6Ia0XCIsNSxcIuiGvOiGveiGvuiGv+iHhOiHheiHh+iHiOiHieiHi+iHjVwiLDYsXCLmkbnomJHmqKHohpzno6jmkanprZTmirnmnKvojqvloqjpu5jmsqvmvKDlr57pmYzosIvniZ/mn5Dmi4fniaHkuqnlp4bmr43lopPmmq7luZXli5/mhZXmnKjnm67nnabniafnqYbmi7/lk6rlkZDpkqDpgqPlqJznurPmsJbkuYPlpbbogJDlpYjljZfnlLfpmr7lm4rmjKDohJHmgbzpl7nmt5blkaLppoHlhoXlq6nog73lpq7pnJPlgKrms6XlsLzmi5/kvaDljL/ohbvpgIbmurrolKvmi4jlubTnor7mkrXmjbvlv7XlqJjphb/puJ/lsL/mjY/ogYLlrb3lla7plYrplY3mtoXmgqjmn6Dni57lh53lroFcIl0sXG5bXCJjNTQwXCIsXCLoh5RcIiwxNCxcIuiHpOiHpeiHpuiHqOiHqeiHq+iHrlwiLDQsXCLoh7VcIiw1LFwi6Ie96Ie/6IiD6IiHXCIsNCxcIuiIjuiIj+iIkeiIk+iIlVwiLDUsXCLoiJ3oiKDoiKToiKXoiKboiKfoiKnoiK7oiLLoiLroiLzoiL3oiL9cIl0sXG5bXCJjNTgwXCIsXCLoiYDoiYHoiYLoiYPoiYXoiYboiYjoiYroiYzoiY3oiY7oiZBcIiw3LFwi6ImZ6Imb6Imc6Imd6Ime6ImgXCIsNyxcIuiJqeaLp+aznueJm+aJremSrue6veiEk+a1k+WGnOW8hOWltOWKquaAkuWls+aaluiZkOeWn+aMquaHpuezr+ivuuWTpuasp+m4peautOiXleWRleWBtuaypOWVqui2tOeIrOW4leaAleeQtuaLjeaOkueJjOW+mOa5g+a0vuaUgOa9mOebmOejkOebvOeVlOWIpOWPm+S5k+W6nuaXgeiAquiDluaKm+WShuWIqOeCruiijei3keazoeWRuOiDmuWfueijtOi1lOmZqumFjeS9qeaym+WWt+ebhuegsOaKqOeDuea+juW9reiTrOajmuehvOevt+iGqOaci+m5j+aNp+eisOWdr+egkumcueaJueaKq+WKiOeQteavl1wiXSxcbltcImM2NDBcIixcIuiJquiJq+iJrOiJreiJseiJteiJtuiJt+iJuOiJu+iJvOiKgOiKgeiKg+iKheiKhuiKh+iKieiKjOiKkOiKk+iKlOiKleiKluiKmuiKm+iKnuiKoOiKouiKo+iKp+iKsuiKteiKtuiKuuiKu+iKvOiKv+iLgOiLguiLg+iLheiLhuiLieiLkOiLluiLmeiLmuiLneiLouiLp+iLqOiLqeiLquiLrOiLreiLruiLsOiLsuiLs+iLteiLtuiLuFwiXSxcbltcImM2ODBcIixcIuiLuuiLvFwiLDQsXCLojIrojIvojI3ojJDojJLojJPojJbojJjojJnojJ1cIiw5LFwi6Iyp6Iyq6Iyu6Iyw6Iyy6Iy36Iy76Iy95ZWk6IS+55ay55qu5Yy555ee5YO75bGB6K2s56+H5YGP54mH6aqX6aOY5ryC55Oi56Wo5pKH556l5ou86aKR6LSr5ZOB6IGY5LmS5Z2q6Iu56JCN5bmz5Yet55O26K+E5bGP5Z2h5rO86aKH5amG56C06a2E6L+r57KV5YmW5omR6ZO65LuG6I6G6JGh6I+p6JKy5Z+U5py05ZyD5pmu5rWm6LCx5pud54CR5pyf5qy65qCW5oia5aa75LiD5YeE5ryG5p+S5rKP5YW25qOL5aWH5q2n55Wm5bSO6ISQ6b2Q5peX56WI56WB6aqR6LW35bKC5Lme5LyB5ZCv5aWR56CM5Zmo5rCU6L+E5byD5rG95rOj6K6r5o6QXCJdLFxuW1wiYzc0MFwiLFwi6Iy+6Iy/6I2B6I2C6I2E6I2F6I2I6I2KXCIsNCxcIuiNk+iNlVwiLDQsXCLojZ3ojaLojbBcIiw2LFwi6I256I266I2+XCIsNixcIuiOh+iOiOiOiuiOi+iOjOiOjeiOj+iOkOiOkeiOlOiOleiOluiOl+iOmeiOmuiOneiOn+iOoVwiLDYsXCLojqzojq3ojq5cIl0sXG5bXCJjNzgwXCIsXCLojq/ojrXojrvojr7ojr/oj4Loj4Poj4Toj4boj4joj4noj4voj43oj47oj5Doj5Hoj5Loj5Poj5Xoj5foj5noj5roj5voj57oj6Loj6Poj6Toj6boj6foj6joj6voj6zoj63mgbDmtL3nibXmiabpko7pk4XljYPov4Hnrb7ku5/osKbkub7pu5TpkrHpkrPliY3mvZzpgaPmtYXosLTloJHltYzmrKDmrYnmnqrlkZvohZTnvozlopnolLflvLrmiqLmqYfplLnmlbLmgoTmoaXnnqfkuZTkvqjlt6fpnpjmkqznv5jls63kv4/nqo3liIfojITkuJTmgK/nqoPpkqbkvrXkurLnp6bnkLTli6Toirnmk5Lnpr3lr53msoHpnZLovbvmsKLlgL7ljb/muIXmk47mmbTmsLDmg4Xpobfor7fluobnkLznqbfnp4vkuJjpgrHnkIPmsYLlm5rphYvms4XotovljLrom4bmm7Louq/lsYjpqbHmuKBcIl0sXG5bXCJjODQwXCIsXCLoj67oj6/oj7NcIiw0LFwi6I+66I+76I+86I++6I+/6JCA6JCC6JCF6JCH6JCI6JCJ6JCK6JCQ6JCSXCIsNSxcIuiQmeiQmuiQm+iQnlwiLDUsXCLokKlcIiw3LFwi6JCyXCIsNSxcIuiQueiQuuiQu+iQvlwiLDcsXCLokYfokYjokYlcIl0sXG5bXCJjODgwXCIsXCLokYpcIiw2LFwi6JGSXCIsNCxcIuiRmOiRneiRnuiRn+iRoOiRouiRpFwiLDQsXCLokaroka7oka/okbDokbLokbTokbfokbnokbvokbzlj5blqLbpvovotqPljrvlnIjpoqfmnYPphpvms4nlhajnl4rmi7PniqzliLjlip3nvLrngpTnmLjljbTpuYrmprfnoa7pm4Doo5nnvqTnhLbnh4Plhonmn5Pnk6Tlo6TmlJjlmrforqnppbbmibDnu5Xmg7nng63lo6zku4Hkurrlv43pn6fku7vorqTliIPlpornuqvmiZTku43ml6XmiI7ojLjok4nojaPono3nhpTmurblrrnnu5Llhpfmj4nmn5TogonojLnooJXlhJLlrbrlpoLovrHkubPmsZ3lhaXopKXova/pmK7olYrnkZ7plJDpl7Dmtqboi6XlvLHmkpLmtJLokKjoha7ps4PloZ7otZvkuInlj4FcIl0sXG5bXCJjOTQwXCIsXCLokb1cIiw0LFwi6JKD6JKE6JKF6JKG6JKK6JKN6JKPXCIsNyxcIuiSmOiSmuiSm+iSneiSnuiSn+iSoOiSolwiLDEyLFwi6JKw6JKx6JKz6JK16JK26JK36JK76JK86JK+6JOA6JOC6JOD6JOF6JOG6JOH6JOI6JOL6JOM6JOO6JOP6JOS6JOU6JOV6JOXXCJdLFxuW1wiYzk4MFwiLFwi6JOYXCIsNCxcIuiTnuiToeiTouiTpOiTp1wiLDQsXCLok63ok67ok6/ok7FcIiwxMCxcIuiTveiTvuiUgOiUgeiUguS8nuaVo+ahkeWXk+S4p+aQlOmqmuaJq+WrgueRn+iJsua2qeajruWDp+iOjuegguadgOWIueaymee6seWCu+WVpeeFnuetm+aZkuePiuiLq+adieWxseWIoOeFveihq+mXqumZleaThei1oeiGs+WWhOaxleaJh+e8ruWikuS8pOWVhui1j+aZjOS4iuWwmuijs+aiouaNjueojeeDp+iKjeWLuumftuWwkeWTqOmCtee7jeWloui1iuibh+iIjOiIjei1puaRhOWwhOaFkea2ieekvuiuvuegt+eUs+WRu+S8uOi6q+a3seWooOe7heelnuayiOWuoeWptueUmuiCvuaFjua4l+WjsOeUn+eUpeeJsuWNh+e7s1wiXSxcbltcImNhNDBcIixcIuiUg1wiLDgsXCLolI3olI7olI/olJDolJLolJTolJXolJbolJjolJnolJvolJzolJ3olJ7olKDolKJcIiw4LFwi6JStXCIsOSxcIuiUvlwiLDQsXCLolYTolYXolYbolYfolYtcIiwxMF0sXG5bXCJjYTgwXCIsXCLolZfolZjolZrolZvolZzolZ3olZ9cIiw0LFwi6JWl6JWm6JWn6JWpXCIsOCxcIuiVs+iVteiVtuiVt+iVuOiVvOiVveiVv+iWgOiWgeecgeebm+WJqeiDnOWco+W4iOWkseeLruaWvea5v+ivl+WwuOiZseWNgeefs+aLvuaXtuS7gOmjn+iagOWunuivhuWPsuefouS9v+WxjumptuWni+W8j+ekuuWjq+S4luafv+S6i+aLreiqk+mAneWKv+aYr+WXnOWZrOmAguS7leS+jemHiumlsOawj+W4guaBg+WupOinhuivleaUtuaJi+mmluWuiOWvv+aOiOWUruWPl+eYpuWFveiUrOaeouais+auiuaKkui+k+WPlOiIkua3keeWj+S5pui1juWtsOeGn+iWr+aakeabmee9suicgOm7jem8oOWxnuacr+i/sOagkeadn+aIjeerluWiheW6tuaVsOa8sVwiXSxcbltcImNiNDBcIixcIuiWguiWg+iWhuiWiFwiLDYsXCLolpBcIiwxMCxcIuiWnVwiLDYsXCLolqXolqbolqfolqnolqvolqzolq3olrFcIiw1LFwi6Ja46Ja6XCIsNixcIuiXglwiLDYsXCLol4pcIiw0LFwi6JeR6JeSXCJdLFxuW1wiY2I4MFwiLFwi6JeU6JeWXCIsNSxcIuiXnVwiLDYsXCLol6Xol6bol6fol6jol6pcIiwxNCxcIuaBleWIt+iAjeaRlOihsOeUqeW4heagk+aLtOmcnOWPjOeIveiwgeawtOedoeeojuWQrueerOmhuuiInOivtOehleaclOeDgeaWr+aSleWYtuaAneengeWPuOS4neatu+iChuWvuuWXo+Wbm+S8uuS8vOmlsuW3s+advuiAuOaAgumigumAgeWui+iuvOivteaQnOiJmOaTnuWXveiLj+mFpeS/l+e0oOmAn+eyn+WDs+Whkea6r+Wuv+ivieiCg+mFuOiSnOeul+iZvemai+maj+e7pemrk+eijuWygeepl+mBgumap+eln+WtmeaNn+esi+iTkeaireWUhue8qeeQkOe0oumUgeaJgOWhjOS7luWug+WlueWhlFwiXSxcbltcImNjNDBcIixcIuiXueiXuuiXvOiXveiXvuiYgFwiLDQsXCLomIZcIiwxMCxcIuiYkuiYk+iYlOiYleiYl1wiLDE1LFwi6Jio6JiqXCIsMTMsXCLomLnomLromLvomL3omL7omL/omYBcIl0sXG5bXCJjYzgwXCIsXCLomYFcIiwxMSxcIuiZkuiZk+iZlVwiLDQsXCLomZvomZzomZ3omZ/omaDomaHomaNcIiw3LFwi542t5oye6LmL6LiP6IOO6IuU5oqs5Y+w5rOw6YWe5aSq5oCB5rGw5Z2N5pGK6LSq55ir5rup5Z2b5qqA55ew5r2t6LCt6LCI5Z2m5q+v6KKS56Kz5o6i5Y+554Kt5rGk5aGY5pCq5aCC5qOg6Iab5ZSQ57OW5YCY6Lq65reM6Laf54Or5o6P5rab5ruU57um6JCE5qGD6YCD5reY6Zm26K6o5aWX54m56Jek6IW+55a86KqK5qKv5YmU6Lii6ZSR5o+Q6aKY6LmE5ZW85L2T5pu/5ZqP5oOV5raV5YmD5bGJ5aSp5re75aGr55Sw55Sc5oGs6IiU6IWG5oyR5p2h6L+i55y66Lez6LS06ZOB5biW5Y6F5ZCs54ODXCJdLFxuW1wiY2Q0MFwiLFwi6Jmt6Jmv6Jmw6JmyXCIsNixcIuiag1wiLDYsXCLomo5cIiw0LFwi6JqU6JqWXCIsNSxcIuianlwiLDQsXCLomqXomqbomqvomq3omq7omrLomrPomrfomrjomrnomrtcIiw0LFwi6JuB6JuC6JuD6JuF6JuI6JuM6JuN6JuS6JuT6JuV6JuW6JuX6Jua6JucXCJdLFxuW1wiY2Q4MFwiLFwi6Jud6Jug6Juh6Jui6Juj6Jul6Jum6Jun6Juo6Juq6Jur6Jus6Juv6Ju16Ju26Ju36Ju66Ju76Ju86Ju96Ju/6JyB6JyE6JyF6JyG6JyL6JyM6JyO6JyP6JyQ6JyR6JyU6JyW5rGA5bu35YGc5Lqt5bqt5oy66ImH6YCa5qGQ6YWu556z5ZCM6ZOc5b2k56ul5qG25o2F562S57uf55eb5YG35oqV5aS06YCP5Ye456eD56qB5Zu+5b6S6YCU5raC5bGg5Zyf5ZCQ5YWU5rmN5Zui5o6o6aKT6IW/6JyV6KSq6YCA5ZCe5bGv6IeA5ouW5omY6ISx6bi16ZmA6amu6am85qSt5aal5ouT5ZS+5oyW5ZOH6JuZ5rS85aiD55Om6KKc5q2q5aSW6LGM5byv5rm+546p6aG95Li454O35a6M56KX5oy95pma55qW5oOL5a6b5amJ5LiH6IWV5rGq546L5Lqh5p6J572R5b6A5pe65pyb5b+Y5aaE5aiBXCJdLFxuW1wiY2U0MFwiLFwi6JyZ6Jyb6Jyd6Jyf6Jyg6Jyk6Jym6Jyn6Jyo6Jyq6Jyr6Jys6Jyt6Jyv6Jyw6Jyy6Jyz6Jy16Jy26Jy46Jy56Jy66Jy86Jy96J2AXCIsNixcIuidiuidi+idjeidj+idkOidkeidkuidlOidleidluidmOidmlwiLDUsXCLonaHonaLonaZcIiw3LFwi6J2v6J2x6J2y6J2z6J21XCJdLFxuW1wiY2U4MFwiLFwi6J236J246J256J266J2/6J6A6J6B6J6E6J6G6J6H6J6J6J6K6J6M6J6OXCIsNCxcIuielOieleieluiemFwiLDYsXCLonqBcIiw0LFwi5beN5b6u5Y2x6Z+m6L+d5qGF5Zu05ZSv5oOf5Li65r2N57u06IuH6JCO5aeU5Lyf5Lyq5bC+57qs5pyq6JSa5ZGz55WP6IOD5ZaC6a2P5L2N5rit6LCT5bCJ5oWw5Y2r55if5rip6JqK5paH6Ze757q55ZC756iz57SK6Zeu5Zeh57+B55Ou5oyd6JyX5rah56qd5oiR5pah5Y2n5o+h5rKD5ber5ZGc6ZKo5LmM5rGh6K+s5bGL5peg6Iqc5qKn5ZC+5ZC05q+L5q2m5LqU5o2C5Y2I6Iie5LyN5L6u5Z2e5oiK6Zu+5pmk54mp5Yu/5Yqh5oKf6K+v5piU54aZ5p6Q6KW/56GS55+95pmw5Zi75ZC46ZSh54m6XCJdLFxuW1wiY2Y0MFwiLFwi6J6l6J6m6J6n6J6p6J6q6J6u6J6w6J6x6J6y6J606J626J636J646J656J676J686J6+6J6/6J+BXCIsNCxcIuifh+ifiOifieifjFwiLDQsXCLon5RcIiw2LFwi6J+c6J+d6J+e6J+f6J+h6J+i6J+j6J+k6J+m6J+n6J+o6J+p6J+r6J+s6J+t6J+vXCIsOV0sXG5bXCJjZjgwXCIsXCLon7ron7von7zon73on7/ooIDooIHooILooIRcIiw1LFwi6KCLXCIsNyxcIuiglOigl+igmOigmeigmuignFwiLDQsXCLooKPnqIDmga/luIzmgonohp3lpJXmg5znhoTng6/muqrmsZDnioDmqoTooq3luK3kuaDlqrPllpzpk6PmtJfns7vpmpnmiI/nu4bnno7omb7ljKPpnJ7ovpbmmofls6HkvqDni63kuIvljqblpI/lkJPmjoDplKjlhYjku5npspznuqTlkrjotKTooZToiLfpl7Lmto7lvKblq4zmmL7pmannjrDnjK7ljr/ohbrppoXnvqHlrqrpmbfpmZDnur/nm7jljqLplbbpppnnrrHopYTmuZjkuaHnv5TnpaXor6bmg7Plk43kuqvpobnlt7fmqaHlg4/lkJHosaHokKfnoZ3pnITliYrlk67lmqPplIDmtojlrrXmt4bmmZNcIl0sXG5bXCJkMDQwXCIsXCLooKRcIiwxMyxcIuigs1wiLDUsXCLooLrooLvooL3ooL7ooL/ooYHooYLooYPooYZcIiw1LFwi6KGOXCIsNSxcIuihleihluihmOihmlwiLDYsXCLooabooafooarooa3ooa/oobHoobPoobToobXoobboobjoobnoobpcIl0sXG5bXCJkMDgwXCIsXCLoobvoobzoooDoooPooobooofooonooorooozooo7ooo/oopDoopHoopPoopToopXoopdcIiw0LFwi6KKdXCIsNCxcIuiio+iipVwiLDUsXCLlsI/lrZ3moKHogpbllbjnrJHmlYjmpZTkupvmrYfonY7pnovljY/mjJ/mkLrpgqrmlpzog4HosJDlhpnmorDljbjon7nmh4jms4Tms7vosKLlsZHolqroiq/plIzmrKPovpvmlrDlv7vlv4Pkv6HooYXmmJ/ohaXnjKnmg7rlhbTliJHlnovlvaLpgqLooYzphpLlubjmnY/mgKflp5PlhYTlh7bog7jljIjmsbnpm4TnhorkvJHkv67nvp7mnL3ll4XplIjnp4Doopbnu6Plop/miIzpnIDomZrlmJjpobvlvpDorrjok4TphZflj5nml63luo/nlZzmgaTnta7lqb/nu6rnu63ovanllqflrqPmgqzml4vnjoRcIl0sXG5bXCJkMTQwXCIsXCLooqzooq7ooq/oorDoorJcIiw0LFwi6KK46KK56KK66KK76KK96KK+6KK/6KOA6KOD6KOE6KOH6KOI6KOK6KOL6KOM6KON6KOP6KOQ6KOR6KOT6KOW6KOX6KOaXCIsNCxcIuijoOijoeijpuijp+ijqVwiLDYsXCLoo7Loo7Xoo7boo7foo7roo7voo73oo7/opIDopIHopINcIiw1XSxcbltcImQxODBcIixcIuikieiki1wiLDQsXCLopJHopJRcIiw0LFwi6KScXCIsNCxcIuikouiko+ikpOikpuikp+ikqOikqeikrOikreikruikr+ikseiksuiks+ikteikt+mAieeZo+ecqee7mumdtOiWm+WtpueptOmbquihgOWLi+eGj+W+quaXrOivouWvu+mpr+W3oeauieaxm+iureiur+mAiui/heWOi+aKvOm4pum4reWRgOS4q+iKveeJmeianOW0luihmea2r+mbheWTkeS6muiutueEieWSvemYieeDn+a3ueebkOS4peeglOickuWyqeW7tuiogOminOmYjueCjuayv+WlhOaOqeecvOihjea8lOiJs+WgsOeHleWOjOegmumbgeWUgeW9pueEsOWutOiwmumqjOaug+Wkrum4r+enp+adqOaJrOS9r+eWoee+iua0i+mYs+awp+S7sOeXkuWFu+agt+a8vumCgOiFsOWmlueRtlwiXSxcbltcImQyNDBcIixcIuikuFwiLDgsXCLopYLopYPopYVcIiwyNCxcIuiloFwiLDUsXCLopadcIiwxOSxcIuilvFwiXSxcbltcImQyODBcIixcIuilveilvuimgOimguimhOimheimh1wiLDI2LFwi5pGH5bCn6YGl56qR6LCj5aea5ZKs6IiA6I2v6KaB6ICA5qSw5ZmO6IC254i36YeO5Ya25Lmf6aG15o6W5Lia5Y+25puz6IWL5aSc5ray5LiA5aO55Yy75o+W6ZOx5L6d5LyK6KGj6aKQ5aS36YGX56e75Luq6IOw55aR5rKC5a6c5aeo5b2d5qSF6JqB5YCa5bey5LmZ55+j5Lul6Im65oqR5piT6YKR5bG55Lq/5b256IeG6YC46IKE55ar5Lqm6KOU5oSP5q+F5b+G5LmJ55uK5rqi6K+j6K6u6LCK6K+R5byC57+857+M57uO6Iy16I2r5Zug5q636Z+z6Zi05ae75ZCf6ZO25rer5a+F6aWu5bC55byV6ZqQXCJdLFxuW1wiZDM0MFwiLFwi6KaiXCIsMzAsXCLop4Pop43op5Pop5Top5Xop5fop5jop5nop5vop53op5/op6Dop6Hop6Lop6Top6fop6jop6nop6rop6zop63op67op7Dop7Hop7Lop7RcIiw2XSxcbltcImQzODBcIixcIuinu1wiLDQsXCLoqIFcIiw1LFwi6KiIXCIsMjEsXCLljbDoi7HmqLHlqbTpubDlupTnvKjojrnokKTokKXojafonYfov47otaLnm4jlvbHpopbnoazmmKDlk5/mi6XkvaPoh4Pnl4jlurjpm43ouIrom7nlko/ms7PmtozmsLjmgb/li4fnlKjlub3kvJjmgqDlv6flsKTnlLHpgq7pk4DnirnmsrnmuLjphYnmnInlj4vlj7PkvZHph4nor7Hlj4jlubzov4Lmt6Tkuo7nm4LmpobomZ7mhJroiIbkvZnkv57pgL7psbzmhInmuJ3muJTpmoXkuojlqLHpm6jkuI7lsb/nprnlrofor63nvr3njonln5/oiovpg4HlkIHpgYfllrvls6rlvqHmhIjmrLLni7HogrLoqolcIl0sXG5bXCJkNDQwXCIsXCLoqJ5cIiwzMSxcIuiov1wiLDgsXCLoqYlcIiwyMV0sXG5bXCJkNDgwXCIsXCLoqZ9cIiwyNSxcIuipulwiLDYsXCLmtbTlr5Poo5XpooTosavpqa3puLPmuIrlhqTlhYPlnqPoooHljp/mj7TovpXlm63lkZjlnIbnjL/mupDnvJjov5zoi5HmhL/mgKjpmaLmm7Dnuqbotorot4PpkqXlsrPnsqTmnIjmgqbpmIXogJjkupHpg6fljIDpmajlhYHov5DolbTphZ3mmZXpn7XlrZXljJ3noLjmnYLmoL3lk4nngb7lrrDovb3lho3lnKjlkrHmlJLmmoLotZ7otYPohI/okazpga3ns5/lh7/ol7vmnqPml6nmvqHomqTouoHlmarpgKDnmoLngbbnh6XotKPmi6nliJnms73otLzmgI7lop7mho7mm77otaDmiY7llrPmuKPmnK3ovadcIl0sXG5bXCJkNTQwXCIsXCLoqoFcIiw3LFwi6KqLXCIsNyxcIuiqlFwiLDQ2XSxcbltcImQ1ODBcIixcIuirg1wiLDMyLFwi6ZOh6Ze455yo5qCF5qao5ZKL5LmN54K46K+I5pGY5paL5a6F56qE5YC65a+o55675q+h6Km557KY5rK+55uP5pap6L6X5bSt5bGV6Ji45qCI5Y2g5oiY56uZ5rmb57u95qif56ug5b2w5ryz5byg5o6M5rao5p2W5LiI5biQ6LSm5LuX6IOA55i06Zqc5oub5pit5om+5rK86LW154Wn572p5YWG6IKH5Y+s6YGu5oqY5ZOy6Juw6L6Z6ICF6ZSX6JSX6L+Z5rWZ54+N5paf55yf55SE56Cn6Ie76LSe6ZKI5L6m5p6V55a56K+K6ZyH5oyv6ZWH6Zi16JK45oyj552B5b6B54uw5LqJ5oCU5pW05ouv5q2j5pS/XCJdLFxuW1wiZDY0MFwiLFwi6KukXCIsMzQsXCLorIhcIiwyN10sXG5bXCJkNjgwXCIsXCLorKTorKXorKdcIiwzMCxcIuW4p+eXh+mDkeivgeiKneaeneaUr+WQseicmOefpeiCouiEguaxgeS5i+e7h+iBjOebtOakjeauluaJp+WAvOS+hOWdgOaMh+atoui2vuWPquaXqOe6uOW/l+aMmuaOt+iHs+iHtOe9ruW4nOWzmeWItuaZuuenqeeomui0qOeCmeeXlOa7nuayu+eqkuS4reebheW/oOmSn+iht+e7iOenjeiCv+mHjeS7suS8l+iIn+WRqOW3nua0suivjOeypei9tOiCmOW4muWSkueaseWumeaYvOmqpOePoOagquibm+acseeMquivuOivm+mAkOerueeDm+eFruaLhOeeqeWYseS4u+iRl+afseWKqeibgOi0rumTuOetkVwiXSxcbltcImQ3NDBcIixcIuithlwiLDMxLFwi6K2nXCIsNCxcIuitrVwiLDI1XSxcbltcImQ3ODBcIixcIuiuh1wiLDI0LFwi6K6s6K6x6K676K+H6K+Q6K+q6LCJ6LCe5L2P5rOo56Wd6am75oqT54iq5ou95LiT56CW6L2s5pKw6LWa56+G5qGp5bqE6KOF5aaG5pKe5aOu54q25qSO6ZSl6L+96LWY5Z2g57yA6LCG5YeG5o2J5ouZ5Y2T5qGM55Ci6IyB6YWM5ZWE552A54G85rWK5YW55ZKo6LWE5ae/5ruL5reE5a2c57Sr5LuU57G95ruT5a2Q6Ieq5riN5a2X6ayD5qOV6Liq5a6X57u85oC757q16YK56LWw5aWP5o+N56ef6Laz5Y2S5peP56WW6K+F6Zi757uE6ZK757qC5Zi06YaJ5pyA572q5bCK6YG15pio5bem5L2Q5p+e5YGa5L2c5Z2Q5bqnXCJdLFxuW1wiZDg0MFwiLFwi6LC4XCIsOCxcIuixguixg+ixhOixheixiOixiuixi+ixjVwiLDcsXCLosZbosZfosZjosZnosZtcIiw1LFwi6LGjXCIsNixcIuixrFwiLDYsXCLosbTosbXosbbosbfosbtcIiw2LFwi6LKD6LKE6LKG6LKHXCJdLFxuW1wiZDg4MFwiLFwi6LKI6LKL6LKNXCIsNixcIuiyleiyluiyl+iymVwiLDIwLFwi5LqN5LiM5YWA5LiQ5bu/5Y2F5LiV5LqY5Lie6ayy5a2s5Zmp5Lio56a65Li/5YyV5LmH5aSt54i75Y2u5rCQ5Zuf6IOk6aaX5q+T552+6byX5Li25Lqf6byQ5Lmc5Lmp5LqT6IqI5a2b5ZWs5ZiP5LuE5Y6N5Y6d5Y6j5Y6l5Y6u6Z2l6LWd5Yya5Y+15Yym5Yyu5Yy+6LWc5Y2m5Y2j5YiC5YiI5YiO5Yit5Yiz5Yi/5YmA5YmM5Yme5Ymh5Ymc6JKv5Ym95YqC5YqB5YqQ5YqT5YaC572U5Lq75LuD5LuJ5LuC5Luo5Luh5Lur5Lue5Lyb5Luz5Lyi5L2k5Lu15Lyl5Lyn5LyJ5Lyr5L2e5L2n5pS45L2a5L2dXCJdLFxuW1wiZDk0MFwiLFwi6LKuXCIsNjJdLFxuW1wiZDk4MFwiLFwi6LOtXCIsMzIsXCLkvZ/kvZfkvLLkvL3kvbbkvbTkvpHkvonkvoPkvo/kvb7kvbvkvqrkvbzkvqzkvpTkv6bkv6jkv6rkv4Xkv5rkv6Pkv5zkv5Hkv5/kv7jlgKnlgYzkv7PlgKzlgI/lgK7lgK3kv77lgJzlgIzlgKXlgKjlgb7lgYPlgZXlgYjlgY7lgazlgbvlgqXlgqflgqnlgrrlg5blhIblg63lg6zlg6blg67lhIflhIvku53msL3kvZjkvaXkv47pvqDmsYbnsbTlha7lt73pu4npppjlhoHlpJTli7nljI3oqIfljJDlh6vlpJnlhZXkuqDlhZbkurPooa7ooqTkurXohJToo5LnpoDlrLTooIPnvrjlhqvlhrHlhr3lhrxcIl0sXG5bXCJkYTQwXCIsXCLotI5cIiwxNCxcIui0oOi1kei1kui1l+i1n+i1pei1qOi1qei1qui1rOi1rui1r+i1sei1sui1uFwiLDgsXCLotoLotoPotobotofotojotonotoxcIiw0LFwi6LaS6LaT6LaVXCIsOSxcIui2oOi2oVwiXSxcbltcImRhODBcIixcIui2oui2pFwiLDEyLFwi6Lay6La26La36La56La76La96LeA6LeB6LeC6LeF6LeH6LeI6LeJ6LeK6LeN6LeQ6LeS6LeT6LeU5YeH5YaW5Yai5Yal6K6g6K6m6K6n6K6q6K606K616K636K+C6K+D6K+L6K+P6K+O6K+S6K+T6K+U6K+W6K+Y6K+Z6K+c6K+f6K+g6K+k6K+o6K+p6K+u6K+w6K+z6K+26K+56K+86K+/6LCA6LCC6LCE6LCH6LCM6LCP6LCR6LCS6LCU6LCV6LCW6LCZ6LCb6LCY6LCd6LCf6LCg6LCh6LCl6LCn6LCq6LCr6LCu6LCv6LCy6LCz6LC16LC25Y2p5Y266Zid6Zii6Zih6Zix6Ziq6Zi96Zi86ZmC6ZmJ6ZmU6Zmf6Zmn6Zms6Zmy6Zm06ZqI6ZqN6ZqX6Zqw6YKX6YKb6YKd6YKZ6YKs6YKh6YK06YKz6YK26YK6XCJdLFxuW1wiZGI0MFwiLFwi6LeV6LeY6LeZ6Lec6Leg6Leh6Lei6Lel6Lem6Len6Lep6Let6Leu6Lew6Lex6Ley6Le06Le26Le86Le+XCIsNixcIui4hui4h+i4iOi4i+i4jei4jui4kOi4kei4kui4k+i4lVwiLDcsXCLouKDouKHouKRcIiw0LFwi6Lir6Lit6Liw6Liy6Liz6Li06Li26Li36Li46Li76Li86Li+XCJdLFxuW1wiZGI4MFwiLFwi6Li/6LmD6LmF6LmG6LmMXCIsNCxcIui5k1wiLDUsXCLouZpcIiwxMSxcIui5p+i5qOi5qui5q+i5rui5semCuOmCsOmDj+mDhemCvumDkOmDhOmDh+mDk+mDpumDoumDnOmDl+mDm+mDq+mDr+mDvumEhOmEoumEnumEo+mEsemEr+mEuemFg+mFhuWIjeWlguWKouWKrOWKreWKvuWTv+WLkOWLluWLsOWPn+eHruefjeW7tOWHteWHvOmsr+WOtuW8geeVmuW3r+WdjOWeqeWeoeWhvuWivOWjheWjkeWcqeWcrOWcquWcs+WcueWcruWcr+WdnOWcu+WdguWdqeWeheWdq+WehuWdvOWdu+WdqOWdreWdtuWds+WereWepOWejOWesuWfj+Wep+WetOWek+WeoOWfleWfmOWfmuWfmeWfkuWeuOWftOWfr+WfuOWfpOWfnVwiXSxcbltcImRjNDBcIixcIui5s+i5tei5t1wiLDQsXCLoub3oub7ouoDouoLouoPouoTouobouohcIiw2LFwi6LqR6LqS6LqT6LqVXCIsNixcIui6nei6n1wiLDExLFwi6Lqt6Lqu6Lqw6Lqx6LqzXCIsNixcIui6u1wiLDddLFxuW1wiZGM4MFwiLFwi6LuDXCIsMTAsXCLou49cIiwyMSxcIuWgi+WgjeWfveWfreWggOWgnuWgmeWhhOWgoOWhpeWhrOWigeWiieWimuWigOmmqOm8meaHv+iJueiJveiJv+iKj+iKiuiKqOiKhOiKjuiKkeiKl+iKmeiKq+iKuOiKvuiKsOiLiOiLiuiLo+iKmOiKt+iKruiLi+iLjOiLgeiKqeiKtOiKoeiKquiKn+iLhOiLjuiKpOiLoeiMieiLt+iLpOiMj+iMh+iLnOiLtOiLkuiLmOiMjOiLu+iLk+iMkeiMmuiMhuiMlOiMleiLoOiLleiMnOiNkeiNm+iNnOiMiOiOkuiMvOiMtOiMseiOm+iNnuiMr+iNj+iNh+iNg+iNn+iNgOiMl+iNoOiMreiMuuiMs+iNpuiNpVwiXSxcbltcImRkNDBcIixcIui7pVwiLDYyXSxcbltcImRkODBcIixcIui8pFwiLDMyLFwi6I2o6Iyb6I2p6I2s6I2q6I2t6I2u6I6w6I246I6z6I606I6g6I6q6I6T6I6c6I6F6I286I626I6p6I296I646I276I6Y6I6e6I6o6I666I686I+B6JCB6I+l6I+Y5aCH6JCY6JCL6I+d6I+96I+W6JCc6JC46JCR6JCG6I+U6I+f6JCP6JCD6I+46I+56I+q6I+F6I+A6JCm6I+w6I+h6JGc6JGR6JGa6JGZ6JGz6JKH6JKI6JG66JKJ6JG46JC86JGG6JGp6JG26JKM6JKO6JCx6JGt6JOB6JON6JOQ6JOm6JK96JOT6JOK6JK/6JK66JOg6JKh6JK56JK06JKX6JOl6JOj6JSM55SN6JS46JOw6JS56JSf6JS6XCJdLFxuW1wiZGU0MFwiLFwi6L2FXCIsMzIsXCLovarovoDovozovpLovp3ovqDovqHovqLovqTovqXovqbovqfovqrovqzovq3ovq7ovq/ovrLovrPovrTovrXovrfovrjovrrovrvovrzovr/ov4Dov4Pov4ZcIl0sXG5bXCJkZTgwXCIsXCLov4lcIiw0LFwi6L+P6L+S6L+W6L+X6L+a6L+g6L+h6L+j6L+n6L+s6L+v6L+x6L+y6L+06L+16L+26L+66L+76L+86L++6L+/6YCH6YCI6YCM6YCO6YCT6YCV6YCY6JWW6JS76JO/6JO86JWZ6JWI6JWo6JWk6JWe6JW6556i6JWD6JWy6JW76Jak6Jao6JaH6JaP6JW56Jau6Jac6JaF6Ja56Ja36Jaw6JeT6JeB6Jec6Je/6Jin6JiF6Jip6JiW6Ji85bu+5byI5aS85aWB6IC35aWV5aWa5aWY5YyP5bCi5bCl5bCs5bC05omM5omq5oqf5oq75ouK5oua5ouX5ouu5oyi5ou25oy55o2L5o2D5o6t5o+25o2x5o265o6O5o605o2t5o6s5o6K5o2p5o6u5o685o+y5o+45o+g5o+/5o+E5o+e5o+O5pGS5o+G5o6+5pGF5pGB5pCL5pCb5pCg5pCM5pCm5pCh5pGe5pKE5pGt5pKWXCJdLFxuW1wiZGY0MFwiLFwi6YCZ6YCc6YCj6YCk6YCl6YCnXCIsNSxcIumAsFwiLDQsXCLpgLfpgLnpgLrpgL3pgL/pgYDpgYPpgYXpgYbpgYhcIiw0LFwi6YGO6YGU6YGV6YGW6YGZ6YGa6YGcXCIsNSxcIumBpOmBpumBp+mBqemBqumBq+mBrOmBr1wiLDQsXCLpgbZcIiw2LFwi6YG+6YKBXCJdLFxuW1wiZGY4MFwiLFwi6YKE6YKF6YKG6YKH6YKJ6YKK6YKMXCIsNCxcIumCkumClOmClumCmOmCmumCnOmCnumCn+mCoOmCpOmCpemCp+mCqOmCqemCq+mCremCsumCt+mCvOmCvemCv+mDgOaRuuaSt+aSuOaSmeaSuuaTgOaTkOaTl+aTpOaTouaUieaUpeaUruW8i+W/kueUmeW8keWNn+WPseWPveWPqeWPqOWPu+WQkuWQluWQhuWRi+WRkuWRk+WRlOWRluWRg+WQoeWRl+WRmeWQo+WQsuWSguWSlOWRt+WRseWRpOWSmuWSm+WShOWRtuWRpuWSneWTkOWSreWTguWStOWTkuWSp+WSpuWTk+WTlOWRsuWSo+WTleWSu+WSv+WTjOWTmeWTmuWTnOWSqeWSquWSpOWTneWTj+WTnuWUm+WTp+WUoOWTveWUlOWTs+WUouWUo+WUj+WUkeWUp+WUquWVp+WWj+WWteWVieWVreWVgeWVleWUv+WVkOWUvFwiXSxcbltcImUwNDBcIixcIumDgumDg+mDhumDiOmDiemDi+mDjOmDjemDkumDlOmDlemDlumDmOmDmemDmumDnumDn+mDoOmDo+mDpOmDpemDqemDqumDrOmDrumDsOmDsemDsumDs+mDtemDtumDt+mDuemDuumDu+mDvOmDv+mEgOmEgemEg+mEhVwiLDE5LFwi6YSa6YSb6YScXCJdLFxuW1wiZTA4MFwiLFwi6YSd6YSf6YSg6YSh6YSkXCIsMTAsXCLphLDphLJcIiw2LFwi6YS6XCIsOCxcIumFhOWUt+WVluWVteWVtuWVt+WUs+WUsOWVnOWWi+WXkuWWg+WWseWWueWWiOWWgeWWn+WVvuWXluWWkeWVu+WXn+WWveWWvuWWlOWWmeWXquWXt+WXieWYn+WXkeWXq+WXrOWXlOWXpuWXneWXhOWXr+WXpeWXsuWXs+WXjOWXjeWXqOWXteWXpOi+lOWYnuWYiOWYjOWYgeWYpOWYo+WXvuWYgOWYp+WYreWZmOWYueWZl+WYrOWZjeWZouWZmeWZnOWZjOWZlOWahuWZpOWZseWZq+WZu+WZvOWaheWak+War+WblOWbl+WbneWboeWbteWbq+WbueWbv+WchOWciuWcieWcnOW4j+W4meW4lOW4keW4seW4u+W4vFwiXSxcbltcImUxNDBcIixcIumFhemFh+mFiOmFkemFk+mFlOmFlemFlumFmOmFmemFm+mFnOmFn+mFoOmFpumFp+mFqOmFq+mFremFs+mFuumFu+mFvOmGgFwiLDQsXCLphobphojphorpho7pho/phpNcIiw2LFwi6YacXCIsNSxcIumGpFwiLDUsXCLphqvphqzphrDphrHphrLphrPphrbphrfphrjphrnphrtcIl0sXG5bXCJlMTgwXCIsXCLphrxcIiwxMCxcIumHiOmHi+mHkOmHklwiLDksXCLph51cIiw4LFwi5bi35bmE5bmU5bmb5bme5bmh5bKM5bG65bKN5bKQ5bKW5bKI5bKY5bKZ5bKR5bKa5bKc5bK15bKi5bK95bKs5bKr5bKx5bKj5bOB5bK35bOE5bOS5bOk5bOL5bOl5bSC5bSD5bSn5bSm5bSu5bSk5bSe5bSG5bSb5bWY5bS+5bS05bS95bWs5bWb5bWv5bWd5bWr5bWL5bWK5bWp5bW05baC5baZ5bad6LGz5ba35beF5b2z5b235b6C5b6H5b6J5b6M5b6V5b6Z5b6c5b6o5b6t5b615b686KGi5b2h54qt54qw54q054q354q454uD54uB54uO54uN54uS54uo54uv54up54uy54u054u354yB54uz54yD54u6XCJdLFxuW1wiZTI0MFwiLFwi6YemXCIsNjJdLFxuW1wiZTI4MFwiLFwi6YilXCIsMzIsXCLni7vnjJfnjJPnjKHnjIrnjJ7njJ3njJXnjKLnjLnnjKXnjKznjLjnjLHnjZDnjY3njZfnjaDnjaznja/njb7oiJvlpKXpo6flpKTlpILppaPppadcIiw1LFwi6aW06aW36aW96aaA6aaE6aaH6aaK6aaN6aaQ6aaR6aaT6aaU6aaV5bqA5bqR5bqL5bqW5bql5bqg5bq55bq15bq+5bqz6LWT5buS5buR5bub5buo5buq6Ia65b+E5b+J5b+W5b+P5oCD5b+u5oCE5b+h5b+k5b++5oCF5oCG5b+q5b+t5b+45oCZ5oC15oCm5oCb5oCP5oCN5oCp5oCr5oCK5oC/5oCh5oG45oG55oG75oG65oGCXCJdLFxuW1wiZTM0MFwiLFwi6YmGXCIsNDUsXCLpibVcIiwxNl0sXG5bXCJlMzgwXCIsXCLpioZcIiw3LFwi6YqPXCIsMjQsXCLmgarmgb3mgpbmgprmgq3mgp3mgoPmgpLmgozmgpvmg6zmgrvmgrHmg53mg5jmg4bmg5rmgrTmhKDmhKbmhJXmhKPmg7TmhIDmhI7mhKvmhYrmhbXmhqzmhpTmhqfmhrfmh5Tmh7Xlv53pmrPpl6npl6vpl7Hpl7Ppl7Xpl7bpl7zpl77pmIPpmITpmIbpmIjpmIrpmIvpmIzpmI3pmI/pmJLpmJXpmJbpmJfpmJnpmJrkuKzniL/miJXmsLXmsZTmsZzmsYrmsqPmsoXmspDmspTmsozmsajmsanmsbTmsbbmsobmsqnms5Dms5Tmsq3ms7fms7jms7Hms5fmsrLms6Dms5bms7rms6vms67msrHms5Pms6/ms75cIl0sXG5bXCJlNDQwXCIsXCLpiqhcIiw1LFwi6YqvXCIsMjQsXCLpi4lcIiwzMV0sXG5bXCJlNDgwXCIsXCLpi6lcIiwzMixcIua0uea0p+a0jOa1g+a1iOa0h+a0hOa0mea0jua0q+a1jea0rua0tea0mua1j+a1kua1lOa0s+a2kea1r+a2nua2oOa1nua2k+a2lOa1nOa1oOa1vOa1o+a4mua3h+a3hea3nua4jua2v+a3oOa4kea3pua3nea3mea4lua2q+a4jOa2rua4q+a5rua5jua5q+a6sua5n+a6hua5k+a5lOa4sua4pea5hOa7n+a6sea6mOa7oOa8rea7oua6pea6p+a6vea6u+a6t+a7l+a6tOa7j+a6j+a7gua6n+a9oua9hua9h+a8pOa8lea7uea8r+a8tua9i+a9tOa8qua8iea8qea+iea+jea+jOa9uOa9sua9vOa9uua/kVwiXSxcbltcImU1NDBcIixcIumMilwiLDUxLFwi6Yy/XCIsMTBdLFxuW1wiZTU4MFwiLFwi6Y2KXCIsMzEsXCLpjavmv4nmvqfmvrnmvrbmv4Lmv6Hmv67mv57mv6Dmv6/ngJrngKPngJvngLnngLXngY/ngZ7lroDlroTlrpXlrpPlrqXlrrjnlK/pqp7mkLTlr6Tlr67opLDlr7DouYforIfovrbov5Pov5Xov6Xov67ov6Tov6nov6bov7Pov6jpgIXpgITpgIvpgKbpgJHpgI3pgJbpgKHpgLXpgLbpgK3pgK/pgYTpgZHpgZLpgZDpgajpgZjpgaLpgZvmmrnpgbTpgb3pgoLpgojpgoPpgovlvZDlvZflvZblvZjlsLvlkqvlsZDlsZnlrbHlsaPlsabnvrzlvKrlvKnlvK3oibTlvLzprLvlsa7lpoHlpoPlpo3lpqnlpqrlpqNcIl0sXG5bXCJlNjQwXCIsXCLpjaxcIiwzNCxcIumOkFwiLDI3XSxcbltcImU2ODBcIixcIumOrFwiLDI5LFwi6Y+L6Y+M6Y+N5aaX5aeK5aar5aae5aak5aeS5aay5aav5aeX5aa+5aiF5aiG5aed5aiI5aej5aeY5ae55aiM5aiJ5aiy5ai05aiR5aij5aiT5amA5amn5amK5amV5ai85ami5am16IOs5aqq5aqb5am35am65aq+5aur5aqy5auS5auU5aq45aug5auj5aux5auW5aum5auY5auc5ayJ5ayX5ayW5ayy5ay35a2A5bCV5bCc5a2a5a2l5a2z5a2R5a2T5a2i6am16am36am46am66am/6am96aqA6aqB6aqF6aqI6aqK6aqQ6aqS6aqT6aqW6aqY6aqb6aqc6aqd6aqf6aqg6aqi6aqj6aql6aqn57qf57qh57qj57ql57qo57qpXCJdLFxuW1wiZTc0MFwiLFwi6Y+OXCIsNyxcIumPl1wiLDU0XSxcbltcImU3ODBcIixcIumQjlwiLDMyLFwi57qt57qw57q+57uA57uB57uC57uJ57uL57uM57uQ57uU57uX57ub57ug57uh57uo57ur57uu57uv57ux57uy57yN57u257u657u757u+57yB57yC57yD57yH57yI57yL57yM57yP57yR57yS57yX57yZ57yc57yb57yf57yhXCIsNixcIue8que8q+e8rOe8ree8r1wiLDQsXCLnvLXlubrnlb/lt5vnlL7pgpXnjo7njpHnjq7njqLnjp/nj4/nj4Lnj5HnjrfnjrPnj4Dnj4nnj4jnj6Xnj5npobznkIrnj6nnj6fnj57njrrnj7LnkI/nkKrnkZvnkKbnkKXnkKjnkLDnkK7nkKxcIl0sXG5bXCJlODQwXCIsXCLpkK9cIiwxNCxcIumQv1wiLDQzLFwi6ZGs6ZGt6ZGu6ZGvXCJdLFxuW1wiZTg4MFwiLFwi6ZGwXCIsMjAsXCLpkpHpkpbpkpjpk4fpk4/pk5Ppk5Tpk5rpk6bpk7vplJzplKDnkJvnkJrnkYHnkZznkZfnkZXnkZnnkbfnka3nkb7nkpznko7nkoDnkoHnkofnkovnkp7nkqjnkqnnkpDnkqfnk5Lnkrrpn6rpn6vpn6zmnYzmnZPmnZ7mnYjmnanmnqXmnofmnarmnbPmnpjmnqfmnbXmnqjmnp7mnq3mnovmnbfmnbzmn7DmoInmn5jmoIrmn6nmnrDmoIzmn5nmnrXmn5rmnrPmn53moIDmn4Pmnrjmn6LmoI7mn4Hmn73moLLmoLPmoaDmoaHmoY7moaLmoYTmoaTmooPmoJ3moZXmoabmoYHmoafmoYDmoL7moYrmoYnmoKnmorXmoo/mobTmobfmopPmoavmo4Lmpa7mo7zmpJ/mpKDmo7lcIl0sXG5bXCJlOTQwXCIsXCLplKfplLPplL3plYPplYjplYvplZXplZrplaDpla7plbTplbXplbdcIiw3LFwi6ZaAXCIsNDJdLFxuW1wiZTk4MFwiLFwi6ZarXCIsMzIsXCLmpKTmo7DmpIvmpIHmpZfmo6PmpJDmpbHmpLnmpaDmpYLmpZ3mpoTmpavmpoDmppjmpbjmpLTmp4zmpofmpojmp47mponmpabmpaPmpbnmppvmpqfmprvmpqvmpq3mp5TmprHmp4Hmp4rmp5/mppXmp6Dmpo3mp7/mqK/mp63mqJfmqJjmqaXmp7LmqYTmqL7mqqDmqZDmqZvmqLXmqo7mqbnmqL3mqKjmqZjmqbzmqpHmqpDmqqnmqpfmqqvnjLfnjZLmroHmroLmrofmroTmrpLmrpPmro3mrprmrpvmrqHmrqrovavova3ovbHovbLovbPovbXovbbovbjovbfovbnovbrovbzovb7ovoHovoLovoTovofovotcIl0sXG5bXCJlYTQwXCIsXCLpl4xcIiwyNyxcIumXrOmXv+mYh+mYk+mYmOmYm+mYnumYoOmYo1wiLDYsXCLpmKvpmKzpmK3pmK/pmLDpmLfpmLjpmLnpmLrpmL7pmYHpmYPpmYrpmY7pmY/pmZHpmZLpmZPpmZbpmZdcIl0sXG5bXCJlYTgwXCIsXCLpmZjpmZnpmZrpmZzpmZ3pmZ7pmaDpmaPpmaXpmabpmavpma1cIiw0LFwi6Zmz6Zm4XCIsMTIsXCLpmofpmonpmorovo3ovo7ovo/ovpjovprou47miIvmiJfmiJvmiJ/miKLmiKHmiKXmiKTmiKzoh6fnk6/nk7Tnk7/nlI/nlJHnlJPmlLTml67ml6/ml7DmmIrmmJnmnbLmmIPmmJXmmIDngoXmm7fmmJ3mmLTmmLHmmLbmmLXogIbmmZ/mmZTmmYHmmY/mmZbmmaHmmZfmmbfmmoTmmozmmqfmmp3mmr7mm5vmm5zmm6bmm6notLLotLPotLbotLvotL3otYDotYXotYbotYjotYnotYfotY3otZXotZnop4fop4rop4vop4zop47op4/op5Dop5Hnia7nip/niZ3niabnia/nib7nib/nioTniovnio3nio/nipLmjIjmjLLmjrBcIl0sXG5bXCJlYjQwXCIsXCLpmozpmo7pmpHpmpLpmpPpmpXpmpbpmprpmpvpmp1cIiw5LFwi6ZqoXCIsNyxcIumasemasumatOmatemat+mauOmauumau+mav+mbgumbg+mbiOmbiumbi+mbkOmbkembk+mblOmbllwiLDksXCLpm6FcIiw2LFwi6ZurXCJdLFxuW1wiZWI4MFwiLFwi6Zus6Zut6Zuu6Zuw6Zux6Zuy6Zu06Zu16Zu46Zu66Zu76Zu86Zu96Zu/6ZyC6ZyD6ZyF6ZyK6ZyL6ZyM6ZyQ6ZyR6ZyS6ZyU6ZyV6ZyXXCIsNCxcIumcnemcn+mcoOaQv+aTmOiAhOavquavs+avveavteavueawheawh+awhuawjeawleawmOawmeawmuawoeawqeawpOawquawsuaUteaVleaVq+eJjeeJkueJlueIsOiZouWIluiCn+iCnOiCk+iCvOaciuiCveiCseiCq+iCreiCtOiCt+iDp+iDqOiDqeiDquiDm+iDguiDhOiDmeiDjeiDl+ackOiDneiDq+iDseiDtOiDreiEjeiEjuiDsuiDvOacleiEkuixmuiEtuiEnuiErOiEmOiEsuiFiOiFjOiFk+iFtOiFmeiFmuiFseiFoOiFqeiFvOiFveiFreiFp+WhjeWqteiGiOiGguiGkea7leiGo+iGquiHjOacpuiHiuiGu1wiXSxcbltcImVjNDBcIixcIumcoVwiLDgsXCLpnKvpnKzpnK7pnK/pnLHpnLNcIiw0LFwi6Zy66Zy76Zy86Zy96Zy/XCIsMTgsXCLpnZTpnZXpnZfpnZjpnZrpnZzpnZ3pnZ/pnaPpnaTpnabpnafpnajpnapcIiw3XSxcbltcImVjODBcIixcIumdsumdtemdt1wiLDQsXCLpnb1cIiw3LFwi6Z6GXCIsNCxcIumejOmejumej+mekOmek+melemelumel+memVwiLDQsXCLoh4HohqbmrKTmrLfmrLnmrYPmrYbmrZnpo5Hpo5Lpo5Ppo5Xpo5npo5rmrrPlvYDmr4Lop7PmlpDpvZHmlpPmlrzml4bml4Tml4Pml4zml47ml5Lml5bngoDngpzngpbngp3ngrvng4DngrfngqvngrHng6jng4rnhJDnhJPnhJbnhK/nhLHnhbPnhZznhajnhYXnhbLnhYrnhbjnhbrnhpjnhrPnhrXnhqjnhqDnh6Dnh5Tnh6fnh7nniJ3niKjngaznhJjnhabnhrnmiL7miL3miYPmiYjmiYnnpLvnpYDnpYbnpYnnpZvnpZznpZPnpZrnpaLnpZfnpaDnpa/npafnpbrnpoXnpornpprnpqfnprPlv5Hlv5BcIl0sXG5bXCJlZDQwXCIsXCLpnp7pnp/pnqHpnqLpnqRcIiw2LFwi6Z6s6Z6u6Z6w6Z6x6Z6z6Z61XCIsNDZdLFxuW1wiZWQ4MFwiLFwi6Z+k6Z+l6Z+o6Z+uXCIsNCxcIumftOmft1wiLDIzLFwi5oC85oGd5oGa5oGn5oGB5oGZ5oGj5oKr5oSG5oSN5oWd5oap5oad5oeL5oeR5oiG6IKA6IG/5rKT5rO25re855+255+456CA56CJ56CX56CY56CR5par56Ct56Cc56Cd56C556C656C756Cf56C856Cl56Cs56Cj56Cp56GO56Gt56GW56GX56Cm56GQ56GH56GM56Gq56Kb56KT56Ka56KH56Kc56Kh56Kj56Ky56K556Kl56OU56OZ56OJ56Os56Oy56SF56O056ST56Sk56Se56S06b6b6bu56bu76bu855ux55yE55yN55u555yH55yI55ya55yi55yZ55yt55ym55y155y4552Q552R552H552D552a552oXCJdLFxuW1wiZWU0MFwiLFwi6aCPXCIsNjJdLFxuW1wiZWU4MFwiLFwi6aGOXCIsMzIsXCLnnaLnnaXnnb/nno3nnb3nnoDnnoznnpHnnp/nnqDnnrDnnrXnnr3nlLrnlYDnlY7nlYvnlYjnlZvnlbLnlbnnloPnvZjnvaHnvZ/oqYjnvajnvbTnvbHnvbnnvoHnvb7nm43nm6XooLLpkoXpkobpkofpkovpkorpkozpko3pko/pkpDpkpTpkpfpkpXpkprpkpvpkpzpkqPpkqTpkqvpkqrpkq3pkqzpkq/pkrDpkrLpkrTpkrZcIiw0LFwi6ZK86ZK96ZK/6ZOE6ZOIXCIsNixcIumTkOmTkemTkumTlemTlumTl+mTmemTmOmTm+mTnumTn+mToOmToumTpOmTpemTp+mTqOmTqlwiXSxcbltcImVmNDBcIixcIumhr1wiLDUsXCLpoovpoo7popLpopXpopnpoqPpoqhcIiwzNyxcIumjj+mjkOmjlOmjlumjl+mjm+mjnOmjnemjoFwiLDRdLFxuW1wiZWY4MFwiLFwi6aOl6aOm6aOpXCIsMzAsXCLpk6npk6vpk67pk6/pk7Ppk7Tpk7Xpk7fpk7npk7zpk73pk7/plIPplILplIbplIfplInplIrplI3plI7plI/plJJcIiw0LFwi6ZSY6ZSb6ZSd6ZSe6ZSf6ZSi6ZSq6ZSr6ZSp6ZSs6ZSx6ZSy6ZS06ZS26ZS36ZS46ZS86ZS+6ZS/6ZWC6ZS16ZWE6ZWF6ZWG6ZWJ6ZWM6ZWO6ZWP6ZWS6ZWT6ZWU6ZWW6ZWX6ZWY6ZWZ6ZWb6ZWe6ZWf6ZWd6ZWh6ZWi6ZWkXCIsOCxcIumVr+mVsemVsumVs+mUuuefp+efrOmbieenleenreeno+enq+eohuW1h+eog+eogueonueolFwiXSxcbltcImYwNDBcIixcIumkiFwiLDQsXCLppI7ppI/ppJFcIiwyOCxcIumkr1wiLDI2XSxcbltcImYwODBcIixcIumlilwiLDksXCLppZZcIiwxMixcIumlpOmlpumls+mluOmluemlu+mlvummgummg+mmieeoueeot+epkem7j+mmpeepsOeaiOeajueak+eameeapOeTnueToOeUrOm4oOm4oum4qFwiLDQsXCLpuLLpuLHpuLbpuLjpuLfpuLnpuLrpuL7puYHpuYLpuYTpuYbpuYfpuYjpuYnpuYvpuYzpuY7puZHpuZXpuZfpuZrpuZvpuZzpuZ7puaPpuaZcIiw2LFwi6bmx6bmt6bmz55aS55aU55aW55ag55ad55as55aj55az55a055a455eE55ax55aw55eD55eC55eW55eN55ej55eo55em55ek55er55en55iD55ex55e855e/55iQ55iA55iF55iM55iX55iK55il55iY55iV55iZXCJdLFxuW1wiZjE0MFwiLFwi6aaM6aaO6aaaXCIsMTAsXCLppqbppqfppqlcIiw0N10sXG5bXCJmMTgwXCIsXCLpp5lcIiwzMixcIueYm+eYvOeYoueYoOeZgOeYreeYsOeYv+eYteeZg+eYvueYs+eZjeeZnueZlOeZnOeZlueZq+eZr+e/iuerpuepuOepueeqgOeqhueqiOeqleeqpueqoOeqrOeqqOeqreeqs+ihpOihqeihsuihveihv+iiguiiouijhuiit+iivOijieijouijjuijo+ijpeijseikmuijvOijqOijvuijsOikoeikmeikk+ikm+ikiuiktOikq+iktuilgeilpuilu+eWi+iDpeeasueatOefnOiAkuiAlOiAluiAnOiAoOiAouiApeiApuiAp+iAqeiAqOiAseiAi+iAteiBg+iBhuiBjeiBkuiBqeiBseimg+mhuOmigOmig1wiXSxcbltcImYyNDBcIixcIumnulwiLDYyXSxcbltcImYyODBcIixcIumouVwiLDMyLFwi6aKJ6aKM6aKN6aKP6aKU6aKa6aKb6aKe6aKf6aKh6aKi6aKl6aKm6JmN6JmU6Jms6Jmu6Jm/6Jm66Jm86Jm76Jqo6JqN6JqL6Jqs6Jqd6Jqn6Jqj6Jqq6JqT6Jqp6Jq26JuE6Jq16JuO6Jqw6Jq66Jqx6Jqv6JuJ6JuP6Jq06Jup6Jux6Juy6Jut6Juz6JuQ6JyT6Jue6Ju06Juf6JuY6JuR6JyD6JyH6Ju46JyI6JyK6JyN6JyJ6Jyj6Jy76Jye6Jyl6Jyu6Jya6Jy+6J2I6Jy06Jyx6Jyp6Jy36Jy/6J6C6Jyi6J296J2+6J276J2g6J2w6J2M6J2u6J6L6J2T6J2j6J286J2k6J2Z6J2l6J6T6J6v6J6o6J+SXCJdLFxuW1wiZjM0MFwiLFwi6amaXCIsMTcsXCLpqbLpqoPpqonpqo3pqo7pqpTpqpXpqpnpqqbpqqlcIiw2LFwi6aqy6aqz6aq06aq16aq56aq76aq96aq+6aq/6auD6auE6auGXCIsNCxcIumrjemrjumrj+mrkOmrkumrlOmrlemrlumrl+mrmemrmumrm+mrnFwiXSxcbltcImYzODBcIixcIumrnemrnumroOmroumro+mrpOmrpemrp+mrqOmrqemrqumrrOmrrumrsFwiLDgsXCLpq7rpq7xcIiw2LFwi6ayE6ayF6ayG6J+G6J6I6J6F6J6t6J6X6J6D6J6r6J+l6J6s6J616J6z6J+L6J+T6J696J+R6J+A6J+K6J+b6J+q6J+g6J+u6KCW6KCT6J++6KCK6KCb6KCh6KC56KC857y2572C572E572F6IiQ56u656u956yI56yD56yE56yV56yK56yr56yP562H56y456yq56yZ56yu56yx56yg56yl56yk56yz56y+56ye562Y562a562F5621562M562d562g562u5627562i562y562x566Q566m566n5664566s566d566o566F566q566c566i566r566056+R56+B56+M56+d56+a56+l56+m56+q57CM56++56+857CP57CW57CLXCJdLFxuW1wiZjQ0MFwiLFwi6ayH6ayJXCIsNSxcIumskOmskemskumslFwiLDEwLFwi6ayg6ayh6ayi6aykXCIsMTAsXCLprLDprLHprLNcIiw3LFwi6ay96ay+6ay/6a2A6a2G6a2K6a2L6a2M6a2O6a2Q6a2S6a2T6a2VXCIsNV0sXG5bXCJmNDgwXCIsXCLprZtcIiwzMixcIuewn+ewquewpuewuOexgeexgOiHvuiIgeiIguiIhOiHrOihhOiIoeiIouiIo+iIreiIr+iIqOiIq+iIuOiIu+iIs+iItOiIvuiJhOiJieiJi+iJj+iJmuiJn+iJqOihvuiiheiiiOijmOijn+ilnue+nee+n+e+p+e+r+e+sOe+suexvOaVieeykeeyneeynOeynueyoueysueyvOeyveezgeezh+ezjOezjeeziOezheezl+ezqOiJruaaqOe+v+e/jue/lee/pee/oee/pue/qee/rue/s+ezuOe1t+e2pue2rue5h+e6m+m6uOm6tOi1s+i2hOi2lOi2kei2sei1p+i1reixh+ixiemFiumFkOmFjumFj+mFpFwiXSxcbltcImY1NDBcIixcIumtvFwiLDYyXSxcbltcImY1ODBcIixcIumuu1wiLDMyLFwi6YWi6YWh6YWw6YWp6YWv6YW96YW+6YWy6YW06YW56YaM6YaF6YaQ6YaN6YaR6Yai6Yaj6Yaq6Yat6Yau6Yav6Ya16Ya06Ya66LGV6bm+6La46Ler6LiF6LmZ6Lmp6La16La/6La86La66LeE6LeW6LeX6Lea6Lee6LeO6LeP6Leb6LeG6Les6Le36Le46Lej6Le56Le76Lek6LiJ6Le96LiU6Lid6Lif6Lis6Liu6Lij6Liv6Li66LmA6Li56Li16Li96Lix6LmJ6LmB6LmC6LmR6LmS6LmK6Lmw6Lm26Lm86Lmv6Lm06LqF6LqP6LqU6LqQ6Lqc6Lqe6LG46LKC6LKK6LKF6LKY6LKU5pab6KeW6Kee6Kea6KecXCJdLFxuW1wiZjY0MFwiLFwi6a+cXCIsNjJdLFxuW1wiZjY4MFwiLFwi6bCbXCIsMzIsXCLop6Xop6vop6/oqL7orKbpnZPpm6npm7Ppm6/pnIbpnIHpnIjpnI/pnI7pnKrpnK3pnLDpnL7pvoDpvoPpvoVcIiw1LFwi6b6M6bu+6byL6byN6Zq56Zq86Zq96ZuO6ZuS556/6Zug6YqO6Yqu6YuI6Yy+6Y2q6Y+K6Y6P6ZC+6ZGr6bG/6bKC6bKF6bKG6bKH6bKI56ij6bKL6bKO6bKQ6bKR6bKS6bKU6bKV6bKa6bKb6bKeXCIsNSxcIumypVwiLDQsXCLpsqvpsq3psq7psrBcIiw3LFwi6bK66bK76bK86bK96bOE6bOF6bOG6bOH6bOK6bOLXCJdLFxuW1wiZjc0MFwiLFwi6bC8XCIsNjJdLFxuW1wiZjc4MFwiLFwi6bG76bG96bG+6bKA6bKD6bKE6bKJ6bKK6bKM6bKP6bKT6bKW6bKX6bKY6bKZ6bKd6bKq6bKs6bKv6bK56bK+XCIsNCxcIumziOmziemzkemzkumzmumzm+mzoOmzoemzjFwiLDQsXCLps5Pps5Tps5Xps5fps5jps5nps5zps53ps5/ps6LpnbzpnoXpnpHpnpLpnpTpnq/pnqvpnqPpnrLpnrTpqrHpqrDpqrfpuZjpqrbpqrrpqrzpq4Hpq4Dpq4Xpq4Lpq4vpq4zpq5HprYXprYPprYfprYnprYjprY3prZHpo6jppI3ppK7ppZXppZTpq5/pq6Hpq6bpq6/pq6vpq7vpq63pq7nprIjprI/prJPprJ/prKPpur3pur7nuLvpuoLpuofpuojpuovpupLpj5bpup3pup/pu5vpu5zpu53pu6Dpu5/pu6Lpu6npu6fpu6Xpu6rpu6/pvKLpvKzpvK/pvLnpvLfpvL3pvL7pvYRcIl0sXG5bXCJmODQwXCIsXCLps6NcIiw2Ml0sXG5bXCJmODgwXCIsXCLptKJcIiwzMl0sXG5bXCJmOTQwXCIsXCLptYNcIiw2Ml0sXG5bXCJmOTgwXCIsXCLptoJcIiwzMl0sXG5bXCJmYTQwXCIsXCLptqNcIiw2Ml0sXG5bXCJmYTgwXCIsXCLpt6JcIiwzMl0sXG5bXCJmYjQwXCIsXCLpuINcIiwyNyxcIum4pOm4p+m4rum4sOm4tOm4u+m4vOm5gOm5jem5kOm5kum5k+m5lOm5lum5mem5nem5n+m5oOm5oem5oum5pem5rum5r+m5sum5tFwiLDksXCLpuoBcIl0sXG5bXCJmYjgwXCIsXCLpuoHpuoPpuoTpuoXpuobpuonpuorpuoxcIiw1LFwi6bqUXCIsOCxcIum6num6oFwiLDUsXCLpuqfpuqjpuqnpuqpcIl0sXG5bXCJmYzQwXCIsXCLpuqtcIiw4LFwi6bq16bq26bq36bq56bq66bq86bq/XCIsNCxcIum7hem7hum7h+m7iOm7ium7i+m7jOm7kOm7kum7k+m7lem7lum7l+m7mem7mum7num7oem7o+m7pOm7pum7qOm7q+m7rOm7rem7rum7sFwiLDgsXCLpu7rpu73pu79cIiw2XSxcbltcImZjODBcIixcIum8hlwiLDQsXCLpvIzpvI/pvJHpvJLpvJTpvJXpvJbpvJjpvJpcIiw1LFwi6byh6byjXCIsOCxcIum8rem8rum8sOm8sVwiXSxcbltcImZkNDBcIixcIum8slwiLDQsXCLpvLjpvLrpvLzpvL9cIiw0LFwi6b2FXCIsMTAsXCLpvZJcIiwzOF0sXG5bXCJmZDgwXCIsXCLpvblcIiw1LFwi6b6B6b6C6b6NXCIsMTEsXCLpvpzpvp3pvp7pvqFcIiw0LFwi76Ss76W576aV76en76exXCJdLFxuW1wiZmU0MFwiLFwi76iM76iN76iO76iP76iR76iT76iU76iY76if76ig76ih76ij76ik76in76io76ipXCJdXG5dXG4iLCJtb2R1bGUuZXhwb3J0cz1bXG5bXCIwXCIsXCJcXHUwMDAwXCIsMTI3XSxcbltcIjgxNDFcIixcIuqwguqwg+qwheqwhuqwi1wiLDQsXCLqsJjqsJ7qsJ/qsKHqsKLqsKPqsKVcIiw2LFwi6rCu6rCy6rCz6rC0XCJdLFxuW1wiODE2MVwiLFwi6rC16rC26rC36rC66rC76rC96rC+6rC/6rGBXCIsOSxcIuqxjOqxjlwiLDUsXCLqsZVcIl0sXG5bXCI4MTgxXCIsXCLqsZbqsZfqsZnqsZrqsZvqsZ1cIiwxOCxcIuqxsuqxs+qxteqxtuqxueqxu1wiLDQsXCLqsoLqsofqsojqso3qso7qso/qspHqspLqspPqspVcIiw2LFwi6rKe6rKiXCIsNSxcIuqyq+qyreqyruqysVwiLDYsXCLqsrrqsr7qsr/qs4Dqs4Lqs4Pqs4Xqs4bqs4fqs4nqs4rqs4vqs41cIiw3LFwi6rOW6rOYXCIsNyxcIuqzouqzo+qzpeqzpuqzqeqzq+qzreqzruqzsuqztOqzt1wiLDQsXCLqs77qs7/qtIHqtILqtIPqtIXqtIdcIiw0LFwi6rSO6rSQ6rSS6rSTXCJdLFxuW1wiODI0MVwiLFwi6rSU6rSV6rSW6rSX6rSZ6rSa6rSb6rSd6rSe6rSf6rShXCIsNyxcIuq0quq0q+q0rlwiLDVdLFxuW1wiODI2MVwiLFwi6rS26rS36rS56rS66rS76rS9XCIsNixcIuq1huq1iOq1ilwiLDUsXCLqtZHqtZLqtZPqtZXqtZbqtZdcIl0sXG5bXCI4MjgxXCIsXCLqtZlcIiw3LFwi6rWi6rWkXCIsNyxcIuq1ruq1r+q1seq1suq1t+q1uOq1ueq1uuq1vuq2gOq2g1wiLDQsXCLqtorqtovqto3qto7qto/qtpFcIiwxMCxcIuq2nlwiLDUsXCLqtqVcIiwxNyxcIuq2uFwiLDcsXCLqt4Lqt4Pqt4Xqt4bqt4fqt4lcIiw2LFwi6reS6reUXCIsNyxcIuq3neq3nuq3n+q3oeq3ouq3o+q3pVwiLDE4XSxcbltcIjgzNDFcIixcIuq3uuq3u+q3veq3vuq4glwiLDUsXCLquIrquIzquI5cIiw1LFwi6riVXCIsN10sXG5bXCI4MzYxXCIsXCLquJ1cIiwxOCxcIuq4suq4s+q4teq4tuq4ueq4u+q4vFwiXSxcbltcIjgzODFcIixcIuq4veq4vuq4v+q5guq5hOq5h+q5iOq5ieq5i+q5j+q5keq5kuq5k+q5leq5l1wiLDQsXCLquZ7quaLquaPquaTquabquafquarquavqua3qua7qua/qubFcIiw2LFwi6rm66rm+XCIsNSxcIuq6hlwiLDUsXCLquo1cIiw0NixcIuq6v+q7geq7guq7g+q7hVwiLDYsXCLqu47qu5JcIiw1LFwi6rua6rub6rudXCIsOF0sXG5bXCI4NDQxXCIsXCLqu6bqu6fqu6nqu6rqu6zqu65cIiw1LFwi6ru16ru26ru36ru56ru66ru76ru9XCIsOF0sXG5bXCI4NDYxXCIsXCLqvIbqvInqvIrqvIvqvIzqvI7qvI/qvJFcIiwxOF0sXG5bXCI4NDgxXCIsXCLqvKRcIiw3LFwi6ryu6ryv6ryx6ryz6ry1XCIsNixcIuq8vuq9gOq9hOq9heq9huq9h+q9ilwiLDUsXCLqvZFcIiwxMCxcIuq9nlwiLDUsXCLqvaZcIiwxOCxcIuq9ulwiLDUsXCLqvoHqvoLqvoPqvoXqvobqvofqvolcIiw2LFwi6r6S6r6T6r6U6r6WXCIsNSxcIuq+nVwiLDI2LFwi6r666r676r696r6+XCJdLFxuW1wiODU0MVwiLFwi6r6/6r+BXCIsNSxcIuq/iuq/jOq/j1wiLDQsXCLqv5VcIiw2LFwi6r+dXCIsNF0sXG5bXCI4NTYxXCIsXCLqv6JcIiw1LFwi6r+qXCIsNSxcIuq/suq/s+q/teq/tuq/t+q/uVwiLDYsXCLrgILrgINcIl0sXG5bXCI4NTgxXCIsXCLrgIVcIiw2LFwi64CN64CO64CP64CR64CS64CT64CVXCIsNixcIuuAnlwiLDksXCLrgKlcIiwyNixcIuuBhuuBh+uBieuBi+uBjeuBj+uBkOuBkeuBkuuBluuBmOuBmuuBm+uBnOuBnlwiLDI5LFwi64G+64G/64KB64KC64KD64KFXCIsNixcIuuCjuuCkOuCklwiLDUsXCLrgpvrgp3rgp7rgqPrgqRcIl0sXG5bXCI4NjQxXCIsXCLrgqXrgqbrgqfrgqrrgrDrgrLrgrbrgrfrgrnrgrrrgrvrgr1cIiw2LFwi64OG64OKXCIsNSxcIuuDklwiXSxcbltcIjg2NjFcIixcIuuDk+uDleuDluuDl+uDmVwiLDYsXCLrg6Hrg6Lrg6Prg6Trg6ZcIiwxMF0sXG5bXCI4NjgxXCIsXCLrg7FcIiwyMixcIuuEiuuEjeuEjuuEj+uEkeuElOuEleuEluuEl+uEmuuEnlwiLDQsXCLrhKbrhKfrhKnrhKrrhKvrhK1cIiw2LFwi64S264S6XCIsNSxcIuuFguuFg+uFheuFhuuFh+uFiVwiLDYsXCLrhZLrhZPrhZbrhZfrhZnrhZrrhZvrhZ3rhZ7rhZ/rhaFcIiwyMixcIuuFuuuFu+uFveuFvuuFv+uGgeuGg1wiLDQsXCLrhorrhozrho7rho/rhpDrhpHrhpXrhpbrhpfrhpnrhprrhpvrhp1cIl0sXG5bXCI4NzQxXCIsXCLrhp5cIiw5LFwi64apXCIsMTVdLFxuW1wiODc2MVwiLFwi64a5XCIsMTgsXCLrh43rh47rh4/rh5Hrh5Lrh5Prh5VcIl0sXG5bXCI4NzgxXCIsXCLrh5ZcIiw1LFwi64ee64egXCIsNyxcIuuHquuHq+uHreuHruuHr+uHsVwiLDcsXCLrh7rrh7zrh75cIiw1LFwi64iG64iH64iJ64iK64iNXCIsNixcIuuIluuImOuImlwiLDUsXCLriKFcIiwxOCxcIuuItVwiLDYsXCLriL1cIiwyNixcIuuJmeuJmuuJm+uJneuJnuuJn+uJoVwiLDYsXCLriapcIiw0XSxcbltcIjg4NDFcIixcIuuJr1wiLDQsXCLribZcIiw1LFwi64m9XCIsNixcIuuKhuuKh+uKiOuKilwiLDRdLFxuW1wiODg2MVwiLFwi64qP64qS64qT64qV64qW64qX64qbXCIsNCxcIuuKouuKpOuKp+uKqOuKqeuKq+uKreuKruuKr+uKseuKsuuKs+uKteuKtuuKt1wiXSxcbltcIjg4ODFcIixcIuuKuFwiLDE1LFwi64uK64uL64uN64uO64uP64uR64uTXCIsNCxcIuuLmuuLnOuLnuuLn+uLoOuLoeuLo+uLp+uLqeuLquuLsOuLseuLsuuLtuuLvOuLveuLvuuMguuMg+uMheuMhuuMh+uMiVwiLDYsXCLrjJLrjJZcIiw1LFwi64ydXCIsNTQsXCLrjZfrjZnrjZrrjZ3rjaDrjaHrjaLrjaNcIl0sXG5bXCI4OTQxXCIsXCLrjabrjajrjarrjazrja3rja/rjbLrjbPrjbXrjbbrjbfrjblcIiw2LFwi646C646GXCIsNSxcIuuOjVwiXSxcbltcIjg5NjFcIixcIuuOjuuOj+uOkeuOkuuOk+uOlVwiLDEwLFwi646iXCIsNSxcIuuOqeuOquuOq+uOrVwiXSxcbltcIjg5ODFcIixcIuuOrlwiLDIxLFwi64+G64+H64+J64+K64+N64+P64+R64+S64+T64+W64+Y64+a64+c64+e64+f64+h64+i64+j64+l64+m64+n64+pXCIsMTgsXCLrj71cIiwxOCxcIuuQkVwiLDYsXCLrkJnrkJrrkJvrkJ3rkJ7rkJ/rkKFcIiw2LFwi65Cq65CsXCIsNyxcIuuQtVwiLDE1XSxcbltcIjhhNDFcIixcIuuRhVwiLDEwLFwi65GS65GT65GV65GW65GX65GZXCIsNixcIuuRouuRpOuRplwiXSxcbltcIjhhNjFcIixcIuuRp1wiLDQsXCLrka1cIiwxOCxcIuuSgeuSglwiXSxcbltcIjhhODFcIixcIuuSg1wiLDQsXCLrkolcIiwxOSxcIuuSnlwiLDUsXCLrkqXrkqbrkqfrkqnrkqrrkqvrkq1cIiw3LFwi65K265K465K6XCIsNSxcIuuTgeuTguuTg+uTheuThuuTh+uTiVwiLDYsXCLrk5Hrk5Lrk5Prk5Trk5ZcIiw1LFwi65Oe65Of65Oh65Oi65Ol65OnXCIsNCxcIuuTruuTsOuTslwiLDUsXCLrk7lcIiwyNixcIuuUluuUl+uUmeuUmuuUnVwiXSxcbltcIjhiNDFcIixcIuuUnlwiLDUsXCLrlKbrlKtcIiw0LFwi65Sy65Sz65S165S265S365S5XCIsNixcIuuVguuVhlwiXSxcbltcIjhiNjFcIixcIuuVh+uViOuVieuViuuVjuuVj+uVkeuVkuuVk+uVlVwiLDYsXCLrlZ7rlaJcIiw4XSxcbltcIjhiODFcIixcIuuVq1wiLDUyLFwi65ai65aj65al65am65an65ap65as65at65au65av65ay65a2XCIsNCxcIuuWvuuWv+uXgeuXguuXg+uXhVwiLDYsXCLrl47rl5JcIiw1LFwi65eZXCIsMTgsXCLrl61cIiwxOF0sXG5bXCI4YzQxXCIsXCLrmIBcIiwxNSxcIuuYkuuYk+uYleuYluuYl+uYmVwiLDRdLFxuW1wiOGM2MVwiLFwi65ieXCIsNixcIuuYplwiLDUsXCLrmK1cIiw2LFwi65i1XCIsNV0sXG5bXCI4YzgxXCIsXCLrmLtcIiwxMixcIuuZiVwiLDI2LFwi65ml65mm65mn65mpXCIsNTAsXCLrmp7rmp/rmqHrmqLrmqPrmqVcIiw1LFwi65qt65qu65qv65qw65qyXCIsMTZdLFxuW1wiOGQ0MVwiLFwi65uDXCIsMTYsXCLrm5VcIiw4XSxcbltcIjhkNjFcIixcIuubnlwiLDE3LFwi65ux65uy65uz65u165u265u365u565u6XCJdLFxuW1wiOGQ4MVwiLFwi65u7XCIsNCxcIuucguucg+uchOuchlwiLDMzLFwi65yq65yr65yt65yu65yxXCIsNixcIuucuuucvFwiLDcsXCLrnYXrnYbrnYfrnYnrnYrrnYvrnY1cIiw2LFwi652WXCIsOSxcIuudoeudouudo+udpeudpuudp+udqVwiLDYsXCLrnbLrnbTrnbZcIiw1LFwi652+652/656B656C656D656FXCIsNixcIuuejuuek+uelOueleuemuuem+ueneuenlwiXSxcbltcIjhlNDFcIixcIuuen+ueoVwiLDYsXCLrnqrrnq5cIiw1LFwi656265636565XCIsOF0sXG5bXCI4ZTYxXCIsXCLrn4JcIiw0LFwi65+I65+KXCIsMTldLFxuW1wiOGU4MVwiLFwi65+eXCIsMTMsXCLrn67rn6/rn7Hrn7Lrn7Prn7VcIiw2LFwi65++66CCXCIsNCxcIuugiuugi+ugjeugjuugj+ugkVwiLDYsXCLroJrroJzroJ5cIiw1LFwi66Cm66Cn66Cp66Cq66Cr66CtXCIsNixcIuugtuugulwiLDUsXCLroYHroYLroYProYVcIiwxMSxcIuuhkuuhlFwiLDcsXCLroZ7roZ/roaHroaLroaProaVcIiw2LFwi66Gu66Gw66GyXCIsNSxcIuuhueuhuuuhu+uhvVwiLDddLFxuW1wiOGY0MVwiLFwi66KFXCIsNyxcIuuijlwiLDE3XSxcbltcIjhmNjFcIixcIuuioFwiLDcsXCLroqlcIiw2LFwi66Kx66Ky66Kz66K166K266K366K5XCIsNF0sXG5bXCI4ZjgxXCIsXCLror7ror/ro4Lro4Tro4ZcIiw1LFwi66ON66OO66OP66OR66OS66OT66OVXCIsNyxcIuujnuujoOujolwiLDUsXCLro6rro6vro63ro67ro6/ro7FcIiw2LFwi66O666O866O+XCIsNSxcIuukhVwiLDE4LFwi66SZXCIsNixcIuukoVwiLDI2LFwi66S+66S/66WB66WC66WD66WFXCIsNixcIuuljeuljuulkOulklwiLDVdLFxuW1wiOTA0MVwiLFwi66Wa66Wb66Wd66We66Wf66WhXCIsNixcIuulquulrOulrlwiLDUsXCLrpbbrpbfrpbnrpbrrpbvrpb1cIl0sXG5bXCI5MDYxXCIsXCLrpb5cIiw1LFwi66aG66aI66aL66aM66aPXCIsMTVdLFxuW1wiOTA4MVwiLFwi66afXCIsMTIsXCLrpq7rpq/rprHrprLrprPrprVcIiw2LFwi66a+66eA66eCXCIsNSxcIuuniuuni+unjeunk1wiLDQsXCLrp5rrp5zrp5/rp6Drp6Lrp6brp6frp6nrp6rrp6vrp61cIiw2LFwi66e266e7XCIsNCxcIuuoglwiLDUsXCLrqIlcIiwxMSxcIuuollwiLDMzLFwi66i666i766i966i+66i/66mB66mD66mE66mF66mGXCJdLFxuW1wiOTE0MVwiLFwi66mH66mK66mM66mP66mQ66mR66mS66mW66mX66mZ66ma66mb66mdXCIsNixcIuuppuupqlwiLDVdLFxuW1wiOTE2MVwiLFwi66my66mz66m166m266m366m5XCIsOSxcIuuqhuuqiOuqieuqiuuqi+uqjVwiLDVdLFxuW1wiOTE4MVwiLFwi66qTXCIsMjAsXCLrqqrrqq3rqq7rqq/rqrHrqrNcIiw0LFwi66q666q866q+XCIsNSxcIuurheurhuurh+uriVwiLDE0LFwi66uaXCIsMzMsXCLrq73rq77rq7/rrIHrrILrrIPrrIVcIiw3LFwi66yO66yQ66ySXCIsNSxcIuusmeusmuusm+usneusnuusn+usoVwiLDZdLFxuW1wiOTI0MVwiLFwi66yo66yq66ysXCIsNyxcIuust+usueusuuusv1wiLDQsXCLrrYbrrYjrrYrrrYvrrYzrrY7rrZHrrZJcIl0sXG5bXCI5MjYxXCIsXCLrrZPrrZXrrZbrrZfrrZlcIiw3LFwi662i662kXCIsNyxcIuutrVwiLDRdLFxuW1wiOTI4MVwiLFwi662yXCIsMjEsXCLrronrrorrrovrro3rro7rro/rrpFcIiwxOCxcIuuupeuupuuup+uuqeuuquuuq+uurVwiLDYsXCLrrrXrrrbrrrhcIiw3LFwi66+B66+C66+D66+F66+G66+H66+JXCIsNixcIuuvkeuvkuuvlFwiLDM1LFwi66+666+766+966++67CBXCJdLFxuW1wiOTM0MVwiLFwi67CDXCIsNCxcIuuwiuuwjuuwkOuwkuuwk+uwmeuwmuuwoOuwoeuwouuwo+uwpuuwqOuwquuwq+uwrOuwruuwr+uwsuuws+uwtVwiXSxcbltcIjkzNjFcIixcIuuwtuuwt+uwuVwiLDYsXCLrsYLrsYbrsYfrsYjrsYrrsYvrsY7rsY/rsZFcIiw4XSxcbltcIjkzODFcIixcIuuxmuuxm+uxnOuxnlwiLDM3LFwi67KG67KH67KJ67KK67KN67KPXCIsNCxcIuuyluuymOuym1wiLDQsXCLrsqLrsqPrsqXrsqbrsqlcIiw2LFwi67Ky67K2XCIsNSxcIuuyvuuyv+uzgeuzguuzg+uzhVwiLDcsXCLrs47rs5Lrs5Prs5Trs5brs5frs5nrs5rrs5vrs51cIiwyMixcIuuzt+uzueuzuuuzu+uzvVwiXSxcbltcIjk0NDFcIixcIuuzvlwiLDUsXCLrtIbrtIjrtIpcIiw1LFwi67SR67SS67ST67SVXCIsOF0sXG5bXCI5NDYxXCIsXCLrtJ5cIiw1LFwi67SlXCIsNixcIuu0rVwiLDEyXSxcbltcIjk0ODFcIixcIuu0ulwiLDUsXCLrtYFcIiw2LFwi67WK67WL67WN67WO67WP67WRXCIsNixcIuu1mlwiLDksXCLrtaXrtabrtafrtalcIiwyMixcIuu2guu2g+u2heu2huu2i1wiLDQsXCLrtpLrtpTrtpbrtpfrtpjrtpvrtp1cIiw2LFwi67alXCIsMTAsXCLrtrFcIiw2LFwi67a5XCIsMjRdLFxuW1wiOTU0MVwiLFwi67eS67eT67eW67eX67eZ67ea67eb67edXCIsMTEsXCLrt6pcIiw1LFwi67exXCJdLFxuW1wiOTU2MVwiLFwi67ey67ez67e167e267e367e5XCIsNixcIuu4geu4guu4hOu4hlwiLDUsXCLruI7ruI/ruJHruJLruJNcIl0sXG5bXCI5NTgxXCIsXCLruJVcIiw2LFwi67ie67igXCIsMzUsXCLruYbruYfruYnruYrruYvruY3ruY9cIiw0LFwi67mW67mY67mc67md67me67mf67mi67mj67ml67mm67mn67mp67mrXCIsNCxcIuu5suu5tlwiLDQsXCLrub7rub/ruoHruoLruoPruoVcIiw2LFwi67qO67qSXCIsNSxcIuu6mlwiLDEzLFwi67qpXCIsMTRdLFxuW1wiOTY0MVwiLFwi67q4XCIsMjMsXCLru5Lru5NcIl0sXG5bXCI5NjYxXCIsXCLru5Xru5bru5lcIiw2LFwi67uh67ui67umXCIsNSxcIuu7rVwiLDhdLFxuW1wiOTY4MVwiLFwi67u2XCIsMTAsXCLrvIJcIiw1LFwi67yKXCIsMTMsXCLrvJrrvJ5cIiwzMyxcIuu9guu9g+u9heu9huu9h+u9iVwiLDYsXCLrvZLrvZPrvZTrvZZcIiw0NF0sXG5bXCI5NzQxXCIsXCLrvoNcIiwxNixcIuu+lVwiLDhdLFxuW1wiOTc2MVwiLFwi676eXCIsMTcsXCLrvrFcIiw3XSxcbltcIjk3ODFcIixcIuu+uVwiLDExLFwi67+GXCIsNSxcIuu/juu/j+u/keu/kuu/k+u/lVwiLDYsXCLrv53rv57rv6Drv6JcIiw4OSxcIuyAveyAvuyAv1wiXSxcbltcIjk4NDFcIixcIuyBgFwiLDE2LFwi7IGSXCIsNSxcIuyBmeyBmuyBm1wiXSxcbltcIjk4NjFcIixcIuyBneyBnuyBn+yBoVwiLDYsXCLsgapcIiwxNV0sXG5bXCI5ODgxXCIsXCLsgbpcIiwyMSxcIuyCkuyCk+yCleyCluyCl+yCmVwiLDYsXCLsgqLsgqTsgqZcIiw1LFwi7IKu7IKx7IKy7IK3XCIsNCxcIuyCvuyDguyDg+yDhOyDhuyDh+yDiuyDi+yDjeyDjuyDj+yDkVwiLDYsXCLsg5rsg55cIiw1LFwi7IOm7IOn7IOp7IOq7IOr7IOtXCIsNixcIuyDtuyDuOyDulwiLDUsXCLshIHshILshIPshIXshIbshIfshIlcIiw2LFwi7ISR7ISS7IST7ISU7ISWXCIsNSxcIuyEoeyEouyEpeyEqOyEqeyEquyEq+yErlwiXSxcbltcIjk5NDFcIixcIuyEsuyEs+yEtOyEteyEt+yEuuyEu+yEveyEvuyEv+yFgVwiLDYsXCLshYrshY5cIiw1LFwi7IWW7IWXXCJdLFxuW1wiOTk2MVwiLFwi7IWZ7IWa7IWb7IWdXCIsNixcIuyFpuyFqlwiLDUsXCLshbHshbLshbPshbXshbbshbfshbnshbrshbtcIl0sXG5bXCI5OTgxXCIsXCLshbxcIiw4LFwi7IaGXCIsNSxcIuyGj+yGkeyGkuyGk+yGleyGl1wiLDQsXCLshp7shqDshqLshqPshqTshqbshqfshqrshqvshq3shq7shq/shrFcIiwxMSxcIuyGvlwiLDUsXCLsh4Xsh4bsh4fsh4nsh4rsh4vsh41cIiw2LFwi7IeV7IeW7IeZXCIsNixcIuyHoeyHouyHo+yHpeyHpuyHp+yHqVwiLDYsXCLsh7Lsh7RcIiw3LFwi7Ie+7Ie/7IiB7IiC7IiD7IiFXCIsNixcIuyIjuyIkOyIklwiLDUsXCLsiJrsiJvsiJ3siJ7siKHsiKLsiKNcIl0sXG5bXCI5YTQxXCIsXCLsiKTsiKXsiKbsiKfsiKrsiKzsiK7siLDsiLPsiLVcIiwxNl0sXG5bXCI5YTYxXCIsXCLsiYbsiYfsiYlcIiw2LFwi7ImS7ImT7ImV7ImW7ImX7ImZXCIsNixcIuyJoeyJouyJo+yJpOyJplwiXSxcbltcIjlhODFcIixcIuyJp1wiLDQsXCLsia7sia/sibHsibLsibPsibVcIiw2LFwi7Im+7IqA7IqCXCIsNSxcIuyKilwiLDUsXCLsipFcIiw2LFwi7IqZ7Iqa7Iqc7IqeXCIsNSxcIuyKpuyKp+yKqeyKquyKq+yKrlwiLDUsXCLsirbsirjsirpcIiwzMyxcIuyLnuyLn+yLoeyLouyLpVwiLDUsXCLsi67si7Dsi7Lsi7Psi7Tsi7Xsi7fsi7rsi73si77si7/sjIFcIiw2LFwi7IyK7IyL7IyO7IyPXCJdLFxuW1wiOWI0MVwiLFwi7IyQ7IyR7IyS7IyW7IyX7IyZ7Iya7Iyb7IydXCIsNixcIuyMpuyMp+yMqlwiLDhdLFxuW1wiOWI2MVwiLFwi7IyzXCIsMTcsXCLsjYZcIiw3XSxcbltcIjliODFcIixcIuyNjlwiLDI1LFwi7I2q7I2r7I2t7I2u7I2v7I2x7I2zXCIsNCxcIuyNuuyNu+yNvlwiLDUsXCLsjoXsjobsjofsjonsjorsjovsjo1cIiw1MCxcIuyPgVwiLDIyLFwi7I+aXCJdLFxuW1wiOWM0MVwiLFwi7I+b7I+d7I+e7I+h7I+jXCIsNCxcIuyPquyPq+yPrOyPrlwiLDUsXCLsj7bsj7fsj7lcIiw1XSxcbltcIjljNjFcIixcIuyPv1wiLDgsXCLskIlcIiw2LFwi7JCRXCIsOV0sXG5bXCI5YzgxXCIsXCLskJtcIiw4LFwi7JClXCIsNixcIuyQreyQruyQr+yQseyQsuyQs+yQtVwiLDYsXCLskL5cIiw5LFwi7JGJXCIsMjYsXCLskabskafskanskarskavska1cIiw2LFwi7JG27JG37JG47JG6XCIsNSxcIuySgVwiLDE4LFwi7JKVXCIsNixcIuySnVwiLDEyXSxcbltcIjlkNDFcIixcIuySqlwiLDEzLFwi7JK57JK67JK77JK9XCIsOF0sXG5bXCI5ZDYxXCIsXCLsk4ZcIiwyNV0sXG5bXCI5ZDgxXCIsXCLsk6BcIiw4LFwi7JOqXCIsNSxcIuyTsuyTs+yTteyTtuyTt+yTueyTu+yTvOyTveyTvuyUglwiLDksXCLslI3slI7slI/slJHslJLslJPslJVcIiw2LFwi7JSdXCIsMTAsXCLslKrslKvslK3slK7slK/slLFcIiw2LFwi7JS67JS87JS+XCIsNSxcIuyVhuyVh+yVi+yVj+yVkOyVkeyVkuyVluyVmuyVm+yVnOyVn+yVouyVo+yVpeyVpuyVp+yVqVwiLDYsXCLslbLslbZcIiw1LFwi7JW+7JW/7JaB7JaC7JaD7JaF7JaG7JaI7JaJ7JaK7JaL7JaO7JaQ7JaS7JaT7JaUXCJdLFxuW1wiOWU0MVwiLFwi7JaW7JaZ7Jaa7Jab7Jad7Jae7Jaf7JahXCIsNyxcIuyWqlwiLDksXCLslrZcIl0sXG5bXCI5ZTYxXCIsXCLslrfslrrslr9cIiw0LFwi7JeL7JeN7JeP7JeS7JeT7JeV7JeW7JeX7JeZXCIsNixcIuyXouyXpOyXpuyXp1wiXSxcbltcIjllODFcIixcIuyXqOyXqeyXquyXq+yXr+yXseyXsuyXs+yXteyXuOyXueyXuuyXu+yYguyYg+yYhOyYieyYiuyYi+yYjeyYjuyYj+yYkVwiLDYsXCLsmJrsmJ1cIiw2LFwi7Jim7Jin7Jip7Jiq7Jir7Jiv7Jix7Jiy7Ji27Ji47Ji67Ji87Ji97Ji+7Ji/7JmC7JmD7JmF7JmG7JmH7JmJXCIsNixcIuyZkuyZllwiLDUsXCLsmZ7smZ/smaFcIiwxMCxcIuyZreyZruyZsOyZslwiLDUsXCLsmbrsmbvsmb3smb7smb/smoFcIiw2LFwi7JqK7JqM7JqOXCIsNSxcIuyaluyal+yameyamuyam+yanVwiLDYsXCLsmqZcIl0sXG5bXCI5ZjQxXCIsXCLsmqjsmqpcIiw1LFwi7Jqy7Jqz7Jq17Jq27Jq37Jq7XCIsNCxcIuybguybhOybhlwiLDUsXCLsm45cIl0sXG5bXCI5ZjYxXCIsXCLsm4/sm5Hsm5Lsm5Psm5VcIiw2LFwi7Jue7Juf7JuiXCIsNSxcIuybquybq+ybreybruybr+ybseybslwiXSxcbltcIjlmODFcIixcIuybs1wiLDQsXCLsm7rsm7vsm7zsm75cIiw1LFwi7JyG7JyH7JyJ7JyK7JyL7JyNXCIsNixcIuycluycmOycmlwiLDUsXCLsnKLsnKPsnKXsnKbsnKfsnKlcIiw2LFwi7Jyy7Jy07Jy27Jy47Jy57Jy67Jy77Jy+7Jy/7J2B7J2C7J2D7J2FXCIsNCxcIuydi+ydjuydkOydmeydmuydm+ydneydnuydn+ydoVwiLDYsXCLsnansnarsnaxcIiw3LFwi7J227J237J257J267J277J2/7J6A7J6B7J6C7J6G7J6L7J6M7J6N7J6P7J6S7J6T7J6V7J6Z7J6bXCIsNCxcIuyeouyep1wiLDQsXCLsnq7snq/snrHsnrLsnrPsnrXsnrbsnrdcIl0sXG5bXCJhMDQxXCIsXCLsnrjsnrnsnrrsnrvsnr7sn4JcIiw1LFwi7J+K7J+L7J+N7J+P7J+RXCIsNixcIuyfmeyfmuyfm+yfnFwiXSxcbltcImEwNjFcIixcIuyfnlwiLDUsXCLsn6Xsn6bsn6fsn6nsn6rsn6vsn61cIiwxM10sXG5bXCJhMDgxXCIsXCLsn7tcIiw0LFwi7KCC7KCD7KCF7KCG7KCH7KCJ7KCLXCIsNCxcIuygkuyglOygl1wiLDQsXCLsoJ7soJ/soKHsoKLsoKPsoKVcIiw2LFwi7KCu7KCw7KCyXCIsNSxcIuygueyguuygu+ygveygvuygv+yhgVwiLDYsXCLsoYrsoYvsoY5cIiw1LFwi7KGVXCIsMjYsXCLsobLsobPsobXsobbsobfsobnsobtcIiw0LFwi7KKC7KKE7KKI7KKJ7KKK7KKOXCIsNSxcIuyilVwiLDcsXCLsop7soqDsoqLsoqPsoqRcIl0sXG5bXCJhMTQxXCIsXCLsoqXsoqbsoqfsoqlcIiwxOCxcIuyivuyiv+yjgOyjgVwiXSxcbltcImExNjFcIixcIuyjguyjg+yjheyjhuyjh+yjieyjiuyji+yjjVwiLDYsXCLso5bso5jso5pcIiw1LFwi7KOi7KOj7KOlXCJdLFxuW1wiYTE4MVwiLFwi7KOmXCIsMTQsXCLso7ZcIiw1LFwi7KO+7KO/7KSB7KSC7KSD7KSHXCIsNCxcIuykjuOAgOOAgeOAgsK34oCl4oCmwqjjgIPCreKAleKIpe+8vOKIvOKAmOKAmeKAnOKAneOAlOOAleOAiFwiLDksXCLCscOXw7fiiaDiiaTiiaXiiJ7iiLTCsOKAsuKAs+KEg+KEq++/oO+/oe+/peKZguKZgOKIoOKKpeKMkuKIguKIh+KJoeKJksKn4oC74piG4piF4peL4peP4peO4peH4peG4pah4pag4paz4pay4pa94pa84oaS4oaQ4oaR4oaT4oaU44CT4omq4omr4oia4oi94oid4oi14oir4ois4oiI4oiL4oqG4oqH4oqC4oqD4oiq4oip4oin4oio77+iXCJdLFxuW1wiYTI0MVwiLFwi7KSQ7KSSXCIsNSxcIuykmVwiLDE4XSxcbltcImEyNjFcIixcIuykrVwiLDYsXCLspLVcIiwxOF0sXG5bXCJhMjgxXCIsXCLspYhcIiw3LFwi7KWS7KWT7KWV7KWW7KWX7KWZXCIsNixcIuylouylpFwiLDcsXCLspa3spa7spa/ih5Lih5TiiIDiiIPCtO+9nsuHy5jLncuay5nCuMubwqHCv8uQ4oiu4oiR4oiPwqTihInigLDil4Hil4DilrfilrbimaTimaDimaHimaXimafimaPiipnil4jilqPil5Dil5HilpLilqTilqXilqjilqfilqbilqnimajimI/imI7imJzimJ7CtuKAoOKAoeKGleKGl+KGmeKGluKGmOKZreKZqeKZquKZrOOJv+OInOKEluOPh+KEouOPguOPmOKEoeKCrMKuXCJdLFxuW1wiYTM0MVwiLFwi7KWx7KWy7KWz7KW1XCIsNixcIuylvVwiLDEwLFwi7KaK7KaL7KaN7KaO7KaPXCJdLFxuW1wiYTM2MVwiLFwi7KaRXCIsNixcIuymmuymnOymnlwiLDE2XSxcbltcImEzODFcIixcIuymr1wiLDE2LFwi7KeC7KeD7KeF7KeG7KeJ7KeLXCIsNCxcIuynkuynlOynl+ynmOynm++8gVwiLDU4LFwi77+m77y9XCIsMzIsXCLvv6NcIl0sXG5bXCJhNDQxXCIsXCLsp57sp5/sp6Hsp6Psp6Xsp6bsp6jsp6nsp6rsp6vsp67sp7JcIiw1LFwi7Ke67Ke77Ke97Ke+7Ke/7KiB7KiC7KiD7KiEXCJdLFxuW1wiYTQ2MVwiLFwi7KiF7KiG7KiH7KiK7KiOXCIsNSxcIuyoleyoluyol+yomVwiLDEyXSxcbltcImE0ODFcIixcIuyopuyop+yoqOyoqlwiLDI4LFwi44SxXCIsOTNdLFxuW1wiYTU0MVwiLFwi7KmHXCIsNCxcIuypjuypj+ypkeypkuypk+yplVwiLDYsXCLsqZ7sqaJcIiw1LFwi7Kmp7KmqXCJdLFxuW1wiYTU2MVwiLFwi7KmrXCIsMTcsXCLsqb5cIiw1LFwi7KqF7KqGXCJdLFxuW1wiYTU4MVwiLFwi7KqHXCIsMTYsXCLsqplcIiwxNCxcIuKFsFwiLDldLFxuW1wiYTViMFwiLFwi4oWgXCIsOV0sXG5bXCJhNWMxXCIsXCLOkVwiLDE2LFwizqNcIiw2XSxcbltcImE1ZTFcIixcIs6xXCIsMTYsXCLPg1wiLDZdLFxuW1wiYTY0MVwiLFwi7KqoXCIsMTksXCLsqr7sqr/sq4Hsq4Lsq4Psq4VcIl0sXG5bXCJhNjYxXCIsXCLsq4ZcIiw1LFwi7KuO7KuQ7KuS7KuU7KuV7KuW7KuX7KuaXCIsNSxcIuyroVwiLDZdLFxuW1wiYTY4MVwiLFwi7Kuo7Kup7Kuq7Kur7KutXCIsNixcIuyrtVwiLDE4LFwi7KyJ7KyK4pSA4pSC4pSM4pSQ4pSY4pSU4pSc4pSs4pSk4pS04pS84pSB4pSD4pSP4pST4pSb4pSX4pSj4pSz4pSr4pS74pWL4pSg4pSv4pSo4pS34pS/4pSd4pSw4pSl4pS44pWC4pSS4pSR4pSa4pSZ4pSW4pSV4pSO4pSN4pSe4pSf4pSh4pSi4pSm4pSn4pSp4pSq4pSt4pSu4pSx4pSy4pS14pS24pS54pS64pS94pS+4pWA4pWB4pWDXCIsN10sXG5bXCJhNzQxXCIsXCLsrItcIiw0LFwi7KyR7KyS7KyT7KyV7KyW7KyX7KyZXCIsNixcIuysolwiLDddLFxuW1wiYTc2MVwiLFwi7KyqXCIsMjIsXCLsrYLsrYPsrYRcIl0sXG5bXCJhNzgxXCIsXCLsrYXsrYbsrYfsrYrsrYvsrY3srY7srY/srZFcIiw2LFwi7K2a7K2b7K2c7K2eXCIsNSxcIuytpVwiLDcsXCLjjpXjjpbjjpfihJPjjpjjj4TjjqPjjqTjjqXjjqbjjplcIiw5LFwi44+K446N446O446P44+P446I446J44+I446n446o446wXCIsOSxcIuOOgFwiLDQsXCLjjrpcIiw1LFwi446QXCIsNCxcIuKEpuOPgOOPgeOOiuOOi+OOjOOPluOPheOOreOOruOOr+OPm+OOqeOOquOOq+OOrOOPneOPkOOPk+OPg+OPieOPnOOPhlwiXSxcbltcImE4NDFcIixcIuytrVwiLDEwLFwi7K26XCIsMTRdLFxuW1wiYTg2MVwiLFwi7K6JXCIsMTgsXCLsrp1cIiw2XSxcbltcImE4ODFcIixcIuyupFwiLDE5LFwi7K65XCIsMTEsXCLDhsOQwqrEplwiXSxcbltcImE4YTZcIixcIsSyXCJdLFxuW1wiYThhOFwiLFwixL/FgcOYxZLCusOexabFilwiXSxcbltcImE4YjFcIixcIuOJoFwiLDI3LFwi4pOQXCIsMjUsXCLikaBcIiwxNCxcIsK94oWT4oWUwrzCvuKFm+KFnOKFneKFnlwiXSxcbltcImE5NDFcIixcIuyvhVwiLDE0LFwi7K+VXCIsMTBdLFxuW1wiYTk2MVwiLFwi7K+g7K+h7K+i7K+j7K+l7K+m7K+o7K+qXCIsMThdLFxuW1wiYTk4MVwiLFwi7K+9XCIsMTQsXCLssI7ssI/ssJHssJLssJPssJVcIiw2LFwi7LCe7LCf7LCg7LCj7LCkw6bEkcOwxKfEscSzxLjFgMWCw7jFk8Ofw77Fp8WLxYnjiIBcIiwyNyxcIuKSnFwiLDI1LFwi4pG0XCIsMTQsXCLCucKywrPigbTigb/igoHigoLigoPigoRcIl0sXG5bXCJhYTQxXCIsXCLssKXssKbssKrssKvssK3ssK/ssLFcIiw2LFwi7LC67LC/XCIsNCxcIuyxhuyxh+yxieyxiuyxi+yxjeyxjlwiXSxcbltcImFhNjFcIixcIuyxj1wiLDQsXCLssZbssZpcIiw1LFwi7LGh7LGi7LGj7LGl7LGn7LGpXCIsNixcIuyxseyxslwiXSxcbltcImFhODFcIixcIuyxs+yxtOyxtlwiLDI5LFwi44GBXCIsODJdLFxuW1wiYWI0MVwiLFwi7LKU7LKV7LKW7LKX7LKa7LKb7LKd7LKe7LKf7LKhXCIsNixcIuyyquyyrlwiLDUsXCLssrbssrfssrlcIl0sXG5bXCJhYjYxXCIsXCLssrrssrvssr1cIiw2LFwi7LOG7LOI7LOKXCIsNSxcIuyzkeyzkuyzk+yzlVwiLDVdLFxuW1wiYWI4MVwiLFwi7LObXCIsOCxcIuyzpVwiLDYsXCLss63ss67ss6/ss7FcIiwxMixcIuOCoVwiLDg1XSxcbltcImFjNDFcIixcIuyzvuyzv+y0gOy0glwiLDUsXCLstIrstIvstI3stI7stI/stJFcIiw2LFwi7LSa7LSc7LSe7LSf7LSgXCJdLFxuW1wiYWM2MVwiLFwi7LSh7LSi7LSj7LSl7LSm7LSn7LSp7LSq7LSr7LStXCIsMTEsXCLstLpcIiw0XSxcbltcImFjODFcIixcIuy0v1wiLDI4LFwi7LWd7LWe7LWf0JBcIiw1LFwi0IHQllwiLDI1XSxcbltcImFjZDFcIixcItCwXCIsNSxcItGR0LZcIiwyNV0sXG5bXCJhZDQxXCIsXCLstaHstaLstaPstaVcIiw2LFwi7LWu7LWw7LWyXCIsNSxcIuy1uVwiLDddLFxuW1wiYWQ2MVwiLFwi7LaBXCIsNixcIuy2iVwiLDEwLFwi7LaW7LaX7LaZ7Laa7Lab7Lad7Lae7LafXCJdLFxuW1wiYWQ4MVwiLFwi7Lag7Lah7Lai7Laj7Lam7Lao7LaqXCIsNSxcIuy2sVwiLDE4LFwi7LeFXCJdLFxuW1wiYWU0MVwiLFwi7LeGXCIsNSxcIuy3jey3juy3j+y3kVwiLDE2XSxcbltcImFlNjFcIixcIuy3olwiLDUsXCLst6nst6rst6vst63st67st6/st7FcIiw2LFwi7Le67Le87Le+XCIsNF0sXG5bXCJhZTgxXCIsXCLsuIPsuIXsuIbsuIfsuInsuIrsuIvsuI1cIiw2LFwi7LiV7LiW7LiX7LiY7LiaXCIsNSxcIuy4ouy4o+y4pey4puy4p+y4qey4quy4q1wiXSxcbltcImFmNDFcIixcIuy4rOy4rey4ruy4r+y4suy4tOy4tlwiLDE5XSxcbltcImFmNjFcIixcIuy5ilwiLDEzLFwi7Lma7Lmb7Lmd7Lme7LmiXCIsNSxcIuy5quy5rFwiXSxcbltcImFmODFcIixcIuy5rlwiLDUsXCLsubbsubfsubnsubrsubvsub1cIiw2LFwi7LqG7LqI7LqKXCIsNSxcIuy6kuy6k+y6ley6luy6l+y6mVwiXSxcbltcImIwNDFcIixcIuy6mlwiLDUsXCLsuqLsuqZcIiw1LFwi7LquXCIsMTJdLFxuW1wiYjA2MVwiLFwi7Lq7XCIsNSxcIuy7glwiLDE5XSxcbltcImIwODFcIixcIuy7llwiLDEzLFwi7Lum7Lun7Lup7Luq7LutXCIsNixcIuy7tuy7ulwiLDUsXCLqsIDqsIHqsITqsIfqsIjqsInqsIrqsJBcIiw3LFwi6rCZXCIsNCxcIuqwoOqwpOqwrOqwreqwr+qwsOqwseqwuOqwueqwvOqxgOqxi+qxjeqxlOqxmOqxnOqxsOqxseqxtOqxt+qxuOqxuuqygOqygeqyg+qyhOqyheqyhuqyieqyiuqyi+qyjOqykOqylOqynOqyneqyn+qyoOqyoeqyqOqyqeqyquqyrOqyr+qysOqyuOqyueqyu+qyvOqyveqzgeqzhOqziOqzjOqzleqzl+qzoOqzoeqzpOqzp+qzqOqzquqzrOqzr+qzsOqzseqzs+qzteqztuqzvOqzveq0gOq0hOq0hlwiXSxcbltcImIxNDFcIixcIuy8guy8g+y8hey8huy8h+y8iVwiLDYsXCLsvJLsvJTsvJZcIiw1LFwi7Lyd7Lye7Lyf7Lyh7Lyi7LyjXCJdLFxuW1wiYjE2MVwiLFwi7LylXCIsNixcIuy8ruy8slwiLDUsXCLsvLlcIiwxMV0sXG5bXCJiMTgxXCIsXCLsvYVcIiwxNCxcIuy9luy9l+y9mey9muy9m+y9nVwiLDYsXCLsvabsvajsvarsvavsvazqtIzqtI3qtI/qtJHqtJjqtJzqtKDqtKnqtKzqtK3qtLTqtLXqtLjqtLzqtYTqtYXqtYfqtYnqtZDqtZTqtZjqtaHqtaPqtazqta3qtbDqtbPqtbTqtbXqtbbqtbvqtbzqtb3qtb/qtoHqtoLqtojqtonqtozqtpDqtpzqtp3qtqTqtrfqt4Dqt4Hqt4Tqt4jqt5Dqt5Hqt5Pqt5zqt6Dqt6Tqt7jqt7nqt7zqt7/quIDquIHquIjquInquIvquI3quJTquLDquLHquLTquLfquLjquLrquYDquYHquYPquYXquYbquYrquYzquY3quY7quZDquZTquZbquZzquZ3quZ/quaDquaHquaXquajquanquazqubDqubhcIl0sXG5bXCJiMjQxXCIsXCLsva3sva7sva/svbLsvbPsvbXsvbbsvbfsvblcIiw2LFwi7L6B7L6C7L6D7L6E7L6GXCIsNSxcIuy+jVwiXSxcbltcImIyNjFcIixcIuy+jlwiLDE4LFwi7L6iXCIsNSxcIuy+qVwiXSxcbltcImIyODFcIixcIuy+qlwiLDUsXCLsvrFcIiwxOCxcIuy/hVwiLDYsXCLqubnqubvqubzqub3quoTquoXquozqurzqur3qur7qu4Dqu4Tqu4zqu43qu4/qu5Dqu5Hqu5jqu5nqu5zqu6jqu6vqu63qu7Tqu7jqu7zqvIfqvIjqvI3qvJDqvKzqvK3qvLDqvLLqvLTqvLzqvL3qvL/qvYHqvYLqvYPqvYjqvYnqvZDqvZzqvZ3qvaTqvaXqvbnqvoDqvoTqvojqvpDqvpHqvpXqvpzqvrjqvrnqvrzqv4Dqv4fqv4jqv4nqv4vqv43qv47qv5Tqv5zqv6jqv6nqv7Dqv7Hqv7Tqv7jrgIDrgIHrgITrgIzrgJDrgJTrgJzrgJ3rgKjrgYTrgYXrgYjrgYrrgYzrgY7rgZPrgZTrgZXrgZfrgZlcIl0sXG5bXCJiMzQxXCIsXCLsv4xcIiwxOSxcIuy/ouy/o+y/pey/puy/p+y/qVwiXSxcbltcImIzNjFcIixcIuy/qlwiLDUsXCLsv7Lsv7Tsv7ZcIiw1LFwi7L+97L++7L+/7YCB7YCC7YCD7YCFXCIsNV0sXG5bXCJiMzgxXCIsXCLtgItcIiw1LFwi7YCSXCIsNSxcIu2AmVwiLDE5LFwi64Gd64G864G964KA64KE64KM64KN64KP64KR64KY64KZ64Ka64Kc64Kf64Kg64Kh64Ki64Ko64Kp64KrXCIsNCxcIuuCseuCs+uCtOuCteuCuOuCvOuDhOuDheuDh+uDiOuDieuDkOuDkeuDlOuDmOuDoOuDpeuEiOuEieuEi+uEjOuEkOuEkuuEk+uEmOuEmeuEm+uEnOuEneuEo+uEpOuEpeuEqOuErOuEtOuEteuEt+uEuOuEueuFgOuFgeuFhOuFiOuFkOuFkeuFlOuFleuFmOuFnOuFoOuFuOuFueuFvOuGgOuGguuGiOuGieuGi+uGjeuGkuuGk+uGlOuGmOuGnOuGqOuHjOuHkOuHlOuHnOuHnVwiXSxcbltcImI0NDFcIixcIu2ArlwiLDUsXCLtgLbtgLftgLntgLrtgLvtgL1cIiw2LFwi7YGG7YGI7YGKXCIsNV0sXG5bXCJiNDYxXCIsXCLtgZHtgZLtgZPtgZXtgZbtgZftgZlcIiw2LFwi7YGhXCIsMTAsXCLtga7tga9cIl0sXG5bXCJiNDgxXCIsXCLtgbHtgbLtgbPtgbVcIiw2LFwi7YG+7YG/7YKA7YKCXCIsMTgsXCLrh5/rh6jrh6nrh6zrh7Drh7nrh7vrh73riITriIXriIjriIvriIzriJTriJXriJfriJnriKDriLTriLzriZjriZzriaDriajrianribTribXribzrioTrioXrionripDripHripTripjripnriprriqDriqHriqPriqXriqbriqrriqzrirDrirTri4jri4nri4zri5Dri5Lri5jri5nri5vri53ri6Lri6Tri6Xri6bri6jri6tcIiw0LFwi64uz64u064u164u3XCIsNCxcIuuLv+uMgOuMgeuMhOuMiOuMkOuMkeuMk+uMlOuMleuMnOuNlOuNleuNluuNmOuNm+uNnOuNnuuNn+uNpOuNpVwiXSxcbltcImI1NDFcIixcIu2ClVwiLDE0LFwi7YKm7YKn7YKp7YKq7YKr7YKtXCIsNV0sXG5bXCJiNTYxXCIsXCLtgrPtgrbtgrjtgrpcIiw1LFwi7YOC7YOD7YOF7YOG7YOH7YOKXCIsNSxcIu2Dku2DllwiLDRdLFxuW1wiYjU4MVwiLFwi7YOb7YOe7YOf7YOh7YOi7YOj7YOlXCIsNixcIu2Dru2DslwiLDUsXCLtg7lcIiwxMSxcIuuNp+uNqeuNq+uNruuNsOuNseuNtOuNuOuOgOuOgeuOg+uOhOuOheuOjOuOkOuOlOuOoOuOoeuOqOuOrOuPhOuPheuPiOuPi+uPjOuPjuuPkOuPlOuPleuPl+uPmeuPm+uPneuPoOuPpOuPqOuPvOuQkOuQmOuQnOuQoOuQqOuQqeuQq+uQtOuRkOuRkeuRlOuRmOuRoOuRoeuRo+uRpeuRrOuSgOuSiOuSneuSpOuSqOuSrOuSteuSt+uSueuTgOuThOuTiOuTkOuTleuTnOuTneuToOuTo+uTpOuTpuuTrOuTreuTr+uTseuTuOuUlOuUleuUmOuUm+uUnOuUpOuUpeuUp+uUqOuUqeuUquuUsOuUseuUtOuUuFwiXSxcbltcImI2NDFcIixcIu2EhVwiLDcsXCLthI5cIiwxN10sXG5bXCJiNjYxXCIsXCLthKBcIiwxNSxcIu2Esu2Es+2Ete2Etu2Et+2Eue2Eu+2EvO2Eve2EvlwiXSxcbltcImI2ODFcIixcIu2Ev+2Fgu2FhlwiLDUsXCLthY7thY/thZHthZLthZPthZVcIiw2LFwi7YWe7YWg7YWiXCIsNSxcIu2Fqe2Fqu2Fq+2FreuVgOuVgeuVg+uVhOuVheuVi+uVjOuVjeuVkOuVlOuVnOuVneuVn+uVoOuVoeuWoOuWoeuWpOuWqOuWquuWq+uWsOuWseuWs+uWtOuWteuWu+uWvOuWveuXgOuXhOuXjOuXjeuXj+uXkOuXkeuXmOuXrOuYkOuYkeuYlOuYmOuYpeuYrOuYtOuZiOuZpOuZqOuanOuaneuaoOuapOuaq+uarOuaseublOubsOubtOubuOucgOucgeucheucqOucqeucrOucr+ucsOucuOucueucu+udhOudiOudjOudlOudleudoOudpOudqOudsOudseuds+udteudvOudveuegOuehOuejOuejeuej+uekOuekeuekuueluuel1wiXSxcbltcImI3NDFcIixcIu2FrlwiLDEzLFwi7YW9XCIsNixcIu2Ghe2Ghu2Gh+2Gie2GilwiXSxcbltcImI3NjFcIixcIu2Gi1wiLDIwLFwi7Yai7Yaj7Yal7Yam7YanXCJdLFxuW1wiYjc4MVwiLFwi7YapXCIsNixcIu2Gsu2GtO2Gtu2Gt+2GuO2Gue2Gu+2Gve2Gvu2Gv+2HgVwiLDE0LFwi656Y656Z656c656g656o656p656r656s656t65606561656465+H65+J65+s65+t65+w65+065+865+965+/66CA66CB66CH66CI66CJ66CM66CQ66CY66CZ66Cb66Cd66Ck66Cl66Co66Cs66C066C166C366C466C566GA66GE66GR66GT66Gc66Gd66Gg66Gk66Gs66Gt66Gv66Gx66G466G866KN66Ko66Kw66K066K466OA66OB66OD66OF66OM66OQ66OU66Od66Of66Oh66Oo66Op66Os66Ow66O466O566O766O966SE66SY66Sg66S866S966WA66WE66WM66WP66WR66WY66WZ66Wc66Wg66Wo66WpXCJdLFxuW1wiYjg0MVwiLFwi7YeQXCIsNyxcIu2HmVwiLDE3XSxcbltcImI4NjFcIixcIu2Hq1wiLDgsXCLth7Xth7bth7fth7lcIiwxM10sXG5bXCJiODgxXCIsXCLtiIjtiIpcIiw1LFwi7YiRXCIsMjQsXCLrpavrpa3rpbTrpbXrpbjrpbzrpoTrpoXrpofrponrporrpo3rpo7rpqzrpq3rprDrprTrprzrpr3rpr/rp4Hrp4jrp4nrp4zrp45cIiw0LFwi66eY66eZ66eb66ed66ee66eh66ej66ek66el66eo66es66e066e166e366e466e566e666iA66iB66iI66iV66i466i566i866mA66mC66mI66mJ66mL66mN66mO66mT66mU66mV66mY66mc66mk66ml66mn66mo66mp66mw66mx66m066m466qD66qE66qF66qH66qM66qo66qp66qr66qs66qw66qy66q466q566q766q966uE66uI66uY66uZ66u8XCJdLFxuW1wiYjk0MVwiLFwi7Yiq7Yir7Yiu7Yiv7Yix7Yiy7Yiz7Yi1XCIsNixcIu2Ivu2JgO2JglwiLDUsXCLtiYntiYrtiYvtiYxcIl0sXG5bXCJiOTYxXCIsXCLtiY1cIiwxNCxcIu2JnVwiLDYsXCLtiaXtiabtiaftiahcIl0sXG5bXCJiOTgxXCIsXCLtialcIiwyMixcIu2Kgu2Kg+2Khe2Khu2Kh+2Kie2Kiu2Ki+2KjOusgOushOusjeusj+uskeusmOusnOusoOusqeusq+ustOusteustuusuOusu+usvOusveusvuuthOutheuth+utieutjeutj+utkOutlOutmOutoeuto+utrOuuiOuujOuukOuupOuuqOuurOuutOuut+uvgOuvhOuviOuvkOuvk+uvuOuvueuvvOuvv+uwgOuwguuwiOuwieuwi+uwjOuwjeuwj+uwkeuwlFwiLDQsXCLrsJtcIiw0LFwi67Ck67Cl67Cn67Cp67Ct67Cw67Cx67C067C467GA67GB67GD67GE67GF67GJ67GM67GN67GQ67Gd67KE67KF67KI67KL67KM67KO67KU67KV67KXXCJdLFxuW1wiYmE0MVwiLFwi7YqN7YqO7YqP7YqS7YqT7YqU7YqWXCIsNSxcIu2Kne2Knu2Kn+2Koe2Kou2Ko+2KpVwiLDYsXCLtiq1cIl0sXG5bXCJiYTYxXCIsXCLtiq7tiq/tirDtirJcIiw1LFwi7Yq67Yq77Yq97Yq+7YuB7YuDXCIsNCxcIu2Liu2LjFwiLDVdLFxuW1wiYmE4MVwiLFwi7YuS7YuT7YuV7YuW7YuX7YuZ7Yua7Yub7YudXCIsNixcIu2LplwiLDksXCLti7Lti7Pti7Xti7bti7fti7nti7rrspnrsprrsqDrsqHrsqTrsqfrsqjrsrDrsrHrsrPrsrTrsrXrsrzrsr3rs4Drs4Trs43rs4/rs5Drs5Hrs5Xrs5jrs5zrs7Trs7Xrs7brs7jrs7zrtITrtIXrtIfrtInrtJDrtJTrtKTrtKzrtYDrtYjrtYnrtYzrtZDrtZjrtZnrtaTrtajrtoDrtoHrtoTrtofrtojrtonrtorrtpDrtpHrtpPrtpXrtpnrtprrtpzrtqTrtrDrtrjrt5Trt5Xrt5jrt5zrt6nrt7Drt7Trt7jruIDruIPruIXruIzruI3ruJDruJTruJzruJ3ruJ/ruYTruYXruYjruYzruY7ruZTruZXruZfruZnruZrruZvruaDruaHruaRcIl0sXG5bXCJiYjQxXCIsXCLti7tcIiw0LFwi7YyC7YyE7YyGXCIsNSxcIu2Mj+2Mke2Mku2Mk+2Mle2Ml1wiLDQsXCLtjJ7tjKLtjKNcIl0sXG5bXCJiYjYxXCIsXCLtjKTtjKbtjKftjKrtjKvtjK3tjK7tjK/tjLFcIiw2LFwi7Yy67Yy+XCIsNSxcIu2Nhu2Nh+2NiO2NiVwiXSxcbltcImJiODFcIixcIu2NilwiLDMxLFwi67mo67mq67mw67mx67mz67m067m167m767m867m967qA67qE67qM67qN67qP67qQ67qR67qY67qZ67qo67uQ67uR67uU67uX67uY67ug67uj67uk67ul67us67yB67yI67yJ67yY67yZ67yb67yc67yd672A672B672E672I672Q672R672V676U676w67+F67+M67+N67+Q67+U67+c67+f67+h7IC87IGR7IGY7IGc7IGg7IGo7IGp7IKQ7IKR7IKU7IKY7IKg7IKh7IKj7IKl7IKs7IKt7IKv7IKw7IKz7IK07IK17IK27IK87IK97IK/7IOA7IOB7IOF7IOI7IOJ7IOM7IOQ7IOY7IOZ7IOb7IOc7IOd7IOkXCJdLFxuW1wiYmM0MVwiLFwi7Y2qXCIsMTcsXCLtjb7tjb/tjoHtjoLtjoPtjoXtjobtjodcIl0sXG5bXCJiYzYxXCIsXCLtjojtjontjortjovtjo7tjpJcIiw1LFwi7Y6a7Y6b7Y6d7Y6e7Y6f7Y6hXCIsNixcIu2Oqu2OrO2OrlwiXSxcbltcImJjODFcIixcIu2Or1wiLDQsXCLtjrXtjrbtjrftjrntjrrtjrvtjr1cIiw2LFwi7Y+G7Y+H7Y+KXCIsNSxcIu2PkVwiLDUsXCLsg6Xsg6jsg6zsg7Tsg7Xsg7fsg7nshIDshITshIjshJDshJXshJxcIiw0LFwi7ISj7ISk7ISm7ISn7ISs7ISt7ISv7ISw7ISx7IS27IS47IS57IS87IWA7IWI7IWJ7IWL7IWM7IWN7IWU7IWV7IWY7IWc7IWk7IWl7IWn7IWo7IWp7IWw7IW07IW47IaF7IaM7IaN7IaO7IaQ7IaU7IaW7Iac7Iad7Iaf7Iah7Ial7Iao7Iap7Ias7Iaw7Ia97IeE7IeI7IeM7IeU7IeX7IeY7Ieg7Iek7Ieo7Iew7Iex7Iez7Ie87Ie97IiA7IiE7IiM7IiN7IiP7IiR7IiY7IiZ7Iic7Iif7Iig7Iio7Iip7Iir7IitXCJdLFxuW1wiYmQ0MVwiLFwi7Y+X7Y+ZXCIsNyxcIu2Pou2PpFwiLDcsXCLtj67tj6/tj7Htj7Ltj7Ptj7Xtj7btj7dcIl0sXG5bXCJiZDYxXCIsXCLtj7jtj7ntj7rtj7vtj77tkIDtkIJcIiw1LFwi7ZCJXCIsMTNdLFxuW1wiYmQ4MVwiLFwi7ZCXXCIsNSxcIu2QnlwiLDI1LFwi7Iiv7Iix7Iiy7Ii07ImI7ImQ7ImR7ImU7ImY7Img7Iml7Ims7Imt7Imw7Im07Im87Im97Im/7IqB7IqI7IqJ7IqQ7IqY7Iqb7Iqd7Iqk7Iql7Iqo7Iqs7Iqt7Iq07Iq17Iq37Iq57Iuc7Iud7Iug7Iuj7Iuk7Iur7Ius7Iut7Iuv7Iux7Iu27Iu47Iu57Iu77Iu87IyA7IyI7IyJ7IyM7IyN7IyT7IyU7IyV7IyY7Iyc7Iyk7Iyl7Iyo7Iyp7I2F7I2o7I2p7I2s7I2w7I2y7I247I257I287I297I6E7I6I7I6M7I+A7I+Y7I+Z7I+c7I+f7I+g7I+i7I+o7I+p7I+t7I+07I+17I+47JCI7JCQ7JCk7JCs7JCwXCJdLFxuW1wiYmU0MVwiLFwi7ZC4XCIsNyxcIu2Rge2Rgu2Rg+2RhVwiLDE0XSxcbltcImJlNjFcIixcIu2RlFwiLDcsXCLtkZ3tkZ7tkZ/tkaHtkaLtkaPtkaVcIiw3LFwi7ZGu7ZGw7ZGx7ZGyXCJdLFxuW1wiYmU4MVwiLFwi7ZGzXCIsNCxcIu2Ruu2Ru+2Rve2Rvu2Sge2Sg1wiLDQsXCLtkortkoztko5cIiw1LFwi7ZKVXCIsOCxcIuyQtOyQvOyQveyRiOyRpOyRpeyRqOyRrOyRtOyRteyRueySgOySlOySnOySuOySvOyTqeyTsOyTseyTtOyTuOyTuuyTv+yUgOyUgeyUjOyUkOyUlOyUnOyUqOyUqeyUrOyUsOyUuOyUueyUu+yUveyVhOyVheyViOyVieyViuyVjOyVjeyVjuyVk+yVlOyVleyVl+yVmOyVmeyVneyVnuyVoOyVoeyVpOyVqOyVsOyVseyVs+yVtOyVteyVvOyVveyWgOyWhOyWh+yWjOyWjeyWj+yWkeyWleyWl+yWmOyWnOyWoOyWqeyWtOyWteyWuOyWueyWu+yWvOyWveyWvuyXhFwiLDYsXCLsl4zsl45cIl0sXG5bXCJiZjQxXCIsXCLtkp5cIiwxMCxcIu2SqlwiLDE0XSxcbltcImJmNjFcIixcIu2SuVwiLDE4LFwi7ZON7ZOO7ZOP7ZOR7ZOS7ZOT7ZOVXCJdLFxuW1wiYmY4MVwiLFwi7ZOWXCIsNSxcIu2Tne2Tnu2ToFwiLDcsXCLtk6ntk6rtk6vtk63tk67tk6/tk7FcIiw2LFwi7ZO57ZO67ZO87JeQ7JeR7JeU7JeY7Jeg7Jeh7Jej7Jel7Jes7Jet7Jeu7Jew7Je07Je27Je37Je8XCIsNSxcIuyYheyYhuyYh+yYiOyYjOyYkOyYmOyYmeyYm+yYnOyYpOyYpeyYqOyYrOyYreyYruyYsOyYs+yYtOyYteyYt+yYueyYu+yZgOyZgeyZhOyZiOyZkOyZkeyZk+yZlOyZleyZnOyZneyZoOyZrOyZr+yZseyZuOyZueyZvOyagOyaiOyaieyai+yajeyalOyaleyamOyanOyapOyapeyap+yaqeyasOyaseyatOyauOyaueyauuybgOybgeybg+ybheybjOybjeybkOyblOybnOybneyboOyboeybqFwiXSxcbltcImMwNDFcIixcIu2TvlwiLDUsXCLtlIXtlIbtlIftlIntlIrtlIvtlI1cIiw2LFwi7ZSW7ZSYXCIsNV0sXG5bXCJjMDYxXCIsXCLtlJ5cIiwyNV0sXG5bXCJjMDgxXCIsXCLtlLjtlLntlLrtlLvtlL7tlL/tlYHtlYLtlYPtlYVcIiw2LFwi7ZWO7ZWQ7ZWSXCIsNSxcIu2Vmu2Vm+2Vne2Vnu2Vn+2Voe2Vou2Vo+ybqeybrOybsOybuOybueybveychOycheyciOycjOyclOycleycl+ycmeycoOycoeycpOycqOycsOycseycs+ycteyct+ycvOycveydgOydhOydiuydjOydjeydj+ydkVwiLDcsXCLsnZzsnaDsnajsnavsnbTsnbXsnbjsnbzsnb3snb7snoPsnoTsnoXsnofsnojsnonsnorsno7snpDsnpHsnpTsnpbsnpfsnpjsnprsnqDsnqHsnqPsnqTsnqXsnqbsnqzsnq3snrDsnrTsnrzsnr3snr/sn4Dsn4Hsn4jsn4nsn4zsn47sn5Dsn5jsn53sn6Tsn6jsn6zsoIDsoIHsoITsoIjsoIpcIl0sXG5bXCJjMTQxXCIsXCLtlaTtlabtlaftlartlaztla5cIiw1LFwi7ZW27ZW37ZW57ZW67ZW77ZW9XCIsNixcIu2Whu2Wiu2Wi1wiXSxcbltcImMxNjFcIixcIu2WjO2Wje2Wju2Wj+2WkVwiLDE5LFwi7Zam7ZanXCJdLFxuW1wiYzE4MVwiLFwi7ZaoXCIsMzEsXCLsoJDsoJHsoJPsoJXsoJbsoJzsoJ3soKDsoKTsoKzsoK3soK/soLHsoLjsoLzsoYDsoYjsoYnsoYzsoY3soZTsobDsobHsobTsobjsobrsooDsooHsooPsooXsoobsoofsoovsoozsoo3sopTsop3sop/soqHsoqjsorzsor3so4Tso4jso4zso5Tso5Xso5fso5nso6Dso6Hso6Tso7Xso7zso73spIDspITspIXspIbspIzspI3spI/spJHspJjspKzspLTspZDspZHspZTspZjspaDspaHspaPspazspbDspbTspbzspojsponspozsppDsppjsppnsppvspp3sp4Dsp4Hsp4Tsp4fsp4jsp4rsp5Dsp5Hsp5NcIl0sXG5bXCJjMjQxXCIsXCLtl4rtl4vtl43tl47tl4/tl5Htl5NcIiw0LFwi7Zea7Zec7ZeeXCIsNSxcIu2Xpu2Xp+2Xqe2Xqu2Xq+2Xre2XrlwiXSxcbltcImMyNjFcIixcIu2Xr1wiLDQsXCLtl7btl7jtl7pcIiw1LFwi7ZiC7ZiD7ZiF7ZiG7ZiH7ZiJXCIsNixcIu2YklwiXSxcbltcImMyODFcIixcIu2YllwiLDUsXCLtmJ3tmJ7tmJ/tmKHtmKLtmKPtmKVcIiw3LFwi7ZiuXCIsOSxcIu2Yuu2Yu+ynleynluynmeynmuynnOynneynoOynouynpOynp+ynrOynreynr+ynsOynseynuOynueynvOyogOyoiOyoieyoi+yojOyojeyolOyomOyoqeypjOypjeypkOyplOypnOypneypn+ypoOypoeypqOypveyqhOyqmOyqvOyqveyrgOyrhOyrjOyrjeyrj+yrkeyrk+yrmOyrmeyroOyrrOyrtOysiOyskOyslOysmOysoOysoeytgeytiOytieytjOytkOytmOytmeytneytpOytuOytueyunOyuuOyvlOyvpOyvp+yvqeywjOywjeywkOywlOywnOywneywoeywouywp+ywqOywqeywrOywruywsOywuOywueywu1wiXSxcbltcImMzNDFcIixcIu2Yve2Yvu2Yv+2Zge2Zgu2Zg+2ZhO2Zhu2Zh+2Ziu2ZjO2Zju2Zj+2ZkO2Zku2Zk+2Zlu2Zl+2Zme2Zmu2Zm+2ZnVwiLDRdLFxuW1wiYzM2MVwiLFwi7ZmiXCIsNCxcIu2ZqO2ZqlwiLDUsXCLtmbLtmbPtmbVcIiwxMV0sXG5bXCJjMzgxXCIsXCLtmoHtmoLtmoTtmoZcIiw1LFwi7ZqO7ZqP7ZqR7ZqS7ZqT7ZqVXCIsNyxcIu2anu2aoO2aolwiLDUsXCLtmqntmqrssLzssL3ssL7ssYTssYXssYjssYzssZTssZXssZfssZjssZnssaDssaTssabssajssbDssbXsspjsspnsspzssqDssqjssqnssqvssqzssq3ssrTssrXssrjssrzss4Tss4Xss4fss4nss5Dss5Tss6Tss6zss7DstIHstIjstInstIzstJDstJjstJnstJvstJ3stKTstKjstKzstLnstZzstaDstaTstazsta3sta/stbHstbjstojstpTstpXstpjstpzstqTstqXstqfstqnstrDst4Tst4zst5Dst6jst6zst7Dst7jst7nst7vst73suITsuIjsuIzsuJTsuJnsuKDsuKHsuKTsuKjsuLDsuLHsuLPsuLVcIl0sXG5bXCJjNDQxXCIsXCLtmqvtmq3tmq7tmq/tmrFcIiw3LFwi7Zq67Zq8XCIsNyxcIu2bhu2bh+2bie2biu2bi1wiXSxcbltcImM0NjFcIixcIu2bje2bju2bj+2bkO2bku2bk+2ble2blu2bmO2bmlwiLDUsXCLtm6Htm6Ltm6Ptm6Xtm6btm6ftm6lcIiw0XSxcbltcImM0ODFcIixcIu2bru2br+2bse2bsu2bs+2btO2btlwiLDUsXCLtm77tm7/tnIHtnILtnIPtnIVcIiwxMSxcIu2cku2ck+2clOy5mOy5mey5nOy5n+y5oOy5oey5qOy5qey5q+y5rey5tOy5tey5uOy5vOy6hOy6hey6h+y6iey6kOy6key6lOy6mOy6oOy6oey6o+y6pOy6pey6rOy6rey7gey7pOy7pey7qOy7q+y7rOy7tOy7tey7t+y7uOy7uey8gOy8gey8hOy8iOy8kOy8key8k+y8ley8nOy8oOy8pOy8rOy8rey8r+y8sOy8sey8uOy9lOy9ley9mOy9nOy9pOy9pey9p+y9qey9sOy9sey9tOy9uOy+gOy+hey+jOy+oey+qOy+sOy/hOy/oOy/oey/pOy/qOy/sOy/sey/s+y/tey/vO2AgO2AhO2Ake2AmO2Are2AtO2Ate2AuO2AvFwiXSxcbltcImM1NDFcIixcIu2cle2clu2cl+2cmu2cm+2cne2cnu2cn+2coVwiLDYsXCLtnKrtnKztnK5cIiw1LFwi7Zy27Zy37Zy5XCJdLFxuW1wiYzU2MVwiLFwi7Zy67Zy77Zy9XCIsNixcIu2dhe2dhu2diO2dilwiLDUsXCLtnZLtnZPtnZXtnZpcIiw0XSxcbltcImM1ODFcIixcIu2dn+2dou2dpO2dpu2dp+2dqO2dqu2dq+2dre2dru2dr+2dse2dsu2ds+2dtVwiLDYsXCLtnb7tnb/tnoDtnoJcIiw1LFwi7Z6K7Z6L7YGE7YGF7YGH7YGJ7YGQ7YGU7YGY7YGg7YGs7YGt7YGw7YG07YG87YG97YKB7YKk7YKl7YKo7YKs7YK07YK17YK37YK57YOA7YOB7YOE7YOI7YOJ7YOQ7YOR7YOT7YOU7YOV7YOc7YOd7YOg7YOk7YOs7YOt7YOv7YOw7YOx7YO47YSN7YSw7YSx7YS07YS47YS67YWA7YWB7YWD7YWE7YWF7YWM7YWN7YWQ7YWU7YWc7YWd7YWf7YWh7YWo7YWs7YW87YaE7YaI7Yag7Yah7Yak7Yao7Yaw7Yax7Yaz7Ya17Ya67Ya87YeA7YeY7Ye07Ye47YiH7YiJ7YiQ7Yis7Yit7Yiw7Yi07Yi87Yi97Yi/7YmB7YmI7YmcXCJdLFxuW1wiYzY0MVwiLFwi7Z6N7Z6O7Z6P7Z6RXCIsNixcIu2emu2enO2enlwiLDVdLFxuW1wiYzZhMVwiLFwi7Ymk7YqA7YqB7YqE7YqI7YqQ7YqR7YqV7Yqc7Yqg7Yqk7Yqs7Yqx7Yq47Yq57Yq87Yq/7YuA7YuC7YuI7YuJ7YuL7YuU7YuY7Yuc7Yuk7Yul7Yuw7Yux7Yu07Yu47YyA7YyB7YyD7YyF7YyM7YyN7YyO7YyQ7YyU7YyW7Yyc7Yyd7Yyf7Yyg7Yyh7Yyl7Yyo7Yyp7Yys7Yyw7Yy47Yy57Yy77Yy87Yy97Y2E7Y2F7Y287Y297Y6A7Y6E7Y6M7Y6N7Y6P7Y6Q7Y6R7Y6Y7Y6Z7Y6c7Y6g7Y6o7Y6p7Y6r7Y6t7Y607Y647Y687Y+E7Y+F7Y+I7Y+J7Y+Q7Y+Y7Y+h7Y+j7Y+s7Y+t7Y+w7Y+07Y+87Y+97Y+/7ZCBXCJdLFxuW1wiYzdhMVwiLFwi7ZCI7ZCd7ZGA7ZGE7ZGc7ZGg7ZGk7ZGt7ZGv7ZG47ZG57ZG87ZG/7ZKA7ZKC7ZKI7ZKJ7ZKL7ZKN7ZKU7ZKp7ZOM7ZOQ7ZOU7ZOc7ZOf7ZOo7ZOs7ZOw7ZO47ZO77ZO97ZSE7ZSI7ZSM7ZSU7ZSV7ZSX7ZS87ZS97ZWA7ZWE7ZWM7ZWN7ZWP7ZWR7ZWY7ZWZ7ZWc7ZWg7ZWl7ZWo7ZWp7ZWr7ZWt7ZW07ZW17ZW47ZW87ZaE7ZaF7ZaH7ZaI7ZaJ7ZaQ7Zal7ZeI7ZeJ7ZeM7ZeQ7ZeS7ZeY7ZeZ7Zeb7Zed7Zek7Zel7Zeo7Zes7Ze07Ze17Ze37Ze57ZiA7ZiB7ZiE7ZiI7ZiQ7ZiR7ZiT7ZiU7ZiV7Zic7ZigXCJdLFxuW1wiYzhhMVwiLFwi7Zik7Zit7Zi47Zi57Zi87ZmA7ZmF7ZmI7ZmJ7ZmL7ZmN7ZmR7ZmU7ZmV7ZmY7Zmc7Zmn7Zmp7Zmw7Zmx7Zm07ZqD7ZqF7ZqM7ZqN7ZqQ7ZqU7Zqd7Zqf7Zqh7Zqo7Zqs7Zqw7Zq57Zq77ZuE7ZuF7ZuI7ZuM7ZuR7ZuU7ZuX7ZuZ7Zug7Zuk7Zuo7Zuw7Zu17Zu87Zu97ZyA7ZyE7ZyR7ZyY7ZyZ7Zyc7Zyg7Zyo7Zyp7Zyr7Zyt7Zy07Zy17Zy47Zy87Z2E7Z2H7Z2J7Z2Q7Z2R7Z2U7Z2W7Z2X7Z2Y7Z2Z7Z2g7Z2h7Z2j7Z2l7Z2p7Z2s7Z2w7Z207Z287Z297Z6B7Z6I7Z6J7Z6M7Z6Q7Z6Y7Z6Z7Z6b7Z6dXCJdLFxuW1wiY2FhMVwiLFwi5Ly95L2z5YGH5YO55Yqg5Y+v5ZG15ZOl5ZiJ5auB5a625pqH5p625p635p+v5q2M54+C55eC56i86Iub6IyE6KGX6KKI6Ki26LOI6LeP6Lu76L+m6aeV5Yi75Y205ZCE5oGq5oWk5q6854+P6ISa6Ka66KeS6Zaj5L6D5YiK5aK+5aW45aem5bmy5bm55oeH5o+A5p2G5p+s5qG/5r6X55mO55yL56O156iI56u/57Ch6IKd6Imu6Imx6Kur6ZaT5Lmr5Zad5pu35ri056Kj56ut6JGb6KSQ6J2O6Z6o5YuY5Z2O5aCq5bWM5oSf5oa+5oih5pWi5p+R5qmE5rib55SY55az55uj556w57S66YKv6ZGR6ZGS6b6VXCJdLFxuW1wiY2JhMVwiLFwi5Yyj5bKs55Sy6IOb6YmA6ZaY5Ymb5aCI5aec5bKh5bSX5bq35by65b2K5oW35rGf55W655aG57Og57Wz57ax576M6IWU6Iih6JaR6KWB6Kyb6Yu86ZmN6bGH5LuL5Lu35YCL5Yex5aGP5oS35oS+5oWo5pS55qeq5ryR55al55qG55uW566H6Iql6JOL76SA6Y6n6ZaL5ZaA5a6i5Z2R76SB57Kz57656Ya15YCo5Y675bGF5beo5ouS5o2u5pOa5pOn5rig54Ks56Wb6Led6Lie76SC6YG96YmF6Yu45Lm+5Lu25YGl5be+5bu65oSG5qWX6IWx6JmU6LmH6Y216air5Lme5YKR5p2w5qGA5YSJ5YqN5YqS5qqiXCJdLFxuW1wiY2NhMVwiLFwi55686YiQ6buU5Yqr5oCv6L+y5YGI5oap5o+t5pOK5qC85qqE5r+A6IaI6Kah6ZqU5aCF54m954qs55SE57W557mt6IKp6KaL6K206YGj6bWR5oqJ5rG65r2U57WQ57y66Kij5YW85oWK566d6KyZ6YmX6Y6M5Lqs5L+T5YCe5YK+5YSG5YuB5YuN5Y2/5Z2w5aKD5bqa5b6R5oW25oas5pOO5pWs5pmv5pq75pu05qKX5raH54KF54Ox55Kf55Kl55OK55eZ56Gs56Os56uf56u257WF57aT6ICV6IC/6ISb6I6W6K2m6LyV6YCV6Y+h6aCD6aC46ama6a+o5L+C5ZWT5aC65aWR5a2j5bGG5oK45oiS5qGC5qKwXCJdLFxuW1wiY2RhMVwiLFwi5qOo5rqq55WM55m456OO56i957O757mr57m86KiI6Kqh6LC/6ZqO6beE5Y+k5Y+p5ZGK5ZGx5Zu65aeR5a2k5bC75bqr5ou35pS35pWF5pWy5pqg5p6v5qeB5rK955e855qQ552+56i/576U6ICD6IKh6IaP6Ium6Iu96I+w6JeB6KCx6KK06Kql76SD6L6c6Yyu6ZuH6aGn6auY6byT5ZOt5pab5puy5qKP56mA6LC36bWg5Zuw5Z2k5bSR5piG5qKx5qON5ru+55Co6KKe6a+k5rGo76SE6aqo5L6b5YWs5YWx5Yqf5a2U5bel5oGQ5oGt5oux5o6n5pS754+Z56m66Jqj6LKi6Z6P5Liy5a+h5oiI5p6c55OcXCJdLFxuW1wiY2VhMVwiLFwi56eR6I+T6KqH6Kqy6Leo6YGO6Y2L6aGG5buT5qeo6Je/6YOt76SF5Yag5a6Y5a+s5oWj5qO65qy+54GM55Cv55OY566h572Q6I+F6KeA6LKr6Zec6aSo5Yiu5oGd5ous6YCC5L6K5YWJ5Yyh5aOZ5buj5pug5rS454Ka54uC54+W562Q6IOx6ZGb5Y2m5o6b572r5LmW5YKA5aGK5aOe5oCq5oSn5ouQ5qeQ6a2B5a6P57SY6IKx6L2f5Lqk5YOR5ZKs5Zas5ayM5bag5ben5pSq5pWO5qCh5qmL54uh55qO55+v57We57+56Iag6JWO6Juf6LyD6L2O6YOK6aSD6amV6a6r5LiY5LmF5Lmd5LuH5L+x5YW35Yu+XCJdLFxuW1wiY2ZhMVwiLFwi5Y2A5Y+j5Y+l5ZKO5ZiU5Z215Z6i5a+H5baH5buQ5oe85ouY5pWR5p645p+p5qeL5q2Q5q+G5q+s5rGC5rqd54G454uX546W55CD556/55+p56m257W/6ICJ6Ie86IiF6IiK6Iuf6KGi6Kyz6LO86LuA6YCR6YKx6Ymk6Yq26aeS6amF6bOp6beX6b6c5ZyL5bGA6I+K6Z6g6Z6r6bq05ZCb56qY576k6KOZ6LuN6YOh5aCA5bGI5o6Y56qf5a6u5byT56m556qu6IqO6Lqs5YCm5Yi45Yu45Y235ZyI5ouz5o2y5qyK5reD55y35Y6l542X6JWo6Lm26ZeV5py65quD5r2w6Kmt6LuM6aWL76SG5pm35q246LK0XCJdLFxuW1wiZDBhMVwiLFwi6ay876SH5Y+r5Zyt5aWO5o+G5qe754+q56GF56q656uF57O+6JG16KaP6LWz6YC16Zao5Yu75Z2H55WH562g6I+M6Yie76SI5qmY5YWL5YmL5YqH5oif5qOY5qW16ZqZ5YOF5Yqk5Yuk5oeD5pak5qC55qe/55G+562L6Iq56I+r6Kay6Ky56L+R6aWJ76SJ5LuK5aaX5pOS5piR5qqO55C056aB56a96Iqp6KG+6KG/6KWf76SK6Yym5LyL5Y+K5oCl5omx5rGy57Sa57Wm5LqY5YWi55+c6IKv5LyB5LyO5YW25YaA5Zec5Zmo5Zy75Z+65Z+85aSU5aWH5aaT5a+E5bKQ5bSO5bex5bm+5b+M5oqA5peX5pejXCJdLFxuW1wiZDFhMVwiLFwi5pye5pyf5p2e5qOL5qOE5qmf5qy65rCj5rG95rKC5reH546Y55Cm55Cq55KC55Kj55W455W/56KB56Ov56WB56WH56WI56W6566V57SA57a6576I6ICG6ICt6IKM6KiY6K2P6LGI6LW36Yyh6Yyk6aOi6aWR6aiO6aiP6aml6bqS57eK5L225ZCJ5ouu5qGU6YeR5Zar5YS676SL76SM5aic5oem76SN5ouP5ou/76SOXCIsNSxcIumCo++klFwiLDQsXCLoq77vpJnvpJrvpJvvpJzmmpbvpJ3nhZbvpJ7vpJ/pm6PvpKDmjY/mjbrljZfvpKHmno/mpaDmubPvpKLnlLfvpKPvpKTvpKVcIl0sXG5bXCJkMmExXCIsXCLntI3vpKbvpKfoobLlm4rlqJjvpKhcIiw0LFwi5LmD76St5YWn5aWI5p+w6ICQ76Su5aWz5bm05pKa56eK5b+15oGs5ouI5o275a+n5a+X5Yqq76Sv5aW05byp5oCS76Sw76Sx76Sy55GZ76SzXCIsNSxcIumnke+kuVwiLDEwLFwi5r+D76WE76WF6Ia/6L6y5oOx76WG76WH6IWm76WI76WJ5bC/76WKXCIsNyxcIuWrqeiopeadu+e0kO+lklwiLDUsXCLog73vpZjvpZnlsLzms6XljL/murrlpJrojLZcIl0sXG5bXCJkM2ExXCIsXCLkuLnkurbkvYbllq7lnJjlo4flvZbmlrfml6bmqoDmrrXmuY3nn63nq6/nsJ7nt57om4voopLphLLpjZvmkrvmvr7njbrnlrjpgZTllZblnY3mhrrmk5Tmm4fmt6HmuZvmva3mvrnnl7DogYPohr3olYHopoPoq4forZrpjJ/mspPnlZPnrZTouI/pgZ3llJDloILloZjluaLmiIfmkp7mo6Dnlbbns5bonrPpu6jku6Plnojlna7lpKflsI3lsrHluLblvoXmiLTmk6HnjrPoh7rooovosrjpmorpu5vlroXlvrfmgrPlgJLliIDliLDlnJbloLXloZflsI7lsaDls7bltovluqblvpLmgrzmjJHmjonmkJfmoYNcIl0sXG5bXCJkNGExXCIsXCLmo7nmq4Lmt5jmuKHmu5Tmv6Tnh77nm5znnbnnprHnqLvokITopqnos63ot7PouYjpgIPpgJTpgZPpg73pjY3pmbbpn5zmr5LngIbniZjniqLnjajnnaPnpr/nr6TnupvoroDloqnmg4fmlabml73mmr7msoznhJ7nh4nosZrpoJPkua3nqoHku53lhqzlh43li5XlkIzmhqfmnbHmoZDmo5/mtJ7mvbznlrznnrPnq6Xog7TokaPpioXlhZzmlpfmnZzmnpPnl5jnq4fojbPvpZrosYbpgJfpoK3lsa/oh4DoiprpgYHpga/piI3lvpfltp3mqZnnh4jnmbvnrYnol6TorITphKfpqLDllofmh7bvpZvnmannvoVcIl0sXG5bXCJkNWExXCIsXCLomL/onrroo7jpgo/vpZzmtJvng5nnj57ntaHokL3vpZ3pharpp7HvpZ7kuoLljbXmrITmrJLngL7niJvomK3puJ7liYzovqPltZDmk6XmlKzmrJbmv6vnsYPnupzol43opaTopr3mi4noh5jooJ/lu4rmnJfmtarni7znkIXnka/onoLpg57kvobltI3lvqDokIrlhrfmjqDnlaXkuq7lgIblhanlh4nmooHmqJHnsq7nsrHns6foia/oq5LovJvph4/kvrblhLfli7XlkYLlu6zmha7miL7ml4Xmq5rmv77npKrol5zooKPplq3pqaLpqarpupfpu47lipvmm4bmrbfngJ3npKvovaLpnYLmhpDmiIDmlKPmvKNcIl0sXG5bXCJkNmExXCIsXCLnhYnnkonnt7Toga/ok67ovKbpgKPpjYrlhr3liJfliqPmtIzng4joo4Llu4nmloLmrq7mv4LnsL7njbXku6TkvLblm7nvpZ/lsrrltrrmgJznjrLnrK3nvprnv47ogYbpgJ7piLTpm7bpnYjpoJjpvaHkvovmvqfnpq7phrTpmrfli57vpaDmkojmk4Tmq5PmvZ7ngJjniJDnm6fogIHomIbomZzot6/ovIXpnLLpra/pt7rpubXnooznpb/ntqDoj4npjITpub/pupPoq5blo5/lvITmnKfngKfnk4/nsaDogb7lhKHngKjniaLno4ros4Los5ros7Tpm7fkuoblg5rlr67lu5bmlpnnh47nmYLnnq3ogYrok7xcIl0sXG5bXCJkN2ExXCIsXCLpgbzprKfpvo3lo5jlqYHlsaLmqJPmt5rmvI/nmLvntK/nuLfolJ7opLjpj6TpmYvlionml5Lmn7PmprTmtYHmupzngI/nkInnkaDnlZnnmKTnoavorKzpoZ7lha3miK7pmbjkvpblgKvltJnmt6rntrjovKrlvovmhYTmoJfvpaHpmobli5Logovlh5zlh4zmpZ7nqJzntr7oj7HpmbXkv5rliKnljpjlkI/llI7lsaXmgqfmnY7moqjmtaznioHni7jnkIbnkoPvpaLnl6Lnsaznvbnnvrjojonoo4/oo6Hph4zph5Dpm6Lpr4nlkJ3mvb7nh5Dnkpjol7rouqrpmqPpsZfpup/mnpfmt4vnkLPoh6jpnJbnoKxcIl0sXG5bXCJkOGExXCIsXCLnq4vnrKDnspLmkannkarnl7Lnorzno6jppqzprZTpurvlr57luZXmvKDohpzojqvpgojkuIfljY3lqKnlt5LlvY7mhaLmjL3mmanmm7zmu7/mvKvngaPnnp7okKzolJPooLvovJPppYXpsLvllJzmirnmnKvmsqvojInoparpnbrkuqHlpoTlv5jlv5nmnJvntrLnvZToipLojKvojr3ovJ7pgpnln4vlprnlqpLlr5DmmKfmnprmooXmr4/nhaTnvbXosrfos6PpgoHprYXohIjosorpmYzpqYDpuqXlrZ/msJPnjJvnm7Lnm5/okIzlhqroppPlhY3lhpXli4nmo4nmspTnnITnnKDntr/nt6zpnaLpurXmu4VcIl0sXG5bXCJkOWExXCIsXCLolJHlhqXlkI3lkb3mmI7mmp3mpKfmup/nmr/nnpHojJfok4Lonp/phanpipjps7ToooLkvq7lhpLli5/lp4bluL3mhZXmkbjmkbnmmq7mn5DmqKHmr43mr5vniZ/niaHnkYHnnLjnn5vogJfoirzojIXorIDorKjosozmnKjmspDniafnm67nnabnqYbptqnmrb/mspLlpKLmnKbokpnlja/lopPlppnlu5/mj4/mmLTmnbPmuLrnjKvnq5foi5fpjKjli5nlt6vmhq7mh4vmiIrmi4fmkqvml6DmpZnmrabmr4vnhKHnj7fnlZ3nuYboiJ7ojILolaroqqPosr/pnKfptaHloqjpu5jlgJHliI7lkLvllY/mlodcIl0sXG5bXCJkYWExXCIsXCLmsbbntIrntIvogZ7omorploDpm6/li7/mspXnianlkbPlqprlsL7ltYvlvYzlvq7mnKrmorbmpaPmuLzmuYTnnInnsbPnvo7oloforI7ov7fpnaHpu7TlsrfmgrbmhI3mhqvmlY/ml7vml7zmsJHms6/njp/nj4nnt6HplpTlr4bonJzorJDliZ3ljZrmi43mkI/mkrLmnLTmqLjms4rnj4Dnkp7nrpTnspXnuJvohoroiLboloTov6vpm7npp4HkvLTljYrlj43lj5vmi4zmkKzmlIDmlpHmp4Pms67mvZjnj63nlZTnmKLnm6Tnm7zno5Dno7vnpKzntYboiKzon6Dov5TpoJLpo6/li4Pmi5TmkqXmuKTmvZFcIl0sXG5bXCJkYmExXCIsXCLnmbzot4vphrHpiaLpq67prYPlgKPlgo3lnYrlpqjlsKjluYflvbfmiL/mlL7mlrnml4HmmInmnovmppzmu4Lno4XntKHogqrohoDoiKvoirPokqHomozoqKrorJfpgqbpmLLpvpDlgI3kv7PvpaPln7nlvpjmi5zmjpLmna/muYPnhJnnm4Pog4zog5roo7Too7XopJnos6DovKnphY3pmarkvK/kvbDluJvmn4/moKLnmb3nmb7prYTluaHmqIrnhannh5TnlarvpaTnuYHolYPol6npo5zkvJDnrY/nvbDplqXlh6HluIbmorXmsL7msY7ms5vniq/nr4TojIPms5XnkLrlg7vliojlo4Hmk5jmqpfnkqfnmZZcIl0sXG5bXCJkY2ExXCIsXCLnoqfomJfpl6LpnLnvpaXljZ7lvIHororovqjovq/pgorliKXnnqXpsYnpvIjkuJnlgILlhbXlsZvlubfmmJ7mmLrmn4Tmo4XngrPnlIHnl4Xnp4nnq53ovKfppKDpqIjkv53loKHloLHlr7bmma7mraXmtJHmubrmvb3nj6TnlKvoj6noo5zopJPorZzovJTkvI/lg5XljJDljZzlrpPlvqnmnI3npo/ohbnojK/olJTopIfopobovLnovLvppqXpsJLmnKzkubbkv7jlpYnlsIHls6/ls7Dmjafmo5Lng73nhqLnkKvnuKvok6zonILpgKLpi5Lps7PkuI3ku5jkv6/lgoXliZblia/lkKblkpDln6DlpKvlqaZcIl0sXG5bXCJkZGExXCIsXCLlrZrlrbXlr4zlupzvpabmibbmlbfmlqfmta7muqXniLbnrKbnsL/nvLbohZDohZHohproiYDoipnojqnoqIPosqDos6bos7votbTotrrpg6jph5zpmJzpmYTpp5nps6fljJfliIblkKnlmbTlorPlpZTlpa7lv7/mhqTmia7mmJDmsb7nhJrnm4bnsonns57ntJvoiqzos4Hpm7DvpafkvZvlvJflvb/mi4LltKnmnIvmo5rnobznuYPptazkuJXlgpnljJXljKrljZHlpoPlqaLluofmgrLmhormiYnmibnmlpDmnofmpqfmr5Tmr5bmr5fmr5jmsrjvpajnkLXnl7rnoJLnopHnp5Xnp5jnsoPnt4vnv6HogqVcIl0sXG5bXCJkZWExXCIsXCLohL7oh4Loj7LonJroo6joqrnorazosrvphJnpnZ7po5vpvLvlmqzlrKrlvazmlozmqrPmrq/mtZzmv7HngJXniZ3njq3osqfos5PpoLvmhpHmsLfogZjpqIHkuY3kuovkupvku5XkvLrkvLzkvb/kv5/lg7/lj7Llj7jllIbll6Plm5vlo6vlpaLlqJHlr6vlr7rlsITlt7PluKvlvpnmgJ3mjajmlpzmlq/mn7bmn7vmoq3mrbvmspnms5fmuKPngInnjYXnoILnpL7npYDnpaDnp4Hnr6nntJfntbLogoboiI3ojo7ok5Hom4foo5/oqZDoqZ7orJ3os5zotabovq3pgqrpo7zpp5/pup3liYrvpanmnJTvpapcIl0sXG5bXCJkZmExXCIsXCLlgpjliKrlsbHmlaPmsZXnj4rnlKPnlp3nrpfokpzphbjpnLDkubfmkpLmrrrnhZ7olqnkuInvpavmnYnmo67muJfoip/olJjooavmj7fmvoHpiJLpoq/kuIrlgrflg4/lhJ/llYbllqrlmJflrYDlsJnls6DluLjluorluqDlu4Lmg7PmoZHmqaHmuZjniL3niYDni4Dnm7jnpaXnrrHnv5Too7Pop7ToqbPosaHos57pnJzloZ7nkr3os73ll4fvpaznqaHntKLoibLnibLnlJ/nlKXvpa3nrJnlooXlo7vltrzluo/lurblvpDmgZXmipLmjb/mlY3mmpHmm5nmm7jmoJbmo7LnioDnkZ7nra7nta7nt5bnvbJcIl0sXG5bXCJlMGExXCIsXCLog6XoiJLolq/opb/oqpPpgJ3pi6Tpu43pvKDlpJXlpa3luK3mg5zmmJTmmbPmnpDmsZDmt4XmvZ/nn7Pnoqnok4bph4vpjKvku5nlg4rlhYjlloTlrIvlrqPmiYfmlb7ml4vmuLLnhb3nkIHnkYTnkofnkr/nmaznpqrnt5rnuZXnvqjohbrohrPoiLnomJron6zoqbXot6PpgbjpipHpkKXppY3prq7ljajlsZHmpZTms4TmtKnmuKvoiIzolpvopLvoqK3oqqrpm6rpvafliaHmmrnmrrLnupbon77otI3ploPpmZ3mlJ3mtonnh67vpa7ln47lp5PlrqzmgKfmg7rmiJDmmJ/mmZ/njKnnj7nnm5vnnIHnraxcIl0sXG5bXCJlMWExXCIsXCLogZbogbLohaXoqqDphpLkuJbli6LmrbLmtJfnqIXnrLnntLDvpa/osrDlj6zlmK/loZHlrrXlsI/lsJHlt6LmiYDmjoPmkJTmmK3morPmsrzmtojmuq/ngJ/ngqTnh5LnlKbnlo/nlo7nmJnnrJHnr6DnsKvntKDntLnolKzola3omIfoqLTpgI3pgaHpgrXpirfpn7bpqLfkv5flsazmnZ/mtpHnsp/nuozorJbotJbpgJ/lravlt73mkI3ok4DpgZzpo6Hnjoflrovmgprmnb7mt57oqJ/oqqbpgIHpoIzliLfvpbDngZHnoo7pjpboobDph5fkv67lj5fll73lm5rlnoLlo73lq4Llrojlsqvls4DluKXmhIFcIl0sXG5bXCJlMmExXCIsXCLmiI3miYvmjojmkJzmlLbmlbjmqLnmrormsLTmtJnmvLHnh6fni6nnjbjnkIfnkrLnmKbnnaHnp4DnqZfnq6rnsrnnto/ntqznuaHnvp7ohKnojLHokpDok5rol6roopboqrDorpDovLjpgYLpgoPphazpipbpirnpmovpmqfpmqjpm5bpnIDpoIjpppbpq5PprJrlj5Tlob7lpJnlrbDlrr/mt5HmvZrnhp/nkKHnkrnogoXoj73lt6HlvoflvqrmgYLml6zmoJLmpa/mqZPmronmtLXmt7Pnj6Pnm77nnqznrY3ntJTohKPoiJzojYDok7TolaPoqaLoq4TphofpjJ7poIbpprTmiIzooZPov7DpiaXltIfltKdcIl0sXG5bXCJlM2ExXCIsXCLltannkZ/ohp3onajmv5Xmi77nv5LopLbopbLkuJ7kuZjlg6fli53ljYfmib/mmIfnuanooIXpmZ7kvo3ljJnlmLblp4vlqqTlsLjlsY7lsY3luILlvJHmgYPmlr3mmK/mmYLmnr7mn7TnjJznn6LnpLrnv4XokpTok43oppboqaboqanoq6HosZXosbrln7Tlr5TlvI/mga/mi63mpI3mrpbmuZznhoTnr5LonZXorZjou77po5/po77kvLjkvoHkv6HlkbvlqKDlrrjmhLzmlrDmmajnh7znlLPnpZ7ntLPohY7oh6Pojpjolqrol47onIPoqIrouqvovpvvpbHov4XlpLHlrqTlr6bmgonlr6nlsIvlv4PmsoFcIl0sXG5bXCJlNGExXCIsXCLvpbLmt7HngIvnlJroiq/oq7bku4DljYHvpbPpm5nmsI/kup7kv4TlhZLllZ7lqKXls6jmiJHniZnoir3ojqrom77ooZnoqJ3pmL/pm4XppJPptInptZ3loIrlsrPltr3luYTmg6HmhJXmj6HmqILmuKXphILpjZTpoY7psJDpvbflronlsrjmjInmmY/moYjnnLzpm4Hpno3poZTprp/mlqHorIHou4vplrzllLXlsqnlt5blurXmmpfnmYzoj7Tpl4flo5Pmirzni47ptKjku7DlpK7mgI/mmLvmroPnp6fptKbljpPlk4Dln4PltJbmhJvmm5bmtq/noo3oib7pmpjpnYTljoTmibzmjpbmtrLnuIrohYvpoY1cIl0sXG5bXCJlNWExXCIsXCLmq7vnvYzptq/puJrkuZ/lgLvlhrblpJzmg7nmj7bmpLDniLrogLbvpbTph47lvLHvpbXvpbbntIToi6Xoka/okrvol6Xouo3vpbfkva/vpbjvpbnlo6TlrYPmgZnmj5rmlJjmla3mmpjvpbrmpYrmqKPmtIvngIHnhaznl5LnmI3nprPnqbDvpbvnvorvpbzopYTvpb3orpPph4Dpmb3vpb7ppIrlnITlvqHmlrzmvIHnmIDnpqboqp7ppq3prZrpvazlhITmhrbmipHmqo3oh4blgYPloLDlvabnhInoqIDoq7rlrbzomJbkv7rlhLzlmrTlpYTmjqnmt7nltqrmpa3lhobkuojkvZnvpb/vpoDvpoHlpoLvpoJcIl0sXG5bXCJlNmExXCIsXCLvpoPmrZ/msZ3vpoTnkrXnpJbvpoXoiIfoiYXojLnovL/ovZ3vpobppJjvpofvpojvponkuqbvporln5/lvbnmmJPvpovvpoznlqvnubnora/vpo3pgIbpqZvlmqXloKflp7jlqJ/lrrTvpo7lu7bvpo/vppDmjZDmjLvvppHmpL3msofmsr/mto7mtpPmt7XmvJTvppLng5/nhLbnhZnvppPnh4Pnh5XvppTnoY/noa/vppXnrbXnt6PvppbnuK/vppfooY3ou5/vppjvppnvpprpiZvvppvps7bvppzvpp3vpp7mgoXmtoXvpp/nhrHvpqDvpqHplrHljq3vpqLvpqPvpqTmn5PvpqXngo7nhLDnkLDoibboi5JcIl0sXG5bXCJlN2ExXCIsXCLvpqbplrvpq6Xpub3mm4Tvpqfnh4HokYnvpqjvpqnloYvvpqrvpqvltrjlvbHvpqzmmKDmmo7mpbnmpq7msLjms7PmuLbmvYHmv5rngJvngK/nhZDnh5/njbDvpq3nkZvvpq7nk5Tnm4jnqY7nupPvpq/vprDoi7HoqaDov47vprHpjYjvprLpnJnvprPvprTkuYLlgKrvprXliIjlj6Hmm7Pmsa3mv4rnjIrnnb/nqaLoiq7ol53omILvprboo5ToqaPorb3osavvprfpirPvprjpnJPpoJDkupTkvI3kv4nlgrLljYjlkL7lkLPll5rloaLlorrlpaflqJvlr6Tmgp/vprnmh4rmlZbml7/mmaTmoqfmsZrmvrNcIl0sXG5bXCJlOGExXCIsXCLng4/nhqznjZLnrb3onIjoqqTpsLLpvIflsYvmsoPnjYTnjonpiLrmuqvnkaXnmJ/nqannuJXomIrlhYDlo4Xmk4Hnk67nlJXnmbDnv4HpgpXpm43ppZTmuKbnk6bnqqnnqqroh6Xom5nonbjoqJvlqYnlrozlrpvmoqHmpIDmtaPnjqnnkJPnkKznopfnt6nnv6vohJjohZXojp7osYzpmK7poJHmm7DlvoDml7rmnonmsarnjovlgK3lqIPmrarnn67lpJbltazlt43njKXnlY/vprrvprvlg6Xlh7nloK/lpK3lppblp5rlr6Xvprzvpr3ltqLmi5fmkJbmkpPmk77vpr7mm5zvpr/mqYjvp4Dnh7/nkaTvp4FcIl0sXG5bXCJlOWExXCIsXCLnqojnqq/nuYfnuZ7ogIDohbDvp4Lon6/opoHorKDpgZnvp4PpgoDppZLmhb7mrLLmtbTnuJ/opKXovrHkv5Hlgq3lhpfli4fln4floonlrrnlurjmhYLmppXmtozmuafmurbnhpTnkaLnlKjnlKzogbPojLjok4nouIrpjpTpj57vp4Tkuo7kvZHlgbblhKrlj4jlj4vlj7Plroflr5PlsKTmhJrmhoLml7TniZvnjpfnkYDnm4LnpZDnppHnprnntIbnvr3oiovol5XomZ7ov4LpgYfpg7Xph6rpmoXpm6jpm6nli5blvafml63mmLHmoK/nhZznqLbpg4HpoIrkupHvp4XmqZLmrp7mvpDnhonogJjoirjolZNcIl0sXG5bXCJlYWExXCIsXCLpgYvpmpXpm7Lpn7volJrprLHkupDnhorpm4TlhYPljp/lk6HlnJPlnJLlnqPlqpvlq4Tlr4PmgKjmhL/mj7TmsoXmtLnmubLmupDniLDnjL/nkZfoi5HoooHovYXpgaDvp4bpmaLpoZjptJvmnIjotorpiZ7kvY3lgYnlg57ljbHlnI3lp5TlqIHlsInmhbDmmpDmuK3niLLnkYvnt6/og4PokI7okabolL/onZ/ooZvopJjorILpgZXpn4vprY/kubPkvpHlhJLlharvp4fllK/llqnlrbrlrqXlubzlub3lur7mgqDmg5/mhIjmhInmj4TmlLjmnInvp4jmn5Tmn5rvp4nmpaHmpaLmsrnmtKfvp4rmuLjvp4tcIl0sXG5bXCJlYmExXCIsXCLmv6HnjLbnjLfvp4znkZznlLHvp43nmZLvp47vp4/ntq3oh77okLjoo5Xoqpjoq5voq63ouLDouYLpgYrpgL7pgbrphYnph4npja7vp5Dvp5HloInvp5Lmr5PogonogrLvp5Pvp5TlhYHlpavlsLnvp5Xvp5bmvaTnjqfog6TotIfvp5fpiJfplo/vp5jvp5nvp5rvp5vogb/miI7ngJzntajono3vp5zlnqDmganmhYfmrrfoqr7pioDpmrHkuZnlkJ/mt6volK3pmbDpn7Ppo67mj5bms6PpgpHlh53mh4nohrrpt7nkvp3lgJrlhIDlrpzmhI/mh7/mk6zmpIXmr4XnlpHnn6PnvqnoiaTolo/on7vooaPoqrxcIl0sXG5bXCJlY2ExXCIsXCLorbDphqvkuozku6XkvIrvp53vp57lpLflp6jvp5/lt7LlvJvlvZvmgKHvp6Dvp6Hvp6Lvp6PniL7nj6Xvp6TnlbDnl43vp6Xnp7vvp6bogIzogLPogoToi6HojZHvp6fvp6josr3osrPpgofvp6nvp6rpo7TppIzvp6vvp6zngLfnm4rnv4rnv4znv7zorJrkurrku4HliIPljbDvp63lkr3lm6Dlp7vlr4XlvJXlv43mua7vp67vp6/ntarojLXvp7DompPoqo3vp7Hpna3pnbfvp7Lvp7PkuIDkvZrkvb7lo7nml6XmuqLpgLjpjrDpprnku7vlo6zlporlp5nmgYHvp7Tvp7XnqJTvp7bojY/os4PlhaXljYRcIl0sXG5bXCJlZGExXCIsXCLvp7fvp7jvp7nku43lianlrZXoir/ku5TliLrlkqjlp4nlp7/lrZDlrZflrZzmgaPmhYjmu4vngpnnha7njobnk7fnlrXno4HntKvogIXoh6rojKjolJfol4noq67os4fpm4zkvZzli7rlmrzmlqvmmKjngbzngrjniLXntr3oio3phYzpm4DptbLlrbHmo6fmrpjmvbrnm57lspHmmqvmvZvnrrTnsKrooLbpm5zkuIjku5fljKDloLTlorvlo6/lpazlsIfluLPluoTlvLXmjozmmrLmnZbmqJ/mqqPmrIzmvL/niYbvp7rnjZDnkovnq6Dnsqfohbjoh5/oh6fojorokazolKPolpTol4/oo53otJPphqzplbdcIl0sXG5bXCJlZWExXCIsXCLpmpzlho3lk4nlnKjlrrDmiY3mnZDmoL3mopPmuL3mu5Pngb3nuKHoo4HosqHovInpvYvpvY7niK3nro/oq43pjJrkvYfkvY7lhLLlkoDlp5DlupXmirXmnbXmpa7mqJfmsq7muJrni5nnjKrnlr3nrrjntLXoi6foj7nokZfol7foqZvosq/ouofpgJnpgrjpm47pvZ/li6PlkIrlq6Hlr4LmkZjmlbXmu7Tni4Tvp7vnmoTnqY3nrJvnsY3nuL7nv5/ojbvorKvos4rotaTot6HouZ/ov6rov7npganpj5HkvYPkvbrlgrPlhajlhbjliY3liarloaHlobzlpaDlsIjlsZXlu5vmgpvmiLDmoJPmrr/msIjmvrFcIl0sXG5bXCJlZmExXCIsXCLnhY7nkKDnlLDnlLjnlZHnmbLnrYznrovnrq3nr4bnuo/oqa7ovL7ovYnpiL/pipPpjKLpkKvpm7vpoZrpoavppJ7liIfmiKrmipjmtZnnmaTnq4rnr4DntbbljaDlsr7lupfmvLjngrnnspjpnJHpro7pu57mjqXmkbronbbkuIHkupXkuq3lgZzlgbXlkYjlp4PlrprluYDluq3lu7flvoHmg4XmjLrmlL/mlbTml4zmmbbmmbjmn77mpajmqonmraPmsYDmt4Dmt6jmuJ/muZ7ngJ7ngqHnjo7nj73nlLrnnZvnoofnpo7nqIvnqb3nsr7nto7oiYfoqILoq6rosp7phK3phYrph5jpiabpi4zpjKDpnIbpnZZcIl0sXG5bXCJmMGExXCIsXCLpnZzpoILpvI7liLblipHllbzloKTluJ3lvJ/mgozmj5Dmoq/mv5/npa3nrKzoh43olrroo73oq7jouYTpho3pmaTpmpvpnL3poYzpvYrkv47lhYblh4vliqnlmLLlvJTlvavmjqrmk43ml6nmmYHmm7rmm7nmnJ3mop3mo5fmp73mvJXmva7nhafnh6XniKrnkqrnnLrnpZbnpZrnp5/nqKDnqpXnspfns5/ntYTnubDogofol7vomqToqZToqr/otpnouoHpgKDpga3ph6PpmLvpm5Xps6Xml4/nsIfotrPpj4PlrZjlsIrljZLmi5nnjJ3lgKflrpflvp7mgrDmhavmo5Xmt5nnkK7nqK7ntYLntpznuLHohatcIl0sXG5bXCJmMWExXCIsXCLouKrouLXpjb7pkJjkvZDlnZDlt6bluqfmjKvnvarkuLvkvY/kvo/lgZrlp53og4Tlkarlkajll77lpY/lrpnlt57lu5rmmZ3mnLHmn7HmoKrms6jmtLLmuYrmvo3ngrfnj6DnlofnsYzntILntKzntqLoiJ/om5voqLvoqoXotbDouorovLPpgLHphY7phZLpkYTpp5Dnq7nnsqXkv4rlhIHlh4bln4jlr6/ls7vmmZnmqL3mtZrmupbmv6znhIznla/nq6PooKLpgKHpgbXpm4vpp7/ojIHkuK3ku7LooYbph43ljb3mq5vmpavmsYHokbrlop7mho7mm77mi6/ng53nlJHnl4fnuZLokrjorYnotIjkuYvlj6pcIl0sXG5bXCJmMmExXCIsXCLlkqvlnLDlnYDlv5fmjIHmjIfmka/mlK/ml6jmmbrmnp3mnrPmraLmsaDmsprmvKznn6XnoKXnpYnnpZfntJnogqLohILoh7Poip3oirfonJjoqozvp7zotITotr7pgbLnm7TnqJnnqLfnuZTogbfllIfll5TlobXmjK/mkKLmmYnmmYvmoa3mppvmroTmtKXmurHnj43nkajnkqHnlZvnlrnnm6HnnJ7nnovnp6bnuInnuJ3oh7volK/oopfoqLros5Hou6vovrDpgLLpjq3pmaPpmbPpnIfkvoTlj7Hlp6rlq4nluJnmoY7nk4bnlr7np6nnqpLohqPom63os6rot4zov63mlp/mnJXvp73ln7fmvZfnt53ovK9cIl0sXG5bXCJmM2ExXCIsXCLpj7bpm4blvrXmh7LmvoTkuJTkvpjlgJ/lj4nll5/lta/lt67mrKHmraTno4vnrprvp77ouYnou4rpga7mjYnmkL7nnYDnqoTpjK/pkb/pvarmkrDmvq/nh6bnkqjnk5rnq4TnsJLnuoLnsrLnupjorprotIrpkb3ppJDppYzliLnlr5/mk6bmnK3ntK7lg63lj4PlobnmhZjmhZnmh7rmlqznq5norpLorpblgInlgKHlibXllLHlqLzlu6DlvbDmhLTmlZ7mmIzmmLbmmqLmp43mu4TmvLLnjJbnmKHnqpPohLnoiZnoj5bokrzlgrXln7Dlr4Dlr6jlvanmjqHnoKbntrXoj5zolKHph4fph7Xlhormn7XnrZZcIl0sXG5bXCJmNGExXCIsXCLosqzlh4Tlprvmgr3omZXlgJzvp7/liZTlsLrmhb3miJrmi5Pmk7LmlqXmu4znmKDohIrouaDpmZ/pmrvku5/ljYPllpjlpKnlt53mk4Xms4nmt7rnjpTnqb/oiJvolqbos6TouJDpgbfph6fpl6HpmKHpn4blh7jlk7LlloblvrnmkqTmvojntrTovJ/ovY3pkLXlg4nlsJbmsr7mt7vnlJvnnrvnsL3nsaToqbnoq4LloJ7lpr7luJbmjbfniZLnlornnavoq5zosrzovJLlu7PmmbTmt7jogb3oj4Hoq4vpnZHpr5bvqIDliYPmm7/mtpXmu6/nt6Doq6bpgK7pgZ7pq5TliJ3lib/lk6jmhpTmioTmi5vmoqJcIl0sXG5bXCJmNWExXCIsXCLmpJLmpZrmqLXngpLnhKbnoZ3npIHnpI7np5LnqI3ogpboibjoi5XojYnolYnosoLotoXphaLphovphq7kv4Plm5Hnh63nn5fonIDop7jlr7jlv5bmnZHpgqjlj6LloZrlr7XmgqTmhoHmkaDnuL3ogbDolKXpioPmkq7lgqzltJTmnIDlopzmir3mjqjmpI7mpbjmqJ7muavnmrrnp4voirvokKnoq4/otqjov73phJLphYvphpzpjJDpjJjpjprpm5vpqLbpsI3kuJHnlZznpZ3nq7rnrZHnr4nnuK7ok4TouZnoubTou7jpgJDmmKXmpL/nkYPlh7rmnK7pu5zlhYXlv6Dmspbon7LooZ3oobfmgrTohrXokINcIl0sXG5bXCJmNmExXCIsXCLotIXlj5blkLnlmLTlqLblsLHngornv6DogZrohIboh63otqPphonpqZ/pt7LlgbTku4TljqDmg7vmuKzlsaTkvojlgKTll6Tls5nluZ/mgaXmopTmsrvmt4Tnhr7nl5Tnl7TnmaHnqJrnqYnnt4fnt7vnva7oh7TomqnovJzpm4npprPpvZLliYfli4Xpo63opqrkuIPmn5LmvIbkvrXlr6LmnpXmsojmtbjnkJvnoKfph53pjbzon4Tnp6TnqLHlv6vku5blkqTllL7loq7lpqXmg7DmiZPmi5bmnLbmpZXoiLXpmYDpprHpp53lgKzljZPllYTlnbzvqIHmiZjvqILmk6Lmmavmn53mv4Hmv6/nkKLnkLjoqJdcIl0sXG5bXCJmN2ExXCIsXCLpkLjlkZHlmIblnablvYjmhprmrY7ngZjngq3ntrvoqpXlparohKvmjqLnnIjogL3osqrloZTmkK3mprvlrpXluJHmua/vqIPolanlhYzlj7DlpKrmgKDmhYvmrobmsbDms7DnrJ7og47oi5Tot4bpgrDporHvqITmk4fmvqTmkpHmlITlhY7lkJDlnJ/oqI7mhZ/mobbvqIXnl5vnrZLntbHpgJrloIbmp4zohb/opKrpgIDpoLnlgbjlpZflpqzmipXpgI/prKrmhZ3nibnpl5blnaHlqYblt7Tmiormkq3mk7rmnbfms6LmtL7niKznkLbnoLTnvbfoiq3ot5vpoJfliKTlnYLmnb/niYjnk6PosqnovqbpiJFcIl0sXG5bXCJmOGExXCIsXCLpmKrlhavlj63mjYzkvanllITmgpbmlZfmspvmtb/niYzni73nqJfopofosp3lva3mvo7ng7nohqjmhI7kvr/lgY/miYHniYfnr4fnt6jnv6npgY3pnq3pqJnosrblnarlubPmnrDokI3oqZXlkKDlrJbluaPlu6LlvIrmloPogrrolL3plonpmZvkvYjljIXljI3ljI/lkoblk7rlnIPluIPmgJbmipvmirHmjZXvqIbms6HmtabnlrHnoLLog57ohK/oi57okaHokrLooo3opJLpgIvpi6rpo73prpHluYXmmrTmm53ngJHniIbvqIfkv7Xlib3lvarmhZPmnZPmqJnmvILnk6Lnpajooajosbnpo4fpo4TpqYNcIl0sXG5bXCJmOWExXCIsXCLlk4HnqJ/mpZPoq7fosYrpoqjppq7lvbzmiqvnlrLnmq7ooqvpgb/pmYLljLnlvLzlv4Xms4znj4znlaLnlovnrYboi77ppp3kuY/pgLzkuIvkvZXljqblpI/lu4jmmLDmsrPnkZXojbfonabos4DpgZDpnJ7psJXlo5HlrbjomZDorJTptrTlr5Lmgajmgo3ml7HmsZfmvKLmvqPngJrnvZXnv7DplpHplpLpmZDpn5PlibLovYTlh73lkKvlkrjllaPllormqrvmtrXnt5joiabpipzpmbfpubnlkIjlk4jnm5Lom6TplqTpl5TpmZzkuqLkvInlp67lq6blt7fmgZLmipfmna3moYHmsobmuK/nvLjogpvoiKpcIl0sXG5bXCJmYWExXCIsXCLvqIjvqInpoIXkuqXlgZXlkrPlnpPlpZrlranlrrPmh4jmpbfmtbfngKPon7nop6PoqbLoq6fpgoLpp63pqrjlir7moLjlgJblubjmnY/ojYfooYzkuqvlkJHlmq7nj6bphJXpn7/ppInppZfpppnlmZPlop/omZvoqLHmhrLmq7bnjbvou5LmrYfpmqrpqZflpZXniIDotavpnankv5Tls7TlvKbmh7jmmZvms6vngqvnjoTnjrnnj77nnKnnnY3ntYPntaLnuKPoiLfooZLvqIros6LpiYnpoa/lrZHnqbTooYDpoIHlq4zkv6DljZTlpL7ls73mjL7mtbnni7nohIXohIfojqLpi4/poLDkuqjlhYTliJHlnotcIl0sXG5bXCJmYmExXCIsXCLlvaLms4Lmu47ngIXngZDngq/nhpLnj6nnkanojYronqLooaHpgIjpgqLpjqPppqjlha7lvZfmg6DmhafmmrPolZnouYrphq/pnovkuY7kupLlkbzlo5Xlo7rlpb3lsrXlvKfmiLbmiYjmmIrmmafmr6vmtanmt4/muZbmu7jmvpTmv6Dmv6nngZ3ni5DnkKXnkZrnk6DnmpPnpZzns4rnuJ7og6Hoiqbokavokr/omY7omZ/onbTorbfosarpjqzpoIDpoaXmg5HmiJbphbflqZrmmI/mt7fmuL7nkL/prYLlv73mg5rnrI/lk4TlvJjmsZ7ms5PmtKrng5jntIXombnoqIzptLvljJblkozlrIXmqLrngavnlbVcIl0sXG5bXCJmY2ExXCIsXCLnpo3npr7oirHoj6/oqbHorYHosqjpnbTvqIvmk7TmlKvnorrnorvnqavkuLjllprlpZDlrqblubvmgqPmj5vmraHmmaXmoZPmuJnnhaXnkrDntIjpgoTpqanpsKXmtLvmu5HnjL7osYHpl4rlh7DluYzlvqjmgY3mg7bmhLDmhYzmmYPmmYTmpqXms4HmuZ/mu4nmvaLnhYznkpznmofnr4HnsKfojZLonZfpgZHpmo3pu4PljK/lm57lu7vlvormgaLmgpTmh7fmmabmnIPmqpzmt67mvq7ngbDnjarnuarohr7ojLTom5Toqqjos4TlioPnjbLlrpbmqavpkITlk67lmoblrZ3mlYjmloXmm4nmop/mto3mt4ZcIl0sXG5bXCJmZGExXCIsXCLniLvogrTphbXpqY3kvq/lgJnljprlkI7lkLzllonll4XluL/lvozmnL3nhabnj53pgIXli5vli7PloaTlo47nhITnho/nh7volrDoqJPmmojolqjllqfmmoTnhYrokLHljYnllpnmr4HlvZnlvr3mj67mmonnhYfoq7HovJ3pur7kvJHmkLrng4vnlabomafmgaTorY7pt7jlhYflh7bljIjmtLbog7jpu5HmmJXmrKPngpjnl5XlkIPlsbnntIfoqJbmrKDmrL3mrYblkLjmgbDmtL3nv5XoiIjlg5blh57llpzlmavlm43lp6zlrInluIzmhpnmhpjmiLHmmZ7mm6bnhpnnhrnnhrrniqfnpqfnqIDnvrLoqbBcIl1cbl1cbiIsIm1vZHVsZS5leHBvcnRzPVtcbltcIjBcIixcIlxcdTAwMDBcIiwxMjddLFxuW1wiYTE0MFwiLFwi44CA77yM44CB44CC77yO4oCn77yb77ya77yf77yB77iw4oCm4oCl77mQ77mR77mSwrfvuZTvuZXvuZbvuZfvvZzigJPvuLHigJTvuLPilbTvuLTvuY/vvIjvvInvuLXvuLbvvZvvvZ3vuLfvuLjjgJTjgJXvuLnvuLrjgJDjgJHvuLvvuLzjgIrjgIvvuL3vuL7jgIjjgInvuL/vuYDjgIzjgI3vuYHvuYLjgI7jgI/vuYPvuYTvuZnvuZpcIl0sXG5bXCJhMWExXCIsXCLvuZvvuZzvuZ3vuZ7igJjigJnigJzigJ3jgJ3jgJ7igLXigLLvvIPvvIbvvIrigLvCp+OAg+KXi+KXj+KWs+KWsuKXjuKYhuKYheKXh+KXhuKWoeKWoOKWveKWvOOKo+KEhcKv77+j77y/y43vuYnvuYrvuY3vuY7vuYvvuYzvuZ/vuaDvuaHvvIvvvI3Dl8O3wrHiiJrvvJzvvJ7vvJ3iiabiiafiiaDiiJ7iiZLiiaHvuaJcIiw0LFwi772e4oip4oiq4oql4oig4oif4oq/44+S44+R4oir4oiu4oi14oi04pmA4pmC4oqV4oqZ4oaR4oaT4oaQ4oaS4oaW4oaX4oaZ4oaY4oil4oij77yPXCJdLFxuW1wiYTI0MFwiLFwi77y84oiV77mo77yE77+l44CS77+g77+h77yF77yg4oSD4oSJ77mp77mq77mr44+V446c446d446e44+O446h446O446P44+EwrDlhZnlhZvlhZ7lhZ3lhaHlhaPll6fnk6nns47iloFcIiw3LFwi4paP4paO4paN4paM4paL4paK4paJ4pS84pS04pSs4pSk4pSc4paU4pSA4pSC4paV4pSM4pSQ4pSU4pSY4pWtXCJdLFxuW1wiYTJhMVwiLFwi4pWu4pWw4pWv4pWQ4pWe4pWq4pWh4pei4pej4pel4pek4pWx4pWy4pWz77yQXCIsOSxcIuKFoFwiLDksXCLjgKFcIiw4LFwi5Y2B5Y2E5Y2F77yhXCIsMjUsXCLvvYFcIiwyMV0sXG5bXCJhMzQwXCIsXCLvvZfvvZjvvZnvvZrOkVwiLDE2LFwizqNcIiw2LFwizrFcIiwxNixcIs+DXCIsNixcIuOEhVwiLDEwXSxcbltcImEzYTFcIixcIuOEkFwiLDI1LFwiy5nLicuKy4fLi1wiXSxcbltcImEzZTFcIixcIuKCrFwiXSxcbltcImE0NDBcIixcIuS4gOS5meS4geS4g+S5g+S5neS6huS6jOS6uuWEv+WFpeWFq+WHoOWIgOWIgeWKm+WMleWNgeWNnOWPiOS4ieS4i+S4iOS4iuS4q+S4uOWHoeS5heS5iOS5n+S5nuS6juS6oeWFgOWIg+WLuuWNg+WPieWPo+Wcn+Wjq+WkleWkp+Wls+WtkOWtkeWtk+WvuOWwj+WwouWwuOWxseW3neW3peW3seW3suW3s+W3vuW5suW7vuW8i+W8k+aJjVwiXSxcbltcImE0YTFcIixcIuS4keS4kOS4jeS4reS4sOS4ueS5i+WwueS6iOS6keS6leS6kuS6lOS6ouS7geS7gOS7g+S7huS7h+S7jeS7iuS7i+S7hOWFg+WFgeWFp+WFreWFruWFrOWGl+WHtuWIhuWIh+WIiOWLu+WLvuWLv+WMluWMueWNiOWNh+WNheWNnuWOhOWPi+WPiuWPjeWjrOWkqeWkq+WkquWkreWtlOWwkeWwpOWwuuWxr+W3tOW5u+W7v+W8lOW8leW/g+aIiOaItuaJi+aJjuaUr+aWh+aWl+aWpOaWueaXpeabsOaciOacqOasoOatouatueavi+avlOavm+awj+awtOeBq+eIqueItueIu+eJh+eJmeeJm+eKrOeOi+S4mVwiXSxcbltcImE1NDBcIixcIuS4luS4leS4lOS4mOS4u+S5jeS5j+S5juS7peS7mOS7lOS7leS7luS7l+S7o+S7pOS7meS7nuWFheWFhOWGieWGiuWGrOWHueWHuuWHuOWIiuWKoOWKn+WMheWMhuWMl+WMneS7n+WNiuWNieWNoeWNoOWNr+WNruWOu+WPr+WPpOWPs+WPrOWPruWPqeWPqOWPvOWPuOWPteWPq+WPpuWPquWPsuWPseWPsOWPpeWPreWPu+Wbm+WbmuWkllwiXSxcbltcImE1YTFcIixcIuWkruWkseWltOWltuWtleWug+WwvOW3qOW3p+W3puW4guW4g+W5s+W5vOW8geW8mOW8l+W/heaIiuaJk+aJlOaJkuaJkeaWpeaXpuacruacrOacquacq+acreato+avjeawkeawkOawuOaxgeaxgOawvueKr+eOhOeOieeTnOeTpueUmOeUn+eUqOeUqeeUsOeUseeUsueUs+eWi+eZveearueav+ebruefm+efouefs+ekuuemvueptOeri+S4nuS4n+S5kuS5k+S5qeS6meS6pOS6puS6peS7v+S8ieS8meS8iuS8leS8jeS8kOS8keS8j+S7suS7tuS7u+S7sOS7s+S7veS8geS8i+WFieWFh+WFhuWFiOWFqFwiXSxcbltcImE2NDBcIixcIuWFseWGjeWGsOWIl+WIkeWIkuWIjuWIluWKo+WMiOWMoeWMoOWNsOWNseWQieWQj+WQjOWQiuWQkOWQgeWQi+WQhOWQkeWQjeWQiOWQg+WQjuWQhuWQkuWboOWbnuWbneWcs+WcsOWcqOWcreWcrOWcr+WcqeWkmeWkmuWkt+WkuOWmhOWluOWmg+WlveWlueWmguWmgeWtl+WtmOWuh+WuiOWuheWuieWvuuWwluWxueW3nuW4huW5tuW5tFwiXSxcbltcImE2YTFcIixcIuW8j+W8m+W/meW/luaIjuaIjOaIjeaIkOaJo+aJm+aJmOaUtuaXqeaXqOaXrOaXreabsuabs+acieacveactOacseacteasoeatpOatu+awluaxneaxl+axmeaxn+axoOaxkOaxleaxoeaxm+axjeaxjueBsOeJn+eJneeZvuerueexs+ezuOe8tue+iue+veiAgeiAg+iAjOiAkuiAs+iBv+iCieiCi+iCjOiHo+iHquiHs+iHvOiIjOiIm+iIn+iJruiJsuiJvuiZq+ihgOihjOiho+ilv+mYoeS4suS6qOS9jeS9j+S9h+S9l+S9nuS8tOS9m+S9leS8sOS9kOS9keS8veS8uuS8uOS9g+S9lOS8vOS9huS9o1wiXSxcbltcImE3NDBcIixcIuS9nOS9oOS8r+S9juS8tuS9meS9neS9iOS9muWFjOWFi+WFjeWFteWGtuWGt+WIpeWIpOWIqeWIquWIqOWKq+WKqeWKquWKrOWMo+WNs+WNteWQneWQreWQnuWQvuWQpuWRjuWQp+WRhuWRg+WQs+WRiOWRguWQm+WQqeWRiuWQueWQu+WQuOWQruWQteWQtuWQoOWQvOWRgOWQseWQq+WQn+WQrOWbquWbsOWbpOWbq+WdiuWdkeWdgOWdjVwiXSxcbltcImE3YTFcIixcIuWdh+WdjuWcvuWdkOWdj+Wcu+Wjr+WkvuWmneWmkuWmqOWmnuWmo+WmmeWmluWmjeWmpOWmk+WmiuWmpeWtneWtnOWtmuWtm+WujOWui+Wuj+WwrOWxgOWxgeWwv+WwvuWykOWykeWylOWyjOW3q+W4jOW6j+W6h+W6iuW7t+W8hOW8n+W9pOW9ouW9t+W9ueW/mOW/jOW/l+W/jeW/seW/q+W/uOW/quaIkuaIkeaKhOaKl+aKluaKgOaJtuaKieaJreaKiuaJvOaJvuaJueaJs+aKkuaJr+aKmOaJruaKleaKk+aKkeaKhuaUueaUu+aUuOaXseabtOadn+adjuadj+adkOadkeadnOadluadnuadieadhuadoFwiXSxcbltcImE4NDBcIixcIuadk+adl+atpeavj+axguaxnuaymeaygeayiOayieayheaym+axquaxuuaykOaxsOayjOaxqOayluaykuaxveayg+axsuaxvuaxtOayhuaxtuayjeaylOaymOaygueBtueBvOeBveeBuOeJoueJoeeJoOeLhOeLgueOlueUrOeUq+eUt+eUuOeaguebr+efo+engeengOemv+eptuezu+e9leiCluiCk+iCneiCmOiCm+iCmuiCsuiJr+iKklwiXSxcbltcImE4YTFcIixcIuiKi+iKjeimi+inkuiogOiwt+ixhuixleiynei1pOi1sOi2s+i6q+i7iui+m+i+sOi/gui/hui/hei/hOW3oemCkemCoumCqumCpumCo+mFiemHhumHjOmYsumYrumYsemYqumYrOS4puS5luS5s+S6i+S6m+S6nuS6q+S6rOS9r+S+neS+jeS9s+S9v+S9rOS+m+S+i+S+huS+g+S9sOS9teS+iOS9qeS9u+S+luS9vuS+j+S+keS9uuWFlOWFkuWFleWFqeWFt+WFtuWFuOWGveWHveWIu+WIuOWIt+WIuuWIsOWIruWItuWJgeWKvuWKu+WNkuWNlOWNk+WNkeWNpuWNt+WNuOWNueWPluWPlOWPl+WRs+WRtVwiXSxcbltcImE5NDBcIixcIuWSluWRuOWSleWSgOWRu+WRt+WShOWSkuWShuWRvOWSkOWRseWRtuWSjOWSmuWRouWRqOWSi+WRveWSjuWbuuWeg+Wdt+WdquWdqeWdoeWdpuWdpOWdvOWknOWlieWlh+WliOWlhOWllOWmvuWmu+WnlOWmueWmruWnkeWnhuWnkOWnjeWni+Wnk+WniuWmr+Wms+WnkuWnheWtn+WtpOWto+Wul+WumuWumOWunOWumeWum+WwmuWxiOWxhVwiXSxcbltcImE5YTFcIixcIuWxhuWyt+WyoeWyuOWyqeWyq+WyseWys+W4mOW4muW4luW4leW4m+W4keW5uOW6muW6l+W6nOW6leW6luW7tuW8puW8p+W8qeW+gOW+geW9v+W9vOW/neW/oOW/veW/teW/v+aAj+aAlOaAr+aAteaAluaAquaAleaAoeaAp+aAqeaAq+aAm+aIluaIleaIv+aIvuaJgOaJv+aLieaLjOaLhOaKv+aLguaKueaLkuaLm+aKq+aLk+aLlOaLi+aLiOaKqOaKveaKvOaLkOaLmeaLh+aLjeaKteaLmuaKseaLmOaLluaLl+aLhuaKrOaLjuaUvuaWp+aWvOaXuuaYlOaYk+aYjOaYhuaYguaYjuaYgOaYj+aYleaYilwiXSxcbltcImFhNDBcIixcIuaYh+acjeaci+adreaei+aeleadseaenOads+adt+aeh+aeneael+adr+adsOadv+aeieadvuaekOadteaemuaek+advOadquadsuaso+atpuatp+atv+awk+awm+azo+azqOazs+ayseazjOazpeays+ayveayvuayvOazouayq+azleazk+ayuOazhOayueazgeayruazl+azheazseayv+ayu+azoeazm+aziuayrOazr+aznOazluazoFwiXSxcbltcImFhYTFcIixcIueCleeCjueCkueCiueCmeeIrOeIreeIuOeJiOeJp+eJqeeLgOeLjueLmeeLl+eLkOeOqeeOqOeOn+eOq+eOpeeUveeWneeWmeeWmueahOebguebsuebtOefpeefveekvuelgOelgeenieeniOepuuepueeruuezvue9lOe+jOe+i+iAheiCuuiCpeiCouiCseiCoeiCq+iCqeiCtOiCquiCr+iHpeiHvuiIjeiKs+iKneiKmeiKreiKveiKn+iKueiKseiKrOiKpeiKr+iKuOiKo+iKsOiKvuiKt+iZjuiZseWIneihqOi7i+i/jui/lOi/kemCtemCuOmCsemCtumHh+mHkemVt+mWgOmYnOmZgOmYv+mYu+mZhFwiXSxcbltcImFiNDBcIixcIumZgumauembqOmdkumdnuS6n+S6reS6ruS/oeS+teS+r+S+v+S/oOS/keS/j+S/neS/g+S+tuS/mOS/n+S/iuS/l+S+ruS/kOS/hOS/guS/muS/juS/nuS+t+WFl+WGkuWGkeWGoOWJjuWJg+WJiuWJjeWJjOWJi+WJh+WLh+WLieWLg+WLgeWMjeWNl+WNu+WOmuWPm+WSrOWTgOWSqOWTjuWTieWSuOWSpuWSs+WTh+WTguWSveWSquWTgVwiXSxcbltcImFiYTFcIixcIuWThOWTiOWSr+WSq+WSseWSu+WSqeWSp+WSv+Wbv+WeguWei+WeoOWeo+WeouWfjuWeruWek+WlleWlkeWlj+WljuWlkOWnnOWnmOWnv+Wno+WnqOWog+WnpeWnquWnmuWnpuWogeWnu+WtqeWuo+WupuWupOWuouWupeWwgeWxjuWxj+WxjeWxi+WzmeWzkuW3t+W4neW4peW4n+W5veW6oOW6puW7uuW8iOW8reW9peW+iOW+heW+iuW+i+W+h+W+jOW+ieaAkuaAneaAoOaApeaAjuaAqOaBjeaBsOaBqOaBouaBhuaBg+aBrOaBq+aBquaBpOaJgeaLnOaMluaMieaLvOaLreaMgeaLruaLveaMh+aLseaLt1wiXSxcbltcImFjNDBcIixcIuaLr+aLrOaLvuaLtOaMkeaMguaUv+aVheaWq+aWveaXouaYpeaYreaYoOaYp+aYr+aYn+aYqOaYseaYpOabt+afv+afk+afseaflOafkOafrOaetuaer+afteafqeafr+afhOafkeaetOafmuafpeaeuOafj+afnuafs+aesOafmeafouafneafkuatquaug+auhuauteavkuavl+awn+aziea0i+a0sua0qua1gea0pea0jOa0sea0nua0l1wiXSxcbltcImFjYTFcIixcIua0u+a0vea0vua0tua0m+aztea0uea0p+a0uOa0qea0rua0tea0jua0q+eCq+eCuueCs+eCrOeCr+eCreeCuOeCrueCpOeIsOeJsueJr+eJtOeLqeeLoOeLoeeOt+ePiueOu+eOsuePjeePgOeOs+eUmueUreeVj+eVjOeVjueVi+eWq+eWpOeWpeeWoueWo+eZuOeahueah+eaiOebiOebhuebg+ebheecgeebueebuOecieeci+ebvuebvOech+efnOeggueglOegjOegjeelhuelieeliOelh+emueemuuenkeenkueni+epv+eqgeerv+erveexvee0gue0hee0gOe0iee0h+e0hOe0hue8uOe+jue+v+iAhFwiXSxcbltcImFkNDBcIixcIuiAkOiAjeiAkeiAtuiDluiDpeiDmuiDg+iDhOiDjOiDoeiDm+iDjuiDnuiDpOiDneiHtOiIouiLp+iMg+iMheiLo+iLm+iLpuiMhOiLpeiMguiMieiLkuiLl+iLseiMgeiLnOiLlOiLkeiLnuiLk+iLn+iLr+iMhuiZkOiZueiZu+iZuuihjeihq+imgeinlOioiOioguiog+iynuiyoOi1tOi1s+i2tOi7jei7jOi/sOi/pui/oui/qui/pVwiXSxcbltcImFkYTFcIixcIui/rei/q+i/pOi/qOmDiumDjumDgemDg+mFi+mFiumHjemWgumZkOmZi+mZjOmZjemdoumdqemfi+mfremfs+mggemiqOmjm+mjn+mmlummmeS5mOS6s+WAjOWAjeWAo+S/r+WApuWApeS/uOWAqeWAluWAhuWAvOWAn+WAmuWAkuWAkeS/uuWAgOWAlOWAqOS/seWAoeWAi+WAmeWAmOS/s+S/ruWAreWAquS/vuWAq+WAieWFvOWGpOWGpeWGouWHjeWHjOWHhuWHi+WJluWJnOWJlOWJm+WJneWMquWNv+WOn+WOneWPn+WTqOWUkOWUgeWUt+WTvOWTpeWTsuWUhuWTuuWUlOWTqeWTreWToeWUieWTruWTqlwiXSxcbltcImFlNDBcIixcIuWTpuWUp+WUh+WTveWUj+Wcg+WchOWfguWflOWfi+Wfg+WgieWkj+Wll+WlmOWlmuWokeWomOWonOWon+Wom+Wok+WnrOWooOWoo+WoqeWopeWojOWoieWtq+WxmOWusOWus+WutuWutOWuruWuteWuueWuuOWwhOWxkeWxleWxkOWzreWzveWzu+WzquWzqOWzsOWztuW0geWztOW3ruW4reW4q+W6q+W6reW6p+W8seW+kuW+keW+kOaBmVwiXSxcbltcImFlYTFcIixcIuaBo+aBpeaBkOaBleaBreaBqeaBr+aChOaCn+aCmuaCjeaClOaCjOaCheaCluaJh+aLs+aMiOaLv+aNjuaMvuaMr+aNleaNguaNhuaNj+aNieaMuuaNkOaMveaMquaMq+aMqOaNjeaNjOaViOaVieaWmeaXgeaXheaZguaZieaZj+aZg+aZkuaZjOaZheaZgeabuOaclOacleacl+agoeaguOahiOahhuahk+agueahguahlOagqeais+agl+ahjOahkeagveaftOahkOahgOagvOahg+agquahheagk+agmOahgeauiuauieaut+awo+awp+awqOawpuawpOazsOa1qua2lea2iOa2h+a1pua1uOa1t+a1mea2k1wiXSxcbltcImFmNDBcIixcIua1rOa2iea1rua1mua1tOa1qea2jOa2iua1uea2hea1pea2lOeDiueDmOeDpOeDmeeDiOeDj+eIueeJueeLvOeLueeLveeLuOeLt+eOhuePreeQieePruePoOePquePnueVlOeVneeVnOeVmueVmeeWvueXheeXh+eWsueWs+eWveeWvOeWueeXgueWuOeai+easOebiuebjeebjuecqeecn+ecoOecqOefqeegsOegp+eguOegneegtOegt1wiXSxcbltcImFmYTFcIixcIuegpeegreegoOegn+egsuelleelkOeloOeln+elluelnuelneell+elmuenpOeno+enp+enn+enpuenqeenmOeqhOeqiOermeeshueskeeyiee0oee0l+e0i+e0iue0oOe0oue0lOe0kOe0lee0mue0nOe0jee0mee0m+e8uue9n+e+lOe/hee/geiAhuiAmOiAleiAmeiAl+iAveiAv+iDseiEguiDsOiEheiDreiDtOiEhuiDuOiDs+iEiOiDveiEiuiDvOiDr+iHreiHrOiIgOiIkOiIquiIq+iIqOiIrOiKu+iMq+iNkuiNlOiNiuiMuOiNkOiNieiMteiMtOiNj+iMsuiMueiMtuiMl+iNgOiMseiMqOiNg1wiXSxcbltcImIwNDBcIixcIuiZlOiaiuiaquiak+iapOiaqeiajOiao+ianOihsOiht+iigeiiguihveihueiomOiokOiojuiojOioleioiuiol+iok+ioluioj+iokeixiOixuuixueiyoeiyoui1t+i6rOi7kui7lOi7j+i+semAgemAhui/t+mAgOi/uui/tOmAg+i/vemAhei/uOmClemDoemDnemDoumFkumFjemFjOmHmOmHnemHl+mHnOmHmemWg+mZoumZo+mZoVwiXSxcbltcImIwYTFcIixcIumZm+mZnemZpOmZmOmZnumau+mjoummrOmqqOmrmOmspemssumsvOS5vuWBuuWBveWBnOWBh+WBg+WBjOWBmuWBieWBpeWBtuWBjuWBleWBteWBtOWBt+WBj+WAj+WBr+WBreWFnOWGleWHsOWJquWJr+WLkuWLmeWLmOWLleWMkOWMj+WMmeWMv+WNgOWMvuWPg+abvOWVhuWVquWVpuWVhOWVnuWVoeWVg+WViuWUseWVluWVj+WVleWUr+WVpOWUuOWUruWVnOWUrOWVo+WUs+WVgeWVl+WciOWci+WcieWfn+WgheWgiuWghuWfoOWfpOWfuuWgguWgteWft+WfueWkoOWlouWotuWpgeWpieWppuWpquWpgFwiXSxcbltcImIxNDBcIixcIuWovOWpouWpmuWphuWpiuWtsOWvh+WvheWvhOWvguWuv+WvhuWwieWwiOWwh+WxoOWxnOWxneW0h+W0huW0juW0m+W0luW0ouW0keW0qeW0lOW0meW0pOW0p+W0l+W3ouW4uOW4tuW4s+W4t+W6t+W6uOW6tuW6teW6vuW8teW8t+W9l+W9rOW9qeW9q+W+l+W+meW+nuW+mOW+oeW+oOW+nOaBv+aCo+aCieaCoOaCqOaDi+aCtOaDpuaCvVwiXSxcbltcImIxYTFcIixcIuaDheaCu+aCteaDnOaCvOaDmOaDleaDhuaDn+aCuOaDmuaDh+aImuaIm+aJiOaOoOaOp+aNsuaOluaOouaOpeaNt+aNp+aOmOaOquaNseaOqeaOieaOg+aOm+aNq+aOqOaOhOaOiOaOmeaOoeaOrOaOkuaOj+aOgOaNu+aNqeaNqOaNuuaVneaVluaVkeaVmeaVl+WVn+aVj+aVmOaVleaVlOaWnOaWm+aWrOaXj+aXi+aXjOaXjuaZneaZmuaZpOaZqOaZpuaZnuabueWLl+acm+aigeair+aiouaik+aiteahv+ahtuaiseaip+ail+aisOaig+ajhOaireaihuaiheailOaineaiqOain+aioeaiguassuauulwiXSxcbltcImIyNDBcIixcIuavq+avrOawq+a2jua2vOa3s+a3mea2sua3oea3jOa3pOa3u+a3uua4hea3h+a3i+a2r+a3kea2rua3nua3uea2uOa3t+a3tea3hea3kua4mua2tea3mua3q+a3mOa3qua3sea3rua3qOa3hua3hOa2qua3rOa2v+a3pueDueeEieeEiueDveeDr+eIveeJveeKgeeMnOeMm+eMlueMk+eMmeeOh+eQheeQiueQg+eQhuePvueQjeeToOeTtlwiXSxcbltcImIyYTFcIixcIueTt+eUnOeUoueVpeeVpueVoueVsOeWj+eXlOeXleeWteeXiueXjeeajueblOebkuebm+ect+ecvuecvOectuecuOecuuehq+ehg+ehjuelpeelqOelreenu+eqkueqleesoOesqOesm+esrOespuesmeesnuesrueykueyl+eylee1hue1g+e1see0rue0uee0vOe1gOe0sOe0s+e1hOe0r+e1gue0sue0see8vee+nue+mue/jOe/jue/kuiAnOiBiuiBhuiEr+iEluiEo+iEq+iEqeiEsOiEpOiIguiIteiIt+iItuiIueiOjuiOnuiOmOiNuOiOouiOluiOveiOq+iOkuiOiuiOk+iOieiOoOiNt+iNu+iNvFwiXSxcbltcImIzNDBcIixcIuiOhuiOp+iZleW9quibh+ibgOiatuibhOiateibhuibi+iaseiar+ibieihk+iinuiiiOiiq+iikuiiluiijeiii+imk+imj+ioquioneioo+iopeioseioreion+iom+ioouixieixmuiyqeiyrOiyq+iyqOiyquiyp+i1p+i1pui2vui2uui7m+i7n+mAmemAjemAmumAl+mAo+mAn+mAnemAkOmAlemAnumAoOmAj+mAoumAlumAm+mAlFwiXSxcbltcImIzYTFcIixcIumDqOmDremDvemFl+mHjumHtemHpumHo+mHp+mHremHqemWiemZqumZtemZs+mZuOmZsOmZtOmZtumZt+mZrOmbgOmbqumbqeeroOern+mggumgg+mtmumzpem5tem5v+m6pem6u+WCouWCjeWCheWCmeWCkeWCgOWCluWCmOWCmuacgOWHseWJsuWJtOWJteWJqeWLnuWLneWLm+WNmuWOpeWVu+WWgOWWp+WVvOWWiuWWneWWmOWWguWWnOWWquWWlOWWh+WWi+WWg+WWs+WWruWWn+WUvuWWsuWWmuWWu+WWrOWWseWVvuWWieWWq+WWmeWcjeWgr+WgquWgtOWgpOWgsOWgseWgoeWgneWgoOWjueWjuuWloFwiXSxcbltcImI0NDBcIixcIuWpt+WqmuWpv+WqkuWqm+Wqp+Wts+WtseWvkuWvjOWvk+WvkOWwiuWwi+WwseW1jOW1kOW0tOW1h+W3veW5heW4veW5gOW5g+W5vuW7iuW7geW7guW7hOW8vOW9reW+qeW+quW+qOaDkeaDoeaCsuaCtuaDoOaEnOaEo+aDuuaEleaDsOaDu+aDtOaFqOaDseaEjuaDtuaEieaEgOaEkuaIn+aJieaOo+aOjOaPj+aPgOaPqeaPieaPhuaPjVwiXSxcbltcImI0YTFcIixcIuaPkuaPo+aPkOaPoeaPluaPreaPruaNtuaPtOaPquaPm+aRkuaPmuaPueaVnuaVpuaVouaVo+aWkeaWkOaWr+aZruaZsOaZtOaZtuaZr+aakeaZuuaZvuaZt+abvuabv+acn+acneajuuajleajoOajmOajl+akheajn+ajteajruajp+ajueajkuajsuajo+aji+ajjeakjeakkuakjuajieajmualruaju+asvuasuuasveaumOauluauvOavr+awruawr+awrOa4r+a4uOa5lOa4oea4sua5p+a5iua4oOa4pea4o+a4m+a5m+a5mOa4pOa5lua5rua4rea4pua5r+a4tOa5jea4uua4rOa5g+a4nea4vua7i1wiXSxcbltcImI1NDBcIixcIua6iea4mea5jua5o+a5hOa5sua5qea5n+eEmeeEmueEpueEsOeEoeeEtueFrueEnOeJjOeKhOeKgOeMtueMpeeMtOeMqeeQuueQqueQs+eQoueQpeeQteeQtueQtOeQr+eQm+eQpueQqOeUpeeUpueVq+eVqueXoueXm+eXo+eXmeeXmOeXnueXoOeZu+eZvOealueak+eatOebnOedj+efreehneehrOehr+eojeeoiOeoi+eoheeogOeqmFwiXSxcbltcImI1YTFcIixcIueql+eqluerpeero+etieetluethuetkOetkuetlOetjeeti+etj+etkeeyn+eypee1nue1kOe1qOe1lee0q+e1rue1sue1oee1pue1oue1sOe1s+WWhOe/lOe/leiAi+iBkuiCheiFleiFlOiFi+iFkeiFjuiEueiFhuiEvuiFjOiFk+iFtOiIkuiInOiPqeiQg+iPuOiQjeiPoOiPheiQi+iPgeiPr+iPseiPtOiRl+iQiuiPsOiQjOiPjOiPveiPsuiPiuiQuOiQjuiQhOiPnOiQh+iPlOiPn+iZm+ibn+ibmeibreiblOibm+ibpOibkOibnuihl+ijgeijguiiseimg+imluiou+ipoOipleipnuiovOipgVwiXSxcbltcImI2NDBcIixcIuiplOipm+ipkOiphuiotOiouuiotuipluixoeiyguiyr+iyvOiys+iyveizgeiyu+izgOiytOiyt+iytuiyv+iyuOi2iui2hei2gei3jui3nei3i+i3mui3kei3jOi3m+i3hui7u+i7uOi7vOi+nOmArumAtemAsemAuOmAsumAtumEgumDtemEiemDvumFo+mFpemHj+mIlOmIlemIo+mIiemInumIjemIkOmIh+mIkemWlOmWj+mWi+mWkVwiXSxcbltcImI2YTFcIixcIumWk+mWkumWjumaiumajumai+mZvemahemahumajemZsumahOmbgembhembhOmbhumbh+mbr+mbsumfjOmghemghumgiOmjp+mjqumjr+mjqemjsumjremmrummrem7g+m7jem7keS6guWCreWCteWCsuWCs+WDheWCvuWCrOWCt+WCu+WCr+WDh+WJv+WJt+WJveWLn+WLpuWLpOWLouWLo+WMr+WXn+WXqOWXk+WXpuWXjuWXnOWXh+WXkeWXo+WXpOWXr+WXmuWXoeWXheWXhuWXpeWXieWckuWck+WhnuWhkeWhmOWhl+WhmuWhlOWhq+WhjOWhreWhiuWhouWhkuWhi+Wlp+WrgeWrieWrjOWqvuWqveWqvFwiXSxcbltcImI3NDBcIixcIuWqs+WrguWqsuW1qeW1r+W5jOW5ueW7ieW7iOW8kuW9meW+rOW+ruaEmuaEj+aFiOaEn+aDs+aEm+aDueaEgeaEiOaFjuaFjOaFhOaFjeaEvuaEtOaEp+aEjeaEhuaEt+aIoeaIouaQk+aQvuaQnuaQquaQreaQveaQrOaQj+aQnOaQlOaQjeaQtuaQluaQl+aQhuaVrOaWn+aWsOaal+aaieaah+aaiOaaluaahOaamOaajeacg+amlOalrVwiXSxcbltcImI3YTFcIixcIualmualt+aloOallOalteaksOamgualiualqOalq+alnualk+alueamhualnealo+alm+ath+atsuavgOauv+avk+avvea6oua6r+a7k+a6tua7gua6kOa6nea7h+a7hea6pea6mOa6vOa6uua6q+a7kea6lua6nOa7hOa7lOa6qua6p+a6tOeFjueFmeeFqeeFpOeFieeFp+eFnOeFrOeFpueFjOeFpeeFnueFhueFqOeFlueIuueJkueMt+eNheeMv+eMvueRr+eRmueRleeRn+eRnueRgeeQv+eRmeeRm+eRnOeVtueVuOeYgOeXsOeYgeeXsueXseeXuueXv+eXtOeXs+ebnuebn+edm+edq+edpuednuedo1wiXSxcbltcImI4NDBcIixcIuedueedquedrOednOedpeedqOedouefrueijueisOeil+eimOeijOeiieehvOeikeeik+ehv+eluuelv+emgeiQrOemveeonOeomueooOeolOeon+eonueqn+eqoOett+evgOetoOetruetp+eyseeys+eytee2k+e1uee2kee2gee2j+e1m+e9rue9qee9que9sue+qee+qOe+pOiBluiBmOiChuiChOiFseiFsOiFuOiFpeiFruiFs+iFq1wiXSxcbltcImI4YTFcIixcIuiFueiFuuiFpuiIheiJh+iSguiRt+iQveiQseiRteiRpuiRq+iRieiRrOiRm+iQvOiQteiRoeiRo+iRqeiRreiRhuiZnuiZnOiZn+ibueick+iciOich+icgOibvuibu+icguicg+ichuiciuihmeijn+ijlOijmeijnOijmOijneijoeijiuijleijkuimnOino+ipq+ipsuips+ippuipqeipsOiqh+ipvOipo+iqoOipseiqheipreipouipruiprOipueipu+iovuipqOixouiyiuiyieiziuizh+iziOizhOiysuizg+izguizhei3oei3n+i3qOi3r+i3s+i3uui3qui3pOi3pui6sui8g+i8iei7vui8ilwiXSxcbltcImI5NDBcIixcIui+n+i+sumBi+mBiumBk+mBgumBlOmAvOmBlemBkOmBh+mBj+mBjumBjemBkemAvumBgemEkumEl+mFrOmFqumFqemHiemIt+mJl+mIuOmIvemJgOmIvumJm+mJi+mJpOmJkemItOmJiemJjemJhemIuemIv+mJmumWmOmamOmalOmalembjembi+mbiembiumbt+mbu+mbuembtumdlumdtOmdtumgkOmgkemgk+mgiumgkumgjOmjvOmjtFwiXSxcbltcImI5YTFcIixcIumjvemjvumms+mmsemmtOmroemzqem6gum8jum8k+m8oOWDp+WDruWDpeWDluWDreWDmuWDleWDj+WDkeWDseWDjuWDqeWFouWHs+WKg+WKguWMseWOreWXvuWYgOWYm+WYl+WXveWYlOWYhuWYieWYjeWYjuWXt+WYluWYn+WYiOWYkOWXtuWcmOWcluWhteWhvuWig+Wik+WiiuWhueWiheWhveWjveWkpeWkouWkpOWlquWlqeWroeWrpuWrqeWrl+WrluWrmOWro+WtteWvnuWvp+WvoeWvpeWvpuWvqOWvouWvpOWvn+WwjeWxouW2hOW2h+W5m+W5o+W5leW5l+W5lOW7k+W7luW8iuW9huW9sOW+ueaFh1wiXSxcbltcImJhNDBcIixcIuaEv+aFi+aFt+aFouaFo+aFn+aFmuaFmOaFteaIquaSh+aRmOaRlOaSpOaRuOaRn+aRuuaRkeaRp+aQtOaRreaRu+aVsuaWoeaXl+aXluaaouaaqOaaneamnOamqOamleangeamruank+ani+amm+amt+amu+amq+amtOankOanjeamreanjOampuang+amo+atieatjOaws+a8s+a8lOa7vua8k+a7tOa8qea8vua8oOa8rOa8j+a8gua8olwiXSxcbltcImJhYTFcIixcIua7v+a7r+a8hua8sea8uOa8sua8o+a8lea8q+a8r+a+iOa8qua7rOa8gea7sua7jOa7t+eGlOeGmeeFveeGiueGhOeGkueIvueKkueKlueNhOeNkOeRpOeRo+eRqueRsOeRreeUhOeWkeeYp+eYjeeYi+eYieeYk+eboeebo+eehOedveedv+edoeejgeein+eip+eis+eiqeeio+emjuemj+emjeeorueoseeqqueqqeerreerr+euoeeuleeui+etteeul+euneeulOeuj+euuOeuh+euhOeyueeyveeyvue2u+e2sOe2nOe2vee2vue2oOe3iue2tOe2sue2see2uue2oue2v+e2tee2uOe2ree3kue3h+e2rFwiXSxcbltcImJiNDBcIixcIue9sOe/oOe/oee/n+iBnuiBmuiCh+iFkOiGgOiGj+iGiOiGiuiFv+iGguiHp+iHuuiIh+iIlOiInuiJi+iTieiSv+iThuiThOiSmeiSnuiSsuiSnOiTi+iSuOiTgOiTk+iSkOiSvOiTkeiTiuicv+icnOicu+icouicpeictOicmOidleict+icqeijs+ikguijtOijueijuOijveijqOikmuijr+iqpuiqjOiqnuiqo+iqjeiqoeiqk+iqpFwiXSxcbltcImJiYTFcIixcIuiqquiqpeiqqOiqmOiqkeiqmuiqp+ixquiyjeiyjOizk+izkeizkui1q+i2mei2lei3vOi8lOi8kui8lei8k+i+o+mBoOmBmOmBnOmBo+mBmemBnumBoumBnemBm+mEmemEmOmEnumFtemFuOmFt+mFtOmJuOmKgOmKhemKmOmKlumJu+mKk+mKnOmKqOmJvOmKkemWoemWqOmWqemWo+mWpemWpOmamemanOmam+mbjOmbkumcgOmdvOmehemftumgl+mgmOmir+misemkg+mkhemkjOmkiemngemqr+mqsOmrpumtgemtgumztOmztumzs+m6vOm8u+m9iuWEhOWEgOWDu+WDteWDueWEguWEiOWEieWEheWHnFwiXSxcbltcImJjNDBcIixcIuWKh+WKiOWKieWKjeWKiuWLsOWOsuWYruWYu+WYueWYsuWYv+WYtOWYqeWZk+WZjuWZl+WZtOWYtuWYr+WYsOWigOWin+WinuWis+WinOWiruWiqeWipuWlreWsieWru+Wsi+WrteWsjOWsiOWvruWvrOWvqeWvq+WxpOWxpeW2neW2lOW5ouW5n+W5oeW7ouW7muW7n+W7neW7o+W7oOW9iOW9seW+t+W+teaFtuaFp+aFruaFneaFleaGglwiXSxcbltcImJjYTFcIixcIuaFvOaFsOaFq+aFvuaGp+aGkOaGq+aGjuaGrOaGmuaGpOaGlOaGruaIruaRqeaRr+aRueaSnuaSsuaSiOaSkOaSsOaSpeaSk+aSleaSqeaSkuaSruaSreaSq+aSmuaSrOaSmeaSouaSs+aVteaVt+aVuOaaruaaq+aatOaaseaoo+aon+anqOaogeaonuaomeanveaooeaok+aoiuans+aoguaoheanreaokeatkOatjuaupOavheavhua8v+a9vOa+hOa9kea9pua9lOa+hua9rea9m+a9uOa9rua+jua9uua9sOa9pOa+l+a9mOa7lea9r+a9oOa9n+eGn+eGrOeGseeGqOeJlueKm+eNjueNl+eRqeeSi+eSg1wiXSxcbltcImJkNDBcIixcIueRvueSgOeVv+eYoOeYqeeYn+eYpOeYpueYoeeYoueamueauuebpOeejueeh+eejOeekeeei+eji+ejheeiuuejiueivuejleeivOejkOeov+eovOepgOeoveeot+eou+eqr+eqrueureeuseevhOeutOevhuevh+evgeeuoOevjOeziue3oOe3tOe3r+e3u+e3mOe3rOe3nee3qOe3o+e3mue3nue3qee2nue3mee3sue3uee9tee9t+e+r1wiXSxcbltcImJkYTFcIixcIue/qeiApuiGm+iGnOiGneiGoOiGmuiGmOiUl+iUveiUmuiTruiUrOiUreiUk+iUkeiUo+iUoeiUlOiTrOiUpeiTv+iUhuieguidtOidtuidoOidpuiduOidqOidmeidl+idjOidk+ihm+ihneikkOikh+ikkuikk+ikleikiuiqvOirkuirh+irhOiqleiri+iruOiqsuirieirguiqv+iqsOirluirjeiqtuiqueirm+ixjOixjuixrOizoOiznuizpuizpOizrOizreizouizo+iznOizquizoei1rei2n+i2o+i4q+i4kOi4nei4oui4j+i4qei4n+i4oei4nui6uui8nei8m+i8n+i8qei8pui8qui8nOi8nlwiXSxcbltcImJlNDBcIixcIui8pemBqemBrumBqOmBremBt+mEsOmEremEp+mEsemGh+mGiemGi+mGg+mLhemKu+mKt+mLqumKrOmLpOmLgemKs+mKvOmLkumLh+mLsOmKsumWremWsemchOmchumch+mciemdoOmejemei+mej+mgoemgq+mgnOmis+mkiumkk+mkkumkmOmnnemnkOmnn+mnm+mnkemnlemnkumnmemqt+mrrumrr+msp+mthemthOmtt+mtr+m0hum0iVwiXSxcbltcImJlYTFcIixcIum0g+m6qem6vum7juWiqOm9kuWEkuWEmOWElOWEkOWEleWGgOWGquWHneWKkeWKk+WLs+WZmeWZq+WZueWZqeWZpOWZuOWZquWZqOWZpeWZseWZr+WZrOWZouWZtuWjgeWivuWjh+WjheWlruWsneWstOWtuOWvsOWwjuW9iuaGsuaGkeaGqeaGiuaHjeaGtuaGvuaHiuaHiOaIsOaTheaTgeaTi+aSu+aSvOaTmuaThOaTh+aTguaTjeaSv+aTkuaTlOaSvuaVtOabhuabieaaueabhOabh+aauOaoveaouOaouuapmeapq+apmOaoueaphOapouapoeapi+aph+aoteapn+apiOatmeatt+awhea/gua+sea+oVwiXSxcbltcImJmNDBcIixcIua/g+a+pOa/gea+p+a+s+a/gOa+uea+tua+pua+oOa+tOeGvueHieeHkOeHkueHiOeHleeGueeHjueHmeeHnOeHg+eHhOeNqOeSnOeSo+eSmOeSn+eSnueToueUjOeUjeeYtOeYuOeYuuebp+ebpeeeoOeenueen+eepeejqOejmuejrOejp+empuepjeepjuephuepjOepi+equuevmeewkeevieevpOevm+evoeevqeevpuezleezlue4ilwiXSxcbltcImJmYTFcIixcIue4kee4iOe4m+e4o+e4nue4nee4iee4kOe9uee+sue/sOe/see/ruiAqOiGs+iGqeiGqOiHu+iIiOiJmOiJmeiViuiVmeiViOiVqOiVqeiVg+iVieiVreiVquiVnuieg+ien+ienuieouiejeihoeikquiksuikpeikq+ikoeimquimpuirpuiruuirq+irseisgOirnOirp+irruirvuisgeisguirt+irreirs+irtuirvOixq+ixreiyk+iztOi5hOi4sei4tOi5gui4uei4tei8u+i8r+i8uOi8s+i+qOi+pumBtemBtOmBuOmBsumBvOmBuumEtOmGkumMoOmMtumLuOmMs+mMr+mMoumLvOmMq+mMhOmMmlwiXSxcbltcImMwNDBcIixcIumMkOmMpumMoemMlemMrumMmemWu+map+maqOmaqumblemcjumckemclumcjemck+mcj+mdm+mdnOmdpumemOmgsOmguOmgu+mgt+mgremguemgpOmkkOmkqOmknumkm+mkoemkmumnremnoumnsemquOmqvOmru+mrremsqOmukem0lem0o+m0pum0qOm0kum0m+m7mOm7lOm+jem+nOWEquWEn+WEoeWEsuWLteWajuWagOWakOWaheWah1wiXSxcbltcImMwYTFcIixcIuWaj+WjleWjk+WjkeWjjuWssOWsquWspOWtuuWwt+WxqOW2vOW2uuW2veW2uOW5q+W9jOW+veaHieaHguaHh+aHpuaHi+aIsuaItOaTjuaTiuaTmOaToOaTsOaTpuaTrOaTseaTouaTreaWguaWg+abmeabluaqgOaqlOaqhOaqouaqnOarm+aqo+apvuaql+aqkOaqoOatnOauruavmuawiOa/mOa/sea/n+a/oOa/m+a/pOa/q+a/r+a+gOa/rOa/oea/qea/lea/rua/sOeHp+eHn+eHrueHpueHpeeHreeHrOeHtOeHoOeIteeJhueNsOeNsueSqeeSsOeSpueSqOeZhueZgueZjOebquees+eequeesOeerFwiXSxcbltcImMxNDBcIixcIueep+eereefr+ejt+ejuuejtOejr+ekgeemp+emquepl+eqv+ewh+ewjeevvuevt+ewjOevoOezoOeznOeznuezouezn+ezmeeznee4rue4vue5hue4t+e4sue5g+e4q+e4vee4see5hee5gee4tOe4uee5iOe4tee4v+e4r+e9hOe/s+e/vOiBseiBsuiBsOiBr+iBs+iHhuiHg+iGuuiHguiHgOiGv+iGveiHieiGvuiHqOiIieiJseiWqlwiXSxcbltcImMxYTFcIixcIuiWhOiVvuiWnOiWkeiWlOiWr+iWm+iWh+iWqOiWiuiZp+ifgOifkeies+ifkuifhuieq+ieu+ieuuifiOifi+iku+iktuilhOikuOikveimrOisjuisl+ismeism+isiuisoOisneishOiskOixgeiwv+ixs+izuuizveizvOizuOizu+i2qOi5iei5i+i5iOi5iui9hOi8vui9gui9hei8v+mBv+mBvemChOmCgemCgumCgOmEuemGo+mGnumGnOmNjemOgumMqOmNtemNiumNpemNi+mMmOmNvumNrOmNm+mNsOmNmumNlOmXiumXi+mXjOmXiOmXhumasemauOmblumcnOmcnumeoOmfk+mhhumitumktemogVwiXSxcbltcImMyNDBcIixcIumnv+murumuq+muqumurem0u+m0v+m6i+m7j+m7num7nOm7nem7m+m8vum9i+WPouWaleWaruWjmeWjmOWsuOW9neaHo+aIs+aTtOaTsuaTvuaUhuaTuuaTu+aTt+aWt+abnOacpuaqs+aqrOarg+aqu+aquOarguaqruaqr+atn+atuOaur+eAieeAi+a/vueAhua/uueAkeeAj+eHu+eHvOeHvueHuOeNt+eNteeSp+eSv+eUleeZlueZmFwiXSxcbltcImMyYTFcIixcIueZkueeveeev+eeu+eevOekjuemruepoeepouepoOerhOerheewq+ewp+ewquewnuewo+ewoeezp+e5lOe5lee5nue5mue5oee5kue5mee9iOe/uee/u+iBt+iBtuiHjeiHj+iIiuiXj+iWqeiXjeiXkOiXieiWsOiWuuiWueiWpuifr+ifrOifsuifoOimhuimsuintOisqOisueisrOisq+ixkOi0hei5mei5o+i5pui5pOi5n+i5lei7gOi9iei9jemCh+mCg+mCiOmGq+mGrOmHkOmOlOmOiumOlumOoumOs+mOrumOrOmOsOmOmOmOmumOl+mXlOmXlumXkOmXlemboumbnOmbmembm+mbnumcpOmeo+meplwiXSxcbltcImMzNDBcIixcIumeremfuemhjemhj+mhjOmhjumhk+miuumkvumkv+mkvemkrummpemojumrgemsg+mshumtj+mtjumtjemviumviemvvemviOmvgOm1kem1nem1oOm7oOm8lem8rOWEs+WapeWjnuWjn+WjouWvtem+kOW7rOaHsuaHt+aHtuaHteaUgOaUj+aboOabnearpearnearmuark+eAm+eAn+eAqOeAmueAneeAleeAmOeIhueIjeeJmOeKoueNuFwiXSxcbltcImMzYTFcIixcIueNuueSveeTiueTo+eWh+eWhueZn+eZoeefh+ekmeemseepq+epqeewvuewv+ewuOewveewt+exgOe5q+e5ree5uee5qee5que+hee5s+e+tue+uee+uOiHmOiXqeiXneiXquiXleiXpOiXpeiXt+ifu+igheigjeifueifvuiloOiln+illuilnuitgeitnOitmOitieitmuitjuitj+ithuitmei0iOi0iui5vOi5sui6h+i5tui5rOi5uui5tOi9lOi9jui+remCiumCi+mGsemGrumPoemPkemPn+mPg+mPiOmPnOmPnemPlumPoumPjemPmOmPpOmPl+mPqOmXnOmatOmbo+mcqumcp+mdoemfnOmfu+mhnlwiXSxcbltcImM0NDBcIixcIumhmOmhm+mivOmlhemliemolumomemsjemvqOmvp+mvlumvm+m2iem1oem1sum1qum1rOm6kum6l+m6k+m6tOWLuOWaqOWat+WatuWatOWavOWjpOWtgOWtg+WtveWvtuW3ieaHuOaHuuaUmOaUlOaUmeabpuacp+arrOeAvueAsOeAsueIkOeNu+eTj+eZoueZpeekpuekquekrOekq+erh+ertuexjOexg+exjeezr+ezsOi+rue5vee5vFwiXSxcbltcImM0YTFcIixcIue6gue9jOiAgOiHmuiJpuiXu+iXueiYkeiXuuiYhuiYi+iYh+iYiuiglOigleilpOimuuinuOitsOitrOitpuitr+itn+itq+i0j+i0jei6iei6gei6hei6gumGtOmHi+mQmOmQg+mPvemXoemcsOmjhOmlkumlkemmqOmoq+mosOmot+motemwk+mwjem5uem6tem7qOm8r+m9n+m9o+m9oeWEt+WEuOWbgeWbgOWbguWklOWxrOW3jeaHvOaHvuaUneaUnOaWleabqearu+ashOaruuausueBjOeIm+eKp+eTlueTlOeZqeefk+exkOe6j+e6jOe+vOiYl+iYreiYmuigo+igouigoeign+ilquilrOimveittFwiXSxcbltcImM1NDBcIixcIuitt+itvei0k+i6iui6jei6i+i9n+i+r+mGuumQrumQs+mQtemQuumQuOmQsumQq+mXoumcuOmcuemcsumfv+mhp+mhpemll+mphempg+mpgOmovumrj+mtlOmtkemwremwpem2r+m2tOm3gum2uOm6nem7r+m8mem9nOm9pum9p+WEvOWEu+WbiOWbiuWbieWtv+W3lOW3kuW9juaHv+aUpOasiuatoeeBkeeBmOeOgOeTpOeWiueZrueZrFwiXSxcbltcImM1YTFcIixcIuems+exoOexn+iBvuiBveiHn+ilsuilr+invOiugOi0lui0l+i6kei6k+i9oemFiOmRhOmRkemRkumcvemcvumfg+mfgemhq+mllemplempjemrkumsmumxiemwsemwvumwu+m3k+m3l+m8tOm9rOm9qum+lOWbjOW3luaIgOaUo+aUq+aUquabrOaskOeTmueriuexpOexo+expee6k+e6lue6lOiHouiYuOiYv+igseiuiumCkOmCj+mRo+mRoOmRpOmdqOmhr+mlnOmpmumpm+mpl+mrk+mrlOmrkemxlOmxl+mxlum3pem6n+m7tOWbkeWjqeaUrOeBnueZseeZsuefl+e9kOe+iOigtuigueihouiuk+iuklwiXSxcbltcImM2NDBcIixcIuiuluiJt+i0m+mHgOmRqumdgumdiOmdhOmfhumhsOmpn+msoumtmOmxn+m3uem3uum5vOm5vem8h+m9t+m9suW7s+aslueBo+exrOexruigu+ingOi6oemHgemRsumRsOmhsemlnumrlumso+m7jOeBpOefmuiumumRt+mfiempoumppee6nOiunOi6qumHhemRvemRvumRvOmxt+mxuOm7t+ixlOmRv+m4mueIqOmpqumssem4m+m4nuexslwiXSxcbltcImM5NDBcIixcIuS5guS5nOWHteWMmuWOguS4h+S4jOS5h+S6jeWbl++ojOWxruW9s+S4j+WGh+S4juS4ruS6k+S7guS7ieS7iOWGmOWLvOWNrOWOueWcoOWkg+WkrOWwkOW3v+aXoeaus+avjOawlOeIv+S4seS4vOS7qOS7nOS7qeS7oeS7neS7muWIjOWMnOWNjOWcouWco+Wkl+Wkr+WugeWuhOWwkuWwu+WxtOWxs+W4hOW6gOW6guW/ieaIieaJkOawlVwiXSxcbltcImM5YTFcIixcIuawtuaxg+awv+awu+eKrueKsOeOiuemuOiCiumYnuS8juS8mOS8rOS7teS8lOS7seS8gOS7t+S8iOS8neS8guS8heS8ouS8k+S8hOS7tOS8kuWGseWIk+WIieWIkOWKpuWMouWMn+WNjeWOiuWQh+WboeWbn+WcruWcquWctOWkvOWmgOWlvOWmheWlu+WlvuWlt+Wlv+WtluWwleWwpeWxvOWxuuWxu+WxvuW3n+W5teW6hOW8guW8muW9tOW/leW/lOW/j+aJnOaJnuaJpOaJoeaJpuaJouaJmeaJoOaJmuaJpeaXr+aXruacvuacueacuOacu+acuuacv+acvOacs+awmOaxhuaxkuaxnOaxj+axiuaxlOaxi1wiXSxcbltcImNhNDBcIixcIuaxjOeBseeJnueKtOeKteeOjueUqueZv+eptee9keiJuOiJvOiKgOiJveiJv+iZjeilvumCmemCl+mCmOmCm+mClOmYoumYpOmYoOmYo+S9luS8u+S9ouS9ieS9k+S9pOS8vuS9p+S9kuS9n+S9geS9mOS8reS8s+S8v+S9oeWGj+WGueWInOWInuWIoeWKreWKruWMieWNo+WNsuWOjuWOj+WQsOWQt+WQquWRlOWRheWQmeWQnOWQpeWQmFwiXSxcbltcImNhYTFcIixcIuWQveWRj+WRgeWQqOWQpOWRh+WbruWbp+WbpeWdgeWdheWdjOWdieWdi+WdkuWkhuWlgOWmpuWmmOWmoOWml+WmjuWmouWmkOWmj+Wmp+WmoeWujuWukuWwqOWwquWyjeWyj+WyiOWyi+WyieWykuWyiuWyhuWyk+WyleW3oOW4iuW4juW6i+W6ieW6jOW6iOW6jeW8heW8neW9uOW9tuW/kuW/keW/kOW/reW/qOW/ruW/s+W/oeW/pOW/o+W/uuW/r+W/t+W/u+aAgOW/tOaIuuaKg+aKjOaKjuaKj+aKlOaKh+aJseaJu+aJuuaJsOaKgeaKiOaJt+aJveaJsuaJtOaUt+aXsOaXtOaXs+aXsuaXteadheadh1wiXSxcbltcImNiNDBcIixcIuadmeadleadjOadiOadneadjeadmuadi+avkOawmeawmuaxuOaxp+axq+ayhOayi+ayj+axseaxr+axqeaymuaxreayh+ayleaynOaxpuaxs+axpeaxu+ayjueBtOeBuueJo+eKv+eKveeLg+eLhueLgeeKuueLheeOleeOl+eOk+eOlOeOkueUuueUueeWlOeWleeageekveiAtOiCleiCmeiCkOiCkuiCnOiKkOiKj+iKheiKjuiKkeiKk1wiXSxcbltcImNiYTFcIixcIuiKiuiKg+iKhOixuOi/iei+v+mCn+mCoemCpemCnumCp+mCoOmYsOmYqOmYr+mYreS4s+S+mOS9vOS+heS9veS+gOS+h+S9tuS9tOS+ieS+hOS9t+S9jOS+l+S9quS+muS9ueS+geS9uOS+kOS+nOS+lOS+nuS+kuS+guS+leS9q+S9ruWGnuWGvOWGvuWIteWIsuWIs+WJhuWIseWKvOWMiuWMi+WMvOWOkuWOlOWSh+WRv+WSgeWSkeWSguWSiOWRq+WRuuWRvuWRpeWRrOWRtOWRpuWSjeWRr+WRoeWRoOWSmOWRo+WRp+WRpOWbt+WbueWdr+WdsuWdreWdq+WdseWdsOWdtuWegOWdteWdu+Wds+WdtOWdolwiXSxcbltcImNjNDBcIixcIuWdqOWdveWkjOWlheWmteWmuuWnj+WnjuWmsuWnjOWngeWmtuWmvOWng+WnluWmseWmveWngOWniOWmtOWnh+WtouWtpeWuk+WuleWxhOWxh+WyruWypOWyoOWyteWyr+WyqOWyrOWyn+Wyo+WyreWyouWyquWyp+WyneWypeWytuWysOWypuW4l+W4lOW4meW8qOW8ouW8o+W8pOW9lOW+guW9vuW9veW/nuW/peaAreaApuaAmeaAsuaAi1wiXSxcbltcImNjYTFcIixcIuaAtOaAiuaAl+aAs+aAmuaAnuaArOaAouaAjeaAkOaAruaAk+aAkeaAjOaAieaAnOaIlOaIveaKreaKtOaLkeaKvuaKquaKtuaLiuaKruaKs+aKr+aKu+aKqeaKsOaKuOaUveaWqOaWu+aYieaXvOaYhOaYkuaYiOaXu+aYg+aYi+aYjeaYheaXveaYkeaYkOabtuaciuaeheadrOaejuaekuadtuadu+aemOaehuaehOadtOaejeaejOaduuaen+aekeaemeaeg+adveaegeaduOadueaelOaspeaugOatvuavnuawneayk+azrOazq+azruazmeaytuazlOayreazp+ayt+azkOazguayuuazg+azhuazreazslwiXSxcbltcImNkNDBcIixcIuazkuazneaytOayiuayneaygOaznuazgOa0sOazjeazh+aysOazueazj+azqeazkeeClOeCmOeCheeCk+eChueChOeCkeeClueCgueCmueCg+eJqueLlueLi+eLmOeLieeLnOeLkueLlOeLmueLjOeLkeeOpOeOoeeOreeOpueOoueOoOeOrOeOneeTneeTqOeUv+eVgOeUvueWjOeWmOear+ebs+ebseebsOebteefuOefvOefueefu+efulwiXSxcbltcImNkYTFcIixcIueft+elguekv+enheepuOepu+eru+exteezveiAteiCj+iCruiCo+iCuOiCteiCreiIoOiKoOiLgOiKq+iKmuiKmOiKm+iKteiKp+iKruiKvOiKnuiKuuiKtOiKqOiKoeiKqeiLguiKpOiLg+iKtuiKouiZsOiZr+iZreiZruixlui/kui/i+i/k+i/jei/lui/lei/l+mCsumCtOmCr+mCs+mCsOmYuemYvemYvOmYuumZg+S/jeS/heS/k+S+suS/ieS/i+S/geS/lOS/nOS/meS+u+S+s+S/m+S/h+S/luS+uuS/gOS+ueS/rOWJhOWJieWLgOWLguWMveWNvOWOl+WOluWOmeWOmOWSuuWSoeWSreWSpeWTj1wiXSxcbltcImNlNDBcIixcIuWTg+iMjeWSt+WSruWTluWStuWTheWThuWSoOWRsOWSvOWSouWSvuWRsuWTnuWSsOWeteWenuWen+WepOWejOWel+WeneWem+WelOWemOWej+WemeWepeWemuWeleWjtOWkjeWlk+WnoeWnnuWnruWogOWnseWnneWnuuWnveWnvOWntuWnpOWnsuWnt+Wnm+WnqeWns+WnteWnoOWnvuWntOWnreWuqOWxjOWzkOWzmOWzjOWzl+Wzi+Wzm1wiXSxcbltcImNlYTFcIixcIuWznuWzmuWzieWzh+WziuWzluWzk+WzlOWzj+WziOWzhuWzjuWzn+WzuOW3ueW4oeW4ouW4o+W4oOW4pOW6sOW6pOW6ouW6m+W6o+W6peW8h+W8ruW9luW+huaAt+aAueaBlOaBsuaBnuaBheaBk+aBh+aBieaBm+aBjOaBgOaBguaBn+aApOaBhOaBmOaBpuaBruaJguaJg+aLj+aMjeaMi+aLteaMjuaMg+aLq+aLueaMj+aMjOaLuOaLtuaMgOaMk+aMlOaLuuaMleaLu+aLsOaVgeaVg+aWquaWv+aYtuaYoeaYsuaYteaYnOaYpuaYouaYs+aYq+aYuuaYneaYtOaYueaYruacj+ackOafgeafsuafiOaeulwiXSxcbltcImNmNDBcIixcIuafnOaeu+afuOafmOafgOaet+afheafq+afpOafn+aeteafjeaes+aft+aftuafruafo+afguaeueafjuafp+afsOaesuafvOafhuafreafjOaeruafpuafm+afuuafieafiuafg+afquafi+asqOauguauhOautuavluavmOavoOawoOawoea0qOa0tOa0rea0n+a0vOa0v+a0kua0iuazmua0s+a0hOa0mea0uua0mua0kea0gOa0nea1glwiXSxcbltcImNmYTFcIixcIua0gea0mOa0t+a0g+a0j+a1gOa0h+a0oOa0rOa0iOa0oua0iea0kOeCt+eCn+eCvueCseeCsOeCoeeCtOeCteeCqeeJgeeJieeJiueJrOeJsOeJs+eJrueLiueLpOeLqOeLq+eLn+eLqueLpueLo+eOheePjOePguePiOePheeOueeOtueOteeOtOePq+eOv+ePh+eOvuePg+ePhueOuOePi+eTrOeTrueUrueVh+eViOeWp+eWqueZueebhOeciOecg+echOecheeciuebt+ebu+ebuuefp+efqOeghuegkeegkuegheegkOegj+egjuegieegg+egk+eliueljOeli+elheelhOenleenjeenj+enluenjueqgFwiXSxcbltcImQwNDBcIixcIuepvuerkeesgOesgeexuuexuOexueexv+eygOeygee0g+e0iOe0gee9mOe+kee+jee+vuiAh+iAjuiAj+iAlOiAt+iDmOiDh+iDoOiDkeiDiOiDguiDkOiDheiDo+iDmeiDnOiDiuiDleiDieiDj+iDl+iDpuiDjeiHv+iIoeiKlOiLmeiLvuiLueiMh+iLqOiMgOiLleiMuuiLq+iLluiLtOiLrOiLoeiLsuiLteiMjOiLu+iLtuiLsOiLqlwiXSxcbltcImQwYTFcIixcIuiLpOiLoOiLuuiLs+iLreiZt+iZtOiZvOiZs+ihgeihjuihp+ihquihqeink+iohOioh+i1sui/o+i/oei/rui/oOmDsemCvemCv+mDlemDhemCvumDh+mDi+mDiOmHlOmHk+mZlOmZj+mZkemZk+mZiumZjuWAnuWAheWAh+WAk+WAouWAsOWAm+S/teS/tOWAs+WAt+WArOS/tuS/t+WAl+WAnOWAoOWAp+WAteWAr+WAseWAjuWFmuWGlOWGk+WHiuWHhOWHheWHiOWHjuWJoeWJmuWJkuWJnuWJn+WJleWJouWLjeWMjuWOnuWUpuWTouWUl+WUkuWTp+WTs+WTpOWUmuWTv+WUhOWUiOWTq+WUkeWUheWTsVwiXSxcbltcImQxNDBcIixcIuWUiuWTu+WTt+WTuOWToOWUjuWUg+WUi+WcgeWcguWfjOWgsuWfleWfkuWeuuWfhuWeveWevOWeuOWetuWev+Wfh+WfkOWeueWfgeWkjuWliuWomeWoluWoreWoruWoleWoj+Wol+WoiuWonuWos+WtrOWup+WureWurOWwg+WxluWxlOWzrOWzv+WzruWzseWzt+W0gOWzueW4qeW4qOW6qOW6ruW6quW6rOW8s+W8sOW9p+aBneaBmuaBp1wiXSxcbltcImQxYTFcIixcIuaBgeaCouaCiOaCgOaCkuaCgeaCneaCg+aCleaCm+aCl+aCh+aCnOaCjuaImeaJhuaLsuaMkOaNluaMrOaNhOaNheaMtuaNg+aPpOaMueaNi+aNiuaMvOaMqeaNgeaMtOaNmOaNlOaNmeaMreaNh+aMs+aNmuaNkeaMuOaNl+aNgOaNiOaViuaVhuaXhuaXg+aXhOaXguaZiuaZn+aZh+aZkeackuack+agn+agmuahieagsuags+agu+ahi+ahj+agluagseagnOagteagq+agreagr+ahjuahhOagtOagneagkuaglOagpuagqOagruahjeaguuagpeagoOasrOasr+asreasseastOatreiCguauiOavpuavpFwiXSxcbltcImQyNDBcIixcIuavqOavo+avouavp+awpea1uua1o+a1pOa1tua0jea1oea2kua1mOa1oua1rea1r+a2kea2jea3r+a1v+a2hua1nua1p+a1oOa2l+a1sOa1vOa1n+a2gua2mOa0r+a1qOa2i+a1vua2gOa2hOa0lua2g+a1u+a1vea1tea2kOeDnOeDk+eDkeeDneeDi+e8ueeDoueDl+eDkueDnueDoOeDlOeDjeeDheeDhueDh+eDmueDjueDoeeJgueJuFwiXSxcbltcImQyYTFcIixcIueJt+eJtueMgOeLuueLtOeLvueLtueLs+eLu+eMgeePk+ePmeePpeePlueOvOePp+ePo+ePqeePnOePkuePm+ePlOePneePmuePl+ePmOePqOeTnueTn+eTtOeTteeUoeeVm+eVn+eWsOeXgeeWu+eXhOeXgOeWv+eWtueWuueaiuebieecneecm+eckOeck+eckueco+eckeecleecmeecmuecouecp+ego+egrOegouegteegr+egqOegruegq+egoeegqeegs+egquegseellOelm+elj+elnOelk+elkuelkeenq+enrOenoOenruenreenquennOennuenneeqhueqieeqheeqi+eqjOeqiueqh+ermOeskFwiXSxcbltcImQzNDBcIixcIueshOesk+esheesj+esiOesiuesjuesieeskueyhOeykeeyiueyjOeyiOeyjeeyhee0nue0nee0kee0jue0mOe0lue0k+e0n+e0kue0j+e0jOe9nOe9oee9nue9oOe9nee9m+e+lue+kue/g+e/gue/gOiAluiAvuiAueiDuuiDsuiDueiDteiEgeiDu+iEgOiIgeiIr+iIpeiMs+iMreiNhOiMmeiNkeiMpeiNluiMv+iNgeiMpuiMnOiMolwiXSxcbltcImQzYTFcIixcIuiNguiNjuiMm+iMquiMiOiMvOiNjeiMluiMpOiMoOiMt+iMr+iMqeiNh+iNheiNjOiNk+iMnuiMrOiNi+iMp+iNiOiZk+iZkuiaouiaqOialuiajeiakeianuiah+ial+iahuiai+iamuiaheiapeiameiaoeiap+ialeiamOiajuianeiakOialOihg+ihhOihreihteihtuihsuiigOihseihv+ihr+iig+ihvuihtOihvOiokuixh+ixl+ixu+iypOiyo+i1tui1uOi2tei2t+i2tui7kei7k+i/vui/temAgui/v+i/u+mAhOi/vOi/tumDlumDoOmDmemDmumDo+mDn+mDpemDmOmDm+mDl+mDnOmDpOmFkFwiXSxcbltcImQ0NDBcIixcIumFjumFj+mHlemHoumHmumZnOmZn+mavOmjo+mrn+msr+S5v+WBsOWBquWBoeWBnuWBoOWBk+WBi+WBneWBsuWBiOWBjeWBgeWBm+WBiuWBouWAleWBheWBn+WBqeWBq+WBo+WBpOWBhuWBgOWBruWBs+WBl+WBkeWHkOWJq+WJreWJrOWJruWLluWLk+WMreWOnOWVteWVtuWUvOWVjeWVkOWUtOWUquWVkeWVouWUtuWUteWUsOWVkuWVhVwiXSxcbltcImQ0YTFcIixcIuWUjOWUsuWVpeWVjuWUueWViOWUreWUu+WVgOWVi+WciuWch+Wfu+WglOWfouWftuWfnOWftOWggOWfreWfveWgiOWfuOWgi+Wfs+Wfj+Wgh+WfruWfo+WfsuWfpeWfrOWfoeWgjuWfvOWgkOWfp+WggeWgjOWfseWfqeWfsOWgjeWghOWlnOWpoOWpmOWpleWpp+WpnuWouOWoteWpreWpkOWpn+WppeWprOWpk+WppOWpl+Wpg+WpneWpkuWphOWpm+WpiOWqjuWovuWpjeWoueWpjOWpsOWpqeWph+WpkeWpluWpguWpnOWtsuWtruWvgeWvgOWxmeW0nuW0i+W0neW0muW0oOW0jOW0qOW0jeW0puW0peW0j1wiXSxcbltcImQ1NDBcIixcIuW0sOW0kuW0o+W0n+W0ruW4vuW4tOW6seW6tOW6ueW6suW6s+W8tuW8uOW+m+W+luW+n+aCiuaCkOaChuaCvuaCsOaCuuaDk+aDlOaDj+aDpOaDmeaDneaDiOaCseaDm+aCt+aDiuaCv+aDg+aDjeaDgOaMsuaNpeaOiuaOguaNveaOveaOnuaOreaOneaOl+aOq+aOjuaNr+aOh+aOkOaNruaOr+aNteaOnOaNreaOruaNvOaOpOaMu+aOn1wiXSxcbltcImQ1YTFcIixcIuaNuOaOheaOgeaOkeaOjeaNsOaVk+aXjeaZpeaZoeaZm+aZmeaZnOaZouacmOahueaih+aikOainOahreahruairuaiq+alluahr+aio+airOaiqeahteahtOaisuaij+aht+aikuahvOahq+ahsuaiquaigOahseahvuaim+ailuaii+aioOaiieaipOahuOahu+aikeaijOaiiuahveastuass+ast+asuOaukeauj+aujeaujuaujOawqua3gOa2q+a2tOa2s+a5tOa2rOa3qea3oua2t+a3tua3lOa4gOa3iOa3oOa3n+a3lua2vua3pea3nOa3nea3m+a3tOa3iua2vea3rea3sOa2uua3lea3gua3j+a3iVwiXSxcbltcImQ2NDBcIixcIua3kOa3sua3k+a3vea3l+a3jea3o+a2u+eDuueEjeeDt+eEl+eDtOeEjOeDsOeEhOeDs+eEkOeDvOeDv+eEhueEk+eEgOeDuOeDtueEi+eEgueEjueJvueJu+eJvOeJv+eMneeMl+eMh+eMkeeMmOeMiueMiOeLv+eMj+eMnueOiOePtuePuOePteeQhOeQgeePveeQh+eQgOePuuePvOePv+eQjOeQi+ePtOeQiOeVpOeVo+eXjueXkueXj1wiXSxcbltcImQ2YTFcIixcIueXi+eXjOeXkeeXkOeaj+eaieebk+ecueecr+ecreecseecsuectOecs+ecveecpeecu+ecteehiOehkuehieehjeehiuehjOegpuehheehkOelpOelp+elqeelquelo+elq+eloeemu+enuuenuOentuent+eqj+eqlOeqkOesteeth+estOespeessOesouespOess+esmOesquesneesseesq+esreesr+essuesuOesmueso+eylOeymOeylueyo+e0tee0vee0uOe0tue0uue1hee0rOe0qee1gee1h+e0vue0v+e1iue0u+e0qOe9o+e+lee+nOe+nee+m+e/iue/i+e/jee/kOe/kee/h+e/j+e/ieiAn1wiXSxcbltcImQ3NDBcIixcIuiAnuiAm+iBh+iBg+iBiOiEmOiEpeiEmeiEm+iEreiEn+iErOiEnuiEoeiEleiEp+iEneiEouiIkeiIuOiIs+iIuuiItOiIsuiJtOiOkOiOo+iOqOiOjeiNuuiNs+iOpOiNtOiOj+iOgeiOleiOmeiNteiOlOiOqeiNveiOg+iOjOiOneiOm+iOquiOi+iNvuiOpeiOr+iOiOiOl+iOsOiNv+iOpuiOh+iOruiNtuiOmuiZmeiZluiav+iat1wiXSxcbltcImQ3YTFcIixcIuibguibgeibheiauuiasOibiOiaueias+iauOibjOiatOiau+iavOibg+iaveiavuihkuiiieiileiiqOiiouiiquiimuiikeiioeiin+iimOiip+iimeiim+iil+iipOiirOiijOiik+iijuimguinluinmeinleiosOiop+iorOionuiwueiwu+ixnOixneixveiypei1vei1u+i1uei2vOi3gui2uei2v+i3gei7mOi7nui7nei7nOi7l+i7oOi7oemApOmAi+mAkemAnOmAjOmAoemDr+mDqumDsOmDtOmDsumDs+mDlOmDq+mDrOmDqemFlumFmOmFmumFk+mFlemHrOmHtOmHsemHs+mHuOmHpOmHuemHqlwiXSxcbltcImQ4NDBcIixcIumHq+mHt+mHqOmHrumVuumWhumWiOmZvOmZremZq+mZsemZr+mav+mdqumghOmjpemml+WCm+WCleWClOWCnuWCi+WCo+WCg+WCjOWCjuWCneWBqOWCnOWCkuWCguWCh+WFn+WHlOWMkuWMkeWOpOWOp+WWkeWWqOWWpeWWreWVt+WZheWWouWWk+WWiOWWj+WWteWWgeWWo+WWkuWWpOWVveWWjOWWpuWVv+WWleWWoeWWjuWcjOWgqeWgt1wiXSxcbltcImQ4YTFcIixcIuWgmeWgnuWgp+Wgo+WgqOWfteWhiOWgpeWgnOWgm+Wgs+Wgv+WgtuWgruWgueWguOWgreWgrOWgu+WloeWqr+WqlOWqn+WpuuWqouWqnuWpuOWqpuWpvOWqpeWqrOWqleWqruWot+WqhOWqiuWql+Wqg+Wqi+WqqeWpu+WpveWqjOWqnOWqj+Wqk+WqneWvquWvjeWvi+WvlOWvkeWviuWvjuWwjOWwsOW0t+W1g+W1q+W1geW1i+W0v+W0teW1keW1juW1leW0s+W0uuW1kuW0veW0seW1meW1guW0ueW1ieW0uOW0vOW0suW0tuW1gOW1heW5hOW5geW9mOW+puW+peW+q+aDieaCueaDjOaDouaDjuaDhOaElFwiXSxcbltcImQ5NDBcIixcIuaDsuaEiuaEluaEheaDteaEk+aDuOaDvOaDvuaDgeaEg+aEmOaEneaEkOaDv+aEhOaEi+aJiuaOlOaOseaOsOaPjuaPpeaPqOaPr+aPg+aSneaPs+aPiuaPoOaPtuaPleaPsuaPteaRoeaPn+aOvuaPneaPnOaPhOaPmOaPk+aPguaPh+aPjOaPi+aPiOaPsOaPl+aPmeaUsuaVp+aVquaVpOaVnOaVqOaVpeaWjOaWneaWnuaWruaXkOaXklwiXSxcbltcImQ5YTFcIixcIuaZvOaZrOaZu+aagOaZseaZueaZquaZsuacgeakjOajk+akhOajnOakquajrOajquajseakj+ajluajt+ajq+ajpOajtuakk+akkOajs+ajoeakh+ajjOakiOalsOaitOakkeajr+ajhuaklOajuOajkOajveajvOajqOaki+akiuakl+ajjuajiOajneajnuajpuajtOajkeakhuajlOajqeakleakpeajh+asueasu+asv+asvOaulOaul+aumeauleauveavsOavsuavs+awsOa3vOa5hua5h+a4n+a5iea6iOa4vOa4vea5hea5oua4q+a4v+a5gea5nea5s+a4nOa4s+a5i+a5gOa5kea4u+a4g+a4rua5nlwiXSxcbltcImRhNDBcIixcIua5qOa5nOa5oea4sea4qOa5oOa5sea5q+a4uea4oua4sOa5k+a5pea4p+a5uOa5pOa5t+a5lea5uea5kua5pua4tea4tua5mueEoOeEnueEr+eDu+eErueEseeEo+eEpeeEoueEsueEn+eEqOeEuueEm+eJi+eJmueKiOeKieeKhueKheeKi+eMkueMi+eMsOeMoueMseeMs+eMp+eMsueMreeMpueMo+eMteeMjOeQrueQrOeQsOeQq+eQllwiXSxcbltcImRhYTFcIixcIueQmueQoeeQreeQseeQpOeQo+eQneeQqeeQoOeQsueTu+eUr+eVr+eVrOeXp+eXmueXoeeXpueXneeXn+eXpOeXl+ealeeakuebmuedhuedh+edhOedjeedheediuedjuedi+edjOefnuefrOehoOehpOehpeehnOehreehseehquehruehsOehqeehqOehnuehoueltOels+elsuelsOeogueoiueog+eojOeohOeqmeerpuerpOetiuesu+ethOetiOetjOetjuetgOetmOetheeyoueynueyqOeyoee1mOe1r+e1o+e1k+e1lue1p+e1que1j+e1ree1nOe1q+e1kue1lOe1qee1kee1n+e1jue8vue8v+e9pVwiXSxcbltcImRiNDBcIixcIue9pue+oue+oOe+oee/l+iBkeiBj+iBkOiDvuiDlOiFg+iFiuiFkuiFj+iFh+iEveiFjeiEuuiHpuiHruiHt+iHuOiHueiIhOiIvOiIveiIv+iJteiMu+iPj+iPueiQo+iPgOiPqOiQkuiPp+iPpOiPvOiPtuiQkOiPhuiPiOiPq+iPo+iOv+iQgeiPneiPpeiPmOiPv+iPoeiPi+iPjuiPluiPteiPieiQieiQj+iPnuiQkeiQhuiPguiPs1wiXSxcbltcImRiYTFcIixcIuiPleiPuuiPh+iPkeiPquiQk+iPg+iPrOiPruiPhOiPu+iPl+iPouiQm+iPm+iPvuibmOibouibpuibk+ibo+ibmuibquibneibq+ibnOibrOibqeibl+ibqOibkeihiOihluihleiiuuijl+iiueiiuOijgOiivuiituiivOiit+iiveiisuikgeijieimleimmOiml+inneinmuinm+ipjuipjeioueipmeipgOipl+ipmOiphOipheipkuipiOipkeipiuipjOipj+ixn+iygeiygOiyuuiyvuiysOiyueiytei2hOi2gOi2iei3mOi3k+i3jei3h+i3lui3nOi3j+i3lei3mei3iOi3l+i3hei7r+i7t+i7ulwiXSxcbltcImRjNDBcIixcIui7uei7pui7rui7pei7tei7p+i7qOi7tui7q+i7sei7rOi7tOi7qemAremAtOmAr+mEhumErOmEhOmDv+mDvOmEiOmDuemDu+mEgemEgOmEh+mEhemEg+mFoemFpOmFn+mFoumFoOmIgemIiumIpemIg+mImumIpumIj+mIjOmIgOmIkumHv+mHvemIhumIhOmIp+mIgumInOmIpOmImemIl+mIhemIlumVu+mWjemWjOmWkOmah+mZvumaiFwiXSxcbltcImRjYTFcIixcIumaiemag+magOmbgumbiOmbg+mbsembsOmdrOmdsOmdrumgh+miqemjq+mzpum7ueS6g+S6hOS6tuWCveWCv+WDhuWCruWDhOWDiuWCtOWDiOWDguWCsOWDgeWCuuWCseWDi+WDieWCtuWCuOWHl+WJuuWJuOWJu+WJvOWXg+WXm+WXjOWXkOWXi+WXiuWXneWXgOWXlOWXhOWXqeWWv+WXkuWWjeWXj+WXleWXouWXluWXiOWXsuWXjeWXmeWXguWclOWhk+WhqOWhpOWhj+WhjeWhieWhr+WhleWhjuWhneWhmeWhpeWhm+WgveWho+WhseWjvOWrh+WrhOWri+WquuWquOWqseWqteWqsOWqv+WriOWqu+WrhlwiXSxcbltcImRkNDBcIixcIuWqt+WrgOWriuWqtOWqtuWrjeWqueWqkOWvluWvmOWvmeWwn+Wws+W1seW1o+W1iuW1peW1suW1rOW1nuW1qOW1p+W1ouW3sOW5j+W5juW5iuW5jeW5i+W7heW7jOW7huW7i+W7h+W9gOW+r+W+reaDt+aFieaFiuaEq+aFheaEtuaEsuaEruaFhuaEr+aFj+aEqeaFgOaIoOmFqOaIo+aIpeaIpOaPheaPseaPq+aQkOaQkuaQieaQoOaQpFwiXSxcbltcImRkYTFcIixcIuaQs+aRg+aQn+aQleaQmOaQueaQt+aQouaQo+aQjOaQpuaQsOaQqOaRgeaQteaQr+aQiuaQmuaRgOaQpeaQp+aQi+aPp+aQm+aQruaQoeaQjuaVr+aWkuaXk+aahuaajOaaleaakOaai+aaiuaameaalOaZuOacoOalpualn+akuOaljualoualseakv+alhealquakuealguall+almealuualiOalieaktealrOaks+akvealpeajsOaluOaktOalqealgOalr+alhOaltualmOalgealtOaljOaku+ali+akt+alnOalj+alkeaksualkuakr+alu+akvOathuatheatg+atguatiOatgeaum++ojeavu+avvFwiXSxcbltcImRlNDBcIixcIuavueavt+avuOa6m+a7lua7iOa6j+a7gOa6n+a6k+a6lOa6oOa6sea6uea7hua7kua6vea7gea6nua7iea6t+a6sOa7jea6pua7j+a6sua6vua7g+a7nOa7mOa6mea6kua6jua6jea6pOa6oea6v+a6s+a7kOa7iua6l+a6rua6o+eFh+eFlOeFkueFo+eFoOeFgeeFneeFoueFsueFuOeFqueFoeeFgueFmOeFg+eFi+eFsOeFn+eFkOeFk1wiXSxcbltcImRlYTFcIixcIueFhOeFjeeFmueJj+eKjeeKjOeKkeeKkOeKjueMvOeNgueMu+eMuueNgOeNiueNieeRhOeRiueRi+eRkueRkeeRl+eRgOeRj+eRkOeRjueRgueRhueRjeeRlOeToeeTv+eTvueTveeUneeVueeVt+amg+eXr+eYj+eYg+eXt+eXvueXvOeXueeXuOeYkOeXu+eXtueXreeXteeXveeameeateebneedleedn+edoOedkuedluedmuedqeedp+edlOedmeedreefoOeih+eimueilOeij+eihOeileeiheeihueioeeig+ehueeimeeigOeiluehu+elvOemguelveelueeokeeomOeomeeokueol+eoleeooueok1wiXSxcbltcImRmNDBcIixcIueom+eokOeqo+eqoueqnuerq+etpuetpOetreettOetqeetsuetpeets+etseetsOetoeetuOettueto+eysueytOeyr+e2iOe2hue2gOe2jee1v+e2hee1uue2jue1u+e2g+e1vOe2jOe2lOe2hOe1vee2kue9ree9q+e9p+e9qOe9rOe+pue+pee+p+e/m+e/nOiAoeiFpOiFoOiFt+iFnOiFqeiFm+iFouiFsuacoeiFnuiFtuiFp+iFr1wiXSxcbltcImRmYTFcIixcIuiFhOiFoeiIneiJieiJhOiJgOiJguiJheiTseiQv+iRluiRtuiRueiSj+iSjeiRpeiRkeiRgOiShuiRp+iQsOiRjeiRveiRmuiRmeiRtOiRs+iRneiUh+iRnuiQt+iQuuiQtOiRuuiRg+iRuOiQsuiRheiQqeiPmeiRi+iQr+iRguiQreiRn+iRsOiQueiRjuiRjOiRkuiRr+iTheiSjuiQu+iRh+iQtuiQs+iRqOiRvuiRhOiQq+iRoOiRlOiRruiRkOici+ichOibt+icjOibuuibluibteidjeibuOicjuicieicgeibtuicjeicheijluiji+ijjeijjuijnuijm+ijmuijjOijkOimheimm+inn+inpeinpFwiXSxcbltcImUwNDBcIixcIuinoeinoOinouinnOinpuiptuiqhuipv+ipoeiov+ipt+iqguiqhOipteiqg+iqgeiptOipuuiwvOixi+ixiuixpeixpOixpuiyhuiyhOiyheizjOi1qOi1qei2kei2jOi2jui2j+i2jei2k+i2lOi2kOi2kui3sOi3oOi3rOi3sei3rui3kOi3qei3o+i3oui3p+i3sui3q+i3tOi8hui7v+i8gei8gOi8hei8h+i8iOi8gui8i+mBkumAv1wiXSxcbltcImUwYTFcIixcIumBhOmBiemAvemEkOmEjemEj+mEkemElumElOmEi+mEjumFrumFr+mJiOmJkumIsOmIuumJpumIs+mJpemJnumKg+mIrumJiumJhumJremJrOmJj+mJoOmJp+mJr+mItumJoemJsOmIsemJlOmJo+mJkOmJsumJjumJk+mJjOmJlumIsumWn+mWnOmWnumWm+makumak+makemal+mbjumbuumbvembuOmbtemds+mdt+mduOmdsumgj+mgjemgjumirOmjtumjuemmr+mmsummsOmmtemqremqq+mtm+mzqumzremzp+m6gOm7veWDpuWDlOWDl+WDqOWDs+WDm+WDquWDneWDpOWDk+WDrOWDsOWDr+WDo+WDoFwiXSxcbltcImUxNDBcIixcIuWHmOWKgOWKgeWLqeWLq+WMsOWOrOWYp+WYleWYjOWYkuWXvOWYj+WYnOWYgeWYk+WYguWXuuWYneWYhOWXv+WXueWiieWhvOWikOWimOWihuWigeWhv+WhtOWii+WhuuWih+WikeWijuWhtuWiguWiiOWhu+WilOWij+WjvuWlq+WrnOWrruWrpeWrleWrquWrmuWrreWrq+Wrs+WrouWroOWrm+WrrOWrnuWrneWrmeWrqOWrn+Wtt+WvoFwiXSxcbltcImUxYTFcIixcIuWvo+Wxo+W2guW2gOW1veW2huW1uuW2geW1t+W2iuW2ieW2iOW1vuW1vOW2jeW1ueW1v+W5mOW5meW5k+W7mOW7keW7l+W7juW7nOW7leW7meW7kuW7lOW9hOW9g+W9r+W+tuaErOaEqOaFgeaFnuaFseaFs+aFkuaFk+aFsuaFrOaGgOaFtOaFlOaFuuaFm+aFpeaEu+aFquaFoeaFluaIqeaIp+aIq+aQq+aRjeaRm+aRneaRtOaRtuaRsuaRs+aRveaRteaRpuaSpuaRjuaSguaRnuaRnOaRi+aRk+aRoOaRkOaRv+aQv+aRrOaRq+aRmeaRpeaRt+aVs+aWoOaaoeaaoOaan+acheachOacouamseamtuaniVwiXSxcbltcImUyNDBcIixcIuamoOanjuamluamsOamrOamvOamkeammeamjuamp+amjeamqeamvuamr+amv+anhOamveampOanlOamueaniuammuanj+ams+amk+amquamoeamnuanmeaml+amkOanguamteampeanhuatiuatjeati+aunuaun+auoOavg+avhOavvua7jua7tea7sea8g+a8pea7uOa8t+a7u+a8rua8iea9jua8mea8mua8p+a8mOa8u+a8kua7rea8ilwiXSxcbltcImUyYTFcIixcIua8tua9s+a7uea7rua8rea9gOa8sOa8vOa8tea7q+a8h+a8jua9g+a8hea7vea7tua8uea8nOa7vOa8uua8n+a8jea8nua8iOa8oeeGh+eGkOeGieeGgOeGheeGgueGj+eFu+eGhueGgeeGl+eJhOeJk+eKl+eKleeKk+eNg+eNjeeNkeeNjOeRoueRs+eRseeRteeRsueRp+eRrueUgOeUgueUg+eVveeWkOeYlueYiOeYjOeYleeYkeeYiueYlOeauOeegeedvOeeheeeguedrueegOedr+edvueeg+eisueiqueitOeireeiqOehvueiq+einueipeeioOeirOeioueipOemmOemiuemi+emluemleemlOemk1wiXSxcbltcImUzNDBcIixcIueml+emiOemkuemkOeoq+epiueosOeor+eoqOeopueqqOeqq+eqrOerrueuiOeunOeuiueukeeukOeulueujeeujOeum+eujueuheeumOWKhOeumeeupOeugueyu+eyv+eyvOeyuue2p+e2t+e3gue2o+e2que3gee3gOe3hee2nee3jue3hOe3hue3i+e3jOe2r+e2uee2lue2vOe2n+e2pue2rue2qee2oee3iee9s+e/oue/o+e/pee/nlwiXSxcbltcImUzYTFcIixcIuiApOiBneiBnOiGieiGhuiGg+iGh+iGjeiGjOiGi+iIleiSl+iSpOiSoeiSn+iSuuiTjuiTguiSrOiSruiSq+iSueiStOiTgeiTjeiSquiSmuiSseiTkOiSneiSp+iSu+iSouiSlOiTh+iTjOiSm+iSqeiSr+iSqOiTluiSmOiStuiTj+iSoOiTl+iTlOiTkuiTm+iSsOiSkeiZoeics+ico+icqOidq+idgOicruicnuicoeicmeicm+idg+icrOidgeicvuidhuicoOicsuicquicreicvOickuicuuicseicteidguicpuicp+icuOicpOicmuicsOickeijt+ijp+ijseijsuijuuijvuijruijvOijtuiju1wiXSxcbltcImU0NDBcIixcIuijsOijrOijq+imneimoeimn+imnuinqeinq+inqOiqq+iqmeiqi+iqkuiqj+iqluiwveixqOixqeizleizj+izl+i2lui4iei4gui3v+i4jei3vei4iui4g+i4h+i4hui4hei3vui4gOi4hOi8kOi8kei8jui8jemEo+mEnOmEoOmEoumEn+mEnemEmumEpOmEoemEm+mFuumFsumFuemFs+mKpemKpOmJtumKm+mJuumKoOmKlOmKqumKjVwiXSxcbltcImU0YTFcIixcIumKpumKmumKq+mJuemKl+mJv+mKo+mLrumKjumKgumKlemKoumJvemKiOmKoemKiumKhumKjOmKmemKp+mJvumKh+mKqemKnemKi+mIremanumaoembv+mdmOmdvemduumdvumeg+megOmegumdu+mehOmegemdv+mfjumfjemglumiremirumkgumkgOmkh+mmnemmnOmng+mmuemmu+mmuumngummvemnh+mqsemro+mrp+msvumsv+mtoOmtoemtn+mzsemzsumztem6p+WDv+WEg+WEsOWDuOWEhuWEh+WDtuWDvuWEi+WEjOWDveWEiuWKi+WKjOWLseWLr+WZiOWZguWZjOWYteWZgeWZiuWZieWZhuWZmFwiXSxcbltcImU1NDBcIixcIuWZmuWZgOWYs+WYveWYrOWYvuWYuOWYquWYuuWcmuWiq+WineWiseWioOWio+Wir+WirOWipeWioeWjv+Wrv+WrtOWrveWrt+WrtuWsg+WruOWsguWrueWsgeWsh+WsheWsj+Wxp+W2meW2l+W2n+W2kuW2ouW2k+W2leW2oOW2nOW2oeW2muW2nuW5qeW5neW5oOW5nOe3s+W7m+W7nuW7oeW9ieW+suaGi+aGg+aFueaGseaGsOaGouaGiVwiXSxcbltcImU1YTFcIixcIuaGm+aGk+aGr+aGreaGn+aGkuaGquaGoeaGjeaFpuaGs+aIreaRruaRsOaSluaSoOaSheaSl+aSnOaSj+aSi+aSiuaSjOaSo+aSn+aRqOaSseaSmOaVtuaVuuaVueaVu+aWsuaWs+aateaasOaaqeaasuaat+aaquaar+aogOaohuaol+anpeanuOaoleanseanpOaooOanv+anrOanouaom+aoneanvuaop+ansuanruaolOant+anp+apgOaoiOanpuanu+aojeanvOanq+aoieaohOaomOaopeaoj+antuaopuaoh+antOaoluatkeaupeauo+auouaupuawgeawgOavv+awgua9gea8pua9vua+h+a/hua+klwiXSxcbltcImU2NDBcIixcIua+jea+iea+jOa9oua9j+a+hea9mua+lua9tua9rOa+gua9lea9sua9kua9kOa9l+a+lOa+k+a9nea8gOa9oea9q+a9vea9p+a+kOa9k+a+i+a9qea9v+a+lea9o+a9t+a9qua9u+eGsueGr+eGm+eGsOeGoOeGmueGqeeGteeGneeGpeeGnueGpOeGoeeGqueGnOeGp+eGs+eKmOeKmueNmOeNkueNnueNn+eNoOeNneeNm+eNoeeNmueNmVwiXSxcbltcImU2YTFcIixcIueNoueSh+eSieeSiueShueSgeeRveeSheeSiOeRvOeRueeUiOeUh+eVvueYpeeYnueYmeeYneeYnOeYo+eYmueYqOeYm+eanOeaneeanueam+eejeeej+eeieeeiOejjeeiu+ejj+ejjOejkeejjuejlOejiOejg+ejhOejieemmuemoeemoOemnOemouemm+attueoueeqsueqtOeqs+eut+evi+euvueurOevjueur+euueeviueuteezheeziOezjOezi+e3t+e3m+e3que3p+e3l+e3oee4g+e3uue3pue3tue3see3sOe3rue3n+e9tue+rOe+sOe+ree/ree/q+e/que/rOe/pue/qOiBpOiBp+iGo+iGn1wiXSxcbltcImU3NDBcIixcIuiGnuiGleiGouiGmeiGl+iIluiJj+iJk+iJkuiJkOiJjuiJkeiUpOiUu+iUj+iUgOiUqeiUjuiUieiUjeiUn+iUiuiUp+iUnOiTu+iUq+iTuuiUiOiUjOiTtOiUquiTsuiUleiTt+iTq+iTs+iTvOiUkuiTquiTqeiUluiTvuiUqOiUneiUruiUguiTveiUnuiTtuiUseiUpuiTp+iTqOiTsOiTr+iTueiUmOiUoOiUsOiUi+iUmeiUr+iZolwiXSxcbltcImU3YTFcIixcIuidluido+idpOidt+ifoeids+idmOidlOidm+idkuidoeidmuidkeidnuidreidquidkOidjuidn+idneidr+idrOiduuidruidnOidpeidj+idu+idteidouidp+idqeihmuikheikjOiklOiki+ikl+ikmOikmeikhuikluikkeikjuikieimouimpOimo+inreinsOinrOirj+irhuiquOirk+irkeirlOirleiqu+irl+iqvuirgOirheirmOirg+iquuiqveirmeiwvuixjeiyj+izpeizn+izmeizqOizmuizneizp+i2oOi2nOi2oei2m+i4oOi4o+i4pei4pOi4rui4lei4m+i4lui4kei4mei4pui4p1wiXSxcbltcImU4NDBcIixcIui4lOi4kui4mOi4k+i4nOi4l+i4mui8rOi8pOi8mOi8mui8oOi8o+i8lui8l+mBs+mBsOmBr+mBp+mBq+mEr+mEq+mEqemEqumEsumEpumErumGhemGhumGiumGgemGgumGhOmGgOmLkOmLg+mLhOmLgOmLmemKtumLj+mLsemLn+mLmOmLqemLl+mLnemLjOmLr+mLgumLqOmLiumLiOmLjumLpumLjemLlemLiemLoOmLnumLp+mLkemLk1wiXSxcbltcImU4YTFcIixcIumKtemLoemLhumKtOmVvOmWrOmWq+mWrumWsOmapOmaoumbk+mchemciOmcgumdmumeiumejumeiOmfkOmfj+mgnumgnemgpumgqemgqOmgoOmgm+mgp+misumkiOmjuumkkemklOmklumkl+mklemnnOmnjemnj+mnk+mnlOmnjumniemnlumnmOmni+mnl+mnjOmqs+mrrOmrq+mrs+mrsumrsemthumtg+mtp+mttOmtsemtpumttumttemtsOmtqOmtpOmtrOmzvOmzuumzvemzv+mzt+m0h+m0gOmzuemzu+m0iOm0hem0hOm6g+m7k+m8j+m8kOWEnOWEk+WEl+WEmuWEkeWHnuWMtOWPoeWZsOWZoOWZrlwiXSxcbltcImU5NDBcIixcIuWZs+WZpuWZo+WZreWZsuWZnuWZt+WcnOWcm+WjiOWiveWjieWiv+WiuuWjguWivOWjhuWsl+WsmeWsm+WsoeWslOWsk+WskOWsluWsqOWsmuWsoOWsnuWvr+W2rOW2seW2qeW2p+W2teW2sOW2ruW2quW2qOW2suW2reW2r+W2tOW5p+W5qOW5puW5r+W7qeW7p+W7puW7qOW7peW9i+W+vOaGneaGqOaGluaHheaGtOaHhuaHgeaHjOaGulwiXSxcbltcImU5YTFcIixcIuaGv+aGuOaGjOaTl+aTluaTkOaTj+aTieaSveaSieaTg+aTm+aTs+aTmeaUs+aVv+aVvOaWouabiOaavuabgOabiuabi+abj+aaveaau+aauuabjOaco+aotOappuapieapp+aosuapqOaovuapneapreaptuapm+apkeaoqOapmuaou+aov+apgeapquappOapkOapj+aplOapr+apqeapoOaovOapnuapluapleapjeapjuaphuatleatlOatluaup+auquauq+aviOavh+awhOawg+awhua+rea/i+a+o+a/h+a+vOa/jua/iOa9nua/hOa+vea+nua/iua+qOeAhOa+pea+rua+uua+rOa+qua/j+a+v+a+uFwiXSxcbltcImVhNDBcIixcIua+oua/iea+q+a/jea+r+a+sua+sOeHheeHgueGv+eGuOeHlueHgOeHgeeHi+eHlOeHiueHh+eHj+eGveeHmOeGvOeHhueHmueHm+eKneeKnueNqeeNpueNp+eNrOeNpeeNq+eNqueRv+eSmueSoOeSlOeSkueSleeSoeeUi+eWgOeYr+eYreeYseeYveeYs+eYvOeYteeYsueYsOeau+ebpueemueeneeeoeeenOeem+eeoueeo+eeleeemVwiXSxcbltcImVhYTFcIixcIueel+ejneejqeejpeejquejnuejo+ejm+ejoeejouejreejn+ejoOempOephOepiOeph+eqtuequOeqteeqseeqt+evnuevo+evp+evneevleevpeevmuevqOevueevlOevquevouevnOevq+evmOevn+ezkuezlOezl+ezkOezkee4kue4oee4l+e4jOe4n+e4oOe4k+e4jue4nOe4lee4mue4oue4i+e4j+e4lue4jee4lOe4pee4pOe9g+e9u+e9vOe9uue+see/r+iAquiAqeiBrOiGseiGpuiGruiGueiGteiGq+iGsOiGrOiGtOiGsuiGt+iGp+iHsuiJleiJluiJl+iVluiVheiVq+iVjeiVk+iVoeiVmFwiXSxcbltcImViNDBcIixcIuiVgOiVhuiVpOiVgeiVouiVhOiVkeiVh+iVo+iUvuiVm+iVseiVjuiVruiVteiVleiVp+iVoOiWjOiVpuiVneiVlOiVpeiVrOiZo+iZpeiZpOiem+iej+iel+iek+iekuieiOiegeieluiemOidueieh+ieo+ieheiekOiekeieneiehOielOienOiemuieieiknuikpuiksOikreikruikp+ikseikouikqeiko+ikr+ikrOikn+inseiroFwiXSxcbltcImViYTFcIixcIuirouirsuirtOirteirneislOirpOirn+irsOiriOirnuiroeirqOirv+irr+iru+iykeiykuiykOizteizruizseizsOizs+i1rOi1rui2pei2p+i4s+i4vui4uOi5gOi5hei4tui4vOi4vei5gei4sOi4v+i6vei8tui8rui8tei8sui8uei8t+i8tOmBtumBuemBu+mChumDuumEs+mEtemEtumGk+mGkOmGkemGjemGj+mMp+mMnumMiOmMn+mMhumMj+mNuumMuOmMvOmMm+mMo+mMkumMgemNhumMremMjumMjemLi+mMnemLuumMpemMk+mLuemLt+mMtOmMgumMpOmLv+mMqemMuemMtemMqumMlOmMjFwiXSxcbltcImVjNDBcIixcIumMi+mLvumMiemMgOmLu+mMlumWvOmXjemWvumWuemWuumWtumWv+mWtemWvemaqemblOmci+mckumckOmememel+melOmfsOmfuOmgtemgr+mgsumkpOmkn+mkp+mkqemmnumnrumnrOmnpemnpOmnsOmno+mnqumnqemnp+mquemqv+mqtOmqu+mrtumruumruemrt+mss+mugOmuhemuh+mtvOmtvumtu+mugumuk+mukumukOmtuumulVwiXSxcbltcImVjYTFcIixcIumtvemuiOm0pem0l+m0oOm0num0lOm0qem0nem0mOm0oum0kOm0mem0n+m6iOm6hum6h+m6rum6rem7lem7lum7uum8kum8veWEpuWEpeWEouWEpOWEoOWEqeWLtOWak+WajOWajeWahuWahOWag+WZvuWaguWZv+WageWjluWjlOWjj+WjkuWsreWspeWssuWso+WsrOWsp+WspuWsr+WsruWtu+WvseWvsuW2t+W5rOW5quW+vuW+u+aHg+aGteaGvOaHp+aHoOaHpeaHpOaHqOaHnuaTr+aTqeaTo+aTq+aTpOaTqOaWgeaWgOaWtuaXmuabkuaqjeaqluaqgeaqpeaqieaqn+aqm+aqoeaqnuaqh+aqk+aqjlwiXSxcbltcImVkNDBcIixcIuaqleaqg+aqqOaqpOaqkeapv+aqpuaqmuaqheaqjOaqkuatm+aureawiea/jOa+qea/tOa/lOa/o+a/nOa/rea/p+a/pua/nua/sua/nea/oua/qOeHoeeHseeHqOeHsueHpOeHsOeHoueNs+eNrueNr+eSl+eSsueSq+eSkOeSqueSreeSseeSpeeSr+eUkOeUkeeUkueUj+eWhOeZg+eZiOeZieeZh+eapOebqeeeteeeq+eesueet+eetlwiXSxcbltcImVkYTFcIixcIueetOeeseeeqOefsOejs+ejveekgueju+ejvOejsuekheejueejvuekhOemq+emqOepnOepm+epluepmOeplOepmueqvuergOergeewheewj+evsuewgOevv+evu+ewjuevtOewi+evs+ewguewieewg+ewgeevuOevveewhuevsOevseewkOewiuezqOe4ree4vOe5gue4s+mhiOe4uOe4que5iee5gOe5h+e4qee5jOe4sOe4u+e4tue5hOe4uue9hee9v+e9vue9vee/tOe/suiArOiGu+iHhOiHjOiHiuiHheiHh+iGvOiHqeiJm+iJmuiJnOiWg+iWgOiWj+iWp+iWleiWoOiWi+iWo+iVu+iWpOiWmuiWnlwiXSxcbltcImVlNDBcIixcIuiVt+iVvOiWieiWoeiVuuiVuOiVl+iWjuiWluiWhuiWjeiWmeiWneiWgeiWouiWguiWiOiWheiVueiVtuiWmOiWkOiWn+iZqOievuiequiereifheiesOierOieueieteievOieruifieifg+ifguifjOiet+ier+ifhOifiuietOietuiev+ieuOieveifnuiesuikteiks+ikvOikvuilgeilkuikt+ilguimreimr+imruinsuins+isnlwiXSxcbltcImVlYTFcIixcIuismOisluiskeisheisi+isouisj+iskuisleish+isjeisiOishuisnOisk+ismuixj+ixsOixsuixseixr+iyleiylOizuei1r+i5jui5jei5k+i5kOi5jOi5h+i9g+i9gOmChemBvumEuOmGmumGoumGm+mGmemGn+mGoemGnemGoOmOoemOg+mOr+mNpOmNlumNh+mNvOmNmOmNnOmNtumNiemNkOmNkemNoOmNremOj+mNjOmNqumNuemNl+mNlemNkumNj+mNsemNt+mNu+mNoemNnumNo+mNp+mOgOmNjumNmemXh+mXgOmXiemXg+mXhemWt+marumasOmarOmcoOmcn+mcmOmcnemcmememumeoemenFwiXSxcbltcImVmNDBcIixcIumenumenemflemflOmfsemhgemhhOmhiumhiemhhemhg+mkpemkq+mkrOmkqumks+mksumkr+mkremksemksOmmmOmmo+mmoemogumnuumntOmnt+mnuemnuOmntumnu+mnvemnvumnvOmog+mqvumrvumrvemsgemrvOmtiOmumumuqOmunumum+mupumuoemupemupOmuhumuoumuoOmur+m0s+m1gem1p+m0tum0rum0r+m0sem0uOm0sFwiXSxcbltcImVmYTFcIixcIum1hem1gum1g+m0vum0t+m1gOm0vee/tem0rem6ium6iem6jem6sOm7iOm7mum7u+m7v+m8pOm8o+m8oum9lOm+oOWEseWEreWEruWamOWanOWal+WamuWaneWameWlsOWsvOWxqeWxquW3gOW5reW5ruaHmOaHn+aHreaHruaHseaHquaHsOaHq+aHluaHqeaTv+aUhOaTveaTuOaUgeaUg+aTvOaWlOaXm+abmuabm+abmOarheaqueaqvearoearhuaquuaqtuaqt+arh+aqtOaqreatnuavieawi+eAh+eAjOeAjeeAgeeAheeAlOeAjua/v+eAgOa/u+eApua/vOa/t+eAiueIgeeHv+eHueeIg+eHveeNtlwiXSxcbltcImYwNDBcIixcIueSuOeTgOeSteeTgeeSvueStueSu+eTgueUlOeUk+eZnOeZpOeZmeeZkOeZk+eZl+eZmueapueaveebrOefgueeuuejv+ekjOekk+eklOekieekkOekkuekkeemreemrOepn+ewnOewqeewmeewoOewn+ewreewneewpuewqOewouewpeewsOe5nOe5kOe5lue5o+e5mOe5oue5n+e5kee5oOe5l+e5k+e+tee+s+e/t+e/uOiBteiHkeiHklwiXSxcbltcImYwYTFcIixcIuiHkOiJn+iJnuiWtOiXhuiXgOiXg+iXguiWs+iWteiWveiXh+iXhOiWv+iXi+iXjuiXiOiXheiWseiWtuiXkuiYpOiWuOiWt+iWvuiZqeifp+ifpuifouifm+ifq+ifquifpeifn+ifs+ifpOiflOifnOifk+ifreifmOifo+iepOifl+ifmeiggeiftOifqOifneilk+ili+ilj+iljOilhuilkOilkeilieisquisp+iso+iss+issOisteith+isr+isvOisvuisseispeist+ispuistuisruispOisu+isveisuuixguixteiymeiymOiyl+izvui0hOi0gui0gOi5nOi5oui5oOi5l+i5lui5nui5pei5p1wiXSxcbltcImYxNDBcIixcIui5m+i5mui5oei5nei5qei5lOi9hui9h+i9iOi9i+mEqOmEuumEu+mEvumGqOmGpemGp+mGr+mGqumOtemOjOmOkumOt+mOm+mOnemOiemOp+mOjumOqumOnumOpumOlemOiOmOmemOn+mOjemOsemOkemOsumOpOmOqOmOtOmOo+mOpemXkumXk+mXkemas+mbl+mbmuW3gumbn+mbmOmbnemco+mcoumcpemerOmerumeqOmeq+mepOmeqlwiXSxcbltcImYxYTFcIixcIumeoumepemfl+mfmemflumfmOmfuumhkOmhkemhkumiuOmlgemkvOmkuumoj+moi+moiemojemohOmokemoiumohemoh+mohumrgOmrnOmsiOmshOmshemsqemstemtiumtjOmti+mvh+mvhumvg+muv+mvgemutemuuOmvk+mutumvhOmuuemuvem1nOm1k+m1j+m1ium1m+m1i+m1mem1lum1jOm1l+m1kum1lOm1n+m1mOm1mum6jum6jOm7n+m8gem8gOm8lum8pem8q+m8qum8qem8qOm9jOm9leWEtOWEteWKluWLt+WOtOWaq+WareWapuWap+WaquWarOWjmuWjneWjm+WkkuWsveWsvuWsv+W3g+W5sFwiXSxcbltcImYyNDBcIixcIuW+v+aHu+aUh+aUkOaUjeaUieaUjOaUjuaWhOaXnuaXneabnuarp+aroOarjOarkearmeari+arn+arnOarkOarq+arj+arjearnuatoOausOawjOeAmeeAp+eAoOeAlueAq+eAoeeAoueAo+eAqeeAl+eApOeAnOeAqueIjOeIiueIh+eIgueIheeKpeeKpueKpOeKo+eKoeeTi+eTheeSt+eTg+eUlueZoOefieefiuefhOefseekneekm1wiXSxcbltcImYyYTFcIixcIuekoeeknOekl+eknuemsOepp+epqOews+ewvOewueewrOewu+ezrOezque5tue5tee5uOe5sOe5t+e5r+e5uue5sue5tOe5qOe9i+e9iue+g+e+hue+t+e/vee/vuiBuOiHl+iHleiJpOiJoeiJo+iXq+iXseiXreiXmeiXoeiXqOiXmuiXl+iXrOiXsuiXuOiXmOiXn+iXo+iXnOiXkeiXsOiXpuiXr+iXnuiXouiggOifuuigg+iftuift+igieigjOigi+ighuifvOigiOifv+igiuigguilouilmuilm+ill+iloeilnOilmOilneilmeimiOimt+imtuintuitkOitiOitiuitgOitk+itluitlOiti+itlVwiXSxcbltcImYzNDBcIixcIuitkeitguitkuitl+ixg+ixt+ixtuiymui0hui0h+i0iei2rOi2qui2rei2q+i5rei5uOi5s+i5qui5r+i5u+i7gui9kui9kei9j+i9kOi9k+i+tOmFgOmEv+mGsOmGremPnumPh+mPj+mPgumPmumPkOmPuemPrOmPjOmPmemOqemPpumPiumPlOmPrumPo+mPlemPhOmPjumPgOmPkumPp+mVvemXmumXm+mboemcqemcq+mcrOmcqOmcplwiXSxcbltcImYzYTFcIixcIumes+met+metumfnemfnumfn+mhnOmhmemhnemhl+miv+mivemiu+mivumliOmlh+mlg+mmpummp+momumolemopemonemopOmom+mooumooOmop+moo+monumonOmolOmrgumsi+msiumsjumsjOmst+mvqumvq+mvoOmvnumvpOmvpumvoumvsOmvlOmvl+mvrOmvnOmvmemvpemvlemvoemvmum1t+m2gem2ium2hOm2iOm1sem2gOm1uOm2hum2i+m2jOm1vem1q+m1tOm1tem1sOm1qem2hem1s+m1u+m2gum1r+m1uem1v+m2h+m1qOm6lOm6kem7gOm7vOm8rem9gOm9gem9jem9lum9l+m9mOWMt+WaslwiXSxcbltcImY0NDBcIixcIuWateWas+Wjo+WtheW3huW3h+W7ruW7r+W/gOW/geaHueaUl+aUluaUleaUk+aXn+abqOabo+abpOars+arsOarquarqOaruearsearruarr+eAvOeAteeAr+eAt+eAtOeAseeBgueAuOeAv+eAuueAueeBgOeAu+eAs+eBgeeIk+eIlOeKqOeNveeNvOeSuueaq+eaqueavuebreefjOefjuefj+efjeefsuekpeeko+ekp+ekqOekpOekqVwiXSxcbltcImY0YTFcIixcIuemsueprueprOepreert+exieexiOexiuexh+exheezrue5u+e5vue6gee6gOe+uue/v+iBueiHm+iHmeiIi+iJqOiJqeiYouiXv+iYgeiXvuiYm+iYgOiXtuiYhOiYieiYheiYjOiXveigmeigkOigkeigl+igk+igluilo+ilpuimueint+itoOitquitneitqOito+itpeitp+itrei2rui6hui6iOi6hOi9mei9lui9l+i9lei9mOi9mumCjemFg+mFgemGt+mGtemGsumGs+mQi+mQk+mPu+mQoOmQj+mQlOmPvumQlemQkOmQqOmQmemQjemPtemQgOmPt+mQh+mQjumQlumQkumPuumQiemPuOmQiumPv1wiXSxcbltcImY1NDBcIixcIumPvOmQjOmPtumQkemQhumXnumXoOmXn+mcrumcr+meuemeu+mfvemfvumhoOmhoumho+mhn+mjgemjgumlkOmljumlmemljOmli+mlk+mosumotOmosemorOmoqumotumoqemorumouOmoremrh+mriumrhumskOmskumskemwi+mwiOmvt+mwhemwkumvuOmxgOmwh+mwjumwhumwl+mwlOmwiem2n+m2mem2pOm2nem2kum2mOm2kOm2m1wiXSxcbltcImY1YTFcIixcIum2oOm2lOm2nOm2qum2l+m2oem2mum2oum2qOm2num2o+m2v+m2qem2lum2pum2p+m6mem6m+m6mum7pem7pOm7p+m7pum8sOm8rum9m+m9oOm9num9nem9mem+keWEuuWEueWKmOWKl+Wbg+WaveWavuWtiOWth+W3i+W3j+W7seaHveaUm+asguarvOasg+aruOasgOeBg+eBhOeBiueBiOeBieeBheeBhueIneeImueImeeNvueUl+eZquefkOekreekseekr+exlOexk+ezsue6iue6h+e6iOe6i+e6hue6jee9jee+u+iAsOiHneiYmOiYquiYpuiYn+iYo+iYnOiYmeiYp+iYruiYoeiYoOiYqeiYnuiYpVwiXSxcbltcImY2NDBcIixcIuigqeigneigm+igoOigpOignOigq+ihiuilreilqeilruilq+inuuitueituOitheituuitu+i0kOi0lOi2r+i6jui6jOi9nui9m+i9nemFhumFhOmFhemGuemQv+mQu+mQtumQqemQvemQvOmQsOmQuemQqumQt+mQrOmRgOmQsemXpemXpOmXo+mctemcuumev+mfoemhpOmjiemjhumjgOmlmOmllumouemovemphumphOmpgumpgemoulwiXSxcbltcImY2YTFcIixcIumov+mrjemslemsl+msmOmslumsuumtkumwq+mwnemwnOmwrOmwo+mwqOmwqemwpOmwoem2t+m2tum2vOm3gem3h+m3ium3j+m2vum3hem3g+m2u+m2tem3jum2uem2uum2rOm3iOm2sem2rem3jOm2s+m3jem2sum5uum6nOm7q+m7rum7rem8m+m8mOm8mum8sem9jum9pem9pOm+kuS6ueWbhuWbheWbi+WlseWti+WtjOW3leW3keW7suaUoeaUoOaUpuaUouasi+asiOasieawjeeBleeBlueBl+eBkueInueIn+eKqeeNv+eTmOeTleeTmeeTl+eZreeareekteemtOepsOepseexl+exnOexmeexm+exmlwiXSxcbltcImY3NDBcIixcIueztOezsee6kee9j+e+h+iHnuiJq+iYtOiYteiYs+iYrOiYsuiYtuigrOigqOigpuigquigpeilseimv+imvuinu+itvuiuhOiuguiuhuiuheitv+i0lei6lei6lOi6mui6kui6kOi6lui6l+i9oOi9oumFh+mRjOmRkOmRiumRi+mRj+mRh+mRhemRiOmRiemRhumcv+mfo+mhqumhqemji+mllOmlm+mpjumpk+mplOmpjOmpj+mpiOmpilwiXSxcbltcImY3YTFcIixcIumpiempkumpkOmrkOmsmemsq+msu+mtlumtlemxhumxiOmwv+mxhOmwuemws+mxgemwvOmwt+mwtOmwsumwvemwtum3m+m3kum3num3mum3i+m3kOm3nOm3kem3n+m3qem3mem3mOm3lum3tem3lem3nem6tum7sOm8tem8s+m8sum9gum9q+m+lem+ouWEveWKmeWjqOWjp+WlsuWtjeW3mOigr+W9j+aIgeaIg+aIhOaUqeaUpeaWluabq+askeaskuasj+aviueBm+eBmueIoueOgueOgeeOg+eZsOeflOexp+expue6leiJrOiYuuiZgOiYueiYvOiYseiYu+iYvuigsOigsuigruigs+iltuiltOils+invlwiXSxcbltcImY4NDBcIixcIuiujOiujuiui+iuiOixhei0mei6mOi9pOi9o+mGvOmRoumRlemRnemRl+mRnumfhOmfhemggOmplumpmemsnumsn+msoOmxkumxmOmxkOmxiumxjemxi+mxlemxmemxjOmxjum3u+m3t+m3r+m3o+m3q+m3uOm3pOm3tum3oem3rum3pum3sum3sOm3oum3rOm3tOm3s+m3qOm3rem7gum7kOm7sum7s+m8hum8nOm8uOm8t+m8tum9g+m9j1wiXSxcbltcImY4YTFcIixcIum9sem9sOm9rum9r+Wbk+WbjeWtjuWxreaUreabreabruask+eBn+eBoeeBneeBoOeIo+eTm+eTpeefleekuOemt+emtuexque6l+e+ieiJreiZg+iguOigt+igteihi+iulOiulei6nui6n+i6oOi6nemGvumGvemHgumRq+mRqOmRqembpemdhumdg+mdh+mfh+mfpempnumrlemtmemxo+mxp+mxpumxoumxnumxoOm4gum3vum4h+m4g+m4hum4hem4gOm4gem4iem3v+m3vem4hOm6oOm8num9hum9tOm9tem9tuWblOaUruaWuOasmOasmeasl+asmueBoueIpueKquefmOefmeekueexqeexq+eztue6mlwiXSxcbltcImY5NDBcIixcIue6mOe6m+e6meiHoOiHoeiZhuiZh+iZiOilueiluuilvOilu+inv+iumOiumei6pei6pOi6o+mRrumRremRr+mRsemRs+mdiemhsumln+mxqOmxrumxrem4i+m4jem4kOm4j+m4kum4kem6oem7tem8iem9h+m9uOm9u+m9uum9ueWcnueBpuexr+igvOi2sui6pumHg+mRtOmRuOmRtumRtempoOmxtOmxs+mxsemxtem4lOm4k+m7tum8ilwiXSxcbltcImY5YTFcIixcIum+pOeBqOeBpeezt+iZquigvuigveigv+iunuiynOi6qei7iemdi+mhs+mhtOmjjOmloemmq+mppOmppumpp+mspOm4lem4l+m9iOaIh+asnueIp+iZjOi6qOmSgumSgOmSgempqempqOmsrum4meeIqeiZi+iun+mSg+mxuem6t+eZtempq+mxuum4neeBqeeBqum6pOm9vum9iem+mOeigemKueijj+Wiu+aBkueyp+WruuKVlOKVpuKVl+KVoOKVrOKVo+KVmuKVqeKVneKVkuKVpOKVleKVnuKVquKVoeKVmOKVp+KVm+KVk+KVpeKVluKVn+KVq+KVouKVmeKVqOKVnOKVkeKVkOKVreKVruKVsOKVr+KWk1wiXVxuXVxuIiwibW9kdWxlLmV4cG9ydHM9W1xuW1wiMFwiLFwiXFx1MDAwMFwiLDEyN10sXG5bXCI4ZWExXCIsXCLvvaFcIiw2Ml0sXG5bXCJhMWExXCIsXCLjgIDjgIHjgILvvIzvvI7jg7vvvJrvvJvvvJ/vvIHjgpvjgpzCtO+9gMKo77y+77+j77y/44O944O+44Kd44Ke44CD5Lud44CF44CG44CH44O84oCV4oCQ77yP77y8772e4oil772c4oCm4oCl4oCY4oCZ4oCc4oCd77yI77yJ44CU44CV77y777y9772b772d44CIXCIsOSxcIu+8i++8jcKxw5fDt++8neKJoO+8nO+8nuKJpuKJp+KInuKItOKZguKZgMKw4oCy4oCz4oSD77+l77yE77+g77+h77yF77yD77yG77yK77ygwqfimIbimIXil4vil4/il47il4dcIl0sXG5bXCJhMmExXCIsXCLil4bilqHilqDilrPilrLilr3ilrzigLvjgJLihpLihpDihpHihpPjgJNcIl0sXG5bXCJhMmJhXCIsXCLiiIjiiIviiobiiofiioLiioPiiKriiKlcIl0sXG5bXCJhMmNhXCIsXCLiiKfiiKjvv6Lih5Lih5TiiIDiiINcIl0sXG5bXCJhMmRjXCIsXCLiiKDiiqXijJLiiILiiIfiiaHiiZLiiariiaviiJriiL3iiJ3iiLXiiKviiKxcIl0sXG5bXCJhMmYyXCIsXCLihKvigLDima/ima3imarigKDigKHCtlwiXSxcbltcImEyZmVcIixcIuKXr1wiXSxcbltcImEzYjBcIixcIu+8kFwiLDldLFxuW1wiYTNjMVwiLFwi77yhXCIsMjVdLFxuW1wiYTNlMVwiLFwi772BXCIsMjVdLFxuW1wiYTRhMVwiLFwi44GBXCIsODJdLFxuW1wiYTVhMVwiLFwi44KhXCIsODVdLFxuW1wiYTZhMVwiLFwizpFcIiwxNixcIs6jXCIsNl0sXG5bXCJhNmMxXCIsXCLOsVwiLDE2LFwiz4NcIiw2XSxcbltcImE3YTFcIixcItCQXCIsNSxcItCB0JZcIiwyNV0sXG5bXCJhN2QxXCIsXCLQsFwiLDUsXCLRkdC2XCIsMjVdLFxuW1wiYThhMVwiLFwi4pSA4pSC4pSM4pSQ4pSY4pSU4pSc4pSs4pSk4pS04pS84pSB4pSD4pSP4pST4pSb4pSX4pSj4pSz4pSr4pS74pWL4pSg4pSv4pSo4pS34pS/4pSd4pSw4pSl4pS44pWCXCJdLFxuW1wiYWRhMVwiLFwi4pGgXCIsMTksXCLihaBcIiw5XSxcbltcImFkYzBcIixcIuONieOMlOOMouONjeOMmOOMp+OMg+OMtuONkeONl+OMjeOMpuOMo+OMq+ONiuOMu+OOnOOOneOOnuOOjuOOj+OPhOOOoVwiXSxcbltcImFkZGZcIixcIuONu+OAneOAn+KEluOPjeKEoeOKpFwiLDQsXCLjiLHjiLLjiLnjjb7jjb3jjbziiZLiiaHiiKviiK7iiJHiiJriiqXiiKDiiJ/iir/iiLXiiKniiKpcIl0sXG5bXCJiMGExXCIsXCLkupzllJblqIPpmL/lk4DmhJvmjKjlp7bpgKLokbXojJznqZDmgqrmj6HmuKXml63okaboiqbpr7XmopPlnKfmlqHmibHlrpvlp5Dombvpo7TntaLntr7pro7miJbnsp/oorflronlurXmjInmmpfmoYjpl4fpno3mnY/ku6XkvIrkvY3kvp3lgYnlm7LlpLflp5TlqIHlsInmg5/mhI/mhbDmmJPmpIXngrrnlY/nlbDnp7vntq3nt6/og4PokI7ooaPorILpgZXpgbrljLvkupXkuqXln5/ogrLpg4Hno6/kuIDlo7HmuqLpgLjnqLLojKjoiovpsK/lhYHljbDlkr3lk6Hlm6Dlp7vlvJXpo7Lmt6vog6TolK1cIl0sXG5bXCJiMWExXCIsXCLpmaLpmbDpmqDpn7vlkIvlj7Plrofng4/nvr3ov4Lpm6jlja/ptZznqrrkuJHnopPoh7zmuKblmJjllITmrJ3olJrpsLvlp6Xljqnmtabnk5zplo/lmYLkupHpgYvpm7LojY/ppIzlj6HllrblrLDlvbHmmKDmm7PmoITmsLjms7PmtKnnkZvnm4jnqY7poLToi7HooZvoqaDpi63mtrLnlqvnm4rpp4XmgqborIHotorplrLmpo7ljq3lhoblnJLloLDlpYTlrrTlu7bmgKjmjqnmj7Tmsr/mvJTngo7nhJTnhZnnh5XnjL/nuIHoibboi5HolpfpgaDpiZvptJvloanmlrzmsZrnlKXlh7nlpK7lpaXlvoDlv5xcIl0sXG5bXCJiMmExXCIsXCLmirzml7rmqKrmrKfmrrTnjovnv4HopZbptKzptI7pu4TlsqHmspbojbvlhITlsYvmhrboh4bmobbniaHkuZnkv7rljbjmganmuKnnqY/pn7PkuIvljJbku67kvZXkvL3kvqHkvbPliqDlj6/lmInlpI/lq4Hlrrblr6Hnp5HmmofmnpzmnrbmrYzmsrPngavnj4Lnpo3npr7nqLznrofoirHoi5vojITojbfoj6/oj5PonaboqrLlmKnosqjov6bpgY7pnJ7omorkv4Tls6jmiJHniZnnlLvoh6Xoir3om77os4Dpm4XppJPpp5Xku4vkvJrop6Plm57loYrlo4rlu7vlv6vmgKrmgpTmgaLmh5DmiJLmi5DmlLlcIl0sXG5bXCJiM2ExXCIsXCLprYHmmabmorDmtbfngbDnlYznmobntbXoiqXon7nplovpmo7osp3lh7Hlir7lpJblkrPlrrPltJbmhajmpoLmtq/noo3ok4vooZfoqbLpjqfpqrjmtazppqjom5nlnqPmn7/om47piI7lioPlmoflkITlu5Pmi6HmkrnmoLzmoLjmrrvnjbLnorrnqavopprop5LotavovIPpg63plqPpmpTpnanlrablsrPmpb3poY3poY7mjpvnrKDmqKvmqb/morbpsI3mvZ/libLllp3mgbDmi6zmtLvmuIfmu5HokZvopJDovYTkuJTpsLnlj7bmpJvmqLrpnoTmoKrlhZznq4PokrLph5zpjozlmZvptKjmoKLojIXokLFcIl0sXG5bXCJiNGExXCIsXCLnsqXliIjoi4Xnk6bkub7kvoPlhqDlr5LliIrli5jli6flt7vllprloKrlp6blrozlrpjlr5vlubLlubnmgqPmhJ/mhaPmhr7mj5vmlaLmn5HmoZPmo7rmrL7mrZPmsZfmvKLmvpfmvYXnkrDnlJjnm6PnnIvnq7/nrqHnsKHnt6nnvLbnv7Dogp3oiabojp7oprPoq4zosqvpgoTpkZHplpPplpHplqLpmaXpn5PppKjoiJjkuLjlkKvlsrjlt4znjqnnmYznnLzlsqnnv6votIvpm4HpoJHpoZTpoZjkvIHkvI7ljbHllpzlmajln7rlpYflrInlr4TlspDluIzlub7lv4zmj67mnLrml5fml6LmnJ/mo4vmo4RcIl0sXG5bXCJiNWExXCIsXCLmqZ/luLDmr4XmsJfmsb3nlb/npYjlraPnqIDntIDlvr3opo/oqJjosrTotbfou4zovJ3po6LpqI7prLzkuoDlgb3lhIDlppPlrpzmiK/mioDmk6zmrLrniqDnlpHnpYfnvqnon7voqrzorbDmjqzoj4rpnqDlkInlkIPllqvmoZTmqZjoqbDnoKfmnbXpu43ljbTlrqLohJromZDpgIbkuJjkuYXku4fkvJHlj4rlkLjlrq7lvJPmgKXmlZHmnL3msYLmsbLms6PngbjnkIPnqbbnqq7nrIjntJrns77ntabml6fniZvljrvlsYXlt6jmi5Lmi6DmjJnmuKDomZroqLHot53pi7jmvIHnpqbprZrkuqjkuqvkuqxcIl0sXG5bXCJiNmExXCIsXCLkvpvkvqDlg5HlhYfnq7blhbHlh7bljZTljKHljb/lj6vllqzlooPls6HlvLflvYrmgK/mgZDmga3mjJ/mlZnmqYvms4Hni4Lni63nn6/og7johIXoiIjolY7pg7fpj6Hpn7/ppZfpqZrku7Dlh53lsK3mmoHmpa3lsYDmm7LmpbXnjonmoZDnsoHlg4Xli6TlnYflt77pjKbmlqTmrKPmrL3nkLTnpoHnpr3nrYvnt4roirnoj4zoob/opZ/orLnov5Hph5HlkJ/pioDkuZ3lgLblj6XljLrni5fnjpbnn6noi6bouq/pp4bpp4jpp5LlhbfmhJromZ7llrDnqbrlgbblr5PpgYfpmoXkuLLmq5vph6flsZHlsYhcIl0sXG5bXCJiN2ExXCIsXCLmjpjnqp/mspPpnbTovaHnqqrnhorpmojnsoLmoJfnubDmoZHpjazli7LlkJvolqvoqJPnvqTou43pg6HljabooojnpYHkv4Llgr7liJHlhYTllZPlnK3nj6rlnovlpZHlvaLlvoTmgbXmhbbmhafmhqnmjrLmkLrmlazmma/moYLmuJPnlabnqL3ns7vntYzntpnnuYvnvavojI7ojYrom43oqIjoqaPorabou73poJrpto/oirjov47pr6jliofmiJ/mkoPmv4DpmpnmoYHlgpHmrKDmsbrmvZTnqbTntZDooYDoqKPmnIjku7blgLnlgKblgaXlhbzliLjliaPllqflnI/loIXlq4zlu7rmhrLmh7jmi7PmjbJcIl0sXG5bXCJiOGExXCIsXCLmpJzmqKnnib3niqznjK7noJTnoa/ntbnnnIzogqnopovorJnos6Lou5LpgaPpjbXpmbrpoZXpqJPpubjlhYPljp/ljrPlubvlvKbmuJvmupDnjoTnj77ntYPoiLfoqIDoq7rpmZDkuY7lgIvlj6Tlkbzlm7rlp5HlraTlt7HluqvlvKfmiLjmlYXmnq/muZbni5Dns4roorTogqHog6Hoj7DomY7oqofot6jpiLfpm4fpoafpvJPkupTkupLkvI3ljYjlkYnlkL7lqK/lvozlvqHmgp/moqfmqo7nkZrnooHoqp7oqqTorbfphpDkuZ7pr4nkuqTkvbzkvq/lgJnlgJblhYnlhazlip/lirnli77ljprlj6PlkJFcIl0sXG5bXCJiOWExXCIsXCLlkI7llonlnZHlnqLlpb3lrZTlrZ3lro/lt6Xlt6flt7flubjluoPluprlurflvJjmgZLmhYzmipfmi5jmjqfmlLvmmILmmYPmm7Tmna3moKHmopfmp4vmsZ/mtKrmtanmuK/mup3nlLLnmofnoaznqL/ns6DntIXntJjntZ7ntrHogJXogIPogq/ogrHohZToho/oiKrojZLooYzooaHorJvosqLos7zpg4rphbXpibHnoL/pi7zplqTpmY3poIXpppnpq5jptLvliZvliqvlj7flkIjlo5Xmi7fmv6DosarovZ/purnlhYvliLvlkYrlm73nqYDphbfptaDpu5LnjYTmvInohbDnlJHlv73mg5rpqqjni5vovrxcIl0sXG5bXCJiYWExXCIsXCLmraTpoIPku4rlm7DlnaTlor7lqZrmgajmh4fmmI/mmIbmoLnmorHmt7fnl5XntLroia7prYLkupvkvZDlj4nllIblta/lt6blt67mn7vmspnnkbPnoILoqZDpjpboo5/lnZDluqfmjKvlgrXlgqzlho3mnIDlk4nloZ7lprvlrrDlvanmiY3mjqHmoL3mrbPmuIjngb3ph4fnioDnoJXnoKbnpa3mlo7ntLDoj5zoo4HovInpmpvliaTlnKjmnZDnvarosqHlhrTlnYLpmKrloLrmporogrTlkrLltI7ln7znopXpt7rkvZzliYrlkovmkL7mmKjmnJTmn7XnqoTnrZbntKLpjK/moZzprq3nrLnljJnlhorliLdcIl0sXG5bXCJiYmExXCIsXCLlr5/mi7bmkq7mk6bmnK3mrrrolqnpm5HnmpDpr5bmjYzpjIbprqvnmr/mmZLkuInlgpjlj4LlsbHmg6jmkpLmlaPmoZ/nh6bnj4rnlKPnrpfnuoLompXoroPos5vphbjppJDmlqzmmqvmrovku5Xku5TkvLrkvb/liLrlj7jlj7Lll6Plm5vlo6vlp4vlp4nlp7/lrZDlsY3luILluKvlv5fmgJ3mjIfmlK/lrZzmlq/mlr3ml6jmnp3mraLmrbvmsI/njYXnpYnnp4Hns7jntJnntKvogqLohILoh7PoppboqZ7oqanoqaboqozoq67os4fos5zpm4zpo7zmra/kuovkvLzkvo3lhZDlrZflr7rmhYjmjIHmmYJcIl0sXG5bXCJiY2ExXCIsXCLmrKHmu4vmsrvniL7nkr3nl5Tno4HnpLrogIzogLPoh6rokpTovp7msZDpub/lvI/orZjptKvnq7rou7jlro3pm6vkuIPlj7Hln7flpLHlq4nlrqTmgonmub/mvIbnlr7os6rlrp/olIDnr6DlgbLmn7Toip3lsaHolYrnuJ7oiI7lhpnlsITmjajotabmlpznha7npL7ntJfogIXorJ3ou4rpga7om4fpgqrlgJ/li7rlsLrmnZPngbzniLXphYzph4jpjKvoi6Xlr4LlvLHmg7nkuLvlj5blrojmiYvmnLHmrorni6nnj6DnqK7ohavotqPphZLpppblhJLlj5flkarlr7/mjojmqLnntqzpnIDlm5rlj47lkahcIl0sXG5bXCJiZGExXCIsXCLlrpflsLHlt57kv67mhIHmi77mtLLnp4Dnp4vntYLnuY3nv5Loh63oiJ/okpDooYbopbLorpDoubTovK/pgLHphYvphazpm4bphpzku4DkvY/lhYXljYHlvpPmiI7mn5TmsYHmuIvnjaPnuKbph43pioPlj5TlpJnlrr/mt5HnpZ3nuK7nspvlob7nhp/lh7rooZPov7Dkv4rls7vmmKXnnqznq6PoiJzpp7/lh4blvqrml6zmpa/mronmt7PmupbmvaTnm77ntJTlt6HpgbXphofpoIblh6bliJ3miYDmmpHmm5nmuJrlurbnt5LnvbLmm7jolq/ol7foq7jliqnlj5nlpbPluo/lvpDmgZXpi6TpmaTlgrflhJ9cIl0sXG5bXCJiZWExXCIsXCLli53ljKDljYflj6zlk6jllYbllLHlmJflpajlpr7lqLzlrrXlsIblsI/lsJHlsJrluoTluorlu6DlvbDmib/mioTmi5vmjozmjbfmmIfmmIzmmK3mmbbmnb7moqLmqJ/mqLXmsrzmtojmuInmuZjnhLznhKbnhafnl4fnnIHnoZ3npIHnpaXnp7Dnq6DnrJHnsqfntLnogpboj5bokovolYnooZ3oo7PoqJ/oqLzoqZToqbPosaHos57phqTpiabpjb7pkJjpmpzpnpjkuIrkuIjkuJ7kuZflhpflibDln47loLTlo4zlrKLluLjmg4Xmk77mnaHmnZbmtYTnirbnlbPnqaPokrjorbLphrjpjKDlmLHln7Tpo75cIl0sXG5bXCJiZmExXCIsXCLmi63mpI3mrpbnh63nuZTogbfoibLop6bpo5/onZXovrHlsLvkvLjkv6HkvrXllIflqKDlr53lr6nlv4PmhY7mjK/mlrDmmYvmo67mppvmtbjmt7HnlLPnlrnnnJ/npZ7np6bntLPoh6Poiq/olqropqroqLrouqvovpvpgLLph53pnIfkurrku4HliIPlobXlo6zlsIvnlJrlsL3ohY7oqIrov4XpmaPpna3nrKXoq4/poIjphaLlm7PljqjpgJflkLnlnoLluKXmjqjmsLTngornnaHnsovnv6DoobDpgYLphZTpjJDpjJjpmo/nkZ7pq4TltIfltanmlbDmnqLotqjpm5vmja7mnYnmpJnoj4XpoJfpm4Doo75cIl0sXG5bXCJjMGExXCIsXCLmvoTmkbrlr7jkuJbngKznlZ3mmK/lh4TliLbli6Llp5PlvoHmgKfmiJDmlL/mlbTmmJ/mmbTmo7LmoJbmraPmuIXnibLnlJ/nm5vnsr7ogZblo7Doo73opb/oqqDoqpPoq4vpgJ3phpLpnZLpnZnmlonnqI7ohIbpmrvluK3mg5zmiJrmlqXmmJTmnpDnn7PnqY3nsY3nuL7ohIrosqzotaTot6HouZ/noqnliIfmi5nmjqXmkYLmipjoqK3nqoPnr4Doqqzpm6rntbboiIzonYnku5nlhYjljYPljaDlrqPlsILlsJblt53miKbmiYfmkrDmoJPmoLTms4nmtYXmtJfmn5PmvZznhY7nhb3ml4vnqb/nrq3nt5pcIl0sXG5bXCJjMWExXCIsXCLnuYrnvqjohbroiJvoiLnolqboqa7os47ot7Xpgbjpgbfpiq3pipHploPprq7liY3lloTmvLjnhLblhajnpoXnuZXohrPns47lmYzloZHlsqjmjqrmm77mm73mpZrni5nnlo/nlo7npI7npZbnp5/nspfntKDntYTomIfoqLTpmLvpgaHpvKDlg6flibXlj4zlj6LlgInllqrlo67lpY/niL3lrovlsaTljJ3mg6Pmg7PmjZzmjoPmjL/mjrvmk43ml6nmm7nlt6Pmp43mp73mvJXnh6Xkuonnl6nnm7jnqpPns5/nt4/ntpzogaHojYnojZjokazokrzol7voo4XotbDpgIHpga3pjpfpnJzpqJLlg4/lopfmho5cIl0sXG5bXCJjMmExXCIsXCLoh5PolLXotIjpgKDkv4PlgbTliYfljbPmga/mjYnmnZ/muKzotrPpgJ/kv5flsZ7os4rml4/ntprljZLoopblhbbmj4PlrZjlravlsIrmkI3mnZHpgZzku5blpJrlpKrmsbDoqZHllL7loJXlpqXmg7DmiZPmn4HoiLXmpZXpmYDpp4TpqKjkvZPloIblr77ogJDlsrHluK/lvoXmgKDmhYvmiLTmm7/ms7Dmu57og47ohb/oi5TooovosrjpgIDpgK7pmorpu5vpr5vku6Plj7DlpKfnrKzpho3poYzpt7nmu53ngKfljZPllYTlroXmiZjmip7mi5PmsqLmv6/nkKLoqJfpkLjmv4Hoq77ojLjlh6fom7jlj6pcIl0sXG5bXCJjM2ExXCIsXCLlj6nkvYbpgZTovrDlparohLHlt73nq6rovr/mo5rosLfni7jpsYjmqL3oqrDkuLnljZjlmIblnabmi4XmjqLml6bmrY7mt6HmuZvngq3nn63nq6/nrqrntrvogL3og4bom4voqpXpjZvlm6Plo4flvL7mlq3mmpbmqoDmrrXnlLfoq4flgKTnn6XlnLDlvJvmgaXmmbrmsaDnl7TnqJrnva7oh7TonJjpgYXpprPnr4nnlZznq7nnrZHok4TpgJDnp6nnqpLojLblq6HnnYDkuK3ku7Llrpnlv6Dmir3mmLzmn7Hms6jomavoobfoqLvphY7pi7Ppp5DmqJfngKbnjKroi6fokZfosq/kuIHlhYblh4vllovlr7VcIl0sXG5bXCJjNGExXCIsXCLluJbluLPluoHlvJTlvLXlvavlvrTmh7LmjJHmmqLmnJ3mva7niZLnlLrnnLrogbTohLnohbjonbboqr/oq5zotoXot7PpiprplbfpoILps6Xli4XmjZfnm7TmnJXmsojnj43os4Ppjq7pmbPmtKXlopzmpI7mp4zov73pjprnl5vpgJrloZrmoILmjrTmp7vkvYPmvKzmn5jovrvolKbntrTpjZTmpL/mvbDlnarlo7flrKzntKzniKrlkIrph6PptrTkuq3kvY7lgZzlgbXliYPosp7lkYjloKTlrprluJ3lupXluq3lu7flvJ/mgozmirXmjLrmj5Dmoq/msYDnoofnpo7nqIvnt6DoiYfoqILoq6bouYTpgJNcIl0sXG5bXCJjNWExXCIsXCLpgrjphK3ph5jpvI7ms6XmkZjmk6LmlbXmu7TnmoTnrJvpganpj5Hmurrlk7LlvrnmkqTovY3ov63piYTlhbjloavlpKnlsZXlupfmt7vnuo/nlJzosrzou6LpoZvngrnkvJ3mrr/mvrHnlLDpm7vlhY7lkJDloLXloZflpqzlsaDlvpLmlpfmnZzmuKHnmbvoj5/os63pgJTpg73pjY3noKXnoLrliqrluqblnJ/lpbTmgJLlgJLlhZrlhqzlh43liIDllJDloZTloZjlpZflrpXls7bltovmgrzmipXmkK3mnbHmoYPmorzmo5/nm5fmt5jmua/mtpvnga/nh4jlvZPnl5jnpbfnrYnnrZTnrZLns5bntbHliLBcIl0sXG5bXCJjNmExXCIsXCLokaPolanol6ToqI7orITosYbouI/pgIPpgI/pkJnpmbbpoK3pqLDpl5jlg43li5XlkIzloILlsI7mhqfmkp7mtJ7nnrPnq6Xog7TokITpgZPpioXls6DptIfljL/lvpflvrPmtpznibnnnaPnpr/nr6Tmr5Lni6zoqq3moIPmqaHlh7jnqoHmpLTlsYrps7boi6vlr4XphYnngJ7lmbjlsa/mg4fmlabmsozosZrpgYHpoJPlkZHmm4fpiI3lpYjpgqPlhoXkuY3lh6rolpnorI7ngZjmjbrpjYvmpaLpprTnuITnlbfljZfmpaDou5/pm6PmsZ3kuozlsLzlvJDov6nljILos5Hogonombnlu7/ml6XkubPlhaVcIl0sXG5bXCJjN2ExXCIsXCLlpoLlsL/pn67ku7vlporlv43oqo3mv6HnprDnpaLlr6fokbHnjKvnhrHlubTlv7Xmjbvmkprnh4PnspjkuYPlu7zkuYvln5zlmqLmgqnmv4PntI3og73ohLPohr/ovrLoppfomqTlt7Tmiormkq3opofmnbfms6LmtL7nkLbnoLTlqYbnvbXoiq3ppqzkv7Plu4Pmi53mjpLmlZfmna/nm4PniYzog4zogrrovKnphY3lgI3ln7nlqpLmooXmpbPnhaTni73osrflo7Los6DpmarpgJnonb/np6Tnn6fokKnkvK/liaXljZrmi43mn4/ms4rnmb3nrpTnspXoiLboloTov6vmm53mvKDniIbnuJvojqvpp4HpuqZcIl0sXG5bXCJjOGExXCIsXCLlh73nrrHnobLnrrjogofnrYjmq6jluaHogoznlZHnlaDlhavpiaLmuoznmbrphpfpq6rkvJDnvbDmipznrY/plqXps6nlmbrloZnom6TpmrzkvLTliKTljYrlj43lj5vluIbmkKzmlpHmnb/msL7msY7niYjniq/nj63nlZTnuYHoiKzol6nosqnnr4Tph4bnhanpoJLpo6/mjL3mmannlarnm6Tno5DolYPom67ljKrljZHlkKblpoPluoflvbzmgrLmiYnmibnmiqvmlpDmr5Tms4znlrLnmq7nopHnp5jnt4vnvbfogqXooqvoqrnosrvpgb/pnZ7po5vmqIvnsLjlgpnlsL7lvq7mnofmr5jnkLXnnInnvo5cIl0sXG5bXCJjOWExXCIsXCLpvLvmn4rnqJfljLnnlovpq63lvabohp3oj7HogpjlvLzlv4XnlaLnrYbpgLzmoaflp6vlqpvntJDnmb7orKzkv7XlvarmqJnmsLfmvILnk6LnpajooajoqZXosbnlu5/mj4/nl4Xnp5Loi5fpjKjpi7Lokpzom63psK3lk4HlvazmlozmtZzngJXosqfos5PpoLvmlY/nk7bkuI3ku5jln6DlpKvlqablr4zlhqjluIPlupzmgJbmibbmlbfmlqfmma7mta7niLbnrKbohZDohproipnorZzosqDos6botbTpmJzpmYTkvq7mkqvmraboiJ7okaHolarpg6jlsIHmpZPpoqjokbrolZfkvI/lia/lvqnluYXmnI1cIl0sXG5bXCJjYWExXCIsXCLnpo/ohbnopIfopobmt7XlvJfmiZXmsrjku4/nianprpLliIblkLvlmbTlorPmhqTmia7nhJrlpa7nsonns57ntJvpm7DmlofogZ7kuJnkvbXlhbXloYDluaPlubPlvIrmn4TkuKbolL3plonpmZvnsbPpoIHlg7vlo4HnmZbnoqfliKXnnqXolJHnroblgY/lpInniYfnr4fnt6jovrrov5TpgY3kvr/li4nlqKnlvIHpnq3kv53oiJfpi6rlnIPmjZXmrannlKvoo5zovJTnqYLli5/lopPmhZXmiIrmmq7mr43nsL/oj6nlgKPkv7jljIXlkYbloLHlpYnlrp3ls7Dls6/ltKnlupbmirHmjafmlL7mlrnmnItcIl0sXG5bXCJjYmExXCIsXCLms5Xms6Hng7nnoLLnuKvog57oirPokIzok6zonILopJLoqKrosYrpgqbpi5Lpo73ps7PptazkuY/kuqHlgo3liZblnYrlpqjluL3lv5jlv5nmiL/mmrTmnJvmn5Dmo5LlhpLntKHogqrohqjorIDosozosr/pib7pmLLlkKDpoKzljJflg5XljZzloqjmkrLmnLTniafnnabnqYbph6bli4PmsqHmrobloIDluYzlpZTmnKznv7vlh6Hnm4bmkanno6jprZTpurvln4vlprnmmKfmnprmr47lk6nmp5nluZXohpzmnpXprqrmn77psZLmoZ3kuqbkv6Plj4jmirnmnKvmsqvov4Tkvq3nua3pur/kuIfmhaLmuoBcIl0sXG5bXCJjY2ExXCIsXCLmvKvolJPlkbPmnKrprYXlt7PnrpXlsqzlr4bonJzmuYrok5HnqJTohIjlppnnso3msJHnnKDli5nlpKLnhKHniZ/nn5vpnKfptaHmpIvlqb/lqJjlhqXlkI3lkb3mmI7nm5/ov7fpipjps7Tlp6rniZ3mu4XlhY3mo4nntr/nt6zpnaLpurrmkbjmqKHojILlpoTlrZ/mr5vnjJvnm7LntrLogJfokpnlhLLmnKjpu5nnm67mnaLli7/ppIXlsKTmiLvnsb7osrDllY/mgrbntIvploDljIHkuZ/lhrblpJzniLrogLbph47lvKXnn6LljoTlvbnntITolqzoqLPouo3pnZbmn7Polq7pkZPmhInmhIjmsrnnmZJcIl0sXG5bXCJjZGExXCIsXCLoq63ovLjllK/kvZHlhKrli4flj4vlrqXlub3mgqDmhoLmj5bmnInmn5rmuafmtoznjLbnjLfnlLHnpZDoo5XoqpjpgYrpgpHpg7Xpm4Tono3lpJXkuojkvZnkuI7oqonovL/poJDlgq3lubzlppblrrnlurjmj5rmj7rmk4Hmm5zmpYrmp5jmtIvmurbnhpTnlKjnqq/nvorogIDokYnok4nopoHorKHouIrpgaXpmb3ppIrmhb7mipHmrLLmsoPmtbTnv4znv7zmt4DnvoXonrroo7jmnaXojrHpoLzpm7fmtJvntaHokL3pharkubHljbXltZDmrITmv6vol43omK3opqfliKnlkI/lsaXmnY7moqjnkIbnkoNcIl0sXG5bXCJjZWExXCIsXCLnl6Loo4/oo6Hph4zpm6Lpmbjlvovnjofnq4vokY7mjqDnlaXlionmtYHmupznkInnlZnnoavnspLpmobnq5zpvo3kvrbmha7ml4XomZzkuobkuq7lg5rkuKHlh4zlr67mlpnmooHmtrznjJ/nmYLnnq3nqJzns6foia/oq5Lpgbzph4/pmbXpoJjlipvnt5HlgKvljpjmnpfmt4vnh5DnkLPoh6jovKrpmqPpsZfpup/nkaDloYHmtpnntK/poZ7ku6TkvLbkvovlhrflirHltrrmgJznjrLnpLzoi5PpiLTpmrfpm7bpnIrpupfpvaLmmqbmrbTliJfliqPng4joo4Llu4nmgYvmhpDmvKPnhYnnsL7nt7Toga9cIl0sXG5bXCJjZmExXCIsXCLok67pgKPpjKzlkYLpra/mq5Pngonos4Lot6/pnLLlirTlqYHlu4rlvITmnJfmpbzmppTmtarmvI/niaLni7znr63ogIHogb7onYvpg47lha3pupPnpoTogovpjLLoq5blgK3lkozoqbHmraros4TohIfmg5HmnqDpt7LkupnkupjpsJDoqavol4HolajmpIDmub7nopfohZVcIl0sXG5bXCJkMGExXCIsXCLlvIzkuJDkuJXkuKrkuLHkuLbkuLzkuL/kuYLkuZbkuZjkuoLkuoXosavkuoroiJLlvI3kuo7kup7kup/kuqDkuqLkurDkurPkurbku47ku43ku4Tku4bku4Lku5fku57ku63ku5/ku7fkvInkvZrkvLDkvZvkvZ3kvZfkvYfkvbbkvojkvo/kvpjkvbvkvankvbDkvpHkva/kvobkvpblhJjkv5Tkv5/kv47kv5jkv5vkv5Hkv5rkv5Dkv6Tkv6XlgJrlgKjlgJTlgKrlgKXlgIXkvJzkv7blgKHlgKnlgKzkv77kv6/lgJHlgIblgYPlgYfmnIPlgZXlgZDlgYjlgZrlgZblgazlgbjlgoDlgprlgoXlgrTlgrJcIl0sXG5bXCJkMWExXCIsXCLlg4nlg4rlgrPlg4Llg5blg57lg6Xlg63lg6Plg67lg7nlg7XlhInlhIHlhILlhJblhJXlhJTlhJrlhKHlhLrlhLflhLzlhLvlhL/lhYDlhZLlhYzlhZTlhaLnq7jlhanlharlha7lhoDlhoLlm5jlhozlhonlho/lhpHlhpPlhpXlhpblhqTlhqblhqLlhqnlhqrlhqvlhrPlhrHlhrLlhrDlhrXlhr3lh4Xlh4nlh5vlh6DomZXlh6nlh63lh7Dlh7Xlh77liITliIvliJTliI7liKfliKrliK7liLPliLnliY/liYTliYvliYzliZ7liZTliarlibTlianlibPlib/lib3lio3lipTlipLlibHliojlipHovqhcIl0sXG5bXCJkMmExXCIsXCLovqfliqzliq3lirzlirXli4Hli43li5fli57li6Pli6bpo63li6Dli7Pli7Xli7jli7nljIbljIjnlLjljI3ljJDljI/ljJXljJrljKPljK/ljLHljLPljLjljYDljYbljYXkuJfljYnljY3lh5bljZ7ljanlja7lpJjljbvljbfljoLljpbljqDljqbljqXljq7ljrDljrblj4PnsJLpm5nlj5/mm7znh67lj67lj6jlj63lj7rlkIHlkL3lkYDlkKzlkK3lkLzlkK7lkLblkKnlkJ3lkY7lko/lkbXlko7lkZ/lkbHlkbflkbDlkpLlkbvlkoDlkbblkoTlkpDlkoblk4flkqLlkrjlkqXlkqzlk4Tlk4jlkqhcIl0sXG5bXCJkM2ExXCIsXCLlkqvlk4LlkqTlkr7lkrzlk5jlk6Xlk6bllI/llJTlk73lk67lk63lk7rlk6LllLnllYDllaPllYzllK7llZzllYXllZbllZfllLjllLPllZ3llpnlloDlkq/llorllp/llbvllb7llpjllp7llq7llbzlloPllqnllofllqjll5rll4Xll5/ll4Tll5zll6Tll5TlmJTll7flmJbll77ll73lmJvll7nlmY7lmZDnh5/lmLTlmLblmLLlmLjlmavlmaTlmK/lmazlmarlmoblmoDlmorlmqDlmpTlmo/lmqXlmq7lmrblmrTlm4Llmrzlm4Hlm4Plm4Dlm4jlm47lm5Hlm5Plm5flm67lm7nlnIDlm7/lnITlnIlcIl0sXG5bXCJkNGExXCIsXCLlnIjlnIvlnI3lnJPlnJjlnJbll4flnJzlnKblnLflnLjlnY7lnLvlnYDlnY/lnanln4DlnojlnaHlnb/lnonlnpPlnqDlnrPlnqTlnqrlnrDln4Pln4bln5Tln5Lln5PloIrln5bln6PloIvloJnloJ3lobLloKHloaLloYvlobDmr4DloZLloL3lobnlooXlornlop/loqvlorrlo57lorvlorjloq7lo4Xlo5Plo5Hlo5flo5nlo5jlo6Xlo5zlo6Tlo5/lo6/lo7rlo7nlo7vlo7zlo73lpILlpIrlpJDlpJvmoqblpKXlpKzlpK3lpLLlpLjlpL7nq5LlpZXlpZDlpY7lpZrlpZjlpaLlpaDlpaflpazlpalcIl0sXG5bXCJkNWExXCIsXCLlpbjlpoHlpp3kvZ7kvqvlpqPlprLlp4blp6jlp5zlpo3lp5nlp5rlqKXlqJ/lqJHlqJzlqInlqJrlqYDlqazlqYnlqLXlqLblqaLlqarlqprlqrzlqr7lq4vlq4Llqr3lq6Plq5flq6blq6nlq5blq7rlq7vlrIzlrIvlrJblrLLlq5DlrKrlrLblrL7lrYPlrYXlrYDlrZHlrZXlrZrlrZvlraXlranlrbDlrbPlrbXlrbjmlojlrbrlroDlroPlrqblrrjlr4Plr4flr4nlr5Tlr5Dlr6Tlr6blr6Llr57lr6Xlr6vlr7Dlr7blr7PlsIXlsIflsIjlsI3lsJPlsKDlsKLlsKjlsLjlsLnlsYHlsYblsY7lsZNcIl0sXG5bXCJkNmExXCIsXCLlsZDlsY/lrbHlsazlsa7kuaLlsbblsbnlsozlspHlspTlppvlsqvlsrvlsrblsrzlsrfls4Xlsr7ls4fls5nls6nls73ls7rls63ltozls6rltIvltJXltJfltZzltJ/ltJvltJHltJTltKLltJrltJnltJjltYzltZLltY7ltYvltazltbPltbbltofltoTltoLltqLltp3ltqzltq7ltr3ltpDltrfltrzlt4nlt43lt5Plt5Llt5blt5vlt6vlt7Llt7XluIvluJrluJnluJHluJvluLbluLfluYTluYPluYDluY7luZfluZTluZ/luaLluaTluYflubXlubblubrpurzlub/luqDlu4Hlu4Llu4jlu5Dlu49cIl0sXG5bXCJkN2ExXCIsXCLlu5blu6Plu53lu5rlu5vlu6Llu6Hlu6jlu6nlu6zlu7Hlu7Plu7Dlu7Tlu7jlu77lvIPlvInlvZ3lvZzlvIvlvJHlvJblvKnlvK3lvLjlvYHlvYjlvYzlvY7lvK/lvZHlvZblvZflvZnlvaHlva3lvbPlvbflvoPlvoLlvb/lvorlvojlvpHlvoflvp7lvpnlvpjlvqDlvqjlvq3lvrzlv5blv7vlv6Tlv7jlv7Hlv53mgrPlv7/mgKHmgaDmgJnmgJDmgKnmgI7mgLHmgJvmgJXmgKvmgKbmgI/mgLrmgZrmgYHmgarmgbfmgZ/mgYrmgYbmgY3mgaPmgYPmgaTmgYLmgazmgavmgZnmgoHmgo3mg6fmgoPmgppcIl0sXG5bXCJkOGExXCIsXCLmgoTmgpvmgpbmgpfmgpLmgqfmgovmg6Hmgrjmg6Dmg5PmgrTlv7Dmgr3mg4bmgrXmg5jmhY3mhJXmhIbmg7bmg7fmhIDmg7Tmg7rmhIPmhKHmg7vmg7HmhI3mhI7mhYfmhL7mhKjmhKfmhYrmhL/mhLzmhKzmhLTmhL3mhYLmhYTmhbPmhbfmhZjmhZnmhZrmhavmhbTmha/mhaXmhbHmhZ/mhZ3mhZPmhbXmhpnmhpbmhofmhqzmhpTmhprmhormhpHmhqvmhq7mh4zmh4rmh4nmh7fmh4jmh4Pmh4bmhrrmh4vnvbnmh43mh6bmh6Pmh7bmh7rmh7Tmh7/mh73mh7zmh77miIDmiIjmiInmiI3miIzmiJTmiJtcIl0sXG5bXCJkOWExXCIsXCLmiJ7miKHmiKrmiK7miLDmiLLmiLPmiYHmiY7miZ7miaPmiZvmiaDmiajmibzmioLmionmib7mipLmipPmipbmi5TmioPmipTmi5fmi5Hmirvmi4/mi7/mi4bmk5Tmi4jmi5zmi4zmi4rmi4Lmi4fmipvmi4nmjIzmi67mi7HmjKfmjILmjIjmi6/mi7XmjZDmjL7mjY3mkJzmjY/mjpbmjo7mjoDmjqvmjbbmjqPmjo/mjonmjp/mjrXmjavmjanmjr7mj6nmj4Dmj4bmj6Pmj4nmj5Lmj7bmj4TmkJbmkLTmkIbmkJPmkKbmkLbmlJ3mkJfmkKjmkI/mkafmka/mkbbmkY7mlKrmkpXmkpPmkqXmkqnmkojmkrxcIl0sXG5bXCJkYWExXCIsXCLmk5rmk5Lmk4Xmk4fmkrvmk5jmk4Lmk7Hmk6foiInmk6Dmk6Hmiqzmk6Pmk6/mlKzmk7bmk7Tmk7Lmk7rmlIDmk73mlJjmlJzmlIXmlKTmlKPmlKvmlLTmlLXmlLfmlLbmlLjnlYvmlYjmlZbmlZXmlY3mlZjmlZ7mlZ3mlbLmlbjmloLmloPorormlpvmlp/mlqvmlrfml4Pml4bml4Hml4Tml4zml5Lml5vml5nml6Dml6Hml7HmnbLmmIrmmIPml7vmnbPmmLXmmLbmmLTmmJzmmY/mmYTmmYnmmYHmmZ7mmZ3mmaTmmafmmajmmZ/mmaLmmbDmmoPmmojmmo7mmonmmoTmmpjmmp3mm4Hmmrnmm4nmmr7mmrxcIl0sXG5bXCJkYmExXCIsXCLmm4Tmmrjmm5bmm5rmm6DmmL/mm6bmm6nmm7Dmm7Xmm7fmnI/mnJbmnJ7mnKbmnKfpnLjmnK7mnL/mnLbmnYHmnLjmnLfmnYbmnZ7mnaDmnZnmnaPmnaTmnonmnbDmnqnmnbzmnarmnozmnovmnqbmnqHmnoXmnrfmn6/mnrTmn6zmnrPmn6nmnrjmn6Tmn57mn53mn6Lmn67mnrnmn47mn4bmn6fmqpzmoJ7moYbmoKnmoYDmoY3moLLmoY7morPmoKvmoZnmoaPmobfmob/mop/moo/moq3mopTmop3mopvmooPmqq7mornmobTmorXmoqDmorrmpI/moo3mob7mpIHmo4rmpIjmo5jmpKLmpKbmo6HmpIzmo41cIl0sXG5bXCJkY2ExXCIsXCLmo5Tmo6fmo5XmpLbmpJLmpITmo5fmo6PmpKXmo7nmo6Dmo6/mpKjmpKrmpJrmpKPmpKHmo4bmpbnmpbfmpZzmpbjmpavmpZTmpb7mpa7mpLnmpbTmpL3mpZnmpLDmpaHmpZ7mpZ3mpoHmparmprLmpq7mp5Dmpr/mp4Hmp5Pmpr7mp47lr6jmp4rmp53mprvmp4PmpqfmqK7mppHmpqDmppzmppXmprTmp57mp6jmqILmqJvmp7/mrIrmp7nmp7Lmp6fmqIXmprHmqJ7mp63mqJTmp6vmqIrmqJLmq4HmqKPmqJPmqYTmqIzmqbLmqLbmqbjmqYfmqaLmqZnmqabmqYjmqLjmqKLmqpDmqo3mqqDmqoTmqqLmqqNcIl0sXG5bXCJkZGExXCIsXCLmqpfomJfmqrvmq4Pmq4LmqrjmqrPmqqzmq57mq5Hmq5/mqqrmq5rmq6rmq7vmrIXomJbmq7rmrJLmrJbprLHmrJ/mrLjmrLfnm5zmrLnpo67mrYfmrYPmrYnmrZDmrZnmrZTmrZvmrZ/mraHmrbjmrbnmrb/mroDmroTmroPmro3mrpjmrpXmrp7mrqTmrqrmrqvmrq/mrrLmrrHmrrPmrrfmrrzmr4bmr4vmr5Pmr5/mr6zmr6vmr7Pmr6/pur7msIjmsJPmsJTmsJvmsKTmsKPmsZ7msZXmsaLmsarmsoLmso3msprmsoHmspvmsb7msajmsbPmspLmspDms4Tms7Hms5Pmsr3ms5fms4Xms53msq7msrHmsr5cIl0sXG5bXCJkZWExXCIsXCLmsrrms5vms6/ms5nms6rmtJ/ooY3mtLbmtKvmtL3mtLjmtJnmtLXmtLPmtJLmtIzmtaPmtpPmtaTmtZrmtbnmtZnmto7mtpXmv6TmtoXmt7nmuJXmuIrmtrXmt4fmt6bmtrjmt4bmt6zmt57mt4zmt6jmt5Lmt4Xmt7rmt5nmt6Tmt5Xmt6rmt67muK3mua7muK7muJnmubLmuZ/muL7muKPmuavmuKvmubbmuY3muJ/muYPmuLrmuY7muKTmu7/muJ3muLjmuoLmuqrmupjmu4nmurfmu5Pmur3muq/mu4TmurLmu5Tmu5Xmuo/muqXmu4Lmup/mvYHmvJHngYzmu6zmu7jmu77mvL/mu7LmvLHmu6/mvLLmu4xcIl0sXG5bXCJkZmExXCIsXCLmvL7mvJPmu7fmvobmvbrmvbjmvoHmvoDmva/mvZvmv7Pmva3mvoLmvbzmvZjmvo7mvpHmv4LmvabmvrPmvqPmvqHmvqTmvrnmv4bmvqrmv5/mv5Xmv6zmv5Tmv5jmv7Hmv67mv5vngInngIvmv7rngJHngIHngI/mv77ngJvngJrmvbTngJ3ngJjngJ/ngLDngL7ngLLngZHngaPngpnngpLngq/ng7HngqzngrjngrPngq7ng5/ng4vng53ng5nnhInng73nhJznhJnnhaXnhZXnhojnhabnhaLnhYznhZbnhaznho/nh7vnhoTnhpXnhqjnhqznh5fnhrnnhr7nh5Lnh4nnh5Tnh47nh6Dnh6znh6fnh7Xnh7xcIl0sXG5bXCJlMGExXCIsXCLnh7nnh7/niI3niJDniJvniKjniK3niKzniLDniLLniLvniLzniL/niYDniYbniYvniZjnibTnib7nioLnioHniofnipLnipbniqLniqfnirnnirLni4Pni4bni4Tni47ni5Lni6Lni6Dni6Hni7nni7flgI/njJfnjIrnjJznjJbnjJ3njLTnjK/njKnnjKXnjL7njY7njY/pu5jnjZfnjarnjajnjbDnjbjnjbXnjbvnjbrnj4jnjrPnj47njrvnj4Dnj6Xnj67nj57nkqLnkIXnka/nkKXnj7jnkLLnkLrnkZXnkL/nkZ/nkZnnkYHnkZznkannkbDnkaPnkarnkbbnkb7nkovnkp7nkqfnk4rnk4/nk5Tnj7FcIl0sXG5bXCJlMWExXCIsXCLnk6Dnk6Pnk6fnk6nnk67nk7Lnk7Dnk7Hnk7jnk7fnlITnlIPnlIXnlIznlI7nlI3nlJXnlJPnlJ7nlKbnlKznlLznlYTnlY3nlYrnlYnnlZvnlYbnlZrnlannlaTnlafnlavnla3nlbjnlbbnlobnlofnlbTnlornlonnloLnlpTnlprnlp3nlqXnlqPnl4LnlrPnl4PnlrXnlr3nlrjnlrznlrHnl43nl4rnl5Lnl5nnl6Pnl57nl77nl7/nl7znmIHnl7Dnl7rnl7Lnl7PnmIvnmI3nmInnmJ/nmKfnmKDnmKHnmKLnmKTnmLTnmLDnmLvnmYfnmYjnmYbnmZznmZjnmaHnmaLnmajnmannmarnmafnmaznmbBcIl0sXG5bXCJlMmExXCIsXCLnmbLnmbbnmbjnmbznmoDnmoPnmojnmovnmo7nmpbnmpPnmpnnmprnmrDnmrTnmrjnmrnnmrrnm4Lnm43nm5bnm5Lnm57nm6Hnm6Xnm6fnm6romK/nm7vnnIjnnIfnnITnnKnnnKTnnJ7nnKXnnKbnnJvnnLfnnLjnnYfnnZrnnajnnavnnZvnnaXnnb/nnb7nnbnnno7nnovnnpHnnqDnnp7nnrDnnrbnnrnnnr/nnrznnr3nnrvnn4fnn43nn5fnn5rnn5znn6Pnn67nn7znoIznoJLnpKbnoKDnpKrnoYXnoo7nobTnoobnobznoprnooznoqPnorXnoqrnoq/no5Hno4bno4vno5Tnor7norzno4Xno4rno6xcIl0sXG5bXCJlM2ExXCIsXCLno6fno5rno73no7TnpIfnpJLnpJHnpJnnpKznpKvnpYDnpaDnpZfnpZ/npZrnpZXnpZPnpbrnpb/npornpp3npqfpvYvnpqrnpq7nprPnprnnprrnp4nnp5Xnp6fnp6znp6Hnp6PnqIjnqI3nqJjnqJnnqKDnqJ/npoDnqLHnqLvnqL7nqLfnqYPnqZfnqYnnqaHnqaLnqanpvp3nqbDnqbnnqb3nqojnqpfnqpXnqpjnqpbnqqnnq4jnqrDnqrbnq4Xnq4Tnqr/pgoPnq4fnq4rnq43nq4/nq5Xnq5Pnq5nnq5rnq53nq6Hnq6Lnq6bnq63nq7DnrILnrI/nrIrnrIbnrLPnrJjnrJnnrJ7nrLXnrKjnrLbnrZBcIl0sXG5bXCJlNGExXCIsXCLnrbrnrITnrY3nrIvnrYznrYXnrbXnraXnrbTnrafnrbDnrbHnraznra7nrp3nrpjnrp/nro3nrpznrprnrovnrpLnro/nrZ3nrpnnr4vnr4Hnr4znr4/nrrTnr4bnr53nr6nnsJHnsJTnr6bnr6XnsaDnsIDnsIfnsJPnr7Pnr7fnsJfnsI3nr7bnsKPnsKfnsKrnsJ/nsLfnsKvnsL3nsYznsYPnsZTnsY/nsYDnsZDnsZjnsZ/nsaTnsZbnsaXnsaznsbXnsoPnspDnsqTnsq3nsqLnsqvnsqHnsqjnsrPnsrLnsrHnsq7nsrnnsr3ns4Dns4Xns4Lns5jns5Lns5zns6LprLvns6/ns7Lns7Tns7bns7rntIZcIl0sXG5bXCJlNWExXCIsXCLntILntJzntJXntIrntYXntYvntK7ntLLntL/ntLXntYbntbPntZbntY7ntbLntajnta7ntY/ntaPntpPntonntZvnto/ntb3ntpvntrrntq7ntqPntrXnt4fntr3ntqvnuL3ntqLntq/nt5zntrjntp/ntrDnt5jnt53nt6Tnt57nt7vnt7Lnt6HnuIXnuIrnuKPnuKHnuJLnuLHnuJ/nuInnuIvnuKLnuYbnuabnuLvnuLXnuLnnuYPnuLfnuLLnuLrnuafnuZ3nuZbnuZ7nuZnnuZrnubnnuarnuannubznubvnuoPnt5Xnub3ovq7nub/nuojnuonnuoznupLnupDnupPnupTnupbnuo7nupvnupznvLjnvLpcIl0sXG5bXCJlNmExXCIsXCLnvYXnvYznvY3nvY7nvZDnvZHnvZXnvZTnvZjnvZ/nvaDnvajnvannvafnvbjnvoLnvobnvoPnvojnvofnvoznvpTnvp7nvp3nvprnvqPnvq/nvrLnvrnnvq7nvrbnvrjorbHnv4Xnv4bnv4rnv5Xnv5Tnv6Hnv6bnv6nnv7Pnv7npo5zogIbogITogIvogJLogJjogJnogJzogKHogKjogL/ogLvogYrogYbogZLogZjogZrogZ/ogaLogajogbPogbLogbDogbbogbnogb3ogb/ogoTogobogoXogpvogpPogprogq3lhpDogqzog5vog6Xog5nog53og4Tog5rog5bohInog6/og7HohJvohKnohKPohK/ohYtcIl0sXG5bXCJlN2ExXCIsXCLpmovohYbohL7ohZPohZHog7zohbHoha7ohaXohabohbTohoPohojohorohoDohoLohqDohpXohqTohqPohZ/ohpPohqnohrDohrXohr7ohrjohr3oh4Doh4Lohrroh4noh43oh5Hoh5noh5joh4joh5roh5/oh6Doh6foh7roh7voh77oiIHoiILoiIXoiIfoiIroiI3oiJDoiJboiKnoiKvoiLjoiLPoiYDoiZnoiZjoiZ3oiZroiZ/oiaToiaLoiajoiaroiavoiK7oibHoibfoibjoib7oio3oipLoiqvoip/oirvoiqzoi6Hoi6Poi5/oi5Loi7Toi7Poi7rojpPojIPoi7voi7noi57ojIboi5zojInoi5lcIl0sXG5bXCJlOGExXCIsXCLojLXojLTojJbojLLojLHojYDojLnojZDojYXojK/ojKvojJfojJjojoXojprojqrojp/ojqLojpbojKPojo7ojofojorojbzojrXojbPojbXojqDojonojqjoj7TokJPoj6voj47oj73okIPoj5jokIvoj4Hoj7fokIfoj6Doj7LokI3okKLokKDojr3okLjolIboj7voka3okKrokLzolZrokoTokbfokavokq3oka7okoLokanokYbokKzoka/okbnokLXok4rokaLokrnokr/okp/ok5nok43okrvok5rok5Dok4Hok4bok5bokqHolKHok7/ok7TolJfolJjolKzolJ/olJXolJTok7zolYDolaPolZjolYhcIl0sXG5bXCJlOWExXCIsXCLolYHomILolYvolZXoloDolqTolojolpHolorolqjola3olpTolpvol6rolofolpzolbfolb7olpDol4nolrrol4/olrnol5Dol5Xol53ol6Xol5zol7nomIromJPomIvol77ol7romIbomKLomJromLDomL/omY3kuZXomZTomZ/omafombHompPomqPomqnomqromovomozomrbomq/om4Tom4bomrDom4nooKPomqvom5Tom57om6nom6zom5/om5vom6/onJLonIbonIjonIDonIPom7vonJHonInonI3om7nonIronLTonL/onLfonLvonKXonKnonJronaDonZ/onbjonYzonY7onbTonZfonajona7onZlcIl0sXG5bXCJlYWExXCIsXCLonZPonaPonarooIXonqLonp/onoLonq/on4vonr3on4Don5Dpm5bonqvon4TonrPon4fon4bonrvon6/on7Lon6DooI/ooI3on77on7bon7fooI7on5LooJHooJbooJXooKLooKHooLHooLbooLnooKfooLvooYTooYLooZLooZnooZ7ooaLooavoooHoob7oop7oobXoob3oorXoobLoooLoopfoopLooq7oopnooqLooo3ooqToorDoor/oorHoo4Poo4Too5Too5joo5noo53oo7nopILoo7zoo7Too6joo7LopITopIzopIropJPopYPopJ7opKXopKropKvopYHopYTopLvopLbopLjopYzopJ3opaDopZ5cIl0sXG5bXCJlYmExXCIsXCLopabopaTopa3oparopa/opbTopbfopb7opoPopojoporoppPoppjopqHopqnopqbopqzopq/oprLoprropr3opr/op4Dop5rop5zop53op6fop7Top7joqIPoqJboqJDoqIzoqJvoqJ3oqKXoqLboqYHoqZvoqZLoqYboqYjoqbzoqa3oqazoqaLoqoXoqoLoqoToqqjoqqHoqpHoqqXoqqboqproqqPoq4Toq43oq4Loq5roq6voq7Poq6foq6Toq7HorJToq6Doq6Loq7foq57oq5vorIzorIforJroq6HorJborJDorJforKDorLPpnqvorKborKvorL7orKjorYHorYzorY/orY7orYnorZborZvorZroratcIl0sXG5bXCJlY2ExXCIsXCLorZ/orazora/orbTorb3oroDorozoro7orpLorpPorpborpnorprosLrosYHosL/osYjosYzosY7osZDosZXosaLosazosbjosbrosoLosonosoXosoroso3oso7ospTosbzospjmiJ3osq3osqrosr3osrLosrPosq7osrbos4jos4Hos6Tos6Pos5ros73os7ros7votITotIXotIrotIfotI/otI3otJDpvY7otJPos43otJTotJbotafota3otbHotbPotoHotpnot4Lotr7otrrot4/ot5rot5bot4zot5vot4vot6rot6vot5/ot6Pot7zouIjouInot7/ouJ3ouJ7ouJDouJ/ouYLouLXouLDouLTouYpcIl0sXG5bXCJlZGExXCIsXCLouYfouYnouYzouZDouYjouZnouaTouaDouKrouaPouZXoubboubLoubzouoHouofouoXouoTouovouoroupPoupHoupToupnouqrouqHouqzourDou4bourHour7ou4Xou4jou4vou5vou6Pou7zou7vou6vou77ovIrovIXovJXovJLovJnovJPovJzovJ/ovJvovIzovKbovLPovLvovLnovYXovYLovL7ovYzovYnovYbovY7ovZfovZzovaLovaPovaTovpzovp/ovqPovq3ovq/ovrfov5rov6Xov6Lov6rov6/pgofov7TpgIXov7nov7rpgJHpgJXpgKHpgI3pgJ7pgJbpgIvpgKfpgLbpgLXpgLnov7hcIl0sXG5bXCJlZWExXCIsXCLpgY/pgZDpgZHpgZLpgI7pgYnpgL7pgZbpgZjpgZ7pgajpga/pgbbpmqjpgbLpgoLpgb3pgoHpgoDpgorpgonpgo/pgqjpgq/pgrHpgrXpg6Lpg6TmiYjpg5vphILphJLphJnphLLphLDphYrphZbphZjphaPphaXphanphbPphbLphovphonphoLphqLphqvphq/phqrphrXphrTphrrph4Dph4Hph4nph4vph5Dph5bph5/ph6Hph5vph7zph7Xph7bpiJ7ph7/piJTpiKzpiJXpiJHpiZ7piZfpiYXpiYnpiaTpiYjpipXpiL/piYvpiZDpipzpipbpipPpipvpiZrpi4/pirnpirfpi6npjI/pi7rpjYTpjK5cIl0sXG5bXCJlZmExXCIsXCLpjJnpjKLpjJrpjKPpjLrpjLXpjLvpjZzpjaDpjbzpja7pjZbpjrDpjqzpjq3pjpTpjrnpj5bpj5fpj6jpj6Xpj5jpj4Ppj53pj5Dpj4jpj6TpkJrpkJTpkJPpkIPpkIfpkJDpkLbpkKvpkLXpkKHpkLrpkYHpkZLpkYTpkZvpkaDpkaLpkZ7pkarpiKnpkbDpkbXpkbfpkb3pkZrpkbzpkb7pkoHpkb/ploLplofplorplpTplpbplpjplpnplqDplqjplqfplq3plrzplrvplrnplr7pl4rmv7bpl4Ppl43pl4zpl5Xpl5Tpl5bpl5zpl6Hpl6Xpl6LpmKHpmKjpmK7pmK/pmYLpmYzpmY/pmYvpmbfpmZzpmZ5cIl0sXG5bXCJmMGExXCIsXCLpmZ3pmZ/pmabpmbLpmazpmo3pmpjpmpXpmpfpmqrpmqfpmrHpmrLpmrDpmrTpmrbpmrjpmrnpm47pm4vpm4npm43opY3pm5zpnI3pm5Xpm7npnITpnIbpnIjpnJPpnI7pnJHpnI/pnJbpnJnpnKTpnKrpnLDpnLnpnL3pnL7pnYTpnYbpnYjpnYLpnYnpnZzpnaDpnaTpnabpnajli5LpnavpnbHpnbnpnoXpnbzpnoHpnbrpnobpnovpno/pnpDpnpzpnqjpnqbpnqPpnrPpnrTpn4Ppn4bpn4jpn4vpn5zpn63pvY/pn7Lnq5/pn7bpn7XpoI/poIzpoLjpoKTpoKHpoLfpoL3poYbpoY/poYvpoavpoa/pobBcIl0sXG5bXCJmMWExXCIsXCLpobHpobTpobPpoqrpoq/porHporbpo4Tpo4Ppo4bpo6npo6vppIPppInppJLppJTppJjppKHppJ3ppJ7ppKTppKDppKzppK7ppL3ppL7ppYLppYnppYXppZDppYvppZHppZLppYzppZXpppfpppjppqXppq3ppq7pprzpp5/pp5vpp53pp5jpp5Hpp63pp67pp7Hpp7Lpp7vpp7jpqIHpqI/pqIXpp6LpqJnpqKvpqLfpqYXpqYLpqYDpqYPpqL7pqZXpqY3pqZvpqZfpqZ/pqaLpqaXpqaTpqanpqavpqarpqq3pqrDpqrzpq4Dpq4/pq5Hpq5Ppq5Tpq57pq5/pq6Lpq6Ppq6bpq6/pq6vpq67pq7Tpq7Hpq7dcIl0sXG5bXCJmMmExXCIsXCLpq7vprIbprJjprJrprJ/prKLprKPprKXprKfprKjprKnprKrprK7prK/prLLprYTprYPprY/prY3prY7prZHprZjprbTprpPproPprpHprpbprpfprp/prqDprqjprrTpr4Dpr4rprrnpr4bpr4/pr5Hpr5Lpr6Ppr6Lpr6Tpr5Tpr6HpsLrpr7Lpr7Hpr7DpsJXpsJTpsInpsJPpsIzpsIbpsIjpsJLpsIrpsITpsK7psJvpsKXpsKTpsKHpsLDpsYfpsLLpsYbpsL7psZrpsaDpsafpsbbpsbjps6fps6zps7DptInptIjps6vptIPptIbptKrptKbptq/ptKPptJ/ptYTptJXptJLptYHptL/ptL7ptYbptYhcIl0sXG5bXCJmM2ExXCIsXCLptZ3ptZ7ptaTptZHptZDptZnptbLptonptofptqvpta/ptbrptprptqTptqnptrLpt4Tpt4Hptrvptrjptrrpt4bpt4/pt4Lpt5npt5Ppt7jpt6bpt63pt6/pt73puJrpuJvpuJ7pubXpubnpub3puoHpuojpuovpuozpupLpupXpupHpup3puqXpuqnpurjpuqrpuq3pnaHpu4zpu47pu4/pu5Dpu5Tpu5zpu57pu53pu6Dpu6Xpu6jpu6/pu7Tpu7bpu7fpu7npu7vpu7zpu73pvIfpvIjnmrfpvJXpvKHpvKzpvL7pvYrpvZLpvZTpvaPpvZ/pvaDpvaHpvabpvafpvazpvarpvbfpvbLpvbbpvpXpvpzpvqBcIl0sXG5bXCJmNGExXCIsXCLloK/mp4fpgZnnkaTlh5znhplcIl0sXG5bXCJmOWExXCIsXCLnuoropJzpjYjpiojok5zkv4nngrvmmLHmo4jpi7nmm7vlvYXkuKjku6Hku7zkvIDkvIPkvLnkvZbkvpLkvorkvprkvpTkv43lgYDlgKLkv7/lgJ7lgYblgbDlgYLlgpTlg7Tlg5jlhYrlhaTlhp3lhr7lh6zliJXlipzliqbli4Dli5vljIDljIfljKTljbLljpPljrLlj53vqI7lkpzlkorlkqnlk7/lloblnZnlnaXlnqzln4jln4fvqI/vqJDlop7lorLlpIvlpZPlpZvlpZ3lpaPlpqTlprrlrZblr4DnlK/lr5jlr6zlsJ7lsqblsrrls7XltKfltZPvqJHltYLlta3ltrjltrnlt5DlvKHlvLTlvaflvrdcIl0sXG5bXCJmYWExXCIsXCLlv57mgZ3mgoXmgormg57mg5XmhKDmg7LmhJHmhLfmhLDmhpjmiJPmiqbmj7XmkaDmkp3mk47mlY7mmIDmmJXmmLvmmInmmK7mmJ7mmKTmmaXmmZfmmZnvqJLmmbPmmpnmmqDmmrLmmr/mm7rmnI7vpKnmnabmnrvmoZLmn4DmoIHmoYTmo4/vqJPmpajvqJTmppjmp6LmqLDmqavmqYbmqbPmqb7mq6Lmq6Tmr5bmsL/msZzmsobmsa/ms5rmtITmtofmta/mtpbmtqzmt4/mt7jmt7Lmt7zmuLnmuZzmuKfmuLzmur/mvojmvrXmv7XngIXngIfngKjngoXngqvnhI/nhITnhZznhYbnhYfvqJXnh4Hnh77nirFcIl0sXG5bXCJmYmExXCIsXCLnir7njKTvqJbnjbfnjr3nj4nnj5bnj6Pnj5LnkIfnj7XnkKbnkKrnkKnnkK7nkaLnkonnkp/nlIHnla/nmoLnmpznmp7nmpvnmqbvqJfnnYbliq/noKHnoY7noaTnobrnpLDvqJjvqJnvqJrnppTvqJvnppvnq5Hnq6fvqJznq6vnrp7vqJ3ntYjntZzntrfntqDnt5bnuZLnvYfnvqHvqJ7ojIHojaLojb/oj4foj7bokYjokrTolZPolZnolavvqJ/olrDvqKDvqKHooIfoo7XoqJLoqLfoqbnoqqfoqr7oq5/vqKLoq7borZPorb/os7Dos7TotJLotbbvqKPou4/vqKTvqKXpgafpg57vqKbphJXphKfph5pcIl0sXG5bXCJmY2ExXCIsXCLph5fph57ph63ph67ph6Tph6XpiIbpiJDpiIrpiLrpiYDpiLzpiY7piZnpiZHpiLnpiafpiqfpibfpibjpi6fpi5fpi5npi5DvqKfpi5Xpi6Dpi5PpjKXpjKHpi7vvqKjpjJ7pi7/pjJ3pjILpjbDpjZfpjqTpj4bpj57pj7jpkLHpkYXpkYjplpLvp5zvqKnpmp3pmq/pnLPpnLvpnYPpnY3pnY/pnZHpnZXpoZfpoaXvqKrvqKvppKfvqKzppp7pqY7pq5npq5zprbXprbLpro/prrHprrvpsIDptbDptavvqK3puJnpu5FcIl0sXG5bXCJmY2YxXCIsXCLihbBcIiw5LFwi77+i77+k77yH77yCXCJdLFxuW1wiOGZhMmFmXCIsXCLLmMuHwrjLmcudwq/Lm8ua772ezoTOhVwiXSxcbltcIjhmYTJjMlwiLFwiwqHCpsK/XCJdLFxuW1wiOGZhMmViXCIsXCLCusKqwqnCruKEosKk4oSWXCJdLFxuW1wiOGZhNmUxXCIsXCLOhs6IzonOis6qXCJdLFxuW1wiOGZhNmU3XCIsXCLOjFwiXSxcbltcIjhmYTZlOVwiLFwizo7Oq1wiXSxcbltcIjhmYTZlY1wiLFwizo9cIl0sXG5bXCI4ZmE2ZjFcIixcIs6szq3Ors6vz4rOkM+Mz4LPjc+LzrDPjlwiXSxcbltcIjhmYTdjMlwiLFwi0IJcIiwxMCxcItCO0I9cIl0sXG5bXCI4ZmE3ZjJcIixcItGSXCIsMTAsXCLRntGfXCJdLFxuW1wiOGZhOWExXCIsXCLDhsSQXCJdLFxuW1wiOGZhOWE0XCIsXCLEplwiXSxcbltcIjhmYTlhNlwiLFwixLJcIl0sXG5bXCI4ZmE5YThcIixcIsWBxL9cIl0sXG5bXCI4ZmE5YWJcIixcIsWKw5jFklwiXSxcbltcIjhmYTlhZlwiLFwixabDnlwiXSxcbltcIjhmYTljMVwiLFwiw6bEkcOwxKfEscSzxLjFgsWAxYnFi8O4xZPDn8Wnw75cIl0sXG5bXCI4ZmFhYTFcIixcIsOBw4DDhMOCxILHjcSAxITDhcODxIbEiMSMw4fEisSOw4nDiMOLw4rEmsSWxJLEmFwiXSxcbltcIjhmYWFiYVwiLFwixJzEnsSixKDEpMONw4zDj8OOx4/EsMSqxK7EqMS0xLbEucS9xLvFg8WHxYXDkcOTw5LDlsOUx5HFkMWMw5XFlMWYxZbFmsWcxaDFnsWkxaLDmsOZw5zDm8Wsx5PFsMWqxbLFrsWox5fHm8eZx5XFtMOdxbjFtsW5xb3Fu1wiXSxcbltcIjhmYWJhMVwiLFwiw6HDoMOkw6LEg8eOxIHEhcOlw6PEh8SJxI3Dp8SLxI/DqcOow6vDqsSbxJfEk8SZx7XEncSfXCJdLFxuW1wiOGZhYmJkXCIsXCLEocSlw63DrMOvw67HkFwiXSxcbltcIjhmYWJjNVwiLFwixKvEr8SpxLXEt8S6xL7EvMWExYjFhsOxw7PDssO2w7THksWRxY3DtcWVxZnFl8WbxZ3FocWfxaXFo8O6w7nDvMO7xa3HlMWxxavFs8WvxanHmMecx5rHlsW1w73Dv8W3xbrFvsW8XCJdLFxuW1wiOGZiMGExXCIsXCLkuILkuITkuIXkuIzkuJLkuJ/kuKPkuKTkuKjkuKvkuK7kuK/kuLDkuLXkuYDkuYHkuYTkuYfkuZHkuZrkuZzkuaPkuajkuankubTkubXkubnkub/kuo3kupbkupfkup3kuq/kurnku4Pku5Dku5rku5vku6Dku6Hku6Lku6jku6/ku7Hku7Pku7Xku73ku77ku7/kvIDkvILkvIPkvIjkvIvkvIzkvJLkvJXkvJbkvJfkvJnkvK7kvLHkvaDkvLPkvLXkvLfkvLnkvLvkvL7kvYDkvYLkvYjkvYnkvYvkvYzkvZLkvZTkvZbkvZjkvZ/kvaPkvarkvazkva7kvbHkvbfkvbjkvbnkvbrkvb3kvb7kvoHkvoLkvoRcIl0sXG5bXCI4ZmIxYTFcIixcIuS+heS+ieS+iuS+jOS+juS+kOS+kuS+k+S+lOS+l+S+meS+muS+nuS+n+S+suS+t+S+ueS+u+S+vOS+veS+vuS/gOS/geS/heS/huS/iOS/ieS/i+S/jOS/jeS/j+S/kuS/nOS/oOS/ouS/sOS/suS/vOS/veS/v+WAgOWAgeWAhOWAh+WAiuWAjOWAjuWAkOWAk+WAl+WAmOWAm+WAnOWAneWAnuWAouWAp+WAruWAsOWAsuWAs+WAteWBgOWBgeWBguWBheWBhuWBiuWBjOWBjuWBkeWBkuWBk+WBl+WBmeWBn+WBoOWBouWBo+WBpuWBp+WBquWBreWBsOWBseWAu+WCgeWCg+WChOWChuWCiuWCjuWCj+WCkFwiXSxcbltcIjhmYjJhMVwiLFwi5YKS5YKT5YKU5YKW5YKb5YKc5YKeXCIsNCxcIuWCquWCr+WCsOWCueWCuuWCveWDgOWDg+WDhOWDh+WDjOWDjuWDkOWDk+WDlOWDmOWDnOWDneWDn+WDouWDpOWDpuWDqOWDqeWDr+WDseWDtuWDuuWDvuWEg+WEhuWEh+WEiOWEi+WEjOWEjeWEjuWDsuWEkOWEl+WEmeWEm+WEnOWEneWEnuWEo+WEp+WEqOWErOWEreWEr+WEseWEs+WEtOWEteWEuOWEueWFguWFiuWFj+WFk+WFleWFl+WFmOWFn+WFpOWFpuWFvuWGg+WGhOWGi+WGjuWGmOWGneWGoeWGo+WGreWGuOWGuuWGvOWGvuWGv+WHglwiXSxcbltcIjhmYjNhMVwiLFwi5YeI5YeP5YeR5YeS5YeT5YeV5YeY5Yee5Yei5Yel5Yeu5Yey5Yez5Ye05Ye35YiB5YiC5YiF5YiS5YiT5YiV5YiW5YiY5Yii5Yio5Yix5Yiy5Yi15Yi85YmF5YmJ5YmV5YmX5YmY5Yma5Ymc5Ymf5Ymg5Ymh5Ymm5Ymu5Ym35Ym45Ym55YqA5YqC5YqF5YqK5YqM5YqT5YqV5YqW5YqX5YqY5Yqa5Yqc5Yqk5Yql5Yqm5Yqn5Yqv5Yqw5Yq25Yq35Yq45Yq65Yq75Yq95YuA5YuE5YuG5YuI5YuM5YuP5YuR5YuU5YuW5Yub5Yuc5Yuh5Yul5Yuo5Yup5Yuq5Yus5Yuw5Yux5Yu05Yu25Yu35YyA5YyD5YyK5YyLXCJdLFxuW1wiOGZiNGExXCIsXCLljIzljJHljJPljJjljJvljJzljJ7ljJ/ljKXljKfljKjljKnljKvljKzljK3ljLDljLLljLXljLzljL3ljL7ljYLljYzljYvljZnljZvljaHljaPljaXljazlja3ljbLljbnljb7ljoPljofljojljo7ljpPljpTljpnljp3ljqHljqTljqrljqvljq/ljrLljrTljrXljrfljrjljrrljr3lj4Dlj4Xlj4/lj5Llj5Plj5Xlj5rlj53lj57lj6Dlj6blj6flj7XlkILlkJPlkJrlkKHlkKflkKjlkKrlkK/lkLHlkLTlkLXlkYPlkYTlkYflkY3lkY/lkZ7lkaLlkaTlkablkaflkanlkavlka3lka7lkbTlkb9cIl0sXG5bXCI4ZmI1YTFcIixcIuWSgeWSg+WSheWSiOWSieWSjeWSkeWSleWSluWSnOWSn+WSoeWSpuWSp+WSqeWSquWSreWSruWSseWSt+WSueWSuuWSu+WSv+WThuWTiuWTjeWTjuWToOWTquWTrOWTr+WTtuWTvOWTvuWTv+WUgOWUgeWUheWUiOWUieWUjOWUjeWUjuWUleWUquWUq+WUsuWUteWUtuWUu+WUvOWUveWVgeWVh+WVieWViuWVjeWVkOWVkeWVmOWVmuWVm+WVnuWVoOWVoeWVpOWVpuWVv+WWgeWWguWWhuWWiOWWjuWWj+WWkeWWkuWWk+WWlOWWl+WWo+WWpOWWreWWsuWWv+WXgeWXg+WXhuWXieWXi+WXjOWXjuWXkeWXklwiXSxcbltcIjhmYjZhMVwiLFwi5ZeT5ZeX5ZeY5Zeb5Zee5Zei5Zep5Ze25Ze/5ZiF5ZiI5ZiK5ZiNXCIsNSxcIuWYmeWYrOWYsOWYs+WYteWYt+WYueWYu+WYvOWYveWYv+WZgOWZgeWZg+WZhOWZhuWZieWZi+WZjeWZj+WZlOWZnuWZoOWZoeWZouWZo+WZpuWZqeWZreWZr+WZseWZsuWZteWahOWaheWaiOWai+WajOWaleWameWamuWaneWanuWan+WapuWap+WaqOWaqeWaq+WarOWareWaseWas+Wat+WavuWbheWbieWbiuWbi+Wbj+WbkOWbjOWbjeWbmeWbnOWbneWbn+WboeWbpFwiLDQsXCLlm7Hlm6vlm61cIl0sXG5bXCI4ZmI3YTFcIixcIuWbtuWbt+WcgeWcguWch+WciuWcjOWckeWcleWcmuWcm+WcneWcoOWcouWco+WcpOWcpeWcqeWcquWcrOWcruWcr+Wcs+WctOWcveWcvuWcv+WdheWdhuWdjOWdjeWdkuWdouWdpeWdp+WdqOWdq+WdrVwiLDQsXCLlnbPlnbTlnbXlnbflnbnlnbrlnbvlnbzlnb7lnoHlnoPlnozlnpTlnpflnpnlnprlnpzlnp3lnp7lnp/lnqHlnpXlnqflnqjlnqnlnqzlnrjlnr3ln4fln4jln4zln4/ln5Xln53ln57ln6Tln6bln6fln6nln63ln7Dln7Xln7bln7jln73ln77ln7/loIPloITloIjloInln6FcIl0sXG5bXCI4ZmI4YTFcIixcIuWgjOWgjeWgm+WgnuWgn+WgoOWgpuWgp+WgreWgsuWgueWgv+WhieWhjOWhjeWhj+WhkOWhleWhn+WhoeWhpOWhp+WhqOWhuOWhvOWhv+WigOWigeWih+WiiOWiieWiiuWijOWijeWij+WikOWilOWiluWineWioOWioeWiouWipuWiqeWiseWisuWjhOWivOWjguWjiOWjjeWjjuWjkOWjkuWjlOWjluWjmuWjneWjoeWjouWjqeWjs+WkheWkhuWki+WkjOWkkuWkk+WklOiZgeWkneWkoeWko+WkpOWkqOWkr+WksOWks+WkteWktuWkv+Wlg+WlhuWlkuWlk+WlmeWlm+WlneWlnuWln+WloeWlo+Wlq+WlrVwiXSxcbltcIjhmYjlhMVwiLFwi5aWv5aWy5aW15aW25aW55aW75aW85aaL5aaM5aaO5aaS5aaV5aaX5aaf5aak5aan5aat5aau5aav5aaw5aaz5aa35aa65aa85aeB5aeD5aeE5aeI5aeK5aeN5aeS5aed5aee5aef5aej5aek5aen5aeu5aev5aex5aey5ae05ae35aiA5aiE5aiM5aiN5aiO5aiS5aiT5aie5aij5aik5ain5aio5aiq5ait5aiw5amE5amF5amH5amI5amM5amQ5amV5ame5amj5aml5amn5amt5am35am65am75am+5aqL5aqQ5aqT5aqW5aqZ5aqc5aqe5aqf5aqg5aqi5aqn5aqs5aqx5aqy5aqz5aq15aq45aq65aq75aq/XCJdLFxuW1wiOGZiYWExXCIsXCLlq4Tlq4blq4jlq4/lq5rlq5zlq6Dlq6Xlq6rlq67lq7Xlq7blq73lrIDlrIHlrIjlrJflrLTlrJnlrJvlrJ3lrKHlrKXlrK3lrLjlrYHlrYvlrYzlrZLlrZblrZ7lrajlra7lra/lrbzlrb3lrb7lrb/lroHlroTlroblrorlro7lrpDlrpHlrpPlrpTlrpblrqjlrqnlrqzlrq3lrq/lrrHlrrLlrrflrrrlrrzlr4Dlr4Hlr43lr4/lr5ZcIiw0LFwi5a+g5a+v5a+x5a+05a+95bCM5bCX5bCe5bCf5bCj5bCm5bCp5bCr5bCs5bCu5bCw5bCy5bC15bC25bGZ5bGa5bGc5bGi5bGj5bGn5bGo5bGpXCJdLFxuW1wiOGZiYmExXCIsXCLlsa3lsbDlsbTlsbXlsbrlsbvlsbzlsb3lsoflsojlsorlso/lspLlsp3lsp/lsqDlsqLlsqPlsqblsqrlsrLlsrTlsrXlsrrls4nls4vls5Lls53ls5fls67ls7Hls7Lls7TltIHltIbltI3ltJLltKvltKPltKTltKbltKfltLHltLTltLnltL3ltL/ltYLltYPltYbltYjltZXltZHltZnltYrltZ/ltaDltaHltaLltaTltarlta3ltbDltbnltbrltb7ltb/ltoHltoPltojltorltpLltpPltpTltpXltpnltpvltp/ltqDltqfltqvltrDltrTltrjltrnlt4Plt4flt4vlt5Dlt47lt5jlt5nlt6Dlt6RcIl0sXG5bXCI4ZmJjYTFcIixcIuW3qeW3uOW3ueW4gOW4h+W4jeW4kuW4lOW4leW4mOW4n+W4oOW4ruW4qOW4suW4teW4vuW5i+W5kOW5ieW5keW5luW5mOW5m+W5nOW5nuW5qOW5qlwiLDQsXCLlubDluoDluovluo7luqLluqTluqXluqjluqrluqzlurHlurPlur3lur7lur/lu4blu4zlu4vlu47lu5Hlu5Llu5Tlu5Xlu5zlu57lu6Xlu6vlvILlvIblvIflvIjlvI7lvJnlvJzlvJ3lvKHlvKLlvKPlvKTlvKjlvKvlvKzlvK7lvLDlvLTlvLblvLvlvL3lvL/lvYDlvYTlvYXlvYflvY3lvZDlvZTlvZjlvZvlvaDlvaPlvaTlvadcIl0sXG5bXCI4ZmJkYTFcIixcIuW9r+W9suW9tOW9teW9uOW9uuW9veW9vuW+ieW+jeW+j+W+luW+nOW+neW+ouW+p+W+q+W+pOW+rOW+r+W+sOW+seW+uOW/hOW/h+W/iOW/ieW/i+W/kFwiLDQsXCLlv57lv6Hlv6Llv6jlv6nlv6rlv6zlv63lv67lv6/lv7Llv7Plv7blv7rlv7zmgIfmgIrmgI3mgJPmgJTmgJfmgJjmgJrmgJ/mgKTmgK3mgLPmgLXmgYDmgYfmgYjmgYnmgYzmgZHmgZTmgZbmgZfmgZ3mgaHmgafmgbHmgb7mgb/mgoLmgobmgojmgormgo7mgpHmgpPmgpXmgpjmgp3mgp7mgqLmgqTmgqXmgqjmgrDmgrHmgrdcIl0sXG5bXCI4ZmJlYTFcIixcIuaCu+aCvuaDguaDhOaDiOaDieaDiuaDi+aDjuaDj+aDlOaDleaDmeaDm+aDneaDnuaDouaDpeaDsuaDteaDuOaDvOaDveaEguaEh+aEiuaEjOaEkFwiLDQsXCLmhJbmhJfmhJnmhJzmhJ7mhKLmhKrmhKvmhLDmhLHmhLXmhLbmhLfmhLnmhYHmhYXmhYbmhYnmhZ7mhaDmhazmhbLmhbjmhbvmhbzmhb/mhoDmhoHmhoPmhoTmhovmho3mhpLmhpPmhpfmhpjmhpzmhp3mhp/mhqDmhqXmhqjmhqrmhq3mhrjmhrnmhrzmh4Dmh4Hmh4Lmh47mh4/mh5Xmh5zmh53mh57mh5/mh6Hmh6Lmh6fmh6nmh6VcIl0sXG5bXCI4ZmJmYTFcIixcIuaHrOaHreaHr+aIgeaIg+aIhOaIh+aIk+aIleaInOaIoOaIouaIo+aIp+aIqeaIq+aIueaIveaJguaJg+aJhOaJhuaJjOaJkOaJkeaJkuaJlOaJluaJmuaJnOaJpOaJreaJr+aJs+aJuuaJveaKjeaKjuaKj+aKkOaKpuaKqOaKs+aKtuaKt+aKuuaKvuaKv+aLhOaLjuaLleaLluaLmuaLquaLsuaLtOaLvOaLveaMg+aMhOaMiuaMi+aMjeaMkOaMk+aMluaMmOaMqeaMquaMreaMteaMtuaMueaMvOaNgeaNguaNg+aNhOaNhuaNiuaNi+aNjuaNkuaNk+aNlOaNmOaNm+aNpeaNpuaNrOaNreaNseaNtOaNtVwiXSxcbltcIjhmYzBhMVwiLFwi5o245o285o295o2/5o6C5o6E5o6H5o6K5o6Q5o6U5o6V5o6Z5o6a5o6e5o6k5o6m5o6t5o6u5o6v5o695o+B5o+F5o+I5o+O5o+R5o+T5o+U5o+V5o+c5o+g5o+l5o+q5o+s5o+y5o+z5o+15o+45o+55pCJ5pCK5pCQ5pCS5pCU5pCY5pCe5pCg5pCi5pCk5pCl5pCp5pCq5pCv5pCw5pC15pC95pC/5pGL5pGP5pGR5pGS5pGT5pGU5pGa5pGb5pGc5pGd5pGf5pGg5pGh5pGj5pGt5pGz5pG05pG75pG95pKF5pKH5pKP5pKQ5pKR5pKY5pKZ5pKb5pKd5pKf5pKh5pKj5pKm5pKo5pKs5pKz5pK95pK+5pK/XCJdLFxuW1wiOGZjMWExXCIsXCLmk4Tmk4nmk4rmk4vmk4zmk47mk5Dmk5Hmk5Xmk5fmk6Tmk6Xmk6nmk6rmk63mk7Dmk7Xmk7fmk7vmk7/mlIHmlITmlIjmlInmlIrmlI/mlJPmlJTmlJbmlJnmlJvmlJ7mlJ/mlKLmlKbmlKnmlK7mlLHmlLrmlLzmlL3mlYPmlYfmlYnmlZDmlZLmlZTmlZ/mlaDmlafmlavmlbrmlb3mloHmloXmlormlpLmlpXmlpjmlp3mlqDmlqPmlqbmlq7mlrLmlrPmlrTmlr/ml4Lml4jml4nml47ml5Dml5Tml5bml5jml5/ml7Dml7Lml7Tml7Xml7nml77ml7/mmIDmmITmmIjmmInmmI3mmJHmmJLmmJXmmJbmmJ1cIl0sXG5bXCI4ZmMyYTFcIixcIuaYnuaYoeaYouaYo+aYpOaYpuaYqeaYquaYq+aYrOaYruaYsOaYseaYs+aYueaYt+aZgOaZheaZhuaZiuaZjOaZkeaZjuaZl+aZmOaZmeaZm+aZnOaZoOaZoeabu+aZquaZq+aZrOaZvuaZs+aZteaZv+aZt+aZuOaZueaZu+aagOaZvOaai+aajOaajeaakOaakuaameaamuaam+aanOaan+aaoOaapOaareaaseaasuaateaau+aav+abgOabguabg+abiOabjOabjuabj+ablOabm+abn+abqOabq+abrOabruabuuacheach+acjuack+acmeacnOacoOacouacs+acvuadheadh+adiOadjOadlOadleadnVwiXSxcbltcIjhmYzNhMVwiLFwi5p2m5p2s5p2u5p205p225p275p6B5p6E5p6O5p6P5p6R5p6T5p6W5p6Y5p6Z5p6b5p6w5p6x5p6y5p615p675p685p695p+55p+A5p+C5p+D5p+F5p+I5p+J5p+S5p+X5p+Z5p+c5p+h5p+m5p+w5p+y5p+25p+35qGS5qCU5qCZ5qCd5qCf5qCo5qCn5qCs5qCt5qCv5qCw5qCx5qCz5qC75qC/5qGE5qGF5qGK5qGM5qGV5qGX5qGY5qGb5qGr5qGuXCIsNCxcIuahteahueahuuahu+ahvOaiguaihOaihuaiiOailuaimOaimuainOaioeaio+aipeaiqeaiquairuaisuaiu+ajheajiOajjOajj1wiXSxcbltcIjhmYzRhMVwiLFwi5qOQ5qOR5qOT5qOW5qOZ5qOc5qOd5qOl5qOo5qOq5qOr5qOs5qOt5qOw5qOx5qO15qO25qO75qO85qO95qSG5qSJ5qSK5qSQ5qSR5qST5qSW5qSX5qSx5qSz5qS15qS45qS75qWC5qWF5qWJ5qWO5qWX5qWb5qWj5qWk5qWl5qWm5qWo5qWp5qWs5qWw5qWx5qWy5qW65qW75qW/5qaA5qaN5qaS5qaW5qaY5qah5qal5qam5qao5qar5qat5qav5qa35qa45qa65qa85qeF5qeI5qeR5qeW5qeX5qei5qel5qeu5qev5qex5qez5qe15qe+5qiA5qiB5qiD5qiP5qiR5qiV5qia5qid5qig5qik5qio5qiw5qiyXCJdLFxuW1wiOGZjNWExXCIsXCLmqLTmqLfmqLvmqL7mqL/mqYXmqYbmqYnmqYrmqY7mqZDmqZHmqZLmqZXmqZbmqZvmqaTmqafmqarmqbHmqbPmqb7mqoHmqoPmqobmqofmqonmqovmqpHmqpvmqp3mqp7mqp/mqqXmqqvmqq/mqrDmqrHmqrTmqr3mqr7mqr/mq4bmq4nmq4jmq4zmq5Dmq5Tmq5Xmq5bmq5zmq53mq6Tmq6fmq6zmq7Dmq7Hmq7Lmq7zmq73mrILmrIPmrIbmrIfmrInmrI/mrJDmrJHmrJfmrJvmrJ7mrKTmrKjmrKvmrKzmrK/mrLXmrLbmrLvmrL/mrYbmrYrmrY3mrZLmrZbmrZjmrZ3mraDmrafmravmra7mrbDmrbXmrb1cIl0sXG5bXCI4ZmM2YTFcIixcIuatvuauguauheaul+aum+aun+auoOauouauo+auqOauqeaurOaureauruausOauuOauueauveauvuavg+avhOavieavjOavluavmuavoeavo+avpuavp+avruavseavt+avueavv+awguawhOawheawieawjeawjuawkOawkuawmeawn+awpuawp+awqOawrOawruaws+awteawtuawuuawu+awv+axiuaxi+axjeaxj+axkuaxlOaxmeaxm+axnOaxq+axreaxr+axtOaxtuaxuOaxueaxu+ayheayhuayh+ayieaylOayleayl+aymOaynOayn+aysOaysuaytOazguazhuazjeazj+azkOazkeazkuazlOazllwiXSxcbltcIjhmYzdhMVwiLFwi5rOa5rOc5rOg5rOn5rOp5rOr5rOs5rOu5rOy5rO05rSE5rSH5rSK5rSO5rSP5rSR5rST5rSa5rSm5rSn5rSo5rGn5rSu5rSv5rSx5rS55rS85rS/5rWX5rWe5rWf5rWh5rWl5rWn5rWv5rWw5rW85raC5raH5raR5raS5raU5raW5raX5raY5raq5ras5ra05ra35ra55ra95ra/5reE5reI5reK5reO5reP5reW5reb5red5ref5reg5rei5rel5rep5rev5rew5re05re25re85riA5riE5rie5rii5rin5riy5ri25ri55ri75ri85rmE5rmF5rmI5rmJ5rmL5rmP5rmR5rmS5rmT5rmU5rmX5rmc5rmd5rmeXCJdLFxuW1wiOGZjOGExXCIsXCLmuaLmuaPmuajmubPmubvmub3muo3mupPmupnmuqDmuqfmuq3muq7murHmurPmurvmur/mu4Dmu4Hmu4Pmu4fmu4jmu4rmu43mu47mu4/mu6vmu63mu67mu7nmu7vmu73mvITmvIjmvIrmvIzmvI3mvJbmvJjmvJrmvJvmvKbmvKnmvKrmvK/mvLDmvLPmvLbmvLvmvLzmvK3mvY/mvZHmvZLmvZPmvZfmvZnmvZrmvZ3mvZ7mvaHmvaLmvajmvazmvb3mvb7mvoPmvofmvojmvovmvozmvo3mvpDmvpLmvpPmvpTmvpbmvprmvp/mvqDmvqXmvqbmvqfmvqjmvq7mvq/mvrDmvrXmvrbmvrzmv4Xmv4fmv4jmv4pcIl0sXG5bXCI4ZmM5YTFcIixcIua/mua/nua/qOa/qea/sOa/tea/uea/vOa/veeAgOeAheeAhueAh+eAjeeAl+eAoOeAo+eAr+eAtOeAt+eAueeAvOeBg+eBhOeBiOeBieeBiueBi+eBlOeBleeBneeBnueBjueBpOeBpeeBrOeBrueBteeBtueBvueCgeeCheeChueClFwiLDQsXCLngpvngqTngqvngrDngrHngrTngrfng4rng5Hng5Png5Tng5Xng5bng5jng5zng6Tng7rnhINcIiw0LFwi54SL54SM54SP54Se54Sg54Sr54St54Sv54Sw54Sx54S454WB54WF54WG54WH54WK54WL54WQ54WS54WX54Wa54Wc54We54WgXCJdLFxuW1wiOGZjYWExXCIsXCLnhajnhbnnhoDnhoXnhofnhoznhpLnhprnhpvnhqDnhqLnhq/nhrDnhrLnhrPnhrrnhr/nh4Dnh4Hnh4Tnh4vnh4znh5Pnh5bnh5nnh5rnh5znh7jnh77niIDniIfniIjniInniJPniJfniJrniJ3niJ/niKTniKvniK/niLTniLjniLnniYHniYLniYPniYXniY7niY/niZDniZPniZXniZbniZrniZzniZ7niaDniaPniajniavnia7nia/nibHnibfnibjnibvnibznib/nioTnionnio3nio7nipPnipvniqjniq3niq7nirHnirTnir7ni4Hni4fni4nni4zni5Xni5bni5jni5/ni6Xni7Pni7Tni7rni7tcIl0sXG5bXCI4ZmNiYTFcIixcIueLvueMgueMhOeMheeMh+eMi+eMjeeMkueMk+eMmOeMmeeMnueMoueMpOeMp+eMqOeMrOeMseeMsueMteeMuueMu+eMveeNg+eNjeeNkOeNkueNlueNmOeNneeNnueNn+eNoOeNpueNp+eNqeeNq+eNrOeNrueNr+eNseeNt+eNueeNvOeOgOeOgeeOg+eOheeOhueOjueOkOeOk+eOleeOl+eOmOeOnOeOnueOn+eOoOeOoueOpeeOpueOqueOq+eOreeOteeOt+eOueeOvOeOveeOv+ePheePhuePieePi+ePjOePj+ePkuePk+ePluePmeePneePoeePo+ePpuePp+ePqeePtOePteePt+ePueePuuePu+ePvVwiXSxcbltcIjhmY2NhMVwiLFwi54+/55CA55CB55CE55CH55CK55CR55Ca55Cb55Ck55Cm55CoXCIsOSxcIueQueeRgOeRg+eRhOeRhueRh+eRi+eRjeeRkeeRkueRl+eRneeRoueRpueRp+eRqOeRq+eRreeRrueRseeRsueSgOeSgeeSheeShueSh+eSieeSj+eSkOeSkeeSkueSmOeSmeeSmueSnOeSn+eSoOeSoeeSo+eSpueSqOeSqeeSqueSq+eSrueSr+eSseeSsueSteeSueeSu+eSv+eTiOeTieeTjOeTkOeTk+eTmOeTmueTm+eTnueTn+eTpOeTqOeTqueTq+eTr+eTtOeTuueTu+eTvOeTv+eUhlwiXSxcbltcIjhmY2RhMVwiLFwi55SS55SW55SX55Sg55Sh55Sk55Sn55Sp55Sq55Sv55S255S555S955S+55S/55WA55WD55WH55WI55WO55WQ55WS55WX55We55Wf55Wh55Wv55Wx55W5XCIsNSxcIueWgeeWheeWkOeWkueWk+eWleeWmeeWnOeWoueWpOeWtOeWuueWv+eXgOeXgeeXhOeXhueXjOeXjueXj+eXl+eXnOeXn+eXoOeXoeeXpOeXp+eXrOeXrueXr+eXseeXueeYgOeYgueYg+eYhOeYh+eYiOeYiueYjOeYj+eYkueYk+eYleeYlueYmeeYm+eYnOeYneeYnueYo+eYpeeYpueYqeeYreeYsueYs+eYteeYuOeYuVwiXSxcbltcIjhmY2VhMVwiLFwi55i655i855mK55mA55mB55mD55mE55mF55mJ55mL55mV55mZ55mf55mk55ml55mt55mu55mv55mx55m055qB55qF55qM55qN55qV55qb55qc55qd55qf55qg55qiXCIsNixcIueaqueareeaveebgeebheebieebi+ebjOebjueblOebmeeboOebpuebqOebrOebsOebseebtuebueebvOecgOechueciuecjueckueclOecleecl+ecmeecmuecnOecouecqOecreecruecr+ectOecteectuecueecveecvuedguedheedhuediuedjeedjuedj+edkuedluedl+ednOednuedn+edoOedolwiXSxcbltcIjhmY2ZhMVwiLFwi552k552n552q552s552w552y552z552055265529556A556E556M556N556U556V556W556a556f556i556n556q556u556v556x5561556+55+D55+J55+R55+S55+V55+Z55+e55+f55+g55+k55+m55+q55+s55+w55+x55+055+455+756CF56CG56CJ56CN56CO56CR56Cd56Ch56Ci56Cj56Ct56Cu56Cw56C156C356GD56GE56GH56GI56GM56GO56GS56Gc56Ge56Gg56Gh56Gj56Gk56Go56Gq56Gu56G656G+56KK56KP56KU56KY56Kh56Kd56Ke56Kf56Kk56Ko56Ks56Kt56Kw56Kx56Ky56KzXCJdLFxuW1wiOGZkMGExXCIsXCLnorvnor3nor/no4fno4jno4nno4zno47no5Lno5Pno5Xno5bno6Tno5vno5/no6Dno6Hno6bno6rno7Lno7PnpIDno7bno7fno7rno7vno7/npIbnpIznpJDnpJrnpJznpJ7npJ/npKDnpKXnpKfnpKnnpK3npLHnpLTnpLXnpLvnpL3npL/npYTnpYXnpYbnpYrnpYvnpY/npZHnpZTnpZjnpZvnpZznpafnpannpavnpbLnpbnnpbvnpbznpb7npovnpoznppHnppPnppTnppXnppbnppjnppvnppznpqHnpqjnpqnnpqvnpq/nprHnprTnprjnprvnp4Lnp4Tnp4fnp4jnp4rnp4/np5Tnp5bnp5rnp53np55cIl0sXG5bXCI4ZmQxYTFcIixcIuenoOenouenpeenquenq+enreenseenuOenvOeogueog+eoh+eoieeoiueojOeokeeoleeom+eonueooeeop+eoq+eoreeor+eosOeotOeoteeouOeoueeouuephOepheeph+epiOepjOepleepluepmeepnOepneepn+epoOeppeepp+epquepreepteepuOepvueqgOeqgueqheeqhueqiueqi+eqkOeqkeeqlOeqnueqoOeqo+eqrOeqs+eqteequeequ+eqvOerhuerieerjOerjuerkeerm+erqOerqeerq+errOerseertOeru+erveervuesh+eslOesn+eso+esp+esqeesquesq+esreesruesr+essFwiXSxcbltcIjhmZDJhMVwiLFwi56yx56y056y956y/562A562B562H562O562V562g562k562m562p562q562t562v562y562z5623566E566J566O566Q566R566W566b566e566g566l566s566v566w566y56615662566656675668566956+C56+F56+I56+K56+U56+W56+X56+Z56+a56+b56+o56+q56+y56+056+156+456+556+656+856++57CB57CC57CD57CE57CG57CJ57CL57CM57CO57CP57CZ57Cb57Cg57Cl57Cm57Co57Cs57Cx57Cz57C057C257C557C657GG57GK57GV57GR57GS57GT57GZXCIsNV0sXG5bXCI4ZmQzYTFcIixcIuexoeexo+exp+exqeexreexruexsOexsuexueexvOexveeyhueyh+eyj+eylOeynueyoOeypueysOeytueyt+eyuueyu+eyvOeyv+ezhOezh+eziOezieezjeezj+ezk+ezlOezleezl+ezmeezmuezneezpuezqeezq+eztee0g+e0h+e0iOe0iee0j+e0kee0kue0k+e0lue0nee0nue0o+e0pue0que0ree0see0vOe0vee0vue1gOe1gee1h+e1iOe1jee1kee1k+e1l+e1mee1mue1nOe1nee1pee1p+e1que1sOe1uOe1uue1u+e1v+e2gee2gue2g+e2hee2hue2iOe2i+e2jOe2jee2kee2lue2l+e2nVwiXSxcbltcIjhmZDRhMVwiLFwi57ae57am57an57aq57az57a257a357a557eCXCIsNCxcIue3jOe3jee3jue3l+e3mee4gOe3oue3pee3pue3que3q+e3ree3see3tee3tue3uee3uue4iOe4kOe4kee4lee4l+e4nOe4nee4oOe4p+e4qOe4rOe4ree4r+e4s+e4tue4v+e5hOe5hee5h+e5jue5kOe5kue5mOe5n+e5oee5oue5pee5q+e5rue5r+e5s+e5uOe5vue6gee6hue6h+e6iue6jee6kee6lee6mOe6mue6nee6nue8vOe8u+e8vee8vue8v+e9g+e9hOe9h+e9j+e9kue9k+e9m+e9nOe9nee9oee9o+e9pOe9pee9pue9rVwiXSxcbltcIjhmZDVhMVwiLFwi572x5729572+572/576A576L576N576P576Q576R576W576X576c576h576i576m576q576t57605768576/57+A57+D57+I57+O57+P57+b57+f57+j57+l57+o57+s57+u57+v57+y57+657+957++57+/6ICH6ICI6ICK6ICN6ICO6ICP6ICR6ICT6ICU6ICW6ICd6ICe6ICf6ICg6ICk6ICm6ICs6ICu6ICw6IC06IC16IC36IC56IC66IC86IC+6IGA6IGE6IGg6IGk6IGm6IGt6IGx6IG16IKB6IKI6IKO6IKc6IKe6IKm6IKn6IKr6IK46IK56IOI6ION6IOP6IOS6IOU6IOV6IOX6IOY6IOg6IOt6IOuXCJdLFxuW1wiOGZkNmExXCIsXCLog7Dog7Log7Pog7bog7nog7rog77ohIPohIvohJbohJfohJjohJzohJ7ohKDohKTohKfohKzohLDohLXohLrohLzohYXohYfohYrohYzohZLohZfohaDohaHohafohajohanoha3oha/ohbfohoHohpDohoTohoXohobohovoho7ohpbohpjohpvohp7ohqLohq7ohrLohrTohrvoh4voh4Poh4Xoh4roh47oh4/oh5Xoh5foh5voh53oh57oh6Hoh6Toh6voh6zoh7Doh7Hoh7Loh7Xoh7boh7joh7noh73oh7/oiIDoiIPoiI/oiJPoiJToiJnoiJroiJ3oiKHoiKLoiKjoiLLoiLToiLroiYPoiYToiYXoiYZcIl0sXG5bXCI4ZmQ3YTFcIixcIuiJi+iJjuiJj+iJkeiJluiJnOiJoOiJo+iJp+iJreiJtOiJu+iJveiJv+iKgOiKgeiKg+iKhOiKh+iKieiKiuiKjuiKkeiKlOiKluiKmOiKmuiKm+iKoOiKoeiKo+iKpOiKp+iKqOiKqeiKquiKruiKsOiKsuiKtOiKt+iKuuiKvOiKvuiKv+iLhuiLkOiLleiLmuiLoOiLouiLpOiLqOiLquiLreiLr+iLtuiLt+iLveiLvuiMgOiMgeiMh+iMiOiMiuiMi+iNlOiMm+iMneiMnuiMn+iMoeiMouiMrOiMreiMruiMsOiMs+iMt+iMuuiMvOiMveiNguiNg+iNhOiNh+iNjeiNjuiNkeiNleiNluiNl+iNsOiNuFwiXSxcbltcIjhmZDhhMVwiLFwi6I296I2/6I6A6I6C6I6E6I6G6I6N6I6S6I6U6I6V6I6Y6I6Z6I6b6I6c6I6d6I6m6I6n6I6p6I6s6I6+6I6/6I+A6I+H6I+J6I+P6I+Q6I+R6I+U6I+d6I2T6I+o6I+q6I+26I+46I+56I+86JCB6JCG6JCK6JCP6JCR6JCV6JCZ6I6t6JCv6JC56JGF6JGH6JGI6JGK6JGN6JGP6JGR6JGS6JGW6JGY6JGZ6JGa6JGc6JGg6JGk6JGl6JGn6JGq6JGw6JGz6JG06JG26JG46JG86JG96JKB6JKF6JKS6JKT6JKV6JKe6JKm6JKo6JKp6JKq6JKv6JKx6JK06JK66JK96JK+6JOA6JOC6JOH6JOI6JOM6JOP6JOTXCJdLFxuW1wiOGZkOWExXCIsXCLok5zok6fok6rok6/ok7Dok7Hok7Lok7folLLok7rok7vok73olILolIPolIfolIzolI7olJDolJzolJ7olKLolKPolKTolKXolKfolKrolKvolK/olLPolLTolLbolL/olYbolY9cIiw0LFwi6JWW6JWZ6JWcXCIsNixcIuiVpOiVq+iVr+iVueiVuuiVu+iVveiVv+iWgeiWheiWhuiWieiWi+iWjOiWj+iWk+iWmOiWneiWn+iWoOiWouiWpeiWp+iWtOiWtuiWt+iWuOiWvOiWveiWvuiWv+iXguiXh+iXiuiXi+iXjuiWreiXmOiXmuiXn+iXoOiXpuiXqOiXreiXs+iXtuiXvFwiXSxcbltcIjhmZGFhMVwiLFwi6Je/6JiA6JiE6JiF6JiN6JiO6JiQ6JiR6JiS6JiY6JiZ6Jib6Jie6Jih6Jin6Jip6Ji26Ji46Ji66Ji86Ji96JmA6JmC6JmG6JmS6JmT6JmW6JmX6JmY6JmZ6Jmd6JmgXCIsNCxcIuiZqeiZrOiZr+iZteiZtuiZt+iZuuiajeiakeialuiamOiamuianOiaoeiapuiap+iaqOiareiaseias+iatOiateiat+iauOiaueiav+ibgOibgeibg+ibheibkeibkuibleibl+ibmuibnOiboOibo+ibpeibp+iaiOibuuibvOibveichOicheich+ici+icjuicj+ickOick+iclOicmeicnuicn+icoeico1wiXSxcbltcIjhmZGJhMVwiLFwi6Jyo6Jyu6Jyv6Jyx6Jyy6Jy56Jy66Jy86Jy96Jy+6J2A6J2D6J2F6J2N6J2Y6J2d6J2h6J2k6J2l6J2v6J2x6J2y6J276J6DXCIsNixcIuiei+iejOiekOiek+ieleiel+iemOiemeienuieoOieo+iep+ierOiereieruieseieteievuiev+ifgeifiOifieifiuifjuifleifluifmeifmuifnOifn+ifouifo+ifpOifquifq+ifreifseifs+ifuOifuuifv+iggeigg+ighuigieigiuigi+igkOigmeigkuigk+iglOigmOigmuigm+ignOignuign+igqOigreigruigsOigsuigtVwiXSxcbltcIjhmZGNhMVwiLFwi6KC66KC86KGB6KGD6KGF6KGI6KGJ6KGK6KGL6KGO6KGR6KGV6KGW6KGY6KGa6KGc6KGf6KGg6KGk6KGp6KGx6KG56KG76KKA6KKY6KKa6KKb6KKc6KKf6KKg6KKo6KKq6KK66KK96KK+6KOA6KOKXCIsNCxcIuijkeijkuijk+ijm+ijnuijp+ijr+ijsOijseijteijt+ikgeikhuikjeikjuikj+ikleikluikmOikmeikmuiknOikoOikpuikp+ikqOiksOikseiksuikteikueikuuikvuilgOilguilheilhuilieilj+ilkuill+ilmuilm+ilnOiloeilouilo+ilq+ilruilsOils+ilteilulwiXSxcbltcIjhmZGRhMVwiLFwi6KW76KW86KW96KaJ6KaN6KaQ6KaU6KaV6Kab6Kac6Kaf6Kag6Kal6Kaw6Ka06Ka16Ka26Ka36Ka86KeUXCIsNCxcIuinpeinqeinq+inreinseins+intuinueinveinv+iohOioheioh+ioj+iokeiokuiolOioleionuiooOioouiopOiopuioq+iorOior+ioteiot+ioveiovuipgOipg+ipheiph+ipieipjeipjuipk+ipluipl+ipmOipnOipneipoeippeipp+ipteiptuipt+ipueipuuipu+ipvuipv+iqgOiqg+iqhuiqi+iqj+iqkOiqkuiqluiql+iqmeiqn+iqp+iqqeiqruiqr+iqs1wiXSxcbltcIjhmZGVhMVwiLFwi6Kq26Kq36Kq76Kq+6KuD6KuG6KuI6KuJ6KuK6KuR6KuT6KuU6KuV6KuX6Kud6Kuf6Kus6Kuw6Ku06Ku16Ku26Ku86Ku/6KyF6KyG6KyL6KyR6Kyc6Kye6Kyf6KyK6Kyt6Kyw6Ky36Ky86K2CXCIsNCxcIuitiOitkuitk+itlOitmeitjeitnuito+itreittuituOitueitvOitvuiugeiuhOiuheiui+iujeiuj+iulOiuleiunOiunuiun+iwuOiwueiwveiwvuixheixh+ixieixi+ixj+ixkeixk+ixlOixl+ixmOixm+ixneixmeixo+ixpOixpuixqOixqeixreixs+ixteixtuixu+ixvuiyhlwiXSxcbltcIjhmZGZhMVwiLFwi6LKH6LKL6LKQ6LKS6LKT6LKZ6LKb6LKc6LKk6LK56LK66LOF6LOG6LOJ6LOL6LOP6LOW6LOV6LOZ6LOd6LOh6LOo6LOs6LOv6LOw6LOy6LO16LO36LO46LO+6LO/6LSB6LSD6LSJ6LSS6LSX6LSb6LWl6LWp6LWs6LWu6LW/6LaC6LaE6LaI6LaN6LaQ6LaR6LaV6Lae6Laf6Lag6Lam6Lar6Las6Lav6Lay6La16La36La56La76LeA6LeF6LeG6LeH6LeI6LeK6LeO6LeR6LeU6LeV6LeX6LeZ6Lek6Lel6Len6Les6Lew6La86Lex6Ley6Le06Le96LiB6LiE6LiF6LiG6LiL6LiR6LiU6LiW6Lig6Lih6LiiXCJdLFxuW1wiOGZlMGExXCIsXCLouKPouKbouKfouLHouLPouLbouLfouLjouLnouL3ouYDouYHouYvouY3ouY7ouY/ouZTouZvouZzouZ3ouZ7ouaHouaLouanouazoua3oua/oubDoubHoubnoubroubvouoLouoPouonoupDoupLoupXouproupvoup3oup7ouqLouqfouqnouq3ouq7ourPourXourrourvou4Dou4Hou4Pou4Tou4fou4/ou5Hou5Tou5zou6jou67ou7Dou7Hou7fou7nou7rou63ovIDovILovIfovIjovI/ovJDovJbovJfovJjovJ7ovKDovKHovKPovKXovKfovKjovKzovK3ovK7ovLTovLXovLbovLfovLrovYDovYFcIl0sXG5bXCI4ZmUxYTFcIixcIui9g+i9h+i9j+i9kVwiLDQsXCLovZjovZ3ovZ7ovaXovp3ovqDovqHovqTovqXovqbovrXovrbovrjovr7ov4Dov4Hov4bov4rov4vov43ov5Dov5Lov5Pov5Xov6Dov6Pov6Tov6jov67ov7Hov7Xov7bov7vov77pgILpgITpgIjpgIzpgJjpgJvpgKjpgKnpgK/pgKrpgKzpgK3pgLPpgLTpgLfpgL/pgYPpgYTpgYzpgZvpgZ3pgaLpgabpgafpgazpgbDpgbTpgbnpgoXpgojpgovpgozpgo7pgpDpgpXpgpfpgpjpgpnpgpvpgqDpgqHpgqLpgqXpgrDpgrLpgrPpgrTpgrbpgr3pg4zpgr7pg4NcIl0sXG5bXCI4ZmUyYTFcIixcIumDhOmDhemDh+mDiOmDlemDl+mDmOmDmemDnOmDnemDn+mDpemDkumDtumDq+mDr+mDsOmDtOmDvumDv+mEgOmEhOmEhemEhumEiOmEjemEkOmElOmElumEl+mEmOmEmumEnOmEnumEoOmEpemEoumEo+mEp+mEqemErumEr+mEsemEtOmEtumEt+mEuemEuumEvOmEvemFg+mFh+mFiOmFj+mFk+mFl+mFmemFmumFm+mFoemFpOmFp+mFremFtOmFuemFuumFu+mGgemGg+mGhemGhumGiumGjumGkemGk+mGlOmGlemGmOmGnumGoemGpumGqOmGrOmGremGrumGsOmGsemGsumGs+mGtumGu+mGvOmGvemGv1wiXSxcbltcIjhmZTNhMVwiLFwi6YeC6YeD6YeF6YeT6YeU6YeX6YeZ6Yea6Yee6Yek6Yel6Yep6Yeq6YesXCIsNSxcIumHt+mHuemHu+mHvemIgOmIgemIhOmIhemIhumIh+mIiemIiumIjOmIkOmIkumIk+mIlumImOmInOmInemIo+mIpOmIpemIpumIqOmIrumIr+mIsOmIs+mItemItumIuOmIuemIuumIvOmIvumJgOmJgumJg+mJhumJh+mJiumJjemJjumJj+mJkemJmOmJmemJnOmJnemJoOmJoemJpemJp+mJqOmJqemJrumJr+mJsOmJtVwiLDQsXCLpibvpibzpib3pib/piojpionpiorpio3pio7pipLpipdcIl0sXG5bXCI4ZmU0YTFcIixcIumKmemKn+mKoOmKpOmKpemKp+mKqOmKq+mKr+mKsumKtumKuOmKuumKu+mKvOmKvemKv1wiLDQsXCLpi4Xpi4bpi4fpi4jpi4vpi4zpi43pi47pi5Dpi5Ppi5Xpi5fpi5jpi5npi5zpi53pi5/pi6Dpi6Hpi6Ppi6Xpi6fpi6jpi6zpi67pi7Dpi7npi7vpi7/pjIDpjILpjIjpjI3pjJHpjJTpjJXpjJzpjJ3pjJ7pjJ/pjKHpjKTpjKXpjKfpjKnpjKrpjLPpjLTpjLbpjLfpjYfpjYjpjYnpjZDpjZHpjZLpjZXpjZfpjZjpjZrpjZ7pjaTpjaXpjafpjanpjarpja3pja/pjbDpjbHpjbPpjbTpjbZcIl0sXG5bXCI4ZmU1YTFcIixcIumNuumNvemNv+mOgOmOgemOgumOiOmOiumOi+mOjemOj+mOkumOlemOmOmOm+mOnumOoemOo+mOpOmOpumOqOmOq+mOtOmOtemOtumOuumOqemPgemPhOmPhemPhumPh+mPiVwiLDQsXCLpj5Ppj5npj5zpj57pj5/pj6Lpj6bpj6fpj7npj7fpj7jpj7rpj7vpj73pkIHpkILpkITpkIjpkInpkI3pkI7pkI/pkJXpkJbpkJfpkJ/pkK7pkK/pkLHpkLLpkLPpkLTpkLvpkL/pkL3pkYPpkYXpkYjpkYrpkYzpkZXpkZnpkZzpkZ/pkaHpkaPpkajpkavpka3pka7pka/pkbHpkbLpkoTpkoPplbjplblcIl0sXG5bXCI4ZmU2YTFcIixcIumVvumWhOmWiOmWjOmWjemWjumWnemWnumWn+mWoemWpumWqemWq+mWrOmWtOmWtumWuumWvemWv+mXhumXiOmXiemXi+mXkOmXkemXkumXk+mXmemXmumXnemXnumXn+mXoOmXpOmXpumYnemYnumYoumYpOmYpemYpumYrOmYsemYs+mYt+mYuOmYuemYuumYvOmYvemZgemZkumZlOmZlumZl+mZmOmZoemZrumZtOmZu+mZvOmZvumZv+magemagumag+mahOmaiemakemalumamumaneman+mapOmapemapumaqemarumar+mas+mauumbiumbkuW2sumbmOmbmumbnembnumbn+mbqembr+mbsembuumcglwiXSxcbltcIjhmZTdhMVwiLFwi6ZyD6ZyF6ZyJ6Zya6Zyb6Zyd6Zyh6Zyi6Zyj6Zyo6Zyx6Zyz6Z2B6Z2D6Z2K6Z2O6Z2P6Z2V6Z2X6Z2Y6Z2a6Z2b6Z2j6Z2n6Z2q6Z2u6Z2z6Z226Z236Z246Z276Z296Z2/6Z6A6Z6J6Z6V6Z6W6Z6X6Z6Z6Z6a6Z6e6Z6f6Z6i6Z6s6Z6u6Z6x6Z6y6Z616Z626Z646Z656Z666Z686Z6+6Z6/6Z+B6Z+E6Z+F6Z+H6Z+J6Z+K6Z+M6Z+N6Z+O6Z+Q6Z+R6Z+U6Z+X6Z+Y6Z+Z6Z+d6Z+e6Z+g6Z+b6Z+h6Z+k6Z+v6Z+x6Z+06Z+36Z+46Z+66aCH6aCK6aCZ6aCN6aCO6aCU6aCW6aCc6aCe6aCg6aCj6aCmXCJdLFxuW1wiOGZlOGExXCIsXCLpoKvpoK7poK/poLDpoLLpoLPpoLXpoKXpoL7poYTpoYfpoYrpoZHpoZLpoZPpoZbpoZfpoZnpoZrpoaLpoaPpoaXpoabpoarpoazpoqvpoq3poq7porDporTporfporjporrporvpor/po4Lpo4Xpo4jpo4zpo6Hpo6Ppo6Xpo6bpo6fpo6rpo7Ppo7bppILppIfppIjppJHppJXppJbppJfppJrppJvppJzppJ/ppKLppKbppKfppKvppLFcIiw0LFwi6aS56aS66aS76aS86aWA6aWB6aWG6aWH6aWI6aWN6aWO6aWU6aWY6aWZ6aWb6aWc6aWe6aWf6aWg6aab6aad6aaf6aam6aaw6aax6aay6aa1XCJdLFxuW1wiOGZlOWExXCIsXCLpprnpprrppr3ppr/pp4Ppp4npp5Ppp5Tpp5npp5rpp5zpp57pp6fpp6rpp6vpp6zpp7Dpp7Tpp7Xpp7npp73pp77pqILpqIPpqITpqIvpqIzpqJDpqJHpqJbpqJ7pqKDpqKLpqKPpqKTpqKfpqK3pqK7pqLPpqLXpqLbpqLjpqYfpqYHpqYTpqYrpqYvpqYzpqY7pqZHpqZTpqZbpqZ3pqqrpqqzpqq7pqq/pqrLpqrTpqrXpqrbpqrnpqrvpqr7pqr/pq4Hpq4Ppq4bpq4jpq47pq5Dpq5Lpq5Xpq5bpq5fpq5vpq5zpq6Dpq6Tpq6Xpq6fpq6npq6zpq7Lpq7Ppq7Xpq7npq7rpq73pq79cIiw0XSxcbltcIjhmZWFhMVwiLFwi6ayE6ayF6ayI6ayJ6ayL6ayM6ayN6ayO6ayQ6ayS6ayW6ayZ6ayb6ayc6ayg6aym6ayr6ayt6ayz6ay06ay16ay36ay56ay66ay96a2I6a2L6a2M6a2V6a2W6a2X6a2b6a2e6a2h6a2j6a2l6a2m6a2o6a2qXCIsNCxcIumts+mttemtt+mtuOmtuemtv+mugOmuhOmuhemuhumuh+muiemuiumui+mujemuj+mukOmulOmumumunemunumupumup+muqemurOmusOmusemusumut+muuOmuu+muvOmuvumuv+mvgemvh+mviOmvjumvkOmvl+mvmOmvnemvn+mvpemvp+mvqumvq+mvr+mvs+mvt+mvuFwiXSxcbltcIjhmZWJhMVwiLFwi6a+56a+66a+96a+/6bCA6bCC6bCL6bCP6bCR6bCW6bCY6bCZ6bCa6bCc6bCe6bCi6bCj6bCmXCIsNCxcIumwsemwtemwtumwt+mwvemxgemxg+mxhOmxhemxiemxiumxjumxj+mxkOmxk+mxlOmxlumxmOmxm+mxnemxnumxn+mxo+mxqemxqumxnOmxq+mxqOmxrumxsOmxsumxtemxt+mxu+mzpumzsumzt+mzuem0i+m0gum0kem0l+m0mOm0nOm0nem0num0r+m0sOm0sum0s+m0tOm0uum0vOm1hem0vem1gum1g+m1h+m1ium1k+m1lOm1n+m1o+m1oum1pem1qem1qum1q+m1sOm1tum1t+m1u1wiXSxcbltcIjhmZWNhMVwiLFwi6bW86bW+6baD6baE6baG6baK6baN6baO6baS6baT6baV6baW6baX6baY6bah6baq6bas6bau6bax6ba16ba56ba86ba/6beD6beH6beJ6beK6beU6beV6beW6beX6bea6bee6bef6beg6bel6ben6bep6ber6beu6bew6bez6be06be+6biK6biC6biH6biO6biQ6biR6biS6biV6biW6biZ6bic6bid6bm66bm76bm86bqA6bqC6bqD6bqE6bqF6bqH6bqO6bqP6bqW6bqY6bqb6bqe6bqk6bqo6bqs6bqu6bqv6bqw6bqz6bq06bq16buG6buI6buL6buV6buf6buk6bun6bus6but6buu6buw6bux6buy6bu1XCJdLFxuW1wiOGZlZGExXCIsXCLpu7jpu7/pvILpvIPpvInpvI/pvJDpvJHpvJLpvJTpvJbpvJfpvJnpvJrpvJvpvJ/pvKLpvKbpvKrpvKvpvK/pvLHpvLLpvLTpvLfpvLnpvLrpvLzpvL3pvL/pvYHpvYNcIiw0LFwi6b2T6b2V6b2W6b2X6b2Y6b2a6b2d6b2e6b2o6b2p6b2tXCIsNCxcIum9s+m9tem9uum9vem+j+m+kOm+kem+kum+lOm+lum+l+m+num+oem+oum+o+m+pVwiXVxuXVxuIiwibW9kdWxlLmV4cG9ydHM9e1widUNoYXJzXCI6WzEyOCwxNjUsMTY5LDE3OCwxODQsMjE2LDIyNiwyMzUsMjM4LDI0NCwyNDgsMjUxLDI1MywyNTgsMjc2LDI4NCwzMDAsMzI1LDMyOSwzMzQsMzY0LDQ2Myw0NjUsNDY3LDQ2OSw0NzEsNDczLDQ3NSw0NzcsNTA2LDU5NCw2MTAsNzEyLDcxNiw3MzAsOTMwLDkzOCw5NjIsOTcwLDEwMjYsMTEwNCwxMTA2LDgyMDksODIxNSw4MjE4LDgyMjIsODIzMSw4MjQxLDgyNDQsODI0Niw4MjUyLDgzNjUsODQ1Miw4NDU0LDg0NTgsODQ3MSw4NDgyLDg1NTYsODU3MCw4NTk2LDg2MDIsODcxMyw4NzIwLDg3MjIsODcyNiw4NzMxLDg3MzcsODc0MCw4NzQyLDg3NDgsODc1MSw4NzYwLDg3NjYsODc3Nyw4NzgxLDg3ODcsODgwMiw4ODA4LDg4MTYsODg1NCw4ODU4LDg4NzAsODg5Niw4OTc5LDkzMjIsOTM3Miw5NTQ4LDk1ODgsOTYxNiw5NjIyLDk2MzQsOTY1Miw5NjYyLDk2NzIsOTY3Niw5NjgwLDk3MDIsOTczNSw5NzM4LDk3OTMsOTc5NSwxMTkwNiwxMTkwOSwxMTkxMywxMTkxNywxMTkyOCwxMTk0NCwxMTk0NywxMTk1MSwxMTk1NiwxMTk2MCwxMTk2NCwxMTk3OSwxMjI4NCwxMjI5MiwxMjMxMiwxMjMxOSwxMjMzMCwxMjM1MSwxMjQzNiwxMjQ0NywxMjUzNSwxMjU0MywxMjU4NiwxMjg0MiwxMjg1MCwxMjk2NCwxMzIwMCwxMzIxNSwxMzIxOCwxMzI1MywxMzI2MywxMzI2NywxMzI3MCwxMzM4NCwxMzQyOCwxMzcyNywxMzgzOSwxMzg1MSwxNDYxNywxNDcwMywxNDgwMSwxNDgxNiwxNDk2NCwxNTE4MywxNTQ3MSwxNTU4NSwxNjQ3MSwxNjczNiwxNzIwOCwxNzMyNSwxNzMzMCwxNzM3NCwxNzYyMywxNzk5NywxODAxOCwxODIxMiwxODIxOCwxODMwMSwxODMxOCwxODc2MCwxODgxMSwxODgxNCwxODgyMCwxODgyMywxODg0NCwxODg0OCwxODg3MiwxOTU3NiwxOTYyMCwxOTczOCwxOTg4Nyw0MDg3MCw1OTI0NCw1OTMzNiw1OTM2Nyw1OTQxMyw1OTQxNyw1OTQyMyw1OTQzMSw1OTQzNyw1OTQ0Myw1OTQ1Miw1OTQ2MCw1OTQ3OCw1OTQ5Myw2Mzc4OSw2Mzg2Niw2Mzg5NCw2Mzk3Niw2Mzk4Niw2NDAxNiw2NDAxOCw2NDAyMSw2NDAyNSw2NDAzNCw2NDAzNyw2NDA0Miw2NTA3NCw2NTA5Myw2NTEwNyw2NTExMiw2NTEyNyw2NTEzMiw2NTM3NSw2NTUxMCw2NTUzNl0sXCJnYkNoYXJzXCI6WzAsMzYsMzgsNDUsNTAsODEsODksOTUsOTYsMTAwLDEwMywxMDQsMTA1LDEwOSwxMjYsMTMzLDE0OCwxNzIsMTc1LDE3OSwyMDgsMzA2LDMwNywzMDgsMzA5LDMxMCwzMTEsMzEyLDMxMywzNDEsNDI4LDQ0Myw1NDQsNTQ1LDU1OCw3NDEsNzQyLDc0OSw3NTAsODA1LDgxOSw4MjAsNzkyMiw3OTI0LDc5MjUsNzkyNyw3OTM0LDc5NDMsNzk0NCw3OTQ1LDc5NTAsODA2Miw4MTQ4LDgxNDksODE1Miw4MTY0LDgxNzQsODIzNiw4MjQwLDgyNjIsODI2NCw4Mzc0LDgzODAsODM4MSw4Mzg0LDgzODgsODM5MCw4MzkyLDgzOTMsODM5NCw4Mzk2LDg0MDEsODQwNiw4NDE2LDg0MTksODQyNCw4NDM3LDg0MzksODQ0NSw4NDgyLDg0ODUsODQ5Niw4NTIxLDg2MDMsODkzNiw4OTQ2LDkwNDYsOTA1MCw5MDYzLDkwNjYsOTA3Niw5MDkyLDkxMDAsOTEwOCw5MTExLDkxMTMsOTEzMSw5MTYyLDkxNjQsOTIxOCw5MjE5LDExMzI5LDExMzMxLDExMzM0LDExMzM2LDExMzQ2LDExMzYxLDExMzYzLDExMzY2LDExMzcwLDExMzcyLDExMzc1LDExMzg5LDExNjgyLDExNjg2LDExNjg3LDExNjkyLDExNjk0LDExNzE0LDExNzE2LDExNzIzLDExNzI1LDExNzMwLDExNzM2LDExOTgyLDExOTg5LDEyMTAyLDEyMzM2LDEyMzQ4LDEyMzUwLDEyMzg0LDEyMzkzLDEyMzk1LDEyMzk3LDEyNTEwLDEyNTUzLDEyODUxLDEyOTYyLDEyOTczLDEzNzM4LDEzODIzLDEzOTE5LDEzOTMzLDE0MDgwLDE0Mjk4LDE0NTg1LDE0Njk4LDE1NTgzLDE1ODQ3LDE2MzE4LDE2NDM0LDE2NDM4LDE2NDgxLDE2NzI5LDE3MTAyLDE3MTIyLDE3MzE1LDE3MzIwLDE3NDAyLDE3NDE4LDE3ODU5LDE3OTA5LDE3OTExLDE3OTE1LDE3OTE2LDE3OTM2LDE3OTM5LDE3OTYxLDE4NjY0LDE4NzAzLDE4ODE0LDE4OTYyLDE5MDQzLDMzNDY5LDMzNDcwLDMzNDcxLDMzNDg0LDMzNDg1LDMzNDkwLDMzNDk3LDMzNTAxLDMzNTA1LDMzNTEzLDMzNTIwLDMzNTM2LDMzNTUwLDM3ODQ1LDM3OTIxLDM3OTQ4LDM4MDI5LDM4MDM4LDM4MDY0LDM4MDY1LDM4MDY2LDM4MDY5LDM4MDc1LDM4MDc2LDM4MDc4LDM5MTA4LDM5MTA5LDM5MTEzLDM5MTE0LDM5MTE1LDM5MTE2LDM5MjY1LDM5Mzk0LDE4OTAwMF19IiwibW9kdWxlLmV4cG9ydHM9W1xuW1wiYTE0MFwiLFwi7pOGXCIsNjJdLFxuW1wiYTE4MFwiLFwi7pSFXCIsMzJdLFxuW1wiYTI0MFwiLFwi7pSmXCIsNjJdLFxuW1wiYTI4MFwiLFwi7pWlXCIsMzJdLFxuW1wiYTJhYlwiLFwi7p2mXCIsNV0sXG5bXCJhMmUzXCIsXCLigqzuna1cIl0sXG5bXCJhMmVmXCIsXCLuna7una9cIl0sXG5bXCJhMmZkXCIsXCLunbDunbFcIl0sXG5bXCJhMzQwXCIsXCLuloZcIiw2Ml0sXG5bXCJhMzgwXCIsXCLul4VcIiwzMSxcIuOAgFwiXSxcbltcImE0NDBcIixcIu6XplwiLDYyXSxcbltcImE0ODBcIixcIu6YpVwiLDMyXSxcbltcImE0ZjRcIixcIu6dslwiLDEwXSxcbltcImE1NDBcIixcIu6ZhlwiLDYyXSxcbltcImE1ODBcIixcIu6ahVwiLDMyXSxcbltcImE1ZjdcIixcIu6dvVwiLDddLFxuW1wiYTY0MFwiLFwi7pqmXCIsNjJdLFxuW1wiYTY4MFwiLFwi7pulXCIsMzJdLFxuW1wiYTZiOVwiLFwi7p6FXCIsN10sXG5bXCJhNmQ5XCIsXCLuno1cIiw2XSxcbltcImE2ZWNcIixcIu6elO6elVwiXSxcbltcImE2ZjNcIixcIu6ellwiXSxcbltcImE2ZjZcIixcIu6el1wiLDhdLFxuW1wiYTc0MFwiLFwi7pyGXCIsNjJdLFxuW1wiYTc4MFwiLFwi7p2FXCIsMzJdLFxuW1wiYTdjMlwiLFwi7p6gXCIsMTRdLFxuW1wiYTdmMlwiLFwi7p6vXCIsMTJdLFxuW1wiYTg5NlwiLFwi7p68XCIsMTBdLFxuW1wiYThiY1wiLFwi7p+HXCJdLFxuW1wiYThiZlwiLFwix7lcIl0sXG5bXCJhOGMxXCIsXCLun4nun4run4vun4xcIl0sXG5bXCJhOGVhXCIsXCLun41cIiwyMF0sXG5bXCJhOTU4XCIsXCLun6JcIl0sXG5bXCJhOTViXCIsXCLun6NcIl0sXG5bXCJhOTVkXCIsXCLun6Tun6Xun6ZcIl0sXG5bXCJhOTg5XCIsXCLjgL7iv7BcIiwxMV0sXG5bXCJhOTk3XCIsXCLun7RcIiwxMl0sXG5bXCJhOWYwXCIsXCLuoIFcIiwxNF0sXG5bXCJhYWExXCIsXCLugIBcIiw5M10sXG5bXCJhYmExXCIsXCLugZ5cIiw5M10sXG5bXCJhY2ExXCIsXCLugrxcIiw5M10sXG5bXCJhZGExXCIsXCLuhJpcIiw5M10sXG5bXCJhZWExXCIsXCLuhbhcIiw5M10sXG5bXCJhZmExXCIsXCLuh5ZcIiw5M10sXG5bXCJkN2ZhXCIsXCLuoJBcIiw0XSxcbltcImY4YTFcIixcIu6ItFwiLDkzXSxcbltcImY5YTFcIixcIu6KklwiLDkzXSxcbltcImZhYTFcIixcIu6LsFwiLDkzXSxcbltcImZiYTFcIixcIu6NjlwiLDkzXSxcbltcImZjYTFcIixcIu6OrFwiLDkzXSxcbltcImZkYTFcIixcIu6QilwiLDkzXSxcbltcImZlNTBcIixcIuK6ge6glu6gl+6gmOK6hOORs+ORh+K6iOK6i+6gnuOWnuOYmuOYjuK6jOK6l+OlruOkmO6gpuOnj+Onn+Ops+OnkO6gq+6grOOtjuOxruOzoOK6p+6gse6gsuK6quSBluSFn+K6ruSMt+K6s+K6tuK6t+6gu+SOseSOrOK6u+SPneSTluSZoeSZjO6hg1wiXSxcbltcImZlODBcIixcIuSco+ScqeSdvOSejeK7iuSlh+SluuSlveSmguSmg+SmheSmhuSmn+Smm+Smt+Smtu6hlO6hleSyo+Syn+SyoOSyoeSxt+SyouS0k1wiLDYsXCLktq7uoaTukahcIiw5M11cbl1cbiIsIm1vZHVsZS5leHBvcnRzPVtcbltcIjBcIixcIlxcdTAwMDBcIiwxMjhdLFxuW1wiYTFcIixcIu+9oVwiLDYyXSxcbltcIjgxNDBcIixcIuOAgOOAgeOAgu+8jO+8juODu++8mu+8m++8n++8geOCm+OCnMK0772AwqjvvL7vv6PvvL/jg73jg77jgp3jgp7jgIPku53jgIXjgIbjgIfjg7zigJXigJDvvI/vvLzvvZ7iiKXvvZzigKbigKXigJjigJnigJzigJ3vvIjvvInjgJTjgJXvvLvvvL3vvZvvvZ3jgIhcIiw5LFwi77yL77yNwrHDl1wiXSxcbltcIjgxODBcIixcIsO377yd4omg77yc77ye4omm4omn4oie4oi04pmC4pmAwrDigLLigLPihIPvv6XvvITvv6Dvv6HvvIXvvIPvvIbvvIrvvKDCp+KYhuKYheKXi+KXj+KXjuKXh+KXhuKWoeKWoOKWs+KWsuKWveKWvOKAu+OAkuKGkuKGkOKGkeKGk+OAk1wiXSxcbltcIjgxYjhcIixcIuKIiOKIi+KKhuKKh+KKguKKg+KIquKIqVwiXSxcbltcIjgxYzhcIixcIuKIp+KIqO+/ouKHkuKHlOKIgOKIg1wiXSxcbltcIjgxZGFcIixcIuKIoOKKpeKMkuKIguKIh+KJoeKJkuKJquKJq+KImuKIveKIneKIteKIq+KIrFwiXSxcbltcIjgxZjBcIixcIuKEq+KAsOKZr+KZreKZquKAoOKAocK2XCJdLFxuW1wiODFmY1wiLFwi4pevXCJdLFxuW1wiODI0ZlwiLFwi77yQXCIsOV0sXG5bXCI4MjYwXCIsXCLvvKFcIiwyNV0sXG5bXCI4MjgxXCIsXCLvvYFcIiwyNV0sXG5bXCI4MjlmXCIsXCLjgYFcIiw4Ml0sXG5bXCI4MzQwXCIsXCLjgqFcIiw2Ml0sXG5bXCI4MzgwXCIsXCLjg6BcIiwyMl0sXG5bXCI4MzlmXCIsXCLOkVwiLDE2LFwizqNcIiw2XSxcbltcIjgzYmZcIixcIs6xXCIsMTYsXCLPg1wiLDZdLFxuW1wiODQ0MFwiLFwi0JBcIiw1LFwi0IHQllwiLDI1XSxcbltcIjg0NzBcIixcItCwXCIsNSxcItGR0LZcIiw3XSxcbltcIjg0ODBcIixcItC+XCIsMTddLFxuW1wiODQ5ZlwiLFwi4pSA4pSC4pSM4pSQ4pSY4pSU4pSc4pSs4pSk4pS04pS84pSB4pSD4pSP4pST4pSb4pSX4pSj4pSz4pSr4pS74pWL4pSg4pSv4pSo4pS34pS/4pSd4pSw4pSl4pS44pWCXCJdLFxuW1wiODc0MFwiLFwi4pGgXCIsMTksXCLihaBcIiw5XSxcbltcIjg3NWZcIixcIuONieOMlOOMouONjeOMmOOMp+OMg+OMtuONkeONl+OMjeOMpuOMo+OMq+ONiuOMu+OOnOOOneOOnuOOjuOOj+OPhOOOoVwiXSxcbltcIjg3N2VcIixcIuONu1wiXSxcbltcIjg3ODBcIixcIuOAneOAn+KEluOPjeKEoeOKpFwiLDQsXCLjiLHjiLLjiLnjjb7jjb3jjbziiZLiiaHiiKviiK7iiJHiiJriiqXiiKDiiJ/iir/iiLXiiKniiKpcIl0sXG5bXCI4ODlmXCIsXCLkupzllJblqIPpmL/lk4DmhJvmjKjlp7bpgKLokbXojJznqZDmgqrmj6HmuKXml63okaboiqbpr7XmopPlnKfmlqHmibHlrpvlp5Dombvpo7TntaLntr7pro7miJbnsp/oorflronlurXmjInmmpfmoYjpl4fpno3mnY/ku6XkvIrkvY3kvp3lgYnlm7LlpLflp5TlqIHlsInmg5/mhI/mhbDmmJPmpIXngrrnlY/nlbDnp7vntq3nt6/og4PokI7ooaPorILpgZXpgbrljLvkupXkuqXln5/ogrLpg4Hno6/kuIDlo7HmuqLpgLjnqLLojKjoiovpsK/lhYHljbDlkr3lk6Hlm6Dlp7vlvJXpo7Lmt6vog6TolK1cIl0sXG5bXCI4OTQwXCIsXCLpmaLpmbDpmqDpn7vlkIvlj7Plrofng4/nvr3ov4Lpm6jlja/ptZznqrrkuJHnopPoh7zmuKblmJjllITmrJ3olJrpsLvlp6Xljqnmtabnk5zplo/lmYLkupHpgYvpm7LojY/ppIzlj6HllrblrLDlvbHmmKDmm7PmoITmsLjms7PmtKnnkZvnm4jnqY7poLToi7HooZvoqaDpi63mtrLnlqvnm4rpp4XmgqborIHotorplrLmpo7ljq3lhoZcIl0sXG5bXCI4OTgwXCIsXCLlnJLloLDlpYTlrrTlu7bmgKjmjqnmj7Tmsr/mvJTngo7nhJTnhZnnh5XnjL/nuIHoibboi5HolpfpgaDpiZvptJvloanmlrzmsZrnlKXlh7nlpK7lpaXlvoDlv5zmirzml7rmqKrmrKfmrrTnjovnv4HopZbptKzptI7pu4TlsqHmspbojbvlhITlsYvmhrboh4bmobbniaHkuZnkv7rljbjmganmuKnnqY/pn7PkuIvljJbku67kvZXkvL3kvqHkvbPliqDlj6/lmInlpI/lq4Hlrrblr6Hnp5HmmofmnpzmnrbmrYzmsrPngavnj4Lnpo3npr7nqLznrofoirHoi5vojITojbfoj6/oj5PonaboqrLlmKnosqjov6bpgY7pnJ7omorkv4Tls6jmiJHniZnnlLvoh6Xoir3om77os4Dpm4XppJPpp5Xku4vkvJrop6Plm57loYrlo4rlu7vlv6vmgKrmgpTmgaLmh5DmiJLmi5DmlLlcIl0sXG5bXCI4YTQwXCIsXCLprYHmmabmorDmtbfngbDnlYznmobntbXoiqXon7nplovpmo7osp3lh7Hlir7lpJblkrPlrrPltJbmhajmpoLmtq/noo3ok4vooZfoqbLpjqfpqrjmtazppqjom5nlnqPmn7/om47piI7lioPlmoflkITlu5Pmi6HmkrnmoLzmoLjmrrvnjbLnorrnqavopprop5LotavovIPpg63plqPpmpTpnanlrablsrPmpb3poY3poY7mjpvnrKDmqKtcIl0sXG5bXCI4YTgwXCIsXCLmqb/morbpsI3mvZ/libLllp3mgbDmi6zmtLvmuIfmu5HokZvopJDovYTkuJTpsLnlj7bmpJvmqLrpnoTmoKrlhZznq4PokrLph5zpjozlmZvptKjmoKLojIXokLHnsqXliIjoi4Xnk6bkub7kvoPlhqDlr5LliIrli5jli6flt7vllprloKrlp6blrozlrpjlr5vlubLlubnmgqPmhJ/mhaPmhr7mj5vmlaLmn5HmoZPmo7rmrL7mrZPmsZfmvKLmvpfmvYXnkrDnlJjnm6PnnIvnq7/nrqHnsKHnt6nnvLbnv7Dogp3oiabojp7oprPoq4zosqvpgoTpkZHplpPplpHplqLpmaXpn5PppKjoiJjkuLjlkKvlsrjlt4znjqnnmYznnLzlsqnnv6votIvpm4HpoJHpoZTpoZjkvIHkvI7ljbHllpzlmajln7rlpYflrInlr4TlspDluIzlub7lv4zmj67mnLrml5fml6LmnJ/mo4vmo4RcIl0sXG5bXCI4YjQwXCIsXCLmqZ/luLDmr4XmsJfmsb3nlb/npYjlraPnqIDntIDlvr3opo/oqJjosrTotbfou4zovJ3po6LpqI7prLzkuoDlgb3lhIDlppPlrpzmiK/mioDmk6zmrLrniqDnlpHnpYfnvqnon7voqrzorbDmjqzoj4rpnqDlkInlkIPllqvmoZTmqZjoqbDnoKfmnbXpu43ljbTlrqLohJromZDpgIbkuJjkuYXku4fkvJHlj4rlkLjlrq7lvJPmgKXmlZFcIl0sXG5bXCI4YjgwXCIsXCLmnL3msYLmsbLms6PngbjnkIPnqbbnqq7nrIjntJrns77ntabml6fniZvljrvlsYXlt6jmi5Lmi6DmjJnmuKDomZroqLHot53pi7jmvIHnpqbprZrkuqjkuqvkuqzkvpvkvqDlg5HlhYfnq7blhbHlh7bljZTljKHljb/lj6vllqzlooPls6HlvLflvYrmgK/mgZDmga3mjJ/mlZnmqYvms4Hni4Lni63nn6/og7johIXoiIjolY7pg7fpj6Hpn7/ppZfpqZrku7Dlh53lsK3mmoHmpa3lsYDmm7LmpbXnjonmoZDnsoHlg4Xli6TlnYflt77pjKbmlqTmrKPmrL3nkLTnpoHnpr3nrYvnt4roirnoj4zoob/opZ/orLnov5Hph5HlkJ/pioDkuZ3lgLblj6XljLrni5fnjpbnn6noi6bouq/pp4bpp4jpp5LlhbfmhJromZ7llrDnqbrlgbblr5PpgYfpmoXkuLLmq5vph6flsZHlsYhcIl0sXG5bXCI4YzQwXCIsXCLmjpjnqp/mspPpnbTovaHnqqrnhorpmojnsoLmoJfnubDmoZHpjazli7LlkJvolqvoqJPnvqTou43pg6HljabooojnpYHkv4Llgr7liJHlhYTllZPlnK3nj6rlnovlpZHlvaLlvoTmgbXmhbbmhafmhqnmjrLmkLrmlazmma/moYLmuJPnlabnqL3ns7vntYzntpnnuYvnvavojI7ojYrom43oqIjoqaPorabou73poJrpto/oirjov47pr6hcIl0sXG5bXCI4YzgwXCIsXCLliofmiJ/mkoPmv4DpmpnmoYHlgpHmrKDmsbrmvZTnqbTntZDooYDoqKPmnIjku7blgLnlgKblgaXlhbzliLjliaPllqflnI/loIXlq4zlu7rmhrLmh7jmi7PmjbLmpJzmqKnnib3niqznjK7noJTnoa/ntbnnnIzogqnopovorJnos6Lou5LpgaPpjbXpmbrpoZXpqJPpubjlhYPljp/ljrPlubvlvKbmuJvmupDnjoTnj77ntYPoiLfoqIDoq7rpmZDkuY7lgIvlj6Tlkbzlm7rlp5HlraTlt7HluqvlvKfmiLjmlYXmnq/muZbni5Dns4roorTogqHog6Hoj7DomY7oqofot6jpiLfpm4fpoafpvJPkupTkupLkvI3ljYjlkYnlkL7lqK/lvozlvqHmgp/moqfmqo7nkZrnooHoqp7oqqTorbfphpDkuZ7pr4nkuqTkvbzkvq/lgJnlgJblhYnlhazlip/lirnli77ljprlj6PlkJFcIl0sXG5bXCI4ZDQwXCIsXCLlkI7llonlnZHlnqLlpb3lrZTlrZ3lro/lt6Xlt6flt7flubjluoPluprlurflvJjmgZLmhYzmipfmi5jmjqfmlLvmmILmmYPmm7Tmna3moKHmopfmp4vmsZ/mtKrmtanmuK/mup3nlLLnmofnoaznqL/ns6DntIXntJjntZ7ntrHogJXogIPogq/ogrHohZToho/oiKrojZLooYzooaHorJvosqLos7zpg4rphbXpibHnoL/pi7zplqTpmY1cIl0sXG5bXCI4ZDgwXCIsXCLpoIXpppnpq5jptLvliZvliqvlj7flkIjlo5Xmi7fmv6DosarovZ/purnlhYvliLvlkYrlm73nqYDphbfptaDpu5LnjYTmvInohbDnlJHlv73mg5rpqqjni5vovrzmraTpoIPku4rlm7DlnaTlor7lqZrmgajmh4fmmI/mmIbmoLnmorHmt7fnl5XntLroia7prYLkupvkvZDlj4nllIblta/lt6blt67mn7vmspnnkbPnoILoqZDpjpboo5/lnZDluqfmjKvlgrXlgqzlho3mnIDlk4nloZ7lprvlrrDlvanmiY3mjqHmoL3mrbPmuIjngb3ph4fnioDnoJXnoKbnpa3mlo7ntLDoj5zoo4HovInpmpvliaTlnKjmnZDnvarosqHlhrTlnYLpmKrloLrmporogrTlkrLltI7ln7znopXpt7rkvZzliYrlkovmkL7mmKjmnJTmn7XnqoTnrZbntKLpjK/moZzprq3nrLnljJnlhorliLdcIl0sXG5bXCI4ZTQwXCIsXCLlr5/mi7bmkq7mk6bmnK3mrrrolqnpm5HnmpDpr5bmjYzpjIbprqvnmr/mmZLkuInlgpjlj4LlsbHmg6jmkpLmlaPmoZ/nh6bnj4rnlKPnrpfnuoLompXoroPos5vphbjppJDmlqzmmqvmrovku5Xku5TkvLrkvb/liLrlj7jlj7Lll6Plm5vlo6vlp4vlp4nlp7/lrZDlsY3luILluKvlv5fmgJ3mjIfmlK/lrZzmlq/mlr3ml6jmnp3mraJcIl0sXG5bXCI4ZTgwXCIsXCLmrbvmsI/njYXnpYnnp4Hns7jntJnntKvogqLohILoh7PoppboqZ7oqanoqaboqozoq67os4fos5zpm4zpo7zmra/kuovkvLzkvo3lhZDlrZflr7rmhYjmjIHmmYLmrKHmu4vmsrvniL7nkr3nl5Tno4HnpLrogIzogLPoh6rokpTovp7msZDpub/lvI/orZjptKvnq7rou7jlro3pm6vkuIPlj7Hln7flpLHlq4nlrqTmgonmub/mvIbnlr7os6rlrp/olIDnr6DlgbLmn7Toip3lsaHolYrnuJ7oiI7lhpnlsITmjajotabmlpznha7npL7ntJfogIXorJ3ou4rpga7om4fpgqrlgJ/li7rlsLrmnZPngbzniLXphYzph4jpjKvoi6Xlr4LlvLHmg7nkuLvlj5blrojmiYvmnLHmrorni6nnj6DnqK7ohavotqPphZLpppblhJLlj5flkarlr7/mjojmqLnntqzpnIDlm5rlj47lkahcIl0sXG5bXCI4ZjQwXCIsXCLlrpflsLHlt57kv67mhIHmi77mtLLnp4Dnp4vntYLnuY3nv5Loh63oiJ/okpDooYbopbLorpDoubTovK/pgLHphYvphazpm4bphpzku4DkvY/lhYXljYHlvpPmiI7mn5TmsYHmuIvnjaPnuKbph43pioPlj5TlpJnlrr/mt5HnpZ3nuK7nspvlob7nhp/lh7rooZPov7Dkv4rls7vmmKXnnqznq6PoiJzpp7/lh4blvqrml6zmpa/mronmt7NcIl0sXG5bXCI4ZjgwXCIsXCLmupbmvaTnm77ntJTlt6HpgbXphofpoIblh6bliJ3miYDmmpHmm5nmuJrlurbnt5LnvbLmm7jolq/ol7foq7jliqnlj5nlpbPluo/lvpDmgZXpi6TpmaTlgrflhJ/li53ljKDljYflj6zlk6jllYbllLHlmJflpajlpr7lqLzlrrXlsIblsI/lsJHlsJrluoTluorlu6DlvbDmib/mioTmi5vmjozmjbfmmIfmmIzmmK3mmbbmnb7moqLmqJ/mqLXmsrzmtojmuInmuZjnhLznhKbnhafnl4fnnIHnoZ3npIHnpaXnp7Dnq6DnrJHnsqfntLnogpboj5bokovolYnooZ3oo7PoqJ/oqLzoqZToqbPosaHos57phqTpiabpjb7pkJjpmpzpnpjkuIrkuIjkuJ7kuZflhpflibDln47loLTlo4zlrKLluLjmg4Xmk77mnaHmnZbmtYTnirbnlbPnqaPokrjorbLphrjpjKDlmLHln7Tpo75cIl0sXG5bXCI5MDQwXCIsXCLmi63mpI3mrpbnh63nuZTogbfoibLop6bpo5/onZXovrHlsLvkvLjkv6HkvrXllIflqKDlr53lr6nlv4PmhY7mjK/mlrDmmYvmo67mppvmtbjmt7HnlLPnlrnnnJ/npZ7np6bntLPoh6Poiq/olqropqroqLrouqvovpvpgLLph53pnIfkurrku4HliIPlobXlo6zlsIvnlJrlsL3ohY7oqIrov4XpmaPpna3nrKXoq4/poIjphaLlm7PljqhcIl0sXG5bXCI5MDgwXCIsXCLpgJflkLnlnoLluKXmjqjmsLTngornnaHnsovnv6DoobDpgYLphZTpjJDpjJjpmo/nkZ7pq4TltIfltanmlbDmnqLotqjpm5vmja7mnYnmpJnoj4XpoJfpm4Doo77mvoTmkbrlr7jkuJbngKznlZ3mmK/lh4TliLbli6Llp5PlvoHmgKfmiJDmlL/mlbTmmJ/mmbTmo7LmoJbmraPmuIXnibLnlJ/nm5vnsr7ogZblo7Doo73opb/oqqDoqpPoq4vpgJ3phpLpnZLpnZnmlonnqI7ohIbpmrvluK3mg5zmiJrmlqXmmJTmnpDnn7PnqY3nsY3nuL7ohIrosqzotaTot6HouZ/noqnliIfmi5nmjqXmkYLmipjoqK3nqoPnr4Doqqzpm6rntbboiIzonYnku5nlhYjljYPljaDlrqPlsILlsJblt53miKbmiYfmkrDmoJPmoLTms4nmtYXmtJfmn5PmvZznhY7nhb3ml4vnqb/nrq3nt5pcIl0sXG5bXCI5MTQwXCIsXCLnuYrnvqjohbroiJvoiLnolqboqa7os47ot7Xpgbjpgbfpiq3pipHploPprq7liY3lloTmvLjnhLblhajnpoXnuZXohrPns47lmYzloZHlsqjmjqrmm77mm73mpZrni5nnlo/nlo7npI7npZbnp5/nspfntKDntYTomIfoqLTpmLvpgaHpvKDlg6flibXlj4zlj6LlgInllqrlo67lpY/niL3lrovlsaTljJ3mg6Pmg7PmjZzmjoPmjL/mjrtcIl0sXG5bXCI5MTgwXCIsXCLmk43ml6nmm7nlt6Pmp43mp73mvJXnh6Xkuonnl6nnm7jnqpPns5/nt4/ntpzogaHojYnojZjokazokrzol7voo4XotbDpgIHpga3pjpfpnJzpqJLlg4/lopfmho7oh5PolLXotIjpgKDkv4PlgbTliYfljbPmga/mjYnmnZ/muKzotrPpgJ/kv5flsZ7os4rml4/ntprljZLoopblhbbmj4PlrZjlravlsIrmkI3mnZHpgZzku5blpJrlpKrmsbDoqZHllL7loJXlpqXmg7DmiZPmn4HoiLXmpZXpmYDpp4TpqKjkvZPloIblr77ogJDlsrHluK/lvoXmgKDmhYvmiLTmm7/ms7Dmu57og47ohb/oi5TooovosrjpgIDpgK7pmorpu5vpr5vku6Plj7DlpKfnrKzpho3poYzpt7nmu53ngKfljZPllYTlroXmiZjmip7mi5PmsqLmv6/nkKLoqJfpkLjmv4Hoq77ojLjlh6fom7jlj6pcIl0sXG5bXCI5MjQwXCIsXCLlj6nkvYbpgZTovrDlparohLHlt73nq6rovr/mo5rosLfni7jpsYjmqL3oqrDkuLnljZjlmIblnabmi4XmjqLml6bmrY7mt6HmuZvngq3nn63nq6/nrqrntrvogL3og4bom4voqpXpjZvlm6Plo4flvL7mlq3mmpbmqoDmrrXnlLfoq4flgKTnn6XlnLDlvJvmgaXmmbrmsaDnl7TnqJrnva7oh7TonJjpgYXpprPnr4nnlZznq7nnrZHok4RcIl0sXG5bXCI5MjgwXCIsXCLpgJDnp6nnqpLojLblq6HnnYDkuK3ku7Llrpnlv6Dmir3mmLzmn7Hms6jomavoobfoqLvphY7pi7Ppp5DmqJfngKbnjKroi6fokZfosq/kuIHlhYblh4vllovlr7XluJbluLPluoHlvJTlvLXlvavlvrTmh7LmjJHmmqLmnJ3mva7niZLnlLrnnLrogbTohLnohbjonbboqr/oq5zotoXot7PpiprplbfpoILps6Xli4XmjZfnm7TmnJXmsojnj43os4Ppjq7pmbPmtKXlopzmpI7mp4zov73pjprnl5vpgJrloZrmoILmjrTmp7vkvYPmvKzmn5jovrvolKbntrTpjZTmpL/mvbDlnarlo7flrKzntKzniKrlkIrph6PptrTkuq3kvY7lgZzlgbXliYPosp7lkYjloKTlrprluJ3lupXluq3lu7flvJ/mgozmirXmjLrmj5Dmoq/msYDnoofnpo7nqIvnt6DoiYfoqILoq6bouYTpgJNcIl0sXG5bXCI5MzQwXCIsXCLpgrjphK3ph5jpvI7ms6XmkZjmk6LmlbXmu7TnmoTnrJvpganpj5Hmurrlk7LlvrnmkqTovY3ov63piYTlhbjloavlpKnlsZXlupfmt7vnuo/nlJzosrzou6LpoZvngrnkvJ3mrr/mvrHnlLDpm7vlhY7lkJDloLXloZflpqzlsaDlvpLmlpfmnZzmuKHnmbvoj5/os63pgJTpg73pjY3noKXnoLrliqrluqblnJ/lpbTmgJLlgJLlhZrlhqxcIl0sXG5bXCI5MzgwXCIsXCLlh43liIDllJDloZTloZjlpZflrpXls7bltovmgrzmipXmkK3mnbHmoYPmorzmo5/nm5fmt5jmua/mtpvnga/nh4jlvZPnl5jnpbfnrYnnrZTnrZLns5bntbHliLDokaPolanol6ToqI7orITosYbouI/pgIPpgI/pkJnpmbbpoK3pqLDpl5jlg43li5XlkIzloILlsI7mhqfmkp7mtJ7nnrPnq6Xog7TokITpgZPpioXls6DptIfljL/lvpflvrPmtpznibnnnaPnpr/nr6Tmr5Lni6zoqq3moIPmqaHlh7jnqoHmpLTlsYrps7boi6vlr4XphYnngJ7lmbjlsa/mg4fmlabmsozosZrpgYHpoJPlkZHmm4fpiI3lpYjpgqPlhoXkuY3lh6rolpnorI7ngZjmjbrpjYvmpaLpprTnuITnlbfljZfmpaDou5/pm6PmsZ3kuozlsLzlvJDov6nljILos5Hogonombnlu7/ml6XkubPlhaVcIl0sXG5bXCI5NDQwXCIsXCLlpoLlsL/pn67ku7vlporlv43oqo3mv6HnprDnpaLlr6fokbHnjKvnhrHlubTlv7Xmjbvmkprnh4PnspjkuYPlu7zkuYvln5zlmqLmgqnmv4PntI3og73ohLPohr/ovrLoppfomqTlt7Tmiormkq3opofmnbfms6LmtL7nkLbnoLTlqYbnvbXoiq3ppqzkv7Plu4Pmi53mjpLmlZfmna/nm4PniYzog4zogrrovKnphY3lgI3ln7nlqpLmooVcIl0sXG5bXCI5NDgwXCIsXCLmpbPnhaTni73osrflo7Los6DpmarpgJnonb/np6Tnn6fokKnkvK/liaXljZrmi43mn4/ms4rnmb3nrpTnspXoiLboloTov6vmm53mvKDniIbnuJvojqvpp4Hpuqblh73nrrHnobLnrrjogofnrYjmq6jluaHogoznlZHnlaDlhavpiaLmuoznmbrphpfpq6rkvJDnvbDmipznrY/plqXps6nlmbrloZnom6TpmrzkvLTliKTljYrlj43lj5vluIbmkKzmlpHmnb/msL7msY7niYjniq/nj63nlZTnuYHoiKzol6nosqnnr4Tph4bnhanpoJLpo6/mjL3mmannlarnm6Tno5DolYPom67ljKrljZHlkKblpoPluoflvbzmgrLmiYnmibnmiqvmlpDmr5Tms4znlrLnmq7nopHnp5jnt4vnvbfogqXooqvoqrnosrvpgb/pnZ7po5vmqIvnsLjlgpnlsL7lvq7mnofmr5jnkLXnnInnvo5cIl0sXG5bXCI5NTQwXCIsXCLpvLvmn4rnqJfljLnnlovpq63lvabohp3oj7HogpjlvLzlv4XnlaLnrYbpgLzmoaflp6vlqpvntJDnmb7orKzkv7XlvarmqJnmsLfmvILnk6LnpajooajoqZXosbnlu5/mj4/nl4Xnp5Loi5fpjKjpi7Lokpzom63psK3lk4HlvazmlozmtZzngJXosqfos5PpoLvmlY/nk7bkuI3ku5jln6DlpKvlqablr4zlhqjluIPlupzmgJbmibbmlbdcIl0sXG5bXCI5NTgwXCIsXCLmlqfmma7mta7niLbnrKbohZDohproipnorZzosqDos6botbTpmJzpmYTkvq7mkqvmraboiJ7okaHolarpg6jlsIHmpZPpoqjokbrolZfkvI/lia/lvqnluYXmnI3npo/ohbnopIfopobmt7XlvJfmiZXmsrjku4/nianprpLliIblkLvlmbTlorPmhqTmia7nhJrlpa7nsonns57ntJvpm7DmlofogZ7kuJnkvbXlhbXloYDluaPlubPlvIrmn4TkuKbolL3plonpmZvnsbPpoIHlg7vlo4HnmZbnoqfliKXnnqXolJHnroblgY/lpInniYfnr4fnt6jovrrov5TpgY3kvr/li4nlqKnlvIHpnq3kv53oiJfpi6rlnIPmjZXmrannlKvoo5zovJTnqYLli5/lopPmhZXmiIrmmq7mr43nsL/oj6nlgKPkv7jljIXlkYbloLHlpYnlrp3ls7Dls6/ltKnlupbmirHmjafmlL7mlrnmnItcIl0sXG5bXCI5NjQwXCIsXCLms5Xms6Hng7nnoLLnuKvog57oirPokIzok6zonILopJLoqKrosYrpgqbpi5Lpo73ps7PptazkuY/kuqHlgo3liZblnYrlpqjluL3lv5jlv5nmiL/mmrTmnJvmn5Dmo5LlhpLntKHogqrohqjorIDosozosr/pib7pmLLlkKDpoKzljJflg5XljZzloqjmkrLmnLTniafnnabnqYbph6bli4PmsqHmrobloIDluYzlpZTmnKznv7vlh6Hnm4ZcIl0sXG5bXCI5NjgwXCIsXCLmkanno6jprZTpurvln4vlprnmmKfmnprmr47lk6nmp5nluZXohpzmnpXprqrmn77psZLmoZ3kuqbkv6Plj4jmirnmnKvmsqvov4Tkvq3nua3pur/kuIfmhaLmuoDmvKvolJPlkbPmnKrprYXlt7PnrpXlsqzlr4bonJzmuYrok5HnqJTohIjlppnnso3msJHnnKDli5nlpKLnhKHniZ/nn5vpnKfptaHmpIvlqb/lqJjlhqXlkI3lkb3mmI7nm5/ov7fpipjps7Tlp6rniZ3mu4XlhY3mo4nntr/nt6zpnaLpurrmkbjmqKHojILlpoTlrZ/mr5vnjJvnm7LntrLogJfokpnlhLLmnKjpu5nnm67mnaLli7/ppIXlsKTmiLvnsb7osrDllY/mgrbntIvploDljIHkuZ/lhrblpJzniLrogLbph47lvKXnn6LljoTlvbnntITolqzoqLPouo3pnZbmn7Polq7pkZPmhInmhIjmsrnnmZJcIl0sXG5bXCI5NzQwXCIsXCLoq63ovLjllK/kvZHlhKrli4flj4vlrqXlub3mgqDmhoLmj5bmnInmn5rmuafmtoznjLbnjLfnlLHnpZDoo5XoqpjpgYrpgpHpg7Xpm4Tono3lpJXkuojkvZnkuI7oqonovL/poJDlgq3lubzlppblrrnlurjmj5rmj7rmk4Hmm5zmpYrmp5jmtIvmurbnhpTnlKjnqq/nvorogIDokYnok4nopoHorKHouIrpgaXpmb3ppIrmhb7mipHmrLJcIl0sXG5bXCI5NzgwXCIsXCLmsoPmtbTnv4znv7zmt4DnvoXonrroo7jmnaXojrHpoLzpm7fmtJvntaHokL3pharkubHljbXltZDmrITmv6vol43omK3opqfliKnlkI/lsaXmnY7moqjnkIbnkoPnl6Loo4/oo6Hph4zpm6Lpmbjlvovnjofnq4vokY7mjqDnlaXlionmtYHmupznkInnlZnnoavnspLpmobnq5zpvo3kvrbmha7ml4XomZzkuobkuq7lg5rkuKHlh4zlr67mlpnmooHmtrznjJ/nmYLnnq3nqJzns6foia/oq5Lpgbzph4/pmbXpoJjlipvnt5HlgKvljpjmnpfmt4vnh5DnkLPoh6jovKrpmqPpsZfpup/nkaDloYHmtpnntK/poZ7ku6TkvLbkvovlhrflirHltrrmgJznjrLnpLzoi5PpiLTpmrfpm7bpnIrpupfpvaLmmqbmrbTliJfliqPng4joo4Llu4nmgYvmhpDmvKPnhYnnsL7nt7Toga9cIl0sXG5bXCI5ODQwXCIsXCLok67pgKPpjKzlkYLpra/mq5Pngonos4Lot6/pnLLlirTlqYHlu4rlvITmnJfmpbzmppTmtarmvI/niaLni7znr63ogIHogb7onYvpg47lha3pupPnpoTogovpjLLoq5blgK3lkozoqbHmraros4TohIfmg5HmnqDpt7LkupnkupjpsJDoqavol4HolajmpIDmub7nopfohZVcIl0sXG5bXCI5ODlmXCIsXCLlvIzkuJDkuJXkuKrkuLHkuLbkuLzkuL/kuYLkuZbkuZjkuoLkuoXosavkuoroiJLlvI3kuo7kup7kup/kuqDkuqLkurDkurPkurbku47ku43ku4Tku4bku4Lku5fku57ku63ku5/ku7fkvInkvZrkvLDkvZvkvZ3kvZfkvYfkvbbkvojkvo/kvpjkvbvkvankvbDkvpHkva/kvobkvpblhJjkv5Tkv5/kv47kv5jkv5vkv5Hkv5rkv5Dkv6Tkv6XlgJrlgKjlgJTlgKrlgKXlgIXkvJzkv7blgKHlgKnlgKzkv77kv6/lgJHlgIblgYPlgYfmnIPlgZXlgZDlgYjlgZrlgZblgazlgbjlgoDlgprlgoXlgrTlgrJcIl0sXG5bXCI5OTQwXCIsXCLlg4nlg4rlgrPlg4Llg5blg57lg6Xlg63lg6Plg67lg7nlg7XlhInlhIHlhILlhJblhJXlhJTlhJrlhKHlhLrlhLflhLzlhLvlhL/lhYDlhZLlhYzlhZTlhaLnq7jlhanlharlha7lhoDlhoLlm5jlhozlhonlho/lhpHlhpPlhpXlhpblhqTlhqblhqLlhqnlhqrlhqvlhrPlhrHlhrLlhrDlhrXlhr3lh4Xlh4nlh5vlh6DomZXlh6nlh61cIl0sXG5bXCI5OTgwXCIsXCLlh7Dlh7Xlh77liITliIvliJTliI7liKfliKrliK7liLPliLnliY/liYTliYvliYzliZ7liZTliarlibTlianlibPlib/lib3lio3lipTlipLlibHliojlipHovqjovqfliqzliq3lirzlirXli4Hli43li5fli57li6Pli6bpo63li6Dli7Pli7Xli7jli7nljIbljIjnlLjljI3ljJDljI/ljJXljJrljKPljK/ljLHljLPljLjljYDljYbljYXkuJfljYnljY3lh5bljZ7ljanlja7lpJjljbvljbfljoLljpbljqDljqbljqXljq7ljrDljrblj4PnsJLpm5nlj5/mm7znh67lj67lj6jlj63lj7rlkIHlkL3lkYDlkKzlkK3lkLzlkK7lkLblkKnlkJ3lkY7lko/lkbXlko7lkZ/lkbHlkbflkbDlkpLlkbvlkoDlkbblkoTlkpDlkoblk4flkqLlkrjlkqXlkqzlk4Tlk4jlkqhcIl0sXG5bXCI5YTQwXCIsXCLlkqvlk4LlkqTlkr7lkrzlk5jlk6Xlk6bllI/llJTlk73lk67lk63lk7rlk6LllLnllYDllaPllYzllK7llZzllYXllZbllZfllLjllLPllZ3llpnlloDlkq/llorllp/llbvllb7llpjllp7llq7llbzlloPllqnllofllqjll5rll4Xll5/ll4Tll5zll6Tll5TlmJTll7flmJbll77ll73lmJvll7nlmY7lmZDnh5/lmLTlmLblmLLlmLhcIl0sXG5bXCI5YTgwXCIsXCLlmavlmaTlmK/lmazlmarlmoblmoDlmorlmqDlmpTlmo/lmqXlmq7lmrblmrTlm4Llmrzlm4Hlm4Plm4Dlm4jlm47lm5Hlm5Plm5flm67lm7nlnIDlm7/lnITlnInlnIjlnIvlnI3lnJPlnJjlnJbll4flnJzlnKblnLflnLjlnY7lnLvlnYDlnY/lnanln4DlnojlnaHlnb/lnonlnpPlnqDlnrPlnqTlnqrlnrDln4Pln4bln5Tln5Lln5PloIrln5bln6PloIvloJnloJ3lobLloKHloaLloYvlobDmr4DloZLloL3lobnlooXlornlop/loqvlorrlo57lorvlorjloq7lo4Xlo5Plo5Hlo5flo5nlo5jlo6Xlo5zlo6Tlo5/lo6/lo7rlo7nlo7vlo7zlo73lpILlpIrlpJDlpJvmoqblpKXlpKzlpK3lpLLlpLjlpL7nq5LlpZXlpZDlpY7lpZrlpZjlpaLlpaDlpaflpazlpalcIl0sXG5bXCI5YjQwXCIsXCLlpbjlpoHlpp3kvZ7kvqvlpqPlprLlp4blp6jlp5zlpo3lp5nlp5rlqKXlqJ/lqJHlqJzlqInlqJrlqYDlqazlqYnlqLXlqLblqaLlqarlqprlqrzlqr7lq4vlq4Llqr3lq6Plq5flq6blq6nlq5blq7rlq7vlrIzlrIvlrJblrLLlq5DlrKrlrLblrL7lrYPlrYXlrYDlrZHlrZXlrZrlrZvlraXlranlrbDlrbPlrbXlrbjmlojlrbrlroBcIl0sXG5bXCI5YjgwXCIsXCLlroPlrqblrrjlr4Plr4flr4nlr5Tlr5Dlr6Tlr6blr6Llr57lr6Xlr6vlr7Dlr7blr7PlsIXlsIflsIjlsI3lsJPlsKDlsKLlsKjlsLjlsLnlsYHlsYblsY7lsZPlsZDlsY/lrbHlsazlsa7kuaLlsbblsbnlsozlspHlspTlppvlsqvlsrvlsrblsrzlsrfls4Xlsr7ls4fls5nls6nls73ls7rls63ltozls6rltIvltJXltJfltZzltJ/ltJvltJHltJTltKLltJrltJnltJjltYzltZLltY7ltYvltazltbPltbbltofltoTltoLltqLltp3ltqzltq7ltr3ltpDltrfltrzlt4nlt43lt5Plt5Llt5blt5vlt6vlt7Llt7XluIvluJrluJnluJHluJvluLbluLfluYTluYPluYDluY7luZfluZTluZ/luaLluaTluYflubXlubblubrpurzlub/luqDlu4Hlu4Llu4jlu5Dlu49cIl0sXG5bXCI5YzQwXCIsXCLlu5blu6Plu53lu5rlu5vlu6Llu6Hlu6jlu6nlu6zlu7Hlu7Plu7Dlu7Tlu7jlu77lvIPlvInlvZ3lvZzlvIvlvJHlvJblvKnlvK3lvLjlvYHlvYjlvYzlvY7lvK/lvZHlvZblvZflvZnlvaHlva3lvbPlvbflvoPlvoLlvb/lvorlvojlvpHlvoflvp7lvpnlvpjlvqDlvqjlvq3lvrzlv5blv7vlv6Tlv7jlv7Hlv53mgrPlv7/mgKHmgaBcIl0sXG5bXCI5YzgwXCIsXCLmgJnmgJDmgKnmgI7mgLHmgJvmgJXmgKvmgKbmgI/mgLrmgZrmgYHmgarmgbfmgZ/mgYrmgYbmgY3mgaPmgYPmgaTmgYLmgazmgavmgZnmgoHmgo3mg6fmgoPmgprmgoTmgpvmgpbmgpfmgpLmgqfmgovmg6Hmgrjmg6Dmg5PmgrTlv7Dmgr3mg4bmgrXmg5jmhY3mhJXmhIbmg7bmg7fmhIDmg7Tmg7rmhIPmhKHmg7vmg7HmhI3mhI7mhYfmhL7mhKjmhKfmhYrmhL/mhLzmhKzmhLTmhL3mhYLmhYTmhbPmhbfmhZjmhZnmhZrmhavmhbTmha/mhaXmhbHmhZ/mhZ3mhZPmhbXmhpnmhpbmhofmhqzmhpTmhprmhormhpHmhqvmhq7mh4zmh4rmh4nmh7fmh4jmh4Pmh4bmhrrmh4vnvbnmh43mh6bmh6Pmh7bmh7rmh7Tmh7/mh73mh7zmh77miIDmiIjmiInmiI3miIzmiJTmiJtcIl0sXG5bXCI5ZDQwXCIsXCLmiJ7miKHmiKrmiK7miLDmiLLmiLPmiYHmiY7miZ7miaPmiZvmiaDmiajmibzmioLmionmib7mipLmipPmipbmi5TmioPmipTmi5fmi5Hmirvmi4/mi7/mi4bmk5Tmi4jmi5zmi4zmi4rmi4Lmi4fmipvmi4nmjIzmi67mi7HmjKfmjILmjIjmi6/mi7XmjZDmjL7mjY3mkJzmjY/mjpbmjo7mjoDmjqvmjbbmjqPmjo/mjonmjp/mjrXmjatcIl0sXG5bXCI5ZDgwXCIsXCLmjanmjr7mj6nmj4Dmj4bmj6Pmj4nmj5Lmj7bmj4TmkJbmkLTmkIbmkJPmkKbmkLbmlJ3mkJfmkKjmkI/mkafmka/mkbbmkY7mlKrmkpXmkpPmkqXmkqnmkojmkrzmk5rmk5Lmk4Xmk4fmkrvmk5jmk4Lmk7Hmk6foiInmk6Dmk6Hmiqzmk6Pmk6/mlKzmk7bmk7Tmk7Lmk7rmlIDmk73mlJjmlJzmlIXmlKTmlKPmlKvmlLTmlLXmlLfmlLbmlLjnlYvmlYjmlZbmlZXmlY3mlZjmlZ7mlZ3mlbLmlbjmloLmloPorormlpvmlp/mlqvmlrfml4Pml4bml4Hml4Tml4zml5Lml5vml5nml6Dml6Hml7HmnbLmmIrmmIPml7vmnbPmmLXmmLbmmLTmmJzmmY/mmYTmmYnmmYHmmZ7mmZ3mmaTmmafmmajmmZ/mmaLmmbDmmoPmmojmmo7mmonmmoTmmpjmmp3mm4Hmmrnmm4nmmr7mmrxcIl0sXG5bXCI5ZTQwXCIsXCLmm4Tmmrjmm5bmm5rmm6DmmL/mm6bmm6nmm7Dmm7Xmm7fmnI/mnJbmnJ7mnKbmnKfpnLjmnK7mnL/mnLbmnYHmnLjmnLfmnYbmnZ7mnaDmnZnmnaPmnaTmnonmnbDmnqnmnbzmnarmnozmnovmnqbmnqHmnoXmnrfmn6/mnrTmn6zmnrPmn6nmnrjmn6Tmn57mn53mn6Lmn67mnrnmn47mn4bmn6fmqpzmoJ7moYbmoKnmoYDmoY3moLLmoY5cIl0sXG5bXCI5ZTgwXCIsXCLmorPmoKvmoZnmoaPmobfmob/mop/moo/moq3mopTmop3mopvmooPmqq7mornmobTmorXmoqDmorrmpI/moo3mob7mpIHmo4rmpIjmo5jmpKLmpKbmo6HmpIzmo43mo5Tmo6fmo5XmpLbmpJLmpITmo5fmo6PmpKXmo7nmo6Dmo6/mpKjmpKrmpJrmpKPmpKHmo4bmpbnmpbfmpZzmpbjmpavmpZTmpb7mpa7mpLnmpbTmpL3mpZnmpLDmpaHmpZ7mpZ3mpoHmparmprLmpq7mp5Dmpr/mp4Hmp5Pmpr7mp47lr6jmp4rmp53mprvmp4PmpqfmqK7mppHmpqDmppzmppXmprTmp57mp6jmqILmqJvmp7/mrIrmp7nmp7Lmp6fmqIXmprHmqJ7mp63mqJTmp6vmqIrmqJLmq4HmqKPmqJPmqYTmqIzmqbLmqLbmqbjmqYfmqaLmqZnmqabmqYjmqLjmqKLmqpDmqo3mqqDmqoTmqqLmqqNcIl0sXG5bXCI5ZjQwXCIsXCLmqpfomJfmqrvmq4Pmq4LmqrjmqrPmqqzmq57mq5Hmq5/mqqrmq5rmq6rmq7vmrIXomJbmq7rmrJLmrJbprLHmrJ/mrLjmrLfnm5zmrLnpo67mrYfmrYPmrYnmrZDmrZnmrZTmrZvmrZ/mraHmrbjmrbnmrb/mroDmroTmroPmro3mrpjmrpXmrp7mrqTmrqrmrqvmrq/mrrLmrrHmrrPmrrfmrrzmr4bmr4vmr5Pmr5/mr6zmr6vmr7Pmr69cIl0sXG5bXCI5ZjgwXCIsXCLpur7msIjmsJPmsJTmsJvmsKTmsKPmsZ7msZXmsaLmsarmsoLmso3msprmsoHmspvmsb7msajmsbPmspLmspDms4Tms7Hms5Pmsr3ms5fms4Xms53msq7msrHmsr7msrrms5vms6/ms5nms6rmtJ/ooY3mtLbmtKvmtL3mtLjmtJnmtLXmtLPmtJLmtIzmtaPmtpPmtaTmtZrmtbnmtZnmto7mtpXmv6TmtoXmt7nmuJXmuIrmtrXmt4fmt6bmtrjmt4bmt6zmt57mt4zmt6jmt5Lmt4Xmt7rmt5nmt6Tmt5Xmt6rmt67muK3mua7muK7muJnmubLmuZ/muL7muKPmuavmuKvmubbmuY3muJ/muYPmuLrmuY7muKTmu7/muJ3muLjmuoLmuqrmupjmu4nmurfmu5Pmur3muq/mu4TmurLmu5Tmu5Xmuo/muqXmu4Lmup/mvYHmvJHngYzmu6zmu7jmu77mvL/mu7LmvLHmu6/mvLLmu4xcIl0sXG5bXCJlMDQwXCIsXCLmvL7mvJPmu7fmvobmvbrmvbjmvoHmvoDmva/mvZvmv7Pmva3mvoLmvbzmvZjmvo7mvpHmv4LmvabmvrPmvqPmvqHmvqTmvrnmv4bmvqrmv5/mv5Xmv6zmv5Tmv5jmv7Hmv67mv5vngInngIvmv7rngJHngIHngI/mv77ngJvngJrmvbTngJ3ngJjngJ/ngLDngL7ngLLngZHngaPngpnngpLngq/ng7HngqzngrjngrPngq7ng5/ng4vng51cIl0sXG5bXCJlMDgwXCIsXCLng5nnhInng73nhJznhJnnhaXnhZXnhojnhabnhaLnhYznhZbnhaznho/nh7vnhoTnhpXnhqjnhqznh5fnhrnnhr7nh5Lnh4nnh5Tnh47nh6Dnh6znh6fnh7Xnh7znh7nnh7/niI3niJDniJvniKjniK3niKzniLDniLLniLvniLzniL/niYDniYbniYvniZjnibTnib7nioLnioHniofnipLnipbniqLniqfnirnnirLni4Pni4bni4Tni47ni5Lni6Lni6Dni6Hni7nni7flgI/njJfnjIrnjJznjJbnjJ3njLTnjK/njKnnjKXnjL7njY7njY/pu5jnjZfnjarnjajnjbDnjbjnjbXnjbvnjbrnj4jnjrPnj47njrvnj4Dnj6Xnj67nj57nkqLnkIXnka/nkKXnj7jnkLLnkLrnkZXnkL/nkZ/nkZnnkYHnkZznkannkbDnkaPnkarnkbbnkb7nkovnkp7nkqfnk4rnk4/nk5Tnj7FcIl0sXG5bXCJlMTQwXCIsXCLnk6Dnk6Pnk6fnk6nnk67nk7Lnk7Dnk7Hnk7jnk7fnlITnlIPnlIXnlIznlI7nlI3nlJXnlJPnlJ7nlKbnlKznlLznlYTnlY3nlYrnlYnnlZvnlYbnlZrnlannlaTnlafnlavnla3nlbjnlbbnlobnlofnlbTnlornlonnloLnlpTnlprnlp3nlqXnlqPnl4LnlrPnl4PnlrXnlr3nlrjnlrznlrHnl43nl4rnl5Lnl5nnl6Pnl57nl77nl79cIl0sXG5bXCJlMTgwXCIsXCLnl7znmIHnl7Dnl7rnl7Lnl7PnmIvnmI3nmInnmJ/nmKfnmKDnmKHnmKLnmKTnmLTnmLDnmLvnmYfnmYjnmYbnmZznmZjnmaHnmaLnmajnmannmarnmafnmaznmbDnmbLnmbbnmbjnmbznmoDnmoPnmojnmovnmo7nmpbnmpPnmpnnmprnmrDnmrTnmrjnmrnnmrrnm4Lnm43nm5bnm5Lnm57nm6Hnm6Xnm6fnm6romK/nm7vnnIjnnIfnnITnnKnnnKTnnJ7nnKXnnKbnnJvnnLfnnLjnnYfnnZrnnajnnavnnZvnnaXnnb/nnb7nnbnnno7nnovnnpHnnqDnnp7nnrDnnrbnnrnnnr/nnrznnr3nnrvnn4fnn43nn5fnn5rnn5znn6Pnn67nn7znoIznoJLnpKbnoKDnpKrnoYXnoo7nobTnoobnobznoprnooznoqPnorXnoqrnoq/no5Hno4bno4vno5Tnor7norzno4Xno4rno6xcIl0sXG5bXCJlMjQwXCIsXCLno6fno5rno73no7TnpIfnpJLnpJHnpJnnpKznpKvnpYDnpaDnpZfnpZ/npZrnpZXnpZPnpbrnpb/npornpp3npqfpvYvnpqrnpq7nprPnprnnprrnp4nnp5Xnp6fnp6znp6Hnp6PnqIjnqI3nqJjnqJnnqKDnqJ/npoDnqLHnqLvnqL7nqLfnqYPnqZfnqYnnqaHnqaLnqanpvp3nqbDnqbnnqb3nqojnqpfnqpXnqpjnqpbnqqnnq4jnqrBcIl0sXG5bXCJlMjgwXCIsXCLnqrbnq4Xnq4Tnqr/pgoPnq4fnq4rnq43nq4/nq5Xnq5Pnq5nnq5rnq53nq6Hnq6Lnq6bnq63nq7DnrILnrI/nrIrnrIbnrLPnrJjnrJnnrJ7nrLXnrKjnrLbnrZDnrbrnrITnrY3nrIvnrYznrYXnrbXnraXnrbTnrafnrbDnrbHnraznra7nrp3nrpjnrp/nro3nrpznrprnrovnrpLnro/nrZ3nrpnnr4vnr4Hnr4znr4/nrrTnr4bnr53nr6nnsJHnsJTnr6bnr6XnsaDnsIDnsIfnsJPnr7Pnr7fnsJfnsI3nr7bnsKPnsKfnsKrnsJ/nsLfnsKvnsL3nsYznsYPnsZTnsY/nsYDnsZDnsZjnsZ/nsaTnsZbnsaXnsaznsbXnsoPnspDnsqTnsq3nsqLnsqvnsqHnsqjnsrPnsrLnsrHnsq7nsrnnsr3ns4Dns4Xns4Lns5jns5Lns5zns6LprLvns6/ns7Lns7Tns7bns7rntIZcIl0sXG5bXCJlMzQwXCIsXCLntILntJzntJXntIrntYXntYvntK7ntLLntL/ntLXntYbntbPntZbntY7ntbLntajnta7ntY/ntaPntpPntonntZvnto/ntb3ntpvntrrntq7ntqPntrXnt4fntr3ntqvnuL3ntqLntq/nt5zntrjntp/ntrDnt5jnt53nt6Tnt57nt7vnt7Lnt6HnuIXnuIrnuKPnuKHnuJLnuLHnuJ/nuInnuIvnuKLnuYbnuabnuLvnuLXnuLnnuYPnuLdcIl0sXG5bXCJlMzgwXCIsXCLnuLLnuLrnuafnuZ3nuZbnuZ7nuZnnuZrnubnnuarnuannubznubvnuoPnt5Xnub3ovq7nub/nuojnuonnuoznupLnupDnupPnupTnupbnuo7nupvnupznvLjnvLrnvYXnvYznvY3nvY7nvZDnvZHnvZXnvZTnvZjnvZ/nvaDnvajnvannvafnvbjnvoLnvobnvoPnvojnvofnvoznvpTnvp7nvp3nvprnvqPnvq/nvrLnvrnnvq7nvrbnvrjorbHnv4Xnv4bnv4rnv5Xnv5Tnv6Hnv6bnv6nnv7Pnv7npo5zogIbogITogIvogJLogJjogJnogJzogKHogKjogL/ogLvogYrogYbogZLogZjogZrogZ/ogaLogajogbPogbLogbDogbbogbnogb3ogb/ogoTogobogoXogpvogpPogprogq3lhpDogqzog5vog6Xog5nog53og4Tog5rog5bohInog6/og7HohJvohKnohKPohK/ohYtcIl0sXG5bXCJlNDQwXCIsXCLpmovohYbohL7ohZPohZHog7zohbHoha7ohaXohabohbTohoPohojohorohoDohoLohqDohpXohqTohqPohZ/ohpPohqnohrDohrXohr7ohrjohr3oh4Doh4Lohrroh4noh43oh5Hoh5noh5joh4joh5roh5/oh6Doh6foh7roh7voh77oiIHoiILoiIXoiIfoiIroiI3oiJDoiJboiKnoiKvoiLjoiLPoiYDoiZnoiZjoiZ3oiZroiZ/oiaRcIl0sXG5bXCJlNDgwXCIsXCLoiaLoiajoiaroiavoiK7oibHoibfoibjoib7oio3oipLoiqvoip/oirvoiqzoi6Hoi6Poi5/oi5Loi7Toi7Poi7rojpPojIPoi7voi7noi57ojIboi5zojInoi5nojLXojLTojJbojLLojLHojYDojLnojZDojYXojK/ojKvojJfojJjojoXojprojqrojp/ojqLojpbojKPojo7ojofojorojbzojrXojbPojbXojqDojonojqjoj7TokJPoj6voj47oj73okIPoj5jokIvoj4Hoj7fokIfoj6Doj7LokI3okKLokKDojr3okLjolIboj7voka3okKrokLzolZrokoTokbfokavokq3oka7okoLokanokYbokKzoka/okbnokLXok4rokaLokrnokr/okp/ok5nok43okrvok5rok5Dok4Hok4bok5bokqHolKHok7/ok7TolJfolJjolKzolJ/olJXolJTok7zolYDolaPolZjolYhcIl0sXG5bXCJlNTQwXCIsXCLolYHomILolYvolZXoloDolqTolojolpHolorolqjola3olpTolpvol6rolofolpzolbfolb7olpDol4nolrrol4/olrnol5Dol5Xol53ol6Xol5zol7nomIromJPomIvol77ol7romIbomKLomJromLDomL/omY3kuZXomZTomZ/omafombHompPomqPomqnomqromovomozomrbomq/om4Tom4bomrDom4nooKPomqvom5Tom57om6nom6xcIl0sXG5bXCJlNTgwXCIsXCLom5/om5vom6/onJLonIbonIjonIDonIPom7vonJHonInonI3om7nonIronLTonL/onLfonLvonKXonKnonJronaDonZ/onbjonYzonY7onbTonZfonajona7onZnonZPonaPonarooIXonqLonp/onoLonq/on4vonr3on4Don5Dpm5bonqvon4TonrPon4fon4bonrvon6/on7Lon6DooI/ooI3on77on7bon7fooI7on5LooJHooJbooJXooKLooKHooLHooLbooLnooKfooLvooYTooYLooZLooZnooZ7ooaLooavoooHoob7oop7oobXoob3oorXoobLoooLoopfoopLooq7oopnooqLooo3ooqToorDoor/oorHoo4Poo4Too5Too5joo5noo53oo7nopILoo7zoo7Too6joo7LopITopIzopIropJPopYPopJ7opKXopKropKvopYHopYTopLvopLbopLjopYzopJ3opaDopZ5cIl0sXG5bXCJlNjQwXCIsXCLopabopaTopa3oparopa/opbTopbfopb7opoPopojoporoppPoppjopqHopqnopqbopqzopq/oprLoprropr3opr/op4Dop5rop5zop53op6fop7Top7joqIPoqJboqJDoqIzoqJvoqJ3oqKXoqLboqYHoqZvoqZLoqYboqYjoqbzoqa3oqazoqaLoqoXoqoLoqoToqqjoqqHoqpHoqqXoqqboqproqqPoq4Toq43oq4Loq5roq6voq7Poq6dcIl0sXG5bXCJlNjgwXCIsXCLoq6Toq7HorJToq6Doq6Loq7foq57oq5vorIzorIforJroq6HorJborJDorJforKDorLPpnqvorKborKvorL7orKjorYHorYzorY/orY7orYnorZborZvorZroravorZ/orazora/orbTorb3oroDorozoro7orpLorpPorpborpnorprosLrosYHosL/osYjosYzosY7osZDosZXosaLosazosbjosbrosoLosonosoXosoroso3oso7ospTosbzospjmiJ3osq3osqrosr3osrLosrPosq7osrbos4jos4Hos6Tos6Pos5ros73os7ros7votITotIXotIrotIfotI/otI3otJDpvY7otJPos43otJTotJbotafota3otbHotbPotoHotpnot4Lotr7otrrot4/ot5rot5bot4zot5vot4vot6rot6vot5/ot6Pot7zouIjouInot7/ouJ3ouJ7ouJDouJ/ouYLouLXouLDouLTouYpcIl0sXG5bXCJlNzQwXCIsXCLouYfouYnouYzouZDouYjouZnouaTouaDouKrouaPouZXoubboubLoubzouoHouofouoXouoTouovouoroupPoupHoupToupnouqrouqHouqzourDou4bourHour7ou4Xou4jou4vou5vou6Pou7zou7vou6vou77ovIrovIXovJXovJLovJnovJPovJzovJ/ovJvovIzovKbovLPovLvovLnovYXovYLovL7ovYzovYnovYbovY7ovZfovZxcIl0sXG5bXCJlNzgwXCIsXCLovaLovaPovaTovpzovp/ovqPovq3ovq/ovrfov5rov6Xov6Lov6rov6/pgofov7TpgIXov7nov7rpgJHpgJXpgKHpgI3pgJ7pgJbpgIvpgKfpgLbpgLXpgLnov7jpgY/pgZDpgZHpgZLpgI7pgYnpgL7pgZbpgZjpgZ7pgajpga/pgbbpmqjpgbLpgoLpgb3pgoHpgoDpgorpgonpgo/pgqjpgq/pgrHpgrXpg6Lpg6TmiYjpg5vphILphJLphJnphLLphLDphYrphZbphZjphaPphaXphanphbPphbLphovphonphoLphqLphqvphq/phqrphrXphrTphrrph4Dph4Hph4nph4vph5Dph5bph5/ph6Hph5vph7zph7Xph7bpiJ7ph7/piJTpiKzpiJXpiJHpiZ7piZfpiYXpiYnpiaTpiYjpipXpiL/piYvpiZDpipzpipbpipPpipvpiZrpi4/pirnpirfpi6npjI/pi7rpjYTpjK5cIl0sXG5bXCJlODQwXCIsXCLpjJnpjKLpjJrpjKPpjLrpjLXpjLvpjZzpjaDpjbzpja7pjZbpjrDpjqzpjq3pjpTpjrnpj5bpj5fpj6jpj6Xpj5jpj4Ppj53pj5Dpj4jpj6TpkJrpkJTpkJPpkIPpkIfpkJDpkLbpkKvpkLXpkKHpkLrpkYHpkZLpkYTpkZvpkaDpkaLpkZ7pkarpiKnpkbDpkbXpkbfpkb3pkZrpkbzpkb7pkoHpkb/ploLplofplorplpTplpbplpjplplcIl0sXG5bXCJlODgwXCIsXCLplqDplqjplqfplq3plrzplrvplrnplr7pl4rmv7bpl4Ppl43pl4zpl5Xpl5Tpl5bpl5zpl6Hpl6Xpl6LpmKHpmKjpmK7pmK/pmYLpmYzpmY/pmYvpmbfpmZzpmZ7pmZ3pmZ/pmabpmbLpmazpmo3pmpjpmpXpmpfpmqrpmqfpmrHpmrLpmrDpmrTpmrbpmrjpmrnpm47pm4vpm4npm43opY3pm5zpnI3pm5Xpm7npnITpnIbpnIjpnJPpnI7pnJHpnI/pnJbpnJnpnKTpnKrpnLDpnLnpnL3pnL7pnYTpnYbpnYjpnYLpnYnpnZzpnaDpnaTpnabpnajli5LpnavpnbHpnbnpnoXpnbzpnoHpnbrpnobpnovpno/pnpDpnpzpnqjpnqbpnqPpnrPpnrTpn4Ppn4bpn4jpn4vpn5zpn63pvY/pn7Lnq5/pn7bpn7XpoI/poIzpoLjpoKTpoKHpoLfpoL3poYbpoY/poYvpoavpoa/pobBcIl0sXG5bXCJlOTQwXCIsXCLpobHpobTpobPpoqrpoq/porHporbpo4Tpo4Ppo4bpo6npo6vppIPppInppJLppJTppJjppKHppJ3ppJ7ppKTppKDppKzppK7ppL3ppL7ppYLppYnppYXppZDppYvppZHppZLppYzppZXpppfpppjppqXppq3ppq7pprzpp5/pp5vpp53pp5jpp5Hpp63pp67pp7Hpp7Lpp7vpp7jpqIHpqI/pqIXpp6LpqJnpqKvpqLfpqYXpqYLpqYDpqYNcIl0sXG5bXCJlOTgwXCIsXCLpqL7pqZXpqY3pqZvpqZfpqZ/pqaLpqaXpqaTpqanpqavpqarpqq3pqrDpqrzpq4Dpq4/pq5Hpq5Ppq5Tpq57pq5/pq6Lpq6Ppq6bpq6/pq6vpq67pq7Tpq7Hpq7fpq7vprIbprJjprJrprJ/prKLprKPprKXprKfprKjprKnprKrprK7prK/prLLprYTprYPprY/prY3prY7prZHprZjprbTprpPproPprpHprpbprpfprp/prqDprqjprrTpr4Dpr4rprrnpr4bpr4/pr5Hpr5Lpr6Ppr6Lpr6Tpr5Tpr6HpsLrpr7Lpr7Hpr7DpsJXpsJTpsInpsJPpsIzpsIbpsIjpsJLpsIrpsITpsK7psJvpsKXpsKTpsKHpsLDpsYfpsLLpsYbpsL7psZrpsaDpsafpsbbpsbjps6fps6zps7DptInptIjps6vptIPptIbptKrptKbptq/ptKPptJ/ptYTptJXptJLptYHptL/ptL7ptYbptYhcIl0sXG5bXCJlYTQwXCIsXCLptZ3ptZ7ptaTptZHptZDptZnptbLptonptofptqvpta/ptbrptprptqTptqnptrLpt4Tpt4Hptrvptrjptrrpt4bpt4/pt4Lpt5npt5Ppt7jpt6bpt63pt6/pt73puJrpuJvpuJ7pubXpubnpub3puoHpuojpuovpuozpupLpupXpupHpup3puqXpuqnpurjpuqrpuq3pnaHpu4zpu47pu4/pu5Dpu5Tpu5zpu57pu53pu6Dpu6Xpu6jpu69cIl0sXG5bXCJlYTgwXCIsXCLpu7Tpu7bpu7fpu7npu7vpu7zpu73pvIfpvIjnmrfpvJXpvKHpvKzpvL7pvYrpvZLpvZTpvaPpvZ/pvaDpvaHpvabpvafpvazpvarpvbfpvbLpvbbpvpXpvpzpvqDloK/mp4fpgZnnkaTlh5znhplcIl0sXG5bXCJlZDQwXCIsXCLnuoropJzpjYjpiojok5zkv4nngrvmmLHmo4jpi7nmm7vlvYXkuKjku6Hku7zkvIDkvIPkvLnkvZbkvpLkvorkvprkvpTkv43lgYDlgKLkv7/lgJ7lgYblgbDlgYLlgpTlg7Tlg5jlhYrlhaTlhp3lhr7lh6zliJXlipzliqbli4Dli5vljIDljIfljKTljbLljpPljrLlj53vqI7lkpzlkorlkqnlk7/lloblnZnlnaXlnqzln4jln4fvqI9cIl0sXG5bXCJlZDgwXCIsXCLvqJDlop7lorLlpIvlpZPlpZvlpZ3lpaPlpqTlprrlrZblr4DnlK/lr5jlr6zlsJ7lsqblsrrls7XltKfltZPvqJHltYLlta3ltrjltrnlt5DlvKHlvLTlvaflvrflv57mgZ3mgoXmgormg57mg5XmhKDmg7LmhJHmhLfmhLDmhpjmiJPmiqbmj7XmkaDmkp3mk47mlY7mmIDmmJXmmLvmmInmmK7mmJ7mmKTmmaXmmZfmmZnvqJLmmbPmmpnmmqDmmrLmmr/mm7rmnI7vpKnmnabmnrvmoZLmn4DmoIHmoYTmo4/vqJPmpajvqJTmppjmp6LmqLDmqavmqYbmqbPmqb7mq6Lmq6Tmr5bmsL/msZzmsobmsa/ms5rmtITmtofmta/mtpbmtqzmt4/mt7jmt7Lmt7zmuLnmuZzmuKfmuLzmur/mvojmvrXmv7XngIXngIfngKjngoXngqvnhI/nhITnhZznhYbnhYfvqJXnh4Hnh77nirFcIl0sXG5bXCJlZTQwXCIsXCLnir7njKTvqJbnjbfnjr3nj4nnj5bnj6Pnj5LnkIfnj7XnkKbnkKrnkKnnkK7nkaLnkonnkp/nlIHnla/nmoLnmpznmp7nmpvnmqbvqJfnnYbliq/noKHnoY7noaTnobrnpLDvqJjvqJnvqJrnppTvqJvnppvnq5Hnq6fvqJznq6vnrp7vqJ3ntYjntZzntrfntqDnt5bnuZLnvYfnvqHvqJ7ojIHojaLojb/oj4foj7bokYjokrTolZPolZlcIl0sXG5bXCJlZTgwXCIsXCLolavvqJ/olrDvqKDvqKHooIfoo7XoqJLoqLfoqbnoqqfoqr7oq5/vqKLoq7borZPorb/os7Dos7TotJLotbbvqKPou4/vqKTvqKXpgafpg57vqKbphJXphKfph5rph5fph57ph63ph67ph6Tph6XpiIbpiJDpiIrpiLrpiYDpiLzpiY7piZnpiZHpiLnpiafpiqfpibfpibjpi6fpi5fpi5npi5DvqKfpi5Xpi6Dpi5PpjKXpjKHpi7vvqKjpjJ7pi7/pjJ3pjILpjbDpjZfpjqTpj4bpj57pj7jpkLHpkYXpkYjplpLvp5zvqKnpmp3pmq/pnLPpnLvpnYPpnY3pnY/pnZHpnZXpoZfpoaXvqKrvqKvppKfvqKzppp7pqY7pq5npq5zprbXprbLpro/prrHprrvpsIDptbDptavvqK3puJnpu5FcIl0sXG5bXCJlZWVmXCIsXCLihbBcIiw5LFwi77+i77+k77yH77yCXCJdLFxuW1wiZjA0MFwiLFwi7oCAXCIsNjJdLFxuW1wiZjA4MFwiLFwi7oC/XCIsMTI0XSxcbltcImYxNDBcIixcIu6CvFwiLDYyXSxcbltcImYxODBcIixcIu6Du1wiLDEyNF0sXG5bXCJmMjQwXCIsXCLuhbhcIiw2Ml0sXG5bXCJmMjgwXCIsXCLuhrdcIiwxMjRdLFxuW1wiZjM0MFwiLFwi7oi0XCIsNjJdLFxuW1wiZjM4MFwiLFwi7omzXCIsMTI0XSxcbltcImY0NDBcIixcIu6LsFwiLDYyXSxcbltcImY0ODBcIixcIu6Mr1wiLDEyNF0sXG5bXCJmNTQwXCIsXCLujqxcIiw2Ml0sXG5bXCJmNTgwXCIsXCLuj6tcIiwxMjRdLFxuW1wiZjY0MFwiLFwi7pGoXCIsNjJdLFxuW1wiZjY4MFwiLFwi7pKnXCIsMTI0XSxcbltcImY3NDBcIixcIu6UpFwiLDYyXSxcbltcImY3ODBcIixcIu6Vo1wiLDEyNF0sXG5bXCJmODQwXCIsXCLul6BcIiw2Ml0sXG5bXCJmODgwXCIsXCLumJ9cIiwxMjRdLFxuW1wiZjk0MFwiLFwi7pqcXCJdLFxuW1wiZmE0MFwiLFwi4oWwXCIsOSxcIuKFoFwiLDksXCLvv6Lvv6TvvIfvvILjiLHihJbihKHiiLXnuoropJzpjYjpiojok5zkv4nngrvmmLHmo4jpi7nmm7vlvYXkuKjku6Hku7zkvIDkvIPkvLnkvZbkvpLkvorkvprkvpTkv43lgYDlgKLkv7/lgJ7lgYblgbDlgYLlgpTlg7Tlg5jlhYpcIl0sXG5bXCJmYTgwXCIsXCLlhaTlhp3lhr7lh6zliJXlipzliqbli4Dli5vljIDljIfljKTljbLljpPljrLlj53vqI7lkpzlkorlkqnlk7/lloblnZnlnaXlnqzln4jln4fvqI/vqJDlop7lorLlpIvlpZPlpZvlpZ3lpaPlpqTlprrlrZblr4DnlK/lr5jlr6zlsJ7lsqblsrrls7XltKfltZPvqJHltYLlta3ltrjltrnlt5DlvKHlvLTlvaflvrflv57mgZ3mgoXmgormg57mg5XmhKDmg7LmhJHmhLfmhLDmhpjmiJPmiqbmj7XmkaDmkp3mk47mlY7mmIDmmJXmmLvmmInmmK7mmJ7mmKTmmaXmmZfmmZnvqJLmmbPmmpnmmqDmmrLmmr/mm7rmnI7vpKnmnabmnrvmoZLmn4DmoIHmoYTmo4/vqJPmpajvqJTmppjmp6LmqLDmqavmqYbmqbPmqb7mq6Lmq6Tmr5bmsL/msZzmsobmsa/ms5rmtITmtofmta9cIl0sXG5bXCJmYjQwXCIsXCLmtpbmtqzmt4/mt7jmt7Lmt7zmuLnmuZzmuKfmuLzmur/mvojmvrXmv7XngIXngIfngKjngoXngqvnhI/nhITnhZznhYbnhYfvqJXnh4Hnh77nirHnir7njKTvqJbnjbfnjr3nj4nnj5bnj6Pnj5LnkIfnj7XnkKbnkKrnkKnnkK7nkaLnkonnkp/nlIHnla/nmoLnmpznmp7nmpvnmqbvqJfnnYbliq/noKHnoY7noaTnobrnpLDvqJjvqJlcIl0sXG5bXCJmYjgwXCIsXCLvqJrnppTvqJvnppvnq5Hnq6fvqJznq6vnrp7vqJ3ntYjntZzntrfntqDnt5bnuZLnvYfnvqHvqJ7ojIHojaLojb/oj4foj7bokYjokrTolZPolZnolavvqJ/olrDvqKDvqKHooIfoo7XoqJLoqLfoqbnoqqfoqr7oq5/vqKLoq7borZPorb/os7Dos7TotJLotbbvqKPou4/vqKTvqKXpgafpg57vqKbphJXphKfph5rph5fph57ph63ph67ph6Tph6XpiIbpiJDpiIrpiLrpiYDpiLzpiY7piZnpiZHpiLnpiafpiqfpibfpibjpi6fpi5fpi5npi5DvqKfpi5Xpi6Dpi5PpjKXpjKHpi7vvqKjpjJ7pi7/pjJ3pjILpjbDpjZfpjqTpj4bpj57pj7jpkLHpkYXpkYjplpLvp5zvqKnpmp3pmq/pnLPpnLvpnYPpnY3pnY/pnZHpnZXpoZfpoaXvqKrvqKvppKfvqKzppp7pqY7pq5lcIl0sXG5bXCJmYzQwXCIsXCLpq5zprbXprbLpro/prrHprrvpsIDptbDptavvqK3puJnpu5FcIl1cbl1cbiIsIlxuXG4vLyA9PSBVVEYxNi1CRSBjb2RlYy4gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnRzLnV0ZjE2YmUgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2RlcjogdXRmMTZiZUVuY29kZXIsXG4gICAgICAgIGRlY29kZXI6IHV0ZjE2YmVEZWNvZGVyLFxuXG4gICAgICAgIGJvbTogbmV3IEJ1ZmZlcihbMHhGRSwgMHhGRl0pLFxuICAgIH07XG59O1xuXG5cbi8vIC0tIEVuY29kaW5nXG5cbmZ1bmN0aW9uIHV0ZjE2YmVFbmNvZGVyKG9wdGlvbnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICB3cml0ZTogdXRmMTZiZUVuY29kZXJXcml0ZSxcbiAgICAgICAgZW5kOiBmdW5jdGlvbigpIHt9LFxuICAgIH1cbn1cblxuZnVuY3Rpb24gdXRmMTZiZUVuY29kZXJXcml0ZShzdHIpIHtcbiAgICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdHIsICd1Y3MyJyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWYubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgdmFyIHRtcCA9IGJ1ZltpXTsgYnVmW2ldID0gYnVmW2krMV07IGJ1ZltpKzFdID0gdG1wO1xuICAgIH1cbiAgICByZXR1cm4gYnVmO1xufVxuXG5cbi8vIC0tIERlY29kaW5nXG5cbmZ1bmN0aW9uIHV0ZjE2YmVEZWNvZGVyKG9wdGlvbnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICB3cml0ZTogdXRmMTZiZURlY29kZXJXcml0ZSxcbiAgICAgICAgZW5kOiBmdW5jdGlvbigpIHt9LFxuXG4gICAgICAgIG92ZXJmbG93Qnl0ZTogLTEsXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gdXRmMTZiZURlY29kZXJXcml0ZShidWYpIHtcbiAgICBpZiAoYnVmLmxlbmd0aCA9PSAwKVxuICAgICAgICByZXR1cm4gJyc7XG5cbiAgICB2YXIgYnVmMiA9IG5ldyBCdWZmZXIoYnVmLmxlbmd0aCArIDEpLFxuICAgICAgICBpID0gMCwgaiA9IDA7XG5cbiAgICBpZiAodGhpcy5vdmVyZmxvd0J5dGUgIT09IC0xKSB7XG4gICAgICAgIGJ1ZjJbMF0gPSBidWZbMF07XG4gICAgICAgIGJ1ZjJbMV0gPSB0aGlzLm92ZXJmbG93Qnl0ZTtcbiAgICAgICAgaSA9IDE7IGogPSAyO1xuICAgIH1cblxuICAgIGZvciAoOyBpIDwgYnVmLmxlbmd0aC0xOyBpICs9IDIsIGorPSAyKSB7XG4gICAgICAgIGJ1ZjJbal0gPSBidWZbaSsxXTtcbiAgICAgICAgYnVmMltqKzFdID0gYnVmW2ldO1xuICAgIH1cblxuICAgIHRoaXMub3ZlcmZsb3dCeXRlID0gKGkgPT0gYnVmLmxlbmd0aC0xKSA/IGJ1ZltidWYubGVuZ3RoLTFdIDogLTE7XG5cbiAgICByZXR1cm4gYnVmMi5zbGljZSgwLCBqKS50b1N0cmluZygndWNzMicpO1xufVxuXG5cbi8vID09IFVURi0xNiBjb2RlYyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBEZWNvZGVyIGNob29zZXMgYXV0b21hdGljYWxseSBmcm9tIFVURi0xNkxFIGFuZCBVVEYtMTZCRSB1c2luZyBCT00gYW5kIHNwYWNlLWJhc2VkIGhldXJpc3RpYy5cbi8vIERlZmF1bHRzIHRvIFVURi0xNkJFLCBhY2NvcmRpbmcgdG8gUkZDIDI3ODEsIGFsdGhvdWdoIGl0IGlzIGFnYWluc3Qgc29tZSBpbmR1c3RyeSBwcmFjdGljZXMsIHNlZVxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9VVEYtMTYgYW5kIGh0dHA6Ly9lbmNvZGluZy5zcGVjLndoYXR3Zy5vcmcvI3V0Zi0xNmxlXG4vLyBEZWNvZGVyIGRlZmF1bHQgY2FuIGJlIGNoYW5nZWQ6IGljb252LmRlY29kZShidWYsICd1dGYxNicsIHtkZWZhdWx0OiAndXRmLTE2bGUnfSk7XG5cbi8vIEVuY29kZXIgcHJlcGVuZHMgQk9NIGFuZCB1c2VzIFVURi0xNkJFLlxuLy8gRW5kaWFubmVzcyBjYW4gYWxzbyBiZSBjaGFuZ2VkOiBpY29udi5lbmNvZGUoc3RyLCAndXRmMTYnLCB7dXNlOiAndXRmLTE2bGUnfSk7XG5cbmV4cG9ydHMudXRmMTYgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2RlcjogdXRmMTZFbmNvZGVyLFxuICAgICAgICBkZWNvZGVyOiB1dGYxNkRlY29kZXIsXG5cbiAgICAgICAgZ2V0Q29kZWM6IG9wdGlvbnMuaWNvbnYuZ2V0Q29kZWMsXG4gICAgfTtcbn07XG5cbi8vIC0tIEVuY29kaW5nXG5cbmZ1bmN0aW9uIHV0ZjE2RW5jb2RlcihvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIGNvZGVjID0gdGhpcy5nZXRDb2RlYyhvcHRpb25zLnVzZSB8fCAndXRmLTE2YmUnKTtcbiAgICBpZiAoIWNvZGVjLmJvbSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWNvbnYtbGl0ZTogaW4gVVRGLTE2IGVuY29kZXIsICd1c2UnIHBhcmFtZXRlciBzaG91bGQgYmUgZWl0aGVyIFVURi0xNkJFIG9yIFVURjE2LUxFLlwiKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHdyaXRlOiB1dGYxNkVuY29kZXJXcml0ZSxcbiAgICAgICAgZW5kOiB1dGYxNkVuY29kZXJFbmQsXG5cbiAgICAgICAgYm9tOiBjb2RlYy5ib20sXG4gICAgICAgIGludGVybmFsRW5jb2RlcjogY29kZWMuZW5jb2RlcihvcHRpb25zKSxcbiAgICB9O1xufVxuXG5mdW5jdGlvbiB1dGYxNkVuY29kZXJXcml0ZShzdHIpIHtcbiAgICB2YXIgYnVmID0gdGhpcy5pbnRlcm5hbEVuY29kZXIud3JpdGUoc3RyKTtcblxuICAgIGlmICh0aGlzLmJvbSkge1xuICAgICAgICBidWYgPSBCdWZmZXIuY29uY2F0KFt0aGlzLmJvbSwgYnVmXSk7XG4gICAgICAgIHRoaXMuYm9tID0gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmO1xufVxuXG5mdW5jdGlvbiB1dGYxNkVuY29kZXJFbmQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJuYWxFbmNvZGVyLmVuZCgpO1xufVxuXG5cbi8vIC0tIERlY29kaW5nXG5cbmZ1bmN0aW9uIHV0ZjE2RGVjb2RlcihvcHRpb25zKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgd3JpdGU6IHV0ZjE2RGVjb2RlcldyaXRlLFxuICAgICAgICBlbmQ6IHV0ZjE2RGVjb2RlckVuZCxcblxuICAgICAgICBpbnRlcm5hbERlY29kZXI6IG51bGwsXG4gICAgICAgIGluaXRpYWxCeXRlczogW10sXG4gICAgICAgIGluaXRpYWxCeXRlc0xlbjogMCxcblxuICAgICAgICBvcHRpb25zOiBvcHRpb25zIHx8IHt9LFxuICAgICAgICBnZXRDb2RlYzogdGhpcy5nZXRDb2RlYyxcbiAgICB9O1xufVxuXG5mdW5jdGlvbiB1dGYxNkRlY29kZXJXcml0ZShidWYpIHtcbiAgICBpZiAodGhpcy5pbnRlcm5hbERlY29kZXIpXG4gICAgICAgIHJldHVybiB0aGlzLmludGVybmFsRGVjb2Rlci53cml0ZShidWYpO1xuXG4gICAgLy8gQ29kZWMgaXMgbm90IGNob3NlbiB5ZXQuIEFjY3VtdWxhdGUgaW5pdGlhbCBieXRlcy5cbiAgICB0aGlzLmluaXRpYWxCeXRlcy5wdXNoKGJ1Zik7XG4gICAgdGhpcy5pbml0aWFsQnl0ZXNMZW4gKz0gYnVmLmxlbmd0aDtcbiAgICBcbiAgICBpZiAodGhpcy5pbml0aWFsQnl0ZXNMZW4gPCAxNikgLy8gV2UgbmVlZCA+IDIgYnl0ZXMgdG8gdXNlIHNwYWNlIGhldXJpc3RpYyAoc2VlIGJlbG93KVxuICAgICAgICByZXR1cm4gJyc7XG5cbiAgICAvLyBXZSBoYXZlIGVub3VnaCBieXRlcyAtPiBkZWNpZGUgZW5kaWFubmVzcy5cbiAgICByZXR1cm4gdXRmMTZEZWNvZGVyRGVjaWRlRW5kaWFubmVzcy5jYWxsKHRoaXMpO1xufVxuXG5mdW5jdGlvbiB1dGYxNkRlY29kZXJFbmQoKSB7XG4gICAgaWYgKHRoaXMuaW50ZXJuYWxEZWNvZGVyKVxuICAgICAgICByZXR1cm4gdGhpcy5pbnRlcm5hbERlY29kZXIuZW5kKCk7XG5cbiAgICB2YXIgcmVzID0gdXRmMTZEZWNvZGVyRGVjaWRlRW5kaWFubmVzcy5jYWxsKHRoaXMpO1xuICAgIHZhciB0cmFpbDtcblxuICAgIGlmICh0aGlzLmludGVybmFsRGVjb2RlcilcbiAgICAgICAgdHJhaWwgPSB0aGlzLmludGVybmFsRGVjb2Rlci5lbmQoKTtcblxuICAgIHJldHVybiAodHJhaWwgJiYgdHJhaWwubGVuZ3RoID4gMCkgPyAocmVzICsgdHJhaWwpIDogcmVzO1xufVxuXG5mdW5jdGlvbiB1dGYxNkRlY29kZXJEZWNpZGVFbmRpYW5uZXNzKCkge1xuICAgIHZhciBidWYgPSBCdWZmZXIuY29uY2F0KHRoaXMuaW5pdGlhbEJ5dGVzKTtcbiAgICB0aGlzLmluaXRpYWxCeXRlcy5sZW5ndGggPSB0aGlzLmluaXRpYWxCeXRlc0xlbiA9IDA7XG5cbiAgICBpZiAoYnVmLmxlbmd0aCA8IDIpXG4gICAgICAgIHJldHVybiAnJzsgLy8gTm90IGEgdmFsaWQgVVRGLTE2IHNlcXVlbmNlIGFueXdheS5cblxuICAgIC8vIERlZmF1bHQgZW5jb2RpbmcuXG4gICAgdmFyIGVuYyA9IHRoaXMub3B0aW9ucy5kZWZhdWx0IHx8ICd1dGYtMTZiZSc7XG5cbiAgICAvLyBDaGVjayBCT00uXG4gICAgaWYgKGJ1ZlswXSA9PSAweEZFICYmIGJ1ZlsxXSA9PSAweEZGKSB7IC8vIFVURi0xNkJFIEJPTVxuICAgICAgICBlbmMgPSAndXRmLTE2YmUnOyBidWYgPSBidWYuc2xpY2UoMik7XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ1ZlswXSA9PSAweEZGICYmIGJ1ZlsxXSA9PSAweEZFKSB7IC8vIFVURi0xNkxFIEJPTVxuICAgICAgICBlbmMgPSAndXRmLTE2bGUnOyBidWYgPSBidWYuc2xpY2UoMik7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICAvLyBObyBCT00gZm91bmQuIFRyeSB0byBkZWR1Y2UgZW5jb2RpbmcgZnJvbSBpbml0aWFsIGNvbnRlbnQuXG4gICAgICAgIC8vIE1vc3Qgb2YgdGhlIHRpbWUsIHRoZSBjb250ZW50IGhhcyBzcGFjZXMgKFUrMDAyMCksIGJ1dCB0aGUgb3Bwb3NpdGUgKFUrMjAwMCkgaXMgdmVyeSB1bmNvbW1vbi5cbiAgICAgICAgLy8gU28sIHdlIGNvdW50IHNwYWNlcyBhcyBpZiBpdCB3YXMgTEUgb3IgQkUsIGFuZCBkZWNpZGUgZnJvbSB0aGF0LlxuICAgICAgICB2YXIgc3BhY2VzID0gWzAsIDBdLCAvLyBDb3VudHMgb2Ygc3BhY2UgY2hhcnMgaW4gYm90aCBwb3NpdGlvbnNcbiAgICAgICAgICAgIF9sZW4gPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gKGJ1Zi5sZW5ndGggJSAyKSwgNjQpOyAvLyBMZW4gaXMgYWx3YXlzIGV2ZW4uXG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfbGVuOyBpICs9IDIpIHtcbiAgICAgICAgICAgIGlmIChidWZbaV0gPT0gMHgwMCAmJiBidWZbaSsxXSA9PSAweDIwKSBzcGFjZXNbMF0rKztcbiAgICAgICAgICAgIGlmIChidWZbaV0gPT0gMHgyMCAmJiBidWZbaSsxXSA9PSAweDAwKSBzcGFjZXNbMV0rKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGFjZXNbMF0gPiAwICYmIHNwYWNlc1sxXSA9PSAwKSAgXG4gICAgICAgICAgICBlbmMgPSAndXRmLTE2YmUnO1xuICAgICAgICBlbHNlIGlmIChzcGFjZXNbMF0gPT0gMCAmJiBzcGFjZXNbMV0gPiAwKVxuICAgICAgICAgICAgZW5jID0gJ3V0Zi0xNmxlJztcbiAgICB9XG5cbiAgICB0aGlzLmludGVybmFsRGVjb2RlciA9IHRoaXMuZ2V0Q29kZWMoZW5jKS5kZWNvZGVyKHRoaXMub3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuaW50ZXJuYWxEZWNvZGVyLndyaXRlKGJ1Zik7XG59XG5cblxuIiwiXG4vLyBVVEYtNyBjb2RlYywgYWNjb3JkaW5nIHRvIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMTUyXG4vLyBCZWxvdyBpcyBVVEYtNy1JTUFQIGNvZGVjLCBhY2NvcmRpbmcgdG8gaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzUwMSNzZWN0aW9uLTUuMS4zXG5cbmV4cG9ydHMudXRmNyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBlbmNvZGVyOiBmdW5jdGlvbiB1dGY3RW5jb2RlcigpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgd3JpdGU6IHV0ZjdFbmNvZGVyV3JpdGUsXG4gICAgICAgICAgICAgICAgZW5kOiBmdW5jdGlvbigpIHt9LFxuXG4gICAgICAgICAgICAgICAgaWNvbnY6IG9wdGlvbnMuaWNvbnYsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBkZWNvZGVyOiBmdW5jdGlvbiB1dGY3RGVjb2RlcigpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgd3JpdGU6IHV0ZjdEZWNvZGVyV3JpdGUsXG4gICAgICAgICAgICAgICAgZW5kOiB1dGY3RGVjb2RlckVuZCxcblxuICAgICAgICAgICAgICAgIGljb252OiBvcHRpb25zLmljb252LFxuICAgICAgICAgICAgICAgIGluQmFzZTY0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBiYXNlNjRBY2N1bTogJycsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgIH07XG59O1xuXG5leHBvcnRzLnVuaWNvZGUxMXV0ZjcgPSAndXRmNyc7IC8vIEFsaWFzIFVOSUNPREUtMS0xLVVURi03XG5cblxudmFyIG5vbkRpcmVjdENoYXJzID0gL1teQS1aYS16MC05J1xcKFxcKSwtXFwuXFwvOlxcPyBcXG5cXHJcXHRdKy9nO1xuXG5mdW5jdGlvbiB1dGY3RW5jb2RlcldyaXRlKHN0cikge1xuICAgIC8vIE5haXZlIGltcGxlbWVudGF0aW9uLlxuICAgIC8vIE5vbi1kaXJlY3QgY2hhcnMgYXJlIGVuY29kZWQgYXMgXCIrPGJhc2U2ND4tXCI7IHNpbmdsZSBcIitcIiBjaGFyIGlzIGVuY29kZWQgYXMgXCIrLVwiLlxuICAgIHJldHVybiBuZXcgQnVmZmVyKHN0ci5yZXBsYWNlKG5vbkRpcmVjdENoYXJzLCBmdW5jdGlvbihjaHVuaykge1xuICAgICAgICByZXR1cm4gXCIrXCIgKyAoY2h1bmsgPT09ICcrJyA/ICcnIDogXG4gICAgICAgICAgICB0aGlzLmljb252LmVuY29kZShjaHVuaywgJ3V0ZjE2LWJlJykudG9TdHJpbmcoJ2Jhc2U2NCcpLnJlcGxhY2UoLz0rJC8sICcnKSkgXG4gICAgICAgICAgICArIFwiLVwiO1xuICAgIH0uYmluZCh0aGlzKSkpO1xufVxuXG5cbnZhciBiYXNlNjRSZWdleCA9IC9bQS1aYS16MC05XFwvK10vO1xudmFyIGJhc2U2NENoYXJzID0gW107XG5mb3IgKHZhciBpID0gMDsgaSA8IDI1NjsgaSsrKVxuICAgIGJhc2U2NENoYXJzW2ldID0gYmFzZTY0UmVnZXgudGVzdChTdHJpbmcuZnJvbUNoYXJDb2RlKGkpKTtcblxudmFyIHBsdXNDaGFyID0gJysnLmNoYXJDb2RlQXQoMCksIFxuICAgIG1pbnVzQ2hhciA9ICctJy5jaGFyQ29kZUF0KDApLFxuICAgIGFuZENoYXIgPSAnJicuY2hhckNvZGVBdCgwKTtcblxuZnVuY3Rpb24gdXRmN0RlY29kZXJXcml0ZShidWYpIHtcbiAgICB2YXIgcmVzID0gXCJcIiwgbGFzdEkgPSAwLFxuICAgICAgICBpbkJhc2U2NCA9IHRoaXMuaW5CYXNlNjQsXG4gICAgICAgIGJhc2U2NEFjY3VtID0gdGhpcy5iYXNlNjRBY2N1bTtcblxuICAgIC8vIFRoZSBkZWNvZGVyIGlzIG1vcmUgaW52b2x2ZWQgYXMgd2UgbXVzdCBoYW5kbGUgY2h1bmtzIGluIHN0cmVhbS5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICghaW5CYXNlNjQpIHsgLy8gV2UncmUgaW4gZGlyZWN0IG1vZGUuXG4gICAgICAgICAgICAvLyBXcml0ZSBkaXJlY3QgY2hhcnMgdW50aWwgJysnXG4gICAgICAgICAgICBpZiAoYnVmW2ldID09IHBsdXNDaGFyKSB7XG4gICAgICAgICAgICAgICAgcmVzICs9IHRoaXMuaWNvbnYuZGVjb2RlKGJ1Zi5zbGljZShsYXN0SSwgaSksIFwiYXNjaWlcIik7IC8vIFdyaXRlIGRpcmVjdCBjaGFycy5cbiAgICAgICAgICAgICAgICBsYXN0SSA9IGkrMTtcbiAgICAgICAgICAgICAgICBpbkJhc2U2NCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7IC8vIFdlIGRlY29kZSBiYXNlNjQuXG4gICAgICAgICAgICBpZiAoIWJhc2U2NENoYXJzW2J1ZltpXV0pIHsgLy8gQmFzZTY0IGVuZGVkLlxuICAgICAgICAgICAgICAgIGlmIChpID09IGxhc3RJICYmIGJ1ZltpXSA9PSBtaW51c0NoYXIpIHsvLyBcIistXCIgLT4gXCIrXCJcbiAgICAgICAgICAgICAgICAgICAgcmVzICs9IFwiK1wiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBiNjRzdHIgPSBiYXNlNjRBY2N1bSArIGJ1Zi5zbGljZShsYXN0SSwgaSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzICs9IHRoaXMuaWNvbnYuZGVjb2RlKG5ldyBCdWZmZXIoYjY0c3RyLCAnYmFzZTY0JyksIFwidXRmMTYtYmVcIik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGJ1ZltpXSAhPSBtaW51c0NoYXIpIC8vIE1pbnVzIGlzIGFic29yYmVkIGFmdGVyIGJhc2U2NC5cbiAgICAgICAgICAgICAgICAgICAgaS0tO1xuXG4gICAgICAgICAgICAgICAgbGFzdEkgPSBpKzE7XG4gICAgICAgICAgICAgICAgaW5CYXNlNjQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBiYXNlNjRBY2N1bSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbkJhc2U2NCkge1xuICAgICAgICByZXMgKz0gdGhpcy5pY29udi5kZWNvZGUoYnVmLnNsaWNlKGxhc3RJKSwgXCJhc2NpaVwiKTsgLy8gV3JpdGUgZGlyZWN0IGNoYXJzLlxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBiNjRzdHIgPSBiYXNlNjRBY2N1bSArIGJ1Zi5zbGljZShsYXN0SSkudG9TdHJpbmcoKTtcblxuICAgICAgICB2YXIgY2FuQmVEZWNvZGVkID0gYjY0c3RyLmxlbmd0aCAtIChiNjRzdHIubGVuZ3RoICUgOCk7IC8vIE1pbmltYWwgY2h1bms6IDIgcXVhZHMgLT4gMngzIGJ5dGVzIC0+IDMgY2hhcnMuXG4gICAgICAgIGJhc2U2NEFjY3VtID0gYjY0c3RyLnNsaWNlKGNhbkJlRGVjb2RlZCk7IC8vIFRoZSByZXN0IHdpbGwgYmUgZGVjb2RlZCBpbiBmdXR1cmUuXG4gICAgICAgIGI2NHN0ciA9IGI2NHN0ci5zbGljZSgwLCBjYW5CZURlY29kZWQpO1xuXG4gICAgICAgIHJlcyArPSB0aGlzLmljb252LmRlY29kZShuZXcgQnVmZmVyKGI2NHN0ciwgJ2Jhc2U2NCcpLCBcInV0ZjE2LWJlXCIpO1xuICAgIH1cblxuICAgIHRoaXMuaW5CYXNlNjQgPSBpbkJhc2U2NDtcbiAgICB0aGlzLmJhc2U2NEFjY3VtID0gYmFzZTY0QWNjdW07XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiB1dGY3RGVjb2RlckVuZCgpIHtcbiAgICB2YXIgcmVzID0gXCJcIjtcbiAgICBpZiAodGhpcy5pbkJhc2U2NCAmJiB0aGlzLmJhc2U2NEFjY3VtLmxlbmd0aCA+IDApXG4gICAgICAgIHJlcyA9IHRoaXMuaWNvbnYuZGVjb2RlKG5ldyBCdWZmZXIodGhpcy5iYXNlNjRBY2N1bSwgJ2Jhc2U2NCcpLCBcInV0ZjE2LWJlXCIpO1xuXG4gICAgdGhpcy5pbkJhc2U2NCA9IGZhbHNlO1xuICAgIHRoaXMuYmFzZTY0QWNjdW0gPSAnJztcbiAgICByZXR1cm4gcmVzO1xufVxuXG5cbi8vIFVURi03LUlNQVAgY29kZWMuXG4vLyBSRkMzNTAxIFNlYy4gNS4xLjMgTW9kaWZpZWQgVVRGLTcgKGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM1MDEjc2VjdGlvbi01LjEuMylcbi8vIERpZmZlcmVuY2VzOlxuLy8gICogQmFzZTY0IHBhcnQgaXMgc3RhcnRlZCBieSBcIiZcIiBpbnN0ZWFkIG9mIFwiK1wiXG4vLyAgKiBEaXJlY3QgY2hhcmFjdGVycyBhcmUgMHgyMC0weDdFLCBleGNlcHQgXCImXCIgKDB4MjYpXG4vLyAgKiBJbiBCYXNlNjQsIFwiLFwiIGlzIHVzZWQgaW5zdGVhZCBvZiBcIi9cIlxuLy8gICogQmFzZTY0IG11c3Qgbm90IGJlIHVzZWQgdG8gcmVwcmVzZW50IGRpcmVjdCBjaGFyYWN0ZXJzLlxuLy8gICogTm8gaW1wbGljaXQgc2hpZnQgYmFjayBmcm9tIEJhc2U2NCAoc2hvdWxkIGFsd2F5cyBlbmQgd2l0aCAnLScpXG4vLyAgKiBTdHJpbmcgbXVzdCBlbmQgaW4gbm9uLXNoaWZ0ZWQgcG9zaXRpb24uXG4vLyAgKiBcIi0mXCIgd2hpbGUgaW4gYmFzZTY0IGlzIG5vdCBhbGxvd2VkLlxuXG5cbmV4cG9ydHMudXRmN2ltYXAgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZW5jb2RlcjogZnVuY3Rpb24gdXRmN0ltYXBFbmNvZGVyKCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB3cml0ZTogdXRmN0ltYXBFbmNvZGVyV3JpdGUsXG4gICAgICAgICAgICAgICAgZW5kOiB1dGY3SW1hcEVuY29kZXJFbmQsXG5cbiAgICAgICAgICAgICAgICBpY29udjogb3B0aW9ucy5pY29udixcbiAgICAgICAgICAgICAgICBpbkJhc2U2NDogZmFsc2UsXG4gICAgICAgICAgICAgICAgYmFzZTY0QWNjdW06IG5ldyBCdWZmZXIoNiksXG4gICAgICAgICAgICAgICAgYmFzZTY0QWNjdW1JZHg6IDAsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBkZWNvZGVyOiBmdW5jdGlvbiB1dGY3SW1hcERlY29kZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHdyaXRlOiB1dGY3SW1hcERlY29kZXJXcml0ZSxcbiAgICAgICAgICAgICAgICBlbmQ6IHV0ZjdJbWFwRGVjb2RlckVuZCxcblxuICAgICAgICAgICAgICAgIGljb252OiBvcHRpb25zLmljb252LFxuICAgICAgICAgICAgICAgIGluQmFzZTY0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBiYXNlNjRBY2N1bTogJycsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgIH07XG59O1xuXG5cbmZ1bmN0aW9uIHV0ZjdJbWFwRW5jb2RlcldyaXRlKHN0cikge1xuICAgIHZhciBpbkJhc2U2NCA9IHRoaXMuaW5CYXNlNjQsXG4gICAgICAgIGJhc2U2NEFjY3VtID0gdGhpcy5iYXNlNjRBY2N1bSxcbiAgICAgICAgYmFzZTY0QWNjdW1JZHggPSB0aGlzLmJhc2U2NEFjY3VtSWR4LFxuICAgICAgICBidWYgPSBuZXcgQnVmZmVyKHN0ci5sZW5ndGgqNSArIDEwKSwgYnVmSWR4ID0gMDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciB1Q2hhciA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBpZiAoMHgyMCA8PSB1Q2hhciAmJiB1Q2hhciA8PSAweDdFKSB7IC8vIERpcmVjdCBjaGFyYWN0ZXIgb3IgJyYnLlxuICAgICAgICAgICAgaWYgKGluQmFzZTY0KSB7XG4gICAgICAgICAgICAgICAgaWYgKGJhc2U2NEFjY3VtSWR4ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBidWZJZHggKz0gYnVmLndyaXRlKGJhc2U2NEFjY3VtLnNsaWNlKDAsIGJhc2U2NEFjY3VtSWR4KS50b1N0cmluZygnYmFzZTY0JykucmVwbGFjZSgvXFwvL2csICcsJykucmVwbGFjZSgvPSskLywgJycpLCBidWZJZHgpO1xuICAgICAgICAgICAgICAgICAgICBiYXNlNjRBY2N1bUlkeCA9IDA7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnVmW2J1ZklkeCsrXSA9IG1pbnVzQ2hhcjsgLy8gV3JpdGUgJy0nLCB0aGVuIGdvIHRvIGRpcmVjdCBtb2RlLlxuICAgICAgICAgICAgICAgIGluQmFzZTY0ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaW5CYXNlNjQpIHtcbiAgICAgICAgICAgICAgICBidWZbYnVmSWR4KytdID0gdUNoYXI7IC8vIFdyaXRlIGRpcmVjdCBjaGFyYWN0ZXJcblxuICAgICAgICAgICAgICAgIGlmICh1Q2hhciA9PT0gYW5kQ2hhcikgIC8vIEFtcGVyc2FuZCAtPiAnJi0nXG4gICAgICAgICAgICAgICAgICAgIGJ1ZltidWZJZHgrK10gPSBtaW51c0NoYXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHsgLy8gTm9uLWRpcmVjdCBjaGFyYWN0ZXJcbiAgICAgICAgICAgIGlmICghaW5CYXNlNjQpIHtcbiAgICAgICAgICAgICAgICBidWZbYnVmSWR4KytdID0gYW5kQ2hhcjsgLy8gV3JpdGUgJyYnLCB0aGVuIGdvIHRvIGJhc2U2NCBtb2RlLlxuICAgICAgICAgICAgICAgIGluQmFzZTY0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbkJhc2U2NCkge1xuICAgICAgICAgICAgICAgIGJhc2U2NEFjY3VtW2Jhc2U2NEFjY3VtSWR4KytdID0gdUNoYXIgPj4gODtcbiAgICAgICAgICAgICAgICBiYXNlNjRBY2N1bVtiYXNlNjRBY2N1bUlkeCsrXSA9IHVDaGFyICYgMHhGRjtcblxuICAgICAgICAgICAgICAgIGlmIChiYXNlNjRBY2N1bUlkeCA9PSBiYXNlNjRBY2N1bS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgYnVmSWR4ICs9IGJ1Zi53cml0ZShiYXNlNjRBY2N1bS50b1N0cmluZygnYmFzZTY0JykucmVwbGFjZSgvXFwvL2csICcsJyksIGJ1ZklkeCk7XG4gICAgICAgICAgICAgICAgICAgIGJhc2U2NEFjY3VtSWR4ID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmluQmFzZTY0ID0gaW5CYXNlNjQ7XG4gICAgdGhpcy5iYXNlNjRBY2N1bUlkeCA9IGJhc2U2NEFjY3VtSWR4O1xuXG4gICAgcmV0dXJuIGJ1Zi5zbGljZSgwLCBidWZJZHgpO1xufVxuXG5mdW5jdGlvbiB1dGY3SW1hcEVuY29kZXJFbmQoKSB7XG4gICAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoMTApLCBidWZJZHggPSAwO1xuICAgIGlmICh0aGlzLmluQmFzZTY0KSB7XG4gICAgICAgIGlmICh0aGlzLmJhc2U2NEFjY3VtSWR4ID4gMCkge1xuICAgICAgICAgICAgYnVmSWR4ICs9IGJ1Zi53cml0ZSh0aGlzLmJhc2U2NEFjY3VtLnNsaWNlKDAsIHRoaXMuYmFzZTY0QWNjdW1JZHgpLnRvU3RyaW5nKCdiYXNlNjQnKS5yZXBsYWNlKC9cXC8vZywgJywnKS5yZXBsYWNlKC89KyQvLCAnJyksIGJ1ZklkeCk7XG4gICAgICAgICAgICB0aGlzLmJhc2U2NEFjY3VtSWR4ID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ1ZltidWZJZHgrK10gPSBtaW51c0NoYXI7IC8vIFdyaXRlICctJywgdGhlbiBnbyB0byBkaXJlY3QgbW9kZS5cbiAgICAgICAgdGhpcy5pbkJhc2U2NCA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBidWYuc2xpY2UoMCwgYnVmSWR4KTtcbn1cblxuXG52YXIgYmFzZTY0SU1BUENoYXJzID0gYmFzZTY0Q2hhcnMuc2xpY2UoKTtcbmJhc2U2NElNQVBDaGFyc1snLCcuY2hhckNvZGVBdCgwKV0gPSB0cnVlO1xuXG5mdW5jdGlvbiB1dGY3SW1hcERlY29kZXJXcml0ZShidWYpIHtcbiAgICB2YXIgcmVzID0gXCJcIiwgbGFzdEkgPSAwLFxuICAgICAgICBpbkJhc2U2NCA9IHRoaXMuaW5CYXNlNjQsXG4gICAgICAgIGJhc2U2NEFjY3VtID0gdGhpcy5iYXNlNjRBY2N1bTtcblxuICAgIC8vIFRoZSBkZWNvZGVyIGlzIG1vcmUgaW52b2x2ZWQgYXMgd2UgbXVzdCBoYW5kbGUgY2h1bmtzIGluIHN0cmVhbS5cbiAgICAvLyBJdCBpcyBmb3JnaXZpbmcsIGNsb3NlciB0byBzdGFuZGFyZCBVVEYtNyAoZm9yIGV4YW1wbGUsICctJyBpcyBvcHRpb25hbCBhdCB0aGUgZW5kKS5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmICghaW5CYXNlNjQpIHsgLy8gV2UncmUgaW4gZGlyZWN0IG1vZGUuXG4gICAgICAgICAgICAvLyBXcml0ZSBkaXJlY3QgY2hhcnMgdW50aWwgJyYnXG4gICAgICAgICAgICBpZiAoYnVmW2ldID09IGFuZENoYXIpIHtcbiAgICAgICAgICAgICAgICByZXMgKz0gdGhpcy5pY29udi5kZWNvZGUoYnVmLnNsaWNlKGxhc3RJLCBpKSwgXCJhc2NpaVwiKTsgLy8gV3JpdGUgZGlyZWN0IGNoYXJzLlxuICAgICAgICAgICAgICAgIGxhc3RJID0gaSsxO1xuICAgICAgICAgICAgICAgIGluQmFzZTY0ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gV2UgZGVjb2RlIGJhc2U2NC5cbiAgICAgICAgICAgIGlmICghYmFzZTY0SU1BUENoYXJzW2J1ZltpXV0pIHsgLy8gQmFzZTY0IGVuZGVkLlxuICAgICAgICAgICAgICAgIGlmIChpID09IGxhc3RJICYmIGJ1ZltpXSA9PSBtaW51c0NoYXIpIHsgLy8gXCImLVwiIC0+IFwiJlwiXG4gICAgICAgICAgICAgICAgICAgIHJlcyArPSBcIiZcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2YXIgYjY0c3RyID0gYmFzZTY0QWNjdW0gKyBidWYuc2xpY2UobGFzdEksIGkpLnRvU3RyaW5nKCkucmVwbGFjZSgvLC9nLCAnLycpO1xuICAgICAgICAgICAgICAgICAgICByZXMgKz0gdGhpcy5pY29udi5kZWNvZGUobmV3IEJ1ZmZlcihiNjRzdHIsICdiYXNlNjQnKSwgXCJ1dGYxNi1iZVwiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYnVmW2ldICE9IG1pbnVzQ2hhcikgLy8gTWludXMgbWF5IGJlIGFic29yYmVkIGFmdGVyIGJhc2U2NC5cbiAgICAgICAgICAgICAgICAgICAgaS0tO1xuXG4gICAgICAgICAgICAgICAgbGFzdEkgPSBpKzE7XG4gICAgICAgICAgICAgICAgaW5CYXNlNjQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBiYXNlNjRBY2N1bSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFpbkJhc2U2NCkge1xuICAgICAgICByZXMgKz0gdGhpcy5pY29udi5kZWNvZGUoYnVmLnNsaWNlKGxhc3RJKSwgXCJhc2NpaVwiKTsgLy8gV3JpdGUgZGlyZWN0IGNoYXJzLlxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBiNjRzdHIgPSBiYXNlNjRBY2N1bSArIGJ1Zi5zbGljZShsYXN0SSkudG9TdHJpbmcoKS5yZXBsYWNlKC8sL2csICcvJyk7XG5cbiAgICAgICAgdmFyIGNhbkJlRGVjb2RlZCA9IGI2NHN0ci5sZW5ndGggLSAoYjY0c3RyLmxlbmd0aCAlIDgpOyAvLyBNaW5pbWFsIGNodW5rOiAyIHF1YWRzIC0+IDJ4MyBieXRlcyAtPiAzIGNoYXJzLlxuICAgICAgICBiYXNlNjRBY2N1bSA9IGI2NHN0ci5zbGljZShjYW5CZURlY29kZWQpOyAvLyBUaGUgcmVzdCB3aWxsIGJlIGRlY29kZWQgaW4gZnV0dXJlLlxuICAgICAgICBiNjRzdHIgPSBiNjRzdHIuc2xpY2UoMCwgY2FuQmVEZWNvZGVkKTtcblxuICAgICAgICByZXMgKz0gdGhpcy5pY29udi5kZWNvZGUobmV3IEJ1ZmZlcihiNjRzdHIsICdiYXNlNjQnKSwgXCJ1dGYxNi1iZVwiKTtcbiAgICB9XG5cbiAgICB0aGlzLmluQmFzZTY0ID0gaW5CYXNlNjQ7XG4gICAgdGhpcy5iYXNlNjRBY2N1bSA9IGJhc2U2NEFjY3VtO1xuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gdXRmN0ltYXBEZWNvZGVyRW5kKCkge1xuICAgIHZhciByZXMgPSBcIlwiO1xuICAgIGlmICh0aGlzLmluQmFzZTY0ICYmIHRoaXMuYmFzZTY0QWNjdW0ubGVuZ3RoID4gMClcbiAgICAgICAgcmVzID0gdGhpcy5pY29udi5kZWNvZGUobmV3IEJ1ZmZlcih0aGlzLmJhc2U2NEFjY3VtLCAnYmFzZTY0JyksIFwidXRmMTYtYmVcIik7XG5cbiAgICB0aGlzLmluQmFzZTY0ID0gZmFsc2U7XG4gICAgdGhpcy5iYXNlNjRBY2N1bSA9ICcnO1xuICAgIHJldHVybiByZXM7XG59XG5cblxuIiwiXG52YXIgaWNvbnYgPSBtb2R1bGUuZXhwb3J0cztcblxuLy8gQWxsIGNvZGVjcyBhbmQgYWxpYXNlcyBhcmUga2VwdCBoZXJlLCBrZXllZCBieSBlbmNvZGluZyBuYW1lL2FsaWFzLlxuLy8gVGhleSBhcmUgbGF6eSBsb2FkZWQgaW4gYGljb252LmdldENvZGVjYCBmcm9tIGBlbmNvZGluZ3MvaW5kZXguanNgLlxuaWNvbnYuZW5jb2RpbmdzID0gbnVsbDtcblxuLy8gQ2hhcmFjdGVycyBlbWl0dGVkIGluIGNhc2Ugb2YgZXJyb3IuXG5pY29udi5kZWZhdWx0Q2hhclVuaWNvZGUgPSAn77+9Jztcbmljb252LmRlZmF1bHRDaGFyU2luZ2xlQnl0ZSA9ICc/JztcblxuLy8gUHVibGljIEFQSS5cbmljb252LmVuY29kZSA9IGZ1bmN0aW9uIGVuY29kZShzdHIsIGVuY29kaW5nLCBvcHRpb25zKSB7XG4gICAgc3RyID0gXCJcIiArIChzdHIgfHwgXCJcIik7IC8vIEVuc3VyZSBzdHJpbmcuXG5cbiAgICB2YXIgZW5jb2RlciA9IGljb252LmdldENvZGVjKGVuY29kaW5nKS5lbmNvZGVyKG9wdGlvbnMpO1xuXG4gICAgdmFyIHJlcyA9IGVuY29kZXIud3JpdGUoc3RyKTtcbiAgICB2YXIgdHJhaWwgPSBlbmNvZGVyLmVuZCgpO1xuICAgIFxuICAgIHJldHVybiAodHJhaWwgJiYgdHJhaWwubGVuZ3RoID4gMCkgPyBCdWZmZXIuY29uY2F0KFtyZXMsIHRyYWlsXSkgOiByZXM7XG59XG5cbmljb252LmRlY29kZSA9IGZ1bmN0aW9uIGRlY29kZShidWYsIGVuY29kaW5nLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGVvZiBidWYgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghaWNvbnYuc2tpcERlY29kZVdhcm5pbmcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ljb252LWxpdGUgd2FybmluZzogZGVjb2RlKCktaW5nIHN0cmluZ3MgaXMgZGVwcmVjYXRlZC4gUmVmZXIgdG8gaHR0cHM6Ly9naXRodWIuY29tL2FzaHR1Y2hraW4vaWNvbnYtbGl0ZS93aWtpL1VzZS1CdWZmZXJzLXdoZW4tZGVjb2RpbmcnKTtcbiAgICAgICAgICAgIGljb252LnNraXBEZWNvZGVXYXJuaW5nID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ1ZiA9IG5ldyBCdWZmZXIoXCJcIiArIChidWYgfHwgXCJcIiksIFwiYmluYXJ5XCIpOyAvLyBFbnN1cmUgYnVmZmVyLlxuICAgIH1cblxuICAgIHZhciBkZWNvZGVyID0gaWNvbnYuZ2V0Q29kZWMoZW5jb2RpbmcpLmRlY29kZXIob3B0aW9ucyk7XG5cbiAgICB2YXIgcmVzID0gZGVjb2Rlci53cml0ZShidWYpO1xuICAgIHZhciB0cmFpbCA9IGRlY29kZXIuZW5kKCk7XG5cbiAgICByZXR1cm4gKHRyYWlsICYmIHRyYWlsLmxlbmd0aCA+IDApID8gKHJlcyArIHRyYWlsKSA6IHJlcztcbn1cblxuaWNvbnYuZW5jb2RpbmdFeGlzdHMgPSBmdW5jdGlvbiBlbmNvZGluZ0V4aXN0cyhlbmMpIHtcbiAgICB0cnkge1xuICAgICAgICBpY29udi5nZXRDb2RlYyhlbmMpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8vIExlZ2FjeSBhbGlhc2VzIHRvIGNvbnZlcnQgZnVuY3Rpb25zXG5pY29udi50b0VuY29kaW5nID0gaWNvbnYuZW5jb2RlO1xuaWNvbnYuZnJvbUVuY29kaW5nID0gaWNvbnYuZGVjb2RlO1xuXG4vLyBTZWFyY2ggZm9yIGEgY29kZWMgaW4gaWNvbnYuZW5jb2RpbmdzLiBDYWNoZSBjb2RlYyBkYXRhIGluIGljb252Ll9jb2RlY0RhdGFDYWNoZS5cbmljb252Ll9jb2RlY0RhdGFDYWNoZSA9IHt9O1xuaWNvbnYuZ2V0Q29kZWMgPSBmdW5jdGlvbiBnZXRDb2RlYyhlbmNvZGluZykge1xuICAgIGlmICghaWNvbnYuZW5jb2RpbmdzKVxuICAgICAgICBpY29udi5lbmNvZGluZ3MgPSByZXF1aXJlKFwiLi4vZW5jb2RpbmdzXCIpOyAvLyBMYXp5IGxvYWQgYWxsIGVuY29kaW5nIGRlZmluaXRpb25zLlxuICAgIFxuICAgIC8vIENhbm9uaWNhbGl6ZSBlbmNvZGluZyBuYW1lOiBzdHJpcCBhbGwgbm9uLWFscGhhbnVtZXJpYyBjaGFycyBhbmQgYXBwZW5kZWQgeWVhci5cbiAgICB2YXIgZW5jID0gKCcnK2VuY29kaW5nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teMC05YS16XXw6XFxkezR9JC9nLCBcIlwiKTtcblxuICAgIC8vIFRyYXZlcnNlIGljb252LmVuY29kaW5ncyB0byBmaW5kIGFjdHVhbCBjb2RlYy5cbiAgICB2YXIgY29kZWNEYXRhLCBjb2RlY09wdGlvbnM7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29kZWNEYXRhID0gaWNvbnYuX2NvZGVjRGF0YUNhY2hlW2VuY107XG4gICAgICAgIGlmIChjb2RlY0RhdGEpXG4gICAgICAgICAgICByZXR1cm4gY29kZWNEYXRhO1xuXG4gICAgICAgIHZhciBjb2RlYyA9IGljb252LmVuY29kaW5nc1tlbmNdO1xuXG4gICAgICAgIHN3aXRjaCAodHlwZW9mIGNvZGVjKSB7XG4gICAgICAgICAgICBjYXNlIFwic3RyaW5nXCI6IC8vIERpcmVjdCBhbGlhcyB0byBvdGhlciBlbmNvZGluZy5cbiAgICAgICAgICAgICAgICBlbmMgPSBjb2RlYztcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIm9iamVjdFwiOiAvLyBBbGlhcyB3aXRoIG9wdGlvbnMuIENhbiBiZSBsYXllcmVkLlxuICAgICAgICAgICAgICAgIGlmICghY29kZWNPcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGVjT3B0aW9ucyA9IGNvZGVjO1xuICAgICAgICAgICAgICAgICAgICBjb2RlY09wdGlvbnMuZW5jb2RpbmdOYW1lID0gZW5jO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIGNvZGVjKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZWNPcHRpb25zW2tleV0gPSBjb2RlY1trZXldO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVuYyA9IGNvZGVjLnR5cGU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOiAvLyBDb2RlYyBpdHNlbGYuXG4gICAgICAgICAgICAgICAgaWYgKCFjb2RlY09wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAgIGNvZGVjT3B0aW9ucyA9IHsgZW5jb2RpbmdOYW1lOiBlbmMgfTtcbiAgICAgICAgICAgICAgICBjb2RlY09wdGlvbnMuaWNvbnYgPSBpY29udjtcblxuICAgICAgICAgICAgICAgIC8vIFRoZSBjb2RlYyBmdW5jdGlvbiBtdXN0IGxvYWQgYWxsIHRhYmxlcyBhbmQgcmV0dXJuIG9iamVjdCB3aXRoIC5lbmNvZGVyIGFuZCAuZGVjb2RlciBtZXRob2RzLlxuICAgICAgICAgICAgICAgIC8vIEl0J2xsIGJlIGNhbGxlZCBvbmx5IG9uY2UgKGZvciBlYWNoIGRpZmZlcmVudCBvcHRpb25zIG9iamVjdCkuXG4gICAgICAgICAgICAgICAgY29kZWNEYXRhID0gY29kZWMuY2FsbChpY29udi5lbmNvZGluZ3MsIGNvZGVjT3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBpY29udi5fY29kZWNEYXRhQ2FjaGVbY29kZWNPcHRpb25zLmVuY29kaW5nTmFtZV0gPSBjb2RlY0RhdGE7IC8vIFNhdmUgaXQgdG8gYmUgcmV1c2VkIGxhdGVyLlxuICAgICAgICAgICAgICAgIHJldHVybiBjb2RlY0RhdGE7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5jb2Rpbmcgbm90IHJlY29nbml6ZWQ6ICdcIiArIGVuY29kaW5nICsgXCInIChzZWFyY2hlZCBhczogJ1wiK2VuYytcIicpXCIpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBMb2FkIGV4dGVuc2lvbnMgaW4gTm9kZS4gQWxsIG9mIHRoZW0gYXJlIG9taXR0ZWQgaW4gQnJvd3NlcmlmeSBidWlsZCB2aWEgJ2Jyb3dzZXInIGZpZWxkIGluIHBhY2thZ2UuanNvbi5cbnZhciBub2RlVmVyID0gdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHByb2Nlc3MudmVyc2lvbnMgJiYgcHJvY2Vzcy52ZXJzaW9ucy5ub2RlO1xuaWYgKG5vZGVWZXIpIHtcblxuICAgIC8vIExvYWQgc3RyZWFtaW5nIHN1cHBvcnQgaW4gTm9kZSB2MC4xMCtcbiAgICB2YXIgbm9kZVZlckFyciA9IG5vZGVWZXIuc3BsaXQoXCIuXCIpLm1hcChOdW1iZXIpO1xuICAgIGlmIChub2RlVmVyQXJyWzBdID4gMCB8fCBub2RlVmVyQXJyWzFdID49IDEwKSB7XG4gICAgICAgIHJlcXVpcmUoXCIuL3N0cmVhbXNcIikoaWNvbnYpO1xuICAgIH1cblxuICAgIC8vIExvYWQgTm9kZSBwcmltaXRpdmUgZXh0ZW5zaW9ucy5cbiAgICByZXF1aXJlKFwiLi9leHRlbmQtbm9kZVwiKShpY29udik7XG59XG5cbiJdfQ==
