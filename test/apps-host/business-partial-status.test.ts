import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {RuntimeOperation} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {BUSINESS_DESCRIPTORS,executeBusiness} from '../../packages/app-hallmark/src/operations-provider.ts';
import type {BusinessOperations} from '../../packages/app-hallmark/src/operations/index.ts';
import type {CoreStore} from '../../packages/core/src/types.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';

function settledOrAborted<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
    signal.addEventListener('abort',aborted,{once:true});
    operation.then(value=>{signal.removeEventListener('abort',aborted);resolve(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
    if(signal.aborted)aborted();
  });
}

// Explicit local outcome controls, not commodity facts or a merchant submission.
// executeBusiness derives the existing partial result from these two row states.
test('mixed terminal business outcomes remain partial in native invoke and inspection model JSON', {timeout:20000}, async t=>{
  let store:RuntimeStore|undefined,runtime:AppsRuntime|undefined,server:Server|undefined,host:AppsHost|undefined;
  try{
    store=new RuntimeStore(':memory:');runtime=new AppsRuntime(store);
    const plan={planId:'local-outcome-control',revision:1,storeId:'local-control',status:'partial',rows:[
      {rowId:'completed-control',revision:1,action:'stock',target:{offerId:'local-completed'},payload:{},status:'succeeded',issues:[]},
      {rowId:'blocked-control',revision:1,action:'stock',target:{offerId:'local-blocked'},payload:{},status:'blocked',issues:[{code:'LOCAL_CONTROL_BLOCKED',message:'Explicit local outcome control.'}]},
    ]};
    const before=JSON.stringify(plan),links=new Map<string,unknown>();
    let gets=0,submits=0,providerInspections=0;
    const operations={
      get(planId:string){assert.equal(planId,plan.planId);gets++;return structuredClone(plan);},
      async submit(input:{planId:string;expectedRevision:number}){assert.deepEqual(input,{planId:plan.planId,expectedRevision:1});submits++;return structuredClone(plan);},
    } as unknown as BusinessOperations;
    const businessStore={put(collection:string,id:string,value:unknown){assert.equal(collection,'business_runtime_operations');links.set(id,value);}} as unknown as CoreStore;
    runtime.register({
      manifest:{manifestVersion:1,appId:'hallmark',displayName:'Local outcome control',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['business-plan']},
      descriptors:BUSINESS_DESCRIPTORS.filter(item=>item.capabilityId==='hallmark.plan.submit'),
      execute:context=>executeBusiness(operations,businessStore,context),
      async inspect(){providerInspections++;throw new Error('A terminal partial result must use its stored evidence.');},
      async dispose(){},
    });
    const agent={id:'partial-model-control'},tools=new Map<string,NativeGatewayTool>(),token=randomUUID();
    runtime.addConnection({appId:'hallmark',connectionId:'local',displayName:'Local',config:{},configRevision:1,enabled:true});
    runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
    server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
    const requests:string[]=[];server.prependListener('request',request=>requests.push(`${request.method} ${request.url}`));
    const listeningServer=server;
    await new Promise<void>((done,reject)=>{listeningServer.once('error',reject);listeningServer.listen(0,'127.0.0.1',()=>{listeningServer.off('error',reject);done();});});
    const address=server.address();assert.ok(address&&typeof address==='object');
    host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token,(input,init)=>fetch(input,{...init,signal:AbortSignal.any([t.signal,AbortSignal.timeout(5000),...(init?.signal?[init.signal]:[])])})));
    await settledOrAborted(host.start(),AbortSignal.any([t.signal,AbortSignal.timeout(5000)]));host.attachApp('hallmark');
    const call=async(name:string,args:Record<string,unknown>)=>{
      const tool=tools.get(name)!;assert.ok(tool);
      const signal=AbortSignal.any([t.signal,AbortSignal.timeout(5000)]);
      const native:any=await settledOrAborted(tool.execute(args,{agent,signal}),signal);
      const rendered=tool.output.render(args,native).map(part=>part.text).join('');
      assert.ok(Buffer.byteLength(rendered)<=16384);
      return {raw:native.result,model:JSON.parse(rendered)};
    };
    const invoked=await call('apps_invoke',{appId:'hallmark',connectionId:'local',capabilityId:'hallmark.plan.submit',capabilityVersion:'1.0.0',input:{planId:plan.planId,expectedRevision:1},idempotencyKey:'local-partial-control'});
    assert.equal(invoked.raw.status,'partial');
    const operationId=invoked.raw.operation.operationId;
    const assertPartial=(value:any)=>{
      assert.equal(value.raw.status,'partial');
      assert.equal(value.model.status,'partial','a successful summary render must not relabel a partial business outcome as ok');
      assert.equal(value.model.operation.operationId,operationId);assert.equal(value.model.operation.state,'partial');
      assert.equal(value.model.data.status,'partial');assert.equal(value.model.data.modelView,'business-operation-summary');
      assert.deepEqual(value.model.data.rows.map((row:any)=>[row.rowId,row.status]),[['completed-control','succeeded'],['blocked-control','blocked']]);
      assert.deepEqual(value.model.data.rowStatusCounts,{succeeded:1,blocked:1});
      assert.deepEqual(value.model.errors.map((error:any)=>({code:error.code,retryPolicy:error.retryPolicy})),[{code:'BUSINESS_PARTIAL',retryPolicy:'never'}]);
      assert.equal(store!.get<RuntimeOperation>('operations',operationId)?.state,'partial');
    };
    assertPartial(invoked);
    assertPartial(await call('apps_inspect',{operationId}));
    assert.equal(gets,1);assert.equal(submits,1);assert.equal(providerInspections,0);assert.equal(links.size,1);
    assert.equal(requests.filter(path=>path==='POST /v1/routed-invocations').length,1);
    assert.equal(requests.filter(path=>path===`POST /v1/operations/${operationId}/inspect`).length,1);
    assert.equal(JSON.stringify(plan),before);
  }finally{
    try{await host?.dispose();}finally{
      const listeningServer=server;listeningServer?.closeAllConnections();
      if(listeningServer?.listening)await new Promise<void>(done=>listeningServer.close(()=>done()));
      try{await runtime?.dispose();}finally{store?.close();}
    }
  }
});
