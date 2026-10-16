import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DataTransfers,DATA_TRANSFER_MAX_BYTES} from '../../packages/app-presentation/src/data-transfers.ts';
import {createDataTransferReader} from '../../packages/component-runtime/src/data-transfer-client.ts';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';

const object=(value:JsonValue)=>value as Record<string,JsonValue>;
function snapshot(text='中😀国'.repeat(33300),revision='dataset-1',cacheTime='2026-10-09T01:00:00Z'):JsonValue {
  return {viewId:'view-A',bindings:[{bindingId:'main',appId:'app',connectionId:'connection',datasetId:'dataset-A',revision,payload:{text,cache:{nextRefreshAt:cacheTime}},resources:[{appId:'app',connectionId:'connection',kind:'row',key:'第一条'}],state:'ready',freshness:'fresh'}]};
}
function bridge(transfers:DataTransfers,current:()=>JsonValue,owner='session-A/view-A/frame-A') {
  const messages:{action:string;params:JsonValue;response:JsonValue}[]=[];
  const extension=async(action:string,params:JsonValue)=>{
    const input=object(params),response=action==='prepare'?transfers.prepare(owner,current(),typeof input.knownRevision==='string'?input.knownRevision:undefined):transfers.read(owner,String(input.id),Number(input.index));messages.push({action,params,response});return response;
  };
  return {messages,extension,reader:createDataTransferReader(extension)};
}
test('333 KB snapshots reassemble Chinese split across chunks and repeat reads transfer only current metadata',async()=>{
  const transfers=new DataTransfers();let current=snapshot();const fixture=bridge(transfers,()=>current);
  const initial=await fixture.reader({method:'getData'});assert.deepEqual(initial,current);
  assert.ok(Buffer.byteLength(JSON.stringify(current),'utf8')>333000);assert.ok(fixture.messages.some(message=>message.action==='read'));
  const firstPrepare=object(fixture.messages[0].response),transfer=object(firstPrepare.transfer),firstChunk=object(transfers.read('session-A/view-A/frame-A',String(transfer.id),0));
  assert.throws(()=>new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(String(firstChunk.chunk),'base64')),'the first chunk deliberately ends within a Unicode sequence');
  const priorReads=fixture.messages.filter(message=>message.action==='read').length;current=snapshot('中😀国'.repeat(33300),'dataset-2','2026-10-09T02:00:00Z');const repeated=await fixture.reader({method:'refresh'});assert.deepEqual(repeated,current);
  assert.equal(fixture.messages.filter(message=>message.action==='read').length,priorReads);assert.equal(object(fixture.messages.at(-1)!.response).unchanged,true);assert.ok(!Object.hasOwn(object(fixture.messages.at(-1)!.response),'body'));
  const encoded=fixture.messages.map(message=>Buffer.byteLength(JSON.stringify({protocolVersion:'2.0',sessionId:'session-A',viewId:'view-A',buildId:'build-A',frameInstanceId:'frame-A',type:'extension',feature:'dataTransferV1',result:message.response}),'utf8'));assert.ok(encoded.every(bytes=>bytes<262144));
  const evidence={scope:'PRODUCTION_DATA_TRANSFER_SERVER_AND_READER_IN_MEMORY',snapshotBytes:Buffer.byteLength(JSON.stringify(initial),'utf8'),firstReadChunks:priorReads,repeatReadChunks:0,maxMessageBytes:Math.max(...encoded),messageLimit:262144,sameContentMetadataUpdated:true,actualDesktop:false};mkdirSync(resolve('artifacts/performance/ui'),{recursive:true});writeFileSync(resolve('artifacts/performance/ui/data-transfer-cost.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
});
test('small snapshots retain their normal complete shape without creating chunk reads',async()=>{
  const data=snapshot('商品'),fixture=bridge(new DataTransfers(),()=>data);assert.deepEqual(await fixture.reader({method:'getData'}),data);assert.equal(fixture.messages.length,1);assert.ok(object(fixture.messages[0].response).body);assert.deepEqual(await fixture.reader({method:'getData'}),data);assert.equal(fixture.messages.length,2);assert.equal(object(fixture.messages[1].response).unchanged,true);
});
test('32 MiB data and excessive metadata remain bounded failures',()=>{
  const transfers=new DataTransfers();assert.throws(()=>transfers.prepare('owner',snapshot('x'.repeat(DATA_TRANSFER_MAX_BYTES))),{code:'DATA_TRANSFER_TOO_LARGE'});
  const data=snapshot(),binding=(object(data).bindings as Record<string,JsonValue>[])[0];binding.extraMetadata='x'.repeat(128001);assert.throws(()=>transfers.prepare('owner',data),{code:'DATA_TRANSFER_METADATA_TOO_LARGE'});
  assert.throws(()=>transfers.prepare('owner',{viewId:'invalid'}),{code:'INVALID_DATA_TRANSFER'});
});
test('frozen transfers isolate owner/frame identities, reject invalid indexes and expire after two minutes',()=>{
  const transfers=new DataTransfers(),data=snapshot(),packet=object(transfers.prepare('A/view/frame-1',data)),transfer=object(packet.transfer),id=String(transfer.id);
  const expected=transfers.read('A/view/frame-1',id,0);(object(data).bindings as Record<string,JsonValue>[])[0].payload={text:'new body'};assert.deepEqual(transfers.read('A/view/frame-1',id,0),expected,'source mutation cannot change a prepared transfer');
  for(const owner of ['B/view/frame-1','A/other-view/frame-1','A/view/frame-2'])assert.throws(()=>transfers.read(owner,id,0),{code:'DATA_TRANSFER_EXPIRED'});
  for(const index of [-1,0.5,Number(transfer.chunks),Number.MAX_SAFE_INTEGER])assert.throws(()=>transfers.read('A/view/frame-1',id,index),{code:'INVALID_DATA_CHUNK'});
  const originalNow=Date.now;try{const future=originalNow()+120001;Date.now=()=>future;assert.throws(()=>transfers.read('A/view/frame-1',id,0),{code:'DATA_TRANSFER_EXPIRED'});}finally{Date.now=originalNow;}
});
test('entry capacity releases the oldest snapshot while keeping new snapshots usable',()=>{
  const transfers=new DataTransfers();let firstId='',lastId='';for(let n=0;n<65;n++){const packet=object(transfers.prepare('owner',snapshot('x'.repeat(221000)+n))),transfer=object(packet.transfer);lastId=String(transfer.id);if(!n)firstId=lastId;}
  assert.throws(()=>transfers.read('owner',firstId,0),{code:'DATA_TRANSFER_EXPIRED'});assert.equal(object(transfers.read('owner',lastId,0)).id,lastId);
});
test('reader rejects tampered chunk bytes and mismatched chunk identities',async()=>{
  for(const tamper of ['bytes','id','index','revision'] as const){
    const fixture=bridge(new DataTransfers(),()=>snapshot());let altered=false;
    const read=createDataTransferReader(async(action,params)=>{const result=object(await fixture.extension(action,params));if(action==='read'&&!altered){altered=true;if(tamper==='bytes'){const bytes=Buffer.from(String(result.chunk),'base64');bytes[0]^=1;return {...result,chunk:bytes.toString('base64')};}return {...result,[tamper]:tamper==='index'?99:'tampered'};}return result;});
    await assert.rejects(read({method:'getData'}),/INVALID_DATA_TRANSFER/);
  }
});
test('overlapping read retains its captured base revision when a newer read finishes before its unchanged response',async()=>{
  const transfers=new DataTransfers(),owner='owner',first=snapshot('甲'.repeat(111000),'first'),second=snapshot('乙'.repeat(111000),'second');let release:(packet:JsonValue)=>void,heldPacket:JsonValue;
  const requests:{action:string;params:JsonValue}[]=[];
  const reader=createDataTransferReader(async(action,params)=>{requests.push({action,params});const input=object(params);if(action==='read')return transfers.read(owner,String(input.id),Number(input.index));const data=input.scope==='second'?second:first,packet=transfers.prepare(owner,data,typeof input.knownRevision==='string'?input.knownRevision:undefined);if(input.scope==='held'){heldPacket=packet;return new Promise<JsonValue>(resolve=>{release=resolve;});}return packet;});
  assert.deepEqual(await reader({scope:'first'}),first);const slow=reader({scope:'held'});await Promise.resolve();assert.equal(object(heldPacket!).unchanged,true);assert.deepEqual(await reader({scope:'second'}),second);release!(heldPacket!);assert.deepEqual(await slow,first,'the late unchanged packet must use its original body, not the newer global body');assert.deepEqual(await reader({scope:'second'}),second);assert.ok(requests.length>3);
});
