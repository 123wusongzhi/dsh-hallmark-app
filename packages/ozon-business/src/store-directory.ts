import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { OzonBusinessError } from './types.ts';
import type { OzonBusinessStore, SaveOzonBusinessStoreInput } from './types.ts';

interface Credential { clientId: string; apiKey: string }
interface Vault { version: 1; stores: Record<string, Record<string, Credential>> }
interface Directory { version: 1; stores: OzonBusinessStore[] }
const fail = (code: string, message: string): never => { throw new OzonBusinessError(code, message); };
const clone = <T>(value: T): T => structuredClone(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\p{L}\p{N}_.~:-]{1,180}$/u.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);

function atomicJson(path: string, value: unknown): void {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600, flag: 'wx' }); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

/** Windows protects the encryption key for the current OS user; other systems use a 0600 private key. */
function dpapi(bytes: Buffer, operation: 'Protect' | 'Unprotect'): Buffer {
  const script = `[void][Reflection.Assembly]::LoadWithPartialName('System.Security'); $v=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $r=[Security.Cryptography.ProtectedData]::${operation}($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    input: bytes.toString('base64'), encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0 || !/^[A-Za-z0-9+/]+=*$/.test(result.stdout.trim())) fail('CREDENTIAL_KEY_UNAVAILABLE', '当前系统用户无法打开经营凭据。');
  return Buffer.from(result.stdout.trim(), 'base64');
}

/** Only this backend class can open the encrypted vault. The public catalogue never stores Client-Id or Api-Key. */
export class OzonStoreDirectory {
  readonly directory: string;
  #key?: Buffer;
  constructor(directory: string) { this.directory = resolve(directory); }
  private catalogue(): Directory {
    const path = join(this.directory, 'stores.json');
    if (!existsSync(path)) return { version: 1, stores: [] };
    try {
      const data = JSON.parse(readFileSync(path, 'utf8')) as Directory;
      if (data.version !== 1 || !Array.isArray(data.stores) || data.stores.some(s => !validId(s.id) || !Number.isSafeInteger(s.revision) || !Number.isSafeInteger(s.credentialRevision))) throw new Error();
      return data;
    } catch { return fail('STORE_DIRECTORY_UNAVAILABLE', '经营店铺目录无法读取，已保留原文件。'); }
  }
  listStores(): OzonBusinessStore[] { return clone(this.catalogue().stores); }
  getStore(id: string): OzonBusinessStore | undefined { return this.listStores().find(store => store.id === id); }
  hasStore(id: string): boolean { return this.getStore(id) !== undefined; }
  private key(create: boolean): Buffer {
    if (this.#key) return this.#key;
    const path = join(this.directory, 'private', 'vault-key.json');
    try {
      if (!existsSync(path)) {
        if (!create) return fail('CREDENTIAL_KEY_UNAVAILABLE', '经营凭据的系统密钥不可用。');
        const key = randomBytes(32), windows = process.platform === 'win32';
        atomicJson(path, { version: 1, protection: windows ? 'dpapi-current-user' : 'file-mode-0600', data: (windows ? dpapi(key, 'Protect') : key).toString('base64') });
        return this.#key = key;
      }
      const saved = JSON.parse(readFileSync(path, 'utf8'));
      if (saved.version !== 1 || !['dpapi-current-user', 'file-mode-0600'].includes(saved.protection) || typeof saved.data !== 'string') throw new Error();
      if (process.platform === 'win32' && saved.protection !== 'dpapi-current-user') throw new Error();
      const bytes = Buffer.from(saved.data, 'base64');
      const key = saved.protection === 'dpapi-current-user' ? dpapi(bytes, 'Unprotect') : bytes;
      if (key.length !== 32) throw new Error();
      return this.#key = key;
    } catch { return fail('CREDENTIAL_KEY_UNAVAILABLE', '当前系统用户无法打开经营凭据。'); }
  }
  private vault(): Vault {
    const path = join(this.directory, 'private', 'credentials.enc.json');
    if (!existsSync(path)) return { version: 1, stores: {} };
    try {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      if (data.version !== 1 || data.algorithm !== 'aes-256-gcm') throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', this.key(false), Buffer.from(data.iv, 'base64'));
      decipher.setAAD(Buffer.from('ozon-business-vault-v1')); decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
      const opened = JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.ciphertext, 'base64')), decipher.final()]).toString('utf8')) as Vault;
      if (opened.version !== 1 || !opened.stores || typeof opened.stores !== 'object') throw new Error();
      return opened;
    } catch { return fail('CREDENTIAL_VAULT_UNAVAILABLE', '经营凭据无法解密，已保留原文件。'); }
  }
  private saveVault(vault: Vault): void {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key(true), iv);
    cipher.setAAD(Buffer.from('ozon-business-vault-v1'));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(vault), 'utf8'), cipher.final()]);
    atomicJson(join(this.directory, 'private', 'credentials.enc.json'), { version: 1, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
  }
  /** Backend-only access for a single request. Never include this return value in any response or log. */
  credential(storeId: string, revision: number): Credential | undefined { return clone(this.vault().stores[storeId]?.[String(revision)]); }
  saveStore(input: SaveOzonBusinessStoreInput): OzonBusinessStore {
    if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 200 || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) fail('STORE_INPUT_INVALID', '店铺名称和当前修订号不能为空。');
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean' || input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) fail('STORE_INPUT_INVALID', '店铺启用状态或币种无效。');
    for (const value of [input.id, input.legacyStoreId, input.sourceConnectionId]) if (value !== undefined && !validId(value)) fail('STORE_INPUT_INVALID', '店铺或来源编号无效。');
    if (input.legacyStoreId !== undefined && input.sourceConnectionId === undefined) fail('STORE_SOURCE_REQUIRED', '历史店铺必须同时保留来源连接和原店铺编号。');
    const incoming = input.credentials;
    if (incoming && (typeof incoming.clientId !== 'string' || typeof incoming.apiKey !== 'string' || !incoming.clientId.trim() || !incoming.apiKey.trim() || /[\r\n]/.test(incoming.clientId + incoming.apiKey) || incoming.clientId.length > 256 || incoming.apiKey.length > 4096)) fail('STORE_CREDENTIAL_INVALID', '店铺凭据缺失或格式无效。');
    mkdirSync(this.directory, { recursive: true, mode: 0o700 }); mkdirSync(join(this.directory, 'private'), { recursive: true, mode: 0o700 });
    const lock = join(this.directory, 'private', 'directory.lock');
    let descriptor: number;
    try { descriptor = openSync(lock, 'wx', 0o600); } catch { return fail('STORE_SAVE_BUSY', '经营店铺设置正在保存，请重新读取后再保存。'); }
    try {
      const catalogue = this.catalogue();
      const id = input.id ?? randomUUID(), previous = catalogue.stores.find(store => store.id === id);
      if ((previous?.revision ?? 0) !== input.expectedRevision) fail('STORE_REVISION_CONFLICT', '店铺设置已变更，请读取最新版本后再保存。');
      if (previous && (input.legacyStoreId !== undefined && previous.legacyStoreId !== input.legacyStoreId || input.sourceConnectionId !== undefined && previous.sourceConnectionId !== input.sourceConnectionId)) fail('STORE_SOURCE_IMMUTABLE', '已建立的店铺来源关联不能改指其他账户。');
      const legacyStoreId = previous?.legacyStoreId ?? input.legacyStoreId, sourceConnectionId = previous?.sourceConnectionId ?? input.sourceConnectionId;
      if (legacyStoreId && catalogue.stores.some(s => s.id !== id && s.legacyStoreId === legacyStoreId && s.sourceConnectionId === sourceConnectionId)) fail('STORE_SOURCE_EXISTS', '此来源店铺已导入，请使用已有经营店铺。');
      const vault = this.vault(), oldCredential = previous?.credentialRevision ? vault.stores[id]?.[String(previous.credentialRevision)] : undefined;
      if (previous?.hasCredentials && !oldCredential) fail('STORE_CREDENTIAL_UNAVAILABLE', '原经营凭据缺失，不能覆盖为新账户。');
      if (oldCredential && incoming && incoming.clientId !== oldCredential.clientId) fail('STORE_ACCOUNT_CHANGED', '更换 Api-Key 必须属于同一 Client-Id；不同账户请新增店铺。');
      const metadata = { id, name: input.name.trim(), legacyStoreId, sourceConnectionId, currency: input.currency };
      for (const credential of [incoming, oldCredential]) for (const secret of [credential?.clientId, credential?.apiKey]) if (secret && JSON.stringify(metadata).includes(secret)) fail('STORE_METADATA_CONTAINS_CREDENTIAL', '店铺名称或来源编号不能包含私有凭据。');
      let credentialRevision = previous?.credentialRevision ?? 0;
      if (incoming && (!oldCredential || oldCredential.clientId !== incoming.clientId || oldCredential.apiKey !== incoming.apiKey)) {
        credentialRevision++;
        vault.stores[id] ??= {}; vault.stores[id][String(credentialRevision)] = { clientId: incoming.clientId, apiKey: incoming.apiKey };
        this.saveVault(vault); // Old revisions remain usable if a later catalogue save fails or a receipt is inspected.
      }
      const now = new Date().toISOString();
      const store: OzonBusinessStore = { id, name: input.name.trim(), platform: 'ozon', enabled: input.enabled ?? previous?.enabled ?? true,
        ...(input.currency ?? previous?.currency ? { currency: input.currency ?? previous?.currency } : {}),
        revision: (previous?.revision ?? 0) + 1, credentialRevision, hasCredentials: credentialRevision > 0,
        ...(legacyStoreId ? { legacyStoreId } : {}), ...(sourceConnectionId ? { sourceConnectionId } : {}), createdAt: previous?.createdAt ?? now, updatedAt: now };
      catalogue.stores = [...catalogue.stores.filter(s => s.id !== id), store]; atomicJson(join(this.directory, 'stores.json'), catalogue);
      return clone(store);
    } finally { closeSync(descriptor); unlinkSync(lock); }
  }
  importLegacyStore(input: Omit<SaveOzonBusinessStoreInput, 'id' | 'expectedRevision'> & { legacyStoreId: string; sourceConnectionId: string }): OzonBusinessStore {
    const existing = this.listStores().find(s => s.legacyStoreId === input.legacyStoreId && s.sourceConnectionId === input.sourceConnectionId);
    if (existing) return existing;
    const suffix = createHash('sha256').update(`${input.sourceConnectionId}\0${input.legacyStoreId}`).digest('hex').slice(0, 16);
    const id = this.hasStore(input.legacyStoreId) ? `${input.legacyStoreId.slice(0, 150)}~${suffix}` : input.legacyStoreId;
    return this.saveStore({ ...input, id, expectedRevision: 0 });
  }
}
