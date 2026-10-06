export interface StoreProduct {
  key: string;
  title: string;
  image?: string;
  offerId?: string;
  productId?: string;
  sku?: string;
  price?: number;
  currency?: string;
  purchase?: number;
  cost?: number;
  profit?: number;
  margin?: number;
  targetMargin?: number;
  targetSource?: string;
  reason?: string;
  stock?: number;
  status?: string;
  impressions?: number;
  views?: number;
  ordered?: number;
  lastSeenAt?: string;
}

const str = (...values: unknown[]) => values.find((value) => typeof value === 'string' && value.trim()) as string | undefined;
const num = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
};
const minor = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value / 100 : undefined);

export function toStoreProduct(key: string, row: Record<string, unknown>): StoreProduct {
  const profit = (row.profit ?? {}) as Record<string, unknown>;
  const pricing = (row.pricing ?? {}) as Record<string, unknown>;
  const metrics = (row.metrics ?? {}) as Record<string, unknown>;
  const sources = Array.isArray(row.sources) ? row.sources : [];
  const firstSource = (sources[0] ?? {}) as Record<string, unknown>;
  return {
    key,
    title: str(row.title, row.name) ?? '未提供商品名称',
    image: str(row.imageUrl, row.mainImage, row.image),
    offerId: str(row.offerId),
    productId: str(row.productId),
    sku: str(row.sku),
    price: num(row.price, minor(pricing.sellerMinor), minor(profit.actualMinor)),
    currency: str(row.currency, pricing.currency),
    purchase: num(firstSource.purchasePrice, minor(profit.purchaseMinor)),
    cost: minor(profit.costMinor),
    profit: minor(profit.profitMinor),
    margin: num(profit.actualMargin),
    targetMargin: num(profit.targetMarginPpm) !== undefined ? (num(profit.targetMarginPpm) as number) / 1000000 : undefined,
    targetSource: str(profit.targetSource),
    reason: str(profit.reason),
    stock: num(row.stock),
    status: str(row.status),
    impressions: num(metrics.impressions),
    views: num(metrics.views),
    ordered: num(metrics.ordered),
    lastSeenAt: str(row.lastSeenAt, profit.observedAt),
  };
}

export function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
  const object = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  for (const key of ['products', 'items', 'rows', 'results']) {
    if (Array.isArray(object[key])) return rowsOf(object[key]);
  }
  return [];
}

export function money(value?: number, currency = 'CNY') {
  if (value === undefined) return '—';
  try {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function percent(value?: number) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('zh-CN', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function displayDate(value?: string) {
  if (!value) return '时间未提供';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
