/*
 Class Results
 Store and manipulate results
*/
function Results(namespace) {
    this.namespace = namespace;
    this.row = [[]];
    this.varList = this.namespace.listAllVars();
}


Results.prototype.getAllandCleanUp = function(resultObject, Nresults) {
    /* copy results and "clean" (round) the numbers */

    // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function humanize(x) {
      return x.toFixed(3).replace(/\.?0*$/,'').replace('.',',');
    }
    console.log(resultObject);

    var temp = [];

    // copy results (array of COLUMNS) to this.row (array of ROWS)
    for (i = 0; i < Nresults; i++) {
        this.row[i] = [];
        for (var varName in this.namespace.varNames) {
            varName = this.namespace.removePrefix(varName);
            temp = resultObject[varName];
            this.row[i].push(humanize(temp[i]));
        }
    }

    variableCounter = 0;

    for (var varName in this.namespace.varNames) {
        varName = this.namespace.removePrefix(varName);
        // push / pop ?!!?!?
        var bb = resultObject[varName];
        var temp = [];
        for (var i = 0; i < resultObject[varName].length; i++ ) {
            temp[i] = humanize(bb[i]);
        }
        this[varName] = temp;
        variableCounter++;
    }
};

exports.Results = Results;
