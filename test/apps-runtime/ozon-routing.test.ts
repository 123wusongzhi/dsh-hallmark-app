import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateHallmarkConnection} from '../../packages/app-hallmark/src/index.ts';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import type {InvocationRequest,JsonValue} from '../../packages/app-contracts/src/index.ts';

test('optional Ozon gateway accepts only the same literal loopback origins as the primary backend',()=>{
 const baseUrl='http://127.0.0.1:4280';
 assert.doesNotThrow(()=>validateHallmarkConnection({baseUrl}));
 for(const ozonDataBaseUrl of ['http://127.0.0.1:4281','http://[::1]:4281/']){
  assert.doesNotThrow(()=>validateHallmarkConnection({baseUrl,ozonDataBaseUrl}));
  assert.equal(new HallmarkClient({baseUrl,ozonDataBaseUrl}).ozonDataBaseUrl,new URL(ozonDataBaseUrl).origin);
 }
 const invalid:JsonValue[]=[null,123,true,{},[],'','http://localhost:4281','https://example.com','http://127.1:4281','http://user:secret@127.0.0.1:4281','http://127.0.0.1:4281/api','http://127.0.0.1:4281/?token=x','http://127.0.0.1:4281/#x','file:///tmp/data'];
 for(const ozonDataBaseUrl of invalid){
  assert.throws(()=>validateHallmarkConnection({baseUrl,ozonDataBaseUrl}));
  assert.throws(()=>new HallmarkClient({baseUrl,ozonDataBaseUrl:ozonDataBaseUrl as string}));
 }
});

async function backend(price:number){
 const calls:string[]=[];
 const server=createServer(async(req,res)=>{
  calls.push(req.url!);res.setHeader('Content-Type','application/json');
  if(req.url==='/api/health')return res.end(JSON.stringify({service:'hallmark-board'}));
  if(req.url==='/api/stores')return res.end(JSON.stringify([{id:'shop',shopName:'Shared shop'}]));
  if(req.url==='/api/stores/shop/data/read'){
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
   assert.equal(JSON.parse(Buffer.concat(chunks).toString()).path,'/v5/product/info/prices');
   return res.end(JSON.stringify({storeId:'shop',outcome:'response_received',httpStatus:200,response:{items:[{product_id:1,offer_id:'offer',price:{price:String(price),marketing_seller_price:String(price),currency_code:'CNY'}}],total:1}}));
  }
  res.statusCode=404;res.end('{}');
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('PORT_REQUIRED');
 return {url:`http://127.0.0.1:${address.port}`,calls,async close(){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
function query(capabilityId:string,input:InvocationRequest['input']={}):InvocationRequest{return {protocolVersion:'1.0',appId:'hallmark',connectionId:'h',invocationId:randomUUID(),traceId:randomUUID(),capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId:'s',nativeCallId:randomUUID()},deadlineAt:new Date(Date.now()+10000).toISOString()};}

test('runtime wiring and controlled updates route Ozon data independently without duplicating the connection',async()=>{
 const primary=await backend(100),gateway=await backend(200),directory=mkdtempSync(join(tmpdir(),'apps-ozon-routing-'));
 const instance=composeAppsRuntime(directory,{connections:[{appId:'hallmark',connectionId:'h',displayName:'Shared platform',config:{baseUrl:primary.url,ozonDataBaseUrl:gateway.url},configRevision:1,enabled:true}]});
 try{
  instance.runtime.bind({sessionId:'s',appId:'hallmark',connectionId:'h',enabled:true,boundAt:new Date().toISOString()});
  const stores=await instance.runtime.invoke(query('hallmark.stores.list'));assert.equal(stores.status,'ok');assert.deepEqual('data' in stores?stores.data:null,[{id:'shop',shopName:'Shared shop'}]);
  const first=await instance.runtime.invoke(query('hallmark.ozon.prices',{storeId:'shop',limit:20}));assert.equal(first.status,'ok');assert.equal((first as unknown as {data:{items:{price:number}[]}}).data.items[0].price,200);
  assert.deepEqual(gateway.calls,['/api/stores/shop/data/read']);assert.ok(!primary.calls.includes('/api/stores/shop/data/read'));
  await assert.rejects(instance.runtime.updateConnection({appId:'hallmark',connectionId:'h',expectedConfigRevision:1,config:{baseUrl:primary.url,ozonDataBaseUrl:'https://external.invalid'}}));assert.equal(instance.runtime.getConnection('hallmark','h')?.configRevision,1);
  const active=await instance.runtime.updateConnection({appId:'hallmark',connectionId:'h',expectedConfigRevision:1,config:{baseUrl:primary.url}});assert.equal(active.configRevision,2);
  const second=await instance.runtime.invoke(query('hallmark.ozon.prices',{storeId:'shop',limit:20}));assert.equal(second.status,'ok');assert.equal((second as unknown as {data:{items:{price:number}[]}}).data.items[0].price,100);
  assert.deepEqual(gateway.calls,['/api/stores/shop/data/read']);assert.equal(primary.calls.filter(path=>path==='/api/stores/shop/data/read').length,1);
 }finally{await instance.close();await primary.close();await gateway.close();rmSync(directory,{recursive:true,force:true});}
});
