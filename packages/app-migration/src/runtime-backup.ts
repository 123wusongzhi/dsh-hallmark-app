import {backup, DatabaseSync} from 'node:sqlite';
import {createHash,createHmac} from 'node:crypto';
import {chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import {RUNTIME_COLLECTIONS} from '../../app-runtime/src/store.ts';
import {SourceComponentStore} from '../../source-components/src/index.ts';

const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const sqliteNames=['apps.db','apps.db-wal','apps.db-shm'];
const pathKeys=new Set(['workspacePath','cwd','directory','screenshotPath','reportPath','thumbnail','manifestPath','logPath']);
const buildKeys=new Set(['buildId','archiveBuildId','candidateBuildId','activeBuildId','lastGoodBuildId','previousGoodBuildId','sourceBuildId','priorActiveBuildId']);
type Row=Record<string,unknown>;
export interface RuntimeBackupOptions {sourceDirectory:string;backupDirectory:string;offlineConfirmed:boolean}
export interface BackupRoot {rootId:string;originalPath:string;backupPrefix:string;restorePrefix:string;directories:string[];editableWorkspacePaths?:string[]}
export interface BackupFile {path:string;originalPath:string;bytes:number;sha256:string;mode:number;rootId:string}
export interface BackupReference {location:string;kind:'file'|'directory'|'build'|'dataset'|'toolchain';originalPath?:string;resolvedPath?:string;targetId?:string;sha256?:string;bytes?:number}
export interface RuntimeBackupPlan {
  formatVersion:1;schemaVersion:4;backupId:string;sourceDirectory:string;backupDirectory:string;createdAt:string;
  sourceFingerprint:string;databaseFingerprint:string;counts:Record<string,number>;roots:BackupRoot[];
  files:BackupFile[];references:BackupReference[];excluded:{path:string;reason:string}[];dryRun:boolean;
}
export interface RuntimeBackupManifest extends RuntimeBackupPlan {dryRun:false;database:{path:string;bytes:number;sha256:string}}
export interface EvidenceRelocation {
  appId:'apps';connectionId:'presentation';namespace:'evidence_relocations';backupId:string;
  kind:'file'|'directory';originalPath:string;relocatedPath:string;bytes?:number;sha256?:string;
  manifestPath:string;manifestSha256:string;
}
export interface RuntimeRestoreReport {
  backupId:string;schemaVersion:4;sourceDirectory:string;targetDirectory:string;restoredAt:string;
  originalDatabaseFingerprint:string;originalCounts:Record<string,number>;relocationCount:number;
  manifestPath:string;manifestSha256:string;originalEvidenceUnchanged:true;status:'restored';
}
interface Inventory {files:{relativePath:string;bytes:number;sha256:string;mode:number}[];directories:string[];excluded:{path:string;reason:string}[]}
interface Inspection {plan:RuntimeBackupPlan;rows:Record<string,Row[]>;scratch:string;database:DatabaseSync;dispose:()=>void}
const dependencyCacheReason='Regenerable identified editable-workspace node_modules cache; not followed or restored. Reinstall with npm ci (or the lockfile package manager) before editing/building; source, dist and lockfiles are preserved.';

function inside(root:string,path:string):boolean {const rel=relative(resolve(root),resolve(path));return rel===''||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);}
function safeAncestors(path:string):void {
  let current=resolve(path);
  for(;;){if(existsSync(current)&&lstatSync(current).isSymbolicLink())throw new Error('BACKUP_SYMLINK_FORBIDDEN');const parent=dirname(current);if(parent===current)break;current=parent;}
}
function safeExisting(path:string):string {safeAncestors(path);if(!existsSync(path))throw new Error(`BACKUP_REFERENCE_MISSING: ${path}`);return realpathSync(path);}
function archivePath(root:string,path:string):string {
  if(!path||isAbsolute(path)||path.includes('\\')||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('BACKUP_MANIFEST_PATH_INVALID');
  const full=resolve(root,path);if(!inside(root,full)||full===resolve(root))throw new Error('BACKUP_MANIFEST_PATH_INVALID');safeAncestors(full);return full;
}
function newSeparateDirectory(source:string,target:string):void {
  safeAncestors(target);if(inside(source,target)||inside(target,source))throw new Error('BACKUP_SEPARATE_DIRECTORY_REQUIRED');
  if(existsSync(target))throw new Error('BACKUP_TARGET_ALREADY_EXISTS');
}
function assertOffline(source:string,confirmed:boolean):void {
  if(!confirmed)throw new Error('OFFLINE_CONFIRMATION_REQUIRED');
  const path=join(source,'runtime-writer.json');if(!existsSync(path))return;safeAncestors(path);
  const owner=JSON.parse(readFileSync(path,'utf8')) as {pid?:number};
  if(!Number.isSafeInteger(owner.pid)||owner.pid!<1)throw new Error('WRITER_LEASE_REQUIRES_REVIEW');
  try{process.kill(owner.pid!,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return;throw new Error('SOURCE_WRITER_STILL_ACTIVE');}
  throw new Error('SOURCE_WRITER_STILL_ACTIVE');
}
function dependencyCache(path:string,workspaces:readonly string[]):boolean {
  return workspaces.some(workspace=>inside(workspace,path)&&relative(workspace,path).split(sep).includes('node_modules'));
}
function controlledRuntimeWorkspace(runtime:string,path:string):boolean {
  return ['component-workspace','restored-workspaces'].some(name=>{const base=join(runtime,name);return inside(base,path)&&!relative(base,path).split(sep).includes('node_modules');});
}
function inventory(root:string,editableWorkspacePaths:readonly string[]=[]):Inventory {
  safeExisting(root);if(!lstatSync(root).isDirectory())throw new Error('BACKUP_DIRECTORY_REQUIRED');
  const files:Inventory['files']=[],directories:string[]=[''],excluded:Inventory['excluded']=[];
  const walk=(current:string)=>{for(const entry of readdirSync(current,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const full=join(current,entry.name),name=relative(root,full).split(sep).join('/');
    // Inspect the entry itself only. In particular, npm file: SDK junctions must never be traversed.
    if(entry.name==='node_modules'&&dependencyCache(full,editableWorkspacePaths)&&(entry.isDirectory()||entry.isSymbolicLink())){excluded.push({path:full,reason:dependencyCacheReason});continue;}
    if(entry.isSymbolicLink()||lstatSync(full).isSymbolicLink())throw new Error('BACKUP_SYMLINK_FORBIDDEN');
    if(entry.isDirectory()){directories.push(name);walk(full);}else if(entry.isFile()){const bytes=readFileSync(full);files.push({relativePath:name,bytes:bytes.length,sha256:hash(bytes),mode:lstatSync(full).mode&0o777});}
    else throw new Error('BACKUP_FILE_TYPE_UNKNOWN');
  }};walk(root);return {files,directories,excluded};
}
function databaseState(db:DatabaseSync):{rows:Record<string,Row[]>;counts:Record<string,number>;fingerprint:string} {
  if(Number(db.prepare('PRAGMA user_version').get()?.user_version)!==4)throw new Error('SOURCE_SCHEMA_4_REQUIRED');
  if(db.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok'))throw new Error('BACKUP_DATABASE_INTEGRITY_FAILED');
  const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));
  if(names.length!==RUNTIME_COLLECTIONS.length||names.some(name=>!(RUNTIME_COLLECTIONS as readonly string[]).includes(name)))throw new Error('SOURCE_SCHEMA_TABLES_UNKNOWN');
  const rows=Object.fromEntries(names.map(name=>[name,db.prepare(`SELECT * FROM ${name} ORDER BY id`).all()])) as Record<string,Row[]>;
  return {rows,counts:Object.fromEntries(names.map(name=>[name,rows[name].length])),fingerprint:hash(canonicalJson(rows))};
}
function copyChecked(from:string,to:string,expected:{bytes:number;sha256:string;mode?:number}):void {
  safeAncestors(from);const bytes=readFileSync(from);if(bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw new Error('SOURCE_CHANGED_DURING_BACKUP');
  safeAncestors(to);mkdirSync(dirname(to),{recursive:true});writeFileSync(to,bytes,{flag:'wx',mode:expected.mode??0o600});
  if(expected.mode!==undefined)chmodSync(to,expected.mode);
}
function rootInventory(root:BackupRoot):Inventory {return inventory(root.originalPath,root.editableWorkspacePaths??[]);}
function physicalFingerprint(roots:BackupRoot[]):string {return hash(canonicalJson(roots.map(root=>({path:root.originalPath,...rootInventory(root)}))));}
/** Read only a private copy of main/WAL/SHM: even SQLite read-only opens may alter source SHM read marks. */
function inspectSource(options:RuntimeBackupOptions):Inspection {
  const source=safeExisting(options.sourceDirectory),destination=resolve(options.backupDirectory);
  assertOffline(source,options.offlineConfirmed);newSeparateDirectory(source,destination);
  const scratch=mkdtempSync(join(tmpdir(),'apps-full-backup-'));let database:DatabaseSync|undefined;
  try {
    // Read only these fixed SQLite paths first. Their private copy identifies editable workspaces
    // before a full Runtime inventory encounters normal npm file: SDK junctions.
    const sqliteInputs:Inventory['files']=[];
    if(!existsSync(join(source,'apps.db')))throw new Error('RUNTIME_DATABASE_REQUIRED');
    for(const name of sqliteNames){const path=join(source,name);if(!existsSync(path))continue;safeExisting(path);if(!lstatSync(path).isFile())throw new Error('BACKUP_REFERENCE_TYPE_INVALID');const bytes=readFileSync(path),file={relativePath:name,bytes:bytes.length,sha256:hash(bytes),mode:lstatSync(path).mode&0o777};sqliteInputs.push(file);copyChecked(path,join(scratch,name),file);}
    database=new DatabaseSync(join(scratch,'apps.db'),{readOnly:true});const state=databaseState(database);
    const roots:BackupRoot[]=[{rootId:'runtime',originalPath:source,backupPrefix:'runtime',restorePrefix:'',directories:[]}];
    const references:BackupReference[]=[],builds=new Set<string>(),datasets=new Set<string>(),initialTrees=new Map<string,Inventory>();
    const priorRelocations:EvidenceRelocation[]=[];
    const priorWorkspaceAliases=new Set<string>();
    for(const row of state.rows.provider_records){
      const candidate=JSON.parse(String(row.value_json)) as EvidenceRelocation;if(candidate.namespace!=='evidence_relocations')continue;
      // Ignore obsolete relocation generations whose anchor is no longer in this Runtime. Never trust an external manifest.
      if(!inside(source,candidate.manifestPath)||!existsSync(candidate.manifestPath))continue;
      safeExisting(candidate.manifestPath);const payload=readFileSync(candidate.manifestPath);if(hash(payload)!==candidate.manifestSha256)throw new Error('BACKUP_RELOCATION_MANIFEST_INVALID');
      const prior=JSON.parse(payload.toString('utf8')) as RuntimeBackupManifest;
      const alias=prior.references.find(reference=>reference.kind===candidate.kind&&reference.originalPath===candidate.originalPath&&reference.resolvedPath);
      const previousPath=alias?.resolvedPath??candidate.originalPath,mapping=prior.roots.find(root=>inside(root.originalPath,previousPath));
      if(prior.formatVersion!==1||prior.schemaVersion!==4||prior.backupId!==candidate.backupId||!mapping||!inside(source,candidate.relocatedPath))throw new Error('BACKUP_RELOCATION_INVALID');
      const suffix=relative(mapping.originalPath,previousPath),expected=resolve(source,mapping.restorePrefix,suffix);
      if(resolve(candidate.relocatedPath)!==expected)throw new Error('BACKUP_RELOCATION_INVALID');safeExisting(expected);
      // Only authenticated workspace identities from a previous backup can promote a relocated
      // Runtime directory. A generic directory relocation never makes arbitrary assets editable.
      for(const workspace of mapping.editableWorkspacePaths??[]){
        if(!isAbsolute(workspace)||!inside(mapping.originalPath,workspace)||mapping.rootId==='runtime'&&!controlledRuntimeWorkspace(mapping.originalPath,workspace))throw new Error('BACKUP_RELOCATION_INVALID');
        const relocatedWorkspace=resolve(source,mapping.restorePrefix,relative(mapping.originalPath,workspace));
        if(controlledRuntimeWorkspace(source,relocatedWorkspace))priorWorkspaceAliases.add(relocatedWorkspace);
      }
      if(candidate.kind==='file'){
        const file=prior.files.find(file=>file.originalPath===candidate.originalPath)??prior.references.find(reference=>reference.kind==='file'&&reference.originalPath===candidate.originalPath);
        if(!file||file.bytes!==candidate.bytes||file.sha256!==candidate.sha256)throw new Error('BACKUP_RELOCATION_HASH_INVALID');
        // Workspaces are editable; a path alias is stable, while a fresh backup records its current bytes.
        // Immutable evidence references are independently checked against their original receipt SHA below.
        const bytes=readFileSync(expected);candidate.sha256=hash(bytes);candidate.bytes=bytes.length;
      }else if(candidate.kind!=='directory'||!lstatSync(expected).isDirectory())throw new Error('BACKUP_RELOCATION_INVALID');
      priorRelocations.push(candidate);
    }
    const mappedPath=(named:string):string=>{
      const candidates=priorRelocations.filter(row=>row.kind==='file'?resolve(row.originalPath)===resolve(named):inside(row.originalPath,named)).sort((a,b)=>b.originalPath.length-a.originalPath.length);
      const row=candidates[0];if(!row)return resolve(named);
      return resolve(row.kind==='file'?row.relocatedPath:resolve(row.relocatedPath,relative(row.originalPath,named)));
    };
    // External editable paths keep their original authority. Internal paths need explicit authoring
    // draft/view ownership or an authenticated prior workspace alias, and a controlled Runtime root.
    const editableWorkspacePaths=new Set<string>(priorWorkspaceAliases);
    const findWorkspaces=(value:unknown,key=''):void=>{
      if(typeof value==='string'&&['workspacePath','cwd','directory'].includes(key)&&isAbsolute(value)){
        const path=mappedPath(value);if(!inside(source,path))editableWorkspacePaths.add(path);
      }else if(Array.isArray(value))value.forEach(item=>findWorkspaces(item,key));
      else if(value&&typeof value==='object')for(const [field,item]of Object.entries(value))findWorkspaces(item,field);
    };
    const identifyInternalWorkspace=(value:unknown):void=>{if(typeof value==='string'&&isAbsolute(value)){const path=mappedPath(value);if(controlledRuntimeWorkspace(source,path))editableWorkspacePaths.add(path);}};
    for(const [table,rows]of Object.entries(state.rows))for(const row of rows){
      const value=JSON.parse(String(row.value_json));if(table==='provider_records'&&value.namespace==='evidence_relocations')continue;findWorkspaces(value);
      if(table==='authoring_drafts')identifyInternalWorkspace(value.workspacePath);
      if(table==='views')identifyInternalWorkspace(value.source?.directory);
      if(table==='provider_records'&&value.namespace==='view_revisions')identifyInternalWorkspace(value.value?.source?.directory);
    }
    const validateWorkspaces=():void=>{
      const workspaceCandidates=[...editableWorkspacePaths].sort((a,b)=>a.length-b.length);editableWorkspacePaths.clear();
      for(const candidate of workspaceCandidates){
        if(dependencyCache(candidate,[...editableWorkspacePaths]))throw new Error('BACKUP_DEPENDENCY_REFERENCE_EXCLUDED: editable workspace directory');
        const path=safeExisting(candidate);if(lstatSync(path).isDirectory())editableWorkspacePaths.add(path);
      }
    };
    validateWorkspaces();
    const internalWorkspaces=[...editableWorkspacePaths].filter(path=>inside(source,path)).sort();
    if(internalWorkspaces.length)roots[0].editableWorkspacePaths=internalWorkspaces;
    const sourceInventory=rootInventory(roots[0]);roots[0].directories=sourceInventory.directories;initialTrees.set(source,sourceInventory);
    for(const initial of sqliteInputs){const current=sourceInventory.files.find(file=>file.relativePath===initial.relativePath);if(!current||current.bytes!==initial.bytes||current.sha256!==initial.sha256)throw new Error('SOURCE_CHANGED_DURING_BACKUP');}
    if(sourceInventory.files.filter(file=>sqliteNames.includes(file.relativePath)).length!==sqliteInputs.length)throw new Error('SOURCE_CHANGED_DURING_BACKUP');
    for(const file of sourceInventory.files){
      if(!file.relativePath.endsWith('.json')||file.relativePath.includes('/project/')||file.relativePath.startsWith('.restore/'))continue;
      let value:unknown;try{value=JSON.parse(readFileSync(join(source,file.relativePath),'utf8'));}catch{continue;}findWorkspaces(value);
    }
    validateWorkspaces();
    const assertNotDependencyReference=(path:string,location:string):void=>{if(dependencyCache(path,[...editableWorkspacePaths]))throw new Error(`BACKUP_DEPENDENCY_REFERENCE_EXCLUDED: ${location}`);};
    const actualPath=(named:string,location:string):string=>{const mapped=mappedPath(named);assertNotDependencyReference(mapped,location);return safeExisting(mapped);};
    const addPath=(named:string,location:string,kind:'file'|'directory',expected?:{sha256:string;bytes:number})=>{
      if(!isAbsolute(named))throw new Error(`BACKUP_REFERENCE_MUST_BE_ABSOLUTE: ${location}`);
      const path=actualPath(named,location),stat=lstatSync(path);if(kind==='directory'?!stat.isDirectory():!stat.isFile())throw new Error('BACKUP_REFERENCE_TYPE_INVALID');
      if(expected){const bytes=readFileSync(path);if(bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw new Error('BACKUP_REFERENCE_HASH_MISMATCH');}
      if(!roots.some(root=>inside(root.originalPath,path))){
        const externalRoot=kind==='directory'?path:dirname(path);
        if(inside(externalRoot,source))throw new Error('BACKUP_EXTERNAL_ROOT_CONTAINS_RUNTIME');
        const rootId='workspace-'+hash(externalRoot).slice(0,24),workspaces=[...editableWorkspacePaths].filter(path=>inside(externalRoot,path)).sort(),tree=inventory(externalRoot,workspaces);
        initialTrees.set(externalRoot,tree);
        roots.push({rootId,originalPath:externalRoot,backupPrefix:`external/${rootId}`,restorePrefix:`restored-workspaces/${rootId}`,directories:tree.directories,...(workspaces.length?{editableWorkspacePaths:workspaces}:{})});
      }
      references.push({location,kind,originalPath:resolve(named),...(resolve(named)!==path?{resolvedPath:path}:{}),...(expected??{})});
    };
    for(const row of priorRelocations){assertNotDependencyReference(row.relocatedPath,'trusted_prior_relocation');references.push({location:'trusted_prior_relocation',kind:row.kind,originalPath:row.originalPath,resolvedPath:row.relocatedPath,...(row.kind==='file'?{sha256:row.sha256,bytes:row.bytes}:{})});}
    const scanned=new Set<string>();
    // Unsigned preview inputs are archived data, not persisted Runtime bindings. Classify the
    // input slot through existing execution evidence, never a filename or fixture ID prefix.
    // Old reports do not sign the input data digest; this grants no trust to that data's contents.
    const evidenceRoot=join(source,'authoring-evidence'),fixtureInputs=new Map<string,unknown>();
    const records=(table:string)=>state.rows[table].map(row=>({id:String(row.id),value:JSON.parse(String(row.value_json)) as Record<string,unknown>}));
    const attempts=records('authoring_attempts'),buildReceipts=records('build_receipts'),previewReceipts=records('preview_receipts');
    const isObject=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
    const signedReport=(reference:unknown):Record<string,unknown>|undefined=>{
      if(!isObject(reference)||typeof reference.path!=='string'||typeof reference.sha256!=='string'||!Number.isSafeInteger(reference.bytes)||Number(reference.bytes)<0)return;
      const path=mappedPath(reference.path);if(dirname(path)!==evidenceRoot||!path.endsWith('.json'))return;
      const bytes=readFileSync(safeExisting(path));if(bytes.length!==reference.bytes||hash(bytes)!==reference.sha256)throw new Error('BACKUP_REFERENCE_HASH_MISMATCH');
      const envelope=JSON.parse(bytes.toString('utf8'));if(!isObject(envelope)||!('report' in envelope)&&!('signature' in envelope))return;
      const key=readFileSync(safeExisting(join(evidenceRoot,'.runner-key')));
      if(!isObject(envelope.report)||key.length!==32||typeof envelope.signature!=='string'||createHmac('sha256',key).update(canonicalJson(envelope.report)).digest('hex')!==envelope.signature)throw new Error('BACKUP_RUNNER_ATTESTATION_INVALID');
      return envelope.report;
    };
    if(existsSync(evidenceRoot))for(const file of readdirSync(evidenceRoot,{withFileTypes:true})){
      if(!file.isFile()||!file.name.endsWith('.json'))continue;
      const path=join(evidenceRoot,file.name);let value:unknown;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{continue;}
      if(isObject(value)&&!('report' in value)&&!('signature' in value))fixtureInputs.set(path,value);
    }
    const fixtureData=new Set<string>(),fixtureRequests=new Set<string>();
    const fixturePacket=(value:unknown):value is Record<string,unknown>=>isObject(value)&&typeof value.viewId==='string'&&Boolean(value.viewId)&&Array.isArray(value.bindings)&&value.bindings.every(binding=>isObject(binding)&&['bindingId','appId','connectionId','datasetId','revision'].every(key=>typeof binding[key]==='string'&&Boolean(binding[key]))&&Object.hasOwn(binding,'payload'));
    for(const [path,input]of fixtureInputs){
      if(!isObject(input)||input.mode!=='fixture'||typeof input.attemptId!=='string'||typeof input.buildReceiptId!=='string'||!Number.isSafeInteger(input.epoch)||Number(input.epoch)<1||typeof input.evidenceRoot!=='string'||mappedPath(input.evidenceRoot)!==evidenceRoot||typeof input.archiveRoot!=='string'||mappedPath(input.archiveRoot)!==join(source,'source-components')||!fixturePacket(input.data))continue;
      const attempt=attempts.find(row=>row.id===input.attemptId&&row.value.attemptId===input.attemptId)?.value;
      const buildReceipt=buildReceipts.find(row=>row.id===input.buildReceiptId&&row.value.receiptId===input.buildReceiptId)?.value;
      const previewReceipt=previewReceipts.find(row=>row.id===attempt?.previewReceiptId&&row.value.receiptId===attempt?.previewReceiptId)?.value;
      if(!attempt||attempt.epoch!==input.epoch||attempt.buildReceiptId!==input.buildReceiptId||!Array.isArray(attempt.evidenceRefs)||!buildReceipt||buildReceipt.attemptId!==input.attemptId||!previewReceipt||previewReceipt.attemptId!==input.attemptId||previewReceipt.buildReceiptId!==input.buildReceiptId||previewReceipt.mode!=='fixture'||previewReceipt.protocol!=='dsh.apps.component.v2'||previewReceipt.runnerVersion!=='dsh-authoring-preview/1')continue;
      const buildRef=input.buildReportRef;
      if(!isObject(buildRef)||typeof buildRef.path!=='string'||!attempt.evidenceRefs.some(ref=>isObject(ref)&&typeof ref.path==='string'&&mappedPath(ref.path)===mappedPath(buildRef.path as string)&&ref.sha256===buildRef.sha256&&ref.bytes===buildRef.bytes))continue;
      const build=signedReport(buildRef);
      if(!build||build.runnerVersion!=='dsh-authoring-build/1'||build.attemptId!==input.attemptId||build.epoch!==input.epoch||build.archiveBuildId!==buildReceipt.archiveBuildId||build.verdict!=='PASS'||previewReceipt.buildId!==build.archiveBuildId)continue;
      const witnessed=attempt.evidenceRefs.some(ref=>{
        const preview=signedReport(ref);return preview?.runnerVersion==='dsh-authoring-preview/1'&&preview.protocol==='dsh.apps.component.v2'&&preview.mode==='fixture'&&preview.attemptId===input.attemptId&&preview.epoch===input.epoch&&preview.buildReceiptId===input.buildReceiptId&&preview.buildId===build.archiveBuildId&&preview.verdict===previewReceipt.verdict;
      });
      if(witnessed){fixtureRequests.add(path);fixtureData.add(canonicalJson(input.data));}
    }
    const scan=(value:unknown,location:string,key='',parent?:Record<string,unknown>,fixtureBindings:WeakSet<Record<string,unknown>>=new WeakSet()):void=>{
      if(typeof value==='string'){
        if(buildKeys.has(key)){if(!/^[a-f0-9]{64}$/.test(value))throw new Error(`BACKUP_BUILD_REFERENCE_INVALID: ${location}`);builds.add(value);references.push({location,kind:'build',targetId:value});}
        if(key==='datasetId'&&(!parent||!fixtureBindings.has(parent)||value.includes(':'))){datasets.add(value);references.push({location,kind:'dataset',targetId:value});}
        if(pathKeys.has(key)&&value){addPath(value,location,['workspacePath','cwd','directory'].includes(key)?'directory':'file');}
        else if(isAbsolute(value)&&!['originalPath','relocatedPath','sourceDirectory','targetDirectory','backupDirectory','manifestPath'].includes(key)){
          if(location.includes('.command[')){references.push({location,kind:'toolchain',originalPath:value});}
          else if(key==='path'&&parent&&typeof parent.sha256==='string'&&typeof parent.bytes==='number'){
            if(!/^[a-f0-9]{64}$/.test(parent.sha256)||!Number.isSafeInteger(parent.bytes)||parent.bytes<0)throw new Error('BACKUP_REFERENCE_INVALID');
            addPath(value,location,'file',{sha256:parent.sha256,bytes:parent.bytes});
          }else if(roots.some(root=>inside(root.originalPath,mappedPath(value)))){addPath(value,location,lstatSync(actualPath(value,location)).isDirectory()?'directory':'file');}
          else if(/^[a-z]:[\\/]|^\\\\/i.test(value)||existsSync(value))throw new Error(`BACKUP_UNKNOWN_EXTERNAL_REFERENCE: ${location}`);
          // Literal HTTP endpoint paths such as /api/products are not filesystem assets.
        }
        return;
      }
      if(Array.isArray(value)){value.forEach((item,index)=>scan(item,`${location}[${index}]`,key,undefined,fixtureBindings));return;}
      if(!value||typeof value!=='object')return;const object=value as Record<string,unknown>;
      if(typeof object.targetKind==='string'){
        if(object.targetKind==='build'&&typeof object.targetId==='string')scan(object.targetId,location+'.targetId','buildId');
        else if(object.targetKind==='dataset'&&typeof object.targetId==='string')scan(object.targetId,location+'.targetId','datasetId');
        else if(location.startsWith('artifact_refs.')&&!['file','build','dataset'].includes(object.targetKind))throw new Error('BACKUP_UNKNOWN_ARTIFACT_REFERENCE');
      }
      for(const [field,item] of Object.entries(object))scan(item,`${location}.${field}`,field,object,fixtureBindings);
    };
    for(const [table,rows] of Object.entries(state.rows))for(const row of rows){
      const value=JSON.parse(String(row.value_json));
      // Relocation entries describe prior roots, not new source assets. Their trusted local manifest is still copied in full.
      if(table==='provider_records'&&value.namespace==='evidence_relocations')continue;
      scan(value,`${table}.${row.id}`);
    }
    // Reports can contain references that were not flattened into DB artifact_refs; include and validate them too.
    for(let index=0;index<roots.length;index++){
      const root=roots[index];for(const file of rootInventory(root).files){
        if(!file.relativePath.endsWith('.json'))continue;const full=join(root.originalPath,file.relativePath);if(scanned.has(full))continue;scanned.add(full);
        let value:unknown;try{value=JSON.parse(readFileSync(full,'utf8'));}catch{continue;}
        // Archived source JSON is ordinary application source, not an authority for adding arbitrary external roots.
        if(file.relativePath.includes('/project/')||root.rootId!=='runtime')continue;
        // Earlier immutable backup manifests describe earlier roots; live relocation rows above authenticate their aliases.
        if(file.relativePath.startsWith('.restore/')&&value&&typeof value==='object'&&'formatVersion' in value&&'databaseFingerprint' in value)continue;
        if(value&&typeof value==='object'&&'report' in value&&'signature' in value){
          const envelope=value as {report:unknown;signature:unknown},keyPath=join(dirname(full),'.runner-key'),key=readFileSync(safeExisting(keyPath));
          if(key.length!==32||typeof envelope.signature!=='string'||createHmac('sha256',key).update(canonicalJson(envelope.report)).digest('hex')!==envelope.signature)throw new Error('BACKUP_RUNNER_ATTESTATION_INVALID');
          references.push({location:`file:${full}.runnerKey`,kind:'file',originalPath:keyPath,sha256:hash(key),bytes:key.length});
        }
        const fixture=fixtureRequests.has(full)&&isObject(value)?value.data:fixtureInputs.has(full)&&fixtureData.has(canonicalJson(value))?value:undefined;
        // Authorize exact parsed binding objects, not display paths that JSON field names can collide with.
        const fixtureBindings=new WeakSet<Record<string,unknown>>();
        if(isObject(fixture)&&Array.isArray(fixture.bindings))fixture.bindings.forEach(binding=>{if(isObject(binding))fixtureBindings.add(binding);});
        scan(value,`file:${full}`,'',undefined,fixtureBindings);
      }
    }
    const sources=new SourceComponentStore(join(source,'source-components'));
    for(const id of builds){const result=sources.verify(id);if(!result.valid)throw new Error(`BACKUP_BUILD_INCOMPLETE: ${id}: ${result.errors.join(',')}`);}
    for(const id of datasets)if(!state.rows.datasets.some(row=>row.id===id))throw new Error(`BACKUP_DATASET_REFERENCE_MISSING: ${id}`);
    // Collapse nested external roots: copy every actual file once, while directory references retain their original absolute identities.
    const filtered=roots.filter(root=>root.rootId==='runtime'||!roots.some(other=>other!==root&&inside(other.originalPath,root.originalPath)));
    for(const root of filtered){newSeparateDirectory(root.originalPath,destination);root.directories=rootInventory(root).directories;}
    const files:BackupFile[]=[],excluded:RuntimeBackupPlan['excluded']=[];
    for(const root of filtered){const tree=rootInventory(root);excluded.push(...tree.excluded);for(const file of tree.files){
      const originalPath=join(root.originalPath,file.relativePath);
      if(root.rootId==='runtime'&&file.relativePath==='runtime-writer.json'){excluded.push({path:originalPath,reason:'Process ownership lease is not restored.'});continue;}
      const prefix=root.rootId==='runtime'&&sqliteNames.includes(file.relativePath)?'sqlite-input':root.backupPrefix;
      files.push({path:`${prefix}/${file.relativePath}`,originalPath,bytes:file.bytes,sha256:file.sha256,mode:file.mode,rootId:root.rootId});
    }}
    const sourceFingerprint=physicalFingerprint(filtered);
    // Include the first DB inventory in the consistency check, before opening any private SQLite copy.
    for(const [path,tree] of initialTrees)if(hash(canonicalJson(tree))!==hash(canonicalJson(inventory(path,[...editableWorkspacePaths].filter(workspace=>inside(path,workspace))))))throw new Error('SOURCE_CHANGED_DURING_BACKUP');
    const backupId=`runtime-backup:${hash(canonicalJson({sourceFingerprint,databaseFingerprint:state.fingerprint,files,references}))}`;
    const plan:RuntimeBackupPlan={formatVersion:1,schemaVersion:4,backupId,sourceDirectory:source,backupDirectory:destination,createdAt:new Date().toISOString(),sourceFingerprint,databaseFingerprint:state.fingerprint,counts:state.counts,roots:filtered,files,references,excluded,dryRun:true};
    assertOffline(source,true);
    return {plan,rows:state.rows,scratch,database,dispose(){database!.close();rmSync(scratch,{recursive:true,force:true});}};
  }catch(error){database?.close();rmSync(scratch,{recursive:true,force:true});throw error;}
}
export function runtimeBackupDryRun(options:RuntimeBackupOptions):RuntimeBackupPlan {
  const inspected=inspectSource(options);try{return inspected.plan;}finally{inspected.dispose();}
}
export async function backupRuntime(options:RuntimeBackupOptions):Promise<RuntimeBackupManifest> {
  const inspected=inspectSource(options),plan=inspected.plan;
  try {
    mkdirSync(plan.backupDirectory,{mode:0o700});
    for(const root of plan.roots)for(const dir of root.directories)mkdirSync(dir?archivePath(plan.backupDirectory,`${root.backupPrefix}/${dir}`):join(plan.backupDirectory,root.backupPrefix),{recursive:true,mode:0o700});
    for(const file of plan.files)copyChecked(file.originalPath,archivePath(plan.backupDirectory,file.path),file);
    const normalized=join(plan.backupDirectory,'runtime','apps.db');await backup(inspected.database,normalized);
    // The copied source can be WAL mode. Normalize the output to a standalone DB before hashing it.
    const db=new DatabaseSync(normalized);try{if(databaseState(db).fingerprint!==plan.databaseFingerprint)throw new Error('BACKUP_LOGICAL_MISMATCH');db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');}finally{db.close();}
    const bytes=readFileSync(normalized),manifest:RuntimeBackupManifest={...plan,dryRun:false,database:{path:'runtime/apps.db',bytes:bytes.length,sha256:hash(bytes)}};
    assertOffline(plan.sourceDirectory,true);if(physicalFingerprint(plan.roots)!==plan.sourceFingerprint)throw new Error('SOURCE_CHANGED_DURING_BACKUP');
    const payload=JSON.stringify(manifest,null,2);writeFileSync(join(plan.backupDirectory,'manifest.json'),payload,{flag:'wx',mode:0o600});writeFileSync(join(plan.backupDirectory,'manifest.sha256'),hash(payload)+'\n',{flag:'wx',mode:0o600});
    verifyRuntimeBackup(plan.backupDirectory);return manifest;
  }catch(error){
    // A partial directory remains visible for examination and can never be mistaken for a complete verified backup.
    if(existsSync(plan.backupDirectory)&&!existsSync(join(plan.backupDirectory,'manifest.json')))writeFileSync(join(plan.backupDirectory,'INCOMPLETE.json'),JSON.stringify({backupId:plan.backupId,error:error instanceof Error?error.message:String(error)}),{flag:'wx',mode:0o600});
    throw error;
  }finally{inspected.dispose();}
}
export function verifyRuntimeBackup(directory:string):RuntimeBackupManifest {
  const root=safeExisting(directory),manifestPath=join(root,'manifest.json'),payload=readFileSync(manifestPath),expected=readFileSync(join(root,'manifest.sha256'),'utf8').trim();
  if(!/^[a-f0-9]{64}$/.test(expected)||hash(payload)!==expected)throw new Error('BACKUP_MANIFEST_HASH_MISMATCH');
  const manifest=JSON.parse(payload.toString('utf8')) as RuntimeBackupManifest;
  if(manifest.formatVersion!==1||manifest.schemaVersion!==4||manifest.dryRun!==false||manifest.database?.path!=='runtime/apps.db'||!Array.isArray(manifest.files)||!Array.isArray(manifest.roots)||!Array.isArray(manifest.references)||!Array.isArray(manifest.excluded))throw new Error('BACKUP_MANIFEST_INVALID');
  const rootIds=new Set<string>();for(const mapping of manifest.roots){
    if(!isAbsolute(mapping.originalPath)||!/^runtime$|^workspace-[a-f0-9]{24}$/.test(mapping.rootId)||rootIds.has(mapping.rootId)||!Array.isArray(mapping.directories)||mapping.backupPrefix!==(mapping.rootId==='runtime'?'runtime':`external/${mapping.rootId}`)||mapping.restorePrefix!==(mapping.rootId==='runtime'?'':`restored-workspaces/${mapping.rootId}`))throw new Error('BACKUP_ROOT_INVALID');rootIds.add(mapping.rootId);
    if(mapping.rootId==='runtime'&&resolve(mapping.originalPath)!==resolve(manifest.sourceDirectory))throw new Error('BACKUP_ROOT_INVALID');
    if(mapping.editableWorkspacePaths!==undefined&&(!Array.isArray(mapping.editableWorkspacePaths)||mapping.editableWorkspacePaths.some(path=>typeof path!=='string'||!isAbsolute(path)||!inside(mapping.originalPath,path)||mapping.rootId==='runtime'&&!controlledRuntimeWorkspace(mapping.originalPath,path))||new Set(mapping.editableWorkspacePaths).size!==mapping.editableWorkspacePaths.length))throw new Error('BACKUP_ROOT_INVALID');
    if(mapping.editableWorkspacePaths?.some(path=>dependencyCache(path,mapping.editableWorkspacePaths!.filter(other=>other!==path))))throw new Error('BACKUP_ROOT_INVALID');
    if(mapping.directories.some(dir=>dependencyCache(resolve(mapping.originalPath,dir),mapping.editableWorkspacePaths??[])))throw new Error('BACKUP_DEPENDENCY_REFERENCE_EXCLUDED: manifest directory');
  }
  if(!rootIds.has('runtime'))throw new Error('BACKUP_ROOT_INVALID');
  const editableWorkspaces=manifest.roots.flatMap(mapping=>mapping.editableWorkspacePaths??[]);
  const assertRetainedPath=(path:string|undefined):void=>{if(path&&dependencyCache(path,editableWorkspaces))throw new Error('BACKUP_DEPENDENCY_REFERENCE_EXCLUDED: manifest reference');};
  const excludedPaths=new Set<string>();for(const excluded of manifest.excluded){
    if(!excluded||typeof excluded.path!=='string'||!isAbsolute(excluded.path)||excludedPaths.has(excluded.path))throw new Error('BACKUP_EXCLUSION_INVALID');excludedPaths.add(excluded.path);
    const lease=excluded.path===join(manifest.sourceDirectory,'runtime-writer.json')&&excluded.reason==='Process ownership lease is not restored.';
    const cache=excluded.path.split(/[\\/]/).at(-1)==='node_modules'&&dependencyCache(excluded.path,editableWorkspaces)&&excluded.reason===dependencyCacheReason;
    if(!lease&&!cache)throw new Error('BACKUP_EXCLUSION_INVALID');
  }
  const paths=new Set<string>();for(const file of [...manifest.files,manifest.database]){
    if(paths.has(file.path))throw new Error('BACKUP_MANIFEST_DUPLICATE_PATH');paths.add(file.path);
    if(!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('BACKUP_FILE_INVALID');
    const path=archivePath(root,file.path),bytes=readFileSync(path);if(bytes.length!==file.bytes||hash(bytes)!==file.sha256)throw new Error('BACKUP_HASH_MISMATCH');
  }
  for(const file of inventory(root).files)if(!paths.has(file.relativePath)&&!['manifest.json','manifest.sha256'].includes(file.relativePath))throw new Error('BACKUP_UNMANIFESTED_FILE');
  for(const mapping of manifest.roots)for(const dir of mapping.directories){const path=dir?archivePath(root,`${mapping.backupPrefix}/${dir}`):archivePath(root,mapping.backupPrefix);if(!lstatSync(path).isDirectory())throw new Error('BACKUP_DIRECTORY_MISSING');}
  const originals=new Map<string,BackupFile>();for(const file of manifest.files){
    assertRetainedPath(file.originalPath);
    const mapping=manifest.roots.find(mapping=>mapping.rootId===file.rootId);if(!mapping||!inside(mapping.originalPath,file.originalPath)||!Number.isSafeInteger(file.mode)||file.mode<0||file.mode>0o777)throw new Error('BACKUP_FILE_ROOT_INVALID');
    const suffix=relative(mapping.originalPath,file.originalPath).split(sep).join('/'),prefix=mapping.rootId==='runtime'&&sqliteNames.includes(suffix)?'sqlite-input':mapping.backupPrefix;
    if(file.path!==`${prefix}/${suffix}`||originals.has(file.originalPath))throw new Error('BACKUP_FILE_ROOT_INVALID');originals.set(file.originalPath,file);
  }
  for(const reference of manifest.references){
    if(reference.kind==='file'||reference.kind==='directory')assertRetainedPath(reference.resolvedPath??reference.originalPath);
    if(reference.kind==='file'){const file=originals.get(reference.resolvedPath??reference.originalPath??'');if(!file||reference.sha256!==undefined&&(file.sha256!==reference.sha256||file.bytes!==reference.bytes))throw new Error('BACKUP_REFERENCE_MANIFEST_MISMATCH');}
    else if(reference.kind==='directory'&&!manifest.roots.some(mapping=>inside(mapping.originalPath,reference.resolvedPath??reference.originalPath??'')))throw new Error('BACKUP_REFERENCE_MANIFEST_MISMATCH');
    else if(!['file','directory','build','dataset','toolchain'].includes(reference.kind))throw new Error('BACKUP_UNKNOWN_ARTIFACT_REFERENCE');
  }
  // Verify a copied DB, since opening the backup itself may create WAL/SHM files beside the immutable manifest.
  const scratch=mkdtempSync(join(tmpdir(),'apps-backup-verify-'));
  try {copyChecked(archivePath(root,manifest.database.path),join(scratch,'apps.db'),manifest.database);const db=new DatabaseSync(join(scratch,'apps.db'),{readOnly:true});try{const state=databaseState(db);if(state.fingerprint!==manifest.databaseFingerprint||canonicalJson(state.counts)!==canonicalJson(manifest.counts))throw new Error('BACKUP_LOGICAL_MISMATCH');}finally{db.close();}}finally{rmSync(scratch,{recursive:true,force:true});}
  return manifest;
}
/** Restore into a new directory; old signed reports/receipts and their absolute path strings are never edited. */
export function restoreRuntimeBackup(options:{backupDirectory:string;targetDirectory:string}):RuntimeRestoreReport {
  const backupRoot=safeExisting(options.backupDirectory),manifest=verifyRuntimeBackup(backupRoot),target=resolve(options.targetDirectory);
  newSeparateDirectory(backupRoot,target);newSeparateDirectory(manifest.sourceDirectory,target);
  for(const root of manifest.roots)newSeparateDirectory(root.originalPath,target);
  const manifestBytes=readFileSync(join(backupRoot,'manifest.json')),manifestSha256=hash(manifestBytes);
  const alreadyHasAnchor=manifest.files.some(file=>file.path==='runtime/.restore/runtime-backup-manifest.json');
  const manifestPath=join(target,'.restore',alreadyHasAnchor?`runtime-backup-manifest-${manifestSha256}.json`:'runtime-backup-manifest.json');
  const relocations:EvidenceRelocation[]=[],relocated=(originalPath:string)=>{
    const root=[...manifest.roots].sort((a,b)=>b.originalPath.length-a.originalPath.length).find(root=>inside(root.originalPath,originalPath));if(!root)throw new Error('BACKUP_RELOCATION_ROOT_MISSING');
    const suffix=relative(root.originalPath,originalPath).split(sep).join('/'),prefix=root.restorePrefix;
    const path=resolve(target,prefix,...(suffix?suffix.split('/'):[]));if(!inside(target,path))throw new Error('BACKUP_RESTORE_PATH_INVALID');return path;
  };
  mkdirSync(target,{mode:0o700});
  try {
    for(const root of manifest.roots)for(const dir of root.directories){const path=resolve(target,root.restorePrefix,...(dir?dir.split('/'):[]));if(!inside(target,path))throw new Error('BACKUP_RESTORE_PATH_INVALID');mkdirSync(path,{recursive:true,mode:0o700});}
    for(const file of manifest.files){
      if(file.path.startsWith('sqlite-input/'))continue;
      const to=relocated(file.originalPath);copyChecked(archivePath(backupRoot,file.path),to,file);
      relocations.push({appId:'apps',connectionId:'presentation',namespace:'evidence_relocations',backupId:manifest.backupId,kind:'file',originalPath:file.originalPath,relocatedPath:to,bytes:file.bytes,sha256:file.sha256,manifestPath,manifestSha256});
    }
    for(const root of manifest.roots)for(const dir of root.directories){const originalPath=resolve(root.originalPath,...(dir?dir.split('/'):[]));relocations.push({appId:'apps',connectionId:'presentation',namespace:'evidence_relocations',backupId:manifest.backupId,kind:'directory',originalPath,relocatedPath:relocated(originalPath),manifestPath,manifestSha256});}
    const seen=new Set(relocations.map(row=>canonicalJson([row.kind,row.originalPath])));
    for(const reference of manifest.references){if(!reference.resolvedPath||!reference.originalPath||!['file','directory'].includes(reference.kind))continue;const identity=canonicalJson([reference.kind,reference.originalPath]);if(seen.has(identity))continue;seen.add(identity);relocations.push({appId:'apps',connectionId:'presentation',namespace:'evidence_relocations',backupId:manifest.backupId,kind:reference.kind as 'file'|'directory',originalPath:reference.originalPath,relocatedPath:relocated(reference.resolvedPath),...(reference.kind==='file'?{bytes:reference.bytes,sha256:reference.sha256}:{}),manifestPath,manifestSha256});}
    copyChecked(archivePath(backupRoot,manifest.database.path),join(target,'apps.db'),manifest.database);
    mkdirSync(dirname(manifestPath),{recursive:true});writeFileSync(manifestPath,manifestBytes,{flag:'wx',mode:0o600});
    const db=new DatabaseSync(join(target,'apps.db'));
    try {
      const original=databaseState(db);if(original.fingerprint!==manifest.databaseFingerprint)throw new Error('RESTORE_LOGICAL_MISMATCH');
      const timestamp=new Date().toISOString();db.exec('BEGIN IMMEDIATE');
      const relocationIds=new Set<string>();try {const insert=db.prepare('INSERT INTO provider_records(id,value_json,created_at,updated_at) VALUES(?,?,?,?)');for(const item of relocations){const id=`evidence_relocations:${hash(canonicalJson([manifest.backupId,item.kind,item.originalPath]))}`;relocationIds.add(id);insert.run(id,JSON.stringify(item),timestamp,timestamp);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
      const after=databaseState(db);for(const table of RUNTIME_COLLECTIONS){const originalRows=table==='provider_records'?after.rows[table].filter(row=>!relocationIds.has(String(row.id))):after.rows[table];if(canonicalJson(originalRows)!==canonicalJson(original.rows[table]))throw new Error('RESTORE_ORIGINAL_EVIDENCE_CHANGED');}
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    }finally{db.close();}
    const report:RuntimeRestoreReport={backupId:manifest.backupId,schemaVersion:4,sourceDirectory:manifest.sourceDirectory,targetDirectory:target,restoredAt:new Date().toISOString(),originalDatabaseFingerprint:manifest.databaseFingerprint,originalCounts:manifest.counts,relocationCount:relocations.length,manifestPath,manifestSha256,originalEvidenceUnchanged:true,status:'restored'};
    const reportPath=join(target,'.restore',existsSync(join(target,'.restore','restore-report.json'))?`restore-report-${manifestSha256}.json`:'restore-report.json');writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});return report;
  }catch(error){writeFileSync(join(target,'.restore-incomplete.json'),JSON.stringify({backupId:manifest.backupId,error:error instanceof Error?error.message:String(error)}),{flag:'wx',mode:0o600});throw error;}
}
