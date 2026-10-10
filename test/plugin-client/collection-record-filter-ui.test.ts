import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('collection table switches record filters by store and makes loaded scope explicit',async()=>{
 const root=resolve('.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'collection-record-ui-'));
 try{
  const entry=resolve(directory,'ui.mjs');
  await build({stdin:{resolveDir:process.cwd(),sourcefile:'collection-record-ui.tsx',loader:'tsx',contents:`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {ProductList} from './packages/dsh-plugin/client/widgets/product-list.tsx';
const state=(storeId,listingRecord,extra={})=>({storeId,storeName:storeId,status:'unknown',association:'unknown',listingRecord,...extra});
const items=[{id:'new',title:'新品',listedIn:[state('shop','not_found',{hasUnlinkedHistory:true}),state('other','found')]},{id:'archived',title:'归档品',listedIn:[state('shop','found',{saleStates:{archived:1},hasUnlinkedHistory:true}),state('other','not_found')]},{id:'unknown',title:'未完成查询',listedIn:[state('shop','unavailable')]}];
const props={widget:{id:'collection',bindingId:'data',fields:{'product.id':'id','product.name':'title'},options:{columns:[{field:'product.name'}]}},data:{payload:{items},provenance:{}},interactions:{bindings:{data:{fullDataset:false,pagination:{hasMore:true,loadedCount:3,total:30},onPage:()=>{}}}}};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
let tree;await act(async()=>{tree=create(<ProductList {...props}/>);});
try{
 const select=label=>tree.root.findByProps({'aria-label':label});
 const change=async(label,value)=>act(async()=>select(label).props.onChange({target:{value}}));
 const titles=()=>tree.root.findByType('tbody').findAllByType('tr').map(row=>text(row));
 assert.equal(select('上品记录筛选').props.disabled,true);
 assert.match(text(tree.toJSON()),/筛选仅覆盖已加载商品/);
 assert.equal((text(tree.toJSON()).match(/部分历史商品尚未关联/g)||[]).length,1);
 await change('上品记录店铺','shop');await change('上品记录筛选','not_found');assert.equal(titles().length,1);assert.match(titles()[0],/新品/);
 await change('上品记录店铺','other');assert.equal(titles().length,1);assert.match(titles()[0],/归档品/);
 await change('上品记录店铺','shop');await change('上品记录筛选','unavailable');assert.equal(titles().length,1);assert.match(titles()[0],/未完成查询/);
 await change('上品记录筛选','found');assert.equal(titles().length,1);assert.match(titles()[0],/归档/);
 await change('上品记录店铺','');assert.equal(titles().length,3);
 await act(async()=>{tree.update(<ProductList {...props} interactions={{bindings:{data:{fullDataset:true}}}}/>);});assert.match(text(tree.toJSON()),/筛选覆盖当前完整快照/);
 console.log('COLLECTION_UI_PASS');
}finally{await act(async()=>tree.unmount());}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/COLLECTION_UI_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'collection-record-ui-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
