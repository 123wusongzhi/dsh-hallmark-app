import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import type {JsonValue} from '../../packages/app-contracts/src/index.ts';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../../packages/source-components/src/authoring-evidence.ts';
import {startAuthoringPreview} from '../../packages/source-components/src/authoring-preview.ts';
// @ts-expect-error Real standalone runner has no generated declarations.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const legacyPath=resolve('test/performance/fixtures/legacy-apps-client.ts.txt');
const legacyHash='9244bf7e0953f2ee1eab70573cbb5c07899a40d3cc7b1c9b6eb093b48d91e315';
const text='中😀国'.repeat(33300),textHash=createHash('sha256').update(text).digest('hex');
const data:JsonValue={viewId:'preview',bindings:[{bindingId:'main',appId:'app',connectionId:'connection',datasetId:'dataset',revision:'r1',state:'ready',freshness:'fresh',payload:{text,cache:{policy:'manual'}},resources:[]}]};
function directory(name:string){const root=resolve('artifacts/performance/ui',name+'-'+randomUUID());mkdirSync(root,{recursive:true});return root;}
function archive(root:string){const workspace=join(root,'workspace');mkdirSync(join(workspace,'dist'),{recursive:true});writeFileSync(join(workspace,'dist','index.html'),'<main>Frozen bridge fixture</main>');const sources=new SourceComponentStore(join(root,'archive')),source=sources.capture(workspace).source;return {sources,source};}
async function request(preview:Awaited<ReturnType<typeof startAuthoringPreview>>,message:unknown){const response=await fetch(preview.url+'/bridge',{method:'POST',headers:{origin:preview.url,'content-type':'application/json'},body:JSON.stringify(message)});const result=await response.json();assert.ok(Buffer.byteLength(JSON.stringify(result))<=262144);return result as any;}
const hello=(nonce:string)=>({channel:'dsh.apps.component.v2',type:'hello',protocolVersion:'2.0',requestId:'hello-'+nonce,documentNonce:nonce,clientFeatures:['dataTransferV1','bindingPagesV1']});

test('preview transfers bind every chunk to the granted document, validate strict methods and reject stale async data',async()=>{
  const root=directory('preview-transfer-protocol'),{sources,source}=archive(root);let refreshCalls=0,pageCalls=0,release:((value:JsonValue)=>void)|undefined,receivedPage:JsonValue;
  const preview=await startAuthoringPreview({sources,buildId:source.buildId,mode:'fixture',data,refreshData:async()=>{refreshCalls++;return new Promise(resolve=>{release=resolve;});},readBindingPage:async params=>{pageCalls++;receivedPage=params;return data;}});
  const extension=(action:string,params:JsonValue)=>({...preview.identity,channel:'dsh.apps.component.v2',type:'extension',feature:'dataTransferV1',action,requestId:randomUUID(),params});
  try{
    const accepted=await request(preview,hello('first'));assert.ok(accepted.features.includes('dataTransferV1'));assert.equal(accepted.maxMessageBytes,262144);
    const prepared=await request(preview,extension('prepare',{method:'getData',documentNonce:'first'})),id=prepared.result.transfer.id;assert.equal(prepared.result.kind,'dsh.data-transfer.v1');
    assert.equal((await request(preview,extension('read',{id,index:0,documentNonce:'first'}))).result.index,0);
    assert.equal((await request(preview,extension('read',{id,index:0,documentNonce:'wrong'}))).error.code,'BRIDGE_IDENTITY_STALE');
    const foreign=await request(preview,{...extension('read',{id,index:0,documentNonce:'first'}),frameInstanceId:'foreign'});assert.equal(foreign.error,'INVALID_BRIDGE_MESSAGE');
    for(const params of [{method:'getData',extra:true},{method:'refresh',options:false},{method:'refresh',options:{forceRefresh:'true'}},{method:'refresh',options:{bindingIds:[1]}},{method:'readBindingPage',bindingId:5},{method:'readBindingPage',bindingId:'main',cursor:4},{method:'getData',knownRevision:'invalid'}])assert.equal((await request(preview,extension('prepare',{...params,documentNonce:'first'} as unknown as JsonValue))).error.code,'INVALID_INPUT');
    assert.equal(refreshCalls,0);assert.equal(pageCalls,0);
    const invalidHello=await request(preview,{...hello('invalid'),viewId:'foreign'});assert.equal(invalidHello.error,'Invalid preview hello envelope.');
    assert.equal((await request(preview,extension('read',{id,index:0,documentNonce:'first'}))).result.index,0,'invalid hello cannot clear valid transfers');
    await request(preview,extension('prepare',{method:'readBindingPage',bindingId:'main',cursor:null,documentNonce:'first'}));assert.equal(pageCalls,1);assert.deepEqual(receivedPage!,{bindingId:'main',cursor:null,dataTransfer:true});
    const legacyPage={...preview.identity,channel:'dsh.apps.component.v2',type:'extension',feature:'bindingPagesV1',action:'read',requestId:'legacy-page',params:{bindingId:'main',cursor:null,documentNonce:'first'}};
    assert.equal((await request(preview,legacyPage)).error.code,'BRIDGE_MESSAGE_TOO_LARGE');assert.deepEqual(receivedPage!,{bindingId:'main',cursor:null});
    const pending=request(preview,extension('prepare',{method:'refresh',options:{forceRefresh:true},documentNonce:'first'}));for(let n=0;n<100&&!release;n++)await new Promise(resolve=>setTimeout(resolve,5));assert.ok(release);
    await request(preview,hello('second'));release!({viewId:'preview',bindings:[]});assert.equal((await pending).error.code,'BRIDGE_IDENTITY_STALE');
    assert.equal((await request(preview,extension('read',{id,index:0,documentNonce:'first'}))).error.code,'BRIDGE_IDENTITY_STALE');
    assert.equal((await request(preview,extension('read',{id,index:0,documentNonce:'second'}))).error.code,'DATA_TRANSFER_EXPIRED');
    const current=await request(preview,extension('prepare',{method:'getData',documentNonce:'second'}));assert.ok(current.result.transfer,'late prior refresh cannot replace the new document snapshot');
    const oversized=await request(preview,{...preview.identity,channel:'dsh.apps.component.v2',requestId:'legacy-data',method:'getData',params:null});assert.equal(oversized.error.code,'BRIDGE_MESSAGE_TOO_LARGE');
    assert.ok(preview.events.some(event=>event.method==='dataTransferChunk'&&!event.error));assert.equal(preview.events.filter(event=>event.method==='getData'&&!event.error).length,2);assert.ok(preview.events.some(event=>event.method==='readBindingPage'&&!event.error));
    writeFileSync(join(root,'result.json'),JSON.stringify({pass:true,messageLimit:262144,events:preview.events,identity:preview.identity},null,2));
  }finally{await preview.close();}
  const compatibility=await startAuthoringPreview({sources,buildId:source.buildId,mode:'fixture',data:{}});try{assert.ok(!(await request(compatibility,hello('legacy-empty'))).features?.includes('dataTransferV1'));assert.deepEqual((await request(compatibility,{...compatibility.identity,channel:'dsh.apps.component.v2',requestId:'data',method:'getData',params:null})).result,{});}finally{await compatibility.close();}
});

async function project(root:string,legacy:boolean){
  const workspace=join(root,'workspace');mkdirSync(workspace,{recursive:true});
  const sdk=legacy?`import {createAppsClient} from 'legacy-sdk';const client=createAppsClient();const apps={};client.getData().then(data=>{apps.data=data;show(data);},error=>{document.querySelector('#data').textContent=error.code;});`:`import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';import {useApps} from './packages/component-runtime/src/apps-react.tsx';function Component(){const apps=useApps(),[summary,setSummary]=useState('loading'),[refreshed,setRefreshed]=useState(false);useEffect(()=>{if(apps.data)describe(apps.data).then(setSummary);},[apps.data]);return <main><h1>Large binding preview</h1><output id="data">{apps.error?.code??apps.error?.message??summary}</output><button id="refresh" onClick={()=>apps.refresh().then(()=>setRefreshed(true))}>Refresh</button><output id="refreshed">{String(refreshed)}</output></main>;}createRoot(document.querySelector('#app')).render(<Component/>);`;
  const contents=`async function describe(data){const bytes=new TextEncoder().encode(data.bindings[0].payload.text),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');return bytes.length+':'+hash;}async function show(data){document.querySelector('#data').textContent=await describe(data);}${sdk}`;
  await build({stdin:{contents,resolveDir:process.cwd(),loader:'tsx'},outfile:join(workspace,'source.js'),bundle:true,platform:'browser',format:'esm',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"'},plugins:legacy?[{name:'frozen-legacy-sdk',setup(build){build.onResolve({filter:/^legacy-sdk$/},()=>({path:legacyPath,namespace:'historical'}));build.onLoad({filter:/.*/,namespace:'historical'},()=>({contents:readFileSync(legacyPath,'utf8'),loader:'ts',resolveDir:resolve('packages/component-runtime/src')}));}}]:[]});
  writeFileSync(join(workspace,'source.html'),`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;font:16px sans-serif}main{max-width:100%;overflow-wrap:anywhere}button{display:block;margin-top:12px}</style></head><body>${legacy?'<main><h1>Large binding preview</h1><output id="data">loading</output></main>':'<div id="app"></div>'}<script type="module" src="./source.js"></script></body></html>`);
  writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'build.mjs'),"import{mkdirSync,copyFileSync}from'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('source.html','dist/index.html');copyFileSync('source.js','dist/source.js');");
  const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence')),attemptId=legacy?'legacy-large':'current-large';
  const built=await runner.build({attemptId,epoch:1,sourceRevision:1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});assert.equal(built.report.verdict,'PASS');return {attemptId,epoch:1,buildReceiptId:'test-build',buildReportRef:built.reportRef,mode:'fixture',sources,runner,browserExecutable:browser,data};
}

test('real Chrome formal previews reassemble a 333 KB binding at 420 and 1040 while the frozen old SDK fails the unchanged message limit',{skip:!existsSync(browser),timeout:90000},async()=>{
  const root=directory('large-preview'),newRoot=join(root,'current'),oldRoot=join(root,'legacy');mkdirSync(newRoot);mkdirSync(oldRoot);
  assert.equal(createHash('sha256').update(readFileSync(legacyPath)).digest('hex'),legacyHash,'the historical SDK fixture is the exact candidate55 verification baseline');
  const expected=Buffer.byteLength(text)+':'+textHash;
  const current=await project(newRoot,false),passed=await runAuthoringPreview({...current,requiredMethods:['getData','refresh'],assertions:[{id:'complete-data',selector:'#data',check:'text',expected},{id:'refresh',action:'click',selector:'#refresh',checkSelector:'#refreshed',check:'text',expected:'true'},{id:'complete-refresh',selector:'#data',check:'text',expected}],refreshData:data});
  assert.equal(passed.report.verdict,'PASS',JSON.stringify(passed.report));current.runner.verifyPreview(passed.reportRef,current.sources);assert.deepEqual(passed.report.viewportResults.map((view:any)=>view.contentWidthCssPx),[420,1040]);
  for(const view of passed.report.viewportResults){assert.ok(view.bridgeCalls.some((event:any)=>event.method==='getData'&&!event.error));assert.equal(view.bridgeCalls.filter((event:any)=>event.method==='dataTransferChunk').length,6,'initial read fetches six chunks; unchanged refresh fetches none');assert.ok(view.bridgeCalls.some((event:any)=>event.method==='refresh'&&!event.error));assert.deepEqual(view.pageErrors,[]);assert.deepEqual(view.unhandledRejections,[]);assert.ok(existsSync(view.screenshot.path));}
  const legacy=await project(oldRoot,true),failed=await runAuthoringPreview({...legacy,assertions:[{id:'old-limit',selector:'#data',check:'text',expected:'BRIDGE_MESSAGE_TOO_LARGE'}],noninteractiveReason:'Compatibility diagnostic for a blocked data read.'});
  assert.equal(failed.report.verdict,'FAIL');assert.deepEqual(failed.report.viewportResults.map((view:any)=>view.contentWidthCssPx),[420,1040]);for(const view of failed.report.viewportResults){assert.ok(view.bridgeCalls.some((event:any)=>event.method==='getData'&&event.error==='BRIDGE_MESSAGE_TOO_LARGE'));assert.equal(view.bridgeCalls.filter((event:any)=>event.method==='dataTransferChunk').length,0);}
  const evidence={scope:'REAL_CHROME_FORMAL_DUAL_VIEWPORT',dataBytes:Buffer.byteLength(JSON.stringify(data)),messageLimit:262144,newSdk:{verdict:passed.report.verdict,reportRef:passed.reportRef,summaryPath:passed.summaryPath},legacySdk:{verdict:failed.report.verdict,reportRef:failed.reportRef,sha256:legacyHash,source:'candidate55-report-verification/baseline/packages/component-runtime/src/apps-client.ts'},viewports:[420,1040],firstReadChunksPerViewport:6,unchangedRefreshChunks:0};writeFileSync(join(root,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
});
