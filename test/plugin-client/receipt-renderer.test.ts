// Isolated synthetic receipt fixtures; this verifies actual React markup, not live business data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { formatValue } from '../../packages/presentation/src/design.ts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BindingData, DataBinding, ViewSpec, WidgetSpec, WidgetType } from '../../packages/presentation/src/types.ts';
const result=await build({entryPoints:[fileURLToPath(new URL('../../packages/dsh-plugin/client/renderer.tsx',import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,external:['react']});
const compiled={exports:{} as {ViewRenderer:React.ComponentType<{spec:ViewSpec;data:BindingData[]}>;resolvedBadgeStatus:(widget:WidgetSpec,binding:DataBinding|undefined,data:BindingData)=>unknown}};
// Evaluate only our freshly compiled local renderer; no untrusted payload/code enters this source.
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),compiled,compiled.exports);
const {ViewRenderer,resolvedBadgeStatus}=compiled.exports;
const binding:DataBinding={id:'b',datasetKey:'operation:synthetic-test',fieldMap:{}};
const widget:WidgetSpec={id:'badge',type:'status_badge',bindingId:'b'};
const metric='操作账本记录时间，不是商品/价格源时间；imported不代表on_sale。';
function receipt(state:string,items:unknown[]=[]):BindingData{return {bindingId:'b',datasetKey:'operation:synthetic-test',state:'ready',payload:{operationId:'synthetic-test',kind:'list_product',state,items},provenance:{source:'app_snapshot',timeBasis:'operation_record_updated_at'},metricBasis:metric,dataTime:'2026-01-01T00:00:00Z'};}
function markup(widgets:WidgetSpec[],data:BindingData){const spec:ViewSpec={id:'test',title:'合成回执测试',bindings:[binding],widgets,layout:{type:'column',children:widgets.map(item=>item.id)}};return renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data:[data]}));}
test('actual status badge uses receipt root partial, not first succeeded item, and preserves raw item table states',()=>{
  const data=receipt('partial',[{target:'a',state:'succeeded',message:''},{target:'b',state:'failed',message:'原始失败'}]);const original=structuredClone(data.payload);const html=markup([widget,{id:'items',type:'table',bindingId:'b',columns:[{field:'target',label:'目标'},{field:'state',label:'逐项状态'}]}],data);
  assert.match(html,/<span class="hm-badge" role="status">partial<\/span>/);
  const body=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1];assert.ok(body,'the actual receipt item table is rendered');
  const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(row=>[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell=>cell[1].replace(/<[^>]*>/g,'').trim()));
  assert.deepEqual(rows,[['a','succeeded'],['b','failed']],'visible item states stay attached to their targets despite presentation wrappers');
  assert.deepEqual(data.payload,original);
});
test('empty-item pending/running/unknown receipts never fall back to cache ready',()=>{
  for(const state of ['pending','running','unknown']){assert.equal(resolvedBadgeStatus(widget,binding,receipt(state)),state);assert.match(markup([widget],receipt(state)),new RegExp(`<span class="hm-badge" role="status">${state}</span>`));}
});
test('receipt root alias mappings and explicit status override root state without reading item states',()=>{
  const data=receipt('partial',[{state:'succeeded'}]);(data.payload as Record<string,unknown>).status='unknown';assert.equal(resolvedBadgeStatus(widget,binding,data),'unknown');assert.equal(resolvedBadgeStatus({...widget,fields:{status:'aggregate'}},{...binding,fieldMap:{aggregate:'state'}},data),'partial');delete (data.payload as Record<string,unknown>).status;delete (data.payload as Record<string,unknown>).state;assert.equal(resolvedBadgeStatus(widget,binding,data),'未知');
});
test('nonreceipt datasets retain first-row mapped status and normal snapshot-state fallback',()=>{
  const data:BindingData={bindingId:'b',datasetKey:'store_products:real',state:'ready',payload:{products:[{lifecycle:'available'}]},provenance:{source:'hallmark_snapshot'}};assert.equal(resolvedBadgeStatus({...widget,fields:{status:'badge'}},{...binding,fieldMap:{badge:'lifecycle'}},data),'available');assert.equal(resolvedBadgeStatus(widget,binding,{...data,payload:{items:[]}}),'ready');assert.match(markup([widget],data),/数据时间：未知/);assert.ok(!markup([widget],data).includes('操作记录时间：'));
});
test('all seven widget footers show receipt metric/time basis with no price-time or on-sale conflation',()=>{
  const types:WidgetType[]=['stat_card','table','bar_chart','line_chart','product_card','status_badge','text'];const widgets=types.map((type,index):WidgetSpec=>({id:`w${index}`,type,bindingId:'b',text:'合成测试',columns:type==='table'?[{field:'state',label:'状态'}]:undefined}));const html=markup(widgets,receipt('partial',[{state:'succeeded'}]));assert.equal((html.match(/操作记录时间：/g)??[]).length,7);assert.equal((html.match(/operation_record_updated_at/g)??[]).length,7);assert.equal((html.match(/imported不代表on_sale/g)??[]).length,7);assert.ok(!html.includes('>数据时间：'));assert.equal((html.match(/不是平台商品\/价格源数据时间/g)??[]).length,7);
});
test('root payload metric basis and provenance metric basis appear on nonprofit widgets too',()=>{
  const data=receipt('succeeded');delete data.metricBasis;(data.payload as Record<string,unknown>).metricBasis='真实回执根口径';assert.match(markup([widget],data),/口径：真实回执根口径/);delete (data.payload as Record<string,unknown>).metricBasis;data.provenance.metricBasis='来源明确口径';assert.match(markup([widget],data),/口径：来源明确口径/);
});
test('saved/cache top-level timeBasis and raw ledger updatedAt are recognized without using price data time',()=>{
  const data=receipt('pending');data.datasetKey='query:synthetic-receipt';data.provenance={source:'app_snapshot'};Object.assign(data,{timeBasis:'operation_record_updated_at'});data.payload={state:'pending',items:[{state:'succeeded'}],provenance:{updatedAt:'2026-06-01T00:00:00Z'}};data.dataTime='2024-01-01T00:00:00Z';assert.equal(resolvedBadgeStatus(widget,binding,data),'pending');const html=markup([widget],data);assert.match(html,/操作记录时间：/);assert.ok(html.includes(formatValue('2026-06-01T00:00:00Z','date')));assert.ok(!html.includes(formatValue(data.dataTime,'date')));assert.match(html,/不是平台商品\/价格源数据时间/);delete (data as any).timeBasis;Object.assign(data,{data:{timeBasis:'operation_record_updated_at'}});assert.equal(resolvedBadgeStatus(widget,binding,data),'pending');
});
