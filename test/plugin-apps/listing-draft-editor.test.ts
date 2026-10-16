import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import {realCollection} from '../real-data/corpus.ts';

test('listing corrections survive interruptions and save through the real draft engine without submitting', async t => {
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'listing-draft-editor-'));
 try {
  const entry=resolve(directory,'ui.mjs');
  await build({stdin:{resolveDir:process.cwd(),sourcefile:'listing-draft-editor-test.tsx',loader:'tsx',contents:`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
import {BusinessSourceValidationError} from './packages/app-hallmark/src/operations/types.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';
${uiFixturePrelude()}
const recordedPurchase=${JSON.stringify(realCollection(1).skus[0].purchaseCost)};
const source=uiProduct({},1),store=uiStore({id:'listing-shop',connectionId:'listing-board'});
const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'listing-draft-ui');
let reviews=0,writes=0,failSave=false,releaseSave,sourceFault;
const engine=new Engine({store:port,source:{async load({storeId,row}){
 if(sourceFault==='validation')throw new BusinessSourceValidationError([{code:'LOCAL_VALIDATION_FAULT',field:'name',message:'标题校验暂未通过，请修正后保存。'}]);
 if(sourceFault==='unavailable')throw Error('来源读取暂不可用，请稍后重试。');
 return {
 identity:{storeId,...row.target},current:{},source,
 procurement:[{itemId:source.id,sourceSkuId:source.sku,unitPrice:recordedPurchase.amount,currency:recordedPurchase.currency,unit:recordedPurchase.unit??'来源 SKU 销售单位'}],
 assets:[{url:source.image,contentHash:'recorded-image'}],
 issues:row.payload.name?[]:[{code:'TITLE_REQUIRED',field:'name',message:'请补充商品标题。',suggestion:'使用采集资料中的商品名称。'}]
};}},reviewer:{async review(){reviews++;throw Error('Draft correction must not invoke review');}},transport:{async execute(){writes++;throw Error('Draft correction must not publish');},async inspect(){throw Error('Unexpected platform inspection');}}});
// Missing fields, sales aliases, target price and packaging values are explicit local UI fault/input controls.
const payload={offer_id:'DRAFT-A',name:'',description:'',images:[],primary_image:'',price:'20',currency_code:'CNY',attributes:[{id:4191,values:[{value:'保留的类目属性'}]}],custom_platform_field:{keep:true},weight:300,weight_unit:'g',height:10,width:20,depth:30,dimension_unit:'mm'};
const procurement=[{itemId:source.id,sourceSkuId:source.sku,quantity:1}];
let plan=await engine.create({storeId:store.id,title:'上品内容待修正',rows:[{action:'listing',target:{offerId:'DRAFT-A'},payload,procurement},{action:'listing',target:{offerId:'DRAFT-B'},payload:{...payload,offer_id:'DRAFT-B',name:source.title},procurement}]});
const originalSecond=structuredClone(plan.rows[1]),requests=[],originalFetch=globalThis.fetch;let tree;
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[store]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(String(url),'/api/dsh-apps','No external endpoint is allowed');
 const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'businessOperations');
 assert.equal(body.connectionId,'listing-board');assert.equal(body.sessionId,'listing-session');
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:engine.list(store.id)}});
 if(body.operation==='revise'){
  if(failSave){failSave=false;return Response.json({status:'failed',error:{code:'DRAFT_SAVE_REJECTED',message:'本次保存未生效，请重试。'}},{status:409});}
  if(releaseSave!==undefined)await new Promise(resolve=>{releaseSave=resolve;});
  plan=await engine.revise(body.input);return Response.json({status:'ok',data:plan});
 }
 throw Error('Unexpected operation '+body.operation);
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>{const node=button(name);assert.ok(node,name);assert.equal(!!node.props.disabled,false,name);await act(async()=>{node.props.onClick();await settle();});};
const change=async(label,value)=>act(async()=>{tree.root.findByProps({'aria-label':label}).props.onChange({target:{value}});await settle();});
try {
 await act(async()=>{tree=create(<BusinessOperations sessionId="listing-session" storeId={store.id}/>);await settle();});
 assert.equal(plan.rows[0].issues[0].code,'TITLE_REQUIRED');
 assert.match(text(tree.root),/重量来源状态尚未确认/,'older providers remain explicitly unknown, not falsely locked');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 发货总重量'}).props.disabled,false);
 assert.equal(button('按当前包装规则更新草稿').props.disabled,false);
 assert.equal(tree.root.findAllByProps({'aria-label':'DRAFT-A 商品标题'}).length,1,'A listing with missing content must expose a labeled title field, without requiring JSON editing');
 assert.match(JSON.stringify(tree.toJSON()),/请补充商品标题/);
 await change('DRAFT-A 完整字段','{ unfinished JSON');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.disabled,true);
 assert.equal(tree.root.findByProps({'aria-label':'筛选商品'}).props.disabled,true);
 assert.equal(button('保存草稿').props.disabled,true);
 assert.equal(button('确认整批范围后提交').props.disabled,true);
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 完整字段'}).props.value,'{ unfinished JSON');
 await click('应用字段修改');assert.match(text(tree.root),/字段格式有误/);
 assert.equal(tree.root.findByProps({'aria-label':'操作批次'}).props.disabled,true);
 await click('放弃字段修改');
 await change('DRAFT-A 商品标题',source.title);
 const structured=JSON.parse(tree.root.findByProps({'aria-label':'DRAFT-A 完整字段'}).props.value);
 assert.equal(structured.name,source.title,'structured edit syncs into advanced JSON');
 await change('DRAFT-A 完整字段',JSON.stringify({...structured,description:'applied JSON description'}));
 await click('应用字段修改');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品说明'}).props.value,'applied JSON description','applying JSON syncs back into structured form');
 assert.equal(button('保存草稿').props.disabled,false,'typing immediately enables Save');
 assert.equal(button('刷新批次').props.disabled,true,'refresh cannot discard an unfinished correction');
 assert.equal(button('确认整批范围后提交').props.disabled,true,'unsaved edits cannot be submitted');
 assert.equal(tree.root.findByProps({'aria-label':'操作批次'}).props.disabled,true);
 await change('DRAFT-A 商品说明',source.title+'，内容修正测试');
 await change('DRAFT-A 主图地址',source.image);await change('DRAFT-A 商品图片',source.image+'\\n');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品图片'}).props.value,source.image+'\\n','typing a line break must not collapse the gallery field');
 await change('DRAFT-A 发货总重量','350');await change('DRAFT-A 发货包装长','32');
 assert.equal(requests.some(row=>row.operation==='revise'),false,'typing never saves implicitly');
 const beforeSave=JSON.stringify(plan);
 await change('筛选商品','no-matching-product');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.value,source.title,'filtering keeps the editor and unsaved values');
 await change('筛选商品','');await change('编辑的上品',plan.rows[1].rowId);
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-B 商品标题'}).props.value,source.title);
 await change('编辑的上品',plan.rows[0].rowId);
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 发货总重量'}).props.value,350,'switching sale rows preserves corrections');
 failSave=true;await click('保存草稿');assert.match(JSON.stringify(tree.toJSON()),/本次保存未生效/);
 assert.equal(button('保存草稿').props.disabled,false);assert.equal(JSON.stringify(plan),beforeSave);
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.value,source.title,'failed saves preserve edits');
 releaseSave=null;await click('保存草稿');assert.equal(button('保存草稿').props.disabled,true);
 assert.equal(button('确认整批范围后提交').props.disabled,true,'cannot submit during pending save');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.disabled,true);
 const savesBefore=requests.filter(row=>row.operation==='revise').length;
 await act(async()=>{button('保存草稿').props.onClick();await settle();});
 assert.equal(requests.filter(row=>row.operation==='revise').length,savesBefore,'repeated save cannot duplicate a pending mutation');
 await act(async()=>{releaseSave();releaseSave=undefined;await settle();});
 const saved=engine.get(plan.planId);assert.equal(saved.rows[0].payload.name,source.title);assert.equal(saved.rows[0].payload.weight,350);assert.equal(saved.rows[0].payload.depth,32);
 assert.deepEqual(saved.rows[0].payload.images,[source.image]);assert.equal(saved.rows[0].payload.primary_image,source.image);
 assert.equal(saved.rows[0].payload.weight_unit,payload.weight_unit);assert.equal(saved.rows[0].payload.dimension_unit,payload.dimension_unit);
 assert.deepEqual(saved.rows[0].payload.attributes,payload.attributes);assert.deepEqual(saved.rows[0].payload.custom_platform_field,payload.custom_platform_field);
 assert.deepEqual(saved.rows[0].procurement,procurement);assert.deepEqual(saved.rows[1],originalSecond,'unrelated sale is unchanged');
 assert.equal(saved.rows[0].status,'draft');assert.equal(reviews,0);assert.equal(writes,0);assert.equal(requests.some(row=>row.operation==='submit'),false);
 assert.equal(button('保存草稿').props.disabled,true);assert.equal(button('确认整批范围后提交').props.disabled,false);
 await click('刷新批次');assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 发货总重量'}).props.value,350);
 await click('确认整批范围后提交');
 const confirmation=tree.root.findByProps({'aria-label':'提交范围确认'});
 assert.ok(text(confirmation).includes(source.title),'listing confirmation shows the title being submitted');
 assert.ok(text(confirmation).includes(source.title+'，内容修正测试'),'listing confirmation shows description');
 assert.ok(text(confirmation).includes(source.image),'listing confirmation shows image addresses');
 assert.match(text(confirmation),/350/,'listing confirmation shows packaging weight');
 assert.match(text(confirmation),/32/,'listing confirmation shows packaging length');
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.disabled,true,'listing editing is locked during confirmation');
 assert.equal(tree.root.findByProps({'aria-label':'编辑的上品'}).props.disabled,true);
 await click('返回检查');assert.equal(writes,0);assert.equal(reviews,0);
 // Explicit provider faults exercise the real engine's validation-result path, not HTTP save rejection.
 for(const fault of ['validation','unavailable']) {
  sourceFault=fault;
  const correction=source.title+' · '+fault;
  await change('DRAFT-A 商品标题',correction);
  await click('保存草稿');
  const invalid=engine.get(plan.planId).rows[0];
  assert.equal(invalid.payload.name,correction,'validation failure retains the actual saved input');
  assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.value,correction);
  assert.equal(invalid.issues[0].code,fault==='validation'?'LOCAL_VALIDATION_FAULT':'SOURCE_UNAVAILABLE');
  assert.ok(text(tree.root).includes(invalid.issues[0].message),'validation result must remain visible after successful draft persistence');
  assert.equal(button('保存草稿').props.disabled,true,'persisted validation failure is not an unsaved HTTP failure');
  sourceFault=undefined;
  await change('DRAFT-A 商品标题',source.title);
  await click('保存草稿');
  const recovered=engine.get(plan.planId).rows[0];
  assert.equal(recovered.payload.name,source.title);
  assert.deepEqual(recovered.issues,[],'correcting and saving reruns validation without submission');
  assert.equal(text(tree.root).includes(invalid.issues[0].message),false,'superseded diagnostic disappears');
  assert.deepEqual(recovered.payload.attributes,payload.attributes);
  assert.deepEqual(recovered.payload.custom_platform_field,payload.custom_platform_field);
  assert.equal(recovered.payload.weight,350);
  assert.deepEqual(recovered.procurement,procurement);
  assert.equal(reviews,0);assert.equal(writes,0);
  assert.equal(requests.some(row=>row.operation==='submit'),false);
 }

 const other={...saved,planId:'another-batch',title:'另一个独立批次',rows:[{...saved.rows[1],rowId:'another-row',target:{offerId:'OTHER-BATCH'}}]};
 port.put('business_plans',other.planId,other);await click('刷新批次');
 await change('编辑的上品',saved.rows[1].rowId);
 await change('操作批次',other.planId);
 assert.equal(tree.root.findAllByProps({'aria-label':'DRAFT-B 商品标题'}).length,0,'old listing editor does not leak across batches');
 assert.equal(tree.root.findByProps({'aria-label':'OTHER-BATCH 商品标题'}).props.value,source.title);
 await change('操作批次',saved.planId);
 assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 发货总重量'}).props.value,350);
 const terminal={...saved,rows:saved.rows.map(row=>({...row,status:'unknown'}))};port.put('business_plans',terminal.planId,terminal);
 await click('刷新批次');assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 商品标题'}).props.disabled,true);assert.equal(tree.root.findByProps({'aria-label':'DRAFT-A 主图地址'}).props.disabled,true);
 assert.equal(reviews,0);assert.equal(writes,0);
 console.log('LISTING_DRAFT_EDITOR_PASS: actionable correction, row/filter persistence, failed save retry, source-validation recovery, duplicate guard, preserved fields, terminal lock, review=0, transport=0');
} finally {if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;db.close();}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.error?.message??result.stdout+result.stderr);assert.match(result.stdout,/LISTING_DRAFT_EDITOR_PASS/);t.diagnostic(result.stdout.trim());
 } finally {assert.ok(resolve(directory).startsWith(root+sep+'listing-draft-editor-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
