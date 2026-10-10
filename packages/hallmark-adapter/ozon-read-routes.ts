/** Exact read-only operations used by the ten Ozon business data sources. */
export const OZON_STORE_READ_ENDPOINTS:Readonly<Record<string,'GET'|'POST'>>=Object.freeze({
 '/v3/product/list':'POST','/v3/product/info/list':'POST','/v5/product/info/prices':'POST',
 '/v2/warehouse/list':'POST','/v2/delivery-method/list':'POST','/v2/product/info/stocks-by-warehouse/fbs':'POST',
 '/v1/analytics/data':'POST','/v4/posting/fbs/list':'POST','/v3/posting/fbs/get':'POST',
 '/v1/finance/accrual/postings':'POST','/v1/finance/accrual/by-day':'POST',
 '/v1/actions':'GET','/v2/actions/products':'POST','/v2/actions/candidates':'POST',
 '/v2/returns/rfbs/list':'POST','/v2/returns/rfbs/get':'POST',
});
