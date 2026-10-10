import {readFileSync,writeFileSync} from 'node:fs';
const [baseline,candidate,output]=process.argv.slice(2);
if(!baseline||!candidate)throw Error('Usage: node summarize-tests.mjs baseline.log candidate.log [output.json]');
function summary(path){const text=readFileSync(path,'utf8');const tail=text.split('✖ failing tests:')[0];const counts=Object.fromEntries([...text.matchAll(/^ℹ (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));const failures=[...tail.matchAll(/^✖ (.*?) \([\d.]+ms\)$/gm)].map(m=>m[1]);if(!Number.isInteger(counts.tests)||!/^ℹ duration_ms /m.test(text))throw Error(`Incomplete test log: ${path}`);if(counts.fail!==failures.length)throw Error(`Unparsed failures in ${path}`);return {path,counts,failures};}
const b=summary(baseline),c=summary(candidate);const result={baseline:b,candidate:c,newFailures:c.failures.filter(n=>!b.failures.includes(n)),baselineOnlyFailures:b.failures.filter(n=>!c.failures.includes(n))};
const json=JSON.stringify(result,null,2);if(output)writeFileSync(output,json+'\n');console.log(json);
