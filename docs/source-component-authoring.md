# 制作和验证源码组件

Agent 使用普通文件和命令工具编辑 React、CSS、依赖与资源。界面不受旧 ViewSpec 的 widget、布局、字段和样式词表限制。`component.json` 是工程信息，不是页面 DSL。第一份工程位于 `component-workspace/collected-products`。

## 先建真实页面

在工程目录运行：

```powershell
npm ci --registry=https://registry.npmjs.org
npm run build
```

工程采用 React 18、Vite、Tailwind 4、TanStack Table；`src/components/ui` 含可直接修改的 shadcn/ui Button 与 Table primitive，附 MIT 许可证。`src/Component.tsx` 实现商品列表；`src/styles.css` 控制完整配色、响应式和深浅主题。这些依赖与源码都可按实际设计需要修改。

`src/lib/runtime` 是薄 SDK 的源码副本。采用这种方式，是为了保存、恢复到其他目录后仍能独立 `npm ci && npm run build`。更新 SDK 时，从 `packages/component-runtime/src/client.ts` 和 `react.tsx` 同步该目录；不用把工程绑定到原 monorepo 的相对文件路径。

## 绑定真实数据并打开

先调用 `hallmark_search_collected_items`。使用它返回的真实 `datasetKey`，不猜数据集名称。然后调用：

```json
{
  "directory": "E:/project/deepseek_h/dsh-hallmark-app/component-workspace/collected-products",
  "bindings": [{
    "id": "collected",
    "datasetKey": "替换为查询返回的 datasetKey",
    "query": {"tool": "hallmark_search_collected_items", "params": {"limit": 100}},
    "fieldMap": {}
  }]
}
```

工具是 `hallmark_open_source_component`。它打开已构建 `dist/index.html` 并登记当前会话草稿，不会发布到组件库。再次构建后可带同一个 `viewId` 更新草稿。

模板显示本次查询范围，依据实际 `collectedAt / importedAt / createdAt` 排序，并标注时间类型。旧数据接口本身不保证全库最近排序，不能把首 100 条说成全库最近 100 条。真实图片由源 `mainImage` 等字段读取，缺失时显示“暂无图片”；不补造报价、销量或利润。

## 看同一份 dist，而后修改

以下命令从应用服务读取当前会话组件数据，凭据留在本机服务客户端；浏览器收到的是业务数据：

```powershell
node scripts/source-preview.mjs --directory component-workspace/collected-products --session <当前会话ID> --view <工具返回的viewId> --port 4318
```

打开终端输出的 `http://127.0.0.1:4318`。预览宿主使用同一份 dist 文件，不生成替代 HTML 组件。预览中的“附加”只演练选择协议并显示明确提示；在 DSH 内才会创建真实原生附件，等待用户手动发送。

也可从已有数据文件预览：

```powershell
node scripts/source-preview.mjs --directory component-workspace/collected-products --data artifacts/collected-source-data.json --port 4318
```

支持 `BindingData[]`、`{bindings:[...]}`、服务返回 `{status:"ok",data:{bindings:[...]}}`，或者完整 SDK `SourceData`。缺少数据时显示真实空状态，绝不默认塞入演示商品。数据文件放在工程外部或 `.preview` 中；正式模板无需携带固定店铺数据。

`/__manifest.json` 给出 dist 每个文件的哈希以及与 DSH 同算法的 `buildId`。修改源码后重新构建并重启预览；运行中的预览保持启动时的文件快照，避免一半新资源一半旧资源。

## 截图、操作、读取反馈

工程 devDependencies 已包含 Playwright。首次使用时安装 Playwright 浏览器，或传已有浏览器渠道：

```powershell
# 在组件工程内，仅在缺少可用浏览器时运行
npx playwright install chromium
```

在应用项目根目录：

```powershell
node scripts/source-capture.mjs --directory component-workspace/collected-products --session <会话ID> --view <viewId> --width 380 --height 850 --ready '[data-ready="ready"]'
node scripts/source-capture.mjs --directory component-workspace/collected-products --session <会话ID> --view <viewId> --width 1100 --height 850 --ready '[data-ready="ready"]'
```

可用 `--channel chrome` 指定已安装 Chrome，或 `--executable <绝对路径>`；`--color-scheme dark` 检查深色。普通源码页面不需要 `data-ready` 属性，省略 `--ready` 后按常规页面加载进行截图。

截图与反馈写入 `.preview/screenshot-380x850.png` 和同名 `.json`，并更新 `.preview/latest.png/latest.json`。报告包括 `buildId`、窗口尺寸、控制台错误、页面错误、失败网络请求、逐项交互结果和预览附件事件。Agent 必须用图像工具查看 PNG，检查视觉之后再改源码；“没有报错”不能代替“设计已经好看”。`latest.json` 的 buildId 与当前源码一致时，后端才能把截图认作当前构建的缩略图。

交互步骤通过 `--steps <JSON路径>` 提供，例如：

```json
[
  {"action":"fill","selector":"input[aria-label='搜索商品']","value":"端子"},
  {"action":"check","selector":".desktop-table thead input[type='checkbox']"},
  {"action":"assertText","selector":".selection-status","text":"已选"},
  {"action":"click","selector":".attach-button"},
  {"action":"waitFor","selector":".feedback"},
  {"action":"assertText","selector":".feedback","text":"预览已收到"}
]
```

支持 `click / fill / check / uncheck / select / press / waitFor / scrollIntoView / assertText`。选择器针对 iframe 内普通 DOM；这只是便捷交互脚本，组件源码本身不受这些动作词限制。窄屏选框使用 `.mobile-select-all input`，避免选中隐藏的宽屏控件。交互失败仍输出具体失败步骤和可获得的截图。

## 实际检查后再保存

首模板检查 380px 和 1100px、真实长标题、缺图、搜索无结果、选择跨页、附加后的状态和键盘焦点。视觉沿用 `skills/hallmark-component-design/references/visual-direction.md`：有颜色和层级，主操作突出，减少重复框线，数据缺失与错误状态明确。

用户要求保存时调用 `hallmark_save_component`。保存源码、CSS、资源、包锁与实际构建；正式更新保留旧版本。编辑已有版本先打开工作副本；回退也从历史版本打开，再保存为新的版本。普通依赖冲突、溢出或性能问题出现后，针对实际问题修改工程，不提前收紧 Agent 的表达能力。
