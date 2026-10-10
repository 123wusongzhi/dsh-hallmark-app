import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest=JSON.parse(readFileSync('source-identity.json','utf8'));
for(const [arm,entry] of Object.entries(manifest)){
 for(const [file,expected] of Object.entries({...entry.inputHashes,...entry.outputHashes}))if(hash(file)!==expected)throw Error(`Rebuild ${arm}: input or bundle changed: ${file}`);
}
console.log('Verified both complete checkout input graphs and newly built bundle hashes.');
