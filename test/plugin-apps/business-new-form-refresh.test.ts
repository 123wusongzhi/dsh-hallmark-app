import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

for (const cleanControl of [false, true, 'write']) test((cleanControl === 'write' ? 'recovered and explicitly new forms still save once' : cleanControl ? 'clean refresh negative controls' : 'batch refresh preserves new-form input without retargeting missing batches'), async () => {
 const built=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:uiFixturePrelude()+`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
const values=new Map();const clone=value=>value===undefined?value:structuredClone(value);
const store={get:(ns,key)=>clone(values.get(ns+':'+key)),put:(ns,key,value)=>values.set(ns+':'+key,clone(value)),list:ns=>[...values].filter(([key])=>key.startsWith(ns+':')).map(([,value])=>clone(value)),transaction:fn=>fn()};
let forbidden=0;const deny=async()=>{forbidden++;throw Error('No external execution permitted');};
const engine=new Engine({store,source:{load:async()=>{throw Error('Local source-unavailable boundary');}},transport:{execute:deny,inspect:deny},reviewer:{review:deny}});
const product=uiProduct();const row={rowId:'row',action:'price',target:{offerId:'PRICE'},payload:{name:product.title,price:'20',currency_code:product.currency},pricing:{mode:'manual'}};
const plan=await engine.create({storeId:'shop',rows:[row]});const other=await engine.create({storeId:'shop',rows:[{...row,target:{offerId:'OTHER'}}]});
let tree,active=true,session='s',storeId='shop',listMode='ok',release;const requests=[];
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'board'}),uiStore({id:'second-shop',connectionId:'second-board'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(String(url),'/api/dsh-apps');
 const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'businessOperations');
 if(body.operation==='list'){
  const responseRows=body.input.storeId!=='shop'?[]:listMode==='empty'?[]:listMode==='missing'?[other]:[engine.get(plan.planId),other];
  if(listMode==='hold')await new Promise(resolve=>release=resolve);
  if(listMode==='fail')return Response.json({status:'failed',error:{message:'LOCAL_LIST_FAILURE'}});
  return Response.json({status:'ok',data:{plans:responseRows}});
 }
 if(body.operation==='revise')return Response.json({status:'ok',data:await engine.revise(body.input)});
 if(body.operation==='create')return Response.json({status:'ok',data:await engine.create(body.input)});
 throw Error('Unexpected '+body.operation);
};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const change=async(label,value)=>act(async()=>{const node=tree.root.findByProps({'aria-label':label});assert.ok(!node.props.disabled,label);node.props.onChange({target:typeof value==='boolean'?{checked:value}:{value}});await settle();});
const click=async name=>act(async()=>{const node=button(name);assert.ok(node,name);assert.ok(!node.props.disabled,name);node.props.onClick();await settle();});
const render=async()=>act(async()=>{const el=<BusinessOperations sessionId={session} storeId={storeId} active={active}/>;if(tree)tree.update(el);else tree=create(el);await settle();});
const count=op=>requests.filter(r=>r.operation===op).length;
try{
 await render();
 const value=label=>tree.root.findByProps({'aria-label':label}).props.value;
 const nav=()=>value('操作批次');
 const confirm=()=>button('放弃新增输入并切换');
${cleanControl === 'write' ? `
 const submit=async()=>act(async()=>{assert.ok(!button('添加到草稿').props.disabled);tree.root.findByType('form').props.onSubmit({preventDefault(){}});await settle();});
 await change('新增销售货号','RECOVERED');await change('新增目标售价','77');listMode='missing';await click('刷新批次');assert.ok(button('添加到草稿').props.disabled);
 listMode='ok';await click('刷新批次');await submit();assert.equal(count('revise'),1);assert.equal(engine.get(plan.planId).rows.length,2);assert.equal(engine.get(plan.planId).rows[1].target.offerId,'RECOVERED');
 await click('新建批次');await click('放弃新增输入并切换');await change('新增销售货号','EXPLICIT-NEW');await change('新增目标售价','66');await submit();assert.equal(count('create'),1);assert.equal(count('revise'),1);assert.notEqual(nav(),plan.planId);assert.equal(engine.get(nav()).rows[0].target.offerId,'EXPLICIT-NEW');assert.equal(forbidden,0);assert.equal(count('submit'),0);
` : cleanControl ? ` // Net-zero edits and empty lists keep ordinary clean fallback.
 await change('新增销售货号','TEMP');await change('新增销售货号','');
 listMode='missing';await click('刷新批次');assert.equal(nav(),other.planId);assert.equal(value('新增销售货号'),'');assert.equal(confirm(),undefined);
 listMode='empty';await click('刷新批次');assert.equal(nav(),'');assert.equal(value('新增销售货号'),'');assert.ok(!button('添加到草稿').props.disabled);
 assert.equal(forbidden,0);assert.equal(count('create'),0);assert.equal(count('revise'),0);
` : ` // Ordinary enabled refresh is reachable while the new-item form is dirty.
 await change('新增销售货号','KEEP');await change('新增目标售价','77');
 const staleSubmit=tree.root.findByType('form').props.onSubmit;
 listMode='missing';await click('刷新批次');
 await act(async()=>{staleSubmit({preventDefault(){}});tree.root.findByType('form').props.onSubmit({preventDefault(){}});await settle();});
 assert.equal(nav(),plan.planId,'missing selected batch must not auto-retarget a dirty form');
 assert.equal(value('新增销售货号'),'KEEP');assert.equal(value('新增目标售价'),'77');
 assert.match(text(tree.toJSON()),/原批次暂不可读取/);
 assert.match(text(tree.toJSON()),/新增输入已保留/);
 assert.ok(button('添加到草稿').props.disabled);
 assert.equal(count('create'),0);assert.equal(count('revise'),0);
 // Repeated empty results and failures retain the same owner and input.
 listMode='empty';await click('刷新批次');assert.equal(nav(),plan.planId);assert.equal(value('新增销售货号'),'KEEP');
 listMode='fail';await click('刷新批次');assert.equal(nav(),plan.planId);assert.equal(value('新增目标售价'),'77');assert.ok(button('添加到草稿').props.disabled);
 // Missing-batch navigation keeps the existing explicit discard/cancel behavior.
 listMode='missing';await click('刷新批次');await change('操作批次',other.planId);await click('继续编辑');assert.equal(value('新增销售货号'),'KEEP');
 // Recovery re-enables the same form without writing or changing its key.
 listMode='ok';await click('刷新批次');assert.equal(nav(),plan.planId);assert.equal(value('新增目标售价'),'77');assert.ok(!button('添加到草稿').props.disabled);
 // Missing batch plus explicit discard navigates; a late old confirmation cannot restore it.
 listMode='missing';await click('刷新批次');await click('新建批次');const oldDiscard=confirm().props.onClick;await click('放弃新增输入并切换');assert.equal(nav(),'');assert.equal(value('新增销售货号'),'');
 await act(async()=>{oldDiscard();await settle();});assert.equal(nav(),'');
 // Clean fallback remains automatic, including net-zero input.
 listMode='ok';await click('刷新批次');await change('操作批次',plan.planId);await change('新增销售货号','TEMP');await change('新增销售货号','');
 listMode='missing';await click('刷新批次');assert.equal(nav(),other.planId);assert.equal(value('新增销售货号'),'');assert.equal(confirm(),undefined);
 // Even an explicit new-batch form is kept on refresh; it must not attach itself to the first batch.
 await click('新建批次');await change('新增销售货号','NEW');await change('新增目标售价','42');listMode='ok';await click('刷新批次');assert.equal(nav(),'');assert.equal(value('新增销售货号'),'NEW');assert.ok(!button('添加到草稿').props.disabled);
 // Hide/show starts an ordinary reload without dropping the missing batch's draft.
 await change('操作批次',plan.planId);await click('放弃新增输入并切换');await change('新增销售货号','HIDDEN');listMode='missing';active=false;await render();active=true;await render();assert.equal(nav(),plan.planId);assert.equal(value('新增销售货号'),'HIDDEN');
 // An old in-flight response cannot revive or carry data into a new session.
 listMode='hold';await click('刷新批次');const oldRelease=release;listMode='ok';session='new-owner';await render();assert.equal(value('新增销售货号'),'');await act(async()=>{oldRelease();await settle();});assert.equal(value('新增销售货号'),'');assert.equal(nav(),plan.planId);
 // Store isolation and a retired same-owner request also cannot revive the abandoned input.
 await change('新增销售货号','STORE-PRIVATE');storeId='second-shop';await render();assert.equal(value('新增销售货号'),'');storeId='shop';await render();assert.equal(value('新增销售货号'),'');
 await change('新增销售货号','LATEST');listMode='hold';await click('刷新批次');const staleList=release;active=false;await render();listMode='missing';active=true;await render();assert.equal(nav(),plan.planId);assert.equal(value('新增销售货号'),'LATEST');await click('新建批次');await click('放弃新增输入并切换');assert.equal(nav(),'');listMode='ok';await act(async()=>{staleList();await settle();});assert.equal(nav(),'');assert.equal(value('新增销售货号'),'');
 assert.equal(forbidden,0);assert.equal(count('submit'),0);assert.equal(count('create'),0);assert.equal(count('revise'),0);
`} console.log('NEW_FORM_REFRESH_PASS');
}finally{if(release)release();if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,['--input-type=module'],{input:built.outputFiles[0].text,encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/NEW_FORM_REFRESH_PASS/);
});
