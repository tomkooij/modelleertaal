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

		console.log('Modelleertaal App. Debug = '+ this.debug);

		this.dom_modelregels = "#modelregels";
		this.dom_startwaarden = "#startwaarden";
		this.dom_status = "#status";
		this.dom_datatable = "#datatable";
		this.dom_graph = "#graph";
		this.dom_nbox = "#NBox";
		this.dom_run = "#run";
		this.dom_plot = "#plot";
		this.dom_open = "#open";

		this.previous_plot = [];

		// fix scope for binding functions to DOM
		// https://stackoverflow.com/questions/14535548/
		var self = this;

		$(this.dom_run).click(function() { self.run(); });

		$(this.dom_plot).click(function() {
			self.do_plot();
			self.print_status("Plot OK.");
		});

		$(this.dom_open).click(click_load_model);
}

ModelleertaalApp.prototype.print_status = function(txt) {
		console.log('print_status ');
		console.log(this);
		console.log('this.status = '+this.dom_status);
		console.log('this.run ='+this.dom_run);
		$(this.dom_status).html(txt);
};

ModelleertaalApp.prototype.read_model = function() {
		this.model = new evaluator_js.Model();
		this.model.modelregels = $(this.dom_modelregels).val();
		this.model.startwaarden = $(this.dom_startwaarden).val();
};

ModelleertaalApp.prototype.run = function() {

	this.print_status('Run!!!');
	console.log("DEBUG: run() called!");

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
	} catch(err) {
		this.print_status(err.message.replace(/\n/g,"<br>"));
		alert("Model niet in orde: \n"+err.message);
	}
	this.results = evaluator.run(N);

	this.print_status("Klaar na iteratie: " + this.results.length);
	console.log("Klaar na iteratie: " + this.results.length);

	// make table, plot
	allVars = evaluator.namespace.listAllVars();
	if (this.debug)
		console.log(allVars, allVars.length);

	// save chosen variable, try to plot same graph
	xvar_last = $('#x_var').find(":selected").text();
	yvar_last = $('#y_var').find(":selected").text();

	// (re)set varNames in drop-down select fields
	$('#y_var').empty();
	$('#x_var').empty();
	$('<option/>').val('').text('auto').appendTo('#x_var');
	$('<option/>').val('').text('auto').appendTo('#y_var');
	for (var i=0;i<allVars.length;i++){
		$('<option/>').val(i).text(allVars[i]).appendTo('#x_var');
		$('<option/>').val(i).text(allVars[i]).appendTo('#y_var');
	}

	// try to plot same graph: Reset axis to previous settings.
	idx = allVars.findIndex(function(s) { return s == xvar_last; } );
	if (idx != -1) $('#x_var').val(idx);
	idx = allVars.findIndex(function(s) { return s == yvar_last; } );
	if (idx != -1) $('#y_var').val(idx);

	this.print_table();
	this.do_plot();

}; // run()


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

	for (var k = 0; k < allVars.length; k++) {
		firstrow.append($('<th>').text(allVars[k]));
	}
	table.append(firstrow);

	for (var i = 0; i < dataset.length; i++) {
						var row = $('<tr>');
						row.append($('<td>').text(i));
						for (var j = 0; j < dataset[i].length; j++) {
								row.append($('<td>').text(dataset[i][j].toPrecision(4)));}
						table.append(row);

						if (limit != dataset.length && i == Math.floor(limit / 2) - 1) {
						 var truncrow = $('<tr>');
						 truncrow.append($('<td>')
														 .text('... Tabel ingekort. Klik voor meer rijen ...')
														 .attr('colspan', dataset.length + 1)
														 .css({'text-align': 'left',
																 'cursor': 'pointer'})
														 .click(function() {self.print_table(limit * 5);}));
						 table.append(truncrow);
						 i = dataset.length - 1 - Math.ceil(limit / 2);}
					}

	$(self.dom_datatable).html(table);
};

//
// Plotten
//
ModelleertaalApp.prototype.do_plot = function() {

				 var scatter_plot = [];

				 // get column indices (in results array) of variables to plot
				 xvar_colidx = $('#x_var').val();
				 yvar_colidx = $('#y_var').val();

				 // if undefined -> x first column, y second column of results
				 xvar_colidx  = (xvar_colidx) ? xvar_colidx : 0;
				 yvar_colidx  = (yvar_colidx) ? yvar_colidx : 1;

				 // set column varnames in input fields
				 $('#x_var').val(xvar_colidx);
				 $('#y_var').val(yvar_colidx);

				 Nresults = Math.min(this.results.length, 100);
				 this.results = reduce_rows(this.results, Nresults);

				 for (var i=0; i < this.results.length; i++) {
						 scatter_plot.push([this.results[i][xvar_colidx], this.results[i][yvar_colidx]]);
				 }
				 $(this.dom_graph).empty(); // verwijder text enzo
				 this.plot_graph(this.dom_graph, scatter_plot, this.previous_plot);
				 this.previous_plot = scatter_plot;
		 }; // do_plot

ModelleertaalApp.prototype.plot_graph = function(placeholder, dataset, previous_plot) {
			 console.log('plot_graph'+ placeholder);
			 $.plot($(placeholder), [
						 {data: previous_plot, color: '#d3d3d3'},
						 {data: dataset, color: 'blue'}],
						 {
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
											 axisLabel: allVars[$('#x_var').val()]
									 }],
									 yaxes: [{
											 position: 'left',
											 axisLabel: allVars[$('#y_var').val()]
									 }]
			 }); // $.plot()

			 $(placeholder).bind("plothover", function (event, pos, item) {
				 var str = "(" + pos.x.toFixed(2) + ", " + pos.y.toFixed(2) + ")";
				 $("#hoverdata").text(str);
			 }); // $.bind("plothover")

			 $(placeholder).bind("plotclick", function (event, pos, item) {
				 if (item) {
					 var str = " - Click: (" + pos.x.toFixed(2) + ", " +
							pos.y.toFixed(2) + ")";
					 $("#clickdata").text(str);
				 }
			 }); // $bind.("plotclick")

		 }; // plot_graph()




		 //
		 // Helpers
		 //
		 			function reduce_rows(rows, Nresults) {
		 					// reduce resultsObject (large array) to length == Nresults

		 					var length = rows.length;
		 			    var rowinc = Math.floor(length / Nresults);

		 			    function select_rows(value, index) {
		 			        // select first row, last row and rows in between. Keep Nrows+1 rows.
		 			        if (index === 0 || index % rowinc === 0 || index == length-1) {
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



		 //
		 // Lees/Kies model
		 //
		 function Initialize_model(data) {
		 		model = new evaluator_js.Model();
		 		model.parseBogusXMLString(data);
		 		$("#modelregels").val(model.modelregels);
		 		$("#startwaarden").val(model.startwaarden);
		 		$('#y_var').empty();
		 		$('#x_var').empty();
		 		$('<option/>').val('').text('auto').appendTo('#x_var');
		 		$('<option/>').val('').text('auto').appendTo('#y_var');
		 		$("#graph").html("Model geladen. Geen data. Druk op Run!");
		 		$("#output").empty();
		 		$("#status").html("Status: Model geladen.");
		 		$("#datatable").empty();
		 		previous_plot = [];
		 }

		 document.getElementById('fileinput').addEventListener('change', readFile, false);
		 function readFile(evt) {
		 	var f = evt.target.files[0];

		 	if (f) {
		 		var r = new FileReader();
		 		r.onload = function(e) {
		 		Initialize_model(e.target.result);
		 	  };
		 		r.readAsText(f);
		 	}
		 }

		 $(document).ready(function() {
		 	console.log("Modelleertaal - ",version);
		 	update_model_selection();
		 	click_load_model();
		 });


		 var update_model_selection = function() {
		 		// maak het drop-down modelkeuze menu uit model.js
		 		$('#model_keuze').empty();
		 		for (var i=0;i<model_index.length;i++){
		 			$('<option/>').val(i).text(model_index[i].title).appendTo('#model_keuze');
		 		}
		 };

		 var click_load_model = function () {
		 		// lees keuze uit drop-down en kies juiste url
		 		model_keuze = $("#model_keuze").val();

		 		// defined in modellen/models.js
		 		url = model_index[model_keuze].url;

		 					$.ajax({
		 							url : url,
		 							dataType: "text",
		 							success : function (data) {
		 									Initialize_model(data);
		 								}, // succes();
		 								error: function (xhr, ajaxOptions, thrownError) {
		 										if (xhr.status === 0) {
		 											alert("Kan model "+url+" niet laden.\nBestaat het model?\nOffline? Probeer Edge of =Firefox");
		 										} else {
		 											alert(thrownError);
		 										}
		 										$("#graph").html("Model niet geladen! FOUT.");
		 										$("#output").empty();
		 										$("#status").html("Status: ERROR.");
		 		 						} // error();
		 					}); //.ajax
		 		}; // click_load_model


		 $("#download").click(function() {
		 		// requires FileSaver.js and Blob.js
		 		// (Blob() not supported on most mobile browsers)
		 		model = new evaluator_js.Model();
		 		model.modelregels = $("#modelregels").val();
		 		model.startwaarden = $("#startwaarden").val();

		 		var blob = new Blob([model.createBogusXMLString()], {type: "text/plain;charset=utf-8"});
		 		FileSaver.saveAs(blob, "model.xml");
		 });





exports.ModelleertaalApp = ModelleertaalApp;
