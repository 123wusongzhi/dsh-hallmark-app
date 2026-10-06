# 采集商品模板

普通 React 18 + Vite + Tailwind 源码工程。按钮和表格 primitive 根据 shadcn/ui（MIT）改编，业务布局由普通 React 与 CSS 实现。TanStack Table 管理宽屏表格；窄栏使用同一份数据的图文列表。设计与布局可以直接修改，不经过 widget 或样式白名单。

蓝色用在选择与主要操作，青绿色只提示已读取数据；标题、商品名称、操作优先，来源、时间与数量降低权重。真实商品图片优先，缺图显示明确的占位说明。不会补造价格、销量、利润或商品图片。来源报价与最终成本区别标明。

`src/lib/runtime/` 是 `packages/component-runtime/src/` 的源代码副本（@hallmark/component-runtime 0.1.0，hallmark.source.v1），随工程保存，保证移动目录后仍可 `npm ci && npm run build`。这是一层可改的通信辅助库，不限制设计；更新 SDK 时同步这里的 client.ts/react.tsx。

数据绑定由打开时提供。优先使用绑定 ID `collected`。真实数据源的返回顺序不保证全库最近；本模板对**已载入范围**按已提供的 importedAt/collectedAt 排序，缺失时间放在后面。页面明确标记本次范围，分页不丢弃载入数据。

每次调整后用同一份 `dist` 在 380px 与 1100px 宽度预览；实际检查长名称、缺图、搜索无结果、多选、键盘焦点和附加后的提示，再继续修改。独立预览中的附加只进行协议演练，在 DSH 内才会创建真实聊天附件。

运行命令详见项目的 docs/source-component-authoring.md。组件工程本身没有私钥、服务凭据或固定店铺数据。
