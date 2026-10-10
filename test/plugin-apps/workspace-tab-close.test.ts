import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('workspace tabs close in one click, retain failed tabs, avoid duplicate writes and choose a neighbour without stealing focus',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workspace-tab-close-')),entry=join(directory,'fixture.mjs');
  const stubModules:Record<string,string>={
    'directory.tsx':"export function AppsDirectory(p){return <div className='apps-workspace'>{p.navigation}{p.children}</div>}",
    'library.tsx':"export function AppsLibrary(){return null}",
    'view.tsx':"export function AppsNativeView(p){return <section data-open-view={p.viewId}/>}",
    'save-controls.tsx':"export function AppsSaveControls(){return null}",
    'workbench-board.tsx':"export function WorkbenchBoard(p){return <button onClick={p.onAdd}>打开素材库</button>}",
    'material-library.tsx':"export function MaterialLibrary(p){return <button onClick={p.onOpenSaved}>打开我的组件</button>}",
    'workbench-component-actions.tsx':"export function CurrentComponentWorkbenchAction(){return null}",
  };
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
      const first='采购对照表'.repeat(12),names=[first,'订单记录','库存记录'],stamp='2026-10-09T00:00:00Z';
      let views=names.map((title,i)=>({viewId:'view-'+i,ownerSessionId:'A',title,panelState:'open',bindings:[],updatedAt:stamp,createdAt:stamp})),held,delay=false,fail=false;const writes=[];
      globalThis.fetch=async(url,options)=>{const body=options?.body?JSON.parse(options.body):undefined,query=new URL(String(url),'http://fixture').searchParams;
        if(query.get('resource')==='views')return Response.json({views:views.filter(view=>view.ownerSessionId===query.get('sessionId'))});
        if(body?.action==='authoring'){
          writes.push(body);if(body.operation==='restoreView'){const view=views.find(view=>view.viewId===body.params.viewId);view.panelState='open';delete view.closedAt;return Response.json(view);}
          assert.equal(body.operation,'closeDraft');assert.equal(body.params.action,'keep');
          if(delay)await new Promise(resolve=>held=resolve);
          if(fail)return Response.json({status:'failed',error:{message:'保存关闭状态失败'}},{status:503});
          const view=views.find(view=>view.viewId===body.params.viewId);view.panelState='closed';view.closedAt=stamp;return Response.json(view);
        }
        throw Error('unexpected fixture route '+url);
      };
      let tree;const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
      const settle=async()=>act(async()=>{await wait();}),until=async(check,message)=>{for(let n=0;n<100&&!check();n++)await settle();assert.ok(check(),message);};
      const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
      const buttons=()=>tree.root.findAllByType('button'),button=name=>buttons().find(node=>text(node)===name),label=name=>buttons().find(node=>node.props['aria-label']===name);
      const tabs=()=>tree.root.findByProps({'aria-label':'应用工作台与组件标签'}),tab=name=>tabs().findAllByType('button').find(node=>text(node)===name),active=()=>tabs().findAllByType('button').find(node=>node.props['aria-pressed']===true);
      const click=async(node)=>{assert.ok(node);await act(async()=>node.props.onClick());await settle();};
      try{
        await act(async()=>{tree=create(<AppsWorkspace currentSessionId='A'/>);});await until(()=>!!tab(first),'load original tabs');
        const add=label('新建组件工作副本'),scroll=tree.root.findByProps({className:'apps-tabs-scroll'});assert.equal(scroll.findAll(node=>node===add).length,0,'the new-tab action stays outside the horizontally scrolling tab strip');
        assert.equal(tab(first).props.title,first,'long titles remain available on hover');assert.ok(label('关闭'+first),'close is a separate button next to the truncated title');
        await click(tab('订单记录'));assert.equal(text(active()),'订单记录');delay=true;
        const closeOrders=label('关闭订单记录');await act(async()=>{closeOrders.props.onClick();closeOrders.props.onClick();});await until(()=>!!held,'hold close receipt');
        assert.equal(writes.length,1,'double clicks send only one close');assert.equal(label('关闭订单记录').props.disabled,true);assert.equal(tabs().findAllByProps({'aria-busy':true}).length,1);assert.equal(button('关闭并保留'),undefined,'ordinary close never opens a confirmation card');
        await act(async()=>held());await until(()=>!label('关闭订单记录'),'successful close removes only the target tab');assert.equal(text(active()),'库存记录','closing the selected middle tab selects its right neighbour');assert.ok(label('恢复订单记录'));
        delay=false;fail=true;await click(label('关闭库存记录'));assert.ok(label('关闭库存记录'));assert.equal(text(active()),'库存记录');assert.match(JSON.stringify(tree.toJSON()),/未能关闭.*库存记录.*标签和内容已保留.*保存关闭状态失败/);assert.equal(label('关闭库存记录').props.disabled,false);
        fail=false;delay=true;held=undefined;await act(async()=>label('关闭库存记录').props.onClick());await until(()=>!!held,'hold second close');await click(tab(first));await act(async()=>held());await until(()=>!label('关闭库存记录'),'close completes after navigating elsewhere');assert.equal(text(active()),first,'a late close receipt must not steal the user’s new selection');
        delay=false;await click(label('恢复订单记录'));assert.equal(text(active()),'订单记录');assert.equal(views.length,3,'restore keeps the original view identity');await click(label('关闭'+first));assert.equal(text(active()),'订单记录','closing an inactive tab keeps the selected one');
        await click(label('关闭订单记录'));assert.equal(text(active()),'工作台','closing the last view returns to the pinned workbench');
        await click(button('打开素材库'));assert.equal(text(active()),'素材库');await click(button('打开我的组件'));assert.equal(text(active()),'我的组件与模板');
        const writesBeforeLocal=writes.length;await click(label('关闭我的组件与模板'));assert.equal(text(active()),'素材库');assert.equal(tab('我的组件与模板'),undefined);await click(label('关闭素材库'));assert.equal(text(active()),'工作台');assert.equal(tab('素材库'),undefined);assert.equal(writes.length,writesBeforeLocal,'local library tabs do not create authoring mutations');
        await act(async()=>tree.unmount());await act(async()=>{tree=create(<AppsWorkspace currentSessionId='A'/>);});await until(()=>!!label('恢复订单记录'),'archived views remain recoverable after remount');assert.equal(label('关闭订单记录'),undefined);assert.equal(label('关闭'+first),undefined);
      }finally{if(tree)await act(async()=>tree.unmount());}
    `},plugins:[{name:'isolate-workspace-children',setup(plugin){plugin.onLoad({filter:/[\\/]plugin-apps[\\/]client[\\/](directory|library|view|save-controls|workbench-board|material-library|workbench-component-actions)\.tsx$/},args=>({contents:stubModules[args.path.split(/[\\/]/).at(-1)!],loader:'tsx',resolveDir:process.cwd()}));}}],outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.error?.message??result.stderr);
  }finally{assert.ok(resolve(directory).startsWith(root+sep+'workspace-tab-close-'));rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('workbench thumbnail cards open independent deduplicated tabs and closing a tab never removes its saved card',async()=>{
  const root=resolve('artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'workspace-instance-tabs-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
      import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
      import {WorkbenchBoard,WorkbenchInstanceView} from './packages/plugin-apps/client/workbench-board.tsx';
      import {AppsLibrary} from './packages/plugin-apps/client/library.tsx';
      import {createMaterialView} from './packages/app-presentation/src/materials/catalog.ts';
      globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
      const board={kind:'workbench',workbenchId:'board',appId:'hallmark',revision:3,updatedAt:'2026-10-09T00:00:00Z',savedComponents:[],instances:['采购对照工作表','库存日报'].map((title,index)=>({instanceId:'instance-'+index,title,materialId:'data-table',materialVersion:1,design:createMaterialView('data-table'),dataSources:{},position:{order:index,span:12}}))},original=structuredClone(board),requests=[];
      globalThis.fetch=async(url,options)=>{const query=new URL(String(url),'http://fixture').searchParams,resource=query.get('resource'),body=options?.body?JSON.parse(options.body):undefined;requests.push({resource,body});let value;
        if(body){assert.equal(body.action,'workbench');assert.equal(body.operation,'read','opening cards can read but never save/delete workbench state');const instance=board.instances.find(row=>row.instanceId===body.params.instanceId);assert.ok(instance);value={instanceId:instance.instanceId,view:{viewId:instance.instanceId,ownerSessionId:null,title:instance.title,design:instance.design,bindings:[]},data:{viewId:instance.instanceId,bindings:[]},dataSources:{},pages:{}};}
        else if(resource==='apps')value={apps:[{appId:'hallmark',displayName:'Hallmark',runtimeState:'ready',hostProjectionState:'ready'}]};
        else if(resource==='workbench')value=board;else if(resource==='stores')value={stores:[]};else if(resource==='views')value={views:[]};else if(resource==='connections'||resource==='bindings')value=[];else if(resource==='diagnostics')value={invocations:[]};else if(resource==='saved')value={components:[],assets:[]};else throw Error('Unexpected fixture resource '+resource);
        return Response.json(value);
      };
      let tree;const wait=()=>new Promise(resolve=>setTimeout(resolve,10)),settle=async()=>act(async()=>{await wait();}),until=async(check,message)=>{for(let n=0;n<100&&!check();n++)await settle();assert.ok(check(),message);};
      const text=node=>typeof node==='string'?node:node?.children?.map(text).join('')??'';
      const tabStrip=()=>tree.root.findByProps({'aria-label':'应用工作台与组件标签'}),tab=title=>tabStrip().findAllByType('button').find(node=>text(node)===title),close=title=>tabStrip().findAllByType('button').find(node=>node.props['aria-label']==='关闭'+title),active=()=>tabStrip().findAllByType('button').find(node=>node.props['aria-pressed']===true);
      const home=()=>tree.root.findAllByType(WorkbenchBoard).find(node=>!node.props.detailInstanceId),card=title=>home().findAllByType('button').find(node=>node.props['aria-label']==='打开'+title),click=async(node)=>{assert.ok(node);await act(async()=>node.props.onClick());await settle();};
      try{
        await act(async()=>{tree=create(<AppsWorkspace currentSessionId='A'/>);});await until(()=>!!card('采购对照工作表'),'show saved thumbnail cards');assert.equal(tree.root.findAllByType(AppsLibrary).length,0);assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0,'the workbench does not mount each card’s full data view');assert.equal(requests.some(row=>row.body),false);
        await click(card('采购对照工作表'));await until(()=>tree.root.findAllByType(WorkbenchInstanceView).length===1,'opening a card mounts its independent detail');assert.equal(text(active()),'采购对照工作表');assert.ok(tab('工作台'));assert.equal(home().props.active,false);assert.equal(tree.root.findAllByType(WorkbenchBoard).find(node=>node.props.detailInstanceId)?.props.detailInstanceId,'instance-0');
        await click(tab('工作台'));assert.equal(home().props.active,true);assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0);await click(card('采购对照工作表'));await until(()=>tree.root.findAllByType(WorkbenchInstanceView).length===1,'reopen the existing tab');assert.equal(tabStrip().findAllByType('button').filter(node=>node.props['aria-label']==='关闭采购对照工作表').length,1,'repeated clicks activate the same tab');
        await click(tab('工作台'));await click(card('库存日报'));await until(()=>tree.root.findAllByType(WorkbenchInstanceView).length===1,'switch to second independent component');assert.equal(text(active()),'库存日报');assert.ok(tab('采购对照工作表'));assert.equal(tree.root.findAllByType(WorkbenchBoard).find(node=>node.props.detailInstanceId)?.props.detailInstanceId,'instance-1');
        await click(close('采购对照工作表'));assert.equal(text(active()),'库存日报');await click(close('库存日报'));assert.equal(text(active()),'工作台');assert.equal(tree.root.findAllByType(WorkbenchInstanceView).length,0);assert.ok(card('采购对照工作表'));assert.ok(card('库存日报'));assert.deepEqual(board,original,'closing tabs preserves all persisted workbench entries and their order');assert.ok(requests.filter(row=>row.body).every(row=>row.body.operation==='read'));
        await click(card('采购对照工作表'));await until(()=>tree.root.findAllByType(WorkbenchInstanceView).length===1,'a closed tab is reopenable from its retained card');assert.equal(text(active()),'采购对照工作表');
      }finally{if(tree)await act(async()=>tree.unmount());}
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.error?.message??result.stderr);
  }finally{assert.ok(resolve(directory).startsWith(root+sep+'workspace-instance-tabs-'));rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
