import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cutoverAdmission,writeCutoverAdmission} from '../../packages/service/src/cutover-admission.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {NotesProvider} from '../../packages/app-notes/src/index.ts';
import {validateCutoverEvidence} from '../../packages/app-migration/src/maintenance.ts';
import {request as httpRequest} from 'node:http';

test('cutover evidence rejects malformed booleans and unverified or unresolved input',()=>{
  const valid={oldWriterStopped:true,runtimeWriterCount:1,gateStates:{G0:'VERIFIED',G1:'VERIFIED',G2:'VERIFIED',G3:'VERIFIED',G4:'VERIFIED'},unresolvedOperationIds:[],migrationStatus:'migrated'};
  assert.deepEqual(validateCutoverEvidence(valid),{allowed:true,reasons:[]});
  for(const input of [null,{...valid,oldWriterStopped:'true'},{...valid,gateStates:[]},{...valid,unresolvedOperationIds:'none'},{...valid,extra:true}])assert.equal(validateCutoverEvidence(input as any).allowed,false);
  assert.equal(validateCutoverEvidence({...valid,unresolvedOperationIds:['unknown-operation']}).allowed,false);
  assert.equal(validateCutoverEvidence({...valid,gateStates:{...valid.gateStates,G1:'NOT_RUN'}}).allowed,false);
});

test('cutover admission consumes denied and approved decisions, preserves interrupted checks and rejects copied/corrupt records',()=>{
  const root=mkdtempSync(join(tmpdir(),'dsh-cutover-admission-')),a=join(root,'a'),b=join(root,'b');mkdirSync(a);mkdirSync(b);
  try{
    const admit=cutoverAdmission(a);admit();
    writeCutoverAdmission(a,{allowed:false,reasons:['CUTOVER_CHECK_IN_PROGRESS']});assert.throws(admit,/CUTOVER_ADMISSION_BLOCKED/);
    writeCutoverAdmission(a,{allowed:false,reasons:['SINGLE_WRITER_NOT_PROVEN','G1_NOT_VERIFIED']});assert.throws(cutoverAdmission(a),/CUTOVER_ADMISSION_BLOCKED/);
    writeCutoverAdmission(a,{allowed:true,reasons:[]});admit();
    writeFileSync(join(b,'cutover-admission.json'),readFileSync(join(a,'cutover-admission.json')));assert.throws(cutoverAdmission(b),/CUTOVER_ADMISSION_INVALID/);
    writeFileSync(join(a,'cutover-admission.json'),'{broken');assert.throws(admit,/CUTOVER_ADMISSION_INVALID/);
    writeCutoverAdmission(a,{allowed:false,reasons:['CUTOVER_CHECK_IN_PROGRESS']});assert.throws(admit,/CUTOVER_ADMISSION_BLOCKED/);
    unlinkSync(join(a,'cutover-admission.json'));assert.throws(admit,/CUTOVER_ADMISSION_MISSING/);
    assert.throws(cutoverAdmission(a),/CUTOVER_ADMISSION_MISSING/);assert.throws(()=>composeAppsRuntime(a,{connections:[]}),/CUTOVER_ADMISSION_MISSING/);
    assert.throws(()=>writeCutoverAdmission(a,{allowed:true,reasons:['UNRESOLVED_OPERATIONS']}),/CUTOVER_DECISION_INVALID/);
  }finally{
    const checked=resolve(root);assert.ok(checked.startsWith(resolve(tmpdir())+sep)&&checked.includes('dsh-cutover-admission-'));rmSync(checked,{recursive:true,force:true});
  }
});

test('freezing admits in-flight completion but cancels queued mutation before Provider dispatch',async()=>{
  const root=mkdtempSync(join(tmpdir(),'dsh-cutover-admission-')),store=new RuntimeStore(':memory:');
  const admit=cutoverAdmission(root),runtime=new AppsRuntime(store,{admit} as any),notes=new NotesProvider({store});
  let release!:()=>void,started!:()=>void,executions=0;const blocked=new Promise<void>(done=>release=done),firstStarted=new Promise<void>(done=>started=done);
  runtime.register({...notes,manifest:notes.manifest,descriptors:notes.descriptors,execute:async context=>{executions++;if(executions===1){started();await blocked;}return notes.execute(context);},dispose:()=>notes.dispose()});
  runtime.addConnection({appId:'notes',connectionId:'local',displayName:'Local fixture',config:{backend:'local-notes'},configRevision:1,enabled:true});runtime.bind({sessionId:'s',appId:'notes',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
  const request=(id:string)=>({protocolVersion:'1.0' as const,invocationId:id,traceId:id,appId:'notes',connectionId:'local',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{title:id,content:'preserve acknowledged result'},source:{kind:'agent' as const,sessionId:'s',nativeCallId:id},deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:id});
  try{
    const first=runtime.invoke(request('first'));await firstStarted;const second=runtime.invoke(request('second'));
    for(let index=0;index<100&&!store.operationByKey('notes','local','notes.notes.create','second');index++)await new Promise(done=>setTimeout(done,5));assert.ok(store.operationByKey('notes','local','notes.notes.create','second'));
    writeCutoverAdmission(root,{allowed:false,reasons:['ROLLBACK_FREEZE_REQUIRED']});release();assert.equal((await first).status,'ok');assert.equal((await second).status,'cancelled');assert.equal(executions,1);assert.equal(store.list<any>('operations').filter(row=>row.state==='succeeded').length,1);assert.equal(store.list<any>('operations').filter(row=>row.state==='cancelled').length,1);
  }finally{release();await runtime.dispose();store.close();const checked=resolve(root);assert.ok(checked.startsWith(resolve(tmpdir())+sep)&&checked.includes('dsh-cutover-admission-'));rmSync(checked,{recursive:true,force:true});}
});

test('actual cutover CLI fences an open HTTP entry and direct dispatch, rejects cold startup, then explicitly reopens',async()=>{
  const root=mkdtempSync(join(tmpdir(),'dsh-cutover-admission-')),directory=join(root,'runtime'),token='cutover-fixture-key-with-at-least-32-characters';
  const configuration={connections:[{appId:'notes',connectionId:'local',displayName:'Local fixture',config:{backend:'local-notes'},configRevision:1,enabled:true}]};
  const command=(mode:string,extra:string[])=>spawnSync(process.execPath,[fileURLToPath(new URL('../../scripts/apps-maintenance.mjs',import.meta.url)),'--directory',directory,'--mode',mode,...extra],{encoding:'utf8',windowsHide:true});
  let instance:ReturnType<typeof composeAppsRuntime>|undefined,server:ReturnType<typeof createAppsServer>|undefined;
  const stop=async()=>{if(server){server.closeAllConnections();await new Promise<void>((done,reject)=>server!.close(error=>error?reject(error):done()));server=undefined;}await instance?.close();instance=undefined;};
  const start=async()=>{instance=composeAppsRuntime(directory,configuration);server=createAppsServer({...instance,token});await new Promise<void>(done=>server!.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address==='object');return `http://127.0.0.1:${address.port}`;};
  const gates={G0:'VERIFIED',G1:'VERIFIED',G2:'VERIFIED',G3:'VERIFIED',G4:'VERIFIED'};
  try{
    let url=await start();instance!.runtime.bind({sessionId:'s',appId:'notes',connectionId:'local',enabled:true,boundAt:new Date().toISOString()});
    const evidence=join(root,'evidence.json');writeFileSync(evidence,JSON.stringify({oldWriterStopped:false,runtimeWriterCount:2,gateStates:gates,unresolvedOperationIds:[],migrationStatus:'migrated'}));
    const rejected=command('cutover',['--evidence',evidence]);assert.equal(rejected.status,2,rejected.stderr);assert.equal(JSON.parse(rejected.stdout).allowed,false);
    const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
    const listing=await fetch(url+'/v1/apps',{headers});assert.equal(listing.status,503);assert.equal((await listing.json()).error.code,'CUTOVER_ADMISSION_BLOCKED');
    const request={protocolVersion:'1.0' as const,invocationId:'blocked-note',traceId:'blocked-note',appId:'notes',connectionId:'local',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{title:'Must not dispatch',content:'blocked'},source:{kind:'agent' as const,sessionId:'s',nativeCallId:'cutover'},deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:'blocked-note'};
    const mutation=await fetch(url+'/v1/invocations',{method:'POST',headers,body:JSON.stringify(request)});assert.equal(mutation.status,503);
    const direct=await instance!.runtime.invoke(request);assert.equal(direct.status,'unavailable');assert.equal('error' in direct&&direct.error.code,'CUTOVER_ADMISSION_BLOCKED');assert.equal(instance!.store.list('operations').length,0);
    await stop();assert.throws(()=>composeAppsRuntime(directory,configuration),/CUTOVER_ADMISSION_BLOCKED/);assert.equal(readFileSync(join(directory,'cutover-admission.json'),'utf8').includes('SINGLE_WRITER_NOT_PROVEN'),true);
    writeFileSync(evidence,JSON.stringify({oldWriterStopped:true,runtimeWriterCount:1,gateStates:gates,unresolvedOperationIds:[],migrationStatus:'migrated'}));const accepted=command('cutover',['--evidence',evidence]);assert.equal(accepted.status,0,accepted.stderr);assert.equal(JSON.parse(accepted.stdout).allowed,true);
    url=await start();assert.equal((await fetch(url+'/v1/apps',{headers})).status,200);
    const baseline=join(root,'baseline.json');const baselineCommand=command('baseline',['--output',baseline]);assert.equal(baselineCommand.status,0,baselineCommand.stderr);
    const delayedBody=JSON.stringify({sessionId:'late',appId:'notes',connectionId:'local',enabled:true,boundAt:new Date().toISOString()}),received=new Promise<void>(done=>server!.once('request',()=>done()));
    let delayed!:ReturnType<typeof httpRequest>;const delayedResponse=new Promise<number>((done,reject)=>{delayed=httpRequest(url+'/v1/session-bindings',{method:'POST',headers:{...headers,'content-length':Buffer.byteLength(delayedBody)}},response=>{response.resume();response.once('end',()=>done(response.statusCode!));});delayed.once('error',reject);});delayed.write(delayedBody.slice(0,1));await received;
    const rollback=command('rollback',['--baseline',baseline,'--cutover-at',new Date().toISOString()]);assert.equal(rollback.status,0,rollback.stderr);assert.equal(JSON.parse(rollback.stdout).branch,'A');assert.equal((await fetch(url+'/v1/apps',{headers})).status,503);
    delayed.end(delayedBody.slice(1));assert.equal(await delayedResponse,503);assert.equal(instance!.runtime.sessionBindings('late').length,0);
    const inspect=await fetch(url+'/v1/operations/missing/inspect',{method:'POST',headers,body:'{}'});assert.equal(inspect.status,200);assert.equal((await inspect.json()).error.code,'OPERATION_NOT_FOUND');
    const broken=join(root,'broken.json');writeFileSync(broken,'{invalid');const aborted=command('cutover',['--evidence',broken]);assert.notEqual(aborted.status,0);assert.equal((await fetch(url+'/v1/apps',{headers})).status,503);
    const existingReport=join(root,'existing-report.json');writeFileSync(existingReport,'preserve prior report');const collision=command('cutover',['--evidence',evidence,'--output',existingReport]);assert.notEqual(collision.status,0);assert.equal(readFileSync(existingReport,'utf8'),'preserve prior report');assert.equal((await fetch(url+'/v1/apps',{headers})).status,503);
  }finally{
    await stop();const checked=resolve(root);assert.ok(checked.startsWith(resolve(tmpdir())+sep)&&checked.includes('dsh-cutover-admission-'));rmSync(checked,{recursive:true,force:true});
  }
});
