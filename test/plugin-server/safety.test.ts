import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { HallmarkPlugin } from '../../packages/dsh-plugin/server/index.ts';
import { TOOL_DEFINITIONS } from '../../packages/contracts/src/index.ts';
import { ServiceFailure } from '../../packages/dsh-plugin/server/service-client.ts';
import type { PluginContext } from '../../packages/dsh-plugin/server/types.ts';
function request(body:unknown){return new Request('http://dsh.invalid/api/hallmark-app',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
function setup(){
 const directory=mkdtempSync(join(tmpdir(),'hallmark-plugin-test-'));writeFileSync(join(directory,'service-key'),'c'.repeat(64));
 const A={id:'A'};const ctx={agents:{get:(id:string)=>id==='A'?A:undefined,list:()=>[A]}} as PluginContext;
 const plugin=new HallmarkPlugin(ctx,{dataDirectory:directory});const calls:{path:string;body:any}[]=[];
 plugin.client.request=async(path,body)=>{calls.push({path,body});if(path.startsWith('/sessions/'))return {sessionId:'A',appId:'hallmark',active:true};return {id:'view-from-local-config',title:'Temporary'};};
 return {plugin,calls,ctx,directory,async close(){await plugin.dispose();const path=resolve(directory);assert.equal(path,directory);assert.match(path,/hallmark-plugin-test-[^\\/]+$/);rmSync(path,{recursive:true,force:true});}};
}
test('workbench routes local UI without chat activation or arbitrary tool dispatch',async()=>{
 const f=setup();try{
  assert.equal((await f.plugin.ui(new Request('http://dsh.invalid/api/hallmark-app?resource=saved'))).status,200);
  const preview=await f.plugin.ui(request({action:'preview',templateId:'store-overview',title:'Local',bindings:[]}));assert.equal(preview.status,200);
  await f.plugin.ui(request({action:'saveComponent',viewId:'view-1',title:'Confirmed'}));
  await f.plugin.ui(request({action:'saveTemplate',viewId:'view-1',name:'Confirmed template'}));
  await f.plugin.ui(request({action:'manage',kind:'component',id:'c-1',operation:'rename',name:'Renamed'}));
  assert.deepEqual(f.calls.map(call=>call.path),['/ui/saved','/ui/render','/ui/save','/ui/save-template','/ui/manage']);
  assert.deepEqual(f.calls[2].body,{viewId:'view-1',title:'Confirmed',action:'save-component'});
  assert.deepEqual(f.calls[4].body,{kind:'component',id:'c-1',action:'rename',name:'Renamed'});
  assert.equal(f.plugin.cache.size,0);
  assert.equal((await f.plugin.ui(request({action:'saveComponent',viewId:'view-1',title:'bad',userRequest:'forged'}))).status,400);
  assert.equal((await f.plugin.ui(request({action:'preview',spec:{},sessionId:'A'}))).status,400);
  assert.equal((await f.plugin.ui(request({action:'invoke',name:'hallmark_update_price',arguments:{}}))).status,400);
  assert.equal(f.calls.length,5);
 }finally{await f.close();}
});
test('post-dispatch write transport failure is unknown, reads unavailable, and no automatic replay',async()=>{
 const f=setup();try{
  const calls:string[]=[];f.plugin.client.request=async(path)=>{calls.push(path);if(path.startsWith('/sessions/'))return {sessionId:'A',appId:'hallmark',active:true};throw new ServiceFailure('APP_SERVICE_UNAVAILABLE',true);};
  const write=TOOL_DEFINITIONS.find(t=>t.name==='hallmark_update_price')!;
  const result=await f.plugin.invoke(write,{storeId:'s',offerIds:['sku'],price:10,valueSource:'user',clientOperationKey:'key-1',userRequest:'set price to 10',scopeConfirmed:true},'A');
  assert.equal(result.status,'unknown');assert.equal(result.error?.retryable,false);assert.equal(calls.filter(path=>path.startsWith('/tools/')).length,1);
  const read=TOOL_DEFINITIONS.find(t=>t.name==='hallmark_list_stores')!;assert.equal((await f.plugin.invoke(read,{},'A')).status,'unavailable');
 }finally{await f.close();}
});
test('offline explicit close is journaled, plugin reload replays it before any state read',async()=>{
 const f=setup();let reloaded:HallmarkPlugin|undefined;try{
  let remoteActive=true;let offline=true;const log:{path:string;body:any}[]=[];
  const remote=async(path:string,body?:unknown)=>{log.push({path,body});if(offline)throw new ServiceFailure('APP_SERVICE_UNAVAILABLE',true);if(body)remoteActive=(body as {active:boolean}).active;return {sessionId:'A',appId:'hallmark',active:remoteActive};};
  f.plugin.client.request=remote;
  await assert.rejects(f.plugin.setActive('A',false));assert.equal(f.plugin.cache.get('A')?.active,false);
  const journal=join(f.directory,'pending-closures.json');assert.equal(JSON.parse(readFileSync(journal,'utf8')).intents[0].sessionId,'A');
  await f.plugin.dispose();reloaded=new HallmarkPlugin(f.ctx,{dataDirectory:f.directory});reloaded.client.request=remote;
  await assert.rejects(reloaded.restore('A'));assert.equal(reloaded.cache.get('A')?.active,false);
  await assert.rejects(reloaded.setActive('A',true));assert.equal(JSON.parse(readFileSync(journal,'utf8')).intents.length,1);
  offline=false;log.length=0;assert.equal((await reloaded.restore('A')).active,false);
  assert.deepEqual(log.map(item=>item.body),[{active:false},undefined]);assert.equal(remoteActive,false);assert.equal(JSON.parse(readFileSync(journal,'utf8')).intents.length,0);
  await reloaded.setActive('A',true);assert.equal(remoteActive,true);assert.equal(reloaded.cache.get('A')?.active,true);
 }finally{await reloaded?.dispose();await f.close();}
});
test('ordinary service outage does not persist a close; corrupt intent journal denies chat',async()=>{
 const f=setup();let corrupt:HallmarkPlugin|undefined;try{
  f.plugin.client.request=async()=>{throw new ServiceFailure('APP_SERVICE_UNAVAILABLE',true);};
  await assert.rejects(f.plugin.restore('A'));assert.equal(existsSync(join(f.directory,'pending-closures.json')),false);
  writeFileSync(join(f.directory,'pending-closures.json'),'{broken json');corrupt=new HallmarkPlugin(f.ctx,{dataDirectory:f.directory});
  let calls=0;corrupt.client.request=async()=>{calls++;return {sessionId:'A',appId:'hallmark',active:true};};
  await assert.rejects(corrupt.restore('A'),/CLOSE_OUTBOX_UNAVAILABLE/);await assert.rejects(corrupt.setActive('A',true),/CLOSE_OUTBOX_UNAVAILABLE/);assert.equal(calls,0);
  assert.equal(corrupt.cache.get('A')?.active,false);
 }finally{await corrupt?.dispose();await f.close();}
});

test('cancelled session request never forwards tool or turns cancellation into retry',async()=>{
 const f=setup();try{
  const controller=new AbortController();controller.abort();f.plugin.client.request=async(_path,_body,signal)=>{signal?.throwIfAborted();return {};};
  await assert.rejects(f.plugin.invoke(TOOL_DEFINITIONS[0],{},'A',controller.signal),{name:'AbortError'});assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
