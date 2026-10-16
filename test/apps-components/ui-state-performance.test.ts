import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {createLatestStateSaver} from '../../packages/component-runtime/src/latest-state-saver.ts';

test('latest UI state keeps one writer, coalesces pending changes, and flush waits for persistence',async()=>{
  let value=0,inFlight=0,maxInFlight=0;const writes:number[]=[],held:(()=>void)[]=[];
  const saver=createLatestStateSaver(async()=>{maxInFlight=Math.max(maxInFlight,++inFlight);writes.push(value);await new Promise<void>(resolve=>held.push(resolve));inFlight--;});
  value=1;const first=saver.save();await Promise.resolve();
  const waiters:Promise<void>[]=[];for(let n=2;n<=20;n++){value=n;waiters.push(saver.save());}
  let flushed=false;const flush=saver.flush().then(()=>{flushed=true;});
  assert.deepEqual(writes,[1]);held.shift()!();await first;await Promise.resolve();assert.deepEqual(writes,[1,20]);assert.equal(flushed,false);
  held.shift()!();await Promise.all([...waiters,flush]);assert.equal(flushed,true);assert.equal(maxInFlight,1);saver.dispose();
  await assert.rejects(saver.save(),/已关闭/);
  console.log(JSON.stringify({scope:'production_state_saver',notifications:20,beforeWrites:20,afterWrites:writes.length,maxInFlight}));
});

test('failed CAS rejects pending flush without automatically repeating, and disposal rejects queued callers',async()=>{
  let rejectWrite:(reason:unknown)=>void,calls=0;
  const saver=createLatestStateSaver(async()=>{calls++;await new Promise<void>((_resolve,reject)=>{rejectWrite=reject;});});
  const first=saver.save(),firstFailure=assert.rejects(first,/CAS conflict/);await Promise.resolve();const next=saver.flush(),nextFailure=assert.rejects(next,/CAS conflict/);
  rejectWrite!(new Error('CAS conflict'));await Promise.all([firstFailure,nextFailure]);assert.equal(calls,1);
  const pending=saver.save(),closed=assert.rejects(pending,/已关闭/);saver.dispose();await closed;assert.equal(calls,1);
});

async function hookFixture(label:string,body:string){
  const root=resolve('artifacts/performance/ui');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,label+'-')),entry=join(directory,'fixture.mjs');
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:setup+body+finish},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024});writeFileSync(join(directory,'result.json'),JSON.stringify({label,status:result.status,stdout:result.stdout,stderr:result.stderr,scope:'ISOLATED_PRODUCTION_REACT_HOOK_AND_HOST',actualDesktop:false},null,2));assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/UI_PERFORMANCE_PASS/);
}
const setup=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';import {useApps} from './packages/component-runtime/src/apps-react.tsx';import {ComponentHost} from './packages/component-runtime/src/host.ts';import {COMPONENT_CHANNEL} from './packages/component-runtime/src/apps-client.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const events=new Map(),messages=[],writes=[];let tree,api,stateListener,importCalls=0,resolveRead,rejectRead,heldWrite,count=0,readyCalls=0,failContext=false,failState=false,failData=false,deferState=false,deferWrite=false,initiallyHidden=false,dataReads=0,contextReads=0,deferContext=false,rejectContext;
const identity={protocolVersion:'2.0',sessionId:'A',viewId:'V',buildId:'B',frameInstanceId:'F'},origin='http://fixture';
const snapshot={sessionId:'A',viewId:'V',sourceBuildId:'B',uiStateSchemaVersion:1,stateRevision:7,value:{count:1},capturedAt:'2026-10-09',selectionEvidence:[]};
const host=new ComponentHost(identity,{getData:()=>{dataReads++;if(failData)throw Object.assign(Error('required data failed'),{code:'DATA_FAILED'});return {rows:[1]};},getContext:()=>{contextReads++;if(failContext)throw Error('optional context failed');if(deferContext)return new Promise((_resolve,reject)=>{rejectContext=reject;});return {publication:{publicationId:'P',attemptId:'attempt',attemptEpoch:1}};}},{extensionHandlers:{uiStateV1:async request=>{if(request.action==='read'){if(failState)throw Error('optional state failed');if(deferState)return new Promise((resolve,reject)=>{resolveRead=resolve;rejectRead=reject;});return {status:'restored',snapshot};}assert.ok(readyCalls,'state writes wait for actual readiness');writes.push(request.params);if(deferWrite&&writes.length===1)await new Promise(resolve=>heldWrite=resolve);return {stateRevision:7+writes.length};},renderReadyV1:()=>{readyCalls++;return {status:'mounted'};}}});
const signalVisibility=visible=>{const documentNonce=messages.find(message=>message.type==='hello')?.documentNonce;for(const listener of events.get('message')??[])listener({source:parent,origin,data:{...identity,channel:COMPONENT_CHANNEL,type:'visibility',documentNonce,visible}});};
const parent={postMessage(message){messages.push(message);void host.handle(message).then(response=>{if(response)for(const listener of events.get('message')??[])listener({source:parent,origin,data:response});if(response?.type==='hello'&&initiallyHidden)signalVisibility(false);});}};
globalThis.window={parent,location:{origin},addEventListener(type,listener){const rows=events.get(type)??new Set();rows.add(listener);events.set(type,rows);},removeEventListener(type,listener){events.get(type)?.delete(listener);}};
const contract={uiStateSchemaVersion:1,exportState:()=>({value:{count},selectionEvidence:[]}),importState(value){importCalls++;count=value.count;},subscribe(listener){stateListener=listener;return()=>{stateListener=undefined;};}};
function Component(){api=useApps({uiState:contract});return <output>{api.loading?'loading':api.error?.message??String(api.data?.rows?.length)}</output>;}
const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));}),until=async predicate=>{for(let n=0;n<100&&!predicate();n++)await settle();assert.ok(predicate());},mount=async()=>{await act(async()=>{tree=create(<Component/>);});};
try{
`;
const finish=`
}finally{if(tree)await act(async()=>tree.unmount());host.dispose();for(const rows of events.values())assert.equal(rows.size,0);assert.equal(stateListener,undefined);}
console.log(JSON.stringify({scope:'ISOLATED_PRODUCTION_REACT_HOOK_AND_HOST',readyCalls,dataReads,contextReads,writes:writes.map(write=>({value:write.value,expectedStateRevision:write.expectedStateRevision})),importCalls,frameErrors:messages.filter(message=>message.type==='display-error').map(message=>message.error)},null,2));console.log('UI_PERFORMANCE_PASS');
`;

test('optional context and UI restoration failures leave required data usable and cannot claim readiness',()=>hookFixture('optional-failures',`
failContext=true;failState=true;await mount();await until(()=>!api.loading&&api.uiStateNotice&&api.contextNotice);assert.deepEqual(api.data,{rows:[1]});assert.equal(api.error,undefined);assert.deepEqual(tree.root.findByType('output').children,['1']);assert.equal(readyCalls,0);assert.equal(messages.filter(message=>message.type==='display-error').length,0);await assert.rejects(api.saveUiState());
`));
test('a frame hidden before required initialization pauses without a display error and resumes each read exactly once',()=>hookFixture('hidden-initialization',`
initiallyHidden=true;await mount();await settle();assert.equal(api.loading,true);assert.equal(api.error,undefined);assert.equal(api.contextNotice,'');assert.equal(readyCalls,0);assert.equal(dataReads,0);assert.equal(contextReads,0);assert.equal(messages.filter(message=>message.type==='display-error').length,0);
await act(async()=>signalVisibility(true));await until(()=>readyCalls===1);assert.deepEqual(api.data,{rows:[1]});assert.equal(api.loading,false);assert.equal(dataReads,1);assert.equal(contextReads,1);assert.equal(api.error,undefined);assert.equal(messages.filter(message=>message.type==='display-error').length,0);
await act(async()=>{signalVisibility(false);signalVisibility(true);});await settle();assert.equal(dataReads,1);assert.equal(contextReads,1);assert.equal(readyCalls,1);
`));
test('resuming a paused optional context read does not repeat the already successful required data read',()=>hookFixture('partial-initialization',`
deferContext=true;await mount();await until(()=>!!rejectContext&&!api.loading);assert.equal(dataReads,1);assert.equal(contextReads,1);assert.equal(readyCalls,0);
await act(async()=>{signalVisibility(false);rejectContext(Object.assign(Error('hidden'),{code:'BRIDGE_PAUSED'}));});await settle();assert.equal(api.error,undefined);assert.equal(api.contextNotice,'');assert.deepEqual(api.data,{rows:[1]});assert.equal(messages.filter(message=>message.type==='display-error').length,0);
deferContext=false;await act(async()=>signalVisibility(true));await until(()=>readyCalls===1);assert.equal(dataReads,1);assert.equal(contextReads,2);assert.equal(api.contextNotice,'');
`));
test('disposing a hidden initializing frame removes its visibility waiters without a late read or error report',()=>hookFixture('hidden-disposal',`
initiallyHidden=true;await mount();await settle();await act(async()=>tree.unmount());tree=undefined;await settle();assert.equal(dataReads,0);assert.equal(contextReads,0);assert.equal(readyCalls,0);assert.equal(messages.filter(message=>message.type==='display-error').length,0);for(const rows of events.values())assert.equal(rows.size,0);
`));
test('required data failure still stops initialization and never claims readiness',()=>hookFixture('required-failure',`
failData=true;await mount();await until(()=>!!api.error);assert.match(api.error.message,/required data failed/);assert.equal(readyCalls,0);assert.ok(messages.some(message=>message.type==='display-error'&&message.error.phase==='data'));await assert.rejects(api.flushUiState());
`));
test('late restoration cannot replace user edits, while CAS uses its known revision and readiness precedes persistence',()=>hookFixture('late-restore',`
deferState=true;await mount();await until(()=>!!resolveRead&&!api.loading);assert.equal(readyCalls,0);count=9;stateListener();await act(async()=>resolveRead({status:'restored',snapshot}));await until(()=>writes.length===1);assert.equal(importCalls,0);assert.equal(count,9);assert.match(api.uiStateNotice,/未覆盖/);assert.equal(writes[0].expectedStateRevision,7);assert.deepEqual(writes[0].value,{count:9});assert.equal(readyCalls,1);
`));
test('actual hook exports the latest burst state at most twice and explicit flush persists its final value',()=>hookFixture('burst-writes',`
deferWrite=true;await mount();await until(()=>readyCalls===1);count=1;stateListener();await until(()=>!!heldWrite);for(let n=2;n<=20;n++){count=n;stateListener();}let flushed=false;const flush=api.flushUiState().then(()=>{flushed=true;});await settle();assert.equal(writes.length,1);assert.equal(flushed,false);await act(async()=>heldWrite());await flush;assert.equal(writes.length,2);assert.deepEqual(writes.map(write=>write.value.count),[1,20]);assert.deepEqual(writes.map(write=>write.expectedStateRevision),[7,8]);await api.saveUiState();assert.equal(writes.length,2,'an unchanged state produces no redundant persistence write');
`));
