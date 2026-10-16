import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realDetail} from '../real-data/corpus.ts';

test('listing packaging UI respects real source priority and explicitly updates a saved draft',async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'listing-packaging-'));
 try{
  const entry=resolve(directory,'ui.mjs');
  await build({stdin:{resolveDir:process.cwd(),sourcefile:'listing-packaging-test.tsx',loader:'tsx',contents:`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessOperations as Board} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
import {HallmarkBusinessAdapter} from './packages/app-hallmark/src/operations-adapter.ts';
import {publicPlan} from './packages/app-hallmark/src/operations-provider.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';
import {CollectionService} from './packages/collection/src/index.ts';
import {BusinessPackagingRepository} from './packages/business-packaging/src/index.ts';
const recorded=${JSON.stringify(realDetail(1))};
// Package absence and sale alias are controlled local faults. Product/SKU facts stay recorded.
const detail={...recorded,id:'source',package:{}};
const sku=String(detail.skus[0].sourceSkuId??detail.skus[0].code??detail.skus[0].id);
const database=new RuntimeStore(':memory:'),store=new HallmarkStorePort(database,'connection');
const ok=raw=>({status:'ok',raw});let writes=0,reviews=0;
const client={getStores:async()=>ok([{id:'bill'}]),getStoreProducts:async()=>ok({products:[]}),getCollectedItemDetail:async()=>ok(detail)};
const gateway={hasStore:id=>id==='bill',listStores:()=>[{id:'bill',sourceConnectionId:'connection'}],getStore:()=>({id:'bill',enabled:true,credentialRevision:1}),request:async()=>{throw Error('No platform calls');}};
const collection=new CollectionService({store,client}),packaging=new BusinessPackagingRepository(store);
const adapter=new HallmarkBusinessAdapter({store,client,broker:{},gateway,collection,packaging});
const engine=new Engine({store,source:adapter,transport:{execute(){writes++;throw Error('No dispatch');},inspect(){throw Error('No inspection');}},reviewer:{review(){reviews++;throw Error('No review');}}});
let plan=await engine.create({storeId:'bill',rows:['FIRST','SECOND'].map(offerId=>({action:'listing',target:{offerId},payload:{offer_id:offerId,name:detail.title,price:'20',currency_code:'CNY',custom_unknown:{keep:true}},procurement:[{itemId:'source',sourceSkuId:sku,quantity:1}]}))});
let tree,requests=[],hold=false,release;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[{id:'bill',name:'Fixture',connectionId:'connection'}]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(String(url),'/api/dsh-apps');const body=JSON.parse(options.body);requests.push(body);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:engine.list('bill').map(p=>publicPlan(p))}});
 if(body.operation==='revise'){if(hold)await new Promise(resolve=>release=resolve);plan=await engine.revise(body.input);return Response.json({status:'ok',data:publicPlan(plan)});}
 throw Error('Unexpected operation '+body.operation);
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const field=label=>tree.root.findByProps({'aria-label':label});
const button=label=>tree.root.findAllByType('button').find(node=>text(node)===label);
const change=async(label,value)=>act(async()=>{assert.equal(!!field(label).props.disabled,false,label);field(label).props.onChange({target:{value}});await settle();});
const click=async label=>act(async()=>{assert.ok(button(label),label);assert.equal(!!button(label).props.disabled,false,label);button(label).props.onClick();await settle();});
const update='按当前包装规则更新草稿';
try{
 await act(async()=>{tree=create(<Board sessionId="packaging-ui" storeId="bill"/>);await settle();});
 assert.equal(field('FIRST 发货总重量').props.disabled,false);
 assert.equal(field('FIRST 尺寸单位').findAllByType('option').some(option=>option.props.value==='m'),false);
 await change('FIRST 发货总重量','0.2');await change('FIRST 重量单位','kg');
 await change('FIRST 发货包装长','50');await change('FIRST 发货包装宽','40');await change('FIRST 发货包装高','30');await change('FIRST 尺寸单位','cm');
 assert.equal(button(update).props.disabled,true,'unsaved content guards rule update');
 await click('保存草稿');assert.equal(field('FIRST 发货总重量').props.value,200);assert.equal(field('FIRST 发货包装长').props.value,500);
 assert.equal(field('FIRST 尺寸单位').props.value,'mm');assert.equal(field('FIRST 发货总重量').props.disabled,false);
 // Raw unsupported units remain visible and fixable, with field-level feedback and no false success notice.
 const invalid={...plan.rows[0].payload,dimension_unit:'m',custom_unknown:{keep:true}};
 await change('FIRST 完整字段',JSON.stringify(invalid));assert.equal(button(update).props.disabled,true);
 await click('应用字段修改');await click('保存草稿');
 assert.equal(field('FIRST 尺寸单位').props.value,'m');assert.match(text(tree.root),/尺寸单位仅支持 mm 或 cm/);assert.match(text(tree.root),/草稿已保留，但包装填写仍有问题/);
 await change('FIRST 尺寸单位','mm');await click('保存草稿');assert.deepEqual(plan.rows[0].payload.custom_unknown,{keep:true});
 // Only weight is maintained first: dimensions stay editable and preserve valid draft values.
 packaging.saveOverride({kind:'sku',itemId:'source',sourceSkuId:sku},{weightKg:.05},0);
 const previousRevision=plan.revision;await click(update);
 assert.ok(plan.revision>previousRevision);assert.equal(field('FIRST 发货总重量').props.value,50);assert.equal(field('FIRST 发货总重量').props.disabled,true);
 assert.equal(field('FIRST 发货包装长').props.value,500);assert.equal(field('FIRST 发货包装长').props.disabled,false);
 assert.match(text(tree.root),/更新前重量：200 g/);assert.ok(text(tree.root).includes('重量采用来源/包装设置：50 g'));
 assert.match(text(tree.root),/重新解析定价等经营字段；未提交商品/);
 packaging.saveOverride({kind:'sku',itemId:'source',sourceSkuId:sku},{weightKg:.05,dimensionsCm:{length:10,width:8,height:2}},1);
 await click(update);assert.equal(field('FIRST 发货包装长').props.value,100);assert.equal(field('FIRST 发货包装长').props.disabled,true);assert.equal(field('FIRST 尺寸单位').props.disabled,true);
 // Rule-backed invalid legacy JSON remains compatible and the adopted rule values are visible outside details.
 await change('FIRST 完整字段',JSON.stringify({...plan.rows[0].payload,weight:-1,dimension_unit:'m'}));await click('应用字段修改');await click('保存草稿');
 assert.equal(field('FIRST 发货总重量').props.value,50);assert.equal(field('FIRST 尺寸单位').props.value,'mm');assert.equal(plan.rows[0].issues.some(i=>i.code==='PACKAGING_DRAFT_INVALID'),false);
 assert.match(text(tree.root.findByProps({className:'apps-listing-package-summary'})),/100 × 80 × 20 mm/);
 const sameRevision=plan.revision;await click(update);assert.equal(plan.revision,sameRevision);assert.equal(field('FIRST 发货总重量').props.value,50);assert.match(text(tree.root),/规则未变时数值保持不变/);
 await change('编辑的上品',plan.rows[1].rowId);await change('SECOND 商品标题',detail.title+' test');await change('编辑的上品',plan.rows[0].rowId);assert.equal(button(update).props.disabled,true,'another sale dirty prevents update');await click('保存草稿');
 hold=true;await click(update);assert.equal(button(update).props.disabled,true);await act(async()=>{release();hold=false;await settle();});
 await click('确认整批范围后提交');assert.equal(button(update).props.disabled,true);await click('返回检查');
 const terminal={...plan,rows:plan.rows.map(row=>({...row,status:'unknown'}))};store.put('business_plans',plan.planId,terminal);await click('刷新批次');assert.equal(button(update).props.disabled,true);
 assert.equal(writes,0);assert.equal(reviews,0);assert.ok(requests.every(r=>['list','revise'].includes(r.operation)));
 console.log('LISTING_PACKAGING_UI_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;database.close();}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);assert.match(result.stdout,/LISTING_PACKAGING_UI_PASS/);
 }finally{assert.ok(directory.startsWith(root+sep+'listing-packaging-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
