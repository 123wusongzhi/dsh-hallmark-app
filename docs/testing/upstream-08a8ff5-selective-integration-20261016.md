# 上游08a8ff5的选择性整合说明

日期：2026-10-16 UTC。

## 输入与策略

- 本地已验证基线：`27657ff699878b068f8f1bc47a74942ba2616fe3`。
- 上游基线：`08a8ff5510bb0d97b0ae7944a459868d1221822f`。
- 共同祖先：`e36a9a408467b1d6cac6f1654363534c79b2e027`。

两支独立实现了重叠UX修复，但测试强化与素材保护并不相同。不能将上游整树覆盖本地：那会删除提交确认重验证、素材关闭保护，以及既有测试断言和报告。

本提交使用受控`ours`合并策略保留本地树作为起点、记录上游为第二父提交，然后显式加入下表选定的上游改进。**上游成为合并祖先不等于上游全部文件改动均被采纳。** 未选差异按本地版本保留，后续不能依赖普通merge自动重新带入这些已记录但未采纳的历史改动。需要时应按具体提交/文件差异重新审查。

## 生产文件最终选择

| 文件 | 选择及理由 |
| --- | --- |
| `packages/component-runtime/src/apps-react.tsx` | 采用上游完整文件；相对本地只有五态Agent回执提示的等义内联，移除隔离SDK构建对新helper的依赖。prepared/dispatching/accepted/unknown/failed文案与语义不变。 |
| `packages/component-runtime/src/agent-action-status.ts` | 删除不再被引用的helper；状态断言保留，SDK健壮源码目录resolveDir测试不回退。 |
| `packages/plugin-apps/client/business-settings.tsx` | 采用上游完整文件；保留inactive及现有连接/包装/新店草稿期间的外部切店意图；安装目标前验证store及非空connection；组合组成与尚未填表的批量输入纳入dirty；批填消费后清空输入且保留表格待保存标记。 |
| `packages/plugin-apps/client/business-operations.tsx` | 本地为底，仅将500ms重读冷却替换为上游同事件`retryQueued`合并。保持现有`onChooseStore`接口，以及#77恢复后listVerified/失败/版本变化重验证与确认防线。 |
| `packages/plugin-apps/client/workspace.tsx` | 本地为底，移植上游统一`workbenchSelected/workbenchVisible`条件，让外部关闭native视图后的可见fallback恢复读取，隐藏页面继续暂停。保留#87素材关闭提示、保存锁、应用选择防卸载与迟到完成owner导航判断。 |
| `packages/plugin-apps/client/material-library.tsx` | 完整保留本地#87：语义dirty、三方合并、关闭确认、请求后编辑、语义键memo等。上游差异是缺少这些后续保护，不当作应删除代码。 |
| `packages/plugin-apps/client/directory.tsx` | 保留本地真实应用rail保存中禁用及同步检查。 |

其余生产文件在两端相同，保持原字节。其中包含association-overview、business-draft-recovery、information-picker、listing-draft-editor与workbench-board；不得借上游整合替换其它正在独立评审的候选。

## 测试合并选择

- 采用上游`business-settings.test.ts`，增加非空连接验证、既有连接表单意图保留和真实包装组合/批量草稿场景。已有用例保留；fieldset改用精确`business-settings-body`定位，原disabled断言不放宽。
- 本地`packaging-settings.test.ts`原跨连接读取禁用/取消保留行的测试保持，不能被上游较旧文件删除。
- 采用上游`workspace-resume.test.ts`，新增外部native关闭后可见工作台激活及隐藏暂停回归，保留原三个数据恢复/暂停测试。
- 采用上游两个Agent反馈测试，补真实协议身份及各身份字段独立变更覆盖、aria-atomic断言。保留本地三个SDK测试的源码目录resolveDir实现，而非回退到脆弱逐import字符串重写。
- 店铺重读测试仅按批准的新交互契约移除500ms冷却模拟及“不同事件也必须冷却”的断言；保留同事件去重、abort、迟到响应隔离、立即再次取消/重读、错误/空列表/身份/草稿覆盖和历史基线重放入口。
- `business-confirmation-revalidation.test.ts`、`material-close-draft.test.ts`、`workspace-tab-close.test.ts`及其素材替身协议原样保留。
- 保留本地HTTP跨连接路由与拒绝、精确只读恢复次数、保留结果身份、终页cursor oracle、长读与source-preview等历史增强。上游未包含这些本地历史强化，不以整文件替换撤销。
- 未采纳上游仅为harness路径/日志组织的其余改动、业务价格fixture扩展及店铺入口重命名；这些不是本轮已完成的验证宣称。未引入与本地现有组合预览测试重叠的`information-batch-preview.test.ts`拆分，既有`cross-source-material-ui.test.ts`覆盖保留。
- 本轮无新增测试文件，`test/real-data/test-scope.json`保留本地完整登记和细化理由，包括#77/#87；不丢弃旧报告或证据。

## 风险及所需验证

高风险交界是workspace可见性与素材保存导航、经营重读调度与提交重验证、包装dirty与外部连接切换。SDK内联须验证实际隔离构建，不能只用tsc证明。

本整合提交之后，必须在精确冻结提交上分别用Node24.21与Node22.18执行：四业务目录相关测试、SDK全部组件测试、business-settings HTTP及workbench保存/准入契约，再执行来源审计与typecheck；并保存每阶段源码字节hash和完整日志。此处是整合方案记录，**尚不据方案宣称测试通过**，后续实测报告应单独标明准确tested SHA和自然退出。

这不是全仓验收。上游Node24.12的2291项/1失败、旧Node22首轮失败，以及本地此前的默认全仓结果都不能直接代表此合并提交。全仓、非默认.mjs、真实浏览器/桌面Host、真实商家端到端须分别说明实际是否执行。任何新失败均保留，不更改有效断言以求通过。

#87永久pending保存仍可能锁住关闭/应用切换；本次可见fallback修复没有解决未知结果恢复，不能将二者混同。
