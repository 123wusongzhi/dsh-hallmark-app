# #70–71整合验证：915683a双Node完整套件

发布身份：实测本地候选为 `915683a48853bc231bb0df8ff7500928efb11dc0`；公开等内容合并提交为 `86a3e67ea2a12b87f64709a098be085839413a45`。两者父提交相同、Git tree 均为 `d864e054763b46689f27e549b5a9fc4e660ae8c0`，仅提交元数据不同。运行记录保留实际身份，复现使用公开提交。报告随后另加，不属于被测输入；本地证据索引未随报告发布。

日期：2026-10-15至2026-10-16 UTC。准确测试提交 `915683a48853bc231bb0df8ff7500928efb11dc0`，tree `d864e054763b46689f27e549b5a9fc4e660ae8c0`。

## 实测结果

在独立副本中先完整执行Node24.19.0，再执行官方Node22.18.0。全部六阶段自然终结，未超时、未强制终止、未丢会话。

| 版本 | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24 | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node22 | 2263 | 2225 | 0 | 38 | 0 | 0 | 0 | 0 |

**没有新失败或取消。Node24仍有原2项planner/index失败，Node22非skip完整套件通过；不能称双版本全绿。** 计数来自原生汇总并与逐项解析交叉核对。

## 准确输入与历史对比

相对已实际完成双版本全量的 `2ce73677dfa70abae74173a70e0e4d0ad1274fc7`，除报告外仅改变：

- `test/app-hallmark/ozon-data.test.ts`：对缺失物流费用显式断言logisticsFee为null（#70）。
- `test/apps-runtime/workbench.test.ts`：拒绝只读工作台mutation后，显式断言operations记录数为0（#71）。

候选父提交为 `5dd862035b2d52d60847392a9fdf9b778da0dd68` 与 `7af2f484c6ccf833c274ed5f81b04504cb796b57`。相对第一个父提交仅合入上游文档，所有源码和测试字节不变；本轮full补齐#70–71的整合覆盖，测试对象仍严格为915683a。

生产packages整棵tree仍为 `584ff522c6fd8506454675f91eea3d95918a67f6`。package.json、根pnpm锁及两个组件package-lock未变。验证过程中没有编辑源码、断言或skip。

**两版本分别对比2ce7367，2263个用例名称及pass/fail/skip/cancelled/todo各多重集全部相同，新增/移除均为空，包含重名次数。** 两版之间的名称全集相同，38skip和0cancel保持。本轮不作跨版本性能A/B，也不把单文件结果外推为全套性能收益。

Node24保留的两项失败为：

1. `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
2. `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

它们仍在read-scale.test.ts第46行、apps-scheduler-scope.test.ts第43行期待 `/provider_records_irregular/`，实际irregular分支为 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。这两项在2ce7367已存在，未在本轮修复。Node22同名两项通过，旧编号SQLite参数绑定错误没有重现。

## 单独保留的文档格式告警

`git diff --check 2ce73677dfa70abae74173a70e0e4d0ad1274fc7 915683a48853bc231bb0df8ff7500928efb11dc0` 实际exit 2，输出 `docs/test-issue-review-66-68-20261016.md:84: new blank line at EOF.`。原文档blob `1765a40963d775be616f7e8df6c56e271ecba677` 与上游7af2f48一致并原样保留。这是文档末尾额外空行告警，不计入npm test失败，也不能宣称diffcheck全绿。

## 执行环境与边界

- Linux6.18.44 x86_64、glibc2.41；Node24.19.0/npm11.9.0/ABI137/SQLite3.53.3；Node22.18.0/npm10.9.3/ABI127/SQLite3.50.2。
- 使用各自Node绝对路径运行同发行目录npm-cli.js，仅对子进程PATH前置对应bin。每阶段核验npm lifecycle及child execPath，进程采样未发现错误Node版本。复用官方22归档，无重下载或系统安装。
- 原pretest审计及 `--test-concurrency=1` 保留；两版prepare与审计均通过，审计308 test files/0 failures。`npm_config_offline=true`、`npm_config_update_notifier=false`；NODE_OPTIONS、DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH均未设置。
- 每命令900秒/200MiB边界、20秒heartbeat、持续管理会话轮询。24 prepare/full/typecheck完全结束后才启动22三阶段，阶段无重叠。
- 复用锁匹配的既有根/两组件依赖，**未验证全新环境安装**。未运行Windows/macOS、真实浏览器、已安装桌面Host、真实商家/外部Runtime或独立.mjs验收；38skip不计pass。

| 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | ---: |
| Node24 npm test | `2026-10-15T23:55:00.629632+00:00` | `2026-10-15T23:59:02.338703+00:00` | 1 |
| Node24 typecheck | `2026-10-15T23:59:02.821333+00:00` | `2026-10-15T23:59:18.395082+00:00` | 0 |
| Node22 npm test | `2026-10-15T23:59:41.270975+00:00` | `2026-10-16T00:04:00.964317+00:00` | 0 |
| Node22 typecheck | `2026-10-16T00:04:01.324890+00:00` | `2026-10-16T00:04:18.180383+00:00` | 0 |

时间用于证明执行顺序和自然终结，不计算性能变化。

## 哈希与复现

两版各1355个tracked文件逐Git blob匹配准确提交，加生成browserdata，共**1356输入**在full与typecheck前后不变。两版输入清单SHA256：`263fa87d9f08c8b215d472ef8ff68de559db06f9596f2917080330b8128fd130`。

| 原始日志 | 字节 | SHA256 |
| --- | ---: | --- |
| Node24 npm test | 263041 | `8251d0451635e5237d8e3cbcfe2c88b699da93907134a9c82384208155fb336c` |
| Node24 typecheck | 155 | `d63003581a92e4041f1f6193ed7e8928dfd725895dbf683fa94febd6bff78ddd` |
| Node22 npm test | 613318 | `9ebcf0afb4e9ca1826b45083a663e52bfacbbf9d910a9d2fce33dbd510bbebd1` |
| Node22 typecheck | 56 | `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4` |

Node二进制SHA256：24 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`；22 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。

先取得并checkout准确提交；依赖须已就绪。NODE与NPMCLI替换为同一发行目录的绝对路径；先完成24三阶段，再执行22三阶段。

```sh
git checkout --detach 86a3e67ea2a12b87f64709a098be085839413a45
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
- `evidence/diffcheck.log` 与 `upstream-document-identity.json` 保存文档原始告警、exit code和上游/候选blob对比。
- `EVIDENCE-SHA256.json` 为报告和本地证据哈希清单。

本报告仅覆盖上述准确提交，旧基线报告保持不变。
