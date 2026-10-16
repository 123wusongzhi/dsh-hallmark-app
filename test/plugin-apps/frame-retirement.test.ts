import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAppsPresentationHandlers} from '../../packages/plugin-apps/client/component-handlers.ts';
import type {PublicationFrame} from '../../packages/plugin-apps/client/component-handlers.ts';
import type {BridgeIdentity} from '../../packages/app-contracts/src/index.ts';

function fixture(t:{after:(fn:()=>void)=>void}) {
  const original=globalThis.fetch,requests:{operation:string;params:Record<string,unknown>}[]=[],grants=new Map<string,{frameInstanceId:string;documentNonce:string}>();
  const identity={sessionId:'A',viewId:randomUUID(),buildId:'build'},publication:PublicationFrame={publicationId:randomUUID(),attemptId:'attempt',attemptEpoch:1,displayId:randomUUID(),displayGeneration:1};
  let retirement:'hold'|'fail'|'invalid'|'success'='hold',finish:(()=>void)|undefined;
  globalThis.fetch=(async(input:unknown,init?:RequestInit)=>{
    if(!init?.body)return Response.json(String(input).includes('componentFeatures')?{features:['renderReadyV1','uiStateV1']}:{adapterReady:false});
    const body=JSON.parse(String(init.body));requests.push(body);
    if(body.operation==='authorizeDisplayFrame'){
      const params=body.params,key=String(params.displayId),old=grants.get(key);
      if(old&&(old.frameInstanceId!==params.frameInstanceId||old.documentNonce!==params.documentNonce))return Response.json({error:{code:'BRIDGE_IDENTITY_STALE',message:'The old document still owns this display.'}},{status:400});
      grants.set(key,{frameInstanceId:params.frameInstanceId,documentNonce:params.documentNonce});
      return Response.json({features:params.clientFeatures,display:{...params,generation:params.displayGeneration,ownerSessionId:body.sessionId}});
    }
    assert.equal(body.operation,'retireFrame');assert.equal(init.keepalive,true);assert.equal(init.signal?.aborted,false,'Closing-owner abort must not cancel retirement');
    if(retirement==='fail')return Response.json({error:{code:'UNAVAILABLE'}},{status:503});
    if(retirement==='invalid')return Response.json({retired:false});
    const retire=()=>{for(const [key,grant]of grants)if(grant.frameInstanceId===body.params.frameInstanceId&&grant.documentNonce===body.params.documentNonce)grants.delete(key);return Response.json({retired:true});};
    if(retirement==='success')return retire();
    return new Promise<Response>(resolve=>{finish=()=>resolve(retire());});
  }) as typeof fetch;
  t.after(()=>{globalThis.fetch=original;});
  const frame=(suffix:string):BridgeIdentity=>({...identity,protocolVersion:'2.0',frameInstanceId:suffix});
  return {identity,publication,requests,grants,frame,setRetirement:(mode:typeof retirement)=>{retirement=mode;},finish:()=>{assert.ok(finish);finish();},handlers:(signal:AbortSignal,target=publication,current?:()=>boolean)=>createAppsPresentationHandlers(identity,signal,target,true,undefined,current)};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};

test('replacement display authorization waits for the exact old retirement while independent displays proceed',async t=>{
  const f=fixture(t),oldOwner=new AbortController(),newOwner=new AbortController(),old=await f.handlers(oldOwner.signal),next=await f.handlers(newOwner.signal);
  await old.authorizeFrame!(f.frame('old'),'old-document',['renderReadyV1']);
  const retiring=old.retireFrame!(f.frame('old'),'old-document');oldOwner.abort();
  let authorized=false;const opening=next.authorizeFrame!(f.frame('new'),'new-document',['renderReadyV1']).then(value=>{authorized=true;return value;});
  await flush();assert.equal(authorized,false);assert.equal(f.requests.filter(row=>row.operation==='authorizeDisplayFrame').length,1);
  const independent=await f.handlers(new AbortController().signal,{...f.publication,displayId:randomUUID(),displayGeneration:2});
  await independent.authorizeFrame!(f.frame('independent'),'independent-document',['renderReadyV1']);
  assert.equal(f.requests.filter(row=>row.operation==='authorizeDisplayFrame').length,2);
  f.finish();await retiring;assert.deepEqual(await opening,['renderReadyV1']);
  assert.deepEqual(f.grants.get(f.publication.displayId!),{frameInstanceId:'new',documentNonce:'new-document'});
});

for(const mode of ['fail','invalid'] as const)test(`unconfirmed retirement (${mode}) blocks grants until that exact retirement is explicitly retried`,async t=>{
  const f=fixture(t),old=await f.handlers(new AbortController().signal),next=await f.handlers(new AbortController().signal);
  await old.authorizeFrame!(f.frame('old'),'old-document',['renderReadyV1']);f.setRetirement(mode);
  await assert.rejects(Promise.resolve(old.retireFrame!(f.frame('old'),'old-document')),{code:'DISPLAY_RETIREMENT_UNCONFIRMED'});
  await assert.rejects(next.authorizeFrame!(f.frame('new'),'new-document',['renderReadyV1']),{code:'DISPLAY_RETIREMENT_UNCONFIRMED'});
  assert.equal(f.requests.filter(row=>row.operation==='authorizeDisplayFrame').length,1);
  assert.equal(f.grants.get(f.publication.displayId!)?.frameInstanceId,'old');
  f.setRetirement('success');await old.retireFrame!(f.frame('old'),'old-document');
  await next.authorizeFrame!(f.frame('new'),'new-document',['renderReadyV1']);
  assert.equal(f.grants.get(f.publication.displayId!)?.frameInstanceId,'new');
});

test('an aborted replacement owner stops waiting and cannot receive a late grant',async t=>{
  const f=fixture(t),old=await f.handlers(new AbortController().signal),owner=new AbortController(),next=await f.handlers(owner.signal);
  await old.authorizeFrame!(f.frame('old'),'old-document',['renderReadyV1']);const retiring=old.retireFrame!(f.frame('old'),'old-document');
  const opening=next.authorizeFrame!(f.frame('new'),'new-document',['renderReadyV1']),rejected=assert.rejects(opening,{name:'AbortError'});owner.abort();await rejected;
  f.finish();await retiring;await flush();assert.equal(f.requests.filter(row=>row.operation==='authorizeDisplayFrame').length,1);assert.equal(f.grants.has(f.publication.displayId!),false);
});

test('owner changes while waiting block authorization even without an abort signal',async t=>{
  const f=fixture(t),old=await f.handlers(new AbortController().signal);let current=true;
  const next=await f.handlers(new AbortController().signal,f.publication,()=>current);
  await old.authorizeFrame!(f.frame('old'),'old-document',['renderReadyV1']);const retiring=old.retireFrame!(f.frame('old'),'old-document');
  const opening=next.authorizeFrame!(f.frame('new'),'new-document',['renderReadyV1']),rejected=assert.rejects(opening,{code:'BRIDGE_CLOSED'});current=false;f.finish();await retiring;await rejected;
  assert.equal(f.requests.filter(row=>row.operation==='authorizeDisplayFrame').length,1);
});
