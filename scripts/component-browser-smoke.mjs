// Fresh, isolated Chrome only. Does not attach to DSH or any authenticated user browser.
import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const args = process.argv.slice(2);
const scope = args.find(value => value.startsWith('--scope='))?.slice('--scope='.length) ?? 'isolated';
if (scope !== 'isolated' || args.some(value => value !== '--scope=isolated')) throw new Error('Only --scope=isolated is supported; this runner does not verify an installed DSH plugin.');
const directory = resolve('test/browser/component-artifacts');
await mkdir(directory, { recursive: true });
const built = await build({ entryPoints: [resolve('test/browser/component-fixture.tsx')], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic' });
const html = join(directory, 'component-fixture.html');
// Only host tokens and fixture shell are provided here; all component/table styles come from production code.
const styles = `:root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f4f5f7;--dsw-alias-label-primary:#18202d;--dsw-alias-label-secondary:#687280;--dsw-alias-border-l1:#0000000a;--dsw-alias-border-l2:#e4e8ef;--dsw-alias-brand-primary:#0f1115}*{box-sizing:border-box}html,body,#root{margin:0;width:100%;min-height:100%}html{scrollbar-width:none}body{font:14px/1.65 "Segoe UI","Microsoft YaHei UI",sans-serif;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}#component-region{width:100%;min-width:0}.fixture-host{margin:24px;padding:18px;border:1px dashed var(--dsw-alias-border-l2);font-size:12px;overflow-wrap:anywhere}.fixture-host label{display:block}.fixture-host textarea{width:100%;height:180px;font:inherit;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}`;
await writeFile(html, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hallmark component — isolated synthetic fixture</title><style>${styles}</style><div id="root"></div><script>${built.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></html>`);
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${join(directory, `browser-profile-${port}`)}`, '--window-size=1040,900', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let diagnostics = '', socket, sequence = 0;
const pending = new Map();
child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-6000); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Fixture command timed out: ${method}`)); }, 10000);
  pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const answer = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (answer.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text);
  return answer.result?.value;
};
const screenshots = [];
const screenshot = async name => {
  await evaluate('window.scrollTo(0,0)');
  const clip = await evaluate('(()=>{const r=document.querySelector("#component-region").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
  const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
  await writeFile(join(directory, name), Buffer.from(image.data, 'base64'));
  screenshots.push({ path: join(directory, name), width: clip.width, height: clip.height, capture: 'Chrome Page.captureScreenshot clip of real component region; no image editing' });
};
function theme(dark) {
  document.body.toggleAttribute('data-ds-dark-theme', dark);
  const tokens = dark ? { 'bg-base': '#151517', 'bg-layer-1': '#232324', 'bg-layer-2': '#1c1d20', 'label-primary': '#f9fafb', 'label-secondary': '#cfd3d6', 'border-l1': '#ffffff0a', 'border-l2': '#ffffff1f', 'brand-primary': '#f9fafb' } : { 'bg-base': '#fff', 'bg-layer-1': '#fff', 'bg-layer-2': '#f4f5f7', 'label-primary': '#18202d', 'label-secondary': '#687280', 'border-l1': '#0000000a', 'border-l2': '#e4e8ef', 'brand-primary': '#0f1115' };
  for (const [key, value] of Object.entries(tokens)) document.documentElement.style.setProperty('--dsw-alias-' + key, value);
}
try {
  let pages;
  for (let i = 0; i < 100; i++) { try { pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json()); if (pages.length) break; } catch {} await pause(100); }
  if (!pages?.length) throw new Error('Isolated fixture browser unavailable');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => { const message = JSON.parse(event.data), request = pending.get(message.id); if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); } });
  socket.addEventListener('close', () => { for (const request of pending.values()) request.reject(new Error('Fixture browser disconnected')); pending.clear(); });
  await command('Page.enable'); await command('Runtime.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1040, height: 900, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: pathToFileURL(html).href });
  for (let i = 0; i < 150; i++) { if (await evaluate('Boolean(window.__COMPONENT_FIXTURE__)')) break; await pause(100); }
  await evaluate('window.__COMPONENT_FIXTURE__.verifyInitial()');
  await evaluate('window.__COMPONENT_FIXTURE__.verifySearchAndSelection()');
  await evaluate('window.__COMPONENT_FIXTURE__.verifyPageSize()');
  await evaluate('window.__COMPONENT_FIXTURE__.prepareSelectedPreview()');
  const layouts = { wide: await evaluate('window.__COMPONENT_FIXTURE__.verifyLayout("1040px light")') };
  await screenshot('component-wide-light.png');
  await evaluate(`(${theme.toString()})(true)`);
  layouts.wideDark = await evaluate('window.__COMPONENT_FIXTURE__.verifyLayout("1040px dark")');
  await screenshot('component-wide-dark.png');
  await command('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: false });
  layouts.narrowDark = await evaluate('window.__COMPONENT_FIXTURE__.verifyLayout("420px dark")');
  await screenshot('component-narrow-dark.png');
  await evaluate(`(${theme.toString()})(false)`);
  layouts.narrow = await evaluate('window.__COMPONENT_FIXTURE__.verifyLayout("420px light")');
  await screenshot('component-narrow-light.png');
  await command('Emulation.setDeviceMetricsOverride', { width: 1040, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate('window.__COMPONENT_FIXTURE__.verifyExplicit50()');
  layouts.explicit50 = await evaluate('window.__COMPONENT_FIXTURE__.verifyLayout("explicit 50 rows at 1040px")');
  await screenshot('component-spec50-light.png');
  const result = await evaluate('window.__COMPONENT_FIXTURE__.result()');
  Object.assign(result, { scope, layouts, screenshots, viewportSizes: [{ width: 1040, height: 900 }, { width: 420, height: 900 }] });
  await writeFile(join(directory, 'results.json'), JSON.stringify(result, null, 2));
  await rm(join(directory, 'browser-error.txt'), { force: true });
  console.log(JSON.stringify(result));
} catch (error) {
  let state; try { state = await evaluate('({text:document.body.innerText.slice(0,6000),result:window.__COMPONENT_FIXTURE__?.result()})'); } catch {}
  await writeFile(join(directory, 'browser-error.txt'), `${String(error)}\n${JSON.stringify(state)}\n${diagnostics}`); throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await command('Browser.close'); } catch {} socket.close(); }
  if (child.exitCode === null) { await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(3000)]); if (child.exitCode === null) child.kill(); }
}
