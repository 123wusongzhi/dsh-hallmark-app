# Node 22.18.0 最低版本：受控时钟兼容性验证

日期：2026-10-15 UTC。验证提交：`606f51842b42d11ead8818e01d24e3833ee9c982`。

## 结论

本次在 Linux x64 / Node **v22.18.0** 实际执行了两项受控时钟目标、其相关回归与类型检查，全部通过。可以关闭“该提交的这两项时钟优化尚未在声明最低版本实测”的验证缺口；结论限于下面的运行环境、输入和命令。

没有修改生产或测试源码，没有跳过测试或降低断言，没有推送或发布。测试之后逐一重算全部 1326 个已跟踪文件的 Git blob hash，全部与指定提交一致。

## 运行时与依赖身份

- 运行时来自 Node 官方 [22.18.0 发布页](https://nodejs.org/en/blog/release/v22.18.0) 与 [Linux x64 归档](https://nodejs.org/download/release/v22.18.0/node-v22.18.0-linux-x64.tar.xz)。
- 归档大小：30,450,292 字节。SHA-256：`c1bfeecf1d7404fa74728f9db72e697decbd8119ccc6f5a294d795756dfcfca7`，同时匹配独立读到的官方值及下载的 [SHASUMS256.txt](https://nodejs.org/download/release/v22.18.0/SHASUMS256.txt)。
- 主机：Linux x86_64，glibc 2.41；Node module ABI 127。
- 运行时解压在本任务目录；所有命令通过其 `bin/node` 绝对路径运行。没有系统安装、全局 PATH/配置修改或替换既有 Node；原全局 Node 仍为 v24.19.0。
- 源码通过 `git archive 606f51842b42d11ead8818e01d24e3833ee9c982` 独立提取，不使用对象库工作树的历史 HEAD 作为验证输入。
- 复用已有 node_modules；锁文件与依赖所在原树的 SHA-256 一致：`6dfa707c589d59ad4442cc26ff1b4cb1441ff0c1453c1e952bdbd1e85376840b`。没有重新安装依赖。
- 实际载入 ESBuild 0.25.0、React/React DOM/react-test-renderer 18.3.1、TypeScript 5.9.3；相关声明 engine 允许 Node 22，且先用 Node 22 成功执行真实 ESBuild transform，再执行全部目标 bundle/test。
- 两个目标保存的 54 份 fixture command.json（独立首轮与相关回归合计）全部记录相同的独立 Node 22.18 `process.execPath`，全部 exit 0。相关目录其余可见子进程入口也使用 `process.execPath`。
- 使用提交自带公开脱敏语料，SHA-256：`9c45a56450fee1ec58438852bc991046965c8d1d91958094f5b59c038cf85a23`，离线生成浏览器测试数据。DSH_REAL_CORPUS、NODE_OPTIONS、DSH_PREVIEW_BROWSER_PATH、CHROME_PATH 均未设置。

## 验证结果

下表与文末列出的 `evidence/`、`tree/artifacts/` 路径是本次独立验证目录里的本地证据索引，不是仓库内的文件或可访问链接；这些日志、运行时归档、依赖和生成产物不随本文提交。本文包含复现所需的完整 builtin 探针与目标测试命令。

| 范围 | 结果 | 本次本地日志（不入库） |
| --- | --- | --- |
| Builtin MockTimers 行为探针 | 3/3，0 fail/skip/cancel | `evidence/builtin-probe.tap` |
| display-errors 原文件 | 12/12，0 fail/skip/cancel | `evidence/display-errors.tap` |
| native-candidate-surface 的 wait-click 命名目标 | 1/1，0 fail/skip/cancel | `evidence/wait-click.tap` |
| native-candidate-surface + native-frame-handshake 串行 | 32/32，0 fail/skip/cancel | `evidence/native-related.log` |
| apps-components 30 文件串行 | 211/211，0 fail/skip/cancel | `evidence/components-related.log` |
| 真实语料离线准备 | exit 0 | `evidence/prepare-real-data.log` |
| 真实数据分类与依赖审计 | PASS；308 test files；0 failures | `evidence/audit-real-data.log` |
| TypeScript noEmit | exit 0，空 stderr/stdout | `evidence/typecheck.log` |

以上测试范围有重复覆盖，不能相加宣称独立测试数量。相关回归及类型检查按顺序运行，记录窗口为 **19:25:57.991–19:27:08.920 UTC**，逐项命令、开始/结束时间和 exit code 见 `evidence/related-runs.json`。TAP 时长只用于确认执行，不用于新的性能比较。

### 行为证据

Builtin 探针实际验证：

1. 启用 Date/setTimeout/setInterval 后，零截止 setTimeout 由 tick(0) 执行，而 Date 保持原模拟时间；tick(1) 推进 Date 与 timeout/interval，clearInterval 停止重复；setImmediate/clearImmediate 保持真实函数。
2. 正常路径和主动抛错的 finally 路径执行 reset，Date、setTimeout/clearTimeout、setInterval/clearInterval、setImmediate/clearImmediate 均恢复原函数身份。
3. 使用真实 loopback HTTP server、fetch 与 Response.json；模拟时钟不前进，tick(0)+真实 setImmediate 排空即可完成响应。关闭后对端口连接得到 ECONNREFUSED。

原 wait-click 目标两次实际执行均确认：模拟 15999、16000、16050 ms 时，opened、iframeNodeCreations、POST 数、pendingRequests 全为 0，readyDeadlineAt 为 null；restored 为 true。继续完成原有 explicit click、exact preview build、iframe onLoad 不等于 ready、hello/grant、render-ready、displayed 断言。cleanup 记录 server 未监听、监听器归零、旧端口 ECONNREFUSED。原 display-errors 的 999/1000 ms polling 边界与 finally 恢复断言保持原字节并通过。

Node 22.18 会打印 MockTimers 为实验性 API 的警告；没有屏蔽它，警告不影响本次实际断言结果。

## 复现命令

准备与提交一致的独立源码树，并准备可用的仓库依赖。本文的运行复用了已有依赖，不将下面命令视为全新安装的验证证明。使用前文官方归档及校验值核验并解压 Node 22.18；不需要系统安装或修改 PATH。

先将本文附录的完整探针代码保存为**源码树之外**一个独立目录中的 `mock-timers-probe.mjs`。在源码根目录执行以下命令；将 N22、PROBE 的占位路径替换为实际绝对路径。PROBE 是读者从附录保存的文件，仓库不包含这个脚本。

```sh
N22=/absolute/path/to/node-v22.18.0-linux-x64/bin/node
PROBE=/absolute/path/to/independent-validation/mock-timers-probe.mjs
"$N22" --version
"$N22" --test --test-concurrency=1 --test-reporter=tap "$PROBE"
"$N22" scripts/prepare-real-test-data.mjs
"$N22" scripts/audit-real-test-data.mjs
"$N22" --test --test-reporter=tap test/apps-components/display-errors.test.ts
"$N22" --test --test-reporter=tap --test-name-pattern='^prepared original card waits' test/plugin-apps/native-candidate-surface.test.ts
"$N22" --test --test-concurrency=1 --test-reporter=tap test/plugin-apps/native-candidate-surface.test.ts test/plugin-apps/native-frame-handshake.test.ts
"$N22" --test --test-concurrency=1 --test-reporter=tap test/apps-components/*.test.ts
"$N22" node_modules/typescript/bin/tsc --noEmit
```

## 证据边界

这次没有跑全仓测试、重新安装依赖、做 Windows/macOS 验证、运行真实桌面/浏览器、调用真实商城/Runtime 服务或观察 GitHub CI。HTTP 为本机 loopback；目标已有 renderReady fixture 仍是模拟 bridge 事件。没有在 Node 22 重做之前的生产故障注入矩阵，不能把 Node 24 的故障控制结果改称 Node 22 实测。结论也不等于任意 Node 22.x/后续版本都已通过。

## 本次本地证据索引（不随本文提交）

以下相对路径仅描述验证时的独立工作目录布局，不能作为仓库路径使用。原始 fixture 与日志留在本地；第三方可用上面的命令和下方完整探针重新生成自己的证据。

- `evidence/runtime-provenance.json`：官方归档、校验值和运行时身份。
- `evidence/dependencies.txt`：依赖版本、路径和实际 ESBuild transform。
- `evidence/child-runtime-audit.json`：54 份目标子进程命令证据。
- `evidence/wait-click-evidence.json`：两次目标检查点和 cleanup。
- `evidence/source-integrity.json`：结束后 1326 个 tracked blob 全部一致。
- `evidence/targets-before.sha256`：两个目标初始 SHA-256；分别为 `4550d030b0aaad753a4f66ea2dff2e3efa8d57b26a2a6382fdcc7285a60ae7b5` 与 `fa7a1a8e5a6ad03c2da18e8d3b1063b7f13add355b72b3ad35b121a646b3dd2e`。
- `mock-timers-probe.mjs`：独立 builtin 行为探针；完整源代码附于下文。
- `tree/artifacts/`：原仓库目标自行生成的 fixture、命令与输出，不是生产数据或真实平台成功证明。

## 附录：完整 builtin 行为探针

此脚本只使用 Node 内置模块。保存方法及 PROBE 路径见上文；预期结果是 3 tests、3 pass、0 fail/cancel/skip。它创建的 HTTP 服务只监听临时 loopback 端口，结束时关闭并验证端口拒绝连接。真实目标回归仍需执行上文仓库命令，不能由探针单独代替。

<details>
<summary>展开 mock-timers-probe.mjs 完整源代码</summary>

```js
import test, {mock} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createConnection} from 'node:net';
console.log(JSON.stringify({version:process.version,execPath:process.execPath,platform:process.platform,arch:process.arch,modules:process.versions.modules}));
const names=['Date','setTimeout','clearTimeout','setInterval','clearInterval','setImmediate','clearImmediate'];
const originals=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
function assertRestored(){for(const [name,value] of Object.entries(originals))assert.equal(globalThis[name],value,`${name} restored`);}
test('Date and zero-deadline callbacks are advanced by tick(0), with full reset',()=>{
  try {
    mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:123456});
    const fired=[];
    setTimeout(()=>fired.push('zero'),0);
    assert.deepEqual(fired,[]);
    mock.timers.tick(0);
    assert.deepEqual(fired,['zero']);
    assert.equal(Date.now(),123456);
    const recurring=setInterval(()=>fired.push('interval'),1);
    setTimeout(()=>fired.push('timeout'),2);
    mock.timers.tick(1); assert.equal(Date.now(),123457); assert.deepEqual(fired,['zero','interval']);
    mock.timers.tick(1); assert.equal(Date.now(),123458); assert.equal(fired.filter(x=>x==='interval').length,2); assert.equal(fired.filter(x=>x==='timeout').length,1);
    clearInterval(recurring); mock.timers.tick(1); assert.equal(fired.filter(x=>x==='interval').length,2);
    assert.equal(setImmediate,originals.setImmediate); assert.equal(clearImmediate,originals.clearImmediate);
  } finally {mock.timers.reset(); assertRestored();}
});
test('reset executes through an exceptional cleanup path',()=>{
  let seen;
  try {mock.timers.enable({apis:['Date','setTimeout'],now:456});throw Error('intentional cleanup probe');}
  catch(error){seen=error;}
  finally {mock.timers.reset();assertRestored();}
  assert.equal(seen.message,'intentional cleanup probe');
});
test('real loopback HTTP/fetch/JSON settles while tick(0) drains mocked timers',async()=>{
  const server=createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;let settled=false,value,error,turns=0;
  try {
    mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:100000});
    fetch(`http://127.0.0.1:${port}/probe`).then(r=>r.json()).then(result=>{value=result;settled=true;},reason=>{error=reason;settled=true;});
    const deadline=performance.now()+3000;
    while(!settled){mock.timers.tick(0);await new Promise(resolve=>setImmediate(resolve));turns++;assert.ok(performance.now()<deadline,'loopback HTTP did not settle');}
    assert.equal(error,undefined);assert.deepEqual(value,{ok:true});assert.equal(Date.now(),100000);
    console.log(JSON.stringify({httpProbeTurns:turns,clockUnadvanced:true}));
  } finally {mock.timers.reset();assertRestored();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  const probe=await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve({connected:true});});socket.once('error',error=>{socket.destroy();resolve({connected:false,code:error.code});});});
  assert.equal(probe.connected,false);assert.equal(probe.code,'ECONNREFUSED');
});
```

</details>
