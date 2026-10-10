import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [rootArg,manifestArg]=process.argv.slice(2);
if(!rootArg||!manifestArg)throw Error('Usage: node verify-build.mjs repository-root build-manifest.json');
const root=resolve(rootArg),manifest=JSON.parse(readFileSync(manifestArg,'utf8'));
for(const [path,expected] of Object.entries(manifest.sourceInputs)){
 const actual=createHash('sha256').update(readFileSync(join(root,path))).digest('hex');
 if(actual!==expected)throw Error(`Source changed since build: ${path}`);
}
console.log(JSON.stringify({bundleVersion:manifest.bundleVersion,sourceInputsVerified:Object.keys(manifest.sourceInputs).length}));
