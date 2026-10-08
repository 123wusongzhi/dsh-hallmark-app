import type {Dataset} from './data';
/** Agent maps the actual viewData binding here; no demo data is shipped to the plugin component. */
export function mapData(data:unknown):Dataset {
 const input=data as Partial<Dataset>|undefined;
 return {items:Array.isArray(input?.items)?input.items:[],total:input?.total??input?.items?.length??0,currency:input?.currency??'CNY',period:input?.period??'',comparisonPeriod:input?.comparisonPeriod,note:input?.note};
}
