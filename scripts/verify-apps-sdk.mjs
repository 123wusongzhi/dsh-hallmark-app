/** Verify packed SDK JS, declarations and a generated ordinary component without installing packages. */
import {mkdtemp,mkdir,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const repository=resolve('.'),directory=await mkdtemp(join(tmpdir(),'apps-sdk-fixture-')),evidence='evidence/apps-v1-20261007/P5/TODO-026';
const packageManifest=JSON.parse(await readFile(`${evidence}/package-manifest.json`,'utf8')),archive=resolve(packageManifest.archive),archiveSha256=createHash('sha256').update(await readFile(archive)).digest('hex');
if(archiveSha256!==packageManifest.sha256)throw new Error('SDK_ARCHIVE_HASH_MISMATCH');
let result;
try{
  const entries=execFileSync('tar',['-tf',archive],{encoding:'utf8'}).trim().split(/\r?\n/);if(entries.some(path=>!path.startsWith('package/')||path.split('/').includes('..')||path.includes('\\')))throw new Error('UNSAFE_ARCHIVE_PATH');
  execFileSync('tar',['-xf',archive,'-C',directory]);
  const packedGenerator=join(directory,'package/source-starter/create-apps-source.mjs');
  const packedGeneratorSha256=createHash('sha256').update(await readFile(packedGenerator)).digest('hex');
  const buildManifest=JSON.parse(await readFile(`${evidence}/build-manifest.json`,'utf8'));
  if(packedGeneratorSha256!==buildManifest.artifacts['source-starter/create-apps-source.mjs'])throw new Error('PACKED_STARTER_HASH_MISMATCH');
  const {createAppsSource}=await import(pathToFileURL(packedGenerator).href);
  const sdk=join(directory,'package/sdk'),project=join(directory,'project');
  const generated=await createAppsSource({directory:project,sdkDirectory:join(sdk,'component-runtime')});
  // These links are fixture wiring to already installed development dependencies, not a generated dependency lock.
  await mkdir(join(directory,'node_modules/@dsh'),{recursive:true});
  for(const [name,folder]of [['apps-contracts','app-contracts'],['apps-sdk','app-sdk'],['apps-component-runtime','component-runtime']])await symlink(join(sdk,folder),join(directory,'node_modules/@dsh',name),'junction');
  for(const name of ['react','react-dom','esbuild','@types'])await symlink(join(repository,'node_modules',name),join(directory,'node_modules',name),'junction');
  await writeFile(join(project,'check.mjs'),"import {AppsClient} from '@dsh/apps-sdk';\nimport {catalog} from '@dsh/apps-sdk/generated';\nimport {canonicalJson} from '@dsh/apps-contracts';\nimport {createAppsClient} from '@dsh/apps-component-runtime';\nif(typeof AppsClient!=='function'||typeof createAppsClient!=='function'||!catalog.length||canonicalJson({b:2,a:1})!=='{\"a\":1,\"b\":2}')throw new Error('SDK_JS_INVALID');\nconsole.log(JSON.stringify({javascript:'PASS',capabilities:catalog.length}));\n");
  const javascript=JSON.parse(execFileSync(process.execPath,['check.mjs'],{cwd:project,encoding:'utf8'}));
  await writeFile(join(project,'sdk-types.ts'),"import type {JsonValue,CapabilityResult} from '@dsh/apps-contracts';\nimport {AppsClient} from '@dsh/apps-sdk';\nimport {catalog,call0} from '@dsh/apps-sdk/generated';\nimport {createAppsClient} from '@dsh/apps-component-runtime';\nimport {useApps} from '@dsh/apps-component-runtime/react';\nconst value:JsonValue={catalog:catalog[0].capabilityId};\nconst accepts=(result:CapabilityResult)=>result.status;\nvoid [AppsClient,call0,createAppsClient,useApps,value,accepts];\n");
  const compiler=ts.createProgram([join(project,'sdk-types.ts'),join(project,'src/main.tsx')],{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:false,jsx:ts.JsxEmit.ReactJSX,types:['node','react'],typeRoots:[join(directory,'node_modules/@types')],lib:['lib.es2023.d.ts','lib.dom.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(compiler);if(diagnostics.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>project,getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
  execFileSync(process.execPath,['build.mjs'],{cwd:project,encoding:'utf8'});
  const artifacts={};for(const file of ['dist/index.html','dist/app.js','dist/app.css'])artifacts[file]=createHash('sha256').update(await readFile(join(project,file))).digest('hex');
  result={status:'PASS',evidenceLevel:'fixture_packed_artifacts',command:'node scripts/verify-apps-sdk.mjs',archiveSha256,javascript,declarations:'PASS',sourceStarter:'PASS',generator:{extractedFromCandidateArchive:true,relativePath:'source-starter/create-apps-source.mjs',sha256:packedGeneratorSha256},starterFiles:generated.files,artifacts,installed:false,normalDependencyInstall:'NOT_RUN',fixtureDependencies:'Links to repository existing React/ReactDOM/esbuild/types; no package installation or fabricated lockfile.',businessAssetsPackaged:false};
}catch(error){result={status:'FAIL',command:'node scripts/verify-apps-sdk.mjs',archiveSha256,error:error.message};throw error;}
finally{
  if(result)await writeFile(`${evidence}/sdk-package-fixture.json`,JSON.stringify(result,null,2)+'\n');
  const target=resolve(directory),within=relative(resolve(tmpdir()),target);if(!within||within.startsWith('..')||resolve(tmpdir(),within)!==target||!/^apps-sdk-fixture-[^\\/]+$/.test(target.split(/[\\/]/).at(-1)))throw new Error('INVALID_SDK_FIXTURE_DIRECTORY');
  await rm(target,{recursive:true,force:true});
}
console.log(JSON.stringify(result));
