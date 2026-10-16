import test from 'node:test';
import assert from 'node:assert/strict';
import {build, type Plugin} from 'esbuild';
import {dirname} from 'node:path';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

for(const mode of ['batch','selection','currency','clean'])test('batch refresh continuity: '+mode,async()=>{
 const sourcePath='packages/plugin-apps/client/business-operations.tsx';
 const baseline=process.env.DSH_BATCH_REFRESH_BASELINE==='1';
 const control=process.env.DSH_BATCH_REFRESH_REMOVE_GUARD==='1';
 const historical=baseline?spawnSync('git',['show','be66b2a8c78d9ed38bcc4d08a2925699458b97cc:'+sourcePath],{encoding:'utf8'}):undefined;
 if(historical)assert.equal(historical.status,0,historical.stderr);
 const source=historical?.stdout??readFileSync(sourcePath,'utf8');
 const plugins:Plugin[]=baseline||control?[{name:'batch-refresh-replay',setup(builder){builder.onLoad({filter:/business-operations\.tsx$/},args=>({contents:control?source.replace('newRowDirty.current || batchReadIntent.current || rows.some','newRowDirty.current || rows.some'):source,loader:'tsx',resolveDir:dirname(args.path)}));}}]:[];
 const built=await build({plugins,stdin:{resolveDir:process.cwd(),loader:'tsx',contents:uiFixturePrelude()+`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
const values=new Map();const clone=value=>value===undefined?value:structuredClone(value);
const store={get:(ns,key)=>clone(values.get(ns+':'+key)),put:(ns,key,value)=>values.set(ns+':'+key,clone(value)),list:ns=>[...values].filter(([key])=>key.startsWith(ns+':')).map(([,value])=>clone(value)),transaction:fn=>fn()};
let forbidden=0;const deny=async()=>{forbidden++;throw Error('No external execution permitted');};
const engine=new Engine({store,source:{load:async()=>{throw Error('Local source-unavailable boundary');}},transport:{execute:deny,inspect:deny},reviewer:{review:deny}});
const product=uiProduct();const row={rowId:'shared-row',action:'price',target:{offerId:'PRICE'},payload:{name:product.title,price:'20',currency_code:product.currency},pricing:{mode:'manual'}};
const plan=await engine.create({storeId:'shop',rows:[row]});const other=await engine.create({storeId:'shop',rows:[{...row,target:{offerId:'OTHER'}}]});
const mode=${JSON.stringify(mode)};let tree,active=true,session='s',storeId='shop',listMode='ok',release;const requests=[];
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'board'}),uiStore({id:'second-shop',connectionId:'second-board'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(String(url),'/api/dsh-apps');
 const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'businessOperations');
 if(body.operation==='list'){
  const responseRows=body.input.storeId!=='shop'?[]:listMode==='empty'?[]:listMode==='missing'?[other]:[engine.get(plan.planId),other];
  if(listMode==='hold')await new Promise(resolve=>release=resolve);
  if(['401','403'].includes(listMode))return Response.json({status:'failed',error:{message:'LOCAL_ACCESS_DENIED'}},{status:Number(listMode)});
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
try{
 await render();
 const value=label=>tree.root.findByProps({'aria-label':label}).props.value;
 const nav=()=>value('操作批次');

 await change('选择 PRICE',true);
 if(mode==='batch')await change('批量填写售价','37');
 if(mode==='currency'){await change('批量售价币种',product.currency);await change('选择 PRICE',false);}
 if(mode==='clean'){await change('批量填写售价','37');await change('批量填写售价','');await change('选择 PRICE',false);}
 await change('筛选商品','PRICE');
 listMode='ok';await click('刷新批次');assert.equal(nav(),plan.planId);assert.equal(value('筛选商品'),'PRICE');
 await change('筛选商品','');
 listMode='missing';await click('刷新批次');
 if(mode==='clean'){
   assert.equal(nav(),other.planId,'clean fallback stays available');
   assert.equal(tree.root.findByProps({'aria-label':'选择 OTHER'}).props.checked,false);
 }else{
   if(nav()!==plan.planId)console.log('BASELINE_OTHER_BATCH_SELECTION='+tree.root.findByProps({'aria-label':'选择 OTHER'}).props.checked);
   assert.equal(nav(),plan.planId,'refresh must not retarget selected rows or unapplied price to another batch');
   assert.match(text(tree.toJSON()),/批量输入和勾选已保留/);
   assert.equal(tree.root.findAllByProps({'aria-label':'选择 OTHER'}).length,0);
   assert.ok(button('添加到草稿').props.disabled);
   assert.equal(tree.root.findAllByProps({'aria-label':'PRICE 售价'}).length,0,'No stale editable row retained');
   for(const failure of ['401','403']){listMode=failure;await click('刷新批次');assert.equal(nav(),plan.planId);assert.ok(button('添加到草稿').props.disabled);assert.match(text(tree.toJSON()),/LOCAL_ACCESS_DENIED/);}
   listMode='empty';await click('刷新批次');assert.equal(nav(),plan.planId);
   listMode='fail';await click('刷新批次');assert.equal(nav(),plan.planId);
   listMode='ok';await click('刷新批次');assert.equal(nav(),plan.planId);
   assert.equal(tree.root.findByProps({'aria-label':'选择 PRICE'}).props.checked,mode!=='currency');
   if(mode==='currency')await change('选择 PRICE',true);
   if(mode==='batch')assert.equal(value('批量填写售价'),'37');
   if(mode==='currency')assert.equal(value('批量售价币种'),product.currency);
   // Missing-list recovery does not trap the user in a placeholder.
   listMode='missing';await click('刷新批次');
   // Latest explicit navigation retires the retained selection and batch values.
   await change('操作批次',other.planId);
   assert.equal(tree.root.findByProps({'aria-label':'选择 OTHER'}).props.checked,false);
   await change('选择 OTHER',true);assert.equal(value('批量填写售价'),'');
   // A retired read cannot undo newer explicit navigation or carry state across shops.
   listMode='hold';await click('刷新批次');const stale=release;
   active=false;await render();listMode='missing';active=true;await render();
   await click('新建批次');assert.equal(nav(),'');
   await act(async()=>{stale();await settle();});assert.equal(nav(),'');
   storeId='second-shop';await render();assert.equal(nav(),'');assert.equal(tree.root.findAllByProps({'aria-label':'选择 OTHER'}).length,0);

 }
 assert.equal(forbidden,0);assert.ok(requests.every(r=>r.operation==='list'));
 console.log('BATCH_REFRESH_CONTINUITY_PASS');
}finally{if(release)release();if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnSync(process.execPath,['--input-type=module'],{input:built.outputFiles[0].text,encoding:'utf8',timeout:20000});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/BATCH_REFRESH_CONTINUITY_PASS/);
});
