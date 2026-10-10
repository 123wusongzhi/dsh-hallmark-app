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
let refreshKey=0;
const render=()=> <WorkbenchInstanceView refreshKey={refreshKey} appId='hallmark' instance={instance} context={{storeId:'fixture-store'}} onBindingParametersChange={()=>{}}/>;
const canonical=value=>JSON.stringify(value,(key,item)=>typeof item==='function'?undefined:item);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const dom=()=>tree.toJSON();
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const providerResults=[];
const frames=[];const checkpoint=(name)=>frames.push({name,dom:dom()});
const begin=performance.now();await act(async()=>{tree=create(render());await settle();});const coldMs=performance.now()-begin,coldConstructions=constructions;assert.equal(requests.length,1);assert.equal(tree.root.findByType('tbody').findAllByType('tr').length,pageSize);checkpoint('cold');
const coldClosedDetails=tree.root.findAllByProps({className:'hm-procurement-calculation'});assert.equal(coldClosedDetails.length,args.workload==='collection-loaded'?0:pageSize);assert.ok(coldClosedDetails.every(node=>node.props.open===undefined));assert.equal(tree.root.findAllByProps({className:'hm-procurement-breakdown'}).length,args.workload==='collection-loaded'?0:pageSize);
const times=[],constructionCounts=[];
for(let i=0;i<iterations;i++){
 const title=`采购表 ${i}`,label=`参考利润率 ${i}`;
 instance=args.scenario==='title'?{...instance,title}:{...instance,title,design:{...instance.design,widgets:instance.design.widgets.map(widget=>({...widget,options:{...widget.options,density:i%2?'compact':'comfortable',columns:widget.options.columns.map(column=>column.field===(args.workload==='collection-loaded'?'product.name':'metric.margin')?{...column,label}:column)}}))}};
 const before=constructions,start=performance.now();await act(async()=>tree.update(render()));times.push(performance.now()-start);constructionCounts.push(constructions-before);
 if(i===0||i===iterations-1)checkpoint(`edit-${i}`);
}
assert.equal(requests.length,1,'display-only title/label/density edits must not make data reads');
if(mode==='parity'){
 checkpoint('before-page');await act(async()=>tree.root.findByProps({'aria-label':'跳转页码'}).props.onChange({target:{value:'1'}}));checkpoint('page-1');
 await act(async()=>tree.root.findByProps({'aria-label':args.workload==='collection-loaded'?'搜索已加载商品':'搜索全部商品'}).props.onChange({target:{value:'OFFER-1'}}));checkpoint('search');
 await act(async()=>tree.root.findByProps({'aria-label':args.workload==='collection-loaded'?'搜索已加载商品':'搜索全部商品'}).props.onChange({target:{value:''}}));checkpoint('search-clear');
 await act(async()=>tree.root.findAllByType('th').find(node=>node.findAllByType('button').some(button=>text(button).includes(args.workload==='collection-loaded'?'最低采集价格':'当前售价'))).findByType('button').props.onClick({}));checkpoint('sort-price');
 const row=tree.root.findByType('tbody').findAllByType('tr')[0];await act(async()=>row.props.onClick());checkpoint('select');
 assert.equal(requests.length,1,'all local controls stay local');
 if(fixture.provider){
  providerResults.push({name:'initial',payload:structuredClone(snapshot.data.bindings[0].payload),reads:fixture.provider.reads()});
  for(const name of ['revision-overlap','window-first','window-next','window-expired']){
   const payload=await fixture.provider.transition(name);
   snapshot.data.bindings[0].payload=payload;
   const expected=name==='revision-overlap'?'overlap':name==='window-first'?'first':name==='window-next'?'next':null;
   assert.equal(payload.products[1].referenceProfit.planId,expected);
   assert.equal(payload.plan.settingsRevision,name==='revision-overlap'?2:3);
   if(name==='window-expired')assert.ok(payload.products.every(row=>row.referenceProfit.margin===null));
   providerResults.push({name,payload:structuredClone(payload),reads:fixture.provider.reads()});
   refreshKey++;await act(async()=>{tree.update(render());await settle();});checkpoint(name);
  }
  assert.equal(requests.length,5,'one initial read and four requested refreshed snapshots');
  assert.equal(tree.root.findByProps({'aria-label':'物流方案'}).props.value,'application');
 }
}
await act(async()=>tree.unmount());fixture.restoreClock();
const output={fixture:fixture.metadata,reactMode:process.env.NODE_ENV??'development (default)',mode,scenario:args.scenario??'display',pageSize,size,iterations,coldMs,coldConstructions,warmMs:times,warmConstructions:constructionCounts,frameHashes:frames.map(({name,dom})=>({name,sha256:digest(dom)})),requestCount:requests.length,requests:requests.map(({url,body})=>({url,body:{...body,params:{...body.params,scope:'<generated-scope>'}}})),events};
if(mode==='parity'){
 // Numeric behavior exercised through the current rendered ProcurementCell plus all current material-format branches.
 const currencies=['CNY','cny','USD','JPY','KWD','CLF','XXX','ZZZ','AB','A1B','',null,undefined];
 const numbers=[0,-0,1.005,-1.005,1234567.891,-1234567.891,NaN,Infinity,-Infinity,null,undefined,'','  ','1.005','-0','bad'];
 const behavior=[];
 for(const currency of currencies)for(const value of numbers){const widget={...derived.widgets[0],options:{...derived.widgets[0].options,fieldMeta:{...fieldMeta,'price.current':{...fieldMeta['price.current'],currencyPath:'currency',numericScale:.01}}}};const row={...products[1],currency,sellerMinor:value,purchaseMinor:value,packageGrams:value,referenceProfit:{...products[1].referenceProfit,margin:value,profitMinor:value,logisticsMinor:value,commissionMinor:value,fixedMinor:value}};let component;await act(async()=>{component=create(<ProcurementCell row={row} role='metric.margin' widget={widget} binding={derived.bindings[0]}/>);});behavior.push({case:[String(currency),String(value),Object.is(value,-0)],dom:component.toJSON(),price:materialDisplay(row,'price.current',widget,derived.bindings[0])});await act(async()=>component.unmount());}
 for(const format of ['currency','integer','percent'])for(const numericScale of [undefined,null,0,-0,-1,.01,1.2345,Infinity,NaN,'2','bad',true])for(const percentScale of [undefined,'fraction','whole'])for(const value of [0,-0,1.005,-1.005,1234.567,'2.3',NaN,null]){const widget={id:'test',type:'product_list',fields:{value:'value'},options:{fieldMeta:{value:{format,currency:'JPY',numericScale,percentScale,unit:'克'}}}};behavior.push({case:['material',format,String(numericScale),percentScale,String(value),Object.is(value,-0)],value:materialDisplay({value},'value',widget)});}
 // More currency keys than the bound, including revisiting evicted keys, must never change the output.
 for(let i=0;i<80;i++){const currency='X'+String.fromCharCode(65+(i%26))+String.fromCharCode(65+Math.floor(i/26));const widget={...derived.widgets[0],options:{...derived.widgets[0].options,fieldMeta:{'price.current':{format:'currency',currency,numericScale:.01}}}};behavior.push({case:['currency-eviction',currency],value:materialDisplay({sellerMinor:100005},'price.current',widget)});}
 for(const currency of ['CNY','JPY','USD']){const widget={...derived.widgets[0],options:{...derived.widgets[0].options,fieldMeta:{'price.current':{format:'currency',currency,numericScale:.01}}}};behavior.push({case:['currency-revisit',currency],value:materialDisplay({sellerMinor:-0},'price.current',widget)});}
 // Same object mutation is visible to each current render; no data or material-display memoization.
 let row={...products[1],referenceProfit:{...products[1].referenceProfit}},component;await act(async()=>{component=create(<ProcurementCell row={row} role='metric.margin' widget={derived.widgets[0]} binding={derived.bindings[0]}/>);});behavior.push({case:['mutation-before'],dom:component.toJSON()});row.sellerMinor=-0;row.referenceProfit.margin=-.5;row.referenceProfit.profitMinor=-500;await act(async()=>component.update(<ProcurementCell row={row} role='metric.margin' widget={derived.widgets[0]} binding={derived.bindings[0]}/>));behavior.push({case:['mutation-after'],dom:component.toJSON()});await act(async()=>component.unmount());
 const stableConstructor=Intl.NumberFormat;
 const probeWidget={id:'probe',type:'product_list',fields:{value:'value'},options:{fieldMeta:{value:{format:'currency',currency:'CNY'}}}};
 let forced=0;
 Intl.NumberFormat=new Proxy(originalNumberFormat,{construct(target,params){forced++;if(params[1]?.currency==='CNY')throw new RangeError('fixture constructor failure');return Reflect.construct(target,params);}});
 behavior.push({case:['constructor-replaced-error'],value:materialDisplay({value:10},'value',probeWidget)});
 Intl.NumberFormat=stableConstructor;
 behavior.push({case:['constructor-restored'],value:materialDisplay({value:10},'value',probeWidget)});
 assert.equal(forced,1);output.behaviorCount=behavior.length;output.behaviorHash=digest(behavior);writeFileSync(args.output??'perf-artifacts/O-parity.json',canonical({output,frames,behavior,providerResults}));
}else writeFileSync(args.output??'perf-artifacts/O-timing.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({...output,requests:undefined,warmMs:undefined,warmConstructions:[...new Set(constructionCounts)]}));
