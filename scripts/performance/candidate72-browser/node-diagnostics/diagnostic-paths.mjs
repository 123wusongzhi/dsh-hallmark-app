import assert from 'node:assert/strict';
import {resolve,join,relative,isAbsolute,parse} from 'node:path';
import {fileURLToPath} from 'node:url';

export const here=fileURLToPath(new URL('.',import.meta.url));
// Defaults follow the scripts when copied. Set this explicitly to keep large
// outputs outside a checkout or to analyze an existing evidence directory.
export const outputRoot=resolve(process.env.CANDIDATE72_DIAGNOSTICS_ROOT||here);
assert.notEqual(outputRoot,parse(outputRoot).root,'Diagnostic output root must not be an entire filesystem volume');
export function ownedPath(path){
  assert.ok(typeof path==='string'&&path.length>0,'Explicit diagnostic path required');
  const absolute=resolve(path),rel=relative(outputRoot,absolute);
  assert.ok(rel!==''&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../')&&!isAbsolute(rel),'Output must be strictly inside '+outputRoot+'; set CANDIDATE72_DIAGNOSTICS_ROOT for a different explicit root');
  return absolute;
}
// A copied evidence directory must not follow absolute prefixes back to the
// original machine/location. All analysis reads/writes stay beside runs.json.
export function localRunPaths(run,directory){
  assert.ok(typeof run.label==='string'&&/^[A-Za-z0-9_-]+$/.test(run.label),'Unsafe or missing run label');
  const prefix=ownedPath(join(directory,run.label));
  return {...run,prefix,tracePath:run.tracePath?prefix+'.trace.json':null,profilePath:run.profilePath?prefix+'.cpuprofile':null};
}
