import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {HALLMARK_DESCRIPTORS,HALLMARK_MANIFEST} from '../../packages/app-hallmark/src/index.ts';
import {hallmarkProductSources} from '../../packages/app-hallmark/src/field-mappings.ts';
import {OZON_KINDS} from '../../packages/app-hallmark/src/ozon-data.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createMaterialView} from '../../packages/app-presentation/src/materials/catalog.ts';
import type {DataSourceDefinition,DataSourceDraft,WorkbenchInstance} from '../../packages/app-presentation/src/types.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';
import {workbenchRoutes} from '../../packages/service/src/workbench-routes.ts';

test('initialize migrates mixed-case shop sources into shared definitions without losing history, layout or same-ID renamed sources; repeated initialization is idempotent',async()=>{
  const stores=[{id:'bill-shop',shopName:'bill',platform:'ozon',status:'active'},{id:'helen-shop',shopName:'helen',platform:'ozon',status:'active'}];
  const requests:string[]=[],invocations:string[]=[];
  const upstream=createServer((request,response)=>{
    requests.push(request.url??'');response.setHeader('Content-Type','application/json');
    if(request.url==='/api/health')response.end(JSON.stringify({service:'hallmark-control'}));
    else if(request.url==='/api/stores')response.end(JSON.stringify(stores));
    else {response.statusCode=404;response.end(JSON.stringify({error:'unexpected fixture endpoint'}));}
  });
  await new Promise<void>(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  const address=upstream.address();assert.ok(address&&typeof address!=='string');
  const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
  runtime.register({manifest:HALLMARK_MANIFEST,descriptors:HALLMARK_DESCRIPTORS,execute:async context=>{
    invocations.push(context.request.capabilityId);
    assert.equal(context.request.capabilityId,'hallmark.collected.search','initialization reads the small collection sample, never business writes');
    return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{datasetKey:'fixture:collection',items:[],total:0}};
  },dispose:async()=>{}});
  runtime.addConnection({appId:'hallmark',connectionId:'platform',displayName:'平台授权',config:{baseUrl:`http://127.0.0.1:${address.port}`},configRevision:1,enabled:true});
  const presentation=new AppsPresentationService({store,runtime}),routes=workbenchRoutes(runtime,presentation);
  const productTemplate=hallmarkProductSources('platform')[0];
  const legacyProduct=(shop:string,label:string):DataSourceDraft=>{
    const {storeScoped:_scoped,...template}=structuredClone(productTemplate);
    return {...template,id:`legacy:${shop}:products`,title:`${label} · 商品资料`,description:`${label} · 保存的商品数据`,input:{...template.input,storeId:shop},parameters:template.parameters.map(parameter=>parameter.name==='storeId'?{...parameter,default:shop}:parameter)};
  };
  const activity=(id:string,title:string,description:string,shop?:string):DataSourceDraft=>({
    id,title,description,appId:'hallmark',connectionId:'platform',capabilityId:'hallmark.api.actions.list',capabilityMajor:1,
    ...(shop?{}:{storeScoped:true}),input:shop?{storeId:shop}:{},
    parameters:[{name:'storeId',label:'店铺编号',type:'string',required:true,editable:false,...(shop?{default:shop}:{})}],
    rowsPath:'response.result',fields:[{role:'activity.id',path:'id',confirmed:true},{role:'activity.name',path:'title',confirmed:true}],
    operations:{search:{scope:'loaded'},sort:{scope:'loaded'}},
  });
  const definitions=[legacyProduct('bill-shop','Bill'),legacyProduct('helen-shop','Helen'),activity('legacy:bill:activities','Bill · 活动数据','Bill · 活动接口','bill-shop'),activity('legacy:helen:activities','Helen · 活动数据','Helen · 活动接口','helen-shop'),activity('agent:shared:activities','Bill · 自定义活动','Helen · 已封装活动')];
  try{
    const previous=presentation.dataSources.installCatalog(definitions);
    const instances:WorkbenchInstance[]=previous.map((source,index)=>{
      const product=source.capabilityId==='hallmark.products.list',design=createMaterialView(product?'product-list':'activity-list');
      design.layout={type:'grid',columns:1,gap:23,children:design.widgets.map(widget=>widget.id)};
      design.widgets[0].options={...design.widgets[0].options,density:'compact',pageSize:20};
      if(product)design.widgets[0].options.columns=[{field:'product.name',label:'我的商品名称'},{field:'price.current',label:'卖家售价'}];
      else design.widgets[0].columns=[{field:'activity.name',label:'自定义活动名称'},{field:'activity.id',label:'活动编号'}];
      const ref:{id:string;revision:number;params:Record<string,JsonValue>}={id:source.id,revision:source.revision,params:product?{cursor:'old-shop-page',limit:7,status:'on_sale'}:{}};
      return {instanceId:`instance-${index}`,title:`${index%2?'Helen':'Bill'} · 面板 ${index}`,materialId:product?'product-list':'activity-list',materialVersion:1,design:design as unknown as JsonValue,
        ...(index===0?{dataSource:ref}:{dataSources:{[design.bindings[0].id]:ref}}),position:{order:index,span:index%2?6:12}};
    });
    const before=presentation.saveWorkbench('hallmark',{expectedRevision:0,instances,context:{storeId:'bill-shop'}});
    const initialized=await routes.write({appId:'hallmark',operation:'initialize',sessionId:'migration-test',params:{}}) as {dataSources:DataSourceDefinition[];stores:{id:string;name:string}[];issues:{id:string;message:string}[];context:{storeId:string}};
    assert.deepEqual(initialized.issues,[]);
    assert.deepEqual(initialized.context,{storeId:'bill-shop'});
    assert.deepEqual(initialized.stores.map(item=>item.name),['bill','helen']);
    const current=presentation.listDataSources('hallmark'),after=presentation.getWorkbench('hallmark');
    const ozonSources=current.filter(source=>source.capabilityId.startsWith('hallmark.ozon.')&&source.capabilityId!=='hallmark.ozon.compose');
    assert.deepEqual(ozonSources.map(source=>source.capabilityId).sort(),OZON_KINDS.map(kind=>`hallmark.ozon.${kind}`).sort(),'every current Ozon source, including content ratings, exists exactly once');
    assert.equal(new Set(ozonSources.map(source=>source.id)).size,ozonSources.length,'source IDs stay unique after migration');
    assert.equal(current.filter(source=>source.capabilityId==='hallmark.ozon.compose').length,1,'the shared cross-interface preset is installed independently');
    assert.equal(current.filter(source=>source.capabilityId==='hallmark.products.list').length,1);
    assert.equal(current.filter(source=>source.capabilityId==='hallmark.api.actions.list').length,2,'two legacy shop activity definitions collapse to one, while the distinct shared custom definition remains');
    for(const source of current){
      assert.doesNotMatch(`${source.title} ${source.description??''}`,/bill|helen/i,'shop labels are removed from current source names and descriptions regardless of case');
      if(source.storeScoped){assert.equal(Object.hasOwn(source.input,'storeId'),false);assert.equal(source.parameters.find(parameter=>parameter.name==='storeId')?.default,undefined);}
    }
    assert.equal(after.revision,before.revision+1);
    assert.equal(after.instances.length,before.instances.length);
    for(const [index,instance] of after.instances.entries()){
      assert.deepEqual(instance.design,before.instances[index].design,'migration preserves customized labels, columns, density and module layout');
      assert.deepEqual(instance.position,before.instances[index].position,'migration preserves board positions and spans');
      assert.doesNotMatch(instance.title,/bill|helen/i);
      assert.equal(instance.title,`面板 ${index}`);
      const ref=Object.values(instance.dataSources!)[0];
      assert.equal(ref.params.cursor,undefined,'old-store pagination is discarded');
      assert.equal(ref.params.storeId,undefined);
      assert.equal(instance.bindings?.[0].input&&typeof instance.bindings[0].input==='object'&&!Array.isArray(instance.bindings[0].input)?instance.bindings[0].input.storeId:undefined,'bill-shop');
      if(index<2){assert.equal(ref.id,'hallmark:platform:products');assert.equal(ref.params.limit,7);assert.equal(ref.params.status,'on_sale');}
    }
    const firstActivities=Object.values(after.instances[2].dataSources!)[0],secondActivities=Object.values(after.instances[3].dataSources!)[0];
    assert.equal(firstActivities.id,secondActivities.id,'the old Bill/Helen sources resolve to the same business definition');
    const renamed=Object.values(after.instances[4].dataSources!)[0];
    assert.equal(renamed.id,'agent:shared:activities','a shared source is renamed in place');
    assert.equal(renamed.revision,2);
    assert.equal(presentation.dataSources.get(renamed.id).title,'自定义活动','same-ID rename must not retire its current definition');
    for(const legacy of previous.slice(0,4)){
      assert.equal(current.some(source=>source.id===legacy.id),false,'obsolete IDs are absent from the current directory');
      assert.throws(()=>presentation.dataSources.get(legacy.id),/数据源不存在/);
      const historical=presentation.dataSources.get(legacy.id,legacy.revision);
      assert.deepEqual(historical,legacy,'historical versions retain original titles, fixed shop input and fields');
    }
    assert.equal(presentation.dataSources.get('agent:shared:activities',1).title,'Bill · 自定义活动');
    const sourceSnapshot=structuredClone(current),boardSnapshot=structuredClone(after);
    const repeated=await routes.write({appId:'hallmark',operation:'initialize',sessionId:'migration-test',params:{}}) as {issues:unknown[]};
    assert.deepEqual(repeated.issues,[]);
    assert.deepEqual(presentation.listDataSources('hallmark'),sourceSnapshot,'a second initialize must not create versions or repeat copies');
    assert.deepEqual(presentation.getWorkbench('hallmark'),boardSnapshot,'a second initialize must not rewrite the saved board');
    assert.equal(requests.filter(path=>path==='/api/stores').length,2);
    assert.deepEqual(invocations,['hallmark.collected.search','hallmark.collected.search']);
  }finally{
    upstream.closeAllConnections();await new Promise<void>(resolve=>upstream.close(()=>resolve()));await runtime.dispose();store.close();
  }
});
