import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

async function fixture(label:string,body:string){
  const root=resolve('artifacts/performance/ui');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,label+'-')),entry=join(directory,'fixture.mjs');
  const stubs:Record<string,string>={
    'directory.tsx':"export function AppsDirectory(p){return <div>{p.navigation}{p.children}</div>}",
    'view.tsx':"import React,{useEffect} from 'react';export function AppsNativeView(p){useEffect(()=>{globalThis.mounts.push(p.sessionId+':'+p.viewId);return()=>globalThis.disposals.push(p.sessionId+':'+p.viewId);},[]);return <section data-retained-view={p.viewId} data-active={p.active}/>}",
    'library.tsx':"export function AppsLibrary(){return null}",
    'save-controls.tsx':"export function AppsSaveControls(){return null}",
    'workbench-board.tsx':"export function WorkbenchBoard(){return null}",
    'material-library.tsx':"export function MaterialLibrary(){return null}",
    'workbench-component-actions.tsx':"export function CurrentComponentWorkbenchAction(){return null}",
  };
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:setup+body+finish},plugins:[{name:'workspace-children',setup(builder){builder.onLoad({filter:/[\\/]plugin-apps[\\/]client[\\/](directory|view|library|save-controls|workbench-board|material-library|workbench-component-actions)\.tsx$/},args=>({contents:stubs[args.path.split(/[\\/]/).at(-1)!],loader:'tsx',resolveDir:process.cwd()}));}}],outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});writeFileSync(join(directory,'result.json'),JSON.stringify({label,status:result.status,stdout:result.stdout,stderr:result.stderr,scope:'PRODUCTION_WORKSPACE_REACT_WITH_ISOLATED_CHILDREN',actualDesktop:false},null,2));assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/WORKSPACE_PERFORMANCE_PASS/);
}
const setup=`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();globalThis.mounts=[];globalThis.disposals=[];
let tree,hold=false,lose=false,visible=true,session='A';const writes=[],held=new Map();const views=['A','B'].flatMap(ownerSessionId=>['One','Two','Three','Four'].map((title,index)=>({viewId:ownerSessionId+index,ownerSessionId,title:ownerSessionId+' '+title,panelState:'open',bindings:[],viewRevision:1,updatedAt:'2026-10-09'})));
globalThis.fetch=async(url,options)=>{const query=new URL(String(url),'http://fixture').searchParams,body=options?.body?JSON.parse(options.body):undefined;
 if(query.get('resource')==='views')return Response.json({views:views.filter(view=>view.ownerSessionId===query.get('sessionId'))});
 if(query.get('resource')==='view')return Response.json(views.find(view=>view.viewId===query.get('viewId')));
 if(body?.action==='authoring'){writes.push(body);if(lose)throw Error('response lost');if(hold)await new Promise(resolve=>held.set(body.params.viewId,resolve));const view=views.find(view=>view.viewId===body.params.viewId);view.panelState=body.operation==='closeDraft'?'closed':'open';return Response.json(view);}
 throw Error('Unexpected route '+url);
};
const draw=()=> <AppsWorkspace currentSessionId={session} usePanelInfo={selector=>selector({activePanelId:visible?'hallmark-apps':'chat'})}/>;
const wait=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));}),until=async predicate=>{for(let n=0;n<100&&!predicate();n++)await wait();assert.ok(predicate());};
const buttons=()=>tree.root.findAllByType('button'),text=node=>typeof node==='string'?node:node.children?.map(text).join('')??'',button=name=>buttons().find(node=>text(node)===name),label=name=>buttons().find(node=>node.props['aria-label']===name),click=async node=>{assert.ok(node);await act(async()=>node.props.onClick());await wait();},retained=()=>tree.root.findAll(node=>typeof node.props['data-retained-view']==='string');
try{await act(async()=>{tree=create(draw());});await until(()=>!!button('A One'));
`;
const finish=`
}finally{if(tree)await act(async()=>tree.unmount());}
assert.equal(mounts.length,disposals.length);console.log(JSON.stringify({scope:'PRODUCTION_WORKSPACE_REACT_WITH_ISOLATED_CHILDREN',mounts,disposals,writes:writes.map(write=>({sessionId:write.sessionId,operation:write.operation,viewId:write.params.viewId}))}));console.log('WORKSPACE_PERFORMANCE_PASS');
`;
test('workspace keeps three most recently visited source panes, pauses inactive panes and isolates session disposal',()=>fixture('bounded-tabs',`
await click(button('A One'));await click(button('A Two'));await click(button('A One'));assert.deepEqual(mounts,['A:A0','A:A1']);assert.deepEqual(disposals,[]);assert.equal(retained().filter(node=>node.props['data-active']).length,1);
await click(button('A Three'));await click(button('A Four'));assert.equal(retained().length,3);assert.deepEqual(disposals,['A:A1'],'least recently used source pane is released');assert.equal(label('关闭A Two').props.disabled,false,'an evicted pane remains an ordinary reopenable tab');
visible=false;await act(async()=>tree.update(draw()));assert.equal(retained().length,3);assert.equal(retained().filter(node=>node.props['data-active']).length,0);visible=true;await act(async()=>tree.update(draw()));assert.equal(mounts.length,4);
session='B';await act(async()=>tree.update(draw()));await until(()=>!!button('B One'));assert.equal(retained().length,0);assert.equal(disposals.length,4);await click(button('B One'));assert.equal(retained().length,1);assert.equal(mounts.at(-1),'B:B0');
`));
test('panel conflict domains permit different closes while preventing repeated same-view writes and late focus changes',()=>fixture('parallel-panel-actions',`
await click(button('A One'));hold=true;await act(async()=>{label('关闭A One').props.onClick();label('关闭A One').props.onClick();});await until(()=>held.has('A0'));assert.equal(writes.length,1);assert.equal(label('关闭A One').props.disabled,true);assert.equal(label('关闭A Two').props.disabled,false);assert.equal(label('新建组件工作副本').props.disabled,false);
await act(async()=>label('关闭A Two').props.onClick());await until(()=>held.has('A1'));assert.equal(writes.length,2);await click(button('A Three'));
await act(async()=>{held.get('A1')();held.get('A0')();});await until(()=>!label('关闭A One')&&!label('关闭A Two'));assert.equal(button('A Three').props['aria-pressed'],true);assert.ok(label('恢复A One'));assert.ok(label('恢复A Two'));
`));
test('lost panel receipts stay locked until a read confirms the original state and do not block another panel',()=>fixture('uncertain-panel-actions',`
lose=true;await click(label('关闭A One'));assert.equal(writes.length,1);assert.equal(label('关闭A One').props.disabled,true);assert.equal(label('关闭A Two').props.disabled,false);await click(button('检查原关闭：A One'));assert.equal(label('关闭A One').props.disabled,true,'an unchanged open view cannot prove the lost request completed');assert.equal(writes.length,1);
views.find(view=>view.viewId==='A0').panelState='closed';await click(button('检查原关闭：A One'));assert.equal(label('关闭A One'),undefined);assert.ok(label('恢复A One'));assert.equal(button('检查原关闭：A One'),undefined);assert.equal(writes.length,1,'inspection must not repeat the write');
`));
