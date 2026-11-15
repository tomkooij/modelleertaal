var evaluator_js = require('./evaluator.js');
var autoplot = require('./autoplot.js');
var deellink = require('./deellink.js');
var grafisch = require('./grafisch.js');
var grafisch_edit = require('./grafisch-edit.js');
var stapper = require('./stapper.js');
var vergelijk = require('./vergelijk.js');
var dtcheck = require('./dtcheck.js');
var modelkeuze = require('./modelkeuze.js');
var eenheden = require('./eenheden.js');
var aflezen = require('./aflezen.js');
var assen = require('./assen.js');
var hints = require('./hints.js');
var oorzaak = require('./oorzaak.js');
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
var version = "v6.6-dev";

var COLOR_PLOT = '#1d4ed8';
var COLOR_PREVIOUS = '#c3c8d1';
var COLOR_READ = '#d97706';   // Aflezen: the point that was clicked, its lines and the tangent
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
  this.dom_run = "#run";
  this.dom_step = "#stap";
  this.dom_step_line = "#stap_regel";
  this.dom_fileinput = "#fileinput";
  this.dom_download_xml = "#download_xml";
  this.dom_download_pgf = "#download_pgf";
  this.dom_download_tsv = "#download_tsv";
  this.dom_download_svg = "#download_svg";
  this.dom_download_png = "#download_png";
  this.dom_precision = "#precision";
  this.dom_max_rows = "#max_rows";
  this.dom_x_var = "#x_var";
  this.dom_y_var = "#y_var";
  this.dom_y_checks = "#y_checks";
  this.dom_x_pick = "#x_pick";
  this.dom_y_pick = "#y_pick";
  this.dom_zoom_reset = "#zoom_reset";
  this.dom_multiplot = "#multiplot";
  this.dom_yaxis_zero = "#yaxis_zero";
  this.dom_model_keuze = "#model_keuze";
  this.dom_model_groep = "#model_groep";
  this.dom_permalink = "#permalink";
  this.dom_titel = "#model_titel";
  this.dom_opdracht = "#opdracht";
  this.dom_opdracht_tekst = "#opdracht_tekst";
  this.dom_opdracht_invoer = "#opdracht_invoer";
  this.opdracht = '';   // the assignment with the model (shown above the model)
  this.dom_grafisch = "#grafisch_model";
  this.dom_grafisch_svg = "#grafisch_svg";
  this.dom_view_switch = ".view_switch";
  this.dom_workspace = ".workspace";
  this.dom_grafisch_tabel = "#grafisch_tabel";
  this.dom_functies_tabel = "#functies_tabel";
  this.weergave = 'tekst';   // 'tekst' or 'grafisch' (text and diagram)
  this.grafisch_stijl = 'examen';   // style of the diagram: 'examen' or 'kleur' (see grafisch.js)
  this.grafisch_formules = false;   // a box with the formula next to every symbol (exams 2015, 2016)
  this.dom_grafisch_formules = "#grafisch_formules";
  this.grafisch_eenheden = false;   // units in the diagram and a field Eenheid in the forms
  this.dom_grafisch_eenheden = "#grafisch_eenheden";
  this.dom_download_grafisch = "#download_grafisch";
  this.dom_grafisch_reset = "#grafisch_herstel";
  this.dom_grafisch_form = "#grafisch_eigenschappen";
  this.dom_grafisch_melding = "#grafisch_melding";
  this.grafisch_selected = undefined;   // id of the selected element
  this.grafisch_moved = {};   // positions of elements dragged by the user
  this.model_title = '';
  this.units = {};   // name --> unit, from the comments of the model (eenheden.js)

  this.read_model();
  this.fill_functies();

  function run_from_keyboard() {
    $(self.dom_run).click();
  }

  if ((this.CodeMirror) && (typeof(CodeMirror) == 'function')) {
    var codemirror_options = {
      lineNumbers: true,
      gutters: ['CodeMirror-linenumbers', 'mt-error-markers'],
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

  $(this.dom_step).click(function() {
    self.step();
  });

  $(this.dom_nbox).on('keydown', function(event) {
    if (event.key == 'Enter') {
      event.preventDefault();
      $(self.dom_run).click();
    }
  });

  // Houd vast: keep the gray line of a run as a reference
  $(this.dom_graph_note).on('click', 'button.pin', function() {
    self.pinned = !self.pinned;
    self.do_plot();
  });

  $(this.dom_nbox).on('input', function() {
    self.update_endtime_hint(false);
    self.schedule_autosave();
  });

  // first menu: another groep shows its models. A model is loaded when it is chosen in the second menu.
  $(this.dom_model_groep).change(function() {
    self.dropdown_fill($(this).val());
  });

  $(this.dom_model_keuze).change(function() {
    if ($(this).val() === '') return;   // "Kies een model..."
    if (self.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
        'Als je een ander model kiest, gaan je wijzigingen verloren.\n\nAnder model laden?')) {
      self.dropdown_fill(self.dropdown_groep);
      return;
    }
    self.dropdown_load_model();
  });

  $(window).on('hashchange', function() {
    // user opens another link (#model=...) in the same tab. Changed model: ask first, as with the menu.
    var url_params = self.parse_url_hash();
    if (!url_params.model && !url_params.code) return;
    if (self.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
        'Als je de nieuwe link opent, gaan je wijzigingen verloren.\n\nNieuwe link openen?')) return;
    self.load_model();
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

  // Opdracht bij dit model (Meer opties): shown above the model, goes into Deel link
  $(this.dom_opdracht_invoer).on('input', function() {
    self.set_opdracht($(this).val(), false);
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
  // Formules: a box with the formula or beginwaarde next to every symbol
  $(this.dom_grafisch_eenheden).on('change', function() {
    self.set_grafisch_eenheden($(this).prop('checked'), true);
  });
  $(this.dom_grafisch_formules).on('change', function() {
    self.set_grafisch_formules($(this).prop('checked'), true);
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
    self.schedule_autosave();
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
    // the new layout is kept (autosave, Bewaar, Deel link)
    if (drag && drag.moved) self.schedule_autosave();
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
    // the focus in the diagram or its form also counts (after a click on a button of the toolbar)
    var inside = $(event.target).closest(self.dom_grafisch).length > 0;
    if (!(self.grafisch_focus || inside) || !self.grafisch_open()) return;
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
  $('#grafisch_nieuw_voorwaarde').click(function() { self.grafisch_new_form('event'); });
  $('#grafisch_nieuw_model').click(function() { self.new_empty_model(); });
  // the unit of dt (with the toggle eenheden)
  $('#grafisch_dt_eenheid').on('change', function() {
    var dt = self.grafisch_g ? self.grafisch_g.dt : 'dt';
    if (!self.grafisch_apply([{op: 'setUnit', name: dt, unit: $(this).val()}], self.grafisch_selected, {noform: self.grafisch_noform})) {
      $(this).addClass('invalid');
    }
  }).on('input', function() { $(this).removeClass('invalid'); })
    .on('keydown', function(event) { if (event.key == 'Enter') { event.preventDefault(); $(this).trigger('change'); } });
  // Tab takes over the derived unit (not the word 'eenheid')
  grafisch_accept_on_tab($('#grafisch_dt_eenheid'), function(text) { return text != 'eenheid'; });
  // dt: the startwaarde of the time step
  $('#grafisch_dt').on('change', function() {
    var text = $.trim($(this).val());
    if (text === '') return self.grafisch_show_dt();
    if (!self.grafisch_apply([{op: 'setDt', text: text}], self.grafisch_selected, {noform: self.grafisch_noform})) {
      $(this).addClass('invalid');
    }
  }).on('input', function() { $(this).removeClass('invalid'); })
    .on('keydown', function(event) { if (event.key == 'Enter') { event.preventDefault(); $(this).trigger('change'); } });

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

  // Aflezen: a click on a point shows it with lines to the axes, and its row in the table.
  // A click next to the graph line removes it.
  // Inzoomen: drag a rectangle in the graph. Double click or Hele grafiek: back.
  // Not on a touch screen (dragging there scrolls the page).
  this.zoom_enabled = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  this.zoom = null;
  var zoom_drag = null;
  $(this.dom_graph).on('mousedown', function(event) {
    if (!self.zoom_enabled || event.button !== 0 || !self.plot_object || !self.results_available()) return;
    var p = self.zoom_position(event);
    if (!p.inside) return;
    zoom_drag = {x0: p.x, y0: p.y, x1: p.x, y1: p.y, box: null};
    event.preventDefault();
  });
  $(window).on('mousemove', function(event) {
    if (!zoom_drag) return;
    var p = self.zoom_position(event);
    zoom_drag.x1 = p.x;
    zoom_drag.y1 = p.y;
    if (!zoom_drag.box && Math.abs(p.x - zoom_drag.x0) + Math.abs(p.y - zoom_drag.y0) < 6) return;
    if (!zoom_drag.box) zoom_drag.box = $('<div class="zoom_box">').appendTo(self.dom_graph);
    var off = self.plot_object.getPlotOffset();
    zoom_drag.box.css({
      left: off.left + Math.min(zoom_drag.x0, p.x) + 'px',
      top: off.top + Math.min(zoom_drag.y0, p.y) + 'px',
      width: Math.abs(p.x - zoom_drag.x0) + 'px',
      height: Math.abs(p.y - zoom_drag.y0) + 'px'
    });
  });
  $(window).on('mouseup', function() {
    if (!zoom_drag) return;
    var d = zoom_drag;
    zoom_drag = null;
    if (!d.box) return;   // a click, not a rectangle
    d.box.remove();
    if (Math.abs(d.x1 - d.x0) < 6 || Math.abs(d.y1 - d.y0) < 6) return;
    var ranges = {};
    $.each(self.plot_object.getAxes(), function(name, axis) {
      if (!axis.used) return;
      var a = axis.c2p(axis.direction == 'x' ? d.x0 : d.y0), b = axis.c2p(axis.direction == 'x' ? d.x1 : d.y1);
      ranges[name] = {from: Math.min(a, b), to: Math.max(a, b)};
    });
    self.zoom = {key: self.zoom_key(), ranges: ranges};
    self.zoom_time = Date.now();
    self.do_plot();
  });
  $(this.dom_graph).on('dblclick', function() {
    self.set_zoom(null);
  });
  $(this.dom_zoom_reset).click(function() {
    self.set_zoom(null);
  });

  $(this.dom_graph).on("plotclick", function(event, pos, item) {
    // the end of dragging a rectangle (zoom) is not a click. Stap voor stap: no reading off.
    if (self.zoom_time && Date.now() - self.zoom_time < 400) return;
    if (self.stepper) return;
    if (self.read && self.near_tangent(pos)) {
      self.set_read($.extend({}, self.read, {tangent: !self.read.tangent}));
      return;
    }
    if (item && item.series.mt_read) return;
    if (!item || item.series.mt_previous || !item.series.mt_yvar) {
      self.set_read(null);
      return;
    }
    var row = self.get_result_rowIndex(item.dataIndex, item.series.data.length);
    var same = self.read && self.read.row == row && self.read.yvar == item.series.mt_yvar;
    self.set_read(same ? null : {row: row, yvar: item.series.mt_yvar});
  });

  $(this.dom_graph).on("plothover", function(event, pos) {
    $(this).toggleClass('over_tangent', Boolean(self.read && self.near_tangent(pos)));
  });

  // and the other way around: a click on a row of the table puts the point in the graph
  $(this.dom_datatable).on('click', 'tbody tr[data-row]', function() {
    if (self.stepper || !self.results_available()) return;
    var row = Number($(this).attr('data-row'));
    var yvar = self.yvar;
    if (self.multiplot) {
      yvar = (self.read && self.multi_yvars.indexOf(self.read.yvar) != -1) ? self.read.yvar : self.multi_yvars[0];
    }
    if (!yvar) return;
    self.set_read((self.read && self.read.row == row) ? null : {row: row, yvar: yvar});
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
      this.model.opdracht = shared.opdracht;
      this.model.indeling = JSON.stringify(shared.indeling);
      this.model_title = shared.title || 'Gedeeld model';
      this.dropdown_extra('shared', this.model_title + ' (uit link)');
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
    var index = modelkeuze.zoek_url(this.model_index, model_url);
    if (index != -1) {
      // set dropdowns (groep and model) to selected model
      this.dropdown_select(index);
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
  // maak de keuzemenu's uit models.js: verzameling (groep) en model (see modelkeuze.js)
  var groepen = modelkeuze.groepen(this.model_index);
  var groep_menu = $(this.dom_model_groep).empty();
  groepen.forEach(function(groep) {
    $('<option/>').val(groep).text(groep).appendTo(groep_menu);
  });
  // only one groep: no need to choose
  groep_menu.toggle(groepen.length > 1);

  var entry = this.model_index[this.dropdown_value];
  var groep = entry ? modelkeuze.groep_van(entry) : (this.dropdown_groep || groepen[0]);
  this.dropdown_fill(groep, this.dropdown_value === undefined);
};


ModelleertaalApp.prototype.dropdown_fill = function(groep, select_first) {
  // fill the model menu with the models of one groep, with a heading (optgroup) per sectie.
  // The current model is selected. If it is not in this groep: "Kies een model"
  // (or the first model, select_first).
  var self = this;
  var menu = $(this.dom_model_keuze).empty();
  this.dropdown_groep = groep;
  $(this.dom_model_groep).val(groep);

  modelkeuze.secties(this.model_index, groep).forEach(function(s) {
    var parent = s.sectie ? $('<optgroup/>').attr('label', s.sectie).appendTo(menu) : menu;
    s.modellen.forEach(function(m) {
      $('<option/>').val(m.index).text(m.title).appendTo(parent);
    });
  });

  var current = String(this.dropdown_value);
  if (menu.find('option').filter(function() { return this.value === current; }).length) {
    menu.val(current);
  } else if (this.dropdown_extra_option && this.dropdown_extra_option.value === current) {
    // a model from a link or the browser (not in models.js)
    $('<option/>').val(current).text(this.dropdown_extra_option.text).prependTo(menu);
    menu.val(current);
  } else if (select_first) {
    menu.prop('selectedIndex', 0);
  } else {
    $('<option/>').val('').text('Kies een model…').prependTo(menu);
    menu.val('');
  }
};


ModelleertaalApp.prototype.dropdown_select = function(index) {
  // show model index in the menus (its groep in the first menu)
  this.dropdown_value = String(index);
  this.dropdown_fill(modelkeuze.groep_van(this.model_index[index]));
};


ModelleertaalApp.prototype.dropdown_extra = function(value, text) {
  // a model that is not in models.js ('shared': from a link, 'restored': from the browser)
  this.dropdown_extra_option = {value: value, text: text};
  this.dropdown_value = value;
  this.dropdown_fill(this.dropdown_groep || modelkeuze.groepen(this.model_index)[0]);
};


ModelleertaalApp.prototype.model_name_from_url = function(url) {
  // modellen/naam.xml --> naam, modellen/c2/naam.xml --> c2/naam
  return modelkeuze.naam_van_url(url);
};


ModelleertaalApp.prototype.dropdown_load_model = function() {

  var model_keuze = $(this.dom_model_keuze).val();
  if (!this.model_index[model_keuze]) return;
  this.dropdown_value = model_keuze;
  this.dropdown_fill(this.dropdown_groep);   // without "Kies een model..."

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


ModelleertaalApp.prototype.new_empty_model = function() {
  // Nieuw model (above the diagram): Basismodellen -> Leeg model, also when that is already chosen.
  // Changed model: ask first, as with the menu
  var index = null;
  // the same file is also in other groups ("0 Leeg model"): the first one is Basismodellen
  for (var i = 0; i < this.model_index.length && index === null; i++) {
    if (/(^|\/)leeg\.xml$/.test(this.model_index[i].url)) index = i;
  }
  if (index === null) return;
  if (this.is_modified() && !window.confirm('Je hebt dit model aangepast.\n' +
      'Als je opnieuw begint, gaan je wijzigingen verloren.\n\nNieuw leeg model?')) return;
  this.dropdown_select(index);
  $(this.dom_model_keuze).val(String(index));
  this.grafisch_history = [];
  $('#grafisch_undo').prop('disabled', true);
  this.dropdown_load_model();
};


ModelleertaalApp.prototype.read_model = function() {
  // read model from textarea/CodeMirror. The <grafisch> section of the loaded file stays
  var grafisch = this.model ? this.model.grafisch : undefined;
  this.model = new evaluator_js.Model();
  if (grafisch) this.model.grafisch = grafisch;
  this.model.opdracht = this.opdracht;
  this.model.indeling = this.indeling_text();
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
         normalize(current.startwaarden) != normalize(this.loaded.startwaarden) ||
         normalize(this.opdracht) != normalize(this.loaded.opdracht || '') ||
         this.indeling_text() != (this.loaded.indeling || '');
};


ModelleertaalApp.prototype.indeling_text = function() {
  // the positions of the dragged symbols as JSON ({"id": [x, y]}), '' if none
  var out = {}, any = false;
  for (var id in this.grafisch_moved) {
    if (this.grafisch_moved.hasOwnProperty(id)) {
      out[id] = [this.grafisch_moved[id].x, this.grafisch_moved[id].y];
      any = true;
    }
  }
  return any ? JSON.stringify(out) : '';
};


ModelleertaalApp.prototype.set_indeling = function(text) {
  // positions from a file, link or autosave (see indeling_text)
  var parsed = {};
  try {
    parsed = deellink.positions(typeof text == 'string' ? (text ? JSON.parse(text) : {}) : text);
  } catch (err) {
    parsed = {};
  }
  this.grafisch_moved = {};
  for (var id in parsed) {
    if (parsed.hasOwnProperty(id)) this.grafisch_moved[id] = {x: parsed[id][0], y: parsed[id][1]};
  }
};


ModelleertaalApp.prototype.set_opdracht = function(text, update_input) {
  // the assignment above the model. Empty: no card.
  this.opdracht = String(text || '').replace(/\s+$/, '');
  $(this.dom_opdracht_tekst).text(this.opdracht);
  $(this.dom_opdracht).prop('hidden', !this.opdracht);
  if (update_input) $(this.dom_opdracht_invoer).val(this.opdracht);
};


ModelleertaalApp.prototype.on_model_edited = function() {
  // called on every change in the editors.
  var self = this;
  this.remove_highlight_error();
  // an error of the last Run is about the old model
  if ($(this.dom_message).hasClass('error')) this.clear_message();
  // typing ends Stap voor stap
  if (this.stepper) this.end_stepping();
  clearTimeout(this.hint_timer);
  this.hint_timer = setTimeout(function() { self.update_endtime_hint(true); }, 300);
  // 1 s after the last key: check the syntax, quietly (a red dot next to the line)
  clearTimeout(this.lint_timer);
  this.lint_timer = setTimeout(function() { self.silent_check(); }, 1000);
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


ModelleertaalApp.prototype.silent_check = function() {
  // only parse the model. A syntax error: a red dot in the line numbers, with the message
  // as title. No message bar and the cursor does not move: the full message comes with Run.
  this.remove_lint();
  if (!this.CodeMirrorActive) return;
  var model = new evaluator_js.Model();
  var text = this.current_text();
  model.startwaarden = text.startwaarden;
  model.modelregels = text.modelregels;
  try {
    // jshint nonew:false
    new evaluator_js.ModelregelsEvaluator(model, false);
  } catch (err) {
    // ... (to be filled in) or an empty model is not an error
    if (err.blank || err.empty) return;
    var editor = this.get_editor(err.parser_name);
    var line = err.parser_line;
    if (!editor || !line || line < 1) return;
    line = Math.min(line, editor.lineCount());
    var marker = $('<span class="mt-lint-marker" role="img">').text('\u25cf')
      .attr({'title': err.message || 'Fout in deze regel', 'aria-label': err.message || 'Fout in deze regel'});
    this.lint = {editor: editor, handle: editor.setGutterMarker(line - 1, 'mt-error-markers', marker[0])};
  }
};


ModelleertaalApp.prototype.remove_lint = function() {
  if (!this.lint) return;
  this.lint.editor.setGutterMarker(this.lint.handle, 'mt-error-markers', null);
  this.lint = undefined;
};


ModelleertaalApp.prototype.constant_values = function(names) {
  // values of startwaarden that stay constant (they are not in the table): name --> value
  var out = {};
  names = (names || []).filter(function(name) { return /^[^\s=]+$/.test(name); });
  if (!names.length) return out;
  var model = new evaluator_js.Model();
  model.startwaarden = this.model.startwaarden;
  model.modelregels = names.map(function(name) { return name + ' = ' + name; }).join('\n');
  try {
    var evaluator = new evaluator_js.ModelregelsEvaluator(model, false);
    evaluator.set_state(0, true, false);
    evaluator.run();
    var varNames = evaluator.namespace.varNames;
    names.forEach(function(name) {
      var j = varNames.indexOf(name);
      if (j != -1) out[name] = evaluator.result[0][j];
    });
  } catch (err) {
    // no values: the general message
  }
  return out;
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
    // with the unit of dt, if the model has one: × dt = 50 s
    var text_now = this.current_text();
    var unit = eenheden.units(text_now.startwaarden, text_now.modelregels).dt;
    if (unit) text += ' ' + unit;
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
  // the exam style leaves out some elements (formulas in the startwaarden): a new layout
  if (this.grafisch_open() && this.grafisch_g) this.draw_grafisch_model();
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.set_grafisch_eenheden = function(on, save) {
  // units: after the names in the diagram, and a field Eenheid in the forms
  this.grafisch_eenheden = !!on;
  $(this.dom_grafisch_eenheden).prop('checked', this.grafisch_eenheden);
  $('#grafisch_dt_eenheid').prop('hidden', !this.grafisch_eenheden);
  if (this.grafisch_open() && this.grafisch_g) {
    this.grafisch_form_new = false;
    this.draw_grafisch_model();
  }
  if (save) this.save_settings();
};


ModelleertaalApp.prototype.grafisch_unit = function(name) {
  // {explicit: unit in the text or '', derived: unit from the formulas or '', conflict: text or ''}
  var u = this.grafisch_units || {units: {}, explicit: {}, derived: {}, conflicts: {}};
  var has = function(o) { return !!name && o.hasOwnProperty(name); };
  return {explicit: has(u.explicit) ? u.explicit[name] : '',
          derived: has(u.derived) ? u.units[name] : '',
          conflict: has(u.conflicts) ? u.conflicts[name] : ''};
};


ModelleertaalApp.prototype.grafisch_unit_field = function(name, example) {
  // the field Eenheid (only with the toggle eenheden). The grey hint is the unit that follows
  // from the formulas (or an example): it is not taken over, an empty field means no unit
  if (!this.grafisch_eenheden) return [];
  var u = this.grafisch_unit(name);
  return [{key: 'unit', label: 'Eenheid', value: u.explicit, placeholder: u.derived || example || '', hint: true}];
};


ModelleertaalApp.prototype.grafisch_unit_ops = function(ops, name, v) {
  // ops for a new element: + its unit, and t and dt in s when they are made
  var self = this;
  if (this.grafisch_eenheden) {
    ops.forEach(function(op) { op.timeUnit = 's'; });
    if (v.unit !== undefined && $.trim(v.unit) !== '' && $.trim(v.unit) != self.grafisch_unit(name).explicit) {
      ops.push({op: 'setUnit', name: name, unit: v.unit});
    }
  }
  return ops;
};


ModelleertaalApp.prototype.set_grafisch_formules = function(on, save) {
  // the formulas next to the symbols, as in the exams 2015-I and 2016-I
  this.grafisch_formules = !!on;
  $(this.dom_grafisch_formules).prop('checked', this.grafisch_formules);
  // the boxes need more room: a new layout
  if (this.grafisch_open() && this.grafisch_g) this.draw_grafisch_model();
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
  if (save) {
    this.save_settings();
    // the view is kept with the unsaved work (see autosave)
    if (this.is_modified()) this.schedule_autosave();
  }
};


ModelleertaalApp.prototype.analyse_grafisch_model = function() {
  // grafisch.js analysis of the model in the editors. Throws on syntax errors.
  // Also: which lines of the text belong to which symbol (this.grafisch_lines)
  this.read_model();
  var ev = new evaluator_js.ModelregelsEvaluator(this.model, false);
  // <grafisch> in the model file: the arrows of the lines with ... (as in the exam figure)
  var g = grafisch.analyse(ev.startwaarden_ast, ev.modelregels_ast, {hints: this.model.grafisch});
  this.grafisch_lines = grafisch.lines(g, ev.startwaarden_ast, ev.modelregels_ast);
  this.grafisch_units = eenheden.derive(this.model.startwaarden, this.model.modelregels);
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
      'Nog geen model. Begin met een toestandsvariabele, zoals x (+ Toestandsvariabele). ' +
      'Klik daarna op een ? om die grootheid in te vullen. Of typ het model in de tekstvakken.' :
      'Geen grafisch model: ' + (err.message || 'fout in het model')));
    this.grafisch_g = undefined;
    this.grafisch_layout = undefined;
    this.grafisch_lines = undefined;
    $(this.dom_grafisch_tabel).empty();
    this.grafisch_select(undefined);
    this.grafisch_show_dt();
    return;
  }
  this.grafisch_g = g;
  this.grafisch_layout = grafisch.layout(g, {stijl: this.grafisch_stijl, formules: this.grafisch_formules});
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
  var table = $('<table>'), self = this;
  grafisch.table(g).forEach(function(row) {
    var unit = self.grafisch_eenheden && self.grafisch_units && self.grafisch_units.units.hasOwnProperty(row.name) ?
      ' (' + self.grafisch_units.units[row.name] + ')' : '';
    var tr = $('<tr>')
      .append($('<td>').text(row.kind))
      .append($('<td>').append($('<b>').text(row.name)).append(document.createTextNode(unit)))
      .append($('<td>').text(row.definition));
    if (row.id !== undefined) tr.attr('data-id', row.id).attr('title', 'Klik om ' + row.name + ' in het diagram te kiezen');
    table.append(tr);
  });
  $(this.dom_grafisch_tabel).empty().append(table);
  // the form of the selected element shows the new text of the model
  if (this.grafisch_selected !== undefined || !this.grafisch_form_new) {
    this.grafisch_select(this.grafisch_selected, {noform: this.grafisch_noform});
  }
  this.grafisch_show_dt();
};


ModelleertaalApp.prototype.grafisch_show_dt = function() {
  // the field dt = in the toolbar of the diagram
  var input = $('#grafisch_dt');
  if (!input.length || input.is(':focus')) return;
  var dt = null;
  try {
    this.read_model();
    dt = grafisch_edit.dtOf({startwaarden: this.model.startwaarden, modelregels: this.model.modelregels});
  } catch (err) {
    dt = null;
  }
  input.removeClass('invalid').val(dt && dt.text !== null ? dt.text : '')
    .attr('placeholder', dt ? '' : '?').prop('disabled', !dt);
  var u = this.grafisch_unit(dt ? dt.name : null), unit = $('#grafisch_dt_eenheid');
  if (!unit.is(':focus')) {
    unit.removeClass('invalid').val(u.explicit).attr('placeholder', u.derived || 'eenheid')
      .prop('disabled', !dt || dt.text === null).prop('hidden', !this.grafisch_eenheden);
  }
  $('#grafisch_dt_naam').text((dt ? dt.name : 'dt') + ' =');
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
              formules: this.grafisch_formules,
              units: this.grafisch_eenheden && this.grafisch_units ? this.grafisch_units.units : undefined,
              derivedUnits: this.grafisch_units ? this.grafisch_units.derived : undefined,
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
  // the form is a small window in the diagram (wide screens), at the place where it covers
  // the least: never the selected element, preferably not the elements connected to it.
  // Never outside the diagram: the diagram is made at least as high as the form.
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
  var minLeft = 8, maxLeft = Math.min(wrap.width, view.right - wrap.left) - formW - 8;
  var clamp = function(c) {
    return {left: Math.max(minLeft, Math.min(c.left, maxLeft)), top: Math.max(minTop, Math.min(c.top, maxTop))};
  };
  var self = this, g = this.grafisch_g, sel = this.grafisch_selected;
  // a new element for an unknown (?) variable: that symbol counts as the selected one
  var focus = sel === undefined && this.grafisch_form_new ? this.grafisch_form_focus : undefined;
  var rect = function(node) {
    var r = node.getBoundingClientRect();
    return {left: r.left - wrap.left, top: r.top - wrap.top, right: r.right - wrap.left, bottom: r.bottom - wrap.top};
  };
  var el = sel === undefined ? null : area.find('.selected').filter(function() {
    return $(this).attr('data-id') == sel;
  })[0];
  if (!el && focus) {
    el = area.find('[data-id]').filter(function() { return $(this).attr('data-id') == focus; })[0];
    sel = focus;
  }
  var pos = clamp({left: minLeft, top: minTop});
  if (!el && g) {
    // a new element: the corner or side of the diagram where the form covers the least
    var all = [];
    area.find('[data-id]').each(function() { all.push(rect(this)); });
    var cover = function(c) {
      var f = {left: c.left, top: c.top, right: c.left + formW, bottom: c.top + formH}, sum = 0;
      all.forEach(function(o) {
        var w = Math.min(f.right, o.right) - Math.max(f.left, o.left);
        var h = Math.min(f.bottom, o.bottom) - Math.max(f.top, o.top);
        if (w > 0 && h > 0) sum += w * h;
      });
      return sum;
    };
    var midTop = (minTop + maxTop) / 2;
    var spots = [{left: minLeft, top: minTop}, {left: maxLeft, top: minTop}, {left: minLeft, top: maxTop},
                 {left: maxLeft, top: maxTop}, {left: maxLeft, top: midTop}, {left: minLeft, top: midTop}];
    var bestNew = null;
    spots.forEach(function(c, n) {
      c = clamp(c);
      var score = cover(c) * 10 + n;
      if (!bestNew || score < bestNew.score) bestNew = {score: score, pos: c};
    });
    pos = bestNew.pos;
  }
  if (el && g) {
    // the selected symbol (with its + buttons), its neighbours and the rest of the diagram
    var r = rect(el);
    r = {left: r.left - 12, top: r.top - 12, right: r.right + 12, bottom: r.bottom + 12};
    var near = {};
    g.links.forEach(function(l) {
      if (l.from == sel) near[l.to] = true;
      if (l.to == sel) near[l.from] = true;
    });
    g.flows.forEach(function(f) {
      if (f.id == sel) { near[f.from] = true; near[f.to] = true; }
      if (f.from == sel || f.to == sel) near[f.id] = true;
    });
    var others = [];
    area.find('[data-id]').each(function() {
      var id = $(this).attr('data-id').replace(/:(src|dst)$/, '');
      if (id == sel) return;
      others.push({r: rect(this), weight: near[id] ? 20 : 1});
    });
    var overlap = function(a, b) {
      var w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return (w > 0 && h > 0) ? w * h : 0;
    };
    var midY = (r.top + r.bottom - formH) / 2, midX = (r.left + r.right - formW) / 2;
    var candidates = [
      {left: r.left, top: r.bottom + 4}, {left: midX, top: r.bottom + 4},
      {left: r.left, top: r.top - 4 - formH}, {left: midX, top: r.top - 4 - formH},
      {left: r.right + 6, top: midY}, {left: r.left - 6 - formW, top: midY},
      {left: r.right + 6, top: r.top}, {left: r.left - 6 - formW, top: r.top},
      {left: minLeft, top: minTop}, {left: maxLeft, top: minTop},
      {left: minLeft, top: maxTop}, {left: maxLeft, top: maxTop}];
    var best = null;
    candidates.forEach(function(c, n) {
      c = clamp(c);
      var f = {left: c.left, top: c.top, right: c.left + formW, bottom: c.top + formH};
      var score = overlap(f, r) * 1000 + n;   // the first candidates go first
      others.forEach(function(o) { score += overlap(f, o.r) * o.weight; });
      if (!best || score < best.score) best = {score: score, pos: c};
    });
    pos = best.pos;
  }
  box.css({left: Math.round(pos.left) + 'px', top: Math.round(pos.top) + 'px'});
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


ModelleertaalApp.prototype.grafisch_apply = function(ops, select, opts) {
  // apply the edit operations (see grafisch-edit.js) to the text of the model. All or nothing.
  // opts.noform: the element select is selected, but its form stays closed (after a new element)
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
  // nothing changed (dt = 0,1 again when the field loses the focus): no new drawing, so a form
  // that is being clicked is not replaced and the click and the keys after it are not lost
  if (model.startwaarden == this.model.startwaarden.replace(/\r/g, '') &&
      model.modelregels == this.model.modelregels.replace(/\r/g, '')) return true;
  this.grafisch_history = this.grafisch_history || [];
  this.grafisch_history.push({
    before: {startwaarden: this.model.startwaarden.replace(/\r/g, ''), modelregels: this.model.modelregels.replace(/\r/g, '')},
    after: model, selected: this.grafisch_selected});
  $('#grafisch_undo').prop('disabled', false);
  this.write_model(model);
  clearTimeout(this.grafisch_timer);
  this.grafisch_form_new = false;
  this.grafisch_selected = select;
  this.grafisch_noform = !!(opts && opts.noform);
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


function grafisch_accept_on_tab(input, ok) {
  var base = input.attr('title') || '';   // the own tooltip of the field stays
  // Tab (forward) in an empty field: the grey suggestion (placeholder) becomes the value, so it is
  // real input (and in a form of an existing element it is applied when the field is left).
  // ok (optional): function(placeholder) --> false for a placeholder that is not a value
  input.on('keydown', function(event) {
    var text = input.attr('placeholder') || '';
    if (event.key != 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if ($.trim(input.val()) !== '' || $.trim(text) === '' || (ok && !ok(text))) return;
    input.val(text).removeClass('invalid').trigger('change');
  });
  input.on('focus', function() {
    // the tooltip says so, with the suggestion of this moment
    var text = input.attr('placeholder') || '';
    var show = $.trim(input.val()) === '' && $.trim(text) !== '' && (!ok || ok(text));
    var tip = show ? (base ? base + '. ' : '') + 'Tab: ' + text + ' overnemen' : base;
    if (tip) input.attr('title', tip);
    else input.removeAttr('title');
  });
}


ModelleertaalApp.prototype.grafisch_form = function(title, note, fields, buttons, onchange, onenter) {
  // fields: [{key, label, value, placeholder, options: [{value, text}], formula: true}]
  //   Tab in an empty field takes over the grey example or suggestion (placeholder) as real input,
  //   unless accept: false (a placeholder that is not a value, such as 'geen').
  // buttons: [{text, action: function(values)}]
  // onchange (optional), for an existing element: function(values, key). Every change is applied
  //   at once: with Enter, or when you leave the field. Returns false if the change is not possible
  //   (the text of the model is not changed, the field gets a red border).
  //   Without onchange the first button is also the Enter key (new elements: "Voeg toe").
  // onenter (optional, without onchange): function(values) for the Enter key, instead of the first button.
  var self = this;
  var box = $(this.dom_grafisch_form).empty();
  if (!title) {
    this.grafisch_place_form();
    return;
  }
  var live = typeof onchange == 'function';
  var enter = !live && typeof onenter == 'function';
  var form = $('<form>').addClass('grafisch_form').attr('autocomplete', 'off');
  var inputs = {}, formulas = [];

  var values = function() {
    // a new element: an empty field with an example (placeholder) gets the example
    var v = {};
    for (var key in inputs) {
      if (!inputs.hasOwnProperty(key)) continue;
      v[key] = inputs[key].val();
      if (!live && !inputs[key].data('hint') && $.trim(v[key]) === '' && inputs[key].attr('placeholder')) {
        v[key] = inputs[key].attr('placeholder');
      }
    }
    return v;
  };
  var changed = function() {
    for (var key in inputs) {
      if (inputs.hasOwnProperty(key) && inputs[key].val() !== inputs[key].data('committed')) return true;
    }
    return false;
  };
  var done = function() {
    // Enter or OK: the element stays selected, the form closes (a click on the element opens it)
    self.grafisch_select(self.grafisch_selected, {noform: true});
  };
  var commit = function(key, finish) {
    // after the focus has moved on (Tab, click): apply, and keep the focus in the new form.
    // finish (Enter): close the form after a change that worked (or when nothing changed)
    setTimeout(function() {
      if (!$.contains(document.documentElement, form[0])) return;
      if (!changed()) {
        if (finish) done();
        return;
      }
      var refocus = null, active = document.activeElement;
      for (var k in inputs) {
        if (inputs.hasOwnProperty(k) && inputs[k][0] === active) {
          refocus = {key: k, start: active.selectionStart, end: active.selectionEnd};
        }
      }
      self.grafisch_refocus = refocus;
      var ok = onchange(values(), key);
      self.grafisch_refocus = null;
      if (finish && ok !== false) {
        done();
        return;
      }
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
            commit(f.key, true);
          }
        });
      }
      if (enter) {
        input.on('keydown', function(event) {
          if (event.key == 'Enter') {
            event.preventDefault();
            onenter(values());
          }
        });
      }
      input.on('input', function() { $(this).removeClass('invalid'); });
      if (f.accept !== false) grafisch_accept_on_tab(input);
    }
    input.data('committed', input.val());
    if (f.hint) input.data('hint', true).addClass('grafisch_hint');
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
  if (live && fields.length) {
    // OK: apply what is typed and close the form (the same as Enter)
    buttons = [{text: 'OK', action: function() { commit(null, true); }}].concat(buttons);
  }
  buttons.forEach(function(b, n) {
    var button = $('<button>').attr('type', (!live && !enter && n === 0) ? 'submit' : 'button').text(b.text).click(function(event) {
      event.preventDefault();
      b.action(values());
    });
    // a click on a button does not first apply the field you are typing in
    if (live) button.on('mousedown', function(event) { event.preventDefault(); });
    row.append(button);
  });
  form.append($('<div>').addClass('grafisch_form_melding').attr('role', 'alert'));
  if (buttons.length) form.append(row);
  if (live || enter) form.on('submit', function(event) { event.preventDefault(); });
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


ModelleertaalApp.prototype.grafisch_new_form = function(kind, name, value) {
  // form for a new toestandsvariabele ('stock'), hulpvariabele ('aux') or constante ('const').
  // name (optional): of an unknown (?) variable, that gets defined. value: what was typed for it
  var self = this;
  name = name || '';
  var close = {text: 'Annuleer', action: function() {
    self.grafisch_form_new = false;
    self.grafisch_select(undefined);
  }};
  // + Voorwaarde with a variable selected: that variable changes
  var g = this.grafisch_g, sel = (g && this.grafisch_selected !== undefined) ? g.elements[this.grafisch_selected] : null;
  var target = (sel && sel.name && ['stock', 'const', 'aux'].indexOf(sel.kind) != -1) ? sel.name : '';
  this.grafisch_message('');
  this.grafisch_selected = undefined;
  this.grafisch_form_focus = name || (kind == 'event' && target ? target : undefined);
  this.grafisch_highlight_lines(undefined);
  this.grafisch_form_new = true;
  if (this.grafisch_g) this.render_grafisch_model();
  var form;
  if (kind == 'stock') {
    var x = name || 'x';
    form = this.grafisch_form(name ? 'Toestandsvariabele ' + name : 'Nieuwe toestandsvariabele',
      'Een grootheid die elke stap een beetje verandert, zoals de plaats x of de snelheid v. ' +
      'In de tekst komt: ' + x + ' = ' + x + ' + d' + x + ' met d' + x + ' = (verandering per tijdseenheid) * dt.',
      [{key: 'name', label: 'Naam', value: name, placeholder: 'x'},
       {key: 'initial', label: 'Beginwaarde', value: value || '0', formula: true},
       {key: 'rate', label: 'Verandering per tijdseenheid', value: '', placeholder: name ? '' : 'v', formula: true}]
        .concat(this.grafisch_unit_field(name, name ? '' : 'm')),
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'addStock', name: v.name, initial: v.initial, rate: v.rate}],
          $.trim(v.name), v), $.trim(v.name), {noform: true});
      }}, close]);
  } else if (kind == 'event') {
    form = this.grafisch_form('Nieuwe voorwaarde',
      'Als de voorwaarde waar is, krijgt de variabele een nieuwe waarde (bijvoorbeeld: als t > 13 dan ' +
      'Opp = Opp + dOpp). Of het model stopt. In de tekst komt: als ... dan ... eindals.',
      [{key: 'condition', label: 'Als', value: '', placeholder: 't > 13', formula: true},
       {key: 'target', label: 'dan verandert', value: target, placeholder: 'Opp', hint: true},
       {key: 'text', label: 'in (nieuwe waarde)', value: '', placeholder: 'Opp + dOpp', formula: true, hint: true}],
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply([{op: 'addEvent', condition: v.condition, target: v.target, text: v.text}],
          $.trim(v.target) || undefined, {noform: true});
      }}, {text: 'Stop het model', action: function(v) {
        self.grafisch_apply([{op: 'addEvent', condition: v.condition, stop: true}], undefined);
      }}, close]);
    form.find('input').first().focus();
    return;
  } else if (kind == 'aux') {
    form = this.grafisch_form('Nieuwe hulpvariabele', 'Een grootheid die elke stap met een formule wordt uitgerekend, zoals Fres.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'Fres'},
       {key: 'text', label: 'Formule', value: '', placeholder: 'Fz - Fw', formula: true}]
        .concat(this.grafisch_unit_field(null, 'N')),
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'addAux', name: v.name, text: v.text}], $.trim(v.name), v),
          $.trim(v.name), {noform: true});
      }}, close]);
  } else {
    form = this.grafisch_form('Nieuwe constante', 'Een grootheid die niet verandert, zoals de massa m. Komt bij de startwaarden.',
      [{key: 'name', label: 'Naam', value: '', placeholder: 'm'},
       {key: 'text', label: 'Waarde', value: '', placeholder: '75', formula: true}]
        .concat(this.grafisch_unit_field(null, 'kg')),
      [{text: 'Voeg toe', action: function(v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'addConstant', name: v.name, text: v.text}], $.trim(v.name), v),
          $.trim(v.name), {noform: true});
      }}, close]);
  }
  // the first empty field (a name that is already filled in: the next one)
  var empty = form.find('input').filter(function() { return $(this).val() === ''; }).first();
  (name && empty.length ? empty : form.find('input').first()).focus();
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
     {key: 'rate', label: 'Stroomsterkte (per tijdseenheid)', value: '', placeholder: '0', formula: true}],
    [{text: 'Voeg toe', action: function(v) {
      self.grafisch_apply(self.grafisch_unit_ops([{op: 'addFlow', stock: stock, direction: direction, name: v.name, rate: v.rate}],
        stock, {}), stock, {noform: true});
    }}, {text: 'Annuleer', action: function() {
      self.grafisch_form_new = false;
      self.grafisch_select(stock);
    }}]);
  form.find('input').first().focus();
};


ModelleertaalApp.prototype.grafisch_select = function(id, opts) {
  // select an element of the grafisch model and show the form with its properties.
  // opts.noform: selected, but without the form (a click on the element opens it)
  var self = this, g = this.grafisch_g;
  this.grafisch_noform = !!(opts && opts.noform);
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
  if (!el || this.grafisch_noform) {
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
  // the field Eenheid (toggle eenheden), and a remark when the units do not fit
  var unit_name = el.name;
  var unit_fields = unit_name ? this.grafisch_unit_field(unit_name) : [];
  var unit_info = this.grafisch_unit(unit_name);
  var unit_note = function(note) {
    if (!self.grafisch_eenheden || !unit_info.conflict) return note;
    return (note ? note + ' ' : '') + 'Eenheid: ' + unit_info.conflict + '.';
  };
  var unit_op = function(ops, now, v) {
    if (unit_fields.length && $.trim(v.unit || '') != unit_info.explicit) ops.push({op: 'setUnit', name: now, unit: v.unit});
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
      // a maximum or minimum: als x > 42,6 dan x = 42,6 eindals (exam 2005-I)
      this.read_model();
      var limits = {max: '', min: ''};
      try {
        limits = grafisch_edit.limitsOf({startwaarden: this.model.startwaarden, modelregels: this.model.modelregels}, el.name);
      } catch (err) {
        limits = {max: '', min: ''};
      }
      var limit_fields = [{key: 'min', label: 'Minimum', value: limits.min, placeholder: 'geen', hint: true, accept: false, formula: true},
                          {key: 'max', label: 'Maximum', value: limits.max, placeholder: 'geen', hint: true, accept: false, formula: true}];
      this.grafisch_form('Toestandsvariabele ' + el.name,
        unit_note((el.general || el.updates != 1) ? 'De stromen van ' + el.name + ' kun je alleen in de tekst aanpassen.' : ''),
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Beginwaarde', value: el.initialCode, formula: true}].concat(unit_fields, stockFlows, limit_fields),
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.initialCode) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
          ['max', 'min'].forEach(function(b) {
            if ($.trim(v[b]) != limits[b]) ops.push({op: 'setLimit', name: now, bound: b, text: v[b]});
          });
          stockFlows.forEach(function(f) {
            if ($.trim(v[f.key]) != f.value) ops.push({op: 'setDefinition', id: f.flow, text: v[f.key]});
          });
          return apply(ops, now);
        });
      break;
    case 'const':
      this.grafisch_form('Constante ' + el.name, unit_note('Met een stroom erin of eruit wordt het een toestandsvariabele.'),
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Waarde', value: el.code, formula: true}].concat(unit_fields),
        [inflow, outflow, {text: 'Maak hulpvariabele', action: function() {
          apply([{op: 'convert', id: id, kind: 'aux'}], id);
        }}, remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
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
      var no_vars = false;
      try {
        no_vars = grafisch_edit.variablesOf(el.code).length === 0;
      } catch (err) {
        no_vars = false;
      }
      this.grafisch_form('Hulpvariabele ' + el.name, unit_note(''),
        [{key: 'name', label: 'Naam', value: el.name},
         {key: 'text', label: 'Formule', value: el.code, formula: true}].concat(unit_fields),
        (no_vars ? [{text: 'Maak constante', action: function() {
          apply([{op: 'convert', id: id, kind: 'const'}], id);
        }}] : []).concat([remove]),
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
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
        [{key: 'name', label: 'Naam', value: el.name || '', placeholder: '(geen naam)', accept: false},
         {key: 'text', label: 'Formule', value: el.code, formula: true}].concat(unit_fields, [
         {key: 'from', label: 'Van', value: el.from || '', options: ends},
         {key: 'to', label: 'Naar', value: el.to || '', options: ends}]),
        [remove],
        function(v) {
          var ops = [], now = rename(ops, v);
          if ($.trim(v.text) != el.code) ops.push({op: 'setDefinition', id: now, text: v.text});
          unit_op(ops, now, v);
          if (v.from != (el.from || '') || v.to != (el.to || '')) {
            ops.push({op: 'setFlowEnds', id: now, from: v.from || null, to: v.to || null});
            // a flow without a name gets a name: its id is not known here
            if (now == id && !el.name) now = undefined;
          }
          return apply(ops, now);
        });
      break;
    case 'unknown':
      var define = function(kind, v) {
        self.grafisch_apply(self.grafisch_unit_ops([{op: 'define', id: id, kind: kind, text: v.text}], el.name, v), id, {noform: true});
      };
      var unknown_form = this.grafisch_form('Onbekend: ' + el.name,
        el.name + ' wordt gebruikt, maar heeft nog geen waarde of formule. ' +
        'Enter: een getal wordt een constante, een formule met variabelen een hulpvariabele.',
        [{key: 'text', label: 'Waarde of formule', value: '', formula: true}].concat(unit_fields),
        [{text: 'Maak constante', action: function(v) { define('const', v); }},
         {text: 'Maak hulpvariabele', action: function(v) { define('aux', v); }},
         {text: 'Maak toestandsvariabele', action: function(v) { self.grafisch_new_form('stock', el.name, $.trim(v.text)); }}],
        undefined,
        function(v) {
          // Enter: a number (or an expression without variables) is a constant, else a hulpvariabele
          var vars;
          try {
            vars = grafisch_edit.variablesOf(v.text);
          } catch (err) {
            self.grafisch_message(err.message);
            return;
          }
          define(vars.length ? 'aux' : 'const', v);
        });
      unknown_form.find('input').first().focus();
      break;
    case 'event':
    case 'stop':
      // condition and new value can be changed when the voorval is one als-block (see grafisch-edit.js)
      this.read_model();
      var ev = null;
      try {
        ev = grafisch_edit.eventOf({startwaarden: this.model.startwaarden, modelregels: this.model.modelregels}, id);
      } catch (err) {
        ev = null;
      }
      var title = el.kind == 'stop' ? 'Stopvoorwaarde' : 'Voorval';
      if (!ev) {
        this.grafisch_form(title, (el.kind == 'stop' ? 'Het model stopt als ' + el.condition :
          'als ' + el.condition + ' dan ' + el.actions.join('; ')) + '. ' + manual, [], []);
        break;
      }
      var ev_fields = [{key: 'condition', label: 'Als', value: ev.condition, formula: true}];
      if (ev.target !== null) ev_fields.push({key: 'text', label: 'dan wordt ' + ev.target, value: ev.text, formula: true});
      this.grafisch_form(title,
        el.kind == 'stop' ? 'Het model stopt als de voorwaarde waar is.' :
          (ev.target === null ? 'als ' + el.condition + ' dan ' + el.actions.join('; ') + '. De nieuwe waarden kun je alleen in de tekst aanpassen.' :
           'Als de voorwaarde waar is, krijgt ' + ev.target + ' een nieuwe waarde.'),
        ev_fields, [remove],
        function(v) {
          var op = {op: 'setEvent', id: id};
          if ($.trim(v.condition) != ev.condition) op.condition = v.condition;
          if (ev.target !== null && $.trim(v.text) != ev.text) op.text = v.text;
          if (op.condition === undefined && op.text === undefined) return;
          // the id of a voorval is its number (~e1): it stays the same when the condition changes
          return self.grafisch_apply([op], id);
        });
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
  this.save_string('<?xml version="1.0" encoding="UTF-8"?>\n' + grafisch.toSVG(g, lay, {stijl: this.grafisch_stijl, formules: this.grafisch_formules,
    units: this.grafisch_eenheden && this.grafisch_units ? this.grafisch_units.units : undefined,
    derivedUnits: this.grafisch_units ? this.grafisch_units.derived : undefined}), this.file_name('.svg', 'grafisch model'));
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
  this.loaded = {modelregels: this.model.modelregels, startwaarden: this.model.startwaarden,
                 opdracht: this.opdracht, indeling: this.indeling_text()};
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
  this.set_grafisch_formules(settings.grafisch_formules === true, false);
  this.set_grafisch_eenheden(settings.grafisch_eenheden === true, false);
  // Tekst | Tekst + grafisch is not remembered: every visit starts with Tekst
  // (but Verder werken goes back to the view of the saved work, see autosave)
  this.set_weergave('tekst', false);
};


ModelleertaalApp.prototype.save_settings = function() {
  storage('set', JSON.stringify({precision: this.precision, yaxis_zero: !this.yaxis_autoscale,
                                 grafisch_stijl: this.grafisch_stijl,
                                 grafisch_formules: this.grafisch_formules,
                                 grafisch_eenheden: this.grafisch_eenheden}), SETTINGS_KEY);
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
      o: this.opdracht,
      p: this.indeling_text(),
      // the view (Tekst | Tekst + grafisch) goes with the work, not with the settings:
      // a new visit starts with Tekst (6.1.1), continuing with the work goes back to the diagram
      w: this.weergave,
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
  this.model.opdracht = saved.o ? String(saved.o) : '';
  this.model.indeling = saved.p ? String(saved.p) : '';
  this.model_title = saved.t ? String(saved.t) : '';

  // in the menu, like a model from a shared link
  this.dropdown_extra('restored', (this.model_title || 'Model') + ' (bewaard)');
  if (window.history.replaceState) {
    window.history.replaceState('', document.title, window.location.pathname + window.location.search);
  }

  this.init_app();
  if (saved.w == 'grafisch') this.set_weergave('grafisch', false);
  // the restored model is not saved in a file: still warn before it is lost
  this.loaded = {modelregels: '', startwaarden: '', opdracht: '', indeling: ''};
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
  var indeling = {};
  try {
    indeling = JSON.parse(this.indeling_text() || '{}');
  } catch (err) {
    indeling = {};
  }
  return base + '#code=' + deellink.encode({
    modelregels: this.model.modelregels,
    startwaarden: this.model.startwaarden,
    title: title,
    N: Number(String($(this.dom_nbox).val()).replace(',', '.')),
    opdracht: this.opdracht,
    indeling: indeling
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
  // (every \n, also the \n of an empty line)
  var blob = new Blob([data.replace(/\r?\n/g, "\r\n")], {
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

  // Run during Stap voor stap: compute the whole model again
  this.end_stepping();
  if (!this.setup_run()) return false;

  // keep the results of the previous run: plot in gray for comparison
  var previous = null;
  if (this.results_available() && this.last_source) {
    previous = {
      vars: this.allVars,
      rows: this.reduce_rows(this.results, this.max_rows_in_plot),
      source: this.last_source
    };
  }

  this.new_run = true;
  this.has_run = this.do_run();
  if (this.has_run) {
    // Houd vast: the gray line stays (the pinned run), else it is the previous run
    if (previous && !(this.pinned && this.previous)) this.previous = previous;
    if (!this.previous) this.pinned = false;
    this.last_source = vergelijk.source(this.evaluator.startwaarden_ast, this.evaluator.modelregels_ast, N);
    this.compare_text = this.previous ?
      vergelijk.describe(vergelijk.differences(this.previous.source, this.last_source)) : '';
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


ModelleertaalApp.prototype.format_text = function(x) {
  // number in a sentence (Dutch decimal comma): 0,981
  if (typeof x == 'boolean') return x ? 'waar' : 'onwaar';
  if (typeof x != 'number' || isNaN(x)) return '?';
  if (!isFinite(x)) return (x > 0) ? '\u221e' : '-\u221e';
  return String(Number(x.toPrecision(this.precision))).replace('.', ',');
};


//
// Stap voor stap: one modelregel per click, with the calculation in numbers (stapper.js)
//
ModelleertaalApp.prototype.step = function() {
  // first click (after loading, after a change, after a Run or at the end): start at the startwaarden
  if (!this.stepper || this.stepper.finished) {
    if (!this.start_stepping()) return false;
  }
  var step;
  try {
    step = this.stepper.step();
  } catch (err) {
    this.end_stepping();
    this.show_error(err);
    return false;
  }
  if (step) this.show_step(step);
  return true;
};


ModelleertaalApp.prototype.start_stepping = function() {
  var self = this;
  var N = this.read_N(this.dom_nbox);
  if (N === null) return false;

  this.end_stepping();
  this.remove_highlight_error();
  this.clear_message();
  this.read_model();
  this.units = eenheden.derive(this.model.startwaarden, this.model.modelregels).units;
  try {
    // check the model (and find the columns of the table) without computing an iteration
    var evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
    evaluator.set_state(0, true, false);
    evaluator.run();
    this.stepper = new stapper.Stepper(evaluator.startwaarden_ast, evaluator.modelregels_ast,
      evaluator.namespace.varNames, {N: N, format: function(x) { return self.format_text(x); }});
  } catch (err) {
    this.stepper = null;
    this.show_error(err);
    return false;
  }
  $(this.dom_datatable).addClass('stepping');
  return true;
};


ModelleertaalApp.prototype.show_step = function(step) {
  this.highlight_trace(step.line);
  if (this.CodeMirrorActive) {
    this.modelregels_editor.scrollIntoView({line: step.line - 1, ch: 0}, 40);
  }
  $(this.dom_step_line).text(step.text).prop('hidden', false);

  // the table: the cell that changed lights up
  this.step_mark = {row: step.iteration, column: this.stepper.varNames.indexOf(step.name)};
  this.print_table();
  this.plot_steps();

  var status;
  if (step.finished && this.stepper.stopped) {
    status = "Stap voor stap: het model is gestopt in iteratie " + step.iteration + ". Druk op Stap om opnieuw te beginnen.";
  } else if (step.finished) {
    status = "Stap voor stap: alle " + step.iteration + " iteraties zijn gedaan. Druk op Stap om opnieuw te beginnen.";
  } else if (step.end_of_iteration) {
    status = "Stap voor stap: iteratie " + step.iteration + " is klaar. De volgende stap begint weer bovenaan.";
  } else {
    status = "Stap voor stap: iteratie " + step.iteration + ".";
  }
  this.print_status(status);
};


ModelleertaalApp.prototype.end_stepping = function() {
  // back to the results of the last Run
  if (!this.stepper) return;
  this.stepper = null;
  this.step_mark = undefined;
  this.remove_highlight_trace();
  $(this.dom_step_line).prop('hidden', true).empty();
  $(this.dom_datatable).removeClass('stepping');
  $(this.dom_graph).removeClass('stepping');
  if (this.results_available()) {
    this.print_table();
    this.do_plot();
    this.print_status(this.stale ? "Model gewijzigd. Druk op Run." : "Klaar met stap voor stap. Druk op Run of Stap.");
  } else {
    $(this.dom_datatable).empty().append(
      $('<div>').addClass('placeholder').text('Hier komt de tabel met resultaten.'));
    if (this.plot_object) {
      this.plot_object.shutdown();
      this.plot_object = undefined;
    }
    $(this.dom_graph).empty().append(
      $('<div>').addClass('placeholder').text('Druk op Run om het model door te rekenen.'));
    $(this.dom_graph_note).empty();
    this.place_axis_picks();
    this.print_status("Druk op Run of Stap.");
  }
};


ModelleertaalApp.prototype.plot_steps = function() {
  // Stap voor stap: the graph of the last Run in gray (fixed axes), with the iterations
  // computed so far on top and a dot at the current point
  var self = this;
  if (!this.stepper) return;
  var rows = this.stepper.table(), vars = this.stepper.varNames;
  var x = this.xvar, ys = this.multiplot ? this.multi_yvars.slice() : [this.yvar];
  if (vars.indexOf(x) == -1) x = (vars.indexOf('t') != -1) ? 't' : vars[0];
  ys = ys.filter(function(name) { return vars.indexOf(name) != -1; });
  if (ys.length === 0) {
    var other = vars.filter(function(name) { return name != x; });
    if (other.length === 0) return;
    ys = [other[0]];
  }
  var last_run = this.results_available() ? this.reduce_rows(this.results, this.max_rows_in_plot) : null;
  var dataset = [], gray = false;
  ys.forEach(function(name, n) {
    var color = ys.length > 1 ? COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length] : COLOR_PLOT;
    var previous = last_run ? self.xy_data(last_run, self.allVars, x, name) : null;
    if (previous) {
      gray = true;
      dataset.push({data: previous, color: COLOR_PREVIOUS, points: {show: false}, hoverable: false, clickable: false});
    }
    var data = self.xy_data(rows, vars, x, name) || [];
    dataset.push({data: data, color: color, label: ys.length > 1 ? name : undefined, points: {show: data.length <= 60}});
    var now = null;
    for (var i = data.length - 1; i >= 0 && now === null; i--) now = data[i];
    if (now) {
      dataset.push({data: [now], color: COLOR_READ, lines: {show: false},
                    points: {show: true, radius: 5, fill: true, fillColor: COLOR_READ},
                    hoverable: false, clickable: false});
    }
  });
  this.read_xy = null;
  $(this.dom_graph_note).empty().append($('<span>').text(gray ?
    'Stap voor stap: de punten tot nu toe, grijs is de laatste Run.' : 'Stap voor stap: de punten tot nu toe.'));
  this.plot_graph(dataset, x, ys);
  $(this.dom_graph).addClass('stepping');
};


ModelleertaalApp.prototype.setup_run = function() {

  this.remove_highlight_trace();
  this.remove_highlight_error();
  this.remove_lint();
  clearTimeout(this.lint_timer);
  this.clear_message();

  this.read_model();
  this.units = eenheden.derive(this.model.startwaarden, this.model.modelregels).units;

  try {
    this.evaluator = new evaluator_js.ModelregelsEvaluator(this.model, this.debug);
  } catch (err) {
    this.show_error(err);
    return false;
  }
  return true;
};


ModelleertaalApp.prototype.do_run = function() {

  this.clear_message();

  try {
    this.evaluator.set_state(this.N, this.new_run, false);
    this.evaluator.run();
  } catch (err) {
    this.show_error(err);
    return false;
  }

  this.results = this.evaluator.result;
  this.allVars = this.evaluator.namespace.varNames;
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
  this.highlight_error(line, name, err.message);
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

  this.read = null;
  this.print_table(10);
  this.do_plot();
  this.draw_thumbnails();

  this.print_run_status();
  this.check_results();
  // values in the tooltips of the diagram
  if (this.grafisch_open() && this.grafisch_g) this.render_grafisch_model();

  // is dt small enough? (after the graph is drawn: the student does not wait for this)
  var self = this;
  var run_id = this.run_id = (this.run_id || 0) + 1;
  clearTimeout(this.dtcheck_timer);
  this.dtcheck_timer = setTimeout(function() {
    if (run_id == self.run_id && !self.stale && !self.stepper) {
      self.check_dt();
      self.show_hint();
    }
  }, 30);
};


ModelleertaalApp.prototype.check_dt = function() {
  // run the model again with dt/2 (dtcheck.js). Different result: dt is too large.
  if ($(this.dom_message).is(':visible')) return;   // a warning or print() goes first
  var self = this;
  var result;
  try {
    result = dtcheck.check(this.model, this.N, {
      results: this.results,
      varNames: this.allVars,
      stopped: this.evaluator.stopped,
      runtime_ms: this.evaluator.runtime_ms,
      analysis: this.analysis
    });
  } catch (err) {
    if (this.debug) console.log('dtcheck', err);
    return;
  }
  if (result) {
    this.show_message('info', 'Is dt klein genoeg?', dtcheck.message(result, function(x) {
      return self.format_text(x);
    }));
  }
};


ModelleertaalApp.prototype.show_hint = function() {
  // a common mistake in the model (hints.js): one hint, as information, only if there is no
  // other message
  if ($(this.dom_message).is(':visible') || !this.evaluator) return;
  var list;
  try {
    list = hints.find(this.evaluator.startwaarden_ast, this.evaluator.modelregels_ast);
  } catch (err) {
    return;
  }
  if (list.length) this.show_message('info', 'Tip', list[0].text);
};


ModelleertaalApp.prototype.print_run_status = function() {

  var N_iterations = this.results.length - 1;
  var status;

  var iterations = N_iterations + (N_iterations == 1 ? " iteratie." : " iteraties.");
  if (this.evaluator.stopped) {
    status = "Model gestopt na " + iterations;
  } else {
    status = "Klaar na " + iterations;
  }
  if (this.analysis.time !== null) {
    var t = this.results[this.results.length - 1][this.allVars.indexOf(this.analysis.time)];
    if (typeof t == 'number' && isFinite(t)) {
      var unit = this.units.hasOwnProperty(this.analysis.time) ? ' ' + this.units[this.analysis.time] : '';
      status += " Eindtijd: " + this.analysis.time + " = " + Number(t.toPrecision(this.precision)) + unit + ".";
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
    // name the most probable cause (oorzaak.js), not three questions at once
    var cause = null;
    try {
      cause = oorzaak.find(this.evaluator.modelregels_ast, this.allVars, this.results, first_bad_row,
                           this.constant_values(this.evaluator.namespace.constNames));
    } catch (err) {
      cause = null;
    }
    this.show_message('warning', 'Let op', oorzaak.message(cause, first_bad_row, bad_var));
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
      $('<option/>').val(name).text(eenheden.label(name, this.units)).appendTo(this.dom_x_var);
      $('<option/>').val(name).text(eenheden.label(name, this.units)).appendTo(this.dom_y_var);
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


ModelleertaalApp.prototype.compute_column_scale = function(rows, vars) {
  // largest absolute value in each column
  var scale = [];
  var i, j, val;
  for (j = 0; j < vars.length; j++) scale.push(0);
  for (i = 0; i < rows.length; i++) {
    for (j = 0; j < scale.length; j++) {
      val = Math.abs(rows[i][j]);
      if (val > scale[j] && isFinite(val)) scale[j] = val;
    }
  }
  this.column_scale = scale;
};


ModelleertaalApp.prototype.table_header = function(vars) {
  var firstrow = $('<tr>');
  firstrow.append($('<th>').text('#'));

  for (var k = 0; k < vars.length; k++) {
    firstrow.append($('<th>').text(eenheden.label(vars[k], this.units)));
  }
  return firstrow;
};


ModelleertaalApp.prototype.table_row = function(rows, rowIndex, mark_column) {
  // mark_column (optional): the cell that just changed (Stap voor stap)
  var row = $('<tr>').attr('data-row', rowIndex);
  row.append($('<td>').text(rowIndex));
  if (!this.stepper && this.read && this.read.row == rowIndex) row.addClass('mt-read-row');

  for (var j = 0; j < rows[rowIndex].length; j++) {
    var cell = $('<td>').text(this.format_number(rows[rowIndex][j], j));
    if (j === mark_column) cell.addClass('mt-step-cell');
    row.append(cell);
  }
  if (mark_column !== undefined) row.addClass('mt-step-row');
  return row;
};


ModelleertaalApp.prototype.print_table = function(limit) {
  // truncated row from: jquery.jsparc.js
  // http://github.com/HiSPARC/jSPARC

  var self = this;

  // Stap voor stap: the rows computed so far. Else: the last Run.
  var rows = this.stepper ? this.stepper.table() : this.results;
  var vars = this.stepper ? this.stepper.varNames : this.allVars;
  var mark = this.stepper ? this.step_mark : undefined;

  this.compute_column_scale(rows, vars);

  // the number of rows shown stays (also after a click on a row)
  if (limit) this.table_limit = limit;
  limit = Math.min(rows.length, this.table_limit || 10);
  // this row is always shown: the step, or the point that is read in the graph
  var focus = mark ? mark.row : (this.read ? this.read.row : undefined);
  var shown = function(i) {
    return limit >= rows.length || i < Math.floor(limit / 2) || i >= rows.length - Math.ceil(limit / 2) ||
           (focus !== undefined && Math.abs(i - focus) <= 2);
  };

  var table = $('<table>').addClass('table');
  table.append($('<thead>').append(this.table_header(vars)));
  var body = $('<tbody>').appendTo(table);

  var show_more = function() {
    self.print_table(limit * 5);
  };

  for (var i = 0; i < rows.length; i++) {
    if (shown(i)) {
      body.append(this.table_row(rows, i, (mark && mark.row == i) ? mark.column : undefined));
      continue;
    }
    var j = i;
    while (j < rows.length && !shown(j)) j++;
    var truncrow = $('<tr>').addClass('truncated');
    truncrow.append($('<td>')
      .attr('colspan', vars.length + 1)
      .append($('<button type="button">')
        .text('\u22ee  ' + (j - i) + (j - i == 1 ? ' rij' : ' rijen') + ' verborgen. Klik voor meer rijen.')
        .click(show_more)));
    body.append(truncrow);
    i = j - 1;
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
  var y_names = [];
  var note = '';

  // another graph: not zoomed in anymore
  if (this.zoom && this.zoom.key != this.zoom_key()) this.zoom = null;
  $(this.dom_zoom_reset).prop('hidden', !this.zoom);

  // several graphs with a very different range: the small ones on a second axis (right)
  var split = {left: this.multiplot ? this.multi_yvars : [this.yvar], right: []};
  if (this.multiplot) {
    var ranges = {};
    this.multi_yvars.forEach(function(name) {
      ranges[name] = assen.data_range(self.xy_data(rows, self.allVars, self.xvar, name));
    });
    split = assen.split(this.multi_yvars, ranges);
  }
  this.axis_of = function(name) {
    return (split.right.indexOf(name) != -1) ? 2 : 1;
  };

  var has_previous = false;
  var push_previous = function(yvar) {
    var data = (self.previous) ? self.xy_data(self.previous.rows, self.previous.vars, self.xvar, yvar) : null;
    if (data === null) return;
    has_previous = true;
    dataset.push({
      data: data,
      color: COLOR_PREVIOUS,
      yaxis: self.axis_of(yvar),
      mt_previous: true,
      points: {show: false},
      hoverable: false,
      clickable: false
    });
  };

  if (this.multiplot) {
    this.multi_yvars.forEach(push_previous);
    this.multi_yvars.forEach(function(name, n) {
      dataset.push({
        data: self.xy_data(rows, self.allVars, self.xvar, name),
        color: COLORS_MULTIPLOT[n % COLORS_MULTIPLOT.length],
        label: name,
        mt_yvar: name,
        yaxis: self.axis_of(name),
        points: {show: show_points}
      });
    });
    y_names = split.left;
    if (dataset.length === 0) note = 'Vink hieronder aan welke variabelen je wilt zien.';
    // legend: colour next to the checkbox, and which graphs use the axis on the right
    $(this.dom_y_checks).find('label').each(function() {
      var name = $(this).find('input').val();
      var n = self.multi_yvars.indexOf(name);
      $(this).find('.swatch')
        .css('background-color', COLORS_MULTIPLOT[Math.max(n, 0) % COLORS_MULTIPLOT.length])
        .css('display', (n == -1) ? 'none' : 'inline-block');
      $(this).find('.as_rechts').remove();
      if (split.right.indexOf(name) != -1) $(this).append($('<span class="as_rechts">').text(' (as rechts)'));
    });
  } else {
    push_previous(this.yvar);
    dataset.push({
      data: this.xy_data(rows, this.allVars, this.xvar, this.yvar),
      color: COLOR_PLOT,
      mt_yvar: this.yvar,
      points: {show: show_points}
    });
    y_names = [this.yvar];
  }

  var read_text = this.read_point(dataset);
  var note_box = $(this.dom_graph_note).empty();
  if (has_previous) {
    note_box.append($('<span>').text((this.pinned ? 'Grijs: vastgehouden run' : 'Grijs: vorige run') +
      (this.compare_text ? ' (' + this.compare_text + ')' : '') + '.'));
    note_box.append($('<button type="button">').addClass('pin small_action')
      .attr('aria-pressed', String(Boolean(this.pinned)))
      .attr('title', this.pinned ?
        'De grijze lijn blijft staan bij volgende runs. Klik om weer de vorige run te tonen.' :
        'Houd deze grijze lijn vast: hij blijft dan staan bij volgende runs')
      .text('\ud83d\udccc Houd vast'));
  }
  if (note) note_box.append($('<span>').text(' ' + note));
  this.plot_graph(dataset, this.xvar, y_names, split.right);
  if (read_text) read_text = read_text.concat(this.tangent_text());
  this.show_read_label(read_text);
  this.select_thumbnail();
}; // do_plot


//
// Aflezen: the point that was clicked in the graph (or the row in the table)
//
ModelleertaalApp.prototype.set_read = function(read) {
  // read: {row (in this.results), yvar}, or null
  if (!read && !this.read) return;
  this.read = read;
  if (!this.results_available()) return;
  this.do_plot();
  if (!this.stepper) this.print_table();
};


ModelleertaalApp.prototype.zoom_key = function() {
  // the graph that is shown: zooming in belongs to this graph
  return [this.xvar, this.multiplot ? this.multi_yvars.join(',') : this.yvar, this.multiplot].join('|');
};


ModelleertaalApp.prototype.zoom_position = function(event) {
  // mouse position in the plot area (pixels), limited to the plot area
  var off = this.plot_object.getPlotOffset();
  var g = $(this.dom_graph).offset();
  var x = event.pageX - g.left - off.left, y = event.pageY - g.top - off.top;
  var w = this.plot_object.width(), h = this.plot_object.height();
  return {inside: x >= 0 && y >= 0 && x <= w && y <= h,
          x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y))};
};


ModelleertaalApp.prototype.set_zoom = function(zoom) {
  if (!zoom && !this.zoom) return;
  this.zoom = zoom;
  if (this.results_available()) this.do_plot();
};


ModelleertaalApp.prototype.read_point = function(dataset) {
  // adds the point to dataset (the tangent: plot_graph). Returns the text next to the point, or null.
  var self = this;
  var read = this.read;
  this.read_xy = null;
  this.read_tangent = null;
  if (!read || !this.results_available() || !this.results[read.row]) return null;
  var shown = this.multiplot ? this.multi_yvars : [this.yvar];
  if (shown.indexOf(read.yvar) == -1) return null;
  var xi = this.allVars.indexOf(this.xvar), yi = this.allVars.indexOf(read.yvar);
  if (xi == -1 || yi == -1) return null;
  var x = this.results[read.row][xi], y = this.results[read.row][yi];
  if (typeof x != 'number' || typeof y != 'number' || !isFinite(x) || !isFinite(y)) return null;

  function value(name, val) {
    var unit = self.units.hasOwnProperty(name) ? ' ' + self.units[name] : '';
    return name + ' = ' + self.format_text(val) + unit;
  }
  var text = [value(this.xvar, x), value(read.yvar, y)];
  var axis = this.axis_of ? this.axis_of(read.yvar) : 1;

  // the slope: a tangent from axis to axis (only with one graph: which line would it be?). It is drawn
  // in plot_graph, when the axes are known. A click on the tangent shows the calculation of the helling.
  this.read_tangent = null;
  if (!this.multiplot) {
    var slope = aflezen.slope(this.results, xi, yi, read.row);
    if (slope !== null) {
      this.read_tangent = {point: [x, y], slope: slope, axis: axis, xvar: this.xvar, yvar: read.yvar,
                           line: null};
    }
  }
  dataset.push({data: [[x, y]], color: COLOR_READ, lines: {show: false}, yaxis: axis,
                points: {show: true, radius: 5, fill: true, fillColor: COLOR_READ},
                mt_read: true, hoverable: false, clickable: false});
  this.read_xy = [x, y];
  this.read_axis = axis;
  return text;
};


ModelleertaalApp.prototype.tangent_text = function() {
  // the helling from the two ends of the tangent: delta y / delta x, as on paper (DIDACTIEK.md)
  var self = this;
  var t = this.read_tangent;
  if (!t || !t.line || !this.read) return [];
  if (!this.read.tangent) return [{text: 'klik op de raaklijn voor de helling', cls: 'read_hint'}];
  var a = t.line[0], b = t.line[1];
  var dx = b[0] - a[0], dy = b[1] - a[1];
  function num(v) { return self.format_text(v).replace('-', '\u2212'); }
  function minus(v) { return (v < 0) ? '(' + num(v) + ')' : num(v); }
  function difference(v1, v2) { return num(v2) + ' − ' + minus(v1); }
  var slope_unit = aflezen.slope_unit(this.units[t.yvar], this.units[t.xvar]);
  // helling = (delta y)/(delta x) = (y2 - y1)/(x2 - x1) = ..., as real fractions (show_read_label)
  return [{cls: 'read_calc read_first read_result', parts: [
    'helling = ',
    {num: 'Δ' + t.yvar, den: 'Δ' + t.xvar},
    ' = ',
    {num: difference(a[1], b[1]), den: difference(a[0], b[0])},
    ' = ' + num(dy / dx) + (slope_unit ? ' ' + slope_unit : '')
  ]}];
};


ModelleertaalApp.prototype.near_tangent = function(pos) {
  // is the mouse (pos of plotclick/plothover) on the tangent? Not on the point itself: that is the graph.
  var t = this.read_tangent;
  if (!t || !t.line || !this.plot_object || !pos) return false;
  var g = $(this.dom_graph).offset();
  var mx = pos.pageX - g.left, my = pos.pageY - g.top;
  var plot = this.plot_object;
  function px(p) {
    var o = plot.pointOffset({x: p[0], y: p[1], yaxis: t.axis || 1});
    return [o.left, o.top];
  }
  var a = px(t.line[0]), b = px(t.line[1]), c = px(t.point);
  if (Math.sqrt(Math.pow(mx - c[0], 2) + Math.pow(my - c[1], 2)) < 10) return false;
  var vx = b[0] - a[0], vy = b[1] - a[1];
  var f = ((mx - a[0]) * vx + (my - a[1]) * vy) / (vx * vx + vy * vy || 1);
  f = Math.max(0, Math.min(1, f));
  var d = Math.sqrt(Math.pow(mx - a[0] - f * vx, 2) + Math.pow(my - a[1] - f * vy, 2));
  return d < 8;
};


ModelleertaalApp.prototype.show_read_label = function(text) {
  // the values of the point that is read, next to the point in the graph
  if (!text || !this.plot_object || !this.read_xy) return;
  var graph = $(this.dom_graph);
  var off = this.plot_object.pointOffset({x: this.read_xy[0], y: this.read_xy[1], yaxis: this.read_axis || 1});
  // zoomed in: the point can be outside the graph
  var box = this.plot_object.getPlotOffset();
  if (off.left < box.left || off.left > box.left + this.plot_object.width() ||
      off.top < box.top || off.top > box.top + this.plot_object.height()) return;
  var self = this;
  var label = $('<div class="read_label">').appendTo(graph);
  text.forEach(function(line) {
    if (typeof line == 'string') line = {text: line};
    var div = $('<div>').addClass(line.cls || '').appendTo(label);
    if (!line.parts) {
      div.text(line.text);
      return;
    }
    // text and fractions {num, den}
    line.parts.forEach(function(part) {
      if (typeof part == 'string') {
        div.append($('<span>').text(part));
      } else {
        div.append($('<span class="frac">')
          .append($('<span class="frac_num">').text(part.num))
          .append($('<span class="frac_den">').text(part.den)));
      }
    });
  });
  // a click on the tangent: the values at both ends, next to the ends
  var t = this.read_tangent;
  var taken = [];   // the labels at the ends: the label of the point must not cover them
  if (t && t.line && this.read && this.read.tangent) {
    t.line.forEach(function(p, i) {
      var o = self.plot_object.pointOffset({x: p[0], y: p[1], yaxis: t.axis || 1});
      var end = $('<div class="read_label read_end">').appendTo(graph)
        .text('(' + self.format_text(p[0]) + '; ' + self.format_text(p[1]) + ')');
      var ew = end.outerWidth(), eh = end.outerHeight();
      var el = (i === 0) ? o.left + 8 : o.left - ew - 8;
      var et = (o.top - eh - 6 < 0) ? o.top + 6 : o.top - eh - 6;
      el = Math.max(0, Math.min(graph.width() - ew, el));
      end.css({left: el + 'px', top: et + 'px'});
      taken.push([el, et, ew, eh]);
    });
  }
  var w = label.outerWidth(), h = label.outerHeight();
  // next to the point, not on the tangent: a rising tangent goes up to the right, so then below right
  var right = off.left + 12, left = off.left - w - 12, above = off.top - h - 10, below = off.top + 12;
  var places = [[right, above], [right, below], [left, above], [left, below]];
  if (t && t.line && t.slope > 0) places = [[right, below], [left, above], [right, above], [left, below]];
  if (t && t.line && t.slope < 0) places = [[right, above], [left, below], [right, below], [left, above]];
  var place = places.filter(function(p) {
    return p[0] >= 0 && p[0] + w <= graph.width() && p[1] >= 0 && p[1] + h <= graph.height() &&
      taken.every(function(r) {
        return p[0] >= r[0] + r[2] || p[0] + w <= r[0] || p[1] >= r[1] + r[3] || p[1] + h <= r[1];
      });
  })[0] || places[0];
  label.css({left: Math.max(0, place[0]) + 'px', top: Math.max(0, place[1]) + 'px'});
};


ModelleertaalApp.prototype.plot_graph = function(dataset, x_name, y_names, y2_names) {
  // y_names: the variables on the vertical axis, y2_names (optional): on the second axis (right).
  // The axes show the units (eenheden.js)

  var self = this;
  y2_names = y2_names || [];
  var x_label = eenheden.label(x_name, this.units);
  var y_label = eenheden.labels(y_names, this.units);
  var y2_label = eenheden.labels(y2_names, this.units);
  var zoom = this.zoom ? this.zoom.ranges : null;

  if ($(this.dom_graph).width() === 0 || $(this.dom_graph).height() === 0) return;

  // plot the y-axis from 0, unless autoscale. Zoomed in: the rectangle.
  function y_range(n, zoomed) {
    if (zoomed) return {min: zoomed.from, max: zoomed.to, autoScale: 'none'};
    var range = {};
    if (self.yaxis_autoscale) return range;
    var min = Infinity, max = -Infinity;
    dataset.forEach(function(series) {
      if ((series.yaxis || 1) != n) return;
      series.data.forEach(function(point) {
        if (point === null) return;
        if (point[1] < min) min = point[1];
        if (point[1] > max) max = point[1];
      });
    });
    if (min >= 0) range.min = 0;
    if (max <= 0) range.max = 0;
    return range;
  }
  var y1 = y_range(1, zoom && zoom.yaxis);
  var y2 = y_range(2, zoom && zoom.y2axis);

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

  function value(name, val) {
    // 'v = 3.2 m/s'
    var unit = self.units.hasOwnProperty(name) ? ' ' + self.units[name] : '';
    return name + ' = ' + short(val) + unit;
  }

  function axis_lines(axes) {
    // the lines x = 0 and y = 0 when they are inside the graph (gh-37)
    var lines = [];
    function inside(axis) { return axis.min < 0 && axis.max > 0; }
    if (inside(axes.yaxis)) lines.push({yaxis: {from: 0, to: 0}, color: '#4b5563', lineWidth: 1});
    if (inside(axes.xaxis)) lines.push({xaxis: {from: 0, to: 0}, color: '#4b5563', lineWidth: 1});
    // Aflezen: from the point to both axes, as on paper
    if (self.read_xy) {
      var x = self.read_xy[0], y = self.read_xy[1];
      if (self.read_axis == 2 && axes.y2axis) {
        // a graph on the right axis: the line goes to the right
        lines.push({xaxis: {from: x, to: x}, y2axis: {from: axes.y2axis.min, to: y}, color: COLOR_READ, lineWidth: 1});
        lines.push({y2axis: {from: y, to: y}, xaxis: {from: x, to: axes.xaxis.max}, color: COLOR_READ, lineWidth: 1});
      } else {
        lines.push({xaxis: {from: x, to: x}, yaxis: {from: axes.yaxis.min, to: y}, color: COLOR_READ, lineWidth: 1});
        lines.push({yaxis: {from: y, to: y}, xaxis: {from: axes.xaxis.min, to: x}, color: COLOR_READ, lineWidth: 1});
      }
    }
    return lines;
  }

  var axis_font = {
    size: 13,
    lineHeight: 14,
    family: "sans-serif",
    color: "#4b5563"
  };

  $(this.dom_graph).empty().toggleClass('zoomable', this.zoom_enabled);

  var yaxes = [{
      font: axis_font,
      showTicks: false,
      position: 'left',
      tickFormatter: sciFormatter,
      min: y1.min,
      max: y1.max,
      autoScale: y1.autoScale,
      axisLabel: y_label
    }];
  if (y2_names.length) {
    yaxes.push({
      font: axis_font,
      showTicks: false,
      position: 'right',
      tickFormatter: sciFormatter,
      min: y2.min,
      max: y2.max,
      autoScale: y2.autoScale,
      axisLabel: y2_label
    });
  }

  var options = {
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
      borderColor: '#9ca3af',
      markings: axis_lines
    },
    axisLabels: {
      show: true
    },
    xaxis: {
      font: axis_font,
      showTicks: false,
      tickFormatter: sciFormatter,
      min: zoom ? zoom.xaxis.from : undefined,
      max: zoom ? zoom.xaxis.to : undefined,
      autoScale: zoom ? 'none' : undefined,
      axisLabel: x_label
    },
    yaxes: yaxes,
    legend: {
      show: false
    },
    tooltip: {
      show: true,
      content: function(label, x, y) {
        return value(x_name, x) + ", " + value(label || y_names[0], y);
      }
    }
  };
  this.plot_object = $.plot($(this.dom_graph), dataset, options);

  // Aflezen: the tangent from axis to axis. The axes are known now: plot again with the tangent and the
  // same axes (the tangent must not change the axes).
  var t = this.read_tangent;
  if (t) {
    var axes = this.plot_object.getAxes();
    var ya = (t.axis == 2 && axes.y2axis) ? axes.y2axis : axes.yaxis;
    t.line = aflezen.tangent_to_axes(t.point, t.slope,
                                     {xmin: axes.xaxis.min, xmax: axes.xaxis.max, ymin: ya.min, ymax: ya.max});
    if (t.line) {
      var tangent = [{data: t.line, color: COLOR_READ, lines: {show: true, lineWidth: 2}, yaxis: t.axis || 1,
                      points: {show: false}, mt_read: true, hoverable: false, clickable: false}];
      if (this.read && this.read.tangent) {
        tangent.push({data: t.line, color: COLOR_READ, lines: {show: false}, yaxis: t.axis || 1,
                      points: {show: true, radius: 4, fill: true, fillColor: '#ffffff'},
                      mt_read: true, hoverable: false, clickable: false});
      }
      // under the point that was clicked (the last series)
      Array.prototype.splice.apply(dataset, [dataset.length - 1, 0].concat(tangent));
      options.xaxis.min = axes.xaxis.min;
      options.xaxis.max = axes.xaxis.max;
      options.xaxis.autoScale = 'none';
      options.yaxes.forEach(function(yaxis, i) {
        var used = axes[i ? 'y2axis' : 'yaxis'];
        if (!used) return;
        yaxis.min = used.min;
        yaxis.max = used.max;
        yaxis.autoScale = 'none';
      });
      $(this.dom_graph).empty();
      this.plot_object = $.plot($(this.dom_graph), dataset, options);
    }
  }
  this.place_axis_picks();
}; // plot_graph()


ModelleertaalApp.prototype.place_axis_picks = function() {
  // choose the variables on the axes on the axis labels themselves: an invisible menu
  // on top of the label (the label is part of the graph, also in the PNG)
  var self = this;
  var wrap = $(this.dom_graph).parent()[0];
  var base = wrap.getBoundingClientRect();
  var ok = this.results_available() && this.plot_object;
  function place(pick, label_class, show) {
    var label = $(self.dom_graph).find('.' + label_class)[0];
    if (!show || !label || !label.getBoundingClientRect) {
      $(pick).prop('hidden', true);
      return;
    }
    var r = label.getBoundingClientRect();
    var w = Math.max(r.width + 8, 26), h = Math.max(r.height + 6, 26);
    $(pick).prop('hidden', false).css({
      left: Math.round(r.left - base.left + r.width / 2 - w / 2) + 'px',
      top: Math.round(r.top - base.top + r.height / 2 - h / 2) + 'px',
      width: Math.round(w) + 'px',
      height: Math.round(h) + 'px'
    });
  }
  place(this.dom_x_pick, 'x1Label', ok);
  place(this.dom_y_pick, 'y1Label', ok && !this.multiplot);
};


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

  this.set_opdracht(this.model.opdracht || '', true);
  // other model: the dragged positions of its file (or none)
  this.set_indeling(this.model.indeling || '');
  this.loaded = {modelregels: this.model.modelregels, startwaarden: this.model.startwaarden,
                 opdracht: this.opdracht, indeling: this.indeling_text()};

  this.results = [];
  this.allVars = [];
  this.units = {};
  this.read = null;
  this.table_limit = 10;
  this.zoom = null;
  this.graphs = [];
  this.analysis = undefined;
  this.end_stepping();
  this.previous = null;
  this.pinned = false;
  this.last_source = null;
  this.compare_text = '';
  this.has_run = false;
  this.remove_highlight_trace();
  this.remove_highlight_error();
  clearTimeout(this.lint_timer);
  this.remove_lint();

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
  $(this.dom_zoom_reset).prop('hidden', true);
  this.place_axis_picks();
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

  tsv += this.allVars.map(function(name) {   // header row, with units: v (m/s)
    return eenheden.label(name, self.units);
  }).join('\t');
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

  var x_var = this.xvar;
  var y_var = this.yvar;
  var units = this.units;
  function axis_label(name) {
    // unit from the comments of the model (eenheden.js): {$v$ [\si{m/s}]}
    // m/s² is written as m/s^{2}
    return "{$" + name + "$" + (units.hasOwnProperty(name) && units[name] ? " [\\si{" + eenheden.latex(units[name]) + "}]" : "") + "}";
  }

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
    "xlabel=" + axis_label(x_var) + ",\n" +
    "ylabel=" + axis_label(y_var) + ",\n" +
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


ModelleertaalApp.prototype.get_result_rowIndex = function(rowIndex_plot, length_plot) {
  // map row index from plot (reduced number of rows)
  // back to this.results. The last point of the plot is the last row (see reduce_rows).

  if (length_plot !== undefined && rowIndex_plot == length_plot - 1) return this.results.length - 1;
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


ModelleertaalApp.prototype.fill_functies = function() {
  // "Functies" under the modelregels: the functions that can be used (gh-54)
  var table = $('<table>');
  evaluator_js.FUNCTIONS.forEach(function(row) {
    table.append($('<tr>').append(
      $('<td>').text(row[0].map(function(name) { return name + '()'; }).join(' ')),
      $('<td>').text(row[2]).append($('<br>'), $('<span class="voorbeeld">').text(row[1]))
    ));
  });
  $(this.dom_functies_tabel).empty().append(table);
};


ModelleertaalApp.prototype.highlight_error = function(line, editor_name, message) {
  // highlight line with error, until the model is edited or run.
  // A cross in the gutter shows the message on hover (gh-42).

  var editor = this.get_editor(editor_name);
  if (editor === null) return false;

  if (line === undefined || line < 1) {
    editor.focus();
    return false;
  }
  line = Math.min(line, editor.lineCount());

  this.remove_highlight_error();
  this.remove_lint();
  this.error_highlight = {
    editor: editor,
    handle: editor.addLineClass(line - 1, 'background', 'mt-error-line')
  };
  editor.addLineClass(this.error_highlight.handle, 'gutter', 'mt-error-gutter');
  var marker = $('<span class="mt-error-marker" role="img">').text('✕')
    .attr({'title': message || 'Fout in deze regel', 'aria-label': message || 'Fout in deze regel'});
  editor.setGutterMarker(this.error_highlight.handle, 'mt-error-markers', marker[0]);
  editor.setCursor({line: line - 1, ch: editor.getLine(line - 1).length});
  editor.focus();
};


ModelleertaalApp.prototype.remove_highlight_error = function() {
  if (!this.error_highlight) return;
  var highlight = this.error_highlight;
  this.error_highlight = undefined;
  highlight.editor.removeLineClass(highlight.handle, 'background', 'mt-error-line');
  highlight.editor.removeLineClass(highlight.handle, 'gutter', 'mt-error-gutter');
  highlight.editor.setGutterMarker(highlight.handle, 'mt-error-markers', null);
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
