# 冻结整合提交 14558f5 的完整回归

精确被测提交：`14558f5b3996113e4d8a11451e341e94165c3d40`；Git tree：`f7c62cd5a71b012f47d609f9c712b7b1eca14a3e`。双父为 `2bb5e1dafe0f6265aafbaf8bd93ccab99e07892e` 与 `deaa494d111ad4afeece14c1540c7d5ca4839339`。

## 完整结果

Linux、Node `v24.19.0`。2026-10-15 17:38:16–17:42:53 UTC，在独立工作树运行 `npm --offline test`，环境设置 `npm_config_offline=true`、`npm_config_update_notifier=false`。使用仓库默认 `--test-concurrency=1`，未附加 notifier CLI 参数，未覆盖浏览器环境、skip 条件或测试配置。依赖只复用既有本地安装，没有重新安装。

- 2261 tests：2221 pass、2 fail、38 skipped、0 cancelled、0 todo。
- 自然结束，退出码 1；墙钟 276.635 秒，Node 报告 275124.284939 毫秒。900 秒与 200 MiB 日志保护均未触发。
- npm pretest 数据审计 PASS：307 文件、162 required、160 infrastructure；分类可重叠，不能相加当作文件总数。
- 这不是全套通过：两个既有 SQLite 计划失败原样保留，没有改生产 SQL、删断言、吞失败或增加 skip。

## 相对最近 6c67 完整回归

[6c67 原报告](full-regression-6c67-20261015.md) 的 2258 tests / 2218 pass / 2 fail / 38 skipped，本轮变为 2261 / 2221 / 2 / 38。原日志 SHA-256 已复核为 `83043d7025056278f8ad924f257d206d6edfa7d44ac6e7287c28764747c8a61c`。

将两份完整日志的 skip 行去除纯耗时字段后，按“测试名称 + 日志中给出的原因”做多集比较：38 对 38 完全一致，新增 0、移除 0，重复计数也一致。保留 Windows、真实浏览器及缺少打包产物的既有条件跳过，具体名称见文末。失败测试名称也仍是原有两项。

新增加的三条测试均在此次完整运行中实际通过：

1. [#48](https://github.com/123wusongzhi/dsh-hallmark-app/issues/48)，`test/authoring/failed-build-http-recovery.test.ts`：`failed check recovers a committed HTTP receipt after the response is lost without rerunning the command`。
2. [#49](https://github.com/123wusongzhi/dsh-hallmark-app/issues/49)，`test/apps-host/explicit-intent-retry.test.ts`：`native Host preserves a stable intent across explicit attempts after real HTTP response loss`。
3. [#50](https://github.com/123wusongzhi/dsh-hallmark-app/issues/50)，`test/apps-host/collection-column-fidelity.test.ts`：`recorded SKU columns retain their named values and null slots through Provider, Runtime and Host reads`。

另有既有取消恢复测试的名称从 `allows the next Host read` 改为 `permits the next Host read`，本轮仍通过；此名称调整不算新增测试。两份 pass 名称多集的差异为上述三项新增加此一处改名，不能误报成新增四项。

本批收紧的两项原用例也在全套中通过：

- [#51 CSV 负例](https://github.com/123wusongzhi/dsh-hallmark-app/issues/51)，`test/ozon-business/order-weights.test.ts`：`parser excludes mixed, multiple, cancelled and invalid evidence and never guesses changed columns`。有效完整列对照及仅缺闭合引号的精确错误均包含在该用例内。
- [#30 AppsLibrary ready 补充](https://github.com/123wusongzhi/dsh-hallmark-app/issues/30#issuecomment-6198343353)，`test/plugin-apps/native-workspace.test.ts`：`Apps local library and workspace use existing shared Runtime actions, pin history/CAS, keep multiple views and never submit native text`。实际目录 ready 等待、原 workspace 等待和全部 60 条断言保留。

## 保留的失败与精确位置

1. 用例声明 `test/acceptance/component-display/read-scale.test.ts:29:1`，失败断言 `:46:231`：`C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`。
2. 用例声明 `test/service/apps-scheduler-scope.test.ts:40:1`，失败断言 `:43:440`：`scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`。

两者均为 `AssertionError [ERR_ASSERTION]`，`assert.match` 期待 `/provider_records_irregular/`，实际查询计划包含 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。完整实际计划与堆栈保留在本地原始日志，未截断成通过或跳过。未将另行审查中的 SQLite 候选写入被测生产树。

## 输入完整性与验证边界

- 完整日志 261691 字节，SHA-256：`6c81629a0ce72afb80859716ce0a7f06eebd7ebf4fde544904798429fafcacf4`。
- 对全部 1313 个 tracked 文件及离线生成的 `test/real-data/browser-data.ts`，共 1314 个输入文件，运行前后分别生成按路径排序的 SHA-256 JSON 清单。清单字节 SHA-256 前后均为 `d8e5463630884fb298b2ef4519901d53645a254ff62c635c4d085731bbfa1dd9`；内容完全相同，HEAD 未变，工作树均干净。
- `packages/`、`component-workspace/`、`templates/` 对两个父提交均无差异。对第一父提交的全部改动只在测试、分类和文档。第一父的 318 个历史文档及第二父的 303 个历史文档逐字节保留，默认公开脱敏语料不变。
- 冻结前的 18 文件串行专项 41/41，0 fail / skip / cancelled；数据审计与 TypeScript noEmit 通过。其结果只作额外定向证据，不与全套计数相加。
- 该报告在执行后单独生成，未改动被测树。若发布提交仅在该输入之上增加本报告，应明确 Git 提交/tree 因文档而不同；完整测试结果绑定上述 14558f5，不能表述为对后续提交重新完整执行。
- 本轮未追入后续上游更新，也未以 Linux 结果替代 Windows、真实浏览器、打包产物、线上模型或真实商家验收。完整日志保留供复核，不要求公开上传日志或运行产物。

## 38 项原有 skip 名称与日志原因

以下去除耗时，保留原始日志的名称及其给出的原因；单独 `# SKIP` 表示该行未提供更细原因。与 6c67 多集逐项一致。

1. extracted installer functions accept absolute Windows backslash paths and write validator-compatible BOM-less UTF-8 # SKIP
2. extracted installer functions accept absolute Windows slash paths and write validator-compatible BOM-less UTF-8 # SKIP
3. extracted constructor rejects relative paths for every launch path input without writing # SKIP
4. extracted constructor rejects drive-relative paths for every launch path input without writing # SKIP
5. extracted constructor rejects backslash-root-relative paths for every launch path input without writing # SKIP
6. extracted constructor rejects slash-root-relative paths for every launch path input without writing # SKIP
7. ManageRuntime defaults off and explicit false returns no manifest and does not validate or write paths # SKIP
8. ValidateOnly validates inputs but returns no manifest and writes no files # SKIP
9. each missing required parameter skips generation and persistence rather than emitting a partial manifest # SKIP
10. writer independently honors opt-in, ValidateOnly, and null manifest guards # SKIP
11. overwrite backs up the exact prior manifest and leaves it untouched for disabled or validation-only calls # SKIP
12. writer refuses a missing installed Runtime entry before backup or persistence # SKIP
13. constructor refuses absent required fake files without reading credentials or creating a manifest # SKIP
14. constructor rejects non-node executables, non-loopback URLs, invalid ports, and credential environment injection # SKIP
15. Windows wrapper preserves the build command (custom-default) # SKIP
16. Windows wrapper preserves the build command (custom-explicit) # SKIP
17. Windows wrapper preserves the build command (legacy-standard) # SKIP
18. Windows wrapper preserves the build command (legacy-internals) # SKIP
19. Windows wrapper preserves the build command (multiple-node-fallback) # SKIP
20. generated product templates pass the formal two-viewport performance gate with real SDK and local paging # SKIP
21. runners automatically register real build and preview receipts and persist diagnostics # SKIP
22. HTTP authoring validates real receipt schemas, authorizes candidate document, commits once and keeps fixed historical publications # SKIP
23. HTTP display opens the previewed archive, rejects invalid grants atomically and reopens after an inspectable actual-load error # SKIP
24. check resumes lost registration responses without rebuilding or repeating preview and never publishes # SKIP
25. unregistered changed preview plan reruns only preview while build is reused # SKIP
26. packed check CLI completes four steps and repeats without new execution # SKIP
27. prepared product template checks its single plan, pages without attachments and resumes after refresh # SKIP
28. failed build and incomplete preview are recorded and lost responses resume original reports # SKIP
29. formal browser performance gate rejects a slow frozen build, accepts its repaired build, and retains local image errors # SKIP
30. formal runner exercises paged capability fixtures and does not pass a caught selection failure # SKIP
31. actual frozen-v2 browser preview records interactions and PNGs at 420 and 1040; missing or illegal plans never PASS # SKIP
32. slow business work completes once before the next viewport; timeout stops later work # SKIP
33. explicit build retry creates a new runtime generation and reexecutes once; resume keeps immutable failure # SKIP
34. explicit preview retry preserves old evidence, reuses signed build and reruns the browser; draft cannot register or PASS # SKIP
35. real Chrome formal previews reassemble a 333 KB binding at 420 and 1040 while the frozen old SDK fails the unchanged message limit # SKIP
36. actual packaged Runtime validates pricing and packaging without checkout dependencies # Run npm run build:apps to produce the candidate archive before this packaging regression.
37. project skill installer validates without writing, installs both local skills and preserves unrelated skills # SKIP
38. real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe # SKIP
