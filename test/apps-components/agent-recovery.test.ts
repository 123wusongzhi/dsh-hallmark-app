import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('Agent actions allow correction and explicit retry only after definitive no-admission evidence',async()=>{
 const root=resolve('test/apps-components/artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'agent-recovery-')),entry=join(directory,'test.mjs');
 await build({stdin:{resolveDir:resolve('.'),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsAgentActions} from './packages/component-runtime/src/apps-react.tsx';
import {ComponentBridgeError} from './packages/component-runtime/src/apps-client.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
for(const failure of [
 {code:'CONTEXT_REVISION_CONFLICT',message:'Republish current context',retryPolicy:'never'},
 {code:'BRIDGE_MESSAGE_TOO_LARGE',message:'Shorten request',retryPolicy:'never',details:{submitted:false}},
 {code:'NEW_PREFLIGHT_REJECTION',message:'Not dispatched',retryPolicy:'never',details:{submitted:false}},
 {code:'BRIDGE_TIMEOUT',message:'Unknown',retryPolicy:'inspect_only',details:{requestId:'original'}},
 {code:'COMPONENT_ACTION_FAILED',message:'Unknown stage',retryPolicy:'never'},
 {code:'BRIDGE_MESSAGE_TOO_LARGE',message:'Oversized response after admission',retryPolicy:'never'},
 {code:'BRIDGE_CLOSED',message:'Unknown',retryPolicy:'inspect_only',details:{requestId:'original'}}
]){
 let updates=0,requests=0,tree;const safe=failure.code==='CONTEXT_REVISION_CONFLICT'||failure.details?.submitted===false;
 const apps={hello:{supportedMethods:['updateContext','requestAgent'],contextRevision:0},context:{contextRevision:0},updateContext:async()=>({status:'updated',contextRevision:++updates,snapshotId:'snapshot',snapshot:{}}),requestAgent:async()=>{requests++;if(requests===1)throw new ComponentBridgeError(failure);return {status:'accepted',requestId:'retry',contextRevision:updates};}};
 await act(async()=>{tree=create(<AppsAgentActions apps={apps} selections={[]}/>);});
 const button=name=>tree.root.findAllByType('button').find(node=>node.children.join('')===name);
 await act(async()=>button('更新上下文').props.onClick());
 await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'Original request'}}));
 await act(async()=>button('请求代理').props.onClick());assert.equal(requests,1);
 assert.equal(tree.root.findByType('input').props.disabled,!safe,failure.code);
 assert.equal(button('更新上下文').props.disabled,!safe,failure.code);
 if(safe){
  assert.match(tree.root.findByProps({role:'status'}).children.join(''),/未提交/);
  await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'Corrected request'}}));
  await act(async()=>button('更新上下文').props.onClick());assert.equal(requests,1,'correction never auto submits');
  await act(async()=>button('请求代理').props.onClick());assert.equal(requests,2);assert.equal(button('请求代理').props.disabled,true);
 }else{await act(async()=>button('请求代理').props.onClick());assert.equal(requests,1);assert.equal(button('准备新任务'),undefined);}
 await act(async()=>tree.unmount());
}
console.log('RECOVERY_PASS');
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/RECOVERY_PASS/);
});
