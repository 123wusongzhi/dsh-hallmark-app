# Node 22.18.0 全量兼容性验证与失败归因

日期：2026-10-15 UTC。结论：**完整验证已自然结束，但最低声明版本 Node 22.18.0 未通过当前全套测试。**

> 证据说明：本文中 `evidence/`、`diagnostics/` 与运行器文件名是本次云端任务的本地证据索引，未随本文发布到仓库，也不是可点击下载路径。本文嵌入了关键最小复现、原始输出摘要、精确提交/命令、计数及哈希；完整原始日志留存在该次验证任务中。

## 1. 精确输入与终结结果

- 实际测试提交：`26e235b28769c2ce83c23442fef25d5843cccfe6`，tree `4b2603313399b12667b60b318fdedc1ea48176f5`。
- 后续 README 提交 `35cf35522a24fbe1e309c18b6414bfbbec7b2dd8` 未包含在测试输入中；此报告不宣称它已做全量验证。
- 完整 npm test（attempt 2）：**2263 tests；2201 pass / 22 fail / 38 skip / 2 cancelled / 0 todo**。原生 TAP 汇总与逐用例分类一致。
- 开始 `2026-10-15T20:24:31.464987+00:00`，结束 `2026-10-15T20:29:04.631764+00:00`；自然 exit **1**，未触发900秒超时或200MiB日志上限，无人工kill。
- 独立 `npm run typecheck`：开始 `2026-10-15T20:29:04.994762+00:00`，结束 `2026-10-15T20:29:24.848359+00:00`，自然 exit **0**。
- `prepare:test-data` exit 0；原 `pretest` 审计 PASS，308 test files，0 audit failures。
- **22个 fail 分属8个文件，均指向同一编号SQLite参数绑定兼容问题；2个cancel位于另一个文件，属于独立的待决Promise/事件循环生命周期问题。** 不应拆成22个独立问题，也不能把cancel当pass或普通fail。
- 失败与取消在逐文件复跑中全部复现。主要生产代码与全部9个涉及文件在旧冻结提交 `8947e821476bcca376a680b263e4f2da2f775911` 中字节完全相同；两个旧基线代表文件实际复跑也重现。属于此次发现的既存最低版本兼容缺口，**不是本轮clock、SKU或库存断言修改新引入**。

这是兼容性验证，不是Node22与Node24的性能A/B；所记执行时长只用于确认执行及边界。

## 2. 运行环境与方法

- Linux x64，独立官方 Node **v22.18.0**，ABI127，内置 SQLite **3.50.2**，官方 npm **10.9.3**。
- 官方归档：`node-v22.18.0-linux-x64.tar.xz`，SHA256 `c1bfeecf1d7404fa74728f9db72e697decbd8119ccc6f5a294d795756dfcfca7`。复用此前已验证的归档，没有重下载或系统安装。
- Node二进制SHA256 `ccacb2d6d87ba6d118b2bffc1ae33747a05cc5fc6b1f1ec4fc1d420b687e952d`。
- 所有npm阶段使用独立Node的绝对路径执行官方 `lib/node_modules/npm/bin/npm-cli.js`，仅该子进程环境PATH前置22bin；没有修改全局PATH、配置或系统Node。全局Node仍v24.19.0。
- 每阶段实际读取npm lifecycle环境，并启动其PATH下的子进程验证Node版本和 `process.execPath`；full中只读采样观测到532个Node进程，均是独立22bin，未观测到其他Node。采样并非每一个短生命周期子进程的完整追踪。
- `npm_config_offline=true`、`npm_config_update_notifier=false`；未使用误写的CLI notifier参数。
- `NODE_OPTIONS`、`DSH_REAL_CORPUS`、`DSH_PREVIEW_BROWSER_PATH`、`CHROME_PATH` 均保持未设置。保留原默认串行 `--test-concurrency=1`、原browser环境和原skip条件。
- 默认已提交脱敏语料离线生成browserdata；没有真实商家请求、凭据配置、浏览器安全绕过或安装依赖。
- 复用根与两个组件子项目的现有依赖。根pnpm锁SHA256 `6dfa707c589d59ad4442cc26ff1b4cb1441ff0c1453c1e952bdbd1e85376840b`；两个组件package-lock均 `ab15c0fe9a313cbb9eaef6eabcd646dcef1af07a7da187ba8949319d48a4d128`，与冻结提交逐字节匹配。
- Node22预检：ESBuild 0.25.0实际transform、两个组件Vite 6.4.4实际导入及8个glibc原生addon实际加载成功。这不是一次干净依赖安装验证。

每阶段命令、环境身份、起止时间及日志见 `evidence/*-start.json`、`*-result.json`、`runtime-*.json`。

复现前提：使用干净的独立工作副本，先切到本报告精确SHA；根与 `component-workspace/collected-products`、`component-workspace/helen-margin` 的依赖已经就绪，并与下述锁文件匹配。本次验证复用了已有依赖，没有证明全新环境能够成功安装；依赖安装及其网络/平台差异需要另行验证。不要把以下命令当成从空环境一键构建流程。

```sh
# 在干净的独立工作副本中，先冻结实际测试提交。
git checkout --detach 26e235b28769c2ce83c23442fef25d5843cccfe6
git rev-parse HEAD
# N22 和 NPMCLI 必须指向同一个已校验的官方22.18发行目录。
N22=/absolute/path/node-v22.18.0-linux-x64/bin/node
NPMCLI=/absolute/path/node-v22.18.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js
# 仅以下命令的子进程PATH前置22bin；不修改全局PATH。
env PATH="$(dirname "$N22"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$N22" "$NPMCLI" run prepare:test-data
env PATH="$(dirname "$N22"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$N22" "$NPMCLI" test
env PATH="$(dirname "$N22"):$PATH" npm_config_offline=true npm_config_update_notifier=false "$N22" "$NPMCLI" run typecheck
```

## 3. 源码与日志完整性

1330个tracked文件均逐一重算Git blob并与指定提交匹配；加上生成的 `test/real-data/browser-data.ts`，共1331个输入的前后SHA清单完全一致。

- 输入清单SHA256：`9fd44d3eb187b8d3be3a9bdeb461387bd5437bf93a5dc6f1c857ce83e1b2ef5b`。
- full原始日志：`evidence/full-suite.log`，703734 bytes，SHA256 `8a02a9d57d7a560359359b9433ee30d537188ac51a1f8371c56ee708652b58b0`。
- typecheck日志：`evidence/typecheck.log`，56 bytes，SHA256 `4328021254cd56b0a55136b0d06d0649be8de86371957a551968fbae19bf27d4`。
- 源码没有修改、删除断言或增加skip。唯一Git untracked项目是三处复用依赖的symlink。
- 本地TAP结果解析器最初漏识别 `# SKIP` 中的空格，导致辅助逐项表把38个skip误标pass；原Node TAP汇总一直正确。只修正了本地报告解析器，保留 `test-outcomes-initial-parser.json`，修后 `test-outcomes.json` 的2201/22/38/2逐项计数全部与原TAP一致。原日志未改。

### 中断尝试不计入结果

第一次尝试从20:04:32.318740 UTC开始，后续管理会话失联，日志止于case1864，没有原生汇总、exit或超时记录，具体中断原因无证据可确定。20:21:53回读原会话返回 `Unknown process id`。原日志及哈希保留，未与attempt2合并。其557557字节日志SHA256为 `56106b33c40492f02eb154d8e7f4ec57da0e0ad38d434dbb6a1e60180912cc6d`；仅部分记录1819pass/6fail/37skip/2cancel不能被称为全套结果。独立授权的attempt2重建相同SHA，新增20秒监控heartbeat并持续轮询，自然完成。

## 4. SQLite兼容问题：22个fail的统一归因

[RuntimeStore源码](https://github.com/123wusongzhi/dsh-hallmark-app/blob/26e235b28769c2ce83c23442fef25d5843cccfe6/packages/app-runtime/src/store.ts#L68-L147)：

- 第70行的 `PROVIDER_RECORD_SCOPE_SQL` 使用 `?1/?2/?3` 编号参数；第143行调用 `.all(appId, connectionId, namespace)` 位置参数。
- 第147行 `viewRevisionsForBuild()` 同样使用 `?1/?2/?3` 与 `.all(...positionalValues)`。
- [AppsSnapshotScheduler.list()](https://github.com/123wusongzhi/dsh-hallmark-app/blob/26e235b28769c2ce83c23442fef25d5843cccfe6/packages/service/src/apps-scheduler.ts#L38-L40) 通过scope方法，错误继续影响status、计划和worker。

在Node22.18.0上，最小 `SELECT ?1 AS value` 加 `.get('same-value')` 已直接产生 `ERR_SQLITE_ERROR: column index out of range`。不依赖本仓库、不访问磁盘或网络、不涉及query planner。相同探针在现有Node24.19.0/SQLite3.53.3上成功。匿名 `?` 与显式对象 `{'?1':'same-value'}` 两个控制在22/24都成功。

8文件中的直接SQL错误、HTTP503和JSON语义断言失败均可从原始日志追回此绑定错误；其中3个HTTP读取测试实际记录 `runtime_request_failed`，cause为同一SQL错误。JSON parity的6项得到错误提前抛出，遮蔽原本应保持的返回值或TypeError。不是6种新的JSON输入缺陷。

C1及schema3/4 scope用例在22上更早发生绑定错误，尚未到旧Node24报告的planner/index断言。因此不能把旧24的两项planner失败改称本次同原因，更不能宣称已修复它们。

### 最小独立探针

文件：`diagnostics/sqlite-parameter-probe.mjs`。22/24完整原始输出分别保留在 `node22-sqlite-probe.log`、`node24-sqlite-probe.log`。

```js
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');
const outcomes=[];
for(const [label,sql,args] of [['anonymous','SELECT ? AS value',['same-value']],['numbered-positional','SELECT ?1 AS value',['same-value']],['numbered-named','SELECT ?1 AS value',[{'?1':'same-value'}]]]){
 try{outcomes.push({label,sql,args,outcome:'PASS',result:db.prepare(sql).get(...args)});}catch(error){outcomes.push({label,sql,args,outcome:'ERROR',errorCode:error.code,errorMessage:error.message});}
}
console.log(JSON.stringify({node:process.version,execPath:process.execPath,sqlite:process.versions.sqlite,outcomes},null,2));db.close();
```

| 控制 | Node22.18.0 / SQLite3.50.2 | Node24.19.0 / SQLite3.53.3 |
| --- | --- | --- |
| `SELECT ?` + positional | PASS：same-value | PASS：same-value |
| `SELECT ?1` + positional | ERR_SQLITE_ERROR：column index out of range | PASS：same-value |
| `SELECT ?1` + explicit named object | PASS：same-value | PASS：same-value |

未修改生产SQL或绑定，也没有以控制探针替代原测试通过。

## 5. 两个cancel：独立的测试生命周期链

原文件 [listing-assets.test.ts](https://github.com/123wusongzhi/dsh-hallmark-app/blob/26e235b28769c2ce83c23442fef25d5843cccfe6/test/app-hallmark/listing-assets.test.ts#L185-L203)：

1. `a call that runs out of its time budget returns per-file retryable results and a plain retry succeeds`（185行），Node22取消：`Promise resolution is still pending but the event loop has already resolved`。
2. `caller cancellation keeps its ordinary failure instead of the time-budget code`（197行）随后0ms被父级取消。

调用链：测试配置 `publishHang: true, timeBudgetMs: 200` → `ListingAssetPublisher.publish()` 第58行建立 `AbortSignal.timeout()` budget → 第114行await `/api/images/publish` → 第39–43行request组合abort signals → 测试36行附近的fetch stub只返回等待abort的Promise，无真实网络I/O。第二项本身有50ms的实际 `setTimeout`。

实测证据：

- 同一原文件22：19tests=17pass/0fail/2cancel；24：19pass，无cancel。
- 只选择第二项在22执行：1test/1pass，证明整文件第二cancel是前项结束失败后的连带取消，不能单独归为第二个业务bug。
- 仓库外最小 `node:test` 用例仅await `AbortSignal.timeout(30)` 的abort事件：22=1cancel，24=1pass。代码 `diagnostics/abortsignal-timer.test.mjs` 与原始TAP保留。
- 旧8947的原listing-assets文件在22仍17pass/2cancel。

这些证据说明Node版本下纯Promise/timeout测试生命周期差异；它与SQLite无关，也不证明真实HTTP链路的超时业务逻辑错误。独立复核/测试fixture最小修复方案另列候选，当前未改测试和生产代码。

### 可独立复现的AbortSignal探针

保存为 `abortsignal-timer.test.mjs`，分别用明确的22.18.0与24.19.0 Node可执行文件运行 `node --test --test-reporter=tap abortsignal-timer.test.mjs`。此探针与仓库测试文件无依赖，无真实I/O。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
test('awaiting only AbortSignal.timeout preserves a live test until abort', async () => {
  const signal=AbortSignal.timeout(30);
  await new Promise(resolve => signal.addEventListener('abort', resolve, {once:true}));
  assert.equal(signal.aborted,true);
});
```

Node22.18.0原始输出摘要（进程exit1）：

```text
not ok 1 - awaiting only AbortSignal.timeout preserves a live test until abort
  failureType: 'cancelledByParent'
  error: 'Promise resolution is still pending but the event loop has already resolved'
# tests 1
# suites 0
# pass 0
# fail 0
# cancelled 1
# skipped 0
# todo 0
```

Node24.19.0原始输出摘要（进程exit0）：

```text
ok 1 - awaiting only AbortSignal.timeout preserves a live test until abort
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

这两份摘要直接摘取各自原始TAP；没有把`cancelled`改写为`fail`。完整原始输出仍是本地未发布证据。

## 6. 独立逐文件复跑

以下是每个原文件独立Node22运行结果，不与全量加总成更多独立覆盖：

| 文件 | tests | pass | fail | cancel | skip |
| --- | ---: | ---: | ---: | ---: | ---: |
| `test/acceptance/component-display/read-scale.test.ts` | 1 | 0 | 1 | 0 | 0 |
| `test/app-hallmark/listing-assets.test.ts` | 19 | 17 | 0 | 2 | 0 |
| `test/apps-runtime/connection-config.test.ts` | 7 | 6 | 1 | 0 | 0 |
| `test/performance/backend-optimizations.test.ts` | 17 | 14 | 3 | 0 | 0 |
| `test/performance/display-read-path.test.ts` | 3 | 2 | 1 | 0 | 0 |
| `test/service/apps-scheduler-scope.test.ts` | 3 | 0 | 3 | 0 | 0 |
| `test/plugin-apps/list-performance.test.ts` | 4 | 3 | 1 | 0 | 0 |
| `test/service/apps-scheduler-json-parity.test.ts` | 6 | 0 | 6 | 0 | 0 |
| `test/service/apps-scheduler.test.ts` | 7 | 1 | 6 | 0 | 0 |

所有复跑自然exit1，原因是保留的fail/cancel；无timeout、无输入变化。每个命令、起止时间、完整原始日志及SHA在 `diagnostics/focused/`。22项fail全部对应原full中的同名失败。

## 7. 旧基线未改证据

旧提交 `8947e821476bcca376a680b263e4f2da2f775911` 与本次 `26e235b28769c2ce83c23442fef25d5843cccfe6` 对下列11个文件分别执行Git blob与字节比较，全部相同。完整SHA256在 `diagnostics/old-baseline-file-identity.json`。

| 文件 | 两提交共同Git blob | 字节比较 |
| --- | --- | --- |
| `packages/app-runtime/src/store.ts` | `6a7ec6f157e98518b9e83cb1bae17223fe8f02e6` | 完全相同 |
| `packages/app-hallmark/src/listing-assets.ts` | `0f94c919c8e62f7957b58c927bd8ba81e9a983a6` | 完全相同 |
| `test/app-hallmark/listing-assets.test.ts` | `829334ecb9ba0b165fc3b5b92f4561066e64ab1f` | 完全相同 |
| `test/performance/backend-optimizations.test.ts` | `75ffb70b9f4309d495d4f0976098c9516fa9b550` | 完全相同 |
| `test/performance/display-read-path.test.ts` | `19a62ba640ce14a421a1534fa56ac28af14b41ad` | 完全相同 |
| `test/service/apps-scheduler-scope.test.ts` | `178215f4d343769858d62670b35499e9fe0d3ddb` | 完全相同 |
| `test/apps-runtime/connection-config.test.ts` | `425c9d552653fad60739c39e7e47b893c6789148` | 完全相同 |
| `test/acceptance/component-display/read-scale.test.ts` | `73436f531ae30c2facc09d6484f154d25e0f3826` | 完全相同 |
| `test/plugin-apps/list-performance.test.ts` | `8f684120936c0eae9c50188fe63ac4f3027626ba` | 完全相同 |
| `test/service/apps-scheduler-json-parity.test.ts` | `3cac090fbf574e883dcd5a480f1f9ad689e26bb9` | 完全相同 |
| `test/service/apps-scheduler.test.ts` | `9ab09cdcc9432b2b611c1b797366c3482dd4ae57` | 完全相同 |

此外，独立 `git archive 8947...`、相同Node22与现有依赖实跑：

- `test/performance/backend-optimizations.test.ts`：17tests=14pass/3fail，仍是scope/view编号参数绑定错误。
- `test/app-hallmark/listing-assets.test.ts`：19tests=17pass/2cancel。

旧基线复跑不是旧基线全量，只用于证明这两个代表性问题在本轮测试补强前已存在。

## 8. 范围限制与后续

38项skip全部保留，不计pass；Windows、真实浏览器、缺少候选包等条件见原测试及完整skip清单。未验证Windows/macOS、真实商家/外部Runtime、已安装桌面Host或真实浏览器视觉，也未运行独立`.mjs`验收入口或重新安装依赖。没有将类型检查通过当成运行时兼容通过。

建议把发现分成两个自足问题候选：

1. 声明最低Node22.18下，编号SQLite参数与位置绑定不兼容，影响scope和固定revision读取；需独立生产兼容修复设计与验证，保留SQL语义、排序、JSON parity和既有planner约束。
2. listing-assets纯Promise预算测试在Node22事件循环空闲时提前取消；需独立fixture生命周期设计和22/24双版本复核，不删除预算断言、业务断言或用skip消红。

当前仅报告和复现，不包含修复或外部issue发布。两个独立问题候选正文另行准备，未随本文发布。

## 附：22项fail精确名称与位置

1. `test/acceptance/component-display/read-scale.test.ts:29:1` — C1: 49 MB captured-record load leaves indexed view lookup and verified chunk reads bounded
2. `test/apps-runtime/connection-config.test.ts:106:1` — real composition treats the persisted database as authoritative, reports changed seed file and invalidates its actual clients
3. `test/performance/backend-optimizations.test.ts:96:1` — scheduler scope candidates parse only scoped and irregular rows
4. `test/performance/backend-optimizations.test.ts:116:1` — view revisions resolve by session, view and build through the index with legacy results
5. `test/performance/backend-optimizations.test.ts:125:1` — existing schema 3 and 4 databases without the B5 indexes gain them on open and return identical results
6. `test/performance/display-read-path.test.ts:55:1` — view lookup by build returns the legacy result and parses only this view's snapshots
7. `test/plugin-apps/list-performance.test.ts:65:1` — fixed historical revisions and mounted publications read their indexed snapshot without scanning provider records
8. `test/service/apps-scheduler-json-parity.test.ts:20:1` — top-level null keeps the original TypeError before or after matching records
9. `test/service/apps-scheduler-json-parity.test.ts:23:1` — all legal primitive/array/object metadata cases retain strict scheduler filter behavior
10. `test/service/apps-scheduler-json-parity.test.ts:27:1` — matching records retain null, primitive and missing plan values and original sorting errors
11. `test/service/apps-scheduler-json-parity.test.ts:32:1` — latest expression indexes reject malformed SQL JSON at ingress; accepted JSON5 retains JSON.parse error precedence
12. `test/service/apps-scheduler-json-parity.test.ts:42:1` — latest expression indexes reject SQLite-depth-exceeding JSON without weakening indexes or subsequent reads
13. `test/service/apps-scheduler-json-parity.test.ts:48:1` — raw duplicate metadata keys retain JSON.parse last-key-wins filtering
14. `test/service/apps-scheduler-scope.test.ts:11:1` — scoped query selects exactly the prior filter and preserves created_at/id tie ordering
15. `test/service/apps-scheduler-scope.test.ts:40:1` — scoped SQL works on existing schema 3 and 4 disk stores and remains valid after reopen
16. `test/service/apps-scheduler-scope.test.ts:46:1` — scoped scheduler dispatch preserves scheduleId order and dataset grouping across unrelated records
17. `test/service/apps-scheduler.test.ts:25:1` — plans require a live worker, registered read schema, timezone and CAS; next run is explicit UTC
18. `test/service/apps-scheduler.test.ts:37:1` — actual worker refreshes two closed-UI datasets independently, preserves failed data and never builds or saves
19. `test/service/apps-scheduler.test.ts:49:1` — persisted nextRun survives SQLite restart and missed days coalesce to one read per dataset
20. `test/service/apps-scheduler.test.ts:57:1` — same-dataset plans coalesce within one scheduled run while an independent refresh retains its own admission
21. `test/service/apps-scheduler.test.ts:74:1` — an interrupted read reservation recovers once even when nextRun was already persisted in the future
22. `test/service/apps-scheduler.test.ts:84:1` — changing a plan during its in-flight read cannot attach the old result to the new binding
