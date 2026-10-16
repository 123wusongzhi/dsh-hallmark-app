import test from 'node:test';
import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost,HttpAppsHostTransport} from '../../packages/plugin-apps/src/index.ts';

async function listen(server:ReturnType<typeof createAppsServer>):Promise<string>{
 for(let attempt=0;attempt<20;attempt++){
  try{await new Promise<void>((accept,reject)=>{const ready=()=>{server.off('error',failed);accept();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};server.once('error',failed);server.once('listening',ready);server.listen(randomInt(20000,65536),'127.0.0.1');});return `http://127.0.0.1:${(server.address() as {port:number}).port}`;}
  catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;}
 }
 throw new Error('No fixture port available');
}

test('cold Host proxies exact saved preview and pins without preparing a source view or reading business data',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'apps-workbench-pins-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),sources=new SourceComponentStore(join(directory,'archive')),presentation=new AppsPresentationService({store,runtime,sources}),token='workbench-pin-fixture-token'.repeat(3),server=createAppsServer({runtime,presentation,token});
 let host:AppsHost|undefined;
 try{
  const project=join(directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<h1>Saved preview</h1>');
  const buildId=sources.capture(project).source.buildId,png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9BkAAAAASUVORK5CYII=','base64');
  mkdirSync(join(project,'.preview'));writeFileSync(join(project,'.preview','latest.png'),png);writeFileSync(join(project,'.preview','latest.json'),JSON.stringify({buildId,viewport:{width:1,height:1}}));
  const view=presentation.openSource('s',project,{title:'保存的源码组件'}),saved=presentation.saveComponent('s',view.viewId,'保存组件',{mode:'save_as'}),plain=presentation.createView('s',{title:'没有截图'}),plainSaved=presentation.saveComponent('s',plain.viewId,'保存原生组件',{mode:'save_as'});
  const beforeViews=store.list('views'),beforeComponents=store.list('components'),url=await listen(server);
  let preparations=0;host=new AppsHost({tools:{register:()=>()=>{}},agents:{get:id=>id==='s'?{id}:undefined}},new HttpAppsHostTransport(url,token),undefined,{prepareView:async()=>{preparations++;}});
  const get=(componentId:string,revision:string='1',extra:Record<string,string>={})=>host!.ui(new Request('http://localhost/api/dsh-apps?'+new URLSearchParams({resource:'componentThumbnail',componentId,revision,...extra})));
  const preview=await get(saved.componentId);assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');assert.equal(preview.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await preview.arrayBuffer()),png);
  assert.equal((await get(plainSaved.componentId)).status,404);assert.equal((await get(saved.componentId,'99')).status,404);assert.equal((await get('missing')).status,404);
  for(const args of [[saved.componentId,'0'],['../private','1'],[saved.componentId,'1.5']])assert.equal((await get(args[0],args[1])).status,400);
  assert.equal((await get(saved.componentId,'1',{path:'private'})).status,400);
  assert.equal((await fetch(`${url}/v1/component-thumbnail?componentId=${saved.componentId}&revision=1`)).status,401,'the Runtime image route requires the service key');
  const post=(operation:string,params:unknown)=>host!.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'workbench',appId:'hallmark',operation,params})}));
  const pinned=await post('pinComponent',{componentId:saved.componentId,revision:1,expectedRevision:0});assert.equal(pinned.status,200);const board=await pinned.json();assert.equal(board.savedComponents[0].hasPreview,true);assert.equal(board.savedComponents[0].buildId,buildId);assert.equal(board.savedComponents[0].title,saved.title);
  const repeat=await post('pinComponent',{componentId:saved.componentId,revision:1,expectedRevision:0});assert.deepEqual(await repeat.json(),board);
  const forged=await post('pinComponent',{componentId:saved.componentId,revision:1,expectedRevision:1,title:'forged'});assert.equal(forged.status,400);
  const missing=await post('pinComponent',{componentId:'missing',revision:1,expectedRevision:1});assert.equal(missing.status,400);assert.equal((await missing.json()).error.code,'COMPONENT_NOT_FOUND');
  assert.deepEqual(store.list('views'),beforeViews);assert.deepEqual(store.list('components'),beforeComponents);assert.equal(store.list('invocations').length,0);assert.equal(preparations,0);
  store.delete('components',saved.componentId);assert.equal((await get(saved.componentId)).status,404,'deleted library entries cannot disclose historical screenshots');
  const removed=await post('unpinComponent',{componentId:saved.componentId,expectedRevision:1});assert.equal(removed.status,200);assert.deepEqual((await removed.json()).savedComponents,[]);
 }finally{await host?.dispose();server.closeAllConnections();if(server.listening)await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();assert.match(resolve(directory),/apps-workbench-pins-[^\\/]+$/);rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
