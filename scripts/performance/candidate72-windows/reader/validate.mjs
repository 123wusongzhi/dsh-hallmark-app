import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

if(process.argv.length!==4)throw new Error('Usage: node validate.mjs <baseline-root> <candidate-root>');
const roots=process.argv.slice(2).map(root=>resolve(root));
const readers=await Promise.all(roots.map(async root=>(await import(pathToFileURL(join(root,'packages/app-runtime/src/projection.ts')).href)).readResultPage));
let comparisons=0,errorComparisons=0,reconstructed=0;
const outputHash=createHash('sha256');
function compare(text,cursor='0',budget=14000,limit=100,path='/data/a~1b~0c'){
  const result={status:'ok',invocationId:'equivalence',traceId:'trace',data:{'a/b~c':text}},before=JSON.stringify(result);
  const store={get(table,id){assert.equal(table,'datasets');assert.equal(id,'result:equivalence');return {result};}};
  const outputs=readers.map(read=>{try{return {value:read(store,'result:equivalence',cursor,limit,{path,budget})};}catch(error){return {error:{name:error.name,message:error.message}};}});
  const json=outputs.map(output=>JSON.stringify(output));
  assert.equal(json[1],json[0],`Different result: cursor=${cursor}, budget=${budget}, limit=${limit}, path=${path}, codeUnits=${text.length}`);
  assert.equal(JSON.stringify(result),before);comparisons++;outputHash.update(json[0]+'\n');
  if(outputs[0].error){errorComparisons++;return outputs[0];}
  assert.ok(Buffer.byteLength(JSON.stringify(outputs[0].value),'utf8')<=budget);
  return outputs[0];
}
const samples=['','ASCII','汉字商品详情','😀🧭𝄞','A中😀𝄞\ud800B\udc00\n"\\Z','\ud800','\udc00','\ud800\ud800\udc00','\u0000\b\f\n\r\t"\\'];
for(const text of samples){
  const total=Array.from(text).length;
  for(const budget of [512,1024,14000,16384])for(let cursor=0;cursor<=total+1;cursor++)compare(text,String(cursor),budget);
}
// Deterministic mixed Unicode, including legal JSON strings containing lone surrogates.
const alphabet=['a','中','😀','𝄞','\ud800','X','\udc00','\n','"','\\','\u0000'];
let seed=72;
for(let sample=0;sample<64;sample++){
  let text='';for(let i=0;i<200+sample;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;text+=alphabet[seed%alphabet.length];}
  const total=Array.from(text).length;
  for(const cursor of [0,1,2,Math.floor(total/2),Math.max(0,total-1),total,total+1])for(const budget of [512,1024,14000])compare(text,String(cursor),budget);
}
for(const pattern of ['abcdefghij','汉字商品详情','😀🧭𝄞😎🌍','俄文 русский 汉字 😀𝄞\n"\\']){
  const text=pattern.repeat(10000),total=Array.from(text).length;
  for(const cursor of [0,1,13999,14000,Math.floor(total/2),total-1,total,total+1])for(const budget of [512,2048,14000,16384])compare(text,String(cursor),budget);
  const complete=pattern.repeat(300);let cursor='0',restored='',pages=0;
  do{
    const output=compare(complete,cursor,1024);assert.ok(output.value);const page=output.value;
    assert.equal(page.offset,Number(cursor));assert.equal(page.cursorUnit,'unicode-code-points');
    assert.equal(page.returned,Array.from(page.text).length);restored+=page.text;pages++;
    if(page.nextCursor===null)break;
    assert.ok(Number(page.nextCursor)>Number(cursor));cursor=page.nextCursor;assert.ok(pages<10000);
  }while(true);
  assert.equal(restored,complete);reconstructed++;
}
for(const cursor of ['-1','1.5','NaN','9007199254740992'])compare('汉😀',cursor);
for(const budget of [511,16385,1.5,NaN])compare('汉😀','0',budget);
for(const limit of [0,201,1.5])compare('汉😀','0',14000,limit);
for(const path of ['/data/a~2b','/data/missing','/data/a~1b~0c/0'])compare('汉😀','0',14000,100,path);
console.log(JSON.stringify({suite:'candidate72-reader-equivalence',status:'PASS',baselineRoot:roots[0],candidateRoot:roots[1],comparisons,errorComparisons,reconstructed,outputHash:outputHash.digest('hex'),platform:process.platform,node:process.version}));
