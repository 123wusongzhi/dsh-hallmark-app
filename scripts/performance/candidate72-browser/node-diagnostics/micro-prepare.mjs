import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {here,ownedPath} from './diagnostic-paths.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
export function prepareMicro(sourceDirectory,outputDirectory){
  const source=resolve(sourceDirectory),output=ownedPath(outputDirectory);assert.ok(!existsSync(output),'Prepare requires a fresh directory');mkdirSync(output,{recursive:true});
  const suffix=readFileSync(join(here,'micro-instrumentation.txt'),'utf8'),entries=[];
  const before='  return { name, wallMs, cpuUs: cost.user + cost.system, work: false ? delta(before) : void 0 };';
  const after='  return { name, wallMs, cpuUs: cost.user + cost.system, work: false ? delta(before) : void 0, startPerfMs: start, endPerfMs: start + wallMs };';
  for(const variant of ['baseline','candidate']){
    const originalPath=join(source,'collected-'+variant+'.mjs'),original=readFileSync(originalPath,'utf8');
    assert.equal(original.split(before).length,2,'Exactly one original event return object must match');
    const edited=original.replace(before,after)+'\n'+suffix+'\n';
    const controlPath=join(output,'collected-'+variant+'-control.mjs'),diagnosticPath=join(output,'collected-'+variant+'-micro.mjs');
    writeFileSync(controlPath,original);writeFileSync(diagnosticPath,edited);
    entries.push({variant,originalPath,originalSha256:digest(original),controlPath,diagnosticPath,diagnosticSha256:digest(edited)});
  }
  const manifest={schemaVersion:1,sourceDirectory:source,instrumentationSha256:digest(suffix),entries,patchScope:'One action return-object literal gains two references to already computed values. Only other code is appended after original EOF. No preallocated arrays, per-action logging or extra clock calls.'};
  writeFileSync(join(output,'prepared-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,4,'Usage: node micro-prepare.mjs <original-bundle-directory> <owned-output-directory>');
  console.log(JSON.stringify(prepareMicro(process.argv[2],process.argv[3]),null,2));
}
