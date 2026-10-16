// Own isolated Chrome profile and synthetic in-memory host. No DSH/data access.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer as createPortServer} from 'node:net';
import {createServer} from 'node:http';

const directory=resolve('../output/component-agent-chain-20261011/sdk-browser');await mkdir(directory,{recursive:true});
const built=await build({entryPoints:[resolve('test/browser/sdk-agent-chain-fixture.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic'});
const styles='html,body{margin:0;color:#192333;background:#f5f7fb;font:16px/1.55 Segoe UI,Microsoft YaHei UI,sans-serif}main{margin:24px;padding:22px;background:white;border:1px solid #d9dfe9;border-radius:12px}h1,h2{margin:0 0 8px}#scenario{margin:20px 24px;font-weight:600}iframe{display:block;background:white;width:calc(100% - 48px);height:590px;margin:0 24px;border:1px solid #bcc8dc;border-radius:12px}li{padding:6px}section{border-top:1px solid #ddd;padding-top:10px}button,input{font:inherit;padding:8px;margin:6px 8px 6px 0}input{width:360px}button:disabled{opacity:.55}#read-state{font-weight:600;color:#246c50}';
const html=`<!doctype html><html><meta charset="utf-8"><style>${styles}</style><div id="root"></div><script>${built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`;
const parentHtml=html.replace('<div id="root"></div>','<h1 style="margin:20px 24px">Component SDK · isolated browser verification</h1><p id="scenario"></p><div id="frames"></div>');
await writeFile(join(directory,'fixture.html'),html);await writeFile(join(directory,'host.html'),parentHtml);
const server=createServer((request,response)=>{const path=new URL(request.url,'http://fixture.local').pathname;if(!['/','/child'].includes(path)){response.writeHead(404);response.end();return;}response.setHeader('Content-Type','text/html; charset=utf-8');response.end(path==='/child'?html:parentHtml);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const pagePort=server.address().port,portServer=createPortServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${join(directory,`browser-profile-${port}`)}`,'--window-size=1200,850','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket,sequence=0,diagnostics='';const pending=new Map(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),screenshots=[];child.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-6000);});
const command=(method,params={},timeout=10000)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method}`));},timeout);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression,timeout)=>{const answer=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},timeout);if(answer.exceptionDetails)throw Error(answer.exceptionDetails.exception?.description??answer.exceptionDetails.text);return answer.result?.value;};
try{
 let pages;for(let i=0;i<100;i++){try{pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());if(pages.length)break;}catch{}await pause(100);}if(!pages?.length)throw Error('Isolated browser unavailable');
 socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);}});
 socket.addEventListener('close',()=>{for(const request of pending.values())request.reject(Error('Isolated browser disconnected'));pending.clear();});
 await command('Page.enable');await command('Runtime.enable');await command('Emulation.setDeviceMetricsOverride',{width:1200,height:850,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url:`http://127.0.0.1:${pagePort}/`});
 for(let i=0;i<100;i++){if(await evaluate('Boolean(window.__SDK_BROWSER__)'))break;await pause(100);}
 const scenarios={};for(const name of ['initialEvent','initialRefresh','bindingPages','rejectedAction','unknownTimeout']){
  scenarios[name]=await evaluate(`window.__SDK_BROWSER__.${name}()`,name==='unknownTimeout'?40000:10000);
  const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const path=join(directory,`${name}.png`);await writeFile(path,Buffer.from(screenshot.data,'base64'));screenshots.push(path);console.log(`${name}: passed`);
 }
 const result=await evaluate('window.__SDK_BROWSER__.result()');if(result.errors.length||result.frameErrors.length)throw Error(`Unexpected browser errors: ${JSON.stringify(result)}`);
 const version=await command('Browser.getVersion');Object.assign(result,{scenarios,screenshots,browser:version,scope:'Isolated real Chrome and synthetic data; no business state accessed'});await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({assertions:result.assertions.length,screenshots:screenshots.length,errors:result.errors,frameErrors:result.frameErrors}));
}catch(error){let state;try{state=await evaluate('({text:document.body.innerText,result:window.__SDK_BROWSER__?.result()})');}catch{}await writeFile(join(directory,'error.txt'),`${String(error)}\n${JSON.stringify(state)}\n${diagnostics}`);throw error;}
finally{if(socket?.readyState===WebSocket.OPEN){try{await command('Browser.close');}catch{}socket.close();}if(child.exitCode===null){await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(3000)]);if(child.exitCode===null)child.kill();}await new Promise(resolve=>server.close(resolve));}
