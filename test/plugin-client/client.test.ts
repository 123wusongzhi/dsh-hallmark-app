import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HallmarkBridge } from '../../packages/dsh-plugin/client/api.ts';
import { valueAt, mappedValue, missingCost, sortRows, paginate, safeImageURL, sourceTime, payloadRows, toolViewId, refreshDatasetKeys } from '../../packages/dsh-plugin/client/model.ts';
import { formatValue, INITIAL_TEMPLATES } from '../../packages/presentation/src/design.ts';
import { newDraft, addWidget, addGroup, groupWidget, removeWidget, reorderWidget, draftFromTemplate } from '../../packages/dsh-plugin/client/builder-model.ts';
import { SessionSelection } from '../../packages/dsh-plugin/client/session-selection.ts';
import { APPLICATIONS, canStartChat, searchApplications } from '../../packages/dsh-plugin/client/registry.ts';
import { createClientPlugin } from '../../packages/dsh-plugin/client/plugin.ts';
import { MutationGate } from '../../packages/dsh-plugin/client/mutation-gate.ts';
import { createClickIntent } from '../../packages/dsh-plugin/client/click-intent.ts';
import type { ViewSpec } from '../../packages/presentation/src/types.ts';

test('actual apply inject callbacks return cleanup functions or iterable handles for every slot',()=>{
  const registrations:any[]=[];const effects:{name:string;handles:(()=>void)[]}[]=[];let disposed=0;const component=(props:{size?:number})=>React.createElement('span',{'data-size':props.size},'应用');const layout={selectPanel:(_id:null)=>{}};
  const workspace={openSession:(_id:string)=>{}};
  const plugin=createClientPlugin({sidebarIcon:component,main:(received,navigation)=>{assert.equal(received,layout);assert.equal(navigation,workspace);return component;},toolview:component});
  plugin.apply({get:name=>name==='layout'?layout:workspace,slots:{register:(options,render)=>{if(options.name==='sidebar.panellist'){assert.notEqual(render,component);assert.equal(renderToStaticMarkup(React.createElement(render,{size:22})),renderToStaticMarkup(React.createElement(component,{size:22})));}else assert.equal(render,component);registrations.push(options);return()=>{disposed++;};},inject:(name,effect)=>{const result=effect();assert.ok(typeof result==='function'||(result&&typeof result[Symbol.iterator]==='function'),'injection must not return void');const handles=typeof result==='function'?[result]:[...result];assert.ok(handles.every(handle=>typeof handle==='function'));effects.push({name,handles});}}});
  assert.deepEqual(registrations.map(option=>option.name),['sidebar.panellist','main','tool.call.toolview','tool.call.toolview','tool.call.toolview','tool.call.toolview']);assert.equal(registrations[0].order,10);assert.equal(registrations[1].key,'hallmark-apps');assert.deepEqual(registrations.slice(2).map(option=>option.key),['hallmark_render_view','hallmark_update_view','hallmark_open_component','hallmark_open_source_component']);for(const effect of effects)for(const dispose of effect.handles)dispose();assert.equal(disposed,6);
});
test('pointer double click cancels pending workbench, keyboard opens immediately, menus/disposal cancel timers',()=>{
  let workbench=0,chat=0,next=0;const timers=new Map<number,()=>void>();const intent=createClickIntent(()=>workbench++,()=>chat++,500,(fn,delay)=>{assert.equal(delay,500);timers.set(++next,fn);return next;},id=>{timers.delete(id as number);});
  intent.single(1);assert.equal(workbench,0);intent.single(2);intent.double();assert.equal(timers.size,0);assert.equal(chat,1);assert.equal(workbench,0);intent.single(1);for(const fn of timers.values())fn();timers.clear();assert.equal(workbench,1);intent.single(0);assert.equal(workbench,2);intent.single(1);intent.cancel();assert.equal(timers.size,0);assert.equal(chat,1);
});
test('pending activation loses authority after target switch; old finally cannot clear a newer request',()=>{
  const gate=new MutationGate();let busy=false;const old=gate.begin();busy=true;gate.reset();busy=false;assert.equal(old.controller.signal.aborted,true);assert.equal(gate.current(old),false);const next=gate.begin();busy=true;if(gate.current(old))busy=false;assert.equal(busy,true);assert.equal(gate.current(next),true);gate.reset();busy=false;assert.equal(gate.current(next),false);assert.equal(busy,false);const later=gate.begin();assert.equal(gate.current(later),true);
});
test('fieldMap/nested source paths are real and prototype traversal is blocked',()=>{
  const row={offer_id:'oz-12',profit:{margin:.173},referenceProfit:{costMissing:true}};const binding={id:'b',datasetKey:'profit:1',fieldMap:{sku:'offer_id',margin:'profit.margin'}};
  assert.equal(mappedValue(row,'sku',binding),'oz-12');assert.equal(mappedValue(row,'margin',binding),.173);assert.equal(missingCost(row),true);assert.equal(valueAt(row,'__proto__.polluted'),undefined);assert.equal(valueAt(row,'constructor.name'),undefined);assert.equal(formatValue(mappedValue(row,'margin',binding),'percent'),'17.30%');
});
test('real sortable tables are stable, null and missing-cost profits stay last both directions',()=>{
  const rows=[{id:'a',margin:.2},{id:'b',margin:.1},{id:'unknown',margin:0,costMissing:true},{id:'null',margin:null},{id:'tie',margin:.2}];
  assert.deepEqual(sortRows(rows,{field:'margin',direction:'desc'}).map(r=>r.id),['a','tie','b','unknown','null']);assert.deepEqual(sortRows(rows,{field:'margin',direction:'asc'}).map(r=>r.id),['b','a','tie','unknown','null']);assert.equal(rows[0].id,'a');
  const mapped=sortRows([{priceMinor:50},{priceMinor:20}],{field:'price',direction:'asc'},{id:'b',fieldMap:{price:'priceMinor'},datasetKey:'store_products:1'});assert.equal(mapped[0].priceMinor,20);
});
test('pagination clamps stale page after refresh and never loses the full source rows',()=>{
  const rows=Array.from({length:43},(_,id)=>({id}));assert.deepEqual(paginate(rows,2,20).rows.map(row=>row.id),[40,41,42]);assert.equal(paginate(rows,99,20).page,2);assert.equal(paginate([],5,20).page,0);assert.equal(rows.length,43);assert.equal(paginate(rows,0,2000).rows.length,43);
});
test('unknown source times, hostile images and guessed block.result are not accepted',()=>{
  assert.equal(sourceTime(null),undefined);assert.equal(sourceTime('not-a-date'),undefined);assert.equal(sourceTime('2026-10-05T12:00:00Z'),'2026-10-05T12:00:00Z');assert.equal(safeImageURL('javascript:alert(1)'),undefined);assert.equal(safeImageURL('data:image/svg+xml,attack'),undefined);assert.equal(safeImageURL('https://example.com/p.png'),'https://example.com/p.png');
  assert.equal(toolViewId({phase:'result',block:{meta:{hallmark:{viewId:'real'}}}}),'real');assert.equal(toolViewId({phase:'start',block:{meta:{hallmark:{viewId:'real'}}}}),undefined);assert.equal(toolViewId({phase:'result',block:{result:{value:{viewId:'guessed'}}}} as any),undefined);
});
test('refresh keys are explicit snapshot bindings only, temporary result sets never replayed',()=>{
  const spec={bindings:[{id:'a',datasetKey:'store_products:1'},{id:'b',datasetKey:'profit:1'},{id:'c',datasetKey:'result_set:x'},{id:'d',datasetKey:'store_products:1'},{id:'e',datasetKey:'operations:write'}]} as ViewSpec;
  assert.deepEqual(refreshDatasetKeys(spec),['store_products:1','profit:1']);assert.deepEqual(payloadRows({products:[{id:1},{id:2}]}).map(row=>row.id),[1,2]);
});
test('bridge uses only same-origin authenticated route, no service secret or direct business-write actions',async()=>{
  const calls:{url:string;init:RequestInit}[]=[];
  const fetcher=(async(url:string|URL|Request,init:RequestInit)=>{calls.push({url:String(url),init});let data:any={sessionId:'s /1',appId:'hallmark',active:true};if(String(url).includes('resource=saved'))data={entries:[],components:[],templates:[]};if(init.body&&JSON.parse(String(init.body)).action==='openEntry')data={id:'v1'};return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});}) as typeof fetch;
  const bridge=new HallmarkBridge('s /1',fetcher);await bridge.state();await bridge.saved();await bridge.activate();await bridge.close();await bridge.openEntry('entry');await bridge.refresh('store_products:1');
  for(const call of calls){assert.ok(call.url.startsWith('/api/hallmark-app'));assert.equal(call.init.credentials,'same-origin');assert.ok(!JSON.stringify(call.init).toLowerCase().includes('authorization'));assert.ok(!JSON.stringify(call.init).includes('Bearer'));}
  assert.match(calls[0].url,/sessionId=s\+%2F1/);assert.deepEqual(calls.slice(2).map(c=>JSON.parse(String(c.init.body)).action),['activate','close','openEntry','refresh']);assert.equal(JSON.parse(String(calls[4].init.body)).entryId,'entry');
});
test('bridge error is friendly and abort signals remain attached',async()=>{
  const controller=new AbortController();let supplied:AbortSignal|null|undefined;const fetcher=(async(_url:unknown,init:RequestInit)=>{supplied=init.signal;return new Response(JSON.stringify({error:{code:'APP_NOT_ACTIVE',message:'应用未启用'}}),{status:403});}) as typeof fetch;
  const bridge=new HallmarkBridge('s',fetcher);await assert.rejects(bridge.view('v',controller.signal),/应用未启用/);assert.equal(supplied,controller.signal);await assert.rejects(new HallmarkBridge('',fetcher).state(),/当前会话/);
});
test('builder offers real seven-widget design, nested group/reorder/delete and exact Hallmark templates',()=>{
  let draft=newDraft();for(const type of ['stat_card','table','bar_chart','line_chart','product_card','status_badge'] as const)draft=addWidget(draft,type);assert.equal(draft.widgets.length,7);assert.equal(draft.bindings.length,1);assert.equal(draft.bindings[0].datasetKey,'');const table=draft.widgets.find(w=>w.type==='table')!;assert.equal(table.columns?.[0].field,'title');
  draft=addGroup(draft,'row');const groupIndex=draft.layout.children.length-1;draft=groupWidget(draft,table.id,groupIndex);const group=draft.layout.children.find(child=>typeof child!=='string') as any;assert.deepEqual(group.children,[table.id]);draft=removeWidget(draft,table.id);assert.ok(!draft.widgets.some(w=>w.id===table.id));assert.deepEqual((draft.layout.children.find(child=>typeof child!=='string') as any).children,[]);const before=draft.layout.children[0];draft=reorderWidget(draft,String(before),1);assert.equal(draft.layout.children[1],before);
  const overview=draftFromTemplate(INITIAL_TEMPLATES[0]);assert.equal(overview.widgets[0].columns?.[0].field,'offerId');assert.equal(overview.widgets[0].columns?.[1].field,'title');const profit=draftFromTemplate(INITIAL_TEMPLATES[1]);assert.equal(profit.widgets[0].columns?.[1].field,'referenceProfit.margin');assert.equal(formatValue('123.45','currency'),formatValue(123.45,'currency'));assert.equal(formatValue('','currency'),'无法判断');assert.equal(formatValue('Infinity','currency'),'无法判断');
});
test('session cache only preserves a uniquely observed chat during apps navigation and rejects deletion/ambiguity',()=>{
  const selection=new SessionSelection();assert.equal(selection.observe({byId:{a:{id:'a',retainedBy:{mainView:1}},b:{id:'b'}}},null),'a');assert.equal(selection.observe({byId:{a:{id:'a'},b:{id:'b'}}},'hallmark-apps'),'a');assert.equal(selection.observe({byId:{b:{id:'b'}}},'hallmark-apps'),undefined);assert.equal(selection.observe({byId:{a:{id:'a'},b:{id:'b'}}},'hallmark-apps'),undefined);assert.equal(selection.observe({byId:{a:{id:'a'},b:{id:'b',retainedBy:{mainView:1}}}},null),'b');assert.equal(selection.observe({byId:{a:{id:'a'},b:{id:'b'}}},'plugins'),undefined);assert.equal(selection.observe({byId:{a:{id:'a',retainedBy:{mainView:1}},b:{id:'b',retainedBy:{mainView:1}}}},null),undefined);
});
test('registry contains only real Hallmark metadata; adding another name cannot acquire Hallmark authority',()=>{
  assert.equal(APPLICATIONS.length,1);assert.equal(APPLICATIONS[0].id,'hallmark');assert.equal(searchApplications('利润')[0].id,'hallmark');assert.equal(searchApplications('not-installed').length,0);assert.equal(canStartChat('hallmark'),true);assert.equal(canStartChat('future-other-app'),false);
});
test('health is a narrow read-only DTO and never inferred from active chat or credentials',async()=>{
  const calls:string[]=[];const fetcher=(async(url:unknown)=>{calls.push(String(url));return new Response(JSON.stringify({serviceStatus:'ok',hallmarkStatus:'unavailable',ignoredSecret:'not-returned'}));}) as typeof fetch;const value=await new HallmarkBridge('',fetcher).health();assert.deepEqual(value,{serviceStatus:'ok',hallmarkStatus:'unavailable'});assert.equal(calls[0],'/api/hallmark-app?resource=health');
});
test('primary UI has an always-visible application rail, no modal and no initial selected app',()=>{
  const page=readFileSync(new URL('../../packages/dsh-plugin/client/page.tsx',import.meta.url),'utf8');const plugin=readFileSync(new URL('../../packages/dsh-plugin/client/plugin.ts',import.meta.url),'utf8');const entry=readFileSync(new URL('../../packages/dsh-plugin/client/index.tsx',import.meta.url),'utf8');assert.ok(page.includes('hm-directory-rail hm-app-rail'));assert.ok(page.includes('useState<string|undefined>()'));assert.ok(page.includes('选择应用进入工作台'));assert.ok(!page.includes('<dialog'));assert.ok(!page.includes('showModal('));assert.ok(!plugin.includes('shell.overlay'));assert.ok(!entry.includes('selectPanel(null)'));assert.ok(entry.includes('workspace.openSession(sessionId)'));
});
test('workbench preview/read/save are session-independent but chat activation requires exact session',async()=>{
  const bodies:any[]=[];const fetcher=(async(_url:unknown,init:RequestInit)=>{if(init.body)bodies.push(JSON.parse(String(init.body)));return new Response(JSON.stringify({id:'v'}));}) as typeof fetch;const bridge=new HallmarkBridge('',fetcher);const draft=newDraft();await bridge.preview(draft);await bridge.saveComponent('v','Title');await bridge.saveTemplate('v','Template');assert.deepEqual(bodies.map(value=>value.action),['preview','saveComponent','saveTemplate']);assert.ok(bodies.every(value=>!Object.hasOwn(value,'sessionId')&&!Object.hasOwn(value,'userRequest')));await assert.rejects(bridge.activate(),/当前会话/);
});
test('source has native React seven-widget interaction and no HTML/raw-result/automatic-save escape hatch',()=>{
  const renderer=readFileSync(new URL('../../packages/dsh-plugin/client/renderer.tsx',import.meta.url),'utf8')+readFileSync(new URL('../../packages/dsh-plugin/client/widgets/product-table.tsx',import.meta.url),'utf8');const entry=readFileSync(new URL('../../packages/dsh-plugin/client/index.tsx',import.meta.url),'utf8');const api=readFileSync(new URL('../../packages/dsh-plugin/client/api.ts',import.meta.url),'utf8');
  for(const type of ['stat_card','table','bar_chart','line_chart','product_card','status_badge','text'])assert.ok(renderer.includes(`'${type}'`));assert.ok(renderer.includes('aria-sort'));assert.ok(renderer.includes('role="tablist"'));assert.ok(renderer.includes('ArrowLeft'));assert.ok(renderer.includes('下一页'));assert.ok(!renderer.includes('dangerouslySetInnerHTML'));assert.ok(!entry.includes('block.result'));assert.ok(!api.includes('save_component'));assert.ok(!api.includes('save_entry'));assert.ok(!api.includes('update_price'));assert.ok(!api.includes('update_stock'));
});
