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
