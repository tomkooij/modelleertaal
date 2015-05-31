/*
 Class Results
 Store and manipulate results
*/

//jshint loopfunc: true
//jshint es3:true

function Results(namespace) {
    this.namespace = namespace;
}


Results.prototype.getAllandCleanUp = function(resultObject, Nresults) {
    /* copy results and "clean" (round) the numbers */

    // http://stackoverflow.com/questions/661562/how-to-format-a-float-in-javascript
    function humanize(x) {
      return x.toFixed(3).replace(/\.?0*$/,'').replace('.',',');
    }

    // make sure Nresults is set in function call
    if (typeof Nresults === 'undefined') {
        throw new Error('Results.prototype.getAllandCleanUp(): Nresults is undefined.');
    }

    var temp = [], varName;

    // iterate over each variable (which are arrays [0..Nresults])
    //  humanize each item and store
    // UNUSED!! TO BE REMOVED!
    for (var i =0; i < this.namespace.varNames.length; i++) {
        varName = this.namespace.varDict[this.namespace.varNames[i]];
        this[varName] = resultObject[varName].map( function (item) {
            return humanize(item);
        });
    }

    // humanize all items of resultObject.row[i][j]
    //  for table output
    this.rows = resultObject.rows.map( function(arr) {
        return arr.map(function (item) {
            return humanize(item);
        });
    });

    if (Nresults > 100) {
        // select only 100 rows for graph output (performance!)
        this.graph_rows = resultObject.rows.map( function (row_array, index) {
            if (index === 0) {
                return row_array.map(Number);
            }
            // skip rows to keep only 100 rows for graph output (flot perfomance)
            //  only valid for Nresults >= 100
            if ((index % Math.floor(Nresults/100)) === 0) {
                return row_array.map(Number);
            }
            if (index == Nresults-1) {
                // last row!
                return row_array.map(Number);
            }
        });
    } else {
        // Just convert results to float
        this.graph_rows = resultObject.rows.map( function (row_array) {
            return row_array.map(Number);
        });
    }
};

exports.Results = Results;
