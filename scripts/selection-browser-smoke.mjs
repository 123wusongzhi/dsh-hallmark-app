// Own headless browser + own fixture profile. Never attaches to the user's authenticated DSH.
import {build} from 'esbuild';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const directory=resolve('test/browser/selection-artifacts');await mkdir(directory,{recursive:true});
const built=await build({entryPoints:[resolve('test/browser/selection-fixture.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic'});
const html=join(directory,'selection-fixture.html');
const styles=`:root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#eef0f2;--dsw-alias-label-primary:#0f1115;--dsw-alias-label-secondary:#61666b;--dsw-alias-border-l1:#0000000a;--dsw-alias-border-l2:#0000001a;--dsw-alias-brand-primary:#0f1115}body{margin:0;font:14px system-ui;background:#eef2f6;color:#20252c}.selection-fixture{padding:24px;max-width:1540px;margin:auto}.fixture-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px}.fixture-heading h1{font-size:27px;margin:6px 0}.fixture-heading p{color:#58616d}.fixture-eyebrow{font-size:11px;letter-spacing:.12em;color:#627083}.fixture-mode,.fixture-not-sent{border:1px solid #c8d7ea;color:#1e5b9b;background:#eaf2fc;padding:6px 10px;border-radius:6px;font-size:12px}.fixture-controls{display:flex;gap:10px;align-items:center;margin:12px 0 20px}.fixture-controls span{font-size:12px;color:#58616d;margin-left:auto}.fixture-columns{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:20px;align-items:start}.fixture-table-panel,.fixture-composer{background:#fff;border:1px solid #dce1e7;border-radius:12px;padding:20px;min-width:0}.fixture-composer{display:grid;gap:12px}.fixture-composer h2{font-size:18px}.fixture-composer p{font-size:12px;color:#58616d}.selection-fixture .fixture-composer textarea{min-height:460px;font:12px/1.7 Consolas,monospace!important;white-space:pre-wrap;overflow-wrap:anywhere;resize:vertical}.fixture-composer [role=status]{font-size:12px;line-height:1.6;color:#356249}.fixture-not-sent{justify-self:start}#fixture-result{padding-top:18px;color:#356249;font-size:12px}@media(max-width:850px){.fixture-columns{grid-template-columns:1fr}.fixture-controls{flex-wrap:wrap}.fixture-heading{align-items:start;flex-direction:column}}`;
const chartStyles='.fixture-charts{margin-top:24px;background:#fff;border:1px solid #dce1e7;border-radius:12px;padding:22px}.fixture-charts h2{margin:10px 0}.fixture-charts [data-testid=chart-container]{padding:0;box-sizing:border-box}.fixture-charts p{font-size:12px;color:#58616d}';
await writeFile(html,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH isolated product-selection and chart test</title><style>${styles}${chartStyles}</style><div id="root"></div><script>${built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`);
const portServer=createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${join(directory,`browser-profile-${port}`)}`,'--window-size=1672,1000','about:blank'],{stdio:['ignore','ignore','pipe']});
let browserDiagnostics='';child.stderr.on('data',chunk=>{browserDiagnostics=(browserDiagnostics+String(chunk)).slice(-8000);});
let socket;let sequence=0;const pending=new Map();const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Owned browser command timed out: ${method}`));},10000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
try{
  let pages;for(let i=0;i<100;i++){try{pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());if(pages.length)break;}catch{}await pause(100);}
  if(!pages?.length)throw new Error('Owned fixture browser did not launch');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}});
  socket.addEventListener('close',()=>{for(const request of pending.values())request.reject(new Error('Owned fixture browser closed its debugging connection'));pending.clear();});
  await command('Page.enable');await command('Runtime.enable');await command('Page.navigate',{url:pathToFileURL(html).href});
  let result;for(let i=0;i<300;i++){const value=await command('Runtime.evaluate',{expression:'window.__SELECTION_SCREENSHOT_READY__ ? window.__SELECTION_SMOKE_RESULT__ : undefined',returnByValue:true});result=value.result?.value;if(result)break;await pause(100);}
  if(!result)throw new Error('Selection fixture did not complete');
  await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));
  await rm(join(directory,'browser-error.txt'),{force:true});
  const screenshot=await command('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'selection-to-chat.png'),Buffer.from(screenshot.data,'base64'));
  await command('Runtime.evaluate',{expression:'document.querySelector("[data-testid=chart-verification]").scrollIntoView({block:"start"})'});await pause(120);
  const chartScreenshot=await command('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'recharts-line-wide.png'),Buffer.from(chartScreenshot.data,'base64'));
  await command('Runtime.evaluate',{expression:'[...document.querySelectorAll("[data-testid=chart-container] [role=tab]")].find(x=>x.textContent==="参考利润柱图").click();[...document.querySelectorAll("button")].find(x=>x.textContent==="切换图表容器宽度").click()'});await pause(180);
  const narrowScreenshot=await command('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'recharts-bar-narrow.png'),Buffer.from(narrowScreenshot.data,'base64'));
  console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}catch(error){
  await writeFile(join(directory,'browser-error.txt'),`${String(error)}\n${browserDiagnostics}`);throw error;
}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await command('Browser.close');}catch{}socket.close();}
  if(child.exitCode===null){await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(3000)]);if(child.exitCode===null)child.kill();}
}
