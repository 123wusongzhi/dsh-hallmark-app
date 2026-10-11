import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {BUSINESS_DESCRIPTORS} from '../../packages/app-hallmark/src/operations-provider.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityResult} from '../../packages/app-contracts/src/index.ts';
const reports:any[]=[];
for(const scenario of ['immediate','pending-completes','pending-running','failed','cancelled-after-dispatch','invalid-inspection','missing-operation','expired-result','provider-missing-code','failed-large','projection-unavailable','missing-operation-large'])test(scenario,async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),tools=new Map<string,NativeGatewayTool>(),agent={id:`audit-${scenario}`},token='fixture-token-'.repeat(5);
 let writes=0,inspections=0,calls=0;const model:any[]=[];const requests:string[]=[];const hint=20;
 const result=(context:any,status:string):any=>({invocationId:context.request.invocationId,traceId:context.request.traceId,...(status==='ok'?{status,data:{marker:scenario,value:'exact-final-evidence',...(scenario==='expired-result'?{text:'large '.repeat(5000)}:{})}}:status==='pending'?{status,operation:{operationId:context.operationId!,state:'pending'},pollAfterMs:hint}:status==='invalid'?{status:'ok',data:undefined}:{status,error:{code:scenario==='provider-missing-code'?'OPERATION_NOT_FOUND':status.toUpperCase(),message:'Synthetic control',retryPolicy:'never',...(scenario==='failed-large'?{details:{text:'large failure '.repeat(5000)}}:{})}})});
 runtime.register({manifest:{manifestVersion:1,appId:'hallmark',displayName:'Synthetic async audit',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['product']},descriptors:BUSINESS_DESCRIPTORS,
 async execute(context){writes++;return result(context,['immediate','expired-result'].includes(scenario)?'ok':['failed','failed-large','provider-missing-code'].includes(scenario)?'failed':scenario==='cancelled-after-dispatch'?'cancelled':'pending');},
 async inspect(_id,context){inspections++;return result(context,scenario==='pending-running'?'pending':scenario==='invalid-inspection'?'invalid':'ok');},async dispose(){}});
 runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});server.on('request',req=>requests.push(`${req.method} ${req.url}`));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const transport=new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token);if(scenario==='missing-operation-large'){const original=transport.inspect.bind(transport);transport.inspect=async(id,signal)=>{const found=await original(id,signal);return {...found,error:{code:'OPERATION_NOT_FOUND',message:'oversized diagnostic '.repeat(2000),retryPolicy:'never'}} as CapabilityResult;};}if(scenario==='projection-unavailable')transport.projectModelResult=async()=>{throw new Error('synthetic projection outage');};
 const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
 try{await host.start();host.attachApp('hallmark');const execution={agent,signal:new AbortController().signal};
 const call=async(name:string,args:any)=>{calls++;const tool=tools.get(name)!;const raw:any=await tool.execute(args,execution);const rendered=tool.output.render(args,raw);const value=JSON.parse(rendered[0].text);model.push({name,args,value,rawResult:raw.result??raw});return value;};
 const start=performance.now();
 if(scenario==='missing-operation-large'){const missing=await call('apps_inspect',{operationId:'missing'});assert.equal(missing.error.code,'RESULT_SPILL_FAILED');assert.ok(Buffer.byteLength(JSON.stringify(missing))<=16384);assert.equal(writes,0);assert.equal(inspections,0);}
 else if(scenario==='missing-operation'){const missing=await call('apps_inspect',{operationId:'missing'});assert.equal(missing.error.code,process.env.ASYNC_BASELINE?'RESULT_SPILL_FAILED':'OPERATION_NOT_FOUND');assert.equal(requests.filter(x=>x==='POST /v1/model-result').length,process.env.ASYNC_BASELINE?1:0);assert.equal(model.at(-1).rawResult.error.code,'OPERATION_NOT_FOUND');assert.equal(writes,0);assert.equal(inspections,0);}
 else{
 const submitted=await call('apps_invoke',{appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.plan.submit',capabilityVersion:'1.0.0',input:{planId:'synthetic',expectedRevision:1}});
 if(scenario==='projection-unavailable'){assert.equal(submitted.status,'pending');const next=await call('apps_inspect',{operationId:submitted.operation.operationId});assert.equal(next.error.code,'RESULT_SPILL_FAILED');assert.equal(writes,1);assert.equal(inspections,1);}else{assert.ok(submitted.operation.operationId);
 if(scenario==='immediate'){assert.equal(submitted.status,'ok');assert.equal(submitted.data.value,'exact-final-evidence');assert.equal(inspections,0);}
 else if(['failed','provider-missing-code'].includes(scenario)){assert.equal(submitted.status,'failed');const again=await call('apps_inspect',{operationId:submitted.operation.operationId});assert.equal(again.status,'failed');assert.equal(inspections,0);}
 else if(scenario==='cancelled-after-dispatch'){assert.equal(submitted.status,'unknown');assert.equal(submitted.operation.state,'unknown');assert.equal(submitted.error.retryPolicy,'inspect_only');}
 else if(scenario==='failed-large'){assert.equal(submitted.status,'failed');assert.ok(submitted.fullResultRef);assert.equal(inspections,0);}
 else if(scenario==='expired-result'){assert.equal(submitted.status,'ok');assert.ok(submitted.fullResultRef);store.delete('datasets',submitted.fullResultRef);const missing=await call('apps_inspect',{resultRef:submitted.fullResultRef,path:''});assert.equal(missing.status,'failed');assert.equal(missing.error.code,'RESULT_ACCESS_DENIED','unavailable reference remains a failure; no permissions investigation');assert.equal(inspections,0);}
 else{assert.equal(submitted.status,'pending');assert.equal(submitted.pollAfterMs,hint);await new Promise(resolve=>setTimeout(resolve,submitted.pollAfterMs));const next=await call('apps_inspect',{operationId:submitted.operation.operationId});assert.equal(next.operation.operationId,submitted.operation.operationId);
 if(scenario==='pending-running'){assert.equal(next.status,'pending');assert.equal(next.pollAfterMs,hint);}
 else if(scenario==='invalid-inspection'){assert.equal(next.status,'unknown');assert.equal(next.error.retryPolicy,'inspect_only');}
 else{assert.equal(next.status,'ok');assert.equal(next.data.value,'exact-final-evidence');const again=await call('apps_inspect',{operationId:submitted.operation.operationId});assert.equal(again.data.value,'exact-final-evidence');assert.equal(inspections,1,'terminal reread does not poll provider');}
 }assert.equal(writes,1,'no mutation replay');}}
 reports.push({scenario,calls,writes,inspections,requests,observationMs:performance.now()-start,model});
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
});
test.after(()=>{
 const reportDir=process.env.ASYNC_AUDIT_REPORT_DIR;
 if(!reportDir)return;
 mkdirSync(reportDir,{recursive:true});
 writeFileSync(join(reportDir,'async-polling-audit.json'),JSON.stringify({note:'Synthetic provider; observationMs is local test overhead including requested 20ms wait, not optimization timing.',reports},null,2));
});
