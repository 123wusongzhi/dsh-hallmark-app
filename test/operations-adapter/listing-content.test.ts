import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleListingAssets} from '../../packages/app-hallmark/src/listing-content.ts';
import {BUSINESS_DESCRIPTORS} from '../../packages/app-hallmark/src/operations-provider.ts';
import type {BusinessRowInput} from '../../packages/app-hallmark/src/operations/types.ts';
import { realDetail } from '../real-data/corpus.ts';

const recorded = realDetail('pinduoduo');
const assets=()=>({images:recorded.images.slice(0,7),richContentImages:recorded.descriptionImages.slice(0,8)});
const row=():BusinessRowInput=>({action:'listing',target:{offerId:'offer'},payload:{},listingAssets:assets()});

test('ordered image delivery replaces stale media once and preserves all unrelated content',()=>{
  const input=row(),original=structuredClone(input),attribute={id:85,values:[{value:'Нет бренда'}]};
  const payload:any={name:recorded.title,images:['old'],primary_image:'old',attributes:[attribute,{id:'11254',values:[{value:'old'}]},{id:11254,values:[]}]};
  assert.deepEqual(assembleListingAssets(input,payload).issues,[]);
  assert.deepEqual(input,original);assert.equal(payload.name,recorded.title);assert.deepEqual(payload.images,input.listingAssets!.images);assert.equal(payload.primary_image,input.listingAssets!.images[0]);
  assert.deepEqual(payload.attributes[0],attribute);assert.equal(payload.attributes.length,2);
  const rich=JSON.parse(payload.attributes[1].values[0].value);
  assert.equal(rich.version,0.3);assert.equal(rich.content.length,8);
  assert.deepEqual(rich.content.map((item:any)=>item.blocks[0].img.src),input.listingAssets!.richContentImages);
  for(const widget of rich.content){assert.equal(widget.widgetName,'raShowcase');assert.equal(widget.type,'billboard');assert.deepEqual(widget.blocks,[{img:{src:widget.blocks[0].img.src,srcMobile:widget.blocks[0].img.src}}]);}
  const once=structuredClone(payload);assembleListingAssets(input,payload);assert.deepEqual(payload,once,'reloading a saved row never duplicates rich content');
  assert.equal(Object.hasOwn(payload,'listingAssets'),false);
});

test('bad or incomplete deliveries cannot partly overwrite a good draft; reuse between rows is allowed',()=>{
  for(const change of [
    (r:BusinessRowInput)=>r.listingAssets!.images.pop(),
    (r:BusinessRowInput)=>{r.listingAssets!.richContentImages[0]=r.listingAssets!.richContentImages[1];},
    (r:BusinessRowInput)=>{r.listingAssets!.richContentImages[0]='file:///local.png';},
    (r:BusinessRowInput)=>{r.listingAssets!.images[0]=null as any;},
    (r:BusinessRowInput)=>{r.action='price';},
  ]){const input=row();change(input);const payload={images:['existing']};assert.ok(assembleListingAssets(input,payload).issues.length);assert.deepEqual(payload,{images:['existing']});}
  const input=row();assert.deepEqual(assembleListingAssets(input,{}).issues,[]);assert.deepEqual(assembleListingAssets({...input,target:{offerId:'other'}},{}).issues,[]);
  assert.deepEqual(assembleListingAssets({...input,listingAssets:undefined},{images:['legacy']}),{issues:[],corrections:[]});
});

test('create and revise expose the same standard media contract',()=>{
  for(const capability of ['hallmark.plan.create','hallmark.plan.revise','hallmark.listing.draft.create']){
    const schema:any=BUSINESS_DESCRIPTORS.find(d=>d.capabilityId===capability)!.inputSchema;
    const media=schema.properties.rows.items.properties.listingAssets;
    assert.deepEqual(media.required,['images','richContentImages']);assert.equal(media.additionalProperties,false);
    assert.equal(media.properties.images.minItems,7);assert.equal(media.properties.images.maxItems,7);assert.equal(media.properties.richContentImages.minItems,8);assert.equal(media.properties.richContentImages.maxItems,8);
  }
});
