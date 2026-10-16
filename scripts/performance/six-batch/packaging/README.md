# Standalone candidate Runtime packaging regression

Run from a checkout with a completed `npm run build:apps`. These runners use the
actual manifest-verified tarball and its exported `composeAppsRuntime`; they do
not rebuild a smaller test bundle or import checkout source/dependencies into
the accepted candidate.

```sh
node --test test/performance/runtime-artifact-isolation.test.ts
node scripts/performance/six-batch/packaging/validate-artifact.mjs . /absolute/evidence/new
```

Every run extracts into a new temporary directory, checks archive/runtime hashes,
rejects archive links and unsafe paths, and refuses ancestor `node_modules`.
The child uses temporary cwd/HOME and an allowlisted environment with no
`NODE_PATH` or `NODE_OPTIONS`. A copied, builtin-only preload rejects module
resolution outside the temporary run and records every loaded file. The final
candidate must load no `node_modules`. Synthetic fixture network requests are
forbidden. Generated databases and evidence do not belong in the checkout.

The regression exercises pricing configuration validation and boundary quotes,
packaging overrides, the actual profit provider, Notes CRUD/conflicts, runtime
identity, catalog, and complete SQLite tables/schema. For deterministic parity,
both probes use the same fixed UTC Date and sequential UUIDs. No response fields
are dropped or rewritten; `performance.now` is not patched.

## Diagnostic comparison to the broken old package

The old package cannot run standalone. The optional diagnostic copies only its
frozen zod 4.3.6 package into that extraction, with all file hashes recorded; it
never changes the old checkout/archive. This must not be described as release
acceptance or an unmodified standalone baseline.

```sh
node scripts/performance/six-batch/packaging/validate-artifact.mjs /old /evidence/old --diagnostic-zod
node scripts/performance/six-batch/packaging/compare-parity.mjs /evidence/old/validation.json /evidence/new/validation.json /evidence/parity.json
```

## Fresh-process startup and HTTP benchmark

Only run in an exclusive window, without builds, tests or other benchmarks:

```sh
node scripts/performance/six-batch/packaging/run-abba.mjs /old /new /evidence/timing --exclusive-window
```

Five ABBA cycles produce 20 fresh actual CLI processes (10 per arm), each with
new extraction, SQLite database, cwd and HOME. A is old-plus-frozen-zod diagnostic;
B is the self-contained final artifact. Startup measures spawn through the real
`apps-runtime-start` log. The first health response is labeled separately.
Three loop warmups are excluded, then 30 rounds exercise health, identity, Notes
reads, pricing quotes and strict invalid pricing saves. Every response is
asserted. Pricing endpoints are separately labeled to expose bundled Zod cost.
Process CPU is whole-child lifecycle CPU, including setup and shutdown; max RSS
is the child high-water mark. Archive and Runtime bytes are also reported.

Both timed arms use the same isolation/resource preload with module-resolution
hooks disabled (`timing-no-resolver-hook`) to avoid extra resolver instrumentation
for the old external package. Strict module guards run in functional acceptance.
Clean environment/cwd/HOME, ancestor checks, artifact hashes, response assertions
and resource capture remain active in timing. The OS file cache is not flushed.
These are local synthetic measurements, not a production performance
claim. The summary uses per-process HTTP medians and cycle-paired changes;
all raw samples and hashes remain inspectable in the output directory.

A functionality-only check of the HTTP harness, without reporting timings:

```sh
node --input-type=module -e "import {measureHttpProcess} from './scripts/performance/six-batch/packaging/http-process.mjs'; const r=await measureHttpProcess('.',{rounds:1,measure:false}); console.log(r.status)"
```

To compare two already self-contained packaging layouts, append
`--both-self-contained` after `--exclusive-window`. This mode provisions no
extra dependency files in either arm, labels the reference `old-self-contained`,
and preserves the same 5-cycle / 20-process protocol. Do not compare medians
from separate timing windows as if they were paired observations.
