import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {here,ownedPath} from './diagnostic-paths.mjs';
import {prepareMicro} from './micro-prepare.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const once=(source,from,to)=>{assert.equal(source.split(from).length,2,'Exactly one pinned anchor must match: '+from);return source.replace(from,to);};
export function prepareWrapperFree(sourceDirectory,outputDirectory){
  const output=ownedPath(outputDirectory);assert.ok(!existsSync(output),'Prepare requires a fresh directory');mkdirSync(output,{recursive:true});
  const prepared=prepareMicro(sourceDirectory,join(output,'original-micro'));
  const helper=readFileSync(join(here,'fiber-host-lookup.txt'),'utf8'),entries=[];
  for(const entry of prepared.entries){
    const original=readFileSync(entry.diagnosticPath,'utf8');
    // Fail closed unless the current bundled renderer implements the reviewed API.
    for(const anchor of ['this._fiber = a2;','b._currentFiber = function() {','return a2;','var og = /* @__PURE__ */ new WeakMap();','rendererPackageName: "react-test-renderer"','version: "18.3.1"']) assert.ok(original.includes(anchor),'Pinned renderer proof missing: '+anchor);
    let edited=once(original,'var hostByLabel = (type, label) => {',helper+'\nvar hostByLabel = (type, label) => {');
    edited=once(edited,'  const n = tree.root.findAllByType(type).find((n2) => n2.props["aria-label"] === label);','  const props = mode === "timing" ? __diagnosticHostProps(type, "aria-label", label) : undefined;\n  const n = mode === "timing" ? (props === undefined ? undefined : {props}) : tree.root.findAllByType(type).find((n2) => n2.props["aria-label"] === label);');
    edited=once(edited,'  const n = tree.root.findAllByType("button").find((n2) => n2.props.className === "clear-selection");','  const props = mode === "timing" ? __diagnosticHostProps("button", "className", "clear-selection") : undefined;\n  const n = mode === "timing" ? (props === undefined ? undefined : {props}) : tree.root.findAllByType("button").find((n2) => n2.props.className === "clear-selection");');
    // Correct the shared micro diagnostic description for this separate experiment.
    edited=once(edited,"markerMode:'micro-return-fields'","markerMode:'micro-return-fields-with-private-fiber-controls'");
    edited=once(edited,'The only pre-EOF edit adds startPerfMs:start and endPerfMs:start+wallMs to the existing action return object.','Diagnostic control lookup also substitutes current Fiber host props for full ReactTestInstance traversal in timing mode only. Action return object adds startPerfMs:start and endPerfMs:start+wallMs.');
    edited=once(edited,'No diagnostic arrays, per-action markers, functions or clock reads are added.','No diagnostic arrays, per-action markers or clock reads are added; private Fiber lookup functions are added.');
    const wrapperFreePath=join(output,'collected-'+entry.variant+'-wrapper-free.mjs');writeFileSync(wrapperFreePath,edited);
    entries.push({...entry,originalMicroPath:entry.diagnosticPath,wrapperFreePath,wrapperFreeSha256:digest(edited)});
  }
  const manifest={schemaVersion:1,entries,sourceDirectory:resolve(sourceDirectory),helperSha256:digest(helper),patchScope:'Diagnostic only: timing-mode hostByLabel and clearSelection lookup use pinned current Fiber host props. Original action sequence, handlers, timed boundaries, fixture, initial/warm/final full snapshots and EOF micro anchors remain. Root TestInstance plus one small {props} adapter per lookup remain; descendant TestInstance wrappers are avoided.',boundary:'Private ReactTestRenderer API; unsupported Fiber shape/committed props causes failure. Not a production change and not formal performance evidence.'};
  writeFileSync(join(output,'wrapper-free-prepared-manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,4,'Usage: node wrapper-free-prepare.mjs <original-bundle-directory> <owned-output-directory>');
  console.log(JSON.stringify(prepareWrapperFree(process.argv[2],process.argv[3]),null,2));
}
