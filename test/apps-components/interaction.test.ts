import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('ordinary React component performs 100 local interactions, one explicit bridge action and one manual-send attachment',async()=>{
  mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync(resolve('artifacts/apps-component-interaction-')),entry=join(directory,'interaction.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import Component from './test/apps-components/fixtures/Component.tsx';
      import {ComponentHost} from './packages/component-runtime/src/host.ts';
      const identity={protocolVersion:'2.0',sessionId:'session-a',viewId:'view-a',buildId:'build-a',frameInstanceId:'frame-a'};
      const events=[],posts=[],listeners=new Set();let invocationCalls=0,attachmentCalls=0;
      const resource={appId:'notes',connectionId:'local',resourceType:'note',resourceId:'note-a'};
      const host=new ComponentHost(identity,{
        getData:()=>({bindingId:'notes',revision:'2',resources:[resource]}),getContext:()=>({contextRevision:0}),
        invokeCapability:()=>{invocationCalls++;return {invocationId:'call-a',traceId:'trace-a',status:'pending',operation:{operationId:'op-a',state:'pending'},pollAfterMs:100};},
        attachSelection:request=>{assert.deepEqual(request.params,{bindingId:'notes',datasetRevision:'2',resources:[resource]});attachmentCalls++;return {status:'attached',message:'Send this attachment manually.'};},
      });
      const parent={postMessage:message=>{posts.push(message);void host.handle(message).then(response=>{if(response)for(const listener of listeners)listener({source:parent,origin:'http://apps.fixture',data:response});});}};
      globalThis.window={parent,location:{origin:'http://apps.fixture'},addEventListener:(_type,listener)=>listeners.add(listener),removeEventListener:(_type,listener)=>listeners.delete(listener)};
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      let tree;await act(async()=>{tree=create(<Component/>);});
      const button=name=>tree.root.findByProps({'data-action':name});
      const initialPosts=posts.length;
      for(let i=0;i<100;i++)await act(async()=>button(i%2===0?'sort':'select').props.onClick());
      assert.equal(posts.length,initialPosts);assert.equal(invocationCalls,0);assert.equal(attachmentCalls,0);
      await act(async()=>button('invoke').props.onClick());assert.equal(invocationCalls,1);assert.equal(tree.root.findByType('output').children.join(''),'pending');
      if(!button('select').props['aria-pressed'])await act(async()=>button('select').props.onClick());
      await act(async()=>button('attach').props.onClick());assert.equal(attachmentCalls,1);assert.equal(tree.root.findByType('output').children.join(''),'attached');
      assert.ok(posts.every(post=>post.method!=='requestAgent'&&post.method!=='updateContext'));
      await act(async()=>tree.unmount());assert.equal(listeners.size,0);
      console.log(JSON.stringify({fixtureKind:'bridge-handler',localInteractions:100,invocationCalls,attachmentCalls,modelRequests:0,installedDshCovered:false,guiVerified:false}));
    `},banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/"localInteractions":100/);assert.match(result.stdout,/"invocationCalls":1/);assert.match(result.stdout,/"modelRequests":0/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
