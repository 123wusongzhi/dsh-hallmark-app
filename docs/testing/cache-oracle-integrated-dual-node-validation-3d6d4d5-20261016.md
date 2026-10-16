# #72–73整合验证：3d6d4d5双Node完整套件

日期：2026-10-16 UTC。准确测试提交 `3d6d4d5d970e2b2ed7bd128fd2b5945e4d77f63b`，tree `f5178531b3d7b190875040759ff8186b3eb3c160`。

## 实测结果

在独立副本中先完整执行Node24.19.0，再执行官方Node22.18.0。全部六阶段自然终结，未超时、未强制终止、未丢会话。

| 版本 | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24 | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node22 | 2263 | 2225 | 0 | 38 | 0 | 0 | 0 | 0 |

**没有新失败或取消。Node24仍有原2项planner/index失败，Node22非skip完整套件通过；不能称双版本全绿。** 计数来自原生汇总并与逐项解析交叉核对。

## 准确输入与历史对比

相对已实际完成双版本全量的 `915683a48853bc231bb0df8ff7500928efb11dc0`，除报告外仅改变：

- `test/app-hallmark/compose-cache-regression.test.ts`：首次组合结果warnings独立匹配固定literal，避免只以两次结果互相比对（#72）。
- `test/app-hallmark/provider.test.ts`：可选fixture参数提供不同连接的冻结采集行，在原case中扩展c/d/c读链，断言各自行身份及每连接只读源一次；保留原stale/snapshot行为断言（#73）。

生产packages整棵tree仍为 `584ff522c6fd8506454675f91eea3d95918a67f6`。package.json、根pnpm锁及两个组件package-lock未变。验证过程中没有编辑源码、断言或skip。

**两版本分别对比915683a，2263个用例名称及pass/fail/skip/cancelled/todo各多重集全部相同，新增/移除均为空，包含重名次数。** 两版之间的名称全集相同，38skip和0cancel保持。本轮不作跨版本性能A/B，也不将单文件结果外推为全套性能收益。

Node24保留的两项失败为：

1. `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
2. `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

它们仍在read-scale.test.ts第46行、apps-scheduler-scope.test.ts第43行期待 `/provider_records_irregular/`，实际irregular分支为 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。这两项在915683a已存在，未在本轮修复。Node22同名两项通过，旧编号SQLite参数绑定错误没有重现。

## 单独记录的文档格式告警

本次 `git diff --check 915683a48853bc231bb0df8ff7500928efb11dc0 3d6d4d5d970e2b2ed7bd128fd2b5945e4d77f63b` 实际exit 2，新增文档的EOF空行位于 `docs/test-issue-review-69-70-20261016.md:65` 与 `docs/test-issue-review-71-20261016.md:60`。

基线已存在的 `docs/test-issue-review-66-68-20261016.md:84` EOF空行也保持原blob `1765a40963d775be616f7e8df6c56e271ecba677`；它不在本轮新增diff中。所有文档保持原样，告警与npm test/typecheck分别计数，不能宣称diffcheck全绿。

## 执行环境与边界

- 创建前磁盘可用 7318798336 字节；上一双版本目录合计约594MB，因此继续使用共享Git对象和既有依赖symlink。结束后磁盘可用 6724534272 字节；没有安装依赖、复制大归档或删除用户文件/旧证据。
- Linux6.18.44 x86_64、glibc2.41；Node24.19.0/npm11.9.0/ABI137/SQLite3.53.3；Node22.18.0/npm10.9.3/ABI127/SQLite3.50.2。
- 使用各自Node绝对路径运行同发行目录npm-cli.js，仅对子进程PATH前置对应bin。每阶段核验npm lifecycle及child execPath，进程采样未发现错误Node版本。复用官方22归档，无重下载或系统安装。
- 原pretest审计及 `--test-concurrency=1` 保留；两版prepare与审计均通过，审计308 test files/0 failures。`npm_config_offline=true`、`npm_config_update_notifier=false`；NODE_OPTIONS、DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH均未设置。
- 每命令900秒/200MiB边界、20秒heartbeat、持续管理会话轮询。24 prepare/full/typecheck完全结束后才启动22三阶段，阶段无重叠。
- 复用锁匹配的既有根/两组件依赖，**未验证全新环境安装**。未运行Windows/macOS、真实浏览器、已安装桌面Host、真实商家/外部Runtime或独立.mjs验收；38skip不计pass。

| 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | ---: |
| Node24 npm test | `2026-10-16T00:42:06.498078+00:00` | `2026-10-16T00:46:13.715744+00:00` | 1 |
| Node24 typecheck | `2026-10-16T00:46:14.256868+00:00` | `2026-10-16T00:46:29.265488+00:00` | 0 |
| Node22 npm test | `2026-10-16T00:46:50.432546+00:00` | `2026-10-16T00:51:05.569084+00:00` | 0 |
| Node22 typecheck | `2026-10-16T00:51:05.943706+00:00` | `2026-10-16T00:51:22.741118+00:00` | 0 |

时间用于证明执行顺序和自然终结，不计算性能变化。

## 哈希与复现

两版各1361个tracked文件逐Git blob匹配准确提交，加生成browserdata，共**1362输入**在full与typecheck前后不变。两版输入清单SHA256：`739aba9ebc06d35b4c9ef29be1f7e51f7740b28d5fbdf44824da89d36d22161d`。

| 原始日志 | 字节 | SHA256 |
| --- | ---: | --- |
| Node24 npm test | 263081 | `36dc5d9b057e12fc5758e75b686490440db73dc12927ec63bbb76e16a1861074` |
| Node24 typecheck | 155 | `d63003581a92e4041f1f6193ed7e8928dfd725895dbf683fa94febd6bff78ddd` |
| Node22 npm test | 613310 | `79f17d71ad8905461d9c7553f1aa3f15d74c54b3f20912f6659ad146a8564ef9` |
| Node22 typecheck | 56 | `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4` |

Node二进制SHA256：24 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`；22 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。

先取得并checkout准确提交；依赖须已就绪。NODE与NPMCLI替换为同一发行目录的绝对路径；先完成24三阶段，再执行22三阶段。

```sh
git checkout --detach 3d6d4d5d970e2b2ed7bd128fd2b5945e4d77f63b
# NODE=/absolute/path/to/that-version/bin/node
# NPMCLI=/absolute/path/to/that-version/lib/node_modules/npm/bin/npm-cli.js
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" test
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run typecheck
```

以下为实际命令参数数组的SHA256（UTF-8紧凑JSON，ensure_ascii=False，逗号/冒号分隔，无尾换行）。cwd和环境另存；绝对路径变化会改变数组哈希。

| 版本 | 阶段 | 命令数组SHA256 |
| --- | --- | --- |
| Node24 | `prepare-data` | `8d336a98b7fdc4bd686936fdc1f963e0a5e900d4310cc3313a6e104568862e08` |
| Node24 | `full-suite` | `697e01bd56565aeeb44df04eb52a342dd25d8109fb64e3bc230902fc6699b902` |
| Node24 | `typecheck` | `c59f2ac8e7c1965c3a1949960165f20c9120eb252f619f586e6522d566e140ad` |
| Node22 | `prepare-data` | `81dc6de0e9df7ad0fcc65b982a62ce297493c62e684fb2bd29820e467e433c42` |
| Node22 | `full-suite` | `3e4369b56d3cd1482aa0ddbdef9aefad3166ff203be90b2bc0dbacc6869d5371` |
| Node22 | `typecheck` | `a3a25e1de486bfcc9bb67c7da057c2abf750da8ab8d81f0958bd7aa7ff9b6b1f` |

## 本地证据索引

以下均为本次独立验证目录内本地留存，**未随报告发布到仓库，不是公开下载链接**：

- `evidence/node24/`、`evidence/node22/`：full-suite/typecheck日志、阶段result/runtime、test-outcomes、heartbeat、前后输入清单、command-manifest。
- 各版本 `historical-outcome-comparison.json` 为完整名称/状态多重集；`failure-signals.json` 保留原始失败信号。
- `evidence/dual-results.json`、`source-identity.json`、`source-diff.patch`、`source-commit.txt`、`runtime-binaries.json`、`final-qa.log`。
- `evidence/diffcheck-current-delta.log`、`diffcheck-inherited-warning.log`、`document-whitespace.json` 分列新增与继承的文档告警；`disk-before.json`、`disk-after.json` 保留容量核验。
- `EVIDENCE-SHA256.json` 为报告和本地证据哈希清单。

本报告仅覆盖上述准确提交，旧基线报告保持不变。
