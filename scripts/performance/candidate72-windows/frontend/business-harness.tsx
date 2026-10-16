import React from 'react';
import { create, unstable_batchedUpdates } from 'react-test-renderer';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { BusinessOperations } from 'BUSINESS_COMPONENT';

const sourceIdentity = BUNDLE_IDENTITY;
const size = Number(process.argv[2] ?? 10), attributeCount = Number(process.argv[3] ?? 20);
const mode = process.argv[4] ?? 'parity', output = process.argv[5];
let uuidSequence=0;globalThis.crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++uuidSequence).padStart(12,'0')}`;
const stringify = JSON.stringify, counts = { calls: 0, chars: 0 };
if (mode === 'parity') JSON.stringify = function(value:any, replacer:any, space:any) {
  const result = stringify(value, replacer, space);
  if (space === 2 && value && typeof value.offer_id === 'string') { counts.calls++; counts.chars += result.length; }
  return result;
} as any;
const quote = {status:'ready', storeId:'bill', configRevision:7, planId:'light', planName:'轻小件渠道', currency:'CNY', suggestedPriceMinor:2200, minimumAllowedPriceMinor:1600, breakdown:{purchaseMinor:1200,fixedMinor:100,logisticsMinor:300,commissionMinor:100,totalCostMinor:1700,profitMinor:500,marginPpm:227272},issues:[],warnings:[]};
const config:any = {revision:7,defaultPlanId:'light',plans:[{id:'light',name:'轻小件渠道',enabled:true},{id:'bulky',name:'大件渠道',enabled:true}]};
const makeRow = (i:number, prefix='BILL') => {
 const listing = i !== 0 || size === 1, offerId=`${prefix}-${i}`;
 const payload:any={offer_id:offerId,name:`商品 ${i} 中文“引号” 🧩`,price:'20',currency_code:'CNY'};
 if(listing) Object.assign(payload,{primary_image:'https://fixture.invalid/primary.png',images:['https://fixture.invalid/primary.png','https://fixture.invalid/second.png',null,13,'javascript:alert(1)'],attributes:Array.from({length:attributeCount},(_,j)=>({id:100+j,complex_id:0,values:[{dictionary_value_id:j,value:`材质/颜色 ${j}，中文 🚚 "双引号" \\ 换行\n`.repeat(4)}]})),description:'商品完整说明。\n'.repeat(attributeCount*3),nullable:null,nested:{enabled:false,zero:0,list:[]}});
 return {rowId:`row-${prefix}-${i}`,action:listing?'listing':'price',target:{offerId,productId:`product-${i}`,sku:`sku-${i}`},payload,pricing:{planId:'light',mode:'manual'},pricingQuote:quote,before:{price:'19',currency_code:'CNY'},revision:1,status:'draft',issues:[],corrections:[],repairHistory:{},binding:{amount:12,currency:'CNY',missing:[],components:[{itemId:'source',sourceSkuId:`source-${i}`,quantity:2,unitPrice:6,currency:'CNY',unit:'个'}]}};
};
const makePlan=(id:string,storeId:string,prefix:string,count=size)=>({planId:id,storeId,title:`商品批次 ${id}`,revision:1,status:'draft',rows:Array.from({length:count},(_,i)=>makeRow(i,prefix)),createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z'});
const plans:any={bill:[makePlan('primary','bill','BILL'),makePlan('alternate','bill','ALT',2)],helen:[makePlan('helen-plan','helen','HELEN',2)]};
const requests:any[]=[]; let tree:any, dynamic=false, lost=false, lastPlan=plans.bill[0];
const stores=[{id:'bill',name:'Bill 店铺',connectionId:'board'},{id:'helen',name:'Helen 店铺',connectionId:'board'}];
globalThis.fetch=async(url:any,options:any)=>{
 if(String(url).includes('resource=stores')) return Response.json({stores});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:{...config,...(dynamic?{logisticsSelection:'automatic'}:{})}});
 const body=JSON.parse(options.body); const {requestId,...stable}=body; requests.push(stable);
 assert.equal(body.action,'businessOperations');assert.equal(body.connectionId,'board');
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:plans[body.input.storeId],total:plans[body.input.storeId].length}});
 const all=Object.values(plans).flat() as any[]; let plan=all.find(p=>p.planId===body.input.planId)??lastPlan;
 if(body.operation==='revise'){
  assert.equal(body.input.expectedRevision,plan.revision);
  for(const r of body.input.rows)for(const key of ['before','binding','context','review','issues','status','pricingQuote'])assert.equal(Object.hasOwn(r,key),false);
  plan.rows=plan.rows.map((r:any)=>{const edit=body.input.rows.find((u:any)=>u.rowId===r.rowId);return edit?{...r,...edit,revision:r.revision+1}:r;}); plan.revision++; lastPlan=plan;
  return Response.json({status:'ok',data:plan});
 }
 if(body.operation==='submit'){plan.rows=plan.rows.map((r:any)=>({...r,status:'unknown'}));lastPlan=plan;if(lost){lost=false;throw Error('receipt lost');}return Response.json({status:'ok',data:plan});}
 if(body.operation==='request')return Response.json({settled:false,operationId:'mock-operation'});
 if(body.operation==='get')return Response.json({status:'ok',data:lastPlan});
 if(body.operation==='inspect'){plan.rows=plan.rows.map((r:any)=>({...r,status:'succeeded'}));return Response.json({status:'ok',data:plan});}
 if(body.operation==='restore'){const next={...plan,planId:'restored',title:'恢复草稿',rows:plan.rows.filter((r:any)=>body.input.rowIds.includes(r.rowId)).map((r:any)=>({...r,status:'draft'}))};plans.bill.unshift(next);lastPlan=next;return Response.json({status:'ok',data:next});}
 throw Error('Unexpected operation '+body.operation);
};
const settle=async()=>{for(let i=0;i<5;i++)await new Promise<void>(resolve=>setImmediate(resolve));};
const text=(node:any):string=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=(name:string)=>{const node=tree.root.findAllByType('button').find((n:any)=>text(n)===name);assert.ok(node,name);return node;};
const frames:any[]=[],steps:any[]=[];
const capture=(name:string,before:any)=>{const host=tree.toJSON();frames.push({name,host,requests:JSON.parse(stringify(requests))});steps.push({name,calls:counts.calls-before.calls,chars:counts.chars-before.chars,treeHash:createHash('sha256').update(stringify(host)).digest('hex')});};
const event=async(name:string,fn:()=>void,record=true)=>{const before={...counts};unstable_batchedUpdates(fn);await settle();if(record&&mode==='parity')capture(name,before);};
const change=async(label:string,value:string|boolean,record=true)=>{const node=tree.root.findByProps({'aria-label':label});assert.equal(!!node.props.disabled,false,label);await event(`change ${label}: ${String(value).slice(0,60)}`,()=>node.props.onChange({target:typeof value==='boolean'?{checked:value}:{value}}),record);};
const click=async(name:string)=>{const node=button(name);assert.equal(!!node.props.disabled,false,name);await event(`click ${name}`,()=>node.props.onClick());};
const listingIndex=size===1?0:1,listingLabel=`BILL-${listingIndex} 完整字段`;
const beforeMount={...counts};const mountStart=performance.now();tree=create(<BusinessOperations sessionId="s" storeId="bill"/>);await settle();const mountMs=performance.now()-mountStart;
assert.equal(tree.root.findAllByType('textarea').length,size);
if(mode==='parity')capture('initial',beforeMount);
const initialTreeHash=createHash('sha256').update(stringify(tree.toJSON())).digest('hex');
const initialRequests=JSON.parse(stringify(requests));
const initialText=tree.root.findByProps({'aria-label':listingLabel}).props.value;
if(mode==='timing'||mode==='smoke'){
 const turns=mode==='smoke'?5:18,warmups=3,samples:any[]=[];const cpuStart=process.cpuUsage();
 for(let turn=0;turn<turns;turn++){
  const actions:Array<[string,string|boolean]>=[['选择 BILL-0',true],['选择 BILL-0',false],['筛选商品','商品'],['筛选商品',''],[listingLabel,initialText+' '],[listingLabel,initialText],['选择当前筛选结果',true],['选择当前筛选结果',false]];
  const durations=[];
  for(const [label,value] of actions){const node=tree.root.findByProps({'aria-label':label});const start=performance.now();unstable_batchedUpdates(()=>node.props.onChange({target:typeof value==='boolean'?{checked:value}:{value}}));await settle();durations.push(performance.now()-start);}
  if(turn>=warmups)samples.push({totalMs:durations.reduce((a,b)=>a+b,0),durations});
 }
 const cpu=process.cpuUsage(cpuStart);const finalTreeHash=createHash('sha256').update(stringify(tree.toJSON())).digest('hex');tree.unmount();await settle();console.log(stringify({size,attributeCount,mode,mountMs,initialTreeHash,finalTreeHash,initialRequests,requests,sourceIdentity,bundleSha256:createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'),payloadBytes:Buffer.byteLength(stringify(plans.bill[0])),textChars:initialText.length,samples,cpu,rss:process.memoryUsage().rss,node:process.version,versions:process.versions}));
}else{
 await change('选择 BILL-0',true); await change('选择 BILL-0',false);
 await change('选择当前筛选结果',true);await change('选择当前筛选结果',false);
 await change('筛选商品','商品');await change('筛选商品','');
 await change(listingLabel,initialText+' ');await change(listingLabel,initialText+'  ');
 assert.equal(tree.root.findByProps({'aria-label':listingLabel}).props.value,initialText+'  ');
 await change('选择 BILL-0',true);
 assert.equal(tree.root.findByProps({'aria-label':listingLabel}).props.value,initialText+'  ','parent selection preserves unsaved JSON text');
 const content=()=>tree.root.findByProps({'aria-label':listingLabel}).parent;
 const apply=async()=>{const node=content().findAllByType('button')[0];await event('apply complete fields',()=>node.props.onClick());};
 await change(listingLabel,'{ broken JSON');await apply();assert.match(text(content()),/字段格式有误/);
 await change(listingLabel,'[]');await apply();assert.match(text(content()),/字段格式有误/);
 await change(listingLabel,'null');await apply();assert.match(text(content()),/字段格式有误/);
 const edited={...plans.bill[0].rows[listingIndex].payload,name:'修改标题 🛒',nullable:null,attributes:[{id:4191,values:[{value:'完整内容\n新的说明'}]}]};
 await change(listingLabel,stringify(edited));await apply();
 assert.equal(tree.root.findByProps({'aria-label':listingLabel}).props.value,stringify(edited,null,2),'same key payload change refreshes formatted JSON');
 await click('保存草稿');assert.deepEqual(plans.bill[0].rows[listingIndex].payload,edited);
 assert.equal(requests.some(r=>r.operation==='submit'),false,'draft save never submits');
 // Replacing payload object with the same row key must reset local text via the existing effect.
 await change(listingLabel,'{ local draft');plans.bill[0].rows[listingIndex].payload={...edited,name:'后台刷新内容'};
 await click('刷新批次');assert.equal(JSON.parse(tree.root.findByProps({'aria-label':listingLabel}).props.value).name,'后台刷新内容');
 if(size>1){
  await change('选择 BILL-0',true);await change('批量填写售价','31');await click('填入所选 1 行草稿');await click('保存草稿');assert.equal(plans.bill[0].rows[0].payload.price,'31');
  await change('BILL-0 定价方式','automatic');assert.equal(tree.root.findByProps({'aria-label':'BILL-0 售价'}).props.value,'');await click('保存草稿');
 }
 await change('筛选商品','not-present');assert.equal(tree.root.findAllByType('textarea').length,0);await change('筛选商品','');
 await change('筛选执行状态','succeeded');assert.equal(tree.root.findAllByType('textarea').length,0);await change('筛选执行状态','');
 await change('操作批次','alternate');assert.equal(tree.root.findAllByProps({'aria-label':listingLabel}).length,0);await change('操作批次','primary');
 dynamic=true;await click('刷新批次');assert.equal(tree.root.findAllByProps({'aria-label':'新增 物流方案'}).length,0);
 lost=true;await click('提交整批变更');assert.equal(button('提交整批变更').props.disabled,true);await click('检查原操作');assert.equal(requests.filter(r=>r.operation==='submit').length,1);
 await click('核查平台状态');await change('选择 BILL-0',true);await click('恢复所选已完成项');assert.equal(requests.filter(r=>r.operation==='submit').length,1);
 await event('switch store',()=>tree.update(<BusinessOperations sessionId="s" storeId="helen"/>));assert.equal(tree.root.findAllByProps({'aria-label':'HELEN-0 完整字段'}).length,1);
 await event('switch session',()=>tree.update(<BusinessOperations sessionId="s2" storeId="bill"/>));
 await event('no session',()=>tree.update(<BusinessOperations storeId="bill"/>));assert.equal(tree.root.findAllByType('textarea').length,0);
 await event('unmount',()=>tree.unmount());
 const result={size,attributeCount,mode,counts,steps,requests,payloadBytes:Buffer.byteLength(stringify(plans.bill)),frameCount:frames.length,frameHash:createHash('sha256').update(stringify(frames)).digest('hex')};
 if(output){writeFileSync(output+'.json',stringify(result,null,2));writeFileSync(output+'.frames.json.gz',gzipSync(stringify(frames)));}
 console.log(stringify(result));
}
