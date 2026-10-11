import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {HallmarkProvider,HallmarkStorePort} from '../../packages/app-hallmark/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsHost,HttpAppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';
import {validate} from '../../packages/contracts/src/index.ts';
import type {CoreClient,CoreBroker} from '../../packages/core/src/types.ts';

const cases=[['ASCII','A'.repeat(4000)],['Chinese','中'.repeat(4000)],['emoji','😀'.repeat(4000)],['mixed product','保温杯😀'.repeat(1000)],['combining','e\u0301'.repeat(2000)],['lone surrogate','\ud800'.repeat(4000)]] as const;
// Lone surrogates are an existing JS/JSON compatibility case, not a claim of
// portable Unicode scalar-value validity (RFC 8259 section 8.2).
for(const [name,value] of cases)test(`schema lengths preserve ${name} code points without normalization`,()=>{
 const schema={type:'string',minLength:4000,maxLength:4000};
 assert.deepEqual(compileSchema(schema)(value),[]);
 assert.deepEqual(validate(schema,value),[]);
 assert.ok(validate(schema,value+'A').length);
 assert.ok(validate(schema,Array.from(value).slice(0,-1).join('')).length);
});
test('emoji is one code point; combining sequence is two, not one grapheme',()=>{
 for(const check of [compileSchema({type:'string',minLength:2,maxLength:2}),(value:unknown)=>validate({type:'string',minLength:2,maxLength:2},value)]){
  assert.ok(check('😀').length);assert.deepEqual(check('e\u0301'),[]);assert.deepEqual(check('中😀'),[]);assert.ok(check('').length);
 }
});
async function fixture(){
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),queries:string[]=[],tools=new Map<string,NativeGatewayTool>(),agent={id:'unicode-fixture'};
 const forbidden=async()=>{throw Error('Unexpected upstream action');};
 const client:CoreClient={getStores:forbidden,getStoreProducts:forbidden,syncStoreProducts:forbidden,getTargetMargin:forbidden,searchCollectedItems:async query=>{queries.push(query??'');return {status:'ok',raw:[]};},getCollectedItem:forbidden,platformCall:forbidden,platformRead:forbidden};
 const broker:CoreBroker={getStoreTask:forbidden,getListingTask:forbidden,requestId:()=>{throw Error('Unexpected task');}};
 runtime.register(new HallmarkProvider({store:new HallmarkStorePort(store,'fixture'),client,broker}));runtime.register(new NotesProvider({store}));
 for(const appId of ['hallmark','notes']){runtime.addConnection({appId,connectionId:'fixture',displayName:'Fixture',config:{},enabled:true,configRevision:1});runtime.bind({sessionId:agent.id,appId,connectionId:'fixture',enabled:true,boundAt:new Date().toISOString()});}
 const token=randomUUID(),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address==='object');
 const base=`http://127.0.0.1:${address.port}`,transport=new HttpAppsHostTransport(base,token,async(input,init)=>{assert.equal(new URL(String(input)).origin,base);return fetch(input,init);}),host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);await host.start();host.attachApp('hallmark');host.attachApp('notes');
 return {store,queries,async call(appId:string,query:string){const tool=tools.get('apps_invoke')!,args={appId,connectionId:'fixture',capabilityId:appId==='hallmark'?'hallmark.collected.search':'notes.notes.list',capabilityVersion:'1.0.0',input:{query}};const raw=await tool.execute(args,{agent,signal:new AbortController().signal,callId:randomUUID()}),rendered=tool.output.render(args,raw).map(item=>item.text).join('');assert.ok(Buffer.byteLength(rendered)<=16384);return JSON.parse(rendered);},async close(){await host.dispose();server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();}};
}
for(const [name,query] of cases)test(`Host HTTP Runtime accepts schema-legal ${name} and rejects overlength before source reads`,async()=>{
 const f=await fixture();try{
  for(const appId of ['notes','hallmark']){
   const result=await f.call(appId,query);assert.equal(result.status,'ok',`${appId}: ${JSON.stringify(result)}`);
   const before=f.queries.length,tooLong=await f.call(appId,query+'A');assert.equal(tooLong.status,'failed');assert.equal(tooLong.error.code,'INPUT_SCHEMA_INVALID');assert.equal(f.queries.length,before);
  }
  assert.deepEqual(f.queries,[query]);assert.equal(f.store.list('operations').length,0);
 }finally{await f.close();}
});

test('unconstrained string needs no Unicode length iteration',()=>{
 const iterator=String.prototype[Symbol.iterator];
 try{String.prototype[Symbol.iterator]=function(){throw Error('Unexpected string iteration');};assert.deepEqual(validate({type:'string'},'large unconstrained value'),[]);}finally{String.prototype[Symbol.iterator]=iterator;}
});
