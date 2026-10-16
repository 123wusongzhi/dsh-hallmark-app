import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {BusinessOperations as BusinessUI} from './packages/plugin-apps/client/business-operations.tsx';
import {BusinessOperations as BusinessEngine} from './packages/app-hallmark/src/operations/index.ts';
import {RuntimeStore} from './packages/app-runtime/src/store.ts';
import {HallmarkStorePort} from './packages/app-hallmark/src/store.ts';

const baseline=process.env.DSH_PRICE_JOURNEY_BASELINE==='1';
const db=new RuntimeStore(':memory:'),store=new HallmarkStorePort(db,'price-journey-fixture');
const sends=[],inspections=[],requests=[],current=new Map(),outcomes=new Map();let tree,plan,lost=false,recoverValue,releaseSubmit,submitError;
const row=(offerId,currency,index)=>({action:'price',target:{offerId},payload:{name:uiProduct({},index).title,price:'20',currency_code:currency},pricing:{mode:'manual'}});
const engine=new BusinessEngine({store,source:{async load({storeId,row}){
 const currency=row.payload.currency_code;
 return {identity:{storeId,...row.target},current:current.get(row.target.offerId)??{price:'19',...(currency?{currency_code:currency}:{})},source:uiProduct({},0),procurement:[]};
}},transport:{async execute(input){sends.push({offerId:input.row.target.offerId,payload:input.row.payload});const result=outcomes.get(input.row.target.offerId)??{status:'succeeded'};if(result.status==='succeeded')current.set(input.row.target.offerId,input.row.payload);return result;},async inspect(input){inspections.push(input.row.target.offerId);current.set(input.row.target.offerId,input.row.payload);return {status:'succeeded'};}},reviewer:{async review(){throw Error('Price does not need semantic review');}}});
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('resource=stores'))return Response.json({stores:[uiStore({id:'fixture-store',connectionId:'fixture-board'})]});
 if(String(url).includes('resource=businessSettings'))return Response.json({pricing:null});
 assert.equal(String(url),'/api/dsh-apps','No network outside isolated fixture endpoint');const body=JSON.parse(options.body);requests.push(body);
 assert.equal(body.connectionId,'fixture-board');
 if(body.operation==='list')return Response.json({status:'ok',data:{plans:[engine.get(plan.planId)]}});
 if(body.operation==='revise'){plan=await engine.revise(body.input);return Response.json({status:'ok',data:plan});}
 if(body.operation==='submit'){if(submitError){const message=submitError;submitError=undefined;return Response.json({status:'failed',error:{code:'FIXTURE_INPUT_CONFLICT',message}},{status:409});}if(releaseSubmit!==undefined)await new Promise(resolve=>{releaseSubmit=resolve;});plan=await engine.submit(body.input);recoverValue=plan;if(lost){lost=false;throw Error('Isolated lost response');}return Response.json({status:'ok',data:plan});}
 if(body.operation==='request')return Response.json({settled:true,value:recoverValue});
 if(body.operation==='inspect'){plan=await engine.inspect(body.input.planId);return Response.json({status:'ok',data:plan});}
 throw Error('Unexpected fixture request '+body.operation);
};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>{const node=button(name);assert.ok(node,name);assert.equal(!!node.props.disabled,false,name);await act(async()=>{node.props.onClick();await settle();});};
const change=async(label,value,checked)=>act(async()=>{tree.root.findByProps({'aria-label':label}).props.onChange({target:{value,checked}});await settle();});
const mount=async(rows)=>{if(tree)await act(async()=>tree.unmount());current.clear();sends.length=0;inspections.length=0;requests.length=0;outcomes.clear();plan=await engine.create({storeId:'fixture-store',rows:rows??[row('OFFER-A','CNY',0),row('OFFER-B','RUB',1),row('OFFER-C','CNY',2)]});await act(async()=>{tree=create(<BusinessUI sessionId={'fixture-'+plan.planId} storeId="fixture-store"/>);await settle();});};
try{
 await mount();
 await change('选择当前筛选结果',undefined,true);await change('筛选商品','OFFER-A');await change('批量填写售价','25');
 await click(baseline?'填入所选 3 行草稿':'填入可见所选 1 行草稿');await click(baseline?'保存草稿':'保存改价草稿');
 const changed=plan.rows.filter(row=>row.payload.price==='25').map(row=>row.target.offerId);
 assert.deepEqual(changed,baseline?['OFFER-A','OFFER-B','OFFER-C']:['OFFER-A']);
 console.log(JSON.stringify({scenario:'filtered-batch-fill',visibleRows:1,selectedRows:3,changed,hiddenRowsChanged:changed.filter(id=>id!=='OFFER-A').length}));
 assert.equal(sends.length,0,'Save never dispatches to even the fixture platform');
 await mount();await change('选择 OFFER-A',undefined,true);await change('筛选商品','OFFER-A');
 await click(baseline?'提交整批变更':'确认整批范围后提交');
 if(!baseline){
  assert.equal(sends.length,0,'Opening confirmation never submits');const preview=tree.root.findByProps({'aria-label':'提交范围确认'});assert.match(text(preview),/OFFER-A/);assert.match(text(preview),/OFFER-B/);assert.match(text(preview),/OFFER-C/);assert.match(text(preview),/其中 2 个未在当前筛选中显示，2 个未勾选/);assert.match(text(preview),/CNY/);assert.match(text(preview),/RUB/);
  await click('返回检查');assert.equal(sends.length,0);await click(baseline?'提交整批变更':'确认整批范围后提交');await click('确认提交整批 3 个动作');
 }
 assert.deepEqual(sends.map(row=>row.offerId),['OFFER-A','OFFER-B','OFFER-C']);
 console.log(JSON.stringify({scenario:'filtered-submit',visibleRows:1,selectedRows:1,submittedRows:sends.length,confirmationShowsAllRows:!baseline}));
 if(!baseline){
  // A mixed-currency selection must opt into one currency and explain the excluded row.
  await mount();await change('选择当前筛选结果',undefined,true);await change('批量填写售价','31');
  assert.equal(tree.root.findByProps({'aria-label':'批量售价币种'}).props.value,'');
  assert.equal(button('填入可见所选 0 行草稿').props.disabled,true);
  await change('批量售价币种','CNY');assert.match(text(tree.root),/另外 1 行因其他或缺失币种不会修改/);
  await change('批量填写售价','0');assert.equal(button('填入可见所选 2 行草稿').props.disabled,true);
  await change('批量填写售价','31');await click('填入可见所选 2 行草稿');await click(baseline?'保存草稿':'保存改价草稿');
  assert.deepEqual(plan.rows.map(row=>[row.target.offerId,row.payload.price,row.payload.currency_code]),[['OFFER-A','31','CNY'],['OFFER-B','20','RUB'],['OFFER-C','31','CNY']]);assert.equal(sends.length,0);
  console.log(JSON.stringify({scenario:'mixed-currency',requiresCurrencyChoice:true,editedCnyRows:2,untouchedRubRows:1,zeroPriceBlocked:true}));
  // Missing currency cannot silently acquire another row's currency.
  await mount([row('NO-CURRENCY',undefined,0)]);await change('选择当前筛选结果',undefined,true);await change('批量填写售价','31');
  assert.equal(button('填入可见所选 0 行草稿').props.disabled,true);assert.match(text(tree.root),/币种缺失的行不能批量填价/);assert.equal(requests.filter(row=>row.operation==='revise').length,0);
  // Empty search recovery is one explicit action and preserves the draft.
  await change('筛选商品','NO-MATCH-AT-ALL');await change('筛选执行状态','unknown');await click('清除筛选');assert.equal(tree.root.findByProps({'aria-label':'筛选执行状态'}).props.value,'');assert.equal(tree.root.findByProps({'aria-label':'筛选商品'}).props.value,'');assert.equal(tree.root.findByProps({'aria-label':'NO-CURRENCY 售价'}).props.value,'20');
  // Same event turn duplicate confirmations, followed by an uncertain receipt, never resend.
  await mount();outcomes.set('OFFER-B',{status:'rejected',issues:[{code:'FIXTURE_PRICE',message:'Fixture platform rejected this price',suggestion:'Edit only this row and save before submitting again.'}]});outcomes.set('OFFER-C',{status:'unknown',receipt:{id:'fixture-pending'}});
  await click(baseline?'提交整批变更':'确认整批范围后提交');lost=true;releaseSubmit=null;const confirm=button('确认提交整批 3 个动作');
  await act(async()=>{confirm.props.onClick();confirm.props.onClick();await settle();});
  assert.equal(requests.filter(row=>row.operation==='submit').length,1);assert.equal(button('确认整批范围后提交').props.disabled,true);assert.match(text(tree.root),/正在审核并提交整批变更/);assert.equal(sends.length,0);
  await act(async()=>{releaseSubmit();releaseSubmit=undefined;await settle();});
  assert.equal(sends.length,3);assert.ok(button('检查原操作'));assert.equal(button('确认整批范围后提交').props.disabled,true);
  await click('检查原操作');assert.deepEqual(plan.rows.map(row=>row.status),['succeeded','rejected','unknown']);assert.match(text(tree.root),/结果待核查 1 行/);assert.doesNotMatch(text(tree.root),/已完成 3 行/);assert.equal(requests.filter(row=>row.operation==='submit').length,1);assert.equal(sends.length,3);
  await click('核查平台状态');assert.deepEqual(inspections,['OFFER-C']);assert.deepEqual(plan.rows.map(row=>row.status),['succeeded','rejected','succeeded']);assert.equal(sends.length,3);
  await change('OFFER-B 售价','23');await click(baseline?'保存草稿':'保存改价草稿');outcomes.delete('OFFER-B');await click(baseline?'提交整批变更':'确认整批范围后提交');await click('确认提交整批 3 个动作');
  assert.deepEqual(sends.map(row=>row.offerId),['OFFER-A','OFFER-B','OFFER-C','OFFER-B']);assert.match(text(tree.root),/已完成 3 行/);
  console.log(JSON.stringify({scenario:'receipt-recovery',submitRequestsBeforeRecovery:1,writesBeforeRecovery:3,recoveryResends:0,repairedRowWrites:1,unrelatedRowsResent:0}));
  // A known pre-dispatch error keeps data editable and requires another explicit confirmation.
  await mount();submitError='Fixture revision conflict; review the current batch.';await click(baseline?'提交整批变更':'确认整批范围后提交');await click('确认提交整批 3 个动作');
  assert.equal(sends.length,0);assert.match(text(tree.root),/Fixture revision conflict/);assert.equal(button('检查原操作'),undefined);assert.equal(button('确认整批范围后提交').props.disabled,false);
  await click(baseline?'提交整批变更':'确认整批范围后提交');await click('返回检查');assert.equal(requests.filter(row=>row.operation==='submit').length,1);assert.equal(sends.length,0);
  console.log(JSON.stringify({scenario:'known-submit-error',writes:0,draftPreserved:true,cancelResends:0}));
 }
 console.log(baseline?'PRICE_JOURNEY_BASELINE_REPRODUCED':'PRICE_JOURNEY_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;db.close();}
