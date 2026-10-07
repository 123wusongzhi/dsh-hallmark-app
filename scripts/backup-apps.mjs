import {writeFileSync} from 'node:fs';
import {isAbsolute,relative,resolve,sep} from 'node:path';
import {backupRuntime,runtimeBackupDryRun,restoreRuntimeBackup,verifyRuntimeBackup} from '../packages/app-migration/src/runtime-backup.ts';

const args=process.argv.slice(2);
if(args.includes('--help')){
  console.log('Usage: node scripts/backup-apps.mjs --mode dry-run|apply --source <offline-schema4-runtime> --backup <new-backup-directory> --offline [--output <new-report.json>]\n       node scripts/backup-apps.mjs --mode restore --backup <verified-backup-directory> --target <new-runtime-directory> [--output <new-report.json>]\n       node scripts/backup-apps.mjs --mode verify --backup <backup-directory>\nOffline backup refuses active writer leases, uncontrolled symlinks, missing references, unknown schema tables and changed source files. It includes SQLite WAL, all 25 collections, Runtime assets and referenced editable workspaces. Only regenerable node_modules caches in identified editable workspaces are omitted without following links; each exclusion is recorded. Internal workspaces require explicit authoring draft/view ownership or authenticated restored workspace aliases and must remain beneath component-workspace or restored-workspaces. Immutable archives, evidence and other Runtime directories keep strict inventories. Explicit asset/evidence references into an omitted dependency cache fail. Source, dist and lockfiles are restored byte-for-byte. Registry/tarball locks with available dependencies can use npm ci or the lockfile package manager. npm file: SDK dependencies can encode relative lock paths even when package.json names an absolute SDK; relocation may make npm ci fail. Repair such dependency paths through normal npm install only in an explicit new authoring attempt, record the resulting lockfile/source digest and real build, and retain original archives, reports and receipts unchanged. Restore never overwrites an existing directory; signed evidence is preserved and trusted path relocations are added in one SQLite transaction. This command does not stop/start services, change desktop profiles or reverse external business operations. Backup directories contain private runner keys and database configuration: keep them private.');
}else{
  const options={};for(let index=0;index<args.length;index++){
    const key=args[index];if(Object.hasOwn(options,key))throw new Error('DUPLICATE_ARGUMENT');
    if(key==='--offline')options[key]=true;
    else{if(!['--mode','--source','--backup','--target','--output'].includes(key)||!args[index+1]||args[index+1].startsWith('--'))throw new Error('INVALID_ARGUMENT');options[key]=args[++index];}
  }
  if(!['dry-run','apply','restore','verify'].includes(options['--mode'])||!options['--backup'])throw new Error('MODE_AND_BACKUP_REQUIRED');
  if(options['--output'])for(const key of ['--source','--backup','--target'])if(options[key]){
    const rel=relative(resolve(options[key]),resolve(options['--output']));
    if(rel===''||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep))throw new Error('REPORT_MUST_BE_OUTSIDE_RUNTIME_AND_BACKUP');
  }
  let result;
  if(['dry-run','apply'].includes(options['--mode'])){
    if(!options['--source']||options['--target'])throw new Error('BACKUP_SOURCE_REQUIRED');
    const input={sourceDirectory:resolve(options['--source']),backupDirectory:resolve(options['--backup']),offlineConfirmed:options['--offline']===true};
    result=options['--mode']==='dry-run'?runtimeBackupDryRun(input):await backupRuntime(input);
  }else if(options['--mode']==='restore'){
    if(!options['--target']||options['--source']||options['--offline'])throw new Error('RESTORE_TARGET_REQUIRED');
    result=restoreRuntimeBackup({backupDirectory:resolve(options['--backup']),targetDirectory:resolve(options['--target'])});
  }else{
    if(options['--source']||options['--target']||options['--offline'])throw new Error('VERIFY_ARGUMENT_INVALID');
    result=verifyRuntimeBackup(resolve(options['--backup']));
  }
  // Print only the summary: full manifests may include private workspace paths/configuration provenance.
  if(options['--output'])writeFileSync(resolve(options['--output']),JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({backupId:result.backupId,schemaVersion:result.schemaVersion,mode:options['--mode'],counts:result.counts??result.originalCounts,files:result.files?.length,relocationCount:result.relocationCount,status:result.status??(result.dryRun?'ready':'verified')},null,2));
}
