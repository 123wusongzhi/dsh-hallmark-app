# 两项测试时钟优化的完整串行对比

2026-10-15 UTC；Linux x86_64，Node v24.19.0，npm 11.9.0。

## 结论

同一环境顺序执行共同基线与仅加入两项受控时钟优化的候选，两次均为 **2263 tests：2223 pass、2 fail、38 skipped、0 cancelled、0 todo**，自然退出码均为 1。pass、fail、skip 名称多集完全相同；skip 还保留日志原因和重复计数，新增/移除均为 0。

两项修改都只改变测试的等待方式，未修改生产实现、删除测试/断言或新增 skip。对应问题为 [SDK preparing 轮询测试等待 #55](https://github.com/123wusongzhi/dsh-hallmark-app/issues/55) 与 [native 候选等待点击测试时钟 #56](https://github.com/123wusongzhi/dsh-hallmark-app/issues/56)。原有两项 SQLite 查询计划失败仍保留，因此不是全仓全绿或生产性能修复。

本次完整单对墙钟 **276.084s → 254.896s**，观测少 **21.188s**。只有一次顺序前后对比，不能据此宣称稳定的全仓提速比例；下方局部重复测量另列，不与完整回归样本混合。

## 精确输入与执行方式

共同基线合并 `8947e821476bcca376a680b263e4f2da2f775911` 与上游 `83cf96d1dc04e1af77f5862f18e697d49b0a60eb`，保留双方更强断言及独立复核后的有界 locator 清理。冲突处理和新 harness 故障验证见同批 `merge-validation-83cf-20261015.md`。

- 基线实际被测 Git tree：`d62c32106e378b347b487e0b38bdffe324ca222e`
- 候选实际被测 Git tree：`1fa88e8ed6a63a2a1c2ee44ae7471abfa43ac962`
- 两个独立工作树的 HEAD 都仍为 `8947e821476bcca376a680b263e4f2da2f775911`；被测的 tracked 工作字节与上述已暂存 tree 完全一致。这里是内容树身份，不能误写成“对 8947 原提交重新完整执行”。
- 两棵被测树逐文件仅以下两项不同：`test/apps-components/display-errors.test.ts`、`test/plugin-apps/native-candidate-surface.test.ts`。没有新增或移除输入文件。
- SDK 候选 SHA-256：`4550d030b0aaad753a4f66ea2dff2e3efa8d57b26a2a6382fdcc7285a60ae7b5`
- native 候选 SHA-256：`fa7a1a8e5a6ad03c2da18e8d3b1063b7f13add355b72b3ad35b121a646b3dd2e`
- `packages/`、`component-workspace/`、`templates/` 相对 8947 零差异；scope 分类保持共同基线字节。

准确命令为 `npm --offline test`，只显式设置 `npm_config_offline=true`、`npm_config_update_notifier=false`。未传 notifier CLI 参数。仓库脚本保持 `node --test --test-concurrency=1 "test/**/*.test.ts"`，两轮顺序执行，未并发测速、未覆盖浏览器环境、skip 条件或测试配置。

只复用已安装的 root、collected-products、helen-margin 三处依赖，没有重新安装。依赖链接为本地 untracked 输入，未进入 Git index。浏览器数据事先由默认公开脱敏快照离线重建；DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH、NODE_OPTIONS 在本次环境中均未设置。该环境事实不能替代 Windows、真实浏览器、真实平台或打包产物验收。

此为本地云端执行证据，不声称 GitHub CI 通过；待发布提交的 CI 须按发布后的精确 SHA 另行核验。

## 完整执行结果

- 基线：2026-10-15T18:58:29.513786+00:00 至 2026-10-15T19:03:05.598263+00:00；墙钟 276.084s，Node duration 274542.723893ms。
- 候选：2026-10-15T19:03:05.946461+00:00 至 2026-10-15T19:07:20.843735+00:00；墙钟 254.896s，Node duration 253343.073179ms。
- 各自 900s / 200MiB 的超时和日志保护均未触发。日志完整保留，没有截断、静默重跑或修改生产 SQL 来制造通过。
- 两次 npm pretest 真实测试数据审计均 PASS：308 test files、162 required、161 infrastructure；required 的 162 项包含 147 个测试文件和 15 个辅助文件；147 个 required 测试加 161 个 infrastructure 测试恰为 308 个测试文件，两类测试没有重叠。
- 最终候选另跑 `node node_modules/typescript/bin/tsc --noEmit`，退出码 0，16.218s。该检查发生在两个 full 之后，未与任何完整测速重叠。

保留的失败：

1. `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
2. `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

两者均仍在 `assert.match` 期待 `/provider_records_irregular/` 时失败，实际计划包含 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。位置仍分别为 `test/acceptance/component-display/read-scale.test.ts:46:231` 与 `test/service/apps-scheduler-scope.test.ts:43:440`；完整错误与查询计划保留在原日志。没有将这两项改为 skip、删断言或吞错误。

## 输入完整性

每轮对全部 1322 tracked 文件及离线生成 `test/real-data/browser-data.ts` 共 1323 项生成按路径排序的 SHA-256 JSON 清单。两轮各自的 before/after 清单字节完全相同；两份 before 清单之间也只有批准的两个测试文件不同。

- 基线输入清单前后 SHA-256：`f9678e1e7863e60c48fe5419a69e5c218c96dd23a2d6188b8cb08c9b3729c27d`
- 候选输入清单前后 SHA-256：`b63bcbef6c0e2ca7b7678cee8614e38889bde4ad260b990d364e1bed03505989`
- 两轮 generated browser-data SHA-256 均为 `8d6a306bc41d78baec56edf9619207bfdf55432d785f544e0b3aef19fd3142b9`
- 基线完整日志：262991 bytes；SHA-256 `4a0e0814c926338d244679e537317e3f4f17195184317db54850bcfe76cf3d80`
- 候选完整日志：262999 bytes；SHA-256 `12b5a0aa76f80230938f996359a0866fdabca85fc02d40953276aadb37d46a65`

完整结果、pass/fail/skip 名称多集、逐用例耗时、清单和运行器保留在本地验证材料。解析只取 Node summary 之前的结果，避免把末尾 failing-tests 重复摘要当作第二次失败。

报告在两轮结束后写入被测工作树之外。后续发布若仅追加报告文档，提交/tree 会变化；本次完整运行严格绑定以上两个被测 tree，不声称对后补文档的提交再次执行全套。

## 独立局部重复测量与覆盖

这些是各候选的独立验证，基于 8947，不是本次单对 full 的重复样本。

- SDK preparing：五对交替运行，原文件墙钟中位数 8.210s、候选 1.552s（减少 81.09%）；12 个测试与原 54 个 assert 位点全部保留，增加 9 个。完整 apps-components 30 文件 211/211，零 skip。真实 useApps/ComponentHost/apps-client/DataTransfers 执行链、消息等价性、999/1000ms 边界、ready/hidden/去重负控及异常时钟恢复已独立验证。详见 #55 与同批 SDK 验证报告。
- native：最终 v3 两对交替运行，按名称筛选的 wait-click 单项命令墙钟中位数 16.860s、候选 0.949s；原业务断言保留，新增排空期限、时钟推进量和恢复检查。5 次普通运行及 native+handshake 32/32；三个业务负控原版各一次、新版各五次均在对应业务断言失败。仅测试进程使用 Node MockTimers；真实 React 生产组件、实际 loopback HTTP 与 fetch/json 传递仍在链内。详见 #56；早期 v1/v2 时序错误候选未用于本轮。

上述局部比例不能外推为生产响应、浏览器、桌面或整体平台性能收益。本次只实测 Node v24.19.0，未验证 Node 22.18 最低版本或 fresh install。

## 38 项未改变的 skip 名称与原因

以下去除纯耗时，保留名称、日志原因和多重性；两轮逐项完全一致。

1. HTTP authoring validates real receipt schemas, authorizes candidate document, commits once and keeps fixed historical publications # SKIP
2. HTTP display opens the previewed archive, rejects invalid grants atomically and reopens after an inspectable actual-load error # SKIP
3. ManageRuntime defaults off and explicit false returns no manifest and does not validate or write paths # SKIP
4. ValidateOnly validates inputs but returns no manifest and writes no files # SKIP
5. Windows wrapper preserves the build command (custom-default) # SKIP
6. Windows wrapper preserves the build command (custom-explicit) # SKIP
7. Windows wrapper preserves the build command (legacy-internals) # SKIP
8. Windows wrapper preserves the build command (legacy-standard) # SKIP
9. Windows wrapper preserves the build command (multiple-node-fallback) # SKIP
10. actual frozen-v2 browser preview records interactions and PNGs at 420 and 1040; missing or illegal plans never PASS # SKIP
11. actual packaged Runtime validates pricing and packaging without checkout dependencies # Run npm run build:apps to produce the candidate archive before this packaging regression.
12. check resumes lost registration responses without rebuilding or repeating preview and never publishes # SKIP
13. constructor refuses absent required fake files without reading credentials or creating a manifest # SKIP
14. constructor rejects non-node executables, non-loopback URLs, invalid ports, and credential environment injection # SKIP
15. each missing required parameter skips generation and persistence rather than emitting a partial manifest # SKIP
16. explicit build retry creates a new runtime generation and reexecutes once; resume keeps immutable failure # SKIP
17. explicit preview retry preserves old evidence, reuses signed build and reruns the browser; draft cannot register or PASS # SKIP
18. extracted constructor rejects backslash-root-relative paths for every launch path input without writing # SKIP
19. extracted constructor rejects drive-relative paths for every launch path input without writing # SKIP
20. extracted constructor rejects relative paths for every launch path input without writing # SKIP
21. extracted constructor rejects slash-root-relative paths for every launch path input without writing # SKIP
22. extracted installer functions accept absolute Windows backslash paths and write validator-compatible BOM-less UTF-8 # SKIP
23. extracted installer functions accept absolute Windows slash paths and write validator-compatible BOM-less UTF-8 # SKIP
24. failed build and incomplete preview are recorded and lost responses resume original reports # SKIP
25. formal browser performance gate rejects a slow frozen build, accepts its repaired build, and retains local image errors # SKIP
26. formal runner exercises paged capability fixtures and does not pass a caught selection failure # SKIP
27. generated product templates pass the formal two-viewport performance gate with real SDK and local paging # SKIP
28. overwrite backs up the exact prior manifest and leaves it untouched for disabled or validation-only calls # SKIP
29. packed check CLI completes four steps and repeats without new execution # SKIP
30. prepared product template checks its single plan, pages without attachments and resumes after refresh # SKIP
31. project skill installer validates without writing, installs both local skills and preserves unrelated skills # SKIP
32. real Chrome formal previews reassemble a 333 KB binding at 420 and 1040 while the frozen old SDK fails the unchanged message limit # SKIP
33. real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe # SKIP
34. runners automatically register real build and preview receipts and persist diagnostics # SKIP
35. slow business work completes once before the next viewport; timeout stops later work # SKIP
36. unregistered changed preview plan reruns only preview while build is reused # SKIP
37. writer independently honors opt-in, ValidateOnly, and null manifest guards # SKIP
38. writer refuses a missing installed Runtime entry before backup or persistence # SKIP
