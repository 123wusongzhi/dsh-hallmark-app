import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('workbench cards open separate detail views without eager data reads and retain saved source thumbnails',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workbench-cards-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchBoard,WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
import {MaterialThumbnail} from './packages/plugin-apps/client/material-thumbnail.tsx';
import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const instance={instanceId:'products',title:'商品-采购对照表',materialId:'product-list',materialVersion:1,design:createMaterialView('product-list'),dataSources:{products:{id:'source',revision:1,params:{}}},position:{order:0}};
const source={id:'source',revision:1,title:'商品',appId:'hallmark',connectionId:'connection',capabilityId:'products',capabilityMajor:1,parameters:[],fields:[],operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},rowsPath:'items'};
const saved={componentId:'saved',revision:2,title:'采集箱 · 渠道商品与 SKU 采购价',hasPreview:true};
let board={kind:'workbench',appId:'hallmark',workbenchId:'main',revision:2,context:{storeId:'A'},instances:[instance],savedComponents:[saved]},opened,savedOpened,changed,adds=0,myComponents=0;const requests=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{const body=options?.body?JSON.parse(options.body):undefined;requests.push(body??String(url));if(!body){const resource=new URL(String(url),'http://fixture').searchParams.get('resource');return Response.json(resource==='stores'?{stores:[{id:'A',name:'Bill'}]}:board);}if(body.operation==='unpinComponent'){assert.equal(body.params.expectedRevision,2);assert.equal(body.params.componentId,'saved');board={...board,revision:3,savedComponents:[]};return Response.json(board);}assert.equal(body.operation,'read');return Response.json({instanceId:'products',view:{viewId:'read',design:instance.design},dataSources:{products:source},pages:{products:{hasMore:false,loadedCount:0}},data:{viewId:'read',bindings:[{bindingId:'products',datasetId:'data',payload:{items:[]},state:'ready',lastSuccessAt:'2026-10-09T00:00:00Z',freshness:'fresh',provenance:[]}]}});};
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
let tree;const props={appId:'hallmark',onAdd:()=>adds++,onOpenSaved:()=>myComponents++,onConfigure:()=>{},onOpenInstance:value=>opened=value,onOpenComponent:value=>savedOpened=value,onChange:value=>changed=value};
try{
  await act(async()=>{tree=create(<WorkbenchBoard {...props}/>);await settle();});
  assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0,'the catalogue never mounts live readers');assert.equal(requests.some(row=>row?.operation==='read'),false,'opening a dashboard only fetches catalogue metadata');
  assert.equal(tree.root.findAllByProps({'data-instance-id':'products'}).length,1);assert.equal(tree.root.findAllByProps({'data-component-id':'saved'}).length,1);assert.equal(tree.root.findAllByType('img').length,1);assert.match(tree.root.findByType('img').props.src,/resource=componentThumbnail.*componentId=saved.*revision=2/);
  await act(async()=>tree.root.findByType('img').props.onError());assert.equal(tree.root.findAllByType('img').length,0);assert.equal(tree.root.findAllByType(MaterialThumbnail).length,2,'a unavailable actual preview falls back to a visual diagram');
  await act(async()=>tree.root.findByProps({'aria-label':'打开商品-采购对照表'}).props.onClick());assert.equal(opened.instanceId,'products');assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0,'opening dispatches a new-tab callback instead of replacing the catalogue');
  await act(async()=>tree.root.findByProps({'aria-label':'打开采集箱 · 渠道商品与 SKU 采购价'}).props.onClick());assert.equal(savedOpened.componentId,'saved');assert.equal(savedOpened.revision,2);
  await act(async()=>tree.root.findAllByType('button').find(node=>text(node).trim()==='我的组件').props.onClick());assert.equal(myComponents,1);
  await act(async()=>tree.root.findAllByType('button').find(node=>text(node).trim()==='添加组件').props.onClick());assert.equal(adds,1);
  assert.doesNotMatch(JSON.stringify(tree.toJSON()),/占满一行|占半行/);
  const savedCard=tree.root.findByProps({'data-component-id':'saved'});await act(async()=>{savedCard.findAllByType('button').find(node=>text(node)==='从工作台移除').props.onClick();await settle();});assert.equal(changed.savedComponents.length,0);assert.equal(tree.root.findAllByProps({'data-component-id':'saved'}).length,0);
  await act(async()=>{tree.update(<WorkbenchBoard {...props} detailInstanceId='products'/>);await settle();});assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,1);assert.equal(requests.filter(row=>row?.operation==='read').length,1);assert.equal(tree.root.findAllByType('button').some(node=>text(node).trim()==='返回工作台'),true);
  await act(async()=>{tree.update(<WorkbenchBoard {...props} detailInstanceId='products' active={false}/>);await settle();});assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0,'inactive detail tabs stop readers');
  console.log('WORKBENCH_CARDS_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKBENCH_CARDS_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});
