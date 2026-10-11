import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CoreClient,CoreBroker} from '../../packages/core/src/types.ts';

function writeEvidence(name:string,evidence:unknown){
 const reportDir=process.env.OZON_STOCK_JOIN_REPORT_DIR;
 if(!reportDir)return;
 mkdirSync(reportDir,{recursive:true});
 writeFileSync(join(reportDir,`${name}.json`),JSON.stringify(evidence,null,2));
}

async function run(details:any[],kind='stocks',options:{multiWarehouse?:boolean;secondDetails?:any[]}={}){
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),port=new HallmarkStorePort(store,'C1'),tools=new Map<string,NativeGatewayTool>(),agent={id:'ozon-audit'},token='fixture-token-'.repeat(5),calls:any[]=[];
 const client={storeDataRead:async(storeId:string,input:any)=>{
  calls.push(structuredClone(input));let response:any;
  if(input.path==='/v3/product/list')response={result:{items:input.body.last_id?[{product_id:3},{product_id:4}]:[{product_id:1},{product_id:2}],total:options.secondDetails?4:2,last_id:options.secondDetails&&!input.body.last_id?'page2':'',has_next:!!options.secondDetails&&!input.body.last_id}};
  else if(input.path==='/v3/product/info/list')response={items:input.body.product_id.includes('3')?options.secondDetails:details};
  else if(input.path==='/v2/product/info/stocks-by-warehouse/fbs')response={products:[...new Set(input.body.sku)].flatMap(sku=>(options.multiWarehouse?[8,9]:[8]).map(warehouse_id=>({sku,warehouse_id,present:9,reserved:2}))),has_next:false};
  else throw Error('Unexpected endpoint '+input.path);
  return {status:'ok',raw:{storeId,outcome:'response_received',httpStatus:200,response}};
 }} as unknown as CoreClient;
 runtime.register(new HallmarkProvider({store:port,client,broker:{} as CoreBroker}));
 runtime.addConnection({appId:'hallmark',connectionId:'C1',displayName:'Fixture',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'C1',enabled:true,boundAt:new Date().toISOString()});
 const server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
 try{
  await host.start();host.attachApp('hallmark');const invoke=tools.get('apps_invoke')!;
  const result:any=await invoke.execute({appId:'hallmark',connectionId:'C1',capabilityId:`hallmark.ozon.${kind}`,capabilityVersion:'1.0.0',input:{storeId:'shop',loadAll:true}},{agent,signal:new AbortController().signal});
  const rendered=invoke.output.render({},result) as any[];
  return {result,rendered,calls,snapshots:port.list('complete_snapshots')};
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await runtime.dispose();store.close();}
}
const first={id:1,sku:11,offer_id:'one'},second={id:2,sku:22,offer_id:'two'};
for(const [name,details,expected] of [
 ['duplicate-details',[first,first],'failed'],
 ['missing-detail',[first],'failed'],
 ['duplicate-full-coverage',[first,first,second],'failed'],
 ['duplicate-conflicting-detail',[first,{id:1,sku:99,offer_id:'conflict'}],'failed'],
 ['foreign-detail',[first,{id:3,sku:33,offer_id:'three'}],'failed'],
 ['reordered-details',[second,first],'ok'],
 ['no-sku-detail',[first,{id:2,offer_id:'two'}],'ok'],
] as const)test(`real Host stock completeness: ${name}`,async()=>{
 const evidence=await run([...details]);
 writeEvidence(name,evidence);
 assert.equal(evidence.result.result.status,expected);
 const view=JSON.parse(evidence.rendered[0].text);
 assert.equal(view.status,expected);
 if(expected==='failed'){
  assert.equal(view.error.code,'OZON_PRODUCT_JOIN_INCOMPLETE');assert.equal(view.data,undefined);assert.equal(evidence.snapshots.length,0);
  assert.equal(evidence.calls.length,2,'do not read stock for an incomplete detail join');
 }else{
  assert.equal(view.data.total,2);assert.equal(view.data.cache.stale,false);assert.equal(view.data.cursor,undefined);assert.equal(evidence.snapshots.length,1);
  if(name==='reordered-details')assert.deepEqual(view.data.items.map((row:any)=>row.sku),['22','11']);
  if(name==='no-sku-detail'){assert.equal(view.data.items[1].productId,'2');assert.equal(view.data.items[1].stockAvailable,null);assert.match(view.data.warnings[0],/未知/);}
 }
});
test('existing product join rejects the identical duplicate payload',async()=>{
 const evidence=await run([first,first],'products');assert.equal(evidence.result.result.status,'failed');assert.equal(evidence.result.result.error.code,'OZON_PRODUCT_JOIN_INCOMPLETE');
});

test('normal multi-warehouse stock rows are not treated as duplicate product details',async()=>{
 const evidence=await run([first,second],'stocks',{multiWarehouse:true});
 writeEvidence('multi-warehouse',evidence);
 const view=JSON.parse(evidence.rendered[0].text);assert.equal(view.status,'ok');assert.equal(view.data.total,4);
 assert.deepEqual(view.data.items.map((r:any)=>[r.sku,r.warehouseId]),[['11','8'],['11','9'],['22','8'],['22','9']]);
});
for(const [name,details,expected] of [
 ['cross-page-duplicate',[{id:3,sku:33},{id:3,sku:33}],'failed'],
 ['cross-page-foreign',[first,{id:4,sku:44}],'failed'],
 ['cross-page-valid',[{id:4,sku:44},{id:3,sku:33}],'ok'],
] as const)test(name,async()=>{
 const evidence=await run([first,second],'stocks',{secondDetails:[...details]});
 writeEvidence(name,evidence);
 const view=JSON.parse(evidence.rendered[0].text);assert.equal(view.status,expected);
 if(expected==='failed'){assert.equal(view.error.code,'OZON_PRODUCT_JOIN_INCOMPLETE');assert.equal(evidence.snapshots.length,0);assert.equal(view.data,undefined);}
 else{assert.equal(view.data.total,4);assert.deepEqual(view.data.items.map((r:any)=>r.sku),['11','22','44','33']);}
});
