# Workbench 只读拒绝副作用：独立复核

结论：PASS，建议接受本地 test-only 候选 `da51afcdbc3429740677a07fe6d77c165f4d4ecd`。

- 精确公开基线：`40520fe112cb53b7e5934c667e3fb0b1c2f38070`。当前生产顺序正确，本项只是防回归测试缺口。
- 两个新 detached worktree；Node v24.19.0 / v22.18.0，完全相同 82 文件、458 项四态：443/0/15 → 443/0/15 → 442/1/15 → 443/0/15（pass/fail/skip），cancelled 均 0。
- 唯一红灯来自原 case 新增的 operations=0 断言，actual=1、expected=0；458 项状态身份及15 skip 名称逐项核对。
- 临时 mutation 仅整体后移原 Workbench admission 块。未伪造 operations、未改 provider 返回。旧 case 真实内存 SQLite 留下 1 queued intent，合法 settled/WORKBENCH_READ_ONLY invocation 审计仍保留。
- queued 指账本意图，不代表持有连接队列锁或派发业务写。仅在受控临时重排 probe 中，同key新调用/inspect返回pending，rollback判断B/禁止legacy恢复，recover改写成CANCELLED_BEFORE_DISPATCH。原版及恢复版均无此问题，probe provider calls始终0。
- 双版 audit、变异/恢复 tsc 全通过；1353 tracked /272 packages 两棵全部哈希恢复，tracked diff空。候选完整补丁与实跑补丁字节一致。
- 最小修补：原 case 增加一行 operations.length===0；没有新增 fixture/case/wait，没有要求合法拒绝审计消失。
- 15项环境skip保留：14 Windows installer、1浏览器Host preview。未跑full或额外benchmark，未连接真实业务，未push、未发布issue。

交付：本地证据文件未随报告发布，[问题 #71](https://github.com/123wusongzhi/dsh-hallmark-app/issues/71) 包含中文完整论证、两个完整patch、四个实跑脚本、82文件清单与15skip清单；`VERIFICATION.json`、各Node完整日志/状态/观察/probe/1353文件哈希清单提供原始证据。

基数说明：首次preflight沿用前base的1352，在任何测试和修改前中止；本base新增#70说明，实测1353。核对后重新建树完成全矩阵，未隐藏或合并该次preflight结果。
