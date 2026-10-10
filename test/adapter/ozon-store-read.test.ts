import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HallmarkClient} from '../../packages/hallmark-adapter/client.ts';
test('store query gateway uses exact read-only whitelist and never asks for listing task or credentials',async()=>{
 const calls:{path:string;body:any}[]=[];
 const client=new HallmarkClient({fetchImpl:async(url,init)=>{const path=new URL(String(url)).pathname;if(path==='/api/health')return Response.json({service:'hallmark-control'});calls.push({path,body:JSON.parse(String(init?.body))});assert.equal(new Headers(init?.headers).has('Authorization'),false);return Response.json({storeId:'shop',outcome:'response_received',httpStatus:200,response:{items:[]}});}});
 const input={path:'/v5/product/info/prices',requestId:'read-1',agentId:'fixture',body:{limit:20}};
 assert.equal((await client.storeDataRead('shop',input)).status,'ok');assert.equal(calls[0].path,'/api/stores/shop/data/read');
 for(const path of ['/v1/product/import/prices','/v2/products/stocks','https://other.invalid/v3/product/list','/v3/product/list?x=1'])assert.equal((await client.storeDataRead('shop',{...input,path})).error?.code,'ENDPOINT_NOT_ALLOWED');
 assert.equal((await client.storeDataRead('shop',{...input,path:'/v1/actions'})).error?.code,'ENDPOINT_NOT_ALLOWED');assert.equal(calls.length,1);
});
test('upstream authorization errors are failures, never successful empty rows',async()=>{
 const client=new HallmarkClient({fetchImpl:async(url)=>new URL(String(url)).pathname==='/api/health'?Response.json({service:'hallmark-control'}):Response.json({storeId:'shop',outcome:'response_received',httpStatus:403,response:{message:'permission denied'}})});
 const response=await client.storeDataRead('shop',{path:'/v1/actions',method:'GET',body:{},requestId:'read',agentId:'fixture'});assert.equal(response.status,'failed');assert.equal(response.error?.code,'PLATFORM_ERROR');
});

test('separate store data gateway never redirects legacy queries, task platform calls or price writes',async()=>{
 const baseUrl='http://127.0.0.1:4280',ozonDataBaseUrl='http://127.0.0.1:4281',calls:{url:string;method:string;authorized:boolean}[]=[];
 const client=new HallmarkClient({baseUrl,ozonDataBaseUrl,operatorToken:'synthetic-operator',fetchImpl:async(url,init)=>{
  calls.push({url:String(url),method:String(init?.method),authorized:new Headers(init?.headers).has('Authorization')});
  return new URL(String(url)).pathname==='/api/health'?Response.json({service:'hallmark-board'}):Response.json({storeId:'shop',outcome:'response_received',httpStatus:200,response:{items:[]}});
 }});
 const input={path:'/v5/product/info/prices',requestId:'read',agentId:'fixture',body:{limit:20}};
 await client.getStores();await client.getTasks();await client.platformRead('task',input);await client.platformCall('task',{...input,path:'/v1/product/import/prices'});
 await client.submitOrdinaryCnyPrice({operationId:'11111111-1111-4111-8111-111111111111',storeId:'shop',products:[{productId:1,offerId:'offer',price:'12.34'}]});
 await client.storeDataRead('shop',input);await client.readOrderWeights('shop',{dateFrom:'2026-09-01',dateTo:'2026-09-02'});
 assert.deepEqual(calls.map(({url,method})=>({url,method})),[
  {url:`${baseUrl}/api/health`,method:'GET'},
  {url:`${baseUrl}/api/stores`,method:'GET'},
  {url:`${baseUrl}/api/tasks`,method:'GET'},
  {url:`${baseUrl}/api/tasks/task/platform`,method:'POST'},
  {url:`${baseUrl}/api/tasks/task/platform`,method:'POST'},
  {url:`${baseUrl}/api/manual-promotions/operations?storeId=shop`,method:'POST'},
  {url:`${ozonDataBaseUrl}/api/stores/shop/data/read`,method:'POST'},
  {url:`${ozonDataBaseUrl}/api/stores/shop/data/order-weights`,method:'POST'},
 ]);
 assert.equal(calls[5].authorized,true);assert.ok(calls.filter(call=>call.url.startsWith(ozonDataBaseUrl)).every(call=>!call.authorized));
});

test('omitted gateway preserves the existing base URL for both store data routes',async()=>{
 const baseUrl='http://127.0.0.1:4280',urls:string[]=[];
 const client=new HallmarkClient({baseUrl,fetchImpl:async url=>{urls.push(String(url));return Response.json(new URL(String(url)).pathname==='/api/health'?{service:'hallmark-control'}:{storeId:'shop',outcome:'response_received',httpStatus:200,response:{items:[]}});}});
 await client.storeDataRead('shop',{path:'/v1/actions',method:'GET',body:{},requestId:'read',agentId:'fixture'});await client.readOrderWeights('shop',{});
 assert.deepEqual(urls,[`${baseUrl}/api/health`,`${baseUrl}/api/stores/shop/data/read`,`${baseUrl}/api/stores/shop/data/order-weights`]);
});
