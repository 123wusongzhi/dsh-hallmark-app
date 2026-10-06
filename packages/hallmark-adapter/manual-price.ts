import type { AdapterResult, OrdinaryCnyOperationRaw, OrdinaryCnyOperationResult, OrdinaryCnyPriceProduct, SubmitOrdinaryCnyPriceInput } from './types.ts';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const STORE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const positiveId = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const offer = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value === value.trim();
const minor = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return undefined;
  const [whole, fraction = ''] = value.split('.');
  const significant = whole.replace(/^0+/, '') || '0';
  if (significant.length > 14) return undefined;
  const amount = BigInt(significant) * 100n + BigInt(fraction.padEnd(2, '0'));
  return amount > 0n && amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : undefined;
};
const nullableMinor = (value: unknown) => value === null || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function invalid(message: string): OrdinaryCnyOperationResult {
  return { status: 'failed', error: { code: 'ORDINARY_PRICE_INPUT_INVALID', message, retryable: false } };
}
export function validateOrdinaryIdentity(storeId: unknown, operationId: unknown): OrdinaryCnyOperationResult | undefined {
  if (typeof storeId !== 'string' || !STORE.test(storeId) || typeof operationId !== 'string' || !UUID.test(operationId)) {
    return invalid('必须显式指定完整店铺 ID 和此逻辑修改持久保存的小写 UUID；不会选择默认店铺或生成新编号');
  }
  return undefined;
}
export interface OrdinaryWireSelection {
  id: string; actionId: 0; kind: 'ordinary'; products: Array<OrdinaryCnyPriceProduct & { stock: '0' }>;
}
/** Build only the proved Source ordinary wire; reject unsupported fields rather than silently dropping them. */
export function ordinarySelection(input: SubmitOrdinaryCnyPriceInput): OrdinaryWireSelection | OrdinaryCnyOperationResult {
  if (!plain(input) || !fields(input, ['operationId', 'storeId', 'products'])) return invalid('普通人民币售价接口不接受额外币种、活动、划线价、仓库或库存修改字段');
  const identityError = validateOrdinaryIdentity(input.storeId, input.operationId);
  if (identityError) return identityError;
  if (!Array.isArray(input.products) || !input.products.length || input.products.length > 1000) return invalid('普通售价需明确选择 1–1000 件商品');
  for (const product of input.products) {
    if (!plain(product) || !fields(product, ['productId', 'offerId', 'price']) || !positiveId(product.productId)
      || !offer(product.offerId) || minor(product.price) === undefined) {
      return invalid('每件商品需真实正整数平台 ID、精确非空 Offer 和用户指定的正数十进制售价（最多两位小数）');
    }
  }
  if (new Set(input.products.map(p => p.productId)).size !== input.products.length
    || new Set(input.products.map(p => p.offerId)).size !== input.products.length) return invalid('明确商品清单中的平台 ID 或 Offer 不得重复');
  const selection: OrdinaryWireSelection = { id: input.operationId, actionId: 0, kind: 'ordinary',
    products: input.products.map(p => ({ productId: p.productId, offerId: p.offerId, price: p.price, stock: '0' })) };
  if (Buffer.byteLength(JSON.stringify(selection), 'utf8') > 256 * 1024) return invalid('原普通售价 HTTP 请求超过 256 KiB；不会隐式拆单或创建新操作编号');
  return selection;
}
function unknown(result: AdapterResult<OrdinaryCnyOperationRaw>, code: string, message: string): OrdinaryCnyOperationResult {
  return { ...result, status: 'unknown', stage: 'outcome_unknown', error: { code, message, retryable: false } };
}
/** Stage is an adapter sidecar only. The Source object (including additive fields) is never changed. */
export function ordinaryResult(result: AdapterResult<OrdinaryCnyOperationRaw>, storeId: string, operationId: string,
  httpStatus?: number, expected?: readonly OrdinaryCnyPriceProduct[]): OrdinaryCnyOperationResult {
  if (httpStatus === 404) {
    return { ...unknown(result, 'SOURCE_OPERATION_NOT_FOUND', '原接口/操作尚未可读取；准备阶段可能仍在继续，不能据此重发或猜测新编号'), stage: 'not_found' };
  }
  if (result.status !== 'ok') {
    if (result.status === 'unknown' || ['INVALID_RESPONSE', 'SPILL_FAILED'].includes(result.error?.code ?? '')
      || httpStatus !== undefined && (httpStatus >= 500 || httpStatus === 408)) {
      return { ...result, status: 'unknown', stage: 'outcome_unknown', error: { code: 'OUTCOME_UNKNOWN',
        message: '未取得原普通售价操作的可靠记录；保留原店铺和 UUID，只能查询或显式只读核实，禁止重发', retryable: false } };
    }
    // Auth/health/input/explicit preparation refusals are not fabricated operation stages.
    return result;
  }
  const raw: unknown = result.raw;
  if (!plain(raw) || raw.id !== operationId || raw.storeId !== storeId || raw.kind !== 'ordinary' || raw.actionId !== 0
    || raw.requestId !== `human-promo-${operationId}` || typeof raw.title !== 'string'
    || !timestamp(raw.createdAt) || !timestamp(raw.updatedAt) || !['pending', 'finished'].includes(String(raw.status))
    || !(raw.error === null || typeof raw.error === 'string') || !Array.isArray(raw.products) || !raw.products.length
    || raw.products.length > 1000 || !Array.isArray(raw.results) || raw.results.length !== raw.products.length) {
    return unknown(result, 'ORDINARY_PRICE_INVALID_RECEIPT', '原操作记录缺少可靠的店铺、UUID、普通价类型或完整逐商品结果');
  }
  const products = raw.products;
  const results = raw.results;
  if (new Set(products.map(p => plain(p) ? p.productId : undefined)).size !== products.length
    || new Set(products.map(p => plain(p) ? p.offerId : undefined)).size !== products.length
    || products.some((p, index) => {
      const row: unknown = results[index];
      if (!plain(p) || !positiveId(p.productId) || !offer(p.offerId) || p.stock !== '0' || minor(p.price) === undefined
        || !plain(row) || row.productId !== p.productId || row.offerId !== p.offerId || row.stock !== '0'
        || minor(row.price) !== minor(p.price) || !['pending', 'verified', 'rejected'].includes(String(row.status))
        || typeof row.reason !== 'string' || !nullableMinor(row.actualMinor) || !nullableMinor(row.sellerMinor)
        || row.status === 'verified' && row.actualMinor !== minor(p.price)) return true;
      const target = expected?.[index];
      return !!expected && (!target || target.productId !== p.productId || target.offerId !== p.offerId || minor(target.price) !== minor(p.price));
    }) || expected && expected.length !== products.length) {
    return unknown(result, 'ORDINARY_PRICE_INVALID_RECEIPT', '原结果的身份、用户目标、兼容库存字段或普通售价 minor 未精确核实');
  }
  if (raw.status === 'pending') {
    return { ...unknown(result, 'OUTCOME_UNKNOWN', '原普通售价仍待核实；HTTP 成功或保存意图不等于改价成功'), stage: 'pending' };
  }
  if (results.some(row => row.status === 'pending')) return unknown(result, 'ORDINARY_PRICE_INVALID_RECEIPT', '原 finished 操作仍含 pending 项，不能当作成功');
  if (results.every(row => row.status === 'verified') && raw.error === null) return { ...result, stage: 'verified' };
  if (results.every(row => row.status === 'rejected')) {
    return { ...result, status: 'failed', stage: 'rejected', error: { code: 'ORDINARY_PRICE_REJECTED', message: '原服务逐商品结果均为拒绝；不自动更换请求编号或重写', retryable: false } };
  }
  if (results.some(row => row.status === 'verified') && results.some(row => row.status === 'rejected')) {
    return { ...result, status: 'failed', stage: 'mixed', error: { code: 'ORDINARY_PRICE_PARTIAL_RESULT', message: '原普通售价结果部分核实、部分拒绝；必须保留逐项结果', retryable: false } };
  }
  return unknown(result, 'ORDINARY_PRICE_INVALID_RECEIPT', '原操作状态与结果不一致，不能推断写入成功');
}
