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
import {BusinessPricingRepository,legacyReferenceDraft} from './packages/business-pricing/src/index.ts';
import {StableHallmarkBusinessStore} from './packages/app-hallmark/src/store.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const directory=mkdtempSync(join(tmpdir(),'pricing-recovery-')),db=new RuntimeStore(':memory:'),runtime=new AppsRuntime(db);
runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Hallmark',providerPackage:'hallmark',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[],execute:async()=>{throw Error('No platform calls allowed');},dispose:async()=>{}});
runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Local replay',enabled:true,configRevision:1,config:{}});
let platformCalls=0;
const gateway=new OzonBusinessGateway(directory,{fetchImpl:async()=>{platformCalls++;throw Error('No merchant network allowed');}});
const shop=gateway.saveStore({name:uiStore().name,expectedRevision:0,sourceConnectionId:'local'});
const pricing=new BusinessPricingRepository(new StableHallmarkBusinessStore(db,{connectionId:'local',scopeId:'validation-recovery'}));
const initial=legacyReferenceDraft();initial.plans[0]={...initial.plans[0],fixedMinor:recordedPricingSettings.fixedMinor,logisticsMicrosPerGram:recordedPricingSettings.logisticsMicrosPerGram,commissionPpm:recordedPricingSettings.commissionPpm};pricing.save(shop.id,initial,0);
const service=new BusinessSettingsService(runtime,gateway,()=>pricing),requests=[],failures=[];let tree;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 assert.ok(String(url).startsWith('/api/dsh-apps'),'Only isolated local transport');
 if(!options?.body){const query=new URL(String(url),'http://local.test').searchParams;return Response.json(service.read(query.get('connectionId')??undefined,query.get('storeId')??undefined));}
 const {action,sessionId,...body}=JSON.parse(options.body);assert.equal(action,'businessSettings');assert.equal(body.operation,'pricing.save');requests.push(body);
 try{return Response.json(await service.write(body));}catch(error){const failure=classifyServerError(error,false);failures.push(failure);return Response.json({status:'failed',error:{code:failure.code,message:failure.message,retryPolicy:failure.retryPolicy}},{status:failure.status});}
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.type==='style'?'':node?.children?.map(text).join('')??'';
const control=name=>{const label=tree.root.findAllByType('label').find(node=>text(node.children[0])===name);assert.ok(label,name);return label.findAll(node=>node.type==='input'||node.type==='select')[0];};
const enabled=node=>{for(let current=node;current;current=current.parent)assert.notEqual(current.props.disabled,true,'Control and ancestors must be enabled');};
const change=async(name,value)=>act(async()=>{const node=control(name);enabled(node);node.props.onChange({target:{value}});await settle();});
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>act(async()=>{const node=button(name);assert.ok(node,name);enabled(node);node.props.onClick();await settle();});
try{
 await act(async()=>{tree=create(<BusinessSettings storeId={shop.id}/>);await settle();});
 await change('最低允许售价（元，可选）','100');await change('最高允许售价（元，可选）','50');
 await click('保存已修改的经营规则');
 assert.equal(failures.at(-1).code,'INVALID_PRICING_CONFIG');assert.equal(pricing.read(shop.id).revision,1);assert.equal(control('最低允许售价（元，可选）').props.value,'100');assert.equal(control('最高允许售价（元，可选）').props.value,'50');
 const alert=text(tree.root.findByProps({role:'alert'}));console.log(JSON.stringify({scenario:'invalid-price-bounds',alert,repositoryRevision:pricing.read(shop.id).revision,inputsPreserved:true}));
 assert.match(alert,/最高允许售价/);assert.match(alert,/最高售价不能低于最低售价/);
 // Cancel is read-only and preserves the rejected draft; correction saves exactly once.
 await click('重新读取');await click('保留修改');assert.equal(control('最高允许售价（元，可选）').props.value,'50');assert.equal(requests.length,1);
 await change('最高允许售价（元，可选）','150');await click('保存已修改的经营规则');assert.equal(pricing.read(shop.id).revision,2);assert.equal(pricing.read(shop.id).maxPriceMinor,15000);assert.equal(tree.root.findAllByProps({role:'alert'}).length,0);
 await change('固定费用（元／销售件）','');await click('保存已修改的经营规则');assert.equal(pricing.read(shop.id).revision,2);assert.equal(control('固定费用（元／销售件）').props.value,'');
 const requiredAlert=text(tree.root.findByProps({role:'alert'}));assert.match(requiredAlert,/固定费用/);assert.match(requiredAlert,/填写/);assert.match(requiredAlert,/方案/);
 await change('固定费用（元／销售件）','4');await click('保存已修改的经营规则');assert.equal(pricing.read(shop.id).revision,3);assert.equal(pricing.read(shop.id).plans[0].fixedMinor,400);
 assert.equal(platformCalls,0);assert.equal(requests.length,4);
 console.log(JSON.stringify({scenario:'cancel-correct-retry-required-field',rejectedWrites:2,successfulWrites:2,finalRevision:3,platformCalls}));console.log('PRICING_VALIDATION_RECOVERY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;db.close();rmSync(directory,{recursive:true,force:true});}
