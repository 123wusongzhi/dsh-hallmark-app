import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createMaterialView,MATERIAL_CATALOG,materialExampleData} from '../../packages/app-presentation/src/materials/catalog.ts';
import {validateViewSpec} from '../../packages/presentation/src/validation.ts';
import {toRenderSpec} from '../../packages/dsh-plugin/client/render-catalog.ts';
import {materialDisplay,materialRows,materialValue} from '../../packages/dsh-plugin/client/widgets/material-format.ts';
import type {BindingData,ViewSpec,WidgetSpec} from '../../packages/presentation/src/types.ts';
import type {ViewInteractions} from '../../packages/dsh-plugin/client/material-interactions.ts';

const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
const result=await build({entryPoints:[fileURLToPath(new URL('../../packages/dsh-plugin/client/renderer.tsx',import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,external:['react']});
const compiled={exports:{} as {ViewRenderer:React.ComponentType<{spec:ViewSpec;data:BindingData[];interactions?:ViewInteractions}>}};
new Function('require','module','exports',result.outputFiles[0].text)(require,compiled,compiled.exports);
const {ViewRenderer}=compiled.exports;
function fixture(){
  const spec=createMaterialView('product-list');
  Object.assign(spec.widgets[0],{fields:{'product.id':'id','product.name':'title','product.image':'image','price.current':'minor','price.currency':'currency'},options:{columns:[{field:'product.image'},{field:'product.name',label:'我的商品'},{field:'price.current'}],pageSize:1,density:'compact',fieldMeta:{'price.current':{numericScale:.01}}}});
  const data:BindingData={bindingId:'products',datasetKey:'fixture',state:'ready',payload:[{id:'p1',title:'红色杯子',image:'https://example.com/test-image.png',minor:1234,currency:'CNY'},{id:'p2',title:'蓝色杯子',minor:990,currency:'CNY'}],provenance:{source:'test_fixture'}};
  return {spec,data};
}
test('materials expand to valid native view specs, require semantic bindings, and preserve editable preset links',()=>{
  for(const material of MATERIAL_CATALOG){const spec=createMaterialView(material.id);validateViewSpec(spec);const tree=toRenderSpec(spec);assert.ok(Object.values(tree.elements).some(element=>['ProductList','SkuDetail','ProductTable'].includes(element.type)));assert.ok(!JSON.stringify(tree).includes('price.current'));assert.ok(material.bindingRoles);}
  const spec=createMaterialView('product-browser');assert.deepEqual(spec.links,[{from:{widgetId:'products',event:'select',field:'product.id'},to:{bindingId:'sku',param:'productId'}}]);
  assert.throws(()=>validateViewSpec({...spec,links:[{from:{widgetId:'missing',event:'select',field:'product.id'},to:{bindingId:'sku',param:'productId'}}]}),/Link/);
  assert.throws(()=>validateViewSpec({...spec,links:[{from:{widgetId:'products',event:'select',field:'product.id'},to:{bindingId:'sku',param:'constructor'}}]}),/parameter/);
  assert.ok(!getCollectionRoles().some(role=>/margin|sales|views/.test(role)));
});
function getCollectionRoles(){const item=MATERIAL_CATALOG.find(item=>item.id==='collection-box')!;return [...item.requiredRoles,...item.optionalRoles];}
test('semantic rendering preserves missingness, decimal units, explicit percentage scale, currency and flat semantic aliases',()=>{
  const {spec}=fixture(),widget=spec.widgets[0];
  assert.equal(materialDisplay({minor:1234,currency:'CNY'},'price.current',widget),'CNY 12.34');
  assert.equal(materialDisplay({minor:0,currency:'CNY'},'price.current',widget),'CNY 0.00');
  assert.equal(materialDisplay({minor:null,currency:'CNY'},'price.current',widget),'暂无数据');
  assert.equal(materialDisplay({minor:10},'price.current',widget),'暂无数据（币种未确认）');
  const percent:WidgetSpec={id:'w',type:'product_list',options:{fieldMeta:{'metric.margin':{percentScale:'whole'}}}};
  assert.equal(materialDisplay({'metric.margin':12.3},'metric.margin',percent),'12.3%');
  assert.equal(materialValue({'product.name':'语义字段'},'product.name',{id:'w',type:'product_list'}),'语义字段');
  assert.deepEqual(materialRows({outer:{rows:[{id:1}]}},{...widget,options:{rowsPath:'outer.rows'}}),[{id:1}]);
  assert.equal(materialDisplay({raw:'unconfirmed'},'product.name',{...widget,fields:{'product.name':'raw'},options:{fieldMeta:{'product.name':{confirmed:false}}}}),'暂无数据');
});
test('native product list actually filters, sorts, pages, selects and replaces a failed image',()=>{
  const {spec,data}=fixture(),selected:unknown[]=[];let tree:any;
  const interactions:ViewInteractions={onSelect:event=>selected.push(event),bindings:{products:{pagination:{total:100,loadedCount:2},operations:{search:'loaded',sort:'loaded'}}}};
  act(()=>{tree=create(React.createElement(ViewRenderer,{spec,data:[data],interactions}));});
  const text=()=>JSON.stringify(tree.toJSON());
  assert.match(text(),/CNY 12.34/);assert.match(text(),/已加载 2 \/ 共 100/);assert.match(text(),/我的商品/);
  const image=tree.root.findByType('img');assert.equal(image.props.loading,'lazy');assert.equal(image.props.referrerPolicy,'no-referrer');
  act(()=>image.props.onError());assert.equal(tree.root.findAllByType('img').length,0);assert.match(text(),/暂无商品图片/);
  const rows=()=>tree.root.findAll((node:any)=>node.type==='tr'&&node.props.tabIndex===0);
  act(()=>rows()[0].props.onKeyDown({key:'Enter',preventDefault(){}}));assert.equal((selected[0] as any).value,'p1');
  const button=(label:string)=>tree.root.findAllByType('button').find((node:any)=>node.children.includes(label));
  act(()=>button('下一页').props.onClick());assert.match(text(),/CNY 9.90/);
  act(()=>tree.root.findByType('input').props.onChange({target:{value:'红色'}}));assert.match(text(),/红色杯子/);assert.doesNotMatch(text(),/蓝色杯子/);
  act(()=>tree.root.findByType('input').props.onChange({target:{value:'p2'}}));assert.match(text(),/蓝色杯子/);assert.doesNotMatch(text(),/红色杯子/);
  act(()=>tree.root.findByType('input').props.onChange({target:{value:''}}));
  act(()=>button('当前售价').props.onClick({persist(){},shiftKey:false}));assert.match(text(),/CNY 9.90/);
  act(()=>tree.unmount());
});
test('server operations emit explicit queries and remote paging callback without pretending local sorting is global',()=>{
  const {spec,data}=fixture(),queries:unknown[]=[];let pages=0,tree:any;
  act(()=>{tree=create(React.createElement(ViewRenderer,{spec,data:[data],interactions:{bindings:{products:{pagination:{hasMore:true,total:100},operations:{search:'server',sort:'server'},onQueryChange:query=>queries.push(query),onPage:()=>{pages++;}}}}}));});
  act(()=>tree.root.findByType('input').props.onChange({target:{value:'blue'}}));assert.equal(queries.length,0);
  act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.deepEqual(queries[0],{search:'blue'});
  const button=(label:string)=>tree.root.findAllByType('button').find((node:any)=>node.children.includes(label));
  act(()=>button('当前售价').props.onClick({persist(){},shiftKey:false}));assert.deepEqual(queries[1],{search:'blue',sort:{field:'price.current',direction:'asc'}});
  act(()=>button('下一批').props.onClick());assert.equal(pages,1);assert.match(JSON.stringify(tree.toJSON()),/搜索：.*全部商品/);
  act(()=>tree.unmount());
});
test('SKU detail waits for selection and hides previous product rows while switching',()=>{
  const spec=createMaterialView('product-browser'),data=materialExampleData(spec);
  const html=(interactions?:ViewInteractions)=>renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data,interactions}));
  assert.match(html(),/请选择一个商品/);assert.match(html(),/示例/);
  const selected=html({bindings:{sku:{selectedProductId:'example-2'}}});assert.match(selected,/DEMO-WHITE/);assert.doesNotMatch(selected,/DEMO-BLUE/);assert.doesNotMatch(selected,/利润率|库存|选品评分/);
  const loading=html({bindings:{sku:{selectedProductId:'example-2',pagination:{loading:true}}}});assert.match(loading,/正在读取所选商品/);assert.doesNotMatch(loading,/DEMO-WHITE/);
});
test('activity material reuses table and resolves provider row paths and date aliases without write actions',()=>{
  const spec=createMaterialView('activity-list');validateViewSpec(spec);
  spec.bindings[0].fieldMap={'activity.name':'name','activity.status':'status','activity.startsAt':'from','activity.endsAt':'to'};
  spec.widgets[0].options={...spec.widgets[0].options,rowsPath:'result.activities',fieldMeta:{'activity.name':{label:'活动名称'}},example:false};validateViewSpec(spec);
  const data:BindingData={bindingId:'activities',datasetKey:'fixture',state:'ready',payload:{result:{activities:[{name:'真实结构活动',status:'active',from:'2026-10-08T00:00:00Z',to:'2026-10-12T00:00:00Z'}]}},provenance:{source:'synthetic_fixture'}};
  const html=renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data:[data]}));assert.match(html,/真实结构活动/);assert.match(html,/2026\/10\/08/);assert.doesNotMatch(html,/报名|修改活动|示例<\/span>/);
  const example=createMaterialView('activity-list'),preview=renderToStaticMarkup(React.createElement(ViewRenderer,{spec:example,data:materialExampleData(example)}));assert.match(preview,/示例 · 秋季促销/);assert.match(preview,/hm-material-example/);
});

test('Ozon generic tables use declared amount units and currencies and distinguish permission failures from empty results',()=>{
  const spec=createMaterialView('data-table'),widget=spec.widgets[0];
  widget.columns=[{field:'ozon.amount',label:'记账金额'},{field:'ozon.actualWeight',label:'物流实重'}];
  widget.fields=spec.bindings[0].fieldMap={'ozon.amount':'amount','ozon.actualWeight':'weight'};
  widget.options={...widget.options,rowsPath:'items',fieldMeta:{'ozon.amount':{format:'currency',currencyPath:'currency',numericScale:0.01},'ozon.actualWeight':{format:'integer',unit:'克'}}};
  const data:BindingData={bindingId:'main',datasetKey:'fixture',state:'ready',payload:{items:[{amount:4497,currency:'CNY',weight:310},{amount:10,currency:null,weight:null}]},provenance:{source:'synthetic_fixture'}};
  const html=renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data:[data]}));
  assert.match(html,/44\.97/);assert.match(html,/CNY/);assert.match(html,/310 克/);assert.match(html,/币种未确认/);assert.doesNotMatch(html,/RUB/);
  const denied=renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data:[{...data,state:'unavailable',payload:null,lastError:{message:'当前店铺没有财务读取权限'}}]}));
  assert.match(denied,/当前店铺没有财务读取权限/);assert.doesNotMatch(denied,/没有匹配记录/);
});

test('temporary refresh failures keep cached native rows while permission and connection changes hide them',()=>{
  const spec=createMaterialView('data-table'),widget=spec.widgets[0];
  widget.columns=[{field:'title',label:'商品'}];widget.options={...widget.options,rowsPath:'items'};
  const data:BindingData={bindingId:'main',datasetKey:'same-query',state:'unavailable',payload:{items:[{title:'上次成功的经营行'}]},lastSuccessAt:'2026-10-09T03:00:00Z',provenance:{source:'synthetic_fixture'}};
  const render=(lastError:unknown,payload:unknown=data.payload)=>renderToStaticMarkup(React.createElement(ViewRenderer,{spec,data:[{...data,lastError,payload}]}));
  for(const code of ['LOCAL_RATE_LIMIT','HALLMARK_HTTP_503']){
    const html=render({code,message:'稍后重试',retryPolicy:'read_retry'});
    assert.match(html,/上次成功的经营行/);assert.match(html,/显示已缓存数据/);assert.doesNotMatch(html,/hm-error/);
  }
  for(const error of [{code:'PERMISSION_DENIED',message:'权限已变更',retryPolicy:'never'},{code:'HALLMARK_HTTP_403',message:'访问不可用',retryPolicy:'read_retry'},{code:'CONNECTION_CONFIG_CHANGED',message:'连接已变更',retryPolicy:'read_retry'}]){
    const html=render(error);assert.doesNotMatch(html,/上次成功的经营行/);assert.doesNotMatch(html,/显示已缓存数据/);assert.match(html,/hm-error/);
  }
  const waiting=render({code:'LOCAL_RATE_LIMIT',retryPolicy:'read_retry'},null);
  assert.match(waiting,/数据正在准备/);assert.doesNotMatch(waiting,/hm-error|上次成功的经营行|显示已缓存数据/);
});

test('semantic activity tables label absent fields without changing configured columns, dates, zero or legacy tables',()=>{
  const spec=createMaterialView('activity-list'),widget=spec.widgets[0];
  widget.columns=[{field:'activity.status',label:'平台状态'},{field:'activity.startsAt',label:'起始时间',format:'date'},{field:'activity.name',label:'我的活动'},{field:'activity.endsAt',label:'结束时间',format:'date'},{field:'activity.id',label:'编号'}];
  const originalColumns=structuredClone(widget.columns);
  widget.fields=spec.bindings[0].fieldMap={'activity.id':'id','activity.name':'title','activity.startsAt':'from','activity.endsAt':'to'};
  widget.options={...widget.options,rowsPath:'response.result',fieldMeta:{'activity.id':{format:'text'},'activity.name':{label:'活动名称'},'activity.startsAt':{format:'datetime'},'activity.endsAt':{format:'datetime'}}};
  const iso='2026-10-08T00:00:00Z',data:BindingData={bindingId:'activities',datasetKey:'fixture',state:'ready',payload:{response:{result:[{id:0,title:'活动真实名称',from:iso,to:''}]}},provenance:{source:'synthetic_fixture'}};
  let tree:any;act(()=>{tree=create(React.createElement(ViewRenderer,{spec,data:[data]}));});
  const cells=tree.root.findAllByType('td');
  assert.deepEqual(tree.root.findAllByType('th').map((node:any)=>node.findByType('button').props['aria-label']),originalColumns.map(column=>`${column.label}，点击排序`));
  assert.equal(cells[0].findByType('span').children.join(''),'暂无数据','an optional unmapped activity status is missing');
  assert.equal(cells[1].findByType('time').props.dateTime,iso,'existing date formatting retains the source timestamp');
  assert.equal(cells[2].findByType('span').children.join(''),'活动真实名称');
  assert.equal(cells[3].findByType('span').children.join(''),'暂无数据','an empty mapped value is missing');
  assert.equal(cells[4].findByType('span').children.join(''),'0','real zero must remain visible');
  assert.deepEqual(widget.columns,originalColumns,'rendering must not filter or reorder user columns');
  act(()=>tree.unmount());
  const legacy=structuredClone(spec);delete legacy.widgets[0].options!.fieldMeta;
  act(()=>{tree=create(React.createElement(ViewRenderer,{spec:legacy,data:[data]}));});
  assert.equal(tree.root.findAllByType('td')[0].findByType('span').children.join(''),'—','legacy table placeholder stays unchanged');
  assert.equal(tree.root.findAllByType('td')[3].findByType('span').children.join(''),'','legacy blank strings stay unchanged');
  act(()=>tree.unmount());
});
