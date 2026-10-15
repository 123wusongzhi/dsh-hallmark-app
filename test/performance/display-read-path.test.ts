import test from 'node:test';
import assert from 'node:assert/strict';
import fs,{mkdtempSync,mkdirSync,readFileSync,rmSync,utimesSync,statSync,writeFileSync} from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {VerifiedDisplayCache} from '../../packages/app-presentation/src/verified-displays.ts';
import {composeAppsRuntime} from '../../packages/service/src/apps-main.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import type {AppsView} from '../../packages/app-presentation/src/index.ts';

function fixture(t:{after:(fn:()=>void)=>void}){const root=mkdtempSync(join(tmpdir(),'display-read-path-'));t.after(()=>{assert.ok(resolve(root).startsWith(resolve(tmpdir())));rmSync(root,{recursive:true,force:true,maxRetries:15,retryDelay:200});});return root;}
function countReads<T>(path:string,work:()=>T){const original=fs.readFileSync;let calls=0;(fs as unknown as {readFileSync:typeof fs.readFileSync}).readFileSync=((file:Parameters<typeof readFileSync>[0],...args:unknown[])=>{if(String(file).startsWith(path))calls++;return (original as (...input:unknown[])=>Buffer|string)(file,...args);}) as typeof fs.readFileSync;syncBuiltinESMExports();try{return {result:work(),calls};}finally{fs.readFileSync=original;syncBuiltinESMExports();}}

test('verified display cache is bounded, expires, drops mismatches and computes fingerprints lazily',()=>{
  const cache=new VerifiedDisplayCache(2,1000),entry=(displayId:string,fingerprint='f',verifiedAt=0)=>({sessionId:'s',viewId:'v',publicationId:'p',displayId,fingerprint,verifiedAt});
  let computed=0;const fingerprint=(value:string|undefined)=>()=>{computed++;return value;};
  assert.equal(cache.hit('a',fingerprint('f'),0),false);assert.equal(computed,0,'nothing to compare for an unknown key');
  cache.remember('a',entry('a'));cache.remember('b',entry('b'));
  assert.equal(cache.hit('a',fingerprint('f'),999),true,'inside the TTL with an unchanged fingerprint');
  cache.remember('c',entry('c'));assert.equal(cache.size,2);assert.equal(cache.hit('b',fingerprint('f'),0),false,'least recently used entry evicted');assert.equal(cache.hit('a',fingerprint('f'),0),true,'recently used entry kept');
  computed=0;assert.equal(cache.hit('a',fingerprint('f'),1000),false,'TTL reached');assert.equal(computed,0,'expired entries are not compared');assert.equal(cache.hit('a',fingerprint('f'),0),false,'an expired entry is dropped');
  cache.remember('d',entry('d','f',500));assert.equal(cache.hit('d',fingerprint('f'),499),false,'a clock that moved backwards expires the entry');
  cache.remember('e',entry('e'));assert.equal(cache.hit('e',fingerprint('changed'),0),false);assert.equal(cache.hit('e',fingerprint('f'),0),false,'a mismatch drops the entry for good');
  cache.remember('g',entry('g'));assert.equal(cache.hit('g',fingerprint(undefined),0),false,'an unreadable record set never hits');
  cache.remember('x',entry('x'));cache.remember('y',{...entry('y'),sessionId:'other',viewId:'w'});
  assert.equal(cache.invalidate({sessionId:'s'}),1);assert.equal(cache.hit('y',fingerprint('f'),0),true);assert.equal(cache.invalidate({displayId:'y'}),1);
  cache.remember('z',entry('z'));assert.equal(cache.invalidate(),1);assert.equal(cache.size,0);
});

test('manifest is read once per build, copies are independent and every change or absence is observed',t=>{
  const root=fixture(t),project=join(root,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<main>manifest</main>');
  const sources=new SourceComponentStore(join(root,'archive')),{buildId}=sources.capture(project).source,manifestPath=join(sources.directory,'builds',buildId,'manifest.json'),builds=join(sources.directory,'builds');
  const cold=countReads(builds,()=>sources.manifest(buildId));assert.equal(cold.calls,1);assert.equal(cold.result!.buildId,buildId);
  const warm=countReads(builds,()=>sources.manifest(buildId));assert.equal(warm.calls,0,'warm manifest is not re-read');assert.deepEqual(warm.result,cold.result);
  warm.result!.files.push('mutated');warm.result!.entry='mutated';assert.deepEqual(sources.manifest(buildId),cold.result,'callers cannot corrupt the memo');
  assert.equal(countReads(builds,()=>sources.verify(buildId)).result.valid,true);assert.equal(countReads(builds,()=>sources.manifest(buildId)).calls,0);
  // Same-size rewrite with a restored mtime still changes ctime, so the memo is not trusted.
  const before=statSync(manifestPath),text=readFileSync(manifestPath,'utf8'),changed=text.replace(buildId.slice(0,8),'0'.repeat(8));assert.equal(changed.length,text.length);
  writeFileSync(manifestPath,changed);utimesSync(manifestPath,before.atime,before.mtime);
  const reread=countReads(builds,()=>sources.manifest(buildId));assert.equal(reread.calls,1);assert.equal(reread.result!.buildId,JSON.parse(changed).buildId);assert.equal(sources.verify(buildId).valid,false);
  writeFileSync(manifestPath,'{not json');assert.throws(()=>sources.manifest(buildId),SyntaxError);writeFileSync(manifestPath,text);assert.equal(sources.manifest(buildId)!.buildId,buildId,'a parse failure is not remembered');
  rmSync(manifestPath);assert.equal(sources.manifest(buildId),undefined,'a removed manifest is not served from memory');assert.equal(sources.verify(buildId).valid,false);
  assert.equal(sources.manifest('f'.repeat(64)),undefined);assert.throws(()=>sources.manifest('not-a-build'),{code:'SOURCE_BUILD_NOT_FOUND'});
});

async function server(t:{after:(fn:()=>Promise<void>|void)=>void}){
  const directory=mkdtempSync(join(tmpdir(),'display-read-path-')),instance=composeAppsRuntime(directory,{connections:[]}),token='a'.repeat(64),http=createAppsServer({...instance,token});
  await new Promise<void>(accept=>http.listen(0,'127.0.0.1',accept));const url=`http://127.0.0.1:${(http.address() as {port:number}).port}`;
  t.after(async()=>{http.closeAllConnections();await new Promise<void>(accept=>http.close(()=>accept()));await instance.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())));rmSync(directory,{recursive:true,force:true,maxRetries:15,retryDelay:200});});
  return {...instance,directory,call:async(path:string)=>{const response=await fetch(url+path,{headers:{authorization:'Bearer '+token}});return {status:response.status,body:await response.json() as any};}};
}

test('view lookup by build returns the legacy result and parses only this view\'s snapshots',async t=>{
  const f=await server(t),project=join(f.directory,'component');mkdirSync(join(project,'dist'),{recursive:true});
  const build=(label:string)=>{writeFileSync(join(project,'dist','index.html'),`<main>${label}</main>`);};
  build('one');const first=f.presentation.openSource('A',project,{title:'View'});
  build('two');const second=f.presentation.openSource('A',project,{title:'View',viewId:first.viewId});
  build('three');const third=f.presentation.openSource('A',project,{title:'View',viewId:first.viewId});
  build('one');const foreign=f.presentation.openSource('B',project,{title:'Foreign'});
  const builds=[first,second,third].map(view=>view.source!.buildId);assert.equal(new Set(builds).size,3);
  const legacy=(sessionId:string,viewId:string,buildId:string)=>f.store.list<{namespace:string;value:AppsView}>('provider_records').filter(row=>row.namespace==='view_revisions').map(row=>row.value).find(view=>view.ownerSessionId===sessionId&&view.viewId===viewId&&view.source?.buildId===buildId);
  const get=(sessionId:string,viewId:string,query:string)=>f.call(`/v1/views/${viewId}?sessionId=${sessionId}&${query}`);
  const check=async()=>{
    for(const buildId of builds){const result=await get('A',first.viewId,'buildId='+buildId);assert.equal(result.status,200);assert.deepEqual(result.body,legacy('A',first.viewId,buildId));}
    for(const [revision,view] of [[1,first],[2,second],[3,third]] as const){const result=await get('A',first.viewId,`buildId=${view.source!.buildId}&viewRevision=${revision}`);assert.equal(result.status,200);assert.equal(result.body.viewRevision,revision);}
    const missing=await get('A',first.viewId,'buildId='+'e'.repeat(64));assert.equal(missing.status,400);assert.equal(missing.body.error.code,'VIEW_REVISION_NOT_FOUND');
    const other=await get('B',first.viewId,'buildId='+builds[0]);assert.equal(other.body.error.code,'VIEW_NOT_OWNED');
    const own=await get('B',foreign.viewId,'buildId='+foreign.source!.buildId);assert.equal(own.status,200);assert.equal(own.body.viewId,foreign.viewId);
    const wrongView=await get('B',foreign.viewId,'buildId='+builds[1]);assert.equal(wrongView.body.error.code,'VIEW_REVISION_NOT_FOUND','another session\'s build never leaks');
  };
  await check();
  const lookup=async()=>{const original=JSON.parse;let count=0;JSON.parse=((...args:Parameters<typeof JSON.parse>)=>{count++;return original(...args);}) as typeof JSON.parse;try{await get('A',first.viewId,'buildId='+builds[1]);}finally{JSON.parse=original;}return count;};
  const quiet=await lookup(),payload='x'.repeat(2000);
  f.store.transaction(()=>{for(let i=0;i<1500;i++)f.store.put('provider_records','noise:'+i,{appId:'hallmark',connectionId:i%2?'other':'c',namespace:'snapshots',recordId:String(i),configRevision:1,value:{payload}});});
  await check();
  const noisy=await lookup();
  assert.equal(noisy,quiet,'unrelated provider records are never parsed');
  assert.match(JSON.stringify(f.store.db.prepare("EXPLAIN QUERY PLAN SELECT json_extract(value_json,'$.value') AS value_json FROM provider_records WHERE json_extract(value_json,'$.namespace')='view_revisions' AND json_extract(value_json,'$.value.ownerSessionId')=?1 AND json_extract(value_json,'$.value.viewId')=?2 AND json_extract(value_json,'$.value.source.buildId')=?3 ORDER BY created_at,id").all('A','v','b')),/provider_records_view_revisions/);
  console.log(JSON.stringify({metric:'view-route-by-build',unrelatedRows:1500,parsesWithoutNoise:quiet,parsesWithNoise:noisy}));
});
