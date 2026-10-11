import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

const root=resolve(process.argv[2]??'.'),workload=process.argv[3]??'moderate',pattern=process.argv[4]??'mixed';
const sizes={small:10,moderate:1000,large:10000};
const scale=Object.hasOwn(sizes,workload)?sizes[workload]:Number(workload),verifyOnly=process.argv.includes('--verify-only');
if(!Number.isSafeInteger(scale)||scale<1)throw new Error('Workload must be small, moderate, large, or a positive repetition count.');
const patterns={ascii:'abcdefghij',chinese:'汉字商品详情',emoji:'😀🧭𝄞😎🌍',mixed:'俄文 русский 汉字 😀𝄞\n"\\'};
if(!Object.hasOwn(patterns,pattern))throw new Error('Pattern must be ascii, chinese, emoji, or mixed.');
const load=relative=>import(pathToFileURL(join(root,relative)).href);
const {composeAppsRuntime}=await load('packages/service/src/apps-main.ts');
const {createAppsServer}=await load('packages/service/src/apps-server.ts');
const {AppsHost,HttpAppsHostTransport}=await load('packages/plugin-apps/src/index.ts');
const text=patterns[pattern].repeat(scale),directory=mkdtempSync(join(tmpdir(),'candidate72-reader-bench-'));
let instance,server,host;
try{
  instance=composeAppsRuntime(directory,{connections:[{appId:'notes',connectionId:'n',displayName:'n',config:{backend:'local:n'},enabled:true,configRevision:1}]});
  const token='b'.repeat(64);server=createAppsServer({...instance,token});
  const result={status:'ok',invocationId:'original',traceId:'trace',data:{text}};
  instance.store.put('datasets','result:original',{result});
  instance.store.put('invocations','original',{request:{appId:'notes',connectionId:'n',source:{kind:'agent',sessionId:'A'}},result});
  instance.runtime.bind({sessionId:'A',appId:'notes',connectionId:'n',enabled:true,boundAt:new Date().toISOString()});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const registered=new Map(),agent={id:'A'},context={
    tools:{register(tool){registered.set(tool.name,tool);return()=>{};}},
    agents:{get:id=>id==='A'?agent:undefined,list:()=>[agent]},sessions:{get:id=>id==='A'?agent:undefined},
    connection:{fetch:{register(){return()=>{};}}},commands:{register(){return()=>{};}},systemPrompt:{context(){return()=>{};}},on(){return()=>{};},
  };
  host=new AppsHost(context,new HttpAppsHostTransport(`http://127.0.0.1:${server.address().port}`,token));await host.start();
  const tool=registered.get('apps_inspect'),execution={agent,signal:new AbortController().signal};assert.ok(tool);
  const hash=createHash('sha256'),parts=[];let cursor='0',pages=0,bytes=0;
  if(!verifyOnly&&globalThis.gc)globalThis.gc();
  const start=verifyOnly?undefined:performance.now(),cpu=verifyOnly?undefined:process.cpuUsage();
  do{
    const args={resultRef:'result:original',path:'/data/text',cursor,limit:100};
    const value=await tool.execute(args,execution),render=tool.output.render(args,value)[0].text,page=JSON.parse(render);
    assert.equal(page.kind,'string',render);assert.ok(Buffer.byteLength(render,'utf8')<=16384);
    assert.equal(page.cursorUnit,'unicode-code-points');assert.equal(page.offset,Number(cursor));
    hash.update(render);parts.push(page.text);pages++;bytes+=Buffer.byteLength(render,'utf8');
    if(page.nextCursor!==null)assert.ok(Number(page.nextCursor)>Number(cursor));
    cursor=page.nextCursor;
  }while(cursor!==null);
  const elapsedMs=verifyOnly?undefined:performance.now()-start,used=verifyOnly?undefined:process.cpuUsage(cpu);
  assert.equal(parts.join(''),text);
  console.log(JSON.stringify({
    suite:'candidate72-reader',mode:verifyOnly?'verify':'benchmark',status:'PASS',root,workload,scale,pattern,
    round:Number(process.env.BENCH_ROUND??0),order:Number(process.env.BENCH_ORDER??0),variant:process.env.BENCH_VARIANT??null,
    platform:process.platform,arch:process.arch,node:process.version,gcExposed:typeof globalThis.gc==='function',
    inputBytes:Buffer.byteLength(JSON.stringify(text),'utf8'),inputHash:createHash('sha256').update(JSON.stringify(text)).digest('hex'),
    outputHash:hash.digest('hex'),pages,bytes,
    ...(!verifyOnly?{elapsedMs,cpuMs:(used.user+used.system)/1000,maxRssKb:process.resourceUsage().maxRSS}:{}),
  }));
}finally{
  await host?.dispose();
  if(server){server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
  await instance?.close();
  // This exact path is created above under the OS temporary directory for this run only.
  assert.equal(resolve(directory).startsWith(resolve(tmpdir())+'\\')||resolve(directory).startsWith(resolve(tmpdir())+'/'),true);
  rmSync(directory,{recursive:true,force:true});
}
