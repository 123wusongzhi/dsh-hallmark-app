import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {projectModelResult,readResultPage} from '../../packages/app-runtime/src/projection.ts';
import {AppsHost,type AppsPluginContext,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {HttpAppsHostTransport} from '../../packages/plugin-apps/src/transport.ts';
import {AppsRuntime} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {compileSchema,type JsonValue} from '../../packages/app-contracts/src/index.ts';

// Execute only the read hints actually returned to the model, against the public
// registered schema, then the real result reader. No guessed shorter paths.
test('every result hint remains executable for legal long and escaped keys',async()=>{
 const store=new RuntimeStore(':memory:'),registered=new Map<string,NativeGatewayTool>(),agent={id:'reader'};
 const ctx={agents:{get:(id:string)=>id===agent.id?agent:undefined},tools:{register:(tool:NativeGatewayTool)=>{registered.set(tool.name,tool);return()=>{};}}} as unknown as AppsPluginContext;
 const runtime=new AppsRuntime(store);let current:JsonValue=null,calls=0;
 runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[{capabilityId:'fixture.query',version:'1.0.0',title:'Query',description:'Local fixture',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],async execute(context){calls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:current};},async dispose(){}});
 runtime.addConnection({appId:'fixture',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});runtime.bind({sessionId:agent.id,appId:'fixture',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const token='fixture-token-'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const host=new AppsHost(ctx,new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));await host.start();host.attachApp('fixture');

 try{
  const tool=registered.get('apps_inspect')!,validate=compileSchema(tool.parameters);
  const execute=async(args:any):Promise<any>=>{assert.deepEqual(validate(args),[],'returned hint must satisfy registered gateway');const page:any=await tool.execute(args,{agent,callId:'read',signal:new AbortController().signal});assert.notEqual(page.status,'failed');assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);return page;};
  const reconstruct=async(args:any):Promise<any>=>{
   let page=await execute(args);
   if(page.kind==='serialized-json'||page.kind==='string'){
    const serialized=page.kind==='serialized-json';let value=page.text;
    while(page.continuation){const previous=Number(page.offset);page=await execute(page.continuation.arguments);assert.ok(Number(page.offset)>previous);value+=page.text;}
    return serialized?JSON.parse(value):value;
   }
   if('value' in page)return page.value;
   const value:any=page.kind==='array'?[]:{};
   while(true){
    if(page.entries)for(const entry of page.entries)Object.defineProperty(value,entry.key,{value:await reconstruct(entry.read.arguments),enumerable:true});
    if(page.items)value.push(...page.items);
    if(page.deferred)for(const entry of page.deferred)value[entry.index]=await reconstruct(entry.read.arguments);
    if(!page.continuation)break;page=await execute(page.continuation.arguments);
   }
   return value;
  };
  const cases:JsonValue[]=[{['x'.repeat(4100)]:'中😀'.repeat(7000)},{['~/'.repeat(1100)]:'z'.repeat(20000)},{['中'.repeat(2000)]:'z'.repeat(20000)},{['p'.repeat(3993)]:['v'.repeat(20000),null]},{['a'.repeat(1990)]:{['b'.repeat(2010)]:'z'.repeat(20000)}},{normal:'v'.repeat(20000),empty:[],unknown:null}];
  for(const data of cases){
   current=data;const invoke=registered.get('apps_invoke')!,execution={agent,signal:new AbortController().signal};
   const response:any=await invoke.execute({appId:'fixture',connectionId:'C1',capabilityId:'fixture.query',capabilityVersion:'1.0.0',input:{}},execution);assert.equal(response.result.status,'ok');
   const view=JSON.parse((invoke.output.render({},response) as Array<{text:string}>)[0].text);assert.equal(view.read.tool,'apps_inspect');assert.ok(Buffer.byteLength(JSON.stringify(view))<=16384);
   const before=calls;assert.deepEqual(await reconstruct(view.read.arguments),response.result);assert.equal(calls,before,'inspection cannot repeat the provider');assert.equal(store.list('datasets').length,calls);
  }
  assert.equal(calls,cases.length);
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}

});

test('serialized reference fallback reconstructs exact JSON at small budgets',()=>{
 const store=new RuntimeStore(':memory:'),data={['中~/'.repeat(900)]:['😀\ud800\n"\\'.repeat(2000),{empty:[],nil:null}]};
 store.put('datasets','result:budget',{result:{status:'ok',invocationId:'budget',traceId:'t',data}});
 try{for(const budget of [512,1024,14000]){
  let cursor='0',text='',pages=0;
  do{const page=readResultPage(store,'result:budget',cursor,20,{path:'/data',budget});assert.equal(page.kind,'serialized-json');assert.ok(Buffer.byteLength(JSON.stringify(page))<=budget);text+=page.text;pages++;if(page.nextCursor!==null)assert.ok(Number(page.nextCursor)>Number(cursor));cursor=page.nextCursor as string;}while(cursor!==null);
  assert.ok(pages>1);assert.deepEqual(JSON.parse(text),data);
 }}finally{store.close();}
});


test('ordinary large short-path arrays and text retain their public page shapes',()=>{
 const store=new RuntimeStore(':memory:');
 try{for(const data of [Array.from({length:50000},(_,i)=>({id:i})), '中😀'.repeat(20000)]){
  store.put('datasets','result:ordinary',{result:{status:'ok',invocationId:'ordinary',traceId:'t',data}});
  const page=readResultPage(store,'result:ordinary','0',1,{path:'/data'});
  assert.equal(page.kind,Array.isArray(data)?'array':'string');assert.equal(page.encoding,undefined);
  if(Array.isArray(data)){assert.equal(page.returned,1);assert.deepEqual(page.items,[{id:0}]);}
  assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);
 }}finally{store.close();}
});

function reconstructBounded(store:RuntimeStore,resultRef:string,path:string,budget:number,limit:number,observed:any[]=[]):unknown {
 const read=(args:any)=>{const page:any=readResultPage(store,args.resultRef,args.cursor,args.limit,{path:args.path,budget});assert.ok(Buffer.byteLength(JSON.stringify(page))<=budget);assert.ok(Array.from(args.path).length<=4000);observed.push(page);if(page.continuation)assert.ok(Number(page.continuation.arguments.cursor)>Number(args.cursor));return page;};
 const recover=(args:any):any=>{
  let page=read(args);const initialKind=page.kind;
  if(initialKind==='string'||initialKind==='serialized-json'){
   let text='';for(let n=0;;n++){assert.ok(n<10000);assert.equal(page.kind,initialKind,'one path must keep its cursor mode');text+=page.text;if(!page.continuation)break;page=read(page.continuation.arguments);}return initialKind==='serialized-json'?JSON.parse(text):text;
  }
  if(Object.hasOwn(page,'value'))return page.value;
  const restored:any=initialKind==='array'?[]:{};
  for(let n=0;;n++){assert.ok(n<10000);assert.equal(page.kind,initialKind,'one path must keep its cursor mode');for(const entry of page.entries??[])Object.defineProperty(restored,entry.key,{value:recover(entry.read.arguments),enumerable:true});if(page.items)restored.push(...page.items);for(const entry of page.deferred??[])restored[entry.index]=recover(entry.read.arguments);if(!page.continuation)break;page=read(page.continuation.arguments);}return restored;
 };
 return recover({resultRef,path,cursor:'0',limit});
}

test('ordinary four-key root retains exact directory recovery at the 512-byte boundary',()=>{
 const store=new RuntimeStore(':memory:'),original={status:'ok',invocationId:'i',traceId:'t',data:'a😀中\ud800Z\udc00\n"\\'.repeat(2500)};
 store.put('datasets','result:i',{result:original});
 try{const pages:any[]=[];assert.deepEqual(reconstructBounded(store,'result:i','',512,100,pages),original);assert.equal(pages[0].kind,'directory');assert.equal(pages.some(page=>page.kind==='serialized-json'),false);assert.equal(pages.filter(page=>page.kind==='directory').length,3);assert.equal(pages.length,363,'preserve the complete baseline read chain, not an unnecessarily serialized root');}
 finally{store.close();}
});

test('ordinary arrays retain all page and deferred-child shapes at the minimum budget',()=>{
 const store=new RuntimeStore(':memory:'),data=Array.from({length:12},(_,i)=>i===9?{note:'😀中'.repeat(300)}:{id:i,label:'x'.repeat(40)}),original={status:'ok',invocationId:'a',traceId:'t',data};
 store.put('datasets','result:a',{result:original});
 try{for(const limit of [1,100]){const pages:any[]=[];assert.deepEqual(reconstructBounded(store,'result:a','',512,limit,pages),original);const arrays=pages.filter(page=>page.path==='/data');assert.ok(arrays.length>1);assert.ok(arrays.every(page=>page.kind==='array'));const deferred=arrays.flatMap(page=>page.deferred??[]);assert.equal(deferred.length,1);assert.equal(deferred[0].index,9);assert.equal(deferred[0].path,'/data/9');assert.equal(pages.some(page=>page.kind==='serialized-json'),false);}}
 finally{store.close();}
});

test('an array serializes from its first page only when a real deferred reference cannot fit',()=>{
 const store=new RuntimeStore(':memory:'),key='p'.repeat(20),path=`/data/${key}`;
 try{for(const values of [[0,false,1],[0,'中'.repeat(200),false]]){
  const original={status:'ok',invocationId:'b',traceId:'t',data:{[key]:values}};store.put('datasets','result:b',{result:original});
  const pages:any[]=[];assert.deepEqual(reconstructBounded(store,'result:b',path,512,1,pages),values);
  const requiresReference=typeof values[1]==='string';assert.ok(pages.length>1);assert.ok(pages.every(page=>page.kind===(requiresReference?'serialized-json':'array')));
  if(requiresReference){assert.equal(pages[0].offset,0);assert.equal(pages[0].originalKind,'array');assert.deepEqual(reconstructBounded(store,'result:b','',512,100),original);}
 }}finally{store.close();}
});

test('business page recovery is executable at the minimum budget and retains exact original evidence',()=>{
 const store=new RuntimeStore(':memory:'),invocationId='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',rowIds=Array.from({length:40},(_,i)=>`${i}-`+'长'.repeat(180));
 const original:any={status:'ok',invocationId,traceId:'trace',data:{planId:'selected-plan',revision:2,rows:[{rowId:rowIds[0],action:'listing',status:'draft'}],page:{offset:0,total:40,returned:1,nextCursor:'1'}}};
 store.put('invocations',invocationId,{request:{appId:'hallmark',connectionId:'original-connection',capabilityId:'hallmark.plan.get',input:{planId:'selected-plan',rowIds,limit:1}}});
 try{for(const budget of [512,1024,16384]){
  const projection=projectModelResult(store,original,budget),view=JSON.parse(projection.content);assert.ok(Buffer.byteLength(projection.content)<=budget);assert.match(view.readInstructions,/current.*next/);assert.equal(view.completeness??view.data.completeness,'incomplete');
  let args=view.read.arguments,text='',pages=0;
  for(;;){const page=readResultPage(store,args.resultRef,args.cursor,args.limit,{path:args.path,budget});assert.equal(page.kind,'string');assert.ok(Buffer.byteLength(JSON.stringify(page))<=budget);text+=page.text;assert.ok(++pages<500);if(!page.continuation)break;args=(page.continuation as any).arguments;}
  const recovery=JSON.parse(text);assert.deepEqual(recovery.next,{tool:'apps_invoke',arguments:{appId:'hallmark',connectionId:'original-connection',capabilityId:'hallmark.plan.get',capabilityVersion:'1.0.0',input:{planId:'selected-plan',rowIds,cursor:'1',limit:20}}});
  assert.equal(recovery.current.arguments.resultRef,projection.fullResultRef);assert.equal(recovery.current.arguments.path,'/data/rows');
  assert.deepEqual(store.get<any>('datasets',projection.fullResultRef!)?.result,original);assert.equal(store.get<any>('datasets',view.read.arguments.resultRef)?.result.invocationId,invocationId);
 }}finally{store.close();}
});

for(const failedRecord of ['original','next-page'])test(`business page recovery reports ${failedRecord} retention failure explicitly`,()=>{
 const store=new RuntimeStore(':memory:'),rowIds=Array.from({length:40},(_,i)=>`${i}-`+'长'.repeat(180)),invocationId='save-failure';
 store.put('invocations',invocationId,{request:{appId:'hallmark',connectionId:'C1',capabilityId:'hallmark.plan.get',input:{planId:'P1',rowIds,limit:1}}});
 const put=store.put.bind(store);store.put=(table,id,value)=>{if(table==='datasets'&&(failedRecord==='original'?!id.endsWith(':page'):id.endsWith(':page')))throw Error('retention unavailable');return put(table,id,value);};
 try{
  const projection=projectModelResult(store,{status:'ok',invocationId,traceId:'T1',data:{planId:'P1',revision:1,rows:[{rowId:rowIds[0],action:'listing',status:'draft'}],page:{offset:0,total:40,returned:1,nextCursor:'1'}}},512),view=JSON.parse(projection.content);
  assert.ok(Buffer.byteLength(projection.content)<=512);assert.equal(view.status,'failed');assert.equal(view.error.code,'RESULT_SPILL_FAILED');assert.notEqual(view.completeness,'complete');assert.equal(projection.fullResultRef,undefined);
 }finally{store.close();}
});
