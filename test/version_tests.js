var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');

/*
    De versie onderaan de webapp (modelleertaal-app.js) moet gelijk zijn aan package.json.
    Release: `npm version <nieuw>` past beide aan (tools/sync-version.js), of draai
    `node tools/sync-version.js` na het aanpassen van package.json.
*/
describe('versie', function () {
    it('modelleertaal-app.js heeft dezelfde versie als package.json', function () {
        var src = fs.readFileSync(path.join(__dirname, '..', 'modelleertaal-app.js'), 'utf8');
        var m = /^var version = "(v[^"]*)";/m.exec(src);
        assert.isNotNull(m, 'var version niet gevonden');
        assert.equal(m[1], 'v' + require('../package.json').version,
            'draai: node tools/sync-version.js');
    });
});
