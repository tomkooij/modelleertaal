/*
    grafisch-edit.js

    Het grafische model (grafisch.js) als invoer: een bewerking in het diagram
    wordt uitgevoerd als een kleine wijziging in de tekst van het model.
    De rest van de tekst (volgorde, commentaar, opmaak) blijft staan.

    usage:
      var edit = require('./grafisch-edit.js');
      var model = {startwaarden: 'x = 0 ...', modelregels: 'x = x + v*dt ...'};
      model = edit.apply(model, {op: 'setDefinition', id: 'Fw', text: 'k * v^2'});

    Een bewerking die niet veilig automatisch kan (bijvoorbeeld een regel binnen
    als ... dan) geeft een Error met een uitleg voor de gebruiker.

    Bewerkingen (id: zie grafisch.analyse().elements):
      {op: 'setDefinition', id, text}            formule / waarde / beginwaarde
      {op: 'rename', id, name}                   overal in het model
      {op: 'addConstant', name, text}            name = text in de startwaarden
      {op: 'addAux', name, text}                 name = text in de modelregels
      {op: 'addStock', name, initial, rate}      x = 0 ; dx = rate * dt ; x = x + dx
      {op: 'addFlow', stock, direction, name, rate}   direction: 'in' of 'out'
      {op: 'setFlowEnds', id, from, to}          stroom van/naar toestand (null: buiten)
      {op: 'define', id, kind, text}             onbekende (?) variabele: 'const' of 'aux'
      {op: 'define', id, kind: 'stock', initial, rate}   onbekende wordt toestandsvariabele

    addConstant, addAux en addStock met de naam van een onbekende (?) variabele
    definiëren die variabele (zoals define).
      {op: 'convert', id, kind}                  constante <-> hulpvariabele ('aux' of 'const')
      {op: 'setDt', text}                        startwaarde van dt
      {op: 'setUnit', name, unit}                eenheid als commentaar: m = 25 '[kg] (unit '': weg)

    Met timeUnit in een bewerking (bijvoorbeeld 's') krijgen t en dt die eenheid als de
    bewerking ze maakt: t = 0 '[s]
      {op: 'remove', id}                         ook een voorval of stopvoorwaarde (het hele als-blok)

    Voorwaarden (als ... dan ... eindals, zoals in de examenmodellen):
      {op: 'addEvent', condition, target, text}  als condition dan target = text eindals,
                                                 na de laatste regel die target uitrekent
      {op: 'addEvent', condition, stop: true}    als condition dan stop eindals, aan het eind
      {op: 'setEvent', id, condition, text}      voorwaarde en/of nieuwe waarde van een voorval
                                                 of stopvoorwaarde (id: ~e1, ~s1)
      {op: 'setLimit', name, bound, text}        bound 'max': als x > text dan x = text eindals,
                                                 'min': als x < text dan x = text eindals; text '': weg

    Verder:
      edit.variablesOf(text)    de variabelen in een formule (Error als het geen formule is)
      edit.dtOf(model)          {name, text}: de tijdstap en zijn startwaarde (text: null als die er niet is)
      edit.eventOf(model, id)   {condition, target, text} van een voorval of stopvoorwaarde, als code;
                                null als het niet via het diagram kan (meer regels, als binnen als)
      edit.limitsOf(model, name)  {max, min}: de grenzen van een toestandsvariabele ('' als er geen is)
*/

//jshint node:true
//jshint es3:true
//jshint loopfunc:true
"use strict";

var parser = require('./modelleertaal').parser;
var grafisch = require('./grafisch.js');

var IDENT = '[a-zA-Z\\x7f-\\uffff][a-zA-Z\\x7f-\\u00b1\\u00b4-\\uffff0-9_\\]|{}\\[]*';
var IDENT_RE = new RegExp('^' + IDENT + '$');
var ASSIGN_RE = new RegExp('^(\\s*)(' + IDENT + ')(\\s*)(:=|=)(?!=)\\s*(.*?)\\s*$');

var MANUAL = ' Pas dit aan in de tekst van het model.';


// ------------------------------------------------------------------ text helpers

function parse(text, name) {
    if (/^\s*$/.test(text.replace(/('|\/\/|#)[^\n]*/g, ''))) return [];
    return parser.parse(text, name);
}

function splitComment(line) {
    // 'x = 1  // begin' --> {code: 'x = 1', comment: '  // begin'}
    var m = /\s*('|\/\/|#).*$/.exec(line);
    return m ? {code: line.substr(0, m.index), comment: m[0]} : {code: line, comment: ''};
}

function tokens(codeText) {
    return codeText.match(new RegExp(IDENT, 'g')) || [];
}

function uses(line, name) {
    return tokens(splitComment(line).code).indexOf(name) != -1;
}

function depths(lines) {
    // depth[i]: number of open 'als' at the start of line i
    var depth = [], d = 0;
    for (var i = 0; i < lines.length; i++) {
        depth.push(d);
        var words = tokens(splitComment(lines[i]).code);
        for (var j = 0; j < words.length; j++) {
            var w = words[j].toLowerCase();
            if (w == 'als') d += 1;
            if (w == 'eindals') d -= 1;
        }
    }
    return depth;
}

function exprOf(text) {
    // AST of an expression typed by the user. Throws if it is not one expression.
    var ast;
    try {
        ast = parse('zz = ' + text, 'formule');
    } catch (err) {
        ast = null;
    }
    if (!ast || ast.length != 1 || ast[0].type != 'Assignment' || /^\s*$/.test(text)) {
        throw new Error('De formule "' + text + '" klopt niet.');
    }
    return ast[0].right;
}

function findLine(lines, name, exprCode, topLevel) {
    // index of the line 'name = expr' (and nothing else on that line), or -1
    var depth = depths(lines);
    for (var i = 0; i < lines.length; i++) {
        if (topLevel && depth[i] !== 0) continue;
        var m = ASSIGN_RE.exec(splitComment(lines[i]).code);
        if (!m || m[2] != name) continue;
        var e;
        try { e = exprOf(m[5]); } catch (err) { continue; }
        if (exprCode === undefined || grafisch.code(e) == exprCode) return i;
    }
    return -1;
}

function setRhs(lines, i, text) {
    var parts = splitComment(lines[i]);
    var m = ASSIGN_RE.exec(parts.code);
    lines[i] = m[1] + m[2] + m[3] + m[4] + ' ' + text + parts.comment;
}

function indentOf(lines, i) {
    for (var j = Math.min(i, lines.length - 1); j >= 0; j--) {
        if (!/^\s*$/.test(lines[j])) return /^\s*/.exec(lines[j])[0];
    }
    return '';
}

function endOf(lines) {
    // index after the last line with text
    var i = lines.length;
    while (i > 0 && /^\s*$/.test(lines[i - 1])) i--;
    return i;
}

function insert(lines, i, text) {
    // insert a line before line i, outside als ... eindals
    var depth = depths(lines);
    while (i > 0 && i < lines.length && depth[i] > 0) i--;
    lines.splice(i, 0, indentOf(lines, i) + text);
    return i;
}


// ------------------------------------------------------------------ context

function Context(model) {
    var split = function(text) {
        text = String(text || '').replace(/\r/g, '');
        return /^\s*$/.test(text) ? [] : text.split('\n');
    };
    this.start = split(model.startwaarden);
    this.regels = split(model.modelregels);
    this.analyse();
}

Context.prototype.text = function() {
    return {startwaarden: this.start.join('\n'), modelregels: this.regels.join('\n')};
};

Context.prototype.analyse = function() {
    // (again) after a change of the text
    var t = this.text();
    var startAst = parse(t.startwaarden, 'startwaarden');
    var regelsAst = parse(t.modelregels, 'modelregels');
    this.g = grafisch.analyse(startAst, regelsAst);
    this.init = {};
    this.assigned = {};
    var i, a;
    var s = grafisch.collect(startAst, [], {assign: [], stops: []});
    for (i = 0; i < s.assign.length; i++) this.init[s.assign[i].name] = s.assign[i].expr;
    var r = grafisch.collect(regelsAst, [], {assign: [], stops: []});
    for (i = 0; i < r.assign.length; i++) {
        a = r.assign[i];
        (this.assigned[a.name] = this.assigned[a.name] || []).push(a);
    }
};

Context.prototype.element = function(id) {
    if (!this.g.elements.hasOwnProperty(id)) throw new Error('Onbekend element: ' + id);
    return this.g.elements[id];
};

Context.prototype.exists = function(name) {
    return this.init.hasOwnProperty(name) || this.assigned.hasOwnProperty(name) ||
        this.g.elements.hasOwnProperty(name) || name == this.g.dt || name == this.g.time;
};

Context.prototype.isUnknown = function(name) {
    // used, but nowhere a value or formula: the '?' in the diagram
    var el = this.g.elements.hasOwnProperty(name) ? this.g.elements[name] : null;
    return !!el && el.kind == 'unknown' && !this.init.hasOwnProperty(name) && !this.assigned.hasOwnProperty(name);
};

Context.prototype.checkNewName = function(name, allowUnknown) {
    // allowUnknown: the name of an unknown (?) variable is fine, it gets defined
    name = String(name || '').replace(/^\s+|\s+$/g, '');
    var ok = IDENT_RE.test(name);
    if (ok) {
        // keywords (als, dan, pi, en, of, ...) are not names
        try {
            var ast = parse(name + ' = 1', 'naam');
            ok = ast.length == 1 && ast[0].type == 'Assignment' && ast[0].left == name;
        } catch (err) {
            ok = false;
        }
    }
    if (!ok) throw new Error('"' + name + '" is geen geldige naam voor een variabele.');
    if (this.exists(name) && !(allowUnknown && this.isUnknown(name))) {
        throw new Error('De naam "' + name + '" bestaat al.');
    }
    return name;
};

Context.prototype.freeName = function(base) {
    var name = base, n = 2;
    while (this.exists(name)) name = base + (n++);
    return name;
};

Context.prototype.startLine = function(name) {
    return this.init.hasOwnProperty(name) ? findLine(this.start, name, grafisch.code(this.init[name]), true) : -1;
};

Context.prototype.regelLine = function(name, which) {
    // line of the only unconditional assignment to name. which: 'self' = x = x + ... ; 'def' = other
    var list = this.assigned[name] || [], found = [];
    for (var i = 0; i < list.length; i++) {
        var self = grafisch.variables(list[i].expr).indexOf(name) != -1;
        if (list[i].conds.length === 0 && (which === undefined || (which == 'self') == self)) found.push(list[i]);
    }
    if (found.length != 1) return -1;
    return findLine(this.regels, name, grafisch.code(found[0].expr), true);
};

Context.prototype.need = function(line, name) {
    if (line == -1) {
        throw new Error('De regel voor ' + name + ' kan ik niet automatisch aanpassen ' +
            '(bijvoorbeeld omdat hij binnen als ... dan staat of er meer op één regel staat).' + MANUAL);
    }
    return line;
};

Context.prototype.timeLine = function() {
    return this.g.time ? this.regelLine(this.g.time, 'self') : -1;
};

Context.prototype.blocks = function() {
    // the als ... eindals blocks at the top level of the modelregels: [{start, end, stmt}]
    // (end: the line of eindals). A block that is not one statement is left out.
    var depth = depths(this.regels), out = [], i, j, k;
    for (i = 0; i < this.regels.length; i++) {
        var words = tokens(splitComment(this.regels[i]).code);
        if (depth[i] !== 0 || !words.length || words[0].toLowerCase() != 'als') continue;
        for (j = i; j + 1 < this.regels.length && depth[j + 1] !== 0; j++) { /* to the eindals */ }
        var ast = null, stmts = [];
        try {
            ast = parse(this.regels.slice(i, j + 1).join('\n'), 'als');
        } catch (err) {
            ast = null;
        }
        for (k = 0; ast && k < ast.length; k++) if (ast[k].type != 'Blank') stmts.push(ast[k]);
        if (stmts.length == 1 && (stmts[0].type == 'If' || stmts[0].type == 'IfElse')) {
            out.push({start: i, end: j, stmt: stmts[0]});
        }
        i = j;
    }
    return out;
};

Context.prototype.eventBlock = function(el) {
    // the block of a voorval (one condition, only name = ... for its targets) or a stopvoorwaarde
    var list = this.blocks();
    for (var i = 0; i < list.length; i++) {
        var st = list[i].stmt, body = [], k;
        if (st.type != 'If' || grafisch.fmt(st.cond) != el.condition) continue;
        for (k = 0; k < st.then.length; k++) if (st.then[k].type != 'Blank') body.push(st.then[k]);
        if (el.kind == 'stop' && body.length == 1 && body[0].type == 'Stop') return list[i];
        if (el.kind != 'event' || body.length != el.actions.length) continue;
        var ok = true;
        for (k = 0; k < body.length; k++) {
            if (body[k].type != 'Assignment' || el.targets.indexOf(body[k].left) == -1) ok = false;
        }
        if (ok) return list[i];
    }
    return null;
};

Context.prototype.afterLast = function(name) {
    // where a voorval for name goes: after the last line that calculates name (after the end
    // of its als-block). A toestandsvariabele or constante: also after the other toestandsvariabelen,
    // just before t = t + dt (als h < 0 dan v = -v after h = h + v*dt, as in the exam models).
    // A hulpvariabele (also one drawn as the valve of a flow, groei in dOpp = groei * dt): right
    // after its formula, before it is used.
    var depth = depths(this.regels), at = -1, i, t = this.timeLine();
    if (!this.isFormula(name) && t != -1) {
        for (i = t; i < this.regels.length; i++) {
            var m2 = ASSIGN_RE.exec(splitComment(this.regels[i]).code);
            if (m2 && m2[2] == name && i != t) t = -1;   // name is calculated after t = t + dt
        }
        if (t != -1) return t;
    }
    for (i = 0; i < this.regels.length; i++) {
        var m = ASSIGN_RE.exec(splitComment(this.regels[i]).code);
        if (m && m[2] == name && i != this.timeLine()) at = i;
    }
    if (at == -1) {
        t = this.timeLine();
        return t != -1 ? t : endOf(this.regels);
    }
    while (at + 1 < this.regels.length && depth[at + 1] > 0) at++;
    return at + 1;
};

Context.prototype.startEnd = function() {
    // where a new startwaarde goes: at the end, but above t = 0 and dt = 0,1 when those are
    // the last lines (as in the basismodellen)
    var end = endOf(this.start), names = [this.g.time, this.g.dt];
    while (end > 0) {
        var m = ASSIGN_RE.exec(splitComment(this.start[end - 1]).code);
        if (!m || names.indexOf(m[2]) == -1) break;
        end--;
    }
    return end;
};

Context.prototype.decimal = function(value) {
    // 0.1 in the style of the model: 0,1 (default) or 0.1
    var t = this.start.join('\n') + this.regels.join('\n');
    var point = /\d\.\d/.test(t) && !/\d,\d/.test(t);
    return point ? value : value.replace('.', ',');
};

Context.prototype.needTime = function() {
    // new model: t = t + dt
    var dt = this.g.dt;
    var unit = this.timeUnit ? " '[" + this.timeUnit + "]" : '';
    if (!this.g.time) {
        var t = this.freeName('t');
        this.start.splice(endOf(this.start), 0, t + ' = 0' + unit);
        this.regels.splice(endOf(this.regels), 0, t + ' = ' + t + ' + ' + dt);
    }
    if (!this.init.hasOwnProperty(dt)) this.start.splice(endOf(this.start), 0, dt + ' = ' + this.decimal('0.1') + unit);
    this.analyse();
};

Context.prototype.flowsOf = function(stock) {
    // [{id, sign, term}] of a stock (or constant: none)
    var el = this.element(stock), out = [], i;
    if (el.kind != 'stock') return out;
    for (i = 0; i < el.inflows.length; i++) out.push({id: el.inflows[i], sign: 1, term: this.g.elements[el.inflows[i]].term});
    for (i = 0; i < el.outflows.length; i++) out.push({id: el.outflows[i], sign: -1, term: this.g.elements[el.outflows[i]].term});
    return out;
};

Context.prototype.checkStock = function(stock) {
    var el = this.element(stock);
    if (el.kind == 'const') return el;
    if (el.kind != 'stock') throw new Error(stock + ' is geen toestandsvariabele of constante.');
    if (el.general || el.updates > 1) {
        throw new Error('De regel voor ' + stock + ' heeft niet de vorm ' + stock + ' = ' + stock + ' + ...' + MANUAL);
    }
    return el;
};

Context.prototype.stockPlace = function(name) {
    // where the new line  name = name + ...  goes: before the first flow or stock that uses name
    // (x = x + v * dt after v = v + dv, as in the basismodellen), else before t = t + dt
    var t = this.timeLine();
    for (var i = 0; name !== null && i < this.regels.length; i++) {
        var m = ASSIGN_RE.exec(splitComment(this.regels[i]).code);
        var el = m && this.g.elements.hasOwnProperty(m[2]) ? this.g.elements[m[2]] : null;
        if (el && !el.isRate && (el.kind == 'flow' || el.kind == 'stock') && uses(this.regels[i], name)) return i;
    }
    return t != -1 ? t : endOf(this.regels);
};

Context.prototype.writeStock = function(stock, terms, at) {
    // (re)write  stock = stock + in - out. No terms: remove the line (stock becomes a constant).
    // at: where a new line goes (default: before t = t + dt)
    this.checkStock(stock);
    var line = this.regelLine(stock, 'self');
    if ((this.assigned[stock] || []).length && line == -1) this.need(-1, stock);
    var rhs = stock;
    for (var i = 0; i < terms.length; i++) rhs += (terms[i].sign > 0 ? ' + ' : ' - ') + terms[i].term;
    if (line == -1) {
        if (!terms.length) return -1;
        line = insert(this.regels, at === undefined ? this.stockPlace(null) : at, stock + ' = ' + rhs);
    } else if (!terms.length) {
        this.regels.splice(line, 1);
        line = -1;
    } else {
        setRhs(this.regels, line, rhs);
    }
    return line;
};


// ------------------------------------------------------------------ operations

var ops = {};

ops.setDefinition = function(c, op) {
    var el = c.element(op.id), expr = exprOf(op.text), text = op.text.replace(/^\s+|\s+$/g, '');
    switch (el.kind) {
        case 'const':
            setRhs(c.start, c.need(c.startLine(el.name), el.name), text);
            break;
        case 'stock':
            if (!c.init.hasOwnProperty(el.name)) c.start.splice(c.startEnd(), 0, el.name + ' = ' + text);
            else setRhs(c.start, c.need(c.startLine(el.name), el.name), text);
            break;
        case 'aux':
            if (el.code === null) c.need(-1, el.name);
            setRhs(c.regels, c.need(c.regelLine(el.name), el.name), text);
            break;
        case 'flow':
            if (el.name) {
                setRhs(c.regels, c.need(c.regelLine(el.name, 'def'), el.name), text);
            } else {
                // term in the line of the stock:  x = x + v * dt
                var stock = el.to || el.from, terms = c.flowsOf(stock);
                for (var i = 0; i < terms.length; i++) {
                    if (terms[i].id == el.id) terms[i].term = grafisch.code(expr, 4, true);
                }
                c.writeStock(stock, terms);
            }
            break;
        default:
            throw new Error('Dit element heeft geen formule die je hier kunt aanpassen.' + MANUAL);
    }
};

function nameFlow(c, el, name) {
    // x = x + v * dt  -->  dx = v * dt ; x = x + dx
    var stock = el.to || el.from, terms = c.flowsOf(stock);
    var line = c.need(c.regelLine(stock, 'self'), stock);
    for (var i = 0; i < terms.length; i++) if (terms[i].id == el.id) terms[i].term = name;
    c.writeStock(stock, terms);
    insert(c.regels, line, name + ' = ' + el.code);
}

ops.rename = function(c, op) {
    var el = c.element(op.id), name = c.checkNewName(op.name);
    if (el.kind == 'flow' && !el.name) return nameFlow(c, el, name);
    if (!el.name) throw new Error('Dit element heeft geen naam.');
    var re = new RegExp(IDENT, 'g');
    var replace = function(lines) {
        for (var i = 0; i < lines.length; i++) {
            var parts = splitComment(lines[i]);
            lines[i] = parts.code.replace(re, function(word) { return word == el.name ? name : word; }) + parts.comment;
        }
    };
    replace(c.start);
    replace(c.regels);
};

function addStart(c, name, text) {
    // name = text in the startwaarden: after the startwaarden it needs, before the first
    // startwaarde that uses it. A value that needs a variable without startwaarde: at the end.
    var expr = exprOf(text), deps = grafisch.variables(expr), i, lo = 0, end = endOf(c.start), at = -1;
    for (i = 0; i < deps.length && lo != -1; i++) {
        if (deps[i] == name) continue;
        var l = c.startLine(deps[i]);
        lo = l == -1 ? -1 : Math.max(lo, l + 1);
    }
    if (lo != -1) {
        for (i = lo; i < end && at == -1; i++) if (uses(c.start[i], name)) at = i;
    }
    if (at == -1) at = lo == -1 ? end : Math.max(lo, c.startEnd());
    var line = name + ' = ' + text.replace(/^\s+|\s+$/g, '');
    if (at == end) c.start.splice(at, 0, indentOf(c.start, c.start.length) + line);
    else insert(c.start, at, line);
}

ops.addConstant = function(c, op) {
    addStart(c, c.checkNewName(op.name, true), op.text);
};

function addRule(c, name, text) {
    // name = text in the modelregels: before its first use, else after what it needs,
    // else before the flows and stocks
    var expr = exprOf(text), i, at = -1;
    for (i = 0; i < c.regels.length && at == -1; i++) if (uses(c.regels[i], name)) at = i;
    if (at == -1) {
        var deps = grafisch.variables(expr);
        for (i = 0; i < deps.length; i++) {
            var el = c.g.elements[deps[i]];
            if (el && (el.kind == 'aux' || el.kind == 'flow')) at = Math.max(at, findLine(c.regels, deps[i], undefined, true) + 1);
        }
        if (at <= 0) {
            at = endOf(c.regels);
            for (var id in c.g.elements) {
                if (!c.g.elements.hasOwnProperty(id)) continue;
                var k = c.g.elements[id].kind, name2 = c.g.elements[id].name;
                if ((k == 'stock' || k == 'flow') && name2) {
                    var l = findLine(c.regels, name2, undefined, true);
                    if (l != -1) at = Math.min(at, l);
                }
            }
            var t = c.timeLine();
            if (t != -1) at = Math.min(at, t);
        }
    }
    insert(c.regels, at, name + ' = ' + text.replace(/^\s+|\s+$/g, ''));
}

ops.addAux = function(c, op) {
    addRule(c, c.checkNewName(op.name, true), op.text);
};

ops.define = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'unknown') throw new Error(el.name + ' heeft al een waarde of formule.');
    if (op.kind == 'stock') return defineStock(c, el.name, op.initial, op.rate, op.flow);
    if (op.kind == 'aux') addRule(c, el.name, op.text);
    else addStart(c, el.name, op.text);
};

ops.convert = function(c, op) {
    // constante (startwaarden) <-> hulpvariabele (modelregels), same name and formula
    var el = c.element(op.id), line;
    if (op.kind == 'aux' && el.kind == 'const') {
        line = c.need(c.startLine(el.name), el.name);
        c.start.splice(line, 1);
        c.analyse();
        addRule(c, el.name, el.code);
    } else if (op.kind == 'const' && el.kind == 'aux') {
        if (el.code === null) c.need(-1, el.name);
        if (grafisch.variables(exprOf(el.code)).length) {
            throw new Error(el.name + ' = ' + el.code + ' hangt af van andere variabelen: dat kan geen constante zijn.');
        }
        line = c.need(c.regelLine(el.name), el.name);
        c.regels.splice(line, 1);
        c.analyse();
        addStart(c, el.name, el.code);
    } else {
        throw new Error('Dit element kan ik niet omzetten.' + MANUAL);
    }
};

ops.setDt = function(c, op) {
    var text = op.text.replace(/^\s+|\s+$/g, ''), dt = c.g.dt;
    exprOf(text);
    var line = c.startLine(dt);
    if (line == -1 && c.init.hasOwnProperty(dt)) c.need(-1, dt);
    if (line == -1) c.start.splice(endOf(c.start), 0, dt + ' = ' + text);
    else setRhs(c.start, line, text);
};

ops.setUnit = function(c, op) {
    // the unit in the comment of the line of name: in the startwaarden, else in the modelregels
    var unit = String(op.unit || '').replace(/^\s+|\s+$/g, ''), name = op.name;
    if (unit.length > 20 || /[\[\]\n]/.test(unit)) {
        throw new Error('"' + unit + '" is geen eenheid die ik kan opslaan (geen [ of ], hoogstens 20 tekens).');
    }
    var lines = c.start, line = c.startLine(name);
    if (line == -1 && !c.init.hasOwnProperty(name)) {
        lines = c.regels;
        line = c.regelLine(name, 'def');
        if (line == -1) line = c.regelLine(name);
    }
    c.need(line, name);
    var parts = splitComment(lines[line]), comment = parts.comment;
    var bracket = /\s*\[[^\[\]]*\]/;
    if (unit === '') {
        comment = comment.replace(bracket, '');
        if (/^\s*('|\/\/|#)\s*$/.test(comment)) comment = '';
    } else if (bracket.test(comment)) {
        comment = comment.replace(/\[[^\[\]]*\]/, '[' + unit + ']');
    } else if (comment) {
        // 'massa --> '[kg] massa ; // massa --> // [kg] massa
        comment = comment.replace(/^(\s*)('|\/\/|#)\s*/, function(all, space, mark) {
            return space + mark + (mark == "'" ? '' : ' ') + '[' + unit + '] ';
        });
    } else {
        comment = " '[" + unit + "]";
    }
    lines[line] = parts.code.replace(/\s+$/, '') + comment;
};

function flowName(c, name, stock, rate) {
    // the name of the flow of stock: given, or d + stock. It cannot be in its own formula:
    // dOpp = dOpp * dt would be a second toestandsvariabele
    var auto = /^\s*$/.test(name || '');
    name = auto ? c.freeName('d' + stock) : c.checkNewName(name);
    if (grafisch.variables(exprOf(rate)).indexOf(name) != -1) {
        throw new Error(auto ?
            name + ' is de naam van de stroom van ' + stock + '. Kies een andere naam voor de ' +
            'verandering per tijdseenheid, bijvoorbeeld groei.' :
            'De stroom ' + name + ' kan niet in zijn eigen formule staan (' + name + ' = ' + rate + ' * ' + c.g.dt + ').');
    }
    return name;
}

function flowLine(c, name, rate) {
    // dx = rate * dt
    return name + ' = ' + grafisch.code(exprOf(rate), 5, false) + ' * ' + c.g.dt;
}

function defineStock(c, name, initial, rate, flow) {
    // unknown variable becomes a stock: dv = rate * dt ; v = v + dv before the first use of v
    initial = /^\s*$/.test(initial || '') ? '0' : initial.replace(/^\s+|\s+$/g, '');
    rate = /^\s*$/.test(rate || '') ? '0' : rate;
    exprOf(rate);
    addStart(c, name, initial);
    c.analyse();
    var fname = flowName(c, flow, name, rate);
    c.needTime();
    var at = insert(c.regels, c.stockPlace(name), name + ' = ' + name + ' + ' + fname);
    insert(c.regels, at, flowLine(c, fname, rate));
}

ops.addStock = function(c, op) {
    var name = c.checkNewName(op.name, true);
    if (c.isUnknown(name)) return defineStock(c, name, op.initial, op.rate, op.flow);
    var initial = /^\s*$/.test(op.initial || '') ? '0' : op.initial.replace(/^\s+|\s+$/g, '');
    exprOf(initial);
    c.start.splice(c.startEnd(), 0, name + ' = ' + initial);
    c.analyse();
    ops.addFlow(c, {stock: name, direction: 'in', name: op.flow, rate: op.rate});
};

ops.addFlow = function(c, op) {
    var el = c.checkStock(op.stock);
    var rate = /^\s*$/.test(op.rate || '') ? '0' : op.rate;
    exprOf(rate);
    var name = flowName(c, op.name, op.stock, rate);
    c.needTime();
    var terms = c.flowsOf(op.stock);
    terms.push({sign: op.direction == 'out' ? -1 : 1, term: name});
    // a constant becomes a stock: its line goes where define would put it
    var line = c.writeStock(op.stock, terms, el.kind == 'const' ? c.stockPlace(op.stock) : undefined);
    insert(c.regels, line, flowLine(c, name, rate));
};

ops.setFlowEnds = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'flow' || op.id.indexOf('#') != -1) throw new Error('Deze stroom kan ik niet automatisch verleggen.' + MANUAL);
    var from = op.from || null, to = op.to || null;
    if (from === null && to === null) throw new Error('Een stroom zit aan minstens één toestandsvariabele vast.');
    if (from == to) throw new Error('Een stroom kan niet van en naar dezelfde toestandsvariabele lopen.');
    if (!el.name) {
        // first give it a name: the same variable is used in two lines
        var name = c.freeName('d' + (el.to || el.from));
        nameFlow(c, el, name);
        c.analyse();
        el = c.element(name);
    }
    var ends = [[el.from, from, -1], [el.to, to, 1]], i, j, lines = [];
    for (i = 0; i < ends.length; i++) {
        var old = ends[i][0], now = ends[i][1], sign = ends[i][2];
        if (old == now) continue;
        if (old !== null) {
            var keep = [], terms = c.flowsOf(old);
            for (j = 0; j < terms.length; j++) if (terms[j].id != el.id) keep.push(terms[j]);
            c.writeStock(old, keep);
            c.analyse();
        }
        if (now !== null) {
            var add = c.flowsOf(now);
            add.push({sign: sign, term: el.term});
            c.writeStock(now, add);
            c.analyse();
        }
    }
    // the flow is calculated before the stocks that use it
    var def = findLine(c.regels, el.name, undefined, true);
    if (from !== null) lines.push(c.regelLine(from, 'self'));
    if (to !== null) lines.push(c.regelLine(to, 'self'));
    for (i = 0; i < lines.length; i++) {
        if (def != -1 && lines[i] != -1 && lines[i] < def) {
            var text = c.regels.splice(def, 1)[0];
            c.regels.splice(lines[i], 0, text);
            def = lines[i];
        }
    }
};

function removeFlows(c, flows, goneStock) {
    // take the flows out of the lines of their stocks (goneStock: line already removed)
    var ids = [], stocks = [], i, j;
    for (i = 0; i < flows.length; i++) {
        ids.push(flows[i].id);
        var ends = [flows[i].from, flows[i].to];
        for (j = 0; j < 2; j++) {
            if (ends[j] !== null && ends[j] != goneStock && stocks.indexOf(ends[j]) == -1) stocks.push(ends[j]);
        }
    }
    for (i = 0; i < stocks.length; i++) {
        var terms = c.flowsOf(stocks[i]), keep = [];
        for (j = 0; j < terms.length; j++) if (ids.indexOf(terms[j].id) == -1) keep.push(terms[j]);
        c.writeStock(stocks[i], keep);
    }
    for (i = 0; i < flows.length; i++) {
        // dx = v * dt goes too, unless something else uses it or it still flows somewhere.
        // a = Fres / m (used as a * dt) stays as a hulpvariabele
        var flow = flows[i], used = false;
        if (flow.step) {
            // a is the flow of  dv = a * dt ; v = v + dv : dv goes, a stays as a hulpvariabele
            var sl = c.regelLine(flow.step, 'def');
            if (sl != -1) c.regels.splice(sl, 1);
            continue;
        }
        if (!flow.name || flow.isRate) continue;
        for (j = 0; j < c.g.links.length; j++) if (c.g.links[j].from == flow.id) used = true;
        var line = c.regelLine(flow.name, 'def');
        if (!used && line != -1) c.regels.splice(line, 1);
    }
}

ops.remove = function(c, op) {
    var el = c.element(op.id);
    switch (el.kind) {
        case 'const':
            c.start.splice(c.need(c.startLine(el.name), el.name), 1);
            break;
        case 'aux':
            if (el.code === null) c.need(-1, el.name);
            c.regels.splice(c.need(c.regelLine(el.name), el.name), 1);
            break;
        case 'flow':
            if (op.id.indexOf('#') != -1) c.need(-1, el.label);
            removeFlows(c, [el], null);
            break;
        case 'stock':
            c.checkStock(el.id);
            var flows = [], ids = el.inflows.concat(el.outflows);
            for (var i = 0; i < ids.length; i++) {
                // a flow to or from another stock stays (now to or from outside)
                var fl = c.g.elements[ids[i]];
                if ((fl.from === null || fl.from == el.id) && (fl.to === null || fl.to == el.id)) flows.push(fl);
            }
            c.regels.splice(c.need(c.regelLine(el.id, 'self'), el.id), 1);
            removeFlows(c, flows, el.id);
            var s = findLine(c.start, el.id, undefined, true);
            if (s != -1) c.start.splice(s, 1);
            break;
        case 'event':
        case 'stop':
            var block = c.eventBlock(el);
            if (!block) c.need(-1, el.label);
            c.regels.splice(block.start, block.end - block.start + 1);
            break;
        default:
            throw new Error('Dit element kun je hier niet verwijderen.' + MANUAL);
    }
};


// ------------------------------------------------------------------ voorwaarden

function condOf(text) {
    // a condition typed by the user: 't > 13' (also 'als t > 13 dan'). Returns the trimmed text
    text = String(text || '').replace(/^\s+|\s+$/g, '').replace(/^als\s+/i, '').replace(/\s+dan$/i, '');
    var ast = null;
    try {
        ast = parse('als ' + text + ' dan\nstop\neindals', 'voorwaarde');
    } catch (err) {
        ast = null;
    }
    if (!text || !ast || ast.length != 1 || ast[0].type != 'If') {
        throw new Error('De voorwaarde "' + text + '" klopt niet. Bijvoorbeeld: t > 13');
    }
    return text;
}

function blockLines(condition, body) {
    // als t > 13 dan / (indented) Opp = Opp + dOpp / eindals, as in the exam models
    var out = ['als ' + condition + ' dan'];
    for (var i = 0; i < body.length; i++) out.push('    ' + body[i]);
    out.push('eindals');
    return out;
}

function writeBlock(c, at, lines) {
    // insert the lines of a block before line at (outside als ... eindals), same indentation
    var i = insert(c.regels, at, lines[0]);
    var ind = /^\s*/.exec(c.regels[i])[0];
    for (var k = 1; k < lines.length; k++) c.regels.splice(i + k, 0, ind + lines[k]);
}

function replaceBlock(c, block, lines) {
    var ind = /^\s*/.exec(c.regels[block.start])[0];
    var args = [block.start, block.end - block.start + 1];
    for (var k = 0; k < lines.length; k++) args.push(ind + lines[k]);
    c.regels.splice.apply(c.regels, args);
}

Context.prototype.isFormula = function(name) {
    // calculated with a formula in the modelregels, not a toestandsvariabele (x = x + dx)
    var el = this.g.elements.hasOwnProperty(name) ? this.g.elements[name] : null;
    return this.assigned.hasOwnProperty(name) && !(el && el.kind == 'stock') && !this.init.hasOwnProperty(name);
};

Context.prototype.checkTarget = function(name) {
    // a variable that a voorval can change: with a startwaarde, or a hulpvariabele
    name = String(name || '').replace(/^\s+|\s+$/g, '');
    if (!name) throw new Error('Welke variabele verandert er? Vul de naam in, bijvoorbeeld v.');
    if (name == this.g.time || name == this.g.dt) {
        throw new Error(name + ' kun je niet met een voorwaarde veranderen. Kies "Stop het model" om op een tijdstip te stoppen.');
    }
    if (!this.exists(name)) throw new Error('De variabele "' + name + '" bestaat niet.');
    if (!this.init.hasOwnProperty(name) && !this.isFormula(name)) {
        throw new Error(name + ' heeft nog geen beginwaarde. Geef ' + name + ' eerst een waarde (klik op de ?).');
    }
    return name;
};

ops.addEvent = function(c, op) {
    var cond = condOf(op.condition);
    if (op.stop) {
        writeBlock(c, endOf(c.regels), blockLines(cond, ['stop']));
        return;
    }
    var name = c.checkTarget(op.target), text = String(op.text || '').replace(/^\s+|\s+$/g, '');
    exprOf(text);
    writeBlock(c, c.afterLast(name), blockLines(cond, [name + ' = ' + text]));
};

ops.setEvent = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'event' && el.kind != 'stop') throw new Error('Dit is geen voorval of stopvoorwaarde.');
    var block = c.eventBlock(el);
    if (!block) c.need(-1, el.label);
    var st = block.stmt;
    var cond = op.condition === undefined ? grafisch.code(st.cond) : condOf(op.condition);
    var body = [], k;
    for (k = 0; k < st.then.length; k++) {
        var s = st.then[k];
        if (s.type == 'Stop') body.push('stop');
        if (s.type == 'Assignment') body.push(s.left + ' = ' + grafisch.code(s.right));
    }
    if (op.text !== undefined && el.kind == 'event') {
        if (body.length != 1) c.need(-1, el.label);
        var text = String(op.text).replace(/^\s+|\s+$/g, '');
        exprOf(text);
        for (k = 0; k < st.then.length; k++) if (st.then[k].type == 'Assignment') body[0] = st.then[k].left + ' = ' + text;
    }
    replaceBlock(c, block, blockLines(cond, body));
};

Context.prototype.limitBlock = function(name, bound) {
    // als x > 42,6 dan x = 42,6 eindals (bound 'max'), als x < 0 dan x = 0 eindals ('min')
    var list = this.blocks(), cmp = bound == 'max' ? ['>', '>='] : ['<', '<='];
    for (var i = 0; i < list.length; i++) {
        var st = list[i].stmt, body = [], k;
        if (st.type != 'If' || st.cond.type != 'Logical' || cmp.indexOf(st.cond.operator) == -1) continue;
        if (st.cond.left.type != 'Variable' || st.cond.left.name != name) continue;
        for (k = 0; k < st.then.length; k++) if (st.then[k].type != 'Blank') body.push(st.then[k]);
        if (body.length == 1 && body[0].type == 'Assignment' && body[0].left == name &&
            grafisch.code(body[0].right) == grafisch.code(st.cond.right)) return list[i];
    }
    return null;
};

ops.setLimit = function(c, op) {
    var name = op.name, text = String(op.text || '').replace(/^\s+|\s+$/g, '');
    if (op.bound != 'max' && op.bound != 'min') throw new Error('Onbekende grens: ' + op.bound);
    var block = c.limitBlock(name, op.bound);
    if (text === '') {
        if (block) c.regels.splice(block.start, block.end - block.start + 1);
        return;
    }
    exprOf(text);
    var lines = blockLines(name + (op.bound == 'max' ? ' > ' : ' < ') + text, [name + ' = ' + text]);
    if (block) replaceBlock(c, block, lines);
    else writeBlock(c, c.afterLast(name), lines);
};


function apply(model, op) {
    // returns the new {startwaarden, modelregels}. Throws an Error with a message for the user.
    if (!ops.hasOwnProperty(op.op)) throw new Error('Onbekende bewerking: ' + op.op);
    var c;
    try {
        c = new Context(model);
    } catch (err) {
        throw new Error('Het model bevat een fout. Los die eerst op in de tekst.');
    }
    c.timeUnit = op.timeUnit;
    ops[op.op](c, op);
    var result = c.text();
    try {
        parse(result.startwaarden, 'startwaarden');
        parse(result.modelregels, 'modelregels');
    } catch (err2) {
        throw new Error('Deze wijziging levert geen geldig model op.' + MANUAL);
    }
    return result;
}

function variablesOf(text) {
    return grafisch.variables(exprOf(text));
}

function dtOf(model) {
    var c = new Context(model), dt = c.g.dt;
    return {name: dt, text: c.init.hasOwnProperty(dt) ? grafisch.code(c.init[dt]) : null};
}

function eventOf(model, id) {
    var c = new Context(model), el = c.element(id);
    var block = (el.kind == 'event' || el.kind == 'stop') ? c.eventBlock(el) : null;
    if (!block) return null;
    var st = block.stmt, out = {condition: grafisch.code(st.cond), target: null, text: null};
    for (var k = 0; k < st.then.length; k++) {
        if (st.then[k].type == 'Assignment') {
            if (out.target !== null) return {condition: out.condition, target: null, text: null};   // more: only the condition
            out.target = st.then[k].left;
            out.text = grafisch.code(st.then[k].right);
        }
    }
    return out;
}

function limitsOf(model, name) {
    var c = new Context(model), out = {}, bounds = ['max', 'min'];
    for (var i = 0; i < bounds.length; i++) {
        var b = c.limitBlock(name, bounds[i]);
        out[bounds[i]] = b ? grafisch.code(b.stmt.cond.right) : '';
    }
    return out;
}

exports.apply = apply;
exports.eventOf = eventOf;
exports.limitsOf = limitsOf;
exports.variablesOf = variablesOf;
exports.dtOf = dtOf;
