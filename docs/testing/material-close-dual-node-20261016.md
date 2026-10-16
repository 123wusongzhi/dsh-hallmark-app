# Material 关闭保护：双 Node 相关整合回归

日期：2026-10-16 UTC。

## 精确输入与结论

实际测试源码提交：`2d3f67005f7dfee006c2bf942a8154723b26c9a0`。本报告随后单独提交，报告提交本身未重新执行测试；它没有改变已测生产代码或测试。

在同一冻结源码上串行完成 Node24.21.0 与 Node22.18.0 的数据审计、相关组合测试和类型检查，六阶段均自然退出0，未超时或人工中断。

| 运行时 | tests | pass | fail | skip | cancelled | todo | audit | typecheck |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Node24.21.0 / npm11.19.0 | 390 | 388 | 0 | 2 | 0 | 0 | PASS | PASS |
| Node22.18.0 / npm10.9.3 | 390 | 388 | 0 | 2 | 0 | 0 | PASS | PASS |

两版原生汇总与逐用例解析一致，全部名称及结果的多重集相同，保留同名次数。两版审计均覆盖322个测试文件，170个required文件、167个infrastructure文件，来源计数20/20/1，0审计失败。

**这是70个文件的较宽相关回归，不是全仓测试。** 不沿用其他提交的全仓结论证明本提交全仓通过；未纳入的SQLite用例也不能据此称为已修复。

## 实际范围与契约选择

完整纳入以下四目录模式及三个Runtime文件，测试并发固定为1，无用例名称筛选或跳过调整：

- `test/plugin-apps/*.test.ts`
- `test/operations/*.test.ts`
- `test/business-pricing/*.test.ts`
- `test/operations-adapter/*.test.ts`
- `test/apps-runtime/business-settings-http.test.ts`
- `test/apps-runtime/workbench-http.test.ts`
- `test/apps-runtime/workbench.test.ts`

所请求的`test/apps-runtime/workbench-save-drafts.test.ts`在准确提交中不存在。检查后实际存在的相关文件为`workbench-http.test.ts`、`workbench.test.ts`、`workbench-pins-http.test.ts`和`workbench-migration.test.ts`。本轮选用前两者：前者验证Host保存、重载与过期revision拒绝，后者验证显式绑定和变更准入边界；没有猜造测试文件名，也未宣称覆盖不存在的契约。

本轮保留的两个skip为：
- `project skill installer validates without writing, installs both local skills and preserves unrelated skills`
- `real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe`

## 关闭与异步完成的边界

本次回归覆盖已整合的Material关闭保护、迟到保存完成不抢占当前页，以及语义键memo相关交互，并与经营草稿、店铺切换、定价设置和Runtime保存契约一起运行。

**保存永久pending时，关闭和应用切换仍会被锁住。未知结果恢复没有解决，也不在本轮通过结论之内。** 迟到完成不抢页不等于能够从永远不返回的请求恢复；不能把正常终结路径的通过外推为未知结果恢复已完成。

没有执行真实浏览器、已安装桌面Host、Windows/macOS或真实商家端到端验收。相关商家边界使用记录数据及mock/fixture；没有发起真实商家写入。两个skip不是pass。

## 源码与执行完整性

1413个tracked文件在六阶段前后及整轮的SHA256字节清单完全相同。聚合清单SHA256：`63d0435e1eb9b72d7d0376e50554a1123e4b3c9ec8676491defea49f98d30e17`。测试结束时HEAD仍为上述精确提交，tracked差异为空。


复用已有根与两组件依赖，没有安装依赖。每阶段只为对应子进程PATH前置所选Node的bin目录，并使用该Node执行同目录npm CLI；未改变全局环境。运行时元数据同时记录实际`process.execPath`与PATH解析的node路径，两者匹配所选版本。

没有修改生产源码、测试断言或skip。没有另行执行全量构建、source-preview套件或发布操作；选中plugin-apps测试自身需要的隔离构建fixture按原测试正常运行。既有依赖复用不等于验证了干净安装。

各阶段设置600秒边界，全部自然完成：

| Node | 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | --- | ---: |
| 24.21 | audit | 2026-10-16T05:59:30.861031+00:00 | 2026-10-16T05:59:32.296929+00:00 | 0 |
| 24.21 | related | 2026-10-16T05:59:32.370352+00:00 | 2026-10-16T06:01:14.505782+00:00 | 0 |
| 24.21 | typecheck | 2026-10-16T06:01:14.575422+00:00 | 2026-10-16T06:01:29.764256+00:00 | 0 |
| 22.18 | audit | 2026-10-16T06:01:29.947768+00:00 | 2026-10-16T06:01:31.738192+00:00 | 0 |
| 22.18 | related | 2026-10-16T06:01:31.801749+00:00 | 2026-10-16T06:03:20.011944+00:00 | 0 |
| 22.18 | typecheck | 2026-10-16T06:03:20.084675+00:00 | 2026-10-16T06:03:38.142598+00:00 | 0 |

## 复现命令

在准确提交上准备既有匹配依赖和冻结测试数据。每轮将`NODE`与`NPMCLI`设为同一发行目录的绝对路径，并将该Node的bin目录前置到命令PATH。先完成一个版本的三阶段，再切换另一个版本。

```sh
export PATH="$(dirname "$NODE"):$PATH"
"$NODE" scripts/audit-real-test-data.mjs
"$NODE" --test --test-concurrency=1   "test/plugin-apps/*.test.ts"   "test/operations/*.test.ts"   "test/business-pricing/*.test.ts"   "test/operations-adapter/*.test.ts"   test/apps-runtime/business-settings-http.test.ts   test/apps-runtime/workbench-http.test.ts   test/apps-runtime/workbench.test.ts
"$NODE" "$NPMCLI" run typecheck
```

上述命令是明确的相关测试选择，不是默认`npm test`全仓入口。阶段时间仅用于说明执行顺序和终结，不作性能收益对比。

## 证据校验和

完整日志、逐用例结果、70文件清单、运行时身份、阶段退出码和源码SHA256清单均已独立留存。本报告不把本机路径当作公开下载链接，也未将原始本地证据随文发布。

| 证据文件 | 字节数 | SHA256 |
| --- | ---: | --- |
| `node24.21-audit.log` | 291 | `3764606419e133084d3afc0a9afcae8184fb57928164e50e96d28f42981681b2` |
| `node24.21-related.log` | 46989 | `2f209caceaf19c5894aa1d53b7a46430f1c5b74f1d3e363765a1deccfab25fc1` |
| `node24.21-typecheck.log` | 415 | `4a98379ed5c0cfa7fa3a1b6415cb24d94f3b4c777a5197afd2eabdf67ef16736` |
| `node22.18-audit.log` | 291 | `3764606419e133084d3afc0a9afcae8184fb57928164e50e96d28f42981681b2` |
| `node22.18-related.log` | 107495 | `13d4704f5c230e198b4ac45271e6f932e02a18ce200559b5779cef16de7d1788` |
| `node22.18-typecheck.log` | 264 | `93c1d121b889e39a646b1ea45c82bb3dd1746533941dfeaacedf2870ef577db7` |

逐用例结果`node*-outcomes.json`、阶段元数据`metadata.json`、完整性检查`checks.json`及全证据`EVIDENCE-SHA256.json`与原始日志一并留存。
