import type {AppsHost} from '../../plugin-apps/src/index.ts';
export const name = 'dsh-plugin-app-notes';
export const version = '1.0.0-candidate.4';
export const appId = 'notes';
/** No Notes business logic or schema is copied into the Host. */
export function apply(host: AppsHost): () => void {return host.attachApp(appId);}
export default {name, version, appId, apply};
