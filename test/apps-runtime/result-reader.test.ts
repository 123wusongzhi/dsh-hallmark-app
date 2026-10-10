import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpAppsHostTransport} from '../../packages/plugin-apps/src/transport.ts';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RuntimeStore } from '../../packages/app-runtime/src/store.ts';
import { projectModelResult, readResultPage } from '../../packages/app-runtime/src/projection.ts';
import { composeAppsRuntime } from '../../packages/service/src/apps-main.ts';
import { createAppsServer } from '../../packages/service/src/apps-server.ts';
import type { CapabilityResult, JsonValue } from '../../packages/app-contracts/src/index.ts';

const bytes=(value:unknown)=>Buffer.byteLength(JSON.stringify(value),'utf8');
function fixture(data:JsonValue){
  const store=new RuntimeStore(':memory:');
  const result:CapabilityResult={status:'ok',invocationId:'original',traceId:'trace',data};
  store.put('datasets','result:original',{result});
  const read=(path='',cursor='0',limit=100,budget=14000)=>readResultPage(store,'result:original',cursor,limit,{path,budget});
  return {store,result,read};
}

test('exact pointer restores deep brand values from the original, not empty sample arrays',()=>{
  const brand=[{dictionary_value_id:12345,value:'雅士爵'}];
  const ctx=fixture({response:{result:[{attributes:[{id:85,values:brand}],description:'大'.repeat(10000)}]}});
  try{
    const spill=projectModelResult(ctx.store,ctx.result),summary=JSON.parse(spill.content);
    assert.equal(summary.sample.response.result[0].attributes[0].values.length,0);
    assert.equal(summary.read.tool,'apps_inspect');
    assert.doesNotMatch(summary.message,/authoringGuidance|SQLite/);
    const page=ctx.read('/data/response/result/0/attributes/0/values');
    assert.deepEqual(page.items,brand);assert.equal(page.completeness,'complete');
    const root=ctx.read();assert.equal(root.kind,'directory');assert.ok(bytes(root)<=14000);
    assert.deepEqual(readResultPage(ctx.store,'result:original').result,ctx.result);
  }finally{ctx.store.close();}
});

test('array pagination preserves complete UTF8 elements and reconstructs exact data under budget',()=>{
  const rows=Array.from({length:80},(_,id)=>({id,text:'中🧭'.repeat(80)})),ctx=fixture(rows);
  try{
    const actual:JsonValue[]=[],seen=new Set<string>();let cursor='0';
    while(true){
      assert.equal(seen.has(cursor),false);seen.add(cursor);
      const page=ctx.read('/data',cursor,30,2048);
      assert.ok(bytes(page)<=2048);actual.push(...page.items as JsonValue[]);
      if(page.nextCursor===null)break;
      assert.deepEqual(page.continuation,{tool:'apps_inspect',arguments:{resultRef:'result:original',path:'/data',cursor:page.nextCursor,limit:30}});
      cursor=String(page.nextCursor);
    }
    assert.deepEqual(actual,rows);
  }finally{ctx.store.close();}
});

test('oversized array element returns a child path and advances, with no shortened original item',()=>{
  const huge={text:'长'.repeat(10000),brand:'Exact'},ctx=fixture([huge,{id:2}]);
  try{
    const page=ctx.read('/data','0',20,1200);
    assert.deepEqual(page.items,[]);assert.equal(page.returned,0);assert.equal(page.nextCursor,'1');
    const reference=(page.deferred as Array<Record<string,JsonValue>>)[0];
    assert.equal(reference.path,'/data/0');assert.ok(bytes(page)<=1200);
    const child=ctx.read(String(reference.path),'0',20,1200);assert.equal(child.kind,'directory');
    assert.deepEqual(ctx.read('/data/0/brand').text,'Exact');
    assert.deepEqual(ctx.read('/data',String(page.nextCursor),20,1200).items,[{id:2}]);
  }finally{ctx.store.close();}
});

test('object directory pages preserve every escaped key and strings resume without Unicode loss',()=>{
  const original='俄文 русский 汉字 😀𝄞\n"\\'.repeat(700),data:Record<string,JsonValue>={'a/b~c':original};
  for(let i=0;i<50;i++)data[`field${i}`]='X'.repeat(2000);
  const ctx=fixture(data);
  try{
    const keys:string[]=[];let cursor='0';
    do{
      const page=ctx.read('/data',cursor,10,1600);assert.ok(bytes(page)<=1600);
      keys.push(...(page.entries as Array<{key:string}>).map(entry=>entry.key));
      cursor=page.nextCursor===null?'':String(page.nextCursor);
    }while(cursor);
    assert.deepEqual(keys,Object.keys(data));
    let restored='';cursor='0';
    do{
      const page=ctx.read('/data/a~1b~0c',cursor,100,1200);assert.ok(bytes(page)<=1200);
      restored+=page.text;assert.equal(page.cursorUnit,'unicode-code-points');
      cursor=page.nextCursor===null?'':String(page.nextCursor);
    }while(cursor);
    assert.equal(restored,original);
    assert.throws(()=>ctx.read('/data/a~2b'),/INVALID_RESULT_PATH/);
    assert.throws(()=>ctx.read('/data/toString'),/RESULT_PATH_NOT_FOUND/);
    assert.throws(()=>ctx.read('/data/a~1b~0c/0'),/RESULT_PATH_NOT_FOUND/);
    assert.throws(()=>ctx.read('/data','0',0),/INVALID_PAGE/);
  }finally{ctx.store.close();}
});

test('explicit null/empty fields stay exact and invalid or huge pointers fail explicitly',()=>{
  const ctx=fixture({empty:[],zero:0,unknown:null,text:'',huge:{['x'.repeat(2000)]:'y'.repeat(2000)}});
  try{
    assert.deepEqual(ctx.read('/data/empty').items,[]);
    assert.equal(ctx.read('/data/zero').value,0);assert.equal(ctx.read('/data/unknown').value,null);
    assert.equal(ctx.read('/data/text').text,'');assert.equal(ctx.read('/data/text').nextCursor,null);
    assert.throws(()=>ctx.read('/data/huge','0',100,512),/RESULT_PATH_BUDGET_EXCEEDED/);
  }finally{ctx.store.close();}
});

test('bounded HTTP reads require the original enabled app connection, including fork recovery',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'result-reader-'));
  const instance=composeAppsRuntime(directory,{connections:['n','other'].map(connectionId=>({appId:'notes',connectionId,displayName:connectionId,config:{backend:`local:${connectionId}`},enabled:true,configRevision:1}))});
  const token='r'.repeat(64),server=createAppsServer({...instance,token});
  try{
    const result:CapabilityResult={status:'ok',invocationId:'inv',traceId:'t',data:{brand:'雅士爵',padding:'x'.repeat(20000)}};
    instance.store.put('datasets','result:inv',{result});
    instance.store.put('invocations','inv',{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:'original'}},result});
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();assert.ok(address&&typeof address!=='string');
    const get=(query:string)=>fetch(`http://127.0.0.1:${address.port}/v1/results/result%3Ainv${query}`,{headers:{Authorization:`Bearer ${token}`}});
    const bind=(sessionId:string,connectionId:string,enabled=true)=>instance.runtime.bind({sessionId,appId:'notes',connectionId,enabled,boundAt:new Date().toISOString()});
    assert.equal((await get('?path=/data/brand')).status,403);
    assert.equal((await get('?path=/data/brand&sessionId=unbound')).status,403);
    bind('foreign','other');assert.equal((await get('?path=/data/brand&sessionId=foreign')).status,403);
    bind('original','n');const own=await get('?path=/data/brand&sessionId=original');assert.equal(own.status,200);assert.equal((await own.json()).text,'雅士爵');
    bind('fork','n');assert.equal((await get('?path=&sessionId=fork')).status,200);
    const hostTransport=new HttpAppsHostTransport(`http://127.0.0.1:${address.port}`,token);
    const exact=await hostTransport.readModelResult({resultRef:'result:inv',sessionId:'fork',path:'/data/brand',limit:100}) as any;
    assert.equal(exact.text,'雅士爵');
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/v1/results%2Fresult%3Ainv?sessionId=fork&path=%2Fdata%2Fbrand`,{headers:{Authorization:`Bearer ${token}`}})).status,400);
    bind('fork','n',false);assert.equal((await get('?path=&sessionId=fork')).status,403);
    bind('original','n',false);assert.equal((await get('?path=&sessionId=original')).status,403);
    // Existing trusted authoring clients retain the original complete HTTP contract.
    assert.deepEqual((await(await get('')).json()).result,result);
  }finally{
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
    await instance.close();rmSync(directory,{recursive:true,force:true});
  }
});
