import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { SourceArtifact, SourcePreview } from '../../presentation/src/types.ts';
import {regularFileIdentity} from './file-verification-cache.ts';

export class SourceComponentError extends Error {
  code: string;
  constructor(code:string,message:string){super(message);this.name='SourceComponentError';this.code=code;}
}
export interface SourceBuildManifest { buildId:string; entry:string; files:string[]; projectFiles:string[]; createdAt:string; manifestVersion?:2; fileManifest?:{path:string;size:number;sha256:string}[] }
const ignored=new Set(['node_modules','.git','.preview']);
function walk(root:string,current=root):string[]{
  return readdirSync(current,{withFileTypes:true}).flatMap(item=>{
    if(ignored.has(item.name))return [];
    const path=join(current,item.name);
    // Symlinked dependencies are represented by the package manifest and lockfile, not duplicate vendored trees.
    if(item.isSymbolicLink())return [];
    return item.isDirectory()?walk(root,path):item.isFile()?[relative(root,path).split(sep).join('/')]:[];
  }).sort();
}
function filePath(root:string,file:string):string{
  const path=resolve(root,file);
  if(!file||file.includes('\\')||isAbsolute(file)||!(path.startsWith(resolve(root)+sep)))throw new SourceComponentError('SOURCE_FILE_NOT_FOUND','构建资源路径无效。');
  return path;
}
function projectSnapshot(directory:string){
  const project=realpathSync(resolve(directory)),projectFiles=walk(project),hash=createHash('sha256');
  if(!projectFiles.includes('dist/index.html'))throw new SourceComponentError('SOURCE_BUILD_REQUIRED','没有 dist/index.html；请先在组件工程执行构建。');
  const contents=projectFiles.map(file=>{const bytes=readFileSync(filePath(project,file));hash.update(`${Buffer.byteLength(file)}:${file}:${bytes.length}:`).update(bytes);return {file,bytes};});
  return {project,projectFiles,contents,buildId:hash.digest('hex'),entry:'index.html',files:projectFiles.filter(file=>file.startsWith('dist/')).map(file=>file.slice(5))};
}
/** The preview runner uses this same fingerprint, so a screenshot can identify its exact source + dist version. */
export function inspectSourceProject(directory:string):Pick<SourceBuildManifest,'buildId'|'entry'|'files'|'projectFiles'>{
  const {buildId,entry,files,projectFiles}=projectSnapshot(directory);return {buildId,entry,files,projectFiles};
}
export function sourceMime(file:string):string {
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf'} as Record<string,string>)[extname(file).toLowerCase()]??'application/octet-stream';
}

/** Ordinary source projects and their exact dist are snapshotted together. No source-language or design schema is imposed. */
export class SourceComponentStore {
  directory:string;
  workspace:string;
  private verifiedBuilds=new Map<string,{fingerprint:string;result:{valid:boolean;errors:string[]}}>();
  private verifiedBuildBytes=0;
  constructor(directory:string,workspace=join(directory,'workspace')){this.directory=resolve(directory);this.workspace=resolve(workspace);}
  private buildDirectory(buildId:string):string {
    if(!/^[a-f0-9]{64}$/.test(buildId))throw new SourceComponentError('SOURCE_BUILD_NOT_FOUND','源码构建不存在。');
    return join(this.directory,'builds',buildId);
  }
  capture(directory:string):{source:SourceArtifact;metadata:Record<string,any>} {
    const project=realpathSync(resolve(directory));
    if(!statSync(project).isDirectory())throw new SourceComponentError('SOURCE_PROJECT_REQUIRED','请提供普通组件工程目录。');
    const metadata=existsSync(join(project,'component.json'))?JSON.parse(readFileSync(join(project,'component.json'),'utf8')):{};
    // Materialize bytes once so the copied source and buildId describe the same snapshot even during an editor save.
    const snapshot=projectSnapshot(project),{contents,buildId,projectFiles}=snapshot,destination=this.buildDirectory(buildId),distFiles=snapshot.files;
    if(!existsSync(join(destination,'manifest.json'))){
      const staging=join(this.directory,'builds',`.${buildId}-${randomUUID()}`);mkdirSync(staging,{recursive:true});
      for(const {file,bytes} of contents){const target=filePath(join(staging,'project'),file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);}
      const manifest:SourceBuildManifest={buildId,entry:'index.html',files:distFiles,projectFiles,createdAt:new Date().toISOString(),manifestVersion:2,fileManifest:contents.map(({file,bytes})=>({path:file,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}))};
      writeFileSync(join(staging,'manifest.json'),JSON.stringify(manifest,null,2));
      try{renameSync(staging,destination);}catch(error){if(!existsSync(join(destination,'manifest.json')))throw error;}
    }
    const preview=this.capturePreview(project,buildId);
    return {source:{buildId,directory:project,entry:'index.html',files:distFiles,...(preview?{preview,thumbnail:preview.screenshotPath}:{})},metadata};
  }
  private capturePreview(project:string,buildId:string):SourcePreview|undefined {
    const root=join(this.buildDirectory(buildId),'preview'),reportPath=join(root,'report.json'),screenshotPath=join(root,'screenshot.png');
    if(!existsSync(reportPath)){
      const latest=join(project,'.preview','latest.json'),image=join(project,'.preview','latest.png');
      if(!existsSync(latest)||!existsSync(image))return undefined;
      let report:any;try{report=JSON.parse(readFileSync(latest,'utf8'));}catch{return undefined;}
      if(report.buildId!==buildId)return undefined;
      mkdirSync(root,{recursive:true});writeFileSync(screenshotPath,readFileSync(image));writeFileSync(reportPath,JSON.stringify(report,null,2));
    }
    const report=JSON.parse(readFileSync(reportPath,'utf8'));
    const width=report.viewport?.width??report.width,height=report.viewport?.height??report.height,capturedAt=report.capturedAt??report.timestamp;
    return {screenshotPath,reportPath,...(typeof width==='number'?{width}:{}),...(typeof height==='number'?{height}:{}),...(typeof capturedAt==='string'?{capturedAt}:{})};
  }
  thumbnail(buildId:string):Buffer|undefined {
    const path=join(this.buildDirectory(buildId),'preview','screenshot.png');return existsSync(path)?readFileSync(path):undefined;
  }
  withPreview(source:SourceArtifact):SourceArtifact {
    const preview=this.capturePreview(source.directory,source.buildId);return preview?{...source,preview,thumbnail:preview.screenshotPath}:source;
  }
  manifest(buildId:string):SourceBuildManifest|undefined {
    const path=join(this.buildDirectory(buildId),'manifest.json');return existsSync(path)?JSON.parse(readFileSync(path,'utf8')):undefined;
  }
  /** Verify immutable archived bytes; old manifests remain readable without being rewritten. */
  verify(buildId:string):{valid:boolean;errors:string[]} {
    const directory=this.buildDirectory(buildId),project=join(directory,'project'),manifestPath=join(directory,'manifest.json');
    if(!existsSync(manifestPath))return {valid:false,errors:['SOURCE_BUILD_NOT_FOUND']};
    let projectFiles:string[],fingerprint:string;
    const inspect=()=>{const files=walk(project);return {files,fingerprint:JSON.stringify([regularFileIdentity(manifestPath),files.map(file=>[file,regularFileIdentity(filePath(project,file))])])};};
    try{({files:projectFiles,fingerprint}=inspect());}catch{return {valid:false,errors:['SOURCE_BUILD_UNREADABLE']};}
    const cached=this.verifiedBuilds.get(buildId);
    if(cached?.fingerprint===fingerprint){this.verifiedBuilds.delete(buildId);this.verifiedBuilds.set(buildId,cached);return {valid:cached.result.valid,errors:[...cached.result.errors]};}
    if(cached){this.verifiedBuilds.delete(buildId);this.verifiedBuildBytes-=cached.fingerprint.length*2;}
    let manifest:SourceBuildManifest;try{manifest=this.manifest(buildId)!;}catch{return {valid:false,errors:['SOURCE_MANIFEST_MISMATCH']};}
    const errors:string[]=[];
    if(!manifest||typeof manifest!=='object')return {valid:false,errors:['SOURCE_MANIFEST_MISMATCH']};
    if(!Array.isArray(manifest.projectFiles)||manifest.projectFiles.some(file=>typeof file!=='string')||manifest.buildId!==buildId||JSON.stringify([...manifest.projectFiles].sort())!==JSON.stringify(projectFiles)||manifest.entry!=='index.html'||!Array.isArray(manifest.files)||manifest.files.some(file=>typeof file!=='string')||JSON.stringify([...manifest.files].sort())!==JSON.stringify(projectFiles.filter(file=>file.startsWith('dist/')).map(file=>file.slice(5))))errors.push('SOURCE_MANIFEST_MISMATCH');
    const fileManifest=manifest.fileManifest;
    const validFileManifest=Array.isArray(fileManifest)&&fileManifest.every(file=>file&&typeof file.path==='string'&&Number.isSafeInteger(file.size)&&file.size>=0&&typeof file.sha256==='string'&&/^[a-f0-9]{64}$/.test(file.sha256));
    if(fileManifest!==undefined&&(!validFileManifest||fileManifest!.length!==projectFiles.length||new Set(fileManifest!.map(file=>file.path)).size!==projectFiles.length||fileManifest!.some(file=>!projectFiles.includes(file.path))))errors.push('SOURCE_MANIFEST_MISMATCH');
    const expected=new Map(validFileManifest?fileManifest!.map(file=>[file.path,file]):[]),hash=createHash('sha256');
    // One read feeds both the per-file checksum and historical content-addressing checksum.
    for(const file of projectFiles){
      try{const bytes=readFileSync(filePath(project,file));hash.update(`${Buffer.byteLength(file)}:${file}:${bytes.length}:`).update(bytes);const reference=expected.get(file);if(reference&&(bytes.length!==reference.size||createHash('sha256').update(bytes).digest('hex')!==reference.sha256))errors.push(`SOURCE_FILE_HASH_MISMATCH: ${file}`);}catch{errors.push(`SOURCE_FILE_NOT_FOUND: ${file}`);}
    }
    if(!projectFiles.includes('dist/index.html')||hash.digest('hex')!==buildId)errors.push('SOURCE_BUILD_HASH_MISMATCH');
    // Recheck membership and file identity after hashing, so an editor write during verification is never cached.
    try{if(inspect().fingerprint!==fingerprint)errors.push('SOURCE_BUILD_CHANGED');}catch{errors.push('SOURCE_BUILD_UNREADABLE');}
    const result={valid:errors.length===0,errors};
    const fingerprintBytes=fingerprint.length*2;
    if(result.valid&&fingerprintBytes<=8*1024*1024){
      while(this.verifiedBuilds.size>=64||this.verifiedBuildBytes+fingerprintBytes>8*1024*1024){const oldest=this.verifiedBuilds.keys().next().value!;this.verifiedBuildBytes-=this.verifiedBuilds.get(oldest)!.fingerprint.length*2;this.verifiedBuilds.delete(oldest);}
      this.verifiedBuilds.set(buildId,{fingerprint,result});this.verifiedBuildBytes+=fingerprintBytes;
    }
    return {valid:result.valid,errors:[...result.errors]};
  }
  readFile(buildId:string,file:string):{bytes:Buffer;mime:string}|undefined {
    const manifest=this.manifest(buildId);if(!manifest?.files.includes(file))return undefined;
    return {bytes:readFileSync(filePath(join(this.buildDirectory(buildId),'project','dist'),file)),mime:sourceMime(file)};
  }
  checkout(source:SourceArtifact,directory?:string):SourceArtifact {
    const manifest=this.manifest(source.buildId);if(!manifest)throw new SourceComponentError('SOURCE_BUILD_NOT_FOUND','保存的构建产物不存在。');
    const target=resolve(directory??join(this.workspace,`${basename(source.directory)}-${randomUUID().slice(0,8)}`));
    if(existsSync(target)&&readdirSync(target).length)throw new SourceComponentError('SOURCE_DIRECTORY_NOT_EMPTY','打开版本需要空目录，避免覆盖正在编辑的源码。');
    mkdirSync(target,{recursive:true});
    for(const file of manifest.projectFiles){const path=filePath(target,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(filePath(join(this.buildDirectory(source.buildId),'project'),file)));}
    return {...source,directory:target,files:[...manifest.files]};
  }
}
