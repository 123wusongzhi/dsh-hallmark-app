import type {AppsHost} from '../../plugin-apps/src/index.ts';
export const name = 'dsh-plugin-app-hallmark';
export const version = '1.0.0-candidate.4';
export const appId = 'hallmark';
/** Logical native projection; the combined bundle supplies the project-owned facade. */
export function apply(host: AppsHost): () => void {return host.attachApp(appId);}
export default {name, version, appId, apply};
