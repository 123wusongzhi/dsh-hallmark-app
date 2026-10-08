import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
async function fixture(label:string,body:string){
 mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync(resolve('artifacts/sdk-display-error-'+label+'-')),entry=join(directory,'fixture.mjs');const contents=setup+body+finish;
 writeFileSync(join(directory,'fixture.tsx'),contents,{flag:'wx'});await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024});writeFileSync(join(directory,'stdout.txt'),result.stdout??'',{flag:'wx'});writeFileSync(join(directory,'stderr.txt'),result.stderr??'',{flag:'wx'});writeFileSync(join(directory,'command.json'),JSON.stringify({label,command:[process.execPath,entry],exitCode:result.status,error:result.error?.message??null,scope:'ISOLATED_PRODUCTION_REACT_COMPONENT_HOST',actualDesktop:false,actualRuntime:false},null,2)+'\n',{flag:'wx'});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/SDK_DISPLAY_ERRORS_PASS/);
}
const setup=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';import {useApps} from './packages/component-runtime/src/apps-react.tsx';import {ComponentHost} from './packages/component-runtime/src/host.ts';import {ComponentBridgeError,COMPONENT_CHANNEL} from './packages/component-runtime/src/apps-client.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const events=new Map(),messages=[],readyRequests=[],identity={protocolVersion:'2.0',sessionId:'A',viewId:'V',buildId:'same-preview',frameInstanceId:'F'},origin='http://sdk.fixture';let failData=false,failReady=false,app,tree,failure;
const host=new ComponentHost(identity,{getData:()=>{if(failData)throw Object.assign(Error('initial data unavailable'),{code:'DATA_UNAVAILABLE'});return {bindings:[]};},getContext:()=>({publication:{publicationId:'P1',attemptId:'attempt',attemptEpoch:1},display:{displayId:'display-one',generation:1}}),invokeCapability:()=>{throw new ComponentBridgeError({code:'INVALID_INPUT',message:'ordinary user input validation',retryPolicy:'never'});}},{extensionHandlers:{renderReadyV1:request=>{readyRequests.push(request);if(failReady)throw Object.assign(Error('actual readiness failed'),{code:'DISPLAY_READY_FAILED'});return {display:{displayId:'display-one',state:'ready'}};}}});
const parent={postMessage(message,target){assert.equal(target,origin);messages.push(message);if(message.type==='display-error')return;void Promise.resolve(host.handle(message)).then(response=>{if(response)for(const listener of events.get('message')??[])listener({source:parent,origin,data:response});});}},child={location:{origin},parent,addEventListener(type,listener){const rows=events.get(type)??new Set();rows.add(listener);events.set(type,rows);},removeEventListener(type,listener){events.get(type)?.delete(listener);}};globalThis.window=child;
function Component(){app=useApps();return <p>{app.loading?'loading':app.error?.message??'rendered'}</p>;}
const settle=(ms=10)=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,ms));}),until=async(predicate)=>{for(let n=0;n<100&&!predicate();n++)await settle();assert.ok(predicate());},diagnostics=()=>messages.filter(row=>row.type==='display-error'),render=async()=>{await act(async()=>{tree=create(<Component/>);});};
try {
`;
const finish=`
}catch(error){failure=error instanceof Error?error.stack:String(error);}finally{if(tree)await act(async()=>tree.unmount());host.dispose();for(const rows of events.values())assert.equal(rows.size,0);}
console.log(JSON.stringify({scope:'ISOLATED_PRODUCTION_REACT_COMPONENT_HOST',actualDesktop:false,actualRuntime:false,messages,readyRequests,cleanup:{listenerCount:[...events.values()].reduce((n,rows)=>n+rows.size,0)},failure},null,2));if(failure){console.error(failure);process.exitCode=1;}else console.log('SDK_DISPLAY_ERRORS_PASS');
`;
test('SDK reports initial data failure with a bounded phase/code/message and no render-ready success',()=>fixture('data',`
failData=true;await render();await until(()=>!!app.error);assert.ok(diagnostics().some(row=>row.error.phase==='data'&&row.error.code==='DATA_UNAVAILABLE'&&row.error.message==='initial data unavailable'));assert.equal(readyRequests.length,0);assert.ok(diagnostics().every(row=>row.documentNonce&&row.channel===COMPONENT_CHANNEL&&row.frameInstanceId==='F'));
`));
test('SDK actual React effect reports readiness failure instead of claiming the display succeeded',()=>fixture('ready',`
failReady=true;await render();await until(()=>diagnostics().some(row=>row.error.phase==='readiness'));assert.equal(readyRequests.length,1);assert.equal(readyRequests[0].params.checks.rendered,true);assert.equal(readyRequests[0].params.checks.bridgeReady,true);assert.equal(readyRequests[0].params.checks.dataRead,true);assert.ok(diagnostics().some(row=>row.error.code==='DISPLAY_READY_FAILED'));
`));
test('SDK keeps handled business failures out of display diagnostics and captures actual unhandled script errors',()=>fixture('business-script',`
await render();await until(()=>readyRequests.length===1);let error;try{await app.invokeCapability({capabilityId:'fixture.read'});}catch(reason){error=reason;}assert.ok(error instanceof ComponentBridgeError);assert.equal(error.code,'INVALID_INPUT');for(const listener of events.get('unhandledrejection')??[])listener({type:'unhandledrejection',reason:error});assert.equal(diagnostics().length,0);for(const listener of events.get('error')??[])listener({type:'error',message:'actual uncaught component exception'});assert.equal(diagnostics().length,1);assert.equal(diagnostics()[0].error.phase,'script');assert.equal(diagnostics()[0].error.code,'COMPONENT_SCRIPT_ERROR');assert.equal(messages.filter(row=>row.method==='invokeCapability').length,1);
`));