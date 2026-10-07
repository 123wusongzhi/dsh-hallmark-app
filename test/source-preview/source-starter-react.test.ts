import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

test('generated starter renders SDK hooks with the project React even when the SDK has a different peer copy',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'apps-react-dedupe-'));
  const sdk=join(directory,'linked-sdk'),project=join(directory,'component');
  const require=createRequire(import.meta.url);
  const react=dirname(require.resolve('react/package.json'));
  const reactDom=dirname(require.resolve('react-dom/package.json'));
  try {
    await mkdir(sdk);
    await writeFile(join(sdk,'package.json'),JSON.stringify({name:'@dsh/apps-component-runtime',type:'module',exports:{'./react':'./react.js'},peerDependencies:{react:'>=18'}}));
    // The published SDK deliberately leaves React external. The physical peer copies reproduce npm file links.
    await build({entryPoints:[resolve('packages/component-runtime/src/react.tsx')],outfile:join(sdk,'react.js'),bundle:true,platform:'browser',format:'esm',target:'es2022',external:['react']});
    await cp(react,join(directory,'node_modules/react'),{recursive:true});
    const {createAppsSource}=await import(pathToFileURL(resolve('scripts/create-apps-source.mjs')).href);
    await createAppsSource({directory:project,sdkDirectory:sdk});
    await cp(react,join(project,'node_modules/react'),{recursive:true});
    await cp(reactDom,join(project,'node_modules/react-dom'),{recursive:true});
    await mkdir(join(project,'node_modules/@dsh'),{recursive:true});
    await symlink(sdk,join(project,'node_modules/@dsh/apps-component-runtime'),'junction');
    await symlink(dirname(require.resolve('esbuild/package.json')),join(project,'node_modules/esbuild'),'junction');
    // Render the actual generated Component synchronously with ReactDOM so an invalid hook dispatcher fails.
    // SSR runs no useEffect, bridge requests, model calls or business requests.
    const entry=join(project,'src/main.tsx');
    const source=(await readFile(entry,'utf8')).replace("import {createRoot} from 'react-dom/client';","import {renderToString} from 'react-dom/server.browser';").replace("createRoot(document.getElementById('root')!).render(<Component/>);","console.log(renderToString(<Component/>));");
    await writeFile(entry,source);
    const buildFile=join(project,'build.mjs'),fixed=await readFile(buildFile,'utf8');
    const runBuild=()=>{const result=spawnSync(process.execPath,['build.mjs'],{cwd:project,encoding:'utf8',timeout:30000});assert.equal(result.status,0,result.error?.message??result.stderr);};
    const runComponent=()=>spawnSync(process.execPath,['dist/app.js'],{cwd:project,encoding:'utf8',timeout:10000});
    // The old configuration completes the build but fails on the same first SDK useRef as native desktop.
    await writeFile(buildFile,fixed.replace("alias:{react,'react-dom':reactDom},",''));
    runBuild();
    const before=runComponent();
    assert.notEqual(before.status,0);
    assert.match(before.stderr,/Cannot read properties of null \(reading 'useRef'\)/);
    await writeFile(buildFile,fixed);
    runBuild();
    const after=runComponent();
    assert.equal(after.status,0,after.error?.message??after.stderr);
    assert.match(after.stdout,/<h1>连接数据<\/h1>/);
    assert.match(after.stdout,/正在连接组件宿主/);
    assert.match(after.stdout,/本地计数：<!-- -->0/);
    const bundle=await readFile(join(project,'dist/app.js'),'utf8');
    assert.equal((bundle.match(/ReactCurrentDispatcher: \w+, ReactCurrentBatchConfig:/g)??[]).length,1,'SDK hooks and ReactDOM must share one bundled dispatcher');
  } finally {
    const absolute=resolve(directory),within=relative(resolve(tmpdir()),absolute);
    assert.ok(within&&!within.startsWith('..')&&resolve(tmpdir(),within)===absolute&&/^apps-react-dedupe-[^\\/]+$/.test(absolute.split(/[\\/]/).at(-1)!));
    await rm(absolute,{recursive:true,force:true});
  }
});
