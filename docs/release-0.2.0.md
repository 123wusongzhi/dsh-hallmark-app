# 0.2.0 开发交付与加载检查

日期：2026-10-06。用户已恢复开发，并明确选择“勾选产品 → 附加到当前输入框 → 补充要求后手动发送”。

## 本次完成

- 商品表格接入 TanStack Table 8.21.3 与局部 shadcn Table 源码，支持排序、分页、稳定产品 ID 勾选。最多选中 100 个；排序和翻页保留选择，快照更新使旧选择失效。
- 插件通过 DSH 公开 `inputActions.captureInsertion/insertText` 附加可见 JSON 上下文。保留原文、不覆盖高亮文字、不自动提交。工作区会精确返回原会话；会话切换取消待附加内容。
- 上下文只含视图、绑定、数据集和原始产品身份，不复制商品整表。拒绝重复、冲突、跨店和过期身份；转义宿主会过滤的字符，避免 ID 被静默改变。
- 折线和柱图接入 Recharts 3.10.1，保留数据来源、时间、利润口径和数值表。
- json-render core 0.21.0 用于实际 catalog 校验和派生树渲染。ViewSpec 仍是唯一保存格式。
- 保存组件可打开为独立草稿，支持更新原件、另存为、版本冲突检查。首次保存后继续编辑使用新草稿 ID，避免未保存预览遮住保存版本。删除原模板后仍可编辑保存设计。
- 组件控制台在工作台内切换时保留状态；保存入口可置顶常用列表；同窗口组件保存与数据刷新会通知对应展示区域更新。
- 正式接通类目六模式与采集查询快照、精确数据集键和只读刷新配方。新增 `hallmark_open_component`，工具目录共 25 项。

## 宿主兼容选择

实际安装的 DSH 前端共享 React 18.3.1。`@json-render/react` 已发布版本要求 React 19，因此本次使用 core 加宿主兼容的自定义 React 渲染器，没有修改 DSH 核心或打包第二份 React。

shadcn 采用 Table 局部源码与 `hm-*` 样式适配，不是全量 Tailwind 组件集。详见 [运行时决策](decisions/0003-component-ui-runtime.md)。

## 验证证据

| 验证 | 结果 | 范围 |
| --- | --- | --- |
| Node 全量回归 | 373/373 通过 | [连接修复后日志](../artifacts/live-connection-regression.log)，合成/本地测试 |
| TypeScript | `tsc --noEmit` 通过 | 全项目 |
| 插件构建 | 通过 | Host/Client 版本均 0.2.0 |
| 工作台浏览器 | 28/28 通过、0 运行错误 | [结果](../test/browser/artifacts/results.json)，隔离 fixture |
| 选择与图表浏览器 | 19/19 通过 | [结果](../test/browser/selection-artifacts/results.json)，0 消息提交、0 业务请求 |
| 截图复核 | 已查看 | [选择与输入框](../test/browser/selection-artifacts/selection-to-chat.png)、[工作区](../test/browser/artifacts/workspace-tabs-light.png) |

浏览器最初在沙箱中于页面载入前发生 Chrome GPU 进程崩溃；自动审批允许在沙箱外运行同一合成 fixture 后完成测试。测试只使用项目独立 profile，没有接管用户浏览器。图表还验证了折线、正负柱形、隐藏恢复、窄容器缩放与临时无效配置修正后的恢复。

## 安装包与实际加载

安装包：`artifacts/dsh-plugin-hallmark-0.2.0.tgz`。最终 SHA-256 见同目录发布摘要。

用户完全退出 DSH 并明确授权后，已通过安装目录自带官方 CLI 更新成功，exit 0；desktop profile 的包路径、已安装包 manifest 均为 0.2.0，bundle 保持启用。桌面已重新启动（主进程 PID 40416），随后向独立服务发起 `/tools` 初始化及原会话请求。尚未通过真实 DSH 的 `hallmark_app_info` 再次取得 `hostPluginVersion` 自报结果，完整原生点击交互未验收。

独立服务已于 2026-10-06 重启为 0.2.0，实际 `/health` 返回版本 0.2.0、工具 25 项；与源码工具目录一致，来源状态为 `ok`。

本次核实用户真实后端是 `http://127.0.0.1:4280` 的 `hallmark-board`。修复了只识别旧 `hallmark-control` 的健康校验，并保留错误状态、限流与未知身份拒绝。真实只读结果：367 个采集产品，ID 全部为非空且唯一字符串；2 家店铺。证据：[就绪检查](../artifacts/live-readiness-0.2.0.json)。这些是 Adapter 与独立服务证据，尚非 DSH 原生 UI 验收。

重启独立服务前已只读备份应用库，确认业务操作表为空。精确停止旧 PID 69568 后启动新 PID 46248，保留原数据目录、SQLite 和 service-key；这是 Windows 进程重启，不是热重载。未停止 DSH、原 Board 或其他应用，未执行真实业务写。

加载顺序：

1. 独立服务已完成加载，现有进程以 `HALLMARK_CONTROL_URL=http://127.0.0.1:4280` 连接真实来源。后续手动启动时也要显式保留该变量，不能回退默认 4173。
2. 优先使用当前桌面 DSH 的官方插件管理器安装该归档（本 Codex 会话没有此工具）：

   ```text
   install_bundle target=file:E:/project/deepseek_h/dsh-hallmark-app/artifacts/dsh-plugin-hallmark-0.2.0.tgz registry=https://registry.npmjs.org
   ```

3. **已执行成功**：[官方安装脚本](../scripts/install-desktop-0.2.0.ps1) 验证进程退出、归档摘要及自带 CLI 版本（0.2.0-rc.2），再执行 `plugin --profile desktop add <归档> --registry=https://registry.npmjs.org --ignore-scripts`。不直接编辑 profile/ASAR，不使用 PATH 中的旧 CLI。源码要求完全退出 DSH 后管理 desktop profile，用户已完成退出。依据：[官方 CLI](../test/spike/install-evidence/dsh/node_modules/@deepseek-ai/dsh/lib/plugin-BGnVfe_D.js)。
4. 用实际 `hallmark_app_info.hostPluginVersion=0.2.0`、25 项工具目录、原生组件列表和输入入口验证加载。Host 与独立服务必须同版本工具目录，否则契约一致性检查会拒绝启动。
5. 在已启用 Hallmark 的原聊天中，用真实采集产品执行只读验收：列出 → 勾选 → 附加 → 人工发送分析要求。原生输入是结构化文本，当前不是自定义附件卡片。

初始默认 4173 不可达导致的离线判断已由实际 4280 检查纠正。验证只在既有本机服务客户端内部使用应用 service-key，没有读取原项目 human-token 或店铺凭据。

## 尚未完成的验收与原规格事项

- 0.2.0 已完成官方安装，实际来源只读连通；原生 GUI/聊天中选中→附加→手动发送的完整现场验收仍未完成。
- 本聊天没有 DSH 的原生 Inspect 工具，原生窗口控制当前不可用。已安装版本与初始化请求不能替代 `hallmark_app_info.hostPluginVersion` 的实际自报及 UI 交互验收。
- Board 没有 `POST /api/assignments`，当前旧 Control 分派链尚未适配 Board；只读就绪不代表上品或其他写路由已验收。
- 采集查询保留 Source 顺序；目前没有可靠“最近采集时间排序”合同，不能宣称已实现全箱按时间排序。
- 可交互范围是当前加载的快照，不是后台全店分页/筛选；派生组件树只引用注册组件，没有开放任意代码执行。
- 打开另一个设计或选择新模板会替换编辑器当前草稿；普通工作台标签切换保留草稿。
- 页面内手动保存/刷新通知已实现；后台定时刷新自动推送到所有窗口仍未接通。
- 正式归档 Core 工具、全局源 SKU 成本 CAS/未知锁、原四工具素材链路、可信命名规则和活动合同仍按 [全规格矩阵](spec-status.md) 追踪。
- 真实业务写、24–48 小时稳定性与登录自启未验收。开发授权不等于真实调价、库存或上品指令。

安装时 pnpm 报 peer 警告及现有 dshmarket 构建脚本忽略提示。已逐项确认 Hallmark 的 7 个 peer 与真实 ASAR 宿主版本相符；profile 不独立安装这些宿主 peer。dshmarket 原已构建的 `lib/index.js` 与 `client/client.js` 仍在，bundle 启用，pendingBuilds 为空；没有执行额外第三方构建脚本。详见 [安装核验](../artifacts/desktop-install-0.2.0.json)。
