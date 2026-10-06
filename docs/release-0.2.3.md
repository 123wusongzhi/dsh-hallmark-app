# 0.2.3 组件设计与技能安装记录

2026-10-06。已完成源码、测试、构建和归档，用户正常退出 DSH 后，已通过自带官方 CLI 安装并启用 **0.2.3**。DSH 于 15:01:06（+08:00）重开，主进程 PID 68456。独立服务保持 0.2.1、PID 34300，本轮未改共享服务工具契约或重启服务。随后已安装五个设计技能；原生 GUI、技能发现与真实 Agent 设计效果仍待验收。

## 实际改动

- 直接改商品表渲染器：紧凑标题、搜索、选择工具栏、两行长标题、可读日期与原值提示、固定表头、内部滚动、分页、明暗主题。单组件不再重复展示两个主标题。
- 搜索和排序仅作用于已加载快照。跨页选中保留稳定产品身份，筛选隐藏选择明确计数；刷新/归属变化立即清除旧选择。默认每页 10 条，尊重组件显式指定的页大小。
- 日期只识别严格有效的 ISO 时间或日期。导入时间保留原列名；原始数值、零值、负值和利润缺成本/口径语义保持。
- 来源和口径收进可展开证据区；更新失败、操作记录时间与 imported/on_sale 边界仍可见。
- 新增 Host 设计指南和三份合法 ViewSpec 配方。激活会话通过 systemPrompt 获得设计流程；render/update 工具说明指向 `hallmark_app_info.data.designCapabilities`。工具注册时派生描述，不改与服务严格比对的共享目录。
- 配方是 Agent 的参考，不是已保存组件或新 templateId。不添加任意 HTML/JS，不生成假业务数值，不自动保存或发送。

仍使用经过适配的 shadcn Table primitive、TanStack v8 和 Recharts；没有导入完整 Tasks 模板，也没有宣称仅靠提示词已经验证 Agent 的审美表现。

## 验证

- Node 回归 **403/403**；TypeScript 与插件构建通过。
- 专用实际组件浏览器 **26/26**：1040px/420px、浅深主题、50 条单页内部滚动、局部搜索、隐藏选择、稳定 ID、保留原草稿和附加不发送。
- 选择/图表 **19/19**，聊天面板 **20/20**，工作台 **39/39**。
- 所有浏览器验证使用合成数据与模拟宿主；不视为真实 DSH 的原生 GUI 或实际模型生成验收。

[宽屏预览](../test/browser/component-artifacts/component-wide-light.png) · [窄栏深色](../test/browser/component-artifacts/component-narrow-dark.png) · [50 条显式页大小](../test/browser/component-artifacts/component-spec50-light.png)

## 安装与只读联通

- 官方 CLI 安装成功，desktop manifest 为 `0.2.3`，bundle 已启用，依赖指向本次归档；见 [安装日志](../artifacts/desktop-install-0.2.3.log)。
- 归档 `artifacts/dsh-plugin-hallmark-0.2.3.tgz` 为 469290 bytes，SHA-256 为 `891dee0fc20614bda7a18b0a673cd94a9480facf626797c258168c8c19095099`，与发布摘要一致。
- Host、Client、`cordis.patch.yml` 在归档、工作区和 desktop 安装目录三方逐字节一致。共享 contracts 与已验证的 0.2.2 归档相同。
- DSH 重开后的启动请求已观察到：07:01:09.104Z `/tools`、07:01:11.054Z 原会话 `/views` 以及随后组件详情和 `/data` 均返回 200；这些请求早于 07:01:22 的只读检测脚本。见 [桌面启动请求](../artifacts/desktop-startup-0.2.3.json)。这证明初始化与原组件读取已发生，原生 `hallmark_app_info` 的 Host 版本自报仍未直接观察。
- 重开后只读检查通过：来源 `http://127.0.0.1:4280`、独立服务 `0.2.1`、25 项工具目录一致、367 个采集产品、2 家店铺；未执行平台写入。见 [只读就绪记录](../artifacts/post-install-readiness-0.2.3.json)。

上述检查证明安装文件与只读服务联通；不等同于原生窗口效果或实际模型生成验收。发布摘要见 [release-0.2.3.json](../artifacts/release-0.2.3.json)。

## 设计技能

已安装 `impeccable`、`shadcn`、`json-render-core`、`json-render-shadcn`、本地适配 `hallmark-component-design` 至 `C:\Users\wubil\.dsh\skills`，文件哈希核验通过；Impeccable 引擎探测返回 `impeccable-engine 0.1.11`。来源固定提交、许可和文件摘要见 [安装清单](../artifacts/design-skills-installed.json)。

推荐 `/hallmark-component-design` 作为运行时组件设计入口：先读取 Host 的 `designCapabilities`，在本项目实际支持的 ViewSpec 内应用设计方法。官方 `shadcn` 的 `user-invocable:false` 保留，仅供模型按需加载，不承诺它出现在斜杠菜单中。外部技能的源码开发、React/Tailwind 安装和 json-render 示例不能直接作为 Hallmark 展示工具输入。详见 [技能安装与使用](design-skills-install.md)。

本次尚未直接观察 DSH 原生技能发现。文件安装与引擎探测不证明技能已被本轮 Agent 调用，也不证明视觉质量已达标。

## 仍待完成

- 在原生 DSH 核实 `hallmark-component-design` 的技能发现与调用，并通过 `hallmark_app_info` 确认运行 Host 的版本和设计能力目录。
- 完成原生宽/窄侧栏、明暗主题、勾选附加保留草稿与人工发送流程验收；保留 `nativeGUIVerified=false`。
- 用真实 Agent 的新建、修改、保存任务验证设计质量。当前测试能证明协议与交互，不能证明模型一定生成美观组件。
- 在取得实际效果证据前，保留 `agentDesignQualityVerified=false`；后续设计调整依据真实生成组件与用户反馈。选型过程见 [GitHub 研究](agent-design-github-research.md)。
