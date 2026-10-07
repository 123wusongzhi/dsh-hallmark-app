import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, lstatSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { COLLECTIONS } from '../../store/index.ts';
import { RuntimeStore, RUNTIME_V3_COLLECTIONS as RUNTIME_COLLECTIONS } from '../../app-runtime/src/store.ts';
import type { RuntimeOperation } from '../../app-runtime/src/store.ts';
import type { AppConnection } from '../../app-runtime/src/index.ts';
import { RuntimeWriterLease } from '../../app-runtime/src/lease.ts';
import { canonicalJson, canonicalBinding, datasetId, compileSchema } from '../../app-contracts/src/index.ts';
import type { CapabilityResult, DatasetBinding, InvocationRequest, JsonValue } from '../../app-contracts/src/index.ts';
import { LEGACY_TOOL_MAP, HALLMARK_DESCRIPTORS } from '../../app-hallmark/src/index.ts';
import { APP_PRESENTATION_DESCRIPTORS } from '../../app-presentation/src/descriptors.ts';
import { SourceComponentStore } from '../../source-components/src/index.ts';
export * from './maintenance.ts';

type Row = {id:string;value:Record<string,any>};
export interface LegacyExport { schemaVersion:2; exportedAt:string; collections:Record<string,Row[]>; unknownTables:{table:string;count:number}[] }
export interface AssetFile { sourcePath:string;relativePath:string;bytes:number;sha256:string }
export interface MigrationOptions { sourceDatabase:string; sourceDirectory?:string; targetDirectory:string; connection?:AppConnection; offlineConfirmed:boolean; recoveryFiles?:string[] }
interface TargetWrite {collection:string;id:string;value:any}
export interface MigrationRecord { sourceCollection:string;sourceId:string;state:'mapped'|'quarantined';targets:{collection:string;id:string}[];reason?:string }
export interface MigrationReport {
 migrationId:string;sourceFingerprint:string;sourceSchemaVersion:2;targetSchemaVersion:3;dryRun:boolean;
 status:'ready'|'needs_migration'|'migrated';executedAt:string;
 sourceDatabase:string;targetDatabase:string;counts:Record<string,{source:number;mapped:number;quarantined:number}>;
 records:MigrationRecord[];assets:AssetFile[];assetErrors:string[];unresolvedOperationIds:string[];
 legacyTools:typeof LEGACY_TOOL_MAP;datasetAliases:{legacyKey:string;datasetId:string;canonicalBinding:JsonValue}[];
 backupId?:string;writerOwnerId?:string;
}
export interface BackupManifest { backupId:string;schemaVersion:2;createdAt:string;database:{path:string;bytes:number;sha256:string};logicalFingerprint:string;files:AssetFile[];verified:boolean }
const hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value),'utf8').digest('hex');
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const object=(value:unknown):value is Record<string,any>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value:unknown):any=>JSON.parse(canonicalJson(value));
const id=(...values:string[])=>canonicalJson(values);
const validateSavedEntry=compileSchema(APP_PRESENTATION_DESCRIPTORS.find(descriptor=>descriptor.capabilityId==='apps.presentation.save_entry')!.outputSchema);
const validateSavedTemplate=compileSchema(APP_PRESENTATION_DESCRIPTORS.find(descriptor=>descriptor.capabilityId==='apps.presentation.save_template')!.outputSchema);
const validateSavedComponent=compileSchema(APP_PRESENTATION_DESCRIPTORS.find(descriptor=>descriptor.capabilityId==='apps.presentation.save_component')!.outputSchema);
function requireOffline(options:MigrationOptions):void{
 if(!options.offlineConfirmed)throw new Error('OFFLINE_CONFIRMATION_REQUIRED');
 const source=realpathSync(resolve(options.sourceDatabase)),target=resolve(options.targetDirectory);
 if(source.toLowerCase()===join(target,'apps.db').toLowerCase()||resolve(dirname(source)).toLowerCase()===target.toLowerCase()||target.toLowerCase().startsWith((resolve(options.sourceDirectory??dirname(source))+sep).toLowerCase()))throw new Error('SEPARATE_TARGET_DIRECTORY_REQUIRED');
 if(existsSync(join(dirname(source),'runtime-writer.json')))throw new Error('SOURCE_WRITER_ACTIVE_OR_UNREVIEWED');
}
/** Read transaction includes committed WAL pages and never upgrades or writes the source database. */
export function exportLegacyDatabase(database:string):LegacyExport{
 const db=new DatabaseSync(resolve(database),{readOnly:true});
 try{
  db.exec('BEGIN');
  if(Number(db.prepare('PRAGMA user_version').get()?.user_version)!==2)throw new Error('LEGACY_SCHEMA_2_REQUIRED');
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>String(row.name));
  if(COLLECTIONS.some(table=>!tables.includes(table)))throw new Error('LEGACY_COLLECTION_MISSING');
  const collections=Object.fromEntries(COLLECTIONS.map(table=>[table,db.prepare(`SELECT id,value_json FROM ${table} ORDER BY id`).all().map(row=>({id:String(row.id),value:JSON.parse(String(row.value_json))}))]));
  const unknownTables=tables.filter(table=>!(COLLECTIONS as readonly string[]).includes(table)).map(table=>({table,count:Number(db.prepare(`SELECT COUNT(*) AS count FROM "${table.replaceAll('"','""')}"`).get()?.count)}));
  db.exec('COMMIT');return {schemaVersion:2,exportedAt:new Date().toISOString(),collections,unknownTables};
 }finally{db.close();}
}
function logicalFingerprint(value:LegacyExport):string{return hash({schemaVersion:value.schemaVersion,collections:value.collections,unknownTables:value.unknownTables});}
function assetInventory(snapshot:LegacyExport,options:MigrationOptions):{files:AssetFile[];errors:string[];builds:Record<string,any>} {
 const sourceRoot=realpathSync(resolve(options.sourceDirectory??dirname(options.sourceDatabase))),sourceStore=new SourceComponentStore(join(sourceRoot,'source-components')),buildIds=new Set<string>(),explicitFiles=new Set<string>();
 function inspect(value:unknown,key=''):void{if(Array.isArray(value)){for(const child of value)inspect(child,key);return;}if(!object(value))return;for(const [name,child] of Object.entries(value)){if(name==='buildId'&&typeof child==='string')buildIds.add(child);if((name==='thumbnail'||name==='screenshotPath'||name==='reportPath')&&typeof child==='string')explicitFiles.add(resolve(child));if(/spill/i.test(name)&&object(child)&&typeof child.path==='string')explicitFiles.add(resolve(child.path));inspect(child,name);}}
 for(const rows of Object.values(snapshot.collections))for(const row of rows)inspect(row.value);
 const files=new Map<string,AssetFile>(),errors:string[]=[],builds:Record<string,any>={};
 const add=(file:string):void=>{
  try{
   const path=resolve(file),rel=relative(sourceRoot,path);
   if(!rel||rel.startsWith('..'+sep)||rel==='..'||isAbsolute(rel)||lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile()||!realpathSync(path).toLowerCase().startsWith((sourceRoot+sep).toLowerCase()))throw new Error('ASSET_OUTSIDE_ROOT_OR_SYMLINK');
   const bytes=readFileSync(path),relativePath=rel.split(sep).join('/');files.set(relativePath,{sourcePath:path,relativePath,bytes:bytes.length,sha256:sha(bytes)});
  }catch(error){errors.push(`${file}: ${error instanceof Error?error.message:String(error)}`);}
 };
 const walk=(directory:string):void=>{try{for(const child of readdirSync(directory,{withFileTypes:true})){const path=join(directory,child.name);if(child.isSymbolicLink())errors.push(`${path}: ASSET_SYMLINK`);else if(child.isDirectory())walk(path);else if(child.isFile())add(path);}}catch(error){errors.push(`${directory}: ${error instanceof Error?error.message:String(error)}`);}};
 for(const buildId of buildIds){if(!/^[a-f0-9]{64}$/.test(buildId)){errors.push(`${buildId}: INVALID_BUILD_ID`);continue;}try{const manifest=sourceStore.manifest(buildId),verification=sourceStore.verify(buildId);if(!manifest||!verification.valid){errors.push(...verification.errors.map(error=>`${buildId}: ${error}`));continue;}builds[buildId]=manifest;walk(join(sourceStore.directory,'builds',buildId));}catch(error){errors.push(`${buildId}: ${error instanceof Error?error.message:String(error)}`);}}
 for(const file of explicitFiles)add(file);
 const recovery=new Set([join(sourceRoot,'pending-closures.json'),...(options.recoveryFiles??[]).map(file=>resolve(file))]);for(const file of recovery)if(existsSync(file))add(file);
 return {files:[...files.values()].sort((a,b)=>a.relativePath.localeCompare(b.relativePath)),errors,builds};
}
function closedSessions(options:MigrationOptions):Set<string>{
 const file=join(resolve(options.sourceDirectory??dirname(options.sourceDatabase)),'pending-closures.json');if(!existsSync(file))return new Set();
 const value=JSON.parse(readFileSync(file,'utf8'));if(value.version!==1||!Array.isArray(value.intents)||value.intents.some((intent:any)=>!object(intent)||typeof intent.sessionId!=='string'||!Number.isFinite(Date.parse(intent.requestedAt))))throw new Error('CLOSE_OUTBOX_NEEDS_MIGRATION');return new Set(value.intents.map((intent:any)=>intent.sessionId));
}
function planMigration(snapshot:LegacyExport,options:MigrationOptions):{report:MigrationReport;writes:TargetWrite[]}{
 const fingerprint=logicalFingerprint(snapshot),inventory=assetInventory(snapshot,options),migrationId=`migration:${hash({fingerprint,connection:options.connection??null,assets:inventory.files.map(({relativePath,sha256})=>({relativePath,sha256}))})}`,writes:TargetWrite[]=[],records:MigrationRecord[]=[],datasetAliases:MigrationReport['datasetAliases']=[],unresolvedOperationIds:string[]=[],at=snapshot.exportedAt,connection=options.connection;
 let closed=new Set<string>();try{closed=closedSessions(options);}catch(error){inventory.errors.push(error instanceof Error?error.message:String(error));}
 const put=(collection:string,recordId:string,value:unknown)=>{writes.push({collection,id:recordId,value:json(value)});return {collection,id:recordId};};
 const relocate=(value:any):any=>{if(typeof value==='string'){const file=inventory.files.find(file=>file.sourcePath===value);return file?join(resolve(options.targetDirectory),file.relativePath):value;}if(Array.isArray(value))return value.map(relocate);if(object(value))return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,relocate(child)]));return value;};
 const preserve=(collection:string,row:Row)=>put('provider_records',id('hallmark',connection!.connectionId,collection,row.id),{appId:'hallmark',connectionId:connection!.connectionId,namespace:collection,recordId:row.id,value:relocate(row.value)});
 const alias=(kind:string,legacyId:string,value:unknown)=>put('legacy_aliases',`${kind}:${legacyId}`,{legacyKind:kind,legacyId,...json(value)});
 const recipes=new Map<string,any>();for(const row of snapshot.collections.queries){recipes.set(`query:${row.id}`,row.value);if(row.value.datasetKey)recipes.set(row.value.datasetKey,row.value);}
 for(const row of snapshot.collections.snapshots)if(row.value.sourceQuery)recipes.set(row.id,row.value.sourceQuery);
 for(const row of snapshot.collections.views)if(row.value.kind==='draft-query')recipes.set(row.value.datasetKey,row.value);
 function binding(old:any,bindingId:string):DatasetBinding{
  if(!connection)throw new Error('CONNECTION_MAPPING_REQUIRED');
  let recipe=old.query??recipes.get(old.datasetKey),key=old.datasetKey;
  if(!recipe&&typeof key==='string'){
   const match=/^(store_products|profit):(.+)$/.exec(key);if(match)recipe={tool:match[1]==='profit'?'hallmark_compute_profit':'hallmark_list_store_products',params:{storeId:match[2]}};
   const operation=/^operation:(.+)$/.exec(key);if(operation)recipe={tool:'hallmark_get_operation',params:{operationId:operation[1]}};
  }
  const mapped=recipe&&LEGACY_TOOL_MAP.find(row=>row.legacyName===recipe.tool),descriptor=mapped&&HALLMARK_DESCRIPTORS.find(row=>row.capabilityId===mapped.capabilityId);
  if(!mapped||!descriptor||descriptor.effect==='mutation')throw new Error(`DATASET_RECIPE_NEEDS_MIGRATION: ${key??recipe?.tool??bindingId}`);
  const validation=compileSchema(descriptor.inputSchema)(recipe.params??{});if(validation.length)throw new Error(`LEGACY_INPUT_NEEDS_MIGRATION: ${validation.join('; ')}`);
  const result:DatasetBinding={bindingId,appId:'hallmark',connectionId:connection.connectionId,capabilityId:mapped.capabilityId,capabilityMajor:1,input:recipe.params??{},projection:[],refresh:{mode:'manual'}};result.datasetId=datasetId(result);
  if(key&&!datasetAliases.some(row=>row.legacyKey===key)){const canonical=json(canonicalBinding(result));datasetAliases.push({legacyKey:key,datasetId:result.datasetId,canonicalBinding:canonical});alias('dataset',key,{datasetId:result.datasetId,canonicalBinding:canonical,binding:result});}
  return result;
 }
 const ownerMap=new Map<string,any>();for(const row of snapshot.collections.views)if(['source-owner','component-owner'].includes(row.value.kind)&&row.value.owner)ownerMap.set(row.value.owner.viewId,row.value.owner);
 const view=(spec:any,owner?:any)=>{
  if(!object(spec)||typeof spec.id!=='string')throw new Error('VIEW_SPEC_NEEDS_MIGRATION');
  const source=spec.source?{...spec.source,...(spec.source.thumbnail?{thumbnail:join(options.targetDirectory,'source-components','builds',spec.source.buildId,'preview','screenshot.png')}:{})}:undefined;
  if(source?.preview)source.preview={...source.preview,screenshotPath:join(options.targetDirectory,'source-components','builds',source.buildId,'preview','screenshot.png'),reportPath:join(options.targetDirectory,'source-components','builds',source.buildId,'preview','report.json')};
  return {viewId:spec.id,ownerSessionId:owner?.sessionId??null,title:spec.title??'Migrated view',design:relocate(spec),bindings:(spec.bindings??[]).map((old:any)=>binding(old,old.id)),...(source?{source}:{}),createdAt:owner?.createdAt??at,updatedAt:owner?.updatedAt??at};
 };
 const reference=(ownerKind:string,ownerId:string,buildId?:string)=>buildId?put('artifact_refs',`${ownerKind}:${ownerId}:${buildId}`,{ownerKind,ownerId,targetKind:'build',targetId:buildId}):undefined;
 if(connection){if(connection.appId!=='hallmark'||!connection.connectionId||!connection.config||!connection.displayName)throw new Error('EXPLICIT_HALLMARK_CONNECTION_REQUIRED');put('connections',id(connection.appId,connection.connectionId),connection);}
 for(const table of COLLECTIONS)for(const row of snapshot.collections[table]){
  const targets:MigrationRecord['targets']=[];
  try{
   if(!connection)throw new Error('CONNECTION_MAPPING_REQUIRED');
   targets.push(preserve(table,row));
   if(table==='session_apps'){
    const sessionId=row.value.sessionId??row.value.session_id??row.id;if(typeof sessionId!=='string'||(row.value.appId??row.value.app_id??'hallmark')!=='hallmark')throw new Error('SESSION_IDENTITY_NEEDS_MIGRATION');
    targets.push(put('session_app_bindings',id(sessionId,'hallmark',connection.connectionId),{sessionId,appId:'hallmark',connectionId:connection.connectionId,enabled:!!row.value.active&&!closed.has(sessionId),boundAt:row.value.activatedAt??row.value.activated_at??at}));
   }else if(table==='operations'){
    const old=row.value,legacyName=old.kind==='platform_read'?'hallmark_get_platform_data':old.kind==='refresh'?'hallmark_refresh_data':`hallmark_${old.kind}`,mapped=LEGACY_TOOL_MAP.find(item=>item.legacyName===legacyName),capabilityId=mapped?.capabilityId??`hallmark.legacy.${String(old.kind??'unknown').replace(/[^a-zA-Z0-9_]/g,'_')}`;
    if(!old.operationId||old.operationId!==row.id||!old.kind||!['pending','running','unknown','succeeded','failed','partial'].includes(old.state))throw new Error('OPERATION_IDENTITY_NEEDS_MIGRATION');
    const state=['pending','running','unknown'].includes(old.state)?'unknown':old.state;if(state==='unknown'){unresolvedOperationIds.push(row.id);if(!mapped)throw new Error('OPERATION_CAPABILITY_NEEDS_MIGRATION');}
    const input={...(old.input??{})};delete input.fingerprint;
    const request:InvocationRequest={protocolVersion:'1.0',invocationId:`migration:${row.id}`,traceId:`migration:${row.id}`,appId:'hallmark',connectionId:connection.connectionId,capabilityId,capabilityVersion:'1.0.0',input,source:{kind:'recovery',operationId:row.id},deadlineAt:at,idempotencyKey:old.clientKey??`legacy:${row.id}`};
    const operation={operationId:row.id,state} as any,base={invocationId:request.invocationId,traceId:request.traceId,operation},error={code:old.error?.code??(state==='unknown'?'OUTCOME_UNKNOWN':'LEGACY_ERROR'),message:old.error?.message??'Imported historical operation evidence.',retryPolicy:state==='unknown'?'inspect_only':'never'};
    const legacy={...relocate(old),state,clientKey:canonicalJson(['hallmark',connection.connectionId,capabilityId,request.idempotencyKey]),diagnostics:[...(old.diagnostics??[]),{kind:'migration',originalState:old.state,migrationId}]};
    const result:CapabilityResult=state==='succeeded'?{...base,status:'ok',data:legacy}:state==='partial'?{...base,status:'partial',data:legacy,errors:[error as any]}:state==='unknown'?{...base,status:'unknown',error:error as any}:{...base,status:'failed',error:error as any};
    const value:RuntimeOperation={operationId:row.id,appId:'hallmark',connectionId:connection.connectionId,capabilityId,capabilityVersion:'1.0.0',idempotencyKey:request.idempotencyKey!,requestHash:hash({capabilityVersion:'1.0.0',input,expectedResourceRevision:null}),request,state,result,createdAt:old.createdAt??at,updatedAt:old.updatedAt??at};
    targets.push(put('operations',row.id,value),put('invocations',request.invocationId,{invocationId:request.invocationId,requestHash:hash(request),request,state:'settled',result,operationId:row.id,startedAt:value.createdAt}),put('invocation_operations',request.invocationId,{invocationId:request.invocationId,operationId:row.id}),put('operation_events',`${row.id}:1`,{operationId:row.id,sequence:1,event:'migration',at,migrationId,originalState:old.state,state}),alias('operation',row.id,{operationId:row.id}),put('provider_records',id('hallmark',connection.connectionId,'operations',row.id),{appId:'hallmark',connectionId:connection.connectionId,namespace:'operations',recordId:row.id,value:legacy}));
   }else if(table==='snapshots'){
    const old=row.value,resolved=binding({datasetKey:old.datasetKey??row.id,fieldMap:{}},'legacy');const sourceDataTime=typeof old.dataTime==='string'&&Number.isFinite(Date.parse(old.dataTime))?old.dataTime:null,provenance=[{appId:'hallmark',connectionId:connection.connectionId,sourceKind:'snapshot',sourceRef:old.provenance?.endpoint??`legacy:${row.id}`,fetchedAt:old.provenance?.fetchedAt??old.lastSuccessAt??at,sourceDataTime,freshness:'stale',...(old.metricBasis?{metricBasis:old.metricBasis}:{})}];
    targets.push(put('datasets',resolved.datasetId!,{datasetId:resolved.datasetId,canonicalBinding:canonicalBinding(resolved),revision:String(old.version??0),payload:relocate(old.payload??null),resources:[],fetchedAt:old.provenance?.fetchedAt??old.lastSuccessAt??at,sourceDataTime,lastSuccessAt:old.lastSuccessAt??'',provenance,state:['ready','succeeded','ok'].includes(old.state)?'ready':'failed',freshness:'stale',...(old.lastError?{error:{code:old.lastError.code??'LEGACY_REFRESH_FAILED',message:old.lastError.message??'Legacy refresh failed',retryPolicy:'read_retry'}}:{}),legacyDatasetKey:row.id}));
   }else if(table==='queries'){
    const resolved=binding({datasetKey:row.value.datasetKey??`query:${row.id}`,query:row.value,fieldMap:{}},row.id);targets.push(alias('query',row.id,{binding:resolved}));
   }else if(table==='views'){
    if(['component-owner','source-owner'].includes(row.value.kind)){targets.push(put('migration_records',`owner:${row.id}`,{migrationId,...row.value}));}
    else if(['source-draft','component-draft'].includes(row.value.kind)){const converted=view(row.value.spec,ownerMap.get(row.value.spec?.id));targets.push(put('views',converted.viewId,converted));const ref=reference('view',converted.viewId,converted.source?.buildId);if(ref)targets.push(ref);if(!converted.ownerSessionId)throw new Error('VIEW_OWNER_UNKNOWN');}
    else if(row.value.kind==='draft-query'){targets.push(alias('query',row.value.datasetKey,{binding:binding({datasetKey:row.value.datasetKey,query:row.value,fieldMap:{}},row.id)}));}
    else throw new Error('VIEW_KIND_NEEDS_MIGRATION');
   }else if(table==='components'||table==='settings'&&row.id.startsWith('source-revision:')){
    const old=row.value,componentId=table==='components'?row.id:old.id;if(typeof componentId!=='string'||!old.spec)throw new Error('COMPONENT_IDENTITY_NEEDS_MIGRATION');
    if(table==='components')for(const historical of old.revisions??[])if(historical.revision!==Number(old.revision??1)&&!snapshot.collections.settings.some(row=>row.id===`source-revision:${componentId}:${historical.revision}`))throw new Error('HISTORICAL_REVISION_MISSING');
    const revision=Number(old.revision??1);if(!Number.isSafeInteger(revision)||revision<1)throw new Error('COMPONENT_REVISION_NEEDS_MIGRATION');
    const converted=view(old.spec),component={componentId,revision,title:old.title??old.spec.title,view:converted,userRequest:old.userRequest??'',savedAt:old.savedAt??at,...(old.template?{legacyTemplate:relocate(old.template)}:{})},errors=validateSavedComponent(component);if(errors.length)throw new Error(`SAVED_COMPONENT_SCHEMA_NEEDS_MIGRATION: ${errors.join('; ')}`);targets.push(put('component_versions',`${componentId}:${revision}`,component));if(table==='components')targets.push(put('components',componentId,component));const ref=reference('component_version',`${componentId}:${revision}`,converted.source?.buildId);if(ref)targets.push(ref);
   }else if(table==='templates'||table==='entries'){
    const kind=table==='templates'?'template':'entry',old=row.value,common={assetId:row.id,kind,title:old.title??old.name??row.id,userRequest:old.userRequest??'Migrated original saved asset'},asset=kind==='entry'?{...common,entryKind:old.kind,...(old.kind==='component'?{componentId:old.viewId}:old.binding?{binding:binding(old.binding,old.binding.id??row.id),legacyBinding:old.binding,legacyFieldOrder:Object.keys(old.binding.fieldMap??{})}:{}),pinned:old.pinned??false,order:old.order??0}:{...common,description:old.description??'',design:relocate({theme:old.theme??{},layout:old.layout??{},widgets:old.widgetStyles??[],contentRules:old.contentRules??{}}),bindings:(old.bindings??[]).map((old:any)=>binding(old,old.id)),...(old.source?{source:relocate(old.source)}:{}),...(typeof old.savedAt==='string'?{savedAt:old.savedAt}:{})};if(table==='entries'&&old.kind==='component'&&!snapshot.collections.components.some(component=>component.id===old.viewId))throw new Error('ENTRY_COMPONENT_ORPHAN');
    const errors=(kind==='entry'?validateSavedEntry:validateSavedTemplate)(asset);if(errors.length)throw new Error(`SAVED_ASSET_SCHEMA_NEEDS_MIGRATION: ${errors.join('; ')}`);
    targets.push(put('saved_assets',`${kind}:${row.id}`,asset));const ref=reference('saved_asset',`${kind}:${row.id}`,old.source?.buildId);if(ref)targets.push(ref);
   }else if(table==='settings'&&!/^(queried_store:|source-revision:)/.test(row.id))throw new Error('UNKNOWN_SETTING_QUARANTINED');
   records.push({sourceCollection:table,sourceId:row.id,state:'mapped',targets});
  }catch(error){const reason=error instanceof Error?error.message:String(error);targets.push(put('migration_records',`quarantine:${table}:${row.id}`,{migrationId,sourceCollection:table,sourceId:row.id,status:'needs_migration',reason,legacyValue:row.value}));records.push({sourceCollection:table,sourceId:row.id,state:'quarantined',targets,reason});}
 }
 for(const [buildId,manifest] of Object.entries(inventory.builds))put('builds',buildId,manifest);
 for(const table of snapshot.unknownTables)records.push({sourceCollection:table.table,sourceId:'*',state:'quarantined',targets:[],reason:`UNKNOWN_SOURCE_TABLE: ${table.count} rows retained in full database backup`});
 const counts=Object.fromEntries([...COLLECTIONS,...snapshot.unknownTables.map(table=>table.table)].map(table=>{const rows=records.filter(row=>row.sourceCollection===table),unknown=snapshot.unknownTables.find(item=>item.table===table);return [table,{source:unknown?.count??snapshot.collections[table]?.length??0,mapped:rows.filter(row=>row.state==='mapped').length,quarantined:unknown?.count??rows.filter(row=>row.state==='quarantined').length}];}));
 const report:MigrationReport={migrationId,sourceFingerprint:fingerprint,sourceSchemaVersion:2,targetSchemaVersion:3,dryRun:true,status:records.some(row=>row.state==='quarantined')||inventory.errors.length?'needs_migration':'ready',executedAt:at,sourceDatabase:resolve(options.sourceDatabase),targetDatabase:join(resolve(options.targetDirectory),'apps.db'),counts,records,assets:inventory.files,assetErrors:inventory.errors,unresolvedOperationIds,legacyTools:LEGACY_TOOL_MAP,datasetAliases};return {report,writes};
}
export function migrationDryRun(options:MigrationOptions):MigrationReport {requireOffline(options);return planMigration(exportLegacyDatabase(options.sourceDatabase),options).report;}
/** Complete SQLite backup plus every referenced archived source/dist/preview/spill/recovery file. */
export async function createConsistentBackup(options:MigrationOptions,directory:string,expected?:MigrationReport):Promise<BackupManifest>{
 requireOffline(options);const source=exportLegacyDatabase(options.sourceDatabase),inventory=assetInventory(source,options);if(inventory.errors.length)throw new Error(`BACKUP_ASSET_INVALID: ${inventory.errors.join('; ')}`);
 if(expected&&expected.sourceFingerprint!==logicalFingerprint(source))throw new Error('SOURCE_CHANGED_SINCE_PLAN');
 const destination=resolve(directory);if(existsSync(destination))throw new Error('BACKUP_DESTINATION_EXISTS');mkdirSync(destination,{recursive:true});
 const sourceDb=new DatabaseSync(options.sourceDatabase,{readOnly:true});try{await backup(sourceDb,join(destination,'app.db'));}finally{sourceDb.close();}
 const copied=exportLegacyDatabase(join(destination,'app.db'));if(logicalFingerprint(copied)!==logicalFingerprint(source))throw new Error('BACKUP_DATABASE_CHANGED');
 for(const file of inventory.files){const bytes=readFileSync(file.sourcePath);if(sha(bytes)!==file.sha256)throw new Error('BACKUP_ASSET_CHANGED');const path=join(destination,'assets',file.relativePath);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
 const bytes=readFileSync(join(destination,'app.db')),manifest:BackupManifest={backupId:`backup:${hash({source:logicalFingerprint(source),files:inventory.files.map(({relativePath,sha256})=>({relativePath,sha256}))})}`,schemaVersion:2,createdAt:new Date().toISOString(),database:{path:'app.db',bytes:bytes.length,sha256:sha(bytes)},logicalFingerprint:logicalFingerprint(source),files:inventory.files.map(file=>({...file,sourcePath:join(destination,'assets',file.relativePath)})),verified:true};
 writeFileSync(join(destination,'export.json'),JSON.stringify(source,null,2),{flag:'wx'});writeFileSync(join(destination,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx'});verifyBackup(destination);return manifest;
}
export function verifyBackup(directory:string):BackupManifest{
 const root=realpathSync(resolve(directory)),manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8')) as BackupManifest;
 const check=(path:string,bytes:number,digest:string)=>{const absolute=resolve(root,path);if(!absolute.startsWith(root+sep)||lstatSync(absolute).isSymbolicLink()||!realpathSync(absolute).startsWith(root+sep))throw new Error('BACKUP_PATH_INVALID');const value=readFileSync(absolute);if(value.length!==bytes||sha(value)!==digest)throw new Error('BACKUP_HASH_MISMATCH');};
 check(manifest.database.path,manifest.database.bytes,manifest.database.sha256);for(const file of manifest.files)check(join('assets',file.relativePath),file.bytes,file.sha256);if(logicalFingerprint(exportLegacyDatabase(join(root,manifest.database.path)))!==manifest.logicalFingerprint)throw new Error('BACKUP_LOGICAL_MISMATCH');return manifest;
}
/** Reentrant for the same verified input. Unsupported records or missing assets block target activation. */
export async function migrateOffline(options:MigrationOptions):Promise<MigrationReport>{
 requireOffline(options);const {report,writes}=planMigration(exportLegacyDatabase(options.sourceDatabase),options);if(report.status!=='ready')throw Object.assign(new Error('MIGRATION_REQUIRES_RESOLUTION'),{report});
 const target=resolve(options.targetDirectory),lease=new RuntimeWriterLease(target);let store:RuntimeStore|undefined;
 try{
  store=new RuntimeStore(report.targetDatabase,{schemaVersion:3});const previous=store.get<MigrationReport>('migration_records',report.migrationId);if(previous){if(previous.sourceFingerprint!==report.sourceFingerprint)throw new Error('MIGRATION_INPUT_CONFLICT');verifyBackup(join(target,'backups',report.migrationId.replace(':','-')));for(const file of report.assets)if(!existsSync(join(target,file.relativePath))||sha(readFileSync(join(target,file.relativePath)))!==file.sha256)throw new Error('MIGRATED_ASSET_HASH_MISMATCH');return previous;}
  if(RUNTIME_COLLECTIONS.some(table=>store!.list(table).length))throw new Error('MIGRATION_TARGET_NOT_EMPTY');
  const manifest=await createConsistentBackup(options,join(target,'backups',report.migrationId.replace(':','-')),report),backups=join(target,'backups',report.migrationId.replace(':','-'),'assets');
  for(const file of manifest.files){const destination=join(target,file.relativePath);if(existsSync(destination)){if(sha(readFileSync(destination))!==file.sha256)throw new Error('TARGET_ASSET_CONFLICT');continue;}mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,readFileSync(join(backups,file.relativePath)),{flag:'wx'});}
  const result:MigrationReport={...report,dryRun:false,status:'migrated',backupId:manifest.backupId,writerOwnerId:lease.ownerId,executedAt:new Date().toISOString()};
  store.transaction(()=>{for(const write of writes)store!.put(write.collection,write.id,write.value);store!.put('migration_records',result.migrationId,result);});
  writeFileSync(join(target,'migration-report.json'),JSON.stringify(result,null,2),{flag:'wx'});return result;
 }finally{store?.close();lease.release();}
}
