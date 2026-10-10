/** Exact business contracts, deliberately not a generic Seller API proxy. */
const reads: Readonly<Record<string, 'GET' | 'POST'>> = Object.freeze({
  '/v1/seller/info': 'POST',
  '/v3/product/list': 'POST',
  '/v3/product/info/list': 'POST',
  '/v1/product/rating-by-sku': 'POST',
  '/v5/product/info/prices': 'POST',
  '/v4/product/info/attributes': 'POST',
  '/v4/product/info/stocks': 'POST',
  '/v2/product/info/stocks-by-warehouse/fbs': 'POST',
  '/v1/product/info/description': 'POST',
  '/v2/product/pictures/info': 'POST',
  '/v1/product/import/info': 'POST',
  '/v1/description-category/tree': 'POST',
  '/v1/description-category/attribute': 'POST',
  '/v1/description-category/attribute/values': 'POST',
  '/v1/description-category/attribute/values/search': 'POST',
  '/v2/warehouse/list': 'POST',
  '/v2/delivery-method/list': 'POST',
  '/v1/actions': 'GET',
  '/v2/actions/candidates': 'POST',
  '/v2/actions/products': 'POST',
  '/v1/analytics/data': 'POST',
  '/v4/posting/fbs/list': 'POST',
  '/v3/posting/fbs/get': 'POST',
  '/v1/finance/accrual/postings': 'POST',
  '/v1/finance/accrual/by-day': 'POST',
  '/v2/returns/rfbs/list': 'POST',
  '/v2/returns/rfbs/get': 'POST',
});
const writes = new Set([
  '/v3/product/import', '/v1/product/import/prices', '/v2/products/stocks',
  '/v1/product/archive', '/v1/product/unarchive',
  '/v1/actions/products/update', '/v2/actions/products/deactivate',
]);

export function ozonBusinessEndpoint(path: string): { method: 'GET' | 'POST'; readOnly: boolean } | undefined {
  if (Object.hasOwn(reads, path)) return { method: reads[path], readOnly: true };
  if (writes.has(path)) return { method: 'POST', readOnly: false };
  return undefined;
}
