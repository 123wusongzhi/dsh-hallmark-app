const labels:Record<string,string>={on_sale:'在售',out_of_stock:'无库存',pending:'审核／处理中',archived:'已归档',failed:'发布失败',not_sellable:'暂不可售',unknown:'状态待确认'};

/** The UI displays the provider's status counts; it never infers listings from titles. */
export function collectionStatusLines(value:unknown):Array<{key:string;text:string;detail:string}>{
 if(!Array.isArray(value))return [];
 return value.filter(state=>state&&typeof state==='object').map(state=>{
  const store=String(state.storeName??state.storeId??'店铺'),counts=state.saleStates??{};
  const parts=Object.entries(labels).flatMap(([key,label])=>Number.isInteger(counts[key])&&counts[key]>0?[`${label} ${counts[key]}`]:[]);
  const stale=state.freshness==='stale',summary=parts.length?parts.join(' · '):state.association==='none'?'尚无商品关联':'关联待确认';
  const date=typeof state.observedAt==='string'?new Date(state.observedAt):null,time=date&&Number.isFinite(date.getTime())?date.toLocaleString('zh-CN',{hour12:false}):'尚未取得';
  return {key:String(state.storeId??store),text:`${store}：${stale?'待刷新 · ':''}${summary}`,detail:`按销售商品计数；归档不删除采购关联。最近同步：${time}`};
 });
}
