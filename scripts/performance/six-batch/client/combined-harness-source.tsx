import React from 'react';
import {create,act as rendererAct} from 'react-test-renderer';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {WorkbenchInstanceView} from '../packages/plugin-apps/client/workbench-board.tsx';
import {ProductList} from '../packages/dsh-plugin/client/widgets/product-list.tsx';
import {createMaterialView} from '../packages/app-presentation/src/materials/catalog.ts';
import {hallmarkProductSources} from '../packages/app-hallmark/src/field-mappings.ts';
import {FIELD_ROLE_MAP} from '../packages/app-presentation/src/field-roles.ts';
import {materialDisplay} from '../packages/dsh-plugin/client/widgets/material-format.ts';
import {ProcurementCell} from '../packages/dsh-plugin/client/widgets/procurement-cells.tsx';
import {createWorkbenchFixture} from './workload-fixture.ts';

// Production renderer deliberately does not call unsupported act. Default test roots commit synchronously; drain effects explicitly.
const act=process.env.NODE_ENV==='production'?async(callback)=>{await callback();for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));}:rendererAct;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window=new EventTarget();
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.split('=')));
const pageSize=Number(args.page??10),size=Number(args.size??1000),iterations=Number(args.iterations??40),mode=args.mode??'timing';
const originalNumberFormat=Intl.NumberFormat;let constructions=0;
if(mode!=='timing')Intl.NumberFormat=new Proxy(originalNumberFormat,{construct(target,parameters){constructions++;return Reflect.construct(target,parameters);}});
const fixture=await createWorkbenchFixture({workload:args.workload??'platform',size,pageSize});
const {source,design,derived,fieldMap,fieldMeta,products,snapshot}=fixture;
let instance=fixture.instance;
const requests=[],events=[];let tree;
globalThis.fetch=async(url,options)=>{requests.push({url:String(url),body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>structuredClone(snapshot)};};
for(const type of ['apps-display-ready','apps-library-changed','hallmark-view-updated','apps-publication-discovered'])window.addEventListener(type,event=>events.push({type,detail:event.detail}));
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const render=()=> <WorkbenchInstanceView appId='hallmark' instance={instance} context={{storeId:'fixture-store'}} onBindingParametersChange={()=>{}}/>;
const canonical=value=>JSON.stringify(value,(key,item)=>typeof item==='function'?undefined:item);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const dom=()=>tree.toJSON();
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const frames=[];const checkpoint=(name)=>frames.push({name,dom:dom()});
const memoryBefore=process.memoryUsage(),cpuBefore=process.cpuUsage();const begin=performance.now();await act(async()=>{tree=create(render());await settle();});const coldMs=performance.now()-begin,coldConstructions=constructions;assert.equal(requests.length,1);assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,pageSize);checkpoint('cold');
const coldClosedDetails=tree.root.findAllByProps({className:'hm-procurement-calculation'});assert.equal(coldClosedDetails.length,args.workload==='collection-loaded'?0:pageSize);assert.ok(coldClosedDetails.every(node=>node.props.open===undefined));assert.equal(tree.root.findAllByProps({className:'hm-procurement-breakdown'}).length,args.workload==='collection-loaded'?0:pageSize);
if(args.workload==='collection-loaded')assert.ok(tree.root.findAllByType('small').some(node=>text(node).includes('测试店铺甲')),'listedIn status branch must actually render');
const memoryMounted=process.memoryUsage();const samples=[];
const changeRecord=(label,value)=>act(async()=>tree.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));
const search=async(value)=>act(async()=>tree.root.findByProps({'aria-label':args.workload==='collection-loaded'?'搜索已加载商品':'搜索全部商品'}).props.onChange({target:{value}}));
for(let i=0;i<iterations;i++){
 const step=async(label,fn)=>{const cpuStart=process.cpuUsage(),start=performance.now();await fn();const cpu=process.cpuUsage(cpuStart);samples.push({iteration:i,label,ms:performance.now()-start,cpuMs:(cpu.user+cpu.system)/1000});if(i===0||i===iterations-1)checkpoint(`${i}:${label}`);};
 if(args.workload==='collection-loaded'){
  await step('record-store-A',()=>changeRecord('上品记录店铺','fixture-store'));
  await step('record-found',()=>changeRecord('上品记录筛选','found'));
  assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,Math.min(pageSize,products.filter((_,index)=>[1,2,3].includes(index%6)).length));
  await step('record-not-found',()=>changeRecord('上品记录筛选','not_found'));
  assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,Math.min(pageSize,products.filter((_,index)=>index%6===0).length));
  await step('record-unavailable',()=>changeRecord('上品记录筛选','unavailable'));
  assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,Math.min(pageSize,products.filter((_,index)=>[4,5].includes(index%6)).length));
  await step('record-switch-B',()=>changeRecord('上品记录店铺','fixture-store-b'));
  assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,Math.min(pageSize,products.filter((_,index)=>[2,3].includes(index%6)).length));
  assert.equal(tree.root.findAllByType('p').filter(node=>text(node).includes('部分历史商品尚未关联')).length,0);
  await step('record-clear-status',()=>changeRecord('上品记录筛选',''));
  await step('record-clear-store',()=>changeRecord('上品记录店铺',''));
  assert.equal(tree.root.findByProps({'aria-label':'上品记录筛选'}).props.disabled,true);
 }
 await step('search-miss',()=>search('从未出现的货号'));
 await step('search-sku',()=>search(args.workload==='collection-loaded'?'p-1':'OFFER-1'));
 await step('search-all',()=>search('真实格式测试商品'));
 await step('search-clear',()=>search(''));
 await step('sort-price',()=>act(async()=>tree.root.findAllByType('th').find(node=>node.findAllByType('button').some(button=>text(button).includes(args.workload==='collection-loaded'?'最低采集价格':'当前售价'))).findByType('button').props.onClick({})));
 await step('edit-display',async()=>{instance={...instance,title:`采购表 ${i}`,design:{...instance.design,widgets:instance.design.widgets.map(widget=>({...widget,options:{...widget.options,density:i%2?'compact':'comfortable',columns:widget.options.columns.map(column=>column.field===(args.workload==='collection-loaded'?'product.name':'metric.margin')?{...column,label:`参考利润率 ${i}`}:column)}}))}};await act(async()=>tree.update(render()));});
}
assert.equal(requests.length,1,'local record/store filtering, search, sorting and display edits must not cause additional snapshot reads');
const memoryAfterCycles=process.memoryUsage();await act(async()=>tree.unmount());fixture.restoreClock();
const output={...(mode==='parity'?{fullFrames:frames}:{}),fixture:fixture.metadata,actionLabels:samples.filter(sample=>sample.iteration===0).map(sample=>sample.label),reactMode:process.env.NODE_ENV,size,pageSize,iterations,coldMs,samples,memoryBefore,memoryMounted,memoryAfterCycles,memoryAfterUnmount:process.memoryUsage(),totalCpu:process.cpuUsage(cpuBefore),frames:frames.map(({name,dom})=>({name,hash:digest(dom)})),requests:requests.map(({url,body})=>({url,body:{...body,params:{...body.params,scope:'<generated-scope>'}}})),events};
writeFileSync(args.output??'combined-timing.json',JSON.stringify(output,null,2));
