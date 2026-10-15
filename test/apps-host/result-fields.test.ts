import {uiProduct,uiProducts,uiOzonProduct,uiStore,uiListingPayload,uiFixturePrelude,uiText} from '../real-data/ui-scenarios.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readResultPage} from '../../packages/app-runtime/src/projection.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import {projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';
test('explicit field projection through registered Host and Runtime preserves exact selection semantics',async()=>{
const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);runtime.register(new NotesProvider({store}));
runtime.addConnection({appId:'notes',connectionId:'n',displayName:'n',config:{},enabled:true,configRevision:1});
const agent={id:'owner'};runtime.bind({sessionId:agent.id,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
const rows=Array.from({length:100},(_,i)=>uiOzonProduct({product_id:10000+i,offer_id:`sku-${i}`,stocks:i%7===0?null:{present:i%11,reserved:i%3},status:i%13===0?'unknown':'ready',description:uiProduct({},i%41).title.repeat(160),images:[uiProduct({},i%41).image],attributes:uiListingPayload({},i%41).attributes,...(i%9===0?{}:{barcode:`barcode-${i}`})},i));
const result:any={status:'ok',invocationId:'synthetic-ozon',traceId:'fixture',data:{response:{result:rows,total:rows.length}}};
store.put('invocations',result.invocationId,{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:agent.id}},result});
const projection=projectModelResult(store,result),ref=projection.fullResultRef!;assert.ok(ref);
const token='fixture-token-'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();assert.ok(addr&&typeof addr!=='string');
const tools=new Map<string,any>(),host=new AppsHost({agents:{get:(id:string)=>id===agent.id?agent:undefined},tools:{register:(t:any)=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}} as any,new HttpAppsHostTransport(`http://127.0.0.1:${addr.port}`,token));

try{await host.start();const tool=tools.get('apps_inspect'),validate=compileSchema(tool.parameters),execution={agent,signal:new AbortController().signal};
const call=async(args:any)=>{const value=await tool.execute(args,execution);const text=tool.output.render(args,value).map((x:any)=>x.text??'').join('');assert.ok(Buffer.byteLength(text)<=16384);return JSON.parse(text);};
const set=(value:any)=>store.put('datasets',ref,{result:{...result,data:value}});
const args={resultRef:ref,path:'/data',fields:['id','nullable','absent','status'],limit:1};
set([{id:1,nullable:null,status:'unknown'},{id:2,nullable:0,status:'ready'}]);
const before=store.get<any>('datasets',ref);let p=await call(args);assert.equal(p.kind,'array-projection');assert.equal(p.completeness,'partial');assert.equal(p.rowsCompleteness,'partial');assert.deepEqual(p.items,[{index:0,values:{id:1,nullable:null,status:'unknown'},missing:['absent']}]);assert.deepEqual(p.continuation.arguments,{...args,cursor:'1'});p=await call(p.continuation.arguments);assert.equal(p.items[0].index,1);assert.equal(p.nextCursor,null);assert.deepEqual(store.get<any>('datasets',ref),before);
set([]);p=await call(args);assert.equal(p.rowsCompleteness,'complete');assert.equal(p.completeness,'partial');assert.deepEqual(p.items,[]);
for(const value of [null,{},'text',[{id:1},null],[{id:1},2],[{id:1},[]]]){set(value);assert.equal((await call(args)).error.code,'RESULT_PROJECTION_REQUIRES_OBJECT_ARRAY');}
set([{id:1},...Array.from({length:202},()=>({id:2})),null]);assert.equal((await call(args)).error.code,'RESULT_PROJECTION_REQUIRES_OBJECT_ARRAY','must inspect beyond the first page before returning partial success');
for(const fields of [[],['id','id'],Array.from({length:17},(_,i)=>String(i)),[''],['x'.repeat(257)],[4]])assert.ok(validate({...args,fields}).length);
assert.ok(validate({resultRef:ref,fields:['id']}).length);assert.ok(validate({operationId:'op',fields:['id'],path:'/data'}).length);
const special=JSON.parse('{"__proto__":"own","constructor":null,"a/b":3,"a~b":4,"00":5,"名":"精确","ID":8,"id":7}');assert.throws(()=>set([special]),/UNSAFE_JSON_FIELD/);const fields=Object.keys(special);const projected:any=readResultPage({get:()=>({result:{...result,data:[special]}})} as any,ref,'0',100,{path:'/data',fields});assert.deepEqual(projected.items[0].values,special);assert.deepEqual(projected.items[0].missing,[]);const safe={...special};delete safe.__proto__;delete safe.constructor;set([safe]);p=await call({...args,fields});assert.deepEqual(p.items[0].values,safe);assert.deepEqual(p.items[0].missing,['__proto__','constructor']);
set([{Name:1}]);p=await call({...args,fields:['name']});assert.deepEqual(p.items[0],{index:0,values:{},missing:['name']});
set([{huge:'中'.repeat(20000),id:1}]);p=await call({...args,fields:['huge']});assert.equal(p.error.code,'RESULT_PROJECTION_BUDGET_EXCEEDED');assert.match(p.error.message,/Omit fields/);const original=await call({resultRef:ref,path:'/data/0/huge'});assert.equal(original.kind,'string');assert.ok(original.text.length);
set([{id:1}]);assert.equal((await call({...args,cursor:'2'})).error.code,'INVALID_PAGE');
const longFields=Array.from({length:16},(_,i)=>String(i)+'😀'.repeat(254));p=await call({...args,fields:longFields});assert.equal(p.error.code,'RESULT_PROJECTION_BUDGET_EXCEEDED');assert.ok(!p.continuation);
// Existing branch remains usable; direct original and Host have the same ordinary output.
for(const value of [null,1,'text',{x:1},[{id:1}]]){set(value);assert.deepEqual(await call({resultRef:ref,path:'/data'}),readResultPage(store,ref,'0',100,{path:'/data'}));}
const transport=(host as any).transport,saved=transport.readModelResult.bind(transport);transport.readModelResult=async()=>({kind:'array',items:[]});assert.equal((await call(args)).error.code,'RESULT_PROJECTION_UNAVAILABLE');transport.readModelResult=async()=>({kind:'array-projection',fields:['different']});assert.equal((await call(args)).error.code,'RESULT_PROJECTION_UNAVAILABLE');transport.readModelResult=async()=>{throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'),{statusCode:404,details:{error:'ROUTE_NOT_FOUND'}});};assert.equal((await call(args)).error.code,'RESULT_PROJECTION_UNAVAILABLE');transport.readModelResult=async()=>({status:'failed',error:{code:'EXACT_FAILURE',message:'exact',retryPolicy:'never'}});assert.equal((await call(args)).error.code,'EXACT_FAILURE');transport.readModelResult=saved;
// Legal selection across multiple byte-limited pages retains every exact field and original row.
const many=Array.from({length:200},(_,id)=>({id,text:'中'.repeat(50),other:'excluded'}));set(many);let next:any={...args,fields:['id','text'],limit:200},actual:any[]=[];while(next){p=await call(next);assert.deepEqual(p.fields,['id','text']);assert.equal(p.completeness,'partial');actual.push(...p.items.map((item:any)=>item.values));next=p.continuation?.arguments;}assert.deepEqual(actual,many.map(({id,text})=>({id,text})));
}finally{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}
});
