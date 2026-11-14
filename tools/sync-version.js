// Zet de versie uit package.json in modelleertaal-app.js (onderaan de webapp).
// Draait automatisch bij `npm version <nieuw>` (script "version" in package.json).
var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, '..', 'modelleertaal-app.js');
var v = require('../package.json').version;
var src = fs.readFileSync(file, 'utf8');
var out = src.replace(/^var version = "[^"]*";/m, 'var version = "v' + v + '";');
if (out === src && src.indexOf('var version = "v' + v + '";') < 0) {
    console.error('var version niet gevonden in modelleertaal-app.js');
    process.exit(1);
}
fs.writeFileSync(file, out);
console.log('modelleertaal-app.js: version = v' + v);
