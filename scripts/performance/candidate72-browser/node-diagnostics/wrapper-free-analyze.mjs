import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {ownedPath,localRunPaths} from './diagnostic-paths.mjs';

// Shared action/GC clock analysis, followed by raw MajorGC heap/NVP enrichment.
await import('./analyze.mjs');
const directory=ownedPath(resolve(process.argv[2]??''));
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const runs=read(join(directory,'runs.json')).map(run=>localRunPaths(run,directory)),summary=read(join(directory,'analysis-summary.json')),reports=[];
const max=values=>values.length?Math.max(...values):null;
for(const run of runs){
  const report=summary.runs.find(record=>record.label===run.label);if(run.exitCode!==0||!report?.traceAlignment?.thread){reports.push({label:run.label,available:false});continue;}
  const diag=read(run.prefix+'.diagnostics.json'),measured=diag.actions,alignment=report.traceAlignment,thread=alignment.thread,trace=read(run.tracePath).traceEvents;
  assert.ok(measured.length===1100,'Complete measured action set required');
  const first=measured[0].startPerfMs,last=measured.at(-1).endPerfMs;
  const native=[];
  for(const [index,line] of readFileSync(run.prefix+'.stdout.log','utf8').split(/\r?\n/).entries()){
    const match=line.match(/\[(\d+):[^\]]+\]\s+([\d.]+) ms:\s*(.*\bgc=mc\b.*)/);if(!match)continue;
    const fields=Object.fromEntries([...match[3].matchAll(/([\w.]+)=([^\s]+)/g)].map(([,key,value])=>[key,Number.isFinite(Number(value))?Number(value):value]));
    native.push({line:index+1,nativeTimestampMs:Number(match[2]),fields});
  }
  const majors=[];let start;
  for(const event of trace.filter(event=>event.pid===thread.pid&&event.tid===thread.tid&&event.name==='MajorGC').sort((a,b)=>a.ts-b.ts)){
    if(event.ph==='B'){assert.ok(!start,'Unexpected nested MajorGC');start=event;}
    else if(event.ph==='E'&&start){
      const startPerfMs=start.ts/1000-alignment.offsetMs,endPerfMs=event.ts/1000-alignment.offsetMs,durationMs=(event.ts-start.ts)/1000;
      const beforeBytes=start.args?.usedHeapSizeBefore,afterBytes=event.args?.usedHeapSizeAfter;
      const matches=native.filter(item=>Number.isFinite(item.fields.pause)&&Math.abs(item.fields.pause-durationMs)<0.25&&Number.isFinite(afterBytes)&&item.fields.end_object_size===afterBytes);
      majors.push({startPerfMs,endPerfMs,durationMs,type:start.args?.type??null,beforeBytes,afterBytes,reclaimedBytes:Number.isFinite(beforeBytes)&&Number.isFinite(afterBytes)?beforeBytes-afterBytes:null,overlapsMeasuredWindow:endPerfMs>first&&startPerfMs<last,native:matches.length===1?matches[0]:null,nativeMatchCount:matches.length});start=undefined;
    }
  }
  assert.ok(!start,'Unclosed MajorGC event');
  const measuredMajors=majors.filter(event=>event.overlapsMeasuredWindow),matched=measuredMajors.filter(event=>event.native),field=name=>matched.map(event=>event.native.fields[name]).filter(Number.isFinite);
  reports.push({label:run.label,mode:run.mode,variant:run.variant,outputParity:run.outputParity,allActions:report.allActions,clearSelection:report.clearSelection,measuredMajorCount:measuredMajors.length,nativeMatchedMajorCount:matched.length,majorPauseTotalMs:measuredMajors.reduce((sum,event)=>sum+event.durationMs,0),majorPauseMaxMs:max(measuredMajors.map(event=>event.durationMs)),heapBeforeMaxBytes:max(measuredMajors.map(event=>event.beforeBytes).filter(Number.isFinite)),heapAfterMaxBytes:max(measuredMajors.map(event=>event.afterBytes).filter(Number.isFinite)),markMaxMs:max(field('mark')),ephemeronMarkingMaxMs:max(field('mark.ephemeron.marking')),ephemeronLinearMaxMs:max(field('mark.ephemeron.linear')),majors:measuredMajors});
}
const output={schemaVersion:1,directory,reports,boundary:['Only MajorGC spans overlapping the first-to-last measured action window are included, including gaps between actions; startup, warmup and post-run calibration are excluded.','NVP stages attach only when pause duration and post-GC heap bytes uniquely match a main-thread trace MajorGC; ambiguous records remain null.','Before-byte definitions can differ slightly between the trace and NVP; raw fields remain available.','Stage counters can be nested/parallel and must not be summed as independent elapsed time.','Removing TestInstance descendant wrapping also changes lookup/allocation cost and GC scheduling. A reduction supports a harness contribution; it does not prove the WeakMap is the sole cause or establish browser behavior.']};
writeFileSync(join(directory,'wrapper-free-gc-summary.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify({directory,reports:reports.map(({majors,...record})=>record)},null,2));
