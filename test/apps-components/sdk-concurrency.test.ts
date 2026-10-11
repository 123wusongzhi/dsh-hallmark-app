import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

async function runFixture(scenario:string){
 const root=resolve('test/apps-components/artifacts');mkdirSync(root,{recursive:true});
 const directory=mkdtempSync(join(root,'sdk-concurrency-')),output=join(directory,'test.mjs');
 const source=readFileSync('packages/component-runtime/src/apps-react.tsx','utf8').replace("import {createAppsClient,ComponentBridgeError} from './apps-client.ts';",'const createAppsClient=()=>globalThis.fakeClient;class ComponentBridgeError extends Error {}').replace("from './latest-state-saver.ts'","from './packages/component-runtime/src/latest-state-saver.ts'");
 const fixture=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window={addEventListener(){},removeEventListener(){}};
const requests=[];const pending=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
let onEvent;const frameErrors=[],snapshot=(a,b)=>({bindings:[{bindingId:'a',payload:a},{bindingId:'b',payload:b}]});
globalThis.fakeClient={hello:async()=>({features:[]}),isVisible:()=>true,subscribeVisibility:()=>()=>{},getData:pending,getContext:async()=>({}),subscribe:listener=>{onEvent=listener;return()=>{};},reportFrameError:error=>frameErrors.push(error),dispose(){},refresh:pending,readBindingPage:pending};
let api,tree;function Component(){api=useApps();return null;}
await act(async()=>{tree=create(React.createElement(Component));});
const values=()=>api.data.bindings.map(binding=>binding.payload);
${scenario}
await act(async()=>tree.unmount());console.log('CONCURRENCY_PASS');
`;
 await build({stdin:{contents:source+'\n'+fixture,loader:'tsx',resolveDir:resolve('.')},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,[output],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/CONCURRENCY_PASS/);
}

test('delayed initial data cannot replace a pushed snapshot or a newer explicit refresh',async()=>{
 await runFixture(`
await act(async()=>onEvent({event:'data',data:snapshot('pushed-a','pushed-b')}));
await act(async()=>{requests[0].resolve(snapshot('old-a','old-b'));});
assert.deepEqual(values(),['pushed-a','pushed-b']);
`);
 await runFixture(`
let refresh;await act(async()=>{refresh=api.refresh();});
await act(async()=>{requests[1].resolve(snapshot('fresh-a','fresh-b'));await refresh;});
await act(async()=>{requests[0].resolve(snapshot('old-a','old-b'));});
assert.deepEqual(values(),['fresh-a','fresh-b']);
`);
 await runFixture(`
await act(async()=>onEvent({event:'data',data:snapshot('pushed-a','pushed-b')}));
await act(async()=>{requests[0].reject(Error('obsolete initial read failed'));});
assert.deepEqual(values(),['pushed-a','pushed-b']);assert.equal(api.error,undefined);assert.deepEqual(api.hello,{features:[]});assert.equal(frameErrors.length,0);
`);
});

test('distinct binding pages merge independently while same-binding and full refresh races remain ordered',async()=>{
 await runFixture(`
await act(async()=>requests[0].resolve(snapshot('a0','b0')));
let a,b;await act(async()=>{a=api.readBindingPage('a','2');b=api.readBindingPage('b','2');});
await act(async()=>{requests[2].resolve(snapshot('a0','b2'));await b;});
assert.deepEqual(values(),['a0','b2']);assert.equal(api.refreshing,true,'another binding is still loading');
await act(async()=>{requests[1].resolve(snapshot('a2','b0'));await a;});
assert.deepEqual(values(),['a2','b2']);assert.equal(api.refreshing,false);
await act(async()=>{a=api.readBindingPage('a','3');b=api.readBindingPage('a','4');});
await act(async()=>{requests[4].resolve(snapshot('a4','b0'));await b;requests[3].resolve(snapshot('a3','b0'));await a;});
assert.deepEqual(values(),['a4','b2']);
await act(async()=>{a=api.refresh();b=api.readBindingPage('b','5');});
await act(async()=>{requests[6].resolve(snapshot('stale-a','b5'));await b;requests[5].resolve(snapshot('fresh-a','stale-b'));await a;});
assert.deepEqual(values(),['fresh-a','b5']);
await act(async()=>{a=api.readBindingPage('a','6');b=api.refresh();});
await act(async()=>{requests[8].resolve(snapshot('full-a','full-b'));await b;requests[7].resolve(snapshot('a6','stale-b'));await a;});
assert.deepEqual(values(),['full-a','full-b']);
await act(async()=>{a=api.refresh(['a']);b=api.refresh(['b']);});
await act(async()=>{requests[10].resolve(snapshot('stale-a','refreshed-b'));await b;requests[9].resolve(snapshot('refreshed-a','stale-b'));await a;});
assert.deepEqual(values(),['refreshed-a','refreshed-b']);
await act(async()=>{a=api.readBindingPage('a','7').catch(()=>{});});
await act(async()=>onEvent({event:'data',data:snapshot('event-a','event-b')}));
await act(async()=>{requests[11].reject(Error('obsolete page failed'));await a;});
assert.deepEqual(values(),['event-a','event-b']);assert.equal(api.error,undefined);
await act(async()=>{a=api.refresh().catch(()=>{});b=api.readBindingPage('b','8');});
await act(async()=>{requests[13].resolve(snapshot('stale-a','b8'));await b;requests[12].reject({code:'FORBIDDEN',message:'No access to the old snapshot',retryPolicy:'never'});await a;});
assert.deepEqual(values(),[null,'b8'],'a rejected full read invalidates only bindings without a newer read');
`);
});
