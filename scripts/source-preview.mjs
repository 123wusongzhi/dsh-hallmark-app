/** Serves the actual dist byte-for-byte, with a small preview-only Hallmark RPC host. */
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join,relative,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectSourceProject} from '../packages/source-components/src/index.ts';

export function parsePreviewArgs(args){
  const options={directory:resolve('component-workspace/collected-products'),port:4318};
  for(let i=0;i<args.length;i++){
    const key=args[i];if(key==='--help'){options.help=true;continue;}
    if(!['--directory','--port','--data','--session','--view'].includes(key))throw new Error(`Unknown option: ${key}`);
    const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`Missing value for ${key}`);
    options[key.slice(2)]=key==='--port'?Number(value):value;
  }
  if(!Number.isInteger(options.port)||options.port<0||options.port>65535)throw new Error('Port must be between 0 and 65535.');
  if(Boolean(options.session)!==Boolean(options.view))throw new Error('--session and --view must be used together.');
  if(options.data&&options.view)throw new Error('Choose --data or --session/--view.');
  options.directory=resolve(options.directory);return options;
}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.map':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm'};
export async function readDist(directory){
  const before=inspectSourceProject(directory).buildId;
  const dist=resolve(directory,'dist'),files=[];
  async function walk(path){for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const full=join(path,entry.name);if(entry.isDirectory())await walk(full);else if(entry.isFile()){const name=relative(dist,full).replaceAll('\\','/');const bytes=await readFile(full);files.push({name,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),type:MIME[extname(name)]??'application/octet-stream'});}}}
  await walk(dist);if(!files.some(file=>file.name==='index.html'))throw new Error('Build the project first: dist/index.html was not found.');
  files.sort((a,b)=>a.name.localeCompare(b.name));
  const {buildId}=inspectSourceProject(directory);
  if(before!==buildId)throw new Error('Project changed while preparing preview. Finish the build, then start preview again.');
  return {dist,buildId,files};
}
export function preparePreviewData(input){
  if(input?.status){if(input.status!=='ok'&&input.status!=='partial')throw new Error(input.error?.message??`Cannot load preview data: ${input.status}`);input=input.data;}
  if(input?.bindings&&input?.selection&&typeof input.revision==='string')return input;
  const bindings=Array.isArray(input)?input:input?.bindings??[];
  if(!Array.isArray(bindings))throw new Error('Preview data must contain a bindings array or a SourceData object.');
  const selection=bindings.map(binding=>{
    const payload=binding.payload;const rows=Array.isArray(payload)?payload:payload?.items??payload?.rows??[];
    const collected=binding.provenance?.endpoint==='/api/items';
    const valid=collected&&Array.isArray(rows)&&rows.every(row=>typeof row.id==='string'&&row.id.length>0)&&new Set(rows.map(row=>row.id)).size===rows.length;
    return {bindingId:binding.bindingId,eligible:valid,rows:valid?rows.map(row=>({key:JSON.stringify(['collected_item',row.id]),row,identity:{kind:'collected_item',itemId:row.id}})):[],...(!valid?{reason:'预览缺少可验证的采集商品 ID 或来源；仍可检查组件布局。'}:{})};
  });
  return {bindings,selection,revision:createHash('sha256').update(JSON.stringify(bindings)).digest('hex')};
}
function hostHTML(manifest){
  const encoded=JSON.stringify(manifest).replaceAll('<','\\u003c');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hallmark source preview</title><style>html,body{height:100%;margin:0;background:#f5f7fb}iframe{display:block;border:0;width:100%;height:100vh}</style></head><body><iframe title="源码组件预览" src="/dist/index.html"></iframe><script type="module">
const manifest=${encoded},channel='hallmark.source.v1',frame=document.querySelector('iframe');window.__hallmarkPreview={manifest,events:[]};
const context={sessionId:'preview',viewId:'preview',buildId:manifest.buildId,preview:true,theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',attachment:{available:true}};
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.channel!==channel)return;
 const {requestId,method,params}=event.data;const respond=value=>frame.contentWindow.postMessage({channel,requestId,...value},location.origin);
 try{let result;
 if(method==='getData'||method==='refresh'){const response=await fetch('/__data.json',{cache:'no-store'});if(!response.ok)throw new Error((await response.json()).error);result=await response.json();window.__hallmarkPreview.data=result;}
 else if(method==='getContext')result=context;
 else if(method==='resize'){result=null;}
 else if(method==='attachSelection'){const data=window.__hallmarkPreview.data;const binding=data?.selection.find(item=>item.bindingId===params?.bindingId);const allowed=new Set(binding?.rows.map(item=>item.key));if(!binding?.eligible||!Array.isArray(params?.keys)||!params.keys.length||params.keys.some(key=>!allowed.has(key)))throw new Error('选择未匹配本次预览数据。');if(params.revision&&params.revision!==data.revision)throw new Error('数据已更新，请重新选择。');result={ok:true,message:'预览已收到 '+params.keys.length+' 件商品。DSH 中会生成原生附件，等待你手动发送。'};window.__hallmarkPreview.events.push({method,params,result,at:new Date().toISOString()});}
 else throw new Error('Preview host does not recognize '+method);
 respond({result});
 }catch(error){respond({error:error.message});}
});
</script></body></html>`;
}
export async function startSourcePreview(options={}){
  const directory=resolve(options.directory??'component-workspace/collected-products');
  const artifact=await readDist(directory);
  const manifest={directory,dist:artifact.dist,buildId:artifact.buildId,files:artifact.files.map(({name,sha256,bytes,type})=>({name,sha256,size:bytes.length,type})),at:new Date().toISOString()};
  const resources=new Map(artifact.files.map(file=>['/dist/'+file.name,file]));
  let service;
  const readData=async()=>{
    if(options.loadData)return preparePreviewData(await options.loadData());
    if(options.data)return preparePreviewData(JSON.parse(await readFile(resolve(options.data),'utf8')));
    if(options.session&&options.view){service??=new (await import('../packages/dsh-plugin/server/service-client.ts')).AppServiceClient();return preparePreviewData(await service.request('/sessions/'+encodeURIComponent(options.session)+'/views/'+encodeURIComponent(options.view)+'/data'));}
    return preparePreviewData([]);
  };
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url??'/','http://127.0.0.1');const path=decodeURIComponent(url.pathname);
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
      let body,type;
      if(path==='/'){body=Buffer.from(hostHTML(manifest));type=MIME['.html'];}
      else if(path==='/__manifest.json'){body=Buffer.from(JSON.stringify(manifest));type=MIME['.json'];}
      else if(path==='/__data.json'){body=Buffer.from(JSON.stringify(await readData()));type=MIME['.json'];}
      else{const resource=resources.get(path);if(!resource){res.writeHead(404);res.end('Not found');return;}body=resource.bytes;type=resource.type;}
      res.writeHead(200,{'content-type':type,'content-length':body.length,'cache-control':'no-store'});res.end(req.method==='HEAD'?undefined:body);
    }catch(error){res.writeHead(500,{'content-type':MIME['.json']});res.end(JSON.stringify({error:error.message}));}
  });
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(options.port??4318,'127.0.0.1',accept);});
  const address=server.address();return {server,manifest,url:`http://127.0.0.1:${address.port}`,close:()=>new Promise((accept,reject)=>{server.closeAllConnections();server.close(error=>error?reject(error):accept());})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{const options=parsePreviewArgs(process.argv.slice(2));if(options.help)console.log('node scripts/source-preview.mjs --directory <project> [--port 4318] [--data <SourceData.json> | --session <id> --view <id>]');else{const preview=await startSourcePreview(options);console.log(JSON.stringify({url:preview.url,...preview.manifest}));const close=()=>void preview.close();process.once('SIGINT',close);process.once('SIGTERM',close);}}catch(error){console.error(error.message);process.exitCode=1;}
}
