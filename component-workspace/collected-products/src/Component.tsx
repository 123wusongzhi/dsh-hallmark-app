import {useEffect,useMemo,useRef,useState} from 'react';
import {flexRender,getCoreRowModel,useReactTable,type ColumnDef} from '@tanstack/react-table';
import {ArrowDown,ArrowUpRight,Check,CheckCheck,ChevronLeft,ChevronRight,Clock3,ImageOff,Inbox,Layers3,LoaderCircle,Paperclip,RefreshCw,Search,ShieldCheck,X} from 'lucide-react';
import {useHallmark} from './lib/runtime/react';
import {toProduct,displayDate,displayPrice,type Product} from './lib/products';
import {Button} from './components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from './components/ui/table';

function ProductImage({product}:{product:Product}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[product.image]);
  return <div className="product-image">{product.image&&!failed?<img src={product.image} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<span title="未提供图片"><ImageOff size={20}/><span>暂无图片</span></span>}</div>;
}
function ProductName({product}:{product:Product}){
  return <div className="product-description"><div className="product-name" title={product.title}>{product.title}</div><div className="product-meta"><span className="source-tag">{product.source}</span>{product.skuCount!==undefined&&<span>{product.skuCount} 个规格</span>}{product.sourceUrl&&/^https?:\/\//.test(product.sourceUrl)&&<a href={product.sourceUrl} target="_blank" rel="noreferrer" aria-label={`查看${product.title}来源`} title="查看商品来源"><ArrowUpRight size={14}/></a>}</div></div>;
}
function SelectionBox({checked,onChange,label,indeterminate=false,disabled=false}:{checked:boolean;onChange:()=>void;label:string;indeterminate?:boolean;disabled?:boolean}){
  const ref=useRef<HTMLInputElement>(null);useEffect(()=>{if(ref.current)ref.current.indeterminate=indeterminate;},[indeterminate]);
  return <input ref={ref} type="checkbox" className="selection-box" checked={checked} onChange={onChange} aria-label={label} disabled={disabled}/>;
}
const PAGE_SIZE=20;
export default function Component(){
  const {data,context,loading,error,refresh,attachSelection}=useHallmark();
  useEffect(()=>{const query=matchMedia('(prefers-color-scheme: dark)');const update=()=>{document.documentElement.dataset.theme=context?.theme??(query.matches?'dark':'light');};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[context?.theme]);
  const [search,setSearch]=useState(''),[source,setSource]=useState('all'),[selected,setSelected]=useState<Set<string>>(new Set()),[page,setPage]=useState(0),[attaching,setAttaching]=useState(false),[notice,setNotice]=useState<{text:string;error?:boolean}>();
  const binding=data?.bindings.find(item=>item.bindingId==='collected')??data?.bindings[0];
  const selection=data?.selection.find(item=>item.bindingId===binding?.bindingId);
  const products=useMemo(()=>{
    // Stable selection keys always come from the host's actual snapshot.
    if(selection?.rows.length)return selection.rows.map(({key,row})=>toProduct(key,row));
    const payload=binding?.payload;const object=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
    const rows=Array.isArray(payload)?payload:Array.isArray(object.items)?object.items:Array.isArray(object.rows)?object.rows:[];
    return rows.map((row,index)=>toProduct(`display:${index}`,row as Record<string,unknown>));
  },[binding,selection]);
  const sources=useMemo(()=>Array.from(new Set(products.map(item=>item.source))),[products]);
  const filtered=useMemo(()=>products.filter(item=>(source==='all'||item.source===source)&&`${item.title} ${item.source}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a,b)=>(b.timestamp??-Infinity)-(a.timestamp??-Infinity)),[products,source,search]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));const currentPage=Math.min(page,pageCount-1);
  const visible=useMemo(()=>filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE),[filtered,currentPage]);
  const canSelect=selection?.eligible===true;
  const selectedVisible=visible.filter(item=>selected.has(item.key)).length;
  useEffect(()=>setPage(0),[search,source]);
  useEffect(()=>{const available=new Set(products.map(item=>item.key));setSelected(previous=>new Set([...previous].filter(key=>available.has(key))));},[products]);
  const toggle=(key:string)=>setSelected(previous=>{const next=new Set(previous);next.has(key)?next.delete(key):next.add(key);return next;});
  const togglePage=()=>setSelected(previous=>{const next=new Set(previous);const all=visible.length>0&&visible.every(item=>next.has(item.key));visible.forEach(item=>all?next.delete(item.key):next.add(item.key));return next;});
  const onRefresh=()=>{setNotice(undefined);void refresh().catch(reason=>setNotice({text:reason.message,error:true}));};
  const attach=async()=>{if(!binding)return;setAttaching(true);setNotice(undefined);try{const result=await attachSelection({bindingId:binding.bindingId,keys:[...selected]});setNotice({text:result.message,error:!result.ok});}catch(reason){setNotice({text:reason instanceof Error?reason.message:String(reason),error:true});}finally{setAttaching(false);}};
  const columns:ColumnDef<Product>[]=[
    {id:'select',header:()=><SelectionBox checked={visible.length>0&&selectedVisible===visible.length} indeterminate={selectedVisible>0&&selectedVisible<visible.length} onChange={togglePage} label="选择本页商品" disabled={!canSelect}/>,cell:({row})=><SelectionBox checked={selected.has(row.original.key)} onChange={()=>toggle(row.original.key)} label={`选择${row.original.title}`} disabled={!canSelect}/>},
    {id:'product',header:'商品信息',cell:({row})=><div className="product-cell"><ProductImage product={row.original}/><ProductName product={row.original}/></div>},
    {id:'price',header:'来源报价',cell:({row})=><span className={row.original.price===undefined?'missing-value':'product-price'}>{displayPrice(row.original)}</span>},
    {id:'date',header:()=><span className="sort-label">记录时间 <ArrowDown size={13}/></span>,cell:({row})=><time title={`${row.original.timeLabel} · ${row.original.collectedAt??'未提供'}`} dateTime={row.original.collectedAt}>{displayDate(row.original.collectedAt)}<span className="time-kind">{row.original.collectedAt?row.original.timeLabel:''}</span></time>}
  ];
  // Pagination belongs to this component; table resets must not enqueue another render.
  const table=useReactTable({data:visible,columns,getCoreRowModel:getCoreRowModel(),getRowId:row=>row.key,manualPagination:true});
  const empty=!loading&&!error&&products.length===0;const noResults=!empty&&!loading&&!error&&filtered.length===0;
  return <main className="collection-app" data-ready={loading?'loading':'ready'}>
    <header className="collection-header"><div className="collection-heading"><div className="collection-icon"><Layers3 size={23}/></div><div><div className="eyebrow">HALLMARK COLLECTION</div><h1>采集商品<span className="count-chip">{products.length}</span></h1></div></div><Button variant="outline" className="refresh-button" onClick={onRefresh} disabled={loading} aria-label="刷新商品"><RefreshCw size={15} className={loading?'spin':''}/><span>刷新</span></Button></header>
    <p className="intro">选好商品，把下一步交给 Agent。</p>
    <section className="collection-surface" aria-label="商品清单">
      <div className="collection-tools"><label className="search-field"><Search size={17}/><input placeholder="搜索商品名称、来源…" aria-label="搜索商品" value={search} onChange={event=>setSearch(event.target.value)}/>{search&&<button onClick={()=>setSearch('')} aria-label="清除搜索"><X size={15}/></button>}</label><label className="source-select"><span className="sr-only">筛选来源</span><select value={source} onChange={event=>setSource(event.target.value)} aria-label="筛选来源"><option value="all">全部来源</option>{sources.map(value=><option key={value}>{value}</option>)}</select></label></div>
      <div className="list-summary"><span><span className="live-dot"/>本次载入 <strong>{products.length}</strong> 件{filtered.length!==products.length&&<> · 符合筛选 <strong>{filtered.length}</strong> 件</>}</span><span className="sort-hint"><Clock3 size={13}/> 按已提供的记录时间排序</span></div>
      {loading&&!products.length?<div className="loading-list" aria-label="正在读取商品">{[1,2,3,4].map(i=><div className="skeleton-row" key={i}><div/><span><i/><i/></span></div>)}</div>:error?<div className="empty-state" role="alert"><Inbox size={32}/><h2>暂时没能读取商品</h2><p>{error}</p><Button variant="outline" onClick={onRefresh}>重新读取</Button></div>:empty?<div className="empty-state"><Inbox size={34}/><h2>这里等待你的第一件商品</h2><p>{binding?'当前数据范围没有商品。采集完成后，刷新即可看到。':'请让 Agent 查询采集商品，再把返回的数据绑定到这个组件。'}</p><Button variant="outline" onClick={onRefresh}>刷新数据</Button></div>:noResults?<div className="empty-state"><Search size={32}/><h2>没有找到相符的商品</h2><p>试试更短的关键词，或查看所有来源。</p><Button variant="outline" onClick={()=>{setSearch('');setSource('all');}}>清除筛选</Button></div>:<>
      <div className="desktop-table"><Table><TableHeader>{table.getHeaderGroups().map(group=><TableRow key={group.id}>{group.headers.map(header=><TableHead key={header.id}>{flexRender(header.column.columnDef.header,header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map(row=><TableRow key={row.id} data-selected={selected.has(row.id)}>{row.getVisibleCells().map(cell=><TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></div>
      <div className="mobile-list"><div className="mobile-select-all"><SelectionBox checked={visible.length>0&&selectedVisible===visible.length} indeterminate={selectedVisible>0&&selectedVisible<visible.length} onChange={togglePage} label="选择本页商品" disabled={!canSelect}/><span>选择本页</span></div>{visible.map(product=><article key={product.key} className="mobile-product" data-selected={selected.has(product.key)}><SelectionBox checked={selected.has(product.key)} onChange={()=>toggle(product.key)} label={`选择${product.title}`} disabled={!canSelect}/><ProductImage product={product}/><div className="mobile-product-content"><ProductName product={product}/><div className="mobile-product-bottom"><span className={product.price===undefined?'missing-value':'product-price'}>{displayPrice(product)}</span><time title={product.collectedAt}>{displayDate(product.collectedAt)}</time></div></div></article>)}</div>
      <div className="pagination"><span>{filtered.length>0?currentPage*PAGE_SIZE+1:0}–{Math.min((currentPage+1)*PAGE_SIZE,filtered.length)} / {filtered.length} 件</span><div><Button size="icon" variant="ghost" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} aria-label="上一页"><ChevronLeft size={16}/></Button><span>{currentPage+1} / {pageCount}</span><Button size="icon" variant="ghost" disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)} aria-label="下一页"><ChevronRight size={16}/></Button></div></div>
      </>}
    </section>
    <p className="data-caption"><ShieldCheck size={13}/>{binding?.lastSuccessAt?`数据读取于 ${displayDate(binding.lastSuccessAt)}`:'显示实际查询范围'} · 来源报价不含运费与平台费用</p>
    {!canSelect&&selection?.reason&&<p className="selection-warning">{selection.reason}</p>}
    <footer className="selection-bar" data-active={selected.size>0}><div className="selection-status"><span className="selection-symbol">{selected.size>0?<CheckCheck size={18}/>:<Check size={18}/>}</span><div><strong>{selected.size>0?`已选 ${selected.size} 件商品`:'选择你想处理的商品'}</strong><span>{selected.size>0?<button className="clear-selection" onClick={()=>setSelected(new Set())}>清空选择</button>:'勾选后附加到聊天，再补充你的要求'}</span></div></div><Button onClick={()=>void attach()} disabled={!selected.size||attaching||!context?.attachment.available} title={context?.attachment.disabledReason} className="attach-button">{attaching?<LoaderCircle size={16} className="spin"/>:<Paperclip size={16}/>}<span>{attaching?'正在附加':'附加到聊天'}</span>{selected.size>0&&<span className="button-count">{selected.size}</span>}</Button></footer>
    {notice&&<div className={`feedback ${notice.error?'feedback-error':''}`} role="status">{notice.error?<Inbox size={16}/>:<Check size={16}/>}<span>{notice.text}</span><button onClick={()=>setNotice(undefined)} aria-label="关闭提示"><X size={15}/></button></div>}
    {context?.preview&&<p className="preview-label">设计预览 · 附件操作仅演练；在 DSH 中会附加到当前输入框</p>}
  </main>;
}
