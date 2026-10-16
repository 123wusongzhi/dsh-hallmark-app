import test from 'node:test';
import assert from 'node:assert/strict';
import {executeBusiness,publicPlan} from '../../packages/app-hallmark/src/operations-provider.ts';
import type {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import type {BusinessPlan} from '../../packages/app-hallmark/src/operations/types.ts';
import type {CoreStore} from '../../packages/core/src/types.ts';
import type {ExecutionContext,JsonValue} from '../../packages/app-contracts/src/index.ts';
import { realSourceProducts } from '../real-data/corpus.ts';

test('plan read pages keep stable identities and preserve the unpaged UI contract',async()=>{
 const products=realSourceProducts();
 const plan:BusinessPlan={planId:'p',storeId:'bill',title:'batch',revision:4,status:'partial',createdAt:'now',updatedAt:'now',rows:Array.from({length:11},(_,i)=>({rowId:`r${i}`,revision:2,action:'listing',target:{offerId:`offer${i}`},payload:{name:products[i].title},status:i?'rejected':'succeeded',issues:i?[{code:'ATTRIBUTE',field:'attributes',message:'Correct this field'}]:[],corrections:[],repairHistory:{}}))};
 const operations={get:()=>structuredClone(plan)} as unknown as BusinessOperations;
 const store={get:()=>undefined} as unknown as CoreStore;
 const read=(input:Record<string,JsonValue>)=>executeBusiness(operations,store,{request:{protocolVersion:'1.0',invocationId:'i',traceId:'t',appId:'hallmark',connectionId:'c',capabilityId:'hallmark.plan.get',capabilityVersion:'1.0.0',input:{planId:'p',...input},source:{kind:'agent',sessionId:'s',nativeCallId:'call'},deadlineAt:new Date(Date.now()+10000).toISOString()},signal:new AbortController().signal} satisfies ExecutionContext);
 const full=await read({});assert.equal(full.status,'ok');if(full.status!=='ok')throw Error('unexpected');assert.deepEqual(full.data,publicPlan(plan));
 const ids:string[]=[];
 for(let cursor='0';;){const response=await read({cursor,limit:4});assert.equal(response.status,'ok');if(response.status!=='ok')throw Error('unexpected');const data=response.data as any;assert.equal(data.revision,4);assert.equal(data.page.total,11);ids.push(...data.rows.map((row:any)=>row.rowId));if(!data.page.nextCursor)break;cursor=data.page.nextCursor;}
 assert.deepEqual(ids,plan.rows.map(row=>row.rowId));
 const selected=await read({rowIds:['r6']});assert.equal(selected.status,'ok');if(selected.status==='ok')assert.deepEqual((selected.data as any).rows.map((row:any)=>row.rowId),['r6']);
 assert.equal((await read({rowIds:['missing']})).status,'failed');
 assert.equal((await read({cursor:'50'})).status,'failed');
 assert.equal(plan.rows.length,11);
});

test('runtime plan conflicts expose only a bounded verified read; never replay a write',async t=>{
 const {AppsRuntime,RuntimeStore}=await import('../../packages/app-runtime/src/index.ts');
 const {HallmarkProvider,HallmarkStorePort}=await import('../../packages/app-hallmark/src/index.ts');
 const {projectModelResult}=await import('../../packages/app-runtime/src/projection.ts');
 const {realStores}=await import('../real-data/corpus.ts');
 const db=new RuntimeStore(':memory:'),runtime=new AppsRuntime(db),ports=new Map<string,InstanceType<typeof HallmarkStorePort>>();let calls=0,serial=0;
 const port=(id:string)=>{let value=ports.get(id);if(!value){value=new HallmarkStorePort(db,id);ports.set(id,value);}return value;};
 const forbidden=async()=>{calls++;throw Error('External calls forbidden in conflict control');};
 t.mock.method(globalThis,'fetch',forbidden);
 runtime.register(new HallmarkProvider({store:port,client:new Proxy({},{get:()=>forbidden}) as any,broker:new Proxy({},{get:()=>forbidden}) as any,reviewer:{review:forbidden}}));
 for(const id of ['local','other']){runtime.addConnection({appId:'hallmark',connectionId:id,displayName:id,config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'owner',appId:'hallmark',connectionId:id,enabled:true,boundAt:new Date().toISOString()});}
 const source=realSourceProducts()[0],storeId=String(realStores()[0].id);
 // Lifecycle/row/offer identifiers are explicit local controls; business text comes from the frozen corpus.
 const plan:BusinessPlan={planId:'conflict-control',storeId,title:source.title,revision:2,status:'draft',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',rows:[{rowId:'control-row',revision:2,action:'listing',target:{offerId:'control-offer'},payload:{name:source.title},status:'draft',issues:[],corrections:[],repairHistory:{}}]};
 port('local').put('business_plans',plan.planId,plan);
 const invoke=async(capabilityId:string,input:any,connectionId='local',sessionId='owner')=>runtime.invoke({protocolVersion:'1.0',appId:'hallmark',connectionId,capabilityId,capabilityVersion:'1.0.0',input,invocationId:`conflict-${++serial}`,traceId:'conflict-control',source:{kind:'agent',sessionId,nativeCallId:`conflict-${serial}`},deadlineAt:new Date(Date.now()+30000).toISOString()}) as Promise<any>;
 const patch={rowId:plan.rows[0].rowId,action:'listing',target:plan.rows[0].target,payload:plan.rows[0].payload};
 try{
  const conflicts=[];
  for(const capability of ['hallmark.plan.revise','hallmark.listing.draft.revise','hallmark.plan.submit','hallmark.listing.draft.submit']){
   const input={planId:plan.planId,expectedRevision:1,...(capability.endsWith('revise')?{rows:[patch]}:{})};
   const result=await invoke(capability,input),projection=projectModelResult(db,result),model=JSON.parse(projection.content);
   conflicts.push({capability,result,projection,model});
   if(!model.error.details?.recovery)t.diagnostic(`Baseline: ${capability} has only a bare conflict code, no verified read route.`);
  }
  for(const {capability,result,projection,model} of conflicts){
   assert.equal(result.status,'failed');assert.equal(model.error.code,'BUSINESS_PLAN_VERSION_CHANGED');assert.equal(model.error.retryPolicy,'never');
   assert.equal(model.error.details?.recovery?.capability,'hallmark.plan.get');
   assert.deepEqual(model.error.details.recovery.input,{planId:plan.planId,view:'payload',cursor:'0',limit:10});
   assert.equal(model.error.details.storeId,storeId);assert.equal(model.error.details.observedRevision,2);
   assert.match(model.error.details.guidance,/授权/);assert.match(model.error.details.guidance,/版本/);
   assert.equal(projection.fullResultRef,undefined);assert.ok(Buffer.byteLength(projection.content)<3000);
   t.diagnostic(`${capability}: model projection ${Buffer.byteLength(projection.content)} bytes; existing paged read executes without external calls.`);
   const read=await invoke(model.error.details.recovery.capability,model.error.details.recovery.input);assert.equal(read.status,'ok');assert.equal(read.data.revision,2);assert.equal(read.data.storeId,storeId);
   assert.deepEqual(port('local').get('business_plans',plan.planId),plan);
  }
  const huge='untrusted-input-control-'.repeat(10000),result=await invoke('hallmark.plan.revise',{planId:plan.planId,expectedRevision:1,rows:[{...patch,payload:{name:huge}}]});
  assert.ok(!JSON.stringify(result).includes(huge));assert.ok(Buffer.byteLength(JSON.stringify(result))<3000);
  const recovery=result.error.details.recovery;
  const other=await invoke('hallmark.plan.revise',{planId:plan.planId,expectedRevision:1,rows:[patch]},'other');assert.equal(other.error.code,'BUSINESS_PLAN_NOT_FOUND');assert.equal(other.error.details,undefined);
  const denied=await invoke(recovery.capability,recovery.input,'local','unbound');assert.equal(denied.error.code,'APP_NOT_ACTIVE');assert.equal(denied.error.details,undefined);assert.ok(!JSON.stringify(denied).includes(storeId));
  const missing=await invoke('hallmark.plan.revise',{planId:huge,expectedRevision:1,rows:[patch]});assert.equal(missing.error.code,'BUSINESS_PLAN_NOT_FOUND');assert.equal(missing.error.details,undefined);assert.ok(Buffer.byteLength(JSON.stringify(missing))<1000);
  // Existing plan.get returns the current revision, not a pinned snapshot. Read guidance must not authorize the observed revision.
  port('local').put('business_plans',plan.planId,{...plan,revision:3});
  const newer=await invoke(recovery.capability,recovery.input);assert.equal(newer.data.revision,3);
  const stillStale=await invoke('hallmark.plan.revise',{planId:plan.planId,expectedRevision:2,rows:[patch]});assert.equal(stillStale.error.code,'BUSINESS_PLAN_VERSION_CHANGED');assert.equal(stillStale.error.details.observedRevision,3);
  // Oversized verified identities omit the entire route, not partial/truncated scope.
  port('local').put('business_plans',huge,{...plan,planId:huge});
  const bounded=await invoke('hallmark.plan.revise',{planId:huge,expectedRevision:1,rows:[patch]});assert.equal(bounded.error.code,'BUSINESS_PLAN_VERSION_CHANGED');assert.equal(bounded.error.details.recovery,undefined);assert.equal(bounded.error.details.recoveryOmitted,'verified_scope_exceeds_budget');assert.ok(Buffer.byteLength(JSON.stringify(bounded))<2000);
  // An unresolved row stays inspect-only; conflict recovery neither resets its status nor resubmits it.
  const unresolved={...plan,revision:3,status:'unknown' as const,rows:plan.rows.map(row=>({...row,status:'unknown' as const,executionId:'pending-control'}))};
  port('local').put('business_plans',plan.planId,unresolved);
  const unknownConflict=await invoke('hallmark.plan.submit',{planId:plan.planId,expectedRevision:2});assert.equal(unknownConflict.error.code,'BUSINESS_PLAN_VERSION_CHANGED');
  const unknownRead=await invoke(recovery.capability,recovery.input);assert.equal(unknownRead.data.rows[0].status,'unknown');assert.deepEqual(port('local').get('business_plans',plan.planId),unresolved);
  // Losing the original plan during error enrichment must not reveal cached metadata or mask the conflict.
  const {BusinessOperations}=await import('../../packages/app-hallmark/src/operations/index.ts');
  const get=BusinessOperations.prototype.get;let reads=0;
  const vanished=t.mock.method(BusinessOperations.prototype,'get',function(this:InstanceType<typeof BusinessOperations>,id:string){if(++reads===3)throw Error('BUSINESS_PLAN_NOT_FOUND');return get.call(this,id);});
  const lost=await invoke('hallmark.plan.revise',{planId:plan.planId,expectedRevision:1,rows:[patch]});assert.equal(lost.error.code,'BUSINESS_PLAN_VERSION_CHANGED');assert.equal(lost.error.details,undefined);vanished.mock.restore();
  const key=JSON.stringify(['hallmark','local','business_plans',plan.planId]);db.delete('provider_records',key);
  const deleted=await invoke(recovery.capability,recovery.input);assert.equal(deleted.error.code,'BUSINESS_PLAN_NOT_FOUND');assert.equal(deleted.error.details,undefined);
  assert.equal(calls,0);assert.equal(port('local').list('business_executions').length,0);assert.equal(port('local').list('business_review_cache').length,0);
 }finally{await runtime.dispose();db.close();}
});
