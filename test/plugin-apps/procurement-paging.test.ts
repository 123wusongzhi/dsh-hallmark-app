import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('workbench restores full-store local searches and retains them when applying fees without extra reads',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'procurement-paging-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const design=createMaterialView('product-procurement');design.widgets[0].fields={'product.id':'productId','product.name':'title','price.current':'sellerMinor','metric.margin':'referenceProfit.margin'};design.widgets[0].options.rowsPath='products';
let instance={instanceId:'test',title:'采购表',materialId:'product-procurement',materialVersion:1,design,dataSources:{products:{id:'source',revision:1,params:{planMode:'platform',query:'SKU-65'}}},position:{order:0}};
const source={kind:'data_source',id:'source',revision:1,title:'采购',appId:'hallmark',connectionId:'connection',capabilityId:'hallmark.products.procurement',capabilityMajor:1,input:{loadAll:true},storeScoped:true,parameters:[],rowsPath:'products',fields:[],operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
const rows=Array.from({length:76},(_,index)=>({productId:String(index),title:'商品 '+index,sku:'SKU-'+index,offerId:'CODE-'+index,sellerMinor:1000,currency:'CNY',referenceProfit:{margin:index%2===0?0:null}}));
let tree,readCount=0,applied,shop='A',partial=false,refreshKey=0;
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
globalThis.fetch=async(url,options)=>{readCount++;const body=JSON.parse(options.body);assert.equal(body.operation,'read');assert.equal(body.params.params,undefined,'local search must not make a backend query');return Response.json({instanceId:'test',view:{viewId:'view',design},dataSources:{products:source},pages:{products:{hasMore:false,loadedCount:partial?10:76,total:76}},data:{viewId:'view',bindings:[{bindingId:'products',query:{appId:'hallmark',capabilityId:'hallmark.products.procurement',input:{loadAll:true,storeId:shop}},datasetId:'same-data-'+readCount,payload:{products:partial?rows.slice(0,10):rows,total:76,plan:{mode:instance.dataSources.products.params.planMode,label:'统一试算',fixedFeeYuan:3,logisticsYuanPerKg:12,commissionPercent:15}},state:'ready',lastSuccessAt:'2026-10-09T00:00:00Z',freshness:'fresh',provenance:[]}]}});};
const render=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId:shop}} refreshKey={refreshKey} onBindingParametersChange={async(id,params)=>{applied=params;instance={...instance,dataSources:{products:{...instance.dataSources.products,params}}};tree.update(render());}}/>;
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const change=async(label,value)=>{await act(async()=>{tree.root.findByProps({'aria-label':label}).props.onChange({target:{value}});await settle();});};
await act(async()=>{tree=create(render());await settle();});assert.equal(readCount,1);assert.equal(tree.root.findByProps({'aria-label':'搜索全部商品'}).props.value,'SKU-65');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,1);assert.match(JSON.stringify(tree.toJSON()),/共 76 件 · 38 件已算 · 38 件待补充/);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/本批|下一批/);
await change('搜索全部商品','');await change('跳转页码','7');assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,6);assert.equal(readCount,1,'ordinary pages and search do not fetch');
refreshKey++;await act(async()=>{tree.update(render());await settle();});assert.equal(readCount,2);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,7,'cache refresh preserves valid local page');assert.equal(tree.root.findByProps({'aria-label':'搜索全部商品'}).props.value,'','local override survives a refresh instead of restoring saved search');
await change('搜索全部商品','CODE-65');await change('物流方案','custom');await change('固定费用','4');await act(async()=>{button('应用试算').props.onClick();await settle();});assert.equal(applied.query,'CODE-65','applying plan fees saves the latest local query');assert.equal(applied.fixedFeeYuan,4);assert.equal(readCount,3);assert.equal(tree.root.findByProps({'aria-label':'搜索全部商品'}).props.value,'CODE-65');
shop='B';await act(async()=>{tree.update(render());await settle();});assert.equal(readCount,4);assert.equal(tree.root.findByProps({'aria-label':'跳转页码'}).props.value,0,'a shop switch resets pages');
partial=true;refreshKey++;await act(async()=>{tree.update(render());await settle();});assert.equal(tree.root.findAllByProps({'aria-label':'跳转页码'}).length,0,'loadAll alone cannot label incomplete results as full');assert.match(JSON.stringify(tree.toJSON()),/本批/);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/全店在售/);await act(async()=>tree.unmount());
console.log('PROCUREMENT_PAGING_PASS');
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/PROCUREMENT_PAGING_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});
