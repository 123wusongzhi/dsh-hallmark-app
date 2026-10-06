import test from 'node:test';
import assert from 'node:assert/strict';
import {HallmarkPlugin} from '../../packages/dsh-plugin/server/index.ts';
import {assertJsonCompatible} from '../../packages/contracts/src/json.ts';
import {TOOL_DEFINITIONS} from '../../packages/contracts/src/index.ts';
import {HOST_PLUGIN_VERSION} from '../../packages/dsh-plugin/server/version.ts';
import {DESIGN_CAPABILITIES} from '../../packages/dsh-plugin/server/design-guidance.ts';
test('native app info identifies executing Host code without overwriting original service fields',async()=>{
 const plugin=new HallmarkPlugin({} as any,{dataDirectory:process.cwd()});
 plugin.client.request=async path=>path.startsWith('/sessions/')?{sessionId:'unit-session',appId:'hallmark',active:true}:{status:'ok',data:{appId:'hallmark',originalField:'kept'}};
 try{
  const result=await plugin.invoke(TOOL_DEFINITIONS.find(tool=>tool.name==='hallmark_app_info')!,{},'unit-session');
  assert.deepEqual(result.data,{appId:'hallmark',originalField:'kept',hostPluginVersion:HOST_PLUGIN_VERSION,designCapabilities:DESIGN_CAPABILITIES});assertJsonCompatible(result);
 }finally{await plugin.dispose();}
});
function localProjection(health:unknown){
 const plugin=new HallmarkPlugin({} as any,{dataDirectory:process.cwd()});let reads=0;
 plugin.client.request=async(path,body)=>{assert.equal(path,'/health');assert.equal(body,undefined);reads++;return health;};
 return {plugin,count:()=>reads};
}
test('workbench health projects genuine statuses only without chat activation or raw credentials',async()=>{
 const {plugin,count}=localProjection({status:'ok',hallmark:{status:'ok',raw:{apiKey:'synthetic-never-forward',operatorToken:'synthetic-never-forward'}}});
 try{
  const result=await plugin.ui(new Request('http://fixture.test/api/hallmark-app?resource=health'));
  assert.equal(result.status,200);const body=await result.json();
  assert.deepEqual(body,{serviceStatus:'ok',hallmarkStatus:'ok'});assertJsonCompatible(body);
  assert.equal(JSON.stringify(body).includes('synthetic-never-forward'),false);assert.equal(count(),1);assert.equal(plugin.cache.size,0);
 }finally{await plugin.dispose();}
});
test('offline upstream never becomes a misleading connected badge and extra request fields fail closed',async()=>{
 const {plugin,count}=localProjection({status:'ok',hallmark:{status:'unavailable',error:{message:'synthetic offline'}}});
 try{
  const bad=await plugin.ui(new Request('http://fixture.test/api/hallmark-app?resource=health&path=/v1/write'));
  assert.equal(bad.status,400);assert.equal(count(),0);
  const result=await plugin.ui(new Request('http://fixture.test/api/hallmark-app?resource=health'));
  assert.deepEqual(await result.json(),{serviceStatus:'ok',hallmarkStatus:'unavailable'});assert.equal(count(),1);
 }finally{await plugin.dispose();}
});
