import { defineCatalog, defineSchema, validateSpec } from '@json-render/core';
import type { Spec } from '@json-render/core';
import { z } from 'zod';
import type { LayoutNode, ViewSpec, WidgetType } from '../../presentation/src/types.ts';

// The installed DSH shell is React 18. json-render/react requires React 19.
// Use core for the real catalog/validation path, with our existing host-compatible renderer.
const schema=defineSchema(s=>({
  spec:s.object({root:s.string(),elements:s.record(s.object({type:s.ref('catalog.components'),props:s.propsOf('catalog.components'),children:s.array(s.string())}))}),
  catalog:s.object({components:s.map({props:s.zod(),description:s.string()})}),
}),{defaultRules:['只引用已有 ViewSpec 的组件 ID；业务数据由可信数据绑定提供。不得生成示例库存、价格或利润。','此配置是展示用派生树，不得持久化为第二份组件配置，不得包含业务写操作。']});
const widgetProps=z.object({widgetId:z.string().min(1)}).strict();
const layoutProps=z.object({gap:z.number().nonnegative(),columns:z.number().int().positive()}).strict();
export const hallmarkCatalog=defineCatalog(schema,{components:{
  Grid:{props:layoutProps,description:'网格布局'},Row:{props:layoutProps,description:'横向布局'},Column:{props:layoutProps,description:'纵向布局'},Tabs:{props:layoutProps,description:'可切换且保留子组件状态的标签页'},
  MetricCard:{props:widgetProps,description:'绑定真实指标的统计卡'},ProductTable:{props:widgetProps,description:'已有数据表格，可信商品支持勾选并附加到原聊天'},BarChart:{props:widgetProps,description:'带数据来源和口径的柱图'},LineChart:{props:widgetProps,description:'带数据来源和口径的折线图'},ProductCard:{props:widgetProps,description:'商品卡'},StatusBadge:{props:widgetProps,description:'原始状态或权威操作回执'},Text:{props:widgetProps,description:'文本说明'},
  ProductList:{props:widgetProps,description:'可配置中文字段的商品列表，支持作用范围明确的搜索、排序、分页与选中联动'},SkuDetail:{props:widgetProps,description:'只展示当前选中商品的 SKU 规格和价格，不提供选品评估'},
}});
export const widgetComponent:Record<WidgetType,string>={stat_card:'MetricCard',table:'ProductTable',bar_chart:'BarChart',line_chart:'LineChart',product_card:'ProductCard',product_list:'ProductList',sku_detail:'SkuDetail',status_badge:'StatusBadge',text:'Text'};
const layoutComponent:Record<LayoutNode['type'],string>={grid:'Grid',row:'Row',column:'Column',tabs:'Tabs'};
export type RenderSpec={root:string;elements:Record<string,{type:string;props:{widgetId?:string;gap?:number;columns?:number};children:string[]}>};

export function assertRenderSpec(result:RenderSpec):void{
  const checked=hallmarkCatalog.validate(result);if(!checked.success)throw new Error('组件类型或布局参数不符合注册表。');
  // core normalizes dynamic props; enforce our smaller literal-only contract as well.
  for(const element of Object.values(result.elements)){
    const entry=hallmarkCatalog.data.components[element.type as keyof typeof hallmarkCatalog.data.components];
    if(!entry)throw new Error('组件参数包含未注册字段。');
    const props=entry.props.safeParse(element.props);
    if(!props.success)throw new Error(props.error.issues.some(issue=>issue.code==='unrecognized_keys')?'组件参数包含未注册字段。':'组件参数尚未完整：布局列数须为正整数，间距不能为负数。');
    if(Object.keys(element).some(key=>!['type','props','children'].includes(key)))throw new Error('派生组件不允许任意动作或表达式。');
  }
  if(!validateSpec(result as Spec).valid)throw new Error('组件布局引用不完整。');
}

/** Deterministic, data-free projection. ViewSpec remains the only editable/persisted format. */
export function toRenderSpec(view:ViewSpec):RenderSpec{
  const elements:RenderSpec['elements']={};
  const widgetIds=new Map(view.widgets.map(widget=>[widget.id,widget]));
  const used=new Set<string>();
  let next=0;
  const visit=(node:LayoutNode,depth:number):string=>{
    if(depth>40)throw new Error('组件布局层级过深。');
    const key=`layout:${next++}`;
    const children=node.children.map(child=>{
      if(typeof child!=='string')return visit(child,depth+1);
      const widget=widgetIds.get(child);if(!widget||used.has(child))throw new Error('布局引用了不存在或重复的组件。');
      used.add(child);const widgetKey=`widget:${child}`;
      elements[widgetKey]={type:widgetComponent[widget.type],props:{widgetId:widget.id},children:[]};return widgetKey;
    });
    elements[key]={type:layoutComponent[node.type],props:{gap:node.gap??view.theme?.spacing??16,columns:node.columns??2},children};return key;
  };
  const result={root:visit(view.layout,0),elements};
  assertRenderSpec(result);
  return result;
}
