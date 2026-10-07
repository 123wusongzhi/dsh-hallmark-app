import {build} from 'esbuild';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {composeAppsRuntime} from '../packages/service/src/apps-main.ts';
import {createAppsServer} from '../packages/service/src/apps-server.ts';
const root=resolve('artifacts/apps-browser-fixture'),project=join(root,'component');await mkdir(join(project,'dist'),{recursive:true});
const componentSource=await readFile('test/apps-components/fixtures/Component.tsx','utf8');
await writeFile(join(project,'Component.tsx'),componentSource);await writeFile(join(project,'package.json'),JSON.stringify({name:'apps-interaction-fixture',version:'1.0.0',dependencies:{react:'18.3.1','react-dom':'18.3.1'}}));await writeFile(join(project,'package-lock.json'),JSON.stringify({name:'apps-interaction-fixture',lockfileVersion:3,packages:{}}));
await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import Component from './test/apps-components/fixtures/Component.tsx';createRoot(document.getElementById('root')).render(<Component/>);`},outfile:join(project,'dist','component.js'),bundle:true,platform:'browser',format:'esm',define:{'process.env.NODE_ENV':'"production"'}});
await writeFile(join(project,'dist','index.html'),'<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px system-ui;padding:24px}button{margin:8px;padding:12px}output{display:block;padding:16px}</style></head><body><h2>Ordinary source component</h2><div id="root"></div><script type="module" src="component.js"></script></body></html>');
const instance=composeAppsRuntime(join(root,'runtime'),{connections:[{appId:'notes',connectionId:'local',displayName:'Browser fixture Notes',config:{backend:'isolated'},enabled:true,configRevision:1}]});
for(const [appId,connectionId] of [['notes','local'],['apps','presentation']])instance.runtime.bind({sessionId:'s',appId,connectionId,enabled:true,boundAt:new Date().toISOString()});
const seed={protocolVersion:'1.0',appId:'notes',connectionId:'local',invocationId:randomUUID(),traceId:randomUUID(),capabilityId:'notes.notes.create',capabilityVersion:'1.0.0',input:{id:'note-a',title:'Source UI fixture',content:'No external business mutation'},source:{kind:'agent',sessionId:'s',nativeCallId:'fixture'},deadlineAt:new Date(Date.now()+10000).toISOString(),idempotencyKey:'seed'};
await instance.runtime.invoke(seed);
const binding={bindingId:'notes',appId:'notes',connectionId:'local',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}};
let view=instance.presentation.openSource('s',project,{title:'Browser Notes component',bindings:[binding]});await instance.presentation.refreshView('s',view.viewId,{kind:'agent',sessionId:'s',nativeCallId:'refresh'});
const token='b'.repeat(64),runtimeServer=createAppsServer({...instance,token});await new Promise(resolve=>runtimeServer.listen(0,'127.0.0.1',resolve));const runtimeUrl=`http://127.0.0.1:${runtimeServer.address().port}`;
const stats={invocations:0,attachments:0,modelRequests:0,saves:0,restores:0,buildId:view.source.buildId,viewId:view.viewId,componentId:null};
const parent=await build({stdin:{resolveDir:process.cwd(),loader:'js',contents:`
  import {ComponentHost} from './packages/component-runtime/src/host.ts';
  const frame=document.querySelector('iframe');let host;
  const api=async(path,body)=>{const response=await fetch('/runtime'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(JSON.stringify(value));return value;};
  const initial=await api('/v1/views/${view.viewId}/data?sessionId=s');
  const show=async()=>{const stats=await(await fetch('/stats')).json();document.querySelector('#stats').textContent=JSON.stringify(stats);};
  frame.addEventListener('load',()=>{host?.dispose();host=new ComponentHost({protocolVersion:'2.0',sessionId:'s',viewId:'${view.viewId}',buildId:'${view.source.buildId}',frameInstanceId:crypto.randomUUID()},{getData:()=>initial,getContext:()=>({theme:'light'}),invokeCapability:async request=>{await fetch('/count/invoke',{method:'POST'});const params=request.params;const result=await api('/v1/invocations',{protocolVersion:'1.0',...params,invocationId:crypto.randomUUID(),traceId:crypto.randomUUID(),source:{kind:'component',sessionId:'s',viewId:'${view.viewId}',frameInstanceId:request.frameInstanceId}});await show();return result;},attachSelection:async request=>{await fetch('/count/attach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request.params)});await show();return {status:'attached',message:'Fixture attachment; user sends separately.'};}});frame.contentWindow.postMessage(host.hello(),location.origin);});
  window.addEventListener('message',async event=>{if(event.source!==frame.contentWindow||event.origin!==location.origin)return;const response=await host?.handle(event.data);if(response)frame.contentWindow.postMessage(response,location.origin);});
  document.querySelector('#save').onclick=async()=>{const result=await api('/v1/components',{sessionId:'s',viewId:'${view.viewId}',userRequest:'Save this isolated fixture component',mode:'save_as'});await fetch('/saved',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});await show();};
  document.querySelector('#restore').onclick=async()=>{const stats=await(await fetch('/stats')).json();const restored=await api('/v1/views/open',{sessionId:'s',componentId:stats.componentId});await fetch('/restored',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(restored)});document.querySelector('#result').textContent='Restored build '+restored.source.buildId;await show();};
  frame.src='/component/index.html';await show();
`},bundle:true,platform:'browser',format:'esm',write:false});const parentCode=parent.outputFiles[0].text;
const server=createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/runtime/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await fetch(runtimeUrl+req.url.slice('/runtime'.length),{method:req.method,headers:{Authorization:`Bearer ${token}`,...(req.method==='POST'?{'Content-Type':'application/json'}:{})},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')??'application/json'});res.end(Buffer.from(await response.arrayBuffer()));return;}
    if(req.url==='/parent.js'){res.setHeader('Content-Type','text/javascript');res.end(parentCode);return;}
    if(req.url.startsWith('/component/')){const file=req.url.slice('/component/'.length);if(!['index.html','component.js'].includes(file))throw new Error('INVALID_ASSET');res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'text/javascript');res.end(await readFile(join(project,'dist',file)));return;}
    if(req.url==='/stats'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(stats));return;}
    if(req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const input=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
      if(req.url==='/count/invoke')stats.invocations++;if(req.url==='/count/attach'){instance.presentation.validateSelection('s',view.viewId,input);stats.attachments++;}if(req.url==='/saved'){stats.saves++;stats.componentId=input.componentId;}if(req.url==='/restored'){stats.restores++;if(input.source.buildId!==stats.buildId)throw new Error('BUILD_CHANGED');}
      res.end('{}');return;
    }
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px system-ui;padding:24px"><h1>Apps source interaction verification</h1><p>Isolated Notes Runtime • no installed DSH or Hallmark writes</p><button id="save">Save fixture component</button><button id="restore">Restore saved component</button><pre id="stats"></pre><p id="result"></p><iframe title="Source component" style="width:100%;height:400px;border:1px solid #ccc"></iframe><script type="module" src="/parent.js"></script></body></html>');
  }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error.message}));}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
console.log(JSON.stringify({url:`http://127.0.0.1:${server.address().port}`,project,stats}));
const close=async()=>{server.closeAllConnections();runtimeServer.closeAllConnections();await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>runtimeServer.close(resolve));await instance.close();};process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
