import type {AppsRuntime} from '../../app-runtime/src/index.ts';
import type {AppsComponent} from '../../app-presentation/src/index.ts';

export interface ComponentFavorite {
  componentId:string;
  appId:string;
  title:string;
  revision:number;
  hasPreview:boolean;
  createdAt:string;
  available:boolean;
}
export interface ComponentFavorites {sessionId:string;favorites:ComponentFavorite[]}
interface FavoriteReference {componentId:string;createdAt:string}
interface FavoriteRecord {kind:'component-favorites';items:FavoriteReference[]}

const recordId='component-favorites:profile';
const fail=(code:string,message:string,statusCode=400):never=>{throw Object.assign(new Error(message),{code,statusCode});};
function session(value:unknown):string {
  if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,160}$/.test(value))fail('INVALID_SESSION','请先打开本次会话。');
  return value as string;
}
function componentId(value:unknown):string {
  if(typeof value!=='string'||!/^[-a-zA-Z0-9_.:]{1,180}$/.test(value))fail('INVALID_INPUT','组件编号无效。');
  return value as string;
}

/** Each Runtime database belongs to one local profile. Favorites contain references only;
 * they never save a draft, create a source checkout, bind a session or read business data. */
export function componentFavorites(runtime:AppsRuntime) {
  const readReferences=()=>runtime.store.get<FavoriteRecord>('saved_assets',recordId)?.items??[];
  const availability=(component:AppsComponent)=>{
    for(const binding of component.view.bindings){
      const connection=runtime.getConnection(binding.appId,binding.connectionId);
      if(!connection)return {code:'SAVED_CONNECTION_MISSING',message:'组件原有的数据连接已不存在，请恢复连接后再收藏。'};
      if(!connection.enabled)return {code:'SAVED_CONNECTION_DISABLED',message:'组件原有的数据连接已停用，请启用连接后再收藏。'};
    }
    return undefined;
  };
  const list=(sessionId:unknown):ComponentFavorites=>{
    const selectedSession=session(sessionId),favorites:ComponentFavorite[]=[];
    // One small reference record and exact component lookups; never scan source or cache tables.
    for(const reference of readReferences()){
      const component=runtime.store.get<AppsComponent>('components',reference.componentId);
      if(!component)continue;
      const appIds=[...new Set(component.view.bindings.map(binding=>binding.appId))];
      favorites.push({componentId:component.componentId,appId:appIds.length===1?appIds[0]:'apps',title:component.title,revision:component.revision,hasPreview:!!component.view.source?.preview&&!!component.view.source?.thumbnail,createdAt:reference.createdAt,available:!availability(component)});
    }
    return {sessionId:selectedSession,favorites};
  };
  return {
    list,
    set(input:Record<string,unknown>):ComponentFavorites {
      if(Object.keys(input).some(key=>!['sessionId','componentId','favorite'].includes(key))||typeof input.favorite!=='boolean')fail('INVALID_INPUT','收藏参数无效。');
      const sessionId=session(input.sessionId),id=componentId(input.componentId);
      return runtime.store.transaction(()=>{
        const references=readReferences(),existing=references.some(reference=>reference.componentId===id);
        if(input.favorite){
          const component=runtime.store.get<AppsComponent>('components',id);
          if(!component)fail('COMPONENT_NOT_FOUND','组件已从素材库移除，请重新选择。',404);
          const problem=availability(component!);if(problem)fail(problem.code,problem.message,409);
          if(!existing)runtime.store.put<FavoriteRecord>('saved_assets',recordId,{kind:'component-favorites',items:[...references,{componentId:id,createdAt:new Date().toISOString()}]});
        }else if(existing){
          runtime.store.put<FavoriteRecord>('saved_assets',recordId,{kind:'component-favorites',items:references.filter(reference=>reference.componentId!==id)});
        }
        return list(sessionId);
      });
    },
  };
}
