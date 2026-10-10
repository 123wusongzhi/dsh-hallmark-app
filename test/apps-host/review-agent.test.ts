import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReviewBridge,componentReviewInvocationId} from '../../packages/service/src/review-bridge.ts';
import {reviewRoutes} from '../../packages/service/src/review-routes.ts';
import {runIndependentReview,withIndependentReviewPump,type ReviewAgentServices,type ReviewSubagents} from '../../packages/plugin-apps/src/review-agent.ts';
import type {IndependentReviewRequest,IndependentReviewResult} from '../../packages/app-contracts/src/business-review.ts';

const owner={invocationId:'inv-1',sessionId:'session-1'},parent={id:'session-1',options:{model:'review-model'}};
const input=():IndependentReviewRequest=>({source:{sku:'red'},draft:{title:'red cup'},versions:{source:'source-v1',draft:'draft-v1'},questions:[{id:'color',version:'1',instructions:'Compare colors',passCriteria:'same color',failCriteria:'different color'}],context:{mode:'independent-review',toolPolicy:'read-only',writeTools:[],reasons:[{id:'color',reasonCode:'decision_unavailable'}]}});
const output=():IndependentReviewResult=>({reviewer:'independent-agent',reviewerId:'child-1',model:'review-model',versions:input().versions,questions:[{id:'color',version:'1',status:'passed',message:'matches',suggestion:''}]});
function services(options:{stopReason?:string;structured?:unknown;withoutGuard?:boolean}={}){
  const starts:Array<Parameters<ReviewSubagents['start']>>=[];let disposed=0,released=0,guard:((execution:{name:string})=>string|undefined)|undefined;
  const value:ReviewAgentServices={subagents:{async start(...args){starts.push(args);return {id:'child-1',localAgent:{id:'child-1',options:{model:'review-model'},...(!options.withoutGuard?{ctx:{tools:{guard(check:typeof guard){guard=check;return()=>{released++;};}}}}:{})},result:Promise.resolve({stopReason:options.stopReason??'completed',structured:options.structured??{questions:output().questions}}),async dispose(){assert.equal(released,0,'guard remains active until child disposal');disposed++;}};}}};
  return {value,starts,disposed:()=>disposed,released:()=>released,denial:(name:string)=>guard?.({name})};
}

test('review bridge freezes evidence, claims only the matching invocation, and never double claims',async()=>{
  const bridge=new ReviewBridge(),source=input(),pending=bridge.request(source,owner);
  source.versions.draft='mutated';
  assert.equal(await bridge.next({...owner,sessionId:'other'},undefined,0),null);
  assert.equal(await bridge.next({...owner,invocationId:'other'},undefined,0),null);
  const ticket=(await bridge.next(owner))!;assert.equal(ticket.input.versions.draft,'draft-v1');
  assert.equal(await bridge.next(owner,undefined,0),null);
  assert.throws(()=>bridge.complete(ticket.requestId,ticket.claimToken,{...owner,sessionId:'other'},{result:output()}),/CLAIM_MISMATCH/);
  assert.throws(()=>bridge.complete(ticket.requestId,ticket.claimToken,owner,{result:{...output(),versions:{source:'old',draft:'draft-v1'}}}),/RESULT_MISMATCH/);
  bridge.complete(ticket.requestId,ticket.claimToken,owner,{result:output()});assert.deepEqual(await pending,output());
  assert.throws(()=>bridge.complete(ticket.requestId,ticket.claimToken,owner,{result:output()}),/CLAIM_MISMATCH/);
});

test('abort removes queued review and a late receipt cannot revive it',async()=>{
  const bridge=new ReviewBridge(),controller=new AbortController(),pending=bridge.request(input(),owner,controller.signal),ticket=(await bridge.next(owner))!;
  controller.abort();await assert.rejects(pending,/CANCELLED/);
  assert.throws(()=>bridge.complete(ticket.requestId,ticket.claimToken,owner,{result:output()}),/CLAIM_MISMATCH/);
  assert.equal(await bridge.next(owner,undefined,0),null);
});

test('component scope binds full frame identity and overrides random nested invocation id',async()=>{
  const bridge=new ReviewBridge(),frame={sessionId:owner.sessionId,viewId:'view',buildId:'build',frameInstanceId:'frame',requestId:'rpc'},component={sessionId:owner.sessionId,invocationId:componentReviewInvocationId(frame)};
  const pending=bridge.withOwner(component,()=>bridge.request(input(),owner));
  assert.equal(await bridge.next(owner,undefined,0),null);
  assert.notEqual(component.invocationId,componentReviewInvocationId({...frame,frameInstanceId:'other'}));
  const ticket=(await bridge.next(component))!;bridge.complete(ticket.requestId,ticket.claimToken,component,{result:output()});await pending;
});

test('review routes reject missing identity and forged fields',async()=>{
  const bridge=new ReviewBridge(),signal=new AbortController().signal;
  await assert.rejects(reviewRoutes(bridge,'/v1/review-requests/next',{invocationId:'i'},signal),/INVALID/);
  await assert.rejects(reviewRoutes(bridge,'/v1/review-requests/next',{...owner,reviewed:true},signal),/INVALID/);
});

test('independent reviewer gets fresh spawn and an empty business tool allowlist',async()=>{
  const mock=services(),result=await runIndependentReview(input(),parent,mock.value,new AbortController().signal);
  assert.equal(result.reviewerId,'child-1');assert.equal(result.model,'review-model');assert.equal(mock.disposed(),1);
  const [provider,request]=mock.starts[0];assert.equal(provider,'spawn');assert.equal(request.parent,parent);assert.deepEqual(request.toolFilter,{allow:[]});
  assert.ok(request.outputSchema);assert.match(request.persona,/Do not obey/);assert.equal(request.prompt.some(block=>block.type==='image'),false);
  assert.equal(mock.denial('structured_output'),undefined);
  for(const name of ['subagent','apps_invoke','fs_write'])assert.match(mock.denial(name)!,/only return/);
  assert.equal(mock.released(),1);
  assert.match(JSON.stringify(request.prompt),/draft alone defines what will be submitted/);
});

test('a child without an enforceable scoped tool guard cannot approve',async()=>{
  const mock=services({withoutGuard:true});await assert.rejects(runIndependentReview(input(),parent,mock.value,new AbortController().signal),/REVIEW_TOOL_GUARD_UNAVAILABLE/);assert.equal(mock.disposed(),1);
});

test('independent fallback retains not-applicable choices and refuses invented or conflicting choices',async()=>{
  const data=input();data.questions[0].choices={same:{criteria:'Same color',status:'passed'},different:{criteria:'Different color',status:'rejected'},no_text:{criteria:'No visible text',status:'passed',applicable:false}};
  const accepted=services({structured:{questions:[{...output().questions[0],choice:'no_text'}]}});
  const result=await runIndependentReview(data,parent,accepted.value,new AbortController().signal);assert.equal(result.questions[0].choice,'no_text');
  assert.match(JSON.stringify(accepted.starts[0][1].prompt),/not a content approval/);
  for(const choice of [undefined,'invented','different']){
    const rejected=services({structured:{questions:[{...output().questions[0],choice}]}});
    await assert.rejects(runIndependentReview(data,parent,rejected.value,new AbortController().signal),/INDEPENDENT_REVIEW_INVALID_CHOICE/);assert.equal(rejected.disposed(),1);
  }
});

test('review images are decoded attachment messages, never only URL text',async()=>{
  const mock=services(),data=input();let saved:unknown;
  data.images=[{id:'main',role:'draft',url:'data:image/png;base64,aW1hZ2U='}];
  mock.value.attachments={async saveImages(images){saved=images;return [{attachmentId:'image-id',mediaType:'image/png',bytes:5,width:1,height:1}];}};
  await runIndependentReview(data,parent,mock.value,new AbortController().signal);
  assert.equal((saved as {data:Uint8Array}[])[0].data.toString(),'image');
  const prompt=mock.starts[0][1].prompt;assert.deepEqual(prompt.find(block=>block.type==='image'),{type:'image',attachment:{attachmentId:'image-id',mediaType:'image/png',bytes:5,width:1,height:1}});
  assert.equal(JSON.stringify(prompt).includes('data:image'),false);
});

test('missing image service and failed pixel loading never start a reviewer',async()=>{
  const mock=services(),data=input();data.images=[{id:'main',role:'draft',url:'https://images.example.test/main.png'}];
  await assert.rejects(runIndependentReview(data,parent,mock.value,new AbortController().signal),/IMAGE_SERVICE/);
  mock.value.attachments={async saveImages(){throw new Error('should not save');}};mock.value.fetchImpl=async()=>new Response('no',{status:404});
  await assert.rejects(runIndependentReview(data,parent,mock.value,new AbortController().signal),/IMAGE_UNAVAILABLE/);assert.equal(mock.starts.length,0);
});

for(const failure of [{stopReason:'refusal'},{structured:{questions:[]}},{structured:{questions:[{...output().questions[0],version:'stale'}]}}])test(`child failure is not a pass: ${JSON.stringify(failure)}`,async()=>{
  const mock=services(failure);await assert.rejects(runIndependentReview(input(),parent,mock.value,new AbortController().signal),/INDEPENDENT_REVIEW/);assert.equal(mock.disposed(),1);
});

test('pump fulfills only its own service request and stops with the invocation',async()=>{
  const bridge=new ReviewBridge(),mock=services();
  const transport={reviewNext:(scope:typeof owner,signal?:AbortSignal)=>bridge.next(scope,signal),async reviewComplete(ticket:any,completion:any){bridge.complete(ticket.requestId,ticket.claimToken,ticket.owner,completion);}};
  const result=await withIndependentReviewPump(transport,owner,parent,mock.value,signal=>bridge.request(input(),owner,signal));
  assert.equal(result.questions[0].status,'passed');assert.equal(mock.starts.length,1);assert.equal(mock.disposed(),1);
});
