# 继续执行、阶段重试和草稿诊断

普通 `apps-authoring-check` 请求继续保持 build → record_build → 正式双视口 preview → record_preview。同一请求重复执行是 resume：返回已有真实执行的时间、日志、截图和回执，包含 FAIL/INCOMPLETE。环境恢复后希望重新执行时必须明确阶段重试。

## 显式阶段重试

在原 check 请求的最外层添加：

```json
{"retryStage":"preview","retryId":"恢复网络后第1次预览"}
```

`retryStage` 为 `build` 或 `preview`，`retryId` 是本次重试的明确身份，1–128 个字符。同一个 retryId 重复请求只恢复本次运行，包括 begin/登记响应丢失；需要再运行一次时换一个 retryId。相同 retryId 不能改源码、命令、相关环境、SDK 或预览计划。可查看返回的 `retryRequestPath` 获取新运行的普通 check 请求。

重试只接受失败 build 或失败/INCOMPLETE preview，且尚未发布。CLI 先核实旧报告、当前 Runtime 状态和原工作副本，再用既有 `begin(edit)` 取得真实新 attempt/epoch/sourceRevision。原 attempt 退役，原失败报告和回执不改写。旧运行仍可供审计。

build 重试真正启动构建进程。preview 重试要求先前构建 PASS、源码和锁文件未变、命令/toolchain/相关环境/所声明 SDK 均相同，才复用冻结归档。新的签名构建报告明确写 `executionKind:"reuse"`、`reusedFrom`、`reuseVerifiedAt`；保留原始构建的 executionId 和执行时间。它表示新 attempt 对已有构建的重新验证，不能算作又执行了一次构建。新 preview 启动独立 headless 浏览器，重新执行正式双视口检查。

复用授权来自原构建报告中 runner 签名的 `reuseInput`，与原签名报告链、当前源码和冻结归档一起核验。修改可编辑 checkpoint 的 key 不能批准复用。没有可信 reuseInput 的旧报告仍可按旧门槛读取/验证，但不能跨 attempt 采用；需要明确新 attempt 并真实重建。旧版本 checkpoint 的指纹不静默升级，返回 NEW_ATTEMPT_REQUIRED 并保留原文件。

## 构建环境依赖

精确匹配生成器内置 build.mjs 且直接使用当前 Node 的构建采用 `builtin` 环境策略。脚本改动、外部工具或自定义命令没有显式声明时采用 `conservative` 策略，全环境仍参与指纹。

自定义命令可以在 build 请求明确声明它读取的额外环境变量：

```json
{"environmentKeys":["VITE_API_BASE","BUILD_FLAVOR"]}
```

声明是在确认命令依赖后的选择；不要遗漏脚本、插件或子进程读取的变量。Node、Electron、esbuild、Go runtime、平台路径/临时目录、模块解析、locale 等安全依赖始终包含，声明不能排除它们。`environmentKeys:[]` 仅声明没有额外依赖。环境值只在进程内参与摘要，不写报告或诊断；输出只包含策略、变量名和摘要。相关依赖变化继续明确要求新 attempt。

## 草稿诊断

在已有 PASS build 的 preview 请求添加：

```json
{"validationProfile":"draft","draftViewport":640,"autoRecord":false,"assertions":[]}
```

draftViewport 范围是 320–4096 CSS px，默认 420。只运行这一视口和提供的局部断言，可省略交互计划；仍采集真实 DOM、bridge、错误和 PNG。结果始终为 `INCOMPLETE`，摘要标注 `validationProfile:"draft"`，下一步是 `run_formal_preview`。断言失败仍在摘要显示，INCOMPLETE 不代表断言成功。

草稿使用独立 checkpoint/summary，不覆盖正式预览。独立 preview 入口拒绝 draft+autoRecord。组合 check 请求声明 draft 时可登记真实 PASS build，但不登记 preview。runner 和 Runtime 均拒绝草稿作为正式 preview evidence，即使将草稿 verdict 改成 PASS 也不能通过。正式发布仍要求原有 420/1040 双视口、完整计划、必要交互和全部 required 断言成功。

本功能不打开用户浏览器、不写真实业务、不发布或保存组件。真实只读预览仍受既有 read-only 能力限制。
