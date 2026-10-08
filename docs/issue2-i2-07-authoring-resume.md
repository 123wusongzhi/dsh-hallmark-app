# I2-07：复用构建并继续回执登记

2026-10-08，candidate.27。已安装到 DSH；运行版本、新 CLI 入口及安装文件哈希已核实。真实 Agent 轨迹效果仍待验证。

## 使用

优先读取当前 Host guidance 的 checkRunner，向其实际路径传一个 JSON：build 使用 guidance 的 buildRequest；preview 填 mode、requiredMethods 和实际交互断言。CLI 依次执行 build → record_build → preview → record_preview，不发布、不打开、不授权 frame、不保存组件。

原 build/preview 入口保留，也可单独继续。摘要提供 reusedBuild、reusedPreview、stage、nextAction 和原始报告/回执位置。组合 CLI 的 PASS/FAIL/INCOMPLETE 退出码为 0/1/2；执行异常退出 1。

## 复用范围

- 同一 session/view/attempt/epoch 的成功构建：核对源码内容、锁文件、命令、Node/平台、环境指纹、所提供的 SDK 内容指纹，并复用现有报告与归档验证。
- 构建或预览报告写出后、登记前保存继续执行所需的引用。登记响应丢失时先 inspect：已登记就返回同一回执；未登记则提交原报告，不重复执行。
- 相同预览请求及当前绑定快照可复用成功预览，保留实际原始时间、截图和来源。等待登记的原报告优先完成登记，不因期间数据更新而偷偷改用新报告。
- 尚未登记的预览计划/数据变化只重跑预览。已登记的回执在当前后端是不可变的；再改预览条件或成功构建的源码/命令/环境，明确返回 NEW_ATTEMPT_REQUIRED，不跨 attempt 拼回执。
- 失效、损坏、取消或被替代的证据不会被当作成功；报错并保留原始产物。没有增加新数据库、后台循环或自动发布。

## 验证

使用真实临时 Runtime、真实构建子进程和现有浏览器预览：

1. 分别模拟 build/preview 登记已成功但 HTTP 响应丢失；继续执行复用原回执，没有多余构建或预览报告。
2. 连续运行同一输入：两种 reused 标记均为 true，回执保持相同，没有 publication 或保存资产。
3. 未登记时修改预览断言：预览重跑，构建回执不变。
4. 已登记后修改计划，或修改源码：提示新 attempt，不重复执行。
5. 实际打包后的 check CLI 在仓库外运行两次：四步成功，第二次复用 build/preview。

真实 Agent 是否遵循新入口、总耗时减少多少，安装后再记录；不以回归成功虚报现场提升比例。
