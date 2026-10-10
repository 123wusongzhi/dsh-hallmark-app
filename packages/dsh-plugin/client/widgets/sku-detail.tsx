import React from 'react';
import type {BindingData,DataBinding,WidgetSpec} from '../../../presentation/src/types.ts';
import type {ViewInteractions} from '../material-interactions.ts';
import {materialColumns,materialDisplay,materialFieldMeta,materialLabel,materialRows,materialValue} from './material-format.ts';

export function SkuDetail({widget,binding,data,interactions}:{widget:WidgetSpec;binding?:DataBinding;data?:BindingData;interactions?:ViewInteractions}){
  const control=interactions?.bindings?.[widget.bindingId??''],selected=control?.selectedProductId,example=widget.options?.example===true||data?.provenance.example===true;
  if(widget.options?.requiresSelection!==false&&!selected)return <div className="hm-material-empty" role="status"><strong>请选择一个商品</strong><p>在商品列表中选择商品，即可查看 SKU 规格和价格。</p>{example?<span className="hm-material-example">示例</span>:null}</div>;
  if(control?.pagination?.loading||data?.state==='refreshing')return <div className="hm-material-empty" role="status">正在读取所选商品的 SKU…</div>;
  const rows=materialRows(data?.payload,widget).filter(row=>{const id=materialValue(row,'product.id',widget,binding);return !selected||id==null||String(id)===selected;});
  if(!rows.length)return <div className="hm-material-empty" role="status"><strong>暂无 SKU 数据</strong><p>当前商品尚未提供可展示的规格和价格。</p></div>;
  const columns=materialColumns(widget,['sku.id','sku.specification','price.current']);
  return <div className="hm-native-sku-detail" data-density={widget.options?.density??'comfortable'}>{example?<span className="hm-material-example">示例</span>:null}<p className="hm-material-scope">{selected?`当前商品：${selected} · `:''}{rows.length} 个规格</p><div className="hm-material-scroll"><table className="hm-material-table"><thead><tr>{columns.map(column=><th key={column.field} scope="col" title={materialFieldMeta(column.field,widget).description}>{materialLabel(column,widget)}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={String(materialValue(row,'sku.id',widget,binding)??index)}>{columns.map(column=><td key={column.field} data-field={column.field}>{materialDisplay(row,column.field,widget,binding)}</td>)}</tr>)}</tbody></table></div></div>;
}
