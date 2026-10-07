# Apps V1 与组件创作设计：发布说明及验证范围

日期：2026-10-07。本次 GitHub 发布在原 Hallmark 项目中纳入 Apps V1 实现、正式测试、构建输入与最新组件创作架构/原型。基础提交为 `cb871b4086508988485dc4a0a5d6aa5440901267`；代码的最终提交身份以 Git 历史为准。

## 本次发布前检查

环境为 Node `24.12.0`。以下检查在本次发布准备期间重新执行，不依赖真实店铺或真实 DSH 会话。

| 检查 | 命令 / 入口 | 结果 |
|---|---|---|
| 全仓测试 | `node --test test/**/*.test.ts` | PASS，570 项通过，0 失败、0 跳过 |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| 原插件构建 | `node scripts/build-plugin.mjs` | PASS，生成 Host / Client |
| 组合 bundle 构建 | `node scripts/build-apps-bundle.mjs` | PASS，candidate.6 安装归档生成 |
| 打包 smoke | `node scripts/smoke-apps-bundle.mjs` | PASS，隔离 Runtime 实际请求 5 次、变更 0 次；未安装到 DSH |
| 交互原型 | [浏览器检查记录](prototypes/chat-component-authoring-browser-check.json)、[使用说明](prototypes/README.md) | 12 项本地界面流程检查；仅示例 HTML |
| 架构图 | [FIG-13 / FIG-14](architecture/chat-component-authoring/README.md) | SVG 与 PNG 同份图源，渲染检查已完成 |

构建与打包命令见[候选说明](apps-v1-candidate.md)。安装包、编译输出及原始验收记录留在本机，不随 Git 发布。

## 历史候选验证与新增设计分别记录

Apps V1 历史候选为 bundle/Host `1.0.0-candidate.6`、Runtime `1.0.0-candidate.4`、数据库 schema 3、HTTP/目录 1、bridge 2.0。此前完成了官方桌面替换、原会话只读查询、原生侧栏与应用工作台的源码组件显示、重开后的卸载清理及最终重装。candidate.5 的本地确定性模型消费和历史前缀重放属于其当时记录，candidate.6 没有重跑该模型路径；不据此宣称外部真实模型验证完成。

原始 `evidence/` 含本机配置、真实 Bill 店铺读取、桌面/会话状态与过程日志，仅作本机归档。公开摘要保留验证范围与限制，不上传这些原始数据；[逐项追踪 CSV](requirements/traceability.csv) 中的 `evidencePath` 是原开发目录归档定位信息，不是 GitHub 文件链接。

新增 A.1 的[原聊天组件创作架构](requirements/03_ARCHITECTURE.md)及[交互原型](prototypes/chat-component-authoring.html)定义目标体验：原会话 `@` 引用应用、原 Agent 创建/编辑独立工作副本、同份构建的真实预览、继续聊天迭代、明确保存与冲突保留。HTML 中的 Agent 回复、构建、预览和登记是本地状态模拟。原生 `@` 与 Runtime 绑定、真实会话/附件桥、v2 预览载体及 Agent 可读的真实视觉反馈仍需接线验收。

真实 Hallmark 调价/库存写入、外部模型性能和原业务数据库正式切换未执行；隔离测试和原型结果不替代这些验收。

## 开发与本机归档工具

干净 clone 使用仓库 README 的依赖安装、测试和构建入口。`scripts/finalize-apps-evidence.mjs` 是原开发机的历史归档工具，依赖未发布的现场记录，并会更新原开发目录中的上级 TODO/CSV；不属于干净 clone 的常规开发命令。迁移、部署、安装和归档脚本需要使用者明确自己的目录与环境。
