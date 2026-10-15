import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt,randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema,type JsonValue} from '../../packages/app-contracts/src/index.ts';

type Wire={method:string;path:string;input:Record<string,unknown>;status:number;body:any};
async function boundedCleanup(work:Promise<unknown>,label:string):Promise<unknown>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} did not settle within 2000 ms`)),2000);})]);}
  finally{clearTimeout(timer);}
}
async function listen(server:ReturnType<typeof createAppsServer>,signal:AbortSignal):Promise<number>{
  for(let attempt=0;attempt<20;attempt++){
    signal.throwIfAborted();
    try{
      await new Promise<void>((resolve,reject)=>{
        const cleanup=()=>{server.off('listening',ready);server.off('error',failed);signal.removeEventListener('abort',aborted);};
        const ready=()=>{cleanup();resolve();},failed=(error:Error)=>{cleanup();reject(error);},aborted=()=>{cleanup();reject(signal.reason);};
        server.once('listening',ready);server.once('error',failed);signal.addEventListener('abort',aborted,{once:true});
        server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
      });
      const address=server.address();assert.ok(address&&typeof address!=='string');return address.port;
    }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
  }
  throw new Error('No free Fetch-compatible fixture port');
}

test('long POST result reads preserve real Runtime validation errors through Host and recover without requerying',{timeout:15000},async t=>{
  const cleanup:Array<{name:string;dispose:()=>void|Promise<unknown>}>=[],wire:Wire[]=[];let testError:unknown;
  const addCleanup=(name:string,dispose:()=>void|Promise<unknown>)=>cleanup.push({name,dispose});
  try{
    const store=new RuntimeStore(':memory:');addCleanup('Store',()=>{store.close();assert.throws(()=>store.list('invocations'),/STORE_CLOSED/);});
    const runtime=new AppsRuntime(store);addCleanup('Runtime',async()=>{await runtime.dispose();assert.equal(runtime.connectionState('readfixture','local').active,0);});
    // These are synthetic protocol controls, not commodity facts or merchant results.
    // Only the key is long: both branches contain identical ordinary JSON values.
    const key='中'.repeat(1000)+'/~',rows=[{slot:0,nullable:null,active:false},{slot:1,nullable:'present',active:true}];
    const data={short:rows,[key]:rows,padding:'result-spill-control '.repeat(1200)};
    let providerCalls=0;
    runtime.register({manifest:{manifestVersion:1,appId:'readfixture',displayName:'Read fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['record']},
      descriptors:[{capabilityId:'readfixture.query',version:'1.0.0',title:'Read',description:'Synthetic result-read protocol control',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],
      async execute(context){providerCalls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:structuredClone(data)};},async dispose(){}});
    const agent={id:'reader'},tools=new Map<string,NativeGatewayTool>();
    runtime.addConnection({appId:'readfixture',connectionId:'local',displayName:'Fixture',config:{},enabled:true,configRevision:1});
    runtime.bind({sessionId:agent.id,appId:'readfixture',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
    const token=randomUUID(),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
    addCleanup('Server',async()=>{server.closeAllConnections();if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));assert.equal(server.listening,false);});
    const requests=new AbortController();addCleanup('Requests',()=>requests.abort());
    const signal=AbortSignal.any([t.signal,requests.signal,AbortSignal.timeout(10000)]);
    const origin=`http://127.0.0.1:${await listen(server,signal)}`;
    const transport=new HttpAppsHostTransport(origin,token,async(input,init)=>{
      const url=new URL(String(input));assert.equal(url.origin,origin);
      const response=await fetch(input,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(5000),...(init?.signal?[init.signal]:[])])});
      if(url.pathname.startsWith('/v1/results/'))wire.push({method:init?.method??'GET',path:url.pathname,input:typeof init?.body==='string'?JSON.parse(init.body):Object.fromEntries(url.searchParams),status:response.status,body:await response.clone().json()});
      return response;
    });
    const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
    addCleanup('Host',async()=>{await host.dispose();assert.equal(tools.size,0);});
    await host.start();host.attachApp('readfixture');
    const invoke=tools.get('apps_invoke')!,inspect=tools.get('apps_inspect')!,validate=compileSchema(inspect.parameters),execution={agent,signal};
    const args={appId:'readfixture',connectionId:'local',capabilityId:'readfixture.query',capabilityVersion:'1.0.0',input:{},invocationId:'original-read',traceId:'original-trace'};
    const native:any=await invoke.execute(args,execution),visible=JSON.parse(invoke.output.render(args,native).map(part=>part.text).join(''));
    assert.equal(native.result?.status??native.status,'ok','the original read must succeed before inspecting its retained result');assert.deepEqual(native.result.data,data);assert.equal(visible.status,'ok');assert.equal(typeof visible.fullResultRef,'string');assert.equal(visible.fullResultRef,'result:original-read');
    const resultRef=visible.fullResultRef,retained=structuredClone(store.get('datasets',resultRef)),invocations=structuredClone(store.list('invocations'));assert.ok(retained);
    const paths=['/data/short','/data/'+key.replace(/~/g,'~0').replace(/\//g,'~1')];
    const read=async(input:Record<string,JsonValue>,method:'GET'|'POST'):Promise<{model:Record<string,any>;request:Wire}>=>{
      assert.deepEqual(validate(input),[]);const before=wire.length;
      const value=await inspect.execute(input,execution),rendered=inspect.output.render(input,value).map(part=>part.text).join('');
      const model:Record<string,any>=JSON.parse(rendered);
      assert.ok(Buffer.byteLength(rendered)<=16384);assert.deepEqual(model,value);
      assert.equal(wire.length,before+1,'one requested read, with no automatic retry or alternate route');
      const request=wire.at(-1)!;assert.equal(request.method,method);assert.equal(request.path,`/v1/results/${encodeURIComponent(resultRef)}${method==='POST'?'/read':''}`);assert.equal(request.input.path,input.path);
      return {model,request};
    };
    const failures:Array<{status:string;error:unknown}>=[];
    for(const [index,path] of paths.entries()){
      const method=index===0?'GET':'POST',base={resultRef,path,limit:1};
      const first=await read(base,method);assert.equal(first.request.status,200);assert.deepEqual(first.model.items,[rows[0]]);
      assert.deepEqual(first.model.continuation,{tool:'apps_inspect',arguments:{...base,cursor:'1'}});
      const second=await read(first.model.continuation.arguments,method);assert.equal(second.request.status,200);assert.deepEqual(second.model.items,[rows[1]]);assert.equal(second.model.nextCursor,null);
      // Both requests are schema-valid; Runtime, rather than a Host stub, rejects the semantic error.
      for(const invalid of [{...base,cursor:'3'},{...base,path:path+'/missing'}]){
        const failed=await read(invalid,method),message='cursor'in invalid?'INVALID_PAGE':'RESULT_PATH_NOT_FOUND';
        assert.equal(failed.request.status,400);
        assert.deepEqual(failed.request.body,{status:'failed',error:{code:'INVALID_REQUEST',message,retryPolicy:'never'}});
        assert.equal(failed.model.status,'failed');assert.deepEqual(failed.model.error,failed.request.body.error,'Host must retain the actual Runtime rejection, not label a supported POST route unavailable');
        assert.doesNotMatch(JSON.stringify(failed.model),/RESULT_READ_POST_UNAVAILABLE|RUNTIME_UNAVAILABLE/);
        failures.push({status:failed.model.status,error:failed.model.error});
      }
      const empty=await read({...base,cursor:'2'},method);assert.equal(empty.request.status,200);assert.deepEqual(empty.model.items,[]);assert.equal(empty.model.returned,0);assert.equal(empty.model.total,2);assert.equal(empty.model.nextCursor,null);assert.equal(empty.model.continuation,undefined);
      const recovered=await read(base,method);assert.equal(recovered.request.status,200);assert.deepEqual(recovered.model.items,[rows[0]],'an explicit corrected read still uses the original retained result');
    }
    assert.deepEqual(failures.slice(0,2),failures.slice(2));
    assert.equal(providerCalls,1);assert.equal(runtime.connectionState('readfixture','local').active,0);assert.equal(store.list('operations').length,0);assert.equal(store.list('datasets').length,1);
    assert.deepEqual(store.get('datasets',resultRef),retained);assert.deepEqual(store.list('invocations'),invocations);
    t.diagnostic(JSON.stringify({providerCalls,reads:wire.map(row=>({method:row.method,status:row.status,error:row.body.error??null}))}));
  }catch(error){testError=error;throw error;}finally{
    const errors:unknown[]=[],results:string[]=[];
    for(const {name,dispose} of cleanup.reverse())try{await boundedCleanup(Promise.resolve().then(dispose),`${name} disposal`);results.push(`${name}:closed`);}catch(error){errors.push(error);results.push(`${name}:failed`);}
    t.diagnostic(JSON.stringify({cleanup:results,...(errors.length?{originalFailure:testError instanceof Error?testError.message:String(testError),cleanupFailures:errors.map(error=>error instanceof Error?error.message:String(error))}:{})}));
    if(errors.length)throw new AggregateError([...(testError?[testError]:[]),...errors],'Result-read fixture cleanup failed');
  }
});
