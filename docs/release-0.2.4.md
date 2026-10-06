# 0.2.4 安装记录 · 2026-10-06

用户要求将附件与本会话组件管理安装到 DSH，再提供开放源码模板能力方案。已通过随桌面安装的官方 CLI 安装插件 **0.2.4**，配套独立服务更新为 **0.2.2**，并重新打开 DSH。

## 本次安装的功能

- 商品选择生成原生 JSON 文件附件。保留聊天正文，用户手动发送；Agent 指令已补充读取文件和核实稳定商品 ID。
- 本会话组件列表提供管理、重命名和确认移除。移除后原会话读取、编辑和保存失效，保留全局已保存设计和业务数据。
- Manifest 增加 Conversation 客户端服务注入。附件兼容适配器按实际接口检测，详情见 [selection-attachments.md](selection-attachments.md)。

原始模板源码编辑、Vite 构建和视觉反馈尚未实施。本次新增方案见 [source-component-plan.md](source-component-plan.md)。

## 安装与运行证据

- 发布前 415/415 Node 测试、TypeScript 检查、Host/Client 构建通过。
- 归档 `artifacts/dsh-plugin-hallmark-0.2.4.tgz`：474243 bytes；SHA-256 `350ae13c260479a03e8f2fc419c301ecb7b433f0f0e771e63cca114c931507a6`。
- 官方 CLI 安装成功，`plugin list` 列出 `dsh-plugin-hallmark@0.2.4`。工作区与 desktop 安装目录的 Host、Client、patch 和 manifest 哈希一致。
- DSH 已重新打开，启动 PID 63960。独立服务 PID 71060，健康版本 0.2.2，25 项工具目录匹配。
- 只读就绪检查通过：Hallmark Board 4280 正常、367 个采集产品、2 家店铺。验证没有执行平台写入。
- 已观察到安装后原生链路发起会话组件工具与详情读取请求；HTTP 请求成功不作为 Agent 视觉质量或附件交互验收。

证据：[发布摘要](../artifacts/release-0.2.4.json)、[官方安装日志](../artifacts/desktop-install-0.2.4.log)、[安装文件核对](../artifacts/desktop-install-0.2.4.json)、[最终只读就绪](../artifacts/post-install-readiness-0.2.4-final.json)。

## 本次遇到并解决的问题

开始安装时 DSH、4180 插件服务和 4280 业务端口均未运行。已用一致性只读导出备份持久应用数据库，未修改其保存内容。

Hallmark Board 启动失败，原因是旧 writer 锁遇到 PID 复用：锁记录 PID 12068 和 2026-10-05 创建时间，当前该 PID 已是次日启动的 Blender MCP。核实没有 Board 进程或相关端口后，将精确旧锁归档，再启动原 launcher。没有终止 Blender 进程或修改 Hallmark 源码。

归档与恢复记录见 [source-recovery-0.2.4.json](../artifacts/source-recovery-0.2.4.json)。后端最终健康已核实。

旧服务已在本轮开始前退出，因此此前只存内存的未保存组件无法补导出。已保存组件、模板、快照和配置保留并有备份；不把未保存组件恢复写成已完成。

## 给 Agent 的原则

已同步项目、本地 staging 和 DSH 安装技能中的两份文件，并核对哈希：先开放普通前端源码制作能力，实际使用出现具体问题后再局部处理。旧 ViewSpec 白名单仅记录现状，不作为新源码模板通路的永久规则。设计技能文件已更新；现有模型上下文是否重新读取不由文件安装本身保证。

记录见 [hallmark-source-principle-installed-2026-10-06.json](../artifacts/hallmark-source-principle-installed-2026-10-06.json)。

## 仍待实际界面验收

原生附件上传、移除、发送与 Agent 读取；管理区布局和键盘操作；跨会话及多标签失效状态。本轮未取得这些原生界面的操作截图，保持 `nativeGUIVerified=false`。
