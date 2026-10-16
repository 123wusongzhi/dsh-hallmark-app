# 工作台、素材库与数据源库：实施记录与验收证据

- 记录日期：2026-10-08。
- 已确认安装版本：`1.0.0-candidate.40`，独立官方 Web 验收环境；46 / 46 个安装产物与清单一致，实际 Runtime 为 candidate40，数据库 schema 为 4。
- 最终自动验证：candidate40 全库 919 / 919 通过，0 失败、0 跳过；typecheck 与打包 SDK / 实际 authoring CLI 验证通过；178 / 178 个生产源码输入哈希一致。首轮测试夹具挂起已修复并完成重跑，见第 10 节。
- 对应计划：`../DSH工作台与组件素材库实施计划.md`；对应需求：`../DSH工作台与组件素材库需求文档.md`。
- 本文中的路径均相对本仓库根目录。本文记录源码实现和已有证据，不代替发布记录。

## 1. 当前结论与证据边界

阶段 0–5 的代码路径已接入：中文语义字段字典、经真实调用验证的数据源登记、原生素材、应用级工作台持久化、素材配置界面，以及返回原聊天填写 Agent 需求的入口。D1–D4 按计划建议实现。阶段 6 已完成最终 candidate40 安装、真实浏览器主流程、919 项全库测试和打包验证。第 5 节逐项区分浏览器实证与自动回归，不把未单独记录的浏览器子场景写成已完成。

candidate38 的真实原生 Agent 第二轮已成功发现素材/数据源、验证真实活动 API、登记数据源并再次列出；所有调用保留原聊天的 `nativeCallId`，与早期独立脚本证据分开记录。candidate40 的网页中两个复用实例均显示 5 条真实活动，Runtime 快照确认它们引用同一个活动源 revision 1。第一次 `apps/presentation` 未绑定失败已修复，保留原失败材料供追溯，不再作为当前结论。安装身份、原生 Agent 与最终页面证据见第 9 节。

证据按以下层次使用：

| 类型 | 可以证明 | 不能证明 |
| --- | --- | --- |
| 源码及测试用例 | 已实现的接口、约束和可执行回归检查 | 当前安装版本已包含改动，或浏览器交互通过 |
| 真实样本 JSON | 该次请求实际返回的字段和值 | 所有店铺、所有商品均具有该字段，或数据实时性 |
| React SSR HTML | 样本经过渲染器后的文本、金额格式与静态结构 | 点击、切页、图片加载、布局适配和宿主标签行为 |
| Runtime / HTTP 整链记录 | 登记、读取、持久化和无会话数据读取成功 | 浏览器已经显示并可操作这些内容 |
| 安装后的浏览器操作记录 | 对应版本下实际可见的交互结果 | 尚未覆盖的场景 |

`artifacts/workbench/source-acceptance/live-data-source-evidence.json` 中的检查名需按脚本的实际断言理解：`source visible to UI` 是数据源目录接口返回了该记录；`registered API source renders reusable material` 是预览接口的 binding 为 `ready` 且返回 5 行。两者均不是浏览器检查。实现脚本为 `scripts/verify-workbench-live.mjs`。

## 2. D1–D4 的实现

| 决策 | 已实现的行为 | 主要位置 |
| --- | --- | --- |
| D1 原生 ViewSpec 渲染 | 工作台素材直接使用原生模块；`ViewSpec` 是编辑和保存的配置，`RenderSpec` 仅是确定性、无业务数据的派生树。普通列、密度、布局调整不启动源码构建。 | `packages/presentation/src/types.ts`、`packages/presentation/src/validation.ts`、`packages/dsh-plugin/client/render-catalog.ts`、`packages/dsh-plugin/client/renderer.tsx` |
| D2 声明式数据源 | 数据源引用已注册的 query / compute 能力，保存预设参数、中文字段语义映射、操作范围和真实验证记录。登记前真实调用，验证失败不能登记为可用。 | `packages/app-presentation/src/data-sources.ts`、`packages/app-presentation/src/descriptors.ts`、`packages/app-presentation/src/index.ts` |
| D3 应用级工作台 | 每个应用一个默认工作台，不归属聊天；已保存实例通过 `workbench` 调用来源读取。运行时核对该实例显式保存的连接、能力和主版本，仅准入 query / compute。 | `packages/app-contracts/src/index.ts`、`packages/app-runtime/src/index.ts`、`packages/app-presentation/src/workbench.ts` |
| D4 沿用 saved_assets | 保存 `workbench:<appId>`、`data_source:<id>` 和 `data_source_revision:<id>:<revision>`；保存使用 revision 冲突检查，旧实例可引用旧数据源版本。旧 `list_saved` 只返回 entry / template。 | `packages/app-presentation/src/workbench.ts`、`packages/app-presentation/src/data-sources.ts`、`packages/app-presentation/src/index.ts` |

没有为本功能新增数据库集合；已有整链记录中的 `databaseSchemaVersion` 为 4。源码创作流程仍是超出原生素材边界时的出口，不成为工作台实例的默认渲染路径。

### 2.1 阶段 0–6 全量对照

| 阶段 | 计划要求与当前实现 | 已有验证 / 剩余证据 |
| --- | --- | --- |
| 0 契约与样本 | 商品、采集列表/原始详情/结构化 SKU、促销活动均有真实样本；金额分/元、SKU 身份、分页/搜索/排序范围已写入 Provider 映射。 | 第 3 节字段和操作表；上游明确状态枚举来源另列。未确认的活动状态不映射。 |
| 1 字段字典与数据源库 | `field-roles.ts`、`data-sources.ts`、types/descriptors 和执行分发已接通；验证会调用真实能力、检查样本路径/币种；未确认映射不参与兼容性；revision 历史与保存冲突检查；`list_saved` 过滤 entry/template。 | `test/apps-components/workbench.test.ts` 覆盖缺失/非法 revision 拒绝及旧版本固定；真实 Agent 登记、40 安装哈希与 Runtime 快照共同证明实际采用的源和版本。 |
| 2 原生素材与联动 | `product_list` / `sku_detail`、图片懒加载/失败占位、商品浏览与纯采集箱组合、共用素材目录、语义格式、ViewSpec.links、联动白名单与旧响应淘汰均实现。活动清单复用普通 table。 | 原生与 table 回归；40 网页实际商品搜索/翻页/批内排序/SKU 联动、11 条采集 SKU、活动「暂无数据」、慢图时其他实例排序与坏图占位；快速切换淘汰旧响应另有自动回归。 |
| 3 持久化与来源 | 应用级工作台、expectedRevision、固定数据源 revision、派生 DatasetBinding、相同查询复用、实例并行读取；Runtime 要求启用连接和实例显式绑定，拒绝业务 mutation。 | Runtime / HTTP / 组件测试；浏览器不同参数、挂起与失败隔离；40 重开恢复显示配置、绑定和数据，保存版本 10 的 8 个实例与 Runtime 快照一致。 |
| 4 工作台与素材 UI | Hallmark 工作台与独立素材标签、新增突出、分类搜索、示例/真实预览、数据源兼容性/缺口、中文说明、查询参数、列/模块/布局配置、旧组件次级区已接入。 | 1040 / 420 截图、列显隐、标签/突出 DOM、40 示例商品/SKU 切换真实 Bill 10 / 338、活动源缺字段中文禁用说明、中文状态 choices 和 267 / 338 条真实过滤；40 未保存素材草稿中实际拆改/替换模块并保持来源隔离。 |
| 5 Agent 路径 | 指引改为素材/已有源优先；沿用 apps_invoke 发现/验证/登记，不新增业务网关；公开输入 API 只填草稿不发送；Host 自动准备内部 presentation 服务，业务连接只按显式选择 prepare。 | 草稿保留截图与输入测试、Host 绑定回归；真实原生 Agent 第二轮成功，40 网页两实例各 5 条活动且固定同一源 revision。 |
| 6 验证与发布 | 单元、Host/HTTP、旧组件库兼容回归已有记录；官方 Web 安装40的46 / 46个产物一致；真实浏览器覆盖主流程、窄宽交互与原生 Agent 复用。 | candidate40：919 / 919、typecheck 和打包验证通过，178 / 178 源码输入匹配；历史38为913 / 913、39为917 / 917。本文读取既有日志，未重跑测试，未把官方 Web 安装等同于桌面宿主升级。 |

关键准入位置：`packages/app-runtime/src/index.ts` 的 execute 先校验连接启用，再校验工作台显式绑定；`packages/plugin-apps/src/index.ts` 的自动绑定仅面向内部 `apps/presentation`，不自动选择业务连接。prepare 校验全部 connectionIds 和原聊天身份后才绑定所选连接，空列表只准备 presentation。

## 3. 阶段 0：真实字段确认

### 3.1 样本与返回结构

下表中的 `rowsPath` 相对能力返回的 `data`，不包含调用信封的 `data.` 前缀。

| 能力 / 来源 | 真实样本及行路径 | 已确认内容 | 边界 |
| --- | --- | --- | --- |
| `hallmark.products.list` | `artifacts/workbench/products-sample.json`；`products` | 2 条抽样商品包含 `productId`、`title`、`imageUrl`、`sku`、`currency`、`pricing.sellerMinor`、`status`。 | 列表读取店铺商品快照；不能把工作台重新读取等同于上游全量实时同步。 |
| `hallmark.products.skus` | 从上述商品快照中的精确商品行派生；`items` | 商品身份、SKU 编号、图片、当前售价；规格取实际 `sourceSkuMatched === true` 的 `sourceSpec`。 | 一个匹配商品行最多返回一条 SKU；未找到商品返回空列表。缺失规格保留空值，不推导兄弟 SKU。 |
| `hallmark.collected.search` | `artifacts/workbench/collected-sample.json`；`items` | 抽样 2 条，`total:367`、`cursor:"2"`；存在 `id`、`title`、`mainImage`、`currency`、`minPrice`、`skuCount`。 | `minPrice` 是最低采集 SKU 价格，不代表店铺售价。样本总数只对应该次调用。 |
| `hallmark.collected.get` 原始详情 | `artifacts/workbench/collected-detail-sample.json`；单对象的 `content` 是 JSON 字符串 | 原始采集元数据、规格组、价格文本等。 | 不直接把该字符串当成结构化 SKU 数据源，也不按规格组猜测各 SKU 的价格。 |
| `hallmark.collected.skus` | 结构化详情样本 `artifacts/workbench/collected-structured-sample.json`；能力标准化后为 `items` | 示例商品实际有 11 条 `skus`；存在 `sourceSkuId` / `code`、`spec`、`price`、`image`，币种可从商品层取得。 | Provider 使用 `getCollectedItemDetail`，校验详情商品 ID 和 SKU 数组。接口缺失或结构不匹配时明确失败。 |
| `hallmark.api.actions.list` | `artifacts/workbench/actions-sample.json`；`response.result` | 实际 5 条活动，`id`、`title`、`date_start`、`date_end` 可映射；日期是带时区的 ISO 字符串。 | 样本未提供可直接确认的通用活动状态；`is_participating` 不能直接当作活动状态。首个登记源省略该角色。 |

Provider 实现依据：`packages/app-hallmark/src/domain.ts`、`packages/app-hallmark/src/index.ts`。内置映射依据：`packages/app-hallmark/src/field-mappings.ts`。

### 3.2 字段语义与金额单位

| 数据源 | 原始字段 / Provider 输出 | 中文语义角色 | 单位、口径与处理 |
| --- | --- | --- | --- |
| 店铺商品 | `productId` / `title` / `imageUrl` | 商品编号 `product.id` / 商品名称 `product.name` / 商品图片 `product.image` | 身份字段用于选择联动；图片失败时显示占位。 |
| 店铺商品 | `pricing.sellerMinor`，`currency` | 当前售价 `price.current`，币种 `price.currency` | 原始金额单位为分，映射设置 `numericScale:0.01`；币种取 `currency`。 |
| 店铺 SKU | `sku`；匹配来源的 `sourceSpec` → `spec` | SKU 编码 `sku.id`；SKU 规格 `sku.specification` | 只展示匹配来源已提供的规格。 |
| 店铺 SKU | `pricing.sellerMinor / 100` → `price`；`currency` | 当前售价 `price.current` | Provider 已换算为主币单位，SKU 映射不再除以 100。 |
| 采集商品 | `id` / `title` / `mainImage` | 商品编号 / 商品名称 / 商品图片 | 保留采集商品身份。 |
| 采集商品 | `minPrice`，`currency` | `price.current`，显示名「最低采集价格」 | 按原始主币单位显示；说明明确为最低采集 SKU 价格。 |
| 采集 SKU | `sourceSkuId ?? code ?? id` → `sku`；`spec`；`price`；SKU 或商品层 `currency` | SKU 编码 / SKU 规格 /「SKU 采集价格」/ 币种 | 使用结构化详情中的实际值，不由列表最低价填充每个 SKU；中文名称明确不代表店铺售价。 |
| 促销活动 | `id` / `title` / `date_start` / `date_end` | 活动编号 `activity.id` / 活动名称 `activity.name` / 开始时间 `activity.startsAt` / 结束时间 `activity.endsAt` | 日期按字段格式展示；未映射的活动状态显示缺失，不用参与标记替代。 |

金额实证：`artifacts/workbench/native-render-evidence.json` 记录实际 React SSR 对两条真实商品样本的转换：`4497 → CNY 44.97`、`4443 → CNY 44.43`。静态产物为 `artifacts/workbench/native-real-sample.html`，不计入浏览器验收。

字段字典位于 `packages/app-presentation/src/field-roles.ts`，由 UI 和 Agent 共用。兼容性只计算 `confirmed:true` 的映射；不根据英文原始字段名推测语义。金额必须有可确认币种；比例需声明 `percentScale`；指标需说明统计口径。缺失值显示「暂无数据」，不补成 0。用户修改显示名称不改变语义角色、真实字段路径或金额换算。

`artifacts/workbench/collected-label-update.json` 记录采集 SKU 数据源 revision 2：价格显示名「SKU 采集价格」，说明「采集来源提供的该规格价格，不代表店铺售价」，真实验证 11 行、issues 为空。已存在工作台实例仍引用保存的版本，不因新 revision 自动改口径。

活动 table 的缺失状态曾显示旧表格占位「—」。当前源码 `packages/dsh-plugin/client/widgets/product-table.tsx` 对带 `fieldMeta` 的语义表格统一显示「暂无数据」，保留用户列与顺序；普通旧表格行为保留。定向回归检查空值、0、日期和旧表格兼容；candidate40 浏览器的两个原生 Agent 活动实例均实际显示「暂无数据」，没有为未确认的状态编造映射。

### 3.3 分页、搜索与排序确认

| 数据能力 | 分页 | 搜索 / 筛选 | 排序 | 界面范围约定 |
| --- | --- | --- | --- | --- |
| 店铺商品 | `cursor` / `limit`，偏移分页 | Provider 接收 `query`；在当前店铺快照内过滤后分页。`status` 为精确值过滤。 | 无服务端排序；仅已加载批次内排序。 | 数据源声明搜索 `server`，含义是 Provider 当前快照范围，不是直接调用上游实时搜索；排序明确为已加载范围。 |
| 店铺 SKU | 单条精确匹配，无远程分页 | 数据源声明 `loaded`；原生 SKU 明细当前直接展示返回行。 | 无远程排序 | 不宣称可浏览店铺的全部兄弟规格。 |
| 采集商品 | `cursor` / `limit` | 仅已加载批次内搜索 | 仅已加载批次内排序 | 显示已加载数量和可用总数，不能将当前批次结果当成整个采集箱结果。 |
| 采集 SKU | 返回指定商品的实际 SKU 数组；无远程分页声明 | 数据源声明 `loaded`；原生 SKU 明细直接展示 | 无远程排序 | 只展示当前商品的结构化明细。 |
| 促销活动 | 首个登记源未声明远程分页；普通表格可本地分页 | 已加载返回集 | 已加载返回集 | 不把表格本地操作描述为平台全量查询。 |

远程翻页采用当前批次替换，不在前端无限累计；`loadedCount` 是当前批次数量。商品列表提供「下一批」，工作台预览/实例控制提供回到首批的路径。联动参数只允许覆盖数据源声明的联动参数；快速切换商品或数据源时，过期请求不能覆盖当前选择。

### 3.4 商品状态的已确认中文选项

当前 Provider 为商品 `status` 查询参数声明六个中文 choices，UI 发送原值：

| 原值 | 中文显示 | 确认依据 |
| --- | --- | --- |
| `on_sale` | 在售 | 源 StoreProduct.status 与产品看板 pLabels |
| `archived` | 已归档 | 同上 |
| `pending` | 审核中 | 同上 |
| `rejected` | 审核未通过 | 同上 |
| `not_sellable` | 暂不可售 | 同上 |
| `unknown` | 状态待确认 | 同上 |

仓库内契约 `packages/contracts/src/index.ts` 的 status 仍是非空字符串，执行按源顶层 status 精确过滤；choices 是 Provider 已确认的业务选项，不是根据测试夹具猜出的枚举。上游证据由 `docs/hallmark-contracts.md` 链接到 `E:/bill学习专区/trademind_cli/src/store-products.ts:27` 与 `products-board.ts:44`。`not_returned` 属于独立 presence，不能放入当前 status 参数；`off_sale` 不在该源枚举中。「全部」表示不发送 status 条件。

状态值表达源快照中的状态；上游产品看板还按 presence 区分历史未返回商品，本期 status 筛选不额外推断 presence。已登记旧源不会因 Provider 代码更新自动新增 choices，应重新验证登记新 revision，再明确选用。candidate40 网页出现「全部」及上述六个中文选项；真实切换结果为全部 338 条、在售 267 条。Runtime 快照中原 Bill 实例仍引用 revision 1，新「Bill 在售商品」引用 revision 2，保存 `status:on_sale` 和 `limit:5`。

## 4. 阶段 1–5 的实现边界

### 4.1 素材与配置

素材目录 `packages/app-presentation/src/materials/catalog.ts` 同时供前端和 `apps.presentation.list_materials` 使用；后者也返回 `fieldRoles`。

| 素材 ID | 内容 | 数据要求与边界 |
| --- | --- | --- |
| `product-list` | 原生商品列表 | 必需商品编号、名称、价格；可配置列、密度，支持范围明确的查询操作。 |
| `sku-detail` | 原生 SKU 明细 | 必需 SKU 编号、规格、价格；支持指定商品独立读取或选中联动。 |
| `product-browser` | 商品列表 + SKU 明细的初始组合 | 两个独立 binding，各自选择兼容数据源。组合展开为普通可编辑模块。 |
| `collection-box` | 采集商品列表 + 采集 SKU 明细 | 只包含商品信息、规格与价格；不包含选品评分、利润评估或定价试算。 |
| `activity-list` | 复用普通 `table` 的促销活动清单 | 必需活动编号、名称；日期、状态是可选字段。只读展示，不创建、报名或修改活动。 |

`packages/plugin-apps/client/module-config.tsx` 已提供追加、替换、移除、前后调整模块，列显隐/顺序/中文显示名、密度和上下/左右布局配置。SKU 可以选择跟随哪个商品列表，移除关联列表后改为独立读取。后端按实际模块和 binding 验证语义要求，不依赖原始预设名称猜测数据源。

`packages/app-presentation/src/workbench.ts` 根据固定的数据源 ID / revision 和参数派生 binding、字段路径、字段元信息、rowsPath 与操作范围；前端展示设置不覆盖已验证数据源的这些事实。编辑格式保持为 `ViewSpec`，不另存第二套 RenderSpec 配置。

### 4.2 入口、保存与读取

- Hallmark 原组件库入口成为工作台；素材库是应用内新标签，原工作台标签保留。添加成功切回工作台并标记新实例；旧已保存组件区域继续保留。
- 视觉采用蓝白风，工作台与配置页使用共同样式；candidate40 的 1040 / 420 截图确认实际界面，420 记录的文档宽度与视口宽度均为 420。样式入口为 `packages/plugin-apps/client/styles.ts` 与 `packages/dsh-plugin/client/widgets/material-styles.ts`。
- 素材库先给明确标记的示例预览；选择数据源并完成真实读取后才可添加到工作台。
- 「载入平台数据源」执行真实验证；已有源时仍可「更新平台数据源」，发现新店铺并补齐此前失败项。初始化不为无样本数据伪造已验证状态。
- 已保存工作台读取不要求聊天 session；初始化和未保存素材的真实预览仍沿用现有聊天/连接上下文。这与工作台持久归属分开处理。
- 多个实例保存独立参数和绑定；同能力、同输入可复用相同 dataset，读取结果按实例隔离；单实例错误不阻塞其他实例。

主要位置：`packages/plugin-apps/client/workspace.tsx`、`workbench-board.tsx`、`material-library.tsx`、`data-source-picker.tsx`、`packages/service/src/workbench-routes.ts`。

### 4.3 Agent 创建数据源

这里的「封装」是 **已注册能力的声明式配置**：Agent 发现目录与已有源、确认参数、执行少量真实查询、映射中文语义、验证、登记。成功登记的数据源持久保存在数据源库中，可刷新列表后供多个实例复用。并非每次使用组件都重新编写接口适配器。

Agent 沿用现有调用网关访问 `apps.presentation.list_materials`、`list_data_sources`、`validate_data_source`、`register_data_source`。登记包含真实调用验证、版本与验证记录。当前运行时没有登记任意新执行代码的入口；接入尚未注册的平台 API 仍须扩展 Provider 并发布。

原生 Agent 调用内部 presentation / authoring 能力时，Host 只自动绑定已启用的内部 presentation 连接；没有启用或替换任何未选择的 Hallmark 连接。素材库准备需求时调用 prepare，参数来自用户已选数据源的连接集合。真实 Agent 成功记录与这些 Host 合成回归测试分别保存，不能混称。

「让 Agent 创建数据源」按钮把需求写入原聊天输入框，由用户检查后手动发送。`packages/dsh-plugin/client/native-draft.ts` 使用宿主公开的 `captureInsertion` / `insertText`，保留原草稿和引用，不自动提交；只有实际插入成功才报告成功。接线位于 `packages/dsh-plugin/client/plugin.ts`、`packages/dsh-plugin/client/selection-native.ts` 和 `bundles/apps/client/index.tsx`。指引位于 `packages/plugin-apps/src/authoring-guidance.ts`。

## 5. A1–A12 证据对照

以下「回归覆盖」表示测试文件有对应断言，执行结果另见第 10 节；本次文档整理未重新执行测试。表中路径若未写前缀，浏览器材料位于 `artifacts/workbench/`，测试位于 `test/`。真实浏览器指独立官方 Web 验收环境。对尚无单独网页记录的子场景如实注明，不以接口、SSR 或合成 UI 测试冒充网页证据。

| 验收 | 已实现路径与回归 | 已归档实证与判断 |
| --- | --- | --- |
| A1 工作台进入新标签素材库 | `workspace.tsx` 本地工作台/素材标签状态；`plugin-apps/workbench-ui.test.ts` 覆盖标签主流程。 | **网页已验证**：`browser-final-board-1040.png` 与 `browser-choices-420-candidate40.png` 均保留「工作台」「素材库」两个标签，Hallmark 入口和蓝白样式可见。 |
| A2 可运行预览，区分示例/真实 | `materialExampleData` 标记示例；`material-library.tsx` 请求真实 preview；UI 回归实际点击示例商品并检查无真实请求，选择数据源后请求真实预览。 | **网页已验证**：40 `examplePreview` 明示「示例数据 · 仅展示组件样式」，示例商品联动 DEMO-BLUE、雾蓝 / 500ml、CNY 129.00；随后 `realPreview` 显示真实 Bill 10 / 338、CNY 44.97 等商品。 |
| A3 数据源兼容性与查询范围 | `field-roles.ts` 只接受已确认角色；`data-source-picker.tsx` 展示兼容性/缺失语义；UI 回归验证 SKU 不兼容选项禁用并显示「缺少SKU 编码、SKU 规格」。 | **网页已验证**：40 `compatibility` 中两个活动源均 disabled，中文说明「缺少商品编号、商品名称、当前售价」；兼容 Bill 源可选并实际预览，状态 choices「全部」/「在售」切换为 338 / 267 条。 |
| A4 中文字段、单位与口径 | 公共字典、Provider 映射、`material-format.ts`；源元信息优先于显示配置；语义 table 缺失值定向回归。 | **网页已验证**：`browser-final-candidate40.json` 有「商品」「当前售价」和 CNY 44.97，两活动实例缺失状态均为「暂无数据」，采集列为「最低采集价格」「SKU 采集价格」，日期标注本机时区。原始 4497 分换算证据另见第 3 节。 |
| A5 列与布局直接配置 | `module-config.tsx` 编辑 ViewSpec；原生渲染，无逐实例源码构建；UI 回归移除/追加/替换/移动模块并校验 binding/link。 | **网页已验证**：`browser-column-toggle.json` 记录图片列删后重加至末列；37 网络片段提交配置且无源码构建请求；40 重开保持「商品」首列、compact、one。40 `moduleEditing` 记录隐藏图片后的两列表头、移除商品后独立 SKU 要求商品编号、替换后商品源清空且 SKU 源保留，最终模块顺序为商品列表 / SKU 明细。该拆改只发生在未保存草稿。 |
| A6 搜索/排序/分页范围与 SKU 联动 | 原生商品/SKU 渲染器；联动白名单和过期响应抑制；原生与后端回归覆盖排序范围、分页、选择和竞态。 | **主要网页交互已验证**：40 搜索已验证商品样本返回一行，SKU、实际规格与价格逐项一致（样本编号与价格仅保留在本地证据）；下一批 5 行、批内价格升序；`browser-clear-search-fixed.json` 记录清空搜索后取下一批，`browser-narrow-interaction.json` 有返回第一批。快速切换淘汰旧结果为回归覆盖。 |
| A7 添加后返回并突出实例 | 素材保存回调切回工作台并记录 highlight，素材标签保留；UI 回归覆盖。 | **网页已验证**：`native-agent-ui-reuse.json` 包含选中工作台标签、新增实例「已添加」标记、第二实例标题与仍保留的素材库标签；40 两个实例已完成读取。 |
| A8 多实例独立绑定 | 独立 dataSources/params；读取按实例隔离，相同查询共享 dataset 有后端回归。 | **网页已验证**：`browser-independent-parameters.json` 同页 Bill 5 / 338、Helen 10 / 77，各显示自己的商品；40 原 Bill 5 / 338 与在售实例 5 / 267 同时存在，Runtime 快照对应各自绑定/参数。 |
| A9 重开恢复且不依赖聊天 | 应用级 saved_assets、固定 revision；Runtime / HTTP 回归检查无 session 来源重读、非法版本拒绝；Host 不因会话放宽工作台准入。 | **重开恢复已验证；无会话由真实 HTTP 与回归证明**：40 `reopened` / `restoredConfiguration` 恢复列名/顺序、密度、布局和真实数据；Runtime 为保存 revision 10 的 8 实例，原 Bill 引用 @1、新在售引用 @2。网络 read 无 sessionId。没有额外把“重开”扩写成所有宿主重启/聊天切换场景均已专项验证。 |
| A10 Agent 封装真实 API 后登记复用 | 原生输入仅填不发；已有网关完成发现、确认参数、真实验证、登记；首轮内部绑定问题已有 Host 回归。 | **真实原生 Agent + 网页复用已验证**：`native-agent-registration-evidence.json` 保留原会话 nativeCallId 和真实 actions.list 验证 5 行；`native-agent-ui-reuse.json` 记录选择/添加第二实例；40 两实例各显示 5 条活动，快照均为 `bill-promo-activities` @1。详见第 9 节。 |
| A11 采集箱只呈现信息 | `collection-box` 仅商品、规格、价格；Provider 使用真实结构化 SKU；角色回归无 margin/sales/views。 | **网页已验证**：40 已验证采集商品样本展示 11 条实际 SKU 和明确采集价格列，价格与来源一致（样本编号与采集价格仅保留在本地证据）；无选品评分或利润评估。窄屏截图为 `browser-collected-420-candidate40.png`。 |
| A12 图片/单实例加载不阻塞其余交互 | 图片懒加载/no-referrer/失败占位；实例并行读取；回归覆盖坏图替换、慢请求淘汰与其他实例可读。 | **网页已验证**：`browser-failure-isolation.json` 中 Bill 挂起及 Failed to fetch 时 Helen 仍显示真实数据并可排序；40 `imageIsolation` 中暂停一张 Bill 商品图时 complete=false / naturalWidth=0，Helen 仍可价格升序；令该请求失败后出现「暂无商品图片」。40 的 420 宽搜索/SKU 正常且文档宽度 420。故障注入结束后主验收已恢复网络拦截与缓存设置并重载确认图片正常。 |

## 6. 早期真实 API 整链证据（独立脚本）

记录：`artifacts/workbench/source-acceptance/live-data-source-evidence.json`，开始时间 `2026-10-08T12:11:49.634Z`，运行时 `1.0.0-candidate.36`，模式 `board`。

- 六个内置数据源验证成功：bill / helen 店铺各一组商品与 SKU，以及采集商品与采集 SKU。
- `hallmark.api.actions.list` 真实返回 5 条活动。验证记录含 `sampleCount:5`、`issues:[]`、`status:verified`。
- 脚本以 Agent 调用来源登记活动源为 revision 1；数据源目录接口返回 7 个源，包含新活动源。这里不是宿主原生 Agent 自主完成的记录。
- 活动预览接口返回 binding ready、5 行；另一已保存实例以无聊天来源读取成功。
- 验证与登记调用均已核对；调用编号、源 ID、实例 ID 与运行时身份保留在本地原始记录中供追溯。

这些结果验证 D2 / D3 的真实 API 链路，不将数据源列表接口结果记作界面可见，也不将预览接口结果记作浏览器渲染。真正的宿主原生 Agent 记录另见第 9 节，两类实例和源 ID 不混用。

## 7. 复查命令与实施边界

在仓库根目录、满足 `package.json` 声明的 Node 版本后执行。以下是复查入口，本次文档整理未运行这些命令：

```powershell
npm run typecheck
node --test test/apps-components/workbench.test.ts test/apps-runtime/workbench.test.ts test/apps-runtime/workbench-http.test.ts test/plugin-apps/workbench-ui.test.ts test/plugin-client/native-materials.test.ts test/plugin-client/native-draft.test.ts test/app-hallmark/provider.test.ts
```

真实整链脚本使用现有 Runtime 和服务密钥文件，不另建服务；参数分别是 Runtime URL、密钥文件路径、证据目录、模式。`sources` 模式会初始化/登记数据源但不增加工作台实例；`board` 模式还会向现有工作台追加两条验收实例：

```powershell
node scripts/verify-workbench-live.mjs $runtimeUrl $keyFile $evidenceDirectory sources
node scripts/verify-workbench-live.mjs $runtimeUrl $keyFile $evidenceDirectory board
```

全库复查使用 `npm test`。安装沿用 `docs/apps-migration-runbook.md` 的候选版本流程；当前正式验收对象为独立官方 Web 中的 candidate40。版本身份和各轮结果分别记录在第 9、10 节，不能以旧版本的全库日志替代最终版本结果。

本期不包含运行时动态适配代码、任意新平台 API 接入、拖拽布局、采集箱利润/选品计算或业务写操作。

## 8. candidate37 浏览器验收增量记录

### 8.1 安装身份

`artifacts/workbench/installed-package-verification.json` 的校验时间为 `2026-10-08T12:31:04.1479101+00:00`：安装包版本 `1.0.0-candidate.37`，46 个清单产物全部哈希匹配；实际 Runtime 同为 `1.0.0-candidate.37`，数据库 schema 为 4。该记录确认验收环境安装身份，不代表功能逐项验收通过。

### 8.2 浏览器网络记录

输入：`artifacts/workbench/browser-add-network.json`。只读分析结果：`artifacts/workbench/browser-network-summary.json`，保留输入 SHA-256、请求编号、事件序号、请求配置摘要和证据限制。

| 可观察项 | 结果 | 证明范围 |
| --- | --- | --- |
| 记录规模 | 74 个事件，序号 59–266；37 个请求均有对应响应，状态均为 HTTP 200。 | 该片段未见 HTTP 失败或缺失响应；日志没有响应正文，不能排除业务层错误，也不记录完整下载/解码结果。 |
| 工作台操作 | `preview` 2 次、`save` 1 次、`read` 3 次。 | 浏览器确实发出了原生工作台 API 请求；不是 SSR 或独立脚本替代操作。 |
| 商品 → SKU 参数 | 第二次 preview 指定 `bindingId:sku` 和已验证样本的 `productId`（编号仅保留在本地证据），HTTP 200。 | 证明选中参数送往 SKU 预览；返回 SKU 是否一致仍须正文或实际页面证据。 |
| 显示配置保存 | 保存请求将商品组合从两列改为一列，将商品列表密度改为 compact，把 `product.name` 移至首列并改显示名为「商品」。 | A5 的部分证据：编辑后的 ViewSpec 已提交。即时视觉结果与重开恢复仍须终验。 |
| 实例保存与读取 | 保存提交 `expectedRevision:1` 和 3 个实例：两个已有活动清单、一个新商品组合。随后 3 个实例 read 均未带 `sessionId`，各获 HTTP 200。 | 支持 D3 与 A8/A9 的部分链路；不能单凭状态码认定三个返回内容独立、业务成功或重开恢复完成。 |
| 其他请求 | 20 次 views 资源读取、1 次 workbench 资源读取、10 次外部商品图片请求，均 HTTP 200。 | 图片请求成功响应不等于图片已正确显示；本记录未验证坏图占位、慢图时的交互。 |
| 源码构建 | 检查所有请求 URL、资源名和 JSON action / operation / capability 标识，未观察到 source / authoring / build / compile / publish 请求；6 个带请求正文的动作全部是 workbench。 | 该捕获片段内的配置提交没有观察到源码构建请求；不外推到捕获范围外或服务端内部活动。 |

网络文件只包含 `Network.requestWillBeSent` 与 `Network.responseReceived`，没有请求时间戳、HTTP method、响应正文或 `loadingFinished`。未出现 `loadingFailed` 事件，但无法仅据此确认记录器完整覆盖了传输失败。安装身份是独立证据，网络日志本身不含逐请求运行时版本。

### 8.3 历史截图与 A10 首轮失败

已归档并在文档审计时查看：`artifacts/workbench/browser-added-1040.png`、`browser-board-420.png`、`browser-edit-420.png`、`browser-agent-draft.png`。前三者提供当时的蓝白界面、标签、商品表格和窄屏配置画面；草稿图可见原有「工作台验收备注，请保留。」仍在输入框，后接生成的数据源需求，发送按钮仍由用户控制。最终布局与数据结果采用第 9 节的40证据。

实际原生 Agent 首轮因 `apps/presentation` 未绑定当前会话而被阻挡并停止，原始材料为 `browser-agent-binding-before.txt`。这是一条历史失败，已由 candidate38 的第二轮成功与 candidate40 的实际复用结果闭合。`browser-network-summary.json` 中 A10 尚未通过是该次 candidate37 分析的时点结论，不能作为最新状态；candidate36 脚本始终只作为接口整链证据。

## 9. 原生 Agent 与 candidate40 最终网页证据

### 9.1 原生 Agent 真实登记与第二实例复用

`artifacts/workbench/native-agent-registration-evidence.json` 对应已核验的原生会话，Runtime 为 candidate38。记录包含该会话的 `list_materials`、`list_data_sources`、`validate_data_source`、`register_data_source` 成功调用，以及各自原生 `nativeCallId`；不是测试脚本构造的 Agent 来源。验证实际调用 `hallmark.api.actions.list`，返回 5 条活动、`issues:[]`。会话、验证与登记调用的完整编号仅保留在本地原始记录中。

登记源为已核验的 `bill-promo-activities` 源，revision 1，名称「网页 Agent 验收 · Bill 促销活动」；包含店铺编号的完整源 ID 仅保留在本地证据中。它使用已注册的只读能力、固定店铺参数、`response.result` 行路径，以及经过确认的活动编号/名称/开始时间/结束时间映射；没有编造活动状态。`browser-native-agent-success.png` / `.txt` 记录原生聊天完成结果；`native-agent-ui-reuse.json` 记录网页选择该源并添加第二实例。

candidate38 那次复用 DOM 抓取仍显示加载中，单独不证明渲染完成。candidate40 的 `browser-final-candidate40.json.nativeAgentInstances` 补齐最终结果：第一、第二实例均显示 5 条实际活动，例如「Максимальный бустинг」，未映射状态为「暂无数据」，日期按本机时区显示。`final-runtime-snapshot40.json` 确认两个实例引用上述同一源 revision 1。这完整区分了“登记成功”“网页可选并添加”和“另一实例实际读出”三步。

### 9.2 安装和运行时身份

独立验收环境使用官方 DSH Web `0.2.0-rc.2`、`workbench-acceptance` profile，Web 地址 `http://127.0.0.1:4196`，Runtime 地址 `http://127.0.0.1:36995/v1/runtime`。插件由官方插件管理流程安装到 `artifacts/workbench/dsh-home/profiles/workbench-acceptance/node_modules/dsh-plugin-apps-bundle`。主 `4195` 环境仍由另一会话管理，本记录不宣称已升级该环境或桌面 Host。

`installed-package38-verification.json` 留存原生 Agent 成功时的38安装身份；最终依据为 `installed-package40-verification.json`：

- `bundleVersion`、已安装 package/versions、实际 Runtime 均为 `1.0.0-candidate.40`；正式覆盖39后的进程使用安装目录中的 `lib/runtime.js`。
- 清单的 46 个产物全部匹配；压缩包 SHA-256 为 `a98ac608d03fe96204332253585f6a91fabd8a37b1f29d0eeb65d5fefa1db6e2`。
- transport major 为 1、catalog schema 为 1、database schema 为 4；没有为工作台新增数据库 schema。
- `final-source-manifest-check.json` 检查 178 个生产源码输入，全部匹配、mismatches 为空。测试夹具的后续修正不在发布源码清单中，没有据此重打包运行时代码。

### 9.3 最终网页、保存状态与参数

`browser-final-candidate40.json` 与 `final-runtime-snapshot40.json` 分别记录实际网页和 Runtime 保存数据；不可用其中一份代替另一份。

| 检查 | 最终观察 |
| --- | --- |
| 工作台保存 | revision 10，8 个已保存实例。原 Bill、Helen、在售商品、采集箱和两组活动实例分别保留；其中早期脚本的两个活动实例与原生 Agent 的两个实例有不同源 ID。 |
| 重开恢复 | 原 Bill 显示名「商品」、顺序「商品 / 商品图片 / 当前售价」、compact 密度、one 布局恢复，读取真实商品。原 Bill 商品源仍固定 @1，新在售实例明确引用 @2。 |
| 范围与状态 | 中文状态下拉含全部和六个确认选项；全部 338 / 在售 267，当前加载各 5。新实例保存 `limit:5,status:on_sale`；旧实例不因数据源新版本自动更改。 |
| 示例及兼容性 | 示例明确标记且选择可联动 DEMO-BLUE；切换实际 Bill 源后显示 10 / 338。活动源用于商品模块时禁用并说明缺少商品编号、名称和当前售价。 |
| 模块拆改 | 未保存的素材草稿隐藏图片、改名并改变密度/布局；移除商品列表后 SKU 变独立且提示商品编号必填。追加/前移活动模块后替换为商品列表，商品数据源清空，SKU 源保留，最终顺序为商品列表 / SKU 明细。`reorderedGroups` 是无效的属性读取结果，不用于证明顺序；采用 `finalModuleOrder` 和 `firstMoveDisabled`。返回工作台后原 8 实例保持不变。 |
| 搜索、翻页、排序 | 搜索已验证商品样本得到一条实际匹配的 SKU 规格与价格（样本编号与价格仅保留在本地证据）；清空后恢复 338，下一批为 5 条，当前批次价格升序已核对。界面始终说明排序仅为已加载范围。 |
| 采集箱 | 指定采集商品实际 11 个规格，SKU 编码与规格逐项显示，采集价格与来源逐项一致（具体价格仅保留在本地证据）；列名「最低采集价格」「SKU 采集价格」，没有利润、评分或推荐。 |
| 图片隔离 | `imageIsolation` 仅暂停已观察到的一张商品图，该图未完成时 Helen 仍可按价格排序；失败后 Bill 显示可见图片占位。主验收随后清空拦截条件、恢复缓存设置并重载，确认 5 张 Bill 商品图 complete=true / naturalWidth=1086。 |
| 窄宽布局 | 420 视口下 `scrollWidth:420`，商品搜索和 SKU 明细仍可操作；1040 下原工作台与素材标签、蓝白界面和真实表格可见。 |

最终截图：`browser-final-board-1040.png`、`browser-choices-420-candidate40.png`、`browser-collected-420-candidate40.png`，以及恢复默认视口后的 `browser-final-workbench.png`。截图只证明其可见区域，完整行数/交互结果采用同轮 DOM 记录。

实例隔离补充材料：`browser-independent-parameters.json` 记录 Bill / Helen 分别 5 / 338 和 10 / 77；`browser-failure-isolation.json` 是主动挂起/失败一个浏览器请求的验收记录，Bill 读取失败时 Helen 的真实列表及排序保持可用，不将注入失败描述为实际生产事故；`browser-narrow-interaction.json` 和 `browser-clear-search-fixed.json` 记录窄屏翻批与搜索清空后的参数行为。

## 10. 最终验证结果与证据限制

| 项目 | 结果与证据 |
| --- | --- |
| 最终全库测试 | `artifacts/workbench/candidate40-final-tests.log`：919 / 919 通过，0 失败、0 取消、0 跳过，耗时 61,931 ms。 |
| 类型检查 | `artifacts/workbench/candidate40-typecheck.log`：`npm run typecheck` / `tsc --noEmit` 通过。 |
| 打包 SDK / authoring CLI | `artifacts/workbench/candidate40-package-verification.log`：打包 JS、声明、source starter、仓库外实际 build/preview 通过。这里的 CLI 测试属于保留源码出口的回归；不代替原生工作台网页验收，也不证明执行过 starter 的普通联网依赖安装。 |
| 安装与源清单 | `installed-package40-verification.json`：46 / 46 产物；`final-source-manifest-check.json`：178 / 178 生产源码输入。 |
| 历史测试结果 | candidate38 的 bounded 重跑 913 / 913；candidate39 917 / 917。各自只证明对应版本，不写成40结果。 |
| 已修复测试夹具问题 | `candidate40-test-hang-diagnosis.json`：Windows 随机分配 2049 被 Fetch 拒绝，bundle 初始化原先位于 try/finally 外，HTTP 夹具未清理。修正仅在 `test/plugin-apps/host.test.ts`：安全端口范围及有界重试、初始化和资源清理纳入 finally。定向 9 / 9 及最终全库 919 / 919 通过；不是当前阻塞，也没有修改生产代码或无关服务。 |

本次审查未发现未实现的阶段 0–5 或 D1–D4 要求；A1–A12 主流程的证据已按第 5 节归档。所有数据读取均为已有只读能力，采集箱保持纯信息展示，工作台实例没有业务写操作。

仍须保持证据措辞的边界：快速连续切换淘汰旧响应有组件/后端回归，未单独归档浏览器竞态注入；普通商品联动、慢/坏图、数据失败隔离和翻页交互已有真实网页记录。不将主流程通过扩写为“所有边界场景浏览器通过”。本期验证覆盖独立官方 Web profile，不覆盖主4195环境或桌面 Host 升级。

## 11. Ozon 共享数据源与独立店铺上下文（2026-10-09）

后续跨接口组合、三入口重设计和生命周期缓存的当前实现见 [跨接口工作台与缓存生命周期验收](cross-source-workbench-acceptance.md)。下文 candidate42 是此前阶段的记录。

本阶段已在独立 Web 4196 / Runtime 36995 升级至 candidate42。当前共享数据源、两店切换、10 类业务能力与最终实店结果以 [Ozon 数据接口实施及验收记录](ozon-data-workbench-plan.md) 为准。此前第 9–10 节是 candidate40 的历史证据，固定 Bill/Helen 数据源与“不同实例分别使用固定店铺”的描述不再代表当前设计。

当前入口为工作台顶部统一选择店铺；实例保留展示配置和数据源引用。旧固定店铺源已迁移并保留历史，目录不再按 Bill/Helen 重复。原生 Agent 的历史登记证据仍有效，其已保存实例通过共享源和店铺网关继续读取。当前完整回归 952/952；两店 20 个能力组合和 48 项实店检查通过，正式安装产物与 181 个源码输入一致。
