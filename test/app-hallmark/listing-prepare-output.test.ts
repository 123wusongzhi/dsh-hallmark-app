import test from 'node:test';
import assert from 'node:assert/strict';
import {compactPreparationPage} from '../../packages/app-hallmark/src/listing-prepare-output.ts';
import {realAncillary,realCollections} from '../real-data/corpus.ts';

test('shared preparation fields round-trip exactly and never expand small responses',()=>{
 const template=realAncillary('ozonCategoryTemplate'),sample=realCollections().find(product=>product.skus.length&&product.package.weightGrams===null)!;
 assert.ok(sample,'An actually missing common package weight must be represented');
 const category={status:'selected',attributes:template.attributes},common={weightGrams:sample.package.weightGrams,dimensionsMm:sample.package.dimensionsMm,origin:{weight:'missing',dimensions:sample.package.dimensionsMm?'product-common':'missing'}};
 // Thirty local sale aliases replay one genuine unknown-package source for the compression workload.
 const input={sales:Array.from({length:30},(_,i)=>({id:`${sample.id}:replay-${i}`,packaging:{...common,version:`version-${i}`,missing:[{field:'weight',members:[{sourceSkuId:sample.skus[i%sample.skus.length].id}]}]}})),categories:{a:category,b:structuredClone(category)}};
 const before=JSON.stringify(input),page=compactPreparationPage(input);
 assert.ok(page.shared?.packaging);assert.ok(page.shared?.categories);
 const restored={sales:page.sales.map(s=>{const {sharedRef,...local}=s.packaging;return {...s,packaging:sharedRef===undefined?local:{...page.shared!.packaging[sharedRef],...local}};}),categories:Object.fromEntries(Object.entries(page.categories).map(([id,c])=>[id,c.sharedRef===undefined?c:page.shared!.categories[c.sharedRef]]))};
 assert.deepEqual(restored,input);assert.equal(JSON.stringify(input),before);assert.ok(Buffer.byteLength(JSON.stringify(page))<Buffer.byteLength(before));
 const small={sales:[input.sales[0]],categories:{a:category}};assert.deepEqual(compactPreparationPage(small),small);
});
