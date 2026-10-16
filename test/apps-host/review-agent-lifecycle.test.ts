import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {runIndependentReview,withIndependentReviewPump,type ReviewAgentServices} from '../../packages/plugin-apps/src/review-agent.ts';
import type {IndependentReviewRequest} from '../../packages/app-contracts/src/business-review.ts';

// Lifecycle controls only: no product facts, model calls, provider calls, or network.
const input:IndependentReviewRequest={source:{},draft:{},versions:{source:'v1',draft:'v1'},questions:[],context:{mode:'independent-review',toolPolicy:'read-only',writeTools:[],reasons:[]}};
const parent={id:'parent',options:{model:'fixture'}},owner={invocationId:'invocation',sessionId:'parent'};
const completed={stopReason:'completed',structured:{questions:[]}};
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(){
 const result=deferred<typeof completed>(),started=deferred<void>();let starts=0,disposals=0,releases=0,completions=0;
 const services:ReviewAgentServices={subagents:{async start(){starts++;return {id:'child',localAgent:{id:'child',ctx:{tools:{guard(){started.resolve();return()=>{releases++;};}}}},result:result.promise,async dispose(){assert.equal(releases,0,'guard must remain active during disposal');disposals++;}};}}};
 let offered=false;
 const transport={async reviewNext(_owner:typeof owner,signal?:AbortSignal){if(!offered){offered=true;return {requestId:'review',claimToken:'claim',owner,input};}return new Promise<null>((_resolve,reject)=>{if(signal?.aborted)reject(signal.reason);else signal?.addEventListener('abort',()=>reject(signal.reason),{once:true});});},async reviewComplete(){completions++;}};
 return {result,started,services,transport,counts:()=>({starts,disposals,releases,completions})};
}
async function outcome<T>(promise:Promise<T>){return Promise.race([promise.then(value=>({kind:'value',value}),error=>({kind:'error',error})),delay(150).then(()=>({kind:'stalled'}))]);}
for(const mode of ['success','failure','cancel'] as const)for(const late of ['success','failure'] as const)test(`reviewer never returns: ${mode} invocation finalizes before late ${late}`,async()=>{
 const f=fixture(),action=deferred<string>(),outer=new AbortController(),failure=new Error('invocation failed'),cancel=new Error('invocation cancelled');
 const task=withIndependentReviewPump(f.transport,owner,parent,f.services,signal=>{signal.addEventListener('abort',()=>action.reject(signal.reason),{once:true});return action.promise;},outer.signal);
 const settled=task.then(value=>({kind:'value',value}),error=>({kind:'error',error}));
 try{
  await f.started.promise;
  if(mode==='success')action.resolve('original outcome');else if(mode==='failure')action.reject(failure);else outer.abort(cancel);
  const observed=await outcome(task);assert.notEqual(observed.kind,'stalled','stalled reviewer must not trap completed invocation in finalization');
  assert.deepEqual(await settled,mode==='success'?{kind:'value',value:'original outcome'}:{kind:'error',error:mode==='failure'?failure:cancel});
  assert.deepEqual(f.counts(),{starts:1,disposals:1,releases:1,completions:0});
  if(late==='success')f.result.resolve(completed);else f.result.reject(new Error('late reviewer failure'));
  await delay(0);assert.equal(f.counts().completions,0,'late reviewer must not report to the finished invocation');
  const next=fixture();next.result.resolve(completed);const reviewed=await runIndependentReview(input,parent,next.services,new AbortController().signal);
  assert.equal(reviewed.reviewerId,'child');assert.deepEqual(next.counts(),{starts:1,disposals:1,releases:1,completions:0});
 }finally{f.result.resolve(completed);await settled;}
});

test('active review still waits for valid findings and never treats cancellation as approval',async()=>{
 const f=fixture(),controller=new AbortController();const review=runIndependentReview(input,parent,f.services,controller.signal),settled=review.then(()=>true,()=>false);
 try{await f.started.promise;assert.equal((await outcome(review)).kind,'stalled');assert.deepEqual(f.counts(),{starts:1,disposals:0,releases:0,completions:0});controller.abort(new Error('cancel review'));assert.equal((await outcome(review)).kind,'error');assert.equal(await settled,false);assert.deepEqual(f.counts(),{starts:1,disposals:1,releases:1,completions:0});}finally{f.result.resolve(completed);await settled;}
});

test('cancellation retains the tool guard until asynchronous child disposal finishes',async()=>{
 const result=deferred<typeof completed>(),started=deferred<void>(),disposing=deferred<void>(),disposed=deferred<void>(),controller=new AbortController();let guardReleased=false,disposals=0;
 const services:ReviewAgentServices={subagents:{async start(){return {id:'child',localAgent:{id:'child',ctx:{tools:{guard(){started.resolve();return()=>{guardReleased=true;};}}}},result:result.promise,async dispose(){disposals++;disposing.resolve();await disposed.promise;assert.equal(guardReleased,false);}};}}};
 const review=runIndependentReview(input,parent,services,controller.signal),observed=review.then(()=> 'approved',()=> 'cancelled');
 try{await started.promise;controller.abort(new Error('cancel during review'));assert.notEqual((await outcome(disposing.promise)).kind,'stalled','abort must start disposal without waiting for reviewer findings');assert.equal((await outcome(observed)).kind,'stalled','cleanup is awaited rather than detached');assert.equal(guardReleased,false);disposed.resolve();assert.equal(await observed,'cancelled');assert.equal(guardReleased,true);assert.equal(disposals,1);result.reject(new Error('late rejection after cleanup'));await delay(0);}finally{disposed.resolve();result.resolve(completed);await observed;}
});

test('cancellation during successful-review disposal suppresses completion transport',async()=>{
 const disposing=deferred<void>(),disposed=deferred<void>(),action=deferred<string>();let released=false,completions=0,reviewSignal:AbortSignal|undefined;
 const f=fixture();
 const services:ReviewAgentServices={subagents:{async start(_provider,request){reviewSignal=request.signal;return {id:'child',localAgent:{id:'child',ctx:{tools:{guard(){return()=>{released=true;};}}}},result:Promise.resolve(completed),async dispose(){disposing.resolve();await disposed.promise;assert.equal(released,false);}};}}};
 const transport={...f.transport,async reviewComplete(){completions++;}};
 const task=withIndependentReviewPump(transport,owner,parent,services,()=>action.promise);
 try{await disposing.promise;action.resolve('original outcome');await delay(0);assert.equal(reviewSignal?.aborted,true);assert.equal((await outcome(task)).kind,'stalled','finalization must still await disposal');assert.equal(released,false);disposed.resolve();assert.equal(await task,'original outcome');assert.equal(released,true);assert.equal(completions,0,'cancelled review must not call transport even if findings arrived before disposal');}finally{disposed.resolve();action.resolve('original outcome');await task;}
});
