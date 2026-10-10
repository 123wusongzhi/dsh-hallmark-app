import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ListingAssetPublisher, LISTING_ASSET_DESCRIPTOR } from '../../packages/app-hallmark/src/listing-assets.ts';
import {HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';

test('all failed image deliveries retain per-file reasons through the provider',async()=>{
  const files=[{path:'C:/images/a.png',skuIds:['sku-a'],status:'failed',error:{code:'IMPORT_MISMATCH',message:'内容不一致'}}];
  const publisher={publish:async()=>({status:'failed',successCount:0,failureCount:1,files})};
  const provider=new HallmarkProvider({store:{} as any,client:{} as any,broker:{} as any,assetPublisher:publisher as any});
  const result=await provider.execute({request:{appId:'hallmark',connectionId:'c',capabilityId:'hallmark.listing.assets.publish',capabilityVersion:'1.0.0',input:{files:[{path:'C:/images/a.png'}]},invocationId:'i',traceId:'t',source:{kind:'agent',sessionId:'s'}},operationId:'o',configRevision:1} as any);
  assert.equal(result.status,'failed');assert.equal((result as any).error.details.files[0].error.code,'IMPORT_MISMATCH');assert.equal((result as any).error.details.files[0].skuIds[0],'sku-a');
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const hash = (v: Buffer) => createHash('sha256').update(v).digest('hex');
async function fixture(t: any, options: { publicWrongHash?: boolean; importFailure?: string; mutateOriginal?: boolean; failureMessage?: string; importedHash?: (digest: string) => string; publishFailure?:(assetIds:string[],attempt:number)=>string|undefined } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'listing-assets-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const imports = join(root, 'imports'); await mkdir(imports);
  const first = join(root, 'first.png'), second = join(root, 'second.png');
  await writeFile(first, png); await writeFile(second, Buffer.concat([png, Buffer.from('second')])) ;
  const records = new Map<string, any>(), assets = new Map<string, Buffer>(), calls: Array<{ path: string; body?: any; auth?: string | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path: url.pathname, body, auth: new Headers(init?.headers).get('authorization') });
    if (url.pathname === '/api/images/access') return Response.json({ importRoot: imports, delivery: { mode: 'stable', publicBaseUrl: 'https://images.example' }, stablePublisherConfigured: true });
    if (url.pathname === '/api/images/import/local') {
      const bytes = await readFile(body.filePath), contentHash = hash(bytes), assetId = `image-v1-${contentHash}`;
      if (options.failureMessage) throw new Error(options.failureMessage);
      if (options.importFailure === contentHash) return Response.json({ error: 'credential secret must not echo' }, { status: 400 });
      if (options.mutateOriginal) await writeFile(first, Buffer.concat([png, Buffer.from('changed after snapshot')]));
      assets.set(assetId, bytes);
      // Same metadata shape as the actual current /api/images/import/local response.
      return Response.json({ kind: 'hallmark-image-asset-v1', formatVersion: 1, assetId, contentHash: options.importedHash?.(contentHash) ?? `sha256:${contentHash}`, mediaType: 'image/png', byteLength: bytes.length, width: 1, height: 1 });
    }
    if (url.pathname === '/api/images/publish') {
      const code=options.publishFailure?.(body.assetIds,calls.filter(c=>c.path==='/api/images/publish').length);
      if(code)return Response.json({ok:false,code,error:'password=private-provider-secret'},{status:400});
      return Response.json({ mode: 'stable', ok: true, assets: body.assetIds.map((assetId: string) => ({ assetId, publicUrl: `https://images.example/images/${assetId}`, reachable: true })) });
    }
    if (url.origin === 'https://images.example') {
      assert.equal(new Headers(init?.headers).get('authorization'), null, 'operator token never goes to image origin');
      const bytes = options.publicWrongHash ? Buffer.concat([png, Buffer.from('wrong')]) : assets.get(url.pathname.split('/').at(-1)!)!;
      return new Response(new Uint8Array(bytes));
    }
    throw new Error('unexpected request');
  }) as typeof fetch;
  const publisher = new ListingAssetPublisher({ baseUrl: 'http://provider.example', operatorToken: 'private-operator-secret', store: { get: <T>(c: string, id: string) => records.get(`${c}/${id}`) as T | undefined, put: <T>(c: string, id: string, value: T) => (records.set(`${c}/${id}`, value), value) }, fetchImpl });
  return { publisher, first, second, imports, calls, records, assets };
}

test('selected local image is snapshotted, published, read back and bound to precise SKU IDs', async t => {
  const { publisher, first, imports, calls } = await fixture(t, { mutateOriginal: true });
  const r = await publisher.publish({ files: [{ path: first, skuIds: ['a', 'b', 'a'] }] });
  assert.equal(r.status, 'ready'); assert.equal(r.successCount, 1); assert.equal(r.files[0].contentHash, hash(png));
  assert.deepEqual(r.files[0].skuIds, ['a', 'b']); assert.equal(r.files[0].mimeType, 'image/png');
  assert.equal(r.files[0].url, `https://images.example/images/image-v1-${hash(png)}`);
  const imported = calls.find(c => c.path === '/api/images/import/local')!;
  assert(imported.body.filePath.startsWith(imports)); assert.deepEqual(await readFile(imported.body.filePath), png);
  assert(!JSON.stringify(r).includes('private-operator-secret'));
});

test('same bytes reuse verified content cache; later source file changes create another content identity', async t => {
  const { publisher, first, calls } = await fixture(t);
  const initial = await publisher.publish({ files: [{ path: first }] });
  const repeated = await publisher.publish({ files: [{ path: first, skuIds: ['new-binding'] }] });
  assert.equal(repeated.files[0].reused, true); assert.equal(initial.files[0].assetId, repeated.files[0].assetId);
  assert.equal(calls.filter(c => c.path === '/api/images/publish').length, 1);
  await writeFile(first, Buffer.concat([png, Buffer.from('new')]));
  const changed = await publisher.publish({ files: [{ path: first }] });
  assert.notEqual(changed.files[0].assetId, initial.files[0].assetId); assert.equal(changed.files[0].reused, false);
});

test('one bad local file does not discard other successfully published files', async t => {
  const { publisher, first, imports } = await fixture(t);
  const r = await publisher.publish({ files: [{ path: imports }, { path: first, skuIds: ['good'] }] });
  assert.equal(r.status, 'partial'); assert.equal(r.failureCount, 1); assert.equal(r.successCount, 1);
  assert.equal(r.files[0].error.code, 'LISTING_ASSET_NOT_FILE'); assert.equal(r.files[1].status, 'ready');
});

test('provider rejection is a per-file error and does not expose remote body or credentials', async t => {
  const { publisher, first, second } = await fixture(t, { importFailure: hash(png) });
  const r = await publisher.publish({ files: [{ path: first }, { path: second }] });
  assert.equal(r.status, 'partial'); assert.equal(r.files[0].error.code, 'LISTING_ASSET_PROVIDER_FAILED');
  assert(!JSON.stringify(r).includes('secret')); assert.equal(r.files[1].status, 'ready');
});

test('successful HTTP image with changed content is rejected and not cached as delivered', async t => {
  const { publisher, first, records } = await fixture(t, { publicWrongHash: true });
  const r = await publisher.publish({ files: [{ path: first }] });
  assert.equal(r.status, 'failed'); assert.equal(r.files[0].error.code, 'LISTING_ASSET_PUBLIC_MISMATCH'); assert.equal(records.size, 0);
});

test('transport exceptions are sanitized and file count is bounded', async t => {
  const { publisher, first } = await fixture(t, { failureMessage: 'password=untrusted-secret' });
  const r = await publisher.publish({ files: [{ path: first }] });
  assert.equal(r.files[0].error.code, 'LISTING_ASSET_TRANSFER_FAILED'); assert(!JSON.stringify(r).includes('untrusted-secret'));
  await assert.rejects(publisher.publish({ files: Array.from({ length: 21 }, () => ({ path: first })) }), /1–20/);
  assert.equal(LISTING_ASSET_DESCRIPTOR.execution.idempotency, 'upstream_supported');
  assert.equal(LISTING_ASSET_DESCRIPTOR.effect, 'mutation');
});

test('current provider sha256-prefixed import metadata allows an eleven-file DSH batch to reach publish', async t => {
  const { publisher, first, second, imports, calls } = await fixture(t);
  const files = [{ path: first, skuIds: ['sku-0'] }, { path: second, skuIds: ['sku-1'] }];
  for (let i = 2; i < 11; i++) { const path = join(imports, `generated-${i}.png`); await writeFile(path, Buffer.concat([png, Buffer.from(`image-${i}`)])); files.push({ path, skuIds: [`sku-${i}`] }); }
  const result = await publisher.publish({ files });
  assert.equal(result.status, 'ready'); assert.equal(result.successCount, 11); assert.equal(result.failureCount, 0);
  const publishes = calls.filter(c => c.path === '/api/images/publish'); assert.deepEqual(publishes.map(c=>c.body.assetIds.length),[3,3,3,2]);
  for (const file of result.files) { assert.match(file.contentHash, /^[0-9a-f]{64}$/); assert.equal(file.assetId, `image-v1-${file.contentHash}`); assert.equal(file.status, 'ready'); }
});

test('qualifier normalization still rejects a wrong digest or unsupported algorithm before publishing', async t => {
  for (const transform of [(digest: string) => `sha256:${digest[0] === '0' ? '1' : '0'}${digest.slice(1)}`, (digest: string) => `sha512:${digest}`]) {
    const { publisher, first, calls } = await fixture(t, { importedHash: transform });
    const result = await publisher.publish({ files: [{ path: first }] });
    assert.equal(result.status, 'failed'); assert.equal(result.files[0].error.code, 'LISTING_ASSET_IMPORT_MISMATCH');
    assert.equal(calls.filter(c => c.path === '/api/images/publish').length, 0);
  }
});

test('bare SHA-256 from a compatible provider remains supported without changing stored output', async t => {
  const { publisher, first } = await fixture(t, { importedHash: value => value });
  const result = await publisher.publish({ files: [{ path: first }] });
  assert.equal(result.status, 'ready'); assert.equal(result.files[0].contentHash, hash(png));
});

test('one transient content-addressed sync failure retries the same batch once',async t=>{
  const {publisher,first,calls}=await fixture(t,{publishFailure:(_ids,attempt)=>attempt===1?'IMAGE_PUBLISH_SYNC_FAILED':undefined});
  const result=await publisher.publish({files:[{path:first}]});assert.equal(result.successCount,1);
  const publishes=calls.filter(c=>c.path==='/api/images/publish');assert.equal(publishes.length,2);assert.deepEqual(publishes[0].body,publishes[1].body);
});
test('a failed batch is bounded and does not discard other delivered files or leak provider text',async t=>{
  const {publisher,first,second,imports,calls}=await fixture(t,{publishFailure:ids=>ids.includes(`image-v1-${hash(png)}`)?'IMAGE_PUBLISH_SYNC_FAILED':undefined});
  const files=[{path:first},{path:second}];for(let i=2;i<5;i++){const path=join(imports,`batch-${i}.png`);await writeFile(path,Buffer.concat([png,Buffer.from(String(i))]));files.push({path});}
  const result=await publisher.publish({files});assert.equal(result.failureCount,3);assert.equal(result.successCount,2);assert.equal(result.status,'partial');
  assert.deepEqual(calls.filter(c=>c.path==='/api/images/publish').map(c=>c.body.assetIds.length),[3,3,2]);
  assert.match(result.files[0].error.message,/IMAGE_PUBLISH_SYNC_FAILED/);assert(!JSON.stringify(result).includes('private-provider-secret'));
});
test('unknown or non-sync provider failures are never retried and only known codes are exposed',async t=>{
  for(const code of ['IMAGE_PUBLISH_INVALID','private-code-secret']){
    const {publisher,first,calls}=await fixture(t,{publishFailure:()=>code});const result=await publisher.publish({files:[{path:first}]});
    assert.equal(calls.filter(c=>c.path==='/api/images/publish').length,1);assert(!JSON.stringify(result).includes('secret'));
    assert.equal(result.files[0].error.message.includes('IMAGE_PUBLISH_INVALID'),code==='IMAGE_PUBLISH_INVALID');
  }
});
