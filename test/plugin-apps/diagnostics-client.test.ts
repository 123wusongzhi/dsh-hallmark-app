import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('diagnostics UI copies four linked IDs from the actual scoped Host HTTP query, locates a Provider failure, reports clipboard failure, and sends no model or invocation',async()=>{
  const artifactRoot=resolve('artifacts');mkdirSync(artifactRoot,{recursive:true});
  const directory=mkdtempSync(join(artifactRoot,'apps-diagnostics-')),entry=join(directory,'fixture.mjs');
  assert.ok(resolve(directory).startsWith(artifactRoot+sep));
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import {AppsRuntime,RuntimeStore} from './packages/app-runtime/src/index.ts';
      import {NotesProvider} from './packages/app-notes/src/index.ts';
      import {createAppsServer} from './packages/service/src/apps-server.ts';
      import {AppsHost,HttpAppsHostTransport} from './packages/plugin-apps/src/index.ts';
      import {AppsDirectory} from './packages/plugin-apps/client/directory.tsx';
      const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),agents=new Map([['A',{id:'A'}],['B',{id:'B'}]]);
      runtime.register(new NotesProvider({store}));runtime.addConnection({appId:'notes',connectionId:'n',displayName:'Notes fixture',enabled:true,config:{},configRevision:1});
      const results={};
      for(const sessionId of ['A','B']){
        runtime.bind({sessionId,appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
        const request={protocolVersion:'1.0',appId:'notes',connectionId:'n',invocationId:'seed-'+sessionId,traceId:'seed-trace-'+sessionId,capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{id:'note-'+sessionId,title:sessionId,content:'Fixture'},source:{kind:'script',sessionId,runId:'seed-run-'+sessionId,stepKey:'create'},idempotencyKey:'seed-intent-'+sessionId,deadlineAt:new Date(Date.now()+30000).toISOString()};
        assert.equal((await runtime.invoke(request)).status,'ok');
        results[sessionId]=await runtime.invoke({...request,invocationId:'diagnostic-'+sessionId,traceId:'trace-'+sessionId,source:{kind:'script',sessionId,runId:'run-'+sessionId,stepKey:'conflicting-create'},idempotencyKey:'failure-intent-'+sessionId});
        assert.equal(results[sessionId].status,'failed');assert.equal(results[sessionId].error.code,'REVISION_CONFLICT');
      }
      const server=createAppsServer({runtime,token:'x'.repeat(64)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const host=new AppsHost({tools:{register:()=>()=>{}},agents:{get:id=>agents.get(id)},connection:{fetch:{register:()=>async()=>{}}}},new HttpAppsHostTransport('http://127.0.0.1:'+server.address().port,'x'.repeat(64)));
      await host.start();const detach=host.attachApp('notes'),nativeFetch=globalThis.fetch,requests=[],clipboardCalls=[];let clipboardFails=false,modelRequests=0,tree;
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      globalThis.window=new EventTarget();
      Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{clipboardCalls.push(text);if(clipboardFails)throw new Error('Clipboard denied fixture');}}}});
      globalThis.fetch=async(target,options)=>{const value=String(target);requests.push({url:value,method:options?.method??'GET'});if(value.startsWith('/api/dsh-apps'))return host.ui(new Request('http://client.fixture'+value,options));if(value.includes('model'))modelRequests++;return nativeFetch(target,options);};
      const settle=()=>new Promise(resolve=>setTimeout(resolve,50));
      const copyButton=()=>tree.root.findAllByType('button').find(button=>button.children.join('')==='复制诊断标识');
      const visibleCodes=()=>tree.root.findAllByType('code').map(node=>node.children.join(''));
      try{
        const before=store.list('invocations').length;
        await act(async()=>{tree=create(<AppsDirectory currentSessionId="A"/>);await settle();});
        assert.deepEqual(visibleCodes().slice(0,4),['diagnostic-A','trace-A',results.A.operation.operationId,'run-A']);assert.ok(!visibleCodes().includes('diagnostic-B'));
        await act(async()=>{copyButton().props.onClick();await settle();});
        assert.deepEqual(JSON.parse(clipboardCalls[0]),{invocationId:'diagnostic-A',traceId:'trace-A',operationId:results.A.operation.operationId,runId:'run-A',appId:'notes',connectionId:'n',capabilityId:'notes.notes.create',capabilityVersion:'1.0.0'});
        const copied=JSON.parse(clipboardCalls[0]),invocation=store.get('invocations',copied.invocationId),operation=store.get('operations',copied.operationId),providerRecord=store.list('provider_records').find(row=>row.appId==='notes'&&row.connectionId===copied.connectionId&&row.namespace==='operations'&&row.recordId===copied.operationId);
        assert.equal(invocation.request.traceId,copied.traceId);assert.equal(invocation.parentRunId,copied.runId);assert.equal(invocation.operationId,copied.operationId);assert.equal(invocation.result.error.code,'REVISION_CONFLICT');assert.equal(operation.state,'failed');assert.equal(operation.request.invocationId,copied.invocationId);assert.equal(providerRecord.value.result.invocationId,copied.invocationId);assert.equal(providerRecord.value.result.traceId,copied.traceId);assert.equal(providerRecord.value.result.error.code,'REVISION_CONFLICT');
        assert.equal(tree.root.findByProps({role:'status'}).children.join(''),'调用诊断标识已复制。');
        clipboardFails=true;await act(async()=>{copyButton().props.onClick();await settle();});
        assert.equal(tree.root.findByProps({role:'status'}).children.join(''),'请从下方调用标识选择文字并复制。');
        clipboardFails=false;await act(async()=>{tree.update(<AppsDirectory currentSessionId="B"/>);await settle();});
        assert.deepEqual(visibleCodes().slice(0,4),['diagnostic-B','trace-B',results.B.operation.operationId,'run-B']);assert.ok(!visibleCodes().includes('diagnostic-A'));
        await act(async()=>{copyButton().props.onClick();await settle();});
        assert.equal(JSON.parse(clipboardCalls[2]).invocationId,'diagnostic-B');assert.equal(clipboardCalls.length,3);
        await act(async()=>{tree.update(<AppsDirectory/>);await settle();});assert.equal(copyButton(),undefined);assert.equal(visibleCodes().length,0);
        assert.equal(store.list('invocations').length,before);assert.equal(requests.filter(row=>row.method==='POST').length,0);assert.equal(modelRequests,0);
        assert.deepEqual(requests.filter(row=>row.url.includes('resource=diagnostics')).map(row=>row.url.split('sessionId=')[1]),['A','B']);
        console.log(JSON.stringify({actualHostHttp:true,currentSessionFiltered:true,linkedIdKinds:4,clipboardCalls:3,clipboardFailureVisible:true,runtimeAndProviderFailureLocated:true,newInvocations:0,modelRequests,installedDshGuiCovered:false}));
      }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;detach();await host.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.dispose();store.close();}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/"clipboardFailureVisible":true/);assert.match(result.stdout,/"modelRequests":0/);
  }finally{assert.ok(resolve(directory).startsWith(artifactRoot+sep));rmSync(directory,{recursive:true,force:true});}
});
