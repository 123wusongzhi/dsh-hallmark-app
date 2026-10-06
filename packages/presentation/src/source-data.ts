import type {ToolResult} from '../../contracts/src/index.ts';
import type {ViewSpec} from './types.ts';

export interface SourceDataLoad {bindingId:string;datasetKey:string;status:string;error?:ToolResult['error']}
/** Opening a source view loads only its declared queries without successful snapshots. It never invents a data scope. */
export async function hydrateSourceBindings(spec:ViewSpec,readData:(id:string)=>unknown,refresh?:(datasetKey:string)=>Promise<ToolResult>):Promise<SourceDataLoad[]> {
 if(spec.kind!=='source'||!refresh)return [];
 const snapshot=readData(spec.id) as {data?:{bindings?:{bindingId:string}[]}}|undefined;
 const present=new Set(snapshot?.data?.bindings?.map(binding=>binding.bindingId)??[]),loads:SourceDataLoad[]=[],requests=new Map<string,Promise<ToolResult>>();
 for(const binding of spec.bindings){
  if(!binding.query||!binding.datasetKey||present.has(binding.id))continue;
  let request=requests.get(binding.datasetKey);
  if(!request){request=refresh(binding.datasetKey).catch(error=>({status:'failed' as const,error:{code:'SOURCE_INITIAL_DATA_FAILED',message:error instanceof Error?error.message:'首次数据读取失败，可稍后刷新重试。',retryable:true}}));requests.set(binding.datasetKey,request);}
  const result=await request;
  loads.push({bindingId:binding.id,datasetKey:binding.datasetKey,status:result.status,...(result.error?{error:result.error}:{})});
 }
 return loads;
}
