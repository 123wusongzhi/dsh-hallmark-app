import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsHost} from '../../packages/plugin-apps/src/index.ts';
import type {AppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import type {AppProvider,CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';

const capability:CapabilityDescriptor={capabilityId:'versionfixture.rows.query',version:'1.0.0',title:'Rows',description:'Version diagnostic fixture',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};

function fixture(){
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);let calls=0;
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'versionfixture',displayName:'Version fixture',providerPackage:'version-fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[capability],async execute(context){calls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:'registered version'}};},async dispose(){}};
  runtime.register(provider);runtime.addConnection({appId:'versionfixture',connectionId:'C1',displayName:'C1',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:'A',appId:'versionfixture',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const transport:AppsHostTransport={async identity(){return runtime.identity();},async listApps(){return runtime.listApps();},async describe(id,version){return runtime.describe(id,version);},async discover(options){return runtime.discover(options);},async listConnections(appId){return runtime.listConnections(appId);},async sessionBindings(sessionId){return runtime.sessionBindings(sessionId);},async bind(binding){return runtime.bind(binding);},async invoke(request,signal){return runtime.invoke(request,signal);},async inspect(id,signal){return runtime.inspect(id,signal);},async legacyInvoke(){throw new Error('Not used');}};
  const agent={id:'A'},host=new AppsHost({agents:{get:id=>id==='A'?agent:undefined},tools:{register:()=>()=>{}}},transport);
  return {runtime,store,host,calls:()=>calls,async close(){await host.dispose();await runtime.dispose();store.close();}};
}

function request(capabilityId=capability.capabilityId):InvocationRequest{return {protocolVersion:'1.0',appId:'versionfixture',connectionId:'C1',capabilityId,capabilityVersion:'9.0.0',input:{},invocationId:randomUUID(),traceId:randomUUID(),source:{kind:'agent',sessionId:'A',nativeCallId:'fixture'},deadlineAt:new Date(Date.now()+5000).toISOString()};}

for(const entry of ['runtime','host'] as const){
  test(`${entry} missing exact version reports requested and registered versions without dispatch`,async()=>{
    const f=fixture();try{
      await f.host.start();f.host.attachApp('versionfixture');const input=request();
      const result=(entry==='runtime'?await f.runtime.invoke(input):await f.host.call('apps_invoke',{appId:input.appId,connectionId:input.connectionId,capabilityId:input.capabilityId,capabilityVersion:input.capabilityVersion,input:input.input},'A')) as any;
      assert.equal(result.status,'failed');assert.equal(result.error.code,'CAPABILITY_NOT_FOUND');assert.equal(result.error.retryPolicy,'never');
      assert.deepEqual(result.error.details,{expected:{appId:'versionfixture',capabilityId:capability.capabilityId,capabilityVersion:'9.0.0'},actual:{capabilityVersion:'1.0.0'}});
      assert.match(result.error.message,/9\.0\.0/);assert.match(result.error.message,/1\.0\.0/);assert.equal(f.calls(),0);assert.equal(f.store.list('operations').length,0);
      const valid=await f.runtime.invoke({...request(),capabilityVersion:'1.0.0'});assert.equal(valid.status,'ok');assert.equal(f.calls(),1);
    }finally{await f.close();}
  });
  test(`${entry} unregistered capability reports an absent registered version without dispatch`,async()=>{
    const f=fixture();try{
      await f.host.start();f.host.attachApp('versionfixture');const input=request('versionfixture.rows.missing');
      const result=(entry==='runtime'?await f.runtime.invoke(input):await f.host.call('apps_invoke',{appId:input.appId,connectionId:input.connectionId,capabilityId:input.capabilityId,capabilityVersion:input.capabilityVersion,input:input.input},'A')) as any;
      assert.equal(result.status,'failed');assert.equal(result.error.code,'CAPABILITY_NOT_FOUND');
      assert.deepEqual(result.error.details,{expected:{appId:'versionfixture',capabilityId:'versionfixture.rows.missing',capabilityVersion:'9.0.0'},actual:{capabilityVersion:null}});assert.equal(f.calls(),0);assert.equal(f.store.list('operations').length,0);
    }finally{await f.close();}
  });
}
