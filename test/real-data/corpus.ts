import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeProduct } from '../../packages/collection/src/normalize.ts';
import type { CollectionProduct } from '../../packages/collection/src/types.ts';

export type RealSource = 'taobao_tmall' | 'alibaba_com' | 'pinduoduo';
export interface RealResponseProvenance {
  method: 'GET' | 'POST'; url: string; fetchedAt: string; status: number;
  sha256: string; valueSha256: string; responseFile: string;
}
export interface RealSourceRecord {
  summary: Record<string, any>; detail: Record<string, any>; raw: Record<string, any>;
  sampling: { titleFamily: string | null; categoryPath: string[]; features: string[]; reasons: string[] };
  provenance: { summary: Record<string, any>; detail: RealResponseProvenance; raw: RealResponseProvenance; originalSourceCapturedAt: string | null };
}
export interface RealCorpus {
  schemaVersion: number; capturedAt: string; provider: string; poolCapturedAt: string;
  acquisition: string; samplingRules: Record<string, any>; records: RealSourceRecord[];
  ancillary: Record<'stores' | 'storeProducts' | 'tasks' | 'pricingSettings', { data: any; provenance: RealResponseProvenance }>;
  imageAssets: Array<{ productId: string; status: string; file?: string; mimeType?: string; sha256?: string; url: string; fetchedAt: string }>;
}
export const realCorpusPath = process.env.DSH_REAL_CORPUS
  ? path.resolve(process.env.DSH_REAL_CORPUS)
  : fileURLToPath(new URL('../../artifacts/real-source-tests-20261013/corpus.json', import.meta.url));
let cached: RealCorpus | undefined;
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function evidenceFile(filename: string): string {
  const base = path.dirname(realCorpusPath), resolved = path.resolve(base, filename), relative = path.relative(base, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Invalid real evidence path: ${filename}`);
  return resolved;
}
function verifyResponse(value: unknown, provenance: RealResponseProvenance, label: string): void {
  if (digest(value) !== provenance.valueSha256) throw new Error(`Real corpus value integrity failed: ${label}`);
  const bytes = readFileSync(evidenceFile(provenance.responseFile));
  if (createHash('sha256').update(bytes).digest('hex') !== provenance.sha256 || digest(JSON.parse(bytes.toString('utf8'))) !== provenance.valueSha256) throw new Error(`Real response byte integrity failed: ${label}`);
}
function load(): RealCorpus {
  if (cached) return cached;
  let data: RealCorpus;
  try {
    const bytes = readFileSync(realCorpusPath), expectedHash = readFileSync(`${realCorpusPath}.sha256`, 'utf8').trim().split(/\s+/)[0];
    if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new Error('Real corpus manifest SHA-256 mismatch');
    data = JSON.parse(bytes.toString('utf8'));
  }
  catch (error) { throw new Error(`Real test corpus unavailable at ${realCorpusPath}. Capture it with node scripts/capture-real-source-corpus.mjs or set DSH_REAL_CORPUS. Tests never fall back to synthetic business data.`, { cause: error }); }
  const expected: Record<RealSource, number> = { taobao_tmall: 20, alibaba_com: 20, pinduoduo: 1 };
  if (data.schemaVersion !== 1 || !Array.isArray(data.records) || data.records.length !== 41) throw new Error('Real test corpus must contain schema 1 and exactly 41 source records');
  for (const [source, count] of Object.entries(expected)) if (data.records.filter(row => row.detail.source === source).length !== count) throw new Error(`Real test corpus requires ${count} ${source} records`);
  if (new Set(data.records.map(row => row.detail.id)).size !== 41) throw new Error('Real test corpus has duplicate product IDs');
  for (const row of data.records) {
    for (const name of ['detail', 'raw'] as const) verifyResponse(row[name], row.provenance[name], `${row.detail.id} ${name}`);
    if (digest(row.summary) !== row.provenance.summary.valueSha256) throw new Error(`Real corpus integrity check failed: ${row.detail.id} summary`);
  }
  for (const [name, response] of Object.entries(data.ancillary ?? {})) verifyResponse(response.data, response.provenance, name);
  for (const image of data.imageAssets ?? []) if (image.status === 'captured') {
    const bytes = readFileSync(evidenceFile(image.file!));
    if (createHash('sha256').update(bytes).digest('hex') !== image.sha256) throw new Error(`Real image byte integrity failed: ${image.productId}`);
  }
  cached = data;
  return data;
}
/** Original immutable snapshots are cloned for every caller. */
export function realCorpus(): RealCorpus { return structuredClone(load()); }
export function realSourceProducts(source?: RealSource): Array<Record<string, any>> {
  return structuredClone(load().records.filter(row => !source || row.detail.source === source).map(row => row.detail));
}
export function realSourceSummaries(source?: RealSource): Array<Record<string, any>> {
  return structuredClone(load().records.filter(row => !source || row.detail.source === source).map(row => row.summary));
}
function record(selector: number | string = 0): RealSourceRecord {
  const rows = load().records;
  const selected = typeof selector === 'number' ? rows[selector] : rows.find(row => row.detail.id === selector || row.detail.source === selector || row.sampling.features.includes(selector) || row.sampling.titleFamily === selector);
  if (!selected) throw new Error(`No real corpus record matches ${selector}`);
  return selected;
}
export function realDetail(selector: number | string = 0): Record<string, any> { return structuredClone(record(selector).detail); }
/** HTTP /raw envelope retained exactly; parse .content to inspect original source fields. */
export function realRaw(selector: number | string = 0): Record<string, any> { return structuredClone(record(selector).raw); }
export function realRawContent(selector: number | string = 0): Record<string, any> { return JSON.parse(realRaw(selector).content); }
/** Derived only by the production normalizeProduct mapping; source values are untouched. */
export function realCollection(selector: number | string = 0): CollectionProduct {
  const row = record(selector);
  return normalizeProduct(structuredClone(row.detail), 'real-source-corpus', row.provenance.detail.fetchedAt);
}
export function realCollections(source?: RealSource): CollectionProduct[] {
  return load().records.filter(row => !source || row.detail.source === source).map(row => realCollection(row.detail.id));
}
export function realStores(): Array<Record<string, any>> { return structuredClone(load().ancillary.stores.data); }
/** GET /api/store-products envelope: {stores,products}. */
export function realStoreProducts(): { stores: Array<Record<string, any>>; products: Array<Record<string, any>> } { return structuredClone(load().ancillary.storeProducts.data); }
export function realTasks(): Array<Record<string, any>> { return structuredClone(load().ancillary.tasks.data); }
export function realPricingSettings(): Record<string, any> { return structuredClone(load().ancillary.pricingSettings.data); }
export function realAncillary(name: string): any {
  const response = (load().ancillary as Record<string, { data: any }>)[name];
  if (!response) throw new Error(`No captured real ancillary response named ${name}`);
  return structuredClone(response.data);
}
/** Scenario override helpers are explicitly derived inputs, never authentic unchanged snapshots. */
export const realScenarioProvenance = { base: 'real captured source data', overrides: 'derived test condition; not marketplace evidence' } as const;
export function realScenarioDetail(overrides: Record<string, any> = {}, selector: number | string = 0): Record<string, any> { return { ...realDetail(selector), ...structuredClone(overrides) }; }
export function realScenarioProduct(overrides: Record<string, any> = {}, index = 0): Record<string, any> {
  const product = load().ancillary.storeProducts.data.products[index];
  if (!product) throw new Error(`No real sales product at index ${index}`);
  return { ...structuredClone(product), ...structuredClone(overrides) };
}
export function realScenarioSku(overrides: Record<string, any> = {}, selector: number | string = 0, index = 0): Record<string, any> {
  const sku = record(selector).detail.skus?.[index];
  if (!sku) throw new Error(`No real source SKU at ${selector} index ${index}; choose a nonempty real sample`);
  return { ...structuredClone(sku), ...structuredClone(overrides) };
}
