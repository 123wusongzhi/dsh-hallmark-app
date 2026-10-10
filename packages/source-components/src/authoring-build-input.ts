import {createHash} from 'node:crypto';
import {existsSync,readFileSync,realpathSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {canonicalJson} from '../../app-contracts/src/index.ts';

export interface BuildEnvironmentInput {workspacePath:string;command:string[];environmentKeys?:string[]}
export interface BuildEnvironmentSignature {policy:'builtin'|'declared'|'conservative';keys:string[];digest:string}
const hash=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
// Node launch/module resolution, platform subprocess setup, locale and esbuild's documented overrides.
// Explicit declarations may add dependencies but cannot omit these safety dependencies.
const safetyKeys=['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','TMPDIR','HOME','USERPROFILE','HOMEDRIVE','HOMEPATH','LANG','LANGUAGE','LC_ALL','LC_CTYPE','TZ','NODE_ENV','NODE_OPTIONS','NODE_PATH','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED','OPENSSL_CONF','ELECTRON_RUN_AS_NODE','ESBUILD_BINARY_PATH','ESBUILD_WORKER_THREADS','ESBUILD_MAXIMUM_STDIO_BUFFER'];
// Match the generated starter exactly, including direct Node invocation. Modified/custom builds are conservative.
const starterBuild=`import {build} from 'esbuild';\nimport {mkdir,copyFile} from 'node:fs/promises';\nimport {createRequire} from 'node:module';\nimport {dirname} from 'node:path';\nconst require=createRequire(import.meta.url);\n// Linked SDKs must share the component's React dispatcher, including JSX/runtime subpaths.\nconst react=dirname(require.resolve('react/package.json')),reactDom=dirname(require.resolve('react-dom/package.json'));\nawait mkdir('dist',{recursive:true});\nawait build({entryPoints:['src/main.tsx'],outfile:'dist/app.js',bundle:true,platform:'browser',format:'esm',jsx:'automatic',target:'es2022',alias:{react,'react-dom':reactDom},define:{'process.env.NODE_ENV':'"production"'}});\nawait copyFile('index.html','dist/index.html');\n`;
export function buildEnvironmentSignature(input:BuildEnvironmentInput,values:NodeJS.ProcessEnv=process.env):BuildEnvironmentSignature {
  if(input.environmentKeys!==undefined&&(!Array.isArray(input.environmentKeys)||input.environmentKeys.some(key=>typeof key!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))))throw new Error('BUILD_ENVIRONMENT_KEYS_INVALID');
  const normalize=(key:string)=>process.platform==='win32'?key.toUpperCase():key;
  const environment=Object.fromEntries(Object.entries(values).map(([key,value])=>[normalize(key),value]));
  const script=join(resolve(input.workspacePath),'build.mjs');
  const harmlessNodeFlags=new Set(['--expose-internals','--no-warnings','--experimental-strip-types']);
  const builtin=input.command.length>=2&&input.command.slice(1,-1).every(flag=>harmlessNodeFlags.has(flag))&&existsSync(script)&&resolve(input.workspacePath,input.command.at(-1)!)===resolve(script)&&existsSync(input.command[0])&&realpathSync(input.command[0])===realpathSync(process.execPath)&&readFileSync(script,'utf8')===starterBuild;
  const policy=input.environmentKeys!==undefined?'declared':builtin?'builtin':'conservative';
  const runtimeKeys=Object.keys(environment).filter(key=>/^(NODE_|ELECTRON_|ESBUILD_|LC_|GO)/.test(key));
  const keys=[...new Set((policy==='conservative'?Object.keys(environment):[...safetyKeys,...runtimeKeys,...input.environmentKeys??[]]).map(normalize))].sort();
  // Only the digest and names leave this function; credentials and environment values stay in process.
  return {policy,keys,digest:hash(Object.fromEntries(keys.map(key=>[key,environment[key]??null])))};
}
