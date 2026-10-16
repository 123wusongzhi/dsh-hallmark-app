import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BusinessSettings} from './packages/plugin-apps/client/business-settings.tsx';
import {AppsRuntime,RuntimeStore} from './packages/app-runtime/src/index.ts';
import {OzonBusinessGateway} from './packages/ozon-business/src/index.ts';
import {BusinessSettingsService} from './packages/service/src/business-settings.ts';
import {classifyServerError} from './packages/service/src/apps-server.ts';
import {BusinessPricingRepository} from './packages/business-pricing/src/index.ts';
import {BusinessPackagingRepository} from './packages/business-packaging/src/index.ts';
import {StableHallmarkBusinessStore} from './packages/app-hallmark/src/store.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const directory=mkdtempSync(join(tmpdir(),'packaging-input-')),db=new RuntimeStore(':memory:'),runtime=new AppsRuntime(db);
runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'hallmark',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[],execute:async()=>{throw Error('No platform calls');},dispose:async()=>{}});
runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Local replay',enabled:true,configRevision:1,config:{}});
let platformCalls=0;
const gateway=new OzonBusinessGateway(directory,{fetchImpl:async()=>{platformCalls++;throw Error('No merchant network');}});
const store=new StableHallmarkBusinessStore(db,{connectionId:'local',scopeId:'input-recovery'}),packaging=new BusinessPackagingRepository(store),pricing=new BusinessPricingRepository(store);
const product={...recorded,id:'local-product',skus:recorded.skus.slice(0,2).map((sku,index)=>({...sku,id:index?'blue':'red'}))};
const collection={getProduct:async(id)=>{assert.equal(id,product.id);return structuredClone(product);},search:async()=>({items:[{id:product.id,title:product.title,skuCount:2,source:product.source}],total:1})};
const service=new BusinessSettingsService(runtime,gateway,()=>pricing,{packagingFor:()=>packaging,collectionFor:()=>collection});
const requests=[],failures=[];let tree,failCompositionRead=false,holdCompositionRead=false,releaseCompositionRead;const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 assert.ok(String(url).startsWith('/api/dsh-apps'));
 if(!options?.body)return Response.json(service.read('local'));
 const {action,sessionId,...body}=JSON.parse(options.body);assert.equal(action,'businessSettings');requests.push(body);
 try{
  if(body.operation==='packaging.read'&&body.input.compositions){
   if(scenario==='reordered'&&requests.filter(row=>row.operation==='packaging.read'&&row.input.compositions).length>1)body.input.compositions[0].members.reverse();
   if(holdCompositionRead)await new Promise(resolve=>releaseCompositionRead=resolve);
   if(failCompositionRead)throw Error('controlled composition read failure');
  }
  return Response.json(await service.write(body));}catch(error){const failure=classifyServerError(error,false);failures.push(failure);return Response.json({error:{code:failure.code,message:failure.message}},{status:failure.status});}
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.type==='style'?'':node?.children?.map(text).join('')??'';
const field=name=>tree.root.findByProps({'aria-label':name});
const enabled=node=>{for(let current=node;current;current=current.parent)assert.notEqual(current.props.disabled,true,'Control and ancestors must be enabled');};
const change=async(name,value)=>act(async()=>{const node=field(name);enabled(node);node.props.onChange({target:{value}});await settle();});
const click=async name=>act(async()=>{const node=tree.root.findAllByType('button').find(n=>text(n)===name);assert.ok(node,name);enabled(node);node.props.onClick();await settle();});
const saves=()=>requests.filter(row=>row.operation==='packaging.save').length;
try{
 await act(async()=>{tree=create(<BusinessSettings/>);await settle();});await click('查找商品');
 await act(async()=>{const checkbox=tree.root.findByProps({className:'packaging-search-item'}).findByType('input');enabled(checkbox);checkbox.props.onChange({target:{checked:true}});await settle();});await click('读取所选商品的包装');
 const check=async()=>act(async()=>{const node=field('选择当前表格所有包装行');enabled(node);node.props.onChange({target:{checked:true}});await settle();});
 const combo=()=>tree.root.findAllByType('tr').find(row=>row.props['data-packaging-key']?.startsWith('["combination"'));
 const comboField=name=>combo().findAllByType('input').find(node=>node.props['aria-label']===name);
 const comboChange=async(name,value)=>act(async()=>{const node=comboField(name);enabled(node);node.props.onChange({target:{value}});await settle();});
 await check();await click('用所选 SKU 建立组合');await change('red 组成数量','2');await click('计算组合并加入表格');await click('保存包装修改');
 const saved=packaging.list().find(row=>row.target.kind==='combination');assert.ok(saved);assert.equal(saved.revision,1);

 const edit=async()=>{await comboChange('red weight','0.88');await comboChange('red length','30');await comboChange('red width','12');await comboChange('red height','8');};
 const writeOther=()=>packaging.saveOverrides([{target:saved.target,expectedRevision:1,values:{weightKg:.99}}]);
 if(scenario==='clean'){
  writeOther();await click('修改组成另存');const count=saves();await click('计算组合并加入表格');
  assert.equal(saves(),count);assert.equal(comboField('red weight').props.value,'0.99','clean row accepts reread');
  await click('保存包装修改');assert.equal(requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows[0].expectedRevision,2);
 }else if(scenario==='changed'||scenario==='reordered'){
  await edit();await click('修改组成另存');if(scenario==='changed')await change('red 组成数量','3');const count=saves();await click('计算组合并加入表格');
  const combinations=tree.root.findAllByType('tr').filter(row=>row.props['data-packaging-key']?.startsWith('["combination"'));
  assert.equal(combinations.length,2,'different composition creates a separate row');assert.equal(comboField('red weight').props.value,'0.88');assert.equal(saves(),count);
  await click('保存包装修改');const records=packaging.list().filter(row=>row.target.kind==='combination');assert.equal(records.length,2);assert.equal(packaging.readOverride(saved.target).values.weightKg,.88);
 }else if(scenario==='cancel'){
  await edit();const reads=requests.length;await click('修改组成另存');await change('red 组成数量','3');await click('取消组合编辑');
  assert.equal(requests.length,reads);assert.equal(comboField('red weight').props.value,'0.88');assert.equal(packaging.readOverride(saved.target).revision,1);
 }else{
  await edit();await click('修改组成另存');const count=saves();
  if(scenario==='failure'){
   failCompositionRead=true;await click('计算组合并加入表格');assert.equal(comboField('red weight').props.value,'0.88');assert.equal(field('red 组成数量').props.value,2);assert.match(text(tree.root.findByProps({role:'alert'})),/controlled composition read failure/);failCompositionRead=false;
  }
  if(scenario==='conflict')writeOther();
  const lateChange=comboField('red weight').props.onChange;
  holdCompositionRead=true;await click('计算组合并加入表格');assert.equal(comboField('red weight').props.value,'0.88');assert.equal(comboField('red weight').props.disabled,true,'read pending prevents editing');assert.equal(saves(),count);
  if(scenario==='late-edit')await act(async()=>{lateChange({target:{value:'0.91'}});await settle();}); // Explicit stale-handler robustness probe, not native typing.
  await act(async()=>{releaseCompositionRead();await settle();});
  assert.equal(saves(),count,'recompute is read only');
  assert.equal(comboField('red weight').props.value,scenario==='late-edit'?'0.91':'0.88','same-composition read must preserve unsaved weight');
  assert.equal(comboField('red length').props.value,'30','same-composition read must preserve unsaved dimensions');assert.match(text(tree.toJSON()),/未保存的包装修改已保留/);
  await click('保存包装修改');assert.equal(saves(),count+1);
  const submission=requests.filter(row=>row.operation==='packaging.save').at(-1).input.rows[0];assert.equal(submission.expectedRevision,1,'keep original CAS base');
  if(scenario==='conflict'){
   assert.equal(failures.at(-1).code,'PACKAGING_REVISION_CONFLICT');assert.equal(packaging.readOverride(saved.target).values.weightKg,.99);assert.equal(comboField('red weight').props.value,'0.88','conflict preserves local correction');
  }else{
   assert.equal(packaging.readOverride(saved.target).revision,2);assert.deepEqual(packaging.readOverride(saved.target).values,{weightKg:scenario==='late-edit'?.91:.88,dimensionsCm:{length:30,width:12,height:8}});
  }
 }
 assert.equal(platformCalls,0);console.log('PACKAGING_COMPOSITION_CONTINUITY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;await runtime.dispose();db.close();rmSync(directory,{recursive:true,force:true});}
