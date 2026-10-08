import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('native save controls update an ordinary saved copy, follow save-as targets, preserve conflicts and wait for publication READY',async()=>{
  const artifactRoot=resolve('artifacts');mkdirSync(artifactRoot,{recursive:true});
  const directory=mkdtempSync(join(artifactRoot,'native-save-lifecycle-')),entry=join(directory,'fixture.mjs');
  try{
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React from 'react';
      import {create,act} from 'react-test-renderer';
      import assert from 'node:assert/strict';
      import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
      import {tmpdir} from 'node:os';
      import {join} from 'node:path';
      import {AppsSaveControls} from './packages/plugin-apps/client/save-controls.tsx';
      import {appsPresentation} from './packages/plugin-apps/client/api.ts';
      import {RuntimeStore,AppsRuntime} from './packages/app-runtime/src/index.ts';
      import {AppsPresentationService} from './packages/app-presentation/src/index.ts';
      import {SourceComponentStore} from './packages/source-components/src/index.ts';
      import {AuthoringEvidenceRunner,evidenceFile} from './packages/source-components/src/authoring-evidence.ts';
      import {createAppsServer} from './packages/service/src/apps-server.ts';
      import {AppsHost,HttpAppsHostTransport} from './packages/plugin-apps/src/index.ts';

      globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.window=new EventTarget();
      const directory=mkdtempSync(join(tmpdir(),'apps-save-lifecycle-')),store=new RuntimeStore(':memory:'),runtime=new AppsRuntime(store);
      const sources=new SourceComponentStore(join(directory,'sources'),join(directory,'workspaces')),runner=new AuthoringEvidenceRunner(join(directory,'evidence'));
      const presentation=new AppsPresentationService({store,runtime,sources});
      // Backend evidence fixtures use a real build process/archive and hashed preview metadata;
      // they do not claim browser execution or viewport screenshots.
      const authoring=presentation.configureAuthoring({evidenceRoot:runner.root,validateBuildEvidence:ref=>runner.verifyBuild(ref,sources,{allowFailure:true}),validatePreviewEvidence:ref=>runner.readReport(ref)});
      runtime.register(presentation.provider());runtime.addConnection({appId:'apps',connectionId:'presentation',displayName:'共享界面',enabled:true,config:{},configRevision:1});
      const assertions=[{id:'lifecycle-fixture',required:true,expected:'Fixture ready',actual:'Fixture ready',status:'PASS',evidenceRefs:[]}];
      const prepare=async(sessionId,begin,title)=>{
        const workspace=begin.draft.workspacePath;
        writeFileSync(join(workspace,'package-lock.json'),'{}');writeFileSync(join(workspace,'package.json'),'{}');
        writeFileSync(join(workspace,'input.html'),'<button>'+title+'</button>');
        writeFileSync(join(workspace,'build.mjs'),"import {mkdirSync,copyFileSync} from 'node:fs';mkdirSync('dist',{recursive:true});copyFileSync('input.html','dist/index.html');");
        const executed=await runner.build({attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,sourceRevision:begin.attempt.sourceRevision,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});
        const built=await authoring.recordBuild(sessionId,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,reportRef:executed.reportRef});
        const screenshotPath=join(runner.root,'fixture-'+begin.attempt.attemptId+'.png');writeFileSync(screenshotPath,Buffer.from('backend-preview-evidence-fixture'));
        const screenshot=evidenceFile(screenshotPath),at=new Date().toISOString();
        const report={schemaVersion:1,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,buildId:built.archiveBuildId,protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'native-save-lifecycle-fixture/1',startedAt:at,finishedAt:at,viewportResults:[420,1040].map(width=>({id:'fixture-'+width,contentWidthCssPx:width,heightCssPx:800,deviceScaleFactor:1,screenshot,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['lifecycle-fixture']})),assertionResults:structuredClone(assertions),verdict:'PASS'};
        const preview=await authoring.recordPreview(sessionId,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,reportRef:runner.writeReport('preview',report)});
        const publication=authoring.publish(sessionId,{attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,viewId:begin.view.viewId,expectedViewRevision:begin.attempt.expectedViewRevision,buildId:built.archiveBuildId,buildReceiptId:built.receiptId,previewReceiptId:preview.receiptId});
        return {publication,confirm(){
          authoring.startMount(sessionId,{viewId:publication.viewId,publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,expectedViewRevision:publication.expectedViewRevision});
          const identity={publicationId:publication.publicationId,attemptId:publication.attemptId,attemptEpoch:publication.attemptEpoch,buildId:publication.candidateBuildId,frameInstanceId:'frame-'+publication.publicationId,documentNonce:'nonce-'+publication.publicationId};
          authoring.authorizeFrame(sessionId,identity);
          return authoring.confirmReady(sessionId,{...identity,viewId:publication.viewId,checks:{rendered:true,bridgeReady:true,dataRead:true,unhandledErrors:[],assertionResults:structuredClone(assertions)}}).view;
        }};
      };
      const seedCandidate=await prepare('seed',authoring.begin('seed',{mode:'new',title:'已验证来源'}),'Initial source');
      const seedView=seedCandidate.confirm(),seed=authoring.saveComponent('seed',{viewId:seedView.viewId,expectedViewRevision:seedView.viewRevision,userRequest:'fixture explicit seed save',mode:'save_as',title:'原组件'});
      const server=createAppsServer({runtime,presentation,token:'s'.repeat(64)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      const agents=new Map([['A',{id:'A'}],['seed',{id:'seed'}]]),host=new AppsHost({agents:{get:id=>agents.get(id),list:()=>[...agents.values()]}},new HttpAppsHostTransport('http://127.0.0.1:'+server.address().port,'s'.repeat(64)));
      const nativeFetch=globalThis.fetch,requests=[];let tree,holdNextSave=false,releaseSaveResponse;
      globalThis.fetch=async(url,options)=>{
        if(!String(url).startsWith('/api/dsh-apps'))return nativeFetch(url,options);
        const row={url:String(url),body:options?.body?JSON.parse(options.body):undefined};requests.push(row);
        const response=await host.ui(new Request('http://native.fixture'+url,options));row.result=await response.clone().json();
        if(holdNextSave&&row.body?.capabilityId==='apps.authoring.save_component'){holdNextSave=false;await new Promise(resolve=>{releaseSaveResponse=resolve;});}
        return response;
      };
      const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
      const until=async(check,label)=>{for(let n=0;n<150&&!check();n++)await act(async()=>{await wait();});assert.ok(check(),label);};
      const field=label=>tree.root.findByProps({'aria-label':label});
      const button=()=>tree.root.findAllByType('button').find(node=>['保存到组件库','正在保存…'].includes(node.children.join('')));
      const versionText=()=>tree.root.findByProps({className:'apps-save-version'}).findByType('p').children.join('');
      const saveCalls=()=>requests.filter(row=>row.body?.capabilityId==='apps.authoring.save_component');
      const change=async(label,value)=>act(async()=>field(label).props.onChange({target:{value}}));
      const submit=async()=>{const index=saveCalls().length;await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await until(()=>saveCalls()[index]?.result&&!button().props.disabled,'save response must settle');return saveCalls()[index];};
      const assertSaved=(call,componentId,revision)=>{
        assert.equal(call.result.status,'ok',JSON.stringify(call.result));const saved=call.result.data;
        assert.equal(saved.componentId,componentId);assert.equal(saved.revision,revision);assert.equal(saved.view.sourceComponentId,componentId);assert.equal(saved.view.baseRevision,revision);
        assert.equal(saved.view.baseRevisionAtOpen,1);assert.equal(saved.view.selectedSourceRevision,1);
        const invocation=store.get('invocations',call.body.requestId);assert.equal(invocation.request.capabilityId,'apps.authoring.save_component');assert.equal(invocation.request.source.sessionId,'A');assert.equal(invocation.result.status,'ok');
        assert.equal(field('保存方式').props.value,'update');return saved;
      };
      try{
        const opened=await appsPresentation('A','apps.presentation.open_component',{componentId:seed.componentId});
        assert.equal(opened.validationStatus,'verified');assert.equal(opened.source.buildId,seedView.source.buildId);
        assert.equal(store.list('authoring_drafts').filter(draft=>draft.viewId===opened.viewId).length,0,'ordinary library open must have no authoring draft');
        await act(async()=>{tree=create(<AppsSaveControls sessionId='A' viewId={opened.viewId}/>);});
        await until(()=>button()&&!button().props.disabled,'verified ordinary copy must allow saving');assert.equal(field('保存方式').props.value,'update');
        await change('保存组件名称','第一次直接更新');await change('明确保存要求','保留当前已验证内容');
        const first=await submit();assert.equal(first.body.input.mode,'update');assert.equal(first.body.input.expectedRevision,1);assertSaved(first,seed.componentId,2);
        assert.equal(store.list('components').length,1);assert.equal(store.list('authoring_drafts').filter(draft=>draft.viewId===opened.viewId).length,0);
        await change('保存组件名称','第二次直接更新');const second=await submit();assert.equal(second.body.input.expectedRevision,2,'next update must prefer the new baseRevision over opening history');assertSaved(second,seed.componentId,3);

        await change('保存方式','save_as');await change('保存组件名称','另存的新组件');await change('明确保存要求','另存为独立组件');
        const saveAs=await submit();assert.equal(saveAs.body.input.mode,'save_as');assert.equal(saveAs.body.input.componentId,undefined);assert.equal(saveAs.result.status,'ok',JSON.stringify(saveAs.result));
        const target=saveAs.result.data.componentId;assert.notEqual(target,seed.componentId);assertSaved(saveAs,target,1);assert.equal(store.list('components').length,2);
        await change('保存组件名称','新组件继续更新');const next=await submit();assert.equal(next.body.input.mode,'update');assert.equal(next.body.input.componentId,target);assert.equal(next.body.input.expectedRevision,1);assertSaved(next,target,2);
        assert.equal(store.list('components').length,2);assert.equal(store.get('components',seed.componentId).revision,3);assert.equal(store.get('components',seed.componentId).title,'第二次直接更新');

        presentation.manageSaved({kind:'component',id:target,action:'rename',name:'外部已更新的名称',expectedRevision:2});
        await change('保存组件名称','冲突后保留的用户名称');await change('明确保存要求','冲突后保留的明确要求');
        const conflict=await submit();assert.equal(conflict.body.input.expectedRevision,2);assert.equal(conflict.result.status,'failed');assert.equal(conflict.result.error.code,'COMPONENT_CONFLICT');
        assert.equal(field('保存组件名称').props.value,'冲突后保留的用户名称');assert.equal(field('明确保存要求').props.value,'冲突后保留的明确要求');assert.equal(field('保存方式').props.value,'update');
        assert.equal(tree.root.findAllByProps({className:'apps-save-conflict'}).length,1);assert.equal(store.get('components',target).revision,3);assert.equal(store.get('components',target).title,'外部已更新的名称');assert.equal(store.list('components').length,2);

        const pending=await prepare('A',authoring.begin('A',{mode:'edit',viewId:opened.viewId}),'Pending replacement');
        assert.equal(presentation.getView(opened.viewId).validationStatus,'verified');assert.equal(presentation.getView(opened.viewId).pendingPublicationId,pending.publication.publicationId);
        const viewReads=()=>requests.filter(row=>row.url.includes('resource=view&')&&row.url.includes('viewId='+opened.viewId)).length,readsBefore=viewReads(),savesBefore=saveCalls().length;
        await act(async()=>window.dispatchEvent(new CustomEvent('apps-publication-discovered',{detail:{sessionId:'other',viewId:opened.viewId,publicationId:pending.publication.publicationId}})));assert.equal(viewReads(),readsBefore);assert.equal(button().props.disabled,false);
        await act(async()=>window.dispatchEvent(new CustomEvent('apps-publication-discovered',{detail:{sessionId:'A',viewId:opened.viewId,publicationId:pending.publication.publicationId}})));
        await until(()=>viewReads()>readsBefore&&button().props.disabled,'pending publication must disable saving after its event');
        await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await act(async()=>{await wait();});assert.equal(saveCalls().length,savesBefore,'disabled pending view must also reject direct form submit');
        assert.equal(field('保存组件名称').props.value,'冲突后保留的用户名称');assert.equal(field('明确保存要求').props.value,'冲突后保留的明确要求');assert.equal(field('保存方式').props.value,'update');
        const ready=pending.confirm();assert.equal(ready.pendingPublicationId,null);assert.equal(ready.validationStatus,'verified');
        await act(async()=>window.dispatchEvent(new CustomEvent('apps-display-ready',{detail:{sessionId:'A',viewId:opened.viewId}})));
        await until(()=>!button().props.disabled,'READY must restore saving');assert.equal(field('保存组件名称').props.value,'冲突后保留的用户名称');assert.equal(field('明确保存要求').props.value,'冲突后保留的明确要求');assert.equal(field('保存方式').props.value,'update');assert.equal(saveCalls().length,savesBefore);

        await change('保存方式','save_as');await change('保存组件名称','延迟回执的新组件');await change('明确保存要求','保留后续候选状态');holdNextSave=true;
        await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));await until(()=>releaseSaveResponse,'fixture must hold a committed successful save response');
        const held=saveCalls().at(-1);assert.equal(held.result.status,'ok',JSON.stringify(held.result));assert.equal(held.result.data.view.viewRevision,ready.viewRevision);assert.equal(held.result.data.view.pendingPublicationId,null);
        const later=await prepare('A',authoring.begin('A',{mode:'edit',viewId:opened.viewId}),'Newer confirmed content'),laterReady=later.confirm();
        assert.ok(laterReady.viewRevision>held.result.data.view.viewRevision);
        await act(async()=>window.dispatchEvent(new CustomEvent('apps-display-ready',{detail:{sessionId:'A',viewId:opened.viewId}})));
        await until(()=>versionText().includes('视图版本 '+laterReady.viewRevision),'READY must load the newer current view revision');
        const newerPending=await prepare('A',authoring.begin('A',{mode:'edit',viewId:opened.viewId}),'Candidate newer than save receipt'),newerReads=viewReads();
        await act(async()=>window.dispatchEvent(new CustomEvent('apps-publication-discovered',{detail:{sessionId:'A',viewId:opened.viewId,publicationId:newerPending.publication.publicationId}})));
        await until(()=>viewReads()>newerReads&&requests.findLast(row=>row.url.includes('resource=view&')&&row.url.includes('viewId='+opened.viewId))?.result?.pendingPublicationId===newerPending.publication.publicationId,'new pending publication must be observed before releasing the old save receipt');await act(async()=>{await wait();});
        await act(async()=>{releaseSaveResponse();await wait();});await until(()=>field('保存方式').props.value==='update'&&button().children.join('')==='保存到组件库','late save receipt must settle');
        assert.equal(button().props.disabled,true,'old successful receipt must not clear the newer pending publication');
        assert.ok(versionText().includes('视图版本 '+laterReady.viewRevision),versionText());
        assert.equal(field('保存组件名称').props.value,'延迟回执的新组件');assert.equal(field('明确保存要求').props.value,'保留后续候选状态');
        const lateSaves=saveCalls().length;await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(saveCalls().length,lateSaves);assert.equal(store.list('components').length,3);
        console.log('NATIVE_SAVE_LIFECYCLE_HTTP_ORDINARY_UPDATE_SAVE_AS_CONFLICT_PENDING_READY_PASS');
      }finally{
        releaseSaveResponse?.();if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;await host.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.dispose();store.close();rmSync(directory,{recursive:true,force:true});
      }
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,result.error?.message??result.stderr);
    assert.match(result.stdout,/NATIVE_SAVE_LIFECYCLE_HTTP_ORDINARY_UPDATE_SAVE_AS_CONFLICT_PENDING_READY_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(artifactRoot+sep));rmSync(directory,{recursive:true,force:true});}
});
