/** Shared ceiling for composed data reads; catalogue and control requests keep their shorter bound. */
export const APPS_DATA_REQUEST_TIMEOUT_MS=150000;
/** A batch may review source pixels for several SKUs; retain one cancellable submission. */
export const APPS_BUSINESS_REQUEST_TIMEOUT_MS=900000;
export function isBusinessSubmission(appId:unknown,capabilityId:unknown):boolean {
 return appId==='hallmark'&&typeof capabilityId==='string'&&(/^hallmark\.plan\.(submit|restore)$/.test(capabilityId)||capabilityId==='hallmark.listing.draft.submit'||['hallmark.products.update_price','hallmark.api.products.update_price','hallmark.products.update_stock','hallmark.products.list_product'].includes(capabilityId));
}
export function appsInvocationTimeout(request:{appId?:unknown;capabilityId?:unknown;deadlineAt?:unknown},ordinaryMs=APPS_DATA_REQUEST_TIMEOUT_MS):number {
 const ceiling=isBusinessSubmission(request.appId,request.capabilityId)?APPS_BUSINESS_REQUEST_TIMEOUT_MS:ordinaryMs;
 if(request.deadlineAt===undefined)return ceiling;
 const remaining=typeof request.deadlineAt==='string'?Date.parse(request.deadlineAt)-Date.now():NaN;
 return Number.isFinite(remaining)?Math.max(0,Math.min(ceiling,remaining)):0;
}
