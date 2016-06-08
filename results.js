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

    // reduce resultsObject (large array) to length == Nresults
    var length = resultObject.length;
    var rowinc = Math.floor(length / Nresults);

    function SelectRows(value, index) {
        // select first row, last row and rows in between. Keep Nrows+1 rows.
        if (index === 0 || index % rowinc === 0 || index == length-1) {
            return true;
        } else {
            return false;
        }
    }
    
    var rows = resultObject;

    if (length > Nresults) {
        rows = rows.filter(SelectRows);
        console.log("filtered : ", rows.length);
    }

    this.rows = rows.map( function (row_array) {
        return row_array.map(function (item) { 
            return humanize(item);
         });
    });
};

exports.Results = Results;
