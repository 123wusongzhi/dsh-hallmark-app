// Executes the real React workbench in an owned headless browser with synthetic, controlled promises.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
const directory = resolve('test/browser/workbench-refresh-artifacts');
await mkdir(directory, { recursive: true });
const bundle = await build({ entryPoints: [resolve('test/browser/workbench-refresh-fixture.tsx')], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic' });
const html = join(directory, 'fixture.html');
await writeFile(html, `<!doctype html><meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(directory, `browser-profile-${process.pid}`)}`, '--dump-dom', '--virtual-time-budget=15000', pathToFileURL(html).href], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', diagnostic = '';
child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-5000); });
const timer = setTimeout(() => child.kill(), 30000);
try {
  await new Promise((yes, no) => { child.once('error', no); child.once('exit', yes); });
  const match = output.match(/<pre id="workbench-refresh-result">([^<]+)<\/pre>/);
  if (!match) throw new Error(`Fixture result unavailable: ${diagnostic}`);
  const result = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  await writeFile(join(directory, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); if (!result.ok) process.exitCode = 1;
} finally { clearTimeout(timer); }
