# 经营设置：手动切换连接和店铺的读取恢复

## 固定基线与复现

生产基线 `aa18cebb6560f1f4e60cd7d1442553cbc754f652`；最终代码与测试冻结于 `35d60089df7dfcb7d28e375d452d251fc93e00c4`（初版 `4c5b9d42216f982f415fd90d83c1d7ebdb73717d`）。

真实 BusinessSettings React 组件使用已录制业务 fixture，以及显式本地派生的两连接/店铺身份、503 和挂起响应：在原连接、原店铺已加载后，手动选择另一连接，读取失败。基线选择器立即显示新连接，原店铺名称和规则仍保留，编辑和测试连接未禁用。实际点击“测试连接”发出的 payload 为新 connectionId 加旧 storeId。同一 payload 在真实 BusinessSettingsService.write 的本地服务替身依赖下被“店铺不属于当前经营连接”拒绝。没有证据表明发生商家误写；用户面对的是混合上下文及注定失败的额外操作。

原先外部工作台切店已有保护，本次仅补手动选择路径。不是重复报告外部意图、无店铺入口或经营操作目录恢复问题。

## 最小改变

- 手动选择复用现有一次性切换状态；连接选择器和编辑器继续显示同一份已接受上下文，成功后才一起安装目标连接/店铺/规则。
- 读取中或失败时禁用原编辑区写操作，清楚显示尚未切换。用户可重新读取、改选或取消后继续原店铺；不增加成功路径的确认步骤。
- 精确验证显式目标连接和店铺。空店铺的连接读取仍可成功，不强行要求连接已有店铺。
- 既有请求 abort 和意图版本隔离晚回执；后来手动选择优先。原有规则、连接表单、包装修改保护不变。
- 无服务端、权限、凭据协议、计价数学或商家操作变更。

## 红绿与反例

新增四项实际 React 用例：失败保留原身份及取消后正确连接试算；pending 禁写、替换选择、忽略 abort 的晚回执、失败后重读成功；显式店铺响应为空不被安装，重试成功后 dirty 规则继续阻止切店；失败或 pending 时新增店铺绑定已接受连接，并忽略旧回执。

测试 mock 的默认店铺解析改为与真实服务一致：显式 storeId 优先，否则从请求 connectionId 的店铺中选择首项。没有改写录制事实。

历史回放：

```sh
DSH_MANUAL_SWITCH_BASELINE=aa18cebb6560f1f4e60cd7d1442553cbc754f652 node --test --test-name-pattern='manual connection switches|manual target read' test/plugin-apps/business-settings.test.ts
```

两项精准失败于旧编辑器被标成新连接（actual other，expected board），原始首次红测、重放红测及混合 payload/真实服务拒绝证据均本地保留。

专项验证不等于浏览器视觉、全仓或真实商家验收。未改变旧测试超时/skip；无安装、外部 agent、真实商家写入或发布。


## 独立审查修正

首轮审查发现：新保护让失败后的界面继续显示原连接，但“新增店铺”取消意图时仍保留旧请求目标，可能重新读取失败目标并安装它。只有本地读取，没有商家写入。原候选双版本红测保留。最终取消切换同时将请求连接、店铺恢复为已接受上下文；手动选择和新增动作在同一事件里设置各自的明确新目标。补入 failed/pending 新增和晚回执回归。外部意图取消、手动改选及普通取消路径一起检查，避免仅修单一按钮。

最终生产文件 SHA-256：`5ef41089c3787720a1ecbef9bed9a9c90ed30883de97bf55238fa5a696816d58`。
最终测试文件 SHA-256：`a8769e3fe7ed411994e6444387f947625b2f4fafc2bf49ca8efbd5240cf77c4c`。

独立回放首轮 Node22 的两个包装用例遇到依赖解析失败：审查树的依赖链接经过作者树，作者同期将顶层 node_modules 链接改为被忽略的目录/逐包链接，造成短暂路径缺口。未改变依赖版本、测试 deadline 或生产代码；初始工具失败保留，并由审查方改为直接引用既有实际依赖根后复测。

独审最终批准上述冻结代码。扩展三项控制验证：取消挂起切换后修改规则、旧回执抵达后仍保留修改、保存中导航禁用且仅原 scope 一次写；合法零店铺连接可接受；返回错误连接时拒绝安装。Node24 三文件含扩展控制 57/57；Node22 原次设置40/40和服务1/1，修复依赖入口后包装16/16。这是分阶段独立验证，另以作者最终完整宽门禁为准。

最终宽门禁使用以下九文件（两版分别一次完整自然运行）：

```sh
node scripts/prepare-real-test-data.mjs
node --test --test-concurrency=1 \
  test/plugin-apps/business-settings.test.ts \
  test/plugin-apps/packaging-settings.test.ts \
  test/apps-runtime/business-settings-http.test.ts \
  test/plugin-apps/business-store-read-recovery.test.ts \
  test/plugin-apps/business-store-entry.test.ts \
  test/plugin-apps/workbench-store-context.test.ts \
  test/plugin-apps/workbench-store-retry.test.ts \
  test/plugin-apps/business-operations.test.ts \
  test/plugin-apps/business-draft-recovery.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/audit-real-test-data.mjs
```

最终冻结之后、依赖入口稳定期间，官方 Node22.18.0 与 Node24.21.0 上述九文件均一次完整自然通过 63/63，0 fail/skip/cancel；prepare、完整 tsc --noEmit、正式数据 audit 两版均 PASS（346 testFiles、188 requiredFiles、173 infrastructureFiles，0 failures）。相关组用时分别45.238s和43.819s。git diff --check 通过。测试文件已在既有 required/fileModes 分类内，未新增分类豁免。

本地证据及最终冻结日志单独保留，不随公开文档上传。旧候选与中途调整期间的首轮结果仅为历史，不与最终结果混计。原始日志、派生 fixture、依赖链接和本地探针不纳入提交。
