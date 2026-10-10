import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

async function runFixture(contents:string,marker:string){
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'store-context-ui-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.ok(result.stdout.includes(marker),result.stdout);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
}

test('changing store drops old rows, selections and pagination; late responses cannot replace the new store or its permission error',async()=>{
  await runFixture(`
    import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
    import {WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
    import {ViewRenderer} from './packages/dsh-plugin/client/renderer.tsx';
    import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const design=createMaterialView('product-browser');design.widgets[0].options={...design.widgets[0].options,density:'compact',columns:[{field:'product.name',label:'我的商品'}]};
    const instance={instanceId:'shared',title:'我的配置',materialId:'product-browser',materialVersion:1,design,dataSources:{products:{id:'shared-products',revision:1,params:{}},sku:{id:'shared-sku',revision:1,params:{}}},position:{order:0}};
    const fields=[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'name',confirmed:true},{role:'price.current',path:'price',confirmed:true,currency:'CNY'},{role:'sku.id',path:'sku',confirmed:true},{role:'sku.specification',path:'specification',confirmed:true}];
    const source={kind:'data_source',id:'shared-products',revision:1,title:'Ozon 商品',storeScoped:true,fields,input:{},parameters:[{name:'productId',label:'商品编号',type:'string',linked:true}],rowsPath:'items',operations:{pagination:{cursorParam:'cursor'},search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',issues:[]}};
    const result=(params)=>{const id=params.context.storeId,derived=structuredClone(design);for(const widget of derived.widgets){widget.fields=Object.fromEntries(fields.map(field=>[field.role,field.path]));widget.options={...widget.options,rowsPath:'items'};}
      return {instanceId:'shared',view:{viewId:'preview-'+id,design:derived},dataSources:{products:source,sku:{...source,id:'shared-sku'}},pages:{products:{hasMore:!params.cursor,nextCursor:'next',loadedCount:1,total:2},sku:{hasMore:false,loadedCount:params.bindingId==='sku'?1:0}},data:{bindings:['products','sku'].map(bindingId=>({bindingId,datasetId:id+'-'+bindingId,payload:{items:bindingId==='sku'&&params.bindingId!=='sku'?[]:[{id:id+'-product',name:id+'商品',price:12,sku:id+'-sku',specification:id+'规格'}]},state:'ready',lastSuccessAt:'2026-10-08T10:00:00Z',sourceDataTime:null,freshness:'fresh',provenance:[]}))}};};
    const requests=[],slow=[];let hold=false,deny=false,tree;const originalFetch=globalThis.fetch;
    globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);requests.push({body,signal:options.signal});const params=body.params;if(hold&&params.context.storeId==='A')await new Promise(resolve=>slow.push(resolve));if(deny&&params.context.storeId==='C')return Response.json({status:'failed',error:{code:'ACCESS_DENIED',message:'当前店铺无订单读取权限'}},{status:403});return Response.json(result(params));};
    const settle=()=>new Promise(resolve=>setTimeout(resolve,10)),render=(storeId,refreshKey=0)=><WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId}} refreshKey={refreshKey}/>;
    const contents=()=>JSON.stringify(tree.toJSON()),interactions=()=>tree.root.findByType(ViewRenderer).props.interactions;
    try{
      await act(async()=>{tree=create(render('A'));await settle();});assert.match(contents(),/A商品/);
      await act(async()=>{interactions().onSelect({widgetId:'products',field:'product.id',value:'A-product'});await settle();});assert.equal(interactions().bindings.sku.selectedProductId,'A-product');assert.match(contents(),/A规格/);
      await act(async()=>{interactions().bindings.products.onPage();await settle();});assert.equal(requests.at(-1).body.params.cursor,'next');
      hold=true;await act(async()=>{tree.update(render('A',1));await settle();});const delayed=requests.at(-1);assert.equal(slow.length,1);
      await act(async()=>{tree.update(render('B',1));await settle();});assert.equal(delayed.signal.aborted,true);assert.match(contents(),/B商品/);assert.doesNotMatch(contents(),/A商品|A规格/);
      const firstB=requests.find(request=>request.body.params.context.storeId==='B').body.params;assert.equal(firstB.cursor,undefined);assert.equal(firstB.params,undefined);assert.deepEqual(interactions().selectedByWidget,{});assert.equal(interactions().bindings.sku.selectedProductId,undefined);
      assert.equal(tree.root.findByType(ViewRenderer).props.spec.widgets[0].options.density,'compact');assert.equal(tree.root.findByType(ViewRenderer).props.spec.widgets[0].options.columns[0].label,'我的商品');
      await act(async()=>{slow.shift()();await settle();});assert.match(contents(),/B商品/);assert.doesNotMatch(contents(),/A商品/);
      await act(async()=>{tree.update(render('A',2));await settle();});deny=true;await act(async()=>{tree.update(render('C',2));await settle();});assert.match(contents(),/当前店铺无订单读取权限/);assert.doesNotMatch(contents(),/A商品|B商品/);
      await act(async()=>{slow.shift()();await settle();});assert.match(contents(),/当前店铺无订单读取权限/);assert.doesNotMatch(contents(),/A商品|B商品/);
      console.log('STORE_SWITCH_RESPONSE_ISOLATION_PASS');
    }finally{for(const release of slow)release();if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
  `,'STORE_SWITCH_RESPONSE_ISOLATION_PASS');
});

test('workbench store selection persists once, preserves configured instances and is inherited by material previews',async()=>{
  await runFixture(`
    import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
    import {WorkbenchBoard} from './packages/plugin-apps/client/workbench-board.tsx';
    import {MaterialLibrary,initialSourceParameters} from './packages/plugin-apps/client/material-library.tsx';
    import {MATERIAL_CATALOG,createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const instance={instanceId:'preserved',title:'我的经营组件',materialId:'product-list',materialVersion:1,design:createMaterialView('product-list'),dataSources:{products:{id:'shared-products',revision:1,params:{limit:10}}},position:{order:0,span:6}};
    instance.design.widgets[0].options.density='compact';instance.design.widgets[0].options.columns=[{field:'product.name',label:'商品中文名称'}];
    const source={kind:'data_source',id:'shared-products',title:'Ozon 商品资料',revision:1,storeScoped:true,appId:'hallmark',connectionId:'platform',capabilityId:'hallmark.products.list',capabilityMajor:1,input:{},parameters:[],fields:[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'name',confirmed:true},{role:'price.current',path:'price',confirmed:true,currency:'CNY'}],rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',sampleCount:1,checkedAt:'2026-10-08T00:00:00Z',issues:[]}};
    let board={kind:'workbench',workbenchId:'hallmark',appId:'hallmark',revision:1,context:{storeId:'A'},instances:[instance],updatedAt:'2026-10-08T00:00:00Z'};
    const stores=[{id:'A',name:'Bill',connectionId:'platform'},{id:'B',name:'Helen',connectionId:'platform'}],requests=[],originalFetch=globalThis.fetch;
    const makeResult=(current,context)=>{const design=structuredClone(current.design);for(const widget of design.widgets){widget.fields={'product.id':'id','product.name':'name','price.current':'price'};widget.options={...widget.options,rowsPath:'items'};}
      return {instanceId:current.instanceId,view:{viewId:'current',design},dataSources:{products:source},pages:{products:{hasMore:false,loadedCount:1}},data:{bindings:[{bindingId:'products',datasetId:context.storeId,payload:{items:[{id:'product',name:context.storeId+'商品',price:12}]},state:'ready',lastSuccessAt:'2026-10-08T00:00:00Z',sourceDataTime:null,freshness:'fresh',provenance:[]}]}};};
    globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body});if(body){if(body.operation==='save'){assert.equal(body.params.expectedRevision,board.revision);board={...board,...body.params,revision:board.revision+1};return Response.json(board);}if(body.operation==='read'||body.operation==='preview')return Response.json(makeResult(body.params.instance??board.instances[0],body.params.context??board.context));throw Error('unexpected '+body.operation);}if(resource==='stores')return Response.json({stores});if(resource==='workbench')return Response.json(board);if(resource==='dataSources')return Response.json({dataSources:[source]});if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});throw Error('unexpected '+resource);};
    let tree;const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
    function Harness(){const [current,setCurrent]=React.useState(),[revision,setRevision]=React.useState(0);return <><WorkbenchBoard appId='hallmark' revision={revision} onAdd={()=>{}} onConfigure={()=>{}} onChange={setCurrent}/><MaterialLibrary appId='hallmark' sessionId='chat' initial={instance} currentWorkbench={current} onContextChange={next=>{setCurrent(next);setRevision(value=>value+1);}} onComplete={()=>{}}/></>;}
    try{
      await act(async()=>{tree=create(<Harness/>);await wait();});const initialDesign=structuredClone(instance.design);
      const currentBoard=()=>tree.root.findByType(WorkbenchBoard),library=()=>tree.root.findByType(MaterialLibrary);
      await act(async()=>{currentBoard().findByProps({'aria-label':'当前店铺'}).props.onChange({target:{value:'B'}});await wait();});
      assert.equal(board.context.storeId,'B');assert.equal(board.instances.length,1);assert.deepEqual(board.instances[0].design,initialDesign);assert.deepEqual(board.instances[0].position,{order:0,span:6});assert.equal(library().findByProps({'aria-label':'当前店铺'}).props.value,'B');
      const previewB=requests.filter(row=>row.body?.operation==='preview').at(-1);assert.equal(previewB.body.params.context.storeId,'B');assert.equal(previewB.body.params.instance.design.widgets[0].options.columns[0].label,'商品中文名称');
      await act(async()=>{library().findByProps({'aria-label':'当前店铺'}).props.onChange({target:{value:'A'}});await wait();});assert.equal(board.context.storeId,'A');assert.equal(currentBoard().findByProps({'aria-label':'当前店铺'}).props.value,'A');assert.deepEqual(board.instances[0].design,initialDesign);
      await act(async()=>tree.unmount());await act(async()=>{tree=create(<Harness/>);await wait();});assert.equal(currentBoard().findByProps({'aria-label':'当前店铺'}).props.value,'A');assert.equal(library().findByProps({'aria-label':'当前店铺'}).props.value,'A');
      assert.equal(requests.filter(row=>row.body?.operation==='save').length,2,'opening a tab never writes a default shop');
      assert.deepEqual(initialSourceParameters({...source,parameters:[{name:'dateFrom',required:true},{name:'dateTo',required:true},{name:'storeId',required:true}]},new Date('2026-10-08T20:30:00Z')),{dateFrom:'2026-10-01',dateTo:'2026-10-07'});assert.deepEqual(source.input,{});
      console.log('STORE_CONTEXT_PERSISTENCE_AND_INHERITANCE_PASS');
    }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
  `,'STORE_CONTEXT_PERSISTENCE_AND_INHERITANCE_PASS');
});

test('generic data tables expose all ten shared sources, Chinese fields, real empty results and remote cursor controls',async()=>{
  await runFixture(`
    import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
    import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
    import {DataSourcePicker} from './packages/plugin-apps/client/data-source-picker.tsx';
    import {ModuleConfig} from './packages/plugin-apps/client/module-config.tsx';
    import {MATERIAL_CATALOG} from './packages/app-presentation/src/materials/catalog.ts';
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const titles=['商品状态与异常','当前售价与价格差异','仓库与配送渠道','商品分仓库存','商品流量与订购表现','订单与发货进度','物流实重与重量差异','订单费用与平台记账','活动商品与活动价格','rFBS 退货与退款申请'];
    const fields=[{role:'ozon.postingNumber',path:'postingNumber',label:'包裹编号',description:'Ozon包裹标识',confirmed:true},{role:'ozon.status',path:'status',label:'当前状态',confirmed:true}];
    const sources=titles.map((title,index)=>({kind:'data_source',id:'ozon-'+index,title:'Ozon '+title,revision:1,storeScoped:true,appId:'hallmark',connectionId:'platform',capabilityId:'hallmark.ozon.fixture',capabilityMajor:1,input:{},parameters:[{name:'dateFrom',label:'开始日期',type:'string',required:true},{name:'dateTo',label:'结束日期',type:'string',required:true}],fields,rowsPath:'items',operations:{pagination:{cursorParam:'cursor'},search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:index===9?'failed':'unverified',checkedAt:'2026-10-08T00:00:00Z',sampleCount:0,issues:index===9?['上次店铺没有权限']:[]}}));
    const board={kind:'workbench',workbenchId:'hallmark',appId:'hallmark',revision:1,context:{storeId:'A'},instances:[],updatedAt:'2026-10-08T00:00:00Z'};
    const originalFetch=globalThis.fetch,requests=[];let empty=false,tree;
    globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body});if(!body){if(resource==='stores')return Response.json({stores:[{id:'A',name:'Bill',connectionId:'platform'},{id:'B',name:'Helen',connectionId:'platform'}]});if(resource==='workbench')return Response.json(board);if(resource==='dataSources')return Response.json({dataSources:sources});if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});throw Error('unexpected resource');}
      assert.equal(body.operation,'preview');const params=body.params,source=sources.find(item=>item.id===params.instance.dataSources.main.id),design=structuredClone(params.instance.design);design.bindings[0].fieldMap=Object.fromEntries(fields.map(field=>[field.role,field.path]));design.widgets[0].fields=design.bindings[0].fieldMap;design.widgets[0].options.rowsPath='items';
      return Response.json({instanceId:params.instance.instanceId,view:{viewId:'preview',design},dataSources:{main:source},pages:{main:{cursor:params.cursor??null,nextCursor:params.cursor||empty?null:'page-2',hasMore:!params.cursor&&!empty,loadedCount:empty?0:1,total:empty?0:2}},data:{bindings:[{bindingId:'main',datasetId:'result',payload:{items:empty?[]:[{postingNumber:params.cursor?'第二批包裹':'第一批包裹',status:'待交运'}],warnings:['订单记账金额不等于净利润']},state:'ready',lastSuccessAt:'2026-10-08T00:00:00Z',sourceDataTime:null,freshness:'fresh',provenance:[]}]}});
    };
    const wait=()=>new Promise(resolve=>setTimeout(resolve,10)),text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
    try{
      await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='chat' onComplete={()=>{}}/>);await wait();});
      const card=tree.root.findAllByProps({className:'apps-material-card'}).find(node=>text(node).includes('数据表'));assert.ok(card);await act(async()=>card.props.onClick());
      const picker=()=>tree.root.findByType(DataSourcePicker);assert.equal(picker().props.requiredRoles.length,0);const options=picker().findAllByType('option').filter(option=>option.props.value);assert.equal(options.length,10);assert.ok(options.every(option=>option.props.disabled===false));assert.ok(options.every(option=>!text(option).includes('Bill')&&!text(option).includes('Helen')));
      await act(async()=>{picker().props.onChange('ozon-5');await wait();});assert.equal(tree.root.findByProps({'aria-label':'开始日期'}).props.type,'date');assert.equal(tree.root.findByProps({'aria-label':'结束日期'}).props.type,'date');assert.equal(tree.root.findAllByProps({'aria-label':'店铺编号'}).length,0);await act(async()=>{button('调整显示').props.onClick();await wait();});assert.equal(tree.root.findByType(ModuleConfig).props.spec.widgets[0].columns[0].label,'包裹编号');assert.ok(tree.root.findByProps({'aria-label':'显示包裹编号'}));assert.match(JSON.stringify(tree.toJSON()),/第一批包裹/);assert.match(JSON.stringify(tree.toJSON()),/订单记账金额不等于净利润/);
      assert.ok(button('下一批数据'));await act(async()=>{button('下一批数据').props.onClick();await wait();});assert.equal(requests.at(-1).body.params.bindingId,'main');assert.equal(requests.at(-1).body.params.cursor,'page-2');assert.match(JSON.stringify(tree.toJSON()),/第二批包裹/);assert.equal(button('下一批数据'),undefined);assert.ok(button('返回第一批'));
      await act(async()=>{button('返回第一批').props.onClick();await wait();});assert.equal(requests.at(-1).body.params.cursor,null);assert.match(JSON.stringify(tree.toJSON()),/第一批包裹/);
      empty=true;await act(async()=>{picker().props.onChange('ozon-9');await wait();});assert.match(JSON.stringify(tree.toJSON()),/没有匹配记录/);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/第一批包裹|第二批包裹/);assert.equal(button('下一批数据'),undefined);await act(async()=>{button('完成').props.onClick();await wait();});assert.equal(button('添加到工作台').props.disabled,false,'a verified empty read is still a usable saved component');assert.match(JSON.stringify(tree.toJSON()),/上次店铺没有权限/);
      console.log('TEN_SOURCES_GENERIC_TABLE_CURSOR_AND_EMPTY_PASS');
    }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
  `,'TEN_SOURCES_GENERIC_TABLE_CURSOR_AND_EMPTY_PASS');
});
