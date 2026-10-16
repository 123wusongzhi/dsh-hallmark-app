import type {RuntimeHealthView} from './runtime-status.tsx';

export interface RecoveryTarget {sessionId:string;viewId:string;publicationId:string;buildId:string;displayId:string}
export interface RecoveryFailure {phase:string;code:string;retryPolicy?:string}
const transportFailures=new Set(['BRIDGE_TIMEOUT','BRIDGE_PROXY_UNAVAILABLE','RUNTIME_UNAVAILABLE','RUNTIME_CONNECTION_LOST','RUNTIME_INVALID_RESPONSE','RUNTIME_STORE_BUSY','RUNTIME_INTERNAL_ERROR','RUNTIME_REQUEST_TIMEOUT','INVALID_BRIDGE_RESPONSE']);
/** Only failed initial reads/authorization are candidates. Business submissions and script/assertion errors never reopen a display. */
export function recoverableDisplayFailure(problem:RecoveryFailure):boolean {return ['data','context','authorization','handshake'].includes(problem.phase)&&problem.retryPolicy!=='inspect_only'&&transportFailures.has(problem.code);}
const scope=(target:RecoveryTarget)=>JSON.stringify([target.sessionId,target.viewId,target.publicationId,target.buildId]);
const budgets=new Map<string,{startedAt:number;attempts:number}>();
/** One reopen per observed outage, up to three per publication and 120 s from its first failure. Hidden/changed owners discard pending recovery. */
export function createRuntimeDisplayRecovery(options:{now?:()=>number;budgetMs?:number;maxAttempts?:number;budgets?:Map<string,{startedAt:number;attempts:number}>}={}) {
  const now=options.now??Date.now,ledger=options.budgets??budgets,budgetMs=options.budgetMs??120000,maxAttempts=options.maxAttempts??3;
  let pending:RecoveryTarget|undefined,outage=false,cycle=0,usedCycle=-1;
  return {
    failed(target:RecoveryTarget,problem:RecoveryFailure):boolean {
      if(!recoverableDisplayFailure(problem))return false;
      const key=scope(target);if(!ledger.has(key)){ledger.set(key,{startedAt:now(),attempts:0});while(ledger.size>128)ledger.delete(ledger.keys().next().value as string);}
      const budget=ledger.get(key)!;if(now()-budget.startedAt>=budgetMs||budget.attempts>=maxAttempts)return false;
      pending={...target};return true;
    },
    cancel(){pending=undefined;},
    pending:()=>{const budget=pending&&ledger.get(scope(pending));if(budget&&(now()-budget.startedAt>=budgetMs||budget.attempts>=maxAttempts))pending=undefined;return pending!==undefined;},
    observe(health:RuntimeHealthView|undefined,current:RecoveryTarget|undefined,eligible:boolean):RecoveryTarget|undefined {
      if(!eligible||!current){pending=undefined;return;}
      const down=health?.state==='down'||health?.recovering===true||health?.restart?.restarting===true;
      if(down){if(!outage)cycle++;outage=true;return;}
      if(health?.state!=='healthy'||!outage)return;
      outage=false;
      const target=pending;pending=undefined;
      if(!target||scope(target)!==scope(current)||target.displayId!==current.displayId||usedCycle===cycle)return;
      const budget=ledger.get(scope(target));if(!budget||now()-budget.startedAt>=budgetMs||budget.attempts>=maxAttempts)return;
      usedCycle=cycle;budget.attempts++;return target;
    },
  };
}
