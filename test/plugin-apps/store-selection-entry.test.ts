import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
const REPO_ROOT=fileURLToPath(new URL('../..',import.meta.url));
function spawnFixture(args:string[],options:{input?:string;encoding?:string;timeout?:number}={}){
 const temporaryRoot=resolve(REPO_ROOT,'.test-tmp');mkdirSync(temporaryRoot,{recursive:true});const directory=mkdtempSync(join(temporaryRoot,'navigation-'));
 const child=spawnSync(process.execPath,args,{...options,cwd:REPO_ROOT,windowsHide:true,encoding:'utf8',timeout:20000});
 writeFileSync(join(directory,'stdout.txt'),child.stdout??'');writeFileSync(join(directory,'stderr.txt'),child.stderr??'');
 assert.equal(child.status,0,(child.stdout??'')+(child.stderr??'')+'\nFixture retained at '+directory);
 assert.ok(resolve(directory).startsWith(temporaryRoot+sep+'navigation-'));rmSync(directory,{recursive:true,force:true,maxRetries:3});return child;
}

import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';

test('business store entry returns only after its explicit selection save and cancels stale intents',async t=>{
const stub:Record<string,string>={
'directory.tsx':`export function AppsDirectory(p){return <div>{p.navigation}<button onClick={()=>p.onAppChange('other')}>Other app</button>{p.children}</div>}`,
'library.tsx':`export function AppsLibrary(){return null}`,'view.tsx':`export function AppsNativeView(){return null}`,
'save-controls.tsx':`export function AppsSaveControls(){return null}`,'material-library.tsx':`export function MaterialLibrary(){return null}`,
'workbench-component-actions.tsx':`export function CurrentComponentWorkbenchAction(){return null}`,
'association-overview.tsx':`export function AssociationOverviewPage(){return null}`,
'connection-status.tsx':`export function ConnectionStatusPanel(){return null}`,'business-settings.tsx':`export function BusinessSettings(){return null}`,
};
const output=await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
// Recorded stores; identifiers, empty board and network outcomes are local UX controls.
const stores=[uiStore({id:'shop-a',connectionId:'connection-a'}),uiStore({id:'shop-b',connectionId:'connection-b'},1)];
let board,tree,session,panel,availableStores,storesDenied=false,fail=false,hold=false,release,requests=[],events=0;
const empty=()=>({kind:'workbench',appId:'hallmark',workbenchId:'board',revision:1,instances:[],savedComponents:[]});
globalThis.fetch=async(url,options)=>{
 const resource=new URL(String(url),'http://fixture').searchParams.get('resource'),body=options?.body?JSON.parse(options.body):undefined;
 if(resource==='views')return Response.json({views:[]});if(resource==='stores')return storesDenied?Response.json({error:{code:'ACCESS_DENIED',message:'店铺列表无权读取。'}},{status:403}):Response.json({stores:availableStores});if(resource==='workbench')return Response.json(board);if(resource==='businessSettings')return Response.json({pricing:null});
 requests.push(body);
 if(body.action==='businessOperations'){assert.equal(body.operation,'list','No merchant execution');return Response.json({status:'ok',data:{plans:[]}});}
 assert.equal(body.action,'workbench');assert.equal(body.operation,'save');assert.equal(body.params.expectedRevision,board.revision);
 const next={...board,...body.params,revision:board.revision+1};delete next.expectedRevision;
 if(hold)await new Promise(resolve=>{release=resolve;});
 if(fail){fail=false;return Response.json({status:'failed',error:{code:'ACCESS_DENIED',message:'当前店铺无权保存。'}},{status:403});}
 board=next;return Response.json(board);
};
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(n=>text(n)===name);
const click=async name=>act(async()=>{assert.ok(button(name),'Missing '+name);assert.ok(!button(name).props.disabled);events++;button(name).props.onClick();await flush();});
const active=name=>assert.equal(button(name).props['aria-pressed'],true,'active tab: '+name);
const choose=async id=>act(async()=>{const select=tree.root.findByProps({'aria-label':'当前店铺'});assert.ok(!select.props.disabled);events++;select.props.onChange({target:{value:id}});await flush();});
const render=()=> <AppsWorkspace currentSessionId={session} usePanelInfo={select=>select({activePanelId:panel})}/>;
const mount=async(options={})=>{board=empty();session='chat-a';panel='hallmark-apps';availableStores=stores;storesDenied=false;fail=false;hold=false;release=undefined;requests=[];events=0;if(options.empty)availableStores=[];if(options.denied)storesDenied=true;await act(async()=>{tree=create(render());await flush();});await click('经营操作');};
const unmount=async()=>act(async()=>{tree.unmount();await flush();});
const external=async storeId=>act(async()=>{board={...board,revision:board.revision+1,context:{storeId}};const e=new Event('apps-workbench-changed');e.detail={appId:'hallmark',board};window.dispatchEvent(e);await flush();});
const finish=async()=>act(async()=>{hold=false;release();await flush();});
try{
 await mount();events=0;await click('工作台');await choose('shop-a');active('工作台');await click('经营操作');assert.equal(events,3,'existing route takes three React navigation/change events');await unmount();
 await mount();assert.match(JSON.stringify(tree.toJSON()),/先在工作台选择店铺|选择店铺后/);events=0;
 await click('选择店铺并继续');active('工作台');assert.equal(requests.length,0,'navigation is not a write');await choose('shop-a');active('经营操作');assert.equal(events,2,'two React navigation/change events');assert.equal(requests.filter(r=>r.action==='workbench').length,1);assert.equal(requests.find(r=>r.action==='businessOperations').connectionId,'connection-a');await unmount();
 // Ordinary board reads/events never complete the explicit-selection intent.
 await mount();await click('选择店铺并继续');await external('shop-a');active('工作台');assert.equal(requests.length,0);await choose('shop-b');active('经营操作');await unmount();
 // Failed save stays visible and retryable, but cancels the automatic return.
 await mount();await click('选择店铺并继续');fail=true;await choose('shop-a');active('工作台');assert.match(JSON.stringify(tree.toJSON()),/当前店铺无权保存/);assert.equal(board.context,undefined);await choose('shop-a');active('工作台');await click('经营操作');active('经营操作');await unmount();
 // New navigation cancels a pending receipt, even when returning to the workbench.
 await mount();await click('选择店铺并继续');hold=true;await choose('shop-a');await click('经营设置');await click('工作台');await finish();active('工作台');await unmount();
 // Changing session or application cancels pending completion.
 await mount();await click('选择店铺并继续');hold=true;await choose('shop-a');await act(async()=>{session='chat-b';tree.update(render());await flush();});await finish();active('工作台');assert.equal(requests.filter(r=>r.action==='businessOperations').length,0);await unmount();
 await mount();await click('选择店铺并继续');hold=true;await choose('shop-a');await click('Other app');await finish();active('工作台');assert.equal(button('经营操作'),undefined);await unmount();
 // Repeated selection while saving cannot issue another write; a replaced intent is not consumed by an older receipt.
 await mount();await click('选择店铺并继续');hold=true;await choose('shop-a');assert.equal(tree.root.findByProps({'aria-label':'当前店铺'}).props.disabled,true);
 await act(async()=>{tree.root.findByProps({'aria-label':'当前店铺'}).props.onChange({target:{value:'shop-b'}});await flush();});assert.equal(requests.filter(r=>r.action==='workbench').length,1);
 await click('经营操作');await click('选择店铺并继续');await finish();active('工作台');await choose('shop-b');active('经营操作');await unmount();
 // Leaving the application panel cancels completion even after becoming visible again.
 await mount();await click('选择店铺并继续');hold=true;await choose('shop-a');await act(async()=>{panel='chat';tree.update(render());await flush();});await act(async()=>{panel='hallmark-apps';tree.update(render());await flush();});await finish();active('工作台');await unmount();
 // A newer accepted context cannot be displaced by auto-navigation from an older save receipt.
 await mount();await click('选择店铺并继续');hold=true;await choose('shop-a');await external('shop-b');await external('shop-b');await finish();active('工作台');await unmount();
 // No authorization choices means no default selection and no write.
 await mount({empty:true});await click('选择店铺并继续');assert.equal(tree.root.findByProps({'aria-label':'当前店铺'}).props.disabled,true);assert.equal(requests.length,0);await unmount();
 await mount({denied:true});await click('选择店铺并继续');assert.match(JSON.stringify(tree.toJSON()),/店铺列表无权读取/);assert.equal(tree.root.findByProps({'aria-label':'当前店铺'}).props.disabled,true);assert.equal(requests.length,0);await unmount();
 await mount();await act(async()=>{session=undefined;tree.update(render());await flush();});assert.equal(button('选择店铺并继续'),undefined);assert.match(JSON.stringify(tree.toJSON()),/请选择一个聊天/);await unmount();
 // Normal explicit workbench selection has no return intent.
 await mount();await click('工作台');await choose('shop-a');active('工作台');await unmount();
 console.log('STORE_ENTRY_INTENT_SUCCESS_FAILURE_EVENT_NAVIGATION_SESSION_APP_PASS');
}finally{if(release&&hold)release();if(tree)await act(async()=>tree.unmount());}
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolate-unrelated-children',setup(plugin){plugin.onLoad({filter:/plugin-apps[\\/]client[\\/].*\.tsx$/},args=>{const name=args.path.split(/[\\/]/).at(-1)!;if(stub[name])return {contents:stub[name],loader:'tsx'};});}}]});
const result=spawnFixture(['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/STORE_ENTRY_INTENT_SUCCESS_FAILURE_EVENT_NAVIGATION_SESSION_APP_PASS/);t.diagnostic(result.stdout.trim());
});
