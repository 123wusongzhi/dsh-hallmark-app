import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Config, CONFIG_APPLIES_NOTICE, snapshotPluginConfig } from '../../packages/dsh-plugin/server/config.ts';
import { assertJsonCompatible } from '../../packages/contracts/src/json.ts';

const defaults={serviceUrl:'http://127.0.0.1:4180',autoStart:false,requestTimeoutMs:75_000,contentBudgetBytes:16_384};

test('native static Config exposes real synchronous Standard Schema and serializable GUI metadata',()=>{
 const validation=Config['~standard'].validate({});assert.ok(!('then' in validation));assert.ok('value' in validation);assert.equal('issues' in validation,false);
 assert.equal(typeof Config({}).autoStart,'boolean');assert.equal(Config({}).autoStart,false);
 const json=Config.toJSON();assertJsonCompatible(json);assert.equal(JSON.stringify(json).includes(CONFIG_APPLIES_NOTICE),true);
 assert.equal(JSON.stringify(json).includes('"volatile":true'),false);assert.equal(JSON.stringify(json).includes('operatorToken'),false);
 assert.deepEqual(snapshotPluginConfig(validation.value),defaults);
});
test('snapshot primitive config preserves compatibility and omits optional undefined/empty paths',()=>{
 assert.deepEqual(snapshotPluginConfig(undefined),defaults);assert.deepEqual(snapshotPluginConfig({serviceUrl:'http://127.0.0.1:4180',autoStart:false}),defaults);
 const value=snapshotPluginConfig({nodeExecutable:undefined,serviceEntry:'',serviceCwd:'',dataDirectory:''});assert.deepEqual(value,defaults);assertJsonCompatible(value);
 for(const field of ['nodeExecutable','serviceEntry','serviceCwd','dataDirectory'])assert.equal(Object.hasOwn(value,field),false);
 const input={serviceUrl:'http://127.0.0.1:4180/',autoStart:false};const result=snapshotPluginConfig(input);assert.equal(input.serviceUrl,'http://127.0.0.1:4180/');assert.equal(result.serviceUrl,'http://127.0.0.1:4180');
});
test('schema and apply snapshot reject unsafe or nonliteral service origins',()=>{
 for(const url of ['http://localhost:4180','http://127.1','http://2130706433','http://0x7f000001','https://127.0.0.1','http://name@127.0.0.1:4180','http://127.0.0.1:4180/path','http://127.0.0.1?key=x','http://127.0.0.1#fragment','http://127.0.0.1:0','http://127.0.0.1:65536','http://127.0.0.1:99999',' http://127.0.0.1']){
  assert.equal('issues' in Config['~standard'].validate({serviceUrl:url}),true,url);assert.throws(()=>snapshotPluginConfig({serviceUrl:url}),url);
 }
 for(const url of ['http://127.0.0.1','http://127.0.0.1:4180/','http://[::1]:4180','http://127.0.0.1:65535'])assert.equal(snapshotPluginConfig({serviceUrl:url}).serviceUrl,new URL(url).origin);
});
test('snapshot rejects unknown fields, accessors, class config and boxed booleans without executing them',()=>{
 for(const value of [null,[],true,'config',new Date(),{unknown:undefined},{autoStart:'false'},{autoStart:new Boolean(false)},{requestTimeoutMs:NaN},{requestTimeoutMs:99},{requestTimeoutMs:90_001},{requestTimeoutMs:100.5},{contentBudgetBytes:2047},{contentBudgetBytes:65_537}])assert.throws(()=>snapshotPluginConfig(value));
 let calls=0;const accessor=Object.defineProperty({},'autoStart',{enumerable:true,get(){calls++;return true;}});assert.throws(()=>snapshotPluginConfig(accessor),/INVALID_PLUGIN_CONFIG_FIELD/);assert.equal(calls,0);
 assert.throws(()=>snapshotPluginConfig({autoStart:{get(){calls++;return true;}}}));assert.equal(calls,0);
 assert.throws(()=>snapshotPluginConfig({[Symbol('extra')]:true}),/UNKNOWN_PLUGIN_CONFIG_FIELD/);
 assert.throws(()=>snapshotPluginConfig(Object.defineProperty({},'autoStart',{value:false,enumerable:false})),/INVALID_PLUGIN_CONFIG_FIELD/);
});
test('autoStart defaults false and needs explicit absolute Node, entry and cwd, without spawning',()=>{
 assert.throws(()=>snapshotPluginConfig({autoStart:true}),/AUTO_START_REQUIRES_EXPLICIT_NODE_ENTRY_CWD/);
 assert.throws(()=>snapshotPluginConfig({nodeExecutable:'node.exe'}),/PLUGIN_CONFIG_PATH_MUST_BE_ABSOLUTE/);
 const explicit={autoStart:true,nodeExecutable:process.execPath,serviceEntry:join(process.cwd(),'explicit-service-entry.ts'),serviceCwd:process.cwd(),dataDirectory:process.cwd()};
 assert.equal(snapshotPluginConfig(explicit).autoStart,true);assertJsonCompatible(snapshotPluginConfig(explicit));
 assert.throws(()=>snapshotPluginConfig({...explicit,nodeExecutable:join(process.cwd(),'DeepSeek Harness.exe')}),/AUTO_START_REQUIRES_EXPLICIT_NODE_ENTRY_CWD/);
 for(const field of ['dataDirectory','nodeExecutable','serviceEntry','serviceCwd'])assert.throws(()=>snapshotPluginConfig({...explicit,[field]:'relative/path'}),/PLUGIN_CONFIG_PATH_MUST_BE_ABSOLUTE/);
});
