import type {AppsView} from '../../app-presentation/src/types.ts';
import {appsApiError} from './api.ts';

/** A 304 has no JSON body; its ETag is usable only with this session's retained snapshot. */
export async function readViewsCollection(sessionId:string,signal:AbortSignal,etag?:string):Promise<{unchanged:true;etag?:string}|{unchanged:false;views:AppsView[];etag?:string}> {
  const response=await fetch(`/api/dsh-apps?${new URLSearchParams({resource:'views',sessionId})}`,{credentials:'same-origin',signal,headers:etag?{'If-None-Match':etag}:undefined});
  if(response.status===304){if(!etag)throw new Error('组件目录返回了未匹配的缓存版本。');return {unchanged:true,etag:response.headers.get('ETag')??etag};}
  const value=await response.json();if(!response.ok||value?.status==='failed')throw appsApiError(value,response.status,'Apps Runtime暂不可用。');
  if(!Array.isArray(value?.views))throw new Error('组件目录缺少有效视图列表。');
  return {unchanged:false,views:value.views.filter((view:AppsView)=>view.ownerSessionId===sessionId),etag:response.headers.get('ETag')??undefined};
}
