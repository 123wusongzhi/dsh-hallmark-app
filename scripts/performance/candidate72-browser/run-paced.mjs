// Read-only browser acceptance against an existing run-browser.mjs build.
// Usage: node run-paced.mjs BUILD_DIR NEW_OUTPUT_DIR [500-desktop|500-mobile] [ABBA rounds=1] [warmup cycles=30] [measured cycles=100]
// This does not call fixture.run/reset, dispatch synthetic clicks, or use flushSync.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {performance} from 'node:perf_hooks';

const [buildArg,outArg,shape='500-desktop',abbaArg='1',warmArg='30',measureArg='100']=process.argv.slice(2);
assert.ok(buildArg&&outArg,'Usage: node run-paced.mjs BUILD_DIR NEW_OUTPUT_DIR [500-desktop|500-mobile] [ABBA rounds=1] [warmup cycles=30] [measured cycles=100]');
assert.ok(['500-desktop','500-mobile'].includes(shape),'Shape must be 500-desktop or 500-mobile');
const abbaRounds=Number(abbaArg),warmupCycles=Number(warmArg),measuredCycles=Number(measureArg);
for(const [name,value]of Object.entries({abbaRounds,warmupCycles,measuredCycles}))assert.ok(Number.isInteger(value)&&value>0,`${name} must be a positive integer`);
const buildDir=resolve(buildArg),out=resolve(outArg),manifestPath=join(buildDir,'build-manifest.json');
assert.ok(!existsSync(out),'Output directory must be new; existing output is never overwritten');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const manifestText=readFileSync(manifestPath,'utf8'),manifest=JSON.parse(manifestText);
const component='component-workspace/collected-products';
const arms=new Map(manifest.manifests.map(arm=>[arm.arm,arm]));
assert.deepEqual([...arms.keys()].sort(),['baseline','candidate'],'Build must contain exactly both arms');
const within=(root,path)=>{const rel=relative(root,path);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));};
function verifyBuild(){
  assert.equal(sha256(readFileSync(manifestPath)),sha256(manifestText),'Build manifest changed');
  for(const [arm,entry]of arms){
    assert.equal(resolve(entry.dir),join(buildDir,arm),'Bundle directory must match supplied build');
    for(const item of entry.production)assert.equal(sha256(readFileSync(join(entry.root,component,item.path))),item.sha256,`${arm} production changed: ${item.path}`);
    for(const item of entry.files)assert.equal(sha256(readFileSync(join(entry.dir,item.path))),item.sha256,`${arm} bundle changed: ${item.path}`);
    for(const item of manifest.fixture)assert.equal(sha256(readFileSync(join(buildDir,'entry-'+arm,item.path))),item.sha256,`${arm} frozen fixture changed: ${item.path}`);
  }
}
verifyBuild();
const deps=join(arms.get('baseline').root,component,'node_modules');
const {chromium}=await import(pathToFileURL(join(deps,'playwright/index.mjs')).href);
const browserPath=process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(existsSync(browserPath),'Chrome executable missing; set CHROME_PATH if necessary');
mkdirSync(out,{recursive:true});
const save=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2),{flag:'wx'});
const meaning={
  interaction:'Each operation is a real Playwright locator.click with trusted browser input. Capture listeners start timing at click delivery, then wait for two requestAnimationFrame callbacks in the component iframe. Each following click starts only after the previous sample and state check return.',
  timing:'eventToSecondRafMs and captureToSecondRafMs end at the second rAF callback, before state inspection. This is a paint opportunity, not proof of physical paint and not INP. Event timestamps do not include all pointerdown-to-click input latency.',
  transport:'nodeOperationMs and phase wall times include Playwright actionability/scroll/transport waits and state checks. CDP TaskDuration is renderer main-thread task duration, not elapsed transport waiting or a direct OS CPU-utilization measurement; it includes the audit work executed on that renderer during its measurement boundary.',
  workload:'One mounted component per fresh Chrome, 30 warmup cycles then 100 measured cycles by default, alternating select page and clear selection without reset. Auto-scroll and normal CSS transitions are left enabled. Counts can be overridden and are recorded.',
  snapshots:'Complete component DOM HTML and live control properties are retained at initial, warmup end and measurement end. Every stage is compared across processes without stripping component fields. Full document asset tags are excluded because bundles intentionally differ.',
  acceptance:'All samples, failures, page errors and blocked requests are retained. No timing threshold is an acceptance criterion. This supplemental two-action workload does not replace the broader functional oracle or the 11-action benchmark.'
};
save('run-manifest.json',{mode:'paced',shape,abbaRounds,warmupCycles,measuredCycles,buildDir,browserPath,node:process.version,script:{path:fileURLToPath(import.meta.url),sha256:sha256(readFileSync(fileURLToPath(import.meta.url)))},buildManifestSha256:sha256(manifestText),buildManifest:manifest,meaning});

const server=createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400).end();return;}
  const absolute=resolve(buildDir,'.'+pathname);
  if(!within(buildDir,absolute)){res.writeHead(403).end();return;}
  const target=pathname.endsWith('/')?join(absolute,'index.html'):absolute;
  if(!existsSync(target)||!statSync(target).isFile()){res.writeHead(404).end();return;}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.map':'application/json','.svg':'image/svg+xml'}[extname(target)]??'application/octet-stream';
  res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(readFileSync(target));
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
const metricNames=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount','JSHeapUsedSize'];
const metricDelta=(before,after)=>Object.fromEntries(metricNames.map(key=>[key,Number.isFinite(before?.[key])&&Number.isFinite(after?.[key])?after[key]-before[key]:null]));

// Installed only after the frozen fixture is ready; component behavior is untouched.
function installAudit({expectedRows,layout}){
  const root=document.getElementById('root');
  const pageSelector=layout==='desktop'?'.desktop-table input[aria-label="选择本页商品"]':'.mobile-select-all input[aria-label="选择本页商品"]';
  const selectors={select:pageSelector,clear:'.clear-selection'};
  const samples=[],longTasks=[],unexpectedClicks=[],phases=[];
  let pending,observer;
  const drain=entries=>{for(const entry of entries)longTasks.push({name:entry.name,startTime:entry.startTime,duration:entry.duration,entryType:entry.entryType,attribution:Array.from(entry.attribution??[],a=>({name:a.name,entryType:a.entryType,containerType:a.containerType,containerSrc:a.containerSrc,containerId:a.containerId,containerName:a.containerName}))});};
  if(PerformanceObserver.supportedEntryTypes?.includes('longtask')){observer=new PerformanceObserver(list=>drain(list.getEntries()));observer.observe({type:'longtask',buffered:false});}
  const branches=()=>Object.fromEntries([['desktop','.desktop-table tbody tr'],['mobile','.mobile-list article']].map(([name,selector])=>[name,Array.from(root.querySelectorAll(selector),row=>{const input=row.querySelector('input[type="checkbox"]');return{label:input?.getAttribute('aria-label'),checked:input?.checked,disabled:input?.disabled,selected:row.getAttribute('data-selected')};})]));
  function inspect(expectedSelected){
    const branchState=branches(),pageControls=Array.from(root.querySelectorAll('input[aria-label="选择本页商品"]'),input=>({checked:input.checked,indeterminate:input.indeterminate,disabled:input.disabled}));
    const footer=root.querySelector('.selection-bar'),attach=root.querySelector('.attach-button'),clear=root.querySelector('.clear-selection');
    const state={branches:branchState,pageControls,footerText:footer?.querySelector('strong')?.textContent??null,footerActive:footer?.getAttribute('data-active')??null,attachDisabled:attach?.disabled??null,attachText:attach?.textContent??null,buttonCount:attach?.querySelector('.button-count')?.textContent??null,clearPresent:!!clear,clearDisabled:clear?.disabled??null,scroll:{x:scrollX,y:scrollY}};
    const failures=[];
    for(const [branch,rows]of Object.entries(branchState)){
      if(rows.length!==expectedRows)failures.push(`${branch}: expected ${expectedRows} rows, got ${rows.length}`);
      if(rows.filter(row=>row.checked).length!==expectedSelected)failures.push(`${branch}: wrong checked row count`);
      if(rows.some(row=>row.disabled||row.selected!==String(row.checked)))failures.push(`${branch}: row selection attributes/disabled disagree`);
    }
    if(pageControls.length!==2||pageControls.some(input=>input.checked!==(expectedSelected===expectedRows)||input.indeterminate||input.disabled))failures.push('Page checkbox states disagree');
    if(state.footerText!==(expectedSelected?`已选 ${expectedSelected} 件商品`:'选择你想处理的商品'))failures.push('Footer selected count disagrees');
    if(state.footerActive!==String(expectedSelected>0))failures.push('Footer active state disagrees');
    if(state.attachDisabled!==(expectedSelected===0))failures.push('Attach button disabled state disagrees');
    if(state.buttonCount!==(expectedSelected?String(expectedSelected):null))failures.push('Attach button count disagrees');
    if(state.clearPresent!==(expectedSelected>0)||(expectedSelected>0&&state.clearDisabled))failures.push('Clear button state disagrees');
    return{expectedSelected,state,failures};
  }
  function snapshot(){
    const html=root.outerHTML,controls=Array.from(root.querySelectorAll('input,select,button'),node=>({tag:node.tagName,ariaLabel:node.getAttribute('aria-label'),text:node.tagName==='BUTTON'?node.textContent:undefined,disabled:node.disabled,...(node instanceof HTMLInputElement?{type:node.type,value:node.value,checked:node.checked,indeterminate:node.indeterminate}:node instanceof HTMLSelectElement?{value:node.value,options:Array.from(node.options,item=>({value:item.value,text:item.text,selected:item.selected}))}:{})}));
    const bounds=root.getBoundingClientRect();
    let fixtureSnapshot,fixtureSnapshotError;try{fixtureSnapshot=window.__BENCH__.snapshot();}catch(error){fixtureSnapshotError=String(error);}
    return{html,controls,emptySelectionCheck:inspect(0),layout:{width:bounds.width,height:bounds.height,documentHeight:document.documentElement.offsetHeight},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollX,scrollY},theme:document.documentElement.dataset.theme,fixtureSnapshot,fixtureSnapshotError};
  }
  function finish(record){
    if(!pending||pending.record!==record)return;
    clearTimeout(pending.timer);const complete=pending;
    record.check=inspect(record.action==='select'?expectedRows:0);
    record.checkFinishedAt=performance.now();samples.push(record);pending=undefined;complete.resolve(record);
  }
  document.addEventListener('click',event=>{
    const captureAt=performance.now(),target=event.target instanceof Element?event.target:undefined;
    const info={timeStamp:event.timeStamp,captureAt,isTrusted:event.isTrusted,target:target?{tag:target.tagName,ariaLabel:target.getAttribute('aria-label'),className:target.getAttribute('class')}:null};
    if(!pending||!target?.closest(selectors[pending.record.action])){unexpectedClicks.push(info);return;}
    const record=pending.record;
    if(record.event){unexpectedClicks.push(info);return;}
    record.event=info;
    requestAnimationFrame(first=>{const firstAt=performance.now();requestAnimationFrame(second=>{
      if(!pending||pending.record!==record)return;
      const secondAt=performance.now();record.raf={first,firstAt,second,secondAt};
      record.captureToSecondRafMs=secondAt-captureAt;
      record.eventTimestampComparable=Number.isFinite(event.timeStamp)&&event.timeStamp>=0&&event.timeStamp<=captureAt+1000;
      record.eventToSecondRafMs=record.eventTimestampComparable?secondAt-event.timeStamp:null;
      record.armedToCaptureMs=captureAt-record.armedAt;finish(record);
    });});
  },true);
  window.__PACED_AUDIT__={
    selectors,inspect,snapshot,
    begin({phase,round,action}){
      if(pending)throw Error('Overlapping paced interaction');
      const record={phase,round,action,armedAt:performance.now()};let resolve;const promise=new Promise(r=>resolve=r);
      const timer=setTimeout(()=>{record.error='No matching click and two-rAF completion within 15 seconds';finish(record);},15000);
      pending={record,promise,resolve,timer};this.lastPromise=promise;
    },
    finish(){return this.lastPromise;},
    cancel(error){if(pending){pending.record.error=error;finish(pending.record);}},
    beginPhase(name){const phase={name,startTime:performance.now()};phases.push(phase);return phase;},
    endPhase(name){const phase=phases.findLast(item=>item.name===name);phase.endTime=performance.now();phase.wallMs=phase.endTime-phase.startTime;if(observer)drain(observer.takeRecords());return phase;},
    report(){
      if(observer)drain(observer.takeRecords());
      let networkAttempts,fixtureSnapshotError;try{networkAttempts=window.__BENCH__.snapshot().networkAttempts;}catch(error){fixtureSnapshotError=String(error);}
      return{timeOrigin:performance.timeOrigin,longTaskSupported:!!observer,longTasks,samples,unexpectedClicks,phases,networkAttempts,fixtureSnapshotError};
    }
  };
  return{selectors,initialCheck:inspect(0),timeOrigin:performance.timeOrigin,longTaskSupported:!!observer};
}

function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const encoded=value=>JSON.stringify(canonical(value));
const percentile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];};
const stats=values=>({count:values.length,median:percentile(values,.5),p95:percentile(values,.95),max:values.length?Math.max(...values):null,over50ms:values.filter(x=>x>50).length,over100ms:values.filter(x=>x>100).length});
const rows=[];let browser,fatalError;
try{
  for(let cycle=0;cycle<abbaRounds;cycle++)for(const [position,arm]of ['baseline','candidate','candidate','baseline'].entries()){
    verifyBuild();
    const label=`paced-${shape}-${cycle}-${position}-${arm}`;
    const row={label,mode:'paced',shape,cycle,position,arm,warmupCycles,measuredCycles,browserPath,node:process.version,startedAt:new Date().toISOString(),samples:[],errors:[],blocked:[],consoleErrors:[],failures:[]};
    let context,page,frame,session;const startedAt=performance.now();
    try{
      browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--disable-background-networking','--disable-component-update','--disable-extensions','--no-first-run']});
      row.browserVersion=browser.version();
      context=await browser.newContext({viewport:{width:shape.endsWith('desktop')?1280:420,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai',colorScheme:'light'});
      await context.route('**/*',route=>{const request=route.request(),url=request.url();let allowed=false;try{allowed=new URL(url).origin===origin||url.startsWith('data:');}catch{}if(allowed)return route.continue();row.blocked.push({url,method:request.method(),resourceType:request.resourceType(),at:new Date().toISOString()});return route.abort();});
      page=await context.newPage();page.on('pageerror',error=>row.errors.push({message:String(error),at:new Date().toISOString()}));page.on('console',message=>{if(message.type()==='error')row.consoleErrors.push({text:message.text(),location:message.location()});});
      await page.goto(`${origin}/${arm}/?size=500`,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>!!window.__BENCH__,undefined,{timeout:30000});
      await page.evaluate(()=>Promise.race([window.__BENCH__.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Fixture ready timed out')),20000))]));
      const iframeElement=await page.locator('#bench-frame').elementHandle();frame=await iframeElement.contentFrame();assert.ok(frame,'Fixture iframe missing');
      row.setup=await frame.evaluate(installAudit,{expectedRows:20,layout:shape.endsWith('desktop')?'desktop':'mobile'});
      row.initial=await frame.evaluate(()=>window.__PACED_AUDIT__.snapshot());
      session=await context.newCDPSession(page);await session.send('Performance.enable');
      const metrics=async()=>Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(item=>[item.name,item.value]));
      async function phase(name,count){
        const before=await metrics(),nodeStart=performance.now();await frame.evaluate(name=>window.__PACED_AUDIT__.beginPhase(name),name);
        for(let round=0;round<count;round++)for(const action of ['select','clear']){
          await frame.evaluate(info=>window.__PACED_AUDIT__.begin(info),{phase:name,round,action});
          const operationStart=performance.now();let clickError;
          try{await frame.locator(row.setup.selectors[action]).click({timeout:10000});}
          catch(error){clickError=String(error);await frame.evaluate(error=>window.__PACED_AUDIT__.cancel(error),clickError).catch(()=>{});}
          const clickResolvedAt=performance.now();const sample=await frame.evaluate(()=>window.__PACED_AUDIT__.finish());
          sample.nodeOperationMs=performance.now()-operationStart;sample.nodeClickCallMs=clickResolvedAt-operationStart;if(clickError)sample.clickError=clickError;
          row.samples.push(sample);
          if(clickError)throw Error(`Click failed after preserving partial samples: ${clickError}`);
        }
        const inPage=await frame.evaluate(name=>window.__PACED_AUDIT__.endPhase(name),name),after=await metrics();
        return{cycles:count,actions:count*2,nodeWallMs:performance.now()-nodeStart,inPage,cdpMetricsBefore:before,cdpMetricsAfter:after,cdpDelta:metricDelta(before,after)};
      }
      row.warmup=await phase('warmup',warmupCycles);
      row.warm=await frame.evaluate(()=>window.__PACED_AUDIT__.snapshot());
      row.measurement=await phase('measure',measuredCycles);
      row.final=await frame.evaluate(()=>window.__PACED_AUDIT__.snapshot());
    }catch(error){row.executionError=String(error);row.failures.push('Execution did not complete');}
    finally{
      if(frame){
        try{row.audit=await frame.evaluate(()=>window.__PACED_AUDIT__?.report());}catch(error){row.auditReadError=String(error);}
        if(!row.final)try{row.final=await frame.evaluate(()=>window.__PACED_AUDIT__?.snapshot());}catch(error){row.finalReadError=String(error);}
      }
      if(page&&row.executionError)try{row.failureDocuments=await Promise.all(page.frames().map(async item=>({url:item.url(),html:await item.content().catch(error=>String(error))})));}catch{}
      row.totalRunMs=performance.now()-startedAt;
      for(const stage of ['initial','warm','final']){
        if(!row[stage])row.failures.push(`${stage} snapshot missing`);
        else{if(row[stage].fixtureSnapshotError)row.failures.push(`${stage} fixture snapshot assertion failed`);if(row[stage].emptySelectionCheck.failures.length)row.failures.push(`${stage} empty-selection check failed`);}
      }
      if(row.samples.filter(item=>item.phase==='warmup').length!==warmupCycles*2||row.samples.filter(item=>item.phase==='measure').length!==measuredCycles*2)row.failures.push('Incomplete sample counts');
      if(row.samples.some(item=>item.error||item.clickError||item.event?.isTrusted!==true||!item.raf||item.check?.failures.length))row.failures.push('Interaction trust/completion/state check failed');
      if(row.samples.some(item=>!Number.isFinite(item.eventToSecondRafMs)||item.eventToSecondRafMs<0||!Number.isFinite(item.captureToSecondRafMs)||item.captureToSecondRafMs<0))row.failures.push('Invalid interaction timing sample');
      if(row.errors.length||row.blocked.length||row.audit?.networkAttempts?.length)row.failures.push('Page error or unexpected external I/O');
      if(row.audit?.unexpectedClicks.length)row.failures.push('Unexpected click captured');
      if(row.auditReadError||!row.audit)row.failures.push('Audit report missing');
      if(row.audit?.fixtureSnapshotError)row.failures.push('Final fixture oracle failed while collecting audit');
      row.summary=Object.fromEntries(['select','clear'].map(action=>{const samples=row.samples.filter(item=>item.phase==='measure'&&item.action===action);return[action,{samples:samples.length,eventToSecondRafMs:stats(samples.map(item=>item.eventToSecondRafMs).filter(Number.isFinite)),captureToSecondRafMs:stats(samples.map(item=>item.captureToSecondRafMs).filter(Number.isFinite)),nodeOperationMs:stats(samples.map(item=>item.nodeOperationMs).filter(Number.isFinite)),invalidTimingSamples:samples.filter(item=>!Number.isFinite(item.eventToSecondRafMs)||!Number.isFinite(item.captureToSecondRafMs)).length}];}));
      row.status=row.failures.length?'needs-review':'complete';save(label+'.json',row);rows.push(row);
      console.log(JSON.stringify({label,status:row.status,failures:row.failures,measurementTaskMs:row.measurement?.cdpDelta.TaskDuration==null?null:row.measurement.cdpDelta.TaskDuration*1000,totalRunMs:row.totalRunMs}));
      if(context)await context.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});browser=undefined;
    }
  }
  verifyBuild();
}catch(error){fatalError=String(error);}
finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));}

const snapshots=['initial','warm','final'].map(stage=>{
  const reference=rows.find(row=>row.arm==='baseline'&&row[stage]);
  const comparisons=rows.map(row=>{const actual=row[stage];return{label:row.label,arm:row.arm,present:!!actual,equal:!!reference&&!!actual&&encoded(actual)===encoded(reference[stage]),sha256:actual?sha256(encoded(actual)):null};});
  return{stage,reference:reference?.label,status:reference&&comparisons.length===abbaRounds*4&&comparisons.every(item=>item.present&&item.equal)?'equal':'needs-review',comparisons};
});
const armSummaries=Object.fromEntries(['baseline','candidate'].map(arm=>{const selected=rows.filter(row=>row.arm===arm);return[arm,{processes:selected.map(row=>({label:row.label,status:row.status,summary:row.summary,measurementTaskMs:row.measurement?.cdpDelta.TaskDuration==null?null:row.measurement.cdpDelta.TaskDuration*1000})),actions:Object.fromEntries(['select','clear'].map(action=>{const samples=selected.flatMap(row=>row.samples.filter(item=>item.phase==='measure'&&item.action===action));return[action,{pooledEventToSecondRafMs:stats(samples.map(item=>item.eventToSecondRafMs).filter(Number.isFinite)),pooledCaptureToSecondRafMs:stats(samples.map(item=>item.captureToSecondRafMs).filter(Number.isFinite)),processMedianEventToSecondRafMs:stats(selected.map(row=>row.summary[action].eventToSecondRafMs.median).filter(Number.isFinite))}];}))}];}));
const summary={mode:'paced',shape,expectedProcesses:abbaRounds*4,completedProcesses:rows.length,status:!fatalError&&rows.length===abbaRounds*4&&rows.every(row=>row.status==='complete')&&snapshots.every(item=>item.status==='equal')?'complete':'needs-review',fatalError,snapshots,arms:armSummaries,meaning};
save(`paced-${shape}-raw.json`,rows);save('summary.json',summary);
console.log(JSON.stringify({status:summary.status,processes:rows.length,output:out,snapshotStatuses:snapshots.map(item=>({stage:item.stage,status:item.status}))}));
if(summary.status!=='complete')process.exitCode=2;
