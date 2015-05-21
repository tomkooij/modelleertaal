/*
 Class Results
 Store and manipulate results
*/
function Results(namespace) {
    this.namespace = namespace;
    this.varList = this.namespace.listAllVars();
}


Results.prototype.getAllandCleanUp = function(resultObject, Nresults) {
    /* copy results and "clean" (round) the numbers */

    // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function humanize(x) {
      return x.toFixed(3).replace(/\.?0*$/,'').replace('.',',');
    }

    var temp = [];

    variableCounter = 0;

    for (var varName in this.namespace.varNames) {
        varName = this.namespace.removePrefix(varName);
        var bb = resultObject[varName];
        var tmp = [];
        for (var i = 0; i < resultObject[varName].length; i++ ) {
            tmp[i] = humanize(bb[i]);
        }
        this[varName] = tmp;
        variableCounter++;
    }
    // .map should be used the humanize these values... (or just for i, for j)
    this.row = resultObject.row;
};

exports.Results = Results;
