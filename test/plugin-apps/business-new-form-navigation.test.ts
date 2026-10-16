import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('new business form navigation requires explicit discard and preserves input on cancel', async () => {
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
 await render();
 const value=label=>tree.root.findByProps({'aria-label':label}).props.value;
 const nav=()=>value('操作批次');
 const confirm=()=>button('放弃新增输入并切换');
 const submitNew=async()=>act(async()=>{assert.ok(!button('添加到草稿').props.disabled);tree.root.findByType('form').props.onSubmit({preventDefault(){}});await settle();});
 // Enabled, ordinary event handlers reproduce the original loss path.
 await change('新增销售货号','KEEP');await change('新增目标售价','77');
 await change('操作批次',other.planId);
 assert.equal(nav(),plan.planId,'dirty form navigation must await explicit discard');
 await click('继续编辑');assert.equal(value('新增销售货号'),'KEEP');assert.equal(value('新增目标售价'),'77');
 await click('新建批次');await click('放弃新增输入并切换');assert.equal(nav(),'');
 await change('操作批次',plan.planId);assert.equal(value('新增销售货号'),'');
 // Initial automatic/default pricing is clean; net-zero edits are also clean.
 await change('新增销售货号','TEMP');await change('新增销售货号','');
 await change('新增 定价方式','manual');await change('新增 定价方式','automatic');
 await change('操作批次',other.planId);assert.equal(nav(),other.planId);assert.equal(confirm(),undefined);
 await change('操作批次',plan.planId);
 // Hidden inputs, not merely visible price/offer, participate in the full snapshot.
 await change('新增动作','stock');await change('新增数量','8');await change('新增仓库编号','4');await change('新增动作','price');
 await change('操作批次',other.planId);assert.ok(confirm());await click('继续编辑');
 await change('新增动作','stock');assert.equal(value('新增数量'),'8');assert.equal(value('新增仓库编号'),'4');
 await click('新建批次');const editedStale=confirm().props.onClick;await change('新增数量','9');assert.equal(confirm(),undefined);
 await act(async()=>{editedStale();await settle();});assert.equal(nav(),plan.planId);assert.equal(value('新增数量'),'9');
 // A newer target cancels the old decision, even if the input is unchanged.
 await change('操作批次',other.planId);const targetStale=confirm().props.onClick;await click('新建批次');
 await act(async()=>{targetStale();await settle();});assert.equal(nav(),plan.planId);await click('继续编辑');
 await click('新建批次');const sameTargetStale=confirm().props.onClick;await change('操作批次',plan.planId);assert.equal(confirm(),undefined);await act(async()=>{sameTargetStale();await settle();});assert.equal(nav(),plan.planId);
 // Hide/show invalidates the confirmation, without losing this owner's input.
 await click('新建批次');const hiddenStale=confirm().props.onClick;active=false;await render();active=true;await render();
 assert.equal(confirm(),undefined);await act(async()=>{hiddenStale();await settle();});assert.equal(nav(),plan.planId);assert.equal(value('新增数量'),'9');
 // Explicit discard clears only this form through the actual keyed navigation.
 await change('操作批次',other.planId);await click('放弃新增输入并切换');assert.equal(nav(),other.planId);
 await change('操作批次',plan.planId);assert.equal(value('新增销售货号'),'');
 await change('新增动作','promotion.enroll');await change('新增活动编号','6');await change('新增动作','price');
 await click('新建批次');assert.ok(confirm());await click('继续编辑');
 // Stored-row edits independently invalidate pending navigation. Discarding them keeps the new form.
 await click('新建批次');const storedStale=confirm().props.onClick;await change('PRICE 售价','29');assert.equal(confirm(),undefined);await act(async()=>{storedStale();await settle();});assert.equal(nav(),plan.planId);
 await click('放弃未保存修改');await click('确认放弃并重新读取');await change('新增动作','promotion.enroll');assert.equal(value('新增活动编号'),'6');
 // Owner changes are external: do not claim to block them or leak another owner's form.
 await click('新建批次');const ownerStale=confirm().props.onClick;session='new-owner';await render();
 await act(async()=>{ownerStale();await settle();});assert.equal(nav(),plan.planId);assert.equal(value('新增销售货号'),'');assert.equal(confirm(),undefined);
 // Local save remains enabled despite new-form dirty, and known failure retains input.
 await change('新增销售货号','NEW-LOCAL');await change('新增目标售价','88');
 plan=await engine.revise({planId:plan.planId,expectedRevision:1,rows:[{...row,payload:{...row.payload,price:'25'}}]});
 await submitNew();assert.match(text(tree.toJSON()),/BUSINESS_PLAN_VERSION_CHANGED/);assert.equal(value('新增销售货号'),'NEW-LOCAL');assert.equal(value('新增目标售价'),'88');assert.ok(!button('添加到草稿').props.disabled);
 // Refresh that retains the batch does not reset new input. Saving through real engine works.
 await click('刷新批次');await submitNew();assert.equal(engine.get(plan.planId).rows.length,2);assert.equal(value('新增销售货号'),'NEW-LOCAL');
 // Busy and unknown receipts retire prior confirmations and retain the unsubmitted form.
 await click('新建批次');const busyStale=confirm().props.onClick;writeMode='hold-unknown';await submitNew();assert.equal(confirm(),undefined);
 await act(async()=>{busyStale();await settle();});assert.equal(nav(),plan.planId);assert.equal(value('新增目标售价'),'88');
 await act(async()=>{releaseWrite();await settle();});assert.ok(button('检查原操作'));assert.ok(button('新建批次').props.disabled);assert.equal(value('新增销售货号'),'NEW-LOCAL');
 assert.equal(forbidden,0);assert.equal(count('submit'),0);assert.equal(count('create'),0);
 console.log('NEW_FORM_NAVIGATION_PASS');
}finally{if(release)release();if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,['--input-type=module'],{input:built.outputFiles[0].text,encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/NEW_FORM_NAVIGATION_PASS/);
});
