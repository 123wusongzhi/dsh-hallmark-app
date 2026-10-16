import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
async function fixture(label:string,contents:string,timeout=15000){
  const root=label.startsWith('performance-')?'artifacts/performance/ui':'artifacts';mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root+'/native-display-'+label+'-')),entry=join(directory,'fixture.mjs');
  writeFileSync(join(directory,'fixture.tsx'),contents,{flag:'wx'});
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout,maxBuffer:8*1024*1024});
  writeFileSync(join(directory,'stdout.txt'),result.stdout??'',{flag:'wx'});writeFileSync(join(directory,'stderr.txt'),result.stderr??'',{flag:'wx'});
  const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(join(directory,'command.json'),JSON.stringify({label,command:[process.execPath,entry],cwd:process.cwd(),exitCode:result.status,error:result.error?.message??null,fixtureSha256:sha(join(directory,'fixture.tsx')),bundleSha256:sha(entry),stdoutSha256:sha(join(directory,'stdout.txt')),stderrSha256:sha(join(directory,'stderr.txt')),scope:'ISOLATED_PRODUCTION_REACT_HTTP_DISPLAY_FIXTURE',actualDesktop:false,actualRuntime:false,renderReadySimulated:true,actualBusiness:false},null,2)+'\n',{flag:'wx'});
  assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/DISPLAY_SURFACE_PASS/);
}
const setup=`
import React,{useState} from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createConnection} from 'node:net';
import {AppsNativeView,AppsToolView} from './packages/plugin-apps/client/view.tsx';import {AppsSidebarPane} from './packages/plugin-apps/client/sidebar.tsx';import {NativePublicationObserver,CandidateFrameLease} from './packages/plugin-apps/client/native-publication.tsx';import {COMPONENT_CHANNEL} from './packages/component-runtime/src/apps-client.ts';
import {AppsSaveControls} from './packages/plugin-apps/client/save-controls.tsx';
import {appsDisplayTime} from './packages/plugin-apps/client/ui.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const actualFetch=fetch,actualSetTimeout=setTimeout,http=[],events=new Map(),posts=[],nodes=[],displays=[],grants=[],releases=[];let owner='A',authError=false,lostOpen=false,holdOpen=false,holdAuthorize=false,catalogError=false,failInitialData=false,readyProbe=false,tree,failure,opened=0,setNavigation,viewBinding,refreshPayload,holdRefresh=false,failRefresh=false,interceptRequest,idleClockEvidence;
const source={buildId:'preview-build',entry:'index.html',protocol:'dsh.apps.component.v2'},publication={publicationId:'P1',viewId:'V',ownerSessionId:'A',attemptId:'attempt',attemptEpoch:1,expectedViewRevision:2,candidateBuildId:source.buildId,source,state:'prepared',readyDeadlineAt:null},snapshot={viewId:'V',ownerSessionId:'A',title:'Bill 商品',design:{},bindings:[],source,viewRevision:2,pendingPublicationId:'P1',validationStatus:'draft_unpublished'},active={...snapshot,source:null},dataFor=display=>({viewId:'V',bindings:viewBinding?[viewBinding]:[],snapshotBuild:display?.buildId??'active'});
const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const query=new URL(req.url,'http://fixture').searchParams,body=raw?JSON.parse(raw):undefined,resource=query.get('resource'),row={path:req.url,method:req.method,resource,body};http.push(row);
 const reply=(status,value)=>{row.status=status;row.response=value;if(!res.destroyed){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));}};
 if(interceptRequest?.({query,body,resource,row,reply}))return;
 if(resource==='hostCapabilities'){reply(200,readyProbe?{adapterReady:true,nativeSessionAdapter:'dsh-0.2.0-rc.2',hostVersion:'0.2.0-rc.2',updateContext:true,requestAgent:true}:{adapterReady:false});return;}if(resource==='componentFeatures'){reply(200,{features:['renderReadyV1','uiStateV1']});return;}
 if(resource==='views'){reply(catalogError?403:200,catalogError?{error:{code:'OWNER_REJECTED',message:'owner denied'}}:{views:[active]});return;}
 if(resource==='view'){const pinned=query.get('publicationId');assert.ok(!pinned||['P1','P2'].includes(pinned));reply(200,{...active,...(pinned?{publication:pinned==='P1'?publication:{...publication,publicationId:'P2',candidateBuildId:'P2-build',source:{...source,buildId:'P2-build'},state:'prepared'}}:{})});return;}
 if(resource==='viewData'){const display=displays.find(row=>row.displayId===query.get('displayId'));if(query.has('displayId')){assert.ok(display);assert.equal(query.get('publicationId'),'P1');assert.equal(query.get('buildId'),'preview-build');assert.equal(query.get('displayGeneration'),String(display.generation));}reply(200,dataFor(display));return;}
 if(body?.operation==='inspect'){reply(200,{publication,latestDisplay:displays.at(-1)??null,displays});return;}
 if(body?.operation==='restoreView'){assert.equal(body.params.viewId,'V');active.panelState='open';delete active.closedAt;reply(200,active);return;}
 if(body?.operation==='openDisplay'){const p=body.params;assert.equal(p.publicationId,'P1');assert.equal(p.buildId,'preview-build');assert.equal(p.expectedViewRevision,2);assert.equal(p.attemptId,'attempt');assert.equal(p.attemptEpoch,1);assert.ok(p.displayId);for(const d of displays)d.state='retired';const display={...p,ownerSessionId:'A',generation:displays.length+1,state:'opening',errors:[],view:snapshot};displays.push(display);const dispatch=()=>reply(lostOpen?503:200,lostOpen?{error:{code:'RESPONSE_LOST',message:'open response lost'}}:{publication,display,source,view:snapshot,data:dataFor(display)});if(holdOpen)releases.push(dispatch);else dispatch();return;}
 if(body?.operation==='authorizeDisplayFrame'){const display=displays.find(row=>row.displayId===body.params.displayId);assert.ok(display);assert.equal(body.params.displayGeneration,display.generation);grants.push(body.params);const dispatch=()=>{if(authError){reply(403,{error:{code:'PERMISSION_DENIED',message:'data permission denied'}});return;}Object.assign(display,{frameInstanceId:body.params.frameInstanceId,documentNonce:body.params.documentNonce});reply(200,{display,features:body.params.clientFeatures});};if(holdAuthorize)releases.push(dispatch);else dispatch();return;}
 if(body?.operation==='reportDisplayError'){const display=displays.find(row=>row.displayId===body.params.displayId);assert.ok(display);assert.equal(body.params.displayGeneration,display.generation);display.state='failed';display.errors.push(body.params.error);reply(200,display);return;}
 if(body?.operation==='retireFrame'){reply(200,{retired:true});return;}if(body?.operation==='negotiateFrame'){reply(200,{features:body.params.clientFeatures});return;}
 if(body?.capabilityId==='apps.authoring.save_component'){assert.equal(body.input.expectedViewRevision,active.viewRevision);reply(200,{status:'ok',data:{componentId:'saved-component',revision:1,title:body.input.title,view:{...active,title:body.input.title,sourceComponentId:'saved-component',baseRevision:1},userRequest:body.input.userRequest,savedAt:new Date().toISOString()}});return;}
 if(body?.action==='componentExtension'&&body.request.feature==='uiStateV1'){if(body.request.params.documentNonce!=='legacy-doc'){reply(200,{...body.request,error:{code:'FRAME_IDENTITY_STALE',message:'wrong nonce',retryPolicy:'never'}});return;}reply(200,{...body.request,result:{status:'ready',snapshot:null,stateRevision:1}});return;}if(body?.action==='componentExtension'){const display=displays.find(row=>row.frameInstanceId===body.request.frameInstanceId);assert.ok(display);display.state='ready';publication.state='mounted';reply(200,{...body.request,result:{publication,display,view:snapshot}});return;}
 if(body?.action==='componentBridge'){if(failInitialData&&body.request.method==='getData'){reply(200,{...body.request,error:{code:'DATA_UNAVAILABLE',message:'actual initial dataset unavailable',retryPolicy:'never'}});return;}if(body.request.method==='refresh'){const response={...body.request,...(failRefresh?{error:{code:'DATA_UNAVAILABLE',message:'refresh failed',retryPolicy:'read_retry'}}:{result:refreshPayload??dataFor(displays.at(-1))})},dispatch=()=>reply(200,response);if(holdRefresh)releases.push(dispatch);else dispatch();return;}reply(200,{...body.request,...(body.request.method==='invokeCapability'?{error:{code:'INVALID_INPUT',message:'ordinary input validation',retryPolicy:'never'}}:{result:body.request.method==='getData'?dataFor(displays.at(-1)):{}})});return;}
 reply(404,{error:{code:'UNEXPECTED_ROUTE',message:req.url}});
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port,origin='http://127.0.0.1:'+port;assert.ok(![36994,4180,4280].includes(port));globalThis.fetch=(url,init)=>actualFetch(new URL(String(url),origin),init);
const parent={location:{origin},addEventListener(type,listener){const rows=events.get(type)??new Set();rows.add(listener);events.set(type,rows);},removeEventListener(type,listener){events.get(type)?.delete(listener);},dispatchEvent(event){for(const listener of [...events.get(event.type)??[]])listener(event);return true;}};globalThis.window=parent;
const mountedListeners=new Set(),sidebar={mounted:{getSnapshot:()=>owner,subscribe:fn=>{mountedListeners.add(fn);return()=>mountedListeners.delete(fn);}},openTab(kind,options){opened++;setNavigation?.({params:options?.params,revision:opened});}},controller=new AbortController();
const nodeMock=node=>{if(node.type!=='iframe')return null;const childEvents=new Map(),child={location:{origin},postMessage:value=>posts.push(value),addEventListener(type,fn){const rows=childEvents.get(type)??new Set();rows.add(fn);childEvents.set(type,rows);},removeEventListener(type,fn){childEvents.get(type)?.delete(fn);}},element={contentWindow:child,childEvents};nodes.push(element);return element;};
const settle=(ms=15)=>act(async()=>{await new Promise(resolve=>actualSetTimeout(resolve,ms));}),until=async(predicate,message='Expected fixture condition')=>{for(let n=0;n<100&&!predicate();n++)await settle();assert.ok(predicate(),message);},button=name=>tree.root.findAllByType('button').find(row=>row.children.join('')===name),send=async(data,child=nodes.at(-1).contentWindow,from=origin)=>{await act(async()=>{await Promise.all([...events.get('message')??[]].map(fn=>fn({source:child,origin:from,data})));});};
const hello=(nonce='document')=>({channel:COMPONENT_CHANNEL,type:'hello',protocolVersion:'2.0',requestId:'hello-'+nonce,documentNonce:nonce,clientFeatures:['renderReadyV1','uiStateV1']}),packet=()=>{const {protocolVersion,sessionId,viewId,buildId,frameInstanceId}=posts.filter(row=>row.type==='hello').at(-1);return {protocolVersion,sessionId,viewId,buildId,frameInstanceId,channel:COMPONENT_CHANNEL};};
function Shell(){const [navigation,set]=useState();setNavigation=set;return <><AppsToolView sessionId='A' phase='result' block={{meta:{apps:{sessionId:'A',viewId:'V',publicationId:'P1',buildId:'preview-build',viewRevision:2}}}} sidebarRight={sidebar}/>{navigation?<AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible:true,actions:{openTab:sidebar.openTab}}})}/>:null}</>;}
const render=async()=>{await act(async()=>{tree=create(<Shell/>,{createNodeMock:nodeMock});});await until(()=>JSON.stringify(tree.toJSON()).includes('已准备好'));},click=async()=>{await act(async()=>button(displays.length?'重新打开组件 ↗':'打开组件 ↗').props.onClick());await until(()=>tree.root.findAllByType('iframe').length===1);};
try {
`;
const finish=`
}catch(error){failure=error instanceof Error?error.stack:String(error);}
finally{if(tree)await act(async()=>tree.unmount());for(const release of releases)release();await new Promise(resolve=>setTimeout(resolve,30));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));globalThis.fetch=actualFetch;assert.equal(mountedListeners.size,0);for(const rows of events.values())assert.equal(rows.size,0);for(const node of nodes)for(const rows of node.childEvents.values())assert.equal(rows.size,0);}
const portProbe=await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve({connected:true});});socket.once('error',error=>{socket.destroy();resolve({connected:false,code:error.code});});});assert.equal(portProbe.connected,false);
console.log(JSON.stringify({scope:'ISOLATED_PRODUCTION_REACT_HTTP_DISPLAY_FIXTURE',actualDesktop:false,actualRuntime:false,renderReadySimulated:true,idleClockEvidence,http,displays,grants,posts,iframeNodeCreations:nodes.length,cleanup:{listening:server.listening,mountedListeners:mountedListeners.size,messageListeners:[...events.values()].reduce((n,rows)=>n+rows.size,0),portProbe},failure},null,2));if(failure){console.error(failure);process.exitCode=1;}else console.log('DISPLAY_SURFACE_PASS');
`;

test('prepared original card waits without an iframe or writes, then an explicit click opens the exact preview build',()=>fixture('wait-click',setup+`
// Control only the idle clock. Requests still use the real loopback server and JSON body reads.
// Install before render so a regressed mount-time deadline cannot escape onto the wall clock.
const {mock}=await import('node:test'),originalClock={Date,setTimeout,clearTimeout,setInterval,clearInterval},originalFetch=fetch,startedAt=Date.now(),pendingRequests=new Map();
idleClockEvidence={apis:['Date','setTimeout','setInterval'],checkpoints:[],restored:false};
const track=(promise,label)=>{pendingRequests.set(promise,label);promise.then(()=>pendingRequests.delete(promise),()=>pendingRequests.delete(promise));return promise;};
const drainRequests=async()=>{
  const deadline=performance.now()+1500;let quietTurns=0;
  while(quietTurns<2){
    // Flush timers already due, including any queued while real I/O was settling.
    await act(async()=>{mock.timers.tick(0);await new Promise(resolve=>setImmediate(resolve));});
    assert.ok(performance.now()<deadline,'Real HTTP/React work must settle before advancing the idle clock: '+JSON.stringify([...pendingRequests.values()]));
    quietTurns=pendingRequests.size===0?quietTurns+1:0;
  }
};
try {
  globalThis.fetch=(...args)=>track(originalFetch(...args).then(response=>{const json=response.json.bind(response);response.json=(...args)=>track(json(...args),'json '+response.url);return response;}),'fetch '+args[0]);
  mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:startedAt});
  await render();
  // Advance every millisecond, including nested deadlines, and drain each triggered real request.
  // Keep the former 16.05-second idle window and let real HTTP and React work settle between ticks.
  for(let elapsed=1;elapsed<=16050;elapsed++){
    await act(async()=>mock.timers.tick(1));await drainRequests();
    if([15999,16000,16050].includes(elapsed))idleClockEvidence.checkpoints.push({elapsedMs:Date.now()-startedAt,opened,iframeNodeCreations:nodes.length,postCount:http.filter(row=>row.method==='POST').length,readyDeadlineAt:publication.readyDeadlineAt,pendingRequests:pendingRequests.size});
  }
  assert.equal(Date.now()-startedAt,16050);
  assert.equal(opened,0);assert.equal(nodes.length,0);assert.equal(http.some(row=>row.method==='POST'),false);assert.equal(publication.readyDeadlineAt,null);
} finally {
  mock.timers.reset();globalThis.fetch=originalFetch;
  for(const [name,original] of Object.entries(originalClock))assert.equal(globalThis[name],original,name+' must be restored before click or fixture cleanup');
  assert.equal(globalThis.fetch,originalFetch);idleClockEvidence.restored=true;
}
await click();assert.equal(opened,1);assert.equal(displays.length,1);assert.ok(tree.root.findByType('iframe').props.src.includes('preview-build/index.html'));assert.equal(http.some(row=>['startMount','failMount','authorizeFrame'].includes(row.body?.operation)),false);const frame=tree.root.findByType('iframe');await act(async()=>frame.props.onLoad());assert.equal(displays[0].state,'opening');assert.doesNotMatch(JSON.stringify(tree.toJSON()),/已展示/);await send(hello());assert.equal(grants.length,1);assert.equal(grants[0].displayId,displays[0].displayId);const identity=packet();await send({...identity,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'ready',params:{checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:[]}}});assert.equal(displays[0].state,'ready');assert.match(JSON.stringify(tree.toJSON()),/已展示/);
`+finish,30000));

test('ordinary session-list reopening of a committed source creates a new exact display before granting its document',()=>fixture('committed-list-reopen',setup+`
Object.assign(publication,{state:'mounted',committedViewRevision:3});Object.assign(snapshot,{viewRevision:3,pendingPublicationId:null,activeBuildId:source.buildId,validationStatus:'verified'});Object.assign(active,snapshot);
interceptRequest=({resource,reply})=>{if(resource!=='view')return false;reply(200,{...active,publication});return true;};
await act(async()=>{tree=create(<AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation:{params:{},revision:1},signal:controller.signal,visible:true,actions:{openTab:sidebar.openTab}}})}/>,{createNodeMock:nodeMock});});
const listOpen=()=>tree.root.findAllByType('button').find(node=>node.children.some(item=>item==='打开组件'));await until(listOpen);await act(async()=>listOpen().props.onClick());await until(()=>displays.length===1&&nodes.length===1);
assert.equal(http.filter(row=>row.body?.operation==='openDisplay').length,1);assert.equal(http.some(row=>row.body?.operation==='negotiateFrame'),false);assert.equal(displays[0].state,'opening');assert.equal(displays[0].readyAt,undefined);
await send(hello('committed-reopen'));assert.equal(grants.length,1);assert.equal(grants[0].publicationId,'P1');assert.equal(grants[0].displayId,displays[0].displayId);assert.equal(grants[0].buildId,source.buildId);assert.equal(grants[0].documentNonce,'committed-reopen');
const identity=packet();await send({...identity,method:'getContext',requestId:'committed-context',params:null});const context=posts.find(row=>row.requestId==='committed-context');assert.equal(context.result.publication.publicationId,'P1');assert.equal(context.result.display.displayId,displays[0].displayId);
await send({...identity,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'committed-ready',params:{documentNonce:'committed-reopen',checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:[]}}});assert.equal(displays[0].state,'ready');assert.equal(http.some(row=>['startMount','authorizeFrame'].includes(row.body?.operation)),false);
`+finish));

test('ordinary committed discovery rejects a mismatched owner, view, build, revision or terminal publication before any frame or open',()=>fixture('committed-list-reject',setup+`
Object.assign(publication,{state:'mounted',committedViewRevision:3});Object.assign(snapshot,{viewRevision:3,pendingPublicationId:null,activeBuildId:source.buildId,validationStatus:'verified'});Object.assign(active,snapshot);let supplied;
interceptRequest=({resource,reply})=>{if(resource!=='view')return false;reply(200,{...active,publication:supplied});return true;};
for(const changed of [{ownerSessionId:'B'},{viewId:'another-view'},{candidateBuildId:'another-build'},{committedViewRevision:2},{state:'cancelled'},{source:{...source,buildId:'another-build'}}]){
 supplied={...publication,...changed};await act(async()=>{tree=create(<AppsNativeView sessionId='A' viewId='V'/>,{createNodeMock:nodeMock});});await until(()=>/身份|原发布/.test(JSON.stringify(tree.toJSON())));assert.equal(tree.root.findAllByType('iframe').length,0);assert.equal(http.some(row=>row.body?.operation==='openDisplay'||row.body?.operation==='negotiateFrame'),false);await act(async()=>tree.unmount());tree=undefined;
}
`+finish));

test('source startup probes capabilities during the pending data read and reuses both results once',()=>fixture('performance-startup-overlap',setup+`
Object.assign(active,snapshot,{pendingPublicationId:null,validationStatus:'verified'});readyProbe=true;
let releaseData;interceptRequest=({resource,reply})=>{if(resource!=='viewData')return false;releaseData=()=>reply(200,dataFor());releases.push(releaseData);return true;};
await act(async()=>{tree=create(<AppsNativeView sessionId='A' viewId='V'/>,{createNodeMock:nodeMock});});
await until(()=>releaseData&&['hostCapabilities','componentFeatures'].every(resource=>http.some(row=>row.resource===resource)),'Both probes start before the data response');
assert.equal(nodes.length,0);assert.equal(http.some(row=>['negotiateFrame','authorizeFrame','authorizeDisplayFrame'].includes(row.body?.operation)),false);
releaseData();await until(()=>nodes.length===1);await send(hello('startup-overlap'));
for(const resource of ['viewData','hostCapabilities','componentFeatures'])assert.equal(http.filter(row=>row.resource===resource).length,1,resource+' must not be re-requested by the handler effect');
assert.equal(posts.filter(row=>row.type==='hello').at(-1).supportedMethods.includes('updateContext'),true);assert.equal(http.filter(row=>row.body?.operation==='negotiateFrame').length,1);
`+finish));

test('changing historical displays during startup discards the prior probes and keeps each data request pinned',()=>fixture('performance-startup-history',setup+`
const historical=new Map(['P1','P2'].map((id,index)=>{const buildId=index?'P2-build':'preview-build',sourceFor={...source,buildId},publicationFor={...publication,publicationId:id,candidateBuildId:buildId,source:sourceFor,state:'mounted',committedViewRevision:3},viewFor={...snapshot,source:sourceFor,viewRevision:3,pendingPublicationId:null,validationStatus:'verified'},displayFor={...publicationFor,buildId,displayId:'display-'+id,generation:index+1,state:'ready',view:viewFor,errors:[]};displays.push(displayFor);return [id,{publication:publicationFor,view:viewFor,display:displayFor}];}));
const reads=[],probeCount=new Map(),lateProbes=[];
interceptRequest=({query,body,resource,reply})=>{
 if(resource==='view'){const target=historical.get(query.get('publicationId'));assert.ok(target);reply(200,{...target.view,publication:target.publication});return true;}
 if(body?.operation==='inspect'){const target=historical.get(body.params.publicationId);assert.ok(target);reply(200,{publication:target.publication,latestDisplay:target.display,displays:[target.display]});return true;}
 if(resource==='viewData'){const target=historical.get(query.get('publicationId'));assert.ok(target);assert.equal(query.get('buildId'),target.display.buildId);assert.equal(query.get('displayId'),target.display.displayId);assert.equal(query.get('displayGeneration'),String(target.display.generation));const release=()=>reply(200,dataFor(target.display));reads.push(release);releases.push(release);return true;}
 if(resource==='hostCapabilities'||resource==='componentFeatures'){const count=(probeCount.get(resource)??0)+1;probeCount.set(resource,count);const value=resource==='componentFeatures'?{features:['renderReadyV1','uiStateV1']}:count===1?{adapterReady:false}:{adapterReady:true,nativeSessionAdapter:'dsh-0.2.0-rc.2',hostVersion:'0.2.0-rc.2',updateContext:true,requestAgent:true};const release=()=>reply(200,value);if(count===1)release();else {lateProbes.push(release);releases.push(release);}return true;}
 return false;
};
const draw=id=><AppsNativeView sessionId='A' viewId='V' expectedPublicationId={id} expectedBuildId={historical.get(id).display.buildId} expectedDisplayId={historical.get(id).display.displayId}/>;
await act(async()=>{tree=create(draw('P1'),{createNodeMock:nodeMock});});await until(()=>reads.length===1&&probeCount.get('componentFeatures')===1);assert.equal(nodes.length,0);
await act(async()=>tree.update(draw('P2')));await until(()=>reads.length===2&&lateProbes.length===2);reads[1]();reads[0]();await settle();assert.equal(nodes.length,0,'The new display waits for its own probes');
for(const release of lateProbes)release();await until(()=>nodes.length===1);assert.ok(tree.root.findByType('iframe').props.src.includes('P2-build'));
await send(hello('second-history'));assert.equal(grants.length,1);assert.equal(grants[0].publicationId,'P2');assert.equal(grants[0].displayId,'display-P2');assert.equal(grants[0].displayGeneration,2);assert.equal(posts.filter(row=>row.type==='hello').at(-1).supportedMethods.includes('updateContext'),true);
for(const resource of ['hostCapabilities','componentFeatures'])assert.equal(probeCount.get(resource),2);assert.equal(http.some(row=>row.body?.operation==='openDisplay'||row.body?.operation==='reportDisplayError'),false);
`+finish));

test('hiding an unfinished source startup cancels its preparation and resumes with fresh probes',()=>fixture('performance-startup-hidden',setup+`
Object.assign(active,snapshot,{pendingPublicationId:null,validationStatus:'verified'});const reads=[];
interceptRequest=({resource,reply})=>{if(resource!=='viewData')return false;const release=()=>reply(200,dataFor());reads.push(release);releases.push(release);return true;};
const draw=visible=><AppsNativeView sessionId='A' viewId='V' active={visible}/>;
await act(async()=>{tree=create(draw(true),{createNodeMock:nodeMock});});await until(()=>reads.length===1&&http.some(row=>row.resource==='componentFeatures'));
await act(async()=>tree.update(draw(false)));reads[0]();await settle();assert.equal(nodes.length,0);assert.equal(http.some(row=>row.body?.operation==='reportDisplayError'),false);
await act(async()=>tree.update(draw(true)));await until(()=>reads.length===2&&http.filter(row=>row.resource==='componentFeatures').length===2);reads[1]();await until(()=>nodes.length===1);
for(const resource of ['hostCapabilities','componentFeatures'])assert.equal(http.filter(row=>row.resource===resource).length,2);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/AbortError|aborted/);
`+finish));

test('a real authorization HTTP failure is recorded and another click opens a new document generation from the same archive',()=>fixture('auth-reopen',setup+`
await render();await click();authError=true;await send(hello('failed-doc'));await until(()=>http.some(row=>row.body?.operation==='reportDisplayError'));assert.equal(displays[0].state,'failed');assert.match(JSON.stringify(tree.toJSON()),/data permission denied/);assert.ok(button('重试'));const oldId=displays[0].displayId;authError=false;await click();assert.equal(displays.length,2);assert.notEqual(displays[1].displayId,oldId);assert.equal(displays[1].generation,2);assert.equal(nodes.length,2);await send(hello('fresh-doc'));assert.equal(grants.length,2);assert.notEqual(grants[0].frameInstanceId,grants[1].frameInstanceId);assert.equal(http.filter(row=>row.body?.operation==='openDisplay').length,2);assert.equal(http.some(row=>row.body?.operation==='startMount'||row.body?.operation==='failMount'),false);
`+finish));

test('saving the confirmed display updates its mounted header without remounting and stale save receipts cannot replace a newer view',()=>fixture('saved-display-header',setup+`
await act(async()=>{tree=create(<><AppsNativeView sessionId='A' viewId='V'/><AppsSaveControls sessionId='A' viewId='V'/></>,{createNodeMock:nodeMock});});await until(()=>tree.root.findAllByType('iframe').length===1);await send(hello());
Object.assign(snapshot,{viewRevision:3,validationStatus:'verified',pendingPublicationId:null});Object.assign(active,snapshot);const identity=packet(),ready={...identity,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'ready-before-save',params:{checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:[]}}};await send(ready);await until(()=>button('保存到组件库')?.props.disabled===false);
const nodeText=node=>typeof node==='string'?node:node.type==='style'?'':node.children.map(nodeText).join(''),native=()=>nodeText(tree.root.findByType(AppsNativeView)),beforeNodes=nodes.length,beforeGrants=grants.length;
await act(async()=>tree.root.findByProps({'aria-label':'保存组件名称'}).props.onChange({target:{value:'在售商品采购成本与利润率'}}));await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await until(()=>JSON.stringify(tree.toJSON()).includes('已明确保存'));
assert.match(native(),/已保存到组件库 · 版本 1/);assert.doesNotMatch(native(),/尚未保存/);assert.equal(nodes.length,beforeNodes);assert.equal(grants.length,beforeGrants);
const saved=http.find(row=>row.body?.capabilityId==='apps.authoring.save_component').response.data;assert.equal(saved.view.viewRevision,3);await send({...ready,requestId:'ready-after-save'});assert.match(native(),/已保存到组件库 · 版本 1/);
Object.assign(active,{viewRevision:4,title:'新视图版本四',pendingPublicationId:null});await act(async()=>button('重新读取').props.onClick());await until(()=>native().includes('新视图版本四'));assert.doesNotMatch(native(),/已保存到组件库/);
await act(async()=>window.dispatchEvent(new CustomEvent('apps-library-changed',{detail:{sessionId:'A',viewId:'V',component:saved}})));assert.match(native(),/新视图版本四/);assert.doesNotMatch(native(),/已保存到组件库/);
await act(async()=>window.dispatchEvent(new CustomEvent('apps-library-changed',{detail:{sessionId:'A',viewId:'V',component:{...saved,revision:2,view:{...active},title:'版本四已保存'}}})));assert.match(native(),/已保存到组件库 · 版本 2/);
await act(async()=>window.dispatchEvent(new CustomEvent('apps-library-changed',{detail:{sessionId:'B',viewId:'V',component:{...saved,revision:99,view:{...active,ownerSessionId:'B'}}}})));assert.match(native(),/已保存到组件库 · 版本 2/);assert.match(native(),/新视图版本四/);
`+finish));

test('a current frame refresh updates only outer data times from its response and ignores failed or old-owner responses',()=>fixture('refresh-data-times',setup+`
const bindingAt=(sourceDataTime,lastSuccessAt)=>({bindingId:'products',datasetId:'fixture',appId:'hallmark',connectionId:'fixture',payload:{},resources:[],state:'ready',freshness:'fresh',revision:'1',provenance:[],sourceDataTime,lastSuccessAt}),oldSource='2026-10-08T10:40:00Z',oldRead='2026-10-08T10:41:00Z',nextSource='2026-10-08T11:13:00Z',nextRead='2026-10-08T11:13:15Z';viewBinding=bindingAt(oldSource,oldRead);
await act(async()=>{tree=create(<AppsNativeView sessionId='A' viewId='V' isCurrentOwner={()=>owner==='A'}/>,{createNodeMock:nodeMock});});await until(()=>tree.root.findAllByType('iframe').length===1);await send(hello());const identity=packet(),nodeText=node=>typeof node==='string'?node:node.children.map(nodeText).join(''),times=()=>nodeText(tree.root.findByProps({className:'apps-component-times'}));assert.ok(times().includes(appsDisplayTime(oldSource)));assert.ok(times().includes(appsDisplayTime(oldRead)));
const beforeNodes=nodes.length,beforeGrants=grants.length,beforeReads=http.filter(row=>row.resource==='view'||row.resource==='viewData').length,beforeDataEvents=posts.filter(row=>row.event==='data').length;refreshPayload={viewId:'V',bindings:[bindingAt(nextSource,nextRead)]};await send({...identity,requestId:'refresh-current',method:'refresh',params:null});assert.ok(times().includes(appsDisplayTime(nextSource)));assert.ok(times().includes(appsDisplayTime(nextRead)));assert.equal(nodes.length,beforeNodes);assert.equal(grants.length,beforeGrants);assert.equal(http.filter(row=>row.resource==='view'||row.resource==='viewData').length,beforeReads);assert.equal(posts.filter(row=>row.event==='data').length,beforeDataEvents,'outer metadata must not resend binding data to the iframe');
const confirmedTimes=times();failRefresh=true;await send({...identity,requestId:'refresh-failed',method:'refresh',params:null});assert.equal(times(),confirmedTimes);assert.equal(posts.at(-1).error.code,'DATA_UNAVAILABLE');failRefresh=false;holdRefresh=true;refreshPayload={viewId:'V',bindings:[bindingAt('2026-10-08T12:00:00Z','2026-10-08T12:00:05Z')]};
const pendingRefresh=(frame,id)=>Promise.all([...events.get('message')??[]].map(fn=>fn({source:nodes.at(-1).contentWindow,origin,data:{...frame,requestId:id,method:'refresh',params:null}}))),oldFrame=pendingRefresh(identity,'refresh-old-frame');await until(()=>releases.length===1);await send(hello('replacement-doc'));await act(async()=>{releases.shift()();await oldFrame;});assert.equal(times(),confirmedTimes);assert.equal(nodes.length,beforeNodes);assert.equal(grants.length,beforeGrants+1,'only the explicit replacement handshake reauthorizes');
const late=pendingRefresh(packet(),'refresh-old-owner');await until(()=>releases.length===1);owner='B';await act(async()=>{releases.shift()();await late;});owner='A';assert.equal(times(),confirmedTimes);assert.equal(nodes.length,beforeNodes);assert.equal(grants.length,beforeGrants+1);assert.equal(http.filter(row=>row.resource==='view'||row.resource==='viewData').length,beforeReads);
`+finish));

test('an iframe error preserves a reopen button and its stage/code/message for Agent inspection',()=>fixture('iframe-error',setup+`
await render();await click();await act(async()=>tree.root.findByType('iframe').props.onError());await until(()=>http.some(row=>row.body?.operation==='reportDisplayError'));const report=http.find(row=>row.body?.operation==='reportDisplayError').body.params;assert.equal(report.error.phase,'iframe');assert.equal(report.error.code,'DISPLAY_DOCUMENT_LOAD_FAILED');assert.match(report.error.message,/could not be loaded/);assert.equal(displays[0].errors.length,1);assert.equal(tree.root.findAllByType('iframe').length,0);assert.ok(button('重试'));assert.equal(publication.state,'prepared');
`+finish));

test('ordinary handled business failures do not become display failures or cause writes or automatic retries',()=>fixture('business-failure',setup+`
await render();await click();await send(hello());const identity=packet();await send({...identity,requestId:'invalid-user-action',method:'invokeCapability',params:{capabilityId:'fixture.read'}});assert.equal(posts.at(-1).error.code,'INVALID_INPUT');assert.equal(displays[0].state,'opening');assert.equal(http.filter(row=>row.body?.operation==='reportDisplayError').length,0);assert.equal(http.filter(row=>row.body?.action==='componentBridge').length,1);assert.equal(http.filter(row=>row.body?.operation==='openDisplay').length,1);assert.equal(nodes.length,1);
`+finish));

test('fatal diagnostics are bound to the current iframe origin, nonce and full bridge identity',()=>fixture('fatal-identity',setup+`
await render();await click();await send(hello('owned-doc'));const identity=packet(),error={phase:'script',code:'COMPONENT_SCRIPT_ERROR',message:'actual component throw'};await send({...identity,type:'display-error',documentNonce:'owned-doc',error},{postMessage(){} });await send({...identity,type:'display-error',documentNonce:'owned-doc',error},nodes.at(-1).contentWindow,'http://foreign');await send({...identity,type:'display-error',documentNonce:'old-doc',error});await send({...identity,type:'display-error',documentNonce:'owned-doc',frameInstanceId:'foreign-frame',error});assert.equal(http.some(row=>row.body?.operation==='reportDisplayError'),false);await send({...identity,type:'display-error',documentNonce:'owned-doc',error});await until(()=>displays[0].state==='failed');assert.deepEqual(displays[0].errors[0],error);
`+finish));

test('a lost open response inspects this same click id without repeating a mutation or selecting another publication',()=>fixture('lost-open',setup+`
lostOpen=true;await render();await click();assert.equal(displays.length,1);assert.equal(http.filter(row=>row.body?.operation==='openDisplay').length,1);assert.equal(http.filter(row=>row.body?.operation==='inspect').length>=1,true);assert.ok(http.filter(row=>row.body?.operation==='inspect').every(row=>row.body.params.publicationId==='P1'));assert.equal(opened,1);assert.equal(tree.root.findAllByType('iframe').length,1);
`+finish));

test('late display creation cannot navigate after native owner changes even before a subscription rerender',()=>fixture('owner-late-open',setup+`
holdOpen=true;await render();let opening;await act(async()=>{opening=button('打开组件 ↗').props.onClick();});await until(()=>releases.length===1);owner='B';await act(async()=>releases.shift()());await settle();assert.equal(opened,0);assert.equal(nodes.length,0);assert.equal(http.some(row=>row.body?.operation==='authorizeDisplayFrame'),false);assert.match(JSON.stringify(tree.toJSON()),/会话已切换/);
`+finish));

test('a visible prepared pane automatically displays once and reuses its display on reread',()=>fixture('pane-auto',setup+`
await act(async()=>{tree=create(<AppsNativeView sessionId='A' viewId='V' expectedPublicationId='P1' isCurrentOwner={()=>owner==='A'}/>,{createNodeMock:nodeMock});});
await until(()=>nodes.length===1);assert.equal(displays.length,1);assert.equal(button('打开组件'),undefined);
await act(async()=>button('重新读取').props.onClick());await settle(100);assert.equal(displays.length,1);assert.equal(nodes.length,1);
`+finish));

test('retained native source panes suspend hidden reads, resume the same frame, and release it only on eviction',()=>fixture('performance-retained-source',setup+`
const draw=active=><AppsNativeView sessionId='A' viewId='V' expectedPublicationId='P1' active={active} isCurrentOwner={()=>owner==='A'}/>;
await act(async()=>{tree=create(draw(true),{createNodeMock:nodeMock});});await until(()=>nodes.length===1);await send(hello('retained-doc'));const identity=packet();
Object.assign(active,snapshot);await send({...identity,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'retained-ready',params:{checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:[]}}});
const frame=tree.root.findByType('iframe'),beforeReads=http.filter(row=>row.resource==='viewData').length,beforeRetires=http.filter(row=>row.body?.operation==='retireFrame').length;
await act(async()=>tree.update(draw(false)));assert.equal(tree.root.findByType('iframe'),frame);assert.equal(nodes.length,1);assert.equal(grants.length,1);assert.equal(http.filter(row=>row.body?.operation==='retireFrame').length,beforeRetires);assert.equal(posts.filter(row=>row.type==='visibility').at(-1).visible,false);
const hiddenRequests=http.length;await send({...identity,requestId:'hidden-refresh',method:'refresh',params:null});assert.equal(http.length,hiddenRequests);assert.equal(posts.at(-1).error.code,'BRIDGE_PAUSED');await settle(80);assert.equal(http.length,hiddenRequests);
await act(async()=>tree.update(draw(true)));await until(()=>http.some(row=>row.body?.operation==='inspect'));await settle(40);assert.equal(tree.root.findByType('iframe'),frame);assert.equal(nodes.length,1);assert.equal(grants.length,1);assert.equal(displays.length,1);assert.equal(http.filter(row=>row.resource==='viewData').length,beforeReads,'resume verifies ownership and display, retaining the unchanged binding snapshot');assert.equal(posts.filter(row=>row.type==='visibility').at(-1).visible,true);
await send({...identity,requestId:'visible-refresh',method:'refresh',params:null});assert.ok(http.some(row=>row.body?.request?.requestId==='visible-refresh'));await act(async()=>tree.unmount());tree=undefined;await until(()=>http.filter(row=>row.body?.operation==='retireFrame').length===beforeRetires+1);console.log(JSON.stringify({scope:'single_pane_hide_and_resume',beforeSamePaneIframeCreations:2,afterSamePaneIframeCreations:nodes.length,grants:grants.length,resumeFullDataReads:http.filter(row=>row.resource==='viewData').length-beforeReads}));
`+finish));

test('a newly prepared component automatically opens the right pane without a click',()=>fixture('discover-auto',setup+`
function Automatic(){const [navigation,set]=useState();setNavigation=set;return <><NativePublicationObserver sidebarRight={sidebar}/>{navigation?<AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible:true,actions:{openTab:sidebar.openTab}}})}/>:null}</>;}
await act(async()=>{tree=create(<Automatic/>,{createNodeMock:nodeMock});});await until(()=>nodes.length===1);assert.equal(opened,1);assert.equal(displays.length,1);await settle(3200);assert.equal(opened,1);assert.equal(displays.length,1);
`+finish));

test('closed work copies do not auto-open and native navigation restores them only after an explicit click',()=>fixture('closed-panel-restore',setup+`
active.panelState='closed';active.closedAt='2026-10-09T00:00:00Z';let navigation={params:{viewId:'V',publicationId:'P1'},revision:1};
await act(async()=>{tree=create(<><NativePublicationObserver sidebarRight={sidebar}/><AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible:true,actions:{openTab(){}}}})}/></>,{createNodeMock:nodeMock});});await until(()=>!!button('恢复工作副本'));await settle(100);assert.equal(opened,0);assert.equal(nodes.length,0);assert.equal(http.some(row=>row.method==='POST'),false);
await act(async()=>button('恢复工作副本').props.onClick());await until(()=>nodes.length===1);assert.equal(active.panelState,'open');assert.equal(http.filter(row=>row.body?.operation==='restoreView').length,1);assert.equal(displays.length,1);
active.panelState='closed';await act(async()=>window.dispatchEvent(new CustomEvent('hallmark-view-updated',{detail:{sessionId:'A'}})));await until(()=>!!button('恢复工作副本'));assert.equal(tree.root.findAllByType('iframe').length,0,'closing on another surface stops the current panel');assert.equal(displays.length,1);
`+finish));

test('permission-denied catalogue never falls back to the legacy read path',()=>fixture('catalog-owner',setup+`
catalogError=true;let navigation={params:{viewId:'V',publicationId:'P1'},revision:1};await act(async()=>{tree=create(<AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible:true,actions:{openTab(){}}}})}/>,{createNodeMock:nodeMock});});await until(()=>JSON.stringify(tree.toJSON()).includes('owner denied'));assert.equal(nodes.length,0);assert.equal(http.some(row=>row.path.startsWith('/api/hallmark-app')),false);
`+finish));

test('historical candidate lease protocol remains available without controlling the new display path',()=>{
  // Kept only for compatibility with old publication clients.
  return fixture('legacy-lease',setup+`const leases=new CandidateFrameLease(),first={},second={};leases.acquire('P',first);leases.authorize('P',first);leases.settle('P');leases.acquire('P',second);assert.equal(leases.owns('P',second),false);assert.equal(http.length,0);`+finish);
});
test('opening historical P1 while P2 is active loads the P1 snapshot and never substitutes P2 source or parent context',()=>fixture('history-snapshot',setup+`
publication.state='mounted';publication.committedViewRevision=3;active.source={...source,buildId:'P2-build'};active.viewRevision=4;active.pendingPublicationId='P2';await act(async()=>{tree=create(<Shell/>,{createNodeMock:nodeMock});});await until(()=>!!button('打开组件 ↗'));await settle();assert.equal(nodes.length,0);await click();assert.ok(tree.root.findByType('iframe').props.src.includes('preview-build'));assert.equal(tree.root.findByType('iframe').props.src.includes('P2-build'),false);assert.equal(displays[0].view.source.buildId,'preview-build');const read=http.find(row=>row.resource==='viewData'&&row.path.includes('displayId='));assert.ok(read);assert.equal(read.response.snapshotBuild,'preview-build');await send(hello('historical-doc'));const identity=packet();await send({...identity,requestId:'context',method:'getContext',params:null});assert.equal(posts.at(-1).result.publication.publicationId,'P1');assert.equal(posts.at(-1).result.display.displayId,displays[0].displayId);assert.equal(posts.filter(row=>row.event==='context').length,0);
`+finish));

test('a failed display reopened from native navigation skips its revoked data grant and still offers a fresh open',()=>fixture('failed-navigation',setup+`
const display={...publication,buildId:source.buildId,displayId:'failed-open',generation:1,state:'failed',view:snapshot,errors:[{phase:'script',code:'ACTUAL_ERROR',message:'stored actual display failure'}]};displays.push(display);let navigation={params:{viewId:'V',publicationId:'P1',displayId:'failed-open'},revision:1};await act(async()=>{tree=create(<AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible:true,actions:{openTab(){}}}})}/>,{createNodeMock:nodeMock});});await until(()=>!!button('重试'));assert.match(JSON.stringify(tree.toJSON()),/stored actual display failure/);assert.equal(nodes.length,0);assert.equal(http.some(row=>row.resource==='viewData'),false);await act(async()=>button('重试').props.onClick());await until(()=>nodes.length===1);assert.equal(displays.length,2);assert.notEqual(displays[1].displayId,'failed-open');assert.equal(tree.root.findByType('iframe').props.src.includes('preview-build'),true);
`+finish));
test('a preview archive using the legacy SDK can report actual script failure through the parent window observer',()=>fixture('legacy-window-error',setup+`
await render();await click();await send(hello('legacy-doc'));await act(async()=>tree.root.findByType('iframe').props.onLoad());const node=nodes.at(-1);assert.equal(node.childEvents.get('error').size,1);await act(async()=>{for(const listener of node.childEvents.get('error'))listener({type:'error',message:'legacy archive uncaught script error'});});await until(()=>displays[0].state==='failed');assert.equal(displays[0].errors[0].phase,'script');assert.equal(displays[0].errors[0].message,'legacy archive uncaught script error');assert.equal(http.filter(row=>row.body?.operation==='openDisplay').length,1);
`+finish));

test('a legacy SDK initial getData failure is recorded by the parent proxy with its actual backend code',()=>fixture('legacy-data-error',setup+`
await render();await click();await send(hello('legacy-doc'));failInitialData=true;const identity=packet();await send({...identity,requestId:'initial-data',method:'getData',params:null});await until(()=>displays[0].state==='failed');assert.equal(displays[0].errors[0].phase,'data');assert.equal(displays[0].errors[0].code,'DATA_UNAVAILABLE');assert.equal(displays[0].errors[0].message,'actual initial dataset unavailable');assert.equal(http.filter(row=>row.body?.action==='componentBridge').length,1);
`+finish));
test('SDK 16 UI-state calls receive only their authorized document nonce while explicitly wrong nonces remain rejected',()=>fixture('legacy-state-nonce',setup+`
await render();await click();await send(hello('legacy-doc'));const identity=packet();await send({...identity,type:'extension',feature:'uiStateV1',action:'read',requestId:'old-read',params:{uiStateSchemaVersion:1}});await send({...identity,type:'extension',feature:'uiStateV1',action:'write',requestId:'old-write',params:{uiStateSchemaVersion:1,expectedStateRevision:0,value:{},selectionEvidence:[]}});const requests=http.filter(row=>row.body?.action==='componentExtension');assert.equal(requests.length,2);assert.ok(requests.every(row=>row.body.request.params.documentNonce==='legacy-doc'));assert.equal(displays[0].state,'opening');await send({...identity,type:'extension',feature:'uiStateV1',action:'read',requestId:'wrong-read',params:{uiStateSchemaVersion:1,documentNonce:'wrong-doc'}});assert.equal(http.filter(row=>row.body?.action==='componentExtension').at(-1).body.request.params.documentNonce,'wrong-doc');assert.equal(posts.at(-1).error.code,'FRAME_IDENTITY_STALE');assert.equal(http.some(row=>row.body?.operation==='reportDisplayError'),false);
`+finish));

test('an established old iframe loses all bridge, extension and error authority when owner changes without rerender',()=>fixture('established-owner-switch',setup+`
readyProbe=true;await render();await click();await send(hello('old-doc'));const identity=packet(),before=http.length;owner='B';for(const method of ['getData','getContext','refresh','invokeCapability','updateContext','requestAgent','attachSelection'])await send({...identity,requestId:'stale-'+method,method,params:null});await send({...identity,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'stale-ready',params:{documentNonce:'old-doc',checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:[]}}});await send({...identity,type:'extension',feature:'uiStateV1',action:'read',requestId:'stale-state',params:{uiStateSchemaVersion:1}});await send({...identity,type:'display-error',documentNonce:'old-doc',error:{phase:'script',code:'OLD_SCRIPT',message:'obsolete document error'}});await settle();assert.equal(http.length,before);assert.equal(displays[0].state,'opening');assert.equal(nodes.length,1);assert.equal(opened,1);assert.equal(posts.filter(row=>row.error?.code==='BRIDGE_CLOSED').length>=9,true);assert.equal(http.some(row=>row.body?.action==='componentBridge'||row.body?.action==='componentExtension'||row.body?.operation==='reportDisplayError'),false);
`+finish));
test('an in-pane reopen survives hiding and reshowing the tab: the pane reads the newest display instead of its stale navigation id',()=>fixture('remount-latest',setup+`
let setVisible;
function Panel(){const [navigation,set]=useState(),[visible,show]=useState(true);setNavigation=set;setVisible=show;return <><AppsToolView sessionId='A' phase='result' block={{meta:{apps:{sessionId:'A',viewId:'V',publicationId:'P1',buildId:'preview-build',viewRevision:2}}}} sidebarRight={sidebar}/>{navigation?<AppsSidebarPane sessionId='A' sidebarRight={sidebar} useTabInfo={()=>({tab:{navigation,signal:controller.signal,visible,actions:{openTab:sidebar.openTab}}})}/>:null}</>;}
await act(async()=>{tree=create(<Panel/>,{createNodeMock:nodeMock});});await until(()=>JSON.stringify(tree.toJSON()).includes('已准备好'));
await click();const first=displays[0].displayId;assert.equal(opened,1);
await act(async()=>tree.root.findByType('iframe').props.onError());await until(()=>!!button('重试'));await act(async()=>button('重试').props.onClick());await until(()=>displays.length===2&&nodes.length===2,'The in-pane reopen creates a second display and a new iframe');
const second=displays[1].displayId;assert.notEqual(first,second);assert.equal(opened,1,'The in-pane reopen does not rewrite native navigation');
await act(async()=>setVisible(false));await until(()=>tree.root.findAllByType('iframe').length===0,'A hidden tab unmounts its iframe');
await act(async()=>setVisible(true));await until(()=>tree.root.findAllByType('iframe').length===1,'The reshown pane must load the newest display');
assert.equal(displays.length,2,'Reshowing must not open another display');assert.doesNotMatch(JSON.stringify(tree.toJSON()),/已被新的打开操作替换/);
const reads=http.filter(row=>row.resource==='viewData'&&row.path.includes('displayId='));assert.ok(reads.at(-1).path.includes('displayId='+second),'The reshown pane reads the newest display data');
`+finish,30000));

test('a display whose data cannot be read is reported with the Runtime evidence, and a report the Runtime missed is retried from the outbox',()=>fixture('data-failure-outbox',setup+`
const docEvents=new Map();globalThis.document={hidden:false,addEventListener(type,fn){const rows=docEvents.get(type)??new Set();rows.add(fn);docEvents.set(type,rows);},removeEventListener(type,fn){docEvents.get(type)?.delete(fn);}};
let reportAttempts=0,releaseFirstReport,firstReportReleased=false;
interceptRequest=({query,body,resource,reply})=>{
 if(resource==='viewData'&&query.has('displayId')){reply(503,{status:'failed',error:{code:'RUNTIME_STORE_BUSY',message:'数据库繁忙',retryPolicy:'read_retry',details:{requestId:'srv-req',cause:'database is locked'}}});return true;}
 if(body?.operation==='reportDisplayError'){reportAttempts++;if(reportAttempts===1){releaseFirstReport=()=>{if(firstReportReleased)return;firstReportReleased=true;reply(503,{status:'failed',error:{code:'RUNTIME_UNAVAILABLE',message:'runtime down',retryPolicy:'read_retry'}});};releases.push(releaseFirstReport);return true;}}
 return false;};
const reports=()=>http.filter(row=>row.body?.operation==='reportDisplayError'),viewDataReads=()=>http.filter(row=>row.resource==='viewData'&&row.path.includes('displayId='));
const waitFor=async(predicate,message)=>{for(let n=0;n<400&&!predicate();n++)await settle(15);assert.ok(predicate(),message);};
await render();await act(async()=>button('打开组件 ↗').props.onClick());
await waitFor(()=>reports().length>=1,'the parent-side data failure reaches reportDisplayError');
assert.equal(viewDataReads().length,3,'a transient read is retried inside the budget before it is called a failure');
const first=reports()[0].body.params;
assert.equal(first.displayId,displays[0].displayId);assert.equal(first.displayGeneration,displays[0].generation);
assert.deepEqual(first.error,{phase:'data',code:'RUNTIME_STORE_BUSY',message:'数据库繁忙',requestId:'srv-req',retryPolicy:'read_retry',cause:'database is locked',attempts:3});
assert.equal(displays[0].state,'opening','a missed report leaves the Runtime display unreported');
assert.doesNotMatch(JSON.stringify(tree.toJSON()),/加载错误尚未同步给 Runtime/,'request receipt alone does not complete the report or update the notice');
await act(async()=>{releaseFirstReport();});
// Server receipt precedes fetch rejection and the React notice update. Wait for
// that observable failed-report state before asking the outbox to retry it.
await waitFor(()=>JSON.stringify(tree.toJSON()).includes('加载错误尚未同步给 Runtime'),'a failed report must render the unsynchronized Runtime notice before retry');
assert.equal(reportAttempts,1);assert.match(JSON.stringify(tree.toJSON()),/加载错误尚未同步给 Runtime/);
for(const listener of [...(docEvents.get('visibilitychange')??[])])listener();
await waitFor(()=>reports().length===2,'the outbox sends the missed report again once the document is visible');
assert.deepEqual(reports()[1].body.params,first);assert.equal(displays[0].state,'failed');assert.equal(displays[0].errors.length,1);
// Delivered reports leave the outbox: another visibility change sends nothing.
for(const listener of [...(docEvents.get('visibilitychange')??[])])listener();await settle(50);assert.equal(reports().length,2);
delete globalThis.document;
`+finish,30000));

test('Runtime healthy automatically reopens a failed read display once, with fresh frame/ready and unchanged publication/build',()=>fixture('runtime-recovery-once',setup+`
let health='down';interceptRequest=({resource,reply})=>{if(resource==='runtimeHealth'){reply(200,{state:health,restart:{enabled:true,restarting:health==='down'}});return true;}return false;};
await render();await click();await send(hello('lost-doc'));const old=packet(),oldChild=nodes.at(-1).contentWindow,oldDisplay=displays[0].displayId;
await send({...old,type:'display-error',documentNonce:'lost-doc',error:{phase:'context',code:'RUNTIME_CONNECTION_LOST',message:'connection lost',retryPolicy:'read_retry',attempts:3}});
await until(()=>displays[0].state==='failed');assert.equal(displays.length,1);await settle(50);health='healthy';
for(let n=0;n<160&&displays.length<2;n++)await settle();assert.equal(displays.length,2,'the Host monitor healthy state automatically reopens without a retry click');
await until(()=>tree.root.findAllByType('iframe').length===1);assert.notEqual(displays[1].displayId,oldDisplay);assert.equal(displays[1].generation,2);assert.equal(displays[1].publicationId,'P1');assert.equal(displays[1].buildId,'preview-build');assert.equal(displays[1].state,'opening');
const writesBefore=http.filter(row=>row.body?.action==='componentExtension').length;
await send({...old,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'obsolete-ready',params:{}},oldChild);
assert.equal(http.filter(row=>row.body?.action==='componentExtension').length,writesBefore,'the retired iframe cannot reuse an old ready receipt');
await send(hello('recovered-doc'));const fresh=packet();assert.notEqual(fresh.frameInstanceId,old.frameInstanceId);
await send({...fresh,type:'extension',feature:'renderReadyV1',action:'ready',requestId:'fresh-ready',params:{checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:[]}}});await until(()=>displays[1].state==='ready');
await settle(1200);assert.equal(displays.length,2,'one fault cycle cannot trigger a reopen loop');assert.equal(opened,1,'no extra manual/sidebar navigation action');
assert.equal(http.some(row=>row.body?.capabilityId||['publish','build','preview'].includes(row.body?.operation)||row.body?.request?.method==='invokeCapability'),false,'recovery never rebuilds, republishes or replays a business mutation');
`+finish,15000));
