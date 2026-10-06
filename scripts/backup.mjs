import {DatabaseSync} from 'node:sqlite';
import {existsSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {COLLECTIONS,SCHEMA_VERSION} from '../packages/store/index.ts';
import {defaultDataDirectory} from '../packages/service/src/server.ts';
import {assertJsonCompatible} from '../packages/contracts/src/json.ts';
function rejectCredentials(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['clientid','apikey','ozoncredentials','operatortoken','authorization','servicekey','sharedkey','hallmarkoperatortoken'].includes(key.toLowerCase().replace(/[-_]/g,'')))throw new Error('CREDENTIAL_FIELD_FORBIDDEN');rejectCredentials(item);}}
const args=process.argv.slice(2);
if(args.includes('--help')){
 console.log('Usage: npm run backup -- --output <new-backup.json> [--database <existing-app.db>]\nRead-only consistent JSON export of app-owned collections. Never exports service-key or original Hallmark credentials. Existing output is never overwritten.');
}else{
 const options={};for(let index=0;index<args.length;index+=2){const key=args[index];const value=args[index+1];if(!['--output','--database'].includes(key)||!value||Object.hasOwn(options,key))throw new Error('INVALID_BACKUP_ARGUMENTS');options[key]=value;}
 if(!options['--output'])throw new Error('BACKUP_OUTPUT_REQUIRED');
 const database=resolve(options['--database']??join(defaultDataDirectory(),'app.db'));const output=resolve(options['--output']);
 if(!existsSync(database))throw new Error('APP_DATABASE_NOT_FOUND');
 if(database.toLowerCase()===output.toLowerCase()||!output.toLowerCase().endsWith('.json')||existsSync(output))throw new Error('BACKUP_REQUIRES_NEW_JSON_OUTPUT');
 const db=new DatabaseSync(database,{readOnly:true});
 try{
  db.exec('BEGIN');
  const version=Number(db.prepare('PRAGMA user_version').get().user_version);if(version<1||version>SCHEMA_VERSION)throw new Error('UNSUPPORTED_APP_DATABASE_VERSION');
  const actual=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
  if(COLLECTIONS.some(table=>!actual.has(table)))throw new Error('NOT_AN_APP_DATABASE');
  const collections=Object.fromEntries(COLLECTIONS.map(table=>[table,db.prepare(`SELECT id,value_json FROM ${table} ORDER BY id`).all().map(row=>({id:row.id,value:JSON.parse(row.value_json)}))]));
  const backup={schemaVersion:version,exportedAt:new Date().toISOString(),collections};assertJsonCompatible(backup);rejectCredentials(backup);
  // A single SQLite read transaction gives a coherent view of concurrent WAL updates.
  db.exec('COMMIT');writeFileSync(output,JSON.stringify(backup,null,2),{encoding:'utf8',mode:0o600,flag:'wx'});console.log('App JSON backup created. The database was not migrated or modified.');
 }finally{db.close();}
}
