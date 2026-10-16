/** Installed-Runtime acceptance. No service management, business writes, board save or catalog initialization.
 * Usage: node scripts/verify-ozon-composition-live.mjs <runtimeURL> <serviceKeyFile> <evidenceRoot> [options.json]
 * options: {storeIds?:string[],connectionId?:string,dateFrom?:string,dateTo?:string,warehouseIds?:Record<string,string>,limit?:number,savedInstanceId?:string,lifecycle?:boolean}
 * Only session binding, query caches and preview state are written. Run after the new bundle is installed.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createOzonCompositionDraft,DEFAULT_PRODUCT_FIELDS} from '../packages/app-hallmark/src/ozon-composition.ts';
import {createMaterialView} from '../packages/app-presentation/src/materials/catalog.ts';
import {canonicalJson,compileSchema} from '../packages/app-contracts/src/index.ts';
const [urlArgument,keyFile,evidenceRoot,optionsFile]=process.argv.slice(2);
if(!urlArgument||!keyFile||!evidenceRoot)throw Error('Usage: node scripts/verify-ozon-composition-live.mjs <runtimeURL> <serviceKeyFile> <evidenceRoot> [options.json]');
const url=new URL(urlArgument);if(url.protocol!=='http:'||!['127.0.0.1','[::1]','localhost'].includes(url.hostname)||url.username||url.password)throw Error('A credential-free loopback HTTP Runtime URL is required.');
const token=readFileSync(keyFile,'utf8').trim();if(!token||/[\r\n]/.test(token))throw Error('Invalid service key file.');
const options=optionsFile?JSON.parse(readFileSync(optionsFile,'utf8')):{},runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`,directory=resolve(evidenceRoot,runId),sessionId=`ozon-compose-acceptance:${runId}`;
mkdirSync(directory,{recursive:true});let sequence=0;
const write=(name,value)=>writeFileSync(resolve(directory,`${name}.json`),`${JSON.stringify(value,null,2)}\n`,{mode:0o600});
const summary={runId,startedAt:new Date().toISOString(),runtime:url.origin,checks:[],stores:[],requests:[],failures:[]};
function check(name,pass,detail){summary.checks.push({name,passed:!!pass,...(detail===undefined?{}:{detail})});write('summary',summary);console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name);}
async function call(path,body,label='request'){
 const started=performance.now();
 const response=await fetch(new URL(path,url),{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(150000)});
 const value=await response.json(),durationMs=Math.round(performance.now()-started);summary.requests.push({label,durationMs,httpStatus:response.status});write(`${String(++sequence).padStart(3,'0')}-${label}`,{path,request:body??null,httpStatus:response.status,durationMs,response:value});if(!response.ok)throw Error(`${label}: HTTP ${response.status}; inspect saved evidence.`);return value;
}
const invoke=async(connectionId,input,label)=>{const invocationId=randomUUID();return call('/v1/invocations',{protocolVersion:'1.0',invocationId,traceId:invocationId,appId:'hallmark',connectionId,capabilityId:'hallmark.ozon.compose',capabilityVersion:'1.0.0',input,source:{kind:'agent',sessionId,nativeCallId:invocationId},deadlineAt:new Date(Date.now()+140000).toISOString()},label);};
const recipe={version:1,grain:'product',fields:[...DEFAULT_PRODUCT_FIELDS]},limit=options.limit??5;
const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10),weekStart=new Date(Date.parse(`${yesterday}T00:00:00Z`)-6*86400000).toISOString().slice(0,10),period={dateFrom:options.dateFrom??weekStart,dateTo:options.dateTo??yesterday};
try{
 const descriptor=await call('/v1/capabilities/hallmark.ozon.compose',undefined,'installed-descriptor');check('installed composition descriptor is available',descriptor.capabilityId==='hallmark.ozon.compose');
 const catalog=await call('/v1/workbench?resource=stores&appId=hallmark',undefined,'stores');let stores=catalog.stores??[];if(options.connectionId)stores=stores.filter(store=>store.connectionId===options.connectionId);if(options.storeIds)stores=options.storeIds.map(id=>stores.find(store=>store.id===id)).filter(Boolean);else stores=stores.slice(0,2);check('two distinct authorized Ozon shops selected',stores.length===2&&stores[0].id!==stores[1].id);
 const sourcesBefore=await call('/v1/workbench?resource=dataSources&appId=hallmark',undefined,'catalog-before-preview');
 for(const [index,store] of stores.entries()){
  const prefix=`shop-${index+1}`;await call('/v1/session-bindings',{sessionId,appId:'hallmark',connectionId:store.connectionId,enabled:true,boundAt:new Date().toISOString()},`${prefix}-session-binding`);
  const params={limit,...period,...(options.warehouseIds?.[store.id]?{warehouseId:options.warehouseIds[store.id]}:{})},input={storeId:store.id,recipe,...params};check(`${prefix} runtime input schema accepts dates`,!compileSchema(descriptor.inputSchema)(input).length);
  const result=await invoke(store.connectionId,input,`${prefix}-agent-query`);check(`${prefix} Agent query and output schema`,result.status==='ok'&&!compileSchema(descriptor.outputSchema)(result.data).length,{status:result.status,error:result.error??null});
  check(`${prefix} source reads are complete`,['products','prices','stocks','analytics'].every(source=>result.data.sourceStates.some(state=>state.source===source&&['ready','empty'].includes(state.status))),result.data.sourceStates);
  check(`${prefix} real product rows have nested identity`,result.data.items.length>0&&result.data.items.every(row=>row.products?.productId&&!Object.hasOwn(row,'products.title')));
  if(result.data.cursor){const next=await invoke(store.connectionId,{...input,cursor:result.data.cursor},`${prefix}-next-page`);check(`${prefix} composition next page`,next.status==='ok'&&next.data.items.length>0&&!next.data.items.some(row=>result.data.items.some(first=>first.products.productId===row.products.productId)));const wrong=await invoke(store.connectionId,{...input,storeId:stores[1-index].id,cursor:result.data.cursor},`${prefix}-foreign-cursor`);check(`${prefix} cross-shop cursor rejected`,wrong.status==='failed'&&wrong.error?.code==='INVALID_CURSOR');}
  const draft=createOzonCompositionDraft(store.connectionId,recipe),design=createMaterialView('data-table');design.widgets[0].columns=draft.fields.filter(field=>field.key!=='products.image').map(field=>({field:field.key,label:field.label}));
  const instance={instanceId:`${sessionId}:${index}`,title:'商品经营组合验收',materialId:'data-table',materialVersion:1,design,dataSources:{main:{id:draft.id,revision:1,params,draft}},position:{order:0}};
  const preview=await call('/v1/workbench',{appId:'hallmark',operation:'preview',sessionId,params:{instance,context:{storeId:store.id},refresh:true,scope:sessionId}},`${prefix}-draft-preview`),binding=preview.data?.bindings?.find(row=>row.bindingId==='main');
  check(`${prefix} preview executes same persisted contract`,binding?.state==='ready'&&binding?.query?.capabilityId==='hallmark.ozon.compose'&&binding?.query?.input?.storeId===store.id,{state:binding?.state,error:binding?.error??null});
  check(`${prefix} Agent and preview field values agree`,canonicalJson(binding.payload.items)===canonicalJson(result.data.items));
  summary.stores.push({storeId:store.id,name:store.name,rows:result.data.items.length,total:result.data.total,firstQueryDurationMs:summary.requests.find(request=>request.label===`${prefix}-agent-query`)?.durationMs,warnings:result.data.warnings,sourceStates:result.data.sourceStates});
 }
 if(options.lifecycle){
  const store=stores[0],input={storeId:store.id,recipe,limit,...period};
  const baseline=await invoke(store.connectionId,input,'lifecycle-baseline');check('lifecycle baseline exposes fresh source expiry',baseline.status==='ok'&&baseline.data.cache?.ttlMs===180000&&!baseline.data.cache.stale&&!compileSchema(descriptor.outputSchema)(baseline.data).length);
  const forced=await invoke(store.connectionId,{...input,forceRefresh:true},'lifecycle-manual-refresh'),before=baseline.data.sourceStates.find(state=>state.source==='analytics'),after=forced.data?.sourceStates?.find(state=>state.source==='analytics');
  check('manual refresh observes analytics cooldown and retains actual read time',forced.status==='ok'&&forced.data.cache.stale&&after?.freshness==='stale'&&after.cacheReason==='rate_limit'&&after.fetchedAt===before.fetchedAt&&Date.parse(after.nextRetryAt)>Date.now(),{before,after,cache:forced.data?.cache});
  check('manual refresh renews ordinary sources inside their prior TTL',forced.data.sourceStates.filter(state=>state.source!=='analytics').every(state=>state.cacheHit===false&&state.freshness==='fresh'&&Date.parse(state.fetchedAt)>Date.parse(baseline.data.sourceStates.find(old=>old.source===state.source).fetchedAt)));
  check('Runtime provenance marks reused stale values and preserves source timestamp',forced.provenance?.[0]?.freshness==='stale'&&forced.provenance[0].fetchedAt===forced.data.cache.fetchedAt);
  if(forced.data.cursor){const invalid=await invoke(store.connectionId,{...input,forceRefresh:true,cursor:forced.data.cursor},'lifecycle-force-cursor-invalid');check('forced refresh cannot reuse a previous page cursor',invalid.status==='failed'&&invalid.error?.code==='INVALID_REFRESH_CURSOR');}
  const expires=Date.parse(forced.data.cache.nextRefreshAt)+250;check('lifecycle retry is bounded by source cooldown',Number.isFinite(expires)&&expires-Date.now()<65000);
  while(Date.now()<expires){const remaining=expires-Date.now();console.log(`WAIT source lifecycle expiry (${Math.ceil(remaining/1000)} seconds remaining)`);await new Promise(resolve=>setTimeout(resolve,Math.min(15000,remaining)));}
  const renewed=await invoke(store.connectionId,input,'lifecycle-after-expiry');check('ordinary query re-fetches expired sources without a force flag',renewed.status==='ok'&&!renewed.data.cache.stale&&renewed.data.sourceStates.find(state=>state.source==='analytics')?.cacheHit===false&&Date.parse(renewed.data.sourceStates.find(state=>state.source==='analytics').fetchedAt)>Date.parse(before.fetchedAt),renewed.data?.cache);
  const reused=await invoke(store.connectionId,input,'lifecycle-within-renewed-ttl');check('renewed TTL reuses completed values and keeps their timestamp',reused.status==='ok'&&!reused.data.cache.stale&&reused.data.sourceStates.every(state=>state.cacheHit)&&reused.data.cache.fetchedAt===renewed.data.cache.fetchedAt&&canonicalJson(reused.data.items)===canonicalJson(renewed.data.items));
  summary.lifecycle={manualCache:forced.data.cache,renewedCache:renewed.data.cache,sourceStates:renewed.data.sourceStates};
 }
 const sourcesAfter=await call('/v1/workbench?resource=dataSources&appId=hallmark',undefined,'catalog-after-preview');const signatures=value=>(value.dataSources??[]).map(source=>[source.id,source.revision]).sort((a,b)=>a[0].localeCompare(b[0]));check('draft previews do not create or version shared data sources',JSON.stringify(signatures(sourcesBefore))===JSON.stringify(signatures(sourcesAfter)));
 if(options.savedInstanceId){const board=await call('/v1/workbench?resource=workbench&appId=hallmark',undefined,'existing-board');check('saved acceptance instance exists',board.instances.some(instance=>instance.instanceId===options.savedInstanceId));const read=await call('/v1/workbench',{appId:'hallmark',operation:'read',params:{instanceId:options.savedInstanceId,refresh:true,context:board.context}},'saved-instance-read');check('saved instance uses composition read',read.data?.bindings?.some(binding=>binding.state==='ready'&&binding.query?.capabilityId==='hallmark.ozon.compose'));}
 summary.finishedAt=new Date().toISOString();summary.passed=true;write('summary',summary);console.log(`Evidence: ${directory}`);
}catch(error){summary.finishedAt=new Date().toISOString();summary.passed=false;summary.failures.push({message:error.message});write('summary',summary);console.error(`Acceptance failed; inspect ${resolve(directory,'summary.json')}`);process.exitCode=1;}
