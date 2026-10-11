# Binding 结果链路的本地复现

运行环境固定为 Node **24.12.0**。需要 Git，以及两个已准备好锁定依赖、已完成所需构建的独立 checkout；本目录不安装依赖、不提取附件、不访问 DSH 或真实业务服务。

## 执行

从候选仓库根目录执行，路径可包含空格，参数使用完整的 `--name=value`：

```powershell
node scripts/performance/binding-results/run.mjs --baseline=../baseline --candidate=. --mode=calibrate --arms=A,B --output=artifacts/performance/binding-calibration
node scripts/performance/binding-results/summarize.mjs artifacts/performance/binding-calibration
```

校准不属于正式性能样本。待两臂源码冻结且没有其他测试或构建竞争资源时，再执行：

```powershell
node scripts/performance/binding-results/run.mjs --baseline=../baseline --candidate=. --mode=formal --rounds=5 --output=artifacts/performance/binding-formal
node scripts/performance/binding-results/summarize.mjs artifacts/performance/binding-formal
```

两个 checkout 参数均为必填，相对于当前工作目录解析；不会隐式选择本机主工作区。输出路径须不存在。省略 `--output` 时写入当前目录下已忽略的 `artifacts/performance/binding-results/<mode>-<timestamp>`。请不要把输出放进待比较仓库的 packages 或 scripts 目录。运行不会替换已有证据，失败即停并保留样本，不重跑填补。

可用选项：`--suites=category,fields,...` 显式选择子集，`--timeout-ms=900000` 指每个进程上限；`--baseline-head=<SHA>` / `--candidate-head=<SHA>` 强制提交身份；`--candidate-label=<说明>` 记录比较对象。仅校准允许单臂 `--arms=A` 或 `--arms=B`。正式最少 5 对。候选未提交修改以源码散列识别，不能仅靠相同 HEAD 判定两臂相同。

## 协议与正确性

- 默认十套件：category、fields、literal-long、literal-absent、literal-short、arrays-whole、unicode、collection、sku、namespace。每套件 5 对独立 Node 进程，AB/BA 交替，共 100 进程；两臂串行，不删预热轮、离群值或失败样本。
- fixtures 已逐字节复制自审过的本地驱动，来源及原始散列见 provenance.json。只有合成数据、内存 SQLite、隔离 Runtime 和动态 127.0.0.1 HTTP。metrics 预加载拒绝非 loopback fetch，保留整个进程 CPU、wall 和 RSS。
- fields 比较 A 的完整读取与 B 的显式字段投影；literal 比较完整读取与精确定位加原文恢复。其他套件两臂使用相同策略，不把组合效果归给单个补丁。
- 原始 oracle 完整保留：字段与顺序、缺失/null、字面量全文/否定语义、Unicode 精确拼接、collection 返回数据与 total、SKU 所有分页及选择顺序。category 原字段一致性与新增字典提示分开核验。
- 正式 Unicode 维度不缩小，长/缺失 literal 为 240 段、短 literal 为 12 段；driver 清除继承的所有 fixture 开关。校准将 Unicode 缩到 0.2%、数组只留两个小控制、collection 缩到 16、SKU/namespace 为 32；category/literal 不缩。
- collection 正式保留 100/5000、查询/no-match、首次/热读、cursor/revision 以及 setup；query-cold 已在 empty-cold 后有部分预热，不是全冷启动。只读取前三个精确匹配和 total，不宣称遍历全部商品页。
- namespace 保留 32/5000 行、legacy/stable、全命中/5%/无命中。每个场景的十次直接调用合计只算一个观测；不是十个独立样本，也不是 Host/HTTP 延迟。最终候选已剔除 namespace 优化，这个 fixture 继续充当负控；原 20 项候选的大库 collection 收益不能当作最终收益。
- SKU 保留 32/2048、小选择/大选择/重复/未知/空/null/大小写控制；2048 仍严格检查 all/half/batch-half 调用为 52/26/76。
- 源码 packages/scripts 与 package manifests、Git HEAD/冲突状态、runner、provenance 和 fixture 均在运行前后核对；任一变化使运行无效。原始 stdout/stderr、trace、失败和全部指标保存在输出目录。
- 任务时间与完整进程时间分开。后者含载入、setup、oracle；RSS 为累计进程高水位。Windows 短任务 CPU 可能为零或粗粒度值。UTF-8 字节不等于 tokens。不合并不同任务的百分比。

## 独立正确性工具

保留确定性 Unicode literal oracle，以及旧 parity 的全部 854 组普通/错误输入比较，另加 6 组长路径控制。它们不是性能测量：

```powershell
node scripts/performance/binding-results/literal-oracle.mjs .
node scripts/performance/binding-results/reader-parity.mjs ../baseline .
```

reader-parity 对正常可恢复路径仍要求原始页面 JSON 字节完全一致。发现差异时先递归执行基线实际给出的全部读取入口：基线能完整恢复就判回退，不能仅凭“双方最终值相同”放行。只有基线确实因预算不足或超过公开 4000 码点路径限制而无法完整恢复，才允许已审的 serialized-json 分支；该分支必须逐页不超过预算、游标严格前进、text 与原 JSON 的码点区间精确一致，最终拼接 JSON.parse 后与原 result 子树深度相等。不会忽略其他错误或任意页形状差异。

当前修复后验证为 860 组比较，831 组字节全等，29 组经上述完整恢复证据允许的差异；另保存 76 个完整恢复记录。普通 512 字节 root 反例已由不必要的 1162 次 serialized 读取修回与基线相同的 363 次目录/文本读取。这是兼容修复证据，不是性能基准百分比。

报告与精简原始样本见 `docs/performance/binding-results-windows-20261011.md` 及同名 `.summary.json`。已中止的旧基线记录只作历史，不与当前正式结果混用。此目录的可移植入口不改变原 output 驱动或既有 raw 记录。
