import type { AdapterResponse } from '../../core/src/types.ts';

export interface OzonBusinessStore {
  id: string;
  name: string;
  platform: 'ozon';
  enabled: boolean;
  currency?: string;
  revision: number;
  credentialRevision: number;
  hasCredentials: boolean;
  legacyStoreId?: string;
  sourceConnectionId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Accepted only by a backend settings handler. Never put credentials in an Agent schema or ledger. */
export interface SaveOzonBusinessStoreInput {
  id?: string;
  name: string;
  enabled?: boolean;
  currency?: string;
  expectedRevision: number;
  legacyStoreId?: string;
  sourceConnectionId?: string;
  credentials?: { clientId: string; apiKey: string };
}

export interface OzonBusinessRequest {
  path: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  /** Keep this in an execution receipt; historical reads can use the original credential revision. */
  credentialRevision?: number;
}

export interface OzonProductTargets {
  offerIds?: string[];
  productIds?: (string | number)[];
  skus?: (string | number)[];
}

export interface OzonBusinessGatewayOptions {
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export type OzonBusinessResponse = AdapterResponse;

export class OzonBusinessError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'OzonBusinessError'; this.code = code; }
}
