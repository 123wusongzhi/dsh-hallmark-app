import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {randomInt,randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';

const runFile=promisify(execFile),readerScript=fileURLToPath(new URL('../../scripts/apps-read-result.mjs',import.meta.url));
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
function abortable<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise<T>((done,reject)=>{
    const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
    signal.addEventListener('abort',aborted,{once:true});
    operation.then(value=>{signal.removeEventListener('abort',aborted);done(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
    if(signal.aborted)aborted();
  });
}

test('model fullResultRef downloads exact non-default pages through the real result-reader script and Runtime',{timeout:20000},async t=>{
  const artifactRoot=fileURLToPath(new URL('../../artifacts/result-reader-runtime/',import.meta.url));mkdirSync(artifactRoot,{recursive:true});
  const directory=mkdtempSync(join(artifactRoot,'download-'));let passed=false;
  let store:RuntimeStore|undefined,runtime:AppsRuntime|undefined,server:ReturnType<typeof createAppsServer>|undefined,host:AppsHost|undefined;
  t.after(async()=>{
    try{await host?.dispose();}finally{
      try{server?.closeAllConnections();if(server?.listening)await new Promise<void>(done=>server!.close(()=>done()));}finally{
        try{await runtime?.dispose();}finally{
          try{store?.close();}finally{
            if(passed){assert.ok(resolve(directory).startsWith(resolve(artifactRoot)+sep+'download-'));rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
            else t.diagnostic(`Retained result-reader fixture: ${directory}`);
          }
        }
      }
    }
  });
  store=new RuntimeStore(':memory:');runtime=new AppsRuntime(store);
  const agent={id:'download-reader'},registered=new Map<string,NativeGatewayTool>();
  // Protocol values only; deliberately include Unicode pairs, a lone surrogate and JSON escapes.
  const rows=Array.from({length:5},(_,index)=>({index,label:`row-${index}-中😀`,text:('中😀e\u0301\ud800\udc00\ud800\n"\\').repeat(400),nullable:null,empty:'',emptyArray:[],zero:0,enabled:false}));
  let providerCalls=0;
  runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},
    descriptors:[{capabilityId:'fixture.query',version:'1.0.0',title:'Query',description:'Synthetic transport values',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'array',items:{type:'object'}},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],
    async execute(context){providerCalls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:structuredClone(rows)};},async dispose(){}});
  runtime.addConnection({appId:'fixture',connectionId:'fixture',displayName:'Fixture',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:agent.id,appId:'fixture',connectionId:'fixture',enabled:true,boundAt:new Date().toISOString()});
  const token=randomUUID();server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
  const reads:string[]=[];server.prependListener('request',request=>{if(request.url?.startsWith('/v1/results/'))reads.push(request.url);});
  const url=`http://127.0.0.1:${await listenForFetch(server)}`;
  host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{registered.set(tool.name,tool);return()=>registered.delete(tool.name);}}},new HttpAppsHostTransport(url,token,(input,init)=>{
    assert.equal(new URL(String(input)).origin,url);
    return fetch(input,{...init,signal:AbortSignal.any([t.signal,AbortSignal.timeout(5000),...(init?.signal?[init.signal]:[])])});
  }));
  await abortable(host.start(),AbortSignal.any([t.signal,AbortSignal.timeout(5000)]));host.attachApp('fixture');
  const invoke=registered.get('apps_invoke')!,args={appId:'fixture',connectionId:'fixture',capabilityId:'fixture.query',capabilityVersion:'1.0.0',input:{}};
  const signal=AbortSignal.any([t.signal,AbortSignal.timeout(5000)]),response:any=await abortable(invoke.execute(args,{agent,signal}),signal);
  assert.equal(response.result.status,'ok');
  const rendered=invoke.output.render(args,response).map(part=>part.text).join(''),model=JSON.parse(rendered),fullBytes=Buffer.byteLength(JSON.stringify(response.result),'utf8');
  assert.ok(fullBytes>16384);assert.ok(Buffer.byteLength(rendered,'utf8')<=16384);assert.equal(model.bytes,fullBytes);
  assert.equal(model.sampleTruncated,true);assert.equal(model.completeness,'partial');assert.equal(model.read.arguments.resultRef,model.fullResultRef);
  assert.deepEqual(store.get<{result:unknown}>('datasets',model.fullResultRef)?.result,response.result);assert.equal(providerCalls,1);

  const keyFile=join(directory,'fixture-key');writeFileSync(keyFile,token);
  const recovered:unknown[]=[],cursors:string[]=[],pageLengths:number[]=[];let cursor:string|null=model.read.arguments.cursor;
  while(cursor!==null){
    assert.ok(cursors.length<4,'continuation must terminate');assert.ok(!cursors.includes(cursor),'continuation cursor must not repeat');cursors.push(cursor);
    const prefix=join(directory,`page-${cursors.length}`),requestFile=prefix+'-request.json',outputPath=prefix+'.json';
    writeFileSync(requestFile,JSON.stringify({runtime:{url,keyFile},resultRef:model.fullResultRef,cursor,limit:2,outputPath}));
    let stdout:string,stderr:string;
    try{({stdout,stderr}=await runFile(process.execPath,[readerScript,requestFile],{timeout:5000,signal:t.signal,maxBuffer:1024*1024,windowsHide:true}));}
    catch(error){const failed=error as {stdout?:string;stderr?:string};writeFileSync(prefix+'-stdout.log',failed.stdout??'');writeFileSync(prefix+'-stderr.log',failed.stderr??'');throw error;}
    writeFileSync(prefix+'-stdout.log',stdout);writeFileSync(prefix+'-stderr.log',stderr);assert.equal(stderr,'');
    const saved=readFileSync(outputPath,'utf8'),page=JSON.parse(saved),metadata=JSON.parse(stdout);
    assert.deepEqual(page.items,rows.slice(Number(cursor),Number(cursor)+2),'downloaded page must retain the exact requested slice');
    assert.equal(saved,JSON.stringify(page,null,2)+'\n');assert.equal(page.total,rows.length);assert.equal(page.returned,page.items.length);assert.equal(page.completeness,'partial');
    assert.deepEqual(metadata,{outputPath,total:page.total,returned:page.returned,nextCursor:page.nextCursor,completeness:page.completeness});
    assert.ok(!stdout.includes(rows[0].label),'stdout contains metadata, not downloaded values');assert.equal(providerCalls,1,'downloading a retained result cannot re-invoke the provider');
    recovered.push(...page.items);pageLengths.push(page.returned);cursor=metadata.nextCursor;
  }
  assert.deepEqual(cursors,['0','2','4']);assert.deepEqual(pageLengths,[2,2,1]);assert.deepEqual(recovered,rows);
  assert.equal(Buffer.byteLength(JSON.stringify(recovered),'utf8'),Buffer.byteLength(JSON.stringify(rows),'utf8'));
  assert.deepEqual(reads,cursors.map(value=>`/v1/results/${encodeURIComponent(model.fullResultRef)}?cursor=${value}&limit=2`));assert.equal(store.list('datasets').length,1);
  passed=true;
});
