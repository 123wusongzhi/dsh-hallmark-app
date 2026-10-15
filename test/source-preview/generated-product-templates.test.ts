import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {previewTestPlan} from '../../packages/source-components/src/authoring-preview-plan.ts';
import {realStoreProducts,realDetail} from '../real-data/corpus.ts';

for(const template of ['product-list','composed-table'] as const){
  test(`generated ${template} bounds the DOM, uses prioritized images, retains refreshing rows and serializes remote reads`,async()=>{
    const directory=await mkdtemp(join(tmpdir(),'apps-template-performance-')),sdk=join(directory,'sdk'),project=join(directory,'component');
    const require=createRequire(import.meta.url);
    try{
      await mkdir(sdk);await writeFile(join(sdk,'package.json'),JSON.stringify({name:'@dsh/apps-component-runtime'}));
      const {createAppsSource}=await import(pathToFileURL(resolve('scripts/create-apps-source.mjs')).href);
      await createAppsSource({directory:project,sdkDirectory:sdk,template});
      const plan=JSON.parse(await readFile(join(project,'.preview/plan.json'),'utf8'));
      assert.deepEqual(previewTestPlan(plan).errors,[]);
      const source=(await readFile(join(project,'src/main.tsx'),'utf8')).replace("import {createRoot} from 'react-dom/client';",'').replace("import './style.css';",'').replace("createRoot(document.getElementById('root')!).render(<Component/>);",'');
      const entry=join(directory,'fixture.cjs');
      await build({stdin:{resolveDir:join(project,'src'),loader:'tsx',contents:source+`
import {create,act} from 'react-test-renderer';
import assert from 'node:assert/strict';
async function verify(){
const composed=${template==='composed-table'},bindingId=composed?'main':'products',imagesPerRow=composed?2:1;
// Commodity fields come from captured sales records; scenario identifiers control paging assertions.
const recorded=${JSON.stringify(realStoreProducts().products.slice(0,125))};
const row=(id)=>({...recorded[(id-1)%recorded.length],storeId:'s',productId:String(id),offerId:'scenario-'+String(id).padStart(3,'0'),sku:'scenario-'+String(id).padStart(3,'0')});
const packet=(start,count,total,cursor=null,queryCursor=undefined,cache={})=>({bindings:[{bindingId,state:'ready',revision:String(start),query:{input:{...(queryCursor?{cursor:queryCursor}:{})}},payload:composed?{
  items:Array.from({length:count},(_,i)=>({products:{title:row(start+i).title,image:row(start+i).imageUrl,otherImage:row(start+i).imageUrl,scenarioId:row(start+i).offerId}})),total,cursor,
  fieldMeta:[{key:'products.image',label:'商品图',source:'products',format:'image'},{key:'products.title',label:'商品名称',source:'products',format:'text'},{key:'products.otherImage',label:'其他图',source:'products',format:'image'},{key:'products.scenarioId',label:'测试分页标识',source:'products',format:'text'}],cache,warnings:[]
}:{products:Array.from({length:count},(_,i)=>row(start+i)),total,cursor,cache}}]});
let initial=packet(1,60,60),setSnapshot,setUpdating,resolveRead,rejectRead,tree;
const calls=[];
globalThis.templateHook=()=>{
  const [data,update]=React.useState(initial),[refreshing,updating]=React.useState(false);setSnapshot=update;setUpdating=updating;
  const request=(method,cursor)=>{calls.push({method,cursor});return new Promise((resolve,reject)=>{resolveRead=resolve;rejectRead=reject;}).then(next=>{if(next.bindings[0].state==='ready')update(next);return next;});};
  return {data,loading:false,refreshing,readBindingPage:(_id,cursor)=>request('page',cursor),refresh:()=>request('refresh')};
};
const mount=()=>act(()=>{tree=create(<Component/>);});
const button=id=>tree.root.findByProps({'data-testid':id});
const displayed=()=>tree.root.findAllByProps({'data-product-row':true});
const content=()=>JSON.stringify(tree.toJSON());
const search=value=>act(()=>tree.root.findByProps({'aria-label':'搜索当前读取范围'}).props.onChange({target:{value}}));
const expectRows=(count)=>{
  assert.equal(displayed().length,count);assert.ok(count<=20);
  const images=tree.root.findAllByType('img');assert.equal(images.length,count*imagesPerRow);
  images.forEach((image,index)=>{assert.equal(image.props.loading,index<6?'eager':'lazy');assert.equal(image.props.fetchpriority,index<6?'high':'auto');assert.equal(image.props.decoding,'async');assert.equal(image.props.width,composed?44:48);assert.equal(image.props.height,composed?44:48);});
};
mount();
expectRows(20);assert.match(content(),/搜索覆盖当前完整结果/);
act(()=>button('next').props.onClick());expectRows(20);assert.match(content(),/scenario-021/);assert.doesNotMatch(content(),/scenario-001/);assert.equal(calls.length,0);
search('scenario-05');expectRows(10);assert.equal(button('page').children.join(''),'第 1 页');assert.equal(calls.length,0);
search('');act(()=>button('next').props.onClick());
act(()=>setUpdating(true));expectRows(20);assert.match(content(),/正在更新，当前内容保留/);assert.equal(button('next').props.disabled,false);
act(()=>button('next').props.onClick());expectRows(20);assert.match(content(),/scenario-041/);
search('scenario-05');expectRows(10);assert.equal(calls.length,0);
search('');act(()=>setUpdating(false));
// The actual helper is mounted by the template, and source changes clear a failed-image placeholder.
act(()=>tree.root.findAllByType('img')[0].props.onError());assert.equal(tree.root.findAllByType('img').length,20*imagesPerRow-1);
const replacementImage=${JSON.stringify(realDetail(40).mainImage)};
const replacement=packet(1,60,60);if(composed)replacement.bindings[0].payload.items[0].products.image=replacementImage;else replacement.bindings[0].payload.products[0].imageUrl=replacementImage;
act(()=>setSnapshot(replacement));expectRows(20);assert.equal(tree.root.findAllByType('img')[0].props.src,replacementImage);
act(()=>{button('refresh').props.onClick();button('refresh').props.onClick();});assert.equal(calls.length,1);expectRows(20);
await act(async()=>resolveRead(packet(1,60,60,null,undefined,{stale:true,refreshing:true})));expectRows(20);assert.doesNotMatch(tree.root.findByProps({role:'status'}).children.join(''),/已刷新/);
act(()=>button('refresh').props.onClick());expectRows(20);
await act(async()=>rejectRead(new Error('Refresh offline')));expectRows(20);assert.match(content(),/Refresh offline/);
// A partial source gets a separate cursor pager; local pages and search never issue capability requests.
act(()=>setSnapshot(packet(1,45,100,'next-cursor')));expectRows(20);assert.match(content(),/搜索仅覆盖已读取范围/);assert.doesNotMatch(content(),/搜索覆盖当前完整结果/);
const before=calls.length;act(()=>button('local-next').props.onClick());expectRows(20);assert.match(content(),/scenario-021/);assert.equal(calls.length,before);
act(()=>{button('next').props.onClick();button('next').props.onClick();button('refresh').props.onClick();});assert.equal(calls.length,before+1);assert.equal(button('next').props.disabled,true);expectRows(20);assert.match(content(),/scenario-021/);
await act(async()=>rejectRead(new Error('Page offline')));assert.equal(button('page').children.join(''),'第 1 页');expectRows(20);assert.match(content(),/scenario-021/);
act(()=>button('next').props.onClick());
await act(async()=>resolveRead({bindings:[{bindingId,state:'failed',error:{message:'Provider refused page'},payload:null}]}));
assert.equal(button('page').children.join(''),'第 1 页');expectRows(20);assert.match(content(),/Provider refused page/);
act(()=>button('next').props.onClick());await act(async()=>resolveRead(packet(101,25,100,null,'next-cursor')));
expectRows(20);assert.equal(button('page').children.join(''),'第 2 页');assert.equal(button('next').props.disabled,true);assert.match(content(),/scenario-101/);
act(()=>button('local-next').props.onClick());expectRows(5);assert.match(content(),/scenario-121/);
// A failed refresh retains the remote cursor and existing small page.
act(()=>button('refresh').props.onClick());await act(async()=>rejectRead(new Error('Refresh offline')));expectRows(5);assert.equal(button('page').children.join(''),'第 2 页');
act(()=>button('previous').props.onClick());await act(async()=>resolveRead(packet(1,45,100,'next-cursor')));expectRows(20);assert.equal(button('page').children.join(''),'第 1 页');
act(()=>tree.unmount());
// Initial empty data performs one guarded refresh, including rapid clicks before the host sets refreshing.
initial={bindings:[{bindingId,state:'empty',payload:null}]};const initialCalls=calls.length;mount();assert.equal(calls.length,initialCalls+1);
act(()=>button('refresh').props.onClick());assert.equal(calls.length,initialCalls+1);
await act(async()=>resolveRead(packet(1,60,60)));expectRows(20);
act(()=>tree.unmount());console.log('GENERATED_TEMPLATE_PERFORMANCE_PASS');
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
`},outfile:entry,bundle:true,platform:'node',format:'cjs',plugins:[{name:'isolated-template-hook',setup(builder){builder.onResolve({filter:/^(react(?:\/.*)?|react-test-renderer)$/},args=>({path:require.resolve(args.path),external:true}));builder.onResolve({filter:/^@dsh\/apps-component-runtime\/apps\/react$/},()=>({path:'hook',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useApps=()=>globalThis.templateHook();'}));}}]});
      const result=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});
      assert.equal(result.status,0,[result.error?.message,result.stdout,result.stderr].filter(Boolean).join('\n'));assert.match(result.stdout,/GENERATED_TEMPLATE_PERFORMANCE_PASS/);
    }finally{
      const absolute=resolve(directory),within=relative(resolve(tmpdir()),absolute);
      assert.ok(within&&!within.startsWith('..')&&resolve(tmpdir(),within)===absolute&&/^apps-template-performance-[^\\/]+$/.test(absolute.split(/[\\/]/).at(-1)!));
      await rm(absolute,{recursive:true,force:true});
    }
  });
}
