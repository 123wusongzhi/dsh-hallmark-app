import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {BUSINESS_DESCRIPTORS,executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';

async function fixture(large=false){
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map<string,NativeGatewayTool>(),agent={id:'filter-session'},token='filter-token-'.repeat(5);
 const rows=Array.from({length:80},(_,i)=>({rowId:`row-${i}`,revision:1,action:'listing',target:{offerId:`offer-${i}`,sku:`sku-${i}`},...(i%2===0?{retryAt:null}:{}),status:'blocked',issues:large?[{code:'CHECK',message:'精确字段说明'.repeat(120)}]:[],payload:{name:`Product ${i}`}}));
 const plan={planId:'filter-plan',revision:2,storeId:'shop',status:'blocked',rows};let gets=0;const requests:any[]=[];const operations={get(id:string){assert.equal(id,plan.planId);gets++;return structuredClone(plan);}};
 const businessStore={get(_namespace:string,id:string){assert.equal(id,'original-operation');return {planId:plan.planId};},put(){throw Error('No business operation permitted');}};
 runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:BUSINESS_DESCRIPTORS,execute:context=>{requests.push(structuredClone(context.request));return executeBusiness(operations as any,businessStore as any,context);},async dispose(){}});
 runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:t=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));await host.start();host.attachApp('hallmark');
 const call=async(args:any,expectedStatus='ok')=>{const tool=tools.get('apps_invoke')!;assert.deepEqual(compileSchema(tool.parameters)(args),[]);const output:any=await tool.execute(args,{agent,signal:new AbortController().signal});const text=(tool.output.render(args,output) as any[])[0].text;assert.ok(Buffer.byteLength(text)<=16384);const view=JSON.parse(text);assert.equal(view.status,expectedStatus);return view;};
 const inspect=async(args:any)=>{const tool=tools.get('apps_inspect')!;assert.deepEqual(compileSchema(tool.parameters)(args),[]);return await tool.execute(args,{agent,signal:new AbortController().signal}) as any;};
 return {rows,plan,call,inspect,requests,store,runtime,get gets(){return gets;},close:async()=>{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}};
}
for(const scenario of [
 {name:'filtered provider page',capability:'hallmark.plan.get',large:false,filtered:true,limit:1},
 {name:'filtered draft alias page',capability:'hallmark.listing.draft.get',large:false,filtered:true,limit:1},
 {name:'filtered operation link page',capability:'hallmark.plan.get',large:false,filtered:true,limit:1,operation:true},
 {name:'filtered model-budget page',capability:'hallmark.plan.get',large:true,filtered:true,limit:200},
 {name:'unfiltered provider page',capability:'hallmark.plan.get',large:false,filtered:false,limit:1},
 {name:'filtered terminal page',capability:'hallmark.plan.get',large:false,filtered:true,limit:200},
])test(`copy exact emitted business continuation: ${scenario.name}`,async()=>{
 const f=await fixture(scenario.large);try{
  const selected=f.rows.filter((_,i)=>i%3===2),rowIds=selected.map(r=>r.rowId),expected=(scenario.filtered?selected:f.rows).map(r=>r.rowId);
  let args:any={appId:'hallmark',connectionId:'C1',capabilityId:scenario.capability,capabilityVersion:'1.0.0',input:{...(scenario.operation?{operationId:'original-operation'}:{planId:'filter-plan'}),...(scenario.filtered?{rowIds}:{}),limit:scenario.limit}};
  const seen:string[]=[],emitted:any[]=[];
  for(let count=0;;count++){
   assert.ok(count<100);const view=await f.call(args);seen.push(...view.data.rows.map((r:any)=>r.rowId));for(const r of view.data.rows){const source=f.rows.find(x=>x.rowId===r.rowId)!;assert.deepEqual(r.target,source.target);assert.equal(Object.hasOwn(r,'retryAt'),Object.hasOwn(source,'retryAt'));if(Object.hasOwn(source,'retryAt'))assert.equal(r.retryAt,null);}const next=view.data.continuation;
   if(!next)break;assert.equal(next.tool,'apps_invoke');emitted.push(next.arguments);args=next.arguments;
  }
  console.log(JSON.stringify({scenario:scenario.name,gets:f.gets,expected,seen,firstContinuation:emitted[0]??null}));
  assert.deepEqual(seen,expected,'Exact emitted continuation must retain the original row selection and order');
  if(scenario.filtered)for(const next of emitted)assert.deepEqual(next.input.rowIds,rowIds);
 }finally{await f.close();}
});

for(const kind of ['empty-plan','unknown-row','empty-selection','updated-revision'])test(`business selection negative control: ${kind}`,async()=>{
 const f=await fixture();try{
  const args:any={appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.plan.get',capabilityVersion:'1.0.0',input:{planId:'filter-plan',limit:1}};
  if(kind==='empty-plan'){f.rows.splice(0);const result=await f.call(args);assert.deepEqual(result.data.rows,[]);assert.equal(result.data.continuation,undefined);}
  else if(kind==='unknown-row'){args.input.rowIds=['missing'];const result=await f.call(args,'failed');assert.equal(result.error.code,'BUSINESS_PLAN_ROW_NOT_FOUND');assert.equal(f.gets,1);}
  else if(kind==='empty-selection'){args.input.rowIds=[];const result=await f.call(args,'failed');assert.equal(result.error.code,'INPUT_SCHEMA_INVALID');assert.equal(f.gets,0);}
  else{args.input.rowIds=['row-2','row-8','row-23'];const first=await f.call(args);f.plan.revision=3;f.rows[8].status='draft';const second=await f.call(first.data.continuation.arguments);assert.equal(second.data.revision,3);assert.deepEqual(second.data.rows.map((r:any)=>r.rowId),['row-8','row-23']);assert.equal(second.data.rows[0].status,'draft');}
 }finally{await f.close();}
});

test('oversized selection recovery reaches every selected row through emitted bounded reads and fresh filtered pages',async()=>{
 const f=await fixture();try{
  for(let i=0;i<f.rows.length;i++)f.rows[i].rowId=`${i}-`+'长'.repeat(180);
  const rowIds=f.rows.filter((_,i)=>i%2===1).map(r=>r.rowId);
  let args:any={appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.listing.draft.get',capabilityVersion:'1.0.0',input:{planId:'filter-plan',rowIds,limit:1}};
  const seen:string[]=[],revisions:number[]=[],recoveries:any[]=[],observed:any[]=[];
  for(let round=0;;round++){
   assert.ok(round<10);const result=await f.call(args);revisions.push(result.data.revision);
   if(result.data.rows.length){observed.push(...result.data.rows);seen.push(...result.data.rows.map((row:any)=>row.rowId));if(!result.data.continuation)break;args=result.data.continuation.arguments;continue;}
   assert.equal(result.data.completeness,'incomplete');assert.equal(result.data.modelProjectionError.code,'ROW_MODEL_BUDGET_EXCEEDED');assert.match(result.readInstructions,/current.*next/);
   let page=await f.inspect(result.read.arguments),text='';
   for(let n=0;;n++){assert.ok(n<20);assert.equal(page.kind,'string');assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);text+=page.text;if(!page.continuation)break;page=await f.inspect(page.continuation.arguments);}
   const recovery=JSON.parse(text);recoveries.push({read:result.read,recovery});
   assert.equal(recovery.next.tool,'apps_invoke');assert.equal(recovery.next.arguments.capabilityId,'hallmark.plan.get');assert.deepEqual(recovery.next.arguments.input.rowIds,rowIds);
   assert.equal(recovery.next.arguments.connectionId,'C1');assert.equal(recovery.next.arguments.input.limit,20);
   let current=await f.inspect(recovery.current.arguments);const before=f.gets;
   for(let n=0;;n++){assert.ok(n<20);assert.equal(current.kind,'array');observed.push(...current.items);seen.push(...current.items.map((row:any)=>row.rowId));if(!current.continuation)break;current=await f.inspect(current.continuation.arguments);}
   assert.equal(f.gets,before,'retained rows must not repeat provider reads');
   if(round===0){f.plan.revision=3;f.rows[3].status='draft';}
   args=recovery.next.arguments;
  }
  assert.deepEqual(seen,rowIds);assert.deepEqual(revisions,[2,3,3]);assert.equal(observed[1].status,'draft');assert.equal(f.gets,3);assert.ok(recoveries.length>=2);
  assert.deepEqual(f.requests.map(request=>request.input.limit),[1,20,20]);for(const request of f.requests)assert.deepEqual(request.input.rowIds,rowIds);
  // The current-result and serialized next-call references retain the same original authorization.
  f.runtime.addConnection({appId:'hallmark',connectionId:'C2',displayName:'Other',config:{},configRevision:1,enabled:true});
  f.runtime.bind({sessionId:'filter-session',appId:'hallmark',connectionId:'C1',enabled:false,boundAt:new Date().toISOString()});
  f.runtime.bind({sessionId:'filter-session',appId:'hallmark',connectionId:'C2',enabled:true,boundAt:new Date().toISOString()});
  for(const hint of [recoveries[0].read,recoveries[0].recovery.current])assert.equal((await f.inspect(hint.arguments)).error.code,'RESULT_ACCESS_DENIED');
  assert.equal(f.gets,3);
 }finally{await f.close();}
});
