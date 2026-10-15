# 测试问题 #55–58 复现与复测

本批从 `83cf96d1dc04e1af77f5862f18e697d49b0a60eb` 开始，处理仓库 `123wusongzhi/dsh-hallmark-app` 的四个新问题。已读取完整 issue 与评论，并逐项核对实际 `created_at`：

| Issue | created_at（UTC） | 结论与正式改动 |
| --- | --- | --- |
| #55 | 2026-10-15T18:55:12Z | 有价值；SDK preparing 六个子进程场景使用受控时间，保留原协议、失败、清理断言，并补回原进程存活隐含的泄漏检测 |
| #56 | 2026-10-15T19:00:43Z | 有价值；只控制 prepared 卡片点击前的 16.05 秒空闲窗口，保留真实 HTTP 与点击后展示流程 |
| #57 | 2026-10-15T19:22:25Z | 有价值；现有 Alibaba SKU 场景补一行独立的长宽高预期 |
| #58 | 2026-10-15T19:35:24Z | 有价值；现有 analytics 场景补 views、cartEvents 和请求 metrics 顺序三个独立断言 |

以上均晚于本任务起点 `2026-10-15T15:02:44Z`。四项只修改现有测试，不改变生产行为、公开接口、校验、业务数据或冻结 corpus，也没有增加测试文件、依赖、skip 或数据分类规则。

## #55：提速同时保留卸载泄漏检测

原文件十二项中六项 preparing 场景实际等待轮询时间，重复消耗约 6.6 秒。正式版本在这些独立子进程中启用 Node 自带 `mock.timers` 的 Date/setTimeout，保留真实 React `act`、Promise、`setImmediate`、生产 `useApps`、`ComponentHost`、apps-client 与 DataTransfers。其余六项仍用真实计时。没有实现自定义调度器。

初始 legacy/transfer 与 push 场景明确检查 999ms 尚未读取、1000ms 恰好读取一次。原 preparing/loading、错误分类、hidden 暂停、卸载取消、ready 去重、无 refresh 等断言均保留。原 54 个 assert 调用完整保留，最终为 66 个。非工作目录启动也通过，路径由 `import.meta.url` 确定。

独立对照发现，直接 `mock.timers.reset()` 会掩盖旧测试凭子进程无法退出发现的生命周期错误：临时移除两处 `budget.stop` 后，旧测试约 10.200s 因 ETIMEDOUT 失败，初始提速候选反而通过。因此没有直接采用该候选。最终版本先卸载、dispose、确认监听器清空，再排空真实异步 turn；用原生 `runAll()` 检查 Date 不再前进，最后在 finally reset 并确认原始计时器身份恢复。同一泄漏故障在最终版本约 0.302s 被 `unmount and host disposal must clear pending timers` 检出。恢复生产源码后十二项通过。

其他控制在清理补强前的提速候选上执行，结果如下。最终版本只增加上述清理断言；该版本另做泄漏检出、十二项正常与外工作目录回归，未把前一 SHA 的故障矩阵冒充最终 SHA 重跑：

| 临时故障 | 旧测试 | 提速测试 |
| --- | --- | --- |
| 数据仍 preparing 时提前 ready | 2 项失败 | 2 项失败 |
| 隐藏后继续读取（含客户端 visibility 控制） | 1 项失败 | 1 项失败 |
| push 后重复 ready | 1 项失败 | 1 项失败 |
| 初始轮询改为 999ms / 1001ms | 原测试没有精确边界断言 | 各 2 项失败 |
| push 轮询改为 999ms / 1001ms | 原测试没有精确边界断言 | 各 1 项失败 |

初始候选与最终版本的十二个 fixture 在归一化请求随机标识后，报文、最终数据、读取次数、ready 次数和清理结果与旧版一致。故障路径也验证到达清理，删除 reset 的控制会被身份检查检出；最终版本另复核了这两个清理控制。最终新增泄漏断言另有上述独立对照。

Windows x64、Node v24.12.0、React/react-test-renderer 18.3.1、esbuild 0.25.0：先做三对旧/初始候选交错计时，再在生命周期补强后单独测最终文件三次。旧版耗时 8.154/8.084/8.141s；最终版为 1.655/1.746/1.674s，均十二项通过。相对先前旧版中位数，最终文件约减少 6.467s（79.44%）。最终三次与旧版属于分批比较，不能称为最终版本的交错实验，也不沿用初始候选的 81.00% 数字。

## #56：保留 16.05 秒逻辑窗口与真实 HTTP

原 prepared 卡片测试必须确认用户点击前没有自动打开 iframe、业务 POST 或 ready deadline，然后执行精确 build 的点击、hello 授权与 renderReady 展示验证。简单缩短等待会漏掉 16 秒附近的回归，因此保留原 16050ms 窗口。

正式版本仅在 render 前到 idle 断言期间控制 Date/setTimeout/setInterval，每毫秒推进并通过真实 `act`/`setImmediate` 排空真实 loopback fetch 与 `Response.json()`。追踪请求有墙钟超时界限；HTTP、React 与 Promise 均继续实际运行。在原 click 前 finally 恢复计时器和 fetch 并核对身份。点击后原代码、其余场景与原监听器/端口清理保留。

三类自然故障分别是 16000ms 自动打开、16000ms 发 failMount POST、丢失最终“已展示”UI。旧、新各一次均准确命中原 opened=0、无 POST、UI 匹配断言；没有靠超时或找不到按钮制造失败。所有故障均释放端口（ECONNREFUSED）、监听器归零，受控时钟恢复成功。恢复后完整 native 文件加 handshake 为 32/32，通过且无 skip/cancel。

本机两对交错顺序为 old/new、new/old：17.078/1.125、1.131/17.056s，四次定向测试均通过。中位 17.067→1.128s，减少 15.939s（93.39%）。这是 prepared 单项墙钟，不是完整文件或全仓收益。

兼容性判断：该 idle Shell 只挂 AppsToolView，当前没有 frame readiness budget、轮询 interval 或 NativePublicationObserver；frame 预算在恢复真实时钟后的 click 才建立。请求计数归零仅表明被追踪的 fetch/json 完成，不证明任意全局 Promise/定时器队列为空。此方法不推广到已挂 iframe/轮询的 discover-auto 场景，也不声称覆盖未来随意增加的 idle 计时器泄漏。

## #57：独立保护 SKU 轴顺序

公共包装尺寸断言经过不同输入分支，服务与 normalizer 一致性比较又共享同一映射，不能独立防止 SKU scalar Width/Height 被调换。复用原场景的 30/20/10cm 与 B,A 排列、仅 A 有物流记录，在 SKU A 上断言 `{length:300,width:200,height:100}`。厘米转毫米来自既有 collection 文档契约，不约束显式其他单位的场景。原重量、首 SKU package=null、图片身份及所有已有断言保留。

固定七个原有文件共 143 项：旧版正常 143/143；临时交换 scalar Width/Height 后旧版仍 143/143，新版 142 通过、仅原 Alibaba case 失败（实际 width=100,height=200）；恢复源码后 143/143。无新增 fixture/case，无 skip/cancel。主区 collection-4/filterRelatedProducts 改动保留，其源推荐过滤不改变本例 scalar 数值与 SKU 身份。

## #58：独立保护结果值及请求顺序

原 fixture 的 `[0,1,2,3,4]` 已足够区分字段，但旧断言只保护 impressions/orderedUnits/visitors 和 dimension。现直接断言 views=1、cartEvents=2，以及独立字面量 metrics 列表 `hits_view_search,hits_view_pdp,hits_tocart,ordered_units,session_view_pdp`。预期不读取生产 mapper 或由实际结果回算。原零值、日期、维度等断言保留。

固定 ozon-data/provider 两文件旧版正常 64/64。分别临时将 cartEvents 改读 metrics[1]、交换请求第二和第三个 metric：旧版均仍 64/64；新版均 63 通过、仅原 analytics case 失败。恢复后再加 ozon-compose 共 101/101，skip/cancel 为零。以上验证本仓库已实现的契约，不宣称完成线上 Ozon 或真实商家业务验证。

## 恢复、集成与最终检查

所有临时生产 mutation 均保存原 Buffer、在 finally 写回并校验 SHA-256；最终生产 diff 为零。涉及的六个源文件覆盖 apps-react、apps-client、view、component-handlers、collection normalize 和 ozon-data。测试与冻结 corpus 的原始输入未重写。

主区初次集成快照保护 86 个既有修改/未跟踪文件。三份原本干净的测试先与 HEAD 核对再应用补丁。主区 `ozon-data.test.ts` 已有用户改动，因此仅插入本批两行，逆向删除这两行后 SHA 与原始文件一致；没有覆盖用户的新增测试或采购/重量工作。其他受保护文件在集成后逐字未变，既有 scope 分类完整保留。

| 验证 | 实际结果 |
| --- | --- |
| 隔离区最终七文件联合回归 | 171/171，0 fail/skip/cancel |
| 隔离区 `tsc --noEmit` | 通过 |
| 隔离区 `audit-real-test-data.mjs` | 通过 |
| 主区同七文件（泄漏补强前） | 173/173，0 fail/skip/cancel；多出的两项是主区既有测试 |
| 主区最终 SDK 清理补强后单文件 | 12/12，0 fail/skip/cancel；其余六文件未再修改 |
| 主区类型检查 | 失败，10 条诊断均在既有用户改动 `operations-adapter.ts:371–373`：policy 可能 null、currency/version/minimumPrice/maximumPrice 属性不存在 |
| 主区数据审计 | 失败，既有 `test/app-hallmark/procurement-sync.test.ts` 尚未分类 |
| 本批 diff 空白检查 | 通过 |

原始 TAP、计时、故障控制及恢复 SHA 记录保存在本地忽略目录 `artifacts/issue-review-automation20-20261015T1953/`，随本聊天主区证据保留。正式提交仅四个测试文件和本报告；主区以保留工作文件字节的方式前移到提交，索引不包含用户改动。

限制：本次是定向离线验证，没有重新运行全仓测试，没有验证 Linux/Node 22 或真实桌面安装。两项速度收益仅限上述本机范围。主区类型与审计失败仍需其对应开发工作处理，不能称全仓全绿。定时检查保留每 60 分钟运行。
