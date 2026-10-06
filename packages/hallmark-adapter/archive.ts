import type { AdapterResult, ArchiveProductsRaw, ArchiveProductsResult, SubmitArchiveProductsInput } from './types.ts';
import { explicitStoreId } from './category.ts';

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const offer = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value === value.trim() && value.length <= 4000;
function invalid(): ArchiveProductsResult {
  return { status: 'failed', error: { code: 'ARCHIVE_INPUT_INVALID', message: '归档需持久稳定的 1–80 位 ASCII 字母数字连字符请求编号及 1–200 个明确唯一的完整店铺+Offer；不接受额外平台字段', retryable: false } };
}
export function archiveInput(input: SubmitArchiveProductsInput): SubmitArchiveProductsInput | ArchiveProductsResult {
  if (!plain(input) || Object.keys(input).some(key => !['requestId', 'selected'].includes(key))
    || typeof input.requestId !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(input.requestId)
    || !Array.isArray(input.selected) || !input.selected.length || input.selected.length > 200
    || input.selected.some(row => !plain(row) || Object.keys(row).some(key => !['storeId', 'offerId'].includes(key))
      || !explicitStoreId(row.storeId) || !offer(row.offerId))) return invalid();
  const selected = input.selected.map(row => ({ storeId: row.storeId, offerId: row.offerId }));
  if (new Set(selected.map(row => JSON.stringify(row))).size !== selected.length
    || Buffer.byteLength(JSON.stringify({ requestId: input.requestId, selected }), 'utf8') > 1_000_000) return invalid();
  return { requestId: input.requestId, selected }; // Preserve caller order for the Source global idempotency key.
}
function unknown(result: AdapterResult<ArchiveProductsRaw>, code = 'OUTCOME_UNKNOWN', message = '原归档结果未确定；没有原归档 GET 记录接口，不能以重提 POST 当作查询或自动换编号重写'): ArchiveProductsResult {
  return { ...result, status: 'unknown', stage: 'unknown', error: { code, message, retryable: false } };
}
export function archiveResult(result: AdapterResult<ArchiveProductsRaw>, input: SubmitArchiveProductsInput, httpStatus?: number): ArchiveProductsResult {
  // Source wraps errors after actual platform sends/FINISHED/local-snapshot persistence as HTTP400 ARCHIVE_FAILED.
  if (result.error?.code === 'ARCHIVE_FAILED') return unknown(result);
  if (result.status !== 'ok') {
    if (result.status === 'unknown' || ['INVALID_RESPONSE', 'SPILL_FAILED'].includes(result.error?.code ?? '')
      || httpStatus !== undefined && (httpStatus >= 500 || httpStatus === 408)) return unknown(result);
    return result;
  }
  const raw: unknown = result.raw;
  if (!plain(raw) || raw.requestId !== input.requestId || !Array.isArray(raw.results) || raw.results.length !== input.selected.length) {
    return unknown(result, 'ARCHIVE_INVALID_RECEIPT', '归档回执缺少原请求编号或精确完整逐商品结果；平台 result:true 不等于已归档');
  }
  const selected = new Set(input.selected.map(row => JSON.stringify([row.storeId, row.offerId])));
  const seen = new Set<string>();
  for (const row of raw.results) {
    if (!plain(row) || !explicitStoreId(row.storeId) || !offer(row.offerId)
      || !['archived', 'pending', 'unknown', 'rejected'].includes(String(row.state))
      || row.message !== undefined && typeof row.message !== 'string') return unknown(result, 'ARCHIVE_INVALID_RECEIPT', '归档回执身份或状态不完整');
    const key = JSON.stringify([row.storeId, row.offerId]);
    if (!selected.has(key) || seen.has(key)) return unknown(result, 'ARCHIVE_INVALID_RECEIPT', '归档回执包含范围外、重复或遗漏的精确店铺+Offer');
    seen.add(key);
  }
  // archived comes from Source's exact offer+current product-ID+is_archived readback, not from platform acceptance.
  if (raw.results.every(row => row.state === 'archived')) return { ...result, stage: 'archived' };
  if (raw.results.every(row => row.state === 'rejected')) return { ...result, status: 'failed', stage: 'rejected',
    error: { code: 'ARCHIVE_REJECTED', message: '原归档逐商品结果均拒绝；不自动重发', retryable: false } };
  if (raw.results.some(row => row.state === 'archived')) return { ...unknown(result, 'ARCHIVE_PARTIAL_RESULT', '部分商品已核实归档，其他结果须分别保留，不自动重写'), stage: 'mixed' };
  if (raw.results.some(row => row.state === 'unknown')) return unknown(result);
  return { ...unknown(result, 'ARCHIVE_PENDING', '平台已接收但尚未按精确商品核实归档，不能冒充已完成'), stage: 'pending' };
}
