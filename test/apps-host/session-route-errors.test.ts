import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityDescriptor} from '../../packages/app-contracts/src/index.ts';

async function fixture(mode:'routed'|'legacy'='routed') {
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map<string,NativeGatewayTool>();
  const parent={id:'parent'},child={id:'child',session:{id:'parent'},parentId:'parent'},agents=new Map([[parent.id,parent],[child.id,child]]);
  let reads=0,writes=0,inspections=0,projections=0,projectionFails=false,providerOperationMissing=false;
  const descriptors:CapabilityDescriptor[]=['query','mutation'].map(effect=>({capabilityId:`fixture.rows.${effect}`,version:'1.0.0',title:'Synthetic rows',description:'Isolated fixture',effect:effect as 'query'|'mutation',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execution:{mode:'sync',timeoutMs:1000,concurrency:effect==='query'?'declared_safe':'exclusive',lockScope:'connection',idempotency:effect==='query'?'not_applicable':'runtime_dedup',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}));
  runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['record']},descriptors,
    async execute(context){const identity={invocationId:context.request.invocationId,traceId:context.request.traceId};if(context.request.capabilityId.endsWith('mutation')){writes++;return {...identity,status:'pending',operation:{operationId:context.operationId!,state:'pending'},pollAfterMs:1000};}reads++;return {...identity,status:'ok',data:{value:'fixture'}};},
    async inspect(_id,context){inspections++;const identity={invocationId:context.request.invocationId,traceId:context.request.traceId};return providerOperationMissing?{...identity,status:'failed',error:{code:'OPERATION_NOT_FOUND',message:'Synthetic provider operation missing.',retryPolicy:'never'}}:{...identity,status:'ok',data:{value:'confirmed'}};},async dispose(){}});
  for(const connectionId of ['C1','C2'])runtime.addConnection({appId:'fixture',connectionId,displayName:connectionId,config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:parent.id,appId:'fixture',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const token=randomUUID()+randomUUID(),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const transport=new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token),identity=transport.identity.bind(transport),project=transport.projectModelResult.bind(transport);
  if(mode==='legacy')transport.identity=async()=>{const value=await identity();return {...value,hostFeatures:((value as {hostFeatures?:string[]}).hostFeatures??[]).filter(feature=>feature!=='routedInvocationsV1')};};
  transport.projectModelResult=async(id,signal)=>{projections++;if(projectionFails)throw new Error('Synthetic projection transport failure');return project(id,signal);};
  const host=new AppsHost({agents:{get:id=>agents.get(id)},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
  await host.start();host.attachApp('fixture');
  const invoke=tools.get('apps_invoke')!,inspect=tools.get('apps_inspect')!,args={appId:'fixture',connectionId:'C1',capabilityId:'fixture.rows.query',capabilityVersion:'1.0.0',input:{}};
  const execute=async(tool:NativeGatewayTool,input:unknown,agent=parent)=>{const native=await tool.execute(input,{agent,signal:new AbortController().signal});return {native,visible:JSON.parse(tool.output.render(input,native)[0].text)};};
  return {store,runtime,host,parent,child,args,invoke,inspect,execute,counts:()=>({reads,writes,inspections,projections}),failProjection:()=>{projectionFails=true;},providerMissing:()=>{providerOperationMissing=true;},async close(){await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}};
}

for(const kind of ['unknown','query-invocation'] as const)test(`early inspect failure preserves OPERATION_NOT_FOUND for ${kind}`,async()=>{
  const f=await fixture();try{
    const operationId=kind==='unknown'?'missing-operation':(await f.execute(f.invoke,f.args)).visible.invocationId;
    const result=await f.execute(f.inspect,{operationId});
    assert.equal(result.visible.status,'failed');assert.equal(result.visible.error.code,'OPERATION_NOT_FOUND');
    assert.match(result.visible.error.message,/operationId/);assert.doesNotMatch(JSON.stringify(result.visible),/RESULT_SPILL_FAILED/);
    assert.equal(f.counts().projections,0,'an early failure has no stored invocation to project');assert.equal(f.counts().inspections,0);
    assert.equal(f.store.get('invocations',result.visible.invocationId),undefined);
  }finally{await f.close();}
});

test('valid inspect remains projected and a real projection failure remains visible',async()=>{
  const f=await fixture();try{
    const submitted=await f.execute(f.invoke,{...f.args,capabilityId:'fixture.rows.mutation',idempotencyKey:'fixture-intent'}),operationId=submitted.visible.operation.operationId;
    const first=await f.execute(f.inspect,{operationId});assert.equal(first.visible.status,'ok');assert.equal(first.visible.operation.operationId,operationId);assert.equal(first.visible.data.value,'confirmed');
    assert.equal(f.counts().projections,1);assert.equal(f.counts().inspections,1);
    f.failProjection();const failed=await f.execute(f.inspect,{operationId});assert.equal(failed.visible.error.code,'RESULT_SPILL_FAILED');
    assert.equal((failed.native as {result:{status:string}}).result.status,'ok');assert.equal(f.counts().writes,1);assert.equal(f.counts().inspections,1,'completed inspection is not dispatched again');
  }finally{await f.close();}
});

test('a provider OPERATION_NOT_FOUND with a real operation still uses the normal projection path',async()=>{
  const f=await fixture();try{
    const submitted=await f.execute(f.invoke,{...f.args,capabilityId:'fixture.rows.mutation',idempotencyKey:'provider-failure'}),operationId=submitted.visible.operation.operationId;
    f.providerMissing();f.failProjection();
    const inspected=await f.execute(f.inspect,{operationId}),actual=(inspected.native as {result:{error:{code:string};operation:{operationId:string}}}).result;
    assert.equal(actual.error.code,'OPERATION_NOT_FOUND');assert.equal(actual.operation.operationId,operationId);
    assert.equal(inspected.visible.error.code,'RESULT_SPILL_FAILED');assert.equal(f.counts().projections,1);assert.equal(f.counts().writes,1);
  }finally{await f.close();}
});

for(const mode of ['routed','legacy'] as const)test(`${mode} routing reports missing binding and preserves parent/child isolation until explicit Host binding`,async()=>{
  const f=await fixture(mode);try{
    assert.equal((await f.execute(f.invoke,f.args)).visible.status,'ok');
    const denied=(await f.execute(f.invoke,f.args,f.child)).visible;
    assert.equal(denied.status,'needs_clarification');assert.deepEqual(denied.missing,['connectionBinding']);assert.deepEqual(denied.candidates,[]);
    assert.match(denied.question,/当前会话|current session/);assert.match(denied.question,/宿主|Host/);assert.match(denied.question,/父会话/);
    assert.equal(f.counts().reads,1);assert.equal(f.runtime.sessionBindings(f.child.id).length,0,'self-reported parent/session fields never inherit business authority');
    const absent={...f.args} as Partial<typeof f.args>;delete absent.connectionId;
    assert.deepEqual((await f.execute(f.invoke,absent,f.child)).visible.missing,['connectionBinding']);
    assert.equal((await f.execute(f.invoke,{...f.args,parentSessionId:f.parent.id},f.child)).visible.error.code,'INVALID_INPUT');
    assert.equal((await f.execute(f.invoke,f.args,{id:f.parent.id})).visible.error.code,'INVALID_SESSION');
    const response=await f.host.ui(new Request('http://dsh.invalid/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'bind',sessionId:f.child.id,appId:'fixture',connectionId:'C1',enabled:true})}));
    assert.equal(response.status,200);assert.equal((await f.execute(f.invoke,f.args,f.child)).visible.status,'ok');assert.equal(f.counts().reads,2);
    assert.deepEqual(f.runtime.sessionBindings(f.child.id).map(binding=>binding.connectionId),['C1']);
    const other=(await f.execute(f.invoke,{...f.args,connectionId:'C2'},f.child)).visible;assert.deepEqual(other.missing,['connectionBinding']);assert.equal(f.counts().reads,2);
  }finally{await f.close();}
});

for(const mode of ['routed','legacy'] as const)test(`${mode} routing still requests connectionId when multiple authorized choices exist`,async()=>{
  const f=await fixture(mode);try{
    await f.host.bind(f.parent.id,'fixture','C2',true);
    const {connectionId,...args}=f.args,result=(await f.execute(f.invoke,args)).visible;
    assert.equal(result.status,'needs_clarification');assert.deepEqual(result.missing,['connectionId']);assert.deepEqual(result.candidates.map((row:{connectionId:string})=>row.connectionId),['C1','C2']);assert.equal(f.counts().reads,0);
  }finally{await f.close();}
});
