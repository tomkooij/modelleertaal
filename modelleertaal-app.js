var evaluator_js = require('./evaluator.js');
var autoplot = require('./autoplot.js');
var grafisch = require('./grafisch.js');
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
//jshint browser:true
/* globals $, CodeMirror */

/* version history: CHANGELOG.md */
var version = "v6.0";

var COLOR_PLOT = '#1d4ed8';
var COLOR_PREVIOUS = '#c3c8d1';
// qualitative colour scheme that is colour-blind safe.
// https://personal.sron.nl/~pault/#sec:qualitative
// blue, cyan, green, yellow, red, purple, grey
var COLORS_MULTIPLOT = ['#4477aa', '#66ccee', '#228833', '#ccbb44', '#ee6677', '#aa3377', '#bbbbbb'];

var N_MAX = 1e6;


function ModelleertaalApp(params) {

  params = params || {};
  var self = this;

  this.debug = params.debug || false;
  this.version = version;
  if (this.debug) console.log('Modelleertaal App. ' + version);

  this.model_index = params.model_index || [];
  this.N_default = params.N_default || window.N_default || 1000;

  this.CodeMirror = (params.CodeMirror !== false);
  this.CodeMirrorActive = false;

  this.yaxis_autoscale = false;  // try to include origin (y=0) by default
  this.max_rows_in_plot = 500;
  this.precision = 4;

  this.dom_modelregels = "#modelregels";
  this.dom_startwaarden = "#startwaarden";
  this.dom_status = "#status_bar";
  this.dom_message = "#message";
  this.dom_datatable = "#datatable";
  this.dom_graph = "#graph";
  this.dom_graph_tabs = "#graph_tabs";
  this.dom_graph_note = "#graph_note";
  this.dom_results = ".results";
  this.dom_nbox = "#NBox";
  this.dom_nbox_continue = "#NBoxContinue";
  this.dom_run = "#run";
  this.dom_continue = "#continue";
  this.dom_trace = "#trace";
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
  this.dom_y_checks = "#y_checks";
  this.dom_multiplot = "#multiplot";
  this.dom_yaxis_zero = "#yaxis_zero";
  this.dom_model_keuze = "#model_keuze";
  this.dom_permalink = "#permalink";
  this.dom_titel = "#model_titel";
  this.dom_grafisch = "#grafisch_model";
  this.dom_grafisch_svg = "#grafisch_svg";
  this.dom_grafisch_tabel = "#grafisch_tabel";
  this.dom_download_grafisch = "#download_grafisch";
  this.dom_grafisch_reset = "#grafisch_herstel";
  this.grafisch_moved = {};   // positions of elements dragged by the user
  this.model_title = '';

  this.read_model();

  function run_from_keyboard() {
    $(self.dom_run).click();
  }

  if ((this.CodeMirror) && (typeof(CodeMirror) == 'function')) {
    var codemirror_options = {
      lineNumbers: true,
      lineWrapping: true,
      viewportMargin: Infinity,
      mode: "modelleertaal",
      extraKeys: {
        "Ctrl-Enter": run_from_keyboard,
        "Cmd-Enter": run_from_keyboard
      }
    };
    this.modelregels_editor = CodeMirror.fromTextArea($(this.dom_modelregels)[0], codemirror_options);
    this.startwaarden_editor = CodeMirror.fromTextArea($(this.dom_startwaarden)[0], codemirror_options);
    this.CodeMirrorActive = true;

    var on_change = function(editor, change) {
      if (change.origin != 'setValue') self.on_model_edited();
    };
    this.modelregels_editor.on('change', on_change);
    this.startwaarden_editor.on('change', on_change);
  } else {
    this.CodeMirror = false;
    this.CodeMirrorActive = false;
    $(this.dom_modelregels + ',' + this.dom_startwaarden).on('input', function() {
      self.on_model_edited();
    });
  }

  $(document).on('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key == 'Enter' && !event.isDefaultPrevented()) {
      event.preventDefault();
      run_from_keyboard();
    }
  });

  // (re)set the app
  this.init_app();
  this.load_model();

  $(this.dom_run).click(function() {
    // count model run as pageview to #run in goatcounter
    if (window.goatcounter !== undefined && window.goatcounter.count) {
      window.goatcounter.count({
        path: location.pathname + '#run',
      });
    }
    self.run();
  });

  $(this.dom_continue).click(function() {
    self.continue_run();
  });

  $(this.dom_trace).click(function() {
    self.trace();
  });

  $(this.dom_nbox + ',' + this.dom_nbox_continue).on('keydown', function(event) {
    if (event.key == 'Enter') {
      event.preventDefault();
      $(this.id == 'NBox' ? self.dom_run : self.dom_continue).click();
    }
  });

  $(this.dom_model_keuze).change(function() {
    if (self.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
        'Als je een ander model kiest, gaan je wijzigingen verloren.\n\nAnder model laden?')) {
      $(this).val(self.dropdown_value);
      return;
    }
    self.dropdown_load_model();
  });

  $(window).on('hashchange', function() {
    // user opens another link (#model=...) in the same tab
    var url_params = self.parse_url_hash();
    if ((url_params.model || url_params.code) && !self.is_modified()) self.load_model();
  });

  $(window).on('beforeunload', function(event) {
    if (self.is_modified()) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  });

  $(this.dom_titel).on('input', function() {
    self.update_document_title();
  });

  $('#toggle_titel').click(function() {
    // titel is verborgen totdat de gebruiker hem wil aanpassen
    var row = $('#titel_rij');
    var open = row.prop('hidden');
    row.prop('hidden', !open);
    $(this).attr('aria-expanded', String(open)).html(open ? 'Pas titel aan &#9652;' : 'Pas titel aan &#9662;');
    if (open) $(self.dom_titel).focus().select();
  });

  $(this.dom_permalink).click(function(event) {
    event.preventDefault();
    self.copy_share_url();
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

  // grafisch model: drawn from the text of the model (no Run needed)
  $(this.dom_grafisch).on('toggle', function() {
    if (this.open) self.draw_grafisch_model();
  });
  $(this.dom_download_grafisch).click(function() {
    self.download_grafisch_model();
  });
  $(this.dom_grafisch_reset).click(function() {
    self.grafisch_moved = {};
    self.draw_grafisch_model();
  });

  // drag elements of the grafisch model. Arrows and pipes are drawn again from the new positions.
  var drag = null, frame = null;
  $(this.dom_grafisch_svg).on('pointerdown', '[data-id]', function(event) {
    var e = event.originalEvent;
    if (e.button !== 0 || !self.grafisch_layout) return;
    var id = $(this).attr('data-id');
    var pos = self.grafisch_layout.pos;
    if (!pos[id]) return;
    var m = self.grafisch_point(e);
    // a toestandsvariabele takes its flows to and from a cloud along (pipe stays straight)
    var ids = [id];
    if (self.grafisch_g.elements[id] && self.grafisch_g.elements[id].kind == 'stock') {
      self.grafisch_g.flows.forEach(function(f) {
        if (f.to == id && !f.from) ids.push(f.id, f.id + ':src');
        if (f.from == id && !f.to) ids.push(f.id, f.id + ':dst');
      });
    }
    drag = {ids: ids, x: m.x, y: m.y, start: ids.map(function(k) { return {x: pos[k].x, y: pos[k].y}; })};
    e.preventDefault();
  });
  $(window).on('pointermove', function(event) {
    if (!drag) return;
    var m = self.grafisch_point(event.originalEvent);
    var pos = self.grafisch_layout.pos;
    drag.ids.forEach(function(k, n) {
      pos[k].x = Math.round(drag.start[n].x + m.x - drag.x);
      pos[k].y = Math.round(drag.start[n].y + m.y - drag.y);
      self.grafisch_moved[k] = {x: pos[k].x, y: pos[k].y};
    });
    if (!frame) {
      frame = window.requestAnimationFrame(function() {
        frame = null;
        self.render_grafisch_model();
      });
    }
  });
  $(window).on('pointerup pointercancel', function() {
    drag = null;
  });

  $(this.dom_fileinput).change(function(event) {
    self.read_file(event);
  });

  //
  // graph controls
  //
  $(this.dom_x_var).change(function() {
    self.xvar = $(this).val();
    self.user_axes = true;
    self.do_plot();
  });

  $(this.dom_y_var).change(function() {
    self.yvar = $(this).val();
    self.user_axes = true;
    self.do_plot();
  });

  $(this.dom_y_checks).on('change', 'input', function() {
    self.multi_yvars = $(self.dom_y_checks).find('input:checked').map(function() {
      return $(this).val();
    }).get();
    self.do_plot();
  });

  $(this.dom_multiplot).change(function() {
    self.multiplot = $(this).prop('checked');
    if (self.multiplot && self.multi_yvars.indexOf(self.yvar) == -1) {
      self.multi_yvars.push(self.yvar);
    }
    self.update_axis_controls();
    self.do_plot();
  });

  $(this.dom_yaxis_zero).change(function() {
    self.yaxis_autoscale = !$(this).prop('checked');
    self.do_plot();
  });

  $(this.dom_graph_tabs).on('click', 'button', function() {
    var graph = self.graphs[$(this).data('index')];
    if (!graph) return;
    self.xvar = graph.x;
    self.yvar = graph.y;
    self.user_axes = true;
    self.multiplot = false;
    self.update_axis_controls();
    self.do_plot();
  });

  $(this.dom_graph).on("plotclick", function(event, pos, item) {
    if (!item || item.series.mt_previous) return;
    var table = $('<table>').addClass('table');
    table.append(self.table_header());
    table.append(self.table_row(self.get_result_rowIndex(item.dataIndex)));
    $(self.dom_clickdata).html($('<div>').addClass('table_scroll').append(table));
  });

  var resize_timer;
  $(window).on('resize', function() {
    clearTimeout(resize_timer);
    resize_timer = setTimeout(function() {
      if (self.results_available()) self.do_plot();
    }, 150);
  });
}


//
// Loading / saving models
//
ModelleertaalApp.prototype.parse_url_hash = function() {
  // listen to URL index.html#model=model_naam&N=100 type URL
  // https://stackoverflow.com/a/44169739/4965175
  var hash = window.location.hash.substr(1);
  return hash.split('&').reduce(function(result, item) {
    var parts = item.split('=');
    result[parts[0]] = parts[1];
    return result;
  }, {});
};


ModelleertaalApp.prototype.load_model = function() {

  var url_params = this.parse_url_hash();
  if (this.debug) console.log("params passed in URL", url_params);

  if (url_params.N && isFinite(Number(url_params.N))) {
    this.N_default = Number(url_params.N);
  }
  $(this.dom_nbox).val(this.N_default);

  this.dropdown_update();

  if (url_params.code) {
    // complete model in URL (made with "Deel link")
    try {
      var shared = JSON.parse(decode_base64url(url_params.code));
      this.model = new evaluator_js.Model();
      this.model.modelregels = String(shared.m || '');
      this.model.startwaarden = String(shared.s || '');
      if (shared.N) this.model.N = Number(shared.N);
      this.model_title = shared.t ? String(shared.t) : 'Gedeeld model';
      $(this.dom_model_keuze).find('option[value="shared"]').remove();
      $('<option/>').val('shared').text(this.model_title + ' (uit link)').prependTo(this.dom_model_keuze);
      $(this.dom_model_keuze).val('shared');
      this.dropdown_value = 'shared';
      this.init_app();
      return;
    } catch (err) {
      console.error('Kan model uit link niet lezen', err);
    }
  }

  if (url_params.model) {
    // try to load model passed with model=... parameter
    var model_url = 'modellen/' + decodeURIComponent(url_params.model) + '.xml';
    var index = -1;
    for (var i = 0; i < this.model_index.length; i++) {
      if (this.model_index[i].url == model_url) index = i;
    }
    if (index != -1) {
      // set dropdown to selected model
      $(this.dom_model_keuze).val(index);
      this.dropdown_value = String(index);
      this.model_title = this.model_index[index].title;
    } else {
      this.model_title = decodeURIComponent(url_params.model);
    }
    this.load_model_xml_from_url(model_url);
  } else {
    // lees keuze uit drop-down en kies juiste url
    this.dropdown_load_model();
  }
};


ModelleertaalApp.prototype.print_status = function(status) {
  $(this.dom_status).text(status);
};


ModelleertaalApp.prototype.show_message = function(type, title, text) {
  // type: 'error', 'warning' or 'info'
  $(this.dom_message).removeClass('error warning info').addClass(type).empty()
    .append($('<strong>').text(title))
    .append($('<span>').text(text))
    .show();
};


ModelleertaalApp.prototype.clear_message = function() {
  $(this.dom_message).hide().empty();
};


ModelleertaalApp.prototype.load_model_xml_from_url = function(url) {
  var self = this;
  $.ajax({
    url: url,
    dataType: "text",
    success: function(data) {
      self.read_model_from_xml(data);
      self.init_app();
    },
    error: function(xhr) {
      var text = "Het model '" + url + "' kan niet geladen worden.";
      if (xhr.status === 0 && window.location.protocol == 'file:') {
        text += " Open de webapp via een webserver (bijvoorbeeld: python -m http.server).";
      } else if (xhr.status == 404) {
        text += " Het bestand bestaat niet.";
      }
      self.show_message('error', 'Model niet geladen', text);
      self.print_status("Model niet geladen.");
    }
  });
};


ModelleertaalApp.prototype.dropdown_update = function() {
  // maak het drop-down modelkeuze menu uit model.js
  $(this.dom_model_keuze).empty();
  for (var i = 0; i < this.model_index.length; i++) {
    $('<option/>').val(i).text(this.model_index[i].title).appendTo(this.dom_model_keuze);
  }
};


ModelleertaalApp.prototype.model_name_from_url = function(url) {
  // modellen/naam.xml --> naam
  var match = /\/([^.\/]+)\.xml$/.exec(url);
  return match ? match[1] : null;
};


ModelleertaalApp.prototype.dropdown_load_model = function() {

  var model_keuze = $(this.dom_model_keuze).val();
  this.dropdown_value = model_keuze;
  if (!this.model_index[model_keuze]) return;

  var url = this.model_index[model_keuze].url;
  var name = this.model_name_from_url(url);
  this.model_title = this.model_index[model_keuze].title;

  // verander de URL in de browser (history)
  if (name && window.history.replaceState) {
    window.history.replaceState("", "Modelleertaal webapp", '#model=' + name);
  }

  // count model reload as pageview in goatcounter
  if (window.goatcounter !== undefined && window.goatcounter.count) {
    window.goatcounter.count({
      path: location.pathname,
    });
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


ModelleertaalApp.prototype.is_modified = function() {
  // has the user changed the model since it was loaded (or saved)?
  if (!this.loaded) return false;
  var current = {};
  if (this.CodeMirrorActive) {
    current.modelregels = this.modelregels_editor.getValue();
    current.startwaarden = this.startwaarden_editor.getValue();
  } else {
    current.modelregels = $(this.dom_modelregels).val();
    current.startwaarden = $(this.dom_startwaarden).val();
  }
  function normalize(s) {
    return String(s).replace(/\r/g, '').replace(/\s+$/, '');
  }
  return normalize(current.modelregels) != normalize(this.loaded.modelregels) ||
         normalize(current.startwaarden) != normalize(this.loaded.startwaarden);
};


ModelleertaalApp.prototype.on_model_edited = function() {
  // called on every change in the editors.
  var self = this;
  this.remove_highlight_error();
  if (this.grafisch_open()) {
    clearTimeout(this.grafisch_timer);
    this.grafisch_timer = setTimeout(function() { self.draw_grafisch_model(); }, 400);
  }
  if (this.results_available() && !this.stale) {
    this.set_stale(true);
    this.print_status("Model gewijzigd. Druk op Run.");
  }
};


ModelleertaalApp.prototype.grafisch_open = function() {
  var details = $(this.dom_grafisch)[0];
  return details !== undefined && details.open;
};


ModelleertaalApp.prototype.analyse_grafisch_model = function() {
  // grafisch.js analysis of the model in the editors. Throws on syntax errors.
  this.read_model();
  var ev = new evaluator_js.ModelregelsEvaluator(this.model, false);
  return grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
};


ModelleertaalApp.prototype.draw_grafisch_model = function() {
  // draw the model as a Coach style stock-flow diagram (see grafisch.js)
  var svg = $(this.dom_grafisch_svg), tabel = $(this.dom_grafisch_tabel);
  var g;
  try {
    g = this.analyse_grafisch_model();
  } catch (err) {
    svg.empty().append($('<div>').addClass('placeholder')
      .text('Geen grafisch model: ' + (err.message || 'fout in het model') + ''));
    tabel.empty();
    return;
  }
  this.grafisch_g = g;
  this.grafisch_layout = grafisch.layout(g);
  // keep the positions the user dragged (while editing the same model)
  var pos = this.grafisch_layout.pos;
  for (var id in this.grafisch_moved) {
    if (this.grafisch_moved.hasOwnProperty(id) && pos[id]) {
      pos[id].x = this.grafisch_moved[id].x;
      pos[id].y = this.grafisch_moved[id].y;
    }
  }
  this.grafisch_bounds = null;
  this.render_grafisch_model();
  var table = $('<table>');
  grafisch.table(g).forEach(function(row) {
    table.append($('<tr>')
      .append($('<td>').text(row.kind))
      .append($('<td>').append($('<b>').text(row.name)))
      .append($('<td>').text(row.definition)));
  });
  tabel.empty().append(table);
};


ModelleertaalApp.prototype.render_grafisch_model = function() {
  // draw this.grafisch_g with the (dragged) positions in this.grafisch_layout.
  // The drawing only grows while dragging, so it does not jump under the mouse.
  var opts = {bounds: this.grafisch_bounds};
  $(this.dom_grafisch_svg).html(grafisch.toSVG(this.grafisch_g, this.grafisch_layout, opts));
  this.grafisch_bounds = opts.used;
};


ModelleertaalApp.prototype.grafisch_point = function(e) {
  // mouse/touch position in SVG coordinates
  var svg = $(this.dom_grafisch_svg).find('svg')[0];
  var pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};


ModelleertaalApp.prototype.download_grafisch_model = function() {
  // download with the positions as shown (dragged by the user)
  var g = this.grafisch_g, lay = this.grafisch_layout;
  if (!g || !this.grafisch_open()) {
    try {
      g = this.analyse_grafisch_model();
    } catch (err) {
      this.show_error(err);
      return;
    }
    lay = undefined;
  }
  this.save_string('<?xml version="1.0" encoding="UTF-8"?>\n' + grafisch.toSVG(g, lay), 'grafisch_model.svg');
};


ModelleertaalApp.prototype.set_stale = function(stale) {
  // results on screen do not belong to the model in the editor (anymore)
  this.stale = stale;
  $(this.dom_results).toggleClass('stale', stale);
  $(this.dom_run).toggleClass('attention', stale);
};


ModelleertaalApp.prototype.read_file = function(evt) {
  var self = this;
  var f = evt.target.files[0];

  if (f) {
    var r = new FileReader();
    r.onload = function(e) {
      self.read_model_from_xml(e.target.result);
      if (!self.model.modelregels && !self.model.startwaarden) {
        self.show_message('error', 'Bestand niet gelezen',
          "'" + f.name + "' is geen model van de modelleertaal webapp.");
        return;
      }
      self.model_title = f.name.replace(/\.[^.]*$/, '');
      self.init_app();
      self.print_status("Model geladen uit " + f.name + ". Druk op Run.");
    };
    r.readAsText(f);
  }
  // allow to open the same file again
  $(this.dom_fileinput).val('');
};


ModelleertaalApp.prototype.download_model = function() {
  // download model in "BogusXML" format
  //  just a text file with XML like tags...

  var filename = $(this.dom_download_xml_fn).val();
  this.read_model();

  var N = Number($(this.dom_nbox).val());
  if (isFinite(N) && N > 0) this.model.N = N;

  this.save_string(this.model.createBogusXMLString(), filename);
  // model is saved: do not warn for unsaved changes
  this.loaded = {modelregels: this.model.modelregels, startwaarden: this.model.startwaarden};
};


ModelleertaalApp.prototype.share_url = function() {
  // link to this model. If the model was changed, the model is put in the link.
  var base = window.location.origin + window.location.pathname;
  var entry = this.model_index[this.dropdown_value];
  var title = this.get_title();

  if (entry && !this.is_modified() && title == entry.title) {
    return base + '#model=' + this.model_name_from_url(entry.url);
  }
  this.read_model();
  var shared = {m: this.model.modelregels, s: this.model.startwaarden};
  if (title) shared.t = title;
  var N = Number($(this.dom_nbox).val());
  if (isFinite(N) && N > 0) shared.N = N;
  return base + '#code=' + encode_base64url(JSON.stringify(shared));
};


ModelleertaalApp.prototype.get_title = function() {
  // title of the model (editable by the user, goes into the share link)
  return $.trim($(this.dom_titel).val() || '');
};


ModelleertaalApp.prototype.update_document_title = function() {
  var title = this.get_title();
  document.title = title ? title + ' - Modelleertaal' : 'Modelleertaal webapp';
};


ModelleertaalApp.prototype.copy_share_url = function() {
  var self = this;
  var url = this.share_url();

  function fallback() {
    window.prompt('Kopieer deze link naar het model:', url);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      self.print_status("Link naar dit model gekopieerd naar het klembord.");
    }, fallback);
  } else {
    fallback();
  }
};


ModelleertaalApp.prototype.download_pgfplot = function() {
  // save the plot in TikZ/PGFPlot format
  var data = this.create_pgfplot();
  if (data === false) return;
  this.save_string(data, $(this.dom_download_pgf_fn).val());
};


ModelleertaalApp.prototype.download_tsv = function() {
  // download the results in TSV format.
  if (!this.require_results()) return;
  this.save_string(this.create_tsv(), $(this.dom_download_tsv_fn).val());
};


ModelleertaalApp.prototype.download_svg = function() {
  // download SVG Plot.
  var data = this.create_svgplot();
  if (data === false) return;
  this.save_string(data, $(this.dom_download_svg_fn).val());
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


//
// Run
//
ModelleertaalApp.prototype.read_N = function(dom) {
  // read the number of iterations from input field. Return null if invalid
  var N = Number(String($(dom).val()).replace(',', '.'));

  if (!isFinite(N) || N < 1) {
    this.show_message('error', 'Aantal iteraties',
      "Vul bij het aantal iteraties een getal in (minimaal 1).");
    $(dom).focus();
    return null;
  }
  if (N > N_MAX) {
    this.show_message('error', 'Aantal iteraties',
      "Het aantal iteraties is te groot. Kies maximaal 1000000.");
    $(dom).focus();
    return null;
  }
  return Math.round(N);
};


ModelleertaalApp.prototype.run = function() {

  var N = this.read_N(this.dom_nbox);
  if (N === null) return false;
  this.N = N;

  if (!this.setup_run()) return false;

  // keep the results of the previous run: plot in gray for comparison
  var previous = null;
  if (this.results_available()) {
    previous = {
      vars: this.allVars,
      rows: this.reduce_rows(this.results, this.max_rows_in_plot)
    };
  }

  this.new_run = true;
  this.has_run = this.do_run();
  if (this.has_run) {
    if (previous) this.previous = previous;
    this.after_run();
    // small screen: the graph is below the model.
    this.reveal(this.dom_graph);
  }
  return this.has_run;
};


ModelleertaalApp.prototype.reveal = function(dom) {
  // scroll to element, if it is not on screen
  var element = $(dom)[0];
  if (!element || !element.getBoundingClientRect || !element.scrollIntoView) return;
  var rect = element.getBoundingClientRect();
  var visible = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  if (visible < Math.min(rect.height, window.innerHeight) / 2) {
    element.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }
};


ModelleertaalApp.prototype.continue_run = function() {

  var N = this.read_N(this.dom_nbox_continue);
  if (N === null) return false;
  this.N = N;

  if (this.has_run) {
    this.new_run = false;
    this.tracing = false;
  } else {
    if (!this.setup_run()) return false;
    this.new_run = true;
  }
  this.has_run = this.do_run();
  if (this.has_run) this.after_run();
  return this.has_run;
};


ModelleertaalApp.prototype.trace = function() {

  if (this.has_run) {
    this.new_run = false;
  } else {
    if (!this.setup_run()) return false;
    this.new_run = true;
  }

  this.tracing = true;
  this.has_run = this.do_run();
  if (this.has_run) this.after_run();
  return this.has_run;
};


ModelleertaalApp.prototype.setup_run = function() {

  // reset the breakpoint pointer:
  this.tracing = false;
  this.remove_highlight_trace();
  this.remove_highlight_error();
  this.clear_message();

  this.read_model();

  try {
    this.evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
  } catch (err) {
    this.show_error(err);
    return false;
  }
  return true;
};


ModelleertaalApp.prototype.do_run = function() {

  var run_result;

  this.clear_message();

  try {
    this.evaluator.set_state(this.N, this.new_run, this.tracing);
    this.evaluator.run();
    run_result = this.evaluator.get_state();
  } catch (err) {
    this.show_error(err);
    return false;
  }

  this.results = this.evaluator.result;
  this.allVars = this.evaluator.namespace.varNames;

  if (!run_result.tracing) {
    this.tracing = false;
    this.remove_highlight_trace();
  } else {
    this.highlight_trace(run_result.lineno + 1);
  }
  return true;
};


ModelleertaalApp.prototype.show_error = function(err) {
  // show error in model (from parser or evaluator).

  if (this.debug) console.log(err);

  var name = err.parser_name;
  var line = err.parser_line;
  var title, type;

  if (err.blank) {
    title = 'Het model is nog niet af';
    type = 'warning';
  } else if (err.empty) {
    title = 'Nog geen model';
    type = 'warning';
  } else {
    title = 'Fout';
    type = 'error';
  }
  if (name) {
    title += ' (' + name + (line ? ', regel ' + line : '') + ')';
  }
  this.show_message(type, title, err.message);
  this.print_status(type == 'error' ? "Fout in het model." : "Model niet uitgevoerd.");
  this.highlight_error(line, name);
  this.reveal(this.dom_message);
  if (this.results_available()) this.set_stale(true);
};


ModelleertaalApp.prototype.after_run = function() {

  if (this.allVars === undefined) return;

  this.set_stale(false);

  this.analysis = autoplot.analyse(this.allVars, this.results, this.evaluator.modelregels_ast);
  this.graphs = this.analysis.graphs;

  this.choose_axes();
  this.update_axis_controls();

  this.print_table();
  this.do_plot();
  this.draw_thumbnails();

  this.print_run_status();
  this.check_results();
};


ModelleertaalApp.prototype.print_run_status = function() {

  var N_iterations = this.results.length - 1;
  var status;

  if (this.tracing) {
    this.print_status("Debugger in iteratie " + N_iterations + ".");
    return;
  }
  var iterations = N_iterations + (N_iterations == 1 ? " iteratie." : " iteraties.");
  if (this.evaluator.stopped) {
    status = "Model gestopt na " + iterations;
  } else {
    status = "Klaar na " + iterations;
  }
  if (this.analysis.time !== null) {
    var t = this.results[this.results.length - 1][this.allVars.indexOf(this.analysis.time)];
    if (typeof t == 'number' && isFinite(t)) {
      status += " Eindtijd: " + this.analysis.time + " = " + Number(t.toPrecision(this.precision)) + ".";
    }
  }
  this.print_status(status);
};


ModelleertaalApp.prototype.check_results = function() {
  // warn if the model 'explodes' (division by zero, sqrt of negative number,..)
  // and show the output of print()

  var last = this.results[this.results.length - 1];
  var first_bad_row = Infinity;
  var bad_var;

  for (var j = 0; j < this.allVars.length; j++) {
    if (typeof last[j] != 'number' || isFinite(last[j])) continue;

    // find the first row without a valid number. (row 0: startwaarden)
    var seen_valid = false;
    var bad_row = -1;
    for (var i = 1; i < this.results.length; i++) {
      var ok = isFinite(this.results[i][j]);
      if (ok) {
        seen_valid = true;
        bad_row = -1;
      } else if (bad_row == -1) {
        bad_row = i;
      }
    }
    var info = this.analysis.info[this.allVars[j]];
    // a variable that only gets a value inside als..dan..eindals can be empty.
    if (!seen_valid && info && info.conditional && isNaN(last[j])) continue;

    if (bad_row != -1 && bad_row < first_bad_row) {
      first_bad_row = bad_row;
      bad_var = this.allVars[j];
    }
  }

  if (bad_var !== undefined) {
    this.show_message('warning', 'Let op',
      "Vanaf iteratie " + first_bad_row + " heeft '" + bad_var + "' geen geldige waarde meer. " +
      "Wordt er gedeeld door nul, de wortel getrokken uit een negatief getal of wordt een getal te groot? " +
      "Controleer de modelregels en startwaarden (is dt klein genoeg?).");
  } else if (this.evaluator.messages.length > 0) {
    this.show_message('info', 'print', this.evaluator.messages.join(' '));
  }
};


//
// Axis
//
ModelleertaalApp.prototype.has_var = function(name) {
  return this.allVars.indexOf(name) != -1;
};


ModelleertaalApp.prototype.choose_axes = function() {
  // keep the graph chosen by the user (if possible). Else: best automatic graph.
  var self = this;

  this.multi_yvars = this.multi_yvars.filter(function(name) {
    return self.has_var(name);
  });

  if (this.user_axes && this.has_var(this.xvar) && this.has_var(this.yvar)) return;

  this.user_axes = false;
  if (this.graphs.length > 0) {
    this.xvar = this.graphs[0].x;
    this.yvar = this.graphs[0].y;
  } else {
    this.xvar = this.allVars[0];
    this.yvar = this.allVars[this.allVars.length > 1 ? 1 : 0];
  }
};


ModelleertaalApp.prototype.update_axis_controls = function() {
  // (re)set varNames in drop-down select fields and checkboxes

  var i, name;

  $(this.dom_x_var).empty();
  $(this.dom_y_var).empty();
  $(this.dom_y_checks).empty();

  if (!this.results_available()) {
    $('<option/>').val('').text('auto').appendTo(this.dom_x_var);
    $('<option/>').val('').text('auto').appendTo(this.dom_y_var);
  } else {
    for (i = 0; i < this.allVars.length; i++) {
      name = this.allVars[i];
      $('<option/>').val(name).text(name).appendTo(this.dom_x_var);
      $('<option/>').val(name).text(name).appendTo(this.dom_y_var);
      $('<label/>').append(
        $('<input type="checkbox">').val(name)
          .prop('checked', this.multi_yvars.indexOf(name) != -1)
      ).append($('<span>').addClass('swatch'))
       .append(document.createTextNode(name)).appendTo(this.dom_y_checks);
    }
    $(this.dom_x_var).val(this.xvar);
    $(this.dom_y_var).val(this.yvar);
  }

  $(this.dom_multiplot).prop('checked', this.multiplot);
  $(this.dom_yaxis_zero).prop('checked', !this.yaxis_autoscale);
  $(this.dom_y_var).toggle(!this.multiplot);
  $(this.dom_y_checks).css('display', this.multiplot ? 'flex' : 'none');
};


//
// Table
//
ModelleertaalApp.prototype.format_number = function(x, column) {
  // format number in table. column (optional): index of column in results
  if (typeof x != 'number') return (x) ? 'Waar' : 'Onwaar';
  if (isNaN(x)) return "\u2013";
  if (!isFinite(x)) return (x > 0) ? "\u221e" : "-\u221e";
  // hide floating point noise (1e-17 instead of 0)
  if (x === 0) return "0";
  if (column !== undefined && this.column_scale && Math.abs(x) < 1e-10 * this.column_scale[column]) return "0";
  return x.toPrecision(this.precision);
};


ModelleertaalApp.prototype.compute_column_scale = function() {
  // largest absolute value in each column
  var scale = [];
  var i, j, val;
  for (j = 0; j < this.allVars.length; j++) scale.push(0);
  for (i = 0; i < this.results.length; i++) {
    for (j = 0; j < scale.length; j++) {
      val = Math.abs(this.results[i][j]);
      if (val > scale[j] && isFinite(val)) scale[j] = val;
    }
  }
  this.column_scale = scale;
};


ModelleertaalApp.prototype.table_header = function() {
  var firstrow = $('<tr>');
  firstrow.append($('<th>').text('#'));

  for (var k = 0; k < this.allVars.length; k++) {
    firstrow.append($('<th>').text(this.allVars[k]));
  }
  return firstrow;
};


ModelleertaalApp.prototype.table_row = function(rowIndex) {

  var row = $('<tr>');
  row.append($('<td>').text(rowIndex));

  for (var j = 0; j < this.results[rowIndex].length; j++) {
    row.append($('<td>').text(this.format_number(this.results[rowIndex][j], j)));
  }
  return row;
};


ModelleertaalApp.prototype.print_table = function(limit) {
  // truncated row from: jquery.jsparc.js
  // http://github.com/HiSPARC/jSPARC

  var self = this;

  this.compute_column_scale();

  limit = (limit) ? limit : 10;
  limit = Math.min(this.results.length, limit);

  var table = $('<table>').addClass('table');
  table.append($('<thead>').append(this.table_header()));
  var body = $('<tbody>').appendTo(table);

  var show_more = function() {
    self.print_table(limit * 5);
  };

  for (var i = 0; i < this.results.length; i++) {
    body.append(this.table_row(i));

    if (limit != this.results.length && i == Math.floor(limit / 2) - 1) {
      var hidden = this.results.length - limit;
      var truncrow = $('<tr>').addClass('truncated');
      truncrow.append($('<td>')
        .attr('colspan', this.allVars.length + 1)
        .append($('<button type="button">')
          .text('\u22ee  ' + hidden + ' rijen verborgen. Klik voor meer rijen.')
          .click(show_more)));
      body.append(truncrow);
      i = this.results.length - 1 - Math.ceil(limit / 2);
    }
  }

  $(self.dom_datatable).empty().append($('<div>').addClass('table_scroll').append(table));
};


//
// Plotten
//
ModelleertaalApp.prototype.results_available = function() {
  return (this.results !== undefined && this.results.length > 0);
};


ModelleertaalApp.prototype.require_results = function() {
  if (this.results_available()) return true;
  this.show_message('warning', 'Geen resultaten', 'Druk eerst op Run.');
  return false;
};


ModelleertaalApp.prototype.xy_data = function(rows, vars, xvar, yvar) {
  // create [[x, y], ...] from rows. Returns null if variables do not exist
  var xi = vars.indexOf(xvar);
  var yi = vars.indexOf(yvar);
  var data = [];
  var x, y;

  if (xi == -1 || yi == -1) return null;

  for (var i = 0; i < rows.length; i++) {
    x = rows[i][xi];
    y = rows[i][yi];
    if (typeof x == 'boolean') x = x ? 1 : 0;
    if (typeof y == 'boolean') y = y ? 1 : 0;
    if (isFinite(x) && isFinite(y)) {
      data.push([x, y]);
    } else {
      data.push(null); // gap in plot
    }
  }
  return data;
};


ModelleertaalApp.prototype.do_plot = function() {

  var self = this;

  if (!this.results_available()) {
    return false;
  }

  var rows = this.reduce_rows(this.results, this.max_rows_in_plot);
  this.rowinc = this.row_increment(this.results, this.max_rows_in_plot);

  var show_points = (rows.length <= 60);
  var dataset = [];
  var y_label;
  var note = '';

  if (this.multiplot) {
    this.multi_yvars.forEach(function(name, n) {
      dataset.push({
        data: self.xy_data(rows, self.allVars, self.xvar, name),
        color: COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length],
        label: name,
        points: {show: show_points}
      });
    });
    y_label = this.multi_yvars.join(', ');
    if (dataset.length === 0) note = 'Vink hieronder aan welke variabelen je wilt zien.';
    // legend: colour next to the checkbox
    $(this.dom_y_checks).find('label').each(function() {
      var n = self.multi_yvars.indexOf($(this).find('input').val());
      $(this).find('.swatch')
        .css('background-color', COLORS_MULTIPLOT[Math.max(n, 0) % COLORS_MULTIPLOT.length])
        .css('display', (n == -1) ? 'none' : 'inline-block');
    });
  } else {
    var previous = (this.previous) ?
      this.xy_data(this.previous.rows, this.previous.vars, this.xvar, this.yvar) : null;
    if (previous !== null) {
      dataset.push({
        data: previous,
        color: COLOR_PREVIOUS,
        mt_previous: true,
        points: {show: false},
        hoverable: false,
        clickable: false
      });
      note = 'Grijze lijn: de vorige run (om te vergelijken).';
    }
    dataset.push({
      data: this.xy_data(rows, this.allVars, this.xvar, this.yvar),
      color: COLOR_PLOT,
      points: {show: show_points}
    });
    y_label = this.yvar;
  }

  $(this.dom_clickdata).empty();
  $(this.dom_graph_note).text(note);
  this.plot_graph(dataset, this.xvar, y_label);
  this.select_thumbnail();
}; // do_plot


ModelleertaalApp.prototype.plot_graph = function(dataset, x_label, y_label) {

  var self = this;

  if ($(this.dom_graph).width() === 0 || $(this.dom_graph).height() === 0) return;

  // plot the y-axis from 0, unless autoscale
  var yaxis_min, yaxis_max;
  if (!this.yaxis_autoscale) {
    var min = Infinity, max = -Infinity;
    dataset.forEach(function(series) {
      series.data.forEach(function(point) {
        if (point === null) return;
        if (point[1] < min) min = point[1];
        if (point[1] > max) max = point[1];
      });
    });
    if (min >= 0) yaxis_min = 0;
    if (max <= 0) yaxis_max = 0;
  }

  function sciFormatter(val, axis) {
    // format large numbers in scientific notation: 1e6
    if (Math.abs(val) > 9e4)
      return val.toExponential(1);
    else
      return $.plot.defaultTickFormatter(val, axis);
  }

  function short(val) {
    return String(Number(Number(val).toPrecision(self.precision)));
  }

  var axis_font = {
    size: 13,
    lineHeight: 14,
    family: "sans-serif",
    color: "#4b5563"
  };

  $(this.dom_graph).empty();

  this.plot_object = $.plot($(this.dom_graph), dataset, {
    series: {
      lines: {
        show: true,
        lineWidth: 2
      },
      points: {
        radius: 2,
        fill: true
      },
      shadowSize: 0
    },
    grid: {
      hoverable: true,
      clickable: true,
      borderWidth: 1,
      borderColor: '#9ca3af'
    },
    axisLabels: {
      show: true
    },
    xaxis: {
      font: axis_font,
      showTicks: false,
      tickFormatter: sciFormatter,
      axisLabel: x_label
    },
    yaxis: {
      font: axis_font,
      showTicks: false,
      position: 'left',
      tickFormatter: sciFormatter,
      min: yaxis_min,
      max: yaxis_max,
      axisLabel: y_label
    },
    legend: {
      show: false
    },
    tooltip: {
      show: true,
      content: function(label, x, y) {
        return x_label + " = " + short(x) + ", " + (label || y_label) + " = " + short(y);
      }
    }
  }); // $.plot()
}; // plot_graph()


//
// Thumbnails: all automatic graphs. Click to enlarge.
//
ModelleertaalApp.prototype.draw_thumbnails = function() {

  var container = $(this.dom_graph_tabs).empty();

  if (!this.results_available() || this.graphs.length < 2) {
    return;
  }

  var rows = this.reduce_rows(this.results, 150);

  for (var i = 0; i < this.graphs.length; i++) {
    var graph = this.graphs[i];
    var canvas = $('<canvas>')[0];
    var button = $('<button type="button">')
      .data('index', i)
      .attr('title', 'Grafiek van ' + graph.y + ' tegen ' + graph.x)
      .append(canvas)
      .append($('<span>').text('(' + graph.y + ',' + graph.x + ')'))
      .appendTo(container);
    var previous = (this.previous) ?
      this.xy_data(this.previous.rows, this.previous.vars, graph.x, graph.y) : null;
    draw_sparkline(canvas, this.xy_data(rows, this.allVars, graph.x, graph.y), previous);
    button.toggleClass('selected', false);
  }
  this.select_thumbnail();
};


ModelleertaalApp.prototype.select_thumbnail = function() {
  // highlight the thumbnail of the graph that is shown
  var self = this;
  $(this.dom_graph_tabs).find('button').each(function() {
    var graph = self.graphs[$(this).data('index')];
    var selected = !self.multiplot && graph && graph.x == self.xvar && graph.y == self.yvar;
    $(this).toggleClass('selected', Boolean(selected)).attr('aria-pressed', String(Boolean(selected)));
  });
};


function draw_sparkline(canvas, data, previous) {
  // minimal line graph without axis.
  var width = 112, height = 64, pad = 6;
  var ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);

  var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  (data || []).forEach(function(point) {
    if (point === null) return;
    if (point[0] < xmin) xmin = point[0];
    if (point[0] > xmax) xmax = point[0];
    if (point[1] < ymin) ymin = point[1];
    if (point[1] > ymax) ymax = point[1];
  });
  if (xmin == Infinity) return;
  // include y = 0 (same as large plot)
  if (ymin > 0) ymin = 0;
  if (ymax < 0) ymax = 0;
  if (xmax == xmin) xmax = xmin + 1;
  if (ymax == ymin) ymax = ymin + 1;

  function px(x) {
    return pad + (x - xmin) / (xmax - xmin) * (width - 2 * pad);
  }
  function py(y) {
    return height - pad - (y - ymin) / (ymax - ymin) * (height - 2 * pad);
  }

  function line(points, color, linewidth) {
    var pen_down = false;
    ctx.beginPath();
    points.forEach(function(point) {
      if (point === null) {
        pen_down = false;
        return;
      }
      if (pen_down) {
        ctx.lineTo(px(point[0]), py(point[1]));
      } else {
        ctx.moveTo(px(point[0]), py(point[1]));
        pen_down = true;
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // axis: y = 0
  line([[xmin, 0], [xmax, 0]], '#d1d5db', 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  if (previous) line(previous, COLOR_PREVIOUS, 1.5);
  line(data, COLOR_PLOT, 1.75);
  ctx.restore();
}


ModelleertaalApp.prototype.set_max_rows_in_plot = function(max_rows) {
  max_rows = Math.round(Number(max_rows));
  if (!isFinite(max_rows) || max_rows < 2) return;
  this.max_rows_in_plot = max_rows;
  if (this.results_available()) this.do_plot();
};

ModelleertaalApp.prototype.set_precision = function(precision) {
  precision = Math.round(Number(precision));
  if (!isFinite(precision) || precision < 1 || precision > 15) return;
  this.precision = precision;
  if (this.results_available()) this.print_table();
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
    this.modelregels_editor.clearHistory();
    this.startwaarden_editor.clearHistory();
  } else {
    $(this.dom_modelregels).val(this.model.modelregels);
    $(this.dom_startwaarden).val(this.model.startwaarden);
  }
  $(this.dom_nbox).val(this.model.N ? this.model.N : this.N_default);
  $(this.dom_titel).val(this.model_title || '');
  this.update_document_title();

  this.loaded ={modelregels: this.model.modelregels, startwaarden: this.model.startwaarden};

  this.results = [];
  this.allVars = [];
  this.graphs = [];
  this.analysis = undefined;
  this.previous = null;
  this.has_run = false;
  this.tracing = false;
  this.remove_highlight_trace();
  this.remove_highlight_error();

  // (re)set graph menu
  this.multiplot = false;
  this.multi_yvars = [];
  this.user_axes = false;
  this.xvar = undefined;
  this.yvar = undefined;
  this.update_axis_controls();
  this.set_stale(false);
  this.clear_message();

  if (this.plot_object) {
    this.plot_object.shutdown();
    this.plot_object = undefined;
  }
  $(this.dom_graph).empty().append(
    $('<div>').addClass('placeholder').text('Druk op Run om het model door te rekenen.'));
  $(this.dom_graph_tabs).empty();
  $(this.dom_graph_note).empty();
  $(this.dom_clickdata).empty();
  $(this.dom_datatable).empty().append(
    $('<div>').addClass('placeholder').text('Hier komt de tabel met resultaten.'));
  this.print_status("Model geladen. Druk op Run.");
  this.grafisch_moved = {};   // other model: forget dragged positions
  if (this.grafisch_open()) this.draw_grafisch_model();
};


//
// TSV -- use TSV instead of CSV to prevent , . decimal problems in Excel.
//
ModelleertaalApp.prototype.create_tsv = function() {
  var self = this;
  var tsv = '';

  tsv += this.allVars.join('\t'); //header row
  tsv += "\n";

  tsv += this.results.map(function(row) {
    return row.map(function(item) {
      return typeof(item) === 'number' ? item.toPrecision(self.precision).replace('.', ',') : item;
    }).join('\t');
  }).join('\n');

  // . is replaced with , for NL Excel
  return tsv;
};


ModelleertaalApp.prototype.current_xy = function() {
  // the data of the current (single) plot, without gaps
  if (!this.require_results()) return false;

  if (this.multiplot) {
    this.show_message('warning', 'Niet mogelijk', 'Dit werkt alleen met een enkele grafiek.');
    return false;
  }
  var rows = this.reduce_rows(this.results, this.max_rows_in_plot);
  return this.xy_data(rows, this.allVars, this.xvar, this.yvar).filter(function(point) {
    return point !== null;
  });
};


//
// PGFPlot
//
ModelleertaalApp.prototype.create_pgfplot_header = function(scatter_plot) {
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

    var exp_10 = Math.floor(Math.log(max_val) / Math.log(10));
    var power_of_ten = Math.pow(10, exp_10);

    if (max_val / (2 * power_of_ten) < 1) return 2 * power_of_ten;
    if (max_val / (5 * power_of_ten) < 1) return 5 * power_of_ten;
    return 10 * power_of_ten;
  }

  function get_units_by_variable_name(var_name) {
    var units = {
      "x": "\\meter", "y": "\\meter", "h": "\\meter", "u": "\\meter",
      "s": "\\meter", "t": "\\second",
      "v": "\\meter\\per\\second",
      "a": "\\meter\\per\\second",
      "Fres": "\\Newton", "Fr": "\\Newton", "Fw": "\\Newton"
    };
    return (units[var_name]) ? units[var_name] : "unknown";
  }

  var x_var = this.xvar;
  var y_var = this.yvar;
  var x_unit = get_units_by_variable_name(x_var);
  var y_unit = get_units_by_variable_name(y_var);

  // and back to columns again ...
  var x = [];
  var y = [];
  for (var i = 0; i < scatter_plot.length; i++) {
    x.push(scatter_plot[i][0]);
    y.push(scatter_plot[i][1]);
  }

  // This only works for 10x10 grid with x_min, y_min = (0,0)
  var x_min = arrayMin(x);
  var x_max = round_to_scale(arrayMax(x));
  var y_min = arrayMin(y);
  var y_max = round_to_scale(arrayMax(y));
  var x_scale = x_max / 10; // adjust to 10 cm x 10 cm grid
  var y_scale = y_max / 10;

  return "%x and y scale set to 10cmx10cm grid. Adjust to fit!\n" +
    "% x = [" + x_min + " .. " + arrayMax(x) + "]\n" +
    "% y = [" + y_min + " .. " + arrayMax(y) + "]\n" +
    "% this only works for graphs starting at (0,0)\n" +
    "\\begin{axis}[x=1cm\/" + x_scale + ", y=1cm\/" + y_scale + ",\n" +
    "axis y line=left, axis x line=middle,\n" +
    "enlargelimits=false, tick align=outside,\n " +
    "xlabel={$" + x_var + "$ [\\si{" + x_unit + "}]},\n" +
    "ylabel={$" + y_var + "$ [\\si{" + y_unit + "}]},\n" +
    "% xtick={0, 1, 2, ..., 10},\n" +
    "% ytick={0, 2, 4, ..., 20},\n" +
    "xmin=" + x_min + ", xmax=" + x_max + ", ymin=" + y_min + ", ymax=" + y_max + "]\n";
};


ModelleertaalApp.prototype.create_pgfplot = function() {
  // Output PGFPlots plot

  var scatter_plot = this.current_xy();
  if (scatter_plot === false || scatter_plot.length === 0) return false;

  var coordinates = scatter_plot.map(function(d) {
    return "(" + d.join(',') + ")";
  }).join('\n');

  var PGFPlot_TeX = "% Use \\input{} to wrap this inside suitable LaTeX doc:\n";
  PGFPlot_TeX += "\\begin{tikzpicture}\n" +
    "\\pgfplotsset{/pgf/number format/use comma}\n" +
    "% draw 10x10cm millimeter paper.\n" +
    "\\def\\width{10}\n" +
    "\\def\\height{10}\n" +
    "\\draw[step=1mm, line width=0.2mm, blue!20!white] (0,0) grid (\\width,\\height);\n" +
    "\\draw[step=5mm, line width=0.2mm, blue!40!white] (0,0) grid (\\width,\\height);\n" +
    "\\draw[step=1cm, line width=0.2mm, blue!60!white] (0,0) grid (\\width,\\height);\n";
  PGFPlot_TeX += "%\n%\n%\n";

  PGFPlot_TeX += this.create_pgfplot_header(scatter_plot);

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
  // Output SVG plot: the curve, scaled to 400 x 300, y-axis pointing up.

  var scatter_plot = this.current_xy();
  if (scatter_plot === false || scatter_plot.length === 0) return false;

  var width = 400, height = 300;
  var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  scatter_plot.forEach(function(d) {
    xmin = Math.min(xmin, d[0]);
    xmax = Math.max(xmax, d[0]);
    ymin = Math.min(ymin, d[1]);
    ymax = Math.max(ymax, d[1]);
  });
  if (xmax == xmin) xmax = xmin + 1;
  if (ymax == ymin) ymax = ymin + 1;

  var coordinates = scatter_plot.map(function(d) {
    var x = (d[0] - xmin) / (xmax - xmin) * width;
    var y = height - (d[1] - ymin) / (ymax - ymin) * height;
    return " " + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }).join('\n');

  var SVG_Plot = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -5 ' + (width + 10) + ' ' + (height + 10) + '">\n';
  SVG_Plot += '<!-- ' + this.yvar + ' (' + ymin + ' .. ' + ymax + ') tegen ' +
              this.xvar + ' (' + xmin + ' .. ' + xmax + ') -->\n';
  // graph
  SVG_Plot += '<polyline fill="none" stroke="black" ';
  SVG_Plot += 'points= "\n';
  SVG_Plot += coordinates;
  SVG_Plot += ' "/>\n';
  SVG_Plot += '</svg>\n';

  return SVG_Plot;
};


//
// Helpers
//
ModelleertaalApp.prototype.row_increment = function(rows, Nresults) {
  return (rows.length > Nresults) ? Math.floor(rows.length / Nresults) : 1;
};


ModelleertaalApp.prototype.reduce_rows = function(rows, Nresults) {
  // reduce resultsObject (large array) to length == Nresults

  var length = rows.length;
  var rowinc = this.row_increment(rows, Nresults);

  if (rowinc == 1) return rows;

  // select first row, last row and rows in between. Keep Nrows+1 rows.
  return rows.filter(function(value, index) {
    return (index % rowinc === 0 || index == length - 1);
  });
};


ModelleertaalApp.prototype.get_result_rowIndex = function(rowIndex_plot) {
  // map row index from plot (reduced number of rows)
  // back to this.results

  var rowIndex = this.rowinc * rowIndex_plot;
  if (rowIndex < this.results.length) {
    return rowIndex;
  } else {
    return this.results.length - 1;
  }
};


ModelleertaalApp.prototype.get_editor = function(editor_name) {
  if (!this.CodeMirrorActive) return null;
  if (editor_name === 'modelregels') return this.modelregels_editor;
  if (editor_name === 'startwaarden') return this.startwaarden_editor;
  return null;
};


ModelleertaalApp.prototype.highlight_error = function(line, editor_name) {
  // highlight line with error, until the model is edited or run.

  var editor = this.get_editor(editor_name);
  if (editor === null) return false;

  if (line === undefined || line < 1) {
    editor.focus();
    return false;
  }
  line = Math.min(line, editor.lineCount());

  this.remove_highlight_error();
  this.error_highlight = {
    editor: editor,
    handle: editor.addLineClass(line - 1, 'background', 'mt-error-line')
  };
  editor.addLineClass(this.error_highlight.handle, 'gutter', 'mt-error-gutter');
  editor.setCursor({line: line - 1, ch: editor.getLine(line - 1).length});
  editor.focus();
};


ModelleertaalApp.prototype.remove_highlight_error = function() {
  if (!this.error_highlight) return;
  var highlight = this.error_highlight;
  this.error_highlight = undefined;
  highlight.editor.removeLineClass(highlight.handle, 'background', 'mt-error-line');
  highlight.editor.removeLineClass(highlight.handle, 'gutter', 'mt-error-gutter');
};


ModelleertaalApp.prototype.remove_highlight_trace = function() {

  if (!this.CodeMirrorActive) return false;

  if (this.at_line !== undefined) {
    // remove current highlighted line
    this.modelregels_editor.removeLineClass(this.at_line, 'background', 'mt-trace-line');
    this.at_line = undefined;
  }
};


ModelleertaalApp.prototype.highlight_trace = function(line) {

  if (!this.CodeMirrorActive) return false;

  this.remove_highlight_trace();
  this.at_line = line - 1;
  this.modelregels_editor.addLineClass(this.at_line, 'background', 'mt-trace-line');
};


//
// base64url <--> unicode string. (model in URL)
//
function encode_base64url(str) {
  var bytes = unescape(encodeURIComponent(str));
  return window.btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode_base64url(str) {
  var bytes = window.atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return decodeURIComponent(escape(bytes));
}


exports.ModelleertaalApp = ModelleertaalApp;
