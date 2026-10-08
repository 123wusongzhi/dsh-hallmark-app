# 经营组件模板 v1

七个源码模板：products 商品经营总表、collection 采集箱、profit 利润贡献排行、traffic 流量与成交、pricing 价格调整复盘、campaigns 促销报名评估、review 促销效果复盘。

采集箱仅展示商品信息、SKU 规格、来源和采集价格。不含定价试算、物流分析、每日待办。所有业务页面为只读；促销勾选只保存本地候选，不提交报名。

## 本地预览

在仓库根目录运行 `node scripts/build-commerce-preview.mjs`，打开 `artifacts/commerce-templates/index.html`。这是离线单文件，使用明确标注的样例数据，不请求图片外网，不连接 DSH。

## 生成插件源码工程

先通过 apps.authoring.begin 得到空 workspacePath，再执行：

```
node scripts/create-commerce-template.mjs --template collection --directory <workspacePath> --sdk <authoring guidance sdkDirectory>
```

进入生成目录执行 npm install，保留 package-lock.json。组件是标准 React 源码工程，使用现有 @dsh/apps-component-runtime 的 useApps 读取数据、刷新和上报渲染断言。按现有 build runner → record_build → preview runner → record_preview → publish 流程发布。生成器目前位于仓库中，尚未打包进已安装插件。

## 绑定约定

编辑 src/adapter.ts 的 mapData，将实际 SDK viewData 的目标 binding 映射为 src/data.ts 中的 Dataset。字段映射要根据 apps_describe 和真实读取结果完成，不猜测返回结构。价格必须统一为 Dataset.currency；利润/利润率沿用数据源口径并在 note 说明，不从售价和采购价推算净利润。利润率单位为百分数（15 表示 15%）。没有字段时保留 undefined，界面显示 —。

items 每行有唯一 id、name、sku、spec；其余字段按 catalog.json 对应模板提供。采集商品多 SKU 要展开为多个唯一行。period 是当前统计期，comparisonPeriod 是对比期。分析模板需要后端或 Agent 提供相同口径的数据，模板不自动归因。

当前分页、搜索、排序都针对已读取 items，明确显示已读取数量 / total；接入完整业务数据时，应在适配层追加实际接口支持的服务器分页查询，不能把当前页当全部商品。预览不能证明真实数据绑定已完成。

## 交互验证

至少验证 420 / 1040 宽度：搜索 SKU 后匹配结果改变；翻页首行改变；打开详情、关闭后输入框可重新聚焦；采集箱切换卡片/列表；促销模板勾选计数改变；数据为空和读取失败能清晰展示。使用现有 preview runner 的真实点击和输入断言。

## 第一版边界

未提供自动报名、价格写回、附加聊天与跨 frame 状态恢复。模板复用布局和只读展示交互；这些能力应在需要时按 SDK 和实际绑定接入，不能以假按钮替代。此模板集不修改已有商品组件，也不自动安装 DSH。
