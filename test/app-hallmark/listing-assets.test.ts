import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ListingAssetPublisher, LISTING_ASSET_DESCRIPTOR } from '../../packages/app-hallmark/src/listing-assets.ts';
import {HallmarkProvider} from '../../packages/app-hallmark/src/index.ts';

test('all failed image deliveries retain per-file reasons through the provider',async()=>{
  const files=[{path:'C:/images/a.png',status:'failed',error:{code:'IMPORT_MISMATCH',message:'内容不一致'}}];
  const publisher={publish:async()=>({status:'failed',successCount:0,failureCount:1,files})};
  const provider=new HallmarkProvider({store:{} as any,client:{} as any,broker:{} as any,assetPublisher:publisher as any});
  const result=await provider.execute({request:{appId:'hallmark',connectionId:'c',capabilityId:'hallmark.listing.assets.publish',capabilityVersion:'1.0.0',input:{files:[{path:'C:/images/a.png'}]},invocationId:'i',traceId:'t',source:{kind:'agent',sessionId:'s'}},operationId:'o',configRevision:1} as any);
  assert.equal(result.status,'failed');assert.equal((result as any).error.details.files[0].error.code,'IMPORT_MISMATCH');assert.equal((result as any).error.details.files[0].path,'C:/images/a.png');
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const hash = (v: Buffer) => createHash('sha256').update(v).digest('hex');
async function fixture(t: any, options: { publicWrongHash?: boolean; importFailure?: string; mutateOriginal?: boolean; failureMessage?: string; importedHash?: (digest: string) => string; publishFailure?:(assetIds:string[],attempt:number)=>string|undefined; publishDelayMs?: number; onPublish?: () => void; timeBudgetMs?: number } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'listing-assets-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const imports = join(root, 'imports'); await mkdir(imports);
  const first = join(root, 'first.png'), second = join(root, 'second.png');
  await writeFile(first, png); await writeFile(second, Buffer.concat([png, Buffer.from('second')])) ;
  const records = new Map<string, any>(), assets = new Map<string, Buffer>(), calls: Array<{ path: string; body?: any; auth?: string | null }> = [];
  // A pending Promise alone does not model fetch I/O: AbortSignal.timeout is unref'ed.
  // Use a finite slow HTTP response so missing/late aborts return success and fail the assertions.
  let baseUrl = 'http://provider.example';
  const slowPublish = { requests: 0, responses: 0, closed: 0, waitForClosed: async () => {} };
  if (options.publishDelayMs) {
    const sockets = new Set<Socket>(), pending = new Map<ServerResponse, Promise<void>>();
    const server = createServer(async (request, response) => {
      assert.equal(request.method, 'POST'); assert.equal(request.url, '/api/images/publish');
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      slowPublish.requests++;
      const timer = setTimeout(() => {
        slowPublish.responses++;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ mode: 'stable', ok: true, assets: body.assetIds.map((assetId: string) => ({ assetId, publicUrl: `https://images.example/images/${assetId}`, reachable: true })) }));
      }, options.publishDelayMs).unref();
      pending.set(response, new Promise<void>(resolve => response.once('close', () => {
        clearTimeout(timer); pending.delete(response); slowPublish.closed++; resolve();
      })));
      options.onPublish?.();
    });
    server.on('connection', socket => { socket.unref(); sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
    t.after(async () => {
      const disconnected = [...sockets].map(socket => new Promise<void>(resolve => socket.once('close', () => resolve())));
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      await Promise.all(disconnected);
      assert.equal(pending.size, 0, 'all delayed responses and their timers are cleaned up');
      assert.equal(sockets.size, 0, 'all HTTP connections are closed');
      assert.equal(server.listening, false, 'the fixture server is closed');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    server.unref();
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    slowPublish.waitForClosed = async () => { await Promise.all([...pending.values()]); };
  }
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
      if (options.publishDelayMs) return fetch(input, init);
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
  const publisher = new ListingAssetPublisher({ baseUrl, operatorToken: 'private-operator-secret', store: { get: <T>(c: string, id: string) => records.get(`${c}/${id}`) as T | undefined, put: <T>(c: string, id: string, value: T) => (records.set(`${c}/${id}`, value), value) }, fetchImpl, ...(options.timeBudgetMs ? { timeBudgetMs: options.timeBudgetMs } : {}) });
  return { publisher, first, second, imports, calls, records, assets, slowPublish };
}

test('selected local image is snapshotted, published and read back', async t => {
  const { publisher, first, imports, calls } = await fixture(t, { mutateOriginal: true });
  const r = await publisher.publish({ files: [{ path: first }] });
  assert.equal(r.status, 'ready'); assert.equal(r.successCount, 1); assert.equal(r.files[0].contentHash, hash(png));
  assert.equal('skuIds' in r.files[0], false); assert.equal(r.files[0].mimeType, 'image/png');
  assert.equal(r.files[0].url, `https://images.example/images/image-v1-${hash(png)}`);
  const imported = calls.find(c => c.path === '/api/images/import/local')!;
  assert(imported.body.filePath.startsWith(imports)); assert.deepEqual(await readFile(imported.body.filePath), png);
  assert(!JSON.stringify(r).includes('private-operator-secret'));
});

test('same bytes reuse verified content cache; later source file changes create another content identity', async t => {
  const { publisher, first, calls } = await fixture(t);
  const initial = await publisher.publish({ files: [{ path: first }] });
  const repeated = await publisher.publish({ files: [{ path: first }] });
  assert.equal(repeated.files[0].reused, true); assert.equal(initial.files[0].assetId, repeated.files[0].assetId);
  assert.equal(calls.filter(c => c.path === '/api/images/publish').length, 1);
  await writeFile(first, Buffer.concat([png, Buffer.from('new')]));
  const changed = await publisher.publish({ files: [{ path: first }] });
  assert.notEqual(changed.files[0].assetId, initial.files[0].assetId); assert.equal(changed.files[0].reused, false);
});

test('one batch delivers identical bytes once while retaining every file result',async t=>{
 const {publisher,first,second,calls}=await fixture(t);await writeFile(second,png);
 const files=Array.from({length:20},(_,i)=>({path:i%2?first:second}));
 const result=await publisher.publish({files});assert.equal(result.status,'ready');assert.equal(result.successCount,20);
 assert.deepEqual(result.files.map((file:any)=>file.path),files.map(file=>file.path));
 assert.equal(new Set(result.files.map((file:any)=>file.assetId)).size,1);
 assert.equal(calls.filter(c=>c.path==='/api/images/import/local').length,1);assert.equal(calls.filter(c=>c.path==='/api/images/publish').length,1);assert.equal(calls.filter(c=>c.path.startsWith('/images/')).length,1);
 const again=await publisher.publish({files:[{path:first}]});assert.equal(again.files[0].reused,true);assert.equal(calls.filter(c=>c.path==='/api/images/import/local').length,1);
});

test('identical content import failure maps to every binding and is retried by a new invocation',async t=>{
 const options:{importFailure?:string}={importFailure:hash(png)},f=await fixture(t,options);
 const files=[{path:f.first},{path:f.first}];
 const failed=await f.publisher.publish({files});assert.equal(failed.failureCount,2);assert.equal(f.calls.filter(c=>c.path==='/api/images/import/local').length,1);
 assert.deepEqual(failed.files.map((file:any)=>file.path),[f.first,f.first]);assert.ok(failed.files.every((file:any)=>file.error.code==='LISTING_ASSET_PROVIDER_FAILED'));
 options.importFailure=undefined;const retried=await f.publisher.publish({files});assert.equal(retried.successCount,2);assert.equal(f.calls.filter(c=>c.path==='/api/images/import/local').length,2);assert.equal(f.calls.filter(c=>c.path==='/api/images/publish').length,1);
});

test('duplicate public verification failure remains uncached and new invocation retries the content',async t=>{
 const options={publicWrongHash:true},f=await fixture(t,options),files=[{path:f.first},{path:f.first}];
 const failed=await f.publisher.publish({files});assert.equal(failed.failureCount,2);assert.equal(f.records.size,0);assert.equal(f.calls.filter(c=>c.path.startsWith('/images/')).length,1);
 assert.ok(failed.files.every((file:any)=>file.error.code==='LISTING_ASSET_PUBLIC_MISMATCH'));
 options.publicWrongHash=false;const retried=await f.publisher.publish({files});assert.equal(retried.successCount,2);assert.equal(f.calls.filter(c=>c.path.startsWith('/images/')).length,2);assert.equal(f.records.size,2);
});

test('shared duplicate failure does not affect another content in the same image batch',async t=>{
 const f=await fixture(t,{importFailure:hash(png)});
 const result=await f.publisher.publish({files:[{path:f.first},{path:f.first},{path:f.second}]});
 assert.equal(result.status,'partial');assert.equal(result.failureCount,2);assert.equal(result.successCount,1);assert.equal(result.files[2].status,'ready');assert.equal(result.files[2].path,f.second);
 assert.equal(f.calls.filter(c=>c.path==='/api/images/import/local').length,2);assert.equal(f.calls.filter(c=>c.path==='/api/images/publish').length,1);
});

test('one bad local file does not discard other successfully published files', async t => {
  const { publisher, first, imports } = await fixture(t);
  const r = await publisher.publish({ files: [{ path: imports }, { path: first }] });
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
  const files = [{ path: first }, { path: second }];
  for (let i = 2; i < 11; i++) { const path = join(imports, `generated-${i}.png`); await writeFile(path, Buffer.concat([png, Buffer.from(`image-${i}`)])); files.push({ path }); }
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

test('a call that runs out of its time budget returns per-file retryable results and a plain retry succeeds', { timeout: 5000 }, async t => {
  const options = { publishDelayMs: 1000, timeBudgetMs: 200 };
  const f = await fixture(t, options);
  const started = Date.now(), r = await f.publisher.publish({ files: [{ path: f.first }, { path: f.second }] });
  assert.ok(Date.now() - started < 5000, 'the budget bounds the whole call');
  assert.equal(r.status, 'failed'); assert.equal(r.successCount, 0); assert.equal(r.failureCount, 2); assert.equal(r.files.length, 2);
  assert.ok(r.files.every((file: any) => file.error.code === 'LISTING_ASSET_TIME_BUDGET'));
  assert.equal(f.records.size, 0);
  await f.slowPublish.waitForClosed();
  // The whole-call budget may expire during file I/O, before the HTTP request is sent.
  assert.ok(f.slowPublish.requests <= 1);
  assert.equal(f.slowPublish.responses, 0, 'budget abort prevents the delayed success response');
  assert.equal(f.slowPublish.closed, f.slowPublish.requests, 'every started publish request is closed');
  t.diagnostic(`budget publish HTTP lifecycle: ${JSON.stringify(f.slowPublish)}`);
  options.publishDelayMs = 0;
  const retried = await f.publisher.publish({ files: [{ path: f.first }, { path: f.second }] });
  assert.equal(retried.status, 'ready'); assert.equal(retried.successCount, 2);
});

test('caller cancellation keeps its ordinary failure instead of the time-budget code', { timeout: 5000 }, async t => {
  const controller = new AbortController();
  const f = await fixture(t, { publishDelayMs: 1000, onPublish: () => controller.abort() });
  const r = await f.publisher.publish({ files: [{ path: f.first }] }, controller.signal);
  assert.equal(r.status, 'failed'); assert.equal(r.successCount, 0); assert.equal(r.failureCount, 1);
  assert.equal(r.files[0].error.code, 'LISTING_ASSET_TRANSFER_FAILED');
  assert.notEqual(r.files[0].error.code, 'LISTING_ASSET_TIME_BUDGET');
  await f.slowPublish.waitForClosed();
  assert.deepEqual([f.slowPublish.requests, f.slowPublish.responses, f.slowPublish.closed], [1, 0, 1], 'caller abort closes the actual publish request before its delayed response');
});
