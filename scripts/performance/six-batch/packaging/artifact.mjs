import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,cpSync,realpathSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname,sep} from 'node:path';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function cleanEnvironment(home,extra={}){return {PATH:process.env.PATH,HOME:home,TMPDIR:home,TZ:'UTC',LANG:'C.UTF-8',...extra};}
export function extractArtifact(root,directory,{provisionDiagnosticZod=false}={}){
 root=resolve(root);const versions=JSON.parse(readFileSync(join(root,'bundles/apps/versions.json'),'utf8'));
 const evidence=join(root,'evidence',versions.releaseId,'candidates',versions.bundleVersion);
 const build=JSON.parse(readFileSync(join(evidence,'build-manifest.json'),'utf8')),packed=JSON.parse(readFileSync(join(evidence,'package-manifest.json'),'utf8'));
 const archive=resolve(root,packed.archive),bytes=readFileSync(archive);assert.equal(sha256(bytes),packed.sha256,'archive digest');
 const entries=execFileSync('tar',['-tf',archive],{encoding:'utf8'}).trim().split(/\r?\n/);
 assert.ok(entries.length>0&&entries.every(p=>p.startsWith('package/')&&!p.split('/').includes('..')&&!p.includes('\\')),'safe archive names');
 const verbose=execFileSync('tar',['-tvf',archive],{encoding:'utf8'}).trim().split(/\r?\n/);assert.ok(verbose.every(row=>/^[-d]/.test(row)),'archive has only regular files/directories');
 mkdirSync(directory,{recursive:true});execFileSync('tar',['-xf',archive,'-C',directory]);
 const packageRoot=join(directory,'package'),entry=join(packageRoot,'lib/runtime.js');
 assert.equal(sha256(readFileSync(entry)),build.artifacts['lib/runtime.js'],'packed runtime digest');
 assert.ok(!existsSync(join(packageRoot,'node_modules')),'archive contains no dependencies directory');
 for(let parent=resolve(directory);;parent=dirname(parent)){assert.ok(!existsSync(join(parent,'node_modules')),`ancestor dependency injection: ${parent}`);if(dirname(parent)===parent)break;}
 const manifest={archive,archiveSha256:packed.sha256,archiveBytes:bytes.length,runtimeSha256:build.artifacts['lib/runtime.js'],runtimeBytes:readFileSync(entry).length,bundleVersion:versions.bundleVersion,diagnosticOnly:provisionDiagnosticZod,dependencyProvisioning:null};
 if(provisionDiagnosticZod){
  const require=createRequire(join(root,'package.json')),source=dirname(realpathSync(require.resolve('zod/package.json'))),destination=join(packageRoot,'node_modules/zod');
  const pkg=JSON.parse(readFileSync(join(source,'package.json'),'utf8'));assert.equal(pkg.version,'4.3.6','frozen diagnostic zod');
  mkdirSync(dirname(destination),{recursive:true});cpSync(source,destination,{recursive:true,dereference:true});
  const hashes={};for(const relative of readdirSync(destination,{recursive:true}).sort()){const file=join(destination,relative);if(lstatSync(file).isFile())hashes[relative.split(sep).join('/')]=sha256(readFileSync(file));}
  manifest.dependencyProvisioning={name:pkg.name,version:pkg.version,source,method:'copied frozen package only; no symlink or checkout node_modules injection',fileCount:Object.keys(hashes).length,treeSha256:sha256(JSON.stringify(hashes)),files:hashes};
 }
 return {entry,packageRoot,manifest,build,versions};
}
