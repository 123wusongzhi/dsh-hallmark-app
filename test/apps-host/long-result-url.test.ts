import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema,type JsonValue} from '../../packages/app-contracts/src/index.ts';

test('legal Unicode and escaped result paths reconstruct through registered HTTP reads without URL overflow',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),agent={id:'reader'},tools=new Map<string,NativeGatewayTool>();let data:JsonValue={},calls=0;
 runtime.register({manifest:{manifestVersion:1,appId:'fixture',displayName:'Fixture',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['row']},descriptors:[{capabilityId:'fixture.query',version:'1.0.0',title:'Query',description:'Fixture',effect:'query',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:5000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]}],async execute(context){calls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data};},async dispose(){}});
 runtime.addConnection({appId:'fixture',connectionId:'C1',displayName:'C1',config:{},enabled:true,configRevision:1});runtime.bind({sessionId:agent.id,appId:'fixture',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const token='fixture-token'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}`;
 const host=new AppsHost({agents:{get:()=>agent},tools:{register:t=>{tools.set(t.name,t);return()=>{};}}},new HttpAppsHostTransport(url,token));await host.start();host.attachApp('fixture');
 try{
  const inspect=tools.get('apps_inspect')!,invoke=tools.get('apps_invoke')!,validate=compileSchema(inspect.parameters),execution={agent,signal:new AbortController().signal};
  const original='target 中😀\ud800 "\\\n'.repeat(2500),keys=['中'.repeat(1900),'😀'.repeat(950),'中~/'.repeat(700),'x'.repeat(3985)];
  for(const key of keys){
   data={[key]:original};const result:any=await invoke.execute({appId:'fixture',connectionId:'C1',capabilityId:'fixture.query',capabilityVersion:'1.0.0',input:{}},execution);assert.equal(result.result.status,'ok');const view=JSON.parse((invoke.output.render({},result) as {text:string}[])[0].text),path='/data/'+key.replace(/~/g,'~0').replace(/\//g,'~1');
   let args:any={resultRef:view.fullResultRef,path,cursor:'0',limit:100},text='',pages=0;
   for(;;){assert.deepEqual(validate(args),[]);const page:any=await inspect.execute(args,execution);assert.equal(page.kind,'string',JSON.stringify(page));assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);text+=page.text;pages++;if(!page.continuation)break;assert.ok(Number(page.continuation.arguments.cursor)>Number(args.cursor));args=page.continuation.arguments;}
   assert.equal(text,original);assert.ok(pages>1);assert.equal(store.list('datasets').length,calls);console.log(JSON.stringify({case:'exact-long-path',pathLength:path.length,encodedQueryBytes:Buffer.byteLength(new URLSearchParams({path}).toString()),pages}));
   const endpoint=`${url}/v1/results/${encodeURIComponent(view.fullResultRef)}/read`,post=async(body:unknown)=>fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const valid={sessionId:agent.id,path,cursor:'0',limit:100};for(const extra of [{literal:'target'},{fields:['x']},{cursor:1},{cursor:'NaN'},{cursor:'-1'},{limit:201},{limit:1.5},{path:7},{path:'x'.repeat(4001)}])assert.equal((await post({...valid,...extra})).status,400);
   assert.equal((await post({...valid,sessionId:'unbound'})).status,403);
  }
  assert.equal(calls,keys.length,'inspection must not repeat provider execution');
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}
});

test('short GET wire bytes remain unchanged and old peers reject long POST once without GET fallback',async()=>{
 const seen:Array<{method:string;url:string;body:string}>=[];
 const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;seen.push({method:req.method!,url:req.url!,body});if(req.method==='POST'){res.writeHead(404,{'Content-Type':'text/html'});res.end(seen.length===3?'<html>old peer: no such route</html>':'');}else{res.writeHead(200,{'Content-Type':'application/json'});res.end('{"kind":"string","text":"legacy"}');}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');const transport=new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,'t'.repeat(40));
 try{
  const short={resultRef:'result:original',sessionId:'owner',path:'/data/a~1b',cursor:'0',limit:20};assert.deepEqual(await transport.readModelResult(short),{kind:'string',text:'legacy'});
  assert.deepEqual(seen[0],{method:'GET',url:'/v1/results/result%3Aoriginal?'+new URLSearchParams({sessionId:short.sessionId,path:short.path,cursor:'0',limit:'20'}),body:''});
  await assert.rejects(()=>transport.readModelResult({...short,path:'/data/'+'中'.repeat(1900)}),/RESULT_READ_POST_UNAVAILABLE/);assert.equal(seen.length,2);assert.equal(seen[1].method,'POST');assert.equal(seen[1].url,'/v1/results/result%3Aoriginal/read');assert.equal(JSON.parse(seen[1].body).path,'/data/'+'中'.repeat(1900));
  await assert.rejects(()=>transport.readModelResult({...short,path:'/data/'+'中'.repeat(1900)}),/RESULT_READ_POST_UNAVAILABLE/);assert.equal(seen.length,3);assert.equal(seen[2].method,'POST');
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
