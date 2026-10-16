import React,{useState} from 'react';
import type {JsonValue} from '../../app-contracts/src/index.ts';
import type {DataSourceDefinition,DataSourceField} from '../../app-presentation/src/types.ts';
import {FIELD_ROLE_MAP} from '../../app-presentation/src/field-roles.ts';
import {getMaterial,createMaterialView} from '../../app-presentation/src/materials/catalog.ts';
import type {ViewSpec,WidgetSpec} from '../../presentation/src/types.ts';
import {AppsIcon} from './ui.tsx';
import {SourceIcon} from './material-thumbnail.tsx';
import {PROCUREMENT_CAPABILITY,PROCUREMENT_PLAN_FIELDS} from './procurement-plan.tsx';

export interface DisplayColumn {field:string;label?:string}
export interface ConfiguredColumn extends DisplayColumn {visible:boolean}
export const fieldKey=(field:DataSourceField)=>field.key??field.role;
export const widgetMaterialId=(widget:WidgetSpec)=>widget.options?.materialId==='product-procurement'?'product-procurement':widget.type==='sku_detail'?'sku-detail':widget.type==='table'?widget.options?.materialId==='data-table'?'data-table':'activity-list':'product-list';
export function widgetColumns(widget:WidgetSpec):DisplayColumn[]{
  if(widget.type==='table'&&widget.columns)return widget.columns;
  const configured=widget.options?.columns;
  if(Array.isArray(configured))return configured.filter((column):column is DisplayColumn=>!!column&&typeof column==='object'&&typeof column.field==='string');
  return (getMaterial(widgetMaterialId(widget))?.defaultOptions.columns??[]) as DisplayColumn[];
}

export function configuredColumns(widget:WidgetSpec):ConfiguredColumn[]{
  const configured=widget.options?.displayColumns;
  return Array.isArray(configured)?configured.filter((column):column is ConfiguredColumn=>!!column&&typeof column==='object'&&typeof column.field==='string'&&typeof column.visible==='boolean'):widgetColumns(widget).map(column=>({...column,visible:true}));
}
export function withDisplayColumns(widget:WidgetSpec,columns:ConfiguredColumn[],source?:DataSourceDefinition):WidgetSpec{
  const named=columns.map(column=>{const mapping=source?.fields.find(field=>fieldKey(field)===column.field);return {...column,label:column.label?.trim()||mapping?.label||FIELD_ROLE_MAP[mapping?.role??column.field]?.label||column.field};});
  const visible=named.filter(column=>column.visible).map(({visible:_,...column})=>column);
  return {...widget,options:{...widget.options,displayColumns:named,...(widget.type!=='table'?{columns:visible}:{})},...(widget.type==='table'?{columns:visible.map(column=>({...column,...(FIELD_ROLE_MAP[source?.fields.find(field=>fieldKey(field)===column.field)?.role??column.field]?.format==='datetime'?{format:'date' as const}:{})}))}:{})};
}

/** Display edits retain field identity and origin; hiding never discards the label or position. */
export function ModuleConfig({spec,sources,onChange,allowedRoles,onAddInformation,selectedWidgetId,onSelectWidget}:{spec:ViewSpec;sources:Record<string,DataSourceDefinition|undefined>;onChange:(spec:ViewSpec)=>void;allowedRoles?:string[];onAddInformation?:(widgetId:string)=>void;selectedWidgetId?:string;onSelectWidget?:(widgetId:string)=>void}){
  const [editing,setEditing]=useState<string>(),[dragged,setDragged]=useState<string>();
  const widget=spec.widgets.find(item=>item.id===selectedWidgetId)??spec.widgets[0];
  if(!widget)return null;
  const source=sources[widget.bindingId??'main'],columns=configuredColumns(widget),material=getMaterial(widgetMaterialId(widget));
  const setWidget=(next:WidgetSpec)=>onChange({...spec,widgets:spec.widgets.map(item=>item.id===widget.id?next:item)});
  const setColumns=(next:ConfiguredColumn[])=>setWidget(withDisplayColumns(widget,next,source));
  const move=(from:number,to:number)=>{if(from===to||from<0||to<0||to>=columns.length)return;const next=[...columns],item=next.splice(from,1)[0];next.splice(to,0,item);setColumns(next);};
  const originCount=new Set(columns.filter(column=>column.visible).map(column=>source?.fields.find(field=>fieldKey(field)===column.field)?.origin?.source??source?.id).filter(Boolean)).size;
  return <section className="apps-module-config apps-display-panel" aria-label="展示配置">
    <p className="apps-panel-subtitle">{columns.filter(column=>column.visible).length} 项信息 · {originCount} 类来源</p>
    {spec.widgets.length>1?<div className="apps-widget-tabs" aria-label="选择调整模块">{spec.widgets.map(item=><button type="button" key={item.id} aria-pressed={item.id===widget.id} onClick={()=>onSelectWidget?.(item.id)}>{item.title??'模块'}</button>)}</div>:null}
    <div className="apps-config-heading"><h3>显示内容</h3><span><AppsIcon name="grip"/> 拖动排序</span></div>
    <div className="apps-display-columns">{columns.map((column,index)=>{
      const mapping=source?.fields.find(field=>fieldKey(field)===column.field),role=FIELD_ROLE_MAP[mapping?.role??column.field],label=mapping?.label??role?.label??column.label??column.field;
      const detail=[mapping?.description??role?.description,mapping?.unit??role?.unit].filter(Boolean).join(' · '),editKey=`${widget.id}:${column.field}`;
      return <div key={column.field} className={`apps-display-column${column.visible?'':' is-hidden'}${dragged===column.field?' is-dragging':''}`} draggable onDragStart={event=>{setDragged(column.field);event.dataTransfer?.setData('text/plain',column.field);}} onDragEnd={()=>setDragged(undefined)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();move(columns.findIndex(item=>item.field===dragged),index);setDragged(undefined);}}>
        <span className="apps-column-grip" title="拖动排序"><AppsIcon name="grip"/></span><span className="apps-field-symbol"><SourceIcon source={mapping?.origin?.source}/></span>
        <div className="apps-display-column-copy">{editing===editKey?<input autoFocus aria-label={`${label}显示名称`} value={column.label??label} onChange={event=>setColumns(columns.map((item,i)=>i===index?{...item,label:event.target.value}:item))} onBlur={()=>setEditing(undefined)} onKeyDown={event=>{if(event.key==='Enter')setEditing(undefined);}}/>:<strong title={detail}>{column.label??label}</strong>}<small>{mapping?.origin?.label??source?.title??'选择数据后预览'}</small></div>
        <div className="apps-column-row-actions"><button type="button" aria-label={`上移${label}`} disabled={index===0} onClick={()=>move(index,index-1)}>↑</button><button type="button" aria-label={`下移${label}`} disabled={index===columns.length-1} onClick={()=>move(index,index+1)}>↓</button><button type="button" aria-label={`重命名${label}`} onClick={()=>setEditing(editKey)}><AppsIcon name="edit"/></button></div>
        <button type="button" className="apps-column-visibility" aria-label={`显示${label}`} aria-pressed={column.visible} title={column.visible?'隐藏此信息':'显示此信息'} disabled={column.visible&&columns.filter(item=>item.visible).length===1} onClick={()=>setColumns(columns.map((item,i)=>i===index?{...item,visible:!item.visible}:item))}><AppsIcon name={column.visible?'eye':'eye-off'}/></button>
      </div>;
    })}</div>
    <button type="button" className="apps-add-information" onClick={()=>onAddInformation?.(widget.id)}><AppsIcon name="plus"/> 添加信息</button>
    <div className="apps-config-heading apps-density-heading"><h3>显示样式</h3></div>
    <div className="apps-density-options">{(['comfortable','compact'] as const).map(density=><button type="button" key={density} aria-label={`${widget.title??'组件'}${density==='comfortable'?'舒适':'紧凑'}`} aria-pressed={(widget.options?.density??'comfortable')===density} onClick={()=>setWidget({...widget,options:{...widget.options,density}})}><span className={`apps-density-mini is-${density}`} aria-hidden="true">{[0,1,2].map(index=><i key={index}/>)}</span><strong>{density==='comfortable'?'舒适':'紧凑'}</strong>{(widget.options?.density??'comfortable')===density?<span className="apps-option-check"><AppsIcon name="check"/></span>:null}</button>)}</div>
    <div className="apps-config-heading apps-density-heading"><h3>每页条数</h3></div><div className="apps-page-size" aria-label={`${widget.title??'组件'}每页条数`}>{[5,10,20].map(pageSize=><button type="button" key={pageSize} aria-pressed={(widget.options?.pageSize??10)===pageSize} onClick={()=>setWidget({...widget,options:{...widget.options,pageSize}})}>{pageSize}</button>)}</div>
    <details className="apps-composition-advanced"><summary>组合模块</summary><ModuleStructure spec={spec} sources={sources} onChange={onChange} allowedRoles={allowedRoles}/></details>
    <button type="button" className="apps-reset-display" onClick={()=>{const defaults=material?.defaultOptions.columns??[],sourceDefaults=defaults.length?defaults:source?.fields.slice(0,5).map(field=>({field:fieldKey(field),label:field.label}))??[];setWidget(withDisplayColumns({...widget,options:{...widget.options,density:'comfortable',pageSize:10}},sourceDefaults.map(column=>({...column,visible:true})),source));}}>恢复默认</button>
  </section>;
}

/** A renamed label never changes the semantic field or its source metadata. */
function ModuleStructure({spec,sources,onChange,allowedRoles}:{spec:ViewSpec;sources:Record<string,DataSourceDefinition|undefined>;onChange:(spec:ViewSpec)=>void;allowedRoles?:string[]}){
  const choices=['product-list','sku-detail',...(allowedRoles?[]:['product-procurement','data-table','activity-list'])].map(id=>getMaterial(id)).filter((material):material is NonNullable<typeof material>=>!!material);
  const compose=(widgets:WidgetSpec[],bindings:ViewSpec['bindings'],links:ViewSpec['links'])=>{
    const activeLinks=(links??[]).filter(link=>widgets.some(widget=>widget.id===link.from.widgetId&&widget.type==='product_list')&&widgets.some(widget=>widget.bindingId===link.to.bindingId&&widget.type==='sku_detail'));
    onChange({...spec,widgets:widgets.map(widget=>widget.type==='sku_detail'?{...widget,options:{...widget.options,requiresSelection:activeLinks.some(link=>link.to.bindingId===widget.bindingId)}}:widget),bindings,links:activeLinks,layout:{...spec.layout,children:widgets.map(widget=>widget.id)}});
  };
  const insertModule=(materialId:string,replaceId?:string)=>{
    const template=createMaterialView(materialId),token=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`,bindingId=`binding-${token}`,old=spec.widgets.find(widget=>widget.id===replaceId);
    const duplicateCount=spec.widgets.filter(widget=>widget.id!==replaceId&&widget.type===template.widgets[0].type).length;
    const widget={...template.widgets[0],id:replaceId??`widget-${token}`,bindingId,title:`${template.widgets[0].title}${duplicateCount?` ${duplicateCount+1}`:''}`},binding={...template.bindings[0],id:bindingId};
    const widgets=replaceId?spec.widgets.map(current=>current.id===replaceId?widget:current):[...spec.widgets,widget];
    const bindings=[...spec.bindings.filter(current=>current.id!==old?.bindingId),binding];
    compose(widgets,bindings,spec.links?.filter(link=>link.from.widgetId!==replaceId&&link.to.bindingId!==old?.bindingId));
  };
  const changeWidget=(id:string,patch:Partial<WidgetSpec>)=>onChange({...spec,widgets:spec.widgets.map(widget=>widget.id===id?{...widget,...patch}:widget)});
  const removeWidget=(id:string)=>{
    const remaining=spec.widgets.filter(widget=>widget.id!==id),bindings=spec.bindings.filter(binding=>remaining.some(widget=>widget.bindingId===binding.id)),links=spec.links?.filter(link=>link.from.widgetId!==id&&bindings.some(binding=>binding.id===link.to.bindingId));
    const widgets=remaining.map(widget=>widget.type==='sku_detail'?{...widget,options:{...widget.options,requiresSelection:!!links?.some(link=>link.to.bindingId===widget.bindingId)}}:widget);
    onChange({...spec,widgets,bindings,layout:{type:'grid',columns:1,gap:16,children:widgets.map(widget=>widget.id)},links});
  };
  const moveWidget=(index:number,direction:-1|1)=>{const widgets=[...spec.widgets];[widgets[index],widgets[index+direction]]=[widgets[index+direction],widgets[index]];onChange({...spec,widgets,layout:{...spec.layout,children:widgets.map(widget=>widget.id)}});};
  return <section className="apps-module-config" aria-label="展示配置">
    <div className="apps-config-heading"><h3>展示配置</h3><span>直接调整，即时预览</span></div>
    <div className="apps-module-add" aria-label="追加现有模块"><span>追加模块</span>{choices.map(material=><button type="button" key={material.id} onClick={()=>insertModule(material.id)}>＋ {material.title}</button>)}</div>
    {spec.widgets.length>1?<label className="apps-config-label"><span>模块布局</span><select aria-label="模块布局" value={spec.layout.type==='grid'&&spec.layout.columns===2?'two':'one'} onChange={event=>onChange({...spec,layout:{type:'grid',columns:event.target.value==='two'?2:1,gap:16,children:spec.widgets.map(widget=>widget.id)}})}><option value="two">左右排列</option><option value="one">上下排列</option></select></label>:null}
    {spec.widgets.map((widget,widgetIndex)=>{
      const source=sources[widget.bindingId??'main'],columns=widgetColumns(widget),material=getMaterial(widgetMaterialId(widget));
      return <fieldset key={widget.id} className="apps-widget-config"><legend>{widget.title??material?.title??'组件'}</legend>
        <label className="apps-config-label"><span>模块类型</span><select aria-label={`${widget.title??'组件'}模块类型`} value={widgetMaterialId(widget)} onChange={event=>insertModule(event.target.value,widget.id)}>{choices.map(material=><option key={material.id} value={material.id}>{material.title}</option>)}</select></label>
        {widget.type==='sku_detail'?<label className="apps-config-label"><span>商品来源</span><select aria-label={`${widget.title??'SKU 明细'}跟随商品列表`} value={spec.links?.find(link=>link.to.bindingId===widget.bindingId)?.from.widgetId??''} onChange={event=>{const links=(spec.links??[]).filter(link=>link.to.bindingId!==widget.bindingId),parameter=sources[widget.bindingId??'']?.parameters.find(parameter=>parameter.linked)?.name??'productId';if(event.target.value)links.push({from:{widgetId:event.target.value,event:'select',field:'product.id'},to:{bindingId:widget.bindingId!,param:parameter}});compose(spec.widgets,spec.bindings,links);}}><option value="">独立读取指定商品</option>{spec.widgets.filter(item=>item.type==='product_list').map((item,index)=><option key={item.id} value={item.id}>{item.title??'商品列表'}{spec.widgets.filter(candidate=>candidate.type==='product_list').length>1?` ${index+1}`:''}</option>)}</select></label>:null}
        <div className="apps-config-inline"><label className="apps-config-label"><span>内容密度</span><select aria-label={`${widget.title??'组件'}内容密度`} value={String(widget.options?.density??'comfortable')} onChange={event=>changeWidget(widget.id,{options:{...widget.options,density:event.target.value}})}><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label>{spec.widgets.length>1?<><button type="button" aria-label={`前移${widget.title??'模块'}`} disabled={widgetIndex===0} onClick={()=>moveWidget(widgetIndex,-1)}>↑</button><button type="button" aria-label={`后移${widget.title??'模块'}`} disabled={widgetIndex===spec.widgets.length-1} onClick={()=>moveWidget(widgetIndex,1)}>↓</button><button type="button" className="apps-danger-text" onClick={()=>removeWidget(widget.id)}>移除此模块</button></>:null}</div>

      </fieldset>;
    })}
  </section>;
}

export function QueryParameters({source,params,onChange,linked=false,hideLimit=false}:{source:DataSourceDefinition;params:Record<string,JsonValue>;onChange:(params:Record<string,JsonValue>)=>void;linked?:boolean;hideLimit?:boolean}){
  const parameters=source.parameters.filter(parameter=>parameter.editable!==false&&parameter.name!=='storeId'&&(!hideLimit||parameter.name!=='limit')&&parameter.name!==source.operations.pagination?.cursorParam&&!(linked&&parameter.linked)&&!(source.capabilityId===PROCUREMENT_CAPABILITY&&(['query','cursor','limit','loadAll',...PROCUREMENT_PLAN_FIELDS] as string[]).includes(parameter.name)));
  if(!parameters.length)return null;
  return <fieldset className="apps-query-config"><legend>本次查看范围</legend>{parameters.map(parameter=>{
    const value=params[parameter.name]??parameter.default??source.input[parameter.name];
    const choices=parameter.choices;
    return <label className="apps-config-label" key={parameter.name}><span>{parameter.label}{parameter.required?<small> 必填</small>:null}</span>{choices!==undefined?<select aria-label={parameter.label} value={value===undefined||value===null?'':String(value)} onChange={event=>{const next={...params};if(event.target.value===''&&!parameter.required)delete next[parameter.name];else{const choice=choices.find(choice=>String(choice.value)===event.target.value);if(!choice)return;next[parameter.name]=choice.value;}onChange(next);}}><option value="" disabled={parameter.required}>{parameter.required?'请选择':'全部'}</option>{choices.map(choice=><option key={String(choice.value)} value={String(choice.value)}>{choice.label}</option>)}</select>:parameter.type==='boolean'?<select aria-label={parameter.label} value={String(value??false)} onChange={event=>onChange({...params,[parameter.name]:event.target.value==='true'})}><option value="true">是</option><option value="false">否</option></select>:<input aria-label={parameter.label} type={['dateFrom','dateTo'].includes(parameter.name)?'date':['number','integer'].includes(parameter.type)?'number':'text'} step={parameter.type==='integer'?1:'any'} value={typeof value==='string'||typeof value==='number'?value:''} onChange={event=>{const next={...params};if(event.target.value==='')delete next[parameter.name];else next[parameter.name]=['number','integer'].includes(parameter.type)?Number(event.target.value):event.target.value;onChange(next);}}/>}</label>;
  })}</fieldset>;
}
