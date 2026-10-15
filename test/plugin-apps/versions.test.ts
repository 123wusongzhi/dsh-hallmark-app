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
const artifactPaths=['lib/runtime.js','lib/index.js','client/client.js'] as const;

test('UI-only patch changes the Client artifact while Runtime, protocol and data version domains remain independent',async t=>{
  const temporaryRoot=await realpath(tmpdir()),directory=await mkdtemp(join(temporaryRoot,'apps-version-domains-'));
  t.after(async()=>{
    assert.ok(resolve(directory).startsWith(temporaryRoot+sep+'apps-version-domains-'));
    await rm(directory,{recursive:true,force:true,maxRetries:3});
  });
  // Exercise the shipped build rather than requiring ignored output from an earlier run.
  // Copy tracked source inputs at their current working-tree contents, never private/ignored state.
  const inputs=['scripts','packages','skills','docs/component-authoring','bundles/apps/server','bundles/apps/client/index.tsx','bundles/apps/package.json','bundles/apps/versions.json','bundles/apps/cordis.patch.yml','package.json','pnpm-lock.yaml','tsconfig.json'];
  const tracked=await run('git',['ls-files','-z','--',...inputs],{cwd:repository,timeout:30000,maxBuffer:4*1024*1024});
  const paths=tracked.stdout.split('\0').filter(Boolean);
  assert.ok(paths.includes('scripts/build-apps-bundle.mjs'),'Build source must be tracked in the checkout');
  for(const path of paths){
    const target=resolve(directory,path);
    assert.ok(target.startsWith(directory+sep),`Build input must stay within its fixture: ${path}`);
    await mkdir(dirname(target),{recursive:true});
    await cp(join(repository,path),target);
  }
  await symlink(await realpath(join(repository,'node_modules')),join(directory,'node_modules'),'junction');
  const bundle=join(directory,'bundles/apps');
  const readVersions=async()=>JSON.parse(await readFile(join(bundle,'versions.json'),'utf8')) as Record<string,unknown>;
  const readArtifacts=async()=>Object.fromEntries(await Promise.all(artifactPaths.map(async path=>[path,hash(await readFile(join(bundle,path)))])));
  const build=async()=>run(process.execPath,['scripts/build-apps-bundle.mjs'],{
    cwd:directory,timeout:120000,maxBuffer:4*1024*1024,
    env:{...process.env,npm_config_offline:'true',npm_config_update_notifier:'false',npm_config_audit:'false',npm_config_fund:'false',npm_config_cache:join(directory,'.npm-cache')},
  });
  const versions=await readVersions();
  await build();
  const baseline=await readArtifacts();

  // This is an explicit local control change, not a released or installed candidate.
  const patchedVersions={...versions,bundleVersion:`${String(versions.bundleVersion)}-ui-fixture`,hostPluginVersion:`${String(versions.hostPluginVersion)}-ui-fixture`};
  const manifest=JSON.parse(await readFile(join(bundle,'package.json'),'utf8'));
  const hostPath=join(bundle,'server/index.ts'),hostSource=await readFile(hostPath,'utf8');
  const versionDeclaration=`export const version = '${String(versions.hostPluginVersion)}';`;
  assert.ok(hostSource.includes(versionDeclaration),'Host version declaration must match the version manifest');
  await writeFile(join(bundle,'versions.json'),JSON.stringify(patchedVersions,null,2)+'\n');
  await writeFile(join(bundle,'package.json'),JSON.stringify({...manifest,version:patchedVersions.bundleVersion},null,2)+'\n');
  await writeFile(hostPath,hostSource.replace(versionDeclaration,`export const version = '${patchedVersions.hostPluginVersion}';`));
  const clientPath=join(bundle,'client/index.tsx'),clientSource=await readFile(clientPath,'utf8');
  await writeFile(clientPath,clientSource+'\nObject.assign(window,{__APPS_UI_PATCH_FIXTURE__:true});\n');
  await build();
  const patched=await readArtifacts(),actualVersions=await readVersions();

  assert.notEqual(patched['client/client.js'],baseline['client/client.js'],'UI source patch must change the actual packaged Client');
  assert.match(await readFile(join(bundle,'client/client.js'),'utf8'),/__APPS_UI_PATCH_FIXTURE__/);
  assert.notEqual(patched['lib/index.js'],baseline['lib/index.js'],'Host artifact must carry its new release version');
  assert.equal(patched['lib/runtime.js'],baseline['lib/runtime.js'],'UI/Host release must not change Runtime bytes');
  assert.equal(actualVersions.bundleVersion,patchedVersions.bundleVersion);
  assert.equal(actualVersions.hostPluginVersion,patchedVersions.hostPluginVersion);
  for(const key of ['runtimeVersion','transportMajor','catalogSchemaVersion','databaseSchemaVersion','providers','nativeProjections','legacyContractVersion']){
    assert.deepEqual(actualVersions[key],versions[key],`${key} remains independent of a UI/Host release`);
  }
  const buildManifest=JSON.parse(await readFile(join(directory,'evidence',String(versions.releaseId),'candidates',patchedVersions.bundleVersion,'build-manifest.json'),'utf8'));
  assert.deepEqual(buildManifest.versions,actualVersions,'Packaged build evidence must use the actual version domains');
  for(const path of artifactPaths)assert.equal(buildManifest.artifacts[path],patched[path],path);
  assert.deepEqual(JSON.parse(await readFile(join(repository,'bundles/apps/versions.json'),'utf8')),versions,'Repository release metadata must remain unchanged');
  assert.equal(await readFile(join(repository,'bundles/apps/server/index.ts'),'utf8'),hostSource,'Repository Host source must remain unchanged');
  assert.equal(await readFile(join(repository,'bundles/apps/client/index.tsx'),'utf8'),clientSource,'Repository Client source must remain unchanged');
  t.diagnostic(JSON.stringify({evidenceLevel:'isolated_offline_build',installed:false,trackedSourceFiles:paths.length,baselineArtifacts:baseline,patchedArtifacts:patched}));
});
