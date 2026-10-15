import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realSourceSummaries} from '../real-data/corpus.ts';

// Local browser/native boundaries; the component, hook, SDK and selection bridge remain real.
test('native attachment refusal returns through the real source SDK, restores the button and allows an explicit retry',{timeout:30000},async()=>{
 const project=fileURLToPath(new URL('../../',import.meta.url)),root=join(project,'test/source-preview/artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'selection-retry-chain-'));
 const samples=realSourceSummaries().slice(0,2);
 assert.equal(samples.length,2);assert.equal(new Set(samples.map(row=>row.id)).size,2);
 let passed=false;
 try{
  const entry=join(directory,'fixture.mjs');
  await build({stdin:{resolveDir:project,loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import Component from './component-workspace/collected-products/src/Component.tsx';
import {sourceData,sourceSelection,handleSourceRequest} from './packages/dsh-plugin/client/source-bridge.ts';
import {SelectionInputBridge} from './packages/dsh-plugin/client/selection.ts';
const samples=${JSON.stringify(samples)},spec={id:'selection-retry-view',title:'Recorded source selection retry',kind:'source',source:{buildId:'selection-retry-build',directory:'local',entry:'index.html',files:['index.html']},layout:{type:'column',children:[]},widgets:[],bindings:[{id:'collected',datasetKey:'collected:replay',fieldMap:{}}]};
const bindings=[{bindingId:'collected',datasetKey:'collected:replay',payload:{items:samples},state:'ready',dataTime:'2026-10-15T10:00:00Z',lastSuccessAt:'2026-10-15T10:00:00Z',provenance:{endpoint:'/api/items'}}];
const listeners=new Set(),requests=[],files=[],released=[],registered=new Map(),addCalls=[],bridge=new SelectionInputBridge();let refuse=true,attachmentIds=['existing-attachment'],tree,releaseFirstReply;
const forbidden=()=>{throw Error('Selection must not alter or submit composer text');};
bridge.attachmentRuntime({createDrafts(sessionId,created){assert.equal(sessionId,'selection-session');return created.map(file=>{files.push(file);const draft={kind:'file',id:'draft-'+files.length,file};registered.set(draft.id,draft);return draft;});},releaseDraftAttachments(drafts){for(const draft of drafts){released.push(draft.id);registered.delete(draft.id);}},blocks:{storeFor:()=>({getSnapshot:()=>undefined,subscribe:()=>()=>{}})}});bridge.observeSession('selection-session');
const unbind=bridge.bind('selection-session',{actions:{addAttachments(ids){addCalls.push([...ids]);if(refuse)return false;attachmentIds=[...attachmentIds,...ids];return true;},submit:forbidden,insertText:forbidden,setDraft:forbidden},readState:()=>({phase:'plain',attachmentIds}),disabledReason:()=>undefined});
const handlers={data:()=>sourceData(spec,bindings,'current-snapshot'),context:()=>({sessionId:'selection-session',viewId:spec.id,buildId:spec.source.buildId,theme:'light',attachment:bridge.availability('selection-session')}),refresh(){throw Error('This flow must not refresh to recover');},attach:request=>bridge.attach('selection-session',sourceSelection('selection-session',spec,bindings,request,'current-snapshot')),resize(){}};
const parent={postMessage(request,origin){assert.equal(origin,'http://source.local');requests.push(structuredClone(request));queueMicrotask(async()=>{let reply;try{reply={channel:'hallmark.source.v1',requestId:request.requestId,result:await handleSourceRequest(request,handlers)};}catch(error){reply={channel:'hallmark.source.v1',requestId:request.requestId,error:error.message};}const deliver=()=>{for(const listener of listeners)listener({source:parent,origin,data:structuredClone(reply)});};if(request.method==='attachSelection'&&addCalls.length===1){releaseFirstReply=deliver;return;}deliver();});}};
globalThis.window={parent,location:{origin:'http://source.local'},addEventListener(type,listener){assert.equal(type,'message');listeners.add(listener);},removeEventListener(type,listener){listeners.delete(listener);}};globalThis.document={documentElement:{dataset:{}}};globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const selected=()=>tree.root.findAll(node=>node.type==='input'&&node.props['aria-label']==='选择'+samples[0].title)[0];
const button=()=>tree.root.findAll(node=>node.type==='button'&&node.props.className?.includes('attach-button'))[0];
const feedback=()=>tree.root.findByProps({role:'status'});
const text=node=>typeof node==='string'?node:node.children.map(text).join('');
try{
 await act(async()=>{tree=create(<Component/>);});
 assert.equal(tree.root.findByType('main').props['data-ready'],'ready');assert.equal(listeners.size,1);
 await act(async()=>selected().props.onChange());assert.equal(button().props.disabled,false);
 await act(async()=>button().props.onClick());
 assert.deepEqual(addCalls,[['draft-1']]);assert.deepEqual(released,['draft-1']);assert.equal(registered.size,0);assert.deepEqual(attachmentIds,['existing-attachment']);
 assert.equal(button().props.disabled,true,'the attachment stays locked until the real SDK receives the refusal');
 assert.equal(typeof releaseFirstReply,'function');await act(async()=>releaseFirstReply());
 assert.equal(button().props.disabled,false,'a definitive native refusal must release the component attachment lock for explicit retry');
 assert.equal(selected().props.checked,true,'a failed attach must preserve the user selection');
 assert.match(feedback().props.className,/feedback-error/);assert.match(text(feedback()),/附件未附加/);
 assert.deepEqual(requests.map(request=>request.method),['getData','getContext','attachSelection']);
 refuse=false;
 await act(async()=>{});assert.equal(addCalls.length,1,'native recovery must not automatically resend the selection');
 assert.equal(button().props.disabled,false,'retry must use an enabled UI control');
 await act(async()=>button().props.onClick());
 assert.deepEqual(addCalls,[['draft-1'],['draft-2']]);assert.deepEqual(released,['draft-1']);assert.deepEqual([...registered.keys()],['draft-2']);assert.deepEqual(attachmentIds,['existing-attachment','draft-2']);
 assert.equal(button().props.disabled,false);assert.equal(selected().props.checked,true);assert.doesNotMatch(feedback().props.className,/feedback-error/);assert.match(text(feedback()),/已添加产品 JSON 附件/);
 const expected={type:'hallmark.product-selection',version:1,sessionId:'selection-session',viewId:'selection-retry-view',widgetId:'source',bindingId:'collected',datasetKey:'collected:replay',dataTime:'2026-10-15T10:00:00Z',lastSuccessAt:'2026-10-15T10:00:00Z',source:{endpoint:'/api/items',kind:'collected_items'},products:[{kind:'collected_item',itemId:samples[0].id}]};
 assert.equal(files.length,2);assert.deepEqual(JSON.parse(await files[0].text()),expected);assert.deepEqual(JSON.parse(await files[1].text()),expected);
 for(const file of files){assert.ok(file instanceof File);assert.equal(file.type,'application/json');assert.equal(file.name,'Hallmark-已选产品-1项.json');}
 const attachments=requests.filter(request=>request.method==='attachSelection');assert.equal(attachments.length,2);assert.deepEqual(attachments[0].params,attachments[1].params);assert.equal(attachments[1].params.revision,'current-snapshot');
 assert.deepEqual(requests.map(request=>request.method),['getData','getContext','attachSelection','attachSelection']);
 console.log('SELECTION_RETRY_CHAIN_PASS');
}finally{if(tree)await act(async()=>tree.unmount());unbind();bridge.attachmentRuntime(undefined);bridge.observeSession(undefined);}
assert.equal(listeners.size,0);
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{cwd:project,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});writeFileSync(join(directory,'stdout.txt'),result.stdout??'');writeFileSync(join(directory,'stderr.txt'),result.stderr??'');assert.equal(result.status,0,[result.error?.message,result.stderr,'logs: '+directory].filter(Boolean).join('\n'));assert.match(result.stdout,/SELECTION_RETRY_CHAIN_PASS/);passed=true;
 }finally{const within=relative(root,directory);assert.ok(/^selection-retry-chain-[^/\\]+$/.test(within)&&resolve(root,within)===directory);if(passed)rmSync(directory,{recursive:true,force:true});}
});
