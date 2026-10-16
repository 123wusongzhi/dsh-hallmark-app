import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
const REPO_ROOT=fileURLToPath(new URL('../..',import.meta.url));
function spawnFixture(args:string[],options:{input?:string;encoding?:string;timeout?:number}={}){
 const temporaryRoot=resolve(REPO_ROOT,'.test-tmp');mkdirSync(temporaryRoot,{recursive:true});const directory=mkdtempSync(join(temporaryRoot,'navigation-'));
 const child=spawnSync(process.execPath,args,{...options,cwd:REPO_ROOT,windowsHide:true,encoding:'utf8',timeout:20000});
 writeFileSync(join(directory,'stdout.txt'),child.stdout??'');writeFileSync(join(directory,'stderr.txt'),child.stderr??'');
 assert.equal(child.status,0,(child.stdout??'')+(child.stderr??'')+'\nFixture retained at '+directory);
 assert.ok(resolve(directory).startsWith(temporaryRoot+sep+'navigation-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});return child;
}

import {uiProduct} from '../real-data/ui-scenarios.ts';
test('choosing several information fields is one reversible edit and one composed preview read',async()=>{
  const output=await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:`
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
  const result=spawnFixture(['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/INFORMATION_BATCH_ONE_READ_CANCEL_NO_READ_PARTIAL_WARNING_PASS/);console.log(result.stdout.trim());
});
