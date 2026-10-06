export type OverviewStatus = 'ok' | 'stale' | 'unavailable';
export interface OverviewCount { status: OverviewStatus; count: number | null }
export interface OverviewStoreRow {
  id: string;
  name: string;
  productCount: number | null;
  lastSuccessAt: string | null;
  status: OverviewStatus;
}
export interface OverviewDto {
  /** When this overview was read. This is not the time of the source business data. */
  fetchedAt: string;
  collected: OverviewCount;
  /** All cached products, including archived products; never presented as an on-sale count. */
  products: OverviewCount & {
    /** Oldest successful source snapshot among the covered stores, not the request time. */
    lastSuccessAt: string | null;
  };
  stores: OverviewCount & { rows: OverviewStoreRow[] };
}
