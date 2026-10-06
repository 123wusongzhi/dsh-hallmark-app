// One-time migration of old in-memory views, before restarting the 0.2 service.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {AppServiceClient} from '../packages/dsh-plugin/server/service-client.ts';
import {AppStore} from '../packages/store/index.ts';
import {PresentationManager} from '../packages/presentation/src/index.ts';
import {SessionViewRegistry} from '../packages/core/src/views.ts';

const [mode,file]=process.argv.slice(2);
if(!['export','import'].includes(mode)||!file)throw new Error('Usage: node scripts/migrate-live-views.mjs export|import <snapshot.json>');
const client=new AppServiceClient();const database=join(client.directory,'app.db');
if(mode==='export'){
 const db=new DatabaseSync(database,{readOnly:true});let sessions;
 try{
  if(db.prepare("SELECT COUNT(*) AS n FROM operations WHERE state IN ('pending','running')").get().n)throw new Error('OPERATIONS_IN_FLIGHT');
  sessions=db.prepare('SELECT value_json FROM session_apps').all().map(row=>JSON.parse(row.value_json).sessionId);
 }finally{db.close();}
 const views=[];
 for(const sessionId of [...new Set(sessions)]){
  const list=await client.request(`/sessions/${encodeURIComponent(sessionId)}/views`);
  for(const view of list.views??[]){
   if(view.state!=='ready')continue;
   const value=await client.request(`/sessions/${encodeURIComponent(sessionId)}/views/${encodeURIComponent(view.viewId)}`);
   const spec=value.spec??value;
   if(spec.id!==view.viewId)throw new Error('UNEXPECTED_VIEW_RESPONSE');
   views.push({sessionId,spec});
  }
 }
 writeFileSync(resolve(file),JSON.stringify({exportedAt:new Date().toISOString(),views},null,2),{flag:'wx',encoding:'utf8'});
 console.log(JSON.stringify({exportedViews:views.length,sessions:new Set(views.map(row=>row.sessionId)).size}));
}else{
 // Stop the old service first: never run two writable service owners for this upgrade.
 try{await client.request('/health',undefined,undefined,1000);throw new Error('SERVICE_STILL_RUNNING');}catch(error){if(error.message==='SERVICE_STILL_RUNNING')throw error;if(error.code!=='APP_SERVICE_UNAVAILABLE')throw error;}
 const snapshot=JSON.parse(readFileSync(resolve(file),'utf8'));
 if(!Array.isArray(snapshot.views))throw new Error('INVALID_VIEW_BACKUP');
 const store=new AppStore(database);
 try{
  const presentation=new PresentationManager(store);const registry=new SessionViewRegistry(presentation,store);
  store.transaction(()=>{
   for(const {sessionId,spec} of snapshot.views){
    registry.assertNotForeign(sessionId,spec.id);
    const view=presentation.restoreDraft(spec);registry.recordSuccess(sessionId,view);
   }
  });
  console.log(JSON.stringify({importedViews:snapshot.views.length}));
 }finally{store.close();}
}
