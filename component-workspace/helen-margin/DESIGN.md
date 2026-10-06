# helen 店铺 · 在售利润率组件

普通 React 18 + Vite + Tailwind 源码工程，从 `collected-products` 模板复制并改造。按钮与表格 primitive 来自 shadcn/ui（MIT），业务布局用普通 React 与 CSS 实现；TanStack Table 负责宽屏排序表格，窄栏使用同一份数据的图文列表。

## 内容与口径

- 数据源：`hallmark_list_store_products`（helen / Ozon），绑定 ID `helen`，只取 `status === 'on_sale'`。
- 利润率取源 `profit.actualMargin`（比例值），来自 Hallmark 参考利润模型（售价减采购成本、佣金与物流估算），**不是平台结算后的真实净利率**。
- 采购价取源 `sources[0].purchasePrice`（元）；利润/件取 `profit.profitMinor ÷ 100`；库存、曝光、浏览取源字段。
- 缺少精确来源采购价的商品，利润率显示“无法判断”，并保留源 `profit.reason` 作为说明，不补 0、不猜数值。
- 数据时间与币种写在页脚；采购价为源报价口径，不含运费与平台费用。

## 设计要点

蓝白为主色（页面底 `#f4f7fc`、卡片白、主色 `#1d4ed8`），绿色只用于利润率这类正向指标，橙色用于“无法判断”的提示，红色只用于亏损/缺货。信息层级：KPI 概览 → 商品表格（商品 → 售价 → 采购价 → 参考利润率 → 参考利润/件 → 库存 → 曝光/浏览）→ 选择并附加。真实商品图优先，缺图显示明确占位。

深浅主题各自定义完整色阶（`[data-theme="dark"]`），不把浅色底固定到暗色。380px 与 1100px 都会检查：窄栏切换为图文列表，长俄文标题两行截断，数字列右对齐。

## 运行

```powershell
npm ci --registry=https://registry.npmjs.org
npm run build
```

预览与截图命令见项目 `docs/source-component-authoring.md`。`src/lib/runtime/` 是组件运行时 SDK 的源码副本，随工程保存，保证移动目录后仍可独立构建。
