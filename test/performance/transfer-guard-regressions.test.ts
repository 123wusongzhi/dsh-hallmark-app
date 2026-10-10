import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {DataTransfers} from '../../packages/app-presentation/src/data-transfers.ts';
import {createDataTransferReader} from '../../packages/component-runtime/src/data-transfer-client.ts';
import type {CapabilityDescriptor,JsonValue} from '../../packages/app-contracts/src/index.ts';
import type {PresentationRuntime} from '../../packages/app-presentation/src/types.ts';

const object=(value:JsonValue)=>value as Record<string,JsonValue>;
const descriptor:CapabilityDescriptor={capabilityId:'fixture.list',version:'1.0.0',title:'Fixture',description:'Fixture',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',properties:{items:{type:'array'}},required:['items']},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
function snapshot(text='original'):JsonValue{return {viewId:'view',bindings:[{bindingId:'main',payload:{items:[{text}]},resources:[{label:'original'}]},{bindingId:'secondary',payload:{items:[]},resources:[]}]};}

test('inline transfers reject content changed under the original SHA-256 revision',async()=>{
  const transfers=new DataTransfers(),packet=object(transfers.prepare('owner',snapshot()));
  const body=object(packet.body),bindings=body.bindings as Record<string,JsonValue>[];
  (object(bindings[0].payload).items as Record<string,JsonValue>[])[0].text='tampered';
  const reader=createDataTransferReader(async()=>structuredClone(packet));
  await assert.rejects(reader({method:'getData'}),/INVALID_DATA_TRANSFER/);
});

test('metadata must contain every binding exactly once before applying a cached body',async()=>{
  const transfers=new DataTransfers(),data=snapshot();let duplicate=false;
  const reader=createDataTransferReader(async(_action,params)=>{
    const packet=object(structuredClone(transfers.prepare('owner',data,String(object(params).knownRevision??''))));
    if(duplicate){const bindings=object(packet.metadata).bindings as Record<string,JsonValue>[];bindings[1]=bindings[0];}
    return packet;
  });
  assert.deepEqual(await reader({method:'getData'}),data);duplicate=true;
  await assert.rejects(reader({method:'getData'}),/INVALID_DATA_TRANSFER/);
});

test('caller edits to inline and chunked results cannot change the private unchanged-revision cache',async()=>{
  for(const text of ['original','original'.repeat(40000)]){
    const transfers=new DataTransfers(),data=snapshot(text);let unchangedReads=0,chunkReads=0;
    const reader=createDataTransferReader(async(action,params)=>{
      const input=object(params);
      const packet=action==='read'?transfers.read('owner',String(input.id),Number(input.index)):transfers.prepare('owner',data,typeof input.knownRevision==='string'?input.knownRevision:undefined);
      if(action==='read')chunkReads++;else if(object(packet).unchanged)unchangedReads++;
      // The browser bridge serializes values; the host source is never shared with the caller.
      return structuredClone(packet);
    });
    const first=object(await reader({method:'getData'})),bindings=first.bindings as Record<string,JsonValue>[];
    (object(bindings[0].payload).items as Record<string,JsonValue>[])[0].text='caller-mutated';
    (bindings[0].resources as Record<string,JsonValue>[])[0].label='caller-mutated';
    const initialChunkReads=chunkReads;
    const second=await reader({method:'getData'});
    assert.deepEqual(second,data);assert.equal(unchangedReads,1);assert.equal(chunkReads,initialChunkReads);
    assert.equal((object((object(data).bindings as Record<string,JsonValue>[])[0].payload).items as Record<string,JsonValue>[])[0].text,text);
    if(text.length>220000)assert.ok(initialChunkReads>0);else assert.equal(initialChunkReads,0);
  }
});

for(const changed of ['session','config','descriptor'] as const){
  test(`refresh preparation returns no data after ${changed} changes while its provider read is pending`,async t=>{
    const store=new RuntimeStore(':memory:');t.after(()=>store.close());
    let enabled=true,configRevision=1,currentDescriptor=descriptor,release:()=>void=()=>{},started:()=>void=()=>{};
    const readStarted=new Promise<void>(resolve=>{started=resolve;}),readPending=new Promise<void>(resolve=>{release=resolve;});
    const runtime:PresentationRuntime={describe:()=>currentDescriptor,sessionBindings:()=>[{sessionId:'A',appId:'fixture',connectionId:'C',enabled,boundAt:'2026-10-09T00:00:00Z'}],getConnection:()=>({enabled:true,configRevision}),invoke:async request=>{started();await readPending;return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:[{private:'row'}]}};}};
    const presentation=new AppsPresentationService({store,runtime}),binding={bindingId:'main',appId:'fixture',connectionId:'C',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual' as const}},view=presentation.createView('A',{title:'Review',bindings:[binding]}),identity={protocolVersion:'2.0' as const,sessionId:'A',viewId:view.viewId,buildId:'static',frameInstanceId:'frame'},host=presentation.createHost(identity,{clientFeatures:['dataTransferV1']});
    t.after(()=>host.dispose());
    const pending=host.handle({channel:'dsh.apps.component.v2',...identity,requestId:'review',type:'extension',feature:'dataTransferV1',action:'prepare',params:{method:'refresh',documentNonce:'nonce'}});
    await readStarted;
    if(changed==='session')enabled=false;else if(changed==='config')configRevision++;else currentDescriptor={...descriptor,version:'1.1.0'};
    release();const response=await pending;
    assert.ok(response&&'error' in response);
    assert.equal(response.error?.code,changed==='session'?'CONNECTION_NOT_BOUND':'BRIDGE_IDENTITY_STALE');
    assert.equal(Object.hasOwn(response,'result'),false);
  });
}

test('a later refresh preserves an earlier frozen transfer until completion or ordinary expiry',async t=>{
  const store=new RuntimeStore(':memory:');t.after(()=>store.close());let reads=0;
  const runtime:PresentationRuntime={describe:()=>descriptor,sessionBindings:()=>[{sessionId:'A',appId:'fixture',connectionId:'C',enabled:true,boundAt:'2026-10-09T00:00:00Z'}],getConnection:()=>({enabled:true,configRevision:1}),invoke:async request=>({status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items:[{text:String(++reads)+'x'.repeat(333000)}]}})};
  const presentation=new AppsPresentationService({store,runtime}),binding={bindingId:'main',appId:'fixture',connectionId:'C',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual' as const}},view=presentation.createView('A',{title:'Review',bindings:[binding]}),identity={protocolVersion:'2.0' as const,sessionId:'A',viewId:view.viewId,buildId:'static',frameInstanceId:'frame'},host=presentation.createHost(identity,{clientFeatures:['dataTransferV1']});t.after(()=>host.dispose());
  const extension=(requestId:string,action:string,params:JsonValue)=>host.handle({channel:'dsh.apps.component.v2',...identity,requestId,type:'extension',feature:'dataTransferV1',action,params});
  const first=await extension('first','prepare',{method:'refresh',documentNonce:'nonce'});assert.ok(first&&'result' in first&&first.result);
  const firstPacket=object(first.result),transfer=object(firstPacket.transfer);assert.equal(typeof transfer.id,'string');
  const second=await extension('second','prepare',{method:'refresh',documentNonce:'nonce'});assert.ok(second&&'result' in second&&second.result);assert.notEqual(object(second.result).revision,firstPacket.revision);
  const chunk=await extension('read','read',{id:transfer.id,index:0,documentNonce:'nonce'});
  assert.ok(chunk&&'result' in chunk&&chunk.result);assert.equal(object(chunk.result).revision,firstPacket.revision);
});
