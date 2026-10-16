import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
const baseRoot=resolve(args.baseline),candidateRoot=resolve(args.candidate);
const {DataTransfers}=await import(pathToFileURL(join(baseRoot,'packages/app-presentation/src/data-transfers.ts')).href);
assert.equal(readFileSync(join(baseRoot,'packages/app-presentation/src/data-transfers.ts'),'utf8'),readFileSync(join(candidateRoot,'packages/app-presentation/src/data-transfers.ts'),'utf8'));
const {createDataTransferReader:baseline}=await import(pathToFileURL(join(baseRoot,'packages/component-runtime/src/data-transfer-client.ts')).href);
const {createDataTransferReader:patched}=await import(pathToFileURL(join(candidateRoot,'packages/component-runtime/src/data-transfer-client.ts')).href);
const originalFrom=Uint8Array.from,originalClone=globalThis.structuredClone,originalDigest=crypto.subtle.digest.bind(crypto.subtle);
const records=[];let counter;
Uint8Array.from=function(value,mapper,thisArg){if(counter&&typeof value==='string'){counter.fromCalls++;counter.decodedBytes+=value.length;const originalMapper=mapper;mapper=(v,i)=>{counter.mapperCalls++;return originalMapper.call(thisArg,v,i);};}return originalFrom.call(this,value,mapper,thisArg);};
globalThis.structuredClone=function(value,options){if(counter)counter.cloneCalls++;return originalClone(value,options);};
crypto.subtle.digest=async function(...args){if(counter){counter.digestCalls++;counter.digestBytes+=args[1].byteLength;}return originalDigest(...args);};
const snapshot=(text,revision='dataset-1',cache='2026-10-10T00:00:00Z')=>({viewId:'v',bindings:[{bindingId:'main',appId:'app',connectionId:'connection',datasetId:'dataset-A',revision,payload:{text,cache:{nextRefreshAt:cache}},resources:[{appId:'app',connectionId:'connection',kind:'row',key:'第一条'}],state:'ready',freshness:'fresh'}]});
const resultHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize=(value,ids=new Map())=>JSON.parse(JSON.stringify(value,(_k,v)=>{if(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(v)){if(!ids.has(v))ids.set(v,'transfer-'+(ids.size+1));return ids.get(v);}return v;}));
function instrument(readerFactory,text){
 const transfers=new DataTransfers();let current=snapshot(text);const trace=[];
 const read=readerFactory(async(action,params)=>{const response=action==='prepare'?transfers.prepare('owner',current,params.knownRevision):transfers.read('owner',params.id,params.index);trace.push({action,params,response});return response;});
 return{read,trace,set(value){current=value;},get(){return current;}};
}
try{
 for(const [name,text]of [['inline','中文😀'.repeat(100)],['chunk333','中😀国'.repeat(33300)],['chunk2m','商品𠮷😀'.repeat(150000)]]){
  const pair=[];
  for(const [arm,factory]of [['baseline',baseline],['patched',patched]]){
   const fixture=instrument(factory,text);const steps=[];
   for(const stage of ['initial','unchanged','changed','caller-mutation']){
    if(stage==='unchanged')fixture.set(snapshot(text,'dataset-2','2026-10-10T01:00:00Z'));
    if(stage==='changed')fixture.set(snapshot(text+'改','dataset-3'));
    counter={fromCalls:0,decodedBytes:0,mapperCalls:0,cloneCalls:0,digestCalls:0,digestBytes:0};const value=await fixture.read({method:stage==='initial'?'getData':'refresh'});const counted=counter;counter=undefined;
    assert.deepEqual(value,fixture.get());steps.push({stage,hash:resultHash(value),counts:counted});value.bindings[0].payload.text='caller mutation';
   }
   const normalizedTrace=normalize(fixture.trace);pair.push({arm,name,steps,traceHash:resultHash(normalizedTrace),trace:normalizedTrace});
  }
  assert.deepEqual(pair[0].steps.map(({stage,hash})=>({stage,hash})),pair[1].steps.map(({stage,hash})=>({stage,hash})));assert.deepEqual(pair[0].trace,pair[1].trace);records.push(...pair.map(({trace,...rest})=>rest));
 }
 for(const defect of ['bytes','id','index','revision','base64','short','oversize']){
  const results=[];
  for(const factory of [baseline,patched]){
   const transfers=new DataTransfers();let altered=false;
   const read=factory(async(action,params)=>{const response=action==='prepare'?transfers.prepare('owner',snapshot('中😀国'.repeat(33300)),params.knownRevision):transfers.read('owner',params.id,params.index);
    if(action==='read'&&!altered){altered=true;const value={...response};if(defect==='bytes'){const bytes=Buffer.from(value.chunk,'base64');bytes[0]^=1;value.chunk=bytes.toString('base64');}else if(defect==='base64')value.chunk='%%%';else if(defect==='short')value.chunk='eA==';else if(defect==='oversize')value.chunk='x'.repeat(90001);else value[defect]=defect==='index'?999:'tampered';return value;}return response;});
   try{await read({method:'getData'});throw Error('expected rejection');}catch(error){assert.notEqual(error.message,'expected rejection');results.push({name:error.name,message:error.message});}
  }
  assert.deepEqual(results[0],results[1]);records.push({defect,error:results[0]});
 }
 for(const factory of [baseline,patched]){
  const transfers=new DataTransfers(),first=snapshot('甲'.repeat(111000),'first'),second=snapshot('乙'.repeat(111000),'second');let release,held;
  const read=factory(async(action,params)=>{
   if(action==='read')return transfers.read('owner',params.id,params.index);
   const packet=transfers.prepare('owner',params.scope==='second'?second:first,params.knownRevision);
   if(params.scope==='held'){held=packet;return new Promise(resolve=>{release=resolve;});}return packet;
  });
  assert.deepEqual(await read({scope:'first'}),first);const slow=read({scope:'held'});await Promise.resolve();assert.equal(held.unchanged,true);assert.deepEqual(await read({scope:'second'}),second);release(held);assert.deepEqual(await slow,first);assert.deepEqual(await read({scope:'second'}),second);
 }
 records.push({guard:'overlapping unchanged read uses its captured revision',baseline:true,patched:true});
 writeFileSync(args.output,JSON.stringify({scope:'actual DataTransfers and production reader; no browser, no live network, no elapsed-time claim',records},null,2));console.log(JSON.stringify({parity:true,records:records.length,output:args.output}));
}finally{Uint8Array.from=originalFrom;globalThis.structuredClone=originalClone;crypto.subtle.digest=originalDigest;}
