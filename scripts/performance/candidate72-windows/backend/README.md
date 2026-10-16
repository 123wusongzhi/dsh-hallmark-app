# candidate72 Windows backend validation

The harnesses compare actual baseline and candidate source trees. They derive from the archived candidate72 collection/data-transfer reproduction harnesses, with Windows-safe file-URL imports, explicit roots and output destinations, and a sequential Node runner. No dependency installation or shared dependency changes are required.

Run from any directory using the same Node version for both arms. The original Windows validation used Node 24.12. Replace `BASE`, `CANDIDATE` and `OUT` with absolute paths:

```text
node CANDIDATE/scripts/performance/candidate72-windows/backend/run.mjs --baseline=BASE --candidate=CANDIDATE --output=OUT/backend-parity --mode=parity
```

Once other activity has stopped, run `--mode=timing` with a separate output directory. Defaults are `--rounds=5 --iterations=15 --warmup=5 --collection-sizes=tiny,medium --transfer-shapes=inline1k,chunk333k,chunk2m`. A list can be empty to run only the other family. Every round runs baseline/candidate/candidate/baseline in separate, sequential child processes. Do not run timing concurrently with another benchmark/build/test.

Outputs: `parity-summary.json` requires exact equality of collection responses, model projections, source calls, Runtime events, SQL calls/parameters and database rows. It also covers duplicate offers/summaries/IDs, malformed persisted records, post-request edits, refresh failure, and an external SQLite commit observed between status reads. Transfer parity uses actual DataTransfers and production readers for small/333 KB/2.1 MB data, changed/unchanged metadata, Unicode boundaries, caller mutation, seven tampering failures and overlapping reads.

`timing-summary.json` records source hashes, toolchain, per-process medians and per-round ABBA ratios. Raw process samples remain beside it. A ratio below one is faster. Collection timing measures a real in-process Runtime read; transfer timing measures three reads (initial, unchanged metadata, changed content) with exact result/protocol checks outside timed sections. The in-memory transfer bridge does not include browser scheduling or a real network. These are workload-specific results, not whole-application speed or deployed Windows UI measurements.

The production changes deliberately exclude interface additions, oversized-result handling, retry behavior and other archive changes.
