import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,join,dirname,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
const [mode,baseArg,candArg,outArg,shapeArg='500-desktop',roundArg='5']=process.argv.slice(2);
assert.ok(['build','functional','timing','trace','smoke'].includes(mode));
assert.ok(baseArg&&candArg&&outArg,'mode BASE CANDIDATE OUTPUT [500-desktop|500-mobile|48-desktop|48-mobile] [ABBA rounds]');
const baseline=resolve(baseArg),candidate=resolve(candArg),out=resolve(outArg),here=dirname(fileURLToPath(import.meta.url));
mkdirSync(out,{recursive:true});
const component='component-workspace/collected-products';
const componentBase=join(baseline,component),deps=join(componentBase,'node_modules');
const hash=x=>createHash('sha256').update(x).digest('hex');
const save=(name,x)=>writeFileSync(join(out,name),JSON.stringify(x,null,2));
const sources=['src/Component.tsx','src/lib/products.ts','src/styles.css'];
const manifestFile=join(out,'build-manifest.json');
if(mode==='build'){
 assert.ok(!existsSync(manifestFile),'Fresh build output required');
 const {build}=await import(pathToFileURL(join(deps,'vite/dist/node/index.js')).href);
 const config=(await import(pathToFileURL(join(componentBase,'vite.config.ts')).href)).default;
 const manifests=[];
 for(const [arm,root]of [['baseline',baseline],['candidate',candidate]]){
  const entry=join(out,'entry-'+arm);mkdirSync(entry,{recursive:true});
  for(const file of readdirSync(here).filter(f=>f.endsWith('.tsx')||f==='fixture-data.ts'))copyFileSync(join(here,file),join(entry,file));
  writeFileSync(join(entry,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collected products browser validation</title><div id="root"></div><script type="module" src="./fixture.tsx"></script></html>');
  const dir=join(out,arm);
  await build({...config,configFile:false,root:entry,logLevel:'warn',resolve:{alias:{PROFILE_COMPONENT:join(root,component,'src/Component.tsx'),PROFILE_CSS:join(root,component,'src/styles.css'),react:join(deps,'react'),'react-dom':join(deps,'react-dom')}},build:{outDir:dir,emptyOutDir:false,sourcemap:true,target:'es2022'}});
  const files=[...readdirSync(join(dir,'assets')).map(f=>'assets/'+f),'index.html'];
  manifests.push({arm,root,dir,production:sources.map(path=>({path,sha256:hash(readFileSync(join(root,component,path)))})),files:files.map(path=>({path,sha256:hash(readFileSync(join(dir,path)))}))});
 }
 save('build-manifest.json',{node:process.version,manifests,fixture:readdirSync(here).filter(f=>f.endsWith('.tsx')||f==='fixture-data.ts').map(path=>({path,sha256:hash(readFileSync(join(here,path)))}))});
 console.log('Browser fixture build complete');process.exit(0);
}
const manifest=JSON.parse(readFileSync(manifestFile,'utf8'));
for(const a of manifest.manifests){for(const p of a.production)assert.equal(hash(readFileSync(join(a.root,component,p.path))),p.sha256,'Production changed');for(const p of a.files)assert.equal(hash(readFileSync(join(a.dir,p.path))),p.sha256,'Bundle changed');}
for(const arm of ['baseline','candidate'])for(const f of manifest.fixture)assert.equal(hash(readFileSync(join(out,'entry-'+arm,f.path))),f.sha256,'Frozen fixture source changed');
const {chromium}=await import(pathToFileURL(join(deps,'playwright/index.mjs')).href);
const browserPath=process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';assert.ok(existsSync(browserPath),'Chrome executable missing');
const server=createServer((req,res)=>{
 let path;try{path=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400).end();return;}
 const absolute=resolve(out,'.'+path);if(!absolute.startsWith(out+'\\')&&!absolute.startsWith(out+'/')){res.writeHead(403).end();return;}
 const target=path.endsWith('/')?join(absolute,'index.html'):absolute;
 if(!existsSync(target)){res.writeHead(404).end();return;}
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.map':'application/json','.svg':'image/svg+xml'}[extname(target)]??'application/octet-stream';
 res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(readFileSync(target));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const shapes=shapeArg==='all'?['500-desktop','500-mobile','48-desktop','48-mobile']:[shapeArg];
const results=[];let browser;
try{
 for(const shape of shapes){
  const [sizeString,layout]=shape.split('-'),size=Number(sizeString);assert.ok([48,500].includes(size));assert.ok(['desktop','mobile'].includes(layout));
  const runs=mode==='timing'?Number(roundArg):1;
  for(let cycle=0;cycle<runs;cycle++)for(const [position,arm]of (mode==='timing'?['baseline','candidate','candidate','baseline']:['baseline','candidate']).entries()){
   const label=`${mode}-${shape}-${cycle}-${position}-${arm}`;assert.ok(!existsSync(join(out,label+'.json')),'Fresh result label required');
   browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run']});
   const context=await browser.newContext({viewport:{width:layout==='desktop'?1280:420,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai',colorScheme:'light'});
   const blocked=[];await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin)||url.startsWith('data:'))return route.continue();blocked.push(url);return route.abort();});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const start=Date.now();await page.goto(origin+'/'+arm+'/?size='+size,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__BENCH__,{timeout:30000});
   try{await page.evaluate(()=>Promise.race([window.__BENCH__.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Browser fixture ready timed out')),20000))]));}
   catch(error){save(label+'-setup-error.json',{error:String(error),errors,frames:await Promise.all(page.frames().map(async f=>({url:f.url(),text:await f.locator('body').innerText().catch(()=>''),html:await f.content().catch(()=>'' )})))});throw error;}
   const initial=await page.evaluate(()=>window.__BENCH__.snapshot());
   const session=await context.newCDPSession(page);await session.send('Performance.enable');
   const metrics=async()=>Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
   let value,trace;
   if(mode==='functional'){
    try{value=await page.evaluate(()=>window.__BENCH__.parity());}
    catch(error){save(label+'-functional-error.json',{error:String(error),errors,frames:await Promise.all(page.frames().map(async f=>({url:f.url(),images:await f.evaluate(()=>Array.from(document.querySelectorAll('img'),n=>({src:n.src,loading:n.loading,complete:n.complete,width:n.naturalWidth,parent:n.parentElement?.outerHTML}))).catch(()=>[]),html:await f.content().catch(()=>'' )})))});throw error;}
    await page.screenshot({path:join(out,label+'.png'),fullPage:true});
   }else{
    const warm=await page.evaluate(w=>window.__BENCH__.run(w,0),mode==='smoke'?2:30);
    const before=await metrics();
    let tracingDone;
    if(mode==='trace'){
     tracingDone=new Promise(r=>session.once('Tracing.tracingComplete',r));
     await session.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-v8.gc,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,disabled-by-default-v8.cpu_profiler',options:'record-as-much-as-possible',transferMode:'ReturnAsStream'});
    }
    value=await page.evaluate(r=>window.__BENCH__.run(0,r),mode==='smoke'?3:100);
    const after=await metrics();
    if(mode==='trace'){
     await session.send('Tracing.end');const done=await tracingDone;let chunks='',eof=false;
     while(!eof){const chunk=await session.send('IO.read',{handle:done.stream});chunks+=chunk.data;eof=chunk.eof;}
     await session.send('IO.close',{handle:done.stream});writeFileSync(join(out,label+'.trace.json'),chunks);trace={file:label+'.trace.json',sha256:hash(chunks)};
    }
    value={...value,warmup:warm,cdpMetricsBefore:before,cdpMetricsAfter:after,cdpDelta:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount','JSHeapUsedSize'].map(k=>[k,after[k]-before[k]])),trace};
   }
   const final=await page.evaluate(()=>window.__BENCH__.snapshot());
   assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(blocked.length,0,'Unexpected external I/O');
   const row={label,mode,shape,cycle,position,arm,browserVersion:browser.version(),browserPath,node:process.version,startedAt:new Date(start).toISOString(),totalRunMs:Date.now()-start,initial,final,value,errors,blocked};
   save(label+'.json',row);results.push(row);save(`${mode}-${shape}-raw.json`,results.filter(x=>x.shape===shape));
   console.log(JSON.stringify({label,completed:true,totalRunMs:row.totalRunMs}));
   await context.close();await browser.close();browser=null;
  }
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify({mode,processes:results.length,output:out}));
