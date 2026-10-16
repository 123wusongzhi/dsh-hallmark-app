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

test('workbench retries failed stores independently and retains the successful board cache',async t=>{
 const output=await build({stdin:{resolveDir:REPO_ROOT,loader:'tsx',contents:`
${uiFixturePrelude()}
import React from 'react';import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
import {WorkbenchBoard} from './packages/plugin-apps/client/workbench-board.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const stores=[uiStore({id:'shop-a',connectionId:'connection-a'})];
let tree,fail=true,storeReads=0,boardReads=0,completions=0;
const board={kind:'workbench',appId:'hallmark',workbenchId:'board',revision:1,instances:[],savedComponents:[]};
globalThis.fetch=async(url,options)=>{
 assert.notEqual(options?.method,'POST','Retry must never save context or execute merchant actions');
 const resource=new URL(String(url),'http://fixture').searchParams.get('resource');
 if(resource==='stores'){storeReads++;return fail?Response.json({status:'failed',error:{code:'ACCESS_DENIED',message:'店铺列表无权读取。'}},{status:403}):Response.json({stores});}
 assert.equal(resource,'workbench');boardReads++;return Response.json(board);
};
const text=n=>typeof n==='string'?n:n?.children?.map(text).join('')??'';
const retry=()=>tree.root.findAllByType('button').find(n=>text(n)==='重新读取店铺');
const render=(active=true)=><WorkbenchBoard appId="hallmark" active={active} onAdd={()=>{}} onConfigure={()=>{}} storeSelectionRequest={1} onStoreSelectionComplete={()=>completions++}/>;
await act(async()=>{tree=create(render());});
assert.equal(boardReads,1);assert.equal(storeReads,1);assert.ok(retry(),'Failed stores require an inline recovery action');assert.match(text(tree.root),/店铺列表无权读取/);
assert.equal(tree.root.findByProps({'aria-label':'当前店铺'}).props.disabled,true);
await act(async()=>retry().props.onClick());assert.equal(storeReads,2);assert.equal(boardReads,1);assert.ok(retry(),'Repeated failure remains retryable');
fail=false;await act(async()=>retry().props.onClick());assert.equal(storeReads,3);assert.equal(boardReads,1);assert.equal(retry(),undefined);assert.doesNotMatch(text(tree.root),/店铺列表无权读取/);
assert.equal(tree.root.findByProps({'aria-label':'当前店铺'}).props.disabled,false);assert.equal(tree.root.findByProps({'aria-label':'当前店铺'}).props.value,'');assert.equal(completions,0,'Reading stores cannot consume one-shot selection intent');
await act(async()=>tree.update(render(false)));await act(async()=>tree.update(render(true)));assert.equal(storeReads,3,'Successful store directory stays cached');assert.equal(boardReads,1);assert.equal(completions,0);
await act(async()=>tree.unmount());console.log('WORKBENCH_STORE_RETRY_CACHE_NO_WRITE_PASS');
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external'});
 const result=spawnFixture(['--input-type=module'],{input:output.outputFiles[0].text,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/WORKBENCH_STORE_RETRY_CACHE_NO_WRITE_PASS/);t.diagnostic(result.stdout.trim());
});
