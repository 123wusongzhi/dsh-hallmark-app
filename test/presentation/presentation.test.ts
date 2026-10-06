import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppStore } from '../../packages/store/src/index.ts';
import { PresentationManager, applyPatch, validateViewSpec, THEMES, contrastRatio, formatValue, renderViewHTML, WIDGET_TYPES } from '../../packages/presentation/src/index.ts';
import type { ViewSpec, BindingData } from '../../packages/presentation/src/types.ts';
const spec = (): ViewSpec => ({id:'view',title:'商品',layout:{type:'column',children:['table']},widgets:[{id:'table',type:'table',bindingId:'main',columns:[{field:'name',label:'名称'}]}],bindings:[{id:'main',datasetKey:'store_products:1',fieldMap:{}}]});
function memory(t: any): {store: AppStore; manager:PresentationManager} {const store = new AppStore(':memory:'); t.after(() => store.close()); return {store,manager:new PresentationManager(store)};}
test('draft persists without publishing; explicit userRequest required for each library save', t => {
  const {store,manager} = memory(t); manager.renderView(spec()); assert.equal(manager.listSaved().entries.length,0); assert.equal(store.list('views').length,1);
  assert.throws(() => manager.saveComponent('view',' '),/userRequest/); assert.throws(() => manager.saveTemplate('view','name',''),/userRequest/); assert.throws(() => manager.saveEntry(spec().bindings[0],'entry',''),/userRequest/);
  const saved = manager.saveComponent('view','保存这个组件'); assert.equal(saved.entry.viewId,'view'); assert.equal(manager.listSaved().entries.length,1); manager.saveComponent('view','再保存'); assert.equal(manager.listSaved().entries.length,1);
  assert.equal(store.get<any>('components','view').userRequest,'再保存');
});
test('saved component and unpublished draft edits independently persist after reopen', t => {
  const dir = mkdtempSync(join(tmpdir(),'hallmark-present-')); t.after(() => rmSync(dir,{recursive:true,force:true})); const path = join(dir,'app.db');
  const store = new AppStore(path), manager = new PresentationManager(store); manager.renderView(spec()); manager.saveComponent('view','保存'); manager.updateView('view',[{op:'replace',path:'/title',value:'草稿'}]); assert.equal(manager.getView('view')?.title,'草稿'); store.close();
  const reopened = new AppStore(path); try { const next = new PresentationManager(reopened); assert.equal(next.getView('view')?.title,'草稿'); assert.equal(next.listSaved().components[0].title,'商品'); assert.equal(next.listSaved().entries.length,1); } finally {reopened.close();}
});
test('JSON Patch changes columns sorting title atomically and defends prototype pollution', () => {
  const original = spec(); const patched = applyPatch(original,[{op:'add',path:'/widgets/0/columns/-',value:{field:'margin',label:'参考利润率',format:'percent'}},{op:'add',path:'/widgets/0/options',value:{sort:{field:'margin',direction:'desc'}}},{op:'replace',path:'/title',value:'低利润商品'}]); assert.equal(patched.widgets[0].columns?.length,2); assert.equal(patched.title,'低利润商品'); assert.equal(original.title,'商品');
  for (const path of ['/__proto__/polluted','/theme/constructor/prototype','/widgets/0/options/__proto__']) assert.throws(() => applyPatch(original,[{op:'add',path,value:true}]),/Unsafe/);
  assert.throws(() => applyPatch(original,[{op:'replace',path:'/title',value:'changed'},{op:'test',path:'/title',value:'incorrect'}]),/test failed/); assert.equal(original.title,'商品');
  assert.throws(() => applyPatch(original,[{op:'remove',path:'/widgets/00'}]),/index/); assert.throws(() => applyPatch(original,[{op:'replace',path:'/id',value:'new'}]),/immutable/); assert.equal(({} as any).polluted,undefined);
});
test('bindings only read/compute, reject inline business table and credential/prototype fields', t => {
  const {manager} = memory(t);
  for (const tool of ['hallmark_update_price','hallmark_update_stock','hallmark_list_product','hallmark_refresh_data','arbitrary','hallmark_get_operation']) assert.throws(() => manager.saveEntry({id:'x',query:{tool,params:{}},fieldMap:{}},'entry','保存'),/cannot write/);
  assert.throws(() => manager.renderView({...spec(),data:[{id:1}]} as any),/unknown field/); assert.throws(() => manager.renderView({...spec(),widgets:[{...spec().widgets[0],data:[{id:1}]}]} as any),/unknown field/);
  assert.throws(() => manager.renderView(JSON.parse(JSON.stringify(spec()).replace('"fieldMap":{}','"fieldMap":{"__proto__":"bad"}'))),/Unsafe/);
  assert.throws(() => manager.renderView({...spec(),widgets:[{...spec().widgets[0],options:{data:[{id:1}]}}]} as any),/unknown field/);
  manager.saveEntry({id:'q',query:{tool:'hallmark_list_store_products',params:{storeId:'2'}},fieldMap:{}},'店铺2','保存查询');
});
test('template reuse preserves design, swaps binding; deletion cannot break saved component', t => {
  const {manager,store} = memory(t); manager.renderView(spec()); const template = manager.saveTemplate('view','我的模板','保存模板'); const second = manager.renderFromTemplate(template.id,'店铺2',[{id:'other',datasetKey:'store_products:2',fieldMap:{}}]); assert.deepEqual(second.layout,template.layout); assert.deepEqual(second.widgets,template.widgetStyles); assert.equal(second.bindings[0].datasetKey,'store_products:2'); manager.saveComponent(second.id,'保存组件'); manager.manageSaved('template',template.id,{action:'delete'}); assert.deepEqual(manager.getView(second.id)?.widgets,template.widgetStyles); assert.equal(store.get<any>('components',second.id).template.version,1);
});
test('getViewData local snapshots retain layout and previous data after failed refresh; empty/expired recognized', t => {
  const {manager,store} = memory(t); manager.renderView(spec()); assert.equal(manager.getViewData('view').error?.code,'SNAPSHOT_EMPTY'); store.updateSnapshotSuccess('store_products:1',[{name:'商品A'}],'2026-10-05',{metricBasis:'参考利润，非实际结算'}); const before = manager.getView('view'); store.updateSnapshotState('store_products:1','failed',{message:'offline'}); const data = manager.getViewData('view'); assert.equal(data.status,'ok'); assert.equal(data.data?.bindings[0].state,'failed'); assert.deepEqual(data.data?.bindings[0].payload,[{name:'商品A'}]); assert.deepEqual(manager.getView('view'),before);
  const resultSpec = spec(); resultSpec.bindings[0].datasetKey = 'result_set:abc'; manager.renderView(resultSpec); store.put('result_sets','abc',{payload:[{name:'筛选'}],expiresAt:new Date(Date.now()+60_000).toISOString()}); assert.equal(manager.getViewData('view').status,'ok'); store.put('result_sets','abc',{payload:[{name:'筛选'}],expiresAt:'2000-01-01'}); assert.equal(manager.getViewData('view').error?.code,'SNAPSHOT_EMPTY');
});
test('all seven widgets render safely with source/time/basis; unknown cost is never zero', () => {
  const view: ViewSpec = {id:'seven',title:'<script>attack</script>',layout:{type:'grid',columns:2,children:WIDGET_TYPES.map(type => type)},widgets:WIDGET_TYPES.map(type => ({id:type,type,...(type === 'text' ? {text:'<img onerror="alert(1)">'} : {bindingId:'main',fields:{value:'margin'},columns:[{field:'margin',label:'参考利润率',format:'percent' as const}]} )})),bindings:[{id:'main',datasetKey:'profit:1',fieldMap:{}}]};
  const data: BindingData[] = [{bindingId:'main',datasetKey:'profit:1',payload:[{name:'A',margin:0.1,costMissing:true}],state:'ready',dataTime:'2026-10-05',provenance:{source:'app_snapshot'},metricBasis:'参考模型，非实际结算'}];
  const html = renderViewHTML(view,data); for (const type of WIDGET_TYPES) assert.ok(html.includes(`data-widget="${type}"`)); assert.ok(html.includes('无法判断（缺成本）')); assert.ok(html.includes('参考模型，非实际结算')); assert.ok(!html.includes('<script>attack')); assert.ok(html.includes('&lt;img onerror='));
  const misleading = spec(); misleading.widgets[0].columns = [{field:'margin',label:'实际结算净利润率'}]; assert.throws(() => validateViewSpec(misleading),/Reference profits/);
});
test('formatting and semantic theme contrasts meet 4.5:1', () => {
  assert.equal(formatValue(0.15,'percent'),'15.00%'); assert.equal(formatValue(null,'percent'),'—'); assert.equal(formatValue('missing','percent'),'无法判断'); assert.match(formatValue(123,'currency'),/123.00/);
  for (const theme of Object.values(THEMES)) for (const foreground of ['text','mutedText','primary','profit','loss','warning'] as const) assert.ok(contrastRatio(theme[foreground],theme.surface) >= 4.5,`${foreground} ${contrastRatio(theme[foreground],theme.surface)}`);
});
