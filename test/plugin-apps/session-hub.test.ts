import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('session hub keeps drafts private, accurately shows authoring status and only favorites confirmed saved versions',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'session-hub-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsSessionHub,sessionViewStatus,visibleSessionViews} from './packages/plugin-apps/client/session-hub.tsx';
import {AppsFavoritesHub,CurrentComponentFavoriteAction,SavedComponentFavoriteAction,setComponentFavorite} from './packages/plugin-apps/client/component-favorites.tsx';
import {canFavoriteCurrentView} from './packages/plugin-apps/client/session-component-state.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
const view=(id,session='A',extra={})=>({viewId:id,ownerSessionId:session,title:id,design:{},bindings:[],createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T01:00:00Z',viewRevision:4,validationStatus:'verified',...extra});
const favorite=(id,extra={})=>({componentId:id,appId:'hallmark',title:id,revision:2,createdAt:'2026-10-09T00:00:00Z',available:true,...extra});
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
let store=[],tree,opened,saveLoss=false,favoriteLoss=false,saveHold=false,releaseSave,receipt;const requests=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  const body=options?.body?JSON.parse(options.body):undefined;const parsed=new URL(String(url),'http://fixture');requests.push(body??String(url));
  if(!body){const resource=parsed.searchParams.get('resource'),sessionId=parsed.searchParams.get('sessionId');assert.ok(['favorites','presentationRequest'].includes(resource),'catalogue must not fetch business data');if(resource==='favorites')return Response.json({sessionId,favorites:store});return Response.json({invocation:receipt});}
  if(body.action==='favorite'){store=body.favorite?[...store.filter(row=>row.componentId!==body.componentId),favorite(body.componentId)]:store.filter(row=>row.componentId!==body.componentId);if(favoriteLoss){favoriteLoss=false;throw new Error('lost favorite response');}return Response.json({sessionId:body.sessionId,favorites:store});}
  assert.equal(body.action,'presentation');
  if(body.capabilityId==='apps.authoring.save_component'){
    assert.equal(body.input.expectedViewRevision,4);const result={componentId:'saved-'+body.input.viewId,title:body.input.title,revision:2,view:view(body.input.viewId,body.sessionId,{title:body.input.title,sourceComponentId:'saved-'+body.input.viewId,baseRevision:2,viewRevision:5})};
    receipt={invocationId:body.requestId,request:{capabilityId:body.capabilityId,source:{sessionId:body.sessionId}},state:'settled',result:{status:'ok',data:result}};
    if(saveHold){saveHold=false;await new Promise(resolve=>{releaseSave=resolve;});}
    if(saveLoss){saveLoss=false;throw new Error('lost save response');}
    return Response.json({status:'ok',data:result});
  }
  assert.equal(body.capabilityId,'apps.presentation.open_component');return Response.json({status:'ok',data:view('opened-'+body.input.componentId,body.sessionId)});
};
const unmount=async()=>{if(tree){await act(async()=>tree.unmount());tree=undefined;}};
try{
  const pending=view('editing','A',{authoringState:'editing',authoringUpdatedAt:'2026-10-09T02:00:00Z',activeBuildId:'old'}),failed=view('failed','A',{authoringState:'preview_failed'}),ready=view('ready'),closed=view('closed','A',{panelState:'closed'}),other=view('foreign','B');
  assert.equal(sessionViewStatus(pending).kind,'making');assert.equal(canFavoriteCurrentView(pending,'A'),false);assert.equal(sessionViewStatus(failed).kind,'failed');assert.equal(sessionViewStatus(view('stop','A',{authoringState:'interrupted'})).label,'制作已暂停');assert.equal(sessionViewStatus(view('cancel','A',{authoringState:'cancelled'})).kind,'unverified');assert.equal(canFavoriteCurrentView(view('mounted','A',{authoringState:'mounted'}),'A'),true);
  assert.deepEqual(visibleSessionViews('A',[ready,other,closed,pending,failed]).map(row=>row.viewId),['editing','ready','failed']);
  await act(async()=>{tree=create(<AppsSessionHub sessionId="A" views={[ready,other,closed,pending,failed]} onRetry={()=>{}} onOpenView={value=>opened=value}/>);await settle();});
  assert.equal(tree.root.findAllByType('iframe').length,0);assert.equal(tree.root.findAllByProps({'data-view-id':'foreign'}).length,0);assert.equal(tree.root.findAllByProps({'data-view-id':'closed'}).length,0);assert.equal(requests.filter(row=>typeof row==='string'&&row.includes('resource=favorites')).length,1,'all stars share one metadata request');
  assert.equal(tree.root.findByProps({'aria-label':'收藏editing'}).props.disabled,true);assert.equal(tree.root.findByProps({'aria-label':'收藏failed'}).props.disabled,true);assert.equal(tree.root.findByProps({'aria-label':'收藏ready'}).props.disabled,false);
  await act(async()=>tree.root.findByProps({className:'apps-hub-primary'}).props.onClick());assert.equal(opened.viewId,'editing');
  await act(async()=>{tree.root.findByProps({'aria-label':'收藏ready'}).props.onClick();await settle();});
  const mutations=requests.filter(row=>typeof row==='object');assert.deepEqual(mutations.map(row=>row.capabilityId??row.action),['apps.authoring.save_component','favorite']);assert.equal(mutations[1].componentId,'saved-ready');assert.equal(tree.root.findByProps({'aria-label':'取消收藏ready'}).props['aria-pressed'],true);
  // Canceling a favorite is allowed even when the component starts a new edit.
  await unmount();await act(async()=>{tree=create(<CurrentComponentFavoriteAction sessionId="A" view={view('ready','A',{sourceComponentId:'saved-ready',authoringState:'editing'})}/>);await settle();});
  assert.equal(tree.root.findByProps({'aria-label':'取消收藏ready'}).props.disabled,false);await act(async()=>{tree.root.findByProps({'aria-label':'取消收藏ready'}).props.onClick();await settle();});assert.equal(store.some(row=>row.componentId==='saved-ready'),false);assert.equal(requests.filter(row=>row?.capabilityId==='apps.authoring.save_component').length,1,'unfavorite never saves or deletes content');
  await unmount();
  // Library components already exist: their favorite button must never create another save.
  const savedCalls=requests.filter(row=>row?.capabilityId==='apps.authoring.save_component').length;
  await act(async()=>{tree=create(<SavedComponentFavoriteAction sessionId="library" componentId="library-saved" title="已保存组件"/>);await settle();});await act(async()=>{tree.root.findByProps({'aria-label':'收藏已保存组件'}).props.onClick();await settle();});assert.equal(store.some(row=>row.componentId==='library-saved'),true);assert.equal(requests.filter(row=>row?.capabilityId==='apps.authoring.save_component').length,savedCalls);await unmount();
  // A lost save response remains locked until the original receipt is read.
  saveLoss=true;await act(async()=>{tree=create(<CurrentComponentFavoriteAction sessionId="lost" view={view('lost-save','lost')}/>);await settle();});
  await act(async()=>{tree.root.findByProps({'aria-label':'收藏lost-save'}).props.onClick();await settle();});assert.equal(tree.root.findByProps({'aria-label':'收藏lost-save'}).props.disabled,true);assert.equal(store.some(row=>row.componentId==='saved-lost-save'),false);
  await act(async()=>{tree.root.findAllByType('button').find(node=>text(node)==='查看操作结果').props.onClick();await settle();});assert.equal(store.some(row=>row.componentId==='saved-lost-save'),true);assert.equal(requests.filter(row=>row?.capabilityId==='apps.authoring.save_component'&&row?.sessionId==='lost').length,1);await unmount();
  // Switching chat while saving must not issue a follow-up write for the old chat.
  saveHold=true;await act(async()=>{tree=create(<CurrentComponentFavoriteAction sessionId="old" view={view('slow-save','old')}/>);await settle();});await act(async()=>{tree.root.findByProps({'aria-label':'收藏slow-save'}).props.onClick();await settle();});assert.ok(releaseSave);
  await act(async()=>{tree.update(<CurrentComponentFavoriteAction sessionId="new" view={view('new-view','new')}/>);releaseSave();await settle();});assert.equal(requests.some(row=>row?.action==='favorite'&&row?.sessionId==='old'),false);assert.equal(tree.root.findByProps({'aria-label':'收藏new-view'}).props['aria-pressed'],false);await unmount();
  // A lost favorite response is checked through the server list without retrying the POST.
  favoriteLoss=true;const beforeWrites=requests.filter(row=>row?.action==='favorite').length;await setComponentFavorite('lost-write','read-back',true);assert.equal(store.some(row=>row.componentId==='read-back'),true);assert.equal(requests.filter(row=>row?.action==='favorite').length,beforeWrites+1);
  store=[favorite('first',{title:'商品采购'}),favorite('second',{title:'库存提醒'}),favorite('unavailable',{title:'暂不可用',available:false})];
  await act(async()=>{tree=create(<AppsFavoritesHub sessionId="favorites" onOpenView={value=>opened=value}/>);await settle();});assert.equal(tree.root.findAllByProps({className:'apps-hub-row'}).length,3);assert.equal(tree.root.findByProps({'aria-label':'打开收藏组件暂不可用'}).props.disabled,true);assert.equal(tree.root.findByProps({'aria-label':'取消收藏暂不可用'}).props.disabled,false);
  await act(async()=>tree.root.findByProps({'aria-label':'搜索我的收藏'}).props.onChange({target:{value:'库存'}}));assert.equal(tree.root.findAllByProps({className:'apps-hub-row'}).length,1);await act(async()=>{tree.root.findByProps({'aria-label':'打开收藏组件库存提醒'}).props.onClick();await settle();});assert.equal(opened.ownerSessionId,'favorites');assert.equal(opened.viewId,'opened-second');assert.equal(requests.findLast(row=>row?.capabilityId==='apps.presentation.open_component').input.revision,2);
  await act(async()=>tree.root.findByProps({'aria-label':'搜索我的收藏'}).props.onChange({target:{value:''}}));const beforeCancel=requests.length;await act(async()=>{tree.root.findByProps({'aria-label':'取消收藏暂不可用'}).props.onClick();await settle();});assert.equal(requests.slice(beforeCancel).filter(row=>typeof row==='object').every(row=>row.action==='favorite'&&row.favorite===false),true);assert.equal(store.some(row=>row.componentId==='unavailable'),false);
  assert.equal(requests.some(row=>row?.action==='refreshView'||String(row).includes('viewData')),false);
  console.log('SESSION_HUB_FAVORITES_PASS');
}finally{releaseSave?.();await unmount();globalThis.fetch=originalFetch;}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/SESSION_HUB_FAVORITES_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});
