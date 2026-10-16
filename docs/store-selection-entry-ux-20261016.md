# 经营操作缺店铺入口：一次性选择并继续

## 范围与已知事实

基线：本地 `bff2acff36d0f1db7efe5bdeba3967fb4aab7190`，公开等价生产基线为 `47f9be21e1697059f4989fac4dc7cc1d411187af`；公开版本仅补入上一项验证报告，生产代码相同。

经营操作在已选聊天、未选工作台店铺时，原先只有“先在工作台选择店铺，再打开经营操作”的文字。关联总览及经营设置已经有自己的选择控件，本次不改变其选择语义。三页店铺上下文不完全统一是另一个设计风险；本次没有证据声称它会误写店铺。

本次只给经营操作空态增加“选择店铺并继续”，导航到既有工作台选择器，待其可用时聚焦。选店仍走原 `selectStore`，保留授权店铺列表、采购试算参数重置、expectedRevision 保存及错误处理。没有新增共享店铺状态，没有更改 API 或权限检查。

## 返回约束

- 点击入口创建一次性导航意图，包含序号、应用和聊天身份；不是店铺状态。
- 工作台只在此次明确选店的保存完成后回报结果。读取工作台、外部 context 事件、其他保存不触发返回。
- 仅成功保存、意图仍为原意图、当前页面仍在工作台且可见、应用/聊天未变、已接受工作台店铺仍匹配所选店铺时返回经营操作。
- 失败消费意图并显示原错误，可重新选择重试；重试成功不会突然自动返回，用户可自行打开经营操作。
- 用户另行导航、换聊天、换应用、离开应用面板或卸载工作区均取消意图。旧回执不能消费后来创建的新意图。
- 关联总览和经营设置的既有独立选店路径不修改；无店铺、无权限或未选聊天时不默认替用户选择店铺。

## 验证与计步

真实 `AppsWorkspace`、`WorkbenchBoard`、`BusinessOperations` 组件，其他无关页面隔离；店铺基于录制快照，身份别名、空工作台及错误/延迟属于显式本地场景控制。所有网络 mock，工作台保存只改本地测试响应；没有商家执行、生产请求、安装或发布。

`test/plugin-apps/business-store-entry.test.ts` 覆盖：

1. 现有路径与新入口的 React 事件计步，以及保存后同一连接读取。
2. 外部 context 变化不能触发返回。
3. 权限拒绝保存后错误可见，继续重试但不自动返回。
4. 切标签后再回工作台，旧保存回执不抢导航。
5. 聊天/应用切换使旧意图失效。
6. 保存中重复选择不发第二次写入；后来新意图不被旧回执消费。
7. 应用面板隐藏后再次显示仍不恢复旧意图。
8. 更高修订的外部店铺上下文阻止旧保存回执返回。
9. 零店铺、店铺列表拒绝、无聊天入口，不绕过现有前置条件。
10. 正常工作台选店无返回意图。

从已在经营操作空态起计：原路线“工作台 → 选择店铺 → 经营操作”是 3 个 React 导航/change 事件；新路线“选择店铺并继续 → 选择店铺”是 2 个。没有浏览器鼠标点击、视觉或真实用户用时实测。

### 重现红绿

```sh
DSH_STORE_ENTRY_BASELINE=47f9be21e1697059f4989fac4dc7cc1d411187af node --test test/plugin-apps/business-store-entry.test.ts
node --test --test-concurrency=1 test/plugin-apps/business-store-entry.test.ts test/plugin-apps/business-draft-recovery.test.ts test/plugin-apps/workbench-store-context.test.ts test/plugin-apps/business-operations.test.ts
node scripts/audit-real-test-data.mjs
node node_modules/typescript/bin/tsc --noEmit
```

红测用原生产组件代码，准确失败于 `Missing 选择店铺并继续`。最终验证：Node 22.18.0 与 Node 24.21.0 均为上述四文件 7/7 通过；两版正式数据 audit 均 PASS（317 testFiles、167 requiredFiles、165 infrastructureFiles、0 failures）；TypeScript `tsc --noEmit` 与 `git diff --check` 通过。独立只读审查未发现阻断项。最初新增历史红测 helper 出现 TS7022 推断错误，显式标注 `SpawnSyncReturns<string>` 后类型检查通过。不以专项通过代替全套或浏览器验收。

旧复用树的忽略文件 `test/real-data/browser-data.ts` 原为跨树软链接，导致正式 audit 首次发现浏览器派生数据与本树 corpus 不匹配。确认链接后只移除链接本身，再用既有 `prepare-real-test-data.mjs` 生成本树配对文件；未修改录制事实或链接目标。首次失败与修正后的结果均保留在独立证据目录。
