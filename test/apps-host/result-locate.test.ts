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

// Keep the new HTTP fixture outside Fetch's forbidden port range, as in the
// existing result-reader CLI integration. Retry only local address collisions.
async function listenForLocator(server:ReturnType<typeof createAppsServer>):Promise<void>{
 for(let attempt=0;attempt<20;attempt++){
  try{
   await new Promise<void>((done,reject)=>{
    const ready=()=>{server.off('error',failed);done();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};
    server.once('listening',ready);server.once('error',failed);server.listen(randomInt(20000,65536),'127.0.0.1');
   });return;
  }catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;}
 }
 throw Error('No free Fetch-compatible locator fixture port');
}

test('emitted literal continuations cross an empty scan window and deliver every exact match through HTTP',{timeout:10000},async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),agent={id:'literal-paging-reader'},tools=new Map<string,NativeGatewayTool>();
 // Non-business protocol text. Each emoji is one code point but two UTF-16 units.
 const literal='😀K',text='p'.repeat(65536)+literal+'q'.repeat(6)+literal+'r'.repeat(6)+literal;
 const expected=[
  {offset:65536,length:2,readCursor:'65280'},
  {offset:65544,length:2,readCursor:'65288'},
  {offset:65552,length:2,readCursor:'65296'},
 ];
 let providerCalls=0,signalQueryStarted!:()=>void,releaseQuery!:()=>void;
 const queryStarted=new Promise<void>(done=>{signalQueryStarted=done;}),queryGate=new Promise<void>(done=>{releaseQuery=done;});
 const token='literal-paging-token'.repeat(4),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 let host:AppsHost|undefined,pendingQuery:Promise<unknown>|undefined;
 try{
  runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['text']},
   descriptors:[{capabilityId:'fixture.query',version:'1.0.0',title:'Text',description:'Synthetic locator paging text',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],
   async execute(context){providerCalls++;signalQueryStarted();await queryGate;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{text}};},async dispose(){}});
  runtime.addConnection({appId:'fixture',connectionId:'local',displayName:'Fixture',config:{},configRevision:1,enabled:true});
  runtime.bind({sessionId:agent.id,appId:'fixture',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  await listenForLocator(server);
  const address=server.address();assert.ok(address&&typeof address!=='string');
  host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
  await host.start();host.attachApp('fixture');
  const execution={agent,signal:AbortSignal.timeout(5000)};
  const invoke=tools.get('apps_invoke')!,invokeArgs={appId:'fixture',connectionId:'local',capabilityId:'fixture.query',capabilityVersion:'1.0.0',input:{}};
  pendingQuery=Promise.resolve(invoke.execute(invokeArgs,execution));
  await Promise.race([queryStarted,pendingQuery.then(()=>{throw Error('Fixture query returned before reaching its Provider');})]);
  releaseQuery();const invoked:any=await pendingQuery;assert.equal(invoked.result.status,'ok');
  const view=JSON.parse(invoke.output.render(invokeArgs,invoked).map(item=>item.text??'').join(''));
  assert.equal(view.completeness,'partial');assert.equal(typeof view.fullResultRef,'string');
  const retained=store.get<any>('datasets',view.fullResultRef);assert.deepEqual(retained?.result,invoked.result);
  const inspect=tools.get('apps_inspect')!,validate=compileSchema(inspect.parameters);
  const read=async(args:any)=>{
   assert.deepEqual(validate(args),[],'Use an executable registered read, including every emitted continuation');
   const raw:any=await inspect.execute(args,execution),rendered=inspect.output.render(args,raw).map(item=>item.text??'').join('');
   assert.ok(Buffer.byteLength(rendered,'utf8')<=16384);const page=JSON.parse(rendered);
   assert.deepEqual(page,raw,'The model must receive the exact locator response');assert.equal(page.error,undefined,rendered);
   return page;
  };
  let args:any={resultRef:view.fullResultRef,path:'/data/text',literal,limit:1,cursor:'0'};
  const actual:any[]=[],pages:any[]=[];
  for(let n=0;;n++){
   assert.ok(n<6,'The finite text must reach a terminal page without repeated cursors');
   const page=await read(args);pages.push(page);
   assert.equal(page.kind,'literal-locations');assert.equal(page.resultRef,view.fullResultRef);assert.equal(page.path,'/data/text');
   assert.equal(page.scanned.from,Number(args.cursor),'Each HTTP page must consume its emitted nonzero cursor');
   assert.equal(page.returned,page.matches.length);assert.equal(page.literalLength,2);assert.equal(page.cursorUnit,'unicode-code-points');
   actual.push(...page.matches);assert.equal(page.done,page.nextCursor===null);
   if(page.nextCursor===null){assert.equal(page.continuation,undefined);assert.equal(page.total,65554);break;}
   assert.ok(Number(page.nextCursor)>Number(args.cursor));assert.equal(page.nextCursor,String(page.scanned.toExclusive));
   assert.deepEqual(page.continuation,{tool:'apps_inspect',arguments:{resultRef:view.fullResultRef,path:'/data/text',literal,cursor:page.nextCursor,limit:1}});
   args=page.continuation.arguments;
  }
  assert.deepEqual(pages.map(page=>page.returned),[0,1,1,1,0],'An empty nonterminal scan page must not end the search');
  assert.deepEqual(pages.map(page=>page.scanned),[
   {from:0,toExclusive:65536},{from:65536,toExclusive:65537},{from:65537,toExclusive:65545},
   {from:65545,toExclusive:65553},{from:65553,toExclusive:65554},
  ]);
  assert.deepEqual(pages.map(page=>page.matches),[[],[expected[0]],[expected[1]],[expected[2]],[]]);
  assert.deepEqual(pages.map(page=>page.done),[false,false,false,false,true]);
  assert.deepEqual(actual,expected,'Full locator traversal must neither lose nor duplicate any match');
  for(const match of actual){
   const context=await read({resultRef:view.fullResultRef,path:'/data/text',cursor:match.readCursor,limit:100});
   assert.equal(context.kind,'string');assert.equal(context.offset,Number(match.readCursor));
   assert.equal(Array.from(context.text as string).slice(match.offset-Number(match.readCursor),match.offset-Number(match.readCursor)+match.length).join(''),literal);
  }
  assert.equal(providerCalls,1,'Continued locate and context reads must use the retained original, never repeat the query');
  assert.deepEqual(store.get('datasets',view.fullResultRef),retained,'Continued reads cannot alter the retained original bytes');
  assert.equal(store.list('datasets').length,1);assert.equal(store.list('operations').length,0);
 }finally{
  releaseQuery();await pendingQuery?.catch(()=>{});
  try{await host?.dispose();}finally{
   try{server.closeAllConnections();if(server.listening)await new Promise<void>(done=>server.close(()=>done()));}finally{
    try{await runtime.dispose();}finally{store.close();}
   }
  }
 }
});
