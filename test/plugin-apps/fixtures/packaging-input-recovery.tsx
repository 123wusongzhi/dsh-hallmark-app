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
import {BusinessPackagingRepository,packagingValuesSchema} from './packages/business-packaging/src/index.ts';
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
const requests=[],failures=[];let tree;const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 assert.ok(String(url).startsWith('/api/dsh-apps'));
 if(!options?.body)return Response.json(service.read('local'));
 const {action,sessionId,...body}=JSON.parse(options.body);assert.equal(action,'businessSettings');requests.push(body);
 try{return Response.json(await service.write(body));}catch(error){const failure=classifyServerError(error,false);failures.push(failure);return Response.json({error:{code:failure.code,message:failure.message}},{status:failure.status});}
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.type==='style'?'':node?.children?.map(text).join('')??'';
const field=name=>tree.root.findByProps({'aria-label':name});
const enabled=node=>{for(let current=node;current;current=current.parent)assert.notEqual(current.props.disabled,true,'Control and ancestors must be enabled');};
const change=async(name,value)=>act(async()=>{const node=field(name);enabled(node);node.props.onChange({target:{value}});await settle();});
const click=async name=>act(async()=>{const node=tree.root.findAllByType('button').find(n=>text(n)===name);assert.ok(node,name);enabled(node);node.props.onClick();await settle();});
const record=()=>packaging.readOverride({kind:'sku',itemId:product.id,sourceSkuId:'red'});
const saves=()=>requests.filter(row=>row.operation==='packaging.save').length;
try{
 await act(async()=>{tree=create(<BusinessSettings/>);await settle();});await click('查找商品');
 await act(async()=>{const checkbox=tree.root.findByProps({className:'packaging-search-item'}).findByType('input');enabled(checkbox);checkbox.props.onChange({target:{checked:true}});await settle();});await click('读取所选商品的包装');
 assert.equal(tree.root.findAllByType('form').length,0);
 await change('red weight','0.5');await click('保存包装修改');assert.equal(record().values.weightKg,.5);assert.equal(record().revision,1);
 for(const value of ['0','-1','1e999']){await change('red weight',value);const count=saves();await click('保存包装修改');assert.equal(saves(),count);assert.equal(field('red weight').props.value,value);assert.equal(record().revision,1);assert.match(text(tree.root.findByProps({role:'alert'})),/大于 0/);}
 await change('red weight','0.7');await change('red length','30');const count=saves();await click('保存包装修改');assert.equal(saves(),count);assert.match(text(tree.root.findByProps({role:'alert'})),/完整/);
 await change('red width','12');await change('red height','8');await click('保存包装修改');assert.deepEqual(record().values,{weightKg:.7,dimensionsCm:{length:30,width:12,height:8}});assert.equal(record().revision,2);
 // Service maximum is deliberately exercised through an enabled editor. No schema changes.
 const maximum=Number.MAX_SAFE_INTEGER/1_000_000;assert.equal(packagingValuesSchema.safeParse({weightKg:maximum}).success,true);assert.equal(packagingValuesSchema.safeParse({weightKg:maximum+1}).success,false);
 await change('red weight',String(maximum+1));await click('保存包装修改');assert.equal(record().revision,2);assert.equal(failures.at(-1).code,'INVALID_PACKAGING');assert.equal(field('red weight').props.value,String(maximum+1));
 await change('red weight','0.8');await click('保存包装修改');assert.equal(record().revision,3);
 // A genuinely empty weight removes only the weight override. Dimensions remain explicit.
 await change('red weight','');await click('保存包装修改');assert.deepEqual(record().values,{dimensionsCm:{length:30,width:12,height:8}});assert.equal(record().revision,4);assert.equal(field('red weight').props.placeholder,String(product.package.weightGrams/1000));
 await click('恢复自动');assert.deepEqual(record().values,{});assert.equal(record().revision,5);assert.equal(field('red length').props.value,'');assert.equal(field('red length').props.placeholder,String(product.package.dimensionsMm.length/10));
 await change('red weight','0.9');const writes=saves();await click('放弃未保存的修改');assert.equal(saves(),writes);assert.equal(record().revision,5);assert.equal(field('red weight').props.value,'');
 assert.equal(platformCalls,0);console.log(JSON.stringify({localNumericRejections:3,partialDimensionsRejected:true,serviceMaximumRejected:true,finalRevision:5,platformCalls}));console.log('PACKAGING_INPUT_RECOVERY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;await runtime.dispose();db.close();rmSync(directory,{recursive:true,force:true});}
