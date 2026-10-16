import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('actual shared views watcher accepts bodyless 304s, invalidates local writes, isolates sessions, and reduces unchanged bytes',async()=>{
  const root=resolve('artifacts/performance/ui');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'conditional-views-')),entry=join(directory,'fixture.mjs');
  const contents=`
import assert from 'node:assert/strict';import {watchOwnedAppsViews,updateOwnedAppsView} from './packages/plugin-apps/client/native-publication.tsx';
const events=new EventTarget();globalThis.document={hidden:false,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};globalThis.window=new EventTarget();
let revision=1,reads=0,jsonReads=0,bytes=0,held;const requests=[],base=Array.from({length:100},(_,i)=>({viewId:String(i),ownerSessionId:'A',panelState:'open',viewRevision:1,design:{text:'x'.repeat(2000)}}));
globalThis.fetch=async(url,options)=>{reads++;const sessionId=new URL(url,'http://fixture').searchParams.get('sessionId'),etag='"'+sessionId+revision+'"',condition=new Headers(options.headers).get('If-None-Match');requests.push({sessionId,condition});if(reads===23)return new Promise(resolve=>held=resolve);if(condition===etag)return new Response(null,{status:304,headers:{ETag:etag}});const value={views:base.map(view=>({...view,ownerSessionId:sessionId,viewRevision:revision}))},body=JSON.stringify(value);bytes+=Buffer.byteLength(body);const response=new Response(body,{headers:{'Content-Type':'application/json',ETag:etag}});const original=response.json.bind(response);response.json=()=>{jsonReads++;return original();};return response;};
const settle=()=>new Promise(resolve=>setTimeout(resolve,5));let a=0,b=0,latest;const stopA=watchOwnedAppsViews('A',views=>{a++;latest=views;},()=>true,undefined,10000),stopB=watchOwnedAppsViews('A',()=>{b++;},()=>true,undefined,10000);await settle();assert.equal(reads,1);const fullBytes=bytes;
for(let n=0;n<20;n++){events.dispatchEvent(new Event('visibilitychange'));await settle();}assert.equal(reads,21);assert.equal(jsonReads,1);assert.equal(bytes,fullBytes);assert.equal(a,1);assert.equal(b,1);assert.ok(requests.slice(1).every(request=>request.condition==='"A1"'));
const cost={scope:'PRODUCTION_SHARED_VIEWS_WATCHER_SIMULATED_UNCHANGED_RESPONSES',polls:21,beforeFullBodies:21,afterFullBodies:jsonReads,beforeBodyBytes:fullBytes*21,afterBodyBytes:bytes,bodyByteReduction:1-bytes/(fullBytes*21),actualDesktop:false};
revision++;events.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(reads,22);assert.equal(jsonReads,2);assert.equal(a,2);assert.equal(b,2);
events.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(reads,23);const closed={...latest[0],panelState:'closed'};updateOwnedAppsView(closed);held(new Response(null,{status:304,headers:{ETag:'"A2"'}}));await settle();assert.equal(latest[0].panelState,'closed','an older 304 cannot undo the confirmed local panel change');events.dispatchEvent(new Event('visibilitychange'));await settle();assert.equal(requests.at(-1).condition,null,'local mutations invalidate the ETag for the next read');
document.hidden=true;events.dispatchEvent(new Event('visibilitychange'));const hiddenReads=reads;await settle();assert.equal(reads,hiddenReads);document.hidden=false;events.dispatchEvent(new Event('visibilitychange'));await settle();stopA();stopB();
const stopOther=watchOwnedAppsViews('B',views=>assert.ok(views.every(view=>view.ownerSessionId==='B')),()=>true,undefined,10000);await settle();assert.equal(requests.at(-1).sessionId,'B');assert.equal(requests.at(-1).condition,null,'a new session cannot inherit another session ETag');stopOther();console.log(JSON.stringify(cost));console.log('CONDITIONAL_VIEWS_PASS');
`;
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents},outfile:entry,bundle:true,platform:'node',format:'esm',external:['react']});const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});writeFileSync(join(directory,'result.json'),JSON.stringify({status:result.status,stdout:result.stdout,stderr:result.stderr},null,2));assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/CONDITIONAL_VIEWS_PASS/);
});
