import { REAL_SOURCE_SUMMARIES, REAL_SOURCE_IMAGE_DATA } from 'REAL_SOURCE_DATA';
export const SOURCE_NAMES=[...new Set(REAL_SOURCE_SUMMARIES.map(row=>row.sourceLabel))];
export const TYPE_NAMES=REAL_SOURCE_SUMMARIES.map(row=>row.title);
// Intentional invalid-byte fault; ordinary image delivery uses captured marketplace pixels.
export const BROKEN_IMAGE='data:image/png;base64,bm90LWFuLWltYWdl';
export const imageFor=(index:number)=>REAL_SOURCE_IMAGE_DATA[REAL_SOURCE_SUMMARIES[index%REAL_SOURCE_SUMMARIES.length].id];
export type FixtureRecord={key:string;row:Record<string,any>;identity:{kind:'collected_item';itemId:string};oracle:{index:number;title:string;source:string;timestamp?:number;date?:string;timeLabel:string}};
export function createRecords(size:number):FixtureRecord[]{
 if(size!==48&&size!==500)throw Error('Supported fixture sizes are 48 and 500');
 // Explicit load replay: original field values survive; duplicated records get derived IDs.
 return Array.from({length:size},(_,i)=>{
  const row:Record<string,any>=structuredClone(REAL_SOURCE_SUMMARIES[i%REAL_SOURCE_SUMMARIES.length]);
  if(i>=REAL_SOURCE_SUMMARIES.length)row.id=`${row.id}:repeat-${Math.floor(i/REAL_SOURCE_SUMMARIES.length)}`;
  const source=row.sourceLabel,title=row.title,date=row.importedAt,timestamp=date?Date.parse(date):undefined;
  if(imageFor(i))row.mainImage=imageFor(i);
  return{key:`snapshot-key-${i}`,row,identity:{kind:'collected_item',itemId:row.id},oracle:{index:i,title,source,timestamp,date,timeLabel:'导入时间'}};
 });
}
export function fixtureData(records:FixtureRecord[],revision='real-replay-r1'){
 return{bindings:[{bindingId:'collected',datasetKey:'real-replay-loaded',payload:{items:records.map(x=>x.row)},state:'ready',provenance:{source:'real_source_corpus',projection:'explicit repeated-record load with authentic captured pixels'},lastSuccessAt:REAL_SOURCE_SUMMARIES[0].importedAt}],selection:[{bindingId:'collected',eligible:true,rows:records.map(({key,row,identity})=>({key,row,identity}))}],revision};
}
export const FIXTURE_CONTEXT={sessionId:'fixture-session',viewId:'fixture-view',buildId:'fixture-build',theme:'light',preview:true,attachment:{available:true}};
