import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
async function fixture(label:string,body:string){
 mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync(resolve('artifacts/sdk-display-error-'+label+'-')),entry=join(directory,'fixture.mjs');const contents=setup.replace('/* CONTROLLED_CLOCK */',String(label.startsWith('preparing-'))).replace('/* TRANSFER_HANDLER */',label.includes('transfer')?"dataTransferV1:request=>transfers.prepare('fixture',readData(),request.params.knownRevision),":'')+body+finish;
 writeFileSync(join(directory,'fixture.tsx'),contents,{flag:'wx'});await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024});writeFileSync(join(directory,'stdout.txt'),result.stdout??'',{flag:'wx'});writeFileSync(join(directory,'stderr.txt'),result.stderr??'',{flag:'wx'});writeFileSync(join(directory,'command.json'),JSON.stringify({label,command:[process.execPath,entry],exitCode:result.status,error:result.error?.message??null,scope:'ISOLATED_PRODUCTION_REACT_COMPONENT_HOST',actualDesktop:false,actualRuntime:false},null,2)+'\n',{flag:'wx'});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/SDK_DISPLAY_ERRORS_PASS/);
}
const setup=`
import {mock} from 'node:test';import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';import {useApps} from './packages/component-runtime/src/apps-react.tsx';import {ComponentHost} from './packages/component-runtime/src/host.ts';import {ComponentBridgeError,COMPONENT_CHANNEL} from './packages/component-runtime/src/apps-client.ts';import {DataTransfers} from './packages/app-presentation/src/data-transfers.ts';
// Only preparing fixtures advance the real production timers inside this isolated child.
const controlledClock=/* CONTROLLED_CLOCK */,realTimers={setTimeout,clearTimeout,Date};if(controlledClock)mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const events=new Map(),messages=[],readyRequests=[],identity={protocolVersion:'2.0',sessionId:'A',viewId:'V',buildId:'same-preview',frameInstanceId:'F'},origin='http://sdk.fixture';let failData=false,failReady=false,failFailure,failUntil=0,dataCalls=0,dataResult,hookOptions={},app,tree,failure;
const transfers=new DataTransfers(),readData=()=>{dataCalls++;if(failData&&(!failUntil||dataCalls<=failUntil))throw failFailure?new ComponentBridgeError(failFailure):Object.assign(Error('initial data unavailable'),{code:'DATA_UNAVAILABLE'});return typeof dataResult==='function'?dataResult():dataResult??{bindings:[]};};
const host=new ComponentHost(identity,{getData:readData,getContext:()=>({publication:{publicationId:'P1',attemptId:'attempt',attemptEpoch:1},display:{displayId:'display-one',generation:1}}),invokeCapability:()=>{throw new ComponentBridgeError({code:'INVALID_INPUT',message:'ordinary user input validation',retryPolicy:'never'});}},{extensionHandlers:{/* TRANSFER_HANDLER */renderReadyV1:request=>{readyRequests.push(request);if(failReady)throw Object.assign(Error('actual readiness failed'),{code:'DISPLAY_READY_FAILED'});return {display:{displayId:'display-one',state:'ready'}};}}});
const parent={postMessage(message,target){assert.equal(target,origin);messages.push(message);if(message.type==='display-error')return;void Promise.resolve(host.handle(message)).then(response=>{if(response)for(const listener of events.get('message')??[])listener({source:parent,origin,data:response});});}},child={location:{origin},parent,addEventListener(type,listener){const rows=events.get(type)??new Set();rows.add(listener);events.set(type,rows);},removeEventListener(type,listener){events.get(type)?.delete(listener);}};globalThis.window=child;
function Component(){app=useApps(hookOptions);return <p>{app.loading?'loading':app.error?.message??'rendered'}</p>;}
const settle=(ms=10)=>act(async()=>{if(controlledClock)mock.timers.tick(ms);else await new Promise(resolve=>setTimeout(resolve,ms));}),until=async(predicate)=>{for(let n=0;n<100&&!predicate();n++)await settle();assert.ok(predicate());},diagnostics=()=>messages.filter(row=>row.type==='display-error'),render=async()=>{await act(async()=>{tree=create(<Component/>);});};
try {
`;
const finish=`
}catch(error){failure=error instanceof Error?error.stack:String(error);}finally{try{if(tree)await act(async()=>tree.unmount());host.dispose();for(const rows of events.values())assert.equal(rows.size,0);}finally{if(controlledClock)mock.timers.reset();assert.equal(setTimeout,realTimers.setTimeout);assert.equal(clearTimeout,realTimers.clearTimeout);assert.equal(Date,realTimers.Date);}}
console.log(JSON.stringify({scope:'ISOLATED_PRODUCTION_REACT_COMPONENT_HOST',actualDesktop:false,actualRuntime:false,messages,dataCalls,readyRequests,cleanup:{listenerCount:[...events.values()].reduce((n,rows)=>n+rows.size,0)},failure},null,2));if(failure){console.error(failure);process.exitCode=1;}else console.log('SDK_DISPLAY_ERRORS_PASS');
`;
test('SDK reports initial data failure with a bounded phase/code/message and no render-ready success',()=>fixture('data',`
failData=true;await render();await until(()=>!!app.error);assert.ok(diagnostics().some(row=>row.error.phase==='data'&&row.error.code==='DATA_UNAVAILABLE'&&row.error.message==='initial data unavailable'));assert.equal(readyRequests.length,0);assert.ok(diagnostics().every(row=>row.documentNonce&&row.channel===COMPONENT_CHANNEL&&row.frameInstanceId==='F'));
`));
test('SDK retries a transient initial read inside the budget and reports the last failure with attempts, request id and cause once it is spent',()=>fixture('data-retry',`
failFailure={code:'RUNTIME_STORE_BUSY',message:'busy',retryPolicy:'read_retry',details:{requestId:'srv-1',cause:'database is locked'}};hookOptions={initialReadRetryDelaysMs:[5,5]};failData=true;failUntil=2;
await render();await until(()=>!app.loading);assert.equal(dataCalls,3);assert.equal(diagnostics().length,0,'recovered after two transient failures');assert.equal(app.error,undefined);await until(()=>readyRequests.length===1);
`));
test('SDK reports an exhausted transient initial read with its evidence',()=>fixture('data-exhausted',`
failFailure={code:'RUNTIME_STORE_BUSY',message:'busy',retryPolicy:'read_retry',details:{requestId:'srv-1',cause:'database is locked'}};hookOptions={initialReadRetryDelaysMs:[5,5]};failData=true;
await render();await until(()=>!!app.error);assert.equal(dataCalls,3);assert.equal(diagnostics().length,1);assert.deepEqual(diagnostics()[0].error,{phase:'data',code:'RUNTIME_STORE_BUSY',message:'busy',attempts:3,retryPolicy:'read_retry',requestId:'srv-1',cause:'database is locked'});assert.equal(readyRequests.length,0);
`));
test('SDK reports a deterministic initial read failure at once without retrying',()=>fixture('data-deterministic',`
failFailure={code:'BRIDGE_IDENTITY_STALE',message:'stale',retryPolicy:'never'};hookOptions={initialReadRetryDelaysMs:[5,5]};failData=true;
await render();await until(()=>!!app.error);await settle(40);assert.equal(dataCalls,1);assert.equal(diagnostics().length,1);assert.deepEqual(diagnostics()[0].error,{phase:'data',code:'BRIDGE_IDENTITY_STALE',message:'stale',attempts:1,retryPolicy:'never'});
`));
test('SDK actual React effect reports readiness failure instead of claiming the display succeeded',()=>fixture('ready',`
failReady=true;await render();await until(()=>diagnostics().some(row=>row.error.phase==='readiness'));assert.equal(readyRequests.length,1);assert.equal(readyRequests[0].params.checks.rendered,true);assert.equal(readyRequests[0].params.checks.bridgeReady,true);assert.equal(readyRequests[0].params.checks.dataRead,true);assert.ok(diagnostics().some(row=>row.error.code==='DISPLAY_READY_FAILED'));
`));
test('SDK keeps handled business failures out of display diagnostics and captures actual unhandled script errors',()=>fixture('business-script',`
await render();await until(()=>readyRequests.length===1);let error;try{await app.invokeCapability({capabilityId:'fixture.read'});}catch(reason){error=reason;}assert.ok(error instanceof ComponentBridgeError);assert.equal(error.code,'INVALID_INPUT');for(const listener of events.get('unhandledrejection')??[])listener({type:'unhandledrejection',reason:error});assert.equal(diagnostics().length,0);for(const listener of events.get('error')??[])listener({type:'error',message:'actual uncaught component exception'});assert.equal(diagnostics().length,1);assert.equal(diagnostics()[0].error.phase,'script');assert.equal(diagnostics()[0].error.code,'COMPONENT_SCRIPT_ERROR');assert.equal(messages.filter(row=>row.method==='invokeCapability').length,1);
`));
for(const transfer of [false,true])test(`SDK keeps preparing responses loading and sends renderReady only after real data (${transfer?'transfer':'legacy message'})`,()=>fixture(transfer?'preparing-transfer':'preparing-legacy',`
const pending={bindings:[{bindingId:'control',datasetId:'d',revision:null,state:'preparing',payload:null,preparation:{state:'preparing',phase:'query',startedAt:new Date().toISOString(),elapsedMs:1}}]};dataResult=pending;
await render();await until(()=>app.preparing);assert.equal(app.loading,true);assert.equal(app.error,undefined);assert.equal(readyRequests.length,0);assert.equal(tree.toJSON().children[0],'loading');assert.equal(app.preparationNotice,'数据准备中…');
dataResult={bindings:[{bindingId:'control',datasetId:'d',revision:'1',state:'ready',payload:{control:'ready'}}]};
const before=dataCalls;await settle(999);assert.equal(dataCalls,before,'preparation polling must wait the full 1000ms');assert.equal(readyRequests.length,0);await settle(1);assert.equal(dataCalls,before+1);await until(()=>readyRequests.length===1);assert.equal(app.loading,false);assert.equal(app.preparing,false);assert.deepEqual(app.data.bindings.map(({bindingId,state,payload})=>({bindingId,state,payload})),dataResult.bindings.map(({bindingId,state,payload})=>({bindingId,state,payload})));assert.equal(diagnostics().length,0);
`));
test('SDK preparation failure reports a classified phase=data error and never renderReady',()=>fixture('preparing-failed',`
dataResult={bindings:[{bindingId:'control',state:'preparing',payload:null,preparation:{phase:'query',elapsedMs:1}}]};await render();await until(()=>app.preparing);
dataResult={bindings:[{bindingId:'control',state:'failed',payload:null,error:{code:'INVALID_INPUT',message:'controlled preparation failed',retryPolicy:'never'}}]};await settle(1100);await until(()=>!!app.error);assert.equal(app.loading,false);assert.equal(readyRequests.length,0);assert.deepEqual(diagnostics()[0].error,{phase:'data',code:'INVALID_INPUT',message:'controlled preparation failed',retryPolicy:'never',attempts:1});
`));
test('SDK preparation polls pause while hidden and unmount cannot emit a late ready receipt',()=>fixture('preparing-hidden',`
dataResult={bindings:[{bindingId:'control',state:'preparing',payload:null,preparation:{phase:'query',elapsedMs:1}}]};await render();await until(()=>app.preparing);
const hello=messages.find(row=>row.type==='hello'),visibility=(visible)=>{for(const listener of events.get('message')??[])listener({source:parent,origin,data:{...identity,channel:COMPONENT_CHANNEL,type:'visibility',documentNonce:hello.documentNonce,visible}});};
await act(async()=>visibility(false));const before=dataCalls;dataResult={bindings:[{bindingId:'control',state:'ready',revision:'1',payload:{control:'ready'}}]};await settle(1100);assert.equal(dataCalls,before);assert.equal(readyRequests.length,0);
await act(async()=>visibility(true));await until(()=>readyRequests.length===1);await act(async()=>tree.unmount());tree=undefined;await settle(30);assert.equal(readyRequests.length,1);
`));
test('SDK unmount during preparing cancels polling with no ready or display-error report',()=>fixture('preparing-unmount',`
dataResult={bindings:[{bindingId:'control',state:'preparing',payload:null,preparation:{phase:'query',elapsedMs:1}}]};await render();await until(()=>app.preparing);const before=dataCalls;
await act(async()=>tree.unmount());tree=undefined;dataResult={bindings:[{state:'ready',payload:{control:'ready'}}]};await settle(1100);assert.equal(dataCalls,before);assert.equal(readyRequests.length,0);assert.equal(diagnostics().length,0);
`));
test('SDK polls a pushed preparing state without invoking refresh or duplicating an already-ready receipt',()=>fixture('preparing-push',`
await render();await until(()=>readyRequests.length===1);const before=dataCalls,pending={bindings:[{bindingId:'control',state:'preparing',payload:null,preparation:{phase:'query',elapsedMs:1}}]};
await act(async()=>{for(const listener of events.get('message')??[])listener({source:parent,origin,data:host.event('data',pending)});});assert.equal(app.preparing,true);assert.equal(app.loading,true);
dataResult={bindings:[{bindingId:'control',state:'ready',revision:'2',payload:{control:'later ready'}}]};await settle(999);assert.equal(dataCalls,before,'pushed preparation polling must wait the full 1000ms');assert.equal(readyRequests.length,1);await settle(1);assert.equal(dataCalls,before+1);await until(()=>!app.preparing);assert.ok(dataCalls>before);assert.equal(readyRequests.length,1);assert.equal(diagnostics().length,0);assert.equal(messages.filter(row=>row.method==='refresh').length,0);
`));
