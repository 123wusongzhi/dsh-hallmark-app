import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {basename,dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
// @ts-expect-error The standalone preview CLI exports its actual resource server.
import {startSourcePreview} from '../../scripts/source-preview.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));

test('actual Vite template entry resolves its emitted JavaScript and CSS through the source preview resource handler',{timeout:45000},async()=>{
  const template=join(repository,'component-workspace/collected-products');
  // Resolve installed dependencies before creating a temporary directory. Never install or skip silently.
  const require=createRequire(join(template,'package.json'));
  const vite=join(dirname(require.resolve('vite/package.json')),'bin/vite.js');
  const dependencies=realpathSync(join(template,'node_modules'));
  const root=realpathSync(tmpdir()),directory=mkdtempSync(join(root,'source-vite-assets-')),project=join(directory,'project');
  let preview:Awaited<ReturnType<typeof startSourcePreview>>|undefined;
  try{
    cpSync(template,project,{recursive:true,filter:path=>!['node_modules','dist','.preview'].includes(basename(path))});
    symlinkSync(dependencies,join(project,'node_modules'),'junction');
    assert.deepEqual(readFileSync(join(project,'vite.config.ts')),readFileSync(join(template,'vite.config.ts')));
    // Use the installed real Vite CLI and unchanged React/Tailwind/config/entry sources, not an esbuild substitute.
    const built=spawnSync(process.execPath,[vite,'build'],{cwd:project,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
    assert.equal(built.status,0,[built.error?.message,built.stdout,built.stderr].filter(Boolean).join('\n'));
    preview=await startSourcePreview({directory:project,port:0});
    const entryURL=new URL('/dist/index.html',preview.url);
    const entry=await fetch(entryURL,{signal:AbortSignal.timeout(5000)});
    assert.equal(entry.status,200);
    const html=await entry.text();assert.equal(html,readFileSync(join(project,'dist/index.html'),'utf8'));
    const scriptTags=html.match(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi)??[];
    const styleTags=(html.match(/<link\b[^>]*>/gi)??[]).filter(tag=>/\brel=["']stylesheet["']/i.test(tag));
    assert.ok(scriptTags.length>0,'the actual template must emit its executable entry');
    assert.ok(styleTags.length>0,'the actual template must emit its stylesheet');
    const resources=[
      ...scriptTags.map(tag=>({kind:'JavaScript',tag,attribute:'src',mime:/javascript/})),
      ...styleTags.map(tag=>({kind:'CSS',tag,attribute:'href',mime:/^text\/css/})),
    ];
    for(const {kind,tag,attribute,mime} of resources){
      const reference=new RegExp(`\\b${attribute}=["']([^"']+)["']`,'i').exec(tag)?.[1];
      assert.ok(reference,`${kind} entry URL must be present`);
      const url=new URL(reference,entryURL);
      assert.equal(url.origin,entryURL.origin,'the local template must not require a remote asset');
      const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
      assert.equal(response.status,200,`emitted ${kind} URL must be served by the actual preview resource handler: ${url.pathname}`);
      assert.match(response.headers.get('content-type')??'',mime);
      const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>0);
      const file=url.pathname.slice('/dist/'.length);
      const asset=preview.manifest.files.find((item:{name:string})=>item.name===file);
      assert.ok(asset,`${kind} URL must address an emitted manifest member`);
      assert.deepEqual(bytes,readFileSync(join(project,'dist',file)));
    }
  }finally{
    try{await preview?.close();}finally{
      const within=relative(root,directory);assert.ok(/^source-vite-assets-[^/\\]+$/.test(within)&&resolve(root,within)===directory);
      rmSync(directory,{recursive:true,force:true});
    }
  }
});
