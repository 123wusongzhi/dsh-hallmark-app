import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';

const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
const result=await build({entryPoints:[fileURLToPath(new URL('../../packages/dsh-plugin/client/widgets/product-list.tsx',import.meta.url))],bundle:true,platform:'node',format:'cjs',write:false,external:['react']});
const compiled={exports:{} as {ProductList:React.ComponentType<any>}};
new Function('require','module','exports',result.outputFiles[0].text)(require,compiled,compiled.exports);
const {ProductList}=compiled.exports;
function fixture(){
 const view=createMaterialView('product-procurement');
 const widget={...view.widgets[0],fields:{'product.id':'id','product.name':'title','product.image':'image','price.current':'minor','price.currency':'currency','sku.id':'sku','sku.specification':'grams','purchase.specification':'purchaseSpec'},options:{...view.widgets[0].options,rowsPath:'products',pageSize:10,fieldMeta:{'sku.specification':{format:'integer',numericScale:.1,unit:'克'},'price.current':{format:'currency',numericScale:.01}}}};
 const products=Array.from({length:15},(_,i)=>({id:`p-${i}`,title:`商品 ${i}`,sku:`SKU-${i}`,offerId:`OFFER-${i}`,grams:350,minor:1234+i,currency:'CNY',purchaseSpec:i===12?'特别规格':'普通规格'}));
 const queries:any[]=[],selected:any[]=[];
 const data={bindingId:'products',datasetKey:'fixture',state:'ready',payload:{products},provenance:{source:'test'}};
 const interactions={bindings:{products:{fullDataset:true,onQueryChange:(query:any)=>queries.push(query)}},onSelect:(event:any)=>selected.push(event.value)};
 return {widget,data,interactions,queries,selected};
}
const content=(tree:any)=>JSON.stringify(tree.toJSON());
const input=(tree:any,value:string)=>act(()=>tree.root.findByType('input').props.onChange({target:{value}}));

test('full procurement search covers offscreen identity/specification and preserves selection and paging',()=>{
 const props:any=fixture();let tree:any;act(()=>{tree=create(React.createElement(ProductList,props));});
 try{
  input(tree,'特别规格');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);
  act(()=>tree.root.findByType('tbody').findByType('tr').props.onClick());assert.deepEqual(props.selected,['p-12']);
  input(tree,'ＳＫＵ－１２');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);
  input(tree,'不存在');assert.match(content(tree),/全店商品中没有匹配记录/);
  input(tree,'');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,10);
  act(()=>tree.root.findByProps({'aria-label':'跳转页码'}).props.onChange({target:{value:'1'}}));assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,5);
  input(tree,'OFFER-12');assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,0);
  assert.deepEqual(props.queries.map((q:any)=>q.search),['特别规格','ＳＫＵ－１２','不存在','','OFFER-12']);
 }finally{act(()=>tree.unmount());}
});

test('formatted searchable roles refresh after scale/unit and fresh snapshot changes',()=>{
 let props:any=fixture();let tree:any;act(()=>{tree=create(React.createElement(ProductList,props));});
 try{
  input(tree,'35 克');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,10);
  props={...props,widget:{...props.widget,options:{...props.widget.options,fieldMeta:{...props.widget.options.fieldMeta,'sku.specification':{format:'integer',numericScale:1,unit:'克'}}}}};
  act(()=>tree.update(React.createElement(ProductList,props)));input(tree,'350 克');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,10);
  props={...props,data:{...props.data,payload:{products:props.data.payload.products.map((row:any)=>({...row,grams:700,currency:'JPY'}))}}};
  act(()=>tree.update(React.createElement(ProductList,props)));assert.match(content(tree),/全店商品中没有匹配记录/);
  input(tree,'700 克');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,10);assert.match(content(tree),/JPY/);
 }finally{act(()=>tree.unmount());}
});

test('whole-row procurement filtering works with an image first column and a single numeric column',()=>{
 let props:any=fixture();let tree:any;
 props={...props,widget:{...props.widget,options:{...props.widget.options,columns:[{field:'product.image'},{field:'price.current'}]}}};
 act(()=>{tree=create(React.createElement(ProductList,props));});
 try{
  input(tree,'特别规格');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);
  props={...props,widget:{...props.widget,options:{...props.widget.options,columns:[{field:'price.current'}]}}};act(()=>tree.update(React.createElement(ProductList,props)));
  input(tree,'OFFER-12');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);assert.match(content(tree),/CNY/);
 }finally{act(()=>tree.unmount());}
});
