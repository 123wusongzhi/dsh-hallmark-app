import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdirSync,writeFileSync,readFileSync,rmSync,mkdtempSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import {createFixture,session,openInput,assertion,environment,sleep} from './fixture.ts';
import {AppsHost,HttpAppsHostTransport} from '../../../packages/plugin-apps/src/index.ts';

// Same fresh-profile Chromium/CDP isolation pattern as test/browser/product-image-loading-run.mjs.
const out=resolve('artifacts/component-display-reliability'),chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Installed Chromium required; no downloads or real DSH session is used.');mkdirSync(out,{recursive:true});
const started=performance.now(),f=await createFixture(),trace=[],results=[],browserErrors=[],externalRequests=[],forbidden=[];
let active,origin,host,proxy,web,socket,browser,profile,page,diagnostics='',sequence=0;
const pending=new Map();
const report={status:'FAIL',scope:'REAL_IFRAME_SDK_PRODUCTION_PARENT_HOST_RUNTIME_OFFLINE_REPLAY',actualDesktop:false,actualShop:false,realShopWrites:false,environment:environment(),previewAdmission:'Backend-control fixture receipt only; runtime displayed evidence comes exclusively from production iframe useApps/renderReady after DOM assertions',pending:['W6 true async preparation/progress and long preparation visibility','W7 actual runtime process death/launch/backoff/reopen after restart','Actual database-lock contention (this runner injects a SQLite-coded exception at the store boundary)'],results};
const listen=server=>new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>done(`http://127.0.0.1:${server.address().port}`));});
const send=(method,params={},sessionId)=>new Promise((done,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15_000);pending.set(id,{done,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const evaluate=async expression=>{const result=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
async function wait(check,label,ms=15_000){const until=performance.now()+ms;while(performance.now()<until){const value=await check();if(value)return value;await sleep(40);}throw Error('Timed out: '+label);}
const closeServer=async server=>{if(!server)return;server.closeAllConnections();await new Promise(done=>server.close(done));};
try{
  report.load=f.seedBytes();
  const parent=await build({entryPoints:[resolve('test/acceptance/component-display/browser-parent.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const nativeParent=await build({entryPoints:[resolve('test/acceptance/component-display/browser-native-parent.tsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const expected=f.originals.map(row=>({id:row.detail.id,title:row.detail.title}));
  const child=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useApps} from './packages/component-runtime/src/apps-react.tsx';
const expected=${JSON.stringify(expected)};
function Component(){const apps=useApps({assertionResults:()=>{const rows=[...document.querySelectorAll('[data-product-id]')];const passed=rows.length===expected.length&&rows.every((row,index)=>row.getAttribute('data-product-id')===expected[index].id&&row.textContent===expected[index].title);window.__domAssertion={passed,rows:rows.length};return [{...${JSON.stringify(assertion())},status:passed?'PASS':'FAIL',actual:passed?${JSON.stringify(assertion().actual)}:'DOM differs'}];}});const rows=apps.data?.bindings?.[0]?.payload?.items??[];return <main><p data-phase>{apps.error?'failed':apps.loading?'loading':'loaded'}</p>{apps.error?<pre role="alert">{apps.error.message}</pre>:null}<ol>{rows.map(row=><li key={row.id} data-product-id={row.id}>{row.title}</li>)}</ol></main>;}
createRoot(document.getElementById('root')).render(<Component/>);
`},bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const javascript=child.outputFiles[0].text;
  // Inject an exception at the real RuntimeStore lookup boundary, not a fabricated success packet.
  const get=f.store.get.bind(f.store);let busyRemaining=0;
  f.store.get=(collection,id)=>{if(busyRemaining&&collection==='provider_records'&&id.includes('frame_grants')){busyRemaining--;throw Object.assign(new Error('database is locked (controlled store-boundary injection)'),{code:'SQLITE_BUSY'});}return get(collection,id);};
  proxy=createServer(async(req,res)=>{
    let text='';for await(const part of req)text+=part;const packet=text?JSON.parse(text):null;
    const row={case:active?.name,path:req.url,requestId:packet?.requestId,feature:packet?.feature,action:packet?.action,index:packet?.params?.index,startedMs:performance.now()};trace.push(row);
    const chunk=req.url==='/v1/component-extension'&&packet?.feature==='dataTransferV1'&&packet?.action==='read',prepare=req.url==='/v1/component-extension'&&packet?.feature==='dataTransferV1'&&packet?.action==='prepare'&&packet?.params?.method==='getData';
    if(chunk){active.inFlight++;active.peak=Math.max(active.peak,active.inFlight);}
    try{
      if(active?.name==='transient-503'&&chunk&&packet.params.index===0&&active.injected<3){active.injected++;row.injected='503';res.writeHead(503,{'content-type':'application/json','x-request-id':'controlled-503-'+active.injected});res.end(JSON.stringify({status:'failed',error:{code:'RUNTIME_INTERNAL_ERROR',message:'Controlled transient upstream status',retryPolicy:'read_retry',details:{cause:'controlled transient 503',requestId:'controlled-503-'+active.injected}}}));return;}
      if(active?.name==='terminal-never'&&prepare){active.injected++;row.injected='never';res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({status:'failed',error:{code:'INVALID_BINDING',message:'Controlled deterministic binding rejection',retryPolicy:'never',details:{cause:'controlled invalid binding',requestId:'controlled-never'}}}));return;}
      const response=await fetch(f.url+req.url,{method:req.method,headers:{authorization:'Bearer '+f.token,'content-type':'application/json'},...(text?{body:text}:{})}),value=await response.json();row.backendStatus=response.status;row.backendError=value.error;
      if(active?.name==='sqlite-busy'&&req.url==='/v1/authoring/authorizeDisplayFrame'&&response.ok)busyRemaining=2;
      if(chunk)await sleep(20); // Deterministic overlap makes the SDK's four-request fan-out observable.
      if(active?.name==='response-lost'&&chunk&&packet.params.index===0&&active.injected===0){active.injected++;row.injected='response-lost-after-runtime-200';assert.equal(response.status,200);req.socket.destroy();return;}
      res.writeHead(response.status,{'content-type':'application/json'});res.end(JSON.stringify(value));
    }catch(error){row.proxyError=String(error);if(!res.destroyed){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'ACCEPTANCE_PROXY_FAILED',message:String(error),retryPolicy:'never'}}));}}
    finally{row.endedMs=performance.now();if(chunk)active.inFlight--;}
  });
  const proxyURL=await listen(proxy),tools=new Map();
  host=new AppsHost({agents:{get:id=>id===session?{id}:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(proxyURL,f.token));await host.start();
  const csp="default-src 'none'; script-src 'self'; frame-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'";
  web=createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://fixture').pathname,headers={'content-security-policy':csp,'cache-control':'no-store'};
      if(path==='/'){res.writeHead(200,{...headers,'content-type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/parent.js"></script>');return;}
      if(path==='/parent.js'){res.writeHead(200,{...headers,'content-type':'text/javascript'});res.end((active.native?nativeParent:parent).outputFiles[0].text);return;}
      if(path==='/config'){res.writeHead(200,{...headers,'content-type':'application/json'});res.end(JSON.stringify(active.config));return;}
      if(path.startsWith('/api/hallmark-source/')){const parts=path.slice('/api/hallmark-source/'.length).split('/'),buildId=parts.shift();assert.equal(buildId,active.candidate.publication.candidateBuildId);const asset=f.sources.readFile(buildId,parts.join('/'));assert.ok(asset);active.assetRequests=(active.assetRequests??0)+1;res.writeHead(200,{...headers,'content-type':asset.mime});res.end(asset.bytes);return;}
      if(path.startsWith('/frame/')){assert.ok(['index.html','component.js'].includes(path.slice(7)));const asset=f.sources.readFile(active.candidate.publication.candidateBuildId,path.slice(7));assert.ok(asset);res.writeHead(200,{...headers,'content-type':asset.mime});res.end(asset.bytes);return;}
      if(path==='/api/dsh-apps'){
        let text='';for await(const part of req)text+=part;
        if(req.method==='POST'){const body=JSON.parse(text),allowed=body.action==='componentExtension'||body.action==='componentBridge'&&['getData','getContext'].includes(body.request.method)||body.action==='authoring'&&['authorizeDisplayFrame','reportDisplayError','retireFrame','inspect'].includes(body.operation);if(!allowed){forbidden.push(body);throw Error('Forbidden test action');}}
        const value=await host.ui(new Request(origin+req.url,{method:req.method,headers:{'content-type':'application/json'},...(text?{body:text}:{})}));
        if(active.native&&req.method==='GET'&&new URL(req.url,origin).searchParams.get('resource')==='viewData'){
          const scenario=active;scenario.dataReads++;const packet=await value.json();
          assert.equal(value.status,200);assert.equal(packet.viewId,scenario.config.identity.viewId);
          if(scenario.delayPoll&&scenario.dataReads===2){scenario.pollHeld=true;await new Promise(done=>scenario.releasePoll=done);scenario.pollReleased=true;}
          if(scenario.preparationMode!=='ready'){
            for(const binding of packet.bindings){binding.payload=null;binding.resources=[];binding.revision=null;binding.state=scenario.preparationMode==='failed'?'failed':'preparing';binding.preparation={state:binding.state,phase:'query',startedAt:scenario.preparationStartedAt,elapsedMs:Date.now()-Date.parse(scenario.preparationStartedAt)};if(binding.state==='failed')binding.error={code:'INVALID_BINDING',message:'Controlled preparation rejection',retryPolicy:'never',details:{cause:'controlled parent preparation failure'}};}
          }
          scenario.dataPackets.push({at:performance.now(),state:packet.bindings[0].state,held:scenario.pollHeld===true,released:scenario.pollReleased===true});res.writeHead(value.status,{...headers,'content-type':'application/json'});res.end(JSON.stringify(packet));return;
        }
        res.writeHead(value.status,{...headers,'content-type':'application/json'});res.end(await value.text());return;
      }
      if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
      forbidden.push({path});res.writeHead(404);res.end();
    }catch(error){if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'ACCEPTANCE_SERVER_FAILED',message:String(error)}}));}
  });origin=await listen(web);
  profile=mkdtempSync(join(tmpdir(),'display-reliability-browser-'));
  browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  browser.stderr.on('data',part=>diagnostics=(diagnostics+part).slice(-10_000));
  await wait(()=>diagnostics.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/),'fresh browser CDP');
  socket=new WebSocket(diagnostics.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/)[1]);await new Promise((done,reject)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(message.error.message)):item.done(message.result);return;}if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails);if(message.method==='Network.requestWillBeSent'&&!message.params.request.url.startsWith(origin)&&!message.params.request.url.startsWith('about:'))externalRequests.push(message.params.request.url);});
  socket.addEventListener('close',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Browser disconnected'));}pending.clear();});
  report.browser=await send('Browser.getVersion');const {targetId}=await send('Target.createTarget',{url:'about:blank'}),attached=await send('Target.attachToTarget',{targetId,flatten:true});page=(method,params={})=>send(method,params,attached.sessionId);
  await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Network.setCacheDisabled',{cacheDisabled:true});await page('Emulation.setDeviceMetricsOverride',{width:1040,height:800,deviceScaleFactor:1,mobile:false});
  let previous;
  for(const name of ['response-lost','transient-503','sqlite-busy','terminal-never','hidden-then-visible']){
    // A second publication on the first view proves old ready cannot complete the new build.
    const candidate=await f.prepare(name,{javascript,...(name==='transient-503'?{viewId:previous.publication.viewId}:{})});
    if(name==='transient-503'){
      const inspected=f.authoring.inspect(session,{publicationId:candidate.publication.publicationId});assert.notEqual(inspected.summary.outcome,'displayed');assert.equal(inspected.summary.lastConfirmedDisplay?.isCurrentBuild,false);assert.equal(inspected.summary.lastConfirmedDisplay?.isCurrentPublication,false);report.oldReadyNotCurrent={previousBuild:previous.publication.candidateBuildId,currentBuild:candidate.publication.candidateBuildId,summary:inspected.summary};
    }
    const opened=await f.request('/v1/authoring/openDisplay',{sessionId:session,params:{...openInput(candidate.publication),displayId:'browser-'+name}}),p=candidate.publication,from=trace.length;
    active={name,candidate,injected:0,inFlight:0,peak:0,config:{identity:{sessionId:session,viewId:p.viewId,buildId:p.candidateBuildId},publication:{publicationId:p.publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,displayId:opened.display.displayId,displayGeneration:opened.display.generation},hiddenInitially:name==='hidden-then-visible'}};
    assert.equal(f.authoring.inspect(session,{publicationId:p.publicationId}).summary.outcome,'displaying');const at=performance.now();
    await page('Page.navigate',{url:origin+'/?case='+name});
    if(name==='hidden-then-visible'){
      await wait(()=>evaluate('typeof window.__setDisplayVisible==="function"'),'parent mounted hidden frame');await sleep(350);
      assert.equal(trace.slice(from).filter(row=>row.feature==='dataTransferV1').length,0,'hidden display must not start SDK reads');assert.equal(f.authoring.inspect(session,{publicationId:p.publicationId}).summary.outcome,'displaying');await evaluate('window.__setDisplayVisible(true)');
    }
    const inspected=await wait(()=>{const value=f.authoring.inspect(session,{publicationId:p.publicationId});return value.summary.outcome===(name==='terminal-never'?'display_failed':'displayed')?value:null;},name+' final runtime outcome');
    await wait(()=>evaluate(`window.__displayAcceptance&&window.__displayAcceptance.${name==='terminal-never'?'reports':'events'}.length>0`),'parent processed exact receipt');
    const state=await evaluate('window.__displayAcceptance'),dom=await evaluate(`(()=>{const doc=document.querySelector('iframe').contentDocument;return {rows:[...doc.querySelectorAll('[data-product-id]')].map(row=>({id:row.getAttribute('data-product-id'),title:row.textContent})),assertion:doc.defaultView.__domAssertion,phase:doc.querySelector('[data-phase]')?.textContent};})()`),rows=trace.slice(from);
    if(name==='terminal-never'){
      assert.equal(active.injected,1,'never-policy initial failure must not retry');assert.equal(state.events.length,0);assert.equal(state.messages.length,0,'no renderReady request on failed initial data');assert.equal(inspected.latestDisplay.state,'failed');const error=inspected.latestDisplay.errors.find(item=>item.code==='INVALID_BINDING');assert.ok(error);assert.equal(error.retryPolicy,'never');assert.match(error.cause,/invalid binding/);assert.ok(error.requestId);assert.equal(error.attempts,1);await sleep(650);assert.equal(trace.slice(from).filter(row=>row.injected==='never').length,1);
    }else{
      assert.deepEqual(dom.rows,expected,'visible DOM retains every original product id/title');assert.deepEqual(dom.assertion,{passed:true,rows:41});assert.equal(inspected.latestDisplay.state,'ready');assert.equal(inspected.publication.state,'mounted');assert.equal(inspected.latestDisplay.buildId,p.candidateBuildId);assert.equal(inspected.summary.lastConfirmedDisplay.isCurrentBuild,true);assert.equal(inspected.summary.lastConfirmedDisplay.isCurrentPublication,true);assert.equal(state.events.length,1);assert.equal(state.messages.length,1);assert.equal(state.messages[0].domRows,41);assert.equal(state.messages[0].identity.buildId,p.candidateBuildId);assert.equal(state.messages[0].checks.dataRead,true);assert.ok(active.peak>=4,'real SDK must issue concurrent chunk reads');assert.deepEqual(state.problems,[]);
      if(name==='response-lost'){assert.equal(active.injected,1);const lost=rows.find(row=>row.injected?.startsWith('response-lost'));assert.equal(rows.filter(row=>row.path===lost.path&&row.requestId===lost.requestId).length,2,'same read envelope replayed once after accepted response loss');}
      if(name==='transient-503'){assert.equal(active.injected,3);assert.equal(rows.filter(row=>row.action==='prepare').length,2,'three upstream faults require SDK initial-read recovery beyond the Host single retry');}
      if(name==='sqlite-busy'){assert.equal(busyRemaining,0);const busy=rows.filter(row=>row.backendError?.code==='RUNTIME_STORE_BUSY');assert.equal(busy.length,2);assert.ok(busy.every(row=>row.backendStatus===503&&row.backendError.retryPolicy==='read_retry'&&row.backendError.details.cause.includes('database is locked')));}
    }
    const screenshot=await page('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'c2-'+name+'.png'),Buffer.from(screenshot.data,'base64'));
    results.push({name,status:'PASS',elapsedMs:performance.now()-at,peakConcurrentChunks:active.peak,summary:inspected.summary,display:inspected.latestDisplay,iframe:dom,parent:state,http:rows});previous=candidate;
    // Let page teardown retirement settle before replacing the proxy's active scenario.
    await page('Page.navigate',{url:'about:blank'});await sleep(120);
  }
  // W6: controlled preparation protocol states at the parent read boundary; ready always carries
  // the actual Runtime snapshot, then mounts AppsNativeView's production bridge + useApps iframe.
  for(const name of ['native-preparing-ready','native-preparing-failed','native-hidden-late-ready','native-session-switch-late-ready','native-expired-budget']){
    const candidate=await f.prepare(name,{javascript}),p=candidate.publication,opened=await f.request('/v1/authoring/openDisplay',{sessionId:session,params:{...openInput(p),displayId:'browser-'+name}}),from=trace.length;
    if(name==='native-expired-budget'){
      const id='component-display:'+opened.display.displayId,row=f.store.get('provider_records',id);assert.ok(row);row.value.openedAt=new Date(Date.now()-181_000).toISOString();f.store.put('provider_records',id,row);
    }
    active={name,native:true,candidate,injected:0,inFlight:0,peak:0,dataReads:0,dataPackets:[],assetRequests:0,preparationMode:'preparing',preparationStartedAt:new Date().toISOString(),delayPoll:name.includes('late-ready'),config:{identity:{sessionId:session,viewId:p.viewId,buildId:p.candidateBuildId},publication:{publicationId:p.publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,displayId:opened.display.displayId,displayGeneration:opened.display.generation}}};
    const at=performance.now();await page('Page.navigate',{url:origin+'/?case='+name});
    if(name==='native-expired-budget')await wait(()=>f.authoring.inspect(session,{publicationId:p.publicationId}).summary.outcome==='display_failed','expired parent budget fails immediately');
    else await wait(()=>evaluate('document.body.textContent.includes("数据准备中")&&!document.querySelector("iframe")'),'production parent preparing status with no iframe');
    const preparing={text:await evaluate('document.body.textContent'),iframes:await evaluate('document.querySelectorAll("iframe").length'),dataReads:active.dataReads,assetRequests:active.assetRequests};
    assert.equal(active.assetRequests,0,'preparing must not load even an archived SDK document');
    if(name==='native-preparing-failed')active.preparationMode='failed';
    else if(name.includes('late-ready')){
      await wait(()=>active.pollHeld,'preparation poll held in transport');
      if(name==='native-hidden-late-ready')await evaluate('window.__nativeControl.visible(false)');
      else await evaluate('window.__nativeControl.switchSession()');
      active.preparationMode='ready';active.releasePoll();
      await sleep(1300);const stale=await evaluate('window.__displayAcceptance');
      assert.equal(stale.events.length,0);assert.equal(stale.messages.length,0,'old asynchronous poll must not emit ready while hidden or after session switch');
      const readsAtPause=active.dataReads;await sleep(1100);assert.equal(active.dataReads,readsAtPause,'no preparation HTTP polling while hidden or switched away');
      if(name==='native-hidden-late-ready')await evaluate('window.__nativeControl.visible(true)');
      else{
        const inspected=f.authoring.inspect(session,{publicationId:p.publicationId});assert.notEqual(inspected.summary.outcome,'displayed');assert.equal(inspected.latestDisplay.state,'opening');assert.equal(await evaluate('document.querySelectorAll("iframe").length'),0,'switched owner must not mount stale SDK');
        results.push({name,status:'PASS',parentGate:true,elapsedMs:performance.now()-at,preparing,stale,summary:inspected.summary,dataPackets:active.dataPackets,http:trace.slice(from)});await page('Page.navigate',{url:'about:blank'});await sleep(120);continue;
      }
    }else if(name!=='native-expired-budget'){
      // Observe a real poll returning preparing before releasing the actual snapshot.
      await wait(()=>active.dataReads>=2,'production preparation poll');assert.equal(await evaluate('document.querySelectorAll("iframe").length'),0);active.preparationMode='ready';
    }
    const failure=name==='native-preparing-failed'||name==='native-expired-budget';
    const inspected=await wait(()=>{const value=f.authoring.inspect(session,{publicationId:p.publicationId});return value.summary.outcome===(failure?'display_failed':'displayed')?value:null;},name+' outcome');
    const state=await evaluate('window.__displayAcceptance');
    if(failure){
      assert.equal(state.events.length,0);assert.equal(state.messages.length,0);assert.equal(active.assetRequests,0);assert.equal(await evaluate('document.querySelectorAll("iframe").length'),0);
      const error=inspected.latestDisplay.errors.at(-1);assert.equal(error.phase,'data');assert.equal(error.code,name==='native-expired-budget'?'DISPLAY_READY_TIMEOUT':'INVALID_BINDING');assert.equal(error.retryPolicy,'never');
      if(name==='native-expired-budget')assert.ok(performance.now()-at<5000,'expired 180s display budget must not restart a fresh parent preparation budget');
    }else{
      await wait(()=>evaluate('window.__displayAcceptance.events.length===1'),'production parent accepted SDK ready');
      const dom=await evaluate('[...document.querySelector("iframe").contentDocument.querySelectorAll("[data-product-id]")].map(row=>({id:row.getAttribute("data-product-id"),title:row.textContent}))');assert.deepEqual(dom,expected);assert.equal(inspected.latestDisplay.state,'ready');assert.equal(inspected.latestDisplay.buildId,p.candidateBuildId);assert.ok(active.peak>=4);assert.equal(state.messages[0].domRows,41);assert.deepEqual(state.problems,[]);
    }
    const screenshot=await page('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'c2-'+name+'.png'),Buffer.from(screenshot.data,'base64'));
    results.push({name,status:'PASS',parentGate:true,elapsedMs:performance.now()-at,peakConcurrentChunks:active.peak,preparing,summary:inspected.summary,display:inspected.latestDisplay,parent:state,dataPackets:active.dataPackets,http:trace.slice(from)});
    await page('Page.navigate',{url:'about:blank'});await sleep(120);
  }
  report.parentGateScope='Production AppsNativeView; preparing/failed/timing values are synthetic protocol controls over real Runtime viewData. Ready payloads, frame authorization, SDK chunk reads and ready receipts are real. Not proof of a long-running W6 worker task.';
  assert.deepEqual(browserErrors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(forbidden,[]);report.status='PASS';
}catch(error){report.error={message:String(error),stack:error?.stack};throw error;}
finally{
  report.totalMs=performance.now()-started;report.browserErrors=browserErrors;report.externalRequests=externalRequests;report.forbidden=forbidden;report.trace=trace;
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(browser&&browser.exitCode===null){await Promise.race([new Promise(done=>browser.once('exit',done)),sleep(2500)]);if(browser.exitCode===null)browser.kill();}
  await closeServer(web);await host?.dispose();await closeServer(proxy);await f.close();
  if(profile){const within=relative(resolve(tmpdir()),resolve(profile));assert.ok(within&&!within.startsWith('..')&&/^display-reliability-browser-/.test(within));rmSync(profile,{recursive:true,force:true,maxRetries:15,retryDelay:200});}
  report.cleanup={webClosed:!web?.listening,proxyClosed:!proxy?.listening,runtimeClosed:!f.store.db.isOpen,browserExitCode:browser?.exitCode};
  writeFileSync(join(out,'c2-browser-faults.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,results:results.map(({name,elapsedMs,peakConcurrentChunks})=>({name,elapsedMs,peakConcurrentChunks})),totalMs:report.totalMs,artifact:join(out,'c2-browser-faults.json')}));
}
