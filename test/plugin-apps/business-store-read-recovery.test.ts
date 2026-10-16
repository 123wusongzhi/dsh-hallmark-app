import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('business store reads expose recoverable terminal states and isolate cancelled owners', async t => {
  const output = await build({stdin: {resolveDir: process.cwd(), loader: 'tsx', contents: `
${uiFixturePrelude()}
import React from 'react'; import {create,act} from 'react-test-renderer'; import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
const originalFetch=globalThis.fetch;
// Recorded store facts; owner aliases and empty/error/delayed outcomes are explicit local UX controls.
const stores=[uiStore({id:'shop-a',connectionId:'connection-a'}),uiStore({id:'shop-b',connectionId:'connection-b'},1)];
let tree, props, mode, calls, held, chosen, commits, capture, withPlans=false;
const makePlan=storeId=>({planId:'plan-'+storeId,storeId,title:'Recorded read recovery scenario',revision:1,status:'draft',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',rows:[{rowId:'price',action:'price',target:{offerId:'PRICE'},payload:{price:'20',currency_code:uiProduct().currency},pricing:{mode:'manual'},revision:1,status:'draft',issues:[],corrections:[],repairHistory:{}}]});
const reply=(value,status=200)=>Response.json(value,{status});
globalThis.fetch=(url,options={})=>{
 const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options.body?JSON.parse(options.body):undefined;
 calls.push({resource,body,signal:options.signal});
 if(resource==='stores'){
  if(mode==='hold')return new Promise(resolve=>held.push({resolve,signal:options.signal}));
  if(mode==='network')return Promise.reject(new TypeError('Failed to fetch'));
  if(mode==='403')return Promise.resolve(reply({error:{code:'ACCESS_DENIED',message:'店铺连接无权读取。'}},403));
  return Promise.resolve(reply({stores:mode==='empty'?[]:mode==='missing'?[stores[1]]:stores}));
 }
 if(resource==='businessSettings')return Promise.resolve(reply({pricing:null}));
 assert.equal(body?.action,'businessOperations');assert.equal(body.operation,'list','Only isolated read operations allowed');
 return Promise.resolve(reply({status:'ok',data:{plans:withPlans?[makePlan(body.input.storeId)]:[]}}));
};
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const storesCalls=()=>calls.filter(c=>c.resource==='stores');
const draw=()=> <React.Profiler id='store-read' onRender={()=>{if(capture&&tree)commits.push(text(tree.toJSON()));}}><BusinessOperations {...props}/></React.Profiler>;
const render=()=>act(async()=>{if(tree)tree.update(draw());else tree=create(draw());await flush();});
const mount=async next=>{mode=next;calls=[];held=[];chosen=0;commits=[];capture=false;props={sessionId:'chat-a',storeId:'shop-a',onSelectStore:()=>chosen++};await render();};
const unmount=async()=>{await act(async()=>{tree.unmount();await flush();});tree=undefined;};
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,'Missing '+name);assert.ok(!b.props.disabled);b.props.onClick();await flush();});
const release=async(index,rows=stores)=>act(async()=>{held[index].resolve(reply({stores:rows}));await flush();});
try {
 for(const state of ['network','403','empty','missing']){
  await mount(state);
  assert.doesNotMatch(text(tree.toJSON()),/正在读取所选店铺的连接/,'Settled '+state+' must not look pending');
  assert.match(text(tree.toJSON()),state==='network'?/Failed to fetch/:state==='403'?/店铺连接无权读取/:state==='empty'?/没有可用店铺/:/所选店铺.*不可用/);
  assert.ok(button('重新读取店铺'));await click('重新选择店铺');assert.equal(chosen,1);
  assert.equal(calls.length,1,'No alternate-store or business request');
  if(state==='403'){await click('重新读取店铺');assert.equal(storesCalls().length,2);assert.match(text(tree.toJSON()),/店铺连接无权读取/);}
  mode='success';await click('重新读取店铺');assert.equal(tree.root.findByType('h2').children.join(''),stores[0].name);
  assert.ok(calls.filter(c=>c.body).every(c=>c.body.connectionId==='connection-a'));await unmount();
 }
 // A hanging read can be explicitly replaced. The second click of the same rendered handler is deduplicated.
 await mount('hold');assert.match(text(tree.toJSON()),/正在读取所选店铺的连接/);await click('重新选择店铺');assert.equal(chosen,1);
 await act(async()=>{const retry=button('取消并重新读取');assert.ok(retry);retry.props.onClick();retry.props.onClick();await flush();});
 assert.equal(storesCalls().length,2);

 assert.equal(held[0].signal.aborted,true);assert.equal(held[1].signal.aborted,false);
 await release(0,[stores[1]]);assert.match(text(tree.toJSON()),/正在读取所选店铺的连接/);assert.equal(calls.filter(c=>c.body).length,0);
 await click('取消并重新读取');assert.equal(storesCalls().length,3);assert.equal(held[1].signal.aborted,true);
 await release(1,[stores[1]]);assert.match(text(tree.toJSON()),/正在读取所选店铺的连接/);await release(2);assert.equal(tree.root.findByType('h2').children.join(''),stores[0].name);await unmount();
 // Navigation away cancels a hanging request; reopening starts one replacement and cannot accept its predecessor.
 await mount('hold');props={...props,active:false};await render();assert.equal(held[0].signal.aborted,true);
 props={...props,active:true};await render();assert.equal(storesCalls().length,2);await release(0);assert.equal(calls.filter(c=>c.body).length,0);await release(1);await unmount();
 // Changed chat/store hides the prior identity in every committed frame; cancelled responses cannot hydrate it.
 await mount('hold');props={...props,sessionId:'chat-b',storeId:'shop-b'};await render();assert.equal(held[0].signal.aborted,true);
 await release(0);assert.equal(calls.filter(c=>c.body).length,0);await release(1);assert.ok(calls.filter(c=>c.body).every(c=>c.body.sessionId==='chat-b'&&c.body.connectionId==='connection-b'));
 mode='hold';capture=true;commits=[];props={...props,sessionId:'chat-c',storeId:'missing-private-id'};await render();capture=false;
 assert.ok(commits.length);assert.ok(commits.every(c=>!c.includes(stores[1].name)),'No previous store name in next-owner commit');
 const last=held.length-1;await unmount();assert.equal(held[last].signal.aborted,true);await release(last); // ignored after unmount
 // Existing no-selection path and successful reads remain usable.
 await mount('success');props={...props,storeId:undefined};await render();await click('选择店铺并继续');assert.equal(chosen,1);await unmount();
 // Successful keepalive retains dirty fields, filters and selections without another directory read.
 withPlans=true;await mount('success');
 const field=label=>tree.root.findByProps({'aria-label':label});
 await act(async()=>{field('PRICE 售价').props.onChange({target:{value:'77'}});field('筛选商品').props.onChange({target:{value:'PRICE'}});field('选择 PRICE').props.onChange({target:{checked:true}});await flush();});
 const beforeHide=storesCalls().length;props={...props,active:false};await render();props={...props,active:true};await render();
 assert.equal(storesCalls().length,beforeHide);assert.equal(field('PRICE 售价').props.value,'77');assert.equal(field('筛选商品').props.value,'PRICE');assert.equal(field('选择 PRICE').props.checked,true);
 // A directory permission failure must hide the old editor but retain its isolated unsaved recovery snapshot.
 mode='403';props={...props,storeId:'shop-b'};await render();assert.match(text(tree.toJSON()),/店铺连接无权读取/);assert.equal(tree.root.findAllByProps({'aria-label':'PRICE 售价'}).length,0);assert.equal(button('恢复修改'),undefined);
 props={...props,storeId:'shop-a'};await render();assert.equal(button('恢复修改'),undefined);assert.match(text(tree.toJSON()),/店铺连接无权读取/);
 mode='success';await click('重新读取店铺');assert.ok(button('恢复修改'));await click('恢复修改');assert.equal(field('PRICE 售价').props.value,'77');await unmount();
 console.log('STORE_READ_TERMINAL_RETRY_ABORT_OWNER_KEEPALIVE_DRAFT_PASS');
} finally {if(tree)await unmount();globalThis.fetch=originalFetch;}
`}, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', plugins: []});
  const result = spawnSync(process.execPath, ['--input-type=module'], {input: output.outputFiles[0].text, encoding: 'utf8', timeout: 20_000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /STORE_READ_TERMINAL_RETRY_ABORT_OWNER_KEEPALIVE_DRAFT_PASS/); t.diagnostic(result.stdout.trim());
});
