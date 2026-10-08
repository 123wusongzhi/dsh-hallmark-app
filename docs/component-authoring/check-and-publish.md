# 推荐入口：自动准备检查请求

从 Host 的 `checkRunner.prepareRequest` 复制请求，只填 begin 返回的 attemptId，保存到 evidenceRoot 下。用同一个 windowsCommand 执行此文件，返回 `stage: prepared` 和 `requestPath`；再用 windowsCommand 执行该 requestPath。准备步骤不构建、不发布、不新建 attempt。epoch、sourceRevision、viewId、workspacePath 一次从当前 inspect 获取，不手动替换版本号。

商品 starter 的正式验证计划位于 `.preview/plan.json`。检查请求仅引用 `preview.planPath`，不复制 assertions；该目录不属于源码指纹。计划中的 fill 可用 `valueFromSelector` 读取当前页面元素的文本作为搜索词，与固定 value 二选一。先搜索、清空搜索，再翻页。附加到聊天暂未开放，产品计划不包含勾选与附加。

所有有效的失败报告也自动登记。同一请求重跑恢复原结果、补登记，不再次执行；FAIL/INCOMPLETE 后修正计划或源码，显式 begin 新 attempt，再 prepare。旧回执不覆盖。仅改计划不会触发源码变化错误，但已登记预览的 attempt 仍需更换。

下面保留内联请求格式供已有工程兼容；新工程使用上述入口。

# 检查、续跑与发布

用 Host authoringGuidance 的真实 buildRequest 填入 begin 返回值，不猜安装路径。一次请求：

```json
{
  "build": "替换为完整 buildRequest 对象",
  "preview": {
    "mode": "live_readonly",
    "requiredMethods": ["getData", "refresh", "readBindingPage"],
    "assertions": [
      {"id":"initial","selector":"[data-product-row]","check":"visible","expected":true,"screenshot":{}},
      {"id":"next","action":"click","selector":"[data-testid=next]","checkSelector":"[data-testid=page]","check":"contains","expected":"第 2 页","screenshot":{"selector":"#pager"}}
    ]
  }
}
```

上面只是截图语法示例；完整交互计划由 starter 生成在 `.preview/plan.json`。requiredMethods 只填实际要验证的方法，并配套可观察的真实交互。

Windows 执行 Host `checkRunner.windowsCommand` 指向的 PowerShell 7 脚本，传入请求 JSON 路径。它使用请求 build.command 中的 Node 程序和参数启动检查，等待退出，输出 exitCode、result（含 summaryPath）和 stdoutPath/stderrPath。不要直接用 `& DeepSeek Harness.exe …` 后从空 `$LASTEXITCODE` 判断结果，也不要因为输出为空就立即重跑。

正常检查返回 PASS / FAIL / INCOMPLETE、原验证时间 verifiedAt、回执、复用标记、失败断言和截图。错误调用返回 ERROR 和独立 `.error.json` 路径，不覆盖已有成功摘要。

## 恢复与重新验证

- 同一 attempt、源码、构建输入、预览计划已成功：恢复原报告与回执，不重新读实时数据验证；verifiedAt 仍是原验证时间，完整报告 viewportResults[].bindingSnapshots 保留实际桥接读取的版本与源时间。
- 执行完成但回执登记失败：检查现有回执，只补登记原报告。
- 当前数据后来变化：不使已有成功验证失效，也不宣称旧报告验证了新数据。
- 用户要求验证最新数据，或已登记的源码／预览计划发生变化：新建 edit attempt，再执行检查。
- 未登记的预览计划改变：只重跑 preview，成功 build 可复用。
- ERROR 先读其摘要和 inspect.summary；不要仅凭错误名称修改源码。成功回执与一次失败调用是不同事实。

## 按步骤截图

给某条 assertion 加 `screenshot:{}`，在该检查结束时截图；加 `screenshot:{selector:"#pager"}` 先滚动到目标再截图。每个计划自动运行 420 和 1040 两个宽度，摘要 viewports[].screenshots 标出 afterCase、selector、path。

原有每个视口的最终截图继续保留。先完成必要交互再截图；不要另写 Host、CDP 或固定等待脚本。图片采用预览缓存／占位，截图不证明外网图片加载速度。

## 发布

PASS 后使用同 attempt/epoch/buildId/buildReceiptId/previewReceiptId 和 begin 返回的 expectedViewRevision 发布。publish 只确认已准备好；通过 inspect.summary.currentDisplay / nextAction 确认真正展示。保存是用户明确要求后的独立操作。


## 耗时同步与双尺寸验证

布局和轻量交互默认在 420/1040 两个视口执行。真实平台同步可以给 assertion 设置 `viewports:[420]`，并将 `invokeCapability` 放到计划的 `requiredMethodsOnce`；`requiredMethods` 继续表示每个视口都必须完成的方法。两个视口仍必须各有实际交互。例：

```json
{
  "requiredMethods": ["getData", "readBindingPage"],
  "requiredMethodsOnce": ["invokeCapability", "refresh"],
  "assertions": [
    {"id":"next","action":"click","selector":"[data-testid=next]","checkSelector":"[data-testid=page]","check":"text","expected":"第 2 页"},
    {"id":"sync","action":"click","selector":"[data-testid=sync]","viewports":[420],"operationTimeoutMs":30000,"checkSelector":"[role=status]","check":"contains","expected":"同步完成"}
  ]
}
```

检查器先等桥接请求结束（默认最多 30 秒，与当前 SDK 等待窗口一致），再给界面最多 5 秒更新。短操作立即继续，不固定睡眠。超时停止后续操作及视口，结果为 INCOMPLETE；不能把“已触发”当完成，也不重复提交平台同步。摘要 bridgeCalls 给出各视口实际方法、时长和错误。超过 SDK/Runtime 本身的超时需先定位平台问题，不能单独放大断言超时来掩盖。

`apps.refresh` 重读绑定；真正平台同步先调用 `hallmark.datasets.refresh`，成功后重读绑定。同步保留上一份成功快照，期间允许浏览和翻页；同步成功后才显示完成。不要生成 FAST_CHECK、测试专用轻量替代接口或与生产不同的构建。
