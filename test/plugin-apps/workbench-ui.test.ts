import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('workbench tabs, real preview, Chinese configuration and independent persisted instances use the data-source service',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workbench-ui-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
      import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
      import {WorkbenchBoard,WorkbenchInstanceView,workbenchDisplaySpec} from './packages/plugin-apps/client/workbench-board.tsx';
      import {DataSourcePicker} from './packages/plugin-apps/client/data-source-picker.tsx';
      import {ModuleConfig} from './packages/plugin-apps/client/module-config.tsx';
      import {RuntimeStore} from './packages/app-runtime/src/store.ts';
      import {AppsPresentationService} from './packages/app-presentation/src/index.ts';
      import {MATERIAL_CATALOG} from './packages/app-presentation/src/materials/catalog.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
      const store=new RuntimeStore(':memory:'),calls=[],requests=[];
      const descriptor={capabilityId:'hallmark.fixture.products',version:'1.0.0',effect:'query',title:'商品',description:'fixture',inputSchema:{type:'object',properties:{cursor:{type:'string'},productId:{type:'string'},limit:{type:'integer'},storeId:{type:'string'}},additionalProperties:false},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:true,keywords:[]},aliases:[]};
      let slowResolve,delayProduct=false;
      const runtime={describe:()=>descriptor,getConnection:()=>({enabled:true}),invoke:async request=>{
        calls.push(request);const input=request.input;
        if(delayProduct&&input.productId==='p1')await new Promise(resolve=>{slowResolve=resolve;});
        const id=input.productId??(input.cursor?'p3':'p1'),items=input.productId?[{id,name:id==='p1'?'真实蓝杯':'真实白杯',price:1999,sku:'SKU-'+id,spec:id==='p1'?'蓝色 500ml':'白色 300ml'}]:input.cursor?[{id:'p3',name:'真实旅行袋',price:9900}]:[{id:'p1',name:'真实蓝杯',price:1999},{id:'p2',name:'真实白杯',price:2500}];
        return {status:'ok',invocationId:request.invocationId,traceId:request.traceId,data:{items,total:3,cursor:input.cursor?null:'batch2'}};
      }};
      const presentation=new AppsPresentationService({store,runtime}),agent={kind:'agent',sessionId:'A',nativeCallId:'fixture'};
      const base={appId:'hallmark',connectionId:'shop-1',capabilityId:descriptor.capabilityId,capabilityMajor:1,input:{storeId:'store-a',limit:2},parameters:[{name:'storeId',label:'店铺编号',type:'string',default:'store-a',editable:false},{name:'cursor',label:'分页位置',type:'string'},{name:'limit',label:'每页条数',type:'integer',default:2}],rowsPath:'items',operations:{pagination:{cursorParam:'cursor',limitParam:'limit'},search:{scope:'loaded'},sort:{scope:'loaded'}}};
      const productFields=[{role:'product.id',path:'id',confirmed:true},{role:'product.name',path:'name',confirmed:true},{role:'price.current',path:'price',confirmed:true,currency:'CNY',numericScale:.01}];
      await presentation.registerDataSource({definition:{...base,id:'products',title:'测试店铺商品',fields:productFields}},agent);
      await presentation.registerDataSource({definition:{...base,id:'sku',title:'测试商品规格',input:{...base.input,productId:'p1'},parameters:[...base.parameters,{name:'productId',label:'商品编号',type:'string',required:true,default:'p1',linked:true}],fields:[...productFields,{role:'sku.id',path:'sku',confirmed:true},{role:'sku.specification',path:'spec',confirmed:true}]}},agent);
      const originalFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{
        const parsed=new URL(String(url),'http://fixture'),resource=parsed.searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body});
        try{let value;
          if(body?.action==='workbench'){
            const params=body.params;
            if(body.operation==='save')value=presentation.saveWorkbench(body.appId,params);
            else if(body.operation==='read'){const {instanceId,...input}=params;value=await presentation.readWorkbenchInstance(body.appId,instanceId,input,options?.signal);}
            else if(body.operation==='preview'){const {instance,...input}=params;value=await presentation.previewWorkbenchInstance(body.appId,instance,{kind:'agent',sessionId:body.sessionId,nativeCallId:'preview'},input,options?.signal);}
            else throw Error('unexpected operation');
          }else if(resource==='workbench')value=presentation.getWorkbench(parsed.searchParams.get('appId'));
          else if(resource==='dataSources')value={dataSources:presentation.listDataSources('hallmark')};
          else if(resource==='materials')value={materials:MATERIAL_CATALOG};
          else if(resource==='apps')value={apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'}]};
          else if(resource==='connections'||resource==='bindings')value=[];
          else if(resource==='views')value={views:[]};
          else if(resource==='saved')value={components:[],assets:[]};
          else if(resource==='diagnostics')value={invocations:[]};else throw Error('unexpected resource '+resource);
          return Response.json(value);
        }catch(error){return Response.json({status:'failed',error:{code:error.code??'FAIL',message:error.message}},{status:400});}
      };
      let tree;const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
      const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
      const button=name=>tree.root.findAllByType('button').find(node=>text(node).trim()===name);
      const board=()=>tree.root.findAllByType(WorkbenchBoard).find(node=>!node.props.detailInstanceId);
      const change=async(label,value)=>{await act(async()=>{tree.root.findAllByProps({'aria-label':label})[0].props.onChange({target:{value}});await settle();});};
      const click=async(name)=>{assert.ok(button(name),'button '+name);await act(async()=>{button(name).props.onClick();await settle();});};
      try{
        await act(async()=>{tree=create(<AppsWorkspace currentSessionId='A'/>);await settle();});
        assert.ok(button('工作台'));await act(async()=>{board().props.onAdd();await settle();});
        assert.ok(button('素材库'));assert.equal(button('工作台').props['aria-pressed'],false);assert.equal(button('添加到工作台').props.disabled,true);
        assert.match(JSON.stringify(tree.toJSON()),/示例数据/);
        const exampleRow=tree.root.findByType(MaterialLibrary).findAllByType('tr').find(node=>text(node).includes('示例 · 便携保温杯'));await act(async()=>exampleRow.props.onClick());assert.match(JSON.stringify(tree.toJSON()),/雾蓝/);assert.equal(requests.some(row=>row.body?.operation==='preview'),false,'interactive example does not pretend to query real data');
        const skuPicker=tree.root.findAllByType(DataSourcePicker).find(node=>node.props.label==='SKU 明细');assert.equal(skuPicker.findAllByType('option').find(node=>node.props.value==='products').props.disabled,true);assert.match(text(skuPicker),/缺少SKU 编码、SKU 规格/);
        await change('商品列表数据来源','products');await change('SKU 明细数据来源','sku');
        assert.equal(tree.root.findAllByProps({'aria-label':'分页位置'}).length,0);assert.equal(tree.root.findAllByProps({'aria-label':'店铺编号'}).length,0);
        assert.match(JSON.stringify(tree.toJSON()),/真实蓝杯/);assert.match(JSON.stringify(tree.toJSON()),/¥19.99|CNY/);assert.equal(button('添加到工作台').props.disabled,false);
        await click('调整显示');const image=tree.root.findAllByProps({'aria-label':'显示商品图片'})[0];assert.equal(image.props.disabled,false);
        await act(async()=>image.props.onClick());await act(async()=>tree.root.findByProps({'aria-label':'重命名商品名称'}).props.onClick());await change('商品名称显示名称','我关心的商品');await act(async()=>tree.root.findByProps({'aria-label':'商品列表紧凑'}).props.onClick());await change('模块布局','one');
        const library=tree.root.findByType(MaterialLibrary),preview=library.findByType(WorkbenchInstanceView),draft=preview.props.instance;
        assert.equal(draft.design.widgets[0].options.columns.find(column=>column.field==='product.name').label,'我关心的商品');assert.equal(draft.design.widgets[0].options.density,'compact');assert.equal(draft.design.layout.columns,1);
        const stale=structuredClone(draft);stale.design.widgets[0].options={...stale.design.widgets[0].options,rowsPath:'old.rows',example:true,fieldMeta:{'price.current':{currency:'USD',numericScale:100}}};
        const derived=await presentation.previewWorkbenchInstance('hallmark',stale,agent),merged=workbenchDisplaySpec(stale,derived);assert.equal(merged.widgets[0].options.rowsPath,'items');assert.equal(merged.widgets[0].options.example,false);assert.equal(merged.widgets[0].options.fieldMeta['price.current'].currency,'CNY');assert.equal(merged.widgets[0].options.fieldMeta['price.current'].numericScale,.01);assert.equal(merged.widgets[0].options.density,'compact');assert.equal(merged.widgets[0].options.columns.find(column=>column.field==='product.name').label,'我关心的商品');assert.equal(merged.layout.columns,1);assert.deepEqual(merged.bindings,derived.view.design.bindings);
        const row=library.findAllByType('tr').find(node=>text(node).includes('真实蓝杯'));await act(async()=>{row.props.onClick();await settle();});assert.match(JSON.stringify(library.toJSON?.()??tree.toJSON()),/蓝色 500ml/);
        await click('完成');await change('工作台组件名称','我的商品工作台');await click('添加到工作台');const saved=presentation.getWorkbench('hallmark');assert.equal(saved.instances.length,1);assert.equal(saved.instances[0].title,'我的商品工作台');assert.equal(button('工作台').props['aria-pressed'],true);assert.ok(button('素材库'));assert.equal(tree.root.findByProps({'data-instance-id':saved.instances[0].instanceId}).props.className.includes('is-highlighted'),true);
        const readsBefore=requests.filter(row=>row.body?.operation==='read').length;
        await act(async()=>{tree.update(<AppsWorkspace currentSessionId='B'/>);await settle();});assert.equal(presentation.getWorkbench('hallmark').instances.length,1);assert.equal(requests.filter(row=>row.body?.operation==='read').length,readsBefore,'switching chat must not reset the workbench');
        const boardReadsBeforeMaterials=requests.filter(row=>row.body?.operation==='read').length;await click('素材库');assert.equal(board().findAllByType(WorkbenchInstanceView).length,0,'the hidden board contains no live readers');assert.equal(requests.filter(row=>row.body?.operation==='read').length,boardReadsBeforeMaterials,'opening materials does not start background board reads');await change('工作台组件名称','第二个独立实例');await click('添加到工作台');assert.equal(board().findAllByType(WorkbenchInstanceView).length,0,'returning to the compact catalogue never mounts readers');assert.equal(requests.filter(row=>row.body?.operation==='read').length,boardReadsBeforeMaterials);assert.equal(presentation.getWorkbench('hallmark').instances.length,2);assert.notEqual(presentation.getWorkbench('hallmark').instances[0].instanceId,presentation.getWorkbench('hallmark').instances[1].instanceId);
        const cards=tree.root.findAll(node=>node.props['data-instance-id']);const firstCard=cards[0];await act(async()=>{firstCard.findAllByType('button').find(node=>text(node)==='配置').props.onClick();await settle();});await change('工作台组件名称','仅修改第一个');await click('保存配置');assert.deepEqual(presentation.getWorkbench('hallmark').instances.map(instance=>instance.title),['仅修改第一个','第二个独立实例']);
        await act(async()=>tree.unmount());await act(async()=>{tree=create(<AppsWorkspace currentSessionId='A'/>);await settle();});assert.equal(tree.root.findAll(node=>node.props['data-instance-id']).length,2);assert.match(JSON.stringify(tree.toJSON()),/仅修改第一个/);
        await act(async()=>{tree.root.findByProps({'aria-label':'打开仅修改第一个'}).props.onClick();await settle();});assert.ok(button('仅修改第一个'),'clicking a card creates a component tab');assert.equal(button('仅修改第一个').props['aria-pressed'],true);const first=tree.root.findAllByType(WorkbenchBoard).find(node=>node.props.detailInstanceId).findAll(node=>node.props['data-instance-id'])[0];const next=first.findAllByType('button').find(node=>['下一批','加载更多'].includes(text(node)));await act(async()=>{next.props.onClick();await settle();});assert.match(text(first),/真实旅行袋/);assert.ok(first.findAllByType('button').find(node=>text(node)==='返回第一批'));await act(async()=>{first.findAllByType('button').find(node=>text(node)==='返回第一批').props.onClick();await settle();});assert.match(text(first),/真实蓝杯/);
        // A slow SKU response cannot overwrite a newer selection.
        const selectable=()=>first.findAllByType('tr').filter(node=>typeof node.props.onClick==='function');delayProduct=true;
        await act(async()=>{selectable().find(node=>text(node).includes('真实蓝杯')).props.onClick();await settle();});assert.ok(slowResolve,'fixture must hold the earlier SKU response');
        await act(async()=>{selectable().find(node=>text(node).includes('真实白杯')).props.onClick();await settle();});
        assert.match(text(first),/白色 300ml/);assert.doesNotMatch(text(first),/蓝色 500ml/);if(slowResolve)await act(async()=>{slowResolve();await settle();});assert.match(text(first),/白色 300ml/);assert.doesNotMatch(text(first),/蓝色 500ml/);
        assert.equal(requests.some(row=>row.body?.action==='authoring'||row.body?.action==='presentation'),false,'normal composition never creates source drafts or builds');
        delayProduct=false;
        await presentation.registerDataSource({definition:{...base,id:'products',title:'测试店铺商品新版',fields:productFields},expectedRevision:1},agent);
        await act(async()=>{first.findAllByType('button').find(node=>text(node)==='配置').props.onClick();await settle();});
        const currentLibrary=()=>tree.root.findByType(MaterialLibrary),moduleConfig=()=>currentLibrary().findByType(ModuleConfig);
        assert.equal(currentLibrary().findAllByType(DataSourcePicker).find(node=>node.props.label==='商品列表').props.sources.find(source=>source.id==='products').revision,1,'editing an old instance retains its pinned source revision');
        assert.ok(button('更新平台数据源'),'platform sources remain refreshable after initial registration');assert.equal(button('保存配置').props.disabled,false);
        await click('调整显示');
        // Presets can be dismantled, reordered and extended without rebuilding source.
        const productConfig=moduleConfig().findAllByType('fieldset').find(node=>node.findAllByType('legend').some(legend=>text(legend)==='商品列表'));
        await act(async()=>{productConfig.findAllByType('button').find(node=>text(node)==='移除此模块').props.onClick();await settle();});
        assert.equal(moduleConfig().props.spec.widgets.length,1);assert.equal(moduleConfig().props.spec.widgets[0].options.requiresSelection,false);assert.equal(moduleConfig().props.spec.links.length,0);assert.ok(tree.root.findAllByProps({'aria-label':'商品编号'}).length);
        await click('＋ 商品列表');assert.equal(moduleConfig().props.spec.widgets.length,2);
        const appended=moduleConfig().props.spec.widgets.find(widget=>widget.type==='product_list');assert.notEqual(appended.bindingId,'products');
        await change('商品列表数据来源','products');await change('SKU 明细跟随商品列表',appended.id);assert.equal(moduleConfig().props.spec.links[0].from.widgetId,appended.id);assert.equal(moduleConfig().props.spec.widgets.find(widget=>widget.type==='sku_detail').options.requiresSelection,true);
        await act(async()=>{tree.root.findByProps({'aria-label':'后移SKU 明细'}).props.onClick();await settle();});assert.equal(moduleConfig().props.spec.widgets[0].id,appended.id);
        await change('商品列表模块类型','activity-list');assert.equal(moduleConfig().props.spec.widgets[0].type,'table');assert.equal(moduleConfig().props.spec.widgets.find(widget=>widget.type==='sku_detail').options.requiresSelection,false);assert.equal(moduleConfig().props.spec.links.length,0);assert.equal(currentLibrary().findAllByType(DataSourcePicker).find(node=>node.props.label==='促销活动').props.value,undefined,'replacement clears the previous data binding');
        console.log('WORKBENCH_UI_REAL_PREVIEW_PERSISTENCE_FIELDS_LINKS_PASS');
      }finally{slowResolve?.();if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;store.close();}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKBENCH_UI_REAL_PREVIEW_PERSISTENCE_FIELDS_LINKS_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});

test('Agent handoff prepares only explicitly selected connections before inserting and never inserts after a failed preparation',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workbench-agent-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {MaterialLibrary} from './packages/plugin-apps/client/material-library.tsx';
      import {DataSourcePicker} from './packages/plugin-apps/client/data-source-picker.tsx';
      import {MATERIAL_CATALOG} from './packages/app-presentation/src/materials/catalog.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      const fields=['product.id','product.name','price.current','sku.id','sku.specification'].map(role=>({role,path:role,confirmed:true,currency:'CNY'}));
      const source=(id,connectionId)=>({kind:'data_source',id,title:id,revision:1,appId:'hallmark',connectionId,capabilityId:'hallmark.products.list',capabilityMajor:1,input:{},parameters:[],fields,rowsPath:'items',operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},validation:{status:'verified',checkedAt:new Date().toISOString(),sampleCount:1,issues:[]}});
      const sources=[source('selected-products','selected-connection'),source('selected-sku','selected-connection'),source('unused-source','unselected-connection')];
      const originalFetch=globalThis.fetch,requests=[],insertions=[],sequence=[],copies=[];let failPreparation=false,releasePreparation;
      const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copies.push(text);}}}});
      globalThis.fetch=async(url,options)=>{const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;
        if(body){requests.push(body);assert.equal(body.action,'workbench');assert.equal(body.operation,'prepare');sequence.push('prepare-request');await new Promise(resolve=>{releasePreparation=resolve;});if(failPreparation)return Response.json({status:'failed',error:{message:'连接已停用'}},{status:409});sequence.push('prepare-confirmed');return Response.json({prepared:true});}
        if(resource==='materials')return Response.json({materials:MATERIAL_CATALOG});if(resource==='dataSources')return Response.json({dataSources:sources});if(resource==='workbench')return Response.json({kind:'workbench',workbenchId:'workbench:hallmark',appId:'hallmark',revision:0,instances:[],updatedAt:new Date().toISOString()});throw Error('Unexpected request');
      };
      const prepare=async(sessionId,text)=>{sequence.push('insert-draft');insertions.push({sessionId,text});},wait=()=>new Promise(resolve=>setTimeout(resolve,10));
      let tree;const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'',button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
      try{
        await act(async()=>{tree=create(<MaterialLibrary appId='hallmark' sessionId='original-chat' active={false} onComplete={()=>{}} onPrepareDataSource={prepare}/>);await wait();});
        await act(async()=>tree.root.findByProps({'aria-label':'商品列表数据来源'}).props.onChange({target:{value:'selected-products'}}));
        await act(async()=>tree.root.findByProps({'aria-label':'SKU 明细数据来源'}).props.onChange({target:{value:'selected-sku'}}));
        await act(async()=>tree.root.findAllByType(DataSourcePicker)[0].props.onCreate());
        await act(async()=>{button('放入原聊天输入框').props.onClick();await wait();});assert.equal(insertions.length,0,'insertion waits for preparation confirmation');assert.deepEqual(requests[0].params.connectionIds,['selected-connection']);assert.equal(requests[0].sessionId,'original-chat');assert.equal(requests[0].appId,'hallmark');
        await act(async()=>{releasePreparation();await wait();});assert.deepEqual(sequence,['prepare-request','prepare-confirmed','insert-draft']);assert.equal(insertions.length,1);assert.equal(insertions[0].sessionId,'original-chat');assert.match(insertions[0].text,/商品名称/);assert.match(JSON.stringify(tree.toJSON()),/请检查后手动发送/);
        failPreparation=true;await act(async()=>{button('放入原聊天输入框').props.onClick();await wait();});await act(async()=>{releasePreparation();await wait();});assert.equal(insertions.length,1,'failed preparation must not write a draft');assert.match(JSON.stringify(tree.toJSON()),/暂未写入聊天/);assert.match(JSON.stringify(tree.toJSON()),/连接已停用/);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/需求已放入原聊天输入框/);
        await act(async()=>{tree.update(<MaterialLibrary appId='hallmark' sessionId='original-chat' active={false} onComplete={()=>{}}/>);await wait();});const before=requests.length;await act(async()=>{button('复制数据源需求').props.onClick();await wait();});assert.equal(requests.length,before,'copy fallback does not bind any connection');assert.equal(copies.length,1);assert.match(JSON.stringify(tree.toJSON()),/尚未准备聊天连接/);assert.equal(requests.some(request=>request.operation==='requestAgent'||request.action==='presentation'),false);
        console.log('WORKBENCH_AGENT_PREPARE_BEFORE_INSERT_PASS');
      }finally{releasePreparation?.();if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKBENCH_AGENT_PREPARE_BEFORE_INSERT_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});

test('Chinese query choices preserve raw typed values and optional All removes only that parameter override',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workbench-choices-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {QueryParameters} from './packages/plugin-apps/client/module-config.tsx';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      const source={input:{},parameters:[
        {name:'status',label:'商品状态',type:'string',choices:[{label:'在售',value:'on_sale'},{label:'已下架',value:'off_sale'}]},
        {name:'window',label:'统计范围',type:'integer',required:true,choices:[{label:'近七天',value:7},{label:'近三十天',value:30}]},
        {name:'available',label:'库存范围',type:'boolean',choices:[{label:'有库存',value:true},{label:'无库存',value:false}]},
        {name:'limit',label:'每页条数',type:'integer'},
        {name:'enabled',label:'启用筛选',type:'boolean'}
      ],operations:{search:{scope:'loaded'},sort:{scope:'loaded'}}};
      let tree,latest;function Harness(){const [params,setParams]=React.useState({preserve:'kept'});latest=params;return <QueryParameters source={source} params={params} onChange={setParams}/>;}
      const change=async(label,value)=>{await act(async()=>tree.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));};
      try{
        await act(async()=>{tree=create(<Harness/>);});const status=tree.root.findByProps({'aria-label':'商品状态'});assert.equal(status.type,'select');assert.deepEqual(status.findAllByType('option').map(option=>option.children.join('')),['全部','在售','已下架']);assert.equal(status.findAllByType('option')[1].props.value,'on_sale');
        await change('商品状态','on_sale');assert.equal(latest.status,'on_sale');assert.equal(typeof latest.status,'string');assert.equal(tree.root.findByProps({'aria-label':'商品状态'}).props.value,'on_sale');await change('商品状态','');assert.equal(Object.hasOwn(latest,'status'),false);assert.equal(latest.preserve,'kept');
        assert.equal(tree.root.findByProps({'aria-label':'统计范围'}).findAllByType('option')[0].props.disabled,true);await change('统计范围','30');assert.equal(latest.window,30);assert.equal(typeof latest.window,'number');
        await change('库存范围','false');assert.equal(latest.available,false);assert.equal(typeof latest.available,'boolean');await change('库存范围','');assert.equal(Object.hasOwn(latest,'available'),false);assert.equal(latest.window,30);
        await change('每页条数','12');assert.equal(latest.limit,12);await change('启用筛选','true');assert.equal(latest.enabled,true);await change('每页条数','');assert.equal(Object.hasOwn(latest,'limit'),false);
        console.log('WORKBENCH_CHINESE_QUERY_CHOICES_PASS');
      }finally{if(tree)await act(async()=>tree.unmount());}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKBENCH_CHINESE_QUERY_CHOICES_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(root+sep));rmSync(directory,{recursive:true,force:true});}
});
