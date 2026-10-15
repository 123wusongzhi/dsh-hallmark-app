import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

// Production React is rendered and its props are invoked. This does not replace
// browser checks of visibility, hit testing, event dispatch or focus behavior.
test('application catalog and session cards obey rendered state and navigation contracts',{timeout:30000},async()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const scratch=join(root,'.test-tmp');mkdirSync(scratch,{recursive:true});
  const directory=mkdtempSync(join(scratch,'application-surfaces-')),entry=join(directory,'checks.mjs');
  let passed=false;
  try{
    await build({stdin:{sourcefile:'application-surfaces.tsx',resolveDir:root,loader:'tsx',contents:`
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {AppRegistryPage} from './packages/dsh-plugin/client/page.tsx';
import {SessionComponentsPane} from './packages/dsh-plugin/client/sidebar.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const hasClass=(node,name)=>typeof node.props.className==='string'&&node.props.className.split(' ').includes(name);

function pageProbe(check){
  const previousFetch=globalThis.fetch;
  let unexpectedFetch=0,tree;
  globalThis.fetch=async()=>{unexpectedFetch++;throw Error('No network allowed in initial-page probe');};
  try{
    act(()=>{tree=create(React.createElement(AppRegistryPage,{bridgeFactory:()=>({})}));});
    check(tree.root);
    assert.equal(unexpectedFetch,0);
  }finally{
    if(tree)act(()=>tree.unmount());
    globalThis.fetch=previousFetch;
  }
}

test('initial page has no selected application and displays its selection prompt',()=>pageProbe(root=>{
  const cards=root.findAll(node=>hasClass(node,'hm-application-card'));
  assert.equal(cards.length,1);
  assert.ok(cards.every(node=>node.props['data-selected']===false),'initial application must not be preselected');
  const buttons=root.findAll(node=>hasClass(node,'hm-card-open'));
  assert.equal(buttons.length,1);
  assert.equal(buttons[0].props['aria-current'],undefined);
  const placeholders=root.findAll(node=>hasClass(node,'hm-page-placeholder'));
  assert.equal(placeholders.length,1);
  assert.equal(placeholders[0].findByType('strong').children.join(''),'选择应用进入工作台');
  assert.equal(root.findAll(node=>node.props.role==='tablist'&&node.props['aria-label']==='工作区标签').length,0);
}));

test('initial application rail is rendered without a hidden ancestor',()=>pageProbe(root=>{
  const rails=root.findAll(node=>typeof node.type==='string'&&hasClass(node,'hm-app-rail'));
  assert.equal(rails.length,1);
  assert.equal(rails[0].type,'aside');
  for(let node=rails[0];node;node=node.parent){
    assert.notEqual(node.props.hidden,true,'application rail must not be hidden');
    assert.notEqual(node.props.style?.display,'none');
    assert.notEqual(node.props.style?.visibility,'hidden');
  }
}));

test('ready sidebar card invokes the native navigation command with the selected view',async()=>{
  const previousFetch=globalThis.fetch,previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const calls=[],navigation=[],controller=new AbortController();
  const actions={openTab:(kind,options)=>navigation.push({kind,options})};
  const info={tab:{navigation:{params:{},revision:0},signal:controller.signal,visible:true,actions}};
  let tree;
  globalThis.fetch=async(input,init)=>{
    calls.push({input:String(input),method:init.method});
    assert.equal(String(input),'/api/hallmark-app?sessionId=audit-session&resource=sessionViews');
    assert.equal(init.method,'GET');
    return Response.json({sessionId:'audit-session',views:[{viewId:'audit-view',title:'Audit component',state:'ready',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'}]});
  };
  Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
  try{
    await act(async()=>{tree=create(React.createElement(SessionComponentsPane,{sessionId:'audit-session',useTabInfo:()=>info}));});
    const cards=tree.root.findAll(node=>node.type==='button'&&hasClass(node,'hm-chat-component-card'));
    assert.equal(cards.length,1,'fixture read must settle before the click');
    assert.equal(cards[0].props.disabled,false);
    assert.equal(navigation.length,0);
    act(()=>cards[0].props.onClick());
    assert.deepEqual(navigation,[{kind:'hallmark-components',options:{params:{viewId:'audit-view'}}}],'ready card must invoke native openTab exactly once with its view');
    assert.equal(calls.length,1,'opening a card does not perform a write or a detail read before host navigation');
  }finally{
    if(tree)act(()=>tree.unmount());
    controller.abort();globalThis.fetch=previousFetch;
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else delete globalThis.window;
  }
});
`},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:entry,bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
    const args=['--test','--test-reporter=tap',entry];
    // This is a separate runner, not a recursively invoked outer test worker.
    const env={...process.env};delete env.NODE_TEST_CONTEXT;
    const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
    writeFileSync(join(directory,'stdout.txt'),result.stdout??'');writeFileSync(join(directory,'stderr.txt'),result.stderr??'');
    writeFileSync(join(directory,'command.json'),JSON.stringify({command:[process.execPath,...args],exitCode:result.status,error:result.error?.message??null,scope:'production React with local control fixtures; no browser or remote service'},null,2)+'\n');
    assert.equal(result.status,0,`Surface checks failed: ${result.error?.message??'inspect child assertions'}; logs: ${relative(root,directory)}`);
    assert.match(result.stdout,/# tests 3\b/);assert.match(result.stdout,/# pass 3\b/);assert.match(result.stdout,/# fail 0\b/);
    passed=true;
  }finally{if(passed)rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
