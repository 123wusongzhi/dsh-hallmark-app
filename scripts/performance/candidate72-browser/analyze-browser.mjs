// Read-only analysis of captured browser evidence. This program never launches a browser.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const [mode,inputArg,outputArg,...rest]=process.argv.slice(2);
assert.ok(['raw','trace'].includes(mode)&&inputArg&&outputArg,'Usage: node analyze-browser.mjs raw INPUT_DIRECTORY_OR_RAW_JSON NEW_OUTPUT_JSON | trace INPUT_TRACE_JSON NEW_OUTPUT_JSON [--threshold-ms=20]');
const input=resolve(inputArg),output=resolve(outputArg);
assert.notEqual(input,output,'Output must not replace input');
assert.ok(!existsSync(output),'Analysis output already exists; preserve previous evidence and choose a new filename');
const threshold=Number(rest.find(x=>x.startsWith('--threshold-ms='))?.split('=')[1]??20);
assert.ok(Number.isFinite(threshold)&&threshold>=0,'Invalid diagnostic threshold');
const digest=value=>createHash('sha256').update(value).digest('hex');
const load=path=>{const bytes=readFileSync(path);return{path,sha256:digest(bytes),bytes:bytes.length,data:JSON.parse(bytes)};};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const median=values=>{if(!values.length)return null;const a=values.toSorted((x,y)=>x-y);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;};
function stats(values){
 assert.ok(values.every(finite),'Nonfinite timing sample; do not silently drop samples');
 if(!values.length)return{count:0,medianMs:null,p95Ms:null,maxMs:null,over50ms:0,over100ms:0};
 const ordered=values.toSorted((a,b)=>a-b);
 return{count:values.length,medianMs:median(values),p95Ms:ordered[Math.ceil(values.length*.95)-1],maxMs:ordered.at(-1),over50ms:values.filter(v=>v>50).length,over100ms:values.filter(v=>v>100).length};
}
const ratio=(candidate,baseline)=>finite(candidate)&&finite(baseline)&&baseline>0?candidate/baseline:null;
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const valueHash=value=>digest(canonical(value));
function firstDifference(a,b,path='$'){
 if(Object.is(a,b))return null;
 if(typeof a!==typeof b||a===null||b===null||typeof a!=='object')return{path,baseline:a,candidate:b};
 if(Array.isArray(a)!==Array.isArray(b))return{path,reason:'array/object shape differs'};
 if(Array.isArray(a)&&a.length!==b.length)return{path,baselineLength:a.length,candidateLength:b.length};
 const keys=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
 for(const key of keys){if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))return{path:path+'.'+key,baselinePresent:Object.hasOwn(a,key),candidatePresent:Object.hasOwn(b,key)};const found=firstDifference(a[key],b[key],path+'.'+key);if(found)return found;}
 return null;
}
function compareField(rows,field,get){
 const present=rows.map(row=>({row,value:get(row)})).filter(entry=>entry.value!==undefined);
 if(!present.length)return{field,status:'not-captured',comparisons:[]};
 const base=present.find(entry=>entry.row.arm==='baseline');
 if(!base)return{field,status:'missing-baseline',comparisons:[],missing:rows.filter(row=>get(row)===undefined).map(row=>row.label)};
 const reference=canonical(base.value),comparisons=present.map(({row,value})=>({label:row.label,arm:row.arm,equal:canonical(value)===reference,sha256:valueHash(value),...(canonical(value)!==reference?{firstDifference:firstDifference(base.value,value)}:{})}));
 const missing=rows.filter(row=>get(row)===undefined).map(row=>row.label);
 return{field,status:missing.length?'missing-captures':comparisons.every(row=>row.equal)?'equal':'different',referenceLabel:base.row.label,referenceSha256:valueHash(base.value),missing,comparisons};
}
const withoutEventTiming=event=>event?Object.fromEntries(Object.entries(event).filter(([key])=>!['startTime','endTime','dispatchToLayoutMs'].includes(key))):undefined;
function controlledImage(value){
 const image=value?.imageFailure;
 if(!image?.controlledErrorReplay)return undefined;
 // Natural loading/decoding observations remain in the full comparison and in
 // their own observation field; they are not part of the controlled replay.
 const {naturalDecode,...controlled}=image;
 return{...controlled,event:withoutEventTiming(image.event)};
}
function parityValue(value){
 if(!value||!Array.isArray(value.frames))return undefined;
 const metadata=value.metadata?Object.fromEntries(Object.entries(value.metadata).filter(([key])=>key!=='clock')):undefined;
 const imageFailure=value.imageFailure?{...value.imageFailure,event:withoutEventTiming(value.imageFailure.event)}:undefined;
 return{metadata,queries:value.queries,frames:value.frames,imageFailure,final:value.final,networkAttempts:value.networkAttempts,oracle:value.oracle};
}
function processMetrics(row){
 const value=row.value,samples=value?.samples;
 if(!Array.isArray(samples))return null;
 assert.equal(samples.length,value.rounds,`${row.label}: recorded round count differs from sample count`);
 const actions=samples.flatMap(sample=>sample.actions.map(action=>({...action,round:sample.round})));
 for(const sample of samples){assert.ok(Array.isArray(sample.actions)&&sample.actions.length,`${row.label}: missing action samples`);assert.ok(finite(sample.dispatchBatchMs)&&finite(sample.cycleToSecondRafMs),`${row.label}: cycle timing missing`);}
 assert.ok(actions.every(action=>finite(action.dispatchToLayoutMs)),`${row.label}: missing action timing`);
 const clear=actions.filter(action=>action.name==='clear selection');
 assert.equal(clear.length,samples.length,`${row.label}: one clear-selection action is required per cycle`);
 const actionIndices=[...new Set(actions.map(action=>action.index))].sort((a,b)=>a-b);
 const task=finite(value.cdpDelta?.TaskDuration)?value.cdpDelta.TaskDuration*1000:null;
 const measuredLongTasks=(value.longTasks??[]).filter(task=>task.startTime+task.duration>=value.measurementStart&&task.startTime<=value.measurementEnd);
 return{label:row.label,arm:row.arm,mode:row.mode,shape:row.shape,cycle:row.cycle,position:row.position,rounds:samples.length,browserVersion:row.browserVersion,
  cycleDispatch:stats(samples.map(sample=>sample.dispatchBatchMs)),cycleToSecondRaf:stats(samples.map(sample=>sample.cycleToSecondRafMs)),paintOpportunityWait:stats(samples.map(sample=>sample.paintOpportunityWaitMs)),actions:stats(actions.map(action=>action.dispatchToLayoutMs)),
  perAction:actionIndices.map(index=>{const items=actions.filter(action=>action.index===index);return{index,names:[...new Set(items.map(action=>action.name))],...stats(items.map(action=>action.dispatchToLayoutMs))};}),
  mainTaskDurationMs:task,mainTaskDurationPerCycleMs:task===null||!samples.length?null:task/samples.length,cdpDelta:value.cdpDelta??null,
  clearSelection:stats(clear.map(action=>action.dispatchToLayoutMs)),clearSelectionOver50ms:clear.filter(action=>action.dispatchToLayoutMs>50),
  longTaskSupported:value.longTaskSupported??null,reportedLongTasks:value.longTasks??[],measuredWindowOverlappingLongTasks:measuredLongTasks,
  measurementMeaning:value.measurementMeaning,measurementWindow:{startTime:value.measurementStart,endTime:value.measurementEnd,durationMs:value.measurementMs},
  initialFrameCaptured:value.initialFrame!==undefined,warmFrameCaptured:value.warmFrame!==undefined,finalFrameCaptured:value.finalFrame!==undefined};
}
function rawAnalysis(){
 const files=statSync(input).isDirectory()?readdirSync(input).filter(name=>name.endsWith('-raw.json')).sort().map(name=>join(input,name)):[input];
 assert.ok(files.length,'No *-raw.json files found');
 const inputs=files.map(load),rows=inputs.flatMap(file=>{assert.ok(Array.isArray(file.data),`${file.path}: expected row array`);return file.data.map(row=>({...row,inputFile:file.path}));});
 assert.ok(rows.length,'No captured runs');
 const identities=new Set();for(const row of rows){assert.ok(['baseline','candidate'].includes(row.arm)&&row.mode&&row.shape&&row.label,'Missing run identity');assert.ok(!identities.has(row.label),'Duplicate run label: '+row.label);identities.add(row.label);}
 const groups=[];
 for(const key of [...new Set(rows.map(row=>row.mode+'|'+row.shape))].sort()){
  const selected=rows.filter(row=>row.mode+'|'+row.shape===key),[runMode,shape]=key.split('|'),processes=selected.map(processMetrics).filter(Boolean);
  const functional=[compareField(selected,'initial',row=>row.initial),compareField(selected,'final',row=>row.final),compareField(selected,'value.initialFrame',row=>row.value?.initialFrame),compareField(selected,'value.warmFrame',row=>row.value?.warmFrame),compareField(selected,'value.finalFrame',row=>row.value?.finalFrame),compareField(selected,'full-frames',row=>row.value?.frames),compareField(selected,'full-queries',row=>row.value?.queries),compareField(selected,'controlled-image',row=>controlledImage(row.value)),compareField(selected,'natural-image',row=>row.value?.imageFailure?.naturalDecode),compareField(selected,'functional-parity',row=>parityValue(row.value))];
  const armStats=Object.fromEntries(['baseline','candidate'].map(arm=>{
   const armRows=selected.filter(row=>row.arm===arm),pp=processes.filter(row=>row.arm===arm),allSamples=armRows.flatMap(row=>row.value?.samples??[]),allActions=allSamples.flatMap(sample=>sample.actions);
   const metric=key=>{const values=pp.map(row=>row[key]);return{available:values.filter(finite).length,missing:values.filter(v=>!finite(v)).length,...stats(values.filter(finite))};};
   return[arm,{processes:armRows.length,measuredProcesses:pp.length,browserVersions:[...new Set(armRows.map(row=>row.browserVersion))],processMedianCycleDispatch:stats(pp.map(row=>row.cycleDispatch.medianMs).filter(finite)),processMedianCycleToSecondRaf:stats(pp.map(row=>row.cycleToSecondRaf.medianMs).filter(finite)),processMedianAction:stats(pp.map(row=>row.actions.medianMs).filter(finite)),mainTaskDuration:metric('mainTaskDurationMs'),mainTaskDurationPerCycle:metric('mainTaskDurationPerCycleMs'),pooledCycleDispatch:stats(allSamples.map(sample=>sample.dispatchBatchMs)),pooledActions:stats(allActions.map(action=>action.dispatchToLayoutMs)),pooledClearSelection:stats(allActions.filter(action=>action.name==='clear selection').map(action=>action.dispatchToLayoutMs)),perProcess:pp}];
  }));
  const cycles=runMode==='timing'?[...new Set(processes.map(row=>row.cycle))].sort((a,b)=>a-b).map(cycle=>{
   const pair=processes.filter(row=>row.cycle===cycle).sort((a,b)=>a.position-b.position),order=pair.map(row=>row.arm),complete=canonical(order)===canonical(['baseline','candidate','candidate','baseline']);
   const selectors={cycleDispatchMedianMs:r=>r.cycleDispatch.medianMs,cycleToSecondRafMedianMs:r=>r.cycleToSecondRaf.medianMs,actionMedianMs:r=>r.actions.medianMs,mainTaskDurationMs:r=>r.mainTaskDurationMs,clearSelectionP95Ms:r=>r.clearSelection.p95Ms,clearSelectionMaxMs:r=>r.clearSelection.maxMs};
   const metrics=Object.fromEntries(Object.entries(selectors).map(([name,get])=>{const before=pair.filter(row=>row.arm==='baseline').map(get),after=pair.filter(row=>row.arm==='candidate').map(get),a=before.every(finite)?median(before):null,b=after.every(finite)?median(after):null;return[name,{baseline:a,candidate:b,candidateOverBaseline:complete?ratio(b,a):null,comparable:complete&&ratio(b,a)!==null}];}));
   return{cycle,completeAbba:complete,order,labels:pair.map(row=>row.label),metrics};
  }):[];
  const errors=selected.filter(row=>(row.errors?.length??0)||(row.blocked?.length??0)||(row.value?.networkAttempts?.length??0)).map(row=>({label:row.label,errors:row.errors,blocked:row.blocked,networkAttempts:row.value?.networkAttempts}));
  const missingArms=['baseline','candidate'].filter(arm=>!selected.some(row=>row.arm===arm));
  const missingRequiredCaptures=functional.filter(row=>(['initial','final'].includes(row.field)||runMode==='functional'&&row.field==='functional-parity')&&row.status==='not-captured').map(row=>row.field);
  const contractFields=['initial','final','value.initialFrame','value.warmFrame','value.finalFrame','full-frames','full-queries','controlled-image'];
  const contractRequired=['initial','final',...(runMode==='functional'?['full-frames','full-queries','controlled-image']:[])];
  const missingContractCaptures=functional.filter(row=>contractRequired.includes(row.field)&&row.status==='not-captured').map(row=>row.field);
  const badStatus=row=>['different','missing-baseline','missing-captures'].includes(row.status);
  const contractParityStatus=errors.length||missingArms.length||missingContractCaptures.length||functional.filter(row=>contractFields.includes(row.field)).some(badStatus)?'needs-review':'equal-for-captured-fields';
  const naturalComparison=functional.find(row=>row.field==='natural-image');
  groups.push({mode:runMode,shape,formalTiming:runMode==='timing',instrumented:runMode==='trace',arms:armStats,abba:cycles,functional,errors,missingArms,missingRequiredCaptures,parityStatus:errors.length||missingArms.length||missingRequiredCaptures.length||functional.some(badStatus)?'needs-review':'equal-for-captured-fields',contractParityStatus,contractFields,missingContractCaptures,naturalObservationStatus:naturalComparison.status,naturalImageObservations:selected.filter(row=>row.value?.imageFailure?.naturalDecode!==undefined).map(row=>({label:row.label,arm:row.arm,naturalDecode:row.value.imageFailure.naturalDecode})),parityScope:'Full captured JSON values are compared, preserving HTML, control state, layout, queries and image outcomes. Only metadata.clock and imageFailure.event startTime/endTime/dispatchToLayoutMs are excluded from functional-parity. The controlled-image comparison excludes naturalDecode only; its replay definition and outcomes are compared in full. Natural image observations are independently compared and retained; their differences still keep overall parityStatus at needs-review.'});
 }
 return{type:'browser-raw-analysis',inputs:inputs.map(({data,...identity})=>identity),groups,notes:['All captured process/action samples are retained in statistics; no outlier removal. Modes and scenarios are kept separate.','Per-process cycle/action medians and pooled distributions are both reported; pooled percentiles are not independent process-level confidence bounds.','CDP TaskDuration is in seconds at capture and converted here to milliseconds. It covers the whole before/after CDP interval, including fixture/reset/snapshot work in that interval; it is not isolated render CPU.','Cycle-to-second-rAF is a paint opportunity measurement, not proof of physical paint. Action timing includes synchronous dispatch/React/layout work as declared by the fixture.','The >50 ms, >100 ms and p95/max figures are diagnostic summaries only; they do not alone identify a cause or establish a browser UX guarantee.','A missing capture is not a successful parity check. Trace-mode timings include instrumentation overhead and are not combined with formal timing.']};
}

function traceAnalysis(){
 const source=load(input),data=source.data,events=Array.isArray(data)?data:data.traceEvents??[];
 assert.ok(Array.isArray(events),'Expected Chrome traceEvents array');
 const complete=[],stacks=new Map(),asyncStarts=new Map(),unmatched=[];
 const eventId=e=>String(e.id??e.id2?.local??e.id2?.global??'');
 const asyncKey=e=>[e.pid,e.cat,e.name,eventId(e)].join('|');
 const push=(start,end)=>{if(finite(start.ts)&&finite(end)&&end>=start.ts)complete.push({...start,ph:'X',dur:end-start.ts,sourcePhase:start.ph});};
 for(const event of events){
  if(event.ph==='X'&&finite(event.ts)&&finite(event.dur)){complete.push(event);continue;}
  if(event.ph==='B'){const key=event.pid+'|'+event.tid,stack=stacks.get(key)??[];stack.push(event);stacks.set(key,stack);continue;}
  if(event.ph==='E'){const key=event.pid+'|'+event.tid,stack=stacks.get(key)??[],start=stack.pop();if(start)push(start,event.ts);else unmatched.push({name:event.name,pid:event.pid,tid:event.tid,phase:'E'});continue;}
  if(['b','S'].includes(event.ph)){const key=asyncKey(event),stack=asyncStarts.get(key)??[];stack.push(event);asyncStarts.set(key,stack);continue;}
  if(['e','F'].includes(event.ph)){const start=asyncStarts.get(asyncKey(event))?.pop();if(start)push(start,event.ts);}
 }
 const userCategory=event=>String(event.cat??'').includes('user_timing');
 const marks=events.filter(event=>userCategory(event)&&finite(event.ts)&&!['X','b','e','B','E','S','F'].includes(event.ph));
 const intervals=complete.filter(userCategory).map(event=>({name:event.name,pid:event.pid,tid:event.tid,startUs:event.ts,endUs:event.ts+event.dur,durationMs:event.dur/1000,source:'trace-duration'}));
 const markStarts=new Map();
 for(const event of marks.toSorted((a,b)=>a.ts-b.ts)){
  if(typeof event.name!=='string')continue;
  if(event.name.endsWith(':start')){const key=event.pid+'|'+event.name.slice(0,-6),list=markStarts.get(key)??[];list.push(event);markStarts.set(key,list);}
  else if(event.name.endsWith(':end')){const name=event.name.slice(0,-4),start=markStarts.get(event.pid+'|'+name)?.shift();if(start&&event.ts>=start.ts)intervals.push({name,pid:event.pid,tid:start.tid,startUs:start.ts,endUs:event.ts,durationMs:(event.ts-start.ts)/1000,source:'paired-start-end-marks'});}
 }
 const uniqueIntervals=[...new Map(intervals.map(row=>[[row.pid,row.name,row.startUs,row.endUs].join('|'),row])).values()];
 const threads=events.filter(event=>event.ph==='M'&&event.name==='thread_name').map(event=>({pid:event.pid,tid:event.tid,name:event.args?.name}));
 const chosenName=/RunTask|FunctionCall|EventDispatch|EvaluateScript|Layout|Recalc|UpdateLayoutTree|Paint|Composite|Commit|GC|Garbage|Compile|ParseScript|V8\.Execute/i;
 const longEvents=complete.filter(event=>event.dur/1000>=threshold&&chosenName.test(String(event.name))).map(event=>({name:event.name,category:event.cat,pid:event.pid,tid:event.tid,threadName:threads.find(thread=>thread.pid===event.pid&&thread.tid===event.tid)?.name??null,startUs:event.ts,endUs:event.ts+event.dur,durationMs:event.dur/1000,args:event.args??{},overlappingUserTiming:uniqueIntervals.filter(mark=>mark.pid===event.pid&&mark.endUs>event.ts&&mark.startUs<event.ts+event.dur).map(mark=>({...mark,overlapMs:(Math.min(mark.endUs,event.ts+event.dur)-Math.max(mark.startUs,event.ts))/1000}))})).sort((a,b)=>b.durationMs-a.durationMs);
 const byName=[...new Set(longEvents.map(event=>event.name))].map(name=>({name,...stats(longEvents.filter(event=>event.name===name).map(event=>event.durationMs))}));
 const profiles=new Map();
 function addProfile(key,profile,timeDeltas,identity){
  const item=profiles.get(key)??{...identity,nodes:new Map(),samples:[],chunks:0};item.chunks++;
  for(const node of profile.nodes??[])item.nodes.set(node.id,{...(item.nodes.get(node.id)??{}),...node});
  const samples=profile.samples??[],deltas=timeDeltas??profile.timeDeltas??[];
  for(let i=0;i<samples.length;i++)item.samples.push({nodeId:samples[i],weightUs:finite(deltas[i])&&deltas[i]>=0?deltas[i]:null});
  profiles.set(key,item);
 }
 if(Array.isArray(data.nodes))addProfile('standalone',data,data.timeDeltas,{kind:'standalone-cpu-profile'});
 for(const event of events){
  const value=event.args?.data??event.args??{},profile=value.cpuProfile??value.profile;
  if((event.name==='ProfileChunk'||event.name==='CpuProfile')&&profile)addProfile([event.pid,event.tid,eventId(event)||event.name].join('|'),{...profile,samples:profile.samples??value.samples},value.timeDeltas,{kind:event.name,pid:event.pid,tid:event.tid,id:eventId(event)});
 }
 const cpuProfiles=[...profiles.values()].map(profile=>{
  const parents=new Map();for(const node of profile.nodes.values()){if(node.parent!==undefined)parents.set(node.id,node.parent);for(const child of node.children??[])parents.set(child,node.id);}
  const totals=new Map();let missingNodes=0,unweightedSamples=0,knownWeightUs=0;
  const frameKey=frame=>canonical({functionName:frame.functionName??'(anonymous)',url:frame.url??'',lineNumber:frame.lineNumber??-1,columnNumber:frame.columnNumber??-1});
  function add(node,weight,self){const frame=node.callFrame??{},key=frameKey(frame),row=totals.get(key)??{functionName:frame.functionName??'(anonymous)',url:frame.url??'',lineNumber:frame.lineNumber??-1,columnNumber:frame.columnNumber??-1,selfSamples:0,inclusiveSamples:0,selfSampledMs:0,inclusiveSampledMs:0};if(self){row.selfSamples++;if(weight!==null)row.selfSampledMs+=weight/1000;}row.inclusiveSamples++;if(weight!==null)row.inclusiveSampledMs+=weight/1000;totals.set(key,row);}
  for(const sample of profile.samples){if(sample.weightUs===null)unweightedSamples++;else knownWeightUs+=sample.weightUs;let id=sample.nodeId,first=true;const seen=new Set(),seenFrames=new Set();if(!profile.nodes.has(id)){missingNodes++;continue;}while(profile.nodes.has(id)&&!seen.has(id)){seen.add(id);const node=profile.nodes.get(id),key=frameKey(node.callFrame??{});if(!seenFrames.has(key)){add(node,sample.weightUs,first);seenFrames.add(key);}first=false;id=parents.get(id);}}
  const ranked=[...totals.values()].sort((a,b)=>b.selfSampledMs-a.selfSampledMs||b.selfSamples-a.selfSamples);
  return{kind:profile.kind,pid:profile.pid,tid:profile.tid,id:profile.id,chunks:profile.chunks,nodeCount:profile.nodes.size,sampleCount:profile.samples.length,unweightedSamples,missingNodeSamples:missingNodes,knownSampledMs:knownWeightUs/1000,topSelfFrames:ranked.slice(0,50),topInclusiveFrames:[...ranked].sort((a,b)=>b.inclusiveSampledMs-a.inclusiveSampledMs||b.inclusiveSamples-a.inclusiveSamples).slice(0,50),allFrames:ranked};
 });
 return{type:'browser-trace-analysis',input:{path:source.path,sha256:source.sha256,bytes:source.bytes},diagnosticThresholdMs:threshold,eventCount:events.length,completeDurationCount:complete.length,threadNames:threads,unmatchedSyncEnds:unmatched,openSyncBegins:[...stacks.values()].reduce((n,stack)=>n+stack.length,0),openAsyncBegins:[...asyncStarts.values()].reduce((n,stack)=>n+stack.length,0),userTiming:{marks:marks.map(event=>({name:event.name,pid:event.pid,tid:event.tid,timestampUs:event.ts,args:event.args??{}})),intervals:uniqueIntervals},longEvents,byName,cpuProfiles,notes:['All matching duration events at or above the diagnostic threshold are retained. Nested RunTask/FunctionCall/Layout/GC durations overlap; do not add them as independent elapsed time.','Temporal overlap with a userTiming interval does not establish causation. The trace is instrumented evidence and is separate from formal plain-run timings.','ProfileChunk and CpuProfile samples are merged by process/thread/profile identity. Sample weights use provided timeDeltas only; missing weights remain counted and are not invented. CPU frame line/column numbers are zero-based.','Sampled frame time is an attribution estimate, not exact exclusive CPU accounting. Root/idle/GC frames remain in the output; nothing is discarded as an outlier.','No profile chunks means no sampled CPU evidence in this trace, not zero JavaScript work. Missing userTiming intervals are reported as missing overlap information, not proof that events occurred outside the workload.']};
}

const report=mode==='raw'?rawAnalysis():traceAnalysis();
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({mode,input,output,...(mode==='raw'?{groups:report.groups.map(group=>({mode:group.mode,shape:group.shape,parityStatus:group.parityStatus,contractParityStatus:group.contractParityStatus,naturalObservationStatus:group.naturalObservationStatus,processes:Object.fromEntries(Object.entries(group.arms).map(([arm,value])=>[arm,value.processes]))}))}:{longEvents:report.longEvents.length,cpuProfiles:report.cpuProfiles.length,userTimingIntervals:report.userTiming.intervals.length})}));
if(mode==='raw'&&report.groups.some(group=>group.parityStatus==='needs-review'))process.exitCode=2;
