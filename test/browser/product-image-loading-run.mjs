// Authentic captured source products and pixels, delivered by a delayed local transport.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync} from 'node:fs';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {realCorpus} from '../real-data/corpus.ts';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,relative,resolve} from 'node:path';
import {spawn} from 'node:child_process';

const directory=resolve('artifacts/performance/ui/product-image-browser');
await mkdir(directory,{recursive:true});
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'An installed Chrome or Edge is required; this runner installs nothing.');
const corpus=realCorpus(),assetRoot=resolve('artifacts/real-source-tests-20261013');
const imageManifest=JSON.parse(await readFile(join(assetRoot,'image-assets.json'),'utf8'));
const recordedProducts=corpus.records.map(row=>row.detail);
const images=new Map();
for(const [group,offset] of [['first',0],['second',20]])for(let index=0;index<20;index++){
  const product=recordedProducts[offset+index],asset=imageManifest.assets.find(row=>row.productId===product.id&&row.status==='captured');
  assert.ok(asset,`Authentic source image unavailable for ${product.id}; recapture instead of substituting pixels`);
  const bytes=await readFile(join(assetRoot,asset.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Recorded source image bytes must match capture hash');
  images.set(`/image/${group}-${index+1}.img`,{bytes,mimeType:asset.mimeType,sourceUrl:asset.url,sha256:asset.sha256});
}
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ViewRenderer} from './packages/dsh-plugin/client/renderer.tsx';
import {STYLES} from './packages/dsh-plugin/client/styles.ts';
import {REAL_SOURCE_DETAILS} from './test/real-data/browser-data.ts';
const fields={'product.id':'id','product.name':'title','product.image':'image'};
const bindings=['first','second'].map(id=>({id,fieldMap:fields}));
const widgets=bindings.map(({id},index)=>({id,title:index?'隐藏商品表格':'首屏商品列表',type:index?'table':'product_list',bindingId:id,fields,columns:[{field:'product.image',label:'图片'},{field:'product.name',label:'商品名称'}],options:{pageSize:20,rowsPath:'products',fieldMeta:{'product.image':{format:'image',label:'图片'}}}}));
const data=bindings.map(({id},group)=>({bindingId:id,datasetKey:id,state:'ready',provenance:{source:'real_source_corpus',projection:'original image pixels served at an explicitly delayed local URL'},payload:{products:REAL_SOURCE_DETAILS.slice(group*20,group*20+20).map((product,index)=>({...structuredClone(product),image:location.origin+'/image/'+id+'-'+(index+1)+'.img'}))}}));
const spec={id:'image-loading-fixture',title:'图片加载隔离验证',layout:{type:'tabs',children:['first','second']},widgets,bindings};
createRoot(document.getElementById('root')).render(<><style>{STYLES}</style><ViewRenderer spec={spec} data={data}/></>);
`},bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const javascript=bundle.outputFiles[0].text;
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated product image loading</title><style>body{margin:0;padding:16px;background:#fff;font:14px system-ui}#root{max-width:960px;margin:auto}tbody tr{height:160px}img{width:56px;height:56px;object-fit:contain}</style><div id="root"></div><script src="/fixture.js"></script></html>';
await writeFile(join(directory,'fixture.html'),html);
const serverRequests=[],networkRequests=[],priorityChanges=[],browserErrors=[];
const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://fixture').pathname;
  const headers={'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'none'"};
  if(path==='/'){response.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});response.end(html);return;}
  if(path==='/fixture.js'){response.writeHead(200,{...headers,'Content-Type':'text/javascript; charset=utf-8'});response.end(javascript);return;}
  if(images.has(path)){
    const entry={path,receivedAt:Date.now()};serverRequests.push(entry);
    const image=images.get(path);
    setTimeout(()=>{response.writeHead(200,{...headers,'Content-Type':image.mimeType});response.end(image.bytes);entry.completedAt=Date.now();},150);
    return;
  }
  response.writeHead(404,headers);response.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(join(tmpdir(),'apps-image-browser-'));
const browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let diagnostics='',socket,sequence=0;
const pending=new Map(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
browser.stderr.on('data',chunk=>{diagnostics=(diagnostics+chunk).slice(-6000);});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out: ${method}`));},10000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
});
let page;
const evaluate=async expression=>{const result=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
const snapshot=()=>evaluate(`Array.from(document.querySelectorAll('[role="tabpanel"]')).map(panel=>({hidden:panel.hidden,images:Array.from(panel.querySelectorAll('img')).map(img=>({path:new URL(img.src).pathname,loading:img.loading,priority:img.fetchPriority,decoding:img.decoding,complete:img.complete&&img.naturalWidth>0}))}))`);
const verifyAttributes=(panels,active)=>{
  assert.equal(panels.length,2);
  panels.forEach((panel,panelIndex)=>{assert.equal(panel.hidden,panelIndex!==active);assert.equal(panel.images.length,20);panel.images.forEach((image,index)=>{const priority=panelIndex===active&&index<6;assert.equal(image.loading,priority?'eager':'lazy');assert.equal(image.priority,priority?'high':'auto');assert.equal(image.decoding,'async');});});
};
const waitFor=async(expression,message)=>{for(let attempt=0;attempt<150;attempt++){if(await evaluate(expression))return;await pause(50);}throw Error(message);};
let result;
try{
  for(let attempt=0;attempt<100&&!/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/.test(diagnostics);attempt++)await pause(50);
  const endpoint=diagnostics.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/)?.[1];
  assert.ok(endpoint,`Fresh browser did not start: ${diagnostics}`);
  socket=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.id){const request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);return;}
    if(message.method==='Network.requestWillBeSent'&&message.params.request.url.startsWith(origin+'/image/'))networkRequests.push({path:new URL(message.params.request.url).pathname,requestId:message.params.requestId,timestamp:message.params.timestamp,initialPriority:message.params.request.initialPriority});
    if(message.method==='Network.resourceChangedPriority')priorityChanges.push(message.params);
    if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')browserErrors.push(message.params.args.map(value=>value.value??value.description));
  });
  socket.addEventListener('close',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Fresh browser disconnected'));}pending.clear();});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  page=(method,params={})=>send(method,params,sessionId);
  const version=await send('Browser.getVersion');
  await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Network.setCacheDisabled',{cacheDisabled:true});
  await page('Emulation.setDeviceMetricsOverride',{width:1040,height:800,deviceScaleFactor:1,mobile:false});
  await page('Page.navigate',{url:origin+'/'});
  await waitFor(`document.querySelectorAll('[role="tabpanel"] img').length===40`,'Expected 20 images in each production component');
  await waitFor(`Array.from(document.querySelector('[role="tabpanel"]:not([hidden])').querySelectorAll('img')).slice(0,6).every(img=>img.complete&&img.naturalWidth>0)`,'Initial priority images did not finish');
  await pause(400);
  const initial=await snapshot();verifyAttributes(initial,0);
  assert.equal(serverRequests.filter(request=>request.path.startsWith('/image/second-')).length,0,'A hidden tab must make no image requests');
  const initialRequests=serverRequests.map(request=>({...request}));
  const switchedAt=Date.now();
  await evaluate(`document.querySelectorAll('[role="tab"]')[1].click()`);
  await waitFor(`document.querySelectorAll('[role="tabpanel"]')[1].hidden===false&&Array.from(document.querySelectorAll('[role="tabpanel"]')[1].querySelectorAll('img')).slice(0,6).every(img=>img.complete&&img.naturalWidth>0)`,'Newly visible priority images did not finish');
  await pause(200);
  const switched=await snapshot();verifyAttributes(switched,1);
  for(const group of ['first','second'])for(let index=1;index<=6;index++){
    const path=`/image/${group}-${index}.img`,request=networkRequests.find(request=>request.path===path);
    assert.ok(request,`Missing real image request: ${path}`);
    assert.equal(request.initialPriority,'High',`Chrome must start ${path} at High priority`);
  }
  const newlyVisible=serverRequests.filter(request=>request.path.startsWith('/image/second-'));
  assert.ok(newlyVisible.length>=6);assert.ok(newlyVisible.every(request=>request.receivedAt>=switchedAt));
  assert.deepEqual(browserErrors,[]);
  result={status:'PASS',scope:'PRODUCTION_VIEW_RENDERER_IN_FRESH_CHROMIUM_WITH_CAPTURED_REAL_SOURCE_IMAGES',actualDesktop:false,browser:version.product,sourceImages:[...images].map(([localPath,image])=>({localPath,sourceUrl:image.sourceUrl,sha256:image.sha256,mimeType:image.mimeType})),viewport:{width:1040,height:800},rowsPerTab:20,priorityImagesPerVisibleTab:6,initialHiddenImageRequests:0,initialImageRequests:initialRequests.length,afterSwitchImageRequests:newlyVisible.length,switchedAt,initial,switched,serverRequests,networkRequests,priorityChanges,browserErrors};
  console.log(JSON.stringify({status:result.status,browser:result.browser,initialImageRequests:result.initialImageRequests,initialHiddenImageRequests:0,afterSwitchImageRequests:result.afterSwitchImageRequests,firstSixInitialNetworkPriority:'High',evidence:join(directory,'results.json')}));
}catch(error){result={status:'FAIL',scope:'ISOLATED_PRODUCT_IMAGE_LOADING',message:String(error),serverRequests,networkRequests,priorityChanges,browserErrors,diagnostics};throw error;}
finally{
  if(result)await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(browser.exitCode===null){await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),pause(3000)]);if(browser.exitCode===null)browser.kill();}
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const absolute=resolve(profile),within=relative(resolve(tmpdir()),absolute);
  assert.ok(within&&!within.startsWith('..')&&resolve(tmpdir(),within)===absolute&&/^apps-image-browser-[^\\/]+$/.test(absolute.split(/[\\/]/).at(-1)));
  await rm(absolute,{recursive:true,force:true,maxRetries:3,retryDelay:200});
}
