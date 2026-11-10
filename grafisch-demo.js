/*
    grafisch-demo.js  (prototype)

    Maakt een HTML-overzicht met het grafische model van ieder model in modellen/*.xml
    usage: node grafisch-demo.js uitvoer.html [model.xml ...]
*/
//jshint node:true
"use strict";

var fs = require('fs');
var path = require('path');
var evaluator = require('./evaluator.js');
var parser = require('./modelleertaal').parser;
var grafisch = require('./grafisch.js');

var outFile = process.argv[2] || 'grafisch-demo.html';
var files = process.argv.slice(3);
if (!files.length) {
    files = fs.readdirSync('modellen').filter(function(f) { return /\.xml$/.test(f) && f != 'leeg.xml'; })
        .map(function(f) { return path.join('modellen', f); });
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var sections = [];
files.forEach(function(file) {
    var model = new evaluator.Model();
    model.readBogusXMLFile(file);
    var g;
    try {
        g = grafisch.analyse(parser.parse(model.startwaarden, 'startwaarden'),
                             parser.parse(model.modelregels, 'modelregels'));
    } catch (err) {
        sections.push('<section><h2>' + esc(path.basename(file)) + '</h2><p class="err">' + esc(err.message) + '</p></section>');
        return;
    }
    var rows = grafisch.table(g).map(function(r) {
        return '<tr><td>' + esc(r.kind) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(r.definition) + '</td></tr>';
    }).join('');
    sections.push('<section><h2>' + esc(path.basename(file)) + '</h2>' +
        '<div class="row"><pre>' + esc(model.modelregels.trim()) + '</pre>' +
        '<div class="svg">' + grafisch.toSVG(g) + '</div></div>' +
        '<details><summary>Herkende elementen</summary><table>' + rows + '</table></details></section>');
});

var html = '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Grafische modellen</title><style>' +
    ':root{color-scheme:light}body{font-family:Segoe UI,Helvetica,Arial,sans-serif;margin:16px;background:#f6f7f9;color:#1d2733}' +
    'section{background:#fff;border:1px solid #dde2e8;border-radius:8px;padding:12px 16px;margin:0 0 16px}' +
    'h2{font-size:16px;margin:0 0 8px}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}' +
    'pre{font-size:12px;background:#f3f5f8;padding:8px;border-radius:6px;margin:0;max-width:340px;overflow:auto}' +
    '.svg{flex:1;min-width:0;overflow:auto}.svg svg{max-width:100%;height:auto}' +
    'table{border-collapse:collapse;font-size:13px;margin-top:6px}td{border-top:1px solid #eee;padding:3px 8px;vertical-align:top}' +
    '.err{color:#c62828}</style></head><body><h1 style="font-size:20px">Tekstmodel → grafisch model (prototype)</h1>' +
    sections.join('') + '</body></html>';
fs.writeFileSync(outFile, html);
console.log('geschreven: ' + outFile + ' (' + files.length + ' modellen)');
