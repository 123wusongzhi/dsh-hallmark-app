import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useApps} from '@dsh/apps-component-runtime/apps/react';
import './style.css';

type Product = {storeId:string;productId?:string;offerId:string;title:string;sku?:string;currency?:string;pricing?:{sellerMinor?:number|null};profit?:{purchaseMinor?:number|null;actualMargin?:number|null;reason?:string|null}};
type Binding = {bindingId:string;revision:string|null;state:string;error?:{message:string};sourceDataTime:string|null;payload:{products?:Product[];total?:number;cursor?:string|null}|null};
type Data = {bindings:Binding[]};
const money=(minor:number|null|undefined,currency='CNY')=>minor==null?'—':`${(minor/100).toFixed(2)} ${currency}`;

function Component(){
  const apps=useApps({assertionResults:()=>{
    const el=document.querySelector<HTMLElement>('[data-app-component]');
    return [{id:'products.ready',required:true,expected:'Visible current binding data',actual:el?.dataset.ready??'false',status:el?.dataset.ready==='true'?'PASS':'FAIL',evidenceRefs:[]}];
  }});
  // This example expects one Hallmark products.list binding supplied to begin.
  const binding=(apps.data as Data|undefined)?.bindings[0];
  const products=binding?.payload?.products??[];
  const [search,setSearch]=useState(''),[notice,setNotice]=useState('');
  const [cursors,setCursors]=useState<(string|null)[]>([null]),[page,setPage]=useState(0);
  const initialized=useRef<string>();
  useEffect(()=>{
    if(!binding||apps.loading||binding.state!=='empty'||initialized.current===binding.bindingId)return;
    initialized.current=binding.bindingId;
    void apps.refresh([binding.bindingId]).catch(error=>setNotice(error.message));
  },[binding?.bindingId,binding?.state,apps.loading,apps.refresh]);
  const pending=useRef(false);
  const busy=apps.loading;
  const visible=products.filter(row=>`${row.title} ${row.sku??''} ${row.offerId}`.toLowerCase().includes(search.toLowerCase()));
  async function move(target:number){
    if(!binding||pending.current||apps.loading)return;
    pending.current=true;setNotice('');
    const cursor=target>page?binding.payload?.cursor:cursors[target];
    try{await apps.readBindingPage(binding.bindingId,cursor);setCursors(previous=>{const next=previous.slice(0,target+1);next[target]=cursor??null;return next;});setPage(target);}
    catch(error){setNotice((error as Error).message);}finally{pending.current=false;}
  }
  async function refresh(){
    if(!binding||pending.current||apps.loading)return;
    pending.current=true;setNotice('');
    try{await apps.refresh([binding.bindingId]);setPage(0);setCursors([null]);setNotice('已刷新');}
    catch(error){setNotice((error as Error).message);}finally{pending.current=false;}
  }
  return <main data-app-component data-ready={!apps.loading&&!apps.error&&binding?.state==='ready'?'true':'false'}>
    <header><div><small>当前页商品</small><h1>商品价格与参考利润率</h1><p>源数据时间：{binding?.sourceDataTime??'未知'} · 读取当前快照</p></div><button data-testid="refresh" disabled={busy||!binding} onClick={()=>void refresh()}>刷新</button></header>
    <section className="toolbar"><input aria-label="搜索当前页" placeholder="搜索当前页名称、SKU" value={search} onChange={event=>setSearch(event.target.value)}/></section>
    <p role="status">{apps.loading?'正在读取…':notice}</p>{apps.error||binding?.error?<p role="alert">{apps.error?.message??binding?.error?.message}</p>:null}
    <div className="products">{visible.map(row=><article data-product-row key={row.productId??row.offerId}>
      <strong>{row.title}</strong>
      <p>SKU：{row.sku??'—'}</p><dl><div><dt>采购成本</dt><dd>{money(row.profit?.purchaseMinor,row.currency)}</dd></div><div><dt>实际售价</dt><dd>{money(row.pricing?.sellerMinor,row.currency)}</dd></div><div><dt>参考利润率</dt><dd>{row.profit?.actualMargin==null?'—':`${(row.profit.actualMargin*100).toFixed(2)}%`}</dd></div></dl>{row.profit?.reason?<small>{row.profit.reason}</small>:null}
    </article>)}</div>
    {!apps.loading&&!visible.length?<p>当前页暂无匹配商品。</p>:null}
    <footer id="pager"><span>共 {binding?.payload?.total??'—'} 件 · 本页 {products.length} 件 · 搜索仅作用于本页</span><nav><button data-testid="previous" disabled={busy||page===0} onClick={()=>void move(page-1)}>上一页</button><span data-testid="page">第 {page+1} 页</span><button data-testid="next" disabled={busy||!binding?.payload?.cursor} onClick={()=>void move(page+1)}>下一页</button></nav></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Component/>);
