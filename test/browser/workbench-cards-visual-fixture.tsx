import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppsWorkspace} from '../../packages/plugin-apps/client/workspace.tsx';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';

// Isolated visual fixture: metadata is synthetic and no desktop service is contacted.
const sessionId='visual-workbench-session',checks:string[]=[],errors:string[]=[],requests:{resource?:string;operation?:string}[]=[];
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const design=createMaterialView('product-procurement');
const board={kind:'workbench',workbenchId:'hallmark',appId:'hallmark',revision:17,context:{storeId:'bill'},updatedAt:'2026-10-09T12:00:00Z',instances:[{instanceId:'procurement',title:'商品-采购对照表',materialId:'product-procurement',materialVersion:1,design,dataSources:{products:{id:'procurement-source',revision:1,params:{}}},position:{order:0}}],savedComponents:[{componentId:'collection',revision:2,title:'采集箱 · 渠道商品与 SKU 采购价',hasPreview:false,position:{order:0}}]};
const view={kind:'view',viewId:'collection-view',ownerSessionId:sessionId,title:'采集箱 · 渠道商品与 SKU 采购价',sourceComponentId:'collection',baseRevision:2,selectedSourceRevision:2,panelState:'open',viewRevision:1,bindings:[],design,createdAt:'2026-10-09T12:00:00Z',updatedAt:'2026-10-09T12:00:00Z'};
globalThis.fetch=(async(input,options)=>{
  const url=new URL(String(input),'http://isolated-fixture'),resource=url.searchParams.get('resource')??undefined,body=options?.body?JSON.parse(String(options.body)):undefined;
  requests.push({resource,operation:body?.operation});
  if(body)throw Error('No application mutation or business data request is permitted in this visual catalogue fixture');
  if(resource==='workbench')return Response.json(board);
  if(resource==='stores')return Response.json({stores:[{id:'bill',name:'Bill',connectionId:'platform'},{id:'helen',name:'Helen',connectionId:'platform'}]});
  if(resource==='views')return Response.json({views:[view]});
  if(resource==='apps')return Response.json({apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'},{appId:'notes',displayName:'Notes',runtimeState:'ready',hostProjectionState:'ready'}]});
  if(resource==='connections')return Response.json([{appId:'hallmark',connectionId:'platform',displayName:'Ozon',enabled:true}]);
  if(resource==='bindings')return Response.json([{appId:'hallmark',connectionId:'platform',sessionId,enabled:true}]);
  if(resource==='diagnostics')return Response.json({invocations:[]});
  if(resource==='saved')return Response.json({components:[],assets:[]});
  throw Error('Unexpected isolated resource '+resource);
}) as typeof fetch;
const style=document.createElement('style');style.textContent='html,body,#root{margin:0;width:100%;height:100%;min-width:0}body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;background:#fff}#workbench-cards-result{display:none}';document.head.append(style);
createRoot(document.getElementById('root')!).render(<AppsWorkspace currentSessionId={sessionId} onReturn={()=>{}}/>);
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
function check(condition:unknown,label:string){if(!condition)throw Error(label);checks.push(label);}
async function run(){
  for(let i=0;i<300;i++){if(document.querySelectorAll('.apps-workbench-card').length===2&&document.querySelector('.apps-tab-close'))break;await pause();}
  await document.fonts.ready;await pause();
  const cards=[...document.querySelectorAll<HTMLElement>('.apps-workbench-card')],close=document.querySelector<HTMLElement>('.apps-tab-close');
  check(cards.length===2,'two configured thumbnail cards render');
  const heights=cards.map(card=>card.getBoundingClientRect().height);check(heights.every(height=>height>160&&height<=210),'all component cards stay within 160–210 px');
  check(close,'existing source component has its own close control');const closeRect=close!.getBoundingClientRect();check(closeRect.width>=32&&closeRect.height>=32,'tab close target is at least 32×32 px');
  check(requests.every(row=>!['read','preview'].includes(row.operation??'')),'homepage starts zero business-data reads');
  check(!document.querySelector('.apps-workbench-render'),'homepage does not mount full component content');
  check(document.documentElement.scrollWidth<=innerWidth,'page has no horizontal overflow');
  check(errors.length===0,'no browser errors or rejected promises');
  return {ok:true,viewport:{width:innerWidth,height:innerHeight},cardHeights:heights,closeTarget:{width:closeRect.width,height:closeRect.height},businessReads:0,scrollWidth:document.documentElement.scrollWidth,checks,errors};
}
run().then(finish).catch(error=>finish({ok:false,checks,errors,message:String(error)}));
function finish(result:unknown){const output=document.createElement('pre');output.id='workbench-cards-result';output.textContent=JSON.stringify(result);document.body.append(output);}
