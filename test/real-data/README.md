# 真实业务测试数据

`corpus.ts` 统一读取冻结的真实来源快照，不提供模拟商品兜底。默认文件是 `artifacts/real-source-tests-20261013/corpus.json`；可用 `DSH_REAL_CORPUS` 指向同一格式的其他快照。经数据所有者于 2026-10-15 明确授权，默认快照及其引用的响应、图片已纳入公开 Git 仓库；公开版已按后续要求脱敏；生成的 `browser-data.ts` 仍不纳入 Git，执行 `npm run prepare:test-data` 即可离线重建。

生成命令：`node scripts/capture-real-source-corpus.mjs`。默认只读来源是 `http://127.0.0.1:4280`，通过 `DSH_REAL_PROVIDER` 可改地址。每次默认重新读取候选商品列表和详情；只有显式 `--reuse-pool` 才复用私人候选池。选中的 41 条详情和完整原始依据会再次 GET，保存响应原文与 SHA-256，并执行完整性校验。采集不会提交商品、改价、改库存或写远程系统。

数量固定为淘宝 / 天猫 20、阿里国际站 20、拼多多 1。阿里优先覆盖候选池全部真实类目路径，再补稀有字段结构；淘宝按标题中的不同产品类型、字段结构和缺失情况抽样。淘宝标题分组只用于抽样，不能视为来源类目。商品、SKU、属性、价格、图片和包装字段以来源值为底座；公开快照的身份信息按下文规则替换。候选池没有的异常不能伪装成真实样本；可用故障条件测试检验对应分支。

`capturedAt` 与响应 `fetchedAt` 记录从当前本地采集服务重抽取快照的时间；`originalSourceCapturedAt` 保留原商城采集时间。它们不是同一个时间：本次重抽取不会重新爬取商城，也不能证明商城当前价格、库存与快照一致。

同时保留只读 `/api/stores`、`/api/store-products`、`/api/tasks`、`/api/dynamic-pricing/settings` 的真实快照，用于销售商品、店铺和定价设置场景。响应保存前拒绝明文凭证字段。

如果已连接来源允许，还会记录 `/v2/warehouse/list`、`/v1/actions` 的只读平台返回，以及现有 Source catalog 搜索、属性模板和有界字典读取。平台查询经已登记的 `/api/stores/:id/data/read` 只读网关执行；这里的 HTTP POST 是查询方法，不是业务写入。可选读取失败会记录在 `optionalReadFailures`，不会制造成功数据。此次快照包含 `ozonWarehouses`、`ozonActions`、`ozonCategories`、`ozonCategoryTemplate` 和 `ozonDictionary`，可用 `realAncillary(name)` 获取完整原始响应。

- `realCorpus()`：带抽样理由与取证元数据的完整克隆。
- `realSourceProducts(source?)` / `realSourceSummaries(source?)`：来源原始详情 / 列表摘要。
- `realDetail(selector)` / `realRaw(selector)`：按序号、来源、商品 ID、已覆盖特征或标题分组选样；`realRaw` 返回原始 HTTP envelope，`realRawContent` 返回其 JSON content。
- `realCollection(selector)` / `realCollections(source?)`：经生产 `normalizeProduct` 计算出的集合模型，属于真实快照的正常映射结果。
- `realStores()` / `realStoreProducts()` / `realTasks()` / `realPricingSettings()`：真实附加业务数据。
- `realScenarioDetail` / `realScenarioProduct` / `realScenarioSku`：以真实输入为基础，显式覆盖故障、并发或边界条件。覆盖字段属于派生测试条件，不得称为未修改的真实记录。元数据不注入业务对象，以免影响精确比较。

浏览器 JSX 打包不能使用 Node 文件系统。采集器生成忽略入库的 `test/real-data/browser-data.ts`，导出 `REAL_SOURCE_DETAILS`、`REAL_SOURCE_SUMMARIES`、`REAL_STORES`、`REAL_SALES_PRODUCTS` 四个原始数组，以及 `REAL_SOURCE_IMAGE_DATA` 真实源图片像素。41 张主图会从原 URL 下载并记录 MIME、字节数与 SHA-256；失败保留失败依据，不生成替代图片。加载器校验清单文件本身、原始 HTTP 响应字节、解析后字段和源图片字节，阻止损坏快照进入测试。

浏览器分页和负载测试超过原始记录数时，只复制真实字段并给重放行追加明确的 `:repeat-N` 身份后缀；它不是新增真实商品。协议序号、组件库元数据、会话权限、并发刷新、关闭状态以及故障触发值由测试控制。源商品、销售价格、属性与普通图片的底座都来自已校验的冻结快照，默认使用仓库内的公开脱敏版。

打包隔离验证先通过加载器校验快照，再把当前使用的 `corpus.json` 复制到本次临时 harness，独立打包实现不会从 checkout 导入测试数据模块。`validateArtifact(root, {temporaryRoot})` 可指定没有祖先 `node_modules` 的临时根目录；仅清理本次创建、已检查路径的 `runtime-artifact-*` 子目录，保留隔离与拒绝外部依赖的检查。

## 测试入口与范围

- `npm run prepare:test-data`：从已校验的冻结快照离线重建浏览器数据。新机器默认使用随仓库发布的公开脱敏版，无需设置环境变量或另行取得私人快照。使用其他快照时，需提供 `corpus.json`、其 `.sha256` 和清单引用的响应／图片文件，并设置 `DSH_REAL_CORPUS`。测试审计会自动补建缺失文件，但不会静默覆盖现有文件；更换快照时显式运行此命令。
- `npm run capture:test-data`：重新读取候选池、按覆盖规则选择 20/20/1，并保存源响应与真实图片。默认刷新候选池，`--reuse-pool` 仅供明确复用既有候选时使用。
- `npm run test:real`：运行数据完整性、逐文件接入检查和 41 个真实来源商品的完整来源回放，包括真实缺价、SKU 分页和嵌套原始资源重建。
- `npm test` / `npm run test:apps`：运行前执行真实数据接入审计；所有依赖商品、来源、店铺、销售、物流、活动或字典事实的场景读取真实底座。
- `npm run test:live-real`：重新从当前服务读取所选 41 个 ID，独立记录当前源与冻结快照的差异，并实际读取原始资源和图片；这是只读测试。

`test-scope.json` 逐文件列出真实数据场景与不需要业务样本的框架场景。框架场景只验证协议、权限、存储、格式或状态机；其控制值不是商城样本。审计会拒绝未分类的新测试、缺失的数据依赖、被修改的浏览器原始数组或图片像素。传输回执、未知结果、价格操作意图、故障删字段和超量重复负载属于明确的派生条件，不用于宣称真实平台操作成功。

基础设施分类也检查真实语料的直接或共享依赖；使用冻结销售商品字段的 `ozon-store-read.test.ts` 归入真实数据场景。静态依赖检查不证明样本进入业务断言，业务覆盖仍以实际执行及独立预期为准。

完整测试默认串行运行：其中包含真实 Chrome 的首屏和交互耗时门禁，多个浏览器同时测量会竞争机器资源。Windows 浏览器退出后的临时文件清理采用有界重试，保持原有路径检查和测试断言。

本机数据、选样理由和结果保存在 `artifacts/real-source-tests-20261013/`：`corpus.json` 为公开脱敏的派生快照，`sample-catalog.json` 列出每款商品的特殊字段及选取理由，`test-data-coverage.json` 给出接入范围，`live-benchmark.json` / `live-preparation.json` 给出实时只读结果。

## 已公开的冻结快照

仓库包含 `corpus.json`、`corpus.json.sha256` 及清单引用的 HTTP 响应和图片，共 134 个文件、17,741,629 字节。公开版是由真实数据派生的脱敏快照，不能称为未修改的原始响应。`.gitattributes` 禁止换行转换，SHA-256 校验脱敏后的文件。发布前检查未发现明文访问凭据字段或常见密钥格式。

完整 `artifacts/` 仍被忽略；本次仅将上述明确选中的冻结文件纳入版本控制，不包含其他候选池、运行日志、数据库、会话状态、构建结果或历史实时测试输出。不要将整个 artifacts 目录强制加入 Git。重新采集时应先审阅新快照及全部被引用文件，再更新版本记录。

新机器克隆本分支并安装依赖后，可直接运行 `npm run prepare:test-data` 和 `npm run test:real`，默认读取仓库内的公开脱敏快照，不需要另行取得私人快照。如使用其他数据集，仍可设置 `DSH_REAL_CORPUS`。

### 公开版脱敏规则

店铺与仓库显示名称替换为“测试店铺/测试仓库 + 序号”；电话使用保留的虚构号码 202-555-01xx；地址使用 TEST ADDRESS 占位值，经纬度归零。店铺、任务等内部 UUID、业务操作标识、备注和私有任务说明使用一致的测试替代值；所有清单、响应、引用文件名保持对应关系，校验哈希已重算。41 个商品样本的稳定测试 ID 保留，以兼容现有离线选择器；它们不包含姓名、电话或地址。公开商品分类、属性定义、图片像素及业务数值不在本轮身份脱敏的替换范围内。

公开快照仅用于离线回放，不能用脱敏后的内部标识访问真实业务服务。运行实时只读核验时应另行提供合法的私人原始快照（DSH_REAL_CORPUS）。
