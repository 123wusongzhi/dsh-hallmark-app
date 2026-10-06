import { AppServiceClient, ServiceFailure } from './service-client.ts';
import type { PluginContext } from './types.ts';

export const SOURCE_ASSET_PREFIX='/api/hallmark-source';
type Manifest={buildId:string;entry:string;files:string[]};

/** DSH routes are exact matches: register the actual dist files before exposing a view. */
export class SourceAssetRoutes {
  private readonly builds=new Map<string,Promise<void>>();
  private readonly disposers:(()=>Promise<void>)[]=[];
  private closed=false;
  private readonly ctx:PluginContext;private readonly client:AppServiceClient;private readonly signal:AbortSignal;
  constructor(ctx:PluginContext,client:AppServiceClient,signal:AbortSignal){this.ctx=ctx;this.client=client;this.signal=signal;}

  async prepare(value:unknown):Promise<void> {
    if(!value||typeof value!=='object')return;
    const item=value as Record<string,any>;
    const spec=item.kind==='source'?item:item.spec??item.data?.spec;
    if(spec?.kind==='source'&&typeof spec.source?.buildId==='string')await this.ensure(spec.source.buildId);
    if(Array.isArray(value))await Promise.all(value.map(child=>this.prepare(child)));
    for(const key of ['components','templates'])if(Array.isArray(item[key]))await Promise.all(item[key].map((child:unknown)=>this.prepare(child)));
  }

  private async ensure(buildId:string):Promise<void> {
    const pending=this.builds.get(buildId);if(pending)return pending;
    const task=this.register(buildId);this.builds.set(buildId,task);
    try{await task;}catch(error){this.builds.delete(buildId);throw error;}
  }

  private async register(buildId:string):Promise<void> {
    // IDs and file names identify actual artifacts, never a CSS/JS or dependency allowlist.
    if(!/^[a-zA-Z0-9_-]+$/.test(buildId))throw new ServiceFailure('INVALID_SOURCE_BUILD');
    const manifest=await this.client.request(`/source-builds/${buildId}/manifest`,undefined,this.signal) as Manifest;
    if(manifest?.buildId!==buildId||!Array.isArray(manifest.files)||!manifest.files.includes(manifest.entry))throw new ServiceFailure('INVALID_SOURCE_MANIFEST');
    const paths=manifest.files.map(file=>{
      if(typeof file!=='string'||!file||file.startsWith('/')||file.split(/[\\/]/).some(part=>!part||part==='.'||part==='..')||file.includes('\\'))throw new ServiceFailure('INVALID_SOURCE_ASSET');
      return {file,encoded:file.split('/').map(encodeURIComponent).join('/')};
    });
    if(this.closed||this.signal.aborted)throw new ServiceFailure('APP_SERVICE_UNAVAILABLE');
    const added:(()=>Promise<void>)[]=[];
    try {
      const routes=[...paths.map(({encoded})=>({path:`${SOURCE_ASSET_PREFIX}/${buildId}/${encoded}`,servicePath:`/source-builds/${buildId}/files/${encoded}`,immutable:true})),{path:`/api/hallmark-source-thumbnail/${buildId}`,servicePath:`/source-builds/${buildId}/thumbnail`,immutable:false}];
      for(const {path,servicePath,immutable} of routes){
        const dispose=this.ctx.connection.fetch.register({path,methods:['GET'],requestBody:'buffered',fetch:async request=>{
          try {
            const upstream=await this.client.asset(servicePath,AbortSignal.any([this.signal,request.signal]));
            return new Response(upstream.body,{headers:{'Content-Type':upstream.headers.get('content-type')??'application/octet-stream','Cache-Control':immutable?'private, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff'}});
          }catch(error){request.signal.throwIfAborted();return new Response('组件构建资源暂不可用，请重新打开组件。',{status:error instanceof ServiceFailure&&error.httpStatus===404?404:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
        }});
        added.push(dispose);
      }
      this.disposers.push(...added);
    }catch(error){await Promise.allSettled(added.map(dispose=>dispose()));throw error;}
  }

  async dispose():Promise<void>{this.closed=true;await Promise.allSettled(this.disposers.splice(0).reverse().map(dispose=>dispose()));this.builds.clear();}
}
