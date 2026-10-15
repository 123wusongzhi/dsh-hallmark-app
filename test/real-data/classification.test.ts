import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTestDataClassification,type TestDataScope} from '../../scripts/test-data-classification.mjs';

// File identities and dependency flags are audit control inputs, not business samples.
const infrastructure='test/protocol.test.ts',recorded='test/replay.test.ts',added='test/new.test.ts';
function scope():TestDataScope{return {requiredFiles:[recorded],infrastructureFiles:[infrastructure],infrastructureReasons:{[infrastructure]:'Protocol control inputs only.'}};}
function run(configuration=scope(),dependencies=[recorded],files=[infrastructure,recorded]){
  return auditTestDataClassification(configuration,{testFiles:files,fileExists:file=>files.includes(file),recordingDependency:file=>dependencies.includes(file)});
}

test('disjoint recorded and infrastructure classifications pass and preserve report modes',()=>{
  const configuration=scope();configuration.fileModes={[recorded]:'pristine recorded replay'};
  assert.deepEqual(run(configuration),{rows:[{file:recorded,mode:'pristine recorded replay',recordingDependency:true}],failures:[]});
  assert.equal(run().rows[0].mode,'recorded base with explicit scenario variations');
});

test('infrastructure is rejected when the dependency checker finds a recording dependency',()=>{
  assert.deepEqual(run(scope(),[recorded,infrastructure]).failures,[{file:infrastructure,error:'infrastructure test has a direct or shared real-corpus dependency'}]);
});

test('moving a recording-dependent file from infrastructure to required resolves classification',()=>{
  const configuration=scope();configuration.requiredFiles.push(infrastructure);configuration.infrastructureFiles=[];configuration.infrastructureReasons={};
  const result=run(configuration,[recorded,infrastructure]);
  assert.deepEqual(result.failures,[]);assert.equal(result.rows.length,2);assert.ok(result.rows.every(row=>row.recordingDependency));
});

test('a required file without a recording dependency is rejected',()=>{
  assert.deepEqual(run(scope(),[]).failures,[{file:recorded,error:'no direct or shared real-corpus dependency'}]);
});

test('a missing required runner is rejected without pretending it was checked',()=>{
  const result=run(scope(),[recorded],[infrastructure]);
  assert.deepEqual(result.failures,[{file:recorded,error:'required test/runner missing'}]);assert.deepEqual(result.rows,[]);
});

test('recorded helper runners need not themselves be discovered test files',()=>{
  const runner='test/acceptance/run.mjs',configuration=scope();configuration.requiredFiles=[runner];
  const result=auditTestDataClassification(configuration,{testFiles:[infrastructure],fileExists:file=>file===runner,recordingDependency:file=>file===runner});
  assert.deepEqual(result.failures,[]);assert.equal(result.rows[0].file,runner);
});

test('an infrastructure entry absent from discovered test files is rejected',()=>{
  assert.deepEqual(run(scope(),[recorded],[recorded]).failures,[{file:infrastructure,error:'infrastructure classification no longer exists'}]);
});

test('infrastructure needs a nonempty reason',()=>{
  for(const reason of [undefined,'','  ']){
    const configuration=scope();configuration.infrastructureReasons=reason===undefined?{}:{[infrastructure]:reason};
    assert.deepEqual(run(configuration).failures,[{file:infrastructure,error:'missing infrastructure reason'}]);
  }
});

test('new discovered tests require a classification',()=>{
  assert.deepEqual(run(scope(),[recorded],[infrastructure,recorded,added]).failures,[{file:added,error:'unclassified new test: review its data source'}]);
});

test('duplicate entries in either classification are explicit failures',()=>{
  const required=scope();required.requiredFiles.push(recorded);
  assert.deepEqual(run(required).failures,[{file:recorded,error:'duplicate required classification'}]);
  const protocol=scope();protocol.infrastructureFiles.push(infrastructure);
  assert.deepEqual(run(protocol).failures,[{file:infrastructure,error:'duplicate infrastructure classification'}]);
});

test('a file cannot be classified as both infrastructure and recorded',()=>{
  const configuration=scope();configuration.infrastructureFiles.push(recorded);configuration.infrastructureReasons![recorded]='Incorrect overlap control.';
  const result=run(configuration);
  assert.ok(result.failures.some(row=>row.file===recorded&&row.error==='overlapping required and infrastructure classifications'));
  assert.ok(result.failures.some(row=>row.file===recorded&&row.error==='infrastructure test has a direct or shared real-corpus dependency'));
});
