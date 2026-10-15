import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';

test('registered Host literal locate preserves permissions, exact Unicode, schema and original read contracts',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);runtime.register(new NotesProvider({store}));
 for(const connectionId of ['n','other'])runtime.addConnection({appId:'notes',connectionId,displayName:connectionId,config:{},enabled:true,configRevision:1});
 const agents=new Map(['owner','fork','foreign','unbound'].map(id=>[id,{id}]));
 const bind=(sessionId:string,connectionId='n',enabled=true)=>runtime.bind({sessionId,appId:'notes',connectionId,enabled,boundAt:new Date().toISOString()});
 bind('owner');bind('fork');bind('foreign','other');
 const result={status:'ok',invocationId:'i',traceId:'t',data:{text:'😀\ud83dX\ude00'+'a'.repeat(90000)}};
 store.put('datasets','result:i',{result});store.put('invocations','i',{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:'owner'}},result});
 const token='test-result-locate'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const tools=new Map<string,any>(),host=new AppsHost({agents:{get:(id:string)=>agents.get(id)},tools:{register:(t:any)=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}} as any,new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
 try{
  await host.start();const tool=tools.get('apps_inspect'),validate=compileSchema(tool.parameters);
  const call=async(args:any,session='owner')=>{const v=await tool.execute(args,{agent:agents.get(session),signal:new AbortController().signal});const rendered=tool.output.render(args,v).map((x:any)=>x.text??'').join('');assert.ok(Buffer.byteLength(rendered)<=16384);return JSON.parse(rendered);};
  const args={resultRef:'result:i',path:'/data/text',literal:'\ud83d',limit:1};
  assert.equal(validate(args).length,0);assert.ok(validate({resultRef:'result:i',literal:'a'}).length);
  for(const extras of [{invocationId:'i'},{operationId:'op'}])assert.ok(validate({...extras,literal:'a',path:'/data/text'}).length);
  assert.deepEqual((await call(args)).matches.map((m:any)=>m.offset),[1]);
  assert.deepEqual((await call({...args,literal:'\ude00'})).matches.map((m:any)=>m.offset),[3]);
  assert.deepEqual((await call({...args,literal:'😀'},'fork')).matches.map((m:any)=>m.offset),[0]);
  for(const session of ['foreign','unbound']){const p=await call(args,session);assert.equal(p.error.code,'RESULT_ACCESS_DENIED');assert.equal(JSON.stringify(p).includes('😀'),false);}
  bind('fork','n',false);assert.equal((await call(args,'fork')).error.code,'RESULT_ACCESS_DENIED');
  assert.equal((await call({...args,sessionId:'owner'},'unbound')).error.code,'INVALID_INPUT');
  for(const count of [128,256]){const p=await call({...args,literal:'😀'.repeat(count)});assert.equal(p.kind,'literal-locations');}
  assert.equal((await call({...args,literal:'😀'.repeat(257)})).error.code,'INVALID_INPUT');
  const legacy=await(await fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ai`,{headers:{Authorization:`Bearer ${token}`}})).json();assert.deepEqual(legacy.result,result);
  const original=await call({resultRef:'result:i',path:'/data/text',cursor:'0',limit:100});assert.equal(original.kind,'string');assert.ok(original.text.startsWith('😀\ud83dX\ude00'));
  const longPath='/data/'+'中'.repeat(1500),longLiteral='😀'.repeat(256);
  store.put('datasets','result:i',{result:{...result,data:{text:result.data.text,[longPath.slice(6)]:longLiteral}}});
  const longOriginal=await call({resultRef:'result:i',path:longPath});assert.equal(longOriginal.text,longLiteral);
  const oversizedQuery=new URLSearchParams({sessionId:'owner',path:longPath,literal:longLiteral});
  const tooLong=await fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ai?${oversizedQuery}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(tooLong.status,431);
  const longLocated=await call({resultRef:'result:i',path:longPath,literal:longLiteral});assert.equal(longLocated.kind,'literal-locations');assert.equal(longLocated.matches[0].offset,0);
  const longContext=await call({resultRef:'result:i',path:longPath,cursor:longLocated.matches[0].readCursor});assert.equal(longContext.text,longLiteral);
  // Existing legal-max path GET can itself exceed Node's unchanged header budget.
  const maxPath='/data/'+'中'.repeat(3994);
  store.put('datasets','result:i',{result:{...result,data:{[maxPath.slice(6)]:longLiteral}}});
  assert.ok((await call({resultRef:'result:i',path:maxPath,literal:longLiteral})).error, 'Oversized executable continuation must fail explicitly');
  const oldMaxRead=await fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ai?${new URLSearchParams({sessionId:'owner',path:maxPath})}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(oldMaxRead.status,431);

  store.put('datasets','result:i',{result:{...result,data:{text:'replacement'}}});assert.equal((await call(args)).matches.length,0);
  const transport=(host as any).transport,savedRead=transport.readModelResult.bind(transport);
  transport.readModelResult=async()=>({kind:'string',text:'not a locator response'});
  const unsupported=await call(args);assert.equal(unsupported.error.code,'RESULT_LOCATOR_UNAVAILABLE');assert.equal(JSON.stringify(unsupported).includes('not a locator response'),false);assert.deepEqual(unsupported.error.details.read.arguments,{resultRef:'result:i',path:'/data/text',cursor:'0',limit:100});
  transport.readModelResult=async()=>{throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'),{statusCode:404,details:{status:'failed',error:{code:'RESULT_NOT_FOUND',message:'Missing result',retryPolicy:'never'}}});};
  assert.equal((await call(args)).error.code,'RESULT_NOT_FOUND');
  transport.readModelResult=async()=>({status:'failed',error:{code:'RESULT_ACCESS_DENIED',message:'Denied',retryPolicy:'never'}});
  assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');
  transport.readModelResult=savedRead;
  await runtime.updateConnection({appId:'notes',connectionId:'n',enabled:false,expectedConfigRevision:1});assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');
  store.delete('datasets','result:i');assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}
});

// A full traversal must consume locator cursors even when an intermediate scan finds no matches.
function waitForLocator<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise<T>((done,reject)=>{
  const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
  signal.addEventListener('abort',aborted,{once:true});
  operation.then(value=>{signal.removeEventListener('abort',aborted);done(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
  if(signal.aborted)aborted();
 });
}
async function boundedLocatorCleanup(work:Promise<unknown>,label:string):Promise<unknown>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} did not settle within 2000 ms`)),2000);})]);}
 finally{clearTimeout(timer);}
}
async function listenForLocator(server:ReturnType<typeof createAppsServer>,signal:AbortSignal):Promise<string>{
 for(let attempt=0;attempt<20;attempt++){
  signal.throwIfAborted();
  try{
   await new Promise<void>((done,reject)=>{
    const cleanup=()=>{server.off('listening',ready);server.off('error',failed);signal.removeEventListener('abort',aborted);};
    const ready=()=>{cleanup();done();},failed=(error:Error)=>{cleanup();reject(error);},aborted=()=>{cleanup();reject(signal.reason);};
    server.once('listening',ready);server.once('error',failed);signal.addEventListener('abort',aborted,{once:true});
    server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
   });
   const address=server.address();assert.ok(address&&typeof address!=='string');return `http://127.0.0.1:${address.port}`;
  }catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
 }
 throw new Error('No free Fetch-compatible locator fixture port');
}

test('emitted literal continuations cross an empty scan window and deliver every exact match through HTTP',{timeout:30000},async t=>{
 // Synthetic protocol text; expected offsets count Unicode code points, independently of UTF-16.
 const literal='😀K',text='p'.repeat(65536)+literal+'q'.repeat(6)+literal+'r'.repeat(6)+literal,points=Array.from(text);
 const expected=[{offset:65536,length:2,readCursor:'65280'},{offset:65544,length:2,readCursor:'65288'},{offset:65552,length:2,readCursor:'65296'}];
 assert.equal(points.length,65554);for(const match of expected)assert.equal(points.slice(match.offset,match.offset+match.length).join(''),literal);
 const lifetime=new AbortController(),signal=()=>AbortSignal.any([t.signal,lifetime.signal,AbortSignal.timeout(5000)]);
 let store:RuntimeStore|undefined,runtime:AppsRuntime|undefined,server:ReturnType<typeof createAppsServer>|undefined,host:AppsHost|undefined,pendingQuery:Promise<unknown>|undefined;
 let signalQueryStarted!:()=>void,releaseQuery!:()=>void;
 const queryStarted=new Promise<void>(done=>{signalQueryStarted=done;}),queryGate=new Promise<void>(done=>{releaseQuery=done;});
 t.after(async()=>{
  releaseQuery();lifetime.abort(new Error('Locator fixture teardown'));
  const failures:unknown[]=[],results:string[]=[],cleanup=async(label:string,work:()=>unknown|Promise<unknown>)=>{
   try{await boundedLocatorCleanup(Promise.resolve().then(work),label);results.push(`${label}:closed`);}catch(error){failures.push(error);results.push(`${label}:failed`);}
  };
  await cleanup('Pending query',()=>pendingQuery?.catch(()=>{}));
  await cleanup('Host',()=>host?.dispose());await cleanup('Connections',()=>server?.closeAllConnections());
  await cleanup('Server',()=>server?.listening?new Promise<void>((done,reject)=>server!.close(error=>error?reject(error):done())):undefined);
  await cleanup('Runtime',()=>runtime?.dispose());await cleanup('Store',()=>store?.close());
  t.diagnostic(JSON.stringify({cleanup:results,...(failures.length?{cleanupFailures:failures.map(error=>error instanceof Error?error.message:String(error))}:{})}));
  if(failures.length)throw new AggregateError(failures,'Locator fixture cleanup failed');
 });
 store=new RuntimeStore(':memory:');runtime=new AppsRuntime(store);
 const agent={id:'literal-paging-reader'},tools=new Map<string,NativeGatewayTool>();let providerCalls=0;
 runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['text']},
  descriptors:[{capabilityId:'fixture.query',version:'1.0.0',title:'Text',description:'Synthetic locator paging text',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],
  async execute(context){providerCalls++;signalQueryStarted();await queryGate;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{text}};},async dispose(){}});
 runtime.addConnection({appId:'fixture',connectionId:'local',displayName:'Fixture',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:agent.id,appId:'fixture',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
 const token='literal-paging-token'.repeat(4);server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 const origin=await waitForLocator(listenForLocator(server,AbortSignal.any([t.signal,lifetime.signal])),signal());
 host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(origin,token,(input,init)=>{
  assert.equal(new URL(String(input)).origin,origin);
  return fetch(input,{...init,signal:AbortSignal.any([signal(),...(init?.signal?[init.signal]:[])])});
 }));
 await waitForLocator(host.start(),signal());host.attachApp('fixture');
 const invoke=tools.get('apps_invoke');assert.ok(invoke);
 const invokeArgs={appId:'fixture',connectionId:'local',capabilityId:'fixture.query',capabilityVersion:'1.0.0',input:{}},invokeSignal=signal();
 pendingQuery=Promise.resolve(invoke.execute(invokeArgs,{agent,signal:invokeSignal}));
 await waitForLocator(Promise.race([queryStarted,pendingQuery.then(()=>{throw Error('Fixture query returned before reaching its Provider');})]),invokeSignal);
 releaseQuery();const invoked:any=await waitForLocator(pendingQuery,invokeSignal);
 assert.equal(invoked.result.status,'ok');
 const view=JSON.parse(invoke.output.render(invokeArgs,invoked).map(item=>item.text??'').join(''));
 assert.equal(view.completeness,'partial');assert.equal(typeof view.fullResultRef,'string');
 const retained=store.get<any>('datasets',view.fullResultRef);assert.deepEqual(retained?.result,invoked.result);
 const inspect=tools.get('apps_inspect');assert.ok(inspect);const validate=compileSchema(inspect.parameters);
 const read=async(args:any)=>{
  assert.deepEqual(validate(args),[],'every emitted continuation must be an executable registered read');
  const readSignal=signal(),raw:any=await waitForLocator(inspect.execute(args,{agent,signal:readSignal}),readSignal);
  const rendered=inspect.output.render(args,raw).map(item=>item.text??'').join('');assert.ok(Buffer.byteLength(rendered,'utf8')<=16384);
  const page=JSON.parse(rendered);assert.deepEqual(page,raw);assert.equal(page.error,undefined,rendered);return page;
 };
 let args:any={resultRef:view.fullResultRef,path:'/data/text',literal,limit:1,cursor:'0'};
 const matches:any[]=[],pages:any[]=[],cursors=new Set<string>();let sawEmptyNonterminal=false;
 for(let pageNumber=0;;pageNumber++){
  assert.ok(pageNumber<6,'finite text must terminate without repeated cursors');assert.ok(!cursors.has(args.cursor));cursors.add(args.cursor);
  const page=await read(args);pages.push(page);assert.equal(page.kind,'literal-locations');assert.equal(page.resultRef,view.fullResultRef);assert.equal(page.path,'/data/text');
  assert.equal(page.scanned.from,Number(args.cursor),'Each HTTP page must consume its emitted nonzero cursor');
  assert.equal(page.returned,page.matches.length);assert.equal(page.literalLength,2);assert.equal(page.cursorUnit,'unicode-code-points');
  if(!page.done&&!page.matches.length)sawEmptyNonterminal=true;
  matches.push(...page.matches);assert.equal(page.done,page.nextCursor===null);
  if(page.done){assert.equal(page.continuation,undefined);assert.equal(page.total,65554);break;}
  assert.ok(Number(page.nextCursor)>Number(args.cursor));assert.equal(page.nextCursor,String(page.scanned.toExclusive));
  assert.deepEqual(page.continuation,{tool:'apps_inspect',arguments:{resultRef:view.fullResultRef,path:'/data/text',literal,cursor:page.nextCursor,limit:1}});
  args=page.continuation.arguments;
 }
 t.diagnostic(JSON.stringify({locatorPages:cursors.size,sawEmptyNonterminal}));assert.equal(cursors.size,5);assert.equal(sawEmptyNonterminal,true);
 assert.deepEqual(pages.map(page=>page.returned),[0,1,1,1,0],'An empty nonterminal scan page must not end the search');
 assert.deepEqual(pages.map(page=>page.scanned),[
  {from:0,toExclusive:65536},{from:65536,toExclusive:65537},{from:65537,toExclusive:65545},
  {from:65545,toExclusive:65553},{from:65553,toExclusive:65554},
 ]);
 assert.deepEqual(pages.map(page=>page.matches),[[],[expected[0]],[expected[1]],[expected[2]],[]]);
 assert.deepEqual(pages.map(page=>page.done),[false,false,false,false,true]);
 assert.deepEqual(matches,expected,'Full locator traversal must neither lose nor duplicate any match');
 for(const match of matches){
  const context=await read({resultRef:view.fullResultRef,path:'/data/text',cursor:match.readCursor,limit:100});
  assert.equal(context.kind,'string');assert.equal(context.offset,Number(match.readCursor));
  assert.equal(context.text,points.slice(context.offset,context.offset+context.returned).join(''),'omitting literal reads the unchanged original context');
  const within=match.offset-context.offset;assert.ok(within>=0);assert.equal(Array.from(context.text as string).slice(within,within+match.length).join(''),literal);
 }
 assert.equal(providerCalls,1,'locate and context reads must not repeat the original query');
 assert.deepEqual(store.get('datasets',view.fullResultRef),retained);assert.equal(store.list('datasets').length,1);assert.equal(store.list('operations').length,0);
});
