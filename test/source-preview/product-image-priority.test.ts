import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {realDetail} from '../real-data/corpus.ts';

test('generated product image prioritizes visible rows and recovers after a failed source changes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'apps-image-priority-'));
  const sdk=join(directory,'sdk'),project=join(directory,'component');
  const require=createRequire(import.meta.url);
  try {
    await mkdir(sdk);
    await writeFile(join(sdk,'package.json'),JSON.stringify({name:'@dsh/apps-component-runtime'}));
    const {createAppsSource}=await import(pathToFileURL(resolve('scripts/create-apps-source.mjs')).href);
    await createAppsSource({directory:project,sdkDirectory:sdk});
    await writeFile(join(project,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2023',module:'ESNext',moduleResolution:'Bundler',jsx:'react',strict:true,skipLibCheck:true,esModuleInterop:true,noEmit:true,types:[],lib:['ES2023','DOM'],paths:{react:[join(dirname(require.resolve('@types/react/package.json')),'index.d.ts')]}},files:['src/Image.tsx']}));
    const checked=spawnSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--project',join(project,'tsconfig.json')],{encoding:'utf8',timeout:30000});
    assert.equal(checked.status,0,checked.error?.message??checked.stdout+checked.stderr);

    const entry=join(directory,'fixture.cjs');
    await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';
import {create,act} from 'react-test-renderer';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import {Image} from ${JSON.stringify(join(project,'src/Image.tsx'))};
const imageRecords=${JSON.stringify([realDetail(0),realDetail(1),realDetail(2)])};
const warnings=[],originalError=console.error;
console.error=(...values)=>warnings.push(values.map(String).join(' '));
let tree;
try {
  const markup=renderToStaticMarkup(<Image src={imageRecords[0].mainImage} alt="首屏商品" priority/>);
  assert.match(markup,/fetchpriority="high"[^>]+loading="eager"[^>]+src=/);
  assert.match(markup,/fetchpriority="high"/);
  assert.match(markup,/decoding="async"/);
  act(()=>{tree=create(<Image src={imageRecords[0].mainImage} alt="首屏商品"/>);});
  const image=()=>tree.root.findByType('img');
  assert.equal(image().props.loading,'lazy');
  assert.equal(image().props.fetchpriority,'auto');
  assert.equal(image().props.decoding,'async');
  assert.equal(image().props.width,48);
  assert.equal(image().props.height,48);
  act(()=>tree.update(<Image src={imageRecords[0].mainImage} alt="首屏商品" priority/>));
  assert.equal(image().props.loading,'eager');
  assert.equal(image().props.fetchpriority,'high');
  act(()=>image().props.onError());
  assert.equal(tree.root.findAllByType('img').length,0);
  assert.match(JSON.stringify(tree.toJSON()),/暂无图片/);
  act(()=>tree.unmount());
  let top=1200;
  const node={ownerDocument:{defaultView:{innerHeight:900,innerWidth:1040}},getBoundingClientRect:()=>({width:48,height:48,left:10,right:58,top,bottom:top+48})};
  act(()=>{tree=create(<Image src={imageRecords[1].mainImage} alt="屏外商品"/>,{createNodeMock:element=>element.type==='span'&&element.props.style?.position==='relative'?node:null});});
  assert.equal(image().props.loading,'lazy');assert.equal(image().props.fetchpriority,'auto');
  top=600;
  act(()=>tree.update(<Image src={imageRecords[1].mainImage} alt="进入首屏的商品"/>));
  assert.equal(image().props.loading,'eager','visible images beyond the first six must start without a lazy threshold');
  assert.equal(image().props.fetchpriority,'auto','viewport promotion must not make every image high priority');
  act(()=>tree.update(<Image src={imageRecords[2].mainImage} alt="替换商品" priority/>));
  assert.equal(image().props.src,imageRecords[2].mainImage);
  assert.equal(image().props.loading,'eager');
  assert.match(JSON.stringify(tree.toJSON()),/加载中/);
  act(()=>image().props.onLoad());
  assert.doesNotMatch(JSON.stringify(tree.toJSON()),/加载中|暂无图片/);
  act(()=>tree.update(<Image alt="缺少图片"/>));
  assert.equal(tree.root.findAllByType('img').length,0);
  assert.match(JSON.stringify(tree.toJSON()),/暂无图片/);
} finally {
  if(tree)act(()=>tree.unmount());
  console.error=originalError;
}
assert.deepEqual(warnings,[],'React 18 must not emit unknown-prop warnings');
console.log('PRODUCT_IMAGE_PRIORITY_PASS');
`},outfile:entry,bundle:true,platform:'node',format:'cjs',alias:{react:require.resolve('react'),'react-test-renderer':require.resolve('react-test-renderer'),'react-dom/server':require.resolve('react-dom/server')}});
    const rendered=spawnSync(process.execPath,[entry],{encoding:'utf8',timeout:15000});
    assert.equal(rendered.status,0,rendered.error?.message??rendered.stderr);
    assert.match(rendered.stdout,/PRODUCT_IMAGE_PRIORITY_PASS/);
  } finally {
    const absolute=resolve(directory),within=relative(resolve(tmpdir()),absolute);
    assert.ok(within&&!within.startsWith('..')&&resolve(tmpdir(),within)===absolute&&/^apps-image-priority-[^\\/]+$/.test(absolute.split(/[\\/]/).at(-1)!));
    await rm(absolute,{recursive:true,force:true});
  }
});
