import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const fixture = `
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessSettings} from './packages/plugin-apps/client/business-settings.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const originalFetch=globalThis.fetch,requests=[],reads=[];let tree,holdStoreSave=false,releaseStoreSave;
const store=(id,name)=>({id,name,platform:'ozon',sourceConnectionId:'board',revision:3,credentialRevision:1,hasCredentials:true,enabled:true,currency:'CNY',createdAt:'2026-10-10',updatedAt:'2026-10-10'});
let stores=[store('bill','Bill 店铺'),store('helen','Helen 店铺')];
let config={schemaVersion:1,storeId:'bill',revision:7,updatedAt:'2026-10-10',currency:'CNY',defaultPlanId:'light',plans:[
 {id:'light',name:'轻小件渠道',enabled:true,fixedMinor:1400,logisticsMicrosPerGram:85000,commissionPpm:150000},
 {id:'heavy',name:'大件渠道',enabled:true,fixedMinor:2000,logisticsMicrosPerGram:60000,commissionPpm:100000}],
 listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:20000,maxAutoPriceMinor:13500,minPriceMinor:null,maxPriceMinor:null,
 source:{kind:'legacy-platform',description:'从原平台导入的报价方案',importedAt:'2026-10-10'}};
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=businessSettings')){
  const query=new URL(String(url),'http://local.test').searchParams;reads.push(Object.fromEntries(query));
  const selected=stores.find(row=>row.id===(query.get('storeId')??'bill'));
  return Response.json({connections:[{connectionId:'board',displayName:'原采集平台'}],connectionId:'board',stores,store:selected,pricing:{...config,storeId:selected.id}});
 }
 const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'businessSettings');assert.equal(body.connectionId,'board');
 assert.equal(Object.hasOwn(body,'sessionId'),false,'traditional settings do not require a chat');
 if(body.operation==='pricing.quote')return Response.json({quote:{status:'ready',planId:body.input.planId??'heavy',planName:'大件渠道',selectionMode:config.logisticsSelection??'fixed',selectionReason:'两个方案重合，按总费用较高的大件渠道计算。',suggestedPlanId:'light',suggestedPlanName:'轻小件渠道',configRevision:7,suggestedPriceMinor:4500,minimumAllowedPriceMinor:3600,breakdown:{purchaseMinor:343,fixedMinor:1400,logisticsMinor:1700,commissionMinor:675,profitMinor:382,marginPpm:84888},issues:[],warnings:[]}});
 if(body.operation==='store.save'){
  if(holdStoreSave)await new Promise(resolve=>{releaseStoreSave=resolve;});
  const previous=stores.find(row=>row.id===body.input.id);assert.equal(body.input.expectedRevision,previous.revision);
  const next={...previous,name:body.input.name,revision:previous.revision+1};stores=stores.map(row=>row.id===next.id?next:row);return Response.json({store:next});
 }
 if(body.operation==='pricing.save'){config={...body.input.config,storeId:body.input.storeId,revision:8,updatedAt:'2026-10-10'};return Response.json({pricing:config});}
 throw Error('unexpected request '+body.operation);
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const control=name=>{const label=tree.root.findAllByType('label').find(node=>text(node.children[0])===name);assert.ok(label,'field '+name);return label.findAll(node=>node.type==='input'||node.type==='select')[0];};
const change=async(name,value)=>act(async()=>{control(name).props.onChange({target:{value}});await settle();});
const click=async name=>{const node=button(name);assert.ok(node,'button '+name);assert.equal(!!node.props.disabled,false,name);await act(async()=>{node.props.onClick();await settle();});};
const hasQuote=()=>tree.root.findAllByProps({className:'business-settings-quote'}).length>0;
const choosePlan=async name=>act(async()=>{const node=tree.root.findAllByType('button').find(node=>node.findAllByType('strong').some(strong=>text(strong)===name));assert.ok(node);node.props.onClick();await settle();});
try{
 await act(async()=>{tree=create(<BusinessSettings storeId="bill"/>);await settle();});
`;

async function runScenario(scenario: string): Promise<void> {
  const root = resolve('.test-tmp'); mkdirSync(root, { recursive: true }); const directory = mkdtempSync(resolve(root, 'business-settings-ui-'));
  try {
    const entry = resolve(directory, 'ui.mjs');
    await build({ stdin: { resolveDir: process.cwd(), sourcefile: 'business-settings-ui-test.tsx', loader: 'tsx', contents: `${fixture}
${scenario}
 console.log('BUSINESS_SETTINGS_UI_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
` }, banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" }, outfile: entry, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-test-renderer'] });
    const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr); assert.match(result.stdout, /BUSINESS_SETTINGS_UI_PASS/);
  } finally { assert.ok(resolve(directory).startsWith(root + sep + 'business-settings-ui-')); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
}

test('business settings display imported logistics and pricing values and allow ERP use without a chat', async () => {
  await runScenario(`
 assert.equal(control('店铺名称').props.value,'Bill 店铺');
 assert.equal(control('方案名称').props.value,'轻小件渠道');
 assert.equal(control('固定费用（元／销售件）').props.value,'14');
 assert.equal(control('运费（元／kg）').props.value,'85');
 assert.equal(control('佣金比例（%）').props.value,'15');
 assert.equal(control('上品目标利润率（%）').props.value,'60');
 assert.equal(control('调价目标利润率（%）').props.value,'5');
 assert.equal(control('最低允许利润率（%，可选）').props.value,'2');
 assert.equal(control('上品自动定价上限（元，可选）').props.value,'135');
 assert.equal(control('最低允许售价（元，可选）').props.value,'');
 assert.match(text(tree.toJSON()),/从原平台导入的报价方案/);assert.match(text(tree.toJSON()),/修订 7/);
 assert.equal(control('Client ID').props.value,'');assert.equal(control('API Key').props.value,'');assert.equal(control('API Key').props.type,'password');
 assert.equal(button('保存店铺连接').props.disabled,false);
 await change('采购合计（元）','3.43');await change('计费重量（克）','200');await click('计算价格与利润');
 assert.equal(hasQuote(),true);assert.match(text(tree.toJSON()),/45.00 元/);
 assert.deepEqual(requests.at(-1).input,{storeId:'bill',action:'listing',planId:'light',purchaseMinor:343,weightGrams:200,priceMinor:null,pricingMode:'automatic'});
 `);
});

test('quote disappears when any quote input, plan, refreshed data or selected store changes', async () => {
  await runScenario(`
 await change('采购合计（元）','3.43');await change('计费重量（克）','200');
 for(const [field,value] of [['采购合计（元）','4'],['计费重量（克）','210'],['试算售价（元，留空求建议价）','40'],['用途','promotion.update']]){
  await click('计算价格与利润');assert.equal(hasQuote(),true);
  await change(field,value);assert.equal(hasQuote(),false,'stale quote removed after '+field);
 }
 await click('计算价格与利润');assert.equal(requests.at(-1).input.pricingMode,'manual');assert.equal(requests.at(-1).input.priceMinor,4000);
 await choosePlan('大件渠道');assert.equal(hasQuote(),false);await click('计算价格与利润');assert.equal(requests.at(-1).input.planId,'heavy');
 await click('重新读取');assert.equal(hasQuote(),false);assert.equal(control('方案名称').props.value,'轻小件渠道');
 await click('计算价格与利润');assert.equal(hasQuote(),true);
 await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 assert.equal(hasQuote(),false);assert.equal(control('店铺名称').props.value,'Helen 店铺');
 await click('计算价格与利润');assert.equal(requests.at(-1).input.storeId,'helen');
 await change('经营店铺','bill');assert.equal(hasQuote(),false);assert.equal(control('店铺名称').props.value,'Bill 店铺');
 `);
});

test('saving shop connection preserves unsaved pricing edits, disables edits while pending and keeps CAS revisions', async () => {
  await runScenario(`
 await change('固定费用（元／销售件）','19.99');await change('上品目标利润率（%）','57');await change('店铺名称','Bill 新名称');
 assert.match(text(tree.toJSON()),/有未保存修改/);assert.equal(button('计算价格与利润').props.disabled,true);
 const beforeReads=reads.length;holdStoreSave=true;
 await click('保存店铺连接');assert.equal(tree.root.findByType('fieldset').props.disabled,true,'pending saves disable all editable controls');
 assert.equal(button('重新读取').props.disabled,true);assert.equal(button('保存店铺连接').props.disabled,true);
 await act(async()=>{releaseStoreSave();await settle();});holdStoreSave=false;
 assert.equal(tree.root.findByType('fieldset').props.disabled,false);assert.equal(reads.length,beforeReads,'saving connection must not reload over unsaved rules');
 assert.equal(control('固定费用（元／销售件）').props.value,'19.99');assert.equal(control('上品目标利润率（%）').props.value,'57');
 assert.equal(control('店铺名称').props.value,'Bill 新名称');assert.match(text(tree.toJSON()),/有未保存修改/);assert.equal(button('计算价格与利润').props.disabled,true);
 await click('保存已修改的经营规则');const saved=requests.find(row=>row.operation==='pricing.save');
 assert.equal(saved.input.expectedRevision,7);assert.equal(saved.input.config.plans[0].fixedMinor,1999);assert.equal(saved.input.config.listingTargetMarginPpm,570000);
 assert.equal(requests.filter(row=>row.operation==='store.save').length,1);assert.equal(requests.filter(row=>row.operation==='pricing.save').length,1);
 assert.equal(control('固定费用（元／销售件）').props.value,'19.99');assert.equal(button('计算价格与利润').props.disabled,false);assert.doesNotMatch(text(tree.toJSON()),/有未保存修改/);assert.match(text(tree.toJSON()),/修订 8/);
 `);
});

test('dynamic rules save explicit ranges and quotes select logistics from the price rather than the editor selection', async () => {
  await runScenario(`
 assert.equal(control('物流方案选择').props.value,'fixed','old rules remain explicitly fixed until edited');
 await change('物流方案选择','automatic');await change('适用售价下限（元，含，可选）','135');await change('适用售价上界（元，不含，可选）','200');
 await change('最小计费重量（克，含，可选）','100');await change('最大计费重量（克，含，可选）','500');
 assert.match(text(tree.toJSON()),/总费用最高/);assert.equal(button('设为店铺默认方案'),undefined);
 await click('保存已修改的经营规则');
 const saved=requests.find(row=>row.operation==='pricing.save').input.config;
 assert.equal(saved.logisticsSelection,'automatic');assert.equal(saved.plans[0].minPriceMinor,13500);assert.equal(saved.plans[0].maxPriceExclusiveMinor,20000);
 assert.equal(saved.plans[0].minWeightGrams,100);assert.equal(saved.plans[0].maxWeightGrams,500);
 await change('采购合计（元）','3.43');await change('计费重量（克）','200');await change('试算售价（元，留空求建议价）','135');
 await choosePlan('大件渠道');await click('计算价格与利润');
 assert.equal(requests.at(-1).input.priceMinor,13500);assert.equal(requests.at(-1).input.pricingMode,'manual');assert.equal(Object.hasOwn(requests.at(-1).input,'planId'),false,'choosing an editor tab cannot override dynamic matching');
 assert.match(text(tree.toJSON()),/两个方案重合，按总费用较高的大件渠道计算/);assert.match(text(tree.toJSON()),/建议售价适用：轻小件渠道/);
 `);
});

test('the confirmed two-tier template is a draft and preserves separately configured business limits', async () => {
  await runScenario(`
 await change('上品自动定价上限（元，可选）','300');
 await click('填入两档参考报价草稿');
 assert.equal(requests.length,0,'filling a template does not write settings');
 assert.equal(control('物流方案选择').props.value,'automatic');assert.equal(control('上品自动定价上限（元，可选）').props.value,'300');
 assert.equal(control('上品目标利润率（%）').props.value,'60');assert.equal(control('最低允许利润率（%，可选）').props.value,'2');
 assert.equal(control('固定费用（元／销售件）').props.value,'3.16');assert.equal(control('适用售价上界（元，不含，可选）').props.value,'135');
 assert.equal(button('计算价格与利润').props.disabled,true);
 await click('保存已修改的经营规则');
 const saved=requests.find(row=>row.operation==='pricing.save').input.config;
 assert.equal(saved.plans.length,2);assert.equal(saved.plans[1].fixedMinor,1800);assert.equal(saved.plans[1].minPriceMinor,13500);
 assert.ok(saved.plans.every(row=>row.logisticsMicrosPerGram===39300&&row.commissionPpm===200000));assert.equal(saved.maxAutoPriceMinor,30000);
 `);
});
