const record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

/** Cache presentation never crosses authorization, identity or connection changes. */
export function cacheFallbackAllowed(error:unknown):boolean {
  const value=record(error),code=String(value.code??''),status=Number(value.httpStatus??value.statusCode);
  if(status===401||status===403||/AUTH|PERMISSION|FORBIDDEN|ACCESS_DENIED|CONNECTION|BINDING|IDENTITY|OWNER|INVALID|NOT_FOUND|HTTP_40[13](?:$|_)/.test(code))return false;
  if(value.retryPolicy==='never'||value.retryPolicy==='inspect_only')return false;
  return value.retryPolicy==='read_retry'||status===429||status>=500&&status<=599||/^(LOCAL_RATE_LIMIT|RATE_LIMITED|OZON_UPSTREAM_UNAVAILABLE|HALLMARK_UNAVAILABLE|HALLMARK_HTTP_5\d\d|REPORT_PENDING|APP_SERVICE_UNAVAILABLE|RUNTIME_UNAVAILABLE|CALL_ABORTED)$/.test(code);
}

export function cacheRetryAt(error:unknown,payload?:unknown,now=Date.now()):number {
  const value=record(error),cache=record(record(payload).cache),deadline=Date.parse(String(cache.nextRefreshAt??''));
  const delay=typeof value.retryAfterMs==='number'&&Number.isFinite(value.retryAfterMs)&&value.retryAfterMs>0?value.retryAfterMs:0;
  const retry=Math.max(delay?now+delay:0,Number.isFinite(deadline)&&deadline>now?deadline:0);
  return retry||now+60000;
}
