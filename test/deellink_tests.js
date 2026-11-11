var assert = require('chai').assert;

var deellink = require("../deellink.js");

/*
    Backwards compatibility of "Deel link".

    The links below were made by released versions of the webapp and are shared by
    teachers and students (in lesson material, chats, mail). They must keep working.

    NEVER CHANGE OR REMOVE THESE LINKS. A new version of the link format gets new
    frozen links next to these (see the rules at the top of deellink.js).
*/

var CHAMPIGNON_M = "'Examen VWO 2005-I Champignon\r\nFz = m * 9,81\r\nFw = k * Opp * v^2\r\nFr = Fz - Fw\r\na = Fr/m\r\nv = v + a*dt\r\nx = x + v*dt\r\nals t > 13 dan\r\n    Opp = Opp + dOpp\r\neindals\r\nals Opp > 42,6 dan\r\n    Opp = 42,6\r\neindals\r\nt = t + dt\r\n";
var CHAMPIGNON_S = "m = 91\r\nk = 0,37\r\nOpp = 0,8\r\nv = 0\r\nx = 0\r\nt = 0\r\ndOpp = 1,1\r\ndt = 0,1\r\n";
var UNICODE_M = "// slinger, θ in graden\nα = -g/L * sin(θ)\nω = ω + α*dt\nθ = θ + ω*dt\nFw = ½ * ρ * v² * A   ' …\nt = t + dt";
var UNICODE_S = "θ = 10\nω = 0\ng = 9,81\nL = 1,5 // m\nρ = 1,293\ndt = 0,01\nt = 0";

var FROZEN = {
    // version 1: webapp 6.0 - 6.1 (#code=<payload>, made with btoa(unescape(encodeURIComponent(json))))
    v1_champignon: "eyJtIjoiJ0V4YW1lbiBWV08gMjAwNS1JIENoYW1waWdub25cclxuRnogPSBtICogOSw4MVxyXG5GdyA9IGsgKiBPcH" +
        "AgKiB2XjJcclxuRnIgPSBGeiAtIEZ3XHJcbmEgPSBGci9tXHJcbnYgPSB2ICsgYSpkdFxyXG54ID0geCArIHYqZHRc" +
        "clxuYWxzIHQgPiAxMyBkYW5cclxuICAgIE9wcCA9IE9wcCArIGRPcHBcclxuZWluZGFsc1xyXG5hbHMgT3BwID4gND" +
        "IsNiBkYW5cclxuICAgIE9wcCA9IDQyLDZcclxuZWluZGFsc1xyXG50ID0gdCArIGR0XHJcbiIsInMiOiJtID0gOTFc" +
        "clxuayA9IDAsMzdcclxuT3BwID0gMCw4XHJcbnYgPSAwXHJcbnggPSAwXHJcbnQgPSAwXHJcbmRPcHAgPSAxLDFccl" +
        "xuZHQgPSAwLDFcclxuIiwidCI6IkNoYW1waWdub24gKGFhbmdlcGFzdCkiLCJOIjo1MDB9",
    v1_unicode: "eyJtIjoiLy8gc2xpbmdlciwgzrggaW4gZ3JhZGVuXG7OsSA9IC1nL0wgKiBzaW4ozrgpXG7PiSA9IM-JICsgzrEqZH" +
        "Rcbs64ID0gzrggKyDPiSpkdFxuRncgPSDCvSAqIM-BICogdsKyICogQSAgICcg4oCmXG50ID0gdCArIGR0IiwicyI6" +
        "Is64ID0gMTBcbs-JID0gMFxuZyA9IDksODFcbkwgPSAxLDUgLy8gbVxuz4EgPSAxLDI5M1xuZHQgPSAwLDAxXG50ID" +
        "0gMCIsInQiOiJTbGluZ2VyIM64IOKAkyDigJx0ZXN04oCdIOKckyIsIk4iOjIwMDB9",
    v1_zonder_titel_en_N: "eyJtIjoieCA9IHggKyAxIiwicyI6InggPSAwIn0",
    // version 2: #code=v2.<payload>
    v2_champignon: "v2.eyJtIjoiJ0V4YW1lbiBWV08gMjAwNS1JIENoYW1waWdub25cclxuRnogPSBtICogOSw4MVxyXG5GdyA9IGsgKiB" +
        "PcHAgKiB2XjJcclxuRnIgPSBGeiAtIEZ3XHJcbmEgPSBGci9tXHJcbnYgPSB2ICsgYSpkdFxyXG54ID0geCArIHYqZ" +
        "HRcclxuYWxzIHQgPiAxMyBkYW5cclxuICAgIE9wcCA9IE9wcCArIGRPcHBcclxuZWluZGFsc1xyXG5hbHMgT3BwID4" +
        "gNDIsNiBkYW5cclxuICAgIE9wcCA9IDQyLDZcclxuZWluZGFsc1xyXG50ID0gdCArIGR0XHJcbiIsInMiOiJtID0gO" +
        "TFcclxuayA9IDAsMzdcclxuT3BwID0gMCw4XHJcbnYgPSAwXHJcbnggPSAwXHJcbnQgPSAwXHJcbmRPcHAgPSAxLDF" +
        "cclxuZHQgPSAwLDFcclxuIiwidCI6IkNoYW1waWdub24gKGFhbmdlcGFzdCkiLCJOIjo1MDB9",
    v2_unicode: "v2.eyJtIjoiLy8gc2xpbmdlciwgzrggaW4gZ3JhZGVuXG7OsSA9IC1nL0wgKiBzaW4ozrgpXG7PiSA9IM-JICsgzrE" +
        "qZHRcbs64ID0gzrggKyDPiSpkdFxuRncgPSDCvSAqIM-BICogdsKyICogQSAgICcg4oCmXG50ID0gdCArIGR0Iiwic" +
        "yI6Is64ID0gMTBcbs-JID0gMFxuZyA9IDksODFcbkwgPSAxLDUgLy8gbVxuz4EgPSAxLDI5M1xuZHQgPSAwLDAxXG5" +
        "0ID0gMCIsInQiOiJTbGluZ2VyIM64IOKAkyDigJx0ZXN04oCdIOKckyIsIk4iOjIwMDB9"
};

describe('deellink.js - oude links blijven werken (backwards compatible)', function() {

    it('versie 1 (webapp 6.0/6.1): champignon met titel en N', function() {
        var model = deellink.decode(FROZEN.v1_champignon);
        assert.equal(model.version, 1);
        assert.equal(model.modelregels, CHAMPIGNON_M);
        assert.equal(model.startwaarden, CHAMPIGNON_S);
        assert.equal(model.title, 'Champignon (aangepast)');
        assert.equal(model.N, 500);
    });

    it('versie 1: unicode (θ, ρ, ², ½, …, aanhalingstekens) blijft gelijk', function() {
        var model = deellink.decode(FROZEN.v1_unicode);
        assert.equal(model.modelregels, UNICODE_M);
        assert.equal(model.startwaarden, UNICODE_S);
        assert.equal(model.title, 'Slinger θ – “test” ✓');
        assert.equal(model.N, 2000);
    });

    it('versie 1: zonder titel en zonder N', function() {
        var model = deellink.decode(FROZEN.v1_zonder_titel_en_N);
        assert.equal(model.modelregels, 'x = x + 1');
        assert.equal(model.startwaarden, 'x = 0');
        assert.equal(model.title, '');
        assert.isUndefined(model.N);
    });

    it('versie 2: champignon en unicode', function() {
        var model = deellink.decode(FROZEN.v2_champignon);
        assert.equal(model.version, 2);
        assert.equal(model.modelregels, CHAMPIGNON_M);
        assert.equal(model.startwaarden, CHAMPIGNON_S);
        assert.equal(model.title, 'Champignon (aangepast)');
        assert.equal(model.N, 500);
        model = deellink.decode(FROZEN.v2_unicode);
        assert.equal(model.modelregels, UNICODE_M);
        assert.equal(model.title, 'Slinger θ – “test” ✓');
    });

    it('oude links met een heel model in de URL: #code=... uit de adresbalk', function() {
        var params = deellink.parse_hash('#code=' + FROZEN.v1_champignon);
        assert.equal(deellink.decode(params.code).modelregels, CHAMPIGNON_M);
        params = deellink.parse_hash('#code=' + FROZEN.v2_unicode + '&N=10');
        assert.equal(deellink.decode(params.code).startwaarden, UNICODE_S);
        assert.equal(params.N, '10');
    });

    it('oude links naar een model uit de lijst: #model=naam en #model=naam&N=100', function() {
        assert.deepEqual(deellink.parse_hash('#model=examenvwo2005'), {model: 'examenvwo2005'});
        assert.deepEqual(deellink.parse_hash('#model=examenvwo2005&N=100'), {model: 'examenvwo2005', N: '100'});
        assert.deepEqual(deellink.parse_hash('model=examenvwo2019-2'), {model: 'examenvwo2019-2'});
        assert.equal(deellink.parse_hash('#model=mijn%20model').model, 'mijn model');
        assert.deepEqual(deellink.parse_hash(''), {});
        assert.deepEqual(deellink.parse_hash('#debug'), {debug: ''});
    });
});

describe('deellink.js - nieuwe links', function() {

    it('een nieuwe link heeft de huidige versie en leest terug wat erin ging', function() {
        var model = {modelregels: UNICODE_M, startwaarden: UNICODE_S, title: 'Slinger', N: 750};
        var code = deellink.encode(model);
        assert.match(code, /^v\d+\.[A-Za-z0-9_-]+$/, 'alleen tekens die veilig zijn in een URL');
        var back = deellink.decode(code);
        assert.equal(back.version, deellink.VERSION);
        assert.equal(back.modelregels, model.modelregels);
        assert.equal(back.startwaarden, model.startwaarden);
        assert.equal(back.title, 'Slinger');
        assert.equal(back.N, 750);
    });

    it('zonder titel en N: die staan niet in de link', function() {
        var back = deellink.decode(deellink.encode({modelregels: 'a = 1', startwaarden: ''}));
        assert.equal(back.title, '');
        assert.isUndefined(back.N);
        assert.equal(back.startwaarden, '');
    });

    it('teken voor teken hetzelfde als versie 1 (alleen v2. ervoor)', function() {
        assert.equal(FROZEN.v2_champignon, 'v2.' + FROZEN.v1_champignon);
        assert.equal(FROZEN.v2_unicode, 'v2.' + FROZEN.v1_unicode);
    });

    it('veel verschillende tekens: heen en terug', function() {
        var text = '';
        for (var c = 1; c < 0x3000; c += 7) text += String.fromCharCode(c);
        text += '😀 𝜃 \u0000 \t \r\n';
        var back = deellink.decode(deellink.encode({modelregels: text, startwaarden: text}));
        assert.equal(back.modelregels, text);
        assert.equal(back.startwaarden, text);
    });
});

describe('deellink.js - robuust lezen (links uit chat, mail en documenten)', function() {

    it('standaard base64 met + / en = (in plaats van - en _)', function() {
        var standard = FROZEN.v1_unicode.replace(/-/g, '+').replace(/_/g, '/') + '==';
        assert.equal(deellink.decode(standard).modelregels, UNICODE_M);
    });

    it('spaties en regeleinden in de link (afgebroken over regels)', function() {
        var broken = FROZEN.v2_champignon.substr(0, 60) + '\n  ' + FROZEN.v2_champignon.substr(60, 80) +
            ' \r\n' + FROZEN.v2_champignon.substr(140);
        assert.equal(deellink.decode(broken).modelregels, CHAMPIGNON_M);
    });

    it('percent-encoded (door een andere website of app)', function() {
        assert.equal(deellink.decode(encodeURIComponent(FROZEN.v2_unicode)).title, 'Slinger θ – “test” ✓');
        assert.equal(deellink.decode(FROZEN.v2_unicode.replace('.', '%2E')).modelregels, UNICODE_M);
    });

    it('een punt of haakje achter de link (uit een zin gekopieerd)', function() {
        assert.equal(deellink.decode(FROZEN.v1_champignon + '.').modelregels, CHAMPIGNON_M);
        assert.equal(deellink.decode(FROZEN.v2_champignon + ').').modelregels, CHAMPIGNON_M);
        assert.equal(deellink.decode(FROZEN.v2_unicode + '"').modelregels, UNICODE_M);
    });

    it('hoofdletter V in de versie', function() {
        assert.equal(deellink.decode('V2.' + FROZEN.v1_zonder_titel_en_N).modelregels, 'x = x + 1');
    });

    it('afgebroken link: duidelijke melding, geen half model', function() {
        var err;
        try {
            deellink.decode(FROZEN.v2_champignon.substr(0, 200));
        } catch (e) {
            err = e;
        }
        assert.isDefined(err);
        assert.isTrue(err.deellink);
        assert.isTrue(err.incomplete);
        assert.include(err.message, 'helemaal gekopieerd');
    });

    it('een link van een nieuwere versie: melding, geen verkeerd model', function() {
        var err;
        try {
            deellink.decode('v99.' + FROZEN.v1_champignon);
        } catch (e) {
            err = e;
        }
        assert.isDefined(err);
        assert.isTrue(err.newer);
        assert.equal(err.version, 99);
        assert.include(err.message, 'nieuwere versie');
    });

    it('onzin of leeg: melding', function() {
        ['', 'abc', '!!!', 'v2.', deellink.encode({modelregels: 'x'}).substr(0, 5)].forEach(function(code) {
            assert.throws(function() { deellink.decode(code); }, /link/i, JSON.stringify(code));
        });
        // valid base64 and JSON, but no model in it
        var no_model = 'v2.' + 'eyJhIjoxfQ';   // {"a":1}
        assert.throws(function() { deellink.decode(no_model); }, /geen model/);
    });
});
