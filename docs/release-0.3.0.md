# 0.3.0 源码组件交付记录

状态：2026-10-06 已通过官方 CLI 安装插件 0.3.0，服务升级到 0.3.0，DSH 已重新打开。安装文件与构建文件哈希一致；26 个工具目录和真实后端连接核验通过。原生 GUI 点击验收尚未完成。

安装前再次备份并迁移 4 个临时组件，升级后逐个比对内容一致。已登记“采集商品 · 源码模板”，并在原聊天生成“采集商品 · 源码组件”：读取真实 200 件商品（源总数 367），构建入口字节一致，Agent 可查到草稿目录继续编辑。用户可在本会话组件中“重新读取”后打开。

设计技能与视觉规则已同步到 DSH 全局技能目录，原文件留有备份。证据：artifacts/desktop-install-0.3.0.json、artifacts/post-install-source-0.3.0.json、artifacts/post-install-readiness-0.3.0-final.json、artifacts/desktop-startup-0.3.0.json、artifacts/design-skill-install-0.3.0.json。

## 已实现

- 普通 React/TSX/CSS 工程、任意正常依赖与资源；不经过旧 widget/layout/利润字段显示规则。
- hallmark_open_source_component 登记真实 dist；DSH 精确资源路由与预览服务加载相同字节。
- 原始 BindingData、显式刷新、稳定商品 ID 选择与现有原生 JSON 附件，保留输入文本并等待用户发送。
- 源码/锁文件/资源/dist 的不可变构建、临时草稿与会话归属持久恢复。
- 保存、另存、源码模板复用、历史工作副本、CAS 更新和回退为新版本。
- 真实截图与 buildId 匹配时归档，组件库显示对应缩略图。
- UI 打开的草稿归属当前聊天，Agent 可从 app_info.sessionComponents 找到源码目录继续编辑。
- query-only 临时源码也能显式刷新；打开源码模板时首次读取缺失快照，失败后仍能打开并重试。
- 自包含蓝白商品模板：真实图片、搜索/来源筛选、多选、分页、窄列表/宽表格、深浅主题。
- Agent 技能和 Host 提示改为源码制作、构建、截图、修改的工作流程。

## 验证证据

- 全套 440 项测试通过：artifacts/test-0.3.0.log。
- TypeScript 类型检查与 Host/Client 构建通过。
- 真正 Host→HTTP→Core→SQLite 集成覆盖资源字节、重新启动、归属、首次查询、保存历史与回退。
- 源码模板恢复至不同目录后 npm ci/build 成功，dist 各文件哈希相同，记录在 artifacts/source-template-validation.json。
- CUA 打开 localhost 实际 dist：宽页面、390px 窄页面的真实商品图片和布局已查看；搜索 FS1.5 得到 3 项真实结果。
- CUA 在 iframe 点击/键盘交互时发生 shadow root 与 CDP 输入超时，后续浏览器连接超时。未把点击测试或 DSH 原生 GUI 算作已通过。
- source-capture 产品脚本的 HTTP、参数、交互反馈有测试；本次未通过其他浏览器控制方式绕过上述工具问题启动独立 Playwright。DSH Agent 可按作者指南运行该截图脚本并读图。
- 本次未执行业务平台写入。

## 安装顺序

1. 用户正常退出 DSH；不强杀应用。
2. scripts/reload-local-service-0.3.0.ps1 再次导出全部现存临时组件与数据库备份，核实精确进程与无在途业务写后替换本地服务。
3. 迁移旧临时组件，登记软件自带 source-collected-products-v1 源码模板，启动服务 0.3.0。
4. scripts/install-desktop-0.3.0.ps1 校验归档哈希并调用官方 CLI 更新插件。
5. 同步源码设计技能，正常打开 DSH，核实安装文件、实际服务版本/工具目录/迁移组件与内置模板。

相关说明：docs/source-component-authoring.md；源码起点：component-workspace/collected-products。
