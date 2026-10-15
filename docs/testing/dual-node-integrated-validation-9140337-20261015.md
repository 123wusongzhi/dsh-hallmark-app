# 9140337：Node24与Node22顺序整合全量验证

日期：2026-10-15 UTC。

## 结论

本次准确冻结 `9140337fd660ce3be769e80d775021494cc16c3d`（tree `c2b1fed1eff4fb0bcf1563520e41c8898a509343`），在两个独立工作副本中**先完成Node24全量与typecheck，再启动Node22全量与typecheck**。

两版均自然结束。三项测试改动整合后，没有出现各自历史基线之外的新失败或取消；**既存SQLite失败全部保留，两版全套仍未通过**。

| 实测版本 | tests | pass | fail | skip | cancelled | todo | npm test exit | typecheck exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Node24.19.0 | 2263 | 2223 | 2 | 38 | 0 | 0 | 1 | 0 |
| Node22.18.0 | 2263 | 2203 | 22 | 38 | 0 | 0 | 1 | 0 |

计数来自实际原生测试汇总，并与逐项记录交叉一致，不是预设历史数字。未删/放宽断言、添加skip、改生产或覆盖旧报告。此次只验证该SHA，后续提交不在输入内。

## 输入与三项变更

相对此前已测 `6b7a59c7d12e8a36cc11e1f66a8dbfb53ba1018d`，变更为：

- [Decisions测试](https://github.com/123wusongzhi/dsh-hallmark-app/blob/9140337fd660ce3be769e80d775021494cc16c3d/test/decisions/decision-review.test.ts)：增强业务payload断言。
- [session-components测试](https://github.com/123wusongzhi/dsh-hallmark-app/blob/9140337fd660ce3be769e80d775021494cc16c3d/test/plugin-client/session-components.test.ts)：删除1条已被行为测试覆盖的sidebar静态断言；**保留原test case**，不是删除一个测试用例。
- [snapshot-refresh-lifecycle测试](https://github.com/123wusongzhi/dsh-hallmark-app/blob/9140337fd660ce3be769e80d775021494cc16c3d/test/plugin-client/snapshot-refresh-lifecycle.test.ts)：缺失响应的诊断helper。
- 相应报告文档。

`packages/`整棵生产tree两提交共同为 `b83af221fb620ae172cd143ad1019d9b0c53825d`。package.json、根pnpm锁与两个组件package-lock均完全相同。两版本在同一SHA生成相同browserdata。

## 逐名多重集核验

保留重名次数，分别比较每个用例的名称与pass/fail/skip/cancel状态：

1. **Node22对比6b7a59c实测**：全部2263个测试名称多重集相同；pass、fail、skip、cancelled各多重集完全相同，新增/移除均为空。
2. **Node24对比更早的clock candidate实测**：实际历史输入为冻结暂存tree `1fa88e8ed6a63a2a1c2ee44ae7471abfa43ac962`，其仓库HEAD是 `8947e821476bcca376a680b263e4f2da2f775911`，不能把历史HEAD当作测试输入，也不能称为6b7a59c的Node24全量。与这份精确历史记录相比，全部2263个测试名称和pass/fail/skip/cancelled各多重集同样完全相同。
3. **本次两版本之间**：测试名称全集相同，38项skip未变化，均0cancel。两版已知fail数量不同，不合并成一个总失败数，不作运行速度比较。

#62修复的预算与caller-cancellation两项在两版本轮完整套件中均为pass，没有重新出现取消。

## 保留的失败与边界

Node24的两项仍是原query-plan/index断言：

- `C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded`
- `scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen`

两项均在原日志中仍期待 `/provider_records_irregular/`，不是新增问题。

Node22的22项仍是先前已复现的编号SQLite参数与位置绑定兼容问题，跨8个原文件；20项失败块直接含 `column index out of range`，另2项HTTP503断言之前的runtime错误日志含同一cause。22个失败名称及重复次数与6b7a59c完全相同。完整原因、最小探针和逐文件列表见[原兼容性报告](https://github.com/123wusongzhi/dsh-hallmark-app/blob/9140337fd660ce3be769e80d775021494cc16c3d/docs/testing/node22-full-compatibility-20261015.md)。

两个版本有同名失败不代表同一触发阶段：Node22的C1/scope会先遇到参数绑定错误，Node24则走到planner/index断言。当前没有生产修复，不能说已实现最低版本全部兼容，也不能用typecheck通过掩盖运行失败。

## 环境与执行纪律

- 主机：Linux 6.18.44 x86_64，glibc2.41。
- Node24：既有云端Node **24.19.0** / ABI137 / SQLite3.53.3，配自身npm **11.9.0**。
- Node22：复用已验证官方归档的独立Node **22.18.0** / ABI127 / SQLite3.50.2，配自身npm **10.9.3**；未重下载或系统安装。
- 每阶段用对应Node绝对路径运行其npm-cli.js，仅该命令子进程PATH前置对应bin；npm lifecycle与其child实际 `process.execPath` 均核验。各阶段未观测到意外版本Node进程。
- 环境为 `npm_config_offline=true`、`npm_config_update_notifier=false`；保留原package.json的pretest审计及 `--test-concurrency=1`。
- `NODE_OPTIONS`、`DSH_REAL_CORPUS`、`DSH_PREVIEW_BROWSER_PATH`、`CHROME_PATH`保持未设置。原skip与browser环境不变。
- 两版离线prepare均exit0，pretest审计均PASS（308 test files，0 audit failures）。复用现有根与两个组件依赖，锁文件匹配；没有新安装依赖或验证空环境安装。
- 每命令900秒/200MiB上限，20秒heartbeat并持续回读管理会话；全部阶段自然终结，未超时、未kill、未丢会话。Node24 typecheck于21:33:43.057493 UTC结束后，Node22 full于21:33:54.269569 UTC才开始，阶段没有重叠。
- 全局Node仍24.19.0；没有改系统环境、真实商家请求、凭据配置或浏览器安全绕过。

### 实际起止与退出码

| 阶段 | 开始UTC | 结束UTC | exit |
| --- | --- | --- | ---: |
| Node24 npm test | `2026-10-15T21:29:19.366041+00:00` | `2026-10-15T21:33:27.721954+00:00` | 1 |
| Node24 typecheck | `2026-10-15T21:33:28.191850+00:00` | `2026-10-15T21:33:43.057493+00:00` | 0 |
| Node22 npm test | `2026-10-15T21:33:54.269569+00:00` | `2026-10-15T21:38:10.127244+00:00` | 1 |
| Node22 typecheck | `2026-10-15T21:38:10.485822+00:00` | `2026-10-15T21:38:28.510606+00:00` | 0 |

时间仅确认顺序和自然终结，不计算跨版本速度变化。

## 源码和日志完整性

两版各1337个tracked文件逐Git blob匹配准确提交，加上生成browserdata，共**1338个输入**在full与typecheck前后全部不变。两版输入清单SHA256相同：

`8a4cbee94dc69ad95ca760c3c99869c1d9459e16ebc1fcf68fcf6565271a4602`

| 原始日志 | 字节 | SHA256 |
| --- | ---: | --- |
| Node24 npm test | 263100 | `ee610a4792f8cae180266e95161be9d607818097feec3d391bcab9598fb64d96` |
| Node24 typecheck | 155 | `d63003581a92e4041f1f6193ed7e8928dfd725895dbf683fa94febd6bff78ddd` |
| Node22 npm test | 700452 | `d61078be0082d90af32284a95093119201e720e5d5a6181b77756526e53805c9` |
| Node22 typecheck | 56 | `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4` |

运行时二进制SHA256：

- Node24：`bc17c508ffeed0ec622934f9b7fa72f8e78da65350e63c3eceb56fa688aa5e12`
- Node22：`ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`
- 官方Node22归档：`c1bfeecf1d7404fa74728f9db72e697decbd8119ccc6f5a294d795756dfcfca7`

## 命令与复现

在干净独立副本中先checkout准确SHA。根与 `component-workspace/collected-products`、`component-workspace/helen-margin` 依赖须已就绪并与锁文件一致。本次**不是新环境安装验证**。每一版的NODE与NPMCLI必须属于同一发行目录，先完成24的三阶段，再执行22的三阶段。

```sh
git checkout --detach 9140337fd660ce3be769e80d775021494cc16c3d
git rev-parse HEAD
# NODE=/absolute/path/to/that-version/bin/node
# NPMCLI=/absolute/path/to/that-version/lib/node_modules/npm/bin/npm-cli.js
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" test
env PATH="$(dirname "$NODE"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$NODE" "$NPMCLI" run typecheck
```

以下是**实际执行参数数组**的SHA256：UTF-8 JSON数组，`ensure_ascii=False`，分隔符为逗号和冒号，无尾换行；数组包含本次实际绝对Node/npm路径。完整数组、cwd、对应SHA及环境另存本地command-manifest。复现时替换本机绝对路径会改变命令数组哈希，不表示脚本内容不同。

| 版本 | 阶段 | 实际命令数组SHA256 |
| --- | --- | --- |
| Node24 | `prepare-data` | `8d336a98b7fdc4bd686936fdc1f963e0a5e900d4310cc3313a6e104568862e08` |
| Node24 | `full-suite` | `697e01bd56565aeeb44df04eb52a342dd25d8109fb64e3bc230902fc6699b902` |
| Node24 | `typecheck` | `c59f2ac8e7c1965c3a1949960165f20c9120eb252f619f586e6522d566e140ad` |
| Node22 | `prepare-data` | `81dc6de0e9df7ad0fcc65b982a62ce297493c62e684fb2bd29820e467e433c42` |
| Node22 | `full-suite` | `3e4369b56d3cd1482aa0ddbdef9aefad3166ff203be90b2bc0dbacc6869d5371` |
| Node22 | `typecheck` | `a3a25e1de486bfcc9bb67c7da057c2abf750da8ab8d81f0958bd7aa7ff9b6b1f` |

## 本地证据索引与未验证范围

下列为本次独立验证任务的本地留存文件，**未随文发布到仓库，不是公开下载链接**：

- `evidence/node24/`、`evidence/node22/`下的full-suite.log、typecheck.log、*-result.json、test-outcomes.json和runtime-*.json。
- 两目录内 `historical-outcome-comparison.json`、`command-manifest.json`、输入哈希清单、heartbeat及runner.log。
- `evidence/dual-results.json`、`source-identity.json`、`runtime-binaries.json`、`failure-cause-verification.json`、`final-qa.log`。
- `EVIDENCE-SHA256.json`为本次报告及全部留存证据文件的哈希清单。

本轮未进行Windows/macOS、真实浏览器、已安装桌面Host、真实商家/外部Runtime或独立`.mjs`验收。38项skip不计pass；失败保持可见。此报告记录整合回归，没有生产修改或跨版本性能结论。
