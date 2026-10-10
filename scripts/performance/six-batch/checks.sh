#!/usr/bin/env bash
# Run from repository root after root and both component-workspace lockfile installs.
# Browser tests require a working DSH_PREVIEW_BROWSER_PATH; absent means NOT_RUN.
set -uo pipefail
out=${1:?Usage: bash scripts/performance/six-batch/checks.sh /absolute/evidence-dir}
mkdir -p "$out"
failed=0
record(){ local stage=$1 status=$2; printf '%s %s\n' "$stage" "$status" | tee -a "$out/status.txt"; if ((status!=0)); then failed=1; fi; }
for stage in generate:apps-sdk typecheck build:apps build:plugin; do
 pnpm run "$stage" > "$out/${stage//:/-}.log" 2>&1
 record "$stage" "$?"
done
node --test --test-concurrency=1 test/**/*.test.ts > "$out/full-tests.log" 2>&1
record full-tests "$?"
node --test --test-concurrency=1 test/app-contracts/*.test.ts test/app-hallmark/*.test.ts test/app-notes/*.test.ts test/apps-runtime/*.test.ts test/apps-components/*.test.ts test/dsh-compat/*.test.ts test/apps-host/*.test.ts test/apps-migration/*.test.ts > "$out/apps-tests.log" 2>&1
record apps-tests "$?"
node scripts/smoke-apps-bundle.mjs > "$out/smoke-bundle.log" 2>&1
record smoke-bundle "$?"
exit "$failed"
