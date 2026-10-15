# Latest-upstream integration candidate review

发布身份说明：实际运行使用本地候选 `77e5b25e6e730c7edf16de6e1889c8637ededa81`。可公开获取的等内容合并提交为 `5168fd9d2a10acffc804ddea9d783d75a0247a22`，两者 Git tree 均为 `b9db2623ee255e3db56ef77bf5fe736f67603118`，父提交相同。提交元数据不同，源码树完全相同；下文运行记录保留实际候选身份，复现使用公开提交。报告随后另行添加，不属于被测源码输入。文中的本地证据索引未随报告发布，不是公开下载链接。

Candidate: `77e5b25e6e730c7edf16de6e1889c8637ededa81`
Tree: `b9db2623ee255e3db56ef77bf5fe736f67603118`
Parents, in order: `8dbce02860e463b3611745edcd5b69c3fbdc2b44`, `e12e49f5281358d886ec5a76a2e12e514f0cec6d`
Common ancestor: `83cf96d1dc04e1af77f5862f18e697d49b0a60eb`

## Scope and status

This is a local-only candidate for independent validation. No tests, build, deployment, remote push, or branch update were performed by this review. The five conflicts were resolved to exact upstream blobs. The original object-store working tree was left unchanged.

## Conflict resolutions

- README.md and test/real-data/README.md: adopt the latest wording for frozen pnpm installation, default public redacted corpus, and build-before-full-test requirements.
- test/app-hallmark/listing-assets.test.ts: adopt the upstream fixture, preserving all prior lifecycle assertions and adding the immediate AbortSignal check to reject reused expired budgets.
- test/apps-components/display-errors.test.ts: adopt the upstream controlled-clock fixture, adding real setImmediate turns, pending-timer leak detection before reset, and repository-relative paths while keeping the existing polling boundaries.
- test/decisions/decision-review.test.ts: adopt the four-field source/draft/versions/images projection and retained string-type assertion; preserve compatibility with legitimate additional context metadata.

## Preserved work

- #66 expected-rejection assertions remain exactly as 8dbce028.
- #67 independent maxActionPrice=13 assertion remains exactly as 8dbce028.
- #65 helper is the same in both branches; the candidate preserves the prior early fixture-data validation order.
- All 41 existing docs/testing reports are unchanged, including their historical inputs and verification limitations.
- Of 21 paths changed upstream since the common base, 19 are exactly the upstream blobs. The two intentional exceptions are ozon-data (#67 assertion) and snapshot-refresh (prior fixture preparation order).

## Production and repository boundaries

- The complete packages/ and scripts/ trees match e12e49f exactly. Relative to ours, the only production file changed is RuntimeStore store.ts, with exactly two positional-to-explicit-numbered SQLite binding replacements.
- Query text, ordering, indexes, schema, migration, and production validation are not changed by this merge.
- package.json, pnpm-lock.yaml, workflow files, and test discovery rules are unchanged. Existing test-scope classifications remain ours.

## Validation still required

- Run the exact candidate under Node 22.18.0 and Node 24.19.0; prior Linux or upstream Windows results do not apply to this new tree.
- Recheck the changed SDK cleanup, abort-fixture, and metadata-tolerant decision guards with relevant negative controls.
- Recheck all eight previously SQLite-failing files plus schema/migration coverage; do not conflate SQLite binding success with planner/index assertions.
- Before full regression, use the normal documented SDK/build prerequisites and original audit/default serial runner. Keep pass, fail, skip, and cancellation distinct.
- Upstream reports still document a provider unknown/on_sale intermittent failure and a packaged parity-probe NaN fixture failure; those are historical findings, not proof of current-candidate outcomes.

## Exact changed blobs relative to ours

- `README.md`: `eb1b6feb42adb42a1288d657a428f7edd51a2e1c` (SHA-256 `74b02cdb80c0c42796efefad41b0d51efc97fe1041981b703d4d38683c6cfff2`)
- `docs/test-issue-review-55-58-20261016.md`: `670190e240dd14455c462300be0ad95faccb1f63` (SHA-256 `0c853c5a3419599d6469018169a97aa9174101d227057a1a54cd8782e39c0785`)
- `docs/test-issue-review-59-20261016.md`: `eafa4c7e225742ee2616b07ca70f7dea41604540` (SHA-256 `dfc595cd4010374f74e5ec5400671cfe356f6425c08b3739def910d73131d3ab`)
- `docs/test-issue-review-60-62-20261016.md`: `8b7a80b7cfbb5057bbeab25d35b22023a2562b20` (SHA-256 `578616db9ebd6e2486ecbc0c86a30b91ead1961c951eab123ec8257098d50cfa`)
- `docs/test-issue-review-63-20261016.md`: `1045f6505088f157486ab6305e93b79be51c2675` (SHA-256 `9e0d216228fe3d8d7ea2197d3210088150cc054545c5369c15e721ae93d7947d`)
- `docs/test-issue-review-64-20261016.md`: `32b16925a0526197deb526b09ae03b3d4d0a79c8` (SHA-256 `d48dfc13d4759f8fc5a852afd0778f3f1ccd19086b2237ba027fbbca74fbd4d2`)
- `docs/test-issue-review-65-20261016.md`: `d6404666b94ebcb6179fd5ecef9509a7763e9743` (SHA-256 `86b18d2d0fab3eac2ad141ceccf5e4b91be580ee85d26b4c610f06e1419826d6`)
- `packages/app-runtime/src/store.ts`: `863e20c133b41f2ee9b1f9ba34dbb4e0e5d512e1` (SHA-256 `3fc86e82d6f6d0861c461b4920aa6becc051f8fb9dcf67ab2cf41acd53d015a3`)
- `test/acceptance/component-display/read-scale.test.ts`: `9dc4f5a9743b256988f0009bb1d90c611375e6b7` (SHA-256 `71c2cf6fd078f246c606179ab66346f43c8663e1f11c4f1bd3025f4a9f36f21a`)
- `test/app-hallmark/listing-assets.test.ts`: `f06094edc7f800d35d200cc936019bfb909a54f4` (SHA-256 `a2e5b0a20f383b5967b36999f093a97d9cea0ddd2a49b6acabbf306b9bcd25c7`)
- `test/apps-components/display-errors.test.ts`: `ec64ea02ceca0042469d976017b156d218227879` (SHA-256 `f2d79389f0b91707b46078a3c409e76cdf5916e69fd45220585df74745527998`)
- `test/decisions/decision-review.test.ts`: `770722533fdb536c0ff6f9c75db5021ae34dcc70` (SHA-256 `e57f5ac3c6efb1e3cc046e46a800edc9359a7fc69e29144b2da458cd9e01cdde`)
- `test/performance/backend-optimizations.test.ts`: `a4bc651afd73416901a02827b6fe6c5f04f15d04` (SHA-256 `53ed10723dfe33e6cd723ef1d347db6cd8877e475349c5ae00b56010bb779500`)
- `test/performance/display-read-path.test.ts`: `157bc87aa0ea145624bfd4b9064fb579d79bc461` (SHA-256 `31b419a184425983158e1fb15009bc070bd4e9cb830185df6ec330d27e994a39`)
- `test/real-data/README.md`: `13ef5b4de32b0801b602d64ea481be82922f93c2` (SHA-256 `98dccaea8b4b1f93b66764cb2530c7dc4b398d0144cf21ec5a28d3f858e49dfd`)
- `test/service/apps-scheduler-scope.test.ts`: `d4b929158c5674e6bdebc1f697681d6bd5ff5f29` (SHA-256 `b7485809c61c38727a71d9f64e1958c230bccadd1c6d08d31c889559e026c1b4`)

## Static verification

- git diff --check 8dbce028 HEAD
- no unmerged index entries
- five conflict files exactly equal upstream blobs
- 41 historical docs/testing files byte-for-byte preserved
- chunk-progress (#66), ozon-data (#67), and snapshot-refresh (#65) exactly equal ours blobs
- production source exactly equal latest upstream; only store.ts differs from ours
- scripts, package manifests, locks, and workflows unchanged
- candidate and original object-store worktrees clean
