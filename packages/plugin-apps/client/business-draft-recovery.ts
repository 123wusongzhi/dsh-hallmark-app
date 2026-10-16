import type { BusinessRowInput } from '../../app-hallmark/src/operations/types.ts';

export interface BusinessDraftSnapshot {
  planId: string;
  revision: number;
  edits: Record<string, Record<string, unknown>>;
  pricingEdits: Record<string, NonNullable<BusinessRowInput['pricing']>>;
  rawEdits: Record<string, string>;
}
export const BUSINESS_DRAFT_LIMITS = { owners: 4, totalBytes: 1024 * 1024, entryBytes: 256 * 1024, ttlMs: 30 * 60 * 1000 } as const;
export type DraftCacheNotice = 'expired' | 'evicted' | 'too_large' | 'retained';

/** Private to one mounted BusinessOperations. Never persisted or shared across workspaces. */
export class BusinessDraftRecovery {
  private entries = new Map<string, { draft: BusinessDraftSnapshot; bytes: number; expiresAt: number }>();
  private clock: () => number;
  constructor(clock: () => number = Date.now) { this.clock = clock; }
  get size(): number { return this.entries.size; }
  get bytes(): number { return [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0); }
  prune(): boolean {
    let removed = false;
    for (const [key, entry] of this.entries) if (entry.expiresAt <= this.clock()) { this.entries.delete(key); removed = true; }
    return removed;
  }
  peek(owner: string): BusinessDraftSnapshot | undefined {
    const entry = this.entries.get(owner);
    return entry && entry.expiresAt > this.clock() ? structuredClone(entry.draft) : undefined;
  }
  drop(owner: string): void { this.entries.delete(owner); }
  clear(): void { this.entries.clear(); }
  put(owner: string, draft: BusinessDraftSnapshot): { retained: boolean; notice?: DraftCacheNotice } {
    let notice: DraftCacheNotice | undefined = this.prune() ? 'expired' : undefined;
    this.entries.delete(owner);
    const bytes = new TextEncoder().encode(JSON.stringify([owner, draft])).byteLength;
    if (bytes > BUSINESS_DRAFT_LIMITS.entryBytes) return { retained: false, notice: 'too_large' };
    while (this.entries.size >= BUSINESS_DRAFT_LIMITS.owners || this.bytes + bytes > BUSINESS_DRAFT_LIMITS.totalBytes) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return { retained: false, notice: 'too_large' };
      this.entries.delete(oldest); notice = 'evicted';
    }
    this.entries.set(owner, { draft: structuredClone(draft), bytes, expiresAt: this.clock() + BUSINESS_DRAFT_LIMITS.ttlMs });
    return { retained: true, notice };
  }
}
