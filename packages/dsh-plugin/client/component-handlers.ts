import type {BridgeIdentity} from '../../app-contracts/src/index.ts';
import type {ComponentHostHandlers} from '../../component-runtime/src/host.ts';
export type ComponentHandlerFactory=(identity:Omit<BridgeIdentity,'protocolVersion'|'frameInstanceId'>,signal:AbortSignal)=>ComponentHostHandlers|Promise<ComponentHostHandlers>;
let configuredHandlers:{factory:ComponentHandlerFactory}|undefined;
/** Apps composition installs the Runtime proxy; the historical client keeps its existing local bridge. */
export function configureComponentHandlers(factory:ComponentHandlerFactory):()=>void {
  const owner={factory},previous=configuredHandlers;configuredHandlers=owner;
  return()=>{if(configuredHandlers===owner)configuredHandlers=previous;};
}
export function configuredComponentHandlers():ComponentHandlerFactory|undefined {return configuredHandlers?.factory;}
