import {useEffect,useMemo,useRef,useState} from 'react';
import {flexRender,getCoreRowModel,getSortedRowModel,useReactTable,type ColumnDef,type SortingState} from '@tanstack/react-table';
import {AlertTriangle,ArrowDown,ArrowUp,Check,CheckCheck,ChevronLeft,ChevronRight,ImageOff,Layers3,LoaderCircle,Paperclip,Percent,RefreshCw,Search,ShieldCheck,Store,X} from 'lucide-react';
import {useHallmark} from './lib/runtime/react';
import {toStoreProduct,rowsOf,money,percent,displayDate,type StoreProduct} from './lib/store-products';
import {Button} from './components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from './components/ui/table';

const PAGE_SIZE=20;
const STORE_LABEL='helen';
const NUMERIC_COLUMNS=['price','purchase','margin','profit','stock'];

function StockBadge({product}:{product:StoreProduct}){
  if(product.stock===undefined)return <span className="missing-value">—</span>;
  const tone=product.stock===0?'out':product.stock<100?'low':'ok';
  return <span className="stock-badge" data-tone={tone}>{product.stock.toLocaleString('zh-CN')}</span>;
}
function ProductImage({product}:{product:StoreProduct}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[product.image]);
  return <div className="product-image">{product.image&&!failed?<img src={product.image} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<span title="源未提供图片"><ImageOff size={19}/><span>暂无图片</span></span>}</div>;
}
function SelectionBox({checked,onChange,label,indeterminate=false,disabled=false}:{checked:boolean;onChange:()=>void;label:string;indeterminate?:boolean;disabled?:boolean}){
  const ref=useRef<HTMLInputElement>(null);useEffect(()=>{if(ref.current)ref.current.indeterminate=indeterminate;},[indeterminate]);
  return <input ref={ref} type="checkbox" className="selection-box" checked={checked} onChange={onChange} aria-label={label} disabled={disabled}/>;
}
function MarginCell({product}:{product:StoreProduct}){
  if(product.margin===undefined)return <div className="margin-cell margin-cell-unknown"><span className="margin-unknown" title={product.reason??'缺少成本，无法判断'}>无法判断</span><span className="margin-reason">{product.reason?'缺精确采购价':'缺成本或口径'}</span></div>;
  const ratio=Math.max(0.05,Math.min(1,product.margin/0.35));
  return <div className="margin-cell"><span className="margin-value">{percent(product.margin)}</span><span className="margin-track" aria-hidden="true"><span className="margin-fill" style={{width:`${(ratio*100).toFixed(1)}%`}}/></span><span className="margin-axis"><span>0%</span><span>目标 30%</span></span></div>;
}

export default function Component(){
  const {data,context,loading,error,refresh,attachSelection}=useHallmark();
  useEffect(()=>{
    const query=matchMedia('(prefers-color-scheme: dark)');
    const update=()=>{document.documentElement.dataset.theme=context?.theme??(query.matches?'dark':'light');};
    update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
  },[context?.theme]);

  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [page,setPage]=useState(0);
  const [sorting,setSorting]=useState<SortingState>([]);
  const [attaching,setAttaching]=useState(false);
  const [notice,setNotice]=useState<{text:string;error?:boolean}>();

  const binding=data?.bindings[0];
  const selection=data?.selection.find((item)=>item.bindingId===binding?.bindingId);
  const products=useMemo(()=>{
    if(selection?.rows.length)return selection.rows.map(({key,row})=>toStoreProduct(key,row));
    return rowsOf(binding?.payload).map((row,index)=>toStoreProduct(`display:${index}`,row));
  },[binding,selection]);

  const summary=useMemo(()=>{
    const known=products.filter((item)=>item.margin!==undefined) as (StoreProduct&{margin:number})[];
    const margins=known.map((item)=>item.margin).sort((a,b)=>a-b);
    const median=margins.length?margins[Math.floor((margins.length-1)/2)]:undefined;
    const unknown=products.length-known.length;
    const outliers=known.filter((item)=>item.targetMargin!==undefined&&item.margin<item.targetMargin-0.02);
    return {known:known.length,unknown,margins,median,min:margins[0],max:margins[margins.length-1],outliers,onTarget:known.length-outliers.length};
  },[products]);

  const filtered=useMemo(()=>{
    const needle=search.trim().toLocaleLowerCase();
    if(!needle)return products;
    return products.filter((item)=>`${item.title} ${item.offerId??''} ${item.sku??''} ${item.productId??''}`.toLocaleLowerCase().includes(needle));
  },[products,search]);

  const canSelect=selection?.eligible===true;
  const toggle=(key:string)=>setSelected((previous)=>{const next=new Set(previous);next.has(key)?next.delete(key):next.add(key);return next;});
  const togglePage=(rows:StoreProduct[])=>setSelected((previous)=>{const next=new Set(previous);const all=rows.length>0&&rows.every((item)=>next.has(item.key));rows.forEach((item)=>all?next.delete(item.key):next.add(item.key));return next;});

  const columns:ColumnDef<StoreProduct>[]=[
    {id:'product',header:'商品',enableSorting:false,cell:({row})=><div className="product-cell"><ProductImage product={row.original}/><div className="product-description"><div className="product-name" title={row.original.title}>{row.original.title}</div><div className="product-meta">{row.original.sku&&<span className="id-tag">SKU {row.original.sku}</span>}{row.original.offerId&&<span className="id-tag" title={row.original.offerId}>报价号 {row.original.offerId}</span>}</div></div></div>},
    {id:'price',header:'售价',accessorFn:(row)=>row.price,sortingFn:'basic',cell:({row})=><span className="money-strong">{money(row.original.price,row.original.currency??'CNY')}</span>},
    {id:'purchase',header:'采购价',accessorFn:(row)=>row.purchase,sortingFn:'basic',cell:({row})=>row.original.purchase===undefined?<span className="missing-note">未提供采购价</span>:<span className="money">{money(row.original.purchase,row.original.currency??'CNY')}</span>},
    {id:'margin',header:'参考利润率',accessorFn:(row)=>row.margin,sortingFn:'basic',cell:({row})=><MarginCell product={row.original}/>},
    {id:'profit',header:'参考利润/件',accessorFn:(row)=>row.profit,sortingFn:'basic',cell:({row})=>row.original.profit===undefined?<span className="missing-note">未提供成本</span>:<span className={row.original.profit<0?'money-loss':'money'}>{money(row.original.profit,row.original.currency??'CNY')}</span>},
    {id:'stock',header:'库存',accessorFn:(row)=>row.stock,sortingFn:'basic',cell:({row})=><StockBadge product={row.original}/>},
    {id:'observed',header:'数据时间',enableSorting:false,cell:({row})=><time className="observed" dateTime={row.original.lastSeenAt}>{row.original.lastSeenAt?displayDate(row.original.lastSeenAt).slice(0,10):'—'}</time>},
  ];

  const table=useReactTable({data:filtered,columns,state:{sorting},onSortingChange:setSorting,getCoreRowModel:getCoreRowModel(),getSortedRowModel:getSortedRowModel(),getRowId:(row)=>row.key});
  const sortedRows=table.getRowModel().rows;
  const pageCount=Math.max(1,Math.ceil(sortedRows.length/PAGE_SIZE));
  const currentPage=Math.min(page,pageCount-1);
  const visibleRows=sortedRows.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
  const visible=visibleRows.map((row)=>row.original);
  const selectedVisible=visible.filter((item)=>selected.has(item.key)).length;

  useEffect(()=>setPage(0),[search,sorting]);
  useEffect(()=>{const available=new Set(products.map((item)=>item.key));setSelected((previous)=>new Set([...previous].filter((key)=>available.has(key))));},[products]);

  const onRefresh=()=>{setNotice(undefined);void refresh().catch((reason:unknown)=>setNotice({text:reason instanceof Error?reason.message:String(reason),error:true}));};
  const attach=async()=>{if(!binding)return;setAttaching(true);setNotice(undefined);try{const result=await attachSelection({bindingId:binding.bindingId,keys:[...selected]});setNotice({text:result.message,error:!result.ok});}catch(reason){setNotice({text:reason instanceof Error?reason.message:String(reason),error:true});}finally{setAttaching(false);}};

  const empty=!loading&&!error&&products.length===0;
  const noResults=!empty&&!loading&&!error&&filtered.length===0;
  const currency=products[0]?.currency??'CNY';
  const dataTime=binding?.dataTime??binding?.lastSuccessAt;

  return <main className="margin-app" data-ready={loading?'loading':'ready'}>
    <header className="app-header">
      <div className="app-heading">
        <div className="app-icon"><Store size={22}/></div>
        <div>
          <div className="eyebrow">HALLMARK · 店铺利润</div>
          <h1>{STORE_LABEL} 在售商品利润率<span className="store-chip">Ozon · {currency}</span></h1>
        </div>
      </div>
      <Button variant="outline" className="refresh-button" onClick={onRefresh} disabled={loading} aria-label="刷新店铺数据"><RefreshCw size={15} className={loading?'spin':''}/><span>刷新</span></Button>
    </header>
    <p className="intro">参考利润率来自 Hallmark 利润模型（售价减采购成本、佣金与物流估算），不是平台结算后的真实净利率。</p>

    <section className="kpi-row" aria-label="利润率概览">
      <article className="kpi" data-tone="primary">
        <span className="kpi-label"><Percent size={14}/> 统计商品</span>
        <strong className="kpi-value">{products.length}</strong>
        <span className="kpi-hint">在售快照 · {summary.known} 条可判断</span>
      </article>
      <article className="kpi" data-tone="good">
        <span className="kpi-label">利润率中位数</span>
        <strong className="kpi-value">{summary.median===undefined?'—':percent(summary.median)}</strong>
        <span className="kpi-hint">{summary.min!==undefined&&summary.max!==undefined?`区间 ${percent(summary.min)} – ${percent(summary.max)}`:'暂无可用成本'}</span>
      </article>
      <article className="kpi" data-tone="calm">
        <span className="kpi-label">达到 30% 目标</span>
        <strong className="kpi-value">{summary.outliers.length===0?'全部':`${summary.onTarget} / ${summary.known}`}</strong>
        <span className="kpi-hint">{summary.outliers.length===0?'无低于目标 2 个百分点的商品':`${summary.outliers.length} 条低于目标 2 个百分点以上`}</span>
      </article>
      <article className="kpi" data-tone={summary.unknown>0?'warn':'calm'}>
        <span className="kpi-label"><AlertTriangle size={14}/> 无法判断</span>
        <strong className="kpi-value">{summary.unknown}</strong>
        <span className="kpi-hint">{summary.unknown>0?'缺少精确来源的人民币采购价':'全部商品成本可核实'}</span>
      </article>
    </section>

    <section className="surface" aria-label="在售商品利润明细">
      <div className="surface-tools">
        <label className="search-field"><Search size={16}/><input placeholder="搜索商品名称、SKU、报价号…" aria-label="搜索商品" value={search} onChange={(event)=>setSearch(event.target.value)}/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="清除搜索"><X size={15}/></button>}</label>
        <div className="tool-meta"><span>共 <strong>{products.length}</strong> 条{filtered.length!==products.length&&<> · 筛选后 <strong>{filtered.length}</strong> 条</>}</span><span className="sort-hint"><ArrowDown size={13}/> 点击表头切换排序</span></div>
      </div>

      {loading&&!products.length?<div className="loading-list" aria-label="正在读取商品">{[1,2,3,4,5].map((index)=><div className="skeleton-row" key={index}><div/><span><i/><i/></span></div>)}</div>
      :error?<div className="empty-state" role="alert"><AlertTriangle size={28}/><h2>暂时没能读取店铺商品</h2><p>{error}</p><Button variant="outline" onClick={onRefresh}>重新读取</Button></div>
      :empty?<div className="empty-state"><Layers3 size={30}/><h2>当前数据范围没有在售商品</h2><p>{binding?'快照为空时会显示这里；可先刷新读取最近成功数据。':'请让 Agent 查询 helen 店铺在售商品，再把返回的数据绑定到这个组件。'}</p><Button variant="outline" onClick={onRefresh}>刷新数据</Button></div>
      :noResults?<div className="empty-state"><Search size={28}/><h2>没有找到相符的商品</h2><p>换个更短的关键词，或清空搜索。</p><Button variant="outline" onClick={()=>setSearch('')}>清除搜索</Button></div>
      :<>
        <div className="desktop-table">
          <Table>
            <TableHeader>{table.getHeaderGroups().map((group)=><TableRow key={group.id}><TableHead className="check-cell"><SelectionBox checked={visible.length>0&&selectedVisible===visible.length} indeterminate={selectedVisible>0&&selectedVisible<visible.length} onChange={()=>togglePage(visible)} label="选择本页商品" disabled={!canSelect}/></TableHead>{group.headers.map((header)=><TableHead key={header.id} data-align={NUMERIC_COLUMNS.includes(header.id)?'end':undefined}><button type="button" className="sort-button" onClick={header.column.getToggleSortingHandler()} disabled={!header.column.getCanSort()} aria-label={`${String(header.column.columnDef.header)}，点击排序`}>{flexRender(header.column.columnDef.header,header.getContext())}{header.column.getCanSort()&&<span className="sort-icon">{header.column.getIsSorted()==='asc'?<ArrowUp size={12}/>:header.column.getIsSorted()==='desc'?<ArrowDown size={12}/>:<ArrowDown size={12} className="sort-idle"/>}</span>}</button></TableHead>)}</TableRow>)}</TableHeader>
            <TableBody>{visibleRows.map((row)=><TableRow key={row.id} data-selected={selected.has(row.original.key)}><TableCell className="check-cell"><SelectionBox checked={selected.has(row.original.key)} onChange={()=>toggle(row.original.key)} label={`选择${row.original.title}`} disabled={!canSelect}/></TableCell>{row.getVisibleCells().map((cell)=><TableCell key={cell.id} data-align={NUMERIC_COLUMNS.includes(cell.column.id)?'end':undefined}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </div>

        <div className="mobile-list">
          <div className="mobile-select-all"><SelectionBox checked={visible.length>0&&selectedVisible===visible.length} indeterminate={selectedVisible>0&&selectedVisible<visible.length} onChange={()=>togglePage(visible)} label="选择本页商品" disabled={!canSelect}/><span>选择本页</span></div>
          {visible.map((product)=><article key={product.key} className="mobile-product" data-selected={selected.has(product.key)}>
            <SelectionBox checked={selected.has(product.key)} onChange={()=>toggle(product.key)} label={`选择${product.title}`} disabled={!canSelect}/>
            <ProductImage product={product}/>
            <div className="mobile-product-content">
              <div className="product-name" title={product.title}>{product.title}</div>
              <div className="mobile-margin-row"><span className="mobile-margin-label">参考利润率</span><MarginCell product={product}/></div>
              <div className="mobile-product-bottom"><span className="money-strong">{money(product.price,product.currency??'CNY')}</span>{product.purchase===undefined?<span className="missing-note">未提供采购价</span>:<span className="mobile-purchase">采购 {money(product.purchase,product.currency??'CNY')}</span>}<StockBadge product={product}/></div>
            </div>
          </article>)}
        </div>

        <div className="pagination"><span>{sortedRows.length>0?currentPage*PAGE_SIZE+1:0}–{Math.min((currentPage+1)*PAGE_SIZE,sortedRows.length)} / {sortedRows.length} 条</span><div><Button size="icon" variant="ghost" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} aria-label="上一页"><ChevronLeft size={16}/></Button><span>{currentPage+1} / {pageCount}</span><Button size="icon" variant="ghost" disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)} aria-label="下一页"><ChevronRight size={16}/></Button></div></div>
      </>}
    </section>

    <p className="data-caption"><ShieldCheck size={13}/>{dataTime?`数据时间 ${displayDate(dataTime)}`:'数据时间未提供'} · 币种 {currency} · 采购价为源报价口径，不含运费与平台费用 · 参考利润率非结算净利率</p>
    {!canSelect&&selection?.reason&&<p className="selection-warning">{selection.reason}</p>}
    <footer className="selection-bar" data-active={selected.size>0}>
      <div className="selection-status"><span className="selection-symbol">{selected.size>0?<CheckCheck size={18}/>:<Check size={18}/>}</span><div><strong>{selected.size>0?`已选 ${selected.size} 件商品`:'选择你想处理的商品'}</strong><span>{selected.size>0?<button type="button" className="clear-selection" onClick={()=>setSelected(new Set())}>清空选择</button>:'勾选后附加到聊天，再补充你的要求'}</span></div></div>
      <Button onClick={()=>void attach()} disabled={!selected.size||attaching||!context?.attachment.available} title={context?.attachment.disabledReason} className="attach-button">{attaching?<LoaderCircle size={16} className="spin"/>:<Paperclip size={16}/>}<span>{attaching?'正在附加':'附加到聊天'}</span>{selected.size>0&&<span className="button-count">{selected.size}</span>}</Button>
    </footer>
    {notice&&<div className={`feedback ${notice.error?'feedback-error':''}`} role="status">{notice.error?<AlertTriangle size={16}/>:<Check size={16}/>}<span>{notice.text}</span><button type="button" onClick={()=>setNotice(undefined)} aria-label="关闭提示"><X size={15}/></button></div>}
    {context?.preview&&<p className="preview-label">设计预览 · 附加操作仅演练；在 DSH 中会附加到当前输入框</p>}
  </main>;
}
