import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { BindingData, ViewSpec } from '../../presentation/src/types.ts';
import { buildProductSelection, selectionInputBridge } from './selection.ts';
import type { AttachSelectionResult, ProductSelectionInput } from './selection.ts';

export interface ProductSelectionActions {
  sessionId:string;viewId:string;available:boolean;disabledReason?:string;
  attach:(input:ProductSelectionInput)=>AttachSelectionResult;
}
const SelectionContext=createContext<ProductSelectionActions|undefined>(undefined);
export const useProductSelection=()=>useContext(SelectionContext);

export function ProductSelectionProvider({sessionId,spec,data,disabled=false,children}:{sessionId:string;spec:ViewSpec;data:BindingData[];disabled?:boolean;children:React.ReactNode}){
  const revision=useSyncExternalStore(selectionInputBridge.subscribe,selectionInputBridge.getSnapshot,selectionInputBridge.getSnapshot);
  const value=useMemo<ProductSelectionActions>(()=>{
    const state=disabled?{available:false,disabledReason:'数据正在刷新，请完成后重新选择。'}:selectionInputBridge.availability(sessionId);
    return {sessionId,viewId:spec.id,...state,attach:input=>{
      if(!state.available)return {ok:false,message:state.disabledReason??'原聊天输入框未就绪。'};
      if(!input.data||!data.includes(input.data))return {ok:false,message:'数据快照已经变化，请重新选择。'};
      try{return selectionInputBridge.attach(sessionId,buildProductSelection(sessionId,spec,input));}
      catch(error){return {ok:false,message:error instanceof Error?error.message:'选择校验失败。'};}
    }};
  },[sessionId,spec,data,disabled,revision]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}
