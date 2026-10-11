import assert from 'node:assert/strict';
import test from 'node:test';
import {readResultPage} from '../../packages/app-runtime/src/projection.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/index.ts';
test('string bytes and Unicode cursors preserve native JSON spelling under bounded budgets',()=>{
 const store=new RuntimeStore(':memory:');
 try {for(const unit of ['', 'abc', '中文', '😀🚀', 'é', '\ud800 x \udc00', '\u2028\u2029', '"\\\n\r\b\f\t\u0000\u001f'])for(const repeat of [1,1500]){
  const value=unit.repeat(repeat),points=Array.from(value);store.put('datasets','result:string',{result:{status:'ok',invocationId:'s',traceId:'t',data:value}});
  for(const budget of [512,777,14000,16384]){
   let cursor='0',joined='';do{
    const page=readResultPage(store,'result:string',cursor,100,{path:'/data',budget}) as any;
    assert.equal(page.bytes,Buffer.byteLength(JSON.stringify(value)));assert.equal(page.total,points.length);assert.equal(page.offset,Number(cursor));assert.equal(page.text,points.slice(page.offset,page.offset+page.returned).join(''));assert.ok(Buffer.byteLength(JSON.stringify(page))<=budget);
    joined+=page.text;cursor=page.nextCursor;
   }while(cursor!==null);assert.equal(joined,value);
   for(const offset of [0,Math.floor(points.length/2),points.length]){
    const page=readResultPage(store,'result:string',String(offset),100,{path:'/data',budget}) as any;assert.equal(page.text,points.slice(offset,offset+page.returned).join(''));
   }
  }
 }}finally{store.close();}
});
