# 六项合并：独立后端审阅与耦合复现

基线：candidate55，0d2d4c1e801d35b6ea62581ad4259ffd518c4533。对象是实际六项合并源码；不复用旧单项性能数字。仅离线合成数据，不连接真实店铺。

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

SIX_EDGE_MODE=1 node coupled-backend.mjs /absolute/combined posting 267 1000 100 parity combined-edge.json

edge模式补做：分歧archive修复、缺失archive补建、可重试上游失败的陈旧快照回退、关闭后重新打开实际磁盘DB并再调用Runtime。失败是本地模拟Adapter错误，未发起网络。

bash run-coupled-abba.sh /absolute/baseline /absolute/combined /absolute/results

三个形状各5个ABBA周期，每形状20个独立Node进程、每臂10进程。统计单位是进程内8轮中位数；同进程8样本相关，不算80独立用户。

## C的物理写入时间边界

跳过相同fresh archive写回会保留其SQL列updated_at，而不是把它改成最近缓存读取时间。这是有意减少的物理写入元数据，不是payload源数据时间。不能声称整个DB或SQL导出字节相同。

现行生产RuntimeStore.get/list只返回value_json，排序用created_at,id；scheduler候选查询也如此。compose使用payload fetchedAt/expiresAt/retryAt，授权使用generation。GC state和rollback均通过store.list计算，不消费SQL updated_at。离线完整backup使用SELECT *，所以备份databaseFingerprint确实不同；每臂仍按原样保留并恢复自己的物理证据，未削弱完整性校验。

check-archive-metadata.mjs 对实际耦合结果执行GC/rollback、完整backup→verify→restore。两个GC计划/stateDigest和rollback结果完全相等；每臂25张原表逐行严格恢复，restore新增的relocation行单独核对数量/namespace。原始SQL导出或直接依赖updated_at的外部工具会看见差异，本仓库未找到这样的业务消费者。自定义Store.put副作用不在此路径等价声明内。

## 已验证功能

- 实际六栈新增后端focused 13/13。
- 267商品、267包裹及1商品对照：每形状20次实际Provider、10次调度、0外部I/O；每次完整响应和计划严格相同。25表仅fresh archive的SQL updated_at存在明确允许差异。
- 267商品和267包裹edge：修复/缺失/失败回退/重启响应相同；重启0次upstream；经过强刷故障路径后25表全部严格相同。
- SQL异常边界：null、JSON.parse错误及优先级、非TEXT、SQLite深度超限的合法JSON、重复metadata键last-key-wins，仍由实际B_R2 focused测试覆盖。
- 其他回归/build/typecheck、客户端和最终发布门槛由合并负责人分别记录。本报告不替代完整检查，也不声称无任何历史失败。
