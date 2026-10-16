import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {existsSync,mkdirSync,writeFileSync,readFileSync,rmSync,mkdtempSync} from 'node:fs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {join,resolve,relative,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import {RuntimeStore} from '../../../packages/app-runtime/src/store.ts';
import {AppsHost,HttpAppsHostTransport,RuntimeHealthMonitor} from '../../../packages/plugin-apps/src/index.ts';
import {validateRuntimeLaunchManifest,RuntimeRestarter,spawnRuntime,runtimeChildEnvironment,runtimePortFree,RUNTIME_RESTART_POLICY} from '../../../packages/plugin-apps/src/runtime-launcher.ts';
import {createFixture,session,openInput,assertion,environment,sleep,sha} from './fixture.ts';
import {extractArtifact} from '../../../scripts/performance/six-batch/packaging/artifact.mjs';

const out=resolve('artifacts/component-display-reliability'),chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const packageArgument=process.argv.indexOf('--package'),packageVersion=packageArgument>=0?process.argv[packageArgument+1]:process.env.DSH_RECOVERY_PACKAGE;
if(packageArgument>=0)assert.ok(packageVersion&&!packageVersion.startsWith('--'),'--package requires the exact bundle version');
if(packageVersion)assert.notEqual(process.env.DSH_RECOVERY_MANUAL_DIAGNOSTIC,'1','packed acceptance requires manualActions=0');
const artifactPath=suffix=>join(out,`${packageVersion?'c2-packed-runtime-recovery':'c2-runtime-recovery'}${suffix}`);
assert.ok(chrome,'Installed Chromium required; test uses a fresh profile, never installed DSH.');mkdirSync(out,{recursive:true});
const started=performance.now(),f=await createFixture({productionLayout:true}),owned=[],health=[],restart=[],httpTrace=[],hostLog=[],browserErrors=[],externalRequests=[],forbidden=[],pending=new Map();
let host,monitor,restarter,proxy,web,browser,profile,socket,page,origin,candidate,config,firstChild,crashed=false,sequence=0,diagnostics='',tools=new Map();
let extracted,packageDirectory;
const packageIsolationRoot=resolve(process.cwd(),'..','.real-corpus-isolation');
const result={status:'FAIL',scope:'OWNED_REAL_RUNTIME_CHILD_W7_RESTART_HOST_REAL_IFRAME_READY',actualDesktop:false,actualShop:false,realShopWrites:false,environment:environment(),injectionPoint:'First SDK getData prepare, after frame authorization and before forwarding it to Runtime; no transfer registry has yet been created. Does not prove recovery after loss of an existing transfer registry.',health,restart,httpTrace,hostLog,browserErrors,externalRequests,forbidden};
const listen=server=>new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>done(`http://127.0.0.1:${server.address().port}`));});
const closeServer=async server=>{if(!server)return;server.closeAllConnections();await new Promise(done=>server.close(done));};
async function wait(check,label,timeout=15_000){const end=performance.now()+timeout;while(performance.now()<end){const value=await check();if(value)return value;await sleep(30);}throw Error('Timed out: '+label);}
const send=(method,params={},sessionId)=>new Promise((done,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},12_000);pending.set(id,{done,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const evaluate=async expression=>{const value=await page('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error(value.exceptionDetails.exception?.description??value.exceptionDetails.text);return value.result?.value;};
const identities=store=>Object.fromEntries(['build_receipts','preview_receipts','view_publications','authoring_attempts'].map(table=>[table,store.db.prepare(`SELECT id FROM ${table} ORDER BY id`).all().map(row=>row.id)]));
let manifest,serviceURL,crashAt,readyAt,firstPrepare;
try{
  if(packageVersion){
    // Temp may have unrelated ancestor node_modules; retain the extractor's strict isolation check.
    mkdirSync(packageIsolationRoot,{recursive:true});packageDirectory=mkdtempSync(join(packageIsolationRoot,'display-packed-artifact-'));extracted=extractArtifact(process.cwd(),packageDirectory);
    assert.equal(extracted.manifest.bundleVersion,packageVersion,'the requested exact package is the currently pinned artifact');
    const changedInputs=Object.entries(extracted.build.sourceInputs).filter(([path,digest])=>!existsSync(resolve(path))||sha(readFileSync(resolve(path)))!==digest).map(([path])=>path);
    assert.deepEqual(changedInputs,[],'packed source inputs must match the final workspace before acceptance');
    const artifacts=Object.fromEntries(['lib/runtime.js','client/client.js','sdk/component-runtime/apps-react.js'].map(path=>{const bytes=readFileSync(join(extracted.packageRoot,path)),digest=sha(bytes);assert.equal(digest,extracted.build.artifacts[path],`packed ${path} digest`);return [path,{sha256:digest,bytes:bytes.length}];}));
    result.scope='VERIFIED_PACKED_RUNTIME_CLIENT_SDK_OWNED_CHILD_DEFAULT_RESTART_REAL_IFRAME_READY';result.package={...extracted.manifest,artifacts,sourceInputsVerified:Object.keys(extracted.build.sourceInputs).length};
    result.packageBoundary={runtime:'unmodified extracted lib/runtime.js composeAppsRuntime',iframeSdk:'unmodified extracted sdk/component-runtime/apps-react.js bundled with fixture UI and checkout React',parent:'unmodified extracted client/client.js plugin registered through __ModuleLoader__, slots and the public sidebar useTabInfo face',sourceAuxiliaries:['offline fixture preparation and signed control receipts; does not certify package build/preview CLI','HTTP createAppsServer adapter and request logging','loopback browser asset serving from the test-owned source archive','AppsHost transport, RuntimeHealthMonitor and RuntimeRestarter'],hostShim:'Fixed test-owned session/sidebar visibility; no actual installed DSH Host or shop connection'};
  }
  result.load=f.seedBytes();
  const expected=f.originals.map(row=>({id:row.detail.id,title:row.detail.title}));
  const parent=await build({entryPoints:[resolve(`test/acceptance/component-display/${extracted?'packed-browser-parent':'browser-native-parent'}.tsx`)],bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const sdk=extracted?join(extracted.packageRoot,'sdk/component-runtime/apps-react.js'):'./packages/component-runtime/src/apps-react.tsx';
  const child=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import {useApps} from ${JSON.stringify(sdk)};
const expected=${JSON.stringify(expected)};
function Component(){const apps=useApps({assertionResults:()=>{const rows=[...document.querySelectorAll('[data-product-id]')],passed=rows.length===expected.length&&rows.every((row,index)=>row.getAttribute('data-product-id')===expected[index].id&&row.textContent===expected[index].title);window.__domAssertion={passed,rows:rows.length};return [{...${JSON.stringify(assertion())},status:passed?'PASS':'FAIL',actual:passed?${JSON.stringify(assertion().actual)}:'DOM differs'}];}});const rows=apps.data?.bindings?.[0]?.payload?.items??[];return <main><p data-phase>{apps.error?'failed':apps.loading?'loading':'loaded'}</p>{apps.error?<pre role="alert">{apps.error.message}</pre>:null}<ol>{rows.map(row=><li key={row.id} data-product-id={row.id}>{row.title}</li>)}</ol></main>;}
createRoot(document.getElementById('root')).render(<Component/>);
`},bundle:true,write:false,nodePaths:[resolve('node_modules')],platform:'browser',format:'iife',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  candidate=await f.prepare('W7 real Runtime child recovery',{javascript:child.outputFiles[0].text});
  const p=candidate.publication,opened=await f.request('/v1/authoring/openDisplay',{sessionId:session,params:{...openInput(p),displayId:'owned-runtime-recovery'}});
  result.identityBefore={publicationId:p.publicationId,buildId:p.candidateBuildId,attemptId:p.attemptId,buildReceiptId:p.buildReceiptId,previewReceiptId:p.previewReceiptId,displayId:opened.display.displayId};result.evidenceIdsBefore=identities(f.store);
  assert.equal(f.authoring.inspect(session,{publicationId:p.publicationId}).summary.outcome,'displaying');
  config={identity:{sessionId:session,viewId:p.viewId,buildId:p.candidateBuildId},publication:{publicationId:p.publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,displayId:opened.display.displayId,displayGeneration:opened.display.generation}};
  serviceURL=f.url;const port=Number(new URL(serviceURL).port),entry=join(f.directory,'owned-runtime-entry.mjs'),connections=join(f.directory,'offline-connections.json');
  writeFileSync(entry,`import ${JSON.stringify(pathToFileURL(resolve('test/acceptance/component-display/recovery-runtime.mjs')).href)};\n`);writeFileSync(connections,JSON.stringify({connections:[],fixtureOnly:true}));
  writeFileSync(join(f.directory,'recovery-fixture.json'),JSON.stringify({port,token:f.token,records:f.originals,publicationId:p.publicationId,buildId:p.candidateBuildId,...(extracted?{runtimeEntry:extracted.entry,runtimeSha256:extracted.manifest.runtimeSha256}: {})}));
  manifest=validateRuntimeLaunchManifest({schemaVersion:1,managedBy:'dsh-plugin-apps-bundle',serviceUrl:serviceURL,nodeExecutable:process.execPath,entry,cwd:f.directory,env:{APPS_DATA_DIR:f.directory,APPS_CONNECTIONS_FILE:connections,APPS_PORT:String(port)},credentials:[]},{serviceUrl:serviceURL,dataDirectory:f.directory,entry});
  result.launch={...manifest,entrySha256:sha(readFileSync(entry)),note:'Explicitly pinned test-owned temporary entry. Production installed lib/runtime.js constraints are unchanged.'};
  await f.close({preserveDirectory:true});assert.equal(await runtimePortFree(serviceURL),true);
  const launch=async(m,env,role)=>{assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.ELECTRON_RUN_AS_NODE,undefined);const handle=await spawnRuntime(m,env);owned.push({handle,role,startedMs:performance.now()});return handle;};
  firstChild=await launch(manifest,runtimeChildEnvironment(manifest),'initial-test-owned');
  const direct=new HttpAppsHostTransport(serviceURL,f.token);await wait(async()=>{try{return (await direct.health()).status==='ok';}catch{return false;}},'first actual Runtime child listening');
  proxy=createServer(async(req,res)=>{
    let text='';for await(const part of req)text+=part;const packet=text?JSON.parse(text):null,row={atMs:performance.now(),path:req.url,method:req.method,requestId:packet?.requestId,feature:packet?.feature,action:packet?.action,index:packet?.params?.index};httpTrace.push(row);
    try{
      if(!crashed&&req.url==='/v1/component-extension'&&packet?.feature==='dataTransferV1'&&packet?.action==='prepare'&&packet?.params?.method==='getData'){
        crashed=true;crashAt=performance.now();assert.ok(firstChild.pid&&owned.some(item=>item.handle===firstChild));firstPrepare=structuredClone(packet);row.injected='real-owned-process-kill-before-prepare';row.killedPid=firstChild.pid;
        process.kill(firstChild.pid);await wait(()=>firstChild.hasExited(),'injected Runtime process actually exited');row.exitConfirmedMs=performance.now();req.socket.destroy();return;
      }
      const response=await fetch(serviceURL+req.url,{method:req.method,headers:{authorization:'Bearer '+f.token,'content-type':'application/json'},...(text?{body:text}:{})}),value=await response.json();row.status=response.status;row.error=value.error;
      res.writeHead(response.status,{'content-type':'application/json'});res.end(JSON.stringify(value));
    }catch(error){row.transportError=String(error);if(!res.destroyed){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({status:'unavailable',error:{code:'RUNTIME_CONNECTION_LOST',message:'Controlled proxy observed the actual owned Runtime outage',retryPolicy:'read_retry',details:{cause:String(error),requestId:packet?.requestId??'owned-outage'}}}));}}
  });
  const proxyURL=await listen(proxy),transport=new HttpAppsHostTransport(proxyURL,f.token);
  // Probes MUST reach actual Runtime, not the proxy's 503: only genuine connection loss permits W7 spawn.
  monitor=new RuntimeHealthMonitor({probe:signal=>direct.health(signal),log:row=>hostLog.push(row)});
  monitor.onCheck(snapshot=>health.push({atMs:performance.now(),...snapshot}));
  restarter=new RuntimeRestarter({monitor,manifest,spawn:(m,env)=>launch(m,env,'W7-restarter'),log:row=>restart.push({atMs:performance.now(),...row})});
  result.retryTiming={health:monitor.snapshot().thresholds,restart:RUNTIME_RESTART_POLICY,sdkInitialReadRetryDelaysMs:[500,1500],customTimingOverrides:false};
  host=new AppsHost({agents:{get:id=>id===session?{id}:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport,undefined,{health:monitor,restarter,log:row=>hostLog.push(row)});await host.start();
  const csp="default-src 'none'; script-src 'self'; frame-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'none'";
  web=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://fixture'),path=url.pathname,headers={'content-security-policy':csp,'cache-control':'no-store'};
      if(path==='/'){res.writeHead(200,{...headers,'content-type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/parent.js"></script>');return;}
      if(path==='/parent.js'){res.writeHead(200,{...headers,'content-type':'text/javascript'});res.end(parent.outputFiles[0].text);return;}
      if(path==='/packed-client.js'&&extracted){res.writeHead(200,{...headers,'content-type':'text/javascript'});res.end(readFileSync(join(extracted.packageRoot,'client/client.js')));return;}
      if(path==='/config'){res.writeHead(200,{...headers,'content-type':'application/json'});res.end(JSON.stringify(config));return;}
      if(path.startsWith('/api/hallmark-source/')){const parts=path.slice('/api/hallmark-source/'.length).split('/'),buildId=parts.shift();assert.equal(buildId,p.candidateBuildId);const asset=f.sources.readFile(buildId,parts.join('/'));assert.ok(asset);res.writeHead(200,{...headers,'content-type':asset.mime});res.end(asset.bytes);return;}
      if(path==='/api/dsh-apps'){
        let text='';for await(const part of req)text+=part;if(req.method==='POST'){const body=JSON.parse(text),allowed=body.action==='componentExtension'||body.action==='componentBridge'&&['getData','getContext'].includes(body.request.method)||body.action==='authoring'&&['authorizeDisplayFrame','reportDisplayError','retireFrame','inspect','openDisplay'].includes(body.operation);if(!allowed){forbidden.push(body);throw Error('Forbidden action during recovery');}}
        const value=await host.ui(new Request(origin+req.url,{method:req.method,headers:{'content-type':'application/json'},...(text?{body:text}:{})}));res.writeHead(value.status,{...headers,'content-type':'application/json'});res.end(await value.text());return;
      }
      if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}forbidden.push({path});res.writeHead(404);res.end();
    }catch(error){if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'ACCEPTANCE_SERVER_ERROR',message:String(error)}}));}
  });origin=await listen(web);
  profile=mkdtempSync(join(tmpdir(),'display-reliability-browser-'));browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});browser.stderr.on('data',part=>diagnostics=(diagnostics+part).slice(-10_000));
  await wait(()=>diagnostics.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/),'fresh Chromium');socket=new WebSocket(diagnostics.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:[^\s]+)/)[1]);await new Promise((done,reject)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(message.error.message)):item.done(message.result);return;}if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails);if(message.method==='Network.requestWillBeSent'&&!message.params.request.url.startsWith(origin)&&!message.params.request.url.startsWith('about:'))externalRequests.push(message.params.request.url);});socket.addEventListener('close',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Browser disconnected'));}pending.clear();});
  result.browser=await send('Browser.getVersion');const target=await send('Target.createTarget',{url:'about:blank'}),attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});page=(method,params={})=>send(method,params,attached.sessionId);await page('Page.enable');await page('Runtime.enable');await page('Network.enable');await page('Network.setCacheDisabled',{cacheDisabled:true});await page('Emulation.setDeviceMetricsOverride',{width:1040,height:800,deviceScaleFactor:1,mobile:false});await page('Page.navigate',{url:origin+'/'});
  await wait(()=>crashed,'actual injected crash');
  const firstOutcome=await wait(async()=>{const state=await evaluate('window.__displayAcceptance');return state&&(state.events.length||state.problems.length)?{atMs:performance.now(),state}:null;},'SDK initial recovery outcome',12_000);
  result.firstSdkOutcome={afterCrashMs:firstOutcome.atMs-crashAt,state:firstOutcome.state};
  await wait(()=>monitor.state==='healthy'&&restart.some(row=>row.reason==='RESTART_HEALTHY'),'production-default W7 Runtime health recovery',60_000);
  const healthyAt=performance.now();
  // Observe without clicks first. A later explicit Retry is separate, never automatic recovery.
  if(!firstOutcome.state.events.length){try{await wait(()=>evaluate('window.__displayAcceptance?.events.length===1'),'bounded automatic parent reopen after real health recovery',10_000);}catch{}}
  const automaticState=await evaluate('window.__displayAcceptance'),automaticInspect=await direct.authoringAction('inspect',session,{publicationId:p.publicationId});
  const automaticReady=automaticState.events.length===1&&automaticInspect.summary.outcome==='displayed';
  result.automaticRecovery={status:automaticReady?'PASS':'FAIL',healthRecoveredAfterCrashMs:healthyAt-crashAt,observedAfterHealthMs:performance.now()-healthyAt,summary:automaticInspect.summary,display:automaticInspect.latestDisplay,parent:automaticState,manualActions:0};
  if(!automaticReady){
    writeFileSync(artifactPath('-automatic-path.json'),JSON.stringify({scope:result.scope,status:'FAIL',injectionPoint:result.injectionPoint,retryTiming:result.retryTiming,firstSdkOutcome:result.firstSdkOutcome,automaticRecovery:result.automaticRecovery,health,restart},null,2)+'\n');
    const beforeManual=await page('Page.captureScreenshot',{format:'png'});writeFileSync(artifactPath('-automatic-failed.png'),Buffer.from(beforeManual.data,'base64'));
    if(process.env.DSH_RECOVERY_MANUAL_DIAGNOSTIC!=='1')throw new Error('AUTOMATIC_DISPLAY_RECOVERY_FAILED: real Runtime is healthy but the same publication/build has no SDK ready; automatic-path evidence saved with manualActions=0.');
    result.manualRecovery={status:'RUNNING',action:'One explicit production AppsNativeView Retry click AFTER automatic-path failure evidence was saved',automaticReopen:false};
    assert.equal(await evaluate('(()=>{const button=[...document.querySelectorAll("button")].find(node=>node.textContent.trim()==="重试");if(!button)return false;button.click();return true;})()'),true,'production Retry must exist; no test-direct open/confirm endpoint');
    await wait(()=>evaluate('window.__displayAcceptance?.events.length===1'),'explicit same-publication retry reaches genuine SDK ready',15_000);
    result.manualRecovery.status='PASS';
  }
  readyAt=performance.now();
  const inspected=await direct.authoringAction('inspect',session,{publicationId:p.publicationId}),state=await evaluate('window.__displayAcceptance'),dom=await evaluate('(()=>{const doc=document.querySelector("iframe").contentDocument;return {rows:[...doc.querySelectorAll("[data-product-id]")].map(row=>({id:row.getAttribute("data-product-id"),title:row.textContent})),assertion:doc.defaultView.__domAssertion};})()');
  assert.equal(crashed,true);assert.equal(owned.length,2,'exactly the test initial process plus one W7-launched replacement');assert.equal(owned[1].role,'W7-restarter');assert.notEqual(owned[0].handle.pid,owned[1].handle.pid);assert.equal(owned[0].handle.hasExited(),true);assert.equal(owned[1].handle.hasExited(),false);
  await wait(()=>monitor.state==='healthy'&&restart.some(row=>row.reason==='RESTART_HEALTHY'),'W7 health recovery evidence');
  assert.ok(health.some(row=>row.atMs>crashAt&&row.state==='down'));assert.ok(health.some(row=>row.atMs>crashAt&&row.state==='healthy'));assert.ok(restart.some(row=>row.reason==='SPAWNING'));assert.ok(restart.some(row=>row.reason==='WAITING_FOR_HEALTH'));
  assert.equal(inspected.summary.outcome,'displayed');assert.equal(inspected.latestDisplay.state,'ready');assert.equal(inspected.publication.publicationId,p.publicationId);assert.equal(inspected.publication.candidateBuildId,p.candidateBuildId);assert.equal(inspected.latestDisplay.buildId,p.candidateBuildId);assert.equal(inspected.summary.lastConfirmedDisplay.isCurrentBuild,true);assert.equal(inspected.summary.lastConfirmedDisplay.isCurrentPublication,true);
  assert.deepEqual(dom.rows,expected);assert.deepEqual(dom.assertion,{passed:true,rows:41});assert.equal(state.messages.length,1);assert.equal(state.messages[0].domRows,41);assert.equal(state.messages[0].checks.dataRead,true);assert.deepEqual(browserErrors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(forbidden,[]);
  if(extracted){assert.ok(state.packageRegistration.some(row=>row.kind==='slot'&&row.name==='sidebar.right.pane.tab'&&row.key==='dsh-plugin-hallmark/session-components'),'the packed plugin registered the actual parent pane');result.package.parentRegistrationVerified=true;}
  assert.equal(httpTrace.filter(row=>row.feature==='renderReadyV1').length,1,'only SDK ready, not test confirmation or replay');assert.ok(httpTrace.filter(row=>row.feature==='dataTransferV1'&&row.action==='prepare').length>=2,'SDK retried its first read after the real outage');
  result.recoveryMs=readyAt-crashAt;result.inspected=inspected;result.parent=state;result.dom=dom;
  const identityAfter={publicationId:inspected.publication.publicationId,buildId:inspected.publication.candidateBuildId,attemptId:inspected.publication.attemptId,buildReceiptId:inspected.publication.buildReceiptId,previewReceiptId:inspected.publication.previewReceiptId};
  const {displayId:oldDisplayId,...identityBefore}=result.identityBefore;result.identityAfter={...identityAfter,displayId:inspected.latestDisplay.displayId};assert.deepEqual(identityAfter,identityBefore);
  result.displayRecovery={oldDisplayId,currentDisplayId:inspected.latestDisplay.displayId,automaticReopen:automaticReady&&inspected.latestDisplay.displayId!==oldDisplayId,explicitRetry:!automaticReady};
  if(inspected.latestDisplay.displayId!==oldDisplayId){
    assert.notEqual(inspected.latestDisplay.displayId,oldDisplayId);assert.notEqual(state.messages[0].identity.frameInstanceId,firstPrepare.frameInstanceId);
    const stale=await fetch(serviceURL+'/v1/component-extension',{method:'POST',headers:{authorization:'Bearer '+f.token,'content-type':'application/json'},body:JSON.stringify({...firstPrepare,requestId:'old-document-after-recovery'})}),body=await stale.json();assert.equal(stale.status,400);assert.equal(body.error.code,'BRIDGE_IDENTITY_STALE');result.oldFrameRejection={status:stale.status,body};
  }
  const screenshot=await page('Page.captureScreenshot',{format:'png'});writeFileSync(artifactPath('.png'),Buffer.from(screenshot.data,'base64'));
  await page('Page.navigate',{url:'about:blank'});await sleep(120);
  await host.dispose();host=undefined;monitor.stop();restarter.stop();
  for(const item of owned)if(!item.handle.hasExited())writeFileSync(join(f.directory,`stop-runtime-${item.handle.pid}`),'owned fixture cleanup');await wait(()=>owned.every(item=>item.handle.hasExited()),'owned replacement graceful shutdown and writer lease release');
  const checkStore=new RuntimeStore(f.databasePath);try{result.evidenceIdsAfter=identities(checkStore);assert.deepEqual(result.evidenceIdsAfter,result.evidenceIdsBefore,'no new build, preview, attempt or publication may replace recovery');}finally{checkStore.close();}
  result.status=result.automaticRecovery.status==='PASS'?'PASS':'PARTIAL';
}catch(error){result.error={message:String(error),stack:error?.stack};if(result.manualRecovery?.status==='RUNNING')result.manualRecovery.status='FAIL';if(page)try{result.failureBrowser={state:await evaluate('window.__displayAcceptance'),text:await evaluate('document.body.textContent')};}catch{}throw error;}
finally{
  result.totalMs=performance.now()-started;await host?.dispose();monitor?.stop();restarter?.stop();
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}if(browser&&browser.exitCode===null){await Promise.race([new Promise(done=>browser.once('exit',done)),sleep(2500)]);if(browser.exitCode===null)browser.kill();}
  await closeServer(web);await closeServer(proxy);
  for(const item of owned)if(!item.handle.hasExited())writeFileSync(join(f.directory,`stop-runtime-${item.handle.pid}`),'owned fixture cleanup');
  try{await wait(()=>owned.every(item=>item.handle.hasExited()),'all owned Runtime children exit during cleanup',5000);}catch{for(const item of owned)if(!item.handle.hasExited())process.kill(item.handle.pid);await wait(()=>owned.every(item=>item.handle.hasExited()),'forced cleanup owns every terminated PID',5000);}
  result.children=owned.map(item=>({pid:item.handle.pid,role:item.role,exited:item.handle.hasExited(),startedMs:item.startedMs}));
  if(result.evidenceIdsBefore&&existsSync(f.databasePath)&&!result.evidenceIdsAfter){const check=new RuntimeStore(f.databasePath);try{result.evidenceIdsAfter=identities(check);assert.deepEqual(result.evidenceIdsAfter,result.evidenceIdsBefore);}finally{check.close();}}
  const logPath=join(f.directory,'logs','runtime-child.log');result.runtimeLog=existsSync(logPath)?readFileSync(logPath,'utf8'):'';writeFileSync(artifactPath('-child.log'),result.runtimeLog);
  const runtimeRows=result.runtimeLog.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});result.runtimeProcesses=runtimeRows.filter(row=>row.event==='real-runtime-listening');
  if(result.status==='PASS'||result.status==='PARTIAL'){assert.equal(result.runtimeProcesses.length,2);assert.equal(new Set(result.runtimeProcesses.map(row=>row.pid)).size,2);assert.equal(runtimeRows.filter(row=>row.event==='offline-provider-invoke').length,0,'recovery reads prepared snapshots without source invocations');if(extracted)assert.ok(result.runtimeProcesses.every(row=>row.runtimeMode==='verified-package'&&row.runtimeSha256===extracted.manifest.runtimeSha256),'both actual child processes loaded the verified packed Runtime');}
  result.cleanup={childrenExited:owned.every(item=>item.handle.hasExited()),runtimePortFree:serviceURL?await runtimePortFree(serviceURL):null,launchLockExists:existsSync(join(f.directory,'runtime-launch.lock')),writerLeaseExists:existsSync(join(f.directory,'runtime-writer.json')),webClosed:!web?.listening,proxyClosed:!proxy?.listening,toolsRemaining:tools.size,browserExitCode:browser?.exitCode};
  if(profile){const within=relative(resolve(tmpdir()),resolve(profile));assert.ok(within&&!within.startsWith('..')&&/^display-reliability-browser-/.test(within));rmSync(profile,{recursive:true,force:true,maxRetries:15,retryDelay:200});}
  await f.close();result.cleanup.fixtureRemoved=!existsSync(f.directory);result.cleanup.profileRemoved=!profile||!existsSync(profile);
  if(packageDirectory){assert.equal(dirname(resolve(packageDirectory)),packageIsolationRoot);assert.match(basename(packageDirectory),/^display-packed-artifact-[^\\/]+$/);rmSync(packageDirectory,{recursive:true,force:true,maxRetries:5,retryDelay:100});result.cleanup.extractedPackageRemoved=!existsSync(packageDirectory);}
  writeFileSync(artifactPath('.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,automaticRecovery:result.automaticRecovery?.status,manualRecovery:result.manualRecovery?.status,firstSdkOutcomeMs:result.firstSdkOutcome?.afterCrashMs,recoveryMs:result.recoveryMs,totalMs:result.totalMs,children:result.children,cleanup:result.cleanup,artifact:artifactPath('.json')}));
  if(result.status==='PARTIAL')process.exitCode=1;
  assert.equal(result.cleanup.childrenExited,true);assert.equal(result.cleanup.runtimePortFree,serviceURL?true:null);assert.equal(result.cleanup.launchLockExists,false);assert.equal(result.cleanup.writerLeaseExists,false);assert.equal(result.cleanup.toolsRemaining,0);
}
