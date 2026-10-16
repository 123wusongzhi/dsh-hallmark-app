import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('business dirty drafts can be explicitly discarded after a real engine revision conflict without losing independent input', async () => {
 const built=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:uiFixturePrelude()+`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
const values=new Map();const clone=value=>value===undefined?value:structuredClone(value);
const store={get:(ns,key)=>clone(values.get(ns+':'+key)),put:(ns,key,value)=>values.set(ns+':'+key,clone(value)),list:ns=>[...values].filter(([key])=>key.startsWith(ns+':')).map(([,value])=>clone(value)),transaction:fn=>fn()};
let forbidden=0;const deny=async()=>{forbidden++;throw Error('No external execution permitted');};
const engine=new Engine({store,source:{load:async()=>{throw Error('Local source-unavailable boundary');}},transport:{execute:deny,inspect:deny},reviewer:{review:deny}});
const product=uiProduct();const row={rowId:'row',action:'price',target:{offerId:'PRICE'},payload:{name:product.title,price:'20',currency_code:product.currency},pricing:{mode:'manual'}};
let plan=await engine.create({storeId:'shop',rows:[row]});const other=await engine.create({storeId:'shop',rows:[{...row,target:{offerId:'OTHER'}}]});
let tree,active=true,session='s',listMode='ok',writeMode='ok',releaseWrite,release;const requests=[];
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'board'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 const body=JSON.parse(options.body);requests.push(body);
 if(body.operation==='list'){
  if(listMode==='hold')await new Promise(resolve=>release=resolve);
  if(listMode==='fail')return Response.json({status:'failed',error:{message:'LOCAL_LIST_FAILURE'}});
  return Response.json({status:'ok',data:{plans:listMode==='missing'?[other]:[engine.get(plan.planId),other]}});
 }
 if(body.operation==='revise'){
  if(writeMode==='hold-unknown')await new Promise(resolve=>releaseWrite=resolve);
  if(['unknown','hold-unknown'].includes(writeMode))return Response.json({status:'unknown',error:{message:'LOCAL_UNKNOWN',retryPolicy:'inspect_only'}});
  try{return Response.json({status:'ok',data:await engine.revise(body.input)});}catch(error){return Response.json({status:'failed',error:{code:'BUSINESS_OPERATION_FAILED',message:error.message,retryPolicy:'never'}});}
 }
 throw Error('Unexpected '+body.operation);
};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const change=async(label,value)=>act(async()=>{const node=tree.root.findByProps({'aria-label':label});assert.ok(!node.props.disabled,label);node.props.onChange({target:typeof value==='boolean'?{checked:value}:{value}});await settle();});
const click=async name=>act(async()=>{const node=button(name);assert.ok(node,name);assert.ok(!node.props.disabled,name);node.props.onClick();await settle();});
const render=async()=>act(async()=>{const el=<BusinessOperations sessionId={session} storeId='shop' active={active}/>;if(tree)tree.update(el);else tree=create(el);await settle();});
const price=()=>tree.root.findByProps({'aria-label':'PRICE 售价'}).props.value;
const count=op=>requests.filter(r=>r.operation===op).length;
try{
 await render();await click('确认整批范围后提交');const oldSubmit=tree.root.findByProps({'aria-label':'提交范围确认'}).findAllByType('button').at(-1).props.onClick;await click('返回检查');await change('新增销售货号','KEEP-NEW-FORM');await change('PRICE 售价','77');
 plan=await engine.revise({planId:plan.planId,expectedRevision:1,rows:[{...row,payload:{...row.payload,price:'25'}}]});assert.equal(plan.revision,2);
 await click('保存改价草稿');assert.match(text(tree.toJSON()),/BUSINESS_PLAN_VERSION_CHANGED/);assert.equal(price(),'77');
 const before=requests.length;await click('放弃未保存修改');await click('保留修改');assert.equal(requests.length,before);assert.equal(price(),'77');
 await change('筛选商品','not-present');await click('清除筛选');assert.equal(price(),'77');
 await click('放弃未保存修改');const stale=button('确认放弃并重新读取').props.onClick;await change('PRICE 售价','78');assert.equal(button('确认放弃并重新读取'),undefined);await act(async()=>{stale();await settle();});assert.equal(price(),'78');assert.equal(requests.length,before);
 await change('选择 PRICE',true);await change('批量填写售价','99');
 await change('PRICE 定价方式','automatic');await change('PRICE 完整字段','{invalid');await click('应用字段修改');assert.match(text(tree.toJSON()),/字段格式有误/);
 await click('放弃未保存修改');await click('保留修改');assert.equal(tree.root.findByProps({'aria-label':'PRICE 完整字段'}).props.value,'{invalid');
 await click('放弃未保存修改');await click('确认放弃并重新读取');assert.equal(count('list'),2);await act(async()=>{oldSubmit();await settle();});assert.equal(count('submit'),0);assert.equal(price(),'25');assert.equal(tree.root.findByProps({'aria-label':'PRICE 定价方式'}).props.value,'manual');assert.equal(tree.root.findByProps({'aria-label':'新增销售货号'}).props.value,'KEEP-NEW-FORM');assert.ok(!text(tree.toJSON()).includes('尚未保存'));assert.equal(tree.root.findByProps({'aria-label':'选择 PRICE'}).props.checked,false);
 await change('选择 PRICE',true);assert.equal(tree.root.findByProps({'aria-label':'批量填写售价'}).props.value,'');
 await change('PRICE 售价','30');await click('保存改价草稿');assert.equal(engine.get(plan.planId).rows[0].payload.price,'30');assert.equal(requests.filter(r=>r.operation==='revise').at(-1).input.expectedRevision,2);
 // Failed read retains the independent new-action form and never selects the other batch.
 await change('PRICE 售价','31');await click('放弃未保存修改');listMode='fail';await click('确认放弃并重新读取');assert.match(text(tree.toJSON()),/LOCAL_LIST_FAILURE/);assert.match(text(tree.toJSON()),/刷新批次重试/);assert.equal(tree.root.findByProps({'aria-label':'操作批次'}).props.value,plan.planId);assert.equal(tree.root.findByProps({'aria-label':'新增销售货号'}).props.value,'KEEP-NEW-FORM');assert.ok(button('添加到草稿').props.disabled);
 listMode='missing';await click('刷新批次');assert.match(text(tree.toJSON()),/未切换到其他批次/);assert.ok(tree.root.findByProps({'aria-label':'操作批次'}).findAllByType('option').some(node=>node.props.value===plan.planId&&text(node)==='原批次暂不可读取')); assert.equal(tree.root.findByProps({'aria-label':'操作批次'}).props.value,plan.planId);assert.equal(tree.root.findByProps({'aria-label':'新增销售货号'}).props.value,'KEEP-NEW-FORM');
 listMode='ok';await click('刷新批次');assert.equal(price(),'30');
 const navigationReads=count('list');await click('新建批次');await click('放弃新增输入并切换');assert.equal(tree.root.findByProps({'aria-label':'操作批次'}).props.value,'');assert.equal(count('list'),navigationReads);await change('操作批次',other.planId);assert.equal(tree.root.findByProps({'aria-label':'操作批次'}).props.value,other.planId);assert.equal(count('list'),navigationReads);await change('操作批次',plan.planId);assert.equal(price(),'30');
 // Hiding cancels the old local confirmation; showing retains edits.
 await change('PRICE 售价','32');await click('放弃未保存修改');const hiddenStale=button('确认放弃并重新读取').props.onClick;const prior=requests.length;active=false;await render();active=true;await render();assert.equal(button('确认放弃并重新读取'),undefined);await act(async()=>{hiddenStale();await settle();});assert.equal(price(),'32');assert.equal(requests.length,prior);
 // Another owner's recovery cache survives a discard in this owner.
 session='other-session';await render();await change('PRICE 售价','88');session='s';await render();await click('恢复修改');assert.equal(price(),'32');await click('放弃未保存修改');const ownerStale=button('确认放弃并重新读取').props.onClick;session='other-session';await render();await act(async()=>{ownerStale();await settle();});await click('恢复修改');assert.equal(price(),'88');session='s';await render();await click('恢复修改');await click('放弃未保存修改');await click('确认放弃并重新读取');session='other-session';await render();await click('恢复修改');assert.equal(price(),'88');
 // An uncertain mutation receipt remains locked, including the discard action.
 await click('放弃未保存修改');const pendingStale=button('确认放弃并重新读取').props.onClick;writeMode='hold-unknown';await click('保存改价草稿');assert.ok(button('放弃未保存修改').props.disabled);const pendingReads=count('list');await act(async()=>{pendingStale();await settle();});assert.equal(count('list'),pendingReads);await act(async()=>{releaseWrite();await settle();});assert.ok(button('放弃未保存修改').props.disabled);assert.ok(button('检查原操作'));assert.equal(forbidden,0);assert.equal(count('submit'),0);
 console.log('DISCARD_CAS_CANCEL_REFRESH_RETRY_SCOPE_STALE_PENDING_PASS');
}finally{if(release)release();if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,['--input-type=module'],{input:built.outputFiles[0].text,encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/DISCARD_CAS_CANCEL_REFRESH_RETRY_SCOPE_STALE_PENDING_PASS/);
});
