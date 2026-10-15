# Agent 组件稳定展示：根因与根治方案（2026-10-15）

背景见 [runtime-unavailable-20261015.md](performance/runtime-unavailable-20261015.md)。那次已经修掉的是一个具体的性能根因。本文回答的是另一个问题：怎样让"Agent 说组件完成了"和"用户确实看到了数据"始终一致，并且展示链路不再因为一次偶发异常就失败。

本文保留最初代码调研，文中行号属于当时工作区。接续实现已修正缓存、期限与恢复边界；最终验收状态见 [接续验收报告](组件稳定展示-接续验收报告-20261015.md)。历史分析不代表最终实现或当前部署状态。

## 一、根因

问题不在某一个 bug，而在两处结构性设计。

**根因 A：完成不是系统给出的事实，而是由 Agent 推断出来的。**

三种状态在数据上其实已经分开记录：
- 构建通过：BuildReceipt；
- 发布已接受：publication 处于 `prepared`；
- 实际展示：只有 iframe 在数据读取、React 提交和断言全部通过后发出 renderReady，系统才记为 `display.state=ready`，并把发布推进到 `mounted`。

但这些状态没有直接送到 Agent 的完成判断里：
1. `publish` 返回 `status:ok, state:prepared` 后就结束，没有等待，也没有给出结果（`app-presentation/src/authoring.ts:203-219`）。"成功仅表示已准备好"只写在说明文字里，不在返回结果里。
2. Agent 必须自己想到调用 inspect。即使调用了，有些情况下得到的建议也会误导：
   - 用户没打开面板、或者页面不可见时，根本不会创建展示。这时 summary 返回 `blockedStage:'none'` 和 `open_prepared_build`，读起来像是成功，而这个动作 Agent 又无权执行（`authoring-summary.ts:35-36`）。
   - 展示停在 `opening` 时，服务端没有截止时间，只返回 `await_display`，也不带已经等了多久（`:30`）。
   - `lastConfirmedDisplay` 可能来自旧构建，容易被误读成本次已成功。
3. 一部分失败根本到不了服务端，inspect 也就看不到：
   - 父窗口的 `viewData` 读取失败、`open()` 失败，都只在本地显示（`plugin-apps/client/view.tsx:80`、`:163`）。
   - `reportDisplayError` 本身失败时，也只在本地显示"尚未同步给 Runtime"（`:129`）。
4. 旧的 `hallmark-app` 提示仍然写着"有截图即可宣称视觉验收"（`dsh-plugin/server/design-guidance.ts:13-15`），和新流程冲突。

**根因 B：展示读数路径在请求线程上做了大量重复的同步工作，没有预算；偶发错误会直接变成终局失败。**

1. **每次读一个数据块，都要把整套发布证据重新验证 8–10 遍。** 每遍都包括 manifest 读取和解析、遍历归档、校验回执文件，见 `authoring.ts:250-272` 的 `displayTarget` 和 `apps-server.ts:50`、`index.ts:433/468/481`。4 个数据块并行读取时，这些工作都挤在同一个线程上串行执行。49 MB 那次只是其中最重的一种表现。
2. **仍然存在按全部记录扫描的路径。** `provider_records` 的整表解析出现在：
   - 只按 buildId 查询视图（`apps-server.ts:343`）；
   - 首次加载时的业务计算（`app-hallmark/src/store.ts:23,58`，被采购、包装、定价等调用）；
   - 每 2 秒一次的 poller 和每 30 秒一次的 scheduler。

   数据库用的是同步的 `DatabaseSync`，`busy_timeout=5000`，最多可能阻塞 5 秒。
3. **首次加载会在请求里同步计算数据。** 没有快照时，打开视图会同步执行 `refreshView`，整个过程受 30 秒可见就绪期限约束。上次实测完整加载需要 27.6 秒，已经接近这个期限。
4. **错误分类丢失了信息。**
   - Runtime 的统一 catch 把所有异常都映射成 `400, retryPolicy:'never'`（`apps-server.ts:382`），数据库忙、内部异常看起来都像永久错误。
   - Host 端先调用 `json()` 再检查状态码（`transport.ts:67`）。
   - `componentBridge` 和统一 catch 都会丢掉底层原因（`index.ts:427,560`）。
   - `extension` 没有 try/catch，还会剥掉 `retryPolicy`（`component-handlers.ts:69`）。
5. **一次偶发失败就会让展示终局失败。** 首次 `getData` 只对 `BRIDGE_PAUSED` 重试（`apps-react.tsx:53`），其他错误一律直接上报 `phase:'data'`。展示被标记为 failed，并收回授权。
6. **缺少运维兜底。**
   - 没有 Runtime 守护：`autoStart:false`，也没有健康检查后重启。
   - Host 侧完全没有日志，Runtime 侧不记录读数请求。
   - 没有覆盖展示读数延迟的回归测试。

**未验证的推测：** `headersTimeout=10000`（`apps-server.ts:384`）。如果事件循环阻塞超过 10 秒，Node 可能以空的 408 关闭连接，再被 Host 当作非法 JSON 处理。这与报告中"空白或非法 JSON"一类错误吻合，需要受控复现确认。

## 二、根治原则

1. **完成状态由程序判定，不由 Agent 推断。** 工具返回结构化的结果，并附上程序生成的、可以直接引用的完成表述。Agent 不再从说明文字里推断。
2. **完整验证与每次读数的身份检查同时保留。** 打开、授权和 ready 时完整验证；后续读数每次检查授权、回执及归档成员/stat/ctime/realpath/符号链接身份，只对未变化文件复用哈希。TTL 不允许篡改窗口。
3. **数据要先准备好，再开始展示。** 展示只读快照。准备数据是一个有进度的过程，不是一次可能超时的阻塞请求。
4. **偶发错误不能变成终局失败。** 可重试的错误在预算内自动恢复；只有确定性错误才判失败，失败时保留完整原因。
5. **失败保留可诊断证据。** 浏览器错误先上报，暂时断连时在可见文档内有限补报；不能保证页面关闭或预算耗尽后的错误一定送达。

## 三、方案

### P0：完成判定（根因 A，改动小、收益最大）

| # | 改动 | 位置 |
| --- | --- | --- |
| A1 | inspect 和 publish 的返回增加单一字段 `outcome`，取值为 `build_passed`、`published_awaiting_display`、`displaying`、`displayed`、`display_failed`、`awaiting_user_view`、`display_stalled`。另附 `completionStatement`，由程序生成，例如"构建与预览已通过；发布已接受；尚未在 DSH 展示"。只有 `outcome=displayed`，并且对应当前发布和当前构建时，才会生成"已展示"。 | `authoring-summary.ts`、`authoring-descriptors.ts` |
| A2 | 新增 `apps.authoring.await_display`，或者给 publish 增加 `waitMs` 参数。服务端最多等待约 25 秒，直到本次发布的展示变成 ready 或 failed，然后返回 A1 的结果；可以重复调用。Agent 就不再需要靠记忆去调用 inspect。 | `authoring.ts`、descriptors |
| A3 | 展示状态增加服务端截止时间。`openDisplay` 记录 `openedAt` 和 `readyDeadlineAt`（例如墙钟 90 秒，不受页面隐藏影响）。超时后 summary 返回 `display_stalled`，并带上已等待的秒数，不再无限 `await_display`。 | `authoring.ts:282`、summary |
| A4 | 发布后没有可见面板时，返回 `awaiting_user_view`，建议改为"告知用户打开右侧面板"，不再返回 Agent 无法执行的 `open_prepared_build`。 | summary `:35` |
| A5 | 父窗口的失败（`viewData`、`open()`、handlers）也调用 `reportDisplayError`。上报失败时先存入本地待发队列，Runtime 可用后补发。服务端在 `errors[]` 中保存 requestId、attempt 和 cause。 | `view.tsx`、`component-handlers.ts` |
| A6 | `lastConfirmedDisplay` 增加 `isCurrentBuild` 标记。 | summary |
| A7 | 统一提示：删除 `hallmark-app` 中"有截图即可宣称完成"的旧规则。完成规则改成一句话："只引用工具返回的 completionStatement；outcome≠displayed 时不说已展示"。同步更新 skill 和 authoring-guidance。 | `design-guidance.ts`、`authoring-guidance.ts`、`hallmark-component-design/SKILL.md` |
| A8 | 契约测试，覆盖三点：任何没有 ready 回执的路径都不会产生 `displayed`；旧构建的成功不会被当作当前构建的成功；所有展示失败最终都能在 inspect 中看到。 | test/authoring |

做完 A1–A8 后，"构建通过、发布已接受、实际展示成功"由程序区分，Agent 的完成表述直接取自程序。展示失败时 Agent 至少能如实报告失败，不会把失败说成完成。

### P0：读数路径止血（根因 B 中风险最高的部分）

| # | 改动 | 位置 |
| --- | --- | --- |
| B1 | **复用未变化的验证结果。** 打开、frame grant、ready 时完整验证；每次 `getData`、分块和分页仍检查精确授权、依赖记录、归档成员及文件路径/stat/ctime身份。回执、成员、文件或权限变化立即失效；不依赖10分钟TTL发现篡改。未变化文件可复用哈希，不重复完整读盘。 | `authoring.ts`、`verified-displays.ts`、`source-components` |
| B2 | **错误分类。** Runtime 的 catch 按类型返回不同状态码：已知业务错误保持原码；数据库忙和未知内部错误返回 503 并标记可重试；记录日志。Host 先检查状态码，并处理空响应体。各层都保留 cause 和 requestId；`extension()` 增加 try/catch，保留 retryPolicy。 | `apps-server.ts:382`、`transport.ts:67`、`index.ts:427,560`、`component-handlers.ts:64-76` |
| B3 | **首次读数重试。** `readInitially` 遇到可重试错误时，在就绪预算内退避重试（例如 3 次）。只有确定性错误或预算耗尽才上报失败。 | `apps-react.tsx:53` |

### P1：结构性加固

| # | 改动 |
| --- | --- |
| B4 | **先准备数据，再开始展示。** 后台预热快照，返回 `preparing` 状态；父层保护旧 SDK，真实快照就绪后才挂载 iframe。实质的新数据或分块进展可续期30秒空闲期限，但每次展示仍受180秒墙钟总上限约束。准备绑定固定 publication 身份，历史发布不读取新草稿绑定。 |
| B5 | **消除全表扫描。** 给 `provider_records` 的 namespace 和关键字段建索引（已有 `evidence_relocations` 的做法可以照搬），`list()` 改为按 namespace 查询；按 buildId 查视图走索引；poller 只遍历活动中的 operations；scheduler 不再对全表执行 `json_each`。 |
| B6 | **限制请求线程工作。** 当前用索引、异步准备、验证复用减少阻塞，未将所有业务计算迁入 worker_threads。headersTimeout 相关历史推测未作为已证实根因。 |
| B7 | **可信且有限的 Runtime 恢复。** 只有显式托管清单匹配、跨 Host 锁持有、服务不可达且端口空闲时才拉起；不终止或接管未知进程。可见且仍属于原会话的初读失败，在健康恢复后有限重开同一 publication/build，生成新 display/frame 并等待新 SDK ready；业务写操作不自动重发。 |
| B8 | **可观测性。** Host 和 Runtime 对每个读数和桥接请求记录一行结构化日志：requestId、displayId、阶段、耗时、状态码和原因。用 `perf_hooks.monitorEventLoopDelay` 记录事件循环延迟，超过阈值时记录当时正在执行的请求。下一次"不可用"就能直接定位到具体原因。 |

### P2：防止回退

| # | 改动 |
| --- | --- |
| C1 | 增加展示读数的延迟回归测试，使用大规模 `provider_records` 和真实规模的证据集，设定三项预算：首次冷加载、数据块读取 p95、事件循环最大延迟。超出预算就让测试失败。 |
| C2 | 增加故障注入测试：丢失响应、503、数据库忙、Runtime 重启、页面隐藏和长时间准备数据。断言两点：展示最终变为 ready，或者以带原因的结果失败；Agent 拿到的 outcome 与实际情况一致。 |

## 四、建议顺序与验收

1. **第一批**：A1–A8 加 B2、B3。这一批改动集中在 summary、descriptors、view 客户端和错误映射，不涉及数据层。验收标准是 A8 和 C2 中与错误分类相关的用例全部通过；真实 DSH 中隐藏面板时，Agent 报告"待打开"，而不是"完成"。
2. **第二批**：B1 和 B8。验收看两点：未变化热读不重复完整证据验证和哈希，但每次仍有有界文件身份检查；日志能把一次失败对应到具体请求。
3. **第三批**：B4–B7 和 C1。验收要求首次冷加载不再依赖 30 秒总时长期限，且 Runtime 被强制结束后能自动恢复展示。

做完第一批，Agent 就不会再把未展示说成已完成。做完第二、三批，展示失败才会真正变少。前者解决的是表述是否准确，后者解决的是运行是否可靠，两者需要分别验收。
