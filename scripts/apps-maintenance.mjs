import { DatabaseSync } from 'node:sqlite';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { RuntimeStore,RUNTIME_COLLECTIONS,RUNTIME_V3_COLLECTIONS } from '../packages/app-runtime/src/store.ts';
import { RuntimeWriterLease } from '../packages/app-runtime/src/lease.ts';
import { gcDryRun,applyGC,rollbackBaseline,assessRollback,validateCutoverEvidence } from '../packages/app-migration/src/maintenance.ts';
import {writeCutoverAdmission} from '../packages/service/src/cutover-admission.ts';
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: node scripts/apps-maintenance.mjs --directory <runtime-directory> --mode gc|baseline|rollback|cutover [--output <new-report.json>] [--plan <gc-plan.json> --apply] [--baseline <baseline.json> --cutover-at <ISO>] [--evidence <cutover-evidence.json>]\nDatabase checks use a read-only schema-3/4 connection. cutover first freezes target admission, then records approval or refusal (exit 2). rollback freezes admission before exporting deltas; original operation inspection stays available. GC apply requires an unchanged reviewed plan and no active Runtime writer. No command stops services, drains in-flight work or reverses external business.');
}else{
 const options={};for(let index=0;index<args.length;index++){const key=args[index];if(key==='--apply')options[key]=true;else{if(!['--directory','--mode','--output','--plan','--baseline','--cutover-at','--evidence'].includes(key)||!args[index+1]||args[index+1].startsWith('--')||Object.hasOwn(options,key))throw new Error('INVALID_ARGUMENT');options[key]=args[++index];}}
 if(!options['--directory']||!['gc','baseline','rollback','cutover'].includes(options['--mode']))throw new Error('DIRECTORY_AND_MODE_REQUIRED');
 const directory=resolve(options['--directory']),path=join(directory,'apps.db');if(!existsSync(path))throw new Error('RUNTIME_DATABASE_REQUIRED');
 let lease,controlLease,store,db;try{
  if(['cutover','rollback'].includes(options['--mode'])){controlLease=new RuntimeWriterLease(join(directory,'cutover-control'));writeCutoverAdmission(directory,{allowed:false,reasons:[options['--mode']==='cutover'?'CUTOVER_CHECK_IN_PROGRESS':'ROLLBACK_FREEZE_REQUIRED']});}
  if(options['--apply']){if(options['--mode']!=='gc'||!options['--plan'])throw new Error('GC_REVIEWED_PLAN_REQUIRED');lease=new RuntimeWriterLease(directory);const probe=new DatabaseSync(path,{readOnly:true});let schemaVersion;try{schemaVersion=Number(probe.prepare('PRAGMA user_version').get().user_version);}finally{probe.close();}if(![3,4].includes(schemaVersion))throw new Error('SCHEMA_3_OR_4_REQUIRED');store=new RuntimeStore(path,{schemaVersion});}
  else{db=new DatabaseSync(path,{readOnly:true});const schemaVersion=Number(db.prepare('PRAGMA user_version').get().user_version);if(![3,4].includes(schemaVersion))throw new Error('SCHEMA_3_OR_4_REQUIRED');db.exec('BEGIN');const collections=schemaVersion===3?RUNTIME_V3_COLLECTIONS:RUNTIME_COLLECTIONS;store={collections,list:table=>{if(!collections.includes(table))throw new Error('READ_COLLECTION_INVALID');return db.prepare(`SELECT value_json FROM ${table} ORDER BY id`).all().map(row=>JSON.parse(row.value_json));}};}
  let result;
  if(options['--mode']==='gc'){if(options['--apply']){const plan=JSON.parse(readFileSync(options['--plan'],'utf8'));if(resolve(plan.root)!==directory)throw new Error('GC_PLAN_DIRECTORY_MISMATCH');result=applyGC(store,plan);}else result=gcDryRun(store,directory);}
  else if(options['--mode']==='baseline')result=rollbackBaseline(store);
  else if(options['--mode']==='rollback'){if(!options['--baseline']||!options['--cutover-at'])throw new Error('ROLLBACK_BASELINE_AND_CUTOVER_REQUIRED');result=assessRollback(store,JSON.parse(readFileSync(options['--baseline'],'utf8')),options['--cutover-at']);}
  else{if(!options['--evidence'])throw new Error('CUTOVER_EVIDENCE_REQUIRED');result=validateCutoverEvidence(JSON.parse(readFileSync(options['--evidence'],'utf8')));const unresolved=store.list('operations').filter(row=>['queued','dispatching','pending','unknown'].includes(row.state));if(unresolved.length&&!result.reasons.includes('UNRESOLVED_OPERATIONS'))result={allowed:false,reasons:[...result.reasons,'UNRESOLVED_OPERATIONS']};if(!result.allowed)process.exitCode=2;}
  if(options['--output'])writeFileSync(resolve(options['--output']),JSON.stringify(result,null,2),{flag:'wx'});
  if(options['--mode']==='cutover')writeCutoverAdmission(directory,result);
  console.log(JSON.stringify(result,null,2));
 }finally{store?.close?.();db?.close();lease?.release();controlLease?.release();}
}
