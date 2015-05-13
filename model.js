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

    var result = xml.parseFileSync(filename);
    if (result.name == 'modelleertaal') {

        for (var i = 0; i < result.childs.length; i++) {

            switch(result.childs[i].name){
                case 'startwaarden':  {
                    this.startwaarden = result.childs[i].childs[0];
                    break;
                }
                case 'modelregels':  {
                    this.modelregels = result.childs[i].childs[0];
                    break;
                }
                default:
                        throw new Error('Unable to handle xml item: ', result.childs[i]);
            }
        }
    }
};

var model = new Model();
model.readXMLFile('modellen/model.xml');
console.log(model.startwaarden);
console.log(model.modelregels);
