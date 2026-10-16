import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('agent feedback invalidates failed publications and isolates changing component identities',async()=>{
 mkdirSync('artifacts',{recursive:true});const dir=mkdtempSync(resolve('artifacts/agent-boundaries-')),entry=join(dir,'probe.mjs');
 try{
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsAgentActions} from './packages/component-runtime/src/apps-react.tsx';
import {ComponentBridgeError} from './packages/component-runtime/src/apps-client.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const button=(t,label)=>t.root.findAllByType('button').find(n=>text(n)===label);
let network=0;globalThis.fetch=async()=>{network++;throw Error('Forbidden network');};
const failures=[];
async function scenario(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);}}
function client(id){let updates=0,requests=0;const value={failUpdate:false,held:null,apps:{hello:{sessionId:'session',viewId:id,buildId:'build',frameInstanceId:id,supportedMethods:['updateContext','requestAgent'],contextRevision:0},context:{contextRevision:0},updateContext:async()=>{updates++;if(value.failUpdate)throw Error('Controlled update failure');return {contextRevision:updates};},requestAgent:async()=>{requests++;return value.held?await value.held.promise:{status:'accepted',requestId:id+'-receipt',contextRevision:updates};}},get requests(){return requests;}};return value;}
async function mount(c){let t;await act(async()=>{t=create(<AppsAgentActions apps={c.apps} selections={[]}/>);});return t;}
async function prepare(t){await act(async()=>button(t,'更新上下文').props.onClick());await act(async()=>t.root.findByType('input').props.onChange({target:{value:'Analyze'}}));}
await scenario('failed update invalidates prior published revision',async()=>{const c=client('failure'),t=await mount(c);try{await prepare(t);c.failUpdate=true;await act(async()=>button(t,'更新上下文').props.onClick());assert.equal(button(t,'请求代理').props.disabled,true,'failed update must not leave previous revision submit-ready');assert.match(text(t.root.findByProps({role:'status'})),/上下文/);await act(async()=>button(t,'请求代理').props.onClick());assert.equal(c.requests,0);c.failUpdate=false;await act(async()=>button(t,'更新上下文').props.onClick());assert.equal(button(t,'请求代理').props.disabled,false);}finally{await act(async()=>t.unmount());}});
await scenario('new identity rejects old publication and late receipt',async()=>{const old=client('old'),next=client('new'),t=await mount(old);try{await prepare(t);old.held=deferred();let pending;await act(async()=>{pending=button(t,'请求代理').props.onClick();});await act(async()=>t.update(<AppsAgentActions apps={next.apps} selections={[]}/>));assert.equal(t.root.findByType('input').props.disabled,false,'new identity inherited old submission lock');assert.equal(t.root.findByType('section').props['data-agent-state'],'idle','new identity inherited old submitting state');assert.equal(t.root.findByType('input').props.value,'');assert.equal(button(t,'更新上下文').props.disabled,false);assert.equal(button(t,'请求代理').props.disabled,true);await act(async()=>{old.held.resolve({status:'unknown',requestId:'old-receipt'});await pending;});assert.equal(t.root.findByType('section').props['data-agent-state'],'idle','late old receipt leaked into new identity');await prepare(t);await act(async()=>button(t,'请求代理').props.onClick());assert.equal(next.requests,1);}finally{await act(async()=>t.unmount());}});
await scenario('same identity rerender preserves uncertain lock',async()=>{const c=client('same'),t=await mount(c);try{await prepare(t);c.held=deferred();let pending;await act(async()=>{pending=button(t,'请求代理').props.onClick();});await act(async()=>{c.held.resolve({status:'unknown',requestId:'original'});await pending;});await act(async()=>t.update(<AppsAgentActions apps={{...c.apps,hello:{...c.apps.hello}}} selections={[]}/>));assert.equal(button(t,'请求代理').props.disabled,true);await act(async()=>button(t,'请求代理').props.onClick());assert.equal(c.requests,1);assert.match(text(t.root.findByProps({role:'status'})),/待确认/);}finally{await act(async()=>t.unmount());}});
await scenario('late publication cannot authorize replacement identity',async()=>{const old=client('publisher'),next=client('replacement'),held=deferred();old.apps.updateContext=()=>held.promise;const t=await mount(old);try{let pending;await act(async()=>{pending=button(t,'更新上下文').props.onClick();});await act(async()=>t.update(<AppsAgentActions apps={next.apps} selections={[]}/>));await act(async()=>{held.resolve({contextRevision:99});await pending;});assert.equal(t.root.findByType('section').props['data-context-state'],'dirty');assert.doesNotMatch(text(t.root.findByProps({role:'status'})),/99/);await act(async()=>t.root.findByType('input').props.onChange({target:{value:'New task'}}));assert.equal(button(t,'请求代理').props.disabled,true);assert.equal(next.requests,0);}finally{await act(async()=>t.unmount());}});
await scenario('unknown error without request id still offers chat recovery',async()=>{const c=client('no-id');c.apps.requestAgent=async()=>{throw new ComponentBridgeError({code:'BRIDGE_CLOSED',message:'Controlled failure',retryPolicy:'inspect_only'});};let t;await act(async()=>{t=create(<AppsAgentActions apps={c.apps} selections={[]} onInspectRequest={()=>{throw Error('No id should be inspected');}}/>);});try{await prepare(t);await act(async()=>button(t,'请求代理').props.onClick());assert.equal(button(t,'检查原请求'),undefined);assert.match(text(t.toJSON()),/回到当前聊天核对原请求/);assert.equal(button(t,'请求代理').props.disabled,true);}finally{await act(async()=>t.unmount());}});
assert.equal(network,0);assert.deepEqual(failures,[]);console.log('BOUNDARIES_PASS network='+network);
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);assert.match(result.stdout,/BOUNDARIES_PASS/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
