import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdtempSync,mkdirSync,readFileSync,readlinkSync,readdirSync,renameSync,rmdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {canonicalJson} from '../../packages/app-contracts/src/index.ts';
import {RuntimeStore,RUNTIME_COLLECTIONS} from '../../packages/app-runtime/src/store.ts';
import {RuntimeWriterLease} from '../../packages/app-runtime/src/lease.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner,evidenceFile,sourceInputDigest} from '../../packages/source-components/src/authoring-evidence.ts';
import {EvidencePathResolver} from '../../packages/source-components/src/evidence-relocation.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {backupRuntime,runtimeBackupDryRun,verifyRuntimeBackup,restoreRuntimeBackup} from '../../packages/app-migration/src/runtime-backup.ts';
import type {EvidenceRelocation} from '../../packages/app-migration/src/runtime-backup.ts';

const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function tree(root:string,skipPath?:string):Record<string,string> {
  const out:Record<string,string>={};function walk(path:string){for(const name of readdirSync(path,{withFileTypes:true})){const full=join(path,name.name);if(full===skipPath)continue;if(name.isDirectory())walk(full);else out[full.slice(root.length+1)]=sha(readFileSync(full));}}walk(root);return out;
}
function npmAt(directory:string,mode:'ci'|'install'){
  const args=[mode,'--offline','--ignore-scripts','--no-audit','--no-fund'],npmCli=join(dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
  return existsSync(npmCli)?spawnSync(process.execPath,[npmCli,...args],{cwd:directory,encoding:'utf8',windowsHide:true}):spawnSync('npm',args,{cwd:directory,encoding:'utf8',windowsHide:true,shell:process.platform==='win32'});
}
async function fixture(options:{internalWorkspace?:boolean;linkedSdk?:boolean}={}){
  const root=mkdtempSync(join(tmpdir(),'apps-full-backup-test-')),source=join(root,'runtime'),workspace=options.internalWorkspace?join(source,'component-workspace','draft'):join(root,'external-draft'),backup=join(root,'backup'),target=join(root,'restored');
  mkdirSync(source);mkdirSync(workspace,{recursive:true});mkdirSync(join(workspace,'empty-directory'));
  const sdk=join(root,'outside-sdk');if(options.linkedSdk){mkdirSync(sdk);writeFileSync(join(sdk,'package.json'),JSON.stringify({name:'@dsh/apps-component-runtime',version:'1.0.0',type:'module',exports:'./index.js'}));writeFileSync(join(sdk,'index.js'),"export const marker='fixture SDK';");}
  writeFileSync(join(workspace,'package.json'),JSON.stringify({name:'offline-fixture',version:'1.0.0',private:true,...(options.linkedSdk?{dependencies:{'@dsh/apps-component-runtime':'file:'+sdk}}:{})}));
  writeFileSync(join(workspace,'package-lock.json'),JSON.stringify({lockfileVersion:3,name:'offline-fixture',version:'1.0.0',packages:{'':{name:'offline-fixture',version:'1.0.0'}}}));
  if(options.linkedSdk){const install=npmAt(workspace,'install');assert.equal(install.status,0,install.stderr);assert.equal(lstatSync(join(workspace,'node_modules','@dsh','apps-component-runtime')).isSymbolicLink(),true);}
  writeFileSync(join(workspace,'source.html'),'<main>old build</main>');
  writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('source.html','dist/index.html');console.log('fixture built');");
  const sources=new SourceComponentStore(join(source,'source-components')),runner=new AuthoringEvidenceRunner(join(source,'authoring-evidence'));
  const first=await runner.build({attemptId:'first',epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});assert.equal(first.report.verdict,'PASS');
  writeFileSync(join(workspace,'source.html'),'<main>current build</main>');
  const current=await runner.build({attemptId:'current',epoch:2,sourceRevision:2,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});assert.equal(current.report.verdict,'PASS');
  const screenshotPath=join(runner.root,'viewport-420.png');writeFileSync(screenshotPath,Buffer.from('fixture screenshot bytes, no browser claim'));
  const screenshot=evidenceFile(screenshotPath),preview={schemaVersion:1,runnerVersion:'fixture-backup-only',buildId:current.report.archiveBuildId,viewportResults:[{contentWidthCssPx:420,screenshot}],assertionResults:[{evidenceRefs:[screenshot]}],verdict:'fixture'};
  const previewRef=runner.writeReport('preview',preview),store=new RuntimeStore(join(source,'apps.db'));
  // Populate every collection, including immutable receipts, UI state and an unresolved operation.
  for(const table of RUNTIME_COLLECTIONS)store.put(table,`${table}:retained`,table==='operations'?{operationId:'operations:retained',appId:'notes',connectionId:'fixture',capabilityId:'notes.create',idempotencyKey:'retain',state:'queued'}:{fixture:'preserve exact JSON',table});
  store.put('builds',first.report.archiveBuildId!,sources.manifest(first.report.archiveBuildId!));store.put('builds',current.report.archiveBuildId!,sources.manifest(current.report.archiveBuildId!));
  store.put('datasets','dataset:v1:fixture',{datasetId:'dataset:v1:fixture',payload:{rows:[{value:1}]},status:'ready'});
  const timestamp=new Date().toISOString();
  store.put('views','view',{viewId:'view',title:'Restorable source',design:{},bindings:[],createdAt:timestamp,updatedAt:timestamp,ownerSessionId:'original-desktop-session',viewRevision:3,activeBuildId:current.report.archiveBuildId,lastGoodBuildId:current.report.archiveBuildId,previousGoodBuildId:first.report.archiveBuildId,source:{buildId:current.report.archiveBuildId,directory:workspace,entry:'index.html',files:['index.html']}});
  store.put('authoring_drafts','draft',{schemaVersion:1,draftId:'draft',ownerSessionId:'original-desktop-session',viewId:'view',workspacePath:workspace,sourceRevision:2,epoch:2,status:'editing',createdAt:timestamp,updatedAt:timestamp});
  store.put('authoring_attempts','attempt',{attemptId:'attempt',draftId:'draft',epoch:2,sourceRevision:2,state:'editing',startedAt:timestamp,expectedViewRevision:3,invocationRefs:[],evidenceRefs:[current.reportRef,previewRef],terminalReason:null,buildReceiptId:'receipt',previewReceiptId:'preview'});
  store.put('build_receipts','receipt',{receiptId:'receipt',...current.report});store.put('preview_receipts','preview',{receiptId:'preview',...preview});
  store.put('view_ui_states','ui-state',{sessionId:'original-desktop-session',viewId:'view',sourceBuildId:current.report.archiveBuildId,stateRevision:7,value:{keyword:'retain filter',counter:4}});
  store.put('component_contexts','snapshot:historical',{snapshotId:'historical',buildId:first.report.archiveBuildId,datasetId:'dataset:v1:fixture',selection:{selected:['row-1']}});
  store.put('artifact_refs','evidence',{ownerKind:'build_receipt',ownerId:'receipt',targetKind:'file',targetId:current.reportRef.sha256,file:current.reportRef});
  store.put('artifact_refs','historical-build',{ownerKind:'context',ownerId:'historical',targetKind:'build',targetId:first.report.archiveBuildId});
  store.close();
  return {root,source,workspace,backup,target,sources,runner,first,current,previewRef,screenshot,options:{sourceDirectory:source,backupDirectory:backup,offlineConfirmed:true},cleanup(){assert.ok(resolve(root).startsWith(resolve(tmpdir())));rmSync(root,{recursive:true,force:true});}};
}
function mappedFile(rows:EvidenceRelocation[],path:string):string {
  const row=rows.find(row=>row.kind==='file'&&row.originalPath===path);assert.ok(row,`exact immutable file mapping: ${path}`);
  assert.equal(sha(readFileSync(row.manifestPath)),row.manifestSha256);assert.equal(sha(readFileSync(row.relocatedPath)),row.sha256);assert.equal(readFileSync(row.relocatedPath).length,row.bytes);return row.relocatedPath;
}

function previewFixtureInputs(f:Awaited<ReturnType<typeof fixture>>){
  // Signed fixture reports exercise backup classification only; they make no browser claim.
  const attemptId=f.current.report.attemptId,buildReceiptId='fixture-build',previewReceiptId='fixture-preview';
  const report={schemaVersion:1,attemptId,epoch:f.current.report.epoch,buildReceiptId,buildId:f.current.report.archiveBuildId,protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'dsh-authoring-preview/1',verdict:'PASS'};
  const reportRef=f.runner.writeReport('preview',report),data={viewId:'preview',bindings:[{bindingId:'rows',appId:'notes',connectionId:'fixture',datasetId:'local-preview-label',revision:'1',payload:{rows:[{value:1}]}}]};
  const request={attemptId,epoch:f.current.report.epoch,buildReceiptId,buildReportRef:f.current.reportRef,mode:'fixture',evidenceRoot:f.runner.root,archiveRoot:f.sources.directory,data};
  const requestPath=join(f.runner.root,'arbitrary-input-name.json'),fixturePath=join(f.runner.root,'arbitrary-data-name.json');
  writeFileSync(requestPath,JSON.stringify(request));writeFileSync(fixturePath,JSON.stringify(data));
  const store=new RuntimeStore(join(f.source,'apps.db'));try{
    store.put('build_receipts',buildReceiptId,{receiptId:buildReceiptId,...f.current.report});
    store.put('preview_receipts',previewReceiptId,{receiptId:previewReceiptId,...report});
    store.put('authoring_attempts',attemptId,{attemptId,epoch:f.current.report.epoch,buildReceiptId,previewReceiptId,evidenceRefs:[f.current.reportRef,reportRef]});
  }finally{store.close();}
  return {requestPath,fixturePath,request,data,report,reportRef};
}

test('witnessed unsigned preview input and identical standalone fixture retain exact bytes without promoting local labels to Runtime references',async()=>{
  const f=await fixture();try{
    const input=previewFixtureInputs(f),before=tree(f.source),manifest=await backupRuntime(f.options);
    assert.equal(manifest.references.some(ref=>ref.kind==='dataset'&&ref.targetId==='local-preview-label'),false);
    assert.ok(manifest.references.some(ref=>ref.kind==='dataset'&&ref.targetId==='dataset:v1:fixture'));
    assert.deepEqual(tree(f.source),before);verifyRuntimeBackup(f.backup);restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});
    for(const path of [input.requestPath,input.fixturePath,input.reportRef.path])assert.deepEqual(readFileSync(join(f.target,'authoring-evidence',path.slice(f.runner.root.length+1))),readFileSync(path));
  }finally{f.cleanup();}
});

test('fixture-shaped files without matching execution evidence and fixture labels in persistent DB remain strict references',async()=>{
  const f=await fixture();try{
    const input=previewFixtureInputs(f),original=readFileSync(input.requestPath);
    writeFileSync(input.requestPath,JSON.stringify({...input.request,attemptId:'forged-attempt'}));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: local-preview-label/);assert.equal(existsSync(f.backup),false);
    writeFileSync(input.requestPath,original);
    writeFileSync(input.requestPath,JSON.stringify({...input.request,data:{viewId:'preview',bindings:[{datasetId:'local-preview-label'}]}}));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: local-preview-label/);writeFileSync(input.requestPath,original);
    const standalone=readFileSync(input.fixturePath);writeFileSync(input.fixturePath,JSON.stringify({...input.data,viewId:'not-the-request-data'}));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: local-preview-label/);writeFileSync(input.fixturePath,standalone);
    const store=new RuntimeStore(join(f.source,'apps.db'));try{store.put('views','forged-fixture',{mode:'fixture',data:input.data});}finally{store.close();}
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: local-preview-label/);assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});

test('all namespaced dataset IDs and nested or typed references remain strict even within witnessed preview input',async()=>{
  const f=await fixture();try{
    const input=previewFixtureInputs(f);
    for(const datasetId of ['dataset:v1:missing','result:missing','future:missing']){
      const data={...input.data,bindings:[{...input.data.bindings[0],datasetId}]};
      writeFileSync(input.requestPath,JSON.stringify({...input.request,data}));writeFileSync(input.fixturePath,JSON.stringify(data));
      assert.throws(()=>runtimeBackupDryRun(f.options),new RegExp('BACKUP_DATASET_REFERENCE_MISSING: '+datasetId));
    }
    const data={...input.data,bindings:[{...input.data.bindings[0],payload:{datasetId:'missing-nested-reference'}}]};
    writeFileSync(input.requestPath,JSON.stringify({...input.request,data}));writeFileSync(input.fixturePath,JSON.stringify(data));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: missing-nested-reference/);
    writeFileSync(input.requestPath,JSON.stringify(input.request));writeFileSync(input.fixturePath,JSON.stringify(input.data));
    const store=new RuntimeStore(join(f.source,'apps.db'));try{store.put('artifact_refs','forged-dataset',{targetKind:'dataset',targetId:'local-preview-label'});}finally{store.close();}
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: local-preview-label/);assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});

test('JSON field names containing dots and brackets cannot collide with a fixture binding authorization',async()=>{
  const f=await fixture();try{
    const input=previewFixtureInputs(f);
    writeFileSync(input.requestPath,JSON.stringify({...input.request,'data.bindings[0]':{datasetId:'path-collision-reference'}}));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: path-collision-reference/);assert.equal(existsSync(f.backup),false);
    const data={...input.data,'bindings[0]':{datasetId:'standalone-collision-reference'}};
    writeFileSync(input.requestPath,JSON.stringify({...input.request,data}));writeFileSync(input.fixturePath,JSON.stringify(data));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: standalone-collision-reference/);assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});

test('signed preview reports and invalid attestation cannot disguise missing Runtime datasets as fixture input',async()=>{
  const f=await fixture();try{
    const input=previewFixtureInputs(f),original=readFileSync(input.reportRef.path);
    const invalid=JSON.parse(original.toString('utf8'));invalid.signature='0'.repeat(64);writeFileSync(input.reportRef.path,JSON.stringify(invalid));
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_REFERENCE_HASH_MISMATCH/);writeFileSync(input.reportRef.path,original);
    f.runner.writeReport('preview',{...input.report,data:input.data});
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DATASET_REFERENCE_MISSING: local-preview-label/);assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});

test('schema4 full offline backup and new-root restore preserve all25 collections, external draft, history and immutable attestation',async()=>{
  const f=await fixture();try {
    const originalTree=tree(f.source),workspaceTree=tree(f.workspace),originalKey=readFileSync(join(f.runner.root,'.runner-key'));
    const dry=runtimeBackupDryRun(f.options);assert.equal(dry.dryRun,true);assert.equal(Object.keys(dry.counts).length,25);assert.equal(dry.roots.length,2);assert.equal(existsSync(f.backup),false);assert.deepEqual(tree(f.source),originalTree);assert.deepEqual(tree(f.workspace),workspaceTree);
    const manifest=await backupRuntime(f.options);assert.equal(manifest.databaseFingerprint,dry.databaseFingerprint);assert.equal(verifyRuntimeBackup(f.backup).backupId,manifest.backupId);assert.deepEqual(tree(f.source),originalTree);assert.deepEqual(tree(f.workspace),workspaceTree);
    const before=new DatabaseSync(join(f.source,'apps.db'),{readOnly:true});const originalRows=Object.fromEntries(RUNTIME_COLLECTIONS.map(table=>[table,before.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));before.close();
    const restored=restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});assert.equal(restored.originalEvidenceUnchanged,true);assert.ok(restored.relocationCount>20);
    // Remove the original absolute locations without altering their bytes, proving no old-root dependency.
    renameSync(f.source,join(f.root,'original-runtime-hidden'));renameSync(f.workspace,join(f.root,'original-workspace-hidden'));
    const db=new DatabaseSync(join(f.target,'apps.db'),{readOnly:true});let relocations:EvidenceRelocation[];
    try {
      relocations=db.prepare("SELECT value_json FROM provider_records WHERE id LIKE 'evidence_relocations:%'").all().map(row=>JSON.parse(String(row.value_json)));
      for(const table of RUNTIME_COLLECTIONS){const rows=db.prepare(`SELECT * FROM ${table} ORDER BY id`).all().filter(row=>table!=='provider_records'||!String(row.id).startsWith('evidence_relocations:'));assert.deepEqual(rows,originalRows[table],`${table} exact SQL rows`);}
      const view=JSON.parse(String(db.prepare("SELECT value_json FROM views WHERE id='view'").get()!.value_json));assert.equal(view.previousGoodBuildId,f.first.report.archiveBuildId);assert.equal(view.lastGoodBuildId,f.current.report.archiveBuildId);assert.equal(view.ownerSessionId,'original-desktop-session');
      const state=JSON.parse(String(db.prepare("SELECT value_json FROM view_ui_states WHERE id='ui-state'").get()!.value_json));assert.deepEqual(state.value,{keyword:'retain filter',counter:4});
      const draft=JSON.parse(String(db.prepare("SELECT value_json FROM authoring_drafts WHERE id='draft'").get()!.value_json));assert.equal(draft.workspacePath,f.workspace,'immutable evidence path text retained');
    }finally{db.close();}
    assert.deepEqual(readFileSync(join(f.target,'authoring-evidence','.runner-key')),originalKey);
    const reportPath=mappedFile(relocations!,f.current.reportRef.path),envelope=JSON.parse(readFileSync(reportPath,'utf8'));
    assert.equal(sha(readFileSync(reportPath)),f.current.reportRef.sha256);assert.equal(envelope.signature,createHmac('sha256',originalKey).update(canonicalJson(envelope.report)).digest('hex'));
    assert.equal(envelope.report.cwd,f.workspace);assert.match(readFileSync(mappedFile(relocations!,envelope.report.logRef.path),'utf8'),/fixture built/);
    assert.deepEqual(readFileSync(mappedFile(relocations!,f.screenshot.path)),Buffer.from('fixture screenshot bytes, no browser claim'));
    assert.equal(sha(readFileSync(mappedFile(relocations!,f.previewRef.path))),f.previewRef.sha256);
    const workspaceMapping=relocations!.find(row=>row.kind==='directory'&&row.originalPath===f.workspace)!;
    assert.ok(existsSync(join(workspaceMapping.relocatedPath,'empty-directory')));assert.deepEqual(tree(workspaceMapping.relocatedPath),workspaceTree);assert.equal(sourceInputDigest(workspaceMapping.relocatedPath),f.current.report.sourceInputDigest);
    const sources=new SourceComponentStore(join(f.target,'source-components'));assert.equal(sources.verify(f.first.report.archiveBuildId!).valid,true);assert.equal(sources.verify(f.current.report.archiveBuildId!).valid,true);
    assert.match(sources.readFile(f.current.report.archiveBuildId!,'index.html')!.bytes.toString(),/current build/);
    assert.throws(()=>restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target}),/BACKUP_TARGET_ALREADY_EXISTS/);
  }finally{f.cleanup();}
});

test('committed WAL rows survive an exited writer without opening or changing source DB/WAL/SHM',async()=>{
  const root=mkdtempSync(join(tmpdir(),'apps-backup-wal-')),source=join(root,'source');mkdirSync(source);
  try {
    const moduleURL=pathToFileURL(resolve('packages/app-runtime/src/store.ts')).href;
    const script=`import {RuntimeStore} from ${JSON.stringify(moduleURL)};const store=new RuntimeStore(${JSON.stringify(join(source,'apps.db'))});store.db.exec('PRAGMA wal_autocheckpoint=0');store.put('view_ui_states','wal-only',{counter:19});process.exit(0);`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',windowsHide:true});assert.equal(child.status,0,child.stderr);assert.ok(existsSync(join(source,'apps.db-wal')));assert.ok(readFileSync(join(source,'apps.db-wal')).length>0);
    const sourceBytes=tree(source),options={sourceDirectory:source,backupDirectory:join(root,'backup'),offlineConfirmed:true};
    assert.equal(runtimeBackupDryRun(options).counts.view_ui_states,1);assert.deepEqual(tree(source),sourceBytes);
    const manifest=await backupRuntime(options);assert.ok(manifest.files.some(file=>file.path==='sqlite-input/apps.db-wal'));assert.deepEqual(tree(source),sourceBytes);
    const target=join(root,'restore');restoreRuntimeBackup({backupDirectory:options.backupDirectory,targetDirectory:target});const store=new RuntimeStore(join(target,'apps.db'));try{assert.deepEqual(store.get('view_ui_states','wal-only'),{counter:19});}finally{store.close();}
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('active Runtime writer, missing offline declaration, existing/overlapping targets and unknown schema are rejected',async()=>{
  const f=await fixture();let lease:RuntimeWriterLease|undefined;try{
    assert.throws(()=>runtimeBackupDryRun({...f.options,offlineConfirmed:false}),/OFFLINE_CONFIRMATION_REQUIRED/);
    lease=new RuntimeWriterLease(f.source);assert.throws(()=>runtimeBackupDryRun(f.options),/SOURCE_WRITER_STILL_ACTIVE/);lease.release();lease=undefined;
    assert.throws(()=>runtimeBackupDryRun({...f.options,backupDirectory:join(f.source,'nested')}),/SEPARATE_DIRECTORY/);
    mkdirSync(f.backup);assert.throws(()=>runtimeBackupDryRun(f.options),/TARGET_ALREADY_EXISTS/);rmdirSync(f.backup);
    const db=new DatabaseSync(join(f.source,'apps.db'));db.exec('CREATE TABLE unregistered(id TEXT)');db.close();assert.throws(()=>runtimeBackupDryRun(f.options),/SOURCE_SCHEMA_TABLES_UNKNOWN/);
  }finally{lease?.release();f.cleanup();}
});

test('missing screenshots, external workspaces, archives and unknown references cannot be silently omitted',async()=>{
  const f=await fixture();try{
    renameSync(f.screenshot.path,f.screenshot.path+'.hidden');assert.throws(()=>runtimeBackupDryRun(f.options),/REFERENCE_MISSING/);renameSync(f.screenshot.path+'.hidden',f.screenshot.path);
    renameSync(f.workspace,f.workspace+'.hidden');assert.throws(()=>runtimeBackupDryRun(f.options),/REFERENCE_MISSING/);renameSync(f.workspace+'.hidden',f.workspace);
    const archive=join(f.source,'source-components','builds',f.first.report.archiveBuildId!);renameSync(archive,archive+'.hidden');assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_BUILD_INCOMPLETE/);renameSync(archive+'.hidden',archive);
    const store=new RuntimeStore(join(f.source,'apps.db'));store.put('artifact_refs','unknown',{targetKind:'unregistered_kind',targetId:'opaque'});store.close();assert.throws(()=>runtimeBackupDryRun(f.options),/UNKNOWN_ARTIFACT_REFERENCE/);
  }finally{f.cleanup();}
});

test('symlinks in Runtime, external workspaces and backup input are rejected instead of followed',async()=>{
  const f=await fixture();try{
    const outside=join(f.root,'outside');mkdirSync(outside);writeFileSync(join(outside,'secret'),'must not traverse');
    symlinkSync(outside,join(f.source,'unsafe-link'),'junction');assert.throws(()=>runtimeBackupDryRun(f.options),/SYMLINK_FORBIDDEN/);rmdirSync(join(f.source,'unsafe-link'));
    symlinkSync(outside,join(f.workspace,'unsafe-link'),'junction');assert.throws(()=>runtimeBackupDryRun(f.options),/SYMLINK_FORBIDDEN/);rmdirSync(join(f.workspace,'unsafe-link'));
    await backupRuntime(f.options);symlinkSync(outside,join(f.backup,'unsafe-link'),'junction');assert.throws(()=>verifyRuntimeBackup(f.backup),/SYMLINK_FORBIDDEN/);
  }finally{f.cleanup();}
});

test('external editable workspace dependency junctions are omitted without traversal, while source, dist, locks and Git files restore for npm ci',async()=>{
  const f=await fixture();try{
    const outside=join(f.root,'outside-sdk'),dependency=join(f.workspace,'node_modules','@dsh','apps-component-runtime');
    mkdirSync(outside);writeFileSync(join(outside,'private-irrelevant-sdk-file'),'never backed up');mkdirSync(dirname(dependency),{recursive:true});symlinkSync(outside,dependency,'junction');
    mkdirSync(join(f.workspace,'.git'));writeFileSync(join(f.workspace,'.git','HEAD'),'ref: refs/heads/fixture\n');
    const sourceBefore=tree(f.source),lockBefore=readFileSync(join(f.workspace,'package-lock.json')),digestBefore=sourceInputDigest(f.workspace),linkBefore=readlinkSync(dependency);
    const dry=runtimeBackupDryRun(f.options);
    assert.ok(dry.excluded.some(row=>row.path===join(f.workspace,'node_modules')&&/npm ci/.test(row.reason)));
    assert.equal(dry.files.some(file=>file.originalPath.startsWith(join(f.workspace,'node_modules'))||file.originalPath.startsWith(outside)),false);
    assert.ok(dry.files.some(file=>file.originalPath===join(f.workspace,'.git','HEAD')));assert.ok(dry.files.some(file=>file.originalPath===join(f.workspace,'dist','index.html')));
    writeFileSync(join(outside,'private-irrelevant-sdk-file'),'external SDK target changed and is still irrelevant');
    const repeated=runtimeBackupDryRun(f.options);assert.equal(repeated.sourceFingerprint,dry.sourceFingerprint,'dependency junction target bytes are never fingerprinted');
    const manifest=await backupRuntime(f.options);verifyRuntimeBackup(f.backup);restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});
    const mapping=manifest.roots.find(root=>root.originalPath===f.workspace)!;const restored=join(f.target,mapping.restorePrefix);
    assert.equal(existsSync(join(restored,'node_modules')),false);assert.deepEqual(readFileSync(join(restored,'package-lock.json')),lockBefore);assert.equal(sourceInputDigest(restored),digestBefore);
    assert.equal(readFileSync(join(restored,'.git','HEAD'),'utf8'),'ref: refs/heads/fixture\n');assert.deepEqual(readFileSync(join(restored,'dist','index.html')),readFileSync(join(f.workspace,'dist','index.html')));
    const install=npmAt(restored,'ci');
    assert.equal(install.status,0,install.stderr);assert.equal(sourceInputDigest(restored),digestBefore,'normal dependency regeneration preserves source input identity');
    const build=spawnSync(process.execPath,['build.mjs'],{cwd:restored,encoding:'utf8',windowsHide:true});assert.equal(build.status,0,build.stderr);
    assert.deepEqual(tree(f.source),sourceBefore);assert.equal(lstatSync(dependency).isSymbolicLink(),true);assert.equal(readlinkSync(dependency),linkBefore);assert.equal(sourceInputDigest(f.workspace),digestBefore);
    assert.equal(readFileSync(join(outside,'private-irrelevant-sdk-file'),'utf8'),'external SDK target changed and is still irrelevant');
    const restoredStore=new RuntimeStore(join(f.target,'apps.db'));try{const resolver=new EvidencePathResolver({root:f.target,store:restoredStore});const runner=new AuthoringEvidenceRunner(join(f.target,'authoring-evidence'),{resolvePath:resolver.resolve.bind(resolver)});assert.equal(runner.verifyBuild(f.current.reportRef,new SourceComponentStore(join(f.target,'source-components'))).verdict,'PASS');}finally{restoredStore.close();}
  }finally{f.cleanup();}
});

test('normal npm file SDK links in internal and restored external workspaces support explicit dependency authoring attempts and another full backup',async()=>{
  for(const internalWorkspace of [true,false]){
    const f=await fixture({internalWorkspace,linkedSdk:true});try{
      const dependency=join(f.workspace,'node_modules','@dsh','apps-component-runtime'),sourceBefore=tree(f.source,join(f.workspace,'node_modules')),workspaceDigest=sourceInputDigest(f.workspace),lockBefore=readFileSync(join(f.workspace,'package-lock.json')),sdkBefore=tree(join(f.root,'outside-sdk')),linkBefore=readlinkSync(dependency);
      const dry=runtimeBackupDryRun(f.options);assert.ok(dry.excluded.some(row=>row.path===join(f.workspace,'node_modules')));assert.equal(dry.roots.find(root=>root.rootId==='runtime')!.editableWorkspacePaths?.includes(f.workspace)??false,internalWorkspace);
      const first=await backupRuntime(f.options);restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});
      const owner=first.roots.find(root=>root.editableWorkspacePaths?.includes(f.workspace))!;assert.ok(owner);
      const restoredWorkspace=internalWorkspace?join(f.target,'component-workspace','draft'):join(f.target,owner.restorePrefix);
      assert.equal(sourceInputDigest(restoredWorkspace),workspaceDigest);assert.deepEqual(readFileSync(join(restoredWorkspace,'package-lock.json')),lockBefore);assert.equal(existsSync(join(restoredWorkspace,'node_modules')),false);
      // npm stores relative lock keys even for an absolute file: SDK dependency. Relocation can make
      // npm ci reject that lock. Preserve old source/evidence first; dependency repair is a new attempt.
      const restoredStore=new RuntimeStore(join(f.target,'apps.db'));let rebuiltDigest:string;
      try{
        const resolver=new EvidencePathResolver({root:f.target,store:restoredStore}),sources=new SourceComponentStore(join(f.target,'source-components')),runner=new AuthoringEvidenceRunner(join(f.target,'authoring-evidence'),{resolvePath:resolver.resolve.bind(resolver)});
        assert.equal(runner.verifyBuild(f.current.reportRef,sources).verdict,'PASS');const oldReceipt=restoredStore.get('build_receipts','receipt'),oldReportBytes=readFileSync(resolver.resolve(f.current.reportRef.path));
        const presentation=new AppsPresentationService({store:restoredStore,sources,runtime:{describe:()=>undefined,invoke:async()=>{throw new Error('NO_BUSINESS_INVOCATIONS_IN_DEPENDENCY_RESTORE_TEST');}}});
        const authoring=presentation.configureAuthoring({evidenceRoot:runner.root,resolveEvidencePath:resolver.resolve.bind(resolver),validateBuildEvidence:ref=>runner.verifyBuild(ref,sources,{allowFailure:true}),validatePreviewEvidence:ref=>runner.readReport(ref)});
        const attempt=authoring.begin('original-desktop-session',{mode:'edit',viewId:'view',attemptId:'dependency-reinstall-'+String(internalWorkspace)});assert.equal(attempt.draft.workspacePath,restoredWorkspace);assert.equal(attempt.draft.sourceRevision,3);
        const install=npmAt(restoredWorkspace,'install');assert.equal(install.status,0,install.stderr);assert.equal(lstatSync(join(restoredWorkspace,'node_modules','@dsh','apps-component-runtime')).isSymbolicLink(),true);
        rebuiltDigest=sourceInputDigest(restoredWorkspace);const newLock=readFileSync(join(restoredWorkspace,'package-lock.json'));if(!internalWorkspace){assert.notEqual(sha(newLock),sha(lockBefore),'relocated file SDK lock repair is an explicit source change');assert.notEqual(rebuiltDigest,workspaceDigest);}
        const executed=await runner.build({attemptId:attempt.attempt.attemptId,epoch:attempt.attempt.epoch,sourceRevision:attempt.attempt.sourceRevision,workspacePath:attempt.draft.workspacePath,command:[process.execPath,'build.mjs'],sources});assert.equal(executed.report.verdict,'PASS');assert.equal(executed.report.lockfileDigest,sha(newLock));assert.equal(executed.report.sourceInputDigest,rebuiltDigest);
        const receipt=await authoring.recordBuild('original-desktop-session',{attemptId:attempt.attempt.attemptId,epoch:attempt.attempt.epoch,reportRef:executed.reportRef});assert.equal(receipt.verdict,'PASS');assert.equal(receipt.sourceRevision,3);assert.deepEqual(restoredStore.get('build_receipts','receipt'),oldReceipt);assert.deepEqual(readFileSync(resolver.resolve(f.current.reportRef.path)),oldReportBytes);assert.equal(sources.verify(f.current.report.archiveBuildId!).valid,true);assert.equal(runner.verifyBuild(executed.reportRef,sources).verdict,'PASS');
      }finally{restoredStore.close();}
      const secondBackup=join(f.root,'second-with-installed-sdk'),secondTarget=join(f.root,'second-restored-with-sdk');
      const second=await backupRuntime({sourceDirectory:f.target,backupDirectory:secondBackup,offlineConfirmed:true});assert.ok(second.excluded.some(row=>row.path===join(restoredWorkspace,'node_modules')));assert.ok(second.roots.find(root=>root.rootId==='runtime')!.editableWorkspacePaths?.includes(restoredWorkspace));verifyRuntimeBackup(secondBackup);
      restoreRuntimeBackup({backupDirectory:secondBackup,targetDirectory:secondTarget});const secondWorkspace=join(secondTarget,restoredWorkspace.slice(f.target.length+1));assert.equal(sourceInputDigest(secondWorkspace),rebuiltDigest!);assert.deepEqual(readFileSync(join(secondWorkspace,'package-lock.json')),readFileSync(join(restoredWorkspace,'package-lock.json')));
      const secondInstall=npmAt(secondWorkspace,'ci');assert.equal(secondInstall.status,0,secondInstall.stderr);assert.equal(runtimeBackupDryRun({sourceDirectory:secondTarget,backupDirectory:join(f.root,'third-sdk-backup'),offlineConfirmed:true}).schemaVersion,4);
      assert.deepEqual(tree(f.source,join(f.workspace,'node_modules')),sourceBefore);assert.equal(readlinkSync(dependency),linkBefore);assert.deepEqual(tree(join(f.root,'outside-sdk')),sdkBefore);
    }finally{f.cleanup();}
  }
});

test('immutable archives, evidence and undeclared controlled-root directories never receive dependency-cache exclusions',async()=>{
  const f=await fixture();try{
    const outside=join(f.root,'forbidden-asset-target');mkdirSync(outside);writeFileSync(join(outside,'private-file'),'no traversal');
    const immutableArchive=join(f.source,'source-components','builds',f.current.report.archiveBuildId!,'project'),protectedRoots=[immutableArchive,f.runner.root,join(f.source,'component-workspace','unregistered')];
    for(const protectedRoot of protectedRoots){
      mkdirSync(join(protectedRoot,'node_modules'),{recursive:true});const link=join(protectedRoot,'node_modules','forbidden-sdk');symlinkSync(outside,link,'junction');
      const store=new RuntimeStore(join(f.source,'apps.db'));try{store.put('views','cannot-promote-immutable',{source:{directory:protectedRoot}});if(protectedRoot===f.runner.root)store.put('authoring_drafts','cannot-promote-evidence',{workspacePath:protectedRoot});}finally{store.close();}
      // The undeclared workspace is deliberately not owned by a source view/draft.
      if(protectedRoot.endsWith('unregistered')){const db=new DatabaseSync(join(f.source,'apps.db'));db.prepare("DELETE FROM views WHERE id='cannot-promote-immutable'").run();db.close();}
      assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_SYMLINK_FORBIDDEN/);assert.equal(existsSync(f.backup),false);rmdirSync(link);
      const db=new DatabaseSync(join(f.source,'apps.db'));db.prepare("DELETE FROM views WHERE id='cannot-promote-immutable'").run();db.prepare("DELETE FROM authoring_drafts WHERE id='cannot-promote-evidence'").run();db.close();
    }
  }finally{f.cleanup();}
});

test('explicit file or directory evidence inside omitted workspace dependencies fails clearly, including linked SDK targets',async()=>{
  const f=await fixture();try{
    const outside=join(f.root,'outside-sdk'),dependency=join(f.workspace,'node_modules','@dsh','apps-component-runtime');
    mkdirSync(outside);writeFileSync(join(outside,'explicit-evidence'),'must not be omitted');mkdirSync(dirname(dependency),{recursive:true});symlinkSync(outside,dependency,'junction');
    const store=new RuntimeStore(join(f.source,'apps.db'));try{store.put('artifact_refs','explicit-dependency',{targetKind:'file',targetId:'dependency',file:{path:join(dependency,'explicit-evidence'),bytes:19,sha256:sha('must not be omitted')}});}finally{store.close();}
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DEPENDENCY_REFERENCE_EXCLUDED/);assert.equal(existsSync(f.backup),false);
    const db=new DatabaseSync(join(f.source,'apps.db'));db.prepare("DELETE FROM artifact_refs WHERE id='explicit-dependency'").run();db.close();
    const directoryStore=new RuntimeStore(join(f.source,'apps.db'));try{directoryStore.put('provider_records','explicit-dependency-directory',{directory:dependency});}finally{directoryStore.close();}
    assert.throws(()=>runtimeBackupDryRun(f.options),/BACKUP_DEPENDENCY_REFERENCE_EXCLUDED/);assert.equal(existsSync(f.backup),false);
  }finally{f.cleanup();}
});

test('manifest, file hash, extra files, private runner key and immutable receipt mismatch fail verification before restore',async()=>{
  const f=await fixture();try{
    const store=new RuntimeStore(join(f.source,'apps.db'));store.put('artifact_refs','wrong-hash',{targetKind:'file',targetId:'bad',file:{...f.screenshot,sha256:'0'.repeat(64)}});store.close();assert.throws(()=>runtimeBackupDryRun(f.options),/REFERENCE_HASH_MISMATCH/);
    const db=new DatabaseSync(join(f.source,'apps.db'));db.prepare("DELETE FROM artifact_refs WHERE id='wrong-hash'").run();db.close();
    await backupRuntime(f.options);const key=join(f.backup,'runtime','authoring-evidence','.runner-key'),original=readFileSync(key);writeFileSync(key,Buffer.alloc(32));assert.throws(()=>verifyRuntimeBackup(f.backup),/BACKUP_HASH_MISMATCH/);writeFileSync(key,original);
    const manifest=join(f.backup,'manifest.json'),bytes=readFileSync(manifest);writeFileSync(manifest,Buffer.concat([bytes,Buffer.from(' ')]));assert.throws(()=>verifyRuntimeBackup(f.backup),/MANIFEST_HASH_MISMATCH/);writeFileSync(manifest,bytes);
    writeFileSync(join(f.backup,'unmanifested'),'untrusted');assert.throws(()=>verifyRuntimeBackup(f.backup),/UNMANIFESTED_FILE/);rmSync(join(f.backup,'unmanifested'));
    verifyRuntimeBackup(f.backup);assert.equal(existsSync(f.target),false);
  }finally{f.cleanup();}
});

test('CLI dry-run/apply/verify/restore uses offline explicit modes and prints no runner key or full evidence content',async()=>{
  const f=await fixture();try {
    const run=(...args:string[])=>spawnSync(process.execPath,['scripts/backup-apps.mjs',...args],{cwd:resolve('.'),encoding:'utf8',windowsHide:true});
    const help=run('--help');assert.equal(help.status,0);assert.match(help.stdout,/25 collections/);
    const dry=run('--mode','dry-run','--source',f.source,'--backup',f.backup,'--offline');assert.equal(dry.status,0,dry.stderr);assert.equal(JSON.parse(dry.stdout).files>0,true);assert.equal(existsSync(f.backup),false);
    const unsafeReport=run('--mode','dry-run','--source',f.source,'--backup',f.backup,'--offline','--output',join(f.source,'would-change-original.json'));assert.notEqual(unsafeReport.status,0);assert.equal(existsSync(join(f.source,'would-change-original.json')),false);
    assert.notEqual(run('--mode','apply','--source',f.source,'--backup',f.backup).status,0);
    const applied=run('--mode','apply','--source',f.source,'--backup',f.backup,'--offline');assert.equal(applied.status,0,applied.stderr);assert.equal(applied.stdout.includes('.runner-key'),false);assert.equal(applied.stdout.includes('current build'),false);
    assert.equal(run('--mode','verify','--backup',f.backup).status,0);
    const restored=run('--mode','restore','--backup',f.backup,'--target',f.target);assert.equal(restored.status,0,restored.stderr);assert.equal(JSON.parse(restored.stdout).status,'restored');
  }finally{f.cleanup();}
});

test('source changes during the async SQLite backup leave only an incomplete output and never a restorable manifest',async()=>{
  const f=await fixture();try{
    const pending=backupRuntime(f.options);
    writeFileSync(join(f.workspace,'source.html'),'<main>editor changed during backup</main>');
    await assert.rejects(pending,/SOURCE_CHANGED_DURING_BACKUP/);
    assert.equal(existsSync(join(f.backup,'manifest.json')),false);assert.equal(existsSync(join(f.backup,'INCOMPLETE.json')),true);
    assert.throws(()=>restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target}));assert.equal(existsSync(f.target),false);
  }finally{f.cleanup();}
});

test('missing private key, invalid runner attestation and unknown absolute external asset references block backup',async()=>{
  const f=await fixture();try{
    const key=join(f.runner.root,'.runner-key'),keyBytes=readFileSync(key);renameSync(key,key+'.hidden');assert.throws(()=>runtimeBackupDryRun(f.options),/REFERENCE_MISSING/);renameSync(key+'.hidden',key);
    writeFileSync(key,Buffer.alloc(32));assert.throws(()=>runtimeBackupDryRun(f.options),/RUNNER_ATTESTATION_INVALID/);writeFileSync(key,keyBytes);
    const external=join(f.root,'unregistered-file');writeFileSync(external,'explicit unknown reference');const store=new RuntimeStore(join(f.source,'apps.db'));store.put('provider_records','unknown-external',{opaqueReference:external});store.close();assert.throws(()=>runtimeBackupDryRun(f.options),/UNKNOWN_EXTERNAL_REFERENCE/);
  }finally{f.cleanup();}
});

test('rehashed malicious traversal/root manifests and missing external workspace files are rejected before target creation',async()=>{
  const f=await fixture();try{
    await backupRuntime(f.options);const path=join(f.backup,'manifest.json'),original=readFileSync(path),manifest=JSON.parse(original.toString('utf8'));
    const replace=(value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2));writeFileSync(path,bytes);writeFileSync(join(f.backup,'manifest.sha256'),sha(bytes)+'\n');};
    const traversal=structuredClone(manifest);traversal.files[0].path='../../outside';replace(traversal);assert.throws(()=>restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target}),/MANIFEST_PATH_INVALID/);assert.equal(existsSync(f.target),false);
    const hostileRoot=structuredClone(manifest);hostileRoot.roots[1].restorePrefix='../outside';replace(hostileRoot);assert.throws(()=>verifyRuntimeBackup(f.backup),/ROOT_INVALID/);
    replace(manifest);const externalFile=manifest.files.find((file:{rootId:string;path:string})=>file.rootId!=='runtime');rmSync(join(f.backup,externalFile.path));assert.throws(()=>restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target}));assert.equal(existsSync(f.target),false);
  }finally{f.cleanup();}
});

test('restored Runtime can be backed up and restored again with absent original roots and immutable alias history',async()=>{
  const f=await fixture();try{
    await backupRuntime(f.options);restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});
    renameSync(f.source,join(f.root,'hidden-source'));renameSync(f.workspace,join(f.root,'hidden-workspace'));
    const secondBackup=join(f.root,'second-backup'),secondTarget=join(f.root,'second-restored');
    const second=await backupRuntime({sourceDirectory:f.target,backupDirectory:secondBackup,offlineConfirmed:true});assert.ok(second.references.some(row=>row.resolvedPath&&row.originalPath===f.current.reportRef.path));
    const report=restoreRuntimeBackup({backupDirectory:secondBackup,targetDirectory:secondTarget});assert.notEqual(report.manifestPath,join(secondTarget,'.restore','runtime-backup-manifest.json'));
    renameSync(f.target,join(f.root,'hidden-first-restored'));
    const store=new RuntimeStore(join(secondTarget,'apps.db'));try{
      const relocations=store.list<EvidenceRelocation>('provider_records').filter(row=>row.namespace==='evidence_relocations'&&row.backupId===second.backupId);
      assert.equal(sha(readFileSync(mappedFile(relocations,f.current.reportRef.path))),f.current.reportRef.sha256);assert.equal(sha(readFileSync(mappedFile(relocations,f.screenshot.path))),f.screenshot.sha256);
      const workspace=relocations.find(row=>row.kind==='directory'&&row.originalPath===f.workspace)!;assert.equal(sourceInputDigest(workspace.relocatedPath),f.current.report.sourceInputDigest);
      const resolver=new EvidencePathResolver({root:secondTarget,store});assert.equal(resolver.resolve(f.current.reportRef.path),mappedFile(relocations,f.current.reportRef.path));assert.equal(resolver.resolve(f.workspace),workspace.relocatedPath);
      const runner=new AuthoringEvidenceRunner(join(secondTarget,'authoring-evidence'),{resolvePath:resolver.resolve.bind(resolver)});assert.equal(runner.verifyBuild(f.current.reportRef,new SourceComponentStore(join(secondTarget,'source-components'))).archiveBuildId,f.current.report.archiveBuildId);
    }finally{store.close();}
    assert.equal(runtimeBackupDryRun({sourceDirectory:secondTarget,backupDirectory:join(f.root,'third-backup'),offlineConfirmed:true}).schemaVersion,4);
  }finally{f.cleanup();}
});

test('actual Runner verifies original reports and authoring inspect/edit/recordBuild recover independently after original roots disappear',async()=>{
  const f=await fixture();let store:RuntimeStore|undefined;try{
    await backupRuntime(f.options);restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});
    store=new RuntimeStore(join(f.target,'apps.db'));const resolver=new EvidencePathResolver({root:f.target,store});
    const resolvePath=resolver.resolve.bind(resolver),sources=new SourceComponentStore(join(f.target,'source-components')),runner=new AuthoringEvidenceRunner(join(f.target,'authoring-evidence'),{resolvePath});
    assert.notEqual(resolvePath(f.current.reportRef.path),f.current.reportRef.path,'current-root mapping takes precedence while old root exists');assert.equal(resolvePath(f.source),resolve(f.target));
    renameSync(f.source,join(f.root,'original-source-hidden'));renameSync(f.workspace,join(f.root,'original-workspace-hidden'));
    const verified=runner.verifyBuild(f.current.reportRef,sources);assert.equal(verified.verdict,'PASS');assert.equal(verified.cwd,f.workspace,'signed report original JSON is unchanged');
    assert.equal(runner.readReport<{buildId:string}>(f.previewRef).buildId,f.current.report.archiveBuildId);
    assert.equal(sha(readFileSync(resolvePath(f.screenshot.path))),f.screenshot.sha256);
    const presentation=new AppsPresentationService({store,sources,runtime:{describe:()=>undefined,invoke:async()=>{throw new Error('NO_RUNTIME_OR_BUSINESS_INVOCATIONS_IN_RESTORE_TEST');}}});
    const authoring=presentation.configureAuthoring({evidenceRoot:runner.root,resolveEvidencePath:resolvePath,validateBuildEvidence:ref=>runner.verifyBuild(ref,sources,{allowFailure:true}),validatePreviewEvidence:ref=>runner.readReport(ref)});
    const inspection=authoring.inspect('original-desktop-session',{attemptId:'attempt'});assert.equal(inspection.workspaceAvailable,true);assert.equal(inspection.draft.workspacePath,resolvePath(f.workspace));assert.deepEqual(inspection.missingEvidence,[]);assert.equal(inspection.view.previousGoodBuildId,f.first.report.archiveBuildId);
    const immutableReceipt=store.get('build_receipts','receipt'),next=authoring.begin('original-desktop-session',{mode:'edit',viewId:'view',attemptId:'new-root-build'});
    assert.equal(next.draft.workspacePath,resolvePath(f.workspace));
    const executed=await runner.build({attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,sourceRevision:next.attempt.sourceRevision,workspacePath:next.draft.workspacePath,command:[process.execPath,'build.mjs'],sources});assert.equal(executed.report.verdict,'PASS');
    const receipt=await authoring.recordBuild('original-desktop-session',{attemptId:next.attempt.attemptId,epoch:next.attempt.epoch,reportRef:executed.reportRef});assert.equal(receipt.verdict,'PASS');assert.equal(receipt.cwd,next.draft.workspacePath);assert.deepEqual(store.get('build_receipts','receipt'),immutableReceipt);
  }finally{store?.close();f.cleanup();}
});

test('resolver reuses relocation rows within an evidence batch and releases them after success or failure',async()=>{
  const f=await fixture();let store:RuntimeStore|undefined;try{
    await backupRuntime(f.options);restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});
    store=new RuntimeStore(join(f.target,'apps.db'));let reads=0;
    const resolver=new EvidencePathResolver({root:f.target,store:{list:<T>(table:string)=>{reads++;return store!.list<T>(table);}}});
    resolver.withScope(()=>{
      for(let i=0;i<46;i++)resolver.resolve(f.screenshot.path);
      resolver.withScope(()=>resolver.resolve(f.current.reportRef.path));
    });
    assert.equal(reads,1,'one relocation scan for the whole batch');
    resolver.withScope(()=>resolver.resolve(f.screenshot.path));assert.equal(reads,2,'next batch reads current rows');
    assert.throws(()=>resolver.withScope(()=>{resolver.resolve(f.screenshot.path);throw new Error('batch failed');}),/batch failed/);
    resolver.resolve(f.screenshot.path);assert.equal(reads,4,'failed batch does not retain its index');
  }finally{store?.close();f.cleanup();}
});

test('resolver rejects anchor tamper, mapped file tamper, symlink, traversal, unmanifested mappings and conflicting proven facts',async()=>{
  const f=await fixture();let store:RuntimeStore|undefined;try{
    await backupRuntime(f.options);const restored=restoreRuntimeBackup({backupDirectory:f.backup,targetDirectory:f.target});store=new RuntimeStore(join(f.target,'apps.db'));const resolver=new EvidencePathResolver({root:f.target,store});
    assert.equal(resolver.resolve(join(f.root,'unmapped-not-existing')),resolve(f.root,'unmapped-not-existing'));assert.throws(()=>resolver.resolve(join(f.root,'foo')+ '/../../outside'),/TRAVERSAL/);
    const anchorBytes=readFileSync(restored.manifestPath);writeFileSync(restored.manifestPath,Buffer.concat([anchorBytes,Buffer.from(' ')]));assert.throws(()=>resolver.resolve(f.current.reportRef.path),/MANIFEST_HASH_MISMATCH/);writeFileSync(restored.manifestPath,anchorBytes);
    const mapped=resolver.resolve(f.screenshot.path),screenshotBytes=readFileSync(mapped);writeFileSync(mapped,'tampered screenshot');assert.throws(()=>resolver.resolve(f.screenshot.path),/FILE_HASH_MISMATCH/);writeFileSync(mapped,screenshotBytes);
    const row=store.list<EvidenceRelocation>('provider_records').find(row=>row.namespace==='evidence_relocations'&&row.originalPath===f.screenshot.path)!;
    store.put('provider_records','unmanifested-mapping',{...row,relocatedPath:join(f.target,'not-the-manifest-file')});assert.throws(()=>resolver.resolve(f.screenshot.path),/TARGET_INVALID/);store.delete('provider_records','unmanifested-mapping');
    const altered=JSON.parse(anchorBytes.toString()),fact=altered.files.find((file:{originalPath:string})=>file.originalPath===f.screenshot.path);fact.sha256='0'.repeat(64);const conflictAnchor=join(f.target,'.restore','conflict-anchor.json'),conflictBytes=Buffer.from(JSON.stringify(altered));writeFileSync(conflictAnchor,conflictBytes);
    store.put('provider_records','conflicting-mapping',{...row,sha256:fact.sha256,manifestPath:conflictAnchor,manifestSha256:sha(conflictBytes)});assert.throws(()=>resolver.resolve(f.screenshot.path),/CONFLICT/);store.delete('provider_records','conflicting-mapping');
    const evidence=join(f.target,'authoring-evidence'),saved=join(f.target,'authoring-evidence-saved'),outside=join(f.root,'outside-evidence');mkdirSync(outside);renameSync(evidence,saved);symlinkSync(outside,evidence,'junction');assert.throws(()=>resolver.resolve(f.current.reportRef.path),/SYMLINK/);rmdirSync(evidence);renameSync(saved,evidence);
    assert.equal(resolver.resolve(f.current.reportRef.path),join(f.target,'authoring-evidence',f.current.reportRef.path.split(/[\\/]/).at(-1)!));
  }finally{store?.close();f.cleanup();}
});
