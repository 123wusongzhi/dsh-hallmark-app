import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {realCollection, realCorpus, realCorpusPath, realDetail, realPricingSettings} from '../real-data/corpus.ts';
// The standalone skill helper also runs in headless DSH without this repository.
// @ts-ignore standalone skill distribution has no TypeScript declaration
import {check, finalize, production, record, recover} from '../../skills/ozon-listing/scripts/handoff.mjs';

function setup(t:any) {
  const root = mkdtempSync(join(tmpdir(),'listing-handoff-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  const put = (name:string, value:any) => {const path=join(root,name);writeFileSync(path,JSON.stringify(value));return path;};
  return {root,put};
}

function recordedFacts() {
  const source=realDetail('d80bbb57-e22e-4ed1-8c25-9e30a3f53b39'),collection=realCollection(source.id);
  const captured=realCorpus().imageAssets.find(image=>image.productId===source.id&&image.status==='captured')!;
  const asset=collection.assets.find(image=>image.url===captured.url)!;
  assert.ok(captured&&asset);assert.ok(collection.package.weightGrams&&collection.package.dimensionsMm);
  const sourcePath=resolve(dirname(realCorpusPath),captured.file!);
  const data={...source,itemId:source.id,sourceRevision:collection.revision,sourceImages:source.images,
    images:[{id:asset.id,purpose:'subject',path:sourcePath,sourceSkuIds:collection.skus.map(sku=>sku.id)}],
    measurements:[{name:'weight',value:collection.package.weightGrams,unit:'g'},{name:'dimensions',value:collection.package.dimensionsMm,unit:'mm'}]};
  return {source,collection,sourcePath,captured,data};
}
test('正式交付拒绝全量分类和噪音，初稿不就绪，变更自动增版且不可静默改写',t=>{
  const {root,put}=setup(t), output=join(root,'product.json');
  const {source,collection,data}=recordedFacts();
  const draft=put('draft.json',data);
  assert.throws(()=>check(draft),/未正式交付/);
  assert.equal(finalize(draft,output).factsRevision,1);
  const delivered=JSON.parse(readFileSync(output,'utf8'));
  assert.deepEqual(delivered.skus,source.skus);assert.deepEqual(delivered.sourceDetails,source.sourceDetails);
  assert.deepEqual(delivered.measurements[0],{name:'weight',value:collection.package.weightGrams,unit:'g'});
  assert.deepEqual(delivered.measurements[1].value,collection.package.dimensionsMm);
  assert.deepEqual(delivered.images[0].sourceSkuIds,source.skus.map((sku:any)=>sku.sourceSkuId));
  assert.equal(finalize(draft,output).factsRevision,1);
  // Explicit revision/tampering controls start from the genuine package measurements.
  data.measurements[0].value=Number(collection.package.weightGrams)+1;put('draft.json',data);
  assert.equal(finalize(draft,output).factsRevision,2);
  put('bad.json',{...data,images:{main:data.images,detail:[]}});
  assert.throws(()=>finalize(join(root,'bad.json'),output),/有效图片数组/);
  put('bad.json',{...data,images:[{...data.images[0],purpose:'noise'}]});
  assert.throws(()=>finalize(join(root,'bad.json'),output),/只接受有效/);
  const tampered=JSON.parse(readFileSync(output,'utf8'));tampered.measurements[0].value=Number(collection.package.weightGrams)+999;put('product.json',tampered);
  assert.throws(()=>check(output),/被改写/);
});
test('中断恢复保留宿主成功结果；没有成功回执的未完成调用可以重新生成',t=>{
  const {root,put}=setup(t), ledger=join(root,'progress.json');
  const {source,sourcePath,captured}=recordedFacts(),first=source.skus[6],second=source.skus[9];
  // Ledger stages/session/slot positions are controlled recovery states; image bytes and both SKU identities are recorded.
  const base={factsRevision:1,preparationRevision:first.purchaseRevision,sessionId:'child',references:[sourcePath],slots:[{saleId:first.sourceSkuId,group:'images',index:0}],prompt:source.title};
  record(ledger,{...base,assetKey:first.sourceSkuId,stage:'generating'});
  const cache=join(root,'host-cache.png');copyFileSync(sourcePath,cache);
  record(ledger,{assetKey:first.sourceSkuId,stage:'generated',sourcePath:cache});
  record(ledger,{...base,assetKey:second.sourceSkuId,preparationRevision:second.purchaseRevision,stage:'generating',slots:[{saleId:second.sourceSkuId,group:'images',index:0}]});
  assert.deepEqual(recover(ledger).map((a:any)=>a.nextAction),['stage_existing','generate']);
  const staged=join(root,'staged.png');copyFileSync(cache,staged);assert.deepEqual(readFileSync(staged),readFileSync(sourcePath));
  record(ledger,{assetKey:first.sourceSkuId,stage:'staged',path:staged});
  record(ledger,{assetKey:first.sourceSkuId,stage:'published',url:captured.url});
  assert.throws(()=>record(ledger,{assetKey:first.sourceSkuId,stage:'generating'}),/不得回退/);
  assert.throws(()=>record(ledger,{assetKey:first.sourceSkuId,stage:'published',factsRevision:2}),/版本/);
  rmSync(cache);rmSync(staged);
  assert.equal(recover(ledger)[0].nextAction,'reuse_published');
  assert.equal(recover(ledger)[0].sourcePath,cache);
});
test('制作清单从正式资料生成，混合销售清单中的原图和价格不会绕过筛选',t=>{
  const {root,put}=setup(t),product=join(root,'product.json'),output=join(root,'production.json');
  const {source,data}=recordedFacts(),sku=source.skus[0];
  assert.deepEqual(sku.sourceSellingPrice,{role:'seller_sale',currency:'USD',amount:0.04});
  assert.equal(sku.currency,'CNY');assert.equal(sku.price,0.26);assert.equal(sku.purchaseOverride.purchaseMinor,26);
  const draft=put('draft.json',data);
  // A one-SKU handoff row is a controlled preparation shape; its spec, procurement identity and purchase amount are recorded.
  const sale={saleId:sku.sourceSkuId,sourceSkuId:sku.sourceSkuId,spec:sku.spec,purchaseMinor:sku.purchaseOverride.purchaseMinor,sourceImages:source.images,procurement:[{sourceSkuId:sku.sourceSkuId,quantity:1}]};
  const manifest=put('sales.json',{itemId:source.id,sourceRevision:data.sourceRevision,preparationRevision:sku.purchaseRevision,sourceFacts:{sourceImages:source.images},researchEntrypoints:{raw:source.sourceUrl},rules:realPricingSettings(),sales:[sale]});
  assert.throws(()=>production(draft,manifest,output),/未正式交付/);
  finalize(draft,product);production(product,manifest,output);
  const text=readFileSync(output,'utf8'),result=JSON.parse(text);
  assert.doesNotMatch(text,/sourceImages|sourceFacts|researchEntrypoints|rules|purchaseMinor/);
  assert.equal(result.factsRevision,1);assert.equal(result.itemId,source.id);
  assert.deepEqual(result.sales,[{saleId:sku.sourceSkuId,sourceSkuId:sku.sourceSkuId,procurement:sale.procurement,spec:sku.spec}]);
});

test('unchanged recorded image survives category re-preparation and session recovery; content change still rejects reuse',t=>{
 const {root}=setup(t),ledger=join(root,'recovery.json'),{source,sourcePath,captured}=recordedFacts();
 const entry={assetKey:source.id,stage:'published',factsRevision:1,salesRevision:'same-sales',preparationRevision:'before-category',sessionId:'original',references:[sourcePath],slots:[{saleId:source.skus[0].sourceSkuId,group:'images',index:0}],sourcePath,path:sourcePath,url:captured.url};
 record(ledger,entry);
 const reused=record(ledger,{...entry,preparationRevision:'after-category',sessionId:'restored'});
 assert.equal(reused.url,captured.url);assert.equal(recover(ledger)[0].nextAction,'reuse_published');
 assert.throws(()=>record(ledger,{...entry,salesRevision:'changed-sales'}),/版本/);
 assert.throws(()=>record(ledger,{...entry,factsRevision:2}),/版本/);
});
