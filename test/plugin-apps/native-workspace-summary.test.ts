import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('saved-component open refreshes the current workspace app summary only after an owned successful receipt',async()=>{
  const artifactRoot=resolve('artifacts');mkdirSync(artifactRoot,{recursive:true});
  const directory=mkdtempSync(join(artifactRoot,'native-workspace-summary-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
      import {tmpdir} from 'node:os';
      import {join} from 'node:path';
      import {AppsWorkspace} from './packages/plugin-apps/client/workspace.tsx';
      import {AppsLibrary} from './packages/plugin-apps/client/library.tsx';
      import {RuntimeStore,AppsRuntime} from './packages/app-runtime/src/index.ts';
      import {NotesProvider} from './packages/app-notes/src/index.ts';
      import {AppsPresentationService} from './packages/app-presentation/src/index.ts';
      import {SourceComponentStore} from './packages/source-components/src/index.ts';
      import {createAppsServer} from './packages/service/src/apps-server.ts';
      import {AppsHost,HttpAppsHostTransport} from './packages/plugin-apps/src/index.ts';

      globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
      const directory=mkdtempSync(join(tmpdir(),'apps-summary-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
      runtime.register(new NotesProvider({store}));
      const sources=new SourceComponentStore(join(directory,'archive'),join(directory,'workspaces'));
      const presentation=new AppsPresentationService({store,runtime,sources});presentation.configureAuthoring();runtime.register(presentation.provider());
      for(const [appId,connectionId] of [['apps','presentation'],['notes','saved']])runtime.addConnection({appId,connectionId,displayName:connectionId,enabled:true,config:{},configRevision:1});
      runtime.bind({sessionId:'seed',appId:'notes',connectionId:'saved',enabled:true,boundAt:new Date().toISOString()});
      const project=join(directory,'project');mkdirSync(join(project,'dist'),{recursive:true});writeFileSync(join(project,'dist','index.html'),'<p>Saved notes</p>');writeFileSync(join(project,'package-lock.json'),'{}');
      const seed=presentation.openSource('seed',project,{title:'跨聊天保存的组件',bindings:[{bindingId:'notes',appId:'notes',connectionId:'saved',capabilityId:'notes.notes.list',capabilityMajor:1,input:{},projection:[],refresh:{mode:'manual'}}]});
      await presentation.refreshView('seed',seed.viewId,{kind:'agent',sessionId:'seed',nativeCallId:'seed-data'});
      const component=presentation.saveComponent('seed',seed.viewId,'fixture explicit save',{mode:'save_as'});
      const seedBindings=runtime.sessionBindings('seed'),savedComponents=store.list('components');
      const sessions=['A','failure','late','B','recovery'],agents=new Map(sessions.map(id=>[id,{id}]));
      const server=createAppsServer({runtime,presentation,token:'t'.repeat(64)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const host=new AppsHost({agents:{get:id=>agents.get(id),list:()=>[...agents.values()]}},new HttpAppsHostTransport('http://127.0.0.1:'+server.address().port,'t'.repeat(64)));
      const nativeFetch=globalThis.fetch,requests=[];let tree,heldResponse,releaseResponse,loseResponse=false;
      globalThis.fetch=async(url,options)=>{
        if(!String(url).startsWith('/api/dsh-apps'))return nativeFetch(url,options);
        const body=options?.body?JSON.parse(options.body):undefined;requests.push({url:String(url),body});
        const response=await host.ui(new Request('http://native.fixture'+url,options));
        if(body?.capabilityId==='apps.presentation.open_component'){
          if(body.sessionId==='late')await new Promise(resolve=>{releaseResponse=resolve;heldResponse=true;});
          if(loseResponse){loseResponse=false;throw Error('fixture lost committed open receipt');}
        }
        return response;
      };
      const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
      const until=async(check,label)=>{for(let n=0;n<150&&!check();n++)await act(async()=>{await wait();});assert.ok(check(),label);};
      const button=name=>tree.root.findAllByType('button').find(node=>node.children.join('')===name);
      const status=()=>tree.root.findAllByType('span').find(node=>node.props.className?.split(' ').includes('apps-connection-status'))?.children.filter(value=>typeof value==='string').join('');
      const bindingsReads=sessionId=>requests.filter(row=>row.url.includes('resource=bindings&sessionId='+sessionId)).length;
      const opens=sessionId=>requests.filter(row=>row.body?.sessionId===sessionId&&row.body.capabilityId==='apps.presentation.open_component');
      const binding=sessionId=>runtime.sessionBindings(sessionId).find(row=>row.appId==='notes'&&row.connectionId==='saved');
      const mount=async(sessionId)=>{await act(async()=>{if(tree)tree.update(<AppsWorkspace currentSessionId={sessionId}/>);else tree=create(<AppsWorkspace currentSessionId={sessionId}/>);});await until(()=>status()==='尚未在当前聊天启用'&&button('在当前会话打开'),'new chat '+sessionId+' initially has an unbound app summary');};
      try{
        await mount('A');const initialReads=bindingsReads('A');assert.equal(binding('A'),undefined);
        await act(async()=>button('在当前会话打开').props.onClick());
        await until(()=>binding('A')?.enabled,'saved component must activate its exact connection in the new chat');
        await until(()=>status()==='当前聊天已启用','successful saved-component receipt must refresh the app summary');
        assert.equal(bindingsReads('A'),initialReads+1);assert.equal(opens('A').length,1);assert.equal(opens('A')[0].body.input.componentId,component.componentId);
        const opened=store.list('views').find(view=>view.ownerSessionId==='A'&&view.sourceComponentId===component.componentId);assert.ok(opened);assert.equal(opened.source.buildId,seed.source.buildId);
        const ownedReads=bindingsReads('A');await act(async()=>tree.root.findByType(AppsLibrary).props.onOpenView(seed));await act(async()=>{await wait();});
        assert.equal(bindingsReads('A'),ownedReads);assert.equal(status(),'当前聊天已启用');

        await mount('failure');const failureReads=bindingsReads('failure');
        await runtime.updateConnection({appId:'notes',connectionId:'saved',expectedConfigRevision:1,enabled:false});
        await act(async()=>button('在当前会话打开').props.onClick());
        await until(()=>JSON.stringify(tree.toJSON()).includes('已停用'),'failed open must display its confirmed failure');
        assert.equal(binding('failure'),undefined);assert.equal(bindingsReads('failure'),failureReads);assert.equal(status(),'尚未在当前聊天启用');assert.equal(opens('failure').length,1);
        await runtime.updateConnection({appId:'notes',connectionId:'saved',expectedConfigRevision:2,enabled:true});

        await mount('late');await act(async()=>button('在当前会话打开').props.onClick());await until(()=>heldResponse,'fixture must hold the successful receipt');
        assert.equal(binding('late')?.enabled,true);await mount('B');const nextReads=bindingsReads('B');
        await act(async()=>{releaseResponse();await wait();});await act(async()=>{await wait();});
        assert.equal(status(),'尚未在当前聊天启用');assert.equal(binding('B'),undefined);assert.equal(bindingsReads('B'),nextReads);assert.equal(store.list('views').filter(view=>view.ownerSessionId==='B').length,0);

        await mount('recovery');const recoveryReads=bindingsReads('recovery');loseResponse=true;
        await act(async()=>button('在当前会话打开').props.onClick());await until(()=>button('检查原调用'),'lost receipt must use original request recovery');
        assert.equal(binding('recovery')?.enabled,true);assert.equal(bindingsReads('recovery'),recoveryReads);assert.equal(status(),'尚未在当前聊天启用');
        await act(async()=>button('检查原调用').props.onClick());await until(()=>status()==='当前聊天已启用','confirmed original receipt must refresh the app summary');
        assert.equal(bindingsReads('recovery'),recoveryReads+1);assert.equal(opens('recovery').length,1);
        assert.equal(requests.some(row=>row.body?.action==='bind'),false);assert.deepEqual(runtime.sessionBindings('seed'),seedBindings);assert.deepEqual(store.list('components'),savedComponents);
        console.log('WORKSPACE_SUMMARY_OWNED_OPEN_SUCCESS_FAILURE_LATE_RECOVERY_PASS');
      }finally{
        releaseResponse?.();if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;await host.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.dispose();store.close();rmSync(directory,{recursive:true,force:true});
      }
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,result.error?.message??result.stderr);
    assert.match(result.stdout,/WORKSPACE_SUMMARY_OWNED_OPEN_SUCCESS_FAILURE_LATE_RECOVERY_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(artifactRoot+sep));rmSync(directory,{recursive:true,force:true});}
});
