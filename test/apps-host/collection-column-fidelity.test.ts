import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {CoreBroker} from '../../packages/core/src/types.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';
import {realDetail} from '../real-data/corpus.ts';

function settledOrAborted<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise<T>((resolve,reject)=>{
  const aborted=()=>{signal.removeEventListener('abort',aborted);reject(signal.reason);};
  signal.addEventListener('abort',aborted,{once:true});
  operation.then(value=>{signal.removeEventListener('abort',aborted);resolve(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
  if(signal.aborted)aborted();
 });
}
async function bounded<T>(label:string,work:(signal:AbortSignal)=>Promise<T>,parent?:AbortSignal,ms=5000):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Fixture deadline: '+label)),ms);
 const signal=AbortSignal.any([controller.signal,...(parent?[parent]:[])]);
 try{return await settledOrAborted(Promise.resolve().then(()=>{signal.throwIfAborted();return work(signal);}),signal);}finally{clearTimeout(timer);}
}
async function listenForFetch(server: ReturnType<typeof createAppsServer>,signal:AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const ready = () => {server.off('error', failed); resolve();};
        const failed = (error: Error) => {server.off('listening', ready); reject(error);};
        server.once('listening', ready); server.once('error', failed);
        server.listen({port:randomInt(20000,65536),host:'127.0.0.1',signal});
      });
      const address=server.address();assert.ok(address&&typeof address!=='string');return `http://127.0.0.1:${address.port}`;
    } catch (error) {
      if (!['EADDRINUSE', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  throw new Error('No free Fetch-compatible fixture port');
}

// Unchanged source recording; selection, loopback endpoints and deadlines are local protocol controls.
// The caller reconstructs the declared SKU columns, then resolves imageRef via the real read-only resource capability.
test('recorded SKU columns retain their named values and null slots through Provider, Runtime and Host reads',{timeout:30000},async t=>{
 const detail=realDetail(3),original=structuredClone(detail);
 const selected:Array<Record<string,any>>=detail.skus.slice(0,3);
 assert.equal(selected.length,3);assert.equal(new Set(selected.map((sku:any)=>sku.sourceSkuId)).size,3);
 // Guard the recorded traits used by this independent oracle; never normalize expected rows with production code.
 assert.equal(detail.sourceDetails?.logistics?.logisticsSku,undefined);
 assert.equal(detail.sourceDetails?.editorFields?.logisticsSku,undefined);
 for(const sku of selected){assert.equal(sku.package??sku.packaging,undefined);assert.equal(sku.sourceSellingPrice,undefined);assert.match(sku.image,/^https?:\/\//);assert.ok(Object.values(sku.properties).every(value=>typeof value==='string'),'recorded attribute values are strings');}
 const expected=selected.map((sku:any)=>({id:sku.sourceSkuId,attributes:structuredClone(sku.properties) as Record<string,string>,imageUrl:sku.image,package:null,sourceDisplayPrice:null}));
 assert.notDeepEqual(expected[0].attributes,expected[1].attributes);assert.notDeepEqual(expected[1].attributes,expected[2].attributes);
 const skuIds=expected.map(sku=>sku.id),lifetime=new AbortController(),testSignal=AbortSignal.any([t.signal,lifetime.signal]);
 let store:RuntimeStore|undefined,runtime:AppsRuntime|undefined,server:ReturnType<typeof createAppsServer>|undefined,host:AppsHost|undefined;
 t.after(async()=>{
  lifetime.abort(new Error('Fixture teardown'));
  const failures:Error[]=[];
  const cleanup=async(label:string,work:()=>Promise<unknown>|unknown)=>{try{await bounded('cleanup '+label,async()=>work());}catch(cause){failures.push(new Error(label+' cleanup failed',{cause}));}};
  await cleanup('Host',()=>host?.dispose());await cleanup('HTTP connections',()=>server?.closeAllConnections());
  await cleanup('HTTP server',async()=>{if(server?.listening)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));});
  await cleanup('Runtime',()=>runtime?.dispose());await cleanup('Store',()=>store?.close());
  if(failures.length)throw new AggregateError(failures,'Fixture cleanup failures');
 });
 store=new RuntimeStore(':memory:');runtime=new AppsRuntime(store);
 const sourceCalls:string[]=[],requests:string[]=[],providerCalls:string[]=[],tools=new Map<string,NativeGatewayTool>();
 const client=new HallmarkClient({baseUrl:'http://127.0.0.1:4173',healthTimeoutMs:5000,readTimeoutMs:5000,healthCacheMs:60000,spillThresholdBytes:Number.MAX_SAFE_INTEGER,
  fetchImpl:(input,init)=>bounded('source fetch',async()=>{
   const url=new URL(String(input));assert.equal(url.origin,'http://127.0.0.1:4173');assert.equal(init?.method,'GET');sourceCalls.push(url.pathname);
   if(url.pathname==='/api/health')return Response.json({service:'hallmark-control'});
   assert.equal(url.pathname,`/api/items/${encodeURIComponent(detail.id)}`,'only the original read-only source detail may be requested');
   return Response.json(detail);
  },AbortSignal.any([testSignal,...(init?.signal?[init.signal]:[])])),
 });
 const forbidden=():never=>{throw new Error('Columnar replay cannot dispatch a business task');};
 const broker:CoreBroker={getStoreTask:forbidden,getListingTask:forbidden,requestId:forbidden};
 const provider=new HallmarkProvider({store:new HallmarkStorePort(store,'columnar'),client,broker}),execute=provider.execute.bind(provider);
 provider.execute=context=>{providerCalls.push(context.request.capabilityId);return execute(context);};runtime.register(provider);
 const agent={id:'columnar-reader'};
 runtime.addConnection({appId:'hallmark',connectionId:'columnar',displayName:'Source replay',config:{},configRevision:1,enabled:true});
 runtime.bind({sessionId:agent.id,appId:'hallmark',connectionId:'columnar',enabled:true,boundAt:new Date().toISOString()});
 const token='synthetic-columnar-control-'.repeat(3);server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 server.prependListener('request',request=>requests.push(`${request.method} ${request.url}`));
 const origin=await bounded('listen',signal=>listenForFetch(server!,signal),testSignal);
 host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}}},new HttpAppsHostTransport(origin,token,(input,init)=>{
  assert.equal(new URL(String(input)).origin,origin);
  return bounded('Runtime HTTP',signal=>fetch(input,{...init,signal}),AbortSignal.any([testSignal,...(init?.signal?[init.signal]:[])]));
 }));
 await bounded('Host start',()=>host!.start(),testSignal);host.attachApp('hallmark');
 const invoke=tools.get('apps_invoke');assert.ok(invoke);
 const call=async(capabilityId:string,input:JsonValue)=>{
  const args={appId:'hallmark',connectionId:'columnar',capabilityId,capabilityVersion:'1.0.0',input};
  const native:any=await bounded('native read',signal=>invoke.execute(args,{agent,signal}),testSignal);
  const text=invoke.output.render(args,native).map(part=>part.text).join('');assert.ok(Buffer.byteLength(text)<=16384);
  const model=JSON.parse(text);assert.equal(model.status,'ok',JSON.stringify(model));assert.deepEqual(model,native.result);return model.data;
 };
 const read=await call('hallmark.collection.read',{id:detail.id,skuIds,limit:3});assert.equal(read.items.length,1);
 const item=read.items[0];assert.equal(item.id,detail.id);assert.equal(item.skus.returned,3);assert.equal(item.skus.total,3);assert.equal(item.skus.nextCursor,null);
 const table=item.skus,columns=table.columns as string[];assert.equal(new Set(columns).size,columns.length);
 for(const name of ['id','sourceDisplayPrice','imageRef','package'])assert.ok(columns.includes(name),name);
 assert.equal(table.rows.length,3);for(const row of table.rows)assert.equal(row.length,columns.length,'null cells occupy their declared columns');
 const reconstructed=table.rows.map((row:unknown[])=>Object.fromEntries(columns.map((column,index)=>[column,row[index]])));
 const imageRead=await call('hallmark.collection.resource.read',{id:detail.id,kind:'images',role:'sku',skuIds,revision:item.revision,limit:10});
 assert.equal(imageRead.nextCursor,null);assert.equal(imageRead.completeness,'complete');
 const actual=reconstructed.map((row:Record<string,unknown>)=>{
  assert.equal(typeof row.imageRef,'string','imageRef must keep the source image identity, never the package/null cell');
  const image=imageRead.items.find((asset:any)=>asset.id===row.imageRef);assert.ok(image,'the named imageRef must resolve through the actual resource read');assert.ok(image.skuIds.includes(row.id));
  const attributeKeys=Object.keys(expected.find(sku=>sku.id===row.id)!.attributes);
  return {id:row.id,attributes:Object.fromEntries(attributeKeys.map(key=>[key,Object.hasOwn(table.common.attributes,key)?table.common.attributes[key]:row[key]])),imageUrl:image.url,package:row.package,sourceDisplayPrice:row.sourceDisplayPrice};
 });
 assert.deepEqual(actual,expected,'each original SKU keeps its attributes, source image and explicit null slots under the declared column names');
 assert.deepEqual(providerCalls,['hallmark.collection.read','hallmark.collection.resource.read']);
 assert.equal(requests.filter(path=>path==='POST /v1/routed-invocations').length,2);
 assert.equal(sourceCalls.filter(path=>path===`/api/items/${encodeURIComponent(detail.id)}`).length,1,'resource resolution uses the same captured detail, without re-querying business services');
 assert.equal(store.list('operations').length,0);assert.deepEqual(detail,original);assert.deepEqual(realDetail(3),original);
});
