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

var fs = require('fs'),
    xml2js = require('xml2js');

function Model() {
    this.modelregels = '';
    this.startwaarden = '';
}

Model.prototype.readXMLFile = function(filename) {

    var parser = new xml2js.Parser();
    fs.readFile(filename, function(err, data) {
            parser.parseString(data, function (err, result) {
                // TODO: Error handling!
                console.log(result.modelleertaal.startwaarden[0]);
                this.startwaarden = result.modelleertaal.startwaarden[0];
                this.modelregels = result.modelleertaal.modelregels[0];
            });
    });
};

var model = new Model();
model.readXMLFile('modellen/model.xml');
// handle async!!!
console.log(model.startwaarden);
console.log(model.modelregels);
