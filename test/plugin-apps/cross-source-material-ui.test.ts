import {uiProduct,uiProducts,uiOzonProduct,uiStore,uiListingPayload,uiFixturePrelude,uiText} from '../real-data/ui-scenarios.ts';
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
        const rows=source.capabilityId==='hallmark.ozon.warehouses'?[uiWarehouse({warehouseId:shop+'-warehouse'})]:[{products:{image:uiProduct({},shop==='bill'?4:40).image,title:uiProduct({},shop==='bill'?4:40).title},prices:{price:44.97,currency:'CNY'},stocks:{stockAvailable:320,stockReserved:12},analytics:{orderedUnits:16,cartEvents:7}}];
        const design=structuredClone(instance.design);design.bindings[0].fieldMap=Object.fromEntries(source.fields.map(field=>[field.key??field.role,field.path]));design.widgets[0].fields=design.bindings[0].fieldMap;design.widgets[0].options={...design.widgets[0].options,rowsPath:'items',fieldMeta:Object.fromEntries(source.fields.map(field=>[field.key??field.role,{...FIELD_ROLE_MAP[field.role],...field}]))};
        return Response.json({instanceId:instance.instanceId,view:{viewId:'preview',design},dataSources:{main:source},dataSource:source,pages:{main:{cursor:null,nextCursor:null,hasMore:false,loadedCount:rows.length,total:rows.length}},data:{bindings:[{bindingId:'main',datasetId:'snapshot-'+shop,payload:{items:rows},state:'ready',lastSuccessAt:'2026-10-09T00:00:00Z',freshness:'fresh',provenance:[]}]}});
      };
      let tree;const wait=()=>new Promise(resolve=>setTimeout(resolve,15)),text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node).trim()===name),click=async name=>{assert.ok(button(name),name);await act(async()=>{button(name).props.onClick();await wait();});},byLabel=label=>tree.root.findByProps({'aria-label':label}),activate=async label=>{await act(async()=>{byLabel(label).props.onClick();await wait();});},change=async(label,value)=>{await act(async()=>{byLabel(label).props.onChange({target:{value}});await wait();});};
      const previews=()=>requests.filter(row=>row.body?.operation==='preview'&&row.body.params.instance.dataSources.main.draft),latest=()=>previews().at(-1).body.params.instance;
      try{
        await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' onComplete={instance=>completed.push(instance)}/>);await wait();});
        assert.equal(tree.root.findAllByType(ModuleConfig).length,0,'initial library keeps configuration out of the visual catalog');assert.ok(tree.root.findAllByProps({className:'apps-material-card'}).length>=7);assert.match(JSON.stringify(tree.toJSON()),uiText(uiProduct({},4).title));assert.equal(button('添加到工作台').props.disabled,false);
        assert.deepEqual(byLabel('仓库').findAllByType('option').map(option=>option.props.value),['','bill-warehouse'],'warehouse scope presents names from the current shop');
        await change('仓库','bill-warehouse');await click('调整显示');await click('添加信息');assert.equal(tree.root.findAllByType(InformationPicker).length,1);
        const originalRecipeId=latest().dataSources.main.id,countBefore=previews().length,catalogReads=requests.filter(row=>['materials','dataSources'].includes(row.resource)).length;await activate('添加预留库存');await activate('添加加购次数');assert.equal(previews().length,countBefore,'field choices do not query until applied');assert.equal(tree.root.findAllByProps({'aria-label':'添加记账金额'}).length,0,'posting fees are not offered as product columns');assert.match(JSON.stringify(tree.toJSON()),uiText(uiProduct({},4).title));await click('应用并预览');assert.equal(previews().length,countBefore+1);assert.equal(requests.filter(row=>['materials','dataSources'].includes(row.resource)).length,catalogReads,'field toggles reuse the loaded source catalog');assert.equal(requests.filter(row=>row.body?.operation==='initialize').length,0,'field toggles never initialize the catalog');assert.notEqual(latest().dataSources.main.id,originalRecipeId,'changed recipes get separate reusable identities');assert.ok(latest().dataSources.main.draft.input.recipe.fields.includes('stocks.stockReserved'));assert.ok(latest().dataSources.main.draft.input.recipe.fields.includes('analytics.cartEvents'));
        assert.equal(tree.root.findAllByType(InformationPicker).length,0);await activate('重命名预留库存');await change('预留库存显示名称','已预留');await activate('显示预留库存');
        let widget=tree.root.findByType(ModuleConfig).props.spec.widgets[0];assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').label,'已预留');assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').visible,false);assert.ok(!widget.columns.some(column=>column.field==='stocks.stockReserved'));
        await activate('商品经营表紧凑');await activate('上移加购次数');await click('完成');await click('添加到工作台');assert.equal(completed.length,1);assert.equal(requests.filter(row=>row.body?.operation==='save').at(-1).body.sessionId,'chat');assert.ok(!completed[0].dataSources.main.draft);
        await act(async()=>tree.unmount());await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' initial={completed[0]} onComplete={()=>{}}/>);await wait();});await click('调整显示');widget=tree.root.findByType(ModuleConfig).props.spec.widgets[0];assert.equal(widget.options.density,'compact');assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').label,'已预留');assert.equal(configuredColumns(widget).find(column=>column.field==='stocks.stockReserved').visible,false);
        await change('当前店铺','helen');assert.match(JSON.stringify(tree.toJSON()),uiText(uiProduct({},40).title));assert.doesNotMatch(JSON.stringify(tree.toJSON()),uiText(uiProduct({},4).title));assert.equal(byLabel('仓库').props.value,'');assert.ok(byLabel('仓库').findAllByType('option').some(option=>option.props.value==='helen-warehouse'));assert.equal(configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]).find(column=>column.field==='stocks.stockReserved').label,'已预留');
        console.log('CROSS_SOURCE_THREE_SCREEN_PERSISTENCE_PASS');
      }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/CROSS_SOURCE_THREE_SCREEN_PERSISTENCE_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});

test('choosing several information fields is one reversible edit and one composed preview read',async()=>{
  const output=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
    import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
    import {ModuleConfig,configuredColumns} from './packages/plugin-apps/client/module-config.tsx';
    import {InformationPicker} from './packages/plugin-apps/client/information-picker.tsx';
    import {MATERIAL_CATALOG} from './packages/app-presentation/src/materials/catalog.ts';
    import {FIELD_ROLE_MAP} from './packages/app-presentation/src/field-roles.ts';
    import {readOzonComposition} from './packages/app-hallmark/src/ozon-compose.ts';
    import {OZON_COMPOSITION_SOURCE_FIELDS} from './packages/app-hallmark/src/ozon-composition.ts';
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const recorded=${JSON.stringify(uiProduct({},4))},requests=[],reads=[],records=new Map();
    const store={get:(collection,id)=>records.get(collection+':'+id),put:(collection,id,value)=>{records.set(collection+':'+id,structuredClone(value));return value;}};
    const source={kind:'data_source',id:'platform-prices',title:'价格',revision:1,appId:'hallmark',connectionId:'platform',capabilityId:'hallmark.ozon.prices',capabilityMajor:1,storeScoped:true,input:{},parameters:[],fields:[],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',checkedAt:'',sampleCount:1,issues:[]}};
    const board={kind:'workbench',appId:'hallmark',workbenchId:'board',revision:1,context:{storeId:'test-store'},instances:[],updatedAt:''};
    const normalized=(kind,values)=>({...Object.fromEntries(OZON_COMPOSITION_SOURCE_FIELDS[kind].map(key=>[key,null])),...values});
    const reader=async(kind,input)=>{reads.push({kind,input});if(kind==='weights')return {status:'unavailable',error:{code:'LOCAL_RATE_LIMIT',message:'fixture: weight source delayed',retryable:true,retryAfterMs:60000}};const rows=Array.from({length:12},(_,i)=>kind==='products'?{productId:String(i+1),sku:String(i+101),title:recorded.title+' '+(i+1),image:recorded.image}:kind==='prices'?{productId:String(i+1),price:recorded.minor/100,currency:recorded.currency}:kind==='stocks'?{productId:String(i+1),sku:String(i+101),warehouseId:'1',stockAvailable:i===0?0:12,stockReserved:i===0?null:3}:kind==='analytics'?{sku:String(i+101),orderedUnits:4,cartEvents:i===0?null:2,views:16}:{});return {status:'ok',data:{items:rows.map(row=>normalized(kind,row)),warnings:[],dataTime:null}};};
    const nativeFetch=globalThis.fetch;
    globalThis.fetch=async(url,options)=>{
      const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;
      if(!body){if(resource==='workbench')return Response.json(board);if(resource==='dataSources')return Response.json({dataSources:[source]});if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});if(resource==='stores')return Response.json({stores:[{id:'test-store',name:'测试店铺',connectionId:'platform'}]});throw Error(resource);}
      assert.equal(body.operation,'preview');requests.push(body);const instance=body.params.instance,ref=instance.dataSources.main,definition={...ref.draft,kind:'data_source',revision:ref.revision},args={...definition.input,...ref.params,storeId:body.params.context.storeId};
      const response=await readOzonComposition(args,store,{},options?.signal,reader);assert.equal(response.status,'ok',JSON.stringify(response));
      const design=structuredClone(instance.design),fields=Object.fromEntries(definition.fields.map(field=>[field.key,field.path]));design.bindings[0].fieldMap=fields;design.widgets[0].fields=fields;design.widgets[0].options={...design.widgets[0].options,rowsPath:'items',fieldMeta:Object.fromEntries(definition.fields.map(field=>[field.key,{...FIELD_ROLE_MAP[field.role],...field}]))};
      return Response.json({instanceId:instance.instanceId,view:{viewId:'composed-preview',design},dataSources:{main:definition},pages:{main:{hasMore:false,total:response.data.total,loadedCount:response.data.items.length}},data:{bindings:[{bindingId:'main',datasetId:'composed-'+requests.length,query:{input:args},payload:response.data,state:'ready',lastSuccessAt:response.data.cache.fetchedAt,freshness:'fresh',provenance:[]}]}});
    };
    let tree;const flush=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));},text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node).trim()===name),click=async name=>{assert.ok(button(name),name);await act(async()=>{button(name).props.onClick();await flush();});},activate=async label=>{await act(async()=>{tree.root.findByProps({'aria-label':label}).props.onClick();await flush();});},view=()=>tree.root.findByProps({'aria-label':'组件预览'}),headers=()=>view().findAllByType('th').map(text),latest=()=>requests.at(-1).params.instance;
    try{
      await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' onComplete={()=>{}}/>);await flush();});
      assert.equal(requests.length,1);assert.match(text(view()),new RegExp(recorded.title.slice(0,4)));await click('调整显示');
      await activate('重命名可售库存');await act(async()=>tree.root.findByProps({'aria-label':'可售库存显示名称'}).props.onChange({target:{value:'当前可售'}}));await activate('显示可售库存');
      const original=configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]);await click('添加信息');const before=requests.length,oldHeaders=headers();
      await activate('添加预留库存');await activate('添加加购次数');await activate('添加商品详情浏览');
      console.log(JSON.stringify({phase:'three-field-selection',previewReads:requests.length-before,upstreamReads:reads.length,selected:tree.root.findByType(InformationPicker).props.selected.length,headersRetained:JSON.stringify(headers())===JSON.stringify(oldHeaders)}));
      assert.equal(requests.length,before,'three field choices must not issue intermediate preview reads');assert.deepEqual(headers(),oldHeaders,'existing preview remains usable until completion');
      assert.match(text(tree.root),/完成后.*更新预览/);await click('应用并预览');assert.equal(requests.length,before+1,'one completion performs exactly one composed preview read');
      assert.ok(headers().includes('预留库存'));assert.ok(headers().includes('加购次数'));assert.ok(headers().includes('商品详情浏览'));assert.match(text(view()),/暂无数据/,'unknown quantities are not converted to zero');assert.match(text(view()),/来源读取时间/);assert.match(text(view()),/快照更新于/);
      const applied=configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]);assert.deepEqual(applied.slice(0,original.length),original,'renamed, hidden and ordered columns are retained');assert.equal(applied.find(column=>column.field==='stocks.stockAvailable').visible,false);
      await click('添加信息');await activate('添加普通售价');await click('取消');assert.equal(requests.length,before+1);assert.equal(configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]).some(column=>column.field==='prices.ordinaryPrice'),false);
      await click('添加信息');await activate('添加普通售价');await activate('关闭调整面板');assert.equal(requests.length,before+1);await click('调整显示');await click('添加信息');assert.ok(tree.root.findByProps({'aria-label':'添加普通售价'}));
      await activate('添加普通售价');await activate('移除普通售价');await click('应用并预览');assert.equal(requests.length,before+1,'net-zero selection does not reload');
      await click('添加信息');await activate('添加普通售价');await click('调整显示');assert.equal(requests.length,before+1,'back discards pending choices');
      await click('添加信息');
      const cards=()=>tree.root.findByType(InformationPicker).findAllByProps({className:'apps-information-card'}),count=()=>tree.root.findByType(InformationPicker).props.selected.length;
      while(count()<30){const add=cards().find(node=>!node.props['aria-pressed']&&!node.props.disabled);assert.ok(add);await act(async()=>add.props.onClick());}
      assert.ok(cards().filter(node=>!node.props['aria-pressed']).every(node=>node.props.disabled),'maximum 30 fields remains enforced before application');
      while(count()>1){const remove=cards().find(node=>node.props['aria-pressed']&&!node.props.disabled);assert.ok(remove);await act(async()=>remove.props.onClick());}
      assert.equal(cards().find(node=>node.props['aria-pressed']).props.disabled,true,'the final field cannot be removed');assert.equal(requests.length,before+1);await click('取消');assert.equal(requests.length,before+1);assert.deepEqual(configuredColumns(tree.root.findByType(ModuleConfig).props.spec.widgets[0]),applied,'cancel restores both additions and removals');

      await click('添加信息');await activate('添加物流实重');await click('应用并预览');assert.equal(requests.length,before+2);assert.match(text(view()),/部分信息待更新/);assert.match(text(view()),/相关信息暂留空/);assert.match(text(view()),/暂无数据/);assert.match(text(view()),/来源读取时间/);
      await click('完成');assert.equal(button('添加到工作台').props.disabled,true,'partial data still blocks saving an unverified preview');
      console.log(JSON.stringify({phase:'completed-selection',previewReadsForThreeFields:1,cancelPreviewReads:0,closePreviewReads:0,backPreviewReads:0,netZeroPreviewReads:0,hiddenColumnPreserved:true,partialWarningPreserved:true}));console.log('INFORMATION_BATCH_ONE_READ_CANCEL_NO_READ_PARTIAL_WARNING_PASS');
    }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;}
  `},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
  const result=spawnSync(process.execPath,['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/INFORMATION_BATCH_ONE_READ_CANCEL_NO_READ_PARTIAL_WARNING_PASS/);console.log(result.stdout.trim());
});
