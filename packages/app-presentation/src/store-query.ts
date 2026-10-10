import type {PresentationStore} from './types.ts';

/** Keep small in-memory ports compatible while production SQLite filters before parsing. */
export function queryRows<T>(store:PresentationStore,collection:string,filters:Record<string,string|number|boolean|null>):T[] {
  if(store.query)return store.query<T>(collection,filters);
  return store.list<T>(collection).filter(row=>Object.entries(filters).every(([path,expected])=>{
    const actual=path.split('.').reduce<unknown>((value,key)=>value!==null&&typeof value==='object'&&Object.hasOwn(value,key)?(value as Record<string,unknown>)[key]:undefined,row);
    return actual===expected;
  }));
}
