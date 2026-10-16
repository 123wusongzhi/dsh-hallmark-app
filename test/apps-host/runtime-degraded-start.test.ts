import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AppsHost,HttpAppsHostTransport,RuntimeHealthMonitor,type AppsPluginContext,type AppsHostTransport,type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import {createAppsBundle,apply} from '../../bundles/apps/server/index.ts';
import type {PluginContext} from '../../packages/dsh-plugin/server/types.ts';
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function context(){
  const agent={id:'A'},tools=new Map<string,NativeGatewayTool>(),routes=new Map<string,{fetch(request:Request):Promise<Response>}>(),registrations=new Map<string,number>();
  const register=<T>(map:Map<string,T>,key:string,value:T)=>{assert.equal(map.has(key),false,`duplicate ${key}`);map.set(key,value);registrations.set(key,(registrations.get(key)??0)+1);return ()=>{map.delete(key);};};
  const ctx={tools:{register:(tool:NativeGatewayTool)=>register(tools,tool.name,tool)},agents:{get:(id:string)=>id==='A'?agent:undefined,list:()=>[]},sessions:{get:(id:string)=>id==='A'?agent:undefined},connection:{fetch:{register:(route:{path:string;fetch(request:Request):Promise<Response>})=>register(routes,route.path,route)}},commands:{register:()=>()=>{}},systemPrompt:{context:()=>()=>{}},on:()=>()=>{}} as unknown as PluginContext&AppsPluginContext;
  return {ctx,agent,tools,routes,registrations};
}
async function until(check:()=>boolean|Promise<boolean>){const end=Date.now()+5000;while(Date.now()<end){if(await check())return;await sleep(10);}throw new Error('fixture initialization timeout');}
test('degraded Host recovers directory and capability handshake once; late results cannot reinitialize a disposed Host',async()=>{
  let online=false,directories=0,release!:(apps:any[])=>void;const f=context(),rows:Record<string,unknown>[]=[];
  const transport={async identity(){if(!online)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNREFUSED'}});return {transportMajor:1,catalogSchemaVersion:1,catalogDigest:'recovered',hostFeatures:['routedInvocationsV1']};},async listApps(){directories++;return new Promise<any[]>(resolve=>{release=resolve;});},async health(){if(!online)throw new TypeError('fetch failed');return {status:'ok'};}} as unknown as AppsHostTransport;
  const monitor=new RuntimeHealthMonitor({probe:()=>transport.health!(),intervalMs:10000}),host=new AppsHost(f.ctx,transport,undefined,{health:monitor,log:row=>rows.push(row)});let ready=0;
  await host.start();host.whenReady(()=>{ready++;});
  try{
    assert.equal(monitor.state,'down');assert.equal((await host.call('apps_list',{},'A') as any).error.code,'RUNTIME_DOWN');
    online=true;await monitor.check();await until(()=>directories===1);await Promise.all([monitor.check(),monitor.check()]);assert.equal(directories,1,'repeated healthy samples share pending initialization');
    await host.dispose();release([]);await sleep(0);assert.equal(ready,0);assert.equal(rows.filter(x=>x.event==='host_runtime_initialized').length,0);
  }finally{await host.dispose();}
});
test('failed lazy initialization retries on later healthy samples without duplicate registration',async()=>{
  let online=false,reads=0,ready=0;const f=context(),rows:Record<string,unknown>[]=[];
  const transport={async identity(){if(!online)throw new TypeError('fetch failed');return {transportMajor:1,catalogSchemaVersion:1,catalogDigest:'d'};},async listApps(){reads++;if(reads===1)throw Object.assign(new Error('busy'),{statusCode:503});return [];},async health(){if(!online)throw new TypeError('fetch failed');return {status:'ok'};}} as unknown as AppsHostTransport;
  const monitor=new RuntimeHealthMonitor({probe:()=>transport.health!(),intervalMs:10000}),host=new AppsHost(f.ctx,transport,undefined,{health:monitor,log:row=>rows.push(row)});
  try{await host.start();host.whenReady(()=>{ready++;});online=true;await monitor.check();await until(()=>rows.some(x=>x.event==='host_runtime_initialization_failed'));
    await monitor.check();await until(()=>ready===1);for(let i=0;i<3;i++)await monitor.check();assert.equal(reads,2);assert.equal(ready,1);assert.equal(f.registrations.get('apps_list'),1);assert.equal(f.registrations.get('/api/dsh-apps'),1);
  }finally{await host.dispose();}
});
test('real HTTP bundle starts disconnected with tools/routes; external fake Runtime recovery initializes projections once and tools succeed',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'degraded-bundle-')),token='a'.repeat(64),f=context(),rows:Record<string,unknown>[]=[];writeFileSync(join(dir,'service-key'),token);
  let directoryReads=0;const apps=['apps','hallmark','notes'].map(appId=>({manifestVersion:1,appId,displayName:appId,providerPackage:`fixture-${appId}`,providerVersion:'1',runtimeProtocolMajor:1,resourceTypes:[],providerState:'ready'}));
  const server=createServer((req,res)=>{res.setHeader('content-type','application/json');if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return;}
    if(req.url==='/health?shallow=1')res.end('{"status":"ok"}');
    else if(req.url==='/v1/runtime')res.end(JSON.stringify({transportMajor:1,catalogSchemaVersion:1,catalogDigest:'fixture-recovered',hostFeatures:['routedInvocationsV1','independentReviewBridgeV1']}));
    else if(req.url==='/v1/apps'){directoryReads++;res.end(JSON.stringify({apps}));}
    else if(req.url?.startsWith('/v1/capabilities'))res.end(JSON.stringify({items:[],total:0,returned:0,nextCursor:null,catalogDigest:'fixture-recovered'}));
    else {res.writeHead(404);res.end('{}');}
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as {port:number}).port;await new Promise<void>(r=>server.close(()=>r()));
  const url=`http://127.0.0.1:${port}`,transport=new HttpAppsHostTransport(url,token),monitor=new RuntimeHealthMonitor({probe:signal=>transport.health(signal),intervalMs:10000,timeoutMs:500});
  let bundle:Awaited<ReturnType<typeof createAppsBundle>>|undefined;
  try{
    bundle=await createAppsBundle(f.ctx,{serviceUrl:url,dataDirectory:dir,autoStart:false},transport,{health:monitor,log:row=>rows.push(row)});
    assert.equal(f.tools.size,5);assert.ok(f.routes.has('/api/dsh-apps'));assert.equal(monitor.state,'down');assert.equal(monitor.snapshot().recovering,false);assert.deepEqual(monitor.snapshot().restart,{enabled:false,reason:'NO_LAUNCH_SPEC'});
    const tool=f.tools.get('apps_list')!,execution={agent:f.agent,signal:new AbortController().signal};const unavailable=await tool.execute({},execution) as any;
    assert.equal(unavailable.error.code,'RUNTIME_DOWN');assert.equal(unavailable.error.retryPolicy,'read_retry');
    const failedResource=await bundle.host.ui(new Request('http://dsh.local/api/dsh-apps?resource=apps'));assert.equal(failedResource.status,503);assert.equal((await failedResource.json() as any).error.code,'RUNTIME_DOWN');
    await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));await monitor.check();await until(()=>rows.some(x=>x.event==='host_runtime_initialized'));assert.equal(directoryReads,1);
    for(let i=0;i<5;i++)await monitor.check();assert.equal(directoryReads,1);assert.equal(rows.filter(x=>x.event==='host_runtime_initialized').length,1);
    const successful=await tool.execute({},execution) as any;assert.equal(successful.status,'ok');assert.ok(successful.apps.every((app:any)=>app.hostProjectionState==='attached'));assert.equal(f.registrations.get('apps_list'),1);assert.equal(f.registrations.get('/api/dsh-apps'),1);
    assert.throws(()=>bundle!.host.attachApp('unregistered'),/APP_NOT_FOUND/);
    // Another outage/recovery preserves projections and does not duplicate Host or legacy registrations.
    server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));for(let i=0;i<3;i++)await monitor.check();await new Promise<void>(r=>server.listen(port,'127.0.0.1',r));await monitor.check();await sleep(0);assert.equal(rows.filter(x=>x.event==='host_runtime_initialized').length,1);assert.equal(f.tools.size,5);
  }finally{await bundle?.dispose();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(dir,{recursive:true,force:true,maxRetries:10,retryDelay:30});}
  assert.equal(f.tools.size,0);assert.equal(f.routes.size,0);assert.equal(monitor.snapshot().monitoring,false);
});
test('healthy startup keeps immediate directory and invalid protocol/configuration still throws',async()=>{
  const f=context(),host=new AppsHost(f.ctx,{async identity(){return {transportMajor:1,catalogSchemaVersion:1,catalogDigest:'d'};},async listApps(){return [];} } as unknown as AppsHostTransport);
  try{await host.start();let ready=0;host.whenReady(()=>{ready++;});assert.equal(ready,1);}finally{await host.dispose();}
  const bad=new AppsHost(context().ctx,{async identity(){return {transportMajor:2,catalogSchemaVersion:1};}} as unknown as AppsHostTransport);await assert.rejects(()=>bad.start(),/INCOMPATIBLE_PROTOCOL/);await bad.dispose();
  const dir=mkdtempSync(join(tmpdir(),'degraded-config-'));try{writeFileSync(join(dir,'service-key'),'bad-key');await assert.rejects(()=>apply(context().ctx,{dataDirectory:dir,serviceUrl:'http://127.0.0.1:4181'}),/SERVICE_KEY_INVALID/);await assert.rejects(()=>apply(context().ctx,{dataDirectory:dir,serviceUrl:'https://remote.example'}),/LOOPBACK_SERVICE_REQUIRED/);}finally{rmSync(dir,{recursive:true,force:true});}
});
