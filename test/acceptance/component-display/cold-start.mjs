// Child process for C1: fresh Node/module/SQLite/source/evidence caches, prebuilt offline snapshots.
// No HTTP service, provider execution, scheduler or shop client is started here.
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {RuntimeStore,AppsRuntime} from '../../../packages/app-runtime/src/index.ts';
import {AppsPresentationService} from '../../../packages/app-presentation/src/index.ts';
import {AppsAuthoringService} from '../../../packages/app-presentation/src/authoring.ts';
import {SourceComponentStore} from '../../../packages/source-components/src/index.ts';

const [directory,publicationId,displayId]=process.argv.slice(2);
assert.ok(directory&&publicationId&&displayId);
const delay=monitorEventLoopDelay({resolution:10});delay.enable();await new Promise(done=>setTimeout(done,30));
const at=performance.now(),store=new RuntimeStore(join(directory,'runtime.db')),runtime=new AppsRuntime(store),sources=new SourceComponentStore(join(directory,'sources')),presentation=new AppsPresentationService({store,runtime,sources}),authoring=new AppsAuthoringService({store,sources,presentation,evidenceRoot:join(directory,'evidence')});presentation.authoring=authoring;
try{
  const p=store.get('view_publications',publicationId);assert.ok(p);
  const open={viewId:p.viewId,publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,buildId:p.candidateBuildId,expectedViewRevision:p.expectedViewRevision},opened=authoring.openDisplay(p.ownerSessionId,{...open,displayId});
  const frame={publicationId,attemptId:p.attemptId,attemptEpoch:p.attemptEpoch,viewId:p.viewId,buildId:p.candidateBuildId,displayId,displayGeneration:opened.display.generation,frameInstanceId:displayId,documentNonce:'cold-process-nonce'};
  authoring.authorizeDisplayFrame(p.ownerSessionId,frame);
  const data=presentation.getData(p.ownerSessionId,p.viewId,{publicationId,buildId:p.candidateBuildId,displayId,displayGeneration:opened.display.generation});
  assert.equal(data.bindings[0].payload.items.length,41);assert.equal(authoring.verification.full,2);const firstSnapshotMs=performance.now()-at;
  await new Promise(done=>setTimeout(done,30));delay.disable();
  console.log(JSON.stringify({firstSnapshotMs,eventLoopMaxMs:delay.max/1e6,rows:data.bindings[0].payload.items.length,fullVerifications:authoring.verification.full,node:process.version}));
}finally{delay.disable();await runtime.dispose();store.close();}
