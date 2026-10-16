import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeDraftBridge} from '../../packages/dsh-plugin/client/native-draft.ts';
import type {NativeInputBinding,NativeInsertionSpan} from '../../packages/dsh-plugin/client/selection-native.ts';
import React from 'react';
import {createRequire} from 'node:module';
import {build} from 'esbuild';

function editor(){
  let draft='保留我的问题与引用',phase='plain',refuse=false;
  const spans:NativeInsertionSpan[]=[],texts:string[]=[],attachments=['existing-reference'];
  const actions={captureInsertion:()=>({start:2,end:5,draftRev:12}),insertText:(text:string,span:NativeInsertionSpan)=>{spans.push(span);texts.push(text);if(refuse)return false;draft=draft.slice(0,span.start)+text+draft.slice(span.end);return true;},addAttachments:()=>{throw new Error('do not mutate attachments');},setDraft:()=>{throw new Error('do not replace the draft');},submit:()=>{throw new Error('do not send messages');}};
  const binding:NativeInputBinding={actions,readState:()=>({phase,attachmentIds:attachments}),disabledReason:()=>undefined};
  return {binding,spans,texts,attachments,read:()=>draft,phase:(value:string)=>{phase=value;},refuse:()=>{refuse=true;}};
}
test('queued request navigates before exact-session insertion, preserves selected text/references, and resolves only after acceptance',async()=>{
  const bridge=new NativeDraftBridge(),native=editor();let accepted=false;
  const promise=bridge.prepare('original','请创建销量数据源',id=>{assert.equal(id,'original');assert.equal(native.texts.length,0);bridge.bind('other',editor().binding);bridge.bind(id,native.binding);}).then(()=>{accepted=true;});
  assert.equal(accepted,false);assert.equal(native.texts.length,0);await promise;
  assert.equal(accepted,true);assert.deepEqual(native.spans,[{start:5,end:5,draftRev:12}]);assert.equal(native.read(),'保留我的问\n\n请创建销量数据源题与引用');assert.deepEqual(native.attachments,['existing-reference']);
  bridge.bind('original',native.binding);await Promise.resolve();assert.equal(native.texts.length,1);bridge.reset();
});
test('submission, unsupported public actions and false insertion reject without replacing or submitting',async()=>{
  for(const phase of ['adjudicating','submitting','unknown']){const bridge=new NativeDraftBridge(),native=editor();native.phase(phase);bridge.bind('s',native.binding);await assert.rejects(bridge.prepare('s','需求',()=>{}),/正在提交|不可编辑/);assert.equal(native.texts.length,0);bridge.reset();}
  const bridge=new NativeDraftBridge(),native=editor();native.refuse();bridge.bind('s',native.binding);await assert.rejects(bridge.prepare('s','需求',()=>{}),/草稿已变化/);assert.equal(native.read(),'保留我的问题与引用');
  bridge.bind('s',{...native.binding,actions:{addAttachments:()=>true}});await assert.rejects(bridge.prepare('s','需求',()=>{}),/宿主不支持/);bridge.reset();
});
test('navigation failure and timeout cannot insert later into a different or newly mounted session',async()=>{
  const bridge=new NativeDraftBridge(15),native=editor();
  await assert.rejects(bridge.prepare('s','需求',()=>{throw new Error('navigation failed');}),/navigation failed/);
  const waiting=bridge.prepare('s','需求',()=>{bridge.bind('other',native.binding);});await assert.rejects(waiting,/尚未就绪/);
  bridge.bind('s',native.binding);await Promise.resolve();assert.equal(native.texts.length,0);bridge.reset();
});
test('new intent, cleanup and duplicate input seats cannot replay an insertion',async()=>{
  const bridge=new NativeDraftBridge(),native=editor();
  const previous=assert.rejects(bridge.prepare('s','旧需求',()=>{}),/新.*需求/);
  const next=bridge.prepare('s','新需求',()=>{const release=bridge.bind('s',native.binding);bridge.bind('s',native.binding);release();});
  await previous;await next;assert.deepEqual(native.texts,['\n\n新需求']);
  const unfinished=assert.rejects(bridge.prepare('other','取消需求',()=>{}),/界面已关闭/);bridge.reset();await unfinished;
});
test('leaving the destination while waiting cancels the pending draft instead of replaying on a later visit',async()=>{
  const bridge=new NativeDraftBridge(),native=editor();bridge.observeSession('s');
  const request=bridge.prepare('s','需求',()=>{}),rejected=assert.rejects(request,/聊天已切换/);
  bridge.observeSession('other');await rejected;bridge.observeSession('s');bridge.bind('s',native.binding);await Promise.resolve();assert.equal(native.texts.length,0);assert.match(bridge.notice('s')??'',/聊天已切换/);bridge.reset();
});
test('plugin native input effect connects the public session slot to the draft bridge',async()=>{
  const require=createRequire(import.meta.url),{create,act}=require('react-test-renderer');
  const bundle=await build({stdin:{contents:"export {createClientPlugin} from './packages/dsh-plugin/client/plugin.ts'; export {prepareNativeDraft,nativeDraftBridge} from './packages/dsh-plugin/client/native-draft.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,external:['react']});
  const compiled={exports:{} as any};new Function('require','module','exports',bundle.outputFiles[0].text)(require,compiled,compiled.exports);
  const {createClientPlugin,prepareNativeDraft,nativeDraftBridge}=compiled.exports,registered=new Map(),cleanups:(()=>void)[]=[],native=editor();
  const component=()=>null,sidebar={mounted:{getSnapshot:()=> 's'},openTab(){}};
  createClientPlugin({sidebarIcon:component,main:()=>component,toolview:component,sidebar:{body:()=>component,title:component,input:()=>component}}).apply({get:(name:string)=>name==='sidebarRight'?sidebar:name==='sidebarRightTabs'?{register:()=>()=>{}}:undefined,slots:{register:(definition:any,value:any)=>{registered.set(definition.id??definition.key,value);return()=>{};},inject:(_name:string,effect:()=>any)=>{const releases=effect();if(typeof releases==='function')cleanups.push(releases);else if(releases)cleanups.push(...releases);}}});
  const Input=registered.get('hallmark-session-components');assert.ok(Input);let tree:any;
  const request=prepareNativeDraft('s','从素材库带回的需求',()=>{act(()=>{tree=create(React.createElement(Input,{sessionId:'s',inputActions:native.binding.actions,useInput:()=>native.binding.readState(),useSession:()=>undefined}));});});
  await request;assert.deepEqual(native.texts,['\n\n从素材库带回的需求']);act(()=>tree.unmount());nativeDraftBridge.reset();for(const cleanup of cleanups)cleanup();
});
