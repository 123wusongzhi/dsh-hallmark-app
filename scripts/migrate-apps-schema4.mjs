import {schema4DryRun,migrateSchema4,restoreSchema3Backup} from '../packages/app-migration/src/schema4.ts';
const args=process.argv.slice(2),options={};
if(args.includes('--help'))console.log('node scripts/migrate-apps-schema4.mjs --source <offline-schema3-dir> --target <new-dir> --offline-confirmed [--apply]\nRestore: --restore <verified-backup-dir> --target <new-dir>');
else {
  for(let i=0;i<args.length;i++){const key=args[i];if(['--apply','--offline-confirmed'].includes(key))options[key]=true;else if(['--source','--target','--restore'].includes(key)&&args[i+1])options[key]=args[++i];else throw new Error('INVALID_ARGUMENT');}
  if(!options['--target'])throw new Error('TARGET_REQUIRED');
  if(options['--restore']){restoreSchema3Backup(options['--restore'],options['--target']);console.log(JSON.stringify({status:'restored',schemaVersion:3}));}
  else{const request={sourceDirectory:options['--source'],targetDirectory:options['--target'],offlineConfirmed:options['--offline-confirmed']===true};console.log(JSON.stringify(options['--apply']?await migrateSchema4(request):schema4DryRun(request),null,2));}
}
