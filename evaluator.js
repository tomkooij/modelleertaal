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
    return this.varPrefix + string.replace(/\{/g,'_lA_').replace(/\}/g,'_rA_').replace(/\[/g,'_lH_').replace(/\]/g,'_rH_').replace(/\|/g,'_I_');
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
        var msg = "De variabele '" + name + "' heeft nog geen waarde.";
        var lijkt_op = this.findSimilarName(name);
        if (lijkt_op) {
            msg += " Bedoel je '" + lijkt_op + "'? (Let op hoofdletters en typefouten.)";
        } else if (node.astName == 'startwaarden') {
            msg += " Geef '" + name + "' eerst (hoger in de startwaarden) een waarde.";
        } else {
            msg += " Geef '" + name + "' een startwaarde, of bereken '" + name + "' eerder in het model.";
        }
        var err = new EvalError(msg);
        err.undefined_variable = name;
        throw_custom_error(err, node.astName, node.lineNo);
    }
    return this.varDict[name];
};

// find a known variable that looks like name (typo or wrong case)
Namespace.prototype.findSimilarName = function(name) {

    function distance(a, b) {
        // Levenshtein distance
        var i, j, prev, tmp;
        var row = [];
        for (j = 0; j <= b.length; j++) row[j] = j;
        for (i = 1; i <= a.length; i++) {
            prev = row[0];
            row[0] = i;
            for (j = 1; j <= b.length; j++) {
                tmp = row[j];
                row[j] = Math.min(row[j] + 1, row[j-1] + 1,
                                  prev + (a.charAt(i-1) == b.charAt(j-1) ? 0 : 1));
                prev = tmp;
            }
        }
        return row[b.length];
    }

    var known = this.constNames.concat(this.varNames);
    var i;
    for (i = 0; i < known.length; i++) {
        if (known[i].toLowerCase() == name.toLowerCase()) return known[i];
    }
    if (name.length < 3) return null;
    for (i = 0; i < known.length; i++) {
        if (known[i].length >= 3 && distance(known[i], name) <= 2 &&
            distance(known[i].toLowerCase(), name.toLowerCase()) <= (name.length > 4 ? 2 : 1)) return known[i];
    }
    return null;
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
                        case '-':   return "(-1. * " + this.parseNode(node.right) + ")";
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
                    case 'wortel': return "Math.sqrt("+this.parseNode(node.expr)+")";
                    case 'sqr': return "Math.pow("+this.parseNode(node.expr)+",2)";
                    case 'entier': return "Math.floor("+this.parseNode(node.expr)+")";
                    case 'round': return "Math.round("+this.parseNode(node.expr)+")";
                    case 'sign': return "Math.sign("+this.parseNode(node.expr)+")";
                    case 'teken': return "Math.sign("+this.parseNode(node.expr)+")";
                    case 'abs': return "Math.abs("+this.parseNode(node.expr)+")";
                    case 'min': return "Math.min("+this.parseNode(node.expr)+")";
                    case 'max': return "Math.max("+this.parseNode(node.expr)+")";

                    default:
                        var err1 = new SyntaxError("Onbekende functie '" + node.func + "(...)'. Bedoel je een vermenigvuldiging? Schrijf dan: " + node.func + " * (...)");
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
                return 'halted=true;\nbailout=true;\nbreak;';
        case 'Print':
                // print(x) wil stop execution and print "alert()" the value of variable x
                var internal_var_name = this.namespace.referenceVar({name: node.varname, lineNo: node.lineNo, astName: node.astName});
                return 'report("Gestopt: '+node.varname+' = "+Number('+internal_var_name+').toPrecision(4));\nhalted=true;\nbailout=true;\nbreak;';
        case 'Blank': {
                var err_blank = new SyntaxError("Vul iets in op de plaats van de puntjes ( ... ).");
                err_blank.blank = true;
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

    this.messages = [];   // output of print()
    this.stopped = false; // model stopped by stop/print (not by the debugger)

    this.startwaarden_ast = parse_or_throw(this.model.startwaarden, 'startwaarden');
    this.modelregels_ast = parse_or_throw(this.model.modelregels, 'modelregels');

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

    if (!this.new_run && this.stopped) {
      // stopped by stop/print: never continue after the stop
      return;
    }

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
      if (this.debug) console.log("evaluator.run *** second run ***");

      if (this.tracing) {
          if (this.debug) console.log("tracing...", this.breakpoint_at_line);
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

    this.generated_code = "function run_model(storage, report) { \n ";

    if (this.new_run) {
        this.generated_code += ""+
                 this.codegenerator.generateVariableInitCode() +
                 this.startwaarden_code + "\n" +
                  "var i=0;\n" +
                  this.codegenerator.generateVariableStorageCode();
    } else {
        this.generated_code += ""+
                  this.codegenerator.generateVariableInitCode_second_run();
    }

    this.generated_code +=
                  "    var bailout = false;\n"+
                  "    var halted = false;\n"+
                  "    for (i="+start+"; i < "+end+"; i++) { \n " +
                  this.modelregels_code + "\n" +
                  this.codegenerator.generateVariableStorageCode() +
                  "      }\n" +
                  " if (bailout) {" +
                  this.codegenerator.generateVariableStorageCode() +
                  " }\n" +
                  " return halted;} \n" +
                  "return run_model(results, report);\n";

    if (this.debug) {
        console.log('*** generated js ***');
        console.log(this.generated_code);
        console.log("*** running! *** ");
        console.log("N = ", this.N);
    }

    var t1 = Date.now();

    // eval(model); // slow... in chrome >23
    //  the optimising compiler does not optimise eval() in local scope
    //  http://moduscreate.com/javascript-performance-tips-tricks/


    var self = this;
    this.messages = [];
    var runModel = new Function('results', 'report', this.generated_code);
    this.stopped = runModel(this.result, function(msg) {
        self.messages.push(msg);
    });

    var t2 = Date.now();
    this.runtime_ms = t2 - t1;

    if (this.debug) {
        console.log("Number of iterations: ", this.result.length);
        console.log("Time: " + (t2 - t1) + "ms");
    }

    // just fail if full row already executed.
    if (this.tracing)
      {
        this.breakpoint_ast_lineno = this.modelregels_ast[this.breakpoint_at_line].lineNo;
        this.breakpoint_at_line += 1;

        if (this.breakpoint_at_line > this.modelregels_ast.length - 1)  {
          if (this.debug) console.log('end of row. Trace finished!');
          this.tracing = false;
          this.breakpoint_at_line = undefined;
      }
    }
};

function parse_or_throw(code, ast_name) {
    // parse code. Translate parser errors into something a student can read.
    try {
        return parser.parse(code, ast_name);
    } catch(err) {
        var blame = blame_line(err, code);
        var line = blame.line;
        err.parser_message = err.message; // original (jison) message
        if (/^\s*$/.test(code.replace(/('|\/\/|#)[^\n]*/g, ''))) {
            err.empty = true;
            err.message = "Hier staat nog niets. Typ eerst de " + ast_name + ".";
            line = undefined;
        } else {
            err.message = translate_parse_error(err, blame.previous);
        }
        throw_custom_error(err, ast_name, line);
    }
}

function blame_line(err, code) {
    // Find the line with the mistake.
    // The parser reports the line of the first token that it cannot use.
    // If a line is not finished ("x = 3 +") that is the *next* line.
    // returns {line: (1-based) , previous: true if line before the parser error}
    var hash = err.hash || {};
    if (typeof hash.line != 'number') return {line: undefined, previous: false};

    var lines = code.split('\n');
    var line = hash.line + 1;
    var expected = hash.expected || [];
    // (hash.loc is the location of the previous token: look at the text)
    var line_text = (lines[line - 1] !== undefined) ? lines[line - 1].replace(/^\s+/, '') : '';
    var text = String(hash.text || '');

    // parser expects a new statement: the previous lines are fine.
    var new_statement = expected.indexOf("'IF'") != -1;
    var first_on_line = !new_statement && text.length > 0 &&
                        line_text.slice(0, text.length) == text;
    // x = 3 +
    // y = 2      <-- error at second '='
    var assign_on_next_line = (hash.token == 'ASSIGN') && /^[^\s=:]+\s*:?=/.test(line_text);

    function skip_blank_lines(i) {
        // go up to the first line (1-based) that is not empty or comment
        while (i > 1 && /^\s*(('|\/\/|#).*)?$/.test(lines[i - 1])) i--;
        return i;
    }

    if (hash.token == 'EOF') {
        return {line: skip_blank_lines(Math.min(line, lines.length)), previous: false};
    }
    if (line > 1 && (first_on_line || assign_on_next_line)) {
        return {line: skip_blank_lines(line - 1), previous: true};
    }
    return {line: line, previous: false};
}

function translate_parse_error(err, previous_line) {
    // jison error --> dutch message
    var hash = err.hash || {};
    var expected = hash.expected || [];
    var token = hash.token;
    var text = hash.text;
    var lines = String(err.parser_message || err.message).split('\n');

    function expects(name) {
        return expected.indexOf("'" + name + "'") != -1;
    }

    if (/^Lexical error/.test(lines[0])) {
        // lines[1] is the code, lines[2] is -----^ pointing to the character
        var ch = (lines.length > 2) ? lines[1].charAt(lines[2].length - 1) : '';
        return "Onbekend teken" + (ch ? " '" + ch + "'" : "") + ". Dit teken kan niet in een model gebruikt worden.";
    }
    if (token == 'EOF' && expects('ENDIF')) {
        return "Er ontbreekt een 'eindals'. Elke 'als ... dan' moet worden afgesloten met 'eindals'.";
    }
    if (expects('THEN')) {
        if (token == 'ASSIGN') {
            return "Onverwachte '='. Gebruik in een voorwaarde '==' om te vergelijken, bijvoorbeeld: als (x == 3) en (y > 2) dan";
        }
        if (token == 'EOF' || token == 'IDENT' || token == 'IF' || token == 'STOP' || token == 'ENDIF') {
            return "Na de voorwaarde van 'als' ontbreekt 'dan'. Schrijf: als ... dan ... eindals";
        }
    }
    if (previous_line) {
        // the mistake is in the line before the unexpected token
        if (expects('ASSIGN') && expected.length == 1) {
            return "Deze regel is niet af. Een modelregel ziet er zo uit: v = v + a*dt";
        }
        if (expects(')') && !expects('NUMBER')) {
            return "Deze regel is niet af. Ontbreekt er een haakje sluiten ')'?";
        }
        return "Deze regel is niet af. Er ontbreekt iets aan het einde van de regel.";
    }
    if (token == 'ASSIGN' && expects(')')) {
        return "Onverwachte '='. Gebruik '==' om te vergelijken, bijvoorbeeld: als (x == 3) en (y > 2) dan";
    }
    if (token == 'EOF' && expects(')')) {
        return "Er ontbreekt een haakje sluiten ')'.";
    }
    if (token == ')') {
        return "Er staat een haakje ')' te veel, of er ontbreekt een haakje openen '('.";
    }
    if (token == 'EOF') {
        return "De laatste regel is niet af. Er ontbreekt iets aan het einde.";
    }
    if (token == 'ENDIF' || token == 'ELSE' || token == 'THEN') {
        if (expects('NUMBER')) {
            return "Onverwacht '" + text + "'. De regel hiervoor is niet af.";
        }
        return "Onverwacht '" + text + "'. Hier hoort geen '" + text + "'. Ontbreekt er een 'als' of 'dan'?";
    }
    if (token == 'ASSIGN') {
        return "Onverwachte '='. Is de regel hiervoor wel af? Links van '=' moet precies \u00e9\u00e9n variabele staan, bijvoorbeeld: v = v + a*dt";
    }
    if (expects('ASSIGN') && expected.length == 1) {
        return "Na de variabele wordt een '=' verwacht, maar er staat '" + text + "'. Een modelregel ziet er zo uit: v = v + a*dt";
    }
    if (token == 'NUMBER' || token == 'IDENT' || token == '(') {
        if (!expects('NUMBER')) {
            return "Onverwacht '" + text + "'. Ontbreekt er een bewerking ( + - * / ) of staat hier iets te veel?";
        }
    }
    if (expects('NUMBER')) {
        return "Onverwacht '" + text + "'. Hier wordt een getal of variabele verwacht.";
    }
    return "Onverwacht '" + text + "'. Deze regel klopt niet.";
}

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
