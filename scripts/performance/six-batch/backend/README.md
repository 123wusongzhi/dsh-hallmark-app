# 六项合并：独立后端审阅与耦合复现

当前复核基线：candidate70，00b5691e7801e8ec61c25993f73c0d4ec54330b5。原 candidate55/candidate69 记录保留各自轮次，不代表本轮测量。对象是实际六项合并源码；不复用旧单项性能数字。仅离线合成数据，不连接真实店铺。

## 测试方法

coupled-backend.mjs 在一个真实磁盘 SQLite/Runtime 中：

1. 用现行 readOzonComposition 的可注入 reader 填入有限分页的合成完整 source cache，排除真实外网。
2. 注册实际 HallmarkProvider，创建现行 AppsPresentationService 和 AppsSnapshotScheduler。
3. 每轮执行一次真实 Runtime.invoke(hallmark.ozon.compose)，再执行到期 scheduler.tick；后者通过实际 presentation.refreshBinding 再次调用同一 Provider 并写入 dataset。
4. 因此每轮包含两个实际 Provider 调用、一次 scheduler scan 和完整更新，不把单项计时相加。10轮中前2轮热身，后8轮计时。
5. 267商品或包裹；每商品3条仓库记录，刻意覆盖ID-only、SKU-only、双命中，合计库存恒为10。另有1000商品旧快照和100条普通缓存记录。小对照为1商品、没有无关旧快照/缓存。都是显式合成规模，不声称生产用户分布。
6. 模拟时钟逐分钟前进，从00:01至00:10，均在15分钟缓存TTL内；actual performance.now在timing模式保持原生。parity模式才固定Date/UUID/performance.now以精确比较功能字段。两种模式严格分开。
7. 计时包括Runtime和scheduler完整调用，不包括导入、建库、填充、前2轮热身或每轮之后的断言；CPU窗口包括后8轮及其断言。RSS为整个进程峰值，不称为独占payload大小。

## 复现

node coupled-backend.mjs /absolute/baseline product 267 1000 100 parity baseline.json
node coupled-backend.mjs /absolute/combined product 267 1000 100 parity combined.json
node compare-coupled.mjs baseline.json combined.json comparison.json

SIX_EDGE_MODE=1 node coupled-backend.mjs /absolute/baseline posting 267 1000 100 parity baseline-edge.json
SIX_EDGE_MODE=1 node coupled-backend.mjs /absolute/combined posting 267 1000 100 parity combined-edge.json
node compare-edge.mjs baseline-edge.json combined-edge.json edge-comparison.json

node check-archive-metadata.mjs /absolute/combined baseline.json combined.json metadata-comparison.json

edge模式补做：分歧archive修复、缺失archive补建、可重试上游失败的陈旧快照回退、关闭后重新打开实际磁盘DB并再调用Runtime。失败是本地模拟Adapter错误，未发起网络。

bash run-coupled-abba.sh /absolute/baseline /absolute/combined /absolute/results

三个形状各5个ABBA周期，每形状20个独立Node进程、每臂10进程。统计单位是进程内8轮中位数；同进程8样本相关，不算80独立用户。

## C的物理写入时间边界

跳过相同fresh archive写回会保留其SQL列updated_at，而不是把它改成最近缓存读取时间。这是有意减少的物理写入元数据，不是payload源数据时间。不能声称整个DB或SQL导出字节相同。

现行生产RuntimeStore.get/list只返回value_json，排序用created_at,id；scheduler候选查询也如此。compose使用payload fetchedAt/expiresAt/retryAt，授权使用generation。GC state和rollback均通过store.list计算，不消费SQL updated_at。离线完整backup使用SELECT *，所以备份databaseFingerprint确实不同；每臂仍按原样保留并恢复自己的物理证据，未削弱完整性校验。

check-archive-metadata.mjs 对实际耦合结果执行GC/rollback、完整backup→verify→restore。两个GC计划/stateDigest和rollback结果完全相等；每臂25张原表逐行严格恢复，restore新增的relocation行单独核对数量/namespace。原始SQL导出或直接依赖updated_at的外部工具会看见差异，本仓库未找到这样的业务消费者。自定义Store.put副作用不在此路径等价声明内。

## candidate70 本轮已验证功能（2026-10-10）

- 当前后端新增 focused 回归 13/13 通过。
- 267商品、267包裹及1商品对照：每臂每形状20次实际Provider、10次调度、0外部I/O；每次完整响应和计划严格相同。25表仅fresh archive的SQL updated_at存在明确允许差异；两臂所有表和索引定义严格相同。三种形状的 GC/rollback、backup→verify→restore 均通过。
- 267商品和267包裹edge：修复/缺失/失败回退/重启响应相同；重启0次upstream；经过强刷故障路径后25表全部严格相同。
- SQL 边界：保留 candidate70 的 JSON expression indexes。真正 malformed JSON、malformed BLOB 和深度超限 JSON 在写入处被 SQLite 拒绝；SQLite 可接受而 JSON.parse 拒绝的 JSON5 仍验证读取错误优先级。null 和重复 metadata 键的 last-key-wins 继续比较 scoped 与原始 JS filter。未移除生产索引来制造旧版可写入的损坏记录。
- 其他回归/build/typecheck、客户端和最终发布门槛由合并负责人分别记录。本报告不替代完整检查，也不声称无任何历史失败。

## candidate70 应用经营规则的 Provider 严格配对

pricing-provider-parity.mjs 使用实际 Runtime、HallmarkProvider、businessConnectedClient 和 BusinessPricingRepository，外部接口全部为本地合成响应。分别运行两棵完整工作树，再比较完整响应、SQL 行、当前索引及模拟接口读取记录。覆盖默认 application 模式、revision 1→2、重叠方案选择较高总费用、旧结果集失效，以及 source TTL 内 first→next→expired 的分页和全量缓存变化。本轮两种场景共 14 个完整 Runtime 响应、SQL 行、索引与模拟请求记录严格相同，10 次采购调用的 provenance 快照读取从 17 降到 7。有效期窗口变化仍按现行设计重新读取来源；本轮未改变该行为。该项只做功能检查，不并入性能计时。

```
node pricing-provider-parity.mjs /absolute/baseline pricing-baseline.json
node pricing-provider-parity.mjs /absolute/combined pricing-combined.json
node pricing-provider-parity.mjs --compare pricing-baseline.json pricing-combined.json pricing-comparison.json
```

本轮 coupled-backend 的 parity 输出也保存并严格比较 SQLite 表与索引定义，确保现有表达式索引未被替换或删除。

这里没有复用 candidate55/candidate69 的性能数字。本轮 60 进程 ABBA 由合并负责人在所有功能检查停止后串行执行，实际性能结果另见本轮报告。

## candidate70 上品记录的 Provider 严格配对

listing-record-provider-parity.mjs 使用实际 Runtime、HallmarkProvider、CollectionService、上品准备、包装与经营规则仓库，所有来源和网关均为本地合成响应。覆盖首次历史导入失败后恢复、found/not_found/unavailable（含部分可查）、分页、草稿记录与归档/失败关联、上品准备中的 listingRecords、未知店铺和后续刷新失败。两臂 8 个完整响应、全部 SQL 行、表/索引定义和模拟接口调用严格相同，0 外部 I/O。

```
node listing-record-provider-parity.mjs /absolute/baseline listing-baseline.json
node listing-record-provider-parity.mjs /absolute/combined listing-combined.json
node listing-record-provider-parity.mjs --compare listing-baseline.json listing-combined.json listing-comparison.json
```

新夹具初次检查修正了两处夹具假设：已有确定记录时同步失败的总体状态为 partial；准备资料通过当前独立网关读取类目树。修正仅涉及合成夹具，未更改生产实现。
