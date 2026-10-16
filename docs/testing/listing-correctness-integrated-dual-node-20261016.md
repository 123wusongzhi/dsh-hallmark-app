# Listing receipt identity and image handoff: integrated validation

Date: 2026-10-16 UTC. Public baseline: `bf9fb46d09815a5ef1c7dc73e76939471f79a340`.
Tested commit: `0c2bf5384672f48b26bdb2ba28aa6740d2aa2046`; tree: `ca58dfdb0e7c2e6e5529c43d6a957492cc10f7df`.
This report is added after validation and changes no tested source or tests.

## Two bounded correctness corrections

**Ambiguous listing receipts remain unresolved.** The real core import-readback path now requires exactly one matching row with exact string offer identity. Duplicate/conflicting receipts, including duplicate identical successes, cannot establish a terminal result. An imported-success product ID must be a positive safe integer number or a canonical positive decimal string within that numeric range; booleans, arrays and coercion-only values are rejected. Unknown state retains read-only recovery and does not replay the import. This remains an import-only completion boundary, `imported-not-sellable-verified`; it does not establish stock, moderation or on-sale status. See [completion identity reproduction](../audits/listing-completion-identity-20261016.md).

**Image execution remains bound to its approved current job.** The local extension rechecks durable completion, current owner/version and arguments at execution, and binds each approved call ID to its prepared job. A result recorded after approval prevents duplicate execution; preparation replacement or retargeting cannot reuse an earlier approval. Existing non-listing image handling and success checkpointing remain covered. This is local hook/Host correctness, not cross-process exclusion, provider billing protection proved in production, native lifecycle acceptance or a real paid generation result. See [image handoff reproduction and controls](listing-image-handoff-freshness-20261016.md).

The two original candidates were `2fe19b98210c1da0a415debf24fcea7d1b00627b` and `845aeae6885097ff302b20c7a5c05816738358b0`. Independent reviewers cleared both before integration. Their production changes do not overlap. The integrated image source matches its reviewed SHA-256 `56b5bf1ab255ddf7994ac33d7d6b068c1ccbd49ea853a65430daf8840917c14c`.

## Frozen expanded gate

| Actual runtime | Files | Tests | Pass | Fail | Skip | Audit | Typecheck |
|---|---:|---:|---:|---:|---:|---|---|
| Node 22.18.0 / npm 10.9.3 | 149 | 1009 | 1007 | 0 | 2 | PASS | PASS |
| Node 24.21.0 / npm 11.19.0 | 149 | 1009 | 1007 | 0 | 2 | PASS | PASS |

Both complete case-name/outcome multisets match. Scope is the preceding 125-file related combination plus all eleven core files, twelve adjacent app-hallmark listing files and the Host image-job file. Existing plugin-apps Host coverage is already included and not duplicated. The increase from 710 to 1009 cases reflects expanded existing coverage as well as the new regressions; it is not a claim of 299 newly written tests. No prior case was removed or renamed and skips are unchanged.

The two existing skips are excluded from passes:
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

Both corpus audits pass: 338 test files, 182 required entries, 171 infrastructure entries, recorded source counts 20/20/1. Both candidates extend already classified files. Matching browser fixture data was prepared offline from the checkout.

Audit, the complete selected tests, and typecheck ran serially per runtime. Test concurrency remained one; the expanded combination had a 1200-second external stage allowance with no case-specific deadline changes. All six stages exited zero naturally, with no failed or timed-out integration stage. All 1464 tracked files stayed byte-identical before and after each stage. Combined source SHA-256: `7f9e0b429cc71190caa2650bfa059a88e547317c1df049506539474a34776257`.

The exact frozen source was rebuilt using the documented bundle script before testing. The local archive manifest remains **1.0.0-candidate.76**, not installed candidate.99. Archive size: 2388976 bytes; SHA-256: `8c67e2ff941ad10a8c5897c8638729a274a94d0eea1afeb4062e2ef757edc60c`. Its bytes remained unchanged throughout both-runtime checks. Actual packaged Runtime isolation passed on both runtimes. The generated archive remains local and uninstalled.

## Reproduction evidence and limits

The completion author's baseline focused run had 27 passes and five failures out of 32; the corrected focused run passed all 32. Independent review additionally exercised duplicate-order, strict-ID and recovery controls on both runtimes. The full core suite was included in this integration rather than inferred from focused results.

For image handoff, the final 19-case baseline regression had four passes and fifteen failures on each runtime; the corrected local suite passed all 19. These reds and the independent review's controls establish the bounded before/after behavior. They are preserved in the linked reports and local raw evidence, not represented as historical incident replay.

No live merchant request/write, external model call, paid image generation, desktop installation or deployment occurred. This does not prove native DSH lifecycle integration, cross-process locking or real-provider costs/latency. The incident report guides investigation; it does not turn these local tests into historical incident acceptance. The user's uncommitted listing tree and installed candidate.99 are outside this exact-tree validation.

## Reproduction commands

Use the frozen dependency lock, matching recorded data, the exact runtime and its npm/PATH, and a writable local npm cache:

```sh
node scripts/prepare-real-test-data.mjs
node scripts/build-apps-bundle.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 \
  "test/apps-components/*.test.ts" \
  "test/plugin-apps/*.test.ts" \
  "test/operations/*.test.ts" \
  "test/business-pricing/*.test.ts" \
  "test/operations-adapter/*.test.ts" \
  "test/core/*.test.ts" \
  "test/app-hallmark/listing-*.test.ts" \
  test/apps-host/listing-image-jobs.test.ts \
  test/apps-runtime/business-settings-http.test.ts \
  test/apps-runtime/workbench-http.test.ts \
  test/apps-runtime/workbench.test.ts \
  test/apps-host/business-value-projection.test.ts \
  test/apps-host/business-partial-status.test.ts \
  test/business-packaging/packaging.test.ts \
  test/service/packaging-settings.test.ts \
  test/app-hallmark/packaging-evidence.test.ts \
  test/materials/business-recovery.test.ts \
  test/performance/runtime-artifact-isolation.test.ts \
  test/performance/directory-draft-etag.test.ts
npm run typecheck
```

Allow 1200 seconds externally per stage. This is a 149-file selected combination, not the default full repository suite or browser visual acceptance. Only selected source/tests and human-readable reports belong to the publication tree. Raw logs, manifests, generated fixtures and archives remain local. Publication is a separate reviewed step.
