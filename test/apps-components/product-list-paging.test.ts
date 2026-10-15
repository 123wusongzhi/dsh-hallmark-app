import {uiFixturePrelude} from '../real-data/ui-scenarios.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

test('product list changes rows with page, preserves failed page, resets on refresh and has no attachment controls',async t=>{
 const root=resolve('test/apps-components/artifacts');mkdirSync(root,{recursive:true});const directory=mkdtempSync(join(root,'product-paging-'));
 const workspace=mkdtempSync(join(tmpdir(),'apps-product-paging-'));
 t.after(()=>{for(const [parent,path,prefix]of [[root,directory,'product-paging-'],[resolve(tmpdir()),workspace,'apps-product-paging-']]){const within=relative(parent,path);assert.ok(within.startsWith(prefix)&&!within.includes('/')&&!within.includes('\\')&&resolve(parent,within)===resolve(path));rmSync(path,{recursive:true,force:true});}});
 const sdk=join(workspace,'sdk'),project=join(workspace,'component');mkdirSync(sdk);writeFileSync(join(sdk,'package.json'),JSON.stringify({name:'@dsh/apps-component-runtime'}));
 const {createAppsSource}=await import(pathToFileURL(resolve('scripts/create-apps-source.mjs')).href);await createAppsSource({directory:project,sdkDirectory:sdk,template:'product-list'});
 const source=readFileSync(join(project,'src/main.tsx'),'utf8').replace("import {createRoot} from 'react-dom/client';",'').replace("import './style.css';",'').replace("createRoot(document.getElementById('root')!).render(<Component/>);",'');
 const fixture=`
${uiFixturePrelude()}
import {create,act} from 'react-test-renderer';import assert from 'node:assert/strict';
let tree,resolvePage,rejectPage,setBinding,setBusy;const calls=[];
const data=(phase,cursor)=>({bindings:[{bindingId:'products',revision:phase,state:'ready',payload:{products:[uiProduct({storeId:'s',offerId:phase},phase==='First'?3:20)],total:2,cursor}}]});
globalThis.pagingHook=()=>{const [value,update]=React.useState(data('First','next')),[loading,busy]=React.useState(false);setBinding=update;setBusy=busy;return {data:value,loading,readBindingPage:async(id,cursor)=>{calls.push(cursor);busy(true);try{const next=await new Promise((resolve,reject)=>{resolvePage=resolve;rejectPage=reject;});update(next);return next;}finally{busy(false);}},refresh:async()=>{const next=data('First','next');update(next);return next;}};};
await act(async()=>{tree=create(<Component/>);});
const button=id=>tree.root.findByProps({'data-testid':id});
const page=()=>button('page').children.join('');
const row=()=>tree.root.findByProps({'data-product-row':true}).findByType('strong').children.join('');
assert.equal(tree.root.findAllByProps({'data-testid':'attach'}).length,0);assert.equal(tree.root.findAllByProps({type:'checkbox'}).length,0);
await act(async()=>{button('next').props.onClick();button('next').props.onClick();});
assert.equal(calls.length,1);assert.equal(button('next').props.disabled,true);assert.equal(row(),uiProduct({},3).title);
await act(async()=>{resolvePage(data('Second',null));});assert.equal(page(),'第 2 页');assert.equal(row(),uiProduct({},20).title);assert.equal(button('next').props.disabled,true);
await act(async()=>{button('previous').props.onClick();});await act(async()=>{rejectPage(new Error('Offline'));});
assert.equal(page(),'第 2 页');assert.equal(row(),uiProduct({},20).title);assert.equal(tree.root.findByProps({role:'status'}).children.join(''),'Offline');
await act(async()=>{button('previous').props.onClick();});await act(async()=>{resolvePage(data('First','next'));});assert.equal(page(),'第 1 页');assert.equal(row(),uiProduct({},3).title);assert.equal(calls.at(-1),null);
await act(async()=>{button('next').props.onClick();});await act(async()=>{resolvePage(data('Second',null));});
await act(async()=>{button('refresh').props.onClick();});assert.equal(page(),'第 1 页');assert.equal(row(),uiProduct({},3).title);assert.equal(button('previous').props.disabled,true);
await act(async()=>tree.unmount());console.log('PAGING_PASS');`;
 const entry=join(directory,'fixture.mjs');
 await build({stdin:{contents:source+'\n'+fixture,resolveDir:join(project,'src'),loader:'tsx'},outfile:entry,bundle:true,platform:'node',format:'esm',external:['react','react-test-renderer'],plugins:[{name:'isolated-hook',setup(builder){builder.onResolve({filter:/^@dsh\/apps-component-runtime\/apps\/react$/},()=>({path:'hook',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useApps=()=>globalThis.pagingHook();'}));}}]});
 const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:10000});writeFileSync(join(directory,'result.json'),JSON.stringify({scope:'ISOLATED_REACT_PAGING',actualDesktop:false,status:result.status,stdout:result.stdout,stderr:result.stderr},null,2));
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PAGING_PASS/);
});
