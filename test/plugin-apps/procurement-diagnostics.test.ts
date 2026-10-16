import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {dirname} from 'node:path';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import {realDetail} from '../real-data/corpus.ts';

test('procurement diagnostic candidates remain exact, read-only and scoped through actual component and engine recovery', async t => {
 const baseline=process.env.DSH_PROCUREMENT_UI_BASELINE==='1';
 const output=await build({plugins:baseline?[{name:'baseline-ui',setup(builder){builder.onLoad({filter:/[\\/]packages[\\/](plugin-apps[\\/]client[\\/]business-operations\.tsx|app-presentation[\\/]src[\\/]materials[\\/]business-recovery\.ts)$/},args=>{const path=args.path.slice(process.cwd().length+1);const result=spawnSync('git',['show','f96b355:'+path],{encoding:'utf8'});assert.equal(result.status,0);return {contents:result.stdout,loader:path.endsWith('tsx')?'tsx':'ts',resolveDir:dirname(args.path)};});}}]:[],stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {BusinessOperations} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as Engine} from './packages/app-hallmark/src/operations/index.ts';
import {HallmarkBusinessAdapter} from './packages/app-hallmark/src/operations-adapter.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const db=new RuntimeStore(':memory:'),port=new HallmarkStorePort(db,'procurement-ui');
const detail=${JSON.stringify(realDetail(1))};detail.id='SOURCE-CONTROL';detail.skus=[{...detail.skus[0],sourceSkuId:'EXACT-SKU',spec:'Recorded variant alias'}];
let tree,plan,reads=0,writes=0,reviews=0,fetches=0,submits=0;
const client={async getStoreProducts(){return {status:'ok',raw:{stores:[{id:'shop'}],products:[]}};},async getCollectedItemDetail(id){reads++;assert.equal(id,detail.id);return {status:'ok',raw:detail};},async storeDataRead(){return {status:'ok',raw:{outcome:'response_received',httpStatus:200,response:{items:[]}}};}};
const adapter=new HallmarkBusinessAdapter({client,store:port,broker:{}});
const engine=new Engine({store:port,source:adapter,reviewer:{async review(){reviews++;throw Error('Review forbidden for invalid source');}},transport:{async execute(){writes++;throw Error('Dispatch forbidden');},async inspect(){throw Error('Inspect forbidden');}}});
const original={rowId:'row-one',action:'listing',target:{offerId:'OFFER-ONE'},payload:{name:detail.title,description:detail.title,price:'20',currency_code:'CNY'},procurement:[{itemId:detail.id,sourceSkuId:'MISSING-SKU',quantity:2}]};
plan=await engine.create({storeId:'shop',rows:[original]});
globalThis.fetch=async(url,options)=>{fetches++;
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'shop',connectionId:'connection'}),uiStore({id:'other',connectionId:'connection'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(url,'/api/dsh-apps');const body=JSON.parse(options.body);
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:engine.list(body.input.storeId).filter(item=>item.planId===plan.planId)}});
 if(body.operation==='submit'){submits++;plan=await engine.submit(body.input);return Response.json({status:'ok',data:plan});}
 if(body.operation==='revise'){plan=await engine.revise(body.input);return Response.json({status:'ok',data:plan});}
 throw Error('Unexpected operation '+body.operation);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const text=n=>typeof n==='string'?n:n?.type==='style'?'':n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const click=async name=>act(async()=>{const b=button(name);assert.ok(b,name);assert.equal(!!b.props.disabled,false,name);b.props.onClick();await flush();});

const snapshot=()=>({reads,writes,reviews,fetches,submits});
const current=()=>text(tree.root);
try{
 await act(async()=>{tree=create(<BusinessOperations sessionId='chat' storeId='shop'/>);await flush();});
 assert.equal(reads,1);assert.equal(writes,0);assert.equal(reviews,0);
 const evidence=tree.root.findByProps({'aria-label':'OFFER-ONE 采购关联 1 核对'});
 assert.match(text(evidence),/SOURCE-CONTROL/);assert.match(text(evidence),/MISSING-SKU/);assert.match(text(evidence),/EXACT-SKU/);assert.match(text(evidence),/全部可核对候选/);
 assert.match(current(),/采购关联及成本尚未核实/);assert.doesNotMatch(current(),/尚无采购关联/);
 const initial=snapshot();await act(async()=>{tree.update(<BusinessOperations sessionId='chat' storeId='shop'/>);await flush();});assert.deepEqual(snapshot(),initial,'Rendering diagnostics has no reads or writes');
 await click('确认整批范围后提交');assert.match(text(tree.root.findByProps({'aria-label':'提交范围确认'})),/重复提交相同关联不能修正/);
 await click('确认提交整批 1 个动作');assert.equal(plan.rows[0].status,'blocked');assert.equal(reads,2);assert.equal(writes,0);assert.equal(reviews,0);
 assert.match(text(tree.root.findByProps({'aria-label':'下一步操作'})),/先核对本行采购关联/);
 const beforeEdit=snapshot();await act(async()=>{tree.root.findByProps({'aria-label':'OFFER-ONE 商品标题'}).props.onChange({target:{value:'RETAINED TITLE'}});await flush();});
 assert.deepEqual(snapshot(),beforeEdit);assert.equal(tree.root.findAllByProps({'aria-label':'OFFER-ONE 采购关联 1 核对'}).length,0);assert.match(current(),/暂不展示上次候选/);assert.equal(button('确认整批范围后提交').props.disabled,true);
 await click('保存草稿');assert.equal(plan.rows[0].payload.name,'RETAINED TITLE');assert.deepEqual(plan.rows[0].procurement,original.procurement);assert.equal(writes,0);assert.equal(submits,1);assert.equal(reads,3);
 assert.equal(tree.root.findByProps({'aria-label':'OFFER-ONE 商品标题'}).props.value,'RETAINED TITLE');
 // Existing revision/fingerprint protection rejects old confirmation when diagnostics change.
 await click('确认整批范围后提交');plan=engine.get(plan.planId);plan.rows[0].issues[0].candidates=[{sourceSkuId:'NEW-EXACT'}];plan.rows[0].issues[0].candidatesComplete=false;port.put('business_plans',plan.planId,plan);
 await act(async()=>{tree.update(<BusinessOperations sessionId='chat' storeId='shop' active={false}/>);await flush();});assert.equal(tree.root.findAllByProps({'aria-label':'OFFER-ONE 采购关联 1 核对'}).length,0);
 await act(async()=>{tree.update(<BusinessOperations sessionId='chat' storeId='shop' active={true}/>);await flush();});assert.equal(tree.root.findAllByProps({'aria-label':'提交范围确认'}).length,0);assert.match(current(),/候选未完整展示/);assert.doesNotMatch(current(),/来源 SKU：EXACT-SKU/);assert.equal(submits,1);
 for(const control of [[],[{sourceSkuId:' bad '}]] ) {plan=engine.get(plan.planId);plan.rows[0].issues[0].candidates=control;port.put('business_plans',plan.planId,plan);const before=snapshot();await click('刷新批次');assert.match(current(),/暂无可安全使用的候选/);assert.equal(reads,before.reads);assert.equal(writes,0);}
 plan=engine.get(plan.planId);plan.rows[0].issues[0].candidates=[{sourceSkuId:'DO-NOT-DISPLAY'}];plan.rows[0].issues[0].sourceReference.itemIdField='procurement[99].itemId';port.put('business_plans',plan.planId,plan);await click('刷新批次');assert.match(current(),/无法核对候选对应的采购关联/);assert.doesNotMatch(current(),/DO-NOT-DISPLAY/);
 for(const status of ['unknown','pending','dispatching','succeeded']) {plan=engine.get(plan.planId);plan.rows[0].status=status;plan.rows[0].issues[0].sourceReference.itemIdField='procurement[0].itemId';port.put('business_plans',plan.planId,plan);await click('刷新批次');assert.doesNotMatch(current(),/来源 SKU：DO-NOT-DISPLAY/);assert.equal(button('确认整批范围后提交').props.disabled,true);}
 plan=engine.get(plan.planId);plan.rows[0].issues=[];plan.rows[0].status='draft';plan.rows[0].binding={components:[{...original.procurement[0],unitPrice:1,currency:'CNY',unit:'unit'}],amount:2,currency:'CNY',missing:[]};port.put('business_plans',plan.planId,plan);await click('刷新批次');assert.doesNotMatch(current(),/采购关联及成本尚未核实|暂无可安全使用的候选/);
 await act(async()=>{tree.update(<BusinessOperations sessionId='other-chat' storeId='other'/>);await flush();});assert.doesNotMatch(current(),/EXACT-SKU|RETAINED TITLE|DO-NOT-DISPLAY/);assert.equal(writes,0);assert.equal(reviews,0);assert.equal(submits,1);
 await act(async()=>tree.unmount());tree=undefined;
 detail.skus=Array.from({length:8},(_,index)=>({...detail.skus[0],sourceSkuId:'EXACT-'+index,spec:'x'.repeat(500)}));
 const multiple={...original,procurement:[original.procurement[0],{...original.procurement[0],sourceSkuId:'SECOND-MISSING',quantity:3}]};
 const beforeMultiple=snapshot();plan=await engine.create({storeId:'shop',rows:[multiple]});assert.equal(reads,beforeMultiple.reads+1,'One source read covers both invalid selections');
 assert.equal(plan.rows[0].issues.length,2);assert.ok(plan.rows[0].issues.every(issue=>issue.candidates.length===4&&issue.candidatesComplete===false&&issue.candidates.every(candidate=>candidate.spec===undefined)));
 await act(async()=>{tree=create(<BusinessOperations sessionId='multi-chat' storeId='shop'/>);await flush();});
 for(const index of [1,2]){const diagnostic=text(tree.root.findByProps({'aria-label':'OFFER-ONE 采购关联 '+index+' 核对'}));assert.match(diagnostic,/候选未完整展示/);assert.match(diagnostic,index===1?/MISSING-SKU/:/SECOND-MISSING/);assert.equal((diagnostic.match(/来源 SKU：EXACT-/g)||[]).length,4);assert.doesNotMatch(diagnostic,/x{100}/);}
 assert.equal(reads,beforeMultiple.reads+1);assert.equal(writes,0);assert.equal(reviews,0);assert.equal(submits,1);assert.deepEqual(plan.rows[0].procurement,multiple.procurement);
 await act(async()=>tree.unmount());tree=undefined;
 plan=await engine.create({storeId:'shop',rows:[{...original,procurement:[{...original.procurement[0],sourceSkuId:'EXACT-0'}]}]});assert.ok(plan.rows[0].binding?.components.length,'Valid source establishes prior binding');
 detail.skus=detail.skus.slice(1);plan=await engine.submit({planId:plan.planId,expectedRevision:plan.revision});assert.equal(plan.rows[0].status,'blocked');assert.ok(plan.rows[0].binding?.components.length,'Failed refresh retains old binding in engine snapshot');
 await act(async()=>{tree=create(<BusinessOperations sessionId='changed-source' storeId='shop'/>);await flush();});assert.match(current(),/采购关联及成本尚未核实/);assert.match(text(tree.root.findByProps({'aria-label':'OFFER-ONE 采购关联 1 核对'})),/当前来源 SKU EXACT-0/);assert.equal(writes,0);assert.equal(reviews,0);
 console.log('PROCUREMENT_DIAGNOSTICS_UI_ENGINE_PASS');
}finally{if(tree)await act(async()=>tree.unmount());db.close();}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const run=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);t.diagnostic(run.stdout.trim());
});
