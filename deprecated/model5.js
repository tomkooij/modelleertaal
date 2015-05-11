/*
SysNat deel 5 H5 model 5 Optrekken van een auto
modelregels

Pure javascript for speed comparision

*/

function model() {

    /* startwaarden */
    const Fmotor = 500;
    const m = 800;
    const dt = 1e-5;
    var v = 0;
    var s = 0;
    var t = 0;

    var Fres;
    var a;
    var dv, ds;
    try {
        for (var i = 0; i < 1e6; i++) {

            /* model */
            Fres = Fmotor;
            a = Fres/m;
            dv = a * dt;
            v = v + dv;
            ds = v * dt;
            s = s + ds
            if (1) { t = t + dt; }
            if (t > 5) throw "StopIteration";
        }
    }
    catch(e) {
        console.log(e+" caught!");
    }
    finally {
        console.log('t=',t);
        console.log('s=',s);
        for (name in window) {
            console.log("this[" + name + "]=" + this[name]);
        }
    }

};


var t1 = Date.now();
model();
var t2 = Date.now();
console.log("Time: " + (t2 - t1) + "ms");
