/*
    rondleiding.js

    Twee korte rondleidingen, elk in vijf stappen:
    - voor leerlingen: de basis (model kiezen, modelregels, Run en Stap, grafieken, diagram)
    - voor docenten: wat een docent extra kan (opdracht, Deel link, runs vergelijken in de klas,
      het diagram als invoer, het diagram uit het tekstmodel)
    Start nooit vanzelf: alleen met de knop Rondleiding bovenaan, die een keuzemenu opent.
    Tot iemand de rondleiding een keer geopend heeft, staat er een kleine stip op de knop.

    Elke stap licht een deel van de pagina op (de rest wordt donkerder) met een tekstballon
    ernaast. De pagina blijft bruikbaar: je kunt tijdens de rondleiding gewoon klikken.
    Wat de rondleiding voor een stap open zet (het diagram, Meer opties) gaat bij de
    volgende stap weer terug zoals het was.
*/
//jshint browser:true, node:true
/*global $*/
"use strict";

var GEZIEN_KEY = 'modelleertaal_rondleiding_gezien';

var DIDACTIEK = '<a href="https://github.com/tomkooij/modelleertaal/blob/master/DIDACTIEK.md" ' +
    'target="_blank" rel="noopener">DIDACTIEK.md</a>';
var README = '<a href="https://github.com/tomkooij/modelleertaal#de-webapp-in-je-eigen-website-gebruiken" ' +
    'target="_blank" rel="noopener">README</a>';

// De rondleidingen. 'doel' is de selector van wat oplicht; 'voor' zet de pagina klaar
// (zie zet_klaar). In node (tests) worden alleen de teksten gebruikt.
var RONDLEIDINGEN = {
    leerling: {
        naam: 'Voor leerlingen',
        uitleg: 'De basis: een model doorrekenen en de grafiek aflezen',
        einde: 'Je werk blijft in deze browser staan, ook als je de pagina sluit. ' +
            'Wil je het als bestand hebben, druk dan op <b>Bewaar</b>.',
        stappen: [
            {
                doel: '.model_select',
                titel: 'Kies een model',
                tekst: 'Kies eerst een verzameling (de examens of je module), dan het model van je opgave. ' +
                    'Heb je van je docent een link gekregen, dan staat het model al klaar. ' +
                    'Staat er een opdracht bij, dan zie je die boven het model.'
            },
            {
                doel: '.editors',
                titel: 'Modelregels en startwaarden',
                tekst: 'Rechts de <b>startwaarden</b>: zo begint het model. Links de <b>modelregels</b>: ' +
                    'die worden elke stap opnieuw uitgerekend. Een eenheid zet je erachter: ' +
                    '<code>v = 0 \'[m/s]</code>. Onder <b>Functies</b> staat wat je kunt gebruiken, zoals ' +
                    '<code>sqrt</code> en <code>sin</code>. Een fout staat in het Nederlands boven het model.'
            },
            {
                doel: '.runbar',
                titel: 'Run en Stap',
                tekst: '<b>Run</b> (of Ctrl+Enter) rekent het model door. Naast het aantal iteraties zie je ' +
                    'hoe lang het model loopt. Snap je niet wat er gebeurt? Met <b>Stap</b> reken je regel ' +
                    'voor regel, met de getallen ingevuld: ' +
                    '<code>v = v + a*dt &rarr; v = 0,981 + 9,78 &times; 0,1</code>.'
            },
            {
                doel: '.area_graph',
                titel: 'De grafiek aflezen',
                voor: 'run',
                tekst: 'De webapp kiest zelf de grafieken; klik op een miniatuur om die groot te zien, ' +
                    'of kies een andere grootheid op de as. Klik op een punt om af te lezen. ' +
                    'Klik op de raaklijn: dan zie je hoe de helling &Delta;y/&Delta;x wordt uitgerekend. ' +
                    'Alle waarden staan in de tabel.'
            },
            {
                doel: '.area_model',
                titel: 'Tekst + grafisch',
                voor: 'grafisch',
                tekst: 'Met <b>Tekst + grafisch</b> zie je je model als diagram, zoals in het examen: ' +
                    'toestandsvariabelen, stromen en pijlen voor &ldquo;hangt af van&rdquo;. ' +
                    'Klik op een symbool en de regels ervan lichten op in de tekst. ' +
                    'Je kunt het model ook in het diagram bouwen met de knoppen erboven.'
            }
        ]
    },
    docent: {
        naam: 'Voor docenten',
        uitleg: 'Opdrachten maken en delen, demonstreren in de klas, het grafische model',
        einde: 'Waarom de webapp zo werkt, staat in ' + DIDACTIEK + '. ' +
            'De webapp met je eigen modellen op je eigen website: zie de ' + README + '. ' +
            'De basis zie je in de rondleiding <b>Voor leerlingen</b>.',
        stappen: [
            {
                doel: '.opdracht_optie',
                titel: 'Een opdracht bij het model',
                voor: 'opties',
                tekst: 'Schrijf hier (in <b>Meer opties</b>) een opdracht bij het model, bijvoorbeeld ' +
                    '&ldquo;vul de puntjes in en bepaal de eindsnelheid&rdquo;. Je leerlingen zien die ' +
                    'boven het model. Tip: kies een examenmodel, vervang een regel door puntjes en schrijf ' +
                    'de vraag erbij.'
            },
            {
                doel: '#permalink',
                titel: 'Deel link',
                tekst: '<b>Deel link</b> kopieert een link met het model zoals het nu is: met jouw wijzigingen, ' +
                    'de titel en de opdracht. Zet hem in je ELO of lesbrief. Leerlingen hoeven niets te ' +
                    'installeren en hebben geen account nodig; het werkt ook op een telefoon.'
            },
            {
                doel: '.area_graph',
                titel: 'Runs vergelijken in de klas',
                voor: 'run',
                tekst: 'Laat zien wat een startwaarde doet: verander bijvoorbeeld de massa en druk op Run. ' +
                    'De vorige run blijft als grijze lijn staan en onder de grafiek staat wat er veranderd is ' +
                    '(<code>m = 91 &rarr; nu 120</code>). Met <b>Houd vast</b> blijft een grijze lijn staan ' +
                    'als referentie terwijl je verder probeert.'
            },
            {
                doel: '#grafisch_model',
                titel: 'Het diagram is ook invoer',
                voor: 'grafisch',
                tekst: 'Tekst en diagram zijn gekoppeld. Klik op een symbool: de regels ervan lichten op in de ' +
                    'tekst, en in het formulier verander je de naam of de formule. Met de knoppen erboven voeg ' +
                    'je grootheden en voorwaarden toe; een stroom voeg je toe bij een gekozen toestandsvariabele. ' +
                    'Elke wijziging is een kleine wijziging in de tekst: de tekst blijft het model, net als in ' +
                    'het examen. Namen kies je met een klik, dus zonder typefouten.'
            },
            {
                doel: '.area_model',
                titel: 'Het diagram komt uit de tekst',
                voor: 'grafisch',
                tekst: 'Het diagram wordt vanzelf getekend uit het tekstmodel, terwijl je typt; Run is niet nodig. ' +
                    'Zo laat je bij elk examenmodel het grafische model zien. Zet de cursor in een regel en het ' +
                    'symbool licht op. Onder het diagram zet je <b>formules</b> en <b>eenheden</b> bij de symbolen ' +
                    'en kies je de stijl <b>Examen</b> of <b>Kleur</b>; <b>Herkende elementen</b> laat zien hoe ' +
                    'elke regel herkend is.'
            }
        ]
    }
};


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
    this.$knop = $knop;
    if (!storage('get')) $knop.addClass('nieuw');
    // the menu: one choice per tour
    var $menu = $('<div class="tour_menu" id="rondleiding_menu" role="menu" hidden>');
    $.each(RONDLEIDINGEN, function(id, r) {
        $('<button type="button" role="menuitem">').attr('data-rondleiding', id)
            .append($('<b>').text(r.naam), $('<span>').text(r.uitleg))
            .appendTo($menu);
    });
    $menu.insertAfter($knop);
    $knop.attr({'aria-haspopup': 'menu', 'aria-controls': 'rondleiding_menu'});
    this.$menu = $menu;

    $knop.on('click', function() {
        if (self.index >= 0) self.stop();
        else if ($menu.prop('hidden')) self.open_menu();
        else self.sluit_menu();
    });
    $menu.on('click', '[data-rondleiding]', function() {
        self.sluit_menu(true);
        self.start($(this).attr('data-rondleiding'));
    });
    $menu.on('keydown', function(e) {
        var items = $menu.find('button');
        var i = items.index(document.activeElement);
        if (e.key == 'Escape') { self.sluit_menu(); $knop.trigger('focus'); e.preventDefault(); }
        else if (e.key == 'ArrowDown') { items.eq((i + 1) % items.length).trigger('focus'); e.preventDefault(); }
        else if (e.key == 'ArrowUp') { items.eq((i - 1 + items.length) % items.length).trigger('focus'); e.preventDefault(); }
    });
    $(document).on('mousedown touchstart', function(e) {
        if (!$menu.prop('hidden') && !$(e.target).closest($menu.add($knop)).length) self.sluit_menu();
    });
};

Rondleiding.prototype.open_menu = function() {
    this.$menu.prop('hidden', false);
    this.$knop.attr('aria-expanded', 'true');
    this.$menu.find('button').first().trigger('focus');
};

Rondleiding.prototype.sluit_menu = function(tour_start) {
    this.$menu.prop('hidden', true);
    if (!tour_start) this.$knop.attr('aria-expanded', 'false');
};

Rondleiding.prototype.start = function(naam) {
    var self = this;
    this.rondleiding = RONDLEIDINGEN[naam] || RONDLEIDINGEN.leerling;
    this.stappen = this.rondleiding.stappen;
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
    if (index >= this.stappen.length) { this.stop(); return; }
    if (index < 0) return;
    var stap = this.stappen[index];
    var extra = '';
    if (!(this.herstel && stap.voor && stap.voor == this.voor)) {
        // the next step needs the same (the diagram stays open): leave the page as it is
        this.zet_terug();
        extra = this.zet_klaar(stap.voor);
        this.voor = stap.voor;
    }
    this.index = index;
    var laatste = index == this.stappen.length - 1;

    this.$ballon.html(
        '<button type="button" class="tour_sluit" data-tour="stop" aria-label="Sluit de rondleiding" title="Sluiten (Esc)">&times;</button>' +
        '<div class="tour_teller">' + this.rondleiding.naam + ' &middot; ' + (index + 1) + ' van ' +
        this.stappen.length + '</div>' +
        '<h2 id="tour_titel">' + stap.titel + '</h2>' +
        '<p>' + stap.tekst + '</p>' +
        (extra ? '<p class="tour_extra">' + extra + '</p>' : '') +
        (laatste ? '<p class="tour_extra">' + this.rondleiding.einde + '</p>' : '') +
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
    var el = $(this.stappen[this.index].doel)[0];
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
exports.RONDLEIDINGEN = RONDLEIDINGEN;
