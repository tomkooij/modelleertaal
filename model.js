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

        // HACK!! THIS NEED FIXING!

        console.log('HACK! Fix me in model.js');
        console.log(action, lines[line].slice(1,12));

        switch(lines[line].slice(1,12)) {
            // < and > mess things up in the browser
            case 'modelregels': { action = 1; lines[line] = '/* modelregels */'; break; }
            case '/modelregel': { action = 0; break; }
            case 'startwaarde': { action = 2; lines[line] = '/* startwaarden */'; break; }
            case '/startwaard': { action = 0; break; }
        }
        if (action==1) this.modelregels += lines[line]+'\n';
        if (action==2) this.startwaarden += lines[line]+'\n';
    }
    console.log('DEBUG: in model.js parseBogusXMLString endresult this.modelregels:');
    console.log(this.modelregels);
    console.log('DEBUG: in model.js parseBogusXMLString endresult this.startwaarden:');

    console.log(this.startwaarden);

};

function test_bogusXML() {
    var model = new Model();
    model.readBogusXMLFile('modellen/model 17.xml');
}

exports.Model = Model;
