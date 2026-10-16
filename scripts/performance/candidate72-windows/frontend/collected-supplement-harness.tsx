import React from 'react';
import {create,unstable_batchedUpdates} from 'react-test-renderer';
import Component from 'PROFILE_COMPONENT';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';
import {Session} from 'node:inspector';
import {gzipSync} from 'node:zlib';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
const size=Number(process.argv[2]??48),mode=process.argv[3]??'oracle',output=process.argv[4];
assert.ok([48,500].includes(size));
const counters={renders:0,imageRenders:0,imageMounts:0,imageUnmounts:0,nameRenders:0,nameMounts:0,nameUnmounts:0,productTransforms:0,filterSortCalls:0,filterSortMs:0,filterSortSamples:[] as number[]};
globalThis.__stats={...counters,measureFilterSort(fn){const start=performance.now();const result=fn();const ms=performance.now()-start;this.filterSortCalls++;this.filterSortMs+=ms;this.filterSortSamples.push(ms);return result;}};
const countSnapshot=()=>Object.fromEntries(Object.keys(counters).filter(k=>k!=='filterSortSamples').map(k=>[k,globalThis.__stats[k]]));
const delta=(before)=>Object.fromEntries(Object.entries(countSnapshot()).map(([k,v])=>[k,Number(v)-before[k]]));
const network={attempts:0};const deny=()=>{network.attempts++;throw Error('External I/O is forbidden in UI fixture');};
globalThis.fetch=deny;http.request=deny;http.get=deny;https.request=deny;https.get=deny;net.connect=deny;net.createConnection=deny;tls.connect=deny;
const sourceNames=['1688','淘宝 / 天猫','AliExpress','本地导入'];
const typeNames=['Lamp 台灯','收纳 Storage','MUG 茶杯','Cable 线材','挂钩 Hook','厨房 Kitchen'];
const records=Array.from({length:size},(_,i)=>{
 const source=sourceNames[i%sourceNames.length],title=`${typeNames[i%typeNames.length]} 商品 ${String(i).padStart(3,'0')}${i%11===0?' · 加长款 多规格 适用于办公与居家使用'.repeat(2):''}`;
 // Precomputed fixture metadata is the oracle; no import from product conversion or filter implementation.
 const timestamp=i%13===0||i%17===0?undefined:Date.UTC(2026,9,1)+((i*37)%97)*60000;
 const date=timestamp===undefined?(i%17===0?'invalid-date':undefined):new Date(timestamp).toISOString();
 const row:any={id:`item-${i}`,title,sourceLabel:source,skuCount:(i%7)+1};
 if(date!==undefined)row[i%3===0?'collectedAt':i%3===1?'importedAt':'createdAt']=date;
 if(i%9!==0){row.minPrice=12+(i%81)/10;row.currency=i%5===0?'USD':'CNY';if(i%7===0)row.maxPrice=row.minPrice+3;}
 if(i%4===0)row.mainImage=`https://fixture.invalid/image-${i}.png`;
 return {key:`snapshot-key-${i}`,row,identity:{kind:'collected_item',itemId:`item-${i}`},oracle:{index:i,title,source,timestamp}};
});
const data={bindings:[{bindingId:'collected',datasetKey:'synthetic-loaded',payload:{items:records.map(x=>x.row)},state:'ready',provenance:{fixture:true},lastSuccessAt:'2026-10-10T00:00:00Z'}],selection:[{bindingId:'collected',eligible:true,rows:records.map(({key,row,identity})=>({key,row,identity}))}],revision:'synthetic-r1'};
const context={sessionId:'fixture-session',viewId:'fixture-view',buildId:'fixture-build',theme:'light',preview:true,attachment:{available:true}};
const messages:any[]=[],listeners=new Set<any>(),origin='https://fixture.invalid';
const fakeParent={postMessage(message,target){assert.equal(target,origin);assert.equal(message.channel,'hallmark.source.v1');messages.push({method:message.method,params:message.params});assert.ok(['getData','getContext'].includes(message.method),'Only initial read bridge calls permitted');queueMicrotask(()=>{for(const listener of listeners)listener({source:fakeParent,origin,data:{channel:message.channel,requestId:message.requestId,result:message.method==='getData'?data:context}});});}};
globalThis.window={parent:fakeParent,location:{origin},addEventListener(name,fn){assert.equal(name,'message');listeners.add(fn);},removeEventListener(name,fn){listeners.delete(fn);}};
globalThis.document={documentElement:{dataset:{}}};globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const settle=async()=>{for(let i=0;i<4;i++)await new Promise<void>(resolve=>setImmediate(resolve));};
const text=(n):string=>typeof n==='string'?n:(n?.children??[]).map(text).join('');
const sha=(value)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
let tree:any;let search='',source='all',page=0;const selected=new Set<string>();const trace:any[]=[];
const allMatches=()=>{
 const needle=search.trim().toLowerCase(),matches=[];
 for(const record of records){const o=record.oracle;if(source!=='all'&&o.source!==source)continue;if(needle&&!`${o.title} ${o.source}`.toLowerCase().includes(needle))continue;matches.push(record);}
 matches.sort((a,b)=>{const ta=a.oracle.timestamp,tb=b.oracle.timestamp;if(ta===undefined&&tb===undefined)return a.oracle.index-b.oracle.index;if(ta===undefined)return 1;if(tb===undefined)return -1;return tb-ta||a.oracle.index-b.oracle.index;});return matches;
};
const matchPage=()=>{const all=allMatches();return all.slice(page*20,(page+1)*20);};
const hostByLabel=(type,label)=>{const n=tree.root.findAllByType(type).find(n=>n.props['aria-label']===label);assert.ok(n,`${type} ${label}`);return n;};
const btn=label=>hostByLabel('button',label);
const footer=()=>tree.root.findAllByType('footer')[0];
const desktopRows=()=>tree.root.findAllByType('tbody')[0]?.findAllByType('tr')??[];
const mobileRows=()=>tree.root.findAllByType('article');
const hostFrames:any[]=[];
function check(name){
 if(mode==='oracle')hostFrames.push({name,host:tree.toJSON()});
 const expected=matchPage(),expectedTitles=expected.map(x=>x.oracle.title),actual=desktopRows().map(n=>text(n.findByProps({className:'product-name'}))),mobile=mobileRows().map(n=>text(n.findByProps({className:'product-name'})));
 assert.deepEqual(actual,expectedTitles,`${name}: complete visible desktop contents/order`);assert.deepEqual(mobile,expectedTitles,`${name}: complete visible mobile contents/order`);
 for(const typeRows of [desktopRows(),mobileRows()])for(let i=0;i<typeRows.length;i++){const n=typeRows[i],r=expected[i],box=n.findAllByType('input')[0];assert.equal(box.props.checked,selected.has(r.key),`${name}: ${r.key} stable selection`);assert.equal(n.props['data-selected'],selected.has(r.key));}
 const countText=selected.size?`已选 ${selected.size} 件商品`:'选择你想处理的商品';assert.ok(text(footer()).includes(countText),`${name}: selected count`);
 assert.equal(network.attempts,0);assert.deepEqual(messages.map(m=>m.method),['getData','getContext']);
 return {name,search,source,page,total:allMatches().length,keys:expected.map(x=>x.key),selected:[...selected].sort(),desktopMobileSame:true,frameHash:sha(tree.toJSON())};
}
async function event(name,fn,track=(mode==='oracle'||mode==='image')){
 const before=countSnapshot(),start=performance.now(),cpu=process.cpuUsage();unstable_batchedUpdates(fn);await settle();const wallMs=performance.now()-start,cost=process.cpuUsage(cpu);
 if(track)trace.push({...check(name),work:delta(before),wallMs,cpuUs:cost.user+cost.system});return {name,wallMs,cpuUs:cost.user+cost.system,work:INSTRUMENTED?delta(before):undefined};
}
async function changeSearch(value,track=(mode==='oracle'||mode==='image')){search=value;page=0;return event(`search ${JSON.stringify(value)}`,()=>hostByLabel('input','搜索商品').props.onChange({target:{value}}),track);}
async function changeSource(value,track=(mode==='oracle'||mode==='image')){source=value;page=0;return event(`source ${value}`,()=>hostByLabel('select','筛选来源').props.onChange({target:{value}}),track);}
async function turnPage(direction,track=(mode==='oracle'||mode==='image')){const label=direction===1?'下一页':'上一页',n=btn(label);assert.equal(n.props.disabled,false);page+=direction;return event(label,()=>n.props.onClick(),track);}
async function toggle(index=0,track=(mode==='oracle'||mode==='image')){const r=matchPage()[index];assert.ok(r);selected.has(r.key)?selected.delete(r.key):selected.add(r.key);return event(`toggle ${r.key}`,()=>hostByLabel('input','选择'+r.oracle.title).props.onChange(),track);}
async function togglePage(track=(mode==='oracle'||mode==='image')){const rows=matchPage(),all=rows.every(r=>selected.has(r.key));for(const r of rows)all?selected.delete(r.key):selected.add(r.key);return event('toggle page',()=>hostByLabel('input','选择本页商品').props.onChange(),track);}
async function clearSelection(track=(mode==='oracle'||mode==='image')){const n=tree.root.findAllByType('button').find(n=>n.props.className==='clear-selection');if(!n)return;selected.clear();return event('clear selection',()=>n.props.onClick(),track);}
async function walkAll(name){const expected=allMatches().map(r=>r.key),actual=[];assert.equal(page,0);while(true){const checkResult=check(`${name} page ${page}`);actual.push(...checkResult.keys);if(btn('下一页').props.disabled)break;await turnPage(1);}assert.deepEqual(actual,expected,`${name} full result oracle`);trace.push({name:`complete result ${name}`,resultCount:actual.length,expectedHash:sha(expected),actualHash:sha(actual),selected:[...selected].sort()});while(page>0)await turnPage(-1);}
async function imageFailureCheck(){
 const index=matchPage().findIndex(r=>r.row.mainImage);assert.ok(index>=0);const key=matchPage()[index].key;
 const hasImage=()=>desktopRows()[index].findAllByType('img').length>0;
 const mobileHasImage=()=>mobileRows()[index].findAllByType('img').length>0;
 assert.equal(hasImage(),true);assert.equal(mobileHasImage(),true);await event('desktop and mobile image onError',()=>{desktopRows()[index].findAllByType('img')[0].props.onError();mobileRows()[index].findAllByType('img')[0].props.onError();});assert.equal(hasImage(),false,'real desktop onError enters fallback');assert.equal(mobileHasImage(),false,'real mobile onError enters fallback');
 await toggle(index);const reappearsAfterSelection=hasImage(),mobileFallbackPersistsAfterSelection=!mobileHasImage();await toggle(index);
 if (EXPECT_STABLE_IMAGES) assert.equal(reappearsAfterSelection,false,'same-image selection preserves desktop fallback');
 return {key,errorHandlerInvoked:true,fallbackAfterError:true,imageReappearsAfterSelection:reappearsAfterSelection,mobileFallbackPersistsAfterSelection,browserNetworkSimulated:false};
}
const beforeMount=countSnapshot(),mountStart=performance.now();tree=create(<Component/>);await settle();const mountMs=performance.now()-mountStart;
trace.push({...check('initial loaded'),work:delta(beforeMount),mountMs});assert.equal(listeners.size,1);
const initialHostFrame=tree.toJSON();let warmHostFrame:any,finalHostFrame:any;
let imageFailure:any;
if(mode==='image'){
 imageFailure=await imageFailureCheck();await clearSelection();
}else if(mode==='oracle'){
 await walkAll('all sorted');await toggle(0);const first=[...selected][0];await turnPage(1);await toggle(0);await turnPage(-1);assert.ok(selected.has(first));
 await changeSearch('  LaMp  ');await walkAll('case-insensitive whitespace Lamp');await changeSource('1688');await walkAll('Lamp + 1688');
 await changeSearch('');await walkAll('source 1688');await togglePage();await togglePage();
 await changeSource('all');await changeSearch('淘宝');await walkAll('search matches source');await changeSearch('商品');await walkAll('all Chinese titles');
 await changeSearch('___no_match___');assert.equal(desktopRows().length,0);assert.ok(text(tree.toJSON()).includes('没有找到相符的商品'));
 await changeSearch('');await changeSource('AliExpress');await walkAll('AliExpress source');await changeSource('all');await clearSelection();
 await turnPage(1);await changeSearch('Lamp');assert.equal(page,0);await changeSearch('');await clearSelection();
 // Reach missing/invalid times and ties through whole-list oracle; the fixture includes every case.
}else{
 const actions=async(track=false)=>{
  const samples=[];
  samples.push(await changeSearch('Lamp',track));samples.push(await changeSearch('  lAmP  ',track));samples.push(await changeSource('1688',track));samples.push(await changeSearch('',track));samples.push(await changeSource('all',track));
  samples.push(await turnPage(1,track));samples.push(await toggle(0,track));samples.push(await turnPage(-1,track));samples.push(await togglePage(track));samples.push(await togglePage(track));samples.push(await clearSelection(track));
  return samples;
 };
 const warmupCycles=mode==='smoke'?2:SUPPLEMENT_CONFIG.collected.warmupCycles;
 const warmupCpuStart=process.cpuUsage(),warmupStart=performance.now();
 for(let i=0;i<warmupCycles;i++)await actions();
 const warmupCpu=process.cpuUsage(warmupCpuStart),warmupMs=performance.now()-warmupStart;warmHostFrame=tree.toJSON();
 const inspector=mode==='profile'?new Session():null;
 const call=async(method,params={})=>new Promise<any>((resolve,reject)=>inspector!.post(method,params,(error,result)=>error?reject(error):resolve(result)));
 if(inspector){inspector.connect();await call('Profiler.enable');await call('Profiler.setSamplingInterval',{interval:500});await call('Profiler.start');}
 const rounds=mode==='smoke'?2:SUPPLEMENT_CONFIG.collected.measuredCycles,samples=[],before=countSnapshot(),cpuStart=process.cpuUsage(),wallStart=performance.now();
 for(let i=0;i<rounds;i++)samples.push({round:i,actions:await actions()});
 const wallMs=performance.now()-wallStart,cpu=process.cpuUsage(cpuStart);let profiler:any;
 if(inspector){profiler=(await call('Profiler.stop')).profile;inspector.disconnect();writeFileSync(output+'.cpuprofile',JSON.stringify(profiler));}
 finalHostFrame=tree.toJSON();trace.push({...check('final unchanged after timed cycles'),work:delta(before)});
 var timing={warmupCycles,warmupCpu,warmupMs,rounds,actionsPerRound:11,samples,wallMs,cpuUs:cpu.user+cpu.system,cpu,work:INSTRUMENTED?delta(before):undefined,profilerSamples:profiler?.samples.length};
}
const final=check('before unmount'),beforeUnmount=countSnapshot();tree.unmount();await settle();assert.equal(listeners.size,0);assert.equal(network.attempts,0);
const result={size,mode,supplementConfig:SUPPLEMENT_CONFIG,initialHostFrame,warmHostFrame,finalHostFrame,instrumented:INSTRUMENTED,node:process.version,react:React.version,locale:Intl.DateTimeFormat().resolvedOptions(),fixture:{sha256:sha(data),payloadBytes:Buffer.byteLength(JSON.stringify(data)),sources:sourceNames,timestamped:records.filter(r=>r.oracle.timestamp!==undefined).length,missingOrInvalidTimes:records.filter(r=>r.oracle.timestamp===undefined).length,uniqueValidTimestamps:new Set(records.map(r=>r.oracle.timestamp).filter(x=>x!==undefined)).size,images:records.filter(r=>r.row.mainImage).length},mountMs,bridge:messages,network,trace,imageFailure,timing,stats:INSTRUMENTED?globalThis.__stats:undefined,unmountWork:INSTRUMENTED?delta(beforeUnmount):undefined,final,bundleSha256:createHash('sha256').update(readFileSync(process.argv[1])).digest('hex')};
if(output){writeFileSync(output+'.json',JSON.stringify(result,null,2));if(mode==='oracle')writeFileSync(output+'.frames.json.gz',gzipSync(JSON.stringify(hostFrames)));}
console.log(JSON.stringify({size,mode,instrumented:INSTRUMENTED,mountMs,traceSteps:trace.length,bridge:messages,network,imageFailure,timing:timing&&{rounds:timing.rounds,cpuUs:timing.cpuUs,wallMs:timing.wallMs,work:timing.work,profilerSamples:timing.profilerSamples},stats:INSTRUMENTED?countSnapshot():undefined}));
