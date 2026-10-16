# 刷新输入保护与查看范围重试：双 Node 整合验证

日期：2026-10-16 UTC。公开代码基线：`67374c97f03a1b91bef920fd50abdc2f3960ac72`。本次精确测试源码：`691f587304c4392a64aa4345d776b8860b61caa7`，tree：`95f4916fc8fb35df4b98f0a1e58628774be4777c`。本说明在整轮验证结束后单独添加，不改变测试过的代码。

## 两项用户流程

1. **刷新后保留新增动作。** 在经营操作中输入尚未添加的销售货号、售价等，再刷新批次；若原批次暂时消失、列表为空或读取失败，保留原选择与输入，明确提示尚未保存，暂时禁止添加。原批次恢复后可继续正常保存；也可明确放弃并切换。未修改或净零输入保持原有正常默认选择。隐藏再显示、会话/店铺隔离、迟到列表回执及旧提交回调受到验证。
2. **直接重试查看范围。** 配置商品表格时，仓库范围读取失败后可点“重新读取查看范围”，无需重读整个素材/数据源目录或表格预览。重复失败仍可恢复，加载状态清晰，名称和搜索输入保留；旧店铺的迟到回执不能替换当前选择，成功缓存可复用，合法空列表不显示失败。

独立复现、修正与范围分别见[批次刷新说明](../business-new-form-refresh-20261016.md)和[查看范围说明](../material-range-read-recovery-20261016.md)。两项测试通过本地真实 React/业务引擎或服务边界完成，不是商家线上事故或浏览器视觉验收。

## 精确整合结果

完整执行 **114 个唯一测试文件**，由上一轮 113 文件组合加入新增刷新回归文件；原有范围恢复测试文件增加一个用例。不使用名称筛选，不新增 skip，不放宽断言。

| 实际 Node / npm | tests | pass | fail | skip | cancelled | audit / typecheck |
|---|---:|---:|---:|---:|---:|---|
| 22.18.0 / 10.9.3 | 682 | 680 | 0 | 2 | 0 | PASS / PASS |
| 24.21.0 / 11.19.0 | 682 | 680 | 0 | 2 | 0 | PASS / PASS |

两版本案例名称与结果多重集一致。相对上一轮 678 项组合，没有移除或重命名用例，没有新增或移除 skip；新增四项：
- batch refresh preserves new-form input without retargeting missing batches
- clean refresh negative controls
- recovered and explicitly new forms still save once
- failed range reads retry in place without reloading catalogs or losing edits

两个既有 skip 不计作通过：
- project skill installer validates without writing, installs both local skills and preserves unrelated skills
- real bundle Host reads prepared and recoverable legacy preview archives before a user opens its iframe

两版本数据审计均 PASS：329 个测试文件，176 个 required 条目，168 个 infrastructure 条目，来源数 20/20/1。新增刷新测试明确登记为 required，使用共享已记录数据；浏览器 fixture 在本工作树由匹配的已跟踪快照离线生成。

每个实际运行时按 audit → 相关测试 → typecheck 串行执行，测试并发为 1，各阶段 600 秒上限；六阶段全部自然退出 0。匹配版本的 Node bin 前置到 PATH，使用同一运行时自带 npm。全部 1438 个 tracked 文件在各阶段前后字节哈希一致，验证期间没有修改源码。第一次完整整合在 Node 22.18.0 为 682 项、680 通过、0 失败、2 跳过；Node 24.21.0 为 682 项、679 通过、1 失败、2 跳过；两版审计和类型检查均通过。失败来自原有 Native gateway 测试在固定 50ms 后直接读取尚未出现的打开按钮。该初次失败保留，不改写成通过。

## 原有测试就绪等待修正

第一次整合源码为 `cad4e15b03952177e16b6ddc0213dc18ad527a4e`。独立复核确认 gateway 测试及其生产视图与公开基线一致；基线和候选均可在 150ms 本地视图读取延迟下复现相同缺按钮错误。测试改为最多两秒等待精确按钮出现，保留原有 metadata、侧栏身份、Runtime 内容、旧路由、附件禁止等断言；不修改生产代码、不跳过断言、不整项重试。延迟控制通过，错误按钮标签与错误 Runtime 内容仍失败。修正后重新冻结源码并执行后续六阶段组合。它是测试可靠性修正，不另计为产品 UX 改进。详见[独立诊断](../native-gateway-test-readiness-20261016.md)。

第二轮完整整合源码 `5eca12cf3e3829877087801990df962bd87540a8` 的 Node 22.18.0 仍为 680 通过、0 失败、2 跳过；Node 24.21.0 为 679 通过、1 失败、2 跳过。Gateway 用例已通过，失败是另一个原有 Native workspace 关闭面板回执/界面就绪时序问题（实际仍有一个关闭按钮，预期为零），不是此前的重命名版本断言。两版审计和类型检查通过，源码保持冻结。独立复核在公开基线和候选通过关闭响应延迟复现，还复现了重新挂载后的目录读取等待不足。测试增加关闭后和重新挂载后的有界就绪等待，保留原有 60 条断言；正常和组合延迟控制在两版本通过，虚假的成功关闭回执仍被原持久状态断言拒绝。详见[面板就绪诊断](../test-native-workspace-panel-readiness-20261016.md)。这也仅是测试可靠性修正，不计为额外 UX 改进。三轮历史失败均保留；最终表格仅对应最新修正后的第四轮完整六阶段执行。

第三轮完整整合源码 `f58955bc434f3563aaed5dcaaf5cc20dd4474f00` 的 Node 22.18.0 为 682 项、680 通过、0 失败、2 跳过；Node 24.21.0 为 682 项、679 通过、1 失败、2 跳过。两版审计和类型检查通过，全部 1,437 个跟踪文件在六阶段前后保持一致。关闭与重新挂载检查已通过；随后原有 Native source draft 的“正在打磨，请稍候”断言在固定 40ms 后仍未等到读取完成而失败。该失败亦在公开基线通过定向延迟复现。

随后对整份 native-workspace 测试的异步边界统一复核：十个原有检查点在独立定向延迟下复现失败，改为有界、语义明确的就绪条件后通过。全流程每次 API 请求延迟 150ms、每次响应延迟 150ms 的两种压力检查均在两个实际运行时通过，每轮 74 次调用。十项拒绝操作、错误版本、错误所属会话的故障控制仍失败。全部 60 条原始断言及顺序逐字一致，原有三秒等待期限和十五秒子进程期限保持不变。未修改生产代码，也未整项重试；然后才冻结最终源码并执行本页第四轮完整组合。详见[完整异步检查点复核](../test-native-workspace-async-checkpoints-20261016.md)。这些可靠性修正不另计产品 UX 项目。

## 开发过程中的失败与独立检查

刷新回归的基线替换验证中，三个用例有两个按预期失败，一个正常默认选择负向控制通过。初版独立评审还发现旧表单提交回调可能仍可调用；候选已补当前渲染许可，使列表重读、缺失结果、切换和隐藏退役旧提交。正向控制同时验证：原批次恢复后，正常启用的用户提交真实执行一次本地 revise；明确放弃并新建后，正常提交真实执行一次本地 create。没有把禁用全部保存作为修复。

范围重试的新回归在基线因缺少独立重试按钮而按预期失败。修正后，独立复核覆盖失败→重复失败→恢复、隐藏期间迟到回执、已编辑字段与搜索保留、店铺隔离及无无关写入。仓库范围有运行时覆盖；活动范围的对应映射仅静态检查，不声称已完成额外活动运行时验收。

作者定向验证和独立评审的边界仍按各自说明保留。刷新作者新工作树第一次类型检查缺少生成的浏览器 fixture；按文档准备后重跑通过。本次整合从已匹配准备的 fixture 开始。前一轮导航修复中发现并修正的两个测试等待时序问题属于此前报告，本次没有重新计为用户体验改进。

## 复现组合

使用根 pnpm 冻结锁文件安装依赖，按根开发说明离线准备已记录数据。分别选定 Node 22.18.0 与 24.21.0，并让子进程 PATH 与 npm 使用相同运行时。在仓库根目录执行：

```sh
node scripts/prepare-real-test-data.mjs
node scripts/audit-real-test-data.mjs
node --test --test-reporter=tap --test-concurrency=1 \
  "test/apps-components/*.test.ts" \
  "test/plugin-apps/*.test.ts" \
  "test/operations/*.test.ts" \
  "test/business-pricing/*.test.ts" \
  "test/operations-adapter/*.test.ts" \
  test/apps-runtime/business-settings-http.test.ts \
  test/apps-runtime/workbench-http.test.ts \
  test/apps-runtime/workbench.test.ts \
  test/apps-host/business-value-projection.test.ts \
  test/apps-host/business-partial-status.test.ts \
  test/business-packaging/packaging.test.ts \
  test/service/packaging-settings.test.ts \
  test/app-hallmark/packaging-evidence.test.ts
npm run typecheck
```

新增文件已在 plugin-apps 通配中，不要重复追加。内部必要隔离构建正常执行。本次发布材料仅代码、测试、分类和人工可读报告；原始执行日志、内部清单和生成产物不在发布范围。

## 未覆盖边界

这不是默认全仓测试、真实浏览器视觉验收、已安装 DSH/Native Host 联调、Windows/macOS 验收或真实商家端到端测试。没有真实商家调用/写入、模型审核、自动提交、安装或部署。刷新保护是挂载期间的输入连续性，不是持久保存；组件卸载、硬刷新或进程退出仍可能清除未提交输入。范围重试没有新增保存、平台初始化或 Agent 准备行为；不作性能加速或线上调用量减少承诺。
