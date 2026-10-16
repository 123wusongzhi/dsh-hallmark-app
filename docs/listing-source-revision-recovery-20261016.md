# Listing stale-source read guidance

## Confirmed defect

The listing draft resolver already verified the preparation's store, sale identity,
procurement match and current source revision before rejecting stale source material.
Its provider catch discarded the known source identity and returned only
`LISTING_SOURCE_REVISION_CHANGED`. A model receiving the error had no structured,
scoped read route even though the resolver had already established that evidence.

## Narrow change

Keep the rejection and `retryPolicy: never`. Return a read-only
`hallmark.collection.read` hint for the detected source and only its original
procurement SKU IDs, pinned to the revision just observed. The hint uses a 10-SKU
page limit and an 8,000-byte response budget. Guidance requires the same connection,
reviewing the original sale composition and preparing the original authorized scope
again. It explicitly forbids blind write retries or simply substituting a revision.

Only the typed, verified stale-source error receives this metadata. Wrong-store,
missing-preparation, missing-sale and other failures are unchanged. Scope metadata
is included atomically only within a 3,000-byte bound; otherwise an explicit omission
and required original scope are returned. Caller payloads and stale references are
never copied into the hint.

## Boundary controls

The actual runtime and model-projection regression checks the usable read hint,
no additional business draft or operation, zero network requests, unchanged blockers,
wrong-store and missing-sale isolation, huge caller input/reference omission,
whole-hint omission for oversized verified metadata, and a further source-version
race rejecting the pinned read. Deleting the original SKU correctly leaves the read
blocked; recovery does not broaden to other SKUs. This is a safe next read, not a
promise that the SKU still exists or that the complete workflow can finish.

Only the first detected stale source is reported; the hint is not evidence that all
other rows are current. Missing procurement bindings and warehouse ambiguity remain
legitimate field-level blockers. Plan-version conflict guidance is outside this patch.

## Validation scope

Baseline regression fails on both Node 22.18.0 and 24.21.0 because recovery metadata
is absent. Validation uses the unchanged verified local source corpus; only negative
lifecycle metadata/input controls are varied. No live provider, model, paid service,
merchant mutation, user-computer access or public upload is used.

Final validation passes on both exact runtimes:

- 20/20 focused and related tests (provider revision, listing agent flow, business
  generation isolation, plan pagination, and business model projection).
- TypeScript `--noEmit`.
- Real-test-data audit: PASS, 341 test files, 184 required files, 172 infrastructure
  files; the original 20/20/1 source distribution is unchanged.

The first typecheck attempt lacked the ignored generated browser fixture. Running
`prepare-real-test-data.mjs` rebuilt it locally from the verified corpus; both final
typechecks passed. No fixture, private raw evidence or generated bundle is committed.
This is focused validation, not a claim of a full-suite or live merchant test.
