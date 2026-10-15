import test from 'node:test';
import assert from 'node:assert/strict';
import {AppsHost,RuntimeHealthMonitor,type AppsHostTransport,type AppsPluginContext} from '../../packages/plugin-apps/src/index.ts';

test('connection check requires both node and data interface, clears success after failures',async()=>{
  let mode='ok',nodeOnline=true,reads=0;
  const transport={health:async()=>{if(!nodeOnline)throw new TypeError('offline');return {status:'ok'};},dataHealth:async()=>{reads++;if(mode==='timeout')throw new Error('timeout');return {hallmark:{status:mode}};}} as unknown as AppsHostTransport;
  const monitor=new RuntimeHealthMonitor({probe:()=>transport.health!(),downAfter:1});
  const host=new AppsHost({} as AppsPluginContext,transport,undefined,{health:monitor});
  try{
    assert.equal((await host.checkConnection()).state,'connected');
    mode='unavailable';assert.equal((await host.checkConnection()).state,'degraded');
    mode='timeout';assert.equal((await host.checkConnection()).data.state,'unavailable');
    nodeOnline=false;const before=reads,status=await host.checkConnection();
    assert.equal(status.state,'disconnected');assert.equal(reads,before);assert.equal(status.canRestart,false);
    nodeOnline=true;mode='ok';assert.equal((await host.checkConnection()).state,'connected');
    const unsupported=await host.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restartRuntime'})}));
    assert.equal(unsupported.status,503);
    const crossOrigin=await host.ui(new Request('http://localhost/api/dsh-apps',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://other.example'},body:JSON.stringify({action:'restartRuntime'})}));
    assert.equal(crossOrigin.status,403);
  }finally{await host.dispose();}
});
