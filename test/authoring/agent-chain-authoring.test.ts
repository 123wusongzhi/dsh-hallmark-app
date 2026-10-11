import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,existsSync,linkSync,mkdtempSync,mkdirSync,readFileSync,rmdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../packages/app-presentation/src/authoring.ts';
import {RuntimeStore} from '../../packages/app-runtime/src/store.ts';
import {SourceComponentStore,inspectSourceProject} from '../../packages/source-components/src/index.ts';
import {authoringInstructions} from '../../packages/plugin-apps/src/authoring-guidance.ts';
// @ts-expect-error Standalone CLI exports the actual request preparation used by this regression.
import {prepareAuthoringCheck} from '../../scripts/apps-authoring-check.mjs';
import type {CapabilityDescriptor,DatasetBinding} from '../../packages/app-contracts/src/index.ts';

const session='authoring-chain-regression';
const descriptor:CapabilityDescriptor={capabilityId:'notes.list',version:'1.0.0',title:'Fixture',description:'Fixture',effect:'query',inputSchema:{type:'object'},outputSchema:{type:'object'},execution:{mode:'sync',timeoutMs:1000,concurrency:'declared_safe',lockScope:'connection',idempotency:'not_applicable',completionEvidence:'response'},discovery:{defaultVisible:false,keywords:[]},aliases:[]};
const binding:DatasetBinding={bindingId:'notes',appId:'notes',connectionId:'fixture',capabilityId:'notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
function setup(t:{after:(fn:()=>void)=>void}){
 const directory=mkdtempSync(join(tmpdir(),'agent-authoring-chain-')),store=new RuntimeStore(':memory:'),sources=new SourceComponentStore(join(directory,'archive'));
 t.after(()=>{store.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+'\\agent-authoring-chain-')||resolve(directory).startsWith(resolve(tmpdir())+'/agent-authoring-chain-'));rmSync(directory,{recursive:true,force:true});});
 const runtime={describe:()=>descriptor,invoke:async()=>({status:'ok' as const,invocationId:'fixture',traceId:'fixture',data:{}})};
 const presentation=new AppsPresentationService({store,sources,runtime}),cancelled:{attemptId:string;epoch:number}[]=[];
 const authoring=new AppsAuthoringService({store,sources,presentation,onCancel:(attemptId,epoch)=>cancelled.push({attemptId,epoch})});
 return {directory,store,sources,presentation,authoring,cancelled};
}
function state(f:ReturnType<typeof setup>){return {views:f.store.list('views'),drafts:f.store.list('authoring_drafts'),attempts:f.store.list('authoring_attempts'),publications:f.store.list('view_publications')};}

test('capture and saved checkout retain the editable preview plan while excluding generated evidence',t=>{
 const f=setup(t),project=join(f.directory,'project');mkdirSync(join(project,'dist'),{recursive:true});mkdirSync(join(project,'.preview'));
 writeFileSync(join(project,'dist','index.html'),'<main>saved source</main>');
 const plan=JSON.stringify({requiredMethods:['getData'],assertions:[{id:'content',type:'text',selector:'main',expected:'saved source'}]});
 writeFileSync(join(project,'.preview','plan.json'),plan);writeFileSync(join(project,'.preview','latest.png'),'generated screenshot');writeFileSync(join(project,'.preview','temporary.json'),'generated diagnostics');
 const captured=f.sources.capture(project),files=f.sources.manifest(captured.source.buildId)!.projectFiles;
 assert.ok(files.includes('.preview/plan.json'));assert.deepEqual(files.filter(file=>file.startsWith('.preview/')),['.preview/plan.json']);
 const restored=f.sources.checkout(captured.source);assert.equal(readFileSync(join(restored.directory,'.preview','plan.json'),'utf8'),plan);
 writeFileSync(join(project,'.preview','temporary.json'),'different diagnostics');assert.equal(inspectSourceProject(project).buildId,captured.source.buildId);
 writeFileSync(join(project,'.preview','plan.json'),plan+'\n');assert.notEqual(inspectSourceProject(project).buildId,captured.source.buildId);
 assert.equal(f.sources.verify(captured.source.buildId).valid,true);
});

test('pre-plan source archives remain verifiable and editable without rewriting their manifest',t=>{
 const f=setup(t),project=join(f.directory,'legacy');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<main>old archive</main>');
 const captured=f.sources.capture(project),manifestPath=join(f.sources.directory,'builds',captured.source.buildId,'manifest.json'),legacy=f.sources.manifest(captured.source.buildId)!;
 delete legacy.manifestVersion;delete legacy.fileManifest;writeFileSync(manifestPath,JSON.stringify(legacy));const before=readFileSync(manifestPath,'utf8');
 assert.equal(f.sources.verify(captured.source.buildId).valid,true);const reopened=f.sources.checkout(captured.source);
 assert.equal(existsSync(join(reopened.directory,'.preview','plan.json')),false);assert.equal(readFileSync(manifestPath,'utf8'),before);
});

test('title-only edit applies its title and idempotent resume does not supersede twice',t=>{
 const f=setup(t),first=f.authoring.begin(session,{mode:'new',title:'Before'}),input={mode:'edit' as const,viewId:first.view.viewId,title:'After',attemptId:'title-edit'};
 const next=f.authoring.begin(session,input);assert.equal(next.view.title,'After');assert.equal(f.presentation.ownedView(session,first.view.viewId).title,'After');
 assert.equal(next.attempt.epoch,2);assert.deepEqual(f.cancelled,[{attemptId:first.attempt.attemptId,epoch:1}]);
 assert.deepEqual(f.authoring.begin(session,input),next);assert.equal(f.cancelled.length,1);
});

test('workspace conflicts preserve title, bindings, context, attempts and cancellation signals',t=>{
 const f=setup(t),first=f.authoring.begin(session,{mode:'new',title:'Before',bindings:[binding],context:{storeId:'Bill'}}),before=state(f);
 assert.throws(()=>f.authoring.begin(session,{mode:'edit',viewId:first.view.viewId,title:'Should not apply',bindings:[],context:{storeId:'Helen'},workspacePath:join(f.directory,'wrong-workspace')}),{code:'WORKSPACE_CONFLICT'});
 assert.deepEqual(state(f),before);assert.deepEqual(f.cancelled,[]);
});

test('missing edit workspaces and late transaction failures leave existing authoring state untouched',t=>{
 const f=setup(t),first=f.authoring.begin(session,{mode:'new',title:'Before'});rmdirSync(first.draft.workspacePath);const before=state(f);
 assert.throws(()=>f.authoring.begin(session,{mode:'edit',viewId:first.view.viewId,title:'Should not apply',context:{storeId:'Helen'}}),{code:'WORKSPACE_NOT_FOUND'});
 assert.deepEqual(state(f),before);assert.deepEqual(f.cancelled,[]);
 mkdirSync(first.draft.workspacePath);const originalPut=f.store.put.bind(f.store);f.store.put=(collection,id,value)=>{if(collection==='authoring_attempts'&&id==='transaction-failure')throw new Error('Injected commit failure');return originalPut(collection,id,value);};
 assert.throws(()=>f.authoring.begin(session,{mode:'edit',viewId:first.view.viewId,title:'Uncommitted',context:{storeId:'Helen'},attemptId:'transaction-failure'}),/Injected commit failure/);
 assert.deepEqual(state(f),before);assert.deepEqual(f.cancelled,[]);
});

for(const mode of ['custom-default','custom-explicit','legacy-standard','legacy-internals','multiple-node-fallback'] as const)test(`Windows wrapper preserves the build command (${mode})`,{skip:process.platform!=='win32'},t=>{
 const f=setup(t),scripts=join(f.directory,'runner with spaces');mkdirSync(scripts);
 copyFileSync(resolve('scripts/apps-authoring-check.ps1'),join(scripts,'apps-authoring-check.ps1'));
 // A tiny executable check-runner fixture exercises the real PowerShell launch boundary and actual custom build argv.
 writeFileSync(join(scripts,'apps-authoring-check.mjs'),"import{readFileSync}from'node:fs';import{spawnSync}from'node:child_process';const r=JSON.parse(readFileSync(process.argv[2],'utf8'));const b=spawnSync(r.build.command[0],r.build.command.slice(1),{encoding:'utf8'});console.log(JSON.stringify({executable:process.execPath,runnerArgs:process.execArgv,buildCommand:r.build.command,buildStdout:b.stdout.trim()}));process.exitCode=b.status;");
 writeFileSync(join(scripts,'build.mjs'),"process.stdout.write('custom build executed')");
 const nodes=[join(f.directory,'node-first'),join(f.directory,'node-second')];
 if(mode==='multiple-node-fallback')for(const directory of nodes){mkdirSync(directory);try{linkSync(process.execPath,join(directory,'node.exe'));}catch{copyFileSync(process.execPath,join(directory,'node.exe'));}}
 const command=mode==='legacy-standard'?[process.execPath,'--no-warnings',join(scripts,'build.mjs')]:mode==='legacy-internals'?[process.execPath,'--expose-internals',join(scripts,'build.mjs')]:mode==='multiple-node-fallback'?[join(process.env.SystemRoot??'C:/Windows','System32/cmd.exe'),'/d','/c','echo custom build executed']:[process.execPath,'--eval',"process.stdout.write('custom build executed')"],request={...(mode==='custom-explicit'?{launcher:{executable:process.execPath,nodeArgs:['--no-warnings']}}:{}),build:{command,evidenceRoot:join(f.directory,'evidence')}},requestPath=join(f.directory,'custom request.json');writeFileSync(requestPath,JSON.stringify(request));
 const run=spawnSync('pwsh',['-NoProfile','-File',join(scripts,'apps-authoring-check.ps1'),requestPath],{encoding:'utf8',timeout:15000,...(mode==='multiple-node-fallback'?{env:{...process.env,PATH:[...nodes,process.env.PATH].join(';')}}:{})});
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr);const result=JSON.parse(run.stdout).result;
 assert.deepEqual(result.buildCommand,command);assert.equal(result.buildStdout,'custom build executed');assert.deepEqual(result.runnerArgs,mode==='legacy-internals'?['--expose-internals']:mode==='legacy-standard'||mode==='custom-explicit'?['--no-warnings']:[]);
 if(mode==='multiple-node-fallback')assert.equal(result.executable.toLowerCase(),join(nodes[0],'node.exe').toLowerCase());
});

test('prepared check requests preserve independent runner runtime and unchanged build command',async t=>{
 const f=setup(t),first=f.authoring.begin(session,{mode:'new'}),keyFile=join(f.directory,'fixture-key');writeFileSync(keyFile,'fixture-only');
 const server=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(first));});await new Promise<void>(accept=>server.listen(0,'127.0.0.1',accept));t.after(()=>server.close());
 const address=server.address() as {port:number},launcher={executable:process.execPath,nodeArgs:['--no-warnings']},command=[process.execPath,'--eval',"console.log('valid build')"];
 const prepared=await prepareAuthoringCheck({prepare:true,launcher,build:{sessionId:session,attemptId:first.attempt.attemptId,command,evidenceRoot:join(f.directory,'evidence'),runtime:{url:`http://127.0.0.1:${address.port}`,keyFile}}});
 const request=JSON.parse(readFileSync(prepared.requestPath,'utf8'));assert.deepEqual(request.launcher,launcher);assert.deepEqual(request.build.command,command);
 const guidance=authoringInstructions({cliPath:null,nodeExecutable:process.execPath,nodeArgs:['--no-warnings'],nodeEnvironment:{},starterPath:'source-starter/create-apps-source.mjs',sdkDirectory:'sdk',buildRunnerPath:'apps-authoring-build.js',previewRunnerPath:'apps-authoring-preview.js',runtime:{url:'http://127.0.0.1:1',keyFile,archiveRoot:'archive',evidenceRoot:'evidence'}},session);
 assert.deepEqual((guidance.checkRunner.prepareRequest as unknown as {launcher:unknown}).launcher,launcher);
});
