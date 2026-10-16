// Only the isolated fixture is opened, with fresh owned profiles; never a desktop Host or shop service.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

const directory=resolve('artifacts/sidebar-session-visual');
await mkdir(directory,{recursive:true});
const bundle=await build({entryPoints:[resolve('test/browser/sidebar-session-visual-fixture.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic'});
const html=join(directory,'fixture.html');
await writeFile(html,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`);

async function capture(width,screen='session'){
  const name=`${screen}-${width}`,screenshot=join(directory,`${name}.png`);
  const url=pathToFileURL(html);url.searchParams.set('screen',screen);url.searchParams.set('width',String(width));
  const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
    '--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',
    `--user-data-dir=${join(directory,`browser-profile-${process.pid}-${name}`)}`,'--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    `--window-size=${Math.max(500,width)},1100`,'--force-device-scale-factor=1','about:blank',
  ],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let diagnostic='',socket;const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  child.stdout.resume();child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-5000);});
  const timer=setTimeout(()=>child.kill(),30000);
  try{
    for(let n=0;n<100&&!/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/.test(diagnostic);n++)await pause(50);
    const endpoint=diagnostic.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/)?.[1];
    if(!endpoint)throw Error(`Owned fixture browser did not start: ${diagnostic}`);
    socket=new WebSocket(endpoint);await new Promise((yes,no)=>{socket.addEventListener('open',yes,{once:true});socket.addEventListener('error',no,{once:true});});
    let sequence=0;const pending=new Map();
    socket.addEventListener('message',event=>{const value=JSON.parse(String(event.data));if(!value.id)return;const promise=pending.get(value.id);if(!promise)return;pending.delete(value.id);clearTimeout(promise.timeout);value.error?promise.reject(Error(JSON.stringify(value.error))):promise.resolve(value.result);});
    socket.addEventListener('close',()=>{for(const [id,promise]of pending){clearTimeout(promise.timeout);promise.reject(Error('Owned fixture browser connection closed'));pending.delete(id);}});
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(()=>{pending.delete(id);reject(Error(`Owned browser command timed out: ${method}`));},10000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
    const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const page=(method,params={})=>send(method,params,sessionId);
    await page('Page.enable');await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
    await page('Page.navigate',{url:url.href});
    let value;
    for(let n=0;n<150;n++){
      const response=await page('Runtime.evaluate',{expression:"document.getElementById('sidebar-session-result')?.textContent",returnByValue:true});
      value=response.result?.value;if(value)break;await pause(50);
    }
    if(!value)throw Error(`Fixture result unavailable (${name}): ${diagnostic}`);
    const result=JSON.parse(value),{data}=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(screenshot,Buffer.from(data,'base64'));
    const response=await page('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true}),output=response.result.value;
    await writeFile(join(directory,`dom-${name}.html`),output);
    await send('Browser.close');
    for(let n=0;n<30&&child.exitCode===null;n++)await pause(50);
    return {...result,screenshot};
  }finally{clearTimeout(timer);socket?.close();if(child.exitCode===null&&!child.killed)child.kill();}
}

const results=[];
for(const width of [800,360])for(const screen of ['session','favorites','waiting'])results.push(await capture(width,screen));
await writeFile(join(directory,'results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({requests,checks,...result})=>({...result,checks:checks.length,requestCount:requests.length})),null,2));
if(results.some(result=>!result.ok))process.exitCode=1;
