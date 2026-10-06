import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductSelection, getProductSelectionRows, SelectionInputBridge, selectionAttachment } from '../../packages/dsh-plugin/client/selection.ts';
import type { BindingData, DataBinding, ViewSpec, WidgetSpec } from '../../packages/presentation/src/types.ts';
import { nativeAttachmentRuntime, nativeSessionDisabledReason } from '../../packages/dsh-plugin/client/selection-native.ts';
import type { NativeAttachmentRuntime, NativeDraftAttachment, NativeInputBinding } from '../../packages/dsh-plugin/client/selection-native.ts';

function fixture(){
  const rows=[{id:'item-a',title:'产品甲',secret:'not sent'},{id:'item-b',title:'产品乙'}];
  const binding:DataBinding={id:'items',datasetKey:'query:collected',query:{tool:'hallmark_search_collected_items',params:{}},fieldMap:{id:'title'}};
  const data:BindingData={bindingId:'items',datasetKey:'query:collected',payload:{items:rows},dataTime:'2026-10-06T00:00:00Z',lastSuccessAt:'2026-10-06T00:01:00Z',state:'ready',provenance:{source:'app_snapshot',endpoint:'/api/items'}};
  const widget:WidgetSpec={id:'recent',type:'table',bindingId:'items',columns:[{field:'title',label:'产品'}]};
  const spec:ViewSpec={id:'recent-products',title:'最近采集',layout:{type:'column',children:['recent']},widgets:[widget],bindings:[binding]};
  return {rows,binding,data,widget,spec};
}
function editor(){
  const original='我已经写好的问题';let draft=original;let submits=0;let nextId=0;let refuse=false;let phase='plain';let disabled:string|undefined;
  let ids:string[]=[];const registered=new Map<string,NativeDraftAttachment>();const created:{sessionId:string;drafts:readonly NativeDraftAttachment[]}[]=[];const released:string[]=[];const calls:string[][]=[];
  const runtime:NativeAttachmentRuntime={
    createDrafts(sessionId,files){const drafts=files.map(file=>({kind:'file' as const,id:`attachment-${++nextId}`,file}));for(const entry of drafts)registered.set(entry.id,entry);created.push({sessionId,drafts});return drafts;},
    releaseDraftAttachments(drafts){for(const entry of drafts){released.push(entry.id);registered.delete(entry.id);}},
    blocks:{storeFor:()=>({getSnapshot:()=>undefined,subscribe:()=>()=>{}})},
  };
  const forbidden=()=>{throw new Error('must never modify or submit the text draft');};
  const actions={addAttachments:(added:readonly string[])=>{calls.push([...added]);if(refuse)return false;ids=[...ids,...added];return true;},insertText:forbidden,setDraft:forbidden,submit:forbidden};
  const binding:NativeInputBinding={actions,readState:()=>({phase,attachmentIds:ids}),disabledReason:()=>disabled};
  const remove=(attachmentId:string)=>{ids=ids.filter(id=>id!==attachmentId);const entry=registered.get(attachmentId);if(entry)runtime.releaseDraftAttachments([entry]);};
  return {original,runtime,binding,calls,created,released,registered,read:()=>draft,submits:()=>submits,ids:()=>ids,refuse:(value:boolean)=>{refuse=value;},phase:(value:string)=>{phase=value;},disable:(reason:string|undefined)=>{disabled=reason;},remove,manualSend:()=>{submits++;draft='';for(const id of [...ids])remove(id);}};
}
const selection=(sessionId='a')=>{const f=fixture();return buildProductSelection(sessionId,f.spec,{...f,rows:f.rows});};
function setup(sessionId='a'){const bridge=new SelectionInputBridge(),native=editor();bridge.attachmentRuntime(native.runtime);bridge.observeSession(sessionId);bridge.bind(sessionId,native.binding);return {bridge,native};}

test('collected selection uses original IDs despite display mappings and excludes all product content',()=>{
  const f=fixture();const context=buildProductSelection('session-a',f.spec,{...f,rows:[f.rows[1]]});
  assert.deepEqual(context.products,[{kind:'collected_item',itemId:'item-b'}]);assert.equal(context.datasetKey,'query:collected');assert.equal(context.widgetId,'recent');assert.equal(context.dataTime,f.data.dataTime);
  const {content,name}=selectionAttachment(context);assert.ok(content.includes('item-b'));assert.ok(!content.includes('产品乙'));assert.ok(!content.includes('secret'));assert.ok(!content.includes('item-a'));assert.match(name,/1项\.json$/);assert.deepEqual(JSON.parse(content).source,{endpoint:'/api/items',kind:'collected_items'});
});
test('row keys survive sorting and pagination; selected stale objects and duplicate IDs are rejected',()=>{
  const f=fixture();const a=getProductSelectionRows(f.binding,f.data,f.rows),b=getProductSelectionRows(f.binding,f.data,[f.rows[1],f.rows[0]]);
  assert.equal(a.rows[0].key,b.rows[1].key);assert.equal(getProductSelectionRows(f.binding,f.data,[f.rows[1]]).rows[0].key,a.rows[1].key);
  assert.equal(getProductSelectionRows(f.binding,{...f.data,payload:{items:f.rows.map(row=>({...row}))}},f.rows).eligible,false);
  const duplicate={...f.rows[0]};f.rows.push(duplicate);assert.throws(()=>buildProductSelection('session-a',f.spec,{...f,rows:[f.rows[0]]}),/重复/);
});
test('JSON file bytes preserve exact Unicode and editor-placeholder source IDs without any editor text path',async()=>{
  const f=fixture();f.rows[0].id='产品```\uE100\uE11D\uFFFC';f.spec.id='view\uE100';f.data.datasetKey='query:\uFFFC';f.binding.datasetKey=f.data.datasetKey;
  const context=buildProductSelection('a',f.spec,{...f,rows:[f.rows[0]]});const {bridge,native}=setup();assert.equal(bridge.attach('a',context).ok,true);
  const file=native.created[0].drafts[0].file;assert.equal(file.type,'application/json');assert.deepEqual(JSON.parse(await file.text()),context);assert.equal(native.read(),native.original);
});
test('ambiguous sources, missing IDs, unready snapshots, binding changes and empty or oversized selections fail closed',()=>{
  const f=fixture();assert.equal(getProductSelectionRows(f.binding,{...f.data,provenance:{endpoint:'/api/tasks'}},f.rows).eligible,false);
  assert.equal(getProductSelectionRows(f.binding,{...f.data,state:'refreshing'},f.rows).eligible,false);
  assert.equal(getProductSelectionRows({...f.binding,datasetKey:'other'},f.data,f.rows).eligible,false);
  f.rows[0].id='';assert.equal(getProductSelectionRows(f.binding,f.data,f.rows).eligible,false);
  assert.throws(()=>buildProductSelection('session-a',f.spec,{...f,rows:[]}),/1 至 100/);
  assert.throws(()=>buildProductSelection('session-a',f.spec,{...f,rows:Array(101).fill(f.rows[1])}),/1 至 100/);
  assert.throws(()=>buildProductSelection('session-a',f.spec,{...f,widget:{...f.widget},rows:[f.rows[1]]}),/已经变化/);
});
test('shop products retain exact store scope and never use an index or a display-mapped ID',()=>{
  const f=fixture();delete f.binding.query;f.binding.datasetKey='store_products:shop-a';f.data.datasetKey=f.binding.datasetKey;f.data.provenance={endpoint:'/api/store-products',storeId:'shop-a'};
  const rows=[{storeId:'shop-a',offerId:'offer-a',productId:123},{storeId:'shop-a',offerId:'offer-b',productId:456}];f.data.payload={products:rows};
  const result=getProductSelectionRows(f.binding,f.data,rows);assert.ok(result.eligible);assert.deepEqual(result.rows[0].identity,{kind:'store_product',storeId:'shop-a',offerId:'offer-a',productId:'123'});
  rows[0].storeId='shop-b';assert.equal(getProductSelectionRows(f.binding,f.data,rows).eligible,false);rows[0].storeId='shop-a';rows[1].offerId='offer-a';assert.equal(getProductSelectionRows(f.binding,f.data,rows).eligible,false);
  const conflicting=[{storeId:'shop-a',offerId:'x',offer_id:'y'}];f.data.payload={products:conflicting};assert.equal(getProductSelectionRows(f.binding,f.data,conflicting).eligible,false);
});
test('same platform product ID cannot appear under multiple offers in one store',()=>{
  const binding:DataBinding={id:'items',datasetKey:'query:products',fieldMap:{}};
  const rows=[{storeId:'shop-a',offerId:'offer-a',productId:123},{storeId:'shop-a',offerId:'offer-b',productId:'123'}];
  const data:BindingData={bindingId:'items',datasetKey:binding.datasetKey!,payload:{products:rows},state:'ready',provenance:{endpoint:'/api/store-products'}};
  assert.equal(getProductSelectionRows(binding,data,rows).eligible,false);
  rows[1].storeId='shop-b';assert.equal(getProductSelectionRows(binding,data,rows).eligible,true);
});
test('attachment registers a real File for the exact session, preserves existing text and never auto-submits',async()=>{
  const {bridge,native}=setup();const context=selection();assert.equal(bridge.attach('a',context).ok,true);
  assert.equal(native.created[0].sessionId,'a');assert.deepEqual(native.ids(),['attachment-1']);assert.equal(native.read(),native.original);assert.equal(native.submits(),0);assert.equal(native.released.length,0);
  assert.deepEqual(JSON.parse(await native.created[0].drafts[0].file.text()),context);
  bridge.observeSession('b');assert.equal(bridge.attach('a',context).ok,false);assert.equal(bridge.attach('b',context).ok,false);assert.equal(native.calls.length,1);
});
test('busy, blocked, removed or subagent input refuses before file registration',()=>{
  const {bridge,native}=setup();native.phase('submitting');assert.equal(bridge.attach('a',selection()).ok,false);native.phase('plain');native.disable('blocked');assert.equal(bridge.attach('a',selection()).ok,false);assert.equal(native.created.length,0);assert.equal(native.read(),native.original);
  assert.match(nativeSessionDisabledReason({removed:true})!,/移除/);assert.match(nativeSessionDisabledReason({subagent:{address:{mode:'continuable'}}})!,/子代理/);assert.match(nativeSessionDisabledReason(undefined)!,/核实/);assert.equal(nativeSessionDisabledReason({subagent:null}),undefined);
});
test('native add refusal or exception releases only new drafts and preserves prior attachments',()=>{
  const {bridge,native}=setup();bridge.attach('a',selection());native.refuse(true);const next={...selection(),viewId:'another'};assert.equal(bridge.attach('a',next).ok,false);assert.deepEqual(native.released,['attachment-2']);assert.deepEqual(native.ids(),['attachment-1']);
  native.binding.actions.addAttachments=()=>{throw new Error('native reject');};assert.equal(bridge.attach('a',next).ok,false);assert.deepEqual(native.released,['attachment-2','attachment-3']);assert.equal(native.read(),native.original);
});
test('session or composer change during registration releases uncommitted attachment without add',()=>{
  const {bridge,native}=setup();const create=native.runtime.createDrafts;native.runtime.createDrafts=(session,files)=>{const drafts=create(session,files);bridge.observeSession('b');return drafts;};
  assert.equal(bridge.attach('a',selection()).ok,false);assert.deepEqual(native.released,['attachment-1']);assert.equal(native.calls.length,0);
  bridge.observeSession('a');native.runtime.createDrafts=(session,files)=>{const drafts=create(session,files);bridge.bind('a',native.binding);return drafts;};assert.equal(bridge.attach('a',selection()).ok,false);assert.deepEqual(native.released,['attachment-1','attachment-2']);
});
test('duplicate selection uses the existing native attachment, including after table order changes',()=>{
  const {bridge,native}=setup();const context=selection();bridge.attach('a',context);const reversed={...context,products:[...context.products].reverse()};assert.match(bridge.attach('a',reversed).message,/无需重复/);assert.equal(native.created.length,1);assert.equal(native.calls.length,1);
  native.remove('attachment-1');assert.deepEqual(native.released,['attachment-1']);assert.equal(bridge.attach('a',context).ok,true);assert.equal(native.created.length,2);
});
test('same-tick duplicate click is deduplicated before the React input snapshot catches up',()=>{
  const {bridge,native}=setup();let snapshot={phase:'plain',attachmentIds:[] as string[]};native.binding.readState=()=>snapshot;
  bridge.attach('a',selection());bridge.attach('a',selection());assert.equal(native.created.length,1);
  snapshot={phase:'plain',attachmentIds:[...native.ids()]};bridge.attach('a',selection());assert.equal(native.created.length,1);
  native.remove('attachment-1');snapshot={phase:'plain',attachmentIds:[]};bridge.attach('a',selection());assert.equal(native.created.length,2);
});
test('registration failure and malformed descriptors never alter the input',()=>{
  const {bridge,native}=setup();const create=native.runtime.createDrafts;
  native.runtime.createDrafts=()=>{throw new Error('upload unavailable');};assert.equal(bridge.attach('a',selection()).ok,false);assert.equal(native.calls.length,0);
  native.runtime.createDrafts=(session,files)=>{const drafts=create(session,files);return drafts.map(draft=>({...draft,kind:'image'}));};assert.equal(bridge.attach('a',selection()).ok,false);assert.deepEqual(native.released,['attachment-1']);assert.equal(native.calls.length,0);assert.equal(native.read(),native.original);
});
test('a native upload failure remains an attached draft for native retry or removal; bridge never sends or reuploads it',()=>{
  const {bridge,native}=setup();bridge.attach('a',selection());
  // Native fileUploads changes independently of its registered File / ordered input IDs.
  const uploads={ 'attachment-1':{status:'error',message:'network failed'} };assert.equal(uploads['attachment-1'].status,'error');
  bridge.attach('a',selection());assert.equal(native.created.length,1);assert.equal(native.released.length,0);assert.equal(native.submits(),0);
  native.remove('attachment-1');assert.deepEqual(native.released,['attachment-1']);assert.deepEqual(native.ids(),[]);
});
test('native removal and manual send own release; switching views or bridge disposal does not drop accepted drafts',()=>{
  const {bridge,native}=setup();bridge.attach('a',selection());bridge.observeSession('b');bridge.attachmentRuntime(undefined);assert.equal(native.released.length,0);assert.equal(native.submits(),0);assert.equal(native.read(),native.original);
  native.manualSend();assert.equal(native.submits(),1);assert.deepEqual(native.released,['attachment-1']);assert.deepEqual(native.ids(),[]);
});
test('workspace navigates to the explicit original session and hands off once to its newly mounted input',()=>{
  const bridge=new SelectionInputBridge(),native=editor();const navigated:string[]=[];bridge.attachmentRuntime(native.runtime);bridge.observeSession('a');bridge.navigation(id=>navigated.push(id));
  assert.deepEqual(bridge.availability('a'),{available:true});assert.equal(bridge.attach('a',selection()).pending,true);assert.equal(bridge.attach('a',selection()).pending,true);assert.deepEqual(navigated,['a']);assert.equal(native.created.length,0);
  bridge.bind('a',native.binding);assert.equal(native.calls.length,1);bridge.bind('a',native.binding);assert.equal(native.calls.length,1);assert.equal(native.submits(),0);
});
test('pending handoff is cancelled on session switch; missing attachment contract disables without text fallback',()=>{
  const bridge=new SelectionInputBridge(),native=editor();bridge.attachmentRuntime(native.runtime);bridge.observeSession('a');bridge.navigation(()=>{});bridge.attach('a',selection());bridge.observeSession('b');bridge.bind('a',native.binding);assert.equal(native.calls.length,0);
  bridge.observeSession('a');const dispose=bridge.bind('a',native.binding);dispose();bridge.attach('a',selection());bridge.bind('a',undefined);assert.equal(bridge.availability('a').available,false);assert.match(bridge.notice('a')!,/没有提供原生附件/);bridge.bind('a',native.binding);assert.equal(native.calls.length,0);
  bridge.attachmentRuntime({input:{},send:()=>{throw new Error('must not send');}});assert.equal(bridge.availability('a').available,false);assert.equal(nativeAttachmentRuntime({createDrafts:()=>[],releaseDraftAttachments:()=>{}}),undefined);
});
test('binding cleanup cannot remove a newer composer and navigation errors do not leave replayable context',()=>{
  const {bridge,native}=setup();const older=bridge.bind('a',native.binding);bridge.bind('a',native.binding);older();assert.equal(bridge.availability('a').available,true);
  const other=new SelectionInputBridge();other.attachmentRuntime(native.runtime);other.observeSession('a');other.navigation(()=>{throw new Error('navigation failed');});assert.equal(other.attach('a',selection()).ok,false);other.bind('a',native.binding);assert.equal(native.calls.length,0);
});
test('expired pending selection never registers an attachment',()=>{
  const bridge=new SelectionInputBridge(),native=editor();bridge.attachmentRuntime(native.runtime);bridge.observeSession('a');bridge.navigation(()=>{});const now=Date.now;let time=10000;Date.now=()=>time;
  try{bridge.attach('a',selection());time+=10001;bridge.bind('a',native.binding);assert.equal(native.created.length,0);assert.match(bridge.notice('a')!,/超时/);}finally{Date.now=now;}
});
