import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('agent controls show in-flight stages and original receipt state without repeating or globally blocking requests',async()=>{
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'agent-feedback-')),entry=join(directory,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsAgentActions} from './packages/component-runtime/src/apps-react.tsx';
import {ComponentBridgeError} from './packages/component-runtime/src/apps-client.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const deferred=()=>{let resolve,reject;return {promise:new Promise((yes,no)=>{resolve=yes;reject=no;}),resolve,reject};};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=(tree,name)=>tree.root.findAllByType('button').find(node=>text(node)===name);
const notice=tree=>text(tree.root.findByProps({role:'status'}));
const state=tree=>tree.root.findByType('section').props['data-agent-state'];
const trees=[];let platformRequests=0;const nativeFetch=globalThis.fetch;globalThis.fetch=async()=>{platformRequests++;throw new Error('This fixture must never contact a platform');};
function client(id){const heldUpdate=deferred(),heldRequest=deferred();let updates=0,requests=0;return {heldUpdate,heldRequest,get updates(){return updates;},get requests(){return requests;},apps:{hello:{protocolVersion:'2.0',sessionId:'session',viewId:id,buildId:'build',frameInstanceId:id,supportedMethods:['updateContext','requestAgent'],contextRevision:0},context:{contextRevision:0},updateContext:async()=>{updates++;await heldUpdate.promise;return {status:'updated',contextRevision:updates,snapshotId:id,snapshot:{}};},requestAgent:async()=>{requests++;return await heldRequest.promise;}}};}
async function mount(value,onInspectRequest){let tree;await act(async()=>{tree=create(<AppsAgentActions apps={value.apps} selections={[]} onInspectRequest={onInspectRequest}/>);});trees.push(tree);return tree;}
async function enter(tree,value='Analyze this selection'){await act(async()=>tree.root.findByType('input').props.onChange({target:{value}}));}
try{
 const first=client('first'),one=await mount(first);let publishing;
 await act(async()=>{publishing=button(one,'更新上下文').props.onClick();button(one,'更新上下文').props.onClick();});
 assert.equal(first.updates,1);assert.match(notice(one),/正在更新上下文/);assert.equal(state(one),'publishing');assert.equal(one.root.findByProps({role:'status'}).props['aria-atomic'],'true');assert.equal(button(one,'更新上下文').props['aria-busy'],true);assert.equal(first.requests,0);
 await act(async()=>{first.heldUpdate.resolve();await publishing;});await enter(one);
 let requesting;await act(async()=>{requesting=button(one,'请求代理').props.onClick();button(one,'请求代理').props.onClick();});
 assert.equal(first.requests,1);assert.match(notice(one),/正在提交任务/);assert.equal(state(one),'submitting');assert.equal(button(one,'请求代理').props['aria-busy'],true);assert.equal(one.root.findByType('input').props.disabled,true);assert.equal(button(one,'请求代理').props.disabled,true);
 // An unrelated component can finish while the first request remains gated.
 const second=client('second'),two=await mount(second);second.heldUpdate.resolve();second.heldRequest.resolve({status:'accepted',requestId:'second-request',contextRevision:1});
 await act(async()=>button(two,'更新上下文').props.onClick());await enter(two,'Independent task');await act(async()=>button(two,'请求代理').props.onClick());
 assert.equal(second.requests,1);assert.equal(state(two),'accepted');assert.match(notice(two),/排队/);assert.doesNotMatch(notice(two),/任务已完成/);assert.equal(state(one),'submitting');
 await act(async()=>{first.heldRequest.resolve({status:'accepted',requestId:'first-request',contextRevision:1});await requesting;});
 assert.equal(state(one),'accepted');assert.match(notice(one),/当前聊天/);assert.equal(button(one,'请求代理').props.disabled,true);
 await act(async()=>button(one,'准备新任务').props.onClick());assert.equal(first.requests,1);assert.equal(one.root.findByType('input').props.value,'');assert.equal(button(one,'请求代理').props.disabled,true);assert.equal(state(one),'idle');
 for(const [status,expected] of [['prepared',/等待派发/],['dispatching',/正在派发/],['unknown',/待确认/],['failed',/未完成/]]){
  const inspected=[],value=client(status),tree=await mount(value,id=>inspected.push(id));value.heldUpdate.resolve();value.heldRequest.resolve({status,requestId:status+'-original',contextRevision:1});await act(async()=>button(tree,'更新上下文').props.onClick());await enter(tree);await act(async()=>button(tree,'请求代理').props.onClick());
  assert.equal(state(tree),status);assert.match(notice(tree),expected);assert.doesNotMatch(notice(tree),new RegExp('状态：'+status));assert.equal(button(tree,'准备新任务'),undefined);assert.equal(button(tree,'请求代理').props.disabled,true);await act(async()=>button(tree,'请求代理').props.onClick());assert.equal(value.requests,1);await act(async()=>button(tree,'检查原请求').props.onClick());assert.deepEqual(inspected,[status+'-original']);assert.equal(value.requests,1);
 }
 // Indeterminate transport errors remain locked; definitive preflight failures permit an explicit corrected request.
 for(const [code,details,expectedState] of [['BRIDGE_TIMEOUT',{requestId:'lost-original'},'unknown'],['INVALID_INPUT',{submitted:false},'not_submitted']]){
  const value=client(code),tree=await mount(value);value.heldUpdate.resolve();await act(async()=>button(tree,'更新上下文').props.onClick());await enter(tree);let pending;await act(async()=>{pending=button(tree,'请求代理').props.onClick();});await act(async()=>{value.heldRequest.reject(new ComponentBridgeError({code,message:'Controlled fixture',retryPolicy:code==='BRIDGE_TIMEOUT'?'inspect_only':'never',details}));await pending;});assert.equal(state(tree),expectedState);assert.equal(button(tree,'请求代理').props.disabled,true);assert.equal(tree.root.findByType('input').props.disabled,code==='BRIDGE_TIMEOUT');assert.equal(value.requests,1);if(code==='BRIDGE_TIMEOUT'){assert.match(notice(tree),/待确认/);assert.match(text(tree.toJSON()),/回到当前聊天核对原请求/);}
 }
 assert.equal(platformRequests,0);
 console.log('AGENT_FEEDBACK_PASS '+JSON.stringify({firstRequests:first.requests,independentRequests:second.requests,duplicateRequests:0,platformRequests}));
}finally{for(const tree of trees)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;}
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/AGENT_FEEDBACK_PASS/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
