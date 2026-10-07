# DSH Apps A.2 · 审计与后续实施文档包

修订：A.2。日期：2026-10-07。审计提交：`caea8175b5c7507bf942b2e752a7327063bfdd43`。

这是一份**设计/实施评审交付，不是已通过的产品验收报告**。最新仓库已有多应用Runtime、Provider、SDK、共享展示及组合bundle；本包针对原聊天真实创作闭环与可复核证据继续补齐，不要求重做现有底座。

## 阅读入口

解压后打开 [index.html](index.html)，无需网络即可阅读文档正文和附图。访问私有仓库源码证据链接仍需要你自己的GitHub权限。

| 文档 | 页数 | 阅读与编辑 |
|---|---:|---|
| 审计报告 | 18 | [PDF](pdf/00_AUDIT.pdf) · [HTML](html/00_AUDIT.html) · [Markdown](docs/00_AUDIT.md) |
| TODO 实施工作包 | 20 | [PDF](pdf/01_TODO.pdf) · [HTML](html/01_TODO.html) · [Markdown](docs/01_TODO.md) |
| SPEC 软件规格说明书 | 32 | [PDF](pdf/02_SPEC.pdf) · [HTML](html/02_SPEC.html) · [Markdown](docs/02_SPEC.md) |
| 整体架构验收手册 | 43 | [PDF](pdf/03_ACCEPTANCE.pdf) · [HTML](html/03_ACCEPTANCE.html) · [Markdown](docs/03_ACCEPTANCE.md) |
| 补充架构图册 | 15 | [PDF](pdf/04_ARCHITECTURE.pdf) · [HTML](html/04_ARCHITECTURE.html) · [Markdown](docs/04_ARCHITECTURE.md) |

合计128页。前四份为A4纵版，架构图册为A3纵版；图册提供SVG以便独立放大。建议顺序：审计报告 → FIG-16 → TODO-027/028 → SPEC的身份与发布契约 → 对应用例。

## 本次审计范围与证据

审计冻结仓库main读取时的提交，并在审计结束前再次确认未变化。GitHub代码为静态读取，未取得并执行完整checkout。上传HTML的Git blob SHA与仓库原型相同。三张用户图保留各自文件身份，未假定最后一张就是批准版本。

实际执行：HTML内脚本语法检查、输入文件哈希、文档追踪/引用/依赖校验、所有PDF页面渲染与版面检查。浏览器在导航阶段被环境策略阻断，执行的原型UI断言为0；这不是产品失败或产品通过。仓库测试没有重跑；历史570项测试等仅保留REPORTED身份。参阅[evidence/environment-report.json](evidence/environment-report.json)。

原48项追踪的原标签完整保留，其中42项remainingRealStatus为NOT_RUN；本轮80个产品用例的新运行状态全部NOT_RUN。没有修改GitHub仓库、安装/卸载插件、重启用户DSH、迁移原数据库或执行真实业务写入。

## 文件与追踪

- [80项需求/验收追踪](validation/traceability_80.csv)、[24项任务](validation/tasks.csv)、[20项审计条目](validation/findings.csv)、[旧48项与本轮判定](validation/baseline_48.csv)。CSV为UTF-8文本，适合版本管理与导入表格工具。
- [固定源码证据索引](validation/sources.json)、[输入文件清单](evidence/input-manifest.json)、[审计提交](evidence/repository-baseline.json)。源码链接固定至审计SHA，不指向漂移的main。
- `diagrams/FIG-15—19` 各有SVG、PNG、DOT、Mermaid。关系编号与图册中的逐边解释配套；DOT/SVG为布局基准，Mermaid布局可不同。
- `references/inputs/` 为本次HTML与三张图的原样副本；`references/A0/` 为历史目标文档及历史图源，不表示最新代码现状。
- [验收结果模板](templates/acceptance-result.json)、[变更单](templates/change-request.md)、[分范围放行单](templates/release-gates.md)、[回执Schema说明](templates/README.md)。

## 不可误用的边界

`apps.authoring.*`、BuildReceipt/PreviewReceipt、候选发布与拟schema4是新增设计，不是声称仓库已有接口。不能直接调用不存在的方法或对原库套用SQL。现有2→3迁移命令不自动支持拟3→4；实施后需要单独迁移与回退验证。v2扩展采用协商，不能让旧SDK被新增方法名破坏。

模板不填虚构的PASS、截图路径、哈希、运行身份或签名。语法/JSON结构检查不证明实际构建、视觉、原模型消费或业务核实通过。业务写与数据切换分别需要真实目标、环境和证据，不由静态审计代签。

## 本包可重复检查

```sh
python validation/verify_bundle.py
```

该命令只校验文档包的编号、依赖、文件与追踪，不访问业务服务，不运行DSH测试。结果见[文档检查记录](validation/document-validation.json)；版面检查见[evidence/document-layout-check.json](evidence/document-layout-check.json)。文件完整性见`SHA256SUMS`与`validation/package-manifest.json`。
