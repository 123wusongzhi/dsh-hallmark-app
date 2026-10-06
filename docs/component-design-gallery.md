---
template: doc
theme: shadcn
title: 先看设计，再选组件
subtitle: Hallmark 设计讨论 · 四种现成方案 · 2026-10-06
lang: zh
---

这里展示开源项目的原版设计。图中的商品、价格与指标都是上游演示内容。选定后再适配 Hallmark 的真实数据与聊天操作。

## A 清晰表格：适合批量筛选和勾选

![shadcn 官方 Tasks 表格预览](https://ui.shadcn.com/examples/tasks-light.png)

**看什么：**搜索与筛选放在顶部；主信息清晰；状态、选中数量和分页各有位置。

**放哪里：**宽标签页中的采集商品、店铺商品和批量处理列表。窄侧栏需要减少列数。

**适配方向：**保留这套布局，把任务字段换成商品名称、来源和导入时间。选中后使用“附加到聊天”。

[打开原版，实际试用](https://ui.shadcn.com/examples/tasks) · [官方表格指南](https://ui.shadcn.com/docs/components/data-table)

## B 紧凑图文列表：适合聊天右侧

```html
<iframe src="https://ui.shadcn.com/docs/components/radix/item#image" title="shadcn 官方 Item 图片列表原版" loading="lazy" sandbox="allow-scripts allow-same-origin" style="width:100%;height:530px;border:1px solid #e4e4e7;border-radius:12px;background:#fff"></iframe>
```

**看什么：**左侧缩略图、中间两层文字、右侧辅助信息。每条内容有清楚的边界，纵向阅读自然。

**放哪里：**聊天右侧的商品列表、少量商品对比、查看单条结果。

**适配方向：**原版展示音乐条目；可换成商品图片、名称与来源，再接入选择状态。

这是我更推荐的**窄侧栏默认样式**。它的视觉结构可以复用，商品选择需要接到本项目。

[打开原版图片列表](https://ui.shadcn.com/docs/components/radix/item#image) · [shadcn 源码](https://github.com/shadcn-ui/ui)

## C 大图商品卡：适合看图挑选

```html
<iframe src="https://ui.stackzero.co/preview/product-card-03-block" title="Commerce UI 商品卡 03 原版" loading="lazy" sandbox="allow-scripts allow-same-origin" style="width:100%;height:690px;border:1px solid #e4e4e7;border-radius:12px;background:#fff"></iframe>
```

**看什么：**大图、商品名称、重点数值与操作区。图像占比明显高于表格。

**放哪里：**采集箱的图片浏览模式、单商品详情。大量商品的参数比较仍适合表格。

**适配方向：**复用卡片结构与间距。评分、折扣和购买按钮属于原站演示，接入时换成真实字段与选择操作。

原站提供多款免费商品卡，可以继续比较不同风格。当前展示的 03 促销感较强，可讨论是否保留这种强调方式。

[单独打开这张卡](https://ui.stackzero.co/preview/product-card-03-block) · [浏览全部商品卡设计](https://ui.stackzero.co/docs/blocks/product-card) · [MIT 开源仓库](https://github.com/stackzero-labs/ui)

## D 指标与趋势看板：适合应用工作台

![shadcn 官方 Dashboard 预览](https://ui.shadcn.com/examples/dashboard-light.png)

**看什么：**顶部指标卡、中间趋势图、底部明细。信息按“总览 → 变化 → 细节”排列。

**放哪里：**Hallmark 应用工作台、店铺经营概览、已有真实数据的分析页面。

**适配方向：**保留内容区层次。DSH 已有侧栏，接入时只取需要的内容模块。指标与增长率须由实际数据支持。

[打开原版看板](https://ui.shadcn.com/examples/dashboard) · [继续看官方 Recharts 图表设计](https://ui.shadcn.com/charts/area)

## E 可以组合使用

| 使用场景 | 我倾向的方案 | 主要原因 |
| --- | --- | --- |
| 聊天右侧，边聊边选商品 | B 紧凑图文列表 | 适合窄栏，图片和文字都容易读 |
| 展开到标签页，批量操作 | A 清晰表格 | 便于比较多行数据与选择 |
| 按外观挑选商品 | C 大图商品卡 | 看图更直观 |
| 应用首页与店铺概览 | D 指标与趋势看板 | 主次与阅读顺序明确 |

可以同时采用 B＋A，让同一批商品在窄栏和宽标签页使用不同视图。C 作为可切换的图片模式，D 用于工作台。这些是讨论建议，尚未作为新模板接入插件。

你可以用 A、B、C、D 指定喜欢的方案，也可以指出想保留的细节：图片大小、信息密度、圆角、配色或操作栏。

## F 来源与预览说明

上方 A、D 为官方发布的预览图。B、C 直接嵌入原站页面，可以在页面内查看。若内嵌预览没有显示，使用对应的“打开原版”链接。

- shadcn/ui：[GitHub](https://github.com/shadcn-ui/ui) · [MIT 许可](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)
- Commerce UI：[GitHub](https://github.com/stackzero-labs/ui) · [MIT 许可](https://github.com/stackzero-labs/ui/blob/main/LICENSE)

本页用于比较现成设计。图中英文、示例数据与营销操作沿用原站；Hallmark 适配后的中文、字段与行为另行确定。
