import type {RuntimeHealthSnapshot} from './runtime-health.ts';

export interface ConnectionStatus {
  state:'connected'|'degraded'|'disconnected'|'unknown';
  checkedAt:string;
  node:RuntimeHealthSnapshot|{state:'unknown'};
  data:{state:'available'|'unavailable'|'unknown';message:string};
  canRestart:boolean;
}
export function connectionStatus(node:ConnectionStatus['node'],data:ConnectionStatus['data'],canRestart:boolean):ConnectionStatus {
  const state=node.state==='down'?'disconnected':node.state==='unknown'?'unknown':node.state==='degraded'||data.state==='unavailable'?'degraded':data.state==='available'?'connected':'unknown';
  return {state,checkedAt:new Date().toISOString(),node,data,canRestart};
}
