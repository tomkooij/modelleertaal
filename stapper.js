/*
    stapper.js

    Stap voor stap: voer een model regel voor regel uit en laat de berekening
    zien met ingevulde getallen. Zo wordt de rekenlus van een numeriek model
    zichtbaar.

      iteratie 3, regel 6:  v = v + a*dt  ->  v = 0,981 + 9,78 × 0,1 = 1,959

    No DOM. The expressions are computed with the code generator of
    evaluator.js, so the results are the same as those of a Run.

    usage:
      var stapper = require('./stapper.js');
      var s = new stapper.Stepper(startwaarden_ast, modelregels_ast, varNames, {N: 100});
      var step = s.step();   // {iteration, line, text, name, ...}
      s.rows                 // table: [startwaarden, iteration 1, ...] (columns: varNames)

      stapper.expr_text(node)                 --> 'v + a*dt'
      stapper.substitute(node, values, fmt)   --> '0,981 + 9,78 × 0,1'
*/

//jshint node:true
//jshint es3:true
//jshint evil:true
"use strict";

var evaluator_js = require('./evaluator.js');

// precedence of operators (higher binds stronger). See modelleertaal.jison.
var PREC = {
    'LIST': 1, '||': 2, '&&': 3, 'NOT': 4,
    '==': 5, '<': 5, '<=': 5, '>': 5, '>=': 5,
    '+': 6, '-': 6, '*': 7, '/': 7, 'UMINUS': 8, '^': 9,
    'ATOM': 10
};

var PI_TEXT = "3.14159265359";   // value of pi in the AST


function format_default(x) {
    // number as text, Dutch notation: 0,981
    if (typeof x == 'boolean') return x ? 'waar' : 'onwaar';
    if (typeof x != 'number' || isNaN(x)) return '?';
    if (!isFinite(x)) return x > 0 ? '∞' : '-∞';
    return String(Number(x.toPrecision(4))).replace('.', ',');
}


function render(node, values, format) {
    // expression as text: {text, prec}
    // values === undefined: with the names of the variables (v + a*dt)
    // else: with the values filled in (0,981 + 9,78 × 0,1)
    var fill = (values !== undefined);
    var left, right, op, prec;

    function wrap(child, min_prec) {
        // parentheses around child if it binds weaker than min_prec
        return (child.prec < min_prec) ? '(' + child.text + ')' : child.text;
    }

    switch (node.type) {
        case 'Number':
            if (node.value == PI_TEXT) {
                return fill ? {text: format(Math.PI), prec: PREC.ATOM} : {text: 'pi', prec: PREC.ATOM};
            }
            return {text: String(node.value), prec: PREC.ATOM};
        case 'Boolean':
            return {text: (node.value == 'true') ? 'waar' : 'onwaar', prec: PREC.ATOM};
        case 'Variable':
            if (!fill) return {text: node.name, prec: PREC.ATOM};
            var value = values[node.name];
            var text = format(value);
            // a negative number is put in parentheses: 0 + (-9,81) × 0,1
            return {text: text, prec: (typeof value == 'number' && value < 0) ? 0 : PREC.ATOM};
        case 'Function':
            return {text: node.func + '(' + render(node.expr, values, format).text + ')', prec: PREC.ATOM};
        case 'List':
            left = render(node.left, values, format);
            right = render(node.right, values, format);
            return {text: wrap(left, PREC.LIST) + '; ' + wrap(right, PREC.LIST + 1), prec: PREC.LIST};
        case 'Unary':
            right = render(node.right, values, format);
            if (node.operator == 'NOT') {
                return {text: 'niet ' + wrap(right, PREC.NOT), prec: PREC.NOT};
            }
            return {text: node.operator + wrap(right, PREC.UMINUS + 1), prec: PREC.UMINUS};
        case 'Binary':
        case 'Logical':
            prec = PREC[node.operator];
            left = render(node.left, values, format);
            right = render(node.right, values, format);
            op = node.operator;
            if (op == '&&') op = ' en ';
            else if (op == '||') op = ' of ';
            else if (op == '*') op = fill ? ' × ' : '*';
            else if (op == '/') op = fill ? ' / ' : '/';
            else if (op == '^') op = '^';
            else op = ' ' + op + ' ';
            // operators are left associative: a - (b - c) keeps its parentheses
            return {text: wrap(left, prec) + op + wrap(right, prec + 1), prec: prec};
        default:
            return {text: '...', prec: PREC.ATOM};
    }
}


function expr_text(node) {
    // expression with the names of the variables: 'v + a*dt'
    return render(node).text;
}


function substitute(node, values, format) {
    // expression with the values filled in: '0,981 + 9,78 × 0,1'
    // values: {name: value}. format (optional): number --> text
    return render(node, values, format || format_default).text;
}


function statement_text(stmt) {
    // statement as one line of text (whitespace and comments do not matter)
    switch (stmt.type) {
        case 'Assignment': return stmt.left + ' = ' + expr_text(stmt.right);
        case 'If': return 'als ' + expr_text(stmt.cond) + ' dan ' + program_text(stmt.then, ' ') + ' eindals';
        case 'IfElse': return 'als ' + expr_text(stmt.cond) + ' dan ' + program_text(stmt.then, ' ') +
                              ' anders ' + program_text(stmt.elsestmt, ' ') + ' eindals';
        case 'Stop': return 'stop';
        case 'Print': return 'print(' + stmt.varname + ')';
        default: return '...';
    }
}


function program_text(ast, separator) {
    // all statements as text: equal for two models that differ only in layout and comments
    return (ast || []).map(statement_text).join(separator === undefined ? '\n' : separator);
}


function first_line(stmt) {
    // line number of the first line of a statement (als ... : the line with 'als')
    if ((stmt.type == 'If' || stmt.type == 'IfElse') && stmt.cond) return stmt.cond.lineNo;
    return stmt.lineNo;
}


function lines_text(stmts) {
    // 'regel 9' or 'regels 9 t/m 11'
    if (!stmts || stmts.length === 0) return 'geen regels';
    var from = first_line(stmts[0]);
    var to = stmts[stmts.length - 1].lineNo;
    if (from === undefined || to === undefined) return 'de regels';
    return (from == to) ? 'regel ' + from : 'regels ' + from + ' t/m ' + to;
}


//
// Compile an expression with the code generator of evaluator.js.
// The variables are read from an object V: V["v"] instead of var_v.
//
function ValuesNamespace() {}

ValuesNamespace.prototype.createVar = function(name) {
    return 'V[' + JSON.stringify(name) + ']';
};
ValuesNamespace.prototype.referenceVar = function(node) {
    return 'V[' + JSON.stringify(node.name) + ']';
};

var codegenerator = new evaluator_js.CodeGenerator(new ValuesNamespace());

function evaluate(node, values) {
    var code = codegenerator.parseNode(node);
    return (new Function('V', 'return (' + code + ');'))(values);
}


//
// Stepper
//
function Stepper(startwaarden_ast, modelregels_ast, varNames, options) {
    // varNames: columns of the table (evaluator.namespace.varNames after a run)
    options = options || {};
    this.modelregels_ast = modelregels_ast;
    this.varNames = varNames;
    this.N = options.N || Infinity;     // stop after N iterations
    this.format = options.format || format_default;

    this.values = {};
    var i;
    for (i = 0; i < varNames.length; i++) this.values[varNames[i]] = NaN;
    // startwaarden: all at once
    this.run_statements(startwaarden_ast);

    this.iteration = 0;
    this.rows = [this.current_row()];
    this.stack = [];          // statements still to do in this iteration: [{stmts, index}]
    this.finished = false;    // after 'stop', 'print' or N iterations
    this.stopped = false;     // stopped by 'stop' or 'print'
}


Stepper.prototype.run_statements = function(stmts) {
    // execute statements without stepping (startwaarden)
    for (var i = 0; i < stmts.length; i++) {
        var stmt = stmts[i];
        if (stmt.type == 'Assignment') {
            this.values[stmt.left] = evaluate(stmt.right, this.values);
        } else if (stmt.type == 'If' || stmt.type == 'IfElse') {
            if (evaluate(stmt.cond, this.values)) this.run_statements(stmt.then);
            else if (stmt.elsestmt) this.run_statements(stmt.elsestmt);
        }
    }
};


Stepper.prototype.current_row = function() {
    var self = this;
    return this.varNames.map(function(name) { return self.values[name]; });
};


Stepper.prototype.in_iteration = function() {
    // is an iteration started and not yet finished?
    return this.stack.length > 0;
};


Stepper.prototype.table = function() {
    // rows for the table: finished iterations and the iteration that is busy
    if (this.in_iteration()) return this.rows.concat([this.current_row()]);
    return this.rows;
};


Stepper.prototype.step = function() {
    // execute one statement. Returns a description of what happened:
    //   {iteration, line, kind: 'assign'|'cond'|'stop'|'print', text, name,
    //    end_of_iteration, finished}
    // returns null if there is nothing left to do.
    if (this.finished) return null;

    if (!this.in_iteration()) {
        this.iteration += 1;
        this.stack.push({stmts: this.modelregels_ast, index: 0});
    }

    var frame = this.stack[this.stack.length - 1];
    var stmt = frame.stmts[frame.index];
    frame.index += 1;
    var step = {iteration: this.iteration, line: stmt.lineNo, name: undefined};
    var fmt = this.format;
    var detail;

    switch (stmt.type) {
        case 'Assignment':
            var before = {};
            for (var key in this.values) before[key] = this.values[key];
            var value = evaluate(stmt.right, this.values);
            this.values[stmt.left] = value;
            step.kind = 'assign';
            step.name = stmt.left;
            step.value = value;
            if (stmt.right.type == 'Number' || stmt.right.type == 'Boolean') {
                // Opp = 42,6: nothing to compute
                detail = stmt.left + ' = ' + expr_text(stmt.right);
            } else if (stmt.right.type == 'Variable') {
                detail = stmt.left + ' = ' + expr_text(stmt.right) + '  →  ' + stmt.left + ' = ' + fmt(value);
            } else {
                detail = stmt.left + ' = ' + expr_text(stmt.right) + '  →  ' +
                         stmt.left + ' = ' + substitute(stmt.right, before, fmt) + ' = ' + fmt(value);
            }
            break;
        case 'If':
        case 'IfElse':
            var cond = Boolean(evaluate(stmt.cond, this.values));
            step.kind = 'cond';
            step.line = first_line(stmt);
            step.value = cond;
            detail = 'als ' + expr_text(stmt.cond) + '  →  ' +
                     substitute(stmt.cond, this.values, fmt) + ' is ' + (cond ? 'waar' : 'onwaar') + ': ';
            if (cond) {
                detail += lines_text(stmt.then) + (stmt.then.length > 1 ? ' worden' : ' wordt') + ' uitgevoerd';
                this.stack.push({stmts: stmt.then, index: 0});
            } else if (stmt.elsestmt) {
                detail += lines_text(stmt.elsestmt) + ' (anders)' + (stmt.elsestmt.length > 1 ? ' worden' : ' wordt') +
                          ' uitgevoerd';
                this.stack.push({stmts: stmt.elsestmt, index: 0});
            } else {
                detail += lines_text(stmt.then) + (stmt.then.length > 1 ? ' worden' : ' wordt') + ' overgeslagen';
            }
            break;
        case 'Stop':
            step.kind = 'stop';
            detail = "stop: het model stopt hier";
            this.stopped = true;
            break;
        case 'Print':
            step.kind = 'print';
            step.name = stmt.varname;
            detail = 'print(' + stmt.varname + '): ' + stmt.varname + ' = ' + fmt(this.values[stmt.varname]) +
                     ', het model stopt hier';
            this.stopped = true;
            break;
        default:
            detail = '...';
    }

    // remove the lists of statements that are done (end of als ... eindals, end of iteration)
    while (this.stack.length > 0 && this.stack[this.stack.length - 1].index >= this.stack[this.stack.length - 1].stmts.length) {
        this.stack.pop();
    }
    if (this.stopped) {
        // 'stop' ends the iteration (the row with the values is kept, like in a Run)
        this.stack = [];
    }

    step.end_of_iteration = !this.in_iteration();
    if (step.end_of_iteration) {
        this.rows.push(this.current_row());
        if (this.stopped || this.iteration >= this.N) this.finished = true;
    }
    step.finished = this.finished;
    step.text = 'iteratie ' + step.iteration + ', regel ' + step.line + ':  ' + detail;
    return step;
};


exports.Stepper = Stepper;
exports.expr_text = expr_text;
exports.substitute = substitute;
exports.statement_text = statement_text;
exports.program_text = program_text;
exports.format_default = format_default;
