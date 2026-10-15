import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomInt, randomUUID} from 'node:crypto';
import {AppsRuntime, RuntimeStore} from '../../packages/app-runtime/src/index.ts';
import type {InvocationRecord} from '../../packages/app-runtime/src/store.ts';
import {AppsPresentationService} from '../../packages/app-presentation/src/index.ts';
import {createAppsServer} from '../../packages/service/src/apps-server.ts';
import {AppsHost, HttpAppsHostTransport, type NativeGatewayTool} from '../../packages/plugin-apps/src/index.ts';
import type {AppProvider, CapabilityDescriptor, CapabilityResult, InvocationRequest, JsonValue} from '../../packages/app-contracts/src/index.ts';

// Explicit protocol-control fixture: no business data, external source, build,
// browser, or model execution. Both service generations use production routes.
const appId = 'catalogfixture';
const capabilityId = `${appId}.rows.query`;
const connectionId = 'catalog-control';
const sessionId = 'catalog-agent';

function descriptor(version: string): CapabilityDescriptor {
  return {
    capabilityId, version, title: `Catalogue control ${version}`,
    description: `Protocol fixture for the active ${version} catalogue.`, effect: 'query',
    inputSchema: {type: 'object', properties: version === '1.0.0' ? {} : {label: {type: 'string'}}, additionalProperties: false},
    outputSchema: {type: 'object', properties: {version: {type: 'string'}, label: {type: 'string'}}, required: ['version', 'label'], additionalProperties: false},
    execution: {mode: 'sync', timeoutMs: 5000, concurrency: 'declared_safe', lockScope: 'connection', idempotency: 'not_applicable', completionEvidence: 'response'},
    discovery: {defaultVisible: true, keywords: ['protocol-control']}, aliases: [],
  };
}

type Server = ReturnType<typeof createAppsServer>;
async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => {server.off('listening', ready); reject(error);};
    const ready = () => {server.off('error', failed); resolve();};
    server.once('error', failed);
    server.once('listening', ready);
    server.listen(port, '127.0.0.1');
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}
// Windows can give listen(0) a Fetch-restricted port. Choose the first
// generation's port safely; the replacement must reuse that exact endpoint.
async function listenForFetch(server: Server): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {return await listen(server, randomInt(20000, 65536));}
    catch (error) {
      if (!['EADDRINUSE', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  throw new Error('No free Fetch-compatible fixture port');
}
async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('registered Host retires warmed exact descriptors across HTTP Runtime generations and recovers using the new contract', async () => {
  const store = new RuntimeStore(':memory:');
  const requests: {generation: string; method: string; path: string}[] = [];
  const providerRequests: InvocationRequest[] = [];
  const tools = new Map<string, NativeGatewayTool>();
  const agent = {id: sessionId};
  const token = randomUUID();
  const runtimes: AppsRuntime[] = [];
  const servers: Server[] = [];
  let host: AppsHost | undefined;

  const generation = (version: string) => {
    const runtime = new AppsRuntime(store);
    runtimes.push(runtime);
    const capability = descriptor(version);
    const provider: AppProvider = {
      manifest: {manifestVersion: 1, appId, displayName: 'Catalogue protocol fixture', providerPackage: 'catalog-control', providerVersion: version, runtimeProtocolMajor: 1, resourceTypes: ['row']},
      descriptors: [capability],
      async execute(context) {
        providerRequests.push(structuredClone(context.request));
        const input = context.request.input as {label?: string};
        return {status: 'ok', invocationId: context.request.invocationId, traceId: context.request.traceId, data: {version, label: input.label ?? ''}};
      },
      async dispose() {},
    };
    runtime.register(provider);
    const server = createAppsServer({runtime, presentation: new AppsPresentationService({store, runtime}), token});
    server.prependListener('request', request => requests.push({generation: version, method: request.method ?? '', path: request.url ?? ''}));
    servers.push(server);
    return {runtime, server, capability};
  };
  const invocationPosts = () => requests.filter(request => request.method === 'POST' && ['/v1/invocations', '/v1/routed-invocations'].includes(request.path));

  try {
    const first = generation('1.0.0');
    first.runtime.addConnection({appId, connectionId, displayName: 'Protocol control', enabled: true, config: {}, configRevision: 1});
    first.runtime.bind({sessionId, appId, connectionId, enabled: true, boundAt: new Date().toISOString()});
    const port = await listenForFetch(first.server);
    const origin = `http://127.0.0.1:${port}`;
    const transport = new HttpAppsHostTransport(origin, token, async (input, init) => {
      assert.equal(new URL(String(input)).origin, origin, 'all transport calls stay on the isolated Runtime endpoint');
      // Do not retain an idle connection to the retired service generation.
      const headers = new Headers(init?.headers);
      headers.set('Connection', 'close');
      return fetch(input, {...init, headers});
    });
    host = new AppsHost({
      agents: {get: id => id === sessionId ? agent : undefined},
      tools: {register: tool => {assert.equal(tools.has(tool.name), false); tools.set(tool.name, tool); return () => {tools.delete(tool.name);};}},
    }, transport);
    await host.start();
    host.attachApp(appId);
    const describe = tools.get('apps_describe')!;
    const invoke = tools.get('apps_invoke')!;
    const execute = async (tool: NativeGatewayTool, args: Record<string, JsonValue>) => {
      const value = await tool.execute(args, {agent, signal: new AbortController().signal, callId: randomUUID()});
      const text = tool.output.render(args, value).map(item => item.text).join('');
      assert.ok(Buffer.byteLength(text) <= 16384);
      return {value, model: JSON.parse(text)};
    };

    const warm = await execute(describe, {capabilityId, version: '1.0.0'});
    assert.equal(warm.model.status, 'ok');
    assert.deepEqual(warm.model.descriptor, first.capability);
    assert.ok(requests.some(request => request.generation === '1.0.0' && request.path === `/v1/capabilities/${capabilityId}?version=1.0.0`));
    const initialDigest = first.runtime.identity().catalogDigest;
    const initialBindings = first.runtime.sessionBindings(sessionId);
    assert.equal(providerRequests.length, 0);

    // stopProvider retains its manifest. A new Runtime, rather than re-registering
    // in the stopped instance, represents a real service-generation replacement.
    await closeServer(first.server);
    await first.runtime.dispose();
    const current = generation('1.1.0');
    assert.equal(await listen(current.server, port), port);
    assert.notEqual(current.runtime.identity().catalogDigest, initialDigest);
    assert.deepEqual(current.runtime.sessionBindings(sessionId), initialBindings);
    assert.equal(tools.get('apps_describe'), describe, 'the original Host and registered tools survive the Runtime replacement');

    const retiredDescription = await execute(describe, {capabilityId, version: '1.0.0'});
    assert.equal(retiredDescription.model.status, 'failed');
    assert.equal(retiredDescription.model.error.code, 'CAPABILITY_NOT_FOUND');
    assert.equal(retiredDescription.model.descriptor, undefined, 'the model must not see a retired cached schema as available');
    assert.ok(requests.some(request => request.generation === '1.1.0' && request.path === '/v1/runtime'));
    assert.ok(requests.some(request => request.generation === '1.1.0' && request.path === `/v1/capabilities/${capabilityId}?version=1.0.0`));

    const staleInvocationId = 'retired-version-invocation';
    const staleTraceId = 'retired-version-trace';
    const rejected = await execute(invoke, {appId, connectionId, capabilityId, capabilityVersion: '1.0.0', input: {}, invocationId: staleInvocationId, traceId: staleTraceId});
    assert.equal(rejected.model.status, 'failed');
    assert.equal(rejected.model.invocationId, staleInvocationId);
    assert.equal(rejected.model.traceId, staleTraceId);
    assert.equal(rejected.model.error.code, 'CAPABILITY_NOT_FOUND');
    assert.equal(rejected.model.error.retryPolicy, 'never');
    assert.deepEqual(rejected.model.error.details, {expected: {appId, capabilityId, capabilityVersion: '1.0.0'}, actual: {capabilityVersion: '1.1.0'}});
    assert.match(rejected.model.error.message, /1\.0\.0/);
    assert.match(rejected.model.error.message, /1\.1\.0/);
    assert.deepEqual(rejected.value, rejected.model, 'the native failure and model-visible diagnostic identify the same rejected attempt');
    assert.equal(invocationPosts().length, 0, 'Host must reject the retired version before any invocation HTTP request');
    assert.equal(providerRequests.length, 0);
    assert.equal(store.list('invocations').length, 0);
    assert.equal(store.list('operations').length, 0);

    const refreshed = await execute(describe, {capabilityId});
    assert.equal(refreshed.model.status, 'ok');
    assert.deepEqual(refreshed.model.descriptor, current.capability);
    assert.deepEqual(refreshed.model.descriptor.inputSchema.properties.label, {type: 'string'});
    const recoveredInvocationId = 'current-version-invocation';
    const recoveredTraceId = 'current-version-trace';
    const recovered = await execute(invoke, {
      appId, connectionId, capabilityId: refreshed.model.descriptor.capabilityId,
      capabilityVersion: refreshed.model.descriptor.version, input: {label: 'new-contract-input'},
      invocationId: recoveredInvocationId, traceId: recoveredTraceId,
    });
    assert.equal(recovered.model.status, 'ok');
    assert.equal(recovered.model.invocationId, recoveredInvocationId);
    assert.equal(recovered.model.traceId, recoveredTraceId);
    assert.deepEqual(recovered.model.data, {version: '1.1.0', label: 'new-contract-input'});
    const nativeResult = (recovered.value as {result: CapabilityResult}).result;
    assert.deepEqual(nativeResult, recovered.model, 'the model receives the native result with unchanged status, identity and data');
    assert.deepEqual(invocationPosts(), [{generation: '1.1.0', method: 'POST', path: '/v1/routed-invocations'}]);
    assert.equal(providerRequests.length, 1);
    assert.equal(providerRequests[0].capabilityVersion, refreshed.model.descriptor.version);
    assert.equal(providerRequests[0].invocationId, recoveredInvocationId);
    assert.equal(providerRequests[0].traceId, recoveredTraceId);
    assert.deepEqual(providerRequests[0].input, {label: 'new-contract-input'});
    assert.equal(store.list('invocations').length, 1);
    const persisted = store.get<InvocationRecord>('invocations', recoveredInvocationId);
    assert.ok(persisted);
    assert.equal(persisted.invocationId, recoveredInvocationId);
    assert.equal(persisted.state, 'settled');
    assert.deepEqual(persisted.request, providerRequests[0], 'the durable request is the one executed by the new provider');
    assert.equal(persisted.request.appId, appId);
    assert.equal(persisted.request.connectionId, connectionId);
    assert.equal(persisted.request.capabilityId, capabilityId);
    assert.equal(persisted.request.source.kind, 'agent');
    assert.ok('sessionId' in persisted.request.source);
    assert.equal(persisted.request.source.sessionId, sessionId);
    assert.deepEqual(persisted.result, nativeResult, 'the durable result, native return and model view have identical status, identity and data');
    assert.equal(store.get('invocations', staleInvocationId), undefined);
    assert.equal(store.list('operations').length, 0);
  } finally {
    await host?.dispose();
    for (const server of servers) await closeServer(server);
    for (const runtime of runtimes) await runtime.dispose();
    store.close();
  }
});
