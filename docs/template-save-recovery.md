# 保存模板链路修复（2026-10-08）

## 现场与原因

DSH 会话“在售商品利润率组件（1）”的模板保存实际落库，随后返回
`OUTPUT_SCHEMA_INVALID: $.bindings[0].capabilityVersion: unknown field`。
保存操作因此进入 unknown，后续同一 Apps presentation 连接的写入被阻塞；
此前共享展示 Provider 未实现 inspect，原操作无法通过正式回查恢复。

`DatasetBinding` 保存 capabilityMajor，实际调用的 capabilityVersion 由当前
descriptor 解析。创作入口允许绑定对象经过共享服务验证，但原验证代码展开复制
整个输入，意外保留了调用版本字段；模板和列表的严格输出契约因而失败。

## 沿用的架构原则

- Host 绑定原会话并转发；共享展示 Provider 负责模板和组件；Runtime 是唯一存储写入者。
- 业务 Provider、数据快照、源码构建、展示尝试和保存资产分别拥有各自事实。
- 普通 React 源码、独立模板工作副本和现有 DatasetBinding 契约保持不变。
- 本地保存复用现有 SQLite 事务、provider_records 和 Runtime 幂等操作账本。
- 回查不重复执行写入，不将缺失回执直接当成成功，不改变外部业务写入的 unknown 语义。

## 修正

共享绑定存储去除 capabilityVersion。模板保存和历史模板读取也去除这一已知的
调用元数据；其他未知字段仍由原契约报告，不放宽 additionalProperties。

本地展示 mutation 在同一个同步事务内执行保存、输出校验和回执写入。输出不合法
时回滚资产变更并保存失败回执。Provider inspect 读取该回执，Runtime 按既有状态机
完成 unknown → succeeded/failed，不再需要重发保存或直接维修数据库。

对修复前已提交但没有回执的这一类模板操作，回查仅在原错误精确匹配、原会话视图
存在、请求名称/说明/原话一致、资产时间在原操作窗口内、设计/源码身份/绑定一致，
且候选唯一时确认成功。缺失、歧义或不匹配保持 unknown。历史资产及操作失败事件
保留，模板列表仅对读取结果做兼容投影。

## 验证范围

`test/apps-components/template-save.test.ts` 覆盖源码模板保存/列出/独立重开、重复键、
非法输出回滚、保存和删除响应丢失回查、失败回执恢复、历史模板恢复及歧义拒绝。
同时执行组件与 authoring 后端/描述契约回归、TypeScript 检查。

真实运行库通过 SQLite backup 取得独立副本，在副本中调用正式 Runtime inspect：
原 unknown 操作恢复 succeeded，list_saved 成功，原幂等键返回同一模板，资产记录
逐字相同。原运行库未修改；本地证据保存在 evidence/template-save-20261008。

这是源码与隔离恢复验证。正在运行的 DSH 需要加载此修复版本后才会经启动恢复或
正式 operation inspect 解除原操作阻塞，不能将副本验证称为现场已恢复。
