import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realCorpus} from '../real-data/corpus.ts';

test('source product views prioritize current page images in desktop, mobile and commerce layouts',async()=>{
  const root=resolve('test/source-preview/artifacts');mkdirSync(root,{recursive:true});
  const entry=join(mkdtempSync(join(root,'commerce-image-loading-')),'fixture.mjs');
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
import assert from 'node:assert/strict';
import {create,act} from 'react-test-renderer';
import Collected from './component-workspace/collected-products/src/Component.tsx';
import Margin from './component-workspace/helen-margin/src/Component.tsx';
import {Workbench} from './templates/commerce/src/Workbench.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.document={documentElement:{dataset:{}}};
const records=${JSON.stringify(realCorpus().records.slice(0,40))};
const products=records.map(({detail,summary})=>({...detail,name:detail.title,image:detail.mainImage,sku:detail.skus[0]?.sourceSkuId,price:detail.minPrice??detail.sourceSellingPrice?.min,collectedAt:summary.importedAt}));
const query=products[0].title.slice(0,12),matched=products.filter(product=>product.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length;
const snapshot={bindings:[{bindingId:'products',payload:{items:products}}],selection:[]};
globalThis.imageFixtureHook=()=>({data:snapshot,context:{theme:'light',attachment:{available:false}},loading:false,refresh:async()=>snapshot,attachSelection:async()=>({ok:true})});
const verify=(tree,className,count)=>{
 const region=tree.root.findByProps({className});const images=region.findAllByType('img');assert.equal(images.length,count);
 images.forEach((image,index)=>{assert.equal(image.props.loading,index<6?'eager':'lazy');assert.equal(image.props.fetchpriority,index<6?'high':'auto');assert.equal(image.props.decoding,'async');});
 return images.map(image=>image.props.src);
};
for(const Component of [Collected,Margin]){
 let tree;await act(async()=>{tree=create(<Component/>);});
 const first=verify(tree,'desktop-table',20);assert.deepEqual(verify(tree,'mobile-list',20),first);
 await act(async()=>{tree.root.findAllByType('button').find(node=>node.props['aria-label']==='下一页').props.onClick({});});
 const second=verify(tree,'desktop-table',20);assert.deepEqual(verify(tree,'mobile-list',20),second);assert.notDeepEqual(second,first);
 await act(async()=>{tree.root.findAllByType('input').find(node=>node.props['aria-label']==='搜索商品').props.onChange({target:{value:query}});});
 assert.deepEqual(verify(tree,'desktop-table',Math.min(20,matched)),verify(tree,'mobile-list',Math.min(20,matched)));
 if(Component===Margin){await act(async()=>{tree.root.findAllByType('button').find(node=>node.props['aria-label']?.startsWith('售价，')).props.onClick({});});verify(tree,'desktop-table',Math.min(20,matched));verify(tree,'mobile-list',Math.min(20,matched));}
 await act(async()=>tree.unmount());
}
let tree;const dataset={items:products,total:40,currency:'CNY'};
await act(async()=>{tree=create(<Workbench id="collection" dataset={dataset}/>);});
const first=verify(tree,'collection-grid',8);
await act(async()=>{tree.root.findAllByType('button').find(node=>node.props['aria-label']==='下一页').props.onClick({});});
const second=verify(tree,'collection-grid',8);assert.notDeepEqual(second,first);
await act(async()=>{tree.root.findAllByType('input').find(node=>node.props.placeholder).props.onChange({target:{value:query}});});
verify(tree,'collection-grid',Math.min(8,matched));
await act(async()=>{tree.root.findAllByProps({className:'product-card'})[0].props.onClick({});});
const detail=tree.root.findByProps({role:'dialog'}).findByType('img');assert.equal(detail.props.loading,'eager');assert.equal(detail.props.fetchpriority,'high');
await act(async()=>tree.unmount());
console.log('SOURCE_IMAGES_PASS');
`},outfile:entry,bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer'],loader:{'.css':'empty'},plugins:[{name:'image-fixture-data',setup(builder){builder.onResolve({filter:/lib\/runtime\/react$/},()=>({path:'hook',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useHallmark=()=>globalThis.imageFixtureHook();'}));}}]});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.error?.message??result.stderr);
  assert.match(result.stdout,/SOURCE_IMAGES_PASS/);
});
