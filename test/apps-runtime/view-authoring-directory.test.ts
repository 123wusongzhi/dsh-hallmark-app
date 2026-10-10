import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppsRuntime,RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import type {AppsView} from '../../packages/app-presentation/src/types.ts';
import type {AuthoringDraft} from '../../packages/app-presentation/src/authoring-types.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';

async function listen(server:ReturnType<typeof createAppsServer>):Promise<string>{
 await new Promise<void>((accept,reject)=>{const ready=()=>{server.off('error',failed);accept();},failed=(error:Error)=>{server.off('listening',ready);reject(error);};server.once('error',failed);server.once('listening',ready);server.listen(0,'127.0.0.1');});
 return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
}

test('view directory projects editing and failed drafts while preserving the confirmed build and closed work',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'apps-authoring-directory-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),sources=new SourceComponentStore(join(directory,'source')),presentation=new AppsPresentationService({store,runtime,sources}),token='directory-fixture-token'.repeat(3),server=createAppsServer({runtime,presentation,token});let clock=Date.now();
 const authoring=presentation.configureAuthoring({clock:()=>new Date(clock+=1000)});
 try{
  const url=await listen(server),list=async(sessionId='A')=>{
   const original=store.list.bind(store);store.list=()=>{throw new Error('Directory may not scan full tables');};
   try{const response=await fetch(`${url}/v1/views?sessionId=${sessionId}`,{headers:{authorization:`Bearer ${token}`}});assert.equal(response.status,200,await response.clone().text());return (await response.json()).views as AppsView[];}finally{store.list=original;}
  };
  const newDraft=authoring.begin('A',{mode:'new',title:'正在制作'});
  const first=(await list())[0];assert.equal(first.authoringState,'editing');assert.equal(first.authoringUpdatedAt,newDraft.draft.updatedAt);assert.equal(first.authoringEpoch,newDraft.draft.epoch);assert.equal(first.activeBuildId,null);
  const project=join(directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<h1>Previous good build</h1>');
  const previous=presentation.openSource('A',project,{title:'已有组件'}),activeBuildId=previous.source!.buildId;
  store.put('views',previous.viewId,{...previous,activeBuildId,lastGoodBuildId:activeBuildId,validationStatus:'verified'});
  const edit=authoring.begin('A',{mode:'edit',viewId:previous.viewId});
  const editing=(await list()).find(view=>view.viewId===previous.viewId)!;assert.equal(editing.authoringState,'editing');assert.equal(editing.activeBuildId,activeBuildId);assert.equal(editing.source?.buildId,activeBuildId);assert.equal(editing.validationStatus,'verified');
  authoring.markBuilding('A',{attemptId:edit.attempt.attemptId,epoch:edit.attempt.epoch});assert.equal((await list()).find(view=>view.viewId===previous.viewId)!.authoringState,'building');
  await assert.rejects(authoring.recordBuild('A',{attemptId:edit.attempt.attemptId,epoch:edit.attempt.epoch,reportRef:{path:join(directory,'missing-report.json'),sha256:'a'.repeat(64),bytes:1}}));
  const failed=(await list()).find(view=>view.viewId===previous.viewId)!,actual=store.get<AuthoringDraft>('authoring_drafts',edit.draft.draftId)!;
  assert.equal(failed.authoringState,'build_failed');assert.equal(failed.authoringUpdatedAt,actual.updatedAt);assert.equal(failed.activeBuildId,activeBuildId);assert.equal(failed.validationStatus,'verified');assert.equal(failed.pendingPublicationId,null);
  const stored=presentation.getView(previous.viewId)!;assert.equal(Object.hasOwn(stored,'authoringState'),false);assert.equal(Object.hasOwn(stored,'authoringUpdatedAt'),false);assert.equal(Object.hasOwn(stored,'authoringEpoch'),false);
  authoring.closeDraft('A',previous.viewId,'keep');const closed=(await list()).find(view=>view.viewId===previous.viewId)!;assert.equal(closed.authoringState,'closed');assert.equal(closed.panelState,'closed');assert.equal(closed.activeBuildId,activeBuildId);
  const foreign=authoring.begin('B',{mode:'new',title:'别的会话'});assert.deepEqual((await list('B')).map(view=>view.viewId),[foreign.view.viewId]);assert.equal((await list()).some(view=>view.viewId===foreign.view.viewId),false);
  assert.equal(store.list('invocations').length,0);
 }finally{server.closeAllConnections();if(server.listening)await new Promise<void>(done=>server.close(()=>done()));await runtime.dispose();store.close();assert.match(resolve(directory),/apps-authoring-directory-[^\\/]+$/);rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('draft summaries use the session index and latest metadata without exposing workspace content',async()=>{
 const store=new RuntimeStore(':memory:');
 try{
  const draft=(draftId:string,ownerSessionId:string,viewId:string,status:AuthoringDraft['status'],updatedAt:string,epoch:number):AuthoringDraft=>({schemaVersion:1,draftId,ownerSessionId,viewId,status,updatedAt,epoch,workspacePath:'private-workspace-'.repeat(1000),createdAt:'2026-10-09T00:00:00.000Z',sourceRevision:epoch});
  for(const value of [draft('old','A','v','discarded','2026-10-09T05:00:00.000Z',99),draft('active','A','v','editing','2026-10-09T03:00:00.000Z',2),draft('same-time-older','A','v','building','2026-10-09T03:00:00.000Z',1),draft('foreign','B','v','build_failed','2026-10-09T09:00:00.000Z',200),draft('closed','A','closed-view','closed','2026-10-09T02:00:00.000Z',4),draft('discard-only','A','discarded-view','discarded','2026-10-09T01:00:00.000Z',1)])store.put('authoring_drafts',value.draftId,value);
  const rows=store.authoringDraftSummaries('A');assert.equal(rows[0].draftId,'active');assert.equal(rows[0].epoch,2);assert.equal(rows[0].updatedAt,'2026-10-09T03:00:00.000Z');assert.equal(rows.some(row=>row.draftId==='foreign'),false);assert.equal(rows.find(row=>row.viewId==='discarded-view')!.status,'discarded');
  assert.ok(rows.every(row=>Object.keys(row).sort().join(',')==='draftId,epoch,status,updatedAt,viewId'));
  const plan=store.db.prepare("EXPLAIN QUERY PLAN SELECT id FROM authoring_drafts WHERE json_extract(value_json,'$.ownerSessionId')=? AND json_extract(value_json,'$.viewId')=?").all('A','v');assert.match(JSON.stringify(plan),/USING (?:COVERING )?INDEX authoring_drafts_owner_view/);
  const schema3=new RuntimeStore(':memory:',{schemaVersion:3});try{assert.deepEqual(schema3.authoringDraftSummaries('A'),[]);}finally{schema3.close();}
 }finally{store.close();}
});
