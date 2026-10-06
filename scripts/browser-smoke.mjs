// Own isolated fixture browser. Never attaches to the user's DSH/browser or business data.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const directory=resolve('test/browser/artifacts');await mkdir(directory,{recursive:true});
const built=await build({entryPoints:[resolve('test/browser/fixture.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic'});
const html=join(directory,'fixture.html');
const hostStyle=':root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f4f5f6;--dsw-alias-label-primary:#0f1115;--dsw-alias-label-secondary:#61666b;--dsw-alias-border-l1:#0000000a;--dsw-alias-border-l2:#0000001a;--dsw-alias-brand-primary:#0f1115}body{margin:0;font:14px "Segoe UI","Microsoft YaHei UI",sans-serif;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}';
await writeFile(html,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Hallmark isolated fixture test</title><style>${hostStyle}</style><div id="root"></div><script>${built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`);
const portServer=createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
const child=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,`--user-data-dir=${join(directory,`browser-profile-${port}`)}`,'--window-size=1672,940','about:blank'],{stdio:['ignore','ignore','pipe']});
let diagnostics='';child.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-8000);});
let socket,result;const pending=new Map();let sequence=0;
const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Owned fixture timeout: ${method}`));},10000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});socket.send(JSON.stringify({id,method,params}));});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const evaluate=async(expression)=>{const response=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.text+': '+response.exceptionDetails.exception?.description);return response.result?.value;};
const screenshot=async(name)=>{const image=await command('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,name),Buffer.from(image.data,'base64'));};
function setHostTheme(dark){
  document.body.toggleAttribute('data-ds-dark-theme',dark);
  const tokens=dark?{'bg-base':'#151517','bg-layer-1':'#232324','bg-layer-2':'#303033','label-primary':'#f9fafb','label-secondary':'#cfd3d6','border-l1':'#ffffff0a','border-l2':'#ffffff1f','brand-primary':'#f9fafb'}:{'bg-base':'#fff','bg-layer-1':'#fff','bg-layer-2':'#f4f5f6','label-primary':'#0f1115','label-secondary':'#61666b','border-l1':'#0000000a','border-l2':'#0000001a','brand-primary':'#0f1115'};
  for(const [key,value] of Object.entries(tokens))document.documentElement.style.setProperty('--dsw-alias-'+key,value);
}
const theme=async(dark)=>{await evaluate(`(${setHostTheme.toString()})(${dark})`);await pause(160);};
const check=(condition,label)=>{if(!condition)throw new Error(label);result.assertions.push(label);};
try{
  let pages;for(let attempt=0;attempt<100;attempt++){try{pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());if(pages.length)break;}catch{}await pause(100);}
  if(!pages?.length)throw new Error('Owned fixture browser did not launch');
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(message.error.message)):request.resolve(message.result);}});
  socket.addEventListener('close',()=>{for(const request of pending.values())request.reject(new Error('Owned fixture browser closed'));pending.clear();});
  await command('Page.enable');await command('Runtime.enable');await command('Emulation.setDeviceMetricsOverride',{width:1672,height:940,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url:pathToFileURL(html).href});
  for(let attempt=0;attempt<200;attempt++){result=await evaluate('window.__UI_SMOKE_RESULT__');if(result)break;await pause(100);}
  if(!result)throw new Error('Fixture UI test did not complete');
  await screenshot('workbench-light.png');
  if(result.ok){
    await evaluate('window.__UI_SHOW_OVERVIEW__()');await evaluate('window.__UI_SET_OVERVIEW__(true)');await pause(150);
    await screenshot('workbench-overview-populated.png');await screenshot('workbench-overview-light.png');
    await evaluate('window.__UI_SET_FIRST_VISIT__(true)');
    await command('Emulation.setDeviceMetricsOverride',{width:1672,height:1120,deviceScaleFactor:1,mobile:false});await pause(150);
    const firstVisit=await evaluate('(()=>{const welcome=document.querySelector(".hm-component-welcome");return {connected:document.querySelector(".hm-connection-state")?.dataset.status==="connected",emptyComponents:!!welcome&&!document.querySelector(".hm-recent-section")&&!document.querySelector(".hm-tab-count"),actions:[...welcome.querySelectorAll("button")].map(button=>button.textContent.trim()),templateCount:document.querySelectorAll(".hm-template-section .hm-template").length};})()');
    check(firstVisit.connected&&firstVisit.emptyComponents&&firstVisit.actions.includes('在聊天中创建')&&firstVisit.actions.some(text=>text.includes('自己设计'))&&firstVisit.templateCount>0,'first visit shows connected overview, real empty-component guidance and usable template cards');
    await screenshot('workbench-first-visit.png');
    await evaluate('window.__UI_SET_FIRST_VISIT__(false)');
    await command('Emulation.setDeviceMetricsOverride',{width:1672,height:940,deviceScaleFactor:1,mobile:false});await pause(150);
    await evaluate('window.__UI_SHOW_LIBRARY__()');await pause(120);
    const libraryActions=await evaluate('[...document.querySelectorAll(".hm-library-content .hm-entry-row .hm-actions")].map(group=>{const bounds=group.getBoundingClientRect();return {width:bounds.width,buttons:[...group.querySelectorAll("button")].map(button=>{const rect=button.getBoundingClientRect();return {width:rect.width,top:rect.top};})};})');
    check(libraryActions.length>0&&libraryActions.every(group=>group.buttons.length>1&&group.buttons.every(button=>button.width<group.width*.6&&Math.abs(button.top-group.buttons[0].top)<2)),'desktop component-library actions stay compact on one row instead of expanding to full width');
    await screenshot('component-library-light.png');await evaluate('window.__UI_SHOW_OVERVIEW__()');
    await evaluate('window.__UI_SET_OVERVIEW__(false)');await pause(150);
    const empty=await evaluate('[...document.querySelectorAll(".hm-metric-value")].filter(x=>!x.closest("[hidden]")).map(x=>x.textContent)');check(empty.join(',')==='—,—,—','unavailable overview renders three unknown values instead of invented zeros');
    await screenshot('workbench-overview-empty.png');
    await evaluate('window.__UI_SET_OVERVIEW__(true)');await theme(true);
    const dark=await evaluate('(()=>{const primary=getComputedStyle(document.querySelector(".hm-header-actions .hm-action-primary")),secondary=getComputedStyle(document.querySelector(".hm-header-actions .hm-action-secondary")),muted=getComputedStyle(document.querySelector(".hm-metric-label"));return {bodyDark:document.body.hasAttribute("data-ds-dark-theme"),primary:primary.backgroundColor,foreground:primary.color,secondary:secondary.backgroundColor,muted:muted.color};})()');
    check(dark.bodyDark&&dark.primary==='rgb(122, 170, 255)'&&dark.foreground==='rgb(16, 31, 56)','real DSH body dark-theme selector keeps blue primary with readable foreground');
    check(dark.secondary==='rgb(35, 35, 36)'&&dark.muted==='rgb(207, 211, 214)','dark secondary surface and muted text match actual DSH tokens');result.darkComputedStyles=dark;
    await screenshot('workbench-dark.png');
    await theme(false);await command('Emulation.setDeviceMetricsOverride',{width:429,height:900,deviceScaleFactor:1,mobile:true});await pause(160);
    check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'mobile workbench has no document-level horizontal overflow');
    await screenshot('workbench-mobile.png');
    await evaluate('window.__UI_SHOW_CATALOG__()');await pause(120);await screenshot('application-list-mobile.png');
    await command('Emulation.setDeviceMetricsOverride',{width:1672,height:940,deviceScaleFactor:1,mobile:false});await pause(120);await screenshot('application-list-light.png');
    await evaluate('window.__UI_SHOW_COMPONENT_TABS__()');await pause(150);await screenshot('workspace-tabs-light.png');
    await evaluate('window.__UI_SHOW_CHAT_SIDEBAR__()');await pause(200);await screenshot('chat-sidebar-light.png');
  }
  await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}catch(error){
  const failure={...result,ok:false,fixtureOnly:true,message:String(error)};await writeFile(join(directory,'results.json'),JSON.stringify(failure,null,2));await writeFile(join(directory,'browser-error.txt'),`${String(error)}\n${diagnostics}`);throw error;
}finally{
  if(socket?.readyState===WebSocket.OPEN){try{await command('Browser.close');}catch{}socket.close();}
  if(child.exitCode===null){await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(3000)]);if(child.exitCode===null)child.kill();}
}
