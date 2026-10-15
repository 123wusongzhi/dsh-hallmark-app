import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type InvocationRecord} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';
import type {AdapterResponse,CoreBroker,CoreClient} from '../../packages/core/src/types.ts';
import type {PlatformCallInput} from '../../packages/hallmark-adapter/types.ts';

// Local real-time wait/cleanup protection is independent of the Date-only model clock.
async function bounded<T>(work:Promise<T>,label:string):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} did not settle within 5000 ms`)),5000);})]);}
  finally{clearTimeout(timer);}
}

// Avoid OS-assigned ports that Fetch rejects; collisions retry within this bounded local range.
async function listenForFetch(server:ReturnType<typeof createAppsServer>):Promise<number>{
  for(let attempt=0;attempt<20;attempt++){
    try{
      await new Promise<void>((resolve,reject)=>{
        const ready=()=>{server.off('error',failed);resolve();};
        const failed=(error:Error)=>{server.off('listening',ready);reject(error);};
        server.once('listening',ready);server.once('error',failed);server.listen(randomInt(20000,65536),'127.0.0.1');
      });
      const address=server.address();assert.ok(address&&typeof address!=='string');return address.port;
    }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  }
  throw new Error('No free Fetch-compatible fixture port');
}

test('real Provider retryAfterMs reaches the Host model and guides explicit read-only recovery',{timeout:10000},async t=>{
  const started=Date.parse('2026-10-15T00:00:00Z'),delay=4200,allowedAt=started+delay;
  // Only Date is virtual: HTTP, cancellation and timeout timers continue using real time.
  t.mock.timers.enable({apis:['Date'],now:started});
  const store=new RuntimeStore(':memory:');
  const cleanup:Array<()=>void|Promise<unknown>>=[()=>store.close()];
  const close=async()=>{
    const errors:unknown[]=[];
    for(const dispose of cleanup.splice(0).reverse()){
      try{await bounded(Promise.resolve().then(dispose),'Fixture cleanup');}catch(error){errors.push(error);}
    }
    if(errors.length)throw new AggregateError(errors,'Rate-limit fixture cleanup failed');
  };
  try{
  const runtime=new AppsRuntime(store);cleanup.push(()=>runtime.dispose());
  const reads:{storeId:string;input:PlatformCallInput;at:number}[]=[],providerRequests:InvocationRequest[]=[],http:{method:string;path:string}[]=[];
  const unexpected=async():Promise<never>=>{throw new Error('This protocol fixture permits only price reads');};
  const client:CoreClient={getStores:unexpected,getStoreProducts:unexpected,syncStoreProducts:unexpected,getTargetMargin:unexpected,
    searchCollectedItems:unexpected,getCollectedItem:unexpected,platformCall:unexpected,platformRead:unexpected,
    async storeDataRead(storeId,input):Promise<AdapterResponse>{
      assert.equal(storeId,'rate-limit-control');assert.equal(input.path,'/v5/product/info/prices');assert.equal(input.method,'POST');
      reads.push({storeId,input:structuredClone(input),at:Date.now()});
      // Explicit local 429/deadline/empty-response controls; no commodity or merchant data.
      const remaining=allowedAt-Date.now();
      return remaining>0?{status:'failed',raw:{storeId,outcome:'response_received',httpStatus:429},error:{code:'PLATFORM_ERROR',message:'Synthetic HTTP 429',retryable:true,retryAfterMs:remaining}}
        :{status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response:{items:[]}}};
    }};
  const broker:CoreBroker={getStoreTask:unexpected,getListingTask:unexpected,requestId(){throw new Error('No business submission is allowed');}};
  const provider=new HallmarkProvider({store:new HallmarkStorePort(store,'C1'),client,broker}),executeProvider=provider.execute.bind(provider);
  provider.execute=context=>{providerRequests.push(structuredClone(context.request));return executeProvider(context);};
  runtime.register(provider);
  const agent={id:'rate-limit-agent'},tools=new Map<string,NativeGatewayTool>();
  runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Protocol control',enabled:true,config:{},configRevision:1});
  runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
  const token='synthetic-local-control-'.repeat(3),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
  server.prependListener('request',request=>http.push({method:request.method??'',path:request.url??''}));
  cleanup.push(async()=>{server.closeAllConnections();if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
  const requests=new AbortController();
    const origin=`http://127.0.0.1:${await bounded(listenForFetch(server),'Fixture listen')}`;
    const transport=new HttpAppsHostTransport(origin,token,(input,init)=>{assert.equal(new URL(String(input)).origin,origin);return fetch(input,init);});
    const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}}},transport);
    cleanup.push(()=>host.dispose(),()=>requests.abort());
    await bounded(host.start(),'Host start');host.attachApp('hallmark');
    const invoke=tools.get('apps_invoke')!,input={storeId:'rate-limit-control',limit:1};
    const call=async(invocationId:string)=>{
      const args:Record<string,JsonValue>={appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.ozon.prices',capabilityVersion:'1.0.0',input,invocationId,traceId:`trace-${invocationId}`};
      const native=await bounded(invoke.execute(args,{agent,callId:invocationId,signal:AbortSignal.any([t.signal,requests.signal])}),'Host invocation') as {result:CapabilityResult};
      const text=invoke.output.render(args,native).map(part=>part.text).join('');assert.ok(Buffer.byteLength(text)<=16384);
      const model=JSON.parse(text) as CapabilityResult;assert.deepEqual(model,native.result);
      assert.equal(model.invocationId,invocationId);assert.equal(model.traceId,args.traceId);
      const persisted=store.get<InvocationRecord>('invocations',invocationId);assert.ok(persisted);assert.equal(persisted.state,'settled');
      assert.deepEqual(persisted.result,model);assert.deepEqual(persisted.request,providerRequests.at(-1));assert.deepEqual(persisted.request.input,input);
      assert.equal(store.list('operations').length,0,'all attempts remain read-only');return model;
    };
    const first=await call('limited-first');assert.equal(first.status,'unavailable');assert.ok('error'in first);
    assert.equal(first.error.code,'LOCAL_RATE_LIMIT');assert.equal(first.error.retryPolicy,'read_retry');
    assert.equal(first.error.retryAfterMs,delay,'the exact adapter delay must reach the model');
    assert.equal('data'in first,false);assert.equal(first.operation,undefined);assert.equal(reads.length,1,'Host/Runtime must not automatically replay the limited query');

    // Advance only after settled HTTP calls, using the actual model-visible hint; no real sleep.
    t.mock.timers.tick(first.error.retryAfterMs!-1);assert.equal(reads.length,1,'time alone cannot dispatch a read');
    const early=await call('limited-before-deadline');assert.equal(early.status,'unavailable');assert.ok('error'in early);
    assert.equal(early.error.code,'LOCAL_RATE_LIMIT');assert.equal(early.error.retryPolicy,'read_retry');assert.equal(early.error.retryAfterMs,1);assert.equal(reads.length,2);
    t.mock.timers.tick(early.error.retryAfterMs!);
    const recovered=await call('limited-recovered');assert.equal(recovered.status,'ok');assert.ok('data'in recovered);
    assert.deepEqual(recovered.data,{items:[],dataTime:null,warnings:[]});assert.equal('error'in recovered,false);assert.equal(recovered.operation,undefined);
    assert.deepEqual(reads.map(read=>read.at),[started,allowedAt-1,allowedAt]);assert.equal(reads.length,3);assert.equal(providerRequests.length,3);
    assert.ok(reads.every(read=>read.input.path==='/v5/product/info/prices'&&read.storeId===input.storeId));
    assert.ok(providerRequests.every(request=>request.capabilityId==='hallmark.ozon.prices'));
    assert.deepEqual(http.filter(row=>row.method==='POST'),Array(3).fill({method:'POST',path:'/v1/routed-invocations'}));
    assert.equal(store.list('invocations').length,3);
    assert.deepEqual(store.get<InvocationRecord>('invocations','limited-first')?.result,first,'recovery retains earlier failure evidence');
    assert.deepEqual(store.get<InvocationRecord>('invocations','limited-before-deadline')?.result,early);
  }catch(error){
    try{await close();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Rate-limit fixture setup or assertion and cleanup failed',{cause:error});}
    throw error;
  }
  await close();
});
