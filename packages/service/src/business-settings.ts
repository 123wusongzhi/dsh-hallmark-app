import type { AppsRuntime } from '../../app-runtime/src/index.ts';
import type { OzonBusinessGateway } from '../../ozon-business/src/index.ts';
import type { BusinessPricingRepository } from '../../business-pricing/src/index.ts';
import type { BusinessPackagingRepository, PackagingTarget, PackagingValues } from '../../business-packaging/src/index.ts';
import type { CollectionService, CollectionProduct } from '../../collection/src/index.ts';

const fail = (message: string, code = 'INVALID_INPUT', statusCode = 400): never => { throw Object.assign(new Error(message), { code, statusCode }); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('设置参数必须是对象。');
const only = (value: Record<string, unknown>, allowed: string[]) => { if (Object.keys(value).some(key => !allowed.includes(key))) fail('包含未声明的设置参数。'); };
const text = (value: unknown, label: string): string => typeof value === 'string' && value.trim() && value.length <= 200 ? value : fail(`${label}无效。`);
interface PackagingSettingsOptions {
  packagingFor?: (connectionId:string)=>BusinessPackagingRepository;
  collectionFor?: (connectionId:string)=>Pick<CollectionService,'search'|'getProduct'>;
  prepareProducts?: (connectionId:string,products:CollectionProduct[])=>Promise<CollectionProduct[]>;
}
const membersOf = (target:PackagingTarget) => target.kind==='sku' ? [{itemId:target.itemId,sourceSkuId:target.sourceSkuId,quantity:1}] : target.composition;
const packageValues = (value:CollectionProduct['package']|null|undefined):PackagingValues => ({weightKg:value?.weightGrams==null?null:value.weightGrams/1000,dimensionsCm:value?.dimensionsMm?{length:value.dimensionsMm.length/10,width:value.dimensionsMm.width/10,height:value.dimensionsMm.height/10}:null});

/** Local ERP settings are not Agent-supplied business evidence or a platform write route. */
export class BusinessSettingsService {
  readonly runtime:AppsRuntime; readonly gateway:OzonBusinessGateway; readonly pricingFor:(connectionId:string)=>BusinessPricingRepository;
  readonly packagingOptions:PackagingSettingsOptions;
  constructor(runtime:AppsRuntime,gateway:OzonBusinessGateway,pricingFor:(connectionId:string)=>BusinessPricingRepository,packagingOptions:PackagingSettingsOptions={}){this.runtime=runtime;this.gateway=gateway;this.pricingFor=pricingFor;this.packagingOptions=packagingOptions;}
  private connection(id: string) {
    const connection = this.runtime.getConnection('hallmark', id);
    if (!connection?.enabled) fail('经营连接不可用。', 'CONNECTION_UNAVAILABLE', 409);
    return connection;
  }
  private store(connectionId: string, storeId: string) {
    const store = this.gateway.getStore(storeId);
    if (!store || store.sourceConnectionId !== connectionId) fail('店铺不属于当前经营连接。', 'STORE_NOT_FOUND', 404);
    return store;
  }
  read(connectionId?: string, storeId?: string) {
    const connections = this.runtime.listConnections('hallmark').filter(row => row.enabled).map(({ connectionId, displayName }) => ({ connectionId, displayName }));
    const id = connectionId ?? (storeId ? this.gateway.getStore(storeId)?.sourceConnectionId : undefined) ?? connections[0]?.connectionId;
    if (!id) return { connections, stores: [], connectionId: null, store: null, pricing: null };
    this.connection(id);
    const stores = this.gateway.listStores().filter(row => row.sourceConnectionId === id);
    const selected = storeId ? (connectionId ? this.store(id, storeId) : stores.find(row => row.id === storeId)) : stores[0];
    return { connections, stores, connectionId: id, store: selected ?? null, pricing: selected ? this.pricingFor(id).read(selected.id) ?? null : null, packagingAvailable:!!this.packagingOptions.packagingFor&&!!this.packagingOptions.collectionFor };
  }
  async write(value: unknown, signal?: AbortSignal): Promise<unknown> {
    const request = object(value); only(request, ['connectionId', 'operation', 'input']);
    const connectionId = text(request.connectionId, '连接'), operation = text(request.operation, '操作'), input = object(request.input);
    this.connection(connectionId); signal?.throwIfAborted();
    if(operation.startsWith('packaging.'))return this.packaging(connectionId,operation,input,signal);
    if (operation === 'store.save') {
      only(input, ['id', 'name', 'enabled', 'currency', 'legacyStoreId', 'expectedRevision', 'credentials']);
      if (input.id) this.store(connectionId, text(input.id, '店铺'));
      if (input.credentials && this.runtime.store.list<any>('operations').some(row => row.appId === 'hallmark' && row.connectionId === connectionId && ['pending', 'unknown', 'queued', 'dispatching', 'running', 'verifying'].includes(row.state))) fail('此连接有尚未结束的经营操作，请核查完成后更换店铺凭据。', 'OPERATION_UNRESOLVED', 409);
      const saved = this.gateway.saveStore({ ...input, sourceConnectionId: connectionId } as Parameters<OzonBusinessGateway['saveStore']>[0]);
      return { store: saved };
    }
    const storeId = text(input.storeId, '店铺'); this.store(connectionId, storeId);
    if (operation === 'store.check') {
      only(input, ['storeId']);
      const result = await this.gateway.checkStore(storeId, signal);
      return { connected: result.status === 'ok' && Number(result.raw?.httpStatus ?? 200) < 400 && result.raw?.outcome !== 'outcome_unknown', ...(result.status !== 'ok' ? { message: result.error?.message ?? '店铺连接未通过，请检查凭据和网络。' } : {}) };
    }
    const pricing = this.pricingFor(connectionId);
    if (operation === 'pricing.save') {
      only(input, ['storeId', 'config', 'expectedRevision']);
      if (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0) fail('规则修订号无效。');
      return { pricing: pricing.save(storeId, object(input.config) as any, Number(input.expectedRevision)) };
    }
    if (operation === 'pricing.quote') {
      only(input, ['storeId', 'action', 'planId', 'purchaseMinor', 'weightGrams', 'priceMinor', 'pricingMode']);
      return { quote: pricing.quote(input as any) };
    }
    return fail('不支持此经营设置操作。');
  }

  private async packaging(connectionId:string,operation:string,input:Record<string,unknown>,signal?:AbortSignal) {
    const repository=this.packagingOptions.packagingFor?.(connectionId),collection=this.packagingOptions.collectionFor?.(connectionId);
    if(!repository||!collection)fail('包装维护尚未连接采集资料。','PACKAGING_UNAVAILABLE',503);
    if(operation==='packaging.search') {
      only(input,['query','cursor']);
      return collection!.search({query:typeof input.query==='string'?input.query:undefined,cursor:typeof input.cursor==='string'?input.cursor:undefined,limit:30});
    }
    const products=new Map<string,CollectionProduct>();
    const getProduct=async(id:string)=>{if(!products.has(id)){signal?.throwIfAborted();const found=await collection!.getProduct(id);products.set(id,this.packagingOptions.prepareProducts?(await this.packagingOptions.prepareProducts(connectionId,[found]))[0]:found);}return products.get(id)!;};
    const hydrate=async(members:Array<{itemId:string;sourceSkuId:string;quantity:number}>)=>Promise.all(members.map(async member=>{
      const product=await getProduct(text(member.itemId,'商品')),sku=product.skus.find(row=>row.id===member.sourceSkuId);
      if(!sku)fail(`商品 ${product.title} 中找不到规格 ${member.sourceSkuId}。`,'SKU_NOT_FOUND',404);
      if(!Number.isSafeInteger(member.quantity)||member.quantity<1)fail('组成数量必须是正整数。');
      return {...member,title:`${product.title} · ${sku!.spec||member.sourceSkuId}`,commonPackage:packageValues(product.package),skuPackage:packageValues(sku!.package),sourceRevision:product.revision};
    }));
    if(operation==='packaging.read') {
      only(input,['itemIds','compositions']);
      const ids=Array.isArray(input.itemIds)?[...new Set(input.itemIds.map(id=>text(id,'商品')))]:[];
      if(ids.length>30)fail('一次最多维护 30 个商品。');
      const compositions=Array.isArray(input.compositions)?input.compositions.map(value=>object(value)):[];
      if(compositions.length>40)fail('一次最多读取 40 个组合。');
      const rows:any[]=[];
      const append=async(members:Array<{itemId:string;sourceSkuId:string;quantity:number}>,combinationId?:string)=>{
        const hydrated=await hydrate(members),result=repository!.resolve({members:hydrated,...(combinationId?{combinationId}:{})}),override=repository!.readOverride(result.target);
        const key=JSON.stringify(result.target.kind==='sku'?result.target:['combination',result.target.composition]);
        const entry={key,target:result.target,kind:result.target.kind,composition:hydrated.map(({itemId,sourceSkuId,quantity,title})=>({itemId,sourceSkuId,quantity,title})),result,override:override??null,revision:override?.revision??0};
        const previous=rows.findIndex(row=>row.key===key);if(previous<0)rows.push(entry);else rows[previous]=entry;
      };
      for(const id of ids){const product=await getProduct(id);for(const sku of product.skus)if(sku.id)await append([{itemId:id,sourceSkuId:sku.id,quantity:1}]);}
      const suppliedIds=new Set(compositions.map(row=>row.id));
      for(const saved of repository!.list())if(saved.target.kind==='combination'&&!suppliedIds.has(saved.target.id)&&saved.target.composition.some(member=>ids.includes(member.itemId)))await append(saved.target.composition,saved.target.id);
      for(const value of compositions){only(value,['id','members']);if(!Array.isArray(value.members)||!value.members.length||value.members.length>100)fail('组合需包含 1 至 100 个规格。');await append(value.members as any[],text(value.id,'组合'));}
      return {rows,products:[...products.values()].map(({id,title,skus})=>({id,title,skuCount:skus.length})),warnings:[...products.values()].filter(product=>product.skus.some(sku=>!sku.id)).map(product=>`${product.title} 有缺少稳定编号的来源规格，暂不能维护这些规格。`)};
    }
    if(operation==='packaging.save'||operation==='packaging.remove') {
      only(input,['rows']);const inputRows=Array.isArray(input.rows)?input.rows:fail('请选择要保存的包装行。');if(inputRows.length<1||inputRows.length>1000)fail('请选择要保存的包装行。');
      const changes=[];
      for(const value of inputRows){
        const row=object(value);only(row,['target','values','expectedRevision']);
        if(!Number.isSafeInteger(row.expectedRevision)||Number(row.expectedRevision)<0)fail('包装修订号无效。');
        const target=object(row.target) as unknown as PackagingTarget;
        if(target.kind!=='sku'&&target.kind!=='combination')fail('包装行类型无效。');
        const members=membersOf(target);if(!Array.isArray(members)||!members.length||members.length>100)fail('销售组成无效。');
        const hydrated=await hydrate(members),resolved=repository!.resolve({members:hydrated,...(target.kind==='combination'?{combinationId:text(target.id,'组合')}:{})});
        changes.push({target:resolved.target,values:operation==='packaging.remove'?{weightKg:null,dimensionsCm:null}:object(row.values) as PackagingValues,expectedRevision:Number(row.expectedRevision)});
      }
      signal?.throwIfAborted();return {saved:repository!.saveOverrides(changes)};
    }
    return fail('不支持此包装维护操作。');
  }
}
