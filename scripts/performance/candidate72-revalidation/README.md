# candidate72: actual-path revalidation

This directory reproduces issues #12 / #13 / #14 against the fixed candidate72 source. The React/Runtime/DataTransfers fixtures are the actual production paths, with synthetic offline data. No shop, browser, deployment or external mutation is involved.

## Requirements and isolation

- Linux/POSIX, `flock`, Git, Python 3, Node 24.19.0 (the measured version).
- Baseline commit `4e1cd98082a432e2ca89f606927da29eb26ddb67`, tree `fc82c44d9aae05812173b03e2f107b9b51612c96`, annotated tag `v1.0.0-candidate.72`.
- The install example pins pnpm `11.25.0` because that is the observed tool version of the frozen dependency installation reused for this run (`node_modules/.modules.yaml`: `packageManager: pnpm@11.25.0`, corroborated by its original completed-install log). The candidate72 root package/lock files match that installation. This is an experiment-environment choice, not a repository `packageManager` declaration; candidate72 has no such declaration.
- A separate candidate with only the three production changes. The runner checks the exact baseline and candidate source hashes and refuses extra production changes. This prevents toolchain integration changes from being silently attributed to these performance patches.
- The three regression files must be present in the candidate for `functional` / `timing`. The scripts do not install dependencies, patch production code, commit, push, build the full Apps package or run the full suite.
- Every execution goes through `bash run.sh`. One exclusive `/tmp/hallmark-c72-cpu.lock` is held across the entire group, including frontend bundle preparation, functional checks, regressions and any ABBA run. Coordinate with other workers before starting; a lock only coordinates commands that also honor it.

From a checkout containing the reviewed production changes, the three regression files, and this materials directory:

```sh
# From the repository root. Use a NEW directory outside this checkout.
REPO="$PWD"
mkdir -p /tmp/hallmark-c72-revalidation
BASE=/tmp/hallmark-c72-revalidation/base
CAND=/tmp/hallmark-c72-revalidation/candidate
SHA=4e1cd98082a432e2ca89f606927da29eb26ddb67
git worktree add --detach "$BASE" "$SHA"
git worktree add --detach "$CAND" "$SHA"
git diff "$SHA" -- packages/plugin-apps/client/business-operations.tsx \
  packages/app-hallmark/src/listing-prepare.ts \
  packages/component-runtime/src/data-transfer-client.ts > /tmp/hallmark-c72-revalidation/three.patch
git -C "$CAND" apply --check /tmp/hallmark-c72-revalidation/three.patch
git -C "$CAND" apply /tmp/hallmark-c72-revalidation/three.patch
for path in test/plugin-apps/business-content-lazy.test.ts \
  test/app-hallmark/listing-state-index.test.ts \
  test/performance/data-transfer-byte-copy.test.ts; do
  mkdir -p "$(dirname "$CAND/$path")"
  cp "$REPO/$path" "$CAND/$path"
done
# Frozen dependency installation is separate from timing, and also holds the lock.
flock -x /tmp/hallmark-c72-cpu.lock bash -c \
  'cd "$1" && npx --yes pnpm@11.25.0 install --frozen-lockfile --ignore-scripts' _ "$BASE"
ln -s "$BASE/node_modules" "$CAND/node_modules"
```

An authenticated clone of the repository containing the fixed commit works as well. Do not substitute a moving branch as baseline. Do not force a source-hash mismatch to pass: review what changed and create a new attributable comparison.

## Commands

```sh
# Short portable wiring check. No speed claim, zero formal timing processes.
bash scripts/performance/candidate72-revalidation/run.sh smoke "$BASE" "$CAND" /tmp/hallmark-c72-revalidation/smoke

# 10 x 20-attribute React parity, medium Runtime parity/callback counts,
# transfer output/error/concurrency parity and the eight permanent regressions.
bash scripts/performance/candidate72-revalidation/run.sh functional "$BASE" "$CAND" /tmp/hallmark-c72-revalidation/functional

# Explicitly request formal timing only when coordinated with other work.
# Includes the functional gate, then 40 frontend + 40 collection + 40 transfer
# independent processes, each ordered ABBA across five rounds and two shapes.
bash scripts/performance/candidate72-revalidation/run.sh timing "$BASE" "$CAND" /tmp/hallmark-c72-revalidation/timing
```

Each output directory must not already exist and must be outside both source trees. The runner creates a fresh staging layout and symlinks to the two explicit source roots. It copies the *actual candidate reader* into the transfer fixture, which asserts that it differs from the baseline by precisely the reviewed byte-copy replacement. It never edits either production tree.

`RESULT.json` records the completed mode and gate. `run-identity.json` records Node, source hashes, candidate Git identity, exact commands and status. Every command has stdout/stderr logs; failures remain in place and stop the run. Bundle manifests and the full output/protocol data are under `hallmark-c72-performance-evidence` in that output directory.

The collection fixture creates and removes its own temporary SQLite database. Its Runtime/provider methods are real; network/store responses are synthetic. Frontend parity checks complete host trees and stable business POST payloads. It does **not** capture every GET option or outer request UUID; do not turn its narrower request evidence into a full browser/network claim.

## Script identity and portability

The frontend harness/timing runner, collection harness/runner, and transfer benchmark/count/runner are byte-for-byte copies of the accepted candidate72 experiment files. The frontend build adapter alone replaces workstation-specific paths with `C72_BASELINE` / `C72_CANDIDATE`. `run.mjs` stages the original relative directory layout; callers need not reproduce any cloud path. These wrapper/adaptor changes are not retroactively described as the scripts used to collect the archived timing.

The portable smoke status is recorded in the candidate72 report. This focused script cannot approve the unified integration gate, desktop UI or old #7R2 compatibility. See [`docs/performance/candidate72-revalidation.md`](../../../docs/performance/candidate72-revalidation.md) for measured scope, controls and exclusions.
