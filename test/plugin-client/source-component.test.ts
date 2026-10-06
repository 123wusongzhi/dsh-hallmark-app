import test from 'node:test';
import assert from 'node:assert/strict';
import {createHallmarkClient,SOURCE_CHANNEL} from '../../packages/component-runtime/src/client.ts';
import {handleSourceRequest,sourceData,sourceSelection,isSourceView} from '../../packages/dsh-plugin/client/source-bridge.ts';
import {selectionAttachment} from '../../packages/dsh-plugin/client/selection.ts';
import {HallmarkBridge} from '../../packages/dsh-plugin/client/api.ts';
import type {BindingData,SourceView} from '../../packages/presentation/src/types.ts';
import {sourceTheme} from '../../packages/dsh-plugin/client/source-theme.ts';

function fixture(count=2){
  const rows=Array.from({length:count},(_,i)=>({id:`product-${i}`,title:`商品 ${i}`,profit:{actualMargin:0.239},privateDisplay:'not in attachment'}));
  const spec:SourceView={id:'source-list',title:'采集箱',kind:'source',source:{buildId:'build-one',directory:'E:/project/sample',entry:'index.html',files:['index.html','assets/app.js']},layout:{type:'column',children:[]},widgets:[],bindings:[{id:'collected',datasetKey:'collected:latest',fieldMap:{}}]};
  const data:BindingData[]=[{bindingId:'collected',datasetKey:'collected:latest',payload:{items:rows},state:'ready',provenance:{endpoint:'/api/items'}}];
  return {spec,data,rows};
}
test('ordinary source component receives unmodified fields and stable selection keys without widgets',()=>{
  const {spec,data,rows}=fixture();assert.ok(isSourceView(spec));
  const packet=sourceData(spec,data,'revision-one');assert.equal(packet.bindings[0].payload,data[0].payload);assert.equal(packet.selection[0].rows[0].row.profit,rows[0].profit);
  const context=sourceSelection('chat-a',spec,data,{bindingId:'collected',keys:[packet.selection[0].rows[1].key],revision:'revision-one'},packet.revision);
  assert.equal(context.sessionId,'chat-a');assert.equal(context.widgetId,'source');assert.deepEqual(context.products,[{kind:'collected_item',itemId:'product-1'}]);
  assert.ok(!selectionAttachment(context).content.includes('privateDisplay'));
});
test('source attachment resolves trusted keys and rejects stale refreshes, removed products and duplicates',()=>{
  const {spec,data}=fixture();const packet=sourceData(spec,data,'r2');const key=packet.selection[0].rows[0].key;
  assert.throws(()=>sourceSelection('chat-a',spec,data,{bindingId:'collected',keys:[key],revision:'r1'},'r2'),/刷新/);
  assert.throws(()=>sourceSelection('chat-a',spec,data,{bindingId:'collected',keys:['invented']},'r2'),/失效/);
  assert.throws(()=>sourceSelection('chat-a',spec,data,{bindingId:'collected',keys:[key,key]},'r2'),/重复/);
  assert.throws(()=>sourceSelection('chat-a',spec,data,{bindingId:'other',keys:[key]},'r2'),/当前组件/);
});
test('source component has no inherited 100-row design cap on native attachments',()=>{
  const {spec,data}=fixture(145);const packet=sourceData(spec,data,'r1');
  assert.equal(sourceSelection('chat-a',spec,data,{bindingId:'collected',keys:packet.selection[0].rows.map(row=>row.key)},'r1').products.length,145);
});
test('host RPC exposes current data and delegates refresh/attachment without an auto-send operation',async()=>{
  const {spec,data}=fixture();let refreshes=0,attachments=0,height=0;const packet=sourceData(spec,data,'r1');
  const handlers={data:()=>packet,context:()=>({sessionId:'a',viewId:spec.id,buildId:spec.source.buildId,attachment:{available:true}}),refresh:async()=>{refreshes++;return {...packet,revision:'r2'};},attach:()=>{attachments++;return {ok:true,message:'attachment draft'};},resize:(value:number)=>{height=value;}};
  const request=(method:string,params?:unknown)=>({channel:SOURCE_CHANNEL,requestId:'request',method,params} as any);
  assert.equal(await handleSourceRequest(request('getData'),handlers),packet);assert.equal((await handleSourceRequest(request('refresh'),handlers) as any).revision,'r2');
  assert.deepEqual(await handleSourceRequest(request('attachSelection',{keys:[]}),handlers),{ok:true,message:'attachment draft'});await handleSourceRequest(request('resize',{height:950}),handlers);
  assert.equal(refreshes,1);assert.equal(attachments,1);assert.equal(height,950);await assert.rejects(handleSourceRequest(request('sendChat'),handlers),/未知/);
});
function browser(){
  const listeners=new Set<(event:any)=>void>();const posts:any[]=[];const parent={postMessage:(data:any,origin:string)=>posts.push({data,origin})};
  const win={parent,location:{origin:'http://dsh.local'},addEventListener:(_type:string,fn:any)=>listeners.add(fn),removeEventListener:(_type:string,fn:any)=>listeners.delete(fn)} as unknown as Window;
  const emit=(message:any,source:unknown=parent,origin='http://dsh.local')=>{for(const listener of listeners)listener({data:message,source,origin});};
  return {win,parent,posts,emit,listeners};
}
test('SDK correlates responses only from its host window and origin, publishes updates, and disposes pending calls',async()=>{
  const f=browser();const client=createHallmarkClient({window:f.win});const request=client.getData();const id=f.posts[0].data.requestId;const events:any[]=[];client.subscribe(event=>events.push(event));
  f.emit({channel:SOURCE_CHANNEL,requestId:id,result:'foreign'},{},'http://dsh.local');f.emit({channel:SOURCE_CHANNEL,requestId:id,result:'cross-origin'},f.parent,'http://elsewhere');
  const packet={bindings:[],selection:[],revision:'r1'};f.emit({channel:SOURCE_CHANNEL,requestId:id,result:packet});assert.deepEqual(await request,packet);
  f.emit({channel:SOURCE_CHANNEL,event:'data',data:packet});assert.deepEqual(events,[{event:'data',data:packet}]);
  const pending=client.refresh();client.dispose();await assert.rejects(pending,/已关闭/);assert.equal(f.listeners.size,0);await assert.rejects(client.getContext(),/已关闭/);
});
test('SDK surfaces host errors and unavailable preview connection',async()=>{
  const f=browser();const client=createHallmarkClient({window:f.win});const request=client.attachSelection({bindingId:'b',keys:['k']});f.emit({channel:SOURCE_CHANNEL,requestId:f.posts[0].data.requestId,error:'数据已刷新'});await assert.rejects(request,/刷新/);client.dispose();
  const standalone=browser();Object.assign(standalone.win,{parent:standalone.win});const outside=createHallmarkClient({window:standalone.win});await assert.rejects(outside.getData(),/预览宿主/);outside.dispose();
});
test('component library can restore a source template and open a past source revision',async()=>{
  const requests:any[]=[];const bridge=new HallmarkBridge('chat-a',(async(_url:any,init:any)=>{requests.push(JSON.parse(init.body));return Response.json({spec:{id:'draft'}});}) as typeof fetch);
  await bridge.openTemplate('template-a');await bridge.openComponent('component-a',undefined,{revision:2});
  assert.deepEqual(requests,[{sessionId:'chat-a',action:'openTemplate',templateId:'template-a'},{sessionId:'chat-a',action:'openComponent',componentId:'component-a',revision:2}]);
});
test('a library opened before choosing a chat does not invent ownership while subsequent chat bridges carry exact session',async()=>{
  const requests:any[]=[];const fetcher=(async(_url:any,init:any)=>{requests.push(JSON.parse(init.body));return Response.json({spec:{id:'draft'}});}) as typeof fetch;
  await new HallmarkBridge('',fetcher).openTemplate('template-a');await new HallmarkBridge('chat-b',fetcher).openTemplate('template-a');
  await new HallmarkBridge('chat-c',fetcher).openComponent('component-a');
  assert.equal(Object.hasOwn(requests[0],'sessionId'),false);assert.equal(requests[1].sessionId,'chat-b');assert.equal(requests[2].sessionId,'chat-c');
});
test('source context can follow an explicit host theme or actual host background instead of forcing system dark',()=>{
  assert.equal(sourceTheme({explicit:'light',background:'#111111',systemDark:true}),'light');
  assert.equal(sourceTheme({className:'ds-app dark',systemDark:false}),'dark');
  assert.equal(sourceTheme({background:'rgb(17, 24, 39)',systemDark:false}),'dark');
  assert.equal(sourceTheme({background:'#ffffff',systemDark:true}),'light');
  assert.equal(sourceTheme({background:'',systemDark:true}),'dark');
});
