import test from 'node:test';
import assert from 'node:assert/strict';
import type {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {readResultPage} from '../../packages/app-runtime/src/projection.ts';

const fixture=(text:string)=>{
  const result={status:'ok',invocationId:'string',traceId:'trace',data:{text}};
  const store={get(table:string,id:string){assert.equal(table,'datasets');assert.equal(id,'result:string');return {result};}} as unknown as RuntimeStore;
  return (cursor='0',budget=14000)=>readResultPage(store,'result:string',cursor,100,{path:'/data/text',budget});
};

test('string cursors count code points and preserve paired and unpaired UTF-16 exactly',()=>{
  const text='A中😀𝄞\ud800B\udc00\n"\\Z',read=fixture(text);
  const page=read('2');
  assert.deepEqual(page,{
    resultRef:'result:string',path:'/data/text',kind:'string',bytes:Buffer.byteLength(JSON.stringify(text),'utf8'),
    text:'😀𝄞\ud800B\udc00\n"\\Z',returned:9,cursorUnit:'unicode-code-points',offset:2,total:11,nextCursor:null,completeness:'partial',
  });
  const end=read('11');assert.equal(end.text,'');assert.equal(end.returned,0);assert.equal(end.total,11);assert.equal(end.nextCursor,null);
  assert.throws(()=>read('12'),/INVALID_PAGE/);
});

test('bounded string pages reconstruct exact Unicode and JSON escapes while retaining continuation identity',()=>{
  const text='汉字😀𝄞俄文 русский\r\n\t"\\\ud800X\udc00'.repeat(120),read=fixture(text);
  let cursor='0',restored='',pages=0;
  do{
    const page=read(cursor,512);
    assert.ok(Buffer.byteLength(JSON.stringify(page),'utf8')<=512);
    assert.equal(page.offset,Number(cursor));assert.equal(page.cursorUnit,'unicode-code-points');
    assert.equal(Array.from(page.text as string).length,page.returned);
    assert.ok(Number(page.returned)>0);restored+=page.text;pages++;
    if(page.nextCursor===null)break;
    assert.equal(Number(page.nextCursor),Number(cursor)+Number(page.returned));
    assert.deepEqual(page.continuation,{tool:'apps_inspect',arguments:{resultRef:'result:string',path:'/data/text',cursor:page.nextCursor,limit:100}});
    cursor=String(page.nextCursor);
  }while(pages<1000);
  assert.ok(pages>1&&pages<1000);assert.equal(restored,text);
});

test('empty strings and terminal cursor retain complete versus partial semantics',()=>{
  const empty=fixture('')();assert.equal(empty.text,'');assert.equal(empty.returned,0);assert.equal(empty.total,0);assert.equal(empty.completeness,'complete');
  const read=fixture('😀');assert.equal(read().completeness,'complete');assert.equal(read('1').completeness,'partial');
  assert.throws(()=>read('-1'),/INVALID_PAGE/);assert.throws(()=>read('0.5'),/INVALID_PAGE/);
  assert.throws(()=>read('0',511),/INVALID_MODEL_BUDGET/);
});
