import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const fixture = `
import React from 'react';
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessSettings} from './packages/plugin-apps/client/business-settings.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const originalFetch=globalThis.fetch,requests=[],reads=[];let tree,holdStoreSave=false,releaseStoreSave,holdRead=false,releaseRead,failPricingSave=false,holdPricingSave=false,releasePricingSave,failNextRead=false;
const store=(id,name)=>({...uiStore({},id==='bill'?0:1),id,name,platform:'ozon',sourceConnectionId:'board',revision:3,credentialRevision:1,hasCredentials:true,enabled:true,currency:'CNY',createdAt:'2026-10-10',updatedAt:'2026-10-10'});
let stores=[store('bill','Bill 店铺'),store('helen','Helen 店铺'),{...store('cross','跨连接测试店铺'),sourceConnectionId:'other'}];
// Pricing ranges and revision transitions are explicit derivatives of the captured pricing settings.
let config={...recordedPricingSettings,schemaVersion:1,storeId:'bill',revision:7,updatedAt:'2026-10-10',currency:'CNY',defaultPlanId:'light',plans:[
 {id:'light',name:'轻小件渠道',enabled:true,fixedMinor:1400,logisticsMicrosPerGram:85000,commissionPpm:150000},
 {id:'heavy',name:'大件渠道',enabled:true,fixedMinor:2000,logisticsMicrosPerGram:60000,commissionPpm:100000}],
 listingTargetMarginPpm:600000,manualTargetMarginPpm:50000,minimumMarginPpm:20000,maxAutoPriceMinor:13500,minPriceMinor:null,maxPriceMinor:null,
 source:{kind:'legacy-platform',description:'从原平台导入的报价方案',importedAt:'2026-10-10'}};
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=businessSettings')){
  const query=new URL(String(url),'http://local.test').searchParams;reads.push(Object.fromEntries(query));if(failNextRead){failNextRead=false;return Response.json({error:{message:'本地模拟读取失败'}},{status:503});}
  const selected=stores.find(row=>row.id===(query.get('storeId')??'bill'));if(query.get('connectionId')&&query.get('connectionId')!==selected.sourceConnectionId)return Response.json({error:{code:'STORE_NOT_FOUND',message:'店铺不属于当前经营连接。'}},{status:404});
  const snapshot={connections:[{connectionId:'board',displayName:'原采集平台'},{connectionId:'other',displayName:'测试其他连接'}],connectionId:selected.sourceConnectionId,stores:stores.filter(row=>row.sourceConnectionId===selected.sourceConnectionId),store:selected,pricing:{...config,storeId:selected.id}};
  if(holdRead){holdRead=false;await new Promise(resolve=>{releaseRead=resolve;});}
  return Response.json(snapshot);
 }
 const body=JSON.parse(options.body);requests.push(body);assert.equal(body.action,'businessSettings');assert.equal(body.connectionId,'board');
 assert.equal(Object.hasOwn(body,'sessionId'),false,'traditional settings do not require a chat');
 if(body.operation==='pricing.quote')return Response.json({quote:{status:'ready',planId:body.input.planId??'heavy',planName:'大件渠道',selectionMode:config.logisticsSelection??'fixed',selectionReason:'两个方案重合，按总费用较高的大件渠道计算。',suggestedPlanId:'light',suggestedPlanName:'轻小件渠道',configRevision:7,suggestedPriceMinor:4500,minimumAllowedPriceMinor:3600,breakdown:{purchaseMinor:343,fixedMinor:1400,logisticsMinor:1700,commissionMinor:675,profitMinor:382,marginPpm:84888},issues:[],warnings:[]}});
 if(body.operation==='store.save'){
  if(holdStoreSave)await new Promise(resolve=>{releaseStoreSave=resolve;});
  const previous=stores.find(row=>row.id===body.input.id);assert.equal(body.input.expectedRevision,previous.revision);
  const next={...previous,name:body.input.name.trim(),revision:previous.revision+1};stores=stores.map(row=>row.id===next.id?next:row);return Response.json({store:next});
 }
 if(body.operation==='pricing.save'){if(holdPricingSave)await new Promise(resolve=>releasePricingSave=resolve);if(failPricingSave)return Response.json({error:{code:'CONFLICT',message:'规则保存失败，请重试。'}},{status:409});config={...body.input.config,storeId:body.input.storeId,revision:8,updatedAt:'2026-10-10'};return Response.json({pricing:config});}
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


test('reload asks before discarding pricing edits; cancellation preserves inputs without reading or writing', async () => {
 await runScenario(`
 globalThis.confirm=()=>{throw Error('No synchronous global dialog');};
 await change('固定费用（元／销售件）','19.99');await change('上品目标利润率（%）','57');
 const before=reads.length;await click('重新读取');
 assert.ok(button('保留修改'));assert.ok(button('放弃并重新读取'));assert.equal(tree.root.findByType('fieldset').props.disabled,false);assert.equal(reads.length,before);assert.equal(requests.length,0);
 assert.equal(control('固定费用（元／销售件）').props.value,'19.99');assert.equal(control('上品目标利润率（%）').props.value,'57');
 assert.equal(control('经营店铺').props.disabled,true);assert.equal(control('采集来源连接').props.disabled,true);
 await click('保留修改');assert.equal(button('放弃并重新读取'),undefined);await click('重新读取');assert.equal(reads.length,before);
 await click('放弃并重新读取');assert.equal(button('保留修改'),undefined);assert.equal(reads.length,before+1);assert.equal(requests.length,0);
 assert.equal(control('固定费用（元／销售件）').props.value,'14');assert.equal(control('上品目标利润率（%）').props.value,'60');assert.equal(control('经营店铺').props.disabled,false);
 await click('重新读取');assert.equal(button('保留修改'),undefined,'clean reload needs no confirmation');assert.equal(reads.length,before+2);
 `);
});

test('failed pricing save retains edits and cancellation still performs no reads', async () => {
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');const before=reads.length;failPricingSave=true;
 await click('重新读取');const beforeSave=button('放弃并重新读取').props.onClick;
 await click('保存已修改的经营规则');await act(async()=>{beforeSave();await settle();});assert.match(text(tree.toJSON()),/规则保存失败/);assert.equal(reads.length,before);
 await click('重新读取');await click('保留修改');assert.equal(reads.length,before);assert.equal(control('固定费用（元／销售件）').props.value,'19.99');assert.equal(requests.length,1);
 failPricingSave=false,holdPricingSave=false,releasePricingSave,failNextRead=false;await click('保存已修改的经营规则');assert.equal(requests.length,2);assert.equal(requests[1].input.config.plans[0].fixedMinor,1999);assert.equal(requests[1].input.expectedRevision,7);
 `);
});

test('discard reload keeps newer edits and store choices isolated from late reads', async () => {
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');holdRead=true;await click('重新读取');await click('放弃并重新读取');
 await change('固定费用（元／销售件）','23');await act(async()=>{releaseRead();await settle();});
 assert.equal(control('固定费用（元／销售件）').props.value,'23');assert.equal(control('经营店铺').props.disabled,true);
 holdRead=true;await click('重新读取');await click('放弃并重新读取');await change('经营店铺','helen');await act(async()=>{releaseRead();await settle();});
 assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(control('固定费用（元／销售件）').props.value,'14');assert.equal(requests.length,0);
 `);
});


test('inline discard intent expires on new edits, identity changes and leaving the active panel', async () => {
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');const before=reads.length;
 await click('重新读取');const stale=button('放弃并重新读取').props.onClick;
 await change('固定费用（元／销售件）','23');assert.equal(button('放弃并重新读取'),undefined);
 await act(async()=>{stale();await settle();});assert.equal(reads.length,before);assert.equal(control('固定费用（元／销售件）').props.value,'23');
 for(const props of [{storeId:'bill',sessionId:'new-session'},{storeId:'helen',sessionId:'new-session'},{storeId:'helen',sessionId:'new-session',active:false}]){
  await click('重新读取');const old=button('放弃并重新读取').props.onClick;
  await act(async()=>{tree.update(<BusinessSettings {...props}/>);await settle();});assert.equal(button('放弃并重新读取'),undefined);
  await act(async()=>{old();await settle();});assert.equal(reads.length,before);assert.equal(requests.length,0);assert.equal(control('固定费用（元／销售件）').props.value,'23');
 }
 `);
});

test('new identity and newer refresh reject older settings responses', async () => {
 await runScenario(`
 holdRead=true;await click('重新读取');config={...config,listingTargetMarginPpm:550000};
 await act(async()=>{tree.update(<BusinessSettings storeId="bill" sessionId="new-session"/>);await settle();});
 assert.equal(control('上品目标利润率（%）').props.value,'55');
 await act(async()=>{releaseRead();await settle();});assert.equal(control('上品目标利润率（%）').props.value,'55');
 holdRead=true;await click('重新读取');config={...config,listingTargetMarginPpm:520000};await click('重新读取');
 assert.equal(control('上品目标利润率（%）').props.value,'52');await act(async()=>{releaseRead();await settle();});
 assert.equal(control('上品目标利润率（%）').props.value,'52');assert.equal(requests.length,0);
 `);
});


test('dirty external store intent is visible and follows once after a successful pricing save', async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');const before=reads.length;
 await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 assert.equal(reads.length,before);assert.equal(control('店铺名称').props.value,'Bill 店铺');
 assert.equal(tree.root.findAllByProps({'aria-label':'工作台店铺切换待处理'}).length,1);
 await click('保存已修改的经营规则');assert.equal(requests.at(-1).input.storeId,'bill');assert.equal(requests.at(-1).input.expectedRevision,7);
 assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(reads.at(-1).storeId,'helen');
 assert.equal(reads.filter(row=>row.storeId==='helen').length,1);assert.equal(tree.root.findAllByProps({'aria-label':'工作台店铺切换待处理'}).length,0);
 `);
});
test('failed pricing save retains dirty editor and pending store without following',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');failPricingSave=true;
 await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await click('保存已修改的经营规则');assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(control('固定费用（元／销售件）').props.value,'19.99');
 assert.match(text(tree.toJSON()),/有未保存修改/);assert.equal(reads.filter(row=>row.storeId==='helen').length,0);
 `);
});
test('not following an external intent preserves edits and independent selection survives later saves',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 const before=reads.length;await click('继续编辑，不跟随本次切换');assert.equal(reads.length,before);assert.equal(requests.length,0);
 await click('保存已修改的经营规则');assert.equal(control('店铺名称').props.value,'Bill 店铺');
 await change('经营店铺','helen');await change('经营店铺','bill');await change('固定费用（元／销售件）','22');await click('保存已修改的经营规则');
 assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(requests.at(-1).input.storeId,'bill');
 `);
});
test('external A B A cancels and newest external target wins over a pending save receipt',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await act(async()=>{tree.update(<BusinessSettings storeId="bill"/>);await settle();});assert.equal(tree.root.findAllByProps({'aria-label':'工作台店铺切换待处理'}).length,0);
 holdPricingSave=true;await click('保存已修改的经营规则');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});await act(async()=>{releasePricingSave();await settle();});
 assert.equal(requests.at(-1).input.storeId,'bill');assert.equal(control('店铺名称').props.value,'跨连接测试店铺');assert.equal(reads.at(-1).connectionId,undefined);
 assert.equal(reads.filter(row=>row.storeId==='helen').length,0);
 `);
});
test('discard-and-switch is inline and stale confirmations cannot discard a new edit or new target',async()=>{
 await runScenario(`
 globalThis.confirm=()=>{throw Error('No synchronous dialogs');};
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await click('放弃修改并切换');const stale=button('确认放弃并切换').props.onClick;await change('固定费用（元／销售件）','22');
 await act(async()=>{stale();await settle();});assert.equal(control('固定费用（元／销售件）').props.value,'22');assert.equal(control('店铺名称').props.value,'Bill 店铺');
 await click('放弃修改并切换');const oldTarget=button('确认放弃并切换').props.onClick;await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 await act(async()=>{oldTarget();await settle();});assert.equal(control('店铺名称').props.value,'Bill 店铺');
 await click('放弃修改并切换');await click('保留修改，不切换');assert.equal(control('固定费用（元／销售件）').props.value,'22');
 await click('放弃修改并切换');await click('确认放弃并切换');assert.equal(control('店铺名称').props.value,'跨连接测试店铺');assert.equal(requests.length,0);
 `);
});
test('clean cross-connection external store resolves by store identity instead of stale explicit connection',async()=>{
 await runScenario(`
 await change('采集来源连接','board');await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 assert.equal(reads.at(-1).connectionId,undefined);assert.equal(reads.at(-1).storeId,'cross');assert.equal(control('店铺名称').props.value,'跨连接测试店铺');
 assert.equal(control('采集来源连接').props.value,'other');assert.equal(requests.length,0);
 `);
});
test('manual local selection supersedes an in-flight external target and its late read',async()=>{
 await runScenario(`
 holdRead=true;await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(button('保存店铺连接').props.disabled,true);
 await change('经营店铺','helen');assert.equal(control('店铺名称').props.value,'Helen 店铺');
 await act(async()=>{releaseRead();await settle();});assert.equal(control('店铺名称').props.value,'Helen 店铺');
 await change('固定费用（元／销售件）','22');await click('保存已修改的经营规则');assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(requests.at(-1).input.storeId,'helen');
 `);
});
test('new shop and locally entered placeholder credentials are not discarded by external changes',async()=>{
 await runScenario(`
 await change('Client ID','TEST_ONLY_NOT_A_REAL_CREDENTIAL');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 assert.equal(control('Client ID').props.value,'TEST_ONLY_NOT_A_REAL_CREDENTIAL');assert.equal(control('店铺名称').props.value,'Bill 店铺');
 await change('Client ID','');await click('新增店铺');await change('店铺名称','本地新店草稿');
 await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});assert.equal(control('店铺名称').props.value,'本地新店草稿');assert.equal(requests.length,0);
 `);
});
test('hidden pending pricing save defers following until active without a new write',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');holdPricingSave=true;await click('保存已修改的经营规则');
 await act(async()=>{tree.update(<BusinessSettings storeId="helen" active={false}/>);await settle();});await act(async()=>{releasePricingSave();await settle();});
 assert.equal(control('店铺名称').props.value,'Bill 店铺');await act(async()=>{tree.update(<BusinessSettings storeId="helen" active/>);await settle();});
 assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(requests.length,1);
 `);
});

test('manual reload does not implicitly accept a pending external switch',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await click('重新读取');await click('放弃并重新读取');assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(reads.filter(row=>row.storeId==='helen').length,0);
 assert.equal(tree.root.findAllByProps({'aria-label':'工作台店铺切换待处理'}).length,0);
 `);
});
test('cancelled discard and later connection form edits invalidate captured switch callbacks',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await click('放弃修改并切换');const cancelled=button('确认放弃并切换').props.onClick;await click('保留修改，不切换');
 await act(async()=>{cancelled();await settle();});assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.match(text(tree.toJSON()),/有未保存修改/);
 await click('放弃修改并切换');const beforeCredentials=button('确认放弃并切换').props.onClick;await change('Client ID','TEST_ONLY_NOT_A_REAL_CREDENTIAL');
 await act(async()=>{beforeCredentials();await settle();});assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(control('Client ID').props.value,'TEST_ONLY_NOT_A_REAL_CREDENTIAL');assert.equal(requests.length,0);
 `);
});

test('pricing save cannot refresh away later shop or placeholder credential edits to follow an intent',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await change('店铺名称','本地未保存店名');await change('Client ID','TEST_ONLY_NOT_A_REAL_CREDENTIAL');
 await click('保存已修改的经营规则');assert.equal(control('店铺名称').props.value,'本地未保存店名');assert.equal(control('Client ID').props.value,'TEST_ONLY_NOT_A_REAL_CREDENTIAL');
 assert.equal(reads.filter(row=>row.storeId==='helen').length,0);assert.equal(requests.length,1);assert.equal(requests[0].operation,'pricing.save');assert.equal(requests[0].input.storeId,'bill');
 `);
});

test('failed external read clearly retains old owner and can cancel or retry without writes',async()=>{
 await runScenario(`
 failNextRead=true;await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(control('采集来源连接').props.value,'board');assert.equal(button('保存店铺连接').props.disabled,true);assert.match(text(tree.toJSON()),/目标店铺切换未完成/);
 await click('取消切换，继续原店铺');assert.equal(control('店铺名称').props.value,'Bill 店铺');assert.equal(button('保存店铺连接').props.disabled,false);
 failNextRead=true;await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});assert.equal(control('店铺名称').props.value,'Bill 店铺');
 await click('重新读取');assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(button('保存店铺连接').props.disabled,false);assert.equal(requests.length,0);
 `);
});

test('external target equal to loaded editor cancels a different in-flight local route permanently',async()=>{
 await runScenario(`
 await change('经营店铺','helen');holdRead=true;await change('经营店铺','bill');
 await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});await act(async()=>{releaseRead();await settle();});
 assert.equal(control('店铺名称').props.value,'Helen 店铺');await change('固定费用（元／销售件）','22');await click('保存已修改的经营规则');
 assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(reads.at(-1).storeId,'helen');assert.equal(requests.at(-1).input.storeId,'helen');
 `);
});

test('pending external undefined cancels and newer external read wins over the late target',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await act(async()=>{tree.update(<BusinessSettings/>);await settle();});assert.equal(tree.root.findAllByProps({'aria-label':'工作台店铺切换待处理'}).length,0);
 await click('保存已修改的经营规则');assert.equal(control('店铺名称').props.value,'Bill 店铺');
 holdRead=true;await act(async()=>{tree.update(<BusinessSettings storeId="cross"/>);await settle();});
 await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});await act(async()=>{releaseRead();await settle();});
 assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(control('采集来源连接').props.value,'board');
 `);
});

test('manual selection matching an in-flight external target starts a new locally owned read',async()=>{
 await runScenario(`
 holdRead=true;await act(async()=>{tree.update(<BusinessSettings storeId="helen"/>);await settle();});
 await change('经营店铺','helen');await act(async()=>{releaseRead();await settle();});
 assert.equal(control('店铺名称').props.value,'Helen 店铺');assert.equal(button('保存店铺连接').props.disabled,false);assert.equal(requests.length,0);
 `);
});

test('unsaved shop input explicitly blocks reload instead of falsely clearing a pricing draft',async()=>{
 await runScenario(`
 await change('固定费用（元／销售件）','19.99');await change('店铺名称','本地未保存店名');
 assert.equal(button('重新读取').props.disabled,true);assert.match(text(tree.toJSON()),/再重新读取或切换店铺/);assert.match(text(tree.toJSON()),/有未保存修改/);
 assert.equal(control('固定费用（元／销售件）').props.value,'19.99');assert.equal(requests.length,0);
 await change('店铺名称','Bill 店铺');await click('重新读取');await click('放弃并重新读取');
 assert.equal(control('固定费用（元／销售件）').props.value,'14');assert.doesNotMatch(text(tree.toJSON()),/有未保存修改/);
 `);
});

test('accepted normalized shop name clears the form guard after connection save',async()=>{
 await runScenario(`
 await change('店铺名称','  本地规范化名称  ');await click('保存店铺连接');
 assert.equal(control('店铺名称').props.value,'本地规范化名称');assert.equal(control('经营店铺').props.disabled,false);assert.equal(button('重新读取').props.disabled,false);
 `);
});
