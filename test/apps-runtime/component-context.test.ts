import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {COMPONENT_CHANNEL} from '../../packages/component-runtime/src/apps-client.ts';
import type {BridgeIdentity,ComponentAgentIntent,ComponentContextReceipt,DatasetBinding,SelectionEnvelope} from '../../packages/app-contracts/src/index.ts';

async function setup(t:{after(action:()=>Promise<void>):void}) {
  const directory=mkdtempSync(join(tmpdir(),'apps-context-http-')),project=join(directory,'project');
  mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist/index.html'),'<button>Explicit component action</button>');
  const instance=composeAppsRuntime(join(directory,'data'),{connections:[{appId:'notes',connectionId:'n',displayName:'Context test Notes',config:{backend:'runtime'},configRevision:1,enabled:true}]}),sessionId='context-session';
  instance.runtime.bind({sessionId,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
  await instance.runtime.invoke({protocolVersion:'1.0',invocationId:randomUUID(),traceId:randomUUID(),appId:'notes',connectionId:'n',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{title:'Original note',content:'Immutable evidence'},idempotencyKey:'seed-note',deadlineAt:new Date(Date.now()+5000).toISOString(),source:{kind:'agent',sessionId,nativeCallId:'seed'}});
  const binding:DatasetBinding={bindingId:'notes',appId:'notes',connectionId:'n',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
  const view=instance.presentation.openSource(sessionId,project,{title:'Context source',bindings:[binding]});
  const data=await instance.presentation.refreshView(sessionId,view.viewId,{kind:'agent',sessionId,nativeCallId:'refresh'}),selected=data.bindings[0];
  const selection:SelectionEnvelope={bindingId:selected.bindingId,datasetRevision:selected.revision!,resources:selected.resources};
  const identity:BridgeIdentity={protocolVersion:'2.0',sessionId,viewId:view.viewId,buildId:view.source!.buildId,frameInstanceId:'context-frame'};
  const token='c'.repeat(64),server=createAppsServer({...instance,token});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await instance.close();rmSync(directory,{recursive:true,force:true});});
  const call=async(path:string,input?:unknown)=>{const response=await fetch(`${base}${path}`,{method:input===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,value:await response.json()};};
  const bridge=(method:string,params:unknown,requestId:string=randomUUID())=>call('/v1/component-bridge',{...identity,channel:COMPONENT_CHANNEL,method,params,requestId});
  return {...instance,call,bridge,identity,selection};
}

test('component context HTTP publishes immutable evidence without invoking a capability or waking a model',async t=>{
  const f=await setup(t),before=f.store.list('invocations').length;
  const updated=await f.bridge('updateContext',{expectedContextRevision:0,selections:[f.selection],summary:'Use the selected note'},'context-update-1');assert.equal(updated.status,200);
  const receipt=updated.value.result as ComponentContextReceipt;assert.equal(receipt.status,'updated');assert.equal(receipt.contextRevision,1);assert.equal(f.store.list('invocations').length,before);
  const repeated=await f.bridge('updateContext',{expectedContextRevision:0,selections:[f.selection],summary:'Use the selected note'},'context-update-1');assert.deepEqual(repeated.value.result,receipt);
  const conflict=await f.bridge('updateContext',{expectedContextRevision:0,selections:[],summary:'Different meaning'},'context-update-1');assert.equal(conflict.value.error.code,'IDEMPOTENCY_CONFLICT');
  const active=await f.call(`/v1/component-contexts?sessionId=${f.identity.sessionId}`);assert.equal(active.value.snapshot.snapshotId,receipt.snapshotId);
  const history=await f.call(`/v1/component-contexts/${receipt.snapshotId}?sessionId=${f.identity.sessionId}`);assert.equal(history.value.evidence[0].revision,f.selection.datasetRevision);assert.match(JSON.stringify(history.value.evidence),/Immutable evidence/);
  assert.equal((await f.call(`/v1/component-contexts/${receipt.snapshotId}?sessionId=other-session`)).status,400);
  await f.presentation.refreshView(f.identity.sessionId,f.identity.viewId,{kind:'agent',sessionId:f.identity.sessionId,nativeCallId:'later-refresh'});
  const later=await f.bridge('updateContext',{expectedContextRevision:1,selections:[],summary:'New UI state'},'context-update-2');assert.equal(later.value.result.contextRevision,2);
  assert.deepEqual((await f.call(`/v1/component-contexts/${receipt.snapshotId}?sessionId=${f.identity.sessionId}`)).value,history.value);
  assert.throws(()=>f.store.put('component_contexts',`snapshot:${receipt.snapshotId}`,{changed:true}),/IMMUTABLE_EVIDENCE/);
  assert.throws(()=>f.store.delete('component_contexts',`snapshot:${receipt.snapshotId}`),/EVIDENCE_DELETE_FORBIDDEN/);
  const stale=await f.bridge('updateContext',{expectedContextRevision:1,selections:[]},'stale-update');assert.equal(stale.value.error.code,'CONTEXT_REVISION_CONFLICT');
  const invalid=await f.bridge('updateContext',{expectedContextRevision:2,selections:[],summary:'x'.repeat(2049)},'large-update');assert.equal(invalid.value.error.code,'INVALID_INPUT');
});

test('native input intent pins its snapshot and only one dispatch survives uncertainty and repeated bridge requests',async t=>{
  const f=await setup(t),context=await f.bridge('updateContext',{expectedContextRevision:0,selections:[f.selection]},'context-update');
  const params={text:'Inspect this exact selected note',expectedContextRevision:1},prepared=await f.bridge('requestAgent',params,'agent-input-1'),intent=prepared.value.result as ComponentAgentIntent;
  assert.equal(intent.status,'prepared');assert.equal(intent.contextSnapshotId,context.value.result.snapshotId);assert.equal(intent.content[0].text,params.text);
  const pinned=JSON.parse(intent.content[1].text);assert.equal(pinned.snapshot.contextRevision,1);assert.deepEqual(pinned.snapshot.selections,[f.selection]);
  const dispatchPath='/v1/agent-requests/agent-input-1/dispatch',body={sessionId:f.identity.sessionId,requestHash:intent.requestHash};
  const claimed=await f.call(dispatchPath,body);assert.equal(claimed.value.dispatchGranted,true);
  assert.equal((await f.call(dispatchPath,body)).value.dispatchGranted,false);
  await f.bridge('updateContext',{expectedContextRevision:1,selections:[],summary:'Later selection'},'context-update-later');
  assert.deepEqual((await f.bridge('requestAgent',params,'agent-input-1')).value.result.content,intent.content);
  assert.equal((await f.bridge('requestAgent',{...params,text:'Changed task'},'agent-input-1')).value.error.code,'IDEMPOTENCY_CONFLICT');
  const receiptPath='/v1/agent-requests/agent-input-1/receipt';
  assert.equal((await f.call(receiptPath,{...body,state:'accepted',receipt:{accepted:true}})).status,400);
  const unknown=await f.call(receiptPath,{...body,state:'unknown',error:{code:'NATIVE_RESPONSE_LOST'}});assert.equal(unknown.value.status,'unknown');
  assert.equal((await f.call(dispatchPath,body)).value.dispatchGranted,false);
  const receipt={accepted:true,durable:true,requestId:intent.requestId,sessionId:intent.sessionId,eventType:'agent/inbox/spliced',eventSeq:42,contentHash:intent.contentHash};
  const recovered=await f.call(receiptPath,{...body,state:'accepted',receipt});assert.equal(recovered.value.status,'accepted');
  assert.equal((await f.call(receiptPath,{...body,state:'unknown'})).status,400);
  assert.equal((await f.call('/v1/agent-requests/agent-input-1?sessionId=other-session')).status,404);
  const blocked=await f.bridge('requestAgent',{text:'Use stale context',expectedContextRevision:1},'agent-input-2');assert.equal(blocked.value.error.code,'CONTEXT_REVISION_CONFLICT');
});
