import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { composeAppsRuntime } from '../../packages/service/src/apps-main.ts';
import { createAppsServer } from '../../packages/service/src/apps-server.ts';
import { AppsClient, HttpRuntimeTransport, generateArtifacts } from '../../packages/app-sdk/src/index.ts';
import { ScriptRun } from '../../packages/app-runtime/src/runs.ts';
import { RuntimeWriterLease } from '../../packages/app-runtime/src/lease.ts';
import { AppsHost, HttpAppsHostTransport } from '../../packages/plugin-apps/src/index.ts';
import type { InvocationRequest, CapabilityResult } from '../../packages/app-contracts/src/index.ts';
const token='a'.repeat(64);
test('SDK refuses incompatible handshake with expected and actual versions before invoke',async()=>{
  let calls=0;
  const client=new AppsClient({identity:async()=>({transportMajor:2,catalogSchemaVersion:3,catalogDigest:'incompatible'}),describe:async()=>undefined,invoke:async()=>{calls++;throw new Error('must not dispatch');},inspect:async()=>{throw new Error('must not inspect');}},{kind:'agent',sessionId:'s',nativeCallId:'incompatible'});
  const result=await client.invoke({appId:'notes',connectionId:'n'},{capabilityId:'notes.notes.list',version:'1.0.0',effect:'query',execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'}},{});
  assert.equal(calls,0);assert.equal(result.status,'failed');if('error' in result){assert.equal(result.error.code,'INCOMPATIBLE_PROTOCOL');assert.deepEqual(result.error.details,{expected:{transportMajor:1,catalogSchemaVersion:1},actual:{transportMajor:2,catalogSchemaVersion:3}});assert.match(result.error.message,/received transport 2/);}
});
async function listening(server:ReturnType<typeof createServer>):Promise<string> {await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('PORT_REQUIRED');return `http://127.0.0.1:${address.port}`;}
async function closed(server:ReturnType<typeof createServer>) {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
async function setup() {
  let upstreamReads=0;const upstream=createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/api/stores'){upstreamReads++;res.end(JSON.stringify([{id:'store',shopName:'Fixture'}]));}else if(req.url==='/api/health')res.end('{"service":"hallmark-control"}');else{res.statusCode=404;res.end('{}');}}),backend=await listening(upstream);
  const directory=mkdtempSync(join(tmpdir(),'apps-http-')),instance=composeAppsRuntime(directory,{connections:[{appId:'hallmark',connectionId:'h',displayName:'Hallmark fixture',config:{baseUrl:backend},enabled:true,configRevision:1},{appId:'notes',connectionId:'n',displayName:'Notes fixture',config:{backend:'local:notes-fixture'},enabled:true,configRevision:1}],legacyHallmarkConnectionId:'h'});
  const server=createAppsServer({...instance,token}),url=await listening(server);
  const call=async(path:string,input?:unknown)=>fetch(new URL(path,url),{method:input===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});
  const bind=async()=>{await call('/sessions/s/app',{active:true});await call('/v1/session-bindings',{sessionId:'s',appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});};
  const cleanup=async()=>{await closed(server);await instance.close();await closed(upstream);rmSync(directory,{recursive:true,force:true});};
  return {...instance,url,call,bind,cleanup,upstreamReads:()=>upstreamReads};
}
test('authenticated v1 transport, explicit bindings, legacy tools and script all share Runtime',async()=>{
  const ctx=await setup();try{
    assert.equal((await fetch(`${ctx.url}/v1/apps`)).status,401);
    assert.equal((await ctx.call('/v1/connections',{unexpected:true})).status,400);
    await ctx.bind();const transport=new HttpRuntimeTransport(ctx.url,token),client=new AppsClient(transport,{kind:'agent',sessionId:'s',nativeCallId:'native'});
    const descriptor=await transport.describe('hallmark.stores.list','1.0.0');assert.ok(descriptor);
    const direct=await client.invoke({appId:'hallmark',connectionId:'h'},descriptor,{});assert.equal(direct.status,'ok');
    const legacy=await(await ctx.call('/v1/legacy-invocations',{name:'hallmark_list_stores',arguments:{},sessionId:'s',invocationId:randomUUID(),traceId:randomUUID(),deadlineAt:new Date(Date.now()+30000).toISOString()})).json();assert.equal(legacy.status,'ok');
    const run=new ScriptRun(ctx.runtime,'s');const script=await run.execute(current=>current.call('stores',{appId:'hallmark',connectionId:'h'},descriptor.capabilityId,{}));assert.equal(script.run.state,'succeeded');assert.equal(ctx.upstreamReads(),3);
    const invocations=ctx.store.list('invocations');assert.equal(invocations.length,3);
    const create=await transport.describe('notes.notes.create','1.0.0');assert.ok(create);const note=await client.invoke({appId:'notes',connectionId:'n'},create,{title:'Product evidence',content:'Hallmark store'}, {idempotencyKey:'create-note'});assert.equal(note.status,'ok');assert.equal((await transport.inspect(note.operation!.operationId)).status,'ok');
    const apps=await(await ctx.call('/v1/apps')).json();assert.equal(apps.apps.length,3);assert.equal(ctx.runtime.sessionBindings('other').length,0);
    const missing=await transport.describe('notes.notes.create','2.0.0');assert.equal(missing,undefined);
  }finally{await ctx.cleanup();}
});
test('HTTP response loss returns original result without repeating a Notes mutation',async()=>{
  const ctx=await setup();try{await ctx.bind();let posts=0;const transport=new HttpRuntimeTransport(ctx.url,token,async(url,options)=>{const response=await fetch(url,options);if(String(url).endsWith('/v1/invocations')){posts++;await response.text();throw new Error('response lost');}return response;});
    const descriptor=await transport.describe('notes.notes.create','1.0.0');assert.ok(descriptor);const client=new AppsClient(transport,{kind:'agent',sessionId:'s',nativeCallId:'call'});
    const result=await client.invoke({appId:'notes',connectionId:'n'},descriptor,{title:'Once',content:'Evidence'},{idempotencyKey:'one'});assert.equal(result.status,'ok');assert.equal(posts,1);assert.equal(ctx.store.list<{namespace:string}>('provider_records').filter(row=>row.namespace==='notes').length,1);
  }finally{await ctx.cleanup();}
});
test('multi-application view keeps one offline dataset and rejects unowned sessions',async()=>{
  const ctx=await setup();try{await ctx.bind();
    const response=await ctx.call('/v1/views/open',{sessionId:'s',title:'Stores and notes',design:{kind:'table'},bindings:[{bindingId:'stores',appId:'hallmark',connectionId:'h',capabilityId:'hallmark.stores.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}},{bindingId:'notes',appId:'notes',connectionId:'n',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});assert.equal(response.status,200);const view=await response.json();
    const first=await(await ctx.call(`/v1/views/${view.viewId}/refresh`,{sessionId:'s'})).json();assert.equal(first.bindings.every((row:{state:string})=>row.state==='ready'),true);
    ctx.runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'h',enabled:false,boundAt:new Date().toISOString()});const second=await(await ctx.call(`/v1/views/${view.viewId}/refresh`,{sessionId:'s'})).json();assert.equal(second.bindings[0].freshness,'stale');assert.deepEqual(second.bindings[0].payload,first.bindings[0].payload);assert.equal(second.bindings[1].state,'ready');
    assert.equal((await ctx.call(`/v1/views/${view.viewId}?sessionId=other`)).status,400);
  }finally{await ctx.cleanup();}
});
test('single-writer lease rejects a second process owner and releases deterministically',()=>{
  const directory=mkdtempSync(join(tmpdir(),'apps-lease-'));try{const first=new RuntimeWriterLease(directory);assert.throws(()=>new RuntimeWriterLease(directory),/ALREADY_ACTIVE/);const before=JSON.parse(readFileSync(first.path,'utf8'));assert.equal(before.pid,process.pid);first.release();const second=new RuntimeWriterLease(directory);second.release();}finally{rmSync(directory,{recursive:true,force:true});}
});
test('generated SDK, docs and native parameter projection change from the same capability',async()=>{
  const ctx=await setup();try{const descriptor=ctx.runtime.describe('notes.notes.create')!;const a=generateArtifacts([descriptor]),b=generateArtifacts([{...descriptor,version:'1.1.0',inputSchema:{...descriptor.inputSchema,properties:{...descriptor.inputSchema.properties as object,tag:{type:'string'}}}}]);assert.notEqual(a.source,b.source);assert.notEqual(a.documentation,b.documentation);assert.notDeepEqual(a.tools,b.tools);assert.match(a.source,/CapabilityResult<Output0>/);assert.match(a.source,/client.invoke/);}finally{await ctx.cleanup();}
});
test('component bridge validates ownership/build, invokes Runtime and validates selection without claiming submission',async()=>{
  const ctx=await setup();try{
    const writes:Array<{collection:string;id:string}>=[],put=ctx.store.put.bind(ctx.store);
    ctx.store.put=<T>(collection:string,id:string,value:T):T=>{writes.push({collection,id});return put(collection,id,value);};
    await ctx.bind();const client=new AppsClient(new HttpRuntimeTransport(ctx.url,token),{kind:'agent',sessionId:'s',nativeCallId:'seed'});
    const created=await client.invoke({appId:'notes',connectionId:'n'},ctx.runtime.describe('notes.notes.create')!,{id:'note',title:'Selected',content:'Fixture'},{idempotencyKey:'seed'});assert.equal(created.status,'ok');
    const project=join(dirname(ctx.lease.path),'source');mkdirSync(join(project,'dist'),{recursive:true});
    writeFileSync(join(project,'package.json'),'{"name":"bridge-fixture","version":"1.0.0","type":"module"}');writeFileSync(join(project,'package-lock.json'),'{"name":"bridge-fixture","lockfileVersion":3}');writeFileSync(join(project,'Component.tsx'),'export default function Component(){return null;}');writeFileSync(join(project,'dist','index.html'),'<html><body>HTTP bridge fixture</body></html>');
    const view=ctx.presentation.openSource('s',project,{bindings:[{bindingId:'notes',appId:'notes',connectionId:'n',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
    await ctx.presentation.refreshView('s',view.viewId,{kind:'agent',sessionId:'s',nativeCallId:'refresh'});
    const bridge={channel:'dsh.apps.component.v2',protocolVersion:'2.0',sessionId:'s',viewId:view.viewId,buildId:view.source!.buildId,frameInstanceId:'frame',requestId:'request',method:'getData',params:{}};
    const getData=await(await ctx.call('/v1/component-bridge',bridge)).json();assert.ok(getData.result);assert.equal(getData.sessionId,'s');
    const read=await(await ctx.call('/v1/component-bridge',{...bridge,requestId:'read',method:'invokeCapability',params:{appId:'notes',connectionId:'n',capabilityId:'notes.notes.get',capabilityVersion:'1.0.0',input:{id:'note'},deadlineAt:new Date(Date.now()+10000).toISOString()}})).json();assert.equal(read.result.status,'ok');
    const invocation=ctx.store.get<import('../../packages/app-runtime/src/store.ts').InvocationRecord>('invocations',read.result.invocationId)!;assert.equal(invocation.request.source.kind,'component');
    const selection={bindingId:'notes',datasetRevision:getData.result.bindings[0].revision,resources:[{appId:'notes',connectionId:'n',resourceType:'note',resourceId:'note',revision:'1'}]};
    const attached=await(await ctx.call('/v1/component-bridge',{...bridge,requestId:'attach',method:'attachSelection',params:selection})).json();assert.equal(attached.result.status,'validated');assert.equal(attached.result.selection.resources[0].resourceId,'note');
    const invalid=await(await ctx.call('/v1/component-bridge',{...bridge,method:'requestAgent'})).json();assert.equal(invalid.error.code,'INVALID_INPUT');
    const prepared=await(await ctx.call('/v1/component-bridge',{...bridge,requestId:'prepared-input',method:'requestAgent',params:{text:'Inspect the selected note',expectedContextRevision:0}})).json();assert.equal(prepared.result.status,'prepared');assert.equal(prepared.result.receipt,undefined);
    assert.equal((await ctx.call('/v1/component-bridge',{...bridge,sessionId:'other'})).status,400);assert.equal((await ctx.call('/v1/component-bridge',{...bridge,buildId:'a'.repeat(64)})).status,400);
    const host=new AppsHost({tools:{register:()=>()=>{}},agents:{get:id=>id==='s'?{id}:undefined},sessions:{get:id=>id==='s'?{id}:undefined}},new HttpAppsHostTransport(ctx.url,token));await host.start();host.attachApp('notes');
    try{const native=await host.call('apps_invoke',{appId:'notes',connectionId:'n',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{id:'host',title:'Native',content:'Fixture'},idempotencyKey:'host'},'s');assert.equal((native as CapabilityResult).status,'ok');}finally{await host.dispose();}
    const script=await new ScriptRun(ctx.runtime,'s').execute(current=>current.call('write',{appId:'notes',connectionId:'n'},'notes.notes.create',{id:'script',title:'Script',content:'Fixture'},{idempotencyKey:'script'}));assert.equal(script.run.state,'succeeded');
    const componentWrite=await(await ctx.call('/v1/component-bridge',{...bridge,requestId:'component-write',method:'invokeCapability',params:{appId:'notes',connectionId:'n',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{id:'component',title:'Component',content:'Fixture'},idempotencyKey:'component',deadlineAt:new Date(Date.now()+10000).toISOString()}})).json();assert.equal(componentWrite.result.status,'ok');
    assert.equal(ctx.store.list('operations').length,4);assert.equal(ctx.store.list<{namespace:string}>('provider_records').filter(row=>row.namespace==='notes').length,4);
    for(const table of ['invocations','operations','operation_events','runs','run_steps','datasets','views','builds','provider_records'])assert.ok(writes.some(row=>row.collection===table),`${table} writes use this RuntimeStore`);
    const attempts=ctx.store.list<import('../../packages/app-runtime/src/store.ts').InvocationRecord>('invocations');for(const kind of ['agent','script','component'])assert.ok(attempts.some(row=>row.request.source.kind===kind));
  }finally{await ctx.cleanup();}
});
