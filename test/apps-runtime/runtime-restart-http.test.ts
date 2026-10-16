import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {RequestObserver} from '../../packages/service/src/request-log.ts';

test('restart endpoint authenticates, refuses busy service and acknowledges before stopping',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'restart-http-')),token='a'.repeat(64);
  const instance=composeAppsRuntime(dir,{connections:[]});
  let stops=0,busy=false;
  const observer=new RequestObserver({log:{write(){}}}),original=observer.inFlight.bind(observer);
  observer.inFlight=()=>[...original(),...(busy?[{requestId:'busy',route:'POST /v1/invocations',elapsedMs:1}]:[])];
  const server=createAppsServer({...instance,token,observer,restart:()=>{stops++;}});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/v1/runtime/restart`;
  const call=(authorized=true,body={})=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  try{
    assert.equal((await call(false)).status,401);assert.equal(stops,0);
    busy=true;assert.equal((await call()).status,409);assert.equal(stops,0);
    busy=false;assert.equal((await call(true,{command:'arbitrary'})).status,400);assert.equal(stops,0);
    const result=await call();assert.equal(result.status,202);assert.deepEqual(await result.json(),{status:'accepted'});assert.equal(stops,1);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await instance.close();observer.stop();rmSync(dir,{recursive:true,force:true});}
});
