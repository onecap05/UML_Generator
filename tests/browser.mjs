/** Optional browser QA using Chrome's native debugging protocol; no test dependencies. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const browserPath = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const output = path.resolve('.tmp');
await mkdir(path.join(output, 'downloads'), { recursive: true });
const server = spawn(process.execPath, ['tools/serve.js'], { windowsHide: true, stdio: 'pipe' });
const chrome = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9223', `--user-data-dir=${path.join(output, 'chrome-profile')}`, '--window-size=1366,768', 'about:blank'], { windowsHide: true, stdio: 'pipe' });
let browserError = '';
chrome.stderr.on('data', chunk => { browserError += chunk; });
chrome.on('error', error => { browserError += error.message; });
chrome.on('exit', (code, signal) => { browserError += ` Exit code=${code}, signal=${signal}`; });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let targets;
  for (let retry = 0; retry < 80; retry++) {
    if (chrome.exitCode !== null || chrome.signalCode !== null || browserError.includes('EPERM') || browserError.includes('EACCES')) throw new Error(`Chrome launch failed: ${browserError}`);
    try { await fetch('http://127.0.0.1:8080', { signal: AbortSignal.timeout(1000) }); targets = await (await fetch('http://127.0.0.1:9223/json', { signal: AbortSignal.timeout(1000) })).json(); if (targets.some(t => t.type === 'page')) break; } catch { /* Browser and static server may still be starting. */ }
    await delay(100);
  }
  const target = targets?.find(t => t.type === 'page'); assert.ok(target, 'Chrome debugging endpoint available');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0; const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description ?? ''));
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(JSON.stringify(message.params.args));
    if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
    const entry = pending.get(message.id);
    if (entry) { pending.delete(message.id); message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result); }
  };
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function click(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async function drag(from, to) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...to, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', clickCount: 1 });
  }
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(output, 'downloads') });
  await send('Page.navigate', { url: 'http://127.0.0.1:8080' });
  for (let i = 0; i < 60; i++) { if (await evaluate('Boolean(document.querySelector(".palette-item"))')) break; await delay(100); }
  await evaluate('window.app = (await import("/src/js/main.js")).editor;void 0');
  assert.equal(await evaluate('app.model.nodes.length'), 0);
  const viewport = await evaluate('(()=>{const r=app.viewport.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()');
  assert.ok(viewport.height < 650 && viewport.height > 400, 'canvas fits within 768px screen');
  for (const [type, x, y] of [['initial', 65, 170], ['state', 210, 170], ['state', 460, 170], ['state', 680, 350], ['final', 760, 170]]) {
    await evaluate(`document.querySelector('[data-tool="${type}"]').click()`); await click(viewport.x + x, viewport.y + y);
  }
  assert.equal(await evaluate('app.model.nodes.length'), 5, 'palette creates actual states');
  await evaluate('app.setTool("transition")');
  async function nodePoint(index, side = 'center') {
    return evaluate(`(()=>{const n=app.model.nodes[${index}],r=app.canvas.getBoundingClientRect();return {x:r.x+(n.x+${side === 'right' ? 'n.width' : 'n.width/2'})*app.zoom.value,y:r.y+(n.y+n.height/2)*app.zoom.value}})()`);
  }
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 4], [1, 1]]) { const p = await nodePoint(a), q = await nodePoint(b); await click(p.x, p.y); await click(q.x, q.y); }
  assert.equal(await evaluate('app.model.transitions.length'), 5, 'two-click transitions and self transition');
  await evaluate('app.setTool("select");app.selection.clear();app.selection.add(app.model.nodes[1].id);app.refresh()');
  const before = await evaluate('app.model.nodes[1].x');
  const p = await nodePoint(1); await drag(p, { x: p.x + 40, y: p.y + 40 });
  assert.equal(await evaluate('app.model.nodes[1].x'), before + 40, 'pointer drag follows mouse');
  await evaluate('document.getElementById("property-name").value="Pendiente";document.getElementById("property-name").dispatchEvent(new Event("change"))');
  assert.equal(await evaluate('app.model.nodes[1].name'), 'Pendiente', 'inspector edits model');
  await evaluate('app.run("undo")'); assert.notEqual(await evaluate('app.model.nodes[1].name'), 'Pendiente');
  await evaluate('app.run("redo")'); assert.equal(await evaluate('app.model.nodes[1].name'), 'Pendiente');
  await evaluate('app.run("duplicate")'); assert.equal(await evaluate('app.model.nodes.length'), 6);
  await evaluate('app.deleteSelection()'); assert.equal(await evaluate('app.model.nodes.length'), 5);
  await evaluate('app.run("copy");app.run("undo");app.selection.clear();app.selection.add(app.model.nodes[2].id);app.refresh();app.run("copy");app.run("paste")');
  assert.equal(await evaluate('app.model.nodes.length'), 7, 'copy and paste work');
  // Port-to-node gesture at a reduced zoom catches coordinate and pointer-capture mistakes.
  await evaluate('app.zoom.set(.7);app.selection.clear();app.selection.add(app.model.nodes[6].id);app.refresh()');
  const count = await evaluate('app.model.transitions.length');
  await drag(await nodePoint(6, 'right'), await nodePoint(3));
  assert.equal(await evaluate('app.model.transitions.length'), count + 1, 'port gesture at zoom 70%');
  // Keyboard selection is available on focusable SVG elements, without stealing text editing keys.
  await evaluate('app.canvas.querySelector("[data-node-id]").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await evaluate('[...app.selection][0] === app.model.nodes[0].id'), true);
  await evaluate('document.getElementById("property-name").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  assert.equal(await evaluate('app.selection.size'), 1, 'Ctrl+A inside inspector keeps diagram selection');
  await evaluate('app.dirty=false;await app.loadExample()');
  assert.equal(await evaluate('app.model.data.metadata.name'), 'Ciclo de un pedido');
  await evaluate('await app.run("svg");await app.run("png");await app.run("save")');
  for (let i = 0; i < 50; i++) { const files = await readdir(path.join(output, 'downloads')); if (['svg', 'png', 'json'].every(ext => files.some(f => f.endsWith('.' + ext)))) break; await delay(100); }
  const files = await readdir(path.join(output, 'downloads'));
  for (const ext of ['svg', 'png', 'json']) assert.ok(files.some(f => f.endsWith('.' + ext)), `${ext} download`);
  const png = await readFile(path.join(output, 'downloads', files.find(f => f.endsWith('.png')))); assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.ok(png.readUInt32BE(16) > 1000);
  const svg = await readFile(path.join(output, 'downloads', files.find(f => f.endsWith('.svg'))), 'utf8'); assert.ok(svg.includes('<style>')); assert.ok(!svg.includes('data-ui'));
  await evaluate('app.run("new")'); assert.equal(await evaluate('app.model.nodes.length'), 0);
  const doc = await send('DOM.getDocument'); const fileInput = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#file-input' });
  await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [path.join(output, 'downloads', files.find(f => f.endsWith('.json')))] });
  for (let i = 0; i < 50; i++) { if (await evaluate('app.model.nodes.length === 5')) break; await delay(100); }
  assert.equal(await evaluate('app.model.transitions.length'), 5, 'imported JSON reconnects endpoints');
  await evaluate('app.zoom.fit()');
  let shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'editor-1366.png'), Buffer.from(shot.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }); await evaluate('app.zoom.fit()');
  shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'editor-1920.png'), Buffer.from(shot.data, 'base64'));
  // Composite rendering and serialization remain valid in the real browser.
  await evaluate('app.dirty=false;await app.openFile(new File([await (await fetch("examples/compuesto.json")).text()],"compuesto.json"));app.zoom.fit()');
  assert.equal(await evaluate('document.querySelectorAll("#validation-results .error").length'), 0);
  assert.ok(await evaluate('app.model.nodes.some(n=>n.parentId)'));
  const compoundBefore = await evaluate('(()=>{const p=app.model.nodes.find(n=>n.type==="composite"),c=app.model.nodes.find(n=>n.parentId===p.id);return {parent:p.id,child:c.id,x:c.x,y:c.y}})()');
  await evaluate(`app.selection.clear();app.selection.add(${JSON.stringify(compoundBefore.parent)});app.refresh()`);
  const headerPoint = await evaluate('(()=>{const n=app.model.nodes.find(n=>n.type==="composite"),r=app.canvas.getBoundingClientRect();return {x:r.x+(n.x+n.width/2)*app.zoom.value,y:r.y+(n.y+23)*app.zoom.value}})()');
  await drag(headerPoint, { x: headerPoint.x + 44, y: headerPoint.y + 44 });
  assert.ok(await evaluate(`app.model.node(${JSON.stringify(compoundBefore.child)}).x > ${compoundBefore.x}`), 'dragging composite moves its child');
  await evaluate('app.selection.clear();app.refresh();app.zoom.fit()');
  shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(output, 'compuesto-1920.png'), Buffer.from(shot.data, 'base64'));
  assert.deepEqual(errors, [], 'no JavaScript console errors in main flows');
  console.log('Browser QA passed: creation, transitions, loop, drag, inspector, undo/redo, duplication, copy/paste, zoomed ports, SVG/PNG/JSON downloads, file import, composites, 1366×768 and 1920×1080.');
  console.log('Screenshots and downloads: .tmp/');
} finally {
  socket?.close(); chrome.kill(); server.kill();
}
