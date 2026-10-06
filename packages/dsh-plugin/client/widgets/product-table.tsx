import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef, RowSelectionState, SortingState, Updater } from '@tanstack/react-table';
import type { BindingData, DataBinding, WidgetSpec } from '../../../presentation/src/types.ts';
import { isProfitField, mappedValue, missingCost } from '../model.ts';
import type { Row, Sort } from '../model.ts';
import { getProductSelectionRows } from '../selection.ts';
import { useProductSelection } from '../selection-context.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table.tsx';
import { matchesTableSearch, tableCellValue, tableColumnKind, tablePageSize } from './table-format.ts';
import type { TableColumn } from './table-format.ts';

const emptySelection:RowSelectionState={};
function Checkbox({mixed=false,...props}:React.ComponentProps<'input'>&{mixed?:boolean}){
  const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(ref.current)ref.current.indeterminate=mixed;},[mixed]);
  return <input {...props} ref={ref} type="checkbox" className="hm-row-checkbox"/>;
}
function TableIcon({kind}:{kind:'search'|'close'|'attach'|'left'|'right'|'sort'|'asc'|'desc'}){
  return <svg className={`hm-table-icon hm-table-icon-${kind}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='search'?<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>:kind==='close'?<path d="m6 6 12 12M18 6 6 18"/>:kind==='attach'?<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7L14 3.5a3 3 0 0 1 4 4l-9 9a1 1 0 0 1-1.5-1.5L16 6.5"/>:kind==='left'?<path d="m14 6-6 6 6 6"/>:kind==='right'?<path d="m10 6 6 6-6 6"/>:kind==='asc'?<path d="M12 19V5m-5 5 5-5 5 5"/>:kind==='desc'?<path d="M12 5v14m-5-5 5 5 5-5"/>:<path d="m8 9 4-4 4 4m-8 6 4 4 4-4"/>}</svg>;
}
export function ProductTable({widget,rows,binding,data,basis}:{widget:WidgetSpec;rows:Row[];binding?:DataBinding;data?:BindingData;basis?:string}){
  const bridge=useProductSelection();
  const candidates=useMemo(()=>getProductSelectionRows(binding,data,rows),[binding,data,rows]);
  const keys=useMemo(()=>new Map(candidates.rows.map(item=>[item.row,item.key])),[candidates]);
  const [selection,setSelection]=useState({data,binding,sourceRows:rows,sessionId:bridge?.sessionId,viewId:bridge?.viewId,rows:emptySelection});
  // New snapshots, bindings or owners never inherit checked IDs, even before effects run.
  const rowSelection=selection.data===data&&selection.binding===binding&&selection.sourceRows===rows&&selection.sessionId===bridge?.sessionId&&selection.viewId===bridge?.viewId?selection.rows:emptySelection;
  const onSelection=(update:Updater<RowSelectionState>)=>setSelection({data,binding,sourceRows:rows,sessionId:bridge?.sessionId,viewId:bridge?.viewId,rows:typeof update==='function'?update(rowSelection):update});
  const initialSort=widget.options?.sort as Sort|undefined;
  const [sorting,setSorting]=useState<SortingState>(initialSort?[{id:initialSort.field,desc:initialSort.direction==='desc'}]:[]);
  const defaultPageSize=tablePageSize(widget.options?.pageSize);
  const [pagination,setPagination]=useState({pageIndex:0,pageSize:defaultPageSize});
  const [search,setSearch]=useState('');const [notice,setNotice]=useState('');
  useEffect(()=>{setNotice('');setPagination(current=>({...current,pageIndex:0}));},[binding,data,rows]);
  useEffect(()=>{setPagination({pageIndex:0,pageSize:defaultPageSize});},[defaultPageSize]);
  const columnSpecs=useMemo(()=>new Map((widget.columns??[]).map(column=>[column.field,column])),[widget.columns]);
  const columnKinds=useMemo(()=>new Map((widget.columns??[]).map(column=>[column.field,tableColumnKind(column,rows,binding)])),[widget.columns,rows,binding]);
  const currencyFor=(row:Row)=>String(widget.options?.currency??mappedValue(row,'currency',binding)??'RUB');
  const columns=useMemo<ColumnDef<Row>[]>(()=>(widget.columns??[]).map(column=>({
    id:column.field,header:column.label,
    accessorFn:row=>{const value=mappedValue(row,column.field,binding);return value==null||isProfitField(column.field,binding)&&(missingCost(row)||!basis)?undefined:value;},
    sortUndefined:'last',sortDescFirst:false,
    sortingFn:(a,b,id)=>{const x=a.getValue(id),y=b.getValue(id);return typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'zh-CN',{numeric:true});},
    cell:({row})=>{
      const value=tableCellValue(row.original,column,binding,basis,String(widget.options?.currency??mappedValue(row.original,'currency',binding)??'RUB'));
      const kind=columnKinds.get(column.field)??'text';
      return value.date?<time className="hm-table-cell-value hm-cell-date" dateTime={value.date.iso} title={value.date.iso}><span>{value.date.date}</span>{value.date.time?<span>{value.date.time}</span>:null}</time>:<span className={`hm-table-cell-value hm-cell-${kind}${value.missing?' hm-cell-missing':''}`} title={value.title} aria-label={value.missing?value.title:undefined}>{value.text}</span>;
    },
  })),[widget,binding,basis,columnKinds]);
  const selectable=candidates.eligible&&bridge?.available===true;
  const minWidth=columns.length>=3?[...columnKinds.values()].reduce((width,kind)=>width+({title:180,date:120,number:100,text:120}[kind]),candidates.eligible?34:0):undefined;
  const table=useReactTable({data:rows,columns,state:{sorting,pagination,rowSelection,globalFilter:search},onSortingChange:updater=>{setSorting(updater);setPagination(current=>({...current,pageIndex:0}));},onPaginationChange:setPagination,onRowSelectionChange:onSelection,getRowId:(row,index)=>keys.get(row)??`display-only:${index}`,enableRowSelection:selectable,enableSortingRemoval:false,getColumnCanGlobalFilter:()=>true,globalFilterFn:(row,columnId,query)=>{
    const column=columnSpecs.get(columnId) as TableColumn;
    return matchesTableSearch(row.getValue(columnId),tableCellValue(row.original,column,binding,basis,currencyFor(row.original)).text,String(query));
  },getCoreRowModel:getCoreRowModel(),getFilteredRowModel:getFilteredRowModel(),getSortedRowModel:getSortedRowModel(),getPaginationRowModel:getPaginationRowModel(),autoResetPageIndex:false});
  const selected=table.getSelectedRowModel().rows;
  const filteredCount=table.getFilteredRowModel().rows.length;
  const hiddenSelected=selected.length-table.getFilteredSelectedRowModel().rows.length;
  const pageRows=table.getRowModel().rows;
  const allPageSelected=pageRows.length>0&&pageRows.every(row=>row.getIsSelected());
  const somePageSelected=pageRows.some(row=>row.getIsSelected());
  const selectPage=(checked:boolean)=>{const next={...rowSelection};let count=Object.values(next).filter(Boolean).length;for(const row of pageRows){if(!checked){delete next[row.id];}else if(!next[row.id]&&count<100){next[row.id]=true;count++;}}onSelection(next);setNotice(checked&&pageRows.some(row=>!next[row.id])?'一次最多选择 100 个产品。':'');};
  const attach=()=>{const result=bridge?.attach({widget,binding,data,rows:selected.map(row=>row.original)});setNotice(result?.message??'请先在原聊天中打开此组件。');};
  const filter=(value:string)=>{setSearch(value);setPagination(current=>({...current,pageIndex:0}));};
  if(!rows.length)return <div className="hm-empty" role="status"><strong>没有匹配记录</strong><p>调整查询条件，或等待对应数据集更新。</p></div>;
  if(!columns.length)return <div className="hm-empty" role="status"><strong>尚未配置表格列</strong><p>可在聊天中指定要展示的源字段。</p></div>;
  return <div className="hm-product-table">
    <div className="hm-table-toolbar"><div className="hm-table-search"><TableIcon kind="search"/><input type="search" aria-label="搜索当前快照" placeholder="搜索当前快照…" value={search} onChange={event=>filter(event.target.value)}/>{search?<button className="hm-table-search-clear" type="button" aria-label="清除快照搜索" onClick={()=>filter('')}><TableIcon kind="close"/></button>:null}</div><div className="hm-table-toolbar-meta"><span>{search.trim()?`${filteredCount} / ${rows.length} 条`:`${rows.length} 条记录`}</span>{[...columnKinds.values()].includes('date')?<span>时间按本机时区显示</span>:null}</div></div>
    {candidates.eligible?<div className="hm-selection-toolbar" data-has-selection={selected.length>0}><div className="hm-selection-count" aria-live="polite"><span>已选 {selected.length} 个产品</span>{hiddenSelected>0?<span className="hm-selection-hidden">其中 {hiddenSelected} 个不在当前筛选结果</span>:null}</div><div className="hm-table-selection-actions"><button className="hm-table-attach" type="button" onClick={attach} disabled={!selectable||!selected.length}><TableIcon kind="attach"/>附加到当前聊天</button><button className="hm-table-clear-selection" type="button" onClick={()=>{onSelection({});setNotice('');}} disabled={!selected.length}>清除选择</button></div><span className="hm-muted hm-table-selection-hint">{selectable?'跨页保留选择 · 最多 100 个 · 附加后由你发送':bridge?.disabledReason??'预览中不能发送选择，请从原聊天打开组件。'}</span></div>:null}
    <Table className="hm-data-table" style={minWidth?{minWidth}:undefined}><TableHeader>{table.getHeaderGroups().map(group=><TableRow key={group.id}>{candidates.eligible?<TableHead className="hm-table-check" scope="col"><Checkbox aria-label="选择本页产品" checked={allPageSelected} mixed={!allPageSelected&&somePageSelected} disabled={!selectable||!pageRows.length} onChange={event=>selectPage(event.target.checked)}/></TableHead>:null}{group.headers.map(header=><TableHead key={header.id} scope="col" data-column-kind={columnKinds.get(header.id)} aria-sort={header.column.getIsSorted()==='asc'?'ascending':header.column.getIsSorted()==='desc'?'descending':'none'}><button className="hm-table-sort" type="button" onClick={header.column.getToggleSortingHandler()} aria-label={`${String(header.column.columnDef.header)}，点击排序`}>{flexRender(header.column.columnDef.header,header.getContext())}<span className="hm-table-sort-icon"><TableIcon kind={header.column.getIsSorted()||'sort'}/></span></button></TableHead>)}</TableRow>)}</TableHeader><TableBody>{pageRows.map(row=><TableRow key={row.id} data-state={row.getIsSelected()?'selected':undefined}>{candidates.eligible?<TableCell className="hm-table-check"><Checkbox aria-label={`选择产品 ${String(mappedValue(row.original,'title',binding)??mappedValue(row.original,'name',binding)??row.id)}`} checked={row.getIsSelected()} disabled={!selectable||!row.getIsSelected()&&selected.length>=100} onChange={row.getToggleSelectedHandler()}/></TableCell>:null}{row.getVisibleCells().map(cell=><TableCell key={cell.id} data-column-kind={columnKinds.get(cell.column.id)}>{flexRender(cell.column.columnDef.cell,cell.getContext())}</TableCell>)}</TableRow>)}{!pageRows.length?<TableRow><TableCell colSpan={columns.length+(candidates.eligible?1:0)}><div className="hm-table-filter-empty" role="status"><strong>当前快照中没有匹配记录</strong><span>尝试其他关键词，或<button type="button" onClick={()=>filter('')}>清除搜索</button></span></div></TableCell></TableRow>:null}</TableBody></Table>
    {!candidates.eligible&&bridge?<p className="hm-muted hm-table-selection-hint">{candidates.reason}</p>:null}
    <div className="hm-pagination hm-table-pagination"><span className="hm-muted hm-table-range">{filteredCount?`${pagination.pageIndex*pagination.pageSize+1}–${Math.min((pagination.pageIndex+1)*pagination.pageSize,filteredCount)} / ${filteredCount} 条`:'0 条'}<span>仅筛选、排序当前快照</span></span><label className="hm-table-page-size">每页 <select aria-label="每页记录数" value={pagination.pageSize} onChange={event=>table.setPageSize(Number(event.target.value))}>{[...new Set([10,20,50,100,pagination.pageSize])].sort((a,b)=>a-b).map(size=><option key={size} value={size}>{size}</option>)}</select></label><div className="hm-table-page-controls"><button type="button" onClick={()=>table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="上一页"><TableIcon kind="left"/><span>上一页</span></button><span className="hm-table-page-number" aria-live="polite">{pagination.pageIndex+1} / {Math.max(1,table.getPageCount())}</span><button type="button" onClick={()=>table.nextPage()} disabled={!table.getCanNextPage()} aria-label="下一页"><span>下一页</span><TableIcon kind="right"/></button></div></div>
    {notice?<p className="hm-live" role="status">{notice}</p>:null}
  </div>;
}
