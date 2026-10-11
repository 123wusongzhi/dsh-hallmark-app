// Independent deterministic function-level oracle; no performance claim.
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
if(process.argv.length!==3)throw Error('Usage: node literal-oracle.mjs <candidate-checkout>');
const root=resolve(process.argv[2]);
const {readResultPage}=await import(pathToFileURL(join(root,'packages/app-runtime/src/projection.ts')).href);
let seed=20261010;const rng=n=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%n);
const alphabet=['a','b','中','😀','\ud800','\udc00','\u0301','\u200d','\n','\\'];
let pages=0,cases=0;
function check(value,literal,start=0,limit=3,budget=1000){
 const cp=Array.from(value),needle=Array.from(literal),expected=[];
 for(let i=start;i<cp.length;i++)if(needle.every((v,j)=>cp[i+j]===v))expected.push(i);
 const store={get:()=>({result:{invocationId:'fuzz-i',traceId:'fuzz-t',status:'ok',data:{text:value}}})};
 let cursor=String(start),found=[],guard=0;
 for(;;){
  assert(++guard<100000);const page=readResultPage(store,'fuzz',cursor,limit,{path:'/data/text',literal,budget});pages++;
  assert(Buffer.byteLength(JSON.stringify(page))<=budget);
  assert.equal(page.literalLength,needle.length);assert.equal(page.scanned.from,Number(cursor));
  for(const match of page.matches){assert.equal(match.length,needle.length);assert.equal(match.readCursor,String(Math.max(0,match.offset-256)));found.push(match.offset);}
  if(page.nextCursor===null){assert.equal(page.done,true);assert.equal(page.total,cp.length);break;}
  assert.equal(page.done,false);assert.equal(page.total,null);assert(Number(page.nextCursor)>Number(cursor));assert(Number(page.nextCursor)-Number(cursor)<=65536);cursor=page.nextCursor;
 }
 assert.deepEqual(found,expected);cases++;
}
for(let c=0;c<5000;c++){
 let value='';for(let i=rng(60);i>0;i--)value+=alphabet[rng(alphabet.length)];
 const cp=Array.from(value);let literal='';
 if(cp.length&&rng(2))literal=cp.slice(rng(cp.length),undefined).slice(0,1+rng(5)).join('');
 else for(let i=1+rng(5);i>0;i--)literal+=alphabet[rng(alphabet.length)];
 check(value,literal,rng(cp.length+1),1+rng(7),800+rng(12)*100);
}
for(const start of [0,1,65533,65534,65535,65536,65537])check('a'.repeat(65535)+'😀b\ud800x','a😀b',start,1,900);
check('a'.repeat(140000),'z',0,1,900);
console.log(JSON.stringify({seed:20261010,cases,pages,status:'passed',scope:'independent function-level Unicode/codepoint oracle; no HTTP or performance claim'}));
