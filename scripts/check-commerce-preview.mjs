import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const out=resolve('artifacts/commerce-templates'),html=readFileSync(join(out,'index.html'));
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile=join(process.env.TEMP,`commerce-preview-${randomUUID()}`);mkdirSync(profile);
const child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let socket;const errors=[],checks=[];
try{
 let debug;for(let i=0;i<100;i++){try{debug=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];break;}catch{await pause(100);}}assert.ok(debug,'browser start');
 const tabs=await fetch(`http://127.0.0.1:${debug}/json/list`).then(r=>r.json());socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(m.error):resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await pause(70);};
 await command('Runtime.enable');await command('Page.enable');await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
 for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".workbench")'))break;await pause(50);}
 for(const id of ['products','collection','profit','traffic','pricing','campaigns','review']){
  await click(`[data-template="${id}"]`);assert.ok(await evaluate('document.querySelector("h1").textContent.length>0'));
  await click('[aria-label="搜索商品"]');await command('Input.insertText',{text:'SKU-10320'});await pause(60);assert.equal(await evaluate('document.querySelectorAll("tbody tr,.product-card").length'),1);
  await click(id==='collection'?'.product-card':'.product-cell');assert.ok(await evaluate('!!document.querySelector("[role=dialog]")'));await click('.close');await click('[aria-label="搜索商品"]');assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'搜索商品');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',windowsVirtualKeyCode:8});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',windowsVirtualKeyCode:8});await pause(60);
  assert.equal(await evaluate('document.querySelectorAll("tbody tr,.product-card").length'),8);await click('[aria-label="下一页"]');assert.equal(await evaluate('document.querySelector(".pagination>div>span").textContent'),'2 / 3');
  if(id==='campaigns'){await click('tbody input[type=checkbox]');assert.ok(await evaluate('document.querySelector(".pagination").textContent.includes("已选 1 件")'));}
  await click('[aria-label="上一页"]');await evaluate('scrollTo(0,0)');const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(out,`${id}-wide.png`),Buffer.from(shot.data,'base64'));checks.push(`${id}: search, detail, focus, pagination PASS`);
 }
 await command('Emulation.setDeviceMetricsOverride',{width:420,height:900,deviceScaleFactor:1,mobile:false});
 for(const id of ['products','collection','profit','traffic','pricing','campaigns','review']){await click(`[data-template="${id}"]`);await evaluate('scrollTo(0,0)');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),id+' horizontal overflow');await click('[aria-label="搜索商品"]');assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'搜索商品');await evaluate('document.activeElement.blur();scrollTo(0,0)');const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(out,`${id}-narrow.png`),Buffer.from(shot.data,'base64'));checks.push(`${id}: narrow width and input PASS`);}
 assert.deepEqual(errors,[]);writeFileSync(join(out,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}finally{socket?.close();child.kill();server.close();}
