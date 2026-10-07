import {backup, DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync} from 'node:fs';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {canonicalJson} from '../../app-contracts/src/index.ts';
import {AUTHORING_COLLECTIONS, RUNTIME_V3_COLLECTIONS} from '../../app-runtime/src/store.ts';
import {RuntimeWriterLease} from '../../app-runtime/src/lease.ts';

const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export interface Schema4MigrationOptions {sourceDirectory:string;targetDirectory:string;offlineConfirmed:boolean}
interface Asset {path:string;bytes:number;sha256:string}
export interface Schema4MigrationReport {
  migrationId:string;sourceSchemaVersion:3;targetSchemaVersion:4;sourceDirectory:string;targetDirectory:string;
  sourceFingerprint:string;counts:Record<string,number>;files:Asset[];dryRun:boolean;status:'ready'|'migrated';
  executedAt:string;backupDirectory?:string;writerOwnerId?:string;legacyValidationStatus:'legacy_unverified';
}
function assertOffline(options:Schema4MigrationOptions):{source:string;target:string} {
  if(!options.offlineConfirmed)throw new Error('OFFLINE_CONFIRMATION_REQUIRED');
  const source=realpathSync(options.sourceDirectory),target=resolve(options.targetDirectory),rel=relative(source,target);
  if(!rel||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))throw new Error('SEPARATE_MIGRATION_TARGET_REQUIRED');
  const lease=join(source,'runtime-writer.json');
  if(existsSync(lease)){
    const owner=JSON.parse(readFileSync(lease,'utf8'));
    if(!Number.isSafeInteger(owner.pid)||owner.pid<1)throw new Error('WRITER_LEASE_REQUIRES_REVIEW');
    try{process.kill(owner.pid,0);throw new Error('SOURCE_WRITER_STILL_ACTIVE');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
  }
  return {source,target};
}
function readDatabase(path:string):{fingerprint:string;counts:Record<string,number>} {
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    if(Number(db.prepare('PRAGMA user_version').get()?.user_version)!==3)throw new Error('SOURCE_SCHEMA_3_REQUIRED');
    db.exec('BEGIN');
    const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));
    if(names.some(name=>!(RUNTIME_V3_COLLECTIONS as readonly string[]).includes(name))||RUNTIME_V3_COLLECTIONS.some(name=>!names.includes(name)))throw new Error('SOURCE_SCHEMA_TABLES_UNKNOWN');
    const rows=Object.fromEntries(names.map(name=>[name,db.prepare(`SELECT * FROM ${name} ORDER BY id`).all()])),counts=Object.fromEntries(names.map(name=>[name,rows[name].length]));
    const fingerprint=sha(canonicalJson(rows));db.exec('COMMIT');return {fingerprint,counts};
  }finally{db.close();}
}
function inventory(root:string,current=root):Asset[] {
  return readdirSync(current,{withFileTypes:true}).flatMap(entry=>{
    const full=join(current,entry.name),path=relative(root,full).split(sep).join('/');
    if(current===root&&['apps.db','apps.db-wal','apps.db-shm','runtime-writer.json'].includes(entry.name))return [];
    if(entry.isSymbolicLink())throw new Error('MIGRATION_ASSET_SYMLINK');
    if(entry.isDirectory())return inventory(root,full);
    if(!entry.isFile())throw new Error('MIGRATION_ASSET_TYPE_UNKNOWN');
    const bytes=readFileSync(full);return [{path,bytes:bytes.length,sha256:sha(bytes)}];
  }).sort((a,b)=>a.path.localeCompare(b.path));
}
function copyFileChecked(root:string,target:string,file:Asset):void {
  const from=join(root,file.path),to=resolve(target,file.path),rel=relative(resolve(target),to);
  if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||lstatSync(from).isSymbolicLink())throw new Error('MIGRATION_PATH_INVALID');
  const bytes=readFileSync(from);if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw new Error('SOURCE_ASSET_CHANGED');
  mkdirSync(resolve(to,'..'),{recursive:true});writeFileSync(to,bytes,{flag:'wx'});
}
export function schema4DryRun(options:Schema4MigrationOptions):Schema4MigrationReport {
  const {source,target}=assertOffline(options),database=readDatabase(join(source,'apps.db')),files=inventory(source);
  return {migrationId:`schema4:${sha(canonicalJson({fingerprint:database.fingerprint,files}))}`,sourceSchemaVersion:3,targetSchemaVersion:4,sourceDirectory:source,targetDirectory:target,sourceFingerprint:database.fingerprint,counts:database.counts,files,dryRun:true,status:'ready',executedAt:new Date().toISOString(),legacyValidationStatus:'legacy_unverified'};
}
export function verifySchema4Backup(directory:string):{database:Asset;files:Asset[];sourceFingerprint:string} {
  const root=realpathSync(directory),manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8')) as {database:Asset;files:Asset[];sourceFingerprint:string};
  for(const file of [manifest.database,...manifest.files]){
    const path=resolve(root,file.path),rel=relative(root,path);
    if(!rel||isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep)||lstatSync(path).isSymbolicLink()||!realpathSync(path).startsWith(root+sep))throw new Error('BACKUP_PATH_INVALID');
    const bytes=readFileSync(path);if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw new Error('BACKUP_HASH_MISMATCH');
  }
  if(readDatabase(join(root,manifest.database.path)).fingerprint!==manifest.sourceFingerprint)throw new Error('BACKUP_LOGICAL_MISMATCH');return manifest;
}
export async function migrateSchema4(options:Schema4MigrationOptions):Promise<Schema4MigrationReport> {
  const plan=schema4DryRun(options),source=plan.sourceDirectory,target=plan.targetDirectory;
  if(existsSync(target)){
    const reportPath=join(target,'schema4-migration-report.json');if(!existsSync(reportPath))throw new Error('MIGRATION_TARGET_ALREADY_EXISTS');
    const previous=JSON.parse(readFileSync(reportPath,'utf8')) as Schema4MigrationReport;
    if(previous.migrationId!==plan.migrationId)throw new Error('MIGRATION_INPUT_CHANGED');verifySchema4Backup(previous.backupDirectory!);return previous;
  }
  const lease=new RuntimeWriterLease(target);
  try {
    const backupRoot=join(target,'backups','schema3'),database=new DatabaseSync(join(source,'apps.db'),{readOnly:true});mkdirSync(backupRoot,{recursive:true});
    try{await backup(database,join(backupRoot,'apps.db'));}finally{database.close();}
    if(readDatabase(join(backupRoot,'apps.db')).fingerprint!==plan.sourceFingerprint)throw new Error('BACKUP_DATABASE_CHANGED');
    for(const file of plan.files)copyFileChecked(source,join(backupRoot,'assets'),file);
    const databaseBytes=readFileSync(join(backupRoot,'apps.db'));
    writeFileSync(join(backupRoot,'manifest.json'),JSON.stringify({database:{path:'apps.db',bytes:databaseBytes.length,sha256:sha(databaseBytes)},files:plan.files.map(file=>({...file,path:'assets/'+file.path})),sourceFingerprint:plan.sourceFingerprint},null,2),{flag:'wx'});
    verifySchema4Backup(backupRoot);
    for(const file of plan.files)copyFileChecked(source,target,file);
    writeFileSync(join(target,'apps.db'),databaseBytes,{flag:'wx'});
    const db=new DatabaseSync(join(target,'apps.db'));
    try {
      db.exec('BEGIN IMMEDIATE');for(const table of AUTHORING_COLLECTIONS)db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY,value_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);
      for(const row of db.prepare('SELECT id,value_json FROM views').all()){
        const view=JSON.parse(String(row.value_json)),buildId=view.source?.buildId??null;
        db.prepare('UPDATE views SET value_json=? WHERE id=?').run(JSON.stringify({...view,viewRevision:1,activeBuildId:buildId,lastGoodBuildId:buildId,previousGoodBuildId:null,pendingPublicationId:null,validationStatus:'legacy_unverified'}),String(row.id));
      }
      db.exec('PRAGMA user_version=4; COMMIT; PRAGMA wal_checkpoint(TRUNCATE);');
    }finally{db.close();}
    const again=schema4DryRun(options);if(again.migrationId!==plan.migrationId)throw new Error('SOURCE_CHANGED_DURING_MIGRATION');
    const report:Schema4MigrationReport={...plan,dryRun:false,status:'migrated',backupDirectory:backupRoot,writerOwnerId:lease.ownerId,executedAt:new Date().toISOString()};
    writeFileSync(join(target,'schema4-migration-report.json'),JSON.stringify(report,null,2),{flag:'wx'});return report;
  }finally{lease.release();}
}
/** Restore to a new directory; never overwrite either Runtime or the offline source. */
export function restoreSchema3Backup(backupDirectory:string,targetDirectory:string):void {
  const manifest=verifySchema4Backup(backupDirectory),root=realpathSync(backupDirectory),target=resolve(targetDirectory);
  if(existsSync(target))throw new Error('RESTORE_TARGET_ALREADY_EXISTS');mkdirSync(target,{recursive:true});
  copyFileChecked(root,target,manifest.database);
  for(const file of manifest.files){const path=file.path.replace(/^assets\//,'');const bytes=readFileSync(join(root,file.path));const to=join(target,path);mkdirSync(resolve(to,'..'),{recursive:true});writeFileSync(to,bytes,{flag:'wx'});}
  if(readDatabase(join(target,'apps.db')).fingerprint!==manifest.sourceFingerprint)throw new Error('RESTORE_LOGICAL_MISMATCH');
}
