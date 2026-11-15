/*
    rondleiding.js

    Een korte rondleiding langs de vijf onderdelen die een docent het eerst moet zien.
    Start nooit vanzelf: alleen met de knop Rondleiding bovenaan. Tot iemand de rondleiding
    een keer geopend heeft, staat er een kleine stip op de knop.

    Elke stap licht een deel van de pagina op (de rest wordt donkerder) met een tekstballon
    ernaast. De pagina blijft bruikbaar: je kunt tijdens de rondleiding gewoon klikken.
    Wat de rondleiding voor een stap open zet (het diagram, Meer opties) gaat bij de
    volgende stap weer terug zoals het was.
*/
//jshint browser:true, node:true
/*global $*/
"use strict";

var GEZIEN_KEY = 'modelleertaal_rondleiding_gezien';

// De stappen. 'doel' is de selector van wat oplicht; 'voor' en 'na' zetten de pagina
// klaar en terug (zie hieronder). In node (tests) worden alleen de teksten gebruikt.
var STAPPEN = [
    {
        doel: '.model_select',
        titel: 'Kies een model',
        tekst: 'Alle modellen uit de vwo-examens en de modellen bij de modules staan klaar. ' +
            'Kies eerst een verzameling, dan een model. Zelf beginnen? ' +
            'Kies <b>Basismodellen</b> &rarr; <b>Leeg model</b>. ' +
            'Met <b>Open</b> en <b>Bewaar</b> werk je met een bestand op je computer.'
    },
    {
        doel: '.runbar',
        titel: 'Run en Stap',
        tekst: '<b>Run</b> (of Ctrl+Enter) rekent het model door. ' +
            'Met <b>Stap</b> reken je regel voor regel, met de getallen ingevuld: ' +
            '<code>v = v + a*dt &rarr; v = 0,981 + 9,78 &times; 0,1</code>. ' +
            'Zo zien leerlingen hoe de rekenlus werkt. ' +
            'Gaat er iets mis, dan staat de foutmelding in het Nederlands boven het model.'
    },
    {
        doel: '.area_graph',
        titel: 'Grafieken en aflezen',
        voor: 'run',
        tekst: 'Na Run kiest de webapp zelf de grafieken die bij het model passen; klik op een miniatuur ' +
            'om die groot te zien. Klik op een punt in de grafiek om af te lezen, met hulplijnen ' +
            'naar de assen en de raaklijn erbij. Verander een startwaarde en druk weer op Run: ' +
            'de vorige run blijft als grijze lijn staan.'
    },
    {
        doel: '.area_model',
        titel: 'Tekst + grafisch',
        voor: 'grafisch',
        tekst: 'Met <b>Tekst + grafisch</b> staat het model ook als diagram boven de tekst, ' +
            'getekend zoals in de examens. Tekst en diagram zijn gekoppeld: klik op een symbool en ' +
            'de regels lichten op. Het diagram is ook invoer: voeg grootheden toe of verander een formule. ' +
            'Onder het diagram kies je de stijl <b>Examen</b> of <b>Kleur</b>.'
    },
    {
        doel: '.opdracht_optie',
        titel: 'Een opdracht delen',
        voor: 'opties',
        tekst: 'Schrijf hier (in <b>Meer opties</b>) een opdracht bij het model, bijvoorbeeld ' +
            '&ldquo;vul de puntjes in en bepaal de eindsnelheid&rdquo;. ' +
            '<b>Deel link</b> bovenaan kopieert dan een link met het model &eacute;n de opdracht: ' +
            'zet die in je lesmateriaal of stuur hem naar je leerlingen. Niets installeren, geen account.'
    }
];

var EINDE = 'Waarom de webapp zo werkt, staat in ' +
    '<a href="https://github.com/tomkooij/modelleertaal/blob/master/DIDACTIEK.md" target="_blank" rel="noopener">DIDACTIEK.md</a>.';


function storage(action) {
    // localStorage can be blocked (private window): then the dot simply stays
    try {
        if (action == 'get') return window.localStorage.getItem(GEZIEN_KEY);
        if (action == 'set') window.localStorage.setItem(GEZIEN_KEY, '1');
    } catch (err) {
        return null;
    }
    return null;
}


function Rondleiding(app) {
    this.app = app;
    this.index = -1;
    this.herstel = null;   // undoes what 'voor' changed on the page
}

Rondleiding.prototype.knop = function(selector) {
    var self = this;
    var $knop = $(selector);
    if (!storage('get')) $knop.addClass('nieuw');
    $knop.on('click', function() {
        if (self.index >= 0) self.stop(); else self.start();
    });
};

Rondleiding.prototype.start = function() {
    var self = this;
    storage('set');
    $('#rondleiding_knop').removeClass('nieuw').attr('aria-expanded', 'true');
    this.$spot = $('<div class="tour_spot" aria-hidden="true">').appendTo('body');
    this.$ballon = $('<div class="tour_ballon" role="dialog" aria-modal="false" aria-labelledby="tour_titel">')
        .appendTo('body');
    this.$ballon.on('click', '[data-tour]', function() {
        var actie = $(this).attr('data-tour');
        if (actie == 'volgende') self.ga(self.index + 1);
        if (actie == 'vorige') self.ga(self.index - 1);
        if (actie == 'stop') self.stop();
    });
    this.on_key = function(e) {
        // not while typing in the model or a form
        if ($(e.target).closest('input, textarea, select, .CodeMirror, [contenteditable]').length) return;
        if (e.key == 'Escape') { self.stop(); e.preventDefault(); }
        else if (e.key == 'ArrowRight') { self.ga(self.index + 1); e.preventDefault(); }
        else if (e.key == 'ArrowLeft' && self.index > 0) { self.ga(self.index - 1); e.preventDefault(); }
    };
    this.on_move = function() { self.plaats(); };
    $(document).on('keydown', this.on_key);
    $(window).on('resize scroll', this.on_move);
    // the layout can also change without scrolling (graph drawn, diagram opened, editor loaded)
    if (window.ResizeObserver) {
        this.observer = new window.ResizeObserver(this.on_move);
        this.observer.observe(document.body);
    }
    this.ga(0);
};

Rondleiding.prototype.stop = function() {
    if (this.index < 0) return;
    this.zet_terug();
    this.index = -1;
    $(document).off('keydown', this.on_key);
    $(window).off('resize scroll', this.on_move);
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    clearTimeout(this.timer);
    this.$spot.remove();
    this.$ballon.remove();
    $('#rondleiding_knop').attr('aria-expanded', 'false').trigger('focus');
};

Rondleiding.prototype.zet_terug = function() {
    if (this.herstel) this.herstel();
    this.herstel = null;
};

Rondleiding.prototype.zet_klaar = function(voor) {
    // prepare the page for a step, and remember how to undo it
    var app = this.app;
    var extra = '';
    if (voor == 'run' && !app.results_available()) {
        // show real graphs: compute the model that is loaded
        $(app.dom_run).trigger('click');
        if (app.results_available()) extra = 'De rondleiding heeft het model voor je doorgerekend.';
    } else if (voor == 'grafisch' && app.weergave != 'grafisch') {
        app.set_weergave('grafisch', false);
        this.herstel = function() { app.set_weergave('tekst', false); };
    } else if (voor == 'opties') {
        var details = document.getElementById('meer_opties');
        if (details && !details.open) {
            details.open = true;
            this.herstel = function() { details.open = false; };
        }
    }
    return extra;
};

Rondleiding.prototype.ga = function(index) {
    if (index >= STAPPEN.length) { this.stop(); return; }
    if (index < 0) return;
    this.zet_terug();
    this.index = index;
    var stap = STAPPEN[index];
    var extra = this.zet_klaar(stap.voor);
    var laatste = index == STAPPEN.length - 1;

    this.$ballon.html(
        '<button type="button" class="tour_sluit" data-tour="stop" aria-label="Sluit de rondleiding" title="Sluiten (Esc)">&times;</button>' +
        '<div class="tour_teller">' + (index + 1) + ' van ' + STAPPEN.length + '</div>' +
        '<h2 id="tour_titel">' + stap.titel + '</h2>' +
        '<p>' + stap.tekst + '</p>' +
        (extra ? '<p class="tour_extra">' + extra + '</p>' : '') +
        (laatste ? '<p class="tour_extra">' + EINDE + '</p>' : '') +
        '<div class="tour_knoppen">' +
        (index > 0 ? '<button type="button" data-tour="vorige">Vorige</button>' : '<span></span>') +
        '<button type="button" class="tour_volgende" data-tour="volgende">' +
        (laatste ? 'Klaar' : 'Volgende') + '</button>' +
        '</div>');

    var el = $(stap.doel)[0];
    if (el && el.scrollIntoView) {
        var r = el.getBoundingClientRect();
        // only scroll when the part is not (nearly) completely visible
        if (r.top < 8 || r.bottom > window.innerHeight - 8) {
            el.scrollIntoView({block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth'});
        }
    }
    this.plaats();
    // the layout can still change (graph drawn, diagram opened, smooth scroll)
    var self = this;
    clearTimeout(this.timer);
    this.timer = setTimeout(function() { self.plaats(); }, 400);
    var volgende = this.$ballon.find('.tour_volgende')[0];
    if (volgende) volgende.focus({preventScroll: true});
};

Rondleiding.prototype.plaats = function() {
    if (this.index < 0) return;
    var el = $(STAPPEN[this.index].doel)[0];
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var marge = 6;
    var $b = this.$ballon;
    var bw = Math.min(360, vw - 32);
    $b.css({width: bw});
    var bh = $b.outerHeight();

    if (!el || !el.getClientRects().length) {
        this.$spot.hide();
        $b.css({left: (vw - bw) / 2, top: Math.max(16, (vh - bh) / 2)});
        return;
    }
    var r = el.getBoundingClientRect();
    this.$spot.show().css({
        left: r.left - marge, top: r.top - marge,
        width: r.width + 2 * marge, height: r.height + 2 * marge
    });

    // below the part, else above it, else next to it, else on top of it at the bottom
    var left = Math.min(Math.max(16, r.left), vw - bw - 16);
    var top;
    var ruimte_onder = vh - r.bottom - 2 * marge;
    var ruimte_boven = r.top - 2 * marge;
    if (ruimte_onder >= bh + 8) {
        top = r.bottom + marge + 10;
    } else if (ruimte_boven >= bh + 8) {
        top = r.top - marge - 10 - bh;
    } else if (vw - r.right >= bw + 32) {
        left = r.right + marge + 14;
        top = Math.min(Math.max(16, r.top), vh - bh - 16);
    } else if (r.left >= bw + 32) {
        left = r.left - marge - 14 - bw;
        top = Math.min(Math.max(16, r.top), vh - bh - 16);
    } else {
        top = vh - bh - 16;
    }
    $b.css({left: left, top: Math.max(16, top)});
};


exports.Rondleiding = Rondleiding;
exports.STAPPEN = STAPPEN;
