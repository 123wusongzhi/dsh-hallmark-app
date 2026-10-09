import type { DataBinding, LayoutNode, ViewSpec, WidgetSpec, WidgetType, Template } from '../../presentation/src/types.ts';
const uid=()=>globalThis.crypto.randomUUID();
export function newDraft():ViewSpec{const id=uid(),widgetId=uid();return {id,title:'新的组件设计',layout:{type:'column',children:[widgetId]},widgets:[{id:widgetId,type:'text',title:'说明',text:'在控制台调整布局、添加组件并绑定只读数据。'}],bindings:[]};}
export function defaultWidget(type:WidgetType,id:string=uid(),bindingId?:string):WidgetSpec{
  return {id,type,title:({stat_card:'数据卡片',table:'数据表格',bar_chart:'柱图',line_chart:'折线图',product_card:'商品卡片',product_list:'商品列表',sku_detail:'SKU 明细',status_badge:'状态',text:'说明'} as const)[type],...(type==='text'?{text:''}:bindingId?{bindingId}:{}),...(type==='table'?{columns:[{field:'title',label:'名称',format:'text'}],options:{pageSize:20}}:{}),...(['bar_chart','line_chart'].includes(type)?{fields:{label:'title',value:'stock'}}:{}),...(type==='stat_card'?{fields:{value:'value'}}:{}),...(type==='product_card'?{fields:{title:'title',image:'imageUrl',price:'price',stock:'stock',margin:'referenceProfit.margin'}}:{}),...(type==='status_badge'?{fields:{status:'state'}}:{})};
}
export function addWidget(spec:ViewSpec,type:WidgetType):ViewSpec{
  const next=structuredClone(spec);let bindingId=next.bindings[0]?.id;
  if(type!=='text'&&!bindingId){bindingId=uid();next.bindings.push({id:bindingId,datasetKey:'',fieldMap:{}});}
  const widget=defaultWidget(type,uid(),bindingId);next.widgets.push(widget);next.layout.children.push(widget.id);return next;
}
function removeReference(layout:LayoutNode,id:string):LayoutNode{return {...layout,children:layout.children.filter(child=>child!==id).map(child=>typeof child==='string'?child:removeReference(child,id))};}
export function removeWidget(spec:ViewSpec,id:string):ViewSpec{const next=structuredClone(spec);next.widgets=next.widgets.filter(w=>w.id!==id);next.layout=removeReference(next.layout,id);return next;}
export function updateWidget(spec:ViewSpec,id:string,patch:Partial<WidgetSpec>):ViewSpec{return {...spec,widgets:spec.widgets.map(widget=>widget.id===id?{...widget,...patch}:widget)};}
export function reorderWidget(spec:ViewSpec,id:string,direction:-1|1):ViewSpec{
  const next=structuredClone(spec);const move=(layout:LayoutNode):boolean=>{const index=layout.children.indexOf(id);if(index>=0){const target=index+direction;if(target>=0&&target<layout.children.length)[layout.children[index],layout.children[target]]=[layout.children[target],layout.children[index]];return true;}return layout.children.some(child=>typeof child!=='string'&&move(child));};move(next.layout);return next;
}
export function groupWidget(spec:ViewSpec,id:string,groupIndex:number):ViewSpec{
  const next=structuredClone(spec);const groupOrdinal=spec.layout.children.slice(0,groupIndex).filter(child=>typeof child!=='string').length;next.layout=removeReference(next.layout,id);if(groupIndex<0)next.layout.children.push(id);else{const group=next.layout.children.filter(child=>typeof child!=='string')[groupOrdinal];if(group&&typeof group!=='string')group.children.push(id);else next.layout.children.push(id);}return next;
}
export function addGroup(spec:ViewSpec,type:LayoutNode['type']):ViewSpec{const next=structuredClone(spec);next.layout.children.push({type,children:[]});return next;}
export function setBinding(spec:ViewSpec,id:string,patch:Partial<DataBinding>):ViewSpec{return {...spec,bindings:spec.bindings.map(binding=>binding.id===id?{...binding,...patch}:binding)};}
export function draftFromTemplate(template:Template):ViewSpec{
  const ids=Array.isArray(template.contentRules.bindingIds)?template.contentRules.bindingIds as string[]:['main'];
  return {id:uid(),title:template.name,theme:structuredClone(template.theme),layout:structuredClone(template.layout),widgets:structuredClone(template.widgetStyles),bindings:ids.map(id=>({id,datasetKey:'',fieldMap:{}}))};
}
