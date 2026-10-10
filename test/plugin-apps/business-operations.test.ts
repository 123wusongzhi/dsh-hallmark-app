import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

test('business table saves drafts without submitting, recovers the original request and preserves unrelated rows', async () => {
  const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true }); const directory = mkdtempSync(resolve(root, 'business-ui-'));
  try {
    const entry = resolve(directory, 'ui.mjs');
    await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'business-ui-test.tsx', loader: 'tsx', contents: `
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessOperations,businessOperation} from './packages/plugin-apps/client/business-operations.tsx';
import {businessRowInput} from './packages/app-presentation/src/materials/business-operations.ts';
const pricingConfig={revision:7,defaultPlanId:'light',plans:[{id:'light',name:'轻小件渠道',enabled:true}]};
const quote={status:'ready',storeId:'bill',configRevision:7,planId:'light',planName:'轻小件渠道',currency:'CNY',suggestedPriceMinor:2200,minimumAllowedPriceMinor:1600,breakdown:{purchaseMinor:1200,fixedMinor:100,logisticsMinor:300,commissionMinor:100,totalCostMinor:1700,profitMinor:500,marginPpm:227272},issues:[],warnings:[]};
const row=(rowId,offerId,status='draft')=>({rowId,action:'price',target:{offerId,productId:rowId},payload:{price:'20',currency_code:'CNY'},pricing:{planId:'light',mode:'automatic'},pricingQuote:quote,before:{price:'19',currency_code:'CNY'},revision:1,status,issues:[],corrections:[],repairHistory:{},procurement:[{itemId:'source',sourceSkuId:'red',quantity:2}],binding:{amount:12,currency:'CNY',missing:[],components:[{itemId:'source',sourceSkuId:'red',quantity:2,unitPrice:6,currency:'CNY',unit:'个'}]}});
let plan={planId:'p',storeId:'bill',title:'价格调整',revision:1,status:'draft',rows:[row('one','RED'),row('two','BLUE','succeeded')],createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z'},lost=false,tree,bound=false,releaseList;
const originalFetch=globalThis.fetch,requests=[];
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[{id:'bill',name:'Bill 店铺',connectionId:'board'}]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:pricingConfig});
 const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'businessOperations');assert.equal(body.sessionId,'s');assert.equal(body.connectionId,'board');assert.equal(Object.hasOwn(body,'storeId'),false);
 if(body.operation==='list'){
  if(!bound)return Response.json({error:{code:'connection_not_bound',message:'请先在当前聊天启用此经营连接。'}},{status:409});
  if(releaseList!==undefined)await new Promise(resolve=>{releaseList=resolve;});
  return Response.json({status:'ok',data:{plans:[plan],total:1}});
 }
 if(body.operation==='revise'){
  assert.equal(body.input.expectedRevision,plan.revision);assert.equal(body.input.rows.length,1);assert.equal(body.input.rows[0].rowId,'one');
  for(const key of ['before','binding','context','review','issues','status','pricingQuote'])assert.equal(Object.hasOwn(body.input.rows[0],key),false,key);
  plan={...plan,revision:plan.revision+1,rows:plan.rows.map(r=>r.rowId==='one'?{...r,...body.input.rows[0]}:r)};return Response.json({status:'ok',data:plan});
 }
 if(body.operation==='submit'){plan={...plan,status:'partial',rows:plan.rows.map(r=>r.rowId==='one'?{...r,status:'unknown'}:r)};if(lost){lost=false;throw Error('response lost');}return Response.json({status:'pending',operation:{operationId:'op'}});}
 if(body.operation==='request')return Response.json({settled:false,operationId:'op'});
 if(body.operation==='get') {assert.deepEqual(body.input,{operationId:'op'});return Response.json({status:'ok',data:plan});}
 if(body.operation==='inspect'){plan={...plan,status:'done',rows:plan.rows.map(r=>({...r,status:'succeeded'}))};return Response.json({status:'ok',data:plan});}
 if(body.operation==='restore'){assert.deepEqual(body.input.rowIds,['two']);return Response.json({status:'ok',data:{...plan,planId:'restore',title:'恢复：价格调整',status:'draft',rows:[row('restore-two','BLUE')]}});}
 throw Error('unexpected '+body.operation);
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>{const node=button(name);assert.ok(node,name);assert.equal(!!node.props.disabled,false,name);await act(async()=>{node.props.onClick();await settle();});};
try{
 await act(async()=>{tree=create(<BusinessOperations sessionId="s" storeId="bill"/>);await settle();});
 assert.match(JSON.stringify(tree.toJSON()),/请先在当前聊天启用此经营连接/);
 bound=true;releaseList=null;
 await click('刷新批次');assert.equal(button('正在读取…').props.disabled,true,'pending reads show loading');
 await act(async()=>{releaseList();releaseList=undefined;await settle();});
 assert.doesNotMatch(JSON.stringify(tree.toJSON()),/请先在当前聊天启用此经营连接/,'successful refresh clears obsolete connection error');
 assert.match(JSON.stringify(tree.toJSON()),/Bill 店铺/);assert.match(JSON.stringify(tree.toJSON()),/12 CNY/);
 assert.match(JSON.stringify(tree.toJSON()),/轻小件渠道/);assert.match(JSON.stringify(tree.toJSON()),/22.00 CNY/);assert.match(JSON.stringify(tree.toJSON()),/规则修订/);
 assert.deepEqual(businessRowInput(plan.rows[0],{...plan.rows[0].payload,name:'changed only title'}).pricing,{planId:'light',mode:'automatic'});
 const located={...plan.rows[0],referenceSubjects:[{sourceImageUrl:'https://source.test/photo.png',subject:'左侧银色主体'}]};
 assert.deepEqual(businessRowInput(located,{...located.payload,name:'changed only title'}).referenceSubjects,located.referenceSubjects);
 assert.equal(businessRowInput(located).payload.referenceSubjects,undefined);
 await act(async()=>{tree.root.findByProps({'aria-label':'RED 售价'}).props.onChange({target:{value:'22'}});});
 assert.equal(button('提交整批变更').props.disabled,true,'save local edits before submit');
 await click('保存草稿');assert.equal(plan.rows[0].payload.price,'22');assert.deepEqual(plan.rows[0].pricing,{planId:'light',mode:'manual'});assert.equal(plan.rows[1].status,'succeeded');assert.equal(requests.filter(r=>r.operation==='submit').length,0,'saving does not review or submit');
 await act(async()=>{tree.root.findByProps({'aria-label':'RED 定价方式'}).props.onChange({target:{value:'automatic'}});tree.root.findByProps({'aria-label':'选择 RED'}).props.onChange({target:{checked:true}});});
 await act(async()=>{tree.root.findByProps({'aria-label':'批量填写售价'}).props.onChange({target:{value:'24'}});});
 await click('填入所选 1 行草稿');await click('保存草稿');assert.equal(plan.rows[0].payload.price,'24');assert.deepEqual(plan.rows[0].pricing,{planId:'light',mode:'manual'},'batch price override switches to manual and preserves plan');
 assert.equal(tree.root.findByProps({'aria-label':'BLUE 售价'}).props.disabled,true);
 lost=true;await click('提交整批变更');assert.ok(button('检查原操作'));assert.equal(button('提交整批变更').props.disabled,true);
 await click('检查原操作');assert.equal(requests.filter(r=>r.operation==='submit').length,1,'recovery never repeats original submit');assert.match(JSON.stringify(tree.toJSON()),/结果待核查/);
 assert.equal(tree.root.findByProps({'aria-label':'RED 售价'}).props.disabled,true);
 await click('核查平台状态');assert.equal(plan.rows[0].status,'succeeded');
 await act(async()=>{tree.root.findByProps({'aria-label':'选择 BLUE'}).props.onChange({target:{checked:true}});});
 await click('恢复所选已完成项');assert.equal(requests.filter(r=>r.operation==='submit').length,1,'restoration only creates a draft');
 assert.match(JSON.stringify(tree.toJSON()),/恢复草稿/);
 await act(async()=>tree.unmount());tree=undefined;
 // Partial replies carry a plan in data, just like ok replies.
 globalThis.fetch=async()=>Response.json({status:'partial',data:plan});
 const received=await businessOperation({sessionId:'s',connectionId:'board',storeId:'bill'},'get',{planId:'p'});assert.equal(received.planId,'p');
 console.log('BUSINESS_UI_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
` }, banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" }, outfile: entry, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-test-renderer'] });
    const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr); assert.match(result.stdout, /BUSINESS_UI_PASS/);
  } finally { assert.ok(resolve(directory).startsWith(root + sep + 'business-ui-')); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
});

test('new price drafts support default and chosen logistics rules and automatic price can be empty', async () => {
  const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true }); const directory = mkdtempSync(resolve(root, 'business-pricing-ui-'));
  try {
    const entry = resolve(directory, 'ui.mjs');
    await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'business-pricing-ui-test.tsx', loader: 'tsx', contents: `
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
const originalFetch=globalThis.fetch,created=[];let tree,dynamic=false;
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[{id:'bill',name:'Bill',connectionId:'board'}]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:{revision:7,...(dynamic?{logisticsSelection:'automatic'}:{}),defaultPlanId:'light',plans:[{id:'light',name:'轻小件渠道',enabled:true},{id:'bulky',name:'大件渠道',enabled:true}]}});
 const body=JSON.parse(options.body);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:[]}});
 if(body.operation==='create'){
  created.push(body.input.rows[0]);const row={...body.input.rows[0],rowId:'row-'+created.length,revision:1,status:'draft',issues:[],corrections:[],repairHistory:{}};
  return Response.json({status:'ok',data:{planId:'new-'+created.length,storeId:'bill',title:body.input.title,revision:1,status:'draft',rows:[row],createdAt:'2026-10-10',updatedAt:'2026-10-10'}});
 }
 throw Error('unexpected operation '+body.operation);
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const change=async(label,value)=>act(async()=>{tree.root.findByProps({'aria-label':label}).props.onChange({target:{value}});await settle();});
const submit=async()=>act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});await settle();});
const newBatch=async()=>act(async()=>{tree.root.findAllByType('button').find(node=>text(node)==='新建批次').props.onClick();await settle();});
try{
 await act(async()=>{tree=create(<BusinessOperations sessionId="pricing-test" storeId="bill"/>);await settle();});
 assert.equal(tree.root.findByProps({'aria-label':'新增 物流方案'}).props.value,'');
 assert.equal(tree.root.findByProps({'aria-label':'新增 定价方式'}).props.value,'automatic');
 assert.equal(tree.root.findByProps({'aria-label':'新增目标售价'}).props.required,false);
 await change('新增销售货号','DEFAULT');await submit();assert.deepEqual(created[0].pricing,{mode:'automatic'});assert.equal(Object.hasOwn(created[0].payload,'price'),false);
 await newBatch();await change('新增销售货号','CHOSEN');await change('新增 物流方案','bulky');await submit();assert.deepEqual(created[1].pricing,{planId:'bulky',mode:'automatic'});assert.equal(Object.hasOwn(created[1].payload,'price'),false);
 await newBatch();await change('新增销售货号','MANUAL');await change('新增 物流方案','light');await change('新增目标售价','25.50');
 assert.equal(tree.root.findByProps({'aria-label':'新增 定价方式'}).props.value,'manual');await submit();assert.deepEqual(created[2].pricing,{planId:'light',mode:'manual'});assert.equal(created[2].payload.price,'25.50');
 await newBatch();await change('新增销售货号','BACK-AUTO');await change('新增目标售价','99');await change('新增 定价方式','automatic');
 assert.equal(tree.root.findByProps({'aria-label':'新增目标售价'}).props.value,'');await submit();assert.deepEqual(created[3].pricing,{mode:'automatic'});assert.equal(Object.hasOwn(created[3].payload,'price'),false);
 // Refreshing to automatic logistics does not carry a selected fixed plan into a new draft.
 await newBatch();await change('新增销售货号','DYNAMIC');await change('新增 物流方案','bulky');dynamic=true;
 await act(async()=>{tree.root.findAllByType('button').find(node=>text(node)==='刷新批次').props.onClick();await settle();});
 assert.equal(tree.root.findAllByProps({'aria-label':'新增 物流方案'}).length,0);assert.match(JSON.stringify(tree.toJSON()),/条件重合取总费用较高/);
 await change('新增目标售价','135');await submit();assert.deepEqual(created[4].pricing,{mode:'manual'});assert.equal(created[4].payload.price,'135');
 await newBatch();await change('新增销售货号','DYNAMIC-AUTO');await submit();assert.deepEqual(created[5].pricing,{mode:'automatic'});assert.equal(Object.hasOwn(created[5].payload,'price'),false);
 console.log('BUSINESS_PRICING_UI_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
` }, banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" }, outfile: entry, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-test-renderer'] });
    const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr); assert.match(result.stdout, /BUSINESS_PRICING_UI_PASS/);
  } finally { assert.ok(resolve(directory).startsWith(root + sep + 'business-pricing-ui-')); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
});
