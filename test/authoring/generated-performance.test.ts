import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {SourceComponentStore} from '../../packages/source-components/src/index.ts';
import {AuthoringEvidenceRunner} from '../../packages/source-components/src/authoring-evidence.ts';
import {realCorpus,realCorpusPath} from '../real-data/corpus.ts';
// @ts-expect-error The standalone CLI exports its real isolated browser runner.
import {runAuthoringPreview} from '../../scripts/apps-authoring-preview.mjs';

const browser=process.env.DSH_PREVIEW_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const require=createRequire(import.meta.url);

test('generated product templates pass the formal two-viewport performance gate with real SDK and local paging',{skip:!existsSync(browser),timeout:120000},async t=>{
  const root=mkdtempSync(join(tmpdir(),'apps-generated-performance-')),sdk=join(root,'sdk');mkdirSync(sdk);
  let passed=false;
  const sources=new SourceComponentStore(join(root,'archive')),runner=new AuthoringEvidenceRunner(join(root,'evidence'));
  const corpus=realCorpus(),corpusRoot=dirname(realCorpusPath);
  const assets=corpus.imageAssets;
  const images=new Map<string,{bytes:Buffer;mimeType:string}>();
  for(const asset of assets){if(asset.status!=='captured')continue;assert.ok(asset.file&&asset.mimeType,`Captured image required for source ${asset.productId}`);const bytes=readFileSync(join(corpusRoot,asset.file));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);images.set(asset.productId,{bytes,mimeType:asset.mimeType});}
  const imageServer=createServer((request,response)=>{const id=decodeURIComponent(new URL(request.url!,'http://replay').pathname.slice(1)),asset=images.get(id);if(!asset){response.writeHead(404);response.end();return;}response.writeHead(200,{'Content-Type':asset.mimeType,'Cache-Control':'no-store'});response.end(asset.bytes);});
  await new Promise<void>(resolve=>imageServer.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{imageServer.closeAllConnections();await new Promise<void>(resolve=>imageServer.close(()=>resolve()));});
  const imageOrigin=`http://127.0.0.1:${(imageServer.address() as {port:number}).port}`;
  t.diagnostic(`Generated template browser evidence: ${root}`);
  t.after(()=>{if(!passed||process.env.DSH_KEEP_GENERATED_TEMPLATE_EVIDENCE==='1')return;const within=relative(resolve(tmpdir()),resolve(root));assert.ok(within.startsWith('apps-generated-performance-')&&!within.includes('/')&&!within.includes('\\')&&resolve(tmpdir(),within)===resolve(root));rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});});
  // This is an isolated SDK/package fixture; no business connections, live shops or generated production lockfiles.
  writeFileSync(join(sdk,'package.json'),JSON.stringify({name:'@dsh/apps-component-runtime',type:'module',exports:{'./apps/react':'./apps-react.js'},peerDependencies:{react:'>=18'}}));
  await build({entryPoints:[resolve('packages/component-runtime/src/apps-react.tsx')],outfile:join(sdk,'apps-react.js'),bundle:true,platform:'browser',format:'esm',target:'es2022',external:['react','react/jsx-runtime']});
  const {createAppsSource}=await import(pathToFileURL(resolve('scripts/create-apps-source.mjs')).href);
  const results=[];
  try{
  for(const [index,template]of ['product-list','composed-table'].entries()){
    const workspace=join(root,template);await createAppsSource({directory:workspace,sdkDirectory:sdk,template});
    mkdirSync(join(workspace,'node_modules/@dsh'),{recursive:true});
    for(const name of ['react','react-dom','esbuild'])symlinkSync(dirname(require.resolve(`${name}/package.json`)),join(workspace,'node_modules',name),'junction');
    symlinkSync(sdk,join(workspace,'node_modules/@dsh/apps-component-runtime'),'junction');
    writeFileSync(join(workspace,'package-lock.json'),JSON.stringify({name:'isolated-template-fixture',lockfileVersion:3,packages:{}}));
    // Project all 41 recorded sources to display rows; repeated aliases extend the paging case to 60 rows.
    // Original commodity names and genuine image bytes remain paired; no sale price is inferred from procurement price.
    const products=Array.from({length:60},(_,offset)=>{const detail=corpus.records[offset%corpus.records.length].detail;return {storeId:'fixture',productId:String(offset+1),offerId:String(offset+1),sku:detail.skus[0]?.sourceSkuId??null,title:detail.title,imageUrl:`${imageOrigin}/${encodeURIComponent(detail.id)}`,currency:detail.currency};});
    const composed=template==='composed-table',bindingId=composed?'main':'products';
    const payload=composed?{items:products.map(row=>({products:{title:row.title,image:row.imageUrl}})),total:60,warnings:[],fieldMeta:[{key:'products.image',label:'商品图片',source:'products',format:'image'},{key:'products.title',label:'商品名称',source:'products',format:'text'}]}:{products,total:60};
    const data={viewId:'preview',bindings:[{bindingId,revision:'fixture-1',state:'ready',sourceDataTime:'2026-10-11T00:00:00Z',resources:[],query:{appId:'hallmark',connectionId:'fixture',capabilityId:composed?'hallmark.ozon.compose':'hallmark.products.list',capabilityVersion:'1.0.0',input:{storeId:'fixture'},projection:[]},payload}]};
    const attemptId=`generated-${template}`,built=await runner.build({attemptId,epoch:1,sourceRevision:index+1,workspacePath:workspace,command:[process.execPath,'build.mjs'],sources});
    assert.equal(built.report.verdict,'PASS',JSON.stringify(built.report));
    const plan=JSON.parse(readFileSync(join(workspace,'.preview/plan.json'),'utf8'));
    const tested=await runAuthoringPreview({...plan,attemptId,epoch:1,buildReceiptId:`fixture-${template}`,buildReportRef:built.reportRef,mode:'fixture',sources,runner,browserExecutable:browser,data,refreshData:data});
    results.push({template,reportRef:tested.reportRef,summaryPath:tested.summaryPath,performance:tested.report.performance,assertions:tested.report.assertionResults});
    writeFileSync(join(root,'results.json'),JSON.stringify(results,null,2));
    assert.equal(tested.report.verdict,'PASS',JSON.stringify(tested.summary));
    assert.equal(runner.verifyPreview(tested.reportRef,sources).verdict,'PASS');
    for(const viewport of tested.report.performance.viewports){
      assert.equal(viewport.initial.renderedRows,20);
      assert.equal(viewport.initial.lazyVisibleImages,0);
      assert.equal(viewport.initial.unprioritizedFirstImage,0);
      assert.equal(viewport.initial.missingImageSpace,0);
      assert.ok(viewport.initial.visibleImages>0);
      for(const interaction of viewport.interactions){assert.ok(interaction.renderedRows<=20);assert.equal(interaction.lazyVisibleImages,0);}
    }
  }
  passed=true;
  }catch(error){t.diagnostic(error instanceof Error?error.stack??error.message:String(error));throw error;}
});
