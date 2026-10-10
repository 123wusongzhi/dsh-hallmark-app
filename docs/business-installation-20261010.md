# DSH 经营功能包安装记录

安装时间：2026-10-10（Asia/Shanghai）。用户已明确授权安装到 DSH。本次将已实测的经营功能包，通过官方 CLI 同名更新到正式 Desktop，并重启 Desktop 与其配套 Runtime。

## 已安装内容

- 包名：`dsh-plugin-apps-bundle`，版本仍为 `1.0.0-candidate.56`。
- 本次包 SHA-256：`3bf5c24ad310cb7e0f8c164507312717ad5cea0dd71a97a744d22c6061be2666`。版本名相同，以摘要区分此前性能包 `48844275effa…`。
- 保留此前性能优化、侧栏与收藏，增加经营操作表、上品/调价/库存/归档/促销统一入口、规则与模型审核、采购 SKU 和成本关联、上品 Skill。
- 使用已完成实测的冻结归档安装，没有重新打包工作目录。桌面现已包含这次经营功能。

[冻结经营包](../artifacts/business-live-20261010/dsh-plugin-apps-bundle-1.0.0-candidate.56-business-3bf5c24ad310.tgz) · [实施与 bill 实测记录](E:/project/deepseek_h/Agent-Ozon经营操作-实施与实测记录.md)

## 实际运行核验

| 检查 | 结果 |
| --- | --- |
| 官方安装与包身份 | CLI `0.2.0-rc.2` 同名更新成功；64 个安装文件哈希与实测构建清单全部一致。 |
| Skill 安装 | 4 个 Skill 文件与包内内容一致。 |
| 实际 Desktop 页面 | 19387 Host 返回的 `client.js` 与安装产物一致，仅附加宿主 sourceMap 注释；包含“经营操作”入口。 |
| 经营能力 | 正式 Runtime 发现全部 7 个 `hallmark.plan.*` 能力；提交预算为 300 秒，列表读取可独立进行。 |
| 真实桌面入口读取 | 通过既有聊天绑定调用 Host `businessOperations` 列表，HTTP 200、`ok`，正式库当前为 0 单。隔离测试单未迁入。 |
| 审核链路 | Runtime 已声明 `independentReviewBridgeV1`；指定 Decisions 模型与独立图片子代理代码匹配已实测包。 |
| 凭据配置 | 启动 Runtime 时从已有配置读取 operator token 和系统 `openrouter`，只放入子进程环境，不写入新配置或报告。 |
| 健康状态 | Runtime 与原 Hallmark 后端均返回 `ok`。 |

正式 profile 仍为 `C:/Users/wubil/.dsh/profiles/desktop`；Runtime 仍使用原数据目录 `E:/project/deepseek_h/dsh-hallmark-app/artifacts/apps-a2-bill-runtime-restored`，数据库 schema4。旧有 `nativeSessionAdapter=disabled` 保留；经营独立审核桥不依赖该开关。

本次观察：Desktop 主进程 `36624`，Host `73176`（19387），Runtime `79272`（36994）。PID 会随后续重启变化。原业务网关 4280/4281 及隔离 Web 4198/4291 均保持运行。

## 数据与恢复

安装前确认没有运行中的 Agent 任务、业务写入、构建、预览或挂载。停止正式 Desktop 与 Runtime 后完成插件、profile、数据库和会话备份；数据库副本完整性为 `ok`。

- 原 6 个保存组件、7 个素材、组件版本、连接、聊天绑定、视图和工作台设置保持完整。
- Runtime 原 25 张表中，24 张摘要完全一致；`legacy_aliases` 仅更新启动时间戳，原映射和值不变。
- 130 个会话及状态文件均已备份，内容全部保留。129 个文件字节相同；1 个压缩会话文件的压缩字节变化，解压后的原文完全相同。
- 没有切换正式数据目录，没有导入隔离测试数据。

[插件、配置备份及回滚脚本](../artifacts/desktop-apps-rollbacks/20261009T175524Z-94cd442d7bc44f2888177e3937054c81/rollback.ps1)通过官方管理器恢复原性能包。回滚前需退出正式 Desktop；数据库和会话冷备另行保留，脚本不自动覆盖业务数据。

## 验收边界与证据

本次安装验收使用正式 Desktop 的真实 Host、Runtime、认证接口与页面产物；没有把接口检查表述为原生窗口逐项点击验收。上品、价格调整与恢复的真实 bill 测试沿用同一冻结包此前的实测结果，本次安装核验没有新增店铺写入。

证据目录：[desktop-business-20261010](../artifacts/desktop-business-20261010)。主要文件：

- `frozen/build-manifest.json`、`frozen/package-manifest.json`：安装包与构建身份。
- `installed-business-verification.json`、`host-business-list-verification.json`：实际桌面产物和经营入口。
- `runtime-before.json`、`runtime-after.json`、`health.json`：运行身份、健康状态及数据保持。
- `session-state-preservation.json`、`legacy-alias-preservation.json`：会话内容与原别名映射。
- `cold-state-before/manifest.json`、`desktop-state-before/manifest.json`：冷备摘要。

安装及启动脚本保存在同目录，启动脚本从既有配置读取凭据，不包含明文凭据。没有提交 Git 或推送远端。
