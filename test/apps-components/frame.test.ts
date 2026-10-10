import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('React iframe adapter reloads through a correlated hello and cannot resurrect retired documents',async()=>{
  mkdirSync('artifacts',{recursive:true});const directory=mkdtempSync(resolve('artifacts/apps-frame-race-')),entry=join(directory,'frame.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import {AppsSourceFrame} from './packages/dsh-plugin/client/component-frame.tsx';
      import {COMPONENT_CHANNEL} from './packages/component-runtime/src/apps-client.ts';
      const origin='http://apps.fixture',posts=[],listeners=new Set();let finish;
      const child={postMessage:(message,target)=>{assert.equal(target,origin);posts.push(message);}};
      globalThis.window={location:{origin},addEventListener:(_type,listener)=>listeners.add(listener),removeEventListener:(_type,listener)=>listeners.delete(listener)};
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;
      let tree;await act(async()=>{tree=create(<AppsSourceFrame sessionId="s" viewId="v" buildId="b" title="Fixture" url="/source/index.html" data={{}} context={{}} handlers={{getData:()=>({revision:'current'}),getContext:()=>({}),refresh:()=>new Promise(resolve=>{finish=resolve;})}}/>,{createNodeMock:node=>node.type==='iframe'?{contentWindow:child}:null});});
      const emit=(data,source=child,eventOrigin=origin)=>Promise.all([...listeners].map(listener=>listener({data,source,origin:eventOrigin})));
      const hello=(nonce,requestId='hello-'+nonce,protocolVersion='2.0')=>({channel:COMPONENT_CHANNEL,type:'hello',documentNonce:nonce,requestId,protocolVersion});
      tree.root.findByType('iframe').props.onLoad();assert.equal(posts.length,0);
      const assertVisibility=(nonce,identity)=>{const visibility=posts.filter(row=>row.type==='visibility').at(-1);assert.equal(visibility.documentNonce,nonce);assert.equal(visibility.channel,COMPONENT_CHANNEL);assert.equal(visibility.visible,true);for(const key of ['protocolVersion','sessionId','viewId','buildId','frameInstanceId'])assert.equal(visibility[key],identity[key]);};
      await emit(hello('document-a'));const a=posts.filter(row=>row.type==='hello').at(-1);assert.equal(a.requestId,'hello-document-a');assert.equal(a.type,'hello');assertVisibility('document-a',a);
      const request=(identity,requestId,method='getData')=>({channel:COMPONENT_CHANNEL,protocolVersion:identity.protocolVersion,sessionId:identity.sessionId,viewId:identity.viewId,buildId:identity.buildId,frameInstanceId:identity.frameInstanceId,requestId,method,params:null});
      await emit(hello('invalid','hello-invalid','3.0'));assert.equal(posts.at(-1).error.code,'UNSUPPORTED_PROTOCOL');
      await emit(request(a,'still-a'));assert.equal(posts.at(-1).result.revision,'current');
      const pending=emit(request(a,'delayed-a','refresh'));
      const beforeLoad=posts.length;tree.root.findByType('iframe').props.onLoad();assert.equal(posts.length,beforeLoad);
      await emit(hello('document-b'));const b=posts.filter(row=>row.type==='hello').at(-1);assert.equal(b.requestId,'hello-document-b');assert.notEqual(b.frameInstanceId,a.frameInstanceId);assertVisibility('document-b',b);
      const afterB=posts.length;finish({revision:'retired-a'});await pending;assert.equal(posts.length,afterB);
      await emit(hello('document-a'));assert.equal(posts.length,afterB);
      await emit(request(a,'old-request'));assert.equal(posts.length,afterB);
      await emit(hello('foreign'),{},origin);await emit(hello('foreign-origin'),child,'http://other.fixture');assert.equal(posts.length,afterB);
      await emit(request(b,'current-b'));assert.equal(posts.at(-1).result.revision,'current');
      const beforeUnmount=posts.length;await act(async()=>tree.unmount());await emit(hello('after-close'));assert.equal(posts.length,beforeUnmount);assert.equal(listeners.size,0);
      console.log(JSON.stringify({reloads:1,retiredDocumentsRejected:true,unknownProtocolPreservedCurrentFrame:true,installedDshCovered:false}));
    `},banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/"retiredDocumentsRejected":true/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
