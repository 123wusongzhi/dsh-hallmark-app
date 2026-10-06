// Isolated DOM verification of the real component renderer and the public native input bridge.
// All rows, native scopes and composer actions below are fixtures; no business endpoint is contacted.
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ViewRenderer } from '../../packages/dsh-plugin/client/renderer.tsx';
import { ProductSelectionProvider } from '../../packages/dsh-plugin/client/selection-context.tsx';
import { selectionInputBridge } from '../../packages/dsh-plugin/client/selection.ts';
import type { NativeAttachmentRuntime, NativeDraftAttachment, NativeInputActions } from '../../packages/dsh-plugin/client/selection-native.ts';
import { createClientPlugin } from '../../packages/dsh-plugin/client/plugin.ts';
import { STYLES } from '../../packages/dsh-plugin/client/styles.ts';
import type { BindingData, ViewSpec } from '../../packages/presentation/src/types.ts';

const originalDraft='请帮我分析这些产品适不适合上架，先列出理由。';
const names=['便携收纳袋','不锈钢保温杯','桌面整理架','旅行洗漱包','防滑鼠标垫','折叠手机支架','厨房收纳盒','硅胶隔热垫'];
const rows=Array.from({length:24},(_,i)=>({id:`collected-${String(i+1).padStart(3,'0')}`,title:`${names[i%names.length]} ${i+1}`,price:19+(i*17)%130,skuCount:2+i%4,collectedAt:`2026-10-06T${String(8+Math.floor(i/6)).padStart(2,'0')}:${String(i%6*10).padStart(2,'0')}:00Z`}));
const datasetKey='collected:fixture-selection';
const spec:ViewSpec={id:'fixture-collected-products',title:'采集产品 · 交互验收',layout:{type:'column',children:['products']},widgets:[{id:'products',type:'table',title:'采集产品',bindingId:'items',columns:[{field:'title',label:'产品名称'},{field:'price',label:'售价',format:'currency'},{field:'skuCount',label:'SKU 数'},{field:'collectedAt',label:'采集时间',format:'date'}],options:{pageSize:10,currency:'CNY'}}],bindings:[{id:'items',datasetKey,query:{tool:'hallmark_search_collected_items',params:{query:'',limit:100}},fieldMap:{}}]};
const initialData:BindingData={bindingId:'items',datasetKey,payload:{items:rows,total:rows.length},state:'ready',dataTime:'2026-10-06T12:00:00Z',lastSuccessAt:'2026-10-06T12:01:00Z',provenance:{source:'app_snapshot',endpoint:'/api/items'}};
const chartSpec:ViewSpec={id:'fixture-profit-charts',title:'利润图表 · 合成验收',layout:{type:'tabs',children:['profit-line','profit-bar']},widgets:[{id:'profit-line',type:'line_chart',title:'参考利润折线',bindingId:'profit',options:{xField:'title',yField:'referenceProfit.margin'}},{id:'profit-bar',type:'bar_chart',title:'参考利润柱图',bindingId:'profit',options:{xField:'title',yField:'referenceProfit.margin'}}],bindings:[{id:'profit',datasetKey:'profit:fixture',fieldMap:{}}]};
const chartData:BindingData[]=[{bindingId:'profit',datasetKey:'profit:fixture',payload:{rows:[{title:'合成盈利',referenceProfit:{margin:0.24}},{title:'合成亏损',referenceProfit:{margin:-0.12}},{title:'缺成本产品',referenceProfit:{margin:0,costMissing:true}},{title:'缺数值产品',referenceProfit:{margin:null}}]},state:'ready',provenance:{source:'synthetic_browser_fixture'},metricBasis:'合成参考利润口径，非真实店铺数据',dataTime:'2026-10-06T12:00:00Z'}];
const assertions:string[]=[];const errors:string[]=[];const navigated:string[]=[];let submissions=0;let networkCalls=0;let insertionCount=0;
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const originalConsoleError=console.error.bind(console);console.error=(...args:unknown[])=>{errors.push(args.map(String).join(' '));originalConsoleError(...args);};
globalThis.fetch=(async()=>{networkCalls++;throw new Error('Selection fixture must never access a network endpoint');}) as typeof fetch;
let navigate:((id:string)=>void)|undefined;
const registered=new Map<string,React.ComponentType<any>>();
const Empty=()=>null;
const nativeDrafts=new Map<string,NativeDraftAttachment>();let nextAttachment=0;let latestFile:File|undefined;
const conversation:NativeAttachmentRuntime={createDrafts:(_sessionId,files)=>files.map(file=>{latestFile=file;const attachment={kind:'file' as const,id:`fixture-attachment-${++nextAttachment}`,file};nativeDrafts.set(attachment.id,attachment);return attachment;}),releaseDraftAttachments:drafts=>{for(const draft of drafts)nativeDrafts.delete(draft.id);},blocks:{storeFor:()=>({getSnapshot:()=>undefined,subscribe:()=>()=>{}})}};
const faces={conversation,layout:{selectPanel:()=>{}},uiWorkspace:{openSession:(id:string)=>{navigated.push(id);navigate?.(id);}},sidebarRight:{mounted:{getSnapshot:()=> 'fixture-session-a'},openTab:()=>{}},sidebarRightTabs:{register:()=>()=>{}}};
createClientPlugin({sidebarIcon:Empty,main:()=>Empty,toolview:Empty,sidebar:{body:()=>Empty,title:Empty,input:()=>Empty}}).apply({get:name=>faces[name],slots:{register:(options,component)=>{registered.set(`${options.name}:${options.id??options.key??''}`,component);return()=>{};},inject:(_name,effect)=>effect()}});
const RootObserver=registered.get('sidebar.panellist:hallmark-apps')!;
const NativeInput=registered.get('conversation.input.left:hallmark-session-components')!;

function Fixture(){
  const [target,setTarget]=useState('fixture-session-a');const [panel,setPanel]=useState<'chat'|'apps'>('chat');const [data,setData]=useState(initialData);const [draft,setDraft]=useState(originalDraft);
  const [chartHidden,setChartHidden]=useState(false);const [chartNarrow,setChartNarrow]=useState(false);const [invalidDraft,setInvalidDraft]=useState(false);
  const [draftIds,setDraftIds]=useState<Record<string,string[]>>({});
  const inputActions=useMemo<NativeInputActions&{submit:()=>void;setDraft:()=>never}>(()=>({
    addAttachments:ids=>{insertionCount++;setDraftIds(current=>({...current,[target]:[...current[target]??[],...ids]}));return true;},
    submit:()=>{submissions++;},setDraft:()=>{throw new Error('Unexpected full-draft replacement');},
  }),[target]);
  navigate=id=>{setTarget(id);setPanel('chat');};
  const bindings=useMemo(()=>[data],[data]);
  const refresh=()=>setData(previous=>({...previous,lastSuccessAt:'2026-10-06T12:02:00Z',payload:structuredClone(previous.payload)}));
  (window as any).__SELECTION_DEMO__=()=>{setTarget('fixture-session-a');setPanel('chat');setData({...initialData,payload:structuredClone(initialData.payload)});setDraft(originalDraft);setDraftIds({});nativeDrafts.clear();};
  return <main className="selection-fixture hm-root"><style>{STYLES}</style>
    <RootObserver usePanelInfo={(selector:any)=>selector({activePanelId:panel==='apps'?'hallmark-apps':null})} useSessions={(selector:any)=>selector({phase:'ready',byId:{'fixture-session-a':{id:'fixture-session-a',retainedBy:{mainView:panel==='chat'&&target==='fixture-session-a'?1:0}},'fixture-session-b':{id:'fixture-session-b',retainedBy:{mainView:panel==='chat'&&target==='fixture-session-b'?1:0}}}})}/>
    <header className="fixture-heading"><div><div className="fixture-eyebrow">DSH · 隔离交互验收</div><h1>选中产品，交给当前聊天</h1><p>合成数据与原生输入契约模拟；不连接店铺，不发送消息。</p></div><span className="fixture-mode">{panel==='chat'?'原聊天已挂载':'工作区：聊天未挂载'}</span></header>
    <div className="fixture-controls"><button type="button" onClick={refresh}>模拟快照刷新</button><button type="button" onClick={()=>setTarget(target==='fixture-session-a'?'fixture-session-b':'fixture-session-a')}>切换目标聊天</button><button type="button" onClick={()=>setPanel('apps')}>进入模拟工作区</button><span>当前目标：{target}</span></div>
    <div className="fixture-columns"><section className="fixture-table-panel"><ProductSelectionProvider sessionId="fixture-session-a" spec={spec} data={bindings}><ViewRenderer spec={spec} data={bindings}/></ProductSelectionProvider></section>
    <aside className="fixture-composer"><div className="fixture-eyebrow">原生附件契约的测试替身（非宿主截图）</div><h2>原聊天输入框</h2><p>产品 ID 保存为 JSON 文件附件；已写的问题保持原样，由用户手动发送。</p>
      {panel==='chat'?<><NativeInput sessionId={target} inputActions={inputActions} useInput={(selector:any)=>selector({phase:'plain',attachmentIds:draftIds[target]??[]})} useSession={(selector:any)=>selector({subagent:null,removed:false})}/><ul data-testid="native-attachments">{(draftIds[target]??[]).map(id=><li key={id}>{nativeDrafts.get(id)?.file.name}<button type="button" aria-label="移除产品附件" onClick={()=>{const attachment=nativeDrafts.get(id);if(attachment)conversation.releaseDraftAttachments([attachment]);setDraftIds(current=>({...current,[target]:current[target].filter(value=>value!==id)}));}}>移除</button></li>)}</ul><label htmlFor="native-draft">待发送草稿<textarea id="native-draft" data-testid="native-draft" value={draft} onChange={event=>setDraft(event.target.value)}/></label><span className="fixture-not-sent">尚未发送 · 不会自动提交</span></>:<p role="status">工作区中未挂载聊天输入框。点击附加后应精确返回会话 A。</p>}
    </aside></div>
    <section className="fixture-charts" data-testid="chart-verification"><div className="fixture-eyebrow">RECHARTS · 实际 SVG 渲染验收</div><h2>参考利润图表</h2><p>只绘制 2 个有数值且成本已知的合成点；缺成本与缺数值不会成为零。</p><div className="fixture-controls"><button type="button" onClick={()=>setChartHidden(value=>!value)}>切换图表可见性</button><button type="button" onClick={()=>setChartNarrow(value=>!value)}>切换图表容器宽度</button><button type="button" onClick={()=>setInvalidDraft(value=>!value)}>切换不完整草稿</button></div><div data-testid="chart-container" hidden={chartHidden} style={{width:chartNarrow?340:760,maxWidth:'100%'}}><ViewRenderer spec={invalidDraft?{...chartSpec,layout:{type:'grid',columns:0,children:['profit-line']}}:chartSpec} data={chartData}/></div></section>
    <div id="fixture-result" role="status"/></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(predicate:()=>unknown,label:string)=>{for(let i=0;i<150;i++){if(predicate())return;await delay(30);}throw new Error(`Timeout: ${label}`);};
const button=(text:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(value=>value.textContent?.trim()===text);
const checkboxRows=()=>Array.from(document.querySelectorAll<HTMLInputElement>('.fixture-table-panel tbody input[type="checkbox"]'));
const draft=()=>document.querySelector<HTMLTextAreaElement>('#native-draft')?.value??'';
const selected=(count:number)=>Array.from(document.querySelectorAll('[aria-live]')).some(element=>element.textContent?.includes(`已选 ${count} 个产品`));
const check=(condition:unknown,label:string)=>{if(!condition)throw new Error(label);assertions.push(label);};
const parseContext=async()=>JSON.parse(await latestFile!.text());
(async()=>{
  try{
    await wait(()=>checkboxRows().length===10&&!checkboxRows()[0].disabled,'real table selectable first page');
    check(draft()===originalDraft,'original composer draft is present before product selection');
    checkboxRows()[0].click();await wait(()=>selected(1),'one product selected');checkboxRows()[1].click();await wait(()=>selected(2),'two products selected');
    check(insertionCount===0&&submissions===0,'checking products alone neither creates an attachment nor submits a message');
    document.querySelector<HTMLButtonElement>('[aria-label="售价，点击排序"]')!.click();await delay(80);button('下一页')!.click();await delay(80);
    check(selected(2),'selection survives sorting and changing table pages');
    button('附加到当前聊天')!.click();await wait(()=>insertionCount===1,'selected rows attached as a File');
    const context=await parseContext();check(JSON.stringify(context.products.map((p:any)=>p.itemId).sort())===JSON.stringify(['collected-001','collected-002']),'attached file IDs remain the exact selected products after sorting and pagination');
    check(context.sessionId==='fixture-session-a'&&context.viewId===spec.id&&context.datasetKey===datasetKey,'context carries exact session, view and dataset identity');
    check(draft()===originalDraft&&submissions===0&&latestFile?.type==='application/json','native attachment keeps original draft byte-for-byte unchanged and never calls submit');
    button('附加到当前聊天')!.click();await delay(30);check(insertionCount===1,'repeated click reuses the same native attachment');
    const beforeSwitch=draft();button('切换目标聊天')!.click();await wait(()=>button('附加到当前聊天')?.disabled,'foreign target refuses selection');
    check(!selectionInputBridge.attach('fixture-session-a',context).ok&&draft()===beforeSwitch,'session A context cannot enter the input of session B');
    button('切换目标聊天')!.click();await wait(()=>!button('附加到当前聊天')?.disabled,'target restored');button('模拟快照刷新')!.click();await wait(()=>selected(0),'selection cleared after refreshed snapshot');
    check(checkboxRows().every(input=>!input.checked)&&button('附加到当前聊天')?.disabled,'refresh invalidates prior selected objects and disables empty send');
    if(!button('上一页')?.disabled){button('上一页')!.click();await delay(60);}checkboxRows()[0].click();await wait(()=>selected(1),'new snapshot can be selected');
    button('进入模拟工作区')!.click();await wait(()=>!document.querySelector('#native-draft'),'composer unmounted in workbench');
    button('附加到当前聊天')!.click();await wait(()=>insertionCount===2&&document.querySelector('#native-draft'),'workspace transfer binds original composer');
    check(JSON.stringify(navigated)===JSON.stringify(['fixture-session-a']),'workspace attachment navigates only to its explicit original session');
    const chartRoot=()=>document.querySelector<HTMLElement>('[data-testid="chart-container"]')!;
    const visibleChartPanel=()=>chartRoot().querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
    const visibleSvg=()=>visibleChartPanel()?.querySelector<SVGSVGElement>('svg.recharts-surface');
    const linePath=()=>visibleChartPanel()?.querySelector<SVGPathElement>('.recharts-line-curve');
    const barPaths=()=>Array.from(visibleChartPanel()?.querySelectorAll<SVGPathElement>('.recharts-bar-rectangle path')??[]);
    const chartTab=(title:string)=>Array.from(chartRoot().querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(tab=>tab.textContent===title)!;
    await wait(()=>linePath()?.getAttribute('d')&&visibleSvg()!.getBoundingClientRect().width>500,'line chart actually rendered');
    const initialChartWidth=visibleSvg()!.getBoundingClientRect().width;
    check(linePath()!.getTotalLength()>0&&visibleChartPanel()!.querySelectorAll('.recharts-line-dots circle').length===2,'real Recharts line SVG has a nonempty curve and exactly two valid points');
    const chartRows=Array.from(visibleChartPanel()!.querySelectorAll('details tbody tr')).map(row=>row.textContent);
    check(chartRows.length===2&&chartRows.some(row=>row?.includes('0.24'))&&chartRows.some(row=>row?.includes('-0.12'))&&!chartRows.some(row=>row?.includes('缺成本')||row?.includes('缺数值')),'missing-cost and missing-value profits are excluded rather than plotted as zero');
    chartTab('参考利润柱图').click();await wait(()=>barPaths().length===2&&barPaths().every(path=>path.getBoundingClientRect().height>0),'previously hidden bar chart visible');
    check(visibleSvg()!.getBoundingClientRect().width>500&&barPaths().every(path=>Boolean(path.getAttribute('d'))),'hidden bar tab becomes a visible positive/negative chart with two real SVG bars');
    button('切换图表容器宽度')!.click();await wait(()=>{const width=visibleSvg()?.getBoundingClientRect().width??0;return width>0&&width<=340;},'ResizeObserver resized bar chart');
    const narrowWidth=visibleSvg()!.getBoundingClientRect().width;
    check(narrowWidth<initialChartWidth&&barPaths().every(path=>path.getBoundingClientRect().width>0),'bar chart redraws within a 340px container after narrowing');
    chartTab('参考利润折线').click();await wait(()=>linePath()?.getAttribute('d')&&visibleSvg()!.getBoundingClientRect().width<=340,'line restores at narrow size');
    button('切换图表可见性')!.click();await wait(()=>chartRoot().getBoundingClientRect().width===0,'chart outer container hidden');
    button('切换图表可见性')!.click();await wait(()=>linePath()?.getTotalLength()&&visibleSvg()!.getBoundingClientRect().width>0,'chart shown after display none');
    check(visibleSvg()!.getBoundingClientRect().width<=340&&linePath()!.getTotalLength()>0,'line survives hide/show and returns at the narrow container width');
    button('切换图表容器宽度')!.click();await wait(()=>visibleSvg()!.getBoundingClientRect().width>500,'chart restored to wide container');
    check(Math.abs(visibleSvg()!.getBoundingClientRect().width-initialChartWidth)<2,'chart expands back to its original width');
    button('切换不完整草稿')!.click();await wait(()=>chartRoot().querySelector('[role="alert"]'),'invalid layout draft is explained inline');
    check(!chartRoot().querySelector('svg.recharts-surface')&&chartRoot().textContent?.includes('暂时无法显示'),'incomplete grid draft displays a recoverable inline configuration error');
    button('切换不完整草稿')!.click();await wait(()=>linePath()?.getTotalLength(),'valid draft recovers without remounting the editor');
    check(errors.length===0&&linePath()!.getTotalLength()>0,'correcting the draft restores the real chart without an uncaught React error');
    check(submissions===0&&networkCalls===0,'whole flow makes no model submission and no business network request');
    check(errors.length===0,'no browser runtime errors in selection flow');
    (window as any).__SELECTION_SMOKE_RESULT__={ok:true,fixtureOnly:true,assertions,errors,navigated,insertionCount,submissions,networkCalls};
    document.getElementById('fixture-result')!.textContent=`隔离验证通过：${assertions.length} 项 · 未发送消息 · 未调用业务源`;
    // A readable final screenshot: return to a fresh table and leave two selected products in the draft.
    (window as any).__SELECTION_DEMO__();await wait(()=>selected(0),'screenshot reset');await delay(80);
    checkboxRows()[0].click();await wait(()=>selected(1),'screenshot first selection');checkboxRows()[1].click();await wait(()=>selected(2),'screenshot second selection');button('附加到当前聊天')!.click();await delay(100);
    (window as any).__SELECTION_SCREENSHOT_READY__=true;
  }catch(error){(window as any).__SELECTION_SMOKE_RESULT__={ok:false,fixtureOnly:true,assertions,errors,error:String(error),navigated,insertionCount,submissions,networkCalls};(window as any).__SELECTION_SCREENSHOT_READY__=true;}
})();
