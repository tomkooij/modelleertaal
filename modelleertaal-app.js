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


//jshint devel:true
//jshint es3:true
//jshint loopfunc: true

/* version history
v4.4.0 (13sep19) Add read N=1000 from XML. Add error msg for ... "Vul hier iets in"
v4.4.1 (15sep19) Accept ... and unicode symbol '...' as BLANK (Vul hier in error)
v4.5 (28sep19) Bugfix: fix double alert 'cannot read property of undefined' on parse error
     accepteer unicode squared/cubed F=k*v²
*/
var version = "v4.5 - 28sep2019";


function ModelleertaalApp(params) {

  this.debug = params.debug || false;
  console.log('Modelleertaal App. ' + version + '. Debug = ' + this.debug);

  this.CodeMirror = params.CodeMirror || true;
  this.CodeMirrorActive = false;

  this.dom_modelregels = "#modelregels";
  this.dom_startwaarden = "#startwaarden";
  this.dom_status = "#status_bar";
  this.dom_datatable = "#datatable";
  this.dom_graph = "#graph";
  this.dom_nbox = "#NBox";
  this.dom_nbox_continue = "#NBoxContinue";
  this.dom_run = "#run";
  this.dom_continue = "#continue";
  this.dom_trace = "#trace";
  this.dom_plot = "#plot";
  this.dom_fileinput = "#fileinput";
  this.dom_download_xml = "#download_xml";
  this.dom_download_xml_fn = "#xml_filename";
  this.dom_download_pgf = "#download_pgf";
  this.dom_download_pgf_fn = "#pgf_filename";
  this.dom_download_tsv = "#download_tsv";
  this.dom_download_tsv_fn = "#tsv_filename";
  this.dom_clickdata = "#clickdata";
  this.dom_hoverdata = "#hoverdata";
  this.dom_x_var = "#x_var";
  this.dom_y_var = "#y_var";
  this.dom_model_keuze = "#model_keuze";

  this.read_model();

  if ((this.CodeMirror) && (typeof(CodeMirror) == 'function')) {
    if (this.debug)
      console.log("CodeMirror enabled.");
    var codemirror_options = {
      lineNumbers: true,
      mode: "modelleertaal" };
    this.modelregels_editor = CodeMirror.fromTextArea($(this.dom_modelregels)[0], codemirror_options);
    this.startwaarden_editor = CodeMirror.fromTextArea($(this.dom_startwaarden)[0], codemirror_options);
    this.CodeMirrorActive = true;
  } else {
    this.CodeMirror = false;
    this.CodeMirrorActive = false;
    if (this.debug)
      console.log("CodeMirror disabled.");
  }

  // (re)set the app
  this.init_app();

  this.max_rows_in_plot = 100;

  var self = this;

  $(this.dom_run).click(function() {
    // read N from input field
    self.N = Number($(self.dom_nbox).val());
    self.run();
  });

  $(this.dom_continue).click(function() {
    self.N = Number($(self.dom_nbox_continue).val());
    self.continue_run();
  });

  $(this.dom_trace).click(function() {
    self.trace();
  });


  $(this.dom_plot).click(function() {
    if (self.results.length === 0) {
        alert('Geen resultaten. Druk eerst op Run!');
    } else {
        self.do_plot();
    }
    //self.print_status("Plot OK.");
  });

  $(this.dom_download_xml).click(function() {
    self.download_model();
  });
  $(this.dom_download_pgf).click(function() {
    self.download_pgfplot();
  });
  $(this.dom_download_tsv).click(function() {
    self.download_tsv();
  });

  $(this.dom_fileinput).change(function(event) {
    self.read_file(event);
  });
}


ModelleertaalApp.prototype.print_status = function(status, error) {
  $(this.dom_status).html(status);
  if (typeof error != "undefined") $(this.dom_graph).html(error).css("font-family", "monospace");
};


ModelleertaalApp.prototype.read_model = function() {
  // read model from textarea/CodeMirror
  this.model = new evaluator_js.Model();
  if (this.CodeMirrorActive) {
    this.model.modelregels = this.modelregels_editor.getValue();
    this.model.startwaarden = this.startwaarden_editor.getValue();
  } else {
    this.model.modelregels = $(this.dom_modelregels).val();
    this.model.startwaarden = $(this.dom_startwaarden).val();
  }
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
  // download model in "BogusXML" format
  //  just a text file with XML like tags...

  var filename = $(this.dom_download_xml_fn).val();
  this.read_model();
  this.save_string(this.model.createBogusXMLString(), filename);
};


ModelleertaalApp.prototype.download_pgfplot = function() {
  // save the plot in TikZ/PGFPlot format

  if (this.do_plot() === false) return;

  var filename = $(this.dom_download_pgf_fn).val();
  this.save_string(this.create_pgfplot(), filename);
};


ModelleertaalApp.prototype.download_tsv = function() {
  // download the results in TSV format.

  var filename = $(this.dom_download_tsv_fn).val();
  this.save_string(this.create_tsv(), filename);
};


ModelleertaalApp.prototype.save_string = function(data, filename) {
  // requires FileSaver.js and Blob.js
  // (Blob() not supported on most mobile browsers)

  // mime text/plain expects CRLF \r\n instead of \n
  // this should work on both Windows and Mac/Linux
  var blob = new Blob([data.replace(/([^\r])\n/g, "$1\r\n")], {
    type: "text/plain;charset=utf-8"
  });
  FileSaver.saveAs(blob, filename);
};

ModelleertaalApp.prototype.run = function() {

  if (this.setup_run()) {
    this.new_run = true;
    if (!this.do_run()) this.has_run = false;
    this.after_run();
    this.has_run = true;
    return true;
  } else {
    return false;
  }
};

ModelleertaalApp.prototype.continue_run = function() {
  if (this.has_run) {
    this.new_run = false;
    this.tracing = false;
  } else {
    this.new_run = true;
    this.setup_run();
  }
  if (!this.do_run()) this.has_run = false;
  this.after_run();
  this.has_run = true;
  return true;
};

ModelleertaalApp.prototype.trace = function() {

  if (this.has_run) {
    this.new_run = false;
  } else {
    this.new_run = true;
    this.setup_run();
  }

  this.tracing = true;
  this.do_run();

  this.after_run();
  this.has_run = true;
  return true;
};

ModelleertaalApp.prototype.setup_run = function() {

  // reset the breakpoint pointer:
  this.tracing = false;
  this.remove_highlight_trace();

  this.read_model();

  if (this.debug)
    console.log('model = ', this.model);

  if (this.N > 1e6) {
    alert('N te groot!');
    throw new Error('N te groot!');
  }

  this.print_status("Run started...");
  console.log("Run started...");

  try {
    this.evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
  } catch (err) {
    this.print_status("Model niet in orde.", err.message.replace(/\n/g, "<br>"));
    alert("Model niet in orde: \n" + err.message);
    this.highlight_error(err.parser_line, err.parser_name);
		return false;
  }
  return true;
};

ModelleertaalApp.prototype.do_run = function() {

  var run_result;

	try {
    this.evaluator.set_state(this.N, this.new_run, this.tracing);
	  this.evaluator.run();
    run_result = this.evaluator.get_state();
    this.results = this.evaluator.result;
  } catch (err) {
		if (err instanceof EvalError) {
			alert("Model niet in orde:\nVariable niet gedefineerd in startwaarden?\n" + err.message);
		} else {
			alert("Model niet in orde:\n" + err.message);
		}
    this.print_status("Fout in model.", err.message.replace(/\n/g, "<br>"));
    this.highlight_error(err.parser_line, err.parser_name);
    return false;
	}

  var N_iterations = this.results.length-1;
  if (!run_result.tracing) {
    this.print_status("Klaar na "+N_iterations+" iteraties.");
       this.tracing = false;
    this.remove_highlight_trace();
  } else {
    this.print_status("Debugger in iteratie "+ N_iterations);
    this.highlight_trace(run_result.lineno+1);
  }

  // make table, plot
  this.allVars = this.evaluator.namespace.varNames;
  if (this.debug)
    console.log(this.allVars);
};

ModelleertaalApp.prototype.after_run = function() {

  if (this.allVars !== undefined) {
    // create the axis drop-down menu, try to keep value
    this.save_axis();
    this.reset_axis_dropdown();
    this.set_axis();

    this.print_table();
    this.do_plot();
  }
};



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
  var self = this;
  $(this.dom_x_var).change(function(){
    // the plotted variables change. Erase previous results.
    self.previous_plot = [];
  });
  $(this.dom_y_var).change(function(){
    // the plotted variables change. Erase previous results.
    self.previous_plot = [];
  });
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
ModelleertaalApp.prototype.table_header = function() {
  var firstrow = $('<tr>');
  firstrow.append($('<th>').text('#'));

  for (var k = 0; k < this.allVars.length; k++) {
    firstrow.append($('<th>').text(this.allVars[k]));
  }
  return firstrow;
};


ModelleertaalApp.prototype.table_row = function(rowIndex) {

    function fix(x) {
      if (isNaN(x)) return "X";
        if (Math.abs(x) < 0.0001) return 0;
      return x;
    }

    var row = $('<tr>');
    row.append($('<td>').text(rowIndex));
    for (var j = 0; j < this.results[rowIndex].length; j++) {
      row.append($('<td>').text(fix(this.results[rowIndex][j].toPrecision(4))));
    }
    return row;
};

ModelleertaalApp.prototype.print_table = function(limit) {
  // truncated row from: jquery.jsparc.js
  // http://github.com/HiSPARC/jSPARC

  var self = this;

  limit = (limit) ? limit : 10;
  limit = Math.min(this.results.length, limit);

  var table = $('<table>').addClass('table');
  table.append(this.table_header());

  for (var i = 0; i < this.results.length; i++) {
    table.append(this.table_row(i));

    if (limit != this.results.length && i == Math.floor(limit / 2) - 1) {
      var truncrow = $('<tr>');
      truncrow.append($('<td>')
        .text('... Tabel ingekort. Klik voor meer rijen ...')
        .attr('colspan', this.results.length + 1)
        .css({
          'text-align': 'left',
          'cursor': 'pointer'
        })
        .click(function() {
          self.print_table(limit * 5);
        }));
      table.append(truncrow);
      i = this.results.length - 1 - Math.ceil(limit / 2);
    }
  }

  $(self.dom_datatable).html(table);
};

//
// Plotten
//
ModelleertaalApp.prototype.do_plot = function() {

  if (this.results.length === 0) {
    //alert('Geen resultaten. Druk eerst op Run!');
    console.log('No results! cannot plot');
    return false;
  }
  this.scatter_plot = [];

  // if set to "auto" set axis to default settings (x,t)
  this.set_axis_to_defaults();

  var results = this.reduce_rows(this.results, this.max_rows_in_plot);

  for (var i = 0; i < results.length; i++) {
    this.scatter_plot.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
  }

  $(this.dom_graph).empty(); // verwijder text enzo
  $(this.dom_clickdata).empty();
  this.plot_graph(this.scatter_plot, this.previous_plot);
  this.previous_plot = this.scatter_plot;
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

  $(this.dom_graph).css("font-family", "sans-serif");

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
    if (item.seriesIndex == 1) {
     // clicked on currect graph
     var table = $('<table>').addClass('table');
     table.append(self.table_header());
     table.append(self.table_row(self.get_result_rowIndex(item.dataIndex)));
     $(self.dom_clickdata).html(table);
    }
  }); // $bind.("plotclick")

}; // plot_graph()

ModelleertaalApp.prototype.set_max_rows_in_plot = function(max_rows) {
  this.max_rows_in_plot = max_rows;
};

ModelleertaalApp.prototype.read_model_from_xml = function(XMLString) {
  this.model = new evaluator_js.Model();
  this.model.parseBogusXMLString(XMLString);
};


//
// Reset
//
ModelleertaalApp.prototype.init_app = function() {
  if (this.CodeMirrorActive) {
    this.modelregels_editor.setValue(this.model.modelregels);
    this.startwaarden_editor.setValue(this.model.startwaarden);
  } else {
    $(this.dom_modelregels).val(this.model.modelregels);
    $(this.dom_startwaarden).val(this.model.startwaarden);
  }
  if (this.model.N) $(this.dom_nbox).val(this.model.N);
  $(this.dom_y_var).empty();
  $(this.dom_x_var).empty();
  $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
  $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  this.print_status("Status: Model geladen.", "Model geladen. Geen data. Druk op Run!");
  $(this.dom_datatable).empty();
  this.results = [];
  this.scatter_plot = [];
  this.previous_plot = [];
  this.has_run = false;
  this.tracing = false;

};


//
// TSV -- use TSV instead of CSV to prevent , . decimal problems in Excel.
//
ModelleertaalApp.prototype.create_tsv = function() {
    var tsv = '';

    tsv += this.allVars.join('\t'); //header row
    tsv += "\n";

    tsv += this.results.map(function(d){
        return d.join('\t');
    }).join('\n');

    // replace . with , for NL Excel (should be an option)
    return tsv.replace(/\./g,",");
};

//
// PGFPlot
//
ModelleertaalApp.prototype.create_pgfplot_header = function() {
		// try to create a PGFPlot that fits the 10x10cm grid.
		// set x,y axis scales and min max values accordingly
		// This only works for graphs starting at (0,0)

		// https://stackoverflow.com/a/31643591/4965175
		function arrayMax(array) {
      return array.reduce(function(a, b) {
        return Math.max(a, b);
      });
		}

		function arrayMin(array) {
      return array.reduce(function(a, b) {
        return Math.min(a, b);
      });
		}

		function round_to_scale(max_val) {
			// round to next 10, 20, 50, 100, 200, 500, ...

			var exp_10 = Math.floor(Math.log(max_val)/Math.log(10));
			var power_of_ten = Math.pow(10, exp_10);

			if (max_val / (2 * power_of_ten) < 1) return 2*power_of_ten;
			if (max_val / (5 * power_of_ten) < 1) return 5*power_of_ten;
			return 10*power_of_ten;
		}

		function get_units_by_variable_name(var_name) {
			var units = {"x": "\\meter", "y": "\\meter", "h": "\\meter",
								"s": "\\meter", "t": "\\second",
							 "v": "\\meter\\per\\second",
							 "a": "\\meter\\per\\second",
						   "Fres": "\\Newton", "Fr": "\\Newton", "Fw": "\\Newton"};
			return (units[var_name]) ? units[var_name] : "unknown";
		}

		this.save_axis(); // get axis from drop-down
		x_var = this.xvar_last;
		y_var = this.yvar_last;
		x_unit = get_units_by_variable_name(x_var);
		y_unit = get_units_by_variable_name(y_var);

		// and back to columns again ...
		var x = []; var y = [];
		for(var i = 0; i < this.scatter_plot.length; i++){
		    x.push(this.scatter_plot[i][0]); y.push(this.scatter_plot[i][1]);
		}

		// This only works for 10x10 grid with x_min, y_min = (0,0)
		x_min = arrayMin(x);
		x_max = round_to_scale(arrayMax(x));
		y_min = arrayMin(y);
		y_max = round_to_scale(arrayMax(y));
		x_scale = x_max / 10;   // adjust to 10 cm x 10 cm grid
		y_scale = y_max / 10;

		return "%x and y scale set to 10cmx10cm grid. Adjust to fit!\n" +
		 "% x = ["+x_min+" .. "+arrayMax(x)+"]\n"+
		 "% y = ["+y_min+" .. "+arrayMax(y)+"]\n"+
		 "% this only works for graphs starting a (0,0)\n"+
		 "\\begin{axis}[x=1cm\/"+x_scale+", y=1cm\/"+y_scale+",\n"+
		 "enlargelimits=false, tick align=outside,\n "+
		 "xlabel={$"+x_var+"$ [\\si{"+x_unit+"}]},\n"+
		 "ylabel={$"+y_var+"$ [\\si{"+y_unit+"}]},\n"+
		 "% xtick={0, 1, 2, ..., 10},\n"+
		 "% ytick={0, 2, 4, ..., 20},\n"+
		 "xmin="+x_min+", xmax="+x_max+", ymin="+y_min+", ymax="+y_max+"]\n";
	};


ModelleertaalApp.prototype.create_pgfplot = function() {
		// Output PGFPlots plot

    if (this.results.length === 0) {
      alert('Geen resultaten. Druk eerst op Run!');
      return false;
    }

    this.scatter_plot = [];

    this.set_axis_to_defaults();

    var results = this.reduce_rows(this.results, this.max_rows_in_plot);

    for (var i = 0; i < results.length; i++) {
      this.scatter_plot.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
    }

		var coordinates = this.scatter_plot.map(function(d){
						return "("+d.join(',')+")";
				}).join('\n');

		PGFPlot_TeX = "% Use \\input{} to wrap this inside suitable LaTeX doc:\n";
		PGFPlot_TeX += "\\begin{tikzpicture}\n" +
			 "% draw 10x10cm millimeter paper.\n" +
			 "\\def\\width{10}\n" +
	     "\\def\\height{10}\n" +
	     "\\draw[step=1mm, line width=0.2mm, black!20!white] (0,0) grid (\\width,\\height);\n"+
	     "\\draw[step=5mm, line width=0.2mm, black!40!white] (0,0) grid (\\width,\\height);\n"+
	     "\\draw[step=1cm, line width=0.2mm, black!60!white] (0,0) grid (\\width,\\height);\n";
		PGFPlot_TeX += "%\n%\n%\n";

		PGFPlot_TeX += this.create_pgfplot_header();

		PGFPlot_TeX += "\\addplot[no marks, black, very thick]\n";
		PGFPlot_TeX += "coordinates {\n";
		PGFPlot_TeX += coordinates;
		PGFPlot_TeX += "\n};\n";
		PGFPlot_TeX += "\\end{axis}\n";
		PGFPlot_TeX += "\\end{tikzpicture}\n";
		return PGFPlot_TeX;
	};


//
// Helpers
//
ModelleertaalApp.prototype.reduce_rows = function(rows, Nresults) {
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
    this.rowinc = rowinc;
    return rows.filter(select_rows);
  }
  this.rowinc = 1;
  return rows;
};


ModelleertaalApp.prototype.get_result_rowIndex = function(rowIndex_plot) {
  // map row index from this.scatter_plot (reduced number of rows)
  // back to this.results

  rowIndex = this.rowinc * rowIndex_plot;
  if (rowIndex < this.results.length) {
    return rowIndex;
  } else {
    return this.results.length - 1;
  }
};


ModelleertaalApp.prototype.highlight_error = function(line, editor_name) {

  if (!this.CodeMirrorActive) return false;

  var self_editor;

  if (editor_name === 'modelregels') {
     self_editor = this.modelregels_editor;
   } else if (editor_name === 'startwaarden') {
     self_editor = this.startwaarden_editor;
   } else {
     console.log('highlight_error: no such editor: '+editor_name);
     return false;
   }

  self_editor.addLineClass(line-1, 'background', 'CodeMirror-matchingtag');
  setTimeout(function() {
      self_editor.removeLineClass(line-1, 'background', 'CodeMirror-matchingtag');
    }, 7000);
};


ModelleertaalApp.prototype.remove_highlight_trace = function(line) {

  if (!this.CodeMirrorActive) return false;
  var self_editor = this.modelregels_editor;

  if (this.at_line !== undefined)
      // remove current highlighted line
      self_editor.removeLineClass(this.at_line, 'background', 'CodeMirror-activeline-background');
};


ModelleertaalApp.prototype.highlight_trace = function(line) {

  if (!this.CodeMirrorActive) return false;
  var self_editor = this.modelregels_editor;

  if (this.at_line !== undefined)
      // remove current highlighted line
      self_editor.removeLineClass(this.at_line, 'background', 'CodeMirror-activeline-background');

  this.at_line = line-1;
  self_editor.addLineClass(this.at_line, 'background', 'CodeMirror-activeline-background');
/*  setTimeout(function() {
      self_editor.removeLineClass(line-1, 'background', 'CodeMirror-matchingtag');
    }, 7000); */
};


exports.ModelleertaalApp = ModelleertaalApp;
