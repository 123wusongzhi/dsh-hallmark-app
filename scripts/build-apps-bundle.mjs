import {build as esbuild} from 'esbuild';
import ts from 'typescript';
import {mkdir, readFile, writeFile, cp, readdir, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join, resolve} from 'node:path';
const sourceInputPaths=new Set(['scripts/build-apps-bundle.mjs','scripts/create-apps-source.mjs','scripts/apps-authoring-build.mjs','scripts/apps-authoring-preview.mjs','scripts/verify-apps-sdk.mjs','scripts/install-desktop-apps.ps1','scripts/install-design-skills.ps1','skills/hallmark-component-design/SKILL.md','bundles/apps/package.json','bundles/apps/versions.json','bundles/apps/cordis.patch.yml','pnpm-lock.yaml']);
async function build(options){
  const result=await esbuild({...options,metafile:true});
  for(const path of Object.keys(result.metafile.inputs))if(/^(packages|bundles)\//.test(path.replaceAll('\\','/')))sourceInputPaths.add(path.replaceAll('\\','/'));
  return result;
}
const directory = 'bundles/apps';
const manifest = JSON.parse(await readFile(`${directory}/package.json`,'utf8'));
const versions = JSON.parse(await readFile(`${directory}/versions.json`,'utf8'));
if (manifest.version !== versions.bundleVersion) throw new Error('BUNDLE_VERSION_MISMATCH');
if(!/^[a-z0-9-]+$/.test(versions.releaseId)||!/^[a-z0-9.-]+$/.test(manifest.version))throw new Error('INVALID_RELEASE_IDENTITY');
const hostSource=await readFile(`${directory}/server/index.ts`,'utf8'),runtimeSource=await readFile('packages/app-runtime/src/index.ts','utf8'),storeSource=await readFile('packages/app-runtime/src/store.ts','utf8');
if(!hostSource.includes(`export const version = '${versions.hostPluginVersion}'`)||!runtimeSource.includes(`readonly runtimeVersion = '${versions.runtimeVersion}'`)||!storeSource.includes(`DATABASE_SCHEMA_VERSION = ${versions.databaseSchemaVersion}`))throw new Error('SOURCE_VERSION_IDENTITY_MISMATCH');
await mkdir(`${directory}/lib`,{recursive:true});await mkdir(`${directory}/client`,{recursive:true});
await build({entryPoints:[`${directory}/server/index.ts`],outfile:`${directory}/lib/index.js`,bundle:true,platform:'node',format:'esm',target:'node22',sourcemap:true,packages:'external'});
const client = await build({entryPoints:[`${directory}/client/index.tsx`],bundle:true,write:false,platform:'browser',format:'cjs',target:'es2022',jsx:'automatic',external:['react','react/jsx-runtime','react-dom','react-dom/client','@deepseek-ai/*'],define:{'process.env.NODE_ENV':'"production"'}});
const javascript = client.outputFiles.find(file => file.path.endsWith('.js')) ?? client.outputFiles[0];
await writeFile(`${directory}/client/client.js`,`window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory:function(require){var module={exports:{}};var exports=module.exports;\n${javascript.text}\nreturn module.exports;}});\n`);
// Only the explicit Runtime executable imports concrete Providers; it is packaged as one companion entry.
await build({entryPoints:['packages/service/src/apps-main.ts'],outfile:`${directory}/lib/runtime.js`,bundle:true,platform:'node',format:'esm',target:'node22',sourcemap:true,packages:'external'});
// Node-only CLI entries bundle all project TS dependencies and load outside the checkout.
for(const name of ['apps-authoring-build','apps-authoring-preview'])await build({entryPoints:[`scripts/${name}.mjs`],outfile:`${directory}/lib/${name}.js`,bundle:true,platform:'node',format:'esm',target:'node22',sourcemap:true,banner:{js:'#!/usr/bin/env node'}});
// Installable development SDKs travel with the bundle; each component's normal React dependencies remain in its own lockfile.
const generatedSdk=resolve(directory,'sdk'),bundleDirectory=resolve(directory);if(generatedSdk!==join(bundleDirectory,'sdk'))throw new Error('INVALID_GENERATED_SDK_DIRECTORY');
await rm(generatedSdk,{recursive:true,force:true});
for (const name of ['app-contracts','app-sdk','component-runtime']) await mkdir(`${directory}/sdk/${name}`,{recursive:true});
await build({entryPoints:['packages/app-contracts/src/index.ts'],outfile:`${directory}/sdk/app-contracts/index.js`,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external'});
await build({entryPoints:['packages/app-sdk/src/index.ts'],outfile:`${directory}/sdk/app-sdk/index.js`,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external'});
await build({entryPoints:['packages/app-sdk/src/generated.ts'],outfile:`${directory}/sdk/app-sdk/generated.js`,bundle:true,platform:'node',format:'esm',target:'node22',packages:'external'});
await build({entryPoints:['packages/component-runtime/src/client.ts'],outfile:`${directory}/sdk/component-runtime/client.js`,bundle:true,platform:'browser',format:'esm',target:'es2022'});
await build({entryPoints:['packages/component-runtime/src/react.tsx'],outfile:`${directory}/sdk/component-runtime/react.js`,bundle:true,platform:'browser',format:'esm',target:'es2022',external:['react']});
// Compatible additive v2 subpaths. Historical root/v1 exports keep their original implementation.
await build({entryPoints:['packages/component-runtime/src/apps-client.ts'],outfile:`${directory}/sdk/component-runtime/apps-client.js`,bundle:true,platform:'browser',format:'esm',target:'es2022'});
await build({entryPoints:['packages/component-runtime/src/apps-react.tsx'],outfile:`${directory}/sdk/component-runtime/apps-react.js`,bundle:true,platform:'browser',format:'esm',target:'es2022',external:['react','react/jsx-runtime']});
const sourceFiles=[];
for(const name of ['app-contracts','app-sdk','component-runtime'])for(const entry of await readdir(`packages/${name}/src`,{recursive:true,withFileTypes:true}))if(entry.isFile()&&/\.tsx?$/.test(entry.name))sourceFiles.push(join(entry.parentPath,entry.name));
for(const path of sourceFiles)sourceInputPaths.add(path.replaceAll('\\','/'));
const typeOptions={target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,skipLibCheck:true,jsx:ts.JsxEmit.ReactJSX,declaration:true,emitDeclarationOnly:true,allowImportingTsExtensions:true,rootDir:resolve('packages'),outDir:resolve(`${directory}/sdk`),lib:['lib.es2023.d.ts','lib.dom.d.ts']};
const typeHost=ts.createCompilerHost(typeOptions),originalWrite=typeHost.writeFile;
typeHost.writeFile=(file,data,...args)=>originalWrite(file,data.replaceAll('../../app-contracts/src/index.ts','@dsh/apps-contracts').replace(/(from\s+['"][^'"]+)\.tsx?(['"])/g,'$1.js$2'),...args);
const typeProgram=ts.createProgram(sourceFiles,typeOptions,typeHost),typeDiagnostics=ts.getPreEmitDiagnostics(typeProgram);if(typeDiagnostics.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(typeDiagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:file=>file,getNewLine:()=> '\n'}));
const emitted=typeProgram.emit();if(emitted.emitSkipped)throw new Error('SDK_DECLARATION_EMIT_FAILED');
const sdkDependencies={'@dsh/apps-contracts':'file:../app-contracts'};
await writeFile(`${directory}/sdk/app-sdk/package.json`,JSON.stringify({name:'@dsh/apps-sdk',version:manifest.version,type:'module',exports:{'.':{types:'./src/index.d.ts',default:'./index.js'},'./generated':{types:'./src/generated.d.ts',default:'./generated.js'}},dependencies:sdkDependencies,engines:{node:'>=22.18'}},null,2)+'\n');
await writeFile(`${directory}/sdk/app-contracts/package.json`,JSON.stringify({name:'@dsh/apps-contracts',version:manifest.version,type:'module',exports:{'.':{types:'./src/index.d.ts',default:'./index.js'}},engines:{node:'>=22.18'}},null,2)+'\n');
await writeFile(`${directory}/sdk/component-runtime/package.json`,JSON.stringify({name:'@dsh/apps-component-runtime',version:manifest.version,type:'module',exports:{'.':{types:'./src/client.d.ts',default:'./client.js'},'./react':{types:'./src/react.d.ts',default:'./react.js'},'./apps':{types:'./src/apps-client.d.ts',default:'./apps-client.js'},'./apps/react':{types:'./src/apps-react.d.ts',default:'./apps-react.js'}},dependencies:sdkDependencies,peerDependencies:{react:'>=18'}},null,2)+'\n');
await mkdir(`${directory}/source-starter`,{recursive:true});
await cp('scripts/create-apps-source.mjs',`${directory}/source-starter/create-apps-source.mjs`);
const hashes = {};
for (const file of ['package.json','cordis.patch.yml','versions.json','client/client.js']) hashes[file] = createHash('sha256').update(await readFile(`${directory}/${file}`)).digest('hex');
for (const section of ['lib','sdk','source-starter'])for (const entry of await readdir(`${directory}/${section}`,{recursive:true,withFileTypes:true}))if(entry.isFile()){const absolute=resolve(entry.parentPath,entry.name);const path=absolute.substring(resolve(directory).length+1).replaceAll('\\','/');hashes[path]=createHash('sha256').update(await readFile(absolute)).digest('hex');}
const evidence = `evidence/${versions.releaseId}/candidates/${manifest.version}`;await mkdir(evidence,{recursive:true});
const sourceInputs={};for(const path of [...sourceInputPaths].sort())sourceInputs[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile(`${evidence}/build-manifest.json`,JSON.stringify({releaseId:versions.releaseId,bundleVersion:manifest.version,versions,artifacts:hashes,sourceInputs,sourceBuild:true,installed:false,liveAcceptance:'NOT_RUN',runtimeEntry:'lib/runtime.js',authoringEntries:{build:'lib/apps-authoring-build.js',preview:'lib/apps-authoring-preview.js'},logicalPlugins:['plugin-apps','plugin-hallmark','plugin-notes'],publicEntries:1,runtimeProcesses:1},null,2)+'\n');
// npm pack uses the ordinary manifest file allowlist and does not install anything.
await mkdir('artifacts',{recursive:true});
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let packed;
if (process.platform === 'win32') {
  const script = "$ErrorActionPreference='Stop'; & npm.cmd pack --ignore-scripts --json --pack-destination '" + resolve('artifacts').replaceAll("'","''") + "'; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}";
  packed = JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',script],{cwd:resolve(directory),encoding:'utf8'}));
} else packed = JSON.parse(execFileSync(npm,['pack','--ignore-scripts','--json','--pack-destination',resolve('artifacts')],{cwd:resolve(directory),encoding:'utf8'}));
const archive = join('artifacts',packed[0].filename);const archiveHash = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(`${evidence}/package-manifest.json`,JSON.stringify({archive,sha256:archiveHash,installed:false,package:packed[0]},null,2)+'\n');
console.log(JSON.stringify({bundle:manifest.name,version:manifest.version,archive,sha256:archiveHash,installed:false}));
