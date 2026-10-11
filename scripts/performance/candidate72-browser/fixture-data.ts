export const SOURCE_NAMES=['1688','淘宝 / 天猫','AliExpress','本地导入'];
export const TYPE_NAMES=['Lamp 台灯','收纳 Storage','MUG 茶杯','Cable 线材','挂钩 Hook','厨房 Kitchen'];
export const BROKEN_IMAGE='data:image/png;base64,bm90LWFuLWltYWdl';
export const imageFor=(index:number)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="10" fill="#e5eefc"/><circle cx="40" cy="32" r="16" fill="#7098d8"/><path d="M24 62h32" stroke="#355e9e" stroke-width="5"/><text x="40" y="76" text-anchor="middle" font-size="9" fill="#355e9e">${index}</text></svg>`);
export type FixtureRecord={key:string;row:Record<string,any>;identity:{kind:'collected_item';itemId:string};oracle:{index:number;title:string;source:string;timestamp?:number;date?:string;timeLabel:string}};
export function createRecords(size:number):FixtureRecord[]{
 if(size!==48&&size!==500)throw Error('Supported fixture sizes are 48 and 500');
 return Array.from({length:size},(_,i)=>{
  const source=SOURCE_NAMES[i%SOURCE_NAMES.length],title=`${TYPE_NAMES[i%TYPE_NAMES.length]} 商品 ${String(i).padStart(3,'0')}${i%11===0?' · 加长款 多规格 适用于办公与居家使用'.repeat(2):''}`;
  const timestamp=i%13===0||i%17===0?undefined:Date.UTC(2026,9,1)+((i*37)%97)*60000;
  const date=timestamp===undefined?(i%17===0?'invalid-date':undefined):new Date(timestamp).toISOString();
  const row:Record<string,any>={id:`item-${i}`,title,sourceLabel:source,skuCount:(i%7)+1};
  if(date!==undefined)row[i%3===0?'collectedAt':i%3===1?'importedAt':'createdAt']=date;
  if(i%9!==0){row.minPrice=12+(i%81)/10;row.currency=i%5===0?'USD':'CNY';if(i%7===0)row.maxPrice=row.minPrice+3;}
  if(i%4===0)row.mainImage=imageFor(i);
  return{key:`snapshot-key-${i}`,row,identity:{kind:'collected_item',itemId:`item-${i}`},oracle:{index:i,title,source,timestamp,date,timeLabel:date===undefined?'导入时间':i%3===0?'采集时间':i%3===1?'导入时间':'创建时间'}};
 });
}
export function fixtureData(records:FixtureRecord[],revision='synthetic-r1'){
 return{bindings:[{bindingId:'collected',datasetKey:'synthetic-loaded',payload:{items:records.map(x=>x.row)},state:'ready',provenance:{fixture:true},lastSuccessAt:'2026-10-10T00:00:00Z'}],selection:[{bindingId:'collected',eligible:true,rows:records.map(({key,row,identity})=>({key,row,identity}))}],revision};
}
export const FIXTURE_CONTEXT={sessionId:'fixture-session',viewId:'fixture-view',buildId:'fixture-build',theme:'light',preview:true,attachment:{available:true}};
