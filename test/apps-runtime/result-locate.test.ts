import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {readResultPage} from '../../packages/app-runtime/src/projection.ts';
import type {CapabilityResult,JsonValue} from '../../packages/app-contracts/src/index.ts';
function fixture(text:JsonValue){const store=new RuntimeStore(':memory:'),result:CapabilityResult={status:'ok',invocationId:'i',traceId:'t',data:text};store.put('datasets','result:i',{result});return {store,result,read:(literal:string,cursor='0',limit=100,budget=14000,path='/data')=>readResultPage(store,'result:i',cursor,limit,{path,literal,budget}) as any};}
function all(f:ReturnType<typeof fixture>,literal:string,limit=100){let cursor='0';const matches=[];do{const page=f.read(literal,cursor,limit);assert.equal(page.scanned.from,Number(cursor));assert.equal(page.done,page.nextCursor===null);assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);matches.push(...page.matches);if(page.nextCursor!==null)assert.ok(Number(page.nextCursor)>Number(cursor));cursor=page.nextCursor;}while(cursor!==null);return matches;}
test('repeated and overlapping literal starts are all returned',()=>{const f=fixture('ababa😀中文😀中文');try{assert.deepEqual(all(f,'aba',1).map(x=>x.offset),[0,2]);assert.deepEqual(all(f,'😀中文').map(x=>x.offset),[5,8]);assert.deepEqual(all(f,'absent'),[]);}finally{f.store.close();}});
test('scan window counts starts, including literals that cross its boundary',()=>{const f=fixture('a'.repeat(65535)+'中文😀z'+'b'.repeat(65536));try{const first=f.read('中文😀z');assert.equal(first.scanned.toExclusive,65536);assert.equal(first.done,false);assert.deepEqual(first.matches.map((x:any)=>x.offset),[65535]);assert.deepEqual(all(f,'中文😀z').map(x=>x.offset),[65535]);assert.equal(all(f,'不存在').length,0);}finally{f.store.close();}});
test('Unicode matching is exact, never splits legal pairs, and preserves lone units',()=>{const f=fixture('😀\ud83dX\ude00e\u0301é');try{assert.deepEqual(all(f,'\ud83d').map(x=>x.offset),[1]);assert.deepEqual(all(f,'\ude00').map(x=>x.offset),[3]);assert.deepEqual(all(f,'😀').map(x=>x.offset),[0]);assert.deepEqual(all(f,'é').map(x=>x.offset),[6]);assert.deepEqual(all(f,'e\u0301').map(x=>x.offset),[4]);assert.deepEqual(all(f,'\ud83dX\ude00').map(x=>x.offset),[1]);}finally{f.store.close();}});
test('bounded literal inputs and path kinds fail explicitly',()=>{const f=fixture({x:'abc'});try{for(const s of ['', 'x'.repeat(257)])assert.throws(()=>f.read(s),/INVALID_RESULT_LITERAL/);assert.throws(()=>f.read('x'),/RESULT_LITERAL_REQUIRES_STRING/);assert.throws(()=>f.read('x','0',100,14000,'/missing'),/RESULT_PATH_NOT_FOUND/);}finally{f.store.close();}});
test('render budget pagination does not lose or duplicate match starts',()=>{const f=fixture('a'.repeat(400));try{let cursor='0';const offsets=[];do{const page=f.read('a',cursor,200,1024);offsets.push(...page.matches.map((x:any)=>x.offset));assert.ok(Buffer.byteLength(JSON.stringify(page))<=1024);cursor=page.nextCursor;}while(cursor!==null);assert.deepEqual(offsets,Array.from({length:400},(_,i)=>i));}finally{f.store.close();}});
test('long key fits or fails explicitly without truncated or invalid pointers',()=>{const key='中'.repeat(1200),f=fixture({[key]:'a'.repeat(10000)});try{const page=f.read('a','0',200,14000,'/data/'+key);assert.equal(page.path,'/data/'+key);assert.ok(Buffer.byteLength(JSON.stringify(page))<=14000);assert.throws(()=>f.read('a','0',200,512,'/data/'+key),/RESULT_PATH_BUDGET_EXCEEDED/);}finally{f.store.close();}});
test('each call sees fresh store replacement and deletion',()=>{const f=fixture('a'.repeat(100));try{assert.equal(f.read('a','0',1).nextCursor,'1');f.store.put('datasets','result:i',{result:{...f.result,data:'b'.repeat(100)}});assert.equal(f.read('a','1',1).matches.length,0);f.store.delete('datasets','result:i');assert.throws(()=>f.read('a'),/RESULT_NOT_FOUND/);}finally{f.store.close();}});

test('literal length uses code points consistently with schema',()=>{const f=fixture('😀'.repeat(256)+'\\ud800');try{for(const count of [128,256])assert.ok(f.read('😀'.repeat(count)).matches.length);assert.throws(()=>f.read('😀'.repeat(257)),/INVALID_RESULT_LITERAL/);}finally{f.store.close();}});

test('tight budgets and decimal cursor boundaries never lose matches or stall',()=>{
 for(const budget of [640,660,700,768,1024])for(const from of [0,8,9,98,99,998,999]){
  const f=fixture('a'.repeat(1030));try{let cursor=String(from);const offsets=[];let failed=false;
   for(let calls=0;cursor!==null&&calls<1031;calls++){
    let page;try{page=f.read('a',cursor,200,budget);}catch(error){assert.match(String(error),/RESULT_PATH_BUDGET_EXCEEDED/);assert.equal(offsets.length,0,'Cannot fail only after a partial match sequence');failed=true;break;}
    assert.ok(Buffer.byteLength(JSON.stringify(page))<=budget);offsets.push(...page.matches.map((x:any)=>x.offset));
    if(page.nextCursor!==null)assert.ok(Number(page.nextCursor)>Number(cursor));cursor=page.nextCursor;
   }
   if(!failed){assert.equal(cursor,null);assert.deepEqual(offsets,Array.from({length:1030-from},(_,i)=>i+from));}
  }finally{f.store.close();}
 }
});

test('empty strings, NUL and executable continuation preserve exact scope',()=>{const empty=fixture(''),nul=fixture('a\u0000b\u0000');try{assert.deepEqual(all(empty,'x'),[]);assert.deepEqual(all(nul,'\u0000',1).map(x=>x.offset),[1,3]);const page=nul.read('\u0000','0',1);assert.deepEqual(page.continuation,{tool:'apps_inspect',arguments:{resultRef:'result:i',path:'/data',literal:'\u0000',cursor:page.nextCursor,limit:1}});}finally{empty.store.close();nul.store.close();}});
