import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('explicit React actions keep local selection dirty, publish without wake, lock uncertain submissions and gate methods on a completed native feature probe',async()=>{
  mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync(resolve('artifacts/apps-agent-actions-')),entry=join(directory,'actions.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {AppsAgentActions} from './packages/component-runtime/src/apps-react.tsx';
      import {createAppsComponentHandlers} from './packages/plugin-apps/client/component-handlers.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      let updates=0,requests=0,unknown=false;const inspect=[];
      const apps={hello:{supportedMethods:['updateContext','requestAgent'],contextRevision:0},context:{contextRevision:0},updateContext:async input=>{updates++;assert.equal(input.expectedContextRevision,0);return {status:'updated',contextRevision:1,snapshotId:'snapshot-one',snapshot:{}};},requestAgent:async input=>{requests++;assert.equal(input.expectedContextRevision,1);return {status:unknown?'unknown':'accepted',requestId:'native-'+requests,contextRevision:1};}};
      const first=[{bindingId:'notes',datasetRevision:'1',resources:[{appId:'notes',connectionId:'local',resourceType:'note',resourceId:'one'}]}];
      let tree;await act(async()=>{tree=create(<AppsAgentActions apps={apps} selections={first} onInspectRequest={id=>inspect.push(id)}/>);});
      const button=name=>tree.root.findAllByType('button').find(node=>node.children.join('')===name);
      assert.equal(updates,0);assert.equal(requests,0);assert.equal(button('请求代理').props.disabled,true);
      await act(async()=>button('更新上下文').props.onClick());assert.equal(updates,1);assert.equal(requests,0);
      await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'Analyze explicit snapshot'}}));
      await act(async()=>button('请求代理').props.onClick());assert.equal(requests,1);assert.equal(button('请求代理').props.disabled,true);assert.match(tree.root.findByProps({role:'status'}).children.join(''),/已提交/);
      await act(async()=>button('检查原请求').props.onClick());assert.deepEqual(inspect,['native-1']);
      await act(async()=>button('准备新任务').props.onClick());assert.equal(tree.root.findByType('input').props.value,'');
      const next=[{...first[0],datasetRevision:'2'}];await act(async()=>tree.update(<AppsAgentActions apps={apps} selections={next} onInspectRequest={id=>inspect.push(id)}/>));assert.equal(tree.root.findByType('section').props['data-context-state'],'dirty');assert.equal(updates,1);assert.equal(requests,1);
      await act(async()=>button('更新上下文').props.onClick());unknown=true;await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'Second explicit task'}}));await act(async()=>button('请求代理').props.onClick());assert.equal(requests,2);assert.equal(button('请求代理').props.disabled,true);assert.equal(button('准备新任务'),undefined);await act(async()=>button('请求代理').props.onClick());assert.equal(requests,2);await act(async()=>tree.unmount());
      const originalFetch=globalThis.fetch;let finish;globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});const pending=createAppsComponentHandlers({sessionId:'s',viewId:'v',buildId:'b'},new AbortController().signal);let settled=false;pending.then(()=>settled=true);await Promise.resolve();assert.equal(settled,false);
      finish(Response.json({updateContext:true,requestAgent:true,adapterReady:true,nativeSessionAdapter:'dsh-0.2.0-rc.2',hostVersion:'0.2.0-rc.2'}));const verified=await pending;assert.equal(typeof verified.updateContext,'function');assert.equal(typeof verified.requestAgent,'function');
      for(const capabilities of [{updateContext:true,requestAgent:true,adapterReady:true,nativeSessionAdapter:'disabled',hostVersion:'0.2.0-rc.2'},{updateContext:true,requestAgent:true,adapterReady:false,nativeSessionAdapter:'dsh-0.2.0-rc.2',hostVersion:'0.2.0-rc.2'},{}]){globalThis.fetch=async()=>Response.json(capabilities);const disabled=await createAppsComponentHandlers({sessionId:'s',viewId:'v',buildId:'b'},new AbortController().signal);assert.equal(disabled.updateContext,undefined);assert.equal(disabled.requestAgent,undefined);}
      globalThis.fetch=async()=>{throw new Error('Unavailable');};assert.equal((await createAppsComponentHandlers({sessionId:'s',viewId:'v',buildId:'b'},new AbortController().signal)).requestAgent,undefined);globalThis.fetch=originalFetch;
      console.log(JSON.stringify({localChangesDoNotWake:true,explicitPublish:true,acceptedNotConsumed:true,unknownLocksRepeat:true,featureProbeSettledBeforeAdvertising:true}));
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/"unknownLocksRepeat":true/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
