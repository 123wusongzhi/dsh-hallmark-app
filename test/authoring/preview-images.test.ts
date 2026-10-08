import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error Preview CLI helper.
import {previewImages} from '../../scripts/preview-images.mjs';
test('preview immediately substitutes images, downloads at most six, and reuses disk cache',async()=>{
 const root=mkdtempSync(join(tmpdir(),'preview-images-'));let calls=0;
 try{const images=previewImages(root,{fetchImage:async()=>{calls++;return new Response('image-bytes',{headers:{'content-type':'image/png'}});}});
 for(let i=0;i<60;i++)assert.equal(images.response('https://image.fixture/'+i).contentType,'image/svg+xml');await images.finish();assert.equal(calls,6);
 const cached=previewImages(root,{fetchImage:()=>{throw Error('must not download');}});assert.equal(Buffer.from(cached.response('https://image.fixture/0').body,'base64').toString(),'image-bytes');assert.equal(cached.records[0].status,'cache');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('a hanging image sample has a bounded budget and stays a diagnostic',async()=>{
 const root=mkdtempSync(join(tmpdir(),'preview-images-'));
 try{const images=previewImages(root,{budgetMs:40,fetchImage:(_url:any,{signal}:any)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout'))))});
 const keepAlive=setTimeout(()=>{},2000);const start=performance.now();images.response('https://image.fixture/slow');await images.finish();clearTimeout(keepAlive);assert.ok(performance.now()-start<1000);assert.ok(images.records.some((row:any)=>row.status==='unavailable'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
