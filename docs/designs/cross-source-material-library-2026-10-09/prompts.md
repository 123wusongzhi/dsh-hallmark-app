# 生成记录与提示词

工具：内置 `image_gen.imagegen`。三次均为有参考图的界面编辑，`transparent_background: false`。未使用 CLI。

## 01 素材库

参考图：本地 Codex 生成图片会话目录中的 `exec-cf34a2dd-48dc-42b4-bcb5-48a95eb0200d.png`（个人目录路径省略）。

Use case: ui-mockup. Redesign the attached Hallmark component library screenshot to support combining fields from MULTIPLE data interfaces in a SINGLE component. This is screen 1 of a coherent three-screen product concept. Keep the blue-white style, exact left Hallmark/Notes app navigation, top 工作台 / 素材库 tabs, global store selector 店铺 Bill and overall calm desktop 16:10 composition. This is a visual design proposal, use 示例预览 for sample business data. Flat front-on app screenshot, no device frame or outside callouts.

The user wants visual hierarchy and simple use, not a dense configuration form. Main left gallery uses attractive actual widget thumbnail previews, minimal Chinese labels and spacious grouping. On right a large preview of selected template 商品经营表. The selected template must visibly combine several data domains, rather than limit the user to one API. Replace the former single 数据 dropdown entirely with MULTIPLE small source chips. The user chooses desired business information; data sources are joined automatically behind the UI, no manual JOIN or field-matching screen.

App shell: sidebar Hallmark Ozon, Hallmark selected, Notes beneath. Page heading 素材库 with quiet top search 搜索组件. Short category pills 常用 selected, 商品, 订单, 经营. Gallery six cards in 2 columns and 3 rows, predominantly visual thumbnails, titles 商品列表, 商品经营表, 库存概览, 订单进度, 费用明细, 售后记录. 商品经营表 selected with pale blue tint, thin blue border, little check. This selected thumbnail is a miniature product table with price, stock and order quantity, a small chain-link icon near its title. No long descriptions. Other thumbnails show tasteful small real widget layouts and tiny hardware photos. Do not put Bill or Helen on any card.

Right panel title 商品经营表, small 示例预览. Under the title two small scope controls: 主仓 with warehouse icon and chevron, 近7天 with calendar icon and chevron. Store remains only in top app bar. Below, a compact but highly legible 3-row preview with exactly FOUR columns 商品, 当前售价, 可售库存, 订购件数. 商品 cells have tiny actual hardware thumbnails and short Chinese product names. Rows: 金属按扣, CNY 44.97, 320, 16; 接线端子, CNY 16.46, 186, 8; 塑料按扣, CNY 21.52, 92, 5. Values are clearly examples, not a performance claim. The table is airy with aligned numeric values. At bottom of table show a small scope caption 主仓库存 · 近7天订购 to make the business meaning clear without a paragraph.

Below preview, show a quiet group label 数据来自 and FOUR equal small pills arranged in two rows, each with an understated blue line icon: 商品资料, 商品价格, 分仓库存, 流量分析. These are four simultaneous sources, no radio button or single-select dropdown. Then a restrained row button 调整显示 with slider icon and chevron; main blue footer action 添加到工作台. No raw API names, no schema, no SQL, no credential setup, no field walls or instructional copy. Sources of the same business component are shown once as compact chips.

Use thoughtful whitespace and three clear layers of scale: page title, visual components, small metadata. White and powder blue supporting surfaces, dark navy headings, slate captions, selective cobalt blue for active state and primary action. Crisp legible accurate Chinese. Minimal soft borders, 12–16px corners, almost no shadow. Respect the reference shell proportions. No colorful charts, giant KPIs, gradients, dark theme, marketing slogans or decorations. Make it immediately visually apparent that a single table contains product information, price, stock and period-based orders from four different sources.

## 02 调整显示

参考图 1：本套 `01-material-library.png` 的原始生成文件 `exec-707d9625-dd04-430d-a45e-25698f5f319e.png`。
参考图 2：原调整显示概念 `exec-27b648de-e2b2-43d0-8dca-676d15142e39.png`。两者原文件均位于上面的 generated_images 会话目录。

Use case: ui-mockup. Generate SCREEN 2 of the cross-source Hallmark component workflow by editing these references. Reference image 1 is the authoritative new gallery, product data, multi-source concept and app styling. Reference image 2 supplies the focused editing layout ONLY; replace its single-source pricing concept. Create one coherent crisp 16:10 application screenshot showing 调整显示 opened for 商品经营表. Preserve the same sidebar Hallmark Ozon / Hallmark / Notes, top tabs 工作台 / 素材库, top search and single global 店铺 Bill. No new app or outside annotations.

Focused workspace: gallery is replaced by a LARGE center-left table preview, and a clean settings panel on the right. Header above preview: quiet ‹ 返回素材库, strong 商品经营表, small 示例预览. Two unobtrusive scope chips aligned over the preview: warehouse icon 主仓 with chevron, calendar icon 近7天 with chevron. These shared scope controls govern the corresponding fields, not separate configuration per row. The product perspective is implicit in the title; do not expose JOIN, entity schemas or API identifiers.

Main preview exactly four columns 商品, 当前售价, 可售库存, 订购件数. Tiny muted sublabels 主仓 under the stock header and 近7天 under the order-quantity header communicate scope. Keep the same three hardware pictures and sample rows as reference 1: 金属按扣, CNY 44.97, 320, 16; 接线端子, CNY 16.46, 186, 8; 塑料按扣, CNY 21.52, 92, 5. Large readable table with white rows and generous spacing. Give ONLY the 可售库存 column a very pale blue background, matching the focused settings row. Beneath preview quiet 1 / 1 pagination and small 即时预览. No dashboard KPIs or unrelated content.

Right panel: heading 调整显示 with subtle close icon, small summary 4 项信息 · 4 类来源. Section 显示内容 with tiny 拖动排序 hint. EXACTLY four horizontal field cards, each with six-dot drag grip, semantic line icon, main field label, a SMALL muted origin label below it, and eye icon at right. Rows:
商品 — origin 商品资料
当前售价 — origin 商品价格
可售库存 — origin 分仓库存
订购件数 — origin 流量分析
The 可售库存 row is softly blue highlighted and shows a small pencil rename icon. This is a simultaneous multi-source field list, not a source picker that replaces the others. Clearly make origin labels smaller and subordinate to the user-facing field names. Do not duplicate origin information elsewhere as a huge grid. Immediately below the list a full-width understated ＋ 添加信息 action.

Lower panel group 显示样式: two small visual density tiles, 舒适 selected and 紧凑 unselected. Each is a miniature row-layout diagram rather than a descriptive paragraph. Then compact 每页条数 segmented buttons 5 / 10 / 20, 10 selected. Footer a quiet 恢复默认 link and ONE solid blue 完成 button. All fits visibly inside the panel without scrolling. No technical settings, no mappings, no checkbox wall, no verbose instructions, no extra dominant CTA.

Aesthetic: same premium but approachable blue-white family as references. Comfortable whitespace, strong visual hierarchy through scale and grouping, dark navy headings, slate metadata, powder-blue selection fills, bright blue primary action, thin soft borders, 12–16px radii, negligible shadow. Legible short Chinese labels. Use the screenshot width sensibly so both preview and four source-marked fields are easy to scan. Flat front view, no device frame, watermark, dark mode, decorative gradients or outside diagrams. The image must make it obvious that each visible column can come from a different interface while users just reorder or hide business information.

## 03 添加信息

参考图：本套 `02-display-settings.png` 的原始生成文件 `exec-1b337915-decf-4df2-8bbc-50a35d03a96f.png`，同上生成目录。

Use case: ui-mockup. Edit the attached image into SCREEN 3 of the same cross-source component workflow, immediately after pressing ＋ 添加信息. Keep identical application shell, blue-white palette, large central live preview, 商品经营表 title, 示例预览 label, top global 店铺 Bill, warehouse 主仓 and time 近7天 controls, and same hardware product imagery/sample data. The user specifically needs to combine information from DIFFERENT data interfaces. Make the interface simple and visual, avoid walls of fields or technical integration controls.

Right panel switches IN PLACE to an information picker, without nested modal or extra sidebar. Small top back arrow 调整显示, main heading 添加信息, short gray context 按商品组合. A compact search input 搜索信息 and a SINGLE short row of filter pills 全部 (selected), 商品, 价格, 库存, 流量, 更多. These filters browse compatible information across sources; they do not replace the current source. Do not label the panel as limited to one data API.

Show six clear selectable field tiles in a two-column three-row grid. Each tile uses one semantic line icon, a short main Chinese field name, one concrete example value and a subordinate small origin label. EXACT tiles:
Top left: 预留库存; sample 12 件; origin 分仓库存. SELECTED with pale-blue surface, blue outline and check.
Top right: 加购次数; sample 7 次; origin 流量分析. SELECTED with pale-blue surface, blue outline and check.
Middle left: 商家货号; sample SNAP-015; origin 商品资料. Unselected small plus.
Middle right: 划线价; sample CNY 59.00; origin 商品价格. Unselected small plus.
Bottom left: 详情浏览; sample 82 次; origin 流量分析. Unselected small plus.
Bottom right: 商品状态; sample 在售; origin 商品资料. Unselected small plus.
Keep the source badge small but legible, field title stronger and sample value distinct, 3 clean text levels. Avoid descriptions inside all tiles. Under tiles a quiet single-line hint 仅展示可关联到当前商品的信息. Footer: 已选 2 项 plus ONE blue 完成 button. No SQL, raw field names, identifiers to match, authorization screens, joins, API configuration, unconfirmed fields, unrelated aggregate financial metrics or save wizard.

Update central preview to show that the TWO fields were added together from DIFFERENT interfaces. It now has exactly SIX columns: 商品, 当前售价, 可售库存, 订购件数, 预留库存, 加购次数. The last two NEW columns have very soft pale-blue backgrounds and small 新增 badges, visually linked to the two selected tiles. Keep table readable, column widths appropriate: wider product cell with thumbnail+short name, narrow aligned integer columns. Short scope sublabels: 主仓 for stock columns, 近7天 for order and cart columns. Sample rows:
金属按扣 with photo, CNY 44.97, 320, 16, 12, 7
接线端子 with photo, CNY 16.46, 186, 8, 6, 4
塑料按扣 with photo, CNY 21.52, 92, 5, 3, 2
Existing four columns stay neutral; highlight ONLY the two new columns. All values are illustration sample data under 示例预览, not asserted real records. Keep quiet 1 / 1 pagination and 即时预览 below. Two selected tiles visibly show different origin labels 分仓库存 and 流量分析, explaining cross-interface composition without prose.

Style: same calm product screenshot as reference, accurate readable simplified Chinese, restrained navy headings, slate secondary metadata, selective bright-blue selection and action, white/icy-blue surfaces, understated rounded rectangles, precise alignment and breathing room. Layout fits the full 16:10 image, no clipping, no scrollbar wall or crowded repeated text. No exterior explanatory arrows, diagrams, watermark, device frame, dark mode, gradients or decorative graphics. Visual hierarchy and immediate preview should explain the entire interaction.
