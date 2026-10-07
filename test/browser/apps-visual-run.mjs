// Own isolated Chrome profile only. Does not attach to or automate the user's DSH/desktop/browser.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const directory=resolve('test/browser/apps-visual-artifacts');await mkdir(directory,{recursive:true});
const built=await build({entryPoints:[resolve('test/browser/apps-visual-fixture.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic'});
const html=join(directory,'apps-visual-fixture.html');
await writeFile(html,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apps production surfaces — isolated visual fixture</title><style>html,body,#root{margin:0;width:100%;height:100%;font-family:"Segoe UI","Microsoft YaHei UI",sans-serif}*{box-sizing:border-box}body{background:#fff}.fixture-disclosure{height:30px;font-size:11px;line-height:30px;text-align:center;background:#f2f5f9;color:#7b8799;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px}#fixture-content{height:calc(100% - 30px);min-height:0;min-width:0}.is-sidebar{border-right:1px solid #e6ecf5}body[data-ds-dark-theme]{background:#19212e}body[data-ds-dark-theme] .fixture-disclosure{background:#233047;color:#afbdd1}</style><div id="root"></div><script>${built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`);
const portServer=createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${join(directory,'browser-profile-'+port)}`,'--window-size=1440,1000','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let diagnostics='',socket,sequence=0;const pending=new Map();child.stderr.on('data',chunk=>diagnostics=(diagnostics+chunk).slice(-4000));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
const screenshot=async(name,clip)=>{const result=await command('Page.captureScreenshot',{format:'png',...(clip?{clip}:{})});await writeFile(join(directory,name),Buffer.from(result.data,'base64'));};
try{
  let pages;for(let i=0;i<100;i++){try{pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());if(pages.length)break;}catch{}await pause(100);}if(!pages?.length)throw Error('Owned fixture Chrome unavailable');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const value=JSON.parse(event.data),request=pending.get(value.id);if(request){pending.delete(value.id);value.error?request.reject(Error(value.error.message)):request.resolve(value.result);}});
  await command('Page.enable');await command('Runtime.enable');await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url:pathToFileURL(html).href});
  for(let i=0;i<100;i++){if(await evaluate('Boolean(window.__APPS_VISUAL__)'))break;await pause(50);}
  await evaluate('window.__APPS_VISUAL__.initial()');await screenshot('apps-library-light.png');
  await evaluate('window.__APPS_VISUAL__.interactions()');await screenshot('apps-library-after-actions.png');
  await evaluate('window.__APPS_VISUAL__.states("empty")');await screenshot('apps-library-empty.png');await evaluate('window.__APPS_VISUAL__.states("failed")');await screenshot('apps-library-failed.png');await evaluate('window.__APPS_VISUAL__.states("stopped")');await screenshot('apps-provider-unavailable.png');await evaluate('window.__APPS_VISUAL__.states("ready")');
  await evaluate('document.body.setAttribute("data-ds-dark-theme","")');await pause(100);await screenshot('apps-library-dark.png');await evaluate('document.body.removeAttribute("data-ds-dark-theme")');
  const side=[];for(const width of [420,350,280]){side.push(await evaluate(`window.__APPS_VISUAL__.sidebar(${width})`));await screenshot(`apps-sidebar-${width}.png`,{x:0,y:0,width,height:1000,scale:1});}
  await evaluate('document.body.setAttribute("data-ds-dark-theme","")');await screenshot('apps-sidebar-280-dark.png',{x:0,y:0,width:280,height:1000,scale:1});await evaluate('document.body.removeAttribute("data-ds-dark-theme")');
  await command('Emulation.setDeviceMetricsOverride',{width:380,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('window.__APPS_VISUAL__.apps()');await screenshot('apps-library-380.png');const narrow=await evaluate('({documentOverflow:document.documentElement.scrollWidth>innerWidth,workspaceOverflow:document.querySelector(".apps-directory").scrollWidth>document.querySelector(".apps-directory").clientWidth})');if(narrow.documentOverflow||narrow.workspaceOverflow)throw Error('Narrow workbench overflow '+JSON.stringify(narrow));
  const result=await evaluate('window.__APPS_VISUAL__.result()');result.side=side;result.narrow=narrow;await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await writeFile(join(directory,'browser-error.txt'),String(error)+'\n'+diagnostics);throw error;}
finally{if(socket?.readyState===WebSocket.OPEN){try{await command('Browser.close');}catch{}socket.close();}if(child.exitCode===null){await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(3000)]);if(child.exitCode===null)child.kill();}}
