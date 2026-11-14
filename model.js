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

    var action = 0; // 0 = do nothing, 1 = modelregels, 2 = startwaarden, 3 = grafisch, 4 = opdracht, 5 = indeling
    // N = 1000 (outside the sections): the number of iterations. Not global (/g): a global regexp
    // keeps lastIndex between the lines, so N could be missed after a longer line with =
    var equationRe = /^\s*N\s*=\s*(\d+)/;

    this.startwaarden = '';
    this.modelregels = '';
    // <grafisch>: for the graphical model, which variables a line with ... depends on,
    // e.g. 'Fres: Fz, Fp' (see grafisch.js, parseHints). Optional.
    this.grafisch = '';
    // <opdracht>: a question or assignment with the model (shown above the model). Optional.
    this.opdracht = '';
    // <indeling>: positions of dragged symbols in the graphical model, as JSON. Optional.
    this.indeling = '';

    // strip BOM and Windows line endings (\r confuses the line numbers in error messages)
    if (xmlString.charCodeAt(0) === 0xFEFF) xmlString = xmlString.slice(1);
    var lines = xmlString.split(/\r?\n/);

    for(var line = 1; line < lines.length; line++) {

        //console.log(action, lines[line]);
        // try to extra N = ... from model
        if (action === 0) {
          var matches = equationRe.exec(lines[line]);
          if (matches !== null) {
            this.N = parseInt(matches[1], 10);
            if (this.debug) console.log('Found N = '+this.N+' in model.xml');
          }
        }
        switch(lines[line].replace('\r','')) {
            // < and > mess things up in the browser
            case '<modelregels>': { action = 1; continue; }
            case '</modelregels>': { action = 0; continue; }
            case '<startwaarden>': { action = 2; continue; }
            case '</startwaarden>': { action = 0; continue; }
            case '<grafisch>': { action = 3; continue; }
            case '</grafisch>': { action = 0; continue; }
            case '<opdracht>': { action = 4; continue; }
            case '</opdracht>': { action = 0; continue; }
            case '<indeling>': { action = 5; continue; }
            case '</indeling>': { action = 0; continue; }
        }
        if (action==1) this.modelregels += lines[line]+'\n';
        if (action==2) this.startwaarden += lines[line]+'\n';
        if (action==3) this.grafisch += lines[line]+'\n';
        if (action==4) this.opdracht += lines[line]+'\n';
        if (action==5) this.indeling += lines[line]+'\n';
    }
    this.opdracht = this.opdracht.replace(/\s+$/, '');
    this.indeling = this.indeling.replace(/\s+$/, '');
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
    // the text of a section, one \n after each line. Without empty lines at the end: a model that
    // was read ends with \n, and Open + Bewaar must not add an empty line each time
    var section = function(name, text) {
        text = String(text || '').replace(/(\r?\n)+$/, '');
        return '<' + name + '>\n' + (text ? text + '\n' : '') + '</' + name + '>\n';
    };
    return '<modelleertaal>\n' +
            Nstring +
            (this.opdracht ? section('opdracht', this.opdracht) : '') +
            section('startwaarden', this.startwaarden) +
            section('modelregels', this.modelregels) +
            (this.grafisch ? section('grafisch', this.grafisch) : '') +
            (this.indeling ? section('indeling', this.indeling) : '') +
            '</modelleertaal>\n';
};



exports.Model = Model;
