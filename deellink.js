/*
    deellink.js

    "Deel link": the complete model in the URL, so a student or teacher can share a
    (changed) model without a file. This module makes and reads those links.
    No DOM, no browser APIs: tested with mocha (test/deellink_tests.js).

    Formats (the part after # in the URL):

      #model=examenvwo2005&N=100     a model from modellen/ (and optionally N)

      #code=<payload>                version 1 (webapp 6.0 - 6.1). payload is
                                     base64url(utf-8(JSON)) without '=' padding,
                                     JSON: {"m": modelregels, "s": startwaarden,
                                            "t": titel (optional), "N": iteraties (optional)}

      #code=v2.<payload>             version 2: the same JSON and encoding, with a version
                                     in front. '.' never occurs in base64url, so a link
                                     without "v<number>." is always version 1.

    Rules for the future (backwards compatibility):
      - A link that was ever shared must keep working. The tests have frozen links of
        every version: they may never be changed, only added.
      - A new version (other encoding, compression, ...) gets a new number: "v3.".
        decode() keeps reading all older versions.
      - New fields in the JSON are optional; unknown fields are ignored. So adding a
        field does not need a new version.
      - A link of a newer version than this webapp knows gives a clear message
        (err.newer), not a wrong model.

    Reading is forgiving, because links are copied through chat, mail and documents:
    standard base64 (+/ and = padding), spaces and line breaks, percent-encoding and
    a character stuck to the end (a period or bracket after the link) are accepted.

    usage:
      var deellink = require('./deellink.js');
      deellink.encode({modelregels: 'x = x + v*dt', startwaarden: 'x = 0', title: 'Val', N: 100})
        --> 'v2.eyJ...'
      deellink.decode('v2.eyJ...')
        --> {modelregels, startwaarden, title, N, version: 2}
      deellink.parse_hash('#model=examenvwo2005&N=100')
        --> {model: 'examenvwo2005', N: '100'}
*/

//jshint node:true
//jshint es3:true
"use strict";

var VERSION = 2;   // the version of new links

var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';


// ------------------------------------------------------------------ utf-8

function utf8_bytes(str) {
    // string --> array of utf-8 bytes (same result as unescape(encodeURIComponent(str)))
    var encoded = encodeURIComponent(str), bytes = [];
    for (var i = 0; i < encoded.length; i++) {
        if (encoded.charAt(i) == '%') {
            bytes.push(parseInt(encoded.substr(i + 1, 2), 16));
            i += 2;
        } else {
            bytes.push(encoded.charCodeAt(i));
        }
    }
    return bytes;
}

function utf8_string(bytes) {
    // array of utf-8 bytes --> string. Throws on invalid utf-8.
    var encoded = '';
    for (var i = 0; i < bytes.length; i++) {
        encoded += '%' + (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return decodeURIComponent(encoded);
}


// ------------------------------------------------------------------ base64url

function base64url_encode(bytes) {
    // bytes --> base64url without '=' padding
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
        var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
        out += ALPHABET.charAt((n >> 18) & 63) + ALPHABET.charAt((n >> 12) & 63);
        if (i + 1 < bytes.length) out += ALPHABET.charAt((n >> 6) & 63);
        if (i + 2 < bytes.length) out += ALPHABET.charAt(n & 63);
    }
    return out;
}

function base64_decode(text) {
    // base64url or standard base64 (with or without padding) --> bytes. Throws if invalid.
    text = text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (text.length % 4 == 1) throw new Error('base64: wrong length');
    var bytes = [], n = 0, bits = 0;
    for (var i = 0; i < text.length; i++) {
        var value = ALPHABET.indexOf(text.charAt(i));
        if (value == -1) throw new Error('base64: invalid character');
        n = (n << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((n >> bits) & 255);
        }
    }
    return bytes;
}


// ------------------------------------------------------------------ errors

function link_error(message, props) {
    var err = new Error(message);
    err.deellink = true;
    for (var key in props || {}) {
        if (props.hasOwnProperty(key)) err[key] = props[key];
    }
    return err;
}


// ------------------------------------------------------------------ links

function encode(model) {
    // model: {modelregels, startwaarden, title (optional), N (optional)} --> 'v2.<payload>'
    var json = {m: String(model.modelregels || ''), s: String(model.startwaarden || '')};
    if (model.title) json.t = String(model.title);
    var N = Number(model.N);
    if (isFinite(N) && N > 0) json.N = N;
    return 'v' + VERSION + '.' + base64url_encode(utf8_bytes(JSON.stringify(json)));
}


function clean(code) {
    // undo what chat, mail and documents do with a link
    code = String(code === undefined || code === null ? '' : code);
    if (code.indexOf('%') != -1) {
        try {
            code = decodeURIComponent(code);
        } catch (err) {
            // not percent-encoded after all: use as it is
        }
    }
    // spaces and line breaks (a long link broken over lines)
    return code.replace(/\s+/g, '');
}


function decode(code) {
    // the value of #code=... --> {modelregels, startwaarden, title, N, version}
    // Throws an Error with err.deellink = true (and err.newer for a newer version).
    code = clean(code);
    var version = 1, payload = code;
    var match = /^v(\d+)\.(.*)$/i.exec(code);
    if (match) {
        version = parseInt(match[1], 10);
        payload = match[2];
    }
    if (version > VERSION) {
        throw link_error('Deze link is gemaakt met een nieuwere versie van de webapp (versie ' + version +
            ' van de deellink). Ververs de pagina (Ctrl+F5) en probeer het opnieuw.', {newer: true, version: version});
    }
    if (version < 1) throw link_error('Deze link klopt niet (onbekende versie).');

    // versions 1 and 2: base64url(utf-8(JSON)).
    // A character stuck to the end of the link (a period, a bracket) is not base64: remove it.
    payload = payload.replace(/[^A-Za-z0-9\-_+\/=]+$/, '');
    var json;
    try {
        json = JSON.parse(utf8_string(base64_decode(payload)));
    } catch (err) {
        throw link_error('Het model in deze link kan niet gelezen worden. Is de link helemaal gekopieerd? ' +
            'Lange links worden soms afgebroken.', {incomplete: true});
    }
    if (!json || typeof json != 'object' || (json.m === undefined && json.s === undefined)) {
        throw link_error('In deze link staat geen model.');
    }

    var N = Number(json.N);
    return {
        modelregels: String(json.m === undefined || json.m === null ? '' : json.m),
        startwaarden: String(json.s === undefined || json.s === null ? '' : json.s),
        title: json.t ? String(json.t) : '',
        N: (isFinite(N) && N > 0) ? N : undefined,
        version: version
    };
}


function parse_hash(hash) {
    // '#model=examenvwo2005&N=100' --> {model: 'examenvwo2005', N: '100'}
    // Only the first '=' separates name and value (a value may contain '=').
    var params = {};
    hash = String(hash || '').replace(/^#/, '');
    hash.split('&').forEach(function(item) {
        if (!item) return;
        var i = item.indexOf('=');
        var name = i == -1 ? item : item.substr(0, i);
        var value = i == -1 ? '' : item.substr(i + 1);
        params[name] = value;
    });
    if (params.model) {
        try {
            params.model = decodeURIComponent(params.model);
        } catch (err) {
            // use as it is
        }
    }
    return params;
}


exports.VERSION = VERSION;
exports.encode = encode;
exports.decode = decode;
exports.parse_hash = parse_hash;
