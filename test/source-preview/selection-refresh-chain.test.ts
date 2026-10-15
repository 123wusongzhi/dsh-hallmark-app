import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realSourceSummaries} from '../real-data/corpus.ts';

// No hook, SDK, host selection, or native attachment implementation is replaced.
// Only the browser transport, public native file API, and provider snapshot are
// local adapters. Business records are unchanged public corpus summaries.
async function runSelectionChain(mode:'removed-row'|'new-revision'){
  const root=resolve('test/source-preview/artifacts');mkdirSync(root,{recursive:true});
  const directory=mkdtempSync(join(root,'selection-refresh-chain-'));
  const samples=realSourceSummaries().sort((a,b)=>Date.parse(b.importedAt??'')-Date.parse(a.importedAt??'')).slice(0,25);
  assert.equal(samples.length,25);
  assert.equal(new Set(samples.map(row=>row.id)).size,25);
  try{
    const entry=join(directory,'test.mjs');
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import Component from './component-workspace/collected-products/src/Component.tsx';
import {sourceData,sourceSelection,handleSourceRequest} from './packages/dsh-plugin/client/source-bridge.ts';
import {SelectionInputBridge} from './packages/dsh-plugin/client/selection.ts';
import {SOURCE_CHANNEL} from './packages/component-runtime/src/client.ts';
const mode=${JSON.stringify(mode)},samples=${JSON.stringify(samples)};
const spec={id:'selection-refresh-view',title:'Recorded source selection',kind:'source',source:{buildId:'selection-refresh-build',directory:'local',entry:'index.html',files:['index.html']},layout:{type:'column',children:[]},widgets:[],bindings:[{id:'collected',datasetKey:'collected:replay',query:{tool:'hallmark_search_collected_items',params:{}},fieldMap:{}}]};
const snapshot=(items,time)=>[{bindingId:'collected',datasetKey:'collected:replay',payload:{items},state:'ready',dataTime:time,lastSuccessAt:time,provenance:{endpoint:'/api/items'}}];
let bindings=snapshot(samples,'2026-10-15T10:00:00Z'),revision='snapshot-1',refreshes=0;
const files=[],attached=[],requests=[],listeners=new Set(),bridge=new SelectionInputBridge();
let attachmentIds=['existing-attachment'],tree;
const forbidText=()=>{throw new Error('Selection must not alter or submit the composer text');};
bridge.attachmentRuntime({createDrafts(sessionId,created){assert.equal(sessionId,'selection-session');files.push(...created);return created.map((file,index)=>({kind:'file',id:'draft-'+files.length+'-'+index,file}));},releaseDraftAttachments(){},blocks:{storeFor:()=>({getSnapshot:()=>undefined,subscribe:()=>()=>{}})}});
bridge.observeSession('selection-session');
const unbind=bridge.bind('selection-session',{actions:{addAttachments(ids){attached.push(...ids);attachmentIds=[...attachmentIds,...ids];return true;},setDraft:forbidText,insertText:forbidText,submit:forbidText},readState:()=>({phase:'plain',attachmentIds}),disabledReason:()=>undefined});
const handlers={
  data:()=>sourceData(spec,bindings,revision),
  context:()=>({sessionId:'selection-session',viewId:spec.id,buildId:spec.source.buildId,theme:'light',attachment:bridge.availability('selection-session')}),
  refresh:async()=>{refreshes++;revision='snapshot-2';const rows=mode==='removed-row'?samples.slice(1).toReversed():samples.toReversed();bindings=snapshot(rows,'2026-10-15T10:01:00Z');return sourceData(spec,bindings,revision);},
  attach:request=>bridge.attach('selection-session',sourceSelection('selection-session',spec,bindings,request,revision)),resize(){}
};
const parent={postMessage(request,origin){assert.equal(origin,'http://source.local');requests.push(structuredClone(request));queueMicrotask(async()=>{let response;try{response={channel:SOURCE_CHANNEL,requestId:request.requestId,result:await handleSourceRequest(request,handlers)};}catch(error){response={channel:SOURCE_CHANNEL,requestId:request.requestId,error:error.message};}for(const listener of listeners)listener({source:parent,origin,data:structuredClone(response)});});}};
globalThis.window={parent,location:{origin:'http://source.local'},addEventListener(type,listener){assert.equal(type,'message');listeners.add(listener);},removeEventListener(type,listener){listeners.delete(listener);}};
globalThis.document={documentElement:{dataset:{}}};
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const input=label=>tree.root.findAll(node=>node.type==='input'&&node.props['aria-label']===label)[0];
const button=label=>tree.root.findAll(node=>node.type==='button'&&node.props['aria-label']===label)[0];
const attachButton=()=>tree.root.findAll(node=>node.type==='button'&&node.props.className?.includes('attach-button'))[0];
const selectionLabel=()=>tree.root.findByProps({className:'selection-status'}).findByType('strong').children.join('');
const click=async element=>{assert.equal(Boolean(element.props.disabled),false);await act(async()=>element.props.onClick());};
try{
  await act(async()=>{tree=create(<Component/>);});
  assert.equal(tree.root.findByType('main').props['data-ready'],'ready');
  assert.deepEqual(requests.map(request=>request.method),['getData','getContext']);
  if(mode==='removed-row'){
    await act(async()=>input('选择'+samples[0].title).props.onChange());
    await act(async()=>input('选择'+samples[1].title).props.onChange());
    await click(button('下一页'));
    await act(async()=>input('选择'+samples[20].title).props.onChange());
    await click(button('上一页'));
    assert.equal(selectionLabel(),'已选 3 件商品');
    await click(button('刷新商品'));
    assert.equal(selectionLabel(),'已选 2 件商品','refresh must prune a removed identity without clearing retained selections');
    assert.equal(input('选择'+samples[1].title).props.checked,true);
    assert.equal(input('选择'+samples[0].title),undefined);
  }else{
    await act(async()=>input('选择'+samples[1].title).props.onChange());
    await click(button('刷新商品'));
    assert.equal(selectionLabel(),'已选 1 件商品');
  }
  assert.equal(refreshes,1);
  await click(attachButton());
  const request=requests.filter(request=>request.method==='attachSelection').at(-1);
  assert.ok(request,'the actual component must reach the actual SDK attachment method');
  assert.equal(request.params.revision,'snapshot-2','the SDK must forward the refreshed snapshot revision');
  assert.equal(files.length,1,'a successful selection must reach the native file API');
  assert.equal(attached.length,1);assert.equal(attachmentIds[0],'existing-attachment');
  const expectedIds=mode==='removed-row'?[samples[20].id,samples[1].id]:[samples[1].id];
  assert.deepEqual(JSON.parse(await files[0].text()),{type:'hallmark.product-selection',version:1,sessionId:'selection-session',viewId:'selection-refresh-view',widgetId:'source',bindingId:'collected',datasetKey:'collected:replay',dataTime:'2026-10-15T10:01:00Z',lastSuccessAt:'2026-10-15T10:01:00Z',source:{endpoint:'/api/items',kind:'collected_items'},products:expectedIds.map(itemId=>({kind:'collected_item',itemId}))});
  console.log('SELECTION_REFRESH_CHAIN_PASS:'+mode);
}finally{
  if(tree)await act(async()=>tree.unmount());unbind();bridge.attachmentRuntime(undefined);bridge.observeSession(undefined);
}
assert.equal(listeners.size,0,'the actual SDK must release its listener');
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.error?.message??result.stderr);
    assert.match(result.stdout,new RegExp('SELECTION_REFRESH_CHAIN_PASS:'+mode));
  }finally{
    const within=relative(root,directory);assert.ok(/^selection-refresh-chain-[^/\\]+$/.test(within)&&resolve(root,within)===directory);
    rmSync(directory,{recursive:true,force:true});
  }
}

test('real source host, SDK and product table prune removed selections before native attachment after refresh',()=>runSelectionChain('removed-row'));
test('real source SDK carries the refreshed revision through table selection into the native file attachment',()=>runSelectionChain('new-revision'));
