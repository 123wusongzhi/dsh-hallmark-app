import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
const REPO_ROOT=fileURLToPath(new URL('../..',import.meta.url));
test('failed range reads retry in place without reloading catalogs or losing edits',async()=>{
  const root=resolve(REPO_ROOT,'.test-tmp');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'material-range-')),entry=join(directory,'fixture.mjs');let passed=false;
  try{
    await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:`
      import React from 'react';
${uiFixturePrelude()}import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
      import {InformationPicker} from './packages/plugin-apps/client/information-picker.tsx';
      import {ModuleConfig,configuredColumns} from './packages/plugin-apps/client/module-config.tsx';
      import {MATERIAL_CATALOG} from './packages/app-presentation/src/materials/catalog.ts';
      import {FIELD_ROLE_MAP} from './packages/app-presentation/src/field-roles.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      const definition=(kind,fields)=>({kind:'data_source',id:'source-'+kind,revision:1,title:kind==='warehouses'?'仓库':'商品价格',appId:'hallmark',connectionId:'platform',capabilityId:'hallmark.ozon.'+kind,capabilityMajor:1,storeScoped:true,input:{},parameters:[{name:'storeId',label:'店铺',type:'string',required:true,editable:false}],fields:fields.map(field=>({role:'ozon.'+field,path:field,confirmed:true})),rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',checkedAt:'',sampleCount:1,issues:[]}});
      const sources=[definition('prices',['price']),definition('warehouses',['warehouseId','warehouseName'])],requests=[],completed=[];
      let board={kind:'workbench',appId:'hallmark',workbenchId:'board',revision:1,context:{storeId:'bill'},instances:[],updatedAt:''};
      let failRange=true,holdRange=false,emptyRange=false,releaseRange; const nativeFetch=globalThis.fetch;
      globalThis.fetch=async(url,options)=>{
        const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body});
        if(!body){if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});if(resource==='dataSources')return Response.json({dataSources:sources});if(resource==='workbench')return Response.json(board);if(resource==='stores')return Response.json({stores:[uiStore({id:'bill',connectionId:'platform'}),uiStore({id:'helen',connectionId:'platform'},1)]});throw Error(resource);}
        assert.equal(body.action,'workbench');
        assert.ok(['preview','read'].includes(body.operation));
        const instance=body.params.instance??board.instances.find(item=>item.instanceId===body.params.instanceId),ref=instance.dataSources.main,source=ref.draft?{...ref.draft,kind:'data_source',revision:ref.revision,validation:{status:'verified',checkedAt:'',sampleCount:1,issues:[]}}:sources.find(source=>source.id===ref.id),shop=body.params.context?.storeId??board.context.storeId;
        if(source.capabilityId==='hallmark.ozon.warehouses'){if(holdRange)await new Promise(resolve=>releaseRange=resolve);if(failRange)return Response.json({status:'failed',error:{message:'isolated warehouse read failure'}},{status:503});}
        const item=uiProduct({},shop==='bill'?4:40);
        const rows=source.capabilityId==='hallmark.ozon.warehouses'?(emptyRange?[]:[uiWarehouse({warehouseId:shop+'-warehouse'})]):[{products:{image:item.image,title:item.title},prices:{price:item.price==null?null:item.price/100,currency:item.currency}}];
        const design=structuredClone(instance.design);design.bindings[0].fieldMap=Object.fromEntries(source.fields.map(field=>[field.key??field.role,field.path]));design.widgets[0].fields=design.bindings[0].fieldMap;design.widgets[0].options={...design.widgets[0].options,rowsPath:'items',fieldMeta:Object.fromEntries(source.fields.map(field=>[field.key??field.role,{...FIELD_ROLE_MAP[field.role],...field}]))};
        return Response.json({instanceId:instance.instanceId,view:{viewId:'preview',design},dataSources:{main:source},dataSource:source,pages:{main:{cursor:null,nextCursor:null,hasMore:false,loadedCount:rows.length,total:rows.length}},data:{bindings:[{bindingId:'main',datasetId:'snapshot-'+shop,payload:{items:rows},state:'ready',lastSuccessAt:'2026-10-09T00:00:00Z',freshness:'fresh',provenance:[]}]}});
      };
      let tree;const wait=async()=>{for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));},text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node).trim()===name),click=async name=>{assert.ok(button(name),name);await act(async()=>{button(name).props.onClick();await wait();});},byLabel=label=>tree.root.findByProps({'aria-label':label}),activate=async label=>{await act(async()=>{byLabel(label).props.onClick();await wait();});},change=async(label,value)=>{await act(async()=>{byLabel(label).props.onChange({target:{value}});await wait();});};
      const previews=()=>requests.filter(row=>row.body?.operation==='preview'&&row.body.params.instance.dataSources.main.draft),latest=()=>previews().at(-1).body.params.instance;
      try{
        await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' onComplete={instance=>completed.push(instance)}/>);await wait();});
        const rangeReads=()=>requests.filter(row=>row.body?.operation==='preview'&&row.body.params.scope?.startsWith('conditions:')).length;
        const otherReads=()=>requests.filter(row=>!row.body?.params.scope?.startsWith('conditions:')).length;
        assert.match(text(tree.root),/查看范围暂未更新/);assert.equal(rangeReads(),1);
        await change('工作台组件名称','保留当前配置');
        await change('搜索素材','商品');
        const before=otherReads();
        assert.ok(button('重新读取查看范围'),'failed range has an in-place read-only retry');
        await click('重新读取查看范围');assert.equal(rangeReads(),2);assert.equal(otherReads(),before);assert.match(text(tree.root),/查看范围暂未更新/);
        failRange=false;holdRange=true;
        await click('重新读取查看范围');assert.equal(rangeReads(),3);assert.match(text(tree.root),/正在读取查看范围/);assert.ok(!button('重新读取查看范围'),'no concurrent retry while loading');
        await act(async()=>{releaseRange();await wait();});
        assert.doesNotMatch(text(tree.root),/查看范围暂未更新|正在读取查看范围/);
        assert.equal(byLabel('工作台组件名称').props.value,'保留当前配置');assert.equal(byLabel('搜索素材').props.value,'商品');assert.equal(otherReads(),before);
        assert.deepEqual(byLabel('仓库').findAllByType('option').map(option=>option.props.value),['','bill-warehouse']);
        await change('仓库','bill-warehouse');assert.equal(byLabel('仓库').props.value,'bill-warehouse');
        assert.equal(requests.filter(row=>row.body&& !['preview','read'].includes(row.body.operation)).length,0,'retry never saves, initializes or prepares');
        assert.equal(completed.length,0);
        // A delayed read for another store cannot overwrite a newer context or cached choices.
        await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='chat' currentWorkbench={{...board,context:{storeId:'helen'}}} onComplete={()=>{}}/>);await wait();});
        assert.match(text(tree.root),/正在读取查看范围/);assert.equal(byLabel('仓库').findAllByType('option').length,1);
        const releaseOld=releaseRange,readsBeforeReturn=rangeReads();
        await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='chat' currentWorkbench={board} onComplete={()=>{}}/>);await wait();});
        assert.equal(rangeReads(),readsBeforeReturn,'previously successful store choices reuse cache');
        await act(async()=>{releaseOld();await wait();});
        assert.deepEqual(byLabel('仓库').findAllByType('option').map(option=>option.props.value),['','bill-warehouse']);
        assert.doesNotMatch(text(tree.root),/查看范围暂未更新|正在读取查看范围/);assert.equal(byLabel('工作台组件名称').props.value,'保留当前配置');
        holdRange=false;emptyRange=true;
        await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='chat' currentWorkbench={{...board,context:{storeId:'helen'}}} onComplete={()=>{}}/>);await wait();});
        assert.equal(byLabel('仓库').findAllByType('option').length,1,'successful empty directory remains a valid empty result');
        assert.doesNotMatch(text(tree.root),/查看范围暂未更新|正在读取查看范围/);assert.ok(!button('重新读取查看范围'));
        // Hiding aborts an in-flight uncached scope; its late response cannot populate the cache.
        holdRange=true;emptyRange=false;const hiddenBoard={...board,context:{storeId:'hidden-scope'}};
        await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='chat' currentWorkbench={hiddenBoard} onComplete={()=>{}}/>);await wait();});
        const releaseHidden=releaseRange,hiddenReads=rangeReads();assert.match(text(tree.root),/正在读取查看范围/);
        await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='chat' active={false} currentWorkbench={hiddenBoard} onComplete={()=>{}}/>);await wait();});
        await act(async()=>{releaseHidden();await wait();});assert.equal(rangeReads(),hiddenReads);assert.equal(byLabel('仓库').findAllByType('option').length,1);assert.doesNotMatch(text(tree.root),/正在读取查看范围/);
        holdRange=false;await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='chat' active currentWorkbench={hiddenBoard} onComplete={()=>{}}/>);await wait();});
        assert.equal(rangeReads(),hiddenReads+1,'aborted hidden read did not become a successful cached scope');assert.deepEqual(byLabel('仓库').findAllByType('option').map(option=>option.props.value),['','hidden-scope-warehouse']);assert.equal(byLabel('工作台组件名称').props.value,'保留当前配置');assert.equal(byLabel('搜索素材').props.value,'商品');
        console.log('RANGE_READ_RECOVERY_PASS');
      }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000,cwd:REPO_ROOT,windowsHide:true});writeFileSync(join(directory,'stdout.txt'),result.stdout??'');writeFileSync(join(directory,'stderr.txt'),result.stderr??'');assert.equal(result.status,0,(result.stdout??'')+(result.stderr??'')+'\nFixture retained at '+directory);assert.match(result.stdout,/RANGE_READ_RECOVERY_PASS/);passed=true;
  }finally{assert.ok(resolve(directory).startsWith(root+sep+'material-range-'));if(passed)rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
