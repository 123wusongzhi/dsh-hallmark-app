const labels:Record<string,string>={on_sale:'在售',out_of_stock:'无库存',pending:'审核／处理中',archived:'已归档',failed:'发布失败',not_sellable:'暂不可售',unknown:'状态待确认'};
export const listingRecordLabels:Record<string,string>={found:'本店有上品记录',not_found:'本店无上品记录',unavailable:'记录暂不可查'};
export function filterCollectionRecords<T extends {listedIn?:unknown}>(rows:T[],storeId:string,record:string):T[]{
 if(!storeId||!record)return rows;
 return rows.filter(row=>{const state=Array.isArray(row.listedIn)?row.listedIn.find(s=>s?.storeId===storeId):undefined;return (state?.listingRecord??'unavailable')===record;});
}

/** The UI displays the provider's status counts; it never infers listings from titles. */
export function collectionStatusLines(value:unknown):Array<{key:string;text:string;detail:string}>{
 if(!Array.isArray(value))return [];
 return value.filter(state=>state&&typeof state==='object').map(state=>{
  const store=String(state.storeName??state.storeId??'店铺'),counts=state.saleStates??{};
  const parts=Object.entries(labels).flatMap(([key,label])=>Number.isInteger(counts[key])&&counts[key]>0?[`${label} ${counts[key]}`]:[]);
  const stale=state.freshness==='stale',recordLabel=listingRecordLabels[state.listingRecord],summary=recordLabel?[recordLabel,...parts,...(state.savedListingCount?[`已保存上品行 ${state.savedListingCount}`]:[])].join(' · '):parts.length?parts.join(' · '):state.association==='none'?'尚无商品关联':'关联待确认';
  const date=typeof state.observedAt==='string'?new Date(state.observedAt):null,time=date&&Number.isFinite(date.getTime())?date.toLocaleString('zh-CN',{hour12:false}):'尚未取得';
  return {key:String(state.storeId??store),text:`${store}：${stale?'待刷新 · ':''}${summary}`,detail:`按销售商品计数；归档不删除采购关联。有记录包含保存的草稿；无记录不证明历史从未上架。${state.listingRecord==='unavailable'?`原因：${state.listingRecordReason??'RECORD_SOURCE_UNAVAILABLE'}。`:''}最近同步：${time}`};
 });
}
