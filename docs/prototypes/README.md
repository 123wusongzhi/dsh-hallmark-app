# 原聊天中创建与编辑组件：交互原型

直接双击 `chat-component-authoring.html`，或在浏览器打开该文件。它是单文件离线原型，没有 CDN、外部字体、网络请求或服务依赖。可由原生 DSH 插件承载的效果在此用普通 HTML 模拟；它不操作真实 DSH、店铺或生产 Runtime。

界面保留现有 DSH 左导航、项目与会话列表、原聊天和输入框。蓝白设计只应用于应用工作台与右侧组件。没有新建独立聊天标签或跨整个 DSH 的顶栏。

## 建议体验顺序

1. 在“利润率超过 20% 的商品”原会话操作右侧组件：搜索、排序、门槛、低库存筛选和勾选。
2. 先在输入框写一句正文，再点“附加到聊天”。独立 JSON 附件进入原输入框，正文和右侧组件保留；需要手动点发送。附件可以移除。同一组件、同一数据快照、相同商品选择重复点击不会添加重复附件。从插件工作区附加时返回原会话并保留组件。
3. 输入 `@`，用上下方向键和 Enter 或点击选择 Hallmark / Notes。Notes 不提供商品数据。应用引用属于当前原会话。
4. 点击示例指令或发送“把表格改成商品卡片布局”“增加商品搜索框”“把低库存改成橙色”等。模拟 Agent 依次编辑、构建、预览检查、登记和更新当前展示。
5. 点“保存组件”，确认名称；再继续聊天编辑，点“保存新版本”。应用入口中的组件库支持按版本打开、重命名、删除和回到原会话。明确另存会生成独立资产。
6. 切换到“补货计划讨论”，验证正文、应用引用、附件和组件各自隔离。保存资产可以在另一会话明确打开，view 与工作副本重新创建。
7. 点“查看架构流程”，观察同一份状态中的源码、构建、view 和保存版本身份，并演示构建失败；先明确保存组件后，可以演示保存冲突。这个演示按钮不会替你保存。

本地记录使用 `localStorage`，键名 `dsh-chat-component-authoring-v3`、schema 3。可通过“架构流程 → 导出本地状态”导出 JSON；“重置演示”需确认，只重置原型数据。浏览器拒绝本地存储时，界面给出提醒并继续使用内存状态。格式损坏的旧记录不会被自动覆盖；明确重置后才能重新写入。页面会恢复会话与资产，不伪造未完成构建为成功。

## 可控模拟与检查入口

浏览器控制台可使用 `window.demo`。这些入口只用于原型评审和自动检查，不是生产 API。

```js
demo.snapshot();                       // 克隆后的完整本地状态
demo.command('把表格改成商品卡片布局'); // Promise，约 1.7 秒的本地阶段演示
demo.switchSession('session-stock');
demo.selectApp('hallmark');
demo.save('利润筛选');                  // { ok, assetId, revision }；保存不会自动发生
demo.save('我的副本', true);            // 明确另存
demo.refresh();
demo.simulateBuildFailure();            // 可用 view / build 保持不变
demo.simulateConflict();                // 已明确保存的组件产生冲突对话框；未保存时只提醒
demo.openApps();
demo.openArchitecture();
demo.reset();
```

稳定选择器：`#composer-input`、`#mention-menu`、`#send-button`、`#product-search`、`#profit-threshold`、`#low-only`、`#product-sort`、`#select-all`、`[data-control="select-product"]`、`[data-action="attach-selected"]`、`#attachments`、`[data-action="save"]`、`#asset-name`、`#modal-submit`、`[data-action="session"][data-id="session-stock"]`、`[data-action="open-asset"]`、`#architecture`。大部分操作通过 `data-action` 或 `data-control` 明确标识。

## 评审边界

商品、连接和时间是示例。构建、截图检查、登记和执行反馈是有状态的流程模拟，不运行真实 React 源码、不调用模型，也没有真实生图或原生 DSH 发送。HTML 演示状态隔离、草稿与附件、保存版本和失败保留等交互契约；实际实现仍需接入原生 `@` 候选、会话服务、附件桥、源码工具、构建预览验证和 Runtime。

本原型用单值 `activeApp` 演示当前引用的应用，没有模拟多应用并用或多连接身份澄清。它是原型范围，不代表目标架构只能同时使用一个应用。

编辑当前工作副本成功后保留 `viewId`，只更新其引用的构建；新建组件或明确打开保存资产才分配新的会话 view。打开历史版本时，`sourceAssetRevision` 记录所读源码版本，`baseRevision` 记录打开时资产的最新版本，二者分别显示；保存比较更新基线与当前最新版本。成功保存后，工作副本同步到新保存版本与新比较基线。

组件筛选与排序只改变本地展示。刷新只更新示例快照并处理失效选择，保留组件设计；第二次刷新使“收纳箱”过期，便于演示选择清理。已打开组件关闭或在插件工作区展开均不丢草稿。打开另一个资产、创建新组件或冲突后打开最新版本时，当前未保存工作副本保留在会话的 `parkedDrafts` 中；可在架构流程抽屉中明确恢复。

## 本轮检查记录（2026-10-07）

`node --check` 对 HTML 内的实际脚本通过，`git diff --check` 通过。针对实际 `attachSelected()` 的隔离逻辑检查通过：正文保留、已有消息不变（不自动发送）、右侧组件保持打开、同一快照和相同选择去重、选择顺序变化仍去重、从应用工作区返回原会话并保持组件、新快照生成独立附件。隔离检查使用受控 DOM 边界，不替代浏览器布局验收或真实 DSH 接线验收。

对实际 `runBuild()`、`openAsset()` 和 `saveAsset()` 的身份与版本隔离检查也通过：编辑保留 view 并更新 build、新建分配新 view、打开历史源码 v1 时更新基线取最新 v2、历史副本编辑保留已打开 view、按基线保存生成 v3、并发出现 v4 后拒绝静默覆盖。阶段反馈明确使用“模拟预览与交互”措辞。

头部“应用工作台”和“查看架构流程”均设有显式 `aria-label`，窄屏隐藏文字时仍可识别。
