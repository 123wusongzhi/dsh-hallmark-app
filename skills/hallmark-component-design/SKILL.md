---
name: hallmark-component-design
description: 用普通 React 源码创建、复用和编辑彩色业务组件；构建同一 dist，查看真实截图和交互反馈后改进，绑定真实商品并附加聊天附件，保存和恢复源码版本。
user-invocable: true
---

# Hallmark 组件设计

先读取 [Hallmark 视觉规范](references/visual-direction.md)。用户要求有颜色、有信息层级、可以长期使用的业务界面，当前偏好蓝白。结合真实内容安排阅读顺序、图片、留白、密度和操作权重。规范用于判断效果，不变成组件、布局、样式或依赖白名单。

## 源码制作是默认路径

读取 `hallmark_app_info.data.designCapabilities` 确认正在执行的 Host。0.3.0 增加普通源码工程；旧版没有该能力时明确说明版本，不假称已运行源码。

使用原有文件和命令工具，直接编写 TSX、CSS、JavaScript，安装普通 npm 依赖，复制修改 shadcn 页面和组件源码。允许循环、条件、状态、事件、图片、动画、图表和自行计算字段。实际出现问题再针对问题修改，不预设固定模板语言或设计白名单。

工程起点：`E:/project/deepseek_h/dsh-hallmark-app/component-workspace/collected-products`。
完整命令和桥接用法：`E:/project/deepseek_h/dsh-hallmark-app/docs/source-component-authoring.md`。

1. 先看 `hallmark_list_saved`，复用合适的源码组件/模板。新建时复制起点到新的工作目录，保留 package.json、锁文件和资源，不复制 node_modules。component.json 记录名称、入口和来源，不定义布局。
2. 查询真实商品和时间、金额、币种、状态字段，保留 datasetKey。采集摘要 importedAt 称导入时间，采购成本不称售价。缺失数据显示缺失，有真实源值时不因字段名含 profit 就隐藏。
3. 自由修改 src/Component.tsx、CSS 和本地 UI 源码。首模板采用蓝白层级、窄栏图文列表、宽页表格、搜索、多选和底部主操作；它是可修改的起点，不是固定排版。
4. 在工程内安装依赖、构建。用 scripts/source-preview.mjs 加载实际 dist，scripts/source-capture.mjs 取得图片、尺寸、buildId、运行错误和交互记录。先读取文档确认参数。
5. **打开截图实际看效果**，检查窄栏、宽页、长名称、缺失图片、搜索、勾选和附件按钮。修改源码后重新构建。构建成功或无报错不能替代视觉判断；若无法取得截图，明确缺少的证据。
6. 调用 `hallmark_open_source_component({directory,bindings})`，bindings 使用真实 datasetKey。工具登记已构建文件，DSH 加载与预览相同的 dist。继续修改同一草稿时重新构建，再传相同 viewId 打开。

源码页面独立运行自己的 React/CSS。需要其他版本或依赖时，按工程实际依赖解决，不把宿主 React 18 或旧 ViewSpec 当成永久上限。

## 数据和用户选择

薄 SDK 提供 getData、refresh、getContext、attachSelection。界面、筛选、排序、汇总、派生计算由普通 JS 实现。工程也可读取自己的数据文件或使用既有查询结果，不必为每种计算新增渲染器语法。

用户选择后，传宿主提供的稳定 keys 和当前数据 revision。外层从原始数据查回商品身份，沿用原生 Hallmark-已选产品-N项.json 附件。它出现在当前聊天输入区，保留用户文字，由用户补充要求后发送。选择本身不是调价、库存修改或上品授权。

Agent 收到该附件后先读取内容，按稳定 ID 查询核实，再结合用户指令处理。sessionId/viewId 是选择来源，不是额外业务权限。

## 保存、编辑与回退

草稿源码、登记构建和会话归属会保留。正式组件库保存仅在用户要求时调用 hallmark_save_component，记录保存原话。

- 保存包含源码、资源、依赖锁文件、dist、buildId 和数据绑定。
- 编辑：`hallmark_open_component({componentId})` 返回新 viewId、工作目录、sourceComponentId 和 baseRevision。编辑文件、构建，再用相同 viewId 登记。
- 更新原件：save_component 的 mode:update，componentId 取 sourceComponentId，expectedRevision 取 baseRevision。有版本冲突时重新打开或另存，不覆盖并行更新。
- 历史回退：open_component 传 revision 打开历史工作副本，确认后保存为新版本，保留历史。
- 也可保存源码模板，从模板复制工程继续改。“从本会话移除”只管理当前会话列表，与组件库删除分开。

## 旧 ViewSpec 仍可维护

旧组件继续使用 render_view/update_view。designCapabilities 中 widgets/layouts/grammar/limits/recipes/editExample **只属于旧路径**，不能作为源码限制。React/CSS 不能塞进旧 render_view 的 spec；需要源码时打开普通工程。

不为装饰填入虚构图片、价格、利润、库存或趋势。真实有序数据才做趋势图，说明参考利润与实际结算的区别。用户仍在讨论方案时展示可比较的彩色候选，未选定不把建议写成要求。

本技能是 Hallmark 本地适配。外部设计源码保留来源与许可，可参考已安装 Impeccable 和 shadcn 技能中的设计与组合方法。
