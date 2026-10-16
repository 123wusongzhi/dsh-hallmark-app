import assert from 'node:assert/strict';
import test from 'node:test';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {readResultPage,projectModelResult} from '../../packages/app-runtime/src/projection.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';

async function fixture(){
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);runtime.register(new NotesProvider({store}));
 runtime.addConnection({appId:'notes',connectionId:'n',displayName:'n',config:{},enabled:true,configRevision:1});
 const agent={id:'owner'};runtime.bind({sessionId:agent.id,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
 const token='integration-fixture-token-'.repeat(3),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const addr=server.address();assert.ok(addr&&typeof addr!=='string');
 const url=`http://127.0.0.1:${addr.port}`,tools=new Map<string,any>(),transport=new HttpAppsHostTransport(url,token),host=new AppsHost({agents:{get:id=>id===agent.id?agent:undefined},tools:{register:t=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}},transport);await host.start();
 const tool=tools.get('apps_inspect'),validate=compileSchema(tool.parameters);
 const call=async(args:any)=>{assert.deepEqual(validate(args),[]);const value=await tool.execute(args,{agent,signal:new AbortController().signal});const text=tool.output.render(args,value).map((x:any)=>x.text??'').join('');assert.ok(Buffer.byteLength(text)<=16384);return JSON.parse(text);};
 const retain=(result:any)=>{store.put('invocations',result.invocationId,{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:agent.id}},result});return projectModelResult(store,result);};
 return {store,runtime,host,transport,url,token,agent,call,validate,retain,close:async()=>{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}};
}

test('integrated giant business result supports selective fields and exact long-pointer fallback without another invocation',async()=>{
 const f=await fixture();try{
  const key='中'.repeat(1800),original='原始 evidence 😀\ud800 exact '.repeat(4500),result:any={status:'ok',invocationId:'cross-business',traceId:'synthetic',data:{planId:'plan',revision:1,storeId:'shop',status:'draft',rows:[{rowId:'row',action:'update',status:'blocked',issues:[{code:'GIANT',message:original}],payload:{[key]:original}}]}};
  const projected=f.retain(result),view=JSON.parse(projected.content);assert.ok(projected.fullResultRef);assert.equal(view.data.modelProjectionError.code,'ROW_MODEL_BUDGET_EXCEEDED');
  const ref=projected.fullResultRef!,before=JSON.stringify(f.store.get('datasets',ref)),invocations=f.store.list('invocations').length;
  const selected=await f.call({resultRef:ref,path:'/data/rows',fields:['rowId','status']});assert.deepEqual(selected.items[0].values,{rowId:'row',status:'blocked'});assert.equal(selected.completeness,'partial');
  const oversized=await f.call({resultRef:ref,path:'/data/rows',fields:['issues']});assert.equal(oversized.error.code,'RESULT_PROJECTION_BUDGET_EXCEEDED');
  const located=await f.call({resultRef:ref,path:'/data/rows/0/payload/'+key,literal:'原始 evidence',limit:1});assert.equal(located.kind,'literal-locations');assert.equal(located.matches[0].offset,0);
  let next:any={resultRef:ref,path:'/data/rows/0/payload/'+key,cursor:located.matches[0].readCursor},recovered='',pages=0;
  while(next){const page=await f.call(next);assert.equal(page.kind,'string');recovered+=page.text;next=page.continuation?.arguments;pages++;}
  assert.equal(recovered,original);assert.ok(pages>1);assert.equal(JSON.stringify(f.store.get('datasets',ref)),before);assert.equal(f.store.list('invocations').length,invocations);
 }finally{await f.close();}
});

test('integrated fields and literal are mutually exclusive at gateway, transport, reader and every POST route',async()=>{
 const f=await fixture();try{
  const result:any={status:'ok',invocationId:'cross-conflict',traceId:'synthetic',data:'target '.repeat(5000)},projection=f.retain(result),resultRef=projection.fullResultRef!;assert.ok(resultRef);
  const args={resultRef,path:'/data',fields:['id'],literal:'target'};assert.ok(f.validate(args).length);
  assert.throws(()=>readResultPage(f.store,resultRef,'0',100,{path:'/data',fields:['id'],literal:'target'}),/RESULT_SELECTION_CONFLICT/);
  await assert.rejects(()=>f.transport.readModelResult({...args,sessionId:f.agent.id}),/RESULT_SELECTION_CONFLICT/);
  for(const route of ['read','project','locate']){
   const response=await fetch(`${f.url}/v1/results/${encodeURIComponent(resultRef)}/${route}`,{method:'POST',headers:{Authorization:`Bearer ${f.token}`,'Content-Type':'application/json'},body:JSON.stringify({...args,sessionId:f.agent.id,resultRef:undefined})});assert.equal(response.status,400);assert.match(await response.text(),/RESULT_SELECTION_CONFLICT/);
  }
  const located=await f.call({resultRef,path:'/data',literal:'target',limit:1});assert.equal(located.kind,'literal-locations');const original=await f.call({resultRef,path:'/data',cursor:located.matches[0].readCursor});assert.ok(original.text.startsWith('target '));
 }finally{await f.close();}
});
