# Node22：#62超时fixture整合后的完整验证

日期：2026-10-15 UTC。

## 结论与精确输入

**#62整合后的两项取消已在原完整套件中消除；22项既存SQLite失败仍保留，全套尚未通过。**

- 实际验证提交：`6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d`；tree：`cbe0343e946069b4c762e53a05de16fc6c372d6d`。
- 对比提交：`26e235b28769c2ce83c23442fef25d5843cccfe6`，只比较此前同官方Node22实测的用例结果，不作性能比较。
- 本次原默认 `npm test` 自然退出 **1**：**2263 tests = 2203 pass / 22 fail / 38 skip / 0 cancelled / 0 todo**。逐用例分类与Node原生TAP汇总完全一致。
- `npm run typecheck` 自然退出 **0**；离线数据准备exit0，原pretest审计PASS（308 test files，0 audit failures）。
- 仅覆盖上述准确提交；之后新增的测试候选、提交或报告均未纳入本次输入。没有覆盖或改写旧26e235b基线报告。

## 两提交的用例多重集对照

| 同Node22验证 | tests | pass | fail | skip | cancelled |
| --- | ---: | ---: | ---: | ---: | ---: |
| `26e235b` | 2263 | 2201 | 22 | 38 | 2 |
| `6b7a59c` | 2263 | 2203 | 22 | 38 | 0 |

保留重名数量的逐名多重集核对显示：

- 测试名称全集完全相同，没有缩小发现范围。
- **22个fail的名称及重复次数完全相同**，无新增或移除的fail。
- **38个skip的名称及重复次数完全相同**，没有把取消或失败改成skip。
- 唯一状态变化是下列两个原用例由cancel变为pass；其它pass未丢失：
  1. case248：`a call that runs out of its time budget returns per-file retryable results and a plain retry succeeds`
  2. case249：`caller cancellation keeps its ordinary failure instead of the time-budget code`

两项均通过真实abortable loopback HTTP fixture执行，改动说明见[同一提交的#62专项报告](https://github.com/123wusongzhi/dsh-hallmark-app/blob/6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d/docs/testing/node22-listing-timeout-fixture-20261015.md)。本次没有改动任何生产文件、测试断言、skip或运行参数。

## 保留的22项SQLite失败

全部22项仍指向编号SQLite占位符与位置绑定兼容问题，见[之前的完整诊断与最小探针](https://github.com/123wusongzhi/dsh-hallmark-app/blob/6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d/docs/testing/node22-full-compatibility-20261015.md)。当前没有生产修复，也不宣称最低Node版本已完全兼容。

| 原测试文件 | fail数 |
| --- | ---: |
| `test/acceptance/component-display/read-scale.test.ts` | 1 |
| `test/apps-runtime/connection-config.test.ts` | 1 |
| `test/performance/backend-optimizations.test.ts` | 3 |
| `test/performance/display-read-path.test.ts` | 1 |
| `test/plugin-apps/list-performance.test.ts` | 1 |
| `test/service/apps-scheduler-json-parity.test.ts` | 6 |
| `test/service/apps-scheduler-scope.test.ts` | 3 |
| `test/service/apps-scheduler.test.ts` | 6 |

本轮原始日志再次核验：20项失败断言/诊断块直接含 `column index out of range`；另两项view读取在断言前的 `runtime_request_failed` 日志记录同一SQL错误后返回HTTP503。对应原日志11783–11785、12207–12209行，原文片段另行保存。不是新增22个独立缺陷，也没有用旧Node24结果替代本次实测。

`packages/`整棵生产tree在26e235b和6b7a59c之间均为 `b83af221fb620ae172cd143ad1019d9b0c53825d`；package.json、根及组件锁文件、上述8个SQLite失败文件逐Git对象完全相同。两提交间变更仅listing测试和文档；包括中间README修正的完整6文件差异另有记录。

## 执行方式、终结与完整性

- 官方Linux x64 Node **22.18.0**（ABI127、SQLite3.50.2），其自带npm **10.9.3**。
- 原串行npm脚本、pretest审计、默认browser环境及skip保持。仅命令子进程PATH前置官方22bin；环境设置 `npm_config_offline=true`、`npm_config_update_notifier=false`。
- 每阶段npm lifecycle与child `process.execPath`实际确认22bin；full只读采样观测到522个Node进程，均是该22bin。采样不等于完整追踪所有短进程。
- `NODE_OPTIONS`、`DSH_REAL_CORPUS`、`DSH_PREVIEW_BROWSER_PATH`、`CHROME_PATH`均未设置。没有重下载Node、安装依赖、改全局PATH、访问真实商家或绕过浏览器安全。
- Full开始 `2026-10-15T20:48:53.308680+00:00`，结束 `2026-10-15T20:53:20.448228+00:00`；自然exit1，未触发900秒/200MiB上限，无中断或人工kill。
- Typecheck开始 `2026-10-15T20:53:20.811318+00:00`，结束 `2026-10-15T20:53:39.266259+00:00`；自然exit0。
- 1333个tracked文件逐Git blob匹配冻结提交；连同生成browserdata，共1334个输入在full与typecheck前后全部不变。

| 核验项 | SHA256 |
| --- | --- |
| Full原始日志（703097字节） | `7b64d909528ba0e1ea38ccb2707d89557156b1a7fa052e32e7c3307eaea71454` |
| Typecheck原始日志（56字节） | `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4` |
| 1334输入前后清单 | `341a3342ae6e4ccccc6cd3e3eec13b1590ab51d2176a7cfb5c60e1bb8aab6731` |
| 生成browserdata | `8d6a306bc41d78baec56edf9619207bfdf55432d785f544e0b3aef19fd3142b9` |
| 官方Node22归档 | `c1bfeecf1d7404fa74728f9db72e697decbd8119ccc6f5a294d795756dfcfca7` |

## 复现前提与命令

使用干净独立副本，根与两个组件（collected-products、helen-margin）依赖已就绪且匹配锁文件。本次复用了现有依赖，**未验证全新环境安装过程**。N22和NPMCLI必须指向同一已校验的官方发行目录。

```sh
git checkout --detach 6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d
git rev-parse HEAD
N22=/absolute/path/node-v22.18.0-linux-x64/bin/node
NPMCLI=/absolute/path/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js
env PATH="$(dirname "$N22"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$N22" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$N22"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$N22" "$NPMCLI" test
env PATH="$(dirname "$N22"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$N22" "$NPMCLI" run typecheck
```

没有进行Node24全量或速度对比；没有验证Windows/macOS、真实浏览器、已安装桌面Host或独立`.mjs`验收入口。38项skip不是pass，typecheck通过也不是运行时全通过。

## 本地证据索引

以下均为本次独立云端任务的本地留存文件，**没有随此文发布到仓库，不是公开下载链接**：

- `evidence/full-suite.log`、`full-suite-result.json`、`test-outcomes.json`：原完整结果、过程身份及逐项计数。
- `evidence/typecheck.log`、`typecheck-result.json`：类型检查终结证据。
- `evidence/outcome-comparison-to-26e235b.json`：测试名与各状态多重集差异。
- `evidence/source-comparison-to-26e235b.json`：生产tree、锁文件、8个失败文件身份与完整变更列表。
- `evidence/nonpassing-details.json`、`http-sql-cause-excerpts.json`：22fail原始失败块与两项HTTP前置SQL错误。
- `evidence/inputs-before-full-suite.json`、`inputs-after-full-suite.json`、`inputs-after-typecheck.json`及其summary：完整输入哈希。
- `evidence/runtime-*.json`、`full-suite-heartbeat.json`、`runner.log`：每阶段Node/npm/child核验和20秒监控；`EVIDENCE-SHA256.json`为证据文件清单。
