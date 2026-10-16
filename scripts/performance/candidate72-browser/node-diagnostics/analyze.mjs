import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {ownedPath,localRunPaths} from './diagnostic-paths.mjs';

assert.ok(process.argv[2],'Usage: node analyze.mjs <result-directory> [tail-threshold-ms=16.6667]');
const directory=ownedPath(resolve(process.argv[2])),thresholdMs=Number(process.argv[3]??1000/60);
assert.ok(Number.isFinite(thresholdMs)&&thresholdMs>0,'Threshold must be positive');
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
const stats=values=>{const s=[...values].sort((a,b)=>a-b);return{count:s.length,medianMs:median(s),meanMs:s.length?s.reduce((a,b)=>a+b,0)/s.length:null,p95Ms:s.length?s[Math.ceil(s.length*.95)-1]:null,maxMs:s.at(-1)??null,over16_67:s.filter(x=>x>1000/60).length,over100:s.filter(x=>x>100).length};};
const overlap=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
function unionMs(intervals,start,end){
  const sorted=intervals.map(({startMs,endMs})=>[Math.max(start,startMs),Math.min(end,endMs)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let total=0,lo,hi;for(const[a,b]of sorted){if(lo===undefined){lo=a;hi=b;}else if(a<=hi)hi=Math.max(hi,b);else{total+=hi-lo;lo=a;hi=b;}}return total+(lo===undefined?0:hi-lo);
}
function logsFor(run,diagnostics){
  const lines=['stdout','stderr'].flatMap(channel=>readFileSync(run.prefix+'.'+channel+'.log','utf8').split(/\r?\n/).map((text,line)=>({channel,line:line+1,text})));
  const events=[];let activeAction=null,calibrating=false;
  for(const line of lines){
    // Native V8 stdio and JS writeSync can interleave within one physical line.
    // Parse a GC prefix before considering any later marker on that same line.
    const gc=line.text.match(/\[(\d+):[^\]]+\]\s+([\d.]+) ms:\s*(.*\bpause=([^\s]+).*)/);
    if(gc){const fields=Object.fromEntries([...gc[3].matchAll(/([\w.]+)=([^\s]+)/g)].map(([,key,value])=>[key,Number.isFinite(Number(value))?Number(value):value]));events.push({...line,kind:'gc',pid:Number(gc[1]),nativeTimestampMs:Number(gc[2]),pauseMs:Number(gc[4]),fields,bracketActionId:activeAction,calibrating,orderingCaveat:'Native stdout may be buffered and interleaved with JS markers. Marker ordering alone is not an action attribution.'});}
    const markerAt=line.text.indexOf('DIAG_MARKER ');
    if(markerAt>=0){let marker;try{marker=JSON.parse(line.text.slice(markerAt+'DIAG_MARKER '.length));}catch{continue;}
      if(marker.kind==='action-start')activeAction=marker.id;
      if(marker.kind==='action-end')activeAction=null;
      if(marker.kind==='gc-calibration-start')calibrating=true;
      if(marker.kind==='gc-calibration-end')calibrating=false;
      continue;
    }
    if(!gc&&/(?:\[.*(?:optimizing|compiling|deoptimizing|bailout|marking).*\]|completed .*optimizing)/i.test(line.text))events.push({...line,kind:'compiler',bracketActionId:activeAction,calibrating,orderingCaveat:'Native stdout ordering is not precise action timing.'});
  }
  const calibrationEvent=events.filter(event=>event.kind==='gc'&&event.calibrating).at(-1),calibration=diagnostics?.gcCalibration;
  // The final forced GC is bracketed after all measurements. Header milliseconds
  // are integral; retain a conservative clock interval, not a guessed exact offset.
  const offset=calibration&&calibrationEvent?{lowMs:calibration.startPerfMs-calibrationEvent.nativeTimestampMs-1,highMs:calibration.endPerfMs-calibrationEvent.nativeTimestampMs+1,source:'Post-measurement synchronous GC bracket; native header may denote a point during collection; includes 1 ms header quantization',eventLine:calibrationEvent.line}:null;
  for(const event of events)if(event.kind==='gc'&&offset){event.perfTimestampBounds={lowMs:event.nativeTimestampMs+offset.lowMs,highMs:event.nativeTimestampMs+offset.highMs};event.possiblePauseStartMs=event.perfTimestampBounds.lowMs-event.pauseMs;event.possiblePauseEndMs=event.perfTimestampBounds.highMs+event.pauseMs;}
  return{events,calibration:offset};
}
function traceFor(run,diagnostics){
  if(!run.tracePath||!existsSync(run.tracePath))return{available:false,reason:'No trace event file',intervals:[]};
  let trace;try{trace=read(run.tracePath);}catch(error){return{available:false,reason:'Trace file could not be parsed: '+error.message,intervals:[]};}
  const events=trace.traceEvents??trace,anchors=[];let method='Main-thread trace clock anchored to performance.mark call brackets; no process-start assumption';
  for(const anchor of diagnostics.anchors){
    const event=events.find(event=>event.name==='__diag:anchor:'+anchor.name&&Number.isFinite(event.ts));
    if(event)anchors.push({name:anchor.name,pid:event.pid,tid:event.tid,eventTimestampUs:event.ts,lowOffsetMs:event.ts/1000-anchor.markAfterMs,highOffsetMs:event.ts/1000-anchor.markBeforeMs});
  }
  if(!anchors.length){
    // Some Node builds do not emit user-timing marks even when the category is
    // enabled. On this Windows run trace timestamps are monotonic microseconds;
    // use saved hrtime brackets, then require the post-run forced GC to agree.
    const main=events.find(event=>event.ph==='M'&&event.name==='thread_name'&&event.args?.name==='JavaScriptMainThread'&&event.pid===diagnostics.pid);
    if(!main||!diagnostics.anchors?.length||!diagnostics.gcCalibration)return{available:false,reason:'No user-timing anchor and no verifiable main-thread/hrtime/GC-calibration fallback',eventNames:[...new Set(events.map(event=>event.name))],intervals:[]};
    for(const saved of diagnostics.anchors)anchors.push({name:saved.name,pid:main.pid,tid:main.tid,hrNs:saved.hrNs,lowOffsetMs:Number(BigInt(saved.hrNs))/1e6-saved.perfAfterMs,highOffsetMs:Number(BigInt(saved.hrNs))/1e6-saved.perfBeforeMs});
    method='Main-thread metadata + saved process.hrtime/performance brackets; validated against post-measurement synchronous GC. User Timing anchors absent in this Node trace.';
  }
  const anchor=anchors[0],offsetMs=(anchor.lowOffsetMs+anchor.highOffsetMs)/2;
  const uncertaintyMs=Math.max(...anchors.flatMap(anchor=>[Math.abs(anchor.lowOffsetMs-offsetMs),Math.abs(anchor.highOffsetMs-offsetMs)]));
  const main=events.filter(event=>event.pid===anchor.pid&&event.tid===anchor.tid).sort((a,b)=>(a.ts??0)-(b.ts??0)),intervals=[],stack=[];
  const add=(event,end)=>{if(Number.isFinite(event.ts)&&Number.isFinite(end)&&end>=event.ts)intervals.push({name:event.name,category:event.cat??'',startMs:event.ts/1000-offsetMs,endMs:end/1000-offsetMs,durationMs:(end-event.ts)/1000});};
  for(const event of main){
    if(event.ph==='X'&&Number.isFinite(event.dur))add(event,event.ts+event.dur);
    else if(event.ph==='B')stack.push(event);
    else if(event.ph==='E'){const prior=stack.pop();if(prior)add(prior,event.ts);}
  }
  for(const interval of intervals){interval.isGc=/(?:MinorGC|MajorGC|GCScavenger|GCCompactor|GCFinalize|GC_|V8\.GC)/i.test(interval.name);interval.isCompiler=/(?:compile|optimi|deopt|Turbofan|Maglev)/i.test(interval.name);}
  const calibration=diagnostics.gcCalibration,calibrationSpans=calibration?intervals.filter(event=>event.isGc&&overlap(event.startMs,event.endMs,calibration.startPerfMs,calibration.endPerfMs)>0):[];
  if(method.startsWith('Main-thread metadata')&&!calibrationSpans.length)return{available:false,reason:'hrtime trace clock fallback failed the synchronous post-run GC interval check',intervals:[],candidateAlignment:{offsetMs,uncertaintyMs,anchors}};
  return{available:true,alignment:{offsetMs,uncertaintyMs,anchors,thread:{pid:anchor.pid,tid:anchor.tid},method,calibrationSpans},intervals,observedGcNames:[...new Set(intervals.filter(x=>x.isGc).map(x=>x.name))]};
}
function profileFor(run,diagnostics){
  if(!run.profilePath||!existsSync(run.profilePath))return{available:false,reason:'No CPU profile'};
  const profile=read(run.profilePath),anchors=diagnostics.anchors.map(anchor=>({name:anchor.name,lowMs:Number(BigInt(anchor.hrNs))/1e6-anchor.perfAfterMs,highMs:Number(BigInt(anchor.hrNs))/1e6-anchor.perfBeforeMs}));
  const offsetMs=(anchors[0].lowMs+anchors[0].highMs)/2,uncertaintyMs=Math.max(...anchors.flatMap(anchor=>[Math.abs(anchor.lowMs-offsetMs),Math.abs(anchor.highMs-offsetMs)]));
  const bounds={startPerfMs:profile.startTime/1000-offsetMs,endPerfMs:profile.endTime/1000-offsetMs};
  const measured=diagnostics.actions.filter(action=>action.phase==='measured');
  if(!measured.length||bounds.startPerfMs>measured[0].startPerfMs+5||bounds.endPerfMs<measured.at(-1).endPerfMs-5||bounds.endPerfMs>diagnostics.anchors.at(-1).perfAfterMs+30000)
    return{available:false,reason:'CPU profile monotonic timestamps do not plausibly enclose measured actions; refusing sample attribution',bounds,anchors};
  const nodes=new Map(profile.nodes.map(node=>[node.id,node])),samples=[];let timestamp=profile.startTime;
  for(let i=0;i<(profile.samples??[]).length;i++){const delta=profile.timeDeltas?.[i]??0,prior=timestamp;timestamp+=delta;samples.push({nodeId:profile.samples[i],startMs:prior/1000-offsetMs,endMs:timestamp/1000-offsetMs});}
  return{available:true,alignment:{offsetMs,uncertaintyMs,anchors,bounds,method:'V8 CPU profiler monotonic microseconds matched to process.hrtime brackets; profile must encompass action intervals'},nodes,samples};
}
function sampleAction(profile,action){
  if(!profile.available)return{available:false,reason:profile.reason};
  const counts=new Map();let sampleCount=0;
  for(const sample of profile.samples){const ms=overlap(action.startPerfMs,action.endPerfMs,sample.startMs,sample.endMs);if(ms<=0)continue;sampleCount++;counts.set(sample.nodeId,(counts.get(sample.nodeId)??0)+ms);}
  const self=Array.from(counts,([id,sampledMs])=>{const frame=profile.nodes.get(id)?.callFrame??{};return{nodeId:id,functionName:frame.functionName??'',url:frame.url??'',line:(frame.lineNumber??-1)+1,column:(frame.columnNumber??-1)+1,sampledMs};}).sort((a,b)=>b.sampledMs-a.sampledMs);
  return{available:true,sampleCount,coveredMs:self.reduce((total,row)=>total+row.sampledMs,0),gcSampledMs:self.filter(row=>/garbage collector/i.test(row.functionName)).reduce((total,row)=>total+row.sampledMs,0),idleSampledMs:self.filter(row=>/^\(idle\)$/.test(row.functionName)).reduce((total,row)=>total+row.sampledMs,0),topSelfFrames:self.slice(0,12),caveat:'Interval-weighted statistical samples, not exact CPU accounting or proof of causation; action includes setImmediate waits.'};
}
const runs=read(join(directory,'runs.json')).map(run=>localRunPaths(run,directory)),reports=[],groups=new Map();
for(const run of runs){
  if(run.exitCode!==0){reports.push({label:run.label,failed:true,exitCode:run.exitCode,error:run.error});continue;}
  const result=read(run.prefix+'.json'),diagPath=run.prefix+'.diagnostics.json',diagnostics=existsSync(diagPath)?read(diagPath):undefined;
  const measured=diagnostics?diagnostics.actions.filter(action=>action.phase==='measured'):result.timing.samples.flatMap(sample=>sample.actions.map((action,index)=>({...action,phase:'measured',round:sample.round,index})));
  const groupKey=run.mode+'/'+run.variant;if(!groups.has(groupKey))groups.set(groupKey,{mode:run.mode,variant:run.variant,actions:[],clear:[],processes:0});const group=groups.get(groupKey);group.processes++;group.actions.push(...measured.map(a=>a.wallMs));group.clear.push(...measured.filter(a=>a.name==='clear selection').map(a=>a.wallMs));
  const log=logsFor(run,diagnostics),trace=diagnostics?traceFor(run,diagnostics):{available:false,reason:'Uninstrumented control',intervals:[]},profile=diagnostics?profileFor(run,diagnostics):{available:false,reason:'Uninstrumented control'};
  const targets=measured.filter(action=>action.wallMs>=thresholdMs||action.name==='clear selection'&&action.round===70).map(action=>{
    const detail={...action,focusRound70:action.name==='clear selection'&&action.round===70};if(!diagnostics)return detail;
    const matching=trace.intervals.filter(event=>overlap(action.startPerfMs,action.endPerfMs,event.startMs,event.endMs)>0),gc=matching.filter(event=>event.isGc),compiler=matching.filter(event=>event.isCompiler);
    const gcNominalMs=unionMs(gc,action.startPerfMs,action.endPerfMs),compilerNominalMs=unionMs(compiler,action.startPerfMs,action.endPerfMs),epsilon=trace.alignment?.uncertaintyMs??0;
    detail.trace=trace.available?{gcNominalOverlapMs:gcNominalMs,gcOverlapFraction:gcNominalMs/action.wallMs,gcConservativeLowerMs:unionMs(gc.map(e=>({...e,startMs:e.startMs+epsilon,endMs:e.endMs-epsilon})),action.startPerfMs,action.endPerfMs),gcConservativeUpperMs:unionMs(gc.map(e=>({...e,startMs:e.startMs-epsilon,endMs:e.endMs+epsilon})),action.startPerfMs,action.endPerfMs),compilerNominalOverlapMs:compilerNominalMs,otherOrUnobservedMs:Math.max(0,action.wallMs-unionMs([...gc,...compiler],action.startPerfMs,action.endPerfMs)),events:[...gc,...compiler].sort((a,b)=>b.durationMs-a.durationMs).slice(0,30),caveat:'Union of observed main-thread spans only; overlapping subphases are not added twice. Unobserved time is not automatically application work.'}:{available:false,reason:trace.reason};
    detail.gcLogEvidence=log.events.filter(event=>event.kind==='gc'&&!event.calibrating&&(event.bracketActionId===action.id||Number.isFinite(event.possiblePauseStartMs)&&overlap(action.startPerfMs,action.endPerfMs,event.possiblePauseStartMs,event.possiblePauseEndMs)>0));
    detail.compilerLogEvidence=log.events.filter(event=>event.kind==='compiler'&&event.bracketActionId===action.id).slice(0,50);
    detail.cpuProfile=sampleAction(profile,action);return detail;
  });
  const report={label:run.label,mode:run.mode,variant:run.variant,round:run.round,position:run.position,sourceSha256:run.sourceSha256,fixtureSha256:result.fixture.sha256,allActions:stats(measured.map(action=>action.wallMs)),clearSelection:stats(measured.filter(action=>action.name==='clear selection').map(action=>action.wallMs)),markerCosts:diagnostics?{before:stats(measured.map(action=>action.markerBeforeMs)),after:stats(measured.map(action=>action.markerAfterMs)),totalMs:measured.reduce((sum,action)=>sum+action.markerBeforeMs+action.markerAfterMs,0),boundary:diagnostics.overheadBoundary}:null,traceAlignment:trace.alignment??{available:false,reason:trace.reason},nativeGcLogAlignment:log.calibration,profileAlignment:profile.alignment??{available:false,reason:profile.reason},observedGcNames:trace.observedGcNames??[],targets};
  writeFileSync(run.prefix+'.analysis.json',JSON.stringify(report,null,2));reports.push(report);
}
const summary={schemaVersion:1,directory,thresholdMs,groups:Array.from(groups.values(),({actions,clear,...group})=>({...group,allActions:stats(actions),clearSelection:stats(clear)})),runs:reports,
  interpretation:['Compare control versus buffered to expose marker/bookkeeping perturbation; compare trace and profile separately, not as clean speed results.','A temporal overlap quantifies where elapsed time went in that diagnostic run, not why a previous untraced 200 ms event occurred.','V8 optimization log ordering is evidence of nearby compilation activity; asynchronous/background optimization is not equivalent to a main-thread pause.','The forced calibration GC occurs only after all actions and unmount; it is excluded from action/tail analysis.','round=70 is zero based: the 71st measured cycle after 30 warmup cycles.','Trace and CPU profile clock mappings have explicit uncertainty/validity checks; unavailable mappings remain unavailable.']};
writeFileSync(join(directory,'analysis-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({directory,groups:summary.groups,focus:reports.filter(r=>!r.failed).flatMap(run=>run.targets.filter(action=>action.focusRound70||action.name==='clear selection'&&action.wallMs>=thresholdMs).map(action=>({label:run.label,round:action.round,wallMs:action.wallMs,gcMs:action.trace?.gcNominalOverlapMs,compilerMs:action.trace?.compilerNominalOverlapMs,gcSampledMs:action.cpuProfile?.gcSampledMs,topFrame:action.cpuProfile?.topSelfFrames?.[0]})))},null,2));
