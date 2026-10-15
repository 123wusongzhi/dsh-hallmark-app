# 77e5b25：融合上游SQLite兼容修复后的双Node全量验证

发布身份说明：实际运行使用本地候选 `77e5b25e6e730c7edf16de6e1889c8637ededa81`。可公开获取的等内容合并提交为 `5168fd9d2a10acffc804ddea9d783d75a0247a22`，两者 Git tree 均为 `b9db2623ee255e3db56ef77bf5fe736f67603118`，父提交相同。提交元数据不同，源码树完全相同；下文运行记录保留实际候选身份，复现使用公开提交。报告随后另行添加，不属于被测源码输入。文中的本地证据索引未随报告发布，不是公开下载链接。

日期：2026-10-15 UTC。

## 结论

准确测试提交 `77e5b25e6e730c7edf16de6e1889c8637ededa81`，tree `b9db2623ee255e3db56ef77bf5fe736f67603118`。父提交为 `8dbce02860e463b3611745edcd5b69c3fbdc2b44` 与 `e12e49f5281358d886ec5a76a2e12e514f0cec6d`；本次在该本地候选推送前验证，不将尚未发生的远端发布视为证据。

两个独立副本依次执行Node24.19.0、Node22.18.0的原默认npm test与typecheck。均自然终结，没有超时、强制终止或会话丢失。

| 版本 | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24 | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node22 | 2263 | 2225 | 0 | 38 | 0 | 0 | 0 | 0 |

**Node22原22项编号参数绑定失败转为pass；Node24原2项query-plan/index失败仍保留。** 两版本均未新增失败或取消。不能将此结果概括为双版本全绿，也不能把Node24失败描述为已修复。

## 与9140337的逐名、状态多重集对比

对比对象是同环境此前实际完整测试过的准确提交 `9140337fd660ce3be769e80d775021494cc16c3d`，不是推测计数。比较保留同名用例的重复次数，并将原生汇总与解析记录交叉核对。

- Node24：2263个名称及pass/fail/skip/cancelled/todo各多重集完全相同，仍2223pass、2fail、38skip、0cancel。
- Node22：2263个名称多重集完全相同；恰好22项由fail转pass，其他名称/状态次数不变，38skip未变，0cancel。
- 两版本本轮用例名称全集相同。没有通过删用例、加skip或放宽断言来改变本次运行结果。测试内容确有上游改写，其独立相关/负控评审属于另份证据，不与本轮full混算。

## 改善映射与剩余失败

相对9140337，唯一生产文件差异是 `packages/app-runtime/src/store.ts`：

1. `providerRecordScopeCandidates`（第143行）将编号参数位置绑定改为显式对象 `{'?1':appId,'?2':connectionId,'?3':namespace}`。
2. `viewRevisionsForBuild`（第147行）同样采用具名对象，保留可选build条件，并区分空字符串build与未提供build。

这两处生产改动来自上游 `e12e49f5281358d886ec5a76a2e12e514f0cec6d`。候选与上游的store.ts blob均为 `863e20c133b41f2ee9b1f9ba34dbb4e0e5d512e1`，候选相对该上游没有任何packages差异；验证过程没有自行改生产。

直接执行EXPLAIN的 `test/acceptance/component-display/read-scale.test.ts`、`test/performance/display-read-path.test.ts`、`test/service/apps-scheduler-scope.test.ts` 同步采用具名对象。原query-plan/index断言仍保留。backend-optimizations测试新增literal参数身份、可选build和空build边界断言。旧22失败的运行栈位于这两条生产查询及相关直接查询；本轮对应22用例逐项pass，日志中 `column index out of range` 出现0次。此改善归于实际合入的SQLite绑定修复，不归于时钟或断言措辞改写。

Node24仍失败：

- `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
- `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

两项仍在原断言期待 `/provider_records_irregular/`。实际EXPLAIN的irregular分支为 `SCAN provider_records USING INDEX sqlite_autoindex_provider_records_1`，没有该预期索引。准确位置为read-scale.test.ts第46行、apps-scheduler-scope.test.ts第43行。这是9140337已存在的Node24/SQLite3.53.3现象；此次仍未修复。

Node22/SQLite3.50.2中同名C1与scope两项本轮均通过，包括原索引断言。因此不能把Node24的剩余2fail与旧Node22绑定错误混成一个未变根因。本次只证明当前冻结输入在此Node22环境下的非skip完整套件通过，未扩张为所有平台/所有SQLite版本兼容承诺。

## 环境、顺序和完整性

- 主机Linux6.18.44 x86_64、glibc2.41。
- Node24.19.0 / npm11.9.0 / ABI137 / SQLite3.53.3，复用既有云端运行时。
- Node22.18.0 / npm10.9.3 / ABI127 / SQLite3.50.2，复用已验证的官方独立归档，不重新下载或系统安装。
- 每阶段用对应Node绝对路径调用同发行目录npm-cli.js；子进程PATH仅局部前置该bin，npm lifecycle与child process.execPath分别核验；采样未发现其他Node版本。
- `npm_config_offline=true`、`npm_config_update_notifier=false`。保留原pretest审计、`--test-concurrency=1`及skip。NODE_OPTIONS、DSH_REAL_CORPUS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH均未设置。
- 两版prepare均exit0，pretest均PASS（308 test files，0 audit failures）。根和两个组件复用既有依赖，package.json与3份锁文件对旧基线不变。**未验证新环境依赖安装**。
- 每命令900秒/200MiB边界，20秒heartbeat并持续回读管理会话。Node24 typecheck于 `2026-10-15T22:20:57.620692+00:00` 结束后才启动Node22 prepare/full/typecheck，六阶段没有重叠。

| 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | ---: |
| Node24 npm test | `2026-10-15T22:16:24.170948+00:00` | `2026-10-15T22:20:40.075358+00:00` | 1 |
| Node24 typecheck | `2026-10-15T22:20:40.592270+00:00` | `2026-10-15T22:20:57.620692+00:00` | 0 |
| Node22 npm test | `2026-10-15T22:21:09.845750+00:00` | `2026-10-15T22:25:31.363843+00:00` | 0 |
| Node22 typecheck | `2026-10-15T22:25:31.762839+00:00` | `2026-10-15T22:25:49.687154+00:00` | 0 |

时间仅用于顺序与自然终结证据，不作跨版本性能比较。

两版各1346个tracked文件逐Git blob匹配准确提交，加上生成browserdata，共**1347个输入**在full与typecheck前后全部不变。两版输入清单SHA256相同：`ceb442e499076e6cefa7e466c66e7a9fe1ff3db5512f92025d38c3de3543db2e`。

| 原始日志 | 字节 | SHA256 |
| --- | ---: | --- |
| Node24 npm test | 263085 | `6af4626672819e6785899f979809acd26f316d9f952455fe4dae69e253487960` |
| Node24 typecheck | 155 | `d63003581a92e4041f1f6193ed7e8928dfd725895dbf683fa94febd6bff78ddd` |
| Node22 npm test | 613315 | `46d9cc2f3a73e8c3c213d9430e14fa2f1d78af9d22bf90a648c5905e12829a14` |
| Node22 typecheck | 56 | `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4` |

运行时二进制SHA256：Node24 `bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`；Node22 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。官方Node22归档SHA256为 `c1bfeecf1d7404fa74728f9db72e697decbd8119ccc6f5a294d795756dfcfca7`。

## 命令与复现边界

先取得准确提交并在干净独立副本checkout；本地候选的复现需已持有该对象，不能假设它当时已在远端。根与 `component-workspace/collected-products`、`component-workspace/helen-margin` 的锁匹配依赖必须就绪。NODE与NPMCLI须属于同一运行时发行目录，24三阶段完全结束后再做22三阶段。

```sh
git checkout --detach 5168fd9d2a10acffc804ddea9d783d75a0247a22
git rev-parse HEAD
# NODE=/absolute/path/to/that-version/bin/node
# NPMCLI=/absolute/path/to/that-version/lib/node_modules/npm/bin/npm-cli.js
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" test
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run typecheck
```

实际命令数组SHA256采用UTF-8 JSON数组，ensure_ascii=False、逗号/冒号紧凑分隔，无尾换行。cwd与环境另存本地command-manifest；绝对路径变化会改变命令数组哈希。

| 版本 | 阶段 | 实际命令数组SHA256 |
| --- | --- | --- |
| Node24 | `prepare-data` | `8d336a98b7fdc4bd686936fdc1f963e0a5e900d4310cc3313a6e104568862e08` |
| Node24 | `full-suite` | `697e01bd56565aeeb44df04eb52a342dd25d8109fb64e3bc230902fc6699b902` |
| Node24 | `typecheck` | `c59f2ac8e7c1965c3a1949960165f20c9120eb252f619f586e6522d566e140ad` |
| Node22 | `prepare-data` | `81dc6de0e9df7ad0fcc65b982a62ce297493c62e684fb2bd29820e467e433c42` |
| Node22 | `full-suite` | `3e4369b56d3cd1482aa0ddbdef9aefad3166ff203be90b2bc0dbacc6869d5371` |
| Node22 | `typecheck` | `a3a25e1de486bfcc9bb67c7da057c2abf750da8ab8d81f0958bd7aa7ff9b6b1f` |

## Node22逐项改善

1. `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`：fail → pass
2. `actual worker refreshes two closed-UI datasets independently, preserves failed data and never builds or saves`：fail → pass
3. `all legal primitive/array/object metadata cases retain strict scheduler filter behavior`：fail → pass
4. `an interrupted read reservation recovers once even when nextRun was already persisted in the future`：fail → pass
5. `changing a plan during its in-flight read cannot attach the old result to the new binding`：fail → pass
6. `existing schema 3 and 4 databases without the B5 indexes gain them on open and return identical results`：fail → pass
7. `fixed historical revisions and mounted publications read their indexed snapshot without scanning provider records`：fail → pass
8. `latest expression indexes reject SQLite-depth-exceeding JSON without weakening indexes or subsequent reads`：fail → pass
9. `latest expression indexes reject malformed SQL JSON at ingress; accepted JSON5 retains JSON.parse error precedence`：fail → pass
10. `matching records retain null, primitive and missing plan values and original sorting errors`：fail → pass
11. `persisted nextRun survives SQLite restart and missed days coalesce to one read per dataset`：fail → pass
12. `plans require a live worker, registered read schema, timezone and CAS; next run is explicit UTC`：fail → pass
13. `raw duplicate metadata keys retain JSON.parse last-key-wins filtering`：fail → pass
14. `real composition treats the persisted database as authoritative, reports changed seed file and invalidates its actual clients`：fail → pass
15. `same-dataset plans coalesce within one scheduled run while an independent refresh retains its own admission`：fail → pass
16. `scheduler scope candidates parse only scoped and irregular rows`：fail → pass
17. `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`：fail → pass
18. `scoped query selects exactly the prior filter and preserves created_at/id tie ordering`：fail → pass
19. `scoped scheduler dispatch preserves scheduleId order and dataset grouping across unrelated records`：fail → pass
20. `top-level null keeps the original TypeError before or after matching records`：fail → pass
21. `view lookup by build returns the legacy result and parses only this view's snapshots`：fail → pass
22. `view revisions resolve by session, view and build through the index with legacy results`：fail → pass

## 本地证据索引与未验证范围

下列是本次验证目录内的本地留存证据，**未随报告发布到仓库，不是公开下载链接**：

- `evidence/node24/`、`evidence/node22/`：full-suite.log、typecheck.log、各阶段result/start/runtime、test-outcomes、heartbeat、输入清单与command-manifest。
- 两版本的 `historical-outcome-comparison.json`：完整逐名/状态多重集与差异；`failure-signals.json`为原始日志诊断计数。
- `evidence/dual-results.json`、`source-identity.json`、`source-diff.patch`、`source-commit.txt`、`runtime-binaries.json`、`final-qa.log`。
- `EVIDENCE-SHA256.json`：报告和本地留存证据的哈希清单。

本轮未执行Windows/macOS、真实浏览器、已安装桌面Host、真实商家/外部Runtime或独立.mjs验收。38skip不计pass。原先失败历史报告保留原事实，没有覆盖。本报告仅为冻结候选的整合回归结果。
