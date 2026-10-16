import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectSourceProject} from '../../packages/source-components/src/index.ts';
// Product CLIs are directly executable JavaScript modules.
// @ts-expect-error JavaScript CLI has no generated declaration file.
import {startSourcePreview,preparePreviewData,parsePreviewArgs} from '../../scripts/source-preview.mjs';
// @ts-expect-error JavaScript CLI has no generated declaration file.
import {parseCaptureArgs,runInteraction} from '../../scripts/source-capture.mjs';
import {toProduct,displayPrice,displayDate} from '../../component-workspace/collected-products/src/lib/products.ts';
import {realCorpus,realDetail} from '../real-data/corpus.ts';

test('preview serves exact dist bytes and uses the persisted source build fingerprint',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'hallmark-preview-'));mkdirSync(join(directory,'dist','assets'),{recursive:true});
  const index='<html><script src="./assets/app.js"></script></html>';const script='console.log("same build");';
  writeFileSync(join(directory,'dist','index.html'),index);writeFileSync(join(directory,'dist','assets','app.js'),script);writeFileSync(join(directory,'component.json'),JSON.stringify({name:'preview test'}));
  const sample=realDetail();
  const preview=await startSourcePreview({directory,port:0,loadData:()=>[{bindingId:'collected',datasetKey:'actual',payload:{items:[sample]},provenance:{endpoint:'/api/items'}}]});
  try{
    const manifest=await (await fetch(preview.url+'/__manifest.json')).json() as any;
    assert.equal(manifest.buildId,inspectSourceProject(directory).buildId);
    assert.equal(await (await fetch(preview.url+'/dist/index.html')).text(),index);
    const resource=await fetch(preview.url+'/dist/assets/app.js');assert.match(resource.headers.get('content-type')! ,/javascript/);assert.equal(await resource.text(),script);
    assert.equal((await fetch(preview.url+'/component.json')).status,404);
    assert.equal((await fetch(preview.url+'/dist/../component.json')).status,404);
    const data=await (await fetch(preview.url+'/__data.json')).json() as any;assert.equal(data.selection[0].eligible,true);assert.equal(data.selection[0].rows[0].identity.itemId,sample.id);
    assert.match(await (await fetch(preview.url)).text(),/preview:true/);
    mkdirSync(join(directory,'.preview'));writeFileSync(join(directory,'.preview','feedback.json'),'{}');assert.equal(inspectSourceProject(directory).buildId,manifest.buildId);
  }finally{await preview.close();rmSync(directory,{recursive:true,force:true});}
});

test('preview represents missing data without fictional products and selects only source-backed IDs',()=>{
  assert.deepEqual(preparePreviewData([]).bindings,[]);
  const incomplete=preparePreviewData([{bindingId:'x',payload:{items:[{id:'one'}]},provenance:{}}]);assert.equal(incomplete.selection[0].eligible,false);assert.deepEqual(incomplete.selection[0].rows,[]);
  const duplicate=preparePreviewData([{bindingId:'x',payload:{items:[{id:'one'},{id:'one'}]},provenance:{endpoint:'/api/items'}}]);assert.equal(duplicate.selection[0].eligible,false);
  const wrapped=preparePreviewData({status:'ok',data:{viewId:'a',bindings:[{bindingId:'collected',payload:{items:[{id:'real'}]},provenance:{endpoint:'/api/items'}}],missing:[]}});assert.equal(wrapped.bindings[0].bindingId,'collected');assert.equal(wrapped.selection[0].rows[0].identity.itemId,'real');
  assert.throws(()=>preparePreviewData({status:'failed',error:{message:'当前会话组件不存在。'}}),/当前会话组件不存在/);
});

test('CLI validation reports incomplete live source and invalid dimensions before launching a browser',()=>{
  assert.throws(()=>parsePreviewArgs(['--session','a']),/together/);
  assert.throws(()=>parsePreviewArgs(['--data','a','--session','s','--view','v']),/Choose/);
  assert.throws(()=>parseCaptureArgs(['--width','0']),/positive integer/);
  assert.throws(()=>parseCaptureArgs(['--height','NaN']),/positive integer/);
  assert.equal(parseCaptureArgs(['--width','380','--height','820'])['width'],380);
});

test('interaction feedback asserts rendered text and preserves specific failures',async()=>{
  const frame={locator:()=>({innerText:async()=>'已选 2 件商品'})};
  assert.deepEqual(await runInteraction(frame,{action:'assertText',selector:'footer',text:'2 件'}),{actual:'已选 2 件商品'});
  await assert.rejects(runInteraction(frame,{action:'assertText',selector:'footer',text:'3 件'}),/received/);
  await assert.rejects(runInteraction(frame,{action:'unknown'}),/Unknown interaction/);
});

test('template adapts real collected summary fields and keeps missing values explicit',()=>{
  for(const {summary} of realCorpus().records){
    const product=toProduct(summary.id,summary);
    assert.equal(product.title,summary.title);assert.equal(product.image,summary.mainImage??undefined);
    assert.equal(product.source,summary.sourceLabel);assert.equal(product.skuCount,summary.skuCount);
    assert.equal(product.timestamp,summary.importedAt?Date.parse(summary.importedAt):undefined);
    assert.equal(typeof displayPrice(product),'string');
  }
  const missing=toProduct('missing',{});assert.equal(missing.price,undefined);assert.equal(missing.timestamp,undefined);assert.equal(displayPrice(missing),'未提供报价');assert.equal(displayDate('not a date'),'时间未提供');
});
