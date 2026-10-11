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
test('HTTP pages reuse one authorized request snapshot and reload every later request',async()=>{
const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);runtime.register(new NotesProvider({store}));
runtime.addConnection({appId:'notes',connectionId:'n',displayName:'n',config:{},enabled:true,configRevision:1});
const agent={id:'owner'};runtime.bind({sessionId:agent.id,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
const rows=Array.from({length:100},(_,i)=>({product_id:10000+i,offer_id:`sku-${i}`,stocks:i%7===0?null:{present:i%11,reserved:i%3},status:i%13===0?'unknown':'ready',description:'Точное описание 商品 '.repeat(160),images:Array.from({length:8},(_,j)=>`https://example.invalid/image/${i}/${j}.jpg`),attributes:[{id:85,values:[{dictionary_value_id:12345,value:'精确品牌'}]}],...(i%9===0?{}:{barcode:`barcode-${i}`})}));
const result:any={status:'ok',invocationId:'synthetic-ozon',traceId:'fixture',data:{response:{result:rows,total:rows.length}}};
store.put('invocations',result.invocationId,{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:agent.id}},result});
const projection=projectModelResult(store,result),ref=projection.fullResultRef!;assert.ok(ref);
const token='fixture-token-'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();assert.ok(addr&&typeof addr!=='string');
const tools=new Map<string,any>(),host=new AppsHost({agents:{get:(id:string)=>id===agent.id?agent:undefined},tools:{register:(t:any)=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}} as any,new HttpAppsHostTransport(`http://127.0.0.1:${addr.port}`,token));

try {
 await host.start();const tool=tools.get('apps_inspect');
 const call=async(args:any)=>{const v=await tool.execute(args,{agent,signal:new AbortController().signal});return JSON.parse(tool.output.render(args,v).map((x:any)=>x.text??'').join(''));};
 const args={resultRef:ref,path:'/data',fields:['id','nullable','absent'],limit:1};
 let reads=0;const get=store.get.bind(store);store.get=((collection:string,id:string)=>{if(collection==='datasets')reads++;return get(collection,id);}) as any;
 const set=(data:any)=>store.put('datasets',ref,{result:{...result,data}});
 set([{id:1,nullable:null},{id:2,nullable:0}]);let page=await call(args);assert.deepEqual(page.items[0],{index:0,values:{id:1,nullable:null},missing:['absent']});assert.equal(reads,1,'one source materialization per authorized HTTP request');
 set([{id:10,nullable:null},{id:20,nullable:'unknown'}]);page=await call(page.continuation.arguments);assert.deepEqual(page.items[0],{index:1,values:{id:20,nullable:'unknown'},missing:['absent']});
 store.transaction(()=>{set([{id:90}]);assert.equal(get<any>('datasets',ref).result.data[0].id,90);});assert.equal((await call(args)).items[0].values.id,90);
 assert.throws(()=>store.transaction(()=>{set([{id:99}]);throw Error('rollback');}),/rollback/);assert.equal((await call(args)).items[0].values.id,90);
 store.db.prepare('UPDATE datasets SET value_json=? WHERE id=?').run(JSON.stringify({result:{...result,data:[{id:44}]}}),ref);assert.equal((await call(args)).items[0].values.id,44);
 store.delete('datasets',ref);assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');set([{id:66}]);assert.equal((await call(args)).items[0].values.id,66);
 runtime.bind({sessionId:agent.id,appId:'notes',connectionId:'n',enabled:false,boundAt:new Date().toISOString()});assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');runtime.bind({sessionId:agent.id,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});assert.equal((await call(args)).items[0].values.id,66);
 // The complete-array validation still sees invalid rows beyond this page.
 set([{id:1},...Array.from({length:300},()=>({id:2})),null]);assert.equal((await call(args)).error.code,'RESULT_PROJECTION_REQUIRES_OBJECT_ARRAY');

}finally{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}
});
