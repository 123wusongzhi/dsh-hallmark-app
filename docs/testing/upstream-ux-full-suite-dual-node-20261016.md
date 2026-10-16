# 上游整合及上架/联动恢复：默认全仓双 Node 补充验证

日期：2026-10-16 UTC。精确 tested SHA：`9384e50ecb9902df2e9c7cd398c20c484457551c`；tree：`f26eeea44146fe2562458e46bce14dc9d9348b05`。

## 实测结果

本轮在同一冻结 checkout 上串行执行两版原样 `npm test`，包括 package 定义的 `pretest` 数据审计与默认 `node --test --test-concurrency=1 "test/**/*.test.ts"`，随后分别运行 `npm run typecheck`。没有筛选测试、增加 skip 或修改断言。

| 实际 Node / npm | tests | pass | fail | skip | cancelled | test exit | typecheck exit |
|---|---:|---:|---:|---:|---:|---:|---:|
| 24.21.0 / 11.19.0 | 2336 | 2296 | 2 | 38 | 0 | 1 | 0 |
| 22.18.0 / 10.9.3 | 2336 | 2298 | 0 | 38 | 0 | 0 | 0 |

两版 pretest audit 均 PASS：324 个测试文件、172 required、167 infrastructure、来源数 20/20/1。原生统计与逐案例解析一致。Node22 非 skip 全部通过；Node24 保留两项失败，不能称双版全绿。

本报告补充[104 文件组合回归](upstream-ux-combination-dual-node-20261016.md)。该组合测试的源码是 `641ecb9`，本轮源码为其后仅文档提交 `9384e50`；结果分别记录，不互相代替。

## 失败逐名与诊断核对

Node24 的失败为：
- C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded
- scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen

没有仅凭数量归为既知失败：逐名称多重集与原 e4eb077、第一批 03aec8b、累计 069817a 三份保留实测证据比较；同时逐项比较 code、actual、expected、operator，全部一致。两项都是 `ERR_ASSERTION`，要求匹配 `/provider_records_irregular/`，实际查询计划 irregular 分支仍使用 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`，operator 为 `match`。完整诊断保留，未修 SQL、放宽索引断言或改为 skip。Node22 对应两项均通过。

## 用例与 skip 差集

以下是逐名称多重集比较，保留重复次数；不以总数相近替代：

| Node | 参考实测 | 新增用例 | 移除用例 | 新增/移除失败 | 新增/移除 skip |
|---|---|---:|---:|---|---|
| 24.21 | e4eb077（2263） | 73 | 0 | 0/0 | 0/0 |
| 24.21 | 03aec8b（2273） | 63 | 0 | 0/0 | 0/0 |
| 24.21 | 069817a（2290） | 46 | 0 | 0/0 | 0/0 |
| 22.18 | e4eb077（2263） | 73 | 0 | 0/0 | 0/0 |
| 22.18 | 03aec8b（2273） | 63 | 0 | 0/0 | 0/0 |
| 22.18 | 069817a（2290） | 46 | 0 | 0/0 | 0/0 |

### 相对最近累计全仓 069817a 的用例变化

**新增**

- business confirmation revalidates resumed plans without silently accepting changed revisions
- failed listing recovery separates correction, decision, due retry and inspection without no-op submissions
- dirty external store intent is visible and follows once after a successful pricing save
- failed pricing save retains dirty editor and pending store without following
- not following an external intent preserves edits and independent selection survives later saves
- external A B A cancels and newest external target wins over a pending save receipt
- discard-and-switch is inline and stale confirmations cannot discard a new edit or new target
- clean cross-connection external store resolves by store identity instead of stale explicit connection
- manual local selection supersedes an in-flight external target and its late read
- new shop and locally entered placeholder credentials are not discarded by external changes
- hidden pending pricing save defers following until active without a new write
- manual reload does not implicitly accept a pending external switch
- cancelled discard and later connection form edits invalidate captured switch callbacks
- pricing save cannot refresh away later shop or placeholder credential edits to follow an intent
- failed external read clearly retains old owner and can cancel or retry without writes
- external target equal to loaded editor cancels a different in-flight local route permanently
- pending external undefined cancels and newer external read wins over the late target
- manual selection matching an in-flight external target starts a new locally owned read
- unsaved shop input explicitly blocks reload instead of falsely clearing a pricing draft
- accepted normalized shop name clears the form guard after connection save
- external routing requires the requested store and a resolved connection before replacing the editor
- a new external intent waits for existing connection form edits and follows after they are restored
- an external cross-connection intent preserves real packaging edits until their original-connection save completes
- unapplied composition packaging inputs defer an external switch until explicitly cancelled
- unapplied bulk packaging inputs defer an external switch until explicitly cancelled
- material close preserves meaningful configuration until explicit discard and invalidates stale confirmation
- material close ignores pristine browsing, effective net-zero edits, cancelled fields and confirmed saves
- pending material save blocks only close, keeps errors and retains edits newer than the saved request
- pending material catalog and preview reads never lock closing or erase dirty content
- new template edits are protected without requiring a saveable source
- hidden material close prompt is visible without stealing the active task, and old target actions expire
- save receipt registration is reconciled against the request without overwriting later user edits
- automatic composition defaults do not make a reverted user edit dirty
- pending save cannot be unloaded by configuring another target or switching app
- restoring an effective default query value is a clean configuration
- registered save is clean and a newly added copy preserves later edits without treating its fresh ID as dirty
- a delayed add receipt cannot dirty a different new template selected while saving
- a material save receipt updates metadata without stealing the settings page or hidden application
- stale material completion cannot navigate a new editor or inject another app board
- material semantic keys only recompute when draft, baseline or source definitions change
- external cross-connection loading disables packaging edits while local cancellation retains rows
- linked read cancellation restores refresh and protects replacement: search-success
- linked read cancellation restores refresh and protects replacement: search-failure
- linked read cancellation restores refresh and protects replacement: page-success
- linked read cancellation restores refresh and protects replacement: page-failure
- externally closed native views return to an active workbench while hidden boards stay paused
**移除或改名后的旧名称**

无。

完整 all/pass/fail/skip/cancelled/todo 差集保留在 outcomes 证据中。38 项 skip 不计为通过。上架候选内的定时器、确认失效与按需指纹修正属于同一未发布候选的评审修正，没有重复计为新 UX 项。

## 冻结、命令与证据

1420 个 tracked 文件逐 Git blob 匹配；两版 test/typecheck 各阶段前后及整轮 SHA-256 字节清单一致。聚合清单 SHA-256：`b738be1f5c39d8bed73d5bc5f9779bd34caffb85f9d879679b512dd9a2f77ea0`。

每版实际 execPath 与子进程 PATH 解析的 Node 一致，npm CLI 来自相同运行时目录，详细绝对路径记录在本地 metadata。没有改全局环境、安装依赖、复制完整新树或清理旧证据。开始可用空间约 1.9GiB；参考先前双版全仓窗口现存产物约 347MB（下限）估计本轮新增 0.35–0.7GB，执行中持续核查空间。默认测试内部必要构建与 fixture 正常运行，无额外独立全量构建。

复现时使用精确提交、已准备的来源数据及匹配依赖，分别指定对应运行时的 NODE、NPMCLI：

```sh
PATH="$(dirname "$NODE"):$PATH" "$NODE" "$NPMCLI" test
PATH="$(dirname "$NODE"):$PATH" "$NODE" "$NPMCLI" run typecheck
```

| Node | 阶段 | 开始 UTC | 结束 UTC | exit |
|---|---|---|---|---:|
| 24.21 | test | 2026-10-16T06:40:52.938960+00:00 | 2026-10-16T06:45:59.379502+00:00 | 1 |
| 24.21 | typecheck | 2026-10-16T06:45:59.681321+00:00 | 2026-10-16T06:46:18.578553+00:00 | 0 |
| 22.18 | test | 2026-10-16T06:46:19.061439+00:00 | 2026-10-16T06:51:44.173581+00:00 | 0 |
| 22.18 | typecheck | 2026-10-16T06:51:44.488768+00:00 | 2026-10-16T06:52:06.210017+00:00 | 0 |

全部阶段自然结束。时间仅记录执行顺序，不作性能提升证明。本报告在测试与最终字节核查完成后才新增，属于 doc-only 补充，不混入 tested SHA。

完整 npm lifecycle 日志、逐案例结果、三组差集、逐失败诊断签名对比、运行时与命令、逐阶段源码清单及证据校验和均保留为本地证据，不是公共下载链接。

| 原始日志 | SHA-256 |
|---|---|
| `node22.18-test.log` | `f7f5203b1bf8b6c9c76f476f78d04ed0e91138dadd3c0ce6d93df6e4da6a2abc` |
| `node22.18-typecheck.log` | `93c1d121b889e39a646b1ea45c82bb3dd1746533941dfeaacedf2870ef577db7` |
| `node24.21-test.log` | `7dee977d4f9a14b4436ee38d5857e7f39163226b34ed01bc6172b80097f6ad07` |
| `node24.21-typecheck.log` | `4a98379ed5c0cfa7fa3a1b6415cb24d94f3b4c777a5197afd2eabdf67ef16736` |

## 仍未覆盖的边界

默认全仓不等于真实浏览器、已安装桌面 Host、Windows/macOS 或真实商家端到端测试。非默认 `.mjs` 入口和上述环境未执行。没有真实商家写入，没有发布；模拟写入限于测试边界。素材保存永久 pending 的关闭/应用切换锁定边界仍在，不能声称未知结果恢复已解决。既有依赖复用也不证明干净环境安装成功。
