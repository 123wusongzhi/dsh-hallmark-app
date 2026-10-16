import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('save controls retry a failed view read in place and retain entered save fields',async()=>{
  const artifactRoot=resolve('artifacts');mkdirSync(artifactRoot,{recursive:true});
  const directory=mkdtempSync(join(artifactRoot,'native-save-read-recovery-')),entry=join(directory,'fixture.mjs');
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
      import {performanceEvidence} from './test/authoring/performance-fixture.ts';
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
        const report={schemaVersion:1,attemptId:begin.attempt.attemptId,epoch:begin.attempt.epoch,buildReceiptId:built.receiptId,buildId:built.archiveBuildId,protocol:'dsh.apps.component.v2',mode:'fixture',runnerVersion:'native-save-read-recovery-fixture/1',startedAt:at,finishedAt:at,viewportResults:[420,1040].map(width=>({id:'fixture-'+width,contentWidthCssPx:width,heightCssPx:800,deviceScaleFactor:1,screenshot,pageErrors:[],unhandledRejections:[],failedRequests:[],bridgeReady:true,assertionIds:['lifecycle-fixture'],interactionCaseIds:[]})),assertionResults:structuredClone(assertions),verdict:'PASS',performance:performanceEvidence()};
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
      const nativeFetch=globalThis.fetch,requests=[];let tree,failViewRead=true;
      globalThis.fetch=async(url,options)=>{
        if(!String(url).startsWith('/api/dsh-apps'))return nativeFetch(url,options);
        const row={url:String(url),body:options?.body?JSON.parse(options.body):undefined};requests.push(row);
        if(failViewRead&&String(url).includes('resource=view&')){failViewRead=false;row.result={error:'fixture initial view read unavailable'};return new Response(JSON.stringify(row.result),{status:503,headers:{'Content-Type':'application/json'}});}
        const response=await host.ui(new Request('http://native.fixture'+url,options));row.result=await response.clone().json();
        return response;
      };
      const wait=()=>new Promise(resolve=>setTimeout(resolve,10));
      const until=async(check,label)=>{for(let n=0;n<150&&!check();n++)await act(async()=>{await wait();});assert.ok(check(),label);};
      const field=label=>tree.root.findByProps({'aria-label':label});
      const button=()=>tree.root.findAllByType('button').find(node=>['保存到组件库','正在保存…'].includes(node.children.join('')));
      const saveCalls=()=>requests.filter(row=>row.body?.capabilityId==='apps.authoring.save_component');
      const change=async(label,value)=>act(async()=>field(label).props.onChange({target:{value}}));
      try{
        const opened=await appsPresentation('A','apps.presentation.open_component',{componentId:seed.componentId});
        await act(async()=>{tree=create(<AppsSaveControls sessionId='A' viewId={opened.viewId}/>);});
        await until(()=>requests.some(row=>row.result?.error==='fixture initial view read unavailable'),'initial view read must fail');
        await change('保存组件名称','用户保留的名字');await change('明确保存要求','用户保留的备注');
        const retry=()=>tree.root.findAllByType('button').find(node=>node.children.join('')==='重新读取保存信息');
        assert.ok(retry(),'failed initial view read must offer an in-place retry');
        assert.equal(button().props.disabled,true);assert.equal(saveCalls().length,0);
        const before= requests.filter(row=>row.url.includes('resource=view&')).length;
        await act(async()=>{retry().props.onClick();retry().props.onClick();});
        await until(()=>!button().props.disabled,'retry must load verified save metadata');
        assert.equal(requests.filter(row=>row.url.includes('resource=view&')).length,before+1,'repeated retry clicks must produce one read');
        assert.equal(field('保存组件名称').props.value,'用户保留的名字');assert.equal(field('明确保存要求').props.value,'用户保留的备注');assert.equal(field('保存方式').props.value,'update');
        assert.equal(saveCalls().length,0,'read recovery never writes');assert.equal(retry(),undefined);
        failViewRead=true;
        await act(async()=>tree.update(<AppsSaveControls sessionId='A' viewId={opened.viewId} refreshKey={1}/>));
        await until(()=>retry(),'failed metadata refresh must offer the same retry');
        assert.equal(field('保存组件名称').props.value,'用户保留的名字');assert.equal(field('明确保存要求').props.value,'用户保留的备注');
        assert.equal(field('保存方式').props.value,'update');
        await act(async()=>retry().props.onClick());await until(()=>!retry()&&!tree.root.findByProps({'aria-label':'明确保存组件'}).props['aria-busy'],'metadata refresh retry must recover');
        assert.equal(field('保存组件名称').props.value,'用户保留的名字');assert.equal(field('明确保存要求').props.value,'用户保留的备注');
        assert.equal(saveCalls().length,0);
        assert.equal(store.get('components',seed.componentId).revision,1);assert.equal(store.list('components').length,1);
        console.log('NATIVE_SAVE_READ_RECOVERY_REAL_HTTP_PASS');
      }finally{
        if(tree)await act(async()=>tree.unmount());globalThis.fetch=nativeFetch;await host.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await runtime.dispose();store.close();rmSync(directory,{recursive:true,force:true});
      }
    `},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime','react-test-renderer']});
    const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:20000});
    assert.equal(result.status,0,result.error?.message??result.stderr);
    assert.match(result.stdout,/NATIVE_SAVE_READ_RECOVERY_REAL_HTTP_PASS/);
  }finally{assert.ok(resolve(directory).startsWith(artifactRoot+sep));rmSync(directory,{recursive:true,force:true});}
});
