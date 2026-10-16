import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {realSourceSummaries} from '../real-data/corpus.ts';

const repoRoot=fileURLToPath(new URL('../../',import.meta.url));

// The checked-in component, SDK hook/client, host dispatch and selection bridge are not replaced.
test('page bulk deselection preserves other-page choices through the real SDK and native selection attachment',{timeout:30000},async()=>{
 const samples=realSourceSummaries().sort((a,b)=>Date.parse(b.importedAt??'')-Date.parse(a.importedAt??'')).slice(0,25);
 assert.equal(samples.length,25);assert.equal(new Set(samples.map(row=>row.id)).size,25);
 const root=resolve(repoRoot,'test/source-preview/artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'selection-bulk-chain-'));
 let passed=false;
 try{
  const entry=join(directory,'fixture.mjs');
  await build({stdin:{resolveDir:repoRoot,loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import Component from './component-workspace/collected-products/src/Component.tsx';
import {sourceData,sourceSelection,handleSourceRequest} from './packages/dsh-plugin/client/source-bridge.ts';
import {SelectionInputBridge} from './packages/dsh-plugin/client/selection.ts';
const samples=${JSON.stringify(samples)},spec={id:'selection-bulk-view',title:'Recorded cross-page bulk selection',kind:'source',source:{buildId:'selection-bulk-build',directory:'local',entry:'index.html',files:['index.html']},layout:{type:'column',children:[]},widgets:[],bindings:[{id:'collected',datasetKey:'collected:replay',fieldMap:{}}]};
const bindings=[{bindingId:'collected',datasetKey:'collected:replay',payload:{items:samples},state:'ready',dataTime:'2026-10-15T10:00:00Z',lastSuccessAt:'2026-10-15T10:00:00Z',provenance:{endpoint:'/api/items'}}];
const listeners=new Set(),requests=[],files=[],released=[],registered=new Map(),addCalls=[],bridge=new SelectionInputBridge();let attachmentIds=['existing-attachment'],tree;
const forbidden=()=>{throw Error('Selection must not alter or submit composer text');};
bridge.attachmentRuntime({createDrafts(sessionId,created){assert.equal(sessionId,'selection-session');return created.map(file=>{files.push(file);const draft={kind:'file',id:'draft-'+files.length,file};registered.set(draft.id,draft);return draft;});},releaseDraftAttachments(drafts){for(const draft of drafts){released.push(draft.id);registered.delete(draft.id);}},blocks:{storeFor:()=>({getSnapshot:()=>undefined,subscribe:()=>()=>{}})}});bridge.observeSession('selection-session');
const unbind=bridge.bind('selection-session',{actions:{addAttachments(ids){addCalls.push([...ids]);attachmentIds=[...attachmentIds,...ids];return true;},submit:forbidden,insertText:forbidden,setDraft:forbidden},readState:()=>({phase:'plain',attachmentIds}),disabledReason:()=>undefined});
const handlers={data:()=>sourceData(spec,bindings,'current-snapshot'),context:()=>({sessionId:'selection-session',viewId:spec.id,buildId:spec.source.buildId,theme:'light',attachment:bridge.availability('selection-session')}),refresh(){throw Error('Local selection must not refresh data');},attach:request=>bridge.attach('selection-session',sourceSelection('selection-session',spec,bindings,request,'current-snapshot')),resize(){}};
const parent={postMessage(request,origin){assert.equal(origin,'http://source.local');requests.push(structuredClone(request));queueMicrotask(async()=>{let reply;try{reply={channel:'hallmark.source.v1',requestId:request.requestId,result:await handleSourceRequest(request,handlers)};}catch(error){reply={channel:'hallmark.source.v1',requestId:request.requestId,error:error.message};}for(const listener of listeners)listener({source:parent,origin,data:structuredClone(reply)});});}};
globalThis.window={parent,location:{origin:'http://source.local'},addEventListener(type,listener){assert.equal(type,'message');listeners.add(listener);},removeEventListener(type,listener){listeners.delete(listener);}};globalThis.document={documentElement:{dataset:{}}};globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const desktop=()=>tree.root.findByProps({className:'desktop-table'});
const box=label=>desktop().findAll(node=>node.type==='input'&&node.props['aria-label']===label)[0];
const rowBox=index=>box('选择'+samples[index].title);
const button=()=>tree.root.findAll(node=>node.type==='button'&&node.props.className?.includes('attach-button'))[0];
const page=label=>tree.root.findAll(node=>node.type==='button'&&node.props['aria-label']===label)[0];
const expected=indices=>({type:'hallmark.product-selection',version:1,sessionId:'selection-session',viewId:'selection-bulk-view',widgetId:'source',bindingId:'collected',datasetKey:'collected:replay',dataTime:'2026-10-15T10:00:00Z',lastSuccessAt:'2026-10-15T10:00:00Z',source:{endpoint:'/api/items',kind:'collected_items'},products:indices.map(index=>({kind:'collected_item',itemId:samples[index].id}))});
try{
 await act(async()=>{tree=create(<Component/>);});
 assert.equal(tree.root.findByType('main').props['data-ready'],'ready');assert.equal(listeners.size,1);
 assert.equal(box('选择本页商品').props.disabled,false);
 await act(async()=>rowBox(0).props.onChange());
 assert.equal(page('下一页').props.disabled,false);await act(async()=>page('下一页').props.onClick());
 await act(async()=>rowBox(20).props.onChange());
 assert.equal(page('上一页').props.disabled,false);await act(async()=>page('上一页').props.onClick());
 await act(async()=>box('选择本页商品').props.onChange());
 for(let index=0;index<20;index++)assert.equal(rowBox(index).props.checked,true);
 assert.equal(button().props.disabled,false);await act(async()=>button().props.onClick());
 assert.equal(files.length,1);assert.deepEqual(JSON.parse(await files[0].text()),expected(Array.from({length:21},(_,index)=>index)));
 await act(async()=>box('选择本页商品').props.onChange());
 for(let index=0;index<20;index++)assert.equal(rowBox(index).props.checked,false);
 assert.equal(button().props.disabled,false,'deselecting the current page must retain the other-page product and leave attachment available');
 assert.equal(page('下一页').props.disabled,false);await act(async()=>page('下一页').props.onClick());
 assert.equal(rowBox(20).props.checked,true,'the retained selection must belong to the same off-page product');
 for(let index=21;index<25;index++)assert.equal(rowBox(index).props.checked,false);
 assert.equal(button().props.disabled,false);await act(async()=>button().props.onClick());
 assert.equal(files.length,2);assert.deepEqual(JSON.parse(await files[1].text()),expected([20]));
 for(const [index,file]of files.entries()){assert.ok(file instanceof File);assert.equal(file.type,'application/json');assert.equal(file.name,['Hallmark-已选产品-21项.json','Hallmark-已选产品-1项.json'][index]);}
 assert.deepEqual(addCalls,[['draft-1'],['draft-2']]);assert.deepEqual(released,[]);assert.deepEqual([...registered.keys()],['draft-1','draft-2']);assert.deepEqual(attachmentIds,['existing-attachment','draft-1','draft-2']);
 const attachments=requests.filter(request=>request.method==='attachSelection');assert.equal(attachments.length,2);assert.equal(attachments[0].params.keys.length,21);assert.equal(new Set(attachments[0].params.keys).size,21);assert.equal(attachments[0].params.revision,'current-snapshot');assert.deepEqual(attachments[1].params,{bindingId:'collected',keys:[JSON.stringify(['collected_item',samples[20].id])],revision:'current-snapshot'});
 assert.deepEqual(requests.map(request=>request.method),['getData','getContext','attachSelection','attachSelection']);
 console.log('SELECTION_BULK_CHAIN_PASS');
}finally{try{if(tree)await act(async()=>tree.unmount());}finally{unbind();bridge.attachmentRuntime(undefined);bridge.observeSession(undefined);assert.equal(listeners.size,0,'the actual SDK must remove its listener, including failed checks');}}
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{cwd:repoRoot,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
  writeFileSync(join(directory,'stdout.txt'),result.stdout??'');writeFileSync(join(directory,'stderr.txt'),result.stderr??'');
  assert.equal(result.status,0,[result.error?.message,result.stderr,result.stdout,'logs: '+directory].filter(Boolean).join('\n'));assert.match(result.stdout,/SELECTION_BULK_CHAIN_PASS/,'Missing success marker; logs: '+directory);passed=true;
 }finally{if(passed){const within=relative(root,directory);assert.ok(/^selection-bulk-chain-[^/\\]+$/.test(within)&&resolve(root,within)===directory);rmSync(directory,{recursive:true,force:true,maxRetries:3});}}
});
