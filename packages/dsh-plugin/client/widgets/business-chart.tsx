import React from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DataBinding, WidgetSpec } from '../../../presentation/src/types.ts';
import { formatValue } from '../../../presentation/src/design.ts';
import { isProfitField, mappedValue, missingCost } from '../model.ts';
import type { Row } from '../model.ts';
export function BusinessChart({widget,rows,binding,basis}:{widget:WidgetSpec;rows:Row[];binding?:DataBinding;basis?:string}){
  const xField=String(widget.options?.xField??widget.fields?.label??'label'),yField=String(widget.options?.yField??widget.fields?.value??'value');
  const profit=isProfitField(yField,binding);
  const points=rows.filter(row=>!profit||!missingCost(row)).map(row=>({label:String(mappedValue(row,xField,binding)??''),value:mappedValue(row,yField,binding)})).filter((point):point is {label:string;value:number}=>typeof point.value==='number'&&Number.isFinite(point.value)).slice(0,50);
  if(profit&&!basis)return <div className="hm-empty" role="status"><strong>缺少利润口径</strong><p>请先取得 Hallmark 加工结果，不将参考值展示为实际结算利润。</p></div>;
  if(!points.length)return <div className="hm-empty" role="status"><strong>没有可绘制的数据</strong><p>缺成本或缺失数值不会被当作零。</p></div>;
  const content=<><CartesianGrid stroke="var(--hm-line)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fill:'var(--hm-text)',fontSize:11}} tickFormatter={value=>String(value).length>9?String(value).slice(0,8)+'…':String(value)}/><YAxis tick={{fill:'var(--hm-text)',fontSize:11}} width={56}/><Tooltip contentStyle={{background:'var(--hm-bg)',borderColor:'var(--hm-line)',color:'var(--hm-text)'}} formatter={value=>[formatValue(value),'数值']}/><ReferenceLine y={0} stroke="var(--hm-line)"/>{widget.type==='line_chart'?<Line dataKey="value" type="linear" stroke="var(--hm-accent)" dot={{r:3}} strokeWidth={2} isAnimationActive={false}/>:<Bar dataKey="value" fill="var(--hm-accent)" isAnimationActive={false}/>}</>;
  return <><div className="hm-recharts" role="img" aria-label={widget.title??(widget.type==='bar_chart'?'柱图':'折线图')}><ResponsiveContainer width="100%" height={260} minWidth={0} initialDimension={{width:600,height:260}}>{widget.type==='line_chart'?<LineChart data={points} margin={{top:12,right:16,left:0,bottom:4}} accessibilityLayer>{content}</LineChart>:<BarChart data={points} margin={{top:12,right:16,left:0,bottom:4}} accessibilityLayer>{content}</BarChart>}</ResponsiveContainer></div><details><summary>查看图表数值（前 {points.length} 条）</summary><table><thead><tr><th scope="col">类别</th><th scope="col">数值</th></tr></thead><tbody>{points.map((point,i)=><tr key={i}><td>{point.label}</td><td>{formatValue(point.value)}</td></tr>)}</tbody></table></details></>;
}
