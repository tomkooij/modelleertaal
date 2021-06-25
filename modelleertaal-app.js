var evaluator_js = require('./evaluator.js');
var Blob = require('blob');
var FileSaver = require('file-saver');
// this also depends on:
// jQuery
// jQuery.Flot
// These libs are not included, because the Flot libray does not play well
// with browserify.
// Include this in the HTML with:
//<script src="scripts/jquery-3.2.1.min.js"></script>
//<script src="scripts/jquery.flot.js"></script>

//jshint devel:true
//jshint es5:true
//jshint loopfunc: true

/* version history: CHANGELOG.md */
var version = "v5.4 dev 25jun2021";

function ModelleertaalApp(params) {

  this.debug = params.debug || false;
  this.version = version;
  console.log('Modelleertaal App. ' + version + '. Debug = ' + this.debug);

  this.model_index = params.model_index || false;
  console.log('Model_index: ', this.model_index);

  this.base_url = params.base_url || '';
  this.rel_url = params.rel_url || 'index.html';

  if (this.debug) {
    console.log('base_url: ', base_url);
    console.log('rel_url:' , rel_url);
  }

  this.CodeMirror = params.CodeMirror || true;
  this.CodeMirrorActive = false;

  this.yaxis_autoscale = false;  // try to include origin (y=0) by default

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
  this.dom_download_svg = "#download_svg";
  this.dom_download_svg_fn = "#svg_filename";
  this.dom_clickdata = "#clickdata";
  this.dom_x_var = "#x_var";
  this.dom_y_var = "#y_var";
  this.dom_select_graph = "#select_graph";
  this.dom_model_keuze = "#model_keuze";
  this.dom_permalink = "#permaklink";
  this.dom_legend = "#legend";

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
  this.load_model();

  this.max_rows_in_plot = 200;
  this.precision = 4;

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
        console.log('Plot clicked. No results --> Run first');
        self.N = Number($(self.dom_nbox).val());
        self.run();
    }
    self.do_plot();

    //self.print_status("Plot OK.");
  });

  $(this.dom_model_keuze).change(function () {
    self.dropdown_load_model();
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
  $(this.dom_download_svg).click(function() {
    self.download_svg();
  });

  $(this.dom_fileinput).change(function(event) {
    self.read_file(event);
  });

  this.multiplot = false;
  $("#multiplot").click(function() {
      self.multiplot = !self.multiplot;
      self.set_graph_menu();
  });

}

ModelleertaalApp.prototype.load_model = function() {
    // called from $(document).ready();

    // listen to URL index.html#model=model_naam&N=100 type URL
    // https://stackoverflow.com/a/44169739/4965175
    var hash = window.location.hash.substr(1);
    var url_params = hash.split('&').reduce(function(result, item) {
        var parts = item.split('=');
        result[parts[0]] = parts[1];
        return result;
    }, {});
    console.log("params passed in URL", url_params);

    var N_preset = url_params.N || N_default || false;
    if (N_preset) {
        $("#NBox").val(N_preset);
    }

    this.dropdown_update();
    var model_preselected = url_params.model || false;
    if (model_preselected) {
        // try to load model passed with model=... parameter
        var model_url = 'modellen/' + model_preselected + '.xml';
        this.load_model_xml_from_url(model_url);
        var reverse_dropdown_val = model_index.findIndex(function(element) {
            return element.url == model_url;
        });
        // set dropdown to selected model
        $(this.dom_model_keuze).val(reverse_dropdown_val);
    } else {
        // lees keuze uit drop-down en kies juiste url
        this.dropdown_load_model();
    }
};




ModelleertaalApp.prototype.print_status = function(status, error) {
  $(this.dom_status).html(status);
  if (typeof error != "undefined") $(this.dom_graph).html(error).css("font-family", "monospace");
};


ModelleertaalApp.prototype.load_model_xml_from_url = function(url) {
    var self = this;
    $.ajax({
        url: url,
        dataType: "text",
        success: function(data) {
            self.read_model_from_xml(data);
            self.init_app();
        }, // succes();
        error: function(xhr, ajaxOptions, thrownError) {
            if (xhr.status === 0) {
                alert("Kan model " + url + " niet laden.\nBestaat het model?\nOffline? Zet CORS protection uit");
            } else {
                alert(thrownError);
            }
            $(self.dom_graph).html("Model niet geladen! FOUT.");
            self.print_status("Status: ERROR.");
        } // error();
    }); //.ajax
};


ModelleertaalApp.prototype.dropdown_update = function() {
    // maak het drop-down modelkeuze menu uit model.js
    $(this.dom_model_keuze).empty();
    for (var i = 0; i < this.model_index.length; i++) {
        $('<option/>').val(i).text(this.model_index[i].title).appendTo(this.dom_model_keuze);
    }
};


ModelleertaalApp.prototype.dropdown_load_model = function() {

    //var model_keuze = $("#model_keuze").val();
    var model_keuze = $(this.dom_model_keuze).val();

    url = this.model_index[model_keuze].url;
    var myRe = /\/([^.]+)/g;

    var rel_link = this.rel_url + 'index.html#model=' + myRe.exec(url)[1];
    var permalink = this.base_url + rel_link;

    // verander de URL onder de knop "link"
    $(this.dom_permalink).attr('href', permalink);

    // verander de URL in de browser (history)
    if (history.replaceState) {
        window.history.replaceState("", "Modelleertaal webapp", rel_link);
    } else {
        document.location.href = rel_link;
    }

    this.load_model_xml_from_url(url);
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

  // copy N from app, if exist, write into Model
  if (this.N !== undefined) {
    this.model.N = this.N;
  }

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


ModelleertaalApp.prototype.download_svg = function() {
  // download SVG Plot.

  var filename = $(this.dom_download_svg_fn).val();
  this.save_string(this.create_svgplot(), filename);
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

  if (!this.results_available()) {
    return;
  }

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

    var res;
    for (var j = 0; j < this.results[rowIndex].length; j++) {
      res = this.results[rowIndex][j];
      if (typeof(res) === 'number') {
          res = fix(res.toPrecision(this.precision));
      } else {  // -- boolean
          if (res) {
            res = 'Waar';
          } else {
            res = 'Onwaar';
          }
      }
      row.append($('<td>').text(res));
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

  if (!this.results_available()) {
    //alert('Geen resultaten. Druk eerst op Run!');
    console.error('No results! cannot plot');
    return false;
  }

  if (this.multiplot) {
    this.do_multi_plot();
    return;
  }

  // if set to "auto" set axis to default settings (x,t)
  this.set_axis_to_defaults();
  // show "meerdere grafieken button"
  this.toggle_plot_mode();

  var results = this.reduce_rows(this.results, this.max_rows_in_plot);

  var current_plot = {
      data: [],
      color: 'blue',
      label: this.allVars[yvar_colidx]
    };
  var previous_plot = {
      data: this.previous_plot,
      color: '#d3d3d3', // light-gray
      label: ''
  };

  for (var i = 0; i < results.length; i++) {
    current_plot.data.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
  }
  // FIXME: left over from (very!) old code...
  this.scatter_plot = current_plot.data;

  var dataset = [];
  dataset.push(previous_plot);
  dataset.push(current_plot);

  $(this.dom_graph).empty(); // verwijder text enzo
  $(this.dom_clickdata).empty();
  this.plot_graph(dataset);
  this.previous_plot = this.scatter_plot;
}; // do_plot


ModelleertaalApp.prototype.results_available = function() {
  if (this.results.length === 0) {
    return false;
  }
  return true;
}; // results_available


ModelleertaalApp.prototype.toggle_plot_mode = function() {

  if (!this.results_available()) {
    $("#multiplot").empty();
    $("#multiplot").removeClass("multiplot");
    $("#legend").css('display','none');  //hide legend
    return;
  }

  var msg = "";
  if (this.multiplot) {
     msg = 'Terug naar enkele grafiek';
  } else {
     msg = 'Plot meerdere grafieken';
  }

  $("#multiplot").html(msg).addClass("multiplot");
  $("#legend").css('display','inline');

}; // set_plot.mode

ModelleertaalApp.prototype.set_graph_menu = function() {
  var self = this;

  if (this.multiplot) {
    // build multi variable checkboxes for y-var
    $(this.dom_select_graph).empty();

    for (var i = 0; i < this.allVars.length; i++) {
      var checked_y = (i == yvar_colidx) ? true : false;
      var checked_x = (i == xvar_colidx) ? true : false;
      $(this.dom_select_graph).append($("<input>").attr("type", "checkbox")
            .attr("checked", checked_y).attr("idx_yvar", i)
            .attr("id", "id_" + this.allVars[i]));
      $(this.dom_select_graph).append($("<label>").text(this.allVars[i]));
      $(this.dom_select_graph).append($('<br>'));
    }
    $(this.dom_select_graph).find("input:checkbox").click(function () {
      // toglle autoscale on/off and replot!
      self.do_plot();
    });
  } else {
    // reset single dropdown menu for y-var.
    $(this.dom_select_graph).empty();
    $(this.dom_select_graph).append($("<select>").attr("id", "y_var"));
    $(this.dom_legend).empty();
    this.reset_axis_dropdown();
  }
  this.toggle_plot_mode();

}; // create_graph_checkboxes


ModelleertaalApp.prototype.do_multi_plot = function() {

  var self = this;

  // qualitative colour scheme that is colour-blind safe.
  // https://personal.sron.nl/~pault/#sec:qualitative
  // blue, cyan, green, yellow, red, purple, grey
  var graph_colors = ['blue', '#6ce', '#283', '#cb4', '#e67','#a37', '#bbb'];

  // FIXME cache this!!!
  var results = this.reduce_rows(this.results, this.max_rows_in_plot);
  var dataset = [];

  // x-var
  xvar_colidx = parseInt($(this.dom_x_var).val());
  xvar_colidx = (!isNaN(xvar_colidx)) ? xvar_colidx : 0;
  $(this.dom_x_var).val(xvar_colidx);

  var n = 0;
  // y-vars
  $("#select_graph").find("input:checked").each(function () {
    var ycol_idx = $(this).attr("idx_yvar");
    ycol_idx = parseInt(ycol_idx);
    if (isNaN(ycol_idx)) return ;
    var plot = {
        data: []
      };

    for (var i = 0; i < results.length; i++) {
      // FIXME xvar_colidx scope!!!!
      plot.data.push([results[i][xvar_colidx], results[i][ycol_idx]]);
    }
    plot.color = graph_colors[n];
    plot.label = self.allVars[ycol_idx];
    n += 1;
    dataset.push(plot);
	});
  $(this.dom_graph).empty(); // verwijder text enzo
  $(this.dom_clickdata).empty();
  this.plot_graph(dataset);

}; // do_multi_plot


ModelleertaalApp.prototype.set_axis_to_defaults = function() {
  // get column indices (in results array) of variables to plot
  xvar_colidx = parseInt($(this.dom_x_var).val());
  yvar_colidx = parseInt($(this.dom_y_var).val());

  // if undefined -> x first column, y second column of results
  xvar_colidx = (!isNaN(xvar_colidx)) ? xvar_colidx : 0;
  yvar_colidx = (!isNaN(yvar_colidx)) ? yvar_colidx : 1;

  // set column varnames in input fields
  $(this.dom_x_var).val(xvar_colidx);
  $(this.dom_y_var).val(yvar_colidx);
};


ModelleertaalApp.prototype.plot_graph = function(dataset) {

  var self = this;
  var plot_yaxis_min;

  var x_var_name = this.allVars[$(this.dom_x_var).val()];
  var y_var_name = this.allVars[$(this.dom_y_var).val()];

  // FIXME: Dit kan VEEL makkelijker en LEESBAARDER!
  function find_datasets_min_below_zero(ds) {
      var min = 0;
      var len_ds = ds.length;
      var val, i;
  	  for (i = 0; i < len_ds; i++ ) {
          val = find_dataset_min(ds[i]);
          if ( val < min ) {
  			       min = val;
  	          }
	    }
	    return min;
  }

  function find_dataset_min(d) {
      var min = Infinity;
      var len = d.data.length;
      var val;

  	  for ( var i = 0; i < len; i++ ) {
          val = d.data[i][1];
          if ( val < min ) {
  			       min = val;
  	          }
	    }
	    return min;
  }

  if (self.yaxis_autoscale) {
    plot_yaxis_min = undefined;  // use autoscale for y-axis
  } else {
    // plot the y-axis from min(0, minimum of dataset)
    // FIXME: Does not work for multiple datasets!!!!
    plot_yaxis_min = find_datasets_min_below_zero(dataset);
  }

  $(this.dom_graph).css("font-family", "sans-serif");

  function sciFormatter(val, axis) {
    // format large numbers in scientific notation: 1e6
    // probably *much* (much!) slower than the default tickformatter
    if (Math.abs(val) > 9e4)
        return val.toExponential(1);
    else
        //return val.toFixed(axis.tickDecimals);
        return $.plot.defaultTickFormatter(val, axis);
  }

  var legendContainer = document.getElementById("legend");

  var axis_font = {
    size: 12,
    lineHeight: 13,
    family: "sans-serif",
    variant: "small-caps",
    color: "#545454"
  };

  var plot_object = $.plot($(this.dom_graph), dataset, {
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
    xaxis: {
      font: axis_font,
      showTicks: false,
      tickFormatter: sciFormatter,
      axisLabel: x_var_name
    },
    yaxis: {
      font: axis_font,
      showTicks: false,
      position: 'left',
      tickFormatter: sciFormatter,
      min: plot_yaxis_min,
      axisLabel: y_var_name
    },
    legend: {
      show: (this.multiplot) ? true : null,
      container: legendContainer,
    },
    tooltip: {
      show: true,
      content: "%lx: %x.2, %s: %y.2"
    }
  }); // $.plot()

  $(this.dom_graph).bind("plotclick", function(event, pos, item) {
    if ((self.multiplot) || (item.seriesIndex == 1)) {
     // multiplot: click on all lines, single plot: do not allow click on previous plot
     var table = $('<table>').addClass('table');
     table.append(self.table_header());
     table.append(self.table_row(self.get_result_rowIndex(item.dataIndex)));
     $(self.dom_clickdata).html(table);
    }
  }); // $bind.("plotclick")

  // create clickable y-axis that toggles autoscale
  var axes = plot_object.getAxes();
  var axis = axes.yaxis;
  var box = axis.box;
  $("<div id='plot_yaxis' class='axisTarget' style='position:absolute; left:" + box.left + "px; top:" + box.top + "px; width:" + box.width +  "px; height:" + box.height + "px'></div>")
				.data("axis.direction", axis.direction)
				.data("axis.n", axis.n)
				.css({ backgroundColor: "#f00", opacity: 0, cursor: "pointer" })
				.appendTo(plot_object.getPlaceholder())
				.hover(
					function () { $(this).css({ opacity: 0.10 }); },
					function () { $(this).css({ opacity: 0 }); }
				)
				.click(function () {
          // toglle autoscale on/off and replot!
          self.yaxis_autoscale = !self.yaxis_autoscale;
          self.do_plot();
        });

  $("#plot_yaxis").hover(function() {
        $(this).css('cursor','pointer').attr('title', 'Klik op de as om de schaal te wijzigen (autoscale aan/uit).');
    });
}; // plot_graph()

ModelleertaalApp.prototype.set_max_rows_in_plot = function(max_rows) {
  this.max_rows_in_plot = max_rows;
};

ModelleertaalApp.prototype.set_precision = function(precision) {
  this.precision = precision;
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

  this.results = [];
  this.scatter_plot = [];
  this.previous_plot = [];
  this.has_run = false;
  this.tracing = false;

  // (re)set graph menu
  this.multiplot = false;
  this.set_graph_menu();
  $(this.dom_y_var).empty();
  $(this.dom_x_var).empty();
  $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
  $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  this.print_status("Status: Model geladen.", "Model geladen. Geen data. Druk op Run!");
  $(this.dom_datatable).empty();

};


//
// TSV -- use TSV instead of CSV to prevent , . decimal problems in Excel.
//
ModelleertaalApp.prototype.create_tsv = function() {
    var self = this;
    var tsv = '';

    tsv += this.allVars.join('\t'); //header row
    tsv += "\n";

    tsv += this.results.map(function(row ){
        return row.map(function(item) {
          return typeof(item) === 'number' ? item.toPrecision(self.precision) : item;
        }).join('\t');
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
			var units = {"x": "\\meter", "y": "\\meter", "h": "\\meter", "u": "\\meter",
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
		 "% this only works for graphs starting at (0,0)\n"+
		 "\\begin{axis}[x=1cm\/"+x_scale+", y=1cm\/"+y_scale+",\n"+
     "axis y line=left, axis x line=middle,\n"+
		 "enlargelimits=false, tick align=outside,\n "+
		 "xlabel={$"+x_var+"$ [\\si{"+x_unit+"}]},\n"+
		 "ylabel={$"+y_var+"$ [\\si{"+y_unit+"}]},\n"+
		 "% xtick={0, 1, 2, ..., 10},\n"+
		 "% ytick={0, 2, 4, ..., 20},\n"+
		 "xmin="+x_min+", xmax="+x_max+", ymin="+y_min+", ymax="+y_max+"]\n";
	};


ModelleertaalApp.prototype.create_pgfplot = function() {
		// Output PGFPlots plot

    if (!this.results_available()) {
      alert('Geen resultaten. Druk eerst op Run!');
      return false;
    }

    if (this.multiplot) {
      alert('Not Implemented! Dit werkt alleen met enkele grafiek');
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
       "\pgfplotsset{/pgf/number format/use comma}\n" +
			 "% draw 10x10cm millimeter paper.\n" +
			 "\\def\\width{10}\n" +
	     "\\def\\height{10}\n" +
	     "\\draw[step=1mm, line width=0.2mm, blue!20!white] (0,0) grid (\\width,\\height);\n"+
	     "\\draw[step=5mm, line width=0.2mm, blue!40!white] (0,0) grid (\\width,\\height);\n"+
	     "\\draw[step=1cm, line width=0.2mm, blue!60!white] (0,0) grid (\\width,\\height);\n";
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
// SVG
// 
ModelleertaalApp.prototype.create_svgplot = function() {
  // Output SVG plot

  if (!this.results_available()) {
    alert('Geen resultaten. Druk eerst op Run!');
    return false;
  }

  if (this.multiplot) {
    alert('Not Implemented! Dit werkt alleen met enkele grafiek');
    return false;
  }

  this.scatter_plot = [];

  this.set_axis_to_defaults();

  var results = this.reduce_rows(this.results, this.max_rows_in_plot);

  for (var i = 0; i < results.length; i++) {
    this.scatter_plot.push([results[i][xvar_colidx], results[i][yvar_colidx]]);
  }

  var coordinates = this.scatter_plot.map(function(d){
          return " "+d.join(',')+" ";
      }).join('\n');

  SVG_Plot = '<svg viewBox="0 0 100 100">\n';
  // graph
  SVG_Plot += '<polyline fill="none" stroke="black" '  ;                 
  SVG_Plot += 'points= "\n';
  SVG_Plot += coordinates; 
  SVG_Plot += ' "/>\n';
  SVG_Plot += '</svg>\n';
  
  return SVG_Plot;
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
