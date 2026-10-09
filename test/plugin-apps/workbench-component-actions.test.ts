import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('component workbench entry pins saved items, saves current views once and recovers lost receipts without duplicate saves',async()=>{
 const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workbench-actions-')),entry=join(directory,'fixture.mjs');
 try{
  await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {PinSavedComponentButton,CurrentComponentWorkbenchAction} from './packages/plugin-apps/client/workbench-component-actions.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
let board={kind:'workbench',appId:'hallmark',workbenchId:'main',revision:1,instances:[{instanceId:'keep'}],savedComponents:[]},tree,saveLoss=false,pinLoss=false,receipt;const requests=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const body=options?.body?JSON.parse(options.body):undefined,query=new URL(String(url),'http://fixture').searchParams;requests.push(body??{resource:query.get('resource')});
 if(!body){if(query.get('resource')==='workbench')return Response.json(board);if(query.get('resource')==='presentationRequest')return Response.json({invocation:receipt});throw Error('unexpected read');}
 if(body.action==='presentation'){
  assert.equal(body.capabilityId,'apps.authoring.save_component');
  const view={viewId:body.input.viewId,ownerSessionId:'A',title:body.input.title,viewRevision:1,bindings:[],validationStatus:'verified',pendingPublicationId:null,sourceComponentId:'saved-'+body.input.viewId,baseRevision:1};
  const saved={componentId:view.sourceComponentId,revision:1,title:view.title,view};receipt={invocationId:body.requestId,request:{capabilityId:body.capabilityId,source:{sessionId:body.sessionId}},state:'settled',result:{status:'ok',data:saved}};
  if(saveLoss){saveLoss=false;throw Error('save response lost');}return Response.json({status:'ok',data:saved});
 }
 assert.equal(body.action,'workbench');assert.equal(body.operation,'pinComponent');
 assert.equal(body.params.expectedRevision,board.revision);
 if(!board.savedComponents.some(item=>item.componentId===body.params.componentId&&item.revision===body.params.revision))board={...board,revision:board.revision+1,savedComponents:[...board.savedComponents,{componentId:body.params.componentId,revision:body.params.revision,title:'Pinned'}]};
 if(pinLoss){pinLoss=false;throw Error('pin response lost');}return Response.json(board);
};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
const button=name=>tree.root.findAllByType('button').find(node=>text(node)===name);
const click=async name=>{const node=button(name);assert.ok(node,name);assert.equal(node.props.disabled||false,false);await act(async()=>{node.props.onClick();await settle();});};
const saves=()=>requests.filter(item=>item.action==='presentation').length,pins=()=>requests.filter(item=>item.operation==='pinComponent').length;
const view=id=>({viewId:id,ownerSessionId:'A',title:'Agent组件'+id,viewRevision:1,bindings:[],validationStatus:'verified',pendingPublicationId:null});
try{
 await act(async()=>{tree=create(<PinSavedComponentButton appId='hallmark' component={{componentId:'library',revision:2}}/>);await settle();});
 await click('添加到工作台');assert.equal(saves(),0);assert.equal(pins(),1);assert.equal(board.savedComponents.length,1);assert.equal(button('已添加到工作台').props.disabled,true);assert.deepEqual(board.instances,[{instanceId:'keep'}]);await act(async()=>tree.unmount());
 pinLoss=true;await act(async()=>{tree=create(<CurrentComponentWorkbenchAction appId='hallmark' sessionId='A' view={view('new')}/>);await settle();});
 await click('添加到工作台');assert.equal(saves(),1);assert.equal(pins(),2);assert.ok(button('重试添加'));assert.match(JSON.stringify(tree.toJSON()),/组件已保存，添加尚未确认/);
 await click('重试添加');assert.equal(saves(),1,'retry pin never repeats the successful save');assert.equal(pins(),3);assert.equal(board.savedComponents.length,2);assert.equal(button('已在工作台').props.disabled,true);await act(async()=>tree.unmount());
 saveLoss=true;await act(async()=>{tree=create(<CurrentComponentWorkbenchAction appId='hallmark' sessionId='A' view={view('lost')}/>);await settle();});
 await click('添加到工作台');assert.equal(saves(),2);assert.equal(pins(),3);assert.equal(button('添加到工作台').props.disabled,true);assert.ok(button('检查原调用'));
 await click('检查原调用');assert.equal(saves(),2,'the original save is inspected rather than repeated');assert.equal(pins(),4);assert.equal(board.savedComponents.length,3);assert.equal(button('已在工作台').props.disabled,true);
 await act(async()=>tree.unmount());await act(async()=>{tree=create(<CurrentComponentWorkbenchAction appId='hallmark' sessionId='A' view={{...view('pending'),pendingPublicationId:'not-ready'}}/>);await settle();});assert.equal(button('添加到工作台').props.disabled,true,'unconfirmed previews cannot be saved or pinned');
 console.log('WORKBENCH_ACTIONS_PASS');
}finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=originalFetch;}
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
  const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.error?.message??result.stderr);assert.match(result.stdout,/WORKBENCH_ACTIONS_PASS/);
 }finally{assert.ok(resolve(directory).startsWith(root+sep+'workbench-actions-'));rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
