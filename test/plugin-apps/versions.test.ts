import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,readFile,realpath,rm,symlink,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {dirname,join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const run=promisify(execFile);
const repository=fileURLToPath(new URL('../../',import.meta.url));
const hash=(content:string|Uint8Array)=>createHash('sha256').update(content).digest('hex');
const artifactPaths=['lib/runtime.js','lib/index.js','client/client.js','package.json','versions.json'] as const;

test('UI/Host release changes packaged Client and Host while Runtime, protocol and data versions remain independent',async t=>{
  const temporaryRoot=await realpath(tmpdir()),directory=await mkdtemp(join(temporaryRoot,'apps-version-domains-'));
  t.after(async()=>{
    assert.ok(resolve(directory).startsWith(join(temporaryRoot,'apps-version-domains-')));
    await rm(directory,{recursive:true,force:true,maxRetries:3});
  });
  // Include current non-ignored source additions without requiring git add; keep the same source roots.
  const inputs=['scripts','packages','skills','docs/component-authoring','bundles/apps/server','bundles/apps/client','bundles/apps/package.json','bundles/apps/versions.json','bundles/apps/cordis.patch.yml','package.json','pnpm-lock.yaml','tsconfig.json'];
  const sourceFiles=await run('git',['ls-files','--cached','--others','--exclude-standard','-z','--',...inputs],{cwd:repository,timeout:30000,maxBuffer:4*1024*1024});
  const paths=sourceFiles.stdout.split('\0').filter(Boolean);
  assert.ok(paths.includes('scripts/build-apps-bundle.mjs'),'Build source must be present in the checkout');
  for(const path of paths){
    const target=resolve(directory,path);
    assert.ok(target.startsWith(directory+sep),`Build input must stay within its fixture: ${path}`);
    await mkdir(dirname(target),{recursive:true});
    await cp(join(repository,path),target);
  }
  await symlink(await realpath(join(repository,'node_modules')),join(directory,'node_modules'),'junction');
  const bundle=join(directory,'bundles/apps');
  const readVersions=async()=>JSON.parse(await readFile(join(bundle,'versions.json'),'utf8')) as Record<string,unknown>;
  const versions=await readVersions();
  const readBuild=async()=>{
    const actualVersions=await readVersions();
    const artifacts=Object.fromEntries(await Promise.all(artifactPaths.map(async path=>[path,hash(await readFile(join(bundle,path)))])));
    const manifest=JSON.parse(await readFile(join(directory,'evidence',String(actualVersions.releaseId),'candidates',String(actualVersions.bundleVersion),'build-manifest.json'),'utf8'));
    assert.equal(manifest.bundleVersion,actualVersions.bundleVersion);
    assert.deepEqual(manifest.versions,actualVersions,'Build evidence must describe the actual version domains');
    for(const path of artifactPaths)assert.equal(manifest.artifacts[path],artifacts[path],`Build evidence hash: ${path}`);
    assert.equal(JSON.parse(await readFile(join(bundle,'package.json'),'utf8')).version,actualVersions.bundleVersion);
    return {versions:actualVersions,artifacts};
  };
  // Windows treats environment names case-insensitively; remove inherited duplicate npm keys.
  const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^npm_config_(offline|update_notifier|audit|fund|cache)$/i.test(key)));
  const build=async()=>run(process.execPath,['scripts/build-apps-bundle.mjs'],{
    cwd:directory,timeout:120000,maxBuffer:4*1024*1024,
    env:{...environment,npm_config_offline:'true',npm_config_update_notifier:'false',npm_config_audit:'false',npm_config_fund:'false',npm_config_cache:join(directory,'.npm-cache')},
  });
  await build();
  const baseline=await readBuild();

  // Change only the local control's UI and release identity, using the shipped build unchanged.
  const patchedVersions={...versions,bundleVersion:`${String(versions.bundleVersion)}-ui-fixture`,hostPluginVersion:`${String(versions.hostPluginVersion)}-ui-fixture`};
  const packagePath=join(bundle,'package.json'),packageSource=await readFile(packagePath,'utf8');
  const hostPath=join(bundle,'server/index.ts'),hostSource=await readFile(hostPath,'utf8');
  const versionDeclaration=`export const version = '${String(versions.hostPluginVersion)}';`;
  assert.ok(hostSource.includes(versionDeclaration),'Host version declaration must match the version manifest');
  await writeFile(join(bundle,'versions.json'),JSON.stringify(patchedVersions,null,2)+'\n');
  await writeFile(packagePath,JSON.stringify({...JSON.parse(packageSource),version:patchedVersions.bundleVersion},null,2)+'\n');
  await writeFile(hostPath,hostSource.replace(versionDeclaration,`export const version = '${patchedVersions.hostPluginVersion}';`));
  const clientPath=join(bundle,'client/index.tsx'),clientSource=await readFile(clientPath,'utf8');
  await writeFile(clientPath,clientSource+'\nObject.assign(window,{__APPS_UI_PATCH_FIXTURE__:true});\n');
  await build();
  const patched=await readBuild();

  assert.notEqual(patched.artifacts['client/client.js'],baseline.artifacts['client/client.js'],'UI source patch must change the packaged Client');
  assert.match(await readFile(join(bundle,'client/client.js'),'utf8'),/__APPS_UI_PATCH_FIXTURE__/);
  assert.notEqual(patched.artifacts['lib/index.js'],baseline.artifacts['lib/index.js'],'Host artifact must carry its new release version');
  assert.ok((await readFile(join(bundle,'lib/index.js'),'utf8')).includes(patchedVersions.hostPluginVersion));
  assert.equal(patched.artifacts['lib/runtime.js'],baseline.artifacts['lib/runtime.js'],'UI/Host release must not change Runtime bytes');
  assert.deepEqual(patched.versions,patchedVersions,'Only bundle and Host versions change');
  assert.deepEqual(JSON.parse(await readFile(join(repository,'bundles/apps/versions.json'),'utf8')),versions,'Repository release metadata must remain unchanged');
  assert.equal(await readFile(join(repository,'bundles/apps/package.json'),'utf8'),packageSource,'Repository package must remain unchanged');
  assert.equal(await readFile(join(repository,'bundles/apps/server/index.ts'),'utf8'),hostSource,'Repository Host source must remain unchanged');
  assert.equal(await readFile(join(repository,'bundles/apps/client/index.tsx'),'utf8'),clientSource,'Repository Client source must remain unchanged');
  t.diagnostic(JSON.stringify({evidenceLevel:'isolated_build',installed:false,nonIgnoredSourceFiles:paths.length,baselineArtifacts:baseline.artifacts,patchedArtifacts:patched.artifacts}));
});
