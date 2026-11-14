/*
    modelkeuze.js

    De gelaagde modelkeuze: verzameling (groep) -> kopje (sectie) -> model.

    model_index (modellen/models.js) is één platte lijst. Elk model heeft een groep
    (eerste keuzelijst) en een sectie (kopje in de tweede keuzelijst). Een model
    zonder groep komt in de groep OVERIG. De volgorde van groepen en secties is de
    volgorde waarin ze voor het eerst in de lijst staan.

    No DOM.

    usage:
      var modelkeuze = require('./modelkeuze.js');
      modelkeuze.groepen(model_index)          // ['Examens vwo', 'C2 Energie en arbeid', ...]
      modelkeuze.secties(model_index, 'C3 Gravitatie')
          // [{sectie: 'Basismodellen', modellen: [{index: 21, title: '0 Horizontale worp'}, ...]}, ...]
      modelkeuze.groep_van(model_index[i])     // 'C3 Gravitatie'
      modelkeuze.naam_van_url('modellen/c2/Bungeejumper.xml')   // 'c2/Bungeejumper'
      modelkeuze.zoek_url(model_index, 'modellen/c3/kogelbaan.xml')   // index in groep C3 (or first match), or -1
*/

//jshint node:true
//jshint es3:true
"use strict";

var OVERIG = 'Overige modellen';


function groep_van(entry) {
    return (entry && entry.groep) ? String(entry.groep) : OVERIG;
}


function groepen(model_index) {
    var result = [];
    for (var i = 0; i < model_index.length; i++) {
        var groep = groep_van(model_index[i]);
        if (result.indexOf(groep) == -1) result.push(groep);
    }
    return result;
}


function secties(model_index, groep) {
    var result = [], by_name = {};
    for (var i = 0; i < model_index.length; i++) {
        var entry = model_index[i];
        if (groep_van(entry) != groep) continue;
        var sectie = entry.sectie ? String(entry.sectie) : '';
        if (!by_name.hasOwnProperty(sectie)) {
            by_name[sectie] = {sectie: sectie, modellen: []};
            result.push(by_name[sectie]);
        }
        by_name[sectie].modellen.push({index: i, title: entry.title});
    }
    return result;
}


function naam_van_url(url) {
    // modellen/naam.xml --> naam, modellen/c2/naam.xml --> c2/naam (used in #model=...)
    var match = /^(?:.*\/)?modellen\/(.+)\.xml$/.exec(String(url || ''));
    if (match) return match[1];
    match = /([^\/]+)\.xml$/.exec(String(url || ''));
    return match ? match[1] : null;
}


function zoek_url(model_index, url) {
    // the model with this url. A model can be in more than one groep (Basismodellen and its
    // module). A model in a submap (modellen/c3/...) is found in the groep of its module (the
    // groep that starts with the name of the submap: 'C3 Gravitatie'), else the first one.
    var match = /modellen\/([^\/]+)\/[^\/]+$/.exec(String(url || ''));
    var module = match ? match[1].toLowerCase() + ' ' : null;
    var first = -1;
    for (var i = 0; i < model_index.length; i++) {
        if (model_index[i].url != url) continue;
        if (first == -1) first = i;
        if (module && groep_van(model_index[i]).toLowerCase().indexOf(module) === 0) return i;
    }
    return first;
}


exports.OVERIG = OVERIG;
exports.groep_van = groep_van;
exports.groepen = groepen;
exports.secties = secties;
exports.naam_van_url = naam_van_url;
exports.zoek_url = zoek_url;
