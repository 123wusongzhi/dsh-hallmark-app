# 采集商品列表：真实浏览器复现

此工具比较两个源码快照中的 `component-workspace/collected-products`。它通过 Vite 生产构建加载真实 `Component.tsx`、ReactDOM 和生产 CSS，在本机已安装的 headless Chrome 中运行。父页面与同源 iframe 使用真实组件 runtime 消息桥；它不是 `react-test-renderer` 或模拟 DOM。

性能结论仅适用于下述合成数据、操作顺序、构建及浏览器版本。普通操作、受控图片错误和自然图片失败分别保留证据；局部契约一致不代表全部功能或视觉体验一致。

## 环境与输入

- 使用两个独立源码目录作为 baseline 与 candidate，并保持构建和运行期间源码不变。baseline、candidate 的差异应由单独的 Git diff 记录。
- 使用现有 Node.js。历史采集环境为 Node `v24.12.0`；运行器直接导入 `vite.config.ts`，所选 Node 必须支持该文件所需的 TypeScript 加载能力。
- baseline 的 `component-workspace/collected-products/node_modules` 必须已有 Vite、Playwright、React、ReactDOM 及生产 Vite 配置所需插件。两个快照也必须能解析组件的其余既有依赖。运行器从 baseline 读取构建配置，并将两臂的 React/ReactDOM 指向同一依赖目录。
- 不需要也不应为此实验安装或升级共享依赖。依赖缺失时先记录环境缺口，不以临时安装改变比较条件。
- `CHROME_PATH` 指向现有 Chrome 可执行文件；缺省为 `C:/Program Files/Google/Chrome/Application/chrome.exe`。Playwright 只驱动该浏览器，不下载浏览器。结果会记录实际 Chrome 与 Node 版本。
- 串行执行构建、功能检查、正式计时和 trace。正式计时期间避免并行测试、构建或其他性能任务。

固定条件：`zh-CN`、`Asia/Shanghai`、浅色主题；desktop 为 `1280×900`，mobile 为 `420×900`。mobile 指窄视口响应式布局，不是手机硬件、触摸输入或移动 CPU 模拟。

`fixture-data.ts` 生成 48 或 500 条商品；生产分页每页仍为 20 条，桌面与移动分支同时存在于 DOM。包含有效、缺失及无效日期、相同时间戳、长标题、跨页选择、缺失报价与 CNY/USD 报价。普通图片为本地 data SVG；错误场景使用无效 data PNG。运行器阻止外部请求，不测网络图片下载。无货币、非法货币回退、动态时区和冷挂载不属于这组浏览器工作负载的覆盖范围。

## 命令

以下为 PowerShell 示例；先把所有 `ABS` 占位路径替换为已有绝对路径。输出目录必须是本轮新目录。后面的命令使用同一构建目录，但各模式、形状的结果名独立。

```powershell
$benchNode = 'C:/ABS/node-v24.12.0/node.exe'
$benchHarness = 'E:/ABS/repository/scripts/performance/candidate72-browser'
$benchBaseline = 'E:/ABS/baseline'
$benchCandidate = 'E:/ABS/candidate'
$benchOutput = 'E:/ABS/results/candidate72-browser-new-run'
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$benchRunner = Join-Path $benchHarness 'run-browser.mjs'
$benchAnalyzer = Join-Path $benchHarness 'analyze-browser.mjs'
```

先构建两臂。`build-manifest.json` 记录三份生产源文件、构建文件及冻结 fixture 的 SHA-256；`entry-baseline`、`entry-candidate` 保存构建时的 fixture 源码。另行保存本目录的运行器、分析器、执行命令和依赖版本，manifest 不是完整依赖锁定清单。

```powershell
& $benchNode $benchRunner build $benchBaseline $benchCandidate $benchOutput
```

独立运行全部四种形状的功能检查，每种形状各一个 baseline、candidate 进程。它会遍历完整查询结果并保存中间 HTML、控件属性、选择、排序、图片观察与最终截图。

```powershell
& $benchNode $benchRunner functional $benchBaseline $benchCandidate $benchOutput all
```

正式计时按形状分别串行运行。末尾整数是 ABBA 组数，不是交互周期数；以下示例每种形状均为 5 组。每组依次启动全新 Chrome 进程运行 baseline、candidate、candidate、baseline，因此 5 组共 20 个进程，每臂 10 个。若使用其他组数，应明确记录，不能把不同样本量写成同一实验。

```powershell
& $benchNode $benchRunner timing $benchBaseline $benchCandidate $benchOutput 500-desktop 5
& $benchNode $benchRunner timing $benchBaseline $benchCandidate $benchOutput 500-mobile 5
& $benchNode $benchRunner timing $benchBaseline $benchCandidate $benchOutput 48-desktop 5
& $benchNode $benchRunner timing $benchBaseline $benchCandidate $benchOutput 48-mobile 5
```

trace 单独执行；该模式每臂一个进程，启用 timeline、UserTiming、V8 GC 和 CPU 采样。带插桩的耗时不能混入正式 timing 统计。

```powershell
& $benchNode $benchRunner trace $benchBaseline $benchCandidate $benchOutput 500-desktop
```

分析器只读取已有结果，不启动浏览器。`raw` 可输入包含 `*-raw.json` 的目录，也可输入某个单独的 raw 文件；不同模式及形状分组统计。输出文件必须尚不存在。

```powershell
& $benchNode $benchAnalyzer raw $benchOutput (Join-Path $benchOutput 'analysis-raw-v1.json')
& $benchNode $benchAnalyzer raw (Join-Path $benchOutput 'timing-500-desktop-raw.json') (Join-Path $benchOutput 'analysis-timing-500-desktop-v1.json')
& $benchNode $benchAnalyzer trace (Join-Path $benchOutput 'trace-500-desktop-0-0-baseline.trace.json') (Join-Path $benchOutput 'analysis-trace-baseline-v1.json') --threshold-ms=20
& $benchNode $benchAnalyzer trace (Join-Path $benchOutput 'trace-500-desktop-0-1-candidate.trace.json') (Join-Path $benchOutput 'analysis-trace-candidate-v1.json') --threshold-ms=20
```

分析器发现差异时仍写出报告，并以退出码 `2` 标记 `needs-review`。自然坏图差异也会触发此状态；不能为了得到退出码 `0` 而删除观察字段。重复某个已完成的模式/形状时，使用新的输出目录并重新构建，保留旧目录。运行器拒绝覆盖已有逐进程结果；运行途中会更新本次 raw 汇总，不能将中断运行当成完整 ABBA 实验。

## 测量定义

每个正式进程先调用 `run(30, 0)` 预热，再读取 CDP 指标，随后调用 `run(0, 100)` 测量 100 个周期。两次调用之间不重建组件、不强制 GC。快照、结果返回和 CDP 通信仍发生在调用之间；这不是零开销的连续执行区间。

一个周期在同一 JavaScript 执行轮次内连续完成以下 11 个动作：

1. 搜索 `Lamp`。
2. 搜索 `  lAmP  `，包含首尾空格。
3. 来源选择 `1688`。
4. 清空搜索。
5. 来源恢复全部。
6. 下一页。
7. 切换该页第一件商品的选择。
8. 上一页。
9. 切换本页选择。
10. 再次切换本页选择。
11. 清空选择。

输入使用原生 value setter 加 DOM `input`/`change` 事件；按钮和复选框使用 `.click()`。每个动作以 `flushSync` 包裹派发，随后读取布局，强制完成当时的样式/布局工作。它们是程序派发的 DOM 事件，不是硬件输入。

| 字段 | 可解释的范围 |
| --- | --- |
| `dispatchToLayoutMs` | 原生 DOM 事件派发、同步 React 提交及该次强制布局的墙钟耗时；控件查找和 oracle 更新不在此单动作计时内。 |
| `dispatchBatchMs` | 整个 11 动作同步批次，包含控件查找、fixture 辅助操作和计量标记开销。 |
| `paintOpportunityWaitMs` / `cycleToSecondRafMs` | 周期末两个 `requestAnimationFrame` 回调的等待/总间隔。只表示绘制机会，不证明像素已经显示。 |
| `cdpDelta.TaskDuration` | 两次 CDP 读取间的浏览器主线程任务时间，原始单位为秒，分析器转换为毫秒。包含 `run()` 内三次完整 snapshot/oracle、结果序列化及区间内其他任务，不是纯组件渲染 CPU。 |
| `totalRunMs` | 页面打开到结果捕获的外围时间，含加载、预热、功能或测量等工作；不能作为冷挂载或交互性能指标。 |

11 个动作之间没有逐动作 rAF 等待，只有周期末一次双 rAF。因此本实验不测 INP、用户逐次点击的可见延迟、实际屏幕呈现时间或动画流畅度。现有选择栏 CSS transition 保留，但批次内中间状态未必获得绘制机会，也不会等待动画结束后再计作 JS 耗时。

计时循环不执行逐动作昂贵的完整 oracle；完整功能检查在独立 `functional` 模式运行。`run()` 开始、预热后及结束时仍会执行完整快照。LongTask 和 trace 与动作时间重叠只能定位调查范围，不能单凭重叠认定 GC、JIT 或某函数为原因。嵌套 trace 事件不可相加作为独立耗时。

## 逐次点击补验：run-paced.mjs

`run-paced.mjs` 复用已经由 `run-browser.mjs build` 生成的冻结构建，补验“选择本页 20 件 → 清空选择”两个动作。它使用 Playwright `locator.click()` 驱动浏览器，要求每次捕获的点击 `isTrusted === true`；这是程序驱动的 trusted 浏览器输入，不是物理鼠标操作。页面就绪后不调用 fixture 的 `run()` 或 `reset()`，也不使用 `flushSync` 包裹点击。

desktop 与 mobile 必须使用两个各自尚不存在的新输出目录，沿用上文的现有 Node、Chrome、依赖及 `CHROME_PATH` 设置。先完成上一条命令，再执行下一条，不与其他基准并行。

```powershell
$pacedRunner = Join-Path $benchHarness 'run-paced.mjs'
$pacedBuild = 'E:/ABS/results/existing-frozen-browser-build'
$pacedDesktopOutput = 'E:/ABS/results/paced-500-desktop-new-run'
$pacedMobileOutput = 'E:/ABS/results/paced-500-mobile-new-run'

& $benchNode $pacedRunner $pacedBuild $pacedDesktopOutput 500-desktop 1 30 100
& $benchNode $pacedRunner $pacedBuild $pacedMobileOutput 500-mobile 1 30 100
```

参数依次为已有构建目录、新输出目录、形状、ABBA 组数、预热周期数和正式周期数。形状只支持 `500-desktop`、`500-mobile`；后三个数字默认是 `1 30 100`，均须为正整数。一组 ABBA 启动四个全新 Chrome 进程，顺序为 baseline、candidate、candidate、baseline；每个进程在同一个已挂载组件上先预热 30 周期，再正式测量 100 周期。每周期两个点击，所以默认每进程保留 60 个预热样本和 200 个正式样本。

每次点击均在 iframe 内等待双 rAF，再校验选择状态，然后才开始下一次点击。选择后必须恰有 20 件选中，清空后必须为 0；检查同时覆盖桌面与移动 DOM 分支的行复选框、`data-selected`、本页选择框、底栏计数和操作按钮状态。普通 CSS transition、Playwright actionability 等待和自动滚动保留，不为了计时禁用。双 rAF 不是等待 CSS 动画完整结束。

| 字段 | 可解释的范围 |
| --- | --- |
| `eventToSecondRafMs` | 从点击事件 `timeStamp` 到第二次 rAF 回调；仅保留经过时间戳有效性检查的解释，异常样本仍保留并使验收失败。它不覆盖全部 pointerdown 到 click 的输入阶段。 |
| `captureToSecondRafMs` | 从页面捕获 click 到第二次 rAF 回调。上述两个 rAF 指标都在状态校验之前结束。 |
| `nodeOperationMs` / `nodeClickCallMs` | Node 侧操作或 click 调用的墙钟时间，包含 Playwright 传输、可操作性检查、自动滚动等等待；`nodeOperationMs` 还包含等待样本和页面状态校验返回。 |
| `measurement.cdpDelta.TaskDuration` | 正式阶段内渲染器主线程任务时间，包含每次点击的页面验收、正常 CSS/自动滚动引起的浏览器工作，以及该区间内其他主线程任务。它不是纯渲染 CPU、传输等待耗时或操作系统 CPU 利用率。 |

初始、预热结束和正式阶段结束的完整 DOM/控件快照位于各阶段 CDP 区间之外，另行保存并跨进程比较；正式区间内部仍有每次点击的验收开销。这个补验比 11 动作批次多了逐次等待和真实浏览器点击，但双 rAF 仍只代表绘制机会：不能称为 INP、实际像素显示延迟或动画流畅度证明，也不能与同步 `dispatchToLayoutMs` 当作同一种指标直接比较。

运行器自行输出 `run-manifest.json`、逐进程 JSON、`paced-<shape>-raw.json` 和 `summary.json`；manifest 记录脚本 SHA-256、完整构建 manifest、浏览器路径和计数配置。paced 结果使用自身的 summary，不与 `analyze-browser.mjs` 的 11 动作 timing/trace 输入混合。所有样本、失败、页面错误、被阻止的请求及状态检查均保留；无效计时样本不会因统计时跳过数值而被判为通过。

验收要求四个预期进程全部完成、trusted 点击及 20/0 状态检查通过、初始/预热后/最终完整快照跨进程相等。失败返回 `needs-review` 和退出码 `2`。**不存在“低于某耗时即通过”的性能门槛**；`complete` 只表示这组补验的完成和契约检查通过，不代替完整查询、跨页或图片失败功能检查，也不消除已有自然坏图差异。

2026-10-11 的 desktop 和 mobile 各一组 ABBA、合计八个进程均通过上述检查。两种布局仍分别保存在独立输出目录；手机布局绘制机会耗时的小幅增加见[补验报告](../../../docs/performance/candidate72-browser-20261011.md)，没有只保留正向结果。

## v3 与 v4 功能协议

历史 v3 正式计时使用其 `build-manifest.json` 对应的冻结 bundle 与 `entry-*` 源码。v4 修订的是不在 timing 循环中的受控图片错误步骤。报告必须分别标明计时构建和功能检查构建；v4 功能检查不等于重新运行过 v3 计时。当前目录重新 `build` 得到当前 fixture，不能将其冒称历史 v3 的逐字节复现。

v3 的图片检查先观察无效 data PNG 的真实浏览器错误，再仅向仍保留 `<img>` 的分支补发 `error`。已有 48/500 × desktop/mobile 四组观察均显示：baseline 桌面分支留下 `complete=true`、`naturalWidth=0` 的坏图节点，而 candidate 两分支均进入 fallback；两臂都记录了 trusted 的 mobile→desktop 错误事件。因此 v3 的补发序列本身不同：baseline 补发 desktop，candidate 无补发。这个序列差异不能单独用作“相同受控输入”的比较。

v4 完整保留 `imageFailure.naturalDecode`，随后双方都恢复相同有效 data URL、重新挂载并等待节点稳定，再固定按 desktop→mobile 顺序向相同节点各派发一次标准 `error`。输出保留 `controlledErrorReplay` 的起始状态、来源、事件定义、节点稳定性和实际分支，以及 fallback 和选择后的状态。

这个受控契约只验证稳定起点上的错误处理及随后选择操作的行为。它主动避开了“来源变化与自然失败同时发生”的过程，不能消除、覆盖或解释掉自然坏图差异。`ProductImage` 中重置 `failed` 的 effect 与错误事件的先后竞争是可能解释；没有对应 effect/事件提交轨迹时，不应写成已经证实的原因，也不能把四组重复观察直接归为噪声。

只有图片错误观察阶段会将相关图片改成 eager，以触发隐藏响应式分支的解码；普通计时保留生产 lazy 属性。这一错误场景不等同于真实远程图片加载过程。

## 结果判读与保存

- 保存 manifest、冻结 fixture、bundle、每进程 JSON、raw 汇总、trace、分析报告和执行命令。分析器不会剔除离群值；同时查看各进程及每组 ABBA 的方向、p95、max 和长尾次数，不只看合并中位数。
- 分开报告 `contractParityStatus`、`naturalObservationStatus` 和总体 `parityStatus`。受控契约相等而自然图片观察不同，总体仍是 `needs-review`，不能缩写为“功能全部一致”。
- HTML 与控件属性、完整查询顺序的相等仅覆盖已捕获状态。最终截图在恢复后的状态拍摄；父页面 iframe 高度为一屏，`fullPage` 不代表滚动捕获 iframe 内全部内容，也不覆盖所有交互或错误瞬间。
- 性能收益应带上数据量、视口、浏览器版本、进程数、预热/测量周期、计量字段和构建标识。不同数据量、视口、模式及旧实验的百分比不得相加或泛化为整站收益。
