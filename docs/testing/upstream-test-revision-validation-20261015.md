# Latest upstream oracle validation

发布身份说明：实际运行使用本地候选 `77e5b25e6e730c7edf16de6e1889c8637ededa81`。可公开获取的等内容合并提交为 `5168fd9d2a10acffc804ddea9d783d75a0247a22`，两者 Git tree 均为 `b9db2623ee255e3db56ef77bf5fe736f67603118`，父提交相同。提交元数据不同，源码树完全相同；下文运行记录保留实际候选身份，复现使用公开提交。报告随后另行添加，不属于被测源码输入。文中的本地证据索引未随报告发布，不是公开下载链接。

Candidate: `77e5b25e6e730c7edf16de6e1889c8637ededa81`
Tree: `b9db2623ee255e3db56ef77bf5fe736f67603118`

## Outcome

The three upstream test revisions are accepted by independent Linux Node 22.18.0 / Node 24.19.0 execution. The candidate test bytes were kept intact during all positive-production and natural-production mutation runs, except the explicitly labeled temporary reset-only contrast. No production or test change remains.

| Final unchanged-candidate scope | Node 22.18 | Node 24.19 |
|---|---:|---:|
| Decisions + business operations + adapter | 90/90 pass (7.381 s) | 90/90 pass (7.286 s) |
| Listing assets | 19/19 pass (0.772 s) | 19/19 pass (0.712 s) |
| SDK display errors | 12/12 pass (1.666 s) | 12/12 pass (1.61 s) |
| All apps-components | 211/211 pass (26.055 s) | 211/211 pass (25.791 s) |
| SDK launched outside repository cwd | 12/12 pass (1.516 s) | 12/12 pass (1.958 s) |

All runs have zero skips/cancellations. Initial unchanged-candidate baselines were Decisions 20/20, listing 19/19 and SDK 12/12 on each runtime. Public-corpus preparation and the repository data audit passed before execution.

## Decisions: tolerant projection, exact missing-fact detection

- Adding legal top-level metadata to the actual image protocol serialization kept both complete Decisions files at 20/20 on both versions.
- Removing only draft from that serialization gave 19 pass / exactly 1 assertion failure on both versions. It is the existing host-provided verified image protocol test, and the assertion identifies draft as undefined. Test count and names remain unchanged.
- The production serializer is restored; the four-field source/draft/versions/images projection and string typeof check remain exactly the upstream bytes. No strict whole-object oracle was reinstated.

## Listing assets: native HTTP lifecycle and fresh-call budget

- Eight natural production faults were run on both versions: disabled budget, budget later than the finite HTTP response, omitted publish signal, misclassified budget, ignored caller signal, misclassified caller cancellation, writing failed batches at their real cache keys, and retaining the expired budget for the next call.
- All 16 runs exit 1 via the exact targeted test ERR_ASSERTION/testCodeFailure, with no runner timeout, hook failure, skip or cancellation.
- Expired-budget reuse fails at the plain retry assertion (actual failed, expected ready), confirming the new throwIfAborted fixture boundary closes the earlier false-green loophole.
- Original budget requests logged requests/responses/closed = 1/0/1 on both runtimes. Caller cancellation asserts the same 1/0/1 lifecycle. Existing after hooks verify zero pending responses, zero sockets and a closed server, including fault runs.
- A temporary 300 ms first-file preparation delay passed on both versions, with lifecycle 0/0/0, confirming a legitimate budget expiration before HTTP starts remains allowed. The next ordinary call still succeeds.

## SDK: precise behavior and cleanup sensitivity

- Eight production controls on each runtime: early ready, hidden read, duplicate pushed ready, initial poll at 999 or 1001 ms, pushed poll at 999 or 1001 ms, and removal of both budget.stop calls. All 16 runs produced the expected precise assertion failures.
- The early-ready control fails both legacy and transfer cases. The initial-boundary controls likewise fail both; pushed controls each fail the existing pushed case.
- Removing both real budget.stop calls fails the upstream unmount/host-disposal pending-timer assertion on both runtimes. It is not detected by a process timeout.
- Crucial contrast: with that same production leak and only the new runAll/date guard temporarily removed, both versions pass. This demonstrates that mock.timers.reset alone would hide the lifecycle leak and the final guard prevents that false green.
- Restored source passes all 12 SDK cases and all 211 apps-components cases on both versions; launching the exact SDK test by absolute path from the separate evidence directory also passes 12/12 on both versions.

## Integrity and reproducibility

- 56 actual subprocess runs: 34 expected-red natural-production controls and 22 green baseline, compatibility, contrast or restored runs.
- All 1346 tracked input files match their original SHA-256 at completion; git tracked diff is empty.
- Each run records its exact command, working directory, runtime, timestamps, TAP counts, changed-input hashes and log SHA-256 in runs.json. identity.json binds the run to the candidate tree and runtime binaries; tracked-input-sha256.json and restoration.json verify preservation.
- validate.py is the standalone rerun driver, using already-available official Node 22 and existing Node 24 executables. It restores every temporary source/test mutation in finally. No download, dependency installation, push, issue action or live merchant/model call occurred.
- The first harness launch failed before tests because os.uname has no _asdict on this Python; the local evidence formatter was corrected to list(os.uname). Its original exception is retained in harness-initial-error.log. No product/test code was changed for this tooling error.

## Limits

This is targeted Linux offline/component/loopback-HTTP validation, not the full repository suite, desktop runtime acceptance, Windows, live marketplace or remote CI verification. The separately assigned full-suite runner owns those full-suite results. SDK production components run in isolated React-host child processes, not an actual desktop host.
