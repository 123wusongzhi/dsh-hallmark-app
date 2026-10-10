import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import type {AppProvider,CapabilityDescriptor} from '../../packages/app-contracts/src/index.ts';

/** Independent reviewer: real service authorization remains effective without Host checks. */
test('recovery HTTP and spilled evidence retain their distinct owner and bound-connection policies',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let writes=0,inspections=0;
  const descriptor:CapabilityDescriptor={capabilityId:'reviewfixture.rows.write',version:'1.0.0',title:'Isolated boundary fixture',description:'Synthetic receipt only',effect:'mutation',inputSchema:{type:'object',properties:{privateEvidence:{type:'string'}},required:['privateEvidence'],additionalProperties:false},outputSchema:{type:'object',properties:{receipt:{type:'string'}},required:['receipt'],additionalProperties:false},execution:{mode:'sync',timeoutMs:5000,concurrency:'exclusive',lockScope:'connection',idempotency:'runtime_dedup',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'reviewfixture',displayName:'Review fixture',providerPackage:'review-fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor],async execute({request}){writes++;return {invocationId:request.invocationId,traceId:request.traceId,status:'ok',data:{receipt:'public-synthetic-receipt'.repeat(2000)}};},async inspect(){inspections++;throw Error('No Provider inspection permitted');},async dispose(){}};
  runtime.register(provider);
  for(const connectionId of ['original','other'])runtime.addConnection({appId:'reviewfixture',connectionId,displayName:connectionId,enabled:true,config:{internalOnly:'synthetic-config-marker'},configRevision:1});
  const bind=(sessionId:string,connectionId:string,enabled=true)=>runtime.bind({sessionId,appId:'reviewfixture',connectionId,enabled,boundAt:new Date().toISOString()});
  bind('owner','original');bind('fork','original');bind('foreign','other');
  const invocationId=randomUUID(),traceId=randomUUID();
  const original=await runtime.invoke({protocolVersion:'1.0',appId:'reviewfixture',connectionId:'original',capabilityId:descriptor.capabilityId,capabilityVersion:'1.0.0',input:{privateEvidence:'synthetic-input-marker'},invocationId,traceId,source:{kind:'agent',sessionId:'owner',nativeCallId:'review'},idempotencyKey:'single-authorized-fixture',deadlineAt:new Date(Date.now()+5000).toISOString()});assert.equal(original.status,'ok');
  const ledger=()=>JSON.stringify({invocations:store.list('invocations'),operations:store.list('operations'),mapping:store.list('invocation_operations')}),before=ledger();
  const token=randomUUID(),presentation=new AppsPresentationService({runtime,store}),server=createAppsServer({runtime,presentation,token});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  const get=(path:string)=>fetch(`http://127.0.0.1:${address.port}${path}`,{headers:{Authorization:`Bearer ${token}`}});
  try{
    for(const session of ['fork','foreign','unbound']){const denied=await get(`/v1/invocations/${invocationId}/inspect?sessionId=${session}`);assert.equal(denied.status,404);assert.ok(!(await denied.text()).includes('public-synthetic-receipt'));}
    const response=await get(`/v1/invocations/${invocationId}/inspect?sessionId=owner`);assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('synthetic-input-marker'));assert.ok(!text.includes('synthetic-config-marker'));const recovered=JSON.parse(text);assert.equal(recovered.result.invocationId,invocationId);const model=JSON.parse(recovered.modelProjection.content);assert.ok(Buffer.byteLength(recovered.modelProjection.content)<=16384);assert.ok(model.fullResultRef);
    const path=`/v1/results/${encodeURIComponent(model.fullResultRef)}?path=/data/receipt&sessionId=`;
    for(const session of ['foreign','unbound']){const denied=await get(path+session);assert.equal(denied.status,403);}
    // Existing product contract explicitly permits a fork with the same enabled connection.
    for(const session of ['owner','fork']){const allowed=await get(path+session);assert.equal(allowed.status,200);assert.ok((await allowed.json()).text.startsWith('public-synthetic-receipt'));}
    bind('owner','original',false);bind('fork','original',false);
    assert.equal((await get(path+'owner')).status,403);assert.equal((await get(path+'fork')).status,403);
    assert.equal(ledger(),before);assert.equal(writes,1);assert.equal(inspections,0);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});

/** Non-author regression of the parent's identified asynchronous permission boundary. */
test('service withholds an in-flight operation receipt after actual binding revocation without rewriting its outcome',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let writes=0,inspections=0,release!:()=>void,entered!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  const descriptor:CapabilityDescriptor={capabilityId:'revokefixture.rows.write',version:'1.0.0',title:'Revoke fixture',description:'Synthetic receipt only',effect:'mutation',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',properties:{receipt:{type:'string'}},required:['receipt'],additionalProperties:false},execution:{mode:'sync',timeoutMs:5000,concurrency:'exclusive',lockScope:'connection',idempotency:'runtime_dedup',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'revokefixture',displayName:'Revoke fixture',providerPackage:'review-fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[descriptor],async execute({request,operationId}){writes++;return {invocationId:request.invocationId,traceId:request.traceId,status:'pending',operation:{operationId:operationId!,state:'pending'},pollAfterMs:1000};},async inspect(operationId,{request}){inspections++;entered();await gate;return {invocationId:request.invocationId,traceId:request.traceId,status:'ok',operation:{operationId,state:'succeeded'},data:{receipt:'synthetic-withheld-after-revoke'}};},async dispose(){}};
  runtime.register(provider);runtime.addConnection({appId:'revokefixture',connectionId:'C',displayName:'C',enabled:true,config:{},configRevision:1});
  const binding={sessionId:'owner',appId:'revokefixture',connectionId:'C',enabled:true,boundAt:new Date().toISOString()};runtime.bind(binding);
  const original=await runtime.invoke({protocolVersion:'1.0',appId:'revokefixture',connectionId:'C',capabilityId:descriptor.capabilityId,capabilityVersion:'1.0.0',input:{},invocationId:randomUUID(),traceId:randomUUID(),source:{kind:'agent',sessionId:'owner',nativeCallId:'review'},idempotencyKey:'review-once',deadlineAt:new Date(Date.now()+5000).toISOString()});assert.equal(original.status,'pending');const operationId=original.operation!.operationId;
  const token=randomUUID(),server=createAppsServer({runtime,presentation:new AppsPresentationService({runtime,store}),token});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
  try{
    const response=fetch(`http://127.0.0.1:${address.port}/v1/operations/${operationId}/inspect-session`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sessionId:'owner'})});
    await started;runtime.bind({...binding,enabled:false});release();
    const result=await response,body=await result.text();assert.equal(result.status,403);assert.ok(body.includes('CONNECTION_NOT_BOUND'));assert.ok(!body.includes('synthetic-withheld-after-revoke'));
    assert.equal(store.get<any>('operations',operationId).state,'succeeded');assert.equal(writes,1);assert.equal(inspections,1);
  }finally{release();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
