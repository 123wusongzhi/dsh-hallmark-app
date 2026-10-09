import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('actual useApps preserves visible data while refreshing and ignores stale refresh completions after a newer page request',async()=>{
 const root=resolve('test/apps-components/artifacts');mkdirSync(root,{recursive:true});
 const directory=mkdtempSync(join(root,'sdk-order-')),output=join(directory,'test.mjs');
 const source=readFileSync('packages/component-runtime/src/apps-react.tsx','utf8').replace("import {createAppsClient,ComponentBridgeError} from './apps-client.ts';",'const createAppsClient=()=>globalThis.fakeClient;class ComponentBridgeError extends Error {}');
 const fixture=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
globalThis.window={addEventListener(){},removeEventListener(){}};
const requests=[];const pending=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
globalThis.fakeClient={hello:async()=>({features:[]}),getData:async()=> 'initial',getContext:async()=>({}),subscribe:()=>()=>{},dispose(){},refresh:pending,readBindingPage:pending};
let api,tree;function Component(){api=useApps();return null;}
await act(async()=>{tree=create(React.createElement(Component));});assert.equal(api.loading,false);assert.equal(api.refreshing,false);
let old,next;
await act(async()=>{old=api.refresh();next=api.readBindingPage('products','4');});
await act(async()=>{requests[0].resolve('old');await old;});
assert.equal(api.data,'initial');assert.equal(api.loading,false,'the existing snapshot must remain visible');assert.equal(api.refreshing,true,'the newer page request is still pending');
await act(async()=>{requests[1].resolve('page4');await next;});assert.equal(api.data,'page4');assert.equal(api.loading,false);assert.equal(api.refreshing,false);
await act(async()=>{old=api.refresh().catch(()=>{});next=api.readBindingPage('products','5');});
await act(async()=>{requests[3].resolve('page5');await next;requests[2].reject(Error('old failure'));await old;});
assert.equal(api.data,'page5');assert.equal(api.error,undefined);assert.equal(api.loading,false);assert.equal(api.refreshing,false);
await act(async()=>{old=api.readBindingPage('products','6');next=api.refresh();});
await act(async()=>{requests[5].resolve('refreshed');await next;requests[4].resolve('old page');await old;});assert.equal(api.data,'refreshed');
await act(async()=>{old=api.refresh();tree.unmount();requests[6].resolve('after close');await old;});
console.log('ORDER_PASS');
`;
 await build({stdin:{contents:source+'\n'+fixture,loader:'tsx',resolveDir:resolve('.')},outfile:output,bundle:true,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,[output],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/ORDER_PASS/);
});
