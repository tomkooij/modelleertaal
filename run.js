// CommonJS
var fs = require("fs");
var evalmodule = require("./evaluator.js");

var filename = 'modellen/model.xml'


function main() {

    var N = 1e3; // aantal iteraties
    var Nresults = 2; // store every Nresults iterations

    var model = new evalmodule.Model();
    model.readBogusXMLFile(filename);
    console.log(model);

    var evaluator = new evalmodule.ModelregelsEvaluator(model, true);
    var results = evaluator.run(N, Nresults);

    // Debug output
    console.log("t["+Nresults+"]= ", results.t[Nresults-1]);
    //console.log("y["+Nresults+"]= ", results.y[Nresults-1]);

    var res = new evalmodule.Results(evaluator.namespace);
    res.getAllandCleanUp(results, Nresults);

    //writeCSV("output.csv", res, Nresults);

    bogusTable(res, Nresults);
}

// make a bogusTable to implement and test "table making" in the browser
function bogusTable(results, Nresults) {

    // print all vars in Results class.
    var varList = results.namespace.listAllVars();
    console.log('varlist=',varList);

    // table header
    var header = '';
    for (var i = 0, len = varList.length; i < len; i++) {
        header += varList[i]+'\t';
    }
    header += '\n'
    console.log(header);

    // rows
    var row = '';
    for (var i = 0; i < Nresults; i++) {
        for (var j = 0, len = varList.length; j < len; j++) {
            row += results.row[i][j]+'\t';
        }
        row += '\n'
        console.log(row);
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
