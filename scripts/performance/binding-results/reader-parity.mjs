import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
if(process.argv.length!==4)throw Error('Usage: node reader-parity.mjs <baseline-checkout> <candidate-checkout>');
const [oldRoot,newRoot]=process.argv.slice(2).map(x=>resolve(x)),variants=[];
for(const root of [oldRoot,newRoot]){
 const {RuntimeStore}=await import(pathToFileURL(join(root,'packages/app-runtime/src/store.ts')).href);
 const {readResultPage}=await import(pathToFileURL(join(root,'packages/app-runtime/src/projection.ts')).href);
 variants.push({store:new RuntimeStore(':memory:'),readResultPage});
}
const fixtures=[
 'a😀中\ud800Z\udc00\n"\\'.repeat(2500),
 Array.from({length:300},(_,i)=>({id:i,text:'中😀'.repeat(30)})),
 {'a/b~c':'x'.repeat(20000),empty:null,array:[]},
 {['中'.repeat(2000)]:'y'.repeat(20000)},null,0,false,
];
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const at=(root,pointer)=>pointer===''?root:pointer.slice(1).split('/').reduce((value,key)=>{
 key=key.replace(/~1/g,'/').replace(/~0/g,'~');
 assert.ok(value!==null&&typeof value==='object'&&Object.hasOwn(value,key),'oracle path exists');
 return value[key];
},root);
const report={scope:'Function-level ordinary-page parity and exact recovery; no performance claim',oldRoot,newRoot,comparisons:0,strictByteEqual:0,recoveryDifferences:[],recoveries:[]};
const cache=new Map();let fixtureName,original;
function install(name,data){
 fixtureName=name;original={status:'ok',invocationId:'i',traceId:'t',data};cache.clear();
 for(const v of variants)v.store.put('datasets','result:i',{result:original});
}
function call(arm,args,budget){
 try{return {page:variants[arm].readResultPage(variants[arm].store,args.resultRef,args.cursor,args.limit,{path:args.path,budget})};}
 catch(error){return {error:error.message};}
}
function validateText(page,expected,args,budget,serialized){
 assert.ok(bytes(page)<=budget,'every page fits the requested byte budget');
 assert.equal(page.kind,serialized?'serialized-json':'string');
 assert.equal(page.resultRef,args.resultRef);assert.equal(page.path,args.path);
 const text=serialized?JSON.stringify(expected):expected,points=Array.from(text),offset=Number(args.cursor);
 assert.equal(page.offset,offset);assert.equal(page.total,points.length);
 assert.equal(page.cursorUnit,'unicode-code-points');
 assert.ok(Number.isSafeInteger(page.returned)&&page.returned>=0);
 assert.equal(page.text,points.slice(offset,offset+page.returned).join(''),'exact text at the stated cursor');
 const next=offset+page.returned<points.length?String(offset+page.returned):null;
 assert.equal(page.nextCursor,next);
 assert.equal(page.completeness,offset===0&&page.returned===points.length?'complete':'partial');
 if(serialized){
  assert.equal(page.encoding,'json');assert.equal(page.originalKind,Array.isArray(expected)?'array':'object');
  assert.equal(page.bytes,bytes(expected));
  assert.equal(page.readInstruction,'Concatenate text pages in order, then JSON.parse once.');
 }
}
function recover(arm,path,limit,budget){
 const key=JSON.stringify([arm,path,limit,budget]);if(cache.has(key))return cache.get(key);
 const stats={fixture:fixtureName,arm:arm?'B':'A',path,limit,budget,reads:0,maxBytes:0,kinds:{},firstPageKind:null};
 function read(args){
  // Hints must satisfy the public 4000-codepoint path contract.
  if(Array.from(args.path).length>4000)throw Error('UNEXECUTABLE_RESULT_PATH');
  const output=call(arm,args,budget);if(output.error)throw Error(output.error);
  const page=output.page;stats.reads++;stats.maxBytes=Math.max(stats.maxBytes,bytes(page));
  stats.kinds[page.kind]=(stats.kinds[page.kind]??0)+1;stats.firstPageKind??=page.kind;
  assert.ok(bytes(page)<=budget,'every emitted page is bounded');
  assert.equal(page.resultRef,args.resultRef);assert.equal(page.path,args.path);
  if(page.nextCursor!==null){
   assert.ok(page.continuation,'nonterminal page has an executable continuation');
   assert.equal(page.continuation.tool,'apps_inspect');
   assert.deepEqual(page.continuation.arguments,{resultRef:args.resultRef,path:args.path,cursor:page.nextCursor,limit:args.limit});
   assert.ok(Number.isSafeInteger(Number(page.nextCursor))&&Number(page.nextCursor)>Number(args.cursor),'cursor strictly advances');
  }else assert.equal(page.continuation,undefined);
  return page;
 }
 function reconstruct(args){
  let page=read(args);const expected=at(original,args.path);
  if(page.kind==='string'||page.kind==='serialized-json'){
   const serialized=page.kind==='serialized-json';let text='';
   for(let guard=0;;guard++){
    assert.ok(guard<100000,'bounded page loop');validateText(page,expected,args,budget,serialized);text+=page.text;
    if(!page.continuation)break;args=page.continuation.arguments;page=read(args);
   }
   const value=serialized?JSON.parse(text):text;assert.deepEqual(value,expected,'exact original result subtree');return value;
  }
  if(Object.hasOwn(page,'value')){assert.deepEqual(page.value,expected);return page.value;}
  const value=page.kind==='array'?[]:{};
  for(let guard=0;;guard++){
   assert.ok(guard<100000,'bounded page loop');
   if(page.kind==='directory')for(const entry of page.entries){
    assert.ok(!Object.hasOwn(value,entry.key),'no repeated directory key');assert.equal(entry.read.tool,'apps_inspect');
    Object.defineProperty(value,entry.key,{value:reconstruct(entry.read.arguments),enumerable:true});
   }
   else{
    assert.equal(page.kind,'array');assert.equal(page.offset,value.length);
    value.push(...page.items);
    for(const entry of page.deferred??[]){assert.equal(entry.index,value.length);assert.equal(entry.read.tool,'apps_inspect');value.push(reconstruct(entry.read.arguments));}
   }
   if(!page.continuation)break;args=page.continuation.arguments;page=read(args);
  }
  assert.deepEqual(value,expected,'exact original result subtree');return value;
 }
 let result;
 try{const value=reconstruct({resultRef:'result:i',path,cursor:'0',limit});result={...stats,recoverable:true,resultSha256:hash(value)};}
 catch(error){
  // Mismatched values, broken cursors and unexpected exceptions never justify a shape change.
  if(!['RESULT_PATH_BUDGET_EXCEEDED','UNEXECUTABLE_RESULT_PATH'].includes(error.message))throw error;
  result={...stats,recoverable:false,error:error.message};
 }
 cache.set(key,result);report.recoveries.push(result);return result;
}
function compare(path,cursor,limit,budget){
 const args={resultRef:'result:i',path,cursor,limit},outputs=variants.map((_,arm)=>call(arm,args,budget));report.comparisons++;
 if(JSON.stringify(outputs[0])===JSON.stringify(outputs[1])){report.strictByteEqual++;return;}
 const detail={fixture:fixtureName,path,cursor,limit,budget,A:outputs[0].error??outputs[0].page.kind,B:outputs[1].error??outputs[1].page.kind};
 // A recoverable baseline must retain its page shape. Merely proving eventual equality
 // does not excuse an unnecessary switch from a directory/array to text cursors.
 const before=recover(0,path,limit,budget);
 assert.equal(before.recoverable,false,'Unexpected page-shape regression on a fully recoverable baseline: '+JSON.stringify(detail));
 const zero=call(1,{...args,cursor:'0'},budget);assert.equal(zero.page?.kind,'serialized-json','Only the reviewed serialized recovery extension is allowed: '+JSON.stringify(detail));
 const expected=at(original,path);assert.ok(expected!==null&&typeof expected==='object');
 const after=recover(1,path,limit,budget);assert.equal(after.recoverable,true,'Candidate must recover the entire exact subtree');
 const total=Array.from(JSON.stringify(expected)).length;
 if(Number(cursor)>total)assert.deepEqual(outputs[1],{error:'INVALID_PAGE'});
 else{assert.equal(outputs[1].error,undefined);validateText(outputs[1].page,expected,args,budget,true);}
 report.recoveryDifferences.push({...detail,baselineFailure:before.error,candidateResultSha256:after.resultSha256});
}
try{
 for(const [index,data] of fixtures.entries()){
  install('original-'+index,data);
  for(const path of ['', '/data','/data/a~1b~0c','/data/empty','/data/nope'])for(const cursor of ['0','1','9','99'])for(const limit of [1,100,200])for(const budget of [512,14000])compare(path,cursor,limit,budget);
  for(const cursor of ['0','1']){
   assert.equal(...variants.map(v=>JSON.stringify(v.readResultPage(v.store,'result:i',cursor,100))));report.comparisons++;report.strictByteEqual++;
  }
  // Ordinary paths are also followed to completion, rather than checking only first pages.
  for(const path of ['','/data'])for(const budget of [512,14000]){
   const before=recover(0,path,100,budget),after=recover(1,path,100,budget);
   assert.ok(after.recoverable,'Candidate must retain complete recovery');
   if(before.recoverable)assert.equal(before.resultSha256,after.resultSha256);
  }
 }
 for(const [index,data] of [
  {['x'.repeat(4100)]:'中😀'.repeat(7000)},
  {['~/'.repeat(1100)]:'z'.repeat(20000)},
  {['a'.repeat(1990)]:{['b'.repeat(2010)]:'z'.repeat(20000)}},
 ].entries()){
  install('long-pointer-'+index,data);
  for(const budget of [512,14000]){
   compare('/data','0',100,budget);
   const before=recover(0,'/data',100,budget),after=recover(1,'/data',100,budget);
   assert.ok(after.recoverable);if(before.recoverable)assert.equal(before.resultSha256,after.resultSha256);
  }
 }
 report.status='passed';report.byteExact=report.recoveryDifferences.length===0;
 console.log(JSON.stringify(report,null,2));
}catch(error){report.status='failed';report.failure=error.message;console.log(JSON.stringify(report,null,2));throw error;}
finally{for(const v of variants)v.store.close();}
