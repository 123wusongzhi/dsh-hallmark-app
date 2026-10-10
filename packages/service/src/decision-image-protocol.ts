import type { SemanticReviewRequest } from '../../app-contracts/src/business-review.ts';

type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';
type CachedImage = { url: string; bytes: number; expiresAt: number };
export interface DecisionImageProtocolOptions {
  fetchImpl?: typeof fetch;
  maxImageBytes?: number;
  maxRequestBytes?: number;
  maxCacheBytes?: number;
  maxCacheEntries?: number;
  cacheTtlMs?: number;
}

export class DecisionImageProtocolError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const fail = (code: string): never => { throw new DecisionImageProtocolError(code); };
function imageType(bytes: Uint8Array): ImageType | undefined {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return 'image/webp';
  return undefined;
}

/** Native Decisions image parts: https://openrouter.ai/docs/guides/community/multimodal-decisions */
export function createDecisionImageProtocol(options: DecisionImageProtocolOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxImageBytes = options.maxImageBytes ?? 10 * 1024 * 1024;
  const maxRequestBytes = options.maxRequestBytes ?? 32 * 1024 * 1024;
  const maxCacheBytes = options.maxCacheBytes ?? 32 * 1024 * 1024;
  const maxCacheEntries = options.maxCacheEntries ?? 32;
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  if ([maxImageBytes, maxRequestBytes, maxCacheBytes, maxCacheEntries, cacheTtlMs].some(value => !Number.isSafeInteger(value) || value < 1)) {
    throw new Error('Invalid decision image protocol configuration');
  }
  const cache = new Map<string, CachedImage>();
  let cacheBytes = 0;
  const remove = (key: string) => { const prior = cache.get(key); if (prior) cacheBytes -= prior.bytes; cache.delete(key); };
  const expire = () => { const now = Date.now(); for (const [key, value] of cache) if (value.expiresAt <= now) remove(key); };
  async function load(url: string, signal?: AbortSignal): Promise<CachedImage> {
    signal?.throwIfAborted();
    expire();
    const prior = cache.get(url);
    if (prior) { cache.delete(url); cache.set(url, prior); return prior; }
    let data: Uint8Array;
    let mediaType: string | undefined;
    if (url.startsWith('data:')) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
      if (!match) return fail('decision_image_unsupported');
      if (match[2].length > Math.ceil(maxImageBytes / 3) * 4) return fail('decision_image_too_large');
      data = Buffer.from(match[2], 'base64'); mediaType = match[1];
      if (Buffer.from(data).toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) return fail('decision_image_invalid');
    } else {
      let parsed: URL;
      try { parsed = new URL(url); } catch { return fail('decision_image_invalid'); }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return fail('decision_image_invalid');
      let response: Response;
      try { response = await fetchImpl(parsed, { signal, redirect: 'error' }); }
      catch { signal?.throwIfAborted(); return fail('decision_image_unavailable'); }
      signal?.throwIfAborted();
      mediaType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!response.ok || !response.body) { await response.body?.cancel(); return fail('decision_image_unavailable'); }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mediaType ?? '')) { await response.body.cancel(); return fail('decision_image_unsupported'); }
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > maxImageBytes) { await response.body.cancel(); return fail('decision_image_too_large'); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          signal?.throwIfAborted();
          const result = await reader.read();
          if (result.done) break;
          bytes += result.value.byteLength;
          if (bytes > maxImageBytes) return fail('decision_image_too_large');
          chunks.push(result.value);
        }
      } finally { await reader.cancel(); }
      data = Buffer.concat(chunks);
    }
    signal?.throwIfAborted();
    if (!data.length || data.length > maxImageBytes) return fail('decision_image_too_large');
    if (imageType(data) !== mediaType) return fail('decision_image_invalid');
    const value = { url: `data:${mediaType};base64,${Buffer.from(data).toString('base64')}`, bytes: data.byteLength, expiresAt: Date.now() + cacheTtlMs };
    if (value.bytes <= maxCacheBytes) {
      expire();
      remove(url);
      while (cache.size && (cache.size >= maxCacheEntries || cacheBytes + value.bytes > maxCacheBytes)) remove(cache.keys().next().value!);
      cache.set(url, value); cacheBytes += value.bytes;
    }
    return value;
  }
  return {
    name: 'openrouter-decisions-native-images-v1',
    async buildState(input: SemanticReviewRequest, signal?: AbortSignal): Promise<Array<string | { type: 'image_url'; image_url: { url: string } }>> {
      signal?.throwIfAborted();
      const images = input.images ?? [];
      if (images.length > 128) return fail('decision_image_count_exceeded');
      const state: Array<string | { type: 'image_url'; image_url: { url: string } }> = [
        JSON.stringify({ source: input.source, draft: input.draft, versions: input.versions, images: images.map(({ id, role }) => ({ id, role })) }),
      ];
      const loaded = new Map<string, CachedImage>();
      let requestBytes = 0;
      for (const image of images) {
        const value = loaded.get(image.url) ?? await load(image.url, signal);
        loaded.set(image.url, value);
        requestBytes += value.bytes;
        if (requestBytes > maxRequestBytes) return fail('decision_images_too_large');
        state.push(`Image ${image.id} (${image.role})`, { type: 'image_url', image_url: { url: value.url } });
      }
      signal?.throwIfAborted();
      return state;
    },
  };
}
