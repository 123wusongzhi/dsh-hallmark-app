# 分页结束断言（#75）：双Node完整整合验证

日期：2026-10-16 UTC。准确测试公开提交 `e4eb077288ffd38629a6ea34d8a2b025a6b83358`，tree `ebf14b588d1ee7a844dce49e3c09dbea6e47debb`。

## 实测结果

独立副本中顺序完成Node24.21.0的prepare/full/typecheck，再完成官方Node22.18.0的相同三阶段。全部六阶段自然终结，无超时、强制终止或会话丢失。

| Node | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 24.21.0 | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |
| 22.18.0 | 2263 | 2225 | 0 | 38 | 0 | 0 | 0 | 0 |

原生汇总与逐项解析相符。**Node24.21仍保留两项既有索引断言失败，Node22非skip完整套件通过；没有新增失败或取消，不能称双版本全绿。**

按相同运行时分别比较实际历史全量：

- Node24.21对照 `c62fdeab1305c6318ddaae34065473529cf89bb6` 的24.21结果。
- Node22.18对照 `f7ffe7b398e7e1c680850515774fd41081e8be1c` 的22.18结果。
- 两组各2263个名称及pass/fail/skip/cancelled/todo多重集全部相同，新增/移除均为空，保留重名次数；两版本之间名称全集相同。没有混用24.19结果，本轮未重复24.19，也不作跨版本速度比较。

Node24.21保留的两项失败：

1. `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
2. `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

分别在 `test/acceptance/component-display/read-scale.test.ts:46`、`test/service/apps-scheduler-scope.test.ts:43` 期待 `/provider_records_irregular/`；实际irregular分支仍为 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`。未放宽断言、改SQL或增加skip。Node22同名两项通过。

## 准确输入与范围

相对c62fdea，仅 `test/core/collected-snapshot.test.ts` 和3份报告改变。#75保留原case与六次调用，预存explicitDefaults，加入六页独立ids/total/cursor矩阵及调用参数多重集；并发调用不按完成先后做脆弱断言。独立正负控结果不混入本次full计数。

生产packages整棵tree仍为 `584ff522c6fd8506454675f91eea3d95918a67f6`，package.json、根pnpm锁及两个组件package-lock未变。实际执行中没有修改任何源码、断言或skip。

- Node24.21.0/npm11.19.0/ABI137/SQLite3.53.4：既有 `/opt/codex/cua_node/bin/node` 和 `/opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js`。同目录来源已核实，未宣称独立核验为官方发行归档配套。此Node版本匹配README记录，不等于验收了DSH宿主或用户桌面。
- Node22.18.0/npm10.9.3/ABI127/SQLite3.50.2：复用已核验官方归档 `dsh-node22-clock-validation-20261015/runtime/node-v22.18.0-linux-x64/`，无下载或系统安装。Linux x86_64、glibc2.41。
- 各自Node绝对路径执行npm CLI，仅子进程PATH前置对应bin。每阶段npm lifecycle/child execPath正确；进程组抽样未见错误Node，抽样不是所有短子进程的穷尽追踪。
- 原pretest审计均通过：308 test files/0 failures；原 `--test-concurrency=1`、38skip和浏览器环境保留。`npm_config_offline=true`、`npm_config_update_notifier=false`；NODE_OPTIONS、DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH未设置。
- 每阶段900秒/200MiB、20秒heartbeat与管理会话轮询；24.21全部结束才启动22，无阶段重叠。
- 只复用锁匹配的既有根与两组件依赖symlink；没有全新安装验证。未运行真实浏览器、桌面Host、Windows/macOS、真实商家/外部Runtime或独立.mjs验收；skip不计pass。

容量核验：创建前可用 `3008266240` 字节，上一双版本目录约594MB；本轮用共享Git对象、原依赖symlink。22启动前可用 `2713722880` 字节，结束后 `2407088128` 字节。本轮两运行目录合计 `594358272` 字节。没有删除旧树、旧证据、安装或依赖。

文档格式单列：c62fdea→e4eb077的 `git diff --check` exit2，唯一新增告警 `docs/test-issue-review-74-20261016.md:52: new blank line at EOF.`；保留上游原blob。旧66–68、69–70、71三份报告blob也未变。文档告警不算npm test/typecheck失败。

| 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | ---: |
| 24.21.0 npm test | `2026-10-16T02:24:52.695636+00:00` | `2026-10-16T02:28:55.940648+00:00` | 1 |
| 24.21.0 typecheck | `2026-10-16T02:28:56.435758+00:00` | `2026-10-16T02:29:11.433372+00:00` | 0 |
| 22.18.0 npm test | `2026-10-16T02:29:21.698440+00:00` | `2026-10-16T02:33:36.374708+00:00` | 0 |
| 22.18.0 typecheck | `2026-10-16T02:33:36.735998+00:00` | `2026-10-16T02:33:53.866704+00:00` | 0 |

时间只记录自然终结和顺序，不推断性能变化。

## 输入、日志及命令哈希

每版1371个tracked文件逐Git blob匹配准确提交，加生成browserdata，共 **1372 输入**在full/typecheck前后不变；两版本输入清单相同，SHA256 `46c16f8abf2b39923c466367ea3844133946a10bcfc13e6f362abffbdba1ecf0`。

| 日志 | 字节 | SHA256 |
| --- | ---: | --- |
| 24.21.0 npm test | 263104 | `782c24478bb55f6913b0a3e2e397c3ca8e9310852822f0ec7d16d8129b19ea47` |
| 24.21.0 typecheck | 206 | `23afb02649ee72cfe7d75698e9ca5f960f576eea2ad394296469494c68b09991` |
| 22.18.0 npm test | 613301 | `c92d16a0ecd5a96cf993938c6c21dd63ea85db7932e446bd979e158303f142ba` |
| 22.18.0 typecheck | 56 | `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4` |

Node二进制SHA256：24.21 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`；22.18 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。npm版本、CLI与package.json哈希另见本地runtime-provenance；CLI入口哈希不单独代表整个npm包。

复现先取得并checkout上述准确提交，依赖及构建输入须已就绪。NODE/NPMCLI替换为所测环境的绝对路径；先完整跑24.21三阶段，再跑22.18。本地已就绪环境不代表全新安装可复现性已验证。

```sh
git checkout --detach e4eb077288ffd38629a6ea34d8a2b025a6b83358
# NODE=/absolute/path/to/selected/bin/node
# NPMCLI=/absolute/path/to/selected/lib/node_modules/npm/bin/npm-cli.js
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" test
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run typecheck
```

命令数组哈希定义：UTF-8紧凑JSON argv，ensure_ascii=False、逗号/冒号分隔、无尾换行；cwd及环境另存。

| Node | 阶段 | 命令数组SHA256 |
| --- | --- | --- |
| 24.21.0 | `prepare-data` | `2a17582c155d6b869a8ac37ac136bfbda5c51f07e4951e74d24a2269c28cf155` |
| 24.21.0 | `full-suite` | `4038ec2f3db4efde39b1c2e74bd130ea34b02984adce586673f43584c1fc5df4` |
| 24.21.0 | `typecheck` | `1364bd33dacb54ce9067fb3c22df5127a0500d809626219782aa18a5c68cba8c` |
| 22.18.0 | `prepare-data` | `81dc6de0e9df7ad0fcc65b982a62ce297493c62e684fb2bd29820e467e433c42` |
| 22.18.0 | `full-suite` | `3e4369b56d3cd1482aa0ddbdef9aefad3166ff203be90b2bc0dbacc6869d5371` |
| 22.18.0 | `typecheck` | `a3a25e1de486bfcc9bb67c7da057c2abf750da8ab8d81f0958bd7aa7ff9b6b1f` |

## 本地证据索引

`dsh-dualnode-integrated-e4eb077-20261016/` 内以下证据为本地留存，**未随报告发布，不是公开下载链接**：

- `evidence/node2421/`、`evidence/node22/`：原始full/typecheck/prepare日志、start/result/runtime/heartbeat、前后输入清单、逐名outcomes、historical-outcome-comparison、command-manifest、failure-signals。
- `evidence/`下的 `dual-results.json`、`source-identity.json`、`source-commit.txt`、`source-diff.patch`、`runtime-binaries.json`、`runtime-provenance.json`、`final-qa.log`、三份disk容量记录、`document-whitespace.json`及`diffcheck-current-delta.log`。
- `build_evidence.py`、`write_report.py`、`EVIDENCE-SHA256.json`；两个原独立运行目录保留run_validation.py，runner哈希在command-manifest内。

旧报告保持不变，本报告只覆盖上述准确提交和运行时。
