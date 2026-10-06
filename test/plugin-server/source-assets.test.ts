import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SourceAssetRoutes } from '../../packages/dsh-plugin/server/source-assets.ts';
import { AppServiceClient } from '../../packages/dsh-plugin/server/service-client.ts';
import type { PluginContext } from '../../packages/dsh-plugin/server/types.ts';

test('source views register exact immutable build routes, return actual bytes, and restore after Host restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'hallmark-source-host-'));
 const key='a'.repeat(64);writeFileSync(join(directory,'service-key'),key);
 const bytes=Buffer.from([0,255,3,45,128]);let manifests=0;
 const server=createServer((req,res)=>{
  if(req.headers.authorization!==`Bearer ${key}`){res.writeHead(401);res.end();return;}
  if(req.url==='/source-builds/build_1/manifest'){manifests++;res.setHeader('content-type','application/json');res.end(JSON.stringify({buildId:'build_1',entry:'index.html',files:['index.html','assets/图.png','assets/app.js']}));return;}
  if(req.url==='/source-builds/build_1/files/assets/%E5%9B%BE.png'){res.setHeader('content-type','image/png');res.end(bytes);return;}
  if(req.url==='/source-builds/build_1/files/index.html'){res.setHeader('content-type','text/html; charset=utf-8');res.end('<script type="module" src="./assets/app.js"></script>');return;}
  res.writeHead(404);res.end('{}');
 });
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
 const routes=new Map<string,any>();
 const ctx={connection:{fetch:{register(route:any){assert.equal(routes.has(route.path),false);routes.set(route.path,route);return async()=>{routes.delete(route.path);};}}}} as PluginContext;
 const client=new AppServiceClient({dataDirectory:directory,serviceUrl:`http://127.0.0.1:${(server.address() as any).port}`});
 const source={kind:'source',source:{buildId:'build_1'}};
 let registry=new SourceAssetRoutes(ctx,client,new AbortController().signal);
 try {
  await Promise.all([registry.prepare({status:'ok',data:{spec:source}}),registry.prepare(source)]);
  assert.equal(manifests,1);assert.equal(routes.size,4);
  const path='/api/hallmark-source/build_1/assets/%E5%9B%BE.png';
  const response=await routes.get(path).fetch(new Request('http://dsh.invalid'+path));
  assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('authorization'),null);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  await registry.dispose();assert.equal(routes.size,0);
  registry=new SourceAssetRoutes(ctx,client,new AbortController().signal);
  await registry.prepare({components:[{spec:source}],templates:[source]});assert.equal(manifests,2);assert.equal(routes.size,4);
  const absent=await routes.get('/api/hallmark-source/build_1/assets/app.js').fetch(new Request('http://dsh.invalid/api/hallmark-source/build_1/assets/app.js'));
  assert.equal(absent.status,404);assert.doesNotMatch(await absent.text(),new RegExp(key));
 } finally {
  await registry.dispose();await new Promise<void>(done=>server.close(()=>done()));
  assert.match(resolve(directory),/hallmark-source-host-[^\\/]+$/);rmSync(directory,{recursive:true,force:true});
 }
});

test('failed partial route registration is cleaned up and can be retried',async()=>{
 const registered=new Set<string>();let fail=true;
 const ctx={connection:{fetch:{register(route:any){if(fail&&registered.size===1)throw new Error('registration failed');registered.add(route.path);return async()=>{registered.delete(route.path);};}}}} as PluginContext;
 const client={async request(){return {buildId:'abc',entry:'index.html',files:['index.html','app.js']};}} as unknown as AppServiceClient;
 const registry=new SourceAssetRoutes(ctx,client,new AbortController().signal);
 try {
  await assert.rejects(registry.prepare({kind:'source',source:{buildId:'abc'}}),/registration failed/);assert.equal(registered.size,0);
  fail=false;await registry.prepare({kind:'source',source:{buildId:'abc'}});assert.equal(registered.size,3);
 } finally {await registry.dispose();}
});
