const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const React=require('react');
const {create,unstable_batchedUpdates:batch}=require('react-test-renderer');
const {ProductList,auditTable,auditCounts,resetAuditCounts,createMaterialView}=require('./'+process.argv[2]+'.cjs');
const n=Number(process.argv[3]||1000), mode=process.argv[4]||'timing';
const tick=()=>new Promise(r=>setImmediate(r));
const roles={'product.id':'productId','product.name':'title','product.image':'imageUrl','product.url':'productUrl','purchase.url':'purchaseLinks','sku.id':'sku','sku.specification':'salesSpecification','purchase.specification':'purchaseSpecification','purchase.price':'purchaseMinor','price.current':'sellerMinor','price.currency':'currency','metric.margin':'referenceProfit.margin','logistics.plan':'logisticsPlan'};
function fixture(size){
  const view=createMaterialView('product-procurement');
  const widget={...view.widgets[0],fields:{...roles},options:{...view.widgets[0].options,rowsPath:'products',fieldMeta:{'purchase.price':{format:'currency',currency:'CNY',numericScale:.01},'price.current':{format:'currency',numericScale:.01},'metric.margin':{format:'percent',percentScale:'fraction'}}}};
  const products=Array.from({length:size},(_,i)=>({productId:`p-${i}`,sku:`SKU-${100000+i}`,offerId:`OFFER-${100000+i}`,title:`商品 ${i} ${['陶瓷保温杯','桌面收纳盒','运动旅行袋'][i%3]}`,alternateTitle:`映射后商品 ${i}`,salesSpecification:`销售规格-${i} / 蓝色 / 350ml`,purchaseSpecification:`采购规格-${i} / 标准包装 / 单只`,imageUrl:null,productUrl:'https://example.invalid/product/'+i,purchaseLinks:[],purchaseMinor:1000+i,sellerMinor:2000+i,currency:'CNY',packageGrams:350,logisticsPlan:'标准物流',referenceProfit:{margin:i%11===0?null:(i%50-10)/100,profitMinor:600,logisticsMinor:200,commissionMinor:200,fixedMinor:0}}));
  const data={bindingId:'products',datasetKey:'synthetic-shop-A',state:'ready',payload:{products,total:size},provenance:{source:'synthetic_fixture'}};
  const queries=[],selects=[];
  const interactions={bindings:{products:{fullDataset:true,operations:{search:'loaded',sort:'loaded'},onQueryChange:q=>queries.push(q)}},onSelect:e=>selects.push(e.value)};
  return {widget,data,interactions,queries,selects};
}
let tree,props;
function render(){return React.createElement(ProductList,props);}
async function mount(next){props=next;batch(()=>{tree=create(render());});await tick();}
async function update(next){props=next;batch(()=>tree.update(render()));await tick();}
async function input(query){resetAuditCounts();const startCPU=process.cpuUsage(),start=performance.now();batch(()=>tree.root.findByType('input').props.onChange({target:{value:query}}));const ms=performance.now()-start,cpu=process.cpuUsage(startCPU);assert.equal(tree.root.findByType('input').props.value,query);const ids=auditTable().getFilteredRowModel().rows.map(r=>r.original.productId);const counts=auditCounts();await tick();return {query,ms,cpuMs:(cpu.user+cpu.system)/1000,ids,counts,heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss};}
const norm=s=>String(s).normalize('NFKC').toLocaleLowerCase().trim();
async function main(){
  if(mode==='timing'){
    const fixtureProps=fixture(n);if(global.gc)global.gc();const before=process.memoryUsage();const t=performance.now();await mount(fixtureProps);const mountMs=performance.now()-t;
    const cases=[['miss','绝对不存在的商品'],['selective-sku','sku-100205'],['last-role','采购规格-137'],['partial','陶瓷'],['all-hit','商品'],['clear','']];
    for(const [,q] of cases)await input(q);
    if(global.gc)global.gc();const mounted=process.memoryUsage();const samples=[];
    for(const [label,q] of cases)samples.push({label,...await input(q)});
    if(global.gc)global.gc();const retained=process.memoryUsage();batch(()=>tree.unmount());await tick();tree=null;props=null;if(global.gc)global.gc();
    console.log(JSON.stringify({variant:process.argv[2],n,mode,mountMs,before,mounted,retained,afterUnmount:process.memoryUsage(),samples}));return;
  }
  const results=[];const check=async(label,q)=>{const sample=await input(q);results.push({label,query:q,ids:sample.ids,counts:sample.counts,page:auditTable().getState().pagination,visible:auditTable().getRowModel().rows.map(r=>r.original.productId),snapshot:tree.toJSON(),queries:[...props.queries],selects:[...props.selects]});return sample;};
  let f=fixture(267);f.data.payload.products[42]={...f.data.payload.products[42],title:'ＡＢＣ－００４２ Café e\u0301 ﬀ ① 中文',salesSpecification:['蓝色',null,{尺寸:'XL'}],purchaseSpecification:null};f.data.payload.products[43]={...f.data.payload.products[43],title:null,sku:undefined,offerId:null,salesSpecification:0,purchaseSpecification:NaN};
  await mount(f);
  for(const q of ['','商品','sku-100205','OFFER-100205','销售规格-205','采购规格-205','abc-0042','CAFÉ','é','ff','1','暂无数据','蓝色','尺寸：xl','不存在','  ＳＫＵ－１００２０５  ','   '])await check('unicode-null-array:'+q,q);
  await check('clear-before-sort','');batch(()=>tree.root.findAllByType('th').find(x=>x.props['aria-sort']).findByType('button').props.onClick({persist(){}}));await check('sort-search','商品');batch(()=>tree.root.findByProps({'aria-label':'跳转页码'}).props.onChange({target:{value:'2'}}));await check('page-reset','sku-100205');batch(()=>tree.root.findByType('tbody').findByType('tr').props.onClick());await check('selection','OFFER-100205');
  f={...f,widget:{...f.widget,fields:{...f.widget.fields,'product.name':'alternateTitle'}}};await update(f);await check('widget-field-map','映射后');
  f={...f,widget:{...f.widget,fields:{...f.widget.fields,'product.name':undefined}},binding:{id:'products',datasetKey:'synthetic-shop-A',fieldMap:{'product.name':'alternateTitle'}}};await update(f);await check('binding-field-map','映射后商品 42');
  f={...f,widget:{...f.widget,fields:{...f.widget.fields,'sku.specification':'packageGrams'},options:{...f.widget.options,fieldMeta:{...f.widget.options.fieldMeta,'sku.specification':{format:'integer',unit:'克',numericScale:.1}}}}};await update(f);await check('unit-and-scale','35 克');
  f={...f,widget:{...f.widget,options:{...f.widget.options,fieldMeta:{...f.widget.options.fieldMeta,'sku.specification':{format:'integer',unit:'公斤',numericScale:.001}}}}};await update(f);await check('unit-change','公斤');
  f={...f,widget:{...f.widget,options:{...f.widget.options,fieldMeta:{...f.widget.options.fieldMeta,'product.name':{confirmed:false}}}}};await update(f);await check('unconfirmed-field','映射后');
  await check('pre-refresh-query','offer-100042');f={...f,data:{...f.data,datasetKey:'same-shop-refreshed',payload:{products:f.data.payload.products.map((r,i)=>({...r,offerId:'REFRESH-'+i}))}}};await update(f);assert.equal(auditTable().getFilteredRowModel().rows.length,0);await check('data-refresh-same-query','offer-100042');await check('data-refresh','refresh-42');
  f={...f,data:{...f.data,datasetKey:'synthetic-shop-B',payload:{products:f.data.payload.products.slice(0,17).map((r,i)=>({...r,productId:'B-'+i,sku:'SHOPB-'+i}))}}};await update(f);assert.equal(auditTable().getFilteredRowModel().rows.length,0);await check('store-swap-same-query','refresh-42');await check('store-swap','shopb');
  f={...f,widget:{...f.widget,options:{...f.widget.options,columns:[{field:'product.image'},...f.widget.options.columns]}}};await update(f);await check('image-first-column','shopb-2');batch(()=>auditTable().getAllLeafColumns()[0].toggleVisibility(false));await check('hidden-first-column','shopb-3');
  f={...f,widget:{...f.widget,options:{...f.widget.options,columns:[{field:'purchase.price'}]}}};await update(f);await check('single-column','shopb-1');f={...f,widget:{...f.widget,options:{...f.widget.options,columns:[{field:'selection'},{field:'product.name'}]}}};await update(f);await check('custom-first-column','shopb-4');
  f={...f,widget:{...f.widget,options:{...f.widget.options,columns:[]}}};await update(f);await check('zero-columns','impossible');
  for(const kind of ['ordinary-full','procurement-loaded','ordinary-loaded','procurement-server']){let g=fixture(37);g.widget.options.materialId=kind.startsWith('ordinary')?'product-list':'product-procurement';g.interactions.bindings.products.fullDataset=kind==='ordinary-full';if(kind==='procurement-server')g.interactions.bindings.products.operations={search:'server',sort:'server'};await update(g);for(const q of ['陶瓷','暂无数据','CNY','不存在'])await check(kind+':'+q,q);if(kind==='procurement-server'){batch(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await check('server-submit','商品');}}
  batch(()=>tree.unmount());console.log(JSON.stringify({variant:process.argv[2],mode,results}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
