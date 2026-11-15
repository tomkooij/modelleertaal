// screenshots.mjs: maak de screenshots van de webapp voor de README en DIDACTIEK.md (images/*.png)
//
// Gebruik (in de hoofdmap van de repository):
//   grunt build                      (de webapp heeft scripts/modelleertaal-app.browser.js nodig)
//   node tools/screenshots.mjs       (of: npm run screenshots)
//   node tools/screenshots.mjs uit   (schrijf de plaatjes naar de map 'uit' in plaats van images/)
//
// Nodig: Node.js 22 of nieuwer (ingebouwde WebSocket) en Google Chrome. Een andere Chrome geef je op
// met de omgevingsvariabele CHROME.
//
// Het script start een eigen webserver voor de repository, opent de webapp in Chrome headless en stuurt
// die aan via het Chrome DevTools Protocol: model laden, Run, startwaarde veranderen, enzovoort.
// Verander je de webapp zo dat de screenshots in de README er anders uit gaan zien, draai dit script dan
// opnieuw. Verandert een knop of een id, pas dan de stappen hieronder aan.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'images'));
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => existsSync(p));
const DEBUG_PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!CHROME) throw new Error('Chrome niet gevonden: geef het pad op met de omgevingsvariabele CHROME');
if (!existsSync(join(ROOT, 'scripts/modelleertaal-app.browser.js'))) {
  throw new Error('scripts/modelleertaal-app.browser.js ontbreekt: draai eerst grunt build');
}

// --- webserver voor de repository (zoals python -m http.server)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.xml': 'text/xml',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(path.endsWith('/') || path == ROOT ? join(path, 'index.html') : path);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;

// --- Chrome headless en het DevTools Protocol
const profile = await mkdtemp(join(tmpdir(), 'modelleertaal-screenshots-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, '--hide-scrollbars',
  '--user-data-dir=' + profile, '--no-first-run', 'about:blank']);
let targets = [];
for (let i = 0; i < 50 && !targets.length; i++) {
  try { targets = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).filter(t => t.type == 'page'); }
  catch { await sleep(200); }
}
if (!targets.length) throw new Error('Chrome start niet (draait er al iets op poort ' + DEBUG_PORT + '?)');
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0;
const pending = {};
const send = (method, params = {}) => new Promise(r => {
  pending[++id] = r;
  ws.send(JSON.stringify({ id, method, params }));
});
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
  // "Je hebt dit model aangepast. Pagina verlaten?": ja
  if (m.method == 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
};
const js = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(expr + '\n' + JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};
await send('Page.enable');

// --- hulpfuncties voor de stappen
async function view(width, height, mobile, scale) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
}
async function open(model) {
  // model uit modellen/ (#model=...), zonder automatisch bewaard werk van een vorige stap: de pagina
  // bewaart het werk bij het verlaten, dus eerst laden, localStorage leegmaken en dan opnieuw laden
  const url = BASE + '#model=' + model;
  await send('Page.navigate', { url });
  await sleep(2000);
  await js('localStorage.clear()');
  await send('Page.navigate', { url: url.replace('#', '?r=' + Date.now() + '#') });
  await sleep(2500);
}
async function shot(name, clip) {
  await sleep(800);
  const params = { format: 'png' };
  if (clip) params.clip = Object.assign({ scale: 1 }, clip);
  const r = await send('Page.captureScreenshot', params);
  await writeFile(join(OUT, name), Buffer.from(r.result.data, 'base64'));
  console.log('geschreven:', join(OUT, name));
}
const click_button = text => js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() == ${JSON.stringify(text)}).click()`);
const run = async () => { await js(`document.getElementById('run').click()`); await sleep(1500); };
const replace_startwaarden = (from, to) => js(`(function() {
  var cm = document.querySelectorAll('.CodeMirror')[1].CodeMirror;
  cm.setValue(cm.getValue().replace(${JSON.stringify(from)}, ${JSON.stringify(to)}));
})()`);

await mkdir(OUT, { recursive: true });
try {
  // 1. webapp-tekst.png: Champignon, (v,t), de vorige run (k = 0,37) in grijs, nu k = 0,25
  await view(1280, 800, false, 1);
  await open('examenvwo2005');
  await run();
  await replace_startwaarden('k = 0,37', 'k = 0,25');
  await run();
  await js(`document.querySelectorAll('#graph_tabs button')[1].click()`);   // (v,t)
  await js('scrollTo(0, 0)');
  await shot('webapp-tekst.png');

  // 2. webapp-grafisch.png: Tekst + grafisch, examenstijl (de hele kaart van het model)
  await view(1400, 900, false, 1);
  await open('examenvwo2005');
  await click_button('Tekst + grafisch');
  await sleep(1500);
  await click_button('Examen');
  await shot('webapp-grafisch.png', await js(`(function() {
    var r = document.querySelector('.area_model').getBoundingClientRect();
    return {x: r.left, y: r.top, width: r.width, height: r.height};
  })()`));

  // 3. webapp-grafisch-kleur.png: hetzelfde diagram in kleur, van de knoppen tot en met Herkende elementen
  await click_button('Kleur');
  await shot('webapp-grafisch-kleur.png', await js(`(function() {
    var a = document.getElementById('grafisch_knoppen').getBoundingClientRect(),
        b = document.querySelector('details.grafisch_lijst').getBoundingClientRect(),
        v = document.getElementById('grafisch_view').getBoundingClientRect();
    return {x: a.left - 2, y: a.top - 2, width: v.width + 4, height: b.bottom - a.top + 4};
  })()`));
  await click_button('Examen');   // de keuze wordt onthouden: terug naar de standaard

  // 4. webapp-telefoon.png: telefoon (390 x 844, 2x), vrije worp 2022-I, de grafiek na Run
  await view(390, 844, true, 2);
  await open('examenvwo2022');
  await run();
  await sleep(1500);
  await js(`scrollTo(0, document.querySelector('.area_graph').getBoundingClientRect().top + scrollY - 8)`);
  await shot('webapp-telefoon.png');

  // 5. en 6. raaklijn-*.png: kogelbaan met luchtweerstand, (y,t). Klik op een punt: de raaklijn tot aan de
  // assen. Klik op de raaklijn: de helling uit de twee eindpunten (DIDACTIEK.md)
  await view(1280, 800, false, 1);
  await open('c3/kogelbaan_luchtweerstand');
  await run();
  await js(`document.querySelectorAll('#graph_tabs button')[2].click()`);   // (y,t)
  await sleep(500);
  await js(`document.getElementById('graph').scrollIntoView()`);
  const graph_clip = () => js(`(function() {
    var r = document.querySelector('.graph_wrap').getBoundingClientRect();
    return {x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height};
  })()`);
  // het scherm-punt van (x, y) in de grafiek
  const screen = (x, y) => js(`(function() {
    var o = m.plot_object.pointOffset({x: ${x}, y: ${y}}), g = document.getElementById('graph').getBoundingClientRect();
    return [g.left + o.left, g.top + o.top];
  })()`);
  const mouse_click = async ([x, y]) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
    // de muis weg: geen markering van flot bij het punt onder de muis
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await sleep(500);
  };
  const row = 25;   // t = 0,25 s
  await mouse_click(await screen(`m.results[${row}][m.allVars.indexOf('t')]`, `m.results[${row}][m.allVars.indexOf('y')]`));
  await shot('raaklijn-punt.png', await graph_clip());
  // op de raaklijn, tussen het punt en het eind rechtsboven
  await mouse_click(await screen(`(m.read_tangent.point[0] + m.read_tangent.line[1][0]) / 2`,
                                 `(m.read_tangent.point[1] + m.read_tangent.line[1][1]) / 2`));
  await shot('raaklijn-helling.png', await graph_clip());
} finally {
  ws.close();
  chrome.kill();
  server.close();
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
