# Apps V1 离线迁移、回退与资产清理运行手册

本手册对应 SPEC 的 PROC-MIG-01、PROC-RBK-01，以及 TODO-023/024/025。实现版本为本仓库 Apps V1 候选代码；Node 需要支持 `node:sqlite` 和原生 TypeScript（本次夹具运行版本 v24.12.0）。命令均从 `dsh-hallmark-app` 目录运行。

当前证据来自合成 schema-2 副本，证明迁移、备份、回退判定、GC 和实际 Runtime 组合根的代码行为。真实业务库、Host 安装、外部业务写入与生产切换均为 `NOT_RUN`。夹具通过不表示 G0–G4 或生产发布已获准；实际切换仍要求这些门禁的独立证据。

## PROC-MIG-01：准备副本并检查

1. 停止旧入口接收新请求和所有旧业务写入。核查未决操作的原始 operationId/taskId/requestId，保留只读回查结果。软件切换不会撤销外部业务。
2. 确定离线源数据库、资产根和一个新的目标目录。此实现要求目标独立于源资产目录，源库保持 schema 2；不能把目标指向原目录或其子目录。
3. 由操作者明确给出旧 Hallmark 后端对应的 connectionId。不能用店铺名、storeId、默认端口推断连接。连接配置文件只包含显式路由，令牌由独立运行配置提供。

示例连接映射（路径和 ID 必须替换为已核实值）：

```json
{
  "appId": "hallmark",
  "connectionId": "verified-backend",
  "displayName": "Verified legacy backend",
  "config": { "baseUrl": "http://127.0.0.1:4173" },
  "configRevision": 1,
  "enabled": true
}
```

只读 dry-run 命令：

```powershell
node scripts/migrate-apps.mjs --source "E:/offline-copy/app.db" --source-directory "E:/offline-copy" --target "E:/apps-candidate" --connection-file "E:/operator/connection.json" --offline-confirmed --report "E:/operator/migration-dry-run.json"
```

`--offline-confirmed` 是停写检查的明确断言，不会替操作者停止旧服务。工具拒绝检测到的源 writer 文件和目标 writer lease；无法通过文件证明旧服务的全部网络写入均已停止，因此仍需实际进程及入口核查。dry-run 不创建目标库、不修改源库。报告为 `needs_migration` 时退出码为 2。

逐表核对 `counts.source = counts.mapped + counts.quarantined`；检查每条 `records` 的源 ID 和目标 ID、26 项 `legacyTools`、`datasetAliases.canonicalBinding`、所有文件 SHA256、`assetErrors` 与 `unresolvedOperationIds`。任何未知工具/连接/记录形状、孤儿入口、无法确认的 view owner 或缺失历史版本均阻止 apply。原记录保留在 Provider 命名空间或完整数据库备份中，报告列出隔离原因，不能把隔离数量写成转换成功。

## 一致备份和离线 apply

完成审阅后，对同一离线副本执行：

```powershell
node scripts/migrate-apps.mjs --source "E:/offline-copy/app.db" --source-directory "E:/offline-copy" --target "E:/apps-candidate" --connection-file "E:/operator/connection.json" --offline-confirmed --apply --report "E:/operator/migration-applied.json"
```

apply 取得目标 `runtime-writer.json` 独占 lease，使用 SQLite backup API 生成一致数据库副本，包含已提交的 WAL 内容；不会仅复制正在打开的主 db 文件。备份位于目标的 `backups/migration-<hash>/`，包含 `app.db`、`export.json`、`manifest.json` 与实际 `assets/`。manifest 为数据库和每个所引用文件记录字节数、SHA256，并核对数据库逻辑指纹。源码工程、dist、历史构建、已存在的预览、spill 文件以及 pending-closures 恢复文件均纳入所引用资产清单。额外恢复文件可通过程序接口 `MigrationOptions.recoveryFiles` 显式传入；CLI 当前自动处理 pending-closures。

`apps.db` 是独立的 schema 3。所有目标集合必须为空；重复执行同一迁移会验证原备份及目标资产后返回原 migrationId，输入发生变化则不能复用已有目标。失败的目标保留供诊断，不会覆盖源库或自动恢复业务写入。重新运行前先审阅失败原因和已有目标状态。

迁移后的源码归档固定为 `source-components/builds/<buildId>/`，与 `composeAppsRuntime`、SourceComponentStore 和 GC 同一根目录。历史普通源码和 dist 可离线打开；保存资产的原字段另存于 Provider 记录，新公共组件/入口/模板使用严格契约。历史保存组件 owner 保持 null；有明确原 owner 的草稿保持原 sessionId；打开保存组件时显式创建新会话草稿，不能自动认领原草稿。

数据入口在同一保存资产中保留原 `legacyBinding` 和 `legacyFieldOrder`，供旧界面回显 query、fieldMap 和原列顺序；执行仍只使用 canonical DatasetBinding。组件入口的 assetId 与 componentId 独立，显式更新历史保存组件会保留原入口 ID、pin/order，不创建第二条入口。

保存组件及历史版本保留原 resolved template 快照为 `legacyTemplate`；原模板删除后，快照仍可用于编辑回显。迁移后的组件、入口和模板先通过当前 shared descriptor 严格 Schema，未知 metadata 或无效公开形状隔离并阻止 apply。

数据身份使用 SPEC 10.3 的 `dataset:v1:<sha256>`，旧 datasetKey 有显式 canonicalBinding 别名。迁移快照标记 stale；原来源时间缺失时 sourceDataTime 保持 null，不能用迁移时间冒充数据时间。原 24h result_sets 和内部任务记录保留原过期信息。迁移历史快照的可选择资源列表为空，刷新得到当前 ResourceRef 后才可进行新的选择操作。

未决旧操作保留原 operationId 并以 unknown/inspect_only 导入，不会重发旧 mutation。内部领域证据和 Runtime 记录使用同一 operationId，原 taskId/requestId 和来源记录可追踪。pending-closures 的会话不重新启用。

## 验证与切换门禁

切换前在隔离目录验证 strict `list_saved`、历史 source/dist/manifest、原快照字段、连接绑定和所有操作映射；不能以组件名称猜测资源匹配。生成真实 G0–G4、唯一 writer 和未决操作核查文件，例如：

```json
{
  "oldWriterStopped": true,
  "runtimeWriterCount": 1,
  "gateStates": { "G0": "VERIFIED", "G1": "VERIFIED", "G2": "VERIFIED", "G3": "VERIFIED", "G4": "VERIFIED" },
  "unresolvedOperationIds": [],
  "migrationStatus": "migrated"
}
```

这些值必须引用真实证据填写；示例不构成放行。门禁检查命令：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode cutover --evidence "E:/operator/cutover-evidence.json" --output "E:/operator/cutover-report.json"
```

工具只判定证据，不启动、停止或切换服务。任何 gate 未验证、旧 writer 未停止、writer 数量不为 1、迁移未验证或存在未解释操作时 `allowed=false`。实际切换记录应附 cutoverAt、候选包版本、schema 版本、connectionId、备份 ID、进程身份及 Runtime identity。

## PROC-RBK-01：冻结与有条件回退

正式切换前保存基线：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode baseline --output "E:/operator/rollback-baseline.json"
```

回退时先冻结新入口，停止新的业务分发，再导出判定：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode rollback --baseline "E:/operator/rollback-baseline.json" --cutover-at "2026-10-07T00:00:00Z" --output "E:/operator/rollback-report.json"
```

基线比较保留原 ID，覆盖新增操作、保存组件版本、保存资产及绑定变更/删除。所有 maintenance 查询默认使用只读 schema-3 连接。

- 分支 A：没有新增业务/用户资产/绑定，且不存在 queued/dispatching/pending/unknown，才允许依据已验证备份讨论旧格式恢复。仍需核对服务版本和唯一 writer，不会自动恢复旧服务。
- 分支 B：任何新操作、保存或绑定增量都必须导出；一条 succeeded 与一条 unknown 同时存在时，两条记录及成功回执均保留，禁止直接还原旧 app.db 后恢复写入。先只读回查 unknown，优先使用能读取 schema 3 的兼容代码；旧格式接管需另行完成可验证的增量迁移。

报告总是 `freezeRequired=true`、`externalBusinessReversed=false`。没有充分证据时保持冻结；反向业务操作必须经应用显式能力产生新的操作记录。

## 引用 GC 与存储策略

默认仅列出清理计划：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode gc --output "E:/operator/gc-plan.json"
```

默认保留期为 7 天。报告包括候选、字节数和保留原因；引用来自草稿、保存组件及历史、模板/入口、操作/调用/运行记录、Provider 记录、上下文和迁移证据。保存版本不自动过期；时间未知的记录保守保留。当前 apply 范围为无引用构建、旧临时 view、无引用 dataset；磁盘 spill 和其他恢复/诊断文件保守保留，不在本版直接删除。

审阅每个最终绝对路径后，在 Runtime writer 已停止的隔离目录显式执行同一计划：

```powershell
node scripts/apps-maintenance.mjs --directory "E:/apps-candidate" --mode gc --plan "E:/operator/gc-plan.json" --apply --output "E:/operator/gc-applied.json"
```

apply 取得独占 lease，验证记录状态摘要与候选引用，拒绝过期计划、路径变化、符号链接和越界目标。无引用 view 的 source 引用解除后，其 build 可在下一次 dry-run 重新评估。操作、历史版本及迁移证据不会被清理。writer lease 残留时应先核查进程，不自动删除 lease 规避唯一 writer。

## 可复现证据

```powershell
$env:APPS_MIGRATION_EVIDENCE_DIR = "E:/project/deepseek_h/dsh-hallmark-app/evidence/apps-v1-20261007/P5"
node --test test/apps-migration/*.test.ts
Remove-Item Env:APPS_MIGRATION_EVIDENCE_DIR
```

测试创建独立临时源库及构建，验证后删除临时夹具；JSON 报告保存计数、映射、哈希、判定和断言结果，报告中的临时文件路径不是发布资产下载路径。测试同时覆盖：11 个旧集合、26 工具映射、历史两版、WAL 一致备份、篡改/孤儿/未知表阻断、关闭意图、可重入、双 writer 阻断、成功与 unknown 两条回退增量，以及 GC 引用保护。实际 composeAppsRuntime 验证 strict 保存目录、历史 source/dist/manifest 与缓存，旧 query/fieldMap/列顺序完整保留；用户显式保存打开的历史版本后，版本递增且保留唯一原入口及 pin/order。

证据目录：`P5/TODO-023/migration/`、`P5/TODO-024/rollback/`、`P5/TODO-025/operations/`。真实源库迁移、真实业务回查、真实 Host 交互、生产服务切换和容量长期观测仍须在对应记录中保留 `NOT_RUN`，不得由夹具报告代签。

`P5/TODO-024/full-rehearsal/` 另记录完整复制环境执行：实际字节复制的 schema-2 数据库、独立旧服务子进程、test supervisor 的唯一 writer 与入口冻结、在途刷新 drain、停机/监听关闭/lease 释放、核查/全资产备份/迁移，以及真正 schema-3 Runtime HTTP 验证和测试端点切换。无增量分支实际恢复备份并启动旧格式副本读取保存组件；有增量分支实际执行一条 succeeded 和一条 unknown，导出两条完整证据、冻结 Runtime，并在数据库打开前阻止旧 writer 恢复。所有业务请求仅指向独立 loopback mock。13 项迁移相关回归通过，生产 G0–G4 判定仍明确不放行。
