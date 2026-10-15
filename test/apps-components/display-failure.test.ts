import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisplayErrorOutbox,describeFailure,displayErrorBody,isTransientFailure,permanentRejection,retryTransient} from '../../packages/plugin-apps/client/display-failure.ts';
import {createRuntimeDisplayRecovery,recoverableDisplayFailure,type RecoveryTarget} from '../../packages/plugin-apps/client/runtime-recovery.ts';

const apiError=(code:string,extra:Record<string,unknown>={})=>Object.assign(new Error(code+' message'),{code,...extra});
const params=(code='RUNTIME_STORE_BUSY',message='busy')=>({viewId:'V',publicationId:'P',buildId:'B',displayId:'D',displayGeneration:1,error:{phase:'data',code,message}});

test('describeFailure reads the Runtime evidence from API errors and bridge failures and clamps it to the report limits',()=>{
  const fromApi=describeFailure(apiError('RUNTIME_STORE_BUSY',{retryPolicy:'read_retry',httpStatus:503,details:{requestId:'bridge-1',runtimeRequestId:'srv-9',cause:'x'.repeat(900),attempts:2}}),'FALLBACK');
  assert.equal(fromApi.code,'RUNTIME_STORE_BUSY');assert.equal(fromApi.requestId,'srv-9','the Runtime request id wins over the bridge request id');assert.equal(fromApi.retryPolicy,'read_retry');assert.equal(fromApi.cause?.length,500);assert.equal(fromApi.attempts,2);
  const fromBridge=describeFailure(Object.assign(new Error('x'),{code:'BRIDGE_TIMEOUT',failure:{code:'BRIDGE_TIMEOUT',message:'x',retryPolicy:'read_retry',details:{requestId:'r'}}}),'FALLBACK');
  assert.deepEqual(fromBridge,{code:'BRIDGE_TIMEOUT',message:'x',requestId:'r',retryPolicy:'read_retry'});
  assert.equal(describeFailure('plain string',"FALLBACK").code,'FALLBACK');
  const body=displayErrorBody({phase:'p'.repeat(100),code:'c'.repeat(200),message:'m'.repeat(900),requestId:'r'.repeat(200),attempts:99,retryPolicy:'p'.repeat(60),cause:'c'.repeat(900)});
  assert.deepEqual([body.phase.length,body.code.length,body.message.length,body.requestId?.length,body.attempts,body.retryPolicy?.length,body.cause?.length],[64,128,512,128,10,32,500]);
  assert.equal(displayErrorBody({phase:'data',code:'C',message:'m',attempts:0}).attempts,1);
});

test('retryTransient retries only transient failures within three attempts and records attempts on the final error',async()=>{
  const sleeps:number[]=[],sleep=async(ms:number)=>{sleeps.push(ms);};
  let calls=0;assert.equal(await retryTransient(async()=>{if(++calls<3)throw apiError('RUNTIME_UNAVAILABLE');return 'ok';},{sleep}),'ok');assert.equal(calls,3);assert.deepEqual(sleeps,[500,1500]);
  calls=0;await assert.rejects(()=>retryTransient(async()=>{calls++;throw apiError('RUNTIME_CONNECTION_LOST');},{sleep}),(error:any)=>{assert.equal(error.attempts,3);return true;});assert.equal(calls,3);
  for(const failure of [apiError('BRIDGE_IDENTITY_STALE',{retryPolicy:'never'}),apiError('PERMISSION_DENIED',{httpStatus:403}),apiError('VIEW_NOT_OWNED')]){calls=0;await assert.rejects(()=>retryTransient(async()=>{calls++;throw failure;},{sleep}),(error:any)=>error.attempts===1);assert.equal(calls,1,String(failure.message));}
  assert.equal(isTransientFailure(apiError('UNLISTED',{retryPolicy:'read_retry'})),true);assert.equal(isTransientFailure(apiError('UNLISTED',{retryPolicy:'inspect_only'})),false);
  const controller=new AbortController();calls=0;await assert.rejects(()=>retryTransient(async()=>{calls++;controller.abort();throw apiError('RUNTIME_UNAVAILABLE');},{sleep,signal:controller.signal}));assert.equal(calls,1,'an aborted caller is not retried');
});

test('permanentRejection treats a definitive 4xx as final but timeouts, rate limits, 5xx and lost responses as retryable',()=>{
  for(const status of [400,401,403,404,409,422])assert.equal(permanentRejection(apiError('X',{httpStatus:status})),true,String(status));
  for(const status of [408,429,500,502,503,504])assert.equal(permanentRejection(apiError('X',{httpStatus:status})),false,String(status));
  assert.equal(permanentRejection(new TypeError('fetch failed')),false);
});

function harness(options:{failures?:number;status?:number;visible?:boolean}={}) {
  let clock=0,visible=options.visible??true,failures=options.failures??0;const sent:unknown[]=[],settled:string[]=[];
  const outbox=createDisplayErrorOutbox({now:()=>clock,visible:()=>visible,intervalMs:1_000_000,send:async(_sessionId,value)=>{sent.push(value);if(failures>0){failures--;throw options.status?apiError('REJECTED',{httpStatus:options.status}):new TypeError('fetch failed');}},onSettled:(entry,outcome)=>settled.push(outcome+':'+entry.displayId)});
  return {outbox,sent,settled,advance:(ms:number)=>{clock+=ms;},show:(value:boolean)=>{visible=value;}};
}

test('outbox keeps a missed report, resends it after backoff once visible, and drops it when delivered',async()=>{
  const h=harness({failures:1});try{
    h.outbox.enqueue('A','D',params());assert.equal(h.outbox.size('D'),1);
    await h.outbox.flush();assert.equal(h.sent.length,0,'not yet due: the first failed send already used attempt one');
    h.advance(2000);h.show(false);await h.outbox.flush();assert.equal(h.sent.length,0,'nothing is sent while the document is hidden');
    h.show(true);await h.outbox.flush();assert.equal(h.sent.length,1);assert.equal(h.outbox.size(),1,'a failed resend stays queued with a longer backoff');
    await h.outbox.flush();assert.equal(h.sent.length,1,'backoff applies to the next attempt');
    h.advance(5000);await h.outbox.flush();assert.equal(h.sent.length,2);assert.equal(h.outbox.size(),0);assert.deepEqual(h.settled,['delivered:D']);
  }finally{h.outbox.dispose();}
});

test('outbox gives up after six sends in total, and drops a definitive Runtime rejection immediately',async()=>{
  const h=harness({failures:100});try{
    h.outbox.enqueue('A','D',params());
    for(let n=0;n<10&&h.outbox.size();n++){h.advance(60_000);await h.outbox.flush();}
    assert.equal(h.sent.length,5,'the failed first send plus five resends is six tries');assert.equal(h.outbox.size(),0);assert.deepEqual(h.settled,['exhausted:D']);
  }finally{h.outbox.dispose();}
  const rejected=harness({failures:1,status:409});try{
    rejected.outbox.enqueue('A','D',params());rejected.advance(60_000);await rejected.outbox.flush();
    assert.equal(rejected.sent.length,1);assert.equal(rejected.outbox.size(),0);assert.deepEqual(rejected.settled,['rejected:D']);
  }finally{rejected.outbox.dispose();}
});

test('outbox bounds memory: five reports per display, twenty displays, duplicates collapsed, force ignores backoff',async()=>{
  const h=harness();try{
    for(let n=0;n<8;n++)h.outbox.enqueue('A','D',params('CODE_'+n,'message '+n));
    assert.equal(h.outbox.size('D'),5,'the oldest reports are dropped');
    h.outbox.enqueue('A','D',params('CODE_7','message 7'));assert.equal(h.outbox.size('D'),5,'the same failure is kept once');
    for(let n=0;n<30;n++)h.outbox.enqueue('A','display-'+n,params());
    assert.ok(h.outbox.size()<=20*5);assert.equal(h.outbox.size('D'),0,'the oldest display was evicted');assert.equal(h.outbox.size('display-29'),1);
    await h.outbox.flush();assert.equal(h.sent.length,0,'not due yet');await h.outbox.flush(true);assert.ok(h.sent.length>0,'a forced flush (document became visible) ignores backoff');
  }finally{h.outbox.dispose();}
});

const recoveryTarget:RecoveryTarget={sessionId:'A',viewId:'V',publicationId:'P',buildId:'B',displayId:'D'};
const transportFailure={phase:'context',code:'RUNTIME_CONNECTION_LOST',retryPolicy:'read_retry'};
const healthy={state:'healthy'} as const,down={state:'down',restart:{enabled:true,restarting:true}} as const;
test('default restart timing: first read exhausts at 2070ms, but healthy at 24.5s reopens the same publication once with no manual action',()=>{
  let now=0;const budgets=new Map(),recovery=createRuntimeDisplayRecovery({now:()=>now,budgets});
  assert.equal(recovery.observe(healthy,recoveryTarget,true),undefined);
  now=2070;assert.equal(recovery.failed(recoveryTarget,transportFailure),true);
  assert.equal(recovery.observe(healthy,recoveryTarget,true),undefined,'old healthy sample is not a recovery');
  now=14500;assert.equal(recovery.observe(down,recoveryTarget,true),undefined);
  now=19500;assert.equal(recovery.observe(down,recoveryTarget,true),undefined);
  now=24500;assert.deepEqual(recovery.observe(healthy,recoveryTarget,true),recoveryTarget);
  assert.equal(recovery.observe(healthy,recoveryTarget,true),undefined,'only one automatic open in this fault cycle');
  recovery.failed({...recoveryTarget,displayId:'D2'},transportFailure);
  assert.equal(recovery.observe(healthy,{...recoveryTarget,displayId:'D2'},true),undefined,'a failed automatic reopen does not recursively reopen');
});
test('automatic recovery refuses script/business/identity errors, hidden or changed owners and stale ready/display identities',()=>{
  for(const failure of [{phase:'script',code:'RUNTIME_CONNECTION_LOST'},{phase:'data',code:'BRIDGE_IDENTITY_STALE'},{phase:'data',code:'INVALID_INPUT'}, {...transportFailure,retryPolicy:'inspect_only'}])assert.equal(recoverableDisplayFailure(failure),false);
  for(const changed of [{...recoveryTarget,sessionId:'B'},{...recoveryTarget,publicationId:'P2'},{...recoveryTarget,buildId:'B2'},{...recoveryTarget,displayId:'D2'}]){
    const recovery=createRuntimeDisplayRecovery({budgets:new Map()});recovery.failed(recoveryTarget,transportFailure);recovery.observe(down,recoveryTarget,true);assert.equal(recovery.observe(healthy,changed,true),undefined);
  }
  const recovery=createRuntimeDisplayRecovery({budgets:new Map()});recovery.failed(recoveryTarget,transportFailure);recovery.observe(down,recoveryTarget,true);
  recovery.observe(down,recoveryTarget,false);assert.equal(recovery.pending(),false,'hidden/session change/explicit close cancels rather than deferring an automatic open');
  assert.equal(recovery.observe(healthy,recoveryTarget,true),undefined);
  recovery.failed(recoveryTarget,transportFailure);recovery.cancel();assert.equal(recovery.observe(down,recoveryTarget,true),undefined);assert.equal(recovery.observe(healthy,recoveryTarget,true),undefined);
});
test('automatic recovery has a 120s total window and three attempt cap surviving lifecycle remounts',()=>{
  let now=0;const budgets=new Map();let recovery=createRuntimeDisplayRecovery({now:()=>now,budgets});
  for(let i=0;i<3;i++){
    const target={...recoveryTarget,displayId:'D'+i};assert.equal(recovery.failed(target,transportFailure),true);recovery.observe(down,target,true);now+=25000;assert.deepEqual(recovery.observe(healthy,target,true),target);
    recovery=createRuntimeDisplayRecovery({now:()=>now,budgets});
  }
  assert.equal(recovery.failed(recoveryTarget,transportFailure),false,'unmount/remount does not reset the attempt cap');
  const expired=createRuntimeDisplayRecovery({now:()=>now,budgets:new Map()});assert.equal(expired.failed(recoveryTarget,transportFailure),true);expired.observe(down,recoveryTarget,true);now+=120001;
  assert.equal(expired.observe(healthy,recoveryTarget,true),undefined,'late healthy cannot restart an expired display');assert.equal(expired.failed(recoveryTarget,transportFailure),false);
});
