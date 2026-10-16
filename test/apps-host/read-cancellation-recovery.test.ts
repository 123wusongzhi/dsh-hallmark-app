import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt,randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore,type InvocationRecord} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';

function latch(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
async function bounded<T>(work:Promise<T>,label:string,signal?:AbortSignal):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined,aborted=()=>{};
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(`${label} did not settle within 5000 ms`)),5000);
    aborted=()=>reject(signal?.reason??new Error(`${label} cancelled`));signal?.addEventListener('abort',aborted,{once:true});if(signal?.aborted)aborted();
  })]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',aborted);}
}
async function listenForFetch(server:ReturnType<typeof createAppsServer>):Promise<number>{
  for(let attempt=0;attempt<20;attempt++){
    try{
      await new Promise<void>((done,reject)=>{
        const ready=()=>{server.off('error',failed);done();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};
        server.once('listening',ready);server.once('error',failed);server.listen(randomInt(20000,65536),'127.0.0.1');
      });
      const address=server.address();assert.ok(address&&typeof address!=='string');return address.port;
    }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  }
  throw new Error('No free Fetch-compatible fixture port');
}

test('cancelled read after HTTP body completion reaches Provider, drains execution and permits the next Host read',{timeout:15000},async t=>{
  const cleanup:Array<()=>void|Promise<unknown>>=[],trace:string[]=[];let testError:unknown;
  try{
    const store=new RuntimeStore(':memory:');cleanup.push(()=>{store.close();assert.throws(()=>store.list('invocations'),/STORE_CLOSED/);});
    const entered=latch(),bodyCompleted=latch(),providerCancelled=latch(),runtimeSettled=latch();
    const runtime=new AppsRuntime(store,{log:event=>{if(event.invocationId==='cancelled-read'&&event.event==='settled'){trace.push('runtime-settled');runtimeSettled.resolve();}}});
    cleanup.push(()=>runtime.dispose());
    const requests=new AbortController(),caller=new AbortController();
    let releaseProvider=()=>{},pending:Promise<any>|undefined,providerSignal:AbortSignal|undefined,providerCalls=0;
    const resultData={value:'fresh-read-control',nullable:null};
    // An exclusive, synthetic query exposes a leaked execution instead of hiding it behind extra capacity.
    runtime.register({manifest:{manifestVersion:1,appId:'readfixture',displayName:'Read fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},
      descriptors:[{capabilityId:'readfixture.query',version:'1.0.0',title:'Read',description:'Synthetic cancellation control',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:30000,concurrency:'exclusive',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],
      async execute(context){
        providerCalls++;
        if(providerCalls===1){
          providerSignal=context.signal;
          await new Promise<void>((_done,reject)=>{
            const aborted=()=>{context.signal.removeEventListener('abort',aborted);trace.push('provider-cancelled');providerCancelled.resolve();reject(new Error('Synthetic read cancelled'));};
            releaseProvider=()=>{context.signal.removeEventListener('abort',aborted);reject(new Error('Fixture cleanup released pending read'));};
            context.signal.addEventListener('abort',aborted,{once:true});if(context.signal.aborted)aborted();trace.push('provider-entered');entered.resolve();
          });
          throw new Error('The cancelled read must not return success');
        }
        return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:structuredClone(resultData)};
      },async dispose(){}});
    const agent={id:'read-owner'},tools=new Map<string,NativeGatewayTool>();
    runtime.addConnection({appId:'readfixture',connectionId:'local',displayName:'Fixture',config:{},configRevision:1,enabled:true});
    runtime.bind({sessionId:agent.id,appId:'readfixture',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
    const token=randomUUID(),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
    cleanup.push(async()=>{server.closeAllConnections();if(server.listening)await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));assert.equal(server.listening,false);});
    const http:string[]=[];
    server.prependListener('request',request=>{
      if(request.method==='POST'&&['/v1/routed-invocations','/v1/invocations'].includes(request.url??'')){
        http.push(request.url!);request.once('end',()=>{trace.push('body-completed');bodyCompleted.resolve();});
      }
    });
    const origin=`http://127.0.0.1:${await bounded(listenForFetch(server),'server listen',t.signal)}`;
    const transport=new HttpAppsHostTransport(origin,token,(input,init)=>{
      assert.equal(new URL(String(input)).origin,origin);
      return fetch(input,{...init,signal:AbortSignal.any([t.signal,requests.signal,AbortSignal.timeout(5000),...(init?.signal?[init.signal]:[])])});
    });
    const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
    cleanup.push(async()=>{await host.dispose();assert.equal(tools.size,0);});
    cleanup.push(async()=>{caller.abort();requests.abort();releaseProvider();if(pending)await Promise.allSettled([pending]);});
    await bounded(host.start(),'Host start',t.signal);host.attachApp('readfixture');
    const invoke=tools.get('apps_invoke')!,args=(invocationId:string)=>({appId:'readfixture',connectionId:'local',capabilityId:'readfixture.query',capabilityVersion:'1.0.0',input:{},invocationId,traceId:`trace-${invocationId}`});
    pending=invoke.execute(args('cancelled-read'),{agent,signal:AbortSignal.any([caller.signal,requests.signal,t.signal])});
    await bounded(Promise.race([Promise.all([entered.promise,bodyCompleted.promise]),pending.then(()=>{throw new Error('Host completed before the Provider read entered');})]),'Provider read entry and complete HTTP body',t.signal);
    assert.equal(runtime.connectionState('readfixture','local').active,1);assert.equal(providerSignal?.aborted,false);
    trace.push('caller-cancelled');caller.abort(new Error('Synthetic caller cancellation'));
    const stopped=await bounded(pending,'cancelled Host call',t.signal),stoppedResult=stopped.result??stopped;
    assert.notEqual(stoppedResult.status,'ok');assert.equal(stoppedResult.error.retryPolicy,'read_retry');
    await bounded(providerCancelled.promise,'HTTP response close must cancel the actual Provider read',t.signal);assert.equal(providerSignal?.aborted,true);
    await bounded(runtimeSettled.promise,'cancelled Runtime settlement',t.signal);
    assert.equal(runtime.connectionState('readfixture','local').active,0,'actual execution must release its connection slot');
    const cancelled=store.get<InvocationRecord>('invocations','cancelled-read')!;
    assert.equal(cancelled.state,'settled');assert.equal(cancelled.result?.status,'unavailable');assert.ok(cancelled.result&&'error'in cancelled.result);assert.equal(cancelled.result.error.code,'CALL_ABORTED');

    const nextArgs=args('fresh-read'),next:any=await bounded(invoke.execute(nextArgs,{agent,signal:AbortSignal.any([requests.signal,t.signal])}),'fresh Host read',t.signal);
    const model=JSON.parse(invoke.output.render(nextArgs,next).map(part=>part.text).join(''));
    assert.equal(model.status,'ok');assert.deepEqual(model.data,resultData);assert.equal(model.invocationId,'fresh-read');assert.equal(providerCalls,2);
    assert.equal(runtime.connectionState('readfixture','local').active,0);assert.equal(store.get<InvocationRecord>('invocations','fresh-read')?.state,'settled');
    assert.equal(store.list('operations').length,0,'both calls are read-only');assert.equal(http.length,2,'one cancelled query and one explicit new query');
  }catch(error){testError=error;t.diagnostic(JSON.stringify({trace}));throw error;}finally{
    const errors:unknown[]=[];
    for(const dispose of cleanup.reverse())try{await bounded(Promise.resolve().then(dispose),'fixture cleanup');}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError([...(testError?[testError]:[]),...errors],'Read-cancellation fixture cleanup failed');
  }
});
