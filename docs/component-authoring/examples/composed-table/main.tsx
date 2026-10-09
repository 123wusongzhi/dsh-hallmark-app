import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useApps} from '@dsh/apps-component-runtime/apps/react';
import {composedData,formatValue,valueAt} from './data';
import './style.css';

function Component(){
  const apps=useApps({assertionResults:()=>{
    const main=document.querySelector<HTMLElement>('[data-composed-table]'),pass=main?.dataset.ready==='true';
    return [{id:'composed.bound-data',required:true,expected:'Bound data rendered without read error',actual:String(pass),status:pass?'PASS':'FAIL',evidenceRefs:[]}];
  }});
  const data=composedData(apps.data),[cursors,setCursors]=useState<(string|null)[]>([null]),[notice,setNotice]=useState('');
  const initialized=useRef(false);
  useEffect(()=>{if(apps.data!==undefined&&!apps.loading&&data.state==='empty'&&!initialized.current){initialized.current=true;void apps.refresh([data.bindingId],{forceRefresh:false}).catch(()=>{});}},[apps.data,apps.loading,data.state,apps.refresh]);
  useEffect(()=>{if(data.atFirstPage)setCursors([null]);},[data.atFirstPage,data.fetchedAt]);
  const page=async(cursor:string|null,next:(string|null)[])=>{try{await apps.readBindingPage(data.bindingId,cursor);setCursors(next);setNotice('');}catch{/* useApps exposes the original failure. */}};
  const refresh=async()=>{try{const next=composedData(await apps.refresh([data.bindingId]));if(!next.error)setCursors([null]);setNotice(next.error||next.stale?'暂未更新，保留上次数据':'已刷新');}catch{/* preserve the host error */}};
  const error=apps.error?.message??data.error,ready=!apps.loading&&!error&&data.state==='ready';
  return <main data-composed-table data-ready={String(ready)}>
    <header><div><span className="eyebrow">我的经营数据</span><h1>商品经营表</h1>{data.fetchedAt?<small>{data.stale?'显示上次数据':'已更新'} · {new Date(data.fetchedAt).toLocaleTimeString('zh-CN')} · 到期自动更新</small>:null}</div><button data-testid="refresh" disabled={apps.loading} onClick={()=>void refresh()}>立即更新</button></header>
    {error?<p role={data.rows.length?'status':'alert'}>{data.rows.length?'显示已缓存数据，稍后自动更新。':error}</p>:null}
    <div className="table-scroll"><table><thead><tr>{data.fields.map(field=><th key={field.key} title={field.description}>{field.label}<small>{{products:'商品',prices:'价格',stocks:'库存',analytics:'流量',orders:'订单',weights:'实重',finance:'费用',promotions:'活动',returns:'售后',warehouses:'仓库'}[field.source]??field.source}</small></th>)}</tr></thead><tbody>
      {data.rows.map((row,index)=><tr key={index} data-composed-row>{data.fields.map(field=><td key={field.key}>{field.format==='image'&&typeof valueAt(row,field.key)==='string'?<img src={String(valueAt(row,field.key))} alt="商品图片"/>:formatValue(row,field)}</td>)}</tr>)}
    </tbody></table></div>
    {!apps.loading&&!error&&!data.rows.length?<p>当前条件下暂无数据。</p>:null}
    {data.warnings.length?<details><summary>数据说明 · {data.warnings.length}</summary><ul>{data.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>:null}
    <footer id="pager"><span data-testid="page">第 {cursors.length} 页</span><span>{data.total===null?'':`共 ${data.total} 行`}</span><button data-testid="previous" disabled={apps.loading||cursors.length<2} onClick={()=>void page(cursors[cursors.length-2],cursors.slice(0,-1))}>上一页</button><button data-testid="next" disabled={apps.loading||!data.cursor} onClick={()=>void page(data.cursor,[...cursors,data.cursor])}>下一页</button></footer>
    <p role="status">{apps.loading?'正在读取…':notice}</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Component/>);
