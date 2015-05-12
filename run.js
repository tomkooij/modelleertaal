// CommonJS
var fs = require("fs");
var evalmodule = require("./evaluator.js");


function main() {

    // input sourcode:
    var modelregels = fs.readFileSync("modellen/modelregels model 17.txt", "utf8");
    var startwaarden = fs.readFileSync("modellen/startwaarden model 17.txt", "utf8");


    var N = 1e3; // aantal iteraties
    var Nresults = 100; // store every Nresults iterations

    var evaluator = new evalmodule.ModelregelsEvaluator(startwaarden, modelregels, true);
    var results = evaluator.run(N, Nresults);

    // Debug output
    console.log("t["+Nresults+"]= ", results.t[Nresults-1]);
    console.log("y["+Nresults+"]= ", results.y[Nresults-1]);

    var res = new evalmodule.Results(evaluator.namespace);
    res.getAllandCleanUp(results);

    writeCSV("output.csv", res, Nresults);
}



function writeCSV(filename, result, Nresults) {
    var stream = fs.createWriteStream(filename);
    stream.once('open', function() {
        stream.write("t; x; y\n");
        for (var i=0; i<Nresults; i++) {
            stream.write(result.t[i]+"; "+result.x[i]+"; "+result.y[i]+"\n");
        }
        stream.end();
    });
}



main();
