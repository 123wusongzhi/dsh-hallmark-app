import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realSourceSummaries} from '../real-data/corpus.ts';
import {fileURLToPath} from 'node:url';

type Scenario='late-success'|'late-error'|'current-success'|'current-error';
const repository=fileURLToPath(new URL('../../',import.meta.url));
async function runSnapshotRefresh(scenario:Scenario){
  const rows=realSourceSummaries().slice(0,4);assert.equal(rows.length,4);
  const root=join(repository,'artifacts/refresh-review');mkdirSync(root,{recursive:true});
  const directory=mkdtempSync(join(root,'snapshot-refresh-')),entry=join(directory,'test.mjs');
  let passed=false;
  try{
    await build({stdin:{resolveDir:repository,loader:'tsx',contents:`
import React from 'react';
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
import {SnapshotView} from './packages/dsh-plugin/client/snapshot.tsx';
const scenario=${JSON.stringify(scenario)},rows=${JSON.stringify(rows)},late=scenario.startsWith('late-'),failed=scenario.endsWith('-error');
// Source records are unchanged corpus summaries. HTTP response order and times are explicit lifecycle controls.
const origin='http://snapshot.fixture',posts=[],listeners=new Map(),calls=[];
const child={postMessage(message,target){assert.equal(target,origin);posts.push(structuredClone(message));}};
globalThis.window={location:{origin},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)??[])fn(event);return true;},matchMedia(){return {matches:false,addEventListener(){},removeEventListener(){}};}};
globalThis.document={documentElement:{getAttribute:()=>null,className:''}};
globalThis.getComputedStyle=()=>({colorScheme:'light',getPropertyValue:()=>''});globalThis.MutationObserver=class{observe(){}disconnect(){}};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const spec={id:'refresh-view',title:'Recorded source snapshot',kind:'source',source:{buildId:'refresh-build',directory:'local',entry:'index.html',files:['index.html']},layout:{type:'column',children:[]},widgets:[],bindings:[{id:'collected',datasetKey:'collected:replay',fieldMap:{}}]};
const data=(items,time)=>({status:'ok',data:{viewId:spec.id,bindings:[{bindingId:'collected',datasetKey:'collected:replay',payload:{items},state:'ready',dataTime:time,lastSuccessAt:time,provenance:{endpoint:'/api/items'}}],missing:[]}});
let readCount=0,release,tree,pendingRefresh,pendingSignal;
globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).startsWith('/api/hallmark-app'),'no external requests');
  const parsed=new URL(String(url),origin),resource=parsed.searchParams.get('resource');
  if(options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.action,'refresh');assert.equal(body.datasetKey,'collected:replay');calls.push('refresh');return Response.json({status:'ok'});}
  assert.equal(parsed.searchParams.get('sessionId'),'refresh-session');
  if(resource==='sessionView'){calls.push(resource);return Response.json(spec);}
  assert.equal(resource,'sessionViewData');calls.push(resource+'-'+(++readCount));
  if(readCount===1)return Response.json(data(rows.slice(0,2),'2026-10-15T10:00:00Z'));
  // Deliberately ignore AbortSignal at this transport boundary: retired callbacks must still be harmless.
  if(readCount===2)return new Promise((resolve,reject)=>{pendingSignal=options.signal;release=()=>failed?reject(new Error('REFRESH_LIFECYCLE_CONTROL')):resolve(Response.json(late?data(rows.slice(0,2),'2026-10-15T10:01:00Z'):data(rows.slice(2),'2026-10-15T10:02:00Z')));});
  assert.equal(readCount,3);assert.equal(late,true);return Response.json(data(rows.slice(2),'2026-10-15T10:02:00Z'));
};
const latest=()=>{
  const message=posts.filter(row=>row.channel==='hallmark.source.v1'&&row.event==='data').at(-1);
  assert.ok(message,'SnapshotView must deliver a hallmark.source.v1 data message after its scoped reads; rendered alerts: '+JSON.stringify(alerts()));
  assert.ok(message.data,'the snapshot data message must contain a data payload');
  return message.data;
};
const ids=packet=>packet.bindings[0].payload.items.map(row=>row.id);
const alerts=()=>tree.root.findAllByProps({role:'alert'}).map(node=>JSON.stringify(node.children.map(child=>typeof child==='string'?child:child.children)));
try{
  await act(async()=>{tree=create(<SnapshotView sessionId="refresh-session" viewId={spec.id} owned/>,{createNodeMock:node=>node.type==='iframe'?{contentWindow:child}:null});});
  assert.deepEqual(ids(latest()),rows.slice(0,2).map(row=>row.id));
  const refresh=tree.root.findByProps({className:'hm-snapshot-refresh'});assert.equal(refresh.props.disabled,false);
  await act(async()=>{pendingRefresh=refresh.props.onClick();});assert.equal(readCount,2);
  assert.equal(tree.root.findByProps({className:'hm-snapshot-refresh'}).props.disabled,true);
  if(late){
    const retry=tree.root.findByProps({'aria-label':'重试读取'});assert.equal(retry.props.disabled,false);
    await act(async()=>retry.props.onClick());assert.equal(readCount,3);
    assert.deepEqual(ids(latest()),rows.slice(2).map(row=>row.id));assert.equal(latest().bindings[0].dataTime,'2026-10-15T10:02:00Z');
  }
  if(!late)assert.equal(pendingSignal.aborted,false,'a current legitimate refresh must not be cancelled');
  await act(async()=>{release();await pendingRefresh;});
  if(late){
    assert.deepEqual(ids(latest()),rows.slice(2).map(row=>row.id),'an older refresh must not overwrite the completed newer reread');
    assert.equal(latest().bindings[0].dataTime,'2026-10-15T10:02:00Z');
    assert.deepEqual(alerts(),[],'an older refresh error must not downgrade the completed newer reread');
    assert.equal(pendingSignal.aborted,true,'a newer reread must retire the older refresh lifecycle');
  }else if(failed){
    assert.deepEqual(ids(latest()),rows.slice(0,2).map(row=>row.id));assert.equal(latest().bindings[0].dataTime,'2026-10-15T10:00:00Z');
    assert.match(alerts().join(' '),/REFRESH_LIFECYCLE_CONTROL/,'a current refresh error must still be visible');
  }else{
    assert.deepEqual(ids(latest()),rows.slice(2).map(row=>row.id));assert.equal(latest().bindings[0].dataTime,'2026-10-15T10:02:00Z');assert.deepEqual(alerts(),[]);
  }
  assert.equal(tree.root.findByProps({className:'hm-snapshot-refresh'}).props.disabled,false);
  assert.equal(tree.root.findAllByType('iframe').length,1);assert.equal(calls.filter(call=>call==='refresh').length,1);
  console.log('SNAPSHOT_REFRESH_PASS:'+scenario);
}finally{if(tree)await act(async()=>tree.unmount());}
assert.equal([...listeners.values()].reduce((n,set)=>n+set.size,0),0);
`},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{cwd:repository,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true});
    writeFileSync(join(directory,'stdout.txt'),result.stdout??'');writeFileSync(join(directory,'stderr.txt'),result.stderr??'');
    assert.equal(result.status,0,`${result.error?.message??result.stderr}; logs: ${directory}`);assert.match(result.stdout,new RegExp('SNAPSHOT_REFRESH_PASS:'+scenario));passed=true;
  }finally{const within=relative(root,directory);assert.ok(/^snapshot-refresh-[^/\\]+$/.test(within)&&resolve(root,within)===directory);if(passed)rmSync(directory,{recursive:true,force:true,maxRetries:3});}
}

test('a completed newer source reread survives an earlier refresh response',{timeout:30000},()=>runSnapshotRefresh('late-success'));
test('a completed newer source reread is not downgraded by an earlier refresh failure',{timeout:30000},()=>runSnapshotRefresh('late-error'));
test('a current source refresh still replaces the snapshot',{timeout:30000},()=>runSnapshotRefresh('current-success'));
test('a current source refresh failure remains visible and preserves the previous snapshot',{timeout:30000},()=>runSnapshotRefresh('current-error'));
