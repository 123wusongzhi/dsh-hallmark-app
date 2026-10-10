import test from 'node:test';
import assert from 'node:assert/strict';
import {executeBusiness,publicPlan} from '../../packages/app-hallmark/src/operations-provider.ts';
import type {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import type {BusinessPlan} from '../../packages/app-hallmark/src/operations/types.ts';
import type {CoreStore} from '../../packages/core/src/types.ts';
import type {ExecutionContext,JsonValue} from '../../packages/app-contracts/src/index.ts';

test('plan read pages keep stable identities and preserve the unpaged UI contract',async()=>{
 const plan:BusinessPlan={planId:'p',storeId:'bill',title:'batch',revision:4,status:'partial',createdAt:'now',updatedAt:'now',rows:Array.from({length:11},(_,i)=>({rowId:`r${i}`,revision:2,action:'listing',target:{offerId:`offer${i}`},payload:{name:`Title ${i}`},status:i?'rejected':'succeeded',issues:i?[{code:'ATTRIBUTE',field:'attributes',message:'Correct this field'}]:[],corrections:[],repairHistory:{}}))};
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
