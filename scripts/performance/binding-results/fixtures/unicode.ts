import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]), strategy=process.argv[3];
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {AppsRuntime,RuntimeStore}=await import(pathToFileURL(root+'/packages/app-runtime/src/index.ts').href);
const {NotesProvider}=await import(pathToFileURL(root+'/packages/app-notes/src/index.ts').href);
const {AppsPresentationService}=await import(pathToFileURL(root+'/packages/app-presentation/src/index.ts').href);
const {createAppsServer}=await import(pathToFileURL(root+'/packages/service/src/apps-server.ts').href);
const {AppsHost,HttpAppsHostTransport}=await import(pathToFileURL(root+'/packages/plugin-apps/src/index.ts').href);
const {projectModelResult}=await import(pathToFileURL(root+'/packages/app-runtime/src/projection.ts').href);
const {compileSchema}=await import(pathToFileURL(root+'/packages/app-contracts/src/index.ts').href);
const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);runtime.register(new NotesProvider({store}));
runtime.addConnection({appId:'notes',connectionId:'n',displayName:'n',config:{},enabled:true,configRevision:1});
const agent={id:'owner'};runtime.bind({sessionId:agent.id,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
const rows=Array.from({length:100},(_,i)=>({product_id:10000+i,offer_id:`sku-${i}`,stocks:i%7===0?null:{present:i%11,reserved:i%3},status:i%13===0?'unknown':'ready',description:'Точное описание 商品 '.repeat(160),images:Array.from({length:8},(_,j)=>`https://example.invalid/image/${i}/${j}.jpg`),attributes:[{id:85,values:[{dictionary_value_id:12345,value:'精确品牌'}]}],...(i%9===0?{}:{barcode:`barcode-${i}`})}));
const result:any={status:'ok',invocationId:'synthetic-ozon',traceId:'fixture',data:{response:{result:rows,total:rows.length}}};
store.put('invocations',result.invocationId,{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:agent.id}},result});
const projection=projectModelResult(store,result),ref=projection.fullResultRef!;assert.ok(ref);
const httpRequests:string[]=[];const token='fixture-token-'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
server.on('request',req=>httpRequests.push(`${req.method} ${req.url}`));
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();assert.ok(addr&&typeof addr!=='string');
const tools=new Map<string,any>(),host=new AppsHost({agents:{get:(id:string)=>id===agent.id?agent:undefined},tools:{register:(t:any)=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}} as any,new HttpAppsHostTransport(`http://127.0.0.1:${addr.port}`,token));

const records:any[]=[];let baseHost:any;
try { await host.start();httpRequests.length=0; const tool=tools.get('apps_inspect');const schemaBytes=Buffer.byteLength(JSON.stringify([...tools.values()].map(t=>({name:t.name,description:t.description,parameters:t.parameters}))));
for (const [name,unit] of [['ascii','abc xyz 123 '],['chinese','商品完整文字'],['emoji','😀🚀🧪'],['combining','éä'],['surrogate','\ud800 x \udc00'],['quotes','\"\\\n'],['short','短é😀']]) {
 const original=unit.repeat(name==='short'?3:Math.max(1,Math.floor((name==='ascii'?100000:150000)*Number(process.env.UNICODE_SCALE??1)))),changed={...result,data:original};store.put('datasets',ref,{result:changed});store.put('invocations',result.invocationId,{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:agent.id}},result:changed});
 let args:any={resultRef:ref,path:'/data',limit:200},out='',calls=0,modelBytes=0,requestBytes=0;const transcript=createHash('sha256');const cpu=process.cpuUsage(),start=performance.now();
 while(args){requestBytes+=Buffer.byteLength(JSON.stringify(args));const v=await tool.execute(args,{agent,signal:new AbortController().signal});const text=tool.output.render(args,v).map((x:any)=>x.text??'').join('');transcript.update(text);const page=JSON.parse(text);assert.ok(!page.error,text);out+=page.text;calls++;modelBytes+=Buffer.byteLength(text);args=page.continuation?.arguments;}
 const elapsedMs=performance.now()-start;assert.equal(out,original);records.push({maxRssKB:process.resourceUsage().maxRSS,memory:process.memoryUsage(),httpRequests:httpRequests.splice(0),scenario:name,calls,modelBytes,requestBytes,elapsedMs,cpu:process.cpuUsage(cpu),transcriptSha256:transcript.digest('hex'),maxRssKB:process.resourceUsage().maxRSS,oracleSha256:createHash('sha256').update(JSON.stringify(out)).digest('hex')});
}
const summary={schemaBytes,sourceRoot:root,fixture:'real Host/HTTP/Runtime; synthetic data; no agent reasoning or native desktop timing',records};console.log(JSON.stringify(summary,null,2));
}finally{await baseHost?.dispose();await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}
