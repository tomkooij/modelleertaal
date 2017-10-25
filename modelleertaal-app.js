var evaluator_js = require('./evaluator.js');
var Blob = require('blob');
var FileSaver = require('file-saver');
// this also depends on:
// jQuery
// jQuery.Flot
// JQueyr.axislabels
// These libs are not included, because the Flot libray does not play well
// with browserify.
// Include this in the HTML with:
//<script src="scripts/jquery-3.2.1.min.js"></script>
//<script src="scripts/jquery.flot.js"></script>
//<script src="scripts/jquery.flot.axislabels.js"></script>


//jshint node:true
//jshint devel:true
//jshint evil:true
//jshint es3:true
//jshint loopfunc: true


var version = "v2.0.dev0 - 25okt2017";


function ModelleertaalApp(params) {

  this.debug = params.debug || false;
  console.log('Modelleertaal App. Debug = ' + this.debug);

  this.dom_modelregels = "#modelregels";
  this.dom_startwaarden = "#startwaarden";
  this.dom_status = "#status";
  this.dom_datatable = "#datatable";
  this.dom_graph = "#graph";
  this.dom_nbox = "#NBox";
  this.dom_run = "#run";
  this.dom_plot = "#plot";
  this.dom_fileinput = "#fileinput";
  this.dom_download = "#download";
  this.dom_clickdata = "#clickdata";
  this.dom_hoverdata = "#hoverdata";
  this.dom_x_var = "#x_var";
  this.dom_y_var = "#y_var";
  this.dom_model_keuze = "#model_keuze";

  this.model = new evaluator_js.Model();
  // (re)set the app
  this.init_app();

  var self = this;

  $(this.dom_run).click(function() {
    self.run();
  });

  $(this.dom_plot).click(function() {
    self.do_plot();
    self.print_status("Plot OK.");
  });

  $(this.dom_download).click(function() {
    self.download_model();
  });
  $(this.dom_fileinput).change(function(event) {
    self.read_file(event);
  });
}

ModelleertaalApp.prototype.print_status = function(txt) {
  $(this.dom_status).html(txt);
};


ModelleertaalApp.prototype.read_model = function() {
  this.model = new evaluator_js.Model();
  this.model.modelregels = $(this.dom_modelregels).val();
  this.model.startwaarden = $(this.dom_startwaarden).val();
};


ModelleertaalApp.prototype.read_file = function(evt) {
  var self = this;
  var f = evt.target.files[0];
  console.log('read_file: ' + f);

  if (f) {
    var r = new FileReader();
    r.onload = function(e) {
      console.log(e.target.result);
      self.read_model_from_xml(e.target.result);
      self.init_app();
    };
    r.readAsText(f);
  }
};


ModelleertaalApp.prototype.download_model = function() {
  // requires FileSaver.js and Blob.js
  // (Blob() not supported on most mobile browsers)
  model = new evaluator_js.Model();
  model.modelregels = $("#modelregels").val();
  model.startwaarden = $("#startwaarden").val();

  var blob = new Blob([model.createBogusXMLString()], {
    type: "text/plain;charset=utf-8"
  });
  FileSaver.saveAs(blob, "model.xml");
};


ModelleertaalApp.prototype.run = function() {

  this.print_status('Run!!!');

  this.read_model();

  if (this.debug)
    console.log('model = ', this.model);

  // read N from input field
  var N = Number($(this.dom_nbox).val());

  if (N > 1e6) {
    alert('N te groot!');
    throw new Error('N te groot!');
  }

  this.print_status("Run started...");
  console.log("Run started...");

  var evaluator;
  try {
    evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
  } catch (err) {
    this.print_status(err.message.replace(/\n/g, "<br>"));
    alert("Model niet in orde: \n" + err.message);
  }
  this.results = evaluator.run(N);

  this.print_status("Klaar na iteratie: " + this.results.length);
  console.log("Klaar na iteratie: " + this.results.length);

  // make table, plot
  this.allVars = evaluator.namespace.varNames;
  if (this.debug)
    console.log(this.allVars);

  // create the axis drop-down menu, try to keep value
  this.save_axis();
  this.reset_axis_dropdown();
  this.set_axis();

  this.print_table();

  this.do_plot();

}; // run()


ModelleertaalApp.prototype.save_axis = function() {
  // save chosen variable, try to plot same graph
  this.xvar_last = $(this.dom_x_var).find(":selected").text();
  this.yvar_last = $(this.dom_y_var).find(":selected").text();
};


ModelleertaalApp.prototype.reset_axis_dropdown = function() {

  // (re)set varNames in drop-down select fields
  $(this.dom_x_var).empty();
  $(this.dom_y_var).empty();
  $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
  $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  for (var i = 0; i < this.allVars.length; i++) {
    $('<option/>').val(i).text(this.allVars[i]).appendTo(this.dom_x_var);
    $('<option/>').val(i).text(this.allVars[i]).appendTo(this.dom_y_var);
  }
};

ModelleertaalApp.prototype.set_axis = function() {
  // try to plot same graph: Reset axis to previous settings.
  var self = this;
  idx = this.allVars.findIndex(function(s) {
    return s == self.xvar_last;
  });
  if (idx != -1) $(this.dom_x_var).val(idx);
  idx = this.allVars.findIndex(function(s) {
    return s == self.yvar_last;
  });
  if (idx != -1) $(this.dom_y_var).val(idx);
};


//
// Table
//
ModelleertaalApp.prototype.print_table = function(limit) {
  // truncated row from: jquery.jsparc.js
  // http://github.com/HiSPARC/jSPARC

  var self = this;

  var dataset = self.results;

  limit = (limit) ? limit : 20;
  limit = Math.min(dataset.length, limit);

  var firstrow = $('<tr>');
  var table = $('<table>').addClass('table');
  firstrow.append($('<th>').text('#'));

  for (var k = 0; k < this.allVars.length; k++) {
    firstrow.append($('<th>').text(this.allVars[k]));
  }
  table.append(firstrow);

  for (var i = 0; i < dataset.length; i++) {
    var row = $('<tr>');
    row.append($('<td>').text(i));
    for (var j = 0; j < dataset[i].length; j++) {
      row.append($('<td>').text(dataset[i][j].toPrecision(4)));
    }
    table.append(row);

    if (limit != dataset.length && i == Math.floor(limit / 2) - 1) {
      var truncrow = $('<tr>');
      truncrow.append($('<td>')
        .text('... Tabel ingekort. Klik voor meer rijen ...')
        .attr('colspan', dataset.length + 1)
        .css({
          'text-align': 'left',
          'cursor': 'pointer'
        })
        .click(function() {
          self.print_table(limit * 5);
        }));
      table.append(truncrow);
      i = dataset.length - 1 - Math.ceil(limit / 2);
    }
  }

  $(self.dom_datatable).html(table);
};

//
// Plotten
//
ModelleertaalApp.prototype.do_plot = function() {

  var scatter_plot = [];

  // if set to "auto" set axis to default settings (x,t)
  this.set_axis_to_defaults();

  Nresults = Math.min(this.results.length, 100);
  this.results = reduce_rows(this.results, Nresults);

  for (var i = 0; i < this.results.length; i++) {
    scatter_plot.push([this.results[i][xvar_colidx], this.results[i][yvar_colidx]]);
  }
  $(this.dom_graph).empty(); // verwijder text enzo
  this.plot_graph(scatter_plot, this.previous_plot);
  this.previous_plot = scatter_plot;
}; // do_plot


ModelleertaalApp.prototype.set_axis_to_defaults = function() {
  // get column indices (in results array) of variables to plot
  xvar_colidx = $(this.dom_x_var).val();
  yvar_colidx = $(this.dom_y_var).val();

  // if undefined -> x first column, y second column of results
  xvar_colidx = (xvar_colidx) ? xvar_colidx : 0;
  yvar_colidx = (yvar_colidx) ? yvar_colidx : 1;

  // set column varnames in input fields
  $(this.dom_x_var).val(xvar_colidx);
  $(this.dom_y_var).val(yvar_colidx);
};


ModelleertaalApp.prototype.plot_graph = function(dataset, previous_plot) {

  var self = this;

  $.plot($(this.dom_graph), [{
      data: previous_plot,
      color: '#d3d3d3'
    },
    {
      data: dataset,
      color: 'blue'
    }
  ], {
    series: {
      lines: {
        show: true
      },
      points: {
        radius: 1,
        show: true,
        fill: true
      }
    },
    grid: {
      hoverable: true,
      clickable: true
    },
    axisLabels: {
      show: true
    },
    xaxes: [{
      axisLabel: this.allVars[$(this.dom_x_var).val()]
    }],
    yaxes: [{
      position: 'left',
      axisLabel: this.allVars[$(this.dom_y_var).val()]
    }]
  }); // $.plot()

  $(this.dom_graph).bind("plothover", function(event, pos, item) {
    var str = "(" + pos.x.toFixed(2) + ", " + pos.y.toFixed(2) + ")";
    $(self.dom_hoverdata).text(str);
  }); // $.bind("plothover")

  $(this.dom_graph).bind("plotclick", function(event, pos, item) {
    if (item) {
      var str = " - Click: (" + pos.x.toFixed(2) + ", " +
        pos.y.toFixed(2) + ")";
      $(self.dom_clickdata).text(str);
    }
  }); // $bind.("plotclick")

}; // plot_graph()

ModelleertaalApp.prototype.read_model_from_xml = function(XMLString) {
  this.model = new evaluator_js.Model();
  this.model.parseBogusXMLString(XMLString);
};

//
// Reset
//
ModelleertaalApp.prototype.init_app = function() {
  $(this.dom_modelregels).val(this.model.modelregels);
  $(this.dom_startwaarden).val(this.model.startwaarden);
  $(this.dom_y_var).empty();
  $(this.dom_x_var).empty();
  $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
  $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  $(this.dom_graph).html("Model geladen. Geen data. Druk op Run!");
  this.print_status("Status: Model geladen.");
  $(this.dom_datatable).empty();
  this.previous_plot = [];
};


//
// Helpers
//
function reduce_rows(rows, Nresults) {
  // reduce resultsObject (large array) to length == Nresults

  var length = rows.length;
  var rowinc = Math.floor(length / Nresults);

  function select_rows(value, index) {
    // select first row, last row and rows in between. Keep Nrows+1 rows.
    if (index === 0 || index % rowinc === 0 || index == length - 1) {
      return true;
    } else {
      return false;
    }
  }

  if (length > Nresults) {
    return rows.filter(select_rows);
  }
  return rows;
}


exports.ModelleertaalApp = ModelleertaalApp;
