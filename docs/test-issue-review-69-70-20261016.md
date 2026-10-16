# 测试 issue #69–70 独立复现与最小修复

基线 7af2f484c6ccf833c274ed5f81b04504cb796b57；Windows x64，Node 24.12.0 与已校验官方便携版 Node 22.18.0。仅使用已有锁定依赖和公开脱敏冻结数据，无新安装、真实商家写入、桌面操作或永久生产修改。

GitHub 实际 created_at：#69 为 2026-10-15T23:08:00Z，#70 为 2026-10-15T23:32:29Z，均符合任务起点。读取全文及评论后独立构造候选和故障，不导入对方提交或执行其外部复现脚本。

## #69：正常完成后清理 500ms 防挂定时器

Promise.race 不取消已创建的其他 Promise。原 snapshot-during-review 用例已正常完成读取，但 referenced 的 500ms guard 仍使该文件进程等待。只在原位置保存原生 handle，并在既有 finally 的第一句 clearTimeout；原 500ms 阈值、ref 状态、读取断言和 finish→await write→runtime.dispose→store.close 次序不变。无 unref、force-exit、sleep 或新增生产要求，不扩大到原有 await started 等其他边界。

计时单独运行未插桩的完整文件，两个版本各三组 B/C、C/B、B/C，原版和候选各三次，12 次均 1/1 通过。计时期间本聊天其他测试、构建、类型和审计任务暂停，#70 候选仅作为不被该文件加载的其他测试补丁并存。以下是本机独立样本，不合并作者数据，不外推全仓：

| 运行时 | 原版三次 ms | 候选三次 ms | 中位数变化 |
| --- | --- | --- | --- |
| Node 22 | 718.181 / 707.403 / 713.256 | 199.612 / 200.327 / 206.377 | 713.256→200.327，减少约 512.9ms |
| Node 24 | 665.486 / 668.112 / 682.854 | 160.502 / 171.918 / 164.601 | 668.112→164.601，减少约 503.5ms |

双版本各九种独立 controls（共十八次）核对真实 Runtime、原 provider 和清理状态。诊断与计时分开，计时不加载 instrumentation。诊断只转发原生 timer，按原生 500ms handle 关联 async_hooks 唯一 asyncId，观察同一 handle 的 clear/before/destroy；全局 Timeout 数量仅作辅证。

- 原版成功后仍有一个未销毁 guard；候选同一 guard 被 clear/destroy，未执行 before，残留变为零，ref 和 delay=500 均保留。
- 候选仅删除 clearTimeout 操作时，读取仍为 ok，但资源 oracle 精准报 INDEPENDENT_GUARD_TIMEOUT_RETAINED，证明改善来自清理。
- 真实 provider 延迟 120ms 时原版/候选均成功，没有缩短保护窗口。
- 真实 Runtime 的 independentRead 临时设为 false，让 get 阻塞于 submit 锁后，原版/候选均以原 snapshot waited on external review 失败：Node 22 约 509.8/522.0ms，Node 24 约 510.7/516.2ms。
- 即时读取错误仍为原 ERR_ASSERTION（actual unavailable、expected ok），返回 envelope 保留注入错误，没有吞错或制造通过。
- 各模式均确认 review 已释放、submit 完成、provider stopped/disposed 和 SQLite 关闭；timer 生命周期另按上述原版/候选区别记录。

原版/候选 × 两 Node 的四次固定四文件相关组，各 33/33，均零失败、跳过或取消。生产 Runtime 在每种控制后 finally 从原 Buffer 恢复。该效果限定当前机器与此测试文件，不表示整套测试或产品运行时普遍加速。

## #70：保留缺失物流费用的未知语义

平台佣金与物流费用是独立字段；公开 number|null 契约规定未提供物流费用显示未知。原财务样本有 amount=161.92、commission=-28.08、RUB，但无 logistics_fee，故 literal null 是独立预期，不能用 0、佣金或合计补值。

只在原 case 增加 logisticsFee===null 一条断言，不增加 fixture、case 或映射 helper，原 34 个 case、#67 活动上限断言、#59 库存断言及所有旧字节保留；移除此插入后与进入时测试 Buffer 完全一致。

临时只将 logisticsFee:r.logistics_fee 改为 logisticsFee:commission。两个 Node 版本均在同一固定八文件、108 项完整组执行：

| 输入 | 实际结果（两版相同） |
| --- | --- |
| 原生产 + 旧测试 | 108/108 |
| 同一故障 + 旧测试 | 108/108，漏检 |
| 同一故障 + 新断言 | 107 通过 / 1 精准失败，actual -28.08、expected null |
| 恢复生产 + 新断言 | 108/108 |

全阶段零 skip/cancel/todo，108 个测试名完全相同；本轮没有额外 APP_NOT_FOUND/storesList=[]，不宣称修复了之前的间歇现象。source-reuse 中 finance.amount 用于非法 recipe 控制，不经过原生费项映射，未机械扩展为无关验证。

独立小探针调用真实默认 readOzonComposition，不注入自定义 reader，只在 storeDataRead 提供两路离线只读响应。双版本均为 logisticsFee null→-28.08→null，amount=161.92、commission=-28.08、RUB 不变。说明错接可进入真实组合输出，不推断当前真实平台收费有误。原生产本来正确，仅补测试。

## 合并与检查

主工作区合入两个最小测试补丁后，12 个相关文件双版本各 143/143，零失败/跳过/取消，含用户已有额外测试。主工作区和隔离树 TypeScript 与真实数据审计均通过。

集成前保护 107 个既有未提交/未跟踪文件。snapshot 目标原本干净，只应用定时器补丁；已有用户改动的 ozon-data.test.ts 只插入一个断言，去除此插入后的 Buffer 与进入时完全相同，其余既有文件 SHA 不变。不覆盖或提交用户生产 WIP。

本次不重跑全仓 npm test，不验证真实浏览器、桌面或线上业务。前序 #60–62 的全仓记录仍为 Node 22 两失败、Node 24 一失败（association capability 状态、packaged parity 字符串 productId 转 NaN），本批未修复；#67 首轮两项未归因失败未再现，其原因仍未确定。定向通过不能称最终全仓全绿。

## 字节恢复与本地证据

- #70 ozon-data.ts 原 Buffer 恢复 SHA-256：2eaaa81e31608424f10826db22b910626dc22e149fa174d9904c0949b3183d7d。
- #70 候选测试 SHA-256：d83229a0bb7ce1200cd972514ee5d16565a1cfeb999cc4376dcc54ba78d3f68f。
- #69 Runtime index.ts 原 Buffer 恢复 SHA-256：423e75983680c8a11b6aca5e95871184996523e5fc6ac77c69e438cd8ceb3a72。
- #69 候选测试 SHA-256：2fc6e88b640a8587ba10459643818de1ba208f8716752aa92de35d929becb324。
- 所有临时生产故障均 finally 使用进入时原 Buffer 恢复，冻结 corpus 不改。

逐步 runner、TAP、未插桩计时、实际 guard 生命周期、组合输出、输入 SHA 和恢复/合并记录位于本地 artifacts/issue-review-automation20-20261015T2349/ 的 issue69/70 目录。提交只包含两个测试和本报告。

