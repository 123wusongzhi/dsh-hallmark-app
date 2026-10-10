const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const {createRequire}=require('node:module');
const manifest=JSON.parse(fs.readFileSync('source-identity.json','utf8'));
const arm=process.argv[2].replace(/^E-/,'');
const checkoutRequire=createRequire(manifest[arm].root+'/package.json');
const React=checkoutRequire('react');
const {create,unstable_batchedUpdates:batch}=checkoutRequire('react-test-renderer');
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
  let collection=fixture(37);collection.widget.options.materialId='product-list';
  collection.data.payload.products[0].listedIn=[{storeId:'A',storeName:'测试店铺甲',association:'linked',freshness:'fresh',observedAt:'2026-10-10T07:00:00.000Z',saleStates:{on_sale:2,out_of_stock:1,pending:1,archived:1,failed:1,not_sellable:1,unknown:1}},{storeId:'B',storeName:'测试店铺乙',association:'none',freshness:'stale',observedAt:null,saleStates:{}}];
  await update(collection);await check('collection-listedIn-all-statuses','p-0');
  assert.match(JSON.stringify(tree.toJSON()),/测试店铺甲：在售 2/);assert.match(JSON.stringify(tree.toJSON()),/测试店铺乙：待刷新 · 尚无商品关联/);
  await check('collection-listedIn-not-search-text','测试店铺甲');assert.equal(auditTable().getFilteredRowModel().rows.length,0);
  await check('collection-listedIn-clear','');
  collection={...collection,data:{...collection.data,payload:{...collection.data.payload,products:collection.data.payload.products.map((row,i)=>i?row:{...row,listedIn:[{storeId:'A',storeName:'测试店铺甲',association:'linked',freshness:'stale',observedAt:'invalid',saleStates:{on_sale:0,archived:3}}]})}}};
  await update(collection);await check('collection-listedIn-replaced-snapshot','p-0');assert.match(JSON.stringify(tree.toJSON()),/测试店铺甲：待刷新 · 已归档 3/);
  collection={...collection,data:{...collection.data,payload:{...collection.data.payload,products:collection.data.payload.products.map(row=>({...row,listedIn:null}))}}};
  await update(collection);await check('collection-listedIn-missing','p-0');assert.doesNotMatch(JSON.stringify(tree.toJSON()),/测试店铺甲/);
  batch(()=>tree.root.findByType('tbody').findByType('tr').props.onClick());await check('collection-listedIn-selection','p-0');assert.equal(collection.selects.at(-1),'p-0');
  const recordState=(storeId,listingRecord,extra={})=>({storeId,storeName:storeId==='A'?'测试店铺甲':'测试店铺乙',status:'unknown',association:'unknown',freshness:'fresh',observedAt:'2026-10-10T07:00:00.000Z',...(listingRecord?{listingRecord}:{}),...extra});
  let records=fixture(36);records.widget.options.materialId='product-list';
  records.data.payload.products=records.data.payload.products.map((row,i)=>({...row,listedIn:[recordState('A',['not_found','found','found','found','unavailable',undefined][i%6],{hasUnlinkedHistory:true,...(i%6===1?{saleStates:{archived:2}}:i%6===2?{savedListingCount:1}:i%6===3?{saleStates:{failed:1}}:i%6===4?{listingRecordReason:'RECORD_SYNC_FAILED',freshness:'stale'}:{})}),...(i%6===3?[]:[recordState('B',['found','not_found','unavailable','unavailable','found','not_found'][i%6],{hasUnlinkedHistory:false})])]}));
  await update(records);await input('');
  const allIds=records.data.payload.products.map(row=>row.productId),aFound=allIds.filter((_,i)=>[1,2,3].includes(i%6)),aAbsent=allIds.filter((_,i)=>i%6===0),aUnavailable=allIds.filter((_,i)=>[4,5].includes(i%6)),bAbsent=allIds.filter((_,i)=>[1,5].includes(i%6)),bUnavailable=allIds.filter((_,i)=>[2,3].includes(i%6));
  const recordCheck=(label,expected)=>{const ids=auditTable().getFilteredRowModel().rows.map(row=>row.original.productId);assert.deepEqual(ids,expected,label);results.push({label,query:tree.root.findByType('input').props.value,ids,counts:auditCounts(),page:auditTable().getState().pagination,visible:auditTable().getRowModel().rows.map(row=>row.original.productId),snapshot:tree.toJSON(),queries:[...props.queries],selects:[...props.selects]});};
  const recordChange=async(label,value)=>{batch(()=>tree.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));await tick();};
  assert.equal(tree.root.findByProps({'aria-label':'上品记录筛选'}).props.disabled,true);recordCheck('records-no-target-store',allIds);
  assert.equal(tree.root.findAllByType('p').filter(node=>JSON.stringify(node.children).includes('部分历史商品尚未关联')).length,1);
  await recordChange('上品记录店铺','A');recordCheck('records-store-A-all',allIds);
  batch(()=>tree.root.findByProps({'aria-label':'跳转页码'}).props.onChange({target:{value:'2'}}));await tick();assert.equal(auditTable().getState().pagination.pageIndex,2);
  const queryCount=records.queries.length;
  await recordChange('上品记录筛选','found');recordCheck('records-found-includes-archived-failed-draft',aFound);assert.equal(auditTable().getState().pagination.pageIndex,0);
  assert.match(JSON.stringify(tree.toJSON()),/本店有上品记录 · 已归档 2/);assert.match(JSON.stringify(tree.toJSON()),/已保存上品行 1/);assert.match(JSON.stringify(tree.toJSON()),/发布失败 1/);
  await recordChange('上品记录筛选','not_found');recordCheck('records-not-found-keeps-unknown-association',aAbsent);
  await recordChange('上品记录店铺','B');recordCheck('records-store-switch-preserves-filter',bAbsent);assert.doesNotMatch(JSON.stringify(tree.toJSON()),/部分历史商品尚未关联/);
  await recordChange('上品记录筛选','unavailable');recordCheck('records-missing-target-store-unavailable',bUnavailable);
  await recordChange('上品记录店铺','A');recordCheck('records-explicit-and-legacy-unavailable',aUnavailable);assert.match(JSON.stringify(tree.toJSON()),/RECORD_SYNC_FAILED/);
  await recordChange('上品记录店铺','');recordCheck('records-clear-store-disables-filter',allIds);assert.equal(tree.root.findByProps({'aria-label':'上品记录筛选'}).props.disabled,true);
  await recordChange('上品记录店铺','A');await recordChange('上品记录筛选','found');assert.equal(records.queries.length,queryCount,'record controls stay local');
  await input('p-1');recordCheck('records-search-intersection',aFound.filter(id=>id.includes('p-1')));
  await input('');batch(()=>tree.root.findByType('tbody').findAllByType('tr')[0].props.onClick());recordCheck('records-selection-under-filter',aFound);assert.ok(aFound.includes(records.selects.at(-1)));
  records={...records,interactions:{...records.interactions,bindings:{products:{...records.interactions.bindings.products,fullDataset:false,pagination:{loadedCount:36,total:360,hasMore:true},onPage:()=>{}}}}};
  await update(records);recordCheck('records-loaded-scope',aFound);assert.match(JSON.stringify(tree.toJSON()),/筛选仅覆盖已加载商品/);
  records={...records,data:{...records.data,datasetKey:'record-refresh',payload:{...records.data.payload,products:records.data.payload.products.map(row=>({...row,listedIn:row.listedIn.map(state=>state.storeId==='A'?{...state,listingRecord:'not_found',savedListingCount:0,saleStates:{}}:state)}))}}};
  await update(records);recordCheck('records-snapshot-refresh-retains-filter',[]);
  await recordChange('上品记录筛选','not_found');recordCheck('records-snapshot-refresh-new-facts',allIds);
  records={...records,data:{...records.data,datasetKey:'record-store-replaced',payload:{...records.data.payload,products:records.data.payload.products.map(row=>({...row,listedIn:row.listedIn.filter(state=>state.storeId==='B')}))}}};
  await update(records);recordCheck('records-target-disappears-clears-effective-store',allIds);assert.equal(tree.root.findByProps({'aria-label':'上品记录店铺'}).props.value,'');assert.equal(tree.root.findByProps({'aria-label':'上品记录筛选'}).props.disabled,true);
  await recordChange('上品记录店铺','B');recordCheck('records-new-store-keeps-record-choice',bAbsent);
  await recordChange('上品记录筛选','');recordCheck('records-clear-filter',allIds);
  batch(()=>tree.unmount());console.log(JSON.stringify({variant:process.argv[2],mode,results}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
