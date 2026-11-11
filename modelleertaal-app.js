var evaluator_js = require('./evaluator.js');
var autoplot = require('./autoplot.js');
var deellink = require('./deellink.js');
var grafisch = require('./grafisch.js');
var grafisch_edit = require('./grafisch-edit.js');
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
var version = "v6.1.1";

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
  this.dom_endtime_hint = "#endtime_hint";
  this.dom_nbox_continue = "#NBoxContinue";
  this.dom_run = "#run";
  this.dom_continue = "#continue";
  this.dom_trace = "#trace";
  this.dom_fileinput = "#fileinput";
  this.dom_download_xml = "#download_xml";
  this.dom_download_pgf = "#download_pgf";
  this.dom_download_tsv = "#download_tsv";
  this.dom_download_svg = "#download_svg";
  this.dom_download_png = "#download_png";
  this.dom_precision = "#precision";
  this.dom_max_rows = "#max_rows";
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
  this.dom_view_switch = ".view_switch";
  this.dom_workspace = ".workspace";
  this.dom_grafisch_tabel = "#grafisch_tabel";
  this.weergave = 'tekst';   // 'tekst' or 'grafisch' (text and diagram)
  this.grafisch_stijl = 'examen';   // style of the diagram: 'examen' or 'kleur' (see grafisch.js)
  this.dom_download_grafisch = "#download_grafisch";
  this.dom_grafisch_reset = "#grafisch_herstel";
  this.dom_grafisch_form = "#grafisch_eigenschappen";
  this.dom_grafisch_melding = "#grafisch_melding";
  this.grafisch_selected = undefined;   // id of the selected element
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

    // the symbol of the line with the cursor lights up in the diagram
    var on_cursor = function(editor) {
      self.grafisch_link_cursor(editor);
    };
    [this.modelregels_editor, this.startwaarden_editor].forEach(function(editor) {
      editor.on('cursorActivity', on_cursor);
      editor.on('focus', on_cursor);
      editor.on('blur', on_cursor);
    });
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
  this.load_settings();
  this.starting = true;
  this.init_app();
  this.starting = false;
  // after the first model is loaded: offer to continue with unsaved work
  this.restore_check = true;
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

  $(this.dom_nbox).on('input', function() {
    self.update_endtime_hint(false);
    self.schedule_autosave();
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
    if (self.autosave_timer) self.autosave();
    if (self.is_modified()) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  });

  $(this.dom_titel).on('input', function() {
    self.update_document_title();
    self.schedule_autosave();
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
  $(this.dom_download_png).click(function() {
    self.download_png();
  });

  // Meer opties: applied when the value changes (no separate button)
  $(this.dom_precision).on('change', function() {
    self.set_precision($(this).val());
  });
  $(this.dom_max_rows).on('change', function() {
    self.set_max_rows_in_plot($(this).val());
  });

  // Tekst | Tekst + grafisch. The diagram is drawn from the text of the model (no Run needed)
  $(this.dom_view_switch).on('click', 'button', function() {
    self.set_weergave($(this).attr('data-weergave'), true);
  });
  // Examen | Kleur: style of the diagram
  $('.stijl_switch').on('click', 'button', function() {
    self.set_grafisch_stijl($(this).attr('data-stijl'), true);
  });
  // Herkende elementen: a click on a row selects the element in the diagram
  $(this.dom_grafisch_tabel).on('click', 'tr[data-id]', function() {
    self.grafisch_focus = true;
    self.grafisch_select($(this).attr('data-id'));
  });
  // + on the selected toestandsvariabele: new flow in or out
  $(this.dom_grafisch_svg).on('click', '[data-action]', function() {
    self.grafisch_flow_form($(this).attr('data-stock'), $(this).attr('data-action') == 'flow-in' ? 'in' : 'out');
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
    drag = {id: id, moved: false, ids: ids, x: m.x, y: m.y,
            start: ids.map(function(k) { return {x: pos[k].x, y: pos[k].y}; })};
    e.preventDefault();
  });
  $(window).on('pointermove', function(event) {
    if (!drag) return;
    var m = self.grafisch_point(event.originalEvent);
    var pos = self.grafisch_layout.pos;
    // a small movement is a click (select), not a drag
    if (!drag.moved && Math.abs(m.x - drag.x) + Math.abs(m.y - drag.y) < 4) return;
    drag.moved = true;
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
  $(window).on('pointerup pointercancel', function(event) {
    if (drag && !drag.moved && event.type == 'pointerup') {
      // click: select the element (a cloud: its flow) and show its properties
      self.grafisch_select(drag.id.replace(/:(src|dst)$/, ''));
    }
    drag = null;
  });

  // drag the background: move the view (pan). Click on the background: nothing selected.
  // (touch: the browser scrolls the view itself)
  var pan = null;
  $(this.dom_grafisch_svg).on('pointerdown', function(event) {
    var e = event.originalEvent;
    self.grafisch_focus = true;
    if (e.button !== 0 || $(e.target).closest('[data-id], [data-action]').length) return;
    // not on the scrollbars
    var box = this.getBoundingClientRect();
    if (e.clientX > box.left + this.clientWidth || e.clientY > box.top + this.clientHeight) return;
    pan = {x: e.clientX, y: e.clientY, left: this.scrollLeft, top: this.scrollTop, moved: false,
           mouse: e.pointerType == 'mouse'};
    if (pan.mouse) e.preventDefault();
  });
  $(window).on('pointermove', function(event) {
    if (!pan) return;
    var e = event.originalEvent;
    if (Math.abs(e.clientX - pan.x) + Math.abs(e.clientY - pan.y) > 4) pan.moved = true;
    if (pan.mouse && pan.moved) {
      $(self.dom_grafisch_svg).scrollLeft(pan.left - (e.clientX - pan.x)).scrollTop(pan.top - (e.clientY - pan.y));
    }
  });
  $(window).on('pointerup pointercancel', function(event) {
    if (pan && !pan.moved && event.type == 'pointerup') {
      self.grafisch_form_new = false;
      self.grafisch_select(undefined);
    }
    pan = null;
  });
  $(this.dom_grafisch_svg).on('scroll', function() {
    self.grafisch_place_form();
  });
  $(window).on('resize', function() {
    if (self.grafisch_open() && self.grafisch_g) self.render_grafisch_model();
  });

  // zoom: buttons, and ctrl + mouse wheel (or pinch on a trackpad) on the diagram
  $('#grafisch_zoom_in').click(function() { self.grafisch_set_zoom(self.grafisch_zoom_now * 1.25); });
  $('#grafisch_zoom_uit').click(function() { self.grafisch_set_zoom(self.grafisch_zoom_now / 1.25); });
  $('#grafisch_zoom_passend').click(function() { self.grafisch_set_zoom(null); });
  var view = $(this.dom_grafisch_svg)[0];
  if (view && view.addEventListener) {
    view.addEventListener('wheel', function(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      self.grafisch_set_zoom(self.grafisch_zoom_now * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e);
    }, {passive: false});

    // touch screen: pinch with two fingers to zoom (one finger scrolls, as usual)
    var pinch = null, pinch_frame = null;
    var two_fingers = function(e) {
      var a = e.touches[0], b = e.touches[1];
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return {d: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
              clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2};
    };
    view.addEventListener('touchstart', function(e) {
      if (e.touches.length != 2 || !self.grafisch_g) return;
      e.preventDefault();
      drag = null;
      pan = null;
      pinch = {start: two_fingers(e), zoom: self.grafisch_zoom_now || 1};
    }, {passive: false});
    view.addEventListener('touchmove', function(e) {
      if (!pinch || e.touches.length != 2) return;
      e.preventDefault();
      pinch.now = two_fingers(e);
      if (pinch_frame) return;
      pinch_frame = window.requestAnimationFrame(function() {
        pinch_frame = null;
        if (pinch && pinch.now) self.grafisch_set_zoom(pinch.zoom * pinch.now.d / pinch.start.d, pinch.now);
      });
    }, {passive: false});
    view.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) pinch = null;
    });
  }

  // keys: Delete removes the selected element, Escape closes the form
  $(document).on('pointerdown', function(event) {
    if (!$(event.target).closest(self.dom_grafisch).length) self.grafisch_focus = false;
  });
  $(document).on('keydown', function(event) {
    if (!self.grafisch_focus || !self.grafisch_open()) return;
    var typing = $(event.target).closest('input, textarea, select, .CodeMirror').length > 0;
    if (event.key == 'Escape') {
      self.grafisch_form_new = false;
      self.grafisch_select(undefined);
    } else if ((event.key == 'Delete' || event.key == 'Backspace') && !typing && self.grafisch_selected !== undefined) {
      event.preventDefault();
      self.grafisch_apply([{op: 'remove', id: self.grafisch_selected}], undefined);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() == 'z' && !typing) {
      event.preventDefault();
      self.grafisch_undo();
    }
  });
  $('#grafisch_undo').click(function() { self.grafisch_undo(); });

  // grafisch model as input: new elements
  $('#grafisch_nieuw_toestand').click(function() { self.grafisch_new_form('stock'); });
  $('#grafisch_nieuw_hulp').click(function() { self.grafisch_new_form('aux'); });
  $('#grafisch_nieuw_constante').click(function() { self.grafisch_new_form('const'); });

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
    self.save_settings();
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
  // index.html#model=model_naam&N=100 or index.html#code=... (Deel link, see deellink.js)
  return deellink.parse_hash(window.location.hash);
};


ModelleertaalApp.prototype.load_model = function() {

  var url_params = this.parse_url_hash();
  if (this.debug) console.log("params passed in URL", url_params);

  // N in the link (#model=...&N=100) wins over N in the model file, for the model of the link
  this.url_N = undefined;
  if (url_params.N && isFinite(Number(url_params.N)) && Number(url_params.N) >= 1) {
    this.N_default = Number(url_params.N);
    this.url_N = Number(url_params.N);
  }
  $(this.dom_nbox).val(this.N_default);

  this.dropdown_update();

  if (url_params.code !== undefined) {
    // complete model in URL (made with "Deel link"). All versions of the link: see deellink.js
    try {
      var shared = deellink.decode(url_params.code);
      this.model = new evaluator_js.Model();
      this.model.modelregels = shared.modelregels;
      this.model.startwaarden = shared.startwaarden;
      if (shared.N) this.model.N = shared.N;
      this.model_title = shared.title || 'Gedeeld model';
      $(this.dom_model_keuze).find('option[value="shared"]').remove();
      $('<option/>').val('shared').text(this.model_title + ' (uit link)').prependTo(this.dom_model_keuze);
      $(this.dom_model_keuze).val('shared');
      this.dropdown_value = 'shared';
      this.init_app();
      return;
    } catch (err) {
      // show why, after the first model of the list is loaded (init_app clears messages)
      console.error('Kan model uit link niet lezen', err);
      this.link_error = err.deellink ? err.message : 'Het model in deze link kan niet gelezen worden.';
    }
  }

  if (url_params.model) {
    // try to load model passed with model=... parameter
    var model_url = 'modellen/' + url_params.model + '.xml';
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
      this.model_title = url_params.model;
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


ModelleertaalApp.prototype.show_message = function(type, title, text, buttons) {
  // type: 'error', 'warning' or 'info'. buttons (optional): [{text, action}]
  var box = $(this.dom_message).removeClass('error warning info').addClass(type).empty()
    .append($('<strong>').text(title))
    .append($('<span>').text(text));
  (buttons || []).forEach(function(b) {
    box.append($('<button type="button">').addClass('inline_action').text(b.text).click(b.action));
  });
  box.show();
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


ModelleertaalApp.prototype.current_text = function() {
  // the text in the editors: {modelregels, startwaarden}
  if (this.CodeMirrorActive) {
    return {modelregels: this.modelregels_editor.getValue(),
            startwaarden: this.startwaarden_editor.getValue()};
  }
  return {modelregels: $(this.dom_modelregels).val(), startwaarden: $(this.dom_startwaarden).val()};
};


ModelleertaalApp.prototype.is_modified = function() {
  // has the user changed the model since it was loaded (or saved)?
  if (!this.loaded) return false;
  var current = this.current_text();
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
  clearTimeout(this.hint_timer);
  this.hint_timer = setTimeout(function() { self.update_endtime_hint(true); }, 300);
  this.schedule_autosave();
  if (this.grafisch_open()) {
    clearTimeout(this.grafisch_timer);
    this.grafisch_timer = setTimeout(function() { self.draw_grafisch_model(); }, 400);
  }
  if (this.results_available() && !this.stale) {
    this.set_stale(true);
    this.print_status("Model gewijzigd. Druk op Run.");
  }
};


ModelleertaalApp.prototype.read_dt = function() {
  // the value of dt from the startwaarden, without running the model. null if unknown.
  var model = new evaluator_js.Model();
  model.startwaarden = this.current_text().startwaarden;
  model.modelregels = 'dt = dt';
  try {
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(0, true, false);
    evaluator.run();
    var dt = evaluator.result[0][evaluator.namespace.varNames.indexOf('dt')];
    return (typeof dt == 'number' && isFinite(dt) && dt > 0) ? dt : null;
  } catch (err) {
    // syntax error, ... or no dt in the startwaarden: no hint
    return null;
  }
};


ModelleertaalApp.prototype.update_endtime_hint = function(model_changed) {
  // next to the number of iterations: N x dt (how long the model runs)
  if (model_changed || this.hint_dt === undefined) this.hint_dt = this.read_dt();
  var N = Number(String($(this.dom_nbox).val()).replace(',', '.'));
  var text = '';
  if (this.hint_dt !== null && isFinite(N) && N >= 1) {
    text = '× dt = ' + Number((Math.round(N) * this.hint_dt).toPrecision(this.precision));
  }
  $(this.dom_endtime_hint).text(text);
};


ModelleertaalApp.prototype.grafisch_open = function() {
  // is the diagram shown? (Tekst + grafisch)
  return this.weergave == 'grafisch';
};


ModelleertaalApp.prototype.set_grafisch_stijl = function(stijl, save) {
  // 'examen': black and white, as in the exams. 'kleur': in color.
  this.grafisch_stijl = (stijl == 'kleur') ? 'kleur' : 'examen';
  var now = this.grafisch_stijl;
  $('.stijl_switch button').each(function() {
    $(this).attr('aria-pressed', String($(this).attr('data-stijl') == now));
  });
  $('.grafisch_strook').each(function() {
    $(this).prop('hidden', $(this).attr('data-stijl') != now);
  });
  $(this.dom_grafisch_svg).attr('data-stijl', now);
  if (this.grafisch_open() && this.grafisch_g) {
    this.grafisch_bounds = null;
    this.render_grafisch_model();
  }
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.set_weergave = function(weergave, save) {
  // 'tekst': only the text. 'grafisch': the diagram above the text, in the same card.
  var self = this;
  this.weergave = (weergave == 'grafisch') ? 'grafisch' : 'tekst';
  $(this.dom_view_switch).find('button').each(function() {
    $(this).attr('aria-pressed', String($(this).attr('data-weergave') == self.weergave));
  });
  $(this.dom_grafisch).prop('hidden', this.weergave != 'grafisch');
  // the page layout changes: the model gets the whole width, the graph goes below it
  $(this.dom_workspace).toggleClass('met_grafisch', this.weergave == 'grafisch');
  if (this.grafisch_open()) {
    this.draw_grafisch_model();
  } else {
    this.grafisch_form_new = false;
    this.grafisch_select(undefined);
    this.grafisch_linked = undefined;
  }
  // the graph has another size now
  if (this.results_available()) {
    this.do_plot();
    this.draw_thumbnails();
  }
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.analyse_grafisch_model = function() {
  // grafisch.js analysis of the model in the editors. Throws on syntax errors.
  // Also: which lines of the text belong to which symbol (this.grafisch_lines)
  this.read_model();
  var ev = new evaluator_js.ModelregelsEvaluator(this.model, false);
  var g = grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast);
  this.grafisch_lines = grafisch.lines(g, ev.startwaarden_ast, ev.modelregels_ast);
  return g;
};


ModelleertaalApp.prototype.draw_grafisch_model = function() {
  // draw the model as a stock-flow diagram, in the style of the exams or in color (see grafisch.js)
  var svg = $(this.dom_grafisch_svg);
  var g;
  try {
    g = this.analyse_grafisch_model();
  } catch (err) {
    svg.empty().append($('<div>').addClass('placeholder').text(err.empty ?
      'Nog geen model. Begin met + Toestandsvariabele, of typ het model hieronder.' :
      'Geen grafisch model: ' + (err.message || 'fout in het model')));
    this.grafisch_g = undefined;
    this.grafisch_layout = undefined;
    this.grafisch_lines = undefined;
    $(this.dom_grafisch_tabel).empty();
    this.grafisch_select(undefined);
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
  // Herkende elementen: the same model as a list
  var table = $('<table>');
  grafisch.table(g).forEach(function(row) {
    var tr = $('<tr>')
      .append($('<td>').text(row.kind))
      .append($('<td>').append($('<b>').text(row.name)))
      .append($('<td>').text(row.definition));
    if (row.id !== undefined) tr.attr('data-id', row.id).attr('title', 'Klik om ' + row.name + ' in het diagram te kiezen');
    table.append(tr);
  });
  $(this.dom_grafisch_tabel).empty().append(table);
  // the form of the selected element shows the new text of the model
  if (this.grafisch_selected !== undefined || !this.grafisch_form_new) this.grafisch_select(this.grafisch_selected);
};


ModelleertaalApp.prototype.grafisch_values = function() {
  // after a run: name --> {first, last} (as in the table), for the tooltips of the symbols
  if (!this.results_available() || this.stale) return null;
  var self = this, out = {};
  var last = this.results[this.results.length - 1];
  this.allVars.forEach(function(name, j) {
    // a hulpvariabele gets its first value in the first iteration
    var first = self.results[0][j];
    for (var i = 0; i < self.results.length && typeof first == 'number' && !isFinite(first); i++) {
      first = self.results[i][j];
    }
    out[name] = {first: self.format_number(first, j), last: self.format_number(last[j], j)};
  });
  return out;
};


ModelleertaalApp.prototype.render_grafisch_model = function() {
  // draw this.grafisch_g with the (dragged) positions in this.grafisch_layout.
  // The drawing only grows while dragging, so it does not jump under the mouse.
  var self = this;
  var opts = {bounds: this.grafisch_bounds, values: this.grafisch_values(), stijl: this.grafisch_stijl,
              selected: this.grafisch_form_new ? undefined : this.grafisch_selected};
  var view = $(this.dom_grafisch_svg);
  view.html(grafisch.toSVG(this.grafisch_g, this.grafisch_layout, opts));
  this.grafisch_bounds = opts.used;
  // zoom: this.grafisch_zoom is a factor, or null: fit the width (not larger than 100%)
  var svg = view.find('svg');
  var w = parseFloat(svg.attr('width')), h = parseFloat(svg.attr('height'));
  var zoom = this.grafisch_zoom;
  // not smaller than 50%: then it is unreadable, scroll instead.
  // A phone shows the whole model (zoom in with two fingers).
  var narrow = view[0].clientWidth < 600;
  if (!zoom) zoom = Math.max(narrow ? 0.3 : 0.5, Math.min(1, (view[0].clientWidth - 2) / w));
  this.grafisch_zoom_now = zoom;
  svg.attr('width', Math.round(w * zoom)).attr('height', Math.round(h * zoom));
  $('#grafisch_zoom_waarde').text(Math.round(zoom * 100) + '%');
  if (this.grafisch_selected !== undefined) {
    view.find('[data-id]').filter(function() {
      return $(this).attr('data-id').replace(/:(src|dst)$/, '') == self.grafisch_selected;
    }).addClass('selected');
  }
  this.grafisch_mark_linked();
  this.grafisch_place_form();
};


ModelleertaalApp.prototype.grafisch_link_cursor = function(editor) {
  // the cursor is in a line of the text: light up the symbol of that line
  if (!this.grafisch_open() || !this.grafisch_lines) return;
  var name = (editor === this.modelregels_editor) ? 'modelregels' : 'startwaarden';
  var id = this.grafisch_lines.byLine[name + ':' + (editor.getCursor().line + 1)];
  id = editor.hasFocus() ? id : undefined;
  if (id === this.grafisch_linked) return;
  this.grafisch_linked = id;
  this.grafisch_mark_linked();
};


ModelleertaalApp.prototype.grafisch_mark_linked = function() {
  var self = this;
  var view = $(this.dom_grafisch_svg);
  view.find('.linked').removeClass('linked');
  if (this.grafisch_linked === undefined) return;
  view.find('[data-id]').filter(function() {
    return $(this).attr('data-id') == self.grafisch_linked;
  }).addClass('linked');
};


ModelleertaalApp.prototype.grafisch_highlight_lines = function(id) {
  // the lines of the text of the selected symbol get a colour (definition and beginwaarde)
  var self = this;
  (this.link_lines || []).forEach(function(h) {
    h.editor.removeLineClass(h.handle, 'background', 'mt-link-line');
  });
  this.link_lines = [];
  if (!this.CodeMirrorActive || id === undefined || !this.grafisch_lines) return;
  var lines = this.grafisch_lines.byElement[id];
  if (!lines) return;
  ['startwaarden', 'modelregels'].forEach(function(name) {
    var editor = self.get_editor(name);
    lines[name].forEach(function(line) {
      if (line >= 1 && line <= editor.lineCount()) {
        self.link_lines.push({editor: editor, handle: editor.addLineClass(line - 1, 'background', 'mt-link-line')});
      }
    });
  });
};


ModelleertaalApp.prototype.grafisch_set_zoom = function(zoom, wheel) {
  // zoom: factor, or null to fit the width. wheel: keep the point under the mouse in place
  if (!this.grafisch_g || !this.grafisch_layout) return;
  var view = $(this.dom_grafisch_svg)[0];
  var old = this.grafisch_zoom_now || 1;
  var box = view.getBoundingClientRect();
  var px = wheel ? wheel.clientX - box.left : view.clientWidth / 2;
  var py = wheel ? wheel.clientY - box.top : view.clientHeight / 2;
  var cx = (view.scrollLeft + px) / old, cy = (view.scrollTop + py) / old;
  this.grafisch_zoom = zoom === null ? null : Math.max(0.3, Math.min(3, zoom));
  this.render_grafisch_model();
  view.scrollLeft = cx * this.grafisch_zoom_now - px;
  view.scrollTop = cy * this.grafisch_zoom_now - py;
};


ModelleertaalApp.prototype.grafisch_place_form = function() {
  // the form is a small window next to the selected element (wide screens): below it,
  // or above it if there is no room below. Never outside the diagram: the diagram is
  // made at least as high as the form.
  var box = $(this.dom_grafisch_form), form = box.children('form');
  var area = $(this.dom_grafisch_svg);
  if (!form.length || box.css('position') != 'absolute') {
    box.css({left: '', top: ''});
    area.css('min-height', '');
    return;
  }
  var formH = box.outerHeight(), formW = box.outerWidth();
  area.css('min-height', Math.ceil(formH + 16) + 'px');
  var wrap = box.parent()[0].getBoundingClientRect();
  var view = area[0].getBoundingClientRect();
  var minTop = view.top - wrap.top + 8, maxTop = view.bottom - wrap.top - formH - 8;
  var left = 8, top = minTop, self = this;
  var el = area.find('.selected').filter(function() {
    return $(this).attr('data-id') == self.grafisch_selected;
  })[0];
  if (el && this.grafisch_selected !== undefined) {
    // below, above, right of or left of the symbol: the symbol (and its + buttons) stay visible
    var r = el.getBoundingClientRect();
    var below = r.bottom - wrap.top + 10, above = r.top - wrap.top - 10 - formH;
    var right = r.right - wrap.left + 18, leftside = r.left - wrap.left - 18 - formW;
    left = r.left - wrap.left;
    if (below <= maxTop) {
      top = below;
    } else if (above >= minTop) {
      top = above;
    } else if (right + formW <= wrap.width - 8) {
      left = right;
      top = r.top - wrap.top - 20;
    } else if (leftside >= 8) {
      left = leftside;
      top = r.top - wrap.top - 20;
    } else {
      // no room anywhere: the side with the most room (covers as little as possible)
      left = (wrap.width - (r.right - wrap.left) > r.left - wrap.left) ? right : leftside;
      top = r.top - wrap.top - 20;
    }
  }
  top = Math.max(minTop, Math.min(top, maxTop));
  left = Math.max(8, Math.min(left, wrap.width - formW - 8));
  box.css({left: Math.round(left) + 'px', top: Math.round(top) + 'px'});
};


ModelleertaalApp.prototype.grafisch_undo = function() {
  // undo the last change made in the diagram
  var last = (this.grafisch_history || []).pop();
  $('#grafisch_undo').prop('disabled', !(this.grafisch_history || []).length);
  if (!last) return;
  this.read_model();
  if (this.model.startwaarden.replace(/\r/g, '') != last.after.startwaarden ||
      this.model.modelregels.replace(/\r/g, '') != last.after.modelregels) {
    // the text was changed in the editor after that
    this.grafisch_history = [];
    $('#grafisch_undo').prop('disabled', true);
    this.grafisch_message('De tekst van het model is daarna veranderd. Gebruik Ctrl+Z in de tekst.');
    return;
  }
  this.write_model(last.before);
  clearTimeout(this.grafisch_timer);
  this.grafisch_form_new = false;
  this.grafisch_selected = last.selected;
  this.draw_grafisch_model();
};


//
// Grafisch model as input: a change in the diagram is a small change in the text
// of the model (grafisch-edit.js). The text stays the source: Ctrl+Z in the editor works.
//
ModelleertaalApp.prototype.write_model = function(model) {
  // put a model changed by the program in the editors
  if (this.CodeMirrorActive) {
    if (this.startwaarden_editor.getValue() != model.startwaarden) this.startwaarden_editor.setValue(model.startwaarden);
    if (this.modelregels_editor.getValue() != model.modelregels) this.modelregels_editor.setValue(model.modelregels);
  } else {
    $(this.dom_startwaarden).val(model.startwaarden);
    $(this.dom_modelregels).val(model.modelregels);
  }
  this.on_model_edited();
};


ModelleertaalApp.prototype.grafisch_message = function(text) {
  // in the open form, else under the diagram
  var inForm = $(this.dom_grafisch_form).find('.grafisch_form_melding');
  inForm.text(text || '');
  $(this.dom_grafisch_melding).text(inForm.length ? '' : (text || ''));
  if (inForm.length && text) this.grafisch_place_form();
};


ModelleertaalApp.prototype.grafisch_apply = function(ops, select) {
  // apply the edit operations (see grafisch-edit.js) to the text of the model. All or nothing.
  this.read_model();
  var model = {startwaarden: this.model.startwaarden, modelregels: this.model.modelregels};
  try {
    ops.forEach(function(op) {
      model = grafisch_edit.apply(model, op);
    });
  } catch (err) {
    this.grafisch_message(err.message);
    return false;
  }
  this.grafisch_message('');
  this.grafisch_history = this.grafisch_history || [];
  this.grafisch_history.push({
    before: {startwaarden: this.model.startwaarden.replace(/\r/g, ''), modelregels: this.model.modelregels.replace(/\r/g, '')},
    after: model, selected: this.grafisch_selected});
  $('#grafisch_undo').prop('disabled', false);
  this.write_model(model);
  clearTimeout(this.grafisch_timer);
  this.grafisch_form_new = false;
  this.grafisch_selected = select;
  this.draw_grafisch_model();
  return true;
};


ModelleertaalApp.prototype.grafisch_names = function() {
  // names of the variables in the diagram (for the buttons under a formula),
  // without the selected element itself
  var g = this.grafisch_g, names = [];
  if (!g) return names;
  var self_name = (this.grafisch_selected !== undefined && g.elements[this.grafisch_selected]) ?
    g.elements[this.grafisch_selected].name : null;
  g.order.forEach(function(id) {
    var name = g.elements[id].name;
    if (name && name != self_name && names.indexOf(name) == -1) names.push(name);
  });
  return names;
};


ModelleertaalApp.prototype.grafisch_form = function(title, note, fields, buttons, onchange) {
  // fields: [{key, label, value, placeholder, options: [{value, text}], formula: true}]
  // buttons: [{text, action: function(values)}]
  // onchange (optional), for an existing element: function(values, key). Every change is applied
  //   at once: with Enter, or when you leave the field. Returns false if the change is not possible
  //   (the text of the model is not changed, the field gets a red border).
  //   Without onchange the first button is also the Enter key (new elements: "Voeg toe").
  var self = this;
  var box = $(this.dom_grafisch_form).empty();
  if (!title) {
    this.grafisch_place_form();
    return;
  }
  var live = typeof onchange == 'function';
  var form = $('<form>').addClass('grafisch_form').attr('autocomplete', 'off');
  var inputs = {}, formulas = [];

  var values = function() {
    var v = {};
    for (var key in inputs) {
      if (inputs.hasOwnProperty(key)) v[key] = inputs[key].val();
    }
    return v;
  };
  var changed = function() {
    for (var key in inputs) {
      if (inputs.hasOwnProperty(key) && inputs[key].val() !== inputs[key].data('committed')) return true;
    }
    return false;
  };
  var commit = function(key) {
    // after the focus has moved on (Tab, click): apply, and keep the focus in the new form
    setTimeout(function() {
      if (!$.contains(document.documentElement, form[0]) || !changed()) return;
      var refocus = null, active = document.activeElement;
      for (var k in inputs) {
        if (inputs.hasOwnProperty(k) && inputs[k][0] === active) {
          refocus = {key: k, start: active.selectionStart, end: active.selectionEnd};
        }
      }
      self.grafisch_refocus = refocus;
      var ok = onchange(values(), key);
      self.grafisch_refocus = null;
      if (ok === false && $.contains(document.documentElement, form[0])) {
        // not possible: keep what the user typed, so it can be corrected
        if (inputs[key]) inputs[key].addClass('invalid');
        for (k in inputs) {
          if (inputs.hasOwnProperty(k)) inputs[k].data('committed', inputs[k].val());
        }
      }
    }, 0);
  };
  var close = function() {
    if (live && changed()) onchange(values());
    self.grafisch_form_new = false;
    self.grafisch_select(undefined);
  };

  form.append($('<h2>').text(title).append(
    $('<button type="button" title="Sluiten (Esc)" aria-label="Sluiten">').addClass('grafisch_sluit').html('&times;')
      .on('mousedown', function(event) { event.preventDefault(); })
      .click(close)));
  if (note) form.append($('<p>').addClass('grafisch_legenda').text(note));

  fields.forEach(function(f) {
    var input;
    if (f.options) {
      input = $('<select>');
      f.options.forEach(function(o) {
        input.append($('<option>').val(o.value).text(o.text));
      });
      input.val(f.value);
      if (live) input.on('change', function() { commit(f.key); });
    } else {
      input = $('<input type="text" spellcheck="false" autocapitalize="off">').val(f.value).attr('placeholder', f.placeholder || '');
      if (live) {
        input.on('blur', function() { commit(f.key); });
        input.on('keydown', function(event) {
          if (event.key == 'Enter') {
            event.preventDefault();
            commit(f.key);
          }
        });
      }
      input.on('input', function() { $(this).removeClass('invalid'); });
    }
    input.data('committed', input.val());
    inputs[f.key] = input;
    if (f.formula) formulas.push(input);
    form.append($('<label>').append($('<span>').text(f.label)).append(input));
  });

  // the names of the variables: a click puts the name in the formula (no typing mistakes)
  var names = this.grafisch_names();
  if (formulas.length && names.length) {
    var target = formulas[0];
    formulas.forEach(function(input) {
      input.on('focus', function() { target = input; });
    });
    var chips = $('<div>').addClass('grafisch_chips').append($('<span>').text('Invoegen:'));
    names.forEach(function(name) {
      chips.append($('<button type="button">').text(name).attr('title', 'Zet ' + name + ' in de formule')
        .on('mousedown', function(event) { event.preventDefault(); })   // the focus stays in the formula
        .click(function() {
          var el = target[0], text = target.val();
          var focused = document.activeElement === el;
          var start = focused ? el.selectionStart : text.length, end = focused ? el.selectionEnd : text.length;
          target.val(text.slice(0, start) + name + text.slice(end)).removeClass('invalid');
          el.focus();
          el.setSelectionRange(start + name.length, start + name.length);
        }));
    });
    form.append(chips);
  }

  var row = $('<div>').addClass('grafisch_form_knoppen');
  buttons.forEach(function(b, n) {
    var button = $('<button>').attr('type', (!live && n === 0) ? 'submit' : 'button').text(b.text).click(function(event) {
      event.preventDefault();
      b.action(values());
    });
    // a click on a button does not first apply the field you are typing in
    if (live) button.on('mousedown', function(event) { event.preventDefault(); });
    row.append(button);
  });
  form.append($('<div>').addClass('grafisch_form_melding').attr('role', 'alert'));
  if (buttons.length) form.append(row);
  if (live) form.on('submit', function(event) { event.preventDefault(); });
  box.append(form);
  // keys typed in the form are not for the diagram (Delete) or the model (Ctrl+Enter)
  form.on('pointerdown', function() { self.grafisch_focus = true; });
  this.grafisch_place_form();

  // the form was made again after a change: the cursor stays where it was
  var refocus = this.grafisch_refocus;
  if (refocus && inputs[refocus.key]) {
    inputs[refocus.key].focus();
    try {
      inputs[refocus.key][0].setSelectionRange(refocus.start, refocus.end);
    } catch (err) {
      // (select: no cursor)
    }
  }
  return form;
};


ModelleertaalApp.prototype.grafisch_new_form = function(kind) {
  // form for a new toestandsvariabele ('stock'), hulpvariabele ('aux') or constante ('const')
  var self = this;
  var close = {text: 'Annuleer', action: function() {
    self.grafisch_form_new = false;
    self.grafisch_select(undefined);
  }};
  this.grafisch_message('');
  this.grafisch_selected = undefined;
  this.grafisch_highlight_lines(undefined);
  this.grafisch_form_new = true;
  if (this.grafisch_g) this.render_grafisch_model();
  var form;
  if (kind == 'stock') {
    form = this.grafisch_form('Nieuwe toestandsvariabele',
      'Een grootheid die elke stap een beetje verandert, zoals de plaats x of de snelheid v. ' +
      'In de tekst komt: x = x + dx met dx = (verandering per tijdseenheid) * dt.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'bijvoorbeeld x'},
       {key: 'initial', label: 'Beginwaarde', value: '0', formula: true},
       {key: 'rate', label: 'Verandering per tijdseenheid', value: '', placeholder: 'formule, bijvoorbeeld v', formula: true}],
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply([{op: 'addStock', name: v.name, initial: v.initial, rate: v.rate}], $.trim(v.name));
      }}, close]);
  } else if (kind == 'aux') {
    form = this.grafisch_form('Nieuwe hulpvariabele', 'Een grootheid die elke stap met een formule wordt uitgerekend, zoals Fres.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'bijvoorbeeld Fres'},
       {key: 'text', label: 'Formule', value: '', placeholder: 'bijvoorbeeld Fz - Fw', formula: true}],
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply([{op: 'addAux', name: v.name, text: v.text}], $.trim(v.name));
      }}, close]);
  } else {
    form = this.grafisch_form('Nieuwe constante', 'Een grootheid die niet verandert, zoals de massa m. Komt bij de startwaarden.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'bijvoorbeeld m'},
       {key: 'text', label: 'Waarde', value: '', formula: true}],
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply([{op: 'addConstant', name: v.name, text: v.text}], $.trim(v.name));
      }}, close]);
  }
  form.find('input').first().focus();
};


ModelleertaalApp.prototype.grafisch_flow_form = function(stock, direction) {
  // new flow into ('in') or out of ('out') a toestandsvariabele or constante
  var self = this;
  this.grafisch_form_new = true;
  this.grafisch_message('');
  if (this.grafisch_g) this.render_grafisch_model();
  var form = this.grafisch_form(direction == 'in' ? 'Nieuwe stroom naar ' + stock : 'Nieuwe stroom uit ' + stock,
    'In de tekst komt: ' + stock + ' = ' + stock + (direction == 'in' ? ' + ' : ' - ') + 'naam, met naam = (stroomsterkte) * dt.',
    [{key: 'name', label: 'Naam', value: '', placeholder: 'd' + stock},
     {key: 'rate', label: 'Stroomsterkte (per tijdseenheid)', value: '', placeholder: 'formule', formula: true}],
    [{text: 'Voeg toe', action: function(v) {
      self.grafisch_apply([{op: 'addFlow', stock: stock, direction: direction, name: v.name, rate: v.rate}], stock);
    }}, {text: 'Annuleer', action: function() {
      self.grafisch_form_new = false;
      self.grafisch_select(stock);
    }}]);
  form.find('input').first().focus();
};


ModelleertaalApp.prototype.grafisch_select = function(id) {
  // select an element of the grafisch model and show the form with its properties
  var self = this, g = this.grafisch_g;
  var el = (g && id !== undefined && g.elements.hasOwnProperty(id)) ? g.elements[id] : undefined;
  var changed = (el ? id : undefined) !== this.grafisch_selected;
  this.grafisch_selected = el ? id : undefined;
  this.grafisch_form_new = false;
  if (changed) this.grafisch_message('');
  if (g && this.grafisch_layout) this.render_grafisch_model();
  // the lines in the text that belong to this symbol, and its row in Herkende elementen
  this.grafisch_highlight_lines(this.grafisch_selected);
  $(this.dom_grafisch_tabel).find('tr').removeClass('selected').filter(function() {
    return $(this).attr('data-id') === self.grafisch_selected;
  }).addClass('selected');
  if (!el) {
    this.grafisch_form(null);
    return;
  }

  var rename = function(ops, v) {
    // returns the id after the change of the name
    var name = $.trim(v.name);
    if (name === '' || name == el.name) return id;
    ops.push({op: 'rename', id: id, name: name});
    // a dragged element stays where it is under its new name
    ['', ':src', ':dst'].forEach(function(suffix) {
      if (self.grafisch_moved[id + suffix]) self.grafisch_moved[name + suffix] = self.grafisch_moved[id + suffix];
    });
    return name;
  };
  var apply = function(ops, select) {
    if (ops.length) return self.grafisch_apply(ops, select);
  };
  var remove = {text: 'Verwijder', action: function() {
    self.grafisch_apply([{op: 'remove', id: id}], undefined);
  }};
  var inflow = {text: '+ Stroom erin', action: function() { self.grafisch_flow_form(id, 'in'); }};
  var outflow = {text: '+ Stroom eruit', action: function() { self.grafisch_flow_form(id, 'out'); }};
  var manual = 'Dit kun je alleen in de tekst van het model aanpassen.';
  // a toestandsvariabele shows how it changes: the formulas of its flows
  var stockFlows = [];
  if (el.kind == 'stock' && !el.general && el.updates == 1) {
    [[el.inflows, 'Stroom erin'], [el.outflows, 'Stroom eruit']].forEach(function(side) {
      side[0].forEach(function(fid) {
        var f = g.elements[fid];
        if (fid.indexOf('#') != -1) return;
        var other = side[1] == 'Stroom erin' ? f.from : f.to;
        stockFlows.push({key: 'flow:' + fid, flow: fid, value: f.code, formula: true,
          label: side[1] + (other ? (side[1] == 'Stroom erin' ? ' (uit ' : ' (naar ') + other + ')' : '') +
                 (f.name ? ': ' + f.name + ' =' : '')});
      });
    });
  }

  switch (el.kind) {
    case 'stock':
      this.grafisch_form('Toestandsvariabele ' + el.name,
        (el.general || el.updates != 1) ? 'De stromen van ' + el.name + ' kun je alleen in de tekst aanpassen.' : '',
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Beginwaarde', value: el.initialCode, formula: true}].concat(stockFlows),
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.initialCode) ops.push({op: 'setDefinition', id: now, text: v.text});
          stockFlows.forEach(function(f) {
            if ($.trim(v[f.key]) != f.value) ops.push({op: 'setDefinition', id: f.flow, text: v[f.key]});
          });
          return apply(ops, now);
        });
      break;
    case 'const':
      this.grafisch_form('Constante ' + el.name, 'Met een stroom erin of eruit wordt het een toestandsvariabele.',
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Waarde', value: el.code, formula: true}],
        [inflow, outflow, remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          return apply(ops, now);
        });
      break;
    case 'aux':
      if (el.code === null) {
        this.grafisch_form('Hulpvariabele ' + el.name, el.definition + '. ' + manual,
          [{key: 'name', label: 'Naam', value: el.name}], [],
          function(v) {
            var ops = [], now = rename(ops, v);
            return apply(ops, now);
          });
        break;
      }
      this.grafisch_form('Hulpvariabele ' + el.name, '',
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Formule', value: el.code, formula: true}],
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          return apply(ops, now);
        });
      break;
    case 'flow':
      var ends = [{value: '', text: 'buiten (wolkje)'}];
      g.order.forEach(function(k) {
        var e = g.elements[k];
        if (e.kind == 'stock') ends.push({value: k, text: k});
        if (e.kind == 'const') ends.push({value: k, text: k + ' (constante, wordt toestandsvariabele)'});
      });
      this.grafisch_form('Stroom ' + (el.name || el.label),
        el.name ? (el.isRate ? 'Stroomsterkte per tijdseenheid: in de tekst staat ' + el.term + '.' : '') :
          'Deze stroom heeft geen naam: hij staat als ' + el.term + ' in de regel van ' + (el.to || el.from) + '.',
        [{key: 'name', label: 'Naam', value: el.name || '', placeholder: '(geen naam)'},
         {key: 'text', label: 'Formule', value: el.code, formula: true},
         {key: 'from', label: 'Van', value: el.from || '', options: ends},
         {key: 'to', label: 'Naar', value: el.to || '', options: ends}],
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          if (v.from != (el.from || '') || v.to != (el.to || '')) {
            ops.push({op: 'setFlowEnds', id: now, from: v.from || null, to: v.to || null});
            // a flow without a name gets a name: its id is not known here
            if (now == id && !el.name) now = undefined;
          }
          return apply(ops, now);
        });
      break;
    case 'unknown':
      this.grafisch_form('Onbekend: ' + el.name, el.name + ' wordt gebruikt, maar heeft nog geen waarde of formule.',
        [{key: 'text', label: 'Waarde of formule', value: '', formula: true}],
        [{text: 'Maak constante', action: function(v) {
          apply([{op: 'define', id: id, kind: 'const', text: v.text}], id);
        }}, {text: 'Maak hulpvariabele', action: function(v) {
          apply([{op: 'define', id: id, kind: 'aux', text: v.text}], id);
        }}]);
      break;
    case 'event':
      this.grafisch_form('Voorval', 'als ' + el.condition + ' dan ' + el.actions.join('; ') + '. ' + manual, [], []);
      break;
    default:
      this.grafisch_form(el.name, el.definition + '. ' + manual, [], []);
  }
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
  this.save_string('<?xml version="1.0" encoding="UTF-8"?>\n' + grafisch.toSVG(g, lay, {stijl: this.grafisch_stijl}), this.file_name('.svg', 'grafisch model'));
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

  var filename = this.file_name('.xml');
  this.read_model();

  var N = Number($(this.dom_nbox).val());
  if (isFinite(N) && N > 0) this.model.N = N;

  this.save_string(this.model.createBogusXMLString(), filename);
  // model is saved: do not warn for unsaved changes
  this.loaded = {modelregels: this.model.modelregels, startwaarden: this.model.startwaarden};
  this.autosave();
};


//
// Autosave: unsaved work is kept in the browser (localStorage), so it is not lost
// when the tab is closed. On the next visit the user can continue with it.
//
var AUTOSAVE_KEY = 'modelleertaal_autosave';
var AUTOSAVE_MAX_AGE = 30 * 24 * 3600 * 1000;   // 30 days
var SETTINGS_KEY = 'modelleertaal_instellingen';

function storage(action, value, key) {
  // localStorage can be blocked (private window, settings): then nothing is saved
  key = key || AUTOSAVE_KEY;
  try {
    if (action == 'get') return window.localStorage.getItem(key);
    if (action == 'set') window.localStorage.setItem(key, value);
    if (action == 'remove') window.localStorage.removeItem(key);
  } catch (err) {
    return null;
  }
  return null;
}


ModelleertaalApp.prototype.load_settings = function() {
  // settings of the user (Meer opties) from the last visit
  var settings;
  try {
    settings = JSON.parse(storage('get', null, SETTINGS_KEY)) || {};
  } catch (err) {
    settings = {};
  }
  var precision = Math.round(Number(settings.precision));
  if (precision >= 1 && precision <= 15) this.precision = precision;
  if (typeof settings.yaxis_zero == 'boolean') this.yaxis_autoscale = !settings.yaxis_zero;
  $(this.dom_precision).val(this.precision);
  $(this.dom_yaxis_zero).prop('checked', !this.yaxis_autoscale);
  this.set_grafisch_stijl(settings.grafisch_stijl, false);
  // Tekst | Tekst + grafisch is not remembered: every visit starts with Tekst
  this.set_weergave('tekst', false);
};


ModelleertaalApp.prototype.save_settings = function() {
  storage('set', JSON.stringify({precision: this.precision, yaxis_zero: !this.yaxis_autoscale,
                                 grafisch_stijl: this.grafisch_stijl}), SETTINGS_KEY);
};


ModelleertaalApp.prototype.schedule_autosave = function() {
  var self = this;
  clearTimeout(this.autosave_timer);
  this.autosave_timer = setTimeout(function() { self.autosave(); }, 1000);
};


ModelleertaalApp.prototype.autosave = function() {
  clearTimeout(this.autosave_timer);
  this.autosave_timer = undefined;
  if (this.is_modified()) {
    var text = this.current_text();
    storage('set', JSON.stringify({
      t: this.get_title(),
      m: text.modelregels,
      s: text.startwaarden,
      N: String($(this.dom_nbox).val()),
      time: Date.now()
    }));
    this.restore_pending = false;
  } else if (!this.restore_pending && !this.restore_check) {
    // (not while the user can still choose to continue with the saved work)
    storage('remove');
  }
};


ModelleertaalApp.prototype.read_autosave = function() {
  // the saved work, or null
  var saved;
  try {
    saved = JSON.parse(storage('get'));
  } catch (err) {
    saved = null;
  }
  if (!saved || typeof saved.m != 'string' || typeof saved.s != 'string') return null;
  var age = Date.now() - Number(saved.time);
  if (isNaN(age) || age > AUTOSAVE_MAX_AGE) {
    storage('remove');
    return null;
  }
  return saved;
};


ModelleertaalApp.prototype.offer_restore = function() {
  // ask if the user wants to continue with the work of the last visit
  var self = this;
  if (this.parse_url_hash().code) return;   // a shared link: open that model
  var saved = this.read_autosave();
  if (!saved) return;

  var when = '';
  try {
    when = ' (' + new Date(saved.time).toLocaleString('nl-NL',
      {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'}) + ')';
  } catch (err) {
    when = '';
  }
  this.restore_pending = true;
  this.show_message('info', 'Verder werken?',
    "Je was bezig met " + (saved.t ? "'" + saved.t + "'" : "een model") + when + ". Dat is nog niet opgeslagen.", [
      {text: 'Ga verder', action: function() { self.restore_autosave(saved); }},
      {text: 'Weggooien', action: function() {
        self.restore_pending = false;
        storage('remove');
        self.clear_message();
      }}
    ]);
};


ModelleertaalApp.prototype.restore_autosave = function(saved) {
  if (this.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
      'Als je verder gaat met het bewaarde model, gaan je wijzigingen verloren.\n\nBewaard model laden?')) {
    return;
  }
  this.model = new evaluator_js.Model();
  this.model.modelregels = saved.m;
  this.model.startwaarden = saved.s;
  var N = Number(saved.N);
  if (isFinite(N) && N >= 1) this.model.N = N;
  this.model_title = saved.t ? String(saved.t) : '';

  // in the menu, like a model from a shared link
  $(this.dom_model_keuze).find('option[value="restored"]').remove();
  $('<option/>').val('restored').text((this.model_title || 'Model') + ' (bewaard)').prependTo(this.dom_model_keuze);
  $(this.dom_model_keuze).val('restored');
  this.dropdown_value = 'restored';
  if (window.history.replaceState) {
    window.history.replaceState('', document.title, window.location.pathname + window.location.search);
  }

  this.init_app();
  // the restored model is not saved in a file: still warn before it is lost
  this.loaded = {modelregels: '', startwaarden: ''};
  this.restore_pending = false;
  this.autosave();
  this.print_status('Model van de vorige keer teruggezet. Druk op Run.');
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
  return base + '#code=' + deellink.encode({
    modelregels: this.model.modelregels,
    startwaarden: this.model.startwaarden,
    title: title,
    N: Number(String($(this.dom_nbox).val()).replace(',', '.'))
  });
};


ModelleertaalApp.prototype.get_title = function() {
  // title of the model (editable by the user, goes into the share link)
  return $.trim($(this.dom_titel).val() || '');
};


ModelleertaalApp.prototype.file_name = function(extension, suffix) {
  // name of a downloaded file: the title of the model (+ suffix), without characters
  // that are not allowed in a file name. 'Examen vwo 2005-I Champignon (x,t).png'
  var name = this.get_title() || 'model';
  if (suffix) name += ' ' + suffix;
  name = name.replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^[\s.]+|[\s.]+$/g, '');
  return (name || 'model') + extension;
};


ModelleertaalApp.prototype.graph_name = function() {
  // the graph that is shown, as in the thumbnails: (y,x)
  if (this.multiplot) return '(' + this.multi_yvars.join(',') + ' tegen ' + this.xvar + ')';
  return '(' + this.yvar + ',' + this.xvar + ')';
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
      // confirmation in the button itself, where the user is looking
      var button = $(self.dom_permalink);
      if (!button.data('text')) button.data('text', button.text());
      button.text('Link gekopieerd ✓').addClass('done');
      clearTimeout(self.permalink_timer);
      self.permalink_timer = setTimeout(function() {
        button.text(button.data('text')).removeClass('done');
      }, 2000);
    }, fallback);
  } else {
    fallback();
  }
};


ModelleertaalApp.prototype.download_pgfplot = function() {
  // save the plot in TikZ/PGFPlot format
  var data = this.create_pgfplot();
  if (data === false) return;
  this.save_string(data, this.file_name('.tex', this.graph_name()));
};


ModelleertaalApp.prototype.download_tsv = function() {
  // download the results in TSV format.
  if (!this.require_results()) return;
  this.save_string(this.create_tsv(), this.file_name('.tsv'));
};


ModelleertaalApp.prototype.download_svg = function() {
  // download SVG Plot.
  var data = this.create_svgplot();
  if (data === false) return;
  this.save_string(data, this.file_name('.svg', this.graph_name()));
};


ModelleertaalApp.prototype.download_png = function() {
  // the graph as shown (with axes and labels) as a PNG image.
  // Flot draws the lines on canvases and the text in an SVG layer: compose them.
  var self = this;
  if (!this.require_results() || !this.plot_object) return;
  var sources = $(this.dom_graph).find('canvas, svg').toArray();
  var composed = document.createElement('canvas');
  var filename = this.file_name('.png', this.graph_name());
  var legend = this.multiplot ? this.multi_yvars.slice() : [];

  $.plot.composeImages(sources, composed).then(function() {
    var out = document.createElement('canvas');
    out.width = composed.width;
    out.height = composed.height;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(composed, 0, 0);
    // several graphs: the colours are next to the checkboxes on screen, put them in the image
    var scale = out.width / Math.max(1, $(self.dom_graph).width());
    ctx.font = Math.round(13 * scale) + 'px sans-serif';
    ctx.textBaseline = 'middle';
    legend.forEach(function(name, n) {
      var y = (16 + 18 * n) * scale, x = out.width - 110 * scale;
      ctx.fillStyle = COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length];
      ctx.fillRect(x, y - 2 * scale, 18 * scale, 4 * scale);
      ctx.fillStyle = '#111827';
      ctx.fillText(name, x + 24 * scale, y);
    });
    out.toBlob(function(blob) {
      FileSaver.saveAs(blob, filename);
    }, 'image/png');
  }, function() {
    self.show_message('error', 'Niet gelukt', 'De grafiek kon niet als plaatje worden opgeslagen.');
  });
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


ModelleertaalApp.prototype.stopped_by_model = function() {
  // the last run was stopped by 'stop' (or print): continuing is not possible
  if (!(this.has_run && this.evaluator && this.evaluator.stopped)) return false;
  this.show_message('info', 'Het model is gestopt',
    "Verder rekenen kan niet: het model is gestopt door 'stop'. Druk op Run om opnieuw te beginnen.");
  return true;
};


ModelleertaalApp.prototype.continue_run = function() {

  if (this.stopped_by_model()) return false;

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

  if (this.stopped_by_model()) return false;

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
  $(this.dom_download_tsv + ',' + this.dom_download_png).prop('hidden', false);

  this.analysis = autoplot.analyse(this.allVars, this.results, this.evaluator.modelregels_ast);
  this.graphs = this.analysis.graphs;

  this.choose_axes();
  this.update_axis_controls();

  this.print_table();
  this.do_plot();
  this.draw_thumbnails();

  this.print_run_status();
  this.check_results();
  // values in the tooltips of the diagram
  if (this.grafisch_open() && this.grafisch_g) this.render_grafisch_model();
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

  if (!this.evaluator.stopped && contains_stop(this.evaluator.modelregels_ast)) {
    // the model has a stop condition, but did not get there: the graph is not finished
    var self = this;
    $(this.dom_status).append(document.createTextNode(" Het model is nog niet bij 'stop' gekomen."))
      .append($('<button type="button">').addClass('inline_action')
        .text('Verdubbel aantal iteraties')
        .click(function() {
          var N = Math.round(Number(String($(self.dom_nbox).val()).replace(',', '.')));
          if (!isFinite(N) || N < 1) N = self.results.length - 1;
          $(self.dom_nbox).val(Math.min(2 * N, N_MAX));
          self.update_endtime_hint(false);
          $(self.dom_run).click();
        }));
  }
};


function contains_stop(ast) {
  // is there a 'stop' in the modelregels (also inside als ... dan ... eindals)?
  for (var i = 0; i < (ast || []).length; i++) {
    var stmt = ast[i];
    if (stmt.type == 'Stop') return true;
    if ((stmt.type == 'If' || stmt.type == 'IfElse') &&
        (contains_stop(stmt.then) || contains_stop(stmt.elsestmt))) return true;
  }
  return false;
}


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
  if (!isFinite(max_rows) || max_rows < 2) {
    $(this.dom_max_rows).val(this.max_rows_in_plot);
    return;
  }
  this.max_rows_in_plot = max_rows;
  if (this.results_available()) this.do_plot();
};

ModelleertaalApp.prototype.set_precision = function(precision) {
  precision = Math.round(Number(precision));
  if (!isFinite(precision) || precision < 1 || precision > 15) {
    $(this.dom_precision).val(this.precision);
    return;
  }
  this.precision = precision;
  this.save_settings();
  this.update_endtime_hint(false);
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
  $(this.dom_nbox).val(this.url_N || this.model.N || this.N_default);
  this.url_N = undefined;   // only for the model that the link opens
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
  $(this.dom_download_tsv + ',' + this.dom_download_png).prop('hidden', true);
  $(this.dom_datatable).empty().append(
    $('<div>').addClass('placeholder').text('Hier komt de tabel met resultaten.'));
  this.print_status("Model geladen. Druk op Run.");
  this.update_endtime_hint(true);
  if (this.restore_check) {
    this.restore_check = false;
    this.offer_restore();
  } else if (!this.starting) {
    // another model is loaded: the saved work is no longer needed
    this.autosave();
  }
  if (this.link_error && !this.starting) {
    // the Deel link could not be read: say so (another model is shown instead)
    this.show_message('error', 'Link niet gelezen', this.link_error + ' Je ziet nu een ander model.');
    this.print_status('Het model uit de link kon niet geladen worden.');
    this.link_error = undefined;
  }
  this.grafisch_moved = {};   // other model: forget dragged positions
  this.grafisch_zoom = null;
  this.grafisch_history = [];
  this.grafisch_selected = undefined;
  this.grafisch_linked = undefined;
  this.grafisch_highlight_lines(undefined);
  $('#grafisch_undo').prop('disabled', true);
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


exports.ModelleertaalApp = ModelleertaalApp;
