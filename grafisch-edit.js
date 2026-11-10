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
      {op: 'remove', id}
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

Context.prototype.checkNewName = function(name) {
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
    if (this.exists(name)) throw new Error('De naam "' + name + '" bestaat al.');
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

Context.prototype.decimal = function(value) {
    // 0.1 in the style of the model: 0,1 (default) or 0.1
    var t = this.start.join('\n') + this.regels.join('\n');
    var point = /\d\.\d/.test(t) && !/\d,\d/.test(t);
    return point ? value : value.replace('.', ',');
};

Context.prototype.needTime = function() {
    // new model: t = t + dt
    var dt = this.g.dt;
    if (!this.g.time) {
        var t = this.freeName('t');
        this.start.splice(endOf(this.start), 0, t + ' = 0');
        this.regels.splice(endOf(this.regels), 0, t + ' = ' + t + ' + ' + dt);
    }
    if (!this.init.hasOwnProperty(dt)) this.start.splice(endOf(this.start), 0, dt + ' = ' + this.decimal('0.1'));
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

Context.prototype.writeStock = function(stock, terms) {
    // (re)write  stock = stock + in - out. No terms: remove the line (stock becomes a constant)
    this.checkStock(stock);
    var line = this.regelLine(stock, 'self');
    if ((this.assigned[stock] || []).length && line == -1) this.need(-1, stock);
    var rhs = stock;
    for (var i = 0; i < terms.length; i++) rhs += (terms[i].sign > 0 ? ' + ' : ' - ') + terms[i].term;
    if (line == -1) {
        if (!terms.length) return -1;
        var t = this.timeLine();
        line = insert(this.regels, t != -1 ? t : endOf(this.regels), stock + ' = ' + rhs);
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
            if (!c.init.hasOwnProperty(el.name)) c.start.splice(endOf(c.start), 0, el.name + ' = ' + text);
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

ops.addConstant = function(c, op) {
    var name = c.checkNewName(op.name);
    exprOf(op.text);
    c.start.splice(endOf(c.start), 0, indentOf(c.start, c.start.length) + name + ' = ' + op.text.replace(/^\s+|\s+$/g, ''));
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
    addRule(c, c.checkNewName(op.name), op.text);
};

ops.define = function(c, op) {
    var el = c.element(op.id);
    if (el.kind != 'unknown') throw new Error(el.name + ' heeft al een waarde of formule.');
    exprOf(op.text);
    if (op.kind == 'aux') addRule(c, el.name, op.text);
    else c.start.splice(endOf(c.start), 0, el.name + ' = ' + op.text.replace(/^\s+|\s+$/g, ''));
};

function flowLine(c, name, rate) {
    // dx = rate * dt
    return name + ' = ' + grafisch.code(exprOf(rate), 5, false) + ' * ' + c.g.dt;
}

ops.addStock = function(c, op) {
    var name = c.checkNewName(op.name);
    var initial = /^\s*$/.test(op.initial || '') ? '0' : op.initial.replace(/^\s+|\s+$/g, '');
    exprOf(initial);
    c.start.splice(endOf(c.start), 0, name + ' = ' + initial);
    c.analyse();
    ops.addFlow(c, {stock: name, direction: 'in', name: op.flow, rate: op.rate});
};

ops.addFlow = function(c, op) {
    c.checkStock(op.stock);
    var rate = /^\s*$/.test(op.rate || '') ? '0' : op.rate;
    exprOf(rate);
    var name = /^\s*$/.test(op.name || '') ? c.freeName('d' + op.stock) : c.checkNewName(op.name);
    c.needTime();
    var terms = c.flowsOf(op.stock);
    terms.push({sign: op.direction == 'out' ? -1 : 1, term: name});
    var line = c.writeStock(op.stock, terms);
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
        default:
            throw new Error('Dit element kun je hier niet verwijderen.' + MANUAL);
    }
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

exports.apply = apply;
