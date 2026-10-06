import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { HallmarkPlugin, UI_PATH } from '../../packages/dsh-plugin/server/index.ts';
import { TOOL_DEFINITIONS } from '../../packages/contracts/src/index.ts';
import { createRenderer, presentationMeta } from '../../packages/dsh-plugin/server/render.ts';
import { validateServiceUrl } from '../../packages/dsh-plugin/server/service-client.ts';
import { validateLaunch } from '../../packages/dsh-plugin/server/launch.ts';
import type { PluginContext, NativeTool, PreDecision, Execution } from '../../packages/dsh-plugin/server/types.ts';
const json=(value:unknown)=>JSON.stringify(value);
async function fixture(initial:Record<string,boolean>={A:true}) {
 const dir=mkdtempSync(join(tmpdir(),'hallmark-plugin-test-'));writeFileSync(join(dir,'service-key'),'b'.repeat(64));
 const states=new Map(Object.entries(initial));const forwarded:{path:string;body:any}[]=[];let unavailable=false;let failTools=false;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');if(req.headers.authorization!==`Bearer ${'b'.repeat(64)}`){res.writeHead(401);res.end('{}');return;}
  if(unavailable){res.writeHead(503);res.end('{}');return;}
  const url=new URL(req.url??'/', 'http://127.0.0.1');
  if(url.pathname==='/tools'){res.end(json({tools:TOOL_DEFINITIONS}));return;}
  const session=url.pathname.match(/^\/sessions\/([^/]+)\/app$/);
  let body:any;const chunks:Buffer[]=[];for await(const part of req)chunks.push(part);if(chunks.length)body=JSON.parse(Buffer.concat(chunks).toString());
  if(session){if(body)states.set(session[1],body.active);res.end(json({sessionId:session[1],appId:'hallmark',active:states.get(session[1])??false}));return;}
  forwarded.push({path:url.pathname,body});
  if(failTools&&url.pathname.startsWith('/tools/')){res.writeHead(503);res.end(json({status:'failed',error:{code:'SIMULATED_DOWN',message:'down',retryable:false}}));return;}
  res.end(json({status:'ok',data:{viewId:'view-1',products:[{id:1}]}}));
 });
 await new Promise<void>(ok=>server.listen(0,'127.0.0.1',ok));const port=(server.address() as {port:number}).port;
 const A={id:'A'},B={id:'B'};const agents=new Map([['A',A],['B',B]]);
 const tools=new Map<string,NativeTool>();const listeners=new Map<string,Function>();let prompt:any;let command:any;let route:any;
 const ctx:PluginContext={
  agents:{get:id=>agents.get(id),list:()=>[...agents.values()]},sessions:{get:()=>undefined},sessionQuery:{async readTitleSnapshot(id){if(id!=='C')throw new Error('missing');return {session:{id}};}},
  tools:{register(tool){tools.set(tool.name,tool);return()=>{tools.delete(tool.name);};}},
  commands:{register(value){command=value;return()=>{command=undefined;};}},systemPrompt:{context(value){prompt=value;return()=>{prompt=undefined;};}},
  connection:{fetch:{register(value){route=value;return async()=>{route=undefined;};}}},
  on:(event:string,listener:Function)=>{listeners.set(event,listener);return()=>{listeners.delete(event);};},
 } as PluginContext;
 const plugin=new HallmarkPlugin(ctx,{serviceUrl:`http://127.0.0.1:${port}`,dataDirectory:dir});await plugin.start();
 return {plugin,ctx,A,B,tools,listeners,forwarded,states,get prompt(){return prompt;},get command(){return command;},get route(){return route;},offline(){unavailable=true;},failToolRequests(){failTools=true;},
  async close(){await plugin.dispose();await new Promise<void>((ok,reject)=>server.close(error=>error?reject(error):ok()));const absolute=resolve(dir);assert.equal(absolute,dir);assert.match(absolute,/hallmark-plugin-test-[^\\/]+$/);rmSync(absolute,{recursive:true,force:true});}};
}
function request(body:unknown):Request{return new Request('http://dsh.invalid'+UI_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:json(body)});}

test('restores entered agents before first prompt and keeps two sessions isolated',async()=>{
 const f=await fixture();try{assert.match(f.prompt.text({scope:f.A,agent:f.A}),/Hallmark/);assert.equal(f.prompt.text({scope:f.B,agent:f.B}), '');assert.equal(f.prompt.text({scope:{id:'A'}}),'');
  assert.match(f.prompt.text({scope:f.A,agent:f.A}),/designCapabilities/);
  assert.match(f.tools.get('hallmark_render_view')!.description,/designCapabilities/);
  assert.match(f.tools.get('hallmark_update_view')!.description,/designCapabilities/);
  assert.equal(f.tools.get('hallmark_list_stores')!.description,TOOL_DEFINITIONS.find(tool=>tool.name==='hallmark_list_stores')!.description);
  assert.equal(f.tools.size,TOOL_DEFINITIONS.length);assert.equal(f.route.path,UI_PATH);
  const tool=f.tools.get('hallmark_list_stores')!;
  assert.equal((await tool.execute({}, {name:tool.name,arguments:{},agent:f.B,signal:new AbortController().signal})).error?.code,'APP_NOT_ACTIVE');
  assert.equal((await tool.execute({sessionId:'B'}, {name:tool.name,arguments:{},agent:f.A,signal:new AbortController().signal})).error?.code,'INVALID_INPUT');
  assert.equal((await tool.execute({}, {name:tool.name,arguments:{},agent:{id:'A'},signal:new AbortController().signal})).error?.code,'APP_NOT_ACTIVE');
  assert.equal(f.forwarded.length,0);
  assert.equal((await tool.execute({}, {name:tool.name,arguments:{},agent:f.A,signal:new AbortController().signal})).status,'ok');assert.equal(f.forwarded[0].body.sessionId,'A');
 }finally{await f.close();}
});

test('waterfall preserves unrelated policies; close/state refresh blocks new calls',async()=>{
 const f=await fixture();try{
  const gate=f.listeners.get('tools/pre-execute')!;const signal=new AbortController().signal;const deny:PreDecision={kind:'deny',reason:'other-owner'};
  assert.deepEqual(await gate({name:'other',arguments:{},agent:f.A,signal},async()=>deny),deny);
  assert.deepEqual(await gate({name:'hallmark_list_stores',arguments:{},agent:f.A,signal},async()=>deny),deny);
  await f.plugin.setActive('A',false);assert.equal(f.prompt.text({agent:f.A,scope:f.A}),'');
  assert.equal((await gate({name:'hallmark_list_stores',arguments:{},agent:f.A,signal},async()=>({kind:'allow'}))).kind,'deny');
  await f.plugin.setActive('A',true);f.states.set('A',false);
  assert.equal((await gate({name:'hallmark_list_stores',arguments:{},agent:f.A,signal},async()=>({kind:'allow'}))).kind,'deny');
 }finally{await f.close();}
});

test('UI authentic carrier verifies cold persisted session, cannot create fake identity or forward arbitrary tool',async()=>{
 const f=await fixture();try{
  assert.equal((await f.plugin.ui(request({sessionId:'fake',action:'activate'}))).status,400);
  const result=await f.plugin.ui(request({sessionId:'C',action:'activate'}));assert.equal(result.status,200);assert.equal((await result.json()).active,true);assert.equal(f.states.get('C'),true);
  assert.equal((await f.plugin.ui(request({sessionId:'A',action:'invoke',tool:'hallmark_update_price',arguments:{}}))).status,400);
  assert.equal((await f.plugin.ui(request({sessionId:'A',action:'activate',extra:'bad'}))).status,400);
  assert.equal(f.forwarded.length,0);
 }finally{await f.close();}
});

test('command and later agent-created restore; offline never grants active capability',async()=>{
 const f=await fixture();try{
  const off=await f.command.handler({agent:f.A,rawInput:'off',signal:new AbortController().signal});assert.equal(off.kind,'success');assert.equal(f.states.get('A'),false);
  await f.command.handler({agent:f.B,rawInput:'on',signal:new AbortController().signal});assert.equal(f.states.get('B'),true);assert.match(f.prompt.text({agent:f.B,scope:f.B}),/Hallmark/);
  f.states.set('B',false);await f.listeners.get('agent/created')!({agent:f.B,source:'resume'});assert.equal(f.prompt.text({agent:f.B,scope:f.B}),'');
  f.offline();const failed=await f.command.handler({agent:f.A,rawInput:'on',signal:new AbortController().signal});assert.equal(failed.kind,'error');assert.equal(f.plugin.cache.get('A')?.active,false);
 }finally{await f.close();}
});

test('large tool content spills complete value while metadata stays minimal',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hallmark-plugin-test-'));try{
  const value={status:'ok',data:{viewId:'view-9',rows:Array.from({length:1000},(_,id)=>({id,raw:'x'.repeat(100)}))}};
  const render=createRenderer(dir,2048);const content=render({},value)[0].text;assert.ok(Buffer.byteLength(content)<=2048);
  const summary=JSON.parse(content);assert.deepEqual(JSON.parse(readFileSync(summary.file,'utf8')),value);
  assert.deepEqual(presentationMeta(value),{hallmark:{status:'ok',viewId:'view-9'}});
 }finally{const absolute=resolve(dir);assert.equal(absolute,dir);assert.match(absolute,/hallmark-plugin-test-[^\\/]+$/);rmSync(absolute,{recursive:true,force:true});}
});

test('loopback configuration/explicit opt-in launch fail closed',()=>{
 assert.equal(validateServiceUrl('http://127.0.0.1:4180'),'http://127.0.0.1:4180');
 for(const url of ['http://localhost:4180','http://example.com','http://127.0.0.1:4180/proxy','http://token@127.0.0.1:4180','https://127.0.0.1','http://127.1','http://2130706433','http://0x7f000001','http://127.0.0.1:0','http://127.0.0.1:99999',' http://127.0.0.1'])assert.throws(()=>validateServiceUrl(url));
 assert.throws(()=>validateLaunch({autoStart:true}));assert.throws(()=>validateLaunch({nodeExecutable:'C:/Electron.exe',serviceEntry:'relative',serviceCwd:'relative'}));
});
