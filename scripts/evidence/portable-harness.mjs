import {createServer} from 'node:http';
import {createHash, randomUUID} from 'node:crypto';
import {appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, lstatSync, realpathSync, symlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join, resolve, dirname, relative, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

let HERE=dirname(fileURLToPath(import.meta.url));
const OWNER='synthetic-native-owner';
let ROOTS=existsSync(join(HERE,'frozen-roots.json'))?JSON.parse(readFileSync(join(HERE,'frozen-roots.json'),'utf8')):null;
const LOCK='/tmp/hallmark-c72-cpu.lock';
const quote=value=>"'"+String(value).replaceAll("'","'\"'\"'")+"'";
const wrapper=id=>`#!/bin/sh\nexec flock ${quote(LOCK)} ${quote(process.execPath)} --disable-warning=ExperimentalWarning ${quote(join(HERE,'harness.mjs'))} public ${quote(id)} \"$@\"\n`;
const sourceBytes=files=>hash(Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en'))));
const bytes=value=>Buffer.byteLength(typeof value==='string'?value:JSON.stringify(value),'utf8');
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const log=(path,value)=>appendFileSync(path,JSON.stringify(value)+'\n');
const load=(root,path)=>import(pathToFileURL(join(root,path)));
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const listen=server=>new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>done(server.address().port));});
const closeServer=server=>new Promise(done=>{server.closeAllConnections();server.close(()=>done());});
const state=store=>Object.fromEntries(store.collections.map(name=>[name,store.list(name)]));
const protectedState=store=>Object.fromEntries(store.collections.filter(name=>!['invocations','datasets','artifact_refs'].includes(name)).map(name=>[name,store.list(name)]));

// No business provider is registered. No credential/config files or environment tokens are read.
async function open(config,{seed=false,lose=false}={}) {
  const root=ROOTS[config.variant];
  const [{AppsRuntime,RuntimeStore},{NotesProvider},{AppsPresentationService},{SourceComponentStore},{createAppsServer},{AppsHost,HttpAppsHostTransport}]=await Promise.all([
    load(root,'packages/app-runtime/src/index.ts'),load(root,'packages/app-notes/src/index.ts'),load(root,'packages/app-presentation/src/index.ts'),load(root,'packages/source-components/src/index.ts'),load(root,'packages/service/src/apps-server.ts'),load(root,'packages/plugin-apps/src/index.ts')]);
  const store=new RuntimeStore(config.database),runtime=new AppsRuntime(store),providerCalls=[],http=[];
  const notes=new NotesProvider({store}),notesExecute=notes.execute.bind(notes),notesInspect=notes.inspect.bind(notes);
  notes.execute=async context=>{providerCalls.push({kind:'execute',capabilityId:context.request.capabilityId,invocationId:context.request.invocationId});return notesExecute(context);};
  notes.inspect=async(...args)=>{providerCalls.push({kind:'inspect',operationId:args[0]});return notesInspect(...args);};
  runtime.register(notes);
  const sources=new SourceComponentStore(join(config.assets,'archive'),join(config.assets,'workspaces'));
  const presentation=new AppsPresentationService({store,runtime,sources});
  const authoring=presentation.configureAuthoring();runtime.register(presentation.provider());
  if(seed){
    for(const [appId,connectionId] of [['notes','synthetic-notes'],['apps','presentation']]){
      runtime.addConnection({appId,connectionId,displayName:appId==='notes'?'Synthetic Notes':'Synthetic presentation',config:{},configRevision:1,enabled:true});
      runtime.bind({sessionId:OWNER,appId,connectionId,enabled:true,boundAt:'2026-10-10T00:00:00.000Z'});
    }
  }
  assert.deepEqual(runtime.listApps().map(app=>app.appId).sort(),['apps','notes']);
  const token=randomUUID(); // Ephemeral synthetic loopback bearer only; never persisted or shown.
  const backend=createAppsServer({runtime,presentation,token});
  const backendPort=await listen(backend);
  let loss=lose,closed=false;
  const proxy=createServer(async(req,res)=>{
    const start=performance.now();let body='';for await(const part of req)body+=part;
    const row={method:req.method,path:req.url,requestBytes:bytes(body),startedAt:new Date().toISOString()};http.push(row);
    try{
      const path=new URL(req.url,'http://127.0.0.1').pathname;
      if(loss&&(req.method==='GET'&&path.startsWith('/v1/invocations/')||path==='/v1/model-result')){row.drop='immediate-recovery-before-forward';req.socket.destroy();return;}
      if(req.method==='POST'&&['/v1/invocations','/v1/routed-invocations'].includes(path)){
        const request=JSON.parse(body),descriptor=runtime.describe(request.capabilityId,request.capabilityVersion);
        if(!seed&&descriptor?.effect!=='query'){
          const failure={invocationId:request.invocationId,traceId:request.traceId,status:'failed',error:{code:'EVALUATION_READ_ONLY',message:'This synthetic task permits read-only calls only.',retryPolicy:'never'}};
          const reply=path==='/v1/routed-invocations'?{result:failure,modelProjection:{content:JSON.stringify(failure)}}:failure;
          row.blockedMutation=true;row.responseBytes=bytes(reply);row.status=200;
          res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(reply));return;
        }
      }
      const response=await fetch(`http://127.0.0.1:${backendPort}${req.url}`,{method:req.method,headers:{Authorization:`Bearer ${token}`,...body?{'Content-Type':'application/json'}:{}},...body?{body}:{}});
      const output=await response.text();row.status=response.status;row.responseBytes=bytes(output);
      if(loss&&req.method==='POST'&&['/v1/invocations','/v1/routed-invocations'].includes(path)){row.drop='accepted-write-response';req.socket.destroy();return;}
      res.writeHead(response.status,{'Content-Type':'application/json'});res.end(output);
    }catch(error){row.error=error.message;if(!res.destroyed){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'SYNTHETIC_TRANSPORT_ERROR'}));}}
    finally{row.elapsedMs=performance.now()-start;}
  });
  const proxyPort=await listen(proxy),tools=new Map(),agent={id:OWNER};
  const transport=new HttpAppsHostTransport(`http://127.0.0.1:${proxyPort}`,token);
  const host=new AppsHost({agents:{get:id=>id===OWNER?agent:undefined},tools:{register:tool=>{tools.set(tool.name,tool);return()=>tools.delete(tool.name);}}},transport);
  try{await host.start();host.attachApp('apps');host.attachApp('notes');}
  catch(error){await host.dispose();await Promise.all([closeServer(proxy),closeServer(backend)]);await runtime.dispose();store.close();throw error;}
  return {store,runtime,authoring,providerCalls,http,ports:[backendPort,proxyPort],
    metadata:()=>Array.from(tools.values(),tool=>({name:tool.name,description:tool.description,inputSchema:tool.parameters,outputSchema:tool.output.schema,timeoutMs:tool.timeoutMs})),
    restore(){loss=false;},
    async call(name,args,step){
      const tool=tools.get(name);if(!tool)throw new Error('ONLY_REGISTERED_GATEWAY_TOOLS_ALLOWED');
      const start=performance.now(),httpStart=http.length,providerStart=providerCalls.length;
      const value=await tool.execute(args,{agent,signal:AbortSignal.timeout(95000),callId:`synthetic-native-call-${step}`});
      const blocks=tool.output.render(args,value),text=blocks.map(block=>block.text).join('');
      const model=JSON.parse(text),result=value?.result??value;
      return {text,raw:value,record:{tool:name,args,requestBytes:bytes(args),responseBytes:bytes(text),elapsedMs:performance.now()-start,
        receipt:{invocationId:result?.invocationId??null,traceId:result?.traceId??null,operationId:result?.operation?.operationId??null,status:result?.status??null},
        response:text,http:http.slice(httpStart),providerCalls:providerCalls.slice(providerStart)}};
    },
    async close(){if(closed)return;closed=true;await host.dispose();await Promise.all([closeServer(proxy),closeServer(backend)]);await runtime.dispose();store.close();assert.equal(tools.size,0);}
  };
}

export async function dispatch(config,command,toolName,argsText,{persist=true}={}) {
  const processStart=performance.now(),startedAt=new Date().toISOString();
  if(command!=='list-tools'&&command!=='call-tool')throw new Error('USAGE: list-tools OR call-tool TOOL_NAME JSON_OBJECT');
  if(command==='list-tools'&&(toolName!==undefined||argsText!==undefined))throw new Error('LIST_TOOLS_TAKES_NO_ARGUMENTS');
  if(command==='call-tool'&&(!toolName||argsText===undefined||bytes(argsText)>65536))throw new Error('CALL_TOOL_REQUIRES_NAME_AND_JSON_OBJECT');
  const args=command==='call-tool'?JSON.parse(argsText):null;
  if(command==='call-tool'&&(!args||typeof args!=='object'||Array.isArray(args)))throw new Error('TOOL_ARGUMENTS_MUST_BE_JSON_OBJECT');
  const history=persist&&existsSync(config.log)?readFileSync(config.log,'utf8').trim().split('\n').filter(Boolean):[],step=history.length+1;
  const sourceSnapshotSha256=verifyFrozenSource(config.variant);
  const f=await open(config),before=protectedState(f.store);let result,after,record,ports=f.ports;
  try{
    if(command==='list-tools'){
      const text=JSON.stringify({tools:f.metadata()});result={text};record={action:command,requestBytes:bytes({command}),responseBytes:bytes(text),response:text,elapsedMs:0,receipt:null,providerCalls:[],http:[]};
    }else{result=await f.call(toolName,args,step);record={action:command,...result.record};}
    after=protectedState(f.store);
    assert.deepEqual(after,before,'Read-only evaluation changed protected state');
  }finally{await f.close();}
  const entry={step,startedAt,actorScope:config.actorScope??'evaluation',sourceSnapshotSha256,cliArgumentBytes:argsText===undefined?0:bytes(argsText),...record,lifecycleElapsedMs:performance.now()-processStart,httpLifecycle:f.http,providerLifecycle:f.providerCalls,protectedStateUnchanged:true,loopbackPortsClosed:ports};
  if(persist)log(config.log,entry);
  return {...result,entry};
}

const boundary=`你在完成一个合成应用任务。仅可通过下方不透明 CLI 使用其 list-tools 和 call-tool 操作。不要读取入口脚本、源码、文件、数据库、日志或评测目录；不要调用其它网络/HTTP/工具接口绕过网关。不得修改、构建、重建、保存或再次提交写入。你可自由选择网关工具及调用顺序；先从公开工具元数据了解接口。遇到缺失信息或不可恢复的工具错误时，诚实说明具体阻塞，不猜测成功。所有输入输出均为合成数据，没有真实店铺。完成后在最终回答中给出结论和支持结论的回执身份；不要把 CLI 代理测试称作已部署的 DSH 模型测试。\n\nCLI 用法：\nENTRY list-tools\nENTRY call-tool TOOL_NAME 'JSON_OBJECT'\n\n`;
const caseTask={
 A:'已有一份组件创作草稿，attemptId 为 synthetic-authoring-attempt。请只读诊断当前阻塞阶段、requiresRebuild 的值，以及当前合法的下一步。不要真的执行下一步，不要写文件或重新 build。请给出用于诊断的回执身份。',
 B:'一次合成 Notes 写入已经执行，但写入响应和即时回查都丢失了。你只有原 invocationId：synthetic-lost-note-invocation。请只读找回该次原结果及其 traceId、operationId，并说明能够确认什么。严禁再次写入或用新的调用替代原写入。'
};

function freezeSource(sourceRoot,variant){
  const source=realpathSync(sourceRoot),target=join(HERE,'source-snapshots',variant);
  const git=(...args)=>execFileSync('git',['-C',source,...args],{encoding:'utf8',maxBuffer:16*1024*1024});
  const candidates=[...new Set((git('ls-files','-z')+git('ls-files','--others','--exclude-standard','-z')).split('\0').filter(Boolean))].sort();
  const files={},skipped=[];
  mkdirSync(target,{recursive:true});
  for(const name of candidates){
    if(name.split('/').some(part=>part==='node_modules'||part==='.git')){skipped.push(name);continue;}
    const input=resolve(source,name),rel=relative(source,input);
    if(rel.startsWith('..'+sep)||rel==='..')throw new Error('SOURCE_PATH_OUTSIDE_ROOT');
    if(!existsSync(input)){skipped.push(name);continue;}
    const real=realpathSync(input),actual=relative(source,real);
    if(actual.startsWith('..'+sep)||actual==='..')throw new Error('SOURCE_SYMLINK_OUTSIDE_ROOT: '+name);
    if(!lstatSync(real).isFile()){skipped.push(name);continue;}
    const output=join(target,name);mkdirSync(dirname(output),{recursive:true});copyFileSync(real,output);
    files[name]=hash(readFileSync(output));chmodSync(output,0o444);
  }
  const dependencies=existsSync(join(source,'node_modules'))?realpathSync(join(source,'node_modules')):null;
  if(dependencies)symlinkSync(dependencies,join(target,'node_modules'),'dir');
  return {originalRoot:source,frozenRoot:target,head:git('rev-parse','HEAD').trim(),gitStatus:git('status','--short'),fileCount:Object.keys(files).length,files,sourceSha256:sourceBytes(files),dependencies,dependenciesReadOnlyByConvention:true,skipped};
}
function verifyFrozenSource(variant){
  const identities=read(join(HERE,'frozen-source-identities.json')),identity=identities[variant];
  if(!identity||identity.frozenRoot!==ROOTS[variant])throw new Error('SOURCE_IDENTITY_MISSING');
  for(const [name,digest] of Object.entries(identity.files)){
    const path=join(identity.frozenRoot,name);
    if(!existsSync(path)||hash(readFileSync(path))!==digest)throw new Error('FROZEN_SOURCE_CHANGED: '+name);
  }
  return identity.sourceSha256;
}
async function prepare(output,baseline,patched){
  const selected=resolve(output);
  if(existsSync(selected))throw new Error('OUTPUT_ALREADY_EXISTS: choose a new output directory; histories are never reset');
  for(const root of [baseline,patched]){
    if(!existsSync(join(resolve(root),'packages/plugin-apps/src/index.ts')))throw new Error('INVALID_SOURCE_ROOT');
    const inside=relative(resolve(root),selected);
    if(inside===''||!inside.startsWith('..'+sep)&&inside!=='..')throw new Error('OUTPUT_MUST_BE_OUTSIDE_SOURCE_ROOTS');
  }
  mkdirSync(selected,{recursive:true});
  copyFileSync(fileURLToPath(import.meta.url),join(selected,'harness.mjs'));
  HERE=selected;
  const identities={baseline:freezeSource(resolve(baseline),'baseline'),patched:freezeSource(resolve(patched),'patched')};
  ROOTS=Object.fromEntries(Object.entries(identities).map(([variant,identity])=>[variant,identity.frozenRoot]));
  json(join(HERE,'frozen-source-identities.json'),identities);json(join(HERE,'frozen-roots.json'),ROOTS);

  if(existsSync(join(HERE,'admin-manifest.json')))throw new Error('ALREADY_PREPARED: use a new harness directory, do not reset evaluation history');
  const assets=join(HERE,'synthetic-assets'),seeds=join(HERE,'seeds');mkdirSync(seeds,{recursive:true});
  const fixtures={};
  for(const scenario of ['A','B']){
    const config={variant:'baseline',database:join(seeds,`${scenario}.db`),assets};
    const f=await open(config,{seed:true,lose:scenario==='B'});
    try{
      let result;
      if(scenario==='A')result=await f.call('apps_invoke',{appId:'apps',connectionId:'presentation',capabilityId:'apps.authoring.begin',capabilityVersion:'1.0.0',invocationId:'synthetic-authoring-begin',traceId:'synthetic-authoring-begin-trace',input:{mode:'new',title:'Synthetic component diagnostic',attemptId:'synthetic-authoring-attempt'}},0);
      else result=await f.call('apps_invoke',{appId:'notes',connectionId:'synthetic-notes',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',invocationId:'synthetic-lost-note-invocation',traceId:'synthetic-lost-note-trace',idempotencyKey:'synthetic-single-note-intent',input:{id:'synthetic-note-001',title:'Synthetic recovery note',content:'Synthetic accepted-once payload; no real business data.'}},0);
      const stored=state(f.store);
      if(scenario==='A'){assert.equal(result.raw.result.status,'ok');assert.equal(stored.authoring_attempts[0].attemptId,'synthetic-authoring-attempt');}
      else{assert.ok(['unavailable','failed'].includes(JSON.parse(result.text).status));assert.equal(stored.operations.length,1);assert.equal(stored.invocations.length,1);assert.equal(stored.invocations[0].result.status,'ok');assert.equal(f.providerCalls.filter(row=>row.kind==='execute').length,1);assert.ok(f.http.some(row=>row.drop==='accepted-write-response'));assert.ok(f.http.some(row=>row.drop==='immediate-recovery-before-forward'));}
      fixtures[scenario]={owner:OWNER,state:stored,stateSha256:hash(stored),setup:result.record,http:f.http,providerCalls:f.providerCalls};
    }finally{await f.close();}
    fixtures[scenario].databaseSha256=hash(readFileSync(config.database));
    json(join(seeds,`${scenario}.fixture.json`),fixtures[scenario]);
  }
  const gateways=[];
  for(const scenario of ['A','B'])for(const variant of ['baseline','patched']){
    const id=randomUUID().slice(0,8),directory=join(HERE,'gateways',id);mkdirSync(directory,{recursive:true});
    const config={id,scenario,variant,actorScope:'evaluation',database:join(directory,'state.db'),assets,log:join(directory,'trajectory.jsonl')};
    copyFileSync(join(seeds,`${scenario}.db`),config.database);
    const entry=join(directory,'gateway');
    writeFileSync(entry,wrapper(id));chmodSync(entry,0o755);
    const task=boundary.replaceAll('ENTRY',entry)+caseTask[scenario];
    writeFileSync(join(directory,'task.txt'),task+'\n');
    gateways.push({...config,entry,taskFile:join(directory,'task.txt'),seedSha256:hash(readFileSync(config.database)),taskBodySha256:hash(boundary+caseTask[scenario])});
  }
  json(join(HERE,'admin-manifest.json'),{scope:'NATIVE_AGENT_BLIND_CLI_PROXY_NOT_DSH_MODEL',owner:OWNER,roots:ROOTS,seedState:fixtures,gateways,createdAt:new Date().toISOString()});
  for(const config of gateways){const f=await open(config);try{json(join(dirname(config.entry),'tool-metadata.json'),f.metadata());assert.equal(hash(state(f.store)),fixtures[config.scenario].stateSha256);}finally{await f.close();}}
  console.log(JSON.stringify({prepared:true,gateways:gateways.map(({scenario,variant,entry,taskFile})=>({scenario,variant,entry,taskFile}))},null,2));
}

async function smoke(){
  const manifest=read(join(HERE,'admin-manifest.json')),dir=join(HERE,'smoke',randomUUID());mkdirSync(dir,{recursive:true});
  const results=[];
  for(const actual of manifest.gateways){
    const directory=join(dir,`${actual.scenario}-${actual.variant}-${randomUUID().slice(0,8)}`);mkdirSync(directory);
    const config={...actual,actorScope:'deterministic-smoke',database:join(directory,'state.db'),log:join(directory,'trajectory.jsonl')};copyFileSync(join(HERE,'seeds',`${actual.scenario}.db`),config.database);
    const meta=await dispatch(config,'list-tools');assert.equal(JSON.parse(meta.text).tools.length,4);
    let result;
    if(config.scenario==='A'){
      const described=await dispatch(config,'call-tool','apps_describe',JSON.stringify({capabilityId:'apps.authoring.inspect',version:'1.0.0'})),model=JSON.parse(described.text);
      if(config.variant==='baseline')assert.equal(model.error.code,'RESULT_SPILL_FAILED');else assert.ok(model.descriptor.inputSchema);
      // This is a deterministic known-input transport smoke, not an agent outcome.
      result=await dispatch(config,'call-tool','apps_invoke',JSON.stringify({appId:'apps',connectionId:'presentation',capabilityId:'apps.authoring.inspect',capabilityVersion:'1.0.0',input:{attemptId:'synthetic-authoring-attempt'}}));
      assert.equal(JSON.parse(result.text).status,'ok');assert.equal(typeof JSON.parse(result.text).data.summary.requiresRebuild,'boolean');
    }else{
      const f=await open(config);let before;try{before=state(f.store);}finally{await f.close();}
      result=await dispatch(config,'call-tool','apps_inspect',JSON.stringify({invocationId:'synthetic-lost-note-invocation'}));
      const model=JSON.parse(result.text);
      if(config.variant==='baseline')assert.equal(model.error.code,'INVALID_INPUT');
      else{assert.equal(model.status,'ok');assert.equal(model.invocationId,'synthetic-lost-note-invocation');assert.equal(model.traceId,'synthetic-lost-note-trace');assert.equal(model.operation.operationId,before.operations[0].operationId);assert.equal(model.data.note.id,'synthetic-note-001');assert.equal(model.data.note.revision,'1');}
      const after=await open(config);try{assert.deepEqual(state(after.store),before);}finally{await after.close();}
    }
    const blocked=await dispatch(config,'call-tool','apps_invoke',JSON.stringify({appId:'notes',connectionId:'synthetic-notes',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',idempotencyKey:'must-not-write',input:{title:'Forbidden test',content:'Must not reach provider'}}));
    assert.equal(JSON.parse(blocked.text).error.code,'EVALUATION_READ_ONLY');assert.equal(blocked.entry.providerCalls.length,0);
    await assert.rejects(()=>dispatch(config,'read-file','/etc/passwd'),/USAGE/);
    results.push({scenario:config.scenario,variant:config.variant,pass:true,result:JSON.parse(result.text),trajectory:config.log});
  }
  const report={scope:'DETERMINISTIC_TRANSPORT_SMOKE_ONLY_NOT_AGENT_EVALUATION',externalModel:false,externalBusiness:false,pass:true,cases:results};json(join(dir,'smoke-report.json'),report);console.log(JSON.stringify(report,null,2));
}

async function main(){
  const [mode,...args]=process.argv.slice(2);
  if(mode==='prepare'&&args.length===3)return prepare(...args);
  if(mode!=='prepare'&&!ROOTS)throw new Error('NOT_PREPARED: use prepare OUT BASELINE_ROOT PATCHED_ROOT');
  if(mode==='smoke'&&args.length===0)return smoke();
  if(mode==='public'){
    const [id,command,name,argsText,...extra]=args;
    if(extra.length)throw new Error('EXTRA_ARGUMENTS_FORBIDDEN');
    const manifest=read(join(HERE,'admin-manifest.json'));
    const config=[...manifest.gateways,...(manifest.cliSmokeGateways??[])].find(row=>row.id===id);
    if(!config)throw new Error('UNKNOWN_GATEWAY');
    const result=await dispatch(config,command,name,argsText);process.stdout.write(result.text+'\n');return;
  }
  if(mode==='summary'&&args.length===0){
    const manifest=read(join(HERE,'admin-manifest.json'));
    const summaries=manifest.gateways.map(config=>{
      const entries=existsSync(config.log)?readFileSync(config.log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
      const calls=entries.filter(row=>row.action==='call-tool');
      return {id:config.id,scenario:config.scenario,variant:config.variant,steps:entries.length,toolCalls:calls.length,metadataCalls:entries.length-calls.length,requestBytes:entries.reduce((s,e)=>s+e.requestBytes,0),responseBytes:entries.reduce((s,e)=>s+e.responseBytes,0),gatewayResponseBytes:calls.reduce((s,e)=>s+e.responseBytes,0),metadataResponseBytes:entries.filter(e=>e.action==='list-tools').reduce((s,e)=>s+e.responseBytes,0),toolElapsedMs:calls.reduce((s,e)=>s+e.elapsedMs,0),lifecycleElapsedMs:entries.reduce((s,e)=>s+e.lifecycleElapsedMs,0),httpCalls:entries.reduce((s,e)=>s+e.httpLifecycle.length,0),providerExecuteCalls:entries.reduce((s,e)=>s+e.providerLifecycle.filter(r=>r.kind==='execute').length,0),blockedMutationAttempts:entries.reduce((s,e)=>s+e.httpLifecycle.filter(r=>r.blockedMutation).length,0),allProtectedStateUnchanged:entries.every(e=>e.protectedStateUnchanged),receipts:calls.map(e=>e.receipt),log:config.log};
    });
    console.log(JSON.stringify({scope:'CLI_GATEWAY_TRAJECTORY_METRICS_NOT_MODEL_TOKENS',summaries},null,2));return;
  }
  throw new Error('ADMIN_USAGE: prepare OUT BASELINE_ROOT PATCHED_ROOT | smoke | summary');
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({error:error.message}));process.exitCode=1;});
