import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('agent context feedback distinguishes unpublished edits from the prior local service snapshot without loosening pending locks',async()=>{
 mkdirSync('artifacts',{recursive:true});const dir=mkdtempSync(resolve('artifacts/agent-context-feedback-')),entry=join(dir,'probe.mjs');
 try{
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {AppsAgentActions} from './packages/component-runtime/src/apps-react.tsx';
import {ComponentBridgeError} from './packages/component-runtime/src/apps-client.ts';
import {RuntimeStore,AppsRuntime} from './packages/app-runtime/src/index.ts';
import {AppsPresentationService} from './packages/app-presentation/src/index.ts';
import {SourceComponentStore} from './packages/source-components/src/index.ts';
import {createAppsServer} from './packages/service/src/apps-server.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const dir=process.env.PROBE_DIRECTORY,project=join(dir,'source');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist/index.html'),'<p>Local context control</p>');
const store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store),presentation=new AppsPresentationService({store,runtime,sources:new SourceComponentStore(join(dir,'builds'))});runtime.register(presentation.provider());
const view=presentation.openSource('context-feedback',project,{title:'Local context control',bindings:[]});
const identity={protocolVersion:'2.0',sessionId:'context-feedback',viewId:view.viewId,buildId:view.source.buildId,frameInstanceId:'feedback-frame'};
const token='f'.repeat(64),server=createAppsServer({runtime,presentation,token});await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
let updates=0,requests=0,failUpdate=false,holdUpdate=null,tree;
const originalFetch=globalThis.fetch;let externalCalls=0;globalThis.fetch=(url,options)=>{if(!String(url).startsWith(base+'/')){externalCalls++;throw Error('External network forbidden');}return originalFetch(url,options);};
const call=async(method,params)=>{const response=await fetch(base+'/v1/component-bridge',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...identity,channel:'dsh.apps.component.v2',requestId:method+'-'+(method==='updateContext'?updates:requests),method,params})});const value=await response.json();if(value.error)throw new ComponentBridgeError(value.error);return value.result;};
const apps={hello:{...identity,supportedMethods:['updateContext','requestAgent'],contextRevision:0},context:{contextRevision:0},updateContext:async input=>{updates++;if(holdUpdate)await holdUpdate;if(failUpdate)throw Error('Controlled local read failure');const result=await call('updateContext',input);apps.context={contextRevision:result.contextRevision};return result;},requestAgent:async input=>{requests++;return call('requestAgent',input);}};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const button=label=>tree.root.findAllByType('button').find(n=>text(n)===label);
const notice=()=>text(tree.root.findByProps({role:'status'}));
const render=async summary=>{await act(async()=>{const content=<AppsAgentActions apps={apps} selections={[]} summary={summary}/>;if(tree)tree.update(content);else tree=create(content);});};
try{
 await render('Original context');await act(async()=>tree.root.findByType('input').props.onChange({target:{value:'Inspect context'}}));
 await act(async()=>button('更新上下文').props.onClick());assert.equal(button('请求代理').props.disabled,false);assert.match(notice(),/上下文已更新/);
 await render('Changed context');assert.equal(button('请求代理').props.disabled,true);assert.match(notice(),/上下文已更改.*更新上下文/,'unpublished context needs an actionable visible explanation');assert.doesNotMatch(notice(),/上下文已更新/);assert.equal(tree.root.findByType('input').props.value,'Inspect context');
 await act(async()=>button('请求代理').props.onClick());assert.equal(requests,0);assert.equal(updates,1);assert.equal(presentation.contexts.active(identity.sessionId).snapshot.summary,'Original context');
 await render('Original context');assert.equal(button('请求代理').props.disabled,false);assert.match(notice(),/上下文已更新/,'returning to exact published fingerprint restores existing feedback');
 await render('Changed context');failUpdate=true;await act(async()=>button('更新上下文').props.onClick());assert.match(notice(),/Controlled local read failure/);assert.equal(button('请求代理').props.disabled,true);assert.equal(tree.root.findByType('input').props.value,'Inspect context');
 failUpdate=false;await act(async()=>button('更新上下文').props.onClick());assert.equal(presentation.contexts.active(identity.sessionId).snapshot.summary,'Changed context');assert.equal(button('请求代理').props.disabled,false);
 let release;holdUpdate=new Promise(done=>release=done);let pending;await act(async()=>{pending=button('更新上下文').props.onClick();});await render('Changed during publication');assert.match(notice(),/正在更新上下文/);assert.equal(button('请求代理').props.disabled,true);await act(async()=>{release();await pending;});holdUpdate=null;assert.match(notice(),/上下文已更改.*更新上下文/);assert.equal(button('请求代理').props.disabled,true);assert.equal(presentation.contexts.active(identity.sessionId).snapshot.summary,'Changed context');
 await act(async()=>button('更新上下文').props.onClick());await act(async()=>button('请求代理').props.onClick());assert.equal(requests,1);assert.equal(tree.root.findByType('section').props['data-agent-state'],'prepared');assert.match(notice(),/等待派发/);
 await render('Changed after preparation');assert.match(notice(),/等待派发/,'dirty context must never hide pending receipt guidance');assert.equal(button('请求代理').props.disabled,true);assert.equal(button('更新上下文').props.disabled,true);await act(async()=>button('请求代理').props.onClick());assert.equal(requests,1);assert.equal(externalCalls,0);
 console.log('CONTEXT_FEEDBACK_PASS '+JSON.stringify({updates,requests,externalCalls,nativeDispatches:0}));
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise(done=>server.close(done));await runtime.dispose();store.close();}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',env:{...process.env,PROBE_DIRECTORY:dir},timeout:20000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);assert.match(result.stdout,/CONTEXT_FEEDBACK_PASS/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
