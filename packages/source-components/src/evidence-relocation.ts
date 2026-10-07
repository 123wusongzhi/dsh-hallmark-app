import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';

interface FileFact {originalPath:string;path?:string;bytes:number;sha256:string;rootId?:string}
interface RootFact {rootId:string;originalPath:string;backupPrefix:string;restorePrefix:string;directories:string[]}
interface AliasFact {kind:string;originalPath?:string;resolvedPath?:string;bytes?:number;sha256?:string}
interface Manifest {formatVersion:number;schemaVersion:number;backupId:string;files:FileFact[];roots:RootFact[];references:AliasFact[]}
interface ManifestIndex {files:Map<string,FileFact>;aliases:Map<string,AliasFact[]>;directories:Map<string,Set<string>>}
interface Relocation {
  appId:string;connectionId:string;namespace:string;backupId:string;kind:'file'|'directory';
  originalPath:string;relocatedPath:string;manifestPath:string;manifestSha256:string;bytes?:number;sha256?:string;
}
export interface EvidencePathResolverOptions {root:string;store:{list<T>(table:string):T[]}}
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const hex=/^[a-f0-9]{64}$/;
function inside(root:string,path:string):boolean {const rel=relative(resolve(root),resolve(path));return rel===''||!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);}
function noTraversal(path:string):void {if(path.split(/[\\/]/).includes('..'))throw new Error('EVIDENCE_RELOCATION_TRAVERSAL');}
function noSymlink(path:string):void {
  let current=resolve(path);
  for(;;){if(existsSync(current)&&lstatSync(current).isSymbolicLink())throw new Error('EVIDENCE_RELOCATION_SYMLINK');const parent=dirname(current);if(parent===current)break;current=parent;}
}
function namedAbsolute(path:unknown):asserts path is string {if(typeof path!=='string'||!isAbsolute(path))throw new Error('EVIDENCE_RELOCATION_PATH_INVALID');noTraversal(path);}
function samePath(left:string,right:string):boolean {return relative(resolve(left),resolve(right))==='';}
function pathIdentity(path:string):string {const absolute=resolve(path);return process.platform==='win32'?absolute.toLowerCase():absolute;}
function relativeAssetPath(path:string,allowEmpty=false):void {
  if(typeof path!=='string'||!path&&!allowEmpty||isAbsolute(path)||path.includes('\\')||path.split('/').some(part=>part==='..'||part==='.'||part===''&&path!==''))throw new Error('EVIDENCE_RELOCATION_MANIFEST_INVALID');
}

/** Immutable evidence keeps its old path strings. Only an authenticated local restore manifest can relocate them. */
export class EvidencePathResolver {
  readonly root:string;
  private store:EvidencePathResolverOptions['store'];
  private indexes=new WeakMap<Manifest,ManifestIndex>();
  constructor(options:EvidencePathResolverOptions){
    namedAbsolute(resolve(options.root));noSymlink(options.root);this.root=realpathSync(options.root);this.store=options.store;
    if(!lstatSync(this.root).isDirectory())throw new Error('EVIDENCE_RELOCATION_ROOT_INVALID');
  }
  private manifest(row:Relocation,cache:Map<string,Manifest>):Manifest {
    namedAbsolute(row.manifestPath);noSymlink(row.manifestPath);
    if(!inside(this.root,row.manifestPath)||!existsSync(row.manifestPath)||!lstatSync(row.manifestPath).isFile()||!inside(this.root,realpathSync(row.manifestPath))||!hex.test(row.manifestSha256))throw new Error('EVIDENCE_RELOCATION_MANIFEST_INVALID');
    const cacheKey=row.manifestPath+'\0'+row.manifestSha256;let manifest=cache.get(cacheKey);if(manifest)return manifest;
    const bytes=readFileSync(row.manifestPath);if(hash(bytes)!==row.manifestSha256)throw new Error('EVIDENCE_RELOCATION_MANIFEST_HASH_MISMATCH');
    manifest=JSON.parse(bytes.toString('utf8')) as Manifest;
    if(manifest.formatVersion!==1||manifest.schemaVersion!==4||!Array.isArray(manifest.files)||!Array.isArray(manifest.roots)||!Array.isArray(manifest.references))throw new Error('EVIDENCE_RELOCATION_MANIFEST_INVALID');
    const identities=new Set<string>();for(const root of manifest.roots){
      namedAbsolute(root.originalPath);if(identities.has(root.rootId)||!Array.isArray(root.directories)||!/^runtime$|^workspace-[a-f0-9]{24}$/.test(root.rootId)||root.backupPrefix!==(root.rootId==='runtime'?'runtime':`external/${root.rootId}`)||root.restorePrefix!==(root.rootId==='runtime'?'':`restored-workspaces/${root.rootId}`))throw new Error('EVIDENCE_RELOCATION_MANIFEST_INVALID');identities.add(root.rootId);
      relativeAssetPath(root.backupPrefix);relativeAssetPath(root.restorePrefix,true);for(const dir of root.directories)relativeAssetPath(dir,true);
    }
    if(!identities.has('runtime'))throw new Error('EVIDENCE_RELOCATION_MANIFEST_INVALID');
    const index:ManifestIndex={files:new Map(),aliases:new Map(),directories:new Map(manifest.roots.map(root=>[root.rootId,new Set(root.directories)]))};
    for(const file of manifest.files){namedAbsolute(file.originalPath);relativeAssetPath(file.path!);if(index.files.has(pathIdentity(file.originalPath)))throw new Error('EVIDENCE_RELOCATION_MANIFEST_INVALID');index.files.set(pathIdentity(file.originalPath),file);}
    for(const alias of manifest.references){if(!['file','directory'].includes(alias.kind)||!alias.resolvedPath)continue;namedAbsolute(alias.originalPath);namedAbsolute(alias.resolvedPath);const identity=alias.kind+'\0'+pathIdentity(alias.originalPath),list=index.aliases.get(identity)??[];list.push(alias);index.aliases.set(identity,list);}
    this.indexes.set(manifest,index);cache.set(cacheKey,manifest);return manifest;
  }
  private validate(row:Relocation,manifest:Manifest):Relocation {
    if(row.appId!=='apps'||row.connectionId!=='presentation'||row.backupId!==manifest.backupId||!['file','directory'].includes(row.kind))throw new Error('EVIDENCE_RELOCATION_INVALID');
    namedAbsolute(row.originalPath);namedAbsolute(row.relocatedPath);noSymlink(row.relocatedPath);
    const index=this.indexes.get(manifest)!,aliases=index.aliases.get(row.kind+'\0'+pathIdentity(row.originalPath))??[];
    if(aliases.some(alias=>!samePath(alias.resolvedPath!,aliases[0].resolvedPath!)))throw new Error('EVIDENCE_RELOCATION_CONFLICT');
    const alias=aliases[0],previousPath=alias?.resolvedPath??row.originalPath;namedAbsolute(previousPath);
    const mappings=manifest.roots.filter(root=>inside(root.originalPath,previousPath)).sort((a,b)=>b.originalPath.length-a.originalPath.length),mapping=mappings[0];
    if(!mapping)throw new Error('EVIDENCE_RELOCATION_NOT_MANIFESTED');
    const suffix=relative(mapping.originalPath,previousPath),target=resolve(this.root,mapping.restorePrefix,suffix);
    if(!inside(this.root,target)||!samePath(target,row.relocatedPath))throw new Error('EVIDENCE_RELOCATION_TARGET_INVALID');
    if(row.kind==='file'){
      const actualFile=index.files.get(pathIdentity(previousPath)),fact=alias?.sha256!==undefined?alias:index.files.get(pathIdentity(previousPath));
      if(!fact||!actualFile||fact.sha256!==row.sha256||fact.bytes!==row.bytes||actualFile.sha256!==row.sha256||actualFile.bytes!==row.bytes||!Number.isSafeInteger(row.bytes)||row.bytes!<0||!hex.test(row.sha256??''))throw new Error('EVIDENCE_RELOCATION_FILE_NOT_MANIFESTED');
      const fileRoot=manifest.roots.find(root=>root.rootId===actualFile.rootId);if(!fileRoot||!inside(fileRoot.originalPath,actualFile.originalPath))throw new Error('EVIDENCE_RELOCATION_FILE_NOT_MANIFESTED');
      const fileSuffix=relative(fileRoot.originalPath,actualFile.originalPath).split(sep).join('/');relativeAssetPath(actualFile.path!);if(actualFile.path!==`${fileRoot.backupPrefix}/${fileSuffix}`)throw new Error('EVIDENCE_RELOCATION_FILE_NOT_MANIFESTED');
    }else{
      const suffixName=suffix.split(sep).join('/');if(!index.directories.get(mapping.rootId)!.has(suffixName))throw new Error('EVIDENCE_RELOCATION_DIRECTORY_NOT_MANIFESTED');
    }
    return {...row,originalPath:resolve(row.originalPath),relocatedPath:target};
  }
  private rows():Relocation[] {
    const cache=new Map<string,Manifest>(),rows:Relocation[]=[];
    for(const value of this.store.list<unknown>('provider_records')){
      if(!value||typeof value!=='object'||(value as {namespace?:string}).namespace!=='evidence_relocations')continue;
      const row=value as Relocation;namedAbsolute(row.manifestPath);
      // A previous restore generation may have its anchor in an old Runtime. It cannot authorize this root.
      if(!inside(this.root,row.manifestPath))continue;
      rows.push(this.validate(row,this.manifest(row,cache)));
    }
    const byIdentity=new Map<string,Relocation>();for(const row of rows){
      const identity=pathIdentity(row.originalPath),previous=byIdentity.get(identity);
      if(previous&&(previous.kind!==row.kind||!samePath(previous.relocatedPath,row.relocatedPath)||previous.sha256!==row.sha256||previous.bytes!==row.bytes))throw new Error('EVIDENCE_RELOCATION_CONFLICT');byIdentity.set(identity,row);
    }
    const unique=[...byIdentity.values()];
    for(const child of unique){let current=dirname(child.originalPath);for(;;){const parent=byIdentity.get(pathIdentity(current));if(parent?.kind==='directory'&&!samePath(resolve(parent.relocatedPath,relative(parent.originalPath,child.originalPath)),child.relocatedPath))throw new Error('EVIDENCE_RELOCATION_CONFLICT');const next=dirname(current);if(next===current)break;current=next;}}
    return unique;
  }
  resolve(path:string):string {
    if(typeof path!=='string'||!path)throw new Error('EVIDENCE_RELOCATION_PATH_INVALID');noTraversal(path);
    const absolute=resolve(path),rows=this.rows(),exact=rows.find(row=>row.kind==='file'&&samePath(row.originalPath,absolute));
    const directory=rows.filter(row=>row.kind==='directory'&&inside(row.originalPath,absolute)).sort((a,b)=>b.originalPath.length-a.originalPath.length)[0];
    if(!exact&&!directory){noSymlink(absolute);return absolute;}
    const target=exact?.relocatedPath??resolve(directory!.relocatedPath,relative(directory!.originalPath,absolute));
    noSymlink(target);if(!inside(this.root,target)||existsSync(target)&&!inside(this.root,realpathSync(target)))throw new Error('EVIDENCE_RELOCATION_TARGET_INVALID');
    if(exact){if(!existsSync(target)||!lstatSync(target).isFile())throw new Error('EVIDENCE_RELOCATION_FILE_MISSING');const bytes=readFileSync(target);if(bytes.length!==exact.bytes||hash(bytes)!==exact.sha256)throw new Error('EVIDENCE_RELOCATION_FILE_HASH_MISMATCH');}
    else if(samePath(directory!.originalPath,absolute)&&(!existsSync(target)||!lstatSync(target).isDirectory()))throw new Error('EVIDENCE_RELOCATION_DIRECTORY_MISSING');
    return target;
  }
}
