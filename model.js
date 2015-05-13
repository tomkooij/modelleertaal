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

exports.Model = Model;
