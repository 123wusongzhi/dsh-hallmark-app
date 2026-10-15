// Test-owned entry around the actual production composition, never an installed DSH instance.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,watch} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createAppsServer} from '../../../packages/service/src/apps-server.ts';
import {AsyncJsonlLog,RequestObserver} from '../../../packages/service/src/request-log.ts';
import {descriptor,sha} from './fixture.ts';

const directory=resolve(process.env.APPS_DATA_DIR),port=Number(process.env.APPS_PORT),config=JSON.parse(readFileSync(join(directory,'recovery-fixture.json'),'utf8')),connections=JSON.parse(readFileSync(process.env.APPS_CONNECTIONS_FILE,'utf8'));
assert.ok(directory.includes('display-reliability-'));assert.equal(config.port,port);assert.equal(config.token.length,72);assert.deepEqual(connections.connections,[]);
for(const row of config.records)assert.equal(sha(JSON.stringify(row.detail)),row.sha256);
const emit=row=>console.log(JSON.stringify({at:new Date().toISOString(),pid:process.pid,...row}));
// Includes real writer lease, cutover admission, apps.db, authoring.recoverInterrupted,
// evidence relocation, scheduler, business poller, built-in providers and durable invocation log.
if(config.runtimeEntry)assert.equal(sha(readFileSync(config.runtimeEntry)),config.runtimeSha256,'extracted Runtime digest before each real process start');
const {composeAppsRuntime}=config.runtimeEntry?await import(pathToFileURL(config.runtimeEntry).href):await import('../../../packages/service/src/apps-main.ts');
const instance=composeAppsRuntime(directory,connections);
let invocations=0;
// Only test-owned additional Provider; no shop connections/credentials exist.
instance.runtime.register({manifest:{manifestVersion:1,appId:'displayreplay',displayName:'Offline immutable recordings',providerPackage:'acceptance-only',providerVersion:'1.0.0',runtimeProtocolMajor:1,resourceTypes:[]},descriptors:[descriptor],async execute(context){invocations++;emit({event:'offline-provider-invoke',invocations});return {status:'ok',invocationId:context.request.invocationId,traceId:context.request.traceId,data:{items:structuredClone(config.records.map(row=>row.detail))}};},async dispose(){}});
const requestLog=new AsyncJsonlLog({directory:join(directory,'logs'),prefix:'requests-'}),observer=new RequestObserver({log:requestLog});observer.start();
const http=createAppsServer({...instance,token:config.token,port,observer,log:row=>emit({event:'runtime-server-log',row})});
http.prependListener('request',req=>emit({event:'runtime-http',method:req.method,path:req.url}));
await new Promise((done,reject)=>{http.once('error',reject);http.listen(port,'127.0.0.1',done);});
const recovery=instance.runtime.recover();
const manifest=instance.presentation.sources.manifest(config.buildId),archive=instance.presentation.sources.verify(config.buildId),members=[];
const scan=(path,prefix='')=>{for(const item of readdirSync(path,{withFileTypes:true})){const name=prefix+item.name;members.push({name,kind:item.isDirectory()?'directory':item.isSymbolicLink()?'symlink':'file'});if(item.isDirectory())scan(join(path,item.name),name+'/');}};scan(join(instance.presentation.sources.directory,'builds',config.buildId,'project'));
emit({event:'archive-diagnostic',archive,manifestProjectFiles:manifest?.projectFiles,members});
emit({event:'real-runtime-listening',port,productionComposition:true,runtimeMode:config.runtimeEntry?'verified-package':'source',runtimeSha256:config.runtimeSha256??null,initialization:['RuntimeWriterLease','cutoverAdmission','AppsSnapshotScheduler.start','BusinessOperationPoller.start','authoring.recoverInterrupted','runtime.recover','RequestObserver.start'],publicationId:config.publicationId,buildId:config.buildId});
let closing=false;
async function close(){if(closing)return;closing=true;watcher.close();http.closeAllConnections();await new Promise(done=>http.close(done));await recovery;await instance.close();observer.stop();await requestLog.close();emit({event:'real-runtime-stopped',invocations});}
// Test-only PID-scoped graceful cleanup. The actual crash uses process.kill of the owned PID.
const watcher=watch(directory,(_event,name)=>{if(String(name)===`stop-runtime-${process.pid}`)void close();});
