import {readFileSync,writeFileSync} from 'node:fs';
// node apps-read-result.js request.json; credentials stay in this process.
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
const url=new URL(`/v1/results/${encodeURIComponent(input.resultRef)}`,input.runtime.url);
url.searchParams.set('cursor',input.cursor??'0');
url.searchParams.set('limit',String(input.limit??100));
const response=await fetch(url,{headers:{authorization:'Bearer '+readFileSync(input.runtime.keyFile,'utf8').trim()},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error(`Result read failed: HTTP ${response.status}`);
const page=await response.json();
writeFileSync(input.outputPath,JSON.stringify(page,null,2)+'\n');
console.log(JSON.stringify({outputPath:input.outputPath,total:page.total,returned:page.returned,nextCursor:page.nextCursor,completeness:page.completeness}));
