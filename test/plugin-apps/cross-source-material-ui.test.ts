import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('visual material flow changes the cross-source recipe, preserves hidden columns and restores the saved design in another shop',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'cross-source-ui-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
      import {InformationPicker} from './packages/plugin-apps/client/information-picker.tsx';
      import {ModuleConfig,configuredColumns} from './packages/plugin-apps/client/module-config.tsx';
      import {MATERIAL_CATALOG} from './packages/app-presentation/src/materials/catalog.ts';
      import {FIELD_ROLE_MAP} from './packages/app-presentation/src/field-roles.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      const definition=(kind,fields)=>({kind:'data_source',id:'source-'+kind,revision:1,title:kind==='warehouses'?'仓库':'商品价格',appId:'hallmark',connectionId:'platform',capabilityId:'hallmark.ozon.'+kind,capabilityMajor:1,storeScoped:true,input:{},parameters:[{name:'storeId',label:'店铺',type:'string',required:true,editable:false}],fields:fields.map(field=>({role:'ozon.'+field,path:field,confirmed:true})),rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',checkedAt:'',sampleCount:1,issues:[]}});
      const sources=[definition('prices',['price']),definition('warehouses',['warehouseId','warehouseName'])],requests=[],completed=[];
      let board={kind:'workbench',appId:'hallmark',workbenchId:'board',revision:1,context:{storeId:'bill'},instances:[],updatedAt:''};
      const nativeFetch=globalThis.fetch;
      globalThis.fetch=async(url,options)=>{
        const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body});
        if(!body){if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});if(resource==='dataSources')return Response.json({dataSources:sources});if(resource==='workbench')return Response.json(board);if(resource==='stores')return Response.json({stores:[{id:'bill',name:'Bill',connectionId:'platform'},{id:'helen',name:'Helen',connectionId:'platform'}]});throw Error(resource);}
        assert.equal(body.action,'workbench');
        if(body.operation==='save'){
          board={...board,...structuredClone(body.params),revision:board.revision+1};
          for(const instance of board.instances)for(const ref of Object.values(instance.dataSources))if(ref.draft){const saved={...ref.draft,kind:'data_source',revision:1,validation:{status:'verified',checkedAt:'',sampleCount:1,issues:[]}};sources.push(saved);delete ref.draft;}
          return Response.json(board);
        }
        assert.ok(['preview','read'].includes(body.operation));
        const instance=body.params.instance??board.instances.find(item=>item.instanceId===body.params.instanceId),ref=instance.dataSources.main,source=ref.draft?{...ref.draft,kind:'data_source',revision:ref.revision,validation:{status:'verified',checkedAt:'',sampleCount:1,issues:[]}}:sources.find(source=>source.id===ref.id),shop=body.params.context?.storeId??board.context.storeId;
        const rows=source.capabilityId==='hallmark.ozon.warehouses'?[{warehouseId:shop+'-warehouse',warehouseName:shop==='bill'?'Bill 小件仓':'Helen 小件仓'}]:[{products:{image:null,title:shop==='bill'?'Bill 实际商品':'Helen 实际商品'},prices:{price:44.97,currency:'CNY'},stocks:{stockAvailable:320,stockReserved:12},analytics:{orderedUnits:16,cartEvents:7}}];
        const design=structuredClone(instance.design);design.bindings[0].fieldMap=Object.fromEntries(source.fields.map(field=>[field.key??field.role,field.path]));design.widgets[0].fields=design.bindings[0].fieldMap;design.widgets[0].options={...design.widgets[0].options,rowsPath:'items',fieldMeta:Object.fromEntries(source.fields.map(field=>[field.key??field.role,{...FIELD_ROLE_MAP[field.role],...field}]))};
        return Response.json({instanceId:instance.instanceId,view:{viewId:'preview',design},dataSources:{main:source},dataSource:source,pages:{main:{cursor:null,nextCursor:null,hasMore:false,loadedCount:rows.length,total:rows.length}},data:{bindings:[{bindingId:'main',datasetId:'snapshot-'+shop,payload:{items:rows},state:'ready',lastSuccessAt:'2026-10-09T00:00:00Z',freshness:'fresh',provenance:[]}]}});
      };
      let tree;const wait=()=>new Promise(resolve=>setTimeout(resolve,15)),text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node).trim()===name),click=async name=>{assert.ok(button(name),name);await act(async()=>{button(name).props.onClick();await wait();});},byLabel=label=>tree.root.findByProps({'aria-label':label}),activate=async label=>{await act(async()=>{byLabel(label).props.onClick();await wait();});},change=async(label,value)=>{await act(async()=>{byLabel(label).props.onChange({target:{value}});await wait();});};
      const previews=()=>requests.filter(row=>row.body?.operation==='preview'&&row.body.params.instance.dataSources.main.draft),latest=()=>previews().at(-1).body.params.instance;
      try{
        await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' onComplete={instance=>completed.push(instance)}/>);await wait();});
        assert.equal(tree.root.findAllByType(ModuleConfig).length,0,'initial library keeps configuration out of the visual catalog');assert.ok(tree.root.findAllByProps({className:'apps-material-card'}).length>=7);assert.match(JSON.stringify(tree.toJSON()),/Bill 实际商品/);assert.equal(button('添加到工作台').props.disabled,false);
        assert.deepEqual(byLabel('仓库').findAllByType('option').map(option=>option.props.value),['','bill-warehouse'],'warehouse scope presents names from the current shop');
        await change('仓库','bill-warehouse');await click('调整显示');await click('添加信息');assert.equal(tree.root.findAllByType(InformationPicker).length,1);
        const originalRecipeId=latest().dataSources.main.id,countBefore=previews().length,catalogReads=requests.filter(row=>['materials','dataSources'].includes(row.resource)).length;await activate('添加预留库存');await activate('添加加购次数');assert.ok(previews().length>countBefore);assert.equal(requests.filter(row=>['materials','dataSources'].includes(row.resource)).length,catalogReads,'field toggles reuse the loaded source catalog');assert.equal(requests.filter(row=>row.body?.operation==='initialize').length,0,'field toggles never initialize the catalog');assert.notEqual(latest().dataSources.main.id,originalRecipeId,'changed recipes get separate reusable identities');assert.ok(latest().dataSources.main.draft.input.recipe.fields.includes('stocks.stockReserved'));assert.ok(latest().dataSources.main.draft.input.recipe.fields.includes('analytics.cartEvents'));
        assert.equal(tree.root.findAllByProps({'aria-label':'添加记账金额'}).length,0,'posting fees are not offered as product columns');assert.match(JSON.stringify(tree.toJSON()),/Bill 实际商品/);
        await click('完成');assert.equal(tree.root.findAllByType(InformationPicker).length,0);await activate('重命名预留库存');await change('预留库存显示名称','已预留');await activate('显示预留库存');
        let widget=tree.root.findByType(ModuleConfig).props.spec.widgets[0];assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').label,'已预留');assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').visible,false);assert.ok(!widget.columns.some(column=>column.field==='stocks.stockReserved'));
        await activate('商品经营表紧凑');await activate('上移加购次数');await click('完成');await click('添加到工作台');assert.equal(completed.length,1);assert.equal(requests.filter(row=>row.body?.operation==='save').at(-1).body.sessionId,'chat');assert.ok(!completed[0].dataSources.main.draft);
        await act(async()=>tree.unmount());await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' initial={completed[0]} onComplete={()=>{}}/>);await wait();});await click('调整显示');widget=tree.root.findByType(ModuleConfig).props.spec.widgets[0];assert.equal(widget.options.density,'compact');assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').label,'已预留');assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').visible,false);
        await change('当前店铺','helen');assert.match(JSON.stringify(tree.toJSON()),/Helen 实际商品/);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/Bill 实际商品/);assert.equal(byLabel('仓库').props.value,'');assert.ok(byLabel('仓库').findAllByType('option').some(option=>option.props.value==='helen-warehouse'));assert.equal(configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]).find(column=>column.field==='stocks.stockReserved').label,'已预留');
        console.log('CROSS_SOURCE_THREE_SCREEN_PERSISTENCE_PASS');
      }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/CROSS_SOURCE_THREE_SCREEN_PERSISTENCE_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});
