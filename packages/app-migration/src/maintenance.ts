import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { canonicalJson } from '../../app-contracts/src/index.ts';
import type { RuntimeStore, RuntimeOperation } from '../../app-runtime/src/store.ts';

type RecordData=Record<string,any>;
const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
function walkBytes(path:string):number{if(lstatSync(path).isSymbolicLink())throw new Error('ASSET_SYMLINK');if(lstatSync(path).isFile())return lstatSync(path).size;return readdirSync(path).reduce((sum,name)=>sum+walkBytes(join(path,name)),0);}
function safeBuildPath(root:string,buildId:string):string{
 if(!/^[a-f0-9]{64}$/.test(buildId))throw new Error('GC_BUILD_ID_INVALID');
 const namedRoot=resolve(root,'source-components','builds'),path=resolve(namedRoot,buildId),rel=relative(namedRoot,path);
 if(!rel||rel.startsWith('..'+sep)||isAbsolute(rel)||!path.toLowerCase().startsWith((namedRoot+sep).toLowerCase()))throw new Error('GC_PATH_OUTSIDE_BUILD_ROOT');
 if(existsSync(path)&&(lstatSync(path).isSymbolicLink()||!realpathSync(path).toLowerCase().startsWith((realpathSync(namedRoot)+sep).toLowerCase())))throw new Error('GC_PATH_SYMLINK');return path;
}
const relevant=['builds','views','components','component_versions','saved_assets','artifact_refs','datasets','operations','invocations','runs','run_steps','provider_records','component_contexts','migration_records','authoring_drafts','authoring_attempts','build_receipts','preview_receipts','view_publications','view_ui_states'] as const;
function state(store:RuntimeStore):RecordData{return Object.fromEntries(relevant.filter(table=>store.collections.includes(table)).map(table=>[table,store.list<RecordData>(table)]));}
function references(value:unknown,builds:Set<string>,datasets:Set<string>):void{
 if(Array.isArray(value)){for(const item of value)references(item,builds,datasets);return;}
 if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(['buildId','archiveBuildId','candidateBuildId','activeBuildId','lastGoodBuildId','previousGoodBuildId','sourceBuildId','priorActiveBuildId'].includes(key)&&typeof item==='string')builds.add(item);if(key==='datasetId'&&typeof item==='string')datasets.add(item);if(key==='targetKind'&&typeof (value as RecordData).targetId==='string'){if(item==='build')builds.add((value as RecordData).targetId);if(item==='dataset')datasets.add((value as RecordData).targetId);}references(item,builds,datasets);}
}
export interface GCPlan { mode:'dry_run';createdAt:string;root:string;stateDigest:string;retentionDays:number;candidates:{collection:'views'|'datasets'|'builds';id:string;bytes:number;path?:string}[];retained:{collection:string;id:string;reason:string}[];totalBytes:number }
/** Saved versions, all referenced assets, operation evidence and migration evidence are retained. */
export function gcDryRun(store:RuntimeStore,directory:string,options:{now?:Date;retentionDays?:number}={}):GCPlan{
 const now=options.now??new Date(),retentionDays=options.retentionDays??7;if(!Number.isFinite(now.getTime())||!Number.isFinite(retentionDays)||retentionDays<1)throw new Error('GC_RETENTION_INVALID');
 const snapshot=state(store),builds=new Set<string>(),datasets=new Set<string>(),retained:GCPlan['retained']=[],candidates:GCPlan['candidates']=[];
 references(Object.fromEntries(Object.entries(snapshot).filter(([table])=>table!=='builds'&&table!=='datasets')),builds,datasets);
 const expires=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<now.getTime()-retentionDays*86400000;
 const savedViewIds=new Set<string>();for(const row of [...snapshot.components,...snapshot.component_versions]){if(row.view?.viewId)savedViewIds.add(row.view.viewId);retained.push({collection:'component_versions',id:`${row.componentId}:${row.revision}`,reason:'user_saved_version'});}
 for(const row of [...(snapshot.authoring_drafts??[]),...(snapshot.view_publications??[]),...(snapshot.view_ui_states??[])])if(row.viewId)savedViewIds.add(row.viewId);
 for(const row of snapshot.views){if(!row.viewId)continue;if(savedViewIds.has(row.viewId)||!expires(row.updatedAt??row.createdAt))retained.push({collection:'views',id:row.viewId,reason:savedViewIds.has(row.viewId)?'saved_design_reference':'within_retention_or_time_unknown'});else candidates.push({collection:'views',id:row.viewId,bytes:Buffer.byteLength(canonicalJson(row))});}
 for(const row of snapshot.datasets){if(!row.datasetId)continue;if(datasets.has(row.datasetId)||String(row.canonicalBinding?.capabilityId??'').includes('.operations.')||!expires(row.fetchedAt))retained.push({collection:'datasets',id:row.datasetId,reason:datasets.has(row.datasetId)?'binding_reference':'operation_evidence_or_retention'});else candidates.push({collection:'datasets',id:row.datasetId,bytes:Buffer.byteLength(canonicalJson(row))});}
 for(const row of snapshot.builds){if(!row.buildId)continue;if(builds.has(row.buildId)||!expires(row.createdAt)){retained.push({collection:'builds',id:row.buildId,reason:builds.has(row.buildId)?'asset_reference':'within_retention_or_time_unknown'});continue;}try{const path=safeBuildPath(directory,row.buildId);candidates.push({collection:'builds',id:row.buildId,path,bytes:existsSync(path)?walkBytes(path):0});}catch(error){retained.push({collection:'builds',id:row.buildId,reason:error instanceof Error?error.message:String(error)});}}
 return {mode:'dry_run',createdAt:now.toISOString(),root:resolve(directory),stateDigest:digest(snapshot),retentionDays,candidates,retained,totalBytes:candidates.reduce((sum,row)=>sum+row.bytes,0)};
}
/** Explicit apply checks the unchanged plan and every final absolute deletion target. */
export function applyGC(store:RuntimeStore,plan:GCPlan):{deleted:{collection:string;id:string}[];bytes:number}{
 if(plan.mode!=='dry_run'||digest(state(store))!==plan.stateDigest)throw new Error('GC_PLAN_STALE');
 const fresh=gcDryRun(store,plan.root,{now:new Date(plan.createdAt),retentionDays:plan.retentionDays}),allowed=new Set(fresh.candidates.map(row=>`${row.collection}:${row.id}`));
 if(plan.candidates.some(row=>!allowed.has(`${row.collection}:${row.id}`)))throw new Error('GC_REFERENCED_ASSET');
 for(const row of plan.candidates)if(row.collection==='builds'){const path=safeBuildPath(plan.root,row.id);if(row.path!==path)throw new Error('GC_PLAN_PATH_CHANGED');if(existsSync(path))rmSync(path,{recursive:true,force:false});}
 store.transaction(()=>{for(const row of plan.candidates){if(!['views','datasets','builds'].includes(row.collection))throw new Error('GC_EVIDENCE_DELETE_FORBIDDEN');store.delete(row.collection,row.id);if(row.collection==='views')for(const reference of store.list<RecordData>('artifact_refs'))if(reference.ownerKind==='view'&&reference.ownerId===row.id)store.delete('artifact_refs',`view:${row.id}:${reference.targetId}`);}});
 return {deleted:plan.candidates.map(({collection,id})=>({collection,id})),bytes:plan.totalBytes};
}
export interface RollbackBaseline {operationIds:string[];componentVersionIds:string[];savedAssetDigest:Record<string,string>;bindingDigest:Record<string,string>;authoringDigest?:Record<string,string>}
const authoringTables=['authoring_drafts','authoring_attempts','build_receipts','preview_receipts','view_publications','view_ui_states'];
function authoringState(store:RuntimeStore):RecordData{return Object.fromEntries(authoringTables.filter(table=>store.collections.includes(table)).map(table=>[table,store.list<RecordData>(table)]));}
function savedAssetKey(row:RecordData):string {
 if(row.kind==='workbench')return row.workbenchId;
 if(row.kind==='data_source')return `data_source:${row.id}`;
 if(row.kind==='data_source_revision')return `data_source_revision:${row.id}:${row.revision}`;
 return `${row.kind}:${row.assetId}`;
}
export function rollbackBaseline(store:RuntimeStore):RollbackBaseline{return {operationIds:store.list<RuntimeOperation>('operations').map(row=>row.operationId),componentVersionIds:store.list<RecordData>('component_versions').map(row=>`${row.componentId}:${row.revision}`),savedAssetDigest:Object.fromEntries(store.list<RecordData>('saved_assets').map(row=>[savedAssetKey(row),digest(row)])),bindingDigest:Object.fromEntries(store.list<RecordData>('session_app_bindings').map(row=>[canonicalJson([row.sessionId,row.appId,row.connectionId]),digest(row)])),authoringDigest:Object.fromEntries(Object.entries(authoringState(store)).map(([table,rows])=>[table,digest(rows)]))};}
export function assessRollback(store:RuntimeStore,baseline:RollbackBaseline,cutoverAt:string){
 if(!Number.isFinite(Date.parse(cutoverAt)))throw new Error('CUTOVER_TIME_REQUIRED');
 const operations=store.list<RuntimeOperation>('operations'),newOperations=operations.filter(row=>!baseline.operationIds.includes(row.operationId)),versions=store.list<RecordData>('component_versions').filter(row=>!baseline.componentVersionIds.includes(`${row.componentId}:${row.revision}`)),assets=store.list<RecordData>('saved_assets').filter(row=>baseline.savedAssetDigest[savedAssetKey(row)]!==digest(row)),bindings=store.list<RecordData>('session_app_bindings').filter(row=>baseline.bindingDigest[canonicalJson([row.sessionId,row.appId,row.connectionId])]!==digest(row)),unresolved=operations.filter(row=>['queued','dispatching','pending','unknown'].includes(row.state)).map(row=>row.operationId),current=rollbackBaseline(store),deletedAssets=Object.keys(baseline.savedAssetDigest).filter(key=>!Object.hasOwn(current.savedAssetDigest,key)),deletedBindings=Object.keys(baseline.bindingDigest).filter(key=>!Object.hasOwn(current.bindingDigest,key));
 const authoring=authoringState(store),changedAuthoringCollections=Object.keys(authoring).filter(table=>baseline.authoringDigest?.[table]!==digest(authoring[table]));
 const branch=newOperations.length||versions.length||assets.length||bindings.length||deletedAssets.length||deletedBindings.length||changedAuthoringCollections.length?'B':'A';
 return {cutoverAt,branch,freezeRequired:true,legacyRestoreAllowed:branch==='A'&&unresolved.length===0,unresolvedOperationIds:unresolved,reason:branch==='B'?'Export and reconcile new business/asset/binding/authoring evidence before any legacy format takeover.':unresolved.length?'Unexplained operations require read-only inspection; keep writers frozen.':'No post-cutover business, user asset or authoring delta.',incrementalExport:{operations:newOperations,componentVersions:versions,savedAssets:assets,sessionBindings:bindings,deletedAssets,deletedBindings,authoring:Object.fromEntries(changedAuthoringCollections.map(table=>[table,authoring[table]])),changedAuthoringCollections},externalBusinessReversed:false};
}
export interface CutoverEvidence {oldWriterStopped:boolean;runtimeWriterCount:number;gateStates:Record<string,string>;unresolvedOperationIds:string[];migrationStatus:string}
export function validateCutoverEvidence(input:unknown){
 const keys=['oldWriterStopped','runtimeWriterCount','gateStates','unresolvedOperationIds','migrationStatus'],gates=['G0','G1','G2','G3','G4'];
 if(!input||typeof input!=='object'||Array.isArray(input))return {allowed:false,reasons:['CUTOVER_EVIDENCE_INVALID']};
 const evidence=input as CutoverEvidence;
 if(Object.keys(input).length!==keys.length||Object.keys(input).some(key=>!keys.includes(key))||typeof evidence.oldWriterStopped!=='boolean'||!Number.isSafeInteger(evidence.runtimeWriterCount)||evidence.runtimeWriterCount<0||!evidence.gateStates||typeof evidence.gateStates!=='object'||Array.isArray(evidence.gateStates)||Object.keys(evidence.gateStates).length!==gates.length||Object.entries(evidence.gateStates).some(([key,value])=>!gates.includes(key)||typeof value!=='string')||!Array.isArray(evidence.unresolvedOperationIds)||evidence.unresolvedOperationIds.some(value=>typeof value!=='string'||!value.trim())||typeof evidence.migrationStatus!=='string')return {allowed:false,reasons:['CUTOVER_EVIDENCE_INVALID']};
 const reasons:string[]=[];if(!evidence.oldWriterStopped||evidence.runtimeWriterCount!==1)reasons.push('SINGLE_WRITER_NOT_PROVEN');for(const gate of ['G0','G1','G2','G3','G4'])if(evidence.gateStates[gate]!=='VERIFIED')reasons.push(`${gate}_NOT_VERIFIED`);if(evidence.unresolvedOperationIds.length)reasons.push('UNRESOLVED_OPERATIONS');if(evidence.migrationStatus!=='migrated')reasons.push('MIGRATION_NOT_VERIFIED');return {allowed:reasons.length===0,reasons};
}
