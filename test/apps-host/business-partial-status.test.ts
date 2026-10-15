import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt,randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {RuntimeOperation} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import type {BusinessPlan} from '../../packages/app-hallmark/src/operations/types.ts';
import type {CoreBroker,CoreClient} from '../../packages/core/src/types.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';

// Stay above Fetch's restricted ports; retry bounded local port collisions on Windows and POSIX.
async function listenForFetch(server:ReturnType<typeof createAppsServer>,signal:AbortSignal):Promise<number>{
  for(let attempt=0;attempt<20;attempt++){
    signal.throwIfAborted();
    try{
      await new Promise<void>((done,reject)=>{
        const ready=()=>{server.off('error',failed);done();};
        const failed=(error:Error)=>{server.off('listening',ready);reject(error);};
        server.once('listening',ready);server.once('error',failed);server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
      });
      const address=server.address();assert.ok(address&&typeof address!=='string');return address.port;
    }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  }
  throw new Error('No free Fetch-compatible fixture port');
}
function settledOrAborted<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise<T>((done,reject)=>{
    const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
    signal.addEventListener('abort',aborted,{once:true});
    operation.then(value=>{signal.removeEventListener('abort',aborted);done(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
    if(signal.aborted)aborted();
  });
}

// These are local terminal outcome controls, not commodity facts or merchant success evidence.
// The real Provider and BusinessOperations skip both terminal rows without dispatching a write.
test('mixed terminal business outcomes remain partial in native invoke and inspection model JSON',{timeout:30000},async t=>{
  let store:RuntimeStore|undefined,runtime:AppsRuntime|undefined,server:ReturnType<typeof createAppsServer>|undefined,host:AppsHost|undefined;
  try{
    store=new RuntimeStore(':memory:');runtime=new AppsRuntime(store);
    const port=new HallmarkStorePort(store,'partial-control');
    const plan:BusinessPlan={planId:'local-outcome-control',revision:1,storeId:'local-control',title:'Local terminal state control',status:'partial',createdAt:'2026-10-15T00:00:00Z',updatedAt:'2026-10-15T00:00:00Z',rows:[
      {rowId:'completed-control',revision:1,action:'stock',target:{offerId:'local-completed'},payload:{},status:'succeeded',issues:[],corrections:[],repairHistory:{}},
      {rowId:'rejected-control',revision:1,action:'stock',target:{offerId:'local-rejected'},payload:{},status:'rejected',issues:[{code:'LOCAL_TERMINAL_REJECTION',message:'Explicit terminal outcome control; no retry is authorized.'}],corrections:[],repairHistory:{}},
    ]};
    const originalRows=structuredClone(plan.rows);port.put('business_plans',plan.planId,plan);
    let externalCalls=0,providerInspections=0,providerExecutions=0;
    const forbidden=():never=>{externalCalls++;throw new Error('Terminal outcome replay cannot read or write a merchant service');};
    const client:CoreClient={getStores:forbidden,getStoreProducts:forbidden,syncStoreProducts:forbidden,getTargetMargin:forbidden,searchCollectedItems:forbidden,getCollectedItem:forbidden,platformCall:forbidden,platformRead:forbidden,storeDataRead:forbidden};
    const broker:CoreBroker={getStoreTask:forbidden,getListingTask:forbidden,requestId:forbidden};
    const provider=new HallmarkProvider({store:port,client,broker,reviewer:{review:forbidden}});
    const execute=provider.execute.bind(provider),inspect=provider.inspect.bind(provider);
    provider.execute=context=>{providerExecutions++;return execute(context);};
    provider.inspect=(...args)=>{providerInspections++;return inspect(...args);};
    runtime.register(provider);
    const agent={id:'partial-model-control'},tools=new Map<string,NativeGatewayTool>(),token=randomUUID();
    runtime.addConnection({appId:'hallmark',connectionId:'partial-control',displayName:'Local outcome replay',config:{},configRevision:1,enabled:true});
    runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'partial-control',enabled:true,boundAt:new Date().toISOString()});
    server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
    const requests:string[]=[];server.prependListener('request',request=>requests.push(`${request.method} ${request.url}`));
    const deadline=()=>AbortSignal.any([t.signal,AbortSignal.timeout(10000)]),listening=deadline();
    const origin=`http://127.0.0.1:${await settledOrAborted(listenForFetch(server,listening),listening)}`;
    host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(origin,token,(input,init)=>{
      assert.equal(new URL(String(input)).origin,origin);
      return fetch(input,{...init,signal:AbortSignal.any([deadline(),...(init?.signal?[init.signal]:[])])});
    }));
    await settledOrAborted(host.start(),deadline());host.attachApp('hallmark');
    const call=async(name:string,args:Record<string,unknown>)=>{
      const tool=tools.get(name);assert.ok(tool);
      const signal=deadline(),native:any=await settledOrAborted(tool.execute(args,{agent,signal}),signal);
      const rendered=tool.output.render(args,native).map(part=>part.text).join('');
      assert.ok(Buffer.byteLength(rendered,'utf8')<=16384);
      return {raw:native.result,model:JSON.parse(rendered)};
    };
    const invoked=await call('apps_invoke',{appId:'hallmark',connectionId:'partial-control',capabilityId:'hallmark.plan.submit',capabilityVersion:'1.0.0',input:{planId:plan.planId,expectedRevision:1},idempotencyKey:'local-partial-control'});
    assert.equal(invoked.raw.status,'partial');
    const operationId=invoked.raw.operation.operationId;assert.equal(typeof operationId,'string');
    const assertPartial=(value:typeof invoked)=>{
      assert.equal(value.raw.status,'partial');
      assert.equal(value.model.status,'partial','a successful summary render must not relabel a partial business outcome as ok');
      for(const result of [value.raw,value.model]){
        assert.equal(result.operation.operationId,operationId);assert.equal(result.operation.state,'partial');
        assert.equal(result.data.planId,plan.planId);assert.equal(result.data.status,'partial');
        assert.deepEqual(result.data.rows.map((row:any)=>[row.rowId,row.status]),[['completed-control','succeeded'],['rejected-control','rejected']]);
        assert.deepEqual(result.errors.map((error:any)=>({code:error.code,retryPolicy:error.retryPolicy})),[{code:'BUSINESS_PARTIAL',retryPolicy:'never'}]);
      }
      assert.equal(store!.get<RuntimeOperation>('operations',operationId)?.state,'partial');
      assert.equal(value.model.data.modelView,'business-operation-summary');
      assert.deepEqual(value.model.data.rowStatusCounts,{succeeded:1,rejected:1});
      assert.deepEqual(value.model.data.rows[1].issues,[{code:'LOCAL_TERMINAL_REJECTION',message:'Explicit terminal outcome control; no retry is authorized.'}]);
    };
    assertPartial(invoked);
    const beforeInspection=requests.length;
    assertPartial(await call('apps_inspect',{operationId}));
    assert.equal(providerExecutions,1);assert.equal(providerInspections,0,'terminal inspection must use stored evidence');
    assert.equal(externalCalls,0,'terminal outcome replay must not call a merchant API or model reviewer');
    assert.equal(requests.filter(path=>path==='POST /v1/routed-invocations').length,1);
    const inspectionPaths=[`POST /v1/operations/${encodeURIComponent(operationId)}/inspect`,`POST /v1/session-operations/${encodeURIComponent(operationId)}/inspect`];
    assert.equal(requests.slice(beforeInspection).filter(path=>inspectionPaths.includes(path)).length,1,'inspect must read the same terminal operation once through the Runtime HTTP API');
    assert.deepEqual(port.get<BusinessPlan>('business_plans',plan.planId)?.rows,originalRows);
    assert.equal(port.list('business_executions').length,0,'no platform execution may be created');
  }finally{
    try{await host?.dispose();}finally{
      try{server?.closeAllConnections();if(server?.listening)await new Promise<void>(done=>server!.close(()=>done()));}finally{
        try{await runtime?.dispose();}finally{store?.close();}
      }
    }
  }
});
