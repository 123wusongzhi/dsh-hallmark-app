# Upstream 7af2f48 integration audit

发布身份：实测本地候选为 `915683a48853bc231bb0df8ff7500928efb11dc0`；公开等内容合并提交为 `86a3e67ea2a12b87f64709a098be085839413a45`。两者父提交相同、Git tree 均为 `d864e054763b46689f27e549b5a9fc4e660ae8c0`，仅提交元数据不同。运行记录保留实际身份，复现使用公开提交。报告随后另加，不属于被测输入；本地证据索引未随报告发布。

Candidate: `915683a48853bc231bb0df8ff7500928efb11dc0`
Tree: `d864e054763b46689f27e549b5a9fc4e660ae8c0`
Parents: `5dd862035b2d52d60847392a9fdf9b778da0dd68`, `7af2f484c6ccf833c274ed5f81b04504cb796b57`
Merge base: `e12e49f5281358d886ec5a76a2e12e514f0cec6d`

## Result

All 1354 pre-existing tracked paths retain exactly the same mode and Git object as the latest test branch. The only addition is `docs/test-issue-review-66-68-20261016.md`, copied byte-for-byte from upstream. There are no conflicts, code modifications, test modifications, test-discovery changes, lock changes, or workflow changes in this integration.

## Adoption and preservation

- Upstream adopted #66 malformed-chunk rejection checks, #67 independent promotion maximum-price assertion, and #68 Host startup failure cleanup.
- #66 and #68 complete test-file blobs match the test branch. #67 matches semantically and as an unchanged hunk; ours additionally retains the later #70 missing-logistics assertion.
- Upstream has not yet adopted #69 completed snapshot guard-timer cleanup, #70 independent null logistics fee, or #71 zero reserved operation intent after rejected workbench writes. All three remain byte-for-byte in this candidate.
- All previously committed independent validation reports remain unchanged.

## Verification boundary

- This audit performed only fetching, isolated worktree setup, static comparison, and a local merge commit. No test, build, remote push, or deployment was performed.
- Parent will validate this exact candidate under both Node versions to close final integrated coverage for #70 and #71. Previous test results must retain their original input identities.
- git diff --check returns exit 2 solely for the unchanged upstream report ending with an extra blank line. It has deliberately not been normalized; do not call this check fully passing.

## New historical observations in upstream report

- The upstream Windows Node 22 #67 mutation run first recorded two unrelated failures, normal-empty-orders APP_NOT_FOUND and runtime wiring storesList=[]. They did not repeat in the documented confirming run; cause was not established. These are upstream historical observations, not failures observed on this candidate.
- The upstream report explicitly did not rerun the entire suite. It carries older provider association-state and packaged parity NaN limitations; those are not current-candidate results.

## Exact objects

- #66: `test/performance/chunk-progress-deadline.test.ts` = `7035d5e8dc391db5d7d2ffce50a448eadb0eb294`
- #67_and_70: `test/app-hallmark/ozon-data.test.ts` = `9bee65cb054b4013bf0bae2527a7b8a8ee581276`
- #68: `test/apps-host/long-result-url.test.ts` = `711007ab0dd2e7e72d9eec90de5163d498416acf`
- #69: `test/apps-runtime/snapshot-during-review.test.ts` = `f80f41cf35600741f493cdd2fa2cb9d79f7e3648`
- #71: `test/apps-runtime/workbench.test.ts` = `1e5cb074e863a5a5f4098af7ed2ba39153b648f8`
- Added report: `1765a40963d775be616f7e8df6c56e271ecba677`, SHA-256 `1aaf1d580a2a36e105225fd21473ecebe4e27a86ffc806b455c1c53a50b7a364`
