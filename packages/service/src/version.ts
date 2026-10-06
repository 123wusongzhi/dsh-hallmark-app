import { readFileSync } from 'node:fs';
import { TOOL_DEFINITIONS } from '../../contracts/src/index.ts';

// Capture once when this service code loads. Reading package.json per request
// would let an old process claim a newer version after files are updated on disk.
const manifest=JSON.parse(readFileSync(new URL('../../../package.json',import.meta.url),'utf8')) as {name:string;version:string};
if(typeof manifest.name!=='string'||typeof manifest.version!=='string')throw new Error('INVALID_SERVICE_PACKAGE_METADATA');
export const SERVICE_IDENTITY=Object.freeze({service:manifest.name,version:manifest.version,toolCount:TOOL_DEFINITIONS.length});
