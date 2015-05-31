// CommonJS
var fs = require("fs");
var evalmodule = require("./evaluator.js");

var filename = 'modellen/model.xml';


function main() {

    var N = 1e6; // aantal iteraties
    var Nresults = 1000; // store every Nresults iterations

    var model = new evalmodule.Model();
    model.readBogusXMLFile(filename);
    console.log(model);

    var evaluator = new evalmodule.ModelregelsEvaluator(model, true);
    var results = evaluator.run(N, Nresults);

    // Debug output
    console.log(evaluator.namespace.varNames[0]+"["+Nresults+"]= ", results.rows[Nresults-1][0]);
    console.log(evaluator.namespace.varNames[1]+"["+Nresults+"]= ", results.rows[Nresults-1][1]);

    var res = new evalmodule.Results(evaluator.namespace);
    res.getAllandCleanUp(results, Nresults);

    //writeCSV("output.csv", res, Nresults);

    //bogusTable(res, Nresults);
}

// make a bogusTable to implement and test "table making" in the browser
function bogusTable(results, Nresults) {

    // print all vars in Results class.
    var i,j;

    var varNames = results.namespace.varNames;

    // table header
    var header = '';
    for (i = 0; i < varNames.length; i++) {
        header += varNames[i]+'\t';
    }
    header += '\n';
    console.log(header);

    // rows
    var row = '';
    for (i = 0; i < Nresults; i++) {
        for (j = 0, len = varNames.length; j < len; j++) {
            row += results.rows[i][j]+'\t';
        }
        row += '\n';
        console.log(row);
        row = '';
    }

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
