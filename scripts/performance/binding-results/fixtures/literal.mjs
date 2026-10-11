import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {fork} from 'node:child_process';
import {once} from 'node:events';
if(process.env.SPLIT_SERVICE==='1')throw new Error('This fresh-base task harness supports one process only; timings are diagnostic.');
const root=resolve(process.argv[2]??'.'),out=process.argv[3];
const {AppsRuntime,RuntimeStore}=await import(pathToFileURL(root+'/packages/app-runtime/src/index.ts').href);
const {AppsPresentationService}=await import(pathToFileURL(root+'/packages/app-presentation/src/index.ts').href);
const {createAppsServer}=await import(pathToFileURL(root+'/packages/service/src/apps-server.ts').href);
const {AppsHost,HttpAppsHostTransport}=await import(pathToFileURL(resolve(process.env.HOST_ROOT??root)+'/packages/plugin-apps/src/index.ts').href);
const clauses=Array.from({length: Number(process.env.CLAUSES??240)},(_,i)=>`条款${String(i+1).padStart(3,'0')}：本段仅适用于款式 ${i+1} 的独立包装，不修改其他条款。包装面应保留来源 SKU、材料批次及数量；标注尺寸为外包装尺寸，重量包含包装。收到退货时先核对原包装封条和批次，不能用商品名称推定规格一致。字符样本：😀𠮷e\u0301。`);
clauses[Math.min(37,clauses.length-1)]='条款038：冷藏运输仅适用于封口完好的红色 SKU；运输温度保持 2～8℃。若封条破损，停止交付并登记批次；此要求不适用于蓝色 SKU。';
clauses[Math.min(213,clauses.length-1)]='条款214：蓝色 SKU 不要求冷藏运输，须常温运输且避免暴晒。若与红色 SKU 合箱，分别包装并按各自温度要求处理，不能把蓝色 SKU 也改成冷藏。';
const scenario=process.env.SCENARIO??'catalog';
if(scenario==='boundary'){clauses.length=0;clauses.push('a'.repeat(65533), '冷藏运输😀\u0000：跨扫描窗口完整诊断，保留否定：不可按已审核处理。', 'b'.repeat(70000));}
if(scenario==='unicode'){clauses.length=0;clauses.push('诊断：😀e\u0301é\ud800X\udc00，冷藏运输\u0000已记录；不可推定可售。', '第二条：冷藏运输仅供定位。');}
if(scenario==='empty'){clauses.length=0;}
const description=clauses.join('\n\n'),literal=process.env.LITERAL??'冷藏运输';
const expected=clauses.filter(x=>x.includes(literal));
const database=new RuntimeStore(':memory:'),runtime=new AppsRuntime(database),token='synthetic-only-result-locate-token-'.repeat(3);
const {NOTES_DESCRIPTORS}=await import(pathToFileURL(root+'/packages/app-notes/src/index.ts').href);let providerCalls=0;runtime.register({manifest:{manifestVersion:1,appId:'notes',displayName:'Synthetic Ozon text',providerPackage:'fixture',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:['note']},descriptors:[{...NOTES_DESCRIPTORS[0],outputSchema:{type:'object'}}],async execute(context){providerCalls++;return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{description,unrelatedDiagnostics:'fixture-padding ' .repeat(2000)}};},async dispose(){}});
runtime.addConnection({appId:'notes',connectionId:'n',displayName:'n',config:{backend:'synthetic'},enabled:true,configRevision:1});
runtime.bind({sessionId:'A',appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
const result={status:'ok',invocationId:'original',traceId:'trace',data:{source:'Synthetic independently scoped catalog clauses; all context is in each double-newline paragraph.',description}};
let resultRef;
const posts=[];
const server=createAppsServer({runtime,presentation:new AppsPresentationService({store:database,runtime}),token});
server.on('request',(req)=>{if(req.method==='POST')posts.push(new URL(req.url,'http://localhost').pathname);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
if(process.env.SERVICE_CHILD==='1'){
 let base=process.cpuUsage();
 process.on('message',message=>{
  if(message==='begin'){base=process.cpuUsage();process.send({ready:true});}
  if(message==='end'){const used=process.cpuUsage(base);process.send({serviceCpuMs:(used.user+used.system)/1000,readOnlyLocatePosts:posts.filter(x=>x.endsWith('/locate')).length,otherPosts:posts.filter(x=>!x.endsWith('/locate')),invocationRecords:database.list('invocations').length,datasetRecords:database.list('datasets').length});}
  if(message==='close')server.closeAllConnections(),server.close(async()=>{await runtime.dispose();database.close();process.exit(0);});
 });
 process.send({port:server.address().port});
}else{
 const child=process.env.SPLIT_SERVICE==='1'?fork(new URL(import.meta.url),[root],{env:{...process.env,SERVICE_CHILD:'1'},stdio:['ignore','ignore','inherit','ipc']}):null;
 const childPort=child?(await once(child,'message'))[0].port:server.address().port;
 const childMessage=async message=>{const pending=once(child,'message');child.send(message);return (await pending)[0];};
const tools=new Map(),agent={id:'A'},host=new AppsHost({agents:{get:id=>id==='A'?agent:undefined},tools:{register:t=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${childPort}`,token));
const trace=[];let schemaBytes=0,inspectSchemaBytes=0;
async function call(args){const tool=tools.get('apps_inspect'),value=await tool.execute(args,{agent,signal:new AbortController().signal}),render=tool.output.render(args,value).map(x=>x.text??'').join('');assert.ok(Buffer.byteLength(render)<=16384);const page=JSON.parse(render);trace.push({args,bytes:Buffer.byteLength(render),rendered:page});return page;}
try{
 await (async()=>{
 await host.start();const inspect=tools.get('apps_inspect');inspectSchemaBytes=Buffer.byteLength(JSON.stringify({name:inspect.name,description:inspect.description,parameters:inspect.parameters}));schemaBytes=Buffer.byteLength(JSON.stringify([...tools.values()].map(t=>({name:t.name,description:t.description,parameters:t.parameters}))));host.attachApp('notes');const invoked=await tools.get('apps_invoke').execute({appId:'notes',connectionId:'n',capabilityId:'notes.notes.list',capabilityVersion:'1.0.0',input:{}},{agent,signal:new AbortController().signal});assert.equal(invoked.result.status,'ok');resultRef=invoked.modelProjection.fullResultRef;assert.ok(resultRef);if(child)await childMessage('begin');const cpu=process.cpuUsage(),start=performance.now();let cursor='0',answer;
 if(process.env.LOCATE==='1'){
  const matches=[];
  do{const page=await call({resultRef,path:'/data/description',literal,cursor,limit:100});if(process.env.EXPECT_UNSUPPORTED==='1'){assert.equal(page.error.code,'RESULT_LOCATOR_UNAVAILABLE');assert.deepEqual(page.error.details.read.arguments,{resultRef,path:'/data/description',cursor:'0',limit:100});let original=await call(page.error.details.read.arguments),restored=original.text;while(original.nextCursor!==null){original=await call(original.continuation.arguments);restored+=original.text;}assert.equal(restored,description);console.log(JSON.stringify({compatibility:'new Host / old Runtime',error:page.error.code,fallbackExact:true,toolCalls:trace.length}));process.exitCode=0;return;}assert.equal(page.kind,'literal-locations',JSON.stringify(page));matches.push(...page.matches);cursor=page.nextCursor;assert.equal(page.done,cursor===null);if(cursor!==null){assert.deepEqual(page.continuation,{tool:'apps_inspect',arguments:{resultRef,path:'/data/description',literal,cursor,limit:100}});}}while(cursor!==null);
  const paragraphs=[];
  for(const match of matches){
   let page=await call({resultRef,path:'/data/description',cursor:match.readCursor,limit:100}),text=page.text;
   const relative=match.offset-Number(match.readCursor),prefix=Array.from(text).slice(0,relative).join('');
   const start=prefix.lastIndexOf('\n\n')+2;
   assert.ok(start>=2||Number(match.readCursor)===0,'Full paragraph start must be visible, not inferred');
   let end=text.indexOf('\n\n',prefix.length);
   while(end<0&&page.nextCursor!==null){page=await call({resultRef,path:'/data/description',cursor:page.nextCursor,limit:100});text+=page.text;end=text.indexOf('\n\n',prefix.length);}
   paragraphs.push(text.slice(start>=2?start:0,end<0?undefined:end));
  }
  answer=[...new Set(paragraphs)];
 }else if(process.env.RAW==='1'){
  const response=await fetch(`http://127.0.0.1:${childPort}/v1/results/${encodeURIComponent(resultRef)}`,{headers:{authorization:`Bearer ${token}`}});assert.equal(response.status,200);const raw=await response.text();const page=JSON.parse(raw);assert.equal(page.result.data.description,description);trace.push({args:{route:'legacy-full-result-GET'},bytes:Buffer.byteLength(raw),rendered:{omitted:'Full transport payload consumed by local code, not model renderer'}});answer=page.result.data.description.split('\n\n').filter(x=>x.includes(literal));
 }else{
  let restored='';do{const page=await call({resultRef,path:'/data/description',cursor,limit:100});assert.equal(page.kind,'string',JSON.stringify(page));restored+=page.text;cursor=page.nextCursor;}while(cursor!==null);
  assert.equal(restored,description);answer=restored.split('\n\n').filter(x=>x.includes(literal));
 }
 assert.deepEqual(answer,expected);
 const serviceMetrics=child?await childMessage('end'):{};const used=process.cpuUsage(cpu),report={variant:process.env.RAW==='1'?'existing-legacy-local-code-full-GET':process.env.LOCATE==='1'?'literal-locate-plus-original-reader':'existing-complete-reader',fixture:'synthetic independently scoped catalog clauses, not live merchant evidence',root,literal,inputBytes:Buffer.byteLength(description),inputHash:createHash('sha256').update(description).digest('hex'),scenario,providerCalls,task:'Find every paragraph in the known description string containing the exact literal and quote the complete paragraph including exclusions.',answer,toolCalls:process.env.RAW==='1'?null:trace.length,httpReads:process.env.RAW==='1'?trace.length:undefined,schemaBytes,inspectSchemaBytes,requestBytes:trace.reduce((n,x)=>n+Buffer.byteLength(JSON.stringify(x.args)),0),renderedBytes:trace.reduce((n,x)=>n+x.bytes,0),totalTaskBytes:schemaBytes+trace.reduce((n,x)=>n+x.bytes+Buffer.byteLength(JSON.stringify(x.args)),0),timingScope:'Setup and initial provider invocation excluded; complete inspection and answer oracle included',maxRenderedBytes:Math.max(...trace.map(x=>x.bytes)),elapsedMs:performance.now()-start,...(child?{hostProcessCpuMs:(used.user+used.system)/1000,...serviceMetrics}:{hostAndServiceProcessCpuMs:(used.user+used.system)/1000}),trace};
 if(out)writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,trace:undefined}));
 })();
}finally{if(child){child.send('close');await once(child,'exit');}await host.dispose();server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.dispose();database.close();}

}
