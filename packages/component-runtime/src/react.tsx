import {useCallback,useEffect,useRef,useState} from 'react';
import {createHallmarkClient} from './client.ts';
import type {SourceAttachRequest,SourceClient,SourceContext,SourceData} from './client.ts';
export {useApps} from './apps-react.tsx';

/** React is optional: other frameworks can use createHallmarkClient directly. */
export function useHallmark(){
  const client=useRef<SourceClient>();
  const [data,setData]=useState<SourceData>();const [context,setContext]=useState<SourceContext>();
  const [loading,setLoading]=useState(true);const [error,setError]=useState<string>();
  useEffect(()=>{
    const connection=createHallmarkClient();client.current=connection;let active=true;
    const unsubscribe=connection.subscribe(event=>{if(!active)return;if(event.event==='data')setData(event.data);else setContext(event.data);});
    Promise.all([connection.getData(),connection.getContext()]).then(([nextData,nextContext])=>{if(active){setData(nextData);setContext(nextContext);setError(undefined);}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:String(reason));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;unsubscribe();connection.dispose();if(client.current===connection)client.current=undefined;};
  },[]);
  const refresh=useCallback(async()=>{if(!client.current)throw new Error('组件宿主尚未连接。');const connection=client.current;setLoading(true);setError(undefined);try{const next=await connection.refresh();if(client.current===connection)setData(next);return next;}catch(reason){if(client.current===connection)setError(reason instanceof Error?reason.message:String(reason));throw reason;}finally{if(client.current===connection)setLoading(false);}},[]);
  const attachSelection=useCallback((request:SourceAttachRequest)=>{if(!client.current)return Promise.reject(new Error('组件宿主尚未连接。'));return client.current.attachSelection({...request,revision:request.revision??data?.revision});},[data?.revision]);
  const resize=useCallback((height:number)=>client.current?.resize(height),[]);
  return {data,context,loading,error,refresh,attachSelection,resize};
}
