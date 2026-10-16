import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useApps} from '@dsh/apps-component-runtime/apps/react';
import {Image} from './Image';
import './style.css';

type Product = {storeId:string;productId?:string;offerId:string;title:string;imageUrl?:string;sku?:string;currency?:string;pricing?:{sellerMinor?:number|null};profit?:{purchaseMinor?:number|null;actualMargin?:number|null;reason?:string|null}};
type Binding = {bindingId:string;revision:string|null;state:string;error?:{message:string};freshness?:string;sourceDataTime:string|null;query?:{input?:{cursor?:string}};payload:{products?:Product[];total?:number;cursor?:string|null;cache?:{refreshing?:boolean;stale?:boolean}}|null};
type Data = {bindings:Binding[]};
const PAGE_SIZE=20;
const money=(minor:number|null|undefined,currency='CNY')=>minor==null?'—':`${(minor/100).toFixed(2)} ${currency}`;

function Component(){
  const apps=useApps({assertionResults:()=>{
    const el=document.querySelector<HTMLElement>('[data-app-component]');
    return [{id:'products.ready',required:true,expected:'Visible current binding data',actual:el?.dataset.ready??'false',status:el?.dataset.ready==='true'?'PASS':'FAIL',evidenceRefs:[]}];
  }});
  // Read the host snapshot directly: the SDK preserves allowed stale data and clears it on scope/access changes.
  const binding=(apps.data as Data|undefined)?.bindings[0],products=binding?.payload?.products??[];
  const [search,setSearch]=useState(''),[notice,setNotice]=useState(''),[localPage,setLocalPage]=useState(0);
  const [cursors,setCursors]=useState<(string|null)[]>([null]),[page,setPage]=useState(0),[requestBusy,setRequestBusy]=useState(false);
  const initialized=useRef<string>(),pending=useRef(false),list=useRef<HTMLDivElement>(null);
  const busy=apps.loading||apps.refreshing||requestBusy;
  useEffect(()=>{
    if(!binding||apps.loading||apps.refreshing||pending.current||binding.state!=='empty'||initialized.current===binding.bindingId)return;
    initialized.current=binding.bindingId;pending.current=true;setRequestBusy(true);
    void apps.refresh([binding.bindingId],{forceRefresh:false}).catch(error=>setNotice(error.message)).finally(()=>{pending.current=false;setRequestBusy(false);});
  },[binding?.bindingId,binding?.state,apps.loading,apps.refreshing,apps.refresh]);
  const filtered=products.filter(row=>`${row.title} ${row.sku??''} ${row.offerId}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  const localPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),displayPage=Math.min(localPage,localPages-1);
  const visible=filtered.slice(displayPage*PAGE_SIZE,(displayPage+1)*PAGE_SIZE);
  useEffect(()=>{if(localPage!==displayPage)setLocalPage(displayPage);},[localPage,displayPage]);
  const showPage=(next:number)=>{setLocalPage(next);list.current?.scrollIntoView({block:'start',behavior:'instant'});};
  const remote=page>0||!!binding?.payload?.cursor;
  const complete=page===0&&!binding?.query?.input?.cursor&&!binding?.payload?.cursor&&binding?.payload?.total===products.length;
  async function move(target:number){
    if(!binding||pending.current||apps.loading||apps.refreshing)return;
    const cursor=target>page?binding.payload?.cursor:cursors[target];
    if(target<0||target>page&&!cursor)return;
    pending.current=true;setRequestBusy(true);setNotice('');
    try{const result=await apps.readBindingPage(binding.bindingId,cursor),next=(result as Data).bindings.find(item=>item.bindingId===binding.bindingId);if(next?.state!=='ready'||next.error)throw new Error(next?.error?.message??'暂未读取下一页，保留当前数据');setCursors(previous=>{const next=previous.slice(0,target+1);next[target]=cursor??null;return next;});setPage(target);showPage(0);}
    catch(error){setNotice((error as Error).message);}finally{pending.current=false;setRequestBusy(false);}
  }
  async function refresh(){
    if(!binding||pending.current||apps.loading||apps.refreshing)return;
    pending.current=true;setRequestBusy(true);setNotice('');
    try{
      const result=await apps.refresh([binding.bindingId]),next=(result as Data).bindings.find(item=>item.bindingId===binding.bindingId);
      if(next?.state==='ready'&&!next.error){if(page>0)setLocalPage(0);setPage(0);setCursors([null]);}
      setNotice(next?.payload?.cache?.refreshing?'正在更新，当前内容保留':next?.state!=='ready'||next.error||next.freshness==='stale'||next.payload?.cache?.stale?'暂未更新，保留上次数据':'已刷新');
    }catch(error){setNotice((error as Error).message);}finally{pending.current=false;setRequestBusy(false);}
  }
  const localPager=<nav aria-label="当前读取范围分页"><button data-testid={remote?'local-previous':'previous'} disabled={displayPage===0} onClick={()=>showPage(displayPage-1)}>上一页</button><span data-testid={remote?'local-page':'page'}>第 {displayPage+1} 页</span><button data-testid={remote?'local-next':'next'} disabled={displayPage+1>=localPages} onClick={()=>showPage(displayPage+1)}>下一页</button></nav>;
  return <main data-app-component data-ready={!busy&&!apps.error&&binding?.state==='ready'?'true':'false'}>
    <header><div><small>{complete?'当前范围商品':'已读取商品'}</small><h1>商品价格与参考利润率</h1><p>源数据时间：{binding?.sourceDataTime??'未知'} · 读取当前快照</p></div><button data-testid="refresh" disabled={busy||!binding} onClick={()=>void refresh()}>刷新</button></header>
    <section className="toolbar"><input aria-label="搜索当前读取范围" placeholder="搜索已读取的名称、SKU" value={search} onChange={event=>{setSearch(event.target.value);setLocalPage(0);}}/></section>
    <p role="status">{busy?products.length?'正在更新，当前内容保留':'正在准备首次数据':notice}</p>{apps.error||binding?.error?<p role={products.length?'status':'alert'}>{products.length?'显示已缓存数据，稍后自动更新。':apps.error?.message??binding?.error?.message}</p>:null}
    <div className="products" ref={list}>{visible.map((row,index)=><article data-product-row key={`${row.storeId}:${row.productId??row.offerId}`}>
      <div className="product-heading"><Image src={row.imageUrl} alt={row.title??'商品图片'} width={48} height={48} priority={index<6}/><strong>{row.title}</strong></div>
      <p>SKU：{row.sku??'—'}</p><dl><div><dt>采购成本</dt><dd>{money(row.profit?.purchaseMinor,row.currency)}</dd></div><div><dt>实际售价</dt><dd>{money(row.pricing?.sellerMinor,row.currency)}</dd></div><div><dt>参考利润率</dt><dd>{row.profit?.actualMargin==null?'—':`${(row.profit.actualMargin*100).toFixed(2)}%`}</dd></div></dl>{row.profit?.reason?<small>{row.profit.reason}</small>:null}
    </article>)}</div>
    {!busy&&!filtered.length?<p>当前读取范围暂无匹配商品。</p>:null}
    {binding?.payload?<footer id="pager"><span>{complete?`共 ${products.length} 件 · 搜索覆盖当前完整结果`:`已读取 ${products.length} 件${binding?.payload?.total===undefined?'':` / 当前范围共 ${binding.payload.total} 件`} · 搜索仅覆盖已读取范围`} · 每页 {PAGE_SIZE} 件</span>
      {!remote||localPages>1?localPager:null}
      {remote?<nav aria-label="数据分页"><span>源数据分页</span><button data-testid="previous" disabled={busy||page===0} onClick={()=>void move(page-1)}>上一批</button><span data-testid="page">第 {page+1} 页</span><button data-testid="next" disabled={busy||!binding?.payload?.cursor} onClick={()=>void move(page+1)}>下一批</button></nav>:null}
    </footer>:null}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Component/>);
