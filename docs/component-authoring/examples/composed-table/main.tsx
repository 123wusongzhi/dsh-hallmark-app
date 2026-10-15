import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useApps} from '@dsh/apps-component-runtime/apps/react';
import {composedData,formatValue,valueAt} from './data';
import {Image} from './Image';
import './style.css';

const PAGE_SIZE=20;
const sourceLabels:Record<string,string>={products:'商品',prices:'价格',stocks:'库存',analytics:'流量',orders:'订单',weights:'实重',finance:'费用',promotions:'活动',returns:'售后',warehouses:'仓库'};
function Component(){
  const apps=useApps({assertionResults:()=>{
    const main=document.querySelector<HTMLElement>('[data-composed-table]'),pass=main?.dataset.ready==='true';
    return [{id:'composed.bound-data',required:true,expected:'Bound data rendered without read error',actual:String(pass),status:pass?'PASS':'FAIL',evidenceRefs:[]}];
  }});
  const data=composedData(apps.data),[cursors,setCursors]=useState<(string|null)[]>([null]),[notice,setNotice]=useState('');
  const [search,setSearch]=useState(''),[localPage,setLocalPage]=useState(0),[requestBusy,setRequestBusy]=useState(false);
  const initialized=useRef(false),pending=useRef(false),list=useRef<HTMLDivElement>(null),busy=apps.loading||apps.refreshing||requestBusy;
  useEffect(()=>{
    if(apps.data===undefined||apps.loading||apps.refreshing||pending.current||data.state!=='empty'||initialized.current)return;
    initialized.current=true;pending.current=true;setRequestBusy(true);
    void apps.refresh([data.bindingId],{forceRefresh:false}).catch(()=>{}).finally(()=>{pending.current=false;setRequestBusy(false);});
  },[apps.data,apps.loading,apps.refreshing,data.state,data.bindingId,apps.refresh]);
  useEffect(()=>{if(data.atFirstPage)setCursors([null]);},[data.atFirstPage,data.fetchedAt]);
  const imageFields=data.fields.filter(field=>field.format==='image');
  const filtered=data.rows.filter(row=>!search.trim()||data.fields.some(field=>field.format!=='image'&&formatValue(row,field).toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())));
  const localPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),displayPage=Math.min(localPage,localPages-1),visible=filtered.slice(displayPage*PAGE_SIZE,(displayPage+1)*PAGE_SIZE);
  useEffect(()=>{if(localPage!==displayPage)setLocalPage(displayPage);},[localPage,displayPage]);
  const showPage=(next:number)=>{setLocalPage(next);list.current?.scrollIntoView({block:'start',behavior:'instant'});};
  const remote=cursors.length>1||!!data.cursor,complete=data.atFirstPage&&!data.cursor&&data.total===data.rows.length;
  const page=async(cursor:string|null,next:(string|null)[])=>{
    if(pending.current||apps.loading||apps.refreshing)return;
    pending.current=true;setRequestBusy(true);setNotice('');
    try{const result=composedData(await apps.readBindingPage(data.bindingId,cursor));if(result.state!=='ready'||result.error)throw new Error(result.error??'暂未读取下一页，保留当前数据');setCursors(next);showPage(0);}catch(error){setNotice((error as Error).message);}finally{pending.current=false;setRequestBusy(false);}
  };
  const refresh=async()=>{
    if(pending.current||apps.loading||apps.refreshing)return;
    pending.current=true;setRequestBusy(true);setNotice('');
    try{const next=composedData(await apps.refresh([data.bindingId]));if(next.state==='ready'&&!next.error){if(cursors.length>1)setLocalPage(0);setCursors([null]);}setNotice(next.refreshing?'正在更新，当前内容保留':next.state!=='ready'||next.error||next.stale?'暂未更新，保留上次数据':'已刷新');}catch(error){setNotice((error as Error).message);}finally{pending.current=false;setRequestBusy(false);}
  };
  const error=apps.error?.message??data.error,ready=!busy&&!error&&data.state==='ready';
  const localPager=<nav aria-label="当前读取范围分页"><button data-testid={remote?'local-previous':'previous'} disabled={displayPage===0} onClick={()=>showPage(displayPage-1)}>上一页</button><span data-testid={remote?'local-page':'page'}>第 {displayPage+1} 页</span><button data-testid={remote?'local-next':'next'} disabled={displayPage+1>=localPages} onClick={()=>showPage(displayPage+1)}>下一页</button></nav>;
  return <main data-app-component data-composed-table data-ready={String(ready)}>
    <header><div><span className="eyebrow">我的经营数据</span><h1>商品经营表</h1>{data.fetchedAt?<small>{data.stale?'显示上次数据':'已更新'} · {new Date(data.fetchedAt).toLocaleTimeString('zh-CN')} · 到期自动更新</small>:null}</div><button data-testid="refresh" disabled={busy} onClick={()=>void refresh()}>立即更新</button></header>
    <label className="search">搜索当前读取范围<input aria-label="搜索当前读取范围" placeholder="搜索已读取的商品信息" value={search} onChange={event=>{setSearch(event.target.value);setLocalPage(0);}}/></label>
    {error?<p role={data.rows.length?'status':'alert'}>{data.rows.length?'显示已缓存数据，稍后自动更新。':error}</p>:null}
    <p role="status">{busy?data.rows.length?'正在更新，当前内容保留':'正在准备首次数据':notice}</p>
    <div className="table-scroll" ref={list}><table><thead><tr>{data.fields.map(field=><th key={field.key} title={field.description}>{field.label}<small>{sourceLabels[field.source]??field.source}</small></th>)}</tr></thead><tbody>
      {visible.map((row,index)=><tr key={index} data-composed-row data-product-row>{data.fields.map(field=><td key={field.key}>{field.format==='image'?<Image src={typeof valueAt(row,field.key)==='string'?String(valueAt(row,field.key)):undefined} alt="商品图片" width={44} height={44} priority={index*imageFields.length+imageFields.indexOf(field)<6}/>:formatValue(row,field)}</td>)}</tr>)}
    </tbody></table></div>
    {!busy&&!error&&!filtered.length?<p>当前读取范围暂无匹配数据。</p>:null}
    {data.warnings.length?<details><summary>数据说明 · {data.warnings.length}</summary><ul>{data.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>:null}
    {data.fields.length?<footer id="pager"><span>{complete?`共 ${data.rows.length} 行 · 搜索覆盖当前完整结果`:`已读取 ${data.rows.length} 行${data.total===null?'':` / 当前范围共 ${data.total} 行`} · 搜索仅覆盖已读取范围`} · 每页 {PAGE_SIZE} 行</span>
      {!remote||localPages>1?localPager:null}
      {remote?<nav aria-label="数据分页"><span>源数据分页</span><span data-testid="page">第 {cursors.length} 页</span><button data-testid="previous" disabled={busy||cursors.length<2} onClick={()=>void page(cursors[cursors.length-2],cursors.slice(0,-1))}>上一批</button><button data-testid="next" disabled={busy||!data.cursor} onClick={()=>void page(data.cursor,[...cursors,data.cursor])}>下一批</button></nav>:null}
    </footer>:null}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Component/>);
