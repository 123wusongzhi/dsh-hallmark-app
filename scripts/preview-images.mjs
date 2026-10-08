import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const placeholder=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#edf2f7"/><text x="40" y="43" text-anchor="middle" font-size="11" fill="#64748b">Preview</text></svg>').toString('base64');
/** Preview-only image substitutes. Missing images never delay controls or screenshots. */
export function previewImages(root,{fetchImage=fetch,budgetMs=5000,sampleLimit=6}={}){
 mkdirSync(root,{recursive:true});const jobs=new Map(),records=[];let started;
 function response(url){
  started??=performance.now();
  const path=join(root,createHash('sha256').update(url).digest('hex')+'.json');
  if(existsSync(path)){const cached=JSON.parse(readFileSync(path,'utf8'));records.push({url,status:'cache'});return cached;}
  if(!jobs.has(url)&&jobs.size<sampleLimit){
   const job=(async()=>{const start=performance.now(),remaining=budgetMs-(start-started);if(remaining<=0){records.push({url,status:'budget-exhausted'});return;}
    try{const res=await fetchImage(url,{signal:AbortSignal.timeout(Math.max(1,Math.ceil(remaining)))});if(!res.ok)throw Error('HTTP '+res.status);const contentType=res.headers.get('content-type')??'';if(!contentType.startsWith('image/'))throw Error('Not an image');const body=Buffer.from(await res.arrayBuffer()).toString('base64');writeFileSync(path,JSON.stringify({body,contentType}));records.push({url,status:'downloaded',elapsedMs:Math.round(performance.now()-start)});}
    catch(error){records.push({url,status:'unavailable',message:error.message,elapsedMs:Math.round(performance.now()-start)});}
   })();jobs.set(url,job);
  }
  records.push({url,status:'placeholder'});return {body:placeholder,contentType:'image/svg+xml'};
 }
 return {response,records,finish:()=>Promise.all(jobs.values())};
}
