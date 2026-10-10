# Ozon 经营操作区

经营操作区保留 ERP 的表格交互：商品/销售货号、动作、改前改后、采购关联和成本、字段问题、执行状态并排显示。Agent 制作的草稿和用户手动添加的经营动作使用同一 `hallmark.plan.*` 能力。

## 用户使用

1. 在应用工作台选择店铺，在当前聊天启用对应 Hallmark 连接，然后打开“经营操作”标签。
2. 选择已有批次，或手动添加调价、库存、下架、活动报名/调价/退出动作。上品由 Agent 完成图文后保存为草稿，再在表内查看。
3. 搜索销售货号、采购 SKU 或问题，按执行状态过滤。直接编辑售价/库存；完整字段可在每行详情中展开编辑，图片可查看。输入修改只保留在本地，点击“保存草稿”才持久保存，不触发模型。
4. 点击“提交整批变更”时进入统一审核。过滤与勾选不会改变提交范围；界面明确显示整批动作数量。符合规则的动作直接处理，图文语义交给模型。
5. 在每行查看真实执行结果。接口失去响应时保留原请求，通过“检查原操作”查询回执，不自动重发。平台处理中或结果待核查时使用“核查平台状态”。
6. 选择已完成项，可生成恢复草稿，检查后提交。恢复是新变更；程序核对当前值是否仍等于上次写入值。库存不能按历史值一键回滚，上品恢复是归档，不删除商品历史。

## 接入方式

`packages/plugin-apps/client/business-operations.tsx` 是原应用工作台的真实操作区，复用工作台店铺选择。`packages/app-presentation/src/materials/business-operations.ts` 提供中文标签、筛选、展示和业务输入投影，便于后续组件复用。

普通工作台数据绑定保持只读。明确按钮动作进入 Host 的 `/api/dsh-apps`：

```json
{
  "action": "businessOperations",
  "sessionId": "当前会话",
  "connectionId": "所选店铺对应连接",
  "operation": "submit",
  "requestId": "本次调用的稳定标识",
  "input": { "planId": "原经营批次", "expectedRevision": 1 }
}
```

Host 检查真实会话和连接，将固定动作映射到 `hallmark.plan.*@1.0.0`。Agent 通过 Apps 网关直接调用相同能力。界面不接收用户输入的审核结果或采购金额作为事实。

支持动作：`create / revise / get / list / submit / inspect / restore`。`request` 是 UI 的原调用回执查询，输入为原 `requestId`。`list` 返回 `{plans,total}`；其他完成结果返回经营批次。平台处理未完成时，原调用的 `operationId` 可用于 `get` 找回该批次。

## 审核与执行边界

- 保存只进行程序必要检查和确定性补全；准备提交才调用需要的语义审核。
- 程序负责 SKU 对应、采购金额计算、范围、幂等和执行状态；审核模型处理图文含义。决策服务不可用时由 Host 派发独立大模型子代理。
- 修正按稳定执行行及内容依赖定位。单个蓝色主图的问题不重审无关颜色；共用详情修改会影响使用它的行。成功行保持已完成。
- 平台错误返回字段、原因与处理建议；不要求 Agent 写额外 facts、preflight 或“已看过”声明。
- “已完成”表示后端返回该动作完成；上品的导入/审核/可售状态按后端实际回执表达，不以 UI 点击当作平台成功。

## 当前首版范围

界面接入原工作台，能创建/编辑普通经营草稿、查看 Agent 上品稿、提交、核查和生成恢复稿。复杂类目字段先在完整字段区编辑，后续可按真实使用增加属性编辑控件。不会在当前界面另建聊天、固定“第六感”评分或重复审批表。

上品制作指引位于 `skills/ozon-listing/SKILL.md`，具体图文方法在其引用文件中维护。

## 技能交付与发现

发行包包含 `skills/hallmark-component-design` 与 `skills/ozon-listing`，以及独立安装器 `lib/install-skills.ps1`。两项技能及引用文件随同版本的构建清单逐文件记录哈希；桌面安装器从已校验的发行包安装，不读取另一份未打包源码。

本机官方 DSH 0.2.0-rc.2 的 `dsh-skill-filesystem` 默认扫描 `<DSH_HOME>/skills`（未配置 DSH_HOME 时为 `%USERPROFILE%/.dsh/skills`），并扫描当前项目 `.dsh/skills`。将技能放在插件包内本身不会进入该目录。默认用户调用与模型调用均启用，官方文件监听使目录缓存失效，下一次 Agent 步骤由 `dsh-tool-skill` 更新目录；目录出现不等于模型已经读取正文。

独立 Web profile 与桌面若共享同一个 DSH_HOME，也共享这两项用户技能。从安装包执行：

```powershell
& '<安装包绝对目录>/lib/install-skills.ps1' -LocalOnly -SourceDirectory '<安装包绝对目录>/skills' -DestinationDirectory '<实际DSH_HOME>/skills'
```

可先附加 `-ValidateOnly` 核对来源和目标，不写文件。安装器只更新项目维护的这两项技能，替换前备份旧版，其他技能保持原样；无需启动或重启 DSH。原生目录中模型使用 `skill` 工具加载 `ozon-listing`，用户也可使用 `/ozon-listing`。Host 提供精简经营能力入口及随包指引的准确路径，原生目录尚未更新时仍可读取同版本正文。

发行测试检查复制内容、重复安装及其他技能保留；实际 DSH 目录发现与模型加载需要在目标 profile 中分别观察，不能仅由安装成功推定。
