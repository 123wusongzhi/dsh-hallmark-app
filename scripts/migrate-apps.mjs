import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrationDryRun,migrateOffline } from '../packages/app-migration/src/index.ts';
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: node scripts/migrate-apps.mjs --source <offline-app.db> --target <new-directory> --offline-confirmed [--source-directory <asset-root>] [--connection-file <explicit-hallmark-connection.json>] [--report <new-report.json>] [--apply]\nDefaults to read-only dry-run. Apply creates a separate schema-3 database and complete verified backup. Unknown identities, missing assets or unresolved mappings block apply. The source is never upgraded.');
}else{
 const options={};for(let index=0;index<args.length;index++){const key=args[index];if(['--apply','--offline-confirmed'].includes(key)){if(Object.hasOwn(options,key))throw new Error('DUPLICATE_ARGUMENT');options[key]=true;}else{if(!['--source','--target','--source-directory','--connection-file','--report'].includes(key)||!args[index+1]||args[index+1].startsWith('--')||Object.hasOwn(options,key))throw new Error('INVALID_ARGUMENT');options[key]=args[++index];}}
 if(!options['--source']||!options['--target'])throw new Error('SOURCE_AND_SEPARATE_TARGET_REQUIRED');
 const request={sourceDatabase:resolve(options['--source']),targetDirectory:resolve(options['--target']),offlineConfirmed:options['--offline-confirmed']===true,...(options['--source-directory']?{sourceDirectory:resolve(options['--source-directory'])}:{}),...(options['--connection-file']?{connection:JSON.parse(readFileSync(options['--connection-file'],'utf8'))}:{})};
 const report=options['--apply']?await migrateOffline(request):migrationDryRun(request);
 if(options['--report']){const file=resolve(options['--report']);if(existsSync(file))throw new Error('REPORT_ALREADY_EXISTS');writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});}
 console.log(JSON.stringify({status:report.status,dryRun:report.dryRun,migrationId:report.migrationId,counts:report.counts,assetErrors:report.assetErrors,unresolvedOperationIds:report.unresolvedOperationIds},null,2));
 if(report.status==='needs_migration')process.exitCode=2;
}
