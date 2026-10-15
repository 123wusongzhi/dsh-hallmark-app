import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,unlinkSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomInt} from 'node:crypto';
import {basename,dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
// @ts-expect-error The standalone preview CLI exports its actual resource server.
import {startSourcePreview} from '../../scripts/source-preview.mjs';

const repository=fileURLToPath(new URL('../../',import.meta.url));

// Real installed Vite and production resource routing; no browser or business data.
test('actual Vite template entry resolves its emitted JavaScript and CSS through the source preview resource handler',{timeout:45000},async t=>{
  const template=join(repository,'component-workspace/collected-products');
  const require=createRequire(join(template,'package.json'));
  const vite=join(dirname(require.resolve('vite/package.json')),'bin/vite.js');
  require.resolve('@vitejs/plugin-react');require.resolve('@tailwindcss/vite');
  const dependencies=realpathSync(join(template,'node_modules'));
  const root=join(repository,'test/source-preview/artifacts');mkdirSync(root,{recursive:true});
  const directory=mkdtempSync(join(root,'source-vite-assets-')),project=join(directory,'project'),dependencyLink=join(project,'node_modules');
  const requests:{url:string;status:number;mime:string|null}[]=[];
  let preview:Awaited<ReturnType<typeof startSourcePreview>>|undefined,passed=false;
  try{
    cpSync(template,project,{recursive:true,filter:path=>!['node_modules','dist','.preview'].includes(basename(path))});
    symlinkSync(dependencies,dependencyLink,'junction');
    assert.deepEqual(readFileSync(join(project,'vite.config.ts')),readFileSync(join(template,'vite.config.ts')));
    const built=await new Promise<{error:Error|null;stdout:string;stderr:string}>(accept=>{
      execFile(process.execPath,[vite,'build'],{cwd:project,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024,windowsHide:true,signal:t.signal},(error,stdout,stderr)=>accept({error,stdout,stderr}));
    });
    writeFileSync(join(directory,'build.stdout.txt'),built.stdout);writeFileSync(join(directory,'build.stderr.txt'),built.stderr);
    writeFileSync(join(directory,'build.json'),JSON.stringify({command:[process.execPath,vite,'build'],cwd:project,passed:built.error===null,error:built.error?.message??null},null,2)+'\n');
    assert.equal(built.error,null,`Actual Vite build failed; logs: ${directory}\n${built.stderr}`);
    // A safe high port avoids Fetch-restricted ephemeral ports; retry only bind conflicts.
    for(let attempt=0;attempt<10&&!preview;attempt++)try{preview=await startSourcePreview({directory:project,port:randomInt(20000,65536)});}catch(error){if(!['EADDRINUSE','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
    assert.ok(preview,'an isolated preview listener must be available');
    writeFileSync(join(directory,'preview-manifest.json'),JSON.stringify(preview.manifest,null,2)+'\n');
    const entryURL=new URL('/dist/index.html',preview.url);
    const get=async(url:URL)=>{const response=await fetch(url,{signal:AbortSignal.any([t.signal,AbortSignal.timeout(5000)])});requests.push({url:url.href,status:response.status,mime:response.headers.get('content-type')});return response;};
    const entry=await get(entryURL);assert.equal(entry.status,200);
    const html=await entry.text();writeFileSync(join(directory,'entry.html'),html);
    assert.equal(html,readFileSync(join(project,'dist/index.html'),'utf8'));
    const scriptTags=html.match(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi)??[];
    const styleTags=(html.match(/<link\b[^>]*>/gi)??[]).filter(tag=>/\brel=["']stylesheet["']/i.test(tag));
    assert.ok(scriptTags.length>0,'the actual template must emit its executable entry');
    assert.ok(styleTags.length>0,'the actual template must emit its stylesheet');
    const resources=[...scriptTags.map(tag=>({kind:'JavaScript',tag,attribute:'src',mime:/^(?:text|application)\/javascript(?:;|$)/})),...styleTags.map(tag=>({kind:'CSS',tag,attribute:'href',mime:/^text\/css(?:;|$)/}))];
    for(const {kind,tag,attribute,mime}of resources){
      const reference=new RegExp(`\\b${attribute}=["']([^"']+)["']`,'i').exec(tag)?.[1];assert.ok(reference,`${kind} entry URL must be present`);
      const url=new URL(reference,entryURL);assert.equal(url.origin,entryURL.origin,'the local template must not require a remote asset');
      const response=await get(url);
      assert.equal(response.status,200,`emitted ${kind} URL must be served by the actual preview resource handler: ${url.pathname}`);
      assert.match(response.headers.get('content-type')??'',mime);
      const bytes=Buffer.from(await response.arrayBuffer());assert.ok(bytes.length>0);
      const file=decodeURIComponent(url.pathname.slice('/dist/'.length)),asset=preview.manifest.files.find((item:{name:string})=>item.name===file);
      assert.ok(asset,`${kind} URL must address an emitted manifest member`);assert.deepEqual(bytes,readFileSync(join(project,'dist',file)));
    }
    passed=true;
  }catch(error){t.diagnostic(`Preserved Vite fixture logs: ${directory}`);throw error;}
  finally{
    writeFileSync(join(directory,'requests.json'),JSON.stringify(requests,null,2)+'\n');
    try{await preview?.close();}catch(error){passed=false;t.diagnostic(`Preview cleanup failed; logs: ${directory}`);throw error;}
    finally{
      const within=relative(root,directory);assert.ok(/^source-vite-assets-[^/\\]+$/.test(within)&&resolve(root,within)===directory);
      assert.equal(relative(directory,project),'project');
      if(existsSync(dependencyLink))unlinkSync(dependencyLink);
      rmSync(project,{recursive:true,force:true,maxRetries:3});
      writeFileSync(join(directory,'cleanup.json'),JSON.stringify({serverListening:preview?.server.listening??false,projectRemoved:!existsSync(project)},null,2)+'\n');
      if(passed)rmSync(directory,{recursive:true,force:true,maxRetries:3});
    }
  }
});
