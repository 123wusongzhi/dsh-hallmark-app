# 0.2.1 界面纠偏与加载检查

日期：2026-10-06。根据用户对实际 DSH 截图的反馈，修正工作台与此前蓝白设计稿的差异。

**当前状态：独立服务已加载 0.2.1；用户确认退出后，DSH 桌面已通过自带官方 CLI 更新 0.2.1 并重新打开。已核实安装版本、文件一致性、启用状态与启动初始化请求；尚未完成本版原生 GUI 全流程验收。**

## 本次调整

- 恢复蓝白视觉层级：应用侧栏、图标、选中态、主操作按钮、卡片与次级文字。实际 DSH 的 `--dsw-alias-brand-primary` 是浅色黑、深色白；之前把它当作蓝色，同时 fixture 自行给它蓝色值，掩盖了真实界面的差异。现在产品蓝独立定义，中性表面和文字继续适配宿主。
- 深色样式使用真实宿主信号 `body[data-ds-dark-theme]`；隔离测试按实际宿主 token 验证。
- 保留 DSH 原生左栏，第二栏展示应用列表；右侧保留浏览器式工作区标签，分为工作台、组件库与组件设计。常用入口、最近保存组件和模板有明确展示位置。
- 保留原聊天导航、已保存组件、编辑草稿及更新/另存为流程。商品选择仍附加到原输入框，保留原文，由用户确认后手动发送。
- 工作台增加真实只读概览和店铺商品快照表。未知数量为 `null`、显示“—”，不以零补齐。商品数量包括已归档商品，不标为在售数量；读取时间与来源快照时间分别表达。没有构造利润率、增长率或利润曲线。

## 真实只读证据

来源为 `http://127.0.0.1:4280` 的 `hallmark-board`。独立服务健康检查返回 0.2.1、25 项工具，目录一致、来源状态 `ok`。见 [就绪检查](../artifacts/live-readiness-0.2.1.json)。

[概览结果](../artifacts/live-overview-0.2.1.json)记录：367 个采集产品、415 个店铺商品、2 家店铺，商品数分别为 338 和 77。概览读取于北京时间 2026-10-06 13:25；两家店铺的来源快照约为 11:59。这些是服务真实只读结果，不是合成截图中的展示数据，也不等于原生 DSH UI 已验收。

独立服务在确认空闲后精确重启，PID 从 46248 变为 34300。原数据目录、SQLite 与 service-key 保留；重启前的 [应用数据备份](../artifacts/pre-ui-0.2.1-app-backup.json)已落盘。未重启 DSH 或来源 Board，未执行真实店铺写操作。

## 验证与待加载事项

最终验证：382/382 项 Node 测试、39/39 项工作台浏览器断言、19/19 项选择/图表浏览器断言、13/13 项刷新竞争与取消断言通过；TypeScript 检查和 Host/Client 构建通过。归档为 `artifacts/dsh-plugin-hallmark-0.2.1.tgz`，SHA-256 见 [发布摘要](../artifacts/release-0.2.1.json)。

证据：[Node 回归](../artifacts/ui-redesign-regression.log)、[工作台](../test/browser/artifacts/results.json)、[选择与图表](../test/browser/selection-artifacts/results.json)、[刷新](../test/browser/workbench-refresh-artifacts/results.json)。刷新失败保留上次成功概览与读取时间，明确显示未更新；其他配置请求失败不再掩盖成功的概览，切换连接取消旧请求。

已目检 [首次进入](../test/browser/artifacts/workbench-first-visit.png)、[组件库](../test/browser/artifacts/component-library-light.png)、[深色](../test/browser/artifacts/workbench-dark.png)、[窄屏](../test/browser/artifacts/workbench-mobile.png)。最近组件按图表类型显示布局示意，不作为真实数据缩略图。

浏览器截图及断言来自独立 fixture，只用于布局、主题和交互回归。不能据此宣称新版已经出现在用户 DSH 窗口内。

- [x] 最终测试、类型检查、构建与 0.2.1 归档摘要已完成。
- [x] 用户正常退出 DSH 后，用当前安装目录自带的官方 CLI 更新插件，exit 0；没有直接改 profile 或 ASAR。
- [x] 已重开 DSH，主进程 PID 35708。desktop profile 指向 0.2.1 归档，包版本为 0.2.1、bundle 启用；已安装 Host、Client、bundle patch 的 SHA-256 与构建产物一致。
- [x] 重开后的 13:38:38 观察到独立服务 `/tools` 初始化，随后原会话 `/app` 成功读取；安装后只读就绪检查通过。见 [安装核验](../artifacts/desktop-install-0.2.1.json)、[就绪检查](../artifacts/post-install-readiness-0.2.1.json)。
- [ ] 在真实 DSH 中取得 `hallmark_app_info.hostPluginVersion=0.2.1` 自报，并查看应用侧栏、工作区标签、概览、组件库与深浅主题。安装文件与启动请求不替代原生完整交互验收。
- [ ] 在原聊天完成商品列出 → 勾选 → 附加输入框 → 人工发送的原生交互验收。

Board 上品分派兼容差异、其余原规格业务事项继续见 [开发检查点](pause-todo.md)。本版界面调整不代表这些事项已经完成。
