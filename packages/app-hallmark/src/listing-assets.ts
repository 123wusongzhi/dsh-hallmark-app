import { createHash } from 'node:crypto';
import { lstat, realpath, open, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { CapabilityDescriptor } from '../../app-contracts/src/index.ts';

interface AssetStore { get<T>(namespace: string, id: string): T | undefined; put<T>(namespace: string, id: string, value: T): T }
export interface ListingAssetFile { path: string }
export interface ListingAssetPublisherOptions { baseUrl: string; operatorToken?: string; store: AssetStore; fetchImpl?: typeof fetch; timeBudgetMs?: number }
interface PublishedAsset { assetId: string; contentHash: string; url: string; mimeType: string; byteLength: number; width: number; height: number; verifiedAt: string; mode: string }
interface ReadyFile { index: number; path: string; data: Buffer; contentHash: string; mimeType: string; extension: string; key: string; assetId?: string; width?: number; height?: number }
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
// Stays below the descriptor timeout so unfinished files come back as explicit per-file results.
const PUBLISH_TIME_BUDGET_MS = 240_000;
/** URL index of publisher-verified bytes; later listing steps reuse the hash instead of downloading again. */
export const LISTING_ASSET_URL_NAMESPACE = 'business_listing_asset_urls';
export const listingAssetUrlKey = (url: string) => createHash('sha256').update(url).digest('hex');
export interface VerifiedListingAssetUrl { url: string; contentHash: string; verifiedAt: string; mode: string }
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
// The current image service returns an algorithm-qualified hash; persisted plugin hashes stay bare.
const imageDigest = (value: unknown): string | null => typeof value === 'string' ? /^(?:sha256:)?([0-9a-f]{64})$/.exec(value)?.[1] ?? null : null;
const PROVIDER_ERROR_CODES = new Set(['IMAGE_PUBLISH_INVALID','IMAGE_ASSET_NOT_FOUND','IMAGE_DELIVERY_CONFIG_INVALID','IMAGE_STABLE_ORIGIN_CONFIG_MISSING','IMAGE_PUBLISH_SYNC_FAILED','INVALID_JSON','REQUEST_TOO_LARGE','INTERNAL_ERROR']);
class AssetError extends Error { code: string; providerCode?:string; constructor(code: string, message: string,providerCode?:string) { super(message); this.code = code; this.providerCode=providerCode; } }
function imageType(data: Buffer): { mimeType: string; extension: string } {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: 'image/png', extension: 'png' };
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return { mimeType: 'image/jpeg', extension: 'jpg' };
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return { mimeType: 'image/webp', extension: 'webp' };
  throw new AssetError('LISTING_IMAGE_TYPE', '请选择 PNG、JPEG 或 WebP 图片');
}
function safeFailure(error: unknown, outOfTime = false) {
  if (outOfTime) return { code: 'LISTING_ASSET_TIME_BUDGET', message: '本次调用时间已用完，该图片尚未确认交付；用同一文件再次调用即可，已成功图片会直接复用' };
  return error instanceof AssetError ? { code: error.code, message: error.message } : { code: 'LISTING_ASSET_TRANSFER_FAILED', message: '图片交付未完成，保留原文件后可重试；已成功图片不受影响' };
}

/** Replaceable image-delivery adapter. Content addressing makes repeated upload safe. */
export class ListingAssetPublisher {
  readonly options: ListingAssetPublisherOptions;
  constructor(options: ListingAssetPublisherOptions) { this.options = options; }
  private async request(path: string, body?: unknown, signal?: AbortSignal): Promise<any> {
    const response = await (this.options.fetchImpl ?? fetch)(`${this.options.baseUrl.replace(/\/$/, '')}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(this.options.operatorToken ? { authorization: `Bearer ${this.options.operatorToken}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      let providerCode:string|undefined;
      try{const body=JSON.parse((await boundedBody(response,16*1024)).toString('utf8'));if(typeof body.code==='string'&&PROVIDER_ERROR_CODES.has(body.code))providerCode=body.code;}catch{}
      throw new AssetError('LISTING_ASSET_PROVIDER_FAILED', `图片服务返回 HTTP ${response.status}${providerCode?`（${providerCode}）`:''}，请重试或检查图片交付连接`,providerCode);
    }
    const raw = await boundedBody(response, 256 * 1024);
    try { return JSON.parse(raw.toString('utf8')); } catch { throw new AssetError('LISTING_ASSET_PROVIDER_INVALID', '图片服务返回了无效结果'); }
  }
  async publish(input: { files: ListingAssetFile[] }, signal?: AbortSignal): Promise<any> {
    if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > 20) throw new AssetError('LISTING_ASSET_FILES_REQUIRED', '每次请选择 1–20 个图片文件');
    const results: any[] = Array(input.files.length), pending: ReadyFile[] = [];
    const contentOwners = new Map<string, number>(), duplicates: Array<{ index: number; owner: number; path: string }> = [];
    // One deadline for the whole call; the caller's own cancellation keeps its ordinary failure.
    const budget = AbortSignal.timeout(this.options.timeBudgetMs ?? PUBLISH_TIME_BUDGET_MS), callSignal = signal ? AbortSignal.any([signal, budget]) : budget;
    const failure = (error: unknown) => safeFailure(error, budget.aborted && !signal?.aborted);
    let access: any, importRoot: string, publicBase: URL;
    try {
      access = await this.request('/api/images/access', undefined, callSignal);
      if (!access.importRoot || !access.delivery?.publicBaseUrl || !['stable', 'quick'].includes(access.delivery.mode)) throw new AssetError('LISTING_ASSET_DELIVERY_MISSING', '尚未配置图片导入目录和公网交付地址');
      if (access.delivery.mode === 'stable' && !access.stablePublisherConfigured) throw new AssetError('LISTING_ASSET_DELIVERY_MISSING', '稳定图片交付服务未配置');
      importRoot = await realpath(resolve(access.importRoot));
      if (!(await lstat(importRoot)).isDirectory()) throw new AssetError('LISTING_ASSET_IMPORT_ROOT', '图片导入目录不可用');
      publicBase = new URL(access.delivery.publicBaseUrl);
      if (publicBase.protocol !== 'https:' || publicBase.username || publicBase.password || publicBase.search || publicBase.hash) throw new AssetError('LISTING_ASSET_DELIVERY_INVALID', '图片公网地址配置无效');
    } catch (error) {
      return { status: 'failed', successCount: 0, failureCount: input.files.length, files: input.files.map(file => ({ path: file.path, status: 'failed', error: failure(error) })) };
    }
    let total = 0;
    for (const [index, file] of input.files.entries()) {
      try {
        if (typeof file.path !== 'string' || !file.path.trim() || !isAbsolute(file.path)) throw new AssetError('LISTING_ASSET_PATH', '图片需要明确的本机绝对路径');
        const path = resolve(file.path), info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink()) throw new AssetError('LISTING_ASSET_NOT_FILE', '请选择普通图片文件');
        if (!info.size || info.size > MAX_BYTES) throw new AssetError('LISTING_ASSET_SIZE', '每张图片应大于 0 且不超过 20 MiB');
        const data = await boundedFile(path, MAX_BYTES);
        if (!data.length || data.length > MAX_BYTES) throw new AssetError('LISTING_ASSET_SIZE', '每张图片应大于 0 且不超过 20 MiB');
        total += data.length; if (total > MAX_TOTAL_BYTES) throw new AssetError('LISTING_ASSET_BATCH_SIZE', '本次图片总量超过 100 MiB，请分批交付');
        const kind = imageType(data), contentHash = sha256(data), key = sha256(Buffer.from(`${publicBase!.href}\n${contentHash}`));
        // Still read and validate each selected file: paths may change during a call.
        // Only the transfer of the exact observed bytes is shared, never its bindings.
        const owner = contentOwners.get(key);
        if (owner !== undefined) { duplicates.push({ index, owner, path }); continue; }
        contentOwners.set(key, index);
        const saved = this.options.store.get<PublishedAsset>('business_listing_assets', key);
        if (saved?.contentHash === contentHash && saved.url && saved.verifiedAt && Date.now() - Date.parse(saved.verifiedAt) < 60 * 60 * 1000) {
          results[index] = { path, status: 'ready', ...saved, reused: true }; continue;
        }
        const frozenPath = join(importRoot!, `dsh-listing-${contentHash}.${kind.extension}`);
        const within = relative(importRoot!, frozenPath);
        if (isAbsolute(within) || within.startsWith('..')) throw new AssetError('LISTING_ASSET_IMPORT_ROOT', '图片导入位置无效');
        // Immutable snapshot: published bytes remain the ones read from this exact file invocation.
        try { await writeFile(frozenPath, data, { flag: 'wx' }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          const snapshotStat = await lstat(frozenPath);
          if (!snapshotStat.isFile() || snapshotStat.isSymbolicLink() || snapshotStat.size !== data.length || await realpath(frozenPath) !== frozenPath || sha256(await boundedFile(frozenPath, MAX_BYTES)) !== contentHash) throw new AssetError('LISTING_ASSET_SNAPSHOT_CONFLICT', '同名图片快照内容不一致，请检查导入目录');
        }
        const imported = await this.request('/api/images/import/local', { filePath: frozenPath }, callSignal);
        if (imported.assetId !== `image-v1-${contentHash}` || imageDigest(imported.contentHash) !== contentHash || imported.mediaType !== kind.mimeType || imported.byteLength !== data.length || !Number.isInteger(imported.width) || imported.width <= 0 || !Number.isInteger(imported.height) || imported.height <= 0) throw new AssetError('LISTING_ASSET_IMPORT_MISMATCH', '图片导入结果与本次实际文件不一致');
        pending.push({ index, path, data, contentHash, ...kind, key, assetId: imported.assetId, width: imported.width, height: imported.height });
      } catch (error) { results[index] = { path: file.path, status: 'failed', error: failure(error) }; }
    }
    // The old SFTP adapter processes a batch serially. Keep one Agent call, but
    // preserve each small batch and retry only its content-addressed sync failure.
    for(let offset=0;offset<pending.length;offset+=3) {
      const batch=pending.slice(offset,offset+3);
      let published: any;
      try {
        const body={assetIds:[...new Set(batch.map(file=>file.assetId))]};
        try {published=await this.request('/api/images/publish',body,callSignal);}
        catch(error){if(!(error instanceof AssetError)||error.providerCode!=='IMAGE_PUBLISH_SYNC_FAILED'||callSignal.aborted)throw error;published=await this.request('/api/images/publish',body,callSignal);}
      }
      catch (error) { for (const file of batch) results[file.index] = { path: file.path, contentHash: file.contentHash, assetId: file.assetId, status: 'failed', error: failure(error) }; }
      if (published) {
        let index = 0;
        await Promise.all(Array.from({ length: batch.length }, async () => {
          while (index < batch.length) {
            const file = batch[index++];
            try {
              const result = Array.isArray(published.assets) ? published.assets.find((a: any) => a.assetId === file.assetId) : undefined;
              if (!result?.publicUrl) throw new AssetError('LISTING_ASSET_RESULT_MISSING', '图片交付结果缺少该文件的公网地址');
              const url = new URL(result.publicUrl);
              if (url.origin !== publicBase!.origin || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.includes(file.assetId!)) throw new AssetError('LISTING_ASSET_PUBLIC_URL', '交付图片地址与配置或内容身份不一致');
              const response = await (this.options.fetchImpl ?? fetch)(url, { redirect: 'error', signal: AbortSignal.any([callSignal, AbortSignal.timeout(30_000)]) });
              if (!response.ok) throw new AssetError('LISTING_ASSET_PUBLIC_UNAVAILABLE', `公网图片暂不可读取（HTTP ${response.status}）`);
              const received = await boundedBody(response, MAX_BYTES);
              if (sha256(received) !== file.contentHash || imageType(received).mimeType !== file.mimeType) throw new AssetError('LISTING_ASSET_PUBLIC_MISMATCH', '公网图片内容与生成文件不一致');
              const saved: PublishedAsset = { assetId: file.assetId!, contentHash: file.contentHash, url: url.href, mimeType: file.mimeType, byteLength: file.data.length, width: file.width!, height: file.height!, verifiedAt: new Date().toISOString(), mode: access.delivery.mode };
              this.options.store.put('business_listing_assets', file.key, saved);
              this.options.store.put<VerifiedListingAssetUrl>(LISTING_ASSET_URL_NAMESPACE, listingAssetUrlKey(saved.url), { url: saved.url, contentHash: saved.contentHash, verifiedAt: saved.verifiedAt, mode: saved.mode });
              results[file.index] = { path: file.path, status: 'ready', ...saved, reused: false };
            } catch (error) { results[file.index] = { path: file.path, contentHash: file.contentHash, assetId: file.assetId, status: 'failed', error: failure(error) }; }
          }
        }));
      }
    }
    for (const file of duplicates) results[file.index] = { ...structuredClone(results[file.owner]), path: file.path };
    const successCount = results.filter(file => file.status === 'ready').length;
    return { status: successCount === results.length ? 'ready' : successCount ? 'partial' : 'failed', successCount, failureCount: results.length - successCount, files: results };
  }
}

async function boundedFile(path: string, max: number): Promise<Buffer> {
  const handle = await open(path, 'r'), chunks: Buffer[] = []; let size = 0;
  try {
    if (!(await handle.stat()).isFile()) throw new AssetError('LISTING_ASSET_NOT_FILE', '请选择普通图片文件');
    while (true) {
      const chunk = Buffer.allocUnsafe(64 * 1024), { bytesRead } = await handle.read(chunk);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > max) throw new AssetError('LISTING_ASSET_SIZE', '每张图片不超过 20 MiB');
      chunks.push(chunk.subarray(0, bytesRead));
    }
  } finally { await handle.close(); }
  return Buffer.concat(chunks);
}

async function boundedBody(response: Response, max: number): Promise<Buffer> {
  if (Number(response.headers.get('content-length')) > max) throw new AssetError('LISTING_ASSET_RESPONSE_SIZE', '图片服务返回内容超过允许大小');
  if (!response.body) throw new AssetError('LISTING_ASSET_RESPONSE_EMPTY', '图片服务返回空内容');
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) throw new AssetError('LISTING_ASSET_RESPONSE_SIZE', '图片服务返回内容超过允许大小'); chunks.push(value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

export const LISTING_ASSET_DESCRIPTOR: CapabilityDescriptor = {
  capabilityId: 'hallmark.listing.assets.publish', version: '1.0.0', title: '交付上品图片',
  description: '将明确选中的本机 PNG、JPEG 或 WebP 成品图片交付为平台可读公网地址。程序自动导入、缓存和核对实际图片；同一内容重复调用直接复用。返回逐文件地址与内容版本；图片对应哪条销售行写在 images.json，不在此接口传递。单次调用约 4 分钟内结束，未及完成的文件逐个返回 LISTING_ASSET_TIME_BUDGET，原样重试即可；失败不影响其他已成功图片。用于草稿素材，不提交 Ozon 商品。', effect: 'mutation',
  inputSchema: { type: 'object', properties: { files: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { path: { type: 'string', minLength: 1 } }, required: ['path'], additionalProperties: false } } }, required: ['files'], additionalProperties: false },
  outputSchema: { type: 'object', additionalProperties: true },
  execution: { mode: 'sync', timeoutMs: 300_000, concurrency: 'exclusive', lockScope: 'connection', idempotency: 'upstream_supported', completionEvidence: 'readback' },
  discovery: { defaultVisible: true, keywords: ['上品', '图片', '素材', '主图', '发布图片'] }, aliases: [],
};
