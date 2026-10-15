import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt,randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type InvocationRecord,type RuntimeOperation} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CapabilityDescriptor,CapabilityResult,InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

function settledOrAborted<T>(work:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason);};
    signal.addEventListener('abort',abort,{once:true});
    work.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
    if(signal.aborted)abort();
  });
}
async function bounded<T>(label:string,work:(signal:AbortSignal)=>Promise<T>,parent?:AbortSignal,ms=5000):Promise<T>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Fixture deadline: '+label)),ms);
  const signal=AbortSignal.any([controller.signal,...(parent?[parent]:[])]);
  try{return await settledOrAborted(Promise.resolve().then(()=>{signal.throwIfAborted();return work(signal);}),signal);}finally{clearTimeout(timer);}
}
async function listen(server:ReturnType<typeof createAppsServer>,signal:AbortSignal):Promise<string>{
  for(let attempt=0;attempt<20;attempt++){
    try{
      await new Promise<void>((done,reject)=>{
        const ready=()=>{server.off('error',failed);done();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};
        server.once('listening',ready);server.once('error',failed);server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
      });
      return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
    }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  }
  throw new Error('No free Fetch-compatible fixture port');
}

// Explicit calls with a stable intent key are separate from automatic replay.
// The first lost response is resolved by the existing readonly inspection before
// the caller explicitly repeats that already-confirmed intent with a new attempt.
test('native Host preserves a stable intent across explicit attempts after real HTTP response loss',{timeout:30000},async t=>{
  const lifetime=new AbortController(),testSignal=AbortSignal.any([t.signal,lifetime.signal]);
  let cleanupStore:RuntimeStore|undefined,cleanupRuntime:AppsRuntime|undefined,server:ReturnType<typeof createAppsServer>|undefined,host:AppsHost|undefined;
  const pending=new Set<Promise<unknown>>();let releaseResponse=()=>{};
  t.after(async()=>{
    releaseResponse();lifetime.abort(new Error('Fixture closing'));
    const failures:Error[]=[];
    const cleanup=async(label:string,work:()=>unknown|Promise<unknown>)=>{try{await bounded(label,async()=>work(),undefined,5000);}catch(cause){failures.push(new Error(label,{cause}));}};
    await cleanup('HTTP connections',()=>server?.closeAllConnections());
    await cleanup('HTTP server',()=>server?.listening?new Promise<void>((done,reject)=>server!.close(error=>error?reject(error):done())):undefined);
    await cleanup('native calls',()=>Promise.allSettled([...pending]));
    await cleanup('Host',()=>host?.dispose());
    await cleanup('Runtime',()=>cleanupRuntime?.dispose());
    await cleanup('Store',()=>cleanupStore?.close());
    if(failures.length)throw new AggregateError(failures,'Explicit-intent fixture cleanup failed');
  });
  const store=cleanupStore=new RuntimeStore(':memory:'),runtime=cleanupRuntime=new AppsRuntime(store);
  const descriptor:CapabilityDescriptor={capabilityId:'intentcontrol.counter.apply',version:'1.0.0',title:'Counter control',description:'Non-business in-memory dispatch counter',effect:'mutation',inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},outputSchema:{type:'object',properties:{value:{type:'string'},applied:{type:'integer'}},required:['value','applied'],additionalProperties:false},execution:{mode:'sync',timeoutMs:5000,concurrency:'exclusive',lockScope:'connection',idempotency:'runtime_dedup',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
  const providerRequests:InvocationRequest[]=[];let applied=0;
  runtime.register({manifest:{manifestVersion:1,appId:'intentcontrol',displayName:'Intent control',providerPackage:'local-control',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],async execute(context){
    providerRequests.push(structuredClone(context.request));applied++;
    return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{value:(context.request.input as {value:string}).value,applied}};
  },async dispose(){}});
  const agent={id:'explicit-intent-control'},connectionId='local';
  runtime.addConnection({appId:'intentcontrol',connectionId,displayName:'Local control',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:agent.id,appId:'intentcontrol',connectionId,enabled:true,boundAt:new Date().toISOString()});
  const token=randomUUID(),tools=new Map<string,NativeGatewayTool>(),http:{method:string;path:string}[]=[],submitted:InvocationRequest[]=[];
  server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token,log:()=>{}});
  let markCommitted=()=>{},dropped=0,committedAtDrop:InvocationRecord|undefined;
  const committed=new Promise<void>(done=>{markCommitted=done;});
  server.prependListener('request',(request,response)=>{
    http.push({method:request.method??'',path:request.url??''});
    if(request.method!=='POST'||request.url!=='/v1/routed-invocations')return;
    let body='';request.on('data',chunk=>{body+=chunk;});
    const end=response.end;
    response.end=(function(this:typeof response,...args:Parameters<typeof end>){
      const input=JSON.parse(body) as InvocationRequest;submitted.push(input);
      if(submitted.length===1){
        committedAtDrop=store.get<InvocationRecord>('invocations',input.invocationId);
        let released=false;releaseResponse=()=>{if(!released){released=true;dropped++;this.destroy();}};
        markCommitted();return this;
      }
      return end.apply(this,args);
    }) as typeof end;
  });
  const origin=await bounded('listen',signal=>listen(server!,signal),testSignal);
  const transport=new HttpAppsHostTransport(origin,token,(input,init)=>{
    assert.equal(new URL(String(input)).origin,origin,'only this fixture loopback origin may be contacted');
    return bounded('HTTP',signal=>fetch(input,{...init,signal}),AbortSignal.any([testSignal,...(init?.signal?[init.signal]:[])]));
  });
  host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
  await bounded('Host start',()=>host!.start(),testSignal);host.attachApp('intentcontrol');
  const tool=tools.get('apps_invoke')!,input={value:'explicit-control'},intent='stable-intent-control';
  const call=async(invocationId:string,idempotencyKey:string)=>{
    const args:Record<string,JsonValue>={appId:'intentcontrol',connectionId,capabilityId:descriptor.capabilityId,capabilityVersion:descriptor.version,input,idempotencyKey,invocationId,traceId:'trace-'+invocationId};
    const operation=bounded('native invocation',signal=>{
      const work=tool.execute(args,{agent,callId:invocationId,signal});pending.add(work);
      work.then(()=>pending.delete(work),()=>pending.delete(work));return work;
    },testSignal);
    const native=await operation as {result:CapabilityResult},text=tool.output.render(args,native).map(part=>part.text).join(''),model=JSON.parse(text) as CapabilityResult;
    assert.ok(Buffer.byteLength(text,'utf8')<=16384);assert.deepEqual(model,native.result);assert.equal(model.invocationId,invocationId);assert.equal(model.traceId,'trace-'+invocationId);
    assert.deepEqual(model,store.get<InvocationRecord>('invocations',invocationId)!.result);
    return model;
  };
  const firstPending=call('attempt-one',intent);firstPending.catch(()=>{});
  await bounded('committed response barrier',()=>Promise.race([committed,firstPending.then(()=>{throw new Error('First invocation completed before the committed response barrier');})]),testSignal);
  assert.equal(committedAtDrop?.state,'settled');assert.equal(committedAtDrop?.result?.status,'ok');assert.equal(applied,1);
  releaseResponse();
  const first=await firstPending;
  assert.equal(first.status,'ok');assert.equal(first.operation?.state,'succeeded');
  assert.equal(dropped,1);assert.equal(submitted.length,1,'HTTP loss does not automatically replay a mutation');
  assert.equal(http.filter(row=>row.method==='GET'&&row.path==='/v1/invocations/attempt-one').length,1,'readonly recovery confirms the original committed result first');
  const second=await call('attempt-two',intent);
  assert.equal(second.status,'ok');assert.equal(applied,1,'same intent across explicit attempts must not execute twice');
  assert.equal(second.operation?.operationId,first.operation?.operationId);
  assert.deepEqual('data'in first?first.data:undefined,{value:'explicit-control',applied:1});
  assert.deepEqual('data'in second?second.data:undefined,{value:'explicit-control',applied:1});
  assert.equal(submitted.length,2);assert.deepEqual(submitted.map(request=>request.idempotencyKey),[intent,intent]);
  assert.deepEqual(submitted.map(request=>request.invocationId),['attempt-one','attempt-two']);
  const original=store.get<RuntimeOperation>('operations',first.operation!.operationId)!;
  assert.equal(original.idempotencyKey,intent);assert.equal(original.state,'succeeded');assert.equal(store.list('operations').length,1);
  // A different explicit intent remains executable; this is deduplication, not
  // disabling this Provider or treating every request as the same operation.
  const distinct=await call('attempt-three','separate-intent-control');
  assert.equal(distinct.status,'ok');assert.equal(applied,2);assert.notEqual(distinct.operation?.operationId,first.operation?.operationId);
  assert.deepEqual('data'in distinct?distinct.data:undefined,{value:'explicit-control',applied:2});
  assert.deepEqual(providerRequests.map(request=>request.invocationId),['attempt-one','attempt-three']);
  assert.deepEqual(providerRequests.map(request=>request.idempotencyKey),[intent,'separate-intent-control']);
  assert.deepEqual(store.get('operations',first.operation!.operationId),original);
  assert.equal(store.list('invocations').length,3);assert.equal(store.list('operations').length,2);
  assert.equal(http.filter(row=>row.method==='POST'&&row.path==='/v1/routed-invocations').length,3);
  assert.equal(http.filter(row=>row.method==='POST'&&row.path==='/v1/invocations').length,0);
});
