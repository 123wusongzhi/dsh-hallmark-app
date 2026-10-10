import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {BindingData,WidgetSpec} from '../../packages/presentation/src/types.ts';
import type {ViewInteractions} from '../../packages/dsh-plugin/client/material-interactions.ts';

const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
const built=await build({entryPoints:[fileURLToPath(new URL('../../packages/dsh-plugin/client/widgets/product-list.tsx',import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,external:['react']});
const compiled={exports:{} as {ProductList:React.ComponentType<{widget:WidgetSpec;data:BindingData;interactions?:ViewInteractions}>}};
new Function('require','module','exports',built.outputFiles[0].text)(require,compiled,compiled.exports);
const {ProductList}=compiled.exports;
const fields={'product.id':'productId','product.name':'title','product.image':'imageUrl','product.url':'productUrl','purchase.url':'purchaseLinks','sku.specification':'salesSpecification','purchase.specification':'purchaseSpecification','purchase.price':'purchaseMinor','price.current':'sellerMinor','price.currency':'currency','metric.margin':'referenceProfit.margin'};
function fixture(){
  const widget:WidgetSpec={id:'procurement',type:'product_list',bindingId:'products',fields,options:{materialId:'product-procurement',rowsPath:'products',pageSize:20,columns:['product.name','sku.specification','purchase.specification','product.url','purchase.url','purchase.price','price.current','metric.margin'].map(field=>({field,label:field})),fieldMeta:{'purchase.price':{format:'currency',currency:'CNY',numericScale:.01},'price.current':{format:'currency',numericScale:.01},'metric.margin':{format:'percent',percentScale:'fraction'}}}};
  const row={productId:'p-1',offerId:'CUP-BLUE',sku:'12345',title:'蓝色陶瓷杯',imageUrl:'https://images.example.com/cup.png',productUrl:'https://example.com/product/cup',salesSpecification:'蓝色 / 350ml',purchaseSpecification:'蓝釉 / 单只',purchaseLinks:[{url:'https://supplier.example.com/cup',label:'单只装'},{url:'https://supplier.example.com/box',label:'整箱装'}],currency:'CNY',purchaseMinor:1000,sellerMinor:2000,packageGrams:350,referenceProfit:{margin:.3,profitMinor:600,logisticsMinor:200,commissionMinor:200,fixedMinor:0,metricBasis:'当前物流方案参考试算，非实际结算利润。'}};
  const data:BindingData={bindingId:'products',datasetKey:'same-shop-query',state:'ready',payload:{products:[row]},provenance:{source:'synthetic_fixture'}};
  return {widget,row,data};
}
function html(widget:WidgetSpec,data:BindingData){return renderToStaticMarkup(React.createElement(ProductList,{widget,data}));}

test('procurement submits search to the source and leaves current rows visible while a new query is pending',()=>{
  const {widget,data}=fixture(),queries:unknown[]=[];let tree:any;
  const interactions:ViewInteractions={bindings:{products:{operations:{search:'server',sort:'server'},onQueryChange:query=>queries.push(query)}}};
  act(()=>{tree=create(React.createElement(ProductList,{widget,data,interactions}));});
  const input=tree.root.findByType('input');assert.equal(input.props.placeholder,'搜索名称 / SKU / 货号 / 规格');
  act(()=>input.props.onChange({target:{value:'另一个 SKU'}}));assert.equal(queries.length,0);assert.match(JSON.stringify(tree.toJSON()),/蓝色陶瓷杯/);
  act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.deepEqual(queries,[{search:'另一个 SKU'}]);
  act(()=>tree.update(React.createElement(ProductList,{widget,data,interactions:{bindings:{products:{...interactions.bindings!.products,pagination:{loading:true}}}}})));
  assert.equal(tree.root.findAllByType('button').find((button:any)=>button.children.includes('搜索')).props.disabled,true);assert.match(JSON.stringify(tree.toJSON()),/蓝色陶瓷杯/);
  act(()=>tree.unmount());
});

test('restored and reset server searches stay visible without replacing an unsubmitted draft',()=>{
  const {widget,data}=fixture(),queries:unknown[]=[];let tree:any;
  const props=(appliedSearch:string)=>({widget,data,interactions:{bindings:{products:{appliedSearch,operations:{search:'server' as const,sort:'server' as const},onQueryChange:(query:unknown)=>queries.push(query)}}}});
  act(()=>{tree=create(React.createElement(ProductList,props('已保存的蓝色')));});
  assert.equal(tree.root.findByType('input').props.value,'已保存的蓝色','a reopened component reflects its saved source query');
  act(()=>tree.root.findByType('input').props.onChange({target:{value:'未提交的草稿'}}));
  act(()=>tree.update(React.createElement(ProductList,props('外部更新的查询'))));
  assert.equal(tree.root.findByType('input').props.value,'未提交的草稿','refreshing the applied query must not discard typing');
  act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.deepEqual(queries,[{search:'未提交的草稿'}]);
  act(()=>tree.update(React.createElement(ProductList,props('已规范化的草稿'))));assert.equal(tree.root.findByType('input').props.value,'已规范化的草稿','a submitted query follows the accepted server value');
  act(()=>tree.update(React.createElement(ProductList,props(''))));assert.equal(tree.root.findByType('input').props.value,'','resetting the applied query clears a clean input');
  act(()=>tree.root.findByType('input').props.onChange({target:{value:'下一次搜索'}}));
  act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  act(()=>tree.root.findByType('input').props.onChange({target:{value:'请求期间的新草稿'}}));
  act(()=>tree.update(React.createElement(ProductList,props('下一次搜索'))));assert.equal(tree.root.findByType('input').props.value,'请求期间的新草稿');
  act(()=>tree.unmount());
  act(()=>{tree=create(React.createElement(ProductList,props('下一次搜索')));});assert.equal(tree.root.findByType('input').props.value,'下一次搜索');
  act(()=>tree.root.findByType('input').props.onChange({target:{value:''}}));act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.deepEqual(queries.at(-1),{search:''});
  act(()=>tree.update(React.createElement(ProductList,props(''))));assert.equal(tree.root.findByType('input').props.value,'');
  act(()=>tree.unmount());
});

test('procurement shows each purchase link and only opens explicit web URLs without credentials',()=>{
  const {widget,row,data}=fixture();
  row.purchaseLinks.push({url:'javascript:alert(1)',label:'不安全协议'},{url:'https://account:secret@supplier.example.com/private',label:'带凭据'},{url:'//supplier.example.com/relative',label:'非绝对地址'},{url:'https://supplier.example.com/\ncup',label:'控制字符'});
  let tree:any;act(()=>{tree=create(React.createElement(ProductList,{widget,data}));});
  const links=tree.root.findAllByType('a');assert.equal(links.length,3);assert.deepEqual(links.map((link:any)=>link.props.href),['https://example.com/product/cup','https://supplier.example.com/cup','https://supplier.example.com/box']);
  assert.deepEqual(links.map((link:any)=>link.props['aria-label']),['商品页','采购页 1：单只装','采购页 2：整箱装']);
  for(const link of links){assert.equal(link.props.target,'_blank');assert.equal(link.props.rel,'noopener noreferrer');let stopped=false;link.props.onClick({stopPropagation(){stopped=true;}});assert.equal(stopped,true);}
  assert.match(JSON.stringify(tree.toJSON()),/链接不可用/);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/account:secret|javascript:alert/);
  act(()=>tree.unmount());
});

test('procurement emphasizes reference margin and discloses real amounts, missingness and formula on demand',()=>{
  const {widget,row,data}=fixture();row.referenceProfit.margin=-.125;row.referenceProfit.profitMinor=-250;
  let tree:any;act(()=>{tree=create(React.createElement(ProductList,{widget,data}));});
  const negative=tree.root.find((node:any)=>node.props['data-negative']===true);assert.equal(negative.findByType('strong').props.className,'hm-procurement-rate');
  assert.match(JSON.stringify(tree.toJSON()),/-12.5%/);assert.equal(tree.root.findByType('details').props.open,undefined);assert.equal(tree.root.findByType('summary').children.join(''),'计算明细');
  const markup=html(widget,data);assert.match(markup,/CNY 10.00/);assert.match(markup,/CNY 20.00/);assert.match(markup,/CNY 0.00/);assert.match(markup,/CNY.*2.50/);assert.match(markup,/350.*克/);assert.match(markup,/售价 − 采购价 − 运费 − 佣金 − 固定费/);assert.match(markup,/非实际结算利润/);
  const missing={...row,purchaseMinor:null,referenceProfit:{...row.referenceProfit,margin:null,profitMinor:null,reason:'请补充采购价'}};
  const missingMarkup=html(widget,{...data,payload:{products:[missing]}});assert.match(missingMarkup,/待补充/);assert.match(missingMarkup,/请补充采购价/);assert.doesNotMatch(missingMarkup,/-12.5%|data-negative/);
  const unknownCurrency=html(widget,{...data,payload:{products:[{...missing,currency:null}]}});assert.match(unknownCurrency,/币种待确认/);assert.doesNotMatch(unknownCurrency,/RUB|CNY/);
  act(()=>tree.unmount());
});

test('RUB sales retain their currency while procurement costs stay CNY and unconfirmed fees are not relabelled',()=>{
  const {widget,row,data}=fixture();
  const foreign={...row,currency:'RUB',referenceProfit:{...row.referenceProfit,margin:null,profitMinor:null,logisticsMinor:null,commissionMinor:null,fixedMinor:null,reason:'售价币种不是 CNY，暂不跨币种试算'}};
  let tree:any;act(()=>{tree=create(React.createElement(ProductList,{widget,data:{...data,payload:{products:[foreign]}}}));});
  const amounts=()=>Object.fromEntries(tree.root.findAllByType('dt').map((node:any)=>[node.children.join(''),node.parent.findByType('dd').children.join('')]));
  assert.equal(amounts()['售价'],'RUB 20.00');assert.equal(amounts()['采购价'],'CNY 10.00');
  for(const label of ['运费','佣金','固定费','参考利润'])assert.equal(amounts()[label],'待补充');
  assert.match(JSON.stringify(tree.toJSON()),/暂不跨币种试算/);
  act(()=>tree.update(React.createElement(ProductList,{widget,data:{...data,payload:{products:[{...foreign,referenceProfit:{...foreign.referenceProfit,logisticsMinor:200}}]}}})));
  assert.equal(amounts()['运费'],'币种待确认','a numeric fee without a confirmed model currency must not be labelled RUB');
  act(()=>tree.unmount());
});

test('procurement keeps configured columns and uses one image while ordinary product lists retain their rendering',()=>{
  const {widget,data}=fixture(),original=structuredClone(widget.options!.columns);let tree:any;
  act(()=>{tree=create(React.createElement(ProductList,{widget,data}));});
  assert.deepEqual(tree.root.findAllByType('td').map((node:any)=>node.props['data-field']),(original as {field:string}[]).map(column=>column.field));
  assert.equal(tree.root.findAllByType('img').length,1);assert.match(JSON.stringify(tree.toJSON()),/SKU |货号 |CUP-BLUE|12345|蓝釉/);assert.deepEqual(widget.options!.columns,original);
  const explicitImage={...widget,options:{...widget.options,columns:[{field:'product.image'},...(original as object[])]}};
  act(()=>tree.update(React.createElement(ProductList,{widget:explicitImage,data})));assert.equal(tree.root.findAllByType('img').length,1);
  const restricted={...widget,options:{...widget.options,columns:[{field:'product.name'},{field:'purchase.price'}]}};
  act(()=>tree.update(React.createElement(ProductList,{widget:restricted,data})));assert.equal(tree.root.findAllByType('td').length,2);assert.equal(tree.root.findAllByType('details').length,0);
  const ordinary={...widget,options:{...widget.options,materialId:'product-list',columns:[{field:'product.image'},{field:'product.name'},{field:'price.current'}]}};
  act(()=>tree.update(React.createElement(ProductList,{widget:ordinary,data})));assert.equal(tree.root.findByType('input').props.placeholder,'搜索商品名称或编号');assert.equal(tree.root.findAllByType('img').length,1);assert.equal(tree.root.findAllByType('details').length,0);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/hm-product-procurement|hm-procurement-identifiers/);
  act(()=>tree.unmount());
});

test('full procurement data has ordinary pages, full-store search and profit sorting without remote page reads',()=>{
  const {widget,row,data}=fixture(),queries:unknown[]=[];let remotePages=0,tree:any;
  widget.options={...widget.options,pageSize:10,columns:[{field:'product.name'},{field:'metric.margin'}]};
  const products=Array.from({length:267},(_,index)=>({...row,productId:`p-${index}`,title:`商品 ${index}`,sku:`SKU-${100000+index}`,offerId:`OFFER-${100000+index}`,salesSpecification:`销售规格-${index}`,purchaseSpecification:`采购规格-${index}`,referenceProfit:{...row.referenceProfit,margin:index===0?null:index===1?0:index===2?-.4:index===266?10:index/1000}}));
  let currentData={...data,payload:{products,total:products.length}};
  const interactions:ViewInteractions={bindings:{products:{fullDataset:true,operations:{search:'loaded',sort:'loaded'},pagination:{hasMore:true,total:267},onPage:()=>remotePages++,onQueryChange:query=>queries.push(query)}}};
  const render=()=>React.createElement(ProductList,{widget,data:currentData,interactions});
  act(()=>{tree=create(render());});
  const text=(node:any):string=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
  const button=(name:string)=>tree.root.findAllByType('button').find((node:any)=>text(node)===name);
  const names=()=>tree.root.findByType('tbody').findAllByType('tr').map((node:any)=>text(node.findAllByType('td')[0]));
  const search=(value:string)=>act(()=>tree.root.findByProps({'aria-label':'搜索全部商品'}).props.onChange({target:{value}}));
  const page=(index:number)=>act(()=>tree.root.findByProps({'aria-label':'跳转页码'}).props.onChange({target:{value:String(index)}}));
  assert.equal(names().length,10);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).findAllByType('option').length,27);assert.equal(button('下一批'),undefined);
  page(26);assert.equal(names().length,7);assert.match(names()[0],/商品 260/);assert.equal(button('下一页').props.disabled,true);
  for(const value of ['SKU-100205','OFFER-100205','销售规格-205','采购规格-205']){search(value);assert.equal(names().length,1);assert.match(names()[0],/商品 205/);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,0);}
  search('');const sort=()=>act(()=>tree.root.findAllByType('th')[1].findByType('button').props.onClick({persist(){}}));
  sort();assert.match(names()[0],/商品 2SKU/);assert.match(names()[1],/商品 1SKU/,'zero follows a negative value and is not treated as missing');page(26);assert.match(names().at(-1),/商品 0SKU/,'unknown profits sort last in ascending order');
  sort();assert.match(names()[0],/商品 266/,'descending profit sorts the full shop before pagination');page(26);assert.match(names().at(-1),/商品 0SKU/,'unknown profits also sort last descending');
  currentData={...currentData,datasetKey:'refreshed-same-shop',payload:{...currentData.payload,products:[...products]}};act(()=>tree.update(render()));assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,26,'refresh keeps a valid page');
  currentData={...currentData,datasetKey:'fewer-products',payload:{products:products.slice(0,76),total:76}};act(()=>tree.update(render()));assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).findAllByType('option').length,8);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,7,'refresh clamps a removed page');
  act(()=>tree.root.findByProps({'aria-label':'每页商品数'}).props.onChange({target:{value:'20'}}));assert.equal(names().length,20);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).findAllByType('option').length,4);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,0);
  act(()=>button('下一页').props.onClick());act(()=>button('上一页').props.onClick());assert.equal(remotePages,0);assert.deepEqual(queries,[{search:'SKU-100205'},{search:'OFFER-100205'},{search:'销售规格-205'},{search:'采购规格-205'},{search:''}]);
  search('没有这件商品');assert.match(JSON.stringify(tree.toJSON()),/全店商品中没有匹配记录/);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).findAllByType('option').length,1);
  act(()=>tree.unmount());
});

test('verified full snapshots give ordinary product lists local pages while partial sources keep remote pages',()=>{
  const {widget,row,data}=fixture();widget.options={...widget.options,materialId:'product-list'};let pages=0,tree:any;
  act(()=>{tree=create(React.createElement(ProductList,{widget,data:{...data,payload:{products:[row]}},interactions:{bindings:{products:{fullDataset:true,pagination:{hasMore:true},onPage:()=>pages++}}}}));});
  assert.equal(tree.root.findByType('input').props['aria-label'],'搜索全部商品');assert.equal(tree.root.findAllByType('select').length,2);
  assert.equal(tree.root.findAllByType('button').some((node:any)=>node.children.includes('下一批')),false);assert.equal(pages,0);
  act(()=>tree.update(React.createElement(ProductList,{widget,data:{...data,payload:{products:[row]}},interactions:{bindings:{products:{fullDataset:false,pagination:{hasMore:true},onPage:()=>pages++}}}})));
  assert.equal(tree.root.findByType('input').props['aria-label'],'搜索已加载商品');assert.equal(tree.root.findAllByType('select').length,0);
  act(()=>tree.root.findAllByType('button').find((node:any)=>node.children.includes('下一批')).props.onClick());assert.equal(pages,1);act(()=>tree.unmount());
});
