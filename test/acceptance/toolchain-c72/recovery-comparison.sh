#!/usr/bin/env bash
set -euo pipefail
exec 9>/tmp/hallmark-c72-cpu.lock
flock 9
# Usage: bash run-comparison.sh PATCHED_WORKTREE CLEAN_C72_REPOSITORY NEW_OUTPUT_DIR
patched=$(realpath "${1:?patched worktree}")
source=$(realpath "${2:?clean candidate72 repository}")
mkdir -p "${3:?new output directory}"
out=$(realpath "$3")
commit=4e1cd98082a432e2ca89f606927da29eb26ddb67
[ "$(git -C "$source" rev-parse HEAD)" = "$commit" ]
git -C "$patched" merge-base --is-ancestor "$commit" HEAD
# No fetch/install and no edits to the supplied clean baseline. Keep the isolated replay tree for inspection.
git -C "$source" worktree add --detach "$out/baseline-worktree" "$commit"
ln -s "$(realpath "$patched/node_modules")" "$out/baseline-worktree/node_modules"
cp "$patched/test/apps-host/invocation-recovery.test.ts" "$out/baseline-worktree/test/apps-host/invocation-recovery.test.ts"
(
  cd "$out/baseline-worktree"
  APPS_RECOVERY_BASELINE=1 APPS_RECOVERY_EVIDENCE_DIR="$out/baseline" node --test test/apps-host/invocation-recovery.test.ts > "$out/baseline-observation.log" 2>&1
  set +e
  node --test --test-name-pattern='registered tool recovers' test/apps-host/invocation-recovery.test.ts > "$out/baseline-red.log" 2>&1
  code=$?
  set -e
  [ "$code" -eq 1 ] # The same two success assertions must fail on candidate72.
)
(
  cd "$patched"
  APPS_RECOVERY_EVIDENCE_DIR="$out/patched" node --test test/apps-host/invocation-recovery.test.ts > "$out/patched-tests.log" 2>&1
  node --test test/apps-host/transport-error-contract.test.ts > "$out/transport-tests.log" 2>&1
)
node --input-type=module - "$out" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const out=process.argv[2],result={scope:'deterministic loopback gateway fixture; not LLM success rate',runs:[]};
for(const mode of ['baseline','patched'])for(const row of JSON.parse(readFileSync(join(out,mode,'trajectory.json'),'utf8')).traces)result.runs.push({variant:mode,route:row.mode,toolCalls:row.toolCalls,httpCalls:row.httpCalls,requestPayloadBytes:row.requestPayloadBytes,responsePayloadBytes:row.responsePayloadBytes,modelBytes:row.steps.map(x=>x.modelBytes),statuses:row.steps.map(x=>x.model.status),providerCalls:row.providerCalls,providerInspections:row.providerInspections,mutationPosts:row.mutationPosts,invocationRecords:row.invocationRecords});
writeFileSync(join(out,'comparison.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
JS
