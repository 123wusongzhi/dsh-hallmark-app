# Node24.21 完整兼容性补验：c62fdea

日期：2026-10-16 UTC。准确测试公开提交 `c62fdeab1305c6318ddaae34065473529cf89bb6`，tree `fd677ca3b0e51bb923ee8b3ce73a214c3cf0fe32`。

## 实测结论

使用已有 Node24.21.0 与同目录 npm11.19.0，在独立副本中实际完成原默认 prepare、npm test、typecheck。三阶段自然终结，未超时或强制终止。

| 环境 | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24.21.0 / npm11.19.0，本次 | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node24.19.0 / npm11.9.0，既有实测f7ffe7b | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |

**本次仍有两项既存 planner/index 失败；没有新增失败或取消，不能称完整测试全绿。** 原生汇总与逐项解析完全相符。与准确参考提交 `f7ffe7b398e7e1c680850515774fd41081e8be1c` 的 Node24.19 完整记录相比，2263 个名称以及 pass/fail/skip/cancelled/todo 各多重集均相同，新增/移除为空，重名次数保留。

README 第87/282行记录实际开发/测试使用 DSH bundled Node24.21.0。本次覆盖相同 Node 版本的本地 Linux 运行时；它不是已安装 DSH 宿主或用户桌面的端到端验收，也不将24.19或24.21的结果外推至整个24系列。两次环境的 npm 和 SQLite 版本也不同，不作单一组件因果归因或性能比较。

## 保留的失败

1. `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
2. `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

失败分别位于 `test/acceptance/component-display/read-scale.test.ts:46` 与 `test/service/apps-scheduler-scope.test.ts:43`。原断言期待 `/provider_records_irregular/`，实际 irregular 分支仍为 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`，与24.19实测同类。未修改 SQL、索引断言、生产代码或 skip。原38项skip保留，不计pass。

## 输入和执行边界

- 相比已全量验证的f7ffe7b，仅增加3个 `docs/testing/` 报告。packages、test、scripts、component-workspace子树及package.json/三个锁文件逐Git对象匹配；生产packages tree仍为 `584ff522c6fd8506454675f91eea3d95918a67f6`。
- 仅新建一个共享Git对象独立副本，根与两个组件依赖使用既有symlink；未安装依赖、下载运行时、复制归档或删除旧证据。创建前可用 `3673255936` 字节，结束后 `3376271360` 字节。
- Node绝对路径 `/opt/codex/cua_node/bin/node`；npm CLI `/opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js`。同目录已有npm包装器，实际调用仍是指定Node执行指定CLI；未借用24.19的npm11.9.0。
- 这是环境内已有文件，未额外核验为官方发行归档配套；准确来源、包版本、包装器和文件哈希保存在runtime-provenance。Node24.21.0 / npm11.19.0 / ABI137 / SQLite3.53.4，Linux x86_64、glibc2.41。
- 每阶段核验npm lifecycle、PATH子进程及child execPath均为24.21；进程组只读采样未见24.19或其他Node。采样不是每个短寿命进程的穷尽追踪。
- 只对子进程PATH前置 `/opt/codex/cua_node/bin`；`npm_config_offline=true`、`npm_config_update_notifier=false`。NODE_OPTIONS、DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH均未设置，未改变全局环境。
- 原pretest审计通过：308 test files、0 failures；原 `node --test --test-concurrency=1 "test/**/*.test.ts"` 不变。每命令900秒/200MiB、20秒heartbeat、管理会话持续轮询。现有npm对继承http-proxy环境配置的warning被原样保留，不算测试失败。
- 复用锁匹配的已有依赖，未验证全新安装。未运行真实浏览器、Windows/macOS、桌面Host、真实商家/外部Runtime或独立.mjs验收；正负控没有重复或混入full计数。
- 当前f7ffe7b→c62fdea的文档diff检查exit `0`。此前三份上游报告的EOF空行未在本次改动或修复；文档格式与测试结果分开。

| 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | ---: |
| `prepare-data` | `2026-10-16T01:50:52.900074+00:00` | `2026-10-16T01:50:53.561797+00:00` | 0 |
| `full-suite` | `2026-10-16T01:50:54.063389+00:00` | `2026-10-16T01:55:01.952718+00:00` | 1 |
| `typecheck` | `2026-10-16T01:55:02.517645+00:00` | `2026-10-16T01:55:18.669567+00:00` | 0 |

时间用于记录自然终结，不计算跨版本速度变化。

## 哈希与复现

1368个跟踪文件逐Git blob匹配，加生成browserdata共 **1369 输入**，full与typecheck前后完全不变。输入清单SHA256：`e18ba2d6490b3914dacad1191decb26f1a81574464c3c4f1a6a1fd61ed7ad614`。

Node二进制SHA256：`7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`。npm-cli SHA256：`8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7`；npm/package.json SHA256：`09dfcf187178ce1ab3ea6194c80d3ae082ad2a86dc1269ac963f94429e718122`。CLI入口文件很短，单独CLI哈希不能证明整个npm包相同，包版本与实际执行来源同时记录。

| 原始日志 | 字节 | SHA256 |
| --- | ---: | --- |
| `prepare-data` | 365 | `cb6716af4e84d5061b254449631f2b36f5cabbce0dc529eb86ae273052f82f3b` |
| `full-suite` | 263128 | `5d6cfeeefcb395b54b6ad97455ccc8890f2886d5e7e1d02dd5c9754b1a16e115` |
| `typecheck` | 206 | `23afb02649ee72cfe7d75698e9ca5f960f576eea2ad394296469494c68b09991` |

复现须先取得并checkout准确提交、准备匹配的依赖和构建输入。本地已就绪环境不代表验证了全新安装；下面的绝对路径仅对应本次环境。

```sh
git checkout --detach c62fdeab1305c6318ddaae34065473529cf89bb6
NODE=/opt/codex/cua_node/bin/node
NPMCLI=/opt/codex/cua_node/lib/node_modules/npm/bin/npm-cli.js
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" test
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run typecheck
```

实际命令参数数组SHA256定义：UTF-8紧凑JSON，ensure_ascii=False，逗号/冒号分隔，无尾换行。cwd与环境另记。

| 阶段 | 命令数组SHA256 |
| --- | --- |
| `prepare-data` | `2a17582c155d6b869a8ac37ac136bfbda5c51f07e4951e74d24a2269c28cf155` |
| `full-suite` | `4038ec2f3db4efde39b1c2e74bd130ea34b02984adce586673f43584c1fc5df4` |
| `typecheck` | `1364bd33dacb54ce9067fb3c22df5127a0500d809626219782aa18a5c68cba8c` |

## 本地证据索引

验证目录 `dsh-node2421-integrated-c62fdea-20261016/` 的以下文件为本地留存，**未随本文发布，不是公开下载链接**：

- `evidence/full-suite.log`、`typecheck.log`、`prepare-data.log`，及相应start/result/runtime/heartbeat。
- `evidence/`中的 `test-outcomes.json`、`node2419-outcome-comparison.json`：原生汇总、逐名状态及多重集差异；`failure-signals.json`为原始失败文本信号。
- `evidence/`中的 `inputs-*.json`、`source-identity.json`、`source-commit.txt`、`source-diff.patch`、`runtime-provenance.json`、`command-manifest.json`、`diffcheck.json`、`disk-before.json`、`disk-after.json`、`final-qa.log`。
- `run_validation.py`、`build_report.py` 与 `EVIDENCE-SHA256.json` 留存运行方法及证据哈希。

旧24.19/22.18报告保持不变。本次结论仅覆盖上述准确提交和24.21环境。
