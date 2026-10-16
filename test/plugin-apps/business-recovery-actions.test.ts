import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import {realCollection} from '../real-data/corpus.ts';

test('failed listing recovery separates correction, decision, due retry and inspection without no-op submissions', async t => {
 const output=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';
import {businessRecoveryAction} from './packages/app-presentation/src/materials/business-recovery.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'recovery-actions');
const source=uiProduct({},1),purchase=${JSON.stringify(realCollection(1).skus[0].purchaseCost)};
let tree,plan,now=Date.parse('2026-10-16T06:00:00Z'),submits=0,fetches=0;const sends=[];
let fingerprints=0;const oldStringify=JSON.stringify;JSON.stringify=function(value,replacer,space){if(value?.planId&&Array.isArray(value.rows)&&typeof replacer==='function')fingerprints++;return oldStringify(value,replacer,space);};
const oldNow=Date.now,oldTimeout=setTimeout,oldClearTimeout=clearTimeout;Date.now=()=>now;
const timers=new Map();let timerId=0;
globalThis.setTimeout=(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const fire=async()=>{assert.equal(timers.size,1);const [id,timer]=[...timers][0];timers.delete(id);await act(async()=>{timer.callback();await flush();});};
const engine=new Engine({store:port,now:()=>new Date(now).toISOString(),source:{async load({storeId,row}){return {identity:{storeId,...row.target},current:{},source,procurement:[{itemId:source.id,sourceSkuId:source.sku,unitPrice:purchase.amount,currency:purchase.currency,unit:purchase.unit??'来源 SKU 销售单位'}],assets:[{url:source.image,contentHash:'recorded-image'}]};}},reviewer:{async review(request){return {status:'passed',questions:request.questions.map(q=>({id:q.id,version:q.version,status:'passed',reviewer:'fixture',reasonCode:'passed'})),evidence:{versions:request.versions,requests:[],thresholds:{pass:.95,reject:.1}}};}},transport:{async execute(input){sends.push(input.row.target.offerId);return {status:'succeeded'};},async inspect(){return {status:'unknown'};}}});
const row=(status,code='PLATFORM_FIELD',offer='AUDIT-'+status)=>({rowId:offer,action:'listing',target:{offerId:offer},procurement:[{itemId:source.id,sourceSkuId:source.sku,quantity:1}],payload:{name:source.title,description:source.title,price:'20',currency_code:purchase.currency,images:[source.image]},revision:1,status,issues:['succeeded','draft'].includes(status)?[]:[{code,message:'本地故障控制：需处理商品字段',field:'name'}],corrections:[],repairHistory:{},...(code==='OZON_RATE_LIMIT'?{retryAt:'2026-10-16T06:01:00Z'}:{})});
globalThis.fetch=async(url,options)=>{fetches++;
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'connection'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(url,'/api/dsh-apps');const body=JSON.parse(options.body);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:engine.list('shop')}});
 if(body.operation==='submit'){submits++;plan=await engine.submit(body.input);return Response.json({status:'ok',data:plan});}
 if(body.operation==='revise'){plan=await engine.revise(body.input);return Response.json({status:'ok',data:plan});}
 throw Error('Unexpected local operation '+body.operation);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const text=n=>typeof n==='string'?n:n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,name);assert.equal(!!b.props.disabled,false,name);b.props.onClick();await flush();});
const mount=async rows=>{if(tree)await act(async()=>tree.unmount());plan={planId:'plan',storeId:'shop',title:source.title,revision:1,status:'blocked',rows:JSON.parse(JSON.stringify(rows)),createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};port.put('business_plans','plan',plan);await act(async()=>{tree=create(<BusinessOperations sessionId='chat' storeId='shop'/>);await flush();});};
try{
 for(const [rows,expected] of [[ [row('rejected')],/修改退回字段并保存草稿/ ],[[row('rejected','OZON_RATE_LIMIT')],/不会自动重发/],[[row('needs_user')],/经营判断/],[[row('succeeded'),row('rejected')],/本次可推进 0 行/]]){
  await mount(rows);assert.equal(button('确认整批范围后提交').props.disabled,true);assert.match(text(tree.root.findByProps({'aria-label':'下一步操作'})),expected);
 }
 assert.equal(submits,0);assert.equal(sends.length,0);
 await mount([row('unknown')]);assert.equal(button('确认整批范围后提交').props.disabled,true);assert.match(text(tree.root.findByProps({'aria-label':'下一步操作'})),/核查平台状态/);assert.equal(tree.root.findByProps({'aria-label':'AUDIT-unknown 商品标题'}).props.disabled,true);
 await mount([row('draft','', 'DRAFT')]);await click('确认整批范围后提交');assert.match(text(tree.root.findByProps({'aria-label':'提交范围确认'})),/本次可推进 1 行/);await click('确认提交整批 1 个动作');assert.deepEqual(sends,['DRAFT']);
 await mount([row('succeeded'),row('rejected'),row('unknown'),row('draft','','MIXED-DRAFT')]);await click('确认整批范围后提交');const scope=text(tree.root.findByProps({'aria-label':'提交范围确认'}));assert.match(scope,/整批 4 个动作/);assert.match(scope,/本次可推进 1 行/);assert.match(scope,/需先修正或判断 1 行/);await click('确认提交整批 4 个动作');assert.deepEqual(sends,['DRAFT','MIXED-DRAFT']);assert.deepEqual(plan.rows.map(r=>r.status),['succeeded','rejected','unknown','succeeded']);
 await mount([row('rejected','OZON_RATE_LIMIT','RATE')]);const before=submits;assert.equal(button('确认整批范围后提交').props.disabled,true);assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,60_000);now+=60_000;await fire();assert.equal(timers.size,0);assert.equal(submits,before,'Clock expiry never submits');assert.equal(button('确认整批范围后提交').props.disabled,false);await click('确认整批范围后提交');await click('确认提交整批 1 个动作');assert.equal(sends.at(-1),'RATE');
 await mount([row('rejected','PLATFORM_FIELD','FIX')]);await click('编辑 FIX 上品内容');await act(async()=>{tree.root.findByProps({'aria-label':'FIX 商品标题'}).props.onChange({target:{value:source.title+' 修订'}});await flush();});await click('保存草稿');assert.equal(plan.rows[0].status,'draft');await click('确认整批范围后提交');await click('确认提交整批 1 个动作');assert.equal(sends.at(-1),'FIX');
 assert.equal(businessRecoveryAction(row('rejected','REQUEST_NOT_DISPATCHED'),now),'submit');assert.equal(businessRecoveryAction({...row('rejected','OZON_RATE_LIMIT'),retryAt:'invalid'},now),'wait_retry');
 assert.equal(businessRecoveryAction({...row('rejected','PRODUCT_IS_NOT_CREATED'),retryAt:new Date(now).toISOString()},now),'edit_save');assert.equal(businessRecoveryAction({...row('rejected','PRODUCT_IS_NOT_CREATED'),action:'stock',retryAt:new Date(now).toISOString()},now),'submit');

 // Only meaningful future retry deadlines schedule work. No 1Hz polling.
 const future=new Date(now+5000).toISOString();
 for(const candidate of [row('draft'),row('unknown'),{...row('rejected'),retryAt:future},{...row('needs_user','OZON_RATE_LIMIT'),retryAt:future},{...row('rejected','OZON_RATE_LIMIT'),retryAt:undefined},{...row('rejected','OZON_RATE_LIMIT'),retryAt:'invalid'},{...row('rejected','OZON_RATE_LIMIT'),retryAt:new Date(now).toISOString()},{...row('rejected','REQUEST_NOT_DISPATCHED'),retryAt:future}]){await mount([candidate]);assert.equal(timers.size,0,'No irrelevant/invalid/expired deadline timer');}
 await mount([row('draft','','CLOCK-DRAFT'),{...row('rejected','OZON_RATE_LIMIT','CLOCK-RATE'),retryAt:new Date(now+5000).toISOString()}]);await click('确认整批范围后提交');const clockFetches=fetches,clockSubmits=submits,clockFingerprints=fingerprints;now+=5000;await fire();assert.equal(fetches,clockFetches);assert.equal(submits,clockSubmits);assert.equal(fingerprints,clockFingerprints,'Eligibility timer does not repeat batch fingerprinting');assert.equal(tree.root.findAllByProps({'aria-label':'提交范围确认'}).length,1,'Clock expiry alone does not invalidate server snapshot');
 await mount([{...row('rejected','OZON_RATE_LIMIT','EARLY'),retryAt:new Date(now+5000).toISOString()},{...row('rejected','OZON_RATE_LIMIT','LATE'),retryAt:new Date(now+9000).toISOString()}]);const requestCount=submits,sendCount=sends.length,readCount=fetches;
 assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,5000);now+=5000;await fire();assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,4000);now+=4000;await fire();assert.equal(timers.size,0);assert.equal(submits,requestCount);assert.equal(sends.length,sendCount);assert.equal(fetches,readCount,'Deadline transitions do not read or mutate');
 await mount([{...row('rejected','OZON_RATE_LIMIT'),retryAt:new Date(now+3_000_000_000).toISOString()}]);assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,2_147_483_647);now+=2_147_483_647;await fire();assert.equal([...timers.values()][0].delay,852_516_353);
 await act(async()=>{tree.update(<BusinessOperations sessionId='chat' storeId='shop' active={false}/>);await flush();});assert.equal(timers.size,0,'Hidden view cancels deadline');
 now+=852_516_353;await act(async()=>{tree.update(<BusinessOperations sessionId='chat' storeId='shop' active={true}/>);await flush();});assert.equal(timers.size,0,'Expired deadline on resume never schedules');assert.equal(submits,requestCount);
 await mount([{...row('rejected','OZON_RATE_LIMIT'),retryAt:new Date(now+5000).toISOString()}]);assert.equal(timers.size,1);await act(async()=>tree.unmount());tree=undefined;assert.equal(timers.size,0,'Unmount cancels deadline');
 console.log('RECOVERY_ACTIONS_REAL_UI_ENGINE_PASS');
}finally{if(tree)await act(async()=>tree.unmount());Date.now=oldNow;JSON.stringify=oldStringify;globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClearTimeout;db.close();}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const run=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);t.diagnostic(run.stdout.trim());
});
