import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

test('UI-only patch changes the Client artifact while Runtime, protocol and data version domains remain independent',async()=>{
  const hash=(content:string|Uint8Array)=>createHash('sha256').update(content).digest('hex');
  const versions=JSON.parse(await readFile('bundles/apps/versions.json','utf8')) as Record<string,unknown>;
  const originalArtifacts=Object.fromEntries(await Promise.all(['lib/runtime.js','lib/index.js','client/client.js'].map(async path=>[path,hash(await readFile(`bundles/apps/${path}`))])));
  const options={entryPoints:['bundles/apps/client/index.tsx'],bundle:true,write:false,platform:'browser' as const,format:'cjs' as const,target:'es2022',jsx:'automatic' as const,external:['react','react/jsx-runtime','react-dom','react-dom/client','@deepseek-ai/*'],define:{'process.env.NODE_ENV':'"production"'}};
  const baseline=await build(options),uiPatch=await build({...options,banner:{js:'window.__APPS_UI_PATCH_FIXTURE__ = true;'}});
  assert.ok(baseline.outputFiles);assert.ok(uiPatch.outputFiles);
  const originalClientHash=hash(baseline.outputFiles[0].contents),patchedClientHash=hash(uiPatch.outputFiles[0].contents);
  assert.notEqual(patchedClientHash,originalClientHash);
  // This fixture adds an isolated UI marker; it neither rebuilds nor rewrites the Runtime or saved data.
  const patchedVersions:Record<string,unknown>={...versions,bundleVersion:`${String(versions.bundleVersion)}-ui-fixture`,hostPluginVersion:`${String(versions.hostPluginVersion)}-ui-fixture`};
  for(const key of ['runtimeVersion','transportMajor','catalogSchemaVersion','databaseSchemaVersion','providers','nativeProjections','legacyContractVersion'])assert.deepEqual(patchedVersions[key],versions[key]);
  for(const [path,expected] of Object.entries(originalArtifacts))assert.equal(hash(await readFile(`bundles/apps/${path}`)),expected);
  const directory='evidence/apps-v1-20261007/P5/TODO-026';await mkdir(directory,{recursive:true});
  await writeFile(`${directory}/ui-version-domain-fixture.json`,JSON.stringify({status:'PASS',evidenceLevel:'isolated_build_fixture',test:'test/plugin-apps/versions.test.ts',candidateVersion:versions.bundleVersion,originalVersions:versions,uiOnlyPatchedVersions:patchedVersions,baselineClientSha256:originalClientHash,patchedClientSha256:patchedClientHash,unchangedActualArtifacts:originalArtifacts,capabilityVersion:'1.0.0',bridgeMajor:2,ordinarySdkVersion:'1.0.0',installedUiPatch:false,productionFilesChanged:false,limitation:'UI-only version comparison is an isolated esbuild fixture; the actual official manager installation evidence covers candidate.1, not this synthetic patch version.'},null,2)+'\n');
});
