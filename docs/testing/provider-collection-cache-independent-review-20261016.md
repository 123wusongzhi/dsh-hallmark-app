# Provider collection 缓存身份 oracle：独立复核通过

结论：建议接纳现有测试补强。当前生产实现正确；这是旧测试不能识别连接缓存 key 退化的 oracle 缺口，不是已存在的跨连接生产故障。

## 固定身份与范围

- 仓库：123wusongzhi/dsh-hallmark-app；工作分支 test/cross-module-regression-20261015。
- 公开基线：`bf94a9874359af02b3045121d904221c9a3b2bcb`；tree `94ccc095c9d3a4d3831e7a4cb39ce64578b40753`。
- 作者冻结提交：`d27b62a243b6d4dd5b2dd255ad0a2adacaac8deb`；tree `ce9f878a746f7b75f0fa417ea6dba7bff6c87bf6`。此提交仅测试和说明文档两文件；独立执行候选仅应用完整测试 patch，未改生产。
- 测试 patch SHA-256：`e7e6db32851b2f178544a4ddf10bad28204190cf457941ce7c2904936d89e552`。
- 候选 provider.test.ts SHA-256：`e3020045635fb94c7987d8c50492685f8e6a51549afdac4b4b8c855528b6120b`。

## 缺口及真实执行路径

原 case 已创建同 session `s`、同 configRevision `1` 的连接 c/d，但仅执行 c 的 products.list，再检查 d 的持久化 snapshot 缺席。因此它保护的是 snapshot namespace，尚不能识别 Provider 的 CollectionService 实例误共用。

唯一故障注入：`packages/app-hallmark/src/index.ts` 中 collection 方法的 key 从 `canonicalJson([connectionId,revision])` 改成 `canonicalJson([revision])`。不改其他 key，不直接污染返回值，不绕开 Provider 或替换 CollectionService。

真实链为 AppsRuntime.invoke → HallmarkProvider.execute → private collection → 真实 CollectionService.search/index → 内存 CoreClient 边界。CollectionService 在构造时持有指定连接的 client/store/sourceId/listingStates closure，并把目录 rows 放入实例 indexCache。若删除 key 的 connectionId，d 会命中 c 的实例和目录缓存。

候选在原 case 内增加 c→d→c collection.search，CoreClient 根据 connectionId 返回公开脱敏冻结 snapshot 的 summary[0] / summary[20]，不根据调用次数分配响应。expected 是调用输入底座的 id/title/source 三字段投影，不取 actual、不调用被测 cache/normalize helper。两行非对称：c 为 5668d00b-92fe-45dd-a519-e54a555d2dae / taobao_tmall；d 为 638bdf8f-59f4-404e-a718-895813bf961e / alibaba_com。语料自身及其来源文件有现有 SHA-256 校验。

调用顺序和 `collectionReads === ['c','d']` 共同证明两个绑定分开取源，第三次 c 复用其缓存。没有第二次 d 调用，所以不把结果扩大成单独实测了 d 的第二次缓存命中。此次没有断言 sourceUrl，它不是 collection.search card 输出字段。

原 case 从 products.list 开始的 snapshot namespace、refresh unavailable、旧 payload/lastSuccessAt 保留、stale provenance、无平台调用及 finally dispose/store.close 后缀与基线逐字一致。没有新增 test case；仅扩展原 case 和可选 fixture 参数。未传 collectionRows 的其他 case 保持原 CoreClient 分支。

## 独立实跑结果

Node v22.18.0 与 v24.19.0 均得到：

| 状态 | 固定35文件450项 | 原Provider单文件30项 |
|---|---:|---:|
| 原生产＋旧测试 | 450通过 | 30通过 |
| 单点mutation＋旧测试 | 450通过，漏检 | 30通过，漏检 |
| 同mutation＋候选测试 | 449通过＋1失败 | 29通过＋1失败 |
| 恢复生产＋候选测试 | 450通过 | 30通过 |

所有测试运行均 0 skipped / cancelled / todo。唯一红项均为原 `connection namespaces isolate snapshots and retain stale data when refresh is unavailable`，错误为 `ERR_ASSERTION / deepStrictEqual`，提示 `collection rows must belong to connection d`：实际拿到 c 的淘宝行，预期是 d 的阿里行。不是 timeout、导入或初始化失败。

两版 Node 的 `scripts/audit-real-test-data.mjs` 均 PASS（308 testFiles、41个公开来源样本），`tsc --noEmit` 均 exit 0。450项是固定相关范围，不是全仓测试。完整文件 manifest 和实际 argv 保存在 runs.json，并由自足脚本生成。

另有独立透明观察 probe，两个 Node 均实跑：记录实际 Provider context 为 c/d/c、revision1、session s；原版的实际 services map 为2实例、底层读取[c,d]、返回来源淘宝/阿里/淘宝；同mutation为1实例、底层读取[c]、返回淘宝/淘宝/淘宝。probe 仅包裹 execute 记录后转调原方法，再只读实际服务 map/indexCache，不替换 collection 或返回结果。expected 在调用前从冻结输入构建独立值，CoreClient 返回输入的 clone。

## 恢复与边界

- 从精确 Git archive 创建两个新隔离树，不从作者正在切换状态的工作树拷源码。
- 主四态外层核对全部1360个 tracked 文件，不仅272个 packages 文件：前后相同，最终对基线唯一差异是候选 provider.test.ts。fixture、scripts、lock 和全部生产文件均等于基线。
- probe / focused 树各次 finally 后全部1360个 tracked 文件恢复至基线；临时 probe 文件已移除。
- 生产 index.ts 恢复 SHA-256：`ad2dd912280ce2e57c1c626f14d23e617d66db1854ee0041b0d9688f67739f27`。
- 使用现有已安装依赖的只读链接。依赖来源的 lock 和 dependencies/devDependencies 声明与基线一致；其 package.json 仅 scripts 历史不同。TypeScript5.9.3、React/ReactDOM18.3.1、esbuild0.25.0。执行树 package.json 是精确基线。
- 补充 focused runner 首次在读清单时因 Git 中文路径 quoting 报 FileNotFoundError，发生在测试/生产写入前；改用 `ls-tree -z` 后重跑全四态通过。首版脚本、错误日志均保留，未归为产品测试失败。
- CoreClient 只是内存离线传输边界，RuntimeStore 使用 :memory:；测试 patch 没有新增磁盘目录。仅使用仓库已公开脱敏冻结底座，没有新采集、真实账户/平台请求、业务写或客户私有数据传输。未证明磁盘目录隔离、真实数据泄露、真实商城接口成功或原生桌面验收；未跑浏览器、全仓、安装包、benchmark。
- 未 push、未创建 issue。需主审决定发布。

交付文件为本地归档，未随报告发布；[问题 #73](https://github.com/123wusongzhi/dsh-hallmark-app/issues/73) 为自足中文issue（完整测试patch、所有实跑验证脚本、命令及精确结果）；candidate.patch；author-commit.patch（含作者说明文档）；完整 logs/manifests；review-evidence.zip。
