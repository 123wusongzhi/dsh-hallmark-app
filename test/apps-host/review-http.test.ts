import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {ReviewBridge} from '../../packages/service/src/review-bridge.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {AppProvider,CapabilityDescriptor,InvocationRequest} from '../../packages/app-contracts/src/index.ts';
import type {IndependentReviewRequest} from '../../packages/app-contracts/src/business-review.ts';

const reviewInput:IndependentReviewRequest={source:{sku:'source-1'},draft:{title:'red cup'},versions:{source:'source-v1',draft:'draft-v1'},questions:[{id:'color',version:'1',instructions:'Compare color',passCriteria:'Matches',failCriteria:'Does not match'}],context:{mode:'independent-review',toolPolicy:'read-only',writeTools:[],reasons:[{id:'color',reasonCode:'decisions_unavailable'}]}};
const descriptor:CapabilityDescriptor={capabilityId:'hallmark.plan.review',version:'1.0.0',title:'Review fixture',description:'Isolated host review fixture',effect:'compute',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object',properties:{verdict:{type:'string'}},required:['verdict'],additionalProperties:false},execution:{mode:'sync',timeoutMs:3000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};

test('native gateway automatically pumps a service review over authenticated HTTP with the real parent',async()=>{
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),bridge=new ReviewBridge(),parent={id:'native-parent',options:{model:'native-model'}},tools=new Map<string,NativeGatewayTool>(),requests:InvocationRequest[]=[];let spawns=0,disposed=0,receivedParent:unknown;
  const submit:CapabilityDescriptor={...descriptor,capabilityId:'hallmark.plan.submit',effect:'mutation',execution:{...descriptor.execution,concurrency:'exclusive',idempotency:'runtime_dedup'}};
  const provider:AppProvider={manifest:{manifestVersion:1,appId:'hallmark',displayName:'Review fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:[descriptor,submit],async execute(context){requests.push(context.request);const reviewed=await bridge.request(reviewInput,{invocationId:context.request.invocationId,sessionId:'sessionId'in context.request.source?context.request.source.sessionId:undefined},context.signal);return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{verdict:reviewed.questions[0].status}};},async dispose(){}};
  runtime.register(provider);runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'C1',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:parent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const token='review-test-token-'.repeat(4),presentation=new AppsPresentationService({store,runtime}),server=createAppsServer({runtime,presentation,token,reviewBridge:bridge});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}`;
  const host=new AppsHost({agents:{get:id=>id===parent.id?parent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}},subagents:{async start(provider,request){spawns++;receivedParent=request.parent;assert.equal(provider,'spawn');assert.deepEqual(request.toolFilter,{allow:[]});return {id:'review-child',localAgent:{id:'review-child',options:{model:'native-model'},ctx:{tools:{guard:()=>()=>{}}}},result:Promise.resolve({stopReason:'completed',structured:{questions:[{id:'color',version:'1',status:'passed',message:'matches',suggestion:''}]}}),async dispose(){disposed++;}};}}},new HttpAppsHostTransport(url,token));
  try{
    await host.start();host.attachApp('hallmark');
    const unauthorized=await fetch(`${url}/v1/review-requests/next`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:parent.id,invocationId:'unowned'})});assert.equal(unauthorized.status,401);
    const result=await tools.get('apps_invoke')!.execute({appId:'hallmark',connectionId:'C1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{}},{agent:parent,signal:new AbortController().signal,callId:'native-call'}) as {result:{status:string;data:{verdict:string}}};
    assert.equal(result.result.status,'ok');assert.equal(result.result.data.verdict,'passed');assert.equal(spawns,1);assert.equal(disposed,1);assert.equal(receivedParent,parent);
    const forged=await tools.get('apps_invoke')!.execute({appId:'hallmark',connectionId:'C1',capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input:{}},{agent:{id:parent.id},signal:new AbortController().signal}) as {error:{code:string}};
    assert.equal(forged.error.code,'INVALID_SESSION');assert.equal(spawns,1);
    const ui=async(body:Record<string,unknown>)=>host.ui(new Request('http://dsh.test/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'businessOperations',sessionId:parent.id,connectionId:'C1',requestId:'ui-submit',input:{},...body})}));
    const submitted=await (await ui({operation:'submit'})).json();assert.equal(submitted.status,'ok');assert.equal(submitted.data.verdict,'passed');assert.equal(spawns,2);assert.equal(disposed,2);
    assert.equal(requests[1].invocationId,'ui-submit');assert.equal(requests[1].idempotencyKey,'ui-submit');assert.deepEqual(requests[1].source,{kind:'script',sessionId:parent.id,runId:'business-ui:ui-submit',stepKey:'submit'});
    const receipt=await (await ui({operation:'request',requestId:'receipt-lookup',input:{requestId:'ui-submit'}})).json();assert.deepEqual(receipt,{settled:true,value:{verdict:'passed'}});assert.equal(spawns,2);
    const unrelated=await ui({operation:'request',requestId:'bad-lookup',input:{requestId:requests[0].invocationId}});assert.equal(unrelated.status,400);
    const denied=await ui({operation:'submit',capabilityId:'other.arbitrary.write'});assert.equal(denied.status,400);
    const unbound=await ui({operation:'submit',connectionId:'other-connection'});assert.equal(unbound.status,409);
    assert.equal(requests.length,2);
  }finally{await host.dispose();bridge.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
