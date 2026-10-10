# Reproducible native-agent gateway proxy

This source-only evidence harness runs the four real AppsHost registered tools through `execute` and `output.render`. It is a platform-native-agent CLI proxy test, **not a deployed DSH model test**. No external LLM/API or real shop is called. Only synthetic Notes and presentation providers are registered.

## Prepare and validate

Requirements: Node >= 22.18, Git, Unix `flock`, and the two source trees with their existing dependencies installed. Use an output directory outside either repository. Do not put the generated database, synthetic assets, full tool responses, or source snapshots in the public repository.

```sh
flock /tmp/hallmark-c72-cpu.lock node scripts/evidence/portable-harness.mjs prepare /tmp/hallmark-blind-run /absolute/baseline-root /absolute/patched-root
flock /tmp/hallmark-c72-cpu.lock node /tmp/hallmark-blind-run/harness.mjs smoke
flock /tmp/hallmark-c72-cpu.lock node /tmp/hallmark-blind-run/harness.mjs summary
```

`prepare OUT BASELINE_ROOT PATCHED_ROOT` refuses any existing OUT, copies the harness into OUT, and freezes Git-tracked plus nonignored untracked source files. `node_modules` is excluded from source copying; existing installed dependencies are linked by reference, under a read-only convention. Frozen source files are copied, never linked to the product tree. Source symlinks escaping the selected tree are rejected. The output includes exact per-file SHA-256 values, aggregate source identities, Git HEAD/status, frozen roots, seed state identities, four opaque gateways, task text, and tool metadata. Every public call verifies frozen source bytes before importing product code and fails if they change. It does not claim OS-enforced isolation or freeze shared third-party dependency bytes.

The baseline used for the original candidate72 comparison was `4e1cd98082a432e2ca89f606927da29eb26ddb67`; supplying different trees establishes a new comparison, not a rerun of the original frozen source identity.

## Blind evaluation

The administrator reads `OUT/admin-manifest.json` and assigns one **new, non-inheriting** native agent per gateway. Give the agent only its `task.txt` contents. Do not reveal the baseline/patched map, source trees, seeds, logs, smoke answers, or other agents' findings. The instructions are identical within each case except for the opaque executable path. The harness does not preselect a sequence of tools or answer the task on the agent's behalf.

Each gateway accepts only:

```sh
/opaque/gateway list-tools
/opaque/gateway call-tool TOOL_NAME 'JSON_OBJECT'
```

The gateway self-wraps its complete Node execution in the same CPU flock. **Do not wrap the gateway in another flock on that file**, because the lock is not reentrant. `list-tools` returns the four actual registered metadata schemas. CLI arguments provide no arbitrary file/source access method. This information boundary primarily depends on evaluation-agent instructions; shared filesystem tools are not technically sandboxed. Record bypasses as protocol violations.

Do not run administrator probes against evaluator gateways. `smoke` uses separate database and log copies and labels them `deterministic-smoke`; evaluator routes are labeled `evaluation`. Repeated smoke runs use new uniquely named directories and do not overwrite logs or reports. To test the shell wrapper separately, prepare another disposable OUT and use its gateways; do not include these calls in agent metrics.

## Cases

A: A real isolated authoring draft is created once through the registered gateway. The agent receives only its attemptId and must determine blockedStage, requiresRebuild, and the legal next action without executing it.

B: A real synthetic Notes mutation executes once. A loopback proxy drops the accepted mutation response and immediate recovery GET/model-result responses. The agent receives only the original invocationId and must recover the original result, traceId, and operationId without replaying the mutation.

The completed seed database is closed and copied byte-for-byte to both arms. Original owner, IDs, note, revision, operation, trace, and dates are identical. During evaluation, a transport guard rejects every non-query capability invocation after real Host execute and before provider execution. Application state is compared before/after each call; query invocation ledgers can naturally accumulate. Only kernel-assigned loopback ports are used and the Host, servers, Runtime and database are closed after each call.

## Evidence and interpretation

`trajectory.jsonl` records step, actorScope, exact rendered response, serialized JSON argument/render UTF-8 bytes, original CLI argument bytes, actual tool time, full local Host lifecycle time, individual HTTP body bytes/time, provider calls, original receipt identity and frozen source identity. HTTP byte counts exclude framing. Lifecycle includes source verification but excludes shell startup, flock queue time and agent reasoning. Metadata listing is a separate action, not a gateway tool execution. `summary` reports gateway-only and metadata bytes separately. It does not calculate tokens, model latency, semantic correctness, or completion rates.

Smoke checks the infrastructure with known inputs. It is not agent behavior. In particular, the A baseline smoke deliberately supplies a known valid input after its describe response fails; that neither guarantees nor denies that a blind agent can infer it. Score real final answers and protocol compliance independently.

The original four-agent observation was: A baseline and patched both completed; B baseline reported its actual blocker; B patched recovered the exact original receipt. The sample does not establish universal model superiority or a general success rate. Preserve the original run's own frozen identities and logs when reporting it. Do not rerun against a changing live tree and silently combine results.

## Publication

Commit only this script, this README and a sanitized aggregate result summary. Do not commit OUT, Notes databases/assets, raw provider responses, local absolute paths, dependency links, or full copied source trees. This harness does not install, deploy, push, merge or call a real business backend.
