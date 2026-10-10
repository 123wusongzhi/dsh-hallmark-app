import React,{useEffect,useState} from 'react';
import type {JsonValue} from '../../app-contracts/src/index.ts';

export const PROCUREMENT_CAPABILITY='hallmark.products.procurement';
export const PROCUREMENT_PLAN_FIELDS=['planMode','deliveryMethodId','fixedFeeYuan','logisticsYuanPerKg','commissionPercent'] as const;
export interface ProcurementPlan {mode:'application'|'delivery'|'platform'|'custom';label?:string;reason?:string|null;settingsRevision?:number|null;deliveryMethodId?:string|null;fixedFeeYuan?:number|null;logisticsYuanPerKg?:number|null;commissionPercent?:number|null;choices?:{id:string;name:string;warehouseId?:string;warehouseName?:string|null;active:boolean}[];selectionNote?:string}
export interface ProcurementResultSummary {total:number;calculated:number;pending:number}
/** Count the returned profit values, never draft inputs or a completed save request. */
export function procurementResultSummary(products:unknown):ProcurementResultSummary|undefined{
  if(!Array.isArray(products))return undefined;
  const calculated=products.filter(product=>typeof product?.referenceProfit?.margin==='number'&&Number.isFinite(product.referenceProfit.margin)).length;
  return {total:products.length,calculated,pending:products.length-calculated};
}
type PlanDraft={mode:ProcurementPlan['mode'];deliveryMethodId:string;fixedFeeYuan:string;logisticsYuanPerKg:string;commissionPercent:string};
const numericFields=['fixedFeeYuan','logisticsYuanPerKg','commissionPercent'] as const;
const fields=[{key:'fixedFeeYuan',label:'固定费用',unit:'元 / 件',max:1_000_000,decimals:2},{key:'logisticsYuanPerKg',label:'每公斤运费',unit:'元 / kg',max:100_000,decimals:3},{key:'commissionPercent',label:'佣金比例',unit:'%',max:99.9999,decimals:4}] as const;
const numberText=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?String(value):'';
const modeOf=(params:Record<string,JsonValue>):ProcurementPlan['mode']=>params.planMode==='platform'||params.planMode==='custom'||params.planMode==='delivery'?params.planMode:'application';
const seed=(params:Record<string,JsonValue>,plan?:ProcurementPlan):PlanDraft=>{const mode=modeOf(params),id=typeof params.deliveryMethodId==='string'?params.deliveryMethodId:'';return {mode,deliveryMethodId:id,...Object.fromEntries(numericFields.map(key=>[key,numberText(params[key]??(mode!=='delivery'||id&&plan?.mode==='delivery'&&plan.deliveryMethodId===id?plan?.[key]:undefined))]))} as PlanDraft;};

/** Delivery ids and their explicit rates belong to a shop; uniform trials do not. */
export function procurementParametersForStore(params:Record<string,JsonValue>):Record<string,JsonValue>{
  if(modeOf(params)!=='delivery')return params;
  const next={...params};delete next.deliveryMethodId;for(const key of numericFields)delete next[key];return next;
}

/** Only explicit, complete custom fees enter a source request; zero is a valid fee. */
export function procurementPlanParameters(params:Record<string,JsonValue>,draft:PlanDraft):Record<string,JsonValue>|undefined{
  const next={...params};for(const key of PROCUREMENT_PLAN_FIELDS)delete next[key];
  next.planMode=draft.mode;
  if(draft.mode==='application'||draft.mode==='platform')return next;
  if(draft.mode==='delivery'){if(!draft.deliveryMethodId)return next;next.deliveryMethodId=draft.deliveryMethodId;if(numericFields.every(key=>!draft[key].trim()))return next;}
  for(const field of fields){const text=draft[field.key].trim(),value=Number(text);if(!text||!Number.isFinite(value)||value<0||value>field.max||Number(value.toFixed(field.decimals))!==value)return undefined;next[field.key]=value;}
  return next;
}

/** Plan changes remain a draft until applied. The result label always describes actual rows. */
export function ProcurementPlanControls({params,plan,resultSummary,fullDataset=false,resultLoading=false,resultStale=false,disabled=false,onApply}:{params:Record<string,JsonValue>;plan?:ProcurementPlan;resultSummary?:ProcurementResultSummary;fullDataset?:boolean;resultLoading?:boolean;resultStale?:boolean;disabled?:boolean;onApply:(params:Record<string,JsonValue>)=>void|Promise<void>}){
  const [draft,setDraft]=useState<PlanDraft>(()=>seed(params,plan)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [feesOpen,setFeesOpen]=useState(()=>draft.mode==='custom'||draft.mode==='delivery'&&!!draft.deliveryMethodId&&numericFields.some(key=>!draft[key].trim()));
  const identity=JSON.stringify(PROCUREMENT_PLAN_FIELDS.map(key=>params[key])),planIdentity=JSON.stringify(plan);
  useEffect(()=>{setDraft(seed(params,plan));setError('');},[identity]);
  useEffect(()=>{if(plan)setDraft(current=>current.mode==='platform'?seed(params,plan):current.mode==='delivery'?current:({...current,...Object.fromEntries(numericFields.filter(key=>current[key]==='').map(key=>[key,numberText(plan[key])]))}));},[planIdentity]);
  useEffect(()=>{setFeesOpen(draft.mode==='custom'||draft.mode==='delivery'&&!!draft.deliveryMethodId&&numericFields.some(key=>!draft[key].trim()));},[draft.mode,draft.deliveryMethodId]);
  const choices=plan?.choices??[],knownChoice=!draft.deliveryMethodId||choices.some(choice=>String(choice.id)===draft.deliveryMethodId&&choice.active);
  const next=draft.mode==='delivery'&&!knownChoice?undefined:procurementPlanParameters(params,draft),applied=procurementPlanParameters(params,seed(params,plan)),changed=!!next&&JSON.stringify(next)!==JSON.stringify(applied),pending=draft.mode!==modeOf(params)||draft.deliveryMethodId!==seed(params,plan).deliveryMethodId||numericFields.some(key=>draft[key]!==seed(params,plan)[key]);
  const channelOnly=draft.mode==='delivery'&&(!next||numericFields.some(key=>typeof next[key]!=='number'));
  const waiting=busy||disabled||resultLoading;
  const missingAppliedFees=plan?.mode==='delivery'&&!!plan.deliveryMethodId&&plan.choices?.some(choice=>choice.id===plan.deliveryMethodId&&choice.active)&&numericFields.some(key=>typeof plan[key]!=='number')&&(!plan.reason||/^所选物流方案费用待补充。?$/.test(plan.reason));
  const resultMessage=waiting?'正在读取试算结果…':plan&&resultSummary?[
    resultStale?'当前为缓存结果。':'',
    missingAppliedFees?'渠道已应用，费用待补充。':plan.reason?`${plan.reason} `:'',
    resultSummary.total?`${fullDataset?`共 ${resultSummary.total} 件 ·`:'本批'} ${resultSummary.calculated} 件已算 · ${resultSummary.pending} 件待补充${resultSummary.pending?'，请查看表格“参考利润率”下方原因。':'。'}`:fullDataset?'暂无在售商品。':'本批没有符合条件的商品。',
  ].join(''):undefined;
  const apply=async(parameters=next)=>{if(!parameters||disabled||busy)return;setBusy(true);setError('');try{await onApply(parameters);}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setBusy(false);}};
  return <section className="apps-procurement-plan" aria-label="物流试算方案">
    <style>{`.apps-procurement-plan{margin:0 0 14px;padding:12px 14px;border:1px solid #dce8f7;border-radius:12px;background:#f7faff;color:#304761}.apps-procurement-plan-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.apps-procurement-plan-main label{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:600}.apps-procurement-plan select,.apps-procurement-plan input{background:#fff;border:1px solid #cfdef0;border-radius:7px;padding:7px 9px;color:inherit}.apps-procurement-plan-current{font-size:12px;color:#60748e;margin-left:auto}.apps-procurement-plan-pending{font-size:12px;color:#94671e}.apps-procurement-plan details{margin-top:10px;font-size:12px}.apps-procurement-plan summary{cursor:pointer;color:#4779b9}.apps-procurement-plan-fields{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px}.apps-procurement-plan-fields label{display:grid;gap:6px;font-size:12px}.apps-procurement-plan-fields label span:last-child{display:flex;align-items:center;gap:6px;color:#637890}.apps-procurement-plan-fields input{width:105px}.apps-procurement-plan-note{margin:9px 0 0;font-size:12px;color:#74869b}.apps-procurement-plan-legacy{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 12px;border-left:3px solid #ce9742;background:#fff7e9;font-size:12px;color:#795826}.apps-procurement-plan-legacy p{margin:0;line-height:1.6}.apps-procurement-plan-legacy button{flex-shrink:0;border:1px solid #dab471;border-radius:6px;background:#fff;padding:7px 10px;color:inherit;cursor:pointer}.apps-procurement-plan-legacy button:disabled{opacity:.45;cursor:default}.apps-procurement-plan-apply{border:0;border-radius:7px;background:#2472ec;color:white;padding:8px 12px;cursor:pointer}.apps-procurement-plan-apply:disabled{opacity:.45;cursor:default}`}</style>
    <div className="apps-procurement-plan-main"><label>物流方案<select aria-label="物流方案" value={draft.mode} disabled={disabled||busy} onChange={event=>{const mode=event.target.value as PlanDraft['mode'];setDraft(current=>({...current,mode,...(mode==='delivery'?{fixedFeeYuan:'',logisticsYuanPerKg:'',commissionPercent:''}:{})}));setError('');}}><option value="application">应用动态利润规则</option><optgroup label="高级参考试算"><option value="delivery">按接口匹配物流（旧方式）</option><option value="platform">原平台统一费率</option><option value="custom">自定义试算</option></optgroup></select></label>
      {draft.mode==='delivery'?<label>物流渠道<select aria-label="物流渠道" value={draft.deliveryMethodId} disabled={disabled||busy} onChange={event=>setDraft(current=>({...current,deliveryMethodId:event.target.value,fixedFeeYuan:'',logisticsYuanPerKg:'',commissionPercent:''}))}><option value="">自动匹配</option>{draft.deliveryMethodId&&!choices.some(choice=>String(choice.id)===draft.deliveryMethodId)?<option value={draft.deliveryMethodId} disabled>原渠道暂不可用</option>:null}{choices.map(choice=><option key={choice.id} value={String(choice.id)} disabled={!choice.active}>{choice.name}{(choice.warehouseName||choice.warehouseId)?` · ${choice.warehouseName||choice.warehouseId}`:''}{choice.active?'':'（不可用）'}</option>)}</select></label>:null}
      {pending?<span className="apps-procurement-plan-pending">待应用</span>:null}<span className="apps-procurement-plan-current">{plan?`当前结果：${plan.label||(plan.mode==='application'?'应用动态利润规则':plan.mode==='custom'?'自定义试算':plan.mode==='delivery'?'自动匹配物流方案':'平台统一费率试算')}`:'读取方案后显示试算结果'}</span>
      <button className="apps-procurement-plan-apply" type="button" disabled={disabled||busy||resultLoading||!next||!changed} onClick={()=>void apply()}>{busy?'正在应用…':channelOnly?'应用渠道':'应用试算'}</button></div>
    {resultMessage?<p className="apps-procurement-plan-note" role="status">{resultMessage}</p>:null}
    {plan&&plan.mode!=='application'?<div className="apps-procurement-plan-legacy"><p>当前结果使用{plan.mode==='custom'?'自定义参考费用':plan.mode==='delivery'?'原渠道试算方式':'原平台统一费率'}，仅为参考试算，尚未使用「经营设置」中的动态利润规则计算应用当前利润。</p><button type="button" disabled={waiting} onClick={()=>void apply(procurementPlanParameters(params,{...draft,mode:'application'}))}>改用应用动态规则</button></div>:null}
    {draft.mode==='application'?<p className="apps-procurement-plan-note">本应用独立维护规则，按每件商品的实际卖家售价和计费重量选择物流方案；条件重合时按总费用较高的方案计算。规则在「经营设置」维护。{plan?.mode==='application'&&plan.settingsRevision!=null?` 当前结果使用修订 ${plan.settingsRevision}。`:''}</p>:null}
    {plan?.mode==='application'&&plan.selectionNote?<p className="apps-procurement-plan-note">{plan.selectionNote}</p>:null}
    {draft.mode==='delivery'?<p className="apps-procurement-plan-note">接口提供物流渠道，未提供运价。{draft.deliveryMethodId?'补充下方费用后才能试算利润。':'选择具体渠道并补充费用后才能试算利润。'}</p>:null}
    {draft.mode!=='application'&&(draft.mode!=='delivery'||draft.deliveryMethodId)?<details key={`${draft.mode}:${draft.deliveryMethodId}`} open={feesOpen} onToggle={event=>setFeesOpen(event.currentTarget.open)}><summary>{draft.mode==='custom'?'编辑费用':draft.mode==='delivery'?'补充该方案费用':'查看费用明细'}</summary><div className="apps-procurement-plan-fields">{fields.map(field=><label key={field.key}><span>{field.label}</span><span>{draft.mode!=='platform'?<input aria-label={field.label} type="number" min="0" max={field.max} step={10**-field.decimals} placeholder="请填写" value={draft[field.key]} disabled={disabled||busy} onChange={event=>setDraft(current=>({...current,[field.key]:event.target.value}))}/>:<strong>{numberText(plan?.[field.key])||'待读取'}</strong>}{field.unit}</span></label>)}</div><p className="apps-procurement-plan-note">{!next?'请补全有效费用：固定费最多 2 位小数，运费 3 位，佣金 4 位且小于 100%。':draft.mode==='delivery'?'未填费用时只应用渠道；请按该渠道填写固定费用、每公斤运费和佣金比例。':'按人民币采购报价试算，仅用于当前组件。'}</p></details>:null}
    {error?<p className="apps-procurement-plan-note" role="alert">{error}</p>:null}
  </section>;
}
