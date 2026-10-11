import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';
import {compileSchema} from '../../packages/app-contracts/src/index.ts';

test('registered Host literal locate preserves permissions, exact Unicode, schema and original read contracts',async()=>{
 const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);runtime.register(new NotesProvider({store}));
 for(const connectionId of ['n','other'])runtime.addConnection({appId:'notes',connectionId,displayName:connectionId,config:{},enabled:true,configRevision:1});
 const agents=new Map(['owner','fork','foreign','unbound'].map(id=>[id,{id}]));
 const bind=(sessionId:string,connectionId='n',enabled=true)=>runtime.bind({sessionId,appId:'notes',connectionId,enabled,boundAt:new Date().toISOString()});
 bind('owner');bind('fork');bind('foreign','other');
 const result={status:'ok',invocationId:'i',traceId:'t',data:{text:'😀\ud83dX\ude00'+'a'.repeat(90000)}};
 store.put('datasets','result:i',{result});store.put('invocations','i',{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:'owner'}},result});
 const token='test-result-locate'.repeat(5),server=createAppsServer({runtime,presentation:new AppsPresentationService({store,runtime}),token});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');
 const tools=new Map<string,any>(),host=new AppsHost({agents:{get:(id:string)=>agents.get(id)},tools:{register:(t:any)=>{tools.set(t.name,t);return()=>tools.delete(t.name);}}} as any,new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token));
 try{
  await host.start();const tool=tools.get('apps_inspect'),validate=compileSchema(tool.parameters);
  const call=async(args:any,session='owner')=>{const v=await tool.execute(args,{agent:agents.get(session),signal:new AbortController().signal});const rendered=tool.output.render(args,v).map((x:any)=>x.text??'').join('');assert.ok(Buffer.byteLength(rendered)<=16384);return JSON.parse(rendered);};
  const args={resultRef:'result:i',path:'/data/text',literal:'\ud83d',limit:1};
  assert.equal(validate(args).length,0);assert.ok(validate({resultRef:'result:i',literal:'a'}).length);
  for(const extras of [{invocationId:'i'},{operationId:'op'}])assert.ok(validate({...extras,literal:'a',path:'/data/text'}).length);
  assert.deepEqual((await call(args)).matches.map((m:any)=>m.offset),[1]);
  assert.deepEqual((await call({...args,literal:'\ude00'})).matches.map((m:any)=>m.offset),[3]);
  assert.deepEqual((await call({...args,literal:'😀'},'fork')).matches.map((m:any)=>m.offset),[0]);
  for(const session of ['foreign','unbound']){const p=await call(args,session);assert.equal(p.error.code,'RESULT_ACCESS_DENIED');assert.equal(JSON.stringify(p).includes('😀'),false);}
  bind('fork','n',false);assert.equal((await call(args,'fork')).error.code,'RESULT_ACCESS_DENIED');
  assert.equal((await call({...args,sessionId:'owner'},'unbound')).error.code,'INVALID_INPUT');
  for(const count of [128,256]){const p=await call({...args,literal:'😀'.repeat(count)});assert.equal(p.kind,'literal-locations');}
  assert.equal((await call({...args,literal:'😀'.repeat(257)})).error.code,'INVALID_INPUT');
  const legacy=await(await fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ai`,{headers:{Authorization:`Bearer ${token}`}})).json();assert.deepEqual(legacy.result,result);
  const original=await call({resultRef:'result:i',path:'/data/text',cursor:'0',limit:100});assert.equal(original.kind,'string');assert.ok(original.text.startsWith('😀\ud83dX\ude00'));
  const longPath='/data/'+'中'.repeat(1500),longLiteral='😀'.repeat(256);
  store.put('datasets','result:i',{result:{...result,data:{text:result.data.text,[longPath.slice(6)]:longLiteral}}});
  const longOriginal=await call({resultRef:'result:i',path:longPath});assert.equal(longOriginal.text,longLiteral);
  const oversizedQuery=new URLSearchParams({sessionId:'owner',path:longPath,literal:longLiteral});
  const tooLong=await fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ai?${oversizedQuery}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(tooLong.status,431);
  const longLocated=await call({resultRef:'result:i',path:longPath,literal:longLiteral});assert.equal(longLocated.kind,'literal-locations');assert.equal(longLocated.matches[0].offset,0);
  const longContext=await call({resultRef:'result:i',path:longPath,cursor:longLocated.matches[0].readCursor});assert.equal(longContext.text,longLiteral);
  // Existing legal-max path GET can itself exceed Node's unchanged header budget.
  const maxPath='/data/'+'中'.repeat(3994);
  store.put('datasets','result:i',{result:{...result,data:{[maxPath.slice(6)]:longLiteral}}});
  assert.ok((await call({resultRef:'result:i',path:maxPath,literal:longLiteral})).error, 'Oversized executable continuation must fail explicitly');
  const oldMaxRead=await fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ai?${new URLSearchParams({sessionId:'owner',path:maxPath})}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(oldMaxRead.status,431);

  store.put('datasets','result:i',{result:{...result,data:{text:'replacement'}}});assert.equal((await call(args)).matches.length,0);
  const transport=(host as any).transport,savedRead=transport.readModelResult.bind(transport);
  transport.readModelResult=async()=>({kind:'string',text:'not a locator response'});
  const unsupported=await call(args);assert.equal(unsupported.error.code,'RESULT_LOCATOR_UNAVAILABLE');assert.equal(JSON.stringify(unsupported).includes('not a locator response'),false);assert.deepEqual(unsupported.error.details.read.arguments,{resultRef:'result:i',path:'/data/text',cursor:'0',limit:100});
  transport.readModelResult=async()=>{throw Object.assign(new Error('RUNTIME_TRANSPORT_ERROR'),{statusCode:404,details:{status:'failed',error:{code:'RESULT_NOT_FOUND',message:'Missing result',retryPolicy:'never'}}});};
  assert.equal((await call(args)).error.code,'RESULT_NOT_FOUND');
  transport.readModelResult=async()=>({status:'failed',error:{code:'RESULT_ACCESS_DENIED',message:'Denied',retryPolicy:'never'}});
  assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');
  transport.readModelResult=savedRead;
  await runtime.updateConnection({appId:'notes',connectionId:'n',enabled:false,expectedConfigRevision:1});assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');
  store.delete('datasets','result:i');assert.equal((await call(args)).error.code,'RESULT_ACCESS_DENIED');
 }finally{await host.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await runtime.dispose();store.close();}
});
