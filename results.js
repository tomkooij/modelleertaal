/*
 Class Results
 Store and manipulate results
*/

/*jshint loopfunc: true */

function Results(namespace) {
    this.namespace = namespace;
}


Results.prototype.getAllandCleanUp = function(resultObject, Nresults) {
    /* copy results and "clean" (round) the numbers */

    // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function humanize(x) {
      return x.toFixed(3).replace(/\.?0*$/,'').replace('.',',');
    }

    var temp = [], varName;

    // iterate over each variable (which are arrays [0..Nresults])
    //  humanize each item and store
    for (var i =0; i < this.namespace.varNames.length; i++) {
        varName = this.namespace.varNames[i];
        this[varName] = resultObject[varName].map( function (item) {
            return humanize(item);
        });
    }

    // humanize all items of resultObject.row[i][j]
    this.rows = resultObject.rows.map( function(arr) {
        return arr.map(function (item) {
            return humanize(item);
        });
    });
};

exports.Results = Results;
