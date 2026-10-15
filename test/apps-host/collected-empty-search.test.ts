import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type InvocationRecord} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';
import type {AdapterResponse,CoreBroker} from '../../packages/core/src/types.ts';
import {realSourceSummaries} from '../real-data/corpus.ts';

function settledOrAborted<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise<T>((resolve,reject)=>{
  const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
  signal.addEventListener('abort',aborted,{once:true});
  operation.then(value=>{signal.removeEventListener('abort',aborted);resolve(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
  if(signal.aborted)aborted();
 });
}
async function bounded<T>(label:string,work:(signal:AbortSignal)=>Promise<T>,parent?:AbortSignal,ms=3000):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Fixture deadline: '+label)),ms);
 const signal=AbortSignal.any([controller.signal,...(parent?[parent]:[])]);
 try{return await settledOrAborted(Promise.resolve().then(()=>{signal.throwIfAborted();return work(signal);}),signal);}finally{clearTimeout(timer);}
}
async function listenForFetch(server: ReturnType<typeof createAppsServer>,signal:AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const ready = () => {server.off('error', failed); resolve();};
        const failed = (error: Error) => {server.off('listening', ready); reject(error);};
        server.once('listening', ready); server.once('error', failed);
        server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
      });
      return `http://127.0.0.1:${(server.address() as {port: number}).port}`;
    } catch (error) {
      if (!['EADDRINUSE', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  throw new Error('No free Fetch-compatible fixture port');
}

test('real adapter zero matches stay empty through Provider, HTTP and model output, distinct from source failure',{timeout:15000},async t=>{
 // The business summaries are unchanged public recordings. Query/HTTP failure
 // and genuine empty-source responses below are explicit transport controls.
 const summaries=realSourceSummaries().slice(0,2),originalSummaries=structuredClone(summaries);
 const query='__dsh_zero_match_protocol_control_20261015__';
 assert.equal(summaries.length,2);
 assert.ok(!JSON.stringify(summaries).toLocaleLowerCase().includes(query),'control query must be independently absent from every original field');
 const lifetime=new AbortController(),testSignal=AbortSignal.any([t.signal,lifetime.signal]);
 let cleanupStore:RuntimeStore|undefined,cleanupRuntime:AppsRuntime|undefined,host:AppsHost|undefined,server:ReturnType<typeof createAppsServer>|undefined;
 // Registered before either constructor: later initialization failures cannot leak the store.
 t.after(async()=>{
  lifetime.abort(new Error('Fixture teardown'));
  const failures:Error[]=[];
  const cleanup=async(label:string,work:()=>Promise<unknown>|unknown)=>{
   try{await bounded('cleanup '+label,async()=>work(),undefined,1000);}catch(cause){failures.push(new Error(label+' cleanup failed',{cause}));}
  };
  await cleanup('Host',()=>host?.dispose());
  await cleanup('HTTP connections',()=>server?.closeAllConnections());
  await cleanup('HTTP server',async()=>{if(server?.listening)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));});
  await cleanup('Runtime',()=>cleanupRuntime?.dispose());
  await cleanup('Store',()=>cleanupStore?.close());
  if(failures.length)throw new AggregateError(failures,'Fixture cleanup failures');
 });
 const store=cleanupStore=new RuntimeStore(':memory:'),runtime=cleanupRuntime=new AppsRuntime(store),port=new HallmarkStorePort(store,'C1');
 let mode:'nonmatching'|'empty-source'|'unavailable'='nonmatching';
 const sourceCalls:string[]=[],adapterResults:AdapterResponse[]=[],providerRequests:InvocationRequest[]=[],http:{method:string;path:string}[]=[];
 const sourceFetch:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,'http://127.0.0.1:4173');assert.equal(init?.method,'GET');sourceCalls.push(url.pathname);
  if(url.pathname==='/api/health')return Response.json({service:'hallmark-control'});
  assert.equal(url.pathname,'/api/items','no store, task or business endpoint may run');
  return mode==='unavailable'?Response.json({error:'Synthetic source temporarily unavailable'},{status:503}):Response.json(mode==='empty-source'?[]:summaries);
 };
 const client=new HallmarkClient({baseUrl:'http://127.0.0.1:4173',healthCacheMs:60000,healthTimeoutMs:2000,readTimeoutMs:2000,spillThresholdBytes:Number.MAX_SAFE_INTEGER,
  fetchImpl:(input,init)=>bounded('source fetch',signal=>sourceFetch(input,{...init,signal}),AbortSignal.any([testSignal,...(init?.signal?[init.signal]:[])]),2000),
 });
 const search=client.searchCollectedItems.bind(client);
 client.searchCollectedItems=async input=>{assert.equal(input,query);const result=await search(input);adapterResults.push(structuredClone(result));return result;};
 const unexpected=async():Promise<never>=>{throw Error('No business task is permitted');};
 const broker:CoreBroker={getStoreTask:unexpected,getListingTask:unexpected,requestId(){throw Error('No business request is permitted');}};
 const provider=new HallmarkProvider({store:port,client,broker}),execute=provider.execute.bind(provider);
 provider.execute=context=>{providerRequests.push(structuredClone(context.request));return execute(context);};runtime.register(provider);
 const agent={id:'empty-search-agent'},tools=new Map<string,NativeGatewayTool>();
 runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Read control',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const token='synthetic-empty-search-control-'.repeat(3);
 server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 server.prependListener('request',request=>http.push({method:request.method??'',path:request.url??''}));
 const origin=await bounded('listen',signal=>listenForFetch(server!,signal),testSignal);
 const transport=new HttpAppsHostTransport(origin,token,(input,init)=>{assert.equal(new URL(String(input)).origin,origin);return bounded('Runtime HTTP',signal=>fetch(input,{...init,signal}),AbortSignal.any([testSignal,...(init?.signal?[init.signal]:[])]));});
 host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}}},transport);
 await bounded('Host start',()=>host!.start(),testSignal);host.attachApp('hallmark');
 const invoke=tools.get('apps_invoke')!,input={query,limit:1};
 const call=async(invocationId:string)=>{
  const args:Record<string,JsonValue>={appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.collected.search',capabilityVersion:'1.0.0',input,invocationId,traceId:`trace-${invocationId}`};
  const native=await bounded('native invocation',signal=>invoke.execute(args,{agent,callId:invocationId,signal}),testSignal) as {result:CapabilityResult};
  const text=invoke.output.render(args,native).map(part=>part.text).join('');assert.ok(Buffer.byteLength(text)<=16384);
  const model=JSON.parse(text) as CapabilityResult;assert.deepEqual(model,native.result);
  assert.equal(model.invocationId,invocationId);assert.equal(model.traceId,args.traceId);
  const saved=store.get<InvocationRecord>('invocations',invocationId);assert.ok(saved);assert.equal(saved.state,'settled');assert.deepEqual(saved.result,model);
  assert.deepEqual(saved.request,providerRequests.at(-1));assert.deepEqual(saved.request.input,input);assert.equal(model.operation,undefined);
  return model;
 };
 const emptyData=(result:CapabilityResult)=>{
  assert.equal(result.status,'ok');assert.ok('data'in result);assert.equal('error'in result,false);
  const data=result.data as {datasetKey:string;items:unknown[];total:number;cursor?:string};
  assert.match(data.datasetKey,/^collected:[a-f0-9]{64}$/);
  assert.deepEqual(data,{datasetKey:data.datasetKey,items:[],total:0},'zero matches are authoritative; never fall back to the unfiltered raw source');
  const saved=port.get('snapshots',data.datasetKey);assert.ok(saved);assert.equal(saved.state,'ready');assert.deepEqual(saved.payload,{items:[],total:0});assert.equal(saved.lastError,null);
  return {data,snapshot:saved};
 };
 const filtered=await call('nonmatching-source');
 assert.equal(adapterResults[0].status,'ok');assert.deepEqual(adapterResults[0].raw,summaries);assert.deepEqual(adapterResults[0].matches,[]);
 const first=emptyData(filtered);
 mode='empty-source';const empty=await call('genuinely-empty-source'),second=emptyData(empty);
 assert.deepEqual(adapterResults[1].raw,[]);assert.deepEqual(adapterResults[1].matches,[]);assert.equal(second.data.datasetKey,first.data.datasetKey);
 mode='unavailable';const failed=await call('unavailable-source');
 assert.equal(adapterResults[2].status,'unavailable');assert.equal(adapterResults[2].matches,undefined);
 assert.equal(failed.status,'unavailable');assert.ok('error'in failed);assert.equal(failed.error.code,'HALLMARK_HTTP_503');assert.equal(failed.error.retryPolicy,'read_retry');assert.equal('data'in failed,false);
 const failureSnapshot=port.get('snapshots',first.data.datasetKey)!;assert.equal(failureSnapshot.state,'failed');assert.equal(failureSnapshot.lastError.code,'HALLMARK_HTTP_503');
 assert.deepEqual(failureSnapshot.payload,second.snapshot.payload);assert.equal(failureSnapshot.version,second.snapshot.version);
 mode='nonmatching';const recovered=await call('recovered-filtered-source'),last=emptyData(recovered);
 assert.deepEqual(adapterResults[3].raw,summaries);assert.deepEqual(adapterResults[3].matches,[]);assert.equal(last.data.datasetKey,first.data.datasetKey);
 assert.equal(last.snapshot.version,second.snapshot.version+1);assert.deepEqual(summaries,originalSummaries);
 assert.deepEqual(sourceCalls,['/api/health','/api/items','/api/items','/api/items','/api/items']);
 assert.equal(providerRequests.length,4);assert.equal(store.list('invocations').length,4);assert.equal(store.list('operations').length,0);
 assert.deepEqual(http.filter(row=>row.method==='POST'),Array(4).fill({method:'POST',path:'/v1/routed-invocations'}));
 assert.deepEqual(store.get<InvocationRecord>('invocations','unavailable-source')?.result,failed,'recovery must not rewrite earlier failure evidence');
});
